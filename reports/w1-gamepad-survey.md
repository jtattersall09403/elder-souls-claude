# W1-GAMEPAD — the gamepad path

**Builder survey.** Base commit `52cffa1`. Every number below is stamped to the commit it was
taken at (RULES 12) and every one was taken on this box under the load declared in §7.

---

## 0. The question the dispatch asked first, answered before anything was changed

`orchestration/NEXT-DISPATCH.md` said **`gamepad-shim.mjs` — does not run, 3/3 crash. This is the
GameSir path the owner tests on.** The W1-21 round-2 critic then drove a real gamepad through all
six screens. The brief asked which of those two is wrong.

**Neither. The note is stale by two rounds, and there was never a contradiction.**

| round | what it says about `gamepad-shim.mjs` |
|---|---|
| `TOOL-COVERAGE-R1.md:48` | **REBUILD — does not run.** 3/3 crash. |
| `TOOL-COVERAGE-R2.md:20` | "repaired: `gamepad-shim` runs (**8/8**, was 3/3 crash)" — then REBUILD (narrow), no entity-side observation |
| `TOOL-COVERAGE-R3.md:370` | **"12/12 … Accept."** |

Run at `52cffa1`, before I touched anything:

```
$ node tools/journey/gamepad-shim.mjs --self-test
gamepad-shim self-test: PASS (12/12)        exit 0
```

The bullet sits under a heading that says in its own words *"The R1 list below is kept because
parts of it are still open."* This bullet was not one of the open parts. It has been struck, with
the evidence, in `orchestration/NEXT-DISPATCH.md`.

**And the critic drove a different seam on purpose.** `__HARNESS.gamepad()` →
`RealInput.pushGamepadState()` sets `syntheticPads`, which makes `pollGamepad()` skip
`navigator.getGamepads()` entirely. The shim injects *above* that seam. `RI-JRN01 §0.1(a)` struck
the shim reference for the reachability legs deliberately and kept it for the descriptor leg. Two
instruments, two seams, both alive, neither stale.

**Per the brief's own scope note, that is a complete result and I did not stretch it into a
round.** The rest of this survey is the stick, the screens and the opening — and one defect that
the stick measurement found on its own.

---

## 1. The whole opening, played on a pad alone

`tools/gamepad/pad-run.mjs --leg opening`. **Not one keyboard event is dispatched anywhere in the
file.** No `censusAnswer`, no `titleActivate`, no `openMenu`, no `queueInputs`. Every input is
`__HARNESS.gamepad(state)` → `RealInput.pushGamepadState()` → `RealInput.pollGamepad()` — the
identical call `FixedLoop.beforeTick` makes every rAF for a physical pad (`engine.js:634`).

### The published sequence

| # | on the pad | what happened |
|---|---|---|
| 1 | left stick down, ×n | title focus walks `continue → new` |
| 2 | **index 0** (`interact`) | `New` → body in the **barge hold**, census at `hold.come-to` |
| 3 | left stick held | walked to Jeeh-Ei, ending at `[-1.32, 0, 1.56]` |
| 4 | **index 0** | the scene opens at `hold.hatch-name` |
| 5 | index 0 / stick down | **ten census nodes answered**, incl. the two-pick class nodes |
| 6 | index 0 at `hold.hatch-name` | **the name, taken from the ledger: `"Silence-Under-Salt"`** |
| 7 | left stick held | the census hands control back — walked out of the hold to `[1.9, 0, 0.3]` |
| 8 | — | census `done`. **Teeba-Ei — saxhleel, Salt-Blade, raj-xul, raised interior** |

`6 pass · 0 fail`. Artifact: `reports/w1-gamepad/pad-run.json`.

### The name question — a ruling, not a question (RULES 0)

The brief said an on-screen keyboard, a name from a list, or the keyboard staying necessary are
all defensible, and that picking one and defending it is rule 0's job.

**Ruling: a name from a list, and it is already built.** `character/scene.js:_nameOptions()`
offers a ledger at every text node and `step()` commits `this.typed ? this.typed : opt.id`, tagging
the commit `via: 'ledger'`. The reason is in the function's own docstring and it is `RI-JRN01 O8`:
an on-screen keyboard would be the full-screen panel O8 forbids. Typing on a keyboard still works
and overrides the highlight, so the keyboard loses nothing.

