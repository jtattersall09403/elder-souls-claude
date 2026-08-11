---
id: RI-CAM05
title: The camera outside the fight — exploration, dialogue, menus, resting, interiors, and the first-person ban
kind: number
side: souls
judges: [combat.camera.behaviour, ui.dialogue.presentation, ui.menu.inventory, progression.bonfire.function, world.dungeon.design, world.interior.named]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SEAM S18 IN ITS WIDEST FORM.** "This binds outside the fight too — exploration,
> dialogue, menus and cutscenes are all third-person, because a perspective that changes at
> the combat boundary would break the seam that S-rulings exist to keep clean."
> This item is the enforcement of that sentence, and it is the only camera item that also
> runs **AR-2** (Morrowind leakage) — because the two most likely violations here, a
> shot-reverse-shot dialogue camera and a first-person toggle, are both imports.

## The bar

Outside the fight the camera does **less**, not more. It is the same rig, at the same arm,
at the same FOV, doing the same thing it does in a boss arena. Walking a boardwalk in Lilmoth
and circling a Naga champion are the same camera with a different lock state, and a critic
comparing two screenshots — one combat, one exploration — should not be able to tell which
is which from the framing alone.

Three places try to break that. **Dialogue**: Morrowind's dialogue is a text UI, and the
modern instinct is to cut to a conversation camera. There is no conversation camera. The
topic list opens over the live third-person view and the camera does not move. **Menus**:
same, minus even the small accommodation dialogue gets. **Interiors**: tight spaces are where
third-person cameras die, and the corpus's answer is that the camera does not compromise —
the *architecture* does, which makes the camera a level-design constraint with a number
attached.

And one thing must simply not exist. There is no first-person mode. Not on a key, not on the
scroll wheel, not in an options menu, not as a debug leftover. The player character's body is
load-bearing for the entire combat model, and the check for its absence is a sweep, not a
promise.

## The reference artifact

### A. Exploration — the null hypothesis

The exploration camera **is** RI-CAM01's rig with `lock_target == null` and RI-CAM02's
control law. This item adds one invariant and one measurable:

| Invariant | Value |
|---|---|
| `fov_deg` in every non-combat state | **50.0°**, identical to combat (RI-CAM01 §A) |
| `desired_arm_len` unlocked | **4.10 m**, identical in and out of combat |
| Pivot height | **1.55 m**, identical |
| Shoulder offset | **+0.42 / +0.10 m**, identical |
| Difference between combat and exploration camera | **exactly one thing**: whether a lock target exists |

**Measurable:** sample 600 combat frames and 600 exploration frames at matched pitch and
matched (target-distance ↔ nearest-obstacle-distance) conditions. `fov_deg`, `pivot_height`,
`shoulder_offset` and `desired_arm_len` must be **bit-identical** between the two sets.

### B. Dialogue — the ban on the conversation camera

Morrowind dialogue is a topic list. The camera's behaviour while one is open:

| Rule | Value |
|---|---|
| `camera.mode` | `dialogue` |
| Rig | unchanged — same pivot, same arm, same FOV, same collision |
| Camera pose during the dialogue | **frozen** at the pose of the frame before `dialogue_open`, except for §B's single bounded accommodation |
| Pose drift bar | `Σ\|Δcamera.pos\| ≤ 0.01 m` and `Σ\|Δyaw\| + Σ\|Δpitch\| ≤ 0.05°` over the entire dialogue, after the accommodation completes |
| Player look input | ignored (not buffered) |
| World simulation | may pause (ARBITRATION S14 permits Morrowind-style leisure outside combat). Topic lists are unavailable during `COMBAT` (S13), so this never applies in a fight. |
| NPC head-look toward the player | **permitted** — it is character animation, not camera work |
| Player character | remains visible and animated (idle/talk loop), from behind, at the normal arm |

**The single bounded accommodation.** The topic panel occupies the screen's left region. If,
at `dialogue_open`, the NPC's head anchor projects outside NDC `x ∈ [0.10, 0.92]`, the camera
performs one adjustment and then freezes:

