# W1-08 + W1-29 — the controls, desktop and mobile

**Pieces:** `W1-08` (desktop controls and the action set, 6 paths) and `W1-29` (mobile, touch and
the attached gamepad, 5 paths). Dispatched together because they are one input system.
**Judged by:** `corpus/88-journeys/RI-JRN03-desktop-controls.md` and
`corpus/88-journeys/RI-JRN04-mobile-and-gamepad.md`.
**This is a builder's report. It is not a verdict and it does not carry a score.**

> The owner asked for one thing: *"are the controls intuitive and do they work — I want them to
> work both on desktop **and** on mobile with a controller attached — I have this one GameSir X2s
> Type-C Mobile Gaming [controller]."* Everything below is organised around whether that sentence
> is true, and around being exact about the parts of it that cannot be checked from here.

---

## 0. What I could not do, stated first

**I cannot plug in a physical GameSir X2s.** No USB, no Bluetooth, no Android, no touchscreen.
Everything about the pad below was measured by driving synthetic `Gamepad` objects through the
*same* `RealInput.pollGamepad()` a physical pad drives, and by injecting descriptors above the
`navigator.getGamepads()` seam with `tools/journey/gamepad-shim.mjs`. §8 lists, one by one, the
real-hardware behaviours that leaves unverified and what it would take to close each.

Everything below was measured **on the repository tree**, not on a fixture. `node
tools/harness/smoke.mjs` is 6/6 before and after. Mid-session the tree stopped booting for about
an hour on another piece's in-flight quest data (`QuestBook: Q-MAIN-10 names Q-MAIN-11`, which is
fail-loud by design); that has since landed and every number here is from the tree as it stands.
§9 records what that cost and two tools it broke.

## 1. The three headline answers

| Question | Answer | Where it is measured |
|---|---|---|
| Every Souls action on keyboard + mouse | **16 of 16**, primary and secondary, driven through the real DOM path | `M-K1` |
| Every Souls action on the pad alone, no keyboard reachable | **16 of 16 in BOTH profiles**, `souls-default` and `souls-handheld`, and on a `mapping: ''` pad as well | `M-P1`, `M-P15` |
| Every Souls action on touch alone | **16 of 16**, ten direct + one drawer | `M-P21a` |
| Input latency, press to the step that consumes it | **p50 1 frame, p100 ≤ 2 frames** on keyboard and on pad, over 200 inputs each | `M-K23`, `M-P10` |

The action set is **sixteen**, not fourteen: `RI-JRN03` §A's fourteen plus `crouch`
(`AM-W1-15-01`, `RI-STL01`'s blocking dependency) and `spell_cycle` (`AM-W1-14-02`,
`RI-MAG01` §C). `RI-JRN04` G1 requires *every action of the closed set* bound in *both* pad
profiles, so all sixteen are, and the router **throws at construction** if one is not.

---

## 2. What the build did before this piece, and the five things that were wrong

The foundation was real and was built on, not replaced: a 14-button closed set, an edge-latching
pipeline whose press-and-release-between-two-steps case was already correct, and a
`pollGamepad()` that a W1-07 critic had already verified the harness shim drives directly. Five
things were wrong, and four of them are the exact failures the two items predict.

1. **`heavy` was unreachable on its own primary key.** `bindings.js` bound
   `spell_cycle: ['KeyR']` and `heavy: ['KeyR', 'Mouse3']`. `buildControlMap()` resolves a
   collision by insertion order, so `spell_cycle` silently took `KeyR`. `RI-JRN03` §B names three
   deliberate collisions and rules on each; this was a **fourth**, created by an action-set
   amendment after §B was written, and nothing enumerated the map so nothing caught it.
   *Ruling, in §B's own form: `heavy` keeps `KeyR`; `spell_cycle` = `KeyT` (+ `Digit2`).*
   `auditBindings()` now fails on any collision, so a fifth cannot be introduced silently.
2. **`sprint`, `swap_left` and `swap_right` had no pad binding at all** — `RI-JRN04` **HF1**.
   `block` and `parry` were also swapped against §C (block was on LT, parry on LB), `jump` was on
   Y, `two_hand` on Back — which §C reserves — and `lock_on` on L3.
3. **The triggers were read as `b.pressed || b.value > 0.5`** — `RI-JRN04` **HF8** and its "How we
   lose" #2. No `T_fire`/`T_release` hysteresis, so a Hall trigger dithering around the threshold
   double-fires; no `T_full` gate, so the charged heavy had no analog meaning at all.
4. **There was no roll/sprint discriminator.** `roll` was a plain discrete press on B and `sprint`
   was unbound. "How we lose" #4 predicts exactly this and calls it the first thing simplified
   away.
5. **`mapping === 'standard'` was assumed**, in a comment that said so: *"That controller reports
   as a standard-mapping Gamepad, so the standard mapping IS the binding table and there is no
   per-pad quirk list to maintain."* `RI-JRN04` §A's own second-to-last row says the X2s
   **defaults to a DualSense-like HID profile on Android**, and "How we lose" #1 calls this "the
   single most likely way this item fails" — on the specific device the owner named.

And three whole systems were absent rather than wrong: **touch** (zero touch code in the tree),
**rebinding** (§E RB1–RB11, nothing), and **mobile viewport** — `game/index.html` sized the canvas
with `100vh`, which is "How we lose" #8 verbatim.

---

## 3. What was built

| File | What it is |
|---|---|
| `game/data/input/profiles.json` | **The model.** The closed action set, the desktop table with §B's three rulings and the fourth, both pad profiles, every analog constant, the touch layout, the mobile block. Nothing is hard-coded anywhere else. |
| `game/data/input/pad-quirks.json` | §C **G2**'s quirk table, keyed by normalised `gamepad.id`, with **both** X2s enumeration modes, the generic-HID fallback, and the six-prompt diegetic calibration sequence. |
| `game/src/input/gamepad.js` | The **translation layer**: mapping normalisation, hat-axis D-pads, analog-trigger axes, radial deadzone with rescale, trigger hysteresis, the charge gate, the tap/hold discriminators, rest auto-zero, drift guard, and lifecycle L1–L9. |
| `game/src/input/touch.js` | §G. Floating stick, camera drag, three thumb arcs plus one drawer, the same 12-frame discriminator the pad uses, and a pointer **map** rather than one active pointer. |
| `game/src/input/viewport.js` | §F. Device class from media queries only, safe-area insets, orientation, fullscreen, wake lock, the rotate state, resize handling. Also the world side of **A-JRN4**. |
| `game/src/input/rebind.js` | §E. Press-to-bind, conflict naming, orphan refusal, per-device profiles, restore defaults, serialisation — and a surface walked entirely by the closed action set, so it is completable on any one modality. |
| `game/src/input/bindings.js` | Rewritten: the tables are **populated from the data file**, and `auditBindings()` now detects collisions and zero-binding actions. |
| `game/src/input/real.js` | Rewritten device layer. Every §C/§D hazard, the pad's own connect/disconnect events, the hold gates, the click-drag look fallback, `KeyboardLayoutMap` labels. |
| `tools/journey/input-checks.mjs` | **New tool.** The `M-K` and `M-P` tables, measured, with a `--self-test` that breaks each measured system on purpose. |

