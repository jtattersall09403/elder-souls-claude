# critic-w1-25 — measured output

Produced by `node tools/experience/critic-w1-25.mjs --out reports/experience/critic-w1-25.json` at `2026-08-08T04:36:34.992Z`, commit `fdef3d6`.

This markdown twin exists because `reports/.gitignore` excludes the JSON, and this verdict's
own §C finding is that a regression corpus which lives only on one container is not evidence.
`!**/*.md` is the exemption the gitignore already grants; the numbers below are the ones the
verdict cites, and they are here so a fresh clone still has them.

## Checks — 31/31 behaved as declared

| | check | got | declared |
|---|---|---|---|
| ok | A1  support = "effects examined" | `OK` | `OK` |
| ok | A2  support = "effects delivered" | `VACUOUS` | `VACUOUS` |
| ok | A3  support omitted | `OK` | `OK` |
| ok | A2-teardown  forge the control arm's support to 55 | `OK` | `OK` |
| ok | A4  both arms undefined | `INERT` | `INERT` |
| ok | A4-teardown  give the intact arm a real value | `OK` | `OK` |
| ok | B-OK | `OK` | `OK` |
| ok | B-INERT | `INERT` | `INERT` |
| ok | B-VACUOUS | `VACUOUS` | `VACUOUS` |
| ok | B-MASKED | `MASKED` | `MASKED` |
| ok | B-UNDERPOWERED | `UNDERPOWERED` | `UNDERPOWERED` |
| ok | B-WRONG_DIRECTION | `WRONG_DIRECTION` | `WRONG_DIRECTION` |
| ok | B-DISTINCT  six canonical cases produce six distinct verdicts | `6` | `6` |
| ok | B-COLLIDE-1  masked + under margin | `UNDERPOWERED` | `UNDERPOWERED` |
| ok | B-COLLIDE-2  cancellation | `INERT` | `INERT` |
| ok | B-COLLIDE-3  vacuous + inert | `VACUOUS` | `VACUOUS` |
| ok | B-COLLIDE-4  supportArms:"intact", support_note omitted | `OK` | `OK` |
| ok | B-COLLIDE-1-teardown  drop the margin | `MASKED` | `MASKED` |
| ok | B-COLLIDE-2-teardown  drop the cancelling factor | `OK` | `OK` |
| ok | B-COLLIDE-4-teardown  restore the default support scope | `VACUOUS` | `VACUOUS` |
| ok | C  w1-14-r3 nocast, support = delivered rows | `VACUOUS` | `VACUOUS` |
| ok | C-PROVENANCE  replayed artifacts NOT under version control | `9` | `9` |
| ok | C-AUTHENTIC  replayed numbers corroborated by tracked verdicts | `3` | `3` |
| ok | D  crossings with data that matrix-scan reported as having none | `4` | `4` |
| ok | D-PROBES  purpose-built crossing probes already on the tree | `true` | `true` |
| ok | D-teardown  the same search for a field that does not exist | `0` | `0` |
| ok | E1  the 36,000-frame session carries zero events | `0` | `0` |
| ok | E2  traces carrying substantive events (>5) | `true` | `true` |
| ok | E2b  event-bearing traces that predate the claim | `true` | `true` |
| ok | E3  consequence names missing from the closed vocabulary | `0` | `0` |
| ok | E4  mirror events carry no payload | `true` | `true` |

## Findings

### [major] A-NULL-IS-NOT-A-MEASUREMENT

A control whose measure() returns undefined or null in both arms is reported INERT — a positive claim that the break did nothing — rather than as a measurement that did not happen. `canon()` maps undefined, null and a missing field all to the string "null", so a misspelt field name produces the piece's flagship verdict. I hit this on my first run of section A against a real artifact.

**Evidence.** `{"A4":"INERT","A4_teardown":"OK","canon_of_undefined":"null"}`

**Remedy.** A NO_MEASUREMENT verdict (or reuse ERROR) when every arm's value canonicalises to "null". Three lines beside the existing support check, and it is the same argument the piece already makes for VACUOUS: a statement about an empty set is not a statement about the build.

### [major] A-VERDICT-IS-A-FUNCTION-OF-SUPPORT

The facility catches the strongest real inert control available (W1-14-r3 `--break=nocast`) ONLY IF the caller happens to declare `support` as delivered-rows rather than examined-rows, and not at all if the caller omits `support`. Two of the three honest readings pass it.

