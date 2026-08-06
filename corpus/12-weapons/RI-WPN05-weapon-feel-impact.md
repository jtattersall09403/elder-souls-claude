---
id: RI-WPN05
title: Weapon feel — hitstop, material impact, whiff, and mass in the animation
kind: number
side: souls
judges: [weapon.feel.hitstop, weapon.feel.material, weapon.feel.mass, weapon.feel.whiff, combat.feedback.hitstop]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

A hit must be an **event**, and it must be a *specific* event. Everything in the corpus so
far measures whether the right damage happened at the right frame; none of it measures
whether the player felt anything. BAR-CRITIQUE-01 named this as gap **G5** — *"nothing judges
impact"* — and it is the gap most likely to survive a project where every number passes.

"Good" means three things, in this order.

**Hitstop.** When a weapon connects, the world stops for a handful of frames. Both animations
freeze; the camera holds; the frame you were on is the frame you look at. How many frames is
the single largest contributor to how heavy a weapon feels, and it must differ measurably
between a dagger and a great hammer — a dagger's two frames are a tap, an ultra greatsword's
eight are a *thud*.

**Material.** Hitting a drowned Kothringi is not hitting a chitin-plated mire-crab is not
hitting a root-golem's stone limb is not hitting a raised shield. Different hitstop, different
damage multiplier, different decal, different sound, different knockback, and — for the
hardest surfaces — a **deflection** that costs the attacker frames. A player must be able to
tell what they hit with their eyes shut, and must learn to bring a mace to the stone thing.

**Mass.** The animation itself must carry weight: a windup that travels backwards before it
travels forwards, a tip that decelerates *through* the target rather than passing through it,
a follow-through that overshoots and settles. This is the part that cannot be faked with a
number, and it is the part that makes a Three.js build read as a Three.js build.

