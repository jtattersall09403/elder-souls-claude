# W1-F10-r13 — CRITIC

**Fourteen bodies became seventy-two, and it is not a naming trick. I built the crowd three
independent ways and got 72 every time — 72 names, 72 morph keys, 72 distinct vertex hashes — and
the round's own explanation for why it took the hard road survives the test I built to break it.
ART moves 2 → 4, the first time this item's design score has moved since it existed. FIDELITY does
not move and is not mine. The pair is 4 × 3 and the piece still fails at 3 against a threshold of 7,
because eleven of eighteen checks fail and the wardrobe half of this item has never been written.**

- Piece: `W1-F10-r13` · roadmap item **F10** · wave 1 · branch `codex/wave1-build-experiment`
- Judged at `f6f6c9e2`. `git status --short -- game/ tools/` returned clean for every judged path
  before I added my own instruments (HAZARDS §20c).
- Reference item: **RI-VIS10** (`side: morrowind`, `blind_pair: no`). RI-VIS08 **not run** —
  FIDELITY is the standing verdict's number, explicitly not mine.
- **Ordered pair: ART 4/10 × FIDELITY 3/10.** Never averaged (CC-5). `min()` = **3**.
- Status: **FAIL** (3 against a pass threshold of 7).

---

## What I did, and the one thing I could not

Every number below was produced by a command I ran this turn, or is labelled **CARRIED**. I wrote
four instruments of my own so that the round's count would be checked by code it did not write:
`f10-r13c-critic-probe.mjs`, `f10-r13c-critic-probe2.mjs`, `f10-r13c-c2-poolings.mjs`,
`f10-r13c-horn-orbit.mjs`. I shot my own eight-bearing orbit and portraits at the Lilmoth stand.

**Contention, said plainly (HAZARDS §29).** `node tools/contention.mjs` returned **GO — room for 3**
before my only browser launch and **GO — room for 4** at the start. It returned **WAIT** at 05:15
with my capture still running and three siblings resident. **I did not start a second browser**, and
that is why C3's live temporal arm is CARRIED below rather than measured by me. An offline
measurement that answers the question is worth more than a browser run that dies at 2.5 of 4
bearings, and this box has already eaten four agents' evidence in one night.

**No appearance claim.** SwiftShader, `W1-30-EVIDENCE §4`. My frames establish what is in shot,
which bodies are drawn, and whether they differ in outline. Nothing about how anything looks.

---

## Job 1 — the count is real, and the round's reason for the hard road is correct

### Three independent counts, and they agree

`tools/visual/f10-r13c-critic-probe.mjs`, over all 408 records built through the shipped
`makeRiggedActor(…, race)` → `poseFromRig` path:

| What is counted | How | Result |
|---|---|---|
| `characterId` — a **name** | stamped on the built meshes | **72** |
| `rigVariantKey` — the **morph numbers** | `variantKey(base, spec)`, `rigs.js:153` | **72** |
| sha256 over every **vertex position** in the built body | mine, not the round's | **72** |

`names_bought_free: 0`. `keys_with_identical_geometry: []`. **No body in this build is another body
under a second name, and no two morph keys produce the same mesh.** The round published the first
two; the third is mine, and it is the arm that a structural key alone cannot supply — two different
morph tuples could in principle build the same triangles, and they do not.

The round's own `f10-r9c-crowd-census.mjs`, re-run by me: rendered arm **72 distinct bodies / 72
structural keys / one per 5.67** against a required 34, largest bucket `sax.stooped-elder~wiry`
**13 = 3.2%** against a ceiling of 40. Both rendered sub-arms pass. Reproduced.

`characterPoolCensus()`, mine this turn: 29 archetypes × 3 cuts, family pools saxhleel 13 /
humanoid 11 / undead 1 / beast 2, race-scoped pools naga 2 · imperial 6 · dunmer 6 · nord 4 ·
breton 4 · khajiit 3, `unknown_ids: []`, **reachable upper bound 81 and 72 actually drawn** — so
nine reachable bodies no shipped record ever draws. Worth knowing when reading the 72.

### The line the brief asked me to test hardest — and it holds

