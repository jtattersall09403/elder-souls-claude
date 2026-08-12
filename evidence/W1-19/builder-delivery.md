# W1-19 production builder delivery — 2026-08-11

Tested from `8a0b034830cb2f4583d26efc45b6663ec8ed7176` plus this patch.

## Production repairs

* Removed a 194,703-byte non-JavaScript corruption span accidentally carried in merged `game/src/engine.js`, restoring the canonical save/load implementation from the merged W1-19 parent while preserving the production conversation, readable, road, W1-06, and W1-25 changes outside that span.
* Made the production chain runner use the shipped interaction radius at the opening carter and both sides of interior door interactions. No quest/topic/reveal mutation API is used for progression.

## Bounded live proof

`intended-q1-q7-production.json` is a cold-created Saxhleel/interior run using movement, conversation, doors, and readable interaction. It completes Q-MAIN-01 through Q-MAIN-07, with zero violent resolutions and no purchased openings. The book/reveal path for Q-MAIN-06 and Q-MAIN-07 executes through rendered interiors.

`no-bootstrap-red.json` deliberately removes the opening greeting. The same runner stops at Q-MAIN-01 with zero topics, proving the opening world consumer is necessary and the instrument can fail.

`intended-q8-block.json` resumes the clean Q-MAIN-07 checkpoint and records a genuine remaining builder defect: the player dies during the Blackrose-to-Archon production journey, respawns in Soulrest, and therefore cannot reach Q-MAIN-08. It is not a canonical dependency block. No later Gate A/C completion is claimed.

## Cheap checks

* `node --check game/src/engine.js` passes.
* `node tools/quests/mainline-gate-b-fixtures.mjs --out evidence/W1-19/gate-b.json` enumerates 104 matched gate fixtures and 77 sibling pairs; played observations remain incomplete.
* `node tools/quests/mainline-census.mjs --json` passes and is retained as `mainline-census.json`.
* `node tools/check-content.mjs` passes.
* `node tools/check-quests.mjs` passes with 12 warnings for non-demanded document reveals.

## Critic handoff

All full populations, fresh aggregate judgement, complete PONR/aftermath population, final-hour protocol, specificity/reaction work, and blind landing comparison remain critic-owned only after the builder chain is complete. They were not scored by this builder.

## Continuation at final working tree

The recorded helpless crouched walk was repaired to stand, sprint, heal, and prohibit defensive
swings for this explicitly nonviolent trace. The bounded cold rerun again completed Q-MAIN-01
through Q-MAIN-07, reached 3,390.4 m of the Blackrose-to-Archon journey, then died near Archon after
73 production healing inputs while a shipped salt storm remained active. The clean route still
fails Q-MAIN-08 and `intended-q8-block.json` retains the text-only reproduction. Builder-owned work
is **not complete**: the runner must consume the shipped glassed-crater shelter counter during the
storm before both chains and the remaining bounded gates can honestly run.

## Crater shelter continuation

The production route now discovers the live Stone Wastes `glassed_crater` population, leaves the
road through ordinary movement, descends below natural terrain, records the live salt-storm row,
waits 600 frames with player healing input available, and rejoins the authored road without combat.
The crater terrain's former 0.60R floor made the counter a one-way trap; the widened 0.20R grade
preserves its glass floor and rim while making the shipped counter continuously walkable. The
bounded route probe walked into and back out of the changed crater with zero discontinuities and
`defensive_swings: 0`. The earlier retained run is the delete-fix arm: it reached the old centre,
then aborted `stuck` after 32.3 m on exit.

The entire builder allocation has not yet been demonstrated at one final commit; no completion
claim is made by this continuation evidence.

## 2026-08-12 continuation diagnostic

The stale pre-repair Q-MAIN-08 capture has been replaced with the current-worktree rerun from the
Q-MAIN-07-complete resume state.  The rerun selected the shipped crater (59.95 m road detour),
entered and exited it by ordinary movement, and named the first failure `death-respawn`: weather
was `white_clear`, so this run is deliberately **not** claimed as active-storm shelter proof.  The
trace shows zero estus at crater arrival and a later combat death/3,057.8 m hearth respawn after the
outbound route had covered 4,650 m.  Reproduce with:

```
node tools/quests/mainline-chain-floor.mjs --signature-count 1 --chain intended \
  --resume-state <Q-MAIN-07-complete-state.json> --stop-after Q-MAIN-08 --out <dir> --json
```

The runner now records cadence-aware shelter observations, waits out a live salt storm rather than
using the former meaningless fixed 600-frame pause, and emits distinct names for death/respawn,
crater entry, inactive shelter predicate, crater exit, incomplete journey, and final approach.  It
also keeps long nonviolent travel crouched instead of sprinting into every streamed patrol.  Archon's
harbourmaster post moved from inside the solid guild-office footprint to the public side of its
production door; the next bounded rerun must establish the active-storm proof and then validate that
final approach.  Gates A-D and the aggregate remain incomplete and are not claimed here.

## 2026-08-12 continuation rerun

The current 70 m body-count-scaled detour was exercised from a newly produced Q-MAIN-07
checkpoint. It did not repeat the recorded pop-0119 death/respawn. The next first causal failure
occurred at Archon: production travel advanced the clock into the harbourmaster's `archon-inn`
schedule, and ordinary movement toward that interior's production door stopped against collision
12.38 m from the target. The active-storm shelter predicate and Q-MAIN-08 completion therefore
remain unproven; Gates A–C remain incomplete. The compact reproduction command and exact outcome
are recorded in the W1-19 production status; large traces remain transient under `/tmp`.

## 2026-08-12 Archon door repair and next causal failure

The scheduled harbourmaster diagnosis was confirmed against shipped data: Cuiro Vaneth is at his
public guild-office post from 07:00–19:00 and in `archon-inn` otherwise. The inn's fitted exterior
door is `[3811.296, 3.42, 3854.739]`; its public continuity spawn is
`[3812.296, 3.42, 3854.737]`, while the old runner targeted the pre-fit facade anchor
`[3809.47, 3.42, 3852.57]` inside collision. Scheduled entry now approaches the public continuity
spawn and only then uses the shipped 1.5 m interaction reach. The same production-input doorway
path also now retries an exterior press only after closing a legitimately opened nearby dialogue
surface; it never invokes the harness transition verb.

The next clean Q-MAIN-08 rerun did not reach Archon and is not claimed green. It ordinary-walked
2,136.2 m with zero teleports and zero defensive swings, then aborted `mired` at
`[2949.95, 0.255, 4760.84]`; the first causal defect was an encounter detour shoulder accepted at
0.621 m water depth. Candidate encounter shoulders are now restricted to at most 0.4 m water.
A wider speculative crater detour proved invalid from this Blackrose checkpoint and was rejected.
Active-storm shelter proof and Q-MAIN-08 production completion remain unestablished.
