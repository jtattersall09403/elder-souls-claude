---
id: RI-CAM07
title: Third-person character presentation — what the always-behind camera specifically demands of the player's body
kind: number
side: modern-fidelity
judges: [render.fidelity.character, render.fidelity.animation, render.art.silhouette, render.process.bifurcation]
provenance: constructed
confidence: high
blind_pair: yes
---

> **BIFURCATION DECLARATION (RI-VIS01 §B / CRITIC-DOCTRINE §6). THIS ITEM IS SPLIT AND THE
> HALVES MUST BE JUDGED SEPARATELY.**
>
> - **§B, §C, §D, §E — `modern-fidelity`.** Model quality, animation blending, foot IK,
>   attachment, cloth. Cited **only** under `JUDGEMENT SIDE: FIDELITY`. **Refuses Morrowind
>   references.** Citing a 2002 screenshot here is CC-1/CC-3 and voids the verdict.
> - **§F — `art-direction`.** The player character's silhouette and design language: Argonian
>   proportion, equipment vocabulary, what a Black Marsh adventurer *is shaped like*. Cited
>   **only** under `JUDGEMENT SIDE: ART DIRECTION`, against RI-VIS05. **Refuses modern AAA
>   screenshots.**
> - The two score sets are **disjoint** and share no reference item. A critic scoring this
>   file produces two scores and still promotes only one gap (CRITIC-DOCTRINE §2.2).
>
> **COORDINATION WITH RI-VIS08 — cite it, do not duplicate it.** RI-VIS08 owns the bone-trace
> field contract (§A), static model quality (§B1–B8), and the general animation measurables
> (§C1–C5: sample rate, jerk, foot slide, blending, root motion). Every one of those applies
> to the player character and is **not restated here**. This item exists only for the checks
> that are **specifically caused by seam S18** — the camera is behind the character 100% of
> the time, so the player's back, the player's recovery frames read from behind, and the
> player's body as an occluder of the fight are all first-class subjects that RI-VIS08 has no
> reason to measure.

## The bar

In a first-person game the player character is a pair of hands. In Souls it is the single
most-looked-at object in the entire product: it is on screen in every frame of every hour, at
2–4 m, from behind, in the centre-left of the frame. Everything true of a hero asset in a
cinematic is true of it, plus three things that are true of nothing else.

**One:** the back is the front. The back of the head, the back of the armour, the backs of the
legs and the hanging scabbard get more screen-time than any other surface in the game, and
they must be authored accordingly.

**Two:** the animation is a HUD. A Souls player knows they are actionable because they can see
it — the recovery ends, the shoulders drop, the guard resets. That readback happens *from
behind*, at that distance, at that FOV. An animation whose phases are only distinguishable
from the side is not doing its job.

**Three:** the body is an occluder. It sits between the camera and the fight. A silhouette
that is too bulky, badly offset, or not faded at short arm lengths hides the thing the player
is trying to read.

## The reference artifact

### A. What is inherited, not restated

| Subject | Owner | This item's relationship |
|---|---|---|
| Bone trace record and field contract | **RI-VIS08 §A** | consumed verbatim |
| Silhouette faceting, triangle budget, material separation, texel density, contact shadow, subsurface, weighting, eyes | **RI-VIS08 §B1–B8** | applies to the player; not restated |
| Pose rate / hold ratio, jerk, foot slide, blend discontinuity, root motion | **RI-VIS08 §C1–C5** | applies to the player; not restated |
| Creature *design* vs creature *quality* seam | **RI-VIS08 §D** | the same seam, applied to the player, is §F below |
| Animation *semantics* — commitment, no instant turn, root motion authority | **RI-CMB02 §D, RI-CAM04** | judged there, not here |
| Camera rig, fade, arm floor | **RI-CAM01** | consumed |

A critic must run RI-VIS08's methods on the player character **before** this item's, and
this item fails closed if they were not run.

### B. The back-surface requirement (`modern-fidelity`)

Captures: `player_back_closeup` (camera at the default rig pose, arm 2.5 m, pitch −10°,
character filling ≥ 45% of frame height) and `player_front_closeup` (same, camera orbited
180°). Both at 1920×1080, HUD off, per HARNESS §6.

