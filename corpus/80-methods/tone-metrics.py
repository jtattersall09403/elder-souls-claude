#!/usr/bin/env python3
"""tone-metrics.py -- the instrument behind RI-DLG08 (tonal range and the indifference ratio).

Computes an identical metric bundle over (a) the vendored Morrowind reference corpus and
(b) our own dialogue data, so the two are directly comparable. Pure stdlib: this machine
has no numpy / sklearn / nltk / spacy (verified 2026-08-06).

USAGE
  # the reference (the numbers tabled in RI-DLG08 come from exactly this invocation)
  python3 corpus/80-methods/tone-metrics.py --reference

  # ours: every string in game/data/dialogue/** + quests/**.journal + books/**
  python3 corpus/80-methods/tone-metrics.py --ours game/data --json reports/tone-ours.json

  # anti-register lint; exits 1 on a violation, so it can gate the build
  python3 corpus/80-methods/tone-metrics.py --ours game/data --lint

EXIT CODES  0 ok | 1 lint failure | 2 usage | 10 input artifact missing
"""
import argparse, csv, glob, gzip, json, os, re, statistics, sys, collections

REF = "corpus/40-dialogue/data/morrowind-dialogue.csv.gz"

# ---------------------------------------------------------------- tokenising
TOK = re.compile(r"[A-Za-z']+")
tok = lambda t: TOK.findall(t.lower())


def sents(t):
    t = re.sub(r"\s+", " ", t.strip())
    return [s for s in re.split(r"(?<=[.!?])\s+", t) if TOK.search(s)]


# ---------------------------------------------------------------- probes
SECOND = re.compile(r"\b(you|your|yours|yourself|thou|thee|thy|thine)\b", re.I)
PCTOK = re.compile(r"%PC\w+|%Name|%Faction|%Rank|%Class|\{player[\w.]*\}", re.I)
PLAYER = re.compile(SECOND.pattern + r"|" + PCTOK.pattern, re.I)
CONTR = re.compile(r"\b\w+'(s|t|re|ve|ll|d|m)\b", re.I)
SUBORD = re.compile(
    r"\b(although|though|because|since|unless|until|whereas|while|whilst|if|when|"
    r"whenever|wherever|whether|after|before|once|lest|provided|so that|in order that|"
    r"as if|as though|even if|even though|that|which|who|whom|whose|where)\b", re.I)

ADJ_SUF = re.compile(r".+(ous|ful|less|able|ible|ive|ic|ical|ish|ant|ent|ary|ory|al)$")
ADJ_LIST = set("""good bad old young great small big little new long short high low hard easy soft
strong weak dead dark light poor rich wise mad safe free true false clean cold warm hot wet dry
sick sure fine right wrong kind cruel proud quiet common strange odd fair foul deep shallow thin
fat wide narrow heavy sharp dull sweet bitter sour ancient elder holy unholy sacred cursed blessed
blind lame dumb loud slow quick fast late early red blue green black white grey gray brown golden
silver dirty filthy clever stupid brave afraid angry happy sad lucky ugly pretty lovely mighty
humble noble vile grim bleak stern harsh gentle bold rough smooth""".split())
ADJ_NOT = set("this his has was is as its us thus gods lords others always perhaps".split())

# --- stance tiers -------------------------------------------------------------
W3_PRAISE = [r"\bwell done\b", r"\bnicely done\b", r"\bgood work\b", r"\bexcellent work\b",
             r"\bimpressive\b", r"\byou (have |'ve )?(done|did) (well|us proud|a (great|fine))",
             r"\bcongratulations\b", r"\b(i|we) (am|are) proud (of|to)\b", r"\bit is an honou?r\b",
             r"\bhonou?red to\b", r"\byou have proved\b", r"\byou have earned\b", r"\bworthy\b",
             r"\byou are (a |the )?(hero|champion|savio[u]?r|nerevarine|hortator|great)",
             r"\byou have my (respect|admiration)\b", r"\bwe owe you\b",
             r"\bcould not have done it without you\b"]
W2_THANKS = [r"\bthank(s| you)\b", r"\bgrateful\b", r"\bgratitude\b", r"\bmy thanks\b",
             r"\bblessings (up)?on you\b", r"\byou have my thanks\b", r"\bwe thank you\b"]
