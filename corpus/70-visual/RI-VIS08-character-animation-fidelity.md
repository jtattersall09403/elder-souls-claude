---
id: RI-VIS08
title: Character, creature and animation fidelity — model quality, silhouette readability, and the tells of bad Three.js character work
kind: number
side: modern-fidelity
judges: [visual.character.model, visual.character.materials, visual.character.silhouette, visual.animation.smoothness, visual.animation.blending, visual.animation.rootmotion, visual.animation.ik, visual.animation.attachment, visual.creature.readability]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SIDE DECLARATION: this item is `modern-fidelity`.**
> Cited **only** under `JUDGEMENT SIDE: FIDELITY` (RI-VIS01 §B).
> **This item REFUSES Morrowind references.** Morrowind's characters have ~1 000 triangles,
> a dozen animations, no blending, no IK and visible foot sliding. That is not a target, a
> defence, or a mitigating context. Citing it here is CC-1 and CC-3 simultaneously and voids
> the verdict.
> **Creature *design*** — what a naga is shaped like, whether it is alien enough — is
> RI-VIS05 §D4 and is judged on the other side. **Creature *quality*** — topology, weighting,
> silhouette smoothness, animation — is here. §D below is the seam between them and states
> exactly where the line runs.
> **Interaction with ARBITRATION §1:** inside the fight, Souls is authoritative over
> animation *semantics* (root-motion-authoritative movement, committed attacks, no instant
> turn during attack). This item measures whether those semantics are *executed* to a modern
> standard. A correct Souls animation contract rendered at 8 frames per attack still fails
> here, and a beautiful 60-sample animation that lets the player turn mid-swing fails
> ARBITRATION AR-1. Both checks run.

## The bar

Characters are where amateur real-time work is most visible, because humans and animals are
the two things every viewer is a trained expert in. A frame of environment can be forgiven a
lot; a character that slides, drifts, or snaps cannot.

The bar has two halves. **Static:** at 2–3 m the model's silhouette has no visible facets,
materials separate at a glance (metal ≠ leather ≠ cloth ≠ scale ≠ skin by their *response*,
not their colour), and the figure sits in the scene with contact shadowing rather than
hovering. **Dynamic:** motion is continuously sampled and interpolated, transitions are
blended rather than cut, the feet are planted on the ground and on the geometry, the weapon
is in the hand, and the character's translation comes from the animation rather than from a
capsule dragging a mesh behind it.

Both halves are measurable. Static from screenshots, dynamic from a per-frame skeleton trace
that the harness dumps alongside the render.

## The reference artifact

### §A — The bone trace record (this item owns the field contract)

Animation measurables compute over a per-frame JSONL dump, one record per animated character
per rendered frame. The harness (`corpus/80-methods/`) owns emission; this item owns the
fields. **A missing field is fail-closed**: the affected check scores 0, never "unknown"
(same rule as RI-AI01 §A).

```json
{"f":1042,"t_ms":17366,"cid":"player","rig":"humanoid_v2",
 "clip":"atk_r1_a","clip_t":0.383,"clip_len_s":0.867,"clip_sample_hz":30,
 "blend":[{"clip":"run_f","w":0.18},{"clip":"atk_r1_a","w":0.82}],
 "root":{"pos":[12.41,0.00,-8.13],"quat":[0,0.31,0,0.95]},
 "ctrl":{"pos":[12.40,0.00,-8.14],"vel":[2.10,0,0.4]},
 "bones":{"hips":[12.41,0.98,-8.13],"spine2":[12.40,1.42,-8.10],
          "head":[12.39,1.71,-8.08],
          "hand_r":[12.92,1.30,-7.81],"hand_l":[12.05,1.15,-8.30],
          "ankle_r":[12.55,0.09,-8.02],"ankle_l":[12.28,0.31,-8.24],
          "toe_r":[12.62,0.03,-7.90],"toe_l":[12.33,0.22,-8.12]},
 "weapon":{"attached_to":"hand_r","grip_pos":[12.93,1.30,-7.80]},
 "ground":{"ankle_r_h":0.012,"ankle_l_h":0.214,"surface_normal_r":[0,1,0]},
 "ik":{"foot_enabled":true,"hand_enabled":false}}
```

All positions are world-space metres. `ground.ankle_*_h` is the ankle-to-ground-surface
height along the surface normal. `clip_sample_hz` is the *authored* keyframe rate of the clip,
not the render rate.

