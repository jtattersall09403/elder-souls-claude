# Coverage matrix — inventory on disk → proposed roadmap items

> **GENERATED.** Regenerate with `node tools/roadmap-coverage.mjs`.
> Canonical data: `orchestration/status/ROADMAP-COVERAGE-AUDIT.coverage.json`. Narrative: `reports/roadmap-audit/AUDIT.md`.
> Generated 2026-08-15T08:50:29.592Z against baseline `dd222b7951a6d0564c992bb6d39b783f0f293188`.

| inventory | n | uncovered |
|---|---:|---:|
| reference items (`corpus/**/RI-*.md`) | 151 | 0 |
| plans (`orchestration/plans/*`) | 49 | 0 |
| open gaps (`GAP-LEDGER.json`) | 82 | 0 |
| proposed roadmap items | 69 | — |

## Proposed items

### Ring 0 — Instruments — how we know anything. Continuous; never "finished".

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `I1` | The harness and determinism | RI-CMB07 RI-MTH01 RI-MTH02 | — | 5 (4) | W1-00 | built_below_bar | **none** |
| `I2` | Capture and the Deck | RI-MTH04 RI-MTH06 | RI-MTH06 | 2 (1) | W1-30-EVIDENCE W1-30V | built_below_bar | V17 |
| `I4` | Consumption as a gate | RI-MTH07 | — | 5 (3) | BUILDER-EXECUTION-CONTRACT | built_below_bar | **none** |
| `I5` | The corpus audited and extended | RI-VIS02 RI-VIS09 RI-VIS10 RI-MTH05 RI-MTH06 | RI-VIS09 RI-MTH05 RI-MTH06 | 0 (0) | — | built_below_bar | F3 |
| `I3` | The blind protocols | RI-DLG07 RI-VIS01 RI-VIS03 RI-VIS06 RI-MTH03 | RI-DLG07 RI-VIS01 | 2 (1) | W1-24 | built_below_bar | V17/F2 |

### Ring 1 — The frame — what a rendered pixel looks like. Wave 1 by owner directive.

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `G1` | The camera | RI-CMB06 RI-CAM01 RI-CAM02 RI-CAM03 RI-CAM04 RI-CAM05 RI-CAM06 RI-CAM07 | RI-CAM03 RI-CAM04 | 0 (0) | W1-06 | built_below_bar | **none** |
| `F1` | Materials and surface response | — | — | 3 (2) | W1-30 W1-30C W1-30S | planned_unjudged | V1 |
| `F2` | Shadow, contact and ambient occlusion | RI-VIS03 RI-VIS04 | — | 0 (0) | W1-30 W1-30A W1-30B W1-30S | at_bar | V2 |
| `F3` | Ambient and bounce fill | RI-VIS03 RI-VIS04 | — | 0 (0) | W1-30 W1-30B W1-30S | at_bar | V3 |
| `F4` | Light, sky and atmosphere | RI-VIS04 | — | 1 (0) | W1-30 W1-30B W1-30S | built_below_bar | V4/V12 |
| `F5` | The frame pipeline | RI-VIS04 | — | 0 (0) | W1-30 W1-30A W1-30S | at_bar | V5 |
| `F6` | Terrain and vegetation surfaces | RI-WLD15 RI-WLD16 | RI-WLD15 RI-WLD16 | 0 (0) | W1-30 W1-30F | planned_unjudged | V9/V10 |
| `F7` | The water surface | RI-WLD10 | — | 1 (1) | W1-03 W1-30 W1-30H | built_below_bar | V11 |
| `F8` | The building kit and settlement silhouette | RI-WLD14 | — | 1 (1) | W1-30-LIBRARY W1-30 W1-30E | built_below_bar | V8 |
| `F9` | Interiors and practical light | RI-STL01 | — | 1 (1) | W1-30 W1-30G | built_below_bar | partial:V4 |
| `F10` | Characters and creatures | RI-CAM07 RI-VIS08 RI-VIS10 | — | 3 (2) | W1-24 W1-30-LIBRARY W1-30 W1-30D | built_below_bar | V6 |
| `F11` | Animation quality | RI-WPN05 RI-VIS08 | — | 1 (1) | W1-30 W1-30D | built_below_bar | V7 |
| `F12` | VFX and particles | RI-MAG05 | — | 1 (0) | W1-30 W1-30H | built_below_bar | V13 |
| `F13` | Art direction and region identity | RI-WLD04 RI-VIS05 RI-VIS07 RI-UIX06 | RI-VIS05 | 1 (1) | W1-30 W1-30K | built_below_bar | V15 |
| `F14` | Performance, LOD and budgets | RI-PLT01 | — | 0 (0) | W1-30 | built_below_bar | V16 |
| `T4` | The Morrowind screens | RI-UIX03 RI-UIX04 RI-UIX06 RI-UIX07 RI-UIX08 RI-UIX09 | — | 5 (4) | W1-21 W1-HUD-TOAST | built_below_bar | partial:V14 |

