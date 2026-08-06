# HARNESS.md — the measurement harness

> **This document is a binding requirement on builders, not a suggestion to critics.**
> Everything in `corpus/` that says "run the game and measure X" resolves to this file.
> If the game cannot be driven the way this document specifies, then **nothing in the
> corpus can be scored**, and every critic must fail the piece for unmeasurability
> before it looks at a single design decision.

The harness exists because of one rule, which is the whole reason this file is binding:

> **A critic scores artifacts, never source code.** Reading `combat.js` and concluding
> "the roll looks like it has i-frames" is not a measurement, it is a guess wearing a
> lab coat. The only admissible evidence is a file on disk produced by a run whose
> command line, run id and hashes are recorded in the verdict. See `RI-MTH04`.

---

## 1. Environment (this machine, today)

| Thing | Value |
|---|---|
| Node | ≥ 20 (verified on v22.22.2) |
| Playwright | 1.56.1, installed globally **and** in `tools/node_modules` |
| Chromium | preinstalled at `/opt/pw-browsers/chromium-1194` |
| `PLAYWRIGHT_BROWSERS_PATH` | `/opt/pw-browsers` (already set in the environment) |
| GPU | none — ANGLE/Vulkan **SwiftShader** software renderer |
| Verified | `node tools/harness/smoke.mjs` → WebGL 2.0 context, non-blank screenshot, rAF runs |

**Never run `playwright install`.** The browsers are already there; downloading is both
unnecessary and likely to fail. `tools/package.json` pins `playwright@1.56.1` and is
installed with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

Consequences of software rendering, which builders must design around:

- Frame *rate* is not a measurable quality here. **Do not** write a reference item that
  scores FPS on this machine. Performance is judged by draw-call counts, triangle
  counts and texture budgets reported by `getWorldStats()`, not by wall-clock frame time.
- Rendering is slow but *deterministic*, which is exactly the trade this project wants.
- Shots at 1920×1080 take ~0.5 s each; a 12-viewpoint sweep is ~6 s. Budget accordingly.

Install and self-test:

```bash
cd tools && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
node tools/harness/smoke.mjs                       # environment is usable?
node tools/run-all.mjs --stub                      # tooling itself is working?
```

`tools/harness/stub/index.html` is a **test fixture**, not the game: a ~350-line reference
implementation of the API below, used to prove the tools work before the game exists.
Builders should read it as a worked example and then delete it from their mental model.

---

## 2. The headless run contract

The game MUST satisfy all of the following. Each is separately testable, and each has a
failure mode that silently destroys measurement if it is not met.

**R1 — It is a static site loadable over `http://`.** Entry point `game/index.html`.
No build step required to *run* it (a build step to *produce* it is fine). The harness
serves the repo root over a local HTTP server and navigates to `/game/index.html`. It must
not require `file://`, a dev server with HMR, or any network access.

**R2 — Fixed 60 Hz simulation, decoupled from render.** The simulation advances in
integer steps of exactly `1/60 s` (`16.666…ms`). There is no `deltaTime` from
`requestAnimationFrame` anywhere in gameplay code. Rendering may happen at any rate,
including "only when the harness asks". A frame index is an integer that only ever
increments by 1. This is what makes "active frames 12–15" a checkable claim rather than
a vibe. Variable-timestep physics is an **automatic fail of the piece**: every frame-data
item in `corpus/10-combat/` becomes unmeasurable.

**R3 — Harness mode suspends the internal loop.** When `window.__HARNESS` is present and
`setMode('harness')` has been called (or, simpler and preferred, whenever the page is
loaded with `?harness=1` or `navigator.webdriver` is true), the game MUST NOT advance the
simulation from its own `requestAnimationFrame` loop. The simulation advances **only**
inside `stepFrames(n)`. Otherwise the number of steps between two harness calls depends on
how busy the machine was, and traces stop being reproducible.

