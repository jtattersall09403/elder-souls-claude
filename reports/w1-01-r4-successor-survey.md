# W1-01 round 4, successor run — the world, and getting across it

**Commit** `ec1a721` (dirty working tree; every JSON artifact below carries its own `git` block).
**Load** every browser measurement here was taken with `node tools/contention.mjs --gate` returning
exit 3 — 3–5 browser instances of a ceiling of 6, and 4.4–5.7 run-queue per core against a ceiling
of 4.0. I proceeded past exit 3 with exactly one browser at a time and declared it in
`orchestration/status/W1-01-r4.json`. **Every in-world figure below is a frame count at a fixed
60 Hz step and does not depend on that load. Wall-clock figures are marked as such and do.**

The JSON artifacts are under `reports/w1-01-r4/` and `reports/road-through-building.json`.
`reports/.gitignore` excludes `*.json` by design, so this file is the versioned evidence and the
JSON is the reproducible detail. Every tool named here re-runs.

---

## 1. THE CROSSING — the province is not crossable, and the reason is a house

`reports/w1-01-r4/crossing-A-solids-on.json`

The canonical crossing is Stormhold south gate to Lilmoth harbour steps, 6,816 m, declared 56.8
minutes on foot. Walked on a body through the game's own locomotion:

| | integrated | in-world | ends |
|---|---|---|---|
| **A — as shipped** | **39.0 m** | 16.667 min (60,001 frames) | pinned at (2190.7, 794.3) |
| B — settlement walls out | 6,547.4 m | 16.667 min | orbiting at (2714.1, 4839.5) |
| C — walls out **and** deck clamp out | 6,547.4 m | 16.667 min | (2714.1, 4839.4) |

All four RI-WLD01 checks fail in arm A: M2-TIME 16.667 min (bar 52–65), M2-DISTANCE 39 m (bar
6,300–7,600), M3-SPEED-HONESTY 98.08 % of samples under 1.6 m/s (bar 8 %), M3-MEAN-SPEED
0.039 m/s.

Where it stops is flat, dry and firm — slope 0.0°, depth 0.00 m at every tide, `substrate: FIRM`,
`mired: false`, one region throughout. The terrain does not explain it. What explains it is
`settlement:stormhold`, 59 solid shapes, `inside_a_building: null` — the body is stopped *at* a
wall, not inside one.

### The road runs through the building

`tools/world/road-through-building.mjs` (new; offline, no engine, no browser) resamples every named
route at 1 m and asks `insideBuilding()` — the same predicate `province.js` uses to audit where
people are standing.

- The crossing leg `stormhold-helstrom` passes through `stormhold-scribe` from **43 m to 53 m**.
  The capsule is 0.32 m wide and it stopped at 39 m.
- **6 blocks on THE CROSSING, 10 on THE LONG WAY, and 10 of 10 built legs pass through at least
  one building.**
- `build-roads.mjs` routes over the terrain. `render/exterior.js planSettlement()` plants houses
  on the same ground afterwards. **Neither generator has ever been shown the other's output, and
  nothing in the build performs the join.** Each side's own audit passes; the body walks into the
  wall.

`--self-test` moves `stormhold-scribe` 1,000 m east and nothing else: arm A flagged, arm B clean,
every other offence in the province identical across both arms. *(The first draft of that
self-test was vacuous — it mutated `doc.buildings[].pos`, which `planSettlement` does not read, so
a pre-existing offence read as a detection. Fixed before use.)*

### RI-WLD01 M3 is blind on five frames in six

`walkRoute` integrates path length **every** frame and samples ground speed **every sixth**
(`sampleEvery: 6`). In arm B:

- integrated over all frames — 6,547.4 m / 1,000.02 s = **6.547 m/s**
- mean of the 1-in-6 samples — **1.8097 m/s**
- **maximum** of the 1-in-6 samples — **2.000 m/s**

A body whose every observed frame is at or under the 2.0 m/s walk cannot integrate 6.5 m/s.

**The control that makes this evidence rather than arithmetic:** in arm A, where the body is
pinned and still, the same two numbers agree to four decimal places (0.0390 integrated vs 0.039
sampled). Same code, same run shape — they agree when nothing moves and diverge 3.6× when
something does. M3 is the project's speed-honesty check and it cannot see whatever is doing this.

---

## 2. The parapet negative control — both arms, matched