The round says it *deliberately* used no scale axis, because a uniform scale is the one change
`C2`'s height-normalised masks and `variantKey` cannot see, i.e. the one no discriminator could
refuse. **Tested rather than read** (`f10-r13c-critic-probe2.mjs`, arm B1):

- **`variantKey` does not hash the scale axis at all.** `scale` is a declared `VARIANT_AXIS`
  (`rigs.js:36`), and `variantKey` (`rigs.js:153`) hashes `base | morph | material | sockets |
  clips`. Direct test: `variantKey('base.saxhleel', {scale:[1,1,1]}) ===
  variantKey('base.saxhleel', {scale:[3,3,3]})` → **true**. Invisible.
- **A genuinely uniform figure scale is invisible to the 120 px mask.** Every collected triangle
  multiplied by *k*, then the same height-normalised mask: at k = 0.85, 1.05, 1.15, 1.30 the mask
  IoU against the unscaled figure is **0.9988 – 0.9996**. C2's own discrimination threshold is
  *"no pair ≥ 0.93"* — so C2 would score a figure and a scaled copy of it as **the same figure**,
  by a margin of 0.07. Invisible.

**Ruling: the round's stated reason is correct, and it chose to be falsifiable when it did not have
to.** A scale axis would have inflated the count past every instrument in this item and no critic
could have refused it. That the round names the trap, declines the shortcut, and then hands a critic
the argument against itself is the behaviour the gauntlet exists to produce, and it should be said
plainly.

### But probe 1's first attempt was contaminated, and the contamination is a finding

My first arm applied the scale the way `renderer.js:801` applies `height_scale` —
`mesh.scale.setScalar(1.15)` on the built group — and the mask **moved** (front IoU 0.7913, C1 `R`
7.462 → 8.559, out of the 7.0–8.0 band). That verdict was **wrong**, and I am keeping it in the
artifact rather than deleting it, because the reason is a live hazard:

> `actor-orbit-holes.mjs:collectTriangles` reads a **SkinnedMesh** as `bone.matrixWorld ×
> boneInverse` (lines 116–135) and never applies the group's own `matrixWorld`; it reads a
> **non-skinned** mesh through `o.matrixWorld` (line 146), which does carry the group scale.

Measured on a saxhleel body: **3 skinned meshes and 55 rigid ones.** So `mesh.scale.setScalar()`
scales the equipment, the frills and the presentation pieces and leaves the body alone — world
height rose ×1.1296 for a requested ×1.15. **This is not evidence that a uniform scale is visible.
It is evidence that `height_scale` is not a uniform scale as far as every offline instrument in this
family is concerned** — and the round's own headline recommendation for the next round is
*"STATURE, AS DATA"* through exactly that field. Whoever takes it must check that the group scale
reaches the skinned body **in the browser** before spending a round on it. Filed as a secondary
observation, not scored.

---

## Job 2 — where the round refused to trade a requirement for a number

### E1 — the round is right to fail it closed, and it is right that the bar is the problem

Re-derived by me: **actor arm 32 distinct `actor` values for 408 records = one per 12.75 against a
required 34, `townsman` at 97 = 23.8% against a 10% ceiling.** Unchanged. E1 requires both arms.
**FAIL.**

The round declined to split `townsman` into three actor classes to move a visual count, because
`actor` is a dialogue key. I checked the claim rather than the conclusion: `converse.js:311,314,655,687`
and `sim/quest/topic-supply.js:308` select lines by it, and the greeting roots key on it. Splitting
it would silently change which greeting 97 people speak.

**My ruling: the refusal was correct, and I may not fix it by rewriting the bar.** The r9 amendment
that added the rendered arm says in its own words that `actor` *"reaches the simulation and never
reaches the camera; a census over it is counting a column no viewer can see"* — which is an argument
that the actor arm does not belong in a **visual** item at all. I agree with it. **And
`CRITIC-DOCTRINE` §1.3 forbids me from acting on it here, because an amendment that dropped the
actor arm would take E1 from FAIL to PASS and would therefore be the reason this build scored
higher.** A bar a critic writes may be the reason a piece fails and may never be the reason one
passes. So E1 stays FAIL, the finding is recorded for arbitration below, and the round's own
sentence — *"this is a corpus finding for a critic, not a bar for a builder to rewrite"* — is
exactly the right disposition.