This item owns feel. RI-AUD01 owns the sound (BAR-CRITIQUE-01 G5's other half), RI-CAM06 owns
camera feel and is authoritative on any camera motion this item requests, RI-CMB05 owns
stagger and poise, and RI-CMB04 owns whether the hit happened at all.

## The reference artifact

### A. `ES-HITSTOP/1` — attacker hitstop frames, by weight tier × material

At 60 Hz. **Attacker hitstop** freezes the attacking character's animation clock; **victim
hitstop** freezes the victim's. Both are frame counts, both are integers, and neither is a
time in seconds.

| Weight tier | Classes | flesh | chitin | stone | metal | shield | wood | water |
|---|---|---|---|---|---|---|---|---|
| light | DGR FST CSW TSW SSW | **2** | 3 | 5 | 4 | 4 | 2 | 1 |
| medium | SPR AXE MCE WHP HLB | **4** | 5 | 8 | 6 | 7 | 3 | 1 |
| heavy | GSW CGS GHM | **6** | 8 | 11 | 9 | 10 | 5 | 2 |
| ultra | UGS | **8** | 10 | 14 | 12 | 13 | 6 | 2 |
| ranged | BOW | **1** | 2 | 3 | 2 | 3 | 1 | 1 |

Victim hitstop:

| Material | Victim hitstop | Reading |
|---|---|---|
| flesh, wood | attacker + 2 | The target absorbs it — it flinches harder than you do |
| chitin | attacker + 1 | |
| water | 0 | Nothing to freeze |
| **stone, metal, shield** | **0** | **The target does not move. You do.** This asymmetry is what a bounce *is*: the attacker eats every frame of the stop and the target is unmoved. It is the whole reason the stone row has the largest numbers. |

Knockback applied to the victim on a non-staggering hit, along the attack's forward axis:

| Tier | flesh/wood | chitin | stone/metal/shield |
|---|---|---|---|
| light | 0.05 m | 0.03 m | **attacker pushed back 0.10 m** |
| medium | 0.15 m | 0.10 m | **attacker pushed back 0.20 m** |
| heavy | 0.35 m | 0.25 m | **attacker pushed back 0.30 m** |
| ultra | 0.60 m | 0.45 m | **attacker pushed back 0.35 m** |

**Deflection.** A non-blunt attack (`shape ∉ {smash}`) landing on `stone` with
`poise_damage < 30` produces a `deflect` event instead of a hit: **zero damage**, attacker
hitstop ×1.5 (rounded up), **+8 f appended to the attacker's recovery**, a spark decal, and
no victim reaction at all. `MCE` and `GHM` bypass deflection entirely, which is the mechanical
reason those classes exist (RI-WPN02 §C). Deflection is deterministic — it is a function of
`shape`, `poise_damage` and the target's material, with no random component anywhere
(ARBITRATION S1).

### B. `ES-MATERIAL/1` — damage multipliers by material × damage type

Deterministic, table-driven, no dice. Damage type is a property of the slot's `shape`:
`slash_h`/`slash_d`/`slash_v`/`sweep`/`spin`/`lash` → **slash**; `thrust`/`shoot` → **thrust**;
`smash` → **strike**.

| Material | slash | thrust | strike | Typical bearers (RI-AI05 dressings) |
|---|---|---|---|---|
| flesh | 1.10 | 1.05 | 0.90 | drowned Kothringi, Naga levy, swamp-wyrm |
| chitin | 0.85 | 1.15 | 1.20 | mire-crab, saplings-touched, chitin-armoured elites |
| stone | 0.45 | 0.55 | **1.35** | root-golem, Xanmeer revenant, statuary |
| metal | 0.75 | 0.95 | 1.20 | Dunmer slaver garrison, Imperial armour |
| plant / root | 1.25 | 0.80 | 0.85 | Hist-bonded champions, root-wardens |
| water-logged | 1.00 | 1.00 | 1.10 | the drowned, anything fought waist-deep |

Every enemy statblock in `game/data/combat/enemies/*.json` MUST declare a `material` per
hurtbox region (RI-CMB04 owns the regions). A statblock with no material is **unmeasurable**
and scores 0 for this item's material checks, per CRITIC-DOCTRINE §7.3.

**Arbitration note.** This is a Morrowind-shaped depth layer (materials, resistances,
bring-the-right-tool) living inside a Souls-authoritative subsystem, and it is legal because
it never touches whether the swing connects. Geometry alone decides that (S1). The multiplier
is applied after a hit is resolved, is fully deterministic, and is legible to the player
through hitstop and decal before it is legible through a damage number. It is also an
**AR-3 seam-crossing interaction**: a lore fact (root-golems are stone; the Hist-bonded are
plant) is a combat answer, and a merchant selling a mace is selling a solution to an
encounter.

### C. Impact presentation

| Channel | Rule | Owner |
|---|---|---|
| Camera shake | A decaying impulse on the **spring arm**, never on the world: amplitude `0.25° × tier_index` (light 1 … ultra 4), decay over `hitstop + 4` frames, zero net rotation | RI-CAM06 is authoritative; this item only requests the magnitude |
| Decal | Per material: blood spray (flesh), chip (chitin), spark + dust (stone/metal/shield), splinter (wood), splash (water). One decal per hit, never per active frame | this item |
| VFX | Impact burst scaled to `poise_damage`, not to damage | this item |
| Weapon trail | Present during active frames, persisting **6 f** past the last active frame | this item |
| Audio | Per (tier × material) sample bank | **RI-AUD01** — deferred, and this item scores 0 on any audio claim |
| Damage number | **None.** No floating combat text, ever | RI-UI (AR-2: this is a Souls fight, not an ARPG) |

### D. Whiff — what it costs to miss

A whiff must be *felt as a miss*, and the arithmetic must be exact:

```
total_on_hit  =  total_on_whiff  +  attacker_hitstop
```

Hitting takes **longer** in wall-clock than missing, by exactly the hitstop frames. This is
the single most important consequence of hitstop and the one most often inverted: a build
that shortens recovery on hit ("it feels responsive") deletes the trade model, because
landing a hit becomes safer than missing one.

| Property | Requirement |
|---|---|
| Hitstop on whiff | **0 frames**, always |
| Camera shake on whiff | none |
| Weapon trail on whiff | present, persisting 6 f past active — the trail is how you see what you missed with |
| Follow-through | the tip continues along the swing arc for ≥20% of recovery frames before reversing (§E) |
| Recovery on whiff | exactly the `recovery_f` in RI-WPN02 §B / RI-WPN04 §A, unchanged |
| Stamina on whiff | full cost, deducted on frame 1 (RI-CMB02 §D.6) |

### E. `ES-MASS/1` — mass in the animation

Measured from the weapon's **tip bone** world position, sampled every simulated frame.

| Quantity | Definition | light | medium | heavy | ultra |
|---|---|---|---|---|---|
| Peak tip speed (m/s) | max over the animation | 14–20 | 18–26 | 22–32 | 26–40 |
| **Anticipation fraction** | fraction of startup frames in which the tip's component along the swing direction is **negative** | ≥ 0.08 | ≥ 0.15 | ≥ 0.25 | ≥ 0.30 |
| **Follow-through fraction** | fraction of recovery frames in which the tip still travels along the swing direction before reversing | ≥ 0.20 | ≥ 0.20 | ≥ 0.25 | ≥ 0.30 |
| **Deceleration ratio** | tip speed at (impact frame + hitstop) ÷ peak tip speed, on a hit | ≤ 0.45 | ≤ 0.40 | ≤ 0.35 | ≤ 0.30 |
| **Settle** | number of sign changes in the root's forward velocity during recovery | ≥ 0 | ≥ 1 | ≥ 1 | ≥ 2 |
| Tip speed continuity | max frame-to-frame change in tip speed ÷ peak | ≤ 0.35 | ≤ 0.35 | ≤ 0.30 | ≤ 0.30 |

**Anticipation is the diagnostic.** An animation with zero anticipation frames — the weapon
starts moving forward on frame 1 — is not an animation with a mass problem; it is an
animation that was interpolated from A to B, and every other feel metric will be downstream
of that. It is also invisible in a screenshot, which is why it is a number here.

### F. The headline measurable — Impact Legibility Score

```
For each of the 35 (weight tier × material) cells:
  run one hit, extract the observable triple  (attacker_hitstop, camera_shake_peak, knockback_m)
  strip the labels
  a classifier (the critic, or a nearest-neighbour over §A/§C) must recover (tier, material)
ILS = correctly recovered cells / 35
```

| Threshold | Value | Meaning |
|---|---|---|
| **`ILS ≥ 0.80`** | **PASS** | The player can tell what they hit and what with, from feedback alone |
| `0.50 ≤ ILS < 0.80` | Below bar | Impact exists and is partially generic |
| **`ILS < 0.40`** | **HARD FAIL** | Every hit feels the same. This is the G5 failure exactly. |
| **`attacker_hitstop == 0` on every cell** | **HARD FAIL** | Hitstop was never built. `ILS` is undefined and reports as 0. |

Supporting requirement: within each tier row of §A, the span `max − min` of attacker hitstop
must be ≥ 4 f for medium, heavy and ultra, and attacker hitstop must be **monotone
non-decreasing** down the tier column for every material. Those two constraints are what make
`ILS` achievable without inventing separate feedback channels.

## Comparison method

Script: **`corpus/80-methods/m-wpn05-impact.mjs`**

**M1 — Hitstop census.** Spawn one dummy per material (7 dummies, `wpn-material-range`
scenario), each with a known hurtbox at 2.0 m. For each weight tier, using that tier's
baseline weapon at +0, land one `r1.1` on each dummy.
- From the trace, `attacker_hitstop` = the number of consecutive frames on which
  `player.anim_frame` does not advance while `player.state == 'ATTACK'`, starting at the
  frame carrying the `hit` event. `victim_hitstop` likewise from the enemy record.
- Report the full 5×7 attacker grid and the victim grid. Diff against §A, tolerance **±0 f**.
- **FAIL** any cell off by ≥1 f. **HARD FAIL** if every attacker cell is 0.
- **FAIL** if hitstop is implemented by scaling `timeScale` rather than by holding
  `anim_frame` — detectable as a non-integer `anim_frame` anywhere in the trace, which
  HARNESS.md §8 D4 already forbids.

**M2 — Material multipliers.** Same fixture. For each material × each damage type (using one
class per type: SSW slash, SPR thrust, MCE strike), land one hit on a dummy with defence 0
and read damage.
- Compute the implied multiplier and diff against §B, tolerance ±0.01.
- **FAIL** any cell off. **FAIL** if any enemy statblock lacks a `material` field (report the
  count; the material checks score 0 if >10% are missing).
- **FAIL** if damage varies across 20 repeats of the identical hit — S1: no dice.

**M3 — Deflection.** Land TSW (thrust, `poise_damage` 12), SSW (slash, 22) and MCE (strike,
32) on `stone`.
- **PASS** if TSW and SSW deflect (zero damage, +8 f recovery, `deflect` event) and MCE does
  not.
- **FAIL** if deflection is probabilistic in any way.
- **FAIL** if the deflect's added recovery is not exactly 8 f.

**M4 — Whiff arithmetic.** For each of the 15 classes: land one `r1.1` on a flesh dummy, then
throw the identical input at empty air.
- **PASS** only if `total_on_hit − total_on_whiff == attacker_hitstop` exactly, for every
  class.
- **FAIL** if `total_on_hit < total_on_whiff` for any class — landing a hit must never be
  faster to recover from than missing.
- **FAIL** on any hitstop, shake or knockback on the whiff.

**M5 — Mass census.** Requires the tip-bone harness extension. For each of the 14 melee
classes, sample the tip position every frame across `r1.1` and `r2`, on a hit and on a whiff.
- Compute every quantity in §E; diff against the tier bands.
- **FAIL** any class violating anticipation, follow-through, deceleration or settle.
- **HARD FAIL** if the tip speed curve is piecewise-linear across the whole animation for
  ≥3 classes — that is a lerp with a weapon attached, and no amount of hitstop rescues it.
- Report the fourteen tip-speed curves as a small-multiples plot in the verdict. It is the
  artifact a human reader can judge instantly and the reason this method is worth its cost.

**M6 — Impact Legibility Score.** Run all 35 cells; extract the observable triple; strip
labels; classify by nearest neighbour in the normalised triple space; compute `ILS`.
- Apply §F thresholds. **HARD FAIL** on `ILS < 0.40`.
- Then repeat as a **blind human-equivalent test**: present the critic with 10 unlabelled
  8-frame image sequences captured at the moment of impact (`screenshot()` at
  `hit_frame + k`, k ∈ [0,7]) and ask it to name the material and the weapon weight. Record
  the blind accuracy separately; if the nearest-neighbour `ILS` passes and the blind test
  fails, the feedback is legible to a classifier and not to a player, and the blind result
  wins.

**M7 — Presentation discipline.** From `getWorldStats()` and the screenshots:
- **FAIL** if any floating damage number appears (AR-2).
- **FAIL** if camera shake produces net rotation (compare camera yaw/pitch 30 f before and
  30 f after the hit; must match within 0.01°).
- **FAIL** if more than one decal spawns per hit.

**M8 — Determinism.** M1, M2, M4 at five seeds.

### Harness extensions this method requires

1. **`player.hitstop_f` and `enemies[].hitstop_f`** in the frame record — frames of hitstop
   currently applied. Everything in this item is unmeasurable without it; the `anim_frame`
   stall heuristic in M1 is a fallback, not a substitute.
2. **`player.weapon_tip: [x,y,z]`** — the tip bone's world position, per frame. §E cannot be
   measured any other way, and reconstructing it from the hitbox capsule's `b` endpoint is
   only valid while the hitbox is active (10 of 60 frames).
3. **`impact` event type** in the `events[]` vocabulary:
   `{"f":221,"type":"impact","material":"chitin","tier":"heavy","hitstop_f":8,"knockback_m":0.25,"deflect":false,"decal":"chip"}`.
   The existing `hit` event carries no material and no feedback data.
4. **`deflect` event type.**
5. **`camera.shake_deg`** in the frame record (RI-CAM06 may own the field; requested jointly).
6. Scenario **`wpn-material-range`**: seven static dummies, one per material, at 2.0 m, all
   with defence 0 and poise 9999 (so nothing staggers and hitstop is isolated from stagger).
7. `screenshot()` must be callable at a specific simulated frame without advancing the sim
   (it is, per HARNESS.md §3 `renderFrame()`; stated here because M6 depends on it).

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 hitstop census | 25 | All 35 attacker cells and 35 victim cells exact |
| M2 material multipliers | 15 | All 18 cells exact; every statblock has a material; zero variance |
| M3 deflection | 10 | Deterministic, correct bypass, exactly +8 f |
| M4 whiff arithmetic | 15 | `hit − whiff == hitstop` for all 15 classes |
| M5 mass census | 20 | Every class inside its §E bands; no piecewise-linear tip curves |
| M6 `ILS` | 15 | `ILS ≥ 0.80` and the blind test agrees |

Max 100. M7 is pass/fail and gates the whole item (see hard fails).

| Native | Verdict band |
|---|---|
| ≥ 84 | Meets the bar |
| 58–83 | Below bar — named remedy required |
| < 58 | Loses outright |

**Native-to-ladder mapping (SCORING.md §1.2 / BAR-CRITIQUE-01 W7):**

| Ladder | Native score |
|---|---|
| 4 | 58 |
| 6 | 72 |
| 8 | 89 |

**Hard fails regardless of score:**
- Zero hitstop everywhere — the mechanic was not built.
- `ILS < 0.40` — every hit feels the same (BAR-CRITIQUE-01 G5, unremedied).
- Hitstop implemented as a wall-clock duration or as an animation `timeScale` change rather
  than as an integer frame hold (HARNESS.md §8 D3/D4).
- Any randomness in damage, deflection or hitstop (ARBITRATION S1 / AR-1).
- `total_on_hit < total_on_whiff` for any class.
- Floating damage numbers (AR-2).
- Camera shake with net rotation, or shake applied to the world rather than the arm.
- Tip speed curves piecewise-linear for ≥3 classes.

**Blind pair:** two sets of ten 8-frame impact sequences, ours and a reference set generated
from §A/§C, unlabelled. The critic picks which set is a game where hitting things matters, and
records the pick before the reveal.

## How we lose

1. **No hitstop at all.** The most likely outcome, because hitstop is invisible until it is
   missing and nothing else in the corpus asks for it. The animation plays through the
   contact frame at constant speed, HP drops, and the weapon passes through the target like
   it is passing through fog. This is the whole of G5 and it is a hard fail here.
2. **Hitstop as `setTimeout(80)`.** Built, felt, and frame-rate coupled. At 144 Hz it is
   twelve frames; at 30 Hz it is two. Every number in §A becomes unmeasurable, and it will be
   defended on the grounds that it "feels right on my machine".
3. **One hitstop value for everything.** `HITSTOP_FRAMES = 4`. Cheap, better than nothing,
   and it makes a dagger and an ultra greatsword feel identical at the exact moment the
   player is paying most attention. `ILS` collapses to ~0.14 (chance) and the span
   requirement in §F is the specific tripwire.
4. **Materials never authored.** Every enemy is `flesh` because filling in a field on eighty
   statblocks is boring. §B becomes a table nobody reads, the mace has no reason to exist,
   RI-WPN02's `D_min` loses its most distinctive class, and the AR-3 seam-crossing
   interaction this item contributes disappears with it.
5. **Materials as resistances only.** The multiplier is applied to damage and nothing else —
   no different hitstop, no different decal, no deflection. The player learns the system from
   a wiki instead of from their hands, which is precisely the Morrowind failure this project
   is supposed to be fixing rather than importing.
6. **Deflection made probabilistic** ("15% chance to bounce off armour"), because that is how
   every RPG the team has played does it. It is an AR-1 automatic fail and it will be
   proposed sincerely.
7. **Recovery shortened on hit.** Someone notices that hitstop makes landing an attack feel
   sluggish and "fixes" it by cutting recovery when the attack connects. The trade model
   dies: attacking becomes safer than not attacking, and every punish window in RI-AI03 is
   silently widened. M4's exact-equality test is the only thing that catches it.
8. **Mass faked with camera shake.** Shake is cheap and reads as impact in a video, so it
   grows to cover for animations with no anticipation and no follow-through. It also makes
   the game unplayable in a way nobody will attribute to this decision. M5 measures the
   animation directly and M7 bounds the shake.
9. **Tip bone never exposed**, so M5 cannot run, so the mass section scores 0 fail-closed and
   the team concludes the metric is unfair rather than that the instrument is missing. The
   harness extension in this method is the cheapest item on the list and the one most likely
   to be deprioritised.
10. **Floating damage numbers**, added during a "readability" pass because a playtester could
    not tell if their hits were landing. The correct fix for that playtester is this entire
    item; the number is the symptom being medicated.
11. **Weapon trail as the whole of feel.** A bright ribbon shader is added, everyone agrees
    combat feels better, and none of hitstop, material, deflection or mass is built. The
    trail is one row of §C for a reason.

## Provenance note

`provenance: constructed`, confidence **medium** — lower than this area's other items, and
deliberately so. Every hitstop frame count, material multiplier, knockback distance,
deflection rule, anticipation fraction and threshold in §A–§F is **defined for this project**.
Unlike frame data, feel numbers have no community measurement tradition to lean on: there is
no published hitstop table for any FromSoftware title, and the values here are set by the
internal logic of the tables (monotone in tier, spanning ≥4 f per row so `ILS` is achievable)
rather than by observation. A future wave that measures real hitstop from video frame analysis
should overwrite §A and this note should be updated to `derived`.

Grounding is `canonical-recall`, confidence **medium**, of the following observed properties
of Dark Souls 1/3 and Elden Ring: a visible freeze on contact whose length scales with weapon
weight; a distinctly different, harder, sparking impact when a blade meets a shield or a stone
construct, including attacks that visibly bounce; heavier weapons producing visible target
displacement while light weapons do not; the absence of floating damage numbers throughout the
series; and windup animations in which large weapons travel backwards and downwards before the
swing. None of those recollections carries a number and none should be cited as one.

The material taxonomy in §B is `constructed` and is shaped by this project's setting: chitin,
root, water-logged and stone are the four surfaces Black Marsh actually presents, per the lore
and world items, which own every dressing named in the "typical bearers" column. If RI-AI05's
roster or the lore items disagree about what a root-golem is made of, they win.

Cross-dependencies: RI-CAM06 is authoritative on all camera motion and may veto §C's shake
magnitudes; RI-AUD01 (when it exists, per BAR-CRITIQUE-01 G5) owns audio and this item scores
0 on any audio claim until then; RI-CMB04 owns hurtbox regions and therefore where a material
is read from; RI-CMB05 owns stagger, which M1 deliberately isolates by giving the census
dummies 9999 poise; RI-CMB02 §D.4 owns the one-activation-per-swing rule that makes "one decal
per hit" checkable; RI-WPN02 §B supplies the weight tiers. This item **partially** closes
BAR-CRITIQUE-01 G5: the impact half. The audio half remains open and must not be scored as
closed by anyone citing this file.
