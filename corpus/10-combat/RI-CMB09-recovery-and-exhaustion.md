---
id: RI-CMB09
title: The two self-inflicted punish windows — post-roll recovery, roll-spam, and the exhausted state
kind: number
side: souls
judges: [combat.dodge.recovery, combat.stamina.exhaustion]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Every punish window in a Souls game is one of two kinds: one the *enemy* opens (`RI-AI03` owns
those), and one **you open for yourself**. This item owns the second kind, and there are exactly two
of them: the **tail of your own roll**, and **being at zero stamina**. They are the same subject
because they are the same lesson taught twice — *you are punished for what you spent, on a schedule
you set* — and because a build can get every i-frame count in `RI-CMB01` exactly right and still
have neither of them.

"Good" means: a roll ends, and for the third of a second afterwards you are a statue that cannot
block, cannot roll, cannot attack, and can only turn. It means that a player who mashes dodge
against a boss **gets hit**, not because a designer added an anti-spam rule but because the
arithmetic of 22 stamina every 0.867 s against a 42-frame regen delay leaves them empty in 4.3
seconds and vulnerable half the time until then. And it means that arriving at zero stamina is a
**visible, animated, readable state** with a name, which the enemy can see, which lasts a measurable
1.5 seconds at minimum, and which is the single most dangerous place a player can be — without the
game ever taking control away from them.

`RI-CMB03` ruled that reaching zero stamina does **not** stagger you, and that is correct and
unchanged. But "nothing happens except your inputs are dropped" is not a punish window, it is an
absence. The exhausted state is what makes zero stamina *cost* something: half poise, no jog, no
sprint, a broadcast tell, and a roster that partly reads it.

> **THIS ITEM IS WRITTEN POST-S22 AND EVERY FRAME COUNT BELOW IS AT 60 Hz.** Seam **S22** rules
> that upstream Souls frame counts are 1/30 s ticks and that **all combat durations rebase to 60 Hz
> by doubling**. `RI-CMB01` §B has since been amended (wave 0, `rebase-s22`) and now carries the
> rebased ladder; §1 below **agrees with it exactly** and prints the pre-rebase figures alongside so
> the diff stays visible. Two figures are deliberately **excluded** from the rebase by their owners
> and this item honours both: the **input buffer stays at 8 f@60 (133 ms)** because it is a
> wall-clock allowance for human input error rather than an animation length (`RI-CMB01` C6), and
> `RI-CMB02` §E's 6 f@60 startup floor for the same reason. Stamina costs, distances and load
> percentages are not durations and are not rebased.

## The reference artifact

### 1. Recovery, rebased — `ES-ROLL/1` at 60 Hz

`RI-CMB01` owns the roll. This table restates its ladder **with S22 applied**, and adds the
sub-structure of the recovery tail, which nothing owned.

| Tier | Startup | **i-frames** | **Recovery** | Total | ms @60 Hz | Stamina | Invulnerable fraction |
|---|---|---|---|---|---:|---:|---:|
| `LIGHT` | f1–f4 (4) | f5–f30 (**26**) | f31–f52 (**22**) | **52 f** | **867** | 22 | 0.500 |
| `MEDIUM` | f1–f4 (4) | f5–f26 (**22**) | f27–f60 (**34**) | **60 f** | **1000** | 26 | 0.367 |
| `HEAVY` (fat) | f1–f6 (6) | f7–f16 (**10**) | f17–f88 (**72**) | **88 f** | **1467** | 34 | 0.114 |
| `OVERLOADED` | — | **0** | — | **120 f** stumble | 2000 | 40 | 0.000 |
| Backstep `LIGHT`/`MED` | f1–f4 | f5–f12 (**8**) | f13–f42 (**30**) | **42 f** | 700 | 14 | 0.190 |
| Backstep `HEAVY` | f1–f6 | **0** | f7–f60 | **60 f** | 1000 | 20 | 0.000 |

*(Pre-S22, as printed in `RI-CMB01` §B: 2/13/11/26, 2/11/17/30, 3/5/36/44, 60. Every value above is
exactly twice its predecessor. Stamina costs, distances and the equip-load boundaries are **not**
durations and are **not** rebased — 22/26/34/40 and 30%/70%/100% stand unchanged.)*