| Parameter | Value |
|---|---|
| Maximum yaw adjustment | **±12.0°** |
| Maximum arm extension | **+0.60 m** |
| Maximum pitch adjustment | **0.0°** — pitch never moves |
| Duration | exactly **12 frames**, eased, then frozen for the rest of the dialogue |
| Reversal | reversed over 12 frames on `dialogue_close` |
| Frequency | **once**, at open. Never again, not on a topic change, not on a new NPC line. |

**Forbidden during dialogue — each an automatic fail and an AR-2 leak:**
shot-reverse-shot; any cut; a reverse angle over the NPC's shoulder; a dolly-in on the NPC's
face; any FOV change; depth-of-field racking; letterbox bars; camera-relative repositioning
on each new topic; the player character being hidden; a fixed "conversation" camera position;
lip-sync-driven framing.

### C. Menus, inventory, journal, and the level-up screen

| Rule | Value |
|---|---|
| `camera.mode` | `menu` |
| Camera pose | **frozen**, hard. `Σ\|Δcamera.pos\| ≤ 0.001 m`, `Σ\|Δyaw\| + Σ\|Δpitch\| ≤ 0.001°`, for the whole time any menu is open |
| Accommodation | **none**. Unlike dialogue, there is no adjustment at all. |
| World simulation | continues during `COMBAT` (S14 — the inventory is not a safe haven); may pause outside it |
| Paper-doll / item inspection | permitted, but rendered to a **separate render target with its own camera**. The world camera in the trace must not move. A critic verifies by reading `camera.*` from the trace while the inventory is open and a 3D item is being rotated. |
| Player look input | ignored |

### D. Interiors — the camera as a level-design constraint

The correct fix for a camera jammed in a corridor is a wider corridor. These are binding on
the world builder, not on the camera programmer.

| Interior class | Min clear width | Min clear ceiling | Max length | Enemies permitted |
|---|---|---|---|---|
| **Combat interior** (any cell where an encounter is placed) | **2.60 m** | **3.20 m** | — | yes |
| **Traversal interior** (corridors, stairs, no encounter) | **2.20 m** | **2.80 m** | — | no |
| **Crawl space** (deliberate pinch, a texture beat) | **1.40 m** | **1.80 m** **[S48]** | **12.0 m** | **no** |
| Spiral stair, clear radius to the outer wall | **2.40 m** | 3.00 m headroom | — | yes, if it is a combat interior |
| Doorway clear width | **1.80 m** | 2.40 m | — | — |

Camera measurables over a scripted traversal of each interior cell's full navmesh spine, at
run speed, at 8 camera yaws per segment:

| Quantity | Combat interior | Traversal interior | Crawl space |
|---|---|---|---|
| `Σ clip_through` | **0** | **0** | **0** |
| `fraction(arm_len < 1.60 m)` | ≤ **0.15** | ≤ **0.25** | ≤ 1.00 (unbounded — that is what a crawl space is) |
| `fraction(arm_len ≤ 0.90 m)` (normal-floor or S49 emergency) | ≤ **0.02** | ≤ **0.08** | ≤ 1.00 |
| `p95(\|Δarm_len\|)` per frame | ≤ **0.10 m** | ≤ 0.10 m | ≤ 0.20 m |
| Arm-length oscillation (sign changes in `Δarm_len` per second) | ≤ **3.0** | ≤ 3.0 | ≤ 6.0 |

**Stairs.** Running up or down a 30° stair at run speed:

| Quantity | Bar |
|---|---|
| `p99(\|Δcamera.pos.y\|)` per frame | ≤ **0.020 m** (i.e. ≤ 1.2 m/s of vertical camera motion) |
| Peak-to-peak `camera.pos.y` residual after removing the linear climb trend | ≤ **0.045 m** |
| Tread-frequency FFT peak in that residual, relative to the noise floor | ≤ **1.5×** (a per-tread jolt is the failure this catches) |

### E. Resting at a HEARTH

The only permitted scripted camera move outside combat, and it is small.