### E4 and C2 — the impossibility claim, tested

**E4: 28 identical `(body, race)` pairs within 15 m**, from 93. Bar is 0; ≥ 3 is the fail line.
**FAIL**, and it is not close.

The round argues E4-at-zero and C2's no-pair-≥-0.93 are **jointly unsatisfiable** on one skeleton
with proportion-only variation. Both halves measured (`f10-r13c-critic-probe2.mjs` arm E, and
`f10-r13c-critic-probe.mjs` arm D):

**Half one — how fast does E4 actually fall?** Over the *real* same-settlement, within-15 m,
same-race adjacency graph (321 posted records, **751** same-race adjacent pairs), dealing each
person a body by `FNV-1a('npc:'+id) % P`:

| pool P | 5 | 9 | 14 | 24 | 36 | 50 | 72 | 100 | 150 | 200 | 300 | 400 | 600 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| identical adjacent pairs | 164 | 80 | 55 | 33 | 19 | 19 | 10 | 9 | 5 | 6 | **2** | 2 | 2 | 1 |

**Under 3 is first reached at P ≈ 300. Zero is not reached at P ≤ 900.** The round said "about 400";
my independent estimate is ~300 — same order, and the round's own figure was *conservative against
itself*. (My model reads 10 pairs at P = 72 against the shipped census's 28, because the shipped
pools are race-scoped: a nord draws from 4 archetypes × 3 cuts = 12 bodies, a naga from 6. The
global 72 is a sum over disjoint pools, which is what E5 asks for and what makes E4 harder.)

**Half two — does the closest pair really get worse as the pool grows?** Subsampling n bodies from
the reachable set, 24 random draws each:

| pool n | 5 | 9 | 14 | 24 | 36 | 50 | 72 |
|---|---|---|---|---|---|---|---|
| mean **max** pairwise IoU | 0.9069 | 0.9436 | 0.9548 | 0.9725 | 0.9745 | 0.9793 | **0.9806** |
| mean median IoU | 0.6125 | 0.6213 | 0.6363 | 0.6415 | 0.6416 | 0.6427 | 0.6453 |

**Monotone, and already over C2's 0.93 line by n = 9.** The median barely moves; the max is an
extremal statistic over a set E1 requires to grow.

**Ruling: the round's finding is real and correctly scoped, and it is not an excuse.** E4 at zero
requires a pool near 300–400 on this adjacency graph, and at that size the closest pair's IoU is
necessarily worse than the 0.9806 already measured at 72 — so C2's max clause and E1's growth
requirement pull in opposite directions on a fixed skeleton with proportion-only variation. **It
does not rescue E4**, which fails at 28 against a bar of 0 under any reading, and I score it FAIL.
It is a corpus finding, and it is recorded as one.

### C2, re-derived under all four poolings — because the round and I first disagreed

The round reports median **0.8074**, max **0.9905**, 698 of 5,112 pairs ≥ 0.93. My first pass got
median 0.6453 and max 0.9806 over 2,556 pairs. The difference is entirely how front and 90° are
combined, and RI-VIS10 C2 is ambiguous about it. So I measured all four
(`f10-r13c-c2-poolings.mjs`, 72 bodies, pose held identical, RES 640):

| reading | pairs | median | max | ≥ 0.93 |
|---|---|---|---|---|
| **pooled** — front and 90° as separate pairs (the round's) | 5,112 | **0.8076** | **0.9917** | 703 |
| averaged — the two views averaged per pair | 2,556 | 0.6453 | 0.9806 | 114 |
| front only | 2,556 | 0.8825 | 0.9917 | — |
| 90° only | 2,556 | 0.5184 | 0.9760 | — |

**The round's numbers reproduce** (0.8076 vs 0.8074; 0.9917 vs 0.9905; 703 vs 698 — rasterisation
resolution). **C2 FAILS on the max clause under every one of the four readings.** The median passes
only under the averaged reading, and **the round reported the stricter one** — it reported against
itself, which is the right instinct and is worth recording.

### D2 — first ever score on this check, and I re-ran every row

Every command re-run this turn:

| row | my command | result |
|---|---|---|
| plate cuirass / mail hauberk | `grep -n metalness game/src/render/actor.js` | **2 hits, both outside equipment** — `:2309` the held weapon, `:2666` the beast accent (`artFamily==='beast'?.16:0`). No equipment material carries metalness. **0** |
| heraldic tabard | equipment sets enumerated: `for(const set of ['reed','chitin','xanmeer'])` at `:1559` | **0** |
| pointed hood / wizard hat | the only head piece is `addEquip(set,'head','head',…)` at `:1593`, per set | **0** |
| horned helm | as above | **0** |
| pauldron-and-cape | `grep -ic cloak` = **0**; `grep -i cape` = 2 hits, both inside the word *"escaped"* at `:1818`/`:1819` | **0** |
| buckled jerkin with bracers | `grep -i buckle` = **8** hits: 7 comment lines (`:513,514,549,1017,1019,1598,1637`, all citing this very D2 row) and one code token, `'buckler'` as a shield **class** at `:2320` | **0** |
| tall cuffed riding boots | slots actually built: `back, chest, hands, head, legs` — **there is no foot slot** | **0** |

**One thing the round did not say and a future round must know: the pauldron row is a conjunction
and one half of it is arguably present.** In my own portrait `portrait-lilmoth-keeper-customs-b120.png`
the armoured saxhleel carries a large smooth tan ellipsoid on **each** shoulder, sitting proud of the
body with a hard edge — the `shoulder-scale` presentation piece — and at that range it reads as a
pauldron. The row scores 0 because it needs pauldron **and** cape and there is no cape. **Add one
cape and it flips to 1 and D2's pass becomes a fail.** 0 of 8 is not headroom.

**Total 0 of 8. PASS** — and I am stating the qualification the round also states, because it
matters: **a grep census is source, and `CRITIC-DOCTRINE` §1.1 forbids scoring a dimension from
source alone.** What earns this row is the combination: the greps above *plus* my own inspection of
eight orbit bearings and three portrait frames at 3.4 m, in which none of the eight forms appears —
no plate, no mail, no tabard, no hood, no horned helm, no cape, no buckles, no boots. **A critic
scoring D2 from grep alone should not, and the round's own sentence — *"this is a source census, not
a look"* — is the honest limit.** It proves the forms absent; it cannot prove that what *is* present
reads as Black Marsh, and §D's own answer to that is D1, which does not exist.

---

## Job 3 — the invented coordinates, re-derived, and one thing the round understates

Every figure below is mine, from a walk of the shipped files and `game/data/world/pois.json`:

- **All 16 `quest-witnesses.json` ids already exist in `mainline.json`.** 408 records, **392 unique
  ids, 16 duplicated**, every duplicate a `mainline.json` ∩ `quest-witnesses.json` pair.
- **The file's own `source` field is false for all sixteen**: *"People named by `deceit.revealed_by`
  who previously had no world record."* Every one has a world record.
- **15 of the 16 posts carried coordinates 5,120 – 9,727 m from the settlement each record names**
  (`captain-oreem` at 22 m is the only right one). The five Lilmoth ones sat 6,005–6,017 m out.
- The witness copies also carry a **different race** — `npc-eleen` is a breton in archon in
  `mainline.json` and a dunmer in lilmoth here; `npc-ineve-corrano` imperial/gideon vs
  saxhleel/lilmoth.
- **Four people stolen, confirmed:** of the five Lilmoth witnesses, **four** have their real record
  in Archon or Gideon (`npc-eleen`, `npc-skara-hull-chalk` → archon; `npc-ineve-corrano`,
  `npc-widow-tesla-vor` → gideon). `engine.js:populateSettlement` filters on `rec.settlement` and
  skips any id already spawned (`if (this.sim.findNPC(rec.id)) continue`), and `index.json` loads
  `npcs/mainline.json` (line 2227) **before** `npcs/quest-witnesses.json` (line 2313) — so whichever
  town is populated first wins the id. The round's account is correct.
- **The fix**: `pos`/`yaw` removed from the 15 wrong posts, no coordinates invented. Correct call —
  typing fifteen new positions is the defect that caused this.
- **`node tools/check-data.mjs` this turn**: *"408 NPC records, every settlement resolves (9 known
  places)"* — and it does **not** catch a duplicate id. Confirmed, and it should grow that arm.

