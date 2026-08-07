# Next dispatches, in priority order

The orchestration tick reads this before choosing what to start. Delete a line when it is dispatched
and its status file exists. Respect the concurrency cap in `AGENT-PROTOCOL.md` — six or seven agents
doing browser work, no more; the cap exists because fourteen agents on four cores cost a builder its
headline measurement entirely.

## ~~0. A player who walks 750 m walks off the built world~~ — FIXED. A critic is checking it.

`Engine._streamProvince()` now runs from `_afterStep()`, on the one path every way of advancing the
world passes through, and focus follows the posed camera eye when an override exists (which closes
the `shoot.mjs --direct` half). A second defect was found and fixed on the way: `request()` released
a tile the instant it left the build ring, so a body oscillating on a tile *edge* rebuilt a 5-tile
row each time — 30 tile builds for 26.9 m of movement.

Walked 3 km: ring 25/25, 0 unbuilt, ground underfoot the whole way, against "gone by 750 m, 20 of 30
samples with no ground, discs 2,182 m behind". Full crossing walked end to end: 55.131 min, 6,615.1 m,
zero samples with no ground. Delete-the-fix returns 0 tiles built and ring 0/25. Consumption:
`radiusTiles` 1/2/3 → 9/25/49 built against predicted (2R+1)², coupling 1.00, with a null control.

**Residual, and it is real:** p99.9 is **66.8 ms and max 133.8 ms** — 194 steps over 16.7 ms out of
60,000 — from a ~59 ms ground-skin + cover rebuild every ~13.8 m. The builder assigns that to W1-01's
`updateSkin` calibration. A hitch of eight frames during a swing is a Souls-side failure, so the
critic has been asked whether that boundary is fair or a handoff of the actual defect.

## 0a. The level-up screen is refused everywhere — ULTRACODE

`engine.js:2011` gates levelling on `this.hearths.atHearth(...)`; **`HearthSystem` has no such
method.** Refused at all 29 sapwells, measured live at three while the hearth registry itself
reported `standing_at: hearth-<id>`; `setAtHearth(true)` opens it as the control. The player can
recover 4,200 souls and cannot spend one — and souls are the whole of levelling.

Also from that verdict (`corpus/90-verdicts/wave1/W1-13-r1.md`, **FAIL 4/10**): a save taken while
the death surface is up destroys the bloom, 4,200 → 0 on both routes, because the blob restores the
bloodstain *and* `hp = 0` and the next frame fires a fresh `die()` with `soulsHeld` already zero.
Not player-reachable until autosave or save-on-rest lands, at which point it is immediate.

Owner: W1-13, dispatched.

## 0c. Nothing reads the books back — and it is the tenth orphan of the same shape

`corpus/90-verdicts/wave1/W1-LIBRARY-r1.md`, **FAIL 3/10**. The prose is excellent — 13 read end to
end, author voice 13/13, no omniscient narrator, quest-hint ratio 0.0% — and it does not reach the
game.

- **60 of 65 books declare `topics_taught`, 116 topics, and `topics_taught` is read by nothing.**
  Opened all sixty in the engine: `topicsKnown` `[]` before, `[]` after. That field is `RI-UIX05`
  R3's exception and the item's **entire declared AR-3 crossing**.
- All three knowledge-gated **non-violent** resolutions return byte-identical refusals after the
  book is read to its last page. `knowledge_key` is read by **zero code** in `game/src`.
  `ctx.knowledge` unions only per-quest `know:` flags, whose sole writer is `reveal()`, which
  requires the id be in `deceit.revealed_by` — none of the three appears in any quest file.

The remedy is two call sites and a save field, and the critic's probes already exist and already go
red. Also charged: K1's page balancing (a last-page pass lifts p10 from 62.3 to 82.3 — the item's
own §A B8 already requires it, so no amendment is warranted), and one of the 24 contradiction pairs
is not a contradiction.

**And the separability finding, which is bigger than the books.** A one-token rule separates our
prose from Morrowind's 241 books at **92.5%**: *"eleven"* is in 49 of our 65 and 7 of their 241,
84× by rate. A prose-tic sweep across all shipped text is dispatched.

## 0b. The prohibitions are installed on the wrong object

`session-run`'s capability prohibitions install on `window.__HARNESS`, and `main.js:24` publishes
`window.__ENGINE`. The tool critic went in the back door: front door refused and recorded,
`__ENGINE.spawnNPC` **spawned**, `listNPCs` 0→1, violations still 1. `setTimeOfDay` likewise. This
is R2 §8's result through a different door, and it means every measurement that relies on a
capability profile is only as good as the door it watches. Owner: tool builder r4, dispatched.

<!-- historic, kept for the record -->
## ~~0old. A player who walks 750 m walks off the built world~~ — ULTRACODE, above everything

Confirmed independently by the capture-service critic, and it is a **game** defect, not a tooling one.

- `renderer.province.request` has exactly **four** call sites — `_applyCell`, `teleport`, `walkRoute`
  only when `opts.stream` is set, and the harness. **Nothing in `sim/step.js`, `_afterStep()` or
  `main.js`.**
