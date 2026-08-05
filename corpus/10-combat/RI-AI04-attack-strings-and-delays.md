---
id: RI-AI04
title: Attack strings, combo branching, and the delayed follow-up
kind: structure
side: souls
judges: [combat.attack.moveset, combat.enemy.telegraph, combat.enemy.statemachine, combat.attack.commitment]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Enemy offence is not a sequence of independent swings; it is a small set of **named
phrases**. A phrase has a fixed grammar — this opener can go to that follow-up, and from
there to at most one of two enders — and the player learns the grammar the way they learn a
song. The phrase is what makes the fight teachable: after the fourth encounter the player
is no longer reacting to the current swing, they are predicting the next one.

Inside that grammar sits the single best trick in the Souls vocabulary: the **delayed
follow-up**. The enemy raises for a second hit and then *holds*, visibly, for a beat longer
than the player's now-ingrained rhythm expects. The early roll goes out, the i-frames
expire, and the swing lands on an empty dodge. It is brutal and it is completely fair,
because the hold is on screen the whole time and the fix is to watch the enemy instead of
counting.

The line this item defends is between **delay** and **randomness**. A delay is a distinct,
seeded, visibly-different variant of a move. Randomness is `windup += Math.random()*20`.
The first teaches; the second cannot be learned, only survived. Strings must be finite,
seeded, enumerable, and — given the same seed and the same player behaviour — identical.

## The reference artifact

### A. String grammar notation

A string is a directed acyclic graph over move nodes. Notation used throughout the corpus:

```
STRING <id> (enemy:<archetype>) :
  <move> --[<gate>, p=<weight>]--> <move>
  <move> --[TERMINAL]--> (recovery)
```

Gates are conditions evaluated at the **link decision frame** — the last frame of the
current move's active window, not at string start. Legal gates:

| Gate | Meaning |
|---|---|
| `dist<=X` | player within X metres at decision frame |
| `dist>X` | player beyond X metres |
| `hit` | previous move connected (hit or was blocked) |
| `whiff` | previous move connected with nothing |
| `blocked` | previous move was blocked |
| `player_behind` | player outside enemy's ±90° front arc |
| `hp<X%` | enemy HP below threshold (bosses only) |
| `always` | unconditional |

`p=` is a weight over the seeded PRNG **only among links whose gates all pass**. Gates are
evaluated first; RNG only ever picks between design-legal continuations.

### B. Hard rules on string structure

| # | Rule | Value |
|---|---|---|
| R1 | Max chain length, trash | 3 moves |
| R2 | Max chain length, elite | 4 moves |
| R3 | Max chain length, boss | 5 moves (one designated 6-move "signature" per boss permitted) |
| R4 | Max distinct strings per enemy | trash 4, elite 6, boss 8 per phase |
| R5 | Every string must terminate | no cycles in the graph; no self-links |
| R6 | Every link's target move satisfies RI-AI02 §B independently | a follow-up is a full attack with its own windup floor of 12 f |
| R7 | Inter-link gap (last active frame → next windup frame 0) | ≥ 6 f, and the follow-up's own windup ≥ 12 f, so total reaction time between hits ≥ 18 f |
| R8 | Terminal punish window | the string's final move satisfies RI-AI03 §B for the enemy's class |
| R9 | Per-link punish windows | may be 0 (RI-AI03 §D exception) |
| R10 | Determinism | same seed + same player input sequence ⇒ byte-identical string trace |
| R11 | RNG draw budget | at most **one** PRNG draw per link decision; drawn from the enemy's own seeded stream, logged in `rng_draws` |
| R12 | No re-roll of windup timing | windup length is a property of the *move*, never of the instance (RI-AI02 AP12) |
| R13 | Delayed variants are distinct moves | a delayed follow-up has its own move id, its own anim, and a visible hold pose |
| R14 | Delay budget | at most 40% of an enemy's links may target a delayed variant; at least 1 must |
| R15 | Repeat suppression | the same string may not be selected 3 times consecutively; the 3rd selection is forced to a different string (deterministic, not random) |
| R16 | String cancel on stagger | any hit that breaks poise terminates the string at that link; it does not resume |
| R17 | Strings never re-target mid-string | the target locked at string start persists; a second player (co-op) cannot pull a string sideways |

