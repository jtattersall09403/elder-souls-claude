# W1-13 completion evidence — 2026-08-11

## Scope and revision

This builder continuation started from `a799b71f888ac7770d8865b52c239796c127ee1e`, the fetched
head of `origin/codex/wave1-build-experiment`. It read the complete current versions of all thirteen
governing items named by `orchestration/plans/W1-13.md`. No work from the concurrent W1-04, W1-06,
W1-19, W1-25 branches was consumed, and none of their owned files was changed.

The production repair required by the continuation plan is already present at this revision in
commit `6eebb6f`: `clock.award_frames` is durable, restore reinstates the integer award clock, and the
native JRN06 method-8 fixture populates Lilmoth and rejects an empty or mismatched roster. This run
therefore did not duplicate those mechanisms. It re-executed their controls and began the native aggregate, then applied the plan's explicit cheap-first stop condition once the missing R3/R4/M9 populations made the aggregate unsatisfiable.

## Cheap gates and populations

| Command | Result |
|---|---|
| `node tools/boot-check.mjs` | PASS; engine constructed and harness answered. |
| `node tools/check-data.mjs` | PASS; 585 indexed files, 115/115 interiors, 392 NPC records, and all settlement references resolved. |
| `node tools/check-souls-world.mjs --totals` | PASS; 310 rows, 144 posts, 267 bodies, 10,679 souls; cache and statblocks agree. |
| `node tools/check-quests.mjs` | PASS with its existing warning: 12 non-resolution document reveals name unwritten sources; 202 quest hooks/topics resolve. |
| `node tools/combat/check-ai-units.mjs` | PASS. |
| `node tools/combat/w1-12-r3-ai-gate.mjs` | PASS, 21/21 with controls. This is sibling evidence only, not a new W1-13 AI score. |

Before browser work, `node tools/contention.mjs --gate` reported GO: two non-resident browser
instances, load 1.22 across three cores (0.41/core), with room for three more. One browser was used
for each W1-13 run and closed by its tool. No timing claim below is a wall-clock performance claim.

## Current-defect controls

`node tools/harness/w1-13-r5-save-clock.mjs --out /tmp/w1-13-save-clock.json` passed. After twenty
deaths from 04:48, the save contained `award_frames: 54862`; the same ordinary enemy paid 42 souls
before and after restore. Removing only `clock.award_frames` from the in-memory save reproduced the
old 57-soul result. Thus both the positive arm and delete-durability control differ for the intended
reason.

`CRITIC_OUT=/tmp/w1-13-clock-2x2.json CRITIC_SCRATCH=/tmp/w1-13-clock-scratch node
tools/analysis/critic-w1-13-r4-clock.mjs` re-executed the source-level environment × souls-consumer
factorial. Both cuts matched exactly once; the shipped arm agreed at all 96 quarter-hour boundaries;
deleting both layers reproduced unequal death/live awards at four boundaries. The JSON files in
`/tmp` were inspected but are intentionally not committed.

## Governing-row disposition

The W1-13-owned seam is exercised by the JRN06 aggregation and save-clock controls. Existing
commit-matched sibling evidence remains the source for wholly sibling-owned AI state machines,
music implementation, camera implementation, healing combat, lore prose, transport implementation,
region rendering, and dungeon construction; this builder did not re-author or self-judge those rows.

The plan-mandated fail-closed dependency outcomes remain:

* JRN06 R3 is `unmeasurable`, not zero: there is no governing placed hostile population on the
  run-back route at this revision. Creating local hostiles would violate the plan.
* JRN06 R4 is `unmeasurable`, not zero: there is no real shortcut geometry on RN2. The saved
  `shortcutsOpened` register is not physical geometry and receives no proxy credit.
* PRG04 method 8's timed-quest clause is `unmeasurable`: `game/data/quests/hooks.json` has no
  deadlines and the deadline consumer has no caller. The native aggregate separately measures the
  nonempty roster, merchants, clock, four-rest round trip, and soul-award consequence.
* PRG04 method 9 is `unmeasurable` here because its governing current RI-PRG06 86-death/per-region
  budget is sibling-owned and absent as a valid current population. Historical arithmetic is not
  reused.
* Mixed RI-AI05/06/07, RI-AUD04, RI-CAM05/06, RI-CMB08, RI-LOR05, RI-TRV02 and RI-WLD04/07 item
  totals remain `not_run` wherever a complete current sibling population is unavailable. No partial
  W1-13 observation is promoted into a complete item score.

These zero-credit dispositions mean the thirteen-item piece aggregate cannot honestly be declared
green at this revision. They are not unfinished builder actions: the continuation plan expressly
forbids synthesising the missing hostile, shortcut, economy, timed-quest, audio, route or geometry
populations. All builder-owned production and instrumentation work available inside the seven W1-13
paths is delivered; fresh independent criticism remains required.

## Binary evidence policy and reproduction

The native journey generated its surface manifest and a 20 MB JSONL trace under `/tmp/w1-13-jrn06`; no final `journey.json` was emitted before the run reached the long run-back leg. Because R3, R4 and PRG04 M9 were already proven unmeasurable and make the aggregate unsatisfiable, the plan's explicit stop-before-long-runtime rule was applied and only this process was interrupted after about twenty minutes. The partial trace and surface manifest were inspected as run artifacts only; no binary or trace artifact is committed. Reproduce them with:

```sh
node tools/contention.mjs --gate
node tools/journey/journey-run.mjs --journey jrn06-death --seed 4711 \
  --profile desktop-720p --input-mode real --trace-events --deaths 20 \
  --out /tmp/w1-13-jrn06
```

The authoritative result is `/tmp/w1-13-jrn06/journey.json`; the image/trace payload is disposable
evidence and must remain outside Git.
