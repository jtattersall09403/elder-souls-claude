# AMENDMENT-W1-10-03 — three bar defects found by building to the bar

**Filed by:** W1-10 round 3 builder (ULTRACODE)
**Against:** `RI-WPN05` §E / §E.2, `RI-WPN02` §B (WHP row) and §D (D6), `RI-WPN05` §F
**Status:** proposed. Nothing in this file has been applied to any reference item.

Every defect below was found by *building to the bar and measuring the result*, not by reading it.
Each carries the arithmetic that proves it, and each names what I did instead. Where I could close
the gap without an amendment I closed it and did not file — this file is only the residue.

---

## A. The pose-discontinuity ceiling and the peak-tip-speed band are mutually unsatisfiable

`RI-WPN05` §E.2 row 1:

> | **Pose discontinuity** | max per-frame world displacement of any tracked bone | **≤ 0.25 m** at 60 Hz (15 m/s of bone travel). A larger jump is a pose snap, not motion |
> - **HARD FAIL** if any clip's pose discontinuity exceeds **1.0 m** in a frame

`RI-WPN05` §E row 1:

> | Peak tip speed (m/s) | max over the animation | light **14–20** | medium **18–26** | heavy **22–32** | ultra **26–40** |

**These cannot both hold of a weapon tip.** 0.25 m/frame at 60 Hz is 15 m/s. §E's *minimum*
acceptable peak tip speed, for the *lightest* class in the game, is 14 m/s, and its floor for an
ultra greatsword is 26 m/s — 0.433 m/frame. A build that satisfies §E's band violates §E.2's
ceiling on every class, by construction, and a build that satisfies §E.2's ceiling has no weapon in
it that swings.

### What I did

I read §E.2's row as written — *"any tracked **bone**"* — and measured bones and weapon sockets
separately. A bone is part of the character; the weapon socket is a point on the end of a lever up
to 2.86 m long, and it is governed by the row §E wrote for it.

Measured over 606 clips (`tools/weapons/motion-census.mjs`):

| Reading | > 0.25 m/frame | > 1.00 m/frame (HARD FAIL) | worst |
|---|---|---|---|
| **skeleton bones** | 15.5 % | **0** | 0.998 m — `fst_hist_talon/roll.r1` |
| weapon socket | 47 % | 31 | 1.943 m — `whp_hide_lash/2h.roll.r2` |

### Proposed replacement text for §E.2 row 1

> | **Pose discontinuity** | max per-frame world displacement of any **skeleton bone** (the weapon
> sockets are excluded and are governed by the tip-speed row below, which is the row written for
> them) | ≤ 0.25 m at 60 Hz |
> | **Weapon-socket discontinuity** | max per-frame world displacement of either weapon socket |
> ≤ the tier's §E peak-tip-speed band ceiling ÷ 60, × 1.25 |
>
> **HARD FAIL** if any **bone** exceeds 1.0 m in a frame.

This keeps the check that matters — a *character* that teleports — and stops the item failing every
weapon in the game for swinging at the speed the item next door requires.

---

## B. `RI-WPN02` §B's WHP row is over-determined and physically inconsistent

§B pins, simultaneously, for the whip's `r1.1`:

| Column | Value |
|---|---|
| `arc_sweep_deg` | **200°** |
| `reach_m` | **3.60 m** |
| R1 startup / total | **40 / 108 f@60** |

and `RI-WPN04` §A pins the active/recovery split at **40 / 10 / 58**, gated at ±0 f by
`tools/weapons/verify-frames.mjs`.

The whip's damaging capsule is 2.86 m long and the hand sits ≈0.45 m from the character's axis, so
the tip's radius is ≈3.31 m. Sweeping 200° in 10 active frames:

```
tip speed = (200° in radians) × 3.31 m × 60 Hz / 10 frames  =  69.3 m/s
```

against `RI-WPN05` §E's medium band of **18–26 m/s** and §E.2's ceiling of 26 × 1.25 = **32.5 m/s**.
The whip is **2.1×** over the ceiling of the item that grades it, and there is no free variable: arc,
reach and every frame count are published.

### What I tried, and why I reverted it

