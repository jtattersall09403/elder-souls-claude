---
id: RI-LOR06
title: Contradiction discipline — the canon-facts registry, and how a critic tells intent from error
kind: structure
side: morrowind
judges: [lore.canon.registry, coherence.lore.consistency, lore.book.unreliability, dialogue.topics.truth, quests.lore.hooks, quests.faction.escalation, world.settlement.anatomy, process.critic.discipline]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Morrowind's world contains contradictions that are never resolved. *The Real Barenziah* and
*Biography of Barenziah* disagree about the same woman's life and neither is corrected. Several accounts
of the Nerevarine prophecy disagree in their particulars. Canon itself does this: the Knahaten Flu is
attributed both to an Argonian shaman's revenge and to natural causes, in the same body of material, with
no adjudication (CF-D005). This is not sloppiness; it is the mechanism by which a world stops being a
wiki. A world with one authoritative account of everything has a narrator. A world where sources
disagree has *history*.

The problem is that a deliberate contradiction and a mistake are **indistinguishable from the outside.**
A coherence critic reading two of our books that disagree cannot tell whether we are doing what Morrowind
did or whether we simply forgot. If the critic assumes intent, it will pass real errors. If it assumes
error, it will destroy the texture we are trying to build — and the pressure will always be toward
flattening, because flattening is easy to justify.

The bar: **an authorially-consistent world that is deliberately inconsistent at the source level, with a
machine-readable registry that lets any critic, with no context, determine in one lookup which of the two
it is looking at.** The registry is the load-bearing artifact. Without it, contradiction discipline is
just an excuse.

## The reference artifact

### 1. The rule

> **Every contradiction in shipped content must be either (a) registered as disputed, with the in-world
> sources that disagree named, or (b) a bug.** There is no third category. An unregistered contradiction
> is a bug *by definition*, regardless of whether it looks intentional or reads well.

Three corollaries a builder must internalise:

1. **Contradiction lives at the source level, never the authorial level.** Two *books* may disagree. Two
   *NPCs* may disagree. The world model behind them does not. We always know what happened; we simply do
   not always tell.
2. **Nothing in the game corrects a contradiction.** No narrator, no journal entry, no item description,
   no third book that "settles it." The moment we add an adjudicator, every disputed fact collapses into
   trivia and the world flattens.
3. **The player may be permitted to find out — or may not.** Some disputes have a discoverable answer
   (CF-D001, CF-D004, CF-D006). One has **no answer at all** and never will (CF-D002). That distinction
   is a field in the schema because otherwise a future writer *will* resolve it, sincerely, believing
   they are tidying up.

### 2. The registry

**`corpus/60-lore/data/canon-facts.json`** — 54 facts as seeded, verified structurally sound:

```
facts         : 54
  apocryphal     1
  constructed   16
  hard-canon    28
  soft-canon     9
disputed      : 6
deliberately open: 1
REGISTRY: PASS      exit=0
```

#### Schema

```jsonc
{
  "id": "CF-nnn",          // CF-nnn = canon fact | CF-Dnnn = disputed | CF-Cnnn = ours
  "claim": "one sentence",
  "tier": "hard-canon | soft-canon | apocryphal | constructed | open",
  "provenance": "community-data | canonical-recall | constructed",
  "confidence": "high | medium | low",
  "sources_real": ["real-world citations"],
  "in_world_sources": ["books/NPCs in OUR game that assert this"],

  "disputed": true,
  "positions": [
    { "id": "A",
      "in_world_source": "The Sap and the Ledger (Sergius Verrent)",
      "stance": "what this source actually claims",
      "held_by": ["Imperial scholars", "the Imperial Cult", "some lukiul"] }
  ],
  "authorially_true": "A" | null | "partial:<what is actually the case>",
  "deliberately_open": false,     // true => NO answer exists; never resolve

  "contradicts_ok": false,        // may our fiction contradict this? false = never
  "invention_space": true,        // canon leaves room here
  "player_discoverable": "early | mid | late | never | n-a",
  "judges": ["lore.metaphysics", "progression.bonfires"],
  "notes": "..."
}
```

Four fields do the discriminating work and each exists because of a specific failure:

| Field | Prevents |
|---|---|
| `positions[].held_by` | A "contradiction" nobody actually believes — a note dressed as a dispute. The integrity checker errors on an empty `held_by`. |
| `authorially_true` | The writers' room not knowing what happened. `"partial:"` is a first-class answer, because in the best cases *both* sources are wrong in interesting ways. |
| `deliberately_open` | A future writer resolving CF-D002 out of tidiness. Mutually exclusive with a non-null `authorially_true`; the checker errors if both are set. |
| `player_discoverable` | Secrets leaking. Anything at `late`/`never` is flagged by triage the instant it appears in dialogue (§4 demonstrates this catching a real leak). |

