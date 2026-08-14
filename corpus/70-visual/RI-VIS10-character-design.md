---
id: RI-VIS10
title: Playable-race and NPC humanoid character design — is this a person from Black Marsh, or a human in a costume
kind: number
side: art-direction
judges: [render.art.character, render.art.silhouette]
provenance: constructed
confidence: medium
blind_pair: no
---

> **SIDE DECLARATION: this item is `art-direction`.**
> Cited **only** under `JUDGEMENT SIDE: ART_DIRECTION` (RI-VIS01 §B), property **P10**.
> **This item cites no modern game as a design target.** Not Skyrim, not ESO, not Elden Ring. That
> is not squeamishness — it is RI-VIS01 **CC-2**, which voids any verdict citing a modern AAA
> reference under an ART_DIRECTION declaration. The modern character plates in
> `refs/characters/` reach our characters through **RI-VIS08**, on the fidelity side, where they
> belong. §A2 states the one bounded exception and its reversal condition.
> **And it does not cite Morrowind's characters as a quality target either** — RI-VIS08's refusal
> stands and is correct: 2002 characters are ~1,000 triangles. What this item takes from Morrowind
> is its *transposition logic* (RI-VIS05), not its meshes.
> **Interaction with RI-VIS08:** VIS08 asks whether the character is *well made*. This item asks
> whether it is *the right character*. A 60,000-triangle, beautifully weighted, perfectly blended
> figure that is a human with green skin fails here and passes there. Both checks run, and neither
> substitutes for the other.

## The bar

**The hole this fills, stated plainly.** `RI-VIS08` §D is titled *"the design/quality seam for
creatures — where this item stops"*, and it hands creature *design* to `RI-VIS05` §D4. But §D4 is
titled **"Fauna silhouette rules"** and is about fauna: its rules are *no horses, no wolves, no
bears*, its subject reads as *arthropod, reptile, or amphibian*, and its single humanoid sentence is
the naga — which it explicitly routes back to VIS08 §D as a **creature readability** bar. Read this
turn: `RI-VIS01` §A's property table calls itself *"exhaustive and closed"* across 28 rows, of which
`P04` is *"Creature design"* and `P02` is *"Silhouette language (buildings, props, **creatures**)"*.
`corpus/00-doctrine/subsystems.json` carries nine `render.art.*` subsystems — palette, silhouette,
architecture, creature, composition, weirdness, mood, flora, materials — and none for a person.
`corpus/22-character/` holds exactly three items, `RI-CHR01/02/03`, which are creation, standing and
birthsigns: mechanics and society, not design language.

**So: nothing in the corpus governed what a person in this world looks like.** The player is one.
Four hundred and eight NPCs are. This item is that bar, and until it existed every `F10` pass was
earned against an incomplete one.

**What it asks.** Three questions, in order of how badly they go wrong:

1. **Is this a Saxhleel, or a human wearing one?** The races of Black Marsh are reptilian. A
   character whose non-humanity is a texture and a head prop is the single most common failure, and
   it survives every fidelity check ever written.
2. **Does the body read as a person of this place at the distance the player actually sees it** —
   proportion, stance, silhouette at 3 m, 8 m and 20 m?
3. **Does the crowd read as a population, or as one man printed four hundred times?** Measured this
   turn: **32 distinct `actor` values serve 408 NPC records**, and the largest single actor,
   `townsman`, serves **97 of them** (derived by walking `game/data/npcs/*.json`).

**The rule that settles arguments here** is `ARBITRATION.md` §1 as `CLAUDE.md` states it: outside
the fight, **Morrowind wins**. Morrowind's Argonians are not "lizard people" — they are a
different *kind* of body, dressed by a culture that has never seen a European forest. That is the
target. Souls governs how they move in a fight; it does not govern what they are.

## The reference artifact

### §A — The seam: what this item owns, and what it hands off

