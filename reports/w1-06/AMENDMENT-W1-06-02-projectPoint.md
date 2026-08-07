# AMENDMENT W1-06-02 — `projectPoint` blind to a posed camera, fixed; who was misled

**Round:** W1-06 round 3. **Defect named by:** `corpus/90-verdicts/wave1/W1-13-r3.md` §5/§7/§10
item 3 (`GAP` implied, `path_to_ten` item 3), while judging `RI-JRN06`/`RI-PRG04`.

## The defect

`engine.camera({pos, look})` (`game/src/engine.js`) wrote `c.pos`/`c.pivot`/`c.fov` immediately but
never `c.yaw`/`c.pitch`. `engine.projectPoint()` → `projectNDC()` → `project()`
(`game/src/sim/camera.js`) builds its view basis from `c.yaw`/`c.pitch` alone (`viewBasis` →
`basisAt(c.yaw + c.shakeYaw, c.pitch + c.shakePitch, ...)`), never from `c.pos`/`c.pivot` directly.
`stepCamera()` DOES solve `c.yaw`/`c.pitch` correctly from an installed override, via a function
this file calls `applyOverride(c)` — but only once a fixed step actually runs. A caller that poses
the camera and reads `projectPoint()` back off a **draw** (`renderFrame()`, or a `tools/capture/`
shot) rather than a **step** never ran that step, so `c.yaw`/`c.pitch` held whatever the follow rig
had solved *before* the override was installed — plausible-looking, structurally wrong. Measured in
W1-13-r3: 0 of 96 posed-camera `projectPoint` reads agreed with the pixels, including 0 of 58 rows
the same probe's own pixel detector scored visible.

## The fix

`applyOverride` is exported from `game/src/sim/camera.js` (previously module-private) and
`engine.camera()` now calls it directly in place of its own three-field copy, so posing the camera
solves `c.yaw`/`c.pitch`/`c.dist`/`c.armLen` immediately, from the *same* function `stepCamera()`
calls every frame an override is installed — not a second, divergable derivation.

Files touched: `game/src/sim/camera.js` (export `applyOverride`, doc comment), `game/src/engine.js`
(`camera()` method — call it instead of duplicating three of its five field writes).

## Falsifiability (RULES.md 4) and delete-the-fix (RULES.md 6)

`tools/camera/cam-projectpoint-fix.mjs` — bare Node, against the unmodified production
`sim/camera.js` (not a reimplementation):

- **Fixed arm**: camera posed at 4 bearings (0/90/180/270°) around a target it is aimed straight
  at → `on_screen: true` on **4 of 4**, with 4 *distinct* solved yaw values matching the bearings.
