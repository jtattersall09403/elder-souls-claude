#!/usr/bin/env python3
"""mw-book-stats.py — measure Morrowind's OWN book corpus out of the vendored UESP extract.

WHY THIS EXISTS
---------------
RI-LOR03 §1 ("Length statistics — Morrowind + Tribunal + Bloodmoon readable books") is marked
`provenance: canonical-recall, confidence: medium`, and its own provenance note says:

    "Direct verification was attempted and blocked ... If a later agent can extract Morrowind's
     BOOK records, re-measure and amend this section, keeping the old figures struck through."

`corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` contains the `Lore:` pages that carry the
full text of the books, and the `Morrowind:`/`Tribunal:`/`Bloodmoon:` pages that carry the
`{{Game Book}}` infobox saying which of them actually ship in those games. That is enough to
measure §1 for the first time.

It also emits a per-book plaintext dump so a critic can run RI-LOR03 step 2 (the blind pair)
against real Morrowind prose instead of recalled prose, and reports the same "numeral tic"
frequencies used to test whether our corpus reads as one author.

Written by the W1-LIBRARY round-1 critic; declared under `method_deviations`.
"""
from __future__ import annotations

import argparse
import collections
import json
import lzma
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXTRACT = ROOT / "corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz"

GAMES = ("Morrowind", "Tribunal", "Bloodmoon")


def strip_wiki(text: str) -> str:
    """Turn wikitext into the words a player would read on the page."""
    t = text
    # drop the leading infobox template(s)
    while t.lstrip().startswith("{{"):
        depth, i = 0, t.index("{{")
        j = i
        while j < len(t):
            if t.startswith("{{", j):
                depth += 1
                j += 2
            elif t.startswith("}}", j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
            else:
                j += 1
        t = t[j:]
    # inline templates that wrap a display string
    t = re.sub(r"\{\{(?:Lore Link|Quest Link|Place Link|Book Link|Small|Anchor|Huh)\|([^{}|]*?)\|([^{}]*?)\}\}", r"\2", t)
    t = re.sub(r"\{\{(?:Lore Link|Quest Link|Place Link|Book Link|Small|Anchor)\|([^{}|]*?)\}\}", r"\1", t)
    t = re.sub(r"\{\{[^{}]*\}\}", " ", t)
    t = re.sub(r"\{\{[^{}]*\}\}", " ", t)
    # links
    t = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"\[\[([^\]]*)\]\]", r"\1", t)
    # refs, comments, tables, formatting
    t = re.sub(r"<ref[^>]*>.*?</ref>", " ", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"^\{\|.*?^\|\}", " ", t, flags=re.S | re.M)
    t = re.sub(r"'{2,}", "", t)
    t = re.sub(r"^=+\s*(.*?)\s*=+\s*$", r"\1", t, flags=re.M)
    t = re.sub(r"^[*#:;]+", "", t, flags=re.M)
    return re.sub(r"[ \t]+", " ", t).strip()


def load(extract: Path):
    pages = {}
    with lzma.open(extract, "rt", encoding="utf8") as fh:
        for line in fh:
            d = json.loads(line)
            pages[d["title"]] = d.get("text") or ""
    return pages


