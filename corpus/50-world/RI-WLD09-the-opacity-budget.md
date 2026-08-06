---
id: RI-WLD09
title: The opacity budget — what the world refuses to explain, and the emptiness it is allowed to keep
kind: structure
side: morrowind
judges: [world.strangeness.budget, world.density.handplacement, world.map.legibility, world.wayfinding.directions, lore.book.unreliability, quests.mainline.prophecy, quests.discovery.hooks]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Every other bar in this corpus pushes toward legibility. RI-WLD06 requires ≥3 landmarks
from every settlement gate, 100% of junctions signposted, ≥9 of 10 journal destinations
reachable from prose. RI-DLG05 calls unnavigable poetry "exactly as bad as a coordinate".
RI-QST04 hard-fails a quest with no directions. RI-WLD02 makes it illegal to walk for 150
seconds without something asking to be walked to. Every one of those is right, and
collectively they describe a game that has lost the thing Morrowind is loved for. **A build
that passed all of them would be maximally legible: a marker system implemented in prose,
across a world with no dark in it.** AR-2 would never fire. The feeling would be gone anyway.

This item is the counter-bar. It requires, with numbers, that the world **refuses**:

- **24 registered unexplained things** — places, objects, creatures, phenomena and people that
  are never explained anywhere in the game. **A critic who finds an explanation has found a
  defect.**
- **12 assembled lore facts** — true things that exist only as the intersection of ≥3 sources
  and are stated by none of them, with the static analysis proving no single source says it.
- **3–6 unanswered questions in the main quest** — questions the game itself raises and
  declines to close.
- **≥14% of the landmass in declared void tracts** — sustained, authored emptiness, which also
  fixes wrong-bar **W2**, because RI-WLD02's global density floors currently make the Deep
  Marshes illegal and Vvardenfell was never uniformly dense.

And it solves the problem that makes all of that gameable. The obvious failure is leaving
things unexplained because nobody wrote the explanation, and **from inside the game those two
are identical** — in both cases, silence. The mechanism is a **sealed authorial answer**: every
registered mystery has a full, coherent answer written in
`corpus/50-world/sealed/SEALED-ANSWERS.md`, hashed, with the hash — and *only* the hash —
declared in `game/data/world/opacity.json`. A critic can prove the mystery was authored with
an answer, prove the answer is consistent with the evidence the player can find, and prove
the game never states it, **without the game ever revealing it**. Unbuilt content has no
sealed answer and cannot acquire one retroactively without breaking its seal.

## The reference artifact

### A. What Vvardenfell never explains

The standard being matched. `canonical-recall`, confidence medium — recalled from play, not
verified this session, and a critic must not cite these as measured.

| # | The thing | Still unexplained at the end of the game? |
|---|---|---|
| 1 | Where the Dwemer went | Yes. Four contradictory accounts, no resolution. |
| 2 | What the Dwemer machines in Bthungthumz, Nchuleftingth and the rest were *for* | Yes. You walk through the works and never learn the industry. |
| 3 | Whether the Nerevarine is a reincarnation or a very good coincidence | Yes, and deliberately: Vivec says one thing, Azura another, the Ashlanders a third. |
| 4 | What is actually inside the Ghostfence, before you go | Yes, until you go. |
| 5 | Why the Sixth House dreams reach some people and not others | Yes. |
| 6 | What Vivec is, mechanically and theologically | Yes, and the 36 Lessons make it *less* clear on purpose. |
| 7 | Who or what Yagrum Bagarn is waiting for | Yes. |
| 8 | Why Divayth Fyr has four "daughters" who are not daughters | Yes. Mentioned, never followed up. |
| 9 | What Umbra wants | Yes. |
| 10 | Whether the Tribunal's account of Nerevar's death is the true one | Yes. Two irreconcilable versions, both in-world documents. |
| 11 | Where the Dagoth brothers' bodies come from | Yes. |
| 12 | What the propylon index network was built to move | Yes. |
| 13 | Why Therana is like that | Yes, and it is better for it. |
| 14 | What the Cavern of the Incarnate actually is | Yes. |

Fourteen, in a game whose corpus is ~1.87M words. Note what is *not* on this list: nothing
here is unexplained because the writers ran out of time. Every one has a shape — a set of
partial accounts that constrain it without closing it. That shape is what §B reproduces
mechanically.