**R4 — Scripted input only.** In harness mode, keyboard/mouse/gamepad listeners are
disconnected from the simulation. Input arrives exclusively via `queueInputs()`. The
button set is closed and fixed (§4).

**R5 — One seeded PRNG.** See §8.

**R6 — Content is data, not code.** See §7.

**R7 — Errors are loud.** Any exception in a harness method must propagate out of the
promise (the tooling converts an in-page throw into a tool-level failure). Swallowing an
error and returning a plausible-looking object is the single easiest way to fake a passing
measurement, and it is treated as fraud, not as a bug (`RI-MTH04`).

---

## 3. The harness API — `window.__HARNESS`

This is **the single seam** between the game and every critic in the project. It is
versioned. Adding methods is a minor version; changing or removing one requires an
amendment to this file.

```js
window.__HARNESS = {
  version: 1,                       // integer. Tools refuse to trust a mismatch silently.

  // ---- lifecycle -------------------------------------------------------------
  ready(): Promise<true>,           // resolves when assets are loaded and a world exists
  getBuildInfo(): {                 // stamped into every artifact for traceability
    name, version, commit, builtAt, harnessVersion, fixedStepHz, dataRoot
  },
  setMode(mode: 'harness'|'play'): string,
  reset(opts?: {seed?, state?}): {ok, frame, seed},
  loadState(state: string|object): {ok, frame, seed},   // named scenario state or a save blob
  saveState(): object,              // JSON-serialisable, round-trips through loadState()

  // ---- determinism -----------------------------------------------------------
  setSeed(n: number): number,       // reseeds THE global PRNG; callable before loadState
  getSeed(): number,

  // ---- time ------------------------------------------------------------------
  stepFrames(n: number): {frame, t_ms},   // advance exactly n fixed steps; render once at the end
  getFrame(): number,

  // ---- input -----------------------------------------------------------------
  queueInputs(script: InputEvent[]): number,  // frames are RELATIVE to the current frame
  clearInputs(): true,

  // ---- scenario contract -----------------------------------------------------
  reanchorFreeRunning(): {          // called ONCE, after warm-up, before queueInputs()
    frame, seed, entities: [{eid, anim_len, seeded_phase,
                             anim_frame: [before, after],
                             state_entered_f: [before, after]}]
  },

  // ---- observation -----------------------------------------------------------
  snapshot(): FrameRecord,          // the current frame as a §5 record
  traceStart(opts?): string,        // begin recording one FrameRecord per simulated frame
  traceDrain(): FrameRecord[],      // pull and clear buffered records (bounds memory)
  traceStop(): FrameRecord[],       // stop and return whatever is left

  // ---- world manipulation ----------------------------------------------------
  teleport(x: number, z: number, opts?: {y?, yaw?}): true,
  spawn(id: string, x: number, z: number, opts?: {as?}): string,   // returns eid
  despawn(eid: string): true,
  aggro(eid: string): true,         // force an enemy to AGGRO without waiting for perception
  lockOn(eid: string|null): true,
  setTimeOfDay(hours: number): number,     // 0..24, deterministic sun/sky state
  setWeather(id: string): string,          // named weather state, no random transitions
  camera(pose: {pos?, look?, fov?, mode?, lockOn?}): object,
  listAnchors(): string[],          // named camera anchors registered by the world (§6)
  setUIVisible(v: boolean): boolean,       // optional; HUD off for fidelity shots

  // ---- queries ---------------------------------------------------------------
  listEntities(): [{eid, archetype, pos, hp}],
  getPlayerStats(): object,
  getWorldStats(): {regions, settlements, pois, interiors, npcs, areaKm2,
                    drawCalls, triangles, textureMB},
  getQuestState(): {active[], completed[], journal[], flags{}, topicsKnown[]},

  // ---- rendering -------------------------------------------------------------
  renderFrame(): true,              // force a render of the current sim state
  screenshot(opts?): Promise<string>,  // data: URL; a fallback — Playwright's own
                                       // page.screenshot() is the preferred path
};
```

