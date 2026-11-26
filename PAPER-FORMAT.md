# Paper format for johnplusexams.com

This is the contract between the content sessions (B2, C1, C2), which write papers, and the site, which shows them. A paper that follows it opens in the same reader, marks itself, feeds My Mistakes and prints, with no extra work.

Content sessions write JSON and PDFs into the private folder and run the publish check. They never edit the site code (`build.py`, `pages/`, `assets/`, `src/`, `supabase/`, `tools/`). If the format needs to change, ask the platform session.

Paid papers never go in this repo. Not the JSON, not the PDFs, not the seed SQL.

## 1. Levels at a glance

All three levels use the same JSON shape, the same four parts and the same numbering. Only the Part 4 word limit and the level name change, and the site sets both from the pack.

| | B2 | C1 | C2 |
|---|---|---|---|
| Pack | `b2` | `c1` | `c2` |
| Paper ids | `b2-01`, `b2-02` ... | `c1-01` ... | `c2-01` ... |
| Name on the paper | B2 First | C1 Advanced | C2 Proficiency |
| Part 1, multiple-choice cloze | questions 1 to 8 | 1 to 8 | 1 to 8 |
| Part 2, open cloze | 9 to 16 | 9 to 16 | 9 to 16 |
| Part 3, word formation | 17 to 24 | 17 to 24 | 17 to 24 |
| Part 4, key word transformations | 25 to 30 | 25 to 30 | 25 to 30 |
| Part 4 words allowed (exam rubric) | 2 to 5 | 3 to 6 | 3 to 8 |
| Marks | 8 + 8 + 8 + 12 = 36 | 36 | 36 |

Notes per level:

- **B2.** The counts are the same as C1: 8, 8, 8 and 6. The rubric printed above Part 4 says "between two and five words", because that is the exam rule. John's own B2 rule is stricter (3 to 5 words, mostly 4, never 2): that is for the B2 skill to enforce when writing. The publish check accepts 2 to 5.
- **C1.** The format the first 10 papers use. Nothing extra.
- **C2.** Same shape again. Part 4 allows 3 to 8 words. There is no C2 skill for Parts 1 to 3 yet, so the C2 session writes them straight into this format, using the C1 skill's rules as the starting point and raising the level. Part 4 can come from the key-word-transformations skill (C2 mode): copy its items into `part4.items` and add `q` numbers 25 to 30 and an `explain` to each.

Text lengths (house targets from the skills, not checked by the publisher): Parts 1 to 3 have one titled text of roughly 150 to 200 words each.

## 2. Files and the private folder

```
~/Documents/johnplusexams-private/          never commit any of this
  batches/<pack>/b<batch>/                   where content sessions write (suggested)
    uoe-b2-b1-01.json                        one paper
    uoe-b2-b1-01-student.pdf                 its student PDF
    uoe-b2-b1-01-teacher.pdf                 its answer key PDF
    uoe-b2-b1-02.json ...
  seed-<pack>.sql                            written by the publisher (first batch)
  seed-<pack>-from-<NN>.sql                  written by the publisher (later batches)
  pdfs/<pack>/<id>-student.pdf               written by the publisher, uploaded to Supabase
  pdfs/<pack>/<id>-teacher.pdf
  paper_index.csv, papers.csv                exports of the two Supabase tables (reference only)
```

Batch file names must be exactly `uoe-<pack>-b<batch>-<NN>.json`, for example `uoe-c2-b1-07.json`. The publisher only picks up files for the pack you name, sorts them by file name, and numbers them as papers in that order. The two PDFs sit next to the JSON with the same base name plus `-student.pdf` and `-teacher.pdf`.

You never choose the paper id. The publisher gives the first file in the batch the id `<pack>-<sort-start>` (`b2-01` by default) and counts up. For a second batch, pass `--sort-start 11` so it continues at `b2-11`.

## 3. The JSON

One file is one paper: one entry in `tests`, with all four parts.

```json
{
  "title": "Reading and Use of English",
  "tests": [
    {
      "part1": { "title": "...", "text": "...", "example": {...}, "items": [ 8 items, q 1 to 8 ] },
      "part2": { "title": "...", "text": "...", "example": {...}, "items": [ 8 items, q 9 to 16 ] },
      "part3": { "title": "...", "text": "...", "example": {...}, "items": [ 8 items, q 17 to 24 ] },
      "part4": { "example": {...}, "items": [ 6 items, q 25 to 30 ] }
    }
  ]
}
```

