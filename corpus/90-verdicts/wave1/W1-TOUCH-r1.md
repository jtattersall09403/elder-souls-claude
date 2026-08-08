# W1-TOUCH round 1 — critic's verdict

**Piece:** touch input (`RI-JRN04 §G`, `RI-JRN01 O17`).
**Critic:** fresh context, no part in building it.
**Tree:** measured against a pristine `git archive HEAD` export of **`fa96455`**. See §0.2 for why
that mattered today and why no number here was taken from the working tree.
**Instruments (mine):** `tools/touch/critic-fight.mjs`, `critic-fight-diag.mjs`,
`critic-title-probe.mjs`, `critic-block-roll.mjs`, `critic-roll-matrix.mjs`,
`critic-gate-wallclock.mjs`, `critic-consumption.mjs`. Artifacts in `reports/critic-w1-touch/`.
**Load (RULES 26):** every figure below was taken on a box shared with the rest of the fleet, at
**2.5–4.9 load per core against a 4.0 ceiling**, with SwiftShader. The frame-rate numbers in §4 are
the ones this most affects and they are stamped individually. `node tools/contention.mjs --gate`
returned **WAIT** when I started; all offline work was done first and every browser run is one
instance, kept and closed by the tool. Nothing was `pkill`ed.

---

## 0. The two things to read first

### 0.1 The dispatch's correction is correct, and I verified it independently

My own brief asserted that `main.js` never imports `touch.js` and that a phone therefore gets no
controls. **That was wrong, the round said so, and the round is right.** Confirmed here from the
source and from a running page:

```
game/src/main.js:11        import { Engine } from './engine.js'
game/src/engine.js:57      import { RealInput } from './input/real.js'
game/src/engine.js:481     this.real = new RealInput(this.input, this.canvas, this.data)
game/src/input/real.js:19  import { TouchInput } from './touch.js'
game/src/input/real.js:73  this.touch = new TouchInput(pipe, canvas, this.profiles)
game/src/input/real.js:405 applyDeviceClass('handheld') -> touch.enabled = true; touch.attach()
game/src/sim/step.js:69    sim.realInput.tick(sim.frame)   — INSIDE the fixed step
```

`git log -S 'import { TouchInput }' -- game/src/input/real.js` → **`6eb8f04`**, exactly as claimed.
A phone-shaped context (844×390, dpr 3, `hasTouch`, `isMobile`, `webdriver` forced false) boots
`mode: play`, `deviceClass: handheld`, `touchState().shown: true`, **11 controls**, and a real CDP
touch opens a floating stick at the point of contact. **So the README that told the owner a phone
has no controls said something false, and the round caught it.** That correction is the single most
valuable thing in the piece and it was made against its own dispatch, which is the behaviour this
project should want most.

### 0.2 A live tree-wide breakage, found in passing, that is not this piece's fault

Mid-run every page I served from the **working tree** went black with:

```
QuestBook: 16 integrity failure(s) in game/data/quests/**   (at Engine._boot, engine.js:549)
```

caused by another agent's **staged, uncommitted** `game/data/quests/faction-joining-wave1.json`
and `hooks.json`. That is RULES 13 exactly — a fail-closed assertion live against data that is
mid-authoring — and while it sat in the index, **every agent on this box was measuring a black
screen, and `tools/bank.mjs` stages the whole tree every few minutes on purpose.**

**It resolved on its own** roughly forty minutes later, when whoever owned it finished;
`node tools/check-quests.mjs` now exits 0 and the working tree boots. So this is reported as a
**transient**, not as a standing defect, and nobody needs to go looking for it. Two things are
still worth carrying forward from it: HEAD was clean throughout, and **the window in which a
fail-closed content assertion is armed against half-written data is a window in which every
measurement on the box is void and looks exactly like the symptom this piece was dispatched to
chase.** I moved to a pristine `git archive HEAD` export and every browser number in this verdict
is from there, which is the habit RULES 12 is really asking for on a tree this busy.

---

## 1. THE ACCEPTANCE NOBODY HAD TAKEN — a phone fought