`reports/w1-01-r4/parapet-clamp-on.json`, `reports/w1-01-r4/parapet-clamp-off.json`.
Commit `e8ccf31`, **900 frames per push in both arms** (the predecessor ran 900 against 300 and
neither arm carried a git stamp).

| | leaked | worst offset | over the limit | falls | frames off deck |
|---|---|---|---|---|---|
| clamp **on** | **0 / 28** | 3.95 m | 0.000 m | 0 | 0 |
| clamp **off** | **28 / 28** | 48.03 m | 44.678 m | 22 | 22,822 |

**Why the negative control was worth running.** Crossing arm C disabled the deck clamp with the
same one line and produced 6,547.4 m and the same stall position as arm B to 0.1 m — a null
result. A null result from a disable is worth nothing unless the disable is known to bite. The
parapet pair shows the identical disable turning 0/28 into 28/28 on the same tree. The deck clamp
is therefore **exonerated** for the crossing stall rather than untested.

---

## 3. hazard-fire — measured on a body

`reports/w1-01-r4/hazard-fire.json`, commit `ec1a721`.

**17 of 19 hazards reach the body**, against the predecessor's 12 of 19. Every figure is an HP
delta or an affliction on the player:

- HP: ridge-exposure −354.64, kiln-ground −350.3, ash-lung −348.9, the-thicket −348.9,
  salt-storm −297.6, the-fall −198.4, rockfall −198.4, pair-lightning −111.6,
  hist-sap-fume −111.6, comb-collapse −99.2, thirst −86.8, spore-bloom −55.8,
  strangler-snare −55.8
- afflictions caught: ash-lung, dye-fume, hist-sap-fume, spore-bloom, the-thicket,
  pair-lightning, strangler-snare
- routes closed with no HP (`damage.kind: none`, as RI-WLD11 M57 declares): press-gang-water,
  the-flats-flood, high-tide-gate

### The world's report could not see a trap go off

`game/src/sim/hazards.js` computed `row.fired` from `this.active.get(id)`, and a TRAP or KILL is
*deleted* from `active` on the frame it fires. So from that frame on, the world's own report said
`fired: false` about a hazard that had just taken 99.2 HP off the body. **Six of nineteen shipped
hazards are TRAP or KILL.** Re-scoring the predecessor's artifact on the body gave 8
table-vs-body disagreements.

The fix adds a `history` map; `row.fired` now means *has this gone off on this body*, with
`row.armed` / `row.spent` / `row.fires` / `row.outcome` / `row.damage_total` alongside.
`row.damage_dealt` keeps its old per-entry meaning so `consumption.mjs` does not move under it.
In the new run, `body_disagreements` is **empty**.

### Delete-the-fix

`tools/world/w1-01-r4-hazard-report-deletefix.mjs` (offline). Standing a body in each TRAP/KILL
volume for 1,200 frames:

| hazard | HP lost | report, fix in | report, fix removed |
|---|---|---|---|
| comb-collapse | 99.2 | `fired: true` | `fired: false` |
| pair-lightning | 111.6 | true | false |
| the-fall | 198.4 | true | false |
| **voriplasm** | **620 — it kills the body** | true | **false** |
| strangler-snare | 55.8 | true | false |
| rockfall | 198.4 | true | false |

Six of six arms differ, and the old lie returns on all six. Rule 17: the probe checks the git
**index** as well as the working file and reports `worktree_has_fix: true`, `index_has_fix: false`,
`worktree_matches_index: false`.

### Still open, and the target was 19/19

- `cut-off-by-the-tide` (GATE): the probe gets inside the volume and **no `hazard_fired` is ever
  emitted**.
- `voriplasm` (KILL): `entered: true`, no fire and no HP lost **in the browser** — but the offline
  probe above takes the body from 620 to 0 in the same volume at the same commit. **It fires in
  bare node and does not fire in the browser.** I did not resolve this and it should not be written
  off as a probe artefact; it is the shape of a two-implementations defect.

---

## 4. CONSUMPTION (RI-MTH07, mandatory)

`reports/w1-01-r4/consumption.json`, `tools/world/w1-01-r4-consumption.mjs`. Three arms, one
browser session, nothing but the perturbation differing.

- **Model** — `game/data/world/settlements/<id>.json §buildings[].offset_m`
- **World-side consumer** — `render/exterior.js planSettlement()` →
  `province.settlementSolidsNear()` → `engine._settleSettlementSolids()`'s `CollisionCell` →
  `sim/world-collision.js` capsule push-out