### 2. The structure of the recovery tail

Recovery is not one undifferentiated block. It has three sub-phases, and the difference between a
Souls roll and a dash is entirely in the middle one.

| Sub-phase | `LIGHT` frames | Length | What is legal |
|---|---|---|---|
| **`HARD`** | f31–f42 | first **55%** of recovery | **nothing.** No input has any effect. Yaw is locked to the roll direction. The hurtbox is fully active |
| **`TURN`** | f43–f52 | last **45%** of recovery | yaw may change at **240 °/s**. No translation, no action. This is how you finish a roll facing the thing that is about to hit you |
| **`BUFFER`** | last **8 f** of the animation (f45–f52) | last 36% of recovery | one action may be latched and fires on the first actionable frame. Overlaps `TURN` |

- **The input buffer is 8 f@60 (133 ms)** — `RI-CMB01` C6, and it is **explicitly excluded from the
  S22 rebase**: it is a wall-clock allowance for a player pressing a few tens of milliseconds early,
  and that human error did not double when our animations did. Its *relative* generosity therefore
  halves — 8 frames against a 52-frame roll rather than a 26-frame one — which is a real design
  consequence a later wave may revisit with hands on a controller. Exactly one action buffers; a
  later press overwrites it; a press before the buffer window is **dropped, not queued**.
- **`HARD` is where you get hit, and it must be more than half the tail.** A recovery that is 90%
  buffer window is a cancel with extra steps.
- **Recovery is measured to the first `ACTIONABLE` frame, not to the end of the animation clip.**
  If the clip is 60 frames but the character is actionable at 52, recovery is 22, and the artist
  must shorten the clip or the animator's number is a lie.
- **The hurtbox during recovery is the standing hurtbox**, restored on the first recovery frame —
  not the low, small rolling hurtbox held to the end of the clip. This is the most common way a
  recovery tail is accidentally deleted (`RI-CMB04` owns the volumes).

### 3. Roll-spam, and why we do not add an anti-spam rule

**There is no escalating penalty for consecutive rolls, and adding one is a defect.** Souls does not
have one; it does not need one; the arithmetic already punishes it. This section is the arithmetic,
and it is a set of *predictions a critic checks against a trace*, not a set of new knobs.

Exemplar build: `RI-CMB07`'s — Endurance 20, **120 stamina**, `LIGHT` tier, base regen **45/s
(0.75/frame)**, regen delay **42 f**, re-armed by every spend (`RI-CMB03` §A).

| Quantity | Derivation | Value |
|---|---|---:|
| Roll cadence, chained back to back | 52 f | **0.867 s** |
| Rolls per second | 60/52 | **1.15** |
| Regen recovered between chained rolls | 52 f elapsed < 42 f delay re-armed every 52 f → delay never expires | **0** |
| Rolls before the bar denies you | ⌊120 / 22⌋ | **5** |
| Time from full bar to input denial | 5 × 52 f | **260 f = 4.33 s** |
| Stamina at denial | 120 − 110 | **10** |
| Vulnerable fraction while chaining | 26 of 52 | **50%** |
| Longest continuous vulnerable run | recovery 22 + next startup 4 | **26 f = 433 ms** |
| Time from denial to the next legal roll | 42 f delay + 12/0.75 | **58 f = 0.97 s** |

Two consequences, and both are measurable bars:

- **`RP1` — the roll-spammer gets hit.** Against `RI-AI04`'s delayed attack strings, a scripted
  agent that rolls on cooldown for 60 s must be hit on **≥ 35%** of the enemy attack attempts. Below
  that, the 22-frame recovery tail is not real and the roll is a dash.
- **`RP2` — the roll-spammer runs out.** In the same 60 s, **≥ 4** dodge inputs must be dropped for
  insufficient stamina, and the trace must contain **≥ 1** `EXHAUSTED` entry. A roll-spam run that
  never empties the bar means the cost is wrong, not that the player is good.

