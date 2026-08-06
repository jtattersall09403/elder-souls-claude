---
id: RI-CMB12
title: The exchange — reactability, decision divergence, and whether the fight is a decision at all
kind: number
side: souls
judges: [combat.exchange.reactability, combat.exchange.divergence]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Everything else in `corpus/10-combat/` measures whether the machine is correct. This item measures
whether the **exchange** is real from the player's chair, and it exists because the corpus was
shown, three times in a row, that correctness is not sufficient and that nothing here could tell
the difference.

`W1-09` passed frame censuses, i-frame windows, stamina curves, commitment grids, root-motion
fidelity and determinism across three critic rounds. In those same three rounds three independent
critics found, by hand:

1. a 120-second exemplar fight **in which the player was never hit at all**;
2. a boss whose correct answer was **to walk inside it and stand still**;
3. a hole in every enemy weapon arc, covered by a second volume, so that five to seven of the
   eight blows that killed a motionless player were **the champion's torso walking through them**,
   each paying the greatsword's damage.

Not one of those is visible in a frame table, and not one of them was caught by an instrument. Each
was caught by a critic being clever, one round late, and each cost a full remediation cycle. **A
bar that depends on the critic being cleverer than the bar is not a bar** — the same finding
`BAR-CRITIQUE-W1-10-R1` §R6 made about the weapons area, arriving here by a different road.

"Good" for this item means two things, and both are properties of a *moment of play* rather than of
a table:

**Legible before.** When an enemy commits to an attack, the player can see that it is coming, in
the animation, early enough to answer it. `RI-AI02` requires the *state* `ATK_WINDUP` to last a
declared number of frames. It does not ask when the character starts **looking** different. A
44-frame windup whose pose is indistinguishable from idle for 40 of those frames is a 4-frame
telegraph wearing a 44-frame label, it passes every existing check, and it is exactly what a
Three.js build produces when the windup clip is authored as a slow ease-in.

**Consequential after.** Two different decisions at the same moment produce two different
outcomes. If they do not, the fight is a cutscene with a health bar: the frames are perfect, the
stamina curve is perfect, the player is a spectator. This is the failure the project is most
exposed to and the one no statistic in this directory can see, because every statistic in `§D` of
`RI-CMB07` is computed from a *single* timeline and cannot ask what would have happened otherwise.

## The reference artifact

### A. `ES-REACT/1` — the reactability budget

For every enemy attack, three frame indices are defined against the attack's own animation:

| Symbol | Definition |
|---|---|
| `f_state` | the first frame on which the actor's state is `ATK_WINDUP` |
| `f_vis` | the **visual onset** — the first frame on which the actor's pose is distinguishable from its immediately preceding neutral or locomotion pose (§A.1) |
| `f_active` | the first frame on which `hitbox_active == 1` |

```
t_react = f_active − f_vis          (frames, f@60)
t_label = f_active − f_state        (what RI-AI02 measures today)
lie     = t_label − t_react         (frames of telegraph that are not visible)
```

**The budget.** A human's simple visual reaction time is ~250 ms; the machine's share of the input
path is `L1 + L2 + L4 ≤ 4 f@60` (`RI-CMB11` §1). Therefore:

| Quantity | Requirement | Why |
|---|---|---|
| `t_react` | **≥ 19 f@60 (317 ms)** for any attack declaring `reactable: true` | 15 f of human + 4 f of machine. An attack answerable only by memory is not answerable on sight |
| `lie` | **≤ 8 f@60** for every attack, reactable or not | A telegraph that is mostly invisible is a lie told in frame data, and every existing check reads the label |
| `reactable_share` | **≥ 0.70** of an archetype's attack set | A roster below this is a memorisation test. Souls bosses have unreactable attacks; they do not have *only* unreactable attacks |
| `t_react` spread within one archetype | **≥ 12 f@60** between its fastest and slowest reactable attack | Identical reaction budgets across a moveset means one timing answers everything, which is `RI-CMB02` §E's spread rule one level up |

An attack may declare `reactable: false` — a Souls roster needs delayed and disguised swings —
but it must declare it **in the moveset data, in advance**, and it then counts against
`reactable_share`. An undeclared attack that measures below the budget is a **defect**, not a
design choice discovered after the fact.

#### A.1 What "distinguishable" means, stated numerically so it is not a matter of taste

`f_vis` is the first frame `k` at which **either** condition holds against the actor's pose at
`f_state − 1`:

- **Pose metric.** `max` over the actor's tracked joints of the absolute angular deviation
  `≥ 12°`. Tracked joints: the weapon-holding hand, the forearm, the upper arm, the shoulder, the
  spine and the head — six, declared, the same six for every actor.
