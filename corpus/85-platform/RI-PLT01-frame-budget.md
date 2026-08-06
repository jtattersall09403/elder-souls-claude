---
id: RI-PLT01
title: The frame budget as a combat-correctness requirement — and what may honestly be measured on a software rasteriser
kind: number
side: neutral
judges: [platform.perf.framerate, platform.perf.simtime, platform.perf.allocation, platform.determinism.harness]
provenance: constructed
confidence: high
blind_pair: no
---

> **This item closes BAR-CRITIQUE-01 G13 (rank 13).** Until it existed,
> `CRITIC-DOCTRINE.md` §2.4.3 banned *"good for a browser game"* as a defence **with a caveat**
> — *"platform limits are judged only where a `platform.*` item explicitly sets the budget"* —
> and no such item existed, so the caveat swallowed the rule. **This item is that budget.**
> With it in place, §2.4.3 has teeth: a fidelity or content decision may be traded against
> frame time **only** by citing a specific row of §C below, and a critic may reject any
> performance defence that does not.
>
> **Division of labour, binding:** `RI-PLT02` owns **memory, asset budgets and leaks**.
> `RI-PLT03` owns **load time, streaming and hitches** (including `TTFP`, which `RI-JRN01` O5
> also cites). This item owns **the per-frame budget and the sim/render contract**.
> `RI-MTH02` owns **determinism**; this item consumes it and adds the frame-timing consequence.
> `RI-VIS03`/`RI-VIS04` own **fidelity**; the trade between them and this item is governed by
> §F and by nothing else.
>
> **`blind_pair: no`.** There is no blind comparison of a frame-time histogram.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

**Frame rate is not a comfort metric in this project. It is a correctness metric, and the
reason is `RI-CMB01`.**

A roll's invulnerability window is 13 frames. At a stable 60 Hz that is 217 ms of real time and
a player can learn it. Drop to 40 fps with the sim still running at 60 Hz, and those 13
invulnerable simulated frames are *displayed* across 8–9 rendered frames: the player sees fewer,
later, and less evenly-spaced samples of a window they must time by eye. An enemy windup that
`RI-AI02` specifies as 18 readable frames becomes 12 displayed images, two of which land during a
33 ms hitch that also delays the frame in which the player's input was sampled. The player is now
being asked to react to a telegraph they cannot see and to time an i-frame window they cannot
perceive. **The fight stops being fair, and it stops being fair in exactly the way that makes
Souls combat feel cheap rather than hard.**

So the bar is not "it should run well". The bar is: **the displayed frame rate must be high
enough and stable enough that every frame-counted quantity in `corpus/10-combat/` remains
perceivable, and the fixed 60 Hz simulation must never slow down when rendering does.** Those
are two separate requirements and the second is the harder one: a game whose sim slows under
load has silently changed every i-frame window in the corpus, and no combat item is measurable
any more.

And the bar has a target device: `RI-JRN04` H7 says it is a **mid-range phone**, not a
workstation. A budget met only on a desktop is a budget for a game nobody in the brief's
scenario is playing.

## The reference artifact

### A. The measurement problem, stated honestly

`HARNESS.md` §1 is unambiguous:

> GPU: none — ANGLE/Vulkan **SwiftShader** software renderer.
> Frame *rate* is not a measurable quality here. **Do not** write a reference item that scores
> FPS on this machine.

That is not a nuisance to route around; it is a fact that determines this item's whole design.
Everything below is therefore split into two tiers, and **the tier is part of every check's
identity**, not a footnote.

| Tier | Meaning | Where it may be scored |
|---|---|---|
| **Tier-S** | **Software-valid.** The quantity is a property of our code, our data, or our scene graph, and does not depend on how fast a GPU rasterises. Measuring it under SwiftShader gives the *same answer* as measuring it on real hardware. | Scoreable **here**, in this container, today. |
| **Tier-H** | **Hardware-required.** The quantity is a wall-clock measurement of rasterisation, compositing, memory bandwidth or thermals. SwiftShader's number is not merely inaccurate, it is *unrelated*. | **Not scoreable here.** Scores `unmeasurable` = **0**, fail-closed, until a run manifest attests real hardware. |