### C. The delayed follow-up — the specification

A delayed variant `M'` of move `M` must satisfy all of:

| Property | Requirement |
|---|---|
| Windup | `W(M') = W(M) + Δ`, `Δ ∈ [12, 30]` frames |
| Hold pose | frames `[W(M) − 4, W(M) + Δ − 4]` are a near-static hold: max joint angular velocity ≤ 25 °/s over that span |
| Silhouette | `D(M, M')` at frame `W(M) − 2` may be < 0.35 (they *should* look alike up to the hold — that is the point), but `D` must exceed 0.35 by frame `W(M) + 6` |
| Tracking | `Tc(M') ≤ 0.50 · W(M')` — a delayed attack tracks *less*, not more; it must not use the hold to re-aim |
| Frequency | selected on 25–45% of eligible link decisions (`p` weight), never 100%, never < 10% |
| Damage | ≤ 1.15× the damage of `M` — the delay is the threat, not the number |
| Punish | `P_safe(M') ≥ P_safe(M)` — baiting the delayed version and dodging it late must pay *better* |

The frequency band in row 5 is the crux. At 100% the delay simply becomes the new rhythm
and teaches nothing. Below 10% it is a random death. The 25–45% band makes both the early
roll and the late roll wrong *sometimes*, which forces the player to read the pose.

### D. Determinism and the seeded stream

Each enemy instance owns a PRNG stream seeded at spawn:

```
seed_enemy = hash(world_seed, encounter_id, spawn_index, respawn_count)
```

`respawn_count` increments on bonfire rest. This is deliberate: the same enemy at the same
spot behaves identically **within one life**, and re-rolls between rests, so a memorised
run stays broadly familiar without becoming a fixed script. Every draw is logged:

```json
"rng_draws":[{"f":1204,"stream":"inf_03","purpose":"link:S_INF_A@1","value":0.6182,
              "candidates":["thrust_2","thrust_2_delay","overhead"],"chosen":"thrust_2_delay"}]
```

Determinism check: two runs with identical `world_seed`, identical scripted input, and
identical `respawn_count` must produce identical `rng_draws` sequences.

### E. Worked reference: `INFANTRY` string set

Moves from RI-AI02 §F: `thrust` (W18), `thrust_delay` (W30), `overhead` (W26),
`bash` (W14), `stepback_thrust` (W22), `charge` (W30).

```
STRING S_INF_A (enemy:INFANTRY) "the levy's bread and butter"
  thrust --[dist<=2.6, p=0.45]--> thrust_2
  thrust --[dist<=2.6, p=0.30]--> thrust_2_delay      # the bait
  thrust --[dist>2.6,  p=1.00]--> (TERMINAL)
  thrust_2       --[hit, dist<=2.6, p=0.55]--> overhead   # 3rd move, chain cap reached
  thrust_2       --[whiff|blocked,  p=1.00]--> (TERMINAL)
  thrust_2_delay --[always]--> (TERMINAL)                 # delay ender, big punish

STRING S_INF_B (enemy:INFANTRY) "shield opener"
  bash --[hit, dist<=2.2, p=0.70]--> thrust
  bash --[hit, dist<=2.2, p=0.30]--> overhead
  bash --[whiff, p=1.00]--> (TERMINAL)
  thrust   --[TERMINAL]
  overhead --[TERMINAL]

STRING S_INF_C (enemy:INFANTRY) "spacing punish"
  stepback_thrust --[dist>3.2, p=0.60]--> charge
  stepback_thrust --[dist<=3.2, p=1.00]--> (TERMINAL)
  charge --[TERMINAL]

STRING S_INF_D (enemy:INFANTRY) "commit"
  charge --[hit, p=0.50]--> overhead
  charge --[whiff, p=1.00]--> (TERMINAL)
  overhead --[TERMINAL]
```

