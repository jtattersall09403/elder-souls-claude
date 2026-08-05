---
id: RI-AI02
title: Telegraph doctrine — minimum windup, silhouette, and tracking cutoff
kind: number
side: souls
judges: [combat.enemy.attacks, combat.enemy.animation, combat.enemy.tracking, combat.readability]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Every enemy attack in the game is a **promise made before it is kept**. The player must be
able to see, from the enemy's silhouette alone — no UI, no sound, no colour flash — which
attack is coming and roughly when, with enough lead time to choose a response and execute
it. The harder the attack hits, the longer that promise is held. And the promise must
become *unbreakable* partway through: after the tracking cutoff the swing goes where it
was aimed, not where the player now is. A game that satisfies this can be hard without
being unfair, because every death is legible in hindsight. A game that violates it
produces the single worst sentence a Souls-like can earn: "there was nothing I could do."

This item is the hardest gate in the AI area. It is largely binary, and it is the primary
site of AR-1 (Souls leakage) enforcement: an untelegraphed instant attack is an automatic
fail of the piece regardless of any other score.

## The reference artifact

### A. Attack anatomy (60 fps, frames)

```
 |<---------- windup W ---------->|<-- active A -->|<------- recovery Rc ------->|
 f0                              fW               fW+A                     fW+A+Rc
 |<-- tracking allowed -->|
                          Tc = tracking cutoff frame
 |<-- silhouette must be distinct from f_sil onward -->|
```

Definitions, all measured from the trace:
- **W (windup)** = count of frames with `phase == "windup"` for that attack instance.
- **A (active)** = count of frames with `hit_active == true`.
- **Rc (recovery)** = frames with `phase == "recovery"` until the enemy can next act.
- **Tc (tracking cutoff)** = the last frame index (relative to f0) on which
  `yaw_rate_dps > 2.0`. After Tc the attack's aim is frozen.
- **f_sil (silhouette lock)** = first frame from which the pose is uniquely classifiable
  among that enemy's moveset (see §D method).

### B. Minimum windup by severity — the core table

Severity is defined by damage as a fraction of a **reference player HP pool** for the
region the enemy belongs to (RI-AI05 assigns regions). Percentages are of that pool, not
of current HP.

| Severity | Damage (% ref HP) | Min W (frames) | Min W (ms) | Target W band | Min f_sil | Max Tc (as fraction of W) |
|---|---|---|---|---|---|---|
| S0 Chip | < 8% | 12 | 200 | 12–18 | ≤ 6 | 0.75·W |
| S1 Standard | 8–18% | 16 | 267 | 16–26 | ≤ 8 | 0.70·W |
| S2 Heavy | 18–35% | 24 | 400 | 24–38 | ≤ 10 | 0.65·W |
| S3 Devastating | 35–60% | 34 | 567 | 34–52 | ≤ 12 | 0.60·W |
| S4 Lethal (one-shot potential) | > 60% | 45 | 750 | 45–75 | ≤ 14 | 0.55·W |
| S5 Grab / instant-death | any (grab) | 40 | 667 | 40–60 | ≤ 12 | 0.50·W |
| S6 Ranged projectile | any | 24 | 400 | 24–40 | ≤ 10 | 0.70·W (aim lock at Tc) |
| S7 Delayed / bait variant | any | base W + 12 to +30 | — | see RI-AI04 | ≤ 10 | 0.50·W |

Hard floor across **all** attacks in the game, no exceptions, including bosses in phase 3
and including gap-closers: **W ≥ 12 frames (200 ms)**.

Additional hard rule: **Tc must terminate at least 4 frames before `active` begins.**
`Tc ≤ W − 4`. This guarantees a non-tracking commit window in every attack, which is what
makes a dodge *into* the swing possible.

### C. Tracking rate ceilings during the tracking window (f0 → Tc)

| Archetype tier | Max yaw rate during windup | Total yaw budget over the whole windup |
|---|---|---|
| Trash | 90 °/s | ≤ 60° |
| Elite | 120 °/s | ≤ 90° |
| Boss, standard moves | 120 °/s | ≤ 100° |
| Boss, designated "tracking move" (max 2 per phase, flagged in statblock) | 200 °/s | ≤ 180° |
| Any archetype, gap-closer/charge | 150 °/s during the *travel* segment only, 0 during the strike segment | ≤ 120° |

Yaw budget is the integral of `|yaw_rate_dps|` over the windup, in degrees. It exists so a
designer cannot satisfy the rate ceiling by tracking slowly for a very long windup and
still ending up perfectly aimed.

