---
id: RI-CMB03
title: Stamina economy — costs, regeneration, blocking, and guard break
kind: number
side: souls
judges: [combat.player.stamina, combat.player.block, combat.player.sprint, combat.guardbreak, combat.resource.pacing]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Stamina is the game's clock. Every aggressive or evasive act spends it, it refills on a
delay so that spending is always a bet on the next second and a half, and running out is a
punishment rather than a soft cap. "Good" means: the player can feel the bar in their hands
without looking at it; a three-hit punish on a full bar leaves them unable to dodge the
counter; blocking a heavy attack with a mediocre shield costs a third of the bar; and being
guard-broken is a discrete, animated, exploitable event, not a number reaching zero
quietly. The bar must be spendable to **exactly zero** and the game must still be playable
there — walking, turning, and looking are always free.

Above all: **stamina must gate inputs by dropping them, not by queueing them.** A roll
attempted at 3 stamina does not happen, does not go into debt, and does not fire later. The
player learns the bar by being denied.

> **AMENDED wave 0 (corpus-audit) — orchestrator ruling **R4**: this is a `constructed` rule and
> must not be presented as Souls behaviour.** No Souls game implements it. **DS3 lets stamina go
> negative to −60**, and both DS1 and DS3 gate on `stamina > 0` — you may start an action you
> cannot afford and pay the debt afterwards. Our drop-the-input rule is **ours**, and it is a
> deliberately better fit for a trace-verifiable simulation: a dropped input is a discrete,
> assertable event, and a debt is not.
>
> **Ruling: keep the rule, relabel the claim.** The rule stays exactly as written and stays
> binding. What changes is that this paragraph no longer implies it is "what makes the economy
> feel like Souls" — it is a documented divergence *from* Souls, and this item's own provenance
> note was already correct in calling it constructed. The bar and the provenance note now agree.
> Source: `PROVENANCE-UPGRADE-02-SOULS.md` §3/§11.3.
>
> **Not affected by seam S22 (the 30 Hz rebase):** this item derived its 42-frame regen pause
> from a figure denominated in **seconds** (0.70 s at 60 Hz), which is the one place in the
> corpus the conversion was done correctly. **Do not double it.**
>
> **AMENDED wave 0 (rebase-s22) — NO NUMBER IN THIS ITEM WAS CHANGED, and one is flagged.**
> The S22 rebase sweep touched `RI-CMB01`, `RI-CMB02`, `RI-CMB05`, `RI-CMB08`, `RI-AI02`,
> `RI-AI03`, `RI-WPN01`–`RI-WPN06` and `RI-CAM04`. This item was **deliberately left alone**,
> as S22 and orchestrator ruling R1 both require. The 42 f (0.70 s) pause, the 45/s regen, the
> 0.75/frame slope, every stamina cost and the whole §C block formula stand exactly as written:
> rates per second and quantities of stamina are unit-invariant under a frame-base correction.
>
> **The one figure that is flagged, not fixed: §D's `GUARD_BREAK`.** Its `duration := 40 frames`
> and `riposte_window := frames 6..34` are **animation lengths**, not seconds-derived figures —
> they are not the protected 42 f, and S22's exclusion of this item does not reason about them.
> Because everything around them doubled, a real inversion now exists: a **medium stagger is
> 44 f@60** (`RI-CMB05` §B, rebased) while a **guard break is 40 f@60**, so shattering the
> player's guard punishes them *less* than poking them out of poise — which contradicts this
> item's own §D claim that "zero *on a block* is catastrophic". Overriding an explicit exclusion
> in a seam ruling is the doctrine owner's call, not a unit correction, so this sweep recorded
> it instead of acting on it. **Recommendation, for the doctrine owner: rebase §D to
> `duration := 80 f@60` and `riposte_window := frames 11..68`.** Filed in
> `corpus/00-doctrine/REBASE-S22-REPORT.md` §7.

## The reference artifact

### A. Pools and regeneration (`ES-STAM/1`)

