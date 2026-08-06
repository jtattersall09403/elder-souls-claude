# Build plan — waves, pieces, and how each is judged

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
**250 of 325 subsystem paths are first built in wave 1** — 77% of the taxonomy. That is not
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
| **1** | **Skeleton of everything.** Full map traversable; all 8 settlements standing and populated; character creation, camera, combat core, weapons, magic, stealth and crime real; main quest completable end to end; every faction line present at one quest deep; UI and AR-2 enforceable; the experience instrument and its sabotage control running | You can create a character, walk Argonia, sneak, steal, be arrested, cast, fight, die, and finish the game — and every wave-1 bar can be *scored*, not merely gestured at |
| 2 | Combat depth, bosses and the enemy roster to the Souls bar; full faction questlines with escalation, expulsion and rivalry; weapon class differentiation across all 15; spellmaking and enchanting; build-identity composition | Every faction line completable; combat passes the frame-data critics; `RI-CMP03` build identity scoreable |
| 3 | Density and strangeness: 250 interiors, dungeons, ~80 side quests, 112 books, ambient life, rumour networks, music and voice, alchemy | Density metrics hit; the world is strange, not generic |
| 4 | Visual fidelity to the modern bar; art direction to the Morrowind bar | Blind visual comparisons close; `RI-VIS07` no longer capping |
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

The test applied to the list below: for each of the 138 items, does at least one wave-1 piece
own a path it judges? **125 of 138 do.** The 13 that do not are listed in §5 with the wave
they first become scoreable, so "not built yet" is a declared state rather than a surprise.

## 3. Wave-1 piece decomposition

28 pieces. Each is one builder plus one separate critic. **Together they cover all 250
wave-1 paths exactly once** — no path is in two pieces, and no wave-1 path is in none. The
"Judged by" list is the `<<REFERENCE_ITEMS>>` block for both prompts, taken from
`corpus/00-doctrine/INDEX.md` §2; regenerate it rather than retyping it if the taxonomy moves.

### W1-00 — Harness, determinism and persistence

Nothing downstream is admissible without it. Every critic's method begins `window.__HARNESS`; RI-MTH04 deletes a verdict that cannot show a real run.

**Subsystem paths (7):** `platform.determinism.harness`, `platform.input.pipeline`, `platform.perf.simtime`, `platform.save.persistence`, `platform.save.storage`, `platform.perf.framerate`, `platform.load.ttfp`

**Judged by (10):** RI-AUD02, RI-CAM02, RI-CAM06, RI-CMB07, RI-JRN03, RI-JRN05, RI-MTH01, RI-MTH02, RI-PLT01, RI-PLT03

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

### W1-08 — Input, controls and modality parity

RI-EXP01 requires ≥7 exercised verbs; RI-JRN04 hard-fails a journey that cannot be completed on gamepad only or touch only.

**Subsystem paths (10):** `input.action.set`, `input.desktop.keyboard`, `input.desktop.pointerlock`, `input.gamepad.mapping`, `input.gamepad.analog`, `input.gamepad.lifecycle`, `input.touch.fallback`, `input.rebinding.model`, `input.modality.parity`, `input.discoverability`

**Judged by (4):** RI-DLG09, RI-JRN02, RI-JRN03, RI-JRN04

### W1-09 — The combat core

Frame-exact at 60 Hz post-S22. The single largest wave-1 piece and the one with the most reference items pointed at it.

**Subsystem paths (28):** `combat.dodge.iframes`, `combat.dodge.equipload`, `combat.dodge.directional`, `combat.dodge.recovery`, `combat.attack.commitment`, `combat.attack.moveset`, `combat.attack.tracking`, `combat.attack.charge`, `combat.frames.timing`, `combat.frames.cancel`, `combat.hitbox.hurtbox`, `combat.hitbox.sweep`, `combat.hitbox.resolution`, `combat.stamina.costs`, `combat.stamina.regen`, `combat.stamina.block`, `combat.stamina.exhaustion`, `combat.poise.player`, `combat.poise.enemy`, `combat.block.guard`, `combat.block.parry`, `combat.damage.model`, `combat.damage.scaling`, `combat.heal.charges`, `combat.input.buffer`, `combat.input.latency`, `combat.player.movement`, `combat.pause.policy`

**Judged by (30):** RI-AI02, RI-AI03, RI-AI04, RI-AI05, RI-CAM02, RI-CAM04, RI-CMB01, RI-CMB02, RI-CMB03, RI-CMB04, RI-CMB05, RI-CMB06, RI-CMB07, RI-CMB08, RI-CMB09, RI-CMB11, RI-LOR05, RI-PRG02, RI-PRG03, RI-PRG04, RI-PRG07, RI-PRG08, RI-UIX01, RI-UIX03, RI-VIS08, RI-WLD10, RI-WPN01, RI-WPN02, RI-WPN04, RI-WPN06

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

**Subsystem paths (6):** `combat.difficulty.lethality`, `combat.death.corpserun`, `combat.death.worldreset`, `combat.boss.arena`, `progression.bonfire.function`, `progression.bonfire.placement`

**Judged by (13):** RI-AI05, RI-AI06, RI-AI07, RI-AUD04, RI-CAM05, RI-CAM06, RI-CMB08, RI-JRN06, RI-LOR05, RI-PRG04, RI-TRV02, RI-WLD04, RI-WLD07

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

**Subsystem paths (16):** `quests.data.schema`, `quests.structure.stages`, `quests.structure.branching`, `quests.structure.deceit`, `quests.state.persistence`, `quests.failure.severed`, `quests.reward.shape`, `quests.giver.characterisation`, `quests.discovery.hooks`, `quests.lore.hooks`, `quests.resolution.noncombat`, `quests.resolution.exclusive`, `journal.entry.voice`, `journal.entry.numbering`, `journal.entry.directions`, `journal.navigation.nomarkers`

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