### Ring 2 — The body, the camera and the fight — Souls owns everything in here.

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `T1` | Save and load | RI-JRN05 | — | 5 (4) | W1-00 | built_below_bar | E2 |
| `T2` | Controls and discoverability | RI-CMB11 RI-JRN03 RI-JRN04 | — | 2 (0) | W1-08 W1-29 | built_below_bar | E3 |
| `G4` | Enemies that can fight you | RI-AI01 RI-AI02 RI-AI03 RI-AI04 RI-AI05 | RI-AI04 | 2 (2) | W1-09 W1-12 | built_below_bar | partial:Step5 |
| `G2` | The exchange | RI-CMB01 RI-CMB02 RI-CMB03 RI-CMB04 RI-CMB05 RI-CMB06 RI-CMB11 RI-PRG07 RI-MAG01 | — | 2 (1) | W1-09 | built_below_bar | partial:C3 |
| `G3` | Weapons and movesets, wired | RI-CMB02 RI-WPN01 RI-WPN02 RI-WPN03 RI-WPN04 RI-WPN05 RI-WPN06 RI-WPN07 | — | 3 (3) | W1-10 W1-11 | built_below_bar | C2 |
| `G5` | Bosses and encounter authorship | RI-AI06 RI-AI07 | RI-AI06 | 1 (0) | W1-12 | built_below_bar | C4/C7 |
| `G6` | Combat HUD and impact feedback | RI-UIX01 RI-AUD01 | — | 1 (0) | W1-11 W1-21 W1-HUD-TOAST | built_below_bar | **none** |
| `G7` | How the fight feels | RI-CMB07 RI-CMB12 RI-DLG09 | RI-CMB12 | 1 (1) | W1-08 | built_below_bar | Step5/C6 |
| `G8` | Healing, status and exhaustion | RI-CMB08 RI-CMB09 RI-CMB10 | RI-CMB08 RI-CMB10 | 0 (0) | — | built_below_bar | **none** |

### Ring 3 — The world you can navigate by prose — the substrate B-side quests stand on.

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `W1` | Terrain form and the road network | RI-WLD01 RI-WLD16 | RI-WLD16 | 3 (2) | W1-01 | built_below_bar | partial:D1 |
| `W2` | Regions that read differently on foot | RI-WLD04 RI-WLD12 | — | 2 (2) | W1-01 W1-02 | built_below_bar | D1 |
| `W3` | Variety within a region | RI-WLD02 RI-WLD15 | RI-WLD02 RI-WLD15 | 0 (0) | W1-27 | planned_unjudged | D4 |
| `W4` | Settlements with an outside | RI-WLD03 | — | 2 (2) | W1-04 | built_below_bar | Step2b/2c |
| `W5` | Doors, interiors and continuity | RI-WLD13 | — | 4 (4) | W1-04 | built_below_bar | Step2/2b |
| `W6` | Legibility — landmarks and prose directions | RI-WLD06 | — | 0 (0) | W1-05 | at_bar | D2 |
| `W7` | Getting around | RI-TRV01 RI-TRV02 | RI-TRV02 | 0 (0) | W1-01 W1-05 | at_bar | **none** |
| `W8` | Dungeons, xanmeers and ruins | RI-WLD07 | — | 0 (0) | — | at_bar | D3 |
| `W9` | Water and hazards as play | RI-WLD10 RI-WLD11 | — | 1 (1) | W1-03 | built_below_bar | partial:V11 |
| `W10` | The living world | RI-WLD08 | — | 2 (0) | W1-13 | built_below_bar | B4/D5 |
| `W11` | Strangeness and the built alienness | RI-WLD05 RI-WLD09 RI-WLD14 | — | 0 (0) | W1-02 | built_below_bar | B10 |

### Ring 4 — The character and the economies — what you become and what it costs.

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `C1` | Character creation as a played scene | RI-CHR01 RI-CHR02 RI-CHR03 | — | 5 (4) | W1-07 W1-26 | built_below_bar | **none** |
| `C2` | Levelling and the hearth | RI-PRG01 RI-PRG02 RI-PRG03 RI-PRG04 RI-PRG06 | — | 5 (2) | W1-13 W1-16 | built_below_bar | B8 |
| `C3` | Load, inventory and upgrades | RI-PRG07 RI-PRG08 RI-UIX03 | RI-PRG08 | 2 (2) | W1-16 | built_below_bar | **none** |
| `C4` | Gold | RI-PRG05 | RI-PRG05 | 1 (1) | W1-05 W1-16 | planned_unjudged | B6 |
| `C5` | Affliction and disease | RI-CMB10 RI-PRG09 | RI-CMB10 RI-PRG09 | 0 (0) | — | not_started | **none** |
| `C6` | Magic that does what it says | RI-MAG01 RI-MAG02 RI-MAG03 RI-MAG04 RI-MAG06 RI-TRV02 | RI-TRV02 | 3 (3) | W1-14 | built_below_bar | B7 |
| `C7` | Stealth and theft | RI-STL01 RI-STL02 | — | 3 (3) | W1-15 | built_below_bar | partial:B5 |
| `C8` | Crime and justice | RI-CRM01 RI-CRM02 | — | 2 (2) | W1-15 | built_below_bar | B5 |

### Ring 5 — People, words and quests — the Morrowind half proper.

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `P1` | The topic web and the dialogue window | RI-DLG01 RI-UIX08 | — | 2 (2) | W1-17 W1-DLG-TOPIC-WEB | built_below_bar | Step3 |
| `P2` | Voice, disposition and persuasion | RI-DLG02 RI-DLG03 RI-DLG04 RI-DLG06 RI-DLG07 RI-DLG08 | RI-DLG04 RI-DLG07 RI-DLG08 | 2 (1) | W1-17 | built_below_bar | Step3 |
| `P3` | The journal | RI-DLG05 RI-UIX02 RI-UIX04 | RI-DLG05 | 1 (1) | W1-18 | built_below_bar | B1 |
| `P4` | Books and readables with a reader | RI-LOR03 RI-UIX05 | — | 3 (2) | — | built_below_bar | B9 |
| `P5` | Lore, canon and names | RI-LOR01 RI-LOR02 RI-LOR04 RI-LOR05 RI-LOR06 RI-LOR07 RI-LOR08 | RI-LOR07 RI-LOR08 | 3 (1) | W1-23 | built_below_bar | partial:B9 |
| `P6` | A quest end to end without markers | RI-QST04 RI-JRN07 | RI-JRN07 | 0 (0) | W1-18 | at_bar | B2 |
| `P7` | Quest givers who exist, and ladders that open | RI-QST03 | — | 4 (4) | W1-20 | built_below_bar | Step4 |
| `P8` | Factions with real ladders | RI-CRM02 RI-QST01 RI-QST03 | — | 1 (1) | W1-20 | built_below_bar | B3 |
| `P9` | The main quest | RI-QST06 | — | 2 (2) | W1-19 | built_below_bar | **none** |
| `P10` | Quest texture and consequence | RI-MAG04 RI-QST02 RI-QST05 RI-QST07 RI-QST08 RI-QST09 RI-DLG09 | RI-QST09 | 0 (0) | W1-18 W1-27 | built_below_bar | partial:B2 |

