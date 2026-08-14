---
id: RI-AI06
title: Boss design — phases, rhythm, arena, and the fog-gate loop
kind: structure
side: souls
judges: [combat.boss.phases, combat.boss.arena, combat.enemy.telegraph, combat.enemy.punish, combat.death.worldreset, combat.camera.behaviour]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

A Souls boss is a **piece of music the player learns to dance to**. It has a finite,
enumerable moveset; the moves have distinct silhouettes and fixed timings; and the boss
selects among them with gates and seeded weights, not noise. Within four or five attempts
the player can name most of the moves. Within ten they can predict the second half of a
string from its opener. The fight is won not when the player gets faster reflexes but when
they stop reacting and start *anticipating* — and the moment that clicks is the entire
emotional payload of the genre.

Phases exist so the song changes key exactly when the player has got comfortable. A phase
transition is not "more damage"; it is a **new set of questions layered onto the old ones**,
announced by an unmissable event, at a threshold the player can feel coming.

> **REFERENCE MATERIAL FOR THIS ITEM IS ON DISK, added 2026-08-14 by AUDIT-CITATION-STALENESS.**
> `corpus/70-visual/refs/souls-behaviour/anim/ds1-boss-moves/` holds **177 named DS1 boss moves**
> as animated GIFs — one file per move, named `<Boss>_-_<Move>.gif` — and
> `corpus/70-visual/refs/souls-behaviour/arena/` holds **14** arena references. This item is
> called "boss design" and cited neither, for eight days, because they were reachable only from
> `RI-VIS09` §2's routing table, which routes them to `RI-VIS08` and to nothing in `10-combat/`.
>
> They are the direct evidence for **"a finite, enumerable moveset"**: the per-boss file count is
> the enumeration, and the names are the move list. Artorias alone has 8.
>
> **Behaviour-valid, not pixel-valid.** `RI-VIS09` §2 forbids fidelity or art-direction metrics
> on these, and forbids deriving any frame count from them — GIF frame timing is not game frame
> timing and every number in this area is `f@60` under **S22**. Use them for moveset enumeration,
> silhouette distinctness and phase-rhythm reading; preregister the action under `RI-VIS09` §5a.
>
> *(Counts stamped at commit `5597b4c4`; re-derive with `ls corpus/70-visual/refs/souls-behaviour/anim/ds1-boss-moves | wc -l`.)*

The arena is part of the moveset. A boss's spacing behaviour is only meaningful in a space
that has a size, a shape, and a small number of legible features. And the loop around the
fight — fog gate in, die, run back, fog gate in — is a designed object with its own budget:
if the runback costs more attention than the boss, the boss has been ruined by its corridor.

## The reference artifact

### A. Phase structure rules

| # | Rule | Value |
|---|---|---|
| P1 | Phase count | 2 (standard), 3 (max, reserved for ≤ 2 bosses in the game) |
| P2 | Phase 1 → 2 threshold | **HP ≤ 55%** (tolerance 50–65%) |
| P3 | Phase 2 → 3 threshold (3-phase only) | HP ≤ 22% (tolerance 18–30%) |
| P4 | Transition trigger | crossing the threshold **on any damage instance**; never on a timer, never on a move count |
| P5 | Transition window | 90–180 f; boss is invulnerable **and deals no damage**; player retains full agency (may heal, reposition, buff) |
| P6 | Transition is unmissable | camera does not steal control, but the boss must produce a distinct animation ≥ 90 f, an audio stinger, and a persistent visual state change (silhouette or emissive) that remains for the rest of the fight |
| P7 | Moveset size, phase 1 | 9–13 distinct moves (incl. ≥ 1 grab, ≥ 1 gap-closer, ≥ 1 ranged/zoning, ≥ 2 delayed variants) |
| P8 | Moveset size, phase 2 | phase 1 set **minus 0–2**, **plus 4–7** new moves; total 13–18 |
| P9 | Retention rule | ≥ 65% of phase 1's moves survive into phase 2 — the player's learning must not be invalidated |
| P10 | Strings per phase | ≤ 8 (RI-AI04 R4); max chain 5, one 6-chain signature permitted per boss |
| P11 | Damage escalation across phases | ≤ 1.30× per move that carries over; new moves may be up to one severity tier higher |
| P12 | Windup escalation | **never negative.** A carried-over move's windup in phase 2 must be ≥ its phase 1 windup. Speeding a boss up between phases is banned. |
| P13 | Punish window escalation | phase 2 median PWR ≥ 0.14 and ≥ 0.85× phase 1's median (RI-AI03 §B) |
| P14 | Adds/summons | ≤ 1 summoning move; ≤ 3 adds alive at once; adds are SWARM-class (RI-AI05 A7) and die to 2 light attacks; adds despawn on boss death |
| P15 | Healing | bosses never heal. Ever. |
| P16 | Enrage / soft-timer | banned. No damage ramp over elapsed time, no DPS check. |