### B. The opacity register

Four categories, four separate counts, one shared verification mechanism.

#### B1 — Unexplained things: **24 sealed mysteries**

| Requirement | Value | Fail below |
|---|---:|---:|
| Registered mysteries, each with a sealed answer | **24** | 16 |
| — of kind `place` | ≥ 8 | 5 |
| — of kind `object` | ≥ 6 | 4 |
| — of kind `creature` | ≥ 4 | 2 |
| — of kind `phenomenon` | ≥ 3 | 2 |
| — of kind `person` | ≥ 3 | 2 |
| Encounterable in ordinary play (anchored to a POI, item or NPC on or near a route) | ≥ 18 | 12 |
| Encounterable in the first 3 hours | ≥ 6 | 3 |
| **With a quest, boss, reward or achievement attached** | **≤ 6** | > 12 |
| Sealed answer length | ≥ 60 words each | — |
| Evidence items per mystery | ≥ 3, in ≥ 2 content classes | 2 |
| Declared leak n-grams per mystery | ≥ 5 | 4 |

The **≤ 6 cap** is the most important row in the table. A mystery with a boss at the end of it
is a dungeon; a mystery with a reward is a puzzle. At least 18 of the 24 must pay nothing.

**The public half — `game/data/world/opacity.json`** (schema; a builder writes this, the
critic reads it, and it contains **no answers**):

```jsonc
{ "schema": "opacity@1", "mysteries": [
  { "id": "M-01",
    "name": "The Counting Obelisk",
    "kind": "object",                       // place|object|creature|phenomenon|person|event
    "anchors":  ["poi:counting-obelisk"],   // where the player meets it
    "evidence": ["npc:keeper-of-the-count", "book:on-the-tally-stones",
                 "poi:counting-obelisk", "dialogue:hist-speaker.dead-boles"],
    "reachable_hours": 4.5,                 // earliest encounter, from RI-EXP01's route
    "has_reward": false,                    // counts against the <=6 cap
    "answer_words": 106,                    // proves the answer is not a stub
    "seal": "7f7b6cee541869451a064b29c1cce75ab50edd5613f1304e5961851bae49225c" }
]}
```

**The sealed half — `corpus/50-world/sealed/SEALED-ANSWERS.md`.** Four worked entries are
written (M-01 The Counting Obelisk, M-02 the Kothringi mirror-town, M-03 the Valus Ridge rock
flutes, M-04 the breathing under the Deep Marshes); 20 remain and are marked WIP in that file.
Each carries the full answer, the evidence list with what each piece does and does not fix,
the leak n-grams, and the seal.

```python
seal = sha256((mystery_id + "\n" + norm(answer_text)).encode()).hexdigest()
norm = lambda t: re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", t.lower())).strip()
```

**Why this distinguishes designed opacity from absent content** — the four properties, and
which check proves each:

| Property | Designed opacity | Unbuilt content | Proven by |
|---|---|---|---|
| An answer exists | yes, in the corpus | no | `--seals`: a manifest entry with no sealed answer reports `NOANSWER` |
| The answer predates the audit | yes; editing it breaks the seal | n/a | `--seals`: recomputed seal ≠ recorded seal reports `SEALMISS` |
| The game does not state it | yes, provably | trivially, but vacuously | `--leak-scan`: n-gram + 5-gram-Jaccard over every string in `game/data/**` |
| Evidence exists and under-determines the answer | ≥3 artifacts, mutually consistent, insufficient | zero artifacts | M-OP3, the blind divergence test |

The last row is what an author cannot fake cheaply. Absent content has no evidence chain; a
mystery that has been over-explained has an evidence chain that *determines* the answer, and
M-OP3 fails it from the other side. The seal alone would be satisfiable by writing 24 answers
in an afternoon and pointing them at nothing; the evidence requirement is what makes the
register cost real world-building.

#### B2 — Assembled lore: **12 facts**

A fact that is true in the world, that a sufficiently attentive player can derive, and that
**no single source states**. Declared in `game/data/world/assembled-lore.json`:

