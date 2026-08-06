---
id: RI-MAG04
title: Magic as a quest solution — the required census, the diversity rule, and the AR-3 crossing
kind: number
side: morrowind
judges: [magic.quests.solutions, magic.effects.utility, quests.resolution.noncombat, magic.effects.traversal]
provenance: constructed
confidence: medium
blind_pair: no
---

> **This item is a direct AR-3 seam-crossing contributor and says so in §E.** It is
> load-bearing for RI-QST05's ≥45% `PACIFIST-ALL` bar: **magic supplies at least a quarter of
> it.** Static analysis over `game/data/quests/**` against `corpus/30-quests/quest.schema.json`.

## The bar

S19 is explicit that spell effects are **tools** — *"open this lock, cross this water, survive
this air, see this hidden thing, make this Argonian like you"* — and that **quests must be
solvable with them.** That sentence is easy to agree with and almost impossible to accidentally
satisfy, because the default shape of an RPG quest is *go here, talk, and if that fails, fight*.
Magic gets added to the combat branch, where it is a different-coloured sword, and the quest
data records nothing about it.

The bar is a census with teeth: **≥22 quests (≥11% of the shipped total) must have a resolution
whose `method` is `magic_utility`**, those resolutions must be spread across **≥14 distinct
effects and all four schools**, no single effect may carry more than **22%** of them, **≥4** must
be quests where magic is the only non-violent route, **every one** must have a non-magic
alternative somewhere in the same quest, and **≥90%** must carry a real `requires`. A magic
solution with no requirement is not a solution; it is a button.

And the negative bar matters as much: **magic must not become the skeleton key.** RI-QST05's
`VERB-SPREAD` rule caps any single `method` at 40% of all non-violent resolutions. Magic sits
under that cap and this item enforces its own, tighter, internal version, because "cast the
spell" is the most seductive universal answer a designer can reach for once the catalogue
exists.

## The reference artifact

### A. The census (targets are shares; absolutes are at the ~200-quest ship target)

Quest total `Q` is owned by `corpus/30-quests/` (RI-QST07 §B: ≥5.5 × N side quests at N ≈ 14,
side quests 35–45% of all quests ⇒ **`Q` ≈ 180–230**). All targets below compose with whatever
`Q` turns out to be.

| # | Metric | Definition | Target | Hard fail |
|---|---|---|---|---|
| **Q1** | `MAGIC-RESOLVED` | quests with ≥1 resolution where `method == "magic_utility"` | **≥ 11% of `Q`** (≥ 22 at 200) | < 6% (< 12 at 200) |
| **Q2** | `MAGIC-NONVIOLENT` | of Q1's resolutions, share with `violence_required: false` | **≥ 85%** | < 60% |
| **Q3** | `EFFECT-SPREAD` | distinct effect ids appearing across all magic resolutions | **≥ 14** | < 8 |
| **Q4** | `NO-SKELETON-KEY` | share of magic resolutions held by the single most-used effect | **≤ 22%** | > 40% |
| **Q5** | `SCHOOL-SPREAD` | all four schools present; each on ≥ 4 quests; none > 45% of magic resolutions | **4 / ≥4 / ≤45%** | any school absent, or any > 60% |
| **Q6** | `MAGIC-ONLY-NONVIOLENT` | quests where magic is the **only** non-violent route (combat remains available) | **4 – 10** | 0, or > 14 |
| **Q7** | `GATED` | magic resolutions with a non-empty `requires` | **≥ 90%** | < 70% |
| **Q8** | `ALTERNATIVE-EXISTS` | magic resolutions whose quest has ≥ 1 non-magic resolution | **100%** | < 100% — **any breach is a lockout** |
| **Q9** | `TRAVERSAL-QUESTS` | quest resolutions requiring `levitate` or `slowfall` | **≥ 3** | 0 |
| **Q10** | `TRAVERSAL-ROUTES` | map routes reachable only-or-most-easily by `levitate`/`slowfall` | **≥ 6** | < 3 |
| **Q11** | `WEIGHT` | Q1 quests in `category: "main"` or `"faction"` | **≥ 6** | < 3 |
| **Q12** | `KNOWLEDGE-MAGIC` | magic resolutions that also require `requires.knowledge` (a spell *plus* a fact) | **≥ 5** | 0 |

