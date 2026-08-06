---
id: RI-CMB11
title: Input latency as a combat-correctness property — the four-stage budget, the zero-frame dispatch rule, and edge sampling
kind: number
side: souls
judges: [combat.input.latency]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Every startup number in `corpus/10-combat/` is a promise: *press light attack with a straight sword
and the first active frame arrives 24 frames later* (`RI-CMB02` §A, post-**S22**). If the
implementation quietly inserts three frames between the press and animation frame 1 — an input queue
drained next tick, an animation blend that plays before the clip starts, a state machine that
transitions on the *following* step — then the promise is broken by 12%, **every frame table in the
corpus becomes fiction, and no measurement in the project detects it**, because the trace's
`anim_frame` still counts 1…24 exactly as declared. The lie is in the gap
before frame 1, and nothing was looking there.

That is what makes latency a **correctness** property rather than a comfort property, and it is why
this item lives in the combat area rather than in platform. The bar is:

> **`press → anim_frame == 1` is exactly ZERO additional simulation frames** whenever the character
> is actionable on the frame of the press. Not "about one frame". Not "one frame, it's fine". Zero.

Around that sits a **four-stage budget** with each stage assigned to the instrument that can actually
see it — because `HARNESS.md` §3 is explicit that the real input path is bypassed in harness mode by
design, and an item that claimed to measure end-to-end latency through the harness would be lying
about its own method. Two stages are measurable here, two are measurable only in a real browser
(`RI-JRN03`, `RI-PLT01`), and this item's job is to make sure **nobody assumes the other pair
measured them**.

## The reference artifact

### 1. The four stages

```
        real device                                   the fight                       screen
  ┌───────────────┐   L1    ┌──────────────┐   L2   ┌─────────────┐   L3   ┌────────────┐  L4
  │ key / button  ├────────►│ edge buffer  ├───────►│ sim step N  ├───────►│  startup   ├──────►
  │ physical edge │ transport│ (per frame) │dispatch│ action enter│ frames │ first active│present
  └───────────────┘         └──────────────┘        └─────────────┘        └────────────┘
```

| Stage | What it is | Budget | Measurable by | Owner |
|---|---|---:|---|---|
| **L1 transport** | DOM/Gamepad event → the edge buffer of a fixed step | **≤ 2 f** (p100), **≤ 1 f** (p50) | a real browser only | `RI-JRN03` M-K23, `RI-JRN04` M-P10 — **cited, not duplicated** |
| **L2 dispatch** | edge buffer → the sim step that enters the action state | **exactly 0 f** | **the harness** | **this item, M1–M4** |
| **L3 startup** | action state → first active frame | as declared per move | `RI-CMB02` / `RI-WPN01` | those items |
| **L4 present** | sim state → photons | **≤ 2 f** | a real browser only | `RI-PLT01` |

**Budget: `L1 + L2 + L4 ≤ 4 frames (66.7 ms)`, and `L2 = 0` is not a budget, it is an invariant.**

Total press-to-photon for a straight-sword R1 (24 f startup, `RI-CMB02` §A) is therefore **≤ 28
frames (467 ms)**, of which 24 are the design and 4 are the machine. For the fastest attack in the
game — the dagger's **6 f@60** floor (`RI-CMB02` §E, itself excluded from the S22 rebase as a
wall-clock allowance) — the machine's 4 frames are **40%** of the whole action, which is why `L2 = 0`
is an invariant rather than a budget line.

> **Unit note (S22).** Every frame here is **1/60 s**. Upstream Souls figures are 1/30 s ticks; a
> latency budget quoted in Souls ticks would be twice this. Stating the unit is mandatory
> (`ARBITRATION` S22).

### 2. The zero-frame dispatch rule (L2)

```
Within one fixed step, in this order and no other:
   1. drain the edge buffer accumulated since the previous step
   2. resolve inputs against the current state (buffer / drop / execute — RI-CMB01 C6, RI-CMB09 §2)
   3. enter the new action state and set anim_frame := 1
   4. advance physics, hitboxes, AI
   5. emit the frame record

Therefore: a press whose edge lands in step N's buffer, on a frame where the character is
ACTIONABLE, produces `anim_frame == 1` IN STEP N. Not N+1. The trace's `pressed` array and the
first frame of the animation are the SAME LINE.
```