```jsonc
{ "schema": "assembled@1", "facts": [
  { "id": "A-03",
    "claim": "the Blackrose fungus was introduced deliberately, by the prison's own builders",
    "sources": [
      {"id": "book:masonry-of-the-southern-marches", "class": "book",
       "contributes": "Imperial builders shipped southern limestone, not local stone"},
      {"id": "npc:blackrose-gardener",  "class": "dialogue",
       "contributes": "the fungus will not grow on local stone and never has"},
      {"id": "poi:blackrose-foundation","class": "geometry",
       "contributes": "the foundation courses are visibly a different stone from the walls"},
      {"id": "item:builders-ledger",    "class": "item",
       "contributes": "a spore consignment listed as 'mortar additive'"}],
    "load_bearing": "unlocks dialogue:warden.you-knew, which opens a non-combat resolution" }
]}
```

| Requirement | Value | Fail below |
|---|---:|---:|
| Assembled facts | **12** | 7 |
| Sources per fact | ≥ 3 | 2 |
| — facts requiring ≥ 4 sources | ≥ 4 | 2 |
| Distinct content classes per fact (`book` / `dialogue` / `item` / `geometry` / `observation`) | ≥ 2 | 1 |
| **Load-bearing** facts (deriving it unlocks a quest solution, a door, a dialogue option or a price) | ≥ 3 | 1 |
| Facts whose `claim` appears verbatim or in ≥0.35-Jaccard paraphrase anywhere in `game/data/**` | **0** | > 0 is a hard fail |

The load-bearing requirement is what stops assembled lore being trivia. Morrowind's version of
this is that knowing the Sixth House sleepers' pattern changes who you talk to; ours must have
at least three facts that *pay*.

#### B3 — Unanswered questions in the main quest: **3–6**

Declared in `game/data/quests/mainline.json` under `unanswered[]`, each with the exact
journal entry or dialogue node that raises it.

| Requirement | Value |
|---|---|
| Questions the main quest raises and does not answer | **3 – 6** (< 3 = the plot is a machine; > 6 = the plot is unfinished) |
| — of which the *player* explicitly asks an NPC, and is refused or evaded on-screen | ≥ 1 |
| — of which are asked by the antagonist about the player, not by the player about the world | ≥ 1 |
| Questions that are answered in a book but not in dialogue | ≤ 1 |
| Ending text that retroactively closes a declared unanswered question | **0** — a hard fail |

**Wrong explanations count as evidence, not as answers.** A world in which three NPCs give
three incompatible reasons for the same thing is *more* opaque than one that says nothing, and
it is also more alive. At least **8** of the 24 mysteries must carry ≥2 mutually incompatible
in-world explanations, each held sincerely by someone. Declared per mystery as
`false_accounts: ["npc:...", "book:..."]`, and each such account must fail the leak scan's
n-gram test *against the sealed answer* — a "wrong" explanation that is secretly the right one
is a leak.

#### B4 — Deliberate emptiness (this is wrong-bar **W2**'s fix)

RI-WLD02's D1/D2/D13 are global: TTNIT median ≤45 s, p90 ≤90 s, longest nothing-stretch
≤150 s, everywhere. Vvardenfell is not uniformly dense — Molag Amur, the deep Ashlands and
Sheogorad are long, hostile and empty, and that emptiness is where scale, dread and the relief
of arrival come from. A 150-second global cap forbids the Deep Marshes from being the Deep
Marshes, and the cheapest way to satisfy it is exactly the POI-sprinkling that RI-WLD02's own
M7 exists to catch.

**Declared in `game/data/world/voids.json`:**

```jsonc
{ "schema": "voids@1", "voids": [
  { "id": "V-01", "name": "The Drowned Reach", "region": "The Deep Marshes",
    "polygon": [[x,z], ...], "area_km2": 0.62,
    "reason": "dread",                       // closed vocabulary, below
    "payoff_poi": "poi:the-drowned-xanmeer", // what the emptiness makes feel earned
    "routes": ["track:deep-marsh-causeway"], // >=1 road/track enters or crosses
    "longest_empty_walk_s": 420,
    "witness_props": 5,                      // authored, NOT poi-tagged
    "landmark_visible_fraction": 0.94,
    "ambient_state": "deep-marsh-breath",
    "declared_wave": 1 }
]}
```

