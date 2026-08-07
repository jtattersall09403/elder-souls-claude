# W1-00 remediation record

Against the verdict of `crit-w1-00-h7q2` (`corpus/90-verdicts/wave1/W1-00.md`), **3/10**,
threshold 6.0, two independent hard fails. Every number below is from a run in this
repository and every run is reproducible by the command given.

This is a builder's record, not a verdict. Nothing here closes
`GAP-W1-platform-prng-never-drawn`: `tools/gap-ledger.mjs` rejects a closure carrying
`closed_by_builder_of_fix` (`SCORING.md` §5 rule 1), and it is right to. The gap stays open
with the evidence attached for a later wave's critic to re-measure.

---

## 1. `GAP-W1-platform-prng-never-drawn` — the seed now reaches the simulation

### What was wrong

The PRNG was reseeded correctly and never drawn from. `rng.draws == 0` on all 3,600 frames of
every scenario, state and seed. Seeds 1337 and 4242 differed in exactly one field, `.rng.seed`
— the echo of the input — and in zero simulation fields, so R4's "≥5% of frames differ" clause
was satisfied at 100% by that echo and both the rung and `tools/harness/determinism.mjs`
reported PASS on a build with no seed sensitivity at all.

### The three parts of the remedy

**1. A real in-step seeded quantity.** Each entity's idle-loop phase offset is drawn from
`rng.int()` **inside the fixed step**, on the entity's first simulated step
(`game/src/sim/entities.js`). It is taken in-step rather than at spawn so `rng.draws` moves
during `stepFrames()` and a critic can watch the counter move in the trace. It is saved and
restored (`world.entities[].anim_phase0`) so a load reproduces the same loop, and returning to
idle after a stagger resumes at the entity's own phase anchor rather than a global 0 — without
that, the seeded phase was erased by the first stagger and R4 came in at **4.7%**, just under
the bar, after re-converging at frame 168 of 3,600.

Why this quantity and not an invented one: W1-00 does not own enemy AI, and a seeded "AI
decision" written here would be the fabricated measurement `RI-MTH04` forbids. A per-entity
idle phase is real, already free-running, consumed on every step of every run, and is exactly
the field `AM-W1-00-01` wanted permanently excluded — seeding it turns that argument into a
measurement.

**2. The rung's own instrument, fixed.** `tools/harness/determinism.mjs` R4 now drops
`.rng.seed` before counting differing frames and **fails with reason `prng_never_drawn` when
`max(rng.draws) == 0`** in either run.

**3. `AM-W1-00-C1` adopted** into `corpus/80-methods/RI-MTH02-determinism-reproducibility.md`
§A R4, `## Comparison method` M3 and `## Scoring`. It moves no threshold.

### Acceptance, measured

`node tools/harness/trace.mjs --scenario cmb-duel-infantry --seed {1337,4242}`, 3,600 frames,
field-by-field diff:

```
frames compared: 3600
all differing fields across 3600 frames: {"enemies[].anim_frame":3600,"rng.seed":3600}
frames differing in ANY field other than .rng.seed: 3600 (100.0%)
max(rng.draws): { A: 1, B: 1 }
```

**100.0%** against a bar of 5%. It was **0.0%**.

**Swept, not single-shot.** `node tools/harness/seed-sweep.mjs`, 19 seed pairs:

```
B. seed sensitivity: 19/19 pairs pass R4 (min 100% of frames differ outside rng.seed;
   min max(rng.draws) 1)
```

**The discriminator is not a rubber stamp.** On `mth-warmup-noenemy` — `arena_flat` with no
entity of any kind, added as a permanent scenario — R4 correctly **FAILS**:

```
FAIL R4 — ... frames_differing_pct_excluding_rng_seed: 0
          max_rng_draws: {"1337":0,"4242":0}
          reason: prng_never_drawn
```

---

## 2. `RI-JRN05` M1/HF1 — the save round trip is hash-stable at every seed

### Root cause

`Rng._raw()` stored its four state words as **signed** int32 (`|`, `^` and `<<` all yield
signed int32 in JS); `loadRngState()` normalised them with `>>> 0`. The bits round-tripped, the
representation did not (`-339423194` → `3955544102`), the canonical serialiser produced two
different documents for the same state, and `getStateHash()` differed. Seed 1337 — the corpus
default, and the seed every instrument in the repository ran — is one of only two seeds in
twenty whose four words are all positive immediately after reseed, which is why every
single-seed test reported PASS.

### Fix