**Q9 and Q10 discharge RI-MAG02 §F5's load-bearing assertion for levitation.** They are here
rather than there because they are quest-and-world data, not effect data.

### B. What magic contributes to the ≥45% bar

RI-QST05's `PACIFIST-ALL` target is **≥45% of `Q`** — 90 quests at `Q` = 200. Q1 requires ≥22 of
them to have a magic route, and Q2 requires ≥85% of those routes to be non-violent.

> **Magic therefore supplies at least ~19 of the ~90 quests the ≥45% bar needs — a little over
> a fifth of it — and it is the second-largest single contributor after persuasion.**

This is stated as a number precisely because it is the thing that will be quietly lost. If
magic ships as a combat system only, RI-QST05's bar has to be met entirely by talk, sneak,
theft, bribe and lore — and it will be met by *talk*, because talk is cheapest to author. The
result passes `PACIFIST-ALL` and fails `VERB-SPREAD`, and the diagnosis will be "speechcraft
solves everything" when the actual cause was a missing magic system two areas away.

### C. The eight solution shapes (each must appear on ≥ 2 quests)

Diversity is not achieved by counting effects; it is achieved by counting **kinds of solution**.
Eight shapes, each with a worked example from our own catalogue:

| # | Shape | Effects | Worked example |
|---|---|---|---|
| **S1** | **Access** — a lock, a seal, a barred window, a grate | `open_lock` `corrode` `telekinesis` `shatter` | The ledger that proves the smuggling is behind a tier-3 warded door. Security 40 also opens it. So does buying the key from a drunk. |
| **S2** | **Traversal** — a place you otherwise cannot reach | `levitate` `slowfall` `buoyancy` `breathe_water` `leap` `frost_damage` | The wreck is under nine metres of tidal water. `breathe_water`, or an Argonian PC, or wait for the 12-minute tide (WLD05 element 21). |
| **S3** | **Concealment** — get in and out unseen | `invisibility` `chameleon` `muffle` `false_face` | The Deep-Kin conclave admits no foreigner. Wear a borrowed scale, or earn rank 4, or be told a name by someone inside. |
| **S4** | **Social** — change what someone thinks or does | `charm` `demoralise` `frenzy` `calm_beast` | The witness will not testify. Charm her, bribe her (225 g at +20 disposition), or find the thing she is afraid of. |
| **S5** | **Knowledge** — learn a fact no NPC will tell you | `speak_to_the_dead` `detect_key` `detect_life` `hist_sight` | Ask the corpse who paid him. The ledger says the same thing, if you can read Jel. |
| **S6** | **Survival** — outlast an environment | `resist_element` `resist_disease` `cure_disease` `breathe_water` | The kiln-city's flues are hot on a cycle. Resist, or time it, or pay a Naga to walk you. |
| **S7** | **Denial** — stop something from happening | `silence` `paralyse` `lock_lock` `wall` | The ritual completes in ninety seconds. Silence the speaker, kill the speaker, or convince the congregation to leave. |
| **S8** | **Repair / restoration** — put something back | `mend_item` `restore_attribute` `cure_paralysis` `restore_health` | The heirloom is broken and the family will not talk to a stranger holding it in pieces. Mend it, pay a smith 110 g, or admit what you did. |

Every worked example above states **the non-magic alternatives**, because Q8 is 100% and there
are no exceptions. Magic is a *route*, never a *requirement* — RI-PRG03 method 8's no-lockout
rule applies to spells exactly as it applies to lockpicks.

### D. The `requires` extension this item needs

`quest.schema.json` already has `method: "magic_utility"` in its resolution enum — the hook
exists. What it does not have is a way to say **which effect**. Without that, Q3, Q4, Q5, Q9
and Q12 are all unmeasurable, and the item fails closed.

**Requested (of the quests owner):** add to `resolutions[].requires`:

```jsonc
"spell_effects": {
  "type": "array",
  "items": { "type": "string" },
  "description": "Effect ids from corpus/25-magic/data/effects.json that this resolution requires the player to be able to cast or trigger (spell, scroll or enchanted item). Drives RI-MAG04's diversity metrics."
}
```

**Fallback until it lands** (and the analyser must implement both paths): treat a resolution as
magic-identified if `method == "magic_utility"` **and** either `requires.skills` names one of
`sorcery` / `root_speech` / `warding` / `veiling`, **or** `requires.items` contains a token
matching `^spell:` or `^enchanted:`. Under the fallback, **Q3/Q4/Q5 score 0 (fail-closed)** and
the verdict must record the gap — a diversity metric computed from school skills alone cannot
tell `open_lock` from `levitate`.

### E. The AR-3 crossing — stated explicitly, as the brief requires

**This item is a direct AR-3 seam-crossing contributor.** AR-3 asks whether a piece creates or
carries at least one interaction that crosses the fight boundary. This one carries several, in
both directions, and each is demonstrable in a single trace or transcript rather than inferred
from a data file (CRITIC-DOCTRINE §1.2's evidence rule):

| # | Crossing | Direction | Demonstration |
|---|---|---|---|
| **X1** | A spell learned outside the fight ends a fight without a corpse (`demoralise`, `calm_beast`, `paralyse` → MB-10) | world → fight | One trace: `COMBAT` entered, no `death` event, all hostiles de-aggroed |
| **X2** | A corpse produced by a fight becomes a `requires.knowledge` key for a non-violent resolution (`speak_to_the_dead`) | fight → world | One transcript: kill, cast, journal entry, resolution unlocked |
| **X3** | A quest resolution changes an encounter's composition — silencing the ritual (S7) removes the summoned adds from the boss fight | world → fight | Two traces at different quest stages; enemy roster differs |
| **X4** | An out-of-fight buff moves the player across RI-CMB01's `LIGHT`/`MEDIUM` roll cliff mid-fight (`feather`) | world → fight | One trace: equip-load tier and i-frame count both change |
| **X5** | A faction rank opens the spellwright who sells the effect that solves an unrelated quest | world → world → fight | Transcript chain across three quests |
| **X6** | Root-theft (`soul_trap`, a combat action) moves province-wide disposition and closes a questline | fight → world | Diff of NPC disposition records and faction flags across 15 traps |
| **X7** | A lore fact — wamasu arc through standing water (WLD05 element 13) — is also a boss-arena tactic | world → fight | One trace in a flooded arena, `shock_damage` chaining |

**Reporting obligation.** A critic scoring this item must record these in the RI-CMP01
cross-system payoff matrix, and **must not** mark this item `seam_sterile`. If fewer than **4**
of X1–X7 can be demonstrated in play, the item is below bar regardless of the census — the
census can be satisfied by data alone, and data alone is exactly what AR-3 exists to catch.

## Comparison method

Pure static analysis over `game/data/quests/**/*.json` plus five live verifications. No browser
needed for M1–M5. Script owed to `corpus/80-methods/`: **`m-mag04-quest-census.mjs`**.

**M1 — Schema conformance first.** Validate every quest file against
`corpus/30-quests/quest.schema.json`. **Any invalid file is excluded from the census and
reported** — a magic resolution in a file that does not validate is not evidence.

**M2 — The census.** Compute Q1–Q12 from §A. Reference implementation:

```bash
# Q1 MAGIC-RESOLVED
jq -s '[.[] | select(any(.resolutions[]; .method=="magic_utility"))] | length' \
   game/data/quests/**/*.json

# Q2 MAGIC-NONVIOLENT
jq -s '[.[].resolutions[] | select(.method=="magic_utility")]
       | (map(select(.violence_required==false)) | length) / length' \
   game/data/quests/**/*.json

# Q3/Q4 EFFECT-SPREAD and NO-SKELETON-KEY
jq -s '[.[].resolutions[] | select(.method=="magic_utility")
        | .requires.spell_effects // [] | .[]]
       | group_by(.) | map({effect: .[0], n: length}) | sort_by(-.n)
       | {distinct: length, top_share: (.[0].n / ([.[].n] | add))}' \
   game/data/quests/**/*.json

# Q7 GATED
jq -s '[.[].resolutions[] | select(.method=="magic_utility")]
       | (map(select((.requires // {}) | length > 0)) | length) / length' \
   game/data/quests/**/*.json

# Q8 ALTERNATIVE-EXISTS  -> must print nothing
jq -r 'select(any(.resolutions[]; .method=="magic_utility"))
       | select(all(.resolutions[]; .method=="magic_utility"))
       | "\(.id): LOCKOUT - every resolution is magic"' \
   game/data/quests/**/*.json
```

- **Assert each of Q1–Q12 meets its target; report each against both target and hard fail.**
- Q8's query must print **nothing**. Any line is a lockout and an automatic fail.
- Cross-check Q3/Q4/Q5's effect ids against `corpus/25-magic/data/effects.json`.
  **Assert every referenced effect exists** — a resolution requiring `mass_teleport` is a
  defect in the quest, not a new effect.

**M3 — The eight shapes (§C).** Classify every magic resolution into one of S1–S8 by its
effect set. **Assert every shape has ≥ 2 quests**, and **assert no shape has > 35%** of all
magic resolutions. **Assert zero resolutions land in `unclassified`** — an unclassifiable magic
solution is either a new shape (extend this item, CORPUS-CONTRACT §5) or a mislabelled combat
resolution.

**M4 — Traversal (Q9, Q10; discharges RI-MAG02 §F5).**
- Q9 static: **assert ≥ 3 resolutions require `levitate` or `slowfall`.**
- Q10 live: for each of the ≥ 6 claimed routes, run two harness passes — one with the effect
  available, one without — from the same start using the same input script.
  **Assert the route completes with the effect and does not complete, or takes ≥ 2× the path
  length, without it.** A "levitation route" that a good jump also clears is not a route.
- **Assert each route has a documented non-magic alternative** (a longer path, a key, a tide
  window). A route reachable *only* by levitation is a lockout and fails Q8's principle even
  though it is not a quest.

**M5 — Non-skeleton-key, live.** Take the 10 quests with the highest `stakes` that have a magic
resolution. For each, attempt the **same** effect that solved a different quest.
**Assert it does not work on ≥ 8 of the 10.** This is the behavioural version of Q4 and it
catches the failure Q4 cannot see: twenty quests each requiring a *different* effect id, all of
which are `open_lock` with a different label.

**M6 — Live verification (per RI-QST05's method; run once per wave).** Pick **10** magic
resolutions at random. For each, play it through in the harness using only the magic route.
- **Assert the quest reaches the declared `outcome`**, that the journal entry at
  `journal_index` is written, and that `consequences` fire.
- **Assert `getQuestState().completed` contains it and no `death` event occurred** where
  `violence_required: false`.
- **FAIL the item if any sampled resolution cannot actually be completed as written.** A
  resolution that exists only in JSON is the single most likely defect in this area and it is
  invisible to M2.

**M7 — The AR-3 crossings (§E).** Demonstrate X1–X7 in play, each with a named artifact (a
trace run id, or a transcript). **Assert ≥ 4 of 7 are demonstrated.** Record all seven in the
verdict with their evidence, and register them in RI-CMP01's matrix.

**M8 — Contribution to RI-QST05.** Recompute RI-QST05's `PACIFIST-ALL` and `VERB-SPREAD` twice:
once over the shipped data, and once with every `magic_utility` resolution deleted.
- **Report both.** **Assert the delta in `PACIFIST-ALL` is ≥ 8 percentage points** — that is
  what "magic supplies a fifth of the bar" means as a measurement.
- **Assert `VERB-SPREAD` does not exceed 40% in either computation.** If deleting magic pushes
  speechcraft over the cap, magic was propping up a monoculture rather than adding a verb.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Census Q1/Q2 | ≥ 14% of `Q`, ≥ 90% non-violent | ≥ 11%, ≥ 85% | < 6% of `Q` |
| Diversity Q3/Q4/Q5 | ≥ 18 effects, top share ≤ 18%, all schools ≥ 6 quests | ≥ 14, ≤ 22%, all schools ≥ 4 | < 8 effects, or top share > 40%, or a school absent |
| Shapes (§C) | all 8 shapes ≥ 3 quests, none > 30% | all 8 ≥ 2, none > 35% | ≤ 5 shapes present |
| Gating Q7 | ≥ 95% gated | ≥ 90% | < 70% — magic solutions are buttons |
| **No lockout Q8** | 100% | 100% | **any breach → automatic fail** |
| Traversal Q9/Q10 | ≥ 5 quests, ≥ 8 routes, all verified live | ≥ 3 quests, ≥ 6 routes | 0 quests, or < 3 routes — levitation shipped and opens nothing |
| Weight Q11/Q12 | ≥ 10 main/faction, ≥ 8 knowledge-magic | ≥ 6, ≥ 5 | < 3 main/faction — magic solves only side content |
| Live verification M6 | 10/10 complete | 9/10 | ≤ 7/10 — resolutions exist only in JSON |
| **AR-3 crossings M7** | 7/7 demonstrated | 4/7 | ≤ 3 → item is below bar regardless of census, and must be reported |
| Contribution M8 | `PACIFIST-ALL` delta ≥ 12 pp | ≥ 8 pp | < 4 pp — magic is decorative in the quest layer |

**Failure threshold: any axis below 6.** Two axes cannot be traded: **Q8 (no lockout)**, because
a build that cannot be finished without magic has broken RI-PRG03's no-lockout rule for every
non-caster; and **M7 (AR-3)**, because the census is satisfiable by a data file and AR-3 is the
failure no per-subsystem excellence detects.

## How we lose

- **Magic is added to the combat branch and nowhere else.** The default. Every quest gets a
  `combat` resolution, casters use spells in it, `magic_utility` appears zero times in the
  entire data set, and Q1 reads 0%. Every other magic item in this area can pass perfectly
  while this happens, because they measure the *system*, not its *use*. This item exists for
  this failure and it is the most likely one by a wide margin.
- **`method: "magic_utility"` is used as a label, not a route.** Twenty resolutions carry the
  tag, none of them is reachable in play, and M2 reads a beautiful census. M6's ten live
  completions is the only instrument that sees it, and it is the expensive check that gets
  skipped in a busy wave.
- **`open_lock` solves everything.** It is the most useful effect in the catalogue and it maps
  cleanly onto the most common obstacle. Twenty-two magic resolutions, eighteen of them a
  locked door. Q4 catches the labelled version; only M5 catches the version where they have
  been given eighteen different effect ids that all resolve to "the door opens".
- **Levitation ships and opens nothing.** Q9/Q10 exist because an effect with no route is an
  effect that was deleted by neglect — and because it is the exact way RI-MAG02 §F's ruling
  gets nullified without anyone deciding to nullify it. "We kept levitation" is not the claim;
  "six routes need it" is.
- **Magic solves side quests only.** It is easier to author a weird magic solution into a
  fifteen-minute side quest than into the main quest's act structure. Q11 is a floor for
  exactly this: if magic never decides anything that matters, it is a hobby.
- **Every magic resolution is ungated.** `method: "magic_utility"` with an empty `requires`
  means "you thought of it, so it works" — which is the RI-QST05 failure ("a speechcraft check
  with no requirement") wearing robes. Q7 at 90% is deliberately stricter than RI-QST05's 80%.
- **A lockout ships.** One quest whose only resolutions are magic. A non-caster reaches it in
  hour nine and cannot continue, and the bug report will say "quest is broken". Q8's jq query
  is one line and must be run every wave.
- **The `spell_effects` field never lands** and the fallback becomes permanent. Q3/Q4/Q5 score
  0 forever, the diversity requirement is unenforced, and `open_lock` quietly becomes the
  skeleton key while every runnable metric passes. The request in §D is the single highest-value
  cross-item dependency in this area.
- **The AR-3 crossings are asserted rather than demonstrated.** A verdict listing X1–X7 in prose
  with no run ids is precisely the evidence failure CRITIC-DOCTRINE §1.2 forbids, and it is what
  a tired critic will produce, because the crossings are *obviously* true from reading the
  corpus. They are not evidence until they are in a trace.

## Provenance note

**Every threshold in this item is `provenance: constructed`,** and `confidence` is **medium** —
deliberately lower than RI-MAG01–03, for one honest reason: **the census is a budget handed to
another agent, not a measurement.** Q1's "≥22 quests" presumes `corpus/30-quests/` ships ~200
quests; §B's "magic supplies a fifth of the ≥45% bar" is arithmetic on that presumption; Q10's
six routes presume `corpus/50-world/` builds them. **None of those three things exists yet.**
When they do, M2 and M8 must be re-run against shipped totals and this table amended. The
*shares* (11%, ≥14 effects, ≤22% top share, 100% alternative-exists) are the binding part; the
absolute counts are derived and must move to whatever the real quest total turns out to be.

One structural debt is `canonical-recall`, confidence **medium**: that Morrowind's quests were
frequently solvable with utility magic — Levitate into a locked tower, Open on a Telvanni door,
Charm past a check, Detect Enchantment to find the artifact, Almsivi Intervention to make a
timed delivery. The *fact* that this was possible is recalled; **no count, share or ratio here
is derived from Morrowind's data**, and none should be cited as such. RI-QST05 states honestly
that Morrowind's own non-combat share is a low-confidence 35–45% estimate; this item does not
improve on that and does not pretend to.

Values **inherited** and which must move together if they move at all: the `magic_utility`
method enum value, `violence_required`, `requires` and `resolutions` (**`quest.schema.json`**);
`PACIFIST-ALL` ≥45%, `VERB-SPREAD` ≤40%, `GATED` ≥80% and the live-verification protocol
(**RI-QST05 §B, §C**); `Q` ≈ 180–230 (**RI-QST07 §B**); the effect ids and their
`changes_quest_resolution` flags (**`corpus/25-magic/data/effects.json`**); levitation's
load-bearing requirement (**RI-MAG02 §F5**); the no-lockout rule (**RI-PRG03 method 8**).

The two decisions most worth re-litigating with evidence:

1. **Q1's 11%.** Chosen so magic contributes a fifth of RI-QST05's bar without threatening
   `VERB-SPREAD`. If the shipped quest data shows persuasion at 38% of non-violent resolutions,
   magic's share should rise, not persuasion's fall.
2. **Q6's 4–10 band on magic-only-non-violent quests.** The floor exists so magic is genuinely
   load-bearing somewhere; the ceiling exists because a non-caster must never feel that the
   peaceful route is closed to them. Both ends are taste judgements and both should be checked
   against a real non-caster playthrough (`PLAYTHROUGH-CRITIC.md`), which is the only instrument
   that can actually feel the difference.

### Amendments requested of other owners

- **Quests owner (`quest.schema.json`):** add `resolutions[].requires.spell_effects` as
  specified in §D. Without it, five of this item's twelve metrics are unmeasurable and score 0
  fail-closed. This is the highest-value single request from `corpus/25-magic/`.
- **RI-QST05 (quests owner):** §C lists `magic_utility` among the *supporting* verbs at a
  minimum of 4 quests. Requesting that minimum be raised to **≥ 22** and `magic_utility`
  promoted to a first-class verb alongside persuade/bribe/sneak/steal/lore, on the grounds that
  S19 makes it load-bearing for the ≥45% bar and §B quantifies the contribution.
- **World owner (`corpus/50-world/`):** Q10 requires **≥ 6 map routes** whose intended solution
  is `levitate` or `slowfall`, each with a documented non-magic alternative. Requesting they be
  authored and tagged in `game/data/world/pois.json` so M4 can find them without guessing.
- **Methods owner:** `corpus/80-methods/m-mag04-quest-census.mjs`, implementing M2's queries,
  M3's shape classifier and both the `spell_effects` path and the §D fallback.
