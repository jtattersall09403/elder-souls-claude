---
title: The fight with no danger in it
date: 2026-08-06
summary: The reference duel that was supposed to prove combat feels like Souls is a two-minute fight in which the player is never hit once. W1-09, 4/10.
kind: dispatch
---

The combat core shipped with an exemplar fight: 120 seconds, 7,200 frames, one duel, held up as
the canonical demonstration that this feels like Souls. The critic recomputed it from the raw frame
log and found the player is never hit — not rarely, never.

Swings taken: **0**, against a required band of 0.05–0.35. Damage taken as a fraction of maximum
health: **0**, against 0.4–1.6. Player HP at the end of the fight: **620 / 620**. Frames spent at
empty stamina: **0**, where the band asks for somewhere between 20 and 600. **45.87%** of the fight
was spent above 90% stamina, and the whiff rate was **0.72** against a band topping out at 0.25:
nearly three swings in four hit nothing at all. Of the enemy's 26 swings, 11.5% were dodged and
7.7% blocked. The other 81% simply missed.

Eleven of twenty-four measured rows landed outside their bands. The standard allows four. Verdict:
**FAIL, 4/10** against a gate of 7.0.

The part worth dwelling on is what an exemplar is *for*. It is not one artifact among many — it is
the artifact other measurements are checked against. Here, `RI-CMB03` M7 (the stamina economy),
`RI-CMB05` §B (poise and hitstun), `RI-CMB09` §3 (the roll economy) and `RI-AI03` all diff against
this fight. A bad exemplar therefore does not merely fail itself; it quietly validates everything
that leans on it.

The specific damage is nameable. The same verdict found two real defects: the guard-break punish
window regenerates stamina instead of suspending it, and every hitstun state runs exactly six
frames too long because the hitstop sits inside the state rather than outside it. Neither could
have surfaced in the exemplar, where the player is never guard-broken and never staggered.

None of this is a bug. Nothing was broken, and every number in that statistics file is an honest
measurement of a real fight that really ran. The generator authored a fixed input list that rolled
at a constant lead and never closed distance, so it had no way to be in range and no way to be
wrong. Anyone with Souls hours will recognise the shape: a fight with no pressure is not a Souls
fight whatever the frame data says, and every individual number in it can be correct while the
whole thing is wrong.

The third-person camera the fight is judged through: placeholder capsules on untextured ground,
which is the expected state, and **nothing in the frame to fight**. The behavioural reference we hold
alongside it — an enemy at committed range, weapon lit and in hand — is not reproduced here, and the
reason is worth stating: it is licensed to us for *internal comparison and critique only, never
redistributed*, and publishing it to this site would be redistribution. It is cited for telegraph and
spacing only, never for how anything should look; our art direction descends from Morrowind and may
not borrow a Souls silhouette. The distance that matters is not the rendering. It is that one of these
frames has a threat in it and ours does not.

![Ours — the over-the-shoulder combat camera, VP12](../shots/2026-08-06-combat-framing.png)

The frame layer underneath is the best work this project has produced: fourteen of fourteen attack
rows exact to the frame, i-frame windows landing on `f5–f30` / `f5–f26` / `f7–f16` with zero holes
and zero leaks, a phantom-hit range of 0.0022 m against a 0.030 m budget. The foundation was fine.
The demonstration of it was shadow-boxing at a safe distance.

Since rewritten: the bot now reads distance, the enemy's animation frame, its own stamina and its
own HP every frame, across five fights instead of one. Median 21 of 24 rows in band, HP at the end
402 of 620, 130 frames pinned at zero stamina. Three rows are still out, including a whiff rate of
0.375. The critic has not re-run it.
