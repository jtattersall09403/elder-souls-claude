# INDEX — traceability: subsystem → judging reference items → critic → method

> **GENERATED FILE — DO NOT HAND-EDIT.**
> Regenerate with `node tools/corpus-index.mjs`.
> Source of truth: `corpus/00-doctrine/subsystems.json` (taxonomy) +
> the YAML front-matter of every `corpus/**/RI-*.md` (`id`, `title`, `kind`, `side`,
> `judges`, `provenance`, `confidence`, `blind_pair`).
>
> **This file MUST be regenerated at the start of every wave**, and again after any
> reference item is added, retired, or has its `judges:` list changed. A stale index
> hands critics the wrong bar and lets builders start on unjudged work.
> Check staleness in CI with `node tools/corpus-index.mjs --check`.

Generated: 2026-08-05T22:43:21Z

This index satisfies CORPUS-CONTRACT §4. Its rules:

- **Every builder task names its subsystem path**, exactly as spelled here.
- **Every critic is handed exactly the reference items whose `judges:` list contains
  that path** — the "Judging items" column below is the hand-off list.
- **A subsystem with zero judging items is a corpus hole and the builder MUST NOT
  START** until the hole is filled (§4 of the contract, and §5 for how to fill it).

---

## 1. Coverage at a glance

- Canonical subsystem paths: **193**
- Reference items found: **41** across 7 area(s)
- Subsystems with at least one judging item: **127** (66%)
- **Corpus holes (no judging item): 66** (34%)
- Front-matter problems: 0 error(s), 0 warning(s)

| Root | Paths | Judged | Holes |
|---|---:|---:|---:|
| `combat.*` | 48 | 34 | 14 |
| `progression.*` | 18 | 14 | 4 |
| `quests.*` | 22 | 19 | 3 |
| `dialogue.*` | 14 | 11 | 3 |
| `journal.*` | 4 | 1 | 3 |
| `world.*` | 27 | 18 | 9 |
| `lore.*` | 10 | 6 | 4 |
| `render.*` | 24 | 21 | 3 |
| `audio.*` | 4 | 0 | 4 |
| `ui.*` | 8 | 3 | 5 |
| `platform.*` | 6 | 0 | 6 |
| `coherence.*` | 8 | 0 | 8 |

---

## 2. The mapping table

`Arb` = which side of the Arbitration Rule owns this path (`souls` inside the fight,
`morrowind` outside it, `modern-fidelity` / `art-direction` for the visual
bifurcation, `split` for a pre-decided seam, `neutral` where the corpus item defines
the bar outright). `Method` is derived from each item's `## Comparison method`.

