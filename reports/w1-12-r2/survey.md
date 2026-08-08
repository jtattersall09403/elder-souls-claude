# W1-12 round 2 — enemy behaviour

Against `corpus/90-verdicts/wave1/W1-12-r1.md` (FAIL, 3/10). Base commit `09e11d0`.
Every number below is fixed-step geometry, a state count or a trace hash from the shipping combat
modules stepped in bare Node (`tools/lib/combat-node.mjs`). **No timing figure appears anywhere in
this document**, so contention cannot move any of it (RULES 26).

Instruments: `tools/combat/w1-12-r2-probe.mjs` (`--mode=chase|census|yaw|states`),
`tools/combat/w1-12-r2-teardown.mjs`, `tools/combat/w1-12-r2-chart.mjs`,
`tools/combat/check-ai-units.mjs`. The round-1 critic's own tool
(`tools/combat/critic-w1-12-census.mjs`) is untouched and was re-run at every step.

---

## 1. The headline: an enemy that wants you can now reach you

The README's sentence, measured. One `inf_trash`, player walking away in a straight line at the
game's own 2.0 m/s, from 12 m, 1,200 frames, seed 1337, **same tree, same process, one leaf of
`ai.json` apart**:

| | closest approach | RUSH frames | frames inside the strike band |
|---|---|---|---|
| round 1 — sprint gated on the distance band | **9.11 m** | 35 | **0** |
| round 2 — sprint gated on whether you are leaving | **1.61 m** | 385 | **294** |

Strike band is 0.85·Ω = 2.04 m. The picture is
`docs/shots/2026-08-08-w1-12-r2-an-enemy-catching-a-walking-player.png`; both lines on it are that
run.

### The closure rule, stated

> An enemy measures **how fast the player is moving away from it** — the player's own displacement
> over the last `movement.rush_closure_window_f` (30 f@60) frames, projected onto the line between
> them. Call that `r`. Walking in at the archetype's `walk_mps` would then close the gap at
> `walk − r`. **If that is less than `movement.walk_in_min_closure_mps` (0.5 m/s), walking in is
> pointless and the enemy sprints** — whatever distance band it is in — until it is inside its own
> strike band or the player stops receding. Distance still decides *where* the enemy wants to be;
> recession decides whether the player is fighting or leaving.

The threshold is per-archetype without a per-archetype table, because it is derived from the
archetype's own walk: POISE_MONSTER (walk 1.7) starts running at a target receding above 1.2 m/s,
BEAST (walk 2.6) not until 2.1. A slow enemy has to commit to a sprint sooner. Nothing in it was
chosen against a fixture.

### Two wrong versions were built and measured first, and both are worth publishing

**(a) The round-1 verdict's own proposed remedy — gate on CLOSURE — is not enough, and the frame
trace says why in one line.** §11 of that verdict proposes `rush_when_closure_below_mps`: track
`d(dist)/dt` and sprint when it is low. Built, measured:

```
f  29 RUSH      dist 10.96  closure -1.93   spd 0.28
f  54 APPROACH  dist 10.32  closure  0.88   spd 4.60
f  79 RUSH      dist 10.13  closure  0.80   spd 2.20
f  91 APPROACH  dist  9.74  closure  0.82   spd 4.60     ... for 358 frames
```

**Closure is a property of the pair, and the enemy's own sprint restores it.** Twelve frames after
the sprint starts working, the rule that started it reads "I am gaining now" and stops it. The
enemy flip-flops on a 37-frame cycle and closes at the *average* of its sprint and its walk: it
reached 5.10 m from 10.96 m in 358 frames and then stalled at ~4.1 m forever. A control loop whose
input is its own output oscillates. Recession — a property of the target alone — does not move
when the enemy sprints, so the sprint cannot switch itself off.

