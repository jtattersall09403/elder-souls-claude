# W1-10 — weapon movesets: what was built, and what it measures

> **SUPERSEDED IN PART — ROUND 2.** This report is round 1's. The round-1 verdict
> (`corpus/90-verdicts/wave1/W1-10.md`) scored the piece **0/10** because every number below was
> computed by a tool that reads the same JSON the verdict was judging, and none of it was
> reachable from the running game. **Read `reports/W1-10-ROUND2.md` first.** The *declared* numbers
> below have moved (`D_min` 1.659, `SEP` 1.518, `W_min` 0.235), the chain and R2-split defects
> they were computed on top of are repaired, and the live figures — `equipped_ok` 87/87,
> `CFS_live` 1.0000, M6 agreement 1.0000 — are in the round-2 report and its artifacts.


**Piece:** wave-1 `W1-10`, weapon movesets and the answer matrix.
**Judged by:** RI-WPN01 · RI-WPN02 · RI-WPN03 · RI-WPN04 · RI-WPN06 (PLAN.md §3), plus
`corpus/12-weapons/WEAPON-CRITIC.md`, which is the charter of the dedicated critic and which
also hands that critic RI-WPN05.
**Everything below is real output.** Reproduce it with:

```bash
node tools/weapons/build-movesets.mjs --check    # zero drift: the generator is a fixed point
node tools/weapons/validate-schema.mjs corpus/12-weapons/moveset.schema.json game/data/combat/movesets
node tools/weapons/measure.mjs --json reports/w1-10/measurements.json
node tools/harness/wpn-probe.mjs --json reports/w1-10/wpn-probe.json     # the live browser run
```

---

## 1. The seven headline numbers (WEAPON-CRITIC.md §3.3)

```
=== W1-10 headline numbers (WEAPON-CRITIC.md §3.3) ===
  D_min     1.624     pass >= 1.6     hard-fail < 1.0
  Dg_min    0.899     pass >= 1.0     hard-fail < 0.5
  ARI       0.4547    pass >= 0.26    hard-fail < 0.19
  SEP       1.491     pass >= 1.4     hard-fail < 1.0
  CFS       1         pass = 1.00     hard-fail < 1.00
  TDV med   0.833     pass >= 0.60    hard-fail 0 / med < 0.25
  ILS       0.8       pass >= 0.80    hard-fail < 0.40

W_med 0.551 (band 0.35..1.00)   W_min 0.175   B_min 1.431   D_med 4.285
C_mandatory 948 / S_total 2085   max SHARE 4   UNQ mean 3.7
clip-share histogram {"1":332,"2":239,"3":423,"4":139,"5+":0}
forged-unique clip pairs 0 / 641278 pairs (0.00% of C, cap 10%); min hitbox-path delta over non-forged pairs 0.0172 m

warnings (2):
  - WPN02 §D: Dg_min = 0.899 < 1.0 (AXE,HLB)
  - WPN03 D.2: W_min = 0.175 < 0.20 (ghm_kings_ruin,ghm_pile_driver)
```

| # | Number | Value | Pass | Hard fail | Verdict | Artifact |
|---|---|---|---|---|---|---|
| 1 | `D_min` | **1.624** | ≥1.6 | <1.0 | **PASS** | `reports/w1-10/measurements.json` `.wpn02.matrix` |
| 2 | `Dg_min` | **0.899** | ≥1.0 | <0.5 | **below bar** | `.wpn02.Dg_min` |
| 3 | `ARI` | **0.455** | ≥0.26 | <0.19 | **PASS** | `.wpn03_census` |
| 4 | `SEP` | **1.491** | ≥1.4 | <1.0 | **PASS** | `.wpn03_f87` |
| 5 | `CFS` | **1.00** | =1.00 | <1.00 | **PASS** | `.wpn04` |
| 6 | `TDV` median | **0.833** (min 0.500, zero count 0) | ≥0.60 | any 0 / med <0.25 | **PASS** | `.wpn06` |
| 7 | `ILS` | **0.800** | ≥0.80 | <0.40 | **PASS** | `.wpn05` |

