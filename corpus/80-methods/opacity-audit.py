#!/usr/bin/env python3
"""opacity-audit.py -- the instrument behind RI-WLD09 (the opacity budget).

Four independent checks, each separately runnable, each fail-closed:

  --seals       every mystery in game/data/world/opacity.json has a matching sealed answer
                in corpus/50-world/sealed/SEALED-ANSWERS.md, and vice versa. Proves the
                mystery was authored WITH an answer.
  --leak-scan   no sealed answer, and no declared leak n-gram, appears anywhere under
                game/data/**. Proves the game never states it. Includes a fuzzy
                character-5-gram Jaccard pass so paraphrase is caught too.
  --assembled   every assembled-lore fact draws on >=3 distinct sources in >=2 content
                classes, and its claim string appears in none of them.
  --voids       every declared void tract in game/data/world/voids.json satisfies the
                minimum size, the route rule, the witness-prop floor and the payoff rule,
                and the union of declared voids covers the required share of the landmass.

USAGE
  python3 corpus/80-methods/opacity-audit.py --all --game game/data
  python3 corpus/80-methods/opacity-audit.py --seals --leak-scan --json reports/opacity.json

EXIT  0 clean | 1 one or more checks failed | 2 usage | 10 an input artifact is missing
"""
import argparse, glob, hashlib, json, os, re, sys, collections

SEALED_MD = "corpus/50-world/sealed/SEALED-ANSWERS.md"

# ---- thresholds (RI-WLD09 §B/§C; edit there first, then here) -----------------
MIN_MYSTERIES = 24
MIN_ANSWER_WORDS = 60
MIN_EVIDENCE = 3
MIN_LEAK_NGRAMS = 5
FUZZY_JACCARD = 0.35
MIN_ASSEMBLED = 12
MIN_SOURCES = 3
MIN_UNANSWERED = 3
MAX_UNANSWERED = 6
MIN_VOID_TRACTS = 5
MIN_TRACT_KM2 = 0.30
MIN_VOID_SHARE = 0.14        # of total land area
MAX_VOID_SHARE = 0.28
MIN_TRACT_CROSSING_S = 240   # >=4 min of straight-line walk with no tier A/B POI
MIN_WITNESS_PER_KM2 = 6      # authored, NON-poi-tagged props inside a void
LAND_KM2 = 14.52             # RI-WLD01 / regions.json total_land_km2


# ---------------------------------------------------------------- helpers
def norm(t):
    t = t.lower()
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def seal_of(mid, answer):
    return hashlib.sha256((mid + "\n" + norm(answer)).encode()).hexdigest()


def grams(s, n=5):
    s = norm(s)
    return {s[i:i + n] for i in range(max(0, len(s) - n + 1))}


def jaccard(a, b):
    return len(a & b) / len(a | b) if (a | b) else 0.0


TEXT_KEYS = ("text", "body", "line", "response", "entry", "prose", "greeting",
             "rumour", "rumor", "description", "desc", "note", "inscription", "journal")


