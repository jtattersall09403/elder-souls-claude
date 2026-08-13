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

## 2026-08-12 production checkpoint and segment repair continuation

A provenance-valid compact `H.saveState()` fixture now preserves the production state after
Q-MAIN-01–07. Its manifest freezes the character, exact quest sets, pose, clock/weather, save and
harness schema, zero-violence/direct-mutation provenance, and hashes of quest, NPC, world-route and
save-schema inputs. `tools/quests/validate-mainline-checkpoint.mjs` fails closed before reuse when
any of those compatibility predicates changes.

The encounter shoulder planner now samples every inserted segment at no more than 2 m spacing and
checks live collision, water depth, terrain grade and encounter-body clearance. It evaluates both
sides and multiple shoulder radii. Where no single shoulder connects safely, a bounded 2 m grid
search finds a collision-free, <=0.4 m water route around the encounter and rejoins the authored
road. `--save-waypoint x,z --waypoint-state FILE` can capture the unmodified production save after
ordinary movement reaches a declared route-local point within 5 m of the planned route.

The first full checkpoint rerun after segment sampling correctly avoided the reported 0.621 m
shoulder. It exposed a successive failure: all one-waypoint alternatives around `pop-0026` were
unsafe, so the unchanged road remained live and the character later died/respawned. The connected
safe-grid fallback was implemented in response. Its syntax and fixture validation are green, but
the final long production rerun was interrupted before completion. Therefore the twelve-part
Q-MAIN-08 acceptance is **not claimed green** in this delivery and the production status remains
`INCOMPLETE_BUILDER_DEFECT`.

## 2026-08-12 GPU-machine handoff

Owner review established that an active salt storm and glassed-crater shelter exercise came from a
historical Q8 diagnostic, not from `orchestration/plans/W1-19.md` or its governing requirements.
Those extra acceptance clauses are no longer used to gate W1-19. Q8 remains responsible for its
canonical Blackrose–Lilmoth–Archon flow, legitimate doorway/schedule handling and player-facing
harbourmaster interaction.

The connected detour now evaluates production traversal semantics instead of treating the coastal
W3 carriageway as impassable. It rejects W4 water and the previously observed 0.621 m wet-SUCK
shoulder, permits only <=0.4 m wet SUCK, and records substrate in every segment sample. Encounter
clearance is based on the production 12–20 m per-body perception radii plus authored spawn offsets,
not a fictitious body-count-scaled 70 m exclusion disc.

From the ignored `archon-road-75.json` save, the bounded waypoint run reached
`[3221.9, 4360.2]`: 357.5 m ordinary movement, zero death/respawn, zero teleport, 486 mired frames
resolved by the shipped struggle input, 0.31 m worst off-path and a 12-frame longest stall. Its
ignored state is `reports/runs/W1-19-production/after-pop-0115.json`, SHA-256
`b966acbf618cd183351ed2c2cbf2e1475d4ebcd12d4cbd89982505fddd3ef1b0`. It has only 11.712/300 HP.
The immediate resume consumed three production flask inputs but then moved 0 m and aborted `stuck`
after 1,800 frames. That post-heal locomotion state is the first unresolved causal defect. The
ignored state and raw reports are machine-local and must be copied to a new host or regenerated;
no completed Q8, Gate A or Gate C claim is made.

## 2026-08-12 final-production Q-MAIN-08 milestone

Q-MAIN-08 is complete through player-facing production actions. Starting at the validated Q1â€“Q7
fixture, the Saxhleel/interior character continuously navigated to Archon without a death,
respawn, teleport, violent resolution, defensive swing, bought opening, direct progression
mutation, synthetic spawn, or topic/reveal hand-feed. The accepted route did not require or
manufacture a salt storm or crater visit. Shallow wet SUCK was crossed through the shipped
mire/struggle/refractory mechanic; W4 and the previously observed 0.621 m wet-SUCK shoulder
remain rejected.

