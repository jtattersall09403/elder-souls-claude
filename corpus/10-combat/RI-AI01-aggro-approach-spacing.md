---
id: RI-AI01
title: Aggro, approach and spacing — the enemy engagement state machine
kind: structure
side: souls
judges: [combat.enemy.perception, combat.enemy.statemachine, combat.enemy.movement, combat.enemy.leash, combat.encounter.grouping]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

A Souls enemy is not a chase-bot. Between "it noticed you" and "it hit you" there is a
readable, repeatable negotiation of distance: it closes to *its* preferred band, it holds
there, it strafes, it feints the gap, and only then does it commit to a swing that it
cannot take back. The player learns the *rhythm of the approach* before they learn the
moveset, and that approach rhythm is what makes standing at 4 metres feel different from
standing at 2.5 metres. A correct implementation makes distance the primary dial the
player turns; an incorrect one makes distance irrelevant because the enemy is glued to
the player's capsule. Aggro must have a *cost of entry* (perception, not proximity) and
an *exit* (de-aggro, leash, world-reset), and both must be observable from a trace with
no access to internals.

## The reference artifact

### A. The canonical enemy trace record (this item defines the fields it judges)

All seven AI reference items compute over the same per-frame JSONL dump, one record per
live enemy per simulation frame, 60 Hz fixed step. The harness owner (`corpus/80-methods/`)
owns emission; this item owns the **field contract**. A missing field is a **fail-closed
condition**: the critic scores 0 for the affected check, never "unknown".

```json
{"f":1042,"t_ms":17366,"eid":"inf_03","archetype":"INFANTRY","tier":"trash",
 "state":"CIRCLE","state_entered_f":1009,"prev_state":"APPROACH",
 "anim":"atk_r1_a","anim_frame":0,"anim_len":52,"phase":"none",
 "hit_active":false,"hitboxes":[],
 "pos":[12.4,0.0,-8.1],"yaw_deg":214.6,"yaw_rate_dps":142.0,"speed_mps":2.1,
 "target":"player","dist_m":3.42,"los":true,"in_sight_cone":true,
 "alert":100,"alert_state":"AGGRO","attack_token":false,
 "hp":412,"hp_max":412,"poise_max":22,"poise_cur":22,"stagger":false,
 "spawn_anchor":[10.0,0.0,-12.0],"leash_dist_m":4.4,
 "string_id":null,"string_index":null,"rng_draws":[],
 "player":{"pos":[14.0,0.0,-6.9],"state":"MOVE","stamina":94,"iframe":false,
           "anim":"run_f","anim_frame":11}}
```

`phase` ∈ `none|windup|active|recovery|turn|hitstun`. `alert_state` ∈
`IDLE|SUSPICIOUS|SEARCH|AGGRO`. `state` is the behaviour-tree leaf, from the table below.

### B. Perception model

Perception fills a 0–100 `alert` meter. Nothing aggros on raw proximity alone.

| Channel | Geometry | Fill rate at reference distance | Notes |
|---|---|---|---|
| Primary sight cone | ±55° horizontal, ±35° vertical from eye node | 100/s at ≤0.5·R, 50/s at 1.0·R, 0 at >R | requires unbroken LOS from eye node to player chest node |
| Peripheral cone | ±55°→±100° horizontal | 0.35× primary rate | cannot exceed `alert` 70 on its own |
| Rear arc | >±100° | 0 | enemies are backstab-able by design |
| Hearing (sprint) | sphere r = 14 m | 60/s | ignores LOS, walls attenuate ×0.4 |
| Hearing (walk) | sphere r = 6 m | 40/s | |
| Hearing (crouch/sneak) | sphere r = 2.5 m | 25/s | |
| Hearing (weapon impact, any) | sphere r = 20 m | instant +80 | includes blocked hits, missed swings on geometry |
| Ally death shout | sphere r = 12 m | instant +100 | one propagation hop only, never chains |
| Damage taken | any | instant +100, forces AGGRO | includes arrows from out of cone |

Sight radius `R` by archetype (metres, see RI-AI05):

| Archetype | R (m) | Tolerance |
|---|---|---|
| INFANTRY | 16 | ±2 |
| TURTLE | 14 | ±2 |
| DUELIST | 18 | ±2 |
| POISE_MONSTER | 12 | ±2 |
| RANGED | 26 | ±3 |
| AMBUSHER | 7 (until triggered) | ±1 |
| SWARM | 20 | ±3 |
| CASTER | 24 | ±3 |
| ELITE | 20 | ±2 |
| BOSS | arena-wide (fog gate = trigger) | n/a |

