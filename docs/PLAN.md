# Build plan — waves, pieces, and how each is judged

> **AMENDED 2026-08-11 by `docs/DECOMPOSITION-W1-AMENDMENT-02.md`.** Whole-game visual quality is
> now a Wave-1 feasibility gate. **W1-30 — Whole-game visual foundation and fidelity** owns the 21
> `render.*` paths previously deferred to Wave 4, improves the existing game across both visual
> axes, and establishes the shared production/validation foundation future visual content must use.
> Its plan loop starts immediately; its builder follows W1-06 and W1-24 and precedes W1-28 and every
> Wave-2 builder. Wave 2 is blocked until a fresh build critic establishes the applicable modern-
> fidelity and art-direction results at the Wave-1 **7.0** floor.

> **AMENDED 2026-08-07 by `docs/DECOMPOSITION-W1-AMENDMENT-01.md`, closing
> `BAR-CRITIQUE-W1-07-R1` §R7 and Condition 5** — *"37 of 38 `journey.*`/`input.*`/`experience.*`
> paths are owned by nobody."* The figure is verified. It resolved into **four** wave-1 paths in
> no piece at all (`journey.opening.exchange`, `journey.opening.legibility`,
> `combat.exchange.reactability`, `combat.exchange.divergence` — all four registered by reference
> items filed *after* this plan was written) and **thirty-four** in pieces that exist here and
> have never been dispatched. `W1-26` is dissolved and rebuilt; `W1-28` and `W1-29` are new;
> `platform.mobile.viewport` is promoted to wave 1; seven existing pieces are amended.
> **Unowned wave-1 paths: 0.** The amendment document carries the derivation and the evidence.
>
> **The larger finding is in §5c and it is not fixed by this file.** Twenty-three of thirty
> wave-1 pieces have never been dispatched, and they include every piece that owns a path
> deciding whether the game can be played at all — while two pieces have each been round-tripped
> four times. **The plan said wide before deep; the dispatch order did deep before wide.**

> **REWRITTEN wave-1-prep (2026-08-06) to close `BAR-CRITIQUE-02` **N3 / C3**.**
> The previous decomposition was fourteen pieces written against a 200-path taxonomy. The
> corpus is now **325 paths and 138 reference items**, and the old list contained no builder
> at all for the camera, character creation, weapon movesets, magic, stealth, crime, UI or
> audio. The critic's judgement was that *"wave 1 as planned fails the new items by
> construction"* — `RI-EXP01` can return `DEAD` and needs character creation, sneaking and an
> unfenced hub; `RI-QST05`'s pacifist metric is `unmeasurable ⇒ 0` without the stealth and
> crime systems. The method below is unchanged. §3 and §4 are re-derived from the taxonomy.

## Method

1. **Wave 0 — Build the bar.** No game code. Ten agents construct the reference corpus:
   the dimensions on which Morrowind and Dark Souls can be meaningfully compared, and for
   each dimension a reference artifact a later agent can hold its work against and lose to.
2. **Waves 1..N — Build wide, then deep.** Each wave is decomposed into the smallest
   pieces that can be built and judged independently. Each piece gets a **builder**
   subagent (handed its judging reference items up front) and a **separate critic**
   subagent with fresh context that inspects the actual output — runs the game headless,
   screenshots it, traces the combat, reads the quest text as written — compares against
   its reference items using each item's own stated method, blind where possible, picks a
   winner, and names the single biggest remaining gap.
3. **End of every wave — one coherence agent** plays the whole game and fixes coherence,
   not quality: tone drift between regions, factions that ignore each other, lore
   contradicting itself, difficulty discontinuities, systems that stopped composing.
4. Loop until every critic's bar is met. Gaps go on the ledger; a gap may not be closed
   by the agent that built the fix.

## The bar is 10/10

**User direction, wave 1: the terminal condition is 10 on every item.** `SCORING.md` §0 carries
the full ruling. In short: 10 means *matches or beats the reference*, the gate rises by wave
(**W1 ≥7.0 · W2 ≥8.5 · W3 ≥9.5 · ship = 10 everywhere**), and **no piece ships below 10**. A wave
may pass below 10; the project may not finish below 10.

Every sub-10 score is now a **tracked debt**, not an accepted state: a verdict must carry
`why_not_ten`, `path_to_ten` and `ten_by_wave` per item, or the verdict is VOID. A debt that
slips two waves escalates the piece under `orchestration/EFFORT-POLICY.md`.

The wave-1 gate rose from 6.0 to 7.0 with this ruling. `W1-00`'s two existing verdicts (3.0 and
4.1) were scored against the old gate and are unaffected as records, but the piece now has further
to climb.

## Builder effort escalation

Builder agents run at **Standard** effort by default. Six pre-declared hard pieces start at
**Elevated**, and six triggers escalate a piece to **Ultracode** — chief among them *two
consecutive critic rounds with no score improvement*, which is the signal that more feedback will
not help. Escalation is per-round, not permanent, and it widens the builder's licence as well as
its budget: an escalated builder is handed every prior verdict, may refactor across the piece
boundary, and may argue that the bar itself is wrong.

If escalation does not close the gap either, the next step is **not** a third dispatch — it is the
bar critic or a re-decomposition, because the fault is then in the bar or the piece boundary.

Full policy, triggers and recording requirements: `orchestration/EFFORT-POLICY.md`.

## The wide-before-deep constraint

The world is traversable end to end and the main quest completable from **Wave 1**
onward. No later wave is allowed to leave a region or a questline unbuilt — later waves
only *deepen* what already exists. At every wave boundary the game is playable start to
finish.

This is the constraint that produces §4's shape and it is worth stating what it costs:
**276 of 330 subsystem paths are first built in wave 1** — 84% of the taxonomy. That is not
scope creep, it is the arithmetic of the constraint. A wave-1 that builds a third of the
taxonomy is a wave-1 that leaves regions and questlines missing, which this rule forbids.

What wave 1 does **not** promise is *depth*. `SCORING.md` §1 is explicit that "most Wave 1–2
pieces should score 4–5", and every item now carries a native→ladder anchor row (`SCORING.md`
§1.2a) precisely so that "a 5 in wave 1, an 8 in wave 4" is a legible trajectory rather than
an argument. A path being wave-1 means a builder owns it and a critic scores it; it does not
mean it is at the bar.

## 1. Wave structure

