# JOURNEY-CRITIC-FLEET.md — the charter for the journey critics

**Status: binding.** Subordinate to `ARBITRATION.md`, then `CRITIC-DOCTRINE.md`, then
`SCORING.md`, then `CORPUS-CONTRACT.md`. Where this file adds a rule, it adds; where it appears
to relax one, it does not — read the stricter reading.

---

## 1. Why a fleet, and why these critics are different

Every other critic in this project judges a **subsystem**. It is handed a subsystem path, the
reference items whose `judges:` list contains that path, and the harness, and it answers a
narrow question well. That is the right structure and it has one structural blind spot, named
in `ARBITRATION.md` §3 as **AR-3 (seam sterility)**: *a build can pass every per-subsystem
critic perfectly and be two products stapled together.*

A journey is the correction. **A journey is what a player actually does, end to end, crossing
every subsystem on the way, and no subsystem critic judges the sum.** The dodge is frame-perfect,
the topic graph is deep, the journal prose is excellent, the save writes correctly — and the
player still cannot get from a rumour in a tavern to a resolved quest, because the seam between
"the giver spoke directions" and "the journal recorded them" belongs to nobody.

The fleet exists to own the sums. **Nine critics, one per journey plus three platform critics,
each with fresh context, each holding only its own reference item and the harness, each required
to find a gap.**

---

## 2. The fleet

| Role | Judges | Owning corpus item | Base critic identity |
|---|---|---|---|
| **JC-01** | First launch → first meaningful choice | `RI-JRN01` | `critic.ui` |
| **JC-01N** | *naive* companion to JC-01 | `RI-JRN01` naive pass | — |
| **JC-02** | The first hour as interaction | `RI-JRN02` | `critic.ui` + `critic.combat` co-sign |
| **JC-02N** | *naive* | `RI-JRN02` naive pass | — |
| **JC-03** | Desktop controls | `RI-JRN03` | `critic.platform` |
| **JC-03N** | *naive* — **the first-time-user protocol's primary instrument** | `RI-JRN03` naive pass | — |
| **JC-04** | Mobile + attached gamepad | `RI-JRN04` | `critic.platform` |
| **JC-04N** | *naive* | `RI-JRN04` naive pass | — |
| **JC-05** | Save and load | `RI-JRN05` | `critic.platform` |
| **JC-06** | Death and recovery | `RI-JRN06` | `critic.combat` + `critic.progression` co-sign |
| **JC-07** | A quest without markers | `RI-JRN07` | `critic.quests` + `critic.world` co-sign |
| **JC-07N** | *naive* — **primary instrument for its item** | `RI-JRN07` naive pass | — |
| **JC-08** | Returning after a week | `RI-JRN08` | `critic.journal` + `critic.quests` co-sign |
| **JC-08N** | *naive* — **primary instrument for its item** | `RI-JRN08` naive pass | — |
| **JC-P1** | Frame budget | `RI-PLT01` | `critic.platform` |
| **JC-P2** | Memory, assets, leak | `RI-PLT02` | `critic.platform` |
| **JC-P3** | Load, streaming, hitches | `RI-PLT03` | `critic.platform` |

**Rule F1 — one journey, one critic, fresh context.** A journey critic receives its **own**
reference item, `ARBITRATION.md`, `CRITIC-DOCTRINE.md`, `SCORING.md`, `HARNESS.md`, and nothing
else from the corpus. It does **not** receive the other journey items. This is deliberate:
journeys overlap, and a critic that has read all eight will unconsciously judge the overlap
instead of its own item. Where an item cites another's number (e.g. `RI-JRN01` O5 cites
`RI-PLT03` P1), the citing critic receives **that single number as a supplied constant**, with
the run id it came from, and never the whole item.

**Rule F2 — co-signing.** Where the table names a co-signer, the co-signing critic reads the
verdict **before submission** and must either sign it or file a dissent, which travels with the
verdict. A co-signer who signs without running at least one check from the item has violated
`CRITIC-DOCTRINE.md` §1.2 and the signature is void.