### §B — Static model quality (from screenshots)

Measured on the `character_closeup` capture (subject filling ≥ 40% of frame height) and on a
`creature_closeup` capture per creature archetype.

| # | Check | How to measure | Pass | Fail |
|---|---|---|---|---|
| B1 | **Silhouette faceting** | Extract the character's outline against a contrasting background (harness renders an ID-buffer mask). Walk the outline; fit a local circle over every 24-px window; count windows where the outline deviates from the fit by a straight segment ≥ 8 px with an angle change ≥ 12° at each end (a visible polygon edge). `Facets = count / outline_length_px × 1000` | `Facets ≤ 1.5` per 1000 px | `> 4` → **low-poly silhouette**, visible corners on curves |
| B2 | **Triangle budget** | From the renderer's own draw stats for the character's meshes | Player/named NPC ≥ 25 k tris; common enemy ≥ 12 k; boss/large creature ≥ 40 k | Player < 6 k → 2002 budget, hard fail |
| B3 | **Material separation** | Sample 16×16 patches on ≥ 3 materially distinct regions (e.g. scale, cloth, metal fitting). Compute each patch's specular signature: re-capture with the camera orbited 30° and take `Δ = mean|Yp₂ − Yp₁|` per patch | The three patches' `Δ` values must differ by ≥ 2× between the highest and lowest | All within 25% → single material response, no roughness variation |
| B4 | **Texel density** | RI-VIS03 M5 `HFR` computed on the character crop only | `HFR ≥ 0.05` | `< 0.02` → untextured or a 256 px texture on a 2 m figure |
| B5 | **Contact shadow / grounding** | RI-VIS03 M6b on the foot-ground junction | junction ≥ 25% darker than ground 100 px away | fails → **floating character** |
| B6 | **Skin/scale response** | On a creature with organic surfaces: does the material show any subsurface warmth at thin parts (ear frills, webbing, membrane)? Backlight capture: put the light behind the subject and compare thin-part luminance to thick-part luminance | thin parts ≥ 1.6× brighter | ratio ≈ 1.0 → opaque plastic |
| B7 | **Weighting artefacts** | Capture the character at 5 extreme poses (full crouch, max shoulder abduction, max spine twist, max knee bend, max neck turn). Look for candy-wrapper collapse at wrists/ankles, volume loss at shoulders, elbow pinching | no visible collapse at any pose | any collapse → bad skin weights |
| B8 | **Eyes** | Are eyes separate geometry with a specular highlight and a visible iris/pupil, or a texture on the head mesh? | separate geometry + specular | painted-on eyes → dead face |

### §C — Animation measurables (from the §A trace)

These are the ones that catch the specific tells of bad Three.js character work. Each names
the tell it detects.

**C1 — Sample rate / "the 8-frame animation"**
```
uniq_pose(clip) = number of distinct skeleton poses in one clip cycle, where two frames
                  are the same pose if max over bones of |Δpos| < 0.002 m
pose_rate       = uniq_pose / clip_len_s          # distinct poses per second
hold_ratio      = fraction of consecutive frame-pairs with max bone |Δpos| < 0.0005 m
                  (excluding frames where the clip is genuinely static by design)
```
| Pass | Warn | Fail |
|---|---|---|
| `pose_rate ≥ 24/s` and `hold_ratio ≤ 0.10` | `pose_rate 12–24` | `pose_rate < 12/s` or `hold_ratio > 0.35` → **stepped/low-sample animation**; at 60 fps rendering, this is visible as stuttering |

Note: `clip_sample_hz ≥ 30` is required in the trace **and** the runtime must interpolate
between keys. A clip authored at 30 Hz and played with `THREE.InterpolateDiscrete` produces
`pose_rate = 30` but `hold_ratio ≈ 0.5` — C1 catches it via `hold_ratio` specifically.

**C2 — Jerk / motion smoothness**
```
for each bone b:  v[f] = pos[f]-pos[f-1];  a[f] = v[f]-v[f-1];  j[f] = a[f]-a[f-1]
J_p95(b) = 95th percentile of |j[f]| over the clip, in m/frame^3
J        = max over {hand_r, hand_l, head, hips} of J_p95(b)
```
| Pass | Fail |
|---|---|
| `J ≤ 0.010` | `J > 0.030` → **snapping**: a discontinuity in acceleration, i.e. a cut transition, a discrete interpolation, or a pose popped in |