Four corollaries, all binding and all separately testable:

| # | Rule | Failure it forbids |
|---|---|---|
| **D1** | Input resolution happens **before** state advance within a step. | The classic off-by-one: inputs read after the update, so everything is one frame late, forever, uniformly, invisibly. |
| **D2** | **No animation blend precedes frame 1.** Cross-fades run *on top of* the clip's own frames; the clip's frame 1 is the frame of the press. | A 4-frame blend-in that adds 67 ms to every attack in the game and appears nowhere in any table. |
| **D3** | The buffer (**8 f@60**, `RI-CMB01` C6, deliberately excluded from the S22 rebase) **never adds latency when actionable.** It is consulted only when the character is *not* actionable. | A queue that always defers by a frame "for consistency". |
| **D4** | Exactly one action buffers; a later press overwrites; a press before the window is **dropped, not queued**. | The mash-queue that flushes four rolls on the actionable frame. |

### 3. Edge sampling — the rule that makes a 12 ms tap real

A fixed 60 Hz simulation sampling *button levels* once per step **loses any press shorter than
16.7 ms**, and a competitive tap is routinely 20–40 ms with a 10 ms bounce. Level sampling is
therefore a correctness bug and not a fidelity choice.

| Rule | Value |
|---|---|
| Listeners record **edges** (`down` / `up`) with a timestamp into a per-frame buffer, and **never** write sim state directly | mandatory |
| A press-and-release entirely within one step is delivered as **`press` on that step and `release` on the next** | so it can never be dropped |
| Two edges of the same button in one step | both preserved, in order |
| Analogue sticks | sampled as **levels** (they have no edges), once per step, after the deadzone (`RI-CAM02` owns deadzone shape) |
| **Catch-up steps.** When the accumulator runs `k > 1` steps for one animation frame, edges are attributed to the step matching their timestamp — **not** all dumped on the first | mandatory; cap `k ≤ 5`, then discard the surplus time |
| Buffer overflow | never silently dropped; emit `input_overflow` and fail the run |

**Why the catch-up rule matters more than it looks:** a 100 ms hitch runs 6 steps back to back. If
every edge recorded during the hitch lands on the first of them, a roll and an attack pressed 60 ms
apart execute on the same frame, and the player's input is silently reordered by the machine's
stutter. `RI-PLT03` owns hitches; this rule owns what a hitch is allowed to do to a fight.

### 4. What the harness can and cannot see

`HARNESS.md` §3: *"input latency of the real input path … is bypassed by design"*, and `RI-MTH01`
§ repeats it. This item does not pretend otherwise.

| Property | Instrument | If skipped |
|---|---|---|
| L2 = 0, D1–D4, edge semantics, catch-up attribution | **harness**, M1–M5 here | the corpus's whole frame-data area is unverified |
| L1 transport (DOM → sim) | real browser: `RI-JRN03` **M-K23** (p100 ≤ 2 f, p50 ≤ 1), `RI-JRN04` **M-P10** | assumed, and assumption is how 33 ms hides |
| L4 present (sim → photon) | real browser: `RI-PLT01` | ditto |
| Input *feel* | **nothing.** Not claimable by anyone | `PLAYTHROUGH-CRITIC` §4.7 |

A verdict citing this item **must** state which of L1/L4 it did not measure. Silence is scored as
**unmeasured ⇒ 0** for those stages, never as a pass.

### 5. Data and harness

Requested `HARNESS.md` §10 amendments — small, and every one is a field the tooling already has in
hand:

| Addition | Form |
|---|---|
| `input.edges` in the frame record | `[{"button":"light","edge":"down","recv_step":221,"attributed_step":221}]` |
| `input.dispatch_lag` | integer frames between edge receipt and action entry; **must be 0 when actionable** |
| `input.buffered` | the currently latched action, or `null` |
| `input.catchup_steps` | `k` for this animation frame |
| Events `input_dropped_no_stamina`, `input_dropped_not_actionable`, `input_buffered`, `input_overflow` | added to the §5 vocabulary |

`game/data/combat/input.json` (schema `elder-souls/input@1`) carries the closed button set
(`HARNESS.md` §4), the buffer length, and the catch-up cap, so a static check can read them without a
browser.

## Comparison method

