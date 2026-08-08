# W1-TOUCH — can a phone play this?

**Commit:** measured at `9a3e1a7` (+ this piece's own edits; every artifact stamps its own).
**Instrument:** `tools/touch/touch-run.mjs`. **Artifacts:** `reports/w1-touch/*.json` (gitignored;
every number below is reproducible from the commands in §7).
**Load:** every timing figure is taken on a box shared with the rest of the fleet;
`node tools/contention.mjs --gate` returned GO at the start of each run and each run's `loadavg`
is stamped in its own artifact.

---

## 0. The dispatch's premise is stale, and this is the first thing to say

> *"`game/src/input/touch.js` is 314 lines of carefully designed touch input and
> `game/src/main.js` never imports it. Grep `main.js` for "touch" and you get nothing."*

Both sentences are true. The conclusion drawn from them is not.

`main.js` does not import `touch.js` and never needed to. The chain is:

```
game/src/main.js         imports Engine
game/src/engine.js:57    imports RealInput
game/src/input/real.js:19  import { TouchInput } from './touch.js'
game/src/input/real.js:73  this.touch = new TouchInput(pipe, canvas, this.profiles)
game/src/input/real.js:405 applyDeviceClass('handheld') -> touch.enabled = true; touch.attach()
game/src/sim/step.js:69  -> real.js:466 -> touch.tick(frame)     — inside the FIXED STEP
```

`git log -S "import { TouchInput }" -- game/src/input/real.js` dates that import to `6eb8f04`.
Grepping the entry point for a subsystem's name proves nothing about whether the subsystem is
wired; a two-hop import chain is the normal shape of every other subsystem in this build.

**Measured, not argued.** A Playwright context at 844×390, `deviceScaleFactor: 3`, `hasTouch`,
`isMobile`, `navigator.webdriver` forced false, loading `game/index.html` with **no query string
at all**:

| what | value |
|---|---|
| `__ENGINE.mode` | `play` |
| `location.search` | `""` |
| `getViewport().deviceClass` | `handheld` (from `(pointer: coarse)` + `(hover: none)`, never a UA string) |
| `touchState().shown` | `true` |
| controls laid out | 11 (10 direct + the drawer) |
| `insetViolations` | 0 |

and a real CDP `Input.dispatchTouchEvent` at (200,300) opens a floating stick whose origin is
exactly (200,300). **`docs/play/` is in sync** (`node tools/publish-game.mjs --check` → 710 files
match), so the published copy the owner's phone loads has the same path.

So: **the symptom in the dispatch — "a phone loads it, gets a title screen, and has no controls
at all" — is not reproducible at this commit.** What was genuinely missing is that nobody had
ever put a finger on the glass and *measured*. `RI-JRN04` M-P21 and M-P22 were `unmeasurable`,
which scores 0 fail-closed and looks from outside exactly like the design failure the dispatch
describes. That is now closed, and closing it found two real defects (§4, §5).

---

## 1. The whole opening, on touch alone

`node tools/touch/touch-run.mjs --leg opening` — six viewport profiles, **no query string**, so
`main.js` resolves to `play` the way it resolves for a human, and the sim advances only from
`requestAnimationFrame`. Not one keyboard event is dispatched. Not one `__HARNESS` *mutator* is
called — `touchDown/touchMove/touchUp` exist on the harness and are deliberately **not used**,
because they bypass the listener, the hit test's coordinate space and the browser's own pointer
bookkeeping, which is three of the four things that can be broken about a touch control.

Every leg is: land a finger, drag it, lift it, via `Input.dispatchTouchEvent`.

| beat | how it is done on touch |
|---|---|
| title | the **floating stick** moves the selection (`render/title.js step()` reads `input.moveY`); one flick down moves `new → settings`, one flick up returns |
| commit `New` | a tap on the `interact` control in the arc |
| walk to Jeeh-Ei | the stick, camera-relative, pushed toward her — the same projection `sim/player.js` composes (`dir = right·moveX + forward·moveY`) |
| talk | a tap on `interact` |
| **a name** | see §2 |
| out of the hold, to the desk | the stick again, then taps on `interact` |

Results are in `reports/w1-touch/touch-run-opening.json`, check ids `T-TITLE/…`, `T-WALK/…`,
`T-TALK/…`, `T-NAME/…`, `T-OPEN/…`, one set per profile.

**What was actually measured, and what was not (RULES 26).** The reference phone (844×390 @3×)
completed the whole opening, all six checks green, and its three screenshots are committed:

```
PASS T-TITLE  one flick down moved 'new' -> 'settings', one flick up returned; committed by a tap
PASS T-WALK   walked 4.8 m to Jeeh-Ei on the floating stick alone, final distance 0.7 m
PASS T-TALK   a tap on 'interact' beside her opened the scene at 'hold.hatch-name'
PASS T8-OVERLAP  0 of 2 drawn controls touch the dialogue panel (see §7)
PASS T-NAME   hatchName = "Counts-The-Drowned", the third row, picked on the stick
PASS T-OPEN   title -> New -> 4.8 m -> talked -> a name -> out of the hold -> 'writ.sex'
```

The **small phone (667×375)** and the **large phone (932×430)** also ran to the desk — their
`01-in-the-hold`, `02-the-scene` and `03-the-desk` screenshots are in `docs/shots/`. The
**tablet (1180×820)** reached the conversation and the **two portrait profiles had not started**
when this round ended: the box went to **4.2 load per core against a 4.0 ceiling** with five
other agents' browsers on it, and the rAF-driven walk legs crawl under that. So:

> **The six-profile claim in this section's heading is the instrument's coverage, not this
> round's evidence. Three landscape phone profiles completed; the tablet and both portrait
> profiles are UNMEASURED.** Re-run `node tools/touch/touch-run.mjs --leg opening` on a quiet
> box. Nothing in §2–§9 depends on them.

**Portrait** is measured as its own thing, not skipped: held in portrait a handheld device gets
`Viewport.rotateState()` — *"The map lies the long way."* — and the check requires that it appears,
that a **real** `setViewportSize` rotation clears it with no reload, and that the controls relay
out with 0 inset violations. Then the opening is played in the landscape it recovered into.

---

## 2. RULING R1 — what touch does for name entry

**Decided, not asked (RULES 0). Reversible.**

> **Touch reuses the pad's answer unchanged: a name is picked from a ledger. There is no
> touch-specific code at all, and no on-screen keyboard.**

`character/scene.js _nameOptions()` already turns every text node (`hold.hatch-name`,
`writ.given-name`, `writ.class-custom-name`) into a pick list, and `CensusSurface.step(input)`
moves the caret on `input.moveY` and commits on `pressedName('interact')`. Both are
**device-neutral action-layer reads**. The touch stick writes `moveY` through `pipe.setMove()` and
the arc's `interact` button writes the edge — so the ledger is reachable on touch with zero new
code, and the semantics a player learns on a pad transfer exactly, which is T5's argument applied
to a menu. A full-screen keyboard panel is forbidden by `RI-JRN01` O8, and on a landscape phone
an OS keyboard would additionally cover the entire lower half of the screen — which is where the
controls are.

**Made measurable rather than asserted:** the check moves the caret **two rows down on the stick
first**, records which name that lands on, and only then taps `interact`. A ledger that did not
commit would stall at `hold.hatch-name` forever and `T-NAME` would go red. It committed:
`hatchName = "Counts-The-Drowned"` — the third row, not the default highlight.

**Reversible if** play-testing shows players want a name the ledger does not carry. The owed thing
would then be an **inline** (never full-screen) character wheel driven by the same
`moveY`/`interact` pair — not an OS keyboard.

---

## 3. T1 — all sixteen actions, counted rather than asserted

`--leg reach`. Every control is tapped with a real finger at the centre `TouchInput.layout()`
reports, and the action that fires is read out of `InputPipeline.edges` — **counted from what the
pipeline received**, not inferred from the profile.

| | |
|---|---|
| direct controls | 10 — `roll block light interact jump parry heavy use_item crouch lock_on` |
| behind the ONE drawer | 5 — `two_hand swap_left swap_right spell_cycle menu` |
| the sixteenth | `sprint`, from the `roll` control **held past the 12-frame gate** |
| **total reached** | **16 / 16** |
| drawer | opened on the first tap, closed on the second, both by real touch |

**T9 on the way past:** stick + camera drag + two buttons dispatched *simultaneously* →
`touchState()` reports `pointers: 4`, roles `stick + camera + button + button`, `held: block,
light`. RI-JRN04 "How we lose" #12 — the "one active pointer" handler — is not present.

*Instrument note (RULES 4):* the first run of this leg reported **0/16**. `InputPipeline.edges`
is a ring that truncates itself at 64 entries inside `latchForStep`, so slicing it by a
remembered index silently loses edges, and the record's field is `e.button`, not `e.action`. The
leg now clears the log and reads it whole. A probe that reports 0 because it is reading the wrong
field is indistinguishable from a build with no touch input at all.

---

## 4. T2 — the stick floats, and here is what it costs when it does not

`--leg float`. Three drags from three deliberately distant origins, each the **same finger
displacement** (0.8 × 90 px straight forward), each from a freshly reloaded `arena_flat`, each
held 60 fixed frames. What is compared is the **resulting walk**, not the stick numbers — a stick
that reports correctly and moves nothing is the defect.

| thumb landed at | stick origin reported | walked |
|---|---|---|
| (90, 300) | (90, 300) | 3.200 m |
| (300, 200) | (300, 200) | 3.200 m |
| (60, 70) | (60, 70) | 3.200 m |

Spread **0.00 %**.

**Delete-the-fix** (`--break-fixed-stick` pins the origin to a fixed rosette at (120, 270), which
is what a pre-§G build has):

| thumb landed at | stick origin | stick y | walked |
|---|---|---|---|
| (90, 300) | (120, 270) | 0.467 | 2.000 m |
| (300, 200) | (120, 270) | 0.619 | 3.200 m |
| (60, 70) | (120, 270) | 0.977 | 3.200 m |

Spread **37.5 %** — the same finger movement means three different things depending on where the
thumb happened to land. That is the number T2 exists to prevent, and it is what a fixed rosette
costs.

---

## 5. Walk speed against thumb distance — and the double deadzone

`--leg curve`. Fourteen deflections, each held 90 fixed frames, distance sampled at **30, 60 and
90** (RULES 8: one instant is a still target in time — a body that lurches once and stops must not
pass as one that walks). `move|v|` is `engine.input.moveX/moveY`, the vector `combat/player.js`
actually reads.

| deflection | thumb travel | `move` \|v\| | m/s | 30f / 60f / 90f |
|---|---|---|---|---|
| 0.05 | 5 px | 0.000 | 0.000 | 0.000 / 0.000 / 0.000 |
| 0.10 | 9 px | 0.000 | 0.000 | 0.000 / 0.000 / 0.000 |
| 0.14 | 13 px | 0.000 | 0.000 | 0.000 / 0.000 / 0.000 |
| **0.16** | 14 px | 0.013 | **0.047** | 0.024 / 0.047 / 0.071 |
| 0.20 | 18 px | 0.065 | 0.236 | 0.118 / 0.236 / 0.354 |
| 0.25 | 23 px | 0.130 | 0.472 | 0.236 / 0.472 / 0.708 |
| 0.30 | 27 px | 0.195 | 0.708 | 0.354 / 0.708 / 1.063 |
| 0.40 | 36 px | 0.325 | 1.181 | 0.590 / 1.181 / 1.771 |
| 0.50 | 45 px | 0.455 | 1.653 | 0.826 / 1.653 / 2.479 |
| 0.55 | 50 px | 0.519 | 1.889 | 0.945 / 1.889 / 2.834 |
| 0.60 | 54 px | 0.584 | **3.200** | 1.600 / 3.200 / 4.800 |
| 0.70 | 63 px | 0.714 | 3.200 | 1.600 / 3.200 / 4.800 |
| 0.85 | 77 px | 0.909 | 3.200 | 1.600 / 3.200 / 4.800 |
| 1.00 | 90 px | 1.000 | 3.200 | 1.600 / 3.200 / 4.800 |

Two things worth reading off this. The response is **linear and graded from 0.16 to 0.55** — a
touch stick is analogue and this one behaves like one. The step at **0.55 → 0.60** is the
`walk_run_threshold` in `profiles.json §analog.left_stick`: it is a **gait change, not a
discontinuity in the curve**, and it is the same boundary the pad has.

### Does W1-GAMEPAD's deadzone fix cover the touch path? Yes — and here is the control.

W1-GAMEPAD F4 found `locomotion.move_deadzone: 0.15` applied a **second** time to a magnitude
`shapeMoveStick()` had already deadzoned and rescaled, killing 15 % of live stick range, and set
it to 0. Its note says touch "pre-shapes exactly as the pad does", so touch should be covered —
but that is an argument, not a measurement.

Restoring `move_deadzone = 0.15` on the live object and re-sweeping:

| deflection | shipped | `move_deadzone` restored to 0.15 |
|---|---|---|
| 0.16 | 0.047 m/s | **0.000** |
| 0.20 | 0.236 m/s | **0.000** |
| 0.25 | 0.472 m/s | **0.000** |
| 0.30 | 0.708 m/s | 0.708 m/s |

**First live deflection: 0.16 shipped, 0.30 with the second deadzone back.** The exact boundary
predicted by double application is `0.15 + 0.15·(0.92−0.15) = 0.2655`, which is the number
W1-GAMEPAD measured on the pad (0.27) — the same defect, on the same rescaled magnitude, reached
through a finger instead of a thumbstick. **The fix covers touch, and it is now measured on the
touch path rather than inferred from a shared code comment.**

*Instrument note (RULES 6, INERT CONTROL).* The first run of this arm produced **two
byte-identical sweeps**. `loadState()` rebuilds `engine.combat.d` from the data, so a deadzone
written once before the sweep was silently reverted by the first row — the teardown did nothing
and both arms were the positive arm. The check called it (*"either touch never reached that
branch, or the control is inert — either way the number above is not evidence"*) rather than
publishing a null result. The deadzone is now written **after every load** and **read back**, and
the readback is in the artifact.

---

## 6. T5 — the roll/sprint discriminator is the pad's, and now it is literally the pad's

`--leg gate`. Both paths driven **in one page**: the touch arm is a real finger on the `roll`
control, the pad arm is `__HARNESS.gamepad({buttons:[0,1]})` polled once per fixed step, which is
the ratio a physical pad gets at 60 Hz.

| frames held | 4 | 8 | 11 | **12** | 13 | 20 |
|---|---|---|---|---|---|---|
| **touch** | roll | roll | roll | **sprint** | sprint | sprint |
| **pad** | roll | roll | roll | **sprint** | sprint | sprint |

Identical at every point, and the boundary is where §C puts it.

### The change: there were two implementations, and now there is one

RULES 10. `input/gamepad.js _applyButtons` and `input/touch.js tick` each computed
`(frame - pressFrame + 1) >= (gate.frames || 12)` for themselves. Two copies of one rule, and the
off-by-one that arithmetic carries — *frames held, press frame inclusive*, so 12 is a sprint and
11 is a roll — is exactly the kind that gets fixed on one path and not the other. It **was** fixed
on the pad path, by the pad round, and nothing would have made touch follow.

Extracted to **`game/src/input/hold-gate.js`** (`shouldPromote()`, `framesHeld()`,
`holdGateFrames()`, `DEFAULT_HOLD_GATE_FRAMES = 12`). Both callers keep their own state machines
— a pad gate is keyed by button index inside a per-pad record, a touch gate by action inside a
Map, and those differ because the devices do — but the **rule** is one function.

**Proved, two ways, and the two teardowns are deliberately different in kind:**

* `--serve-patched` copies `game/` to a scratch tree, changes **one line of `hold-gate.js`**
  (`>= holdGateFrames(gate)` → `>= 1`), serves that, and re-runs. **Both arms go red together**:
  touch boundary 4 f, pad boundary 4 f. A shared *rule*.
* `--break-gate` perturbs the **data** instead (`touch.buttons.0.hold_gate.frames: 12 → 1`).
  **Only the touch arm goes red** (touch boundary 4 f, pad still 12 f). Separate *rows*.

One code change breaks both; one data change breaks one. That is what "one implementation, two
profiles" looks like from outside, and it is not something the passing table in §6 could tell you
on its own.

---

## 7. THE DEFECT THIS ROUND FOUND: T8's second clause was never enforced

T8 has two clauses. *"Touch controls never occupy safe-area insets (H3)* **and never overlap the
dialogue or journal surfaces**.*"* `ui/system.js` carried a comment saying *"T8 is upheld by
construction — the layout is measured from the safe area, so the controls cannot enter an inset"*.
That is true of the first clause. The second was unenforced, and violated.

`render/ui.js` lays the dialogue panel out at **80 % of the frame width**, bottom-anchored. The
touch arc is drawn **after** the screens and outside `beginScreen()` — correct for the inventory,
wrong for a surface you are meant to read. Measured at 844×390 with `hold.hatch-name` open:

> **7 of the 11 drawn controls sat on the dialogue panel's rectangle** — `roll, block, light,
> jump, parry, heavy, crouch` — covering the **right-hand column of the name ledger**. A player
> choosing their hatch-name could not read half the names they were choosing between.

Picture: `docs/shots/2026-08-08-w1-touch-before-the-thumb-ring-covered-half-the-name-ledger.png`.

S35 already had the mechanism for the *reading* screens (map, journal, book): reduce the arc,
told to the **input model** and not filtered in the renderer, because `layout()` feeds the hit
test as well as the drawing. A conversation is the mirror case — two of the arc's verbs **are**
live (`interact` commits, `block` un-picks) and the other eight are swallowed — so it needed its
own answer.

### RULING R2 — the fix. Decided, not asked. Reversible.

> **While a talking surface is open (census, conversation, writ reader), the arc reduces to
> exactly the verbs that surface consumes — `interact` and `block` — and the dialogue panel's
> right edge is pulled in to clear whatever is still drawn.**

* `TouchInput.keepOnly` (new) — an array of action names, or null for the whole arc. Set every
  frame by `Engine._touchTalkSuppression()`. The drawer goes with the rest: S35 kept it because a
  player who opens the map and cannot close it is trapped, and **nobody is trapped in a
  conversation** — `interact` ends it, `block` steps back — while the drawer's own centre sits on
  the panel, which is the defect.
* `UILayer.setTouchClearRight(x)` (new) — the panel stops 10 px short of the arc's leftmost
  control, with a floor of 45 % of the frame so a badly-placed arc can shrink the reading surface
  but never collapse it. **Null on every desktop frame**, so a keyboard player's panel geometry is
  byte-identical to what it was before this line existed (and the differential in §8 is the check
  on that claim).

| | overlapping controls | controls drawn | panel right edge |
|---|---|---|---|
| **fixed** | **0** | 2 (`interact`, `block`) | 659 px (68 % of frame) |
| `--break-overlap` (both halves deleted) | **7** — `roll block light jump parry heavy crouch` | 11 | 759 px (80 %) |

Picture after: `docs/shots/2026-08-08-w1-touch-phone-844x390-02-the-scene.png` — every name legible.

The teardown deletes **both halves at once** (`_touchTalkSuppression → null` *and*
`setTouchClearRight → null`), because either alone leaves the other carrying the number — RULES 6's
fourth shape, two guards for one defect.

**Reversible if** a critic finds a talking surface whose verb set is larger than
`['interact','block']` — a shop, a barter screen, anything that wants `use_item` — in which case
the keep-list should come from the surface rather than be a literal in
`Engine._touchTalkSuppression()`. That is the right eventual shape and it is not built, because
nothing in the tree needs it yet.

---

## 8. Nothing added broke the keyboard or the pad

`--leg differential` runs the two existing openings unmodified:

* `node tools/journey/opening-play.mjs` — the keyboard opening, in play mode with no flags.
* `node tools/gamepad/pad-run.mjs --leg opening` — the pad opening.

Both must exit 0. Results in `reports/w1-touch/touch-run-differential.json`, check `T-DIFF`.

**NOT COMPLETED IN THIS ROUND.** The differential was still inside `opening-play.mjs` when the
round ended, on the same 4.2-load box. It is the one acceptance leg with no number against it,
and it should be the first thing a successor runs. What *is* known: `node tools/boot-check.mjs`,
`node tools/check-data.mjs` and `node tools/check-content.mjs` all pass on the changed tree, and
`node tools/world/verify-published-game.mjs` passes — *"docs/play serves a live page from a
subdirectory"*. The argument that the desktop path is untouched is in §7 (`touchClearRightX` is
null on every desktop frame) and it is an **argument, not a measurement**, which is exactly the
distinction this project exists to keep.

---

## 9. The control for the whole thing

`--break-deaf` swallows every `pointerdown`/`pointermove` in the capture phase, so the browser
still delivers the event and `input/touch.js`'s own listener never runs. **Every touch leg goes
red**: the title will not navigate, the walk moves 0 m, the tap does not open the scene. That is
the check on the one claim everything else rests on — that the finger is doing the work.

---

## 10. Reproduction

```bash
node tools/touch/touch-run.mjs --leg all
node tools/touch/touch-run.mjs --leg opening --profile phone-844x390
node tools/touch/touch-run.mjs --leg float  --break-fixed-stick     # T2 must go red
node tools/touch/touch-run.mjs --leg curve                          # publishes both deadzone arms
node tools/touch/touch-run.mjs --leg gate   --serve-patched         # BOTH arms must go red
node tools/touch/touch-run.mjs --leg gate   --break-gate            # only TOUCH may go red
node tools/touch/touch-run.mjs --leg opening --profile phone-844x390 --break-overlap
node tools/touch/touch-run.mjs --leg opening --profile phone-844x390 --break-deaf
```

## 11. What this round did NOT do

See `orchestration/status/W1-TOUCH.json` `not_done`. The short version: **no fight was measured on
touch**, so the question "can a phone play a Souls-shaped fight" is answered only as far as
"every verb a fight needs is reachable and the discriminator is the pad's". That is not the same
claim and it should not be read as one.
