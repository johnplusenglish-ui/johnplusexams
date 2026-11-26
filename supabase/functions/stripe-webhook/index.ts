// Stripe webhook: when a Checkout payment completes, give that email 12 months of the pack it bought.
// Works with Stripe Managed Payments (Stripe as merchant of record) and ordinary Stripe Payment Links.
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_LINKS='{"plink_123":"c1-student","plink_456":"c1-teacher"}'
// In Stripe: Developers > Webhooks > Add endpoint https://<project>.supabase.co/functions/v1/stripe-webhook,
// events checkout.session.completed and charge.refunded.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const LINKS: Record<string, string> = JSON.parse(Deno.env.get("STRIPE_LINKS") ?? "{}");
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// Stripe-Signature: t=timestamp,v1=signature[,v1=...]; signed payload is "t.body"; reject anything older than 5 minutes.
async function valid(body: string, header: string | null): Promise<boolean> {
  if (!SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)).filter((p) => p.length === 2)) as Record<string, string>;
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = await hmac(SECRET, `${t}.${body}`);
  return header.split(",").filter((p) => p.startsWith("v1=")).some((p) => same(p.slice(3), expected));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.text();
  if (!(await valid(body, req.headers.get("stripe-signature")))) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(body);
  const obj = event?.data?.object ?? {};

  if (event.type === "checkout.session.completed" && obj.payment_status === "paid") {
    const product = LINKS[String(obj.payment_link ?? "")] ?? obj.metadata?.product;
    const email = String(obj.customer_details?.email ?? obj.customer_email ?? "").trim().toLowerCase();
    if (!product || !email) return new Response("unknown product or no email", { status: 200 });
    const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const orderId = String(obj.payment_intent ?? obj.id);
    const { error } = await db.from("entitlements").upsert({ email, product, expires_at: expires, order_id: orderId }, { onConflict: "order_id" });
    if (error) return new Response(error.message, { status: 500 });
    return new Response("ok", { status: 200 });
  }
  if (event.type === "charge.refunded" && obj.refunded) {
    const { error } = await db.from("entitlements").update({ expires_at: new Date().toISOString() }).eq("order_id", String(obj.payment_intent ?? ""));
    if (error) return new Response(error.message, { status: 500 });
    return new Response("refunded", { status: 200 });
  }
  return new Response("ignored", { status: 200 });
});