**Rule T1 — the attestation gate.** A Tier-H check may only be scored from a run whose
`manifest.json` records `renderer.unmaskedRenderer` (from `WEBGL_debug_renderer_info`) as a
**real GPU string**, plus `renderer.deviceClass ∈ {phone-mid, phone-high, laptop-integrated,
desktop-discrete}`. A manifest whose renderer string contains `SwiftShader`, `llvmpipe`,
`software` or `Mesa` **may not produce a Tier-H score at all** — not a low one, not a
provisional one. The tooling enforces this (`tools/platform/perf-run.mjs` refuses to emit
Tier-H fields when the renderer is software) so that a well-meaning critic cannot report a
SwiftShader frame time as evidence.

**Rule T2 — the anti-laundering rule.** Tier-H checks scoring 0 for unmeasurability **may not
be dropped from the weighted total**. They stay in the denominator. A build measured only in
this container therefore cannot exceed the Tier-S weight ceiling (**62/100**, §E), which lands
it in the "Recognisably attempting it" band with a ladder ceiling of 5. That is correct and
intentional: *we genuinely do not know whether this game runs*, and the score should say so.
Removing the unmeasurable checks to "score what we can" is precisely the inflation
`SCORING.md` §1.1 forbids.

**Rule T3 — what SwiftShader is good for.** It is *deterministic*. Every Tier-S number below is
therefore reproducible bit-for-bit across runs here, which makes regression detection **more**
reliable in this container than it would be on a real GPU. The container is a bad frame-rate
lab and an excellent correctness lab, and this item uses it as the latter.

### B. What is Tier-S and what is Tier-H (the answer to the brief's question)

| Quantity | Tier | Why |
|---|---|---|
| Draw calls per frame | **S** | a property of the scene graph and batching, not of the rasteriser |
| Triangles submitted per frame | **S** | same |
| Unique shader **programs** compiled, and programs bound per frame | **S** | count is ours; compile *time* is Tier-H |
| Unique materials per frame; material state changes per frame | **S** | same |
| Texture memory (MB), geometry memory (MB), atlas count | **S** | derived from asset dimensions and formats |
| **Bytes allocated per fixed simulation step** | **S** | pure JS; the GPU is not involved |
| **GC events and their attribution to the sim loop** | **S** | JS heap behaviour, measurable with `--expose-gc` + heap deltas |
| **CPU simulation time per fixed step, measured with rendering disabled** | **S\*** | pure JS, but *machine-relative* — see the calibration rule below |
| Sim/render decoupling (sim advances only in `stepFrames`; sim step count independent of render count) | **S** | a structural property, `HARNESS.md` R2/R3 |
| Frame-rate independence of every gameplay quantity (movement, stamina, cooldowns, camera rate) | **S** | tested by varying render rate while the sim is stepped |
| Determinism of the trace under load | **S** | `RI-MTH02` D5 |
| Overdraw / fill-rate cost | **H** | this is the thing SwiftShader is worst at, by orders of magnitude |
| **Wall-clock fps, p50/p1/p0.1 frame time, frame-time variance** | **H** | the headline numbers, and none of them are valid here |
| "No frame over 33 ms in combat" | **H** | a wall-clock claim |
| GPU memory residency, VRAM pressure, texture upload stalls | **H** | no GPU |
| Shader compile / pipeline-creation stalls | **H** | SwiftShader's compile behaviour is unrelated to a mobile driver's |
| Compositor and vsync behaviour, dropped-frame reporting | **H** | no compositor path resembling a phone's |
| Thermal throttle over 20 minutes | **H** | `RI-JRN04` H8 |
| Input-to-photon latency | **H** | and partly out of scope: `HARNESS.md` §3 says the real input path is bypassed except under `A-JRN1` |

**S\* — the calibration rule for CPU sim time.** Sim time in milliseconds is machine-relative,
so a raw ms figure taken here is not comparable to a phone. `tools/platform/calibrate.mjs` runs a
fixed, deterministic, allocation-free pure-JS workload (a seeded fixed-point integration over
100 k iterations) and reports `cpu_index` = its wall time. Every run records `cpu_index`.
**Sim budgets in §C are stated in `sim_units`**, where
`sim_units = measured_sim_ms × (cpu_index_reference / cpu_index_thismachine)` and the reference
is the declared `phone-mid` class. This makes the sim budget checkable here with a stated and
honest error bar (**±25%**, recorded in the verdict), instead of unmeasurable. It does **not**
make Tier-H measurable: a calibrated CPU index says nothing about a GPU.