Both are the same rule stated twice: **the punishment for spamming is the game's existing economy
working, and if it is not working, the economy is decorative.**

### 4. `ES-EXHAUST/1` — the exhausted state

Entered when stamina reaches **0.0** by any spend. `RI-CMB03`'s floor of 0.0 stands; stamina never
goes negative and no debt is created.

| Property | Value | Note |
|---|---|---|
| **Entry** | `stamina == 0.0` on any frame | Not a threshold — exactly zero. You have to actually spend it all |
| **Exit** | `stamina ≥ 30% of max` (36 at the exemplar 120) | Hysteresis, so the state does not flicker at 1 stamina |
| **Minimum duration** | 42 f delay + 36/0.75 = **90 f (1.500 s)** | With no further spend. **This is the punish window, and 1.5 s is its length** |
| **Locomotion** | **walk only.** Jog and sprint denied | Walking is free at any stamina (`RI-CMB03` §B) and stays free |
| **Poise** | **×0.50** | The punish. You are not staggered *by* exhaustion; you are far easier to stagger *while* exhausted |
| **Attack / roll / parry / raise guard** | denied (input dropped, `RI-CMB03`) | unchanged |
| **Guard already raised** | may stay up, drains nothing, **and any impact guard-breaks** (`stamina_before − cost ≤ 0`, `RI-CMB03` §D) | The turtle punish. Hiding behind a shield at 0 stamina is the worst decision in the game |
| **Healing** | **allowed** (Estus costs 0 stamina, `RI-CMB08`) | Deliberate: exhaustion must not be a death sentence, it must be a bad situation with one expensive way out |
| **Animation** | additive breathing layer, weapon point drops, shoulders drop | **Must be identifiable at 12 m in a 1280×720 frame** |
| **Audio** | a distinct breathing bed | unmeasurable via harness (`HARNESS.md` §3); flagged, not scored |
| **Trace** | `player.state == "EXHAUSTED"`, plus `exhausted_enter` / `exhausted_exit` events | requested amendment, §6 |

**Symmetry — and this is the half that never gets built.** Enemies have stamina and enemies get
exhausted.

| Rule | Value |
|---|---|
| Archetypes with a stamina pool | **every humanoid** archetype in `RI-AI05`'s roster |
| Beasts | no stamina bar; instead a `WINDED` state after **≥ 3** attacks in 6 s, with the same tell and the same ×0.50 poise, for **75 f** |
| Enemy exhaustion tell | the same breathing layer, weapon lowered, guard down; readable at 12 m |
| Enemy exhaustion is a **player punish window** | mandatory: at least **50%** of humanoid archetypes must be reachable from neutral spacing during their exhaustion window |
| Player exhaustion is an **enemy** read | `reads_exhaustion: true` on **≤ 40%** of the roster; those shift to `AGGRESSIVE` after the player has been `EXHAUSTED` for **30 f** |

The 40% ceiling is deliberate. If every enemy punishes exhaustion, exhaustion is a death sentence and
the player stops spending, which produces the passive, spacing-only combat this whole corpus is
trying to avoid. If no enemy punishes it, exhaustion is a UI colour.

### 5. What this item does *not* do

- It does not change an i-frame count, a stamina cost, a pool size or the regen delay. Those are
  `RI-CMB01` and `RI-CMB03`, and the only thing done to them here is applying S22's ×2 to durations.
- It does not add stamina debt, negative stamina, or a stumble-on-empty animation. DS3 permits
  negative stamina to −60; `RI-CMB03` ruled a hard floor of 0.0 and that ruling stands.
- It does not make exhaustion stagger you. `RI-CMB03` §D is explicit: **zero is fine, zero *on a
  block* is catastrophic**, and that distinction is the whole tension of shield play.

### 6. Data and harness

`game/data/combat/stamina.json` gains an `exhaustion` block (entry, exit, poise multiplier,
locomotion set, minimum duration) and every entry in `game/data/combat/movesets/*.json` gains
`recovery_hard_f`, `recovery_turn_f` and `buffer_f` alongside its existing `recovery`. Every
statblock in `game/data/combat/enemies/*.json` gains `stamina_max`, `reads_exhaustion` and, for
beasts, `winded_after` / `winded_frames`. Absent fields are **fail-closed 0**.