#### The six seeded disputes

| ID | Question | Positions | Authorially |
|---|---|---|---|
| **CF-D001** | What survives when a soul returns to the Hist? | **A** *The Sap and the Ledger*: the sap is a solvent, nothing individual persists, Argonians have a contribution not an afterlife. **B** *The Egg Speaks Twice*: the tree gives him out again, and "is it the same person" is a foreign question the language does not contain. | **`partial:`** the **pattern** survives, the **memory** does not. Verrent is right that nothing is recalled and wrong that nothing persists. A third view — *wells remember what the tree forgets* — is voiced only by drunks and the Drowned Court. |
| **CF-D002** | Who cut the first sapwell? | **A** the Hist cut itself. **B** the Kothringi cut it and the Flu was payment. **C** nobody will say, and they get angry when pressed. | **`null`, `deliberately_open: true`.** No answer exists. Do not resolve it in any quest, book or ending. |
| **CF-D003** | Did Argonians build the xanmeers? | **A** Imperial antiquarians: the natives inherited ruins they could never have built. **B** *The Egg Speaks Twice*: "our grandmothers stacked the world into steps." | **B** (matches CF-040/041). Position A is a **wrong view held by real NPCs**, and its wrongness is racial condescension. A critic must not flag A as an error. |
| **CF-D004** | Is the Hist one mind or many trees? | **A** Imperial: a species of individuals. **B** Helstrom keepers: one tree, and these are its fingers. **C** Lilmoth keepers: there was one — some fingers have stopped listening. | **C.** Chosen because canon uses both singular and plural and never adjudicates (CF-008), and C is the only resolution leaving room for canon's rogue trees (CF-009). |
| **CF-D005** | What caused the Knahaten Flu? | **A** an Argonian shaman's engineered revenge through the Hist. **B** natural causes. | **`partial:`** Hist-borne but authored by no one. **Canon itself leaves this standing** — this entry is the proof-of-convention for the whole registry. |
| **CF-D006** | Why is the Rootward Tide failing? | **A** Deep-Kin: root-theft, the soul-gem trade. **B** Wet Ledger: too many wounds, the Sap-Cutters. **C** Drowned Court: something below the Stone Wastes is filling. | **C** (= CF-C010). A and B must carry **genuinely good evidence**: both are real aggravations, and a player who acts on either does real good and fixes nothing. |

#### And 16 `CF-C` entries recording our inventions

CF-C001 – CF-C014 hold everything we made up that later agents will otherwise mistake for canon: the thin
Legion (C001), the early Blackwood Company (C002), the Deep-Kin (C003), the Wet Ledger (C004), the
Sap-Cutters (C005), the Drowned Court (C006), the Blackrose labour-lease (C007), the Rootward Tide (C008),
the sapwell "wells remember" claim (C009), **the secret answer CF-C010**, sap-taint (C011), the barge
network (C012), root-theft (C013), and the sap-fall calendar (C014).

The integrity checker enforces that **any `CF-C` id must declare `tier: "constructed"`** — because the
single most damaging thing this corpus could do is let an invention pass as canon and have three
questlines built on a foundation we were free to change.

### 3. How a critic adjudicates — the decision procedure

Given a piece of content and a claim extracted from it:

```
1. Look up the nearest registry fact.
2. No match?                          -> NEW LORE. File a CF-C entry (Extension Rule,
                                         CORPUS-CONTRACT §5) or FAIL for silent invention.
3. tier=hard-canon, contradicts_ok=false, and the claim contradicts it?
                                      -> FAIL. No appeal, no "but it's an unreliable narrator."
4. tier=soft-canon/apocryphal, and the claim contradicts it?
   - voiced by a named in-world speaker or book -> PASS
   - voiced by narration, journal, or UI text   -> FAIL
5. disputed=true?
   - the speaker's stance matches a listed position -> PASS (this is the texture, working)
   - the speaker's stance matches NO listed position -> FAIL as an UNINTENTIONAL contradiction
   - the text adjudicates between positions          -> FAIL (rule §1.2: nothing corrects)
   - deliberately_open=true and the text answers it  -> FAIL, severity high
6. tier=constructed and the claim contradicts it?
                                      -> FAIL. Our inventions bind us exactly as canon does.
7. player_discoverable in {late, never} and the claim states it plainly, before the
   registered discovery point?         -> FAIL as a secret leak.
```

Step 5 is the whole point of the file. **"Matches no listed position" is the signature of a mistake**,
and it is checkable without taste, mood, or lore expertise.

### 4. Verified tooling (run 2026-08-05)

