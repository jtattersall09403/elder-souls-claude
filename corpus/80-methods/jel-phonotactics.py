#!/usr/bin/env python3
"""
jel-phonotactics.py — proper-noun consistency validator for the Black Marsh corpus.

Judges: RI-LOR04 (naming and language). Referenced by RI-LOR01, RI-LOR07.

What it does
------------
Takes a list of proper nouns (one per line, or extracted from game JSON), classifies each
by culture, and validates it against the rules in corpus/60-lore/data/jel-lexicon.json.

Cultures and their tests:
  jel                  -> full phonotactic validation (units, clusters, codas, syllable count)
  argonian-tamrielic   -> hyphenated-name grammar + epic-register blocklist
  khajiit              -> apostrophe permitted; prefix/suffix shape
  imperial / dunmer    -> no apostrophes, no hyphens, Latinate/Dunmeri shape
  unknown              -> counted as a violation (an unclassifiable name is a random name)

Exit codes
----------
  0  violation rate <= threshold (default 5%)
  1  violation rate above threshold  -> the critic FAILS the piece
  2  bad invocation

Usage
-----
  python3 corpus/80-methods/jel-phonotactics.py --names names.txt
  python3 corpus/80-methods/jel-phonotactics.py --extract game/data/**/*.json
  cat names.txt | python3 corpus/80-methods/jel-phonotactics.py
  ... [--threshold 0.05] [--culture jel] [--verbose] [--json]
"""

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_LEXICON = os.path.normpath(
    os.path.join(HERE, "..", "60-lore", "data", "jel-lexicon.json")
)


