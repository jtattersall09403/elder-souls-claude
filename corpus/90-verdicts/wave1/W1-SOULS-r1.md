# W1-SOULS — round 1 verdict

**Piece:** the soul economy — the *source* (`game/src/sim/souls.js`), the per-archetype values
(`game/data/combat/enemies/*.json`), and the instrument (`tools/progression/souls-consumption.mjs`).
**Reference items:** `RI-PRG06` (yield and pace), `RI-PRG01` (the curve), `RI-PRG02` §2 (the bought
attribute stream). **Seams:** S2, S5, S6, S9, S15. **Doctrine:** `ARBITRATION.md` §3 (CONSUMPTION),
`RI-MTH04`, `RI-MTH07`.

**Score: 5 / 10 — RETURNED.** Aggregation is `RI-PRG06`'s own: **min-over-axes**.
Pass floor is 6.

---

## The one-paragraph summary

The piece did the thing it existed to do. Before it, `soulsHeld` had no producer anywhere in
`game/src/**` and the entire levelling apparatus — a 139-row curve, a level-up screen at 29
sapwells, a bloodstain loop — was complete and unfundable. It is funded now, and I confirmed that
with the one test the builder's own twelve-arm suite never runs: **a real fight, driven with latched
`light` input and no harness kill verb anywhere, pays.** Forty-two swings, the sentry dies on frame
1421, souls go 0 → 136, one `souls_awarded` event in the trace. The consumption chain is genuinely
three layers deep — souls → attribute → derived pool → a 210-point blow that kills at the old
ceiling and leaves 12 hp at the new — and eight of twelve arms go red when I delete the call site.