| Wave | Goal | Invariant at wave end |
|---|---|---|
| 0 | Reference corpus + measurement harness | Every subsystem has a bar; no corpus holes; `--check` blocking in CI |
| **1** | **Skeleton of everything, including a whole-game visual foundation.** Full map traversable; all 8 settlements standing and populated; character creation, camera, combat core, weapons, magic, stealth and crime real; main quest completable end to end; every faction line present at one quest deep; UI and AR-2 enforceable; the experience instrument and its sabotage control running; existing visuals substantially improved and future visual content routed through shared high-quality production/validation paths | You can create a character, walk Argonia, sneak, steal, be arrested, cast, fight, die, and finish the game; every wave-1 bar can be scored; applicable modern-fidelity and art-direction results independently reach **7.0** before Wave 2 |
| 2 | Combat depth, bosses and the enemy roster to the Souls bar; full faction questlines with escalation, expulsion and rivalry; weapon class differentiation across all 15; spellmaking and enchanting; build-identity composition | Every faction line completable; combat passes the frame-data critics; `RI-CMP03` build identity scoreable |
| 3 | Density and strangeness: 250 interiors, dungeons, ~80 side quests, 112 books, ambient life, rumour networks, music and voice, alchemy | Density metrics hit; the world is strange, not generic |
| 4 | Close the remaining visual debts and deepen the Wave-1 foundation to the ship bar | Blind visual comparisons close at 10; every visual debt is discharged |
| 5+ | Whatever the gap ledger still holds | Ledger empty |

## 2. What makes a wave-1 piece list *sufficient* rather than merely sensible

The old list was sensible. It was not sufficient, and the difference is checkable. A piece
list is sufficient when **every reference item that will be pointed at wave 1 can produce a
number rather than an `unmeasurable ⇒ 0`.** Four specific failures in the old list, each of
which would have surfaced as a hard fail on a bar whose prerequisite was never assigned:

| The item | What it needs | Old plan | Now |
|---|---|---|---|
| `RI-EXP01` (returns **DEAD**, and a `DEAD` verdict makes the whole wave `DEAD` under `PLAYTHROUGH-CRITIC` §2) | a created character, ≥7 exercised verbs **including sneak**, a hub with ≥3 unfenced exits, a first death in 18–32 min | no character-creation piece, no stealth piece | **W1-07**, **W1-15**, **W1-26** |
| `RI-QST05` PACIFIST-ALL | `RI-STL01`, `RI-STL02` and `RI-CRM01` built, or the metric is `unmeasurable ⇒ 0` (W6) | no stealth or crime piece | **W1-15** |
| `RI-CMP01` seam crossings | most of the systems that cross, present in the same build, each crossing demonstrated firing in a trace | fourteen pieces could not produce the W1 floor | **W1-25** plus the breadth of §3 |
| `RI-WLD10` / S25 water depth | the third-person camera and the player's own silhouette — water depth is read off anatomical landmarks, so the camera is not a presentation choice deferrable to wave 4 | no camera piece | **W1-06** + **W1-03** |
| `RI-UIX02` (AR-2 enforcement, the most-cited arbitration rule in the corpus) | `getUIState()`, `setUIVisible`, ≥14 viewpoints, ≥5 named quest states — absent, S8 compliance is **unmeasurable, which is 0** | no UI piece | **W1-21** + **W1-00** |

The current test applied to the list below: for each of the 145 items, does at least one wave-1 piece
own a path it judges? **134 of 145 do.** The 11 that do not are listed in §5 with the wave
they first become scoreable, so "not built yet" is a declared state rather than a surprise.

## 3. Wave-1 piece decomposition

**31 pieces** (W1-AMENDMENT-01 established 30; `W1-30` is added by W1-AMENDMENT-02). Each is one
builder plus one separate critic. **Together they cover all 276 wave-1 paths exactly once**, minus
the two process paths in §3b — no path is in two pieces, and **no wave-1 path is in none.** The
"Judged by" list is the `<<REFERENCE_ITEMS>>` block for both prompts and is assembled from each
reference item's **`judges:` front-matter, never from a directory listing** — `CORPUS-CONTRACT`
§4 was amended for exactly that reason after `W1-09` was scored against a set built from
`ls corpus/10-combat/`, seven of whose twelve items judged none of its declared paths.

> **Every claim in that paragraph is now checkable and was not before.** Four wave-1 paths were in
> no piece when this pass ran, and nothing in the toolchain said so — `corpus-index.mjs` reports
> corpus holes (paths no *item* judges) and has never reported ownership holes (paths no *piece*
> declares). W1-AMENDMENT-01 §6 specifies **C9**, the sweep that closes it, on the same
> `warn` in wave 1 / `error` from wave 2 escalation as C8.

### W1-00 — Harness, determinism and persistence

Nothing downstream is admissible without it. Every critic's method begins `window.__HARNESS`; RI-MTH04 deletes a verdict that cannot show a real run.

**Subsystem paths (8):** `platform.determinism.harness`, `platform.input.pipeline`, `platform.perf.simtime`, `platform.save.persistence`, `platform.save.storage`, `platform.perf.framerate`, `platform.load.ttfp`, `journey.save.roundtrip`

**Judged by (10):** RI-AUD02, RI-CAM02, RI-CAM06, RI-CMB07, RI-JRN03, RI-JRN05, RI-MTH01, RI-MTH02, RI-PLT01, RI-PLT03

> **AMENDED W1-AMENDMENT-01 §5.** `journey.save.roundtrip` added. `RI-JRN05` judges it together
> with `platform.save.persistence` and `platform.save.storage` — **both already this piece's** —
> and `RI-JRN05` has been in this piece's item set since the plan was written. W1-00 has shipped a
> save system across two rounds without declaring the round trip, so the owner's *"does saving and
> loading work correctly"* has never been a declared path. `CORPUS-CONTRACT` §4 rule 2.
> **This requires a W1-00 round 3.**
>
> **Declared seam:** `RI-JRN03` also judges `platform.input.pipeline`, which stays here; the other
> six paths it judges are W1-08's. Coupling debt recorded at the W1-00 ↔ W1-08 seam.

### W1-01 — World shape and the traversal budget

The province must be crossable end to end in wave 1. Owns the traversal minute every density figure in the corpus is denominated in.

**Subsystem paths (6):** `world.terrain.form`, `world.map.scale`, `world.traversal.time`, `world.traversal.locomotion`, `world.verticality.layout`, `world.region.gating`

**Judged by (10):** RI-AI05, RI-CAM02, RI-PRG06, RI-PRG07, RI-TRV01, RI-WLD01, RI-WLD04, RI-WLD07, RI-WLD10, RI-WLD11

### W1-02 — Regions, borders and the strange

Thirteen regions distinguishable without the map, with staggered borders and at least one ONLY-HERE element each. Density of strangeness is wave 3; its *existence* is wave 1.

**Subsystem paths (6):** `world.region.identity`, `world.region.transition`, `world.weather.systems`, `world.time.daynight`, `world.strangeness.budget`, `world.strangeness.architecture`

**Judged by (10):** RI-AUD03, RI-PRG04, RI-TRV01, RI-WLD04, RI-WLD05, RI-WLD08, RI-WLD09, RI-WLD11, RI-WLD12, RI-WLD14

### W1-03 — Water, marsh and the amphibious body

S25 reads water depth off the player's own silhouette, which makes this piece and the camera piece mutually load-bearing. A marsh province cannot defer water.

**Subsystem paths (3):** `world.water.marsh`, `render.fidelity.water`, `world.hazard.environment`

