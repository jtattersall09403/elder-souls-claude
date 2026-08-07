#!/usr/bin/env python3
"""book-stats.py — RI-LOR03's Comparison method, steps 1, 4, 5, 6 and 7.

WHY THIS FILE EXISTS (orchestration/TOOL-LOOP.md rule 1)
-------------------------------------------------------
RI-LOR03 §Comparison method step 1 names, by path:

    python3 corpus/80-methods/book-stats.py game/data/books/ \\
        --compare corpus/60-lore/RI-LOR03-in-world-book-structure.md

That file did not exist. RI-LOR03 has been scoreable-looking and unmeasured since it was
written: its length distribution, its contradiction census, its quest-hint ratio, its register
variance and its Argonian-authorship count all name mechanical checks and none of them had an
instrument. This is that instrument, built to the item's own wording.

WHICH STEPS ARE HERE AND WHICH ARE NOT
--------------------------------------
  step 1  length distribution vs §1              IMPLEMENTED
  step 2  blind pair against real Morrowind books NOT HERE — needs a critic and eight unlabelled
                                                  texts; see corpus/80-methods/RI-MTH03.
  step 3  author-voice test ("what is it wrong    NOT HERE — a judgement, not a count. What CAN be
          about")                                 counted is whether each book DECLARES an
                                                  unreliability, and that is reported as a
                                                  precondition, not as a pass.
  step 4  contradiction census vs canon-facts     IMPLEMENTED
  step 5  quest-hint ratio (AR-2)                 IMPLEMENTED
  step 6  register variance (stylometry)          IMPLEMENTED
  step 7  Argonian authorship count               IMPLEMENTED

IT CAN FAIL. Every threshold below is RI-LOR03's own, the exit code is non-zero when any is
missed, and `--self-test` mutates the corpus on purpose and asserts each mutation turns a check
red. A checker that cannot go red buys a false pass, which is the whole reason TOOL-LOOP rule 3
exists.

The `--compare` argument is READ, not decorative: the p10/p25/median/p75/p90 reference figures
and the taxonomy targets are parsed out of the reference item's own §1 and §2 tables, so that
editing the item moves the bar and editing this file does not.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def relpath(p) -> str:
    """Path relative to the repo root when it is under it, else as given. Callers pass both
    absolute defaults and relative command-line arguments and neither may crash the tool."""
    try:
        return str(Path(p).resolve().relative_to(ROOT))
    except ValueError:
        return str(p)


# ------------------------------------------------------------------ loading
def load_books(books_dir: Path):
    """Every book record, from either shipping schema: book@1 (one doc) or book@2 (doc.books[])."""
    books, errors = [], []
    for path in sorted(books_dir.rglob("*.json")):
        rel = relpath(path)
        try:
            doc = json.loads(path.read_text(encoding="utf8"))
        except Exception as exc:  # noqa: BLE001 - we want the filename with the message
            errors.append((rel, str(exc)))
            continue
        if isinstance(doc.get("books"), list):
            for b in doc["books"]:
                b = dict(b)
                b["_file"] = rel
                books.append(b)
        elif doc.get("id"):
            doc = dict(doc)
            doc["_file"] = rel
            books.append(doc)
    return books, errors


def words(text: str):
    return [w for w in re.split(r"\s+", (text or "").strip()) if w]


def pct(sorted_vals, p):
    """Linear interpolation between order statistics — numpy's default and
    `statistics.quantiles(method='inclusive')`.

    W1-LIBRARY ROUND 2, and this is a number that moved because the estimator was wrong rather
    than because the corpus changed. This function used to be `sorted_vals[int(p * n)]`, a
    floor-index estimator, and the round-1 critic caught it deciding a check: the p90 of our book
    lengths read **1,316 words against a 1,200 bar on the floor index and 1,167 under linear
    interpolation**, so `S1b` passed by choice of convention and not by margin. The corpus had a
    hole between 944 and 1,316 words and the floor index stepped straight over it.

    Two estimators disagreeing by 150 words on 65 samples is what a small n does; the fix is to
    pick the one everyone else's tooling uses so the number can be checked by anybody with numpy,
    not to pick the flattering one. `S6`'s IQR is computed through here too and also moved.
    """
    if not sorted_vals:
        return 0
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    k = (n - 1) * p
    lo = int(k)
    hi = min(lo + 1, n - 1)
    frac = k - lo
    v = sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * frac
    return round(v, 1) if isinstance(v, float) and v != int(v) else int(v)


# ------------------------------------------------------------------ the reference item
REF_ROWS = {
    "p10": r"\|\s*p10\s*\|\s*~?([\d,]+)",
    "p25": r"\|\s*p25\s*\|\s*~?([\d,]+)",
    "median": r"\|\s*\*\*Median\*\*\s*\|\s*\*\*~?([\d,]+)",
    "p75": r"\|\s*p75\s*\|\s*~?([\d,]+)",
    "p90": r"\|\s*p90\s*\|\s*~?([\d,]+)",
}


def parse_reference(md_path: Path):
    """Pull §1's reference distribution and §Comparison-method's fail bands out of the item."""
    if not md_path.exists():
        return None
    text = md_path.read_text(encoding="utf8")
    ref = {}
    for key, pattern in REF_ROWS.items():
        m = re.search(pattern, text)
        if m:
            ref[key] = int(m.group(1).replace(",", ""))
    bands = {}
    m = re.search(r"median\s*<\s*([\d,]+)\s*words", text)
    if m:
        bands["median_min"] = int(m.group(1).replace(",", ""))
    m = re.search(r"p90\s*<\s*([\d,]+)", text)
    if m:
        bands["p90_min"] = int(m.group(1).replace(",", ""))
    m = re.search(r"fewer than\s*(\d+)\s*multi-volume series", text)
    if m:
        bands["series_min"] = int(m.group(1))
    m = re.search(r">\s*(\d+)%\s*of books are under\s*([\d,]+)\s*words", text)
    if m:
        bands["short_pct_max"] = int(m.group(1))
        bands["short_words"] = int(m.group(2).replace(",", ""))
    m = re.search(r"hint_books\s*/\s*total\s*>\s*([\d.]+)", text)
    if m:
        bands["hint_ratio_max"] = float(m.group(1))
    m = re.search(r"(?:≥|>=)\s*(\d+)\s*books\s*(?:must be\s*)?authored by Argonians", text)
    if m:
        bands["argonian_min"] = int(m.group(1))
    m = re.search(r"interquartile range of mean sentence length is under\s*(\d+)", text)
    if m:
        bands["sentence_iqr_min"] = int(m.group(1))
    return {"distribution": ref, "bands": bands, "path": relpath(md_path)}


DEFAULT_BANDS = {
    "median_min": 350,
    "p90_min": 1200,
    "series_min": 3,
    "short_pct_max": 20,
    "short_words": 150,
    "hint_ratio_max": 0.10,
    "argonian_min": 14,
    "sentence_iqr_min": 6,
    "contradiction_pairs_min": 8,
    "wrong_books_min": 6,
}


# ------------------------------------------------------------------ steps
def step1_distribution(books, bands):
    lens = sorted(len(words(b.get("text", ""))) for b in books)
    series = {}
    for b in books:
        s = b.get("series") or {}
        if s.get("id"):
            series.setdefault(s["id"], []).append(b["id"])
    multi = {k: v for k, v in series.items() if len(v) >= 3}
    short = [n for n in lens if n < bands["short_words"]]
    return {
        "n": len(lens),
        "total_words": sum(lens),
        "p10": pct(lens, 0.10),
        "p25": pct(lens, 0.25),
        "median": pct(lens, 0.50),
        "p75": pct(lens, 0.75),
        "p90": pct(lens, 0.90),
        "max": lens[-1] if lens else 0,
        "min": lens[0] if lens else 0,
        "mean": round(statistics.fmean(lens), 1) if lens else 0,
        "multi_volume_series": multi,
        "short_count": len(short),
        "short_pct": round(100 * len(short) / len(lens), 1) if lens else 0,
    }


def norm_title(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def step4_contradictions(books, registry_path: Path):
    """RI-LOR03 step 4: every `disputed` registry fact must name >=2 books that EXIST."""
    out = {"registry": relpath(registry_path), "disputed": [], "pairs_in_books": 0}
    ids = {b["id"] for b in books}
    # Index each book under its full title AND under the part before a colon, because the
    # registry cites works by short title and often with a locator: "The Egg Speaks Twice
    # (Third Song)" must resolve to "The Egg Speaks Twice: Nine Root-Songs of the Deep
    # Marshes". Matching only the full string reported that book as never written, twice,
    # which is the precise false alarm this check exists to avoid raising.
    titles = {}
    for b in books:
        full = norm_title(b.get("title", ""))
        short = norm_title((b.get("title", "") or "").split(":")[0])
        for key in (full, short):
            if key:
                titles.setdefault(key, b["id"])

    def find(source: str):
        raw = re.sub(r"\([^)]*\)", " ", source or "")     # drop the locator
        n = norm_title(raw)
        if not n:
            return None
        if n in titles:
            return titles[n]
        for t, bid in titles.items():
            if not t or len(t) < 8:
                continue
            if t in n or n in t or n.startswith(t) or t.startswith(n):
                return bid
        return None

    # A book declares which registry fact it holds a position on, via `registry.cf` or
    # `registry_facts[]`. This is the reliable direction: the registry's own
    # `positions[].in_world_source` strings are a mixture of book titles ("The Sap and the
    # Ledger"), oral sources ("oral tradition, Helstrom") and whole institutions ("Imperial
    # usage"), and only some of them are books at all. Matching titles is still done, because
    # RI-LOR03 step 4's FAIL CLAUSE is "any disputed fact names a book that was never written" —
    # so a source that LOOKS like a titled book and resolves to nothing is the thing to catch.
    declared = {}
    for b in books:
        cfs = list(b.get("registry_facts") or [])
        if isinstance(b.get("registry"), dict) and b["registry"].get("cf"):
            cfs.append(b["registry"]["cf"])
        for cf in set(cfs):
            declared.setdefault(cf, []).append(b["id"])

    if registry_path.exists():
        reg = json.loads(registry_path.read_text(encoding="utf8"))
        facts = reg if isinstance(reg, list) else reg.get("facts", [])
        for f in facts:
            if not f.get("disputed"):
                continue
            matched, unmatched = [], []
            for p in f.get("positions", []):
                src = p.get("in_world_source", "")
                bid = find(src)
                if bid:
                    matched.append(bid)
                elif re.match(r"^The [A-Z]", src or ""):
                    # Title Case with a leading article: this is a named book and it is missing.
                    unmatched.append(src)
            in_library = sorted(set(matched) | set(declared.get(f.get("id"), [])))
            out["disputed"].append(
                {"id": f.get("id"),
                 "positions": len(f.get("positions", [])),
                 "titles_matched": matched,
                 "named_books_missing": unmatched,
                 "books_holding_a_position": in_library,
                 "represented": len(in_library) >= 1,
                 "both_sides_in_the_library": len(in_library) >= 2}
            )

    # Book-declared contradictions, and the partner must exist.
    pairs, dangling = set(), []
    for b in books:
        for c in b.get("contradicts") or []:
            other = (c or {}).get("book")
            if not other:
                continue
            if other in ids:
                pairs.add(tuple(sorted((b["id"], other))))
            else:
                dangling.append({"from": b["id"], "to": other})
    out["pairs_in_books"] = len(pairs)
    out["pairs"] = sorted("|".join(p) for p in pairs)
    out["dangling"] = dangling
    out["books_that_contradict"] = len({x for p in pairs for x in p})
    out["wrong_on_purpose"] = [b["id"] for b in books if b.get("wrong_on_purpose")]
    return out


HINT_PATTERNS = [
    r"\bgo (?:to|and) (?:the|a)\b.*\band (?:kill|take|steal|bring|fetch)\b",
    r"\byou (?:must|should|need to) (?:go|travel|report|return) to\b",
    r"\bthe quest\b",
    r"\byour task\b",
    r"\bobjective\b",
    r"\bmarker\b(?!\s*(?:stone|post))",
    r"\bwaypoint\b",
]


def step5_quest_hints(books, quests_dir: Path, bands):
    """RI-LOR03 step 5: books whose text names a currently-active quest OBJECTIVE.

    Two tests, both reported. The first is the item's literal wording — does the book text name a
    quest's stated objective string. The second is the softer imperative-hint pattern, which is
    what a book that had drifted into being a quest log would trip even without quoting one.
    """
    objectives = []
    for path in sorted(quests_dir.rglob("*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf8"))
        except Exception:  # noqa: BLE001
            continue

        def walk(v):
            if isinstance(v, list):
                for x in v:
                    walk(x)
            elif isinstance(v, dict):
                for key in ("stated_objective", "actual_objective"):
                    if isinstance(v.get(key), str) and len(v[key]) > 24:
                        objectives.append(v[key])
                for x in v.values():
                    walk(x)

        walk(doc)

    hint_books, pattern_books = [], []
    for b in books:
        text = (b.get("text") or "")
        low = text.lower()
        for obj in objectives:
            frag = norm_title(obj)
            if len(frag) > 30 and frag in norm_title(text):
                hint_books.append({"book": b["id"], "objective": obj[:90]})
                break
        for pat in HINT_PATTERNS:
            if re.search(pat, low):
                pattern_books.append({"book": b["id"], "pattern": pat})
                break

    n = len(books) or 1
    return {
        "objectives_scanned": len(objectives),
        "books_quoting_an_objective": hint_books,
        "ratio": round(len(hint_books) / n, 4),
        "books_matching_a_hint_pattern": pattern_books,
        "pattern_ratio": round(len(pattern_books) / n, 4),
        "bar": bands["hint_ratio_max"],
    }


def step6_register(books):
    """RI-LOR03 step 6: stylometric spread. Fail if mean-sentence-length IQR < 6 words."""
    rows = []
    for b in books:
        text = b.get("text") or ""
        sents = [s for s in re.split(r"(?<=[.!?])\s+|\n\n", text) if s.strip()]
        wl = [len(words(s)) for s in sents if words(s)]
        toks = [w.lower().strip(".,;:!?—\"'()") for w in words(text)]
        toks = [t for t in toks if t]
        if not wl or not toks:
            continue
        rows.append({
            "id": b["id"],
            "mean_sentence_words": round(statistics.fmean(wl), 2),
            "type_token_ratio": round(len(set(toks)) / len(toks), 4),
            "first_person_rate": round(sum(1 for t in toks if t in ("i", "me", "my", "we", "our", "us")) / len(toks), 4),
            "imperative_rate": round(sum(1 for s in sents if re.match(r"^\s*(Do|Keep|Take|Go|Put|Burn|Ask|Write|Enter|Leave|Trim|Stop|Consider|Come|Sing|Remember|Open|Shut|Count|Send|Return)\b", s)) / max(1, len(sents)), 4),
        })
    msl = sorted(r["mean_sentence_words"] for r in rows)
    if len(msl) >= 4:
        q1, q3 = pct(msl, 0.25), pct(msl, 0.75)
    else:
        q1 = q3 = msl[0] if msl else 0
    return {
        "n": len(rows),
        "mean_sentence_words": {"q1": q1, "q3": q3, "iqr": round(q3 - q1, 2),
                                "min": msl[0] if msl else 0, "max": msl[-1] if msl else 0},
        "type_token_ratio_spread": round(
            (max(r["type_token_ratio"] for r in rows) - min(r["type_token_ratio"] for r in rows)), 4) if rows else 0,
        "first_person_rate_spread": round(
            (max(r["first_person_rate"] for r in rows) - min(r["first_person_rate"] for r in rows)), 4) if rows else 0,
        "per_book": rows,
    }


def step7_authorship(books):
    declared = [b["id"] for b in books if b.get("argonian_authored")]
    undeclared = [b["id"] for b in books if "argonian_authored" not in b]
    return {"argonian_authored": len(declared), "books": declared, "undeclared_field": undeclared}


# ------------------------------------------------------------------ step 8: does the metadata
# ------------------------------------------------------------------ describe THIS book's prose?
#
# W1-LIBRARY ROUND 2, and the whole of this section exists because of one mutation the round-1
# critic ran and neither tool imagined:
#
#   > "My mutation, which neither imagined: derange the text. Every book's `text` is swapped with
#   >  another book's (seed 4242, no fixed points). Every other field stays exactly where it is.
#   >  28 of 28 checks green on a corpus where the prose has been shuffled."
#
# Every check above steps 1-7 aggregates over the corpus — total words, the length distribution,
# the count of `contradicts[]` edges, the sentence-length IQR — and every one of those aggregates
# is INVARIANT under a permutation of the texts. The tools could measure the register and could
# not measure the writing, which is what RI-LOR03 is for. A second mutation made the point from
# the other side: `argonian_authored: true` on all 65 books, no byline touched, and S7 went from
# 19 to 65 and PASSED HARDER, because it counts a self-declared boolean and nothing looks at the
# name on the book.
#
# The three checks below are the ones that bind a field to the prose beside it, so they are the
# three that a deranged corpus turns red. Measured on the shipped corpus and on the derangement:
#
#   S8  book anchors >=1 declared topic in its own prose      75.0%  ->  10.0%
#   S9  contradiction pair where both texts engage the subject 88.2% ->  29.4%
#   S10 books flagged Argonian whose byline is Tamrielic          0  ->     30
#
# S8 is not decoration: `topics_taught` is read by the engine now (`Engine._readBook`), so a book
# that declares a topic its prose never names teaches the player a word that is not in the book.

_STOP = {"the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "by",
         "is", "are", "was", "were", "it", "its", "this", "that", "with", "from", "as", "not", "no"}
_TITLES = (r"(?:Serjo|Sexton|Undersexton|Magistra|Tribune|Prefect|Serjeant|Sister|Brother|"
           r"Captain|Legate|Master|Mistress|Lady|Lord)")


def _norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower())


def _stem(w):
    """Crude singular/plural fold. `the-xanmeers` should match prose that says "xanmeer"."""
    return w[:-1] if len(w) > 4 and w.endswith("s") else w


def _slug_terms(slug):
    return [_stem(w) for w in _norm(str(slug).replace("-", " ")).split() if w not in _STOP]


def step8_metadata_vs_prose(books):
    """Bind `topics_taught`, `contradicts[].on` and `argonian_authored` to the text beside them."""
    # --- S8: a declared topic anchored in the book's OWN prose --------------------------------
    topic_rows, anchored_books, topic_books = [], 0, 0
    for b in books:
        topics = b.get("topics_taught") or []
        if not topics:
            continue
        topic_books += 1
        bag = {_stem(w) for w in _norm(b.get("text", "")).split()}
        hits = [t for t in topics if _slug_terms(t) and all(w in bag for w in _slug_terms(t))]
        if hits:
            anchored_books += 1
        else:
            topic_rows.append({"book": b["id"], "topics": topics})
    topic_pct = round(100.0 * anchored_books / topic_books, 1) if topic_books else 0.0

    # --- S9: both sides of a declared pair engage the subject the pair is declared ON ----------
    by_id = {b["id"]: b for b in books}
    pair_rows, engaged, edges = [], 0, 0
    for b in books:
        for c in b.get("contradicts") or []:
            other = by_id.get((c or {}).get("book"))
            subject = (c or {}).get("on")
            if not other or not subject:
                continue
            terms = [w for w in _norm(subject).split() if w not in _STOP and len(w) > 3]
            if not terms:
                continue
            edges += 1
            mine, theirs = _norm(b.get("text", "")), _norm(other.get("text", ""))
            shared = [t for t in terms if t in mine and t in theirs]
            if shared:
                engaged += 1
            else:
                pair_rows.append({"from": b["id"], "to": other["id"], "on": subject, "terms": terms})
    pair_pct = round(100.0 * engaged / edges, 1) if edges else 0.0

    # --- S10: the flag against the name on the book -------------------------------------------
    def names(author):
        s = author or ""
        argonian = re.findall(r"\b[A-Z][a-z]+(?:-(?:[A-Za-z][a-z]*))+\b", s)
        # "of Cheydinhal" / "of Mournhold" is a PLACE, and reading it as a surname would make
        # every Imperial byline look like two names. Strip it, and strip the honorifics, before
        # looking for a Tamrielic given-name/family-name pair.
        t = re.sub(r"\bof\s+(?:the\s+)?(?:[A-Z][a-z]+(?:[- ][A-Z][a-z]+)*)", " ", s)
        t = re.sub(r"\b" + _TITLES + r"\b", " ", t)
        tamrielic = [x for x in re.findall(r"\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b", t)
                     if "-" not in x]
        return argonian, tamrielic

    contradicted, corroborated, unflagged = [], 0, []
    for b in books:
        argonian, tamrielic = names(b.get("author"))
        flagged = bool(b.get("argonian_authored"))
        if flagged and argonian:
            corroborated += 1
        elif flagged and tamrielic:
            contradicted.append({"book": b["id"], "author": b.get("author"), "reads_as": tamrielic})
        elif not flagged and argonian:
            unflagged.append({"book": b["id"], "author": b.get("author"), "reads_as": argonian})

    return {
        "topic_anchor": {"books_declaring_topics": topic_books, "books_anchoring_one": anchored_books,
                         "pct": topic_pct, "unanchored": topic_rows},
        "pair_subject": {"edges": edges, "both_engage": engaged, "pct": pair_pct, "misses": pair_rows},
        "byline": {"flagged_and_named_argonian": corroborated,
                   "flagged_but_byline_is_tamrielic": contradicted,
                   "argonian_byline_not_flagged": unflagged},
    }


# ------------------------------------------------------------------ checks
def run_checks(result, bands):
    d = result["distribution"]
    c = result["contradictions"]
    checks = []

    def add(cid, name, value, bar, ok):
        checks.append({"id": cid, "name": name, "value": value, "bar": bar, "pass": bool(ok)})

    add("S1a", "median book words", d["median"], f">= {bands['median_min']}", d["median"] >= bands["median_min"])
    add("S1b", "p90 book words", d["p90"], f">= {bands['p90_min']}", d["p90"] >= bands["p90_min"])
    add("S1c", "multi-volume series (>=3 volumes)", len(d["multi_volume_series"]), f">= {bands['series_min']}",
        len(d["multi_volume_series"]) >= bands["series_min"])
    add("S1d", f"books under {bands['short_words']} words (%)", d["short_pct"], f"<= {bands['short_pct_max']}",
        d["short_pct"] <= bands["short_pct_max"])
    add("S4a", "books that contradict another book", c["books_that_contradict"],
        f">= {bands['contradiction_pairs_min']}", c["books_that_contradict"] >= bands["contradiction_pairs_min"])
    add("S4b", "contradicts[] naming a book that does not exist", len(c["dangling"]), "== 0", not c["dangling"])
    add("S4c", "disputed registry facts represented by a real book",
        sum(1 for x in c["disputed"] if x["represented"]), f"== {len(c['disputed'])} of {len(c['disputed'])}",
        all(x["represented"] for x in c["disputed"]) if c["disputed"] else False)
    add("S4e", "disputed facts naming a titled book that was never written",
        sum(len(x["named_books_missing"]) for x in c["disputed"]), "== 0",
        not any(x["named_books_missing"] for x in c["disputed"]))
    add("S4f", "disputed facts with BOTH sides in the library",
        sum(1 for x in c["disputed"] if x["both_sides_in_the_library"]), ">= 4",
        sum(1 for x in c["disputed"] if x["both_sides_in_the_library"]) >= 4)
    add("S4d", "books that are wrong on purpose", len(c["wrong_on_purpose"]), f">= {bands['wrong_books_min']}",
        len(c["wrong_on_purpose"]) >= bands["wrong_books_min"])
    add("S5", "quest-hint ratio (books quoting a quest objective)", result["quest_hints"]["ratio"],
        f"<= {bands['hint_ratio_max']}", result["quest_hints"]["ratio"] <= bands["hint_ratio_max"])
    add("S6", "mean-sentence-length IQR across the corpus", result["register"]["mean_sentence_words"]["iqr"],
        f">= {bands['sentence_iqr_min']}",
        result["register"]["mean_sentence_words"]["iqr"] >= bands["sentence_iqr_min"])
    add("S7", "books authored by Argonians", result["authorship"]["argonian_authored"],
        f">= {bands['argonian_min']}", result["authorship"]["argonian_authored"] >= bands["argonian_min"])

    # W1-LIBRARY round 2 — the three checks that read the PROSE and not the register. See
    # `step8_metadata_vs_prose` for why they exist and what a deranged corpus does to them.
    p = result["prose_vs_metadata"]
    add("S8", "books anchoring >=1 declared topic in their own prose (%)",
        p["topic_anchor"]["pct"], ">= 60", p["topic_anchor"]["pct"] >= 60)
    add("S9", "declared contradiction edges whose subject BOTH texts engage (%)",
        p["pair_subject"]["pct"], ">= 75", p["pair_subject"]["pct"] >= 75)
    add("S10", "books flagged Argonian whose byline names a Tamrielic author",
        len(p["byline"]["flagged_but_byline_is_tamrielic"]), "== 0",
        not p["byline"]["flagged_but_byline_is_tamrielic"])
    return checks


def measure(books, args, bands):
    result = {
        "schema": "elder-souls/book-stats@1",
        "item": "RI-LOR03 — Comparison method steps 1, 4, 5, 6, 7",
        "books_dir": relpath(args.books_dir),
        "distribution": step1_distribution(books, bands),
        "contradictions": step4_contradictions(books, Path(args.registry)),
        "quest_hints": step5_quest_hints(books, Path(args.quests), bands),
        "register": step6_register(books),
        "authorship": step7_authorship(books),
        "prose_vs_metadata": step8_metadata_vs_prose(books),
    }
    result["checks"] = run_checks(result, bands)
    return result


# ------------------------------------------------------------------ self-test
def self_test(books, args, bands):
    control = measure(books, args, bands)
    failing = [c for c in control["checks"] if not c["pass"]]
    if failing:
        print("self-test: the CONTROL corpus is already failing, so a mutation proves nothing:")
        for c in failing:
            print(f"  {c['id']} {c['name']}: {c['value']} (bar {c['bar']})")
        return 1

    def flatten(bs):
        out = []
        for b in bs:
            b = dict(b)
            b["text"] = " ".join(words(b.get("text", ""))[:120])
            out.append(b)
        return out

    def one_voice(bs):
        out = []
        for b in bs:
            b = dict(b)
            b["text"] = "The thing is so. The thing is so. The thing is so. The thing is so."
            out.append(b)
        return out

    def derange(bs, seed=4242):
        """The round-1 critic's mutation, adopted verbatim as a permanent self-test.

        Swap every book's `text` with another book's — a derangement, so no book keeps its own
        prose — and change NOTHING else. Author, taxon, `argonian_authored`, `contradicts[]`,
        `wrong_on_purpose`, `knowledge_key` and `topics_taught` all stay exactly where they are.
        Afterwards every declared contradiction points at prose that says something else, every
        book wrong-on-purpose is wrong about nothing, and an Argonian keeper's byline sits on an
        Imperial recruitment pamphlet. This corpus scored 28/28 across both tools.

        It is the one mutation that leaves every corpus-level aggregate untouched, which is why
        it is the one worth keeping: any check it cannot turn red is a check that is not reading
        the books.
        """
        rng = random.Random(seed)
        n = len(bs)
        if n < 2:
            return [dict(b) for b in bs]
        while True:
            order = list(range(n))
            rng.shuffle(order)
            if all(order[i] != i for i in range(n)):
                break
        return [{**bs[i], "text": bs[order[i]].get("text", "")} for i in range(n)]

    mutations = [
        ("swap every book's text with another book's (derangement, seed 4242)", derange, "S8"),
        ("swap every book's text with another book's (derangement, seed 4242)", derange, "S9"),
        ("flag all 65 books Argonian without touching one byline",
         lambda bs: [{**b, "argonian_authored": True} for b in bs], "S10"),
        ("flatten every book to 120 words", flatten, "S1b"),
        ("drop every contradicts[]", lambda bs: [{**b, "contradicts": []} for b in bs], "S4a"),
        ("point a contradiction at nothing",
         lambda bs: [{**b, "contradicts": [{"book": "no-such-book"}]} if i == 0 else b for i, b in enumerate(bs)], "S4b"),
        ("clear every wrong_on_purpose",
         lambda bs: [{k: v for k, v in b.items() if k != "wrong_on_purpose"} for b in bs], "S4d"),
        ("write every book in one voice", one_voice, "S6"),
        ("un-declare Argonian authorship",
         lambda bs: [{**b, "argonian_authored": False} for b in bs], "S7"),
        ("paste a quest objective into a book",
         lambda bs: [{**b, "text": b.get("text", "") + " Stand in the chapter room while the Ninth Recension is read"}
                     for b in bs], "S5"),
    ]

    bad = 0
    for name, mutate, expect in mutations:
        res = measure(mutate(books), args, bands)
        row = next((c for c in res["checks"] if c["id"] == expect), None)
        red = row is not None and not row["pass"]
        print(f"  {'RED  ' if red else 'GREEN'}  {expect}  after: {name}" + ("" if red else "   <-- MUTATION NOT DETECTED"))
        if not red:
            bad += 1
    print("self-test FAILED" if bad else "self-test PASSED: every mutation was caught.")
    return 1 if bad else 0


# ------------------------------------------------------------------ main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("books_dir", nargs="?", default=str(ROOT / "game/data/books"))
    ap.add_argument("--compare", default=str(ROOT / "corpus/60-lore/RI-LOR03-in-world-book-structure.md"),
                    help="the reference item; its §1 table and fail bands are PARSED, not assumed")
    ap.add_argument("--registry", default=str(ROOT / "corpus/60-lore/data/canon-facts.json"))
    ap.add_argument("--quests", default=str(ROOT / "game/data/quests"))
    ap.add_argument("--out", default=str(ROOT / "reports/book-stats.json"))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    books_dir = Path(args.books_dir)
    if not books_dir.exists():
        print(f"book-stats: no such directory: {books_dir}", file=sys.stderr)
        return 2

    books, errors = load_books(books_dir)
    if not books:
        print(f"book-stats: no book records under {books_dir}", file=sys.stderr)
        return 2
    if errors:
        for f, e in errors:
            print(f"book-stats: PARSE ERROR {f}: {e}", file=sys.stderr)
        return 2

    ref = parse_reference(Path(args.compare))
    bands = dict(DEFAULT_BANDS)
    if ref:
        bands.update({k: v for k, v in ref["bands"].items() if v is not None})

    if args.self_test:
        return self_test(books, args, bands)

    result = measure(books, args, bands)
    result["reference"] = ref

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")

    d = result["distribution"]
    print(f"{d['n']} texts, {d['total_words']} words   mean {d['mean']}")
    print(f"  ours       p10 {d['p10']}  p25 {d['p25']}  median {d['median']}  p75 {d['p75']}  p90 {d['p90']}  max {d['max']}")
    if ref and ref["distribution"]:
        r = ref["distribution"]
        print(f"  Morrowind  p10 {r.get('p10')}  p25 {r.get('p25')}  median {r.get('median')}  "
              f"p75 {r.get('p75')}  p90 {r.get('p90')}    (parsed from {ref['path']})")
    print()
    for c in result["checks"]:
        print(f"  {'PASS' if c['pass'] else 'FAIL'}  {c['id']:<4} {c['name']:<52} {c['value']}   (bar {c['bar']})")
    print()
    print(f"  multi-volume series: " + ", ".join(f"{k} ({len(v)})" for k, v in d["multi_volume_series"].items()))
    print(f"  {os.path.relpath(out, ROOT)}")

    if args.json:
        print(json.dumps(result, indent=2))

    failed = [c for c in result["checks"] if not c["pass"]]
    if failed:
        print(f"\nbook-stats: {len(failed)} check(s) failed: {', '.join(c['id'] for c in failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