| Question | Side | Item |
|---|---|---|
| Is the Saxhleel's non-humanity **geometry or paint**? | ART | **here, B3** |
| Are its scales rendered with correct **subsurface response**? | FIDELITY | RI-VIS08 §B6 |
| Is its **face** built — brow, orbit, nostril, jaw, crest? | ART | **here, B4** |
| Are its **eyes separate geometry with a catchlight**? | FIDELITY | RI-VIS08 §B8 |
| Is the **silhouette distinct from the next NPC's**? | ART | **here, C2** |
| Is the silhouette **free of visible polygon facets**? | FIDELITY | RI-VIS08 §B1 |
| Does the **clothing belong to a faction, a rank and a region**? | ART | **here, §D** |
| Does the cloth **respond to light differently from the metal beside it**? | FIDELITY | RI-VIS08 §B3 |
| Is the **crowd varied**? | ART | **here, §E** |
| Does the **animation** snap, slide, or hard-cut? | FIDELITY | RI-VIS08 §C |
| Is the **naga** shaped like something that could not be a person? | ART | RI-VIS05 §D4 (it is a creature there, by that item's own routing) |
| Does the **creature** read at 50 m? | FIDELITY | RI-VIS08 §D1 |

**The mnemonic, borrowed from RI-VIS01 §A and applied to bodies: ART owns *who this is*, FIDELITY
owns *how well it is built*.** A critic that finds itself measuring a triangle count, a texel
density or a blend length has crossed the seam and is writing a VIS08 finding.

### §A2 — The ESO ruling (bounded, reversible, and the reason it is written down)

`refs/context/ESO-argonian_character__*` — four close-range plates of somebody else's Argonians,
on disk since 2026-08-06 and routed to nobody by `RI-VIS09` §2. They are the closest reference this
project holds to the race it actually ships, and the owner named ESO by name as the quality standard.

**The ruling.** They are admitted **as construction-quality reference on the FIDELITY side only**
(RI-VIS08 §B, via `refs/characters/` slot D1). They are **not** a design target here, and a verdict
under this item that cites them as one is CC-2 and is void. On the design side their only legitimate
use is as a **divergence anchor** — the RI-VIS07 mechanism, run the other way: *how far are we from
ESO's Argonians*, where distance is the good direction.

**Why, and why not the obvious alternative.** The obvious alternative is to admit them as a design
target on the grounds that they are the only Argonians we have pictures of. `RI-VIS05` forbids it in
terms — the world must not converge on ESO's Murkmire — and the reason generalises to bodies: ESO's
Argonians are a 2014 MMO's reading of the race, smoothed toward a human armature so that shared
armour and shared animation rigs fit them. Ours does not have that constraint and should not inherit
its compromises. **Reversible:** if an independent critic demonstrates that our Saxhleel are failing
B1 (race legibility) *and* that ESO's solve the same problem in a way our lore permits, promote D1 to
a design reference and record the promotion here with the verdict that bought it.

### §B — Race identity: is this a person of this world, or a human with a head prop

Measured on the `refs/characters/` **C1** and **C2** counterparts — our own `character_closeup` at
≥ 40% of frame height, one well lit, one at night — for **one character per shipped race**
(`game/data/progression/races.json` lists ten: saxhleel, naga, dunmer, imperial, nord, breton,
redguard, khajiit, orsimer, bosmer), minimum five, and the player.

| # | Check | Instrument | Pass | Fail |
|---|---|---|---|---|
| **B1** | **Race legibility at 3 m** | Show a **fresh judge** (fresh context, no lore, no answer key) the 3 m still with all UI off, and the closed list of the ten race names plus *"a human"* and *"cannot tell"*. One still per race. **Publish the answer sheet.** | ≥ 80% named correctly | < 60%. **< 40% caps the item at 4** — if the player cannot tell what species they are looking at, no other design property is reachable |
| **B2** | **Non-human feature census** | Ten rows, each yes/no from the close-up: (1) skull elongation or snout; (2) crest, horn, frill or spine on the head; (3) non-human eye — slit or all-dark pupil, no human sclera triangle; (4) throat/neck plating distinct from the facial surface; (5) scale or plate flow that follows the body's forms rather than sitting as a tile; (6) non-human ear, or a deliberate absence with a visible auditory feature; (7) tail with its own root, taper and thickness change; (8) non-plantigrade leg, or a declared reason; (9) clawed hand with non-human finger count or proportion; (10) a jaw and mouth line that could not close like a human's. **Publish the ten answers per race.** | reptilian races ≥ 7/10; beast races ≥ 4/10; man/mer races n/a (skipped, not scored) | reptilian < 5/10 → **the race is a human with a head prop** |
| **B3** | **The features are geometry, not paint** | For every feature scored *present* in B2, take the orbit-30° pair (the same capture RI-VIS08 §B3 already requires) and check whether the feature's occluding contour moves against the silhouette between the two frames | ≥ 70% of present features are geometry, **and** crest, snout and tail are all geometry if present | any of crest / snout / tail is texture-only → **painted-on species** |
| **B4** | **The face is built** | Count facial landmarks that produce visible form shading under a 45° key: brow ridge, orbit rim, nostril or naris, cheek-to-jaw line, lip or mandible line, chin/jaw underside, crest or ear root. **Seven rows, published.** | ≥ 5 of 7 | ≤ 2 → **a smooth blank with a texture on it**. (Eyes are RI-VIS08 §B8 and are not counted here) |

### §C — Proportion, silhouette and stance

Measured on the **C3** and **C4** counterparts: our player and each humanoid archetype at 8–10 m on
the gameplay camera, and the eight-angle orbit with the whole figure in frame.

| # | Check | Instrument | Pass | Fail |
|---|---|---|---|---|
| **C1** | **Canon of proportion** | From the 0° orbit frame, measure total figure height `H` and head height `h` in pixels; `R = H/h`. **Publish both pixel numbers**, so a second critic reproduces `R` rather than re-eyeballing it. Each race should declare its target; absent a declared target the default band is **7.0–8.0** for man/mer and **6.5–7.5** for the heavy races (orsimer, naga) | inside the declared or default band | outside **6.0–8.5** → the figure is a child or a giraffe and no amount of texture fixes it |
| **C2** | **Silhouette distinctiveness across the roster** | Binary masks of every humanoid archetype at **120 px** figure height, front and 90°, using RI-VIS08 §D1's mask machinery. Pairwise IoU. (120 px, not §D1's 40 px: people genuinely are one blob at 40 px and penalising that would be a false finding) | median pairwise IoU ≤ **0.80** and no pair ≥ **0.93** | any pair ≥ 0.93 → two archetypes are the same figure in different colours |
| **C3** | **The stand is not a mannequin** | From the idle at frame 0 and frame 120: (a) shoulder-line tilt off horizontal, (b) hip-line tilt, (c) left-vs-right elbow angle difference. **Publish the three numbers at both frames** | ≥ 2 of the 3 exceed **3°**, and the two frames differ | all three ≈ 0 at both frames → an A-pose with the arms lowered |
| **C4** | **It reads at the distance the player sees it** | At 8–10 m, a fresh judge answers *"person, creature, or cannot tell"* and *"which way is it facing"*, per archetype | both correct on ≥ 90% of the roster | facing wrong → the figure has no front/back asymmetry, which at that range is the whole silhouette |

