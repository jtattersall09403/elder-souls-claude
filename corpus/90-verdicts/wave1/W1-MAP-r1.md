# W1-MAP — round 1 verdict

**Piece:** W1-MAP, the discovery map.
**Binding:** `corpus/00-doctrine/ARBITRATION.md` seam **S35** (supersedes S30), and
`corpus/00-doctrine/AMENDMENT-W1-MAP-01.md`.
**Critic:** `critic-w1-map`, fresh context.
**Commit:** `b900460`. Every number below is a claim about that tree (rule 12).
**Score:** **4.0** (min over axes). **Wave-1 gate is 7.0 — this does not pass.**
**AR-2:** not triggered on the honest path. **`seam_sterile: true`** — see §6.

> **Provenance warning, and it matters for anything read against this verdict.** `game/src/sim/discovery.js`
> was rewritten at **23:32:58 on 2026-08-07**, after `orchestration/status/W1-MAP.json` recorded the piece
> "complete", by the concurrently in-flight piece **`W1-21-r2`** (`orchestration/status/W1-21-r2.json`,
> still `in_progress`). The save's footprint field changed from a **raw bitset** — which is what the
> W1-MAP status file and the file header's cost paragraph still describe — to a **zigzag-varint delta
> trail of cell indices**. A critic who forges the format the status file describes gets an empty map and
> would wrongly credit the build with a defence it does not have. This one nearly happened here; see §2.

---

## 1. What is genuinely good, and is verified rather than accepted

The screen is the best-argued surface I have audited in this project, and most of S35's refusals hold
structurally rather than by discipline. Verified independently of the builder's own probe, at the
framebuffer and through the real input pipeline, by `tools/harness/critic-w1-map-r1.mjs`:

| | check | result |
|---|---|---|
| **C1** | Empty map: distinct colours inside the terrain box, **chevron excluded** | **1**, and `drawn_cells = 0` |
| **C2** | Partial map: undiscovered ground still the screen's own colour, still the majority | dominant unchanged, > 50% |
| **C3** | No shade gradient in the unrendered ground | 1 colour — nothing masked |
| **D1** | Square appears only after standing in the pad | region(+480 m) `false`, near(+40 m) `false`, standing `true` |
| **D2** | Hover name is the place name from `pois.json` | `"Thorn"` == `pois.name` |
| **D3** | Naming element carries no quest identity | `quest:null objective:null travel:false` |
| **D4** | One square per discovered place | `1 == 1` |

**Undiscovered is genuinely unrendered, not fogged.** This was checked the way the brief asked — at the
renderer, not at a shader's opacity parameter. `docs/shots/2026-08-08-critic-map-fresh.png` is a black
box reading *"I have not written anything down yet."*, and the pixel test says the box holds exactly one
colour once the player chevron is excluded from the sample. **A naive sample counts 15 colours on that
same blank map**, purely from the chevron's antialiased edge — an attack that did not exclude it would
have invented a finding. `docs/shots/2026-08-08-critic-map-explored.png` shows the map S35 describes:
discs of ground where the body walked, black everywhere else, gold squares for places stood in, one
hovered name, no line of any kind.

The structural argument is real: `observe()` is arity 0, `suspend`/`resume` arity 0, the instance is
frozen, the private fields are `#private`, and `Discovery.RESTORE_READS` is `['stood']`. I re-ran the
builder's instrument and its self-tests and both claims are honest: **`map-probe.mjs` is 32/32**, and
**`--break discovery` / `radius` / `world` each print SELF-TEST OK**, reddening C0,C1,C4,L1 / C1 / C3
respectively. The builder also found and recorded three real defects of its own (a dead captured
`sim.player`, a frozen UI build-cache key, a shared capture-daemon leak), and the sibling tool's **R8**
discloses the limit in §2 rather than hiding it. That is good-faith work and it is why this verdict is a
round 2 rather than a rejection.

## 2. Attack A — the forged save. **The builder closed the report, not the hole.**

The brief asked for this explicitly, and the answer is unambiguous.

**Precondition first.** A critic whose attack "fails" must prove the attack was delivered before
crediting a defence. My first forgery — a raw all-ones bitset, the format W1-MAP's own status file
describes — produced **0 cells and 0 places**, and read exactly like a successful defence. It was not.
It was a malformed varint stream. Check **`Afmt`** now forges a single cell in the real wire format and
requires the model to move before any A-result is believed. It does: `stood_cells=1`, that cell revealed.

