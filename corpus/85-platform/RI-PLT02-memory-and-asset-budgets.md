---
id: RI-PLT02
title: Memory, asset budgets, and the ten-minute traversal leak test — sized for a phone
kind: number
side: neutral
judges: [platform.perf.memory, platform.asset.budget]
provenance: constructed
confidence: high
blind_pair: no
---

> **Part of the platform budget that closes BAR-CRITIQUE-01 G13** alongside `RI-PLT01` and
> `RI-PLT03`. With these three in place, `CRITIC-DOCTRINE.md` §2.4.3's caveat — *"platform
> limits are judged only where a `platform.*` item explicitly sets the budget"* — resolves to a
> real budget, and *"good for a browser game"* is fully banned.
>
> **Division of labour, binding:** `RI-PLT01` owns **per-frame** cost, including
> **allocations per simulation step** and GC attribution. This item owns **totals over a
> session**: heap ceiling, texture and geometry ceilings, the download budget, and the **leak**.
> Per-frame allocation and session-scale leak are different failures with different causes and
> they are deliberately in different items. `RI-PLT03` owns **load time and streaming**; this
> item owns what streaming is allowed to leave behind. `RI-JRN05` owns the **save store** on
> disk, which is not memory and is not counted here. `RI-VIS03`/`RI-VIS04` own fidelity, and
> the trade against this item is governed by `RI-PLT01` §D rule F1.
>
> **The reference device is a mid-range phone** (`RI-JRN04` H7). Every number below is for that
> class. A budget met on a workstation is not a budget.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

The player has been in the world for forty minutes on a phone with other tabs open. They have
crossed four regions, entered fifteen interiors, fought thirty encounters, and died six times.
**The tab has not been evicted, the game has not slowed, and the heap is the same size it was
after the first minute.**

That last clause is the whole item. A browser game that leaks 3 MB per region transition is
fine for ten minutes, degrades at thirty, and is killed by the OS at fifty — and the bug report
says "it crashed", which is the least actionable sentence in software. Mobile browsers do not
warn, do not swap, and do not negotiate: they discard the tab. **The player loses everything
since the last autosave and, on a phone, they will not come back.**

The bar therefore has three parts. **A ceiling**: the game fits in a budget a mid-range phone
can actually give a tab. **A floor under quality**: the budget is not met by shipping 256×256
textures, because `RI-VIS03` judges that separately and a build may lose both. And **a
derivative**: after ten minutes of traversal and a forced collection, the heap returns to within
a small delta of where it started. The derivative is the hard one and it is the one that decides
whether the game is shippable.

## The reference artifact

### A. Tiering (inherited from `RI-PLT01` §A/§B, binding here too)

| Tier | Meaning |
|---|---|
| **Tier-S** | Software-valid; the number is the same here as on real hardware. **Scoreable in this container today.** |
| **Tier-H** | Requires attested real hardware (`RI-PLT01` rule T1). Scores `unmeasurable` = **0**, fail-closed, and **stays in the denominator** (rule T2). |

Memory is unusually kind to us: **most of this item is Tier-S**, because JS heap size, asset
byte counts, texture dimensions and object retention are properties of our code and data, not
of a GPU. The exceptions are GPU-side residency and the OS's eviction behaviour.

| Quantity | Tier | Why |
|---|---|---|
| JS heap used / total, and its slope over time | **S** | V8 behaviour, GPU-independent |
| Retained object counts by constructor between two snapshots | **S** | heap snapshot diff |
| Detached DOM / detached typed arrays / orphaned event listeners | **S** | same |
| Three.js resource census: geometries, textures, programs, materials alive | **S** | `renderer.info.memory` + our own registry |
| Texture memory computed from dimensions × format × mip chain | **S** | arithmetic over the asset manifest |
| Geometry memory computed from vertex/index counts × attribute layout | **S** | same |
| Total download bytes, per-file bytes, compression ratio | **S** | static analysis of the build |
| Decoded audio buffer bytes | **S** | arithmetic |
| **Actual GPU/VRAM residency and driver-side overhead** | **H** | SwiftShader has no VRAM |
| **`performance.measureUserAgentSpecificMemory()` totals** | **H** | UA-specific and meaningless here |
| **Tab eviction / OOM behaviour under real memory pressure** | **H** | needs a real phone |
| **Thermal/battery cost of the memory traffic** | **H** | needs a real phone |

### B. `ES/MEM` — the budget (BINDING)