### §D — Dress: faction, rank and place

**This section needs a data artefact the project does not yet have and this item requires: a garment
vocabulary.** One table, `faction × rank × region → {silhouette, material, colour, fitting}`, in the
project's own data, derived from `RI-VIS05` §E's shape grammar and the faction list in
`game/data/factions/`. Until it exists, D1 scores **0**, not "unknown" — fail-closed, the same rule
RI-VIS08 §A applies to a missing trace field. Denominator throughout is the **32 distinct `actor`
values** in `game/data/npcs/*.json`.

| # | Check | Instrument | Pass | Fail |
|---|---|---|---|---|
| **D1** | **Every outfit maps to exactly one vocabulary row** | For each of the 32 actors, name the row its visible outfit maps to. **Publish the 32-row table.** Two rows, or none, is a miss | ≥ 90% map to exactly one row | < 60%, or the vocabulary does not exist → 0 |
| **D2** | **The generic-fantasy list is absent** | A closed list, counted across the roster: plate cuirass; mail hauberk; heraldic tabard; pointed hood or wizard hat; horned helm; pauldron-and-cape hero silhouette; buckled leather jerkin with bracers; tall cuffed riding boots | **0 occurrences** | **≥ 3 caps the item at 3.** This is CC-3's design-side twin: it is what "generic fantasy" actually looks like on a body, and it arrives one asset at a time |
| **D3** | **The required material vocabulary is present** | Eight materials from RI-VIS05 §D/§E: lashed cord, woven reed or rush, chitin plate, bone fitting, hide, river-shell, resin, wet-wood. Count how many appear on at least one shipped garment | ≥ 5 of 8 | ≤ 2 → the wardrobe is cloth and leather, i.e. anywhere |
| **D4** | **Rank reads at 20 m** | A fresh judge sorts six silhouettes at 20 m into three tiers: labourer / tradesman-or-soldier / office-holder | ≥ 5 of 6 correct | ≤ 3 → rank is carried only by colour, and colour is gone at 20 m |
| **D5** | **The clothes have been worn** | Per garment, at least one of: a dirt or damp gradient at the hem; a visible mend or patch; asymmetric wear at a contact point (shoulder, knee, cuff); a missing or mismatched fitting | ≥ 60% of the roster | ≤ 20% → everyone is dressed new, which is the tell of a kit that was never used by anyone |