**What the round understates, and it is a sharpening rather than a correction.** Its own note says
the records are still duplicates and *"which one spawns depends on iteration order"* — true. But the
consequence of *its own fix* deserves saying in one sentence: **the four people are no longer at sea;
they are now standing convincingly on Lilmoth doorsteps in a town they do not live in, with the wrong
race, while Archon and Gideon are still short by four.** The visible defect is fixed and the data
defect is now *harder to find*, because a person on a doorstep looks right and a person 6 km out to
sea does not. That is a real cost of a correct fix and the next round should know it.

---

## Job 4 — the five things it filed against itself

### The red self-test arm: diagnosis confirmed, and I can now decompose it exactly

`node tools/visual/f10-r12-crowd-motion.mjs --self-test` on this tree, my run: **14 of 15 arms
green, arm 2 red at 268 of 408 mismatched**, first mismatch `npc:npc-wuleen-kus`. Reproduced.

The round's diagnosis is that arm 2 reads every row on **one reused probe actor per family**. I
confirmed the mechanism from the source rather than the summary — `ensureBuilt` (`actor.js:2699`)
returns `A.built` on every later call, so a rename after the first pose does **not** rebuild the
body — and then **measured it**, in a control clone per HAZARDS §22 (`git archive HEAD`, running
**the clone's own copy of the tool**), patched only to record which rows mismatch:

```
MISMATCH_BREAKDOWN  total 268
  saxhleel | shared probe = true  | probe body stoop 0.85 → 260
  humanoid | shared probe = false | own body    stoop 1.15 →   8
```

**So the 268 decomposes exactly: 260 are the instrument and 8 are real.** The saxhleel probe is
built on the artifact's first row (`npc:npc-wuleen-kus`), lands on `sax.reed-widow~wiry` which
carries **stoop 0.85**, and is then cached and reused for all 260 saxhleel rows; the humanoid arm
builds a *fresh* actor per row and so reads each person's own body, of which **8** genuinely carry a
stoop and therefore genuinely differ from round 11. **The round's diagnosis is honest, not a
rationalisation** — and it did not have this decomposition, which is worth having: the residual 8
are a *correct* difference and the other 260 are noise.

Independently derived: **73 of 408 records carry a stoop** — values 0.85 × 23, 1.15 × 27, 1.25 × 23,
split 46 saxhleel / 27 humanoid. Matches the round exactly. Its own
`f10-r13-stance-preservation.mjs`, re-run by me: **335 of 408 reproduce, 73 mismatch, all 73 carry a
stoop, 0 do not**, and the required-to-disagree control with the age axis neutralised returns
**408 of 408** with identity fields 408 of 408 in both arms. The control disagrees, so the arm is
not a tautology.

**Leaving the red arm red was right.** A previous round's instrument going red on a later tree is
evidence; rewriting it deletes the evidence. Somebody still owes that tool a fix, and it should be
whoever next touches it — the general shape is worth a hazard entry, filed below.

### The other four

- **Its first census run returned an impossible number** (IoU 1.0000 between a humanoid and a
  saxhleel) and that is how it found the 16 duplicate ids. Confirmed in substance: the duplicates
  are real and I re-derived them. A discriminator returning an impossible answer is how this class
  of defect gets caught, and the round caught its own.
- **C2 fails.** Confirmed, under four readings.
- **The budget clause is still not closed as written** — sixth attempt across three rounds. I did
  not close it either and I did not try: the r12 critic established that a SwiftShader frame-time
  pair cannot answer a 5% clause at any n this box will give, and contention was at WAIT. The
  round's argument that it adds no per-frame work is sound from the code (`ensureBuilt` already
  built 408 geometries before this round; widening the pool changes which numbers are used, not how
  many builds happen) — **and it is an argument, not a number, exactly as the round says.**
- **The shoulder seam.** The round found `shoulder-scale` tracking girth but not shoulder width by
  opening a frame, fixed the geometry in the same turn, and recorded that the tan accent colour is
  not fixed. **My own post-fix portrait of the same subject at the same bearing looks
  indistinguishable from its pre-fix one** — the change is `M.build → M.build × M.shoulders`, which
  on the `wiry` cut is 0.90 × 1.08 = 0.972, ~3%, and this subject is not a `wiry` cut at all. More
  to the point: **the accent still reads as an applied brown lump with a hard elliptical edge that
  does not follow the deltoid**, at portrait range, and it is the most distracting single thing on
  the character. The round called the *colour* unfixed; **the form is also wrong**, and that is
  worth more than the colour.

