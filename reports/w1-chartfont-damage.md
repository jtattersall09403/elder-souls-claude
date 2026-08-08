# W1-CHARTFONT — the damage list

**What was wrong.** The shared 5×5 chart glyph table was authored at **23 characters** and the
renderer indexes it as `bits[j * 5 + i]` — stride 5, five rows, 25 characters. Width and stride
disagree, so each of the two absent characters is a **deletion from the middle of the string**, and
every row below each cut is pulled one pixel **left**. Three or four of the five rows are wrong per
glyph. It is a shear, not a truncated tail, and it is not confined to digits.

Nothing threw. No assertion existed. The output still looks like text, which is exactly why it
survived: a sheared glyph is still a picture of a letter, just not the right one.

Fixed at `tools/lib/chart-font.mjs`. Measured at commit `322f708`.

---

## What a reader was actually shown

A sheared digit is not merely ugly. Compared bitmap-to-bitmap against the sound set:

| digit | rows wrong (of 5) | closest sound digit |
|---|---|---|
| 0 | 1 | 0 |
| 1 | 1 | 1 |
| **2** | 3 | **8** |
| 3 | 4 | 3 |
| 4 | 4 | 4 |
| 5 | 2 | 5 |
| 6 | 2 | 6 |
| 7 | 4 | 7 |
| **8** | 3 | **6** |
| 9 | 3 | 9 |

**A sheared `2` is nearer a sound `8` than a sound `2`, and a sheared `8` is nearer a `6`.** Any
published figure containing a 2 or an 8 could have been read as a *different number*, not just as a
damaged one. The other eight degrade badly but remain nearest themselves.

On letters the round's own published picture spelled `BOOK` as **POOK** and `BY CHANNEL` as
**PY CHANNEL** — the claim that the corruption was invisible on letters was false.

The picture of it: `docs/shots/2026-08-08-w1-chartfont-the-charts-were-spelling-numbers-wrong.png`,
which draws the same strings through the same renderer with only the glyph table swapped.

---

## The tools

**Fixed and verified — they now import the shared module and carry no font of their own:**

- `tools/quests/reveal-route-chart.mjs`
- `tools/economy/w1-souls-ledger-chart.mjs`
- `tools/economy/critic-souls-r3-chart.mjs`
- `tools/combat/critic-w1-12-chart.mjs`
- `tools/analysis/w1-12-chart.mjs`
- `tools/analysis/w1-13-r4-chart.mjs`
- `tools/analysis/ambience-determinism-chart.mjs`
- `tools/analysis/ambience-onsets-chart.mjs`

*(The critic's nine are the tools whose **digits** were sheared. `reveal-route-chart` is the tenth
carrying the same sheared table in its 37 **letters** — its digits had been patched under a round
flag, which is why its picture had right numbers and the wrong spelling.)*

**Still sheared — claimed by a live piece, so I did not edit them. HANDOFF:**

| tool | owner |
|---|---|
| `tools/analysis/w1-15-r3-chart.mjs` | W1-15-r3 `[building]` |
| `tools/world/w1-01-r4-crossing-chart.mjs` | W1-01-r4 `[partial]` |
| `tools/world/road-join-chart.mjs` | W1-ROAD-JOIN — **written today** by pasting the sheared table in |
| `tools/harness/w1-16-r3-chart.mjs` | W1-16-r3 — **also written today**, same way |

Two of those four are new. The table was still spreading by copy-paste while this was being fixed,
which is the argument for one shared module over eleven retypes.

**The one-line adoption.** Delete the local `const FONT = { … }` and the `function text(…)` under
it, then:

```js
import { makeText } from '../lib/chart-font.mjs';   // path relative to your tool
const text = makeText(rect);                        // rect(x, y, w, h, r, g, b)
```

The signature is identical, so no call site changes.

**Not a defect, reported so nobody chases them:**

- `tools/audio/critic-w1-22-r2-chart.mjs` — has a 3-entry `GLYPH` object at 23 chars, but it is
  **dead code**, never referenced. Its chart draws from a separate column-major font and is sound.
- `tools/dialogue/w1-17-shot.mjs` — the only tool that always had a sound font (a real 5×7 at 35).
- `tools/quests/critic-w1-readables-chart.mjs` — reads the sound font off `w1-17-shot.mjs` at run
  time and throws if it does not parse.

---

## The figures

### Regenerated