### §E — The crowd: is this a population or one man printed 408 times

Denominators are computed, not asserted. The enumerating command is
`python3 -c "import json,glob,collections; …"` over `game/data/npcs/*.json`; the numbers below were
derived that way **this turn** and are the baseline a later run compares against.

**Baseline, 2026-08-14: 408 NPC records · 32 distinct `actor` values · largest bucket `townsman` =
97 · 88 distinct `(race, actor)` pairs · 10 races declared, 12 race strings in use.**

| # | Check | Instrument | Pass | Fail |
|---|---|---|---|---|
| **E1** | **Visual actors against population** | `distinct(actor) / count(npcs)` and `max(actor bucket) / count(npcs)` | ≥ 1 actor per 12 NPCs (**≥ 34** at n=408) **and** no actor above 10% of the population (**≤ 40** at n=408) | at the 2026-08-14 baseline this check **fails on both arms**: 32 actors, and `townsman` at 97 = 23.8% |
| **E2** | **Head variety inside one actor** | Count distinct head/face variants rendered under the single largest `actor` value | ≥ 4 | 1 → every townsman is the same man |
| **E3** | **Age and build spread** | Count distinct body archetypes rendered anywhere: child, slight, average, heavy, stooped-old | ≥ 4 | **1 caps the item at 3** — one body for a whole province |
| **E4** | **Adjacency** | One 60-second walk through the largest settlement. Count pairs of NPCs **on screen at the same time** sharing an identical `(actor, head, garment, scale)` tuple within 15 m | 0 pairs | ≥ 3 pairs → the duplication is not a statistic, it is visible in one shot |
| **E5** | **The rendered mix matches the data** | Compare the races visibly distinguishable on screen in one settlement against that settlement's `pop-<settlement>.json` | every race with ≥ 5% share in the data is distinguishable on screen | a race present in the data and invisible on screen → the roster is data-only, and RI-MTH07 CONSUMPTION is unmet |

### §F — The condensed tell list, ordered by how fast a viewer notices

1. **A human with a lizard head.** Body plan, proportion and stance are a stock humanoid; the species
   is a head mesh and a scale texture. B2, B3.
2. **Everyone is the same man.** One head, one build, recoloured. E1, E2, E3.
3. **Generic-fantasy wardrobe.** Leather jerkin, bracers, tabard, hood. D2.
4. **Brand-new clothes on a poor province.** No dirt, no mend, no wear. D5.
5. **Painted-on features.** Crest and scales are texture; the silhouette is smooth. B3.
6. **The mannequin stand.** A symmetric A-pose with the arms lowered, identical on every NPC. C3.
7. **Rank carried only by colour**, so it evaporates past 10 m. D4.
8. **A blank face.** No brow, no orbit, no nostril, no jaw line. B4.
9. **Proportion drift** — a 6-head figure that reads as a child, or a 9-head one that reads as a
   stretched doll. C1.
10. **Two archetypes with one silhouette.** The guard and the labourer are the same outline. C2.

## Comparison method

1. Emit the RI-VIS01 §B declaration: `JUDGEMENT SIDE: ART_DIRECTION`, `PROPERTIES UNDER JUDGEMENT: P10`,
   `PERMITTED REFERENCE SET: RI-VIS05 (Morrowind) + this item's own written bar`,
   `FORBIDDEN REFERENCE SET: RI-VIS02/03/08 and every file under refs/modern/ and refs/context/`.
2. **Enumerate the populations first, by command, and paste the commands and the numbers into the
   verdict.** Races from `game/data/progression/races.json`; NPCs and actors from
   `game/data/npcs/*.json`. A verdict that asserts a population without the command that produced it
   is the defect `CLAUDE.md` rule 0b names, and scores 0 for every check that used it.
