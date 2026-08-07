# AMENDMENT-W1-10-CRITIC-02 — reach is not a radius, and a consumer is not a solver

**Filed by:** `critic.weapons`, W1-10 round 3.
**Against:** `RI-WPN02` §B and §D (D5/G5), `RI-WPN06` M1 (`TDV`), `WEAPON-CRITIC` §3.3,
`ARBITRATION.md` §3 (CONSUMPTION).
**Status:** proposed. Nothing here has been applied to any reference item.

Each defect below was found by *measuring the build against the bar and watching the bar fail to
notice*, and each carries the arithmetic. Three of the four are defects the bar critique's own
reasoning would have caught if it had been applied one step further; the fourth is a hole nothing
in the corpus asks about.

---

## A. `RI-WPN02` §B's `Reach (m)` is a horizontal radius and says nothing about height

`BAR-CRITIQUE-W1-10-R1` §R4 resolved a real ambiguity — `Reach (m)` is blade reach, root
translation suppressed, and `threat_m = Reach + Root Δz` is the player-facing figure. It resolved
the *lunge* half of the ambiguity and left the *attitude* half open, and the build walked into it.

Measured on the shipping build, in headless Chromium, off `engine.getHitGeometry()`, over the
frames the engine's own `hitbox_active` flag is set:

| class | weapon | shape | active f | tip Y range (m) | frames with tip below the floor | mean blade inclination |
|---|---|---|---|---|---|---|
| CGS | `cgs_drowned_reaper` | `spin` | 18 | −1.86 … −1.09 | **100%** | −50.6° |
| HLB | `hlb_garrison_bill` | `sweep` | 14 | −1.33 … −0.67 | **100%** | −37.9° |
| TSW | `tsw_bog_rapier` | `thrust` | 8 | −1.41 … −0.68 | **100%** | −52.1° |
| WHP | `whp_hide_lash` | `lash` | 10 | −2.00 … −0.28 | **100%** | −37.4° |
| SPR | `spr_drowned_harpoon` | `thrust` | 8 | −2.23 … +0.25 | 75% | −45.7° |
| SSW | `ssw_garrison_sword` | `slash_h` | 10 | +0.53 … +1.10 | 0% | −13.1° |

Every one of these weapons satisfies §B's conformance row: the tip's **horizontal radius** equals
`reach_m` to within 0.03 m in all six cases. The bar cannot distinguish a weapon from a weapon
pointed at the floor.

Turning it into the quantity a player experiences — the furthest point *on the damaging capsule*
that lies inside a standing target's torso band (0.30–1.70 m above the foot plane, per `RI-CMB04`'s
hurtbox rig), over all 87 weapons at `r1.1`:

| class | declared `reach_m` | tip radius (= D5 today) | reach that can meet a body | shortfall |
|---|---|---|---|---|
| WHP | 3.624 | 3.626 | **1.724** | **1.902 m** |
| SPR | 3.111 | 3.111 | **1.510** | **1.601 m** |
| TSW | 2.218 | 2.206 | **1.198** | **1.009 m** |
| CGS | 2.748 | 2.750 | 1.959 | 0.790 |
| HLB | 2.860 | 2.772 | 1.992 | 0.780 |
| UGS | 2.942 | 2.936 | 2.678 | 0.258 |
| GSW | 2.611 | 2.612 | 2.400 | 0.212 |
| AXE CSW DGR FST GHM MCE SSW | — | — | = tip radius | **0.000** |

The five classes at the top are exactly the five whose weapons land nothing at their own declared
reach − 0.20 m.

### Proposed replacement for §B's `Reach (m)` definition

> `Reach (m)` is **usable blade reach**: the greatest horizontal distance from the attacker's own
> root, measured over the active window with root translation suppressed, at which **some point of
> the damaging capsule lies between 0.30 m and 1.70 m above the attacker's foot plane** — a
> standing humanoid's torso band per `RI-CMB04`'s hurtbox rig. A tip outside that band is not
> reach; it is a point in the air or in the ground.

### Proposed addition to §D, D5 / G5

> D5 is measured under §B's usable-reach definition. The verdict must also report the raw tip
> radius and their difference as **`reach_shortfall_m`**. **Any class at
> `reach_shortfall_m > 0.30 m` is a FAIL of §B's conformance row**, and the item names which.

**Cost of adopting it, stated honestly.** Under the current definition the shipped build reads D5
equal to its declaration on 85 of 87 weapons and every class passes §B. Under this one, five
classes fail. That is the point: `D_min`, `Dg_min`, `SEP`, `W_min` and `W_med` all read D5, and
they are currently reading a number that no player can feel.

---

## B. D5 and D6's `observed` column is a readback of its own setpoint

`WEAPON-CRITIC` §3.3 clause 1 is binding from wave 2: *"A number computable from
`game/data/combat/movesets/*.json` with the game disconnected is `unmeasurable ⇒ 0`."*

`game/src/combat/moveset.js` now carries two solvers: `_yawGain` fits a per-clip yaw gain until the
arc the rig sweeps equals the slot's declared `arc_sweep_deg`, and `_bladeLength` fits the socket-B
distance until the tip's max horizontal radius equals the weapon's declared `reach_m`. The
`observed` column is then read off the fitted rig by the same walk the solver optimised.