| figure | owner | what was wrong |
|---|---|---|
| `2026-08-08-w1-readables-r2-the-marks-and-the-ledgers-that-now-exist.png` | W1-READABLES-r2 | **words** (BOOK→POOK, BY CHANNEL→PY CHANNEL). Digits were already patched. This is the one the critic caught. |
| `2026-08-08-w1-souls-ledger-two-ledgers-one-number.png` | W1-SOULS ledger | **numbers and words** — 16335/10679, all five tier pairs, 144 posts, 267 bodies, 6825 m, 2149 vs 1404 souls, and the commit stamp |
| `2026-08-08-w1-souls-r3-critic-two-guards-and-neither-one-alone.png` | critic-souls-r3 | numbers and words |
| `2026-08-08-w1-12-critic-the-frames-m3-never-counted.png` | critic-w1-12 | numbers and words — 0.041 / 0.252, 736, 623, and the `2 OF 2 → 1 OF 2` line |
| `2026-08-07-w1-13-r4-dying-must-not-change-the-price.png` | W1-13-r4 | numbers and words |
| `2026-08-07-w1-12-where-an-enemy-stands-while-you-fight-it.png` | W1-12 | numbers and words — **but its data also moved**, see the caveat below |

For four of these, the delete-the-fix arm reproduces the archived pre-fix PNG **byte for byte**, so
the change is a font change and nothing else.

### Named, not regenerated — for their owners

| figure | owner | why not me |
|---|---|---|
| `2026-08-07-w1-19-r3-the-reveals-no-play-produces.png` | W1-19-r3 | tool is fixed; rerun `--round w1-19-r3`. Predates the digit patch, so **numbers and words**. |
| `2026-08-07-w1-18-r2-talking-to-the-person-who-knew.png` | W1-18-r2 | same, `--round w1-18-r2` |
| `2026-08-07-w1-readables-the-ledger-on-the-shelf-in-the-archive.png` | W1-READABLES | same, `--round w1-readables` |
| `2026-08-07-w1-22-r2-ambience-events-below-the-bed.png` | W1-22-r2 | tool fixed, but its **data has moved** since publication — I regenerated it, saw the points shift, and restored the original rather than silently restate someone else's finding |
| `2026-08-07-w1-22-r3-ambience-renders-the-same-twice.png` | W1-22-r3 | same |
| `2026-08-08-w1-15-r3-the-lamps-reach-the-detection-model.png` | W1-15-r3 | **tool still sheared** |
| `2026-08-08-w1-01-r4-the-road-out-of-the-capital-goes-through-a-house.png` | W1-01-r4 | **tool still sheared** |
| `2026-08-08-w1-road-join-the-road-now-goes-between-the-houses.png` | W1-ROAD-JOIN | **tool still sheared** |
| `2026-08-08-w1-16-r3-the-sword-in-your-hand-used-to-weigh-nothing.png` | W1-16-r3 | **tool still sheared** |

### Caveat on `2026-08-07-w1-12-where-an-enemy-stands-while-you-fight-it.png`

Its broken arm does **not** reproduce the archived hash, and two fixed runs minutes apart differ
from each other, because enemy statblocks are being edited by live pieces right now. The figure in
the tree is redrawn with the correct font at the commit it was taken at, but **its numbers are not
the numbers W1-12 published**. Anyone reading it should re-derive. The delete-the-fix harness
reports it as `DATA DRIFTED` and refuses to use it as evidence either way.

---

## What was not searched

- `reports/` holds 709 PNGs, but none are chart-tool figures — they are game captures from
  `tools/capture/` and the render harness, which do not use this font. No tool in the sheared set
  writes outside `docs/shots/`.
- I did not pixel-inspect all 155 files in `docs/shots/`. This list is built from each tool's own
  output paths plus the shot names its owner's status file records, so a figure drawn by one of
  these tools under an `--out` nobody wrote down would be missed.

## The instruments

```
node tools/lib/chart-font.mjs --self-test        # renders 28 OF 32 and BOOK; REQUIRED to go red
                                                 # on the archived pre-fix table or it fails itself
node tools/lib/chart-font.mjs --audit-tree       # exits 3 naming any file still carrying a
                                                 # 23-character glyph literal
node tools/lib/chart-font.mjs --provenance       # which glyphs are restorations, which re-authored
node tools/analysis/w1-chartfont-deletefix.mjs   # rule 6, with the control watched failing:
                --prove-can-fail                 #   runs both arms broken; must report an inert fix
node tools/quests/critic-glyph-audit.mjs         # the critic's own instrument. 2 of 11 sheared now,
                                                 # down from 9 of 11, and the 2 are the handoffs.
```