Counts: 4 strings (R4 ✓ trash max 4), max chain 3 (R1 ✓), delayed links 1 of 9 weighted
links targeting a delayed variant = 11% by link count but 30% of the `thrust` decision
weight (R14: ≥1 delayed variant present ✓, ≤40% ✓).

**Frame budget for `S_INF_A` longest path** (thrust → thrust_2 → overhead):

| Segment | W | A | gap | cumulative frame |
|---|---|---|---|---|
| thrust | 18 | 3 | — | 0–20 |
| gap | — | — | 8 | 21–28 |
| thrust_2 | 16 | 3 | — | 29–47 |
| gap | — | — | 8 | 48–55 |
| overhead | 26 | 4 | — | 56–85 |
| overhead recovery | — | — | Rc 34 | 86–119 |

Reaction time between thrust active-end (f20) and thrust_2 active-start (f44) = 24 f ✓ R7.
Terminal punish = 34 f of overhead recovery, PWR of the terminal link ✓ R8.

**The bait path** (thrust → thrust_2_delay):

| Segment | W | A | gap | cumulative |
|---|---|---|---|---|
| thrust | 18 | 3 | — | 0–20 |
| gap | — | — | 8 | 21–28 |
| thrust_2_delay | 16 + Δ22 = 38 (hold f12–f34) | 3 | — | 29–69 |
| recovery | — | — | 26 | 70–95 |

The player who learned `thrust_2` at 16 f windup rolls at f≈40 absolute; the delayed hit
lands at f67–69, 27 frames after their i-frames ended. Fair, visible, lethal.

## Comparison method

Harness: headless, 60 Hz, seeded, JSONL trace per RI-AI01 §A with `string_id`,
`string_index`, and `rng_draws` populated. If `string_id`/`rng_draws` are absent, this
entire item scores 0 (fail-closed) — an implementation that cannot name its own strings
does not have strings.

**M1 — String enumeration.** Run 20 minutes of scripted play per enemy across four player
behaviour profiles (aggressive-in-face, patient-at-mid, kiting-at-range, block-only).
Extract the observed set of `(string_id, sequence of moves)` pairs.
- Build the empirical transition graph.
- **PASS** if the observed graph is a subgraph of the declared statblock graph with no
  edges outside it, and ≥ 90% of declared edges were observed at least 5 times.
- **FAIL** if any observed sequence is not a declared string, or if the graph contains a
  cycle, or if any chain exceeds the §B length cap.
- **Headline number: max observed chain length; fail if it exceeds the class cap in R1–R3.**

**M2 — Determinism (the load-bearing check).**
Run the same encounter twice: identical `world_seed`, identical `encounter_id`, identical
scripted input, identical `respawn_count`.
- Diff the two JSONL traces field-by-field.
- **PASS** only on byte-identical `rng_draws` sequences and identical `(f, state, anim,
  anim_frame)` tuples.
- **FAIL** on any divergence. Non-determinism means the string set is unlearnable in
  principle, and every other measurement in this file is unreliable.
- Second run: change only `respawn_count`, assert the `rng_draws` sequence *does* change
  (otherwise the world is a fixed script, which is the opposite failure).

**M3 — Windup stability (anti-random-timing).**
For each move id, collect windup frame counts across ≥ 40 instances.
- **PASS** if `stdev(W) ≤ 1 f` per move id, and delayed variants appear under their own
  distinct move id.
- **FAIL** if any move id shows `stdev(W) > 3 f` — timing is being randomised inside a
  single move (RI-AI02 AP12 / R12).

**M4 — Delay presence and frequency.**
For each enemy, identify declared delayed variants. From M1's traces compute selection
frequency at each eligible decision point.
- **PASS** if ≥ 1 delayed variant exists per enemy of tier trash-standard and above, and
  each is selected in 25–45% of its eligible decisions (±5 pp tolerance over ≥ 60 samples).
