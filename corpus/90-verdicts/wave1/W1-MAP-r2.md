# W1-MAP — round 2 verdict

**Piece:** W1-MAP, the discovery map.
**Binding:** `corpus/00-doctrine/ARBITRATION.md` seam **S35** (the owner's overrule of S30), **as
amended in place by S38**, and `corpus/00-doctrine/AMENDMENT-W1-MAP-01.md`.
**Critic:** `critic-w1-map-r2`, fresh context.
**Commit:** `f291b01`, plus the uncommitted **S38** ruling and `tools/map/arbiter-map-s38.mjs` in
the working tree. Every number below is a claim about that tree (rule 12).
**Score:** **4.0** (min over axes). **Wave-1 gate is 7.0 — this does not pass.**
**AR-2:** not triggered on the honest path. **`seam_sterile: true`** — §8.

**Why this round exists.** A defect in `game/src/save/fight.js` serialised the live `SoulsAI` as a
plain object, so the next fixed step after any save/load with a hostile present threw
`this.ai.step is not a function` while `boot-check` stayed green. `W1-SAVE-AI` fixed it and listed
`W1-MAP-r1` C2/D1/D2/D3 as measurements to re-take. **They have been re-taken, in two arms, and all
four survive as passes.**

**And a ruling landed underneath me while I worked.** **S38** was written into `ARBITRATION.md`
during this run and it disposes of most of the forged-save case this round was dispatched to press.
I have honoured it, re-scored against it, and say so at length in §3 — including the part where my
own sharpest evidence turns out to *support* the ruling rather than undermine it. One clause of S38
survives my attack, and finding it is the main thing this verdict contributes.

---

## 1. First, the premise — and it is overstated

The dispatch says the four findings were *"presented as four map failures on a walk whose steps
never ran."* **They were not presented as failures.** `W1-MAP-r1.md` §1 lists C2, D1, D2 and D3 in
its results table as passes; §9 records that they *first appeared* as failures, that
`critic-w1-map-stepcheck.mjs` reproduced the throw with `sim.discovery` removed entirely, and that
preconditions C0/D0 were added so a walk that did not step could not be filed as a map defect. Its
closing line is *"I nearly filed four false findings and the preconditions are what stopped it."*
The fixer's own status file is accurate where the brief is not — `W1-SAVE-AI.json:91` says *"The
critic caught the misattribution, but C2/D1/D2/D3 are worth re-taking."* They were worth re-taking.
**No false finding was ever published, and the round-1 critic's preconditions are the reason.**

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
original failures were a walk whose steps never ran — is confirmed, and the findings themselves are
properties of the map rather than artefacts of the save.

**The premise is verified, not assumed.** `P1`: at `f291b01`, a save/load with hostiles present
keeps a live AI (`SoulsAI` → `SoulsAI`, 3 → 3 live) and 60 fixed steps run with zero faults.

**And the fault detector is not inert.** `P3` runs in every mode, not only under `--break`: it
replaces a live `ctl.ai` with a plain object — the defect's exact shape — and requires the detector
to fire. It does, with the original message. Every "0 faults" figure here comes from a detector that
has been watched going red (rule 6).

## 3. Attack A — the forged save, and the ruling that landed underneath it

### 3a. What I measured

I pressed this harder than round 1 did, because the brief asked me to and because forging a save is
precisely the operation the `SoulsAI` defect used to break — so a previous "the attack passed" could
have been a load that died.

| check | result |
|---|---|
| **A9** | **through the game's own container**: `save/exchange.js exportSave()` seals the forged blob, `importSave()` accepts **124,898 bytes** → `place_count 42/42`, `revealed 42846/42846`, **42 squares drawn** |
| **A10** | **it is not a dead load**: 2 hostiles spawned, **180 fixed steps, 0 faults**, map still 42/42 and 42846/42846 |
| **A12a** | bytes edited *after* sealing → **refused** (*"the seal does not match"*) |
| **A12b** | the same forgery *resealed by the game's own writer* → **ACCEPTED** |

`docs/shots/2026-08-08-critic-map-r2-forged.png` is that map: the whole province in region colour,
42 gold squares, for a character who has walked nowhere.

### 3b. And S38 rules that none of it is a fail — correctly

**`ARBITRATION.md` S38 landed in the working tree during this run**, referred by the W1-21 round-2
critic, and it amends S35 in place:

> *"S35's 'any square for a place the player has not personally stood in' and 'terrain rendered
> where the player has not been' **bind the map's derivation and the game's own authoring surface.
> They do not bind the authenticity of a save file, and a critic may not fail a build for a forged
> footprint.**"*

I did not know S38 existed when I designed this attack — I grepped `ARBITRATION.md` for `S35` and
read that row, and S38 is the row below it. That is my error and it is worth recording as one.
Having read it, **I agree with it**, and I will not score against it. Its reasoning is better than
the case I was sent to make: Morrowind's own map sits in an editable `.ess` and nobody has called
that a defect in Morrowind; a clause that fails our map for a property the source material never had
is an anti-cheat mandate this corpus never issued.

**My own evidence strengthens the ruling rather than weakening it.** A12b is the sharpest fact I
found — the game's *own writer* will seal a forged blob on request — and what it shows is that there
is no authenticity boundary here to defend, only the appearance of one. That is S38's point,
arrived at from the other direction. I record A9 and A12a/A12b as **measurements, not findings**, and
recommend one line of comment in `exchange.js` saying the seal is an integrity check, because two
rounds of critics have now had to discover that for themselves.

**I verified S38's gate independently rather than taking it on faith.** `node
tools/map/arbiter-map-s38.mjs` → **6/6**, exhaustive over all **42,846 of 42,846** generators, 0
unjustified squares, 0 out-of-sightline cells. `--control=pre-s38` → **exit 1**, red 4 of 6 against
the historical loader. The gate is real and its control bites.

### 3c. The clause of S38 that survives — and the S38 gate cannot see it

S38 keeps four hard fails. (a), (b) and (c) I take up below. **(d) is this:**

> *"a discrepancy between the blob's claims and the derivation is **itemised**, not swallowed."*

**S38-4 verifies (d) by forging the claim fields** — an all-ones raster and all 42 names — and reads
back `dropped = 41 names, phantom_cells = 41566`. Loud, correct, and it is the only shape of forgery
that clause is ever tested against.

**But the natural forgery writes nothing to contradict.** Mine sets `cells: ""` and `places: []`,
because there is no reason for a forger to supply claims the loader is going to overrule. Then:

```
A13, on a forged footprint with cells:"" and places:[] —

  the audit holds   {dropped: [], phantom_cells: 0, missing_cells: 42846,
                     claimed_places: 0, derived_places: 42, stood_cells: 42846, legacy: false}

  moved             missing_cells 42846 · stood_cells 42846 · derived_places 42
  published by mapState() / getUIState().map     NONE
  the two fields S38-4 reads    dropped [] and phantom_cells 0 — BOTH SILENT
```

So on the save that fills the entire province, **the two signals S38's own gate looks at are exactly
zero**, three other signals are enormous, and **not one of them is reachable through any published
surface**: `save/state.js:676` keeps `.dropped` and discards the rest, and `mapState()` publishes
only `dropped_on_load`. The itemisation exists on the object and dies there.

This is not the tamper-resistance S38 struck out. It is S38(d) as written, and it is a real gap in
both the build and the new gate. **A5** is the same finding from the other end: `restore()` computes
seven audit fields and the published surface carries none of them. It was round 1's remedy 1; it is
now also an S38 clause; it is still not done.

### 3d. What is left of "the report was closed"

The brief asks me to distinguish "the hole is closed" from "the report was closed". Under S38 the
first question is void — there is no hole to close, by ruling. The second is not:

**A11.** On the fully forged state every published number reads clean: `places_drawn 42 ==
places_discovered 42`, `markers 0`, `routes 0`, `quest_bearing 0`, `travel 0`, `numeric_text 0`,
`dropped_on_load 0`. And **`map-probe.mjs` is 32/32 at this commit with L3 — *"a FORGED save naming
a place the raster does not corroborate is refused"* — GREEN**, because `map-probe.mjs:440` still
forges `world.discovery.places`, the field `RESTORE_READS` was narrowed to exclude. S38 says
outright that *"the assertion that belongs in that slot is S38-3"*. Until it is, the build ships a
forgery check aimed at a field the loader provably never reads, and reports a pass for it.

## 4. Attack C — "no API by which a quest could touch the map"

**The static half is genuinely held.** `grep -rn "map|discovery|__ENGINE|reveal|marker|Discovery"`
over all eight files of `game/src/sim/quest/` returns quest-internal `reveal()` (a `know:` flag),
`Array.prototype.map`, and one S35 comment in `topic-supply.js`. **No quest module imports or
reaches a map module.** `screens/map.js` does not import `roads.json` and does not touch `sim.quest`;
`_uiCtx().map` is a closed list with no quest state in it; `openMenu` rejects arguments.

**Q4 passes**, and S38-5 agrees from the other side: 13 attempts on the model's own surface, 0
succeed, the requested place never appears, the place list does not move; `mutators = [observe/0,
restore/1, resume/0, suspend/0]`, 11 accessors scanned, 0 write state.

**But there is a reachable setter, there are two routes to it, and S38 does not cover it.** S38-5
audits the *model's members*. Neither it nor any other S38 assertion looks at the *slot the model
sits in*.

* **Q1** — `Object.getOwnPropertyDescriptor(sim, 'discovery')` is `writable: true, configurable:
  true`, and `eng.questEngine.sim === sim` is **true**. `QuestEngine` is constructed with the sim at
  `engine.js:538`, stores it at `machine.js:79`, and `engine.js:8141` re-assigns it on every rebind.
* **Q2** — assigning a substitute model *through the object the quest machine itself holds* draws
  **3 squares**. Path: `QuestEngine.this.sim.discovery = <object with the reader surface>` →
  `Engine._uiCtx()` (`engine.js:3726-3727`) → `UISystem._mapModel` → `drawMap`.
* **Q3 — the back door the brief names.** `main.js:24` publishes `window.__ENGINE`.
  `window.__ENGINE.sim.discovery = <forged>` draws **2 squares**, and `getCapabilityReport()` does
  not mention `__ENGINE` anywhere, so capability prohibitions installed on the harness do not cover
  it.

**This is not the forged-save question S38 disposed of, and the distinction is exact.** S38 keeps
*"the map cannot be made to show you anywhere by anything except a claim to have stood there"* and
calls it the stronger, checkable property. Q2 and Q3 show a map with squares on it **and no claim to
have stood anywhere at all** — the derivation is not forged, it is bypassed. That is S38 clause (b)
— *"the drawn map is a pure function of that field"* — failing through a route S38's gate does not
inspect, because the gate reasons about `Discovery` and the failure is about what `_uiCtx` will hand
to `drawMap`.

`api.js:272` records the route honestly as *"not defended… anything holding `sim` can do this"*, and
that disclosure deserves credit. **The remedy is one line**, named in round 1 as *"secondary, cheap,
and should not wait for a round"*: `Object.defineProperty(sim, 'discovery', {value: d, writable:
false, configurable: false})`.

## 5. Attack D — undiscovered is unrendered. **It holds, and the pixel test everyone uses does not measure the screen**

**S35 holds.** `screens/map.js:103` is `if (!m.seen(cx, rz)) continue;`. The screen's own ground is
painted first as a flat fill and left showing; there is nothing underneath it to dim. On a fresh map
`drawn_cells = 0` and `revealed = 0` — **no undiscovered cell is painted at any alpha**, so the
geometry is not in the scene and no coastline can be read. Greyed, fogged, dimmed and
drawn-then-masked are all structurally excluded rather than disciplined away.

**But the instrument needs correcting, and this is a finding about the round-1 verdict as well as
about my own first draft.** Round 1's C1/C3 and my own first U1/U2 both read
`UISurface.ctx.getImageData` — **the interface's own 2D canvas** — and both reported *"the terrain
box holds exactly one colour"*, channel range `[0,0,0]`. True of the UI layer; **false of the
picture**: the panel is drawn at `CALM_ALPHA` over the running 3D world, and in
`docs/shots/2026-08-08-critic-map-r2-fresh.png` the arches and buildings of the Rootlands are plainly
visible through the black box.

`tools/harness/critic-map-r2-composite.mjs` re-takes it on the composited frame (screenshot decoded
with `pngjs`) and separates the two causes, **5/5**:

| | check | result |
|---|---|---|
| **X1** | fresh map paints zero cells | `drawn_cells = 0/42846`, `revealed = 0` |
| **X2** | UI layer, chevron excluded / not excluded | **1** colour / **15** colours — the artefact round 1 warned about, reproduced |
| **X3** | the composited frame is **not** one colour | 44 distinct over 345,071 px, channel range `[11,11,11]` |
| **X4** | two *empty* maps photographed from different standing places | 44 → 92 colours, `drawn_cells 0 → 0` — **the variation is the world behind the panel** |
| **X5** | same standing place, a walked body | 44 → 1855 colours, `drawn_cells 0 → 2911` — **the map is separable from the scene** |

The S35 conclusion stands, but it is carried by the draw loop and by `drawn_cells`, **not** by a
colour count. The next critic should not read "one colour" as a claim about the picture.

## 6. Attack E — hover names

| | check | result |
|---|---|---|
| **E3** | being **told** about a place must not put a square on the map | `questEngine.learnFrom('place', …)`, `setWorldKnowledge`, `learnTopic` all ran; places `[lilmoth] → [lilmoth]` — **unchanged** |
| **D1** (§2) | not on region entry (+480 m), not when near (+40 m), only when standing | `false / false / true`, both arms |
| **E4** | one square per place, no duplicates | `squares = 2 == placeCount = 2`, ids unique |
| **E5** | the name is that place's own `pois.json` name | `"Lilmoth"` names `lilmoth`, whose `pois.name` is `"Lilmoth"` |
| **E6** | markers / routes / numerals / travel / quest identity, journal separation | `0 / 0 / none / none / none`, `reachable_from_journal: false` |

**Four of my own checks were wrong and were repaired before filing.** Two would have been false
findings about the build:

1. **E3 read `placeCount 0 → 1`** after the "tell" attempts. My baseline was taken *before* the first
   step, and **the default start position is inside Lilmoth's own pad**, so the four steps after the
   tells recorded ground the body was already standing on.
2. **E5 asserted the name must be `"Thorn"`.** The naming element names `places[placeIdx]` — the
   first place *found*, i.e. Lilmoth from the spawn — not the place last walked into.
3. **Q4 saw the place list move.** `tryPlaceMapMarker` ends by calling `d.observe(4600, 5200)` to
   demonstrate that surplus arguments are ignored, and `observe()` records **the cell the body is
   in**. On a model I had just cleared and not stepped, that legitimately added Lilmoth.
4. **A12 originally PASSED** by matching the substring `"signature"` in the save manifest — which is
   `regionSignature`/`focusSignature`. An inert check that passed for the wrong reason.

All four are documented in the tools. A critic who filed any of them would have repeated exactly the
mistake round 1 avoided.

## 7. Attack G — CONSUMPTION (RI-MTH07, mandatory under ARBITRATION §3)

**The only consumer of the discovery model is the map's own draw call.** As the brief anticipated:
that is a finding, not a pass. **S38 does not touch this.**

Enumerated at `f291b01`: every reader of `sim.discovery` in `game/src/` is `ui/system.js`,
`harness/api.js`, `save/state.js` and `engine.js`. **Nothing under `game/src/sim/` reads it** —
`sim/step.js` only *writes* it via `stepDiscovery`. No NPC, no enemy, no dialogue, no quest, no
signpost, no travel system.

* **G1** — the ablation is real: arm A records 2209 cells, arm B records 0.
* **G1b** — the arms are comparable: 0 step faults in each.
* **G2** — world hash `c23bbb77:52365` in **both** arms. **Identical.**
* **`--break consumer`** installs a real durable world-side reader and **G2 goes GREEN** — which is
  what makes G2 evidence rather than a tautology.

**`seam_sterile: true`**, on round 1's reasoning, which I agree with: a record of where you have been
is legitimately internal, and `world/province.js` signposts already carry wayfinding with the map
closed.

## 8. Self-tests: this instrument has been shown able to fail

```
--break unrendered  -> U1, U2, U3 red                 SELF-TEST OK
--break standing    -> R-D1-clean, R-D1-hostile red   SELF-TEST OK
--break consumer    -> G2 GREEN                       SELF-TEST OK
P3 (every run)      -> the step-fault detector fires  CONTROL OK
arbiter-map-s38     -> 6/6; --control=pre-s38 exit 1  VERIFIED INDEPENDENTLY
```

## 9. Scores, re-cut against S38

| axis | round 1 | now | why |
|---|---|---|---|
| S35 surface refusals (unrendered, routes, numerals, travel, naming, journal separation) | 9 | **9** | verified at the composited frame as well as the UI layer, in both arms; §2, §5, §6 |
| **S38 (a)+(b): one non-derived field, and the drawn map a pure function of it** | — | **9** | `RESTORE_READS = ['stood']`; arbiter gate 6/6 exhaustive over 42,846 generators, verified by me, control red. Docked one only for Q2/Q3, which reach the drawn map without going through the derivation at all |
| **S38 (c): nothing may name a place** | — | **5** | Q4 and S38-5 both clean on the model — but `sim.discovery` is a writable slot the quest machine holds (3 squares), and `window.__ENGINE` reaches it outside any capability prohibition (2 squares). S38's gate inspects the model, not the slot |
| **S38 (d): itemised, not swallowed** | — | **4** | the audit computes 7 fields; the published surface carries none. On the forgery that writes no claims, the two fields S38-4 reads are both zero while `missing_cells` is 42,846 |
| instrument adequacy — can this build detect its own violation? | 4 | **5** | `map-probe` 32/32 with L3 green while forging an unread field; the pixel test measures the UI surface not the screen. Up one from round 1 because `arbiter-map-s38.mjs` is a genuine new gate with a working control |
| CONSUMPTION (RI-MTH07) | 4 | **4** | zero world-side consumers, unchanged |

**Min over axes = 4.0.** Gate 7.0. **Round 3 required.**

**The forged-save axis is withdrawn, not scored.** Round 1 scored it 5 and I would have scored it
lower; S38 rules the question out of scope and I have removed it rather than arguing with a ruling.
What replaces it is the four S38 clauses, judged individually — which is a harder test than the one
it replaces, and the build passes two of them well.

## 10. The single biggest remaining gap, with a buildable remedy

> **The map computes exactly the evidence that would make a forged footprint legible, and then
> throws it away — and the new S38 gate cannot see this, because it only ever tests the forgery that
> writes claims to be contradicted.** On the forgery that writes none, `dropped` and `phantom_cells`
> are both zero, `missing_cells` is 42,846, and nothing publishes any of it.

**Remedy, in four steps, none of them large:**

1. **Publish the audit.** `restore()` computes `dropped, phantom_cells, missing_cells,
   claimed_places, derived_places, stood_cells, legacy` into `lastRestore`; `save/state.js:676`
   keeps only `.dropped`. Carry the whole record onto `sim` and surface it through `mapState()` and
   `getUIState().map`. This is round 1's remedy 1 and S38's clause (d) at the same time.
2. **Extend S38-4 to the silent forgery.** Add an arm that forges `stood` with `cells: ""` and
   `places: []` and requires a moved audit field to be readable from the published surface. As it
   stands, clause (d)'s gate passes on the one save shape a forger would actually write.
3. **Replace `map-probe` L3.** It forges `world.discovery.places`, which the loader never reads, and
   it is green. S38 already names its replacement: S38-3.
4. **Freeze the slot.** `Object.defineProperty(sim, 'discovery', {value: d, writable: false,
   configurable: false})`. One line; closes Q1, Q2 and Q3, and closes the one route by which the
   drawn map can stop being a function of the footprint.

And two documents still disagree, unchanged since round 1: `discovery.js`'s header (lines 46-50)
claims both hard fails *"fail closed against a blob whose every field is under the attacker's
control"*; `w1-21-r2-forge.mjs` R8 says they do not. **R8 is right, S38 now says so at length, and
the header is the one the next author will read.**

## 11. Reported plainly, as rule 26 requires

* **I missed S38 on my first pass.** I grepped `ARBITRATION.md` for `S35` and read that row; S38 is
  the row immediately below it and it amends S35 in place. I found it only when
  `ownership.mjs --staged` named an arbiter's screenshot. Rule 18 says read the file, and I did not
  read enough of it. Everything measured is unaffected; the scoring was re-cut afterwards.
* **Contention.** `node tools/contention.mjs --gate` returned **GO** before every browser run except
  the screenshot pass and the final A13 re-run, where it returned **exit 3**. I proceeded both times,
  as rule 21 permits and requires me to declare, because one browser was the remaining work and
  every figure is a count or a boolean. **One browser per tool run, kept for the whole run**, and my
  own rather than `tools/capture/` because every measurement steps the simulation (rule 20). **No
  timing figure appears in this verdict.**
* **Four of my own checks were wrong and were repaired before filing** (§6). Two would have been
  false findings about the build.
* **What I did not do.** I did not isolate `travel.visited`'s coverage (round 1's remedy 3; S38
  makes it optional rather than required, so it is now a nice-to-have). I did not test the forgery
  against a *cold* browser reload. I did not audit the local view's own pixels — §5's numbers are
  the world view. I did not re-run `arbiter-map-s38.mjs --self-test`, only the gate and its control.
* **No file under `game/` was edited.**
* **The map is good, and a 4.0 should not obscure it.** Read §2, §5 and §6 together: the screen S35
  asked for exists, it refuses everything S35 forbids, the refusals are structural, and S38's
  exhaustive sweep shows the derivation is sound over all 2^42,846 possible saves. The distance from
  the gate is an audit nobody publishes and a slot nobody froze.

## 12. Files

**Written by this verdict:** `corpus/90-verdicts/wave1/W1-MAP-r2.md` and `.json`,
`corpus/90-verdicts/wave1/artifacts/W1-MAP-r2/`, `orchestration/status/critic-w1-map-r2.json`,
`tools/harness/critic-map-r2.mjs`, `tools/harness/critic-map-r2-shots.mjs`,
`tools/harness/critic-map-r2-composite.mjs`,
`docs/shots/2026-08-08-critic-map-r2-{fresh,partial,explored,forged}.png`, one line in
`reports/blog-feed.jsonl`, and one line each for `w1-map` and `w1-readables` in `tools/scores.mjs`
(declared late — see the status file; `publish.mjs` fails closed on a verdict that maps to no
domain, and it was already red for `w1-readables` before this round began). **No file under `game/`
was edited.**

**Reproduce:**
```
node tools/harness/critic-map-r2.mjs             # 26/41 — the findings, incl. A13
node tools/harness/critic-map-r2.mjs --break all # three SELF-TEST OK
node tools/harness/critic-map-r2-composite.mjs   # 5/5 — the composited-frame correction
node tools/harness/critic-map-r2-shots.mjs       # four gated frames
node tools/map/arbiter-map-s38.mjs               # 6/6, and --control=pre-s38 exits 1
node tools/harness/map-probe.mjs                 # 32/32, L3 green, on the same tree
```