### Ring 6 — The platform — save, input, performance, screens.

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `T3` | Load, streaming and budgets | RI-PLT01 RI-PLT02 RI-PLT03 RI-AUD02 | RI-PLT02 | 2 (1) | W1-00 | built_below_bar | E4 |

### Ring 7 — The whole thing — judged as an experience, end to end.

| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |
|---|---|---|---|---|---|---|---|
| `E1` | The opening | RI-JRN01 RI-JRN09 RI-EXP01 | — | 1 (1) | W1-07 W1-26 | built_below_bar | E1 |
| `E2` | The first hour as interaction | RI-JRN02 | RI-JRN02 | 0 (0) | W1-28 | planned_unjudged | partial:E1 |
| `E3` | Death and recovery | RI-PRG04 RI-JRN06 | — | 0 (0) | W1-13 | at_bar | C5 |
| `E4` | Cross-system payoff and emergence | RI-CMP01 RI-CMP02 RI-EXP06 | RI-CMP02 | 1 (1) | W1-25 | built_below_bar | **none** |
| `E5` | Build identity | RI-CMP03 | RI-CMP03 | 0 (0) | — | not_started | **none** |
| `E6` | Session shape and pacing | RI-EXP02 RI-EXP03 RI-EXP04 | RI-EXP04 | 0 (0) | — | built_below_bar | **none** |
| `E7` | Endings and the last hour | RI-EXP05 | — | 0 (0) | — | built_below_bar | **none** |
| `E8` | Returning after a week | RI-JRN08 | RI-JRN08 | 0 (0) | — | not_started | E2 |
| `E9` | Sound | RI-AUD02 RI-AUD03 RI-AUD04 RI-AUD05 | RI-AUD04 RI-AUD05 | 3 (1) | W1-22 | built_below_bar | E5 |

## Reference items — every id, its home, and its judged state

