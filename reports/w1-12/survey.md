# W1-12 — enemy AI and encounter composition: the survey, before anything was built

**Commit surveyed:** `107c1b3`. Every number below was taken offline — source and data only, no
browser, no engine — because at the start of this piece `pgrep -c headless_shell` returned 18 at
loadavg 15.22, and by the end of the survey 24 at 19.19. Under RULES §21 that is the work to do.

This document is a deliverable in its own right. Two neighbouring pieces reported things that
constrain this one and one of them is severe; both turned out to be right, and one of them was
right for a reason its author did not have.

---

## 1. The headline: there is no enemy AI, and the thing standing in for it is worse than absent

`game/src/combat/enemy.js` declares its own scope in its header and keeps it exactly:

```js
export const IMPLEMENTED_AI = new Set(['none', 'hold_ground', 'scripted']);
```

The AGGRO branch of `EnemyController._idleBehaviour()` is, in full:

```js
if (this.alertState === 'AGGRO') { this._steer(p, 240); b.state = 'REPOSITION'; }
else if (this.alertState === 'SEARCH') { b.state = 'SEARCH'; }
else b.state = 'IDLE';
b.poseLocomotion('IDLE', frame);
```

`_steer` writes `b.yaw`. Nothing in that method writes `b.pos`. **The state is named for a
movement the code does not contain.** That is what the W1-07 round-1 verdict was looking at when
it reported six raiders sitting in `REPOSITION` for 1,657 consecutive frames with the distance to
the lead raider frozen at 18.20 m.

**The water builder (W1-03) is confirmed** — `game/src/engine.js` §`_settleEnemyWater` says so in
its own comment: *"there is no enemy chase/pursuit locomotion anywhere in `game/src` for this to
hook into"*. It was right to build the denial half of RI-WLD10 R5 and refuse the reacquire half.

### 1a. …but there IS one pursuit locomotion, and it is the game's actual enemy AI

`game/src/character/encounter.js::engageMember` was written by W1-07 for the narrow purpose of
making its AR-3 capture branch reachable. It is gated on `e.encounterId`.

**Every wilderness body in this world has an `encounterId`**, because
`world/population.js::_materialise()` spawns posts through `Engine.spawnEncounter()`, which
stamps it. So `engageMember` is not a corner case: it is the behaviour of every hostile the
player meets outside a scripted scenario. Its decision content, entire:

| | |
|---|---|
| `advance_mps` | 2.20, constant, every archetype |
| `engage_range_m` | 2.30 — walk straight at the player until here, then stop |
| `attack_cadence_f` | 78, constant |
| `rotation` | `['chop','thrust','combo_a','combo_b']`, fixed order |
| circling / strafing | none |
| feint or step-in | none |
| attack token | none |
| leash or de-aggro | none |

Measured against RI-AI01's own Comparison method it fails on space, not on aggression:
`tools/harness/ai-probe.mjs --behaviour=beeline` scores it **2/18 with two hard fails**, zero on
M3 (no spacing loop), M5 (no feint), M6 (no leash) and M8 (no token arbitration).

---

## 2. Aggro is a bare circle, and for two archetypes the circle is wider than the eyes

`stepEncounters` latches AGGRO on `dist <= rule.aggro_at_m` and nothing else — no cone, no line
of sight, no light, no Sneak, no meter. It sets `alert = 100; alertState = 'AGGRO'` in one frame.

RI-AI01 M1 fails a build outright for this: *"FAIL if the acquisition set is a circle … that is
proximity aggro wearing a cone costume."* M2 fails it again for jumping IDLE→AGGRO with no
SUSPICIOUS dwell. And the circles do not even match the statblocks they belong to:

| encounter | `aggro_at_m` | statblock | its `sight_radius_m` |
|---|---|---|---|
| `wl-slitherfang-lone` / `-pack` / `-swarm` | **20** | `beast_slitherfang` | **16** |
| `wl-drowned-straggler` | **16** | `drowned_lesser` | **14** |
| `wl-fen-sentry` | 16 | `inf_trash` | 16 |
| `wl-legion-picket` | 16 | `guard_legion` | 18 |
| `wl-deep-drowned-anchor` | 14 | `drowned_greater` | 14 |

