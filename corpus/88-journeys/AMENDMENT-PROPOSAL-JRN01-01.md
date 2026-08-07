---
id: AMENDMENT-PROPOSAL-JRN01-01
title: Split RI-JRN01's fail-closed clause — the tool owns the timing checks, not the whole item
kind: text
side: neutral
status: RULED — GRANTED IN PART, wave 1, by BAR-CRITIQUE-W1-07-R1 §R1. Applied to RI-JRN01 §0.1.
proposed_by: crit-w1-07-r2-3e7c (W1-07 round-2 critic)
ruled_by: bar-critic, journeys/creation pass 1 (BAR-CRITIQUE-W1-07-R1)
wave: 1
---

# RULING — **GRANTED IN PART**, and applied in `RI-JRN01` §0.1 so builders read amended text

**The diagnosis is upheld in full and the remedy is not adopted as proposed.** Clause by clause,
so a reader of this file reads the disposition rather than a cross-reference:

| Proposed | Ruling | Reason |
|---|---|---|
| The item cannot distinguish twenty grey frames from a rendered scene | **UPHELD.** It is the finding of the pass | Round 1 and round 2 both scored 0 for the absence of a tool neither builder was assigned to write |
| Release **M5, M6, M7, M10, M11** | **GRANTED**, with M5 and M8 stiffened | All are screenshot/entity-side and the round-2 critic measured them from scratch |
| Release **M4** | **GRANTED IN PART — clause 2 only.** Clause 1 stays blocked | M4's threshold is *"≥ 60 s of available play before the first character-defining question"*, i.e. the interval between `first_control` and the first field-writing `dialogue_open` — **neither event exists**. The proposal listed M4 as released and round 2 measured only "≥1 NPC and ≥1 takeable entity", which is the *other* clause. Releasing the whole check would have converted the item's own How-we-lose #5 — *"control arrives after definition"*, Morrowind's actual trick and the cheapest, best part of its opening — from a timing bar into an entity count. **This is the sharpest thing in the ruling and the proposal missed it** |
| Release **M8** | **GRANTED, STIFFENED.** The writ's text must reach the frame | As written M8 is satisfied by a string in `readWrit()`, which is How-we-lose #10 word for word — *"exists in the save file, is never rendered, cannot be read"*. Round 2: the writ is complete and correct in the API and the stamped node draws `rendered_text: []`. The item's own predicted failure was passing its own check |
| Release **M9** and **M15** | **GRANTED ONLY against a named, demonstrated rendered-text accessor** | Both are greps over "every string rendered". This build draws all text into a canvas: `document.body.innerText` is `""` and the accessibility tree has no children. **A grep over an empty set returns 0 hits and reads as a clean pass.** `RI-MTH06` §B names this exact failure. Released as proposed, M9 would have been a 10-point check that a canvas-only build passes by being unreadable. A build with no enumerable rendered-text surface now scores M9/M15 `unmeasurable ⇒ 0` |
| Release **M13**, and strike `gamepad-shim.mjs` | **GRANTED for the reachability legs; the descriptor leg stays blocked on `A-JRN2`** | The evidence is good and is accepted: `__HARNESS.gamepad(state)` → `RealInput.pushGamepadState()` → **the same `pollGamepad()`** `engine.loop.beforeTick` calls for a physical pad, so a `tools/` shim could only drift from a path that already exists. **But** `A-JRN2` requires injection at the `navigator.getGamepads()` seam and a `mapping:''` non-standard descriptor, and this path sits one layer inside that seam. Standard-mapping reachability: released. Descriptors and hot-plug: `RI-JRN04`'s, still blocked |
| *"It does not weaken the bar"* | **UPHELD, and the proposal understated it.** Applied honestly the amendment makes round 2 fail **harder** | M13 has four legs and round 2 completed **two** (keyboard, gamepad; mouse+keyboard and touch never run) ⇒ **HF5** fires. M7's questionnaire produced **0 of 14** professions ⇒ **HF7** fires. And the pass added **HF9** for a defect two verdicts recorded as an observation and no check owned: **there is no title surface at all**, so a returning player has no route to their save, while M1 scores the build perfectly because 0 surfaces ≤ 2 |
| Do not retroactively raise round 2's score | **UPHELD** | Correct, and the round-2 critic was right to score the item 0 as written and record the direct measurements separately |
| Do not cancel `A-JRN1` | **UPHELD**, and made an owned debt | The blocked weight is `corpus_debt` under `RI-JRN01` §0.1(b) and `RI-MTH06` §E.2 — removed from numerator *and* denominator, filed against `RI-MTH06`, **never absorbed into the build's mean**. Two builders have been charged for a tool the corpus mandated and assigned to nobody |

**What the proposal did not see, and what the ruling adds beyond it.** Releasing the checks does
not fix the item, because **even fully released it cannot tell a rendered scene from a rendered
scene with its authored text deleted.** Every clause of M5 is about the *background* — world
visible, UI under 55%, no uniform frame — and round 2 scored 19 of 19 distinct frames at full marks
in the same verdict that found **0 of 10 dilemma questions reaching the player**. The foreground has
no instrument, so `RI-JRN09` was filed for it (`ES-LEGIBLE/1`, `ES-ANSWERED/1`, `ES-NAMED/1`), and
`RI-JRN01` §0.2 now requires a verdict on this journey to cite it.