### C. `ES/FRAME` — the budget (BINDING)

Four scenarios, chosen because they are the four shapes of load the game actually has. All
budgets are for the **`phone-mid`** reference class unless a column says otherwise.

**C.1 — Tier-H: the frame-time budget (real hardware only)**

| # | Scenario | p50 frame | **p99 frame** | **p99.9 frame** | Worst frame | fps floor |
|---|---|---|---|---|---|---|
| F1 | Fen exterior, traversal, no combat | ≤ 16.7 ms | ≤ 25 ms | ≤ 33 ms | ≤ 50 ms | ≥ 40 |
| F2 | Settlement street, ≥ 12 NPCs, daytime | ≤ 16.7 ms | ≤ 25 ms | ≤ 33 ms | ≤ 50 ms | ≥ 40 |
| F3 | **Boss arena, 1 boss, active fight** | ≤ 16.7 ms | ≤ 20 ms | **≤ 33 ms** | **≤ 33 ms** | **≥ 55** |
| F4 | **6-enemy encounter, all aggroed** | ≤ 16.7 ms | ≤ 20 ms | **≤ 33 ms** | **≤ 33 ms** | **≥ 55** |
| F5 | Dark dungeon interior, 2 enemies | ≤ 16.7 ms | ≤ 25 ms | ≤ 33 ms | ≤ 50 ms | ≥ 45 |

**The rule that matters is F3/F4's worst-frame column: inside the fight, no frame may exceed
33 ms — ever, not at p99.9.** A single 60 ms frame during a boss windup deletes two of the
eighteen frames the player was supposed to read it from, and one 100 ms frame deletes the
entire i-frame window of a roll the player already committed to. Outside the fight a 50 ms
frame is ugly; inside it, it is a death the player did not cause. This is why the item's `side`
is `neutral` but its *reasoning* is Souls: the budget is derived from `RI-CMB01` and `RI-AI02`,
not from a general dislike of stutter.

Additionally, Tier-H: **≥ 3 consecutive frames over 33 ms during `COMBAT` is a hard fail**, and
**any frame over 100 ms outside a declared load boundary is a hard fail** (`RI-PLT03` owns what
counts as a declared load boundary).

**C.2 — Tier-S: the scene budget (scoreable here, today)**

| # | Quantity | F1 fen | F2 settlement | F3 boss | F4 6-enemy | F5 dungeon |
|---|---|---|---|---|---|---|
| S1 | Draw calls / frame | ≤ 300 | ≤ 350 | ≤ 250 | ≤ 320 | ≤ 220 |
| S2 | Triangles / frame | ≤ 900 k | ≤ 800 k | ≤ 700 k | ≤ 850 k | ≤ 500 k |
| S3 | Shader **programs** in the whole build | ≤ 90 | — | — | — | — |
| S4 | Programs bound / frame | ≤ 30 | ≤ 35 | ≤ 25 | ≤ 30 | ≤ 22 |
| S5 | Unique materials / frame | ≤ 60 | ≤ 70 | ≤ 45 | ≤ 55 | ≤ 40 |
| S6 | Material/state changes / frame | ≤ 120 | ≤ 140 | ≤ 90 | ≤ 110 | ≤ 80 |
| S7 | Texture memory resident (MB) | ≤ 220 | ≤ 220 | ≤ 180 | ≤ 220 | ≤ 160 |
| S8 | Skinned meshes / frame | ≤ 14 | ≤ 20 | ≤ 6 | ≤ 10 | ≤ 6 |
| S9 | Real-time shadow-casting lights | ≤ 2 | ≤ 2 | ≤ 3 | ≤ 2 | ≤ 3 |

`RI-PLT02` owns the totals (heap, texture memory ceiling for the whole session); the S7 row here
is *per-scenario residency*, which is a different number, and if the two ever conflict
`RI-PLT02` wins.

**C.3 — Tier-S: the simulation budget (the one that protects the corpus)**