What this round adds is that it is now a **measured** claim rather than a comment. The run above
dispatches no key at all, so had the ledger not committed, the census would have stalled at
`hold.hatch-name` forever and `O4` would be red.

**Reversible, and here is what would overturn it:** if play-testing shows players want a name the
ledger does not carry and reach for a keyboard to get it, the ledger is insufficient and an
O8-compatible *inline* (never full-screen) character wheel is owed.

---

## 2. Every screen, opened and closed on the pad, with a control that goes red

`--leg screens`. Six screens × two close buttons × a 45-frame dwell = **12 of 12 open-hold-close
cycles ended back in the world.**

**The control first, because it is worth more than the result.** Pad index **8** is `journal` in
`souls-default`'s RESERVED table — a real index on a real pad bound to no action of the closed set.

```
S0   CONTROL: pad index 8, pressed twice ............ world -> world
S0b  and the control is NOT INERT: index 9 (menu),
     same body, same frames ......................... world -> inventory
```

Three different button patterns, so "reachable" is not one lucky sequence:

```
A  open=9  step=15 (swap_right)  close=9   inventory -> journal -> sheet -> spells -> map -> levelup
B  open=9  step=14 (swap_left)   close=1   inventory -> world   (the ring wrapping, correctly)
C  as A, +90 frames of dwell at every screen before it is read
```

**RULES 8 is the point of pattern C.** A screen that opens on a button press and closes on the
next frame is not "reachable". All six were still open **90 fixed frames** after the press that
opened them (`S3`), and each of the twelve close cycles held its screen open for **45 frames**
before closing it.

`levelup` is in the ring only at a hearth and this run reaches the hearth through
`setAtHearth(true)`. Declared, not hidden — the same declaration the W1-21 r2 critic made. The
other five need no world state at all.

Picture: `docs/shots/2026-08-08-w1-gamepad-the-map-screen-opened-by-a-gamepad.png` — the map
screen, opened by pad index 9 then index 15, its own legend reading *"stick: the places you have
found · confirm: where I am · back: close"*.

---

## 3. Walk, sprint, roll — one index, two verbs

`--leg locomote`, 60 fixed frames each, one pad poll per sim frame.

Measured on **the body the pad just created**, standing where the opening left her (the
writ-house). The venue is recorded in the artifact as `locomotion_venue`; the tool steps out to
open ground and says so if the room is too small to hold a 60-frame sprint, which it was not here.

| | metres over 60 frames |
|---|---|
| nothing held (**null control**) | **0.00** |
| left stick full forward | **3.20** |
| left stick + index 1 held | **4.67** (1.46×) |

(`3.20 m / 60 f@60 = 3.2 m/s = jog_mps`; `4.67 m/s` against `sprint_mps` 5.0, the shortfall being
the acceleration ramp inside the window. The standalone run from the province boot position gave
2.24 m / 4.67 m — same verdict, different ground.)

**The roll/sprint discriminator is read as an action, not a distance**, because a roll and a
sprint both move you and distance alone cannot tell them apart. `getInputEdges()` is the A-JRN7
edge log:

```
index 1 tapped  5 frames  ->  [roll:down]
index 1 held   20 frames  ->  [sprint:down]
```

Never both, never neither.

**And I broke the discriminator on purpose and watched it go red.** `--break-gate` sets the index-1
hold gate from 12 frames to 1 in the running world, so a tap that should roll becomes a sprint:

```
TEARDOWN --break-gate: hold_gate[1].frames 12 -> 1
  index 1 tapped  5 frames  ->  [sprint:down]      <- was [roll:down]
  index 1 held   20 frames  ->  [sprint:down]
FAIL L3  the roll/sprint discriminator is wrong: tap gave [sprint:down], hold gave [sprint:down]
```

`L0`, `L1` and `L2` stayed green throughout — the teardown breaks exactly the check it targets and
nothing else, which is what stops it being a second copy of the experiment.

**This is only measurable because the run interleaves one pad poll per
sim frame.** `beforeTick` polls the pad on the rAF tick, not inside `stepOnce()`, so
`gamepad(s); stepFrames(20)` gives the router *one instant* and a twelve-frame hold gate can never
fire. `gamepad(s); stepFrames(1)` × 20 is what a real pad gets at 60 Hz. RULES 8, in the
instrument rather than in the write-up.