**Evidence.** `{"intact":"reports/w1-14-r3/dials.json","broken":"reports/w1-14-r3/dials-break-nocast.json","A1":"OK","A2":"VACUOUS","A3":"OK","teardown":"OK"}`

**Remedy.** `runControl` should REFUSE a spec whose measure() returns no `support` on any arm (throw, or force VERDICT.ERROR) exactly as it refuses a spec with no factors — `if (!factors.length) throw`. And the docstring's "number of units the measurement ranged over" needs the operative sentence: units that REACHED THE COMPARATOR, not units enumerated.

### [major] A-FOURTH-SHAPE-IS-NOT-IN-THE-TAXONOMY

W1-14-r3 is a FOURTH failure shape and the five verdicts have no name for it: the teardown short-circuits UPSTREAM of the mechanism under test, so the arms differ loudly and the difference is about the short-circuit. The facility's three documented shapes are arms-agree, no-single-factor-effect and empty-population; this one is none of them. It is caught, when it is caught, as a side effect of support accounting.

**Evidence.** `{"verdict_source":"corpus/90-verdicts/wave1/W1-14-r3.json gap inert_control:RI-MAG06"}`

**Remedy.** A sixth verdict — SHORT_CIRCUIT — triggered when the broken arm's support collapses relative to the intact arm (support_broken / support_intact below a declared floor, default 1.0 for a teardown that should not change the population). Cheap: the numbers are already on every arm record.

### [major] B-CASCADE-ORDER-HIDES-MASKED

MASKED is last in the verdict cascade and is therefore unreachable whenever the joint effect misses the declared margin or the direction. The one verdict in the taxonomy that exists to stop an agent deleting a guard in good faith is the one most easily shadowed.

**Evidence.** `{"case":"B-COLLIDE-1","got":"UNDERPOWERED","with_margin_dropped":"MASKED"}`

**Remedy.** Hoist the masking test above margin and direction — it is a statement about the structure of the effect, and margin/direction are statements about its size and sign. Or report a verdict LIST rather than a scalar, which the record already has all the fields for.

### [moderate] B-INERT-IS-DECIDED-ON-TWO-ARMS

`armsAgree` compares the intact arm against the all-broken arm and nothing else, so a control with a demonstrably live factor is reported INERT under cancellation, with a `why` string that asserts the opposite of the record's own `factor_effects`.

**Evidence.** `{"case":"B-COLLIDE-2","verdict":"INERT","moves_alone":["a"]}`

**Remedy.** armsAgree should be `distinct_values === 1` — no arm differs from any other — which is already computed one line above it and is the honest reading of "the arms agree".

### [moderate] B-SUPPORT-NOTE-UNENFORCED

The documented obligation on `supportArms: "intact"` ("a caller that narrows it must say why, in support_note") is enforced nowhere and `support_note` is not even copied into the result, so the W1-13 failure the facility was built for is one spec key away from passing, unauditably.

**Evidence.** `{"case":"B-COLLIDE-4","got":"OK","with_default_scope":"VACUOUS"}`

**Remedy.** Three lines: throw when `supportArms === "intact"` and `support_note` is empty, and carry `support_note` and `support_scope` onto the result so a report can list every control that opted out.

### [major] C-REGRESSION-CORPUS-IS-UNTRACKED

--cases 8/8 is real — every number is corroborated by an independently tracked verdict (252/342 in W1-SOULS-r3.json, 67->0 in W1-04-r3.md, roster_n 0 in W1-13-r4.md) — but all 9 artifacts it replays are excluded by reports/.gitignore. On a fresh clone --cases reports ABSENT and exits 8. The regression corpus that makes this facility evidence rather than assertion survives only as long as this container does.

**Evidence.** `{"untracked":["reports/w1-04-r3-collision.json","reports/critic-souls-r3-INTACT.json","reports/critic-souls-r3-DELETED-identity.json","reports/critic-souls-r3-DELETED-boundary.json","reports/critic-souls-r3-DELETED-identity-boundary.json","reports/runs/W1-13-R4/clock-consequences.json","reports/journeys/w1-13-r4-jrn06/journey.json","reports/w1-14-r3/dials.json","reports/w1-14-r3/dials-break-nocast.json"],"gitignore":"reports/.gitignore"}`

**Remedy.** reports/.gitignore already carries the exemption and the exact argument for it — `!**/*baseline*.json`, added because "a baseline exists to be yesterday's, so regenerating it destroys the only thing it was for." These nine files are baselines by that definition and cannot be regenerated at all: the pre-fix `__w1_04_townSolids` and the two deleted souls guards do not exist at HEAD. Add `!**/sabotage-case-*.json`, copy the nine under that name, and point sabotage-cases.mjs at the copies. Under 100 KB.

