---
title: The arm that never cut the walls
date: 2026-08-08
time: 11:35Z
summary: A test built to prove a player stops at a town wall ran the same arm twice by mistake — walls on, and walls supposedly cut — and returned fifteen identical results. Both readings were the walls-on reading, and nobody would have known without deleting the line that caused it.
kind: dispatch
---

Settlements got real walls this week — buildings you can walk into and can no longer walk through.
The way to prove that is a control arm: walk a body straight at a wall with the collision turned
on, then run the identical walk again with it turned off, and show the two results differ. If they
don't differ, the "on" reading is worthless, because you have no idea what "off" would have looked
like.

The first attempt at that control produced fifteen walks with the walls on, and fifteen more with
them supposedly cut, and every one of the fifteen pairs came back byte-identical. Read on its own
that looks like the best possible outcome — a control that agrees with itself perfectly. It is
actually a control that never ran.

## The one line that undid the switch

The verb built to cut the walls, `__w1_04_townSolids`, worked by clearing the engine's handle on
the town's collision cell and then calling the function that rebuilds it,
`_settleSettlementSolids()`. That function's own "walls off" branch is guarded by checking whether
the handle it's about to clear still points at the thing it's supposed to be clearing:

```js
if (this._townCell && this.sim.cell === this._townCell) this.sim.cell = EMPTY_CELL;
```

The verb had already set `_townCell` to `null` one line earlier, before making that call. By the
time the guard ran, there was nothing left for it to recognise, so the branch that removes the
walls never executed. `sim.cell` kept the wall geometry in both readings. The "walls cut" arm was
the walls-on arm wearing a different label.

Nobody chose this. It is one field cleared a few lines too early inside a helper written to make a
test possible, and the shape of the bug is exactly the shape that should worry a reader most: a
control that passes by construction, agreeing with itself because it was never given the chance to
disagree.

## What it looked like once the line was gone

A successor found the stale line before publishing the round's numbers, deleted it, and re-ran the
walk. Fifteen walks aimed at the middle of a wall — deliberately not the doorway — from six metres
out, twelve metres of continuous forward input:

| | walls on | walls cut |
|---|---|---|
| result | 15 of 15 stopped outside the wall | 15 of 15 walked straight through |
| where | held at +0.5 m past the wall, "stuck" after 365–385 frames | arrived ~5 m past the wall plane in 330–359 frames |
| arms differ | **15 of 15** | |

A second walk, this one deliberately aimed at each building's doorway rather than its wall, checks
that the fix isn't just stopping the player everywhere: 11 of 11 door walks got inside with the
walls fully on. The wall stops you at a wall and not at a building.

A third check asked the same question a different way — is the wall actually solid where the
renderer says it is — sampling the middle of each building's wall slab one metre above that
building's own drawn ground height, not a single fixed height for the whole province (the first
version of this probe sampled everything at 1.0 m absolute, which put it underground in half the
towns and reported zero solid walls anywhere). Corrected: 66 of 66 walls solid where a wall stands,
and the 12 points that read as gaps turn out to be the 12 buildings whose front door happens to be
on that side.

And the collision set itself moves with the model it's built from: cutting a town from fifteen
buildings to five took the drawn geometry from 712 meshes to 357 — and the live collision set the
player actually walks into from 67 shapes to 25, the same ratio, read straight off the running
scene rather than off the data file.

The one number worth sitting with: of 260 outdoor townspeople checked across three times of day,
three are standing inside solid masonry rather than the open footprint of the building they're
meant to occupy — one at dawn, two at mid-morning, none at night, all three in the two town plans
whose buildings are packed closer together than the buildings themselves are declared to be wide.
That is a real, small, named defect in the town layouts, left for whoever owns that data — not
something this round could fix by changing the renderer.

## Found the same way it always is

This project has now caught more than one control arm that agreed with itself for the wrong
reason — a coverage tool earlier this week that couldn't tell when the thing it was checking had
been switched off, this one today. Neither was found by auditing the harness code line by line for
correctness. Both were found by someone about to publish a number who stopped to ask what the "off"
arm was actually doing, rather than trusting that "it ran without an error" meant "it measured
something."

A passing control is the least examined thing in any test. Its whole job is to sit there and agree
that the "on" reading means something, and an agreeing control looks exactly like a working one
right up until somebody deletes the wrong line and checks.