**Judged by (4):** RI-VIS02, RI-VIS04, RI-WLD10, RI-WLD11

### W1-04 — Settlements, interiors and the people in them

All eight named settlements standing, enterable, populated and owned — 269 NPCs and 250 interiors is the wave-3 floor, but every settlement exists in wave 1.

**Subsystem paths (9):** `world.settlement.anatomy`, `world.interior.named`, `world.interior.continuity`, `world.npc.population`, `world.npc.schedule`, `world.property.ownership`, `world.locks.security`, `world.faction.presence`, `world.persistence.state`

**Judged by (20):** RI-AI07, RI-CAM05, RI-CHR02, RI-CRM01, RI-DLG02, RI-DLG03, RI-LOR01, RI-LOR02, RI-LOR04, RI-LOR06, RI-PRG03, RI-QST03, RI-QST07, RI-QST08, RI-STL02, RI-TRV01, RI-WLD03, RI-WLD07, RI-WLD08, RI-WLD13

### W1-05 — Roads, signposts and getting there without a marker

AR-2's positive half: if there is no marker, wayfinding has to work. RI-JRN07 is unscoreable without it.

**Subsystem paths (6):** `world.traversal.roads`, `world.traversal.transport`, `world.traversal.stations`, `world.traversal.schedule`, `world.wayfinding.directions`, `world.map.legibility`

**Judged by (10):** RI-DLG05, RI-LOR02, RI-LOR05, RI-PRG05, RI-TRV01, RI-TRV02, RI-WLD01, RI-WLD02, RI-WLD06, RI-WLD09

### W1-06 — The camera

Absent from the old plan entirely. S18 is the user's most explicit instruction, and S25 makes the third-person body load-bearing for the water model.

**Subsystem paths (5):** `combat.camera.behaviour`, `combat.lockon.target`, `combat.lockon.switch`, `render.fidelity.character`, `ui.dialogue.presentation`

**Judged by (10):** RI-AI06, RI-CAM01, RI-CAM02, RI-CAM03, RI-CAM05, RI-CAM06, RI-CAM07, RI-CMB06, RI-MTH01, RI-VIS08

### W1-07 — Character creation, race and birthsign

RI-EXP01 B01–B04 require a created character inside the first minutes; RI-CHR02 is where the Argonian-in-Black-Marsh premise pays mechanically.

**Subsystem paths (10):** `character.creation.flow`, `character.creation.identity`, `character.creation.irreversibility`, `character.class.custom`, `character.race.profile`, `character.race.access`, `character.race.dialogue`, `character.race.reaction`, `character.birthsign.powers`, `character.birthsign.drawback`

**Judged by (3):** RI-CHR01, RI-CHR02, RI-CHR03

### W1-08 — Desktop controls and the action set

RI-EXP01 requires ≥7 exercised verbs. This piece owns the canonical fourteen-name action set and the desktop input path; W1-29 owns gamepad and touch and consumes the action set without redefining it.

**Subsystem paths (6):** `input.action.set`, `input.desktop.keyboard`, `input.desktop.pointerlock`, `input.rebinding.model`, `input.modality.parity`, `input.discoverability`

**Judged by (4):** RI-DLG09, RI-JRN02, RI-JRN03, RI-JRN04

