---
id: AMENDMENT-PROPOSAL-JRN01-01
title: Split RI-JRN01's fail-closed clause — the tool owns the timing checks, not the whole item
kind: text
side: neutral
status: PROPOSED — not applied. Requires the RI-JRN01 owner or the orchestrator to adopt.
proposed_by: crit-w1-07-r2-3e7c (W1-07 round-2 critic)
wave: 1
---

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