### B. The rhythm contract — what "learnable" means, operationally

| # | Contract | Measurable |
|---|---|---|
| C1 | Finite moveset | ≤ 18 total moves; a 20-minute trace enumerates ≥ 95% of them |
| C2 | Fixed timings | per-move windup stdev ≤ 1 f (RI-AI04 M3) |
| C3 | Distinct silhouettes | all pairwise `D` ≥ 0.35 at `f_sil` (RI-AI02 §D) |
| C4 | Seeded selection | deterministic under (seed, input, respawn_count) (RI-AI04 M2) |
| C5 | Gated, not random | ≥ 60% of move selections must be constrained by at least one distance/hit/HP gate before RNG is consulted |
| C6 | Openings exist and recur | ≥ 8 punish openings (`P_safe ≥ 16 f`) per minute of engaged fight |
| C7 | Big openings recur | ≥ 1.2 openings with `P_safe ≥ 30 f` per minute |
| C8 | Heal window exists | ≥ 1 move per boss with `P_safe ≥ 60 f`, occurring ≥ 0.4 times per minute |
| C9 | No infinite pressure | longest observed interval with zero `P_safe ≥ 16 f` openings ≤ 12 s |
| C10 | Predictability rises with study | blind-panel next-move prediction accuracy rises from ≤ 25% (naive) to ≥ 60% (after 20 min of trace study) |

### C. Arena requirements

| # | Requirement | Value |
|---|---|---|
| AR1 | Floor area | ≥ 18 m × 18 m for a humanoid boss; ≥ 28 m × 28 m for a large boss (Ω > 4 m) |
| AR2 | Shape | convex, or a single convex core with ≤ 2 alcoves; no mazes, no corridors |
| AR3 | Camera clearance | ceiling ≥ 1.6 × boss height; no geometry within 1.5 m of the arena boundary that the camera can clip into |
| AR4 | Boundary | solid and readable (wall, root wall, cliff with visible edge). **Instant-death pits are banned** unless the boss has no attack that displaces the player |
| AR5 | Features | 1–3 legible features (pillar, root buttress, water-shallow). Each must be usable for LOS breaks against ranged moves **and** must not permit the player to fully trivialise the boss (see M7) |
| AR6 | Slope | ≤ 8° anywhere; no stairs; no gaps in the navmesh a boss can path-fail on |
| AR7 | Entry | one fog gate, at the arena boundary, with ≥ 6 m of clear floor inside it |
| AR8 | Starting distance | boss spawn ≥ 12 m from fog gate; boss does not aggro until the player is ≥ 3 m past the gate or 2.0 s have elapsed |
| AR9 | Lighting | boss silhouette must remain readable at the darkest point of the arena — verified by rendering the M-panel of RI-AI02 M4 at that light level |
| AR10 | Arena leash | boss cannot leave the arena; player cannot leave until the boss dies (fog gate is one-way in, opens on death) |

### D. The fog-gate / reset loop

| # | Rule | Value |
|---|---|---|
| F1 | Runback length | ≤ 60 s of travel from the nearest bonfire, walking (not sprinting), for a player who knows the route |
| F2 | Runback enemies | ≤ 4 enemy instances on the optimal path, and ≥ 2 of them must be avoidable without combat |
| F3 | Runback lethality | a player at the region's reference build who takes the optimal route with no combat must survive it ≥ 95% of attempts |
| F4 | Shortcut | if F1 cannot be met, a permanent shortcut (lift, ladder, kicked-down door) must open on **first arrival at the fog gate**, not on boss death |
| F5 | Reset on death | full boss HP, phase 1, arena state reset, adds despawned, seeded stream re-rolled with `respawn_count + 1` (RI-AI04 §D) |
| F6 | Player state on entry | boss fights are never entered in an unrecoverable state: the fog gate is ≤ 20 s of travel from a bonfire *or* the runback contains no mandatory combat |
| F7 | Souls on death | dropped at the point of death **inside** the arena; recoverable by re-entering; the bloodstain persists across attempts |
| F8 | No entry fee | entering the fog gate consumes nothing, ever |
| F9 | Reload cost | fog-gate-in to first frame of player control ≤ 3.0 s on the reference hardware target |