Measured (`corpus/90-verdicts/wave1/artifacts/W1-10-r3/kritik3-setpoint.json`):

| | result |
|---|---|
| residual `\|observed − declared\|`, 82 weapons, `r1.1` | reach median **0.0012 m**; arc median **0.000°** |
| perturb the **animation** — clip-registry `capsule_length_m` ×0.5 and `profile.arc_deg` ×0.4 | observed arc moved on **0 of 82** weapons (max **0.01°**); observed reach on 30 of 82 |
| perturb the **declaration** — `reach_m` +0.50 m, `arc_sweep_deg` ×1.30 | observed reach followed within 0.05 m on **67 of 82**; observed arc within 10% on **74 of 79** |

Fitting geometry to a declared contract is a defensible authoring choice and the build documents it
at the call site. Scoring the result as the `observed` column is not.

### Proposed addition to `WEAPON-CRITIC` §3.3's CONSUMPTION box

> 4. **A measurement whose value is a solver's setpoint is `declared`, not `observed`.** Where the
>    runtime fits its geometry to a declared field, the verdict must run the animation-blind
>    control: perturb the *animation source* (the clip, the registry, the pose tracks) without
>    touching `movesets/*.json`, and re-read the column. **If the column does not move, it belongs
>    in the `declared` column** however it was obtained. State the control's result next to the
>    number.

---

## C. `RI-WPN06` M1's `TDV == 0` hard fail fires on BOW by construction

`RI-WPN01` §A gives BOW seven mandatory slots and no `2h.*` table. `TDV` is the divergence of
`2h.<x>` from `<x>`. With no `2h.*` slots there is no pair, so `TDV` is exactly 0 for all five bows
on **every possible build**, and `RI-WPN06`'s *"HARD FAIL on any weapon = 0"* fires on a healthy
roster. Measured on the shipping build: `TDV` median **1.000**, and the only five zeros are
`bow_chitin_recurve`, `bow_horn_sinew`, `bow_kings_horn`, `bow_marsh_longbow`,
`bow_reed_shortbow`.

This is the identical defect `BAR-CRITIQUE-W1-10-R1` §R2 rejected `Rh_min < 0.03` for — *"a
threshold that fires on a whole class by construction is not a measurement"* — and it survived the
pass that wrote that sentence, in the item next door.

### Proposed replacement for `RI-WPN06` M1's hard-fail clause

> **HARD FAIL** on any weapon **declaring a two-handed stance** measuring `TDV == 0`. Weapons whose
> class carries no `2h.*` slot table (BOW) are **excluded from `TDV` entirely** and are reported as
> `TDV: n/a`, never as 0.

---

## D. `ARBITRATION.md` §3's CONSUMPTION check does not say whether a *rendered* consumer is required

The four wave-1 cases §3 cites are split. *"Character creation rendered 20 byte-identical
screenshots while returning correct values"* is a **rendering** failure. *"50 of 55 magic effects
were a single generic applicator"* and *"the stealth visibility term was computed every frame while
the alert meter filled at a flat rate that never read it"* are **simulation** failures. The text
gives one rule for both — *"name the world-side consumer… perturb the model and observe an entity
change behaviour"* — and a model consumed by the solver that grades it satisfies that rule
literally while producing no pixel.

W1-10 is the case that forces the question. Its animation model has a simulation consumer (the
hitbox solver) and **no rendered consumer at all**: `grep -rn "weapon" game/src/render/` returns
nothing, `makeActor()` welds one 0.95 m box for all eighty-seven weapons, and
`renderer.js:398–399` writes only the group's position and yaw. Screenshots of a 1.95 m straight
sword, a 2.85 m halberd and a 2.75 m curved greatsword mid-attack are byte-identical.

### Proposed clarification for `ARBITRATION.md` §3

> For a model whose **whole subject is something the player looks at** — an animation, a silhouette,
> a VFX, a face, a region's dressing — a simulation-side consumer is **necessary and not
> sufficient.** The verdict must additionally name the **rendered** consumer and demonstrate it by
> perturbing the model and showing **the pixels change**: two configurations that the model says are
> different must produce screenshots that differ. A model that changes the simulation and not the
> frame is half-consumed, and the half the player owns is the missing one.

This is not a new principle; it is the one §3's own first example already applies, written down so
it does not have to be re-derived by the next critic.

---

## Provenance

`provenance: constructed`, confidence **high** on every figure in §A, §B and §C — all are
reproducible from
`corpus/90-verdicts/wave1/artifacts/W1-10-r3/kritik3-tip-height.json`,
`…/kritik3-setpoint.json`, `…/kritik3-browser.json` and `…/kritik3-ar-ari-cfs.json`, each produced
by a script in the same directory. §D is an argument, not a measurement, and is filed as an
arbitration question in `corpus/90-verdicts/wave1/W1-10-r3.json` as well as here, because a critic
that rules on the boundary of its own remit should not be the one who decides it.

Nothing in this filing lowers a bar. §A and §C make two bars harder to pass and one bar possible to
fail; §B and §D make two measurements harder to satisfy with a number that is already true.