The publisher adds three fields itself, so leave them out or expect them to be overwritten: `tests[0].name` ("Paper 7"), top-level `level` ("B2", "C1" or "C2") and the id. Other top-level keys from the skills (`written`, `focus`) are harmless and ignored.

### Texts (Parts 1, 2 and 3)

- `title`: the text's title. Part 1's title becomes the paper's title on My papers; Part 2's and Part 3's become its topics line.
- `text`: the passage. Paragraphs are separated by a blank line (`\n\n`). Each gap is `{{n}}` with its question number. The example is `{{0}}` and comes first. Every question number appears exactly once, in order, and no other numbers appear.
- Formatting inside texts: plain text only. No HTML, no Markdown.

### Part 1: multiple-choice cloze

```json
"example": { "options": {"A": "enjoyed", "B": "relished", "C": "appreciated", "D": "welcomed"}, "answer": "A" },
"items": [
  { "q": 1,
    "options": {"A": "regarded", "B": "observed", "C": "overlooked", "D": "inspected"},
    "answer": "B",
    "category": "meaning precision",
    "tests": "be observed doing something",
    "why": "regarded needs 'as', overlooked means not noticed, ...",
    "explain": "To be **observed doing** something is ..." }
]
```

| Field | Required | Shown where |
|---|---|---|
| `q` | yes | number on the paper |
| `options` | yes, exactly A, B, C, D | the answer buttons and in the gap |
| `answer` | yes, one letter | marking |
| `explain` | yes | explanations panel, answer key, My Mistakes |
| `why` | yes | "Why not the others" in explanations and key |
| `tests` | yes | "Tests:" in the answer key |
| `category` | yes (Parts 1 and 2) | not shown; used by the skills' validators |

### Part 2: open cloze

```json
"example": { "answer": "without" },
"items": [
  { "q": 10, "answer": ["until", "till"], "category": "linker", "tests": "it was not until ... that", "explain": "..." }
]
```

- `answer` is always a list: the main answer first, then at most one accepted alternative. One word each, no spaces.
- Marking ignores capitals and is otherwise exact.

### Part 3: word formation

```json
"example": { "stem": "FRIEND", "answer": "friendly" },
"items": [
  { "q": 17, "stem": "EMBARRASS", "answer": ["embarrassingly"], "change": "verb to adverb, -ing and -ly", "tests": "adverb before an adjective", "explain": "..." }
]
```

- `stem` in CAPITALS. The reader prints it after the gap.
- `answer` is a list, as in Part 2.
- `change` is not shown on the site, but keep it: the skills use it.

### Part 4: key word transformations

No title and no text. The rubric and word limit are printed by the reader for the level.

```json
"example": { "lead": "'You should see a doctor about your knee,' Jo told me.", "key": "ADVISED", "gapped": "Jo ___ a doctor about my knee.", "answer": "advised me | to see" },
"items": [
  { "q": 25,
    "lead": "Immediately after the plane took off, one of its engines failed.",
    "key": "HARDLY",
    "gapped": "The plane ___ when one of its engines failed.",
    "answer": "had hardly | taken off",
    "alts": [],
    "tests": "had hardly + past participle ... when",
    "explain": "..." }
]
```