def book_titles(pages):
    """Books that ship in MW/TR/BM, by the presence of a {{Game Book}} page in that namespace."""
    out = {}
    for title, text in pages.items():
        ns, _, name = title.partition(":")
        if ns not in GAMES:
            continue
        if "{{Game Book" not in text:
            continue
        out.setdefault(name, set()).add(ns)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract", default=str(EXTRACT))
    ap.add_argument("--dump", help="directory to write one .txt per book (for a blind pack)")
    ap.add_argument("--min-words", type=int, default=20)
    ap.add_argument("--out", default=str(ROOT / "reports/mw-book-stats.json"))
    args = ap.parse_args()

    pages = load(Path(args.extract))
    titles = book_titles(pages)
    if not titles:
        print("mw-book-stats: no {{Game Book}} pages found — extract is not what this expects", file=sys.stderr)
        return 2

    books, missing_lore = [], []
    for name, games in sorted(titles.items()):
        lore = pages.get(f"Lore:{name}")
        if lore is None:
            missing_lore.append(name)
            continue
        body = strip_wiki(lore)
        w = len(body.split())
        if w < args.min_words:
            continue
        books.append({"title": name, "games": sorted(games), "words": w, "text": body})

    lens = sorted(b["words"] for b in books)
    n = len(lens)

    def pct_interp(p):
        k = (n - 1) * p / 100
        lo = int(k)
        hi = min(lo + 1, n - 1)
        return round(lens[lo] + (lens[hi] - lens[lo]) * (k - lo), 1)

    def pct_floor(p):
        return lens[min(n - 1, int(n * p / 100))]

    numerals = ["one", "two", "three", "four", "five", "six", "seven", "eight",
                "nine", "ten", "eleven", "twelve", "thirteen"]
    tic = {}
    for w in numerals:
        hits = sum(1 for b in books if re.search(rf"\b{w}\b", b["text"], re.I))
        tot = sum(len(re.findall(rf"\b{w}\b", b["text"], re.I)) for b in books)
        tic[w] = {"books": hits, "pct_of_books": round(100 * hits / n, 1), "occurrences": tot}

    result = {
        "schema": "elder-souls/mw-book-stats@1",
        "source": str(Path(args.extract).relative_to(ROOT)),
        "shipped_book_pages": len(titles),
        "with_lore_text": n,
        "lore_page_missing": len(missing_lore),
        "distribution_interpolated": {p: pct_interp(int(p[1:])) for p in ("p10", "p25", "p50", "p75", "p90")},
        "distribution_floor_index": {p: pct_floor(int(p[1:])) for p in ("p10", "p25", "p50", "p75", "p90")},
        "min": lens[0], "max": lens[-1],
        "mean": round(statistics.fmean(lens), 1),
        "total_words": sum(lens),
        "under_150_pct": round(100 * sum(1 for x in lens if x < 150) / n, 1),
        "numeral_tic": tic,
        "longest": [{"title": b["title"], "words": b["words"]} for b in sorted(books, key=lambda b: -b["words"])[:12]],
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")

    print(f"{n} Morrowind/Tribunal/Bloodmoon books with recoverable text "
          f"({len(titles)} shipped book pages, {len(missing_lore)} with no Lore: page)")
    print(f"  interpolated  p10 {result['distribution_interpolated']['p10']}  "
          f"p25 {result['distribution_interpolated']['p25']}  median {result['distribution_interpolated']['p50']}  "
          f"p75 {result['distribution_interpolated']['p75']}  p90 {result['distribution_interpolated']['p90']}  "
          f"max {result['max']}  mean {result['mean']}")
    print(f"  floor-index   p10 {result['distribution_floor_index']['p10']}  "
          f"p25 {result['distribution_floor_index']['p25']}  median {result['distribution_floor_index']['p50']}  "
          f"p75 {result['distribution_floor_index']['p75']}  p90 {result['distribution_floor_index']['p90']}")
    print(f"  under 150 words: {result['under_150_pct']}%")
    print("  numeral tic (share of books containing the word):")
    for w in numerals:
        print(f"    {w:<9} {tic[w]['pct_of_books']:>5}%   {tic[w]['occurrences']:>4} occurrences")

    if args.dump:
        d = Path(args.dump)
        d.mkdir(parents=True, exist_ok=True)
        for b in books:
            safe = re.sub(r"[^A-Za-z0-9]+", "-", b["title"]).strip("-")[:70]
            (d / f"{safe}.txt").write_text(b["text"] + "\n", encoding="utf8")
        print(f"  dumped {len(books)} texts to {d}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