| id | area | side | covered by | judged | best 0-10 | state |
|---|---|---|---|---:|---:|---|
| `RI-AI01` | 10-combat | souls | G4 | 4 | 6 | judged_at_or_above_bar |
| `RI-AI02` | 10-combat | souls | G4 | 2 | 5 | judged_below_bar |
| `RI-AI03` | 10-combat | souls | G4 | 2 | 4 | judged_below_bar |
| `RI-AI04` | 10-combat | souls | G4 | 0 | — | never_judged |
| `RI-AI05` | 10-combat | souls | G4 | 5 | 4 | judged_below_bar |
| `RI-AI06` | 10-combat | souls | G5 | 0 | — | never_judged |
| `RI-AI07` | 10-combat | souls | G5 | 6 | 8 | judged_at_or_above_bar |
| `RI-CMB01` | 10-combat | souls | G2 | 5 | 7 | judged_at_or_above_bar |
| `RI-CMB02` | 10-combat | souls | G2 G3 | 3 | 6 | judged_at_or_above_bar |
| `RI-CMB03` | 10-combat | souls | G2 | 3 | 6 | judged_at_or_above_bar |
| `RI-CMB04` | 10-combat | souls | G2 | 3 | 6 | judged_at_or_above_bar |
| `RI-CMB05` | 10-combat | souls | G2 | 3 | 4 | judged_below_bar |
| `RI-CMB06` | 10-combat | souls | G1 G2 | 3 | 3 | judged_below_bar |
| `RI-CMB07` | 10-combat | souls | I1 G7 | 5 | 3 | judged_below_bar |
| `RI-CMB08` | 10-combat | souls | G8 | 0 | — | never_judged |
| `RI-CMB09` | 10-combat | souls | G8 | 3 | 3 | judged_below_bar |
| `RI-CMB10` | 10-combat | split | G8 C5 | 0 | — | never_judged |
| `RI-CMB11` | 10-combat | souls | G2 T2 | 3 | 3 | judged_below_bar |
| `RI-CMB12` | 10-combat | souls | G7 | 0 | — | never_judged |
| `RI-WPN01` | 12-weapons | souls | G3 | 3 | 6 | judged_at_or_above_bar |
| `RI-WPN02` | 12-weapons | souls | G3 | 3 | 3 | judged_below_bar |
| `RI-WPN03` | 12-weapons | souls | G3 | 3 | 6 | judged_at_or_above_bar |
| `RI-WPN04` | 12-weapons | souls | G3 | 3 | 7 | judged_at_or_above_bar |
| `RI-WPN05` | 12-weapons | souls | G3 F11 | 4 | 4 | judged_below_bar |
| `RI-WPN06` | 12-weapons | souls | G3 | 3 | 7 | judged_at_or_above_bar |
| `RI-WPN07` | 12-weapons | souls | G3 | 1 | 0 | judged_below_bar |
| `RI-CAM01` | 15-camera | souls | G1 | 1 | 2 | judged_below_bar |
| `RI-CAM02` | 15-camera | souls | G1 | 4 | 4 | judged_below_bar |
| `RI-CAM03` | 15-camera | souls | G1 | 0 | — | never_judged |
| `RI-CAM04` | 15-camera | souls | G1 | 0 | — | never_judged |
| `RI-CAM05` | 15-camera | souls | G1 | 5 | 6 | judged_at_or_above_bar |
| `RI-CAM06` | 15-camera | souls | G1 | 3 | 4 | judged_below_bar |
| `RI-CAM07` | 15-camera | modern-fidelity | F10 G1 | 1 | 4 | judged_below_bar |
| `RI-PRG01` | 20-progression | souls | C2 | 1 | 6 | judged_at_or_above_bar |
| `RI-PRG02` | 20-progression | neutral | C2 | 4 | 6 | judged_at_or_above_bar |
| `RI-PRG03` | 20-progression | morrowind | C2 | 12 | 5 | judged_below_bar |
| `RI-PRG04` | 20-progression | souls | C2 E3 | 5 | 7 | judged_at_or_above_bar |
| `RI-PRG05` | 20-progression | morrowind | C4 | 0 | — | never_judged |
| `RI-PRG06` | 20-progression | souls | C2 | 5 | 6 | judged_at_or_above_bar |
| `RI-PRG07` | 20-progression | neutral | C3 G2 | 4 | 6 | judged_at_or_above_bar |
| `RI-PRG08` | 20-progression | souls | C3 | 0 | — | never_judged |
| `RI-PRG09` | 20-progression | morrowind | C5 | 0 | — | never_judged |
| `RI-CHR01` | 22-character | morrowind | C1 | 3 | 4 | judged_below_bar |
| `RI-CHR02` | 22-character | morrowind | C1 | 8 | 4 | judged_below_bar |
| `RI-CHR03` | 22-character | morrowind | C1 | 3 | 4 | judged_below_bar |
| `RI-CRM01` | 23-stealth-crime | morrowind | C8 | 9 | 5 | judged_below_bar |
| `RI-CRM02` | 23-stealth-crime | morrowind | C8 P8 | 5 | 3 | judged_below_bar |
| `RI-STL01` | 23-stealth-crime | split | C7 F9 | 4 | 5 | judged_below_bar |
| `RI-STL02` | 23-stealth-crime | morrowind | C7 | 9 | 7 | judged_at_or_above_bar |
| `RI-MAG01` | 25-magic | souls | C6 G2 | 4 | 7 | judged_at_or_above_bar |
| `RI-MAG02` | 25-magic | morrowind | C6 | 4 | 6 | judged_at_or_above_bar |
| `RI-MAG03` | 25-magic | morrowind | C6 | 4 | 5 | judged_below_bar |
| `RI-MAG04` | 25-magic | morrowind | C6 P10 | 4 | 5 | judged_below_bar |
| `RI-MAG05` | 25-magic | neutral | F12 | 4 | 3 | judged_below_bar |
| `RI-MAG06` | 25-magic | morrowind | C6 | 2 | 6 | judged_at_or_above_bar |
| `RI-QST01` | 30-quests | morrowind | P8 | 3 | 7.5 | judged_at_or_above_bar |
| `RI-QST02` | 30-quests | morrowind | P10 | 1 | 7 | judged_at_or_above_bar |
| `RI-QST03` | 30-quests | morrowind | P7 P8 | 7 | 5.5 | judged_below_bar |
| `RI-QST04` | 30-quests | morrowind | P6 | 1 | 6.5 | judged_at_or_above_bar |
| `RI-QST05` | 30-quests | morrowind | P10 | 10 | 8 | judged_at_or_above_bar |
| `RI-QST06` | 30-quests | morrowind | P9 | 2 | 6 | judged_at_or_above_bar |
| `RI-QST07` | 30-quests | morrowind | P10 | 5 | 5 | judged_below_bar |
| `RI-QST08` | 30-quests | morrowind | P10 | 5 | 4 | judged_below_bar |
| `RI-QST09` | 30-quests | morrowind | P10 | 0 | — | never_judged |
| `RI-DLG01` | 40-dialogue | morrowind | P1 | 3 | 5 | judged_below_bar |
| `RI-DLG02` | 40-dialogue | morrowind | P2 | 5 | 5 | judged_below_bar |
| `RI-DLG03` | 40-dialogue | morrowind | P2 | 7 | 8 | judged_at_or_above_bar |
| `RI-DLG04` | 40-dialogue | morrowind | P2 | 0 | — | never_judged |
| `RI-DLG05` | 40-dialogue | morrowind | P3 | 0 | — | never_judged |
| `RI-DLG06` | 40-dialogue | morrowind | P2 | 1 | 5 | judged_below_bar |
| `RI-DLG07` | 40-dialogue | morrowind | I3 P2 | 0 | — | never_judged |
| `RI-DLG08` | 40-dialogue | morrowind | P2 | 0 | — | never_judged |
| `RI-DLG09` | 40-dialogue | split | P10 G7 | 1 | 0 | judged_below_bar |
| `RI-TRV01` | 50-world | morrowind | W7 | 8 | 6 | judged_at_or_above_bar |
| `RI-TRV02` | 50-world | morrowind | W7 C6 | 0 | — | never_judged |
| `RI-WLD01` | 50-world | morrowind | W1 | 6 | 8 | judged_at_or_above_bar |
| `RI-WLD02` | 50-world | morrowind | W3 | 0 | — | never_judged |
| `RI-WLD03` | 50-world | morrowind | W4 | 6 | 6 | judged_at_or_above_bar |
| `RI-WLD04` | 50-world | morrowind | W2 F13 | 3 | 6 | judged_at_or_above_bar |
| `RI-WLD05` | 50-world | morrowind | W11 | 1 | 5 | judged_below_bar |
| `RI-WLD06` | 50-world | morrowind | W6 | 1 | 6 | judged_at_or_above_bar |
| `RI-WLD07` | 50-world | neutral | W8 | 8 | 6 | judged_at_or_above_bar |
| `RI-WLD08` | 50-world | morrowind | W10 | 7 | 7 | judged_at_or_above_bar |
| `RI-WLD09` | 50-world | morrowind | W11 | 3 | 6 | judged_at_or_above_bar |
| `RI-WLD10` | 50-world | split | W9 F7 | 3 | 5 | judged_below_bar |
| `RI-WLD11` | 50-world | morrowind | W9 | 4 | 3 | judged_below_bar |
| `RI-WLD12` | 50-world | morrowind | W2 | 1 | 5 | judged_below_bar |
| `RI-WLD13` | 50-world | morrowind | W5 | 5 | 5 | judged_below_bar |
| `RI-WLD14` | 50-world | morrowind | W11 F8 | 1 | 0 | judged_below_bar |
| `RI-WLD15` | 50-world | morrowind | W3 F6 | 0 | — | never_judged |
| `RI-WLD16` | 50-world | morrowind | W1 F6 | 0 | — | never_judged |
| `RI-LOR01` | 60-lore | morrowind | P5 | 7 | 5 | judged_below_bar |
| `RI-LOR02` | 60-lore | morrowind | P5 | 6 | 5 | judged_below_bar |
| `RI-LOR03` | 60-lore | morrowind | P4 | 5 | 6.5 | judged_at_or_above_bar |
| `RI-LOR04` | 60-lore | morrowind | P5 | 8 | 6 | judged_at_or_above_bar |
| `RI-LOR05` | 60-lore | neutral | P5 | 1 | 5 | judged_below_bar |
| `RI-LOR06` | 60-lore | morrowind | P5 | 8 | 7 | judged_at_or_above_bar |
| `RI-LOR07` | 60-lore | morrowind | P5 | 0 | — | never_judged |
| `RI-LOR08` | 60-lore | morrowind | P5 | 0 | — | never_judged |
| `RI-VIS01` | 70-visual | neutral | I3 | 0 | — | never_judged |
| `RI-VIS02` | 70-visual | modern-fidelity | I5 | 1 | 0 | judged_below_bar |
| `RI-VIS03` | 70-visual | modern-fidelity | I3 F2 F3 | 2 | 6 | judged_at_or_above_bar |
| `RI-VIS04` | 70-visual | modern-fidelity | F5 F2 F3 F4 | 4 | 8 | judged_at_or_above_bar |
| `RI-VIS05` | 70-visual | morrowind | F13 | 0 | — | never_judged |
| `RI-VIS06` | 70-visual | neutral | I3 | 4 | 5 | judged_below_bar |
| `RI-VIS07` | 70-visual | morrowind | F13 | 1 | 4 | judged_below_bar |
| `RI-VIS08` | 70-visual | modern-fidelity | F10 F11 | 3 | 3 | judged_below_bar |
| `RI-VIS09` | 70-visual | neutral | I5 | 0 | — | never_judged |
| `RI-VIS10` | 70-visual | morrowind | F10 I5 | 1 | 1 | judged_below_bar |
| `RI-MTH01` | 80-methods | neutral | I1 | 2 | 6 | judged_at_or_above_bar |
| `RI-MTH02` | 80-methods | neutral | I1 | 3 | 7 | judged_at_or_above_bar |
| `RI-MTH03` | 80-methods | neutral | I3 | 2 | 5 | judged_below_bar |
| `RI-MTH04` | 80-methods | neutral | I2 | 7 | 8 | judged_at_or_above_bar |
| `RI-MTH05` | 80-methods | neutral | I5 | 0 | — | never_judged |
| `RI-MTH06` | 80-methods | neutral | I2 I5 | 0 | — | never_judged |
| `RI-MTH07` | 80-methods | neutral | I4 | 25 | 8 | judged_at_or_above_bar |
| `RI-PLT01` | 85-platform | neutral | T3 F14 | 2 | 5 | judged_below_bar |
| `RI-PLT02` | 85-platform | neutral | T3 | 0 | — | never_judged |
| `RI-PLT03` | 85-platform | neutral | T3 | 3 | 2 | judged_below_bar |
| `RI-UIX01` | 86-ui | souls | G6 | 1 | 0 | judged_below_bar |
| `RI-UIX02` | 86-ui | morrowind | P3 | 3 | 4 | judged_below_bar |
| `RI-UIX03` | 86-ui | neutral | C3 T4 | 3 | 6 | judged_at_or_above_bar |
| `RI-UIX04` | 86-ui | morrowind | P3 T4 | 5 | 7 | judged_at_or_above_bar |
| `RI-UIX05` | 86-ui | morrowind | P4 | 4 | 8 | judged_at_or_above_bar |
| `RI-UIX06` | 86-ui | neutral | T4 F13 | 3 | 5 | judged_below_bar |
| `RI-UIX07` | 86-ui | morrowind | T4 | 1 | 5 | judged_below_bar |
| `RI-UIX08` | 86-ui | morrowind | P1 T4 | 1 | 2 | judged_below_bar |
| `RI-UIX09` | 86-ui | morrowind | T4 | 1 | 0 | judged_below_bar |
| `RI-AUD01` | 87-audio | souls | G6 | 1 | 6 | judged_at_or_above_bar |
| `RI-AUD02` | 87-audio | modern-fidelity | E9 T3 | 1 | 6 | judged_at_or_above_bar |
| `RI-AUD03` | 87-audio | morrowind | E9 | 4 | 5 | judged_below_bar |
| `RI-AUD04` | 87-audio | neutral | E9 | 0 | — | never_judged |
| `RI-AUD05` | 87-audio | morrowind | E9 | 0 | — | never_judged |
| `RI-JRN01` | 88-journeys | morrowind | E1 | 6 | 2 | judged_below_bar |
| `RI-JRN02` | 88-journeys | neutral | E2 | 0 | — | never_judged |
| `RI-JRN03` | 88-journeys | souls | T2 | 4 | 6 | judged_at_or_above_bar |
| `RI-JRN04` | 88-journeys | souls | T2 | 3 | 6 | judged_at_or_above_bar |
| `RI-JRN05` | 88-journeys | morrowind | T1 | 3 | 2 | judged_below_bar |
| `RI-JRN06` | 88-journeys | souls | E3 | 4 | 6 | judged_at_or_above_bar |
| `RI-JRN07` | 88-journeys | morrowind | P6 | 0 | — | never_judged |
| `RI-JRN08` | 88-journeys | morrowind | E8 | 0 | — | never_judged |
| `RI-JRN09` | 88-journeys | morrowind | E1 | 4 | 8 | judged_at_or_above_bar |
| `RI-CMP01` | 95-experience | neutral | E4 | 1 | 2 | judged_below_bar |
| `RI-CMP02` | 95-experience | neutral | E4 | 0 | — | never_judged |
| `RI-CMP03` | 95-experience | neutral | E5 | 0 | — | never_judged |
| `RI-EXP01` | 95-experience | neutral | E1 | 3 | 0 | judged_below_bar |
| `RI-EXP02` | 95-experience | neutral | E6 | 1 | 2 | judged_below_bar |
| `RI-EXP03` | 95-experience | neutral | E6 | 1 | 2 | judged_below_bar |
| `RI-EXP04` | 95-experience | neutral | E6 | 0 | — | never_judged |
| `RI-EXP05` | 95-experience | neutral | E7 | 3 | 0 | judged_below_bar |
| `RI-EXP06` | 95-experience | neutral | E4 | 1 | 2 | judged_below_bar |

