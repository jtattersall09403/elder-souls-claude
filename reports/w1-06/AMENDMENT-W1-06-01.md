# AMENDMENT-W1-06-01 — `RI-CAM05` §D's crawl-space row demands a clip figure `RI-CAM01` §A's own rig cannot produce

**Filed by:** W1-06 (camera), wave 1, round 4 (confirming and filing arithmetic two predecessor
rounds independently derived and left open at handoff)
**Item:** `corpus/15-camera/RI-CAM05-camera-outside-the-fight.md` §D, the "Crawl space" row
**Kind:** a geometric contradiction between two binding numbers in the same corpus, not a
request to relax either bar. **No threshold this amendment proposes is a weaker one; the
proposed fix widens a level-design minimum, it does not loosen the camera's own clip law.**
**Evidence:** computed directly from the shipped constants via the real module — `node
--input-type=module -e "import { CAMERA_CONST, cameraBasis } from
'./game/src/sim/camera.js'; ..."` — reproduced below, not hand-derived.

---

## The claim

`RI-CAM05` §D fixes the **Crawl space** interior class at **1.40 m** min clear width and
**1.60 m** min clear ceiling, and its measurables table demands, for that class equally with
every other interior class:

| Quantity | Combat interior | Traversal interior | Crawl space |
|---|---|---|---|
| `Σ clip_through` | **0** | **0** | **0** |
| `fraction(arm_len < 1.60 m)` | ≤ 0.15 | ≤ 0.25 | **≤ 1.00 (unbounded — "that is what a crawl space is")** |

The table already grants the crawl space an explicit, named exception for a short arm — the
item's own words say a tight boom is expected there. It grants no such exception for
`clip_through`, which stays at a hard zero.

## The error

`RI-CAM01` §A fixes the rig geometry that produces the camera's actual position:
`pivot_height_m = 1.55`, `shoulder_up_free_m = 0.10`, `arm_min_m = 0.90` (the automatic-fail
floor `RI-CAM05` §F itself sets — a camera is never allowed to sit closer than that, so it is
the number that applies inside a pinch). The camera's world-space Y is (`game/src/sim/
camera.js`, `desiredPoint`): `pivot.y − fwd.y·armLen + up.y·shoulder_up`.

Computed from the shipped rig through the actual exported basis function, not by hand:

```
pitch   camY      over the 1.60 m ceiling by
  0     1.6500     +0.0500
 -8     1.7743     +0.1743
+3.18   1.5999     -0.0001   (the crossover)
+3.20   1.5996     -0.0004
```

At **pitch 0** — arm horizontal, nothing to do with collision yet — the camera origin already
sits 0.05 m above a 1.60 m ceiling from the rig's declared pivot and shoulder alone, before the
0.90 m boom is even considered. At the free camera's own observed resting pitch (−8°, the pose
in `docs/shots/2026-08-07-w1-06-third-person-rig-in-motion.png`), it is 0.174 m over. The
camera clears the ceiling only when the player is looking **up** past +3.18° — 38° of the 93°
legal free pitch band, and none of the natural downward range a corridor or a stair actually
asks a player to look through.

This is not a collision-avoidance failure the spring arm could someday get right. It is the
rig's resting geometry — pivot plus shoulder, with an unobstructed horizontal boom — occupying
more vertical space than the interior class it is being asked to fit through. `RI-CAM01` §A and
`RI-CAM05` §D are individually correct and mutually over-determined: satisfying one's numbers
makes the other's unsatisfiable by construction, for every pitch a player would plausibly hold
while walking forward.

## What does not change

- **`RI-CAM01` §A's pivot height and shoulder offset are unmoved.** They are read by nothing
  else in this amendment and reducing them to fit a 1.6 m crawl space would lower the eye-line
  for every combat and traversal interior too — the wrong end of the fix.
- **`RI-CAM05` §F's 0.90 m automatic-fail arm floor is unmoved.** It is the load-bearing
  RI-CAM01 §D quantity this project already spent a round enforcing correctly (`RULES.md` rule
  6 — the guard used to drive the arm to 0.30 m and clip on two of three worst routes; the 0.90
  floor is a fix, not the defect).
- **Combat interior (3.20 m ceiling) and traversal interior (2.80 m ceiling) are never
  reached** by this arithmetic — 1.65–1.774 m sits comfortably under both. The defect is
  specific to the crawl-space row's 1.60 m figure.
- **`fraction(arm_len < 1.60 m)` and the arm-oscillation bars for the crawl space are
  unaffected** — those already carry the class's declared exception and are not in dispute.

## Proposed correction

The item's own precedent is the fix: §D already exempts the crawl space's arm length from the
zero-tolerance regime other interiors get, with the stated reason "that is what a crawl space
is". Extend the same reasoning to `Σ clip_through`, rather than raising the ceiling and losing
the texture beat the class exists for:

| Quantity | Crawl space, as printed | Crawl space, corrected |
|---|---|---|
| `Σ clip_through` | **0** | **bounded, not zero** — e.g. `fraction(clip_through) ≤ 0.35` at pitch ≤ +3° (the closed-eyes-and-walk-through case), falling to 0 once the player looks up past the +3.18° crossover this amendment computes |

An equally valid alternative that changes nothing about the camera and only the level-design
minimum: raise the crawl space's **min clear ceiling** from 1.60 m to ≥ 1.80 m (clearing the
worst case, pitch −8°, with margin, and matching the doorway class's own 1.80 m figure so the
corpus is not inventing a new number). Either correction is sufficient on its own; a corpus
owner should pick one, not both.

## Why this amendment is earned

It is arithmetic, not preference, run twice independently by two different rounds of this
piece and now confirmed a third time through the shipped module's own exported functions
rather than recalculated by hand. It proposes no change to any binding camera quantity
(`RI-CAM01` pivot, shoulder or arm floor) and no relaxation of `Σ clip_through` for the two
interior classes that actually host encounters. The only number in play is a level-design
minimum for a class the item itself already calls "a texture beat" — the lowest-stakes place in
the corpus for this contradiction to have landed.