### [critical] D-THE-4-OF-41-IS-A-PROPERTY-OF-THE-SCANNER

The piece's most consequential number is wrong and wrong in the direction that condemns other pieces. At least 8 of 41 crossings are data-backed, not 4. The four missed — QST->ROS, WLD->ROS, DIS->ROS, LOR->ROS — all sit in game/data/world/encounters.json, which contributed zero of the tool's 30 claims because every one of matrix-scan.mjs's 56 patterns is rooted in the SOURCE system's directory and these couplings are declared on the TARGET's. Two of them (absent_when_flag, true_name_topic) are the exact crossings ARBITRATION AR-3 names as its worked examples, and QST->ROS was built deliberately by W1-19 round 2 to answer a seam_sterile verdict, with a probe on the tree to demonstrate it.

**Evidence.** `{"rows":[{"cell":"QST->ROS","file":"game/data/world/encounters.json","key":"absent_when_flag","why":"Q-MAIN-23 res_sign_the_clause sets the_sixty_are_protected; the net-throwers of dres-raid-party carry absent_when_flag on it. ARBITRATION AR-3 names this crossing in as many words: \"a quest whose resolution changes an encounter's composition\".","occurrences":1,"sample":[{"pointer":"/encounters/0/members/1/absent_when_flag","value":"the_sixty_are_protected"}],"reported_as_no_data":true,"missed_by_the_tool":true},{"cell":"WLD->ROS","file":"game/data/world/encounters.json","key":"absent_when_flag","why":"the same field read as world-state -> roster: a world flag removes two bodies from a spawn.","occurrences":1,"sample":[{"pointer":"/encounters/0/members/1/absent_when_flag","value":"the_sixty_are_protected"}],"reported_as_no_data":true,"missed_by_the_tool":true},{"cell":"DIS->ROS","file":"game/data/world/encounters.json","key":"hostile_below_disposition","why":"an encounter that is hostile only below a disposition threshold.","occurrences":1,"sample":[{"pointer":"/encounters/1/hostile_below_disposition","value":15}],"reported_as_no_data":true,"missed_by_the_tool":true},{"cell":"LOR->ROS","file":"game/data/world/encounters.json","key":"true_name_topic","why":"knowing a lore topic opens a parley on an encounter — ARBITRATION AR-3's \"a lore fact that is also a boss's weakness\", twice (the-sallow-wife, the-twin-lamps).","occurrences":2,"sample":[{"pointer":"/encounters/0/parley/true_name_topic","value":"the-sallow-wife"},{"pointer":"/encounters/1/parley/true_name_topic","value":"the-twin-lamps"}],"reported_as_no_data":true,"missed_by_the_tool":true}],"existing_probes":["tools/quests/encounter-seam-probe.mjs","tools/quests/critic-ar3-endtoend.mjs","tools/quests/faction-seam-probe.mjs","tools/world/crossing-consumption.mjs","tools/world/crossing-deletefix.mjs"],"encounters_claims_from_that_file":0,"files_read":564}`

**Remedy.** matrix-scan needs target-side patterns. Four lines against one file closes half the error: world/encounters.json at `members[].absent_when_flag` -> QST->ROS and WLD->ROS, at `hostile_below_disposition` -> DIS->ROS, at `parley.true_name_topic` -> LOR->ROS. Then the tool needs the check it does not have: an inventory of every existing tools/**/*seam*.mjs and crossing*.mjs, so a crossing another piece already DEMONSTRATED cannot be reported as having no data.

### [note] D-SHAPE-OF-THE-REAL-ABSENCE

The 37 no-data crossings are not scattered: every one has ROS (roster) or BOS (boss) as its source or its target, plus two DUN and two SCH. The finding worth publishing is not a count, it is that the enemy roster and the bosses are the seam-dead systems and everything else touches something. The piece reported the count.

**Evidence.** `{"no_data_cells":["FAC->ROS","FAC->BOS","DIS->ROS","GLD->ROS","GLD->BOS","SKL->ROS","SKL->BOS","SPL->BOS","LOR->ROS","LOR->BOS","STL->ROS","STL->BOS","QST->ROS","QST->BOS","WLD->ROS","WLD->BOS","TOD->ROS","TOD->BOS","WEA->ROS","WEA->BOS","EQP->ROS","EQP->BOS","UPG->BOS","ROS->FAC","ROS->DIS","ROS->QST","ROS->SCH","BOS->FAC","BOS->DIS","BOS->LOR","BOS->QST","BOS->WLD","BOS->SCH","DUN->ROS","DUN->BOS","SCH->ROS","SCH->BOS"]}`

