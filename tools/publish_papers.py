#!/usr/bin/env python3
"""Turn a batch of paper JSON files into what the site needs, WITHOUT putting them in this public repo.
The format is in PAPER-FORMAT.md at the repo root.

    python3 tools/publish_papers.py --pack b2 --batch "<folder with uoe-b2-b1-01.json ...>" \
        --private ~/Documents/johnplusexams-private [--sort-start 11] [--demo <folder served as /private-demo/>]

    python3 tools/publish_papers.py --pack b2 --batch "<folder>" --check     # validate only, write nothing

Every paper is validated first. Any error stops the run and nothing is written.
Writes to --private:
  seed-<pack>.sql      paste into the Supabase SQL editor: fills paper_index and papers
  pdfs/<pack>/...      the student and teacher PDFs, ready to upload to the private "pdfs" bucket
With --demo, also writes the same papers as plain JSON for the local preview (never commit that folder).
"""
import argparse, glob, json, os, re, shutil, sys

# What differs between levels. Everything else (parts, counts, numbering, fields) is the same.
LEVELS = {
    "b2": {"level": "B2", "k4": (2, 5)},
    "c1": {"level": "C1", "k4": (3, 6)},
    "c2": {"level": "C2", "k4": (3, 8)},
}
PARTS = {"part1": range(1, 9), "part2": range(9, 17), "part3": range(17, 25), "part4": range(25, 31)}
GAP = re.compile(r"\{\{(\d+)\}\}")
BANNED = [("—", "em dash"), ("–", "en dash"), ("<i>", "italics"), ("<em>", "italics")]
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️]")


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def expand(ans):
    """A Part 4 answer with contractions written out (didn't -> did not, can't -> cannot)."""
    s = ans.replace("|", " ").lower().replace("’", "'")
    s = re.sub(r"\bcan't\b", "cannot", s)
    s = re.sub(r"\bwon't\b", "will not", s)
    s = re.sub(r"\bshan't\b", "shall not", s)
    s = re.sub(r"n't\b", " not", s)
    s = re.sub(r"'(ll|ve|re|m|d|s)\b", r" \1", s)
    return s


def k4_words(ans):
    """Words in a Part 4 answer, as the exam counts them: contractions count as the words they stand for,
    except can't, which is the one word cannot."""
    return len(expand(ans).split())


def strings(x):
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from strings(v)
    elif isinstance(x, list):
        for v in x:
            yield from strings(v)