| # | Check | Measure | Pass | Fail |
|---|---|---|---|---|
| B1 | **Back texel density parity** | RI-VIS03 M5 `HFR` on the back crop and the front crop | `HFR_back ≥ 0.85 × HFR_front` | `< 0.60 ×` → the back is a flat texture nobody finished |
| B2 | **Back material separation** | RI-VIS08 §B3's specular-signature test, run on 3 materially distinct back regions (scale/skin, cloth, metal fitting) | same bar as B3: highest/lowest `Δ` differ by ≥ 2× | all within 25% → one material for the whole back |
| B3 | **Back geometric relief** | count distinct silhouette-breaking elements on the back at the rig distance: hood, pauldron, scabbard, quiver, cloak fastening, tail root, belt hang | ≥ **4** at the default loadout | ≤ 1 → a flat plate |
| B4 | **Back normal/AO detail** | mean gradient magnitude of the shaded back crop vs the front crop | ≥ 0.80 × | < 0.50 × → normal map authored front-only |
| B5 | **Tail / rear appendage** (Argonian player) | present, skinned, secondary-motion driven, does not intersect the ground or the legs at any pose in a 5-pose sweep | no intersection, motion per §E | rigid or intersecting → the most-visible object in the game is broken |

### C. Readability of the player's own phases, from behind (`modern-fidelity`)

This is RI-AI02 §D's silhouette test, turned around and applied to the player from the
camera's own viewpoint. Where AI02 uses world-space joint rotations, this uses **projected
NDC joint positions from the actual game camera**, normalised by the character's on-screen
height, because that is what the player actually sees.

```
q(m, f)      = projected NDC positions of {head, spine2, shoulder_l, shoulder_r,
                elbow_l, elbow_r, hand_l, hand_r, hip_l, hip_r, knee_l, knee_r,
                weapon_tip}, from the live camera at the default rig pose
Dcam(a, b)   = || q(a) - q(b) ||2  /  character_screen_height_ndc
```

| # | Check | Requirement |
|---|---|---|
| C1 | **Phase separation within an attack** | `Dcam(mid-windup, mid-active) ≥ 0.28` and `Dcam(mid-active, mid-recovery) ≥ 0.28`, for **every** attack in the player's moveset |
| C2 | **The actionable instant is visible** | `Dcam(last recovery frame, first actionable frame) ≥ 0.15`. The frame on which control returns must be *seeable*, not merely true. |
| C3 | **Recovery is distinguishable from idle** | `Dcam(mid-recovery, idle) ≥ 0.30` |
| C4 | **Roll direction is readable from behind** | for the 8 locked roll clips (RI-CAM04 §B), all 28 pairwise `Dcam(roll_i frame 8, roll_j frame 8) ≥ 0.22` |
| C5 | **Guard state is readable from behind** | `Dcam(block_idle, idle) ≥ 0.25`, and the shield/weapon must occupy ≥ 3% of the character's projected area in `block_idle` |
| C6 | **Stagger is unmistakable** | `Dcam(hitstun frame 4, idle) ≥ 0.45` — the most important single read in the game |
| C7 | **No occlusion of the read by the camera's own offset** | none of the C1–C6 discriminating joints may be occluded by the character's own body in > 20% of the frames of the compared phase, from the ID buffer |
| C8 | **Recovery legibility in live combat** (BAR-CRITIQUE-01 Rank 6) | over a real `cmb-duel-*` trace of ≥ 3600 frames, the fraction of frames in `phase == recovery` on which the player's discriminating joints are **visible and above the `Dcam` threshold from the live camera** must be ≥ **0.95**. This is the S18 premise stated as a number: the ruling exists because "you read your own recovery frames off your own animation", and a build where you can do that 80% of the time has not satisfied it. Frames lost to RI-CAM01 §C.1 occlusion, to the §C fade, or to the player anchor leaving the frame (RI-CAM03 §E) all count against it. |

**Rationale for the thresholds:** 0.28 is calibrated against RI-AI02 §D's 0.35 in
rotation-space, reduced because projection loses depth and because the camera sees the
character at a consistent scale. These are `constructed` and binding.

