# The node arena is not the game after ~300 frames

`tools/lib/combat-node.mjs` states, in its own header: *"if a number measured here disagrees with
the same number measured through `window.__HARNESS`, the disagreement is a defect in this file and
the browser wins. `cmb-reach.mjs --verify` runs a sample of rows through both and fails if they
differ, so the claim is checked rather than asserted."*

**`cmb-reach.mjs --verify` does not exist.** `grep -n verify tools/harness/cmb-reach.mjs` returns
one hit and it is the comment above. The flag is silently ignored:

```
$ node tools/harness/cmb-reach.mjs --probe enemy --verify ; echo EXIT=$?
  ... ACCEPTANCE: pass
EXIT=0
```

So the critic checked it.

## 1. Where the two agree

Reach agrees exactly. `critic-w1-09-r3.mjs --probe reach` (headless Chromium, `arena_champion`,
E1 re-spawned with an explicit yaw) against `critic-w1-09-r3n.mjs --probe reach` (node arena),
0.05 m steps, 0 → 4 m:

| | browser min / max | node min / max | interior gaps |
|---|---|---|---|
| chop | 0.05 / 3.65 | 0.05 / 3.65 | none, both |
| thrust | 0.05 / 4.00 | 0.05 / 4.00 | none, both |
| combo_a | 0.05 / 2.90 | 0.05 / 2.90 | none, both |
| combo_b | 0.05 / 3.55 | 0.05 / 3.55 | none, both |
| dagger | 0.05 / 0.95 | 0.05 / 0.95 | none, both |
| straight-sword | 0.05 / 1.80 | 0.05 / 1.80 | none, both |
| spear | 0.05 / 1.75 | 0.05 / 1.75 | **1.20, 1.25** in both |
| halberd | 0.05 / 1.90 | 0.05 / 1.90 | **1.15–1.30** in both |

Contact distance at the minimum placement is 0.5987 m in both.

## 2. Where they diverge, and why

Same scenario in both (`arena_champion`, E1 at the origin facing +z, player at 0.8 m, the
`cmb-reach` turtle script, light mashed every 8 frames). Frame-by-frame diff of
`(player.hp, enemy.hp, player.state, enemy.state, distance)`:

```
identical for 194 frames
  B [196,524,2755.9,"ATK_RECOVER","REPOSITION",0.9274]   N [195,524,2755.9,"ATK_RECOVER","IDLE",0.9274]
first HP divergence at browser frame 303
final    browser: player 0 hp at frame 1653, champion on 2005.8
         node   : player 461 hp at frame 1700, champion on 1170.3
```

The cause is in `game/src/combat/enemy.js:253`:

```js
if (this.alertState === 'AGGRO') { this._steer(p, 240); b.state = 'REPOSITION'; }
```

`alertState` is written by `game/src/sim/stealth/system.js::stepPerception()`, which
`game/src/sim/step.js::stepOnce()` runs and `NodeArena.step()` does not. `NodeArena.step()` calls
`CombatSystem.step` alone; `stepOnce()` additionally runs `stepWorldCollision`, `settleWorld`,
`stepEncounters`, `stepSkillUse`, `stepNPCs`, the stealth system, `stepRoute` and `stepCamera`,
plus the one seeded RNG draw in `stepCombat` (the per-entity idle phase offset).

Consequence: **in the node arena the champion never turns to face the player between attacks.**
By frame 1700 its yaw has drifted 85.5° off the player. In the shipping game it steers at 240 °/s
every frame it is aggroed.

## 3. What that costs the piece

`tools/harness/cmb-reach.mjs --probe turtle` — the acceptance instrument this remediation is
graded on, and the source of `reports/w1-09/cmb-reach.json` — runs in the node arena. Its numbers
describe a champion that stares past the player.

The identical configuration replayed through `window.__HARNESS`, at three input phases:

```
 stand  phase  seconds  player died  enemy killed  damage taken   champion hp left
  0.4     0      27.6      true         false       620/620        2000/2876
  0.4     1      33.7      true         false       620/620        1628/2876
  0.8     0      27.6      true         false       620/620        2006/2876
  1.0     0      27.6      true         false       620/620        2006/2876
  1.1     0      27.6      true         false       620/620        2006/2876
  1.5     0      27.6      true         false       620/620        1937/2876
  2.0     0      33.7      true         false       620/620        1691/2876
  2.6     0      33.7      true         false       620/620        1691/2876
```

`reports/w1-09/cmb-reach.json` for the same distances: *player survives, champion dies, 46–90 %
damage taken.* Both cannot be true. The browser is the game.