**(b) An inert fix that improved the headline while breaking M3 — rule 6's third and most
dangerous shape, shipped and caught.** The first recession implementation kept a rolling window of
the last 30 *samples*. `SoulsAI.step()` is not called on the frames a body is mid-attack — that is
what makes an enemy attack uncancellable — so after a 154-frame chop the "last 30 samples" spanned
184 real frames. Dividing that displacement by 0.5 s reported a player strolling at 1.2 m/s as
receding at ~5 m/s. Every enemy in the roster charged after every swing. The headline moved the
right way and RI-AI01 M3's `min_dist_dwell` went **0.2521 → 0.2980, with two statblocks over the
0.35 CHASE-BOT HARD FAIL**. The window now stores the frame with the sample and is dropped when it
is not contiguous; the enemy re-reads the situation after its own swing.

It was found by ablating one leaf and noticing that a fixture on which the rule should
arithmetically never fire had moved anyway. Rule 6's instruction — *check the code you wrote
actually executed, not just that the measurement improved* — is the only reason it was caught.

---

## 2. Rule 8, both halves: six things a player does, four ranges, four instants

`node tools/combat/w1-12-r2-probe.mjs --mode=chase` → `reports/w1-12-r2/chase.json`.
Seven fighting statblocks × seven player behaviours × four start ranges (4, 8, 12, 20 m) ×
1,800 frames = 196 runs. Cells are *(ranges reaching the strike band)/4* and the min-gap range.

| statblock | behaviour archetype | Ω | strike | stand | walk 2.0 | jog 3.2 | sprint 5.0 | strafe | circle | back away |
|---|---|---|---|---|---|---|---|---|---|---|
| `inf_trash` | INFANTRY | 2.4 | 2.04 | 4/4 0.69–0.71 | **3/4** 1.59–3.06 | 2/4 1.82–12.10 | 0/4 6.55–22.55 | 4/4 1.60–1.61 | 4/4 1.72–1.81 | 4/4 1.80–1.88 |
| `guard_legion` | TURTLE | 2.4 | 2.04 | 4/4 0.71–0.76 | 3/4 1.75–5.13 | 1/4 1.94–15.43 | 0/4 6.56–22.55 | 4/4 1.75–1.77 | 4/4 1.81–1.94 | 3/4 1.93–2.73 |
| `drowned_lesser` | AMBUSHER | 2.4 | 2.04 | 4/4 0.68–0.75 | **4/4** 1.47–1.93 | 2/4 1.73–10.30 | 0/4 6.55–22.55 | 4/4 1.47–1.49 | 4/4 1.66–1.73 | 4/4 1.83–1.86 |
| `drowned_greater` | POISE_MONSTER | 2.4 | 2.04 | 4/4 0.73–0.78 | 3/4 1.85–7.96 | **0/4** 3.96–19.95 | 0/4 6.56–22.56 | 4/4 1.84–1.86 | 4/4 1.91–1.98 | 0/4 2.26–5.18 |
| `beast_slitherfang` | BEAST | 2.0 | 1.70 | 4/4 0.08 | 2/4 0.92–6.45 | 3/4 1.38–8.10 | 0/4 3.46–19.44 | 4/4 0.86–1.60 | 4/4 1.03–1.36 | 4/4 0.38–1.58 |
| `champion_hist_marked` | ELITE | 2.9 | 2.465 | 4/4 0.72–0.77 | **4/4** 1.98 | **4/4** 2.22 | 0/4 6.53–22.55 | 4/4 1.98 | 4/4 1.69–2.20 | 4/4 1.92–2.33 |
| `cst_sap_speaker` | CASTER | 2.0 | 1.70 | 4/4 0.05–0.08 | **4/4** 1.65 | 3/4 1.65–4.20 | 0/4 6.56–22.56 | 4/4 1.65 | 4/4 1.54–1.65 | 4/4 1.65–1.66 |

Round 1's whole row for `walk` was **0/4, min gap 8.14 m, RUSH never entered**. It is now 23 of 28
cells. `entered_RUSH` is true on every statblock at every fleeing speed.

**What the table says that is a designed limit and not a defect.** `sprint` is 0/28 on purpose —
*an enemy you cannot outrun at a sprint is a different game*, and the piece's brief says so.
`drowned_greater` (POISE_MONSTER, sprint 3.4) cannot catch a 3.2 m/s jog: it gains 0.2 m/s and
runs out of leash first. `guard_legion` (TURTLE, sprint 4.0) catches a jogger only from 4 m,
because closing 11 m at 0.8 m/s takes 55 m of travel against a 32 m leash. Both are the archetype
choosing what it is. The arithmetic is published rather than tuned away.

