# W1-24 builder delivery

Build: `b5850ff0e6cff4bfe26cd269fa515159e32915e4` (CURRENT HEAD at capture time).

This delivery is deliberately fail-closed. It records builder-produced sources, hashes, mechanical
measurements, population membership and reproduction commands. It contains no independent visual
or blind judgement and commits no binary evidence.

## RI-VIS01 declarations (S45 current-output population only)

### FIDELITY declaration

JUDGEMENT SIDE: FIDELITY

- Properties: `F10`, `F11`, `F14`, `F17`, `F18`, `F19`.
- Permitted references: RI-VIS02, RI-VIS03, RI-VIS08, RI-CAM07 sections B-E, RI-VIS09
  `modern/` routes appropriate to the capture profile.
- Forbidden references: RI-VIS05, Morrowind, Black Marsh art-direction material.
- Captures: the two transient SHA-256-stamped close-ups in `capture-manifest.json`.
- Score: `NOT_RUN`; no independent visual judgement is present. The mechanical VIS03 M5 row is
  red and is not a visual score.

### ART DIRECTION declaration

JUDGEMENT SIDE: ART DIRECTION

- Properties: `P1`, `P2`, `P3`, `P4`, `P5`, `P6`, `P7`, `P8`, `P9`.
- Permitted references: RI-VIS05, RI-VIS06, RI-CAM07 section F, and RI-VIS09 `morrowind/` routes.
- Forbidden references: RI-VIS02, RI-VIS03, RI-VIS04, modern screenshots and fidelity metrics.
- Captures: the transient back close-up and future native mask sheet, regenerated before judging.
- Score: `NOT_RUN`; no independent visual judgement is present.

The declarations govern only outputs authored here. The historical 70-verdict census remains
diagnostic and was neither migrated nor regraded. CC-1 through CC-7 require later human
confirmation; lexical lint is not treated as judgement.

## Mechanical execution

| Population | Result | Exact handling |
|---|---|---|
| cc-scan self-test | PASS | 14/14 cases, 9 deliberate disabled-check defects, 0 inert. |
| visual-reading self-test | PASS | 11/11 readings, 7 deliberate disabled-check defects, 0 inert. |
| Four-claim live audit | ENVIRONMENT BLOCKED | One-browser run was stopped after more than ten minutes without completing its first report. No partial claim was promoted. Re-run command below. |
| CAM07 source pair | CAPTURED TRANSIENTLY | Native 1920x1080 PNGs; back height 0.6393, front 0.619; both exceed 0.45. Hashes are in the manifest. |
| Camera projection control | PASS | Back/front yaw 0/180 degrees; the off-axis point moved from NDC x `0.1483609831` to `-0.1483609831`. |
| CAM07 B1 parity (S46) | NOT_RUN | No player ID mask, so the required expanded body boxes and common native `L` cannot be extracted. The prior whole-frame B1-prime number is rejected. |
| VIS03 absolute M5 (S46) | RUN_RED | Separate native 1024-square population: both captures fail HFR and alpha; values are in the manifest. |
| RI-VIS08 prerequisite | RED / ABSENT | `m-cam07-presentation.mjs` finds no same-wave RI-VIS08 verdict and no `bones`/`bones_ndc` trace channel in `game/src/sim/record.js`; CAM07 is therefore 0 before aggregation. Drawn-geometry bones do not replace the trace field contract. |
| CAM07 M1-M4 | RED / NOT_RUN rows | B2/B4 lack native material captures; B5 and C1-C8 lack required trace/ID fields; both 3600-frame C8 duels, every D surface, five-class E1, 360-pose E2 and E7 remain unexecuted rather than omitted. |
| CAM07 M5 | RUN_RED (content census) | `carried.json` has chest=5, head=1, legs=1, hands=0 and back=0 authored rows. Fewer than three in any named slot makes M5=0. Renderer source explicitly states secondary motion is unmet. |
| CAM07 M6/F1-F5 | NOT_RUN | Native six-subject 32-pixel image masks were not produced; numbers cannot replace the required imagery. F2-F5 await a disjoint eligible art critic. |
| VIS06 Protocol A | NOT_RUN | Actual pair images must be regenerated and independently judged. Its prompt/key/reveal population is quarantined from Protocol B. |
| VIS06 Protocol B/B1/B2 | NOT_RUN | Scored population was preregistered, but S47 calibration needs a disjoint human actor. No transform was selected and no scored set was viewed for tuning. |
| UI ART | NOT_RUN | Six native screen images plus AD1-AD7 and six fresh Bootstrap judgements are absent. It remains separate from fidelity. |
| UI FIDELITY | NOT_RUN | The 48-shot 4-resolution x 2-DPR x 6-screen native matrix is absent; FD1-FD7 cannot be inferred from world captures. |
| VIS03 M1-M12 | RED | Only the applicable close-up M5 source population ran. Missing applicable slots, M1-M4/M6-M12, temporal traces and controls are red; no partial minimum is published green. |
| VIS09 register | PASS for repository integrity | `make-manifest.py --check` exits 0 after Pillow installation. Current declarations have zero unresolved target citations, zero cross-side citations, zero bare numeric reference-population claims, and no `modern/hud` or `anti-generic` target. |

## Reproduction commands

```sh
node corpus/80-methods/cc-scan.mjs --self-test --json reports/w1-24/cc-scan-selftest.json
node tools/render/visual-reading.mjs --self-test --json reports/w1-24/visual-reading-selftest.json
python3 -m pip install --user Pillow
python3 corpus/70-visual/refs/make-manifest.py --check
node corpus/80-methods/m-cam07-presentation.mjs
node tools/contention.mjs --gate
node tools/render/w1-24-audit.mjs --out reports/w1-24
rm -rf /tmp/w1-24-native && node tools/render/cam07-back.mjs --out /tmp/w1-24-native
sha256sum /tmp/w1-24-native/cam07/player_{back,front}_closeup.png
```

## Exact independent visual-critic handoff

1. Regenerate the two native close-ups and all native UI/fixed-eight sources from the commands and
   roles above; confirm hashes or stamp the new build and hashes. Do not accept this text in place of images.
2. Administer RI-VIS08 first. Missing field/row remains red and forces CAM07 fidelity to 0.
3. Produce an ID buffer and derive both S46 populations separately: CAM07 expanded-mask common-`L`
   parity and VIS03 player-centred native 1024 absolute M5. Never substitute either row.
4. Complete every exact CAM07 population named above and aggregate by worst surface/pair/pose.
   Independently inspect native contact sheets/masks; builder measurements are candidates, not PASS.
5. Have a calibration actor who will never score Protocol B administer the disjoint 20-pair S47
   panel and seal the first qualifying global transform. Stop red if none qualifies. Never expose
   scored pairs/keys to calibration and never tune from scored answers.
6. Use two further eligible judges: Protocol A receives only the verbatim RENDER QUALITY ONLY
   prompt and fidelity references; Protocol B receives only the art/B1/B2 material and its verbatim
   IMAGINATION / HARDER TO PLACE prompt. Preserve separate keys, answers, reveals and caps.
7. Independently administer CAM07 F2-F5 and UI ART. Independently administer UI FIDELITY and all
   image-bearing VIS03 rows. Keep `(ART, FIDELITY)` separate and apply every native hard fail and
   minimum/worst aggregation. There is **no independent PASS** in this delivery.

**BUILDER DELIVERY COMPLETE — W1-24**
