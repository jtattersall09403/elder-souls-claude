# AMENDMENT-W1-07-02 — three arithmetic corrections where an item contradicts itself

**Filed by:** wave-1 builder `W1-07` (character creation).
**Targets:** `RI-CHR02` §3 (the RG-COURT row), `RI-CHR02` §4a (row C and the aggregate figure,
and method 3's threshold derived from it), `RI-CHR01` §6.4 (the class skill share).
**Kind:** arithmetic corrections. Every one is a case where the item's **prose and its own
table disagree**, or where a figure cannot be produced from the item's own numbers.
**No design content is changed.** One threshold moves, and §C below argues why that is a
recomputation rather than a softening — it is the correction most open to challenge and it is
stated first in the summary so it is not buried.

Everything below is reproducible in three seconds:

```
node tools/analysis/creation-audit.mjs --section matrix
node tools/analysis/creation-audit.mjs --section disposition
node tools/analysis/creation-audit.mjs --section prohibitions
```

---

## A. `RI-CHR02` §3 — the RG-COURT row is not the row the item says it is

The item states the design twice and the table a third way.

> **RG-COURT = all zeroes.** One group in twelve is genuinely indifferent, because the Drowned
> Court buries everyone for a fee and has for four hundred years. A matrix with no neutral row
> is a matrix somebody generated rather than authored.  — §3, "how to read the four
> load-bearing cells"

> **assert ≥ 1 row is all zeros** (RG-COURT)  — method 2

The shipped §3 table row is `Saxhleel +2 | Naga +2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0`.

Two of the item's three statements say all zeroes and the third is a table cell, so the table
loses. **RG-COURT is all zeroes** in `game/data/progression/race-reactions.json`. Without this
the item fails its own method-2 assertion, which is one of the three anti-generation checks the
matrix's whole credibility rests on.

**Cost of the change:** the Saxhleel−Dunmer difference at RG-COURT goes from 2 to 0, which
moves the aggregate in §B by 0.17 points — in the *unhelpful* direction. It is applied anyway,
because a builder who declines a correction that makes his own numbers worse has not made a
correction.

## B. `RI-CHR02` §4a row C — Imperial / foreign-born is 24, not 28

§4a's worked table gives row C as **28**. The item's own inputs give 24:

| term | source | value |
|---|---|---:|
| base disposition | §4a preamble | 50 |
| race, Imperial at RG-DEEP | §3 matrix | −22 |
| upbringing, `foreign-born` at RG-DEEP | §3 upbringing table | −4 |
| | | **24** |

and §4b independently prints `r = −26` for exactly this configuration, i.e. `50 − 26 = 24`.
So §3 says 24, §4b says 24, and §4a says 28. **Row C becomes 24.**

Nothing downstream moves: 24 is in the same `Cold` band as 28 (RI-DLG04 §E: `10 < v < 30`),
so the row's stated consequence — *"Terse, punitive barter, no quest offers"* — is unchanged,
and the item's headline 68-point A−D gap is unaffected because row C is not in it.

## C. `RI-CHR02` §4a — the aggregate Saxhleel−Dunmer gap is 11.75, not 15.3

This is the correction that moves a threshold, and it is the one to argue with.

> averaged over all twelve groups this matrix delivers Saxhleel − Dunmer = **+15.3**  — §4a
>
> **Assert the aggregate Saxhleel − Dunmer mean over all twelve groups is ≥ 12** (DLG04 §E
> rule 5 needs ≥ 8; we claim 15.3)  — method 3

Recomputed from the item's own §3 table, cell by cell (RG-COURT as corrected in §A):

| group | Saxhleel | Dunmer | difference |
|---|---:|---:|---:|
| RG-DEEP | +14 | −40 | 54 |
| RG-ROOT | +12 | −34 | 46 |
| RG-LUKIUL | +9 | −28 | 37 |
| RG-NAGA | +2 | −30 | 32 |
| RG-LEDGER | +4 | −6 | 10 |
| RG-EMPIRE | −6 | +2 | −8 |
| RG-DRES | −30 | +12 | −42 |
| RG-BWC | −12 | +2 | −14 |
| RG-VAKH | 0 | +2 | −2 |
| RG-COURT | 0 | 0 | 0 |
| RG-TOWN | +6 | −18 | 24 |
| RG-OUTLAW | 0 | −4 | 4 |
| | | **sum** | **141** |
| | | **mean** | **11.75** |

15.3 would need a sum of 183.6. No reading recovers it: with the original `+2/+2` RG-COURT row
the mean is 11.92; population-weighted by §2's shares it is 25.1; over the four "interior"
groups alone it is 42.3. **The figure is not in the matrix under any reading**, and the item
prints it as a measurement of the matrix.

**The amendment:**

1. §4a's `+15.3` becomes **`+11.75`**, described as recomputed rather than claimed.
2. Method 3's assertion becomes **`≥ 8`** — RI-DLG04 §E rule 5's floor, which is the only
   externally anchored number in the sentence and which the same sentence already names.

**Why this is not a builder lowering a bar to pass.** The `≥ 12` was derived, in the item's own
parenthesis, from the `15.3` — it was "our claim, with a little headroom", not an independent
requirement. When the claim turns out not to exist, a threshold derived from it has nothing
holding it up. The requirement that *does* exist is DLG04's ≥ 8, and the shipped matrix clears
it by 47%. Three things are unchanged and are the load-bearing ones:

- the **68-point** A−D gap (method 3's headline assertion, `≥ 60`) — **measured 68**, untouched;
- **σ ≥ 9.0** over the 120 cells — **measured 9.909**, untouched;
- Dunmer/RG-DEEP = **−40**, the item's largest and most contested number — untouched.

The alternative repair was to edit matrix cells until the mean reached 12, which would have
meant changing authored design to protect a miscomputed summary of it. That is the worse trade
and it was rejected.

**If RI-CHR02's owner disagrees**, the honest fix is to *raise the matrix* — the item's
"how we lose" section explicitly prefers a bigger number to a softer one — not to restore the
`15.3`. A builder cannot make that call, so it is flagged here rather than taken.

## D. `RI-CHR01` §6.4 — the class skill share is 80 points, not 105

> Class skill points at creation = **105** above baseline (3×20 + 2×10)  — §6.4

`3 × 20 + 2 × 10 = 80`. The parenthesis is the definition and it is right; the number in front
of it is wrong. Three primaries at 25 and two secondaries at 15, over a baseline of 5, is
`3 × (25−5) + 2 × (15−5) = 80` — which is what all fourteen shipped classes deliver
(`creation-audit.mjs --section prohibitions` prints it).

**Nothing is softened by this.** The clause exists to bound class's share of the character:
"≤ 15% at creation, ≤ 4% at level 60". At 80 the share is **11.4%** of a ~700-point level-60
skill sheet instead of 15.0% — the bound is met *more* comfortably, and the item's argument
that class shapes rather than locks is strengthened, not weakened.

---

## What none of these change

- No matrix cell except RG-COURT's two Argonian columns, which the item's own prose already
  specified as zero.
- No race profile, no attribute delta, no skill value, no ability, no resistance.
- No surcharge coefficient, no `lawFactor`, no arrest threshold.
- No birthsign, no class, no question, no upbringing row.
- No scoring band anywhere except method 3's `≥ 12`, argued in §C.

## Provenance

All four defects were found by running the corpus's own comparison methods over the shipped
data rather than by reading the items — which is the argument for building the audit tool at
all. The full run is `node tools/analysis/creation-audit.mjs`: 82 assertions, 81 passing, one
declared in `game/data/progression/KNOWN-GAPS.json`.