Requested `HARNESS.md` §10 amendments: `EXHAUSTED` and `WINDED` added to the state vocabulary;
`exhausted_enter`, `exhausted_exit`, `winded`, `input_dropped_no_stamina` added to the §5 event
vocabulary; `enemies[].stamina` / `stamina_max` added to the frame record (the schema already carries
them for the player). Without these, **M4–M8 are unmeasurable ⇒ 0**, fail-closed.

## Comparison method

Harness per `HARNESS.md` §9; all runs seeded, fixed 60 Hz, `body_sha256`-reproducible.

**M1 — Recovery census (the rebase check).** For each of the 4 tiers × {8 roll directions,
backstep}, with the enemy disabled: inject a dodge, and from the trace extract press frame, first
i-frame, last i-frame, and first `ACTIONABLE` frame.
- **FAIL** if any startup / i-frame / recovery / total differs from §1 by ≥ 1 frame.
- **FAIL** if the numbers match `RI-CMB01`'s *pre-rebase* column instead — that is the S22 defect
  this check exists to catch, and it is a **hard fail**, not a tolerance.
- **FAIL** if `total` varies across the 8 directions by more than 0 frames.

**M2 — Tail sub-structure.** Across the recovery window, on each frame inject (a) every action
input, (b) a 180° stick flick.
- **FAIL** if any action input during `HARD` produces any effect, including a queued one.
- **FAIL** if yaw changes during `HARD`, or if yaw rate during `TURN` differs from 240 °/s by > 5%.
- **FAIL** if `HARD` is less than 55% of recovery.
- **FAIL** if a press at `total − 3` does not execute at `total + 1` exactly, or if a press at
  `total − 20` executes at all (buffer is 8 f, and it is a window, not a queue).

**M3 — The hurtbox restore.** From the trace's `player.hitboxes`/hurtbox record, assert the standing
hurtbox is active from the first recovery frame.
- **FAIL** if the rolling hurtbox persists into recovery — that silently converts the tail into
  extra i-frames without any i-frame flag being set, and it is invisible to M1.

**M4 — Roll-spam arithmetic (`RP1`, `RP2`).** Scenario `cmb-rollspam-infantry`, 60 s, seeded: a
scripted agent presses `roll` on every actionable frame against an `RI-AI04` enemy using delayed
strings.
- Compute hits taken / enemy attack attempts. **FAIL** if `< 0.35`.
- Count `input_dropped_no_stamina` events. **FAIL** if `< 4`.
- Count `exhausted_enter` events. **FAIL** if `0`.
- Recompute §3's table from the trace. **FAIL** if measured cadence, rolls-to-empty, or
  time-to-denial differ from §3 by > 1 frame / > 1 roll.
- **FAIL** if any escalating anti-spam penalty is detectable (i-frames, recovery or cost changing
  with consecutive-roll count) — that is a defect, not a feature.

**M5 — Exhaustion entry, exit, and the 1.5 s window.** Drain the bar to exactly 0 with rolls; then
hold all inputs off.
- **FAIL** if `EXHAUSTED` is not entered on the frame stamina reaches 0.0.
- **FAIL** if exit occurs anywhere other than `stamina ≥ 30%` of max, or if the measured minimum
  duration differs from **90 f** by > 1 frame.
- **FAIL** if stamina goes negative at any point.
- **FAIL** if the state flickers (more than one `exhausted_enter` in the window).

**M6 — Exhaustion effects.** While `EXHAUSTED`: measure walk speed, attempt jog and sprint, measure
poise against a known poise-damage attack, attempt each denied action, drink Estus, and take one
blocked impact with the guard already up.
- **FAIL** if walking is not free and at full speed; if jog or sprint produce displacement; if
  measured poise is not `0.50 ×` the rested value (±0.02); if Estus is denied; or if a blocked
  impact at 0 stamina does **not** guard-break.