## Open gaps — every id and its home

| gap | sev | subsystem path | covered by |
|---|---|---|---|
| `AUDB2-F1` | major | `audio.ambience.events` | E9 |
| `GAP-FCT-03` | blocking | `quests.faction.measurement` | P7 I4 |
| `GAP-PACK-01` | high | `process.critic.discipline` | I3 |
| `GAP-PROSE-01` | high | `dialogue.voice` | P2 |
| `GAP-W1-02-m68-unanswerable` | blocking | `world.region.transition` | W2 I3 |
| `GAP-W1-03-water-surface-undrawn-and-frozen` | blocking | `world.water.marsh` | F7 W9 |
| `GAP-W1-12-approach-cannot-close-on-a-walking-player` | blocking | `combat.enemy.movement` | G4 |
| `GAP-W1-12-m3-chase-bot-dwell-on-the-items-own-fixture` | blocking | `combat.enemy.statemachine` | G4 |
| `GAP-W1-13-clock-consequences-never-fire` | major | `world.time.daynight` | W10 |
| `GAP-W1-13-roster-clause-has-no-control` | major | `world.time.daynight` | W10 I4 |
| `GAP-W1-16-a-save-and-a-reload-change-your-roll-class` | blocking | `progression.equipment.encumbrance` | C3 T1 |
| `GAP-W1-16-equip-load-cannot-see-the-thing-in-your-hands` | blocking | `progression.equipment.encumbrance` | C3 |
| `GAP-W1-17-an-archetype-with-no-mouth` | blocking | `dialogue.npc.identity` | P2 |
| `GAP-W1-22-event-level-graded-on-a-median` | major | `audio.ambience.region` | E9 |
| `GAP-W1-23-both-registered-voices-on-slavery-are-colonists` | major | `lore.canon.registry` | P5 |
| `GAP-W1-25-the-control-facility-has-an-optional-control` | blocking | `experience.permissiveness.register` | E4 I4 |
| `GAP-W1-26-creation-cannot-be-completed-from-the-title` | blocking | `journey.firstlaunch.flow` | C1 E1 |
| `GAP-W1-26-r3-body-race-fails-silently-and-is-refused-eleven-nodes-later` | major | `journey.firstlaunch.flow` | C1 |
| `GAP-W1-30c-wetness-mask-blind-to-instancematrix` | major | `render.fidelity.materials` | F1 |
| `GAP-W1-act5-argument-entry-shadowed` | blocking | `dialogue.topics.filtering` | P1 P9 |
| `GAP-W1-attr-scale-ceilings-rest-on-an-unmeasured-souls-economy` | major | `progression.level.attributes` | C2 |
| `GAP-W1-audio-emitter-consumption` | blocking | `audio.ambience.region` | E9 I4 |
| `GAP-W1-character-surface-is-assembled-from-primitives-not-built` | blocking | `render.art.character` | F10 |
| `GAP-W1-combat-exemplar-has-no-danger` | blocking | `combat.frames.timing` | G7 I1 |
| `GAP-W1-consumption-sweep-tripwire-is-a-name-grep` | major | `combat.camera.behaviour` | I4 |
| `GAP-W1-creation-is-an-api-not-a-scene` | blocking | `journey.chargen.diegesis` | C1 |
| `GAP-W1-crime-enforcement-is-a-free-win` | blocking | `crime.guard.response` | C8 |
| `GAP-W1-deploy-instruments-point-at-the-tester-not-the-player` | major | `platform.load.ttfp` | T3 |
| `GAP-W1-enemy-attacks-cannot-reach-contact-range` | blocking | `combat.hitbox.sweep` | G2 |
| `GAP-W1-enemy-weapon-volume-still-cannot-reach-and-the-body-pays-its-damage` | major | `combat.hitbox.sweep` | G2 |
| `GAP-W1-f1-actor-body-shader-does-not-link` | blocking | `render.fidelity.character` | F1 F10 |
| `GAP-W1-faction-ladders-are-bricked-up-at-rank-5` | blocking | `quests.faction.rankgating` | P7 |
| `GAP-W1-faction-ladders-are-doors-onto-empty-corridors` | blocking | `quests.faction.escalation` | P7 P8 |
| `GAP-W1-hearth-levelup-gate-reads-a-method-that-does-not-exist` | blocking | `progression.bonfire.function` | C2 |
| `GAP-W1-height-fog-credit-unanchored` | major | `render.fidelity.atmosphere` | F4 |
| `GAP-W1-input-calibration-outlives-its-pad-on-disconnect` | major | `input.gamepad.lifecycle` | T2 |
| `GAP-W1-input-discoverability-unmeasured` | major | `input.discoverability` | T2 |
| `GAP-W1-interior-door-draws-nothing` | blocking | `world.interior.named` | W5 |
| `GAP-W1-library-martial-single-hand-fingerprint` | major | `lore.register` | P5 P4 |
| `GAP-W1-LIBRARY-the-library-has-no-reader-on-the-world-side` | critical | `ui.readables` | P4 |
| `GAP-W1-library-unreachable-contradiction-pairs` | blocking | `?` | P4 P5 |
| `GAP-W1-m6-pan-correlation-passes-the-panner-it-was-built-to-catch` | major | `audio.combat.impact` | G6 |
| `GAP-W1-magic-effects-no-behaviour` | blocking | `magic.effects.utility` | C6 |
| `GAP-W1-magic-skill-frozen` | blocking | `magic.gating.skills` | C6 C2 |
| `GAP-W1-magic-spellmaking-has-no-world-side-surface` | blocking | `magic.effects.catalogue` | C6 |
| `GAP-W1-mainquest-topic-bootstrap` | blocking | `quests.mainline.acts` | P9 P1 |
| `GAP-W1-map-fix-drops-the-journal-from-the-page-walk` | major | `input.modality.parity` | T4 |
| `GAP-W1-map-the-audit-is-computed-and-never-published` | blocking | `platform.save.persistence` | T1 |
| `GAP-W1-mark-teaches-nothing-to-the-journal` | blocking | `journal.entry.voice` | P3 |
| `GAP-W1-pbr-material-set-unbound` | blocking | `render.fidelity.materials` | F1 |
| `GAP-W1-platform-prng-never-drawn` | blocking | `platform.determinism.harness` | I1 |
| `GAP-W1-platform-save-drops-entity-prev-state` | blocking | `platform.save.persistence` | T1 |
| `GAP-W1-population-save-reload-repays-every-corpse` | major | `combat.encounter.placement` | T1 G5 |
| `GAP-W1-provstream-arrival-burst` | blocking | `platform.load.hitches` | T3 |
| `GAP-W1-quest-givers-not-in-the-world` | blocking | `quests.mainline.acts` | P7 |
| `GAP-W1-questionnaire-route-is-unreadable-and-unnamed` | blocking | `character.creation.flow` | C1 |
| `GAP-W1-rendered-text-accessor-blind-to-the-hud-surface` | blocking | `journey.opening.legibility` | T4 I1 |
| `GAP-W1-road-join-has-no-gate` | blocking | `world.traversal.roads` | W1 |
| `GAP-W1-save-purse-has-no-writer` | blocking | `journey.save.roundtrip` | C4 T1 |
| `GAP-W1-settlement-has-no-outside` | blocking | `world.settlement.anatomy` | W4 |
| `GAP-W1-seven-tenths-of-the-indoor-floor-is-at-the-top-of-the-light-scale` | blocking | `stealth.detection.model` | C7 F9 |
| `GAP-W1-souls-alive-keyed-on-eid` | major | `progression.souls.economy` | C2 |
| `GAP-W1-souls-world-copy-of-the-values-is-53pc-stale` | major | `progression.souls.economy` | C2 |
| `GAP-W1-stealth-crime-model-not-coupled-to-the-world` | blocking | `crime.witness.model` | C7 C8 |
| `GAP-W1-the-building-is-smaller-than-the-room` | blocking | `world.settlement.anatomy` | W4 |
| `GAP-W1-the-door-puts-you-inside-the-building` | blocking | `world.interior.named` | W5 |
| `GAP-W1-the-doorstep-cannot-get-you-back-in` | blocking | `world.interior.continuity` | W5 |
| `GAP-W1-the-fence-buys-your-victims-own-furniture` | blocking | `stealth.fence.economy` | C7 |
| `GAP-W1-the-naming-moment-is-still-orphan-text` | blocking | `journey.chargen.diegesis` | C1 |
| `GAP-W1-two-placement-mechanisms-collide` | blocking | `?` | W5 |
| `GAP-W1-ui-detectors-that-cannot-see` | blocking | `ui.hud.minimalism` | T4 I1 |
| `GAP-W1-ui-hud-world-set-unbuilt-and-misplaced` | blocking | `ui.hud.world` | T4 |
| `GAP-W1-ui-map-outside-the-ar2-detectors` | blocking | `ui.hud.minimalism` | T4 |
| `GAP-W1-w1-30d-guard-misses-part-deletion` | major | `render.process.measurement` | F10 I2 |
| `GAP-W1-w1-30e-street-gate-never-ran` | blocking | `render.process.measurement` | F8 I2 |
| `GAP-W1-w1-30s-seam-incomplete` | major | `render.fidelity.vfx` | F12 |
| `GAP-W1-walkpath-absorbs-teleports` | major | `world.traversal.locomotion` | W1 I1 |
| `GAP-W1-weapon-animation-model-has-no-rendered-consumer` | blocking | `weapon.animation.reuse` | G3 F11 |
| `GAP-W1-weapon-impact-and-material-model-has-no-consumer` | blocking | `weapon.feel.material` | G3 |
| `GAP-W1-weapon-movesets-not-wired-to-the-runtime` | blocking | `weapon.moveset.slots` | G3 |
| `GAP-W1-world-region-identity-is-a-tint` | blocking | `world.region.identity` | W2 F13 |
| `GAP-W1-world-trunk-road-below-the-waterline` | blocking | `world.terrain.form` | W1 |