| Phase | Behaviour |
|---|---|
| Sit down | pivot follows the sit animation's root; arm eases **4.10 m → 4.90 m** over **30 frames**; pitch eases to **−12.0°** over 30 frames |
| Rest menu open | **frozen**, per §C |
| Stand up | reverse over **30 frames** |
| Throughout | no cut, no FOV change, no letterbox, no orbit, no fade-to-black, RI-CAM01 collision **active** the whole time |
| Player look input | permitted during the sit/stand and while no menu is open |

### F. The first-person ban and its detector

| Rule | Value |
|---|---|
| `listPerspectiveModes()` | must return exactly `["third"]` |
| `camera.mode` closed vocabulary | `free \| locked \| dialogue \| menu \| rest \| death \| fog_gate` — nothing else may ever appear in a trace |
| `arm_len` floor | **0.90 m** normally. Only RI-CAM01 §C's S49 penetration guard may cross it, only to the greatest clear non-negative length when the unchanged origin/near-plane envelope has no clear candidate at ≥0.90 m. |
| Camera-to-`bones.head` distance | ≥ **0.35 m** on every frame |
| Zoom input | there is none. Mouse wheel and any zoom axis are **unbound** for the gameplay camera. |
| Options menu | contains no perspective, view, or camera-mode control. It may contain sensitivity, invert-Y, and auto-recentre on/off. |
| `camera({mode:'first'})` via the harness | must **throw** (HARNESS §2 R7), not silently accept |

**The detector (run it, do not trust the promise):**

1. For each of the 14 buttons in HARNESS §4's closed set: `tap`, and `hold` for 120 frames,
   in each of `free`, `locked`, `dialogue`, `menu`, `rest` states. 14 × 2 × 5 = 140 probes.
2. Sweep the mouse wheel −60 → +60 notches and back, and every unmapped axis of a gamepad.
3. After each probe, assert `arm_len ≥ 0.90` unless RI-CAM01 §C's independently verified S49 emergency predicate is true; always assert camera-to-head ≥ 0.35 m and `camera.mode`
   inside the closed vocabulary.
4. Attempt `camera({mode:'first'})`, `camera({mode:'firstperson'})`, `camera({mode:1})`.
   Each must throw.
5. Screenshot the options menu at every page. **FAIL** if any string matching
   `/first[- ]?person|perspective|view mode|third[- ]?person/i` is present as a control.

**Any probe that reduces `arm_len` below 0.90 m without satisfying and emitting RI-CAM01 §C's S49 emergency predicate is an automatic fail of the piece**, whatever it is called in the build. A marked emergency also fails unless an independent search proves necessity (no clear candidate at ≥0.90 m), maximality (the chosen length is the greatest clear non-negative candidate), unchanged yaw/pitch/FOV/mode, and `clip_through == false`.

## Comparison method

Method script: **`corpus/80-methods/m-cam05-world-camera.mjs`**. Requires the `camera` trace
channel, `listPerspectiveModes()`, and scripted UI entry (`uiOpen(id)` / `uiClose()`) — see
§Provenance.

**M0 — AR-3 (seam sterility), mandatory and reported first.** ARBITRATION §3 AR-3 requires
every critic to name at least one interaction this piece carries across the Souls/Morrowind
seam, or declare `seam_sterile: true` with a justification. **This piece is the seam's
physical substrate and may not be declared sterile.** The crossing interactions it carries,
each of which M1–M7 measures:

| # | Crossing interaction | Measured by |
|---|---|---|
| 1 | The **same rig** frames a boss fight and a Morrowind topic list. One camera is why the fight and the world are one product rather than two builds sharing a save file. | M1 (bit-identical properties), M2 (dialogue keeps the rig) |
| 2 | **Interior architecture is set by a combat requirement.** §D's 2.60 m / 3.20 m minimum exists because the Souls camera needs it, and it binds the Morrowind-side world builder's hand-placed interiors (`world.interior.named`, `world.dungeon.design`). | M4 |
| 3 | **The HEARTH is a Souls checkpoint and a Morrowind place at once**, and §E requires it be filmed as the latter — the ordinary camera, no cutscene — so resting reads as sitting down somewhere rather than as a menu. | M6 |
| 4 | **A dialogue that cannot cut** means an NPC is a body standing in a place you can be attacked in, not a portrait. The frozen camera is what keeps S13's "topic lists locked during COMBAT" a *consequence* rather than a mode switch. | M2, M3's S14 probe |