### `combat.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `combat.frames.timing` | Startup / active / recovery frame counts per attack | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-AI03](../../corpus/10-combat/RI-AI03-punish-windows.md)<br>[RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md)<br>[RI-CMB04](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M8 (8 checks)<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cmb04-hitgeometry.mjs |
| `combat.frames.cancel` | What may cancel what, and when (roll-cancel, no free animation cancels) | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.dodge.iframes` | Roll invulnerability window measured in frames at 60Hz | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs |
| `combat.dodge.directional` | Directional roll semantics under lock-on, including backstep | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md)<br>[RI-PRG07](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs<br>in-item procedure (kind: number) |
| `combat.dodge.recovery` | Post-roll recovery and roll-spam punishment | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.stamina.costs` | Stamina cost table per action | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs |
| `combat.stamina.regen` | Regen rate and post-spend regen delay | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs |
| `combat.stamina.block` | Guard stamina drain, guard break, stability | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs |
| `combat.stamina.exhaustion` | Zero-stamina state and its punish window | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.hitbox.sweep` | Weapon hit volumes swept along the arc across the active window | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-CMB04](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cmb04-hitgeometry.mjs |
| `combat.hitbox.hurtbox` | Hurtboxes bound to and moving with animated bones | souls | [RI-CMB04](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb04-hitgeometry.mjs |
| `combat.hitbox.resolution` | Deterministic geometric hit resolution — NO to-hit roll (seam S1) | split | [RI-CMB04](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb04-hitgeometry.mjs |
| `combat.damage.model` | Damage formula, defences, absorption | souls | [RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md) | `critic.combat` | in-item procedure (kind: number) |
| `combat.damage.scaling` | How stats and skills scale damage (seam S3: scaling, never to-hit) | split | [RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md)<br>[RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md) | `critic.combat` | in-item procedure (kind: number)<br>in-item procedure (kind: number) |
| `combat.poise.player` | Player poise / hyperarmour and stagger-out | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.poise.enemy` | Enemy poise breaking, stagger, critical-hit opening | souls | [RI-AI03](../../corpus/10-combat/RI-AI03-punish-windows.md)<br>[RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md) | `critic.combat` | in-item M1–M8 (8 checks)<br>in-item M1–M8 (8 checks) |
| `combat.block.guard` | Blocking, chip damage, guard angle | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs |
| `combat.block.parry` | Parry window, riposte, backstab | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.attack.moveset` | Per-weapon-class moveset shape (R1/R2 chains, running, rolling) | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs |
| `combat.attack.commitment` | Root-motion-authoritative committed attacks; no instant turn during a swing | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-AI03](../../corpus/10-combat/RI-AI03-punish-windows.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M8 (8 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs |
| `combat.attack.charge` | Charged heavy attacks and their risk/reward | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.attack.tracking` | How much an attack may turn during startup, and not at all after | souls | [RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md) | `critic.combat` | in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs |
| `combat.dodge.equipload` | Equip load changing roll type, distance, and recovery | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs |
| `combat.player.movement` | In-fight locomotion: run, strafe, backstep, and their speeds | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs |
| `combat.weapon.identity` | Weapon classes feel categorically different to hold and swing | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.lockon.target` | Hard target lock acquisition, range, break conditions | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.lockon.switch` | Target switching between multiple hostiles | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.camera.behaviour` | Combat camera framing, collision, and lock-on pivot | souls | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md) | `critic.combat` | in-item M1–M11 (11 checks) |
| `combat.enemy.perception` | Sight cone, LOS, alert ladder, cost-of-entry aggro | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md) | `critic.combat` | in-item M1–M9 (9 checks) |
| `combat.enemy.statemachine` | Enemy AI states and legal transitions | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md) | `critic.combat` | in-item M1–M9 (9 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M8 (8 checks) |
| `combat.enemy.movement` | Approach, spacing bands, strafing, gap closing | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md) | `critic.combat` | in-item M1–M9 (9 checks) |
| `combat.enemy.telegraph` | Readable windups; no untelegraphed instant attacks | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M11 (11 checks) |
| `combat.enemy.punish` | Punish windows both ways: enemy recovery, player heal-read | souls | [RI-AI03](../../corpus/10-combat/RI-AI03-punish-windows.md)<br>[RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md) | `critic.combat` | in-item M1–M8 (8 checks)<br>in-item M1–M11 (11 checks) |
| `combat.enemy.leash` | De-aggro, leash return, world reset, no invulnerable walk-home | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md) | `critic.combat` | in-item M1–M9 (9 checks) |
| `combat.encounter.grouping` | Multi-enemy token arbitration; no gang-pile, no frozen queue | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md)<br>[RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md) | `critic.combat` | in-item M1–M9 (9 checks)<br>in-item M1–M8 (8 checks)<br>in-item M1–M10 (10 checks) |
| `combat.encounter.placement` | Hand-placed encounter composition and ambush legibility | souls | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md)<br>[RI-WLD02](../../corpus/50-world/RI-WLD02-density-per-minute.md) | `critic.combat` | in-item M1–M10 (10 checks)<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item M6–M11 (6 checks) |
| `combat.boss.phases` | Boss phase transitions and moveset expansion | souls | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md) | `critic.combat` | in-item M1–M11 (11 checks) |
| `combat.boss.arena` | Boss arena shape, fog gate, retry loop | souls | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md) | `critic.combat` | in-item M1–M11 (11 checks) |
| `combat.heal.charges` | Estus-equivalent: finite charges, animation commitment, refill at rest | souls | [RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.combat` | in-item procedure (kind: structure) |
| `combat.status.buildup` | In-fight status meters and procs (seam S11 Souls half) | split | **— HOLE —** | `critic.combat` | _none_ |
| `combat.magic.casting` | Spellcasting inside the fight: cast frames, commitment, resource | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.death.corpserun` | Souls dropped on death, recoverable at the death spot, lost on second death | souls | [RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.combat` | in-item procedure (kind: structure) |
| `combat.death.worldreset` | Rest/death resets ordinary enemies; named actors never respawn (seam S5) | split | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md)<br>[RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.combat` | in-item M1–M11 (11 checks)<br>in-item M1–M10 (10 checks)<br>in-item procedure (kind: structure) |
| `combat.input.buffer` | Input buffering window and queue semantics | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md)<br>[RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs |
| `combat.input.latency` | Press-to-first-active-frame latency | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.feedback.hitstop` | Hitstop, impact vfx/sfx, damage legibility | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.difficulty.lethality` | Regions gated by lethality; NO level-scaling to the player (seam S9) | souls | [RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md) | `critic.combat` | in-item M1–M8 (8 checks) |
| `combat.pause.policy` | World does not pause during combat; inventory is not a safe haven (seam S14) | souls | **— HOLE —** | `critic.combat` | _none_ |

### `progression.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `progression.level.curve` | Soul cost per level, single soft-cap curve, bonfire level-up (seam S2) | split | [RI-PRG01](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) | `critic.progression` | in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md |
| `progression.level.attributes` | Breadth of the stat sheet: attributes shaping build identity beyond weapon class | morrowind | [RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.skill.usegrowth` | Skills improve by use (seam S3) | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md)<br>[RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md) | `critic.progression` | in-item procedure (kind: number)<br>in-item procedure (kind: structure) |
| `progression.skill.gating` | Skills gate access and utility, never to-hit | morrowind | **— HOLE —** | `critic.progression` | _none_ |
| `progression.build.identity` | Two different builds play observably differently out of the fight, not only in it | morrowind | **— HOLE —** | `critic.progression` | _none_ |
| `progression.souls.economy` | Souls level you and ONLY level you (seam S15) | neutral | [RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-PRG01](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) | `critic.progression` | in-item M1–M8 (8 checks)<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md |
| `progression.gold.economy` | Gold is the only currency: merchants, bribes, training, travel, repairs | morrowind | [RI-PRG05](../../corpus/20-progression/RI-PRG05-gold-economy.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.merchant.barter` | Merchant gold pools, barter, disposition-affected prices | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md)<br>[RI-PRG05](../../corpus/20-progression/RI-PRG05-gold-economy.md) | `critic.progression` | in-item procedure (kind: number)<br>in-item procedure (kind: number) |
| `progression.bonfire.function` | What resting does and does not do (checkpoint + level-up, never teleport) | split | [RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.progression` | in-item procedure (kind: structure) |
| `progression.bonfire.placement` | Spacing and siting of rest points relative to danger | souls | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md) | `critic.progression` | in-item M1–M10 (10 checks) |
| `progression.equipment.upgrade` | Weapon upgrade paths and materials | souls | **— HOLE —** | `critic.progression` | _none_ |
| `progression.equipment.encumbrance` | Load / equip burden and its movement consequences | split | [RI-PRG07](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.inventory.model` | Inventory breadth, item weight, containers, repair | morrowind | [RI-QST08](../../corpus/30-quests/RI-QST08-reward-design.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.affliction.economy` | Named diseases, curses, in-world causes and cures (seam S11 Morrowind half) | morrowind | **— HOLE —** | `critic.progression` | _none_ |
| `progression.fatigue.social` | Morrowind Fatigue survives out-of-fight, affecting disposition/persuasion (seam S4) | morrowind | [RI-PRG07](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.skill.social` | Social skills (speechcraft, mercantile) and what they buy you | morrowind | [RI-QST05](../../corpus/30-quests/RI-QST05-non-combat-resolution.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.training.trainers` | Trainers: who, what skills, what limits, paid in gold | morrowind | [RI-PRG05](../../corpus/20-progression/RI-PRG05-gold-economy.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.crafting.alchemy` | Ingredients, alchemy, and the crafting loop | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md) | `critic.progression` | in-item procedure (kind: number) |

### `quests.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `quests.structure.stages` | Multi-stage quests with real intermediate state | morrowind | [RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.structure.branching` | Branch points that survive to different endings, not cosmetic choice | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md)<br>[RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: structure) |
| `quests.structure.deceit` | Quest-givers who lie, omit, or use the player | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.resolution.noncombat` | Quests resolvable by talk, bribe, sneak, theft, or lore knowledge | morrowind | [RI-QST05](../../corpus/30-quests/RI-QST05-non-combat-resolution.md) | `critic.quests` | in-item procedure (kind: number) |
| `quests.resolution.exclusive` | Mutually exclusive resolutions that permanently close doors | morrowind | **— HOLE —** | `critic.quests` | _none_ |
| `quests.faction.joining` | How you join, and that joining means something | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.quests` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text) |
| `quests.faction.rankgating` | Rank requirements on skills AND attributes | morrowind | [RI-QST01](../../corpus/30-quests/RI-QST01-faction-escalation-shape.md)<br>[RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: structure) |
| `quests.faction.escalation` | Errands escalate to politics escalate to power over the faction | morrowind | [RI-QST01](../../corpus/30-quests/RI-QST01-faction-escalation-shape.md)<br>[RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md)<br>[RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: structure)<br>in-item procedure (kind: structure)<br>in-item procedure (kind: text) |
| `quests.faction.rivalry` | Faction rivalry locks: advancing here costs you there | morrowind | [RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.faction.expulsion` | Expulsion, disgrace, and the path back | morrowind | **— HOLE —** | `critic.quests` | _none_ |
| `quests.mainline.prophecy` | Main quest shape: prophecy, doubt, and earned legitimacy | morrowind | [RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md)<br>[RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text) |
| `quests.giver.characterisation` | Quest-givers are people with agendas, not dispensers | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.reward.shape` | Rewards are specific, named, sometimes worse than promised | morrowind | [RI-QST08](../../corpus/30-quests/RI-QST08-reward-design.md) | `critic.quests` | in-item procedure (kind: number) |
| `quests.failure.severed` | Killable quest NPCs; thread-of-prophecy-severed instead of game over (seam S10) | morrowind | [RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.discovery.hooks` | Quests found through rumour and overheard talk, not a quest board | morrowind | [RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md)<br>[RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md)<br>[RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) | `critic.quests` | in-item procedure (kind: number)<br>in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs<br>in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs<br>in-item M12–M16 (5 checks) |
| `quests.state.persistence` | Quest/faction/world flags survive death untouched (seam S6) | morrowind | **— HOLE —** | `critic.quests` | _none_ |
| `quests.data.schema` | The quest data schema itself: stages, conditions, flags, journal binding | morrowind | [RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md)<br>[RI-QST05](../../corpus/30-quests/RI-QST05-non-combat-resolution.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: number) |
| `quests.density.count` | How many quests exist per faction, settlement, and region | morrowind | [RI-QST01](../../corpus/30-quests/RI-QST01-faction-escalation-shape.md)<br>[RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: number) |
| `quests.lore.hooks` | Quests that hang off books, rumours, and canon rather than a giver | morrowind | [RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) | `critic.quests` | in-item procedure (kind: text); corpus/80-methods/book-stats.py |
| `quests.mainline.acts` | Act structure of the main quest and its turning points | morrowind | [RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.mainline.antagonist` | The antagonist: presence, motive, and how the world speaks of them | morrowind | [RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.side.texture` | Side-quest texture: small, strange, local, non-heroic | morrowind | [RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md) | `critic.quests` | in-item procedure (kind: number) |

### `dialogue.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `dialogue.topics.graph` | Topic-list dialogue with a real graph behind it | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs |
| `dialogue.topics.discovery` | Keyword discovery: topics unlock by being told about them | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs |
| `dialogue.topics.filtering` | Same topic, different answer by faction/race/rank/disposition/place | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md)<br>[RI-DLG02](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs<br>in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs, tools/corpus/dump-npcs.mjs |
| `dialogue.disposition.model` | Disposition as a real number with real consequences | morrowind | [RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) | `critic.dialogue` | in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs |
| `dialogue.persuasion.mechanics` | Admire / intimidate / taunt / bribe and their risks | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md)<br>[RI-QST05](../../corpus/30-quests/RI-QST05-non-combat-resolution.md) | `critic.dialogue` | in-item procedure (kind: number)<br>in-item procedure (kind: number) |
| `dialogue.rumour.distribution` | Rumours differ per town and per class, and point at real content | morrowind | [RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md)<br>[RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.dialogue` | in-item procedure (kind: number)<br>in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs<br>in-item procedure (kind: text) |
| `dialogue.voice.register` | Prose quality and register: does it read like Morrowind or like filler | morrowind | **— HOLE —** | `critic.dialogue` | _none_ |
| `dialogue.npc.identity` | An NPC reads as a specific person with a specific position | morrowind | **— HOLE —** | `critic.dialogue` | _none_ |
| `dialogue.greeting.variation` | Greetings vary by state, place, and standing | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md)<br>[RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs<br>in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs |
| `dialogue.service.merchant` | Barter, training, repair, transport conducted through dialogue | morrowind | [RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) | `critic.dialogue` | in-item M12–M16 (5 checks) |
| `dialogue.combat.lockout` | Topic lists locked during COMBAT; enemies shout, not converse (seam S13) | souls | **— HOLE —** | `critic.dialogue` | _none_ |
| `dialogue.lore.vector` | NPC dialogue, not item descriptions, is the primary lore vector (AR-2) | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) | `critic.dialogue` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text); corpus/80-methods/book-stats.py |
| `dialogue.density.wordcount` | Volume of authored dialogue per NPC, settlement, and region | morrowind | [RI-DLG02](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md) | `critic.dialogue` | in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs, tools/corpus/dump-npcs.mjs |
| `dialogue.topics.truth` | NPCs may be wrong or lying inside a topic answer, discoverably | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md) | `critic.dialogue` | in-item procedure (kind: structure) |

### `journal.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `journal.entry.voice` | First-person-authored journal prose written by the character | morrowind | **— HOLE —** | `critic.journal` | _none_ |
| `journal.entry.numbering` | Numbered, dated, append-only entries with stable indices | morrowind | [RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) | `critic.journal` | in-item procedure (kind: structure) |
| `journal.entry.directions` | Directions carried in prose: landmarks, distances, named people (seam S8) | morrowind | **— HOLE —** | `critic.journal` | _none_ |
| `journal.navigation.nomarkers` | No compass markers, no objective arrows, anywhere | morrowind | **— HOLE —** | `critic.journal` | _none_ |

### `world.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `world.region.identity` | Each region is instantly identifiable from one screenshot | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.region.transition` | Borders between regions read as a change, not a texture swap | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.region.gating` | Region access gated by lethality and knowledge, not by level checks | souls | [RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) | `critic.world` | in-item M1–M8 (8 checks)<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md |
| `world.map.scale` | Absolute world size and the time it takes to cross | morrowind | [RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.map.legibility` | Navigable by landmark and memory; the map is a drawing, not a GPS | morrowind | [RI-WLD02](../../corpus/50-world/RI-WLD02-density-per-minute.md) | `critic.world` | in-item M6–M11 (6 checks) |
| `world.density.handplacement` | Hand-placed density: things per 100m that reward walking | morrowind | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md)<br>[RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md)<br>[RI-WLD02](../../corpus/50-world/RI-WLD02-density-per-minute.md) | `critic.world` | in-item M1–M10 (10 checks)<br>in-item procedure (kind: structure)<br>in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md<br>in-item M6–M11 (6 checks) |
| `world.settlement.anatomy` | What a settlement contains and how it is laid out | morrowind | [RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md)<br>[RI-DLG02](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md)<br>[RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.world` | in-item procedure (kind: number)<br>in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs, tools/corpus/dump-npcs.mjs<br>in-item M12–M16 (5 checks)<br>in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text) |
| `world.interior.named` | Named interiors with owners, contents, and reasons to exist | morrowind | [RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) | `critic.world` | in-item M12–M16 (5 checks) |
| `world.interior.continuity` | Interiors match their exteriors in size, orientation, and light | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.traversal.time` | Traversal time budgets between named places | morrowind | [RI-PRG07](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md)<br>[RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item procedure (kind: number)<br>in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.traversal.transport` | In-fiction transport network only; no warp-to-pin (seam S7) | morrowind | [RI-PRG05](../../corpus/20-progression/RI-PRG05-gold-economy.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.world` | in-item procedure (kind: number)<br>in-item procedure (kind: text) |
| `world.wayfinding.directions` | Getting there from prose directions actually works | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.strangeness.flora` | Alien plant life that is not a European forest | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.strangeness.fauna` | Alien animals and their behaviour in the world | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.strangeness.architecture` | Buildings that could not be anywhere else | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.hazard.environment` | Swamp, blight, drowning, disease vectors as world hazards | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.water.marsh` | Black Marsh specifically: water, tide, mud, depth, and its cost to cross | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.loot.placement` | Hand-placed, named, weird loot; no procedural drop tables (seam S12) | morrowind | [RI-QST08](../../corpus/30-quests/RI-QST08-reward-design.md) | `critic.world` | in-item procedure (kind: number) |
| `world.npc.population` | Who lives here, in what numbers, doing what | morrowind | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) | `critic.world` | in-item M1–M10 (10 checks)<br>in-item M12–M16 (5 checks) |
| `world.persistence.state` | Dropped, moved, and taken things stay that way | morrowind | [RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) | `critic.world` | in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs |
| `world.traversal.roads` | Roads, boardwalks and paths as the readable skeleton of the map | morrowind | [RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.traversal.locomotion` | Player movement speeds out of the fight, which set every traversal budget | morrowind | [RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.terrain.form` | Terrain shape, elevation, and how it channels movement | morrowind | [RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.time.daynight` | Time of day, its length, and what actually changes with it | morrowind | [RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.world` | in-item procedure (kind: structure) |
| `world.property.ownership` | Owned things, theft, witnesses, and consequence | morrowind | [RI-QST08](../../corpus/30-quests/RI-QST08-reward-design.md) | `critic.world` | in-item procedure (kind: number) |
| `world.locks.security` | Locks, security ratings, picking, and the alternatives to picking | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md) | `critic.world` | in-item procedure (kind: number) |
| `world.faction.presence` | Which factions hold which places, visibly, on the ground | morrowind | [RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md) | `critic.world` | in-item procedure (kind: structure) |

### `lore.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `lore.canon.registry` | The canon-facts registry itself, including the `disputed` flag | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text); corpus/80-methods/book-stats.py |
| `lore.canon.argonian` | Argonian culture, Hist, naming, biology, outsider perception | morrowind | **— HOLE —** | `critic.lore` | _none_ |
| `lore.canon.geography` | Black Marsh geography and place-names against canon | morrowind | **— HOLE —** | `critic.lore` | _none_ |
| `lore.canon.history` | Deep-time history and its visible residue | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text) |
| `lore.book.structure` | In-world books: length, form, authorial voice | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text); corpus/80-methods/book-stats.py |
| `lore.book.unreliability` | Sources contradict each other on purpose and are traceable to a bias | morrowind | **— HOLE —** | `critic.lore` | _none_ |
| `lore.naming.conventions` | Names of people, places, and things obey a consistent phonology | morrowind | **— HOLE —** | `critic.lore` | _none_ |
| `lore.religion.hist` | The Hist as an actual force in the world, not decoration | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py |
| `lore.canon.factions` | Who holds power, in canon: factions, politics, and their era | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text) |
| `lore.canon.prophecy` | Prophecy as a lore object: its text, its readers, and their disagreement | morrowind | [RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md) | `critic.lore` | in-item procedure (kind: structure) |

### `render.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `render.fidelity.lighting` | Direct/indirect lighting quality vs modern references | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs |
| `render.fidelity.shadows` | Shadow resolution, contact hardening, acne/peter-panning | modern-fidelity | [RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.materials` | PBR material response, roughness variation, no plastic look | modern-fidelity | [RI-VIS01](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md)<br>[RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md)<br>[RI-VIS06](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) | `critic.fidelity` | in-item procedure (kind: structure); corpus/80-methods/capture-shots.md, corpus/80-methods/cc-scan.mjs, cc-scan.mjs<br>in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure)<br>in-item procedure (kind: structure) |
| `render.fidelity.atmosphere` | Fog, haze, aerial perspective, volumetrics | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.vegetation` | Plant density, variation, wind response, LOD transitions | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: structure) |
| `render.fidelity.water` | Water surface, refraction, shoreline, and underwater | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: structure) |
| `render.fidelity.character` | Character and creature mesh/texture quality up close | modern-fidelity | **— HOLE —** | `critic.fidelity` | _none_ |
| `render.fidelity.animation` | Animation quality: weight, blending, foot contact | modern-fidelity | **— HOLE —** | `critic.fidelity` | _none_ |
| `render.fidelity.postprocess` | Tonemapping, exposure, AA, bloom discipline | modern-fidelity | [RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.streaming` | Draw distance, LOD popping, load-in visibility | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.ao` | Ambient occlusion: contact darkening and grounding | modern-fidelity | [RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: structure) |
| `render.fidelity.ibl` | Image-based / sky lighting and indirect response | modern-fidelity | [RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: structure) |
| `render.fidelity.sky` | Sky model, sun/moon, cloud, and its coupling to scene light | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.vfx` | Particle and effect quality: fire, spray, spell, blood, dust | modern-fidelity | [RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: structure) |
| `render.process.bifurcation` | The judging process itself: axis declared, references not crossed (ARBITRATION §4) | neutral | [RI-VIS01](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md)<br>[RI-VIS06](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) | `critic.fidelity` | in-item procedure (kind: structure); corpus/80-methods/capture-shots.md, corpus/80-methods/cc-scan.mjs, cc-scan.mjs<br>in-item procedure (kind: structure) |
| `render.process.measurement` | How a visual number is taken: capture protocol, poses, repeatability | neutral | [RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) | `critic.fidelity` | in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs |
| `render.art.palette` | Colour identity per region against Morrowind's palette discipline | art-direction | [RI-VIS01](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md)<br>[RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md)<br>[RI-VIS06](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) | `critic.artdirection` | in-item procedure (kind: structure); corpus/80-methods/capture-shots.md, corpus/80-methods/cc-scan.mjs, cc-scan.mjs<br>in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.art.silhouette` | Readable, strange silhouettes for creatures and buildings | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `render.art.architecture` | A coherent invented architectural language | art-direction | [RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md)<br>[RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item M12–M16 (5 checks)<br>in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `render.art.creature` | Creature design that is not a generic bestiary | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `render.art.composition` | Vista framing and landmark placement in the frame | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `render.art.weirdness` | The dream-logic strangeness budget per screen | art-direction | **— HOLE —** | `critic.artdirection` | _none_ |
| `render.art.flora` | Plant design language: shapes that could not be a European forest | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `render.art.materials` | Material identity as an art choice: chitin, resin, wet wood, bone | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |

### `audio.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `audio.combat.impact` | Hit, block, parry, and death sound design | souls | **— HOLE —** | `critic.audio` | _none_ |
| `audio.ambience.region` | Region ambience that identifies a place with eyes closed | morrowind | **— HOLE —** | `critic.audio` | _none_ |
| `audio.music.policy` | Where music plays and where silence is correct | souls | **— HOLE —** | `critic.audio` | _none_ |
| `audio.voice.policy` | Voiced greetings vs written dialogue; consistency of the choice | morrowind | **— HOLE —** | `critic.audio` | _none_ |

### `ui.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `ui.hud.combat` | Health/stamina/charges HUD legibility under pressure | souls | **— HOLE —** | `critic.ui` | _none_ |
| `ui.hud.minimalism` | No compass, no markers, no quest arrows on screen (AR-2) | morrowind | **— HOLE —** | `critic.ui` | _none_ |
| `ui.menu.inventory` | Inventory screen structure and information density | morrowind | **— HOLE —** | `critic.ui` | _none_ |
| `ui.menu.journal` | Journal presentation, topic index, quest filtering | morrowind | **— HOLE —** | `critic.ui` | _none_ |
| `ui.dialogue.presentation` | Dialogue window: topic list, hyperlinked keywords, portrait, prose | morrowind | **— HOLE —** | `critic.ui` | _none_ |
| `ui.style.diegesis` | UI art belongs to the world rather than to a UI kit | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.ui` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `ui.menu.levelup` | The level-up screen: what it shows, what it costs, where it lives | split | [RI-PRG01](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md)<br>[RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md) | `critic.ui` | in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item procedure (kind: number) |
| `ui.menu.books` | Reading a book in-game: presentation, pagination, legibility | morrowind | [RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) | `critic.ui` | in-item procedure (kind: text); corpus/80-methods/book-stats.py |

### `platform.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `platform.perf.framerate` | Frame time budget and stability in a real browser | neutral | **— HOLE —** | `critic.platform` | _none_ |
| `platform.perf.memory` | Heap and GPU memory ceilings, leak-free over a session | neutral | **— HOLE —** | `critic.platform` | _none_ |
| `platform.load.streaming` | Initial load time and in-session streaming hitches | neutral | **— HOLE —** | `critic.platform` | _none_ |
| `platform.input.pipeline` | Browser input path: pointer lock, key repeat, dropped inputs | neutral | **— HOLE —** | `critic.platform` | _none_ |
| `platform.save.persistence` | Save/load fidelity of world, quest, and faction state | morrowind | **— HOLE —** | `critic.platform` | _none_ |
| `platform.determinism.harness` | Seeded, fixed-step headless runs that a critic can reproduce | neutral | **— HOLE —** | `critic.platform` | _none_ |

### `coherence.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `coherence.tone.crossregion` | Tone and register hold across region borders | morrowind | **— HOLE —** | `critic.coherence` | _none_ |
| `coherence.faction.crossref` | Factions know about and react to each other | morrowind | **— HOLE —** | `critic.coherence` | _none_ |
| `coherence.lore.consistency` | Lore contradictions are flagged `disputed` or they are bugs | morrowind | **— HOLE —** | `critic.coherence` | _none_ |
| `coherence.difficulty.continuity` | No lethality cliffs or troughs at region borders | souls | **— HOLE —** | `critic.coherence` | _none_ |
| `coherence.systems.composition` | Systems still compose: disposition affects prices affects quests affects access | neutral | **— HOLE —** | `critic.coherence` | _none_ |
| `coherence.naming.consistency` | One thing has one name everywhere it is mentioned | morrowind | **— HOLE —** | `critic.coherence` | _none_ |
| `coherence.economy.balance` | Gold in equals gold out across the whole game, not per piece | morrowind | **— HOLE —** | `critic.coherence` | _none_ |
| `coherence.progression.pacing` | The whole-run curve of power, danger, and revelation | neutral | **— HOLE —** | `critic.coherence` | _none_ |

---

## 3. Corpus holes

Subsystem paths with **no** reference item judging them. Per CORPUS-CONTRACT §4, a
builder must not start on one of these. Per §5, a critic that needs one writes the
item rather than guessing, then regenerates this index.

**66 of 193 paths are holes.**

| Subsystem path | What it means | Arb | Expected area | Critic |
|---|---|---|---|---|
| `combat.frames.cancel` | What may cancel what, and when (roll-cancel, no free animation cancels) | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.dodge.recovery` | Post-roll recovery and roll-spam punishment | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.stamina.exhaustion` | Zero-stamina state and its punish window | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.poise.player` | Player poise / hyperarmour and stagger-out | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.block.parry` | Parry window, riposte, backstab | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.attack.charge` | Charged heavy attacks and their risk/reward | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.weapon.identity` | Weapon classes feel categorically different to hold and swing | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.lockon.target` | Hard target lock acquisition, range, break conditions | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.lockon.switch` | Target switching between multiple hostiles | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.status.buildup` | In-fight status meters and procs (seam S11 Souls half) | split | `corpus/10-combat/` | `critic.combat` |
| `combat.magic.casting` | Spellcasting inside the fight: cast frames, commitment, resource | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.input.latency` | Press-to-first-active-frame latency | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.feedback.hitstop` | Hitstop, impact vfx/sfx, damage legibility | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.pause.policy` | World does not pause during combat; inventory is not a safe haven (seam S14) | souls | `corpus/10-combat/` | `critic.combat` |
| `progression.skill.gating` | Skills gate access and utility, never to-hit | morrowind | `corpus/20-progression/` | `critic.progression` |
| `progression.build.identity` | Two different builds play observably differently out of the fight, not only in it | morrowind | `corpus/20-progression/` | `critic.progression` |
| `progression.equipment.upgrade` | Weapon upgrade paths and materials | souls | `corpus/20-progression/` | `critic.progression` |
| `progression.affliction.economy` | Named diseases, curses, in-world causes and cures (seam S11 Morrowind half) | morrowind | `corpus/20-progression/` | `critic.progression` |
| `quests.resolution.exclusive` | Mutually exclusive resolutions that permanently close doors | morrowind | `corpus/30-quests/` | `critic.quests` |
| `quests.faction.expulsion` | Expulsion, disgrace, and the path back | morrowind | `corpus/30-quests/` | `critic.quests` |
| `quests.state.persistence` | Quest/faction/world flags survive death untouched (seam S6) | morrowind | `corpus/30-quests/` | `critic.quests` |
| `dialogue.voice.register` | Prose quality and register: does it read like Morrowind or like filler | morrowind | `corpus/40-dialogue/` | `critic.dialogue` |
| `dialogue.npc.identity` | An NPC reads as a specific person with a specific position | morrowind | `corpus/40-dialogue/` | `critic.dialogue` |
| `dialogue.combat.lockout` | Topic lists locked during COMBAT; enemies shout, not converse (seam S13) | souls | `corpus/40-dialogue/` | `critic.dialogue` |
| `journal.entry.voice` | First-person-authored journal prose written by the character | morrowind | `corpus/40-dialogue/` | `critic.journal` |
| `journal.entry.directions` | Directions carried in prose: landmarks, distances, named people (seam S8) | morrowind | `corpus/40-dialogue/` | `critic.journal` |
| `journal.navigation.nomarkers` | No compass markers, no objective arrows, anywhere | morrowind | `corpus/40-dialogue/` | `critic.journal` |
| `world.region.identity` | Each region is instantly identifiable from one screenshot | morrowind | `corpus/50-world/` | `critic.world` |
| `world.region.transition` | Borders between regions read as a change, not a texture swap | morrowind | `corpus/50-world/` | `critic.world` |
| `world.interior.continuity` | Interiors match their exteriors in size, orientation, and light | morrowind | `corpus/50-world/` | `critic.world` |
| `world.wayfinding.directions` | Getting there from prose directions actually works | morrowind | `corpus/50-world/` | `critic.world` |
| `world.strangeness.flora` | Alien plant life that is not a European forest | morrowind | `corpus/50-world/` | `critic.world` |
| `world.strangeness.fauna` | Alien animals and their behaviour in the world | morrowind | `corpus/50-world/` | `critic.world` |
| `world.strangeness.architecture` | Buildings that could not be anywhere else | morrowind | `corpus/50-world/` | `critic.world` |
| `world.hazard.environment` | Swamp, blight, drowning, disease vectors as world hazards | morrowind | `corpus/50-world/` | `critic.world` |
| `world.water.marsh` | Black Marsh specifically: water, tide, mud, depth, and its cost to cross | morrowind | `corpus/50-world/` | `critic.world` |
| `lore.canon.argonian` | Argonian culture, Hist, naming, biology, outsider perception | morrowind | `corpus/60-lore/` | `critic.lore` |
| `lore.canon.geography` | Black Marsh geography and place-names against canon | morrowind | `corpus/60-lore/` | `critic.lore` |
| `lore.book.unreliability` | Sources contradict each other on purpose and are traceable to a bias | morrowind | `corpus/60-lore/` | `critic.lore` |
| `lore.naming.conventions` | Names of people, places, and things obey a consistent phonology | morrowind | `corpus/60-lore/` | `critic.lore` |
| `render.fidelity.character` | Character and creature mesh/texture quality up close | modern-fidelity | `corpus/70-visual/` | `critic.fidelity` |
| `render.fidelity.animation` | Animation quality: weight, blending, foot contact | modern-fidelity | `corpus/70-visual/` | `critic.fidelity` |
| `render.art.weirdness` | The dream-logic strangeness budget per screen | art-direction | `corpus/70-visual/` | `critic.artdirection` |
| `audio.combat.impact` | Hit, block, parry, and death sound design | souls | `corpus/70-visual/` | `critic.audio` |
| `audio.ambience.region` | Region ambience that identifies a place with eyes closed | morrowind | `corpus/70-visual/` | `critic.audio` |
| `audio.music.policy` | Where music plays and where silence is correct | souls | `corpus/70-visual/` | `critic.audio` |
| `audio.voice.policy` | Voiced greetings vs written dialogue; consistency of the choice | morrowind | `corpus/70-visual/` | `critic.audio` |
| `ui.hud.combat` | Health/stamina/charges HUD legibility under pressure | souls | `corpus/70-visual/` | `critic.ui` |
| `ui.hud.minimalism` | No compass, no markers, no quest arrows on screen (AR-2) | morrowind | `corpus/70-visual/` | `critic.ui` |
| `ui.menu.inventory` | Inventory screen structure and information density | morrowind | `corpus/70-visual/` | `critic.ui` |
| `ui.menu.journal` | Journal presentation, topic index, quest filtering | morrowind | `corpus/70-visual/` | `critic.ui` |
| `ui.dialogue.presentation` | Dialogue window: topic list, hyperlinked keywords, portrait, prose | morrowind | `corpus/70-visual/` | `critic.ui` |
| `platform.perf.framerate` | Frame time budget and stability in a real browser | neutral | `corpus/80-methods/` | `critic.platform` |
| `platform.perf.memory` | Heap and GPU memory ceilings, leak-free over a session | neutral | `corpus/80-methods/` | `critic.platform` |
| `platform.load.streaming` | Initial load time and in-session streaming hitches | neutral | `corpus/80-methods/` | `critic.platform` |
| `platform.input.pipeline` | Browser input path: pointer lock, key repeat, dropped inputs | neutral | `corpus/80-methods/` | `critic.platform` |
| `platform.save.persistence` | Save/load fidelity of world, quest, and faction state | morrowind | `corpus/80-methods/` | `critic.platform` |
| `platform.determinism.harness` | Seeded, fixed-step headless runs that a critic can reproduce | neutral | `corpus/80-methods/` | `critic.platform` |
| `coherence.tone.crossregion` | Tone and register hold across region borders | morrowind | `corpus/00-doctrine/` | `critic.coherence` |
| `coherence.faction.crossref` | Factions know about and react to each other | morrowind | `corpus/00-doctrine/` | `critic.coherence` |
| `coherence.lore.consistency` | Lore contradictions are flagged `disputed` or they are bugs | morrowind | `corpus/00-doctrine/` | `critic.coherence` |
| `coherence.difficulty.continuity` | No lethality cliffs or troughs at region borders | souls | `corpus/00-doctrine/` | `critic.coherence` |
| `coherence.systems.composition` | Systems still compose: disposition affects prices affects quests affects access | neutral | `corpus/00-doctrine/` | `critic.coherence` |
| `coherence.naming.consistency` | One thing has one name everywhere it is mentioned | morrowind | `corpus/00-doctrine/` | `critic.coherence` |
| `coherence.economy.balance` | Gold in equals gold out across the whole game, not per piece | morrowind | `corpus/00-doctrine/` | `critic.coherence` |
| `coherence.progression.pacing` | The whole-run curve of power, danger, and revelation | neutral | `corpus/00-doctrine/` | `critic.coherence` |

---

## 4. Path reconciliation

### 4a. Legacy `judges:` spellings still in use

These items name a path that is **not** canonical but has a registered alias in
`subsystems.json`. The index resolved them so the mapping is usable today, but the
front-matter should be corrected to the canonical spelling when the item is next
touched. **New reference items must use canonical paths only** — aliases are a
migration aid, not a second vocabulary.

**150 legacy spellings in use.**

| Legacy path | Canonical path | Used by |
|---|---|---|
| `books.content` | `lore.book.structure` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `books.length` | `lore.book.structure` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `books.taxonomy` | `lore.book.structure` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `combat.animation.commitment` | `combat.attack.commitment` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| `combat.animation.rootmotion` | `combat.attack.commitment` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| `combat.damage.resolution` | `combat.hitbox.resolution` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.damage_formula` | `combat.damage.model` | RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md) |
| `combat.determinism` | `combat.hitbox.resolution` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.dodge` | `combat.dodge.directional` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `combat.enemy_roster` | `combat.encounter.placement` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `combat.frame.order` | `combat.frames.timing` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.guardbreak` | `combat.stamina.block` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.hit.geometry` | `combat.hitbox.sweep` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.hit.sweep` | `combat.hitbox.sweep` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.hurtbox` | `combat.hitbox.hurtbox` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.invulnerability` | `combat.dodge.iframes` | RI-CMB01 (corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) |
| `combat.player.attack` | `combat.attack.moveset` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| `combat.player.block` | `combat.block.guard` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.player.dodge` | `combat.dodge.directional` | RI-CMB01 (corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) |
| `combat.player.equipload` | `combat.dodge.equipload` | RI-CMB01 (corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) |
| `combat.player.sprint` | `combat.stamina.costs` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.player.stamina` | `combat.stamina.costs` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.player.tracking` | `combat.attack.tracking` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| `combat.resource.pacing` | `combat.stamina.regen` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.weapons.frames` | `combat.frames.timing` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| `content.volume` | `dialogue.density.wordcount` | RI-DLG02 (corpus/40-dialogue/RI-DLG02-words-per-settlement.md) |
| `data.quests` | `quests.data.schema` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `dialogue.claims` | `dialogue.lore.vector` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `dialogue.density` | `dialogue.density.wordcount` | RI-DLG02 (corpus/40-dialogue/RI-DLG02-words-per-settlement.md) |
| `dialogue.discovery` | `dialogue.topics.discovery` | RI-DLG01 (corpus/40-dialogue/RI-DLG01-topic-graph.md) |
| `dialogue.disposition` | `dialogue.disposition.model` | RI-DLG03 (corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) |
| `dialogue.filter` | `dialogue.topics.filtering` | RI-DLG01 (corpus/40-dialogue/RI-DLG01-topic-graph.md) |
| `dialogue.greeting` | `dialogue.greeting.variation` | RI-DLG01 (corpus/40-dialogue/RI-DLG01-topic-graph.md), RI-DLG03 (corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) |
| `dialogue.persuasion` | `dialogue.persuasion.mechanics` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md), RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `dialogue.rumour` | `dialogue.rumour.distribution` | RI-DLG03 (corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) |
| `dialogue.rumours` | `dialogue.rumour.distribution` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `dialogue.settlement` | `dialogue.topics.filtering` | RI-DLG02 (corpus/40-dialogue/RI-DLG02-words-per-settlement.md) |
| `dialogue.topics` | `dialogue.topics.graph` | RI-DLG01 (corpus/40-dialogue/RI-DLG01-topic-graph.md) |
| `economy.barter` | `progression.merchant.barter` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md), RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `economy.carrying` | `progression.equipment.encumbrance` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `economy.gold` | `progression.gold.economy` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `economy.loot` | `world.loot.placement` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `economy.merchants` | `progression.merchant.barter` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `economy.souls` | `progression.souls.economy` | RI-PRG01 (corpus/20-progression/RI-PRG01-soul-cost-curve.md) |
| `lore.canon` | `lore.canon.registry` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `lore.era` | `lore.canon.history` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `lore.factions` | `lore.canon.factions` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `lore.hist` | `lore.religion.hist` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md) |
| `lore.history` | `lore.canon.history` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md) |
| `lore.politics` | `lore.canon.factions` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `lore.prophecy` | `lore.canon.prophecy` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `movement.speed` | `world.traversal.locomotion` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| `npc.population` | `world.npc.population` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `npc.services` | `dialogue.service.merchant` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `progression.attributes` | `progression.level.attributes` | RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md) |
| `progression.checkpoint` | `progression.bonfire.function` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `progression.death` | `combat.death.corpserun` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `progression.equip_load` | `progression.equipment.encumbrance` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `progression.faction.rank` | `quests.faction.rankgating` | RI-QST01 (corpus/30-quests/RI-QST01-faction-escalation-shape.md), RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `progression.fatigue` | `progression.fatigue.social` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `progression.flask` | `combat.heal.charges` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `progression.items` | `progression.inventory.model` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `progression.level_cost` | `progression.level.curve` | RI-PRG01 (corpus/20-progression/RI-PRG01-soul-cost-curve.md) |
| `progression.levelup_ui` | `ui.menu.levelup` | RI-PRG01 (corpus/20-progression/RI-PRG01-soul-cost-curve.md), RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md) |
| `progression.pace` | `progression.level.curve` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `progression.scaling` | `combat.damage.scaling` | RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md), RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md) |
| `progression.skills` | `progression.skill.usegrowth` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md), RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `progression.skills.social` | `progression.skill.social` | RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `progression.souls_yield` | `progression.souls.economy` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `progression.training` | `progression.training.trainers` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `quest.hubs` | `quests.discovery.hooks` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `quests.branching` | `quests.structure.branching` | RI-QST02 (corpus/30-quests/RI-QST02-deceit-patterns.md), RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `quests.deceit` | `quests.structure.deceit` | RI-QST02 (corpus/30-quests/RI-QST02-deceit-patterns.md) |
| `quests.density` | `quests.density.count` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md) |
| `quests.discovery` | `quests.discovery.hooks` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md), RI-DLG01 (corpus/40-dialogue/RI-DLG01-topic-graph.md), RI-DLG03 (corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) |
| `quests.escalation` | `quests.faction.escalation` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `quests.faction.counts` | `quests.density.count` | RI-QST01 (corpus/30-quests/RI-QST01-faction-escalation-shape.md) |
| `quests.faction.exclusivity` | `quests.faction.rivalry` | RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `quests.faction.gating` | `quests.faction.rankgating` | RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `quests.faction.leverage` | `quests.faction.escalation` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `quests.faction.ranks` | `quests.faction.rankgating` | RI-QST01 (corpus/30-quests/RI-QST01-faction-escalation-shape.md) |
| `quests.factions` | `quests.faction.joining` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `quests.failure` | `quests.failure.severed` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `quests.giver` | `quests.giver.characterisation` | RI-QST02 (corpus/30-quests/RI-QST02-deceit-patterns.md) |
| `quests.journal` | `journal.entry.numbering` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `quests.lorehooks` | `quests.lore.hooks` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `quests.main` | `quests.mainline.prophecy` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md), RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `quests.main.acts` | `quests.mainline.acts` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `quests.main.antagonist` | `quests.mainline.antagonist` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `quests.resolution.methods` | `quests.resolution.noncombat` | RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `quests.rewards` | `quests.reward.shape` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `quests.rewards.unique` | `quests.reward.shape` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `quests.schema` | `quests.data.schema` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md), RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `quests.side` | `quests.side.texture` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md) |
| `quests.stages` | `quests.structure.stages` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `ui.readables` | `ui.menu.books` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `visual.artdirection` | `render.art.palette` | RI-VIS01 (corpus/70-visual/RI-VIS01-bifurcation-protocol.md), RI-VIS06 (corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) |
| `visual.artdirection.architecture` | `render.art.architecture` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.composition` | `render.art.composition` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.creature` | `render.art.creature` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.flora` | `render.art.flora` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.materials` | `render.art.materials` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.palette` | `render.art.palette` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.silhouette` | `render.art.silhouette` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.ui` | `ui.style.diegesis` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.process.blindtest` | `render.process.bifurcation` | RI-VIS06 (corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) |
| `visual.process.contamination` | `render.process.bifurcation` | RI-VIS01 (corpus/70-visual/RI-VIS01-bifurcation-protocol.md) |
| `visual.process.declaration` | `render.process.bifurcation` | RI-VIS01 (corpus/70-visual/RI-VIS01-bifurcation-protocol.md) |
| `visual.process.judgement` | `render.process.bifurcation` | RI-VIS01 (corpus/70-visual/RI-VIS01-bifurcation-protocol.md), RI-VIS06 (corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) |
| `visual.process.measurement` | `render.process.measurement` | RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) |
| `visual.renderer` | `render.fidelity.materials` | RI-VIS01 (corpus/70-visual/RI-VIS01-bifurcation-protocol.md), RI-VIS06 (corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) |
| `visual.renderer.antialiasing` | `render.fidelity.postprocess` | RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.ao` | `render.fidelity.ao` | RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.atmosphere` | `render.fidelity.atmosphere` | RI-VIS02 (corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md), RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.drawdistance` | `render.fidelity.streaming` | RI-VIS02 (corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md) |
| `visual.renderer.foliage` | `render.fidelity.vegetation` | RI-VIS02 (corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.ibl` | `render.fidelity.ibl` | RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.lighting` | `render.fidelity.lighting` | RI-VIS02 (corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md), RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) |
| `visual.renderer.lod` | `render.fidelity.streaming` | RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.materials` | `render.fidelity.materials` | RI-VIS02 (corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md), RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.postprocess` | `render.fidelity.postprocess` | RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.shadows` | `render.fidelity.shadows` | RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.sky` | `render.fidelity.sky` | RI-VIS02 (corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md), RI-VIS03 (corpus/70-visual/RI-VIS03-fidelity-image-metrics.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.vfx` | `render.fidelity.vfx` | RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `visual.renderer.water` | `render.fidelity.water` | RI-VIS02 (corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md), RI-VIS04 (corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| `world.alchemy` | `progression.crafting.alchemy` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md) |
| `world.architecture` | `render.art.architecture` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `world.density` | `world.density.handplacement` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.encounters` | `combat.encounter.placement` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.factions` | `world.faction.presence` | RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `world.interiors` | `world.interior.named` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `world.locks` | `world.locks.security` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md) |
| `world.placement` | `world.density.handplacement` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md), RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.poi` | `world.density.handplacement` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.property` | `world.property.ownership` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `world.reactivity` | `world.persistence.state` | RI-DLG03 (corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) |
| `world.region_gating` | `world.region.gating` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `world.respawn` | `combat.death.worldreset` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `world.roads` | `world.traversal.roads` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| `world.scale` | `world.map.scale` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| `world.settlement` | `world.settlement.anatomy` | RI-DLG02 (corpus/40-dialogue/RI-DLG02-words-per-settlement.md) |
| `world.settlement.content` | `world.settlement.anatomy` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md) |
| `world.settlements` | `world.settlement.anatomy` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md), RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `world.sightlines` | `world.map.legibility` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.spacing` | `world.density.handplacement` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `world.terrain` | `world.terrain.form` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| `world.time` | `world.time.daynight` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `world.transport` | `world.traversal.transport` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `world.travel` | `world.traversal.transport` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `world.traversal` | `world.traversal.time` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md), RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |

### 4b. Unresolved `judges:` targets

Paths claimed by an item that are neither canonical nor aliased. An unresolved path
means a critic would be judging something no builder was ever told to address. Fix
the item, or append the path to `subsystems.json`, then regenerate.

_None._

---

## 5. Reference item inventory

| Id | Title | Area | Kind | Side | Prov | Conf | Blind | Judges | File |
|---|---|---|---|---|---|---|---|---|---|
| RI-AI01 | Aggro, approach and spacing — the enemy engagement state machine | 10-combat | structure | souls | constructed | high | yes | `combat.enemy.perception` `combat.enemy.statemachine` `combat.enemy.movement` `combat.enemy.leash` `combat.encounter.grouping` | [corpus/10-combat/RI-AI01-aggro-approach-spacing.md](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md) |
| RI-AI02 | Telegraph doctrine — minimum windup, silhouette, and tracking cutoff | 10-combat | number | souls | constructed | high | yes | `combat.enemy.telegraph` `combat.attack.commitment` `combat.attack.moveset` `combat.hitbox.sweep` `combat.frames.timing` | [corpus/10-combat/RI-AI02-telegraph-doctrine.md](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md) |
| RI-AI03 | Punish windows — the recovery contract and the punish window ratio | 10-combat | number | souls | constructed | high | yes | `combat.enemy.punish` `combat.attack.commitment` `combat.frames.timing` `combat.poise.enemy` | [corpus/10-combat/RI-AI03-punish-windows.md](../../corpus/10-combat/RI-AI03-punish-windows.md) |
| RI-AI04 | Attack strings, combo branching, and the delayed follow-up | 10-combat | structure | souls | constructed | high | yes | `combat.attack.moveset` `combat.enemy.telegraph` `combat.enemy.statemachine` `combat.attack.commitment` | [corpus/10-combat/RI-AI04-attack-strings-and-delays.md](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md) |
| RI-AI05 | Enemy roster archetypes — ten roles, and the stat bands that define them | 10-combat | number | souls | constructed | high | yes | `combat.difficulty.lethality` `combat.poise.enemy` `combat.enemy.statemachine` `combat.encounter.grouping` `progression.souls.economy` `world.region.gating` | [corpus/10-combat/RI-AI05-roster-archetypes.md](../../corpus/10-combat/RI-AI05-roster-archetypes.md) |
| RI-AI06 | Boss design — phases, rhythm, arena, and the fog-gate loop | 10-combat | structure | souls | constructed | medium | yes | `combat.boss.phases` `combat.boss.arena` `combat.enemy.telegraph` `combat.enemy.punish` `combat.death.worldreset` `combat.camera.behaviour` | [corpus/10-combat/RI-AI06-boss-design.md](../../corpus/10-combat/RI-AI06-boss-design.md) |
| RI-AI07 | Encounter composition — placement, sightlines, density, and the bonfire loop | 10-combat | number | souls | constructed | high | yes | `combat.encounter.placement` `combat.encounter.grouping` `world.density.handplacement` `progression.bonfire.placement` `combat.death.worldreset` `world.npc.population` | [corpus/10-combat/RI-AI07-encounter-composition.md](../../corpus/10-combat/RI-AI07-encounter-composition.md) |
| RI-CMB01 | Roll and dodge — i-frame windows, equip-load tiers, and the fat-roll threshold | 10-combat | number | souls | constructed | high | yes | `combat.dodge.directional` `combat.dodge.equipload` `combat.player.movement` `combat.dodge.iframes` `combat.input.buffer` | [corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) |
| RI-CMB02 | Attack frame data by weapon class — startup, active, recovery, and the commitment rule | 10-combat | number | souls | constructed | high | yes | `combat.attack.moveset` `combat.frames.timing` `combat.attack.commitment` `combat.input.buffer` `combat.attack.tracking` | [corpus/10-combat/RI-CMB02-attack-frame-data.md](../../corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| RI-CMB03 | Stamina economy — costs, regeneration, blocking, and guard break | 10-combat | number | souls | constructed | high | yes | `combat.stamina.costs` `combat.block.guard` `combat.stamina.block` `combat.stamina.regen` | [corpus/10-combat/RI-CMB03-stamina-economy.md](../../corpus/10-combat/RI-CMB03-stamina-economy.md) |
| RI-CMB04 | Hitboxes and hurtboxes — swept capsules, bone attachment, and the no-dice rule | 10-combat | structure | souls | constructed | high | no | `combat.hitbox.sweep` `combat.hitbox.hurtbox` `combat.hitbox.resolution` `combat.frames.timing` | [corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| RI-PRG01 | The soul cost curve — souls-to-next-level, L1 to L140 | 20-progression | number | souls | constructed | high | no | `progression.level.curve` `ui.menu.levelup` `progression.souls.economy` | [corpus/20-progression/RI-PRG01-soul-cost-curve.md](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md) |
| RI-PRG02 | The stat sheet — ten attributes, soft caps, and scaling grades | 20-progression | number | neutral | constructed | high | no | `progression.level.attributes` `ui.menu.levelup` `combat.damage.scaling` `combat.damage.model` | [corpus/20-progression/RI-PRG02-stat-sheet.md](../../corpus/20-progression/RI-PRG02-stat-sheet.md) |
| RI-PRG03 | Skills that improve by use — the 19 skills, their rates, and their gates | 20-progression | number | morrowind | constructed | high | no | `progression.skill.usegrowth` `combat.damage.scaling` `world.locks.security` `progression.crafting.alchemy` `dialogue.persuasion.mechanics` `progression.merchant.barter` | [corpus/20-progression/RI-PRG03-skills-by-use.md](../../corpus/20-progression/RI-PRG03-skills-by-use.md) |
| RI-PRG04 | HEARTH — resting, respawn, spacing, and the death→corpse-run→recovery loop | 20-progression | structure | souls | constructed | medium | no | `progression.bonfire.function` `combat.death.corpserun` `combat.death.worldreset` `world.density.handplacement` `combat.heal.charges` `world.time.daynight` | [corpus/20-progression/RI-PRG04-hearth-and-death.md](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| RI-PRG05 | The gold economy — prices, merchant pools, barter, and the regional balance sheet | 20-progression | number | morrowind | constructed | medium | no | `progression.gold.economy` `progression.merchant.barter` `world.traversal.transport` `progression.training.trainers` | [corpus/20-progression/RI-PRG05-gold-economy.md](../../corpus/20-progression/RI-PRG05-gold-economy.md) |
| RI-PRG06 | Souls yield and the levelling pace curve — per-archetype values, region tiers, expected level | 20-progression | number | souls | constructed | medium | no | `progression.souls.economy` `progression.level.curve` `world.region.gating` `combat.encounter.placement` | [corpus/20-progression/RI-PRG06-souls-yield-and-pace.md](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| RI-PRG07 | Equip load and encumbrance — two ratios, two rulebooks, one breakpoint table | 20-progression | number | neutral | constructed | medium | no | `progression.equipment.encumbrance` `combat.dodge.directional` `world.traversal.time` `progression.fatigue.social` | [corpus/20-progression/RI-PRG07-equip-load-encumbrance.md](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| RI-QST01 | The escalation shape of a Morrowind faction questline | 30-quests | structure | morrowind | community-data | medium | yes | `quests.faction.escalation` `quests.faction.rankgating` `quests.density.count` | [corpus/30-quests/RI-QST01-faction-escalation-shape.md](../../corpus/30-quests/RI-QST01-faction-escalation-shape.md) |
| RI-QST02 | How a questline lies to you — the deceit pattern catalogue | 30-quests | structure | morrowind | canonical-recall | medium | yes | `quests.structure.deceit` `quests.giver.characterisation` `quests.structure.branching` `dialogue.topics.truth` `quests.faction.escalation` | [corpus/30-quests/RI-QST02-deceit-patterns.md](../../corpus/30-quests/RI-QST02-deceit-patterns.md) |
| RI-QST03 | Faction gating — rank requirements, exclusivity, expulsion, lockout | 30-quests | structure | morrowind | community-data | medium | no | `quests.faction.rankgating` `progression.skill.usegrowth` `quests.faction.rivalry` `world.faction.presence` | [corpus/30-quests/RI-QST03-faction-gating.md](../../corpus/30-quests/RI-QST03-faction-gating.md) |
| RI-QST04 | Quest stage anatomy and the canonical quest schema | 30-quests | structure | morrowind | constructed | high | no | `quests.data.schema` `quests.structure.stages` `quests.structure.branching` `journal.entry.numbering` `quests.failure.severed` | [corpus/30-quests/RI-QST04-quest-anatomy-schema.md](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| RI-QST05 | Non-combat resolution — the measurable pacifist fraction and first-class solution verbs | 30-quests | number | morrowind | derived | low | no | `quests.resolution.noncombat` `progression.skill.social` `dialogue.persuasion.mechanics` `quests.data.schema` | [corpus/30-quests/RI-QST05-non-combat-resolution.md](../../corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| RI-QST06 | Main quest architecture — the five-act template and the backpath | 30-quests | structure | morrowind | canonical-recall | medium | yes | `quests.mainline.prophecy` `quests.mainline.acts` `quests.mainline.antagonist` `quests.faction.escalation` `lore.canon.prophecy` | [corpus/30-quests/RI-QST06-main-quest-architecture.md](../../corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| RI-QST07 | Side quest texture — type distribution, density, and the quests you have to overhear | 30-quests | number | morrowind | derived | low | no | `quests.side.texture` `quests.discovery.hooks` `quests.density.count` `world.settlement.anatomy` `dialogue.rumour.distribution` | [corpus/30-quests/RI-QST07-side-quest-texture.md](../../corpus/30-quests/RI-QST07-side-quest-texture.md) |
| RI-QST08 | Reward design — the unique-named fraction and non-item rewards | 30-quests | number | morrowind | community-data | medium | yes | `quests.reward.shape` `world.loot.placement` `progression.inventory.model` `world.property.ownership` | [corpus/30-quests/RI-QST08-reward-design.md](../../corpus/30-quests/RI-QST08-reward-design.md) |
| RI-DLG01 | The topic list as a graph — filter stack, first-match-wins, and settlement topic webs | 40-dialogue | graph | morrowind | community-data | medium | yes | `dialogue.topics.graph` `dialogue.topics.filtering` `dialogue.greeting.variation` `dialogue.topics.discovery` `quests.discovery.hooks` | [corpus/40-dialogue/RI-DLG01-topic-graph.md](../../corpus/40-dialogue/RI-DLG01-topic-graph.md) |
| RI-DLG02 | Unique dialogue words per settlement — the headline density metric | 40-dialogue | number | morrowind | community-data | high | no | `dialogue.density.wordcount` `dialogue.topics.filtering` `world.settlement.anatomy` | [corpus/40-dialogue/RI-DLG02-words-per-settlement.md](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md) |
| RI-DLG03 | Greetings and rumours — disposition banding and the diegetic quest-discovery mechanism | 40-dialogue | text | morrowind | community-data | high | yes | `dialogue.greeting.variation` `dialogue.rumour.distribution` `dialogue.disposition.model` `quests.discovery.hooks` `world.persistence.state` | [corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) |
| RI-WLD01 | World scale, coordinate system and the one-hour traversal budget | 50-world | number | morrowind | constructed | high | no | `world.map.scale` `world.terrain.form` `world.traversal.roads` `world.density.handplacement` `world.traversal.time` `world.traversal.locomotion` | [corpus/50-world/RI-WLD01-scale-and-traversal-budget.md](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| RI-WLD02 | Density per minute of travel — the headline world metric | 50-world | number | morrowind | constructed | high | no | `world.density.handplacement` `combat.encounter.placement` `world.map.legibility` | [corpus/50-world/RI-WLD02-density-per-minute.md](../../corpus/50-world/RI-WLD02-density-per-minute.md) |
| RI-WLD03 | Settlement anatomy — what makes a Morrowind town, and the per-settlement allocation | 50-world | structure | morrowind | constructed | high | yes | `world.settlement.anatomy` `world.interior.named` `render.art.architecture` `world.npc.population` `dialogue.service.merchant` `quests.discovery.hooks` | [corpus/50-world/RI-WLD03-settlement-anatomy.md](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| RI-LOR01 | Black Marsh and Argonian canon dossier — what we may not contradict, and where we must invent | 60-lore | text | morrowind | canonical-recall | medium | no | `lore.canon.registry` `lore.religion.hist` `lore.canon.factions` `lore.canon.history` `world.settlement.anatomy` `quests.mainline.prophecy` `quests.faction.joining` `dialogue.lore.vector` `lore.book.structure` | [corpus/60-lore/RI-LOR01-canon-dossier.md](../../corpus/60-lore/RI-LOR01-canon-dossier.md) |
| RI-LOR02 | Era selection and the political brief — Black Marsh, 3E 427 | 60-lore | text | morrowind | constructed | high | no | `lore.canon.history` `lore.canon.factions` `quests.mainline.prophecy` `quests.faction.joining` `quests.faction.escalation` `dialogue.rumour.distribution` `world.settlement.anatomy` `world.traversal.transport` | [corpus/60-lore/RI-LOR02-era-and-political-brief.md](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| RI-LOR03 | The structure of an Elder Scrolls in-world book — length stats, taxonomy, and six full exemplars | 60-lore | text | morrowind | canonical-recall | medium | yes | `lore.book.structure` `lore.canon.registry` `dialogue.lore.vector` `quests.lore.hooks` `ui.menu.books` | [corpus/60-lore/RI-LOR03-in-world-book-structure.md](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| RI-VIS01 | The bifurcation protocol — art direction and fidelity are judged separately, never together | 70-visual | structure | neutral | constructed | high | no | `render.process.bifurcation` `render.art.palette` `render.fidelity.materials` | [corpus/70-visual/RI-VIS01-bifurcation-protocol.md](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md) |
| RI-VIS02 | Fidelity reference set — current-generation shots we are measured against | 70-visual | image | modern-fidelity | derived | medium | yes | `render.fidelity.lighting` `render.fidelity.materials` `render.fidelity.atmosphere` `render.fidelity.water` `render.fidelity.vegetation` `render.fidelity.sky` `render.fidelity.streaming` | [corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md) |
| RI-VIS03 | Fidelity as measurable quantities — the image-metric battery | 70-visual | number | modern-fidelity | constructed | high | no | `render.fidelity.lighting` `render.fidelity.materials` `render.fidelity.postprocess` `render.fidelity.shadows` `render.fidelity.atmosphere` `render.fidelity.sky` `render.fidelity.streaming` `render.process.measurement` | [corpus/70-visual/RI-VIS03-fidelity-image-metrics.md](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) |
| RI-VIS04 | The renderer feature checklist — what a Three.js scene must have to be modern, and the tell when it doesn't | 70-visual | structure | modern-fidelity | constructed | high | no | `render.fidelity.materials` `render.fidelity.ibl` `render.fidelity.shadows` `render.fidelity.ao` `render.fidelity.postprocess` `render.fidelity.atmosphere` `render.fidelity.water` `render.fidelity.vegetation` `render.fidelity.streaming` `render.fidelity.sky` `render.fidelity.vfx` | [corpus/70-visual/RI-VIS04-renderer-feature-checklist.md](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| RI-VIS05 | Art direction — the Morrowind visual language and its Black Marsh transposition | 70-visual | image | morrowind | canonical-recall | medium | yes | `render.art.palette` `render.art.silhouette` `render.art.architecture` `render.art.flora` `render.art.creature` `render.art.composition` `render.art.materials` `ui.style.diegesis` | [corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| RI-VIS06 | The blind comparison protocol — two protocols, one per side of the bifurcation | 70-visual | structure | neutral | constructed | high | yes | `render.process.bifurcation` `render.art.palette` `render.fidelity.materials` | [corpus/70-visual/RI-VIS06-blind-comparison-protocol.md](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) |

---

## 6. Front-matter and contract problems

_None. Every reference item parses and declares canonical paths._

---

## 7. How to use this index

**Orchestrator, spawning a builder:** look up the piece's subsystem paths in §2,
paste the union of their judging items into `<<REFERENCE_ITEMS>>` of
`BUILDER-PROMPT-TEMPLATE.md`. If any path appears in §3, do not spawn — fill the hole.

**Orchestrator, spawning a critic:** paste the *same* list into `<<REFERENCE_ITEMS>>`
of `CRITIC-PROMPT-TEMPLATE.md`, plus the Method column so the critic knows which
harness to run. Confirm the critic did not build the piece (CRITIC-DOCTRINE §8).

**Critic, mid-verdict:** if your assigned items cannot judge something, write a new
item under the area named in §3, add its `judges:` paths, run
`node tools/corpus-index.mjs`, and list it in your verdict's `corpus_extended`.

**Anyone adding a subsystem path:** append to `corpus/00-doctrine/subsystems.json`
(append-only; never rename in place — a renamed path silently orphans every verdict
that referenced it), then regenerate.
