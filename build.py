#!/usr/bin/env python3
"""Build johnplusexams.com: shared header and footer around each page in pages/.

    python3 build.py

Each file in pages/ starts with a front-matter block:
    title: Page title
    description: One line for search results
    path: c1-use-of-english/index.html
    nav: c1            (optional, marks the active nav link)
    app: true          (optional, loads Supabase and app.js)
---
<html body content>
"""
import os, re, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://johnplusexams.com"
FONTS = open(os.path.join(ROOT, "assets/fonts/fonts.css")).read()
SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.min.js"

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<meta property="og:image" content="{site}/assets/img/og.jpg">
<meta name="theme-color" content="#D9DEE5">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/outfit-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>{fonts}</style>
<link rel="stylesheet" href="/assets/site.css">
{extra_head}</head>
<body{body_attr}>
<a class="sr" href="#main">Skip to the content</a>
<header class="top"><div class="wrap">
  <a class="logo" href="/" aria-label="johnplusexams home"><svg class="logo-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"></path><path d="M15 3v4h4"></path><path d="M9 14l2 2 4-4"></path></svg><span class="logo-text">john<span>plus</span>exams</span></a>
  <nav class="nav" aria-label="Main">
    <a href="/#levels"{c1}>Exams</a>
    <a class="hide-sm" href="/sample/c1-use-of-english.html">Free paper</a>
    <a class="hide-sm" href="/pricing/"{pricing}>Pricing</a>
    <a class="btn small" href="/app/" data-account>Sign in</a>
  </nav>
</div></header>
<main id="main" class="wrap">
"""

FOOT = """</main>
<footer class="site-foot"><div class="wrap">
  <div><a class="logo" href="/"><svg class="logo-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"></path><path d="M15 3v4h4"></path><path d="M9 14l2 2 4-4"></path></svg><span class="logo-text">john<span>plus</span>exams</span></a><p class="small">Exam practice by John from <a href="https://johnplusenglish.com">johnplusenglish</a>.</p></div>
  <nav aria-label="Footer">
    <a href="/c1-use-of-english/">C1 Advanced</a>
    <a href="/pricing/">Pricing</a>
    <a href="/app/">My account</a>
    <a href="/terms/">Terms</a>
    <a href="/refunds/">Refunds</a>
    <a href="/privacy/">Privacy</a>
    <a href="https://www.instagram.com/johnplusenglish/" rel="noopener">Instagram</a>
  </nav>
  <p class="disclaimer">johnplusexams is an independent practice resource and is not affiliated with or endorsed by Cambridge University Press &amp; Assessment. B2 First and C1 Advanced are names of Cambridge English Qualifications, used here only to say which exam the material prepares for.</p>
</div></footer>
{scripts}</body>
</html>
"""


def build():
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, "pages", "*.html"))):
        raw = open(f, encoding="utf-8").read()
        meta_s, body = raw.split("\n---\n", 1)
        meta = dict(l.split(":", 1) for l in meta_s.strip().splitlines() if ":" in l)
        meta = {k.strip(): v.strip() for k, v in meta.items()}
        path = meta["path"]
        url = SITE + "/" + re.sub(r"index\.html$", "", path)
        app = meta.get("app") == "true"
        scripts = ""
        if app:
            scripts = '<script src="%s"></script>\n<script src="/assets/config.js"></script>\n<script src="/assets/app.js"></script>\n' % SUPABASE_JS
        else:
            scripts = '<script src="/assets/nav.js" defer></script>\n'
        nav = meta.get("nav", "")
        html = HEAD.format(title=meta["title"], description=meta["description"].replace('"', "&quot;"), url=url, site=SITE,
                           fonts=FONTS, extra_head=meta.get("head", ""), body_attr=' data-page="%s"' % meta.get("page", nav or "page"),
                           c1=' aria-current="page"' if nav == "c1" else "", pricing=' aria-current="page"' if nav == "pricing" else "")
        html += body.strip() + "\n" + FOOT.format(scripts=scripts)
        for bad in ("—", "–"):
            assert bad not in html, "dash in %s" % f
        dest = os.path.join(ROOT, path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, "w", encoding="utf-8").write(html)
        out.append(path)
    # sitemap of public pages
    pub = [p for p in out if not p.startswith("app/")]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in pub + ["sample/c1-use-of-english.html"]:
        sm.append("  <url><loc>%s/%s</loc></url>" % (SITE, re.sub(r"index\.html$", "", p)))
    sm.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w").write("\n".join(sm) + "\n")
    print("built", len(out), "pages:", ", ".join(out))


def build_reader():
    """app/paper.html: the exam page from src/paper_template.html, with its code split out into
    assets/paper-engine.js so the paper data can arrive after sign-in instead of being baked in."""
    t = open(os.path.join(ROOT, "src/paper_template.html"), encoding="utf-8").read()
    i, j = t.index("<script>"), t.rindex("</script>")
    engine = t[i + len("<script>"):j]
    engine = engine.replace("var DATA = __DATA__;", "var DATA = window.__PAPER__;")
    engine = engine.replace("var PHOTO = '__PHOTO__'", "var PHOTO = '/assets/img/john.jpg'")
    hook = "    var ps = document.getElementById('ps-' + pk); if(ps) ps.textContent = 'You scored ' + sub + ' out of ' + pm + '.';\n    return [sub, pm];"
    assert hook in engine, "checkPart hook point moved"
    engine = engine.replace(hook, hook.replace("    return [sub, pm];",
        "    try{ window.dispatchEvent(new CustomEvent('uoe:part-checked', {detail:{pk:pk, test:cur(), sub:sub, max:pm, marks:marks}})); }catch(e){}\n    return [sub, pm];"))
    open(os.path.join(ROOT, "assets/paper-engine.js"), "w", encoding="utf-8").write("/* Built from src/paper_template.html by build.py. Do not edit by hand. */\n" + engine)
    page = t[:i] + ('<script src="%s"></script>\n<script src="/assets/config.js"></script>\n<script src="/assets/app.js"></script>\n' % SUPABASE_JS) + t[j + len("</script>"):]
    page = page.replace("__TITLE__", "Your paper · johnplusexams")
    gate = ('<main>\n  <div class="jpx-bar"><a href="/app/">&larr; My papers</a><a href="/app/mistakes.html">My Mistakes</a></div>\n'
            '  <div id="gate" class="jpx-gate" role="status">Opening your paper...</div>\n  <div id="paper"></div>')
    assert "<main>\n  <div id=\"paper\"></div>" in page
    page = page.replace("<main>\n  <div id=\"paper\"></div>", gate)
    page = page.replace("</style>", ".jpx-bar{display:flex;justify-content:space-between;gap:12px;margin:0 0 14px;font-size:.95rem}.jpx-bar a{color:var(--ink);text-decoration:none;font-weight:600}.jpx-bar a:hover{color:var(--sky)}"
                        ".jpx-gate{background:#fff;border-radius:6px;padding:28px;text-align:center;color:var(--soft)}.jpx-gate:empty{display:none}.jpx-gate a{color:var(--sky)}\n</style>", 1)
    page = page.replace('<meta name="viewport"', '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<meta name="robots" content="noindex">\n<meta name="viewport"', 1)
    for bad in ("—", "–"):
        assert bad not in page + engine
    open(os.path.join(ROOT, "app/paper.html"), "w", encoding="utf-8").write(page)
    print("built app/paper.html and assets/paper-engine.js")


if __name__ == "__main__":
    build()
    build_reader()
