# Next dispatches, in priority order

The orchestration tick reads this before choosing what to start. Delete a line when it is dispatched
and its status file exists. Respect the concurrency cap in `AGENT-PROTOCOL.md` — six or seven agents
doing browser work, no more; the cap exists because fourteen agents on four cores cost a builder its
headline measurement entirely.

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

`renderer.js` read the player's visibility as the negation of a camera override, so **every
posed-camera capture in this project hid the player**. The W1-10 round-3 critic's byte-identical
weapon screenshots contained no character at all — the finding was right, the evidence was of
something else. Fixed now.

Anything scored on a posed capture — art direction, third-person presentation, blind visual pairs,
regional distinctness — was measuring a world with no character in it. Re-run rather than assume the
verdict survives.

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

## 2. Tool rebuild round 2 — the five the tool critic rejected

`corpus/80-methods/TOOL-COVERAGE-R1.md` is **NOT SATISFIED**. Rebuild, then a **separate** tool
critic re-checks — the builder never checks its own tools.

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

The builder proved either fix unblocks it immediately, against a patched data root. Owner: whoever
holds `character.race.access`/`character.race.dialogue` — note the decomposition audit found those
two paths were dropped from W1-07's declared set while the item judging them was scored into it
three times.

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
