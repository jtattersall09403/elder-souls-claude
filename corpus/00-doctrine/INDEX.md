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

Generated: 2026-08-05T23:19:39Z

This index satisfies CORPUS-CONTRACT §4. Its rules:

- **Every builder task names its subsystem path**, exactly as spelled here.
- **Every critic is handed exactly the reference items whose `judges:` list contains
  that path** — the "Judging items" column below is the hand-off list.
- **A subsystem with zero judging items is a corpus hole and the builder MUST NOT
  START** until the hole is filled (§4 of the contract, and §5 for how to fill it).

---

## 1. Coverage at a glance

- Canonical subsystem paths: **200**
- Reference items found: **71** across 9 area(s)
- Subsystems with at least one judging reference item: **162**
- Subsystems judged by a doctrine document instead: **7** (see §3b)
- **Corpus holes (no judging item): 31** (16%)
- Front-matter problems: 19 error(s), 0 warning(s)

| Root | Paths | Judged by RI | Judged by doctrine | Holes |
|---|---:|---:|---:|---:|
| `combat.*` | 48 | 39 | 0 | 9 |
| `progression.*` | 18 | 15 | 0 | 3 |
| `quests.*` | 22 | 19 | 0 | 3 |
| `dialogue.*` | 14 | 14 | 0 | 0 |
| `journal.*` | 4 | 4 | 0 | 0 |
| `world.*` | 31 | 26 | 0 | 5 |
| `lore.*` | 10 | 7 | 0 | 3 |
| `render.*` | 25 | 24 | 0 | 1 |
| `audio.*` | 4 | 1 | 0 | 3 |
| `ui.*` | 8 | 6 | 0 | 2 |
| `platform.*` | 6 | 4 | 0 | 2 |
| `coherence.*` | 8 | 1 | 7 | 0 |
| `process.*` | 2 | 2 | 0 | 0 |

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
| `combat.dodge.directional` | Directional roll semantics under lock-on, including backstep | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md)<br>[RI-CMB06](../../corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md)<br>[RI-CMB07](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md)<br>[RI-CAM04](../../corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md)<br>[RI-PRG07](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs<br>in-item M1–M8 (8 checks); corpus/80-methods/m-cmb06-lockon.mjs<br>in-item M0–M4 (5 checks); corpus/80-methods/m-cmb07-expand.mjs<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cam04-locked-movement.mjs<br>in-item procedure (kind: number) |
| `combat.dodge.recovery` | Post-roll recovery and roll-spam punishment | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.stamina.costs` | Stamina cost table per action | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md)<br>[RI-CMB07](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs<br>in-item M0–M4 (5 checks); corpus/80-methods/m-cmb07-expand.mjs |
| `combat.stamina.regen` | Regen rate and post-spend regen delay | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs |
| `combat.stamina.block` | Guard stamina drain, guard break, stability | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs |
| `combat.stamina.exhaustion` | Zero-stamina state and its punish window | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.hitbox.sweep` | Weapon hit volumes swept along the arc across the active window | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-CMB04](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cmb04-hitgeometry.mjs |
| `combat.hitbox.hurtbox` | Hurtboxes bound to and moving with animated bones | souls | [RI-CMB04](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb04-hitgeometry.mjs |
| `combat.hitbox.resolution` | Deterministic geometric hit resolution — NO to-hit roll (seam S1) | split | [RI-CMB04](../../corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md)<br>[RI-CMB07](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb04-hitgeometry.mjs<br>in-item M0–M4 (5 checks); corpus/80-methods/m-cmb07-expand.mjs |
| `combat.damage.model` | Damage formula, defences, absorption | souls | [RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md)<br>[RI-PRG08](../../corpus/20-progression/RI-PRG08-upgrade-path.md) | `critic.combat` | in-item procedure (kind: number)<br>in-item procedure (kind: number) |
| `combat.damage.scaling` | How stats and skills scale damage (seam S3: scaling, never to-hit) | split | [RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md)<br>[RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md) | `critic.combat` | in-item procedure (kind: number)<br>in-item procedure (kind: number) |
| `combat.poise.player` | Player poise / hyperarmour and stagger-out | souls | [RI-CMB05](../../corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) | `critic.combat` | in-item M1–M8 (8 checks); corpus/80-methods/m-cmb05-poise.mjs |
| `combat.poise.enemy` | Enemy poise breaking, stagger, critical-hit opening | souls | [RI-AI03](../../corpus/10-combat/RI-AI03-punish-windows.md)<br>[RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-CMB05](../../corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) | `critic.combat` | in-item M1–M8 (8 checks)<br>in-item M1–M8 (8 checks)<br>in-item M1–M8 (8 checks); corpus/80-methods/m-cmb05-poise.mjs |
| `combat.block.guard` | Blocking, chip damage, guard angle | souls | [RI-CMB03](../../corpus/10-combat/RI-CMB03-stamina-economy.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cmb03-stamina.mjs |
| `combat.block.parry` | Parry window, riposte, backstab | souls | [RI-CMB05](../../corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) | `critic.combat` | in-item M1–M8 (8 checks); corpus/80-methods/m-cmb05-poise.mjs |
| `combat.attack.moveset` | Per-weapon-class moveset shape (R1/R2 chains, running, rolling) | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md)<br>[RI-CMB07](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs<br>in-item M0–M4 (5 checks); corpus/80-methods/m-cmb07-expand.mjs |
| `combat.attack.commitment` | Root-motion-authoritative committed attacks; no instant turn during a swing | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-AI03](../../corpus/10-combat/RI-AI03-punish-windows.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md)<br>[RI-CMB08](../../corpus/10-combat/RI-CMB08-healing-flask.md)<br>[RI-CAM04](../../corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md)<br>[RI-VIS08](../../corpus/70-visual/RI-VIS08-character-animation-fidelity.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M8 (8 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs<br>in-item M1–M8 (8 checks); corpus/80-methods/m-cmb08-estus.mjs<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cam04-locked-movement.mjs<br>in-item procedure (kind: number); corpus/80-methods/capture-trace.mjs, corpus/80-methods/anim-metrics.mjs |
| `combat.attack.charge` | Charged heavy attacks and their risk/reward | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.attack.tracking` | How much an attack may turn during startup, and not at all after | souls | [RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md)<br>[RI-CMB06](../../corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md)<br>[RI-CAM04](../../corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md) | `critic.combat` | in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs<br>in-item M1–M8 (8 checks); corpus/80-methods/m-cmb06-lockon.mjs<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cam04-locked-movement.mjs |
| `combat.dodge.equipload` | Equip load changing roll type, distance, and recovery | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs |
| `combat.player.movement` | In-fight locomotion: run, strafe, backstep, and their speeds | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md)<br>[RI-CMB06](../../corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md)<br>[RI-CAM02](../../corpus/15-camera/RI-CAM02-free-camera-and-movement-mapping.md)<br>[RI-CAM04](../../corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs<br>in-item M1–M8 (8 checks); corpus/80-methods/m-cmb06-lockon.mjs<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cam02-control.mjs<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cam04-locked-movement.mjs |
| `combat.weapon.identity` | Weapon classes feel categorically different to hold and swing | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.lockon.target` | Hard target lock acquisition, range, break conditions | souls | [RI-CMB06](../../corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md)<br>[RI-CAM03](../../corpus/15-camera/RI-CAM03-lock-on-framing.md) | `critic.combat` | in-item M1–M8 (8 checks); corpus/80-methods/m-cmb06-lockon.mjs<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cam03-lockon-framing.mjs |
| `combat.lockon.switch` | Target switching between multiple hostiles | souls | [RI-CAM03](../../corpus/15-camera/RI-CAM03-lock-on-framing.md) | `critic.combat` | in-item M1–M7 (7 checks); corpus/80-methods/m-cam03-lockon-framing.mjs |
| `combat.camera.behaviour` | Combat camera framing, collision, and lock-on pivot | souls | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md)<br>[RI-CMB06](../../corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md)<br>[RI-CAM01](../../corpus/15-camera/RI-CAM01-rig-geometry-and-spring-arm.md)<br>[RI-CAM02](../../corpus/15-camera/RI-CAM02-free-camera-and-movement-mapping.md)<br>[RI-CAM03](../../corpus/15-camera/RI-CAM03-lock-on-framing.md)<br>[RI-CAM05](../../corpus/15-camera/RI-CAM05-camera-outside-the-fight.md)<br>[RI-CAM06](../../corpus/15-camera/RI-CAM06-camera-feel.md)<br>[RI-MTH01](../../corpus/80-methods/RI-MTH01-harness-api-surface.md) | `critic.combat` | in-item M1–M11 (11 checks)<br>in-item M1–M8 (8 checks); corpus/80-methods/m-cmb06-lockon.mjs<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cam01-rig.mjs<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cam02-control.mjs<br>in-item M1–M7 (7 checks); corpus/80-methods/m-cam03-lockon-framing.mjs<br>in-item M0–M7 (8 checks); corpus/80-methods/m-cam05-world-camera.mjs<br>in-item M1–M9 (9 checks); corpus/80-methods/m-cam06-feel.mjs<br>in-item M1–M7 (7 checks); tools/harness/smoke.mjs, tools/harness/run-headless.mjs, tools/lib/browser.mjs |
| `combat.enemy.perception` | Sight cone, LOS, alert ladder, cost-of-entry aggro | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md) | `critic.combat` | in-item M1–M9 (9 checks) |
| `combat.enemy.statemachine` | Enemy AI states and legal transitions | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md) | `critic.combat` | in-item M1–M9 (9 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M8 (8 checks) |
| `combat.enemy.movement` | Approach, spacing bands, strafing, gap closing | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md) | `critic.combat` | in-item M1–M9 (9 checks) |
| `combat.enemy.telegraph` | Readable windups; no untelegraphed instant attacks | souls | [RI-AI02](../../corpus/10-combat/RI-AI02-telegraph-doctrine.md)<br>[RI-AI04](../../corpus/10-combat/RI-AI04-attack-strings-and-delays.md)<br>[RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md) | `critic.combat` | in-item M1–M7 (7 checks)<br>in-item M1–M10 (10 checks)<br>in-item M1–M11 (11 checks) |
| `combat.enemy.punish` | Punish windows both ways: enemy recovery, player heal-read | souls | [RI-AI03](../../corpus/10-combat/RI-AI03-punish-windows.md)<br>[RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md)<br>[RI-CMB07](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) | `critic.combat` | in-item M1–M8 (8 checks)<br>in-item M1–M11 (11 checks)<br>in-item M0–M4 (5 checks); corpus/80-methods/m-cmb07-expand.mjs |
| `combat.enemy.leash` | De-aggro, leash return, world reset, no invulnerable walk-home | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md) | `critic.combat` | in-item M1–M9 (9 checks) |
| `combat.encounter.grouping` | Multi-enemy token arbitration; no gang-pile, no frozen queue | souls | [RI-AI01](../../corpus/10-combat/RI-AI01-aggro-approach-spacing.md)<br>[RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-CMB07](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) | `critic.combat` | in-item M1–M9 (9 checks)<br>in-item M1–M8 (8 checks)<br>in-item M1–M10 (10 checks)<br>in-item M0–M4 (5 checks); corpus/80-methods/m-cmb07-expand.mjs |
| `combat.encounter.placement` | Hand-placed encounter composition and ambush legibility | souls | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md)<br>[RI-WLD02](../../corpus/50-world/RI-WLD02-density-per-minute.md)<br>[RI-WLD07](../../corpus/50-world/RI-WLD07-verticality-and-interiors.md) | `critic.combat` | in-item M1–M10 (10 checks)<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item M6–M11 (6 checks)<br>in-item M33–M39 (7 checks) |
| `combat.boss.phases` | Boss phase transitions and moveset expansion | souls | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md) | `critic.combat` | in-item M1–M11 (11 checks) |
| `combat.boss.arena` | Boss arena shape, fog gate, retry loop | souls | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md)<br>[RI-CAM06](../../corpus/15-camera/RI-CAM06-camera-feel.md) | `critic.combat` | in-item M1–M11 (11 checks)<br>in-item M1–M9 (9 checks); corpus/80-methods/m-cam06-feel.mjs |
| `combat.heal.charges` | Estus-equivalent: finite charges, animation commitment, refill at rest | souls | [RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.combat` | in-item procedure (kind: structure) |
| `combat.status.buildup` | In-fight status meters and procs (seam S11 Souls half) | split | **— HOLE —** | `critic.combat` | _none_ |
| `combat.magic.casting` | Spellcasting inside the fight: cast frames, commitment, resource | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.death.corpserun` | Souls dropped on death, recoverable at the death spot, lost on second death | souls | [RI-CAM06](../../corpus/15-camera/RI-CAM06-camera-feel.md)<br>[RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.combat` | in-item M1–M9 (9 checks); corpus/80-methods/m-cam06-feel.mjs<br>in-item procedure (kind: structure) |
| `combat.death.worldreset` | Rest/death resets ordinary enemies; named actors never respawn (seam S5) | split | [RI-AI06](../../corpus/10-combat/RI-AI06-boss-design.md)<br>[RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.combat` | in-item M1–M11 (11 checks)<br>in-item M1–M10 (10 checks)<br>in-item procedure (kind: structure) |
| `combat.input.buffer` | Input buffering window and queue semantics | souls | [RI-CMB01](../../corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md)<br>[RI-CMB02](../../corpus/10-combat/RI-CMB02-attack-frame-data.md) | `critic.combat` | in-item M1–M5 (5 checks); corpus/80-methods/m-cmb01-roll-iframes.mjs<br>in-item M1–M6 (6 checks); corpus/80-methods/m-cmb02-frame-data.mjs |
| `combat.input.latency` | Press-to-first-active-frame latency | souls | **— HOLE —** | `critic.combat` | _none_ |
| `combat.feedback.hitstop` | Hitstop, impact vfx/sfx, damage legibility | souls | [RI-CAM06](../../corpus/15-camera/RI-CAM06-camera-feel.md)<br>[RI-MTH03](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) | `critic.combat` | in-item M1–M9 (9 checks); corpus/80-methods/m-cam06-feel.mjs<br>in-item M1–M6 (6 checks); tools/blind/make-pair.mjs |
| `combat.difficulty.lethality` | Regions gated by lethality; NO level-scaling to the player (seam S9) | souls | [RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-WLD04](../../corpus/50-world/RI-WLD04-region-identity.md) | `critic.combat` | in-item M1–M8 (8 checks)<br>in-item M17–M21 (5 checks) |
| `combat.pause.policy` | World does not pause during combat; inventory is not a safe haven (seam S14) | souls | **— HOLE —** | `critic.combat` | _none_ |

### `progression.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `progression.level.curve` | Soul cost per level, single soft-cap curve, bonfire level-up (seam S2) | split | [RI-PRG01](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) | `critic.progression` | in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md |
| `progression.level.attributes` | Breadth of the stat sheet: attributes shaping build identity beyond weapon class | morrowind | [RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md) | `critic.progression` | in-item procedure (kind: number) |
| `progression.skill.usegrowth` | Skills improve by use (seam S3) | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md)<br>[RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md)<br>[RI-DLG04](../../corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md) | `critic.progression` | in-item procedure (kind: number)<br>in-item procedure (kind: structure)<br>in-item procedure (kind: number); tools/corpus/disposition-oracle.mjs, tools/corpus/dump-engine-disposition.mjs, tools/corpus/dump-dialogue.mjs |
| `progression.skill.gating` | Skills gate access and utility, never to-hit | morrowind | **— HOLE —** | `critic.progression` | _none_ |
| `progression.build.identity` | Two different builds play observably differently out of the fight, not only in it | morrowind | **— HOLE —** | `critic.progression` | _none_ |
| `progression.souls.economy` | Souls level you and ONLY level you (seam S15) | neutral | [RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-PRG01](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) | `critic.progression` | in-item M1–M8 (8 checks)<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md |
| `progression.gold.economy` | Gold is the only currency: merchants, bribes, training, travel, repairs | morrowind | [RI-PRG05](../../corpus/20-progression/RI-PRG05-gold-economy.md)<br>[RI-DLG04](../../corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md) | `critic.progression` | in-item procedure (kind: number)<br>in-item procedure (kind: number); tools/corpus/disposition-oracle.mjs, tools/corpus/dump-engine-disposition.mjs, tools/corpus/dump-dialogue.mjs |
| `progression.merchant.barter` | Merchant gold pools, barter, disposition-affected prices | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md)<br>[RI-PRG05](../../corpus/20-progression/RI-PRG05-gold-economy.md) | `critic.progression` | in-item procedure (kind: number)<br>in-item procedure (kind: number) |
| `progression.bonfire.function` | What resting does and does not do (checkpoint + level-up, never teleport) | split | [RI-CAM05](../../corpus/15-camera/RI-CAM05-camera-outside-the-fight.md)<br>[RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) | `critic.progression` | in-item M0–M7 (8 checks); corpus/80-methods/m-cam05-world-camera.mjs<br>in-item procedure (kind: structure) |
| `progression.bonfire.placement` | Spacing and siting of rest points relative to danger | souls | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-WLD07](../../corpus/50-world/RI-WLD07-verticality-and-interiors.md)<br>[RI-LOR05](../../corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md) | `critic.progression` | in-item M1–M10 (10 checks)<br>in-item M33–M39 (7 checks)<br>in-item procedure (kind: text) |
| `progression.equipment.upgrade` | Weapon upgrade paths and materials | souls | [RI-PRG08](../../corpus/20-progression/RI-PRG08-upgrade-path.md) | `critic.progression` | in-item procedure (kind: number) |
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
| `quests.structure.stages` | Multi-stage quests with real intermediate state | morrowind | [RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md)<br>[RI-DLG05](../../corpus/40-dialogue/RI-DLG05-journal.md)<br>[RI-MTH03](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: text); tools/corpus/dump-journal.mjs<br>in-item M1–M6 (6 checks); tools/blind/make-pair.mjs |
| `quests.structure.branching` | Branch points that survive to different endings, not cosmetic choice | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md)<br>[RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: structure) |
| `quests.structure.deceit` | Quest-givers who lie, omit, or use the player | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.resolution.noncombat` | Quests resolvable by talk, bribe, sneak, theft, or lore knowledge | morrowind | [RI-QST05](../../corpus/30-quests/RI-QST05-non-combat-resolution.md) | `critic.quests` | in-item procedure (kind: number) |
| `quests.resolution.exclusive` | Mutually exclusive resolutions that permanently close doors | morrowind | **— HOLE —** | `critic.quests` | _none_ |
| `quests.faction.joining` | How you join, and that joining means something | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md)<br>[RI-LOR06](../../corpus/60-lore/RI-LOR06-contradiction-discipline.md) | `critic.quests` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text)<br>in-item procedure (kind: structure); corpus/80-methods/canon-check.py |
| `quests.faction.rankgating` | Rank requirements on skills AND attributes | morrowind | [RI-QST01](../../corpus/30-quests/RI-QST01-faction-escalation-shape.md)<br>[RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: structure) |
| `quests.faction.escalation` | Errands escalate to politics escalate to power over the faction | morrowind | [RI-QST01](../../corpus/30-quests/RI-QST01-faction-escalation-shape.md)<br>[RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md)<br>[RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: structure)<br>in-item procedure (kind: structure)<br>in-item procedure (kind: text) |
| `quests.faction.rivalry` | Faction rivalry locks: advancing here costs you there | morrowind | [RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.faction.expulsion` | Expulsion, disgrace, and the path back | morrowind | **— HOLE —** | `critic.quests` | _none_ |
| `quests.mainline.prophecy` | Main quest shape: prophecy, doubt, and earned legitimacy | morrowind | [RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md)<br>[RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md)<br>[RI-LOR05](../../corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md)<br>[RI-LOR06](../../corpus/60-lore/RI-LOR06-contradiction-discipline.md) | `critic.quests` | in-item procedure (kind: structure)<br>in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text)<br>in-item procedure (kind: text)<br>in-item procedure (kind: structure); corpus/80-methods/canon-check.py |
| `quests.giver.characterisation` | Quest-givers are people with agendas, not dispensers | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.reward.shape` | Rewards are specific, named, sometimes worse than promised | morrowind | [RI-QST08](../../corpus/30-quests/RI-QST08-reward-design.md) | `critic.quests` | in-item procedure (kind: number) |
| `quests.failure.severed` | Killable quest NPCs; thread-of-prophecy-severed instead of game over (seam S10) | morrowind | [RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) | `critic.quests` | in-item procedure (kind: structure) |
| `quests.discovery.hooks` | Quests found through rumour and overheard talk, not a quest board | morrowind | [RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md)<br>[RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md)<br>[RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) | `critic.quests` | in-item procedure (kind: number)<br>in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs, tools/corpus/probe-combat-dialogue.mjs<br>in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs<br>in-item M12–M16 (5 checks) |
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
| `dialogue.topics.graph` | Topic-list dialogue with a real graph behind it | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs, tools/corpus/probe-combat-dialogue.mjs |
| `dialogue.topics.discovery` | Keyword discovery: topics unlock by being told about them | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs, tools/corpus/probe-combat-dialogue.mjs |
| `dialogue.topics.filtering` | Same topic, different answer by faction/race/rank/disposition/place | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md)<br>[RI-DLG02](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md)<br>[RI-DLG04](../../corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs, tools/corpus/probe-combat-dialogue.mjs<br>in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs, tools/corpus/dump-npcs.mjs<br>in-item procedure (kind: number); tools/corpus/disposition-oracle.mjs, tools/corpus/dump-engine-disposition.mjs, tools/corpus/dump-dialogue.mjs |
| `dialogue.disposition.model` | Disposition as a real number with real consequences | morrowind | [RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md)<br>[RI-DLG04](../../corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md) | `critic.dialogue` | in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs<br>in-item procedure (kind: number); tools/corpus/disposition-oracle.mjs, tools/corpus/dump-engine-disposition.mjs, tools/corpus/dump-dialogue.mjs |
| `dialogue.persuasion.mechanics` | Admire / intimidate / taunt / bribe and their risks | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md)<br>[RI-QST05](../../corpus/30-quests/RI-QST05-non-combat-resolution.md)<br>[RI-DLG04](../../corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md) | `critic.dialogue` | in-item procedure (kind: number)<br>in-item procedure (kind: number)<br>in-item procedure (kind: number); tools/corpus/disposition-oracle.mjs, tools/corpus/dump-engine-disposition.mjs, tools/corpus/dump-dialogue.mjs |
| `dialogue.rumour.distribution` | Rumours differ per town and per class, and point at real content | morrowind | [RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md)<br>[RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md)<br>[RI-DLG07](../../corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.dialogue` | in-item procedure (kind: number)<br>in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs<br>in-item procedure (kind: text)<br>in-item procedure (kind: text) |
| `dialogue.voice.register` | Prose quality and register: does it read like Morrowind or like filler | morrowind | [RI-DLG06](../../corpus/40-dialogue/RI-DLG06-voice-differentiation.md)<br>[RI-DLG07](../../corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md)<br>[RI-LOR04](../../corpus/60-lore/RI-LOR04-naming-and-language.md)<br>[RI-MTH03](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) | `critic.dialogue` | in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs<br>in-item procedure (kind: text)<br>in-item procedure (kind: structure); corpus/80-methods/jel-phonotactics.py<br>in-item M1–M6 (6 checks); tools/blind/make-pair.mjs |
| `dialogue.npc.identity` | An NPC reads as a specific person with a specific position | morrowind | [RI-DLG06](../../corpus/40-dialogue/RI-DLG06-voice-differentiation.md)<br>[RI-DLG07](../../corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md) | `critic.dialogue` | in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs<br>in-item procedure (kind: text) |
| `dialogue.greeting.variation` | Greetings vary by state, place, and standing | morrowind | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md)<br>[RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md)<br>[RI-DLG07](../../corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs, tools/corpus/probe-combat-dialogue.mjs<br>in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs<br>in-item procedure (kind: text) |
| `dialogue.service.merchant` | Barter, training, repair, transport conducted through dialogue | morrowind | [RI-DLG04](../../corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) | `critic.dialogue` | in-item procedure (kind: number); tools/corpus/disposition-oracle.mjs, tools/corpus/dump-engine-disposition.mjs, tools/corpus/dump-dialogue.mjs<br>in-item M12–M16 (5 checks) |
| `dialogue.combat.lockout` | Topic lists locked during COMBAT; enemies shout, not converse (seam S13) | souls | [RI-DLG01](../../corpus/40-dialogue/RI-DLG01-topic-graph.md) | `critic.dialogue` | in-item procedure (kind: graph); tools/corpus/dump-dialogue-graph.mjs, tools/corpus/probe-combat-dialogue.mjs |
| `dialogue.lore.vector` | NPC dialogue, not item descriptions, is the primary lore vector (AR-2) | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md)<br>[RI-LOR05](../../corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md)<br>[RI-LOR06](../../corpus/60-lore/RI-LOR06-contradiction-discipline.md) | `critic.dialogue` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text); corpus/80-methods/book-stats.py<br>in-item procedure (kind: text)<br>in-item procedure (kind: structure); corpus/80-methods/canon-check.py |
| `dialogue.density.wordcount` | Volume of authored dialogue per NPC, settlement, and region | morrowind | [RI-DLG02](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md) | `critic.dialogue` | in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs, tools/corpus/dump-npcs.mjs |
| `dialogue.topics.truth` | NPCs may be wrong or lying inside a topic answer, discoverably | morrowind | [RI-QST02](../../corpus/30-quests/RI-QST02-deceit-patterns.md)<br>[RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) | `critic.dialogue` | in-item procedure (kind: structure)<br>in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs |

### `journal.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `journal.entry.voice` | First-person-authored journal prose written by the character | morrowind | [RI-DLG05](../../corpus/40-dialogue/RI-DLG05-journal.md)<br>[RI-DLG07](../../corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md)<br>[RI-WLD06](../../corpus/50-world/RI-WLD06-navigation-without-markers.md) | `critic.journal` | in-item procedure (kind: text); tools/corpus/dump-journal.mjs<br>in-item procedure (kind: text)<br>in-item M27–M32 (6 checks) |
| `journal.entry.numbering` | Numbered, dated, append-only entries with stable indices | morrowind | [RI-QST04](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md)<br>[RI-DLG05](../../corpus/40-dialogue/RI-DLG05-journal.md) | `critic.journal` | in-item procedure (kind: structure)<br>in-item procedure (kind: text); tools/corpus/dump-journal.mjs |
| `journal.entry.directions` | Directions carried in prose: landmarks, distances, named people (seam S8) | morrowind | [RI-DLG05](../../corpus/40-dialogue/RI-DLG05-journal.md)<br>[RI-WLD06](../../corpus/50-world/RI-WLD06-navigation-without-markers.md) | `critic.journal` | in-item procedure (kind: text); tools/corpus/dump-journal.mjs<br>in-item M27–M32 (6 checks) |
| `journal.navigation.nomarkers` | No compass markers, no objective arrows, anywhere | morrowind | [RI-DLG05](../../corpus/40-dialogue/RI-DLG05-journal.md) | `critic.journal` | in-item procedure (kind: text); tools/corpus/dump-journal.mjs |