- **Silhouette metric.** Screen-space silhouette IoU against the reference pose `≤ 0.92`, rendered
  orthographically from the lock-on camera's bearing at the fight's contact distance.

Both are reported. Where they disagree by more than 4 frames, the **later** one is `f_vis`, because
the player must actually see it and the pose metric can fire on a motion no camera angle reveals.
The 12° and 0.92 figures are conventions defined by this item (see Provenance).

### B. `ES-DIVERGE/1` — decision divergence

The counterfactual test. From a Mode-B fight (`RI-CMB07` M2, `ES-PILOT/1`), sample **N = 200**
frames uniformly across the fight. At each sampled frame `f`, fork the simulation — same seed,
same state, same enemy — and run each of **K = 8** alternative player actions to a horizon of
**120 f@60**:

```
K = { roll_forward, roll_back, roll_left, roll_right, R1, R2, guard, do_nothing }
```

For each fork compute the **exchange value**

```
EV = (enemy_hp_lost − player_hp_lost) / player_hp_max
```

and from the K values at each sampled frame:

| Statistic | Definition | Band | Hard fail |
|---|---|---|---|
| **`DIV`** | mean over the N frames of the standard deviation of `EV` across the K actions | **≥ 0.06** | **< 0.02** |
| **`DIV_dominant`** | share of sampled frames at which one action's `EV` exceeds the next best by **≥ 2×** | **≤ 0.40** | **> 0.70** |
| **`DIV_dead`** | share of sampled frames at which `max EV − min EV < 0.01` — moments where nothing you do matters | **≤ 0.15** | **> 0.35** |
| **`DIV_identity`** | share of sampled frames at which the single best action is the *same* action | **≤ 0.45** | **> 0.75** |

**How to read these, because they are the point of the item.**

- `DIV ≈ 0` is a **slideshow**: frame-perfect, deterministic, and the player is not playing. Every
  number in `RI-CMB01`–`RI-CMB06` can be exactly right while this is true.
- `DIV_dominant > 0.70` is a **solved fight**. `W1-09` round 1 (nothing hits you), round 2 (stand
  still and mash) and round 3 (the torso kills you wherever you stand) are all high-`DIV_dominant`
  states, and this is the single number that would have caught all three at the round they
  appeared, without a critic having to invent the probe.
- `DIV_identity > 0.75` with `DIV_dominant` low is the **metronome**: one answer, always, but a
  cheap one. `SCORING.md` §2.1's "a 5" — the sawtooth enemy — is exactly this shape.
- `DIV_dead > 0.35` is the fight that is **dramatically dead** — `RI-CMB07` "How we lose" #7 with
  a number attached for the first time.

The test needs **no exemplar, no enemy AI and no bot tuning.** It runs against a scripted enemy in
the build that exists today, which is deliberate: every other instrument in this area that asks a
question about quality is currently blocked on a fixture the corpus has not regenerated or on a
piece that has not been built.

### C. `WCK` — the wall-clock gate, cited and not duplicated

Every statistic in `corpus/10-combat/` is a ratio of simulation frames to simulation frames, or a
count per fight. **All of them are byte-identical in a build running at six frames per second**,
because the simulation is fixed-step and the corpus never looks at the wall clock. The one item
that does — `RI-PLT01` — is not on any combat piece's item list, and `RI-CMB11` explicitly assigns
L1 and L4 away *"so that nobody assumes the other pair measured them"*. That assignment exists on
paper and nobody has been holding it.

This item makes it a **gate**, contributing no ladder score of its own:

- The verdict must cite, for the **same build**, `RI-PLT01`'s measured p50/p99 wall-clock frame
  delivery during a fight on the declared tier, and `RI-CMB11`'s `L2 == 0` result.
- **Gate fails** if p99 sim-step delivery exceeds `RI-PLT01`'s budget, or if the citation is
  absent. A combat verdict with no wall-clock citation is a verdict about a spreadsheet.
- `blocked_on_hardware` is an admissible recorded state (see `SCORING.md` §0's third honest
  exception, SwiftShader), and it must be recorded as a debt with a wave, never omitted.

### D. The feel citation — this item's link to the instruments that already exist

The corpus **does** own hit feel: `RI-WPN05` (hitstop, material, mass), `RI-CAM06` (camera feel)
and `RI-AUD01` (impact audio) jointly judge `combat.feedback.hitstop`. All three live outside
`corpus/10-combat/`, and no `W1-09` verdict has ever cited one — while `W1-09` is the piece that
owns the resolver that applies hitstop, and `W1-10`'s round-2 critic found the hitstop tables
**INERT**, read by nothing. Two pieces, one hole, no owner: `RI-MTH07` "How we lose" clause 2
predicts this exactly.