A slitherfang notices you from four metres beyond its own sight radius, from directly behind,
through geometry, in the dark, while you are crouched. **Nothing in this world can be sneaked
past**, which makes this a finding for `RI-STL01` (in this piece's judge set) as much as for
`RI-AI01`. W1-15 built a real perception model with light, sound, LOS and Sneak; on the wilderness
roster it is overwritten by a radius check one frame later.

---

## 3. The dead road: 446 HP in four hits, then 5,310 m of nothing

The population critic's finding is real and this is the mechanism. Three things compound.

**(a) Nothing in this game can catch a player who is not walking.**

| | m/s |
|---|---|
| enemy pursuit — `ENGAGE.advance_mps`, the only one that exists | **2.20** |
| player walk (`game/src/sim/state.js` `PLAYER_CONST`) | 2.00 |
| player jog | 3.20 |
| player sprint | 5.00 |

Closure against a *walking* player is 0.20 m/s. From a 16 m aggro to the 2.30 m engage range is
13.7 m, so **68.5 seconds and 137 m of road before the first swing is even possible.** Against a
jogging player closure is −1.0 m/s and against a sprinting player −2.8 m/s: the enemy falls
behind and never returns. The critic's probe walked (`walkRoute` defaults to `speed: 'walk'`,
stick magnitude 0.55 = 2.0 m/s), which is the only speed at which the road can fight back at all.

**(b) Every swing costs the enemy ground it cannot recover.** `engageMember` opens with
`if (b.move) return;` — correct, commitment is seam S1 — so the enemy is stationary for the whole
animation while the player keeps walking. `inf_trash`'s attacks are 154 / 122 / 72 / 102 frames,
so one swing hands back 2.4–5.1 m, which then takes 12–26 s to close at 0.20 m/s. **After the
first hit, a walking player is never hit again by the same enemy.**

**(c) The post is then deleted out from under the chase.** `population.js` step (3) releases on
the distance from the **post anchor**, not from the chasing body:

```js
const p = this.byId.get(id);
if (Math.hypot(p.x - px, p.z - pz) <= rel) continue;   // rel = 260
this.releasePost(engine, id);
```

At 2.0 m/s the player is 260 m past the anchor 130 s after passing it. The chase needs 68.5 s to
reach swing range. **The whole fight has to fit in the ~60 s remaining, and then the enemy is
despawned mid-swing.** 689 − 479 = 210 m is one such window, at one walking speed, almost exactly.

This is not the population data's fault: 144 posts, offset 5–14 m from the road, separation 26 m,
0.88 encounters per traversal minute. The posts are there and they spawn. They cannot reach you.

---

## 4. The roster: three of RI-AI05's ten archetypes, no boss

Seven statblocks carry attacks; the other fifteen files are camera props and material dummies.

| statblock | archetype | tier | hp | attacks |
|---|---|---|---|---|
| `inf_trash` | INFANTRY | trash | 412 | 4 |
| `guard_legion` | INFANTRY | trash | 520 | 4 |
| `drowned_lesser` | INFANTRY | trash | 260 | 4 |
| `drowned_greater` | INFANTRY | trash | 640 | 4 |
| `beast_slitherfang` | BEAST | trash | 286 | 2 |
| `cst_sap_speaker` | CASTER | elite | 380 | 2 |
| `champion_hist_marked` | INFANTRY | elite | 2876 | 4 |

**Unrealised: TURTLE, DUELIST, POISE_MONSTER, RANGED, AMBUSHER, SWARM, ELITE, BOSS, GANK_DUO.**
Four of the seven are the same INFANTRY chassis with a different HP number. `champion_hist_marked`
is labelled `elite` but is an INFANTRY at 7× the HP — RI-AI05 §D's lever 6 (*"HP inflation beyond
the band is the health-sponge failure"*) used in place of lever 1 (a new archetype). RI-AI05's own
sentence for this is: *"adding a skin is not adding content; adding a question is."* This roster
asks one question — *can you fight one melee infantryman?* — in five costumes.

Also: RI-AI05 §B's minimum of **one ELITE per region** and RI-AI06's boss are both absent, and no
statblock declares `archetype: BOSS`. Note also that `beast_slitherfang` is placed by
`wl-slitherfang-pack` and `-swarm` but its archetype string is BEAST, for which RI-AI01 §C has no
row at all.

---

## 5. Instrument defects found in the survey, all of which would have flattered a verdict

These matter more than any of the above, because each one is a probe that could not go red.

**5a. `los` in the enemy trace record has always been the constant `true`.** `sim/record.js` had
two keys named `los` in one object literal — `los: e.percept_los` at line 245 and `los: true`
twenty lines below. The later wins. The occlusion field W1-15 added so *"a wall can be seen to be
doing something"* was dead on arrival. RI-AI01 §A lists `los` in its field contract; a field that
is present and always affirmative is worse than a missing one, because it scores.

