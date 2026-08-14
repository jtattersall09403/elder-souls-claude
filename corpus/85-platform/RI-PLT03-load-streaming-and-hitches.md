---
id: RI-PLT03
title: Load, streaming, and hitches — time to first playable, silent region borders, and a hitch census
kind: number
side: neutral
judges: [platform.load.streaming, platform.load.ttfp, platform.load.hitches]
provenance: constructed
confidence: high
blind_pair: no
---

> **Part of the platform budget that closes BAR-CRITIQUE-01 G13** alongside `RI-PLT01` and
> `RI-PLT02`.
>
> **This item owns `TTFP` (time to first playable) and every load boundary in the project.**
> `RI-JRN01` O5 cites `P1` below and does not restate it. `RI-JRN01` O15 (loading
> discontinuities in the opening) and `RI-JRN05`'s warm-load number both consume this item's
> definitions. `RI-PLT01` owns the per-frame budget **outside** declared load boundaries and
> depends on this item to define what a declared load boundary is — that definition is §B and
> it is deliberately narrow, because "declared load boundary" is otherwise the loophole through
> which every stutter escapes the frame budget.
>
> **`RI-PLT02` owns what streaming leaves behind**; this item owns what streaming costs while it
> happens. **The reference device is a mid-range phone on a mid-range connection**
> (`RI-JRN04` H7).
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

Two numbers and one absence.

**The first number** is how long it takes, from clicking a link on a phone with a cold cache,
to moving a character in a world. Morrowind's opening survives because the game starts almost
immediately and never stops; `RI-JRN01`'s entire argument — one surface, no unskippable time,
control before definition — is void if the player spends ninety seconds watching a progress bar
before any of it happens. **The bar is ≤ 12 s cold on the reference class, and ≤ 4 s warm.**

**The second number** is how often the world stops being smooth once it has started. The world
takes an hour to cross on foot (S17) and it streams the whole way. Every region border, every
interior door, every enemy that spawns with an unseen material, every quest that first touches a
data file is a chance to drop a frame. **The bar is ≤ 1 hitch per traversal minute, none of them
over 100 ms, and none of them inside combat.**

**The absence** is the one that costs design work rather than engineering: **a region border must
not be a door.** The cheapest way to hide streaming is to put a loading screen between regions,
and it converts a continuous world into a set of levels. Morrowind's exterior is continuous; ours
is too, and that is a streaming requirement, not a rendering one.

## The reference artifact

### A. Tiering (inherited from `RI-PLT01` §A/§B rules T1–T3, binding here)

| Quantity | Tier | Why |
|---|---|---|
| Bytes fetched to first playable; request count; critical-path waterfall | **S** | build + network, GPU-independent |
| **CPU work at a load boundary**: JSON parse, mesh build, scene-graph construction, texture transcode (CPU side) | **S** | pure JS/WASM |
| Sim frames lost at a boundary; whether the sim was blocked at all | **S** | structural, from the trace |
| Whether a boundary is a *surface* (a loading screen) or is continuous | **S** | screenshots + the surface census from `RI-JRN01` M1 |
| Streaming prefetch correctness: was the region requested before it was needed | **S** | timing of requests vs player position, both ours |
| Hitch **count** attributable to a CPU cause | **S** | long-task census on the JS thread |
| **`TTFP` wall-clock** | **H** | dominated by first-frame rasterisation and shader compile on a real driver |
| **Hitch durations in ms; frame-time spikes** | **H** | `RI-PLT01`'s Tier-H rules apply |
| GPU upload stalls, shader/pipeline compile stalls | **H** | no GPU |
| Real-network behaviour (RTT, throughput, HTTP/2 prioritisation on a phone radio) | **H** | can be *emulated* here via CDP throttling, which gives a **Tier-S′ estimate** with a stated error bar, not a Tier-H number |