It is returned for one reason, and the reason is arithmetic rather than taste. **Every soul value on
disk is anchored to a number `RI-PRG06` itself supersedes.** The anchor is §3's `12,665 / 93 =
136.18`, the R1 mean kill at **N = 576**. §7 — a wave-0 amendment, adopted, and registered in
`corpus/00-doctrine/constants.json` as `world.enemy_census = 1230` with the note *"Shipping values
are scaled by 576/N_shipped per region"* — makes the shipping value `§3 × 576/N_shipped`, a factor
of **0.468**. `inf_trash` should be **64 souls, not 136**; `K` should be **0.1026, not 0.219191**.
The consequence is not subtle and it is not hypothetical, because `game/data/world/population.json`
is being written in the working tree as I file this: at the adopted census the world pays
**2,400,817 souls, and `cum(120)` on the shipped curve is 2,391,999.** A 100% clear lands on
**level 120 exactly** — `RI-PRG06`'s L120 guard scores that row **0 ("100% clear reaches L115+")**,
and §1 says in terms that L120 *"is not, and must not become, a first-clear level."* Region 1 alone
pays 27,064 → **level 21** against method 1's required 13–15, whose own 0-row is "level outside
11–17".

Two more things are wrong and one of them is measured. The scan does **not** cover all five death
paths it names: a hazard kill pays nothing *and resurrects the corpse*. And three of the twelve
consumption arms can pass without the thing they measure ever happening.

---

## What I ran

`node tools/harness/boot-check.mjs` → **PASS before and after** (and again after I restored the
source I deleted). `derive-soul-values --check` → clean, before and after.

| Command | Exit | Artifact |
|---|---|---|
| `node tools/progression/critic-souls-r1.mjs` | 1 (4/8) | `reports/critic-souls-r1.json` |
| `node tools/progression/souls-consumption.mjs --out reports/critic-souls-consumption-INTACT.json --shot docs/shots/…png` | 0 (**12/12**, 0 unfalsifiable) | `reports/critic-souls-consumption-INTACT.json` |
| *…with `stepSouls(sim, bus)` commented out in `sim/step.js`…* | | |
| `node tools/progression/souls-consumption.mjs --out reports/critic-souls-consumption-DELETED.json` | 1 (**4/12**, 2 unfalsifiable) | `reports/critic-souls-consumption-DELETED.json` |
| `node tools/progression/critic-souls-r1.mjs --out reports/critic-souls-r1-DELETED.json` | 1 (4/8, **K1 red**) | `reports/critic-souls-r1-DELETED.json` |

`sim/step.js` was restored byte-for-byte from a backup and `git diff` on it is empty.

**Contention, declared.** `pgrep -c headless_shell` was **30 at start, 12–24 during the browser
phase**, `loadavg` **8.9 → 20.3** — well above the protocol's cap of 8. I therefore publish **no
wall-clock number at all**. Every figure below is a fixed-frame count, a soul count, a boolean or
arithmetic on files. The time-to-kill is stated as frames at 60 Hz and reproduced identically on two
separate runs (1421, 1421), which is what makes it safe to quote under load. One browser was
launched per tool invocation and closed; the photograph was taken inside a run that already had the
world open, per `AGENT-PROTOCOL` and S34(a) — it is evidence of *appearance* (a screen), not of
arrival.

---

## The findings

### HF-1 — the anchor is derived against a superseded enemy census *(hard fail)*

`tools/progression/derive-soul-values.mjs` line 72:

```js
/** RI-PRG06 §1, region-1 row: 12,665 souls / 93 enemies. */
export const R1_MEAN_KILL = 12665 / 93;
```

93 is `RI-PRG06` §3's R1 count **at N = 576**, and §7 exists precisely because 576 is not the world:

> `souls_each_shipped = souls_each_here × 576 / N_shipped`, applied per region so each region's
> soul total equals §1's Region-souls column exactly. At the reconciled census of 1,230 the scale
> factor is **0.468**.

`constants.json` carries `world.enemy_census: 1230` (band 891–1,569) and `world.enemy_budget: 576`
with the note *"Not the world census … Shipping values are scaled by 576/N_shipped per region."*
The tool applies no such factor. I re-derived `K` from `inf_trash`'s own fields independently and
got `ehp = 412 × 1.30 × 1.16 = 621.30`, `threat = 120/120 = 1.0`, `K = 136.18 / 621.30 =
**0.219191**` — the builder's number to six places, so the model is reproducible and the *anchor*
is what is wrong, not the algebra.

| | shipped | §7-corrected |
|---|---:|---:|
| `K` | 0.219191 | 0.1026 |
| `inf_trash` | 136 | **64** |
| R1 total at the adopted census (199 enemies) | **27,064** | 12,736 |
| R1 level on the shipped curve | **21** | **14** ✓ |
| world total at 1,230 | **2,400,817** | 1,124,285 ✓ |
| first-clear level | **120** | **93** ✓ |

`cum(120)` on `game/data/progression/levels.json` is **2,391,999**. The shipped values overshoot it.
This lands two `RI-PRG06` axes on their zero rows and, under min-over-axes, the item.

The builder saw half of this. Its status file says *"RI-PRG06 method 1 … CANNOT be asserted; a
fail-closed world-budget assertion would be a fail-closed assertion before its data exists"* — which
is correct and honest about the *assertion*. But declining to assert the world total is not the same
as being free to anchor the per-kill value at the census the world total was superseded at. §7 is a
normalisation rule on the **values**, and it is binding today, with nine enemies on the ground, as
surely as it will be with 1,230.

**This is the answer to "which of the builder's numbers move when the population lands":** the
per-kill values, `K`, the region totals, the clear levels and the L120 guard all move. What does
**not** move is the pacing table — see below, and that is the problem with it.

### HF-2 — a hazard kill pays nothing, and resurrects the corpse *(measured)*

`sim/souls.js`'s header is explicit that a transition scan was chosen over a hook because
*"there are FIVE places a body can die … it cannot miss a death path."* One of the five is
`sim/hazards.js`. I did exactly what `hazards.js` H9 does — `ent.hp = Math.max(0, ent.hp - d)` on a
`sim.entities` record — and stepped:

```
wrote hp 412 -> 0;  after 1 frame hp=412  souls+0
                    after 31 frames hp=412 souls+0;  combat body hp=412