### The second half of rule 8 — one instant is a still target in time

`inf_trash`, walking player, start 12 m. **The same run, at four instants:**

| f@60 | 300 | 600 | 1200 | 1800 |
|---|---|---|---|---|
| gap | 1.83 m | 2.01 m | **24.31 m** | **66.31 m** |
| state | APPROACH | RUSH | LEASH_RETURN | LEASH_RETURN |

Measured only at f1800, this enemy went from "8.14 m and cannot catch you" to "66.31 m and cannot
catch you" and the fix looks like a regression. It caught the player at f584, fought, hit its 32 m
leash and walked home while the player kept walking. Every row of `chase.json` carries all four
checkpoints for exactly this reason.

---

## 3. Variety: four bit-identical fights became seven distinct ones

`--mode=variety` on the critic's own tool, same fixture, same seed.

| | round 1 | round 2 |
|---|---|---|
| distinct behaviour shapes over 8 attacking statblocks | 5 | **8** |
| **distinct behaviours over the 7 that fight** | **4** | **7** |
| bit-identical group | `inf_trash`, `guard_legion`, `drowned_lesser`, `drowned_greater` — sha1 `1edb362ea24dde99` | none |

The cause the critic named was correct: the AI read nothing that distinguished them. All four are
`archetype: INFANTRY` with byte-identical attack tables; hp and poise differ and a state machine
does not read hp. The lever is `ai.json` §`behaviour_archetype`, a statblock-id → archetype-row
table applied to **behaviour only** — gait, leash tier, whether the body blocks, whether it backs
off. No stat moves: reach and sight radius still come from the statblock, and hp, poise, damage,
armour, frame data and moveset are untouched.