**Tier-S′ — network emulation.** CDP `Network.emulateNetworkConditions` gives a reproducible,
deterministic transfer time. Combined with Tier-S CPU work, it yields a **modelled** `TTFP`:
`TTFP_model = transfer_time(emulated) + cpu_boundary_work(measured) + a declared GPU constant`.
It is reported as `TTFP_model` with the GPU constant stated separately, and it may **never** be
reported as `TTFP`. It is useful for regression detection (did our load work get worse?) and
useless as a claim about a phone.

### B. What counts as a declared load boundary (BINDING — the definition `RI-PLT01` depends on)

`RI-PLT01` HF6 forbids any frame over 100 ms "outside a declared load boundary". If that phrase
is loose, every stutter becomes a boundary. It is therefore closed:

> A **declared load boundary** is one of exactly four events, each of which must emit a
> `load_boundary_begin`/`load_boundary_end` trace event pair with a `kind`, and each of which is
> separately budgeted in §C:
>
> 1. **`initial`** — from `navigationStart` to the first playable frame. Once per session.
> 2. **`interior`** — crossing a door between the exterior and a named interior cell, in either
>    direction, **only where the interior is a separate cell** (`world.interior.named`).
> 3. **`fasttravel`** — arriving via the S7 transport network at a station.
> 4. **`death`** — respawn at a HEARTH (`RI-JRN06` D7).
>
> **A region border is NOT a load boundary.** Neither is spawning an enemy, opening a menu,
> starting a quest, entering combat, saving, or loading a texture. A frame over 100 ms during
> any of those is a `RI-PLT01` HF6 failure and there is no boundary to declare.

**Rule B1.** The number of `load_boundary_begin` events in a 40-minute session is bounded: ≤ 1
`initial`, ≤ 20 `interior`, ≤ 4 `fasttravel`, ≤ 8 `death`. A build that emits boundaries
liberally to escape the frame budget is falsifying under `RI-MTH04`, and B1 is the detector.

**Rule B2.** Even inside a declared boundary, **the boundary must be bounded**: §C gives each
kind a maximum, and exceeding it is a failure of *this* item rather than an escape from
`RI-PLT01`.

### C. `ES/LOAD` — the budget (BINDING)

> **A FILED HOLE IN THIS SECTION: every streaming budget here is defined at a walk.** See
> `orchestration/amendments/AM-W1-01-PS-01-plt03-needs-a-motion-axis.md`, filed by
> `crit-w1-01-provstream-r1-3c19` on 2026-08-07. C.3's **S4** (hitches per traversal *minute of
> continuous walking*) and **S7** (prefetch lead ≥ 20 s *of walking*) are both anchored to 2.0 m/s,
> and this build's `RI-TRV01` transport ships a `rootspeak` mode at **40 m/s** — twenty times the
> speed the budgets assume. **Status: filed, not applied. This item is unchanged and still
> governs**; the amendment records the hole rather than working around it, and a piece measuring
> S4/S7 must say which speed it measured at. *(Pointer added 2026-08-14 by
> AUDIT-CITATION-STALENESS — the amendment has been on disk since 7 August and this item never
> named it, so the hole was invisible to anyone who read the item rather than the amendments
> directory.)*

**C.1 — Initial load (`phone-mid`, cold cache, emulated "Fast 3G"-class link unless stated)**