| Quantity | Value | Notes |
|---|---|---|
| Base max stamina (Endurance 10) | **90** | |
| Per point of Endurance, 11–40 | **+3.0** | Linear. Endurance 20 → **120** (the exemplar build in RI-CMB07) |
| Per point of Endurance, 41–99 | **+0.4** | Hard soft-cap; 99 END → 203 |
| Base regeneration | **45.0 / second = 0.75 / frame** | Flat. **Does not scale with any stat.** |
| Regeneration delay after **any** spend | **42 frames (0.700 s)** | Re-armed by every subsequent spend, including block costs |
| Regen multiplier, guard raised | **×0.20** (9.0/s) | Applies from the frame the shield goes up |
| Regen multiplier, equip load > 70% | **×0.80** | Stacks multiplicatively with the guard multiplier |
| Regen multiplier, `OVERLOADED` | **×0.60** | Stacks |
| Regen multiplier, staggered / guard-broken | **×0.00** | No regen during hitstun |
| Floor | **0.0** | Never negative. Costs clamp; they do not create debt |
| Ceiling | max | Overheal is discarded |

The 42-frame delay is the number that makes the economy feel like Souls rather than like a
cooldown. Two attacks 36 frames apart regenerate **nothing** in between; two attacks 90
frames apart regenerate 36 stamina. Everything about spacing follows from this.

### B. Costs

Attack costs are the `Stamina` columns of RI-CMB02 §A/§B and are reproduced here as the
authoritative cross-reference, not re-derived:

| Action | Cost | Charged when |
|---|---|---|
| Light attack (R1) | 12 (dagger) → 42 (UGS) | Full, on the first frame of the animation |
| Heavy attack (R2) | 20 (dagger) → 62 (UGS) | Full, on the first frame |
| Two-handed | attack cost ×1.15 | |
| Roll, `LIGHT` / `MEDIUM` / `HEAVY` / `OVERLOADED` | **22 / 26 / 34 / 40** | Full, on frame 1 (RI-CMB01) |
| Backstep | 14 / 14 / 20 / 26 | |
| Sprint | **9.0 / second (0.15 / frame)** | Per frame while sprinting; re-arms the regen delay every frame |
| Jump | 18 flat | |
| Jump attack | attack cost ×1.30 | |
| Block, per impact | **`incoming_damage × (1 − stability)`** | On the impact frame only. Holding a shield costs nothing |
| Parry attempt | 22 flat | |
| Backstab / riposte execution | 24 / 28 | |
| Estus drink | **0** | RI-CMB08 — healing costs time, not stamina |
| Walk, run (non-sprint), turn, camera, lock-on toggle, menu | **0** | Always free, at any stamina, including 0 |

### C. Blocking (the formula, spelled out)

A shield has two independent properties. Conflating them is a classic error.

```
stability   ∈ [0.00, 0.95]   fraction of the STAMINA cost negated
absorption  ∈ [0.00, 1.00]   fraction of the DAMAGE negated

on a blocked impact:
    stamina_cost = incoming_damage * (1 - stability)
    chip_damage  = incoming_damage * (1 - absorption)
    poise_damage_taken = 0                        # a successful block never staggers by poise
    stamina      = max(0, stamina - stamina_cost)
    hp           = hp - chip_damage
    guard_broken = (stamina_before - stamina_cost) <= 0
```

Reference shield set:

| Shield | Stability | Absorption | Weight | Cost to block a 128-dmg attack | Chip |
|---|---|---|---|---|---|
| Chitin buckler | 0.42 | 0.86 | 2.0 | 74.2 | 17.9 |
| Marsh-oak medium (the exemplar build) | **0.62** | **0.94** | 5.5 | **48.6** | **7.7** |
| Naga tower shield | 0.78 | 1.00 | 13.0 | 28.2 | 0.0 |

**Worked example from the RI-CMB07 exemplar trace, frame 1016.** The player has 11.1
stamina after an over-greedy four-hit punish. The enemy's `A2` first swing (96 damage)
lands on a raised guard. `stamina_cost = 96 × (1 − 0.62) = 36.48`. `11.1 − 36.48 < 0`, so:
stamina clamps to 0, `chip = 96 × 0.06 = 5.76 → 6`, and `GUARD_BREAK` fires. This single
frame is why the item exists.

### D. Guard break (the rule the brief calls "stamina broken → guard break stagger")

```
IF a blocked impact would take stamina below 0:
    stamina        := 0
    state          := GUARD_BREAK
    duration       := 40 frames
    guard          := forced down (shield input ignored for the duration)
    regen          := suspended for the whole duration, delay re-armed at the end
    riposte_window := frames 6..34 of GUARD_BREAK   (the enemy or player may execute)
    poise          := irrelevant; guard break bypasses poise entirely
```

Symmetry rule: **the identical rule applies to enemies.** An enemy that blocks with a shield
has stamina, spends it on blocks, and can be guard-broken by the player, which opens the
riposte window in RI-CMB05. Guard break is not a player-only punishment.

