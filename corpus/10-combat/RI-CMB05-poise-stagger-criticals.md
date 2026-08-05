---
id: RI-CMB05
title: Poise, stagger, hyperarmour, and the critical windows (backstab, parry, riposte)
kind: number
side: souls
judges: [combat.poise, combat.stagger, combat.hyperarmour, combat.criticals, combat.parry, combat.trade]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

Poise decides **who gets to finish their swing**. It is the mechanic that makes armour a
tactical choice rather than a damage number, that makes a two-handed ultra greatsword a
different verb from a dagger, and that turns every exchange into a question of whether you
can eat the hit and land yours. "Good" means: light weapons interrupt light enemies and
bounce off armoured ones; heavy attacks carry a declared, learnable window during which the
attacker cannot be flinched but *can* still be killed; stagger is a real animation with a
real length that the opponent can punish; and criticals — backstab and riposte — are earned
by **position and timing**, never by a probability roll (ARBITRATION S1, and see RI-CMB04 §E).

The failure states are symmetric and both fatal. If poise is too generous, everything trades
and the game becomes a damage race. If poise does not exist, every hit is a stunlock and
whoever swings first wins. If criticals are a percentage chance, the game is a slot machine
wearing a sword.

## The reference artifact

### A. The poise pool (`ES-POISE/1`)

Poise is a **pool that depletes and refills**, not a threshold compared per-hit.

```
poise_resist        = clamp(armour_poise / 120, 0.00, 0.60)     # armour_poise ∈ [0, 72]
poise_health_max    = 20 + armour_poise                          # player
effective_pd        = incoming_poise_damage * (1 - poise_resist)
poise_health       -= effective_pd
if poise_health <= 0:  STAGGER, and poise_health := poise_health_max after the stagger ends
```

| Quantity | Value | Notes |
|---|---|---|
| Player base poise health (naked) | **20** | |
| Player `armour_poise` range | **0 – 72** | Sum of four armour pieces; heaviest full set = 72 |
| `poise_resist` cap | **0.60** | Reached at `armour_poise` 72 |
| Poise regeneration delay | **90 frames (1.500 s)** after the last poise damage taken | |
| Poise regeneration rate | **20.0 / second** | Linear, flat |
| Poise reset on stagger | full, on the frame the stagger animation ends | Prevents stagger-lock chains |
| Poise while rolling / i-framed | irrelevant | `IFRAME_NEGATE` fires before poise (RI-CMB04 §E) |
| Poise while blocking successfully | **poise damage = 0** | A block that does not break guard never staggers |
| Poise while guard-broken | **bypassed entirely** | Guard break is not a poise event (RI-CMB03 §D) |

Player poise damage output is the `Poise dmg` column of RI-CMB02 §A/§B. Enemy poise health
values are owned by RI-AI05's roster statblocks; the RI-CMB07 exemplar's Hist-Marked
Champion carries **28**.

### B. Stagger

Stagger length is a function of the **poise damage of the blow that broke the pool**, not of
the damage dealt. A dagger that breaks poise staggers briefly; an ultra greatsword flattens.

| Tier | Poise damage of the breaking hit | Stagger frames | Additional |
|---|---|---|---|
| Light | 1 – 19 | **16** | |
| Medium | 20 – 39 | **22** | |
| Heavy | 40 – 69 | **32** | pushback 0.6 m |
| Massive | ≥ 70 | **48** | knockdown, +30 f getup, 8 f of i-frames on the getup |

During stagger: no input is accepted, stamina regeneration is 0, the target is fully
vulnerable, and the hurtboxes continue to follow the stagger animation's skeleton (RI-CMB04
§D.1). Stagger is **not** cancellable by anything, including further hits — a target already
staggered takes damage from subsequent hits but the stagger timer does not restart. This is
what prevents infinite stunlock and it is a rule, not an optimisation.

The RI-CMB07 exemplar contains three medium staggers (22 f each) from enemy attacks with
poise damage 32, 32 and 20, plus one 40-frame guard break, totalling 110 frames of player
hitstun in 59 seconds — **3.1% of the fight**.

### C. Hyperarmour

A declared frame window on heavy attacks (RI-CMB02 §B) during which the attacker swaps their
normal poise pool for a **weapon-class hyperarmour pool**:

| Class | HA pool, 1-handed | HA pool, 2-handed | Window (from RI-CMB02 §B) |
|---|---|---|---|
| Dagger | — | — | none, ever |
| Straight sword | 22 | 29 | R2 f16–f31 |
| Spear | 20 | 26 | R2 f17–f30 |
| Axe | 30 | 39 | R2 f20–f36; **R1 f9–f19 when 2-handed only** |
| Halberd | 36 | 47 | R2 f23–f41 |
| Greatsword | 46 | 60 | R2 f26–f49; **R1 f13–f26 when 2-handed only** |
| Ultra greatsword | 62 | 81 | R2 f34–f63; **R1 f18–f34 when 2-handed only** |

Rules:

1. Inside the window, incoming poise damage depletes the **HA pool**, not the normal pool.
   The pool refills instantly when the window ends. A single window is not a shared budget
   across the animation's life.
2. **Hyperarmour prevents stagger. It does not prevent damage.** You trade, you win the
   exchange, and you may still die doing it. This is the entire point.
3. A **fully charged** R2 (RI-CMB02 §C) multiplies the HA pool by **1.50** and extends the
   window forward across all charge frames.
4. Hyperarmour never applies during startup before the declared window, never during
   recovery, and never on light attacks except the three two-handed exceptions above.
5. Guard break and criticals bypass hyperarmour completely.
6. **Enemies obey the identical rule** with their own declared windows in RI-AI05 statblocks.
   An enemy with permanent hyperarmour is a design error, not a difficulty setting.

### D. Criticals — the positional windows

Criticals are geometry plus state. There is no chance component anywhere.

**Backstab**

| Condition | Value |
|---|---|
| Attacker's position relative to target | within **±35°** of the target's rear axis |
| Attacker→target distance (root to root) | ≤ **1.20 m** |
| Attacker facing | target within **±45°** of attacker's forward |
| Target state | not `IFRAME`, not in a hyperarmour window, not already in a critical, not `DEAD` |
| Input | light attack (R1) while all of the above hold on the same frame |
| Animation length | **62 frames** |
| Attacker invulnerable | frames **8–54** |
| Damage applied on | frame **30** |
| Stamina | 24 |
| Damage | `weapon_ar × crit_multiplier` (dagger 1.40, straight sword 1.10, greatsword 1.05, UGS 1.00) |
| Target on completion | released into a 24-frame getup, 6 f of i-frames at its end |

The attacker is vulnerable on frames 1–7 and 55–62. In a group fight this is the cost of
greed, and it must be real.

**Parry**

| Property | Buckler / small shield | Dedicated parry tool | Medium shield | Greatshield |
|---|---|---|---|---|
| Animation length | 34 f | 32 f | 40 f | — (cannot parry) |
| **Active parry window** | f5–f13 (**9 f**) | f3–f14 (**12 f**) | f8–f14 (**7 f**) | — |
| Whiff recovery | 21 f, no i-frames | 18 f | 26 f | — |
| Stamina | 22 | 22 | 26 | — |

A parried target enters `PARRIED` for **28 frames**, is fully vulnerable, and is riposte-able
for frames **4–26** of that state. Unparryable attacks are declared per-move in the statblock
and must be a minority of any enemy's moveset.

**Riposte**

| Property | Value |
|---|---|
| Available on target state | `PARRIED` f4–f26, or `GUARD_BREAK` f6–f34 (RI-CMB03 §D) |
| Animation length | **78 frames** |
| Attacker invulnerable | frames **10–68** |
| Damage applied on | frame **40** |
| Stamina | 28 |
| Damage | backstab damage × **1.50** |

### E. Trade arithmetic (the derived check)

The numbers above must produce these outcomes. A critic should verify the *outcomes*, not
just the inputs.

| Scenario | Required result |
|---|---|
| Dagger R1 (pd 8) vs naked player (ph 20, resist 0.00) | 3 hits to stagger |
| Dagger R1 (pd 8) vs heavy armour (ph 92, resist 0.60) | 29 hits to stagger — i.e. never |
| UGS R1 2H (pd 58×1.30 = 75) vs heavy armour (ph 92, resist 0.60) | 30 effective → 4 hits |
| UGS R2 2H (pd 92×1.30 = 120) vs heavy armour | 48 effective → 2 hits, second is Massive tier |
| Straight sword R1 (pd 22) into UGS 2H R1 hyperarmour (pool 81) | attacker is **not** staggered; both take damage |
| Straight sword R2 (pd 40) into straight sword R2 hyperarmour (pool 22) | HA pool broken; attacker **is** staggered |
| Any hit onto a successful block | 0 poise damage, no stagger |

## Comparison method

Script: **`corpus/80-methods/m-cmb05-poise.mjs`**