| # | Quantity | Tier | Budget | Fail |
|---|---|---|---|---|
| **P1** | **`TTFP`** — `navigationStart` → the first frame in which a player input moves the character. **This is the number `RI-JRN01` O5 cites** | **H** | ≤ **12.0 s** cold, ≤ **4.0 s** warm | > 20 s cold |
| **P2** | `TTFP_model` (Tier-S′, for regression only) | S′ | ≤ **10.0 s** + declared GPU constant | — |
| **P3** | Time to first **rendered** frame (anything, including the title surface) | H | ≤ **2.5 s** | > 5 s |
| **P4** | Bytes on the critical path to P1, compressed | S | ≤ **18 MB** (`RI-PLT02` D1) | > 30 MB |
| **P5** | Requests on the critical path | S | ≤ **40** | > 120 |
| **P6** | **CPU work at the `initial` boundary** (parse + build + upload prep), sum of long tasks | S | ≤ **3 500 ms** in `sim_units` (`RI-PLT01` S\*) | > 8 000 |
| **P7** | Longest single blocking task during `initial` | S | ≤ **200 ms** | > 800 ms |
| **P8** | Unskippable time on any surface during load | S | **0 s** (`RI-JRN01` O2) | any |
| **P9** | Surfaces crossed during load | S | ≤ **2** (`RI-JRN01` O1) | ≥ 4 |
| **P10** | A progress bar is permitted | — | Yes — but only **inside** the title surface, and only if it is diegetic (`ui.style.diegesis`). It may not be a separate surface, and it may not be the *first* thing shown |

**C.2 — In-session boundaries**

| # | Boundary | Tier | Budget | Fail |
|---|---|---|---|---|
| **L1** | `interior` — door to controllable | H | ≤ **1.2 s** | > 3 s |
| **L2** | `interior` — sim frames lost | S | ≤ **6** (0.1 s) | > 30 |
| **L3** | `fasttravel` — arrival to controllable | H | ≤ **3.0 s** | > 6 s |
| **L4** | `death` — respawn to controllable | H | ≤ **4.0 s** (`RI-JRN06` D7, cited) | > 8 s |
| **L5** | Any boundary: longest single blocking task | S | ≤ **120 ms** | > 400 ms |
| **L6** | Boundary counts per 40-minute session | S | Rule B1 | exceeded |

**C.3 — Streaming and hitches (the continuous world)**

| # | Quantity | Tier | Budget | Fail |
|---|---|---|---|---|
| **S1** | **A region border is a surface** | S | **Never.** 0 surfaces, 0 fades to black, 0 "Loading…" text, 0 forced stops | any |
| **S2** | Sim frames lost at a region border | S | **0** | ≥ 1 |
| **S3** | Longest blocking task at a region border | S | ≤ **60 ms** | > 150 ms |
| **S4** | `hitches_per_traversal_minute` — frames > 50 ms outside declared boundaries, per minute of continuous walking | H | ≤ **1.0** | > 3.0 |
| **S5** | Hitches > 100 ms outside declared boundaries | H | **0** (`RI-PLT01` HF6) | any |
| **S6** | Hitches during `COMBAT` | H | **0** (`RI-PLT01` C.1 F3/F4) | any |
| **S7** | **Prefetch lead time** — region requested before the player can reach its border | S | ≥ **20 s** of walking at `RI-WLD01` walk speed | < 5 s |
| **S8** | Prefetch waste — regions fetched and never entered, per 40-minute session | S | ≤ **3** | > 8 |
| **S9** | Streaming work is off the sim thread | S | 100% of parse/decode in a Worker or chunked across ≤ 8 ms slices | any single ≥ 60 ms task on the sim thread |
| **S10** | **Pop-in** — geometry or texture appearing at a visible LOD transition within 40 m of the camera | S | ≤ **2** events per traversal minute (`render.fidelity.streaming` owns the *quality* judgement; this item owns the *count*) | > 8 |
| **S11** | First-encounter cost — the frame in which an enemy archetype is spawned for the first time in a session | S | ≤ **16 ms** of extra CPU. Warm-up of every archetype's materials/animations happens at the nearest preceding boundary, not on the spawn frame | > 60 ms |
| **S12** | First-quest-touch cost — the frame in which a quest's data is first read | S | ≤ **8 ms**. Quest data is parsed at `initial`, not lazily | > 40 ms |
| **S13** | Audio streaming | S | 0 sim frames lost to audio decode; music streamed (`RI-PLT02` P6) | any |