Reaching 0 stamina **without** blocking does *not* stagger. It simply means every
stamina-consuming input is dropped until the bar recovers. This distinction — zero is fine,
zero *on a block* is catastrophic — is the whole tension of shield play.

### E. Behavioural targets (what a healthy 60-second fight looks like)

These are distribution targets measured over the RI-CMB07 exemplar and are the numbers a
critic diffs against. They are consequences of §A–§D, not independent knobs.

> **AMENDED wave 0 (rebase-s22): the `Exemplar value` column is provisional until RI-CMB07 is
> regenerated.** Seam S22 invalidated the exemplar trace. The **acceptance bands are unaffected
> and remain binding** — every one of them is a *percentage* or a *count*, and both are
> invariant under a time-base rebase — **except `Frames at exactly 0 stamina`, whose band is a
> frame count and must be read as `≥ 20 and ≤ 600 f@60`** once a rebased exemplar exists. The
> single exemplar cell in the same row (44) is likewise unusable until regeneration. Nothing in
> §A–§D changed; see the S22 note at the top of this item.

| Statistic | Exemplar value | Acceptance band |
|---|---|---|
| Stamina minimum over the fight | **0.0** (0.0% of max) | ≤ 15% of max at least once |
| Frames at exactly 0 stamina | **44** | ≥ 10 and ≤ 300 |
| % of frames below 25% of max | **5.10%** | 3% – 20% |
| % of frames above 90% of max | **25.4%** | 12% – 45% |
| Mean stamina | **81.0 / 120 (67.5%)** | 55% – 80% |
| Guard breaks suffered | **1** | ≥ 0; > 3 in 60 s means stability is mis-tuned |
| Inputs dropped for insufficient stamina | ≥ 1 | **> 0 is mandatory** — a fight where the bar never denies you has no economy |

A trace whose stamina never drops below 60% of max has failed regardless of whether every
individual number in §A is correct: it means the costs are too small or the regeneration
delay is not being applied.

## Comparison method

Script: **`corpus/80-methods/m-cmb03-stamina.mjs`**

Harness: headless Node + Three.js, fixed 60 Hz, seeded, scripted inputs, emitting
`es-combat-trace/1` (RI-CMB07) with per-frame `p.stamina` at 0.1 resolution.

**M1 — Regeneration curve.** Player idle at full stamina; spend exactly one roll on a known
frame `f0`; run 400 frames with no further input.
1. Extract `stamina[f]` for `f ∈ [f0, f0+400]`.
2. Find `f_resume` = first frame with `stamina[f] > stamina[f-1]`.
- **FAIL** if `f_resume − f0 ≠ 43` (delay is 42 frames, so regen first *shows* on the 43rd).
- Fit the slope over `[f_resume, f_resume+60]`. **FAIL** if `|slope − 0.75|/frame > 0.01`.
- **FAIL** if the curve is non-linear (an ease-in regen is a cooldown wearing a costume).
- Repeat with the guard raised: **FAIL** if slope ≠ 0.15/frame ±0.005.

**M2 — Delay re-arming.** Spend a roll on `f0`, another on `f0+20`, another on `f0+40`.
- **FAIL** if any regeneration occurs before `f0+40+43`. This is the check that catches a
  per-action cooldown timer implemented instead of a single global re-armed delay.

**M3 — Cost census.** For every row of §B, spend the action from full and read the drop.
- **FAIL** on any deviation > 0.05.
- **FAIL** if the deduction is spread across frames rather than applied on frame 1.
- **FAIL** if any cost is applied twice (a common double-subscribe bug).

**M4 — Block formula.** For each reference shield × each of {55, 96, 128, 145, 235} damage:
1. Script the enemy to land exactly one hit on a raised guard at full stamina.
2. Read `stamina_cost` and `chip` from the trace's `BLOCK` event and from the deltas.
- **FAIL** if `|cost − dmg×(1−stability)| > 0.05` for any cell.
- **FAIL** if `|chip − dmg×(1−absorption)| > 0.5` for any cell.
- **FAIL** if stability affects chip or absorption affects stamina (the conflation error).
- **FAIL** if any poise damage is applied on a successful, non-breaking block.

**M5 — Guard break.** Set stamina to `dmg×(1−stability) − 1` and block.
- **FAIL** unless: stamina clamps to 0 (never negative); state becomes `GUARD_BREAK` on the
  impact frame; duration is exactly 40 frames; regen is 0 throughout; the shield input is
  ignored throughout; and a riposte executed on frames 6–34 connects while one on frames
  1–5 or 35–40 does not.