| # | Metric | Target | Fail |
|---|---|---:|---|
| V1 | Declared void tracts | **≥ 5** | < 3 |
| V2 | Minimum tract area | **≥ 0.30 km²** | any tract < 0.30 |
| V3 | Total void area as a share of the 14.52 km² landmass | **0.14 – 0.28** (target 0.147 ≈ 2.14 km²) | < 0.10 or > 0.32 |
| V4 | Longest straight-line walk inside a tract with no Tier A/B POI | **≥ 240 s** each | < 150 s |
| V5 | Share of road-network kilometres with TTNIT > 3 min | **≥ 12%** | < 6% |
| V6 | Regions with median TTNIT > 2 min | **≥ 2** | < 1 |
| V7 | `reason` drawn from the closed vocabulary `approach / crossing / threshold / hazard-field / dread / scale / relief` | 100% | any other value |
| V8 | Tracts with a named `payoff_poi` at or beyond their far edge | 100% | < 100% |
| V9 | Tracts entered or crossed by ≥1 declared route | 100% | < 100% |

**Suggested allocation** (constructed; sums to 2.14 km² = 14.7% of the landmass, drawn from
the five sparsest regions by RI-WLD02 §5's own Tier A+B/km² figures):

| Tract | Region | km² | Tier A+B/km² of the host region | reason |
|---|---|---:|---:|---|
| V-01 The Drowned Reach | The Deep Marshes | 0.62 | 25.4 | dread |
| V-02 The Ridge Walk | Valus Ridge | 0.48 | 20.5 | scale |
| V-03 The Salt Pan | Stone Wastes | 0.39 | 29.6 | hazard-field |
| V-04 The Kiln Flats | The Clay Moor | 0.31 | 28.4 | crossing |
| V-05 The Long Tide | Eastern Rootlands | 0.34 | 22.9 | threshold |
| **Total** | | **2.14** | | |

**How a critic distinguishes designed emptiness from unbuilt world.** The manifest alone is
worthless — anyone can declare a void over land they failed to build. Five further tests, all
of which unbuilt terrain fails and authored emptiness passes:

1. **The route rule (V9).** A void must be *crossed*. Emptiness the player is invited into is a
   design decision; emptiness with no path into it is the edge of the map. Every tract carries
   ≥1 road or track leg from `game/data/world/pois.json`'s route graph.
2. **The payoff rule (V8).** Every tract names the specific POI its emptiness exists to make
   feel earned, and that POI must lie at or beyond the tract's far edge along the route. An
   unbuilt region has nothing on the other side of it.
3. **The witness-prop rule.** Inside a void: **≥6 authored, individually-placed, explicitly
   NOT `poi`-tagged props per km²** — a cairn, a bone, a broken cart-wheel, a rope on a post,
   a burnt-out fire. They are deliberately excluded from RI-WLD02's D3 count so they cannot
   inflate density. This is the sharpest discriminator in the whole item: **emptiness that
   somebody walked through has litter in it, and unbuilt terrain is spotless.**
4. **The navigability rule.** ≥1 landmark silhouette visible from ≥90% of points inside a
   tract (RI-WLD06 L1's floor, relaxed from ≥2 to ≥1). Emptiness you cannot orient in is not
   dread, it is a bug, and it makes RI-WLD06's M29 unsatisfiable.
5. **The audio rule.** Each tract declares a distinct ambient state, present in the audio
   manifest and audibly different from its host region's default. `regions.json` already
   specifies the raw material — the Deep Marshes' *"NO birds. A low intestinal gurgle. A sound
   like breathing that is not yours"*, the Stone Wastes' *"near-silence broken by the tick of
   cooling stone"*. Unbuilt land ships the region default.

**Consequential amendment to RI-WLD02** (proposed, not applied here — see the dispatching
agent's reply): D1/D2/D13 become *settled-region* thresholds and are scored over the road
network **outside** declared void tracts; V5 and V6 are added as peers of D1; and the score-0
clause "D3 < 9 POIs per km of road" is scoped to non-void road kilometres. Inside a declared
tract, D13's cap rises from 150 s to 600 s and D9's hostile-group floor drops from 0.4 to 0.15
per minute. Without that amendment, this item and RI-WLD02 are in direct contradiction and a
critic must currently fail one of them.

### C. What may NOT be opaque (the boundary with RI-WLD06 and RI-DLG05)

Opacity is a budget, not a licence. The following remain fully legible and this item never
overrides them:

| Must stay legible | Owner |
|---|---|
| Every **quest destination**, reachable from the journal prose alone | RI-WLD06 M29, RI-DLG05 |
| Every **road junction**, signposted, with correct bearings | RI-WLD06 M28 |
| Every **mechanic the player must use** — no hidden systems, no unexplained controls | RI-JRN01 |
| Every **faction rank requirement** and its numbers | RI-PRG/quest items |
| The **cause of any death** | RI-CMB items |

Cross-rule, restated from BAR-CRITIQUE-01 and binding here: **RI-WLD06 M29 is scored only over
quest destinations and may never be extended to the world's total location set.** A critic
computing "percentage of all locations reachable from prose" has invented a bar that this item
forbids. Symmetrically, a mystery in the opacity register may never be the *only* route to a
quest objective — §B1's `has_reward: false` requirement on ≥18 of 24 and this clause together
keep the two budgets from colliding.

## Comparison method

**M-OP1 — Seal and leak audit (the primary instrument, fully automated).**
```bash
python3 corpus/80-methods/opacity-audit.py --all --game game/data \
        --json reports/opacity-audit.json
```
Four sub-checks, exit 1 on any failure:
- `--seals`: parses `corpus/50-world/sealed/SEALED-ANSWERS.md`, recomputes every seal, and
  cross-references `game/data/world/opacity.json`. Reports `SEALMISS` (answer edited without
  re-sealing), `NOANSWER` (declared in the game, no sealed answer — **this is the absent-content
  detector**), `UNSEALED` (answer exists, game does not declare it), `THIN` (<3 evidence),
  `SHORT` (<60-word answer), and the count against 24.
- `--leak-scan`: harvests every prose string under `game/data/**` (keys `text|body|line|
  response|entry|prose|greeting|rumour|description|note|inscription|journal`), then for each
  sealed answer asserts (a) zero occurrences of any declared leak n-gram, and (b) no game
  string with ≥0.35 character-5-gram Jaccard similarity to the answer. (b) catches paraphrase,
  which (a) alone does not.
- `--assembled`: §B2's counts, source-class spread, and the verbatim/paraphrase test on every
  `claim`.
- `--voids`: §B4's V1–V9 against `game/data/world/voids.json`.

Self-test performed 2026-08-06 against a synthetic `game/data`: a tampered answer produced
`SEALMISS`; a planted book containing "a tally of dead Hist" produced
`LEAK M-01 … books.json/books[0]/body`; an empty manifest produced the count failure.

**M-OP2 — The discovery diff (the behavioural test).** A fresh agent with **no access to
`corpus/`, no world data and no design notes** plays for 6 hours from the Lilmoth start, under
RI-MTH03's blind protocol, and keeps a discovery log. Diff its log against the register.
- **Pass: ≤ 40% of the 24 mysteries were encountered at all**, and **0 were explained**.
- **Fail:** > 60% encountered (they are not hidden, they are signposted), or the agent's log
  contains a correct statement of any sealed answer (the game leaked something the string scan
  missed — most likely through *placement* rather than text, which is why this test exists
  alongside M-OP1).
- Also record, for each mystery the agent *did* find, how it found it: `unprompted`,
  `overheard`, `book`, `NPC-with-no-quest`, `signposted`, `journal`. **≥ 12 of the 24 must be
  reachable only by the first four routes**; a mystery findable via `signposted` or `journal`
  is legible content wearing a costume.

**M-OP3 — The blind divergence test (proves under-determination, and it is the hard one).**
For 8 mysteries sampled at random from the 24:
1. Assemble a pack of **only** the declared evidence artifacts — the book pages, the dialogue
   lines, screenshots of the geometry — normalised per RI-DLG07 §A step 2. No sealed answer.
2. Give the pack to **three independent fresh judges**, separately, with:
   > "These fragments all concern one thing in a game world. In no more than 150 words, say
   > what you think is going on. Then say how confident you are, 0–10, and name the single
   > piece of evidence that most constrains your answer."
3. Give a **fourth** judge the same pack *plus* the sealed answer:
   > "Is this explanation consistent with every fragment? Answer YES or NO with the specific
   > contradiction if NO. Separately: could a reader reach this explanation from these
   > fragments alone? Answer CERTAIN / LIKELY / POSSIBLE / NO."

**Pass, per mystery:** the three blind judges produce **≥2 materially different hypotheses**
(under-determined) **and** judge 4 answers `YES` (coherent) with reachability `POSSIBLE` or
`LIKELY` (the evidence points somewhere without arriving).
**Fail:** all three judges converge on the sealed answer, or judge 4 answers `CERTAIN` — the
mystery is over-explained and is a puzzle, not a mystery. **Fail equally:** judge 4 answers
`NO`, or reachability `NO` — the evidence contradicts the answer, or points nowhere at all,
which is the signature of an answer written after the fact to cover absent content.
**Threshold: ≥ 6 of 8 pass.** A judge who has read `corpus/` is disqualified.

**M-OP4 — Assembled-lore derivation test.** For 4 of the 12 facts: hand a fresh agent the
declared sources *and nothing else* and ask it to state everything it can now conclude.
**Pass: ≥3 of 4 agents state the fact.** Then hand a second agent any **two** of the sources
and ask the same. **Pass: 0 of 4 state the fact from two sources.** This is the executable form
of "exists only as an intersection": derivable from three, not from two. Then run the
load-bearing check — for each of the ≥3 load-bearing facts, confirm from
`game/data/quests/**` that the unlocked node is genuinely gated on the derived knowledge and
not merely on visiting a location.

**M-OP5 — Void audit (V1–V9), on the M6 walk.** Re-use RI-WLD02's M6 scripted walk log; no
extra run needed.
1. Tag every logged position with its containing void tract, if any.
2. Compute TTNIT separately for void and non-void road kilometres → V5, V6.
3. From `game/data/world/pois.json`, count authored props inside each tract that carry an
   `authored: true` flag and **no** `poi` tag → the witness-prop rate.
4. Re-run RI-WLD02's M8 sightline test restricted to points inside each tract → the
   navigability rule.
5. From the M6 aggro log, compute hostile groups per minute inside tracts and confirm it is
   within the relaxed 0.15–0.9 band. A void with normal encounter density is not empty; it is
   a corridor with no scenery.

**M-OP6 — The negative screenshot pair** (`blind_pair: yes`). Take 8 screenshots from inside
declared void tracts (canonical camera contract, HARNESS §6) and 8 from a control set of
terrain that is *not* declared — including, if the build has any, terrain the team knows is
unfinished. Unlabeled, ask a judge:

> "Eight of these sixteen places were designed to be empty and eight were simply not finished.
> Sort them, and for each one you call 'designed', name the object in frame that told you."

**Pass: ≥ 6 of 8 of our declared voids sorted as designed, each with a named object.** A void
sorted as unfinished, or sorted as designed with no nameable object, is unbuilt land with a
JSON entry in front of it. This test and the witness-prop rule measure the same property twice,
once by count and once by eye, which is deliberate: the count is gameable by scattering six
identical rocks, and the eye is not.

**Requested harness / tooling extensions** (listed in the dispatching agent's reply per
CORPUS-CONTRACT §5 and HARNESS §10; none of these is optional for M-OP2/M-OP5):
1. `listEntities()` to return `name` and `tags[]` per entity, so the witness-prop rule and
   RI-WLD02's M7 can be computed from a run rather than only from static data.
2. A new trace event `discover` — `{"f":…,"type":"discover","poi_id":…,"tier":"A|B|C",
   "route":"unprompted|overheard|book|npc|signposted|journal"}` — emitted on first entry into
   a POI's discovery radius. M-OP2's route attribution is not computable without it.
3. `getQuestState()` to add `booksRead[]` alongside `topicsKnown[]`, so M-OP4's derivation
   test can confirm what the agent had actually read.
4. Three new `game/data/` files, with schema ids registered in `game/data/index.json`:
   `world/opacity.json` (`opacity@1`), `world/assembled-lore.json` (`assembled@1`),
   `world/voids.json` (`voids@1`).

## Scoring

Weighted mean of the check groups, each 0/1/2 = fail/pass/exceed. Weights: **M-OP1 ×4**,
**M-OP3 ×4**, M-OP2 ×3, B4/M-OP5 ×3, M-OP6 ×2, B2/M-OP4 ×2, B3 ×2.

| Score | Condition |
|---|---|
| 10 | 24+ mysteries sealed and clean; M-OP3 8/8; M-OP2 ≤30% encountered with 0 explained and ≥16 of 24 unprompted; V3 in band with 6+ tracts; M-OP6 8/8 |
| 8 | 24 sealed, audit clean; M-OP3 ≥6/8; M-OP2 in band; 12 assembled facts with ≥3 load-bearing; V1–V9 pass; M-OP6 ≥6/8 |
| 6 | 16–23 mysteries; M-OP3 ≥5/8; ≥7 assembled facts; ≥3 void tracts; ≤2 V-metrics below target |
| 4 | The register exists and is sealed but thin: <16 mysteries, or M-OP3 4/8, or emptiness declared but failing the witness-prop rule |
| 2 | A register exists with no seals, or seals with no evidence chains — the paperwork of opacity without the content |
| **0 — WE LOSE** | Any of: `opacity-audit.py --all` exits 1 on `--leak-scan` (the game states a sealed answer); any `NOANSWER` (content declared mysterious with nothing behind it); any `SEALMISS`; M-OP3 ≤ 3/8; M-OP2 finds any sealed answer stated in play; **zero content outside the signposted set** (every location is reachable from prose or a journal entry — the failure this item was created to prevent); assembled-lore claims stated verbatim in any single source; `voids.json` absent, or every declared tract failing the witness-prop or route rule |

**The score-0 clause "register entries that are merely hidden rather than unexplained"**, from
BAR-CRITIQUE-01, is implemented as M-OP3's `CERTAIN` failure plus M-OP2's route attribution: a
thing that is merely hard to find but fully explained once found is not opacity, and it fails
both.

## How we lose

- **Nothing is unexplained, because explaining is what a language model does.** The default and
  overwhelming failure. Asked to write a book about a ruin, an LLM writes a book that says what
  the ruin was for. Asked to write an NPC who knows about the obelisk, it writes an NPC who
  explains the obelisk. Every piece of content arrives pre-digested, the world becomes a
  Wikipedia with terrain, and no bar in this corpus except this one notices. `--leak-scan` is
  the mechanical defence and it will fire often.
- **Mystery that is really an unwritten file.** The failure this item's whole mechanism exists
  for: 24 things nobody explained because nobody wrote the explanation, dressed up as design.
  Detected by `NOANSWER`, by `THIN` (<3 evidence artifacts), and decisively by M-OP3 — an
  answer invented to cover a hole cannot be made consistent with evidence that was never
  authored to point at it, and judge 4 says `NO`.
- **Retro-sealing.** Ship the game, get the critique, then write 24 answers and hash them. The
  seal cannot detect *when* it was written — so the defences are structural instead: the
  evidence chain must already exist in `game/data/**` (M-OP1 resolves every evidence id), the
  false-accounts requirement means ≥8 mysteries need two *wrong* explanations authored into
  the world, and M-OP3's under-determination test fails an answer that the evidence does not
  actually reach. Retro-sealing 24 coherent answers over content built without them is more
  work than authoring them properly.
- **Opacity that is just missing signposts.** Hiding the same legible content behind a hill.
  M-OP3's `CERTAIN` clause and M-OP2's route attribution both fail it. The register is about
  things the game does not *explain*, not things the game does not *point at*.
- **Emptiness declared over land we ran out of time to build.** The exact reason V8, V9 and the
  witness-prop rule exist. A tract with no route into it, nothing on the far side, and no
  litter is unbuilt terrain with a JSON file in front of it, and M-OP6 asks a human to say so
  out loud.
- **Voids that make the world unnavigable.** Strip 2.14 km² of content and RI-WLD06's fresh-agent
  navigation test starts failing, because the landmarks were in the content. The ≥1-landmark-at-90%
  rule is the coupling, and it must be checked *inside* tracts specifically — a world-average
  sightline pass rate will hide a blind void completely.
- **The opacity budget colliding with the density budget and one of them silently winning.**
  ~~Right now RI-WLD02 forbids what §B4 requires. Until the proposed amendment lands, a critic
  handed both items must fail one of them, and will probably fail this one, because RI-WLD02
  is older and has a scripted walk behind it.~~ **RESOLVED wave 0 (corpus-audit): the amendment
  landed.** The residual risk is now the opposite one — a void declared over land nobody built.
  V1–V9, and the witness-prop rule in particular, are what catch that, and an undeclared or
  failing tract falls back to RI-WLD02's settled-region thresholds rather than escaping them.
- **Mysteries with loot at the end.** The easiest way to make a mystery feel "finished" is to
  put a reward in it, at which point it is a dungeon and the opacity is decorative. §B1 caps
  rewarded mysteries at 6 of 24.
- **A leak through placement, not text.** The string scan cannot see that the answer is
  obvious because the "unexplained" ruin has a Dwemer gear lying at its entrance. M-OP2 (a
  blind agent playing for six hours) and M-OP3 (judges reading the evidence) are the only
  instruments that catch it, and they are both expensive, which means they will be the first
  things skipped.
- **The sealed answers file shipped by accident.** A build script that copies `corpus/` into
  the deployed site, or a well-meaning agent that "improves discoverability" by moving the
  answers into `game/data/books/`. `--leak-scan` catches it; it must be run in CI, not by hand.

## Provenance note

- **`constructed` (binding).** Everything in §B, §C, the scoring table and M-OP1–M-OP6 is
  invented for this project. The counts (24 mysteries, 12 assembled facts, 3–6 unanswered
  questions, ≥14% void share, ≥6 witness props per km²), the composition quotas, the sealed-
  answer mechanism, the seal normalisation, the leak-scan thresholds (5 declared n-grams,
  0.35 Jaccard), the closed `reason` vocabulary and every pass/fail band are ours. They are
  binding regardless (CORPUS-CONTRACT §3): a constructed bar we can measure beats a real
  number we cannot.
- **`canonical-recall`, confidence medium — §A's fourteen Vvardenfell examples.** Recalled from
  play, not verified this session. The count of 14 is illustrative, not a measurement, and
  **must not be cited as one**; the claim that each of them is genuinely never resolved in
  `Morrowind.esm` + expansions has not been checked against the text this session. §A shapes
  §B's targets qualitatively; no number in §B is derived from it arithmetically.
- **`derived` — the void allocation table in §B4.** Areas and the Tier A+B/km² column are
  arithmetic over RI-WLD02 §5's per-region POI allocation and `corpus/50-world/regions.json`
  (`total_land_km2: 14.52`, read this session). The five host regions are the five sparsest by
  that table's own figures; the individual tract areas are constructed.
- **`derived` — the ambient-audio raw material** quoted for the Deep Marshes and Stone Wastes
  is read verbatim from `corpus/50-world/regions.json` this session.
- **The four worked sealed answers** in `corpus/50-world/sealed/SEALED-ANSWERS.md` are
  `constructed`. They deliberately anchor to content other items already specify — RI-WLD06's
  landmark hierarchy (the Counting Obelisk, the rock flutes), RI-WLD05's element 9 (the
  Kothringi mirror-town) and element 14 (voriplasm), `regions.json`'s Deep Marshes ambient bed
  — because opacity must be the unexplained residue of a world that was built, not a separate
  content type bolted on afterwards. M-04 is written specifically as the hardest case: a
  mystery with no reward, no boss, no quest and no resolution, included so that a critic
  cannot report it as unfinished content without having read the paragraph that answers them.
- **`opacity-audit.py` was self-tested this session** against a synthetic `game/data` tree
  (seal tamper → `SEALMISS`; planted leak → `LEAK`; empty manifest → count failure). It has
  **not** been run against a real build, because none exists yet; its exit codes and report
  shape are therefore `constructed` and confidence is high only for the seal and leak logic,
  which is exercised.
- ~~**Amendments proposed, not applied** (this item does not edit other agents' files):
  RI-WLD02 §2/§Scoring per §B4's "consequential amendment"; RI-WLD05 M24 per BAR-CRITIQUE-01
  W1. Both are recorded in the dispatching agent's reply.~~
  **APPLIED wave 0 (corpus-audit).** Both amendments are now in force:
  `RI-WLD02` D1/D2/D13 are settled-region thresholds scored outside declared void tracts, V5
  and V6 are peers of D1, the score-0 `D3 < 9` clause is scoped to non-void road kilometres,
  and inside a tract D13 rises to 600 s and D9's floor drops to 0.15/min. `RI-WLD05`'s M24 is
  re-thresholded to ≤12 with hour-10 and hour-18 completions. **This item and `RI-WLD02` are no
  longer in contradiction**, and the "until the proposed amendment lands" caveat in §How-we-lose
  is discharged. See `CORPUS-COHERENCE-01.md` §6–§7.