Decay: `alert` drains at 12/s when no channel is filling, floored at 0. `SUSPICIOUS` at
alert ≥ 50, `AGGRO` at alert = 100. Hysteresis: once AGGRO, drop to SEARCH only via the
de-aggro rule below, never via meter decay.

### C. Distance bands (all measured centre-to-centre, horizontal only)

Bands are expressed as multiples of the enemy's **reach** `Ω` = distance from root to the
furthest point of its longest attack's hitbox at the frame of maximum extension.

| Band | Range | Enemy intent |
|---|---|---|
| STRIKE | ≤ 0.85·Ω | may COMMIT this frame if token held |
| POKE | 0.85–1.25·Ω | step-in feint band; the "steps into range then commits" pattern lives here |
| DANCE | 1.25–2.2·Ω | strafe, hold, reseed |
| CLOSE | 2.2–5.0·Ω | walk in, do not sprint |
| RUSH | > 5.0·Ω | sprint/charge in |

Reference `Ω` values: INFANTRY 2.4 m, TURTLE 2.2 m, DUELIST 2.0 m, POISE_MONSTER 4.1 m,
SWARM 1.6 m, ELITE 3.0 m.

### D. The state machine — full transition table

States: `IDLE, PATROL, SUSPICIOUS, SEARCH, RUSH, APPROACH, CIRCLE, FEINT_STEP, COMMIT,
RECOVER, REPOSITION, PUNISH_READ, BLOCK_HOLD, STAGGER, DISENGAGE, LEASH_RETURN, DEAD`.

| # | From | To | Condition | Min dwell in `From` | Transition cost / notes |
|---|---|---|---|---|---|
| T01 | IDLE | PATROL | patrol route assigned, 2.0 s ±0.5 idle elapsed | 60 f | — |
| T02 | IDLE/PATROL | SUSPICIOUS | `alert` ≥ 50 | 0 f | plays 18 f head-turn tell, audible grunt |
| T03 | SUSPICIOUS | IDLE/PATROL | `alert` < 20 for 2.0 s | 90 f | returns to route node |
| T04 | SUSPICIOUS | SEARCH | `alert` ≥ 50 held 1.5 s, no LOS | 90 f | walks last-known-position, not player position |
| T05 | SUSPICIOUS/SEARCH | AGGRO entry (→RUSH/APPROACH) | `alert` = 100 | 0 f | mandatory 20–30 f aggro roar/stance-change; **enemy may not attack during it** |
| T06 | SEARCH | LEASH_RETURN | 12.0 s in SEARCH with no re-acquire | 720 f | — |
| T07 | AGGRO entry | RUSH | `dist > 5.0·Ω` | 0 f | sprint gait |
| T08 | AGGRO entry | APPROACH | `dist ≤ 5.0·Ω` | 0 f | walk gait |
| T09 | RUSH | APPROACH | `dist ≤ 5.0·Ω` | 12 f | must decelerate over ≥ 10 f, no instant stop |
| T10 | APPROACH | CIRCLE | `dist ≤ 2.2·Ω` | 15 f | — |
| T11 | CIRCLE | CIRCLE (reseed) | strafe timer expires | 48–96 f | reseed direction; seeded PRNG (RI-AI04 §D) |
| T12 | CIRCLE | FEINT_STEP | `token == true` AND cooldown expired AND `dist ≤ 2.2·Ω` | 24 f min in CIRCLE | — |
| T13 | FEINT_STEP | COMMIT | `dist ≤ 0.85·Ω` reached within 36 f | 6 f | this is the "step in, then swing" |
| T14 | FEINT_STEP | CIRCLE | 36 f elapsed without reaching STRIKE | 36 f | **token released**, +0.6 s cooldown; this is the fake-out the player learns to bait |
| T15 | COMMIT | RECOVER | attack `phase` leaves `active` | attack-length | — |
| T16 | RECOVER | CIRCLE | recovery frames exhausted, `dist > 0.85·Ω` | recovery-length | token released |
| T17 | RECOVER | COMMIT | string continuation selected (RI-AI04) | recovery-length | token retained; max chain length per RI-AI04 |
| T18 | CIRCLE/APPROACH | BLOCK_HOLD | shield-bearing archetype AND player `state == ATTACK_WINDUP` AND `dist ≤ 1.4·Ω` | 10 f | TURTLE only; ≤ 2.5 s max, then forced to CIRCLE |
| T19 | any non-COMMIT | STAGGER | `poise_cur ≤ 0` | 0 f | hitstun per frame-data item; poise regen begins after |
| T20 | COMMIT | STAGGER | `poise_cur ≤ 0` AND move lacks hyperarmour | 0 f | hyperarmour flag is per-move, declared in the statblock |
| T21 | STAGGER | CIRCLE | hitstun frames exhausted | hitstun-length | 8 f guaranteed non-attacking buffer after |
| T22 | any AGGRO | PUNISH_READ | player `state ∈ {HEAL, ITEM, LONG_RECOVERY}` AND `dist ≤ 6.0·Ω` | 0 f | closes at sprint, uses fastest gap-closer; **defines the anti-chug contract** |
| T23 | PUNISH_READ | COMMIT/RUSH | as above | 0 f | |
| T24 | any AGGRO | DISENGAGE | ranged/caster archetype AND `dist < 0.9·Ω_player` | 20 f | backstep/hop away, then re-space to preferred band |
| T25 | any AGGRO | LEASH_RETURN | `leash_dist_m > L_hard` OR (no LOS ≥ 6.0 s AND `dist > 1.6·R`) OR vertical separation > 18 m for 3.0 s | 0 f | |
| T26 | LEASH_RETURN | IDLE/PATROL | reached within 1.5 m of anchor | — | heal to full over 4.0 s **after arrival**; never invulnerable while returning |
| T27 | LEASH_RETURN | AGGRO entry | re-perceived (`alert` = 100) before arrival | 0 f | re-aggro is allowed and free |
| T28 | any | DEAD | hp ≤ 0 | 0 f | death anim ≥ 40 f, soul award on frame 1 of death |