- Repeat with `stamina = dmg×(1−stability) + 1`: **FAIL** if a guard break occurs.
- Repeat against a shielded *enemy*: **FAIL** if enemies are exempt from §D.

**M6 — Zero-stamina input gate.** Drain to 0, then inject roll, R1, R2, sprint, jump, parry.
- **FAIL** if any executes.
- **FAIL** if any executes *later* (i.e. was queued rather than dropped).
- **FAIL** if walking, turning, camera, lock-on, or menu input is blocked.

**M6b — M-STAM, the margin gate. *(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R2.)*** M6 tests
stamina **exactly zero**. The interesting case — and the one the whole economy turns on — is
`0 < stamina < cost`, and nothing in the corpus tested it. This is where `RI-CMB07`'s row-28
invariant now lives, because it is an **engine** property and row 28 was measuring a **bot**:
in `W1-09` round 3 a pilot with a `staminaFloor` that declined to over-commit produced row
28 = 0 on a build whose denial worked, and the item's automatic fail capped it at 2.

For every action in §B, and for each of `cost − 1`, `cost − 0.1`, `cost`, `cost + 0.1`:
- Set stamina to the value, inject the action on a known frame, read the trace.
- **FAIL** unless the two sub-cost values emit `INPUT_DROPPED` with `reason: "no_stamina"` and
  no state change, and the two at-or-above values execute and deduct in full on `first_frame`.
- **FAIL** if the drop is queued, partially executed, or clamps the spend (`RI-CMB02` §D.6:
  *"Not queued, not partially executed"*).
- **FAIL** if the boundary is not exactly `cost` — an off-by-epsilon here is how a build ships an
  economy that never bites.
- Run the mirror case for **enemies**. The rule is symmetric or the economy is a player tax.

**M7 — Distribution diff (the headline).** Run the RI-CMB07 exemplar input script against
our build; compute the §E statistics from our trace; diff against the exemplar column.
- Score each row inside/outside its acceptance band.
- **FAIL** if `inputs dropped for insufficient stamina == 0`.

> **M7 is `corpus_debt` while `RI-CMB07`'s exemplar carries `INVALIDATED`. *(ADDED wave 1,
> BAR-CRITIQUE-W1-09-R1 §R2.)*** M7 replays *"the RI-CMB07 exemplar input script"* and compares
> against *"the exemplar column"*. Both have been invalidated since wave 0 and neither has been
> regenerated, so M7's 10 points have been unearnable for the whole of wave 1 for a reason no
> builder can address. Handle it exactly as `RI-CMB07` §0.1 handles M1: **remove M7's weight from
> both numerator and denominator, report raw and runnable on the same line, record the debt
> against the corpus and not against the build, and restore it the moment the exemplar returns.**
> Its `inputs dropped == 0` clause is preserved and strengthened meanwhile by M6b, which does not
> depend on any fixture.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 regeneration curve | 13 | Delay exactly 42 f, slope exact, linear |
| M2 delay re-arming | 9 | Single global re-armed delay |
| M3 cost census | 13 | All §B costs exact, applied once, on frame 1 |
| M4 block formula | 18 | Both formulas exact and independent |
| M5 guard break | 18 | All seven sub-conditions, symmetric for enemies |
| M6 zero-stamina gate | 9 | Drops, never queues; free actions stay free |
| **M6b M-STAM margin gate** | **10** | Boundary exactly at `cost`, both directions, both sides |
| M7 distribution diff | 10 — **`corpus_debt` while the `RI-CMB07` exemplar is INVALIDATED** | ≥ 5 of 7 rows inside band |

> **Weights re-cut wave 1 (BAR-CRITIQUE-W1-09-R1 §R2) to make room for M6b, which is new work.**
> ~~M1 15, M2 10, M3 15, M4 20, M5 20, M6 10~~ → 13 / 9 / 13 / 18 / 18 / 9, total 100 with M6b at
> 10. **No band moved and no pass condition weakened**; the 10 points come out of the existing
> checks proportionally, so a build that passed everything before has 10 points of new work.