**B.1 — Ceilings (Tier-S unless marked)**

| # | Quantity | `phone-mid` | `desktop` | Note |
|---|---|---|---|---|
| **A1** | **JS heap used**, steady state, after a forced GC, in the heaviest scenario | ≤ **220 MB** | ≤ 420 MB | the number that decides eviction |
| **A2** | JS heap used, peak transient (during a region stream) | ≤ **300 MB** | ≤ 560 MB | |
| **A3** | **Texture memory**, computed, resident | ≤ **200 MB** | ≤ 380 MB | includes mip chains; compressed formats counted at their compressed size |
| **A4** | **Geometry memory**, computed, resident | ≤ **90 MB** | ≤ 160 MB | |
| **A5** | Decoded audio resident | ≤ **40 MB** | ≤ 80 MB | music streamed, not decoded whole |
| **A6** | **Total resident estimate** (A1 + A3 + A4 + A5) | ≤ **550 MB** | ≤ 1040 MB | a mid-range phone tab that exceeds ~600 MB is on borrowed time |
| **A7** | GPU-side residency, measured | — | — | **Tier-H** |
| **A8** | Live `THREE.BufferGeometry` count | ≤ **1 800** | ≤ 3 000 | |
| **A9** | Live `THREE.Texture` count | ≤ **420** | ≤ 700 | |
| **A10** | Live `WebGLProgram` count | ≤ **90** | ≤ 90 | same both classes; `RI-PLT01` S3 |
| **A11** | Live `THREE.Material` count | ≤ **500** | ≤ 800 | |

**B.2 — Download budget (Tier-S, and it is a first-impression budget as much as a memory one)**

| # | Quantity | Budget |
|---|---|---|
| **D1** | **Bytes to first playable frame**, compressed over the wire | ≤ **18 MB** |
| **D2** | JS bundle, compressed | ≤ **2.5 MB** |
| **D3** | `game/data/**` JSON, compressed | ≤ **6 MB** — a 200-quest world of prose compresses extremely well; if this is exceeded, prose is not the reason |
| **D4** | Total for the whole game, all regions, compressed | ≤ **220 MB** |
| **D5** | Largest single asset | ≤ **6 MB** |
| **D6** | Texture format | 100% of world textures in a GPU-compressed format (Basis/KTX2 transcoded) **or** declared as an exception with a reason. PNG/JPEG decoded to RGBA at runtime costs 4 bytes per pixel resident and is the single fastest way to blow A3 |
| **D7** | Assets fetched but never used in a 40-minute session | ≤ **5%** of D4 by bytes |
| **D8** | Compression | Every text asset served `gzip`/`br`; **0** uncompressed JSON over 64 KB |