---

## 4. The stick response curve — 15 deflections, 3 bearings, 3 windows per hold

`--leg curve`. **45 rows.** Camera pinned to yaw 0; the body teleported back to the same patch of
open ground before **every** row.

### Why the teleport is not tidiness

The first draft let each deflection start where the last one stopped. By the eighth row of the
diagonal sweep the body was against a wall: 45° commanded came back as 63.7°, then 90.0°, then
**0 m at full tilt**. Every one of those numbers was real and **none of them was about the stick** —
they were the collision solver sliding a body along a surface. Publishing them as a steering defect
would have been exactly the mistake this project keeps paying for. Rows are now independent and
obstruction is flagged explicitly; in the published sweep **0 of 45 rows were obstructed**.

### The curve as it now ships (forward bearing, steady-state window: frames 60→120 of one hold)

**45 rows, 0 of them obstructed.** `model m/s` is `combat.player.speedMps` — what the locomotion
model says; `world m/s` is the displacement the body actually achieved. They agree to four
decimals at every row, which is itself the check that nothing downstream is quietly eating motion.

| stick | rescaled `move_mag` | model m/s | world m/s | gait |
|---:|---:|---:|---:|---|
| 0.05 | 0.000 | 0.000 | **0.0000** | idle |
| 0.10 | 0.000 | 0.000 | **0.0000** | idle |
| 0.14 | 0.000 | 0.000 | **0.0000** | idle |
| **0.16** | 0.013 | 0.047 | **0.0472** | walk |
| **0.20** | 0.065 | 0.236 | **0.2361** | walk |
| **0.25** | 0.130 | 0.472 | **0.4723** | walk |
| 0.27 | 0.156 | 0.567 | **0.5667** | walk |
| 0.30 | 0.195 | 0.708 | **0.7084** | walk |
| 0.40 | 0.325 | 1.181 | **1.1806** | walk |
| 0.45 | 0.390 | 1.417 | **1.4168** | walk |
| 0.55 | 0.519 | 1.889 | **1.8890** | walk |
| 0.70 | 0.714 | 3.200 | **3.2000** | run |
| 0.85 | 0.909 | 3.200 | **3.2000** | run |
| 0.92 | 1.000 | 3.200 | **3.2000** | run |
| 1.00 | 1.000 | 3.200 | **3.2000** | run |

The three bold rows are the ones §5's fix recovered. **Before it, all three read 0.0000** and the
first thing the stick did was jump straight to 0.567 m/s.

- **C2 — it is not a switch.** **Nine** distinct speeds below saturation (six before the fix).
  At 0.45 the body walks 1.417 m/s against 3.200 m/s at full tilt.
- **C3 — monotonic** across twelve deflections.
- **C4 — outer saturation at 0.92 is real:** 0.92 and 1.00 are both 3.200 m/s.
- **C5 — RULES 8, inside the hold.** Three consecutive windows (0–30, 30–60, 60–120) in every
  single hold. The 30–60 and 60–120 windows agree within 10% at all **33** live rows. **The 0–30
  window is slower at every deflection** — the body accelerating and the bounded-turn law swinging
  it onto the bearing — and a single cumulative average would have hidden that and put a spurious
  knee at the bottom of the curve.
- **C6 — DIRECTION.** Three bearings (0°, +45°, −90°) × 15 deflections, on **two independent
  observables**: the latched move vector (pure input layer, which nothing in the world can bend —
  36 rows) and the body's own heading in open ground (36 rows). **Worst error on either: 0.00°.**
- **C7 — the regression guard.** `move_deadzone` reads 0 on this tree and forcing it to 0 changes
  nothing, which is the two arms being identical *because the fix is in*. The historical A/B lives
  in `deadzone-deletefix.mjs`, §6.

---

## 5. THE DEFECT — a second deadzone on an already-deadzoned stick

**This is the round's finding, and the stick sweep is what found it.**

`input/gamepad.js shapeMoveStick()` removes RI-JRN04 §D's 0.15 inner deadzone and **rescales** the
remainder onto [0,1]. Its own comment says the rescale is there *"so there is no dead step at the
deadzone edge"*. `combat/player.js:994` then applies `locomotion.move_deadzone: 0.15`
(`engine.js:707`) **a second time, to that already-rescaled magnitude**, and puts the dead step
straight back one rescale further out.