**S11 and S12 exist because the hitches nobody predicts are the ones that happen exactly once,
at the worst moment**: the first time a boss's moveset is loaded is the frame the boss appears,
and the first time a quest's data is parsed is the frame the player talks to its giver.

## Comparison method

Run by `critic.platform` (fleet critic **JC-P3**).

```bash
# Tier-S / S′ — runs here today
node tools/platform/load-run.mjs --profile phone-mid --network fast3g --cold \
     --seed 4711 --out reports/platform/<runId>
node tools/platform/hitch-census.mjs --in reports/platform/<runId>
node tools/platform/stream-audit.mjs --traverse regionA:regionD --minutes 20 \
     --in reports/platform/<runId>

# Tier-H — refuses to emit without an attested real-GPU manifest (RI-PLT01 T1)
node tools/platform/load-run.mjs --tier H --device-class phone-mid --out reports/platform/<runId>-hw
```

Requires **`A-JRN5`** (per-frame perf), **`A-JRN7`** (the `load_boundary_begin/end`,
`region_stream_in/out`, `hitch` trace events), **`A-JRN9`** (heap/GC) and **`A-JRN15`**
(`getLoadState()` → `{phase, bytesFetched, requestsInFlight, regionsResident, prefetchQueue}`
plus CDP network throttling wired into the runner). Until they exist every check is
`unmeasurable` and scores **0**, fail-closed.