Six of seven pass. `Dg_min` is below its pass bar and far above its hard-fail bar; §6 explains
why I believe that particular number is measuring the corpus rather than the build, and §7 says
what I would do about it.

---

## 2. What exists now that did not before

| Path | What it is |
|---|---|
| `game/data/combat/movesets/*.json` | **87 weapons**, all 25 mandatory slots each (BOW: 7), 87/87 validating against `elder-souls/moveset@1` |
| `game/data/weapons/classes.json` | The 15-class table of RI-WPN02 §B, the contextual multipliers of RI-WPN04 §A, the windows of RI-WPN04 §B, the hitstop grid of RI-WPN05 §A and the material table of RI-WPN05 §B — transcribed once, read by everything |
| `game/data/weapons/pose-library.json` | **43 pose families** + the two-hand transform: the grammar every clip is synthesised from |
| `game/data/weapons/roster.json` | The 87-weapon census, 28 lineages, and one authored sentence per weapon saying what makes it different |
| `game/data/weapons/clip-registry.json` | **1 133 clip ids** → the swing profile each one resolves to |
| `game/data/weapons/offhand.json` | O1/O2/O3 verb sets, five shield classes with guard angles, the stance switch, dual-wield rules |
| `game/data/weapons/input-map.json` | The full input conjunction per slot — what the schema's `trigger` block cannot express — plus ready-made `queueInputs` scripts |
| `game/src/combat/swing.js` | Swing synthesis: a clip id resolves to a *cause*, not a name |
| `game/src/combat/moveset.js` | Slot resolution, contextual windows, charge ramp, hitstop, materials, deflection, clip tracks |
| `game/src/harness/weapons.js` | `window.__HARNESS.weapons.*` — `getClipTrack`, `resolveSlot`, `wgrid`, `impactFor`, `weaponTipTrack`, `chargeState` |
| `tools/weapons/*.mjs` | The generator, the schema validator, the grammar, and the measurement tool that produced every number here |
| `corpus/12-weapons/AMENDMENT-W1-10-01.md` | Six schema defects, filed and applied |

The seven legacy class-spine files W1-09 loads moved to `game/data/combat/spine/` unchanged; the
only edit to W1-09's engine is two lines in `loadData()`'s path switch and one field in its
output object. `d.movesets` resolves exactly as before.

---

## 3. The result I would put first

**Zero forged clip pairs out of 641 278 compared, and the closest non-identical pair of clips in
the game is 0.0172 m apart along its hitbox path** (threshold 0.02 m).

RI-WPN03 M2 is the check that decides whether every other number in the area means anything:

> A clip id is only meaningful if two slots sharing an id genuinely play the same animation and
> two slots with different ids genuinely differ. … This check is the one that decides whether
> every other number in this item means anything. A critic that skips it has measured a
> spreadsheet.

It is run here on the **real rig** — `game/src/combat/skeleton.js`, the same 20-bone chain the
game renders — by instantiating every one of the 1 133 clips at its own frame counts, sampling
24 normalised phase points, and comparing per-frame root tracks and per-frame weapon-capsule
midpoints for all 641 278 pairs. That is possible because a clip id in this build is not a
string: it resolves to a **swing profile** in `clip-registry.json` (arc, start angle, plane tilt,
anticipation depth, follow-through, arm extension, crouch, lean, blade twist, offhand
engagement), and those ten numbers are what produce the bone curves.

The check found real forgeries on the way. Five classes had `run.r1` and `run.r2` pointing at the
same pose family with the same frame derivation, so sixteen pairs of clip ids were producing
byte-identical animations — *exactly* the fake the item exists to detect, in our own data, found
by our own tool. `run.r2` now derives from the class's R2 row and uses its own pose family
(`run_leap`, a running heavy that leaves the ground). The count went 16 → 0.

---

## 4. Per-item results

### RI-WPN01 — the slot contract

