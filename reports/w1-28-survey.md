# W1-28 — the first hour as interaction (RI-JRN02), round 1

**Builder's survey.** Measured at `033e7ac` unless a line says otherwise. Paths judged:
`journey.firsthour.interaction`, `journey.firsthour.competence`. `input.discoverability` is
**cited, not scored** — the declared W1-28 ↔ W1-08 seam.

Every JSON artifact below is under `reports/w1-28/` and is gitignored by `reports/.gitignore`
(reproducible from the tools). The tools are `tools/journey/jrn02-hour.mjs`,
`tools/journey/jrn02-competence.mjs`, `tools/journey/jrn02-chart.mjs`.

---

## 1. Nobody had ever played this hour

`journey-run.mjs` registers `jrn02-first-hour` (216 000 frames, `durationMin: 60`), and
`cadence.mjs` and `competence.mjs` — the two tools RI-JRN02's Comparison method names — are built
and have been hardened over four critic rounds. The pipeline reads as complete.

It is not driven. `driveBeats()` drives the **opening** and then ends with

```js
const remaining = Math.max(0, Math.min(o.frames, 20000));
await stepAndSample(handle, remaining, 600, ...);      // zero inputs dispatched
```

and `journeyLegs()` branches on jrn03…jrn08 with **no jrn02 case**. So
`--journey jrn02-first-hour --duration-min 60` yields the opening plus 5.5 minutes of nobody
playing, capped at 20 000 frames whatever `--duration-min` says. `cadence.mjs` over that would
report `gap_max` ≈ the whole run and `combat_fraction` 0 — **HF3 twice over, as a fact about the
build when it is a fact about the driver.** Same shape as this tree's 36 000-frame/0-event
session with the empty `ops.json`.

## 2. The verb ledger cannot see the buttons — `reports/w1-28/verbcov/verb-coverage.json`

RI-JRN02 M-I1 wants a first-use minute and a repetition count per verb, off the trace.
`input_action` (A-JRN7) is the event that carries them.

**0 of 16 closed actions emit one.** Seven — `light`, `roll`, `block`, `parry`, `jump`,
`swap_right`, `swap_left` — **demonstrably executed** (their own `ACTION_START` / `GUARD_UP`
is in the same trace window) and emitted none.

Three controls, all holding in the same browser, are what make that a finding rather than an
output. The audit refused to report until they did:

| control | result |
|---|---|
| **C-A** the drain is live | events of some kind came back from the presses |
| **C-B** the input landed | 10 of 16 actions produced their own consequence event |
| **C-C** the event name is reachable | pressing `interact` **standing at a signpost** put `input_action` in the record and opened the post |