W1_COURTESY = [r"\bat your service\b", r"\bmy pleasure\b", r"\bhow (may|can) i (help|serve|be of)",
               r"\bwhat can i do for you\b", r"\bglad to (see|help|meet)",
               r"\bpleased to (see|meet|help)", r"\bhappy to (help|serve)", r"\bwelcome\b",
               r"\bdelighted\b", r"\banything you need\b", r"\bwhatever you need\b",
               r"\bplease, (take|accept)\b", r"\bgood to see you\b", r"\bmy (good )?friend\b"]
C1_DISMISS = [r"\bleave me alone\b", r"\bgo away\b", r"\bnot interested\b",
              r"\bi (don'?t|do not) care\b", r"\bwhy should i\b",
              r"\bnone of your (business|concern)\b", r"\bmind your own\b", r"\bmake it quick\b",
              r"\bi'?m busy\b", r"\b(i|we) (know|have) nothing\b", r"\bnothing (more )?to say\b",
              r"\bno idea\b", r"\b(can'?t|cannot|can not) help you\b", r"\bwon'?t help\b",
              r"\bnot my (problem|concern)\b", r"\bdon'?t bother\b", r"\bstop bothering\b",
              r"\bcome back later\b", r"\bsee me later\b", r"\bi have nothing for you\b",
              r"\bdoes ?n'?o?t? concern you\b", r"\bnot for you\b", r"\bwhat do you want\b",
              r"\bnothing to do with me\b"]
C2_CONTEMPT = [r"\bfilthy\b", r"\byou (are|'re) (a )?(fool|idiot|lout|wretch|coward|liar)\b",
               r"\bworthless\b", r"\bget out of my sight\b", r"\bget out\b", r"\bget lost\b",
               r"\bbe ?gone\b", r"\bshut up\b", r"\b(waste|wasting) (my |your |of )?time\b",
               r"\bscum\b", r"\bwretched\b", r"\b(you|,)\s*(outlander|n'wah|fetcher|s'wit)\b",
               r"\b(outlander|n'wah|fetcher|s'wit)[,.!?]"]
C3_THREAT = [r"\byou'?ll be sorry\b", r"\bdon'?t come back\b", r"\bi(')?ll kill you\b",
             r"\bkill you\b", r"\byou will (die|regret)\b", r"\bnot welcome\b", r"\bor else\b",
             r"\bnever come back\b", r"\bat your own risk\b", r"\byou have been warned\b"]

# --- anti-registers (the lint) ------------------------------------------------
# HARD = anachronism that marks the writer, not the world. SOFT = period-neutral colloquial.
IDIOM_HARD = [r"\bokay\b", r"\bo\.?k\.?\b", r"\byeah\b", r"\byep\b", r"\bnope\b", r"\bcool\b",
              r"\bawesome\b", r"\bno worries\b", r"\btotally\b", r"\bmy bad\b", r"\bguys\b",
              r"\bgotcha\b", r"\bheads up\b", r"\bfor real\b", r"\bbig time\b", r"\bnice one\b",
              r"\bpretty much\b", r"\bat the end of the day\b", r"\bgame ?plan\b",
              r"\breach out\b", r"\bwe got this\b", r"\blevel up\b", r"\bxp\b", r"\bquest ?log\b",
              r"\bside ?quest\b", r"\bhit ?points?\b", r"\bstat(s)? ?(screen|sheet)\b",
              r"\bare you kidding\b", r"\bseriously\?", r"\bliterally\b", r"\bawkward\b",
              r"\bepic\b", r"\brandom(ly)?\b", r"\bweird flex\b", r"\bvibe(s)?\b"]
IDIOM_SOFT = [r"\bkind of\b", r"\bsort of\b", r"\bstuff\b", r"\bguy\b", r"\bissue(s)?\b",
              r"\bfocus on\b", r"\bon it\b", r"\bno way\b", r"\bcheck (it )?out\b",
              r"\bdeal with it\b", r"\bhang on\b", r"\bwhatever\b", r"\bseriously\b"]