**Rule F3 — no critic judges its own supply.** `CRITIC-DOCTRINE.md` §8 already forbids judging
what you built. This fleet adds: **a naive critic may not be an agent that has previously played
this build in any capacity, produced a save used by any journey test, or read any corpus file.**
See §4.

---

## 3. What a journey critic must produce

Beyond `VERDICT-SCHEMA.md`'s requirements, every journey verdict carries:

| Field | Requirement |
|---|---|
| `run_ids[]` | Every run cited, with its `manifest.json` path. A claim without a run id is not evidence (`RI-MTH04`) |
| `evidence.screenshots[]` | For every check whose threshold is visual (surface counts, safe areas, stain visibility, glyph switching): the actual PNG paths |
| `evidence.traces[]` | JSONL paths, with `body_sha256` from each footer |
| `evidence.state_diffs[]` | For `RI-JRN05`, `RI-JRN06`, `RI-JRN07` M-Q13, `RI-JRN08`: the full diff output, **including when it is empty** |
| `evidence.timing_logs[]` | For every latency, cadence or budget number: the raw series, not the summary statistic |
| `naive_transcript` | For any item with a naive pass: the agent's **verbatim** answers, recorded before any reveal, with timestamps |
| `tier_declaration` | For `RI-PLT01/02/03`: which checks were Tier-S, which Tier-H, and the renderer string from every manifest |
| `seam_crossings` | Per AR-3: which subsystem boundaries this journey actually crossed, and at least one interaction that crossed one. A journey that crosses no seam is a contradiction in terms and must be reported |
| `biggest_gap` | Exactly one, per `CRITIC-DOCTRINE.md` §2.2, with a buildable remedy |

**Rule F4 — every critic must try to falsify the journey.** `ARBITRATION.md` §3 and
`CRITIC-DOCTRINE.md` §2.1 permit no-gap PASS only after the bar and adversarial methods are evidenced.
Restated here because journeys are the easiest place
to write a satisfied verdict: they are long, they involve many passing subsystems, and a critic
that watched a whole quest complete feels good about it. Before claiming the gap is small, the
critic must have run all five escalation steps of §2.1 **and recorded an artifact from each**.

**Rule F5 — the journey-specific escalation.** In addition to §2.1's five steps, a journey
critic must run the **join test**: for every pair of adjacent links in its journey, ask *"what
does link N hand to link N+1, and is it the same object?"* Most journey failures live in the
hand-off, not in the link: directions spoken but not written (`RI-JRN08` W2), a bloodstain
created but not persisted (`RI-JRN06`/`RI-JRN05`), a binding set but not saved (`RI-JRN03` RB9),
a region streamed in but not freed (`RI-PLT02`/`RI-PLT03`). **The join test must appear in the
verdict as an explicit list of hand-offs checked.**

---

## 4. The enforced first-time-user protocol

Some journeys can only be judged by an agent that has not read the corpus. `RI-JRN03`'s
pre-registration (M-N1: does a stranger guess the controls?), `RI-JRN07`'s rumour-origin check
(M-N2: did the agent start from a rumour, unprompted?) and `RI-JRN08`'s orientation time
(M-N1: can a cold player rebuild their intentions?) are **not approximations of a measurement a
knowledgeable agent could take**. They are measurements that a knowledgeable agent *destroys by
existing*.

**Isolation level `enforced` means all of the following, and a naive pass run without all of
them is void, not degraded:**

| Id | Requirement |
|---|---|
| **I1** | The naive agent is dispatched with a prompt containing: the URL, the driver's stdio protocol, **one sentence of premise**, and the numbered questions from its item. Nothing else |
| **I2** | It receives **no** file from `corpus/`, **no** file from `game/data/`, **no** source, **no** screenshots from another agent, and **no** prior verdict |
| **I3** | It has not previously played this build, produced any save used in a journey test, or acted as any other fleet role in this wave |
| **I4** | Its **pre-registration answers are recorded before it touches the game** and are timestamped. A pre-registration written after play is falsification (`RI-MTH04`), not a procedural slip |
| **I5** | Its answers are recorded **verbatim** and **before any reveal**. The supervising critic may not paraphrase, summarise, or "clean up" an answer before recording it |
| **I6** | The supervising critic does not talk to the naive agent during play beyond the scripted questions, and does not answer questions |
| **I7** | The dispatch prompt is committed to the run directory as `naive-prompt.txt`, so the isolation is auditable after the fact |
| **I8** | If the naive agent asks a question the protocol does not cover, the answer is *"play on and record it as something you could not work out."* |