### D. Silhouette requirement

Every attack must be distinguishable from every other attack in the same enemy's moveset
by **pose alone** within `f_sil` frames. Operationalised as a pose-vector distance:

Let `p(e, m, f)` = the concatenated local rotations of the enemy's tell-bearing joints
(root, spine, shoulders, elbows, wrists, weapon socket), quaternion components, at frame
`f` of move `m`. Define
`D(m1, m2, f) = || p(e,m1,f) − p(e,m2,f) ||₂` over that vector.

**Requirement:** for every pair of moves in a moveset, `D(m1, m2, f_sil) ≥ 0.35` and
`D` must be **monotonically non-decreasing** from `f_sil` to the end of the windup.
(0.35 is a constructed threshold calibrated so that two visually confusable poses — e.g.
the same overhead raise differing only in grip — fall below it.)

Supplementary, non-substitutable channels (allowed, but never sufficient on their own):
weapon trail colour, voice grunt, footstep stomp, particle. If the silhouette check fails
and the audio "makes it readable", the item still fails. Deaf-player readability is the bar.

### E. Anti-pattern list — each is an automatic fail

| # | Anti-pattern | Trace signature |
|---|---|---|
| AP1 | Instant attack (`W < 12`) | any attack instance with windup frame count < 12 |
| AP2 | Tracking through the full swing | `yaw_rate_dps > 2` on any frame with `phase ∈ {active, recovery}` |
| AP3 | Tracking cutoff too late | `Tc > W − 4` |
| AP4 | Silhouette collision | `D(m1,m2,f_sil) < 0.35` for any pair |
| AP5 | Windup that does not scale with damage | S3/S4 attack with `W` below its row's minimum |
| AP6 | Teleport/blink into range with no travel telegraph | position delta > 1.2 m in a single frame |
| AP7 | Hitbox before pose (the "hit lands before the sword moves") | `hit_active == true` while animation pose distance from idle < 0.15 |
| AP8 | Hitbox after pose (lingering invisible hitbox) | `hit_active == true` on any frame > 6 f after weapon returns within 0.15 of idle |
| AP9 | Damage without a hitbox (proximity damage) | player `hp` decrease on a frame where no enemy has `hit_active == true` |
| AP10 | Windup animation shared with a non-attack (feint indistinguishable from a step) | move whose first 12 f have `D` < 0.35 to a locomotion clip |
| AP11 | Attack that begins outside the player's field of view with no audio pre-tell | COMMIT entered while enemy is outside a ±60° cone from player facing AND no audio event ≥ 12 f before `active` |
| AP12 | Variable windup with no visual difference | same `anim` id showing windup-length stdev > 3 f across instances (randomised timing masquerading as a delay-bait; see RI-AI04 — legitimate delays must be *separate seeded variants with distinct poses*) |

### F. Worked reference: `INFANTRY` (spear-and-shield Naga levy) moveset telegraphs

| Move | Severity | W | A | Rc | Tc | f_sil | Tell (silhouette) |
|---|---|---|---|---|---|---|---|
| Thrust | S1 | 18 | 3 | 26 | 12 | 6 | spear draws back past hip, shoulder squares |
| Thrust (delayed variant) | S7 | 30 | 3 | 26 | 14 | 6 | identical draw, then a visible 12 f *hold* at full cock |
| Overhead chop | S2 | 26 | 4 | 34 | 16 | 8 | weapon above head, off-hand shield drops |
| Shield bash | S0 | 14 | 3 | 20 | 10 | 5 | shield arm cocks across chest |
| Step-back thrust | S1 | 22 | 3 | 24 | 14 | 7 | rear foot plants first, torso pulls back |
| Charge (gap-closer) | S2 | 30 (18 lean + 12 run) | 5 | 40 | 24 (travel only) | 8 | full-body forward lean before any translation |

Total moveset: 6 moves. Pairwise minimum `D` at `f_sil` in this reference set: 0.41
(between Thrust and Step-back thrust — the closest pair, deliberately kept above bar by
the rear-foot plant).

## Comparison method

Harness: headless, 60 Hz, seeded, JSONL trace per RI-AI01 §A. Additionally requires the
harness to emit, on request, a **pose dump**: `{"eid":..,"anim":..,"anim_frame":..,
"joints":[[qx,qy,qz,qw],...]}` for the joint list in §D. If pose dumps are unavailable,
checks M3/M4 score 0 (fail-closed).