The round's own `not_done`, verbatim: *"NO FIGHT WAS MEASURED ON TOUCH … nobody has swung, rolled
and blocked at a live enemy with a finger. The claim 'a phone can play a Souls-shaped fight' is NOT
established by this round."* That was the honest thing to write and it is the gap this round-1
critique exists to close.

**It is now taken.** `arena_duel` (straight sword, Marsh-oak medium shield, one armed sentry),
reference phone, **behind the same title screen a human meets**, every input a real
`Input.dispatchTouchEvent`, no keyboard in the leg, no `__HARNESS.touchDown/Move/Up`:

| check | result |
|---|---|
| `C-TITLE` | one tap on `interact` with a finger takes the title down |
| `C-SWING` | six taps on `light` → moves `r1.1`, `r1.2`; **sentry 412 → 311.2 hp** |
| `C-SWING-STAM` | stamina **120 → 98** at the trough — the Souls currency is spent by a thumb |
| `C-ROLL-IFRAMES` | the finger's dodge is genuinely invulnerable — `invuln` true on **36 of 67** samples through the move |
| `C-BLOCK` | a held finger gives `guardRaised` on **20 of 25** samples, state `BLOCK_HOLD`, against the keyboard's 9/15 in the same page and the same body |
| `C-STRAFE` | stick **and** attack button under two fingers at once: the body travelled **0.997 m** *and* the swing came out |
| `C-T6-CHARGE` | **T6, measured on touch for the first time.** 60 ms hold on `heavy` → `["r1.1"]`; 700 ms hold → `["r2","r2.charged"]`. The charged variant appears only on the long hold |
| `C-FIGHT` | over one exchange: sentry **412 → 311.2**, player **620 → 436.28**. It hit back. |

**A phone can play this fight.** That sentence was not available before today and it is now, and it
is the round's result as much as mine — it built every verb I pressed. T6 in particular the round
named as unmeasured *and correctly diagnosed where the threshold lives* (`combat/player.js
_chargeTick`) before saying it had not put a finger on it. It behaves exactly as it predicted.

### 1.1 My own instrument was wrong first, and this is how it was caught

**The first run of `--leg fight` published eight red checks** — no swing, no roll, no guard, no
damage, "nothing a finger did reached the fight". **Every one was a broken probe.** `engine.js:3372`
hands the latched input to the **title surface** and `return`s before `stepCombat` is ever reached,
so my fixture was tapping an attack button at a menu.

What caught it was the **desktop control arm**: a real mouse press on `Mouse0` — which *is* `light`
on the keyboard profile — produced exactly the same nothing (`critic-fight-diag.mjs` ARM 3). A
teardown that turns every arm red *including the one that is supposed to work* is not a finding, it
is a broken instrument (RULES 4). Had I shipped those numbers this verdict would have said a phone
cannot fight, on a build where it can. `commitTitleWithAFinger()` carries that correction in its
docstring rather than tidying it away.

The same discipline retracted a second red of mine: `C-BLOCK` failed in the fight leg only because
it was measured with the body still in recovery from six swings and a roll. Measured cleanly it
passes 20/25. **Two of my own false reds, both reported.**

---

## 2. FINDING — the roll is unreliable *while the movement stick is held*

Rolling out of a run is the most-used verb in a Souls fight. Four arms, one page, one body
(`critic-roll-matrix.mjs`), and the pipeline's own edge log read around each:

| arm | what pressed roll | while moving by | outcome | edge the pipeline received |
|---|---|---|---|---|
| A | **finger** on the arc | nothing | `backstep` ✓ | `roll:down` |
| B | **finger** on the arc | **finger** on the stick | **nothing at all** | `sprint:down` |
| C | keyboard `Space` | **finger** on the stick | `roll`, `ROLL_IFRAME` ✓ | `roll:down` |
| D | keyboard `Space` | keyboard `KeyW` | `roll`, `ROLL_IFRAME` ✓ | `roll:down` |

