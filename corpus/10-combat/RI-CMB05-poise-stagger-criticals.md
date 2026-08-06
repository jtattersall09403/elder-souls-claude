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
| Poise regeneration delay | **90 f@60 (1.500 s)** after the last poise damage taken | **NOT rebased (S22)** — authored as a duration, like `RI-CMB03`'s 42 f (0.70 s). 1.5 s of no-poise-damage is a wall-clock condition on the *player's* behaviour, not an animation length, so the unit fix does not touch it |
| Poise regeneration rate | **20.0 / second** | Linear, flat. **NOT rebased** — a per-second rate is unit-invariant under a frame-base correction |
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

> **REBASED — AMENDED wave 0 (rebase-s22), ARBITRATION seam S22.** Stagger lengths, critical
> animation lengths, parry windows and hyperarmour windows are all **doubled**; the poise pool
> arithmetic, the poise-damage thresholds, the regeneration rate and the regeneration *delay*
> are **not** (see the note in §A). Pre-rebase values are struck through. All frame counts are
> `f@60`.

| Tier | Poise damage of the breaking hit | Stagger frames | **Was** | Additional |
|---|---|---|---|---|
| Light | 1 – 19 | **32 f@60 (533 ms)** | ~~16~~ | |
| Medium | 20 – 39 | **44 f@60 (733 ms)** | ~~22~~ | |
| Heavy | 40 – 69 | **64 f@60 (1067 ms)** | ~~32~~ | pushback 0.6 m |
| Massive | ≥ 70 | **96 f@60 (1600 ms)** | ~~48~~ | knockdown, **+60 f@60** getup, **16 f@60** of i-frames on the getup ~~+30 f / 8 f~~ |

**The poise-damage thresholds (1–19 / 20–39 / 40–69 / ≥70) are NOT rebased.** Poise damage is
not a frame count; it is a quantity of a pool, and it is unchanged in §A and in `RI-CMB02`'s
`Poise dmg` columns. Only the *lengths* of the animations those thresholds select move.

During stagger: no input is accepted, stamina regeneration is 0, the target is fully
vulnerable, and the hurtboxes continue to follow the stagger animation's skeleton (RI-CMB04
§D.1). Stagger is **not** cancellable by anything, including further hits — a target already
staggered takes damage from subsequent hits but the stagger timer does not restart. This is
what prevents infinite stunlock and it is a rule, not an optimisation.

~~The RI-CMB07 exemplar contains three medium staggers (22 f each) from enemy attacks with
poise damage 32, 32 and 20, plus one 40-frame guard break, totalling 110 frames of player
hitstun in 59 seconds — 3.1% of the fight.~~

> **INVALIDATED — AMENDED wave 0 (rebase-s22).** The RI-CMB07 exemplar trace is invalidated by
> seam S22 (the ruling accepts that cost explicitly) and cannot be cited as evidence for any
> frame figure until it is regenerated. See `RI-CMB07` §0 and `REBASE-S22-REPORT.md` §4. For
> orientation only: at the rebased 44 f@60 medium stagger, three medium staggers plus one
> guard break is **172 f** of hitstun, and the fight itself is longer, so the *fraction* is the
> figure that a regenerated exemplar must re-establish — not the frame total.

### C. Hyperarmour

A declared frame window on heavy attacks (RI-CMB02 §B) during which the attacker swaps their
normal poise pool for a **weapon-class hyperarmour pool**:

**AMENDED wave 0 (rebase-s22).** The **HA pool sizes are poise quantities and are unchanged.**
The **windows are frame data and are re-derived** from `RI-CMB02` §B's rebased startups through
`[ceil(0.60 × startup), startup + active]`. ⚠ marks the four windows where re-derivation and a
naive ×2 disagree, because `ceil()` does not commute with doubling.

| Class | HA pool, 1-handed | HA pool, 2-handed | Window (from RI-CMB02 §B) | **Was** |
|---|---|---|---|---|
| Dagger | — | — | none, ever | — |
| Straight sword | 22 | 29 | R2 **f30–f62** | ~~f15–f31~~ |
| Spear | 20 | 26 | R2 **⚠ f33–f64** | ~~f17–f32~~ |
| Axe | 30 | 39 | R2 **f36–f74**; **R1 f20–f44 when 2-handed only** | ~~f18–f37 / f10–f22~~ |
| Halberd | 36 | 47 | R2 **⚠ f41–f84** | ~~f21–f42~~ |
| Greatsword | 46 | 60 | R2 **f48–f100**; **R1 ⚠ f27–f60 when 2-handed only** | ~~f24–f50 / f14–f30~~ |
| Ultra greatsword | 62 | 81 | R2 **⚠ f63–f128**; **R1 ⚠ f35–f78 when 2-handed only** | ~~f32–f64 / f18–f39~~ |

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
| Animation length | **124 f@60 (2067 ms)** ~~62 frames~~ |
| Attacker invulnerable | frames **15–108** ~~8–54~~ |
| Damage applied on | frame **60** ~~30~~ |
| Stamina | 24 |
| Damage | `weapon_ar × crit_multiplier` (dagger 1.40, straight sword 1.10, greatsword 1.05, UGS 1.00) |
| Target on completion | released into a **48 f@60** getup, **12 f@60** of i-frames at its end ~~24-frame / 6 f~~ |