**C3 — Foot sliding**
```
plant window = ≥3 consecutive frames with ankle world speed < 0.05 m/s
FootSlide    = for each plant window, the horizontal world displacement of the ankle
               from the first to the last frame of the window
Slide_mean   = mean over all plant windows;  Slide_p95 = 95th percentile
```
| Pass | Warn | Fail |
|---|---|---|
| `Slide_mean ≤ 0.03 m` | 0.03–0.08 m | `Slide_mean > 0.12 m` or `Slide_p95 > 0.25 m` → **foot sliding**, the definitive tell that locomotion speed is not matched to animation stride |

Correct implementation is either root-motion-driven translation (C4) or stride-matched
playback (`clip.timeScale = controllerSpeed / clipStrideSpeed`). Neither present → guaranteed
fail.

**C4 — Root motion authority**
```
d_root[f] = |root.pos[f] - root.pos[f-1]|      (horizontal)
d_ctrl[f] = |ctrl.pos[f] - ctrl.pos[f-1]|      (horizontal)
r         = Pearson correlation of d_root vs d_ctrl over the clip
ratio     = sum(d_ctrl) / max(sum(d_root), 1e-6)
```
| Context | Pass | Fail |
|---|---|---|
| Attack / dodge / any committed action (**ARBITRATION §1: Souls authoritative**) | `r ≥ 0.90` and `ratio ∈ [0.95, 1.05]` | `r < 0.5` → **capsule-driven motion, mesh dragged along**. This is simultaneously a fidelity fail here and an AR-1 arbitration fail (root-motion-authoritative movement is a Souls rule) |
| Free locomotion | `r ≥ 0.6` or stride-matched playback demonstrable via C3 passing | both C3 and C4 failing → locomotion is unanchored |

**C5 — Blending / transition quality**
```
For each clip transition at frame f0:
  blend_frames = number of frames where 2+ clips have weight > 0.01
  pose_step    = max over bones of |pos[f0] - pos[f0-1]|
```
| Pass | Fail |
|---|---|
| `blend_frames ≥ 5` for locomotion transitions (≥ 3 for attack cancels into recovery), `pose_step ≤ 0.05 m` | `blend_frames = 0` → **hard cut between clips**, the single most common Three.js `AnimationMixer` mistake (`action.play()` without `crossFadeFrom`). `pose_step > 0.15 m` → visible snap |

Souls caveat: attack *commitment* means an attack clip must NOT be blendable out of early
(AR-1). Blending is required at the *ends* of actions, forbidden as a mid-action cancel. The
check therefore runs per transition type, and a transition out of an attack's `active` phase
having `blend_frames > 0` is an **arbitration** fail reported to the combat critic, not a
fidelity pass.

**C6 — T-pose / rest-pose leakage**
```
rest_hash = 64-bit perceptual hash of the character's silhouette in the rig's rest pose
For every frame during any active clip: hamming(pose_hash[f], rest_hash) must be > 6
```
| Pass | Fail |
|---|---|
| no frame within Hamming 6 of rest | any frame within 6 → **T-pose drift**: a clip failed to load, a mixer weight went to zero, or a bone is unanimated. Report the frame index and the clip. |

Also check the **partial** case: per-bone, a bone whose position is identical to rest pose for
> 90% of frames across all clips is an **unanimated bone** (commonly fingers, jaw, tail, or
the entire left arm after a rig import failure). Report the bone list.

**C7 — Weapon and prop attachment**
```
grip_err[f] = |weapon.grip_pos[f] - bones[weapon.attached_to][f]|
```
| Pass | Fail |
|---|---|
| `max grip_err ≤ 0.02 m` | `> 0.05 m` on any frame → **floating weapon**; the prop is parented to the world or updated a frame late (a one-frame lag produces error proportional to hand speed — check whether `grip_err` correlates with hand velocity, which diagnoses ordering rather than parenting) |

**C8 — Foot IK / ground conformance**
```
For every frame where a foot is planted (C3 plant window):
  h = ground.ankle_*_h
```
| Pass | Fail |
|---|---|
| `h ∈ [-0.005, 0.03] m` on ≥ 95% of planted frames, on both flat and sloped ground | `h < -0.05` → foot through the floor; `h > 0.08` → **hovering on slopes**, i.e. no foot IK. Test specifically on a ≥ 20° slope and on a stair — flat ground hides the absence entirely |