`corpus/80-methods/canon-check.py` does the automatable half and refuses to pretend to do the rest.

**Registry integrity** — fully automatable, exit-coded:

```
$ python3 corpus/80-methods/canon-check.py --validate-registry
facts: 54   hard-canon 28 | soft-canon 9 | constructed 16 | apocryphal 1
disputed: 6   deliberately open: 1
  WARN  CF-D003: constructed provenance on a hard-canon tier — check this is a
        resolution OF canon, not an invention presented as canon
REGISTRY: PASS      exit=0
```

It errors on: missing fields, duplicate ids, a disputed fact with fewer than two positions, a position
with no `held_by`, `authorially_true` naming a position that does not exist, `deliberately_open` carrying
an answer, a `CF-C` id not declaring `tier: constructed`, a `CF-D` id not marked disputed, hard-canon with
`contradicts_ok: true`, and (with `--books-manifest`) any disputed fact naming an in-world source that
was never written — *"a contradiction whose sources do not exist is not tracked, it is claimed."*

**Claim triage** — deliberately *not* adjudication. Run against a sample dialogue file in which one NPC
line was written to leak the secret:

```
$ python3 corpus/80-methods/canon-check.py --claims game/data/dialogue/*.json --strict
texts scanned : 4      registry touches: 3
  [CF-088  hard-canon]            ~soulrest,stone,wastes
 ![CF-D006 constructed DISPUTED]  ~filling,stone,wastes
 ![CF-C010 constructed]           ~beneath,built,cause,engine,filling

TRIAGE IS NOT ADJUDICATION. A critic must now read each touched fact and decide whether the
text contradicts it, and if so whether the contradiction is registered or a mistake.

2 text(s) touch a deliberately-open or late/never-discoverable fact — review these first.
exit=1
```

The line — *"Beneath the Stone Wastes near Soulrest there is an engine the ancients built to hold souls,
and it is filling. That is the true cause."* — is a fisherman stating CF-C010, the registry's one secret,
in the first hour. Triage caught it on keyword overlap alone and exited non-zero under `--strict`.

**What the script does not do, stated plainly:** it does not determine whether a text *contradicts* a
fact. That is a semantic judgement and pretending to automate it would produce confident false verdicts —
the exact failure this corpus caught in its research phase (CF-071). The script's guarantee is narrower
and more useful: **no lore-bearing text is ever reviewed without its relevant registry entries in front of
the reviewer.**

## Comparison method

1. **Registry integrity gate** — runs in CI, blocks the wave:
   ```
   python3 corpus/80-methods/canon-check.py --validate-registry \
       --books-manifest game/data/books/manifest.json
   ```
   Exit 1 → **FAIL.**
2. **Triage sweep** over all lore-bearing content:
   ```
   python3 corpus/80-methods/canon-check.py --claims game/data/**/*.json --strict --json
   ```
   Every `secret` hit must be reviewed and either cleared (the text is at/after the registered discovery
   point) or fixed. Unreviewed secret hits → **FAIL.**
3. **Adjudication pass.** The critic runs §3's procedure on a sample of ≥30 triage hits, weighted toward
   `hard-canon` and `disputed` facts. Record each as PASS / FAIL-canon / FAIL-unregistered / NEW-LORE.
4. **Contradiction census.** Count disputed facts whose positions are *both* actually voiced in shipped
   content by a real book or NPC.
   - **< 8 fully-voiced disputes → FAIL.** A registry of disputes nobody in the world holds is paperwork.
   - Any disputed fact with a position voiced **zero** times → that position is fictional; fix or delete.
5. **Adjudicator hunt.** Search for any text that resolves a dispute:
   ```
   grep -riE "in (fact|truth)|the truth is|actually|it turns out|proved (that|to be)|we now know" \
        game/data/books game/data/dialogue
   ```
   Every hit reviewed by hand. Narration or journal text settling a registered dispute → **FAIL** (§1.2).
6. **Open-question guard.** Any content matching CF-D002 (who cut the first well) that supplies an answer
   → **FAIL, severity high.** This check is run every wave forever, because the pressure to answer it
   never goes away.
7. **Invention-opacity probe.** Sample 10 `CF-C` facts. For each, confirm no in-world source states it in
   the register of established scholarship. A constructed fact asserted as though it were Tamrielic
   consensus → **FAIL.**
8. **Drift check.** Diff `canon-facts.json` between waves. Any fact whose `tier` moved from `constructed`
   to `hard-canon`, or whose `authorially_true` changed after content shipped against it → **FAIL**; that
   is retconning our own registry, and it silently invalidates every piece already judged against it.

## Scoring