With the attack actually delivered, forging **only `world.discovery.stood`** and leaving every other
field empty:

| check | result |
|---|---|
| **A1** | `place_count = 42 of 42` pois. The honest walk gave 1. |
| **A2** | `revealed = 42846/42846` — **100% of the province** |
| **A2b** | `dropped_on_load = [nothing]` — **not refused, not reported** |
| **A3** | **42 `map_place` squares drawn on screen**, `drawn_cells = 42846/42846` |
| **A4** | `places_drawn = 42`, `places_discovered = 42` — **equal, so the report goes green** |
| **A6** | Targeted forgery of `lilmoth` + `blackrose` alone: both appear, nothing dropped |

`docs/shots/2026-08-08-critic-map-forged.png` is that map: the entire province in full region colour,
42 gold squares, for a character who has walked nowhere.

**This is the round-1 W1-21 outcome reproduced.** That verdict got 35 squares for places never visited
and a green compliance report *"because both of those numbers came from the same forged model"* —
`discovery.js`'s own header, lines 20-27. **A4 is that sentence, still true, at commit `b900460`.**
Only the route changed: forge `stood` instead of `places`.

**The instrument cannot notice, and this is the core failure.**

* `Discovery.restore()` **does** compute the detection signal — `lastRestore` carries
  `phantom_cells`, `missing_cells`, `stood_cells`, `legacy`. **Nothing publishes it.**
  `save/state.js` keeps only `.dropped`; `mapState()` exposes only `dropped_on_load`; neither
  `mapState()` nor `getUIState().map` carries a single footprint field (**A5**).
* **`map-probe.mjs` L3 forges `world.discovery.places` — the field `RESTORE_READS` was narrowed to
  EXCLUDE.** It is a check aimed at a field the loader provably never reads, so it cannot fail for the
  case that matters, and it passes while the live map holds 42 phantom squares (**A7**).
* None of the three `--break` self-tests touches the forgery path at all. **L3 has never been shown
  capable of going red.**

**Is a forged save in scope?** The sibling piece argues no: `w1-21-r2-forge.mjs` **R8** asserts
`placeCount === SITES.length` and calls it *"LIMIT, recorded: a forged FOOTPRINT still reveals — it is a
claim to have walked, not a named marker… not refused, and not claimed to be."* That is an honest
disclosure and I credit it. But two things stand against it. First, S35's clause is a property of the
map, not of the honest path: *"any square for a place the player has not personally stood in"* and
*"undiscovered is not merely unlabelled, it is unrendered"* — the screenshot violates both. Second,
**`discovery.js`'s own header contradicts R8**, claiming the fix makes both hard fails *"fail closed
against a blob whose every field is under the attacker's control, because the map is a pure function of
ONE field"*. The attacker controls that one field. Two files in the same tree state opposite security
properties, and the header is the one the next author will read.

## 3. Attack B — "no API by which a quest could touch the map"

**Grepped, then executed.** Confirming the absence: `grep -rn "map|discovery|__ENGINE|reveal"` over
`game/src/sim/quest/` returns only quest-internal `reveal()` (a `know:` knowledge flag, nothing to do
with the map), one S35 comment in `topic-supply.js`, and `prohibitions.js`'s marker-phrase regex. **No
quest module reaches a map module, directly or through the engine.** `screens/map.js` does not import
`roads.json` and does not reach `sim.quest`; `_mapModel` carries no quest state; `openMenu('map', {…})`
throws on any argument. That half is genuinely held.

**But there is a reachable route, and it is not hypothetical.** `game/src/harness/api.js:272` records
`"questEngine writes sim.discovery = forged"` as an attempt it *declines to execute*, annotated
*"not defended… anything holding `sim` can do this."* I executed it:

* **B1** — `Object.getOwnPropertyDescriptor(sim, 'discovery')` is `writable: true, configurable: true`,
  and `eng.questEngine.sim === sim` is **true**. `QuestEngine` is constructed with the sim at
  `engine.js:526` and stores it at `machine.js:79`.
* **B2** — assigning a substitute model renders: **3 squares drawn** from an object the game never built.