**Cause.** The only emission for a combat button is `game/src/sim/player.js:109`, inside
`stepPlayer()`, **which nothing imports** — `game/src/sim/souls.js:46` says so in-tree ("DEAD
CODE. Nothing imports `stepPlayer`"). The live path is `game/src/combat/player.js` and it contains
no `input_action` emit at all. Two parallel implementations of one system (RULES 10).

**A second, separable defect (F3).** `input_action` *is* emitted on five `engine.js` paths, all of
them the `interact` reach. But the **harness-verb** arm of that route emits outside the fixed step,
and `sim/step.js` calls `bus.clear()` at the top of the step — so `signRead()` raises the event and
no record ever carries it. Only the **button** arm lands in the trace. Both arms are recorded.

**Consequence for the item:** M-I1, and C1/C2/C3/C4/C10 in so far as they count inputs, are
**unmeasurable from the shipped trace** for every button in the game. This piece therefore reports
its verb numbers **driver-side**, marked by source, which is the same idiom `journey-run.mjs` uses
for `first_input`.

## 3. The hour, driven — `reports/w1-28/hour/`

A need-driven policy agent. **Every verb is gated on a trigger read from the world**, never on
script order: `block` is not used until a hit has landed on a body that was already retreating,
`use_item` not until hp crosses a floor, `heavy` not until N lights have failed to stagger. The
order that comes out is a property of what the hour presents. It **spawns nothing** — if the hour
the world places contains no hostile, `combat_fraction` is 0 and that is the finding.

**The run did not finish inside my budget.** At the 9.0-minute checkpoint (throughput ≈ 2
simulated minutes per 5 minutes of wall clock; a full hour is ≈ 2h15m):

- 1 602 m walked, along the `crossing` road route out of Lilmoth
- **acquisition order: `sprint`@0:02 · `interact`@0:44 · `read`@0:44 · `light`@1:31 · `roll`@3:00 · `lock_on`@7:22 · `use_item`@8:23**

That matches V3's `light → roll → block → lock_on → use_item → heavy` with `block` and `heavy`
not yet triggered. **Every hour-derived number in this piece is a nine-minute number** and
`V_exercised 6/14` and `gap_max 496 s` are **not** verdicts on the hour.

**F4 — combat arrives at minute 1.5, not minute 19.** §A puts `light` and `roll` at
`first_use ≤ 0:19`. Those are upper bounds, so the letter is met; but the Souls half of the hour
arrives seventeen minutes ahead of the sheet, and nothing else in the corpus would notice.

**Two fixture bugs found by the driver failing, not by inspection.** Round 1 walked only when no
verb had fired, so `sprint` fired once and starved locomotion for ever — 3.7 simulated minutes,
body moved 2.6 m, 25 `jump` presses. And `walkPath` beelines, so the body wedged against Lilmoth's
buildings. Either would have published *"the first hour contains nothing"* as a finding about the
game.

## 4. Competence — `reports/w1-28/competence/competence.json`

**The problem, stated before the numbers.** §C cannot be answered as written on this build.
`competence.mjs` already says why scripted enemies defeat it. The deeper problem is circularity:
the agent is a program. Author a better late policy and you have measured your own source code;
hold the policy fixed — as M-I9 (gear) and K7 (tier) require — and the expected improvement is
**zero by construction**.

**The design.** Give the agent one thing it cannot be told and can only learn by being hit: `ŵ`,
its estimate of the enemy's windup. The policy is one line, **identical in every arm**:
`roll at windup_start + ŵ − LEAD`. I authored the *capacity* to learn; the *content* came from the
world.

| arm | learner | enemy | `roll_efficiency` first → late |
|---|---|---|---|
| **A** teardown | frozen | one repeated attack | 0 → 0 |
| **B** the claim | on | one repeated attack | **0.833 → 1.000** |
| **C** | frozen | randomised windup | 0 → 0 |
| **D** control | on | randomised windup | 0 → 0.5 |
| **E** hard control | on | unlearnable (spread ≫ i-frames) | 0 → 0 |
| **F** not a control | on | **its full declared moveset** | 0.167 → 0.167 |

All four verdict controls hold: **B improves ≥ 0.15**; **A is flat** (delete-the-fix bites — the
learner is what moved the number); **B ends materially above D**; **E is flat**.

**Three controls I watched fail before they passed**, each recorded in the file that carries it:

1. the coverage audit refused to report 0/16 until it could show it could hear an `input_action`;
2. *"a randomised enemy is unlearnable"* **failed** — the learner converged on the distribution
   **mean** and gained 0.167, because an 11-frame i-frame window is wide relative to the spread.
   Bar made relative; genuinely unlearnable arm E added;
3. the relative-**delta** bar was then **ceiling-confounded** — B reaches 0.833 in its first bout
   so it can gain at most 0.167, while D climbs 0.5 to a *worse* end state. The statistic is now
   the end state; both numbers are published.

**F5 — the ordinary trash mob cannot be learned on average.** `inf_trash` declares startups of
**22, 44, 54 and 68 frames** — a 46-frame spread against an 11-frame i-frame window. One repeated
attack: 0.833 → 1.000. The full declared moveset: **flat at 0.167**, because no single roll time
covers the spread and the mean covers none of them. That is the right shape for a Souls moveset —
you learn the moves, not the mean — and it is **a warning about §C itself**: K2 averaged over an
encounter will read a perfectly learnable enemy as unlearnable.

**What this does not claim.** Not that a human got better. That *this build contains a fight that
can be learned*. Strictly weaker than §C's claim, and the strongest the build supports.

## 5. What was not done

- **The 60-minute run did not finish.** It reached 9.0 simulated minutes and was still running at
  hand-off, writing `dispatches.jsonl` / `samples.jsonl` every tick and `hour.json` every 60 ticks.
- **`cadence.mjs` was not run** over the produced trace — the driver only writes `trace.jsonl` at
  the end of the run, so there was nothing to read. **This is the single most valuable next step
  and it is one command.**
- C5–C8 are only approximated driver-side at tick resolution and are labelled
  `fractions_driver_side`. `cadence.mjs` owns them; its own round-4 note says no trace record in
  this tree carries a `ui` subtree, so C6/C8 are likely unmeasurable — unconfirmed by me.
- **M-I3** (verb teaching purity, V2) not run — needs the UI-text stream `journey-run.mjs` owns.
  **HF2 is unassessed.**
- **M-I5** (necessity: re-run each introducing encounter without the verb) not run. `--no-acquire`
  exists and is self-tested as the arm that would do it; no encounter was re-run.
- **M-I13 / M-N1–M-N5** (frustration ledger, naive pass) not run — fleet role JC-02N, and a
  builder may not run them on itself.
- **M-I14** (gamepad-only, touch-only) not run — RI-JRN04 / W1-29.
- The competence 2×2 is resolved **analytically** against the enemy's *declared* startups, not by
  driving a live fight frame by frame. A live-fight arm is the obvious next round and would test
  whether the declared startups are the ones the body actually faces.
- The **blind pair** RI-JRN02 requires was not built; rule 25 forbids me judging one I built.

## 6. The W1-28 ↔ W1-08 seam

`input.discoverability` is W1-08's and is cited, not scored (CORPUS-CONTRACT §4 rule 1). One
thing found here that W1-08 needs: V2 forbids introducing a verb by text and M-I3 checks the 30 s
of UI text before each verb's first use. **W1-28 can produce the first-use minutes; W1-08 owns the
text stream they must be checked against. Neither piece alone closes HF2.**

## 7. Contention and timing

Gate exit 3 at start (5.31/core). Re-gated to exit 0 (3.54/core) for the verb-coverage and
competence runs. The 60-minute hour was launched at **gate exit 3** (4.07/core against a 4.0
ceiling, 5 of 6 browser instances) — **proceeded and declared**, per rule 21. **No timing figure
is published from any run**; every number here is frame-counted.

A neighbour had `game/data/quests/**` mid-write during this piece and `QuestBook`'s constructor
throws on it, which blocks every journey in the corpus at once. All browser work was run against a
pristine `git archive HEAD` copy via `--entry`, recorded in each artifact.