QUIP = [r"\bwell, that (just )?happened\b", r"\bthat went well\b", r"\bi regret nothing\b",
        r"\bwhat could (possibly )?go wrong\b", r"\btotally worth it\b", r"\bnailed it\b",
        r"\bcalled it\b", r"\bhere we go again\b", r"\bdon'?t even ask\b", r"\bno pressure\b",
        r"\bthanks, i hate it\b", r"\bcould be worse\b.{0,20}\bcould be\b",
        r"\bthat'?s a (thing|first)\b", r"\bi'?ll be here all (day|week)\b"]
SELF_AWARE = [r"\b(main|side) quest\b", r"\bnpc\b", r"\bplayer character\b", r"\bsave (your )?game\b",
              r"\brespawn\b", r"\bloading screen\b", r"\bfourth wall\b", r"\bthe player\b",
              r"\bgame (design|mechanic)\b", r"\bpress \w+ to\b", r"\bin this game\b"]
TUTORIAL = [r"\bpress (the )?\w+ (button|key)\b", r"\buse the \w+ menu\b",
            r"\bto (attack|block|dodge|roll|sprint), (press|hold|tap)\b", r"\btip:", r"\bhint:",
            r"\bthis is your (health|stamina) (bar|meter)\b", r"\bhold (the )?\w+ (button|key) to\b",
            r"\btutorial\b", r"\bopen your (inventory|menu|map)\b", r"\bcheck your (journal|log) for\b"]
CHOSEN = [r"\byou are the (chosen|prophesied|one true|foretold)\b", r"\bthe prophecy speaks of you\b",
          r"\bwe have (long )?awaited (you|your)\b", r"\byou are our only hope\b",
          r"\bat last, you have come\b", r"\bthe (chosen|prophesied) one\b",
          r"\bi have (waited|been waiting) for you\b"]


def mk(pats):
    return [re.compile(p, re.I) for p in pats]


PROBES = {k: mk(v) for k, v in dict(
    W3=W3_PRAISE, W2=W2_THANKS, W1=W1_COURTESY, C1=C1_DISMISS, C2=C2_CONTEMPT, C3=C3_THREAT,
    IDIOM_HARD=IDIOM_HARD, IDIOM_SOFT=IDIOM_SOFT, QUIP=QUIP, SELF_AWARE=SELF_AWARE,
    TUTORIAL=TUTORIAL, CHOSEN=CHOSEN).items()}


def hits(t, key):
    return sum(len(r.findall(t)) for r in PROBES[key])


def any_hit(t, key):
    return any(r.search(t) for r in PROBES[key])


# ---------------------------------------------------------------- loading
def load_reference(path=REF):
    if not os.path.exists(path):
        sys.exit(10)
    rows = [r for r in csv.DictReader(gzip.open(path, "rt", encoding="utf-8", errors="replace"))
            if (r.get("DialogueText") or "").strip()]
    return rows, [r["DialogueText"] for r in rows]


TEXT_KEYS = ("text", "body", "line", "response", "entry", "prose", "greeting", "rumour", "rumor")

# `x` is the payload key of the dialogue schema (elder-souls/dialogue-topics@2 and the
# greetings / rumours / road-directions / slavery-lines pools): the words an NPC actually
# says live under `x`, and nowhere else. It was absent from TEXT_KEYS, so every previous
# `--ours game/data` run measured our books, journals and quest prose and NOT one line of
# our dialogue -- 1,739 authored strings invisible to an instrument whose whole subject is
# dialogue. Added by W1-DLG-WORDS 2026-08-14; before/after in the same status file.
# Guarded: `x` is also a coordinate name, so only multi-word STRINGS are taken. Numeric x,
# short codes and ids cannot enter. The reference (--reference) path does not use harvest()
# at all, so no threshold calibration is affected.
PROSE_ONLY_KEYS = ("x",)
MIN_PROSE_WORDS = 4


def harvest(node, out):
    """Pull every authored prose string out of an arbitrary game/data JSON tree."""
    if isinstance(node, dict):
        for k, v in node.items():
            kl = k.lower()
            if kl in TEXT_KEYS and isinstance(v, str) and v.strip():
                out.append(v)
            elif (kl in PROSE_ONLY_KEYS and isinstance(v, str)
                  and len(v.split()) >= MIN_PROSE_WORDS):
                out.append(v)
            else:
                harvest(v, out)
    elif isinstance(node, list):
        for v in node:
            harvest(v, out)