**M1 — The zero-frame dispatch probe (the item's core check).** For each of the 14 buttons, with the
character `ACTIONABLE`: `queueInputs([{f: 0, press: [b]}])`, `stepFrames(1)`, `snapshot()`.
- **FAIL** if `anim_frame != 1` on that very frame; if `player.state` has not changed; or if
  `input.dispatch_lag != 0`.
- Repeat at 200 randomly chosen actionable frames. **FAIL on a single occurrence** — this is a
  p100 check, not a percentile.

**M2 — Declared vs observed startup (the reason the item exists).** For every move in
`game/data/combat/movesets/*.json`: press on an actionable frame, and from the trace measure
`first_active_frame − press_frame`.
- **FAIL** if it differs from the declared `startup` by ≥ 1 frame, for any move.
- **This is the check that catches D2.** A 3-frame blend-in shows up here as every move in the game
  being late by exactly 3, which is also the signature that identifies the bug.

**M3 — No off-by-one (D1).** Compare, over a 3,600-frame trace with 200 scripted inputs, the frame
index in `input.pressed` against the frame index of the corresponding `attack_start` / `roll_start`
event.
- **FAIL** if the mean offset is not exactly 0.0, or if any single offset is non-zero.
- A *uniform* +1 is the most likely defect and the easiest to rationalise; it is a hard fail.

**M4 — Buffer semantics (D3, D4).** During a `LIGHT` roll (52 f, `RI-CMB09` §1):
- press at `f = 36` (outside the 8-frame window, which is f45–f52): **FAIL** if it executes at all.
- press at `f = 49`: **FAIL** unless it executes on `f = 53` exactly.
- press `roll` at 45 then `light` at 48: **FAIL** unless `light` executes and `roll` does not.
- press the same button 6 times during recovery: **FAIL** if more than one action executes.
- While actionable, press with the buffer non-empty: **FAIL** if `dispatch_lag != 0` (D3).

**M5 — Edge sampling and catch-up.** Drive `queueInputs` with a press and release inside the same
step; then force `stepFrames(6)` between renders to simulate a hitch, with edges timestamped across
the interval.
- **FAIL** if the sub-frame press is lost; if `press` and `release` land on the same step; if edges
  are all attributed to the first catch-up step; if `catchup_steps > 5`; or if `input_overflow` ever
  fires without failing the run.

**M6 — Determinism.** Run M1–M5 twice at the same seed. **FAIL** if `body_sha256` differs
(`RI-MTH02`). Latency implemented against a wall clock will not be bit-stable and this is the cheapest
way to see it.

**M7 — The two stages the harness cannot see.** Run `RI-JRN03` M-K23 and `RI-PLT01`'s present-latency
check in a real browser and record their results **in this item's verdict**, attributed to them.
- **FAIL** if L1 p100 > 2 f, if L1 p50 > 1 f, if L4 > 2 f, or if `L1 + L2 + L4 > 4 f`.
- **FAIL the verdict itself** if it reports a total latency figure without having run these.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| **M1** zero-frame dispatch | **26** | `dispatch_lag == 0`, 200/200 |
| **M2** declared vs observed startup | **24** | every move exact |
| M3 no off-by-one | 14 | mean offset exactly 0.0 |
| M4 buffer semantics | 14 | 8 f@60 window, one slot, drops outside |
| M5 edge sampling and catch-up | 12 | sub-frame press survives; hitch does not reorder |
| M6 determinism | 4 | identical `body_sha256` |
| M7 L1/L4 in a real browser | 6 | budget met **and reported** |

- **≥ 90** — the frame tables in this corpus mean what they say.
- **75–89** — playable, gap named.
- **< 75** — **we lose**, and every frame-data item's score is provisional until this is fixed.

**Automatic fail regardless of score:**
- `dispatch_lag != 0` on any actionable frame.
- Any move whose observed startup differs from its declared startup.
- Input read after the state advance within a step (D1).
- An animation blend that delays clip frame 1 (D2).
- Level-sampled buttons (a sub-frame press can be lost).
- A latency figure reported in a verdict without stating which stages were unmeasured.
- Any use of `Date.now()`, `performance.now()` or `deltaTime` on the path from edge to action state
  (`HARNESS.md` D3/D4) — timestamps may be *recorded* on edges for attribution and may never
  *determine* a sim outcome.

## How we lose

1. **The uniform one-frame lie.** Inputs polled after the update. Everything is 16.7 ms late,
   uniformly, so every ratio in the game is preserved, every blind pair passes, every frame table
   still reads 1…12 — and the game feels a little worse than Souls for a reason nobody can name.
   This is S22's failure mode repeated at a smaller scale, and M3 is the only instrument aimed at it.
2. **The blend-in.** `AnimationMixer.crossFadeTo(clip, 0.15)` is the idiomatic Three.js line, it is
   in every tutorial, and it puts 9 frames of blend in front of every attack in the game. The frame
   data remains correct *relative to the clip* and wrong *relative to the press*. M2 catches it and
   nothing else does.
3. **The convenience queue.** An input queue drained at the top of the *next* step, because that is
   how you would write it if you had not read this item. Correct-looking, one frame late, and it also
   breaks D3's promise that the buffer is free when actionable.
4. **Level sampling.** `if (keys.light)` once per step. Fast taps vanish, and they vanish *more* under
   load, so the game gets less responsive exactly when the player is trying hardest.
5. **All the edges land on the first catch-up step.** After any hitch the player's last half-second
   of inputs execute simultaneously and out of order. It reads as the game "eating inputs", it is
   blamed on the network or the machine, and it is a three-line attribution bug.
6. **Latency measured in the harness and reported as end-to-end.** The harness bypasses the real
   input path *by design*. A verdict that reports 0 ms input latency because `queueInputs` is
   instantaneous has measured nothing and said something false, and M7's second failure clause exists
   to fail that verdict rather than the build.
7. **Smoothing on the stick.** An exponential filter on the movement vector "to reduce jitter" adds
   60–100 ms to every direction change, which surfaces as directional rolls going the wrong way — and
   gets diagnosed as a lock-on bug in `RI-CMB06` (which is where it will be filed, and where it will
   not be found).
8. **A frame-rate-coupled input path.** Edges sampled in `requestAnimationFrame` and consumed by a
   fixed-step sim, so on a 144 Hz display the game samples 2.4× more often and behaves differently.
   M6's determinism check is the cheap detector.

## Provenance note

- **`constructed`, confidence high, binding.** The four-stage decomposition, `L2 = 0`, D1–D4, the
  edge-sampling rules, the catch-up attribution rule and every threshold are ours. They are binding
  because they are exactly measurable in a fixed-step simulation, and because the alternative — an
  unstated dispatch cost — silently invalidates every other combat item in the corpus.
- **Cited, not redefined:** the L1 budget of **p100 ≤ 2 frames / p50 ≤ 1** is `RI-JRN03` **M-K23**'s
  and is restated here only as a cross-reference (`RI-JRN04` M-P10 restates the same figure for the
  gamepad path, and `RI-JRN04:190` already labels it a cross-reference). The **8 f@60 (133 ms)** buffer is
  `RI-CMB01` C6's, and it is **explicitly excluded from the S22 rebase** by its owner as a wall-clock
  human-error allowance rather than an animation length; `RI-CMB09` §2 restates its sub-phase
  position within the recovery tail. The closed 14-button set is
  `HARNESS.md` §4. Fixed-step and determinism requirements are `HARNESS.md` R2/R4/D1–D7. The startup
  frame counts M2 diffs against are `RI-CMB02`'s and `RI-WPN01`'s.
- **Declared limitation, not a gap:** L1 and L4 are **structurally unmeasurable through the harness**
  (`HARNESS.md` §3, `RI-MTH01` §"what a critic cannot measure"). This item does not work around that;
  it partitions the budget so that the unmeasurable stages are named, assigned, and reported as
  unmeasured rather than assumed to be zero. `PLAYTHROUGH-CRITIC.md` §4.7 makes the same exclusion for
  "tactile feel", and that exclusion stands: nothing in this item claims to measure how input *feels*.
- **`community-data`, confidence high:** the 30 fps convention for Souls community frame counts
  ([ERR Combat Mechanics](https://err.fandom.com/wiki/Combat_Mechanics), via
  `corpus/10-combat/data/souls-frame-data.json`), which is why §1 states its unit twice. No public
  frame-accurate measurement of FromSoftware's own input pipeline was reached, and none is claimed —
  the budget here is **ours**, not a reconstruction of theirs.
