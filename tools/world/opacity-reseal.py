#!/usr/bin/env python3
"""opacity-reseal.py — recompute `answer_words` and `seal` in SEALED-ANSWERS.md, and mirror the
seals into game/data/world/opacity.json.

RI-WLD09 §B1: "An answer may be edited only by re-sealing: change the text here, recompute, and
update `game/data/world/opacity.json` in the same commit." This is the tool that does that. It
is deliberately NOT part of `corpus/80-methods/opacity-audit.py` — the auditor must stay a pure
instrument, and a tool that can rewrite a seal must never be the tool that checks one.

The normalisation is IMPORTED from the auditor rather than reimplemented, so the two can never
drift. If they drifted, every seal in the corpus would verify against a hash nobody else
computes, and the whole mechanism would be a decoration.

  python3 tools/world/opacity-reseal.py --check      # exit 1 if anything is stale (CI mode)
  python3 tools/world/opacity-reseal.py --write      # rewrite the md and the manifest

EXIT 0 clean/written | 1 stale (under --check) | 2 usage | 10 an input artifact is missing
"""
import argparse, importlib.util, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEALED_MD = os.path.join(ROOT, "corpus/50-world/sealed/SEALED-ANSWERS.md")
MANIFEST = os.path.join(ROOT, "game/data/world/opacity.json")
AUDIT = os.path.join(ROOT, "corpus/80-methods/opacity-audit.py")


def _audit():
    if not os.path.exists(AUDIT):
        print(f"missing {AUDIT} — the seal normalisation lives there and is not duplicated here",
              file=sys.stderr)
        sys.exit(10)
    spec = importlib.util.spec_from_file_location("opacity_audit", AUDIT)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    if not (a.check or a.write):
        ap.print_help()
        sys.exit(2)
    if not os.path.exists(SEALED_MD):
        print(f"missing {SEALED_MD}", file=sys.stderr)
        sys.exit(10)

    au = _audit()
    sealed = au.parse_sealed(SEALED_MD)
    if not sealed:
        print(f"parsed 0 sealed answers from {SEALED_MD} — the record format has changed and this "
              "tool cannot re-seal what it cannot read", file=sys.stderr)
        sys.exit(10)

    src = open(SEALED_MD, encoding="utf-8").read()
    marks = list(au.REC.finditer(src))
    stale, out, cursor = [], [], 0
    seals = {}
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(src)
        body = src[m.end():end]
        mid = m.group(1)
        rec = sealed[mid]
        if not rec["answer"]:
            print(f"EMPTY {mid}: no sealed answer text parsed — refusing to seal nothing", file=sys.stderr)
            sys.exit(10)
        want_seal = au.seal_of(mid, rec["answer"])
        want_words = len(rec["answer"].split())
        seals[mid] = want_seal
        if rec["seal"] != want_seal:
            stale.append(f"SEAL  {mid}: {rec['seal'][:12]}… -> {want_seal[:12]}…")
        if rec["answer_words"] != want_words:
            stale.append(f"WORDS {mid}: {rec['answer_words']} -> {want_words}")
        body = re.sub(r"(?m)^(-\s+\*\*seal:\*\*\s*`)[0-9a-f]{64}(`)", rf"\g<1>{want_seal}\g<2>", body)
        body = re.sub(r"(?m)^(-\s+\*\*answer_words:\*\*\s*)\d+", rf"\g<1>{want_words}", body)
        out.append(src[cursor:m.end()])
        out.append(body)
        cursor = end
    out.append(src[cursor:])
    fixed = "".join(out)

    # Mirror into the game-side manifest, which holds the seal and NEVER the answer.
    man_stale = []
    manifest = None
    if os.path.exists(MANIFEST):
        manifest = json.load(open(MANIFEST, encoding="utf-8"))
        for entry in manifest.get("mysteries", []):
            want = seals.get(entry["id"])
            if want is None:
                man_stale.append(f"NOANSWER {entry['id']}: in opacity.json, not in SEALED-ANSWERS.md")
            elif entry.get("seal") != want:
                man_stale.append(f"MANIFEST {entry['id']}: seal -> {want[:12]}…")
                entry["seal"] = want
            aw = len(sealed[entry["id"]]["answer"].split()) if want else 0
            if want and entry.get("answer_words") != aw:
                man_stale.append(f"MANIFEST {entry['id']}: answer_words -> {aw}")
                entry["answer_words"] = aw

    problems = stale + man_stale
    for line in problems:
        print("  " + line)
    print(f"{len(sealed)} records; {len(problems)} stale")

    if a.check:
        sys.exit(1 if problems else 0)

    open(SEALED_MD, "w", encoding="utf-8").write(fixed)
    if manifest is not None:
        json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        open(MANIFEST, "a", encoding="utf-8").write("\n")
    print("written")
    # A NOANSWER cannot be repaired by re-sealing — it means the game declares a mystery that has
    # no authored answer, which is the exact absent-content failure RI-WLD09 exists to catch.
    sys.exit(1 if any(p.startswith("NOANSWER") for p in man_stale) else 0)


if __name__ == "__main__":
    main()
