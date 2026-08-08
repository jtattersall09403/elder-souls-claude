# W1-12 round-1 critic — the numbers, in the one file format `reports/.gitignore` keeps

The `.json` artifacts beside this file are deliberately unversioned: `reports/.gitignore` keeps
written reports and drops machine artifacts *"because they are reproducible by re-running the
tool that made them, which is the test for whether something belongs in history."* Every table
below carries the command that regenerates it. Tools are `tools/combat/critic-w1-12-*.mjs`,
committed with this verdict. Bare Node, no browser, seed 1337, `game/data/**` at `e97347f`.

## 1. RI-AI01 M3 computed both ways — `--mode=recover`

The builder's own fixture (`p.pos = [2.6·sin(i/140), 1.9·sin(i/97+1.1)]`), 3,600 f@60.
"As scored" excludes the whole COMMIT. "Per T15" excludes only startup+active, which is what
RI-AI01 §D T15 (`COMMIT → RECOVER` when `phase` leaves `active`) makes of it.

| statblock | as scored | M3 | per T15 | M3 | recovery frames | of which inside 0.85·Ω |
|---|---|---|---|---|---|---|
| inf_trash | 0.0414 | 2/2 | 0.2521 | 1/2 | 736 | 623 |
| guard_legion | 0.0414 | 2/2 | 0.2521 | 1/2 | 736 | 623 |
| drowned_lesser | 0.0400 | 2/2 | 0.2529 | 1/2 | 736 | 623 |
| drowned_greater | 0.0411 | 2/2 | 0.2542 | 1/2 | 736 | 633 |
| champion_hist_marked | 0.0565 | 2/2 | 0.2425 | 1/2 | 600 | 583 |
| beast_slitherfang | 0.0208 | 2/2 | 0.1887 | 1/2 | 762 | 483 |
| cst_sap_speaker | 0.0443 | 2/2 | 0.1968 | 1/2 | 516 | 477 |

Yaw, same runs: max on windup 36.51–57.91 °/s, windup yaw budget 17.94–30.36°, max on
active/recovery **0.00 °/s** for all seven. RI-AI02 §C trash row is 90 °/s and ≤ 60°.

## 2. Can the enemy close on a player who leaves? — `--mode=flee`

Straight line, from 10 m, 1,800 f@60, alert pinned AGGRO.

| statblock | 2.0 m/s (walk) | RUSH? | 3.2 m/s | RUSH? | 5.0 m/s | RUSH? |
|---|---|---|---|---|---|---|
| inf_trash | 8.138 m | **no** | 11.626 | yes | 12.550 | yes |
| guard_legion | 8.138 | **no** | 11.626 | yes | 12.550 | yes |
| drowned_lesser | 8.138 | **no** | 11.626 | yes | 12.550 | yes |
| drowned_greater | 8.138 | **no** | 11.626 | yes | 12.550 | yes |
| champion_hist_marked | 8.138 | **no** | 11.626 | yes | 12.556 | yes |
| cst_sap_speaker | 9.868 | yes | 9.904 | yes | 12.556 | yes |
| beast_slitherfang | 2.390 | yes | 9.563 | yes | 9.886 | yes |

Figures are the minimum gap reached after frame 30. None of the seven reaches strike range
against a walking player. Frame trace of the inf_trash walk arm: APPROACH at 2.20 m/s from f28
to f906 (closure 0.20 m/s), anchor distance 32.0 m at f906, `REPOSITION ↔ LEASH_RETURN`
oscillation f906–f1141, LEASH_RETURN thereafter.

## 3. CONSUMPTION — `--mode=census` then `--mode=census2`

| | leaves |
|---|---|
| behaviour leaves in `game/data/combat/ai.json` | 104 |
| moved an enemy in the duel census | 24 |
| rescued by flee / group / punish fixtures | 6 |
| **demonstrated world-side consumer** | **30** |
| archetype rows the file declares unrealised (excluded) | 45 |
| **no demonstrated consumer across four fixtures** | **29** |

Controls: `circle.preferred_band_multiple` moved the trace (must); `archetype.TURTLE.omega_m`
did not (must not). Rescued: `bands.close`, `commit.tokens_by_group[1].max_size`,
`commit.tokens_by_group[2].tokens`, `commit.tokens_when_elite_present`, `leash.hard_m.trash`,
`leash.return_heal_seconds`.

Still no consumer: `perception.suspicious_at`, `.aggro_at`, `.decay_per_s`,
`.search_to_leash_frames`, `.suspicious_min_dwell_f`; `movement.max_yaw_rate_windup_dps`,
`.max_yaw_rate_active_dps`; `commit.token_hold_cap_f`, `.tokens_by_group[0].max_size`,
`[0].tokens`, `[1].tokens`, `[2].max_size`, `.swarm_tokens_at_5_plus`; `leash.hard_m.elite`,
`.ambusher`, `.boss`, `.no_los_seconds`, `.dist_multiple_of_sight`;
`punish_read.band_multiple`, `.react_within_f`; `archetype.{INFANTRY,CASTER,BEAST}.
{omega_m, sight_r_m, cone_deg}`.

## 4. Variety — `--mode=variety`

Distinct behaviour shapes across the eight statblocks carrying attacks: **5**, one of which is a
99,999-hp fixture. Four across the seven that fight.