**B.3 — The leak test (Tier-S, and it is the item's headline)**

| # | Quantity | Budget | Fail |
|---|---|---|---|
| **L1** | **Heap delta after the ten-minute traversal loop** (definition in §C), measured after a forced GC at both ends | ≤ **8 MB** | > 25 MB |
| **L2** | **Heap slope** over 60 minutes of the same loop | ≤ **1.5 MB/min** | > 4 MB/min |
| **L3** | Live geometry / texture / material / program counts, start vs end of the loop | **Δ ≤ 2%** on each | Δ > 10% on any |
| **L4** | Retained objects by constructor, snapshot diff across the loop | **0** constructors with a monotonic increase across 3 consecutive loops | any |
| **L5** | Detached DOM nodes | **0** | ≥ 1 |
| **L6** | Event listeners registered minus removed, across the loop | **0** | ≥ 1 net per loop |
| **L7** | `WebGLRenderingContext` resources: geometries/textures **disposed** vs created across the loop | disposed ≥ created − 2% | disposed < created − 10% |
| **L8** | Save/load cycles: heap delta over 20 save+load round trips | ≤ **4 MB** | > 15 MB |
| **L9** | Death/respawn cycles: heap delta over 20 death→respawn→recover loops | ≤ **4 MB** | > 15 MB |
| **L10** | Dialogue cycles: heap delta over 200 dialogue open/close | ≤ **2 MB** | > 8 MB |

**BAR-CRITIQUE-01 rank 13 proposed `heap slope ≤ 2 MB/min over 60 minutes`. L2 tightens it to
1.5 and adds L1, because a slope measured over an hour hides a step function: a game that leaks
6 MB per region transition and nothing in between has a beautiful slope and dies at the
fifteenth border.** L1 and L3 are the step-function detectors; L2 is retained so the two items
remain comparable.

### C. The ten-minute traversal loop (BINDING — the exact procedure)

A leak test is only reproducible if the loop is specified to the step. This is the loop:

```
LOOP (one iteration ≈ 60 s of sim; the test runs 10 iterations):
  1. Forced GC, heap snapshot, resource census.            [iteration 1 and 10 only]
  2. Walk region A → region B across a streaming border.   (~12 s)
  3. Enter a named interior; wait for it to settle (60 steps); exit.
  4. Walk to a settlement; open dialogue with 3 NPCs; browse 5 topics each; close.
  5. Open the journal, the inventory and the map item; close each.
  6. Engage 2 ordinary enemies; kill both; loot one corpse.
  7. Rest at a HEARTH (triggers a world reset + respawn).
  8. Walk region B → region C across a second streaming border.
  9. Die; respawn at the HEARTH; run back; recover the bloodstain.
 10. Save to a slot; load the slot.                         [iterations 3, 6, 9]
 11. Walk region C → region A, closing the loop to the exact start position.
LOOP END:
 12. Forced GC (×3, with 200 ms between), heap snapshot, resource census.
```

**Every step is chosen because it is a place resources are created**: streaming, interiors,
dialogue surfaces, UI surfaces, combat entities, world reset, death/respawn, save/load. A loop
that omits any of them cannot detect the leak that lives there. **Rule C1: the loop must return
the player to the exact start position and the exact start region, so the resident set at both
ends is comparable.** A leak test that ends somewhere else is measuring content, not leakage.

**Rule C2 — forced GC is mandatory and must be real.** Run Chromium with
`--js-flags=--expose-gc`; call `gc()` three times with a gap; read heap via CDP
`Runtime.getHeapUsage`. Reading `performance.memory` instead gives a number quantised and
delayed enough to hide a 20 MB leak. `A-JRN9` provides this.

**Rule C3 — the census is taken from two independent sources.** Three.js's own
`renderer.info.memory` **and** an explicit registry maintained by the game (`A-JRN8`
`getWorldStats()` extension). If the two disagree by more than 2%, the disagreement is itself
the finding: it means resources exist that the engine does not know it owns, which is the exact
shape of a leak.

### D. What "sized for a phone" forbids

| Id | Rule |
|---|---|
| **P1** | No asset is authored at a resolution that only matters on a 27″ monitor. A 4096² albedo on a rock is 64 MB resident uncompressed and is invisible at phone DPI |
| **P2** | Region streaming **unloads**. A build that loads regions and never frees them will pass every ceiling for the first ten minutes and fail A1 at minute forty. L3/L7 detect it |
| **P3** | Interiors unload on exit, on a delay of ≤ 30 s, and re-entering does not accumulate |
| **P4** | No unbounded caches. Every cache — decoded textures, parsed JSON, path-finding results, string tables — declares a maximum size in entries **and** in bytes, and is evicted LRU. An unbounded `Map` keyed by entity id is the most common leak in this class of game |
| **P5** | No unbounded logs. The trace buffer is bounded and drained (`HARNESS.md` `traceDrain`); the console log is not a data structure |
| **P6** | Audio: music streams; only SFX are decoded and held; the decoded set is bounded (A5) |
| **P7** | Every `addEventListener` has a matching `removeEventListener` on teardown, including on `window`, `document`, `navigator` and the gamepad/pointer-lock listeners from `RI-JRN03`/`RI-JRN04`. L6 |
| **P8** | Every `THREE` resource created at runtime is disposed at teardown. L7 |

## Comparison method

Run by `critic.platform` (fleet critic **JC-P2**).

```bash
node tools/platform/leak-run.mjs --loops 10 --seed 4711 --profile phone-mid \
     --expose-gc --out reports/platform/<runId>
node tools/platform/heap-walk.mjs --in reports/platform/<runId>   # snapshot diff, retained-by-constructor
node tools/analysis/asset-budget.mjs --manifest game/data/index.json --out reports/platform/<runId>
```

Requires **`A-JRN8`** (resource census in `getWorldStats()`), **`A-JRN9`** (forced GC + heap
usage + CDP heap snapshots) and **`A-JRN14`** (`getResourceRegistry()` — the game's own list of
live geometries/textures/materials/programs/listeners/caches with their sizes, so C3's
cross-check is possible). Until they exist every check is `unmeasurable` and scores **0**,
fail-closed.

| # | Tier | Check | Threshold |
|---|---|---|---|
| **M-M1** | S | **Ceilings.** Max over the 10-loop run of A1, A2, A8–A11; computed A3, A4, A5, A6 from the registry | Every row of B.1 at `phone-mid`. Report the full table |
| **M-M2** | S | **Asset budget.** `asset-budget.mjs` over the build: D1–D5, D8; texture-format census for D6 | Every row of B.2. **Hard fail: D6 < 90% compressed with no declared exceptions** |
| **M-M3** | S | **Unused assets (D7).** Network log across a 40-minute session vs the manifest | ≤ 5% by bytes |
| **M-M4** | S | **Leak, ten minutes (L1).** The §C loop ×10, forced GC at both ends | ≤ 8 MB. **Hard fail: > 25 MB** |
| **M-M5** | S | **Leak, sixty minutes (L2).** The loop ×60; linear fit of post-GC heap vs time | ≤ 1.5 MB/min. **Hard fail: > 4 MB/min** |
| **M-M6** | S | **Resource census drift (L3).** Registry counts at loop 1 vs loop 10 | Δ ≤ 2% each. **Hard fail: Δ > 10% on any** |
| **M-M7** | S | **Retained-by-constructor (L4).** Heap snapshot diff across loops 1→4→7→10 | 0 monotonically-increasing constructors. Name the top 10 in the verdict regardless |
| **M-M8** | S | **Detached nodes / listeners (L5, L6)** | 0 / net 0 |
| **M-M9** | S | **Dispose parity (L7)** | disposed ≥ created − 2% |
| **M-M10** | S | **Cycle leaks (L8, L9, L10)** — save/load, death/respawn, dialogue | All three budgets |
| **M-M11** | S | **Census cross-check (C3)** | `renderer.info.memory` vs `getResourceRegistry()` within 2%. **A disagreement is reported as a finding even when both are under budget** |
| **M-M12** | S | **Streaming frees (P2, P3)** | After leaving region A and waiting 60 s: region A's geometries/textures are 0 in the registry. Same for an interior after 30 s |
| **M-M13** | S | **Cache bounds (P4)** | Every cache in `getResourceRegistry().caches` declares a max in entries and bytes and is under it. **Hard fail: an unbounded cache** |
| **M-M14** | H | **UA memory total** | `performance.measureUserAgentSpecificMemory()` under A6 on attested hardware |
| **M-M15** | H | **Eviction survival** | 40-minute session on a real phone with 3 other tabs open; the tab is not discarded |
| **M-M16** | H | **GPU residency (A7)** | Under budget on attested hardware |

## Scoring

Native **0–100**, weighted; hard fails cap at **2**.

| Block | Tier | Weight | Checks |
|---|---|---|---|
| **The leak** | S | **36** | M-M4 (14), M-M5 (8), M-M6 (8), M-M7 (6) |
| **Resources are released** | S | **20** | M-M9 (5), M-M12 (6), M-M13 (5), M-M8 (4) |
| **Ceilings** | S | **14** | M-M1 (14) |
| **Assets** | S | **12** | M-M2 (8), M-M3 (2), M-M10 (2) |
| **Measurement integrity** | S | **4** | M-M11 (4) |
| **Real-device behaviour** | **H** | **14** | M-M15 (8), M-M14 (4), M-M16 (2) |

**Tier-S total: 86. Tier-H total: 14.** Unlike `RI-PLT01`, this item is *mostly* measurable in
this container, and that is a genuine finding: **memory discipline can be enforced today, and
there is no excuse for deferring it.** Tier-H checks still stay in the denominator (rule T2), so
a container-only run caps at 86 → band "Below bar", ladder ceiling 6.

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 50–69 | Recognisably attempting it | 5 |
| < 50 | **We lose** | 4 |

**Hard fails (any one caps at 2, `status: FAIL`):**

- **HF1** — Ten-minute leak > 25 MB (M-M4).
- **HF2** — Sixty-minute slope > 4 MB/min (M-M5).
- **HF3** — Live resource counts grow > 10% across the loop (M-M6).
- **HF4** — An unbounded cache (M-M13).
- **HF5** — Regions or interiors never freed (M-M12).
- **HF6** — < 90% of world textures in a GPU-compressed format with no declared exceptions
  (M-M2, D6).
- **HF7** — A Tier-H number reported from a software-renderer run (`RI-PLT01` M15 / rule T1) —
  falsification under `RI-MTH04`.

## How we lose

1. **Regions load and never unload.** The simplest streaming implementation adds to the scene
   and forgets to remove. Everything is fast and correct for ten minutes. At minute forty the
   tab is discarded on a phone and the player loses an hour. HF5, and it is the most likely
   single failure in this item.
2. **`geometry.dispose()` is never called.** Three.js does not free GPU resources on garbage
   collection; a detached mesh keeps its buffers alive until explicitly disposed. This is the
   engine-specific trap and it is not obvious from JS-heap measurements alone, which is exactly
   why L7 and M-M11 compare two independent censuses.
3. **`const cache = new Map()` keyed by entity id.** Bounded in the developer's head, unbounded
   in fact, and it grows for as long as the session lasts. P4/HF4.
4. **Textures are PNGs.** They look identical, they compress well over the wire, and each one
   costs width × height × 4 × 1.33 bytes resident forever. A3 blows on a phone and nowhere else.
   D6.
5. **The leak test is run for ninety seconds.** Long enough to see nothing. The loop in §C is
   specified in full precisely so that "we ran a leak test" is a checkable claim.
6. **The loop does not include death, save, or dialogue.** Those are three separate resource
   lifecycles, and each is the sort of code path written once and never re-entered during
   development. L8/L9/L10.
7. **`performance.memory` is used instead of a forced GC + `Runtime.getHeapUsage`.** The number
   is quantised, delayed, and includes uncollected garbage, so a 20 MB leak is indistinguishable
   from ordinary sawtooth. C2.
8. **The heap slope is fine and the step function is not.** 6 MB per region border, ten borders
   an hour, and a perfect-looking 1 MB/min average. L1 and L3 exist for this and the BAR-CRITIQUE
   proposal on its own would have missed it.
9. **Listeners on `window` are never removed.** Pointer-lock, gamepad, resize, visibility,
   orientation — `RI-JRN03` and `RI-JRN04` each add several, and every scene teardown that
   forgets one leaks the whole closure chain behind it, which is usually the entire scene.
10. **The budget is met by making the game ugly, quietly.** Textures halved, vegetation thinned,
    shadow casters cut — and none of it recorded. `RI-PLT01` rule F1 requires the trade to be
    written down; concealment is the violation, not the trade.
11. **Nobody ever opens a heap snapshot.** M-M7's retained-by-constructor diff is the only check
    here that says *what* leaked rather than *that* something did, and it is the one most likely
    to be skipped for being fiddly. The verdict requires the top-10 constructor list whether or
    not the check passed, for exactly that reason.

## Provenance note

- **`constructed`, confidence high, and binding** — every ceiling in §B.1, every download budget
  in §B.2, every leak budget in §B.3, the loop specification in §C, the rules in §D, and every
  threshold and weight below. The 60-minute slope requirement descends from **BAR-CRITIQUE-01
  rank 13** (`heap slope ≤ 2 MB/min over 60 minutes`) and is tightened to 1.5 MB/min with the
  step-function detectors L1/L3 added; that lineage is recorded so the two documents can be
  reconciled.
- **`canonical-recall`, confidence high** — the platform behaviours relied on: that mobile
  browsers discard tabs under memory pressure without warning; that Three.js requires explicit
  `dispose()` for GPU resources and does not free them on GC; that decoded PNG/JPEG costs 4
  bytes per pixel resident while GPU-compressed formats stay compressed in memory; that
  `performance.memory` is coarse and `--expose-gc` + CDP heap usage is not; that
  `performance.measureUserAgentSpecificMemory()` is UA-specific. Recalled, **not measured here**.
- **No memory figure in this item has been measured.** There is no game yet. Every number is a
  target chosen to be checkable, and the tier table in §A states exactly which of them this
  container can check.
- **Owned elsewhere, cited not restated:** per-frame allocation, GC attribution and the frame
  budget → `RI-PLT01` (including tier rules T1/T2, inherited here verbatim). Load time,
  streaming behaviour and hitches → `RI-PLT03`. The reference device class → `RI-JRN04` H7.
  Save-store bytes on disk → `RI-JRN05` §A. Fidelity metrics → `RI-VIS03`/`RI-VIS04`.
  Falsification → `RI-MTH04`.
- **Harness dependency.** `A-JRN8`, `A-JRN9`, `A-JRN14`. Until they land this item is
  **unmeasurable** and scores **0**, fail-closed. Full request in
  `JOURNEY-CRITIC-FLEET.md` §7.