## Plans — every file and its home

| plan | title | covered by |
|---|---|---|
| `BUILDER-EXECUTION-CONTRACT` | Builder execution contract — bounded proof, independent judgement | I4 |
| `COST-EXPERIMENTS` | COST-EXPERIMENTS — the plan | *process, not build scope* |
| `COST-INSTRUMENT` | Plan — `COST-INSTRUMENT`: the measurement, the baseline, and the experiment protocol | *process, not build scope* |
| `W1-00` | W1-00 — harness, determinism, persistence: current-state continuation plan | I1 T1 T3 |
| `W1-01` | W1-01 — province, regions, traversal and travel: current-state continuation plan | W1 W2 W7 |
| `W1-02` | PLAN — W1-02: regions, borders and the strange | W2 W11 |
| `W1-03` | PLAN — W1-03: water, marsh, and the amphibious body | W9 F7 |
| `W1-04` | W1-04 current-state continuation plan — settlements, interiors, and people | W4 W5 |
| `W1-05` | W1-05 — current-state continuation plan | W6 W7 C4 |
| `W1-06` | PLAN — W1-06: the camera | G1 |
| `W1-07` | W1-07 — character creation and opening: current-state continuation plan | C1 E1 |
| `W1-08` | W1-08 current-state continuation plan | T2 G7 |
| `W1-09` | W1-09 — current-state continuation plan | G2 G4 |
| `W1-10` | W1-10 current-state continuation plan | G3 |
| `W1-11` | W1-11 — impact, hitstop, mass, material, audio: current-state continuation plan | G6 G3 |
| `W1-12` | W1-12 — enemy AI and encounter composition: current-state continuation plan | G4 G5 |
| `W1-13` | W1-13 current-state continuation plan | C2 E3 W10 |
| `W1-14` | W1-14 — magic: current-state continuation plan | C6 |
| `W1-15` | W1-15 current-state continuation plan — stealth, theft, crime, justice, and non-combat seams | C7 C8 |
| `W1-16` | W1-16 — current-state continuation plan | C2 C3 C4 |
| `W1-17` | PLAN — W1-17: dialogue, the topic graph, and the people using it | P1 P2 |
| `W1-18` | CURRENT-STATE CONTINUATION PLAN — W1-18: quest engine and journal | P3 P6 P10 |
| `W1-19` | CURRENT-STATE CONTINUATION PLAN — W1-19: the main quest, end to end | P9 |
| `W1-20` | W1-20 — current-state continuation plan | P8 P7 |
| `W1-21` | W1-21 current-state continuation plan | T4 G6 |
| `W1-22` | W1-22 — current-state continuation plan | E9 |
| `W1-23` | W1-23 current-state continuation plan — canon registry, books, disputes, and names | P5 |
| `W1-24` | W1-24 — visual protocol and the player's body: current-state continuation plan | F10 I3 |
| `W1-25` | CURRENT-STATE CONTINUATION PLAN — W1-25: experience instruments and seam crossings | E4 |
| `W1-26` | PLAN — W1-26: the opening as a played scene | E1 C1 |
| `W1-27` | W1-27 — density, loot, and coherence: current-state continuation plan | W3 P10 |
| `W1-28` | W1-28 — the first hour as interaction: current-state continuation plan | E2 |
| `W1-29` | W1-29 current-state continuation plan | T2 |
| `W1-30-EVIDENCE` | The evidence standard — the Deck, the orbit, and the defect inventory | I2 |
| `W1-30-LIBRARY` | The visual library — how reuse becomes structural | F8 F10 |
| `W1-30` | W1-30 — whole-game visual fidelity: parent plan and decomposition | F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 F13 F14 |
| `W1-30A` | W1-30A — the frame pipeline: antialiasing, bloom, occlusion, grade | F5 F2 |
| `W1-30B` | W1-30B — light, sky, shadow and atmosphere | F4 F2 F3 |
| `W1-30C` | W1-30C — the material and texture library | F1 |
| `W1-30D` | W1-30D — characters, creatures, animation | F10 F11 |
| `W1-30E` | W1-30E — architecture, settlements and the model kit | F8 |
| `W1-30F` | W1-30F — terrain, vegetation, and the region reference corpus | F6 |
| `W1-30G` | W1-30G — interiors and practical lighting | F9 |
| `W1-30H` | W1-30H — VFX and the water surface | F12 F7 |
| `W1-30K` | W1-30K — the look target: art direction written as numbers | F13 |
| `W1-30S` | W1-30S — the seam pass: make the visual tree safely parallel | F1 F2 F3 F4 F5 |
| `W1-30V` | W1-30V — visual truth: the Deck, the orbit, the defect inventory | I2 |
| `W1-DLG-TOPIC-WEB` | W1-DLG-TOPIC-WEB — topics unlocking topics, as something a player can see happen | P1 |
| `W1-HUD-TOAST` | PLAN — W1-HUD-TOAST: the toast that ran off the paper, and the check that could not see it | T4 G6 |
