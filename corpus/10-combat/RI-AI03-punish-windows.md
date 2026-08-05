---
id: RI-AI03
title: Punish windows — the recovery contract and the punish window ratio
kind: number
side: souls
judges: [combat.enemy.punish, combat.attack.commitment, combat.frames.timing, combat.poise.enemy]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Every enemy attack must **cost the enemy something**. When a swing ends, there is a stretch
of frames in which the enemy is committed to its own recovery and the player, having dodged
correctly, can walk in and hit it for free. That stretch is the game's entire reward loop:
it is why defence is offence, why patience is a build, and why "learning the fight" is a
real activity rather than a euphemism for grinding. The size of the window scales inversely
with the enemy's threat: a trash mob leaves a lavish window, a boss leaves a narrow one, and
a boss's most dangerous move leaves the widest one of its set — because a devastating attack
must be worth the risk of standing there to bait it.

The failure state is not "the window is short". The failure state is "there is no window",
which happens the instant an enemy can cancel its recovery, turn during it, or chain
indefinitely. An enemy with no punish window is not difficult; it is unplayable, and the
player's only counterplay is to out-range it, which deletes the fight.

## The reference artifact

### A. Definitions (60 fps)

- **`Rc`** = recovery frames: from the last `hit_active` frame to the first frame on which
  the enemy could legally enter any new action (`state` may leave RECOVER).
- **`Pd`** = punish distance: the distance from the enemy's root at which the *player's*
  chosen punish weapon's hitbox reaches the enemy's hurtbox at its own active frame.
- **`Ps` (player punish startup)** = frames from the player's attack input to the first
  frame of that attack's active window. Owned by the frame-data reference item. Reference
  values used here: **light attack (straight sword R1) `Ps` = 13 f**; **heavy `Ps` = 26 f**.
- **`t_reach`** = frames the player needs to travel from their post-dodge position to `Pd`.
  Measured, not assumed; for the standard test the scripted player is already at `Pd`, so
  `t_reach = 0` for the canonical measurement and is reported separately for the
  realistic-position variant.
- **`W_next`** = the windup frames of the enemy's next action after recovery ends.

**Safe punish frames**

```
P_safe = | { k ∈ [0, Rc) : the player, inputting a light attack on recovery-frame k,
             lands its active frame before the enemy's next attack reaches its own
             first active frame, AND is not inside that attack's hitbox at that time } |
```

Concretely, for a player already at `Pd`:
`P_safe = max(0, Rc − Ps − t_reach + W_next − safety_margin)` clamped to `[0, Rc]`,
with `safety_margin = 3 f`. The trace-driven method in `## Comparison method` measures
`P_safe` empirically rather than trusting this closed form; the formula exists so a
designer can author to it.

**Punish window ratio (the headline measurable)**

```
PWR = P_safe / (W + A + Rc)
```

i.e. the fraction of the entire attack's frame cost that the player gets back as free
damage. PWR is dimensionless and comparable across enemies of wildly different speeds,
which is exactly why it is the number this item is built around.

### B. Required punish windows by enemy class

| Class | Example archetypes (RI-AI05) | Min `P_safe` (frames) | Min PWR | Target PWR band | Max PWR (too generous) |
|---|---|---|---|---|---|
| Trash — light | SWARM, RANGED | 20 | 0.28 | 0.30–0.42 | 0.55 |
| Trash — standard | INFANTRY, DUELIST | 22 | 0.26 | 0.28–0.38 | 0.50 |
| Trash — heavy | TURTLE, POISE_MONSTER | 26 | 0.24 | 0.26–0.36 | 0.48 |
| Ambusher | AMBUSHER | 24 | 0.28 | 0.30–0.40 | 0.52 |
| Caster | CASTER | 30 | 0.30 | 0.32–0.45 | 0.60 |
| Elite / mini-boss | ELITE | 18 | 0.20 | 0.22–0.30 | 0.40 |
| Boss, phase 1 | BOSS | 16 | 0.16 | 0.18–0.28 | 0.36 |
| Boss, phase 2+ | BOSS | 15 | 0.14 | 0.16–0.24 | 0.32 |

`P_safe` floor of **15 frames** is absolute across the entire game. 15 f = 250 ms, which is
`Ps` (13) + 2 f of slack: it is the minimum window in which a light attack can exist at all.
An attack whose `P_safe < 15` is, by definition, unpunishable, and unpunishable attacks are
banned outside the explicitly-listed exceptions in §D.

### C. Per-move distribution requirement (not just the average)

