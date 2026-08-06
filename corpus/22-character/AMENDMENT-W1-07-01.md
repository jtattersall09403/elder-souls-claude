# AMENDMENT-W1-07-01 — the Imperial attribute row sums to 11, not 12

**Filed by:** wave-1 builder `W1-07` (character creation).
**Target:** `corpus/22-character/RI-CHR02-race-and-standing.md` §1, row 4 (**Imperial**).
**Kind:** arithmetic correction to a single cell. **No threshold anywhere is changed.**
**Status:** applied in-place to RI-CHR02 §1 with an inline `AMENDED wave 1` note, and
implemented in `game/data/progression/races.json`.

## The defect

RI-CHR02 §1 states, as a binding invariant:

> **Every race's deltas sum to +12**, so no race is a strictly better statline; they differ
> in *shape* only.

and its own comparison method 1 makes that invariant a hard assertion:

> for each, **assert `sum(attribute_deltas) == 12`**

The shipped Imperial row is `STR +1, END +1, AGI +1, SPD +1, VIG +1, WIL +1, INT +1, HIST 0,
PER +4, LCK 0`.

```
1 + 1 + 1 + 1 + 1 + 1 + 1 + 0 + 4 + 0 = 11
```

All nine other rows sum to 12 exactly (Saxhleel 12, Naga 12, Dunmer 12, Nord 12, Breton 12,
Redguard 12, Khajiit 12, Orsimer 12, Bosmer 12 — recomputed and printed by
`node tools/analysis/creation-audit.mjs`). **Imperial is the only row that does not**, so this
is a transcription slip in one cell rather than a design intent, and it is not a matter of
taste: the item asserts `== 12` and the item's own table fails that assertion. A builder who
ships the table verbatim ships a race that is a strict point *deficit* against the other nine
and fails RI-CHR01 §2's 112-point invariant for every Imperial character (111 points, not 112).

## The correction, and why this cell

`PER +4 → PER +5`.

Three candidate repairs exist and only one is neutral to the item's design content:

| Repair | Effect on the design | Verdict |
|---|---|---|
| `HIST 0 → +1` | gives the Empire a Hist bond. RI-PRG02 §1 marks HIST-BOND setting-native and RI-CHR02 §1 gives HIST to exactly one race (Saxhleel +4). A non-zero Imperial HIST is a lore claim, not an arithmetic fix. | **rejected** |
| `LCK 0 → +1` | invents a trait the row does not have; Imperial is not a luck race in this roster (Bosmer +5, Dunmer/Khajiit +3). | **rejected** |
| `PER +4 → +5` | strengthens the one attribute the row is *already about* — Imperial is the only race in the roster with an outlier PER, is the only race with a PER-gated ability (`Voice of the Empire`, one unfailable Admire per day) and starts with Speechcraft 25 / Mercantile 20. | **applied** |

After the repair Imperial is `1,1,1,1,1,1,1,0,5,0 = 12` and is the sole race whose deltas are
non-negative in every cell — the "generalist plus a spike" shape the row was clearly drawn as.
PER +5 also keeps Imperial's spike equal to the largest single spike in the roster (Orsimer
STR +5 / END +5, Khajiit AGI +5, Bosmer AGI +5 / LCK +5), so the correction adds no new outlier.

## What this does not change

- No reaction-matrix cell, no `lawFactor`, no surcharge coefficient, no skill value, no ability.
- No scoring threshold in RI-CHR02, RI-CHR01 or RI-PRG02.
- The 112-point invariant of RI-CHR01 §2 is *restored* by this change, not modified: before the
  repair an Imperial character began on 111 points and every other race on 112.

## How to verify

```
node tools/analysis/creation-audit.mjs --section races
```

prints the ten sums; all ten are 12, and the tool exits non-zero if any is not.