### Mandatory vs optional

| Tier | Methods | If missing |
|---|---|---|
| **Mandatory** | `version`, `stepFrames`, `queueInputs`, `snapshot`, `traceStart`, `traceStop`, `setSeed` | tools exit `11`; **no combat item is scoreable** |
| **Mandatory for visual items** | `camera`, `setTimeOfDay`, `setWeather` | fidelity items score 0, fail-closed |
| **Mandatory for world/quest items** | `loadState`, `teleport`, `getWorldStats`, `getQuestState` | those items score 0, fail-closed |
| **Strongly expected** | `ready`, `getBuildInfo`, `traceDrain`, `spawn`, `despawn`, `aggro`, `lockOn`, `listAnchors`, `reanchorFreeRunning` | degraded runs, longer scenarios, weaker provenance; without `reanchorFreeRunning` a build with free-running entity animation cannot satisfy `RI-MTH02` R5 |
| **Optional** | `saveState`, `setUIVisible`, `screenshot`, `listEntities`, `getPlayerStats` | tooling routes around them |

### What a critic can and cannot measure through this seam

**Can:** anything expressible as (a) a per-frame record, (b) a pixel buffer at a known
camera pose, or (c) a static data file. That covers frame data, stamina economy, i-frames,
hitbox geometry, AI state machines, spacing, punish windows, image fidelity, world
density, topic graphs, quest branching, journal prose.

**Cannot, and must not be claimed:** anything about "feel" that is not one of the above;
frame rate on this software renderer; audio; input latency of the real input path (it is
bypassed by design); anything that requires reading a private variable the API does not
expose. A critic that needs a number the API cannot produce does not guess and does not
read the source — it files an amendment to this file requesting the field, and records the
gap in its verdict (CORPUS-CONTRACT §5).

---

## 4. Scripted input

`queueInputs(script)` takes an array of events. **Frames are relative to the frame at
which `queueInputs` was called**, so a scenario's warm-up frames never shift the script.

```jsonc
[
  {"f": 0,   "move": [0, 1]},                    // left-stick vector, persists until changed
  {"f": 90,  "move": [0, 0]},
  {"f": 100, "press": ["light"]},                // literal press
  {"f": 102, "release": ["light"]},
  {"f": 190, "tap": "roll", "hold": 3},          // sugar: press at 190, release at 193
  {"f": 300, "hold": ["block"], "until": 420},   // sugar: press at 300, release at 420
  {"f": 500, "look": [12, 0]}                    // degrees/frame yaw, pitch
]
```

The tooling (`tools/lib/scenario.mjs`) normalises all sugar before it reaches the game, so
the game only ever sees `{f, press?, release?, move?, look?}`. An unknown button is a
tooling error, not a silent no-op.

**The event shape is closed and `queueInputs` is fail-closed on it, not only on the button
name.** `{f, press?, release?, move?, look?}` and nothing else; an unrecognised KEY throws,
naming the key and, if it is scenario sugar, saying where the sugar is expanded. Accepting
`{f:0, tap:'light'}` and returning a count of 1 for an event that will never fire is
fail-quiet where `RI-MTH01` M6 asks for fail-closed, and it cost the W1-00 critic four
measurements whose attack inputs were silently dropped (`W1-00` verdict §8.1).

**The closed button set** — the game must accept exactly these names and reject others:

```
light  heavy  roll  block  parry  sprint  jump
use_item  interact  lock_on  two_hand  swap_right  swap_left  menu
```

### The scripted window and `reanchorFreeRunning()`

A scenario runs `setSeed` → `loadState` → setup ops → **warm-up** → `reanchorFreeRunning()`
→ `queueInputs` → `traceStart`. The re-anchor call is part of the contract, not an
optimisation, and `RI-MTH02` R5 is why.