def load_ours(root):
    if not os.path.isdir(root):
        sys.exit(10)
    out = []
    for p in sorted(glob.glob(os.path.join(root, "**", "*.json"), recursive=True)):
        try:
            harvest(json.load(open(p, encoding="utf-8")), out)
        except Exception as e:
            print(f"  ! unreadable {p}: {e}", file=sys.stderr)
    return [{"DialogueText": t} for t in out], out


# ---------------------------------------------------------------- metrics
def compute(texts):
    U = list(dict.fromkeys(t for t in texts if t and t.strip()))  # exact-text dedupe
    n = len(U)
    if not n:
        sys.exit(20)
    words, SL, WPE, exc = [], [], [], 0
    S = []
    for t in U:
        k = tok(t)
        words += k
        WPE.append(len(k))
        ss = sents(t)
        S += ss
        SL += [len(tok(s)) for s in ss]
        exc += t.count("!")
    W = len(words)
    SLs = sorted(SL)
    pct = lambda p: SLs[min(len(SLs) - 1, int(p * len(SLs)))]
    adj = sum(1 for w in words
              if w in ADJ_LIST or (len(w) > 4 and ADJ_SUF.match(w) and w not in ADJ_NOT))

    stance = collections.Counter()
    tier = collections.Counter()
    for t in U:
        h = {g: any_hit(t, g) for g in ("W1", "W2", "W3", "C1", "C2", "C3")}
        for g, v in h.items():
            if v:
                tier[g] += 1
        warm = h["W1"] or h["W2"] or h["W3"]
        cold = h["C1"] or h["C2"] or h["C3"]
        stance["WARM" if warm and not cold else
               "COLD" if cold and not warm else
               "MIXED" if warm and cold else "FLAT"] += 1

    pd = [t for t in U if PLAYER.search(t)]
    m = {
        "texts_distinct": n, "words": W, "sentences": len(S),
        "w_per_entry_mean": round(statistics.mean(WPE), 2),
        "w_per_entry_median": statistics.median(WPE),
        "w_per_sent_mean": round(statistics.mean(SL), 2),
        "w_per_sent_sd": round(statistics.pstdev(SL), 2),
        "w_per_sent_median": statistics.median(SL),
        "w_per_sent_p90": pct(.90), "w_per_sent_p95": pct(.95), "w_per_sent_p99": pct(.99),
        "sent_le6w": round(sum(1 for x in SL if x <= 6) / len(SL), 4),
        "sent_7to12w": round(sum(1 for x in SL if 7 <= x <= 12) / len(SL), 4),
        "sent_13to20w": round(sum(1 for x in SL if 13 <= x <= 20) / len(SL), 4),
        "sent_gt20w": round(sum(1 for x in SL if x > 20) / len(SL), 4),
        "sent_gt30w": round(sum(1 for x in SL if x > 30) / len(SL), 4),
        "subord_sent_rate": round(sum(1 for s in S if SUBORD.search(s)) / len(S), 4),
        "subord_per_sent": round(sum(len(SUBORD.findall(s)) for s in S) / len(S), 3),
        "commas_per_sent": round(sum(t.count(",") for t in U) / len(S), 3),
        "adj_per_100w": round(100 * adj / W, 2),
        "contractions_per_1k": round(1000 * sum(len(CONTR.findall(t)) for t in U) / W, 2),
        "excl_per_100_sent": round(100 * exc / len(S), 2),
        "texts_with_excl": round(sum(1 for t in U if "!" in t) / n, 4),
        "second_person_per_1k": round(1000 * sum(len(SECOND.findall(t)) for t in U) / W, 2),
        "pc_token_per_1k": round(1000 * sum(len(PCTOK.findall(t)) for t in U) / W, 2),
        "texts_addressing_player": round(len(pd) / n, 4),
        "non_address_rate": round(1 - len(pd) / n, 4),
        "warm_rate": round(stance["WARM"] / n, 4),
        "cold_rate": round(stance["COLD"] / n, 4),
        "flat_rate": round(stance["FLAT"] / n, 4),
        "mixed_rate": round(stance["MIXED"] / n, 4),
        "praise_rate": round(tier["W3"] / n, 4),
        "thanks_rate": round(tier["W2"] / n, 4),
        "courtesy_rate": round(tier["W1"] / n, 4),
        "indifference_ratio": round(1 - stance["WARM"] / n, 4),
        "idiom_hard_per_10k": round(10000 * sum(hits(t, "IDIOM_HARD") for t in U) / W, 3),
        "idiom_soft_per_10k": round(10000 * sum(hits(t, "IDIOM_SOFT") for t in U) / W, 3),
        "quip_per_10k": round(10000 * sum(hits(t, "QUIP") for t in U) / W, 3),
        "self_aware_hits": sum(hits(t, "SELF_AWARE") for t in U),
        "tutorial_hits": sum(hits(t, "TUTORIAL") for t in U),
        "chosen_one_hits": sum(hits(t, "CHOSEN") for t in U),
    }
    if pd:
        pdc = collections.Counter()
        for t in pd:
            warm = any(any_hit(t, g) for g in ("W1", "W2", "W3"))
            cold = any(any_hit(t, g) for g in ("C1", "C2", "C3"))
            pdc["WARM" if warm and not cold else "COLD" if cold and not warm
                else "MIXED" if warm and cold else "FLAT"] += 1
        m["ir_player_directed"] = round(1 - pdc["WARM"] / len(pd), 4)
    return m