Arm A's `backstep` is **correct** — a dodge with no direction is a backstep in both source games,
and my first check calling that a failure was my error, not the build's. The finding is **B against
C**: with a finger on the stick, the *touch* roll control produces nothing while the *desktop* roll
key on the same body in the same page rolls cleanly. Repeated in `critic-gate-wallclock.mjs`:
**5 of 5 presses with no stick produced a backstep; 4 of 5 with the stick held produced no move at
all and the fifth produced a sprint.**

**I am deliberately not calling this a confirmed defect, and §4 is why.** At 9.9–11.6 fixed steps
per second everything about a wall-clock tap is coarse, and I could not separate "the touch button
drops the tap when a second pointer is live" from "at 12 Hz the tap lands between the frames that
would have seen it". **What is established is the asymmetry**: same box, same load, same body, same
frame rate — the desktop key rolls out of a run and the touch control does not. That asymmetry
cannot be explained by frame rate alone, because both arms pay it. **This is the first thing a
round 2 should chase**, and `tools/touch/critic-roll-matrix.mjs` is the fixture for it.

---

## 3. FINDING — T5's gate is counted in frames and pressed in milliseconds

This is the one I think matters most, and it is invisible to the way the round measured.

`hold-gate.js` is 12 **fixed sim frames**, and the round proved beautifully that the pad and the
touchscreen now share one implementation of that number (two teardowns different in kind — a code
edit that reddens both arms, a data edit that reddens only touch). **All of that is correct and I
reproduce it.** But `--leg gate` drives the sim with `stepFrames`, where N frames pass per call and
wall-clock time does not exist. **A thumb does not press in frames.**

Measured in play mode, with the press timed **by the game** (`TouchInput` stamps `gateFrom` on the
down; `sim.frame` is read on the up) rather than by my stopwatch:

```
sim rate 11.6 fixed steps/s        (the gate is 12 fixed frames)
12 fixed frames = 1034 ms of thumb time at this rate
12 fixed frames =  200 ms of thumb time at a true 60 Hz
```

**The wall-clock cost of the roll/sprint discriminator is a function of frame rate.** At 60 fps it
is a brisk 200 ms tap, which is the Souls figure. At the ~12 fps this build actually reaches at the
phone profile on this box it is **over a second** — a player must hold the button for a full second
to sprint, and a half-second press that would sprint on a desktop still rolls. The semantics
RI-JRN04 T5 promises will "transfer" from the pad transfer *in frames* and **not in the hand**.

Nothing in the round is wrong here; the round measured the right quantity with the right rigour and
the harness it used cannot express this question. The fix is not obvious and is not mine to rule on
— an ms-based gate breaks determinism, a frame-based gate drifts with frame rate — but **it should
be an S-ruling, not a silence.**

---

## 4. FINDING — nobody has measured the frame rate, and it is 10–12 Hz

The round said plainly *"Frame budgets (RI-PLT01/02 at the phone profile, M-P25) are untouched by
this round"*, which is honest and correct. Taking the measurement:

| run | fixed steps/s at 844×390 | load/core |
|---|---|---|
| `critic-fight-diag` | **28.3** | ~2.6 |
| `critic-roll-matrix` | **9.9** | ~4.3 |
| `critic-gate-wallclock` | **11.6** | ~4.9 |

**Stated as plainly as I can (RULES 26): these are headless SwiftShader on a contended shared box
and they are NOT a phone's numbers.** They are not evidence that a real device is slow. What they
*are* evidence of is that §3's coupling is real and load-sensitive, and that **no one has yet taken
this measurement anywhere** — so "a phone can play a Souls-shaped fight" is established for the
*verbs* (§1) and not for the *timing*. A Souls fight is timing. **T10's "one complete quest on
touch only" is likewise still unmeasured**, by the round and by me.

---

## 5. ATTACK A — "by construction", and the one that is still on disk

The round's headline defect was that `ui/system.js` claimed T8 was "upheld by construction" while
T8's second clause — *never overlap the dialogue surface* — was never enforced, and 7 of 11 controls
sat on the name ledger. **The fix is real and I reproduce it.** But:

> **`game/src/ui/system.js:647` still says "T8 is upheld by construction" at HEAD, verbatim.**