**Rule F6 — isolation is verified, not asserted.** The verdict carries
`naive_isolation: {level: "enforced", prompt_path, agent_had_prior_context: false}` and the
supervising critic must state how it knows the third field is true. "It was a fresh agent" is
sufficient only if the fleet dispatcher recorded it; a critic that cannot establish isolation
records `level: "claimed"` and **every naive check scores 0**, fail-closed.

**Rule F7 — the naive agent is not a tester.** It is an instrument. Its job is to be an ordinary
person; it is not asked to find bugs, not asked to be thorough, and not asked to try edge cases.
A naive agent instructed to "test the controls" has been converted into a QA process and its
answers no longer measure discoverability.

**Rule F8 — a naive pass may not be reused across waves.** Once an agent has played the build,
it can never be naive for that build again, and a naive pass from wave *n* may not be cited in
wave *n+1*'s verdict. This makes naive passes expensive and that is correct: they are the only
measurements in this corpus that cannot be repeated.

---

## 5. How verdicts aggregate

Journeys are sums, so they aggregate differently from subsystems.

**Rule G1 — a journey verdict never averages with the subsystem verdicts it crosses.** It is
reported alongside them. A build with nine subsystem 7s and a journey 3 is a build that does not
work, and averaging conceals exactly the failure the fleet exists to find.

**Rule G2 — the journey floor.** The project-level reading is
`journey_min = min(JC-01..JC-08 ladder scores)`. This is reported on every wave summary as a
first-class number. **A single broken journey is a broken game**, in a way a single weak
subsystem is not: a player who cannot save cannot play, however good the dodge is.

**Rule G3 — hard-fail propagation.** A hard fail in a journey item caps that item at 2
(`SCORING.md` §1.1). It additionally **flags every subsystem it crosses as `journey_blocked`**,
which does not change those subsystems' scores but does forbid the wave from being reported as
passing. A wave summary containing a `journey_blocked` flag must say so in its first line.

**Rule G4 — the platform gate.** `RI-PLT01`/`02`/`03` are the budget that
`CRITIC-DOCTRINE.md` §2.4.3 depends on. Until all three have been run at least once,
**no critic anywhere in the project may accept a performance-based defence for anything**,
because the caveat that would license it has no content. Once they have been run, a
performance defence is admissible **only** by citing a specific row of `RI-PLT01` §C,
`RI-PLT02` §B or `RI-PLT03` §C, with a run id.

**Rule G5 — Tier-H honesty is a project-level obligation.** Every wave summary reports, per
platform item, the Tier-S score, the Tier-H score, and whether a real-hardware run exists.
`RI-PLT01` rule T2 forbids dropping unmeasured Tier-H checks from the denominator; G5 forbids
concealing that they were unmeasured. **"We have no idea whether this game runs on a phone" is
an acceptable wave finding. Pretending otherwise is not.**