R5 requires a 30-frame and a 90-frame warm-up to produce identical scripted windows. Any
entity with a free-running clock defeats that by construction: after 60 more frames of
idling, a 48-frame idle loop is at a different phase. `reanchorFreeRunning()` resets those
clocks to the frame the window opens —

* `anim_frame` → the entity's **seeded** idle-loop phase offset, so the re-anchor stays
  seed-sensitive and `RI-MTH02` R4 still sees the seed;
* `state_entered_f` → the window origin, when the state was entered before the window.

It **mutates the simulation**, and the trace then reports the phase the simulation is
genuinely in. That is the difference between a fixture normalisation and falsifying a trace
field, which `RI-MTH04` forbids. It returns exactly what it changed and every run report
prints it (`manifest.window_reanchor`, and the R5 rung's `window_reanchor` evidence), so the
change is auditable and a critic can revert the fixture and watch R5 fail again.

---

## 5. The trace format — `elder-souls/trace@1`

One JSONL file per run. **Line 1 is a header record, the last line is a footer record,
every other line is exactly one simulated frame.** This is the single format all combat
measurement uses; `corpus/10-combat/RI-AI01` §A defines the enemy field names and this
document adopts them verbatim so the two never drift.

### Header (line 1)

```json
{"_":"header","schema":"elder-souls/trace@1","run_id":"20260805T223942Z-cmb-duel-infantry-s1337-221134",
 "scenario":"cmb-duel-infantry","seed":1337,"fixed_step_hz":60,
 "started_at":"2026-08-05T22:39:42.101Z","url":"http://127.0.0.1:39599/game/index.html",
 "harness_version":1,"build":{...},"git":{"commit":"…","branch":"…","dirty":false},
 "data":{"files":42,"sha256":"…"}}
```

### Frame record

```json
{"f":221,"t_ms":3683.333,
 "input":{"move":[0,1],"look":[0,0],"held":["sprint"],"pressed":["light"]},
 "player":{"pos":[0.0,0.0,3.4],"yaw_deg":12.5,"state":"ATTACK",
   "anim":"atk_light","anim_frame":7,"anim_len":32,"phase":"windup",
   "stamina":73.5,"stamina_max":110,"stamina_regen_blocked":true,
   "hp":500,"hp_max":500,"poise_cur":30,"poise_max":30,
   "iframe":false,"iframe_kind":null,"grounded":true,"estus":4,"locked_on":"e0",
   "hitboxes":[]},
 "enemies":[
   {"eid":"e0","archetype":"INFANTRY","tier":"trash","state":"CIRCLE",
    "state_entered_f":190,"prev_state":"APPROACH",
    "anim":"idle","anim_frame":0,"anim_len":1,"phase":"none",
    "hit_active":false,"hitboxes":[],
    "pos":[1.2,0.0,6.0],"yaw_deg":214.6,"yaw_rate_dps":142.0,"speed_mps":2.1,
    "target":"player","dist_m":3.42,"los":true,"in_sight_cone":true,
    "alert":100,"alert_state":"AGGRO","attack_token":false,
    "hp":412,"hp_max":412,"poise_cur":22,"poise_max":22,"stagger":false,
    "spawn_anchor":[0,0,7],"leash_dist_m":1.2}],
 "events":[{"f":221,"type":"attack_start","move":"light"}],
 "rng":{"draws":118}}
```

**Field contract.** `phase ∈ none|windup|active|recovery|turn|hitstun`.
`alert_state ∈ IDLE|SUSPICIOUS|SEARCH|AGGRO`. Positions are `[x, y, z]` metres.
Angles are degrees. Times are milliseconds. Stamina and hp are absolute, with `_max`
alongside so ratios never need a config lookup.

**Hitbox record** (in `player.hitboxes` and `enemies[].hitboxes`, present **only on
frames where the box is active**):

```json
{"id":"wpn_light","owner":"player","kind":"capsule",
 "a":[0,1.1,3.4],"b":[0,1.1,5.7],"r":0.22,"active_f":2,
 "dmg":{"phys":90},"poise_dmg":12,"hits":["e0"]}
```

**Event records** (`events[]`) — a closed vocabulary, extensible by amendment:

```
attack_start  hit  block  parry  riposte  backstab  stagger  death
roll_start  iframe_dodge  stamina_spend  heal  bonfire_rest  level_up
spawn  despawn  enemy_state  quest_stage  journal  topic  item  load
```

### Footer (last line)

```json
{"_":"footer","frames":3600,"body_sha256":"8fed0f67…","ended_at":"2026-08-05T22:39:44.7Z"}
```

`body_sha256` is the SHA-256 of every frame line concatenated (header and footer
excluded). **Two runs of the same scenario at the same seed MUST produce the identical
`body_sha256`.** This is the reproducibility test and it is checked in `RI-MTH02`.

### Fail-closed

A missing required field is not "unknown" — the critic scores **0** for every check that
touches it. `tools/harness/trace-stats.mjs` reports `integrity.missing_fields` and
`integrity.fail_closed` precisely so this cannot be waved away.

---

## 6. The screenshot contract

Screenshots are only comparable if the camera, the clock and the weather are pinned.

| Property | Value | Why |
|---|---|---|
| Resolution (**world** viewpoint set) | **1920×1080**, `deviceScaleFactor: 1` | fixed so edge-density and FFT metrics are commensurable |
| Resolution (**UI** viewpoint set) | **1280×720 / 1920×1080 / 2560×1440 / 3840×2160**, each at `deviceScaleFactor` **1 and 2** | UI shots are never compared against world shots, so commensurability with them is not required — and the DPR-2 capture is the one measurement that catches a `CanvasTexture` UI |
| Format | PNG, sRGB (`--force-color-profile=srgb`) | lossless; no codec artefacts entering the metrics |
| Camera | from `tools/harness/viewpoints.json` only | a shot at an unlisted pose is **not admissible evidence** |
| Time of day | per-viewpoint, explicit hours | no "it looked better at sunset" |
| Weather | per-viewpoint, named state | no random weather rolls |
| Settle | 24 fixed steps after posing, then render | animations/streaming reach a stable state |
| HUD | off (`setUIVisible(false)`) unless the viewpoint says otherwise | fidelity metrics must not measure the UI |
| Chromium flags | `--force-color-profile=srgb --font-render-hinting=none --disable-lcd-text --hide-scrollbars --use-angle=swiftshader` | identical rasterisation run to run |

The **canonical viewpoints** live in `tools/harness/viewpoints.json` and are binding on the
world builder: every slot must resolve to a real, framed shot. There are twelve, covering
long vista, sky-only (the sole input to the banding metric), canopy interior, settlement
street, firelit interior, water, character close-up, material close-up, night, storm,
dark dungeon, and gameplay combat framing. Each declares which metrics it feeds.

Viewpoints may be **added** by amendment. Changing an existing pose invalidates every
cross-wave comparison that used it, so poses are append-only in practice.

> **AMENDED wave 0 (corpus-audit) — queue B8. UI shots form their own viewpoint set with their
> own pinned configuration.**
>
> `deviceScaleFactor: 1`, applied globally, made `RI-UIX06`'s **FD2 glyph-sharpness-at-DPR-2
> check structurally unmeasurable** — and FD2 is *the* measurement that catches a UI drawn into
> a `CanvasTexture` at a fixed size and mapped to a quad. Such a UI passes at DPR 1 and fails
> catastrophically at DPR 2; with DPR pinned to 1, it passes everything and ships.
>
> This is a real conflict, not an oversight: fidelity metrics genuinely need one fixed DPR so
> edge-density and FFT numbers stay commensurable across waves. **Resolution: the constraint is
> scoped to the viewpoint set it protects.** `viewpoints.json` gains a `set` field —
> `"world"` (12 canonical poses, DPR 1, unchanged and still binding) and `"ui"`
> (`ui-combat`, `ui-world`, `ui-screens`, `ui-book`, per `RI-UIX06` §E, captured at 4
> resolutions × 2 DPRs = 48 shots). **A UI shot is never admissible evidence for a fidelity
> metric and a world shot is never admissible evidence for a UI metric**, which is what makes
> the two configurations safe to differ. Every world-shot number produced before this amendment
> remains valid and comparable.
>
> See `CORPUS-COHERENCE-01.md` §8.

---

## 7. The data-inspection contract (hard architectural requirement)

> **All game content lives in inspectable data files under `game/data/`.**
> Content that exists only as literals inside `.js` is unmeasurable, and unmeasurable
> content is treated by every critic as content that does not exist.

This is not a style preference. Half the corpus — quests, dialogue, journal, lore, world
density, POI counts — is scored by static analysis that never launches a browser
(`tools/analysis/content-stats.mjs`). If a quest is a `switch` statement, its branch count
cannot be computed, and the quest scores zero.

### Required layout

```
game/data/
  index.json                  manifest: every data file + its schema id + version
  world/
    regions.json              region list with bounds + climate + danger tier
    pois.json                 every point of interest: id, name, kind, region, pos
    settlements/<id>.json     anatomy: buildings, interiors, inhabitants, services
    interiors/<id>.json       interior cells
  npcs/
    <settlement|group>.json   id, name, race, class, faction, settlement, disposition,
                              schedule, topics, services
  dialogue/
    topics/<group>.json       topic records: topic, npc?, settlement?, condition?, text, links
    greetings.json            per-faction / per-disposition greeting pools
    rumours.json              rumour text keyed by settlement (they MUST differ per town)
  quests/
    <quest-id>.json           id, title, giver, stages[], outcomes[], journal, flags
  items/<group>.json          hand-placed, named items
  books/<id>.json             in-world books, with author and unreliability notes
  combat/
    enemies/<id>.json         statblock: hp, poise, archetype, reach, sight radius
    movesets/<id>.json        per-move frame data: startup, active, recovery, stamina,
                              damage, poise damage, hitbox spec, hyperarmour flag
  progression/
    levels.json, skills.json, factions.json
```

### Rules

1. **Schema-tolerant, not schema-free.** The analyser accepts several aliases per field
   (`text|body|line|response`, `stages|steps|phases`, `outcomes|resolutions|endings`) and
   reports anything it could not classify under `coverage.unclassified` rather than
   silently scoring zero. A file landing in `unclassified` is a defect to fix — in the
   data *or* in the analyser's alias list — never a shrug.
2. **IDs are stable.** Renaming an id breaks cross-wave comparison of content stats.
3. **Prose lives in the data.** Journal entries, dialogue lines and book text are strings
   in JSON, not template calls assembled at runtime. Assembled-at-runtime prose cannot be
   word-counted, proper-noun-extracted, or read by a blind judge.
4. **Frame data lives in the data.** `combat/movesets/*.json` is what a critic diffs
   against the reference frame tables *before* confirming the trace agrees with them. Two
   independent sources — declared and observed — that must match. A mismatch between the
   declared moveset and the measured trace is a hard fail (the numbers are decorative).
5. **`index.json` is the manifest.** It lists every data file with a schema id, so an
   analyser can tell "absent" from "renamed".

---

## 8. Determinism requirements

| # | Rule | Enforcement |
|---|---|---|
| D1 | **Seeded RNG only.** One PRNG instance, reseeded by `setSeed`. | The stub demonstrates it by making `Math.random` throw; the real game SHOULD do the same in harness mode. |
| D2 | **No `Math.random()` in simulation.** Not in AI, not in damage, not in loot, not in particles that affect gameplay. | Static grep is advisory; the real test is D5. |
| D3 | **No wall-clock in simulation.** No `Date.now()`, no `performance.now()`, no `new Date()` in any code path that changes sim state. Sim time is `frame / 60`. | D5 catches violations. |
| D4 | **No frame-rate-dependent maths.** No `* deltaTime` in gameplay. Movement, stamina, cooldowns and animation are all integer-frame quantities. | R2; visible in the trace as non-integer anim frames or drifting stamina. |
| D5 | **Byte-identical traces.** Same scenario + same seed ⇒ identical `body_sha256`. | `RI-MTH02`; two runs, compare footers. This single check subsumes D1–D4: nothing else makes a trace bit-stable. |
| D6 | **Seed before load.** `setSeed()` is honoured for world generation and content selection, so a seed change visibly changes the run. | A seed that changes nothing is as broken as one that changes everything. |
| D7 | **Deterministic ordering.** Iteration over entities/sets must not depend on insertion timing or object address. Sort by `eid`. | Shows up as trace divergence between runs. |

Non-simulation code (audio mixing, purely cosmetic particles, UI animation) may use wall
clock and unseeded randomness, on condition that it can never influence a value that
appears in the trace.

---

## 9. Tools, exit codes, run directories

```
tools/
  package.json                 pngjs, pixelmatch, playwright@1.56.1 (browsers NOT downloaded)
  lib/          cli.mjs serve.mjs browser.mjs scenario.mjs run.mjs
  harness/
    smoke.mjs                  environment self-test (browser + WebGL + PNG round-trip)
    run-headless.mjs           boot the game, run a named scenario, write a run directory
    trace.mjs                  scripted inputs → JSONL trace
    trace-stats.mjs            JSONL trace → combat statistics
    shoot.mjs                  canonical viewpoints → PNGs + index.json
    viewpoints.json            the canonical viewpoint set
    scenarios/*.json           named scenarios
    stub/index.html            TEST FIXTURE reference implementation of __HARNESS
  metrics/image-metrics.mjs    fidelity image statistics (pure JS)
  analysis/content-stats.mjs   static analysis of game/data/**
  blind/make-pair.mjs          blind A/B pack assembly
  run-all.mjs                  run everything available, write reports/
```

Every tool supports `--help` and prints its usage without touching the game.

### Exit codes (part of the contract)

| Code | Meaning |
|---|---|
| 0 | success |
| 2 | usage error |
| 10 | the game / data / input artifact does not exist yet |
| 11 | page loaded but `window.__HARNESS` is absent, wrong version, or missing a required method |
| 12 | a harness call threw, or the page raised an error during the run |
| 20 | ran, but the produced artifact is unusable (e.g. an empty trace) |
| 70 | internal tooling error |

A failure also prints a single-line JSON object on stderr (`{"ok":false,"error":…,"exit":…}`)
so a supervising agent can parse it.

### Run directory

```
reports/runs/<runId>/
  manifest.json      run id, scenario, seed, frame counts, url, build info, git, data hash,
                     page errors, wall time, the exact argv
  trace.jsonl        the trace (§5)
  trace-stats.json   computed statistics
  snapshot.json      final frame
  world-stats.json   getWorldStats() at end of run
  quest-state.json   getQuestState() at end of run
  console.log        every console message from the page
  errors.json        page errors (present only when there were any)
```

`runId` = `<UTC timestamp>-<scenario>-s<seed>-<6 hex>`. It appears in the manifest, in the
trace header, and must appear in any verdict citing the run (`RI-MTH04`).

### Typical critic session

```bash
node tools/harness/smoke.mjs                                        # 1. environment sane
node tools/harness/run-headless.mjs --scenario cmb-duel-infantry    # 2. produce artifacts
node tools/harness/trace-stats.mjs --in reports/runs/<runId>        # 3. compute numbers
node tools/harness/shoot.mjs --out reports/runs/<runId>/shots       # 4. pixels
node tools/metrics/image-metrics.mjs --in reports/runs/<runId>/shots
node tools/analysis/content-stats.mjs                               # 5. content, no browser
node tools/blind/make-pair.mjs --ours <a> --ref <b> --out packs/p1  # 6. blind pair
node tools/run-all.mjs                                              # or: all of the above
```

---

## 10. Amendment procedure

This file is append-only in spirit. To change the API, the trace schema, the viewpoint set
or the data layout:

1. Add the change here with the wave number that introduced it.
2. Bump `version` (API) or the schema string (`elder-souls/trace@2`) — never reuse a
   version number with different semantics.
3. Update `tools/lib/cli.mjs` (`TRACE_SCHEMA`, `HARNESS_API_VERSION`) in the same change.
4. Note in the amendment which existing artifacts are invalidated.

Superseded rules are struck through, not deleted, so old verdicts remain interpretable.

### Amendments applied

**AM-W1-14 — wave 1, piece W1-14 (magic, seam S19). `version` 1 → 2, `elder-souls/trace@1` → `@2`.**
Requested verbatim by `RI-MAG01`'s provenance note. Every change is an **addition**; nothing is
removed or given new semantics, so a reader written for `@1` sees `@2` as `@1` plus fields it
does not know about, and no existing artifact is invalidated.

1. **§4 button set — one new verb, `spell_cycle`** (bound to `KeyR`). The action set is now 16.
   Casting itself reuses `light` and `heavy` with a catalyst equipped, which is the Souls
   mapping and needs no verb at all; `spell_cycle` rotates among already-attuned spells and is
   free (0 stamina, 0 Focus, cancellable). It exists so that nobody builds a spell wheel, which
   would be a menu that pauses the fight and would kill seam S14.
2. **§5 frame record, `player`** — adds `focus`, `focus_max`, `focus_locked`, `attuned[]`,
   `cast: {spell, class, phase, anim_frame, tc_frame, aim_latched, focus_spent, stamina_spent,
   released}`, `effects_active[]`, `levitating`, `airborne`, `altitude_m`.
3. **§5 hitbox record** — `kind` gains `"projectile"` and `"volume"`; spell records additionally
   carry `spell`, `speed_mps`, `turn_rate_dps`, `travel_f`, `ticks_every_f`, `decal_spawn_f`,
   `decal_r`. A weapon record is byte-identical to what W1-09 emitted.
4. **§5 event vocabulary** — adds `cast_start`, `cast_release`, `cast_interrupt`, `focus_spend`,
   `effect_apply`, `effect_expire`, plus `spell_hit`, `levitate_begin`, `levitate_end`,
   `soul_trapped`, `soul_trap_refused`, and `SPELL_CYCLE` in the RI-CMB07 UPPER_SNAKE stream.
5. **§3 API** — adds `setAttuned`, `setCatalyst`, `setWillpower`, `setMagicSkills`,
   `getMagicState`, `magicEventsDrain`, `hearthRest`, `getMagicData`, `spellCost`, `setGold`,
   `getGold`, `quoteSpell`, `makeSpell`, `learnSpell`, `enchantQuote`, `trapSoul`, `getXulHesh`,
   `recallQuote`, `setLevitating`, `damagePlayer`; and extends `getPlayerStats()` with
   `focus`, `focus_max`, `focus_locked`, `attuned`, `effects_active`, `levitating`, `altitude_m`.
6. **§7 data layout** — adds `game/data/magic/{effects,spells,cast-classes,cast-clips,enchanting,vfx,traversal-routes}.json`
   and `game/data/combat/movesets/spell-<id>.json` (one per spell), so §7 rule 4's
   declared-vs-observed discipline covers spells exactly as it covers weapons.
7. **Save** — adds a `magic` group to `game/data/save-manifest.json` and to the save blob.
   `magic.custom_spells` is the load-bearing entry: `RI-MAG03` M1 requires a spell the player
   commissioned to appear in `saveState()`.

`tools/lib/cli.mjs` (`TRACE_SCHEMA`, `HARNESS_API_VERSION`) was updated in the same change.
**Artifacts invalidated: none.**