### D. Foot IK on marsh ground and stairs (`modern-fidelity`)

RI-VIS08 §C3 owns foot *sliding*. This owns foot *conformance*, which is invisible from a
cinematic camera and unmissable from a camera 4 m behind and 1.65 m up.

| # | Surface | Measure | Pass | Fail |
|---|---|---|---|---|
| D1 | Flat ground | `p95(ground.ankle_h)` over 600 frames of run | ≤ **0.020 m** | > 0.060 m |
| D2 | 20° slope, up and down | `p95(ground.ankle_h)` | ≤ **0.030 m** | > 0.080 m |
| D3 | Stair treads (0.18 m rise) | `p95(ground.ankle_h)`; and toe penetration below the tread surface | ≤ 0.030 m; **zero** frames with penetration > 0.050 m for ≥ 3 consecutive frames | any sustained penetration → feet through the step, directly under the camera |
| D4 | Pelvis compensation | when `\|ankle_l_h − ankle_r_h\| > 0.12 m`, the hips must drop by ≥ 0.5 × the excess | present | absent → the character stands on the higher foot with one leg in the air |
| D5 | Sole alignment | angle between each foot's sole plane and the local surface normal, on the 20° slope | ≤ **10°** | > 25° → feet stay flat while the ground tilts |
| D6 | Shallow water / mud (marsh) | ankle penetration into the water plane must be consistent frame to frame (`stdev ≤ 0.02 m`) and the character's ground contact must use the **mud** surface, not the water plane | consistent | jitter → the IK is fighting the water surface, visible as a foot vibration |
| D7 | IK does not fight root motion | `corr(ik_offset, root_vertical_velocity)` over a stair climb | \|corr\| ≤ 0.4 | > 0.8 → the IK is driving the character up the stairs, not conforming to them |

### E. Attachment, equipment change, and secondary motion (`modern-fidelity`)

| # | Check | Measure | Pass | Fail |
|---|---|---|---|---|
| E1 | **Sheathed weapons visible from behind** | with each of 5 weapon classes sheathed, the weapon must be present in the back capture's ID buffer and occupy ≥ 1.5% of the character's projected area | present | absent → weapons vanish when not drawn |
| E2 | **Nothing intersects the near plane at minimum arm** | with `arm_len = 0.90 m` (RI-CAM01 §A), sweep camera yaw 0→360° in 15° steps and pitch −55→+38° in 10° steps (360 poses), with the largest back-mounted weapon equipped. **Zero** character or equipment triangles inside the near plane on any pose. | zero | any → the greatsword on the back stabs the lens |
| E3 | **Equipment visibly changes the model** | for each of 5 slots (head, chest, hands, legs, back), swap between 3 authored sets and diff the back crop | ≥ **18%** of the character's back pixels change per slot swap | < 5% → the slot is a stat with no geometry |
| E4 | **Silhouette changes with the set** | RI-VIS08 §B1's outline extraction, compared between the lightest and heaviest sets: outline Hausdorff distance ≥ **0.08 × character height** | ≥ 0.08 | < 0.03 → all armour is a texture swap |
| E5 | **Cloth / secondary motion exists and lags** | for a cape/tabard/frill tip: `corr(hips velocity, tip velocity)` peaks at lag **3–12 frames**, tip amplitude ≥ **0.08 m** at run speed | lag in band, amplitude met | lag 0 → rigidly parented; amplitude < 0.01 m → static geometry |
| E6 | **Secondary motion is deterministic** | two runs at the same seed produce identical cloth positions (HARNESS D5) | identical | divergent → the cloth sim is on wall-clock or unseeded, and every trace containing it is non-reproducible |
| E7 | **Character fade preserves the shadow** | at `arm_len ≤ 0.91 m`, the character's material opacity < 0.05 **and** the cast shadow present at full strength (RI-CAM01 §C) | both | shadow gone → the player loses their own animation read at the exact moment they need it |

### F. Silhouette and design language (`art-direction` — judged against RI-VIS05 ONLY)