| # | Quantity | Budget | Note |
|---|---|---|---|
| **P1** | **Sim CPU per fixed step, p50** | ≤ **4.0 sim_units** | of the 16.67 ms frame, at `phone-mid` reference |
| **P2** | **Sim CPU per fixed step, p99** | ≤ **8.0 sim_units** | |
| **P3** | **Sim CPU per fixed step, max, in F3/F4** | ≤ **12.0 sim_units** | a sim step that alone eats 12 ms leaves 4.7 ms for everything else |
| **P4** | **Bytes allocated per fixed step, steady state** | **0 bytes** in F1/F5; ≤ **2 KB** in F3/F4 | **see the allocation rule below** |
| **P5** | Major GC events attributable to the sim loop, per 10 000 frames | **0** | |
| **P6** | Minor GC events per 10 000 frames | ≤ 20 | |
| **P7** | Total GC pause per minute of play | ≤ **50 ms**, and no single pause > **10 ms** | pauses are Tier-H in *duration*; **counts and attribution are Tier-S** |
| **P8** | Sim steps executed per second when render is throttled to 15 fps | **exactly 60** | the fixed sim does not slow when render does |
| **P9** | Trace `body_sha256` under 3 different render rates, same seed | **identical** | `RI-MTH02` D5, restated as a load test |

**The allocation rule (P4), stated as the brief demands.** *Per-frame allocation in the
simulation loop is a defect, not a tuning opportunity.* A JS engine's garbage collector is the
one source of multi-millisecond pauses that a browser game cannot schedule around, and a pause
during a boss windup is indistinguishable to the player from an unfair attack. The simulation
loop must therefore be **allocation-free in steady state**: no object literals, no array
literals, no closures created per frame, no `map`/`filter`/`slice` in the hot path, no string
concatenation, no boxed vectors returned from functions. Vectors are pre-allocated and reused;
collections are pooled; the trace record (which *is* allocated) is built **outside** the sim
step and is excluded from P4 by name.

**Detection (Tier-S, exact, no guessing):** `stepFrames(1)` is bracketed by heap-usage reads
(`A-JRN5` `getPerfStats().heapUsed`, backed by CDP `Runtime.getHeapUsage`) with the GC forced
immediately before via `--js-flags=--expose-gc`. The per-step delta over 600 steady-state steps
is the allocation figure. A steady-state game logic loop that allocates shows up as a
monotonically rising heap between forced collections with a slope of *bytes per frame*, and
`tools/platform/alloc-probe.mjs` reports exactly that slope. **This is Tier-S and there is no
excuse for not running it**: it needs no GPU and it is the single most predictive number for
whether the game will stutter on a phone.

**C.4 — Tier-S: the sim/render contract (structural, pass/fail)**

| # | Requirement | Evidence |
|---|---|---|
| **R1** | The simulation advances in integer steps of exactly 1/60 s. No `deltaTime` in gameplay code. | `HARNESS.md` R2. Trace `t_ms` deltas are exactly 16.666…, and `f` increments by exactly 1 |
| **R2** | Rendering may be skipped, throttled, or run at any rate, and **nothing in the trace changes** | P8/P9 |
| **R3** | If real time runs ahead of the sim, the sim catches up with **bounded** step-count per rAF (max 5 steps, then time is dropped) and **never** by taking a larger step | a spiral-of-death guard; a variable step is an automatic fail of the piece per `HARNESS.md` R2 |
| **R4** | Dropped render frames never drop sim frames within the R3 bound | P8 |
| **R5** | Input is sampled per rAF, latched, and consumed by the next sim step (`RI-JRN04` §D) | `RI-JRN04` M-P9 |
| **R6** | No `Date.now()`/`performance.now()` in any code path that changes sim state | `HARNESS.md` D3, detected by D5 |

### D. Why this cannot be met by lowering fidelity in secret

**Rule F1 (the trade rule).** A fidelity reduction is a legitimate response to a §C.1 or §C.2
failure **only if** it is recorded in `reports/platform/tradeoffs.json` with: the check that
failed, the measured value, the `RI-VIS03`/`RI-VIS04` metric that was reduced, and the measured
value of *that* metric before and after. `critic.fidelity` then judges the new value against
its own bar with no allowance whatsoever. **The trade is permitted; the concealment is not.**

**Rule F2.** "It runs at 60 fps though" remains an illegitimate defence of low fidelity
(`RI-VIS04`), and "it looks better this way" remains an illegitimate defence of a blown frame
budget. Both items score independently; a build may lose both.

**Rule F3.** A performance defence that does not cite a specific row of §C is void under
`CRITIC-DOCTRINE.md` §2.4.3.

## Comparison method