---

## Job 5 — preservation, and looking at them

### Re-derived by me

- **C1 — PASS.** All 72 distinct bodies, my own masks: `R = H/h` **min 7.098 · median 7.449 · max
  7.838**, **72 of 72 inside the 7.0–8.0 default band**, 72 of 72 inside 6.0–8.5. World height
  1.7785–1.8188 m. Both pixel numbers published per body in `critic-probe.json`. Matches the round
  to three decimals. This is the clause that stops a body pool widened by stretching, and it holds.
- **The r12 self-test — 14 of 15 green on this tree**, my run, including arm 5 (planting within
  1 mm at five clocks over all 408), arm 6 (C3 arm b1 ≥ 90% at five clocks over all 408, 100.00%),
  arm 9 (the sporadic 24 → 84 clock, 0 of 120 starved, 8 of 8 buckets), and arms 4a/4b/4c with the
  frozen-rate control.
- **`node tools/harness/anim-tune.mjs`** — **0 of 14** over 0.35 m, worst `snapOut` **0.0122 m**
  (dagger:light), `snapIn` 0.0000 on all fourteen. The r9 preservation bound met to the digit.

### CARRIED, and declared

- **C3 arm (a) player, arm (b2-i)/(b2-ii) live, and arm (b2-iii) attribution** are the round's and
  the r12 critic's. **I did not run a second browser**, because contention returned WAIT (above). My
  own coverage is the offline arm 6 over all 408 at five clocks, which is (b1) on a larger
  population and not a substitute for the live temporal read. **A second critic is entitled to fail
  C3 closed on that, and if they do this build scores 6 of 18 and ART 3 rather than 4.** I say so
  here rather than in a footnote.
- **B2 (6 of 10), B3 (pass), B4 (1 of 7), D3 (2 of 8)** — carried from r10, not re-derived. I shot
  no character-against-a-void pair and rented no Pod.
- **B3's two out-of-range rows.** The round asked a critic to shoot `sax.hist-priest` (horn 1.85)
  and `sax.naga-broad` (horn 1.95) against a shipped maximum of 1.6. **I tried and could not isolate
  the feature** (`f10-r13c-horn-orbit.mjs`): there is no `horn` bone in the skeleton and no `horn`
  mesh part — the body is three merged skinned meshes (`actor-body:saxhleel:{cloth,skin,bone}`), so
  the horn is weighted into head-bone-dominated geometry and B3's "occluding contour" cannot be
  segmented by part label. What I *can* say: the morph reaches geometry — forcing `horn` to 0
  changes the head silhouette at **IoU 0.8928 at 0°** and **0.8743 at 30°** on `hist-priest`, and
  0.8741 / 0.8758 on `naga-broad`. **That is support, not a re-derivation, and B3 stays CARRIED.**

### And I looked at them

Eight orbit bearings and twelve portrait frames at the Lilmoth stand, my own capture, plus the
reference plate `refs/context/ESO-argonian_character__steam-1634540211.jpg`, opened (§A2: framing
and construction reference only; citing it as a design target is CC-2 and voids a verdict).

**The street reads as different people, and I did not need a measurement to see it.**

- **b045 — the single best thing in this round.** The row of four under the stilt-house overhang —
  the exact group the r12 critic named as the tell, where *"the two leftmost figures are the same
  body"* — is now four distinguishable builds. And bottom-right at ~15 m stands a figure whose
  **back rounds forward, head set in front of and below the shoulder line, over a visible mass on
  the upper spine.** That is the age axis, reading at gameplay distance, without an instrument, on
  my own capture. **Independently confirmed.**
- **b180** — three figures: a lean foreground humanoid with a pack strap across the back, a heavier
  armoured figure behind it with a plated torso, a smaller third further back. The two nearest could
  not be swapped.
- **The portrait** — the species is *built*: long snout, jaw line, amber slit eye, low crest, four
  separated claws per hand, cord wraps on both forearms, a bone toggle at the sternum. No brow
  ridge, no orbit rim, no nostril, no lip or mandible line, no chin underside — **consistent with
  B4 at 1 of 7**, confirmed by looking rather than carried blind.

