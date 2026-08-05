#!/usr/bin/env python3
"""
canon-check.py — canon-facts registry integrity checker and lore-claim triage.

Judges: RI-LOR06 (contradiction discipline). Referenced by RI-LOR01, RI-LOR02, RI-LOR05.

Two jobs, deliberately separated:

  --validate-registry   Fully automatable. Checks corpus/60-lore/data/canon-facts.json for
                        structural integrity: required fields, unique ids, disputed entries
                        carrying >=2 positions, authorially_true pointing at a real position,
                        deliberately_open entries not secretly carrying an answer, constructed
                        facts declared as such, and every in_world_source named by a disputed
                        fact actually existing in the book manifest. Exit 1 on any failure.

  --claims FILES...     Triage, NOT adjudication. Extracts player-visible text from game JSON,
                        keyword-matches it against registry claims, and reports which facts each
                        text touches. A HUMAN OR MODEL CRITIC then decides whether the text
                        contradicts the fact — that judgement is semantic and this script does
                        not pretend to make it. What the script guarantees is that no lore-bearing
                        text is reviewed without its relevant registry entries in front of the
                        reviewer.

Exit codes
----------
  0  clean (or triage-only run)
  1  registry integrity failure, or --strict triage found a text touching a
     deliberately_open or secret (player_discoverable: late/never) fact
  2  bad invocation
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REGISTRY = os.path.normpath(
    os.path.join(HERE, "..", "60-lore", "data", "canon-facts.json")
)

REQUIRED = ("id", "claim", "tier", "provenance", "confidence",
            "disputed", "contradicts_ok", "invention_space",
            "player_discoverable", "judges")
TIERS = {"hard-canon", "soft-canon", "apocryphal", "constructed", "open"}
PROVENANCES = {"community-data", "canonical-recall", "constructed"}
CONFIDENCES = {"high", "medium", "low"}
DISCOVERABLE = {"early", "mid", "late", "never", "n-a"}

STOPWORDS = set("""a an the and or of to in on at by for with from is are was were be been being
that this these those it its as not no any all some their there here which who whom whose what
when where how why into onto over under than then them they he she his her him our your you we
i me my mine one two three more most many much very can may might must shall should would could
if but so such only also just about above after again against because before below between both
during each few further having if into itself more no nor now off once other out own same than
too under until up very while""".split())

TEXT_KEYS = ("text", "body", "content", "line", "dialogue", "response", "topic",
             "description", "journal", "entry", "title", "name")


# --------------------------------------------------------------------------- #
# registry integrity
# --------------------------------------------------------------------------- #
def validate_registry(reg, book_titles=None):
    errs, warns = [], []
    facts = reg.get("facts")
    if not isinstance(facts, list) or not facts:
        return ["registry has no 'facts' list"], []

    seen = set()
    for f in facts:
        fid = f.get("id", "<no id>")

        for k in REQUIRED:
            if k not in f:
                errs.append(f"{fid}: missing required field {k!r}")

        if fid in seen:
            errs.append(f"{fid}: duplicate id")
        seen.add(fid)

        if f.get("tier") not in TIERS:
            errs.append(f"{fid}: tier {f.get('tier')!r} not in {sorted(TIERS)}")
        if f.get("provenance") not in PROVENANCES:
            errs.append(f"{fid}: provenance {f.get('provenance')!r} not in {sorted(PROVENANCES)}")
        if f.get("confidence") not in CONFIDENCES:
            errs.append(f"{fid}: confidence {f.get('confidence')!r} invalid")
        if f.get("player_discoverable") not in DISCOVERABLE:
            errs.append(f"{fid}: player_discoverable {f.get('player_discoverable')!r} invalid")

        # id-prefix conventions
        if fid.startswith("CF-C") and f.get("tier") != "constructed":
            errs.append(f"{fid}: CF-C id but tier is {f.get('tier')!r} — our inventions must "
                        f"declare tier 'constructed' or a builder will read them as canon")
        if fid.startswith("CF-D") and not f.get("disputed"):
            errs.append(f"{fid}: CF-D id but disputed is false")
        if f.get("disputed") and not fid.startswith("CF-D"):
            warns.append(f"{fid}: disputed but id is not CF-Dnnn (harder to find)")

        # disputed structure
        if f.get("disputed"):
            positions = f.get("positions") or []
            if len(positions) < 2:
                errs.append(f"{fid}: disputed but has {len(positions)} position(s); "
                            f"a contradiction needs at least two sides")
            pids = set()
            for p in positions:
                for k in ("id", "in_world_source", "stance", "held_by"):
                    if k not in p:
                        errs.append(f"{fid}: position missing {k!r}")
                if p.get("id") in pids:
                    errs.append(f"{fid}: duplicate position id {p.get('id')!r}")
                pids.add(p.get("id"))
                if not p.get("held_by"):
                    errs.append(f"{fid}/{p.get('id')}: no held_by — a position nobody holds "
                                f"is not a contradiction, it is a note")

            at = f.get("authorially_true", "__missing__")
            if at == "__missing__":
                errs.append(f"{fid}: disputed but no authorially_true "
                            f"(use null + deliberately_open if there is no answer)")
            elif at is None:
                if not f.get("deliberately_open"):
                    errs.append(f"{fid}: authorially_true is null but deliberately_open is not "
                                f"true — an unanswered fact must say it is unanswerable on purpose")
            elif isinstance(at, str) and at.startswith("partial:"):
                if len(at) < 30:
                    warns.append(f"{fid}: 'partial:' verdict is too terse to act on")
            elif at not in pids:
                errs.append(f"{fid}: authorially_true {at!r} is not a position id {sorted(pids)}")

            if f.get("deliberately_open") and f.get("authorially_true") is not None:
                errs.append(f"{fid}: deliberately_open but carries an answer — "
                            f"pick one; a secret answer to an open question always leaks")

            if book_titles is not None:
                for src in f.get("in_world_sources", []):
                    base = src.split("(")[0].strip()
                    if base and not any(base.lower() in t.lower() for t in book_titles):
                        warns.append(f"{fid}: in_world_source {base!r} not found in the book "
                                     f"manifest — a contradiction whose sources do not exist "
                                     f"is not tracked, it is claimed")
        else:
            if f.get("positions"):
                errs.append(f"{fid}: not disputed but carries positions")

        if f.get("tier") == "hard-canon" and f.get("contradicts_ok"):
            errs.append(f"{fid}: hard-canon with contradicts_ok true")
        if f.get("provenance") == "constructed" and f.get("tier") == "hard-canon":
            warns.append(f"{fid}: constructed provenance on a hard-canon tier — "
                         f"check this is a resolution OF canon, not an invention presented as canon")

    return errs, warns


# --------------------------------------------------------------------------- #
# claim triage
# --------------------------------------------------------------------------- #
def keywords(text, minlen=4):
    words = re.findall(r"[A-Za-z][A-Za-z\-']+", text.lower())
    return {w for w in words if len(w) >= minlen and w not in STOPWORDS}


def build_index(reg):
    idx = []
    for f in reg["facts"]:
        blob = f["claim"]
        for p in f.get("positions", []) or []:
            blob += " " + p.get("stance", "")
        idx.append((f, keywords(blob)))
    return idx


def harvest_texts(paths):
    out = []

    def walk(node, path, where):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in TEXT_KEYS and isinstance(v, str) and len(v.split()) >= 4:
                    out.append((where, k, v))
                else:
                    walk(v, path, where)
        elif isinstance(node, list):
            for v in node:
                walk(v, path, where)

    for p in paths:
        try:
            with open(p, "r", encoding="utf-8") as fh:
                walk(json.load(fh), p, os.path.basename(p))
        except Exception as exc:                          # noqa: BLE001
            print(f"  ! skipped {p}: {exc}", file=sys.stderr)
    return out


def triage(texts, idx, min_overlap=3):
    hits = []
    for where, key, text in texts:
        tk = keywords(text)
        for fact, fk in idx:
            shared = tk & fk
            if len(shared) >= min_overlap:
                hits.append({"where": where, "key": key,
                             "text": text[:160] + ("…" if len(text) > 160 else ""),
                             "fact": fact["id"], "tier": fact["tier"],
                             "disputed": fact.get("disputed", False),
                             "deliberately_open": fact.get("deliberately_open", False),
                             "player_discoverable": fact.get("player_discoverable"),
                             "shared": sorted(shared)})
    return hits


# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--registry", default=DEFAULT_REGISTRY)
    ap.add_argument("--validate-registry", action="store_true")
    ap.add_argument("--claims", nargs="*", help="game JSON files carrying player-visible text")
    ap.add_argument("--books-manifest", help="JSON array (or object with 'books') of book titles")
    ap.add_argument("--min-overlap", type=int, default=3)
    ap.add_argument("--strict", action="store_true",
                    help="fail when a text touches a deliberately_open or late/never-discoverable fact")
    ap.add_argument("--json", dest="as_json", action="store_true")
    args = ap.parse_args()

    if not args.validate_registry and not args.claims:
        ap.print_help()
        return 2

    with open(args.registry, "r", encoding="utf-8") as fh:
        reg = json.load(fh)

    rc = 0

    if args.validate_registry:
        titles = None
        if args.books_manifest:
            with open(args.books_manifest, "r", encoding="utf-8") as fh:
                man = json.load(fh)
            titles = man if isinstance(man, list) else man.get("books", [])
            titles = [t if isinstance(t, str) else t.get("title", "") for t in titles]
        errs, warns = validate_registry(reg, titles)
        print(f"registry      : {args.registry}")
        print(f"facts         : {len(reg['facts'])}")
        tiers = defaultdict(int)
        for f in reg["facts"]:
            tiers[f["tier"]] += 1
        for t, n in sorted(tiers.items()):
            print(f"  {t:14s} {n}")
        print(f"disputed      : {sum(1 for f in reg['facts'] if f.get('disputed'))}")
        print(f"deliberately open: "
              f"{sum(1 for f in reg['facts'] if f.get('deliberately_open'))}")
        for w in warns:
            print(f"  WARN  {w}")
        for e in errs:
            print(f"  ERROR {e}")
        print("REGISTRY:", "PASS" if not errs else "FAIL")
        if errs:
            rc = 1

    if args.claims:
        idx = build_index(reg)
        texts = harvest_texts(args.claims)
        hits = triage(texts, idx, args.min_overlap)
        secret = [h for h in hits
                  if h["deliberately_open"] or h["player_discoverable"] in ("late", "never")]
        if args.as_json:
            print(json.dumps({"texts": len(texts), "hits": hits, "secret": secret}, indent=2))
        else:
            print(f"\ntexts scanned : {len(texts)}")
            print(f"registry touches: {len(hits)}")
            for h in hits[:60]:
                flag = "!" if h in secret else " "
                print(f" {flag}[{h['fact']} {h['tier']}"
                      f"{' DISPUTED' if h['disputed'] else ''}] {h['where']}:{h['key']}"
                      f"  ~{','.join(h['shared'][:5])}")
            if len(hits) > 60:
                print(f"  ... and {len(hits)-60} more")
            print("\nTRIAGE IS NOT ADJUDICATION. A critic must now read each touched fact and "
                  "decide whether the text contradicts it, and if so whether the contradiction "
                  "is registered (disputed + a matching position) or a mistake.")
            if secret:
                print(f"\n{len(secret)} text(s) touch a deliberately-open or late/never-"
                      f"discoverable fact — review these first.")
        if args.strict and secret:
            rc = 1

    return rc


if __name__ == "__main__":
    sys.exit(main())