### `world.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `world.region.identity` | Each region is instantly identifiable from one screenshot | morrowind | [RI-WLD04](../../corpus/50-world/RI-WLD04-region-identity.md) | `critic.world` | in-item M17–M21 (5 checks) |
| `world.region.transition` | Borders between regions read as a change, not a texture swap | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.region.gating` | Region access gated by lethality and knowledge, not by level checks | souls | [RI-AI05](../../corpus/10-combat/RI-AI05-roster-archetypes.md)<br>[RI-PRG06](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) | `critic.world` | in-item M1–M8 (8 checks)<br>in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md |
| `world.map.scale` | Absolute world size and the time it takes to cross | morrowind | [RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.map.legibility` | Navigable by landmark and memory; the map is a drawing, not a GPS | morrowind | [RI-WLD02](../../corpus/50-world/RI-WLD02-density-per-minute.md)<br>[RI-WLD06](../../corpus/50-world/RI-WLD06-navigation-without-markers.md) | `critic.world` | in-item M6–M11 (6 checks)<br>in-item M27–M32 (6 checks) |
| `world.density.handplacement` | Hand-placed density: things per 100m that reward walking | morrowind | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md)<br>[RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md)<br>[RI-WLD02](../../corpus/50-world/RI-WLD02-density-per-minute.md) | `critic.world` | in-item M1–M10 (10 checks)<br>in-item procedure (kind: structure)<br>in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md<br>in-item M6–M11 (6 checks) |
| `world.settlement.anatomy` | What a settlement contains and how it is laid out | morrowind | [RI-QST07](../../corpus/30-quests/RI-QST07-side-quest-texture.md)<br>[RI-DLG02](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md)<br>[RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md)<br>[RI-LOR04](../../corpus/60-lore/RI-LOR04-naming-and-language.md)<br>[RI-LOR06](../../corpus/60-lore/RI-LOR06-contradiction-discipline.md) | `critic.world` | in-item procedure (kind: number)<br>in-item procedure (kind: number); tools/corpus/dump-dialogue.mjs, tools/corpus/dump-npcs.mjs<br>in-item M12–M16 (5 checks)<br>in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text)<br>in-item procedure (kind: structure); corpus/80-methods/jel-phonotactics.py<br>in-item procedure (kind: structure); corpus/80-methods/canon-check.py |
| `world.interior.named` | Named interiors with owners, contents, and reasons to exist | morrowind | [RI-CAM05](../../corpus/15-camera/RI-CAM05-camera-outside-the-fight.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md)<br>[RI-WLD07](../../corpus/50-world/RI-WLD07-verticality-and-interiors.md) | `critic.world` | in-item M0–M7 (8 checks); corpus/80-methods/m-cam05-world-camera.mjs<br>in-item M12–M16 (5 checks)<br>in-item M33–M39 (7 checks) |
| `world.interior.continuity` | Interiors match their exteriors in size, orientation, and light | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.dungeon.design` | Dungeon and interior layout: loops, shortcuts, unlocks, and dead ends | souls | [RI-CAM05](../../corpus/15-camera/RI-CAM05-camera-outside-the-fight.md)<br>[RI-WLD07](../../corpus/50-world/RI-WLD07-verticality-and-interiors.md) | `critic.world` | in-item M0–M7 (8 checks); corpus/80-methods/m-cam05-world-camera.mjs<br>in-item M33–M39 (7 checks) |
| `world.traversal.time` | Traversal time budgets between named places | morrowind | [RI-PRG07](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md)<br>[RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item procedure (kind: number)<br>in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.traversal.transport` | In-fiction transport network only; no warp-to-pin (seam S7) | morrowind | [RI-PRG05](../../corpus/20-progression/RI-PRG05-gold-economy.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md)<br>[RI-LOR05](../../corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md) | `critic.world` | in-item procedure (kind: number)<br>in-item procedure (kind: text)<br>in-item procedure (kind: text) |
| `world.wayfinding.directions` | Getting there from prose directions actually works | morrowind | [RI-DLG05](../../corpus/40-dialogue/RI-DLG05-journal.md)<br>[RI-WLD06](../../corpus/50-world/RI-WLD06-navigation-without-markers.md) | `critic.world` | in-item procedure (kind: text); tools/corpus/dump-journal.mjs<br>in-item M27–M32 (6 checks) |
| `world.strangeness.flora` | Alien plant life that is not a European forest | morrowind | [RI-WLD04](../../corpus/50-world/RI-WLD04-region-identity.md)<br>[RI-WLD05](../../corpus/50-world/RI-WLD05-strangeness-bar.md) | `critic.world` | in-item M17–M21 (5 checks)<br>in-item M22–M26 (5 checks) |
| `world.strangeness.fauna` | Alien animals and their behaviour in the world | morrowind | [RI-WLD05](../../corpus/50-world/RI-WLD05-strangeness-bar.md) | `critic.world` | in-item M22–M26 (5 checks) |
| `world.strangeness.architecture` | Buildings that could not be anywhere else | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.strangeness.budget` | Overall strangeness budget: how alien the world reads per hour of play | morrowind | [RI-WLD05](../../corpus/50-world/RI-WLD05-strangeness-bar.md) | `critic.world` | in-item M22–M26 (5 checks) |
| `world.hazard.environment` | Swamp, blight, drowning, disease vectors as world hazards | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.water.marsh` | Black Marsh specifically: water, tide, mud, depth, and its cost to cross | morrowind | **— HOLE —** | `critic.world` | _none_ |
| `world.weather.systems` | Weather: rain, storm, mist, and what it changes in play | morrowind | [RI-WLD04](../../corpus/50-world/RI-WLD04-region-identity.md)<br>[RI-WLD08](../../corpus/50-world/RI-WLD08-the-living-world.md) | `critic.world` | in-item M17–M21 (5 checks)<br>in-item M40–M46 (7 checks) |
| `world.loot.placement` | Hand-placed, named, weird loot; no procedural drop tables (seam S12) | morrowind | [RI-PRG08](../../corpus/20-progression/RI-PRG08-upgrade-path.md)<br>[RI-QST08](../../corpus/30-quests/RI-QST08-reward-design.md) | `critic.world` | in-item procedure (kind: number)<br>in-item procedure (kind: number) |
| `world.npc.population` | Who lives here, in what numbers, doing what | morrowind | [RI-AI07](../../corpus/10-combat/RI-AI07-encounter-composition.md)<br>[RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) | `critic.world` | in-item M1–M10 (10 checks)<br>in-item M12–M16 (5 checks) |
| `world.persistence.state` | Dropped, moved, and taken things stay that way | morrowind | [RI-DLG03](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) | `critic.world` | in-item procedure (kind: text); tools/corpus/dump-dialogue.mjs |
| `world.traversal.roads` | Roads, boardwalks and paths as the readable skeleton of the map | morrowind | [RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md)<br>[RI-WLD06](../../corpus/50-world/RI-WLD06-navigation-without-markers.md) | `critic.world` | in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md<br>in-item M27–M32 (6 checks) |
| `world.traversal.locomotion` | Player movement speeds out of the fight, which set every traversal budget | morrowind | [RI-CAM02](../../corpus/15-camera/RI-CAM02-free-camera-and-movement-mapping.md)<br>[RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) | `critic.world` | in-item M1–M7 (7 checks); corpus/80-methods/m-cam02-control.mjs<br>in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md |
| `world.terrain.form` | Terrain shape, elevation, and how it channels movement | morrowind | [RI-WLD01](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md)<br>[RI-WLD04](../../corpus/50-world/RI-WLD04-region-identity.md)<br>[RI-WLD07](../../corpus/50-world/RI-WLD07-verticality-and-interiors.md) | `critic.world` | in-item M1–M5 (5 checks); corpus/80-methods/M-WLD-walkprobe.md<br>in-item M17–M21 (5 checks)<br>in-item M33–M39 (7 checks) |
| `world.verticality.layout` | Vertical level design: what you can see, climb, fall from, and drop into | souls | [RI-WLD07](../../corpus/50-world/RI-WLD07-verticality-and-interiors.md) | `critic.world` | in-item M33–M39 (7 checks) |
| `world.time.daynight` | Time of day, its length, and what actually changes with it | morrowind | [RI-PRG04](../../corpus/20-progression/RI-PRG04-hearth-and-death.md)<br>[RI-WLD08](../../corpus/50-world/RI-WLD08-the-living-world.md) | `critic.world` | in-item procedure (kind: structure)<br>in-item M40–M46 (7 checks) |
| `world.property.ownership` | Owned things, theft, witnesses, and consequence | morrowind | [RI-QST08](../../corpus/30-quests/RI-QST08-reward-design.md) | `critic.world` | in-item procedure (kind: number) |
| `world.locks.security` | Locks, security ratings, picking, and the alternatives to picking | morrowind | [RI-PRG03](../../corpus/20-progression/RI-PRG03-skills-by-use.md) | `critic.world` | in-item procedure (kind: number) |
| `world.faction.presence` | Which factions hold which places, visibly, on the ground | morrowind | [RI-QST03](../../corpus/30-quests/RI-QST03-faction-gating.md) | `critic.world` | in-item procedure (kind: structure) |

### `lore.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `lore.canon.registry` | The canon-facts registry itself, including the `disputed` flag | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md)<br>[RI-LOR06](../../corpus/60-lore/RI-LOR06-contradiction-discipline.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text); corpus/80-methods/book-stats.py<br>in-item procedure (kind: structure); corpus/80-methods/canon-check.py |
| `lore.canon.argonian` | Argonian culture, Hist, naming, biology, outsider perception | morrowind | **— HOLE —** | `critic.lore` | _none_ |
| `lore.canon.geography` | Black Marsh geography and place-names against canon | morrowind | **— HOLE —** | `critic.lore` | _none_ |
| `lore.canon.history` | Deep-time history and its visible residue | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text) |
| `lore.book.structure` | In-world books: length, form, authorial voice | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md)<br>[RI-LOR04](../../corpus/60-lore/RI-LOR04-naming-and-language.md)<br>[RI-LOR06](../../corpus/60-lore/RI-LOR06-contradiction-discipline.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text); corpus/80-methods/book-stats.py<br>in-item procedure (kind: structure); corpus/80-methods/jel-phonotactics.py<br>in-item procedure (kind: structure); corpus/80-methods/canon-check.py |
| `lore.book.unreliability` | Sources contradict each other on purpose and are traceable to a bias | morrowind | **— HOLE —** | `critic.lore` | _none_ |
| `lore.naming.conventions` | Names of people, places, and things obey a consistent phonology | morrowind | [RI-LOR04](../../corpus/60-lore/RI-LOR04-naming-and-language.md) | `critic.lore` | in-item procedure (kind: structure); corpus/80-methods/jel-phonotactics.py |
| `lore.religion.hist` | The Hist as an actual force in the world, not decoration | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py |
| `lore.canon.factions` | Who holds power, in canon: factions, politics, and their era | morrowind | [RI-LOR01](../../corpus/60-lore/RI-LOR01-canon-dossier.md)<br>[RI-LOR02](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) | `critic.lore` | in-item procedure (kind: text); corpus/80-methods/canon-check.py<br>in-item procedure (kind: text) |
| `lore.canon.prophecy` | Prophecy as a lore object: its text, its readers, and their disagreement | morrowind | [RI-QST06](../../corpus/30-quests/RI-QST06-main-quest-architecture.md) | `critic.lore` | in-item procedure (kind: structure) |