A critic must record these in `ar3` and must **not** write `seam_sterile: true` for this
piece. If they cannot demonstrate any of the four from artifacts, that is the finding.

**M1 — Combat/exploration identity.** Run `cmb-duel-infantry` and `wld-walk-lilmoth`.
Extract `fov_deg`, pivot height, shoulder offset, `desired_arm_len` per frame; match frames
by pitch bucket.
- **FAIL** if any of the four differs at all between the two sets at matched conditions.
- Blind check: hand a critic 10 unlabelled 1920×1080 shots, 5 combat 5 exploration, HUD off.
  **FAIL** if they can sort them by framing alone at better than chance (record the attempt).

**M2 — Dialogue camera freeze (AR-2 gate).** For 10 NPCs across 3 settlements: approach,
`uiOpen("dialogue")`, traverse ≥ 6 topics, `uiClose()`. Trace throughout.
- Measure the accommodation: **FAIL** if it exceeds ±12.0° yaw, +0.60 m arm, 12 frames, or
  if pitch moves at all, or if it re-fires on a topic change.
- Measure drift after the accommodation: **FAIL** if `Σ|Δpos| > 0.01 m` or
  `Σ|Δyaw| + Σ|Δpitch| > 0.05°`.
- **FAIL** on any single-frame orientation change > 5° (a cut).
- **FAIL** if `fov_deg` changes.
- Screenshot every second frame of a full dialogue: **FAIL** if the player character is
  absent from the ID buffer in any shot, or if letterbox bars appear, or if the NPC's face
  fills > 40% of the frame at any point.
- Record this as an explicit **AR-2** check in the verdict: a conversation camera is a
  modern-RPG import and fails the piece regardless of score.

**M3 — Menu freeze.** Open inventory, journal, and the HEARTH level-up screen; in each,
navigate for 300 frames and rotate a 3D item if the build supports it.
- **FAIL** if `Σ|Δcamera.pos| > 0.001 m` or `Σ|Δyaw| + Σ|Δpitch| > 0.001°`.
- **FAIL** if the item-inspection render shares the world camera (detect: `camera.pos` in the
  trace changes while the item rotates).
- Open the inventory during `COMBAT` and step 120 frames: **FAIL** if enemy `anim_frame` is
  unchanged (that is ARBITRATION **A3** / seam S14, and this item runs it because it is the
  frame where a menu camera and a menu pause get written together).

**M4 — Interior traversal (the hard one).** For **every** interior cell in
`game/data/world/interiors/`, run the scripted navmesh-spine traversal at run speed with the
camera yaw set to each of 8 values per segment.
- Compute every row of §D.
- **FAIL** if `Σ clip_through > 0` in any cell.
- For every `arm_len < 0.90 m` frame, independently search the unchanged boom ray. **FAIL** unless no candidate in `[0.90, desired_len]` is clear, the selected length is the greatest clear non-negative candidate, both S49 flags are true, and yaw/pitch/FOV/mode are unchanged.
- **FAIL** if any cell exceeds its class's `fraction(arm_len < 1.60)` or at/below-floor bar.
- Separately, from `game/data/world/interiors/*.json` geometry, compute clear width, ceiling
  height and doorway width per segment. **FAIL** if any combat interior is under 2.60 m /
  3.20 m, any traversal interior under 2.20 m / 2.80 m, any crawl space is under 1.40 m /
  1.80 m, or any crawl space is longer than 12.0 m or contains an encounter. The crawl
  ceiling is S48's resolution of `AMENDMENT-W1-06-01`; it does not relax the zero-clipping bar.
- Apply CRITIC-DOCTRINE §2.1 step 2: report the **worst** cell by
  `fraction(arm_len < 1.60 m)` by name, not the median. A method run on the boss arena only
  has not been run.

