# The seam-crossing matrix — W1-25, at 63f41ef

## Stage 1 — what the item declares, recounted from its own grid
```
RI-CMP01.cells.json  <- corpus/95-experience/RI-CMP01-cross-system-payoff-matrix.md
  342 off-diagonal cells · 206 non-none (60.2% declared coverage)
  m 146 · S 19 · M 38 · T 3 · trivial 15 · none 121
  crossings 41 (30 W->F / 11 F->W) · structural 22 · declared matrix score 297
  W1 floor: {"label":"W1 / FRAGMENT","live":10,"structural":1,"crossings":4,"score":20}
  24 cell(s) turn on a §A qualifier a machine cannot decide (5 of them satisfy §A outright): ROS->GLD (mechanical, F2W), ROS->LOR (mechanical, F2W), BOS->GLD (mechanical, F2W), BOS->WEA (mechanical, F2W), BOS->JRN (mechanical, F2W)
wrote corpus/95-experience/RI-CMP01.cells.json
```

## Stage 1 — what the shipped data claims (NOT a demonstration)
```
matrix-scan  564 data files -> 30 cells with at least one data-path claim
  4 of 41 declared seam-crossing cells have any data behind them at all
  QST->JRN     1005 claim(s)  mechanical  12 file(s)
  QST->WLD      963 claim(s)  structural  11 file(s)
  DIS->QST      488 claim(s)  structural  28 file(s)
  LOR->QST      342 claim(s)  structural  12 file(s)
  DIS->LOR      325 claim(s)  mechanical  13 file(s)
  TOD->SCH      309 claim(s)  structural  14 file(s)
  QST->FAC      285 claim(s)  structural  11 file(s)
  QST->DIS      252 claim(s)  mechanical  11 file(s)
  SKL->QST      212 claim(s)  structural  12 file(s)
  DIS->GLD      175 claim(s)  structural  14 file(s)
  QST->LOR      169 claim(s)  mechanical  6 file(s)
  SKL->SPL       72 claim(s)  mechanical  1 file(s)
  GLD->SPL       72 claim(s)  mechanical  1 file(s)
  FAC->QST       66 claim(s)  structural  7 file(s)
  SPL->QST       31 claim(s)  structural  4 file(s)
  WLD->QST       23 claim(s)  structural  1 file(s)
  ROS->LVL       22 claim(s)  mechanical  22 file(s)
  GLD->QST       22 claim(s)  mechanical  5 file(s)
  STL->QST       17 claim(s)  structural  8 file(s)
  SPL->WLD       13 claim(s)  structural  1 file(s)
  SPL->ROS       13 claim(s)  CROSSING mechanical  1 file(s)
  EQP->QST        9 claim(s)  mechanical  4 file(s)
  SPL->STL        7 claim(s)  mechanical  1 file(s)
  SPL->DUN        5 claim(s)  CROSSING mechanical  1 file(s)
  FAC->LOR        4 claim(s)  mechanical  2 file(s)
  DIS->BOS        3 claim(s)  CROSSING mechanical  3 file(s)
  ROS->WLD        1 claim(s)  CROSSING mechanical  1 file(s)
  STL->DIS        1 claim(s)  mechanical  1 file(s)
  SPL->SKL        1 claim(s)  mechanical  1 file(s)
  WEA->WLD        1 claim(s)  structural  1 file(s)
  37 crossing cell(s) have NO data claim: FAC->ROS, FAC->BOS, DIS->ROS, GLD->ROS, GLD->BOS, SKL->ROS, SKL->BOS, SPL->BOS, LOR->ROS, LOR->BOS, STL->ROS, STL->BOS, QST->ROS, QST->BOS, WLD->ROS, WLD->BOS, TOD->ROS, TOD->BOS, WEA->ROS, WEA->BOS, EQP->ROS, EQP->BOS, UPG->BOS, ROS->FAC, ROS->DIS, ROS->QST, ROS->SCH, BOS->FAC, BOS->DIS, BOS->LOR, BOS->QST, BOS->WLD, BOS->SCH, DUN->ROS, DUN->BOS, SCH->ROS, SCH->BOS
  HARNESS §7: 133 .js files (3185 KB) are invisible to this scanner by rule.
wrote reports/composition/w1/claims.json
STAGE 1 ONLY. None of this is demonstrated. See matrix-probe.mjs.
```

## Stage 2 — the A/B forks. TWO ATTEMPTS, NEITHER USABLE. Stated plainly.

ATTEMPT 1 ran in one browser and returned 6 INERT / 4 VACUOUS, 0 demonstrated crossings.
**That run is void and the fault is mine, not the build's.** `listEntities()` returns
`{eid, kind, archetype, pos, hp}` (game/src/engine.js:8764) and carries no `alert_state`
and no `side`. Every alert-based probe was comparing the string `?` against the string `?`
in both arms — an INERT verdict manufactured by the instrument. It is the exact defect this
piece exists to catch, and the piece caught itself. Log:
`reports/runs/_raw/node-tools-composition-matrix-probe.mjs---cells-corpus-95-ex-6819911623120.log`

ATTEMPT 2, with every probe moved onto `getEncounterState(id).members[].alert_state` — the
only accessor in the build that carries it — and a real `spawnEncounter()` behind it, could
not run: **the tree does not boot at HEAD.** `node tools/boot-check.mjs` exits 12 for every
agent on this box:

```
[harness] ERROR: harness ready() failed: page.evaluate: Error: canon register: 2 unresolved reference(s) in game/data/lore/canon.json.
  A dispute whose sides are held by nobody in the build is not texture, it is paperwork (RI-LOR06 §2, `positions[].held_by`).
  - CF-D015/A: topic `the-xanmeers` has no info written for actor `notary`
  - CF-D018/A: topic `reading-the-count` has no info written for actor `notary`
    at Engine._installCanon (http://127.0.0.1:46007/game/src/engine.js:2523:13)
    at Engine._boot (http://127.0.0.1:46007/game/src/engine.js:580:10)
```

That is RULES.md #13 — a fail-closed assertion landed ahead of the data it demands. It is
not this piece's change; W1-25 has touched no file under `game/`.

So ZERO seam crossings are demonstrated. RI-CMP01 W1 floor is 4, hard fail 1 is "fewer than
4 demonstrated seam-crossing cells" and hard fail 2 is "zero demonstrated F->W". Both fire.
matrix.json records `ran: false`.