Call path: `QuestEngine.this.sim.discovery = <object with the reader surface>` → `Engine._uiCtx()`
(`engine.js:3448-3449`) passes it straight to `UISystem._mapModel` → `drawMap`. Per the brief's own
standard — *"a single reachable setter is a fail regardless of whether any quest currently calls it"* —
this fails. It is one line to close: `Object.defineProperty(sim, 'discovery', {value: d, writable: false,
configurable: false})` after construction. The narrow claim the builder makes ("no *call* exists, so a
quest *file* cannot express it") is true and worth keeping; it is not the claim S35 makes.

## 4. Attacks C and D — both hold

Covered in §1. Both were checked against the failure mode named in the brief: C at the renderer with the
chevron excluded, D by walking a body 480 m away (region entry), then 40 m outside the pad (near), then
into it. Region entry and proximity both correctly yield nothing.

## 5. Attack E — the instruments, and whether they can fail for the reason they claim

Re-run at `b900460`: **`map-probe.mjs` 32/32**; **`--break all` → three SELF-TEST OK** (C0,C1,C4,L1 /
C1 / C3). Both builder claims are accurate.

Then the harder question — break the thing under test rather than the thing the self-test breaks. I
built `tools/harness/critic-w1-map-r1.mjs` (25 checks) with three falsifications, and every one of them
had to be repaired before it bit, which is the point of doing them:

* `--break unrendered` (draw every cell regardless of discovery) → **C1, C2, C3 red. OK.**
* `--break standing` (discover by proximity) → **D1 red. OK.** *My first version of this break asserted
  `seenAt(site)`, and the reveal radius at Thorn is 40 m, so a body 480 m away revealed nothing there and
  the break never fired — the self-test was passing for the wrong reason.*
* `--break consumer` (install a real world-side reader) → **F2 GREEN. OK.** *This is the opposite
  polarity on purpose: F2 currently fails, and an assertion whose pass condition is "nothing happened"
  is worth nothing until it has been shown to notice something happening. My first version perturbed
  stamina, which regenerates to full before the hash is taken, so the control did nothing.*

**The finding: `map-probe`'s L3 has no such falsification and cannot acquire one as written**, because
it forges a field the loader does not read (§2, A7).

## 6. Attack F — CONSUMPTION (RI-MTH07, mandatory under ARBITRATION §3)

**The only consumer of the discovery model is the map's own draw call.** As the brief anticipated: that
is a finding, not a pass.

Named and enumerated: every reader of `sim.discovery` in `game/src/` is `ui/system.js`
(`_mapPlaces`/`_mapModel`/`getUIState`, lines 877-1116), `harness/api.js`, `save/state.js`, and
`engine.js`'s construction and `_uiCtx`. **Nothing under `game/src/sim/` reads it. No NPC, no enemy, no
dialogue, no quest, no signpost, no travel system.**

Demonstrated by ablation, with the discovery blob **excluded from the hash** — without that exclusion
the arms differ trivially because the save carries the raster, and the ablation would prove nothing:

* **F1** — the ablation is real: arm A records 2209 cells, arm B records 0.
* **F1b** — the arms are comparable: 0 foreign step faults in each.
* **F2** — world hash `5094c15a:442141` in **both** arms. **Identical.** Destroying the map model
  entirely changes nothing in the running world.

The builder's `map-probe` C-block is labelled CONSUMPTION but perturbs **data** and watches **pixels**
(`regions.json` → terrain colour, `map.json` → reveal radius). That is a real and well-built
data→model→pixel chain and it is why this scores 4 rather than 0. It is not what RI-MTH07 asks for:
*perturb the model, observe an **entity** change behaviour.* No entity does.

**`seam_sterile: true`.** The map creates no interaction crossing the Souls/Morrowind seam. Justified:
a record of where you have been is legitimately internal, and S35 requires wayfinding to keep working
with the map closed (the signposts in `world/province.js` already do). Recorded for `RI-CMP01`'s floor.

## 7. Scores

| axis | score | why |
|---|---|---|
| S35 surface refusals (unrendered, routes, numerals, travel, naming, journal separation) | **9** | verified at the framebuffer and through the real input pipeline; §1, §4 |
| S35 "no square for a place not personally stood in", adversarially | **5** | reproducible in full (42/42, 100% of province); materially narrower than round 1 — no naming channel survives — and disclosed in R8 |
| instrument adequacy — can this build detect its own violation? | **4** | probe is 32/32 with three genuine self-tests, but L3 forges an unread field, no self-test touches the forgery path, and the computed audit signal is never published |
| API closure ("no API by which a quest could touch the map") | **6** | no call exists, arity 0, frozen, quest tree clean — but a writable slot the quest machine holds, and it renders |
| CONSUMPTION (RI-MTH07) | **4** | zero world-side consumers; pixel-level ablation of the screen is real but is not an entity |

**Min over axes = 4.0.** Gate 7.0. **Round 2 required.**

## 8. The single biggest remaining gap, with a buildable remedy

> **Nothing in this build is capable of telling an honest map from a completely forged one, because
> every compliance number the build reports is derived from the model being audited.** `places_drawn ==
> places_discovered` reads green on a map showing 42 squares for a body that has walked nowhere — the
> verbatim failure mode the round-1 verdict recorded, surviving the rewrite that was meant to remove it.

**Remedy, in three steps, none of which is large:**

1. **Publish the signal that already exists.** `Discovery.restore()` computes `stood_cells`,
   `phantom_cells`, `missing_cells` and `legacy` into `lastRestore` and `save/state.js:674` throws all
   but `.dropped` away. Carry the whole audit onto `sim`, surface it through `mapState()` and
   `getUIState().map`. This alone makes the naive forgery visible.
2. **Point the forgery check at the field that is read.** Replace `map-probe` L3's forgery of
   `world.discovery.places` with a forgery of `world.discovery.stood` **in the wire format**
   (`tools/harness/critic-w1-map-r1.mjs` `forgeTrail()` is 9 lines and can be lifted), and give it a
   `--break forge` self-test so it is proven able to go red.
3. **Corroborate the footprint against something written by a different system.** `engine.js:5468`
   already maintains `this.travel.visited` — *"leg id -> Set of 25 m bins of the leg actually stood
   in"* — an independent record of where the body went. Checking `stood` against it is not a fixed
   point on one field, which is precisely what the round-2 fix failed to achieve by reducing two
   fields to one.

Then reconcile the two documents that currently disagree: `discovery.js`'s header claims the map "fails
closed against a blob whose every field is under the attacker's control", and `w1-21-r2-forge.mjs` R8
says it does not. R8 is right; the header must say so.

**Secondary, cheap, and should not wait for a round:** freeze the slot —
`Object.defineProperty(sim, 'discovery', {writable: false, configurable: false})` (§3).

## 9. Reported plainly, as rule 26 requires

* **Contention.** `pgrep -c headless_shell` was **18-36** and `loadavg` **16-32** on 4 cores for the
  whole run, far above rule 21's threshold of ~8. I used the pooled capture daemon where it fits, and
  launched **one** browser per tool for the work that steps the simulation, which rule 20 permits and
  requires me to declare. **No timing figure appears in this verdict** — every number is a count, a
  boolean or a pixel colour, none of which contention distorts.
* **A foreign defect, and it is not the map's.** `combat/enemy.js:303 _idleBehaviour` throws
  `this.ai.step is not a function` inside the fixed step on some routes — enemy AI is being rewritten by
  another piece as this runs. `tools/harness/critic-w1-map-stepcheck.mjs` reproduces it **with
  `sim.discovery` removed entirely**, which is how I know. It first appeared in my run as C2/D1/D2/D3
  failures that looked exactly like map defects; they were a walk whose steps never ran. Checks **C0**
  and **D0** now assert per-block that the world actually stepped, and each block reloads a clean state.
  **I nearly filed four false findings and the preconditions are what stopped it.**
* **I did not isolate** whether `travel.visited` is complete enough to serve as the corroborator in
  remedy 3; I read its declaration, not its coverage. Named as a direction, not as a proven fix.
* **W1-21-r2 is still `in_progress`** and owns `discovery.js`. This verdict grades the tree at
  `b900460`; that piece may land further changes to the same file.

## 10. Files

**Written by this verdict:** `corpus/90-verdicts/wave1/W1-MAP-r1.md` and `.json`,
`orchestration/status/critic-w1-map.json`, `tools/harness/critic-w1-map-r1.mjs`,
`tools/harness/critic-w1-map-shots.mjs`, `tools/harness/critic-w1-map-stepcheck.mjs`,
`tools/harness/critic-w1-map-forgediag.mjs`, `tools/harness/critic-w1-map-b64diag.mjs`,
`docs/shots/2026-08-08-critic-map-{fresh,partial,explored,forged}.png`, one line in
`reports/blog-feed.jsonl`. **No file under `game/` was edited.**

**Reproduce:**
```
node tools/harness/critic-w1-map-r1.mjs            # 14/25 — the 11 findings
node tools/harness/critic-w1-map-r1.mjs --break all # three SELF-TEST OK
node tools/harness/critic-w1-map-shots.mjs          # four gated frames
node tools/harness/map-probe.mjs                    # 32/32, confirmed
node tools/harness/map-probe.mjs --break all        # three SELF-TEST OK, confirmed
```