Averages hide the problem. A boss whose mean PWR is 0.22 but whose eleven of twelve moves
sit at 0.10 with one 1.5-second-recovery move at 0.60 is a boss with one answer. Required
shape of the per-move PWR distribution, per enemy:

| Requirement | Trash | Elite | Boss |
|---|---|---|---|
| Moves meeting class min PWR | 100% | 100% | ≥ 90% (max 1 exception per phase) |
| Moves with `P_safe ≥ 30 f` ("big punish", worth a charged heavy) | ≥ 1 | ≥ 1 | ≥ 3 per phase |
| Moves with `P_safe ≥ 60 f` ("heal window") | 0 required | ≥ 1 | ≥ 1 per boss (not per phase) |
| PWR coefficient of variation across moveset | ≤ 0.55 | ≤ 0.60 | ≤ 0.65 |
| Highest-severity move must be in the top 40% of the enemy's own PWR ranking | required | required | required |

That last row is the **risk/reward inversion check** and it is the one most likely to be
violated: the scariest move must also be the most rewarding to bait.

### D. The exception list — the only legal unpunishable actions

An action may have `P_safe < 15` only if it appears here, is flagged in the statblock, and
is not the enemy's damage backbone.

| Exception | Constraint |
|---|---|
| Recovery cancelled into a **string continuation** | The string as a whole must satisfy §B at its terminal move; per-link windows may be 0. Max chain length per RI-AI04. |
| **Phase-transition** cinematic/invulnerable window | Once per threshold, ≤ 180 f, enemy deals no damage during it. |
| **Backstep / reposition** (a non-attack) | Not an attack; has no `P_safe` requirement, but is rate-limited: ≤ 2 consecutive, ≤ 25% of all actions. |
| **Grab whiff** | May have short recovery, but a *landed* grab must be followed by ≥ 40 f of enemy recovery after the player is released. |
| **Boss "safe" utility move** (buff, summon, roar) | Max 1 per phase; must instead offer `P_safe ≥ 40` (utility moves are punish invitations, not punish denials). |

Everything else — every basic swing, every heavy, every gap-closer, every ranged attack —
is bound by §B with no exceptions.

### E. Worked reference table: `INFANTRY` (spear-and-shield Naga levy)

Uses the telegraph data from RI-AI02 §F. Player punish = straight-sword light, `Ps` = 13,
player positioned at `Pd`, `safety_margin` = 3.

| Move | W | A | Rc | Total | `W_next` (median) | `P_safe` | PWR | Verdict vs 0.26 min |
|---|---|---|---|---|---|---|---|---|
| Thrust | 18 | 3 | 26 | 47 | 18 | 28 | 0.60→clamped to Rc = 26 | 0.55 — **too generous**, tighten Rc to 20 |
| Thrust (tuned) | 18 | 3 | 20 | 41 | 18 | 20 | 0.49 | still high; see note |
| Overhead chop | 26 | 4 | 34 | 64 | 18 | 34 | 0.53 | tighten |
| Shield bash | 14 | 3 | 20 | 37 | 18 | 20 | 0.54 | |
| Step-back thrust | 22 | 3 | 24 | 49 | 18 | 24 | 0.49 | |
| Charge | 30 | 5 | 40 | 75 | 18 | 40 | 0.53 | |

**Note on the clamp — this is the important design lesson in this table.** With
`t_reach = 0` the closed form saturates: the player standing at perfect range punishes
essentially all of recovery, and every PWR lands above the "too generous" ceiling. That is
correct and expected: a stationary, perfectly-positioned player *should* get the whole
recovery. The realistic figure comes from the `t_reach > 0` variant. Re-running with the
player at post-dodge position (roll distance ≈ 4.2 m from a spear enemy, `t_reach` = 22 f
to walk back to `Pd`):

| Move | Rc | `t_reach` | `P_safe` | PWR (realistic) | vs 0.26 min |
|---|---|---|---|---|---|
| Thrust (tuned) | 20 | 22 | 20 | 0.49 | pass |
| Overhead chop | 34 | 22 | 34 | 0.53 | pass |
| Shield bash | 20 | 22 | 18 | 0.49 | pass |
| Step-back thrust | 24 | 30 (enemy moved away) | 9 | 0.18 | **FAIL** — must raise Rc to 32 |
| Charge | 40 | 14 (enemy came to you) | 40 | 0.53 | pass |

Step-back thrust is the canonical trap move: it retreats *and* recovers fast, so it is
unpunishable in practice while looking fine on paper. **The realistic-position variant is
the binding measurement**; the `t_reach = 0` variant is reported for diagnosis only.