The attacker is vulnerable on frames **1–14 and 109–124**. In a group fight this is the cost of
greed, and it must be real. *(AMENDED wave 0 (rebase-s22): was frames 1–7 and 55–62. The
geometric conditions — ±35°, 1.20 m, ±45° — are angles and distances, not frames, and are
unchanged.)*

**Parry**

**AMENDED wave 0 (rebase-s22).** Windows map `[a,b] → [2a−1, 2b]`, which preserves 1-based
inclusive indexing and doubles the length exactly. Stamina costs are unchanged.

| Property | Buckler / small shield | Dedicated parry tool | Medium shield | Greatshield |
|---|---|---|---|---|
| Animation length | **68 f@60** ~~34 f~~ | **64 f@60** ~~32 f~~ | **80 f@60** ~~40 f~~ | — (cannot parry) |
| **Active parry window** | **f9–f26 (18 f@60, 300 ms)** ~~f5–f13 (9 f)~~ | **f5–f28 (24 f@60, 400 ms)** ~~f3–f14 (12 f)~~ | **f15–f28 (14 f@60, 233 ms)** ~~f8–f14 (7 f)~~ | — |
| Whiff recovery | **42 f@60**, no i-frames ~~21 f~~ | **36 f@60** ~~18 f~~ | **52 f@60** ~~26 f~~ | — |
| Stamina | 22 | 22 | 26 | — |

**Sanity check against upstream** (`corpus/10-combat/data/souls-frame-data.json`): the corpus's
recalled Souls parry window of 8–12 t@30 is **267–400 ms**. Our rebased windows are
**233–400 ms**. Before the rebase they were 117–200 ms — half. The rebase lands us on the
upstream figure.

A parried target enters `PARRIED` for **56 f@60** ~~28 frames~~, is fully vulnerable, and is
riposte-able for frames **7–52** ~~4–26~~ of that state. Unparryable attacks are declared
per-move in the statblock and must be a minority of any enemy's moveset.

**Riposte**

| Property | Value |
|---|---|
| Available on target state | `PARRIED` **f7–f52** ~~f4–f26~~, or `GUARD_BREAK` **f6–f34, UNCHANGED** (RI-CMB03 §D — see the warning below) |
| Animation length | **156 f@60 (2600 ms)** ~~78 frames~~ |
| Attacker invulnerable | frames **19–136** ~~10–68~~ |
| Damage applied on | frame **80** ~~40~~ |
| Stamina | 28 |
| Damage | backstab damage × **1.50** |

> **⚠ SEAM LEFT OPEN BY S22 — AMENDED wave 0 (rebase-s22), flagged not fixed.** `GUARD_BREAK`
> is owned by `RI-CMB03` §D, and **S22 scopes `RI-CMB03` out of the rebase entirely** ("do not
> double the 42-frame regen pause"). But `RI-CMB03`'s guard-break *duration* (40 f) and its
> riposte window (f6–f34) are **animation lengths**, not seconds-derived figures — they are not
> the protected 42 f, and the ruling does not address them. Leaving them produces a real
> inversion: after the rebase a **medium stagger is 44 f@60 and a guard break is 40 f@60**, so
> having your guard shattered now punishes you *less* than being poked out of your poise, which
> reverses the whole point of §B and of `RI-CMB03` §D's "zero on a block is catastrophic".
>
> This sweep **did not act on it**, because overriding an explicit exclusion in a seam ruling is
> the doctrine owner's call and not a unit correction. It is filed in `REBASE-S22-REPORT.md` §7
> as the single thing the ruling did not anticipate, with the recommendation that `RI-CMB03`
> §D's 40 f and f6–f34 be rebased to **80 f@60** and **f11–f68** by a doctrine amendment.

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
- **FAIL** if regeneration begins before frame 90 or after frame 91. *(90 f@60; not rebased — see §A.)*
- **FAIL** if the rate differs from 20/s by more than 2%.
- Land a hit at frame 60 of the delay: **FAIL** unless the delay re-arms to a full 90.

**M3 — Stagger length census.** For each tier in §B, land a breaking hit of that tier.
- **FAIL** if the stagger frame count differs from §B (rebased: 32/44/64/96 f@60) by ≥1.
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
- **FAIL** if the attacker takes damage from a third party during frames **15–108**, or fails to
  take damage during frames **1–14 or 109–124**. *(AMENDED wave 0 (rebase-s22).)*
- **FAIL** if damage lands on any frame other than **60**. *(AMENDED wave 0 (rebase-s22).)*

**M6 — Parry window probe.** For each shield type, for each offset `k` between the parry
press and the incoming hitbox activation, `k ∈ [−20, +30]`:
- Build `P[k] ∈ {parried, hit}`. The `parried` run must exactly equal §D's active window.
- **FAIL** on any leak or hole; **FAIL** if the whiff recovery grants i-frames.

**M7 — Riposte gating.** Attempt a riposte on each frame of `PARRIED` and of `GUARD_BREAK`.
- **FAIL** unless the success windows are exactly f4–f26 and f6–f34 respectively.

**M8 — No dice.** Run M1, M5 and M6 with 100 distinct seeds.
- **FAIL** on any variance in any outcome. There is no crit chance, no stagger chance, no
  parry-success roll.

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R4)*

