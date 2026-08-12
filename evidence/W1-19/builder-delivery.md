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