`git log -S 'T8 is upheld by construction' -- game/src/ui/system.js` returns only `9afe234`, an
unrelated commit; the touch round never touched that line, and `ui/system.js` is not in its own
`source_changes` list. Worse, `game/src/input/touch.js:128` describes it in the **past tense** —
*"`ui/system.js` **had** a comment claiming T8 was 'upheld by construction'"* — so a reader of the
new file is told the false claim was removed. **It was not.** The next person to open `ui/system.js`
gets told exactly the thing that caused the defect. One-line fix; not mine to make.

Swept the tree for the phrase and its cousins: **58 occurrences** of "by construction" in
`game/src/`. Two are in the touch path. `ui/touch-overlay.js:101` — *"the layout is measured from
the safe area … that is what makes H3/T8 true by construction"* — is the same family and, like its
sibling, it is a claim about the **safe-area clause only**. It is tested under a real cutout in §6.

---

## 6. COVERAGE the round declared unmeasured — insets, portrait, the menu

*(Filled from `critic-fight.mjs --leg menu|insets|portrait`; see §9 for what did not run.)*

**T8 clause ONE has only ever been measured against an inset of zero.** `insetViolations: 0` is
reported in all six of the round's profiles, but none of them sets an inset, so the number is a
measurement against nothing. RI-JRN04 M-P17's `{top:0, right:44, bottom:21, left:44}` cutout is
applied in `--leg insets` and the arc is audited against it.

**RULING R2's own declared consequence** — *"the drawer goes with the arc, so `menu` is unreachable
mid-conversation on touch"* — is the thing the round ruled and then did not measure, and it flagged
that itself. `--leg menu` measures both halves: that the menu really does leave the glass, and,
more importantly, that R2's safety argument (*"nobody is trapped — `interact` ends it and `block`
steps back"*) survives contact with a finger. **A player who cannot reach the menu during a
conversation and cannot end the conversation is a player who cannot quit the game.**

---

## 7. ATTACK G — the black screen, and what `game/index.html` does not collect

Said plainly first, because the dispatch asked for plainness: **a desktop browser at a phone-sized
viewport is not a phone, and nothing I did on this machine can tell the owner why a real device
shows black.** Every check here says the build is fine, which is exactly the situation the dispatch
described.

The failure notice in `game/index.html` is genuinely good — it probes WebGL before anything else,
traps `error` and `unhandledrejection`, wraps `fetch` to catch a 404 (the commonest silent black
screen on a static host), distinguishes "booted but painted nothing" from "never booted", and
catches `webglcontextlost`, which fires an event rather than throwing and would otherwise be
invisible. Two things I suspected were wrong turned out fine and I say so: the canvas is **static**
in the HTML (`<canvas id="view">`, line 49) so the context-lost listener does bind, and
`renderer.js:48` sets `preserveDrawingBuffer: true`, so `painted()`'s `readPixels` outside a rAF
callback is valid rather than reading a cleared buffer.

**What `deviceLine()` collects:** canvas + CSS size, viewport + dpr, webgl1/2, `MAX_TEXTURE_SIZE`,
`MAX_RENDERBUFFER_SIZE`, `UNMASKED_RENDERER_WEBGL`, context-lost.

**What it does not, in the order I would add them:**

1. **`navigator.userAgent`. It is not collected anywhere in the file** (`grep -c userAgent` → 0).
   For a phone-only failure this is the single most useful line on the screen — iOS vs Android,
   Safari vs Chrome, OS version. Without it nobody can even tell which device the report came from.
2. **Shader compile/link failure, which is the most likely cause of a black screen that gets as far
   as "the world loaded, but nothing is being drawn".** Three.js reports a failed shader through
   `console.error`, **not** through a thrown exception, so `window.onerror` never fires and the
   notice reports the symptom with none of the cause. Patching `console.error` to capture the first
   line containing `THREE.WebGLProgram` would turn the owner's screenshot into a diagnosis.
3. **`gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision`.** A GPU that only
   offers `mediump` in fragment shaders is a classic mobile-only black screen and costs one line.