Harness: headless Node + Three.js, fixed 60 Hz, seeded, scripted inputs on both actors,
emitting `es-combat-trace/1` (RI-CMB07) with `p.poise_cur`/`e.poise_cur` exposed on the debug
channel described in RI-CMB04.

**M1 — Pool arithmetic.** For each row of §E, script the exact scenario and count hits to
stagger.
- **FAIL** on any deviation of ±1 hit.
- **FAIL** if poise is implemented as a per-hit threshold (`if pd > poise then stagger`)
  rather than a depleting pool — detect by landing two hits whose individual `pd` is below
  the pool but whose sum exceeds it; a threshold model will not stagger.

**M2 — Poise regeneration.** Deplete the pool to 50%, then idle.
- **FAIL** if regeneration begins before frame 90 or after frame 91.
- **FAIL** if the rate differs from 20/s by more than 2%.
- Land a hit at frame 60 of the delay: **FAIL** unless the delay re-arms to a full 90.

**M3 — Stagger length census.** For each tier in §B, land a breaking hit of that tier.
- **FAIL** if the stagger frame count differs from §B by ≥1.
- Land a second hit during the stagger: **FAIL** if the stagger timer restarts or extends.
- **FAIL** if any input is accepted during stagger.
- **FAIL** if poise does not reset to full on the stagger's final frame.

**M4 — Hyperarmour window probe.** For each class × {R1 2H where applicable, R2}, and each
frame `k ∈ [1, total]`, inject an enemy hit of known poise damage on frame `k`.
1. Build the vector `S[k] ∈ {staggered, absorbed}`.
2. The `absorbed` run must be **exactly** the window in §C.
- **FAIL** on any frame of leakage or any hole.
- **FAIL** if damage is also absorbed (hyperarmour must not reduce damage by even 1).
- Repeat with a hit whose poise damage exceeds the HA pool: **FAIL** if it is absorbed.
- Repeat with a fully charged R2: **FAIL** if the pool is not ×1.50.
- **FAIL** if a dagger ever exhibits hyperarmour.

**M5 — Backstab geometry.** Place the attacker on a 5° polar grid around a stationary target
at radii 0.6, 1.0, 1.2, 1.4 m; inject R1 at each pose.
1. Build the boolean field `B[angle][radius]`.
- **FAIL** if the `true` region is not exactly the ±35° / ≤1.20 m sector, within one grid
  cell.
- **FAIL** if any backstab succeeds against a target inside a hyperarmour window or i-frames.
- **FAIL** if the attacker takes damage from a third party during frames 8–54, or fails to
  take damage during frames 1–7 or 55–62.
- **FAIL** if damage lands on any frame other than 30.

**M6 — Parry window probe.** For each shield type, for each offset `k` between the parry
press and the incoming hitbox activation, `k ∈ [−20, +30]`:
- Build `P[k] ∈ {parried, hit}`. The `parried` run must exactly equal §D's active window.
- **FAIL** on any leak or hole; **FAIL** if the whiff recovery grants i-frames.

**M7 — Riposte gating.** Attempt a riposte on each frame of `PARRIED` and of `GUARD_BREAK`.
- **FAIL** unless the success windows are exactly f4–f26 and f6–f34 respectively.

**M8 — No dice.** Run M1, M5 and M6 with 100 distinct seeds.
- **FAIL** on any variance in any outcome. There is no crit chance, no stagger chance, no
  parry-success roll.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 pool arithmetic | 20 | All §E rows, pool not threshold |
| M2 poise regeneration | 10 | 90 f delay, 20/s, re-arms |
| M3 stagger census | 15 | Exact lengths, no restart, no input, resets |
| M4 hyperarmour probe | 20 | Windows exact, damage unaffected |
| M5 backstab geometry | 15 | Sector exact, invuln frames exact |
| M6 parry window | 10 | Windows exact, no whiff i-frames |
| M7 riposte gating | 5 | Both windows exact |
| M8 no dice | 5 | Zero variance |

- **≥ 90** — parity.
- **70–89** — gap named, remediable.
- **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - any chance-based critical, stagger, or parry;
  - Morrowind knockdown semantics inside the fight (ARBITRATION §1: poise is the Souls
    model, full stop);
  - permanent hyperarmour on any actor;
  - hyperarmour that reduces damage;
  - stagger that can be re-triggered during stagger (stunlock);
  - poise implemented as a per-hit threshold instead of a depleting pool;
  - backstab available from the front, at any distance, or by "highest damage roll wins".