`guard_legion` → TURTLE (it carries a `chitin_buckler`, and T18's BLOCK_HOLD is TURTLE-only);
`drowned_lesser` → AMBUSHER (shortest sight in the roster, and a 20 m leash — it does not follow
you out of the water); `drowned_greater` → POISE_MONSTER (poise 54, walk 1.7); `champion_hist_marked`
→ ELITE (45 m leash, sprint 4.8). Archetypes realised: **3 → 7** of the twelve rows.

**States reachable** (`--mode=states`, six fixtures × seven statblocks): round 1 reached nine of
RI-AI01 §D's seventeen and claimed a tenth in prose. Round 2 reaches **eleven**: `APPROACH,
BLOCK_HOLD, CIRCLE, COMMIT, DISENGAGE, FEINT_STEP, LEASH_RETURN, PUNISH_READ, RECOVER, REPOSITION,
RUSH`. `SEARCH`, `SUSPICIOUS` and `IDLE` are reachable but need a perception meter these fixtures
pin to AGGRO. `PATROL`, `STAGGER`, `DEAD` are declared unimplemented-here in `ai.json`.

---

## 4. RECOVER (T15) — and the honest number it produces

Implemented, as one call from `EnemyController.step()` on frames the body is mid-attack. **It
changes no behaviour and must not**: it renames the leaf. `SoulsAI.step()` is still unreachable for
the whole clip, so the commitment property the round-1 critic measured (47/47 swings to full clip,
0.00 °/s yaw after startup, zero frames in which the enemy could change its mind) is untouched — it
is a property of `if (b.move)` in the controller, not of the AI.

`min_dist_dwell` on the round-1 fixture and seed, `inf_trash`:

| | round 1 as scored | round 1 per T15 | round 2 shipped | round 2, RECOVER deleted (teardown arm C) |
|---|---|---|---|---|
| `min_dist_dwell` | 0.0414 | 0.2521 | **0.2521** | **0.0414** |
| RI-AI01 M3 | 2/2 | 1/2 | **1/2** | 2/2 |

**The critic's predicted number is reproduced to four decimals, and deleting the state brings the
old one back exactly.** M3 drops from 2 to 1 and that is the honest score: 623 of 736 recovery
frames sit inside 0.85·Ω because every attack in this roster carries 0.6–1.2 m of forward root
motion, so the enemy *ends* its swing standing on the player and cannot move during recovery. That
is correct Souls behaviour and it is what the punish window is made of. No statblock is anywhere
near the 0.35 chase-bot hard fail; the worst is `beast_slitherfang` at 0.1887.

**I did not tune the back-off to recover the 2.** It could be had by committing from further out or
by shortening recovery, and both would be worse play chosen to move a metric. The metric complaint
the critic filed against the corpus (§14.3 — M3's denominator should be "startup or active frames
of an attack", not "state != COMMIT") is the right fix and it is not this piece's file.

---

## 5. Dead parameters — the count

The critic's census (verified over four fixtures) named 23 leaves with no reader. Extended, not
re-derived:

| | leaves | disposition |
|---|---|---|
| `archetype.*.cone_deg` | 12 | **removed.** No reader anywhere in `game/src` at any archetype; the cone the game uses is the statblock's own `sight_cone_deg`, read by `character/encounter.js`. Every shipped statblock declares one, so a fallback here would have been dead the moment it was written. Rule 10: one owner. |
| `perception.suspicious_at` / `aggro_at` / `decay_per_s` | 3 | **removed.** `game/data/stealth/detection.json` owns them and `sim/stealth/system.js:347/385/392/397` reads them. Two copies of one model with no check they agree — rule 10 resolved by deletion, not by a checker. |
| `punish_read.react_within_f` | 1 | **moved out of the game data** into `tools/harness/ai-probe.mjs` as `PUNISH_REACT_WITHIN_F`. It is a probe's PASS threshold; a scoring bar living in the data file the thing under test reads is a bar anyone can move to pass. |
| `leash.no_los_seconds`, `leash.dist_multiple_of_sight` | 2 | **wired.** `noLosSinceF` was never assigned. `ai.js` now reads `percept_los` off the sim entity through `ctx.entityOf` — the same handle the token arbitrator already used, which `engine.js:1098` wires to `sim.findEntity`, and the same field `sim/stealth/system.js:403` writes. No second LOS model. Demonstrated by the `nolos` census fixture. |
| `leash.hard_m.ambusher`, `.boss` | 2 | **wired and now selected.** Tier resolution is `boss:true → boss`, else statblock `tier` naming a row, else the archetype's `leash_tier`. `drowned_lesser` is AMBUSHER (20 m); both `boss:true` statblocks leash at `boss`. |
| `leash.hard_m.elite` | 1 | **wired, unselected.** A tier-elite non-boss body gets 45 m; both tier-elite statblocks in the roster also declare `boss: true`, and boss wins. Reported as reachable-by-code / unselected-by-roster, in `declared_incomplete`, rather than claimed as consumed. |
| `perception.search_to_leash_frames` | 1 | **wired.** T06: 12.0 s in SEARCH with no re-acquire → LEASH_RETURN. |
| `perception.suspicious_min_dwell_f` | 1 | **wired.** T03/T04's minimum dwell before SUSPICIOUS may fall back to IDLE. |
| `commit.swarm_tokens_at_5_plus` | 1 | **wired.** The guard was a literal `omega <= 1.8` in code against a roster whose smallest reach is 2.0 — unreachable by construction. The bound is now the declared `commit.swarm_max_omega_m` (2.0), so a five-body `beast_slitherfang` pack is a swarm. |
| `movement.max_yaw_rate_windup_dps`, `max_yaw_rate_active_dps` | 2 | **wired, and they are CEILINGS.** `combat/enemy.js` hard-coded 180/45 — 1.5× the value this file declares — while RI-AI01 §F defers to RI-AI02's table. `enemy.js` now reads all three. The shipped roster never approaches them (observed early-windup max 36.0–60.9 °/s against 120), so a perturbation census correctly calls them inert; `--mode=yaw` asserts observed ≤ declared instead, and goes red when the ceiling is lowered below the observed value. |
| `archetype.*.prefers_band` | — | **wired.** T24 DISENGAGE, `cst_sap_speaker`. |
| `archetype.TURTLE.blocks` | — | **wired.** T18 BLOCK_HOLD, `guard_legion`. Round 1's `declared_incomplete` claimed *"the code path exists"*; it did not — the only occurrence of `BLOCK_HOLD` was the string inside the `AI_STATES` set. It exists now, `guard_legion` carries a shield, and `combat/resolve.js:192` tests `guardRaised && shield`, so the raised guard really blocks. |

**19 leaves removed or moved out of the game data; 10 leaves plus two archetype columns wired;
1 wired but unselected by the roster and declared as such.**

---

## 6. S22 — the ruling, and the units

`RI-AI01` was not in `REBASE-S22-REPORT.md` §Job 1, so its ~20 bare `f` figures carry no unit. The
critic could not resolve `aggro_entry_frames [20,30]` and neither could round 1. **Ruled, from the
item's own internal arithmetic** (`ai.json` §`_s22_ruling_on_RI_AI01`):

| pair in RI-AI01 | implies |
|---|---|
| T06 "12.0 s in SEARCH" ↔ min dwell "720 f" | 60 Hz |
| T04 "held 1.5 s" ↔ min dwell "90 f" | 60 Hz |
| T14 "36 f elapsed" ↔ "+0.6 s cooldown" | 60 Hz |
| T01 "2.0 s ±0.5" ↔ "60 f" | 30 Hz |
| T03 "for 2.0 s" ↔ "90 f" | 45 Hz — internally inconsistent either way |

**Ruling: `f@60`**, three pairs to one, including the largest and most precise. So the shipped roar
is 0.33–0.50 s and is correct; under `t@30` it would have to be `[40, 60] f@60` and the
announcement of the fight shipped at half length. **Reversible** — a rebase of RI-AI01 that anchors
T05 in seconds overturns it in one line. Filed against the corpus, with T01/T03 named as defects.

Caution kept from the critic: 20 f@60 = 333 ms sits 16 ms above RI-CMB12 §A's reactability floor of
19 f@60 = 317 ms. Legal, and the tightest legal window in the build.

`ai.json` now carries a document-level `"unit": "f@60"` and a machine-readable `units` block
covering every dimensioned leaf. `tools/combat/check-ai-units.mjs` fails the build if a leaf is
added without one, if a unit is outside the allowed set, if a `units` row is stale, or if
`behaviour_archetype` names a statblock or archetype that does not exist. **It caught one on its
first run** (`disengage.player_reach_m`), and `--self-test` injects three defects and asserts it
reports all three against the live tree's own baseline.

---

## 7. CONSUMPTION and delete-the-fix

See §8 of the status file for the census result and `reports/w1-12-r2/census.json`.

`node tools/combat/w1-12-r2-teardown.mjs` → `reports/w1-12-r2/teardown.json`. Six arms on scratch
copies of the tree; nothing is ever edited in the repository, so no neighbour's `git add -A` can
stage a temporary deletion. **Every arm asserts its own control moved and the tool exits non-zero
if one did not.**

| arm | cut | flee min gap | frames in strike (12 m / 4 m) | M3 dwell | distinct traces | alive? |
|---|---|---|---|---|---|---|
| **shipped** | — | 1.61 m | 294 / 627 | 0.2521 | 7/7 | 1,617 moving frames, 4 commits, 7 states |
| **A** | `ai.json enabled:false` | 13.03 m | 0 / 0 | 0 | 4 | **0 moving frames, 0 commits, one state** |
| **B** | the closure rule | **9.11 m** | 0 / — | 0.2521 | 7/7 | alive |
| **C** | RECOVER | 1.61 m | 294 / — | **0.0414** | 7/7 | alive, 6 states |
| **D** | `behaviour_archetype` | 1.61 m | 294 / — | 0.2521 | **4** | alive |
| **E** | the CIRCLE half of the closure rule | 1.80 m | 28 / **0** | 0.2521 | 7/7 | alive |
| **B+E** | both halves | 9.11 m | 0 / 0 | 0.2521 | 7/7 | alive |

**Arm A is the important one and it still holds**: the delete-the-behaviour arm collapses every
enemy to a turning statue — zero moving frames, zero commits, one state. Nothing in this piece is
inert code correlating with a pass.

**Arm E is rule 6's fourth shape and it nearly got reported as an inert clause.** On min gap alone
the CIRCLE half of the closure rule is worth 0.18 m — a number that reads as noise. On *frames
inside the strike band*, the metric that says whether the enemy can actually hit you, the same
deletion goes **627 → 0 from 4 m** and **294 → 28 from 12 m**. The min-gap instrument was the wrong
one, and both are now published. B and E are two guards for one defect and are run as a 2×2.

**No arm is inert, and each moves a different number**: B moves the headline and not M3; C moves M3
and not the headline; D moves variety and neither of the others. A fix that moved everything would
be the suspicious result.

---

## 8. What is NOT regressed — the things the critic could not break

Re-measured with the critic's own tool at every step:

- **Commitment.** `--mode=commit` unchanged in construction: `SoulsAI.step()` is still called only
  in the `else` of `if (b.move)`, and `noteAttackPhase` writes a state name and nothing else. Zero
  frames in which the enemy can change its mind.
- **M7 turn-rate legality**: 0.00 °/s on every active and recovery frame over 922 committed frames
  (`ai-probe`), and `--mode=yaw` confirms all seven statblocks inside the declared ceilings.
- **M4** 2/2 (CoV 0.1724), **M5** 2/2 (0.263), **M6** 2/2, **M8** 2/2 (p99 concurrent COMMIT 2),
  **M9** 2/2. Round 1's `ai-probe` totals are unchanged except M3, which fell from 2 to 1 for the
  reason in §4.
- **AR-1**: nothing added here reads a disposition, faction, level, bounty, wall clock, weather or
  die roll. `behaviour_archetype` maps a statblock id to an archetype name — a Souls-side term. The
  one Morrowind path into aggro named in the critic's §7 is untouched, and its ruling stands.
- `npm run gate` passes on this tree.

---

## 9. What I could not do (RULES 26)

- **No browser.** `node tools/contention.mjs --gate` returned GO at the start and **WAIT** (at or
  over the box's ceiling) at every poll afterwards. RI-AI01 **M1 and M2 are therefore still not
  independently measured by this round** — they need the stealth perception meter, which the
  bare-Node arena does not run, and `ai-probe.mjs` scores them fail-closed 0 rather than computing
  them off a meter it set itself. So does `ai-browser.mjs` B4, the sight-cone ablation. The
  round-1 builder's browser numbers stand unrefreshed and I did not adopt them as mine. **The
  brief said the box was quiet and told me to take these; it was not, and I did not.**
- **`ATTACK_WINDUP` is a new player state string** added to `combat/system.js::playerState()`. It
  cannot reach `PUNISH_READ` (that reads `punish_read.trigger_player_states`, which does not list
  it), so T22 is unchanged — but the change is in a file this piece shares with W1-09 and it is
  named here rather than left to be found.
- **`LONG_RECOVERY` punish (critic §5) is not fixed.** The critic measured 7/12 for the four
  INFANTRY against M9's own 80% bar, cause measured as "the enemy was already committed at trial
  start". I did not change it: the cause is *correct* Souls behaviour (a swinging enemy cannot
  punish) and the right remedy is an item-level argument about whether M9's bar should exclude
  trials in which the enemy is mid-swing. Left open and named.
- **No blind pair.** RI-AI01 specifies one; round 1 did not build it and neither did I.
- **`disengage.player_reach_m` is a declared constant, not the player's equipped reach.** Reading
  the weapon's reach across that seam for one threshold would couple the AI to the loadout.
  Declared in the file with its own note.
- **The `boss` leash is 120 m, not "arena bounds".** RI-AI01 §D says arena bounds and there is no
  arena-volume model in this build; round 1's stand-in was `1e9`, i.e. a boss that follows you
  across the province. 120 m is a ruling, not a measurement, and it is reversible.