# --------------------------------------------------------------------------- #
# loading
# --------------------------------------------------------------------------- #
def load_lexicon(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- #
# tokenisation
# --------------------------------------------------------------------------- #
def tokenize(word, cons_units, vowel_units):
    """Split a lowercase word into an ordered list of (kind, unit) tokens.
    Longest-match-first so digraphs (sh, th, kh, ts, tl, ch, ee, aa, oo, ai...) win."""
    units = sorted(set(cons_units) | set(vowel_units), key=len, reverse=True)
    out, i = [], 0
    while i < len(word):
        for u in units:
            if word.startswith(u, i):
                kind = "V" if u in vowel_units else "C"
                out.append((kind, u))
                i += len(u)
                break
        else:
            out.append(("?", word[i]))
            i += 1
    return out


def consonant_runs(tokens):
    """Yield (position, [units]) for each maximal run of consonant tokens.
    position is 'initial', 'medial' or 'final'."""
    runs, cur, start_idx = [], [], None
    for idx, (kind, unit) in enumerate(tokens):
        if kind == "C":
            if not cur:
                start_idx = idx
            cur.append(unit)
        else:
            if cur:
                runs.append((start_idx, cur))
                cur = []
    if cur:
        runs.append((start_idx, cur))

    labelled = []
    n = len(tokens)
    for start_idx, run in runs:
        end_idx = start_idx + len(run)
        if start_idx == 0 and end_idx < n:
            pos = "initial"
        elif end_idx == n and start_idx > 0:
            pos = "final"
        elif start_idx == 0 and end_idx == n:
            pos = "whole"
        else:
            pos = "medial"
        labelled.append((pos, run))
    return labelled


# --------------------------------------------------------------------------- #
# Jel validation
# --------------------------------------------------------------------------- #
def valid_onset(run, onsets):
    if len(run) == 0:
        return True
    if len(run) == 1:
        return True                      # any single consonant may onset
    return "".join(run) in onsets


def valid_coda(run, codas):
    if len(run) == 0:
        return True
    if len(run) == 1:
        return run[0] in codas
    return "".join(run) in codas


def split_medial(run, onsets, codas):
    """A medial consonant run must split into coda + onset.
    Maximal-onset preference: try the longest legal onset first."""
    for cut in range(0, len(run) + 1):
        coda, onset = run[:cut], run[cut:]
        if valid_coda(coda, codas) and valid_onset(onset, onsets):
            return True
    return False


def check_jel(word, lex):
    """Return list of violation strings ([] == valid). Validates one hyphen-element."""
    ph = lex["phonology"]
    if word.lower() in set(ph.get("attested_exceptions", [])):
        return []                                    # canon form, exempt by attestation
    cons = ph["consonant_units"]
    vows = ph["vowels_short"] + ph["vowels_long"] + ph["diphthongs"]
    onsets = set(ph["onset_clusters"])
    codas = set(ph["coda_single"]) | set(c for c in ph["coda_clusters"] if " " not in c)
    forb = ph["forbidden"]
    bad = []

    w = word.lower()

    for ch in forb["characters"]:
        if ch in w:
            bad.append(f"forbidden character {ch!r}")
    for cl in forb["clusters"]:
        if cl in w:
            bad.append(f"forbidden cluster {cl!r}")
    if forb.get("doubled_consonants"):
        for c in "bdgklmnprstvxzj":
            if c * 2 in w:
                bad.append(f"geminate {c*2!r}")

    toks = tokenize(w, cons, vows)
    unknown = [u for k, u in toks if k == "?"]
    if unknown:
        bad.append(f"unknown units {unknown}")

    nuclei = sum(1 for k, _ in toks if k == "V")
    if nuclei == 0:
        bad.append("no vowel nucleus")
    if nuclei > ph["max_syllables_per_element"]:
        bad.append(f"{nuclei} syllables > max {ph['max_syllables_per_element']}")

    for pos, run in consonant_runs(toks):
        s = "".join(run)
        if pos in ("initial", "whole"):
            if not valid_onset(run, onsets):
                bad.append(f"illegal initial cluster {s!r}")
        elif pos == "final":
            if not valid_coda(run, codas):
                bad.append(f"illegal final cluster {s!r}")
        else:
            if not split_medial(run, onsets, codas):
                bad.append(f"unsplittable medial cluster {s!r}")

    # dedupe, preserve order
    seen, out = set(), []
    for b in bad:
        if b not in seen:
            seen.add(b)
            out.append(b)
    return out


def check_jel_name(name, lex):
    """A Jel proper noun may be a hyphenated compound of <= max_elements."""
    maxel = lex["morphology"]["compounding"]["max_elements"]
    parts = [p for p in re.split(r"[-\s]+", name) if p]
    bad = []
    if len(parts) > maxel:
        bad.append(f"{len(parts)} compound elements > max {maxel}")
    for p in parts:
        bad += [f"[{p}] {v}" for v in check_jel(p, lex)]
    return bad


# --------------------------------------------------------------------------- #
# Argonian Tamrielic (hyphenated English) validation
# --------------------------------------------------------------------------- #
def check_tamrielic_argonian(name, lex):
    g = lex["tamrielic_name_grammar"]
    bad = []
    parts = name.split("-")
    n = len(parts)
    if n < g["word_count"]["min"] or n > g["word_count"]["max"]:
        bad.append(f"{n} words, allowed {g['word_count']['min']}-{g['word_count']['max']}")
    if parts and parts[0] not in g["verbs"]:
        bad.append(f"first element {parts[0]!r} is not an attested 3sg verb")
    for p in parts:
        if p in g["blocklist_nouns"]:
            bad.append(f"epic-register noun {p!r} (blocklist)")
    for form in g["blocklist_forms"]:
        f = form.strip("-")
        if f and f in parts:
            bad.append(f"blocklisted form {f!r}")
    if "'" in name:
        bad.append("apostrophe in an Argonian name")
    if not all(p[:1].isupper() for p in parts if p):
        bad.append("elements must be Capitalised")
    return bad


# --------------------------------------------------------------------------- #
# other cultures
# --------------------------------------------------------------------------- #
def check_khajiit(name, lex):
    k = lex["other_cultures"]["khajiit"]
    bad = []
    if "'" not in name and not any(name.startswith(p.rstrip("'")) for p in k["prefixes"]):
        bad.append("classified Khajiit but has neither apostrophe-prefix nor attested prefix")
    if "-" in name:
        bad.append("hyphen in a Khajiit name")
    return bad


def check_latinate_or_dunmer(name, culture, lex):
    bad = []
    if "'" in name:
        bad.append(f"apostrophe in a {culture} name (apostrophes are Khajiit-only)")
    if "-" in name:
        bad.append(f"hyphen in a {culture} name")
    return bad


# --------------------------------------------------------------------------- #
# classification
# --------------------------------------------------------------------------- #
ENGLISH_HYPHEN = re.compile(r"^[A-Z][a-z]+(-[A-Z][a-z]+)+$")
JEL_ISH = re.compile(r"^[A-Za-z][A-Za-z-]*$")

IMPERIAL_ENDINGS = ("us", "ius", "a", "ia", "o", "anus", "inus", "illa", "ina",
                    "ent", "entus", "ellus", "andus", "orus", "atus")
DUNMER_ENDINGS = ("as", "is", "en", "yn", "el", "ur", "oth", "am", "yr", "ys",
                  "an", "ar", "il", "or", "yl", "ir")


def elements_of(name):
    return [e for e in re.split(r"[-\s]+", name.lower()) if e]


def jel_lexical(name, lex):
    """The name is built from material actually in the lexicon."""
    low = name.lower()
    roots = {r["root"] for r in lex["roots"]}
    coined = {c["jel"] for c in lex["coined_terms"]}
    exceptions = set(lex["phonology"].get("attested_exceptions", []))
    els = elements_of(low)
    if low in coined:
        return True
    if any(e in roots or e in exceptions for e in els):
        return True
    # Affix heuristic applies only to OVERT compounds (hyphenated). Applying it to
    # single words made 'Andrel' read as an- + drel, which is how a classifier
    # quietly annexes another culture's names.
    if "-" in name:
        prefixes = {p["form"].rstrip("-") for p in lex["morphology"]["prefixes"]}
        suffixes = {s["form"].lstrip("-") for s in lex["morphology"]["suffixes"]}
        for e in els:
            if e in prefixes or e in suffixes:            # affix standing as an element
                return True
            if any(p and e.startswith(p) and len(e) > len(p) + 1 for p in prefixes):
                return True
            if any(s and e.endswith(s) and len(e) > len(s) + 1 for s in suffixes):
                return True
    return False


def jel_sonic(name):
    """Carries Jel's sound signature and no Latinate/Dunmeri tail."""
    low = name.lower()
    if low.endswith(IMPERIAL_ENDINGS + DUNMER_ENDINGS):
        return False
    return bool(re.search(r"(x|kh|ts|tl|ee|aa|oo)", low))


def classify(name, lex):
    n = name.strip()
    if not n:
        return "empty"
    if "'" in n:
        return "khajiit"
    # A Tamrielic Argonian name is identified by its FIRST element being an attested
    # 3sg verb — that is the actual signal, and it must be tested before the Jel
    # affix heuristic, or 'Answers-Late' gets annexed as an- + swers.
    head = n.split("-")[0]
    if "-" in n and head in lex["tamrielic_name_grammar"]["verbs"]:
        return "argonian-tamrielic"
    # Lexicon material is then tested before the generic hyphenated-English shape,
    # because a Jel compound (Ixt-Shaneekh) also matches that pattern.
    if jel_lexical(n, lex):
        return "jel"
    if ENGLISH_HYPHEN.match(n):
        return "argonian-tamrielic"          # shape is Argonian even when contents are wrong
    if not re.match(r"^[A-Za-z][A-Za-z\-\s]*$", n):
        return "unknown"
    if jel_sonic(n):
        return "jel"
    toks = elements_of(n)                    # any token may carry the culture
    if any(t.endswith(IMPERIAL_ENDINGS) for t in toks):
        return "imperial"
    if any(t.endswith(DUNMER_ENDINGS) for t in toks):
        return "dunmer"
    return "unknown"


CHECKERS = {
    "jel": lambda n, l: check_jel_name(n, l),
    "argonian-tamrielic": check_tamrielic_argonian,
    "khajiit": check_khajiit,
    "imperial": lambda n, l: check_latinate_or_dunmer(n, "Imperial", l),
    "dunmer": lambda n, l: check_latinate_or_dunmer(n, "Dunmer", l),
    "unknown": lambda n, l: ["unclassifiable — belongs to no culture in the lexicon"],
    "empty": lambda n, l: ["empty name"],
}


# --------------------------------------------------------------------------- #
# extraction from game data
# --------------------------------------------------------------------------- #
NAME_KEYS = ("name", "displayName", "title", "npc", "speaker", "author", "place", "region")


def extract_names(paths):
    found = set()

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in NAME_KEYS and isinstance(v, str) and v.strip():
                    found.add(v.strip())
                else:
                    walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for p in paths:
        try:
            with open(p, "r", encoding="utf-8") as fh:
                walk(json.load(fh))
        except Exception as exc:                     # noqa: BLE001
            print(f"  ! skipped {p}: {exc}", file=sys.stderr)
    return sorted(found)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lexicon", default=DEFAULT_LEXICON)
    ap.add_argument("--names", help="file of proper nouns, one per line")
    ap.add_argument("--extract", nargs="*", help="game JSON files to harvest names from")
    ap.add_argument("--culture", help="force a culture instead of classifying")
    ap.add_argument("--threshold", type=float, default=0.05)
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--json", dest="as_json", action="store_true")
    args = ap.parse_args()

    lex = load_lexicon(args.lexicon)

    if args.names:
        with open(args.names, "r", encoding="utf-8") as fh:
            names = [l.strip() for l in fh if l.strip() and not l.startswith("#")]
    elif args.extract:
        names = extract_names(args.extract)
    elif not sys.stdin.isatty():
        names = [l.strip() for l in sys.stdin if l.strip() and not l.startswith("#")]
    else:
        ap.print_help()
        return 2

    if not names:
        print("no names supplied", file=sys.stderr)
        return 2

    results, by_culture = [], {}
    for name in names:
        culture = args.culture or classify(name, lex)
        problems = CHECKERS.get(culture, CHECKERS["unknown"])(name, lex)
        results.append({"name": name, "culture": culture, "violations": problems})
        b = by_culture.setdefault(culture, {"n": 0, "bad": 0})
        b["n"] += 1
        if problems:
            b["bad"] += 1

    bad = [r for r in results if r["violations"]]
    rate = len(bad) / len(results)

    if args.as_json:
        print(json.dumps({"total": len(results), "violations": len(bad),
                          "rate": round(rate, 4), "threshold": args.threshold,
                          "by_culture": by_culture, "results": results}, indent=2))
    else:
        print(f"names checked : {len(results)}")
        for c, b in sorted(by_culture.items()):
            print(f"  {c:20s} {b['n']:4d} names, {b['bad']:3d} violations")
        print(f"violation rate: {rate:.1%}  (threshold {args.threshold:.0%})")
        show = bad if args.verbose else bad[:25]
        if show:
            print("\nviolations:")
            for r in show:
                print(f"  {r['name']:34s} [{r['culture']}] {'; '.join(r['violations'])}")
            if len(bad) > len(show):
                print(f"  ... and {len(bad) - len(show)} more (use --verbose)")
        print("\nRESULT:", "PASS" if rate <= args.threshold else "FAIL")

    return 0 if rate <= args.threshold else 1


if __name__ == "__main__":
    sys.exit(main())
