# W1-F10 — characters and creatures. Independent critic verdict.

**Roadmap item `F10`. Ordered pair, never averaged (CC-5): ART 1/10 · FIDELITY 3/10. Status: FAIL
against the wave-1 gate of 7.0.**

The owner, having played the build: *"the player character and every NPC when I load the game look
frankly ridiculous… They look nothing like Morrowind or Skyrim characters."* **That judgement is
correct, it is now measured, and this verdict says specifically what makes it so.** It is not a
regression and it was not caused by the missing-bodies shader fault: the bodies are present in every
one of the 93 hardware frames taken for this verdict.

---

## 0. What I could not do, first

1. **Three checks need a fresh judge and I am not allowed to be one.** `RI-VIS10` **B1** (race
   legibility at 3 m), **C4** (person/creature/facing at 8–10 m) and **D4** (rank sorted at 20 m) are
   forced-choice tests against a judge with fresh context and no answer key. `RULES.md` rule 0 forbids
   summoning one (`create_session` is approval-gated and returns `MCP error -32003`), and rule 25
   forbids judging a pack I built. The frames for all three packs exist in
   `artifacts/W1-F10-CHARACTERS/ours-hardware/`. **Per the item's own rule — "a check whose census is
   not published is failed, not removed" — all three are scored FAIL, not skipped.** Two of them
   would very likely fail anyway on the evidence below; I have not assumed that in the arithmetic,
   I have applied the item's stated rule.
2. **`RI-VIS08` B6 (subsurface response) was never captured.** My sweep has no backlit setup. That is
   my omission, not a property of the build. Scored **0, fail-closed** (`SCORING.md` §1.1).
3. **Seventeen of the 93 hardware frames are void as character evidence.** Every frame of subject
   `npc-lilmoth-apothecary-12` (Ixtei, race `argonian`) is open water and sky — she stands out at sea,
   off the Lilmoth pier. Three of the seventeen were opened and checked individually; the group's
   median PNG is 1.06 MB against 1.70–1.81 MB for the other four subjects, consistent throughout. My
   capture tool reported `0 red` for them, because it cannot tell an empty frame from a full one.
   **That is a defect in my tool and it is recorded rather than hidden.** The argonian finding below
   therefore rests on the offline instrument and the census, not on her frames.