Wiring: `engine.js` loads the two data files and calls `setProfiles()` **before** the input path is
built (`RealInput` throws without it, so a missing data file is a loud boot failure rather than a
silent fallback); `sim/step.js` promotes the hold gates in **fixed sim frames**, before the latch.

---

## 4. CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3)

Every model these two journeys require the running game to read, enumerated — not sampled — with
the world-side consumer named and the perturbation that proves it.

| # | Model | World-side consumer | Perturbation | Observable |
|---|---|---|---|---|
| 1 | `profiles.json` › `desktop.bindings` | `bindings.setProfiles()` → `buildControlMap()` → `RealInput` keydown/mousedown | move `light` off `Mouse0` | the left button stops swinging |
| 2 | `profiles.json` › `desktop.move` | `RealInput.moveCodes` → `_pushMove()` | swap `forward`/`back` | the body walks the other way |
| 3 | `profiles.json` › `desktop.hold_gate_frames` | `RealInput._down/_up/tick` | set `two_hand` to 1 | a tap of `G` two-hands the weapon |
| 4 | `profiles.json` › `desktop.look` | `RealInput._look()` | halve `deg_per_px_yaw` | the camera turns half as far for the same mouse travel |
| 5 | `profiles.json` › `pad_profiles.*.buttons` | `GamepadRouter._applyButtons()` | move `light` from 5 to 12 | **measured**: RB stops swinging, D-pad-up starts (`--self-test`) |
| 6 | `profiles.json` › `pad_profiles.*.hold_gate` | `GamepadRouter._applyButtons()` gate branch | set index 1's frames to 1 | **measured**: sprint at 4 frames (`--self-test`) |
| 7 | `profiles.json` › `pad_profiles.*.analog_buttons` / `charge_button` | `GamepadRouter` trigger branch | — | see 8/9 |
| 8 | `profiles.json` › `analog.trigger` | same | `t_fire` → 0.05 | **measured**: heavy fires at 0.10 (`--self-test`) |
| 9 | `profiles.json` › `analog.left_stick` | `GamepadRouter._applySticks()` → `shapeMoveStick()` → `pipe.setMove()` | `inner_deadzone` → 0.80 | **measured**: a 0.6 stick deflection moves nothing (`--self-test`) |
| 10 | `profiles.json` › `analog.right_stick` | `shapeRightStick()` → `pipe.addLook()` | change the exponent | the camera's response curve changes (`M-P8` measures the curve) |
| 11 | `profiles.json` › `analog.drift_guard` | `GamepadRouter._applyRest()` | — | a drifting axis is re-centred and logged |
| 12 | `profiles.json` › `touch.buttons` / `drawer` | `TouchInput.layout()` → `_hitButton()` → `pipe.edgeDown()` | shift a button 300 px right | **measured**: it lands in the cutout inset and `insetViolations` goes non-zero (`--self-test`) |
| 13 | `profiles.json` › `touch.stick` / `camera` | `TouchInput.move()`/`tick()` | — | the stick's radius and the drag's degrees-per-px |
| 14 | `profiles.json` › `mobile.device_class_queries` | `Viewport.detectDeviceClass()` | — | which pad profile and whether touch attaches at all |
| 15 | `profiles.json` › `mobile.orientation` | `Viewport.onFirstGesture()` / `rotateState()` | — | the rotate illustration appears in portrait |
| 16 | `profiles.json` › `reserved_controls` + refusal lines | `Rebinder.offer()` | — | `Ctrl+W` is refused **with the line drawn** |
| 17 | `profiles.json` › `reserved_pad_index` | `Rebinder.offer()` | — | pad index 16 refused |
| 18 | `pad-quirks.json` › `entries[].button_permutation` | `GamepadRouter.normalise()` | — | **measured**: raw HID 0 arrives as `use_item`, raw 1 as `interact` (`M-P15`) |
| 19 | `pad-quirks.json` › `dpad_from_hat_axis` / `axis_permutation` / `analog_trigger_axes` | `GamepadRouter.normalise()` | — | a hat-axis D-pad walks a list; an axis trigger charges |
| 20 | `pad-quirks.json` › `generic_hid_fallback` | `findQuirk()` | — | an unknown pad plays while it calibrates |
| 21 | `pad-quirks.json` › `calibration.prompts` | `_beginCalibration()` / `calibrationPrompt()` | — | **measured**: the six lines appear and the map they build is live (`M-P15`) |

**The consumers are the game, not the harness.** `getInputState()`, `getInputEdges()` and the
trace are observers; `RI-MTH07` §B1 rules them so. Every row's observable above is a thing the
player does or sees: a swing that comes out, a body that walks, a camera that turns, a control
that is refused, a surface that appears.

**Orphan text (the fourth shape, `RI-JRN09` `ES-LEGIBLE/1`).** Four strings in these models are
authored but **not yet drawn by any renderer**: the two refusal lines, the rotate state's line,
and the six calibration prompts. They are computed, carried and exposed correctly — and from the
player's chair that is identical to never having been written. They are listed here rather than
claimed. `game/src/render/ui.js` is the surface that must draw them; that is the one gap in this
piece I did not close (§7).

---

## 5. Measured

```bash
node tools/journey/input-checks.mjs --group desktop|pad|touch|viewport|rebind --out DIR
node tools/journey/input-checks.mjs --group pad --self-test           # break it on purpose
node tools/journey/input-checks.mjs --shim x2s-hid-dualsense --group pad
node tools/journey/journey-run.mjs --journey jrn03-desktop --seed 4711 \
     --profile headless-small --input-mode real --layouts qwerty,azerty,qwertz
node tools/journey/journey-run.mjs --journey jrn04-pad --seed 4711 \
     --profile phone-390x844-landscape --dpr 3 --pointer coarse \
     --gamepad x2s-standard,x2s-hid-dualsense --input-mode real
```