**Remedy.** State it that way in reports/composition/w1/stage1.md; it survives the scanner being wrong about any individual cell, and it is directly actionable.

### [moderate] E-THE-CLAIM-OVERSTATES

The narrow claims are true and load-bearing: the one recorded session is 36,000 frames with zero events, and the journey traces carry five boot events each. The generalisation is not. Five traces on this tree carry 493-553 events across 24-28 kinds including hit, stagger, block_success, death and detect. "verified_anecdotes_per_hour is 0 by construction on every trace this project has ever recorded" is false as written, and it matters because it points the remedy at the recorder instead of at the fixture.

**Evidence.** `{"traces":77,"with_events":34,"top":[{"file":"reports/w1-09/exemplar/RI-CMB07-exemplar-F2-trace.jsonl","events":553,"kinds":24},{"file":"reports/w1-09/exemplar/RI-CMB07-exemplar-F4-trace.jsonl","events":548,"kinds":24},{"file":"reports/w1-09/exemplar/RI-CMB07-exemplar-F3-trace.jsonl","events":530,"kinds":28},{"file":"reports/w1-09/exemplar/RI-CMB07-exemplar-F5-trace.jsonl","events":514,"kinds":24},{"file":"reports/w1-09/exemplar/RI-CMB07-exemplar-F1-trace.jsonl","events":493,"kinds":24},{"file":"reports/journeys/20260808T035412Z-jrn01-opening-s4711-991eea/trace.jsonl","events":145,"kinds":15}]}`

**Remedy.** Restate as: no SESSION or JOURNEY run has ever produced a consequence event, while combat exemplars produce hundreds. Then the diagnosis follows — RULES #8, a still target. The session script walks and never fights, talks, takes or dies.

### [major] E-FAULT-IS-THE-FIXTURE-NOT-THE-RECORDER

Fault located, against the three candidates the brief names. NOT the recorder: the same trace writer emits 553 events in the combat exemplars. NOT the vocabulary: all 179 names are present and every consequence name an anecdote needs is in the list, so RULES #15 does not bite. It is the session fixture — a ten-minute run that never enters combat, opens dialogue, writes a journal entry or picks anything up, which is RULES #8 exactly.

**Evidence.** `{"recorder_proof":["reports/w1-09/exemplar/RI-CMB07-exemplar-F2-trace.jsonl","reports/w1-09/exemplar/RI-CMB07-exemplar-F4-trace.jsonl","reports/w1-09/exemplar/RI-CMB07-exemplar-F3-trace.jsonl","reports/w1-09/exemplar/RI-CMB07-exemplar-F5-trace.jsonl","reports/w1-09/exemplar/RI-CMB07-exemplar-F1-trace.jsonl","reports/journeys/20260808T035412Z-jrn01-opening-s4711-991eea/trace.jsonl","reports/journeys/20260808T035138Z-jrn01-opening-s4711-8ecb6a/trace.jsonl","reports/journeys/w1-13-r3b-jrn06/trace.jsonl","reports/journeys/w1-13-r3-jrn06/trace.jsonl","reports/journeys/w1-26-r2-jrn01/trace.jsonl","reports/journeys/20260808T035032Z-jrn01-opening-s4711-614a31/trace.jsonl","reports/journeys/w1-13-r4-jrn06/trace.jsonl","reports/journeys/20260807T143230Z-jrn06-death-s4711-05c04d/trace.jsonl","reports/journeys/20260807T143410Z-jrn06-death-s4711-9f8ece/trace.jsonl","reports/journeys/critic-w1-13-r2-jrn06/trace.jsonl","reports/journeys/20260807T141242Z-jrn06-death-s4711-a0b76b/trace.jsonl","reports/journeys/20260807T141554Z-jrn06-death-s4711-104fdb/trace.jsonl","reports/runs/20260806T173713Z-cmb-duel-infantry-s1337-2fdbe4/trace.jsonl","reports/runs/20260806T185158Z-cmb-duel-infantry-s1337-641abf/trace.jsonl","reports/runs/20260806T185213Z-cmb-duel-infantry-s1337-3e9ae1/trace.jsonl","reports/runs/20260806T121249Z-cmb-duel-infantry-s1337-f0ddc1/trace.jsonl","reports/runs/20260806T140706Z-cmb-duel-infantry-s1337-9b3390/trace.jsonl","reports/runs/CRIT-DET-A/trace.jsonl","reports/runs/CRIT-DET-B/trace.jsonl","reports/runs/CRIT-DET-S4242/trace.jsonl","reports/runs/DET-A/trace.jsonl","reports/runs/DET-B/trace.jsonl","reports/runs/DET-C/trace.jsonl","reports/runs/DET-SEED/trace.jsonl","reports/runs/20260806T172919Z-cmb-duel-infantry-s1337-727f51/trace.jsonl","reports/runs/20260806T161403Z-cmb-duel-infantry-s1337-0c67a7/trace.jsonl","reports/runs/20260806T164412Z-cmb-duel-infantry-s1337-5b7475/trace.jsonl","reports/runs/ar3-khajiit/trace.jsonl","reports/runs/ar3-saxhleel/trace.jsonl"],"vocabulary_size":179,"missing_consequence_names":[]}`