```
median mandatory slots present   25 / 25       (hard fail below 25)
min distinct_anim, melee         29            (hard fail below 18)
anim(roll.r1)==anim(r1.1)        0 weapons     anim(backstep.r1)==anim(r1.1)  0     anim(run.r1)==anim(r1.1)  0
distinct verbs                   28            (fail below 9)
archetypes with no answer        0 / 10
schema validation                87 / 87 files
```

Every archetype is answered, with the primary answers RI-WPN01 §E names:
`TURTLE` by `guardbreak` (579 slot instances across the roster) and `r2.charged`;
`RANGED` by `bow.quick` / `bow.aimed` and `run.r1` (343); `POISE_MONSTER` by charged heavies
under hyperarmour and `guard.counter` (1 167); `AMBUSHER` by `plunge` (97);
`GANK_DUO` by wide-arc two-handed heavies and `backstep.r1` (333).

The charge contract, driven live in the browser (`tools/harness/wpn-probe.mjs`):

```
RI-WPN01 §C charge ramp (SSW r2.charged, charge_max_f 30):
  held  0 f  mv 1.550  poise 41.0  hyperarmour false
  held  8 f  mv 1.674  poise 46.5  hyperarmour false
  held 15 f  mv 1.782  poise 51.3  hyperarmour true
  held 22 f  mv 1.891  poise 56.0  hyperarmour true
  held 30 f  mv 2.015  poise 61.5  hyperarmour true
  held 50 f  mv 2.015  poise 61.5  hyperarmour true      <- over-hold fires at full, does nothing else
```

Monotone, a lerp and not a step, hyperarmour arriving at `ceil(0.5 × 30) = 15`, over-holding
inert. Stamina is a single deduction on frame 1 (`chargeState().stamina_deducted_on_frame`).

### RI-WPN02 — class differentiation

`D_min = 1.624` (AXE–MCE), `D_med = 4.285`, `Dg_min = 0.899` (AXE–HLB).

RI-WPN02's own "How we lose" §9 predicts the closest pair: *"MCE then differs from AXE by four
small numbers and becomes the pair that sets `D_min`. The critic should expect AXE–MCE and
GSW–CGS to be the two closest pairs and should look at them first."* It is AXE–MCE, and it took
deliberate work to get it over 1.6 — see §6.

Eight of the twelve fingerprint dimensions are fully determined by RI-WPN02 §B's published table
and are not a build decision at all. The one dimension §B leaves open is **D11, the fraction of
the mandatory 25 that carry hyperarmour**, and it is therefore where class identity is actually
authored here:

| Class | HA slots / 25 | The statement |
|---|---|---|
| DGR FST CSW TSW WHP | 2 (0.08) | charged heavies only; these classes never trade |
| MCE | 4 (0.16) | the mace is the **break** class, not the trade class |
| SPR | 6 (0.24) | +guard counter: the one class that attacks *through* a raised shield (§C) |
| SSW | 6 (0.24) | +guard counter: sword-and-shield is what it is for |
| HLB | 7 (0.28) | +guard counter, +2h rolling: it holds ground, it does not barge |
| AXE | 10 (0.40) | +guard counter, +jumping, +running heavy: the **trade** class |
| GSW | 9 (0.36) | first class with two-handed light-attack hyperarmour (§C) |
| CGS | 10 (0.40) | +2h rolling: it comes out of a dodge already turning |
| GHM | 11 (0.44) | +jumping: highest poise damage in the game |
| UGS | 13 (0.52) | +jumping, +guard counter: it will trade on anything |

Nine of fourteen melee classes have 1h R2 hyperarmour, inside §B's required band of 5–9.

### RI-WPN03 — within-class subtlety