- **FAIL** if 0 delayed variants exist (the roster has no bait), or if any is selected
  > 60% (it has become the default rhythm) or < 10% (it is a random death).

**M5 — Delay is visible.** Pose-dump each delayed variant. Compute max joint angular
velocity over the declared hold span.
- **PASS** if ≤ 25 °/s over ≥ 12 consecutive frames, and `D(M, M')` exceeds 0.35 by
  frame `W(M) + 6`.
- **FAIL** if the "delay" is the same animation played slower throughout (no hold, uniform
  slowdown) — measure by comparing the joint-velocity profiles of `M` and `M'`: if
  `vel(M', f) ≈ vel(M, f · W(M)/W(M'))` within 15% across the whole windup, it is a
  time-scaled clip, not a hold, and it fails.

**M6 — Gate correctness.** For each declared gate, construct a scripted scenario that
satisfies it and one that violates it (e.g. `dist<=2.6`: hold player at 2.4 m vs 3.4 m).
Sample 30 link decisions each.
- **PASS** if gated links fire ≥ 95% only in satisfying conditions.
- **FAIL** if a `dist<=X` link fires while `dist_m > X + 0.3` (gates are decorative).

**M7 — Inter-link gap.** Over all traces, compute for every observed link the frames from
last `hit_active` of move N to first `phase == "windup"` frame of move N+1.
- **PASS** if min ≥ 6 f across all links, and (gap + follow-up windup) ≥ 18 f in 100%.
- **FAIL** on any violation. This is the "unreactable second hit" check.

**M8 — Repeat suppression.** From M1's traces, find the longest run of consecutive
identical `string_id` selections.
- **PASS** if ≤ 2. **FAIL** if ≥ 4 (the enemy has one string and a facade of variety).

**M9 — Stagger cancels string.** Script the player to break poise mid-string.
- **PASS** if `string_id` becomes null within 2 f and the string does not resume after
  hitstun in ≥ 95% of trials.

**M10 — Blind learnability panel.** Give the critic 12 unlabelled clips of the enemy's
first two moves cut at the decision frame, and ask it to predict the third. Then give it
30 minutes of trace to "study" and repeat with 12 new clips.
- **PASS** if accuracy rises from near-chance to ≥ 70% after study. A string set that does
  not become predictable with study is not a string set.

## Scoring

| Check | Weight |
|---|---|
| M1 enumeration / chain caps | 3 |
| M2 determinism | 5 |
| M3 windup stability | 4 |
| M4 delay presence & frequency | 4 |
| M5 delay visibility | 3 |
| M7 inter-link gap | 3 |
| M8 repeat suppression | 1 |
| M10 blind learnability | 3 |

Each 0/1/2 × weight. Max 52.

| Total | Verdict |
|---|---|
| 46–52 | Meets the bar |
| 34–45 | Below bar — named remedy required |
| ≤ 33 | Loses outright |

**Hard fails regardless of total:**
- M2 non-determinism under identical seed + input.
- Any move id with windup `stdev > 3 f` (randomised timing).
- Any inter-link gap + follow-up windup < 18 f.
- Chain length exceeding class cap.
- `string_id` / `rng_draws` absent from the trace (fail-closed).
- Zero delayed variants across the entire roster.

Blind pair: two unlabelled string-graph DOT renderings (ours, and §E). The critic states
which grammar it believes it could learn in ten deaths, before reveal.

## How we lose

1. **There are no strings.** Each attack is chosen independently by
   `attacks[Math.floor(Math.random()*attacks.length)]`. M1 finds no graph structure, M10
   finds no learnability gain after study, and the fight is a slot machine. This is the
   default state of a naive implementation and it is the most likely outcome.
2. **Non-deterministic PRNG.** `Math.random()` seeded from wall-clock, so the same fight
   is different every attempt and M2 fails immediately. Everything downstream — every
   frame number in this corpus — becomes unverifiable, because you cannot reproduce the
   trace that produced it.