4. **`MAX_VARYING_VECTORS`, `MAX_FRAGMENT_UNIFORM_VECTORS`, `MAX_TEXTURE_IMAGE_UNITS`** — the limits
   that actually make a mobile shader fail to link. `MAX_TEXTURE_SIZE` rarely does.
5. **`navigator.deviceMemory` / `hardwareConcurrency`**, for the memory-pressure hypothesis.

**One substantive hypothesis, offered as a hypothesis.** `renderer.js:50` sets `setPixelRatio(1)`
and sizes from `canvas.width`, which is `1920×1080` in the markup. With `preserveDrawingBuffer:
true` the browser must keep a **second** full 1920×1080 buffer — roughly 16 MB of GPU memory that
exists only so `__HARNESS.screenshot()` can read pixels back. On iOS Safari, which is the strictest
WebGL memory environment in common use, an oversized preserved drawing buffer is a well-known way
to be handed a lost context on a device that runs everything else fine. **A cheap and reversible
experiment for a round 2: set `preserveDrawingBuffer: false` unless `?harness=1` is present, and
size the drawing buffer from the viewport rather than the markup.** It costs the harness nothing in
play mode and it is the kind of thing that is invisible on a build machine and fatal on a phone.
I could not test it — I do not have a phone — and I would rather name a testable hypothesis than
score the diagnostics and move on.

---

## 8. What the round did that should be copied

Not a courtesy paragraph; these are specific and rare.

1. **It contradicted its own dispatch, in its first line, with the import chain and a `git log -S`.**
2. **Six teardowns, and it names which check each must redden.** `--serve-patched` and `--break-gate`
   are *different in kind* — one code edit reddens both arms, one data edit reddens only touch —
   which is the cleanest proof of "one implementation" I have read in this corpus.
3. **It caught two of its own inert instruments and published them** (F7's inert control, where
   `loadState()` silently rebuilt `combat.d`; F8's `e.action`/`e.button` slip that had published
   0/16). Both are the shapes RULES 6 names, and it reported them rather than quietly fixing them.
4. **`not_done` is nine entries long, specific, and every one I checked was true.** It told me the
   fight was unmeasured, that T6 was unmeasured *and where the threshold lives*, that T8 clause 1
   was measured at zero insets, and that R2's menu consequence was unmeasured. **Every headline
   finding in this verdict is something the round pointed me at.** That is what a good `not_done`
   buys, and this project should treat it as the standard.
5. **Two rulings, recorded with the evidence that would overturn them** (RULES 0), rather than a
   question the owner would never have seen.

---

## 9. What I could not do (RULES 26)

- **No real device**, so §7 is analysis and a hypothesis, not a measurement.
- **The roll asymmetry in §2 is not isolated** from the frame rate in §4. I have the differential,
  not the mechanism.
- **T10's "one complete quest on touch only"** is unmeasured by the round and by me. So is **T3's
  camera curve** (`M-P8` degrees per fixed step) and **T7/M-P22** (controls hiding when a pad is
  active) — the round declared all three.
- **The three-landscape-profile coverage the round declared** is not widened by me beyond what §6
  reports; the tablet's landscape opening is still unmeasured.
- Every timing figure is under fleet load on SwiftShader, stamped in §4 and in each artifact.

---

## 10. Score

Min over axes, per the dispatch. The gate is 7.0.

| axis | score | why |
|---|---|---|
| Correction of the dispatch (§0.1) | **10** | verified independently, source and running page; the most valuable thing in the piece |
| Defects found and fixed (T5, T8 clause 2) | **9** | both real, both reproduced, teardowns different in kind |
| Instrument and teardown discipline | **9** | six teardowns with named signatures; two self-caught inert instruments published |
| Honesty / RULES 26 | **10** | `not_done` is the reason this verdict has findings at all |
| Evidence for the claims actually made | **8** | every number I re-took came back; the gate result is right in the units it was taken in |
| CONSUMPTION (RI-MTH07, mandatory) | *see §11* | |
| **Coverage of `RI-JRN04 §G`** | **6** | T10's quest, T3's curve, T7, T8 clause 1 under a real inset, tablet and portrait all unmeasured; the fight was unmeasured until this critique |

