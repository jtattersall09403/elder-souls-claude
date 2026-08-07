# W1-19 — the main quest, end to end

**Builder report. Not a verdict.** Every number here is reproducible by the commands listed;
none of it is a claim about score.

## What was built

**"The Rootward Tide"** — 32 original main-quest quests, `Q-MAIN-01` … `Q-MAIN-32`, in
`game/data/quests/mainline-act1.json` … `mainline-act5.json` and `mainline-backpath.json`, with
`mainline.json` as the registry (acts, antagonist, mandate, endings, point of no return, and
RI-WLD09 §B3's `unanswered[]`).

Before this piece there was **no main quest**. Four quests carried `category: "main"` and were
magic-utility quests mislabelled by a generator's shorthand.

| | |
|---|---|
| Acts | 5 — 5 / 5 / 5 / 8 / 5 quests, plus 3 backpath and 1 aftermath, all `act: null` |
| Mean stakes by act | 2.40 → 3.60 → 7.60 → 8.50 → 10.00, strictly increasing |
| Setting | Black Marsh, 3E 427, the Rootward Tide failing (RI-LOR05 §6 cause **C** is authorially true) |
| Handler | Undersexton Aveline Rell, Drowned Court, Soulrest — pays in gold, tells the truth about facts and not about purposes |
| Mandate | the ninth clause of the Ninth Recension of the Drowned Tally. `D7`, `never_revealed: true`, **never adjudicated by any quest, book, NPC line or ending** |
| Antagonist | **Ixtu-Meer**, the Steward of the Count. Perceptible in Act I q2 as a sound under the Stone Wastes; named in Act II q1 in the fourth volume of a book he has been correcting for 300 years; in his own words in Act II q5 in a captured letter; met in Act V q3 |
| Endings | 6 — four from `Q-MAIN-28` (open / keep / kill / walk out), two from the backpath `Q-MAIN-31` |
| Point of no return | `Q-MAIN-27` `res_cross` — a stone sill, ankle high, worn in the middle |

## The trace: it completes, end to end, twice

```
node tools/quests/mainline-trace.mjs
```

```
  intended: 29 quests attempted, 29 completed, 158 journal entries
  backpath: 17 quests attempted, 17 completed,  95 journal entries
```

All 18 assertions pass. The run is in the browser, through the shipped `QuestEngine`, from
`loadState('arena_flat')` with **`setGold(0)` and no faction rank anywhere** — RI-QST06's
"completable while locked out of every faction, at higher cost".

| Assertion | Value |
|---|---|
| intended chain resolved | 29/29 |
| backpath chain resolved | 17/17 |
| quests resolved with violence | **0** on both chains |
| journal entries | 158 / 95, all dated, all first person |
| markers in the written journal | **0** |
| duplicate stage entries | **0** |
| point of no return crossed | true |
| Act III mark set and never cleared | true on both chains |
| world flags differing between the two ending states | **121** |
| ending flags reached | `ending_the_count_was_opened` vs `ending_the_count_went_past_the_roots`, disjoint |

The full journal, both chains, as prose: `mainline-journal.txt` (92 KB).

## The instrument can fail

Three sabotage controls, each of which must and does turn the run red:

| `--sabotage` | Stops at | Engine's own refusal |
|---|---|---|
| `drop-topic` | `Q-MAIN-01` | `the topic "the drowned tally" has not come up yet` |
| `drop-reveal` | `Q-MAIN-06` | `you do not know rev_the_curve_predates` |
| `drop-dispo` | `Q-MAIN-01` | `undersexton-aveline-rell disposition 0/25` |

`drop-reveal` gets five quests in before the knowledge gate bites, which is the shape you want:
the gate is real and it is not everywhere.

## Consumption

**The defect found, and it was the eighth of its kind in this project.** Every NPC record in
`game/data/npcs/**` carries a `disposition` field. **Nothing in the build read it.**
`gate.js canOffer()` checks `giver.disposition_min` against `sim.quest.dispositions`, which
started empty and was only ever written by a Charm effect or a quest's own consequences — so
**every quest in the build with a `disposition_min` above zero was unofferable from a cold
start**, including all thirty-two of these.

The fix is `Engine.seedDispositions()` (`game/src/engine.js`), called at boot and from
`_rebindQuestRuntime()` on every `reset()` / `loadState()`.

**Proved by perturbation, not asserted:** `--sabotage drop-dispo` zeroes the table through the new
`setDisposition()` harness verb and `Q-MAIN-01` immediately refuses to open, naming the number.

| Model shipped | World-side consumer | Perturbation proof |
|---|---|---|
| 32 quests in `mainline-*.json` | `QuestBook` → `QuestEngine` (`engine.js:236-271`); `tools/analysis/build-viability.mjs criterionMainQuest` now walks all 32 for every one of 540 character sheets | `drop-topic` / `drop-reveal` sabotages break the chain at the exact gate |
| 32 `entry_topics` rows in `hooks.json` | `QuestEngine._write()` seeds `sim.quest.topicsKnown` from a journal write; this is what chains Act I → Act II → … and opens all eight Act IV quests at once | the aftermath probe records `topic_was_already_known_from_the_ending`, i.e. that the hook fired before the probe seeded anything |
| 3 hooks incl. `mandate_void` → `adds_topics` | new branch in `QuestEngine.setFlag()`; without it `discovery: "consequence"` was a schema value nothing could produce | `Q-MAIN-30` opens from a world flag rather than from a giver |
| `game/data/npcs/mainline.json`, 37 records | `Engine.seedDispositions()` → `sim.quest.dispositions` → `gate.js canOffer()` | `drop-dispo` |
| `mainline.json` registry | `tools/quests/mainline-census.mjs`, `tools/experience/ponr-probe.mjs`, `tools/experience/ending-diff.mjs` all read it as the source of truth | changing `point_of_no_return.quest` moves `ponr_position_fraction` |

## Tools written (declared under `orchestration/TOOL-LOOP.md`)

RI-QST06's `## Comparison method` names eight `jq` blocks over `game/src/data/quests/*.json` —
**a path that does not exist and never has.** RI-EXP05 names four commands under
`tools/experience/`, **none of which existed** (corpus-index C8).

| Tool | Implements | Status |
|---|---|---|
| `tools/quests/mainline-census.mjs` | RI-QST06 §Comparison method, all eight blocks, plus RI-EXP05's static half and RI-WLD09 §B3 | **44 checks, 0 fails, exit 0** |
| `tools/quests/mainline-trace.mjs` | the end-to-end proof; both chains; three sabotage controls | **18 assertions, 0 fails** |
| `tools/experience/ponr-probe.mjs` | RI-EXP05 step 2, including the "walk back through it" clause | **7 checks, 0 fails** |
| `tools/experience/ending-diff.mjs` | RI-EXP05 step 3, world-flag and availability legs | 6 checks, 0 fails; **`npc_reaction_delta` declared unmeasurable, exit 3** |
| `tools/experience/aftermath-diff.mjs` | RI-EXP05 step 7 | 5 checks, 0 fails; 20 simulated minutes stepped, exit 3 |
| `tools/experience/ending-specificity.mjs` | RI-EXP05 step 4 | **exits 4 — reports the absence and never passes.** Needs `askTopic()`, `session-run.mjs` and the shared resolver |

The last two obey `TOOL-LOOP`'s rule for a tool that cannot be written honestly: they report the
absence and exit non-zero rather than being stubbed to pass.

## RI-QST06's own checks

```
node tools/quests/mainline-census.mjs
```

All 44 pass, including all five of the item's **hard fails**: Act I mean stakes 2.4; Act IV
sequenced-behind-itself = none; the mandate unadjudicated; a backpath present; **zero
`rank_gate`** anywhere in the mainline. Faction rank appears only in
`resolutions[].requires.faction_rank`, on seven of the eight Act IV quests, always beside at
least two routes that need no standing at all.

## Non-lethal

| Measure | Value |
|---|---|
| Mainline quests with ≥ 1 non-violent resolution | **32/32** |
| Mainline quests with an empty `kill_required_npcs` | **32/32** |
| Quests resolved with violence in either traced chain | **0** |
| Shipped-wide `PACIFIST-ALL` (`questVerbCensus`) | 100% over 69 quests — the engine's own note that 69 of ~180 is a property of the sample stands and is not quoted as a pass |

Two `violence_required: true` resolutions exist in the mainline and both are optional on quests
that have non-violent alternatives: `Q-MAIN-25 res_through_the_third_bay` (there is a corridor
round it that the inhabitants use) and `Q-MAIN-28 res_kill_him` (three of the four endings need
no violence at all).

## Side effects on other items' numbers

Adding 32 quests moved `tools/analysis/quest-audit.mjs`:

| Metric | Before | After | Bar |
|---|---|---|---|
| `X1_exclusive_pct` | 24.32 FAIL | **56.52 PASS** | ≥ 45% |
| `X2_quests_with_K2_or_higher` | 9 FAIL | **13 PASS** | ≥ 12 |
| `X7_cosmetic_pairs` | 0 | **0** | 0 |
| `X8_foreshadowed_pct` | 0 FAIL | **76.92** FAIL | ≥ 80% |
| `silent_failure_pct` | 31.58 HARDFAIL | **22.86** below | 5–15% |

`X7` went to 62 on the first pass — a regression this piece introduced — and was taken back to 0
by giving every exclusive resolution its own affected NPC, its own reward and at least three
distinct world flags. `X8`'s residual 23% is **nine pre-existing non-mainline quests**
(`Q-ARCH-01`, `Q-SOUL-02`, `Q-BLAK-01`, `Q-STRM-01`, `Q-LILM-01`, `Q-SAP-01`, `Q-LEDG-01`,
`Q-DOCK-01`, `Q-DEEP-01`); **30 of 30** mainline exclusive quests foreshadow their exclusivity in
first-person journal prose. Editing another builder's authored journal text was out of scope.

## Reproduce

```bash
node tools/harness/smoke.mjs                                  # the environment
node tools/quests/mainline-census.mjs                         # RI-QST06, static
node tools/quests/mainline-trace.mjs                          # the end-to-end proof
node tools/quests/mainline-trace.mjs --sabotage drop-dispo    # the instrument going red
node tools/experience/ponr-probe.mjs                          # RI-EXP05 step 2
node tools/experience/ending-diff.mjs                         # RI-EXP05 step 3
node tools/experience/aftermath-diff.mjs                      # RI-EXP05 step 7
node tools/analysis/quest-audit.mjs                           # RI-QST04 / RI-QST09
node tools/check-content.mjs                                  # the generator guard
```