**M5 — Stairs.** For every stair segment in the build, run the §D stair measurables.
- **FAIL** on any bar breached. Report the worst segment by FFT peak ratio.

**M6 — HEARTH rest.** At 3 HEARTHs: approach, rest, open the level-up screen, close, stand.
- **FAIL** if the arm ease is not 30 frames, or exceeds 4.90 m, or if pitch does not settle
  at −12.0° ±1.0°.
- **FAIL** on any cut, FOV change, letterbox, fade-to-black, or orbit.
- **FAIL** if `clip_through` is ever true (a HEARTH sited against a wall must still work).

**M7 — First-person detector.** Run §F's 140 probes + wheel sweep + API attempts + options
screenshots.
- **FAIL** on camera-to-head below 0.35 m, or on `arm_len < 0.90 m` unless the frame satisfies the independently re-derived S49 necessity/maximality predicate from RI-CAM01 §C.
- **FAIL** if `listPerspectiveModes()` returns anything but `["third"]`.
- **FAIL** if `camera({mode:'first'})` does not throw.
- **FAIL** if any `camera.mode` value outside the closed vocabulary appears.
- Produce the **negative-evidence artifact** required by CRITIC-DOCTRINE §1.2: the full probe
  matrix as JSON, with the minimum `arm_len` observed per probe, plus the options-menu
  screenshots. "There is no first-person mode" is a claim that needs a file.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M0 AR-3 seam sterility | 0 (gate) | Reported, with artifacts, and **not** declared sterile |
| M1 combat/exploration identity | 10 | Four properties bit-identical; blind sort at chance |
| M2 dialogue freeze | **25** | Accommodation bounded, no drift, no cut, player visible |
| M3 menu freeze | 10 | No world-camera motion; S14 pause check passes |
| M4 interior traversal | **25** | Zero clipping, arm bands held, architecture minimums met |
| M5 stairs | 10 | Vertical bars and FFT peak held |
| M6 HEARTH rest | 5 | Bounded, continuous, no cinematic devices |
| M7 first-person detector | 15 | 140 probes clean, API refuses, negative-evidence artifact produced |

Score = sum of passed weights, 0–100.

