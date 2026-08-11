# W1-08 builder delivery — desktop controls closure

This is builder evidence, not a verdict. It applies to the commit containing this report. The
builder did not conduct or score JC-03N: `M-N*` remains zero until an isolated, fresh participant
supplies an `elder-souls/naive-pass@1` transcript. No binary evidence is committed.

## Delivered defect repairs

The rendered-text census now **awaits** the asynchronous title transition, forces a composited
frame, and opens a real census dialogue. `menus`, `dialogue`, and `title` are separately required
non-empty populations; a missing population is `unmeasurable`/zero rather than a clean grep. The
inscription census now selects typed controls-teaching inscriptions (`teaches` plus `situation`),
not readable books owned by another piece.

## RI-MTH07 exhaustive consumption census

The census was frozen against the production files at this report's commit. In every row the
fixture/seed, input stream, viewport, and all unmentioned factors are held fixed. `checks.json`
contains the trace/state observer, but the consequence below is the admissible visible/doable
observation. Every member requires `coupling != 0`; a zero gives its owning RI-JRN03 dimension
**0**, with no partial credit, and must be copied into `status_reasons`.

| Model member | Production consumer | Separated legal values and player consequence | Inert/null red leg |
|---|---|---|---|
| Closed action semantics | `bindings.js` → `pipeline.js` latch → fixed-step player/UI consumers | held sprint sustains displacement; discrete roll emits one edge | disconnect latch: neither world action occurs |
| Desktop binding maps | DOM `.code` map → pipeline → player/world | move/action between two distinct codes; accepted key and displacement/action swap | dead-glass map accepts neither |
| Layout label map | `RebindModel` settings drawer | QWERTY/AZERTY/QWERTZ labels differ while physical `.code` action stays fixed | disconnect label map: pixels stay equal |
| Reserved table/refusal strings | rebind offer/commit → refusal drawer | allowed code commits; `Ctrl+KeyW` and `F5` draw different authored refusal records | suppress record/drawer: visible refusal disappears |
| Pointer-lock graph | real browser handlers → menu/cursor/click-drag fallback | locked play hides cursor; forced error exposes actionable drag-look state | swallow transition: required surface/action is absent, M-K9 red |
| Mouse-look scalar/clamp | mouse transform → camera | separated sensitivity/clamp values change visible yaw/pitch with identical deltas | disconnect transform: view is stationary |
| Rebinding/persistence | `RebindModel` → live map/settings/save restore | two bindings/conflict outcomes visibly differ and the doable key survives cold reload | bypass restore/live map: binding reverts or stops acting |
| Instruction/text budget | draw-call `TextRegister` across menus/dialogue/title | clean authored text vs forbidden `Press E` visibly changes stream and HF5 | strand text before draw or empty one required surface: EMPTY/FAIL |
| Inscription placement records | world loader/drawer/interact reader | two teaching records/distance bands change readable world objects/text | remove register: no object can be seen/read, M-K21 red |

Additional current-HEAD models were enumerated rather than silently folded into those nine:
edge de-duplication (`repeat` false/true → one fire; sever edge queue → no action), focus lifecycle
(focused/unfocused → held movement vs release in one frame; suppress lifecycle → HF2), and the
pipeline-loss counter (`pipelineDrops` remains distinct from combat `bufferMisses`; disconnect the
pipeline → M-K24 red). These use the same production consumers and player-doable consequences.

## Native aggregation and ownership seams

* RI-JRN03 builder gates are exercised separately with `input-checks --group desktop`, and red
  controls are exercised by `--self-test`. The current run measures 16 primary routes, `.code`,
  repeat, release, look, pointer-lock, latency and 10,000-input pipeline population.
* RI-DLG09 uses the existing `interact`/parley route and does not add a seventeenth action. No
  dialogue-system behavior was rebuilt.
* RI-JRN02 first-hour evidence and RI-JRN04 pad/touch evidence are dependencies for later
  aggregation. This change does not rerun or modify their owned journeys/device matrix.
* RI-CMB09 intentional buffer expiry remains `bufferMisses`; M-K24 measures only
  `pipelineDrops`. Neither is relabelled to make the other zero.
* Generic interior readables are not controls inscriptions. This prevents concurrent content
  work from entering W1-08's DS2/DS3 population.

## Evidence and reproduction

The bounded browser run produced temporary `/tmp/w1-08-desktop/checks.json`; it was inspected and
not committed. Before the two census repairs it showed title as an empty required population and
three generic interior books as false DS3 misses, proving both fail-closed arms. Reproduce the
final textual evidence with:

```sh
node --check tools/journey/input-checks.mjs
node tools/boot-check.mjs
node tools/journey/input-checks.mjs --group desktop --out /tmp/w1-08-desktop
node tools/journey/input-checks.mjs --self-test --out /tmp/w1-08-self-test
```

Run stateful groups separately. Supply the independently produced naive transcript only with
`--group naive --naive PATH`; the builder must never manufacture it. Physical-device rows remain
for W1-29's physical-device tester and are not claimed here.