Run by `critic.platform` (fleet critic **JC-P1**, see `JOURNEY-CRITIC-FLEET.md`).

```bash
# Tier-S — runs here, today, in this container
node tools/platform/calibrate.mjs --out reports/platform/<runId>/calibrate.json
node tools/platform/perf-run.mjs --scenarios F1,F2,F3,F4,F5 --seed 4711 \
     --tier S --frames 6000 --out reports/platform/<runId>
node tools/platform/alloc-probe.mjs --in reports/platform/<runId>
node tools/platform/decoupling.mjs --render-rates 60,30,15 --in reports/platform/<runId>

# Tier-H — refuses to emit unless the manifest attests a real GPU
node tools/platform/perf-run.mjs --scenarios F1,F2,F3,F4,F5 --tier H \
     --device-class phone-mid --out reports/platform/<runId>-hw
```

Requires **`A-JRN5`** (`getPerfStats()` per frame + `traceStart({perf:true})`), **`A-JRN8`**
(`getWorldStats()` extended with `programs`, `materials`, `stateChanges`, `skinnedMeshes`,
`shadowLights`, `geometryMB`), **`A-JRN9`** (forced GC + heap usage) and **`A-JRN11`** (render
throttling: `setRenderRate(hz)` so the sim can be observed with render decoupled). Until they
exist, every check is `unmeasurable` and scores **0**, fail-closed.

| # | Tier | Check | Procedure | Threshold |
|---|---|---|---|---|
| **M1** | S | Scene budget | `getWorldStats()` + per-frame `getPerfStats()` over 6 000 frames per scenario; take the **max**, not the mean — a budget is a ceiling | Every row of §C.2, all 5 scenarios. Report the full table |
| **M2** | S | Program/material census | Build-wide program count from the extended stats; per-frame binds and state changes | S3–S6 |
| **M3** | S | **Sim CPU time** | `setRenderRate(0)` (render disabled), then `stepFrames(1)` × 6 000 with `performance.now()` around each step; convert to `sim_units` using `calibrate.json`; report p50/p99/max **with the ±25% calibration error bar stated** | P1–P3 |
| **M4** | S | **Per-step allocation** | `alloc-probe.mjs`: forced GC, then heap delta per step over 600 steady-state steps, per scenario. Also report the *identity* of the top 5 allocation sites from a CDP sampling heap profile | P4. **Hard fail: > 8 KB/step in any scenario** |
| **M5** | S | GC census | `--expose-gc` off; PerformanceObserver + heap sawtooth analysis over 10 000 frames; attribute each collection to the sim window or outside it | P5, P6. Pause *durations* (P7) are reported but Tier-H |
| **M6** | S | **Sim/render decoupling** | Run F3 at render rates 60, 30, 15 and 0 Hz for 60 s of sim each. Count sim steps; compare trace `body_sha256` | **Exactly 3 600 steps at every rate; all four `body_sha256` identical.** **Hard fail: any difference** |
| **M7** | S | Frame-rate independence of gameplay | At each render rate: character displacement over 600 steps with a fixed input; stamina consumed; camera degrees turned at a fixed stick deflection | Identical to 6 dp at all rates. **Hard fail: any drift** — it means `deltaTime` is in the sim |
| **M8** | S | Catch-up bound (R3) | Block the main thread for 400 ms (`A-JRN11` `stallMainThread(ms)`), then observe | ≤ 5 sim steps executed in the recovery rAF; **0** steps of non-1/60 duration; no spiral |
| **M9** | S | Integer-step audit | Trace `t_ms` deltas and `f` increments over a full run | 100% exactly 16.666…/+1. **Hard fail: any variable step** — this voids every combat item (`HARNESS.md` R2) |
| **M10** | H | **Frame-time distribution** | 6 000 frames per scenario on attested hardware; p50/p99/p99.9/max/fps-floor | §C.1, all 5 scenarios |
| **M11** | H | **Combat worst-frame** | From F3/F4 traces, the frame-time series restricted to frames where any enemy `alert_state === 'AGGRO'` | **0** frames > 33 ms. **Hard fail: ≥ 3 consecutive frames > 33 ms** |
| **M12** | H | Catastrophic frames | Whole session, excluding declared load boundaries (`RI-PLT03`) | **0** frames > 100 ms |
| **M13** | H | GC pause duration | Long-task census correlated with GC events | P7 |
| **M14** | H | Thermal hold | 20-minute continuous F1→F2→F4 loop on a phone; compare the last 5 minutes' distribution to the first 5 | p99 degradation ≤ **15%**; fps floor still met (`RI-JRN04` H8) |
| **M15** | S | **Attestation integrity** | Read every run manifest cited in the verdict; check `renderer.unmaskedRenderer` and `deviceClass` | **Any Tier-H number sourced from a software-renderer manifest is a `RI-MTH04` falsification, voids the verdict, and is reported as such.** This check is run by the critic *on itself* |