### E. Worked example boss — **Vakka-Zhil, the Rooted Choir** (R3, Xanmeer)

Region R3: `refHP` = 950, `soulsBase` = 350. Large boss, Ω = 4.5 m.
Damage shown as % of `refHP` and as absolute.

**Header**

| Field | Value |
|---|---|
| HP | 8 400 (8.8 × refHP) |
| Poise | 140; hyperarmour flagged on M4, M6, M7, M11, M12, M16, M17 |
| Stagger | poise break → 90 f stagger, opens a critical (riposte) window of 40 f; poise regenerates fully over 12 s, no faster |
| Phase 2 threshold | HP ≤ 4 620 (55%) |
| Transition | 150 f, invulnerable, deals no damage, ends with a persistent bloom of Hist-sap along its trunk |
| Souls | 12 000 (34 × soulsBase) |
| Leash | arena bounds; never de-aggros |
| Arena | 26 m circular, 3 root buttresses, ankle-deep water ring at the rim, ceiling open to canopy |
| Movement | walk 2.4 m·s⁻¹, no sprint; repositions by rooting/unrooting (18 f each way) |

**Phase 1 move table (11 moves)**

`t_r` = measured typical `t_reach` after an optimal roll (RI-AI03 M3).
`P` = `P_safe` realistic. `PWR` = `P / (W + A + Rc)`.

| # | Move | Sev | W | A | Rc | Total | t_r | P | PWR | Tell (silhouette) |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | Root Lash | S1 14% (133) | 22 | 4 | 30 | 56 | 12 | 18 | 0.32 | right vine-arm coils low behind hip, shoulders square |
| M2 | Root Lash (delayed) | S7 14% (133) | 38 (hold f18–34) | 4 | 30 | 72 | 12 | 18 | 0.25 | identical coil, then the arm **stops** at full cock for 16 f |
| M3 | Double Sweep | S1 ×2 12% (114 ea) | 24 / 16 (gap 8) | 4 / 4 | 36 | 92 | 12 | 24 | 0.26 | both arms swing wide-open, torso rotates twice |
| M4 | Overhead Root Slam | S2 26% (247) | 40 | 5 | 42 | 87 | 12 | 30 | 0.345 | rears to full height, both arms above crown, roots lift at feet |
| M5 | Spore Cough | S6 10% (95) + poison 30 | 26 | 6 | 40 | 72 | 20 | 20 | 0.28 | head cranes back, throat sac inflates visibly |
| M6 | Grasping Vine (grab) | S5 45% (428) | 42 | 6 | 42 | 90 | 10 | 32 | 0.356 | arms splay wide, head lowers, a ring of vines rises from the floor |
| M7 | Lunge Impale | S2 24% (228) gap-closer | 40 (18 lean + 22 travel) | 5 | 30 | 75 | 8 | 22 | 0.29 | full-body forward lean, one arm spears back before any translation |
| M8 | Backstep Sweep | S1 12% (114) | 20 | 4 | 32 | 56 | 22 | 16 | 0.29 | rear root plants, trunk pulls back before the arm comes across |
| M9 | Root Wall | S0 6% (57) zoning | 18 | 8 | 28 | 54 | 16 | 16 | 0.30 | palm slaps the floor, a line of soil ruptures outward |
| M10 | Rising Root (anti-roll) | S2 22% (209) | 28 | 4 | 34 | 66 | 12 | 22 | 0.33 | fingers spread downward, ground cracks in a 3 m disc **before** the root erupts |
| M11 | **Choir Bloom** (ultimate AoE) | S4 62% (589) | 90 (hold f56–80) | 8 | 70 | 168 | 10 | 60 | 0.36 | trunk splits open, whole body freezes wide, light builds in the cavity for 24 f |

Phase 1 aggregate: median PWR **0.30**; moves with `P ≥ 30`: M4, M6, M11 (3 ✓ RI-AI03 §C);
heal window M11 `P = 60` ✓ C8; PWR coefficient of variation **0.11** ✓; highest-damage move
(M11, 62%) is also the highest-PWR move ✓ risk/reward inversion check.