| # | Check | Requirement |
|---|---|---|
| F1 | **Recognisable at 32 px** | the player's back silhouette, downsampled to 32 px height and thresholded, must be distinguishable from the same treatment of each of the 5 most common humanoid enemies. Pairwise IoU of the binary masks ≤ **0.72**. |
| F2 | **Argonian proportion** | the silhouette carries the canonical read — digitigrade stance, head crest/horns, tail — at the rig distance. Judged against RI-VIS05 §D's creature-design language, **not** against any modern reference. |
| F3 | **Equipment vocabulary belongs to Black Marsh** | armour and weapon shapes read as chitin/resin/wet-wood/bone/lacquer (RI-VIS05, `render.art.materials`), not as generic European plate. |
| F4 | **The back is composed** | the back view is a designed composition — asymmetry, a clear focal element (scabbard, hood, crest), and readable value structure — because it is the shot the player looks at for ten hours. |
| F5 | **Strangeness budget** | the player character contributes to `world.strangeness.budget` rather than being the one normal thing in an alien world. |

**F1's IoU threshold is `constructed`; F2–F5 are qualitative and are judged by the
art-direction critic against RI-VIS05, blind, per RI-VIS06.** They are scored on that item's
scale, in the disjoint score set.

## Comparison method

Method script: **`corpus/80-methods/m-cam07-presentation.mjs`**.
**Prerequisite:** RI-VIS08's M-series must have been run on the player character in the same
wave. If not, every check here fails closed at 0.

**Bifurcation, first.** Before any citation, the critic writes the `bifurcation` block with
`axis: "both-separately"`, `fidelity_refs: [RI-VIS02, RI-VIS03, RI-VIS08, RI-CAM07§B–E]`,
`art_refs: [RI-VIS05, RI-VIS06, RI-CAM07§F]`, and confirms the two lists are disjoint.

**M1 — Back captures (fidelity).** Add `player_back_closeup` and `player_front_closeup` to
`tools/harness/viewpoints.json` by amendment (HARNESS §6 — poses are append-only). Capture
both, HUD off, fixed time of day and weather. Run §B1–B5.
- **FAIL** on any row in its Fail column.
- Artifact: both PNGs plus the computed table.

**M2 — Phase readability from behind (fidelity).** For every attack in the player's moveset,
every roll clip, `block_idle`, `hitstun`, and `idle`:
1. `loadState("cam-flat-plain")`, equip the class, script the move, `traceStart({channels:
   ["camera","bones"]})`.
2. On the phase-midpoint frames, `renderFrame()` and read the projected joint positions from
   the requested `bones_ndc` channel (or, failing that, project `bones` through the trace's
   `camera` block offline — record which path was used in `method_deviations`).
3. Compute `Dcam` for every pair in §C.
- **FAIL** on any pair below its threshold. Report the full matrix.
- Then run **C8** over a live `cmb-duel-infantry` and `cmb-duel-in-corridor` trace of
  ≥ 3600 frames each. **FAIL** if the recovery-legibility fraction is < 0.95 in either. The
  corridor run is the one that fails; running only the arena duel is not running the method.
- Independently, produce a contact-sheet artifact: the compared frames side by side at
  1920×1080, so a human can confirm the metric is measuring what it claims.

**M3 — Foot IK (fidelity).** Scripted runs across: flat, a 20° slope (up and down), a
stair flight of ≥ 12 treads, shallow marsh water, and mangrove roots. 600 frames each.
- Run §D1–D7 from the RI-VIS08 §A `ground` and `bones` fields.
- **FAIL** on any row. Report the worst surface by name (CRITIC-DOCTRINE §2.1 step 2: the
  mangrove roots, not the flat plain).

**M4 — Attachment and near-plane sweep (fidelity).** §E1, §E2's 360-pose sweep, §E7.
- **FAIL** if any pose in E2 puts geometry inside the near plane. Artifact: the pose list and
  the 6 worst screenshots.
- **FAIL** if the fade/shadow behaviour in E7 is wrong.

**M5 — Equipment and cloth (fidelity).** §E3–E6. Requires 3 authored sets per slot in
`game/data/items/`. If fewer exist, the check scores **0** (content absence is measured as
absence, not excused).