`L_hard` (hard leash radius from `spawn_anchor`): trash 32 m, elite 45 m, ambusher 20 m,
boss = arena bounds. Never larger than the containing encounter volume.

### E. Group attack-token arbitration

| Group size (aggroed, same encounter volume) | Concurrent COMMIT tokens |
|---|---|
| 1 | 1 |
| 2 | 1 (trash) / 1 (elite) |
| 3–4 | 2 (trash) / 1 (elite present) |
| 5+ (SWARM only) | 3 |

Token holding time is capped at 3.0 s; on expiry the token is force-released and that
enemy takes a 1.2 s ±0.3 cooldown before re-requesting. Non-token holders are **not**
frozen — they must keep executing CIRCLE/APPROACH/REPOSITION so the encounter reads as
alive, not as a queue.

### F. Movement legality

| Rule | Value |
|---|---|
| Max yaw rate, free movement | 300 °/s |
| Max yaw rate, `phase == windup` | see RI-AI02 tracking table (≤ 120 °/s, cut to 0) |
| Max yaw rate, `phase ∈ {active, recovery}` | 0 °/s (hard) |
| Acceleration ramp | ≥ 8 f from 0 to walk, ≥ 14 f from 0 to sprint |
| Deceleration ramp | ≥ 10 f to stop |
| Movement source | root motion during any attack; steering only in APPROACH/CIRCLE/RUSH |
| Minimum standoff | enemy capsule may not overlap player capsule; separation force applies below 0.9 m |

## Comparison method

Harness: headless run, fixed 60 Hz, seeded PRNG, scripted player input, JSONL trace as §A.

**M1 — Perception geometry (per archetype, 8 archetypes × 24 samples).**
Spawn one enemy at origin facing +Z. Teleport a stationary, non-attacking player to a
polar grid: bearings {0,30,60,90,120,150,180}°, radii {0.5R, 0.9R, 1.1R, 1.5R}. Hold 3 s.
Record frame index of first `alert_state == "AGGRO"`.
- Compute: acquisition radius per bearing = largest radius acquiring within 3 s.
- **PASS** if acquisition at 180° bearing never occurs, acquisition at 0.9R/0° occurs in
  every trial, acquisition at 1.5R/0° never occurs.
- **FAIL** if the acquisition set is a circle (max−min radius across bearings < 15% of R):
  that is proximity aggro wearing a cone costume.