The active/recovery split is the only lever that does not change a published total. Widening
`whp_hide_lash` `r1.1` from 40/10/58 to 40/22/46 brings the tip to 31.5 m/s — inside the ceiling —
and leaves the 108-frame total untouched. Applied across the 174 slots that need it,
`verify-frames.mjs` went from **70/70 to 64/70** on `RI-WPN04` §A's contextual table, because that
table gates the split itself. **So I reverted it.** Breaking a published gate to satisfy a derived
one is not a builder's call.

### Proposed resolution — one of these three, and the item's owner picks

1. **Widen WHP's active windows** and republish `RI-WPN04` §A's WHP rows. A lash that lingers is
   also the better animation: 10 active frames on a 3.6 m weapon is a strobe.
2. **Reduce WHP's `arc_sweep_deg`** from 200° to ≈95°, which is what 10 active frames can deliver
   inside the band. This costs the whip its "widest arc in the medium tier" identity.
3. **Exempt WHP from §E's tip-speed band** with a written reason — a lash is not a rigid lever and
   a real whip tip genuinely does exceed every band in the table. This is the honest answer if the
   whip is meant to be the class that breaks the rule, but it must then be *written down* rather
   than left as a failing cell.

I recommend **1**. It is the only option that costs nothing the class was designed for.

---

## C. D6's arc is degenerate for a steep swing plane

`RI-WPN02` §D D6 is *"total angular travel of the hitbox capsule about the player's Y axis"*. For a
swing whose plane is near vertical the capsule is near that axis, and the measure stops describing
the swing:

- `clip_splitter_plunge` has `plane_deg` **91.6°** — a dive, straight down. Its tip passes within
  a few centimetres of the character's own vertical axis, where a 2 cm sideways movement is 180° of
  bearing. Declared arc 11.3°; measured 152.6°.
- **25 of the 44 clips** that still fail arc conformance in this build have a swing plane over 70°,
  and **14 of them are `plunge`**.

The near-axis guard `RI-WPN02` M1 sub-probe D already carries (drop frames whose horizontal radius
is under 0.20 m) is the right idea and is set too low for a 3 m weapon: it is an absolute threshold
on a quantity that scales with the capsule.

### Proposed replacement for D6's measurement note

> Measured as the total angular travel of the capsule about the player's Y axis, **in the swing's
> own plane**: project the capsule direction onto the plane normal to
> `(sin(plane_deg), cos(plane_deg))` before taking the bearing. The near-axis guard drops frames
> whose radius from the axis, **in that plane**, is under `max(0.20 m, 0.10 × capsule_length_m)`.
> A clip whose declared `plane_deg` exceeds 70° is measured about its own swing axis rather than
> about Y, and reports `arc_axis: 'plane'` in the artifact so a reader knows which was used.

**I have not adopted this.** Every arc number I report is measured with the round-2 critic's
unmodified instrument, on its terms, because adopting my own instrument to grade my own build is
the failure mode the round-2 verdict named in its opening paragraph.

---

## D. `ILS`'s classifier still recovers 0 by construction — confirming the round-2 filing

`RI-WPN05` §F asks a nearest-neighbour classifier over 35 unique (tier × material) points to
recover each point's own label, leave-one-out. Its nearest neighbour is by definition a *different*
cell, so it recovers its own label **never**. The round-2 critic filed this; I ran it and confirm
it independently:

```
ILS_1nn     0.0000       (RI-WPN05 §F as written, leave-one-out over 35 cells)
ILS_unique  0.8286       (fraction of the 35 cells whose observable triple is distinct)
```

The second is the property the score is *about* — "the player can tell what they hit and what
with" — and this build passes it at 0.8286 against a 0.80 bar. `tools/weapons/impact-census.mjs`
reports both, always, and neither is presented as the other.

### Proposed replacement for §F's definition

```
For each of the 35 (weight tier × material) cells:
  run one hit, extract the observable triple (attacker_hitstop, camera_shake_peak, knockback_m)
  z-normalise each channel across the 35 cells
ILS = the fraction of cells whose triple is separated from EVERY other cell's by at least
      0.50 in the normalised space  (i.e. the fraction a player could distinguish, not the
      fraction a classifier can label from a training set that excludes the answer)
```

The 0.80 / 0.50 / 0.40 thresholds are unchanged; only the classifier is replaced, because a
classifier that must recover a label from a set that excludes it is not a measurement.