**Phase 1 strings (5)**

```
S_VZ_1 "lash cadence"
  M1 --[dist<=5.0, p=0.40]--> M1b(second lash, W18 A4)
  M1 --[dist<=5.0, p=0.30]--> M2                  # the delay bait
  M1 --[dist>5.0,  p=1.00]--> (TERMINAL)
  M1b --[hit, p=0.45]--> M4
  M1b --[whiff|blocked, p=1.00]--> (TERMINAL)
  M2  --[always]--> (TERMINAL)

S_VZ_2 "sweep into slam"
  M3 --[hit, dist<=5.0, p=0.55]--> M4
  M3 --[whiff, p=1.00]--> (TERMINAL)

S_VZ_3 "reach"
  M8 --[dist>6.5, p=0.65]--> M7
  M8 --[dist<=6.5, p=1.00]--> (TERMINAL)
  M7 --[hit, p=0.40]--> M10
  M7 --[whiff, p=1.00]--> (TERMINAL)

S_VZ_4 "zone"
  M9 --[dist>7.0, p=0.60]--> M5
  M9 --[dist<=7.0, p=1.00]--> (TERMINAL)

S_VZ_5 "the grab read"
  M6 --[player_behind|dist<=4.0, p=1.00]--> (TERMINAL)
```

M11 is not a string member; it is selected standalone on a cooldown of 45 s ±5 and only
when `dist > 4.0` (so it can never open as an unavoidable point-blank hit).

**Phase 2 changes (threshold HP ≤ 4 620)**

Removed: M8, M9 (2 removed, 82% retention ✓ P9). Retained: M1–M7, M10, M11 (9 moves).
Added: 6 moves → total 15 ✓ P8.

| # | Move | Sev | W | A | Rc | Total | t_r | P | PWR | Tell |
|---|---|---|---|---|---|---|---|---|---|---|
| M12 | Hist-Sap Nova | S3 38% (361) | 48 | 6 | 44 | 98 | 10 | 34 | 0.347 | boss roots itself (18 f), sap runs up the trunk from base to crown |
| M13 | Triple Lash | S1 ×3 12% ea | 22/16/16 (gaps 8) | 4/4/4 | 40 | 122 | 12 | 28 | 0.23 | same coil as M1, but the trunk **counter-rotates** on the first swing |
| M14 | Bloodroot Charge | S2 28% (266) gap-closer | 36 (16 + 20 travel) | 5 | 26 | 67 | 6 | 20 | 0.30 | low crouch, both arms trail behind; chains to M4 |
| M15 | Wailing Choir (summon, utility) | — | 54 | 0 | 50 | 104 | 8 | 42 | 0.40 | boss opens its cavity and holds a sustained note; 3 SWARM adds sprout from the water ring |
| M16 | Impale & Throw (grab 2) | S5 52% (494) | 44 | 6 | 42 | 92 | 10 | 32 | 0.348 | single arm cocks vertically like a harpoon, other arm braces the ground |
| M17 | **Choir Bloom, Greater** | S4 70% (665) | 96 (hold f60–86) | 10 | 72 | 178 | 10 | 62 | 0.348 | as M11 but the water ring recedes 20 f before the cavity opens |

Carried-over moves in phase 2: damage ×1.15 (≤1.30 ✓ P11); windups **unchanged**
(✓ P12, never shortened); M11 retained alongside M17 with M17 replacing it on a 55 s
cooldown when `hp < 25%`.

Phase 2 aggregate: 15 moves; median PWR **0.30** (≥0.85 × 0.30 ✓ P13); moves with
`P ≥ 30`: M4, M6, M12, M15, M16, M17 (6 ✓); heal windows M11 (60) and M17 (62) ✓;
one summoning move, ≤3 adds, 2-hit adds ✓ P14; no healing ✓ P15; no enrage ✓ P16.

**Openings-per-minute projection** (from the string weights and the move table, to be
confirmed by trace): 11.4 openings with `P ≥ 16` per minute ✓ C6; 2.1 with `P ≥ 30` ✓ C7;
0.9 with `P ≥ 60` ✓ C8; longest zero-opening interval 9.2 s ✓ C9.