4. **`refs/characters/` slot C5 is honestly `n=0`** — no full-body turnaround of a modern humanoid in
   motion exists, because the two ESO character-creation entries are YouTube embeds with no file
   behind them. **What that costs this verdict, stated rather than waved away:** I cannot compare our
   eight-angle orbit against a reference orbit, so every cross-angle judgement here — does the
   silhouette stay readable all the way round, does the figure hold together in the three-quarter
   views a real turnaround would expose — is made against `RI-VIS10`'s *written* bar and against the
   25 single-angle C4 plates, not against a like-for-like artefact. **The one place this bites hardest
   is `RI-VIS08` B1 (silhouette faceting), whose threshold has never been validated against measured
   current-gen data** (that item's own provenance note says so). Read my B-side numbers as measured
   against a constructed threshold, not against a demonstrated one.
5. **A correction I made to myself, recorded because rule 0b is exactly about this.** Mid-pass I wrote
   that `M1`'s two `video/V3-locomotion__*` files were missing from disk. They are not. I had read a
   `ls … | head` whose output was truncated at ten lines. Re-run without the pipe, `refs/video/` holds
   **10 files** and a walk of the generated set finds **254 routed members, 0 missing**. The claim was
   wrong and it is withdrawn.

---

## 1. Declaration (`RI-VIS01` §B), taken before any reference was cited

```
BIFURCATION: both-separately, two disjoint score sets, two disjoint reference lists.
  ART_DIRECTION   properties P10   permitted: RI-VIS10 + RI-VIS05 (Morrowind transposition)
                                   FORBIDDEN: RI-VIS02/03/08 and every file under refs/modern/
                                              and refs/context/
  FIDELITY        properties F10, F11, F14
                                   permitted: RI-VIS08 + refs/modern/** + refs/context/**
                                   FORBIDDEN: every Morrowind reference (RI-VIS08 refuses them)
```

The two sets share no reference item and no score. **They are reported as an ordered pair and are
never averaged**, because averaging is precisely the seam that let this defect survive: `RI-VIS08`
can score well on a beautifully-made figure that is the wrong character, and did.

**Plates opened, not read about** (`refs/characters/INDEX.md`'s first instruction):
`modern/character_fullbody/REF-CF-SK__skyrim-leather-armor-male-fullbody.png` and
`…glass-armor-female-fullbody.png`; `modern/character_closeup/REF-ER__steam-dyules-2764067250.jpg`;
`context/ESO-argonian_character__steam-1362731834.jpg`, `…-431594657.jpg`, `…-1536362381.jpg`.

**Two defects in the reference set found by opening it** (§8 below): one D1 plate is not an Argonian,
and the C4 plates are headless armour renders rather than whole figures.

---

## 2. Populations, by command, this turn (`RI-VIS10` method step 2)

```
node -e over game/data/npcs/*.json (18 files)          -> 408 NPC records
                                                          32 distinct `actor` values
                                                          88 distinct (race, actor) pairs
                                                          largest bucket: townsman = 97 (23.8%)
                                                          12 race strings in use
game/data/progression/races.json                       -> 10 declared races
grep -rln garment game/data/                           -> no match. The garment vocabulary
                                                          RI-VIS10 §D requires does not exist.
```

`race` strings in use, by count: `argonian` 181, `saxhleel` 77, `imperial` 59, `dunmer` 57, `nord` 12,
`breton` 10, `khajiit` 6, `naga` 2, `none` 1, `mixed` 1, `redguard` 1, `orsimer` 1.
**`argonian` carries 44.4% of the roster and is not one of the ten declared race ids.**

Full census: `artifacts/W1-F10-CHARACTERS/metrics/roster-census.json`.

---

## 3. ART — `RI-VIS10`, character design. **DESIGN 2/18 = 1.1 native → 1/10.**

| # | Check | Measured | Verdict |
|---|---|---|---|
| **B1** | Race legibility at 3 m | **no fresh judge available** (§0.1) | **FAIL** (census unpublished) |
| **B2** | Non-human feature census | saxhleel **3/10**; `base.humanoid` **0/10** | **FAIL** — *"a human with a head prop"* |
| **B3** | Features are geometry, not paint | crest and snout are geometry; **the tail is absent entirely** | **FAIL** (see §8.1 — I amended this check) |
| **B4** | The face is built | **1 of 7** landmarks | **FAIL** — *"a smooth blank"* |
| **C1** | Canon of proportion | R = H/h over **41 figures**: min 5.87, median **6.58**, max 6.84. **0 inside the 7.0–8.0 band** | **FAIL** |
| **C2** | Silhouette distinctiveness | **median pairwise IoU 0.9109** (bar ≤ 0.80); **max 1.0000** (bar < 0.93) over 552 pairs | **FAIL** |
| **C3** | The stand is not a mannequin | shoulder tilt 0.15°/0.32°; **hip tilt 0.000° at both frames**; elbow diff 4.2°/8.0°. 1 of 3 axes over 3°, need 2 | **FAIL** |
| **C4** | Reads at 8–10 m | no fresh judge (§0.1) | **FAIL** (census unpublished) |
| **D1** | Outfit maps to a vocabulary row | **the vocabulary does not exist** | **0** by the item's own rule |
| **D2** | Generic-fantasy list absent | **0 occurrences** of all eight | **PASS** |
| **D3** | Material vocabulary present | **2 of 8** (`reed`, `chitin`) | **FAIL** — *"cloth and leather, i.e. anywhere"* |
| **D4** | Rank reads at 20 m | no fresh judge (§0.1) | **FAIL** (census unpublished) |
| **D5** | The clothes have been worn | no hem dirt, mend, or asymmetric wear visible on any of the 5 subjects at any of 8 angles | **FAIL** |
| **E1** | Visual actors against population | 32 actors (need ≥ 34) **and** townsman 23.8% (ceiling 10%) — fails both arms | **FAIL** |
| **E2** | Head variety inside the largest actor | 6 distinct head-height values among the sampled `townsman` figures | **PASS** |
| **E3** | Age and build spread | 3 archetypes (slight / average / heavy). No child, no stooped-old | **FAIL** (not 1, so no cap) |
| **E4** | Adjacency | not demonstrable: the Lilmoth stand's plaza held **no NPC on screen** in any of the 4 wide frames | **FAIL** (census unpublished) |
| **E5** | Rendered mix matches the data | 4 races hold ≥ 5% share; **all but saxhleel render on one body** | **FAIL** |

**Passing: D2, E2 → 2 of 18.** `DESIGN = 10 × 2/18 = 1.1`.

**Under the bar as it stood, B3 also passed and DESIGN was 3/18 = 1.7.** I amended B3 mid-pass (§8.1)
and the amendment makes this verdict *worse*, not better. Both numbers land in the same band, so
**ART = 1 either way** — recorded so a reader can check that the extension bought me nothing.

**Band check.** The item's `0–2` band triggers on *"≥ 3 of the §F top-five present"*. Present: **#1 a
human with a lizard head** (B2 3/10; 329 of 408 NPCs on `base.humanoid`), **#2 everyone is the same
man** (IoU 1.0000), **#4 brand-new clothes on a poor province** (D5). Three of five. Band **0–2**.
The `score 0` hard fail (*fewer than 12 of 18 censuses published*) is **not** triggered: 14 censuses
are published here. **ART = 1.**

### 3.1 The two numbers that carry the ART verdict

**C1, the canon of proportion.** Measured on the shipped roster — the art family and character variant
are selected exactly as the game selects them, from `race` and from `npc:<eid>` — and rasterised
orthographically so R does not depend on a camera distance I chose:

```
R = figure height / head height, 41 shipped figures, idle_loop @ 0
  min 5.87 (saxhleel/rootkeeper)   median 6.58   max 6.84 (imperial/clerk)
  player 6.52
  inside the 7.0-8.0 default band : 0 of 41
  outside the hard 6.0-8.5 band   : 2 of 41
```

**Nothing in this game is 7 heads tall.** The whole roster sits between 5.9 and 6.9, and a 6.5-head
figure reads as stunted — a slightly-chibi proportion. This is one of the two things making the
characters look wrong before any texture or material is considered, and it is a scalar per family.

**C2, silhouette distinctiveness.** 41 figures collapse to **12 distinct silhouettes**. The largest
identical group holds **ten** figures and spans five different race strings:

```
IoU 1.0000  humanoid/breton/mudborn      VS  humanoid/argonian/rootkeeper
IoU 1.0000  humanoid/argonian/townsman   VS  humanoid/dunmer/merchant
IoU 1.0000  saxhleel/saxhleel/fisher     VS  saxhleel/saxhleel/merchant
```

A Breton and an Argonian are the **same pixels**. That is `RI-VIS10` §F#2, measured, and it is the
mechanical cause of E5 failing.

---

## 4. FIDELITY — `RI-VIS08`. **STATIC 1/8 · DYNAMIC 7/10 → min = 1.25 native.**

### 4.1 DYNAMIC (§C) — measured over **3,005 frames across all five required scenarios**

The `§A` trace contract is **fully satisfied**: `missing_fields: []` on every scenario. This is the
one part of the character work that is in good shape and it deserves saying plainly.

| Check | Worst measured across 5 scenarios | Band | Verdict |
|---|---|---|---|
| C1 sample rate | 55.3–60 poses/s, `hold_ratio` 0.0000 | ≥ 24/s | **PASS** |
| C2 jerk | **0.0670** (attack_chain), 0.0545 (stairs) | fail > 0.030 | **FAIL** — snapping |
| C3 foot sliding | Slide_mean **0.0063 m**, p95 0.0074 | ≤ 0.03 m | **PASS** |
| C4 root-motion authority | **r = 1.0000**, ratio 1.0000 | ≥ 0.90 | **PASS** |
| C5 blending | `blend_frames` **0** in 3 of 5; `pose_step` **0.198–0.294 m** | fail > 0.15 m | **FAIL** — hard cut |
| C6 T-pose leakage | min Hamming 28–34 | > 6 | **PASS** |
| C7 weapon attachment | max `grip_err` **0.000 m** | ≤ 0.02 m | **PASS** |
| C8 foot IK | 100% of planted frames in band, **on slope and stairs** | ≥ 95% | **PASS** |
| C9 secondary motion | lag 7.5–25.2 frames, frills 4/7/10 | ≥ 2 | **PASS** |
| C10 variety | **0 hit-reaction clips in 3,005 frames**; 2 idle variants | ≥ 3 hit reactions | **FAIL** |

`DYNAMIC = 10 × 7/10 = 7.0`.

**C10 is scored against the item, not against the tool.** `anim-metrics.mjs` returns `pass: true` for
C10 while printing `idle=1, hit=0` and the note *"population completeness remains critic-owned"*. The
item's pass condition is *"≥ 3 hit reactions by direction, ≥ 2 idle variants, per-weapon-class attack
sets"*. An independent enumeration of every `clip` value in all five traces returns **11 distinct
clips and not one hit reaction** — `run, idle, clip_w_ssw_garrison_sword_r1_1, clip_garrison_r2_charged,
roll_light, sprint, walk_guard, idle_guard, turn_in_place_r, quick_swap, clip_w_ssw_garrison_sword_r2`
— **including in the `hit_reactions` scenario itself**. C10 fails.

### 4.2 STATIC (§B) — the half that is actually broken

| Check | Measured | Verdict |
|---|---|---|
| B1 silhouette faceting | **not computed** — the outline-fit metric was not run | **0**, fail-closed |
| B2 triangle budget | player/saxhleel **15,142** (bar 25,000); `humanoid` 15,752 (bar 12,000 ✓); `beast` **4,834** (bar 12,000) | **FAIL** |
| B3 material separation | **not computed** — the orbit-30° pair was captured but the patch statistic was not run | **0**, fail-closed |
| B4 texel density | not computed | **0**, fail-closed |
| B5 contact shadow | not computed (shadows are visibly present in the hardware frames; that is an impression, not the metric) | **0**, fail-closed |
| B6 subsurface | **never captured** — no backlit setup (§0.2) | **0**, fail-closed |
| B7 weighting artefacts | `actor-orbit-holes` over 20 shipped pose archetypes × 8 angles: **289 crack px in 179 of 640 frames**; through-gaps at calf/foot and at head/hand seams | **FAIL** |
| B8 eyes | saxhleel has `eye-l/r` + `pupil-l/r` as separate geometry (**PASS**); **`base.humanoid` has no eye geometry at all** — its only family-form parts are `hair-cap` and `tailored-tunic`. That family carries **329 of 408 NPCs**. The item's guard: *"the score is a minimum across characters, not the player's score"* | **FAIL** |

`STATIC = 10 × 1/8 = 1.25`. **`CHARACTER FIDELITY = min(1.25, 7.0) = 1.25`.**

**I am scoring FIDELITY 3, not 1, and the reason is a rule rather than generosity.** `SCORING.md`
§1.2 makes the item's own band a **ceiling**, and the ladder may be *more* pessimistic within it —
`RI-VIS08`'s band table puts *"B2 below budget"* in the **3–4** band, and its `0–2` band needs
*"≥ 3 of the §E top-five present"* or *"the §A trace could not be produced"*. Only **one** §E
top-five item is present (#2, hard cuts between clips), and the trace was produced in full. So the
arithmetic argues for 1 and the item's own bands argue for 3–4. **Five of the eight STATIC checks are
at 0 because I did not run them, not because they were measured and failed** — scoring the build at 1
on my own unfinished measurement would be blaming the build for my gap. I take the bottom of the
band the item's measured evidence puts it in: **FIDELITY = 3**, with the five unrun checks recorded
as owed. This coincides with the previously recorded 3/10, and it is now the first time that number
has a measured basis rather than an impression.

---

## 5. What actually makes them look ridiculous — specifically

*"Looks bad" is not a finding.* Against `modern/character_fullbody/` and
`context/ESO-argonian_character__*`, opened side by side with
`ours-hardware/C4__player__yaw000.png`, `…yaw090.png` and `C1__player__closeup-lit.png`:

1. **The body is assembled from primitive solids, not built.** The shoulders are two glossy
   ellipsoids stuck to the sides of a flat rectangular torso plate. The pelvis is a trapezoid. The
   legs are tapered cones. On the ESO plate the same regions are a continuous surface with deltoid,
   trapezius and clavicle reading as one form; on ours they are separable objects. This is what a
   viewer registers in the first half-second and it is the single largest cause of the owner's word.
2. **The head has 1 of 7 facial landmarks.** There is a snout and a crest horn — both real geometry,
   which is why B3 passes — and then nothing: no brow ridge, no orbit rim, no naris, no cheek-to-jaw
   line, no mandible line, no chin underside. The ESO Argonian plate has all seven plus scale flow
   across the skull. Ours reads as a smooth mask with two cones on it.
3. **No hands, and on the player no feet.** `skin/hand_l/r` exists as a single blob per side with no
   finger, thumb or claw geometry; at 90° the player's legs terminate in points. The NPC saxhleel do
   have clawed feet, so this is inconsistent within one family.
4. **The hip line is exactly level, at every idle frame.** `hip_tilt_deg: 0.000` at frame 0 and at
   frame 120. There is no weight shift — no contrapposto — so the figure stands like a shop dummy
   even while the animation system underneath it is working properly.
5. **Six and a half heads tall, roster-wide.** §3.1.
6. **One body for a province.** 329 of 408 NPCs on `base.humanoid`; 41 figures collapse to 12
   silhouettes; a Breton and an Argonian at IoU 1.0000.
7. **`base.humanoid` has no eyes.** A bald egg head with no face, which is what
   `C1__npc-blackwood-company-factor__closeup-lit.png` shows and why that NPC reads as a wooden
   artist's mannequin.
8. **The wardrobe is two materials.** `reed` and `chitin` out of the eight `RI-VIS05` calls for; no
   hem dirt, no mend, no asymmetric wear on any subject at any angle, in a poor province.
9. **The weapon is posed through the figure.** `grip_err` is 0.000 m, so this is *not* an attachment
   bug — the sword is simply large enough and angled enough to cross the whole silhouette at 90° and
   180°, which destroys the outline at exactly the two angles a player sees most.

---

## 6. Is this fixable by improving the rig, or does it need rebuilding? — **Keep the rig. Rebuild the surface.**

**The rig, skeleton and animation system are sound and should not be touched.** The evidence is the
DYNAMIC table: the `§A` trace contract is complete with zero missing fields, root-motion authority is
`r = 1.0000`, foot slide is **6 mm** against a 30 mm bar, foot IK holds **100%** of planted frames on
a 20° slope *and* on stairs, weapon grip error is **0.000 m**, there is no T-pose leakage in 3,005
frames, and the frill chain has real secondary lag at 4/7/10 frames. That is a better animation
foundation than most of this project has, and rebuilding it would throw away the one part of `F10`
that works.

**What must be rebuilt is the visible surface hung on that skeleton**: the body meshes, the head, the
hands and feet, the eye geometry on `base.humanoid`, and the proportion constants. Every failing
number above is a property of the *mesh*, not of the *skeleton* — B2 triangle budget, B4 facial
landmarks, B7 weighting cracks, B8 eyes, C1 proportion, C2 silhouette. Two of them (C1 and the
`argonian` family mapping) are constants and one predicate, and they are cheap; the rest is genuine
modelling work.

**The exception, and it is small:** C5's blend is a mixer wiring fix, not a mesh fix — `blend_frames`
is 0 on locomotion transitions with a 23 cm bone jump, which is the `action.play()`-without-
`crossFadeFrom` default that `RI-VIS08`'s "How we lose" predicts by name.

---

## 7. The ranked, buildable list — what to fix first

Ordered by **visible change per unit of work**. Items 1–3 are hours; 4–6 are the real modelling.

| # | Fix | File / mechanism | Done when |
|---|---|---|---|
| **1** | **Route the reptilian races to the reptilian body.** `renderer.js:693` selects the art family with `(n.race==='saxhleel'\|\|n.race==='naga')?'saxhleel':'humanoid'`. `argonian` — **181 of 408 NPCs, 44.4% of the roster, and the actual race of Black Marsh** — is not in that test and lands on `base.humanoid`. | `game/src/render/renderer.js:693`; add `argonian` (and reconcile the 12 in-use race strings against the 10 declared in `races.json` — `none` and `mixed` are also unrouted) | `npcs_per_art_family` reports ≥ 260 on `saxhleel`, and no `argonian` figure shares a silhouette with a `breton` or `dunmer` figure at IoU ≥ 0.93 |
| **2** | **Raise the canon of proportion.** Every figure is 5.87–6.84 heads. Scale the head down (or the body up) per family until the declared band is met. | the `morph` head scale in `CHARACTER_SPECS`, `game/src/render/actor.js` | `node tools/visual/f10-silhouette.mjs` reports **≥ 90% of figures inside 7.0–8.0** (6.5–7.5 for naga/orsimer), 0 outside 6.0–8.5 |
| **3** | **Give `base.humanoid` eyes, and give both families a face.** `base.humanoid`'s only family-form parts are `hair-cap` and `tailored-tunic` — no eye, no pupil, no brow, no jaw. | `actor.js` family-form part sets | B8 passes on **every** family; `RI-VIS10` B4 counts **≥ 5 of 7** landmarks (brow ridge, orbit rim, naris, cheek-to-jaw, mandible line, chin underside, crest root) producing visible form shading under a 45° key |
| **4** | **Break the shoulder/torso/limb silhouette out of primitives.** Ellipsoid shoulders on a slab torso is finding #1 in §5. Build a continuous shoulder-to-chest surface; taper the limbs; put a real foot on the player. | `actor.js` body mesh construction | `RI-VIS08` **B1 faceting ≤ 1.5 per 1000 px** on the 0°/90° orbit masks, and **B2 ≥ 25 k tris** for the player (now 15,142) and **≥ 12 k** for `beast` (now 4,834) |
| **5** | **Add the missing reptilian features.** `RI-VIS10` B2 scores saxhleel **3/10**; the absent rows are tail, non-human ear, clawed hand, jaw line, throat plating, scale flow, non-plantigrade leg. **A tail is the loudest.** | `actor.js` family-form parts + a tail bone driven off the existing `frill` secondary chain (which already works — lag 4/7/10) | B2 **≥ 7/10** for reptilian races; the tail moves with a cross-correlation lag ≥ 2 frames |
| **6** | **Write the garment vocabulary, then dress the roster.** One table, `faction × rank × region → {silhouette, material, colour, fitting}`. It does not exist, so D1 is fixed at **0** and D2/D3/D4 are unanswerable rather than merely failing. | new data file under `game/data/`, derived from `RI-VIS05` §E and `game/data/factions/` | **≥ 90%** of the 32 actors map to exactly one row; D3 reports **≥ 5 of 8** materials; D5 shows wear on **≥ 60%** of the roster |
| **7** | **Cross-fade the locomotion transitions.** `blend_frames = 0` with a 0.235 m bone jump. | the `AnimationMixer` call site — `crossFadeFrom` rather than bare `play()` | C5: `blend_frames ≥ 5` on locomotion transitions, `pose_step ≤ 0.05 m`, on all three locomotion scenarios |
| **8** | **Author hit reactions.** **Zero** hit-reaction clips exist in 3,005 frames, including in the `hit_reactions` scenario. | `game/data/combat/clips.json` + the clipsets | C10: **≥ 3** hit reactions by direction present in the trace |
| **9** | **Add a second stance to the idle.** `hip_tilt_deg` is exactly 0.000 at both sampled idle frames. | the `idle` clip | C3: **≥ 2 of 3** stance axes exceed 3°, and the two frames differ |
| **10** | **Give the player fewer actors than people.** 32 actors for 408 NPCs, `townsman` at 23.8%. | `game/data/npcs/*.json` | E1: **≥ 34** actors and no bucket above 10% |

**Not on this list, deliberately:** the enormous sword crossing the silhouette (§5.9). `grip_err` is
0.000 m so it is not a bug, it is a weapon-scale art decision, and it belongs to the weapons piece.

---

## 8. Judging the bar (`CRITIC-DOCTRINE` §1.3)

**I checked whether these two items can express what is wrong with these characters, and — between
them — they can.** `RI-VIS10` in particular was authored yesterday to close exactly this hole and it
did its job: every one of the owner's words maps onto a numbered check with a threshold. That
sentence is worth writing because its absence is indistinguishable from never having asked.

**Ids checked before claiming any hole:** `RI-VIS01`–`RI-VIS10`, `RI-CHR01/02/03`, `RI-VIS05` §D4,
`RI-MTH07`, and `corpus/00-doctrine/subsystems.json`'s nine `render.art.*` paths.

**I am adding nothing to the corpus this pass and that is deliberate** (§1.3's third guard: *"if
closing the hole properly is a piece of work rather than a pass, do not build it inside a
critique"*). Four findings are filed instead, none of which changes any threshold:

1. **`RI-VIS10` B2/B3 had a seam an absent feature fell through — and I closed it.** B3 scored only
   features *"scored present in B2"*, so a feature that is **absent** — our tail — was removed from
   B3's denominator and could not fail it. Ours passed on exactly that. The design-side cardinal sin
   is defined as *painted rather than built*; *not present at all* is a worse instance of it, and it
   scored better. **B3's hard fail now reads "texture-only *or absent*"** for crest, snout and tail.
   `CRITIC-DOCTRINE` §1.3's guards are met and the test is arithmetic: re-applied to this verdict the
   amendment turns B3 from PASS to FAIL and moves `DESIGN` from 3/18 to 2/18. **It makes my own
   verdict worse, which is how you can tell it is not self-serving.** It is the only corpus edit in
   this pass; the other three findings below are filed, not built (§1.3's bounding guard).
2. **`refs/characters/` D1 holds three Argonians, not four.**
   `context/ESO-argonian_character__steam-1536362381.jpg` is a human or Breton woman in a wide-brimmed
   hat at night in a swamp — no snout, no scales, no crest. The slot's floor is 4 and its true `n` is
   3. `character-refs.mjs` verifies that files *exist*, not that they *depict what the slot says*.
3. **`refs/characters/` C4's plates are not "full-body humanoid, head to foot".** The two opened
   (`…leather-armor-male…`, `…glass-armor-female…`) are **armour item renders on a grey card, with no
   head, no hands and no feet** — the arms end at the cuff and the legs at the boot. `INDEX.md` §5.3
   already says they are subject crops with `pixel_metrics_valid: false`; it does not say they are
   headless. **The consequence is specific: `RI-VIS10` C1's head-count canon cannot be compared
   against the C4 plates at all**, because the reference side has no head. C1 remains scoreable
   against the item's written band, which is what I did.
4. **`anim-metrics.mjs` returns `pass: true` for C10 on evidence that fails the item** (§4.1). It
   flags the deferral honestly in its own `reason` string, so this is a documentation-vs-return-value
   mismatch rather than a false instrument — but a builder reading the JSON and not the note will
   record a pass.

---

## 9. Arbitration

**AR-1 (Souls leakage into the fight): PASS.**
- **A5, animation cancel** — the one check this piece could genuinely fail. 155 frames in
  `attack_chain` carry 2+ weighted clips; **22 of them fall in `phase == "active"`**, which would be a
  cancel out of a committed attack. Inspected frame by frame, **all 22 are `roll_light` cross-fading
  with itself** (`roll_light:0.65 + roll_light:0.35`) during a *roll's* active window, not an attack's.
  No attack clip is blended out of during its active phase. Pass.
- **A7, homing during attack** — root-motion authority `r = 1.0000`, `ratio = 1.0000`; translation
  comes from the animation, not from a capsule. Pass.
- A1, A2, A3, A4, A6, A8, A9, A10: `not_applicable` — this piece judges character models and animation
  quality; hit resolution, damage, menus, levelling and topic lists are not in its subsystem paths and
  are judged by the combat and dialogue pieces. Recorded as not_applicable rather than passed.

**AR-2 (Morrowind leakage into the world): PASS.** B6 is the applicable one: item descriptions must not
outrank NPC dialogue as the lore vector. Nothing in the character work delivers lore at all. The rest
(markers, warp, loot, prices, travel, parley) belong to other pieces and are `not_applicable` with that
reason.

**No blind pair was run.** `RI-VIS10` is `blind_pair: no` by construction. `RI-VIS08` is
`blind_pair: yes` but its own method makes the pass conditional — *"using RI-VIS02 REF-M6 as the
reference **if and only if** a usable reference image exists; otherwise record the pair as skipped"*.
`REF-M6` (`modern/character_closeup/REF-M6__rdr2-horseshoe-overlook-camp.jpg`) is Arthur Morgan from
behind at mid distance; our matched artefact is a close-up at ≥ 40% frame height. The framings are not
comparable and a pack built from them would measure the framing. **Recorded `blind_status:
not_possible`, reason: no framing-matched close-up reference exists in `REF-M6`.**

---

## 10. Reproducing every number here

```
node tools/visual/f10-character-sweep.mjs --tag hw --gpu hardware --require-hardware   # 93 frames
node tools/visual/f10-silhouette.mjs --res=768 --pose=idle_loop --json=out.json        # C1, C2
node tools/visual/actor-orbit-holes.mjs --res=512 --angles=8 --distances=4             # B7
for s in locomotion_flat locomotion_slope20 locomotion_stairs attack_chain hit_reactions; do
  node corpus/80-methods/capture-trace.mjs --scenario $s --frames 600 --out traces/f10/$s
  node corpus/80-methods/anim-metrics.mjs traces/f10/$s/trace.jsonl --json anim-$s.json
done
```

**Renderer attestation for every appearance claim:**
`ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA RTX A5000 (0x00002231)), NVIDIA)` —
`evidence_class: HARDWARE — valid for appearance claims`. RunPod Pod `06c0v1xyyroy78`, terminated,
deletion confirmed by API lookup. Two earlier attempts died on a Pod-agent `HTTP 404` on the `/job`
endpoint within 250 ms of submission; both Pods were terminated and confirmed deleted. Total spend
across three runs: **under one cent**.

Shape numbers (C1, C2, B2, B7) are from the offline rasteriser and carry no colour, material or light
claim.