**Every verdict citing this item must therefore also report `RI-WPN05`'s `ILS` (impact legibility
score) and the resolved-hitstop consumption result for the build under test.** Not re-measure —
cite, with the artifact. A combat-core verdict that contains no number about what a hit feels like
is incomplete on its face, and eleven of them now exist.

## Comparison method

Script: **`corpus/80-methods/m-cmb12-exchange.mjs`** *(to be written; this item is the spec)*

Harness: the same headless fixed-60 Hz harness as `RI-CMB07`, plus two capabilities it does not
currently require — a **fork/restore** of full simulation state at an arbitrary frame, and a
per-frame dump of tracked joint world rotations. Both are `RI-MTH01` surface additions and are
named here so they are built rather than assumed. **If fork/restore does not exist, M2 scores 0,
fail-closed** — a counterfactual you cannot run is not a measurement.

**M1 — Reactability census.** For every attack of every enemy archetype in the build:
1. Play the attack from the actor's idle pose and from its walk pose, in separate runs.
2. Dump tracked joint rotations and the orthographic silhouette per frame.
3. Compute `f_vis` by both metrics of §A.1, `f_state`, `f_active`, `t_react`, `t_label`, `lie`.
- **FAIL** any attack with `reactable: true` and `t_react < 19 f@60`.
- **FAIL** any attack with `lie > 8 f@60`, reactable or not.
- **FAIL** if `reactable_share < 0.70` for any archetype.
- **FAIL** if the within-archetype `t_react` spread is below 12 f@60.
- Report the full per-attack table and the pose-delta curve for the three attacks with the
  largest `lie`. Those three curves are the diagnostic artifact and belong in the verdict.

**M2 — Divergence.** Per §B, N = 200, K = 8, horizon 120 f@60.
- **FAIL** on any band violation; **HARD FAIL** on any hard-fail threshold.
- **FAIL** if any two forks from the same sampled frame with the same action produce different
  results — the fork must be deterministic or the whole measurement is noise. Run 20 of the 200
  twice and hash.
- Report the `EV` matrix for the 5 sampled frames with the highest and 5 with the lowest spread.
  The low-spread frames are the ones to look at: they are where the game stops being a game.

**M3 — The dominance witness.** For the action that dominates most often, name it, and report the
share of the fight over which it wins.
- **FAIL** if the dominant action is `do_nothing` on more than **5%** of sampled frames. A fight
  in which standing still is the best available decision more than one time in twenty is the
  turtle, and it has now been shipped twice.

**M4 — Wall-clock gate.** Per §C. Cite; do not duplicate.

**M5 — Feel citation.** Per §D. Cite `RI-WPN05` `ILS` and the hitstop consumption result.
- **FAIL** if absent, or if `ILS` is `unmeasurable`, or if the resolved hitstop coupling is 0.

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3)

The models this item requires to act are the **windup clips** (M1) and the **action set the
counterfactual forks over** (M2). Enumerate both, perturb and observe per `RI-MTH07` §B with the
null control, and apply the binary consequence: any `coupling == 0` scores that dimension 0. In
particular, perturbing a windup clip's early frames must move `f_vis` and must **not** move
`f_active` — if it moves both, the telegraph and the frame table are the same authored number and
M1 is measuring itself.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 reactability census | 35 | Every attack inside the `ES-REACT/1` budget; `reactable_share` and spread satisfied |
| M2 divergence | 45 | All four `ES-DIVERGE/1` statistics inside band, forks deterministic |
| M3 dominance witness | 10 | `do_nothing` dominant on ≤ 5% of sampled frames |
| M5 feel citation | 10 | `ILS` and hitstop consumption cited from the same build, both non-zero |
| M4 wall-clock gate | **gate** | Cited and inside `RI-PLT01`'s budget, or recorded `blocked_on_hardware` with a wave |

- **≥ 90** — parity. The exchange is legible and consequential.
- **70–89** — gap named, remediable.
- **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - `DIV < 0.02` — the player's decisions do not change the outcome. Whatever the frame data says,
    this is not a fight;
  - `DIV_dominant > 0.70` — the fight is solved, and shipping it means shipping the solution;
  - `DIV_dead > 0.35`;
  - `DIV_identity > 0.75`;
  - `do_nothing` dominant on more than 5% of sampled frames;
  - any attack with `lie > 20 f@60` — a telegraph more than a third of a second longer in the
    label than on the screen is a frame table describing an animation that does not exist;
  - the wall-clock gate absent from the verdict without a recorded `blocked_on_hardware`.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2.** Derived from this item's own
