# CORPUS-COHERENCE-02 — the wave-1-prep edit log

**Agent:** `wave1-prep`. **Date:** 2026-08-06. **Successor to** `CORPUS-COHERENCE-01.md`.

This is not a second coherence audit. It is the **edit log** required of the agent clearing
`BAR-CRITIQUE-02`'s carry-forward conditions **C1**, **C2**, **C3** and **C14/G14**. Its
purpose is that every change made to another agent's item is recoverable, attributable and
reversible.

## 0. The permission this agent worked under, stated so it can be checked

> *"You may edit other agents' items **for C1 only**, and only to add the mapping row —
> nothing else. Record every edit. Do not change any threshold."*

**109 reference items were edited. Every edit is the same edit**: one block appended to the end
of the item's `## Scoring` section, containing the `SCORING.md` §1.2 native→ladder anchor row
and a one-line statement of the item's own aggregation rule. **No other line of any item was
touched, and no threshold anywhere in the corpus was changed.** §3 is the full list with the
values, so a diff can be read without a diff.

Verify with:

```
# every edited item carries exactly one appended block, and nothing else changed:
grep -rc "Added wave-1-prep to close BAR-CRITIQUE-02" corpus --include='RI-*.md' | grep -v ':0'   # 109 files, 1 each
grep -rl "| Ladder | 4 | 6 | 8 |" corpus --include='RI-*.md' | wc -l                              # 110
node tools/corpus-index.mjs --strict                                                              # exit 0
```

Each block is 10 lines appended at the end of the item's `## Scoring` section: a three-line
attribution paragraph, the four-line table, and the aggregation line. Nothing was deleted from
any item.

## 1. What was done, against what condition

| Condition | State on arrival | State now |
|---|---|---|
| **C1** — every item carries a native→ladder mapping; add the check to `--check` as C6 | 28 of 137 items carried a machine-detectable anchor block. The rule (`SCORING.md` §1.2, mandatory and fail-closed) had been live for a whole wave and was invisible to every instrument. | **138 of 138.** `--check` now errors on a missing anchor row and prints `ladder anchors : N/138`. |
| **C2** — an aggregate content-budget sheet with a signed feasibility argument and a cut order | did not exist | `corpus/00-doctrine/CONTENT-BUDGET.md` |
| **C3a** — `--check` runs automatically on any change to `corpus/**` | nothing ran it. No `.github/`, no root `package.json`, no hook. | `.github/workflows/corpus-gate.yml` (blocking, with a step that proves the gate can fail), `.githooks/pre-commit`, root `package.json` |
| **C3b** — wave-1 piece list re-derived against all paths, every path assigned a wave | 14 pieces against a 200-path taxonomy; no `wave` field anywhere | `docs/PLAN.md` rewritten: **28 pieces covering all 250 wave-1 paths exactly once**; `subsystems.json` carries `wave` on all 325 paths; new check **C7** errors if one lacks it |
| **N5 / C14** — `RI-MTH05` M8 asserts the gate "is wired" | false | true, and the amendment names the three files so the assertion is itself checkable |

## 2. What the measurement actually found, where it differs from the critic

Three corrections, each with the arithmetic attached. None of them changes a conclusion; all
three change a number, and the corpus's own rule is that a number stated without its derivation
is not evidence.

**2.1 — "35 items carry no mapping" undercounts by a factor of three.** `BAR-CRITIQUE-02` N1
splits the corpus into 6 verbatim / 102 substantively-compliant / 35 with nothing. Under a
*machine-checkable* definition — a block that binds native values to ladder **4, 6 and 8** —
only **28 of 137** qualified, and **109** did not. The 74-item difference is items carrying a
**verdict-band table** (`≥ 88 → Meets the bar`). A band table fixes a *ceiling* through §1.2
step 1. It does not say which native score is a 6 rather than a 4, which is the entire content
of the row. Those 74 items were therefore not "substantively compliant"; they were
`unmeasurable ⇒ 0` alongside the 35, and the fix had to cover all 109.