**M7 — Legibility.** Capture a 1280×720 frame at 12 m with the character `EXHAUSTED` and one rested,
same pose, same light, HUD off (`setUIVisible(false)`), and present the pair unlabeled to a fresh
judge: *"which of these two characters is out of breath?"*
- **FAIL** if the judge cannot tell, or if the only difference is a HUD element. `blind_pair: yes`.

**M8 — Enemy symmetry.** For every humanoid archetype: drive it to exhaustion with blocks and
attacks; assert the tell, the ×0.50 poise, and that the player can close from neutral spacing inside
the window. For every beast: assert `WINDED` after ≥ 3 attacks in 6 s.
- **FAIL** if no enemy in the roster can be exhausted; if fewer than 50% of humanoids are reachable
  during the window; if more than 40% of the roster has `reads_exhaustion: true`; or if a
  `reads_exhaustion` enemy changes behaviour in under 30 f.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| **M1** recovery census / S22 rebase | **18** | every tier exact at 60 Hz |
| M2 tail sub-structure and buffer | 14 | `HARD` inert, `TURN` yaw-only, buffer 8 f@60 |
| M3 hurtbox restore | 8 | standing hurtbox from the first recovery frame |
| **M4** roll-spam arithmetic | **18** | hit rate ≥ 0.35, ≥ 4 drops, ≥ 1 exhaustion, no anti-spam rule |
| M5 exhaustion entry/exit/window | 14 | entry at 0.0, exit at 30%, 90 f ±1 |
| M6 exhaustion effects | 12 | walk free, poise ×0.50, turtle punish fires |
| M7 legibility | 8 | a fresh judge can tell, without the HUD |
| M8 enemy symmetry | 8 | enemies exhaust; ≤ 40% read it |

- **≥ 88** — the two windows exist and the player can learn them.
- **70–87** — playable, gap named.
- **< 70** — **we lose.**

**Automatic fail regardless of score:**
- Frame counts matching the **pre-S22** column (combat running at double wall-clock speed).
- Any roll-count-dependent penalty (an anti-spam rule where the economy should be doing the work).
- Recovery cancellable by any input other than the 8-frame buffer.
- Negative stamina, stamina debt, or a queued input that fires after the buffer window.
- `EXHAUSTED` with no visible tell — a state the enemy is scripted to read but the player cannot see
  is a hidden variable driving AI, which is `RI-AI02`'s telegraph doctrine violated at one remove.
- Exhaustion implemented as a stagger (contradicts `RI-CMB03` §D and deletes the shield tension).
- Any of it done with `setTimeout`, seconds, or `deltaTime` rather than integer frames (`HARNESS.md`
  R2/D4).

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **The rebase never happens.** `RI-CMB01` still prints 13/11/5/0 and a builder implements it
   verbatim, because the item says "binding as written". The whole fight ships at double speed, every
   internal check passes, every blind pair over frame vectors passes, and it surfaces only when a
   human plays it — which is precisely what S22 was written about. M1 is the only instrument in the
   corpus currently aimed at it.
2. **Recovery is a number nobody implements.** The animation ends and the character is actionable,
   because "actionable when the clip finishes" is one line of code and a real recovery tail is
   several. The tell is that `total` equals `startup + iframes` plus rounding.
3. **The rolling hurtbox stays small through recovery.** Undetectable by M1, invisible in the trace's
   i-frame flag, and it converts a 22-frame vulnerability into a 22-frame near-miss. M3 exists solely
   for this and it is the check most likely to catch a real bug.
4. **Someone adds an anti-roll-spam rule.** Diminishing i-frames on consecutive rolls, or a rising
   stamina cost. It will be added in response to a playtester who spammed and won, and it is the
   wrong fix: the right fix is that the enemy's attack was not delayed enough (`RI-AI04`).
5. **The buffer becomes a queue.** Every press during the animation is stored and flushed, producing
   roll→roll→roll from one mash, a player who is never actionable and never punished, and an economy
   that never denies anything.
6. **Zero stamina is a HUD colour.** The bar goes red, the input drops, and nothing else happens.
   This is the current state of the corpus — `RI-CMB03` explicitly says nothing happens — and it is
   the hole this item exists to fill.