**Remedy.** The cheapest real number in this whole piece: point tools/experience/anecdote-trace.mjs at reports/w1-09/exemplar/RI-CMB07-exemplar-F3-trace.jsonl. It has a death, six staggers, a guard break and a block_success in 9,000 frames. It will score low on A2 (proper noun) and A4 (locatable) because it is an arena, and THAT is the finding RI-EXP02 wants — a build whose only recorded consequences happen in a room with no name.

## Trace census (§E)

`12` shown of the traces on the tree; `34` carry more than five events; vocabulary size `179`; payload-free mirror events in the top exemplar `275`.

| frames | events | kinds | file |
|---:|---:|---:|---|
| 9000 | 553 | 24 | `reports/w1-09/exemplar/RI-CMB07-exemplar-F2-trace.jsonl` |
| 9000 | 548 | 24 | `reports/w1-09/exemplar/RI-CMB07-exemplar-F4-trace.jsonl` |
| 8945 | 530 | 28 | `reports/w1-09/exemplar/RI-CMB07-exemplar-F3-trace.jsonl` |
| 9000 | 514 | 24 | `reports/w1-09/exemplar/RI-CMB07-exemplar-F5-trace.jsonl` |
| 9000 | 493 | 24 | `reports/w1-09/exemplar/RI-CMB07-exemplar-F1-trace.jsonl` |
| 245 | 145 | 15 | `reports/journeys/20260808T035412Z-jrn01-opening-s4711-991eea/trace.jsonl` |
| 225 | 124 | 9 | `reports/journeys/20260808T035138Z-jrn01-opening-s4711-8ecb6a/trace.jsonl` |
| 201 | 124 | 9 | `reports/journeys/w1-13-r3b-jrn06/trace.jsonl` |
| 131 | 123 | 8 | `reports/journeys/w1-13-r3-jrn06/trace.jsonl` |
| 201 | 122 | 9 | `reports/journeys/w1-26-r2-jrn01/trace.jsonl` |
| 201 | 121 | 9 | `reports/journeys/20260808T035032Z-jrn01-opening-s4711-614a31/trace.jsonl` |
| 201 | 120 | 9 | `reports/journeys/w1-13-r4-jrn06/trace.jsonl` |

## Crossings recount (§D)

| cell | field | occurrences | matrix-scan said no data |
|---|---|---:|---|
| `QST->ROS` | `absent_when_flag` | 1 | true |
| `WLD->ROS` | `absent_when_flag` | 1 | true |
| `DIS->ROS` | `hostile_below_disposition` | 1 | true |
| `LOR->ROS` | `true_name_topic` | 2 | true |

Existing seam/crossing probes on the tree, none cited by W1-25: `tools/quests/encounter-seam-probe.mjs`, `tools/quests/critic-ar3-endtoend.mjs`, `tools/quests/faction-seam-probe.mjs`, `tools/world/crossing-consumption.mjs`, `tools/world/crossing-deletefix.mjs`.

## The same control, three support declarations (§A)

| arm | verdict |
|---|---|
| `A1 support = effects examined (55 / 55)` | **`OK`** |
| `A2 support = effects delivered  (55 / 0)` | **`VACUOUS`** |
| `A3 support not declared at all` | **`OK`** |
| `A2-teardown support forged to 55 in the control arm` | **`OK`** |