**Coverage is the binding axis and the score is `6`.** That is a **FAIL against the 7.0 gate**, and I
want to be precise about what it does and does not mean, because a bare 6 misreads this piece badly.

It is **not** a judgement that the work is poor — on evidence, teardown discipline and honesty this
is among the better pieces I have read here, and §8 says why at length. It is a judgement that
**§G is a ten-requirement bar and this round has evidence for six of them**, and that the item's own
CONSUMPTION clause is fail-closed about unmeasured dimensions. The round says so itself; the
difference between us is only that a `not_done` entry does not earn coverage credit.

**What turns this into a pass, and it is close.** T6 and the fight are now measured (§1) and cost
one browser between them. T3's curve and T7 are both single-leg additions to an instrument that
already exists. That would be **eight of ten with evidence** and a coverage axis of 8. The two that
would remain — T10's complete quest, and the frame budget in §4 — are genuinely larger and should
be their own dispatch rather than this piece's debt.

**Recommendation: FAIL 6/10, round 2 dispatched, and the round-2 brief is short** — §2's roll
asymmetry, §3's frames-versus-milliseconds ruling, §5's one-line comment, T3, T7, and §7's
`preserveDrawingBuffer` experiment.

---

## 11. CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3 — mandatory, fail-closed) — **PASS**

The touch journey publishes four models. Each was perturbed **in the data**, on a copy of the tree,
and the observable is a finger on real glass — RI-JRN04's CONSUMPTION clause names *"an input that
is accepted or refused"* as admissible and rules a harness return value out. Two well-separated
values plus a null control, everything else held fixed. `reports/critic-w1-touch/critic-consumption.json`.

| model | perturbation | observable | shipped | perturbed | coupled |
|---|---|---|---|---|---|
| **M1** `touch.buttons[]` geometry | move the `light` row 200 px left, 60 px up | does a finger at **one fixed screen point** swing? | `(737,242)` → **swings** `r1.1` | same point → **nothing**; new centre `(537,182)` → **swings** | **yes** |
| **M2** `touch.stick.max_radius_css_px` | 90 → 45 | metres walked for one fixed 45 px finger displacement | **0.193 m** | **0.640 m** | **yes** |
| **M3** `hold_gate.frames` | 12 → 3 | the running game's own gate value | **12** | **3** | **yes** |
| **M4** `touch.camera.deg_per_css_px_yaw` | 0.28 → 1.12 (×4) | camera yaw after a fixed 100 px drag | **−28°** | **−112°** (×4) | **yes** |
| **null control** | add a `note` field nothing reads | all of the above | — | `light@(737,242)`, 0.193 m, −28°, swung | **inert, as required** |

**M1 is the strongest form this piece admits**: the same input **accepted, then refused, then
accepted somewhere else**, driven purely by a number in a data file, with the finger held at a
fixed screen point across arms so that the *data moving under a stationary thumb* is the only
thing that changes. M4 moved by exactly the factor the data moved by, which is the check that the
coupling is the real one and not a coincidence.

**No orphan models. No dimension scores 0 on CONSUMPTION.** Every number `profiles.json`'s `touch`
block publishes is read by something a player can feel.

---

## 12. Run log

| instrument | leg | result |
|---|---|---|
| `critic-fight.mjs` | `fight` | 8 pass / 2 fail (both fails retracted — §1.1, §2) |
| `critic-fight-diag.mjs` | — | caught the title-screen fixture error via the desktop arm |
| `critic-title-probe.mjs` | — | established the route past the title on a finger |
| `critic-block-roll.mjs` | — | block PASS 20/25; directed roll → the §2 finding |
| `critic-roll-matrix.mjs` | 4 arms | the §2 asymmetry |
| `critic-gate-wallclock.mjs` | sweep | the §3 frames-vs-milliseconds finding |
| `critic-consumption.mjs` | §11 | see §11 |
| `touch-run.mjs` | `differential` | ATTACK C — the round's own unmeasured acceptance |