- **Entity that changes behaviour** — the player, walking its own trunk road

| arm | scribe at | body walked | stopped at | solids |
|---|---|---|---|---|
| A shipped | (2198.2, 798.5) | **39.0 m** | (2190.7, 794.3) | 59 |
| B moved 1,000 m east | (3198.2, 798.5) | **299.5 m** | (2259.1, 1033.6) | 0 |
| C shipped again | (2198.2, 798.5) | **39.0 m** | (2190.7, 794.3) | 59 |

7.7× further with the building moved, and **the old number comes back exactly** when it is put
back. C is the arm that makes B mean anything.

**Honestly:** moving the scribe's house does not open the crossing. The body then walks 299.5 m
and stops again at (2259.1, 1033.6) with **zero** settlement solids near it — a third, different
blocker outside any town, which I did not characterise.

`tools/world/consumption.mjs` still reports 16/16 across 9 models with the `hazards.js` change in
(`reports/w1-01-r4/world-consumption.json`).

---

## 5. The `soulrest-blackrose` drowning defect — for W1-05

`reports/w1-01-r4/soulrest-leg.json`, `tools/world/w1-01-r4-soulrest-leg.mjs`. The leg is
1,808.2 m. Walked both directions, walls in and out, 120,000-frame cap.

| arm | walls | walked | stopped at | water | HP |
|---|---|---|---|---|---|
| A Soulrest→Blackrose | on | **11.6 m** | (619.1, 4872.3) | 0.00 m, W0 | 620 |
| B Soulrest→Blackrose | off | 6,458.2 m | (1743.2, 4875.7) | 0.00 m, W1 | **7** |
| C Blackrose→Soulrest | on | **18.7 m** | (1889.7, 4456.1) | 0.00 m, W0 | 620 |
| D Blackrose→Soulrest | off | 6,219.8 m | (2193.9, 4946.4) | **18.037 m, W5** | 296 |

The leg passes through `soulrest-grey-hist`, `blackrose-pawn` and `blackrose-rootpost`. Arm A
stops at (619.1, 4872.3); `soulrest-grey-hist` is at (629.1, 4873) — ten metres away.

**With the towns solid the leg is not walkable at all, in either direction, and the body never
reaches water to drown in: it stops 11–19 m in, on dry ground, at full health.** No streamer,
tide, depth or current is involved. Walls change the distance walked by 420× (mean 15.1 m →
6,339 m). With the walls out the body is 3.4× *past* the leg length — it is off the road, not on
it — and ends either nearly dead on land or 18 m deep in water.

**What this does and does not settle.** Depth, tide and current were correctly exonerated: they
are not what puts the body in the water. What puts it in the water is that it cannot follow the
road, leaves it, and wanders. The population-streaming hypothesis is **not needed** to explain a
body failing on this leg. But I did **not** reproduce a drowning — `any_arm_drowned: false`,
nothing died inside the frame cap, and HP 7 and HP 296 are consistent with drowning in progress
but I did not watch a death land and I am not reporting one. I did not test streaming directly.
This competes with the streaming hypothesis; it does not refute it.

---

## What I did not do

- **`reachability-walk.mjs` did not land.** It was launched and was still running when this piece
  ended; whatever `reports/w1-01-r4/reachability-walk.json` contains was not watched to
  completion by me and I am reporting no figure from it. The predecessor's
  `reports/reachability-walk.json` remains the last watched result (0 of 13 regions walked into),
  and several of its legs carry byte-identical `path_m` / `frames` / `mean_speed_mps` across
  different regions, which looks like the walker not being reset between legs — an instrument
  defect nobody has chased.
- **The 117-frame region capture and `region-dispersion` were not re-run.** The colour-stripped
  LOO/Fisher numbers in `findings` are still the predecessor's and are still measured on
  `reports/region-shots-prebush/`.
- **The height-fog work** the predecessor named as the next move was not started.
- I did **not** fix any of the road/building collisions. `game/src/world/province.js` is owned by a
  sibling for settlement exteriors and I did not touch it; the remedy belongs to whoever owns the
  join, and the check now exists to hold it.
- I did not characterise the third blocker (299.5 m, no solids) or the orbit at (2714, 4839).
- `voriplasm` firing offline and not in the browser is unresolved.