**Rule G6 — cross-item contradictions are defects, not judgement calls.** The journey items
deliberately share instruments and numbers (the state diff between `RI-JRN05` and `RI-JRN06`;
`RI-WLD06` M29/M31 used by `RI-JRN07` and `RI-JRN08`; `RI-PLT03` P1 cited by `RI-JRN01` O5;
`RI-PRG04`'s bloodstain rules executed by `RI-JRN06`). If two verdicts report different values
for the same shared number, that is a **corpus defect** filed against the owning item, not a
disagreement to be split. The owning item, named in each item's Provenance note, wins.

**Rule G7 — the fleet's own gap.** At the end of a wave, the fleet as a whole names **one**
journey that is furthest from its bar, with the single remedy that would move it most. This is
separate from each critic's own `biggest_gap` and is the thing handed to the next wave's
planner.

---

## 6. Running order

Journeys have dependencies and running them out of order wastes naive agents, which are the
fleet's scarcest resource (F8).

```
1.  JC-P1, JC-P2, JC-P3     — platform first. If the sim is variable-timestep (RI-PLT01 HF1),
                              STOP: every combat item and most journey timing is unmeasurable
                              and the wave has a single finding.
2.  JC-05                   — save/load next. If the round trip is not empty, JC-08 cannot run
                              (its cold save will not load) and JC-06's across-death diff is
                              meaningless.
3.  JC-01, JC-03            — the opening and desktop controls, with JC-01N and JC-03N.
                              JC-03N's pre-registration must happen before any other naive
                              agent has been dispatched, because it is the only one that
                              measures pure convention.
4.  JC-04                   — mobile/gamepad, with JC-04N.
5.  JC-02                   — the first hour, with JC-02N. Needs JC-01 and JC-03 to have passed
                              their hard fails or the hour cannot be played.
6.  JC-06                   — death and recovery.
7.  JC-07                   — a quest without markers, with JC-07N.
8.  JC-08                   — returning after a week, with JC-08N. Last, because its cold save
                              must be produced by a non-fleet agent playing normally, and
                              because it depends on JC-05, JC-06 and JC-07 all being sound.
```

**Rule R1 — the cold save is produced outside the fleet.** `RI-JRN08` §A's
`cold-save-hour14.json` is produced by an agent that is not a fleet member and does not become
one, playing normally, and is then committed with its hash. F3 forbids the producer from
judging it and F8 forbids it from ever being a naive agent for this build.

---

## 7. Harness amendments the fleet requires

**None of these exist yet. Until each lands, every check that depends on it is `unmeasurable`
and scores 0, fail-closed** (`CRITIC-DOCTRINE.md` §7.3, `SCORING.md` §1.1). This is the
consolidated request; `HARNESS.md` §10's amendment procedure applies to each.

| Id | Amendment | Needed by |
|---|---|---|
| **A-JRN1** | **Real-input mode.** `setMode('play-instrumented')`: real DOM/pointer/keyboard/gamepad listeners connected to the sim, but the clock still advanced only by `stepFrames`. Plus trace events `first_input`, `first_control`, and a **UI-text stream** (`getUIText()` → every string rendered this frame outside a dialogue/journal/book surface, with its screen rect). Without this, the entire input path is untestable, because `HARNESS.md` R4 deliberately bypasses it | JRN01–JRN04, JRN07, JRN08, PLT03 |
| **A-JRN2** | **Gamepad shim.** `__HARNESS.gamepad.connect(descriptor) / .set(idx,{buttons,axes}) / .disconnect(idx)`, injecting at the **`navigator.getGamepads()` seam** and dispatching real `GamepadEvent`s. Descriptors must include a `mapping:'standard'` and a `mapping:''` DualSense-like variant. **A shim that injects at the action seam measures nothing and must be rejected** | JRN01 M13, JRN04 |
| **A-JRN3** | **Save instrumentation.** Promote `saveState()`/`loadState()` from *Optional* to **Mandatory**. Add `getStateHash()` (sha256 of canonical serialisation), `getSaveManifest()`, `exportSave()`/`importSave()` (bytes), `getStorageInfo()` → `{backend, bytesUsed, quotaBytes, writes, lastWriteMs, persisted}`, and `simulateStorageFailure(kind)` for `kind ∈ {quota, ephemeral, no-idb, truncate, flip-byte, future-schema}` | JRN05, JRN06, JRN08 |
| **A-JRN4** | **Viewport/orientation control.** `setViewport({w,h,dpr,orientation,safeAreaInsets})`, `getSafeArea()`, and a runner profile for `phone-390x844-landscape` at dpr 3 with `(pointer: coarse)` / `(hover: none)` forced | JRN01 M13, JRN04 |
| **A-JRN5** | **Per-frame perf stats.** `getPerfStats()` → `{simMs, renderCpuMs, drawCalls, triangles, programsBound, materials, stateChanges, skinnedMeshes, shadowLights, textureMB, geometryMB, heapUsed, allocBytesThisStep}`; `traceStart({perf:true})` adds a `perf` block to every FrameRecord | PLT01, PLT02, PLT03, JRN05 M15 |
| **A-JRN6** | **Input observability.** `getInputState()` → `{pointerLocked, hasFocus, activeDevice, deviceClass, held[], bindings, droppedInputs}`, plus an `input_dropped` trace event | JRN03, JRN04 |
| **A-JRN7** | **Trace event vocabulary extension** (`elder-souls/trace@1` §5's closed list, extended by amendment): `first_input`, `first_control`, `input_action`, `surface_enter`, `surface_exit`, `dialogue_open`, `dialogue_close`, `topic_select`, `journal_write`, `save_write`, `save_read`, `region_stream_in`, `region_stream_out`, `load_boundary_begin`, `load_boundary_end`, `hitch`, `input_device_change`, `bloodstain_create`, `bloodstain_recover` | all journey items |
| **A-JRN8** | **`getWorldStats()` extension**: add `programs`, `materials`, `stateChanges`, `skinnedMeshes`, `shadowLights`, `geometryMB`, `audioMB`, `atlasCount` | PLT01, PLT02 |
| **A-JRN9** | **Heap and GC access.** Chromium launched with `--js-flags=--expose-gc`; runner support for CDP `Runtime.getHeapUsage`, `HeapProfiler.takeHeapSnapshot` and the sampling profiler; `__HARNESS.forceGC()` where available | PLT01 M4/M5, PLT02, PLT03 |
| **A-JRN10** | **Wall-clock advance.** `advanceWallClock(ms)` so that "eleven days later" exercises incubation timers, restocks, scheduled events and any elapsed-time logic. Must not perturb the fixed 60 Hz sim or the trace hash | JRN08 |
| **A-JRN11** | **Render decoupling and stalls.** `setRenderRate(hz)` including `0` (render disabled), and `stallMainThread(ms)` for the catch-up-bound test | PLT01 M3/M6/M8, JRN03 M-K12 |
| **A-JRN12** | **Keyboard layout control.** Runner support for CDP keyboard-layout emulation across QWERTY/AZERTY/QWERTZ, so `KeyboardEvent.code` vs `.key` is testable | JRN03 M-K2 |
| **A-JRN13** | **Dialogue state as presented.** `getDialogueState()` → the topic list, greeting and answer text **as the player could see them**, not as the data file stores them | JRN07, JRN08 |
| **A-JRN14** | **Resource registry.** `getResourceRegistry()` → live geometries/textures/materials/programs with byte sizes, plus registered event listeners and every declared cache with its entry/byte bounds | PLT02 |
| **A-JRN15** | **Load state.** `getLoadState()` → `{phase, bytesFetched, requestsInFlight, regionsResident, prefetchQueue}`, plus runner support for CDP network throttling and cold-profile launches | PLT03 |

**New tooling the fleet assumes** (to be built under `tools/`, all named in the items):

```
tools/journey/journey-run.mjs      drive a named journey, write a journey run directory
tools/journey/gamepad-shim.mjs     the A-JRN2 page-side shim
tools/journey/beat-extract.mjs     stripped beat/interaction timelines for blind packs
tools/journey/state-diff.mjs       canonical state diff (round-trip and across-death modes)
tools/journey/cadence.mjs          RI-JRN02 §B cadence metrics
tools/journey/competence.mjs       RI-JRN02 §C early-vs-late competence curve
tools/journey/naive-driver.mjs     dispatch + transcript capture for naive agents (I1–I8)
tools/platform/calibrate.mjs       cpu_index for RI-PLT01's sim_units
tools/platform/perf-run.mjs        Tier-S/Tier-H perf runs; refuses Tier-H on a software renderer
tools/platform/alloc-probe.mjs     per-sim-step allocation
tools/platform/decoupling.mjs      sim/render decoupling and determinism under load
tools/platform/leak-run.mjs        the RI-PLT02 §C ten-minute loop
tools/platform/heap-walk.mjs       snapshot diff, retained-by-constructor
tools/platform/asset-budget.mjs    static asset/download budget from the manifest
tools/platform/load-run.mjs        cold/warm load, network emulation
tools/platform/hitch-census.mjs    hitch counting and attribution
tools/platform/stream-audit.mjs    region-border and prefetch audit
```

---

## 8. How this fleet fails

Written pessimistically, in advance, so the next planner can check.

1. **The naive agents are quietly dropped** because they are expensive, cannot be reused (F8),
   and always produce awkward findings. Every journey item then scores on its instrumented pass
   alone, which measures whether the game *works* and never whether it is *comprehensible* —
   and comprehensibility is the whole Morrowind half of the brief.
2. **Isolation degrades to "we used a different agent".** The agent read the corpus in a prior
   turn, or was handed a screenshot, or was told "the game uses rumours". F6's
   `agent_had_prior_context` field is a checkbox and checkboxes get ticked.
3. **A journey critic is given all eight items** because it is easier to dispatch, and it judges
   the overlap rather than its own item. F1.
4. **The join test is skipped.** Every link passes, the journey fails, and the verdict says
   "all checks passed but it didn't work", which is the least useful sentence a critic can
   write. F5 exists to convert that into a named hand-off.
5. **The platform items are run once, in this container, and treated as done.** Tier-H stays at
   0 forever, nobody ever runs the game on a phone, and the project ships something that has
   never been executed on its target device. G5 makes that visible; it cannot make it not
   happen.
6. **`journey_min` is not reported**, and a build with one catastrophic journey and eight good
   subsystems reads as healthy. G2.
7. **The fleet finds gaps and the gaps are all in other people's items.** A journey critic's
   easiest move is to blame the subsystem: "the save fails because the quest system holds state
   in closures". Sometimes true, and it must still name a remedy in a named file (§2.2), or it
   is a complaint rather than a verdict.
8. **The cold save is produced by a fleet member**, because it is the same work as playing the
   game, and R1's separation looks like bureaucracy until you notice that the agent judging
   whether a stranger can reconstruct the plan is the agent that made the plan.
9. **Blind packs are assembled by the critic that ran the journey.** `RI-MTH03` owns the blind
   protocol and its independence requirement; the journey items with `blind_pair: yes`
   (`RI-JRN01`, `RI-JRN02`, `RI-JRN07`, `RI-JRN08`) inherit it, and a self-assembled pack is
   not a blind pack.
10. **The fleet's own gap (G7) becomes a summary of the eight individual gaps.** It is supposed
    to be a ranking — one journey, one remedy — and a list is the failure mode `CRITIC-DOCTRINE`
    §2.2 already names at the item level.

---

## 9. Provenance

This is a **doctrine document**, not a reference item: it carries no `judges:` front-matter and
sets no bar of its own. The two subsystem paths it is the judging authority for —
`journey.process.fleet` and `journey.process.naive` — are proposed as
`judged_by_doctrine` entries in `corpus/88-journeys/paths-requested.json`, following the pattern
`subsystems.json` already uses for `COHERENCE-AGENT.md` and `CRITIC-DOCTRINE.md`.

Everything in it is **constructed** and binding. Nothing in it is measured. The rules descend
from: `ARBITRATION.md` §3 (AR-3, the no-gap rule), `CRITIC-DOCTRINE.md` §1.2 (evidence), §2.1
(escalation), §2.2 (exactly one gap), §7 (escalation when unjudgeable), §8 (conflict of
interest), `SCORING.md` §1.1 (fail-closed, hard-fail caps), `CORPUS-CONTRACT.md` §5 (extension)
and §6 (blind comparison), and `HARNESS.md` §10 (amendment procedure).
