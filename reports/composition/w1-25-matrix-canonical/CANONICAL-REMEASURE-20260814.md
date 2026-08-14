# W1-25 — the canonical matrix path, re-measured

**Task** `W1-25-matrix-canonical-20260814` · **branch** `codex/wave1-build-experiment` ·
**tree commit** `f680d662` (+ this agent's worktree changes to `tools/composition/`) ·
**measured on** RunPod, NVIDIA RTX A5000, SECURE, $0.270/hr, run `20260814-102825Z-14955`.

Opened by the `next_step` of `orchestration/status/W1-25-DIVERGENCE-20260814.json`, which named this
as the single highest-value remaining action on the piece and could not do it because
`matrix-probe.mjs` needs a browser window and the box was over its contention ceiling all session.

---

## 1. The answer

**12 demonstrated seam crossings. Both hard fails clear. All four W1 floors met.** Measured today,
at the tool's documented default path, through the tool's own contention gate, with the gate saying
GO rather than being forced.

| | canonical, before | canonical, now |
|---|---|---|
| `ran` | `false` | `true` |
| demonstrated live cells | 0 (floor 10) | **12** |
| demonstrated seam crossings | 0 (floor 4) | **12** — 5 W→F / 7 F→W |
| demonstrated structural | 0 (floor 1) | **3** |
| matrix score | 0 (floor 20) | **36** |
| hard fail 1 — fewer than 4 crossings | **true** | false |
| hard fail 2 — zero F→W | **true** | false |
| written | 2026-08-08T02:42Z | 2026-08-14T10:32Z |

`reports/composition/w1/matrix.json` now holds that run, byte-for-byte as the tool wrote it, with a
`commit` and a `host` field so the next reader can tell what it is a claim about.

## 2. The two artifacts were never in disagreement, and both were honestly produced

This is the more useful finding, and it is the one the brief asked to be checked before either
number was believed.

**The canonical artifact was not a measurement of the world.** It records
`ran: false, why: "tools/contention.mjs --gate refused; no browser was launched"`, and
`results: []` — **zero probes were ever executed**. Its zeros are RI-CMP01 hard fail 5 (*unmeasurable
⇒ 0, fail-closed*) applied to a run that did not happen. The tool writes that record deliberately, so
that a reader cannot mistake an older file for this commit's answer. It did its job; nobody came
back.

**The side artifact was a real run of a different instrument.** Between the two dates the probe table
grew from **10 cells to 15** — the five `BOS->*` cells were added — and four probes were rewritten,
including moving the alert observable off `listEntities()` (which carries no `alert_state`) onto
`getEncounterState().members[]`, which does. Commit `a8e53de2`, 2026-08-11.

So the three artifacts in `reports/composition/` are three different things:

| artifact | date | what it is |
|---|---|---|
| `w1/matrix.json` (old) | 08-08 | the instrument **refusing to start**. 0 probes run. |
| `w1-25-builder/matrix.json` | 08-10 | a real run of the **10-cell** tool reading the wrong accessor: 9 paper, 1 vacuous, 0 demonstrated. |
| `w1-25-persistent-builder/matrix-live.json` | 08-11 | a real run of the **15-cell** tool: 12 demonstrated. |

Today's run reproduces the 08-11 run **cell for cell** — the same 12 `OK` and the same three `INERT`
(`SPL->ROS`, `EQP->ROS`, `DIS->BOS`) — three days and many commits later, on different hardware. The
W1-25 agent's reversible ruling ("the canonical path is stale rather than right") is upheld, and its
own named falsifier — *a re-run that does not reproduce 12* — did not fire.

## 3. Checking the instrument can go red, before trusting either figure

A count of 0 and a count of 12 are equally suspicious until the needle has been seen to move.

### 3.1 The whole-run null control — the live equivalent of driving the thing

Added `--null-control on|off` to `matrix-probe.mjs`. It changes exactly one line: both arms are
handed the same `set`, so the source-state fork is gone. Everything else — same browser, same seed
1234, same `loadState(scenario)` per arm, same encounters, same observables, same roll-up — is
identical to the real run. It refuses to write the canonical default path, and stamps
`null_control` into its own artifact so it can never be read as a measurement.

**Neither control is the trivial one.** An empty world would fail everything by accident — the
mistake that let a landform instrument report 71% coverage of a world containing none of the thing it
measured. These are the two *plausible* wrong answers instead: a world where the source state is
always set (`on`) and one where it is never set (`off`). Both keep the population intact.

| arm | demonstrated | paper | vacuous | support preserved? |
|---|---|---|---|---|
| **real run** | **12** | 3 | 0 | 4 / 56 / 392 / … |
| null control `on` | **0** | 15 | **0** | 4 / 56 / 392 / … |
| null control `off` | **0** | 15 | **0** | 2 / 56 / 392 / … |

Zero vacuous cells in both controls is the load-bearing detail: the world was still fully populated,
the encounters still spawned, `ROS->DIS` still ranged over 392 NPCs. The cells went INERT **because
the fork was removed and for no other reason**. Effect size across the same 15 probes: 12 against 0.

### 3.2 The self-test could not see the defect that caused the 08-10 result — now it can

Ran three sabotages against the offline self-test on a copy.

| sabotage | old self-test | after the fix |
|---|---|---|
| A — a probe's fork made a no-op (`setTimeOfDay(3)` on both arms) | **FAIL** (1 cell) | FAIL |
| B — `alertValue` reads `x.alert`, a field the members array does not carry | **PASS 15/15** | **FAIL** (1 cell) |
| C — `alertArena` reads `listEntities()`, which carries no `alert_state` — *the 08-10 defect verbatim* | **PASS 15/15** | **FAIL** (4 cells) |

Two causes, and both are now fixed in `tools/composition/matrix-probe.mjs`:

1. **The self-test never ran `ALERT_HELPER`.** A comment beside it claimed it exposed "the same two
   page-side helpers the live path injects"; the code hand-wrote two lookalikes. So the file's most
   defect-prone code was the one part of the probe body no self-test exercised. It now evaluates
   `ALERT_HELPER` itself, through the same `new Function` construction the live path uses.
2. **The fake world was more permissive than the real one.** `Engine.listEntities()`
   (`game/src/engine.js:10612`) returns `{eid, kind, archetype, pos, hp}`; the fake handed back the
   whole entity, `alert_state` and all. A probe reading the observable off the wrong accessor
   therefore passed the self-test and then reported 9 paper cells out of 10 against the live build.
   The fake now projects to the real accessor's field set.

**Which fix carries the effect (RULES #6).** Not two guards for one defect — a dependent pair.
Fix 1 alone leaves sabotage C invisible (PASS 15/15). Fix 2 alone turns the *intact* self-test red
(FAIL 4/15), because the hand-written helper reads `alert_state` off the now-faithful accessor. Only
both together give: intact PASS 15/15, sabotage C FAIL 4/15.

## 4. What is thin about the 12, reported rather than rounded up

The floor is met and the hard fails are clear. Two things a reader should still know.

**`BOS->DIS` moves one disposition in 392.** Its declared mechanism is *"Province-wide reaction to
the Steward outcome"*; the observed difference between arms is a single key,
`gallery-intake-keepers: -5 → 35`. Arms differ and support is intact, so the cell is legitimately
`OK` under the tool's rule — but one group in 392 does not evidence "province-wide". This is the same
shape the W1-25 round caught in its own work ("effect size 1 against 26") and reported rather than
publishing.

**It does not change the verdict.** Struck out entirely, the run still reads 11 live cells (floor
10), 11 crossings (floor 4), 3 structural (floor 1), score 34 (floor 20), both hard fails clear.

**The five `BOS->*` cells compute `support` from the wrong quantity.** The tool's own doc defines
`support` as *"how many units the observation ranged over"*; those five use
`H.questBook().includes('Q-MAIN-28') ? 1 : 0`, which is whether the quest exists. It understates
rather than overstates — but it means the vacuity guard for those five is disconnected from their
observable, so a `BOS->DIS` over an empty disposition map could not report `VACUOUS`. Narrow, real,
and left for the piece's builder rather than repaired by a re-measurement.

**Nine of the twelve rest on support ≤ 2.** `SCH->ROS` (56), `ROS->DIS` (392) and `TOD->ROS` (4) are
the broad ones. Under Ruling W1 — *an aggregate may never be the binding predicate for something a
player meets one at a time* — a crossing demonstrated over one entity is a demonstration that the
seam exists, not that a player will meet it.

## 5. The stale-canonical pattern — the population searched, and what is in it

Round 2 writing live results to a new path while the canonical rotted is a pattern, and it now has
an instrument: **`tools/composition/stale-canonical-census.mjs`**.

**The population.** Every tool under `tools/**/*.mjs` that names a **default** output path:
**16 tools**. Six more take `--out` with no default and cannot rot this way; that is the
better-behaved design and the census lists them separately rather than hiding them.

**The test, and why it is that one.** RULES #12 — *a measurement is a claim about a commit*. So the
question is not "is this file old" but **has the code that produces it moved since it was written**.
Bank commits are excluded from that history, or every tool would date to today.

**Result over the shared tree** (`/home/user/elder-souls-claude`, which holds the untracked artifacts
a worktree checkout does not): full rows in `stale-census-shared-tree.json`.

```
REFUSAL 1 · BEHIND_SIDE 1 · STALE_VS_TOOL 9 · ABSENT 2 · FRESH 3
```

**Eleven of sixteen canonical paths are stale by at least one test.** The named ones:

- `reports/composition/w1/matrix.json` — **REFUSAL**, the one this round fixed.
- `reports/experience/w1/pbrule-audit.json` — **BEHIND_SIDE**. A newer artifact of the same schema
  (`elder-souls/exp06-pbrule@1`) sits at
  `reports/experience/w1-25-persistent-builder/pbrule-current-wave.json`. **This is the W1-25 shape a
  second time, in the same piece**: the real run happened and went to a round path.
- Nine **STALE_VS_TOOL**, spread across four pieces — souls (`critic-souls-r1`, `critic-souls-r2`,
  `souls-consumption`, `souls-ledger-oracle`, `w1-souls-ledger/consumption`), experience
  (`anecdote-verify`, `breakage-register`, `event-histogram`), world (`world/population/critic-r1`).
  `event-histogram.json` is one of the two the W1-25 agent named by hand as still fed by the dead
  `reports/sessions/exp-w1-opening/trace.jsonl` (79 MiB, 36,000 frames, **0 events**, 2026-08-07).

**Eight of the sixteen canonical paths are untracked**, covered by `reports/.gitignore`'s `*`. That
is a deliberate decision about size, not a defect — but it means those canonical paths exist only on
the container that made them, and a fresh clone reads nothing there at all. The census reports it and
does not fail on it.

**What the census cannot see, said plainly.** `reports/experience/w1/anecdote-trace.json` comes back
**FRESH** and is nonetheless fed by the dead trace, because its *tool* has not been committed since
either. The tool-commit test catches "the instrument moved and the artifact didn't"; it does not
catch "the world moved and the artifact didn't". The honest fix for that is input identity, not
timestamps — see the ruling below.

**The census found its own author wrong first.** Its first live run flagged the freshly-measured
canonical matrix as `BEHIND_SIDE` against my own two `--null-control` artifacts, which share the
schema and are newer. A control is not a competing measurement. Narrowed by **field**
(`isMeasurement()` rejects `null_control` and `ran:false`), not by path — special-casing
`null-control-*.json` would have made the census pass on exactly the tree it was written against and
nowhere else. Sabotaged on a copy afterwards: disabling the refusal check turns the self-test red
(exit 5), so the census is not itself inert.

## 6. Ruling W1-25-C — a real run lands on the canonical path *(reversible)*

Ruled here rather than asked, per `CLAUDE.md` rule 0.

1. **A tool's default `--out` is the canonical path, and re-running to it is part of finishing a
   round.** A round that ran live and wrote only to a round path has not updated the answer, however
   good its numbers are.
2. **Never coin a second instrument name for one schema.** `matrix-live.json` beside `matrix.json` is
   what hid this for six days. Round records belong at
   `reports/<piece>/<round>/<same-instrument-name>.json` — same leaf name, different directory — so
   the schema index lines them up and the census can compare them.
3. **Every artifact stamps `commit` and `host`.** RULES #12 has said this since it was written and
   almost nothing implements it; `matrix-probe.mjs` now does, including a `RUNPOD_SOURCE_REVISION`
   fallback for worker runs that have no `.git`.
4. **An artifact that is not a measurement of the shipped tree says so in a field** — `ran: false`
   and `null_control` are the two that already exist — so that a reader and a tool can both tell.
5. **The tripwire is `stale-canonical-census.mjs`, exit 2.**

**Reversal**: one step, and none of it is read by the game — delete
`tools/composition/stale-canonical-census.mjs` and revert the `--null-control` flag and the two
self-test fixes in `matrix-probe.mjs`. **Falsifier**: if re-running the nine `STALE_VS_TOOL`
artifacts reproduces their numbers, the tool-commit test is mostly noise and the right test is input
identity — hash the input, record the hash, compare — which would also catch `anecdote-trace.json`,
the one case this census provably gets wrong in the forgiving direction. That would replace the
test, not the ruling.

## 7. Evidence

| what | where |
|---|---|
| the canonical run | `reports/composition/w1/matrix.json` |
| null controls | `reports/composition/w1-25-matrix-canonical/null-control-{on,off}.json` |
| the census, shared tree | `reports/composition/w1-25-matrix-canonical/stale-census-shared-tree.json` |
| the census, this worktree | `reports/composition/w1-25-matrix-canonical/stale-census-worktree.json` |
| Pod lifecycle, logs, GPU, all four arms | `reports/runpod-gpu/runs/w1-25-matrix-canonical/` |
| the worker command, with its reasoning | `tools/composition/w1-25-matrix-canonical-run.sh` |

**Conditions.** No timing figure is published anywhere in this round; every number is a deterministic
verdict count at seed 1234. Local contention was 5 browser instances and load 5.34 per core against a
4.0 ceiling — which is exactly why the work went to a Pod, where `tools/contention.mjs` read 0
instances and 0.07 per core and said GO. The Pod was used as an **uncontended box, not for its GPU**:
every probe calls `setRenderRate(0)` and reads state, never pixels.