3. **Capture, in the game, in motion.** The counterpart captures are named per slot in
   `corpus/70-visual/refs/characters/INDEX.md` §3: close-up lit, close-up dark, mid-distance on the
   real path, and the **eight-angle orbit** with the whole figure in frame. **Stills are not enough**
   — the orbit and the idle sequence are required by `CLAUDE.md`'s character directive, not by
   preference, and C3 and B3 cannot be answered without them.
4. **Look at the reference plates.** `refs/characters/` slots C1–C4 and D1 for what a well-made
   character looks like at each of these framings. Under this item they are *framing and construction*
   reference; they are never cited as a design target (§A2, CC-2).
5. Run §B, §C, §D, §E. **Every check publishes its census table.** A check whose census is not
   published scores **0**, not "unknown".
6. **Cross-file:** anything found here that is really about mesh quality, weighting, texel density,
   blending or IK is reported to the fidelity critic as an RI-VIS08 finding and is **not** scored
   here. Anything about a creature rather than a person goes to RI-VIS05 §D4 / RI-VIS08 §D1.
7. **No blind pair.** `blind_pair: no`, deliberately, and the reason is a property of the subject:
   a blind pair needs a comparable frame on the other side, and this item forbids a modern design
   target while Morrowind's characters are a *fidelity* mismatch so gross that a judge would be
   answering "which is higher resolution". A blind pair here would measure the tell, not the design.
   **If that changes** — if an art-direction-side character reference ever exists at comparable
   fidelity — this line is the one to revisit.

## Scoring

```
DESIGN = 10 * (checks passed) / 18          # B1..B4, C1..C4, D1..D5, E1..E5
```

A check that is not applicable to a given race (B2 on a man/mer character) is removed from **both**
numerator and denominator, and the reduced denominator is stated. A check whose census is not
published is **failed**, not removed.

| Score | Meaning |
|---|---|
| 9–10 | ≤ 1 check failing; no item from the §F tell list is present |
| 7–8 | 2–4 failing, none of them B1, B3, D2 or E1 |
| 5–6 | 5–7 failing, or one of B1/B3 failing |
| 3–4 | B3 failing (painted-on species), or D2 ≥ 3, or E3 = 1 |
| 0–2 | ≥ 3 of the §F top-five present, or fewer than 12 of 18 checks published a census |

**Hard fails, overriding the arithmetic:**
- **B1 below 40% race legibility → capped at 4.** If a fresh judge cannot name the species, nothing
  downstream is reachable.
- **B3: crest, snout or tail texture-only → capped at 3.** This is the design-side cardinal sin —
  the species asserted rather than built — and it is the one that survives every fidelity check.
- **D2 ≥ 3 generic-fantasy garments → capped at 3.**
- **E3 = 1 body archetype → capped at 3.**
- **Fewer than 12 of 18 censuses published → the item scores 0**, not "not assessed". Fail-closed,
  the same rule RI-VIS08 applies to a missing trace, and for the same reason: an unpublished census
  is indistinguishable from an unmeasured one.

**The inter-rater clause, which is this item's whole reason for being shaped this way.** Every check
above produces a **count over a stated denominator** or a **forced-choice answer sheet**, and both
are published in the verdict. If two critics differ by more than **2 points**, the disagreement is
resolved by **recomputing from the published censuses**, never by re-judging: at most one of them can
have miscounted, and the counts are on the page. If the censuses agree and the scores do not, the
defect is in this item's wording and the item is amended — that is a corpus finding, and it is worth
more than either verdict.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2.**
Derived from this item's own bands above. No threshold was changed to produce it.

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 (7 of 18 passing, or a hard fail) | 6 / 10 (11 of 18) | 8 / 10 (14 of 18, none of B1/B3/D2/E1) |

**Aggregation (a property of this item, not of the critic):** band.

**Failure threshold: < 6 blocks the wave** via the RI-VIS01 §E `min()` gate on ART_DIRECTION.

## How we lose

- **The fidelity critic passes it and nobody else looks.** RI-VIS08 can score 9/10 on a character
  that is a human with green skin — every one of its checks is about how well the mesh is made. This
  item exists because that pass was, until now, the only character verdict the project could produce,
  and it was being read as though it covered the whole question. **Both passes run, and the ordered
  pair is reported (CC-5); they are never averaged.**