| Score | Condition |
|---|---|
| **5** | Registry passes; ≥10 fully-voiced disputes; zero adjudicators; zero secret leaks; every sampled claim maps to a registry entry; ≥95% of §3 adjudications land in PASS or NEW-LORE |
| **4** | Registry passes; ≥8 fully-voiced disputes; zero adjudicators; ≤1 secret leak, fixed |
| **3** | Registry passes; ≥5 fully-voiced disputes; ≤2 unregistered contradictions found and registered |
| **2** | Registry exists but is stale — content has moved past it; contradictions present but mostly unregistered |
| **1** | Registry unused; contradictions are indistinguishable from bugs by inspection |
| **0 — FAIL** | Any hard-canon contradiction shipped; or CF-D002 answered; or a narrator/journal adjudicating a registered dispute; or a `CF-C` invention presented in-world as established canon |

**Failure threshold: below 3.** Note the asymmetry: **a world with zero contradictions also scores 2 at
best.** Sanitised coherence is a failure state here, not a safe default, and a critic who rewards it has
misread this file.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 2 / 5 | 3 / 5 | 5 / 5 |

**Aggregation (a property of this item, not of the critic):** band on the 0-5 native scale.

## How we lose

1. **The critic flattens us.** A coherence critic reads Exemplars 1 and 2, sees them disagree about what
   survives in the sap, files it as an error, and a builder "fixes" it by making one of them agree. We
   lose the best thing about the corpus to a critic doing its job with the wrong instrument. **This file
   exists primarily to prevent that**, which is why §3 is a lookup rather than a judgement.
2. **The excuse in reverse.** "It's an unreliable narrator" used to wave through a genuine hard-canon
   error. Step 3 of §3 admits no appeal for exactly this reason: unreliability is a licence at the
   *source* level, never at the *world model* level.
3. **The registry goes stale.** Content ships, lore accretes in dialogue files, and `canon-facts.json`
   stops describing the game. Then it is worse than useless, because critics trust it. Check 8 (drift)
   and CI integration are the only real defences.
4. **Contradictions that are merely errors we decided to keep.** Registering a mistake after the fact and
   calling it intentional. The tell is a position with an empty or invented `held_by` — nobody in the
   world actually holds it. The integrity checker errors on this.
5. **Someone answers CF-D002.** Sincerely, in a good quest, because an unanswered question felt like a
   loose end. Check 6 runs forever.
6. **The secret leaks early.** A fisherman explains the engine under the Stone Wastes in hour one. This
   already happened once, in the test fixture, and the triage tool caught it — which is the entire
   argument for having the tool.
7. **Our inventions harden into canon.** A `CF-C` fact gets quoted in a book in the Pocket Guide's dry
   scholarly register, a later agent reads the book, treats it as immovable, and builds three quests on
   it. Checks 7 and 8.
8. **Contradiction as noise.** Forty disputes, none of which the player can perceive or care about. The
   six seeded disputes are all about things the game is *about* — souls, the tree, the ruins, the plague,
   the crisis. A dispute over a minor date is not texture; it is a typo with a schema.

## Provenance note

- **The convention itself is `canonical-recall`, confidence high.** Morrowind ships mutually contradictory
  books that the game never adjudicates (*The Real Barenziah* vs *Biography of Barenziah*; the competing
  Nerevarine prophecy accounts). This is recalled from the shipped game, not verified this session.
- **CF-D005 is `community-data`, confidence high**, and is the strongest evidence available that the
  convention is deliberate rather than accidental: UESP's summary of the Knahaten Flu records two
  incompatible origin accounts side by side with no resolution. Verified by search snippet 2026-08-05;
  direct fetch refused at the proxy (see RI-LOR01).
- **The schema, the six seeded disputes, all authorial rulings, the 16 `CF-C` entries, and the decision
  procedure in §3 are `constructed`.** The authorial rulings are binding: CF-D001 `partial`, CF-D002
  `open forever`, CF-D003 `B`, CF-D004 `C`, CF-D005 `partial`, CF-D006 `C`. Changing any of them after
  content ships against it is the retcon that check 8 exists to catch.
- **The tool outputs quoted in §4 are `measured`** — actual stdout from
  `corpus/80-methods/canon-check.py` on 2026-08-05, reproducible with the commands shown. The registry's
  single WARN (CF-D003) is expected and correct: it is a resolution *of* canon carrying constructed
  provenance, and the warning asks a reader to confirm precisely that.
- One entry, **CF-071**, records a real contamination event from this session's research: an AI-generated
  worldbuilding site returned fluent, confident, entirely fabricated claims about Gideon's and Blackrose's
  governance inside the same result set as legitimate wiki summaries. It is registered as `apocryphal`
  and `REJECTED` so that no future agent re-imports it. The registry's first job was done before the
  game existed.
