# johnplusexams.com: how it fits together

- **This repo (public, GitHub Pages):** the website, the free sample paper, the sign-in pages and the exam reader. No paid papers live here.
- **Supabase (new organisation on Pro, project "johnplusexams"):** sign-in, the paid papers, the PDFs, scores and mistakes. The rules in `supabase/schema.sql` decide who can read what.
- **Stripe (Managed Payments):** takes the payment and acts as the seller, so it handles VAT. Its webhook tells Supabase who has paid. (Lemon Squeezy was the first plan, but it closed to new sellers in November 2026 and shuts on 31 March 2027.)
- **Private folder `~/Documents/johnplusexams-private`:** the paper seed (`seed-c1.sql`) and the PDFs. Never commit it.

## 1. GitHub
1. On github.com, account `johnplusenglish-ui`: New repository, name `johnplusexams`, Public, no README.
2. Push this folder (Claude does this once you say go).
3. Repo Settings, Pages: Source = Deploy from a branch, `main`, `/ (root)`. Custom domain `johnplusexams.com`. Tick Enforce HTTPS once it is offered.

## 2. GoDaddy DNS (My Products, johnplusexams.com, DNS)
Delete the existing A record for `@` (GoDaddy's "Parked") and any forwarding, then add:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | johnplusenglish-ui.github.io |

It can take from a few minutes to a few hours. HTTPS appears in GitHub Pages after that.

## 3. Supabase
1. Dashboard, organisation menu (top left), New organization "johnplusexams", plan Pro.
2. New project inside it, region EU (Frankfurt or Ireland).
3. SQL editor: run `supabase/schema.sql`, then `~/Documents/johnplusexams-private/seed-c1.sql`.
4. Storage, bucket `pdfs`: upload the folder `~/Documents/johnplusexams-private/pdfs/c1` so the paths are `c1/c1-01-student.pdf` and so on.
5. Authentication, URL Configuration: Site URL `https://johnplusexams.com`, redirect URLs `https://johnplusexams.com/app/`.
6. Authentication, Emails: edit the Magic Link template so it says johnplusexams.
7. Project Settings, API: copy the Project URL and the anon public key into `assets/config.js`.

## 4. Stripe
1. Sign in to Stripe (or create an account) and turn on **Managed Payments** in Settings, so Stripe is the merchant of record and handles VAT. If it is not offered for your country, use Paddle instead and tell Claude.
2. Create two products, one-off price (not recurring): "C1 Use of English, Student (12 months)" EUR 14 and "C1 Use of English, Teacher licence (12 months)" EUR 25.
3. For each, create a **Payment Link**. Under After payment, choose "Don't show confirmation page" and redirect to `https://johnplusexams.com/app/?paid=1`. Turn on "Require customers to accept your terms of service", with the terms URL `https://johnplusexams.com/terms/` set in Stripe's public details. The terms say access starts straight away and the 14-day right to cancel ends, which is what makes "no refunds" valid in the EU.
4. Put both payment links in `assets/config.js` under `checkout`.
5. Deploy the webhook: `supabase functions deploy stripe-webhook --no-verify-jwt`, then `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_LINKS='{"plink_...":"c1-student","plink_...":"c1-teacher"}'` (each payment link's ID starts with plink_).
6. Stripe, Developers, Webhooks: add endpoint `https://<project>.supabase.co/functions/v1/stripe-webhook`, events `checkout.session.completed` and `charge.refunded`. Its signing secret is the `whsec_` value above.

## 5. Contact email
`hello@johnplusexams.com` is printed on the site. Set up free forwarding to your own inbox, for example with ImprovMX: add its two MX records in GoDaddy DNS.

## Adding papers later
```bash
python3 tools/publish_papers.py --pack c1 --batch "<folder with uoe-c1-b1-01.json ...>" --private ~/Documents/johnplusexams-private --sort-start 11
```
Run the new `seed-c1.sql` in Supabase and upload the new PDFs. For B2, use `--pack b2`, add `b2` to `PACKS` in `assets/app.js`, and create `b2-student` / `b2-teacher` products.

## Editing the site
Edit files in `pages/`, then run `python3 build.py`. The exam reader comes from `src/paper_template.html` (the C1 skill's template); after updating it, run `build.py` again.