## Comparison method

Harness: headless, 60 Hz, seeded, JSONL trace per RI-AI01 §A, plus scripted player input
with frame-exact scheduling and the ability to inject a specific enemy move.

**M1 — Recovery census.** For each enemy and each move, sample ≥ 30 instances. Compute
`Rc` = frames from last `hit_active` to first frame where the enemy's `state` leaves
RECOVER or `phase` returns to `none`.
- Report median, min, stdev of `Rc` per move.
- **FAIL** if any move's median `Rc` < 12 f.
- **FAIL** if `stdev(Rc) > 3 f` for a non-string move (randomised recovery is unlearnable).

**M2 — Empirical `P_safe` (canonical, `t_reach = 0`).**
For move `m` and each candidate recovery frame `k ∈ [0, Rc)`:
1. Reset to a seeded state; teleport the player to `Pd` facing the enemy.
2. Inject move `m`. Schedule a light-attack input on recovery-frame `k`.
3. Run until the player's attack resolves or the player takes damage.
4. Record `hit = (enemy hp decreased)` and `traded = (player hp decreased within
   the next 60 f)`.
`P_safe(m)` = size of the largest contiguous run of `k` where `hit && !traded`.
- 3 repeats per `k` with different PRNG seeds; a `k` counts as safe only if 3/3 succeed.

**M3 — Empirical `P_safe` (realistic, binding).**
Same as M2, but the player is not teleported: the scripted player rolls through the attack
using the optimal roll timing (input on windup frame `W − 8`), then inputs the light attack
on recovery-frame `k` from wherever the roll left them, walking forward at full speed in
between. This measures the window a real player actually gets.
- **Binding `PWR` uses this variant.**

**M4 — PWR computation and gate.**
`PWR(m) = P_safe_realistic(m) / (W + A + Rc)`.
- **PASS** if every move meets its class row in §B, and the §C distribution requirements
  all hold.
- **FAIL** if any non-exception move has `P_safe_realistic < 15`.
- **Headline number: per-enemy median PWR. Fail if below the class minimum in §B.**

**M5 — Risk/reward inversion check.**
Rank the enemy's moves by damage descending and by PWR descending. Compute the rank of the
highest-damage move in the PWR ranking.
- **PASS** if it sits in the top 40% of the PWR ranking.
- **FAIL** if the highest-damage move is in the bottom 40% — the fight punishes bravery.

**M6 — Recovery-cancel detector.** Over all traces, find every frame where a new attack's
`phase == "windup"` begins while the previous attack's recovery had frames remaining
according to the declared statblock, *and* the move pair is not a declared string link.
- **Any occurrence is a hard fail.** This is the "the enemy cancelled out of its whiff"
  bug and it invalidates every PWR figure in the file.

**M7 — Recovery turn-lock.** Assert `yaw_rate_dps == 0` (±2) on every `phase == "recovery"`
frame. (Shares evidence with RI-AI02 M2; report once, count once.)

**M8 — Aggregate free-damage rate.** Run a 5-minute scripted "perfect patient player"
(dodge everything, punish only in measured windows, never attack otherwise) against each
enemy and against each boss phase.
- Compute `dps_free` = damage dealt / elapsed time, and `ttk_patient` = time to kill.
- **PASS** if `ttk_patient` is finite and within 1.6× of `ttk_aggressive` (same script but
  attacking at every opportunity).
- **FAIL** if `ttk_patient` exceeds 4 minutes for any trash enemy or 8 minutes for any
  boss — the punish windows exist but are too small to constitute a strategy, and the
  enemy is a health sponge in disguise.

## Scoring

| Check | Weight |
|---|---|
| M1 recovery census | 2 |
| M3/M4 realistic PWR vs class gates | 5 |
| §C distribution requirements | 3 |
| M5 risk/reward inversion | 3 |
| M6 recovery-cancel | 3 |
| M8 patient-player TTK | 2 |

Each 0/1/2 × weight. Max 36.

| Total | Verdict |
|---|---|
| 32–36 | Meets the bar |
| 24–31 | Below bar — named remedy required |
| ≤ 23 | Loses outright |

**Hard fails regardless of total:**
- Any non-exception move with `P_safe_realistic < 15 f`.
- Any M6 recovery-cancel occurrence.
- Any M7 recovery-turn violation.
- M5 inversion (highest-damage move in the bottom 40% of PWR).
- `ttk_patient` unbounded (patient play cannot kill the enemy at all).

