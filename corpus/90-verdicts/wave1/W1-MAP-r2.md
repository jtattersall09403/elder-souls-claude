# W1-MAP — round 2 verdict

**Piece:** W1-MAP, the discovery map.
**Binding:** `corpus/00-doctrine/ARBITRATION.md` seam **S35** (the owner's overrule of S30), and
`corpus/00-doctrine/AMENDMENT-W1-MAP-01.md`.
**Critic:** `critic-w1-map-r2`, fresh context.
**Commit:** `f291b01`. Every number below is a claim about that tree (rule 12).
**Score:** **3.0** (min over axes). **Wave-1 gate is 7.0 — this does not pass.**
**AR-2:** not triggered on the honest path. **`seam_sterile: true`** — §7.

**Why this round exists.** A defect in `game/src/save/fight.js` serialised the live `SoulsAI` as a
plain object, so the next fixed step after any save/load with a hostile present threw
`this.ai.step is not a function` while `boot-check` stayed green. `W1-SAVE-AI` fixed it and listed
`W1-MAP-r1` C2/D1/D2/D3 as measurements to re-take. **They have been re-taken, in two arms, and all
four survive as passes.** What did not survive re-examination is the forged-save result: it is
*worse* than round 1 recorded.

---

## 1. First, the premise — and it is overstated

The dispatch says the four findings were *"presented as four map failures on a walk whose steps
never ran."* **They were not presented as failures.** `W1-MAP-r1.md` §1 lists C2, D1, D2 and D3 in
its results table as passes; §9 records that they *first appeared* as failures, that
`critic-w1-map-stepcheck.mjs` reproduced the throw with `sim.discovery` removed entirely, and that
preconditions C0/D0 were added so that a walk which did not step could not be filed as a map defect.
Its closing line is *"I nearly filed four false findings and the preconditions are what stopped
it."* The fixer's own status file is accurate where the brief is not — `W1-SAVE-AI.json:91` says
*"The critic caught the misattribution, but C2/D1/D2/D3 are worth re-taking."* They were worth
re-taking. **No false finding was ever published, and the round-1 critic's preconditions are the
reason.** That is the correct outcome of the method and it should be recorded as one.

## 2. The re-take. All four reproduce, in both arms

`tools/harness/critic-map-r2.mjs` runs C2/D1/D2/D3 twice: once in an empty world, once with three
live hostile `SoulsAI` controllers on the floor — the condition that used to kill the walk. Step
faults, frames advanced and cells drawn are counted per arm.

| | check | clean arm | hostile arm |
|---|---|---|---|
| **precondition** | faults / frames advanced / cells drawn / live hostile AI | 0 / 6 / 2106 / 0 | **0 / 8 / 2115 / 3** |
| **C2** | partial map: undiscovered ground still the screen's own colour and still the majority | `#0b0a08` at **95.43%**, 2106/42846 drawn | `#0b0a08` at **95.41%**, 2115/42846 drawn |
| **D1** | square only after standing in the pad | region(+480 m) `false`, near(+40 m) `false`, standing `true` | identical |
| **D2** | hover name is the place name from `pois.json` | `"Thorn"` == `pois.name` | identical |
| **D3** | naming element carries no quest identity | `quest:null objective:null travel:false` | identical |

**The two arms agree exactly** (`R-agree`). The cause named in the round-1 verdict — that the
failures were a walk whose steps never ran — is confirmed, and the findings themselves are
properties of the map rather than artefacts of the save.

**The premise is verified, not assumed.** `P1`: at `f291b01`, a save/load with hostiles present
keeps a live AI (`SoulsAI` → `SoulsAI`, 3 → 3 live) and 60 fixed steps run with zero faults.

**And the fault detector is not inert.** `P3` runs in every mode, not only under `--break`: it
replaces a live `ctl.ai` with a plain object — the defect's exact shape — and requires the detector
to fire. It does, with the original message `this.ai.step is not a function`. Every "0 faults"
figure in this verdict comes from a detector that has been watched going red (rule 6).

## 3. Attack A — the forged save. **The hole is open, and it is wider than round 1 recorded**

Round 1 forged `world.discovery.stood` and handed the object to `loadState()`. A builder could
fairly answer that `loadState()` is a harness verb. So this round attacked the route a player's
save file actually takes.

**A9 — through the game's own sealed container.** `game/src/save/exchange.js exportSave()` computes
the sha-256 that `importSave()` verifies. Handed a forged blob, **the game seals it for the
forger**, and the reader accepts it:

| check | result |
|---|---|
| **A9** | **124,898 sealed bytes accepted through `importSave()`** → `place_count = 42/42`, `revealed = 42846/42846`, **42 squares drawn** |
| **A12a** | bytes edited *after* sealing → **refused**: *"This ledger has been altered since it was written; the seal does not match."* |
| **A12b** | the same forgery *resealed by the game's own writer* → **ACCEPTED** |

A12a and A12b together are the finding: **the seal is an integrity check, not an authenticity
check.** An unkeyed digest stops corruption. It does not stop a forger, because a forger recomputes
it — and here does not even have to, because the shipping writer will do it for him.

**A10 — and it is not an artefact of the dead load.** The brief's warning is well placed: forging a
save is precisely the operation that was broken, so a round-1 attack that "passed" could have passed
because the load died. It did not. After importing the forgery, two hostiles were spawned and
**180 fixed steps ran with 0 faults**, and the map still held **42/42 places and 42,846/42,846
cells**. The forgery is durable in a running world.

`docs/shots/2026-08-08-critic-map-r2-forged.png` is that map: the whole province in full region
colour, 42 gold squares, `"Places I have stood in."` along the foot — for a character who has walked
nowhere, from a file the game itself sealed.

### 3a. "Is the hole closed, or was the report closed?" — **neither, and the report is the worse half**

The brief asks for this distinction explicitly. The answer is unambiguous.

**A11.** On the fully forged state, *every* number the build publishes about the map reads clean:

```
places_drawn 42 == places_discovered 42 · markers 0 · routes_drawn 0 · quest_bearing 0
travel 0 · numeric_text 0 · dropped_on_load 0 · drawn_cells 42846 · revealed_cells 42846
```

**Nothing the build publishes distinguishes a forged map from an honest one.** This is the round-1
W1-21 sentence — *"because both of those numbers came from the same forged model"* — still true, two
rounds later, at `f291b01`.

**A5 — and the signal that would catch it already exists and is thrown away.**
`Discovery.restore()` computes `dropped, phantom_cells, missing_cells, claimed_places,
derived_places, stood_cells, legacy`. `save/state.js:676` keeps `.dropped` and discards the rest;
`mapState()` publishes only `dropped_on_load`. **Published footprint-audit fields: none.** That is
round 1's remedy 1, verbatim, not done.

**The build's own probe is 32/32 at this commit, and its forgery check passes.**
`map-probe.mjs` L3 — *"a FORGED save naming a place the raster does not corroborate is refused"* —
**PASSES**, because `map-probe.mjs:440` still forges `world.discovery.places`, the field
`Discovery.RESTORE_READS` was deliberately narrowed to exclude. It is aimed at a field the loader
provably never reads. That is round 1's remedy 2, also not done. A green 32/32 and 42 phantom
squares on the same tree, in the same hour.

## 4. Attack C — "no API by which a quest could touch the map"

**The static half is genuinely held.** `grep -rn "map|discovery|__ENGINE|reveal|marker|Discovery"`
over all eight files of `game/src/sim/quest/` returns quest-internal `reveal()` (a `know:` flag,
nothing to do with the map), `Array.prototype.map`, and one S35 comment in `topic-supply.js`. **No
quest module imports or reaches a map module.** `screens/map.js` does not import `roads.json` and
does not touch `sim.quest`; `_uiCtx().map` is a closed list with no quest state in it; `openMenu`
rejects arguments; and **Q4 passes** — `tryPlaceMapMarker` runs 13 attempts against the model's own
surface, 0 succeed, the requested place never appears and the place list does not move.

**But there is a reachable setter, and there are now two routes to it.**

* **Q1** — `Object.getOwnPropertyDescriptor(sim, 'discovery')` is `writable: true, configurable:
  true`, and `eng.questEngine.sim === sim` is **true**. `QuestEngine` is constructed with the sim at
  `engine.js:538`, stores it at `machine.js:79`, and `engine.js:8141` re-assigns it on every rebind.
* **Q2** — assigning a substitute model *through the object the quest machine itself holds* draws
  **3 squares**. Call path: `QuestEngine.this.sim.discovery = <object with the reader surface>` →
  `Engine._uiCtx()` (`engine.js:3726-3727`) → `UISystem._mapModel` → `drawMap`.
* **Q3 — the back door the brief names.** `main.js:24` publishes `window.__ENGINE`.
  `window.__ENGINE.sim.discovery = <forged>` draws **2 squares**, and `getCapabilityReport()` does
  not mention `__ENGINE` anywhere, so capability prohibitions installed on the harness do not cover
  it.

Per the brief's own standard — *one reachable setter is a fail whether or not any quest calls it
today* — this fails. `api.js:272` records the route honestly as *"not defended… anything holding
`sim` can do this"*, and that disclosure is worth credit; it is not the claim S35 makes. **The
remedy is one line and was already named in round 1:** `Object.defineProperty(sim, 'discovery',
{value: d, writable: false, configurable: false})` after construction.

## 5. Attack D — undiscovered is unrendered. **It holds, and the pixel test everyone has been using does not measure the screen**

**S35 holds.** `screens/map.js:103` is `if (!m.seen(cx, rz)) continue;`. The screen's own ground is
painted first as a flat fill and left showing; there is nothing underneath it to dim. On a fresh map
`drawn_cells = 0` and `revealed = 0` — **no undiscovered cell is painted at any alpha**, so the
geometry is not in the scene and no coastline can be read. Greyed, fogged, dimmed and
drawn-then-masked are all structurally excluded, not disciplined away.

**But the instrument needs correcting, and this is a finding about the round-1 verdict as well as
about the build's probe.** Round 1's C1/C3 and my own first U1/U2 both read
`UISurface.ctx.getImageData` — **the interface's own 2D canvas** — and both reported *"the terrain
box holds exactly one colour"* with a per-channel range of `[0,0,0]`. That is true of the UI layer
and **it is not true of the picture**: the map panel is drawn at `CALM_ALPHA` over the running 3D
world, and in `docs/shots/2026-08-08-critic-map-r2-fresh.png` the arches and buildings of the
Rootlands are plainly visible through the black box.

`tools/harness/critic-map-r2-composite.mjs` re-takes it on the composited frame (screenshot, decoded
with `pngjs`) and separates the two causes, **5/5**:

| | check | result |
|---|---|---|
| **X1** | fresh map paints zero cells | `drawn_cells = 0/42846`, `revealed = 0` |
| **X2** | UI layer, chevron excluded / not excluded | **1** colour / **15** colours — the artefact round 1 warned about, reproduced |
| **X3** | the composited frame is **not** one colour | 44 distinct over 345,071 px, channel range `[11,11,11]` |
| **X4** | two *empty* maps photographed from different places differ | 44 → 92 colours, `drawn_cells 0 → 0` — **the variation is the world behind the panel** |
| **X5** | same place, a walked body | 44 → 1855 colours, `drawn_cells 0 → 2911` — **the map is separable from the scene** |

So the S35 conclusion stands, but it is carried by the draw loop and by `drawn_cells`, **not** by a
colour count. A verdict that says "the terrain box holds exactly one colour" is describing a surface
and not a picture, and the next critic should not read it as the latter.

## 6. Attack E — hover names

| | check | result |
|---|---|---|
| **E3** | being **told** about a place must not put a square on the map | `questEngine.learnFrom('place', …)`, `setWorldKnowledge`, `learnTopic` all ran; places `[lilmoth] → [lilmoth]` — **unchanged** |
| **D1** (§2) | not on region entry (+480 m), not when near (+40 m), only when standing | `false / false / true`, both arms |
| **E4** | one square per place, no duplicates | `squares = 2 == placeCount = 2`, ids unique |
| **E5** | the name is that place's own `pois.json` name | `"Lilmoth"` names `lilmoth`, whose `pois.name` is `"Lilmoth"` |
| **E6** | markers / routes / numerals / travel / quest identity, and journal separation | `0 / 0 / none / none / none`, `reachable_from_journal: false` |

**This block is the one where I nearly filed two false findings, and the repairs are the point.**
My first version read `placeCount 0 → 1` after the "tell" attempts and `naming = "Lilmoth"` where I
had asserted `"Thorn"`. Both looked exactly like build defects. Both were my fixture:

1. **The default start position is inside Lilmoth's own pad.** My E3 baseline was taken *before* the
   first step, so the four steps after the tells recorded the ground the body was already standing
   on. The baseline is now taken after stepping, and the answer is `unchanged`.
2. **The naming element names `places[placeIdx]`** — the first place *found*, i.e. Lilmoth from the
   spawn — not the place last walked into. The property S35 requires is that whatever it names, the
   string is that place's own world-data name. It is.
3. **`Q4` moved the place list**, which reads like the marker call working. It is not:
   `tryPlaceMapMarker` ends by calling `d.observe(4600, 5200)` to demonstrate that surplus arguments
   are ignored, and `observe()` records **the cell the body is in**. On a model I had just cleared
   and not stepped, that legitimately added Lilmoth.
4. **`A12` originally PASSED** by matching the substring `"signature"` in the save manifest — which
   is `regionSignature`/`focusSignature` and has nothing to do with saves. An inert check that
   passed for the wrong reason. It is now the two executed arms A12a/A12b in §3.

All four are documented in the tools. A critic who filed any of them would have repeated exactly the
mistake round 1 avoided.

## 7. Attack G — CONSUMPTION (RI-MTH07, mandatory under ARBITRATION §3)

**The only consumer of the discovery model is the map's own draw call.** As the brief anticipated:
that is a finding, not a pass.

Enumerated at `f291b01`: every reader of `sim.discovery` in `game/src/` is `ui/system.js`
(`_mapPlaces`/`_mapModel`/`state`), `harness/api.js` (`mapState`, `tryPlaceMapMarker`),
`save/state.js` (serialise/restore) and `engine.js` (construction, `_uiCtx`, the reset register).
**Nothing under `game/src/sim/` reads it** — `sim/step.js` only *writes* it via `stepDiscovery`. No
NPC, no enemy, no dialogue, no quest, no signpost, no travel system.

Demonstrated by ablation, with the discovery blob excluded from the hash — without that exclusion
the arms differ trivially because the save carries the raster:

* **G1** — the ablation is real: arm A records 2209 cells, arm B records 0.
* **G1b** — the arms are comparable: 0 step faults in each.
* **G2** — world hash `c23bbb77:52365` in **both** arms. **Identical.** Destroying the model
  entirely changes nothing an entity does.
* **`--break consumer`** installs a real durable world-side reader and **G2 goes GREEN**, which is
  what makes G2 evidence rather than a tautology: an assertion whose pass condition is "nothing
  happened" is worth nothing until it has been shown to notice something happening.

**`seam_sterile: true`**, on the same reasoning round 1 gave and I agree with: a record of where you
have been is legitimately internal, and S35 requires wayfinding to work with the map closed —
`world/province.js` signposts already carry it.

## 8. Self-tests: this instrument has been shown able to fail

```
--break unrendered  -> U1, U2, U3 red             SELF-TEST OK
--break standing    -> R-D1-clean, R-D1-hostile red  SELF-TEST OK
--break consumer    -> G2 GREEN                    SELF-TEST OK
P3 (every run)      -> the step-fault detector fires  CONTROL OK
```

`--break unrendered` reddens U2, the channel-range test, which is the detector for a
drawn-then-masked province specifically.

## 9. Scores

| axis | round 1 | now | why |
|---|---|---|---|
| S35 surface refusals (unrendered, routes, numerals, travel, naming, journal separation) | 9 | **9** | verified at the composited frame as well as the UI layer, in both arms; §2, §5, §6 |
| S35 "no square for a place not personally stood in", adversarially | 5 | **3** | same hole, demonstrated **wider** — through the sealed player-facing save file, and durable across 180 stepped frames with hostiles; no remediation landed |
| instrument adequacy — can this build detect its own violation? | 4 | **3** | `map-probe` 32/32 **and L3 green** while 42 phantom squares render; the computed audit still unpublished; and the pixel test everyone relied on measures the UI surface, not the screen |
| API closure ("no API by which a quest could touch the map") | 6 | **5** | unchanged writable slot, **plus** the `window.__ENGINE` route, which no capability prohibition covers |
| CONSUMPTION (RI-MTH07) | 4 | **4** | zero world-side consumers, unchanged |

**Min over axes = 3.0.** Gate 7.0. **Round 3 required.**

Two axes fell. Nothing in round 1's remedy list has landed, and the round found a wider attack
surface than round 1 recorded on each of the two axes that moved.

## 10. The single biggest remaining gap, with a buildable remedy

> **Nothing in this build can tell an honest map from a completely forged one, because every
> compliance number it reports is derived from the model being audited — and the forgery now works
> through the player's own save file, sealed by the game's own writer.**

Round 1's three-step remedy is still correct and still undone. It gains a fourth and a fifth:

1. **Publish the signal that already exists.** `restore()` computes `stood_cells`, `phantom_cells`,
   `missing_cells`, `legacy` into `lastRestore`; `save/state.js:676` keeps only `.dropped`. Carry the
   whole audit onto `sim`, surface it through `mapState()` and `getUIState().map`.
2. **Point the forgery check at the field that is read.** `map-probe` L3 forges
   `world.discovery.places`. Replace it with a forgery of `world.discovery.stood` in the wire format
   (`critic-map-r2.mjs forgeTrail()` is 9 lines), and give it a `--break forge` self-test.
3. **Corroborate the footprint against something written by a different system.**
   `engine.js` already maintains `this.travel.visited` — 25 m bins of the legs actually stood in.
   Checking `stood` against it is not a fixed point on one field. *(Still not isolated: I read its
   declaration, not its coverage. Named as a direction, not a proven fix — same as round 1.)*
4. **Freeze the slot.** `Object.defineProperty(sim, 'discovery', {value: d, writable: false,
   configurable: false})`. One line; closes Q1, Q2 and Q3 together. Cheap and should not wait.
5. **Say what the seal is.** `exchange.js`'s sha-256 is an integrity check and the code should say
   so where it is read, because two rounds of verdicts have now had to discover it. If the map is
   going to trust exactly one field, that field wants a keyed check or an out-of-band corroborator
   (remedy 3), not a digest the writer will recompute on request.

And reconcile the two documents that still disagree, unchanged since round 1: `discovery.js`'s
header (lines 46-50) claims both hard fails *"fail closed against a blob whose every field is under
the attacker's control"*; `w1-21-r2-forge.mjs` R8 says they do not. **R8 is right. A9 is the
screenshot.** The header is the one the next author will read.

## 11. Reported plainly, as rule 26 requires

* **Contention.** `node tools/contention.mjs --gate` returned **GO** before every browser run except
  the screenshot pass, where it returned **exit 3** (over the instance ceiling). I proceeded, as
  rule 21 permits and requires me to declare, because one browser was the only work left and the
  frames are gated on their own content rather than on timing. **One browser per tool run, kept for
  the whole run**, and my own rather than `tools/capture/` because every measurement here steps the
  simulation (rule 20). **No timing figure appears in this verdict** — every number is a count, a
  boolean or a pixel colour.
* **Four of my own checks were wrong and were repaired before filing** (§6). Two of them would have
  been false findings about the build.
* **What I did not do.** I did not isolate `travel.visited`'s coverage (remedy 3), same gap as round
  1. I did not test the forgery against a *cold* browser reload — `importSave` was driven in a live
  session, which is the harder case for the attacker and the one I could measure. I did not audit
  the local view's own pixels; §5's numbers are the world view.
* **No code change was proposed as a fix and none was made.** No file under `game/` was edited.
* **The map itself is good.** Read §2, §5 and §6 together: the screen S35 asked for exists, it
  refuses everything S35 forbids, and the refusals are structural. The whole of this verdict's
  distance from the gate is one field the loader trusts and one slot nobody froze.

## 12. Files

**Written by this verdict:** `corpus/90-verdicts/wave1/W1-MAP-r2.md` and `.json`,
`orchestration/status/critic-w1-map-r2.json`, `tools/harness/critic-map-r2.mjs`,
`tools/harness/critic-map-r2-shots.mjs`, `tools/harness/critic-map-r2-composite.mjs`,
`docs/shots/2026-08-08-critic-map-r2-{fresh,partial,explored,forged}.png`, one line in
`reports/blog-feed.jsonl`. **No file under `game/` was edited.**

**Reproduce:**
```
node tools/harness/critic-map-r2.mjs             # 26/40 — the 13 findings
node tools/harness/critic-map-r2.mjs --break all # three SELF-TEST OK
node tools/harness/critic-map-r2-composite.mjs   # 5/5 — the composited-frame correction
node tools/harness/critic-map-r2-shots.mjs       # four gated frames
node tools/harness/map-probe.mjs                 # 32/32, L3 green, on the same tree as A9
```