---

## The proposal as filed follows, unaltered.

## What is being proposed

`RI-JRN01`'s **Comparison method → Instrumented pass** currently says:

> Requires harness amendment **`A-JRN1`** (real input path + first-input timing + the new trace
> events). Until it exists every check below is `unmeasurable` and scores **0**, fail-closed
> (CRITIC-DOCTRINE §7.3).

The proposal is to **narrow "every check below" to the checks that actually need the tool.**

| Keep fail-closed on `A-JRN1` | Release to direct measurement |
|---|---|
| **M1** surfaces to control — needs `navigationStart`→`first_control` timing | **M4** control-before-definition — `listEntities()` + the `dialogue_open` frame |
| **M2** unskippable time — needs first-rendered-frame input dispatch | **M5** creation diegesis — screenshot + frame-area measurement |
| **M3** title composition — needs the accessibility snapshot at the title, which presupposes a title | **M6** named interlocutor — `getCensusState().speaker` resolved against `sim.npcs` |
| **M12** loading discontinuities — needs the sim-frame gap trace | **M7** class routes as presented in play |
| **M14** second-run skip cost — needs input counting to `first_control` | **M8** the carried object — `readWrit()` / inventory |
| **M16–M19** the naive pass — needs an isolated fresh-agent channel | **M9** instruction budget — the rendered text stream |
| | **M10** in-world inscriptions |
| | **M11** marker sweep |
| | **M13** modality parity |
| | **M15** chosen-one sweep |

A critic measuring a released check **must state the instrument it used** in
`method_deviations`, exactly as it would for any substitution.

## Why

**1. `gamepad-shim.mjs`'s contract already exists inside the build, in a better place.**
`RI-JRN01` M13 names `tools/journey/gamepad-shim.mjs` for the gamepad-only leg. The W1-07 round-2
build implements `RealInput.pollGamepad()` reading the W3C standard mapping and exposes
`__HARNESS.gamepad(state)` → `RealInput.pushGamepadState(state)` → **the same `pollGamepad()`** that
`engine.loop.beforeTick` calls for a physical pad. A shim living in `tools/` could only ever
simulate that path; a shim that *is* that path cannot drift from it. Measured this round: the whole
census completed on a pad alone in 28 button presses plus one left-stick walk, `activeDevice:
"gamepad"`, 85 polls.

**2. The released checks are screenshot-and-state checks, and this round proves it.** The W1-07
round-2 critic measured M4, M5, M6, M9, M11 and M13 from scratch, with no journey tool, using only
`window.__HARNESS` and Playwright — and found *more* than the tool's own checklist would have,
because M7's "as presented in play (not from the data file)" is precisely the check that caught the
questionnaire's ten dilemma prompts being computed and never drawn.

**3. As written, the item cannot distinguish the two things it exists to distinguish.** In round 1
the piece rendered twenty byte-identical grey frames with no room, no person and no text. In
round 2 it renders nineteen distinct frames of a named interior with a named interlocutor and
legible dialogue. `RI-JRN01` scores both **0**, for the same reason, and that reason is the absence
of a tool neither round's builder was assigned to write. A scale that returns the same number for
those two builds is not measuring the journey; it is measuring the toolchain.

**4. It does not weaken the bar.** Every released check keeps its threshold and its hard-fail
clause verbatim. The timing checks — which are the ones that genuinely cannot be faked without
`A-JRN1`'s real-input instrumentation — keep fail-closed at 0. What changes is only *who is allowed
to hold the stopwatch* for the checks that do not need one.

## What this proposal is careful not to do

- It does **not** retroactively raise `RI-JRN01`'s score for W1-07 round 2. That verdict scores the
  item **0 as written**, and records the direct measurements separately, per-check, without
  substituting them.
- It does **not** cancel `A-JRN1`. `tools/journey/journey-run.mjs` and `beat-extract.mjs` still need
  writing; the blind pair in particular is unrunnable without `beat-extract.mjs` and stays that way.
- It does **not** touch `ES/OPEN`'s requirement table (O1–O18), any threshold, or the naive pass.

## Adoption

If adopted, edit `corpus/88-journeys/RI-JRN01-first-launch-to-first-choice.md`'s instrumented-pass
preamble to read:

> Requires harness amendment **`A-JRN1`** for **M1, M2, M3, M12 and M14**, and the naive-pass
> channel for **M16–M19**. Until those exist, *those* checks are `unmeasurable` and score **0**,
> fail-closed (CRITIC-DOCTRINE §7.3). **M4–M11, M13 and M15 are measurable today against
> `window.__HARNESS` and a screenshot; a critic measuring them MUST name the instrument it used.**

and strike the `gamepad-shim.mjs` reference in M13 in favour of `__HARNESS.gamepad()`.