7. **Exhaustion is invisible.** The state exists in the simulation, the AI reads it, and the
   character on screen looks identical. The player experiences an enemy that "suddenly gets
   aggressive for no reason", which reads as cheating.
8. **Only the player has stamina.** The most common asymmetry in the genre's imitators. It makes
   every enemy a metronome, deletes half the punish windows in the game, and it is why M8 is worth 8
   points on its own.
9. **Every enemy reads exhaustion.** The opposite failure: the player learns never to spend, plays at
   40% of the bar forever, and the fight becomes a spacing exercise with no commitment.
10. **Estus is denied at zero stamina** because "it should cost something". It converts a bad
    situation into an unrecoverable one, and it contradicts `RI-CMB08`.

## Provenance note

- **`constructed`, confidence high, binding.** The recovery sub-phase structure (§2), the roll-spam
  bars `RP1`/`RP2`, and the whole of `ES-EXHAUST/1` (§4) are ours. They are binding because they are
  exactly measurable.
- **Derived, not invented:** every number in §1 is `RI-CMB01` §B × 2, per **S22**; every number in §3
  is arithmetic over `RI-CMB03` §A/§B (pool 120, regen 45/s, delay 42 f, roll cost 22) and §1's
  rebased cadence. A critic should recompute both rather than trust them. The 90-frame exhaustion
  window is `42 + 36/0.75`, not a chosen number.
- **`community-data`, confidence high**, from `corpus/10-combat/data/souls-frame-data.json` (which
  carries its own source URLs):
  - the 30 fps convention for all community frame counts —
    [ERR Combat Mechanics](https://err.fandom.com/wiki/Combat_Mechanics), corroborated arithmetically
    by DS3's Carthus Bloodring (12 ticks = 0.4 s ⇒ 30 fps). This is S22's evidentiary basis and
    therefore the basis of §1.
  - DS3 base stamina regen **45/s**, unaffected by Endurance; the **0.70 s** post-spend regen delay;
    and that DS3 stamina **can** go negative to −60 with actions gated on `stamina > 0`
    ([Fextralife DS3 Stamina](https://darksouls3.wiki.fextralife.com/Stamina)). **We diverge
    deliberately**: `RI-CMB03` set a hard floor of 0.0 and gates on `stamina ≥ cost`. Recorded here
    so the divergence is visible; not re-litigated.
  - DS1: *"Attacking stops all Stamina recovery until the animation finishes"*
    ([Fextralife DS1 Stamina](https://darksouls.wiki.fextralife.com/Stamina)) — animation-gated
    rather than delay-gated. Ours is delay-gated, following DS3.
- **Unverifiable, correctly declared:** the 55% `HARD` fraction, the 240 °/s `TURN` yaw rate, the
  ×0.50 exhausted poise multiplier, the 30% exit threshold, the 40% `reads_exhaustion` ceiling, the
  50% reachability bar, the beast `WINDED` parameters, and the 0.35 roll-spam hit rate. No external
  analogue exists for any of them. They are binding because they are measurable, not because they
  are true, and the two most likely to move after a human plays the result are the 0.35 and the 40%.
- **The rebase has landed and this item agrees with it.** `RI-CMB01` §B was amended in the same wave
  (`rebase-s22`, reported in `corpus/00-doctrine/REBASE-S22-REPORT.md`) and its ladder — 52/60/88/120
  total, 26/22/10/0 i-frames, backstep 42/60/80 — is **identical to §1 above**, which was derived
  independently by doubling. Two exclusions are honoured rather than re-litigated: the **8 f@60 input
  buffer** (`RI-CMB01` C6) and `RI-CMB02` §E's **6 f@60 startup floor**, both wall-clock allowances
  rather than animation lengths. **One figure remains open and this item does not resolve it:**
  `RI-CMB03` §D's `GUARD_BREAK duration := 40 frames` and `riposte_window := 6..34` are flagged there
  as candidates for doubling to 80 f and 11..68 but not yet fixed. This item cites guard break
  without restating a duration precisely so it is unaffected either way; whoever settles it should
  note that M6's turtle-punish check reads the *event*, not its length.