**Only an analogue device can reach the branch.** `input/real.js _pushMove()` normalises the
keyboard to magnitude 1, so the keyboard never enters it. `input/touch.js` pre-shapes exactly as
the pad does. **The pad and the touchscreen were the only two devices affected** — which is why a
project driven mostly by keyboard probes never saw it.

### Measured, matched arms, one body, one browser

| stick | shipped (`move_deadzone = 0.15`) | `move_deadzone = 0` |
|---:|---:|---:|
| 0.14 | 0.0000 | 0.0000 |
| **0.16** | **0.0000** | **0.0472** |
| **0.20** | **0.0000** | **0.2361** |
| **0.25** | **0.0000** | **0.4723** |
| 0.27 | 0.5667 | 0.5667 |
| 0.30 | 0.7084 | 0.7084 |
| … 0.45 / 0.55 / 0.70 / 0.92 / 1.00 | identical | identical |

- Documented deadzone: **0.15**. Deflection at which the body actually started moving: **0.27**.
- Predicted by double application: `0.15 + 0.15 × (0.92 − 0.15) = ` **0.2655**. Measured 0.27,
  which is the next point on my grid.
- **15% of the live stick range was dead**, and the first deflection that did anything jumped
  straight to 0.567 m/s instead of easing in.

### The fix

`game/src/engine.js:707` — `move_deadzone: 0.15` → **`0`**. The guard is *kept* and set to zero
rather than deleted: the deadzone belongs to the device layer (RI-JRN04 §D, RI-CAM02 §C) and both
analogue producers implement it there, but if a future producer ever hands that line a raw stick
magnitude, this is where it would be caught, and a live literal is easier to find than a deleted
branch.

---

## 6. Delete-the-fix, and I watched the control go red (RULES 6)

`tools/gamepad/deadzone-deletefix.mjs`. RULES 6 names three failure shapes; this probe is built to
catch all three, because the dangerous one here is the third.

| | check | result |
|---|---|---|
| **inert fix** | `A1` — the value is read **out of the running engine** on the shipped tree (RULES 7), and `combat.playerCtl.d` **is** the object I edited | `move_deadzone = 0`, same object ✔ |
| **inert control** | `B1` — the teardown must reproduce the **old number exactly**, not merely differ | first-live back to **0.27**; 0.16/0.20/0.25 all back to **0.000 m/s** ✔ |
| **inert fix that improves the number** | `A2` — **exactly** the rows the arithmetic predicts changed: `(0.15, 0.2655]` = `[0.16, 0.20, 0.25]` and no others | ✔ |
| | `A3` — every deflection above 0.2655 **byte-for-byte identical** across both arms (7 rows) | ✔ |
| | `A4` — the player-facing claim, separate from "a number changed": the stick now **eases in** (0.047 → 0.236 → 0.472 m/s, rising) instead of stepping straight to 0.567 | ✔ |

Both arms run on **one body in one browser over the same frames**, so nothing but the one number
differs between them. `5 pass · 0 fail`.

### The shim's own teardown, also watched going red

TOOL-COVERAGE-R3 accepted `gamepad-shim.mjs` 12/12 and left **one note uncharged**:

> *"Note, not charged: the check is `dist(p0,p1)` — a scalar. A router with inverted axes, or one
> that walks a fixed heading regardless of stick direction, passes green and control both. Assert
> the **direction**, not just the distance."*

Closed. `entitySideCheck()` now drives four bearings from one starting point and requires them 90°
apart in the right order, and a **new** teardown `--break-direction` swaps the two movement axes at
the seam so the distance survives and only the bearing is wrong. The existing `--break-router`
could not falsify a direction check — it zeroes the axes, so the *scalar* check already goes red.

```
RED: with the two stick axes SWAPPED, the distance check and its null control STILL PASS
     — player moved 6.4 m (unbroken run: 5.44 m), drift 0 m at rest
RED: and the DIRECTION check catches it
     — forward: commanded 0° got -90°; right: 90° got 180°; back: 180° got 90°; left: -90° got 0°
```

