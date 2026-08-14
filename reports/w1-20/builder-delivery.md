# W1-20 builder delivery — continuation

Commit under test: the commit containing this report; run `git rev-parse --short HEAD` when reproducing the evidence.

## Builder row accounting

| Plan row | Builder result | Evidence |
|---|---|---|
| 1 faction escalation population | PASS | Eight lines, 18 quests each, 2.25/rank, no empty bands (`critic-w1-20-census.mjs`). |
| 2 texture/escalation | PASS (builder/static) | Every line has deceit; continuation supplies investigation, moral dilemma, dirty work, politics, rival conflict and succession in rank order. Independent prose/blind judgement is NOT_RUN. |
| 3 playable joining / continued ranks | PASS (builder) | Seven existing joining routes preserved; the distinct Deep Kin line now has discoverable rank-band work through rank 7. Fresh independent play criticism remains required. |
| 4 RI-QST01 native hard fails | PASS | Census exits 0 with no warning. |
| 5 RI-QST03 four-term gates | PRESERVED/PASS | Existing eight exact ladders remain authoritative; dynamic below/at/above refusal implementation is unchanged. |
| 6 reputation arithmetic | PASS | Duplicate quest-level positive awards removed; positive awards are one resolution-side `+4..+10`; four joining resolutions net 10. |
| 7 completability/slack | PASS | Per-line earnable/112 is 1.13–1.46, within 1.0–1.6. |
| 8 six refusal kinds | PRESERVED | Existing live dynamic refusal census retained. Fresh independent listening is NOT_RUN. |
| 9 discipline/readmission | PASS (builder/static) | All eight runtime lines have an expulsion flag and priced, reputation-gated, named-giver readmission. End-to-end independent play criticism is NOT_RUN. |
| 10 property/live ownership | PASS (builder/runtime seam) | Every standing id has a faction interior; rank-gated service access is consumed on the live engine. Independent theft/trespass play criticism remains required. |
| 11 relationships/exclusivity/identity | PASS (builder) | Registry carries rivals and allegiance; Deep Kin is explicitly distinct from the Xul-Aneekh, preserving Q-MAG-07 and both ledgers. Existing exclusivity path is preserved. |
| 12 canon/era registry | PASS (builder/static) | All eight records carry current canon/doctrine links and institutional descriptions. Independent lore comparison is NOT_RUN. |
| 13 institutional voice | BUILT / NOT_RUN | Distinct motifs and rank-scaled prose are authored; required fresh blind comparison is NOT_RUN. |
| 14 reachability | BUILT / NOT_RUN | Named representatives and faction-interior seats resolve. Four-bearing fresh critic walks are NOT_RUN. |
| 15 W1-20 UI seam | PRESERVED | No HUD/UI file changed; existing dynamic refusal and wrap path retained. Independent text/rect judgement is NOT_RUN. |

## RI-MTH07

`tools/quests/w1-20-builder.mjs` perturbs the same live faction object from non-member/rank 0 to member/rank 4 for all eight lines. The world-side `Engine.factionAccess()` consumer moves from zero services to the three services allowed by that faction's live rank while retaining its representative, physical seat, rival and quest hook. The 33/33 report is in `reports/w1-20/builder-continuation.json`.

## Critic handoff

Fresh critic should prioritize: four-bearing walks to every representative/readmission giver/seat; theft and trespass at rank 0/1/2; full below/at/above gate matrix; offence→expulsion→refusal→readmission; native lore comparisons; and blind institutional-prose judgement. Independent prose/judge rows above intentionally remain `NOT_RUN` rather than being self-scored.