Not the fidelity pass — that is wave 4. This is the bifurcation protocol existing before any visual number is quoted, plus the one fidelity path the camera depends on.

**Subsystem paths (2):** `render.process.bifurcation`, `render.process.measurement`

**Judged by (6):** RI-CAM07, RI-UIX06, RI-VIS01, RI-VIS03, RI-VIS06, RI-VIS09

### W1-25 — The experience instrument and the seam crossings

The sabotage control, the anecdote trace, the permissiveness register and the crossing matrix are BUILD work, not critic work. PLAYTHROUGH-CRITIC §10 names 'the control is never run' as the most likely failure in the corpus.

**Subsystem paths (9):** `experience.opening.beats`, `experience.opening.hook`, `experience.memory.anecdote`, `experience.memory.recall`, `experience.permissiveness.register`, `experience.permissiveness.durability`, `experience.session.shape`, `composition.seam.crossings`, `composition.matrix.coverage`

**Judged by (5):** RI-CMP01, RI-EXP01, RI-EXP02, RI-EXP03, RI-EXP06

### W1-26 — The first hour, as a piece in its own right

RI-EXP01 can return DEAD and RI-JRN01/02 gate the wave. Someone must own the beat sheet end to end, because it crosses every other piece and therefore belongs to none of them.

**Subsystem paths (11):** `journey.firstlaunch.flow`, `journey.chargen.diegesis`, `journey.firsthour.interaction`, `journey.firsthour.competence`, `journey.onboarding.explanation`, `journey.quest.unmarked`, `journey.save.roundtrip`, `journey.death.recovery`, `journey.reentry.orientation`, `journey.process.naive`, `journey.process.fleet`

**Judged by (6):** RI-JRN01, RI-JRN02, RI-JRN05, RI-JRN06, RI-JRN07, RI-JRN08

### W1-27 — Density, loot and the coherence pass

The wave-end coherence agent's own surface, plus the hand-placement rule that forbids a procedural loot table anywhere in the game.

**Subsystem paths (10):** `world.density.handplacement`, `world.loot.placement`, `coherence.naming.consistency`, `coherence.lore.consistency`, `coherence.tone.crossregion`, `coherence.faction.crossref`, `coherence.difficulty.continuity`, `coherence.progression.pacing`, `coherence.economy.balance`, `coherence.systems.composition`

**Judged by (13):** RI-AI07, RI-CMP01, RI-DLG08, RI-LOR05, RI-LOR06, RI-MTH05, RI-PRG04, RI-PRG08, RI-QST08, RI-WLD01, RI-WLD02, RI-WLD05, RI-WLD09

## 4. Every path has a wave

`corpus/00-doctrine/subsystems.json` now carries a **`wave`** field on every one of its 325
paths, and `node tools/corpus-index.mjs --check` fails with an error if any path lacks one
(check **C7** of `RI-MTH05`). `wave` is **the wave a builder first owns the path**. Later
waves deepen it; they never introduce it — that is the wide-before-deep constraint expressed
as data rather than as prose nobody can check.

| Root | Paths | W1 | W2 | W3 | W4 |
|---|---:|---:|---:|---:|---:|
| `combat.*` | 50 | 47 | 3 | 0 | 0 |
| `weapon.*` | 20 | 16 | 4 | 0 | 0 |
| `magic.*` | 20 | 15 | 5 | 0 | 0 |
| `world.*` | 36 | 31 | 1 | 4 | 0 |
| `quests.*` | 22 | 17 | 3 | 2 | 0 |
| `progression.*` | 18 | 12 | 5 | 1 | 0 |
| `experience.*` | 15 | 10 | 4 | 1 | 0 |
| `dialogue.*` | 14 | 12 | 1 | 1 | 0 |
| `platform.*` | 13 | 7 | 6 | 0 | 0 |
| `journey.*` | 11 | 11 | 0 | 0 | 0 |
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
| `render.*` | 25 | 4 | 0 | 0 | 21 |
| `process.*` | 2 | 0 (wave 0) | 0 | 0 | 0 |
| **Total** | **325** | **250** | **38** | **14** | **21** |

`render.*` is the one root that is overwhelmingly late, and deliberately: the visual
bifurcation protocol and the two fidelity paths the camera and the water model depend on
(`render.fidelity.character`, `render.fidelity.water`) are wave 1; the remaining 21 are the
wave-4 fidelity and art-direction passes. `RI-VIS03`'s bands are also known-wrong for four of
twelve metrics until `C5` of `BAR-CRITIQUE-02` is discharged, so scoring them earlier would
fail a correct renderer.

## 5. Bars that are deliberately not scoreable in wave 1

Thirteen items own no wave-1 path. Each is deferred for a reason, and each is listed here so
that a wave-1 critic handed one of them knows to record `not_built_yet` rather than 0.

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
| `RI-VIS07` could-this-be-Skyrim | W4 | it caps the art score; capping a placeholder look tells nobody anything |
| `RI-LOR06`, `RI-MTH03`, `RI-MTH04`, `RI-MTH05` | wave 0 | process and doctrine items — already live, and they judge every wave including this one |

**Nothing else is deferred.** In particular the whole of `95-experience` except `RI-EXP04`,
all eight `88-journeys` items, all seven camera items, all six weapon items and all nine
quest items are wave-1 scoreable, because the wide-before-deep constraint puts their
prerequisites in wave 1 whether or not that was convenient.

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
- **Wave 4** — the 21 remaining `render.*` paths, after `BAR-CRITIQUE-02` **C5** is
  discharged and the modern reference set has ≥3 legally-usable frames per profile.

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