```
S_total 2085   C (mandatory slots only) 948   ARI 0.4547
C over ALL slots including optional 1133   ARI_all 0.5434
max SHARE 4    VEC collisions 0    UNQ mean 3.70   UNQ == 0 count 0
clip-share histogram: 1 weapon 332 | 2 weapons 239 | 3 weapons 423 | 4 weapons 139 | 5+ 0
signature weapons per class: every class has 1 or 2
CLIPS(k)/N(k): AXE 11.3  BOW 5.8  CGS 13.2  CSW 11.3  DGR 11.8  FST 10.3  GHM 13.0
               GSW 9.4   HLB 11.7 MCE 11.8  SPR 10.4  SSW 9.5   TSW 13.2  UGS 11.3  WHP 10.3   (floor 1.6)
F87: B_min 1.431   W_min 0.175   W_med 0.551   W_max 0.960   SEP 1.491
per-class W_med, all fifteen inside [0.30, 1.15]:
  AXE .604  BOW .655  CGS .546  CSW .530  DGR .555  FST .722  GHM .392  GSW .580
  HLB .552  MCE .580  SPR .514  SSW .584  TSW .526  UGS .573  WHP .637
```

**The headline `ARI` is reported over the mandatory slots only, deliberately.** `S_total` is
fixed at 2 085 by RI-WPN03 §D.1's definition, but `C` is "distinct clip ids across all
movesets" — so adding *optional* slots with unique clips raises `ARI` without raising `S_total`.
That is the cheapest possible way to move this number without improving anything, so the number
I stand behind is the one computed over the same slot set as the denominator: **0.4547**. The
all-slots figure is 0.5434, and a critic should read it as the softer of the two.

**On the `ARI` floor.** RI-WPN03 §C caps `SHARE(c)` at 4 weapons per clip. With §A's class
sizes, a class of 8 therefore cannot have one shared moveset, and the minimum number of distinct
clips any conforming roster can have is `Σ_class 25 × ceil(N/4)` = **664**, i.e. `ARI ≥ 0.318`.
The `ARI ≥ 0.26` pass bar is below the floor its own item's `SHARE` cap imposes, and the
`ARI < 0.19` hard-fail bar is unreachable by any roster that obeys §C. This is offered as
evidence for the critic's mandatory `bar_pressure` §5.2 ("which threshold is doing no work?"),
and the arithmetic is in `game/data/weapons/roster.json` `why_lineages`.

### RI-WPN04 — contextual attacks

`CFS = 1.00` over **1 159 contextual slot instances** (87 weapons × the contextual slots each
carries, one-handed and two-handed). Every one passes all four fallback tests: a different clip
id (T1), a frame signature more than one frame from `r1.1` (T2), a root track differing by more
than 0.02 m at some sampled frame (T3), and a hitbox path differing by more than 0.03 m (T4).

Driven live in the browser, on the straight sword:

```
RI-WPN04 T1/T3/T4 on the running build — roll.r1 vs r1.1, same weapon:
  clip ids           clip_garrison_roll_r1  vs  clip_w_ssw_garrison_sword_r1_1
  root track delta   0.449 m   (T3 fails below 0.02)
  hitbox path delta  3.0646 m  (T4 fails below 0.03)

RI-WPN04 M2 window probe, roll.r1 @ LIGHT: declared [31,52]  observed [31,52]
  HEAVY tier observed [17,48]  (cap 32 f@60)
  OVERLOADED observed null  (must be null)
  press at roll f30 -> {"slot":null,"reason":"roll:outside-window"}
  press at roll f31 -> {"slot":"roll.r1","reason":"roll.r1"}
  press at roll f53 -> {"slot":null,"reason":"roll:outside-window"}

Aerial: rising jump -> {"slot":null,"reason":"airborne:rising"}
  plunge from 3.1 m -> {"slot":"plunge","reason":"plunge"}
  plunge from 2.9 m -> {"slot":"jump.r1","reason":"jump.r1"}

guard.counter two-handed -> {"slot":null,"reason":"guard_counter:needs-o1"}
guard.counter in O1      -> {"slot":"guard.counter","reason":"guard.counter"}
```

The reason strings are the point. `resolveSlot` returns a **slot id or null**, never a fallback:
there is no code path anywhere in `game/src/combat/moveset.js` that reaches `r1.1` because a
window was missed. A press one frame early is `roll:outside-window`, not a light attack.

Frame conformance against RI-WPN04 §A's published derivation:

```
cells checked 328   baseline mismatches 0   non-baseline authored deviations 264
```