### `render.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `render.fidelity.lighting` | Direct/indirect lighting quality vs modern references | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs |
| `render.fidelity.shadows` | Shadow resolution, contact hardening, acne/peter-panning | modern-fidelity | [RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.materials` | PBR material response, roughness variation, no plastic look | modern-fidelity | [RI-VIS01](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md)<br>[RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md)<br>[RI-VIS06](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md)<br>[RI-MTH03](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) | `critic.fidelity` | in-item procedure (kind: structure); corpus/80-methods/capture-shots.md, corpus/80-methods/cc-scan.mjs, cc-scan.mjs<br>in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure)<br>in-item procedure (kind: structure)<br>in-item M1–M6 (6 checks); tools/blind/make-pair.mjs |
| `render.fidelity.atmosphere` | Fog, haze, aerial perspective, volumetrics | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.vegetation` | Plant density, variation, wind response, LOD transitions | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: structure) |
| `render.fidelity.water` | Water surface, refraction, shoreline, and underwater | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: structure) |
| `render.fidelity.character` | Character and creature mesh/texture quality up close | modern-fidelity | [RI-CAM07](../../corpus/15-camera/RI-CAM07-third-person-character-presentation.md)<br>[RI-VIS08](../../corpus/70-visual/RI-VIS08-character-animation-fidelity.md) | `critic.fidelity` | in-item M1–M6 (6 checks); corpus/80-methods/m-cam07-presentation.mjs<br>in-item procedure (kind: number); corpus/80-methods/capture-trace.mjs, corpus/80-methods/anim-metrics.mjs |
| `render.fidelity.animation` | Animation quality: weight, blending, foot contact | modern-fidelity | [RI-CAM07](../../corpus/15-camera/RI-CAM07-third-person-character-presentation.md)<br>[RI-VIS08](../../corpus/70-visual/RI-VIS08-character-animation-fidelity.md) | `critic.fidelity` | in-item M1–M6 (6 checks); corpus/80-methods/m-cam07-presentation.mjs<br>in-item procedure (kind: number); corpus/80-methods/capture-trace.mjs, corpus/80-methods/anim-metrics.mjs |
| `render.fidelity.postprocess` | Tonemapping, exposure, AA, bloom discipline | modern-fidelity | [RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.streaming` | Draw distance, LOD popping, load-in visibility | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.ao` | Ambient occlusion: contact darkening and grounding | modern-fidelity | [RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: structure) |
| `render.fidelity.ibl` | Image-based / sky lighting and indirect response | modern-fidelity | [RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: structure) |
| `render.fidelity.sky` | Sky model, sun/moon, cloud, and its coupling to scene light | modern-fidelity | [RI-VIS02](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md)<br>[RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md)<br>[RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: image)<br>in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs<br>in-item procedure (kind: structure) |
| `render.fidelity.vfx` | Particle and effect quality: fire, spray, spell, blood, dust | modern-fidelity | [RI-VIS04](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) | `critic.fidelity` | in-item procedure (kind: structure) |
| `render.process.bifurcation` | The judging process itself: axis declared, references not crossed (ARBITRATION §4) | neutral | [RI-CAM07](../../corpus/15-camera/RI-CAM07-third-person-character-presentation.md)<br>[RI-VIS01](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md)<br>[RI-VIS06](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) | `critic.fidelity` | in-item M1–M6 (6 checks); corpus/80-methods/m-cam07-presentation.mjs<br>in-item procedure (kind: structure); corpus/80-methods/capture-shots.md, corpus/80-methods/cc-scan.mjs, cc-scan.mjs<br>in-item procedure (kind: structure) |
| `render.process.measurement` | How a visual number is taken: capture protocol, poses, repeatability | neutral | [RI-VIS03](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) | `critic.fidelity` | in-item procedure (kind: number); corpus/80-methods/make-anti-ref.mjs, corpus/80-methods/vis-metrics.mjs |
| `render.art.palette` | Colour identity per region against Morrowind's palette discipline | art-direction | [RI-WLD05](../../corpus/50-world/RI-WLD05-strangeness-bar.md)<br>[RI-VIS01](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md)<br>[RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md)<br>[RI-VIS06](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md)<br>[RI-VIS07](../../corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md)<br>[RI-MTH03](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) | `critic.artdirection` | in-item M22–M26 (5 checks)<br>in-item procedure (kind: structure); corpus/80-methods/capture-shots.md, corpus/80-methods/cc-scan.mjs, cc-scan.mjs<br>in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs<br>in-item procedure (kind: structure)<br>in-item procedure (kind: text)<br>in-item M1–M6 (6 checks); tools/blind/make-pair.mjs |
| `render.art.silhouette` | Readable, strange silhouettes for creatures and buildings | art-direction | [RI-CAM07](../../corpus/15-camera/RI-CAM07-third-person-character-presentation.md)<br>[RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md)<br>[RI-VIS07](../../corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md)<br>[RI-VIS08](../../corpus/70-visual/RI-VIS08-character-animation-fidelity.md) | `critic.artdirection` | in-item M1–M6 (6 checks); corpus/80-methods/m-cam07-presentation.mjs<br>in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs<br>in-item procedure (kind: text)<br>in-item procedure (kind: number); corpus/80-methods/capture-trace.mjs, corpus/80-methods/anim-metrics.mjs |
| `render.art.architecture` | A coherent invented architectural language | art-direction | [RI-WLD03](../../corpus/50-world/RI-WLD03-settlement-anatomy.md)<br>[RI-WLD05](../../corpus/50-world/RI-WLD05-strangeness-bar.md)<br>[RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md)<br>[RI-VIS07](../../corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) | `critic.artdirection` | in-item M12–M16 (5 checks)<br>in-item M22–M26 (5 checks)<br>in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs<br>in-item procedure (kind: text) |
| `render.art.creature` | Creature design that is not a generic bestiary | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md)<br>[RI-VIS07](../../corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md)<br>[RI-VIS08](../../corpus/70-visual/RI-VIS08-character-animation-fidelity.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs<br>in-item procedure (kind: text)<br>in-item procedure (kind: number); corpus/80-methods/capture-trace.mjs, corpus/80-methods/anim-metrics.mjs |
| `render.art.composition` | Vista framing and landmark placement in the frame | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `render.art.weirdness` | The dream-logic strangeness budget per screen | art-direction | **— HOLE —** | `critic.artdirection` | _none_ |
| `render.art.mood` | Mood and atmosphere as an art choice: oppression, damp, quiet menace | art-direction | [RI-VIS07](../../corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) | `critic.artdirection` | in-item procedure (kind: text) |
| `render.art.flora` | Plant design language: shapes that could not be a European forest | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md)<br>[RI-VIS07](../../corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs<br>in-item procedure (kind: text) |
| `render.art.materials` | Material identity as an art choice: chitin, resin, wet wood, bone | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.artdirection` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |

### `audio.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `audio.combat.impact` | Hit, block, parry, and death sound design | souls | **— HOLE —** | `critic.audio` | _none_ |
| `audio.ambience.region` | Region ambience that identifies a place with eyes closed | morrowind | [RI-WLD04](../../corpus/50-world/RI-WLD04-region-identity.md) | `critic.audio` | in-item M17–M21 (5 checks) |
| `audio.music.policy` | Where music plays and where silence is correct | souls | **— HOLE —** | `critic.audio` | _none_ |
| `audio.voice.policy` | Voiced greetings vs written dialogue; consistency of the choice | morrowind | **— HOLE —** | `critic.audio` | _none_ |

### `ui.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `ui.hud.combat` | Health/stamina/charges HUD legibility under pressure | souls | [RI-CAM03](../../corpus/15-camera/RI-CAM03-lock-on-framing.md)<br>[RI-WLD06](../../corpus/50-world/RI-WLD06-navigation-without-markers.md) | `critic.ui` | in-item M1–M7 (7 checks); corpus/80-methods/m-cam03-lockon-framing.mjs<br>in-item M27–M32 (6 checks) |
| `ui.hud.minimalism` | No compass, no markers, no quest arrows on screen (AR-2) | morrowind | **— HOLE —** | `critic.ui` | _none_ |
| `ui.menu.inventory` | Inventory screen structure and information density | morrowind | [RI-CAM05](../../corpus/15-camera/RI-CAM05-camera-outside-the-fight.md) | `critic.ui` | in-item M0–M7 (8 checks); corpus/80-methods/m-cam05-world-camera.mjs |
| `ui.menu.journal` | Journal presentation, topic index, quest filtering | morrowind | **— HOLE —** | `critic.ui` | _none_ |
| `ui.dialogue.presentation` | Dialogue window: topic list, hyperlinked keywords, portrait, prose | morrowind | [RI-CAM05](../../corpus/15-camera/RI-CAM05-camera-outside-the-fight.md) | `critic.ui` | in-item M0–M7 (8 checks); corpus/80-methods/m-cam05-world-camera.mjs |
| `ui.style.diegesis` | UI art belongs to the world rather than to a UI kit | art-direction | [RI-VIS05](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) | `critic.ui` | in-item procedure (kind: image); corpus/80-methods/palette-conformance.mjs, vis-metrics.mjs |
| `ui.menu.levelup` | The level-up screen: what it shows, what it costs, where it lives | split | [RI-PRG01](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md)<br>[RI-PRG02](../../corpus/20-progression/RI-PRG02-stat-sheet.md) | `critic.ui` | in-item procedure (kind: number); corpus/80-methods/sim-souls-yield.md<br>in-item procedure (kind: number) |
| `ui.menu.books` | Reading a book in-game: presentation, pagination, legibility | morrowind | [RI-LOR03](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) | `critic.ui` | in-item procedure (kind: text); corpus/80-methods/book-stats.py |

### `platform.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `platform.perf.framerate` | Frame time budget and stability in a real browser | neutral | **— HOLE —** | `critic.platform` | _none_ |
| `platform.perf.memory` | Heap and GPU memory ceilings, leak-free over a session | neutral | **— HOLE —** | `critic.platform` | _none_ |
| `platform.load.streaming` | Initial load time and in-session streaming hitches | neutral | [RI-MTH01](../../corpus/80-methods/RI-MTH01-harness-api-surface.md) | `critic.platform` | in-item M1–M7 (7 checks); tools/harness/smoke.mjs, tools/harness/run-headless.mjs, tools/lib/browser.mjs |
| `platform.input.pipeline` | Browser input path: pointer lock, key repeat, dropped inputs | neutral | [RI-CAM02](../../corpus/15-camera/RI-CAM02-free-camera-and-movement-mapping.md)<br>[RI-MTH01](../../corpus/80-methods/RI-MTH01-harness-api-surface.md) | `critic.platform` | in-item M1–M7 (7 checks); corpus/80-methods/m-cam02-control.mjs<br>in-item M1–M7 (7 checks); tools/harness/smoke.mjs, tools/harness/run-headless.mjs, tools/lib/browser.mjs |
| `platform.save.persistence` | Save/load fidelity of world, quest, and faction state | morrowind | [RI-MTH01](../../corpus/80-methods/RI-MTH01-harness-api-surface.md)<br>[RI-MTH02](../../corpus/80-methods/RI-MTH02-determinism-reproducibility.md) | `critic.platform` | in-item M1–M7 (7 checks); tools/harness/smoke.mjs, tools/harness/run-headless.mjs, tools/lib/browser.mjs<br>in-item M1–M8 (8 checks); tools/harness/trace.mjs |
| `platform.determinism.harness` | Seeded, fixed-step headless runs that a critic can reproduce | neutral | [RI-CMB07](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md)<br>[RI-CAM06](../../corpus/15-camera/RI-CAM06-camera-feel.md)<br>[RI-MTH01](../../corpus/80-methods/RI-MTH01-harness-api-surface.md)<br>[RI-MTH02](../../corpus/80-methods/RI-MTH02-determinism-reproducibility.md) | `critic.platform` | in-item M0–M4 (5 checks); corpus/80-methods/m-cmb07-expand.mjs<br>in-item M1–M9 (9 checks); corpus/80-methods/m-cam06-feel.mjs<br>in-item M1–M7 (7 checks); tools/harness/smoke.mjs, tools/harness/run-headless.mjs, tools/lib/browser.mjs<br>in-item M1–M8 (8 checks); tools/harness/trace.mjs |

### `coherence.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `coherence.tone.crossregion` | Tone and register hold across region borders | morrowind | _doctrine_ | `critic.coherence` | COHERENCE-AGENT.md §3 C1 (tone and register) + traversal T1/T2 |
| `coherence.faction.crossref` | Factions know about and react to each other | morrowind | _doctrine_ | `critic.coherence` | COHERENCE-AGENT.md §3 C2 (factions acknowledge each other) + traversal T3 |
| `coherence.lore.consistency` | Lore contradictions are flagged `disputed` or they are bugs | morrowind | _doctrine_ | `critic.coherence` | COHERENCE-AGENT.md §3 C3 (lore consistency) + traversal T5 |
| `coherence.difficulty.continuity` | No lethality cliffs or troughs at region borders | souls | _doctrine_ | `critic.coherence` | COHERENCE-AGENT.md §3 C4 (difficulty continuity) + traversal T7 |
| `coherence.systems.composition` | Systems still compose: disposition affects prices affects quests affects access | neutral | [RI-WLD05](../../corpus/50-world/RI-WLD05-strangeness-bar.md) | `critic.coherence` | in-item M22–M26 (5 checks) |
| `coherence.naming.consistency` | One thing has one name everywhere it is mentioned | morrowind | _doctrine_ | `critic.coherence` | COHERENCE-AGENT.md §3 C1.5 / C5.5 + traversal T5 |
| `coherence.economy.balance` | Gold in equals gold out across the whole game, not per piece | morrowind | _doctrine_ | `critic.coherence` | COHERENCE-AGENT.md §3 C5.3 + traversal T1/T4 |
| `coherence.progression.pacing` | The whole-run curve of power, danger, and revelation | neutral | _doctrine_ | `critic.coherence` | COHERENCE-AGENT.md §3 C4.2 + traversal T1/T7 |

### `process.*`

| Game subsystem path | What it means | Arb | Judging items | Critic | Method |
|---|---|---|---|---|---|
| `process.critic.discipline` | The critic process itself: evidence, blindness, anti-softness (CRITIC-DOCTRINE.md) | neutral | [RI-MTH03](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md)<br>[RI-MTH04](../../corpus/80-methods/RI-MTH04-measurement-integrity.md) | `critic.coherence` | in-item M1–M6 (6 checks); tools/blind/make-pair.mjs<br>in-item M1–M8 (8 checks) |
| `process.verdict.format` | The verdict format and its validation (VERDICT-SCHEMA.md) | neutral | [RI-MTH03](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md)<br>[RI-MTH04](../../corpus/80-methods/RI-MTH04-measurement-integrity.md) | `critic.coherence` | in-item M1–M6 (6 checks); tools/blind/make-pair.mjs<br>in-item M1–M8 (8 checks) |

---

## 3. Corpus holes

Subsystem paths with **no** reference item judging them. Per CORPUS-CONTRACT §4, a
builder must not start on one of these. Per §5, a critic that needs one writes the
item rather than guessing, then regenerates this index.

**31 of 200 paths are holes.**

| Subsystem path | What it means | Arb | Expected area | Critic |
|---|---|---|---|---|
| `combat.frames.cancel` | What may cancel what, and when (roll-cancel, no free animation cancels) | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.dodge.recovery` | Post-roll recovery and roll-spam punishment | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.stamina.exhaustion` | Zero-stamina state and its punish window | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.attack.charge` | Charged heavy attacks and their risk/reward | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.weapon.identity` | Weapon classes feel categorically different to hold and swing | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.status.buildup` | In-fight status meters and procs (seam S11 Souls half) | split | `corpus/10-combat/` | `critic.combat` |
| `combat.magic.casting` | Spellcasting inside the fight: cast frames, commitment, resource | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.input.latency` | Press-to-first-active-frame latency | souls | `corpus/10-combat/` | `critic.combat` |
| `combat.pause.policy` | World does not pause during combat; inventory is not a safe haven (seam S14) | souls | `corpus/10-combat/` | `critic.combat` |
| `progression.skill.gating` | Skills gate access and utility, never to-hit | morrowind | `corpus/20-progression/` | `critic.progression` |
| `progression.build.identity` | Two different builds play observably differently out of the fight, not only in it | morrowind | `corpus/20-progression/` | `critic.progression` |
| `progression.affliction.economy` | Named diseases, curses, in-world causes and cures (seam S11 Morrowind half) | morrowind | `corpus/20-progression/` | `critic.progression` |
| `quests.resolution.exclusive` | Mutually exclusive resolutions that permanently close doors | morrowind | `corpus/30-quests/` | `critic.quests` |
| `quests.faction.expulsion` | Expulsion, disgrace, and the path back | morrowind | `corpus/30-quests/` | `critic.quests` |
| `quests.state.persistence` | Quest/faction/world flags survive death untouched (seam S6) | morrowind | `corpus/30-quests/` | `critic.quests` |
| `world.region.transition` | Borders between regions read as a change, not a texture swap | morrowind | `corpus/50-world/` | `critic.world` |
| `world.interior.continuity` | Interiors match their exteriors in size, orientation, and light | morrowind | `corpus/50-world/` | `critic.world` |
| `world.strangeness.architecture` | Buildings that could not be anywhere else | morrowind | `corpus/50-world/` | `critic.world` |
| `world.hazard.environment` | Swamp, blight, drowning, disease vectors as world hazards | morrowind | `corpus/50-world/` | `critic.world` |
| `world.water.marsh` | Black Marsh specifically: water, tide, mud, depth, and its cost to cross | morrowind | `corpus/50-world/` | `critic.world` |
| `lore.canon.argonian` | Argonian culture, Hist, naming, biology, outsider perception | morrowind | `corpus/60-lore/` | `critic.lore` |
| `lore.canon.geography` | Black Marsh geography and place-names against canon | morrowind | `corpus/60-lore/` | `critic.lore` |
| `lore.book.unreliability` | Sources contradict each other on purpose and are traceable to a bias | morrowind | `corpus/60-lore/` | `critic.lore` |
| `render.art.weirdness` | The dream-logic strangeness budget per screen | art-direction | `corpus/70-visual/` | `critic.artdirection` |
| `audio.combat.impact` | Hit, block, parry, and death sound design | souls | `corpus/70-visual/` | `critic.audio` |
| `audio.music.policy` | Where music plays and where silence is correct | souls | `corpus/70-visual/` | `critic.audio` |
| `audio.voice.policy` | Voiced greetings vs written dialogue; consistency of the choice | morrowind | `corpus/70-visual/` | `critic.audio` |
| `ui.hud.minimalism` | No compass, no markers, no quest arrows on screen (AR-2) | morrowind | `corpus/70-visual/` | `critic.ui` |
| `ui.menu.journal` | Journal presentation, topic index, quest filtering | morrowind | `corpus/70-visual/` | `critic.ui` |
| `platform.perf.framerate` | Frame time budget and stability in a real browser | neutral | `corpus/80-methods/` | `critic.platform` |
| `platform.perf.memory` | Heap and GPU memory ceilings, leak-free over a session | neutral | `corpus/80-methods/` | `critic.platform` |

### 3b. Paths judged by doctrine rather than by a reference item

These are **not** holes. The named doctrine document carries the bar, the method,
and the evidence requirement for the path. Everything not listed here needs an RI.

| Subsystem path | Judged by |
|---|---|
| `coherence.tone.crossregion` | COHERENCE-AGENT.md §3 C1 (tone and register) + traversal T1/T2 |
| `coherence.faction.crossref` | COHERENCE-AGENT.md §3 C2 (factions acknowledge each other) + traversal T3 |
| `coherence.lore.consistency` | COHERENCE-AGENT.md §3 C3 (lore consistency) + traversal T5 |
| `coherence.difficulty.continuity` | COHERENCE-AGENT.md §3 C4 (difficulty continuity) + traversal T7 |
| `coherence.naming.consistency` | COHERENCE-AGENT.md §3 C1.5 / C5.5 + traversal T5 |
| `coherence.economy.balance` | COHERENCE-AGENT.md §3 C5.3 + traversal T1/T4 |
| `coherence.progression.pacing` | COHERENCE-AGENT.md §3 C4.2 + traversal T1/T7 |

---

## 4. Path reconciliation

### 4a. Legacy `judges:` spellings still in use

These items name a path that is **not** canonical but has a registered alias in
`subsystems.json`. The index resolved them so the mapping is usable today, but the
front-matter should be corrected to the canonical spelling when the item is next
touched. **New reference items must use canonical paths only** — aliases are a
migration aid, not a second vocabulary.

**206 legacy spellings in use.**

| Legacy path | Canonical path | Used by |
|---|---|---|
| `books.content` | `lore.book.structure` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md), RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md), RI-LOR06 (corpus/60-lore/RI-LOR06-contradiction-discipline.md) |
| `books.length` | `lore.book.structure` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `books.taxonomy` | `lore.book.structure` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `combat.animation.commitment` | `combat.attack.commitment` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md), RI-CMB08 (corpus/10-combat/RI-CMB08-healing-flask.md) |
| `combat.animation.rootmotion` | `combat.attack.commitment` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| `combat.camera` | `combat.camera.behaviour` | RI-CMB06 (corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md) |
| `combat.criticals` | `combat.block.parry` | RI-CMB05 (corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) |
| `combat.damage.resolution` | `combat.hitbox.resolution` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.damage_formula` | `combat.damage.model` | RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md), RI-PRG08 (corpus/20-progression/RI-PRG08-upgrade-path.md) |
| `combat.determinism` | `combat.hitbox.resolution` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md), RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.difficulty-gating` | `combat.difficulty.lethality` | RI-WLD04 (corpus/50-world/RI-WLD04-region-identity.md) |
| `combat.dodge` | `combat.dodge.directional` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `combat.enemy.punishwindows` | `combat.enemy.punish` | RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.enemy_roster` | `combat.encounter.placement` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `combat.feel` | `combat.feedback.hitstop` | RI-MTH03 (corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) |
| `combat.frame.order` | `combat.frames.timing` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.guardbreak` | `combat.stamina.block` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.hit.geometry` | `combat.hitbox.sweep` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.hit.sweep` | `combat.hitbox.sweep` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.hurtbox` | `combat.hitbox.hurtbox` | RI-CMB04 (corpus/10-combat/RI-CMB04-hitboxes-hurtboxes.md) |
| `combat.hyperarmour` | `combat.poise.player` | RI-CMB05 (corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) |
| `combat.input.direction` | `combat.dodge.directional` | RI-CMB06 (corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md) |
| `combat.invulnerability` | `combat.dodge.iframes` | RI-CMB01 (corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) |
| `combat.level-design` | `combat.encounter.placement` | RI-WLD07 (corpus/50-world/RI-WLD07-verticality-and-interiors.md) |
| `combat.lockon` | `combat.lockon.target` | RI-CMB06 (corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md) |
| `combat.pacing` | `combat.encounter.grouping` | RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.parry` | `combat.block.parry` | RI-CMB05 (corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) |
| `combat.player.attack` | `combat.attack.moveset` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md), RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.player.block` | `combat.block.guard` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.player.dodge` | `combat.dodge.directional` | RI-CMB01 (corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md), RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.player.equipload` | `combat.dodge.equipload` | RI-CMB01 (corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md) |
| `combat.player.sprint` | `combat.stamina.costs` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.player.stamina` | `combat.stamina.costs` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md), RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.player.tracking` | `combat.attack.tracking` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md), RI-CMB06 (corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md) |
| `combat.poise` | `combat.poise.player` | RI-CMB05 (corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) |
| `combat.resource.pacing` | `combat.stamina.regen` | RI-CMB03 (corpus/10-combat/RI-CMB03-stamina-economy.md) |
| `combat.stagger` | `combat.poise.enemy` | RI-CMB05 (corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) |
| `combat.telemetry` | `platform.determinism.harness` | RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.trace` | `platform.determinism.harness` | RI-CMB07 (corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| `combat.trade` | `combat.poise.player` | RI-CMB05 (corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) |
| `combat.weapons.frames` | `combat.frames.timing` | RI-CMB02 (corpus/10-combat/RI-CMB02-attack-frame-data.md) |
| `creatures.names` | `lore.naming.conventions` | RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md) |
| `data.quests` | `quests.data.schema` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `dialogue.claims` | `dialogue.lore.vector` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md), RI-LOR05 (corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md), RI-LOR06 (corpus/60-lore/RI-LOR06-contradiction-discipline.md) |
| `dialogue.directions` | `journal.entry.directions` | RI-WLD06 (corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| `dialogue.persuasion` | `dialogue.persuasion.mechanics` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md), RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `dialogue.prose` | `dialogue.voice.register` | RI-MTH03 (corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) |
| `dialogue.rumours` | `dialogue.rumour.distribution` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `dialogue.voice` | `dialogue.voice.register` | RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md) |
| `economy.barter` | `progression.merchant.barter` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md), RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `economy.carrying` | `progression.equipment.encumbrance` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `economy.gold` | `progression.gold.economy` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `economy.loot` | `world.loot.placement` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `economy.merchants` | `progression.merchant.barter` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `economy.smithing` | `progression.equipment.upgrade` | RI-PRG08 (corpus/20-progression/RI-PRG08-upgrade-path.md) |
| `economy.souls` | `progression.souls.economy` | RI-PRG01 (corpus/20-progression/RI-PRG01-soul-cost-curve.md) |
| `engine.ai` | `platform.determinism.harness` | RI-MTH02 (corpus/80-methods/RI-MTH02-determinism-reproducibility.md) |
| `engine.animation` | `platform.determinism.harness` | RI-MTH02 (corpus/80-methods/RI-MTH02-determinism-reproducibility.md) |
| `engine.build` | `platform.load.streaming` | RI-MTH01 (corpus/80-methods/RI-MTH01-harness-api-surface.md) |
| `engine.camera` | `combat.camera.behaviour` | RI-MTH01 (corpus/80-methods/RI-MTH01-harness-api-surface.md) |
| `engine.harness` | `platform.determinism.harness` | RI-MTH01 (corpus/80-methods/RI-MTH01-harness-api-surface.md) |
| `engine.input` | `platform.input.pipeline` | RI-MTH01 (corpus/80-methods/RI-MTH01-harness-api-surface.md) |
| `engine.loop` | `platform.determinism.harness` | RI-MTH01 (corpus/80-methods/RI-MTH01-harness-api-surface.md), RI-MTH02 (corpus/80-methods/RI-MTH02-determinism-reproducibility.md) |
| `engine.physics` | `platform.determinism.harness` | RI-MTH02 (corpus/80-methods/RI-MTH02-determinism-reproducibility.md) |
| `engine.rng` | `platform.determinism.harness` | RI-MTH02 (corpus/80-methods/RI-MTH02-determinism-reproducibility.md) |
| `engine.state` | `platform.save.persistence` | RI-MTH01 (corpus/80-methods/RI-MTH01-harness-api-surface.md), RI-MTH02 (corpus/80-methods/RI-MTH02-determinism-reproducibility.md) |
| `items.names` | `lore.naming.conventions` | RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md) |
| `lore.canon` | `lore.canon.registry` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md), RI-LOR06 (corpus/60-lore/RI-LOR06-contradiction-discipline.md) |
| `lore.era` | `lore.canon.history` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `lore.factions` | `lore.canon.factions` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `lore.hist` | `lore.religion.hist` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md) |
| `lore.history` | `lore.canon.history` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md) |
| `lore.language` | `lore.naming.conventions` | RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md) |
| `lore.names` | `lore.naming.conventions` | RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md) |
| `lore.politics` | `lore.canon.factions` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `lore.prophecy` | `lore.canon.prophecy` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `movement.speed` | `world.traversal.locomotion` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| `npc.names` | `lore.naming.conventions` | RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md) |
| `npc.population` | `world.npc.population` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `npc.services` | `dialogue.service.merchant` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `progression.attributes` | `progression.level.attributes` | RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md) |
| `progression.bonfires` | `progression.bonfire.placement` | RI-WLD07 (corpus/50-world/RI-WLD07-verticality-and-interiors.md), RI-LOR05 (corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md) |
| `progression.checkpoint` | `progression.bonfire.function` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `progression.death` | `combat.death.corpserun` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `progression.equip_load` | `progression.equipment.encumbrance` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `progression.faction.rank` | `quests.faction.rankgating` | RI-QST01 (corpus/30-quests/RI-QST01-faction-escalation-shape.md), RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `progression.fatigue` | `progression.fatigue.social` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| `progression.flask` | `combat.heal.charges` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `progression.items` | `progression.inventory.model` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `progression.level_cost` | `progression.level.curve` | RI-PRG01 (corpus/20-progression/RI-PRG01-soul-cost-curve.md) |
| `progression.levelup_ui` | `ui.menu.levelup` | RI-PRG01 (corpus/20-progression/RI-PRG01-soul-cost-curve.md), RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md) |
| `progression.materials` | `progression.equipment.upgrade` | RI-PRG08 (corpus/20-progression/RI-PRG08-upgrade-path.md) |
| `progression.pace` | `progression.level.curve` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `progression.scaling` | `combat.damage.scaling` | RI-PRG02 (corpus/20-progression/RI-PRG02-stat-sheet.md), RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md) |
| `progression.skills` | `progression.skill.usegrowth` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md), RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `progression.skills.social` | `progression.skill.social` | RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `progression.souls_yield` | `progression.souls.economy` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `progression.training` | `progression.training.trainers` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `progression.upgrade` | `progression.equipment.upgrade` | RI-PRG08 (corpus/20-progression/RI-PRG08-upgrade-path.md) |
| `quest.hubs` | `quests.discovery.hooks` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| `quest.journal` | `journal.entry.voice` | RI-WLD06 (corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| `quests.branching` | `quests.structure.branching` | RI-QST02 (corpus/30-quests/RI-QST02-deceit-patterns.md), RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `quests.deceit` | `quests.structure.deceit` | RI-QST02 (corpus/30-quests/RI-QST02-deceit-patterns.md) |
| `quests.density` | `quests.density.count` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md) |
| `quests.discovery` | `quests.discovery.hooks` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md) |
| `quests.escalation` | `quests.faction.escalation` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| `quests.faction.counts` | `quests.density.count` | RI-QST01 (corpus/30-quests/RI-QST01-faction-escalation-shape.md) |
| `quests.faction.exclusivity` | `quests.faction.rivalry` | RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `quests.faction.gating` | `quests.faction.rankgating` | RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `quests.faction.leverage` | `quests.faction.escalation` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `quests.faction.ranks` | `quests.faction.rankgating` | RI-QST01 (corpus/30-quests/RI-QST01-faction-escalation-shape.md) |
| `quests.factions` | `quests.faction.joining` | RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md), RI-LOR06 (corpus/60-lore/RI-LOR06-contradiction-discipline.md) |
| `quests.failure` | `quests.failure.severed` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `quests.giver` | `quests.giver.characterisation` | RI-QST02 (corpus/30-quests/RI-QST02-deceit-patterns.md) |
| `quests.journal` | `journal.entry.numbering` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `quests.lorehooks` | `quests.lore.hooks` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `quests.main` | `quests.mainline.prophecy` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md), RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md), RI-LOR05 (corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md), RI-LOR06 (corpus/60-lore/RI-LOR06-contradiction-discipline.md) |
| `quests.main.acts` | `quests.mainline.acts` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `quests.main.antagonist` | `quests.mainline.antagonist` | RI-QST06 (corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| `quests.resolution.methods` | `quests.resolution.noncombat` | RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `quests.rewards` | `quests.reward.shape` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `quests.rewards.unique` | `quests.reward.shape` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `quests.schema` | `quests.data.schema` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md), RI-QST05 (corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| `quests.side` | `quests.side.texture` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md) |
| `quests.stages` | `quests.structure.stages` | RI-QST04 (corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| `quests.structure` | `quests.structure.stages` | RI-MTH03 (corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) |
| `ui.hud` | `ui.hud.combat` | RI-WLD06 (corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| `ui.readables` | `ui.menu.books` | RI-LOR03 (corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| `visual.animation.attachment` | `render.fidelity.animation` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.animation.blending` | `render.fidelity.animation` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.animation.ik` | `render.fidelity.animation` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.animation.rootmotion` | `combat.attack.commitment` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.animation.smoothness` | `render.fidelity.animation` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.art-direction` | `render.art.palette` | RI-WLD05 (corpus/50-world/RI-WLD05-strangeness-bar.md) |
| `visual.artdirection` | `render.art.palette` | RI-VIS01 (corpus/70-visual/RI-VIS01-bifurcation-protocol.md), RI-VIS06 (corpus/70-visual/RI-VIS06-blind-comparison-protocol.md), RI-MTH03 (corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) |
| `visual.artdirection.architecture` | `render.art.architecture` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md), RI-VIS07 (corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) |
| `visual.artdirection.composition` | `render.art.composition` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.creature` | `render.art.creature` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md), RI-VIS07 (corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) |
| `visual.artdirection.flora` | `render.art.flora` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md), RI-VIS07 (corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) |
| `visual.artdirection.materials` | `render.art.materials` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.artdirection.mood` | `render.art.mood` | RI-VIS07 (corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) |
| `visual.artdirection.palette` | `render.art.palette` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md), RI-VIS07 (corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) |
| `visual.artdirection.silhouette` | `render.art.silhouette` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md), RI-VIS07 (corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) |
| `visual.artdirection.ui` | `ui.style.diegesis` | RI-VIS05 (corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| `visual.character.materials` | `render.fidelity.character` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.character.model` | `render.fidelity.character` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.character.silhouette` | `render.art.silhouette` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.creature.readability` | `render.art.creature` | RI-VIS08 (corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| `visual.fidelity` | `render.fidelity.materials` | RI-MTH03 (corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) |
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
| `world.architecture` | `render.art.architecture` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md), RI-WLD05 (corpus/50-world/RI-WLD05-strangeness-bar.md) |
| `world.audio` | `audio.ambience.region` | RI-WLD04 (corpus/50-world/RI-WLD04-region-identity.md) |
| `world.biomes` | `world.region.identity` | RI-WLD04 (corpus/50-world/RI-WLD04-region-identity.md) |
| `world.density` | `world.density.handplacement` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.dungeons` | `world.dungeon.design` | RI-WLD07 (corpus/50-world/RI-WLD07-verticality-and-interiors.md) |
| `world.encounters` | `combat.encounter.placement` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.factions` | `world.faction.presence` | RI-QST03 (corpus/30-quests/RI-QST03-faction-gating.md) |
| `world.fauna` | `world.strangeness.fauna` | RI-WLD05 (corpus/50-world/RI-WLD05-strangeness-bar.md) |
| `world.flora` | `world.strangeness.flora` | RI-WLD04 (corpus/50-world/RI-WLD04-region-identity.md), RI-WLD05 (corpus/50-world/RI-WLD05-strangeness-bar.md) |
| `world.interiors` | `world.interior.named` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md), RI-WLD07 (corpus/50-world/RI-WLD07-verticality-and-interiors.md) |
| `world.locks` | `world.locks.security` | RI-PRG03 (corpus/20-progression/RI-PRG03-skills-by-use.md) |
| `world.loot_placement` | `world.loot.placement` | RI-PRG08 (corpus/20-progression/RI-PRG08-upgrade-path.md) |
| `world.navigation` | `world.wayfinding.directions` | RI-WLD06 (corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| `world.placement` | `world.density.handplacement` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md), RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.placenames` | `lore.naming.conventions` | RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md) |
| `world.poi` | `world.density.handplacement` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md) |
| `world.property` | `world.property.ownership` | RI-QST08 (corpus/30-quests/RI-QST08-reward-design.md) |
| `world.region_gating` | `world.region.gating` | RI-PRG06 (corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| `world.regions` | `world.region.identity` | RI-WLD04 (corpus/50-world/RI-WLD04-region-identity.md) |
| `world.respawn` | `combat.death.worldreset` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `world.roads` | `world.traversal.roads` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md), RI-WLD06 (corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| `world.scale` | `world.map.scale` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| `world.settlement.content` | `world.settlement.anatomy` | RI-QST07 (corpus/30-quests/RI-QST07-side-quest-texture.md) |
| `world.settlements` | `world.settlement.anatomy` | RI-WLD03 (corpus/50-world/RI-WLD03-settlement-anatomy.md), RI-LOR01 (corpus/60-lore/RI-LOR01-canon-dossier.md), RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md), RI-LOR04 (corpus/60-lore/RI-LOR04-naming-and-language.md), RI-LOR06 (corpus/60-lore/RI-LOR06-contradiction-discipline.md) |
| `world.sightlines` | `world.map.legibility` | RI-WLD02 (corpus/50-world/RI-WLD02-density-per-minute.md), RI-WLD06 (corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| `world.signage` | `world.wayfinding.directions` | RI-WLD06 (corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| `world.spacing` | `world.density.handplacement` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| `world.strangeness` | `world.strangeness.budget` | RI-WLD05 (corpus/50-world/RI-WLD05-strangeness-bar.md) |
| `world.systems` | `coherence.systems.composition` | RI-WLD05 (corpus/50-world/RI-WLD05-strangeness-bar.md) |
| `world.terrain` | `world.terrain.form` | RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md), RI-WLD04 (corpus/50-world/RI-WLD04-region-identity.md), RI-WLD07 (corpus/50-world/RI-WLD07-verticality-and-interiors.md) |
| `world.time` | `world.time.daynight` | RI-PRG04 (corpus/20-progression/RI-PRG04-hearth-and-death.md), RI-WLD08 (corpus/50-world/RI-WLD08-the-living-world.md) |
| `world.transport` | `world.traversal.transport` | RI-PRG05 (corpus/20-progression/RI-PRG05-gold-economy.md) |
| `world.travel` | `world.traversal.transport` | RI-LOR02 (corpus/60-lore/RI-LOR02-era-and-political-brief.md), RI-LOR05 (corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md) |
| `world.traversal` | `world.traversal.time` | RI-PRG07 (corpus/20-progression/RI-PRG07-equip-load-encumbrance.md), RI-WLD01 (corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| `world.verticality` | `world.verticality.layout` | RI-WLD07 (corpus/50-world/RI-WLD07-verticality-and-interiors.md) |
| `world.weather` | `world.weather.systems` | RI-WLD04 (corpus/50-world/RI-WLD04-region-identity.md), RI-WLD08 (corpus/50-world/RI-WLD08-the-living-world.md) |

### 4b. Unresolved `judges:` targets

Paths claimed by an item that are neither canonical nor aliased. An unresolved path
means a critic would be judging something no builder was ever told to address. Fix
the item, or append the path to `subsystems.json`, then regenerate.

| File | Problem |
|---|---|
| `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "combat.player.heal" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "combat.resource.charges" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "progression.restsite.refill" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "combat.encounter.pacing" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "world.npc-schedules" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "world.ecology" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "world.ambient-events" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "npc.behaviour" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "audio.ambient" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "lore.religion" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "lore.metaphysics" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "progression.souls" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "progression.levelling" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "progression.estus" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "combat.death" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "combat.respawn" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "ui.terminology" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR06-contradiction-discipline.md` | judges: "lore.coherence" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| `corpus/60-lore/RI-LOR06-contradiction-discipline.md` | judges: "critic.method" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |

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
| RI-CMB05 | Poise, stagger, hyperarmour, and the critical windows (backstab, parry, riposte) | 10-combat | number | souls | constructed | medium | yes | `combat.poise.player` `combat.poise.enemy` `combat.block.parry` | [corpus/10-combat/RI-CMB05-poise-stagger-criticals.md](../../corpus/10-combat/RI-CMB05-poise-stagger-criticals.md) |
| RI-CMB06 | Lock-on — acquisition, camera behaviour, directional roll semantics, and soft-lock steering | 10-combat | number | souls | constructed | medium | yes | `combat.lockon.target` `combat.camera.behaviour` `combat.player.movement` `combat.attack.tracking` `combat.dodge.directional` | [corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md](../../corpus/10-combat/RI-CMB06-lock-on-and-directional-roll.md) |
| RI-CMB07 | The combat trace — machine-readable format and a 59-second hand-authored exemplar fight | 10-combat | trace | souls | constructed | high | yes | `platform.determinism.harness` `combat.encounter.grouping` `combat.dodge.directional` `combat.stamina.costs` `combat.attack.moveset` `combat.enemy.punish` `combat.hitbox.resolution` | [corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md](../../corpus/10-combat/RI-CMB07-combat-trace-format-and-exemplar.md) |
| RI-CMB08 | Healing — the Hist-sap Flask, drink commitment frames, heal curve, and refill on rest | 10-combat | number | souls | constructed | medium | yes | `combat.attack.commitment` | [corpus/10-combat/RI-CMB08-healing-flask.md](../../corpus/10-combat/RI-CMB08-healing-flask.md) |
| RI-CAM01 | The third-person rig — pivot, shoulder offset, spring arm, and collision pull-in | 15-camera | number | souls | constructed | high | yes | `combat.camera.behaviour` | [corpus/15-camera/RI-CAM01-rig-geometry-and-spring-arm.md](../../corpus/15-camera/RI-CAM01-rig-geometry-and-spring-arm.md) |
| RI-CAM02 | Free-camera control and camera-relative movement — deadzone, pitch clamp, turn rate, and auto-recentre | 15-camera | number | souls | constructed | medium | yes | `combat.player.movement` `world.traversal.locomotion` `platform.input.pipeline` `combat.camera.behaviour` | [corpus/15-camera/RI-CAM02-free-camera-and-movement-mapping.md](../../corpus/15-camera/RI-CAM02-free-camera-and-movement-mapping.md) |
| RI-CAM03 | Lock-on framing — the containment law, distance- and size-dependent pitch, switch latency, and the reticle | 15-camera | number | souls | constructed | medium | yes | `combat.lockon.target` `combat.lockon.switch` `combat.camera.behaviour` `ui.hud.combat` | [corpus/15-camera/RI-CAM03-lock-on-framing.md](../../corpus/15-camera/RI-CAM03-lock-on-framing.md) |
| RI-CAM04 | Locked movement, directional roll clips, and the player-side tracking cutoff | 15-camera | number | souls | constructed | high | yes | `combat.dodge.directional` `combat.attack.tracking` `combat.player.movement` `combat.attack.commitment` | [corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md](../../corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md) |
| RI-CAM05 | The camera outside the fight — exploration, dialogue, menus, resting, interiors, and the first-person ban | 15-camera | number | souls | constructed | high | yes | `combat.camera.behaviour` `ui.dialogue.presentation` `ui.menu.inventory` `progression.bonfire.function` `world.dungeon.design` `world.interior.named` | [corpus/15-camera/RI-CAM05-camera-outside-the-fight.md](../../corpus/15-camera/RI-CAM05-camera-outside-the-fight.md) |
| RI-CAM06 | Camera feel — fixed-step coupling, zero inertia, no head-bob, no FOV punch, hitstop, shake, death and fog-gate | 15-camera | number | souls | constructed | high | yes | `combat.camera.behaviour` `combat.feedback.hitstop` `combat.boss.arena` `combat.death.corpserun` `platform.determinism.harness` | [corpus/15-camera/RI-CAM06-camera-feel.md](../../corpus/15-camera/RI-CAM06-camera-feel.md) |
| RI-CAM07 | Third-person character presentation — what the always-behind camera specifically demands of the player's body | 15-camera | number | modern-fidelity | constructed | high | yes | `render.fidelity.character` `render.fidelity.animation` `render.art.silhouette` `render.process.bifurcation` | [corpus/15-camera/RI-CAM07-third-person-character-presentation.md](../../corpus/15-camera/RI-CAM07-third-person-character-presentation.md) |
| RI-PRG01 | The soul cost curve — souls-to-next-level, L1 to L140 | 20-progression | number | souls | constructed | high | no | `progression.level.curve` `ui.menu.levelup` `progression.souls.economy` | [corpus/20-progression/RI-PRG01-soul-cost-curve.md](../../corpus/20-progression/RI-PRG01-soul-cost-curve.md) |
| RI-PRG02 | The stat sheet — ten attributes, soft caps, and scaling grades | 20-progression | number | neutral | constructed | high | no | `progression.level.attributes` `ui.menu.levelup` `combat.damage.scaling` `combat.damage.model` | [corpus/20-progression/RI-PRG02-stat-sheet.md](../../corpus/20-progression/RI-PRG02-stat-sheet.md) |
| RI-PRG03 | Skills that improve by use — the 19 skills, their rates, and their gates | 20-progression | number | morrowind | constructed | high | no | `progression.skill.usegrowth` `combat.damage.scaling` `world.locks.security` `progression.crafting.alchemy` `dialogue.persuasion.mechanics` `progression.merchant.barter` | [corpus/20-progression/RI-PRG03-skills-by-use.md](../../corpus/20-progression/RI-PRG03-skills-by-use.md) |
| RI-PRG04 | HEARTH — resting, respawn, spacing, and the death→corpse-run→recovery loop | 20-progression | structure | souls | constructed | medium | no | `progression.bonfire.function` `combat.death.corpserun` `combat.death.worldreset` `world.density.handplacement` `combat.heal.charges` `world.time.daynight` | [corpus/20-progression/RI-PRG04-hearth-and-death.md](../../corpus/20-progression/RI-PRG04-hearth-and-death.md) |
| RI-PRG05 | The gold economy — prices, merchant pools, barter, and the regional balance sheet | 20-progression | number | morrowind | constructed | medium | no | `progression.gold.economy` `progression.merchant.barter` `world.traversal.transport` `progression.training.trainers` | [corpus/20-progression/RI-PRG05-gold-economy.md](../../corpus/20-progression/RI-PRG05-gold-economy.md) |
| RI-PRG06 | Souls yield and the levelling pace curve — per-archetype values, region tiers, expected level | 20-progression | number | souls | constructed | medium | no | `progression.souls.economy` `progression.level.curve` `world.region.gating` `combat.encounter.placement` | [corpus/20-progression/RI-PRG06-souls-yield-and-pace.md](../../corpus/20-progression/RI-PRG06-souls-yield-and-pace.md) |
| RI-PRG07 | Equip load and encumbrance — two ratios, two rulebooks, one breakpoint table | 20-progression | number | neutral | constructed | medium | no | `progression.equipment.encumbrance` `combat.dodge.directional` `world.traversal.time` `progression.fatigue.social` | [corpus/20-progression/RI-PRG07-equip-load-encumbrance.md](../../corpus/20-progression/RI-PRG07-equip-load-encumbrance.md) |
| RI-PRG08 | The upgrade path — +N tiers, materials, damage progression, and exploration gating | 20-progression | number | souls | constructed | medium | no | `progression.equipment.upgrade` `world.loot.placement` `combat.damage.model` | [corpus/20-progression/RI-PRG08-upgrade-path.md](../../corpus/20-progression/RI-PRG08-upgrade-path.md) |
| RI-QST01 | The escalation shape of a Morrowind faction questline | 30-quests | structure | morrowind | community-data | medium | yes | `quests.faction.escalation` `quests.faction.rankgating` `quests.density.count` | [corpus/30-quests/RI-QST01-faction-escalation-shape.md](../../corpus/30-quests/RI-QST01-faction-escalation-shape.md) |
| RI-QST02 | How a questline lies to you — the deceit pattern catalogue | 30-quests | structure | morrowind | canonical-recall | medium | yes | `quests.structure.deceit` `quests.giver.characterisation` `quests.structure.branching` `dialogue.topics.truth` `quests.faction.escalation` | [corpus/30-quests/RI-QST02-deceit-patterns.md](../../corpus/30-quests/RI-QST02-deceit-patterns.md) |
| RI-QST03 | Faction gating — rank requirements, exclusivity, expulsion, lockout | 30-quests | structure | morrowind | community-data | medium | no | `quests.faction.rankgating` `progression.skill.usegrowth` `quests.faction.rivalry` `world.faction.presence` | [corpus/30-quests/RI-QST03-faction-gating.md](../../corpus/30-quests/RI-QST03-faction-gating.md) |
| RI-QST04 | Quest stage anatomy and the canonical quest schema | 30-quests | structure | morrowind | constructed | high | no | `quests.data.schema` `quests.structure.stages` `quests.structure.branching` `journal.entry.numbering` `quests.failure.severed` | [corpus/30-quests/RI-QST04-quest-anatomy-schema.md](../../corpus/30-quests/RI-QST04-quest-anatomy-schema.md) |
| RI-QST05 | Non-combat resolution — the measurable pacifist fraction and first-class solution verbs | 30-quests | number | morrowind | derived | low | no | `quests.resolution.noncombat` `progression.skill.social` `dialogue.persuasion.mechanics` `quests.data.schema` | [corpus/30-quests/RI-QST05-non-combat-resolution.md](../../corpus/30-quests/RI-QST05-non-combat-resolution.md) |
| RI-QST06 | Main quest architecture — the five-act template and the backpath | 30-quests | structure | morrowind | canonical-recall | medium | yes | `quests.mainline.prophecy` `quests.mainline.acts` `quests.mainline.antagonist` `quests.faction.escalation` `lore.canon.prophecy` | [corpus/30-quests/RI-QST06-main-quest-architecture.md](../../corpus/30-quests/RI-QST06-main-quest-architecture.md) |
| RI-QST07 | Side quest texture — type distribution, density, and the quests you have to overhear | 30-quests | number | morrowind | derived | low | no | `quests.side.texture` `quests.discovery.hooks` `quests.density.count` `world.settlement.anatomy` `dialogue.rumour.distribution` | [corpus/30-quests/RI-QST07-side-quest-texture.md](../../corpus/30-quests/RI-QST07-side-quest-texture.md) |
| RI-QST08 | Reward design — the unique-named fraction and non-item rewards | 30-quests | number | morrowind | community-data | medium | yes | `quests.reward.shape` `world.loot.placement` `progression.inventory.model` `world.property.ownership` | [corpus/30-quests/RI-QST08-reward-design.md](../../corpus/30-quests/RI-QST08-reward-design.md) |
| RI-DLG01 | The topic list as a graph — filter stack, first-match-wins, and settlement topic webs | 40-dialogue | graph | morrowind | community-data | medium | yes | `dialogue.topics.graph` `dialogue.topics.discovery` `dialogue.topics.filtering` `dialogue.greeting.variation` `dialogue.combat.lockout` `quests.discovery.hooks` | [corpus/40-dialogue/RI-DLG01-topic-graph.md](../../corpus/40-dialogue/RI-DLG01-topic-graph.md) |
| RI-DLG02 | Unique dialogue words per settlement — the headline density metric | 40-dialogue | number | morrowind | community-data | high | no | `dialogue.density.wordcount` `dialogue.topics.filtering` `world.settlement.anatomy` | [corpus/40-dialogue/RI-DLG02-words-per-settlement.md](../../corpus/40-dialogue/RI-DLG02-words-per-settlement.md) |
| RI-DLG03 | Greetings and rumours — disposition banding and the diegetic quest-discovery mechanism | 40-dialogue | text | morrowind | community-data | high | yes | `dialogue.rumour.distribution` `dialogue.greeting.variation` `dialogue.disposition.model` `dialogue.topics.truth` `quests.discovery.hooks` `world.persistence.state` | [corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md](../../corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md) |
| RI-DLG04 | Disposition and persuasion — derived disposition, Admire/Intimidate/Taunt/Bribe formulas, gating thresholds | 40-dialogue | number | morrowind | community-data | high | no | `dialogue.disposition.model` `dialogue.persuasion.mechanics` `dialogue.topics.filtering` `dialogue.service.merchant` `progression.gold.economy` `progression.skill.usegrowth` | [corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md](../../corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md) |
| RI-DLG05 | The journal — schema, voice, exemplar entries, and the no-marker rule | 40-dialogue | text | morrowind | constructed | high | yes | `journal.entry.voice` `journal.entry.numbering` `journal.entry.directions` `journal.navigation.nomarkers` `quests.structure.stages` `world.wayfinding.directions` | [corpus/40-dialogue/RI-DLG05-journal.md](../../corpus/40-dialogue/RI-DLG05-journal.md) |
| RI-DLG06 | Dialogue voice differentiation — measurable style fingerprints per speaker archetype | 40-dialogue | number | morrowind | community-data | high | yes | `dialogue.voice.register` `dialogue.npc.identity` | [corpus/40-dialogue/RI-DLG06-voice-differentiation.md](../../corpus/40-dialogue/RI-DLG06-voice-differentiation.md) |
| RI-DLG07 | Blind comparison pack — unattributed dialogue and journal excerpts for A/B judging | 40-dialogue | text | morrowind | community-data | high | yes | `dialogue.voice.register` `dialogue.npc.identity` `dialogue.rumour.distribution` `dialogue.greeting.variation` `journal.entry.voice` | [corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md](../../corpus/40-dialogue/RI-DLG07-blind-comparison-pack.md) |
| RI-WLD01 | World scale, coordinate system and the one-hour traversal budget | 50-world | number | morrowind | constructed | high | no | `world.map.scale` `world.terrain.form` `world.traversal.roads` `world.density.handplacement` `world.traversal.time` `world.traversal.locomotion` | [corpus/50-world/RI-WLD01-scale-and-traversal-budget.md](../../corpus/50-world/RI-WLD01-scale-and-traversal-budget.md) |
| RI-WLD02 | Density per minute of travel — the headline world metric | 50-world | number | morrowind | constructed | high | no | `world.density.handplacement` `combat.encounter.placement` `world.map.legibility` | [corpus/50-world/RI-WLD02-density-per-minute.md](../../corpus/50-world/RI-WLD02-density-per-minute.md) |
| RI-WLD03 | Settlement anatomy — what makes a Morrowind town, and the per-settlement allocation | 50-world | structure | morrowind | constructed | high | yes | `world.settlement.anatomy` `world.interior.named` `render.art.architecture` `world.npc.population` `dialogue.service.merchant` `quests.discovery.hooks` | [corpus/50-world/RI-WLD03-settlement-anatomy.md](../../corpus/50-world/RI-WLD03-settlement-anatomy.md) |
| RI-WLD04 | Region identity and biome differentiation — the unlabeled screenshot test | 50-world | structure | morrowind | constructed | high | yes | `world.region.identity` `world.terrain.form` `world.strangeness.flora` `audio.ambience.region` `world.weather.systems` `combat.difficulty.lethality` | [corpus/50-world/RI-WLD04-region-identity.md](../../corpus/50-world/RI-WLD04-region-identity.md) |
| RI-WLD05 | The strangeness bar — thirty things that exist nowhere else | 50-world | structure | morrowind | constructed | high | yes | `world.strangeness.budget` `world.strangeness.flora` `world.strangeness.fauna` `render.art.architecture` `render.art.palette` `coherence.systems.composition` | [corpus/50-world/RI-WLD05-strangeness-bar.md](../../corpus/50-world/RI-WLD05-strangeness-bar.md) |
| RI-WLD06 | Navigation without markers — landmarks, signposts and prose directions | 50-world | structure | morrowind | constructed | high | yes | `world.wayfinding.directions` `world.map.legibility` `world.traversal.roads` `journal.entry.voice` `journal.entry.directions` `ui.hud.combat` | [corpus/50-world/RI-WLD06-navigation-without-markers.md](../../corpus/50-world/RI-WLD06-navigation-without-markers.md) |
| RI-WLD07 | Verticality, interiors, and the Souls-loop / Morrowind-cave seam | 50-world | structure | neutral | constructed | high | no | `world.interior.named` `world.dungeon.design` `world.verticality.layout` `world.terrain.form` `combat.encounter.placement` `progression.bonfire.placement` | [corpus/50-world/RI-WLD07-verticality-and-interiors.md](../../corpus/50-world/RI-WLD07-verticality-and-interiors.md) |
| RI-WLD08 | The living world — schedules, ecology, ambient events, weather and time | 50-world | number | morrowind | constructed | high | yes | `world.weather.systems` `world.time.daynight` | [corpus/50-world/RI-WLD08-the-living-world.md](../../corpus/50-world/RI-WLD08-the-living-world.md) |
| RI-LOR01 | Black Marsh and Argonian canon dossier — what we may not contradict, and where we must invent | 60-lore | text | morrowind | canonical-recall | medium | no | `lore.canon.registry` `lore.religion.hist` `lore.canon.factions` `lore.canon.history` `world.settlement.anatomy` `quests.mainline.prophecy` `quests.faction.joining` `dialogue.lore.vector` `lore.book.structure` | [corpus/60-lore/RI-LOR01-canon-dossier.md](../../corpus/60-lore/RI-LOR01-canon-dossier.md) |
| RI-LOR02 | Era selection and the political brief — Black Marsh, 3E 427 | 60-lore | text | morrowind | constructed | high | no | `lore.canon.history` `lore.canon.factions` `quests.mainline.prophecy` `quests.faction.joining` `quests.faction.escalation` `dialogue.rumour.distribution` `world.settlement.anatomy` `world.traversal.transport` | [corpus/60-lore/RI-LOR02-era-and-political-brief.md](../../corpus/60-lore/RI-LOR02-era-and-political-brief.md) |
| RI-LOR03 | The structure of an Elder Scrolls in-world book — length stats, taxonomy, and six full exemplars | 60-lore | text | morrowind | canonical-recall | medium | yes | `lore.book.structure` `lore.canon.registry` `dialogue.lore.vector` `quests.lore.hooks` `ui.menu.books` | [corpus/60-lore/RI-LOR03-in-world-book-structure.md](../../corpus/60-lore/RI-LOR03-in-world-book-structure.md) |
| RI-LOR04 | Naming and language — Jel phonology, the lexicon, and the naming conventions of every culture in the marsh | 60-lore | structure | morrowind | constructed | high | no | `lore.naming.conventions` `world.settlement.anatomy` `dialogue.voice.register` `lore.book.structure` | [corpus/60-lore/RI-LOR04-naming-and-language.md](../../corpus/60-lore/RI-LOR04-naming-and-language.md) |
| RI-LOR05 | Religion and metaphysics — the Hist, Sithis, the colonial gods, and a diegetic account of souls-as-levelling | 60-lore | text | neutral | constructed | high | no | `progression.bonfire.placement` `world.traversal.transport` `quests.mainline.prophecy` `dialogue.lore.vector` | [corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md](../../corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md) |
| RI-LOR06 | Contradiction discipline — the canon-facts registry, and how a critic tells intent from error | 60-lore | structure | morrowind | constructed | high | no | `lore.canon.registry` `lore.book.structure` `dialogue.lore.vector` `quests.mainline.prophecy` `quests.faction.joining` `world.settlement.anatomy` | [corpus/60-lore/RI-LOR06-contradiction-discipline.md](../../corpus/60-lore/RI-LOR06-contradiction-discipline.md) |
| RI-VIS01 | The bifurcation protocol — art direction and fidelity are judged separately, never together | 70-visual | structure | neutral | constructed | high | no | `render.process.bifurcation` `render.art.palette` `render.fidelity.materials` | [corpus/70-visual/RI-VIS01-bifurcation-protocol.md](../../corpus/70-visual/RI-VIS01-bifurcation-protocol.md) |
| RI-VIS02 | Fidelity reference set — current-generation shots we are measured against | 70-visual | image | modern-fidelity | derived | medium | yes | `render.fidelity.lighting` `render.fidelity.materials` `render.fidelity.atmosphere` `render.fidelity.water` `render.fidelity.vegetation` `render.fidelity.sky` `render.fidelity.streaming` | [corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md](../../corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md) |
| RI-VIS03 | Fidelity as measurable quantities — the image-metric battery | 70-visual | number | modern-fidelity | constructed | high | no | `render.fidelity.lighting` `render.fidelity.materials` `render.fidelity.postprocess` `render.fidelity.shadows` `render.fidelity.atmosphere` `render.fidelity.sky` `render.fidelity.streaming` `render.process.measurement` | [corpus/70-visual/RI-VIS03-fidelity-image-metrics.md](../../corpus/70-visual/RI-VIS03-fidelity-image-metrics.md) |
| RI-VIS04 | The renderer feature checklist — what a Three.js scene must have to be modern, and the tell when it doesn't | 70-visual | structure | modern-fidelity | constructed | high | no | `render.fidelity.materials` `render.fidelity.ibl` `render.fidelity.shadows` `render.fidelity.ao` `render.fidelity.postprocess` `render.fidelity.atmosphere` `render.fidelity.water` `render.fidelity.vegetation` `render.fidelity.streaming` `render.fidelity.sky` `render.fidelity.vfx` | [corpus/70-visual/RI-VIS04-renderer-feature-checklist.md](../../corpus/70-visual/RI-VIS04-renderer-feature-checklist.md) |
| RI-VIS05 | Art direction — the Morrowind visual language and its Black Marsh transposition | 70-visual | image | morrowind | canonical-recall | medium | yes | `render.art.palette` `render.art.silhouette` `render.art.architecture` `render.art.flora` `render.art.creature` `render.art.composition` `render.art.materials` `ui.style.diegesis` | [corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md](../../corpus/70-visual/RI-VIS05-art-direction-morrowind-transposition.md) |
| RI-VIS06 | The blind comparison protocol — two protocols, one per side of the bifurcation | 70-visual | structure | neutral | constructed | high | yes | `render.process.bifurcation` `render.art.palette` `render.fidelity.materials` | [corpus/70-visual/RI-VIS06-blind-comparison-protocol.md](../../corpus/70-visual/RI-VIS06-blind-comparison-protocol.md) |
| RI-VIS07 | The "could this be Skyrim?" test — the art-direction failure detector | 70-visual | text | morrowind | constructed | high | yes | `render.art.mood` `render.art.silhouette` `render.art.palette` `render.art.architecture` `render.art.flora` `render.art.creature` | [corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md](../../corpus/70-visual/RI-VIS07-could-this-be-skyrim-test.md) |
| RI-VIS08 | Character, creature and animation fidelity — model quality, silhouette readability, and the tells of bad Three.js character work | 70-visual | number | modern-fidelity | constructed | high | yes | `render.fidelity.character` `render.art.silhouette` `render.fidelity.animation` `combat.attack.commitment` `render.art.creature` | [corpus/70-visual/RI-VIS08-character-animation-fidelity.md](../../corpus/70-visual/RI-VIS08-character-animation-fidelity.md) |
| RI-MTH01 | The harness API surface — what a critic can and cannot measure | 80-methods | structure | neutral | constructed | high | no | `platform.determinism.harness` `platform.input.pipeline` `platform.save.persistence` `combat.camera.behaviour` `platform.load.streaming` | [corpus/80-methods/RI-MTH01-harness-api-surface.md](../../corpus/80-methods/RI-MTH01-harness-api-surface.md) |
| RI-MTH02 | Determinism and reproducibility as a judged property | 80-methods | trace | neutral | constructed | high | no | `platform.determinism.harness` `platform.save.persistence` | [corpus/80-methods/RI-MTH02-determinism-reproducibility.md](../../corpus/80-methods/RI-MTH02-determinism-reproducibility.md) |
| RI-MTH03 | The blind-comparison protocol | 80-methods | structure | neutral | constructed | high | no | `process.critic.discipline` `process.verdict.format` `render.fidelity.materials` `render.art.palette` `dialogue.voice.register` `quests.structure.stages` `combat.feedback.hitstop` | [corpus/80-methods/RI-MTH03-blind-comparison-protocol.md](../../corpus/80-methods/RI-MTH03-blind-comparison-protocol.md) |
| RI-MTH04 | Measurement integrity — proving the critic actually ran the thing | 80-methods | structure | neutral | constructed | high | no | `process.critic.discipline` `process.verdict.format` | [corpus/80-methods/RI-MTH04-measurement-integrity.md](../../corpus/80-methods/RI-MTH04-measurement-integrity.md) |

---

## 6. Front-matter and contract problems

| Level | File | Problem |
|---|---|---|
| ERROR | `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "combat.player.heal" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "combat.resource.charges" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "progression.restsite.refill" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/10-combat/RI-CMB08-healing-flask.md` | judges: "combat.encounter.pacing" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "world.npc-schedules" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "world.ecology" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "world.ambient-events" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "npc.behaviour" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/50-world/RI-WLD08-the-living-world.md` | judges: "audio.ambient" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "lore.religion" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "lore.metaphysics" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "progression.souls" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "progression.levelling" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "progression.estus" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "combat.death" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "combat.respawn" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR05-religion-and-souls-metaphysics.md` | judges: "ui.terminology" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR06-contradiction-discipline.md` | judges: "lore.coherence" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |
| ERROR | `corpus/60-lore/RI-LOR06-contradiction-discipline.md` | judges: "critic.method" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item) |

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