**M6 — Silhouette and design (art direction, DISJOINT SET).** §F1's IoU computation, then
§F2–F5 judged blind against RI-VIS05 per RI-VIS06's protocol.
- **This method may not cite any modern reference.** Doing so voids the verdict.
- Artifact: the 32 px mask sheet, the IoU matrix, and the blind pack.

## Scoring

**Two disjoint score sets. Report both. Never average them.**

### Set 1 — fidelity (0–100)

| Check | Weight | Pass condition |
|---|---|---|
| M1 back surfaces | 20 | §B1–B5 all in Pass |
| M2 phase readability from behind | **30** | Every `Dcam` pair above threshold |
| M3 foot IK | 20 | §D1–D7 on every surface including the ugly ones |
| M4 attachment / near-plane | 15 | Zero near-plane intrusions over 360 poses; fade+shadow correct |
| M5 equipment and cloth | 15 | §E3–E6 |

### Set 2 — art direction (0–100)

| Check | Weight | Pass condition |
|---|---|---|
| F1 silhouette distinctness at 32 px | 30 | IoU ≤ 0.72 against all 5 |
| F2 Argonian proportion | 25 | Blind judgement vs RI-VIS05 §D |
| F3 equipment vocabulary | 25 | Blind judgement vs RI-VIS05 materials |
| F4 back composition | 10 | Blind judgement |
| F5 strangeness contribution | 10 | Blind judgement vs `world.strangeness.budget` |

- **≥ 90** — parity, on that axis. **70–89** — gap named. **< 70** — **we lose**, on that axis.
- **Automatic fail regardless of score:**
  - **the two score sets sharing a reference item, or a modern screenshot appearing in Set 2,
    or a Morrowind screenshot appearing in Set 1** — RI-VIS01 CC-1/CC-3, voids the verdict;
  - any `Dcam` phase pair in C1, C2 or C6 below threshold — the player cannot read their own
    state, which is the premise seam S18 rests on;
  - C8 recovery legibility below **0.95** in any combat scenario — same reason, measured live;
  - geometry inside the near plane at the minimum arm length;
  - the character's cast shadow disappearing with the fade;
  - the player character being a capsule with a mesh parented to it (detected via RI-VIS08
    §C5's root-motion check plus §D7's IK correlation: a dragged mesh shows `ctrl.pos` driving
    `root.pos` rather than the reverse);
  - non-deterministic cloth (E6) — it breaks HARNESS D5 for every trace it appears in.

**Blind pair, fidelity:** two `player_back_closeup` shots at identical pose, resolution and
lighting — ours and a modern reference character crop from RI-VIS02 — unlabelled.
Discriminating question, written first: *which of these was authored knowing it would be on
screen for ten hours?* **Blind pair, art direction:** two 32 px silhouette sheets, ours and a
Morrowind-transposition reference from RI-VIS05, with the same question RI-VIS06 §3 poses.
Two separate packs, two separate picks, recorded separately.

## How we lose

1. **The capsule with a mesh dragged behind it.** The character controller is a
   `CapsuleGeometry` physics proxy, the visual mesh is `.position.copy(capsule.position)`
   every frame, and the animation is decoration. Every phase read fails, foot IK is
   impossible, and root motion does not exist. This is the failure that makes every other
   item in this file moot, and RI-VIS08 §C5 plus §D7 detect it from output.
2. **A front-only character.** The model was reviewed in a turntable facing camera, and the
   back has a 512 px texture, no normal detail, no relief, and a scabbard that vanishes when
   sheathed. It is the only surface the player ever sees.