3. **Randomised windup marketed as "delay".** `windupFrames = base + rand(0,20)`. Looks
   varied, feels unfair, teaches nothing. M3's stdev gate exists solely for this, and the
   argument against it ("but real Souls bosses delay their attacks!") is exactly backwards:
   they delay via *distinct moves with held poses*, not via a jitter on a timer.
4. **Time-scaled clip instead of a hold.** The "delayed" variant is the same animation at
   0.6× speed. The whole windup is slower, so there is no moment of held stillness for the
   player to read, and it reads as lag rather than as menace. M5's velocity-profile
   comparison catches it.
5. **Infinite chains.** The AI keeps rolling "continue?" at each link with p=0.6 and no
   length cap, so the enemy occasionally executes an eight-hit string and kills the player
   through their entire stamina bar. R1–R3 plus M1.
6. **Unreactable follow-ups.** The second hit's windup is 6 frames because it was authored
   as one continuous combo animation and the "windup" of hit 2 is just the recovery of hit
   1 re-labelled. R7 and M7. The player cannot dodge it, so the correct play is to never be
   in range of hit 1 — which deletes the string's purpose.
7. **Gates that do not gate.** `dist<=2.6` is declared in the design doc and never
   implemented; the enemy commits to a three-hit string at 7 m and whiffs into the air.
   M6. The string set looks sophisticated on paper and is noise in play.
8. **Mid-string re-targeting.** The enemy smoothly re-aims each link at the player's new
   position, so a string is effectively three homing attacks. Interacts with RI-AI02 AP2;
   R17 and the tracking-cutoff checks both fire.
9. **String does not break on stagger.** The player poise-breaks the enemy mid-combo, the
   enemy plays hitstun, and then resumes the string from link 2 as if nothing happened.
   The reward for a poise break is erased. M9.
10. **One string with cosmetic variety.** Four `string_id`s declared, but three of them are
    the same move sequence with different names, or the selection weights are 0.94/0.02/
    0.02/0.02. M8 and M1's edge-coverage requirement.
11. **Delay used everywhere.** Someone reads "delayed attacks are good" and makes every
    follow-up delayed. The delay becomes the rhythm, the player learns *that*, and the
    non-delayed version is now the surprise — but there is no non-delayed version, so the
    fight is just slow. M4's upper bound.
12. **Seed reset in the wrong place.** `respawn_count` is not part of the seed, so the
    enemy behaves identically forever and the level becomes a memorised script (world
    strangeness dies), or the seed is re-rolled every frame, which is failure mode 2. M2's
    second half checks both directions.
13. **Health-sponge substitution, string edition.** The strings are boring, so instead of
    authoring more the team raises HP and attack count so the player sees the same two
    strings forty times. Length is not depth. M10 is unaffected by HP and will still show
    a shallow grammar.

## Provenance note

`provenance: constructed`. The notation, the gate vocabulary, the chain caps, the 25–45%
delay frequency band, the `Δ ∈ [12,30]` delay budget, the seeding scheme, and all
tolerances are **defined for this project**.

Grounding is `canonical-recall` (confidence: medium) of Dark Souls / Elden Ring behaviour:
enemies visibly execute short fixed combos rather than independent swings; combos branch on
whether the previous hit connected and on distance; delayed attacks are a widely-discussed
and specifically-named phenomenon in Elden Ring player discourse, understood as *particular
moves* that hang at the top of the swing rather than as random timing variance; and
poise-breaking an enemy mid-combo reliably ends the combo.

The `respawn_count`-in-seed rule is an explicit design decision for this project, not a
recalled behaviour. It resolves a genuine tension between Souls determinism (S5: bonfire
rest respawns enemies) and Morrowind's demand for a world that does not feel like a fixed
script (ARBITRATION §1, "Strangeness"). It is recorded here so a critic can hold us to it
rather than treat divergence-between-rests as a bug.

Cross-dependency: R7's 18-frame minimum reaction requirement is derived from the frame-data
item's roll startup plus input latency. That item is authoritative on player frames; if its
values move, R7's constant is recomputed, not defended.
