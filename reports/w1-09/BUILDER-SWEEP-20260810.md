# BUILDER SWEEP COMPLETE — W1-09

Builder evidence only. This document does **not** issue a W1-09 verdict or call the piece PASS.

## Tested commit

The pass started from `2b7a661a82b5812e16ba3aad960ba3d19b321379` and the production delta is
the one-frame `combo_b` startup change subsequently committed with this pack.

## Exact implementation delta

`champion_hist_marked.combo_b.startup` is 23 f@60 rather than 22 f@60. The active window remains
10 frames, recovery remains 70 frames, the `cut_diagonal` clip is byte-unchanged, and the attack
remains declared reactable. This repairs RI-CMB12 M1 without exceeding RI-CMB04's tip-speed ceiling,
without suppressing the row, and without changing the clip geometry to manufacture readability.

The current instrument measures `f_vis=16/44` (idle/walk), `f_active=35/63`, `t_label=23`, and
`t_react=19` in both entry arms. All four champion attacks clear M1; reactable share is 1.00 and
the reaction-time spread is 41 frames.

## Control

The delete-fix arm restores startup 22 in a temporary copy of the production file and runs the same
instrument. It restores `f_active=34/62`, `t_label=22`, and `t_react=18`; the tool exits 1 on the
native 19-frame floor. Restoring the fixed file returns exactly `t_react=19` and exit 0. This is a
discriminating baseline/fix/delete-fix result, not an exemplar-only tuning claim.

## S40 / RI-CMB09 invariant

This pass does not edit roll or stamina production, models, fixtures, or consumers. S40 remains:
52 f cadence; suppression on `f0+1..f0+42`; regeneration on nine frames `f0+43..f0+51`; 6.75
stamina per completed interval; seven starts; 6.5 after the seventh; 13.25 at the next press; denial
at `f0+364`, canonical frame 366. The rejected zero-regeneration arm remains five rolls/frame 260.
No fresh RI-CMB09 claim is made: its native census and blind M7 remain `NOT_RUN` in this pass.
The existing stamina probe's stale five-roll/frame-260 `declared` block was repaired to distinguish
the governing positive arm from the rejected red arm; the live probe observes seven starts and
canonical denial frame 366.

## Current rows by builder evidence

### GREEN

- RI-CMB12 M1, champion `combo_b`, both native idle and walk entries: fresh builder pass.
- RI-CMB12 M1 aggregate over all four champion moves: fresh builder pass.
- Corpus index/coherence and the browser boot check: green controls at the base tree.

### RED (preserved current-state debt, not reinterpreted)

- RI-CMB04 M9: substep ablation has an empty changed set.
- RI-CMB04/weapon seam: the round-4 1,264-clip tip-speed residual remains.
- RI-CMB04 M8 geometry: `sweep_wide` retains the documented 0.547 m minimum-axis residual.
- Combat animation transition: the documented roll-to-attack vertical boundary snap remains.
- RI-CMB07 M2-LIVE remains zero seam debt pending real W1-12 AI, and its automatic-fail population
  cannot be declared green by this repair.

### NOT_RUN critic/blind rows

- RI-CMB09 M7 rendered blind recovery comparison.
- RI-AI02 M4, RI-VIS08 human/rendered animation judgement, and every other native independent or
  blind predicate in the satisfied plan.
- RI-CMB07 M1 while the canonical exemplar remains invalidated; no synthetic counterpart was made.
- Fresh independent recomputation, complete predicate expansion, digest qualification, and the final
  W1-09 aggregation. The builder does not judge its own pack.

### Dependency-blocked rows

- W1-12: real enemy AI/encounter behaviour, including RI-CMB07 M2-LIVE and the AI-policy portions of
  RI-AI02/03/04/05.
- W1-10/W1-11: complete weapon population and rendered impact-feel inputs.
- W1-13, W1-16, W1-21, and W1-08/W1-29: death, progression, HUD, and device/input seam evidence.
Missing or stale sibling evidence is `not_run`, never green.

## Applicability outcome

`applicability-ledger.json` records the repaired row as W1-09-owned/applicable through its complete
producer→model→consumer trace. It records no sibling reuse and no `not applicable` row. All remaining
governing items are conservatively `not_run`; none is classified away for cost or convenience.

## Invalidations and plan defects

No new cross-piece invalidation was introduced. No defect was found in the satisfied plan. The prior
round's assertion that the 22-frame finisher posed an unavoidable corpus conflict is superseded by the
narrow timing repair: adding one committed startup frame meets the native reaction floor while leaving
the governed clip and speed ceiling unchanged.

## Artifacts and tools

- `cmb-exchange-fixed.json`: fixed positive arm.
- `cmb-exchange-delete-fix.json`: deliberately restored 22-frame red arm.
- `applicability-ledger.json`: fail-closed continuation ledger.
- `tools/harness/cmb-exchange.mjs`: existing native RI-CMB12 instrument; no parallel combat model.
- `tools/corpus-index.mjs --check`, `tools/harness/boot-check.mjs`, and `tools/contention.mjs --gate`.

## Exact independent critic handoff

Checkout the tested commit. First verify the two JSON arms independently from raw state rather than
trusting this summary: run `cmb-exchange --probe react` unchanged, then restore only
`champion_hist_marked.combo_b.startup=22` on a copy and require exit 1 with `t_react=18`; restore 23
and require exit 0 with `t_react=19`. Confirm active/recovery, clip digest, reach, damage, and speed did
not move. Then expand the plan's fail-closed predicate ledger, validate any sibling evidence by ancestry
and determining-input digests, run remaining cheap native rows before browser work, preserve every
listed RED/dependency/NOT_RUN row, and independently judge the consolidated pack and aggregate. Do not
accept this builder's GREEN labels as an independent verdict.