**C9 — Secondary motion**
```
For cloth/tail/frill/hair proxies: lag = argmax cross-correlation between the proxy bone's
velocity and its parent's velocity, in frames
```
| Pass | Fail |
|---|---|
| `lag ≥ 2` frames and non-zero proxy motion during locomotion | `lag = 0` → the appendage is rigidly parented; zero motion → **no secondary motion**, everything moves as one solid object |

**C10 — Animation count / variety**
```
distinct_clips per character; attack clips per weapon class; idle variants; hit reactions
by direction
```
| Pass | Fail |
|---|---|
| ≥ 3 hit reactions by direction, ≥ 2 idle variants, per-weapon-class attack sets | 1 attack clip reused for everything, 1 hit reaction → the character reads as a puppet |

### §D — The design/quality seam for creatures (where this item stops)

| Question | Side | Item |
|---|---|---|
| Is the naga shaped like something that could not be a person? | ART | RI-VIS05 §D4 |
| Is the naga's silhouette *readable* at 50 m — can you tell what it is and which way it faces? | **FIDELITY** | here, §D1 below |
| Is its skin the right colour for Black Marsh? | ART | RI-VIS05 §C |
| Does its skin respond to light like skin? | **FIDELITY** | §B6 |
| Does it move wrongly, in the alien-design sense (too many joints)? | ART | RI-VIS05 §D4 |
| Does it move badly, in the technical sense (snapping, sliding, no blend)? | **FIDELITY** | §C |

**D1 — Silhouette readability at range (fidelity).** Render the creature filling 40 px of
frame height (≈ 50 m at 1080p with a 50° FOV) against a plain background; produce its binary
mask. Two checks:
```
Identifiability : show the 40px mask alone to a fresh judge with the prompt
                  "what kind of animal or creature is this, and which way is it facing?"
                  Pass if the answer names the correct broad class and correct facing.
Distinctiveness : compute IoU of this mask against the masks of every other creature in the
                  bestiary at the same size. Pass if max IoU < 0.65 against all others.
```
| Pass | Fail |
|---|---|
| judge identifies class and facing; `max IoU < 0.65` | facing wrong → the silhouette has no front/back asymmetry; `IoU ≥ 0.80` against another creature → two creatures are the same blob at range, which is a readability failure regardless of how different their textures are |

This is a fidelity check, not a design check, because it is about whether the *model* carries
information at low pixel counts — the same property as LOD quality.

### §E — The condensed tell list (what bad Three.js character work looks like)

Ordered by how quickly a viewer notices:

1. **Foot sliding** — feet skate over the ground during walk/run. C3.
2. **Hard cuts between clips** — the character snaps from idle to run with no transition. C5.
3. **Floating weapon** — sword hovers near, or behind, the hand. C7.
4. **T-pose flash** — one frame of crucifixion pose between actions, or a permanently
   T-posed left arm. C6.
5. **Hovering on slopes** — the character stands on the average ground height, one foot
   buried, one in the air. C8.
6. **Stepped motion** — 8–12 distinct poses per second, visible stutter at 60 fps. C1.
7. **Capsule-dragged mesh** — the body translates smoothly while the legs animate at an
   unrelated cadence; turning is instant while the body keeps facing forward. C4.
8. **Everything moves as one rigid object** — no cloth lag, no tail sway, no hair. C9.
9. **Faceted silhouette** — visible polygon corners on shoulders, helmets, skulls. B1.
10. **Single material response** — leather, steel and scale all shine identically. B3.
11. **Painted-on eyes** — no separate eye geometry, no catchlight, dead stare. B8.
12. **Candy-wrapper wrists** — the mesh pinches to nothing when a joint twists. B7.
13. **One attack animation** — every enemy of every type swings identically. C10.

## Comparison method

1. Emit the RI-VIS01 §B declaration, `JUDGEMENT SIDE: FIDELITY`, properties `F10`, `F11`,
   `F14`.
2. **Static captures.** `character_closeup` plus one `creature_closeup` per bestiary
   archetype; plus the five extreme-pose captures for B7; plus the orbit-30° pair for B3; plus
   a backlit capture for B6; plus a 40 px mask render per creature for D1. All fixed poses,
   deterministic, sha256-recorded.