| statblock | archetype | hp | Ω | spacing var | dwell | commits | CoV | feint ratio |
|---|---|---|---|---|---|---|---|---|
| inf_trash | INFANTRY | 412 | 2.4 | 1.8600 | 0.0035 | 4 | 0.2842 | 0.7143 |
| guard_legion | INFANTRY | 520 | 2.4 | 1.8600 | 0.0035 | 4 | 0.2842 | 0.7143 |
| drowned_lesser | INFANTRY | 260 | 2.4 | 1.8600 | 0.0035 | 4 | 0.2842 | 0.7143 |
| drowned_greater | INFANTRY | 640 | 2.4 | 1.8600 | 0.0035 | 4 | 0.2842 | 0.7143 |
| champion_hist_marked | INFANTRY | 2876 | 2.9 | 2.3531 | 0.0048 | 4 | 0.3157 | 0.7333 |
| beast_slitherfang | BEAST | 286 | 2.0 | 1.5863 | 0.0100 | 6 | 0.3469 | 0.4000 |
| cst_sap_speaker | CASTER | 380 | 2.0 | 1.5520 | 0.0012 | 2 | 0.0000 | 0.8462 |

Hashing 1,800 frames of AI state, position to 0.1 mm, yaw to 0.001° and move selection gives
**`1edb362ea24dde99`** for the first four — bit-identical fights at 260, 412, 520 and 640 hp.
All seven visit the same five states: APPROACH, CIRCLE, FEINT_STEP, COMMIT, REPOSITION.

## 5. Commitment — `--mode=commit`

Player teleported 40 m away on the frame the swing begins.

| statblock | swings | ran to declared total | max yaw after startup |
|---|---|---|---|
| inf_trash / guard_legion / drowned_lesser / drowned_greater | 7 each | 7 each | 5.000° (the retire frame only) |
| champion_hist_marked | 7 | 7 | 5.000° |
| beast_slitherfang | 8 | 8 | 5.000° |
| cst_sap_speaker | 4 | 4 | 0.000° |

**47 of 47.** Clip lengths ran exactly: chop 154/154, thrust 122/122, combo_a 72/72,
combo_b 102/102, lunge 92/92, whip 84/84, staff_jab 100/100, shoulder_turn 66/66.

## 6. PUNISH_READ, twelve settle offsets — `--mode=punish`

RI-AI01 M9's own bar is a trial rate of ≥ 80% (10/12).

| statblock | HEAL | whiffed heavy (`LONG_RECOVERY`, 78 f@60) | enemy already committed at trial start |
|---|---|---|---|
| inf_trash | 12/12 | **7/12** | 7/12 |
| guard_legion | 12/12 | **7/12** | 7/12 |
| drowned_lesser | 12/12 | **7/12** | 7/12 |
| drowned_greater | 12/12 | **7/12** | 7/12 |
| champion_hist_marked | 12/12 | 10/12 | 8/12 |
| beast_slitherfang | 12/12 | 11/12 | 4/12 |
| cst_sap_speaker | 12/12 | 12/12 | 4/12 |

## 7. S22 unit audit — `node tools/combat/critic-w1-12-s22.mjs` (exits 1)

`ai.json` declares no document-level `unit` field. 13 frame-valued leaves; 8 carry no
machine-readable unit; **5 have neither a unit nor a seconds anchor in RI-AI01**.

| leaf | value | unit? | at 60 Hz | if `t@30` | RI-AI01 seconds anchor |
|---|---|---|---|---|---|
| perception.aggro_entry_frames | [20,30] | no | 0.33–0.50 s | 0.67–1.00 s | **none** |
| perception.search_to_leash_frames | 720 | no | 12.00 s | 24.00 s | T06 |
| perception.suspicious_min_dwell_f | 90 | no | 1.50 s | 3.00 s | T03, T04 |
| movement.accel_frames_to_walk | 8 | no | 0.13 s | 0.27 s | **none** |
| movement.accel_frames_to_sprint | 14 | no | 0.23 s | 0.47 s | **none** |
| movement.decel_frames_to_stop | 10 | no | 0.17 s | 0.33 s | T18 |
| circle.reseed_frames | [48,96] | no | 0.80–1.60 s | 1.60–3.20 s | **none** |
| commit.feint_step_max_frames | 36 | yes | 0.60 s | 1.20 s | T14 |
| commit.feint_min_circle_dwell_f | 24 | yes | 0.40 s | 0.80 s | **none** |
| commit.feint_release_cooldown_f | 36 | yes | 0.60 s | 1.20 s | T14 |
| commit.token_hold_cap_f | 180 | yes | 3.00 s | 6.00 s | §E's 3.0 s |
| commit.token_cooldown_f | [54,90] | yes | 0.90–1.50 s | 1.80–3.00 s | §E's 1.2 ± 0.3 s |
| punish_read.react_within_f | 12 | no | 0.20 s | 0.40 s | **none** |

## 8. Delete-the-fix, on `cp -r game tools` into the scratchpad

| arm | result |
|---|---|
| `ai.json` `"enabled": false` | every statblock → one state (REPOSITION or IDLE), 0 commits, 0 feints, entropy 0 |
| REPOSITION back-off deleted, builder's fixture | `min_dist_dwell` 0.0414 → **0.107**, M3 2/2 → 1/2 |
| REPOSITION back-off deleted, my fixture | `min_dist_dwell` 0.0035 → 0.0049 |
| stagger an enemy out of a mid-swing COMMIT (4-body group) | token **not** leaked; victim re-enters CIRCLE, final held tokens 1/4 |

`git status --porcelain -- game/src/combat/ game/data/combat/` and `git diff --cached
--name-only` were empty before and after every arm (RULES 17).