**Runback**: bonfire "Drowned Stair" → 41 s walking; 3 enemies on path (1 INFANTRY, 2 SWARM),
2 avoidable by taking the flooded ledge ✓ F1–F3. A root-ladder shortcut drops on first
arrival at the fog gate ✓ F4.

## Comparison method

Harness: headless, 60 Hz, seeded, JSONL trace per RI-AI01 §A with boss fields
(`phase_index`, `hp`, `move_id`, `string_id`, `rng_draws`), plus pose dumps, plus an
**arena dump** (`{bounds_polygon, floor_area_m2, ceiling_h, features[], slope_max_deg,
fog_gate_pos, boss_spawn_pos, navmesh_holes[]}`), plus a **runback dump**
(`{bonfire_pos, path_polyline, path_length_m, walk_time_s, enemies_on_path[]}`).

**M1 — Moveset enumeration and rhythm (headline).**
Run a 20-minute scripted engagement per phase (force phase 2 by pre-setting HP), with a
"competent survivor" script: dodge on telegraph, punish only measured windows, never heal.
- Enumerate distinct `move_id`s observed. **PASS** if ≥ 95% of declared moves appear and
  no undeclared `move_id` appears.
- Compute **openings-per-minute** at thresholds `P_safe ≥ 16`, `≥ 30`, `≥ 60` by scanning
  the trace for recovery spans and applying RI-AI03 M3's empirical `P_safe` per move.
- **Headline number: openings with `P_safe ≥ 16 f` per minute of engaged fight; fail if
  < 8.0.**
- **PASS** on C6/C7/C8/C9 thresholds; **FAIL** if the longest zero-opening interval > 12 s.

**M2 — Phase transition.**
Script 30 kills. For each, extract the frame where `phase_index` increments and the `hp`
at that frame.
- **PASS** if the transition frame's `hp/hp_max` ∈ [0.50, 0.65] in 100% of runs, if the
  invulnerable window is 90–180 f, if the boss deals zero damage during it, and if the
  player is able to input heal/move throughout (check player state changes in-trace).
- **FAIL** if the transition ever fires on a timer (correlate transition time with elapsed
  time across runs; if stdev of elapsed-time-at-transition < 2 s across 30 varied-DPS runs,
  it is a timer).
- **FAIL** if any carried-over move's phase-2 windup < its phase-1 windup (P12).

**M3 — Moveset retention.** Diff phase 1 and phase 2 move sets.
- **PASS** if retention ≥ 65%, additions 4–7, total 13–18.