3. **Trace captures.** Drive the game headless through a scripted input sequence and dump
   §A JSONL at the render rate:
   ```bash
   node corpus/80-methods/capture-trace.mjs --scenario locomotion_flat   --frames 600
   node corpus/80-methods/capture-trace.mjs --scenario locomotion_slope20 --frames 600
   node corpus/80-methods/capture-trace.mjs --scenario locomotion_stairs --frames 600
   node corpus/80-methods/capture-trace.mjs --scenario attack_chain      --frames 900
   node corpus/80-methods/capture-trace.mjs --scenario hit_reactions     --frames 600
   node corpus/80-methods/anim-metrics.mjs traces/w03/*.jsonl --json out/w03/anim.json
   ```
   The locomotion scenarios must include acceleration, a full stop, and a 180° turn — most of
   these metrics only fail during transitions, and a straight-line walk hides all of them.
4. **Run §B** (image checks) and **§C** (trace checks); report every check with its measured
   value, its band, and the tell it detects.
5. **Run D1** with a fresh judge on the 40 px masks (fresh context, mask only, no colour).
6. **Cross-file check:** any C4 or C5 result that implicates a Souls rule (root-motion
   authority in committed actions; blending out of an attack's active phase) is reported to
   the combat critic as a potential AR-1 finding. This item does not adjudicate arbitration
   seams; it reports them.
7. **Blind pass:** RI-VIS06 Protocol A on a `character_closeup` crop, using RI-VIS02 REF-M6
   as the reference **if and only if** a usable reference image exists; otherwise record the
   pair as skipped.

## Scoring

Two sub-scores, reported separately, and the item's score is their minimum.

```
STATIC  = 10 * (B-checks passed) / 8
DYNAMIC = 10 * (C-checks passed) / 10        # C1..C10
CHARACTER FIDELITY = min(STATIC, DYNAMIC)
```

| Score | Meaning |
|---|---|
| 9–10 | ≤ 1 check failing on each side; no item from the §E tell list is present |
| 7–8 | 2–3 checks failing, none of them C3/C5/C6/C7 |
| 5–6 | 4–5 checks failing, or one of C3/C5 failing |
| 3–4 | C6 (T-pose leak) or C7 (floating weapon) failing, or B2 below budget |
| 0–2 | ≥ 3 of the §E top-five present, or the §A trace could not be produced |

**Hard fails, overriding the arithmetic:**
- **C6 T-pose leak → item capped at 4.** A T-pose in shipped footage is unrecoverable as a
  first impression.
- **C4 `r < 0.5` on a committed action → capped at 4** *and* reported as a candidate AR-1
  arbitration failure to the combat critic.
- **No §A trace emitted → the DYNAMIC score is 0**, not "not assessed". Fail-closed, per
  RI-AI01's field-contract rule. Animation quality claimed without a trace is CC-6.
- **B2 player model < 6 k triangles → capped at 3.** This is the character-side expression of
  the cardinal sin; defending it with Morrowind's ~1 k budget is CC-3.

**Failure threshold: < 6 blocks the wave** via the RI-VIS01 §E `min()` gate on FIDELITY.

**What we lose looks like:**
```
STATIC : B1 Facets 7.2 FAIL  B2 4.1k tris FAIL  B3 all Δ within 12% FAIL
         B4 HFR 0.014 FAIL   B5 no contact darkening FAIL  B8 painted eyes FAIL   -> 2.5
DYNAMIC: C1 pose_rate 9/s FAIL, hold_ratio 0.44 FAIL
         C3 Slide_mean 0.31 m FAIL     C4 r = 0.04 FAIL (capsule-driven)
         C5 blend_frames 0 FAIL        C6 T-pose at f=412 FAIL
         C7 grip_err max 0.19 m FAIL   C8 slope h = 0.22 m FAIL
         C9 lag 0 FAIL                 C10 1 attack clip FAIL                     -> 0
CHARACTER FIDELITY = 0.  Also: C4 reported to combat critic as candidate AR-1.
```

## How we lose

- **Foot sliding forever.** Locomotion is built as "move the capsule at N m/s and play a run
  clip", stride speed is never matched, root motion is never wired, and the character skates
  through the entire project. It is the first thing anyone notices in a video and the last
  thing anyone fixes. C3 + C4 catch it on day one if the trace exists.
- **`mixer.clipAction(x).play()` with no crossfade.** The default Three.js animation path
  produces hard cuts, and it works well enough in a tech demo that nobody revisits it. C5.
- **The trace is never emitted**, so §C is unassessable, and the critic writes "animation
  looks acceptable". Guard: no trace → DYNAMIC = 0, stated as a hard rule.
- **Everything is judged on flat ground.** C8 (foot IK) and half of C3 only fail on slopes and
  stairs. Black Marsh is mangrove roots, boardwalks and ziggurat steps **in some regions and
  cliff paths, scree, fired-clay crack networks and salt terraces in others** — either way the
  worst possible terrain for a character with no IK, and the *dry* regions are the harsher test
  because there is no water surface to hide a floating foot. The three locomotion scenarios exist
  to force this. *(AMENDED wave 0 (rebase-s22), ARBITRATION seam **S24**: thirteen regions, not
  one; `corpus/50-world/regions.json`.)*
- **Mixamo-shaped characters.** Free rigs and free animations get used, they are humanoid,
  generic, and they animate like stock footage. This is a *fidelity* pass and an
  **art-direction** disaster (RI-VIS05 §D4, RI-VIS07 will name it) — and the split means
  nobody owns it unless both critics report. Note it in both passes.
- **A beautiful player and grey-box enemies.** All the character effort goes into the one
  model the developer looks at. Guard: `creature_closeup` per bestiary archetype, and the
  score is a minimum across characters, not the player's score.
- **Souls semantics implemented, quality not.** The attack has correct startup/active/recovery
  frames, correct commitment, correct i-frames — and is 8 poses long with a hard cut into
  recovery. The combat critic passes it, the visual critic never looks at it. Guard: §C runs
  on `attack_chain`, and this item's §C5/§C1 results are part of the combat piece's visual
  verdict.
- **The 40 px readability test is skipped** because it feels pedantic. Then in play, at actual
  engagement distance, every enemy is the same dark blob and the player cannot read
  telegraphs — which silently destroys the combat design that RI-AI01 and the frame-data items
  spent so much effort specifying. D1 is cheap and it protects the most expensive work in the
  project.

## Provenance note

`provenance: constructed`, `confidence: high`.

**Formulas and techniques are standard; thresholds are ours.** The measurement techniques —
finite-difference velocity/acceleration/jerk on joint trajectories, plant-window detection for
foot sliding, cross-correlation lag for secondary motion, perceptual hashing for pose
identity, IoU for silhouette distinctiveness, Pearson correlation for root-motion authority —
are standard signal-processing and computer-vision constructions, not invented here.

**Every numeric threshold is `constructed`**: `Facets ≤ 1.5/1000px`, `pose_rate ≥ 24/s`,
`Slide_mean ≤ 0.03 m`, `J ≤ 0.010`, `grip_err ≤ 0.02 m`, `blend_frames ≥ 5`, `h ∈ [-0.005,
0.03] m`, `IoU < 0.65`, and all triangle budgets. They were chosen by the authoring agent to
sit at the boundary of human perceptibility (e.g. 3 cm of foot slide per step is at the edge
of noticeable at typical camera distances; 5 blend frames ≈ 83 ms is the shortest transition
that does not read as a cut) — **but they have not been validated against measured
current-gen data**, and no reference animation trace was obtained. Treat them as a starting
calibration.

**Calibration path, in priority order:** (1) the foot-slide and blend-length thresholds are
the two most consequential and the two easiest to validate — run C3 and C5 against any
commercially available character controller sample and adjust; (2) triangle budgets should be
checked against the actual GPU budget of our target browser hardware, and may need to come
*down*, in which case B1 (silhouette faceting, which is the thing the viewer actually sees)
becomes the binding constraint rather than B2; (3) `pose_rate ≥ 24/s` assumes interpolated
playback of ≥ 30 Hz source clips and should be restated if we adopt a different authoring
rate.

The `§A` trace schema is `constructed` and is modelled deliberately on RI-AI01 §A's enemy
trace record so that the two harnesses share a frame clock, a field-contract convention, and
the same fail-closed rule for missing fields. Where the two records describe the same entity
in the same frame they must agree; a disagreement is a harness defect and fails the wave
before any metric is computed.