bands above.

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights,
max 100, with M4 as a gate that zeroes the item when it fails rather than contributing weight.

## How we lose

1. **`DIV` is measured once, on the happy path, and reported as a scalar.** The mean hides the
   dead frames, which are the interesting ones. §B requires the low-spread sample dump precisely
   because the average of a good fight and a cutscene looks like an adequate fight.
2. **The fork is not really a fork.** A "fork" implemented as "re-run from the start with a
   different input at frame `f`" is legitimate but expensive, and someone will approximate it with
   a shallow copy that shares the enemy's state object. Then every action produces the same
   outcome, `DIV` reads 0, and the item fires its hard fail on an instrument bug. The determinism
   re-run in M2 exists for this and must be reported, not asserted.
3. **`reactable: false` becomes the answer to every failure.** The moment M1 starts failing, the
   cheapest fix is to declare the offending attacks unreactable. `reactable_share ≥ 0.70` is the
   tripwire, and it is why the flag must live in the moveset data and be diffed between rounds.
4. **The pose metric fires on a twitch.** 12° on a finger joint is not a telegraph. The six tracked
   joints are named in §A.1 and the silhouette metric is the cross-check; where they disagree the
   later frame wins, so a build cannot buy `f_vis` with an early micro-motion.
5. **`t_react` is computed from the declared windup length**, because it is right there in the
   frame table and the animation is harder to instrument. That is `t_label`, it is the number that
   has always passed, and reporting it as `t_react` makes `lie` identically zero. A verdict whose
   `lie` column is all zeros has almost certainly done this.
6. **The counterfactual is run against a scripted enemy for ever.** It is *runnable* against one,
   which is the point — but a scripted enemy has no reaction to the player's choice, so `DIV` is a
   floor rather than an estimate. Once `W1-12` ships, M2 must be re-run against real AI and the
   two numbers compared; if `DIV` does not **rise**, the AI is not responding to the player.
7. **The wall-clock gate is permanently `blocked_on_hardware`.** SwiftShader is a real constraint
   and an indefinite one is an excuse. The debt carries a wave; a debt that slips two waves
   escalates under `EFFORT-POLICY.md` like any other.
8. **This item is used to replace `RI-CMB07` rather than to complete it.** It measures whether the
   exchange is a decision. It says nothing about whether the fight is *shaped* like a Souls fight —
   commitment ratio, roll timing, stamina economy, punish usage. Both are required. A build that
   scores 95 here and 40 there is a good decision loop wearing the wrong tempo, and it is still
   not the thing the brief asked for.

## Provenance note

`provenance: constructed`, confidence **medium**. Every number in this item was defined for this
project and none is a measurement of any FromSoftware title.

Grounding, and its limits, stated honestly:

- **The 250 ms human reaction budget** is `canonical-recall`, confidence medium: simple visual
  reaction time in the literature clusters around 200–250 ms and choice reaction time is longer.
  15 f@60 is the conservative end of that range. The 4 f machine share is not recalled — it is
  read directly from `RI-CMB11` §1's own budget table, and moves if that table moves.
- **The 12° joint threshold, the 0.92 silhouette IoU, the `lie ≤ 8 f` allowance, and all four
  `ES-DIVERGE/1` bands are conventions defined here**, in the same class as `RI-MTH07`'s
  `[0.95, 1.05]` coupling band: chosen so that the obviously-bad case fails and the
  obviously-good case passes, and expected to be re-derived once there is a fight good enough to
  calibrate against. They are **not** derived from any upstream measurement and must never be
  cited as one. The first build to pass M1 and M2 honestly should be used to recalibrate them,
  and that recalibration is a corpus amendment, not a critic's discretion.
- **`K = 8`, `N = 200` and the 120-frame horizon** are engineering choices: 120 f@60 is two
  seconds, long enough to contain the enemy's answer to the player's action for every attack in
  `RI-CMB02` §A/§B except the ultra greatsword R2, and 200 samples gives the `DIV_dominant` share
  a standard error near 0.035, which is well inside the 0.40/0.70 separation the bands rely on.

The three wave-1 failures quoted in "The bar" are **measured**, not constructed: they are
reproduced from `corpus/90-verdicts/wave1/W1-09.md` §biggest_gap, `W1-09-r2.md` §biggest_gap and
`W1-09-r3.md` §3.2/§6 respectively, each with its own critic's artifacts.

This item was filed by the bar critic in `BAR-CRITIQUE-W1-09-R1` §R3, in answer to the question
*"does anything in `corpus/10-combat/` measure whether a fight is good?"* — to which, before this
item, the answer was **no**.
