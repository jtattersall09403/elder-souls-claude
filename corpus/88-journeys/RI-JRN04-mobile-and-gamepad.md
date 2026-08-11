---
id: RI-JRN04
title: Mobile with an attached gamepad — the GameSir X2s, the button map, and a phone that is not a workstation
kind: structure
side: souls
judges: [input.gamepad.mapping, input.gamepad.analog, input.gamepad.lifecycle, input.touch.fallback, input.modality.parity, platform.mobile.viewport]
provenance: community-data
confidence: medium
blind_pair: no
---

> **This item judges a JOURNEY, not a subsystem.** It is one of eight in `corpus/88-journeys/`.
>
> **Division of labour, binding:** `RI-JRN03` owns the **desktop** input path (pointer lock,
> WASD+mouse, keyboard hazards, rebinding UI, discoverability) and owns the **canonical action
> set** (`input.action.set`). This item owns **gamepad and touch**, and consumes the action set
> without redefining it. Where both items touch rebinding, `RI-JRN03` owns the *model* and this
> item owns the *gamepad profile data*. **`RI-PLT01`/`RI-PLT02` own the frame and memory
> budgets**; this item owns only the statement that the reference device is a phone and the
> requirement that the budgets be met *on one*. **`RI-CAM02`/`RI-CAM04` own camera behaviour**
> and this item owns only the stick-to-camera input transform (deadzone, curve, sensitivity).
> **`RI-JRN01` O17 owns modality parity for the opening**; this item generalises it to the
> whole game.
>
> **`blind_pair: no`.** There is no meaningful blind comparison of a button map. The
> discriminating question ("does it work") is answered by measurement, not preference.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

A person is on a train. They have a phone in a **GameSir X2s Type-C**, a telescopic USB-C pad
clamped around it. They open a URL. Within one screen they are in the world, in landscape, with
the notch out of the way, and **every one of the fourteen actions in the closed action set is on
a physical control where a Souls player's thumb already expects it.** They roll with B. They
light-attack with RB. They hold LB and take a hit on the shield. They flick RT and the heavy
comes out with a charge if they hold it. They click the right stick and lock on. Nothing on
screen ever says "press A". They never see a keyboard, a cursor, or a hover state.

Then the cable jogs in the port, the pad drops for 400 ms, and reconnects. The character does
not sprint into a wall for four hundred milliseconds. It stops. When the pad comes back, play
continues from where it was.

Then they pull the phone out of the pad entirely, and **the game is still playable** — worse,
but playable, on touch, with the same fourteen actions reachable.