- **The census is skipped because it is tedious.** Eighteen tables is real work. It is also the only
  thing standing between this item and two critics five points apart, which is the failure that would
  make it worthless. Guard: an unpublished census fails its check, and twelve unpublished censuses
  score the item 0.
- **"It's stylised."** CC-3 on the fidelity side; here it arrives as *"the simple faces are a
  deliberate look"*. The test that separates the real thing from the excuse is B3: a deliberate
  stylisation is **built** — the crest is geometry, the jaw is geometry, the proportion is a choice
  you can measure. An excuse is a texture.
- **ESO by osmosis.** The four ESO plates are the only Argonians anyone here has seen, and a builder
  who looks at them all day will produce ESO's Argonians. §A2 bounds it; the divergence anchor is the
  instrument; and if our Saxhleel start reading as an ESO recolour that is a finding under this item,
  not a compliment.
- **The wardrobe is authored once, for the hero, and the crowd gets a recolour.** This is the body
  version of RI-VIS08's *"a beautiful player and grey-box enemies"*. Guard: every denominator in §D
  and §E is the **whole roster**, and the score is not the player's score.
- **The garment vocabulary is never written**, so D1 sits at 0 forever and everyone treats it as
  background noise. It is one table. It is also the artefact that makes D2, D3 and D4 answerable
  rather than argued.
- **The item is applied to creatures.** It is not for them. A naga is a creature by RI-VIS05 §D4's
  own routing, and a critic scoring one here has crossed the seam in §A.

## Provenance note

`provenance: constructed`, `confidence: medium`.

**This item is authored, not discovered, and that is the honest label.** No external source was
consulted for a character-design standard, because none of the corpus's existing routes to one
survives contact: `RI-VIS08` refuses Morrowind for characters and stops at fidelity; `RI-VIS05` §D4
is fauna; `RI-CHR01/02/03` are mechanics; and every modern reference the project holds is barred from
the ART side by CC-2. **The bar had to be written. It was written here.**

**What is measured and what is invented, separately:**

- **Measured, this turn, by command:** the populations in §E — 408 NPC records across 18 files in
  `game/data/npcs/`, 32 distinct `actor` values, `townsman` serving 97, 88 distinct `(race, actor)`
  pairs, 10 races in `game/data/progression/races.json`. Reproducible by walking those files.
  The hole in §Bar — 28 rows in RI-VIS01 §A, nine `render.art.*` subsystems, three items in
  `corpus/22-character/`, RI-VIS05 §D4's title — was likewise read, not remembered.
- **Constructed:** every threshold. `≥ 80%` race legibility, `≥ 7/10` non-human features,
  `≥ 70%` geometry, `≥ 5/7` facial landmarks, the `7.0–8.0` head-count band, `IoU ≤ 0.80 / < 0.93`,
  `3°` of stance asymmetry, `≥ 90%` vocabulary mapping, `0` generic-fantasy garments, `≥ 5/8`
  materials, `≥ 60%` wear, `1 actor per 12 NPCs`, `10%` bucket ceiling, `≥ 4` heads, `≥ 4` builds.
  They were chosen to sit where a viewer starts to notice, and **not one of them has been validated
  against a measured population**, ours or anyone else's.
- **The instruments are standard**, not invented here: forced-choice identification with a fresh
  judge, IoU over binary masks (borrowed from RI-VIS08 §D1 at a different scale and for a stated
  reason), head-height canon of proportion, and census counting over an enumerated roster.

**Calibration path, in priority order.** (1) **B1 and E1 are the two that matter and the two that are
cheapest to check** — run B1's forced choice once and adjust the 80% if a fresh judge cannot hit it
even on a character everyone agrees is good; recompute E1's ratios after the first NPC-variety pass
and see whether 1-per-12 is reachable at all in a browser budget. (2) The head-count band should be
re-derived per race once the races have declared art, and may well need to differ for the naga.
(3) `IoU ≤ 0.80` at 120 px is the softest number here and the first one a critic will argue with;
it should be re-derived from the shipped roster's own distribution rather than defended.

**Untested.** No critic has run this item. Its inter-rater agreement is asserted by construction —
counts over enumerated populations, published answer sheets — and has never been demonstrated by two
critics scoring the same build. **The most likely correction** is that §D's five checks are the
subjective ones and that D4 and D5 in particular need either a tighter written rule or removal; if a
pair of critics diverges, that is where to look first.
