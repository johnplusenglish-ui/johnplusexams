# johnplusexams.com: how it fits together

- **This repo (public, GitHub Pages):** the website, the free sample paper, the sign-in pages and the exam reader. No paid papers live here.
- **Supabase (new organisation on Pro, project "johnplusexams"):** sign-in, the paid papers, the PDFs, scores and mistakes. The rules in `supabase/schema.sql` decide who can read what.
- **Lemon Squeezy:** takes the payment and handles VAT. Its webhook tells Supabase who has paid.
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

## 4. Lemon Squeezy
1. Create two products: "C1 Use of English, Student (12 months)" and "C1 Use of English, Teacher licence (12 months)". Single payment, not subscription.
2. Copy each checkout link into `assets/config.js` under `checkout`.
3. Note each variant ID.
4. Deploy the webhook: `supabase functions deploy lemon-webhook --no-verify-jwt`, then set secrets `LEMON_SIGNING_SECRET` and `LEMON_VARIANTS` (variant ID to `c1-student` / `c1-teacher`).
5. Lemon Squeezy Settings, Webhooks: URL `https://<project>.supabase.co/functions/v1/lemon-webhook`, events `order_created` and `order_refunded`, the same signing secret.

## Adding papers later
```bash
python3 tools/publish_papers.py --pack c1 --batch "<folder with uoe-c1-b1-01.json ...>" --private ~/Documents/johnplusexams-private --sort-start 11
```
Run the new `seed-c1.sql` in Supabase and upload the new PDFs. For B2, use `--pack b2`, add `b2` to `PACKS` in `assets/app.js`, and create `b2-student` / `b2-teacher` products.

## Editing the site
Edit files in `pages/`, then run `python3 build.py`. The exam reader comes from `src/paper_template.html` (the C1 skill's template); after updating it, run `build.py` again.