| # | Tier | Check | Threshold |
|---|---|---|---|
| **M-L1** | H | **`TTFP`** — cold profile, cleared storage, attested hardware; `navigationStart` → the trace's `first_control` event (`A-JRN1`) | P1. **This is the number every other item cites; it is reported once, here** |
| **M-L2** | S′ | **`TTFP_model`** — emulated network + measured CPU boundary work + declared GPU constant | P2, reported with the constant stated and never as `TTFP` |
| **M-L3** | S | **Critical path** — CDP network log to `first_control` | P4, P5. Report the waterfall |
| **M-L4** | S | **Initial CPU work** — long-task census between `navigationStart` and `first_control`, in `sim_units` | P6, P7 |
| **M-L5** | S | **Load surfaces** — screenshot every 250 ms; count full-viewport states with no world behind (`RI-JRN01` M1's instrument) | P8, P9, P10. **Hard fail: an unskippable surface, or ≥ 4 surfaces** |
| **M-L6** | S | **Boundary census** — every `load_boundary_begin` in a 40-minute session, by kind | Rule B1. **Hard fail: a boundary declared for anything outside §B's four kinds** — falsification under `RI-MTH04` |
| **M-L7** | H | **Boundary durations** — L1, L3, L4 on attested hardware | C.2 |
| **M-L8** | S | **Boundary sim cost** — sim frames lost and longest blocking task per boundary | L2, L5 |
| **M-L9** | S | **Region borders are not surfaces** — walk a 20-minute route crossing ≥ 6 borders; screenshot every 250 ms; count surfaces, fades, and forced stops | S1. **Hard fail: any** |
| **M-L10** | S | **Region border sim cost** — from the trace, sim frames advanced across each `region_stream_in`, and the longest blocking task in a ±3 s window | S2, S3. **Hard fail: any lost sim frame at a border** |
| **M-L11** | H | **Hitch census** — frames > 50 ms and > 100 ms across the 20-minute traversal, excluding declared boundaries; and restricted to frames with a hostile in `AGGRO` | S4, S5, S6. **Hard fail: any > 100 ms hitch outside a boundary, or any hitch in combat** |
| **M-L12** | S | **Hitch attribution** — for every hitch, the top long-task stack frame from a CDP CPU profile | Every hitch attributed to a named cause. **An unattributed hitch is reported as such and is not treated as absent** |
| **M-L13** | S | **Prefetch** — from `getLoadState()`, the time between a region entering `prefetchQueue` and the player crossing its border | S7, S8 |
| **M-L14** | S | **Off-thread streaming** — long tasks on the sim thread during any `region_stream_in` | S9. **Hard fail: a ≥ 60 ms sim-thread task during streaming** |
| **M-L15** | S | **Pop-in count** — frame-to-frame pixel-delta spikes within 40 m of the camera during traversal, cross-checked against `region_stream_in` timing | S10 |
| **M-L16** | S | **First-encounter cost** — spawn the first instance of each of the `RI-AI05` archetypes; measure the spawn frame's CPU | S11. **Hard fail: > 60 ms on any archetype** |
| **M-L17** | S | **First-quest-touch cost** — first read of each of 20 sampled quests | S12 |
| **M-L18** | S | **Warm load** | P1's warm figure, and `RI-JRN05`'s warm `loadState` → controllable ≤ 3 s (cited, not restated) |
| **M-L19** | S | **Cold-profile honesty** | Every load measurement taken with a fresh browser profile, cleared IndexedDB and cleared HTTP cache, recorded in the manifest. **A load number from a warm profile is void** (`RI-JRN01` "How we lose" #13) |

## Scoring

Native **0–100**, weighted; hard fails cap at **2**.

| Block | Tier | Weight | Checks |
|---|---|---|---|
| **The world is continuous** | S | **30** | M-L9 (14), M-L10 (10), M-L14 (6) |
| **Boundaries are honest and cheap** | S | **18** | M-L6 (8), M-L8 (6), M-L5 (4) |
| **Load work is bounded** | S | **16** | M-L4 (6), M-L3 (4), M-L13 (3), M-L16 (2), M-L17 (1) |
| **Integrity** | S | **6** | M-L19 (4), M-L12 (2) |
| **`TTFP`** | **H** | **18** | M-L1 (14), M-L7 (4) |
| **Hitches in the wild** | **H** | **12** | M-L11 (12) |

**Tier-S total: 70. Tier-H total: 30.** A container-only run caps at 70 → band "Below bar",
ladder ceiling 6 (`RI-PLT01` rule T2 applies).

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 50–69 | Recognisably attempting it | 5 |
| < 50 | **We lose** | 4 |

**Hard fails (any one caps at 2, `status: FAIL`):**

- **HF1** — A region border that is a surface, a fade, or a forced stop (M-L9).
- **HF2** — Any sim frame lost at a region border (M-L10).
- **HF3** — A load boundary declared for anything outside §B's four kinds (M-L6) —
  falsification under `RI-MTH04`, and it is the loophole `RI-PLT01` HF6 depends on being closed.
- **HF4** — Any frame > 100 ms outside a declared boundary, or any hitch during combat (M-L11)
  — shared with `RI-PLT01` HF6/HF5.
- **HF5** — An unskippable load surface, or ≥ 4 surfaces before first playable (M-L5) — also
  `RI-JRN01` HF2.
- **HF6** — A ≥ 60 ms sim-thread task during streaming (M-L14).
- **HF7** — A load number reported from a warm profile (M-L19).

## How we lose

1. **A loading screen between regions.** It is the correct engineering answer, it is trivial to
   implement, it makes every hitch disappear, and it turns a continuous Black Marsh into a menu
   of levels. HF1. This is the single decision that would most change what the game *is*, and it
   will be proposed as a performance fix.
2. **The border stutters instead**, because streaming happens on the main thread: a 4 MB JSON
   parse plus mesh construction, 300 ms, once per border, every border, forever. HF2/HF6.
3. **Everything is loaded up front to avoid streaming.** `TTFP` becomes 70 s, `RI-PLT02` A1
   blows on a phone, and `RI-JRN01`'s opening is dead on arrival because the player watched a
   bar for a minute before the first sentence.
4. **`TTFP` is measured on a warm profile.** 1.8 s, reported proudly, and every real first
   visitor waits 25 s. HF7, and it is the easiest number in the whole corpus to accidentally
   fake.
5. **"Loading" becomes a declared boundary for anything inconvenient.** Enemy spawns, quest
   starts, menu opens — each emits a boundary event and each escapes `RI-PLT01`'s frame budget.
   §B's closed list and rule B1 exist because this is not a hypothetical: it is what any team
   under pressure would do, and it would be done in good faith.
6. **The boss's first frame is a 400 ms hitch,** because its moveset, materials and animations
   are loaded on spawn. The player's first impression of the most important encounter in the
   region is a freeze. S11.
7. **The first conversation with a quest-giver hitches** because that quest's JSON is parsed
   lazily. Twenty quests, twenty hitches, each at a narratively important moment. S12.
8. **Prefetch is reactive.** The region is requested when the player crosses into it, so the
   first two seconds of a new region are empty terrain filling in. S7, and it also fails
   `render.fidelity.streaming`.
9. **Prefetch is greedy.** Everything within 2 km is fetched, `RI-PLT02` A1 blows, and the phone
   discards the tab. S8 is the counterweight to S7 and they must be tuned against each other.
10. **The hitch census is run on a desktop.** Zero hitches, because the desktop has eight cores
    and a hundred times the memory bandwidth. Tier-H, attested hardware, phone class.
11. **Hitches are counted but not attributed.** "We saw three hitches" is not a finding; "three
    hitches, all in `parseRegion`" is. M-L12 requires a stack for every one, and an unattributed
    hitch must be reported as unattributed rather than quietly dropped.
12. **The progress bar becomes a surface.** A full-screen loading page with a bar, then the
    title, then the game. `RI-JRN01` O1's surface budget is spent on a bar. P10 permits the bar
    *inside* the title surface and nowhere else.

## Provenance note

- **`constructed`, confidence high, and binding** — the boundary definition in §B (including
  rules B1/B2), every budget in §C, and every threshold and weight below. `TTFP`'s ≤ 12 s cold /
  ≤ 4 s warm and the ≤ 1 hitch/traversal-minute figure are ours; no upstream source states them.
  The tier rules T1/T2/T3 and the `sim_units` calibration are inherited verbatim from
  `RI-PLT01` §A and are not re-derived here.
- **`canonical-recall`, confidence high** — the platform facts relied on: that CDP exposes
  network emulation, long-task and CPU-profile data; that Workers can parse and build off the
  main thread while `postMessage` transfer of typed arrays is cheap; that mobile first-load is
  dominated by transfer and first-frame compile rather than by steady-state rendering; that
  browsers do not warn before discarding a tab. Recalled, **not measured here**.
- **No load or hitch figure in this item has been measured.** There is no game. §A's tier table
  states exactly which of these this container can check, and `TTFP` is explicitly **not** one of
  them — which matters because `RI-JRN01` O5 cites P1, and that citation must resolve to
  `unmeasurable`, not to a SwiftShader number.
- **Owned elsewhere, cited not restated:** the frame budget, the tier rules, the `sim_units`
  calibration and the >100 ms rule → `RI-PLT01`. Memory ceilings, resource release and the
  download budget → `RI-PLT02`. Respawn time → `RI-JRN06` D7. Warm `loadState` time →
  `RI-JRN05`. Surface counting and unskippable-time instruments → `RI-JRN01` M1/M2. Walk speed →
  `RI-WLD01`, seam S17. LOD/pop-in quality → `render.fidelity.streaming`. Interior cells →
  `world.interior.named`. Transport network → seam S7. Falsification → `RI-MTH04`.
- **Harness dependency.** `A-JRN5`, `A-JRN7`, `A-JRN9`, `A-JRN15`; M-L1 additionally needs
  `A-JRN1`'s `first_control` event. Until they land this item is **unmeasurable** and scores
  **0**, fail-closed. Full request in `JOURNEY-CRITIC-FLEET.md` §7.