`game/src/core/rng.js`: `_raw()` stores `a,b,c,d` with `>>> 0`, making "the state words are
uint32, always" true at every instant rather than at one boundary. `saveRngState()` emits
uint32 explicitly. `>>> 0` is bit-preserving, so the output stream is unchanged — verified
offline at **0 value mismatches over 207 seeds × 2,000 draws**, and by R1/R2 hash identity.

### Proven across a sweep, not one seed

`node tools/harness/seed-sweep.mjs` — 20 seeds × 2 states = 40 trials, host-side round trip
re-derived from `saveState()`'s own bytes rather than from the game's `saveRoundTrip()`.

| | pre-fix | post-fix |
|---|---|---|
| First-trip mismatches | **36 / 40** | **0 / 40** |
| Second-trip mismatches | 0 / 40 | 0 / 40 |
| Seeds that pass | **1337 and 60606, and only those** | all 20 |
| Trials whose live words are all uint32 | 4 / 40 | **40 / 40** |

The pre-fix column was produced by reverting `rng.js` and re-running this tool, not inferred:
it reproduces the critic's 36/40 and its two lucky seeds exactly.

Example of the defect the sweep sees and a single seed cannot:

```
live         {"seed":104729,"a":790718529,"b":-1554287781,"c":-1756897329,"d":-1768414600}
round-tripped{"seed":104729,"a":790718529,"b": 2740679515,"c": 2538069967,"d": 2526552696}
```

`R9` in the ladder now sweeps five seeds itself, so the ladder cannot false-pass this way again.

---

## 3. Allocation — 0 B/step, and the instrument that could see it

### The instrument was blind, and that is the story

`HeapProfiler.startSampling` defaults `includeObjectsCollectedByMinorGC` and
`...MajorGC` to **false**, so the profile contains only allocations that **survived** — and
per-frame garbage in a game loop is exactly what dies in the nursery. Measured with a known
quantity: **100,000 escaping `{a,b,c}` object literals report as 7,572 B (0.08 B each) with the
defaults and 2,934,752 B (29.3 B each, correct) with the flags on.** A traced run that
allocates 815 B/step read as 5 B/step.

`tools/platform/alloc-probe.mjs` — the tool `RI-PLT01` M4 names and which did not exist —
therefore **self-tests before it measures** and exits rather than reporting a zero it has not
earned:

```
[harness] instrument self-test: 28.97 B per escaping {a,b,c} literal (expect ~28-32) — OK
```

### Method

Allocation attributed by **module**, not by stack-walking for `stepOnce` — V8 inlines
`stepOnce` away and a stack classifier then silently reports zero. `sim/record.js` (and
`EventBus.snapshotInto`, which only the record calls) is counted separately: `RI-PLT01` §C.3
excludes the trace record from P4 by name, and counting it separately makes the exclusion
visible instead of assumed. Two warm-up passes are discarded (TurboFan tier-up attributed
523,864 B to `stepEntities` in a state with **zero entities**), then the minimum of three
samples is taken at N and at 2N steps and the **slope** is reported, which cancels the
per-`stepFrames()`-call constant.

### Result

`node tools/platform/alloc-probe.mjs --steps 60000`, render disabled:

| Fixture | State | Sim-path bytes @ 60,000 steps | @ 120,000 steps | **B/step** | Budget |
|---|---|---|---|---|---|
| F1 fen | `swamp_canopy` | **0** | **0** | **0** | 0 |
| F5 dungeon | `dungeon_primary` | **0** | **0** | **0** | 0 |
| F4 six enemies | `arena_flat` + 6 | **0** | **0** | **0** | 2048 |

Zero at both step counts, so it is a literal zero and not a slope of noise. It was
**0.78–1.73 B/step**.

Sites closed, all named by the critic's profile or found by this one:

* `Math.hypot` → `Math.sqrt` in every simulation hot path (`hypot` is variadic and allocates);
* `FixedLoop.stats.stepMsSamples` — a growing `[]` with `.push()` → a pre-allocated
  `Float64Array` ring;
* `Engine.perf.simMsSamples` — same;
* `stats.lastStepMs` / `stats.stepMsTotal` — doubles written into plain-object fields on every
  step → a two-slot `Float64Array`.

The retained-heap slope (`P5`/`P6` leak check) is reported alongside and is ≤ 0.73 B/step.

---

## 4. The trace record is built outside the fixed step

The record used to be built in `Engine._step()` — which **is** the `FixedLoop.stepOnce()`
callback — so the critic's profile read `makeRecord ← _step ← stepOnce ← stepFrames` and the
step allocated 2,220 B/step whenever tracing was on. The file's own header comment said it was
built outside the step. A comment cannot hold that line, so:

* `Engine._step()` now runs the simulation step and nothing else;
* `Engine._afterStep()` builds the record and is called by both things that advance the sim
  (`stepFrames`'s loop and the rAF accumulator) **after** `stepOnce()` has returned and after
  its timing window has closed, so `perf.lastSimMs` measures the simulation and not the
  instrument;
* `FixedLoop` maintains a `stepDepth` counter across the whole of `stepOnce()`, and
  **`makeRecord()` throws if it is non-zero.** The claim is now enforced at runtime and any
  critic can defeat it by moving one line and watching it throw.

Measured with `--trace`: the record costs ~816 B/step and **0 B of it is on the sim-step
stack**; sim-path allocation with tracing on is unchanged at 0 B/step.

---

## 5. `RI-MTH02` R5 and the withdrawn amendment

`AM-W1-00-01` is **withdrawn** with its three defects conceded in the file itself.
`AM-W1-00-02` replaces it and is applied.

The critic's diagnosis is adopted in full: R5's failure decomposes into an enumerable set of
absolute frame indices the rung forgets to re-base, and `anim_frame`, which must **not** be
permanently excluded.

* **The rung.** The trace carries three absolute frame indices, not one — `f`, `events[].f`,
  `enemies[].state_entered_f`. All three are named and re-based. An index that re-bases to
  before the window normalises to the sentinel `"pre-window"`, because `state_entered_f` has
  two populations (a pre-window entry has the *same* absolute value in both runs and therefore
  re-bases to two *different* negatives) and no single subtraction fixes both.
* **`anim_frame` is compared, not excluded.** The build takes the critic's third option, which
  the amendment never rebutted: the **scenario contract** re-anchors free-running entity clocks
  at the frame the scripted window opens (`__HARNESS.reanchorFreeRunning()`), re-anchoring
  `anim_frame` to the entity's *seeded* phase so the re-anchor stays seed-sensitive. It mutates
  the simulation and the trace then reports the phase the simulation is genuinely in. It
  returns exactly what it changed and every run prints it.

```
PASS R5 — warm-up-invariant: scripted-window records identical after re-basing every absolute frame index
        absolute_frame_indices_rebased: ["f","events[].f","enemies[].state_entered_f"]
        differing_fields: []
        window_reanchor: {"frame":30,"seed":1337,"entities":[{"eid":"e0","anim_len":48,
          "seeded_phase":40,"anim_frame":[22,40],"state_entered_f":[24,30]}]}
```

R5 also passes on `mth-warmup-noenemy`, the critic's own counter-example, where it previously
failed on `events[].f` alone.

**Ladder: 9/9 rungs pass** on `cmb-duel-infantry`, 0 guard violations.

---

## 6. `RI-CAM02`

`corpus/80-methods/m-cam02-control.mjs` — named by the item, absent, now present.

**The pitch clamp was the wrong band.** The build shipped `[-70°, +60°]`; `RI-CAM02` §B
specifies `[-55.0°, +38.0°]`, and `[-50.0°, +32.0°]` under lock. The critic reported the
reachable range rather than scoring it, because M2's FAIL conditions are upper bounds and a
*wider* clamp does not trip them until something actually reaches −70°. It would have, the
first time a real mouse swipe arrived. Also added: `RI-CAM02` §A's per-frame look caps
(30°/frame yaw, 20°/frame pitch), with the surplus **discarded** rather than accumulated.

`node corpus/80-methods/m-cam02-control.mjs`:

| Check | Result | Measured |
|---|---|---|
| M2 unlocked pitch clamp | **pass** | max `38.000000`, min `-55.000000` over 1,860 frames; **0** bounce frames, **0** creep frames |
| M2 locked | **pass** | max `32.000000`, min `-50.000000`; 0 bounce, 0 creep |
| M2 relation | **pass** | locked band strictly narrower |
| M2b per-frame look cap | **pass** | a 400° swipe yields exactly 30.000000° on frame 1 and 0.000000000° carried into frame 2 |
| M3 zero look lag / no smoothing | **pass** | first-frame Δyaw `3.000000` (bar 3.000 ±0.001), 0 non-zero frames in the still window, `argmax corr lag = 0` |
| M5 no auto-follow | **pass** | `0.000000°` total camera yaw over 720 frames of rotating movement input (bar 0.5°) |

M1 (deadzone and quadratic magnitude remap) is reported **not run**, in the tool's own
`declared_not_implemented`: this build takes `look` as a per-frame delta in degrees, not a
normalised stick magnitude, so there is no curve to fit and a fitted R² would be fabricated.

---

## 7. `RI-PLT03` and the corpus hole in `RI-PLT01` §A

`tools/platform/calibrate.mjs` — named by `RI-PLT01` §A rule S*, absent, now present. It runs
the specified workload (a seeded fixed-point integration over 100k iterations, integer-only,
allocation-free) and reports `cpu_index = 0.3452 ms`, `checksum 482219064`.

**It refuses to emit `sim_units`, and that refusal is the finding.** §A defines
`sim_units = measured_sim_ms × (cpu_index_reference / cpu_index_thismachine)` "and the
reference is the declared `phone-mid` class" — but **no numeric `cpu_index_reference` for
`phone-mid` is declared anywhere in the corpus**; `phone-mid` appears only as a device-class
label in `RI-PLT01` §A/§C, `RI-PLT02` §B.1 and `RI-PLT03` §C.1. `RI-PLT01` M3 (8 points) is
therefore unscoreable on **any** machine, real hardware included, until that constant lands.
Recorded as `corpus_hole: PLT01-A-no-numeric-cpu-index-reference` in the tool's own output
rather than papered over with an invented number.

`RI-PLT03`'s 30 Tier-S points for "the world is continuous" (M-L9, M-L10, M-L14) need a second
region to cross a border into. That is world content and it is not this piece's to build. See
§9 below.

---

## 8. Also closed

**`queueInputs` is fail-closed on the event shape, not only on the button name.**
`{f:0, tap:'light'}` used to return `1` and do nothing; it now throws, names the key, and says
where scenario sugar is expanded. This is verdict §8.1 — the defect that cost the critic four
measurements whose attack inputs were silently dropped — and it is `RI-MTH01` A12, the one
*mandatory* row scored 1 rather than 2.

---

## 9. What is NOT closed, and why

| | |
|---|---|
| `GAP-W1-platform-prng-never-drawn` | Remedied and evidenced, **left open**. A gap is closed by a later wave's critic re-measuring it, never by the builder of the fix (`SCORING.md` §5 rule 1); `tools/gap-ledger.mjs` rejects the attempt by design |
| `RI-PLT03` M-L9 / M-L10 / M-L13 / M-L14 (30 of 70 Tier-S points) | One region exists, so there is no border to cross. World content, owned elsewhere |
| `RI-PLT03` M-L1 / M-L7 / M-L11 (30 Tier-H points) | SwiftShader. `RI-PLT01` T1 forbids emitting them and the build correctly refuses |
| `RI-PLT01` M3 sim CPU (8 points) | `cpu_index` now exists; `sim_units` cannot be computed until the corpus declares the `phone-mid` reference constant (§7) |
| `RI-CAM02` M1 deadzone / M4 turn-rate ceiling / M6 auto-recentre | M1 has no implementation to measure and is declared, not faked; M4/M6 are the movement and camera pieces' |
| `RI-CMB07` M1–M4 | The exemplar is invalidated by seam S22 pending regeneration and `m-cmb07-expand/-stats/-diff.mjs` are absent. Regenerating an invalidated exemplar is not this piece's call |
| `RI-JRN03` M-N1–M-N7 (the naive pass) | Requires a separate fresh agent with a verified-empty context (`JC-03N`). Not something a builder can be |
| `RI-JRN05` M11 (kill the page mid-write) | The critic's two attempts hung the probe; not re-attempted here |
| Verdict §8 items 2–9 | The critic marked them explicitly **not** work for the next builder, and they are left alone |

---

## 10. Commands

```
node tools/harness/determinism.mjs --scenario cmb-duel-infantry     # 9/9 rungs
node tools/harness/determinism.mjs --scenario mth-warmup-noenemy    # R5 passes, R4 prng_never_drawn
node tools/harness/seed-sweep.mjs                                   # 40/40 round trips, 19/19 R4 pairs
node tools/platform/alloc-probe.mjs --steps 60000                   # 0 B/step, F1/F5/F4
node tools/platform/alloc-probe.mjs --trace --steps 20000           # record cost, 0 B on the step stack
node tools/platform/calibrate.mjs                                   # cpu_index; sim_units refused
node corpus/80-methods/m-cam02-control.mjs                          # M2/M2b/M3/M5
node tools/harness/save-audit.mjs                                   # manifest-extra 0/0 at 4 states
node tools/harness/api-probe.mjs                                    # 33/33 present, 8/8 pass
```