**2.2 — not one item used the mandated orientation.** `SCORING.md` §1.2 mandates
`| Ladder | 4 | 6 | 8 |` over `| Native | … |`. **Zero items used it.** The six weapons items
the critic called "verbatim" use a transposed `| Ladder | Native score |` table; the eight
`88-journeys`, three `85-platform` and nine `95-experience` items use a
`| Native | Band | Ladder ceiling |` table or a prose anchor line. `SCORING.md` §1.2a now
recognises all three forms explicitly rather than pretending 109 items will be reformatted, and
the checker accepts exactly those three.

**2.3 — the global dialogue pool is a ceiling, not a floor.** `BAR-CRITIQUE-02` §4's budget
table reads the locality rule as demanding *"a global reachable pool on the order of 80–90,000
words"*. 88,708 words is **Morrowind's** global layer (`RI-DLG02` §A). Our rule
`W_local / (W_local + W_global) ≥ 0.28` **caps** ours at `2.571 × W_local`, i.e. **≤ 23,100
words** against the binding Tier-B town. Full derivation in `CONTENT-BUDGET.md` §2b. This
removes ~70,000 words from the aggregate.

## 3. The 109 edits, with their values

Each row is one appended anchor block. `4 / 6 / 8` are the native values the row binds to those
ladder positions. **Every value was derived from the item's own bands, which were not altered.**

The convention used throughout, which is the only one with in-corpus precedent (`RI-WPN01`
65/78/92 against bands `≥ 88` / `65–87` / `< 65`; `RI-EXP01` 55/75/88; `RI-JRN01` 50/75/92):

- **ladder 4** = the lowest native score that is *not* "loses outright"
- **ladder 6** = the midpoint of the "below bar — named remedy required" band
- **ladder 8** = a native score comfortably inside "meets the bar"

For items whose native scale is already 0–10, the row is the identity `4 / 6 / 8`, and the
useful information in the block is the **aggregation rule** — `min-over-axes` and `band` and
`weighted-mean` were producing three different meanings of "6" across areas, which is what W7
was about in the first place.