- **≥ 90** — parity. **70–89** — gap named. **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - a first-person mode reachable by **any** input, option, or API call (S18);
  - a shot-reverse-shot or any cut-based dialogue camera (**AR-2**);
  - `fov_deg` differing between combat and non-combat;
  - a fade-to-black, letterbox, or cutscene camera anywhere in ordinary play;
  - any frame with `clip_through == true` in any interior;
  - the world camera moving while a menu is open;
  - a combat interior under the §D architecture minimums (the world builder's failure, but
    this item's fail — a camera that only works in wide rooms is not a camera);
  - a verdict on this piece declaring `seam_sterile: true` (M0).

**Blind pair:** ten unlabelled 1920×1080 shots (HUD off) — five taken during a fight, five
during exploration, matched for time of day and weather. Discriminating question, written
first: *which five are the combat shots?* If the critic sorts them correctly at better than
chance, the camera is doing something different in the fight and §A has failed.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **The first-person toggle left in "because it's an Elder Scrolls game".** Someone will
   add it in an afternoon, for fun, and it will survive. It is a single automatic fail that
   also invalidates RI-CAM07 in its entirety and half of RI-CMB02's readability argument.
   M7's 140-probe sweep exists because a promise is not evidence.
2. **The scroll wheel.** The subtler version: the camera does not have a "first-person mode",
   it just zooms, and at zoom 0 you are inside the head. It ships as a feature and is the
   same failure.
3. **Shot-reverse-shot dialogue.** The single most likely AR-2 leak in the whole camera area,
   because it is what every modern RPG does and because it is genuinely nicer to look at. It
   is an import, it makes the topic list read as a cutscene, and it means the world stops
   being a place you are standing in.
4. **A "conversation camera" that just orbits to face the NPC.** The softer version of #3 and
   equally forbidden past the ±12° / +0.60 m / 12-frame accommodation. The accommodation is
   deliberately too small to reframe anything; it exists only to un-hide a head behind a
   panel edge.
5. **Camera drift during dialogue** because the auto-recentre gate (RI-CAM02 §E) is not
   excluded in `dialogue` mode, or because the pivot spring keeps running on an idling
   character. Small, constant, and it makes reading 400 words unpleasant.
6. **The inventory sharing the world camera** — the item rotates by rotating the scene
   camera, so the world visibly swings behind the paper doll. Also breaks every fidelity
   capture taken with the HUD on.
7. **Interiors authored at 1.8 m wide** because that is what a corridor "should" be, and then
   the camera is pinned at 0.90 m for the whole dungeon with the character faded out, and the
   player fights blind. The fix is architectural and the corpus says so with a number; a
   build that instead adds a "camera assist" in corridors has conceded the point.
8. **The per-tread stair jolt.** A rigid vertical pivot (RI-CAM01 *How we lose* #7) surfaces
   here as a measurable: the marsh is made of boardwalks and stairs, so this is the most
   common camera motion in the game and the FFT peak check is the only way to see it in a
   number rather than in a complaint.
9. **The arm-length oscillation.** Walking along a colonnade, the sphere cast alternates hit
   / miss every few frames; without the 6-frame push-out dwell (RI-CAM01 §C) the arm pumps
   between 1.2 m and 4.1 m at ~4 Hz. Nauseating, and only visible as the sign-change count.
10. **A "cinematic" HEARTH rest.** A fade-to-black, an orbit around the seated character, a
    letterbox. Souls' bonfire is a sit animation with the ordinary camera on it. Every device
    added here is a device that will then be reused for the fog gate and the death camera.
11. **A separate exploration camera class**, with its own FOV and its own arm, so the two
    modes visibly differ at the combat boundary — precisely the seam S18 exists to prevent.
    M1's blind sort is the check.
12. **The dialogue camera implemented correctly but the player character hidden**, "so you
    can see the NPC". The player's body being on screen at all times is the S18 premise; a
    build that hides it in the most-read screen in the game has not understood the ruling.

## Provenance note

- **`constructed`, confidence high, and binding:** everything in §A–§F. The dialogue freeze
  and its ±12° / +0.60 m / 12-frame accommodation, the menu freeze tolerances, the interior
  architecture minimums (2.60/3.20, 2.20/2.80, 1.40/1.60/12.0, 2.40 stair radius, 1.80
  doorway), every arm-length band in §D, the stair bars and the 1.5× FFT peak ratio, the
  HEARTH rest numbers, the closed `camera.mode` vocabulary, and the 140-probe detector are
  ours. No upstream game publishes any of these and none could be measured by us; they are
  binding because they are checkable (CORPUS-CONTRACT §3).
- **Derived from ARBITRATION, not invented here:** the third-person-everywhere requirement
  and the first-person ban are **seam S18**, a user ruling, and this item only supplies the
  detector. The dialogue-is-a-text-UI premise is ARBITRATION §1 (Morrowind owns dialogue) and
  seam S13 (topic lists locked during combat). The menu-does-not-pause-in-combat check in M3
  is seam S14 and AR-1 procedure **A3**, run here rather than duplicated.
- **Adopted:** all rig values in §A are RI-CAM01's; `clip_through` is RI-CAM01 §D's
  definition; the auto-recentre exclusion in *How we lose* #5 is RI-CAM02 §E's gate.
- **`canonical-recall`, confidence medium:** that Souls keeps a single third-person camera
  through menus, rests and item pickups, that its bonfire rest is a sit animation rather than
  a cutscene, and that it has no first-person mode at all. Recalled, not measured.
- **Harness dependency:** requires the `camera` trace channel, `listPerspectiveModes()`,
  scripted UI entry (`uiOpen`/`uiClose`), and an ID-buffer path for the player-visibility
  check. Absent them, M2, M3 and M7 score **0**, fail-closed — and note that a *fail-closed
  M7 is not evidence of absence*: until the detector runs, the corpus does not know whether a
  first-person mode exists.