**M4 — Learnability panel (blind).**
Cut 20 clips of the boss's first move in a string, ending at the string's decision frame.
Ask the critic to predict the follow-up (multiple choice over the boss's move list).
Record accuracy. Then supply a 20-minute trace and the observed transition graph, and
repeat with 20 fresh clips.
- **PASS** if naive accuracy ≤ 35% and post-study accuracy ≥ 60% (C10). A boss that is
  already predictable naively is too simple; one that never becomes predictable is noise.

**M5 — Arena conformance.** Read the arena dump.
- Check AR1–AR10 mechanically: area, convexity (compute the convex-hull area ratio; ≥ 0.85
  for "convex enough"), ceiling height vs boss bounding box, slope max, navmesh hole count
  (**must be 0**), fog gate clearance, spawn distance.
- **FAIL** on any navmesh hole inside the arena polygon, or on an instant-death boundary
  where the boss has any displacing move.

**M6 — Boss path-failure probe.** Script the player to spend 3 minutes standing on/behind
each declared arena feature in turn.
- Compute the fraction of frames in which the boss is in `state ∈ {APPROACH, CIRCLE,
  COMMIT}` vs stuck (`speed_mps < 0.2` while `dist_m > Ω` and no attack in progress).
- **PASS** if stuck-fraction ≤ 5% at every feature.
- **FAIL** if ≥ 20% — the arena feature breaks the boss.

**M7 — Trivialisation probe (AR5's second clause).**
For each arena feature, run a 5-minute "abuse" script: circle-strafe the pillar, or stand
in the alcove, and attack only when safe.
- Compute damage-taken-per-minute against the open-floor baseline.
- **FAIL** if any feature reduces damage taken by ≥ 80% relative to baseline — the boss has
  a free win.

**M8 — Runback contract.** From the runback dump: walk time, enemy count, avoidable count.
Then run 20 scripted no-combat runbacks at the region reference build.
- **PASS** if walk time ≤ 60 s, enemies ≤ 4, avoidable ≥ 2, survival ≥ 95%, and
  fog-gate-to-control ≤ 3.0 s.
- **FAIL** if walk time > 90 s with no first-arrival shortcut.

**M9 — Reset integrity.** Kill the player 10× in phase 2. On each re-entry, assert `hp ==
hp_max`, `phase_index == 1`, zero adds alive, arena features restored, and
`respawn_count` incremented in the seed (RI-AI04 §D).
- **FAIL** on any residual state, and **FAIL** if souls are not recoverable from inside the
  arena (F7).

**M10 — No enrage, no heal, no scaling.**
- Run one 20-minute deliberately-slow fight (player deals 1 damage per hit). Assert boss
  damage per move is constant across the whole run and `hp` is monotonically non-increasing.
- Run the same boss at player level 20 and level 80. Assert `hp_max` and per-move damage
  identical (ARBITRATION S9).
- **Any violation is an automatic fail of the piece.**

**M11 — Telegraph and punish inheritance.** Run RI-AI02 M1/M2/M3 and RI-AI03 M1/M3/M4/M5
against every boss move.
- **PASS** only if the boss satisfies those items' gates in full. A boss is not exempt from
  telegraph doctrine; phase 2 is not exempt either.

## Scoring

| Check | Weight |
|---|---|
| M1 moveset & openings-per-minute | 5 |
| M2 phase transition | 4 |
| M4 learnability panel | 4 |
| M5 arena conformance | 3 |
| M6 path-failure | 2 |
| M7 trivialisation | 3 |
| M8 runback | 3 |
| M9 reset integrity | 2 |
| M11 telegraph/punish inheritance | 5 |

Each 0/1/2 × weight. Max 62.

| Total | Verdict |
|---|---|
| 55–62 | Meets the bar |
| 41–54 | Below bar — named remedy required |
| ≤ 40 | Loses outright |

**Hard fails regardless of total:**
- M10: any enrage timer, any boss healing, any level-scaling (AR-1 / ARBITRATION S9).
- M2: transition fires on a timer or move-count rather than an HP threshold; or any
  carried-over move's windup shortened in phase 2.
- M1: openings-per-minute (`P_safe ≥ 16`) < 8.0, or any zero-opening interval > 15 s.
- M5: any navmesh hole inside the arena polygon.
- M11: any RI-AI02 or RI-AI03 hard fail on any boss move.
- M9: souls unrecoverable, or state carried across attempts.

Blind pair: present the critic with two unlabelled move tables (ours, and §E) with move
names replaced by M1..Mn and tells stripped. It states which boss it believes has a rhythm,
and which one it would rather learn, before reveal.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 41 / 62 | 48 / 62 | 56 / 62 |

**Aggregation (a property of this item, not of the critic):** weighted-sum — each check 0/1/2 x weight, max 62.

## How we lose

1. **The boss is a big trash mob with 12× HP.** Four moves, no phases, no grab, no
   gap-closer, no zoning. It passes "is it hard?" because it takes eight minutes to kill,
   and it fails C1, C6, and the entire point. This is the single most likely outcome and
   the most expensive to fix late.
2. **Phase 2 = phase 1 with a red glow and 2× damage.** No new moves, no removed moves, no
   new questions. P8/P9 and M3 catch it. The transition becomes a punishment for progress
   rather than an escalation of the conversation.
3. **Phase 2 is phase 1, faster.** Animation speed multiplier applied wholesale. Windups
   drop below the RI-AI02 floors, the silhouettes blur, and everything the player learned
   about timing is invalidated. P12 bans it and M2 measures it. This is *the* seductive
   failure — it is one line of code and it feels dramatic in a playtest.
4. **Enrage timer.** Added because "the fight drags for cautious players". It converts a
   patience-rewarding design into a DPS check, which is a raid mechanic, not a Souls
   mechanic. P16, M10, hard fail.
5. **Boss heals.** Someone adds a lifesteal move for flavour. Now the patient player can
   lose ground indefinitely and the fight has no monotone progress signal. P15, hard fail.
6. **Transition on a timer.** Easier to implement than an HP hook, so phase 2 arrives at
   t = 60 s regardless of damage. The player's damage stops mattering, and a strong build
   is punished by fighting phase 1 for the full minute anyway. M2's stdev test.
7. **The transition is a free hit.** The boss is invulnerable *and* has an unavoidable
   damaging AoE during the cinematic, so the correct play is to have run away 5 s earlier —
   which is unknowable on the first attempt. P5 forbids damage during the window.
8. **Arena is a corridor / has a pit / has a pillar that wins the fight.** All three are
   common. The pit kills the player to a knockback they could not have predicted; the
   pillar lets them win by walking in circles. AR4, AR5, M7.
9. **Navmesh hole.** The boss's pathing catches on a root buttress and it stands there
   swinging at nothing while the player kills it for free. M5 (hole count must be 0) and
   M6 (stuck fraction).
10. **Camera death.** The boss is large, the arena ceiling is low, and lock-on puts the
    camera inside the boss's chest. The fight becomes unreadable for reasons nothing in the
    AI is responsible for. AR3 exists so this is caught at arena-authoring time, not at
    review.
11. **The runback is the boss.** Bonfire is 3 minutes away, seven enemies on the path, two
    of them elites. Attempt 6 onward the player is not learning the boss, they are
    resenting the corridor. F1–F4, M8.
12. **Adds as difficulty.** The summon move is used every 20 s, six adds accumulate, and
    the boss becomes a crowd-control puzzle wearing a boss costume. P14's caps.
13. **Openings exist but are unreachable.** Every long recovery happens after a move that
    throws the player 9 m across the arena, so `t_reach` eats the entire window. This is
    RI-AI03's `t_reach` failure appearing at boss scale, and it is why M1's opening count
    must be computed with the realistic (post-roll-position) `P_safe`, never the idealised
    one.
14. **Non-deterministic move selection.** `Math.random()` per attack, so the boss is a slot
    machine and M4's post-study accuracy never rises. Players describe this as "unfair" and
    the team hears "too hard" and lowers HP, which fixes nothing.
15. **The grab is a coin flip.** Grab hitbox is huge, windup is 20 f, tracking runs to the
    active frame, and it does 55%. It becomes the only move that matters and the fight is
    "don't get grabbed". S5 in RI-AI02 §B requires 40 f windup and `Tc ≤ 0.5·W` precisely
    to prevent this.
16. **Three phases because two felt short.** The third phase is authored in a week, has
    four moves, breaks P1's budget, and dilutes the two good phases. Two excellent phases
    beat three adequate ones, and the corpus caps three-phase bosses at two in the game.

## Provenance note

`provenance: constructed`, `confidence: medium`. Every frame value, HP figure, threshold,
arena dimension, and runback budget in this file is **defined for this project**. Vakka-Zhil
is an invented boss authored as a worked example so a critic has a concrete artifact to hold
ours against; it is not a recalled statblock of any existing boss.

Grounding is `canonical-recall` (confidence: medium) of Dark Souls / Elden Ring boss design:
two-phase structure with an HP-threshold transition and an unmissable transition event;
finite movesets that players enumerate and name; phase 2 adding moves while retaining most
of phase 1; the absence of enrage timers and boss self-healing; fog gates as one-way entry
with a bonfire runback; bloodstain recovery inside the arena; and arena features that
occasionally break bosses (a widely-observed real failure mode, which is why M6/M7 exist).

Community data supports that the phase-transition threshold varies by boss and clusters
near but not exactly at 50%: Mohg, Lord of Blood transitions at 50% or below, Messmer the
Impaler transitions below 60%, and Malenia's signature move is described as clustering
around 66% and 33% in phase 1 —
([Fextralife: Mohg](https://eldenring.wiki.fextralife.com/Mohg,+Lord+of+Blood),
[3A Game Master: Messmer phase transitions](https://www.3agamemaster.com/guides/elden-ring-shadow-of-the-erdtree-messmer-the-impaler-boss-guide-phase-transitions-boss-guide-2025-moxx6ngn)).
`provenance: community-data` for that observation specifically; it is what justifies P2's
50–65% tolerance band rather than a hard 50%.

Cross-dependencies: this item inherits RI-AI02 (telegraph), RI-AI03 (punish windows), and
RI-AI04 (strings) in full — a boss is not an exemption. Player roll i-frames, stamina cost,
and riposte damage referenced in §E are owned by the frame-data item, which is
authoritative; the 40 f critical window in §E is a placeholder pending that item.