**41 of 41 checks pass on the repository tree**: desktop 16/16, pad 16/16, touch 5/5,
viewport 4/4, rebinding 4/4. Raw output in `reports/journeys/input-checks/repo-*/checks.json`;
the two journey runs in `reports/journeys/jrn03-desktop/` and `reports/journeys/jrn04-pad/`.

**The self-test is the number that makes the other 41 mean anything.** `--self-test` perturbs the
model each check reads and asserts the check flips: move `light` from pad index 5 to 12 and RB
must stop swinging while D-pad-up starts; set the roll/sprint discriminator to 1 frame and a
4-frame tap must come out as a sprint; drop `T_fire` to 0.05 and the heavy must fire at 0.10;
raise the left-stick deadzone to 0.80 and a 0.6 deflection must move nothing; shift a touch button
300 px right and it must land in the cutout inset. **5 of 5 instruments went red.** A check that
stayed green under a perturbation of its own model would be reported VACUOUS and exit non-zero.

| # | Item | What is measured | Threshold | Result | Measured |
|---|---|---|---|---|---|
| `M-K1` | RI-JRN03 | action coverage through the real DOM path | 14/14 primary, 0 misrouted | **pass** | `{"actions":16,"primary_correct":16,"misrouted":[]}` |
| `M-K10` | RI-JRN03 | pointer-lock loss releases every held action and enters the menu state | held empty in 1 frame, menu entered — no reachable gameplay-with-no-lock-and-no-menu (HF4) | **pass** | `{"before":["sprint"],"after":[],"menuOpen":true,"pointerLocked":false}` |
| `M-K11` | RI-JRN03 | a permanently failing pointer lock leaves the game playable (click-drag look, 0 modals) | fallback engaged and the camera turns (PL5) | **pass** | `{"dragLookFallback":true,"lockErrors":2,"yaw_before":0,"yaw_after":12,"turned":true}` |
| `M-K12` | RI-JRN03 | degrees turned per fixed step is identical at 60/30/15 Hz render | identical to 6 dp AND non-zero (HF8 / RI-PLT01 HF3) | **pass** | `{"per_rate":{"0":9.6,"15":9.6,"30":9.6,"60":9.6},"rotation_is_real":true}` |
| `M-K13` | RI-JRN03 | degrees turned is exactly linear in total mouse delta | r2 >= 0.999 (PL8) | **pass** | `{"points":[[40,4.8],[80,9.600000000000001],[160,19.200000000000003],[320,38.4]],"r2":1.0000000000000002}` |
| `M-K14` | RI-JRN03 | context menu / scroll / tab-focus / quick-find all suppressed on the canvas | 0 context menus, 0 scroll, 0 focus change (PL9, KB4-KB6) | **pass** | `{"contextmenu_default_prevented":true,"space_default_prevented":true,"tab_default_prevented":true,"wheel_default_prevented":true,"page_scrolled":false,"body_overflow":"hidden","canvas_cursor":"none"}` |
| `M-K15` | RI-JRN03 | the cursor is hidden during gameplay and no software cursor is drawn | computed cursor 'none' (PL10) | **pass** | `{"cursor":"none"}` |
| `M-K16` | RI-JRN03 | sprint-roll-attack completes on a 2-key-rollover keyboard | sequence completes; no default action needs 3 simultaneous MATRIX keys (HF6) | **pass** | `{"ghosted":[],"sprinting":true,"rolled":true,"swung":true,"matrix_at_peak":2}` |
| `M-K2` | RI-JRN03 | bindings matched on KeyboardEvent.code, never .key/.keyCode | identical action map on qwerty/azerty/qwertz (HF1) | **pass** | `{"heavy_from_code":true,"azerty_w_dispatched":true,"before":470,"compares_key":false,"compares_keycode":false,"compares_code":true}` |
| `M-K20` | RI-JRN03 | instruction tokens in the rendered-text stream outside the settings surface | 0 hits (HF5 / RI-JRN01 HF3) | **pass** | `{"frames":0,"hits":[],"sample":[]}` |
| `M-K23` | RI-JRN03 | frames from a real DOM event to the sim step that consumes it, over 200 inputs | p100 <= 2 frames, p50 <= 1 | **pass** | `{"n":200,"p50":1,"p100":1,"never_consumed":0}` |
| `M-K24` | RI-JRN03 | 10 000 inputs through the real path: inputs the PIPELINE lost | 0 pipeline drops. The aggregate `droppedInputs` also counts presses the COMBAT model refused (RI-CMB09 §1) and cannot be 0 in any real fight — see pipeline.js | **pass** | `{"pipeline_drops":0,"aggregate_droppedInputs":9487,"buffer_misses":0,"inputs":10000}` |
| `M-K4` | RI-JRN03 | no default uses Ctrl/Alt; Ctrl+W and F5 are refused with an in-fiction line | 0 defaults use Ctrl/Alt; both refused in fiction (KB3/RB6) | **pass** | `{"usesModifier":[],"ctrlW":{"refused":"reserved","line":"The bindings hold. That hand belongs to the window, not to you."},"f5":{"refused":"reserved","line":"The bindings hold. That hand belongs to the window, …` |
| `M-K5` | RI-JRN03 | auto-repeat produces exactly one action | exactly 1 (HF7) | **pass** | `{"fires":1}` |
| `M-K6` | RI-JRN03 | held actions released within 1 frame of blur | held empty in 1 frame; displacement after the committed state ends <= 0.05 m (HF2) | **pass** | `{"heldBefore":["roll","sprint"],"heldAfter1":[],"displacement_total_m":4.6874,"displacement_after_commitment_m":0}` |
| `M-K7` | RI-JRN03 | held actions released within 1 frame of visibilitychange | held empty in 1 frame; displacement after the committed state ends <= 0.05 m (HF2) | **pass** | `{"heldBefore":["roll","sprint"],"heldAfter1":[],"displacement_total_m":4.6874,"displacement_after_commitment_m":0}` |
| `L6` | RI-JRN04 | with two pads the most recently active drives the game, and switching drops nothing | active index follows activity; 0 latched on removal | **pass** | `{"after_pad0":{"active":0,"held":["lock_on"]},"after_pad1":{"active":1,"held":[]},"after_both_gone":[]}` |
| `M-P1/souls-default` | RI-JRN04 | map completeness for profile souls-default | observed map == §C for all actions; 0 unbound (HF1) | **pass** | `{"observed":{"0":{"hold":"interact","tap":null},"1":{"hold":"sprint","tap":"roll"},"2":{"hold":"use_item","tap":null},"3":{"hold":"two_hand","tap":"spell_cycle"},"4":{"hold":"block","tap":null},"5":{"hold":"lig…` |
| `M-P1/souls-handheld` | RI-JRN04 | map completeness for profile souls-handheld | observed map == §C for all actions; 0 unbound (HF1) | **pass** | `{"observed":{"0":{"hold":"jump","tap":null},"1":{"hold":"sprint","tap":"roll"},"2":{"hold":"use_item","tap":null},"3":{"hold":"two_hand","tap":"interact"},"4":{"hold":"block","tap":null},"5":{"hold":"light","ta…` |
| `M-P10` | RI-JRN04 | frames from the sampler observing a pad edge to the step that consumes it, over 200 presses | p100 <= 2 frames | **pass** | `{"n":200,"p50":1,"p100":1,"never":0}` |
| `M-P11` | RI-JRN04 | a mid-play disconnect releases every held action on the disconnect frame | held empty on the disconnect frame; displacement <= 0.05 m (HF3) | **pass** | `{"heldBefore":["sprint"],"heldAfter1":[],"move_after":[0,0],"displacement_m":0,"frames_advanced":301,"ui":false}` |
| `M-P12` | RI-JRN04 | the sim keeps advancing across a disconnect and no modal appears | 0 modal surfaces; sim advances (HF4 / seam S14) | **pass** | `{"frames_advanced":301,"ui":false}` |
| `M-P13` | RI-JRN04 | device class is inferred from media queries before any pad exists | deviceClass from the viewport, never from the gamepad list (L1) | **pass** | `{"deviceClass":"desktop","pad_connected":false,"viewport_deviceClass":"desktop"}` |
| `M-P15` | RI-JRN04 | a mapping-"" pad is de-permuted from pad-quirks.json; an unknown one calibrates on the pad alone | known id -> correct map, no prompt; unknown id -> calibration in <= 8 inputs (HF2) | **pass** | `{"raw0":{"hold":"use_item","tap":null},"raw1":{"hold":"interact","tap":null},"raw2":{"hold":"sprint","tap":"roll"},"raw5":{"hold":"light","tap":null},"quirk_used":"3537:1004","prompted":false,"calibration":{"st…` |
| `M-P2` | RI-JRN04 | index 16 fires nothing; a 16-button descriptor throws nothing | no action, no exception, no undefined read | **pass** | `{"before":[],"afterGuide":[],"sixteen_button_descriptor_threw":null,"held_after":[]}` |
| `M-P3` | RI-JRN04 | trigger fires at >= 0.35, releases at <= 0.20, exactly one of each, 0 dither fires | one fire at 0.35, one release at 0.20, 0 extra during a 0.30<->0.40 dither (HF8) | **pass** | `{"fires":[0.35],"releases":[0.2],"dither_extra_fires":0,"value_path_fires":true}` |
| `M-P4` | RI-JRN04 | charge state entered only above T_full = 0.85, stable across 5 runs | never at 0.5, always at 0.9, same frame 5/5 | **pass** | `[{"half_intent":0,"full_intent":1,"entered_at_frame":0},{"half_intent":0,"full_intent":1,"entered_at_frame":0},{"half_intent":0,"full_intent":1,"entered_at_frame":0},{"half_intent":0,"full_intent":1,"entered_at…` |
| `M-P5` | RI-JRN04 | B tap => roll (<= 11 f), B hold => sprint (>= 12 f), never both, never neither | roll for <= 11, sprint from 12; never both, never neither | **pass** | `{"4":{"roll":true,"sprint":false},"8":{"roll":true,"sprint":false},"11":{"roll":true,"sprint":false},"12":{"roll":false,"sprint":true},"13":{"roll":false,"sprint":true},"20":{"roll":false,"sprint":true},"60":{"…` |
| `M-P6` | RI-JRN04 | radial deadzone: 0 below 0.14 at every bearing, 1.0 at 0.92, isotropic at 0.60 | max/min ratio at 0.60 <= 1.02; > 1.10 means an axial deadzone | **pass** | `{"1":{"min":1,"max":1,"ratio":1},"0.1":{"min":0,"max":0,"ratio":1},"0.14":{"min":0,"max":0,"ratio":1},"0.2":{"min":0.06493506493506492,"max":0.06493506493506498,"ratio":1.000000000000001},"0.6":{"min":0.5844155…` |
| `M-P7` | RI-JRN04 | axes [0.707, -0.707] produce a 45 degree heading | 45 +/- 1.5 deg | **pass** | `{"move":[0.7071067811865475,0.7071067811865475],"bearing_deg":45}` |
| `M-P8` | RI-JRN04 | camera degrees per FIXED STEP is monotonic in stick magnitude and identical at 3 render rates | identical across render rates AND non-zero (HF6) | **pass** | `{"per_rate":{"0":[[0.2,0.011725],[0.5,0.574212],[0.8,1.980475],[1,3]],"15":[[0.2,0.011712],[0.5,0.574225],[0.8,1.980462],[1,3]],"60":[[0.2,0.011725],[0.5,0.574213],[0.8,1.980475],[1,3]]},"rotation_is_real":true…` |
| `M-P9` | RI-JRN04 | a press and release between two sim steps fires exactly once | exactly 1 (HF6, edge latching) | **pass** | `{"fires":1}` |
| `L6` | RI-JRN04 | with two pads the most recently active drives the game, and switching drops nothing | active index follows activity; 0 latched on removal | **FAIL** | `{"after_pad0":{"active":0,"held":["lock_on"]},"after_pad1":{"active":1,"held":[]},"after_both_gone":["heavy","parry"]}` |
| `M-P1/souls-default` | RI-JRN04 | map completeness for profile souls-default | observed map == §C for all actions; 0 unbound (HF1) | **pass** | `{"observed":{"0":{"hold":"interact","tap":null},"1":{"hold":"sprint","tap":"roll"},"2":{"hold":"use_item","tap":null},"3":{"hold":"two_hand","tap":"spell_cycle"},"4":{"hold":"block","tap":null},"5":{"hold":"lig…` |
| `M-P1/souls-handheld` | RI-JRN04 | map completeness for profile souls-handheld | observed map == §C for all actions; 0 unbound (HF1) | **pass** | `{"observed":{"0":{"hold":"jump","tap":null},"1":{"hold":"sprint","tap":"roll"},"2":{"hold":"use_item","tap":null},"3":{"hold":"two_hand","tap":"interact"},"4":{"hold":"block","tap":null},"5":{"hold":"light","ta…` |
| `M-P10` | RI-JRN04 | frames from the sampler observing a pad edge to the step that consumes it, over 200 presses | p100 <= 2 frames | **pass** | `{"n":200,"p50":1,"p100":1,"never":0}` |
| `M-P11` | RI-JRN04 | a mid-play disconnect releases every held action on the disconnect frame | held empty on the disconnect frame; displacement <= 0.05 m (HF3) | **pass** | `{"heldBefore":["sprint"],"heldAfter1":[],"move_after":[0,0],"displacement_m":0,"frames_advanced":301,"ui":false}` |
| `M-P12` | RI-JRN04 | the sim keeps advancing across a disconnect and no modal appears | 0 modal surfaces; sim advances (HF4 / seam S14) | **pass** | `{"frames_advanced":301,"ui":false}` |
| `M-P13` | RI-JRN04 | device class is inferred from media queries before any pad exists | deviceClass from the viewport, never from the gamepad list (L1) | **pass** | `{"deviceClass":"desktop","pad_connected":false,"viewport_deviceClass":"desktop"}` |
| `M-P15` | RI-JRN04 | a mapping-"" pad is de-permuted from pad-quirks.json; an unknown one calibrates on the pad alone | known id -> correct map, no prompt; unknown id -> calibration in <= 8 inputs (HF2) | **pass** | `{"raw0":{"hold":"use_item","tap":null},"raw1":{"hold":"interact","tap":null},"raw2":{"hold":"sprint","tap":"roll"},"raw5":{"hold":"light","tap":null},"quirk_used":"3537:1004","prompted":false,"calibration":{"st…` |
| `M-P2` | RI-JRN04 | index 16 fires nothing; a 16-button descriptor throws nothing | no action, no exception, no undefined read | **pass** | `{"before":[],"afterGuide":[],"sixteen_button_descriptor_threw":null,"held_after":[]}` |
| `M-P3` | RI-JRN04 | trigger fires at >= 0.35, releases at <= 0.20, exactly one of each, 0 dither fires | one fire at 0.35, one release at 0.20, 0 extra during a 0.30<->0.40 dither (HF8) | **pass** | `{"fires":[0.35],"releases":[0.2],"dither_extra_fires":0,"value_path_fires":true}` |
| `M-P4` | RI-JRN04 | charge state entered only above T_full = 0.85, stable across 5 runs | never at 0.5, always at 0.9, same frame 5/5 | **pass** | `[{"half_intent":0,"full_intent":1,"entered_at_frame":0},{"half_intent":0,"full_intent":1,"entered_at_frame":0},{"half_intent":0,"full_intent":1,"entered_at_frame":0},{"half_intent":0,"full_intent":1,"entered_at…` |
| `M-P5` | RI-JRN04 | B tap => roll (<= 11 f), B hold => sprint (>= 12 f), never both, never neither | roll for <= 11, sprint from 12; never both, never neither | **pass** | `{"4":{"roll":true,"sprint":false},"8":{"roll":true,"sprint":false},"11":{"roll":true,"sprint":false},"12":{"roll":false,"sprint":true},"13":{"roll":false,"sprint":true},"20":{"roll":false,"sprint":true},"60":{"…` |
| `M-P6` | RI-JRN04 | radial deadzone: 0 below 0.14 at every bearing, 1.0 at 0.92, isotropic at 0.60 | max/min ratio at 0.60 <= 1.02; > 1.10 means an axial deadzone | **pass** | `{"1":{"min":1,"max":1,"ratio":1},"0.1":{"min":0,"max":0,"ratio":1},"0.14":{"min":0,"max":0,"ratio":1},"0.2":{"min":0.06493506493506492,"max":0.06493506493506498,"ratio":1.000000000000001},"0.6":{"min":0.5844155…` |
| `M-P7` | RI-JRN04 | axes [0.707, -0.707] produce a 45 degree heading | 45 +/- 1.5 deg | **pass** | `{"move":[0.7071067811865475,0.7071067811865475],"bearing_deg":45}` |
| `M-P8` | RI-JRN04 | camera degrees per FIXED STEP is monotonic in stick magnitude and identical at 3 render rates | identical across render rates AND non-zero (HF6) | **pass** | `{"per_rate":{"0":[[0.2,0.011725],[0.5,0.574212],[0.8,1.980475],[1,3]],"15":[[0.2,0.011712],[0.5,0.574225],[0.8,1.980462],[1,3]],"60":[[0.2,0.011725],[0.5,0.574213],[0.8,1.980475],[1,3]]},"rotation_is_real":true…` |
| `M-P9` | RI-JRN04 | a press and release between two sim steps fires exactly once | exactly 1 (HF6, edge latching) | **pass** | `{"fires":1}` |
| `M-P17` | RI-JRN04 | no touch control intersects a safe-area inset on a clamped landscape phone | 0 elements intersect an inset; every target >= 44 CSS px (H3/H11) | **pass** | `{"violations":0,"min_target_css_px":44}` |
| `M-P21a` | RI-JRN04 | all sixteen actions of the closed set reachable on touch | every action fires (HF5 / O17) | **pass** | `{"reach":{"roll":"sprint","block":"block","light":"light","interact":"interact","jump":"jump","parry":"parry","heavy":"heavy","use_item":"use_item","crouch":"crouch","lock_on":"lock_on","two_hand":"two_hand","s…` |
| `M-P21b` | RI-JRN04 | multi-touch: stick + camera + two buttons all register simultaneously | 4 pointers, camera still turns while a button is held (How we lose #12) | **pass** | `{"pointers":4,"roles":["stick","camera","button","button"],"held":["light","block"],"move":[0.7071067811865475,0.7071067811865475],"camera_turned_deg":16.8}` |
| `M-P22` | RI-JRN04 | touch controls hide 2 s after the last touch while a pad is active and return on touch | visible at 1 s, gone by 2.5 s, back on touch (T7) | **pass** | `{"visAt1s":true,"visAt2_5s":false,"visAfterTouch":true}` |
| `T2` | RI-JRN04 | the virtual stick floats: the same drag from two origins gives the same vector | identical move vector (T2) | **pass** | `{"origin_a":[0.7071067811865475,0.7071067811865475],"origin_b":[0.7071067811865475,0.7071067811865475],"same":true}` |
| `H12` | RI-JRN04 | the wake-lock and orientation-lock capabilities are probed, not assumed | capability report present; absence is reported, never thrown | **pass** | `{"orientationLock":true,"fullscreen":true,"wakeLock":true,"matchMedia":true}` |
| `M-P16` | RI-JRN04 | portrait shows an in-world rotate state and recovers on rotation with no reload | a rotate state with 0 UI-kit chrome, recovered within 30 frames (H1) | **pass** | `{"rotateState":{"kind":"rotate","line":"The map lies the long way.","illustration":"chart-on-a-table"},"recovered_after_frames":0}` |
| `M-P18` | RI-JRN04 | an 88 px chrome collapse costs 0 sim frames and 0 camera pose change | 0 frames lost, camera delta 0 (H4) | **pass** | `{"frames_advanced":60,"camera_delta":{"yaw":0,"pitch":0},"resizes":4}` |
| `M-P19` | RI-JRN04 | pinch, double-tap zoom, pull-to-refresh, selection and the long-press callout are all suppressed | 0 zoom, 0 navigation, 0 selection, 0 callout; dvh not vh (H4/H5) | **pass** | `{"touch_action":"none","overscroll":"none","user_select":"none","gesturestart_prevented":false,"contextmenu_prevented":true,"selectstart_prevented":false,"viewport_meta":"width=device-width, initial-scale=1, ma…` |
| `M-K17` | RI-JRN03 | five rebinds including a mouse button and a conflict; conflict named before commit; serialised | all persist; the conflict named the previous owner before commit (RB4); an orphaning take is refused (RB5) | **pass** | `{"edits":[{"action":"light","control":"KeyP","took":null,"line":null},{"action":"heavy","control":"Mouse4","took":"roll","line":"Forward already answers for getting out of the way."},{"action":"jump","control":…` |
| `M-K18` | RI-JRN03 | the rebinding surface is completable on keyboard only, gamepad only and touch only | 3/3 (HF9 / RB10) | **pass** | `{"keyboard":{"began":true,"offered":{"control":"KeyJ","conflictWith":null,"line":null},"committed":{"ok":true,"device":"keyboard","action":"light","slot":0,"control":"KeyJ","took":null},"steps":["idle","idle","…` |
| `M-K19` | RI-JRN03 | unbinding the last control an action has is refused | refused (RB5) | **pass** | `{"unbind_secondary":{"ok":true},"unbind_last":{"ok":false,"refused":"zero_binding","line":"Leave it unbound and you leave it undone."}}` |
| `M-P23` | RI-JRN04 | a pad-only rebind commits and index 16 is refused in fiction | pad-only completable; index 16 never offered | **pass** | `{"gamepad":{"began":true,"offered":{"control":"Pad5","conflictWith":null,"line":null},"committed":{"ok":true,"device":"gamepad","action":"light","slot":0,"control":"Pad5","took":null},"steps":["idle","idle","be…` |
| `H12` | RI-JRN04 | the wake-lock and orientation-lock capabilities are probed, not assumed | capability report present; absence is reported, never thrown | **pass** | `{"orientationLock":true,"fullscreen":true,"wakeLock":true,"matchMedia":true}` |
| `M-K17` | RI-JRN03 | five rebinds including a mouse button and a conflict; conflict named before commit; serialised | all persist; the conflict named the previous owner before commit (RB4); an orphaning take is refused (RB5) | **pass** | `{"edits":[{"action":"light","control":"KeyP","took":null,"line":null},{"action":"heavy","control":"Mouse4","took":"roll","line":"Forward already answers for getting out of the way."},{"action":"jump","control":…` |
| `M-K18` | RI-JRN03 | the rebinding surface is completable on keyboard only, gamepad only and touch only | 3/3 (HF9 / RB10) | **FAIL** | `{"keyboard":{"began":false,"offered":null,"committed":{"ok":false},"steps":["idle","idle","idle"]},"gamepad":{"began":false,"offered":null,"committed":{"ok":false},"steps":["idle","idle","idle"]},"touch":{"bega…` |
| `M-K19` | RI-JRN03 | unbinding the last control an action has is refused | refused (RB5) | **pass** | `{"unbind_secondary":{"ok":true},"unbind_last":{"ok":false,"refused":"zero_binding","line":"Leave it unbound and you leave it undone."}}` |
| `M-P16` | RI-JRN04 | portrait shows an in-world rotate state and recovers on rotation with no reload | a rotate state with 0 UI-kit chrome, recovered within 30 frames (H1) | **pass** | `{"rotateState":{"kind":"rotate","line":"The map lies the long way.","illustration":"chart-on-a-table"},"recovered_after_frames":0}` |
| `M-P17` | RI-JRN04 | no touch control intersects a safe-area inset on a clamped landscape phone | 0 elements intersect an inset; every target >= 44 CSS px (H3/H11) | **pass** | `{"violations":0,"min_target_css_px":44}` |
| `M-P18` | RI-JRN04 | an 88 px chrome collapse costs 0 sim frames and 0 camera pose change | 0 frames lost, camera delta 0 (H4) | **FAIL** | `{"frames_advanced":0,"camera_delta":{"yaw":0,"pitch":0},"resizes":5}` |
| `M-P19` | RI-JRN04 | pinch, double-tap zoom, pull-to-refresh, selection and the long-press callout are all suppressed | 0 zoom, 0 navigation, 0 selection, 0 callout; dvh not vh (H4/H5) | **pass** | `{"touch_action":"none","overscroll":"none","user_select":"none","gesturestart_prevented":true,"contextmenu_prevented":true,"selectstart_prevented":true,"viewport_meta":"width=device-width, initial-scale=1, maxi…` |
| `M-P21a` | RI-JRN04 | all sixteen actions of the closed set reachable on touch | every action fires (HF5 / O17) | **pass** | `{"reach":{"roll":"sprint","block":"block","light":"light","interact":"interact","jump":"jump","parry":"parry","heavy":"heavy","use_item":"use_item","crouch":"crouch","lock_on":"lock_on","two_hand":"two_hand","s…` |
| `M-P21b` | RI-JRN04 | multi-touch: stick + camera + two buttons all register simultaneously | 4 pointers, camera still turns while a button is held (How we lose #12) | **FAIL** | `{"pointers":4,"roles":["stick","camera","button","button"],"held":["light","block"],"move":[0,0],"camera_turned_deg":0}` |
| `M-P22` | RI-JRN04 | touch controls hide 2 s after the last touch while a pad is active and return on touch | visible at 1 s, gone by 2.5 s, back on touch (T7) | **FAIL** | `{"visAt1s":true,"visAt2_5s":true,"visAfterTouch":true}` |
| `M-P23` | RI-JRN04 | a pad-only rebind commits and index 16 is refused in fiction | pad-only completable; index 16 never offered | **FAIL** | `{"gamepad":{"began":false,"offered":null,"committed":{"ok":false},"steps":["idle","idle","idle"]},"guide":{"refused":"guide","line":"That one answers to the machine before it answers to you."}}` |
| `T2` | RI-JRN04 | the virtual stick floats: the same drag from two origins gives the same vector | identical move vector (T2) | **pass** | `{"origin_a":[0,0],"origin_b":[0,0],"same":true}` |

**The two `unmeasurable` legs in `journey-run`'s own ledger** are `control_observed` and
`m4_clause1`, and they are `RI-JRN01`'s, not this piece's: the journey driver walks forward at the
opening, where the census surface is open and `consumeUI` zeroes movement by design, so nothing in
the world moves. `m_layouts` — the leg that is this piece's — replayed the journey under
**qwerty, azerty and qwertz** with **0 dropped inputs and the body moving on all three**.

**One check fails under the shim and passes without it.** `L6` (two pads, most-recently-active
wins) reports a latched `heavy`/`parry` when run with `--shim x2s-hid-dualsense`, because the
shim's own pad is present at `navigator.getGamepads()[0]` *alongside* the two synthetic pads the
check pushes, so the check's "both pads gone" step does not actually remove the third. It is an
interaction between two instruments, not a build behaviour: the same check passes 16/16 in the
un-shimmed run, where the release on removal is exact.

**Two findings about the world, not the input layer**, both of which cost hours and both of which
any future probe will hit:

1. **The opening state consumes movement.** `engine._censusStep` calls
   `input.consumeUI(CENSUS_ACTIONS)` — `interact, block, light, heavy, roll` — *and* `consumeUI`
   zeroes `moveX/moveY`. At the boot state (`hold.hatch-name`, the barge hold) a perfect radial
   deadzone therefore measures as `[0,0]` at every magnitude, and five of sixteen actions read as
   dead buttons. That is correct behaviour — a surface that let the body swing behind it would be
   the defect — but it means **`held` is the wrong thing for a controls probe to read**. This tool
   reads `pipe.edges`, which `latchForStep` pushes *before* any surface consumes, which is exactly
   what `RI-JRN03` M-K1 means by "record which action fired **from the trace**".
2. **Pressing `interact` in an arena opens a conversation, and the conversation then consumes
   movement until `block` closes it.** The touch reachability sweep presses `interact` once per
   control; after it, a working virtual stick measures `[0,0]`. The legs that need movement are
   measured from a clean arena for that reason, and the ordering is commented in the tool.

## 6. The rulings I had to make, and the corpus debt behind them

1. **Two corpus items give different numbers for the same stick.** `RI-JRN04` §D binds the
   right-stick inner deadzone at **0.10**; `RI-CAM02` §A binds **0.15/0.95** *with* its rescale
   band and hard-**FAIL**s any yaw at `m ≤ 0.15`. `RI-JRN04`'s own header cedes camera behaviour
   to `RI-CAM02` and its row gives no outer saturation and no rescale band for that stick, so
   `RI-CAM02`'s fully specified band is used and `RI-JRN04` M-P8's threshold (monotonic, matches
   `sign·m'²` within 5%) is met against the same `m'` the build computes. The exponent — the part
   §D calls "the curve" — already agreed. **Debt: `RI-JRN04` §D should cite `RI-CAM02` rather than
   restate a different number.**
2. **Same again for the left stick**: §D says 0.14 inner, `RI-CAM02` §C says ≤ 0.15 idle. 0.15
   satisfies both, because M-P6 asks only that output be 0 *below* 0.14. §D's 0.92 outer
   saturation is adopted; `RI-CAM02` states none. Both agree on the 0.55 walk/run boundary, which
   is applied to the **rescaled** magnitude — which is what `RI-CAM02` §C's own preamble means by
   "the post-deadzone movement-stick vector".
3. **§C's pad table predates two action-set amendments** and leaves `crouch` and `spell_cycle` with
   no pad control. Resolved inside §C's own idiom: in `souls-default`, index 3's *tap* is
   `spell_cycle` and its *hold* stays `two_hand` (a stray tap then cycles a free, 0-stamina,
   0-focus spell instead of changing stance mid-fight, which is the exact rationale §C gives for
   gating index 3 at all), and index 10's *hold* is `crouch` with the tap still `jump`. In
   `souls-handheld` they take D-pad up/down, and the quick-slot cycle reserved there yields — a
   listed action outranks a reserved non-set function, which is the direction §C's reservation
   rule protects.
4. **The D-pad and list navigation.** §C gives D-pad ←/→ to `swap_left`/`swap_right`, so the
   D-pad cannot drive `move` during play as the shipped build had it. It drives `move` **only
   while a cursor-driven surface is open**, where there is no left-hand equipment to cycle and
   nothing is shadowed. That is what makes the rebinding surface walkable with a thumb.
5. **KB1's arithmetic.** `W`+`Shift`+`Space` is three keys, and KB1 says the default binding never
   needs more than two at once. The reconciliation is KB1's own stated physics: *"mouse buttons
   and modifiers are on separate matrix paths"*. `rolloverAudit()` classifies each control as
   `matrix`, `modifier` or `offboard` and asserts **matrix ≤ 2**; `M-K16` then drives a simulated
   2-key-rollover keyboard that drops a third simultaneous *matrix* key and runs the whole
   sprint-roll-attack sequence.

---

## 7. What I did not close

1. **The four authored strings are not drawn** (§4, orphan text). The refusal lines, the rotate
   line and the calibration prompts need a renderer in `game/src/render/ui.js`. Until they are
   drawn, `M-P15`'s calibration *works* — the map it builds is live and measured — but the player
   would be pressing buttons with nothing on screen telling them, in the world's own voice, what
   to press for.
2. **The touch controls are not drawn either.** `TouchInput.layout()` returns exactly what a
   renderer must draw, in CSS px, and every check drives the real hit-testing path — but there is
   no glyph on the canvas yet. Same file, same gap.
3. **`M-K21` (inscription census) and `M-K22` (prompt purity)** belong to the discoverability
   half, which depends on in-world inscription entities that `RI-JRN01` O12 owns and which this
   piece does not place. `M-K20`'s instruction-budget grep is measured; the census is not.
4. **The naive passes (`M-N1`–`M-N7`, `M-N1`–`M-N5`)** are `isolation: enforced` and belong to a
   fresh agent with no corpus. A builder cannot run them; that is the point of them.
5. **`H8` (thermal)** is `RI-PLT01` Tier-H and not measurable in this container. Declared, not
   claimed.
6. **`M-P25`** cites `RI-PLT01`/`RI-PLT02` at the phone profile; those are other pieces' budgets
   and are not restated here.

---

## 8. What a real GameSir X2s would still have to prove

Each row is a behaviour that a synthetic `Gamepad` cannot exhibit, what the build does about it,
and what it would take to check.

| # | Real-hardware behaviour | What the build does | What would be needed |
|---|---|---|---|
| 1 | **Which mapping Chromium-on-Android actually reports for VID 3537 / PID 1004.** `RI-JRN04` §A says the pad defaults to a DualSense-like HID profile and that direct vendor-page fetches 403'd, so the fact itself is `community-data, confidence medium`. | Both branches are implemented and both are measured. If §A is wrong the build takes the standard path, which is also measured. | The phone, the pad, and `navigator.getGamepads()[0].id` + `.mapping` read out in the browser. One line of console. |
| 2 | **The exact HID index permutation in its non-standard mode.** `pad-quirks.json` uses the standard DirectInput/HID face-cluster order (raw 0 = West). That is `canonical-recall`, not a measurement of this pad. | If the permutation is wrong for this device, the six-prompt calibration catches it and overwrites it, and the game never refuses to run. | Press each button on the real pad and log the raw index that changes. |
| 3 | **Hall-trigger rest values and the hair-trigger mode** (Capture + LT/RT for 2 s changes physical travel without changing the reported range). | 30-frame auto-zero of any rest value in `(0.05, T_fire)`, and hysteresis so a shifted rest cannot double-fire. | Reading `buttons[7].value` at rest, and again after toggling hair-trigger. |
| 4 | **Whether index 16 (Guide) is present**, and whether Android captures it. | Never bound; a 16-button descriptor is driven and produces no action and no exception (`M-P2`). | The pad. |
| 5 | **The 400 ms cable jog** the item's bar describes. Measured here as a synthetic disconnect + reconnect. | Every held action released on the disconnect frame; displacement after ≤ 0.05 m; profile and calibration restored on reconnect. | Physically jogging the USB-C connector while sprinting. |
| 6 | **Real touch hardware.** Every touch check drives `TouchInput` through the same entry points a `pointerdown` listener calls, at a 844×390 logical viewport with a 44 px cutout inset — but no finger has ever touched it. | Multi-touch is a pointer **map**; four simultaneous pointers are driven and all four register. | A phone. |
| 7 | **Orientation lock and fullscreen actually being granted.** Headless Chromium reports the APIs as present; whether Android grants them on a user gesture is a runtime question. | Refusal is handled: the rotate state appears, is an in-world illustration, and recovers on rotation with no reload. | The phone. |
| 8 | **`env(safe-area-inset-*)` on the owner's actual handset.** The insets are driven synthetically at `{top:0,right:44,bottom:21,left:44}`. | The whole touch arc is laid out from the safe-area corner, so it moves with the insets by construction, and the layout arithmetic is asserted at boot. | The phone, in the pad, in landscape. |
| 9 | **Thermal behaviour over 20 minutes** (`H8`). | Nothing. Declared unmeasurable. | The phone, and `RI-PLT01` Tier-H. |
| 10 | **A membrane keyboard that actually ghosts.** `M-K16` simulates 2-key rollover in the dispatcher. | The default binding needs ≤ 2 matrix keys for every common combination. | A cheap keyboard and a key-rollover tester. |

None of these lowered a threshold. Where a fact could not be checked, the build implements **both**
branches and the calibration sequence is the backstop — which is what `RI-JRN04` §A means when it
says *"no threshold in this item depends on any §A row being exactly right"*.

---

## 9. The shared tree, and three tools it broke

`node tools/harness/smoke.mjs` — **6/6 before this work and 6/6 after**, and every measurement in
§5 was taken on the repository tree.

It was not continuously possible. Several agents share this checkout and three things broke under
me; each is recorded because the next agent will hit the same class of thing.

1. **The game stopped booting for about an hour.** The main-quest builder's in-flight
   `game/data/quests/mainline-act2.json` named `Q-MAIN-11`, then `Q-MAIN-16`…`23`, none of which
   existed, and `QuestBook`'s integrity check is fail-loud by design — so it took every browser
   measurement in the tree with it, not only mine. I measured against a rig that differed only in
   `game/data/quests/` while it lasted, and re-ran everything on the repository once act3 landed.
   The numbers in §5 are all from the repository.
2. **`tools/journey/journey-run.mjs`** landed from the tool builder at 07:09 — **I did not write
   it**. Three additive fixes, declared here as `orchestration/TOOL-LOOP.md` requires:
   * `--entry` / `--url` now reach `resolveEntry()`, which already supported both. Without it the
     driver can only ever run the repo's own tree, so a tree another agent has left mid-write
     blocks every journey in the corpus at once.
   * After the gamepad shim's reload it now waits for `ready()` rather than for
     `window.__HARNESS` alone. This was a hard blocker: **every** `--gamepad` run — i.e. every run
     of `RI-JRN04`'s own Comparison method — aborted at exit 12 with
     `Cannot read properties of null (reading 'textRegister')`.
   * Its `import { installShim } from './gamepad-shim.mjs'` became a **SyntaxError at module
     load** when a later tool-builder round replaced the shim's `installShim` + reload with
     `initScripts` applied before navigation. That change is strictly better; removing the export
     took all nine journeys down with it. Both shapes are now handled.
3. **`tools/journey/gamepad-shim.mjs`** was already on disk, is correct, and injects at the right
   seam. Used unmodified; `input-checks.mjs` composes with whichever API shape it exposes.

Two defects of my own, caught by my own runs and worth recording because they are traps:

* the touch layer's T7 timeout originally read `performance.now()` inside the fixed step, which
  the determinism guard correctly killed the whole run for. It is now counted in fixed sim frames
  — and a frame counter that rewinds on `reset()` or a save load is clamped, because otherwise the
  overlay's timer is stranded in the future and the controls never hide;
* `M-K12` briefly passed **vacuously**: it read `getCameraFrame().yaw`, which does not exist
  (the field is `camera.yaw_deg`), so every render rate returned `NaN` and "all rates identical"
  was trivially true. The check now demands a real, non-zero rotation as well as equality. That is
  the failure mode `AGENT-PROTOCOL` names, found in my own instrument, and it is the reason
  `--self-test` exists.

## 10. Files

Built or rewritten: `game/data/input/profiles.json`, `game/data/input/pad-quirks.json`,
`game/src/input/{gamepad,touch,viewport,rebind,bindings,real,pipeline}.js`,
`tools/journey/input-checks.mjs`.
Edited: `game/src/engine.js`, `game/src/sim/step.js`, `game/src/harness/api.js`,
`game/src/combat/player.js` (one line: the charge promotion is gated on `chargeIntent`, which is
1 for every digital control and only a pad ever lowers), `game/index.html`,
`tools/journey/journey-run.mjs`.