**M1 — Windup census (the headline measurable).**
For each enemy archetype and each boss, spawn it and drive a scripted player that stays
inside STRIKE band and never dodges, for as long as needed to sample **≥ 30 attack
instances per move** (use forced-move injection if the harness supports it; otherwise
extend the run until coverage is met, and report coverage).
For each instance compute `W` = count of `phase == "windup"` frames.
- Report per move: median W, min W, stdev W, and its declared severity.
- **PASS** if, for every move, `min W ≥ 12` and `median W ≥` the §B row minimum for its
  severity, and `stdev W ≤ 3` unless the move is a declared S7 variant.
- **FAIL** if any single instance has `W < 12`. Binary.
- **Headline number: median windup frames across all sampled attacks of an archetype;
  fail if < 14.**

**M2 — Tracking cutoff.**
Scripted player: after the enemy enters COMMIT, strafe laterally at full speed for the
remainder of the attack. Repeat 30× per move.
- Compute `Tc` = last frame with `yaw_rate_dps > 2.0`, relative to f0.
- Compute `residual_aim_error` = angle between enemy facing at first active frame and the
  bearing to the player at that frame.
- **PASS** if `Tc ≤ W − 4` in 100% of instances, `Tc / W ≤` the §B row cap in ≥ 90%, and
  the median `residual_aim_error` across strafing trials is **≥ 25°** (i.e. strafing
  actually makes the enemy miss).
- **FAIL** if median `residual_aim_error < 10°` — the attack is homing.
- **FAIL** if any frame with `phase ∈ {active, recovery}` has `yaw_rate_dps > 2.0` (AP2).

**M3 — Silhouette separation.**
Force-play each move in isolation with the enemy stationary; dump poses. For each pair of
moves in the moveset compute `D(m1,m2,f)` for f = 0..min(W1,W2).
- Report the matrix of `D` at each move's declared `f_sil`, and the frame at which each
  pair first exceeds 0.35.
- **PASS** if all pairs exceed 0.35 at or before the smaller move's `f_sil`, and `D` is
  non-decreasing thereafter.
- **FAIL** if any pair never exceeds 0.35 before `active` — two attacks that look the same.

**M4 — Blind readability panel (human-in-the-loop, blind_pair).**
Render each move's windup as a frames-only clip, cut hard at `Tc` (no active frames, no
audio, no HUD, greyscale silhouette on flat background). Present 40 clips in random order
to the critic; ask it to name the incoming move from the enemy's move list.
- **PASS** if identification accuracy ≥ 80% and no single move is below 60%.
- Also present the same panel for a reference enemy generated from §F; compare accuracy.
  If ours is more than 15 percentage points below the reference, we lose.

**M5 — Anti-pattern sweep.**
Run the full AP1–AP12 detector over every trace collected in M1/M2 plus a 20-minute
free-roam trace with an aggressive scripted player.
- Report a count per anti-pattern.
- **Any AP with count > 0 is a hard fail** and must be named individually in the verdict.

**M6 — Severity/windup correlation.**
Across the whole roster, plot `median W` against declared severity tier.
- Compute Spearman ρ between severity ordinal and median W.
- **PASS** if ρ ≥ 0.7. **FAIL** if ρ < 0.4: windup length is not tracking damage, which
  means the biggest hits are not the most telegraphed and the difficulty is noise.

**M7 — Reaction-budget sanity (cross-check with the frame-data item).**
The frame-data agent owns the player's roll startup `R_s` (frames from input to first
i-frame) and the input latency budget `L`. For every move, compute
`reaction_budget = W − Tc_min_response` where `Tc_min_response = R_s + L + 6` (6 f of
human recognition allowance).
- **PASS** if `reaction_budget ≥ 0` for 100% of moves and `≥ 6 f` for ≥ 80% of moves.
- If the frame-data item is unavailable, use `R_s = 4`, `L = 3` as placeholders and flag
  the check as provisional.

## Scoring

| Check | Weight |
|---|---|
| M1 windup census | 4 |
| M2 tracking cutoff | 4 |
| M3 silhouette | 3 |
| M4 blind readability | 3 |
| M6 severity correlation | 2 |
| M7 reaction budget | 2 |

Each scored 0/1/2 × weight. Max 36.

| Total | Verdict |
|---|---|
| 32–36 | Meets the bar |
| 24–31 | Below bar — named remedy required |
| ≤ 23 | Loses outright |

**Hard fails — any one voids the piece regardless of total (AR-1 enforcement):**
- Any attack instance with `W < 12`.
- Any frame with `yaw_rate_dps > 2` while `phase ∈ {active, recovery}`.
- Any AP1–AP12 detection.
- Median `residual_aim_error < 10°` on M2 (homing attacks).
- Pose dump unavailable → M3/M4 score 0 (this alone drops us to "below bar" at best).