def validate(d, pack, name):
    """Return a list of errors for one paper file (empty when it is fine)."""
    E = []
    err = lambda m: E.append("%s: %s" % (name, m))
    lo, hi = LEVELS[pack]["k4"]
    if not isinstance(d.get("tests"), list) or len(d["tests"]) != 1:
        return ["%s: needs exactly one entry in tests[]" % name]
    t = d["tests"][0]
    for s in strings(d):
        for bad, what in BANNED:
            if bad in s:
                err("contains an %s: %r" % (what, s[:60]))
        if EMOJI.search(s):
            err("contains an emoji: %r" % s[:60])
    for pk, qs in PARTS.items():
        p = t.get(pk)
        if not isinstance(p, dict):
            err("%s is missing" % pk)
            continue
        items = p.get("items") or []
        got = [it.get("q") for it in items]
        if got != list(qs):
            err("%s questions must be %d to %d in order, found %s" % (pk, qs[0], qs[-1], got))
        ex = p.get("example")
        if not isinstance(ex, dict):
            err("%s has no example" % pk)
            ex = {}
        for it in items:
            n = it.get("q")
            tag = "%s q%s" % (pk, n)
            if not str(it.get("explain", "")).strip():
                err("%s has no explain" % tag)
            if not str(it.get("tests", "")).strip():
                err("%s has no tests label" % tag)
            if pk == "part1":
                o = it.get("options") or {}
                if sorted(o) != ["A", "B", "C", "D"] or not all(str(v).strip() for v in o.values()):
                    err("%s needs options A, B, C and D" % tag)
                if it.get("answer") not in ("A", "B", "C", "D"):
                    err("%s answer must be a letter A to D" % tag)
                if not str(it.get("why", "")).strip():
                    err("%s has no why" % tag)
            elif pk in ("part2", "part3"):
                a = it.get("answer")
                if not isinstance(a, list) or not a or not all(isinstance(x, str) and x.strip() for x in a):
                    err("%s answer must be a list of strings, main answer first" % tag)
                elif len(a) > 2:
                    err("%s has more than one alternative" % tag)
                elif any(" " in x.strip() for x in a):
                    err("%s answers must be one word" % tag)
                if pk == "part3":
                    st = str(it.get("stem", ""))
                    if not st or st != st.upper():
                        err("%s needs a stem in CAPITALS" % tag)
            else:
                for f in ("lead", "key", "gapped", "answer"):
                    if not str(it.get(f, "")).strip():
                        err("%s has no %s" % (tag, f))
                key = str(it.get("key", ""))
                if key != key.upper():
                    err("%s key must be in CAPITALS" % tag)
                if len(re.findall(r"_{3,}", str(it.get("gapped", "")))) != 1:
                    err("%s gapped needs exactly one ___" % tag)
                alts = it.get("alts", [])
                if not isinstance(alts, list):
                    err("%s alts must be a list" % tag)
                    alts = []
                for a in [it.get("answer", "")] + alts:
                    if str(a).count("|") != 1:
                        err("%s answer %r needs exactly one | between the two halves" % (tag, a))
                    full = expand(str(a)).replace("cannot", "can not")
                    if key and not re.search(r"\b%s\b" % re.escape(key.lower()), str(a).lower() + " " + full):
                        err("%s answer %r does not contain the key word %s" % (tag, a, key))
                    w = k4_words(str(a))
                    if not lo <= w <= hi:
                        err("%s answer %r is %d words; %s allows %d to %d" % (tag, a, w, pack.upper(), lo, hi))
        if pk == "part4":
            for f in ("lead", "key", "gapped", "answer"):
                if not str(ex.get(f, "")).strip():
                    err("part4 example has no %s" % f)
            continue
        if not str(p.get("title", "")).strip():
            err("%s has no title" % pk)
        text = str(p.get("text", ""))
        found = [int(x) for x in GAP.findall(text)]
        if found != [0] + list(qs):
            err("%s text must have {{0}} then {{%d}} to {{%d}} once each, in order; found %s" % (pk, qs[0], qs[-1], found))
        if pk == "part1":
            o = ex.get("options") or {}
            if sorted(o) != ["A", "B", "C", "D"] or ex.get("answer") not in o:
                err("part1 example needs options A to D and an answer letter")
        elif not isinstance(ex.get("answer"), str) or not ex.get("answer"):
            err("%s example answer must be a string" % pk)
        if pk == "part3" and not str(ex.get("stem", "")).strip():
            err("part3 example has no stem")
    return E


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", required=True, choices=sorted(LEVELS))
    ap.add_argument("--batch", required=True)
    ap.add_argument("--private")
    ap.add_argument("--demo")
    ap.add_argument("--sort-start", type=int, default=1)
    ap.add_argument("--check", action="store_true", help="validate the batch and stop")
    ap.add_argument("--no-pdfs", action="store_true", help="allow papers without their two PDFs")
    a = ap.parse_args()
    batch = os.path.expanduser(a.batch)
    files = sorted(glob.glob(os.path.join(batch, "uoe-%s-b*-[0-9][0-9].json" % a.pack)))
    assert files, "no uoe-%s-b<batch>-<NN>.json files in %s" % (a.pack, batch)

    errors, papers = [], []
    for f in files:
        name = os.path.basename(f)
        try:
            d = json.load(open(f, encoding="utf-8"))
        except ValueError as e:
            errors.append("%s: not valid JSON (%s)" % (name, e))
            continue
        errors += validate(d, a.pack, name)
        base = os.path.splitext(f)[0]
        for kind in ("student", "teacher"):
            if not a.no_pdfs and not os.path.exists(base + "-%s.pdf" % kind):
                errors.append("%s: missing %s" % (name, os.path.basename(base) + "-%s.pdf" % kind))
        papers.append((f, d))
    if errors:
        print("\n".join(errors))
        sys.exit("%d problem(s) in %d file(s). Nothing was written." % (len(errors), len(files)))
    if a.check:
        print("%d %s papers pass. Nothing was written (--check)." % (len(files), a.pack.upper()))
        return
    assert a.private, "--private is required unless --check"

    priv = os.path.expanduser(a.private)
    os.makedirs(os.path.join(priv, "pdfs", a.pack), exist_ok=True)
    index, sql = [], ["-- Generated by tools/publish_papers.py. Contains paid content: never commit.", "begin;"]
    for n, (f, d) in enumerate(papers, a.sort_start):
        t = d["tests"][0]
        pid = "%s-%02d" % (a.pack, n)
        t["name"] = "Paper %d" % n
        titles = [t[p]["title"] for p in ("part1", "part2", "part3")]
        base = os.path.splitext(f)[0]
        pdfs = {}
        for kind in ("student", "teacher"):
            src = base + "-%s.pdf" % kind
            if os.path.exists(src):
                rel = "%s/%s-%s.pdf" % (a.pack, pid, kind)
                shutil.copy(src, os.path.join(priv, "pdfs", rel))
                pdfs[kind] = rel
        row = {"id": pid, "pack": a.pack, "title": titles[0], "topics": " · ".join(titles[1:]),
               "sort": n, "pdf_student": pdfs.get("student"), "pdf_teacher": pdfs.get("teacher")}
        index.append(row)
        paper = {"title": d.get("title", "Reading and Use of English"), "level": LEVELS[a.pack]["level"], "tests": [t]}
        sql.append("insert into paper_index (id, pack, title, topics, sort, pdf_student, pdf_teacher) values (%s, %s, %s, %s, %d, %s, %s)\n"
                   "  on conflict (id) do update set title = excluded.title, topics = excluded.topics, sort = excluded.sort, pdf_student = excluded.pdf_student, pdf_teacher = excluded.pdf_teacher;"
                   % (q(pid), q(a.pack), q(row["title"]), q(row["topics"]), n, q(row["pdf_student"]) if row["pdf_student"] else "null", q(row["pdf_teacher"]) if row["pdf_teacher"] else "null"))
        sql.append("insert into papers (id, pack, data) values (%s, %s, %s::jsonb)\n  on conflict (id) do update set data = excluded.data;"
                   % (q(pid), q(a.pack), q(json.dumps(paper, ensure_ascii=False))))
        if a.demo:
            os.makedirs(os.path.join(a.demo, "pdf"), exist_ok=True)
            json.dump(paper, open(os.path.join(a.demo, pid + ".json"), "w"), ensure_ascii=False)
            for kind, rel in pdfs.items():
                shutil.copy(os.path.join(priv, "pdfs", rel), os.path.join(a.demo, "pdf", os.path.basename(rel)))
    sql.append("commit;")
    out = os.path.join(priv, "seed-%s.sql" % a.pack)
    if a.sort_start > 1:
        out = os.path.join(priv, "seed-%s-from-%02d.sql" % (a.pack, a.sort_start))
    open(out, "w", encoding="utf-8").write("\n".join(sql) + "\n")
    if a.demo:
        json.dump(index, open(os.path.join(a.demo, a.pack + "-index.json"), "w"), ensure_ascii=False)
    print("%d papers (%s-%02d to %s-%02d) -> %s and %s/pdfs/%s/" % (len(papers), a.pack, a.sort_start, a.pack, a.sort_start + len(papers) - 1, out, priv, a.pack))


if __name__ == "__main__":
    main()