The broken arm walks **further** than the correct one (6.4 m against 5.44 m). That is R3's point
made in one line: **a number moving the right way is not evidence.**

`gamepad-shim.mjs --self-test`: **15/15**, up from 12/12. It runs; it is not deleted.

---

## 7. CONSUMPTION — RI-MTH07, mandatory

The model is `game/data/input/profiles.json`. It has **two** world-side consumers and both are
perturbed in the running world and watched changing behaviour.

**M1 — the UI.** Move `menu` from pad index 9 to index 3 through `__HARNESS.perturbInput()`, in
the running world, and watch which physical button opens the screen change:

```
shipped:   index 9 -> inventory,  index 3 -> world
perturbed: index 9 -> world,      index 3 -> inventory      (buttons.menu 9 -> 3)
restored:  index 9 -> inventory
```

**M2 — the body.** Widen `analog.left_stick.inner_deadzone` from 0.15 to 0.50 and watch a walk
that worked stop working, while full tilt keeps working — so the perturbation is specific and not
a global break. Restored afterwards, and the restore is checked.

### Load declaration (RULES 26)

`node tools/contention.mjs --gate` returned **GO** before every browser launch in this piece
(2 browser instances, 1.39–2.20 load per core against a 4.0 ceiling). **One browser per instrument,
kept for the whole instrument, closed by handle — never `pkill`.** Every figure here is a distance,
a count or a boolean derived from *fixed simulation frames*, not from wall clock, so none of it is
load-sensitive; **no wall-clock timing figure is published in this piece**, deliberately.

---

## 8. Reproducing every number here

`reports/*.json` is gitignored by deliberate project policy (`reports/.gitignore`: run artifacts
are "evidence for a verdict, not source", reproducible from the tools). Every figure in this
survey is therefore reproduced by re-running the tool, not by reading a committed file:

```
node tools/gamepad/pad-run.mjs --leg all          # §1-§4, §7   24 pass 0 fail
node tools/gamepad/pad-run.mjs --leg locomote --break-gate   # §3 teardown, L3 must go RED
node tools/gamepad/deadzone-deletefix.mjs         # §6           5 pass 0 fail
node tools/journey/gamepad-shim.mjs --self-test   # §0, §6      15/15
node tools/journey/gamepad-shim.mjs --self-test --break-direction
```

The two teardown invocations are expected to FAIL, and that is the point of them.

---

## 9. What I did not do

- **I did not walk from the writ-house out into the open province on the pad in one continuous
  run.** The opening ends where the game's opening puts you — inside the writ-house — and the
  locomotion and curve legs measure in open ground. When the room the created body is standing in
  is too small to hold a 60-frame sprint, the tool teleports to open ground and **says so in its
  own artifact** (`locomotion_venue.moved_out`) rather than publishing a number the geometry chose.
- **I did not drive the camera on the right stick.** Mouse-look and pointer lock do not survive
  headless, so the camera bearing is set directly and every metre of *translation* is the left
  stick's. The right stick's shaping (`shapeRightStick`, exponent 2.0) is therefore **unmeasured by
  me**; only the left stick's curve is published.
- **I did not measure the pad inside a fight.** `swap_left` is half of the offhand chord in
  combat and the screen-walk branch is guarded `!inCombat`; the W1-21 r2 critic could not enter
  combat either (`aggro()` threw). The in-combat arm of the pad path remains unmeasured by anyone.
- **I did not test a physical GameSir X2s.** Neither can anything in this container. The
  descriptor leg is the closest available: `gamepad-shim.mjs` injects that pad's two real
  descriptors — `x2s-standard` and the `mapping: ''` HID form — at the
  `navigator.getGamepads()` seam.
- **I did not re-run the whole tool-coverage list.** The `gamepad-shim` bullet was stale; I
  checked only that one. **The four bullets beside it in `NEXT-DISPATCH.md` §2 are from the same
  R1 list and I did not verify any of them.** Given that one of five was two rounds out of date,
  someone should.
- **I did not audit whether `move_deadzone`'s second reader** (`combat/player.js:1134`, the
  levitation locomotion branch) has a behaviour change worth measuring. It reads
  `mag > (move_deadzone || 0)`, which with 0 becomes `mag > 0` — correct, but unmeasured.