**M2 — Alert ladder exists.** From the M1 traces, for every acquisition, check that
`alert_state` passes through `SUSPICIOUS` for ≥ 30 consecutive frames before `AGGRO`,
except for the damage/ally-death instant channels.
- **FAIL** if median SUSPICIOUS dwell < 20 f, or if > 10% of acquisitions jump
  IDLE→AGGRO with no intermediate state.

**M3 — Spacing loop is real (the headline check).**
Scripted player: aggro one enemy, then hold position and never attack for 60 s.
From the trace, compute over frames where `alert_state == "AGGRO"`:
- `dist_m` time series → **`spacing_variance`** = stdev of `dist_m` over the window.
- `min_dist_dwell` = fraction of frames with `dist_m < 0.85·Ω` while `state != COMMIT`.
- `state_entropy` = Shannon entropy over the `state` histogram (bits).
- **PASS** if `spacing_variance ≥ 0.8 m`, `min_dist_dwell ≤ 0.10`, `state_entropy ≥ 1.5 bits`.
- **FAIL (chase-bot)** if `min_dist_dwell > 0.35` — the enemy is standing inside the player.
- **FAIL (statue)** if `spacing_variance < 0.25 m` and speed_mps median < 0.2.

**M4 — Range-gated, not timer-gated attacks.**
Same 60 s trace plus a second run where the player is teleported to and held at 3.0·Ω.
- Count COMMIT entries per minute at each distance.
- **PASS** if COMMIT-per-minute at 3.0·Ω is ≤ 10% of COMMIT-per-minute at 1.0·Ω.
- **FAIL** if the enemy enters COMMIT while `dist_m > 1.6·Ω` more than twice per minute
  with a non-gap-closer move (whiffing into empty air on a metronome).
- Additional: compute the inter-COMMIT interval series. **FAIL** if its coefficient of
  variation < 0.12 — a near-constant interval means an attack timer, not a decision.

**M5 — Step-in/feint pattern.** Count transitions T13 and T14 over the 60 s trace.
- **PASS** if `T14 / (T13 + T14)` ∈ [0.15, 0.45]. Zero feints = purely committal AI;
  >0.6 = the enemy never actually attacks.

**M6 — De-aggro and leash.** Aggro the enemy, then run the player in a straight line to
80 m breaking LOS at 20 m. Continue 30 s.
- **PASS** if the enemy enters LEASH_RETURN within 8.0 s of the leash condition, reaches
  within 1.5 m of `spawn_anchor`, ends in IDLE/PATROL, and `hp` returns to `hp_max` only
  after arrival (check `hp` series: no healing while `state == LEASH_RETURN` and
  `leash_dist_m > 1.5`).
- **FAIL** if the enemy tracks the player past `L_hard`, or if it becomes invulnerable
  during return (any frame with a damage event producing `hp` delta 0 while alive).

**M7 — Turn-rate legality.** Over all traces, for every frame with
`phase ∈ {active, recovery}`, assert `yaw_rate_dps == 0` (tolerance 2 °/s for float noise).
- **FAIL** on any frame violating it. This is the instant-180° check and it is binary.

**M8 — Token arbitration.** Spawn a 4-enemy trash group. Aggro all. Over 60 s compute the
per-frame count of enemies with `state == COMMIT`.
- **PASS** if the 99th percentile of concurrent COMMIT ≤ 2 and mean ≥ 0.6.
- **FAIL** if 99th percentile ≥ 3 (gang-pile) or if non-token enemies show
  `speed_mps < 0.1` for > 50% of frames (frozen queue).

**M9 — Punish-read (anti-chug).** Script the player to drink at `dist = 5.0·Ω`.
- **PASS** if ≥ 80% of trials show a `PUNISH_READ` entry within 12 f of the heal start
  and the enemy reaches STRIKE band before the heal animation ends.

## Scoring

Each check M1–M9 scores 0/1/2 (0 = fail, 1 = marginal/tolerance-edge, 2 = pass).
Max 18.

| Total | Verdict |
|---|---|
| 16–18 | Meets the bar |
| 12–15 | Below bar — named remedy required |
| ≤ 11 | Loses outright |