`ARBITRATION` §3's CONSUMPTION check landed in wave 1 and reached the combat **critics** through
the doctrine while reaching **none of the items in `corpus/10-combat/`**. The consequence was
visible immediately: `W1-09` round 3 enumerated six models by its own choice, found two with
`coupling == 0`, and recorded the result as `partial` — a disposition `RI-MTH07` does not have,
because its threshold is binary. Which models must be enumerated, and what a zero costs, are
properties of the item, not of the critic's diligence. So, for this item:

1. **Enumerate exhaustively** every model this item requires to act — every table, curve, window
   and constant it publishes that the running game must read — and list it in the verdict. A
   sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else held
   fixed, an **entity-side** observable (a state transition, an hp change, a position, a denied
   input), plus the null control. `"the trace carries it"` is not a consumer; a trace is an
   observer.
3. **Apply the consequence.** Any `coupling == 0` scores **that dimension 0**, fail-closed, and
   appears in the piece's `status_reasons`. There is no `partial`.
4. **Report the coupling table in the verdict**, as data, not in prose.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 pool arithmetic | 20 | All §E rows, pool not threshold |
| M2 poise regeneration | 10 | 90 f@60 delay, 20/s, re-arms (neither rebased) |
| M3 stagger census | 15 | Exact lengths, no restart, no input, resets |
| M4 hyperarmour probe | 20 | Windows exact, damage unaffected |
| M5 backstab geometry | 15 | Sector exact, invuln frames exact (f15–f108 @60) |
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

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

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

> **AMENDED wave 0 (corpus-audit) — orchestrator ruling **R3**. THE ATTRIBUTION IS WRONG; THE
> MODEL IS NOT.** This item implements an **always-on depleting poise pool** (Dark Souls 1 /
> Elden Ring) fused with **hyperarmour granted only on declared heavy-attack frames** (Dark
> Souls 3), and attributes the whole thing to DS3. DS3 does not have an always-on poise pool.
> **The fused model is not fictional: Elden Ring ships exactly that combination.** So this is a
> **citation fix, not a redesign** — do not change the model. Cite Elden Ring for the
> always-on-pool half and DS3 for the declared-frames-hyperarmour half, and say that the fusion
> is Elden Ring's. Sources to add:
> [Poise — Elden Ring Wiki (Fextralife)](https://eldenring.wiki.fextralife.com/Poise).
> Source: `PROVENANCE-UPGRADE-02-SOULS.md` §4; recorded in `CORPUS-COHERENCE-01.md` §9c.
>
> ~~**Also outstanding under seam S22 (rebase):** the parry windows and critical animation
> lengths below are upstream-recalled *tick* counts adopted as 60 Hz frames and must be doubled.
> Not applied by the audit — see `CORPUS-COHERENCE-01.md` §12.~~
>
> **CLOSED — AMENDED wave 0 (rebase-s22).** Applied. §B's stagger tiers, §C's hyperarmour
> windows, and §D's backstab, parry, `PARRIED` and riposte figures are all rebased above; §A's
> poise pool, thresholds, rate and 90 f (1.500 s) delay are deliberately **not** rebased, for
> the reasons stated inline. The one figure this item consumes and could not rebase is
> `RI-CMB03` §D's `GUARD_BREAK`, which S22 scopes out — flagged in §D.

- **`community-data`, confidence low–medium** (**attribution amended — see above; the pool half
  is Elden Ring, not DS3**)**:** the existence and rough shape of the model — that poise health
  is a pool, that a hit's poise damage is scaled by the
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