That is the bar, and the reason it is a hard bar rather than a nice-to-have is `RI-JRN01` O17:
the opening must be completable on gamepad only and on touch only, and a control scheme that
only works with a mouse makes the entire corpus unmeasurable on the device most people have.
The counterpart bar is negative and equally binding: **the fix for a control problem is never a
tutorial pop-up** (`RI-JRN01` "How we lose" #6, cross-rule).

## The reference artifact

### A. The device (`community-data`, confidence medium)

Facts about the **GameSir X2s Type-C** used to derive the map below. Every one of these came
from vendor and review pages via search; direct page fetches were blocked (403), so these are
**reported facts, not measurements taken here**, and the item is designed so that no threshold
depends on any of them being exactly right.

| Property | Value | Source |
|---|---|---|
| Form | Telescopic, phone clamps between two halves; **wired USB-C**, so no pairing and no Bluetooth latency | vendor page; SlashGear review |
| Layout | Twin-stick **asymmetric** (left stick high-left, right stick low-right), **16 inputs**, ABXY + D-pad, SNES-styled shell | vendor page; SlashGear review |
| Sticks | **Hall-effect** analog sticks | vendor page; Amazon listing |
| Triggers | **Hall-effect analog triggers**, "256-level", full travel; **hair-trigger mode** toggled by holding **Capture + LT/RT for 2 s** | vendor page; SlashGear review |
| Shoulders | Microswitch L1/R1, clicky, ~3M-click rated | vendor page |
| Extra controls | Home/Guide, Capture/Screenshot, Menu/Start, Back/Select, plus a GameSir "G" function key on the family | vendor page; manuals.plus X2s manual |
| Enumeration on Android | Defaults to a **DualSense-like HID profile**, with a user-remappable mode selectable on connect | SlashGear review |
| Browser exposure | Chrome for Android, Samsung Internet and Firefox for Android all expose the Gamepad API; a pad commonly does **not appear in `navigator.getGamepads()` until the first button press** | MDN; web.dev |

**The consequence that matters most is the second-to-last row.** Because the X2s can present as
a DualSense-like HID device rather than as an XInput device, **`gamepad.mapping === 'standard'`
is not guaranteed**, and a build that assumes it will silently deliver a scrambled map on the
exact device the user named. §C exists for that reason.

### B. The W3C Standard Gamepad reference (`canonical-recall`, confidence high)

The layout every `mapping: 'standard'` device is normalised to. Corroborated against the W3C
Gamepad specification and secondary references; the spec page itself returned 403 to direct
fetch, so this table is recalled and cross-checked, not scraped.

| idx | Standard Gamepad | Xbox | PlayStation | Notes |
|---|---|---|---|---|
| 0 | right cluster, bottom | A | Cross | |
| 1 | right cluster, right | B | Circle | |
| 2 | right cluster, left | X | Square | |
| 3 | right cluster, top | Y | Triangle | |
| 4 | left front, top | LB | L1 | digital |
| 5 | right front, top | RB | R1 | digital |
| 6 | left front, bottom | LT | L2 | **analog**, `.value ∈ [0,1]` |
| 7 | right front, bottom | RT | R2 | **analog**, `.value ∈ [0,1]` |
| 8 | centre cluster, left | Back/View | Share/Create | |
| 9 | centre cluster, right | Start/Menu | Options | |
| 10 | left stick press | L3 | L3 | |
| 11 | right stick press | R3 | R3 | |
| 12 | D-pad up | | | |
| 13 | D-pad down | | | |
| 14 | D-pad left | | | |
| 15 | D-pad right | | | |
| 16 | centre cluster, centre | Guide | PS | **may be absent** — never required |

| idx | Axis | Range |
|---|---|---|
| 0 | left stick X | −1 left … +1 right |
| 1 | left stick Y | **−1 up … +1 down** |
| 2 | right stick X | −1 left … +1 right |
| 3 | right stick Y | **−1 up … +1 down** |

`buttons[i].value ∈ [0,1]`; `buttons[i].pressed` is a **UA-determined** boolean and its
threshold differs between browsers. **Binding rule G0: the game reads `.value` for indices 6
and 7 and applies its own thresholds (§D). Reading `.pressed` on a trigger is a defect.**

### C. `ES/PAD` — the button map (BINDING)

Mapped onto the closed action set from `HARNESS.md` §4. Two profiles ship; both are complete;
both are rebindable (`RI-JRN03` owns the rebinding model).

**Profile `souls-default`** — Souls muscle memory, unchanged. Selected on desktop-class pads.

| Physical | idx | Action | Semantics |
|---|---|---|---|
| RB / R1 | **5** | `light` | press = swing; buffered per `combat.input.buffer` |
| RT / R2 | **7** (analog) | `heavy` | press past `T_fire`; **hold past `T_full` = charged heavy** (`combat.attack.charge`) |
| LB / L1 | **4** | `block` | **hold**, not toggle. Guard is up while held and only while held |
| LT / L2 | **6** (analog) | `parry` | press past `T_fire`. Discrete: a parry is an input event, never a hold |
| B / Circle | **1** | `roll` / `sprint` | **tap ⇒ `roll`; hold ⇒ `sprint`.** Discriminator: released within **12 frames (200 ms)** of press ⇒ `roll` emitted on release; still held at frame 12 ⇒ `sprint` held from frame 12 until release. This is the Souls behaviour and it is the single most muscle-memory-load-bearing binding in the game |
| A / Cross | **0** | `interact` | also confirms in dialogue and menus |
| X / Square | **2** | `use_item` | consumes the selected quick-slot item (`combat.heal.charges`) |
| Y / Triangle | **3** | `two_hand` | **hold ≥ 12 frames** to toggle two-handing, so a stray tap does not change your stance mid-fight |
| L3 | **10** | `jump` | Souls-canonical placement |
| R3 | **11** | `lock_on` | press = acquire/release; **right stick flick past 0.7 while locked = target switch** (`combat.lockon.switch`) |
| D-pad ← | **14** | `swap_left` | cycles left-hand equipment |
| D-pad → | **15** | `swap_right` | cycles right-hand equipment |
| D-pad ↑ | **12** | *(reserved)* | quick-slot cycle up — **not** in the closed action set; must be declared in `game/data/input/profiles.json` and must not shadow a listed action |
| D-pad ↓ | **13** | *(reserved)* | quick-slot cycle down, same rule |
| Start / Options | **9** | `menu` | |
| Back / View | **8** | *(reserved)* | journal — same declaration rule |
| Guide | **16** | **unbound, always** | may be absent on this device class and is captured by the OS on some platforms. Binding anything to 16 is a defect |
| Left stick | axes **0,1** | move | camera-relative; `[x, −y]` into the harness `move` vector, so "stick up" is `+1` forward (`HARNESS.md` §4 uses `move:[0,1]` for forward) |
| Right stick | axes **2,3** | look | `[x, −y]` into `look`; pitch inversion is a setting, default non-inverted |

**Profile `souls-handheld`** — auto-selected on a coarse-pointer device (§F H2). Two changes,
both because **clicking a small Hall stick on a clamped telescopic pad is unreliable and
physically moves the phone**:

| Physical | idx | Action | Changed from |
|---|---|---|---|
| A / Cross | **0** | `jump` | was `interact` |
| Y / Triangle | **3** | tap = `interact`, hold ≥ 12 frames = `two_hand` | was `two_hand` only |
| L3 | **10** | `interact` (secondary, retained) | was `jump` |
| R3 | **11** | `lock_on` (retained) **and** duplicated onto **Back (8)** | — |

Everything else is identical. **Rule G1: both profiles must bind all fourteen actions of the
closed set. A profile with an unbound action is a hard fail**, because it means some part of
the game is unreachable on that device — which is the failure `RI-JRN01` O17 exists to stop.

**Rule G2 (the non-standard-mapping fallback).** If `gamepad.mapping !== 'standard'`:

1. The game consults `game/data/input/pad-quirks.json`, a table keyed by a normalised
   `gamepad.id` (vendor:product where available, else the trimmed id string), giving an
   index permutation onto the §B layout.
2. `X2s` entries are present for both its enumeration modes.
3. If no entry matches, the game presents a **diegetic calibration sequence** — "press the
   button you would swing with", six prompts — writes the result to the profile, and never
   asks again. It does **not** present a raw index table, and it does **not** refuse to run.
4. A build that assumes `mapping === 'standard'` and produces a scrambled map on a
   non-standard pad is **HF2**.

### D. Analog handling (BINDING)

| Quantity | Value | Rationale |
|---|---|---|
| Left stick **radial** deadzone (inner) | **0.14** | Radial, computed on the vector magnitude — **never** per-axis. A square/axial deadzone makes diagonal movement snap and is immediately visible when strafing a boss |
| Left stick outer saturation | **0.92** | magnitude ≥ 0.92 ⇒ 1.0, so a stick that cannot physically reach the corner still gives full sprint |
| Left stick rescale | linear from inner to outer: `m' = clamp((m − 0.14) / (0.92 − 0.14), 0, 1)` | no dead step at the deadzone edge |
| Left stick response curve | **linear** | movement speed maps to stick magnitude directly; Souls locomotion is walk/run/sprint by magnitude and sprint button |
| Walk/run threshold | magnitude **< 0.55 = walk**, ≥ 0.55 = run | gives analog walking, which matters for ledges and for the Morrowind half |
| Right stick inner deadzone | **0.10** | camera; a Hall stick rests tighter than a potentiometer, and 0.10 is already generous |
| Right stick response curve | `out = sign(m') · m'^2.0` after rescale | fine aim near centre, fast whip at the edge (`RI-CAM02` owns the resulting camera speed; this item owns only the curve) |
| Camera rate at full deflection | owned by `RI-CAM02` | this item asserts only that the transform is frame-rate independent **and** expressed in degrees per fixed step, never per rendered frame |
| Trigger fire threshold `T_fire` | **0.35** | |
| Trigger release threshold `T_release` | **0.20** | **hysteresis is mandatory**: a single threshold on a Hall trigger produces double-fires |
| Trigger full threshold `T_full` | **0.85** | gates the charged heavy |
| Trigger rest tolerance | a trigger reporting **≤ 0.05** at rest is treated as 0; a trigger resting **> 0.05** is auto-zeroed on the first 30 frames after connect | Hall triggers do not always rest at exactly 0, and hair-trigger mode changes physical travel without changing the reported range |
| Stick drift guard | if `|axis|` never leaves a band of width 0.03 over 600 frames but sits above the deadzone, re-centre and log | protects against a pad that enumerated mid-motion |
| Polling | `navigator.getGamepads()` is read **once per `requestAnimationFrame`**, and the returned objects are treated as **snapshots, not live references** | Chrome returns a fresh array; caching a `Gamepad` object is a defect that silently freezes input |
| Edge latching | press/release edges are detected in the **sampler**, latched, and consumed by the next fixed sim step | a button pressed and released between two 60 Hz steps must **not** be lost. `HARNESS.md` R2 decouples sim from render; this is the input-side consequence |
| Input → action latency budget | **≤ 2 fixed frames (33 ms)** from sample to the sim step that consumes it | measured in `RI-JRN03` M-L1; restated here as a cross-reference only |

### E. Lifecycle (BINDING)

| Id | Event | Required behaviour |
|---|---|---|
| **L1** | Page loads, pad already attached, **no button pressed yet** | The pad is invisible to `getGamepads()` until first input. The game must therefore **never** render a "no controller detected" state on the strength of an empty gamepad list. Device class is inferred from pointer/hover media queries (§F), not from the gamepad list |
| **L2** | `gamepadconnected` | Profile selected (§C), quirk table consulted (G2), a **non-modal, non-blocking** in-world glyph acknowledges it for ≤ 2 s. **No modal. No pause. No "press A to continue".** |
| **L3** | `gamepaddisconnected` mid-play | **All held actions are released on the same frame.** This is the single most important rule in §E: a dropped pad while sprinting must not leave `sprint` and `move:[0,1]` latched, which walks the character off a ledge. Keyboard and touch remain live |
| **L4** | Disconnect **during `COMBAT`** | Same as L3. The world does **not** pause (seam S14). A persistent corner glyph appears until a device returns. **A modal here is a hard fail** — it is exactly the "pause during combat" that S14 bans |
| **L5** | Reconnect within the same session | Bindings, profile and any calibration are restored from the same profile record; no re-calibration, no re-prompt |
| **L6** | Two pads connected | The **most recently active** device drives the game; the other is ignored. Switching device mid-play must not drop a held input on the active one |
| **L7** | Device-class change (pad → touch → keyboard) | Any on-screen affordance that names a control (a glyph on a door prompt, a key hint in the settings surface) re-renders to the **active** device's glyph within 2 frames. A build showing `E` to a gamepad player is a defect |
| **L8** | Page hidden / backgrounded (`visibilitychange`) | All held actions released; the sim is not advanced while hidden. On return, no input is latched from before |
| **L9** | No gamepad has ever been seen and the device is coarse-pointer | Touch fallback (§G) is active from the first frame; there is **no** "connect a controller" screen |

### F. Mobile reality (BINDING)

| Id | Requirement | Value |
|---|---|---|
| **H1** | Orientation | **Landscape only.** Requested via the Screen Orientation API on the first user gesture (which requires fullscreen on most mobile browsers, so the "New/Continue" click is the gesture that enters fullscreen and locks orientation). If the lock is refused, the game renders a **rotate-the-device** state that is an in-world illustration, not a UI modal, and recovers automatically on rotation. Portrait play is not supported and is not faked with a letterbox |
| **H2** | Device class detection | `(pointer: coarse)` and `(hover: none)` select the handheld profile and the touch fallback. **Never** user-agent sniffing. The gamepad list is not used for device-class detection (see L1) |
| **H3** | Safe areas | `viewport-fit=cover` plus `env(safe-area-inset-*)`. **No HUD element, no interactive control, and no readable text may occupy the inset region**, which on a clamped landscape phone is the notch/camera cutout on one short edge and the home indicator on the other |
| **H4** | Browser chrome | Sizing uses **`dvh`/`svh`**, never `vh`. The URL bar collapsing mid-play is a viewport resize, and a resize must **not**: reset the camera, drop the render target's aspect handling, reload assets, or interrupt the sim. Measured as: 0 sim frames lost and 0 camera pose change across a simulated chrome collapse |
| **H5** | Pinch-zoom, double-tap-zoom, pull-to-refresh, text selection, long-press callout | All suppressed on the canvas (`touch-action: none`, `user-select: none`, `overscroll-behavior: none`). **A pull-to-refresh that reloads the page mid-boss is a total loss of the session** |
| **H6** | Fullscreen | Entered on the same gesture as H1. Exiting fullscreen (system gesture) does not pause combat but does release held inputs (L8 rule applies) |
| **H7** | Phone GPU budget | The reference device is a **mid-range phone**, not a workstation. All budgets in `RI-PLT01` and `RI-PLT02` are stated for that class and this item asserts only that the class is the target. **"It runs on my laptop" is not evidence** for anything in this item |
| **H8** | Thermal | A 20-minute continuous session must not degrade below the `RI-PLT01` targets. Not measurable in this container (`RI-PLT01` Tier-H); declared here so it cannot be forgotten |
| **H9** | Audio | Unlocked by the same first gesture as H1/H6 (`RI-JRN01` O4). No separate "tap to enable sound" surface |
| **H10** | Text legibility | The smallest rendered glyph in dialogue, journal and book surfaces subtends **≥ 2.2 mm** on a 6.1″ 1080p display held at arm's length — concretely, **≥ 18 CSS px at a 390-px-wide logical landscape viewport**. Morrowind's wall of text is the point of the game; a wall of 11 px text on a phone is not a design choice, it is an untested one |
| **H11** | Touch targets | Every touchable control ≥ **44×44 CSS px**, and no two adjacent controls closer than 8 px |
| **H12** | Wake lock | `navigator.wakeLock` requested during play so the screen does not sleep mid-dungeon; released when hidden |

### G. Touch fallback (BINDING — this is not a courtesy, it is O17)

| Id | Requirement |
|---|---|
| **T1** | All fourteen actions of the closed set are reachable on touch. `swap_left`/`swap_right`/`two_hand`/`menu` may live behind **one** radial or drawer control; the other ten are direct |
| **T2** | Left half of the screen is a **floating** virtual stick: it originates wherever the thumb lands, not at a fixed rosette. A fixed-position stick fails the moment the phone is a different size |
| **T3** | Right half is camera drag, with the same curve as §D applied to drag velocity |
| **T4** | `light`, `heavy`, `roll`, `block`, `interact`, `use_item`, `lock_on` are discrete buttons in the lower-right arc, thumb-reachable without the hand leaving the phone |
| **T5** | `roll` and `sprint` share a control with the same 12-frame tap/hold discriminator as §C, so the semantics a player learns on a pad transfer |
| **T6** | Charged heavy is a hold on the `heavy` button, thresholded on duration rather than on pressure |
| **T7** | Touch controls **disappear within 2 s of the last touch when a gamepad is active**, and reappear on the first touch |
| **T8** | Touch controls never occupy safe-area insets (H3) and never overlap the dialogue or journal surfaces |
| **T9** | Multi-touch: simultaneous stick + camera + two buttons must all register. A build that drops the camera drag when a button is held has failed this check, and it is the most common touch bug there is |
| **T10** | The full `RI-JRN01` opening and one complete quest are completable on touch only |

## Comparison method

Run by `critic.platform` (fleet critic **JC-04**, see `JOURNEY-CRITIC-FLEET.md`). Two passes:
an **instrumented pass** and a **naive pass** (isolation `enforced`) in which a fresh agent is
given a simulated X2s and no documentation.

### Instrumented pass

```bash
node tools/journey/journey-run.mjs --journey jrn04-pad --seed 4711 \
     --profile phone-390x844-landscape --dpr 3 --pointer coarse \
     --gamepad x2s-standard,x2s-hid-dualsense --input-mode real \
     --out reports/journeys/<runId>
```

Requires **`A-JRN1`** (real-input mode: real listeners connected, clock still stepped),
**`A-JRN2`** (the gamepad shim), **`A-JRN4`** (viewport/orientation/safe-area control) and
**`A-JRN6`** (input-state observability). Until they exist every check is `unmeasurable` and
scores **0**, fail-closed.

**`A-JRN2` must inject at the `navigator.getGamepads()` seam, not at the action seam.** A shim
that calls `queueInputs()` proves nothing: the entire subject of this item is the translation
layer between a `Gamepad` object and an action name. The shim installs a proxy over
`navigator.getGamepads`, synthesises `GamepadEvent`s, and exposes:

```js
__HARNESS.gamepad.connect({id, mapping, buttons: 17, axes: 4})  -> padIndex
__HARNESS.gamepad.set(padIndex, {buttons: {5: 1.0, 7: 0.42}, axes: {0: -0.31, 1: -0.88}})
__HARNESS.gamepad.disconnect(padIndex)
```

Two descriptors are mandatory and both are run for every check:
`x2s-standard` (`mapping: 'standard'`, id `"GameSir-X2s Type-C (STANDARD GAMEPAD Vendor: … )"`)
and `x2s-hid-dualsense` (`mapping: ''`, a DualSense-like id, permuted indices) — because §A says
the real device does both.

| # | Check | Procedure | Threshold |
|---|---|---|---|
| **M-P1** | **Map completeness** | For each profile and each descriptor: for every index 0–16 and every axis, drive it and record which action fired via the trace (`A-JRN7` `input_action` event). Build the observed map. | Observed map **== §C** for all 14 actions, both profiles, both descriptors. **Hard fail: any unbound action, or any action reachable only on one descriptor** (G1, G2) |
| **M-P2** | **Guide safety** | Drive index 16, and run with a 16-button descriptor that has no index 16. | No action fires; no exception; no `undefined` read |
| **M-P3** | **Trigger analog** | Ramp `buttons[7].value` 0 → 1 → 0 over 120 frames in 0.01 steps; log the frames at which `heavy` fires and releases. Repeat with a 0.30↔0.40 dither for 300 frames. | Fires at ≥ 0.35, releases at ≤ 0.20, **exactly one** fire and one release across the ramp; **0** extra fires during the dither (hysteresis). **Hard fail: reading `.pressed`** — detectable as a threshold that changes when the descriptor's `.pressed` is set inconsistently with `.value` |
| **M-P4** | **Charged heavy gate** | Hold `buttons[7].value = 0.5` for 60 frames, then `0.9` for 60. | Charge state entered only above 0.85; the frame it enters is stable across 5 runs |
| **M-P5** | **Roll/sprint discriminator** | Press index 1 and release at each of 4, 8, 11, 12, 13, 20, 60 frames. | `roll` for ≤ 11, `sprint` from frame 12 for ≥ 12, never both, never neither. This is the item's most load-bearing single measurement |
| **M-P6** | **Radial deadzone** | Sweep the left stick around a circle at magnitudes 0.10, 0.14, 0.20, 0.60, 0.92, 1.00 at 36 bearings; record the resulting `move` vector from the trace. | Output magnitude is 0 below 0.14 at **every** bearing and 1.0 at 0.92 at **every** bearing; the max/min ratio of output magnitude across the 36 bearings at input 0.60 is **≤ 1.02**. **A ratio > 1.10 means an axial deadzone and is a defect** |
| **M-P7** | **Diagonal fidelity** | Drive `axes = [0.707, −0.707]`; read the character's yaw and the `move` vector. | Resulting heading is 45° ± 1.5° from forward |
| **M-P8** | **Camera curve** | Drive `axes[2]` at 0.2, 0.5, 0.8, 1.0 for 60 frames each; measure degrees turned per fixed step. | Monotonic, matches `sign·m'^2` within 5%, identical in degrees-per-**fixed-step** when the render rate is varied 3× (`A-JRN5`). **Hard fail: camera speed changes with render rate** |
| **M-P9** | **Sub-frame press** | With the sim stepped manually, set a button to 1 and back to 0 between two `stepFrames(1)` calls. | The action fires exactly once. **Hard fail: dropped input** (edge latching) |
| **M-P10** | **Latency** | From the trace: frames between the sampler observing an edge and the sim step that consumes it, over 200 presses. | p100 ≤ 2 frames |
| **M-P11** | **Disconnect release (L3/L4)** | Hold `sprint` + `move:[0,1]`, then `gamepad.disconnect()`. Step 300 frames. | Held actions released on the **disconnect frame**; player displacement after disconnect ≤ **0.05 m**. **Hard fail: latched input** |
| **M-P12** | **Disconnect in combat (L4)** | Same, with an aggroed enemy. Screenshot every 250 ms; enumerate full-viewport UI states. | **0** modal surfaces; sim continues advancing. **Hard fail: a pause or a modal** (seam S14) |
| **M-P13** | **Cold connect (L1)** | Load with no gamepad in the list; screenshot; then connect. | **0** frames showing a "no controller" state. Device-class inference came from media queries — assert via `getInputState().deviceClass` before any pad exists |
| **M-P14** | **Glyph switching (L7)** | Trigger an interaction prompt; drive a pad button; then a touch; then a key. Screenshot each. | Prompt glyph matches the active device within 2 frames, 3/3 |
| **M-P15** | **Quirk fallback (G2)** | Run with `x2s-hid-dualsense` and with an unknown id and `mapping: ''`. | Known id → correct map with no prompt. Unknown id → the calibration sequence appears, is completable on the pad alone in ≤ 8 inputs, and yields a correct map. **Hard fail: a scrambled map, or a refusal to run** |
| **M-P16** | **Landscape lock (H1)** | Set portrait via `A-JRN4`; screenshot; rotate to landscape. | A rotate state appears, contains **0** UI-kit chrome (measured as in `RI-JRN01` M5: opaque non-world UI ≤ 55% of frame), and recovers within 30 frames of rotation with no reload |
| **M-P17** | **Safe areas (H3)** | Set insets `{top:0, right:44, bottom:21, left:44}` (a clamped landscape phone with a cutout). Screenshot with HUD on; compute the bounding boxes of every HUD/interactive element from the accessibility tree. | **0** elements intersect an inset region |
| **M-P18** | **Chrome collapse (H4)** | Mid-play, change viewport height by 88 px and back (`A-JRN4`). Trace across the change. | 0 sim frames lost; camera pose delta 0; no asset refetch (CDP network log); no exception |
| **M-P19** | **Gesture suppression (H5)** | Dispatch a two-finger pinch, a double-tap, a top-edge downward drag, and a 600 ms long-press on the canvas. | 0 zoom change, 0 navigation, 0 selection, 0 context callout |
| **M-P20** | **Text legibility (H10)** | At 844×390 logical, open dialogue, journal and a book; measure the computed font size of the smallest rendered text run. | ≥ 18 CSS px, 3/3 |
| **M-P21** | **Touch parity (T1–T9)** | Touch-only run: complete the `RI-JRN01` opening and one full quest. Separately, dispatch simultaneous stick + camera + 2 buttons and read `getInputState()`. | Both complete; all 4 simultaneous touches register. **Hard fail: either run cannot complete** (O17) |
| **M-P22** | **Touch/pad coexistence (T7)** | With a pad active, touch the screen; wait 3 s. | Controls appear on touch, gone within 2 s of last touch |
| **M-P23** | **Rebinding round trip** | Rebind 3 actions through the in-game surface using **only the pad**, save, reload. | Completable pad-only; bindings persist (via `RI-JRN05`'s store); the reserved indices (12, 13, 8) are offered and index 16 is not |
| **M-P24** | **Instruction budget** | Grep the UI text stream over the whole journey for `Press `, `Tap `, `Click `, `Tutorial`, `Controller`, `Connect`. | **0 hits** outside the settings surface and the G2 calibration sequence (`RI-JRN01` O11, cross-rule) |
| **M-P25** | **Phone-class budget** | Run `RI-PLT01` Tier-S and `RI-PLT02` at the phone profile. | Their thresholds, cited not restated. Tier-H checks are `unmeasurable` here and score 0 |

### Naive pass (isolation: `enforced`)

A fresh agent (fleet role **JC-04N**) gets: the URL, a simulated `x2s-standard` pad through the
shim, a phone-class viewport, the driver's stdio protocol, and one sentence of premise. **No
corpus. No button map. No source.** It is asked, in order, answers recorded verbatim:

1. Before touching anything: *"You have a controller clamped to a phone and a game you have
   never played. Write down which button you expect to attack with, and which to dodge with."*
2. *"Play for ten minutes. Then list every action you discovered you could take, and say for
   each one how you found out."*
3. *"Which buttons did you press that did nothing?"*
4. *"Did anything ever tell you what a button does? Quote it."*
5. *"Pull the controller out mid-fight, then plug it back in. Describe what happened."*

| # | Check | Threshold |
|---|---|---|
| **M-N1** | Actions discovered in (2) | ≥ **11** of 14 within ten minutes, **without** any of them being discovered from a text instruction |
| **M-N2** | Pre-registration match (1 vs reality) | attack and dodge both land where the agent expected. Recorded as a quotation |
| **M-N3** | Dead presses (3) | Every dead press is triaged: **reserved index** (acceptable) vs **bound but silent** (defect). Defects **0**; hard fail ≥ 2 |
| **M-N4** | Instruction (4) | 0 quotations from outside the settings surface |
| **M-N5** | Hot-plug (5) | The agent's description contains no walking, no falling, no death, and no reload |

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R4)*

`ARBITRATION` §3's CONSUMPTION check reached the **critics** through the doctrine and reached
**none of the fourteen items** judging the opening, character creation or the journeys — measured
at this pass, `grep -cE 'RI-MTH07|CONSUMPTION|world-side consumer'` returned **0** for every one of
`RI-JRN01`–`RI-JRN08`, `RI-CHR01`–`RI-CHR03`, `RI-PRG02`, `RI-PRG03` and `RI-EXP01`. Which models
must be enumerated, and what a zero costs, are properties of the item and not of a critic's
diligence. For this item:

1. **Enumerate exhaustively** every model this journey requires to act — every table, graph,
   binding map, budget and record it publishes that the running game must read — and list it in
   the verdict. A sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else held
   fixed, plus the null control. For a **journey** the admissible observable is what the player
   could see or do — a drawn string, a rendered object, a surface that appears, an input that is
   accepted or refused, a state that survives. **A harness return value is not an observable**;
   `RI-MTH07` §B1 rules the trace an observer, not a consumer.
3. **Apply the consequence.** Any `coupling == 0` scores **that dimension 0**, fail-closed, and
   appears in the piece's `status_reasons`. There is no `partial`.
4. **The fourth shape.** `RI-MTH07` §A names orphan model, orphan data and orphan predicate.
   `corpus/88-journeys/` produced a fourth — **orphan text**: a string authored, computed
   correctly, carried through the model, exposed through the harness, and never drawn. From the
   player's chair it is identical to a string that was never written. See `RI-JRN09`
   `ES-LEGIBLE/1`.

## Scoring

Native scale: **0–100**, weighted, plus hard fails that cap the item at **2**.

| Block | Weight | Checks |
|---|---|---|
| **The map is right and complete** | **30** | M-P1 (14), M-P5 (7), M-P3 (5), M-P15 (4) |
| **Analog is right** | 18 | M-P6 (6), M-P4 (3), M-P7 (3), M-P8 (3), M-P2 (1), M-P10 (2) |
| **Lifecycle does not lose the player** | 17 | M-P11 (7), M-P12 (5), M-P13 (3), M-P14 (2) |
| **The phone is a real device** | 17 | M-P16 (3), M-P17 (4), M-P18 (3), M-P19 (3), M-P20 (2), M-P25 (2) |
| **Touch parity** | 10 | M-P21 (8), M-P22 (2) |
| **Restraint and reach** | 4 | M-P24 (2), M-P23 (2) |
| **Naive corroboration** | 4 | M-N1 (2), M-N3 (1), M-N5 (1) |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 50–69 | Recognisably attempting it | 5 |
| < 50 | **We lose** | 4 |

**Hard fails (any one caps the item at 2 and sets `status: FAIL`):**

- **HF1** — Any of the fourteen actions unbound in either profile (M-P1).
- **HF2** — A scrambled map, or a refusal to run, on a `mapping !== 'standard'` device (M-P15).
- **HF3** — Held inputs latched after disconnect (M-P11).
- **HF4** — A modal or a world-pause on disconnect during combat (M-P12) — also a seam S14 fail.
- **HF5** — The opening or a quest is not completable on touch only (M-P21) — also `RI-JRN01` HF5.
- **HF6** — Dropped sub-frame input (M-P9), or camera speed coupled to render rate (M-P8).
- **HF7** — A tutorial/instruction string used to teach the controls (M-P24) — also `RI-JRN01` HF3.
- **HF8** — Trigger read via `.pressed` with no hysteresis, producing double-fires (M-P3).

## How we lose

1. **`mapping === 'standard'` is assumed.** The whole map is written against the §B table, it
   works on every pad the builder owns, and on the actual GameSir X2s in its default
   DualSense-like HID mode the roll button is the menu button. This is the specific device the
   user named, and it is the single most likely way this item fails.
2. **`buttons[7].pressed` instead of `.value`.** The heavy attack works, the charged heavy is
   impossible, and the threshold is different in Firefox. Nobody notices until someone tries to
   charge an R2.
3. **An axial deadzone.** `if (Math.abs(x) < 0.15) x = 0` per axis, which is one line and wrong:
   diagonals get a flat spot, strafing a boss snaps to eight directions, and the player calls
   it "floaty" without being able to say why. M-P6's 36-bearing sweep exists only for this.
4. **Roll and sprint on separate buttons.** It is easier to implement, it is what a web
   developer would do, and it destroys every Souls player's muscle memory in the first thirty
   seconds. The 12-frame discriminator is fiddly and will be the first thing simplified away.
5. **Held inputs latch on disconnect.** The USB-C connector on a telescopic pad jogs. The
   character sprints off a cliff. This is a four-line fix that nobody writes because nobody
   unplugs a controller during a test.
6. **A "Controller disconnected" modal, mid-boss.** Helpful, obvious, and both a seam S14
   violation and a death.
7. **A "no controller detected — connect one" screen on load,** because `getGamepads()` was
   empty before the first button press. The player is holding the controller.
8. **`100vh`.** The URL bar collapses, the canvas resizes, and the whole scene re-lays-out
   mid-fight; or worse, the canvas is 88 px taller than the visible area forever and the stamina
   bar is under the browser chrome.
9. **Pull-to-refresh.** A downward drag near the top edge reloads the page. Forty minutes gone.
   One CSS property.
10. **The notch.** The HUD is laid out in a 16:9 rectangle, and on a clamped landscape phone the
    health bar is behind the camera cutout. Nobody sees this on a desktop browser at 1920×1080,
    which is the only place it was ever tested.
11. **Touch is "later".** Everything is built for the pad because the user asked about a pad, and
    `RI-JRN01` O17's touch-only requirement is discovered in wave 4 when the input layer has
    fourteen hard-coded gamepad assumptions in it.
12. **Multi-touch drops the camera.** The touch handler tracks one active pointer, so holding
    block and dragging the camera is impossible. The player cannot circle-strafe. This is the
    most common touch bug in browser games and it makes the Souls half unplayable.
13. **11 px text.** The dialogue surface was designed at 1920×1080 and scaled down. Morrowind's
    entire appeal is reading, and it cannot be read.
14. **The control problem is solved with a tutorial.** Controls turn out to be undiscoverable,
    so somebody adds a "Press RB to attack" banner, and `RI-JRN01` O11 dies to fix this item's
    gap. **Cross-rule, restated: an instruction pop-up may never be the remedy for a control
    discoverability gap.** The remedy is §C's placement plus `RI-JRN03`'s in-world inscriptions.
15. **Everything is tested through `queueInputs()`.** The action layer is exercised, the
    translation layer never is, and the item's entire subject goes unmeasured while every check
    reports green. `A-JRN2` injecting at the `navigator.getGamepads()` seam is the guard, and if
    the shim is implemented at the action seam instead, the critic must fail the item for
    unmeasurability rather than accept the numbers.

## Provenance note

- **Owner hardware target, user-supplied, recorded 2026-08-11** — the primary physical acceptance unit is the **GameSir X2s Type-C Mobile Gaming Controller**, wired USB-C, Amazon UK ASIN **`B0CRTMNQBL`** (`https://www.amazon.co.uk/dp/B0CRTMNQBL`). Builders and critics must name this exact variant; “GameSir X2s” alone is ambiguous with the Bluetooth model. Simulated `x2s-standard` and `x2s-hid-dualsense` descriptors are preflight evidence. Final hardware acceptance requires the browser-reported `id`, `mapping`, button/axis indices, resting noise and trigger ranges observed on this owner unit, followed by a complete pad-only calibration/rebinding round trip and opening/quest journey.
- **`community-data`, confidence medium** — §A, every fact about the GameSir X2s Type-C. Sourced
  from vendor and review pages via WebSearch result summaries; **direct fetches of
  `gamesir.com`, `manuals.plus` and `w3c.github.io` returned HTTP 403 and were not read**.
  Cited: SlashGear "GameSir X2s Type-C Review" (`slashgear.com/1546147/`), the GameSir product
  page (`gamesir.com/collections/mobile-game-gamepad/products/gamesir-x2s`), the GameSir X2s
  Type-C FAQ, the owner-supplied Amazon UK listing (`B0CRTMNQBL`), Laptop Mag and TechRadar reviews, and the
  Manuals+ X2s manual. **No threshold in this item depends on any §A row being exactly right** —
  §C/§D/§E are written against the W3C Standard Gamepad and against a declared quirk table, so a
  wrong §A fact costs us a row in a table, not a measurement.
- **`canonical-recall`, confidence high** — §B, the W3C Standard Gamepad index table, and the
  platform behaviours in §E/§F: that `gamepad.mapping` is `''` or `'standard'`; that pads are
  commonly absent from `getGamepads()` until first input; that `getGamepads()` returns snapshots;
  that `GamepadEvent` connect/disconnect exist; that orientation lock generally requires
  fullscreen on mobile; that `env(safe-area-inset-*)` and `dvh` exist. These are established
  web-platform behaviours, recalled and corroborated by search, **not measured here**.
- **`constructed`, confidence high, and binding** — §C (both profiles and every binding), §D
  (every deadzone, threshold and curve), §E, §F, §G, and every threshold and weight in
  `## Comparison method` and `## Scoring`. The Souls placements in `souls-default` are recalled
  from the Souls series (R1 light, R2 heavy, L1 guard, L2 parry, B roll/sprint, Y two-hand,
  R3 lock-on); **the exact numbers — 12 frames, 0.14, 0.35/0.20/0.85, 0.92, 2.0 — are ours**,
  chosen because they are measurable, and they are binding for that reason (CORPUS-CONTRACT §3).
- **Owned elsewhere, cited not restated:** the action set and rebinding model → `RI-JRN03`.
  Camera rates and lock-on framing → `RI-CAM02`, `RI-CAM03`, `RI-CAM04`. Input buffering →
  `combat.input.buffer`. Charged heavies → `combat.attack.charge`. Frame and memory budgets →
  `RI-PLT01`, `RI-PLT02`. Binding persistence → `RI-JRN05`. Modality parity for the opening →
  `RI-JRN01` O17. Seam S14 (no pause in combat) → `ARBITRATION.md`.
- **Harness dependency.** `A-JRN1`, `A-JRN2`, `A-JRN4`, `A-JRN6`, `A-JRN7`; M-P8 additionally
  needs `A-JRN5`. Until they land this item is **unmeasurable** and scores **0**, fail-closed.
  Full request in `JOURNEY-CRITIC-FLEET.md` §7.