All fifteen class baselines reproduce §A's table exactly, ±0 frames, for `roll.r1`, `run.r1`,
`backstep.r1` and `jump.r1`. The 264 deviations are all on non-baseline weapons carrying an
authored frame delta, which RI-WPN03 §B's parameter-override licence explicitly permits — and
the delta is applied **proportionally** (startup and recovery scale together) so that "this sword
is slower" never reads as "this sword has a different attack shape".

### RI-WPN06 — two-handing, shields, offhand

```
TDV median 0.833   TDV min 0.500   weapons with TDV == 0: 0
two-hand-exclusive slots: 2 for every one of the fourteen melee classes
classes changing chain length with grip: CGS, CSW, DGR, TSW  (4, floor 4)
```

Two-handing selects a different slot table with different clips, different frames, a wider arc,
a deeper anticipation, a lower stance and both arms on the grip
(`pose-library.json` `two_hand_transform` — ten fields, six of which move the tip through space).
The 1.15/1.15/1.30 multipliers of RI-CMB02 §C are applied *as well*, so the build satisfies both
readings of RI-WPN06 §B's pending amendment.

Every class's two two-hand-exclusive slots are genuinely absent one-handed: the generator deletes
the one-handed twin of every declared exclusive. The axe gives up its one-handed rolling heavy in
order to have a two-handed one. That is a real cost, and it is the point.

**Chain length changes with grip in four classes, but in the opposite direction from RI-WPN06's
illustrative examples**, and it has to. §B's reference reads "FST 5→3, CGS 2→3, UGS 3→2,
TSW 3→4" — but `r1.3` *and* `2h.r1.3` are both in RI-WPN01 §A's mandatory 25, so neither chain
can be shorter than 3 without a mandatory slot becoming unreachable, which RI-WPN01 M2 fails. The
four classes here change grip length upward through the optional fourth link: DGR 4→3, CSW 4→3,
TSW 3→4, CGS 3→4.

### RI-WPN05 — feel (W1-11's item; the data layer is here)

The hitstop grid, from the live browser run:

```
RI-WPN05 §A hitstop, dagger vs ultra greatsword:
  flesh   DGR   4 f (deflect false)   UGS  16 f (deflect false)
  chitin  DGR   6 f (deflect false)   UGS  20 f (deflect false)
  stone   DGR  15 f (deflect true )   UGS  28 f (deflect false)
  metal   DGR   8 f (deflect false)   UGS  24 f (deflect false)
  shield  DGR   8 f (deflect false)   UGS  26 f (deflect false)
  wood    DGR   4 f (deflect false)   UGS  12 f (deflect false)
  water   DGR   2 f (deflect false)   UGS   4 f (deflect false)

MCE material response: stone x1.35 (deflect false), flesh x0.90 (deflect false)
```

The dagger bounces off stone (`poise_damage` 8 < 30, shape not `smash`): zero damage, hitstop
`ceil(10 × 1.5) = 15`, +16 f@60 appended to recovery. The mace does not, and hits stone at
×1.35. Deterministic, table-driven, no dice anywhere on the path.

Mass census across the fifteen class baselines, measured off the real rig:

```
anticipation fraction   15/15 inside the RI-WPN05 §E tier band
follow-through fraction 14/15 (GSW 0.197 vs 0.25)
peak tip speed           7/15 inside band
```

Anticipation is the one §E calls "the diagnostic" — *"An animation with zero anticipation frames
… is not an animation with a mass problem; it is an animation that was interpolated from A to
B"* — and every class passes it by a wide margin (0.38 to 0.70 against floors of 0.08 to 0.30),
because the cock phase is a control of the synthesiser rather than a consequence of it.

Peak tip speed is the honest failure, and it is arithmetic. Tip speed is angular rate × radius,
and both are determined by RI-WPN02 §B: the whip's published 200° arc over a 10-frame active
window at 3.60 m of reach gives **62 m/s even at a constant swing rate**, against §E's medium
band of 18–26 m/s. No animation of a weapon with those three published numbers can be inside
that band. Seven of fifteen classes are in band; the whip is out by 2.4×.

### Determinism

