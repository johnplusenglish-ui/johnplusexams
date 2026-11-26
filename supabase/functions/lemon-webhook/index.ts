// Lemon Squeezy webhook: when an order is paid, give that email 12 months of the pack it bought.
// Deploy:  supabase functions deploy lemon-webhook --no-verify-jwt
// Secrets: supabase secrets set LEMON_SIGNING_SECRET=... LEMON_VARIANTS='{"123456":"c1-student","123457":"c1-teacher"}'
// In Lemon Squeezy: Settings > Webhooks > URL https://<project>.supabase.co/functions/v1/lemon-webhook,
// events order_created and order_refunded, same signing secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SECRET = Deno.env.get("LEMON_SIGNING_SECRET") ?? "";
const VARIANTS: Record<string, string> = JSON.parse(Deno.env.get("LEMON_VARIANTS") ?? "{}");
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function validSignature(body: string, sig: string | null): Promise<boolean> {
  if (!SECRET || !sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.text();
  if (!(await validSignature(body, req.headers.get("x-signature")))) return new Response("bad signature", { status: 401 });
  const event = JSON.parse(body);
  const name = event?.meta?.event_name;
  const attrs = event?.data?.attributes ?? {};
  const orderId = String(event?.data?.id ?? "");
  const variant = String(attrs?.first_order_item?.variant_id ?? "");
  const product = VARIANTS[variant];
  const email = String(attrs?.user_email ?? "").trim().toLowerCase();

  if (name === "order_created" && attrs.status === "paid") {
    if (!product || !email) return new Response("unknown variant or no email", { status: 200 });
    const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const { error } = await db.from("entitlements").upsert({ email, product, expires_at: expires, order_id: orderId }, { onConflict: "order_id" });
    if (error) return new Response(error.message, { status: 500 });
    return new Response("ok", { status: 200 });
  }
  if (name === "order_refunded") {
    const { error } = await db.from("entitlements").update({ expires_at: new Date().toISOString() }).eq("order_id", orderId);
    if (error) return new Response(error.message, { status: 500 });
    return new Response("refunded", { status: 200 });
  }
  return new Response("ignored", { status: 200 });
});