Blind pair: present the critic with two unlabelled per-move PWR tables (ours, and one
generated from §B/§E) with move names stripped to M1..Mn. It picks which enemy it would
rather fight, and which it believes is learnable, before reveal.

## How we lose

1. **No recovery at all.** The attack animation ends and the state machine returns
   immediately to CIRCLE with full agency on the next frame. `Rc` measures 0–4 f, every
   PWR is ~0.05, and the player's reward for a perfect dodge is nothing. This is the
   default outcome of implementing attacks as "play clip, enable hitbox for 100 ms,
   disable, done".
2. **Recovery exists but is cancellable.** The enemy has 30 f of recovery on paper, but the
   AI's `update()` polls "should I attack?" every frame and can start a new windup at any
   time. M6 catches it. On paper the enemy is fair; in play it is a blender.
3. **Recovery that turns.** The enemy whiffs, and while "recovering" it smoothly rotates to
   face the player, so the punish must be landed from a rotating target and the follow-up
   is instantly aimed. The window is nominally there and practically worthless.
4. **The `t_reach` blind spot.** All recovery values authored and validated with the player
   standing still at perfect range. Ships. Every real punish requires closing 4 m after a
   roll, and half the roster's windows evaporate. This is why M3, not M2, is binding.
5. **Retreating attacks.** Backstep-thrust, hop-slash, jump-back-and-shoot: moves that both
   recover fast *and* increase distance. Individually each looks legal; a roster built from
   them is unpunishable. §E's worked example exists specifically to make this visible.
6. **Risk/reward inversion.** The big slow overhead — the one that does 45% of your health
   — gets a fast recovery "so it isn't too punishing to use", while the little jab gets a
   long one. Now the correct play is to never bait the big move. M5.
7. **Distribution collapse.** Mean PWR passes because one move has a 90-frame recovery and
   everything else has 8. The player has exactly one opening in the whole fight and the
   fight is a coin-flip on whether the enemy uses that move. §C's CV cap.
8. **PWR tuned by lengthening `W` instead of `Rc`.** The ratio can be gamed: make the
   windup enormous and PWR's denominator grows, so the fraction... no, it *shrinks*. The
   real gaming direction is to shorten `W`, which raises PWR while making the enemy less
   readable. **PWR must never be read without RI-AI02's windup census alongside it.** A
   critic reporting PWR in isolation has been fooled.
9. **Health-sponge substitution.** Windows are fine, damage output is fine, but the enemy
   has 4× the HP so the same window must be hit 40 times. M8's `ttk_patient` ceiling is the
   only defence, and it will be the first threshold someone argues about.
10. **Stagger interactions ignored.** The player's punish staggers the enemy, which cancels
    its recovery into hitstun, which is longer — so the *real* window is much bigger than
    measured, and the fight is trivially stunlockable. The measurement in M2/M3 must run
    with poise intact, and a separate check (owned by the frame-data/poise item) must
    verify that repeated light attacks cannot chain-stun a non-trash enemy indefinitely.
11. **Multiplayer-brained recovery.** Someone imports the intuition that "whiff punishing
    is for fighting games" and argues Souls enemies should feel relentless. They shorten
    every recovery by 30%, playtesters report the game feels "intense", and the design has
    quietly become a reaction test with no learning curve.
12. **The window is there but nothing can be done with it.** `P_safe` = 18 f is a legal
    light-attack window only if the player's light attack is 13 f. If the frame-data item
    lands on `Ps` = 20 f for the game's starting weapon, half this table is silently
    invalid. Cross-check M4 against the frame-data item's actual `Ps` on every wave; the
    frame-data item is authoritative and these thresholds get recomputed, not defended.

## Provenance note

`provenance: constructed`. The PWR metric, its class thresholds, the 15-frame absolute
floor, the distribution requirements in §C, and the exception list in §D are all **defined
for this project**. No FromSoftware source states a "punish window ratio"; the metric is
ours and its value is that it is measurable from a trace.

Grounding is `canonical-recall` (confidence: medium) of these observed properties of
Dark Souls / Elden Ring: a dodged enemy attack reliably yields a free hit and often two;
larger enemies leave conspicuously longer openings; boss ultimates and slams are the
classic heal windows; and the general player-facing wisdom that the biggest attacks are the
best ones to bait, which is exactly the risk/reward relationship encoded in §C's last row.

The `Ps = 13 f` light-attack startup used in §E is a **placeholder pending the frame-data
reference item**, which is authoritative on player frames. Every number in §E derived from
`Ps` must be recomputed when that item lands. The class thresholds in §B are expressed in
frames and ratios precisely so that recomputation is mechanical.