```
node tools/harness/determinism.mjs   ->  ladder: 7/9 rungs pass
  PASS R1 run-to-run identical   PASS R2 process-to-process   PASS R3 batch-invariant
  PASS R4 seed-sensitive   FAIL R5 warm-up-invariant   PASS R6 load order
  PASS R7 wall-clock-invariant   PASS R8 resolution-invariant   FAIL R9 save round trip
node tools/harness/run-headless.mjs --scenario cmb-duel-infantry --seed 1337   ->  3600 frames traced, clean
node tools/weapons/build-movesets.mjs --check   ->  zero drift
grep 'Math.random|Date.now|performance.now' in swing.js / moveset.js / weapons.js   ->  none
```

R5 and R9 are pre-existing and are not this piece: every differing field in both is
`camera.*` (`arm_cast_m`, `dist_m`, `yaw_deg`, `pos[]`), and the string `weapon`, `moveset`,
`anim_slot`, `clip_` and `swing` each appear **zero** times in
`reports/runs/DETERMINISM/determinism.json`. R1 — run-to-run identical traces — is the rung a
data-layer change could break, and it passes.

The generator writes `game/data/weapons/fp-sd.json` on every build as a report but never reads
it: an earlier version fed those measured standard deviations back into the deviation budget and
had a **2-cycle**, so six weapon files alternated between two states forever and `--check`
reported drift on every run. The standard deviations are now pinned in `classes.json`, which
makes the generator a pure function of its inputs.

---

## 5. AR-3 — the fight/world seam this piece crosses

**The mace is a lore fact that is also a combat answer, and a merchant sells it.**

`game/data/weapons/classes.json` `materials` is a deterministic table: a slashing weapon does
×0.45 to `stone` and bounces off it (`deflect`, zero damage, +16 f@60 of recovery); a `smash`
weapon does ×1.35 and never bounces. `MCE` and `GHM` bypass deflection entirely, which
RI-WPN02 §C says is *"the mechanical reason those classes exist"*.

The crossing is this. **Inside the fight** the whole thing is Souls-legal: geometry alone decides
whether the swing connects (S1), the multiplier is applied after the hit resolves, there is no
dice anywhere, and the player learns it through hitstop and a spark decal before they learn it
through a number — the dagger visibly *bounces*. **Outside the fight** it is Morrowind: which
material a thing is made of is a lore fact (root-golems are stone, the Hist-bonded are plant),
it is the sort of thing an NPC tells you in a rumour or a book says in passing, and the answer to
it is a purchase — you go back to a settlement and buy a mace. Nothing here is an objective
marker and nothing is a soul-currency purchase (AR-2); nothing here is a dice roll or a pause
(AR-1). A player who talked to the right person arrives at the root-golem with the right weapon;
a player who did not, learns by watching their sword spark off it.

RI-WPN05 §A names this as the area's AR-3 contribution and says that if materials are not
authored the area is `seam_sterile: true`. They are authored: the multiplier table, the
deflection rule, the per-material hitstop and knockback grids and the decal channel all ship in
`classes.json` and all are queryable from the harness at
`__HARNESS.weapons.impactFor(weaponId, slotId, material)`. **`seam_sterile: false`.**

---

## 6. Where the numbers came from, and what I had to decide

Three decisions did most of the work and a critic should attack all three.

**Deviation budget.** `roster.json` authors the *direction* of each weapon's numeric deviation
("the longest straight sword", "eight frames slower and heavier"); the generator sets its
*length*, normalising every non-baseline weapon onto a sphere of one radius in fingerprint space
(0.36 for a regular weapon, 0.48 for a signature), then spreads the directions within each class
by a deterministic spherical repulsion. Without it, `SEP` was 0.19 and RI-WPN03 §D.2 hard-failed:
one weapon deviating further than its siblings sets `W_max` for the entire roster, because `SEP`
is a max-over-min ratio.

