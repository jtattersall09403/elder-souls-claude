# Build plan — waves, pieces, and how each is judged

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

## The wide-before-deep constraint

The world is traversable end to end and the main quest completable from **Wave 1**
onward. No later wave is allowed to leave a region or a questline unbuilt — later waves
only *deepen* what already exists. At every wave boundary the game is playable start to
finish.

## Wave structure

| Wave | Goal | Invariant at wave end |
|---|---|---|
| 0 | Reference corpus + measurement harness | Every subsystem has a bar; no corpus holes |
| 1 | Skeleton of everything: full map traversable, all 8 settlements standing, combat loop real, main quest completable end to end, one quest per faction | You can walk Argonia and finish the game |
| 2 | Combat depth + enemy roster + bosses to the Souls bar; full faction questlines; dialogue topic webs per settlement | Every faction line completable; combat passes frame-data critics |
| 3 | Density and strangeness: interiors, dungeons, side quests, books, ambient life, rumour networks | Density metrics hit; world is strange, not generic |
| 4 | Visual fidelity to the modern bar; art direction to the Morrowind bar | Blind visual comparisons close |
| 5+ | Whatever the gap ledger still holds | Ledger empty |

## Piece decomposition (Wave 1)

Each is one builder + one critic, judged against the named subsystem paths.

- `world.terrain` — heightmap, regions, biomes, scale from the traversal budget
- `world.settlements` — 8 settlements placed, walkable, named
- `world.navigation` — roads, landmarks, signposts, no markers
- `combat.core` — stamina, roll i-frames, committed attacks, hitboxes, lock-on
- `combat.enemy.ai` — telegraph/punish loop, first archetypes
- `progression.souls` — soul yield, level curve, stat sheet
- `progression.hearth` — bonfire analogue, rest, corpse run
- `dialogue.topics` — topic graph engine, disposition, greetings
- `quests.engine` — quest state machine, journal, gating
- `quests.main` — original main quest, completable
- `quests.factions` — one quest per faction line, all lines present
- `render.fidelity` — PBR, tonemapping, shadows, fog, water, foliage
- `render.artdirection` — palette, architecture, silhouettes per region
- `lore.canon` — canon registry wired to dialogue and books

## Rules binding on every builder

- Read your reference items **before** writing code. You are judged against them, not
  against your taste.
- All content lives in inspectable JSON under `game/src/data/` so critics can analyse it
  without running the game.
- The simulation is deterministic: seeded RNG only, fixed 60Hz step, no wall-clock.
- The harness API on `window.__HARNESS` is a hard requirement, not a nice-to-have.
- The Arbitration Rule is not negotiable and not re-litigable.
