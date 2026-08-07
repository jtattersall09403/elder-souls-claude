# AMENDMENT-W1-10-04 — the blade was underground, and `extend` was pointing it there

**Filed by:** the W1-10 round-4 builder.
**Closes:** `AMENDMENT-W1-10-CRITIC-02` §A ("`Reach (m)` is a horizontal radius and says nothing
about height"), and `orchestration/NEXT-DISPATCH.md` §1.
**Against:** `RI-WPN02` §B (the `Reach (m)` definition), `RI-WPN05` §E.2 (motion integrity).
**Status:** the code and data changes are applied; the reference-item edits below are proposed.

The renderer landed and made the defect visible for the first time. It is not a render defect and
it was not fixed in the renderer. It is two pieces of arithmetic, one of them the cause and one of
them the amplifier, and both are upstream of the drawn picture.

---

## A. The cause — `extend` decided which way the weapon pointed, and decided it backwards

`skeleton.json §weapon.blade_axis_local` runs the weapon along the grip hand's local −Y, so the
weapon's world direction is the sum of the `rx` of every bone from pelvis to hand. **A sum of −90°
presents the weapon horizontally forward; 0° hangs it straight down.**

Before this round the shoulder and elbow summed, at the moment of contact, to

```
upperarm_r.rx + lowerarm_r.rx  =  (−8 − 46(1−e)) + (−78 + 74e)  =  −132 + 120·e
```

and nothing anywhere targeted −90. So `extend` — declared in `swing.js`'s own header as *"arm
extension at the moment of contact, 0 = tucked (a chop), 1 = straight (a thrust)"* — was silently
in charge of the weapon's attitude, with the sign inverted against its meaning:

| `extend` | shoulder | elbow | chain sum | what the weapon does |
|---|---|---|---|---|
| **1.00** (a THRUST) | −8° | −4° | −12° | straight arm **hanging at the side**, point in the floor |
| 0.28 | −40° | −57° | −97° | the only value that presents a level blade — no clip declares it |
| **0.00** (a chop) | −54° | −78° | −132° | weapon cocked **42° above horizontal at contact** |

Every spear and every thrusting sword in the roster declares `extend` 0.95–1.00.

Measured over the 82 lead slots of the shipped roster (`tools/weapons/blade-height.mjs`):

| | before | after |
|---|---|---|
| active frames with the tip above the floor | **546 / 974 (56.1%)** | **894 / 974 (91.8%)** |
| weapons underground on *every* active frame | **22** | **0** |
| lowest tip over the whole clip | **−2.671 m** | −1.179 m |
| blade inclination, mean at rest / at deepest | −31.9° / −56.4° | −18.6° / −34.6° |
| SPR active frames above the floor | **2 / 56** | **56 / 56** |
| TSW | **0 / 40** | **40 / 40** |
| WHP | **0 / 40** | **40 / 40** |

**The fix** (`swing.js §ARM_LINE`): the shoulder-plus-elbow angle is authored at each of the six
phase anchors — cocked high through the windup, level at contact, dropping through the
follow-through — the **elbow keeps its own curve unchanged**, because the elbow is what `extend`
means and what moves the socket `RI-WPN04` §D T4 measures, and the **shoulder takes the
remainder**. Extension now redistributes the arm between two joints instead of dropping the whole
arm, which is what an arm does.

It is closed form and it lives *inside* `buildSwing`, therefore inside `calibrateYawGain`'s
measurement loop, so the gain re-solves against the pose it produces. That is the difference
between it and round 3's reverted `calibrateBladePitch`, which was a per-clip **solve** bolted on
outside and spent 40.4% arc nonconformance fighting the gain solver. **Arc nonconformance did not
rise here. It fell, from 10.41% to 4.76% over 2,689 clips.**

### The values are bounded, not tuned

Raise the arm line and the weapon rides higher — until it rides *above* a standing body and
weapons stop reaching the `reach_m` they declare. Measured: shortfalls appear at a −50° contact
anchor (3 weapons), 12 at −58°, 20 at −64°. Lower it and the tip goes back underground. The
shipped family sits inside that window rather than on its edge and produces the tightest reach
conformance of the family: **0 weapons short, 7 mm worst-case reach residual over all 82.**

---

## B. The amplifier — `_bladeLength` fitted a bare horizontal radius, so a blade could buy reach by ploughing

`RI-WPN02` M1 sub-probe C1 defines `reach_m` as *"the largest distance at which a hit fires"*
against a standing target. `MovesetLibrary._bladeLength` fitted **the tip's bare horizontal radius
from the actor root, with no height term of any kind.** Those are different quantities and the
difference ran away:

* a blade inclined `d` below horizontal spends only `cos d` of its length on reach, so fitting a
  horizontal radius **inflates the blade by `1/cos d`** — and every extra metre of that inflation
  points at the floor;
* `cgs_drowned_reaper` therefore solved to **3.098 m of blade**, from a hand at 0.94 m, at −41°:
  a tip **1.09 m underground at its widest active frame**, sweeping a perfectly conforming 340° at
  a perfectly conforming 2.75 m radius;
* and the reach was a fiction in the fight as well as on the screen — round 3 measured
  `|threat_m − (reach_m + root_dz_m)|` outside tolerance on **10 of 14 classes, every one short**,
  because a tip two metres under the floor does not hit a man standing at the radius it claims.

**The fix**: the solve now fits *the widest horizontal radius the hit capsule reaches while it is
at the height of a standing body* — the band derived from `hitgeometry.json §hurtboxes` evaluated
on `skeleton.json` at the identity pose, `[0.05 m, 1.895 m]`, so a change to either data file moves
it. `reach(b)` then **saturates**: once the blade has passed out of the band, more length adds no
reach at all.

`cgs_drowned_reaper` now solves to **2.127 m** and its tip radius is **exactly 2.75 m**.

### This clause is currently inert, and that is the point

With the arm line correct, **0 of 82 solved blades differ** between the new solve and the old one —
the tip *is* at body height, so the two quantities coincide. Its value is not a gain, it is a
guarantee, and the ablation is the witness: **delete the arm-line fix and the new solve reports 24
weapons short of their declared reach, where the old solve absorbed the identical failure into
3.098 m of sword and read 100% reach-conforming.** It converts a silent failure into a loud one,
which is the exact property `NEXT-DISPATCH` warns is missing when it notes that the fingerprint's
`observed` columns are setpoints that cannot move.

---

## C. A lever tried and rejected, recorded so it is not retried as new

Tilting `skeleton.json §weapon.blade_axis_local` 30° forward of the forearm — declaring the grip as
a mount rather than asserting the weapon is a rigid continuation of the bone — raises the blade the
same way. On its own it reached **88.0%** of active frames above ground against `ARM_LINE`'s 91.8%,
took arc nonconformance to 0%, and reach conformance pinned it to a 30–45° window (24 weapons short
at 20°, 2 at 25°, none from 30° to 40°).

**It was dropped.** Two levers doing one job means one of them is a fudge. The grip is a modelling
convention; `extend` deciding which way the weapon points is an arithmetic error. The error is what
was fixed. **`skeleton.json` is untouched.**

---

## D. What this cost, reported rather than buried

| `RI-WPN05` §E.2, over 2,689 clips | before | after |
|---|---|---|
| arc nonconforming (±10°) | 10.41% | **4.76%** |
| recovery > active, by tip path | 271 | **83** |
| recovery > active, by bearing | 922 | **635** |
| tip speed over 1.25× band | 46.15% | 45.15% |
| **pose step > 0.25 m, BONE** | **12.01%** | **19.64%** |
| **pose step > 1.00 m, SOCKET (HARD FAIL)** | **267** | **307** |

The last two are a genuine regression and they are not an artefact: **holding the weapon up puts
the hand further from the body, so the same angular rate moves it further per frame.** It was tested
— a lower-amplitude arm line with the same contact angle gives the identical 307, so the cost is the
contact pose, not the travel. This was already a hard fail before the change and it is a worse one
now, by 15%.

`RI-WPN02` fingerprint, recomputed:

| | before | after | bar |
|---|---|---|---|
| `D_min` observed | 1.6392 | 1.639 | ≥ 1.6 PASS |
| `Dg_min` observed | 1.5511 | **1.7425** | ≥ 1.0 PASS |
| **`SEP` observed** | **1.3858 (FAIL)** | **1.473 (PASS)** | ≥ 1.4 |

`cmb-reach.mjs --probe player`: all seven classes **contiguous**, `reach_min` 0.00–0.05 m against a
0.60 m bar, ACCEPTANCE **pass**.

`cmb-reach.mjs --probe ablate --sides player` — S26/M8.3, the body corridor deleted on a deep copy:
minimum reaching distance moves by at most **0.05 m** against a 0.35 m bar, every class stays
contiguous with the corridor gone, and the `body_ge_weapon` hard-fail column is **0 for all seven**.
ACCEPTANCE **pass**. Worth reading one row of the M8.4 attribution:

```
player/spear    weapon   76 events   1..51 dmg
player/spear    body      0 events
```

The spear now reaches entirely with its weapon. That is the change stated as a fight outcome rather
than as a picture: before this round its point spent the active window below the floor, and what
touched a target at spear range was the attacker's own body corridor.

---

## E. The tip-speed residual is a different defect, and this proves it

`NEXT-DISPATCH` asks whether the 1,264 clips exceeding their declared peak tip speed are the same
defect seen from another angle — *"if the blade lengths are wrong, that residual may be the same
defect"*. **They are not.**

The solve shortened the mean solved blade from 2.001 m to 1.714 m and the longest from 3.884 m to
3.214 m, and the tip-speed violation rate moved **46.15% → 45.15%**, with the worst rising 156.95 →
163.34 m/s and the offender set unchanged (`whp_*` on `2h.roll.r2`, `plunge`, `art.1`). It is what
the previous builder said it was: **200–360° declared arcs driven through 3–6 frame contextual
windows.** Blade length is a minority term. It stays open and it is not this round's to claim.

---

## F. Proposed reference-item edits

1. **`RI-WPN02` §B** — the `Reach (m)` definition gains its missing half. Add: *"Reach is measured
   at the height of a body. The widest radius of the hit capsule while it is inside the target's
   hurtbox band, not the tip's bare horizontal radius — a tip below the floor at radius `r` does not
   reach `r`."* This is the amendment `AMENDMENT-W1-10-CRITIC-02` §A asked for and it is now what
   the build does.
2. **`RI-WPN05` §E.2** — add a fifth row to the motion-integrity probe: **blade attitude**. *"Over
   the active window, the fraction of frames on which the weapon's tip is below `y = 0`. A weapon
   that is underground is not swinging. HARD FAIL if any weapon is underground on every active
   frame of its lead slot."* Instrument shipped: `tools/weapons/blade-height.mjs`. The measure did
   not exist before this round, which is why a defect this size survived three verdicts.
3. **`WEAPON-CRITIC` §3.4** — `tools/weapons/blade-consumption.mjs` is a mandatory verdict artifact.
   It perturbs `reach_m`, `blade_axis_local` and `arc_sweep_deg` on deep copies and shows the drawn
   weapon and the hit volume move together: `reach_m +0.50 m` moves the solved blade by exactly
   0.5000 m and the tip radius from 2.750 to 3.250; `arc_sweep_deg ×1.30` takes the measured swept
   arc from 340.0° to 442.0°. The drawn tip and the hit socket are not two numbers that agree — they
   are `rig.socketB`, read by `render/actor.js` and by `CombatBody.evaluateRig`, and the harness
   reports the difference at 0.0002–0.0008 mm.

## G. Reproduce

```
node tools/weapons/blade-height.mjs --json out.json      # the headline table
node tools/weapons/blade-consumption.mjs                 # RI-MTH07 CONSUMPTION
node tools/weapons/motion-census.mjs out.json --full     # §E.2 neighbours
node tools/weapons/fingerprint.mjs out.json              # D_min / Dg_min / SEP
node tools/harness/cmb-reach.mjs --probe player          # S26 contiguity and minimum reach
node tools/harness/wpn-render-look.mjs --weapon cgs_drowned_reaper --frames 4,16,28
```

Before/after pictures of the same frame of the same swing:
`reports/blade/look-cgs-DELETED/cgs_drowned_reaper-f16.png` (tip at **−1.33 m**, inclination −48°,
the blade entirely swallowed by the dirt) against `reports/blade/look-cgs/cgs_drowned_reaper-f16.png`
(tip at **+0.905 m**, inclination −8.8°, the blade out at chest height with its trail behind it).