def harvest(node, out, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            if k.lower() in TEXT_KEYS and isinstance(v, str) and v.strip():
                out.append((path + "/" + k, v))
            else:
                harvest(v, out, path + "/" + str(k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            harvest(v, out, path + f"[{i}]")


def game_strings(root):
    """Every authored prose string under game/data/**, with its provenance path."""
    out = []
    for p in sorted(glob.glob(os.path.join(root, "**", "*.json"), recursive=True)):
        try:
            harvest(json.load(open(p, encoding="utf-8")), out, p)
        except Exception as e:
            print(f"  ! unreadable {p}: {e}", file=sys.stderr)
    return out


# ---------------------------------------------------------------- sealed answers
REC = re.compile(r"^### (M-\d+)\s+—\s+(.+?)\s*$", re.M)


def parse_sealed(path=SEALED_MD):
    """Parse the corpus-side register. Deliberately tolerant of prose around the fields."""
    if not os.path.exists(path):
        sys.exit(10)
    src = open(path, encoding="utf-8").read()
    marks = list(REC.finditer(src))
    out = {}
    for i, m in enumerate(marks):
        body = src[m.end():marks[i + 1].start() if i + 1 < len(marks) else len(src)]
        get = lambda k: (re.search(rf"^-\s+\*\*{k}:\*\*\s*(.+?)$", body, re.M | re.I) or [None, ""])[1]
        ev = re.search(r"^-\s+\*\*evidence:\*\*\s*$(.*?)(?=^-\s+\*\*)", body, re.S | re.M | re.I)
        n_ev = len(re.findall(r"^\s{2,}-\s+\S", ev.group(1), re.M)) if ev else 0
        ans = re.search(r"^>\s+\*\*SEALED ANSWER\.\*\*\s*(.+?)(?=\n\n|\n\*\*)", body, re.S | re.M)
        answer = re.sub(r"\n>\s*", " ", ans.group(1)).strip() if ans else ""
        answer = re.sub(r"\s+", " ", answer)
        out[m.group(1)] = {
            "id": m.group(1), "name": m.group(2),
            "kind": get("kind").strip(),
            "evidence": n_ev,
            "leak_ngrams": re.findall(r"`\"([^\"]+)\"`", body),
            "answer_words": int((re.search(r"answer_words:\*\*\s*(\d+)", body) or [0, 0])[1]),
            "seal": (re.search(r"seal:\*\*\s*`([0-9a-f]{64})`", body) or [None, ""])[1],
            "answer": answer,
        }
    return out


def check_seals(sealed, game_root, report):
    bad = []
    man_path = os.path.join(game_root, "world", "opacity.json")
    manifest = {}
    if os.path.exists(man_path):
        raw = json.load(open(man_path, encoding="utf-8"))
        for m in ((raw.get("mysteries") or []) if isinstance(raw, dict) else raw):
            manifest[m["id"]] = m
    else:
        bad.append(f"MISSING  {man_path} -- the game declares no mysteries; opacity is unregistered")

    for mid, s in sorted(sealed.items()):
        if not s["answer"]:
            bad.append(f"EMPTY    {mid}: no sealed answer text parsed")
            continue
        recomputed = seal_of(mid, s["answer"])
        if recomputed != s["seal"]:
            bad.append(f"SEALMISS {mid}: corpus seal {s['seal'][:12]}… != recomputed {recomputed[:12]}…"
                       "  (the answer was edited without re-sealing)")
        if s["answer_words"] < MIN_ANSWER_WORDS:
            bad.append(f"SHORT    {mid}: answer_words {s['answer_words']} < {MIN_ANSWER_WORDS}")
        if s["evidence"] < MIN_EVIDENCE:
            bad.append(f"THIN     {mid}: {s['evidence']} evidence items < {MIN_EVIDENCE}")
        if len(s["leak_ngrams"]) < MIN_LEAK_NGRAMS:
            bad.append(f"NGRAMS   {mid}: {len(s['leak_ngrams'])} leak n-grams < {MIN_LEAK_NGRAMS}")
        if manifest:
            g = manifest.get(mid)
            if not g:
                bad.append(f"UNSEALED {mid}: present in the corpus, absent from opacity.json "
                           "-- does not count toward the 24")
            elif g.get("seal") != s["seal"]:
                bad.append(f"MISMATCH {mid}: opacity.json seal != corpus seal "
                           "-- the game and the answer are not the same mystery")
    for gid in manifest:
        if gid not in sealed:
            bad.append(f"NOANSWER {gid}: declared in opacity.json with NO sealed answer "
                       "-- this is absent content, not designed opacity")
    n = len([m for m in manifest if m in sealed]) if manifest else 0
    if n < MIN_MYSTERIES:
        bad.append(f"COUNT    {n} sealed-and-declared mysteries < {MIN_MYSTERIES}")
    report["seals"] = {"sealed_in_corpus": len(sealed), "declared_in_game": len(manifest),
                       "matched": n, "failures": bad}
    return bad


def check_leaks(sealed, game_root, report):
    bad, flags = [], []
    strings = game_strings(game_root)
    if not strings:
        bad.append(f"EMPTY    no prose strings found under {game_root} -- nothing to scan "
                   "(HARNESS §7: prose must live in data)")
    normed = [(p, norm(t), t) for p, t in strings]
    for mid, s in sorted(sealed.items()):
        for ng in s["leak_ngrams"]:
            n = norm(ng)
            for p, nt, t in normed:
                if n and n in nt:
                    bad.append(f"LEAK     {mid}: n-gram \"{ng}\" appears in {p}")
        ag = grams(s["answer"])
        for p, nt, t in normed:
            if len(nt) < 40:
                continue
            j = jaccard(ag, grams(t))
            if j >= FUZZY_JACCARD:
                flags.append(f"PARAPHRASE {mid}: {p} is {j:.2f} similar to the sealed answer")
    report["leaks"] = {"strings_scanned": len(strings), "hard": bad, "fuzzy": flags}
    return bad + flags


def check_assembled(game_root, report):
    bad = []
    p = os.path.join(game_root, "world", "assembled-lore.json")
    if not os.path.exists(p):
        report["assembled"] = {"facts": 0, "failures": [f"MISSING  {p}"]}
        return [f"MISSING  {p}"]
    raw = json.load(open(p, encoding="utf-8"))
    facts = raw.get("facts") or (raw if isinstance(raw, list) else [])
    strings = game_strings(game_root)
    normed = [(q, norm(t)) for q, t in strings]
    for f in facts:
        fid = f.get("id", "?")
        srcs = f.get("sources") or []
        if len(srcs) < MIN_SOURCES:
            bad.append(f"SOURCES  {fid}: {len(srcs)} sources < {MIN_SOURCES}")
        classes = {s.get("class") for s in srcs if isinstance(s, dict)}
        if len(classes) < 2:
            bad.append(f"CLASSES  {fid}: sources span {len(classes)} content class(es) < 2")
        claim = norm(f.get("claim", ""))
        if not claim:
            bad.append(f"NOCLAIM  {fid}: no claim string")
            continue
        cg = grams(f["claim"])
        for q, nt in normed:
            if claim in nt:
                bad.append(f"STATED   {fid}: the claim is stated verbatim in {q} "
                           "-- this is not assembled lore, it is a sentence")
            elif len(nt) >= 40 and jaccard(cg, grams(nt)) >= FUZZY_JACCARD:
                bad.append(f"NEAR     {fid}: {q} states the claim in paraphrase")
    if len(facts) < MIN_ASSEMBLED:
        bad.append(f"COUNT    {len(facts)} assembled facts < {MIN_ASSEMBLED}")
    report["assembled"] = {"facts": len(facts), "failures": bad}
    return bad


def check_voids(game_root, report):
    bad = []
    p = os.path.join(game_root, "world", "voids.json")
    if not os.path.exists(p):
        report["voids"] = {"tracts": 0, "failures": [f"MISSING  {p} -- undeclared emptiness "
                                                     "is unbuilt world, not designed emptiness"]}
        return report["voids"]["failures"]
    raw = json.load(open(p, encoding="utf-8"))
    tracts = raw.get("voids") or (raw if isinstance(raw, list) else [])
    REASONS = {"approach", "crossing", "threshold", "hazard-field", "dread", "scale", "relief"}
    total = 0.0
    for v in tracts:
        vid = v.get("id", "?")
        a = float(v.get("area_km2") or 0)
        total += a
        if a < MIN_TRACT_KM2:
            bad.append(f"SMALL    {vid}: {a} km2 < {MIN_TRACT_KM2} -- a gap, not a tract")
        if v.get("reason") not in REASONS:
            bad.append(f"REASON   {vid}: reason {v.get('reason')!r} not in {sorted(REASONS)}")
        if not v.get("payoff_poi"):
            bad.append(f"PAYOFF   {vid}: no payoff_poi -- emptiness with nothing on the far side")
        if not (v.get("routes") or []):
            bad.append(f"ROUTE    {vid}: no road/track leg enters or crosses it -- unbuilt land")
        if float(v.get("longest_empty_walk_s") or 0) < MIN_TRACT_CROSSING_S:
            bad.append(f"SHORT    {vid}: longest empty walk "
                       f"{v.get('longest_empty_walk_s')} s < {MIN_TRACT_CROSSING_S}")
        wp = float(v.get("witness_props") or 0)
        if a and wp / a < MIN_WITNESS_PER_KM2:
            bad.append(f"STERILE  {vid}: {wp/a:.1f} witness props/km2 < {MIN_WITNESS_PER_KM2} "
                       "-- nobody has ever walked through this; it is unfinished terrain")
        if v.get("landmark_visible_fraction") is not None and \
                float(v["landmark_visible_fraction"]) < 0.90:
            bad.append(f"BLIND    {vid}: landmark visible at "
                       f"{v['landmark_visible_fraction']} of points < 0.90 (RI-WLD06 L1)")
        if not v.get("ambient_state"):
            bad.append(f"SILENT   {vid}: no distinct ambient audio state")
    if len(tracts) < MIN_VOID_TRACTS:
        bad.append(f"COUNT    {len(tracts)} void tracts < {MIN_VOID_TRACTS}")
    share = total / LAND_KM2
    if share < MIN_VOID_SHARE:
        bad.append(f"SHARE    declared voids {share:.3f} of land < {MIN_VOID_SHARE}")
    if share > MAX_VOID_SHARE:
        bad.append(f"SHARE    declared voids {share:.3f} of land > {MAX_VOID_SHARE} "
                   "-- the world is empty, not sparse")
    report["voids"] = {"tracts": len(tracts), "area_km2": round(total, 3),
                       "share_of_land": round(share, 4), "failures": bad}
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default="game/data")
    ap.add_argument("--sealed", default=SEALED_MD)
    ap.add_argument("--seals", action="store_true")
    ap.add_argument("--leak-scan", action="store_true")
    ap.add_argument("--assembled", action="store_true")
    ap.add_argument("--voids", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--json")
    a = ap.parse_args()
    if not any([a.seals, a.leak_scan, a.assembled, a.voids, a.all]):
        ap.print_help()
        sys.exit(2)
    if not os.path.isdir(a.game):
        print(f"{{\"ok\":false,\"error\":\"no such dir {a.game}\",\"exit\":10}}", file=sys.stderr)
        sys.exit(10)

    sealed = parse_sealed(a.sealed)
    report, failures = {}, []
    print(f"parsed {len(sealed)} sealed answers from {a.sealed}")
    if a.all or a.seals:
        failures += check_seals(sealed, a.game, report)
    if a.all or a.leak_scan:
        failures += check_leaks(sealed, a.game, report)
    if a.all or a.assembled:
        failures += check_assembled(a.game, report)
    if a.all or a.voids:
        failures += check_voids(a.game, report)

    for k, v in report.items():
        print(f"\n== {k.upper()} ==")
        for kk, vv in v.items():
            if kk in ("failures", "hard", "fuzzy"):
                for line in vv:
                    print("  " + line)
            else:
                print(f"  {kk}: {vv}")
    print(f"\n{'CLEAN' if not failures else str(len(failures)) + ' FAILURES'}")
    if a.json:
        os.makedirs(os.path.dirname(a.json) or ".", exist_ok=True)
        json.dump(report, open(a.json, "w"), indent=1)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