## How we lose

1. **The animation *is* the attack, and it is 8 frames long.** A cheap Mixamo swing clip
   played at 1.0 speed has essentially no windup — the arm is already moving on frame 2.
   `W` comes out at 5–9 frames across the whole roster and M1 fails on every move.
2. **`lookAt(player)` inside the attack update.** The single most likely line of code in a
   naive Three.js enemy. It makes `Tc = W + A + Rc`, `residual_aim_error ≈ 0°`, and turns
   every attack into a homing attack. AP2 and M2 both fail. Rolling becomes pointless,
   and the only viable defence becomes running away — which then gets patched by making
   the enemy faster, which makes it worse.
3. **Damage applied by distance check at animation midpoint.** No swept hitbox at all;
   `if (dist < 2 && animTime > 0.4) player.hp -= dmg`. AP9 fires. There is no way to dodge
   *through* an attack, which deletes the core Souls verb.
4. **Randomised windup timing to "add unpredictability".** Someone adds
   `windup = 20 + Math.random()*20` and calls it a delayed attack. It looks identical
   frame-to-frame, so the player cannot learn it — it is noise, not a delay. AP12 catches
   it; the correct construction is separate seeded variants with a visible hold pose
   (RI-AI04).
5. **Windup length uncorrelated with damage.** Because damage numbers get tuned in a
   spreadsheet and animations get authored separately, the enemy's biggest hit ends up on
   the fastest clip. M6's ρ collapses. Players die to the move they had least warning of,
   which is the exact inversion of the doctrine.
6. **All attacks share one silhouette.** One generic "swing" animation retimed and
   retinted for four different attacks. M3 fails at 0.05–0.15 pair distance. The team will
   argue the colour of the weapon trail distinguishes them; per §D it does not.
7. **Telegraph exists but is invisible at gameplay camera distance and FOV.** Authored and
   validated in a 3-metre orthographic preview, then shipped at 8 m with a 70° FOV where
   the 6-frame shoulder rotation is 4 pixels. M4's greyscale panel must be rendered at the
   *actual* gameplay camera transform, or it is not testing anything.
8. **Telegraph carried entirely by a sound cue or a red flash.** Passes casual playtest,
   fails M4, and fails the doctrine: the promise must be in the body.
9. **Gap-closers that teleport.** The enemy "dashes" via a position lerp completed in 2
   frames because the run animation was not authored. AP6.
10. **The 45-frame boss windup that gets "sped up because testers said it felt slow".**
    Testers who have played 200 hours find every telegraph slow. The bar is not their
    comfort; it is `reaction_budget ≥ 6 f` for a first-time player (M7).
11. **Multi-hit combos where only the first hit is telegraphed** and hits 2–4 are chained
    with 4-frame gaps. Each hit in a string is an attack and each must satisfy §B
    independently — see RI-AI04, which owns string legality.
12. **Health-sponge compensation.** Windups get shortened to make the fight "tense",
    fails M1, then HP is raised to compensate for the player learning it anyway. Both
    moves are wrong; behavioural difficulty is the only legitimate lever.

## Provenance note

`provenance: constructed`. Every frame number, the 0.35 pose-distance threshold, the yaw
budgets, the severity bands, and the entire anti-pattern list are **defined for this
project**. They are not extracted from FromSoftware data and must never be cited as such.

They are grounded in `canonical-recall` (confidence: medium) of the following observed
properties of Dark Souls / Elden Ring enemies: attacks visibly wind up over a period long
enough to react to; heavier attacks wind up conspicuously longer; enemies track during the
early part of a windup and then visibly commit, allowing a strafe or roll to make a large
swing miss cleanly; attacks are distinguishable by pose (players describe moves by what
the body does, not by sound); and delayed attacks are *specific named moves* with a held
pose, not randomised timing.

The 12-frame absolute floor is a constructed decision derived from a reaction budget
argument, not a recalled value: at 60 fps, 12 frames is 200 ms, which is at the edge of
simple visual reaction time for an alerted human, and the doctrine deliberately reserves
that floor for chip-damage moves only.

Cross-dependency: `## Comparison method` M7 depends on the frame-data reference item for
player roll startup and input latency. That item is authoritative on player frames; this
item is authoritative on enemy frames. If the two disagree on the value of `R_s`, the
frame-data item wins and this item's M7 thresholds are recomputed, not re-argued.