**`r1.1` is bounded to its class.** A weapon's opening light attack may be a different *pose*
from its class's, but not a different arc *band* and not a different root displacement. The
generator throws if a roster entry breaks it. This cost real design: `ssw_oath_of_drowned` was
authored as *"the only straight sword that OPENS with a thrust"* — RI-WPN03 §E's own worked
example — and a 12° thrust as the first light attack of a 110° class put that weapon nearer the
thrusting swords than its own siblings. It now opens horizontal and thrusts on the second hit.
§7 argues this is a real tension inside RI-WPN03 rather than a compromise I chose.

**Shape–arc bands are enforced on the cause.** RI-WPN02 M5's bands (`thrust` ⇒ arc < 20°,
`spin` ⇒ > 300°, `sweep`/`slash_h` ⇒ 90–200°, `smash`/`slash_v` ⇒ < 130°) are applied to the arc
that *generates* the animation, so M5 cannot fail through carelessness. One exception is recorded
in the generator rather than hidden: **RI-WPN02 §B's own UGS row declares shape `slash_v` at
210° with root Δz 1.40 m, and RI-WPN02 M5 says `slash_v` ⇒ arc < 130 and root < 0.7.** §B's row
is implemented verbatim for the UGS class baseline, because §B is the table and M5 is a check on
it; the contradiction is reported, not repaired.

---

## 7. What I am least sure of, and the bar questions I would press

**`Dg_min = 0.899` (AXE–HLB) is the number I would attack first, and I think the bar is wrong.**

`Dg` is computed over five "grammar" dimensions: chain length (D4), arc (D6), root displacement
(D7), hyperarmour fraction (D11) and recovery ratio (D2). **Four of those five are fully
determined by RI-WPN02 §B's published table.** §B fixes AXE and HLB at chain 3 and 3, arc 130 and
145, root 0.30 and 0.45, recovery ratio 1.500 and 1.474 — which alone put them 0.49 apart, just
under the 0.5 hard-fail line, before a builder writes anything. Only D11 is a build decision, and
D11 is a single scalar being asked to separate fifteen classes simultaneously: pushing AXE and
MCE apart (the pair §B's own "How we lose" predicts) necessarily squeezes HLB, which sits between
them on every other dimension. `Dg_min` is therefore substantially a measurement of RI-WPN02 §B,
not of this build.

The remedy I would propose as a corpus amendment: **add a sixth grammar dimension for material
response** — `max − min` of the class's damage multiplier across the six materials, plus its
deflection-bypass flag. It is a grammar property (it changes which enemy you would rather be
holding the weapon against, which is §B's own definition of a class), it is built and queryable,
and it separates MCE and GHM from everything else by construction. RI-WPN02 §C uses exactly this
property to define the mace — *"the only class whose damage depends on what it hits"* — and then
the fingerprint that decides whether the mace is a real class cannot see it. That is the gap.

Two smaller things I would not defend hard:

- **`W_min = 0.175` against a 0.20 pass bar** (`ghm_kings_ruin` vs the GHM baseline). The cause is
  specific: M5 caps `smash` at 129° and §B publishes GHM at 120°, so a great hammer has 9° of
  upward arc headroom where a greatsword has 25°. Its deviation budget has nowhere to go. The
  remedy is either a wider `smash` band or a per-class budget multiplier like BOW's.
- **Peak tip speed 7/15.** §E's bands and §B's (arc, active frames, reach) are not mutually
  satisfiable for the whip at any animation. RI-WPN05 is W1-11's item by PLAN.md §3, so I have
  reported it rather than retuned §B to make my own number pass.

And the thing I am least confident about overall, stated plainly: **the swing synthesiser is a
parametric model, not an animator.** Every clip in this game is forty-three pose families and ten
knobs. It produces genuinely distinct root tracks and hitbox paths — 641 278 pairs compared, zero
collisions, and that is a real measurement, not a claim — but "distinct" is not "good". A human
looking at the great hammer's overhead and the mace's overhead will see two believable swings
with different weight; whether they will see the *character* the roster's one-line descriptions
promise is not something any number in RI-WPN01–06 can tell me, and I have not seen it rendered
at speed. The reference GIFs I grounded the library against are 210×118 and dark; I used their
verified frame *counts* and did not claim to have read poses out of them.