| Item | Area | Ladder 4 | Ladder 6 | Ladder 8 | Aggregation |
|---|---|---|---|---|---|
| RI-AI01 | 10-combat | 12 / 18 | 14 / 18 | 17 / 18 | weighted-sum — each check 0/1/2 x weight, max 18 |
| RI-AI02 | 10-combat | 24 / 36 | 28 / 36 | 33 / 36 | weighted-sum — each check 0/1/2 x weight, max 36 |
| RI-AI03 | 10-combat | 24 / 36 | 28 / 36 | 33 / 36 | weighted-sum — each check 0/1/2 x weight, max 36 |
| RI-AI04 | 10-combat | 34 / 52 | 40 / 52 | 47 / 52 | weighted-sum — each check 0/1/2 x weight, max 52 |
| RI-AI05 | 10-combat | 29 / 44 | 34 / 44 | 40 / 44 | weighted-sum — each check 0/1/2 x weight, max 44 |
| RI-AI06 | 10-combat | 41 / 62 | 48 / 62 | 56 / 62 | weighted-sum — each check 0/1/2 x weight, max 62 |
| RI-AI07 | 10-combat | 40 / 60 | 46 / 60 | 54 / 60 | weighted-sum — each check 0/1/2 x weight, max 60 |
| RI-CMB01 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB02 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB03 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB04 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB05 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB06 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB07 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB08 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB09 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB10 | 10-combat | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CMB11 | 10-combat | 75 / 100 | 84 / 100 | 93 / 100 | weighted-sum of passed check weights, max 100 (this item's we-lose floor is 75, not 70) |
| RI-CAM01 | 15-camera | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CAM02 | 15-camera | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CAM03 | 15-camera | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CAM04 | 15-camera | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CAM05 | 15-camera | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CAM06 | 15-camera | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CAM07 | 15-camera | 70 / 100 on the worse set | 80 / 100 on the worse set | 92 / 100 on the worse set | min over the two independent 0-100 sets (fidelity, art direction) — never averaged |
| RI-PRG01 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes — the item's score is the lowest axis, never the mean |
| RI-PRG02 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-PRG03 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-PRG04 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-PRG05 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-PRG06 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-PRG07 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-PRG08 | 20-progression | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-PRG09 | 20-progression | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-CHR01 | 22-character | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-CHR02 | 22-character | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-CHR03 | 22-character | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-CRM01 | 23-stealth-crime | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-CRM02 | 23-stealth-crime | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-STL01 | 23-stealth-crime | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-STL02 | 23-stealth-crime | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-MAG01 | 25-magic | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-MAG02 | 25-magic | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-MAG03 | 25-magic | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-MAG04 | 25-magic | 4 / 10 | 6 / 10 | 8 / 10 | min-over-axes |
| RI-MAG05 | 25-magic | 4 / 10 on the worse scale | 6 / 10 on the worse scale | 8 / 10 on the worse scale | min over the two independent 0-10 scales (art direction, fidelity) — never averaged |
| RI-QST01 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | mean of the six sub-scores, then hard-gated (a gate breach caps the item regardless of the |
| RI-QST02 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | band — the score is read off the band table, not computed |
| RI-QST03 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-QST04 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-QST05 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | band. PACIFIST-ALL is unmeasurable (and therefore 0) if RI-STL01/02 and RI-CRM01 are unbui |
| RI-QST06 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-QST07 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-QST08 | 30-quests | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-QST09 | 30-quests | 75 / 100 | 85 / 100 | 93 / 100 | weighted-sum of passed check weights, max 100 (we-lose floor 75) |
| RI-DLG01 | 40-dialogue | 8 / 13 rows | 10 / 13 rows | 12 / 13 rows | count of passing §D rows, gated — any hard-floor breach, orphan, unreachable INFO, combat- |
| RI-DLG02 | 40-dialogue | Marginal — floor ≤ W_local < target, no hard rule broken | Pass — W_local ≥ target, all five hard rules pass | Exceeds — W_local ≥ 1.25 × target, all five hard rules pass, filler ≤ 10% | band, evaluated per settlement then min-over-settlements; any hard rule broken is Fail reg |
| RI-DLG03 | 40-dialogue | 3 / 8 dimensions | 5 / 8 dimensions | 7 / 8 dimensions | count of passing dimensions; any automatic fail sinks the item regardless of count |
| RI-DLG04 | 40-dialogue | 5 / 8 checks | 7 / 8 checks | 8 / 8 checks | count of passing checks; checks 1, 3 and 8 are individually disqualifying |
| RI-DLG05 | 40-dialogue | 6 / 10 points | 8 / 10 points | 10 / 10 points | weighted-sum of the 10 scoring points, behind two disqualifying gates (schema lint, prohib |
| RI-DLG06 | 40-dialogue | 5 / 9 checks | 7 / 9 checks | 9 / 9 checks | count of passing checks; the blind archetype test and the classifier test are individually |
| RI-DLG07 | 40-dialogue | professional_bet_accuracy 0.80 | professional_bet_accuracy 0.72 | professional_bet_accuracy 0.55 (chance) with judge_cannot_name_a_consistent_tell = true | band on professional_bet_accuracy — LOWER IS BETTER. ours_win_rate > 0.5 VOIDs the run (it |
| RI-DLG08 | 40-dialogue | 4 / 10 | 6 / 10 | 8 / 10 | weighted mean of the check groups, each 0/1/2, then banded |
| RI-TRV01 | 50-world | 9 / 24 | 12 / 24 | 20 / 24 | sum over 12 checks each scored 2/1/0; any hard fail caps the item at 2 |
| RI-TRV02 | 50-world | 10 / 26 | 13 / 26 | 22 / 26 | sum over 13 checks each scored 2/1/0; any hard fail caps the item at 2 |
| RI-WLD01 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | band, and a gate — a failing scale score invalidates every other world score |
| RI-WLD02 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | weighted mean of D1-D13 plus V5/V6, each 0/1/2, then banded |
| RI-WLD03 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-WLD04 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-WLD05 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-WLD06 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-WLD07 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-WLD08 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-WLD09 | 50-world | 4 / 10 | 6 / 10 | 8 / 10 | weighted mean of the check groups, each 0/1/2, then banded |
| RI-WLD10 | 50-world | 75 / 100 | 82 / 100 | 91 / 100 | weighted-sum of passed check weights, max 100 (we-lose floor 75) |
| RI-WLD11 | 50-world | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-WLD12 | 50-world | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-WLD13 | 50-world | 75 / 100 | 85 / 100 | 93 / 100 | weighted-sum of passed check weights, max 100 (we-lose floor 75) |
| RI-WLD14 | 50-world | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-LOR01 | 60-lore | 2 / 5 on the worst axis | 3 / 5 on the worst axis | 5 / 5 on the worst axis | min-over-axes across the three axes, never the mean; any axis at 0 fails the wave's lore g |
| RI-LOR02 | 60-lore | 2 / 5 | 3 / 5 | 5 / 5 | band on the 0-5 native scale |
| RI-LOR03 | 60-lore | 2 / 5 | 3 / 5 | 5 / 5 | band on the 0-5 native scale |
| RI-LOR04 | 60-lore | 2 / 5 | 3 / 5 | 5 / 5 | band on the 0-5 native scale |
| RI-LOR05 | 60-lore | 2 / 5 | 3 / 5 | 5 / 5 | band on the 0-5 native scale |
| RI-LOR06 | 60-lore | 2 / 5 | 3 / 5 | 5 / 5 | band on the 0-5 native scale |
| RI-LOR07 | 60-lore | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum of passed check weights, max 100 |
| RI-VIS01 | 70-visual | 4 / 10 | 7 / 10 | 10 / 10 | band on the protocol-conformance table; this item's native scale has no 5, 6, 8 or 9 rung  |
| RI-VIS02 | 70-visual | 4 / 10 | 6 / 10 | 8 / 10 | band, per paired shot, then min across shots (RI-VIS01 §E) |
| RI-VIS03 | 70-visual | 4 / 10 | 6 / 10 | 8 / 10 | band on the computed score, then MINIMUM across shots, not mean (RI-VIS01 §E) |
| RI-VIS04 | 70-visual | 4 / 10 | 6 / 10 | 8 / 10 | min(raw, cap) where cap is the lowest 'blocks score above' value among absent features |
| RI-VIS05 | 70-visual | 4 / 10 on the worst component | 6 / 10 on the worst component | 8 / 10 on the worst component | min over the six components, never the mean |
| RI-VIS06 | 70-visual | Protocol A: ours loses all pairs at CONFIDENCE high (cap 5); Protocol B1: ours wins only at CONFIDENCE low (cap 6) | n/a — this item emits no score of its own at this rung | Protocol A: ours loses some and wins some post-escalation (cap 8); Protocol B1 win at high confidence with B2 MATCH strong (no cap) | cap, not score — this item MODIFIES RI-VIS03 (fidelity) and RI-VIS05 (art) and contributes |
| RI-VIS07 | 70-visual | FAIL roll-up on the worst frame (caps the ART score at 5) | n/a — the roll-up is four-valued and has no rung between FAIL and PASS | PASS roll-up on the worst frame (caps the ART score at 8); STRONG PASS imposes no cap | cap, not score — this item MODIFIES RI-VIS05's ART score and contributes no ladder number  |
| RI-VIS08 | 70-visual | 4 / 10 | 6 / 10 | 8 / 10 | band |
| RI-VIS09 | 70-visual | n/a — register/compliance item | n/a — register/compliance item | all five compliance checks pass (the only non-failing state) | gate, not score — any single failure is a hard fail for the visual area of that wave. Cont |
| RI-MTH01 | 80-methods | 70 / 100 | 80 / 100 | 92 / 100 | weighted-sum, normalised to 100; mandatory checks x1.0, optional x0.5 |
| RI-MTH02 | 80-methods | 18 / 24 | 21 / 24 | 24 / 24 | sum over the rungs, max 24 (22 without R9) |
| RI-MTH03 | 80-methods | 75% of applicable points | 88% of applicable points | 100% of applicable points | percentage of applicable points; below 75% the blind result is inadmissible and the item i |
| RI-MTH04 | 80-methods | 24 / 30 | 27 / 30 | 30 / 30 | sum over the checks, max 30; at or below 17 the verdict is deleted as fabricated |
| RI-UIX01 | 86-ui | 7 / 10 checks | 8 / 10 checks | 10 / 10 checks | count of passing checks; any hard fail caps the piece at 2 |
| RI-UIX02 | 86-ui | FAIL on K1, K2, K4, K5 or K6 (below bar, ceiling 6 — the highest honest ladder value once a marker source exists is 4) | n/a — the native verdict is binary; there is no partial-pass rung | PASS on all six detectors (removes a cap; record S8_enforced: true) | gate, not score — scored min(), pass/fail per detector, and it contributes no ladder numbe |
| RI-UIX03 | 86-ui | 9 / 13 checks | 11 / 13 checks | 13 / 13 checks | count of passing checks; any hard fail caps the piece at 2 |
| RI-UIX04 | 86-ui | 8 / 12 checks | 10 / 12 checks | 12 / 12 checks | count of passing checks; any hard fail caps the piece at 2 |
| RI-UIX05 | 86-ui | 7 / 10 checks | 8 / 10 checks | 10 / 10 checks | count of passing checks; any hard fail caps the piece at 2 |
| RI-UIX06 | 86-ui | 5 / 7 checks on the worse side | 6 / 7 checks on the worse side | 7 / 7 checks on the worse side | min over the two independent native scales, which are never combined; any hard fail on a s |
| RI-AUD01 | 87-audio | 6 / 9 checks | 7 / 9 checks | 9 / 9 checks | count of passing checks; any hard fail caps the piece at 2 |
| RI-AUD03 | 87-audio | 4 / 6 checks | 5 / 6 checks | 6 / 6 checks | count of passing checks; any hard fail caps the piece at 2 |
| RI-AUD04 | 87-audio | 5 / 8 checks | 7 / 8 checks | 8 / 8 checks | count of passing checks; any hard fail caps the piece at 2 |
| RI-AUD05 | 87-audio | 5 / 8 checks | 7 / 8 checks | 8 / 8 checks | count of passing checks; any hard fail caps the piece at 2 |

### 3b. The one item edited by someone else in the same window

`RI-DLG09` (the parley) was created by another agent **while this task was running**. The new
C6 check caught it on its first run with no anchor row — the gate's first real encounter with
live drift, and it worked. An anchor row was added; the item's author then rewrote the file
with their own richer row (native 40/60/80 out of 100, plus a "what that build looks like"
row). **Their version stands.** This log records the collision rather than the edit.

## 4. Items that genuinely have no scale to map — a finding, not a licence

The brief anticipated this: *"if an item genuinely has no scale to map, that is a finding, not
a licence to make one up."* **Five items have no native scale**, because they emit no score:

| Item | What it emits instead |
|---|---|
| `RI-UIX02` | a **gate** — six pass/fail detectors, `min()`, binary verdict. It removes a cap; it never raises a score. The AR-2 enforcement point, and the highest-value item in the whole C1 sweep. |
| `RI-VIS09` | a **register / compliance check** — any single failure hard-fails the visual area of the wave |
| `RI-VIS06` | a **cap** on `RI-VIS03`'s FIDELITY and `RI-VIS05`'s ART scores |
| `RI-VIS07` | a **cap** on `RI-VIS05`'s ART score |
| `RI-MTH05` | a **gate** — it already declared itself one, and already carried an anchor table for a critic obliged to report a number |

Their rows are filled with the gate/cap outcomes and carry **`n/a`** at ladder positions their
native scale genuinely does not have (`RI-UIX02` has no partial pass; `RI-VIS07`'s roll-up is
four-valued with no rung between FAIL and PASS). `SCORING.md` §1.2a clause 3 makes `n/a`
admissible **only** for an item that declares itself a gate or a cap and names what it gates or
caps. In an ordinary scored item, `n/a` is the same failure as having no row at all.

One further finding: **`RI-VIS01`'s native scale has rungs 10, 7, 4 and 0 only** — no 5, 6, 8
or 9. Its row is `4 / 7 / 10` and says so, rather than inventing a 6.

## 5. Edits made outside the C1 permission, and why each was in scope

Four files were changed other than by appending an anchor row. None is a reference item
belonging to another agent's area except `RI-MTH05`, which `C14` names explicitly.

| File | Change | Authority |
|---|---|---|
| `corpus/00-doctrine/SCORING.md` | new **§1.2a**: the three recognised anchor forms, the gate/cap clause, and the statement that a verdict-band table alone is not an anchor block | C1 ("either reconcile the other 96 to the mandated format **or** amend §1.2 to accept any table mapping a native band to a ladder number") |
| `corpus/80-methods/RI-MTH05` | M8 amended from false to true with the three wiring locations tabulated; new **M9** (check C6); hard fail 4 sharpened to name `continue-on-error` and `\|\| true` | C14 ("make the assertion in `RI-MTH05` true, or correct it") |
| `corpus/00-doctrine/subsystems.json` | added `wave` to all 325 paths. **No path renamed, removed, or re-titled** — the file's append-only rule is intact. | C3 ("every path assigned a wave") |
| `tools/corpus-index.mjs` | new checks **C6** (anchor row) and **C7** (wave assignment); two new summary lines | C1 and C3 |

## 6. What this agent did NOT do, and why

In the spirit of `CORPUS-COHERENCE-01` §11b, which was the most useful section of that document.

- **Did not reformat the 28 items that already carried an anchor block.** Three orientations
  now coexist. Reconciling them is churn with no measurement value, and §1.2a says so. If a
  future agent wants one orientation, the cost is 28 edits and the benefit is aesthetic.
- **Did not change a single threshold**, including the ones that look wrong. `RI-CMB11` and
  `RI-QST09` use a we-lose floor of 75 where eleven sibling items use 70; `RI-WLD13` uses 75.
  That may be deliberate and it is not this agent's call. It is recorded here so it is not
  rediscovered.
- **Did not write `RI-MTH06`.** `CONTENT-BUDGET.md` §6 specifies the thinning detector to the
  point where a builder can implement it, but writing the reference item is design work and
  would have been this agent scoring its own homework.
- **Did not add the `camera.*` root** (`BAR-CRITIQUE-02` N6 / C6-housekeeping). It is one
  commit — eight paths plus moving `RI-CAM01–07`'s `judges:` in the same change — but it is not
  one of the three blocking conditions, and doing it would have moved seven items' front-matter
  under a permission that covers the scoring section only. `docs/PLAN.md` **W1-06** names the
  camera piece against the paths the items actually judge today, so wave 1 is not blocked by it.
- **Did not adopt `METRICS-IMPLEMENTATION-01`'s A1–A3 into `RI-VIS03`** (C5). That is a wave-4
  condition and it changes bands, which this agent may not do.
- **Did not touch `RI-DLG09` after its author rewrote it.** See §3b.

## 7. What remains contradictory or open

1. **`RI-CMP01`'s declared 27% crossing-direction shortfall is still open.** The item records it
   honestly as an unmet obligation. `docs/PLAN.md` W1-25 assigns an owner for the first time.
2. **`RI-PRG03`'s skill-event budget still over-delivers** at the reconciled 1,230-enemy census.
   Untouched by this pass, as by the last, and for the same reason: re-deriving a skill curve is
   design work.
3. **The four `RI-VIS03` metrics with known-wrong bands (M3, M6, M9, M10) are still scoring**,
   not advisory. C5, wave 4.
4. **`progression.crafting.alchemy` and `progression.inventory.model` are still judged by items
   about something else** (N8). Assigned to wave 3 and wave 1 respectively in `PLAN.md` §4, so
   at least the builder exists; the bar still does not.
5. **The aggregate content budget is unmeasured, not passed.** `CONTENT-BUDGET.md` states the
   totals and the feasibility argument, but until `content-budget.json` and
   `tools/content-budget.mjs` exist, FLOOR-HUG is a specification and nothing computes it.
6. **Nothing yet requires a human to play this before it is called done** —
   `BAR-CRITIQUE-02` §5(b) and C4. Out of scope here, and it is the last real hole in the bar.