# ---------------------------------------------------------------- the lint
# (thresholds are RI-DLG08 §4; edit there, then here, never only here)
LINT = [
    ("idiom_hard_per_10k", "<=", 5.00, "modern idiom above the measured Morrowind rate"),
    ("quip_per_10k", "<=", 1.00, "quippy banter"),
    ("self_aware_hits", "==", 0, "self-aware / fourth-wall reference"),
    ("tutorial_hits", "==", 0, "tutorialising in dialogue"),
    ("excl_per_100_sent", "<=", 6.00, "exclamation rate (Morrowind: 3.01)"),
    ("texts_with_excl", "<=", 0.10, "share of lines containing '!' (Morrowind: 0.052)"),
    ("praise_rate", "<=", 0.05, "NPCs complimenting the player (Morrowind: 0.016)"),
    ("warm_rate", "<=", 0.25, "player-affirming lines (Morrowind: 0.125)"),
    ("warm_rate", ">=", 0.05, "no warmth anywhere -- indifference faked by blandness"),
    ("cold_rate", ">=", 0.030, "friction rate (Morrowind: 0.049)"),
    ("indifference_ratio", ">=", 0.75, "indifference ratio below the band"),
    ("indifference_ratio", "<=", 0.95, "indifference ratio above the band (nothing warm exists)"),
    ("sent_le6w", ">=", 0.30, "no short-sentence register"),
    ("sent_gt20w", ">=", 0.02, "no long-sentence register"),
    ("w_per_sent_mean", "<=", 12.0, "prose has drifted long (Morrowind: 8.08)"),
]
OPS = {"<=": lambda a, b: a <= b, ">=": lambda a, b: a >= b, "==": lambda a, b: a == b}


def lint(m):
    bad = []
    for key, op, thr, why in LINT:
        v = m.get(key)
        if v is None:
            bad.append(f"MISSING  {key}")
        elif not OPS[op](v, thr):
            bad.append(f"FAIL     {key} = {v}  (require {op} {thr})  -- {why}")
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reference", action="store_true", help="measure the Morrowind corpus")
    ap.add_argument("--ref-path", default=REF)
    ap.add_argument("--ours", metavar="GAME_DATA_DIR")
    ap.add_argument("--json", metavar="OUT")
    ap.add_argument("--lint", action="store_true")
    a = ap.parse_args()
    if not (a.reference or a.ours):
        ap.print_help()
        sys.exit(2)
    if a.reference:
        _, texts = load_reference(a.ref_path)
        label = "MORROWIND REFERENCE"
    else:
        _, texts = load_ours(a.ours)
        label = f"OURS ({a.ours})"
    m = compute(texts)
    print(f"== {label} ==")
    for k, v in m.items():
        print(f"  {k:28s} {v}")
    if a.json:
        os.makedirs(os.path.dirname(a.json) or ".", exist_ok=True)
        json.dump({"source": label, "metrics": m}, open(a.json, "w"), indent=1)
        print(f"  -> {a.json}")
    if a.lint:
        bad = lint(m)
        print("\n== ANTI-REGISTER LINT ==")
        print("\n".join("  " + b for b in bad) if bad else "  clean")
        sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