**Hard fails, independent of total — any one voids the piece:**
- M7 turn-rate violation on any frame (AR-1: untelegraphed instant attack enabler).
- M3 `min_dist_dwell > 0.35` (chase-until-touching).
- M4 inter-COMMIT coefficient of variation < 0.12 (attack-on-a-timer).
- M6 invulnerable leash return.
- Any required trace field absent (fail-closed per §A).

Blind pair protocol: give the critic two anonymised 60 s `dist_m` + `state` time series
(ours, and a reference series generated from the tables in §C/§D). It must pick which one
"feels like a Souls enemy negotiating distance" before reveal.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 12 / 18 | 14 / 18 | 17 / 18 |

**Aggregation (a property of this item, not of the critic):** weighted-sum — each check 0/1/2 x weight, max 18.

## How we lose

Concrete, expected failure modes of a naive Three.js enemy:

1. **Chase-until-touching.** `enemy.position.lerp(player.position)` every frame until the
   capsules overlap, then swing from inside the player. `min_dist_dwell` ≈ 1.0. There is
   no DANCE band because there is no band logic at all.
2. **Proximity aggro.** `if (dist < 15) aggro = true` — a circle, no cone, no LOS ray, no
   alert meter. M1 detects this instantly (acquisition set is a perfect circle) and M2
   finds zero SUSPICIOUS frames. Backstabbing a sleeping enemy becomes impossible because
   nothing was ever unaware.
3. **Attack on a `setInterval`.** `if (now - lastAttack > 2000) attack()` regardless of
   range, so the enemy swings at air from 6 m and connects only by coincidence. M4's
   coefficient-of-variation check is aimed squarely at this.
4. **Instant 180° turns.** `enemy.lookAt(player)` called in the render loop, including
   during the swing, so every attack is a homing attack and spacing is meaningless.
   M7 is binary because this single line destroys the entire combat design.
5. **Homing/root-motion-less attacks.** The attack "hits" via a distance check at the
   animation's midpoint rather than a swept hitbox, so dodging is impossible and blocking
   is the only counterplay.
6. **No de-aggro.** Enemies follow forever, across the whole level, through geometry,
   accumulating into a conga line. Or the opposite failure: de-aggro at a fixed 20 m with
   instant teleport-home and full heal, which trivialises every fight (kite, reset, repeat).
7. **Leash-heal exploit inversion.** Enemy is invulnerable while walking home, so the
   player is punished for winning a chase.
8. **Gang-pile.** Four enemies, four independent AIs, four simultaneous swings, no token
   arbitration. Difficulty comes from unreadable overlap rather than from any single
   enemy being interesting.
9. **Frozen queue** (the over-correction): token arbitration implemented as "non-attackers
   stand still", producing four statues and one fighter. M8's mean-speed clause catches it.
10. **Navmesh cowardice.** The enemy refuses to path over a 0.3 m ledge or through a
    doorway, so the entire spacing loop is invisible in practice because the player can
    stand behind a crate. The spacing loop must be demonstrable on flat ground *and* the
    enemy must at minimum path to the nearest reachable point and hold there rather than
    vibrating against a wall.
11. **Vertical blindness.** No vertical component to the sight cone, so enemies aggro
    through floors and ceilings across a whole tower.
12. **Health-sponge substitution.** Someone notices the AI is boring, and instead of
    fixing §D they multiply HP by 3. This is the most likely and most damaging failure:
    it converts a design problem into a duration problem and it will pass every naive
    "is it hard?" playtest while failing every check in this file.

## Provenance note

`provenance: constructed`. The state list, transition table, band multipliers, alert
rates, token counts and all tolerances are **defined for this project**. They are not
extracted from any FromSoftware binary and must never be cited as such.

They are informed by `canonical-recall` (confidence: medium) of observed Dark Souls /
Elden Ring behaviour: enemies visibly circle at mid range rather than closing to contact;
attacks are committed with no in-swing turning; enemies reliably punish an Estus drink
from several metres away; enemies de-aggro and walk home rather than chasing infinitely;
and groups do not all attack simultaneously. Community observation supports that aggro is
sight-based with a cone and that mods exist purely to alter enemy visibility ranges
([Nexus: New Aggression Mod, DS Remastered](https://www.nexusmods.com/darksoulsremastered/mods/2)),
which corroborates the existence of per-enemy sight parameters but yields no numbers.

Where a value is a round number with a stated tolerance, treat it as a **bar to hit**,
not a fact to verify. A constructed bar we can measure beats a real number we cannot.