> **AMENDED W1-AMENDMENT-01 §4 — narrowed from 10 paths; the four gamepad/touch paths move to
> W1-29.** `RI-JRN03` and `RI-JRN04` publish a *binding* division of labour — desktop path and
> action set here, gamepad profile data and touch there — and a single builder owning both does
> the mobile half last and worst. That prediction is already on disk: `platform.mobile.viewport`
> was filed at wave 2 by the same taxonomy pass that filed every desktop input path at wave 1.
> The owner named one desktop and one mobile device; two pieces.
>
> **Declared seams:** `RI-JRN03` also judges `platform.input.pipeline` (W1-00's). `RI-JRN02` also
> judges `journey.firsthour.interaction`/`competence` (W1-28's). `RI-JRN04` also judges the four
> paths now in W1-29; `input.modality.parity` stays here because `RI-JRN03` owns the parity
> *model*. Each is a cross-piece coupling debt under `CORPUS-CONTRACT` §4 rule 1 — recorded at
> the seam, **not dropped**.

### W1-09 — The combat core

Frame-exact at 60 Hz post-S22. The single largest wave-1 piece and the one with the most reference items pointed at it.

**Subsystem paths (30):** `combat.dodge.iframes`, `combat.dodge.equipload`, `combat.dodge.directional`, `combat.dodge.recovery`, `combat.attack.commitment`, `combat.attack.moveset`, `combat.attack.tracking`, `combat.attack.charge`, `combat.frames.timing`, `combat.frames.cancel`, `combat.hitbox.hurtbox`, `combat.hitbox.sweep`, `combat.hitbox.resolution`, `combat.stamina.costs`, `combat.stamina.regen`, `combat.stamina.block`, `combat.stamina.exhaustion`, `combat.poise.player`, `combat.poise.enemy`, `combat.block.guard`, `combat.block.parry`, `combat.damage.model`, `combat.damage.scaling`, `combat.heal.charges`, `combat.input.buffer`, `combat.input.latency`, `combat.player.movement`, `combat.pause.policy`, `combat.exchange.reactability`, `combat.exchange.divergence`

**Judged by (31):** RI-AI02, RI-AI03, RI-AI04, RI-AI05, RI-CAM02, RI-CAM04, RI-CMB01, RI-CMB02, RI-CMB03, RI-CMB04, RI-CMB05, RI-CMB06, RI-CMB07, RI-CMB08, RI-CMB09, RI-CMB11, RI-CMB12, RI-LOR05, RI-PRG02, RI-PRG03, RI-PRG04, RI-PRG07, RI-PRG08, RI-UIX01, RI-UIX03, RI-VIS08, RI-WLD10, RI-WPN01, RI-WPN02, RI-WPN04, RI-WPN06

> **AMENDED W1-AMENDMENT-01 §5.** `combat.exchange.reactability` and `combat.exchange.divergence`
> added; **`RI-CMB12` added to the item set.** `RI-CMB12` judges those two paths and nothing else.
> It was written against *this piece's* three-round failure — a 120 s exemplar fight in which the
> player was never hit, a boss answered by standing still, and a hole in every enemy weapon arc —
> and it has never been scored, because when it registered its two paths nothing assigned them an
> owner. **Five of this piece's own declared paths have never appeared on a verdict**
> (`combat.attack.charge` — later claimed by W1-10 — `combat.damage.model`,
> `combat.damage.scaling`, `combat.heal.charges`, `combat.pause.policy`): see §5b.

### W1-10 — Weapon movesets and the answer matrix

RI-WPN01 M5 hard-fails any RI-AI05 archetype whose answer arrives after its first appearance. Enemies ship in wave 1, so the answers must too.

**Subsystem paths (13):** `weapon.moveset.schema`, `weapon.moveset.slots`, `weapon.moveset.answers`, `weapon.class.taxonomy`, `weapon.class.reach`, `weapon.charge.heavy`, `weapon.stance.twohand`, `weapon.shield.taxonomy`, `weapon.offhand.config`, `weapon.context.running`, `weapon.context.rolling`, `weapon.context.backstep`, `combat.weapon.identity`

**Judged by (5):** RI-WPN01, RI-WPN02, RI-WPN03, RI-WPN04, RI-WPN06

### W1-11 — Impact: hitstop, mass, material, audio

The gap BAR-CRITIQUE-01 ranked 5. Combat that measures like Souls and does not feel like it fails RI-WPN05 and RI-AUD01, not RI-CMB02.

**Subsystem paths (6):** `combat.feedback.hitstop`, `weapon.feel.hitstop`, `weapon.feel.mass`, `weapon.feel.material`, `weapon.feel.whiff`, `audio.combat.impact`

**Judged by (4):** RI-AUD01, RI-AUD02, RI-CAM06, RI-WPN05

### W1-12 — Enemy AI and encounter composition

RI-AI01–07. The telegraph/punish loop is the thing a Souls player recognises in the first thirty seconds.

**Subsystem paths (9):** `combat.enemy.statemachine`, `combat.enemy.movement`, `combat.enemy.perception`, `combat.enemy.telegraph`, `combat.enemy.punish`, `combat.enemy.leash`, `combat.encounter.grouping`, `combat.encounter.placement`, `combat.encounter.exit`

**Judged by (14):** RI-AI01, RI-AI02, RI-AI03, RI-AI04, RI-AI05, RI-AI06, RI-AI07, RI-CMB07, RI-CMB08, RI-DLG09, RI-PRG06, RI-STL01, RI-WLD02, RI-WLD07

### W1-13 — Lethality, death and the corpse run

The main quest is completable from wave 1, so its last fight and its death loop exist from wave 1.

**Subsystem paths (7):** `combat.difficulty.lethality`, `combat.death.corpserun`, `combat.death.worldreset`, `combat.boss.arena`, `progression.bonfire.function`, `progression.bonfire.placement`, `journey.death.recovery`

**Judged by (13):** RI-AI05, RI-AI06, RI-AI07, RI-AUD04, RI-CAM05, RI-CAM06, RI-CMB08, RI-JRN06, RI-LOR05, RI-PRG04, RI-TRV02, RI-WLD04, RI-WLD07

> **AMENDED W1-AMENDMENT-01 §5.** `journey.death.recovery` added. `RI-JRN06` judges it together
> with `combat.death.corpserun` and `combat.death.worldreset` — **both already this piece's** —
> and `RI-JRN06` has been in this piece's item set since the plan was written. `RI-PRG04` owns the
> *rules*; `RI-JRN06` asks the question `RI-PRG04` cannot — *does the loop actually work, end to
> end, without losing anything.* The owner's "die, lose, run back, get it back" is a wave-1
> playability path and is now declared by the piece that ships it.

### W1-14 — Magic: casting, effects and utility

S19 splits the seam: casting is a Souls action, effects are a Morrowind catalogue. Both halves are wave 1 because magic is a verb RI-EXP01 counts and a route RI-QST05 counts.

**Subsystem paths (16):** `combat.magic.casting`, `magic.casting.frames`, `magic.casting.commitment`, `magic.casting.resource`, `magic.casting.geometry`, `magic.casting.enemy`, `magic.effects.catalogue`, `magic.effects.parameters`, `magic.effects.utility`, `magic.effects.traversal`, `magic.effects.teleport`, `magic.gating.skills`, `magic.quests.solutions`, `magic.diegesis.lore`, `magic.vfx.fidelity`, `magic.vfx.artdirection`

**Judged by (6):** RI-MAG01, RI-MAG02, RI-MAG03, RI-MAG04, RI-MAG05, RI-TRV02

### W1-15 — Stealth, theft, crime and justice

W6 made RI-QST05's PACIFIST-ALL `unmeasurable ⇒ 0` without these. There is no wave-1 quest verdict without this piece.

**Subsystem paths (16):** `stealth.detection.model`, `stealth.sneak.state`, `stealth.npc.search`, `stealth.opener.seam`, `stealth.trespass.zones`, `stealth.theft.ownership`, `stealth.theft.pickpocket`, `stealth.lock.picking`, `stealth.fence.economy`, `crime.witness.model`, `crime.guard.response`, `crime.bounty.schedule`, `crime.arrest.interaction`, `crime.jail.consequence`, `crime.persistence.death`, `crime.faction.standing`

**Judged by (5):** RI-CHR02, RI-CRM01, RI-CRM02, RI-STL01, RI-STL02

### W1-16 — Progression: souls, levels, skills, encumbrance, gold

RI-CMB01's i-frame tiers are read off equip load, so encumbrance is a combat prerequisite, not an inventory feature.

**Subsystem paths (10):** `progression.souls.economy`, `progression.level.curve`, `progression.level.attributes`, `progression.skill.usegrowth`, `progression.skill.gating`, `progression.equipment.encumbrance`, `progression.gold.economy`, `progression.inventory.model`, `progression.merchant.barter`, `progression.build.identity`

**Judged by (19):** RI-AI05, RI-CHR01, RI-CHR02, RI-CHR03, RI-DLG04, RI-LOR05, RI-PRG01, RI-PRG02, RI-PRG03, RI-PRG05, RI-PRG06, RI-PRG07, RI-QST03, RI-QST08, RI-STL01, RI-STL02, RI-TRV01, RI-TRV02, RI-UIX03

### W1-17 — Dialogue: the topic graph and the people using it

Absent from the old plan only as `dialogue.topics`. The wordcount target is wave 3; the graph, disposition and rumour network are wave 1 because quests are discovered through them.

**Subsystem paths (12):** `dialogue.topics.graph`, `dialogue.topics.discovery`, `dialogue.topics.filtering`, `dialogue.topics.truth`, `dialogue.disposition.model`, `dialogue.persuasion.mechanics`, `dialogue.greeting.variation`, `dialogue.rumour.distribution`, `dialogue.npc.identity`, `dialogue.combat.lockout`, `dialogue.service.merchant`, `dialogue.lore.vector`

**Judged by (19):** RI-CHR02, RI-DLG01, RI-DLG02, RI-DLG03, RI-DLG04, RI-DLG06, RI-DLG07, RI-DLG08, RI-DLG09, RI-LOR01, RI-LOR02, RI-LOR03, RI-LOR05, RI-LOR06, RI-PRG03, RI-QST02, RI-QST05, RI-QST07, RI-WLD03

### W1-18 — The quest engine and the journal

Quests are data (RI-QST04) or they are not judgeable. The journal is the only navigation instrument AR-2 permits.

**Subsystem paths (18):** `quests.data.schema`, `quests.structure.stages`, `quests.structure.branching`, `quests.structure.deceit`, `quests.state.persistence`, `quests.failure.severed`, `quests.reward.shape`, `quests.giver.characterisation`, `quests.discovery.hooks`, `quests.lore.hooks`, `quests.resolution.noncombat`, `quests.resolution.exclusive`, `journal.entry.voice`, `journal.entry.numbering`, `journal.entry.directions`, `journal.navigation.nomarkers`, `journey.quest.unmarked`, `journey.reentry.orientation`

> **AMENDED W1-AMENDMENT-01 §5, and this piece is IN FLIGHT** (`orchestration/status/W1-18.json`,
> state `building`). `journey.quest.unmarked` and `journey.reentry.orientation` added.
> `RI-JRN07` judges the first together with `quests.discovery.hooks` and
> `journal.navigation.nomarkers`; `RI-JRN08` judges the second together with `journal.entry.voice`
> and `journal.navigation.nomarkers` — **all four of those already this piece's**, and both items
> already in its "Judged by" list. **Its builder must be handed the two added paths and both items
> before its verdict**, or the verdict repeats `W1-09`'s error of being scored against items whose
> paths it never declared.

**Judged by (24):** RI-DLG01, RI-DLG03, RI-DLG05, RI-DLG07, RI-DLG08, RI-DLG09, RI-JRN07, RI-JRN08, RI-LOR03, RI-LOR06, RI-MAG04, RI-QST02, RI-QST04, RI-QST05, RI-QST07, RI-QST08, RI-QST09, RI-STL01, RI-TRV02, RI-UIX02, RI-UIX04, RI-WLD03, RI-WLD06, RI-WLD09

### W1-19 — The main quest, end to end

The structural constraint in one piece: completable from wave 1 onward, antagonist's case intact, both endings reachable.

**Subsystem paths (6):** `quests.mainline.acts`, `quests.mainline.antagonist`, `quests.mainline.prophecy`, `experience.ending.landing`, `experience.ending.aftermath`, `experience.ending.pointofnoreturn`

**Judged by (6):** RI-EXP05, RI-LOR01, RI-LOR02, RI-LOR05, RI-QST06, RI-WLD09

### W1-20 — Faction skeleton — every line present, one quest deep

Wide before deep, stated exactly: no questline may be missing in wave 1. Escalation, expulsion and rivalry are wave 2.

**Subsystem paths (2):** `quests.faction.joining`, `quests.faction.rankgating`

**Judged by (5):** RI-CRM02, RI-LOR01, RI-LOR02, RI-QST01, RI-QST03

### W1-21 — UI, the HUD, and AR-2 enforcement

RI-UIX02 is the enforcement point for the most-cited arbitration rule in the corpus, and it is `unmeasurable ⇒ 0` if `getUIState()` does not exist.

**Subsystem paths (6):** `ui.hud.combat`, `ui.hud.minimalism`, `ui.menu.inventory`, `ui.menu.journal`, `ui.menu.levelup`, `ui.style.diegesis`

**Judged by (11):** RI-CAM03, RI-CAM05, RI-PRG01, RI-PRG02, RI-UIX01, RI-UIX02, RI-UIX03, RI-UIX04, RI-UIX06, RI-VIS05, RI-WLD06

### W1-22 — The audio bed

Four `audio.*` paths, no builder in the old plan. RI-AUD01 requires a parry ring identifiable with the screen off; RI-WLD12 M70 requires the bed to change at a border.

**Subsystem paths (1):** `audio.ambience.region`

**Judged by (3):** RI-AUD03, RI-WLD04, RI-WLD08

### W1-23 — Lore: the registry and the province's canon

RI-LOR07 conformance is run against everything the other pieces write, so the registry must precede them, not follow them.

**Subsystem paths (9):** `lore.canon.registry`, `lore.canon.argonian`, `lore.canon.geography`, `lore.canon.history`, `lore.canon.factions`, `lore.canon.prophecy`, `lore.naming.conventions`, `lore.religion.hist`, `lore.religion.metaphysics`

**Judged by (9):** RI-CHR03, RI-LOR01, RI-LOR02, RI-LOR03, RI-LOR04, RI-LOR05, RI-LOR06, RI-LOR07, RI-QST06

### W1-24 — The visual protocol and the player's body

This is the bifurcation and repeatable-measurement foundation that must exist before W1-30 quotes a
visual number. Player/character presentation remains coupled to W1-06's
`render.fidelity.character`; W1-24 owns the two process paths below.

**Subsystem paths (2):** `render.process.bifurcation`, `render.process.measurement`

**Judged by (6):** RI-CAM07, RI-UIX06, RI-VIS01, RI-VIS03, RI-VIS06, RI-VIS09

### W1-25 — The experience instrument and the seam crossings

The sabotage control, the anecdote trace, the permissiveness register and the crossing matrix are BUILD work, not critic work. PLAYTHROUGH-CRITIC §10 names 'the control is never run' as the most likely failure in the corpus.

**Subsystem paths (7):** `experience.memory.anecdote`, `experience.memory.recall`, `experience.permissiveness.register`, `experience.permissiveness.durability`, `experience.session.shape`, `composition.seam.crossings`, `composition.matrix.coverage`

**Judged by (4):** RI-CMP01, RI-EXP02, RI-EXP03, RI-EXP06

> **AMENDED W1-AMENDMENT-01 §4 — narrowed.** `experience.opening.hook` and
> `experience.opening.beats` move to **W1-26**, and `RI-EXP01` goes with them: it judges those two
> paths and **no others**. `RI-EXP01` is the corpus's only pre-existing instrument that asks
> whether the opening is any good, and it **has never been run on any build** — partly because its
> two paths lived in the instrument piece rather than in the piece that builds the opening. This
> piece keeps the sabotage control, the anecdote trace, the permissiveness register and the
> crossing matrix, which are what it was for.

### W1-26 — The opening, as a played scene

**Redefined by W1-AMENDMENT-01 §3.** The owner's first named question — *"is the new game flow good enough vs Morrowind's famously brilliant opening scenes"* — has never had a builder. This piece owns the opening as a thing that reaches a player: the surfaces, the chargen diegesis, the exchange, and the first-hour beat sheet's opening block.

**Subsystem paths (7):** `journey.firstlaunch.flow`, `journey.chargen.diegesis`, `journey.onboarding.explanation`, `journey.opening.exchange`, `journey.opening.legibility`, `experience.opening.hook`, `experience.opening.beats`

**Judged by (3):** RI-JRN01, RI-JRN09, RI-EXP01

**Cited, never scored here:** RI-PLT03 (`T_control`, `TTFP` — `platform.load.ttfp` is W1-00's), RI-CHR01 (the *content* of the eight creation inputs — `character.*` is W1-07's).

**Depends on:** W1-00 (harness), W1-07 (creation content), W1-08 (the action set), W1-04 (the interior the scene happens in).

> **Why the old W1-26 was dissolved.** It declared eleven `journey.*` paths — six separate
> journeys judged by six different reference items, plus two *process* paths that are a critic's
> deliverable and not a builder's — in one piece with one builder. It is exactly the shape
> `CORPUS-CONTRACT` §4 was amended against, and two consequences had already landed: `W1-07`
> absorbed `journey.chargen.diegesis` because this piece did not exist, and was thereby charged
> **45 of `RI-JRN01`'s 100 points** for blocks measuring paths it does not own
> (`BAR-CRITIQUE-W1-07-R1` §R7); and `W1-00`, `W1-13` and `W1-18` were each being scored against a
> journey item whose journey path sat here instead — §4 rule 2, three times, silently. The save
> round trip goes to **W1-00**, death and recovery to **W1-13**, the unmarked quest and the return
> after a week to **W1-18**, the first hour to **W1-28**, and the two process paths to §3b. Every
> move is justified by a `judges:` set and by nothing else.
>
> **Measurement risk, stated rather than scoped around.** `RI-JRN01` carries 33/100 as
> `corpus_debt` until `tools/journey/journey-run.mjs` and `beat-extract.mjs` exist, and **all five
> of `RI-EXP01`'s tools are phantom**. `RI-JRN09` is runnable **today** by design and is the one
> instrument here that does not wait on `W1-TOOLS`. **Dispatch this piece now**; two of its three
> items are partly `corpus_debt` until the tools land and the third is not.

### W1-27 — Density, loot and the coherence pass

The wave-end coherence agent's own surface, plus the hand-placement rule that forbids a procedural loot table anywhere in the game.

**Subsystem paths (10):** `world.density.handplacement`, `world.loot.placement`, `coherence.naming.consistency`, `coherence.lore.consistency`, `coherence.tone.crossregion`, `coherence.faction.crossref`, `coherence.difficulty.continuity`, `coherence.progression.pacing`, `coherence.economy.balance`, `coherence.systems.composition`

**Judged by (13):** RI-AI07, RI-CMP01, RI-DLG08, RI-LOR05, RI-LOR06, RI-MTH05, RI-PRG04, RI-PRG08, RI-QST08, RI-WLD01, RI-WLD02, RI-WLD05, RI-WLD09

### W1-28 — The first hour as interaction

**New in W1-AMENDMENT-01 §4.** `RI-JRN02` — the verb grammar, the order verbs are acquired in, the interval between meaningful inputs, and the point at which the player is *competent* rather than merely *informed* — judges these two paths and has never been scored.

**Subsystem paths (2):** `journey.firsthour.interaction`, `journey.firsthour.competence`

**Judged by (1):** RI-JRN02

**Depends on:** W1-08 (bindings), W1-09 / W1-12 (something to become competent at), W1-18 (a quest to be doing), W1-26 (the opening it begins from).

> **Declared seam:** `RI-JRN02` also judges `input.discoverability`, which is **W1-08's**. Under
> `CORPUS-CONTRACT` §4 rule 1 that leg is a cross-piece coupling debt recorded at the
> W1-28 ↔ W1-08 seam, scored against W1-08 and cited here. It is not dropped.
>
> **Thin by path count, heavy by item weight**, and said plainly rather than merged into W1-26 to
> make the list look tidier: `RI-JRN01` and `RI-JRN02` publish a *binding* division of labour —
> the first ~15 minutes as a chain of screens versus minutes 0–60 as a chain of inputs — and
> merging them would put one builder on both sides of it. `RI-EXP01` B01–B18 cannot be hit by a
> build whose first hour has no owner.

### W1-29 — Mobile, touch and the attached gamepad

**New in W1-AMENDMENT-01 §4**, split from W1-08. The owner: *"I want them to work both on desktop **and** on mobile with a controller attached — I have this one GameSir X2s Type-C Mobile Gaming [controller]."* RI-JRN04 is the item that judges that sentence and it has never been scored.

**Subsystem paths (5):** `input.gamepad.mapping`, `input.gamepad.analog`, `input.gamepad.lifecycle`, `input.touch.fallback`, `platform.mobile.viewport`

**Judged by (1):** RI-JRN04

**Depends on:** W1-08 (the canonical action set, which this piece consumes and may not redefine).

> **`platform.mobile.viewport` is promoted from wave 2 to wave 1** (W1-AMENDMENT-01 §2b). A path
> that decides whether the game renders and accepts input on the owner's named device cannot be
> wave 2 while the constraint is *"the world traversable and the main quest completable from an
> early wave."* This changes one `wave` field in `subsystems.json` from 2 to 1 — not a rename, not
> a renumber, and it matches §4's own definition of the field. Flagged for CRT.
>
> **Declared seam:** `RI-JRN04` also judges `input.modality.parity`, kept in W1-08 because
> `RI-JRN03` owns the parity *model* and the canonical action set. Coupling debt at the
> W1-29 ↔ W1-08 seam.
>
> **Why wave 1 and not later.** `RI-JRN01` **HF5 is firing right now** because round 2 of `W1-07`
> completed two of four input modalities — mouse+keyboard and touch were never run. A journey that
> cannot be completed on a gamepad alone is a hard fail in `RI-JRN04` as well. Neither is fixable
> by a piece that does not exist.

### W1-30 — Whole-game visual foundation and fidelity

**New in W1-AMENDMENT-02.** Visual quality is a Wave-1 feasibility question. This piece substantially
improves the existing game's whole applicable visual surface and establishes shared render,
material, asset and validation paths that future visual content must consume. Fidelity and art
direction remain separately declared and judged under ARBITRATION §4.

**Subsystem paths (21):** `render.fidelity.lighting`, `render.fidelity.shadows`,
`render.fidelity.materials`, `render.fidelity.atmosphere`, `render.fidelity.vegetation`,
`render.fidelity.animation`, `render.fidelity.postprocess`, `render.fidelity.streaming`,
`render.fidelity.ao`, `render.fidelity.ibl`, `render.fidelity.sky`, `render.fidelity.vfx`,
`render.art.palette`, `render.art.silhouette`, `render.art.architecture`, `render.art.creature`,
`render.art.composition`, `render.art.weirdness`, `render.art.mood`, `render.art.flora`,
`render.art.materials`.

**Judged by (13):** RI-CAM07, RI-MAG05, RI-VIS01, RI-VIS02, RI-VIS03, RI-VIS04, RI-VIS05,
RI-VIS06, RI-VIS07, RI-VIS08, RI-VIS09, RI-WLD03, RI-WLD05.

**Depends on:** W1-06 (stable camera/character-presentation seam) and W1-24 (visual bifurcation and
measurement protocols). **Build order:** after both have landed; before W1-28 and every Wave-2
builder. The plan loop starts immediately and runs independently of those production dependencies.

**Declared seams:** `render.fidelity.character` remains W1-06's;
`render.fidelity.water` remains W1-03's; `render.process.bifurcation` and
`render.process.measurement` remain W1-24's. W1-30 consumes and integrates those paths without
reassigning them.

**Wave-1 exit:** a fresh independent build critic establishes the applicable modern-fidelity and
art-direction results at **≥7.0**, with no governing hard fail, and verifies a fail-closed route for
future visual content through the shared foundation. Sub-10 results remain tracked debts for the
Wave-4 consolidation pass.

## 3b. Paths that are a critic deliverable, not a builder's

Four paths are owned by the **process**, not by any piece in §3. They are not unowned and they are
not corpus holes: `INDEX.md` §3b names the doctrine document that carries the bar, the method and
the evidence requirement for each, which `CORPUS-CONTRACT` §4 permits.

| Path | Wave | Judged by | Discharged by |
|---|---|---|---|
| `journey.process.fleet` | 1 | `JOURNEY-CRITIC-FLEET.md` §1–§3, §5, §6 | **dispatching the journey-critic fleet** — one critic per journey, fresh context, evidence, aggregation |
| `journey.process.naive` | 1 | `JOURNEY-CRITIC-FLEET.md` §4 (I1–I8, F6–F8) | **running the enforced first-time-user protocol**: isolation, pre-registration, verbatim capture, non-reuse |
| `process.critic.discipline` | 0 | `RI-MTH03`, `RI-MTH04`, `RI-MTH06` | live since wave 0; judges every wave including this one |
| `process.verdict.format` | 0 | `RI-MTH03`, `RI-MTH04`, `RI-MTH06` | idem |

The first two were assigned to the old `W1-26` and that was a category error: a builder cannot
write the protocol that a critic is bound by. **Neither has ever been discharged.** The owner
asked for *"a fan of harsh critics"* and `INTENT-AUDIT-02` recorded that plural as satisfied by
these two paths existing — the fleet itself has not been run on any build, which is the same
failure shape as `RI-EXP01`: the instrument was specified, registered, and never used.

## 4. Every path has a wave

`corpus/00-doctrine/subsystems.json` now carries a **`wave`** field on every one of its **330**
paths, and `node tools/corpus-index.mjs --check` fails with an error if any path lacks one
(check **C7** of `RI-MTH05`). `wave` is **the wave a builder first owns the path**. Later
waves deepen it; they never introduce it — that is the wide-before-deep constraint expressed
as data rather than as prose nobody can check.

**Re-measured 2026-08-07 (W1-AMENDMENT-01).** The table below was stale: the taxonomy has grown
from 325 paths to 330 since it was written — `RI-JRN09` registered two, `RI-CMB12` two, and one
more elsewhere — and **nothing recomputed it, because nothing checks it.** Every figure here is
now a direct read of `subsystems.json`.

| Root | Paths | W1 | W2 | W3 | W4 |
|---|---:|---:|---:|---:|---:|
| `combat.*` | 52 | 49 | 3 | 0 | 0 |
| `world.*` | 36 | 31 | 1 | 4 | 0 |
| `render.*` | 25 | **25** | 0 | 0 | **0** |
| `quests.*` | 22 | 17 | 3 | 2 | 0 |
| `weapon.*` | 21 | 16 | 5 | 0 | 0 |
| `magic.*` | 20 | 15 | 5 | 0 | 0 |
| `progression.*` | 18 | 12 | 5 | 1 | 0 |
| `experience.*` | 15 | 10 | 4 | 1 | 0 |
| `dialogue.*` | 14 | 12 | 1 | 1 | 0 |
| `platform.*` | 13 | **8** | **5** | 0 | 0 |
| `journey.*` | 13 | 13 | 0 | 0 | 0 |
| `lore.*` | 11 | 9 | 0 | 2 | 0 |
| `input.*` | 10 | 10 | 0 | 0 | 0 |
| `character.*` | 10 | 10 | 0 | 0 | 0 |
| `stealth.*` | 9 | 9 | 0 | 0 | 0 |
| `crime.*` | 9 | 7 | 2 | 0 | 0 |
| `coherence.*` | 8 | 8 | 0 | 0 | 0 |
| `ui.*` | 8 | 7 | 0 | 1 | 0 |
| `composition.*` | 6 | 2 | 4 | 0 | 0 |
| `journal.*` | 4 | 4 | 0 | 0 | 0 |
| `audio.*` | 4 | 2 | 0 | 2 | 0 |
| `process.*` | 2 | 0 (wave 0) | 0 | 0 | 0 |
| **Total** | **330** | **276** | **38** | **14** | **0** |

W1-AMENDMENT-01 promoted `platform.mobile.viewport` and closed four ownership holes, taking Wave 1
to 255 paths. **W1-AMENDMENT-02 promotes all 21 formerly Wave-4 `render.*` paths and assigns them to
W1-30, taking Wave 1 to 276.** The taxonomy total is unchanged and all 25 `render.*` paths now begin
in Wave 1. Wave 4 deepens them and closes their tracked visual debt.

`RI-VIS03`'s known-invalid bands and any missing legal reference evidence remain authority/ruling
work. The W1-30 planner must reconcile them through the existing mechanism and allocate valid
builder/critic work explicitly; the promotion authorises no substitute metric or silent exclusion.

## 5. Bars that are deliberately not scoreable in wave 1

**Recomputed for W1-AMENDMENT-02.** The earlier list was wrong in both directions: it
claimed thirteen, the true figure before this amendment was **fourteen**, it named `RI-LOR06` and
`RI-MTH05` — **both of which do own wave-1 paths** — and it omitted `RI-MTH06`, `RI-CMB12` and
`RI-JRN09`. W1-AMENDMENT-01 left twelve items without a Wave-1 path; W1-AMENDMENT-02 promotes
`RI-VIS07`'s visual paths, leaving **eleven**. That is not a clerical point. `RI-CMB12` and `RI-JRN09` were each written by a bar
critic against a *wave-1* failure, each registered two wave-1 paths, and each was silently
unscoreable because nothing assigned those paths to a piece. **Eleven** items own no wave-1 path
after this amendment; each is deferred for a stated reason, and a wave-1 critic handed one of them
records `not_built_yet` rather than 0.

| Item | First scoreable | Why not wave 1 |
|---|---|---|
| `RI-CMB10` status buildup | W2 | bleed/poison/frost is combat *depth*; the buildup race is meaningless against a wave-1 roster |
| `RI-PRG09` affliction economy | W2 | 17 afflictions with vectors, cures and in-world texts is content, not a system skeleton |
| `RI-PLT02` memory and asset budgets | W2 | the asset set does not exist to budget until wave 2 fills it |
| `RI-AUD05` voice policy | W3 | voice arrives with the wave-3 dialogue mass |
| `RI-CMP02` emergence fuzzing | W2 | fuzzing a two-system build finds nothing; it needs the wave-2 surface |
| `RI-CMP03` build-identity payoff | W2 | requires 15 differentiated weapon classes and spellmaking |
| `RI-EXP04` novelty curve | W2 | the no-empty-90-minute-window rule needs ≥10 h of content to have a window in |
| `RI-UIX05` books and readable text | W3 | 112 books is the wave-3 lore mass |
| `RI-MTH03`, `RI-MTH04`, `RI-MTH06` | wave 0 | process items on `process.*` — already live, and they judge every wave including this one |

**Three items leave this list by being given owners rather than by waiting:** `RI-CMB12` (the
exchange) → **W1-09**, and `RI-JRN09` (the opening as an exchange) → **W1-26**. Both are wave-1
scoreable today. W1-AMENDMENT-02 also moves `RI-VIS07` into Wave 1 through **W1-30**.

**Nothing else is deferred.** In particular the whole of `95-experience` except `RI-EXP04`,
all **nine** `88-journeys` items, all seven camera items, all six weapon items and all nine
quest items are wave-1 scoreable, because the wide-before-deep constraint puts their
prerequisites in wave 1 whether or not that was convenient.

## 5b. Where the dispatched pieces have drifted from this plan

Measured 2026-08-07 across every `subsystem_paths` array in `corpus/90-verdicts/wave1/`. **The
declared path set of a dispatched piece routinely disagrees with its entry in §3, in both
directions**, and both directions are silent failures: a piece that ships a path it did not
declare has escaped the item that judges it (`CORPUS-CONTRACT` §4 rule 2), and a piece that
declares less than §3 gives it has deferred the remainder without saying so.

| Piece | Claimed beyond its §3 entry (§3 owner) | Dropped from its §3 entry |
|---|---|---|
| `W1-01` | `world.region.identity` (W1-02) | — |
| `W1-07` | `progression.level.attributes`, `progression.skill.usegrowth`, `progression.build.identity` (all W1-16); `journey.chargen.diegesis` (W1-26) | `character.race.access`, `character.race.dialogue` |
| `W1-09` | `platform.determinism.harness` (W1-00); `combat.encounter.exit` (W1-12); `combat.encounter.parley` (**no owner, wave 2**) | `combat.attack.charge`, `combat.damage.model`, `combat.damage.scaling`, `combat.heal.charges`, `combat.pause.policy` |
| `W1-10` | `weapon.feel.hitstop`, `weapon.feel.mass`, `weapon.feel.material`, `weapon.feel.whiff` (all W1-11); `combat.attack.charge` (W1-09); `weapon.class.differentiation`, `weapon.identity.withinclass`, `weapon.animation.reuse`, `weapon.context.aerial` (**no owner, wave 2**) | — |
| `W1-09-combat-core` | 19 paths under a `piece_id` that is not a piece in §3 | — |

Two consequences, neither cosmetic:

- **Five wave-2 paths have been built and scored by wave-1 pieces.** §4 defines `wave` as *"the
  wave a builder first owns the path"*, so for `weapon.class.differentiation`,
  `weapon.identity.withinclass`, `weapon.animation.reuse`, `weapon.context.aerial` and
  `combat.encounter.parley` the field is now wrong. The `subsystems.json` correction is CRT's.
- **Seven paths are in a §3 piece, that piece has been dispatched, and no verdict declares them.**
  `character.race.access` and `character.race.dialogue` are the sharpest: `RI-CHR02` judges them,
  `RI-CHR02` was scored into `W1-07` three times, and the two paths carrying *"the
  Argonian-in-Black-Marsh premise pays mechanically"* have never been on a declared set.

**This section deliberately does not rewrite §3's path lists to match.** A verdict's
over-declaration is not a decomposition decision. It is recorded here so the next verdict on each
piece has to reconcile it.

## 5c. The dispatch order has not been wide before deep

Ownership was never the expensive half of this. The measured state on 2026-08-07:

> **At the 2026-08-07 measurement, seven of thirty wave-1 pieces had been dispatched. `W1-01` and
> `W1-09` had each been
> round-tripped four times, `W1-10` and `W1-14` three. And 79 of the corpus's 144 reference
> items — 55% — own no path declared by any dispatched verdict.**

The twenty-three pieces never dispatched include **every piece that owns a path deciding whether
the game can be played at all**: the opening (`W1-26`), desktop controls (`W1-08`), mobile and the
gamepad (`W1-29`), the first hour (`W1-28`), the main quest end to end (`W1-19`), settlements
(`W1-04`), the UI and AR-2 enforcement (`W1-21`), death and the corpse run (`W1-13`), the
experience instrument (`W1-25`), and the roads and signposts `RI-JRN07` needs (`W1-05`). Two more
are in flight and unjudged (`W1-17` dialogue, `W1-18` quests and the journal).

**The plan said wide before deep and the dispatch order did deep before wide.** No amendment to a
path list fixes that; only dispatching the pieces does. Recommended order, on wide-before-deep and
nothing else — each is a piece whose absence a player notices inside sixty seconds:

1. **`W1-08` + `W1-29`** — controls, desktop and mobile. Nothing else can be honestly judged on a
   build the critic cannot drive on the modalities the owner named; `RI-JRN01` HF5 is firing today
   because two of four modalities have never been run.
2. **`W1-26`** — the opening. Runnable against `RI-JRN09` today with no tool dependency.
3. **`W1-00` round 3** — the save round trip, now declared.
4. **`W1-13`** — death and recovery, now declared.
5. **`W1-04`, `W1-21`, `W1-19`** — settlements, the UI, and the main quest end to end.

## 6. Wave-2, -3 and -4 pieces, in outline

Not yet decomposed to builder granularity — that happens at the wave boundary, from the same
`wave` field — but named here so the trajectory is legible:

- **Wave 2** — boss design and phases; the full enemy roster; status buildup; 15 weapon
  classes and within-class subtlety; spellmaking, enchanting and the magic economy; faction
  escalation, expulsion and rivalry; weapon upgrade paths, trainers and the social skills;
  the affliction economy; emergence fuzzing and build-identity composition; the platform
  budgets; the parley (`RI-DLG09`); voice differentiation; the eight Souls-loop dungeons.
- **Wave 3** — 250 interiors and 82 caves; ~80 side quests; 112 books and the book UI;
  alchemy; ambient life, ecology and schedules; the strangeness instances; the settlement
  wordcount targets; music and voice; the novelty long tail.
- **Wave 4** — deepen the 25 Wave-1 `render.*` paths from the 7.0 feasibility floor to the 10/10
  ship bar; close all visual debt using the modern reference set and the separately judged
  Morrowind art-direction set. Wave 4 introduces no new `render.*` path.

## 7. Rules binding on every builder

- Read your reference items **before** writing code. You are judged against them, not
  against your taste.
- All content lives in inspectable JSON under `game/src/data/` so critics can analyse it
  without running the game.
- The simulation is deterministic: seeded RNG only, fixed 60Hz step, no wall-clock.
- **Frame counts are 1/60 s, always, and every frame figure states its rate** — S22 found the
  whole corpus running at double speed against Souls community counts taken in 1/30 s ticks.
  A frame figure with no rate attached is a hard fail in six items.
- The harness API on `window.__HARNESS` is a hard requirement, not a nice-to-have.
- The Arbitration Rule is not negotiable and not re-litigable.
- Your piece is not done when it works. It is done when the items in your "Judged by" list
  can be *run* against it — a bar that cannot be measured scores 0, not "probably fine".