- **≥ 90** — parity.
- **70–89** — gap named, remediable.
- **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - stamina that regenerates without a delay, or with a per-action cooldown instead of a
    single re-armed global delay;
  - stamina regeneration that scales with a stat (it is flat, by decree);
  - negative stamina, or actions that "borrow" and pay back;
  - a stamina bar that gates by greying out a button rather than by dropping the input;
  - Morrowind Fatigue semantics leaking inside the fight — Fatigue is a *separate*
    out-of-fight bar affecting disposition and persuasion (ARBITRATION S4), and must not
    modify any combat action's cost, success, or damage;
  - blocking that reduces damage as a function of stability, or costs stamina as a function
    of absorption.

**Blind pair:** two stamina-vs-frame plots for the same 60-second input script, unlabelled.
Ask the critic which one belongs to a game where spacing matters. Record the blind pick.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **Regen with no delay.** The single most likely error: `stamina += rate * dt` every frame
   unconditionally. The bar becomes a soft suggestion, three-hit punishes are free, and the
   entire spacing game evaporates. M1 catches it in one run.
2. **Per-action cooldowns.** "Roll has a 0.7 s stamina cooldown, attack has its own." Feels
   identical in a one-action test and completely wrong in a fight, because the whole point
   is that mixing actions compounds the delay. M2 exists only for this.
3. **`dt`-scaled regeneration in a variable-rate loop.** 45/s becomes 45/s *on average*,
   which means the exact frame you can afford the next roll is non-deterministic and the
   trace diff becomes noise.
4. **Block as a damage-reduction percentage.** The intuitive implementation —
   `damage *= (1 - blockAmount)` with no stamina involvement — turns the shield into passive
   armour and deletes guard break entirely. M4's independence check is aimed at this.
5. **Guard break as "you take the hit".** Implementing stamina exhaustion as simply letting
   the damage through, with no 40-frame animation, no riposte window, no forced guard drop.
   The player never learns what happened.
6. **Queued inputs at zero stamina.** A generic input buffer that stores the roll press and
   fires it 30 frames later when the bar allows. The player rolls into the attack they were
   trying to avoid, and blames the game correctly.
7. **Stamina spent over the animation** rather than on frame 1, so a cancelled or interrupted
   action refunds part of the cost — which then makes trading profitable.
8. **Endurance scaling the regen rate**, because it is the obvious stat design. It makes high
   END builds spam-immune and collapses the economy at the top of the curve. §A pins regen
   as flat.
9. **Two bars fused.** Someone will notice Morrowind's Fatigue and our stamina are both
   "yellow bar that goes down" and merge them. ARBITRATION S4 says two bars, clean
   separation. A merged bar means persuasion drains from combat and vice versa, which fails
   both AR-1 and AR-2 simultaneously.
10. **No dropped inputs anywhere in our trace.** If our 60-second run never once has the bar
    say no, the numbers may all be right and the economy still isn't real. §E's last row is
    the tripwire and it is intentionally the harshest one here.

## Provenance note

Mixed, and separated below.

- **`community-data`, confidence medium:** the shape of §A is grounded in reported Dark
  Souls 1 behaviour — a flat **45 stamina/second** regeneration that does not scale with
  stats, a regeneration pause of roughly **0.7 s** after a spend, and regeneration reduced
  by roughly **80%** while the guard is raised. Sources:
  [Stamina — Dark Souls Wiki (wikidot)](http://darksouls.wikidot.com/stamina),
  [Stamina — Dark Souls Wiki (Fextralife)](https://darksouls.wiki.fextralife.com/Stamina),
  [Stamina — Dark Souls 3 Wiki (Fextralife)](https://darksouls3.wiki.fextralife.com/Stamina).
  Community figures for these values are contested and version-dependent. We adopted 45/s,
  0.70 s and ×0.20 as our own numbers *because* they match the reported behaviour, not
  because we verified them.
- **`canonical-recall`, confidence medium:** the qualitative rules — that blocking costs
  stamina proportional to the blow and to shield stability, that exceeding available stamina
  on a block produces a distinct guard-break stagger leaving the defender open to a critical,
  and that zero stamina denies actions rather than damaging you.
- **`constructed`, confidence high — and binding:** the pool sizes and Endurance curve, every
  cost in §B, the exact 42-frame delay, the `stability`/`absorption` split and both formulas,
  the three reference shields, the 40-frame guard-break duration and its 6–34 riposte window,
  the enemy-symmetry rule, and all of §E's distribution targets. The §E figures are computed
  from the RI-CMB07 exemplar trace and are exact for that artifact; changing any cost in §B
  invalidates them and requires regenerating the exemplar.