- `lead`: the first sentence. `key`: the key word in CAPITALS. `gapped`: the second sentence with one gap written as three or more underscores (`___`).
- `answer`: the whole gap, split into the two marking halves with one `|`. Each half is worth one mark.
- `alts`: other full answers, same `|` format. Usually empty, at most one or two.
- The key word must appear in the answer (a contraction of it is fine: SHOULD with "shouldn't have").
- How it marks: the student's answer gets 2 marks if it matches `answer` or an `alt` in full, and 1 mark if it starts with a first half or ends with a second half. Contractions and full forms count as the same (didn't = did not). So each half must be exactly what you would accept on its own.
- Word count follows the exam: contractions count as the words they stand for (didn't is two), except can't, which counts as the one word cannot.

### `explain` (every question, every part)

One or two short plain sentences for the student: what the answer means or which rule makes it right, and where the clue is. Mark the key language with `**double stars**`; the site shows it in bold, never italic. Put words quoted from the text in single quotes. Nothing else: no HTML, no single stars, no underscores for emphasis. On My Mistakes the stars are stripped and the text is shown plain.

### House style (all text in the file)

John's rules apply to every string: no em dashes or en dashes, no italics, no emojis, contractions are fine, plain English, British spelling. The publisher refuses a file with a dash, an `<i>` or `<em>`, or an emoji.

## 4. PDFs

Two per paper, made by the level's skill (`build_uoe_page.py <file>.json --pdf`): a student paper and a teacher paper with the answer key. A4, one part per page. They go next to the JSON with the names in section 2. The publisher copies them to `pdfs/<pack>/<id>-student.pdf` and `<id>-teacher.pdf` and records the paths in `paper_index`. Signed-in buyers of the pack can open them from My papers; Supabase's storage rules decide this from the folder name, so the folder must be the pack.

## 5. Publishing

Step 1, check (writes nothing):

```bash
python3 tools/publish_papers.py --pack b2 --batch ~/Documents/johnplusexams-private/batches/b2/b1 --check
```

It lists every problem by file and question. Fix them all, then run it again until it says the papers pass.

Step 2, publish:

```bash
python3 tools/publish_papers.py --pack b2 --batch ~/Documents/johnplusexams-private/batches/b2/b1 --private ~/Documents/johnplusexams-private
```

For a later batch add `--sort-start 11` (or whatever the next number is). The output goes to `seed-b2-from-11.sql`, so the first seed is never overwritten. Re-running a batch is safe: the SQL updates rows that already exist.

Step 3, John does these himself in the Supabase dashboard (project xlwxlzvnkeuvbinushoa):

1. SQL editor: paste and run the new `seed-<pack>...sql`.
2. Storage, bucket `pdfs`: upload the folder `pdfs/<pack>` so paths read `b2/b2-01-student.pdf`.

Nobody runs these with a service key from a session.

Step 4, for a level's first batch only: tell the platform session. It adds the pack to `PACKS` in `assets/app.js`, the level page and pricing card, the Stripe product and payment links, the `STRIPE_LINKS` secret and the live link in `assets/config.js`. Until then the papers sit safely in Supabase but nobody can buy or see them.

## 6. Checklist before publishing

Run `--check` first; it covers the items marked (auto). Do the rest by eye.

- [ ] (auto) The file is named `uoe-<pack>-b<batch>-<NN>.json` and the pack is right.
- [ ] (auto) One entry in `tests`, with `part1` to `part4`.
- [ ] (auto) Questions are 1 to 8, 9 to 16, 17 to 24 and 25 to 30, in order.
- [ ] (auto) Each text has `{{0}}` and each of its question gaps exactly once, in order.
- [ ] (auto) Every part has an example; every Part 1 to 3 text has a title.
- [ ] (auto) Part 1: options A to D, answer a letter, a `why` for every question.
- [ ] (auto) Parts 2 and 3: answers are lists of single words, at most one alternative; Part 3 stems in capitals.
- [ ] (auto) Part 4: one `___` in `gapped`, one `|` in every answer and alt, the key word in each answer, word count inside the level's limit.
- [ ] (auto) Every question has `explain` and `tests`.
- [ ] (auto) No em or en dashes, no `<i>` or `<em>`, no emojis anywhere.
- [ ] (auto) Both PDFs are next to the JSON (use `--no-pdfs` only for a test run).
- [ ] The level skill's own validator passes (`validate_uoe.py`), including its repeat check across earlier papers.
- [ ] Each Part 4 half is acceptable on its own, since halves are marked separately.
- [ ] Every real alternative a strong student might write is in `answer` (Parts 2 and 3) or `alts` (Part 4).
- [ ] The three text titles are different from every published paper in the pack (they are what students see on My papers).
- [ ] The PDFs open and match the JSON (same texts, same answers).

## 7. What the site reads, for reference

- `tools/publish_papers.py` validates, numbers and writes the seed.
- Supabase `paper_index` (id, pack, title, topics, sort, pdf_student, pdf_teacher) is the list on My papers. `papers` (id, pack, data) holds the JSON. Both are readable only by someone whose pack is active (`has_pack` in `supabase/schema.sql`), and the pack is the part of the id before the dash.
- `src/paper_template.html` is the reader (built into `assets/paper-engine.js`). It reads `title`, `level`, `tests[].name` and, per part, `title`, `text`, `example`, and per item `q`, `options`, `answer`, `alts`, `stem`, `lead`, `key`, `gapped`, `explain`, `tests`, `why`. Question ranges in the rubrics come from the items, and the level name and Part 4 word limit come from `level`.
- `assets/app.js` lists the packs in `PACKS`, sets `level` from the pack when a paper has none, saves scores per part and keeps wrong answers for My Mistakes.