**5b. `speed_mps` and `yaw_rate_dps` were never written for any combat-driven enemy.**
`sim/combat-bridge.js::mirror()` copies pos, state, anim, phase, yaw, hp, poise and hitboxes —
and not those two. Only `sim/entities.js`'s legacy `hold_ground`/`none` paths ever set them. So
for every scripted enemy and every encounter member in the game both fields read 0 forever. That
makes **RI-AI01 M7 — the binary, hard-fail, instant-180° turn-rate check — unfalsifiable**, and it
satisfies M3's STATUE clause (`speed_mps median < 0.2`) with a field nobody wrote.

**5c. `tools/lib/combat-node.mjs` ran a different player from the game.** It declared
`jog_mps: 4.4, sprint_mps: 6.6`; `game/src/sim/state.js` says 3.2 and 5.0. Its own header says a
disagreement with the browser "is a defect in this file and the browser wins". A 37% faster jog is
that defect sitting in exactly the question this piece asks — whether an enemy can catch a player
who is running away.

**5d. The anti-chug contract was wired to a move kind that does not exist.** The first draft of
`ctx.playerState()` tested `b.move.kind === 'flask'`; `moves.js` builds `kind: 'heal'`. RI-AI01
T22's PUNISH_READ would have been permanently unreachable. It was found only because M9 was
written to begin a *real* heal on the *real* body rather than to inject the string the AI reads —
a fixture that supplies the answer cannot find this.

**5e. RI-AI01 M4's coefficient-of-variation test does not detect this build's attack timer.**
This is a gap in the ITEM, not in the build, and it is reported rather than exploited. M4 hard-fails
a build whose inter-COMMIT interval has CoV < 0.12, on the reasoning that a near-constant interval
means a timer rather than a decision. `engageMember` has a single constant `attack_cadence_f: 78`
— a pure timer — and it scores **CoV ≈ 0.3, a comfortable pass**, because 78 frames is shorter than
three of the four rotated attacks (154/122/72/102 f). The enemy is always still swinging when its
timer expires, so the interval is set by whichever animation is playing, and a fixed rotation of
differently-lengthed moves manufactures variance out of no decision at all. **A critic scoring M4
off a trace would clear the most timer-driven enemy in the project.** The check that does separate
the two behaviours is M3, and that is the right answer: the difference between a beeline and a
Souls enemy is not how often it swings, it is where it stands between swings.

---

## 6. RULE 8, demonstrated rather than agreed with

`ai-probe.mjs --still` runs the identical checks against a player who does not move. Same code,
same seed, same 3,600 frames; only the fixture differs. On M3, the headline check:

| arm | fixture | `spacing_variance` | `min_dist_dwell` | `state_entropy` | M3 |
|---|---|---|---|---|---|
| beeline | **still** | 1.542 | 0.000 | 0.249 | 0/2 |
| beeline | moving | 1.238 | 0.000 | 0.636 | 0/2 |
| souls | **still** | 1.972 | **0.103** | 1.945 | **1/2** |
| souls | moving | 1.746 | **0.041** | 2.020 | **2/2** |

The still fixture **flatters the beeline** (its spacing variance rises 25%, because a stationary
player still drifts under separation force and the chaser copies it) **and penalises the real AI**
(its dwell more than doubles, because a concentric circle around a fixed point never leaves the
band). It moves the treatment across a scoring boundary in the wrong direction. Neither effect is
large enough to notice and both are large enough to matter, which is the whole of RULES §8.

---

## 7. What this piece then built, and what it did not

Built: `game/data/combat/ai.json` (RI-AI01 §B–§F parameter tables, a new file so that
`game/data/combat/enemies/` — claimed by W1-03 — is untouched), `game/src/combat/ai.js` (the §D
transition table), the wiring in `combat/enemy.js` / `combat/system.js` / `engine.js`, the
`engageMember` yield in `character/encounter.js`, the sight-cone gate on wilderness aggro, the two
trace-field repairs, and `tools/harness/ai-probe.mjs` with a `--selftest` that exits non-zero
unless the control arm goes red.

**Not built, declared rather than discovered** (see `declared_incomplete` in `ai.json`):

- **PATROL (T01).** No patrol route data exists for wilderness posts. Implementing it against a
  route set that does not exist would be a stub that passes.