The flask defect was a real input collision: `use_item` began the declared 130-frame heal and also
armed the legacy carried-writ modal, which then consumed locomotion. `use_item` is now exclusively
the production flask verb, and the writ remains player-readable through inventory navigation and
confirm input. The focused diagnostic proves 3/3 heals begin on frame 1, remain committed through
frame 130, return to IDLE on frame 131, clear every held/pressed/pending/buffered edge, open no
modal, and restore ordinary movement. See `q8-recovery-diagnostic.json`.

The road diagnosis proved pop-0119's authored four-body centre and shoreline made its 24 m
body-clearance disc topologically seal the only walkable causeway. The production population
consumer now derives a safe effective centre from the declared road, shipped
terrain/water/collision, 7 m spawn footprint, 35 m post envelope, and 24 m hard body clearance.
No post id, quest id, player pose, or progress flag participates.

The Q8 traversal reached Cuiro Vaneth at his actual 07:00â€“19:00 public schedule position, entered
`archon-guild-office` through its production doorway, read
`interior-readable:the-archon-true-manifest`, learned `rev_true_tonnage`, returned to the giver,
and completed `res_ask_the_crane` through the published conversation choice. Marker count was 0.

The canonical state is `fixtures/resume-saxhleel-interior-intended-q8.json`, SHA-256
`8dba7d1fd844f550f6d67c041fd416f95948a974d07b66eb7f2bf7602808c3ae`. Its manifest freezes
Q1â€“Q8 complete / no active quests, pose, clock, actual giver schedule, health/flasks, a
120-consecutive-frame production-valid stability window, zero-violence/direct-mutation
provenance, production runtime/instrument hashes, and exact reproduction.

```
node tools/quests/validate-mainline-checkpoint.mjs evidence/W1-19/q-main-08-checkpoint.manifest.json
# exit 0; Q-MAIN-01 through Q-MAIN-08 complete; active (none)

node tools/quests/mainline-checkpoint-control.mjs \
  --manifest evidence/W1-19/q-main-08-checkpoint.manifest.json \
  --out reports/runs/W1-19-production-gpu-root-lf/q8-checkpoint-control.json
# exit 0; both exact red rows observed; both restored green validations pass

node tools/quests/mainline-chain-floor.mjs --signature-count 1 --chain intended \
  --resume-state reports/runs/W1-19-production-gpu-root-lf/q8-complete-r6/resume-saxhleel-interior-intended.json \
  --stop-after Q-MAIN-08 --walk-max-frames 60000 \
  --out reports/runs/W1-19-production-gpu-root-lf/q8-complete-r7 \
  --chromium C:\PROGRA~1\Google\Chrome\Application\chrome.exe --timeout 1800000
# exit 0; 1/1 segment, Q8 complete, violent resolutions 0
```

This is a builder milestone, not an independent verdict. Q9 onward, the second chain/ending,
### Q-MAIN-09 production continuation

Q-MAIN-09 is complete as `res_hold_both` through Bel-Mourne at his actual 21:36 scheduled
location in `soulrest-grey-hist`. The sequential Q8-to-Q9 continuation walked 5.8 km through
production fixed-step locomotion with zero deaths, respawns, teleports, violent resolutions,
bought openings, direct quest mutation, topic/reveal hand-feeding or synthetic spawn. The stable
Q1-Q9 continuation state has SHA-256
`8b055184539d4a310907adbe617aa9d92a7a62c924d0c641ec51e6a740140c6d` and no active quest.

The causal loop repaired three defects rather than hiding them with a larger bound: save-loaded
population bodies now reconcile with the production placement consumer; two-body road posts use
the same per-body perception clearance as larger groups; and scheduled interior givers are routed
through their active authored schedule and canonical public doorway. The Grey Hist's former
08:00-19:00 hours contradicted Bel-Mourne's 19:00-00:00 tavern schedule and silently refused every
door input; it is now accessible for the full schedule. Compact exact results and commands are in
`q-main-09-production-summary.json`.