**Blind pair:** show the critic two `S[k]` hyperarmour probe vectors and two `B[angle][radius]`
backstab fields, unlabelled, and ask which game rewards commitment. Record the blind pick
before the reveal.

## How we lose

1. **Every hit staggers.** The zero-effort implementation: play the hitstun animation on any
   damage. Result is stunlock in both directions, and a game decided by who swings first.
   The player will discover they can perma-lock most enemies with a dagger within ten minutes.
2. **No hit staggers.** The opposite zero-effort implementation, reached by fixing (1) badly.
   Enemies become unflinching, light weapons become unusable, and the crowd-control layer of
   combat disappears.
3. **Poise as a threshold, not a pool.** `if (poiseDamage > target.poise) stagger`. Looks
   right in a single-hit test and is wrong in a fight: chip damage from repeated light hits
   should eventually break a heavy enemy, and under a threshold model it never does. M1's
   two-hit probe is aimed exactly here.
4. **Hyperarmour as invulnerability.** Implemented as "ignore incoming hits during the swing"
   rather than "ignore incoming *stagger*". Suddenly the heavy weapon is strictly dominant
   and trades are free.
5. **Hyperarmour for the whole animation.** Because tracking a frame window inside an
   animation is fiddly. Then heavy weapons never flinch, and there is no reason to use
   anything else.
6. **Backstab by dot product only.** `if (dot(attacker.forward, target.forward) > 0.7)` with
   no distance check and no state check, so backstabs land from three metres away, through
   walls, and on enemies mid-swing. The genre's most notorious bug class, reproduced for free.
7. **Backstab as an instant teleport-and-kill.** No invulnerability accounting, so a second
   enemy's hit either interrupts the animation (making backstabs useless in groups) or is
   ignored entirely (making them free). §D's f8–f54 window is the specific thing to get right.
8. **Parry with a generous "just press it near the hit" window** implemented as a seconds-based
   timer, which then differs by frame rate. The parry becomes either impossible or trivial and
   there is no middle setting.
9. **Stagger animations that are cancelled by the next hit**, producing a target that is
   permanently in frame 1 of hitstun and visually vibrating.
10. **Poise as a passive damage-reduction stat**, because "poise" sounds like armour. It is
    not armour; it is interruption resistance, and conflating them makes heavy armour a
    strictly-better choice with no trade-off.

## Provenance note

Mixed. `confidence: medium` overall, and deliberately lower than RI-CMB01–04 because the
upstream behaviour this item imitates is itself contested in the community.

- **`community-data`, confidence low–medium:** the existence and rough shape of the Dark
  Souls III model — that poise health is a pool, that a hit's poise damage is scaled by the
  defender's Poise stat, that the stagger point is reached when poise health hits zero, that
  hyperarmour is granted only during declared frames of heavy attacks and generally requires
  two-handing on mid-weight classes, and that a fully charged strong attack increases poise
  health by roughly 50%. Sources:
  [Poise (Dark Souls III) — Dark Souls Wiki](https://darksouls.fandom.com/wiki/Poise_(Dark_Souls_III)),
  [Poise — Dark Souls 3 Wiki (Fextralife)](https://darksouls3.wiki.fextralife.com/Poise),
  [Poise — Dark Souls Wiki (Fextralife)](https://darksouls.wiki.fextralife.com/Poise).
  The DS3 poise formula circulated by the community is reported as
  `Stagger Point = Poise Health − (Poise Damage × Poise/100)`. Our §A is a **different**
  formula that produces similar behaviour with parameters we can measure; we did not adopt
  theirs and must not claim to have.
- **`canonical-recall`, confidence medium:** that criticals are positional and deterministic;
  that a backstab grants the attacker invulnerability for the bulk (but not all) of the
  animation; that parry windows are on the order of 8–12 frames; that guard break opens a
  riposte; that stagger duration scales with the weight of the blow.
- **`constructed`, confidence high, and binding:** every numeric value in §A–§E. The pools,
  the 0.60 resist cap, the 90-frame/20-per-second regeneration, the four stagger tiers and
  their exact frame counts, every hyperarmour pool and window, the ±35°/1.20 m backstab
  sector, all critical animation lengths and their invulnerability and damage frames, every
  parry window, and the whole of §E. The medium-tier stagger length of **22 frames** is
  load-bearing: it is the value used by all three player staggers in the RI-CMB07 exemplar
  trace, and changing it invalidates that artifact's hitstun statistics.