- **`Province.update()` has no caller anywhere in the tree.**
- Measured: 600 fixed-step frames with the camera 3 km away leaves **25 tiles unbuilt and
  `tilesResident` 0**.
- `request()` is also the only refresh for the ground skin, cover disc, near props and night lights,
  so **the whole drawn province is anchored to the last teleport.**

The brief's central promise is a world that takes an hour to cross on foot. **It cannot currently be
walked across at all** — the streamer only ever runs when something teleports. Every regional and
art-direction measurement taken by posing a camera without teleporting was a picture of an unbuilt
world, and `shoot.mjs --direct` on province viewpoints does exactly that. Service captures are safe
(they teleport, stream and gate on residency); the direct path is not.

Owner: the world piece. Fix the pump, then re-run anything that photographed a province viewpoint
directly.

## 1. The blade is underground, and now everyone can see it — ULTRACODE

The renderer landed, so the swing is visible for the first time. It looks wrong, and the numbers
now say why:

- `cgs_drowned_reaper`'s tip sweeps **238° at a 2.87 m radius** — conformance is fine — while its
  height runs **−1.92 to −0.81 m and is above ground on 0 of 40 frames**. Inclination is −36.7° at
  rest, worsening to **−66.3°** by frame 30.
- On a halberd you watch a bare haft stab into the dirt. On a greatsword the blade lies in the
  ground several metres ahead. It reads as a character miming a swing while the weapon ploughs.

**This is a data and solver defect, not a render one**, and the renderer builder was right to refuse
to correct it in the renderer: the drawn tip is the hit socket to 0.0008 mm, and fudging the visual
would break what-you-see-is-what-hits-you, which is the one invariant that makes the swing worth
drawing. The arithmetic: `_bladeLength` solves that weapon to **3.098 m of blade** so the tip radius
equals declared `reach_m`, on a 1.75 m character whose rest pose hangs the point down — a 3.1 m
blade from a hand at ~1.0 m is underground by construction.

Owner: whoever holds `_bladeLength` / `reach_m` (W1-10). The fix is upstream of both — either the
declared reach, the blade-length solve, or the rest pose. A previous round attempted a pitch
calibration and reverted it because it cost 40% arc nonconformance; that route is known bad.

## 1a. Re-read every visual verdict taken through a posed camera

`renderer.js:424` read the player's visibility as the negation of a camera override, so **a capture
taken through a placed camera hid the player**. Confirmed by the renderer builder's own pre-fix
probe (`reports/render/render-probe-prefix.json`: `player_visible: false`, `actors_drawn: 0`).
Fixed now.

**CORRECTION — I previously wrote here that the W1-10 round-3 critic's byte-identical weapon
screenshots "contained no character at all". That is false and a blog writer caught it by opening
the artefacts.** `corpus/90-verdicts/wave1/artifacts/W1-10-r3/frames/cgs_drowned_reaper-f000.png`
plainly shows the character with the 0.95 m box at the hip, and that critic's capture script
`kritik3-motion-focused.mjs` contains **no camera override** — those shots came through the ordinary
follow camera. **The weapons finding stands entirely on its own evidence.**

What actually needs retaking is narrower: **any measurement whose capture placed a camera to
photograph a character.** Check each candidate's capture script for a `camera(...)` override before
re-running it — do not re-run the lot on my say-so, and do not assume a verdict is void because it
is visual.

## ~~1old. The character and weapon renderer~~ — DONE. Kept for the record.

Found by the W1-10 round-3 critic. **The movesets are not rendered at all.**

- `game/src/render/` contains no reference to a weapon or a bone, and no `SkinnedMesh`.
- `makeActor()` welds **one 0.95 m box for all 87 weapons**.
- `renderer.js:398–399` writes only position and yaw.
- Frame-0 screenshots of a **1.95 m sword, a 2.85 m halberd and a 2.75 m curved greatsword are
  byte-identical** (md5 `9bdb823f…`), and a full 60-frame attack changes **0.19%** of the character
  box.

This outranks every other open gap, for three reasons:

1. **The brief.** The owner asked for weapons with "a subtly unique attack pattern and unique set of
   animations". 1,133 authored clips exist. None of them reaches a screen.
2. **It is why the other defects survived.** A halberd sweeping 1.3 m underground is invisible to a
   critic who cannot see the swing. Blade inclination, arc conformance and reach were all being
   argued from numbers because there was no picture to argue from.
3. **It blocks the whole visual half of the corpus.** Every art-direction and fidelity item, the
   third-person presentation item, and every blind visual comparison are unmeasurable while the
   player character is a box.

Scope: a skinned character with a weapon socket that reads the rig the combat system already
evaluates — `CombatBody.evaluateRig()` already double-buffers weapon sockets in world space, so the
data is there and nothing consumes it. **S18** (third person always) and `RI-CAM07` govern
presentation. Judge art direction against `corpus/70-visual/refs/morrowind/` and fidelity against
`corpus/70-visual/refs/modern/`, never fidelity against 2002.

Acceptance: screenshots of three weapon classes at the same frame are **not** byte-identical; a
60-frame attack moves substantially more than 0.2% of the character box; the rendered weapon's tip
tracks the socket the hit resolution uses, so what you see is what hits you.

