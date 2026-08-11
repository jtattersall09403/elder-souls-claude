# W1-29 builder delivery

Commit stamp: populated by the delivery commit. Runtime artifacts are transient under
`reports/w1-29-builder/`; no PNG or other binary evidence is committed.

## Complete action/modality ledger

| Population | Public path exercised | Result |
|---|---|---|
| Both pad profiles and all 16 closed-set actions | `navigator.getGamepads()`/`__HARNESS.gamepad()` → `RealInput.pollGamepad()` → `GamepadRouter` → `InputPipeline` → world/UI consumers | M-P1 both profiles green; Guide remains unbound; menu and opening consumers retained |
| Movement / run / sprint / roll | left-stick radial transform and index-1 tap/hold through the pad router; floating touch stick and shared hold gate through `TouchInput` | exact 0.14/0.92 radial band, 0.55 gait boundary, 12-frame gate, 36 bearings green |
| Look | right-stick router → fixed-step camera | monotone quadratic response, render-rate-independent at 0/15/60 Hz |
| Attack / block / parry / interact / use / lock / swaps / two-hand / jump / crouch / spell-cycle | physical pad buttons and touch controls/drawer → action pipeline → combat/world/UI | both profile maps complete; touch reach 16/16; simultaneous stick + camera + two buttons green |
| Analog triggers | raw `.value` → auto-zero → hysteresis/charge → combat input | fire 0.35, release 0.20, full 0.85; stable-rest auto-zero no longer mistakes a startup pull for neutral |
| Lifecycle / multi-pad | connect, disconnect, reconnect, replacement at index 0, two simultaneous pads | same-frame release, no modal/pause, most-recent device wins; all six calibration disconnect positions clear and replacement A/RB fire `interact`/`light` |
| Touch lifecycle | real touch handler seam → floating stick/camera/buttons → world | four concurrent pointers, release drift zero, pad-hide at 2 s, first-touch restore, dialogue suppression retained |
| Mobile viewport | viewport/orientation/safe-area public model → renderer/input layout | landscape rotate state, safe-area targets, chrome collapse, gesture suppression, wake/orientation capability and phone budgets green |
| Mobile readable surfaces | dialogue renderer and vector menu glyph renderer | dialogue, journal and book minimum is 18 CSS px at 844×390 DPR 2 |
| Prompt/refusal/drawing | active-device glyph, rotate state, touch overlay and reserved-control models → rendered pixels/text register | glyph changes within two frames; touch/rotate coupling pixel hashes differ; null control stable |
| Keyboard/mouse seam | unchanged desktop profile and DOM path | boot/data gates green; no desktop bindings changed |

## Controls and falsification

`input-checks` re-ran the native pad/viewport population after repair: 23/23 green. The calibration-only
rerun exercises disconnects at prompts 0–5 and is green. The existing touch/viewport run reports
24/28 with its four pre-repair reds; the post-repair pad/viewport rerun closes all four (trigger,
charge, exact radial edge and three text surfaces). `w1-08-29-r2-coupling` reports three live
player-visible couplings, stable null control, clean held state, and a delete-the-fix arm.

The attempted filtered `--group pad --self-test` is not accepted as evidence: the tool still runs
six desktop/viewport perturbations excluded by the group filter and consequently labels those six
vacuous (10/16 relevant/selected legs went red). The normal native checks and the dedicated coupling
control are the admissible controls for this delivery.

## Critic handoff

Fresh critic should start with `orchestration/plans/W1-29.md`, rerun the aggregate without a group
filter, then attack calibration disconnect prompt positions, trigger startup motion, the mobile text
floor's clipping/readability (not merely its register), overlay/rotate draw coupling, and the complete
consumption census. JC-04N remains an independent-actor requirement: the builder neither fabricates
nor judges its isolated transcript. No independent PASS is claimed here.