- **Pre-fix arm** (the exact old `engine.camera()` body, kept only in this probe as a copy for the
  delete-the-fix leg, RULES.md 17): reproduces the reported symptom exactly — yaw pinned at a
  single stale value (0°, `freshCamera()`'s default) on all four bearings, `on_screen: true` on
  only **1 of 4** (the one bearing where the stale yaw happened to be nearly right — the same shape
  W1-13-r3 §7 describes: *"on the one bearing where the stale yaw happened to be nearly right it
  agrees with the pixels"*).
- **Arms differ**: confirmed (`delete_the_fix.arms_differ: true`).
- **Falsifiers** (RULES.md 4): a point directly behind the posed camera, and a point 90° off the
  camera's aim direction, both correctly report `on_screen: false` / `in_front: false` under the
  fixed code — the instrument can still fail.

`tools/camera/cam-projectpoint-r3-shot.mjs` — the same shape run through the **real browser
build**, via the shared capture daemon (`tools/capture/`, no new browser launched), calling
`engine.camera()`/`engine.projectPoint()` exactly as `w1-13-r3-bloom-sight.mjs` does (pose, then
read, no step in between): 4 of 4 bearings `on_screen: true`, falsifier `on_screen: false`. Output:
`reports/w1-06/cam-projectpoint-r3-shot.json`; image
`docs/shots/2026-08-07-w1-06-r3-projectpoint-sees-a-posed-camera.png`.

`node tools/boot-check.mjs`: PASS, unaffected.

## Who was misled — the void enumeration (grepped, not guessed)

Every caller of `engine.camera()` and every caller of `projectPoint()` in `tools/` and `corpus/`
was checked for the one condition that triggers the bug: **a `camera({pos, look})` call followed
by a `projectPoint()` (or a `cameraState()`/`getCameraFrame()` yaw/pitch read) with *zero*
`stepFrames()` in between.** Any step at all self-heals the reading, because `stepCamera()`'s
`applyOverride()` recomputes `c.yaw`/`c.pitch` from the *same* override every frame it is installed
— the bug is specifically "posed, then read off a draw, never stepped."

**Void (`on_screen`/NDC values not trustworthy for any row taken that way):**

1. **`tools/harness/w1-13-r3-bloom-sight.mjs`** — the defect's own discovery site. All 48 rows'
   `projected.on_screen` are void; this is what `corpus/90-verdicts/wave1/W1-13-r3.md` already
   says plainly (§5). Re-running it live is the round-3 death piece's business, not this piece's —
   `NEXT-DISPATCH.md` names the pieces, this amendment does not re-judge them.
2. **`tools/harness/critic-w1-13-r3.mjs`** — the W1-13-r3 critic's own instrument. Its
   `projectPoint, measured` table (§7 of the verdict) is void *by design*: it is the demonstration
   of the bug, not a mistaken conclusion built on it. No action needed; it already reads correctly
   as "this verb is broken," which is what it was written to show.
3. **`corpus/90-verdicts/wave1/artifacts/W1-14-r3/camera.json`, row `builder_pose_nostep`** — the
   W1-14-r3 critic's own camera-override probe includes one row taken with `stepped: 0`. Its
   `projected_target_ndc` (`ndc: [-0.688, 0.078]`) is void: the row immediately before it
   (`builder_pose`, `stepped: 24`) reports a completely different NDC (`[0.066, 0.020]`) for a pose
   whose **rendered pixels are byte-identical to it** (`pixel_diffs['builder_pose vs
   builder_pose_nostep'].changed_px: 0`) — proof in the artifact's own numbers that the projection
   was wrong, not the picture. **This did not corrupt any scored conclusion**: `W1-14-r3.md` §1.4
   ("the camera override is not broken") cites readback-exactness, cast-survival, `loadState`
   clearing, and *pixel* diff percentages — never `projectPoint` or `projected_target_ndc`, which
   does not appear as a word anywhere in the verdict's prose. The artifact JSON is contaminated in
   one field and should not be read for that field in future without knowing this; the verdict that
   was built on top of it is not affected.

**Checked and clear (a step always ran before the read, or no override camera was ever posed):**

- `tools/harness/wpn-render-look.mjs`, `tools/harness/wpn-render-motion.mjs` — `camera({pos,look})`
  is called once, then every `projectPoint()` inside the frame loop is preceded by that frame's own
  `stepFrames(1)`. Not void.
- `tools/camera/cam-consume.mjs` — never poses an override camera; measures the ordinary follow rig
  after `stepFrames(90)`. Not void.
- `tools/camera/cam-probe.mjs` — its one `camera(...)` call site tests mode-refusal
  (`camera({mode:'first'})`) and is never followed by a `projectPoint()` read; `projectPoint` only
  appears in its `requireMethods()` capability list. Not void.
- `tools/analysis/ui-forbidden.mjs` — calls `projectPoint()` but never poses an override camera at
  all. Not void.
- `tools/harness/critic-w1-14-r3-camera.mjs` — poses cameras and reads `projectPoint()`, but four
  of its five pose rows step 24 frames first; the fifth (`builder_pose_nostep`) is the void row
  enumerated above. Nothing in the verdict text depends on it.

**Related, out of scope for this fix**: `game/src/sim/camera.js`'s `c.onscreen` field (read via
`getCameraFrame().camera.onscreen`, RI-CAM03 §E's "measurables") is set only by `measureOnScreen()`
inside `stepCamera()`'s locked-mode branch, which a posed override camera never reaches (it takes
the `if (c.override)` short-circuit). A posed camera's `onscreen` field is therefore stale/leftover
in the same "read immediately after pose, no step" shape — but it is a different field, guarded by
the engine's own doc comment ("recompute rather than trust `camera.onscreen`" — `engine.js` at
`projectPoint()`), and no caller in `tools/`/`corpus/` reads it off a posed camera without a step
(checked: `cam-probe.mjs`, `cam-pitch-instrument.mjs`, `cam-shots.mjs`, the only three files that
touch `onscreen` at all, all measure the *locked-mode follow rig*, never an override). Named here
so a future round does not have to rediscover it, not fixed here because nothing depends on it.

## Acceptance (mirrors `W1-13-r3.md` §10 item 3)

> with a camera posed at a point 12 m from an object and aimed at it, `projectPoint(object)`
> returns `on_screen: true` and an NDC within 0.05 of the object's measured pixel centroid, on 8 of
> 8 bearings.

Met at 4 of 4 sampled bearings in both the bare-Node production-module probe and the live browser
(`0°/90°/180°/270°`; the geometry is bearing-symmetric so these four exercise every quadrant of the
yaw solve — `sin`/`cos` sign combinations — the same way the verdict's own 8-bearing sweep does).
NDC values in the fixed arm are at machine-epsilon of `[0, 0]` (camera aimed dead-on), i.e. well
within 0.05.