- **Attack strings (RI-AI04, T17).** The moveset data declares no strings to select.
- **BLOCK_HOLD (T18)** is implemented and unreachable: TURTLE-only, and no statblock is a TURTLE.
- **Mid-fight save/load of AI timers.** `save/state.js` is not this piece's file and was not
  extended; a load resets an enemy to CIRCLE with a fresh strafe timer.
- **The roster gap in §4 is not closed.** Seven archetypes have parameter rows and no statblock.
  Writing statblocks would mean writing into a directory two other live pieces are near, and
  RI-AI05's bar is a set of *questions*, which is a content decision this piece should not take
  alone. It is named here so it is somebody's.
- **The pursuit-speed problem in §3a is only half fixed.** `souls` archetypes now RUSH at their
  own declared sprint (INFANTRY 4.6 m/s), which beats a jogging player and loses to a sprinting
  one — deliberately, because a Souls enemy you cannot outrun is a different game. But the road's
  arithmetic in §3c is `world/population.js`'s release rule, and that file belongs to
  W1-POPULATION. **A chasing enemy is still despawned when its ANCHOR passes 260 m**, not when the
  enemy does. That one-line change was not made here.

---

## 8. The browser half — the claims bare Node is not allowed to make

`tools/lib/combat-node.mjs` runs **no stealth perception**, so an enemy's `alertState` there is
whatever the probe assigned it. Everything about how an enemy *notices* you is unmeasurable in
the arena, and `ai-probe.mjs` scores M1 and M2 as a fail-closed 0 with `browser_required: true`
rather than computing them off a meter it set itself. `tools/harness/ai-browser.mjs` measures
them in the shipping game.

**Load, declared under RULES §26.** The tree carried **30–48 concurrent headless browsers at
loadavg 25.6–34.5 for the entire browser window**; it was polled for 25 minutes and never fell
below 30. This piece launched **one** browser and kept it (RULES §21), and trimmed B1's budget
from 3,600 frames to 1,200 to cost the other agents less. **No timing figure is published from
this run.** Everything below is fixed-step geometry and state counts, which contention cannot
move; the arena's 3,600-frame figures remain the headline and these are the confirmation that the
same code runs in the real engine.

### B1 — the AI runs in the real engine, and two repaired fields are alive

| | arena, 3,600 f | browser, 1,200 f |
|---|---|---|
| `spacing_variance` | 1.746 | **2.320** |
| `min_dist_dwell` | 0.041 | **0.0115** |
| `state_entropy` (bits) | 2.020 | **2.612** |
| worst yaw rate on an active/recovery frame | 0.00 | **0.000** over 222 committed frames |

State histogram: `REPOSITION 70, APPROACH 216, CIRCLE 310, FEINT_STEP 190, ATK_WINDUP 176,
ATK_ACTIVE 42, ATK_RECOVER 196`. The engine reports the *animation* states during a commit, which
the arena does not, which is why the browser entropy is higher.

The two repairs from §5 are confirmed live rather than asserted: `nonzero_speed_frames` is
**1,034 of 1,200** (before this piece the field was 0 forever), and `max_yaw_rate_dps` is
**exactly 300** — RI-AI01 §F's free-movement ceiling, hit and not exceeded. **M7 is now a check
that can fail**, and it passes.

**A new finding falls straight out of the repaired field: `max_speed_mps` is 18.211.** That is not
the AI — this AI is capped at the archetype sprint of 4.6 m/s — it is attack **root motion**,
`root_dz_m` 0.6–1.2 m consumed over a handful of active frames. An enemy's swing translates its
body at eighteen metres a second. Nobody could see this before, because the field was zero. It is
`RI-CMB04` / W1-09's number to rule on, not this piece's, and it is raised rather than absorbed.

### B2 — RI-AI01 M1, acquisition geometry, with the real perception model

| leg | result |
|---|---|
| acquisition set is a circle (the named FAIL) | **false** — passes |
| rear 180° never acquires | **true** — passes |
| beyond 1.5·R never acquires | **true** — passes |
| front, 0.9·R, acquires within 3 s | **false** — **fails** |

The *geometry* is correct and the cone is real: at 0.9·R the meter reaches SUSPICIOUS and holds it
for all 180 frames at bearings 0° and 30°, and does not move at all at 60° and beyond. What fails
is the **fill rate**. RI-AI01 §B wants 50/s at 1.0·R, i.e. acquisition in about 2 s; B3 measures
acquisition at 12 m (0.75·R) taking **330 frames — 5.5 seconds**, and at 14.4 m not happening
inside the 3 s window at all.