**What is still wrong, and a picture says it faster than a number:**

1. **Nobody is doing anything.** 31 stands. The reference plate has a figure kneeling over a basket
   and a figure sawing; ours has 408 people standing. Not scored by any clause, and it is the next
   thing a viewer notices after variety.
2. **The frame is one value.** People and wall are the same desaturated olive, so silhouette is
   doing all the separating work and colour none of it. F1/F4/F13, not F10 — but it is why body
   variety carries more weight here than it should.
3. **At 15 m the garment is the least legible thing on any figure.** In the round's own b090 the
   slim figure against the wall has **no garment at all** — near-cylindrical stick limbs, shoulders
   barely wider than the waist, no cloth. It reads as an armature, not as a person of Black Marsh.
   **That is D1, and D1 is the named gap.**
4. **Not F10's, passed on:** the left-hand wall in b180 carries hard vertical banding across its
   whole face — my own frame, independently — which reads as a texture or filtering artefact rather
   than plank shadow. And 1 of 8 orbit bearings (b315) puts the camera inside building geometry;
   that is a limitation of the capture tool, not of the build.
5. **`character-refs.mjs --check`, my run: 252 files, 210 motion, 13 slots, D1 at n=4 — and slot
   C5, "full-body TURNAROUND / camera orbit of one humanoid, the owner's own example", is at
   n = 0.** It is the only empty slot, and it is the one the character directive names by name.

---

## The one named gap

**`GAP-W1-F10-seventy-two-bodies-and-not-one-of-them-is-dressed`** — see the verdict JSON for the
remedy, its DONE conditions and its S59 preservation clauses. In one line: **D1's garment vocabulary
does not exist, it has scored 0 for five verdicts, it is what makes D2/D3/D4/D5 arguable rather than
answerable — five of eighteen checks, 28% of this item — and it is what my own frames show.**

---

## What I could not do, as plainly as what I did

1. **B1, C4, D4 — no fresh judge.** `create_session` is approval-gated and rule 0 forbids it; a
   subagent cannot spawn subagents. **SIXTH consecutive F10 verdict.** 17% of this item's score has
   never been reachable by any critic this project has spawned. **The orchestrator owes all three
   and I owe none of them.**
2. **No second browser.** Contention returned WAIT at 05:15 (HAZARDS §29). C3's live temporal arms
   are CARRIED and a critic that fails them closed lands ART 3, not 4.
3. **RI-VIS08 not run.** FIDELITY is not mine and I make no claim about it.
4. **No paid hardware, so no appearance claim.** SwiftShader only.
5. **B2, B3, B4, D3 carried from r10**, not re-derived; and B3's two out-of-range horn rows I
   attempted and could not isolate.
6. **D5 has never been measured by anybody**, and I did not fix that.
7. **Lilmoth, not Helstrom** — sixth verdict running. Helstrom's 78 people are covered offline at
   100% and have still never been photographed.
8. **The budget clause** — I did not attempt it. Sixth attempt across three rounds would have been
   a browser run into a WAIT.
9. **I did not test whether `mesh.scale.setScalar()` reaches the skinned body in the browser.** My
   finding is that it does not reach it in the *offline* measurement path, and the next round's
   headline recommendation depends on the browser answer.
10. **My own capture was truncated, and HAZARDS §29 caught me exactly as it caught four agents in
    one night.** `f10-r11c-crowd-look.mjs` was killed by its 1700 s ceiling (exit 143) after 14 of
    its 23 frames and **before it wrote its manifest** — so the eight orbit PNGs and six portrait
    PNGs under `look/` have no camera pose recorded at capture time, and `CRITIC-DOCTRINE` §1.2 is
    explicit that a screenshot with no camera pose is an anecdote. I recovered by re-running the
    same tool minimally (`--bearings 0 --subjects 1 --pbearings 0`) into `look-census/`, which does
    finish and which writes both the manifest and the live crowd census. **The fourteen poses are
    derivable from that manifest — same stand, same knot, `orbitPos()` published in the tool's own
    source — and they were not written down by me at capture time, which is the honest label.**