3. **No sheathed weapon geometry at all.** Weapons exist only in the hand. The character's
   back is bare, the loadout is invisible, and the single strongest signal of build identity
   (Morrowind's side of S2) never reaches the screen.
4. **The greatsword through the lens.** The back-mounted weapon is authored at full length,
   the arm collapses to 0.90 m in a corridor, and the blade is inside the near plane. It
   renders as a full-screen dark wedge. E2's 360-pose sweep exists because it only happens at
   specific yaw/pitch combinations and will never be found by playing.
5. **Recovery indistinguishable from idle.** The attack's recovery is a 6-frame blend back to
   the idle pose, so from behind the character looks actionable four frames before it is. The
   player mashes, the input is dropped (RI-CMB01 §C.6), and they conclude the game "ate my
   input". C2 and C3 are the measurable form of that complaint.
6. **Eight roll clips that look identical from behind.** They are authored, they are hooked
   up, they pass RI-CAM04's `clip_match` — and at 4 m from behind, `roll_bl` and `roll_l` are
   the same 30 px of motion. C4's pairwise check is the only thing that catches this, and it
   is exactly the kind of failure that only appears at the tenth hour.
7. **No foot IK at all.** The feet are wherever the clip put them, so on every stair the
   character floats or sinks, and the marsh — which is entirely mud, roots and boardwalk — is
   a permanent contact failure. D3 and D6 are the two surfaces this game is actually made of.
8. **Foot IK that drives the root.** The correction is applied to the hips and the hips drive
   the controller, so the character walks up stairs by being levitated by its own IK. Looks
   fine on a slope and explodes on a spiral stair. D7's correlation check.
9. **Rigidly parented cloth.** A cape modelled as part of the chest mesh. Zero lag, zero
   amplitude, and at run speed the character reads as a statue sliding forward. E5's lag band
   exists because "we added cloth" and "the cloth moves correctly" are different claims.
10. **Cloth on wall-clock time.** `cloth.update(performance.now())`. Deterministic traces die
    silently; `body_sha256` stops matching and nobody knows why. HARNESS D3/D5, E6 here.
11. **Fade implemented as `mesh.visible = false`**, taking the shadow with it, so in a corner
    the player has neither a body nor a shadow and cannot see their own roll. RI-CAM01 §C and
    E7 both cover it because it is the intersection of two owners and will fall between them.
12. **Judging the back capture against a Morrowind screenshot** because "it's an Elder
    Scrolls game". That is CC-1 and it voids the verdict. The player character's *rendering*
    is measured against Elden Ring and Skyrim SE; only its *shape and vocabulary* are measured
    against Morrowind, and §F is the only place that is legal.
13. **The reverse: defending a generic knight silhouette on fidelity grounds.** A 40 k-triangle
    plate-armoured human is a fidelity pass and an art-direction fail, and averaging the two
    scores hides it. The two sets are disjoint for this reason.

## Provenance note

- **`constructed`, confidence high, and binding:** every threshold in §B–§F. The 0.85×/0.60×
  back-texel parity, the 4-element back relief count, the `Dcam` thresholds (0.28 / 0.15 /
  0.30 / 0.22 / 0.25 / 0.45 / 20%), every foot-IK bar in §D, the 360-pose near-plane sweep,
  the 18% pixel-change and 0.08× Hausdorff equipment bars, the 3–12 frame cloth lag band and
  0.08 m amplitude, and F1's 0.72 IoU ceiling are ours.
- **Derived / calibrated against a sibling item:** the `Dcam` scale is derived from RI-AI02
  §D's 0.35 rotation-space threshold, reduced to 0.28 for NDC projection. If RI-AI02 §D's
  threshold is amended, this one should be recalibrated in the same commit.
- **Inherited, not restated (and this item is void if they are duplicated here):** the bone
  trace contract and all static/dynamic quality bars are **RI-VIS08 §A–§C**; image metrics
  are **RI-VIS03**; the modern reference set is **RI-VIS02**; the art-direction reference is
  **RI-VIS05**; the blind protocol is **RI-VIS06**; the bifurcation law is **RI-VIS01** and
  **ARBITRATION §4**. This item's contribution is exclusively the S18-caused subset.
- **`canonical-recall`, confidence medium:** that Souls characters are authored with the back
  as the hero surface, carry visibly sheathed weapons, use foot IK on stairs and slopes, and
  that the player reads their own actionable frame off their own animation. Recalled, not
  measured.
- **Harness dependency:** requires the `camera` trace channel, the RI-VIS08 `bones`/`ground`
  channel, a `bones_ndc` projection channel (or an offline projection path using the traced
  camera), an ID-buffer capture for occlusion and coverage, and two new viewpoints
  (`player_back_closeup`, `player_front_closeup`) added to `tools/harness/viewpoints.json` by
  amendment. Absent them, M2 and M4 score **0**, fail-closed.