```

The cause is step order plus the view/authority split. `combat-bridge.js mirror()` runs at the
**end of `stepCombat`**, sets `e.hp = Math.max(0, eb.hp)` for every entity that has a combat body,
and `stepSouls` runs *after* it. `Engine._settleWorld()` — which is where `this.hazards.step()`
lives — runs *after* `stepSouls`. So a hazard's write lands in a field that is overwritten from the
untouched combat body before the scan next looks at it. The body never died; the award never fired.
All nineteen shipped hazards declare `applies_to_npcs: true` and `voriplasm` is class `KILL` /
`fatal`, so this is a live intent, not a theoretical one.

Two of the five listed paths are also mis-stated. **`sim/player.js:233` is dead code** — nothing
imports `stepPlayer`; `sim/events.js:19` says so in-tree, and `AGENT-PROTOCOL` names this exact trap
("the verdict may name a dead call site"). And two real death sites are missing from the list:
`sim/magic/system.js:1040` and `sim/magic/apply.js:164`. Those two are *covered* — they kill the
combat body, so the mirror propagates them — which is the point: the scan is right about *why* it is
a scan, and the list of five was written from a grep rather than from the step order.

### HF-3 — an ordinary enemy re-pays on every despawn/respawn, with no rest *(measured)*

`Engine.spawnEncounter` mints **deterministic** eids (`dres-raid-party-infantry-0`, …), and
`SoulsSystem._alive` is keyed on eid and never pruned. Kill the party, despawn it, spawn it again:

```
pass1 +816   pass2 +816   pass3 +816   same eids reused: true   hearth rests: 0   total 2,448
```

`sim/souls.js`'s header calls the re-arm branch *"exactly RI-PRG06 §4's respawn row."* It is not:
S5 gives respawn to the **hearth rest**, and the re-arm here fires on any re-spawn from any cause.
Today the only in-engine caller that despawns encounter members is `_resolveCapture()`, so a player
cannot reach it — but `W1-POPULATION`'s status file names `Engine._streamProvince()` (a
distance-driven pump) as its placement slot, which turns this into *walk 100 m away, walk back, kill
again* the day the population lands. It needs a `paidAt`/`respawnEpoch` gate keyed on the rest
counter, not a boolean.

### F-4 — three of the twelve consumption arms can pass with nothing measured

The brief asked whether the four arms that "pass trivially because they assert an absence" are
vacuous. Three of them are, and I demonstrated each rather than arguing it.

- **Arm D** — *"a 99,999-hp training dummy is not an infinite soul farm"*. Predicate:
  `D.declared_souls === 0 && (!D.kill || D.kill.delta === 0)`. `!D.kill` is the error path: if
  `H.spawn('dummy_passive', …)` throws, the arm **passes**. I forced the throw (a duplicate eid,
  no source edit) and the predicate returned `true` with `D.error` set and no dummy ever spawned.
- **Arm I** — *"a corpse restored by a load does not pay a second time"*. Predicate:
  `souls_at_save !== undefined && souls_after_load === souls_at_save`. Nothing requires a kill to
  have happened. `killOne()` returns `{skipped, delta: 0}` when there is no body, and `es[0]` is
  `undefined` when `freshFight()` returns empty. **The builder's own `-DELETED` run is the proof:**
  arm I passed there with `the_kill.delta = 0` — souls 0 → 0, no corpse, no payment, green.
- **Arm B** — the ablation. `bMoved === 0 && B.kills.length > 0`. A skipped kill has `delta === 0`
  and is counted in `length`, so three skips pass. Arm A filters skips (`aReal`); arm B does not.

Arm H is **not** vacuous — it contaminates the live world to 7 souls / L1 / vigour 3 and reads the
running world back, which is the right shape and the one `RI-MTH04`'s save lesson demands.

The deeper version of the same point: **every one of the twelve arms kills with `H.killEntity()`**,
a harness verb that writes `b.hp = 0; b.dead = true; b.state = 'DEAD'` directly. The suite proves the
scan reads a dead body. It does not prove a fight pays. That gap is why I wrote `K1`.

### F-5 — the band check is region-blind and very nearly cannot fail

`derive-soul-values --check` asserts each value lands "inside an RI-PRG06 §2 band". The six trash
bands are `35–190, 140–520, 330–1250, 760–2600, 1200–4200, 2100–6200` — and their union is
**contiguous 35–6,200 with zero gaps**. The check therefore rejects only values below 35 or above
6,200, and never asks whether the value matches the enemy's **own region**.
`champion_hist_marked` at 2,423 souls is reported as *"R4 trash"* and passes; it is an R1-tier elite,
and `RI-PRG06` method 6 exists to make "am I in the right region" answerable from a single kill.
Nothing enforces method 6. The fix is one field: bind the check to the statblock's region tier.

### F-6 — the pacing table is true and it is also unfalsifiable, so I measured the fight

The brief's first instruction was right. The table's minutes come from
`108 / (93 × 0.78) = 1.49 min per killed enemy` and its souls come from `12,665 / 93 = 136` — the
same two numbers, from the same row of the same table. Level 2 costs 418; `418/136 = 3.07 kills ×
1.49 = 4.6 min`. Rescale the roster and both halves move together, so the table returns 10.8
min/level for *any* census. It is a tautology with a decimal point.

So I measured a real one, in the browser, in frames:

> **1,421 f@60 = 23.68 s of continuous fighting** to kill one `inf_trash` with a straight sword,
> 42 latched light swings, reproduced identically twice. The player survived.

This is the first browser figure for this fight; the builder's 21.7–23.4 s was node-only and it
correctly declined to publish it. **The browser agrees with node here** — which is worth recording,
because `AGENT-PROTOCOL` warns they diverge on long fights, and this one is short enough that they
do not.

What the measurement says about the pace:

| | R1 kills (typical, 78%) | pure fighting | share of R1's 108 min |
|---|---:|---:|---:|
| at N = 93 (the superseded decomposition) | 72.5 | 28.6 min | **27%** |
| at N ≈ 199 (the adopted census's R1 share) | 155.2 | 61.3 min | **57%** |

At the census the corpus has actually adopted, **more than half of region one is spent swinging**,
leaving 18 seconds per enemy for walking, looting, dying, talking and being lost. That is not a
Morrowind-shaped region, and it is `RI-PRG06`'s own provenance risk 3 — *"Combat TTK differs"* —
arriving with a number attached for the first time. It is not the builder's defect; it is a real
tension between three items that the pacing table's construction hides, and it should be filed
rather than absorbed.

### Clean, and worth saying so

- **S9.** Nothing in `souls.js` reads level, playtime or clear count. `awardFor` takes a statblock
  and the world clock. Level 1 and level 90 both pay 136. No AR-1.
- **S15 / gold.** `soulsHeld` has exactly four writers: `souls.js` (+kill), `death.js` (drop and
  bloodstain return), `engine.js _spendSouls` (−level), `save/state.js` (restore). `souls.js`
  touches no purse, has no price table, and declares `gold_awarded: 0` on the event. Zero of ten
  kills moved gold across the intact run. **The known `fenceSell` two-purse defect is untouched and
  not made worse** — I re-read it; `engine.js:6839` still writes `st.p.gold` while the save writes
  `sim.progression.gold`, exactly as before. (Adjacent and not charged here:
  `_resolveCapture()` zeroes `combat.world.gold` and `sim.progression.gold` but not `magic.gold`,
  which is a *third* purse. That belongs to the save piece.)
- **Props.** All 15 props at 0; the 99,999-hp dummy pays nothing. Correct, and the reasoning
  (a mass model without a prop guard is an infinite farm) is right.
- **Night.** ×1.35 at 23:00 and 03:00, ×1.00 at 20:59 and 14:00 — the edge case is tested and the
  day control moves independently, which is what makes it a multiplier rather than a constant.
- **The player is not swept into the scan** (`sim.entities` does not contain the player), so a
  player death cannot mint a `souls_awarded` event.
- **Consumption is real and three layers deep.** Named consumer chain: `sim/souls.js` →
  `sim.progression.soulsHeld` → `engine._spendSouls()` → `attributes.vigour` → derived pools →
  `combat.player.hpMax` 196 → 222 → **a 210-point blow that is lethal at the old ceiling and leaves
  12 hp at the new**. Perturbed three ways (statblock 0/999, module ablation, call-site deletion)
  and it moves each time.

---

## Arbitration

- **AR-1 (Morrowind into the fight):** clear. No level scaling, no dice in the award, no to-hit.
- **AR-2 (Souls into the world):** clear. Souls buy a level and nothing else; no soul-priced
  anything; gold untouched.
- **AR-3 (seam sterility):** `seam_sterile: false`. The piece *is* seam S2 in code — a Souls
  currency earned in a Souls fight buying a point on a ten-attribute Morrowind sheet whose derived
  pool the Souls body reads — and the night multiplier makes the Morrowind world clock change a
  Souls reward.
- **CONSUMPTION:** satisfied for the model the piece ships. See above.

---

## Biggest remaining gap

**`GAP-W1-SOULS-01` — every soul value in the game is anchored to an enemy census the corpus
superseded, and the world that would expose it is being written right now.**

*Remedy, and it is small.* In `tools/progression/derive-soul-values.mjs`, replace the anchor with
the §7 normalisation the corpus already ruled:

```js
export const ENEMY_CENSUS = 1230;                       // constants.json world.enemy_census
export const ENEMY_BUDGET = 576;                        // constants.json world.enemy_budget
export const R1_MEAN_KILL = (12665 / 93) * (ENEMY_BUDGET / ENEMY_CENSUS);   // 63.75
```

then `--write`. `inf_trash` → 64 (still inside `RI-PRG06` §2's R1 trash band 35–190),
`drowned_lesser` → 23 — **which falls out of the band, and that is the check doing its job**: at
0.468 the floor of the roster wants re-spreading, not just re-scaling, so the low end should be
lifted toward 35 and the model's `TIER_PREMIUM` re-solved rather than the value clipped.

*Acceptance.* `derive-soul-values --check` binds each value to its statblock's **region tier**
(closing F-5), and a new `--census N` mode asserts, over the placed roster in
`game/data/world/population.json` + `encounters.json`, that R1's total runs through
`levels.json` to **level ∈ [13,15]** and the world total to **level ∈ [88,98]** (`RI-PRG01`
method 6), failing closed with a stated reason while fewer than the band's 891 enemies are placed.
That is the assertion the builder was right to decline to fake and wrong to leave with no
placeholder at all.

---

## Path to ten

1. **Re-anchor to §7** (`GAP-W1-SOULS-01`). Non-negotiable; it is the item's contract.
2. **Fix the hazard death path.** Either move `stepSouls` after `_settleWorld()`, or have
   `hazards.js` damage the **combat body** (`combat.bodyOf(ent.eid)`) rather than the mirrored view
   — the second is better, because writing to a view that is overwritten every frame is the bug,
   and it is not confined to souls.
3. **Gate the respawn re-arm on a rest**, not on any re-spawn. `_alive` should carry the rest epoch
   the body was last paid at.
4. **De-vacuum arms B, D and I.** Each needs one clause: D must require `D.kill` to exist; I must
   require `the_kill.delta > 0`; B must count only unskipped kills. A probe that cannot fail is
   worse than no probe, and this project has now shipped several.
5. **Land one real-fight arm in `souls-consumption.mjs`.** Twelve arms and not one landed hit.
   `critic-souls-r1.mjs` K1 is 30 lines and can be lifted wholesale.
6. **Bind the band check to the region tier** (F-5), so method 6 has an instrument.
7. **File the TTK tension** (F-6) as an arbitration question or a `RI-PRG06` amendment: 23.68 s per
   R1 trash kill and ≈199 R1 enemies in 1.8 h do not both fit. One of TTK, the census or the hour
   budget yields, and `RI-PRG06`'s provenance note already anticipates all three.
8. **Correct the header's death-path list** to the step order rather than a grep: drop
   `sim/player.js` (dead), add the two magic sites, and say which paths the mirror carries and which
   it eats.

---

## Method deviations

- **I wrote a tool mid-critique**, per `TOOL-LOOP` rule 1, and it is declared here:
  `tools/progression/critic-souls-r1.mjs` — eight arms covering a real weapon kill and its
  time-to-kill, the hazard death path, the respawn re-arm, whether the player enters the scan, and
  faithful replays of the three consumption predicates I claim are vacuous. It carries its own
  self-break (`K8`: the identical loop with the attack input removed must report no kill — it does),
  and its headline arm goes red when the fix is deleted (`K1` in `reports/critic-souls-r1-DELETED.json`).
- **I deleted `stepSouls(sim, bus)` from `sim/step.js`** for two runs and restored it from a
  backup; `git diff` on that file is empty and `boot-check` is PASS afterwards.
- **The tree was dirty and moving** (59 modified paths, eleven-ish agents). One transient breakage
  hit me mid-run — `engine.js` called `_ensureAttributeRegister` before it was defined and every
  launch died at `_boot` — and healed within minutes. Per `RI-MTH04` "how we lose", reproducibility
  confidence is **medium**; the arithmetic findings (HF-1, F-5) are file-only and unaffected.
- **No wall-clock figure is published**, because load was 8.9–20.3 throughout. Frames, counts and
  booleans only.

---

## Evidence

```yaml
evidence:
  environment:
    node: v22.22.2
    boot_check: "PASS before and after (and after the delete/restore)"
    headless_shell_concurrent: "30 at start; 12-24 during browser work"
    loadavg: "8.93 -> 20.28"
    git: { commit: f1408a3, branch: claude/morrowind-souls-threejs-game-mou39v, dirty: true }
  runs:
    - command: node tools/progression/critic-souls-r1.mjs
      artifact: { path: reports/critic-souls-r1.json, sha256: ea317d1e8a43abbc135dc58185de6a12dfba65daadef6e963c7743da62602c08 }
      exit: 1
    - command: node tools/progression/critic-souls-r1.mjs --out reports/critic-souls-r1-DELETED.json
      artifact: { path: reports/critic-souls-r1-DELETED.json, sha256: 5e0a5e9e6c9ff70637b4c4f894161f5770c71ed7ff6e670093fdd8f98f6b7354 }
      exit: 1
      note: "stepSouls commented out; K1 red"
    - command: node tools/progression/souls-consumption.mjs --out reports/critic-souls-consumption-INTACT.json --shot docs/shots/2026-08-07-w1-souls-critic-r1-levelup-funded-by-kills.png
      artifact: { path: reports/critic-souls-consumption-INTACT.json, sha256: 95194193c0b19320e84c5efdebb406d153dc3cd2fd3bdecec4e85fae85a6d69e }
      exit: 0
      result: "12/12 arms, 0 unfalsifiable"
    - command: node tools/progression/souls-consumption.mjs --out reports/critic-souls-consumption-DELETED.json
      artifact: { path: reports/critic-souls-consumption-DELETED.json, sha256: 28d56914aa2996eba2956f2e67aa1f3bdcdc17b93decbda1898ed088d22a07c2 }
      exit: 1
      result: "4/12 arms, 2 unfalsifiable — A,C,E,F,G1,G2,G3,J red; B,D,H,I green"
  claims:
    - claim: "a real weapon kill pays 136 souls"
      source: reports/critic-souls-r1.json
      json_path: arms.K1
      value: { frames_to_death: 1421, delta: 136, events: 1, swings: 42 }
    - claim: "time to kill inf_trash is 1421 f@60 = 23.68 s"
      source: reports/critic-souls-r1.json
      json_path: arms.K1.seconds_at_60hz
      value: 23.68
    - claim: "a hazard-style kill pays nothing and the corpse is restored"
      source: reports/critic-souls-r1.json
      json_path: arms.K3
      value: { entity_hp_after_31_frames: 412, souls_after_31_frames: 0, body_hp: 412 }
    - claim: "despawn/respawn re-pays 816 souls per cycle with no rest"
      source: reports/critic-souls-r1.json
      json_path: arms.K5
      value: { pass1: 816, pass2: 816, pass3: 816, same_eids: true, hearth_rests: 0 }
    - claim: "consumption arm D passes when the dummy spawn throws"
      source: reports/critic-souls-r1.json
      json_path: arms.K6.arm_d_would_pass
      value: true
    - claim: "consumption arms B and I pass with zero real kills"
      source: reports/critic-souls-r1.json
      json_path: arms.K7
      value: { arm_i_would_pass: true, arm_b_would_pass: true }
    - claim: "K = 0.219191 re-derived independently from inf_trash's own fields"
      source: game/data/combat/enemies/*.json + corpus/20-progression/RI-PRG06 §1
      value: 0.219191
    - claim: "world total at the adopted census with shipped values is 2,400,817 = level 120"
      source: game/data/progression/levels.json + corpus/00-doctrine/constants.json
      value: { world_souls: 2400817, cum_120: 2391999, level: 120 }
  unmeasured:
    - claim: "RI-PRG06 methods 1-4, 8 and 10 (world total, per-region levels, the Monte Carlo
        pace sim, boss non-respawn, the L120 guard) against the SHIPPED world"
      reason: "nine hand-placed enemies exist; W1-POPULATION is placing the rest as I file.
        The arithmetic above is a projection onto constants.json's adopted census, not a
        measurement of a populated world."
    - claim: "boss and miniboss soul values"
      reason: "TIER_PREMIUM.miniboss 2.6 and .boss 4.0 are declared and no statblock carries
        either tier, so the shipped roster exercises only trash and elite. An unexercised
        constant is an unmeasured axis and both must be re-derived at the first such statblock."
    - claim: "night HP/damage deltas (RI-PRG06 method 9's second half: -15% HP, +18% damage,
        +10% aggro on the night variant)"
      reason: "no night variant statblocks exist; only the x1.35 soul term is implemented."
```