`route-detour-safety-control.json` records the final green/delete/restored-green control: changed
source hash, nine consumer calls, 110 support posts, four-body `pop-0119`, two-body `pop-0111`, and
live checkpoint migration for `pop-0115`. All three named rows go red only with the consumer
deleted and return green on restoration.

Gate A Q10 onward, Gate B/C builder populations, remaining controls, cold final chains and the
bounded aggregate remain open.

### Q-MAIN-10 / Act II production milestone

Q-MAIN-10 is complete as `res_hear_it_out` through Ashul-Tei at his actual daytime Helstrom
post. The continuous Q9-to-Q10 route was retained across two production-valid bounded saves:
the first segment consumed 6,388.1 m with zero stuck frames, and the second consumed 2,966 m
before exposing an authored giver post inside the fitted Undertemple footprint. Ashul-Tei's post
now uses the fitted doorway's public side; an idle NPC exactly at a superseded saved post migrates
to the current authored post on load, while walking, displaced and indoor NPCs remain untouched.

The accepted run reached Ashul-Tei at 0.97 m, accepted through the published conversation choice,
entered `helstrom-undertemple` by production input, read `the-stewards-letter` through the book
UI, exited, returned, and resolved through the player-facing choice. Q-MAIN-01 through
Q-MAIN-10 are complete, no quest is active, marker count is zero, and there were zero violent
resolutions, deaths, respawns, teleports, bought openings, synthetic spawns, or topic/reveal hand
feeds. The stable Act II fixture is
`fixtures/resume-saxhleel-interior-intended-act2.json`, SHA-256
`cae7a08111f73fc26d27c135bd933c806276abe41b9bb372a90bbfdd421ae226`.

The schedule/access audit now executes `SettlementSystem.isOpen` at 264 live half-hour samples
over 22 scheduled rows for all 13 mainline givers. Green has 0 inaccessible rows. Restoring the
old Grey Hist hours changes the source hash, produces the exact Bel-Mourne evening red row (six
rows red in total), and the restored tree returns to 0. The checkpoint tamper/stale control also
passes both exact red rows and restored green validation. `check-data`, `check-content`,
`check-quests`, strict corpus coherence, the 11-verb mutation-scanner self-test, and the played
trace production guard are green on this milestone tree.

This remains a builder milestone, not an independent verdict. Q11 onward, both complete endings,
Gate B/C builder populations, remaining controls, final cold chains and aggregate remain open.

### Q-MAIN-15 / Act III production milestone

Q-MAIN-11 through Q-MAIN-15 are complete through ordinary production movement, door/readable
actions and published conversation choices. The last segment waited 36,540 fixed production
frames for Sesh-Anaat's authored 07:00 exterior shift, then walked 16.8 m to her real post and
completed `res_heard_it`. The run recorded zero session deaths/respawns, teleports, violent
resolutions, bought openings, synthetic spawns, direct progression mutations or reveal hand-feeds.

The canonical Act III state is `fixtures/resume-saxhleel-interior-intended-act3.json`, SHA-256
`0bf35e4686b5ed9b335dffce52fd4f17818a641d6fd656d2dff820e491707acb`. It has Q1-Q15
complete, no active quest, marker count zero and a 120-frame stable window. Its single dead NPC,
Sesh-Weth, is the authored nonviolent consequence of the chosen Q12 full-test resolution; the
validator now compares NPC deaths to an exact manifest allow-list instead of conflating that
quest consequence with a violent resolution. Enemy deaths remain an unconditional rejection.

The final Thorn approach also exposed a presentation seam: after an interior-to-exterior schedule
transition, `listEntities` retained Sesh-Anaat's cell-local `[0.06,0,-0.03]` projection even though
the live schedule had correctly switched to exterior. The runner now uses the same actor record's
authored exterior post for navigation only; it never moves or respawns the actor. The final trace
reached `[3825.141495,13.28,878.848169]`, 1.18 m from the authored post.

This remains a builder milestone, not an independent verdict. Q16 onward, Q30, both endings and
the backpath, Gate B/C builder populations, remaining controls, cold chains and aggregate remain open.