## 2. Tool rebuild — now at round 4, and dispatched

Superseded by `corpus/80-methods/TOOL-COVERAGE-R3.md` (**NOT SATISFIED**, six rebuilds:
`build-viability`, `experience/beat-extract`, `journey-run`, `session-run`, `cadence`, `decoupling`).
Round 3's own headline finding — two tools reading `r.frame` while every shipped trace numbers frames
`f` — is the round's indictment too: it fixed the two it found and did not ask how many siblings
there were. There were two more, both in tools R1 *and* R2 accepted, and one of them promotes a
hedged confidence-0.7 verdict to 1.0 with corroborating evidence the trace does not contain.

The R1 list below is kept because parts of it are still open.

- **`build-viability.mjs`** — first. It buys a false pass on the exact axis it was written to
  unblock, while its self-test reports 8/8. Two permissive substitutions: it prints "no region
  declares a tier" when `regions.json` declares `danger_tier` 1–5 on all thirteen and the engine
  consumes it; and **0 of 41 quest givers resolve to a reaction group**, so the permanent
  race-and-upbringing bar cannot fire at all. Two character dimensions stay `corpus_debt` until this
  is right.
- **`gamepad-shim.mjs`** — does not run, 3/3 crash. This is the GameSir path the owner tests on.
- **`journey-run.mjs`** — `--sample-quests` and `--stratified` are inert while the leg reports `ok`.
- **`cadence.mjs`** — its exclusion list is not the shipped action set.
- **`competence.mjs`** — the gear clause cannot fail.

## 1b. Race does not affect whether a quest is offered to you

Found by the tool builder in round 2, while establishing that a reference item's own worked example
**cannot be produced on shipped data by any correct tool**:

- `engine.js:1147` resolves an NPC's reaction group **from the NPC record field alone** — there is
  no faction-to-group table anywhere in `game/src`.
- `seedDispositions()` seeds `rec.disposition` **raw** into the table the offer gate reads.
- **31 quest givers have a record with no `reaction_group`. Nine have no record at all**
  (`dyer-sallis`, `undertaker-vaskh`, `prefect-hallow`, `quartermaster-sedd`, `harbourmistress-tesh`,
  `cutter-neeth`, `factor-belliene`, `npc-porter-eeja`, `speaker-teel-ashaan`), so the gate reads
  disposition **0 for every character signature alike**.

**So the quest-offer path is race-invariant in the running build.** That contradicts the premise the
whole setting rests on — an Argonian at home versus a Dunmer abroad — and it is the same shape as
the two defects already found and fixed nearby: the reaction matrix that was a pure oracle, and the
Argonian who was offered nothing because a differentiation check passed by subtraction.

**AMENDED after the round-2 tool critic tested the proposed fix and it did not work.** The builder
claimed either data fix unblocks this immediately. The critic applied it — minted the missing NPC
record on a shadow tree — and then **booted the engine on that same patched tree: it blocked nobody,
and the disposition clause was gone for all five signatures.** The data work is necessary and
**not sufficient**.

**The real cause is one layer deeper: `derivedDisposition()` never touches the quest path at all.**
`seedDispositions()` writes `rec.disposition` **raw** into the table the offer gate reads, so no
race or upbringing term is ever applied to a quest offer, regardless of how complete the NPC records
are. Confirmed in the running world rather than from source — six character signatures driven
through `questOffers()` returned byte-identical disposition clauses.

So dispatch **both halves or neither**: wire the derived disposition into the offer path, *and* fill
the missing records. Doing the data alone produces a build that still ignores race while every
instrument reports success — which is the exact failure this project keeps finding, bought at the
price of a dispatch.

Owner: whoever holds `character.race.access`/`character.race.dialogue` — the decomposition audit
found both paths were dropped from W1-07's declared set while the item judging them was scored into
it three times.

## 2b. The Act V conversation nobody wrote

`Q-MAIN-26` declares a twelve-topic Act V conversation and
`game/data/dialogue/topics/main-quest-argument.json` **does not exist** — the topic bodies were
never written. The main quest completes without it, but the climactic conversation of the game is
currently a declaration with no words in it. This is W1-17's (dialogue) territory and is the single
largest remaining gap in the main quest.

Orchestrator ruling already made, for whoever picks this up: the four quests that carried
`category:"main"` were magic-utility quests mislabelled by a generator shorthand, with stakes
contradicting the act band they claimed. They are recategorised to `side` and the generator is
fenced. Do not "restore" them.

## 3. Critics owed a piece that has reported

Dispatch a fresh-context critic for any piece whose builder has finished and whose verdict is stale.
Currently owed: **W1-26** (the opening as a played scene), and **W1-01** (world, round 4) once the
region capture can actually run — it needs a quiet box, since a frame costs 25 s idle and 150–260 s
under load.

## 4. Wave-1 pieces never dispatched

Over half of reference items own no path any dispatched verdict declares. `docs/PLAN.md` §3 has the
list. Wide before deep: start the unstarted ones as capacity allows, preferring anything on the
path to a playable game end to end.