## Scoring

Native scale: **0–100**, weighted, plus hard fails that cap the item at **2**.

| Block | Tier | Weight | Checks |
|---|---|---|---|
| **Sim integrity — the fixed step is real** | S | **26** | M6 (10), M9 (8), M7 (5), M8 (3) |
| **Sim cost and allocation** | S | **22** | M4 (10), M3 (8), M5 (4) |
| **Scene budget** | S | **14** | M1 (10), M2 (4) |
| **Measurement honesty** | S | **2** | M15 (2) |
| **Frame-time distribution** | **H** | **20** | M10 (20) |
| **Combat frame integrity** | **H** | **12** | M11 (12) |
| **Catastrophes and thermals** | **H** | **4** | M12 (2), M13 (1), M14 (1) |

**Tier-S total: 64. Tier-H total: 36.** A run in this container can therefore reach at most
**64**, which lands in "Recognisably attempting it", ladder ceiling **5**. Per rule T2 that
ceiling is not a bug and may not be lifted by re-weighting.

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 50–69 | Recognisably attempting it | 5 |
| < 50 | **We lose** | 4 |

**Hard fails (any one caps the item at 2 and sets `status: FAIL`):**

- **HF1** — Variable-timestep simulation, or any non-1/60 step (M9). *This is an automatic fail
  of the whole piece per `HARNESS.md` R2, not merely of this item: every frame-data item in
  `corpus/10-combat/` becomes unmeasurable.*
- **HF2** — Simulation step count or trace hash changes with render rate (M6).
- **HF3** — Any gameplay quantity that drifts with frame rate (M7).
- **HF4** — > 8 KB allocated per sim step in any scenario (M4).
- **HF5** — ≥ 3 consecutive frames over 33 ms during combat, on attested hardware (M11).
- **HF6** — Any frame over 100 ms outside a declared load boundary (M12).
- **HF7** — A Tier-H number reported from a software-renderer run (M15) — falsification under
  `RI-MTH04`.
- **HF8** — A fidelity reduction made to pass this item that is absent from
  `reports/platform/tradeoffs.json` (rule F1).

## How we lose

1. **The sim is `requestAnimationFrame` with `deltaTime`.** It is what every Three.js example
   does, it feels fine on the builder's machine, and it makes `RI-CMB01`'s 13-frame i-frame
   window a *duration* that varies with load. HF1, and it silently voids the entire combat area
   of the corpus. This is the most consequential single failure available to this project.
2. **Sim and render are "decoupled" but the sim still calls `performance.now()`.** The step
   count is right, the trace is not reproducible, and `RI-MTH02` D5 fails in a way that looks
   like flakiness rather than like a design error.
3. **Per-frame allocation everywhere.** `new THREE.Vector3()` inside the update loop, `.map()`
   over the entity list, a template string for a debug label, a fresh object for every hitbox
   query. Each is invisible; together they are 200 KB/frame, a major GC every few seconds, and a
   stutter that always seems to happen "randomly" — which is to say, during long fights, because
   that is when the most objects are allocated.
4. **Everything is measured in this container and declared fine.** Draw calls are 180, triangles
   are 400 k, sim time looks tiny, and nobody has ever run the game on a phone. Tier-H scores 0,
   the item caps at 5, and the honest reading is "we do not know if this runs" — but the
   temptation to re-weight the item so the measurable parts total 100 will be enormous. T2
   exists for that temptation.
5. **The opposite error: SwiftShader frame times are reported as evidence.** "We measured 4 fps,
   so we need to cut the vegetation." The 4 fps is a fact about a software rasteriser and
   implies nothing about a phone. Acting on it wastes a wave of work and degrades the game for
   no reason. HF7 covers reporting it; this failure is *believing* it.