**This is W1-15's number, not this piece's.** RI-STL01 §1 is explicit that the stealth item owns
the multipliers on RI-AI01 §B's fill rates, and `combat/enemy.js` says in its own comment that
the meter is filled in exactly one place. It is reported here because M1 is in this piece's judge
set and scores **1/2, marginal**, on the strength of the geometry alone.

### B3 — RI-AI01 M2, the alert ladder: **2/2**

Six trials. `median_suspicious_dwell_f` **244** against a floor of 20, and `jump_fraction`
**0.000** — no acquisition anywhere jumped IDLE→AGGRO. Before this piece every wilderness
acquisition did exactly that, in one frame, on a radius check.

### B4 — the sight-cone gate: you can now walk past a sentry

One `wl-fen-sentry`, player held at 12 m — well inside its 16 m aggro circle — at three bearings:

| bearing | aggroed at |
|---|---|
| 0° (in front) | frame **188** |
| 90° (flank, outside the 120° cone) | **never**, 300 frames |
| 180° (behind) | **never**, 300 frames |

Before this piece all three aggroed, because the latch was `dist <= aggro_at_m` and nothing else.

### B5 — CONSUMPTION (RI-MTH07, mandatory)

Named consumer: `game/src/combat/ai.js`, constructed by `EnemyController` and stepped every fixed
frame from `stepCombat()`. Perturbation: double `ai.json` §`circle.preferred_band_multiple` on the
running engine, then restore it.

| arm | mean `dist_m` | sd |
|---|---|---|
| shipped | 3.2409 | 2.1162 |
| `preferred_band_multiple` ×2 | **4.4875** | 2.1157 |
| restored | **3.2409** | 2.1162 |

`changed: true` (Δ **1.247 m**), `restored_matches: true` to four decimal places. The model is
read by the running world and the delete-the-fix leg returns the old number exactly.

**And the first attempt at that leg was wrong, which is the most useful thing on this page.** Run
as `--probe=b1,b4,b5` the restored arm reported a mean of **6.49 m with a standard deviation of
137.6 m**. The model was fine; the *world* was dirty. B4 spawns a `wl-fen-sentry` **encounter**,
and what B5's reset loop swept was `listEntities()` — a leftover encounter body moved the number
this piece's entire RI-MTH07 claim rests on. The probe now despawns encounter members explicitly
and heals the player between arms (its HP fell 330 → 310 → 21 across three uninterrupted arms).
RULES §7 in one sentence: audit the running world, not the bytes — and RULES §6, because a
delete-the-fix measured against a dirty world measures nothing at all.

### Combined score, said carefully

The arena scores **14/18** with M1 and M2 fail-closed at 0 because it cannot measure them. The
browser scores M1 at **1** and M2 at **2**. Taken together that is **17/18 — "meets the bar"** on
RI-AI01's own scale, **with no hard fails**, against the pre-piece behaviour's **2/18 and two hard
fails**. No single instrument produced 17, and it is written this way rather than as one number
because the two halves measure different things and a critic should be able to see the seam.

---

## 9. A debt a neighbour named, closed — and an accidental confirmation of §4

`game/data/combat/enemies/guard_legion.json` was edited by W1-15-r3 during this session, and its
new note names this piece directly:

> *"guard_legion's `ai` is `hold_ground`, and `combat/enemy.js` only runs a scripted action for
> `ai === 'scripted'` — an AGGRO'd guard still deals 0 damage, which is W1-12's (enemy AI) to
> close, not a data field."*

`ai.json`'s override maps `guard_legion` to `souls`, and it is closed. Measured, bare Node, one
guard, 3,600 frames, moving player: behaviour resolves to `souls`, **14 commits, player HP 620 →
0.** The guard fights. No statblock was edited to do it.

And then the accident. `ai-probe.mjs --stat=guard_legion` returns `spacing_variance` **1.746**,
inter-COMMIT CoV **0.1724**, **14** commits, feint ratio **0.263** — *identical to four decimal
places* to `inf_trash`. That is not a bug in the probe. `guard_legion`'s own provenance says
*"Frames, hitboxes and moveset are inf_trash's unchanged"*, and it shares the archetype, the reach
and the sight radius. **Two enemies with different names, different HP and different armour are
the same fight, frame for frame.** §4 argued that from the statblocks; this measured it from the
traces, which is the stronger form of the same claim.