6. **The budget is met at p50 and blown at p99.9.** Average frame time is the metric that is
   easiest to measure and least related to how a fight feels. A game at a 12 ms mean with a
   90 ms frame every four seconds is unplayable and reports beautifully.
7. **The autosave.** `RI-JRN05` M18 and this item's M12 are the same bug seen from two sides: a
   1.5 MB synchronous serialisation lands as a 120 ms frame, and it lands during combat because
   that is when quest stages change.
8. **Shadow lights multiply.** Three real-time shadow casters look wonderful in a settlement and
   are four extra full scene passes. S9 exists because this is the easiest way to quadruple draw
   calls without touching a single asset.
9. **Streaming does the allocation.** The sim loop is clean; the region loader parses 3 MB of
   JSON on the main thread at a border. `RI-PLT03` owns the hitch, this item owns the GC that
   follows it, and each will assume the other is handling it.
10. **The catch-up spiral.** A 400 ms stall queues 24 sim steps, which take longer than a frame,
    which queues more. The game locks up and the bug report says "it froze". R3's bounded
    catch-up is five lines and is always written after the first freeze rather than before.
11. **`getWorldStats()` reports what the builder counted, not what the GPU received.** Draw calls
    are read from a Three.js `renderer.info` snapshot taken before the UI pass, or after a
    `renderLists` reset. The number is honest-looking and wrong by half. The critic must assert
    the counter is read **after** the final present of the frame.
12. **Nobody ever tests with render disabled.** M3 and M6 both require `setRenderRate(0)`, and if
    `A-JRN11` is not built, sim cost can only be measured *through* the software rasteriser,
    where it is buried under a 200 ms rasterisation and cannot be seen at all.

## Provenance note

- **`constructed`, confidence high, and binding** — every number in §C, the Tier-S/Tier-H
  partition in §B, the calibration scheme in §A (S\*), the allocation rule and its detection
  method in §C.3, the trade rules in §D, and every threshold and weight in
  `## Comparison method` and `## Scoring`. No upstream reference states a frame budget for "a
  Souls-combat browser game on a mid-range phone", so we defined one we can measure
  (CORPUS-CONTRACT §3). The p50 ≤ 16.7 ms / p99 ≤ 33 ms / 0 frames > 100 ms shape is taken from
  **BAR-CRITIQUE-01 rank 13's proposal** and then tightened for combat scenarios (p99 ≤ 20 ms,
  worst ≤ 33 ms in F3/F4) because that critique did not distinguish inside-the-fight from
  outside it and this item's whole argument is that the distinction is the point.
- **`canonical-recall`, confidence high** — the environmental facts: that this container renders
  through ANGLE/SwiftShader (stated in `HARNESS.md` §1); that JS major GC pauses are unschedulable
  and multi-millisecond; that `WEBGL_debug_renderer_info` exposes an unmasked renderer string;
  that `--js-flags=--expose-gc` and CDP `Runtime.getHeapUsage` / `HeapProfiler` allow heap-delta
  measurement. **No frame rate has been measured anywhere in this item.** Every §C.1 row is a
  target, not an observation, and is labelled Tier-H precisely so it cannot be mistaken for one.
- **Derived, confidence medium** — the *reasoning* linking frame rate to combat correctness
  (13 i-frames at 60 Hz ≈ 217 ms; an 18-frame telegraph at 40 fps ≈ 12 displayed images) is
  arithmetic over `RI-CMB01` and `RI-AI02`'s published windows. If those items change their
  numbers, this item's argument survives but its illustrative figures must be updated.
- **Owned elsewhere, cited not restated:** memory, asset totals and leak slope → `RI-PLT02`.
  Load time, streaming, hitches, declared load boundaries, `TTFP` → `RI-PLT03`. Determinism and
  `body_sha256` → `RI-MTH02`. Measurement integrity and falsification → `RI-MTH04`. Fidelity
  metrics → `RI-VIS03`/`RI-VIS04`. The phone as the reference device → `RI-JRN04` H7/H8. Input
  sampling and latching → `RI-JRN04` §D. Save-write cost → `RI-JRN05` M15/M18.
- **Harness dependency.** `A-JRN5`, `A-JRN8`, `A-JRN9`, `A-JRN11`. Until they land this item is
  **unmeasurable** and scores **0**, fail-closed. Full request in
  `JOURNEY-CRITIC-FLEET.md` §7.
