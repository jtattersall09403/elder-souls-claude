# Brief: played experience and cross-system composition

**`PLAYTHROUGH-CRITIC.md`, `RI-EXP01` and `RI-EXP02` already exist** — read them, match their shape, do not rewrite them.

Closes BAR-CRITIQUE-01 **G1**, **G2**, **G3**. Read those gaps in full.

- **G1:** the only whole-game playthrough is commissioned by the coherence agent, which is simultaneously *barred from judging quality* — its out-of-remit column reads "A boss being unfun". A build can score at the bar on all 71 items and be competent, correct and dead.
- **G2:** AR-1/AR-2 police leakage but nothing requires the halves to **touch**. Nineteen seams systematically *decouple* fight from world. A build can pass every leakage check and be two products stapled together. (AR-3 now exists in ARBITRATION §3 — you own the item it defers to.)
- **G3:** ten-plus automatic fails all point at closing loopholes; nothing points the other way. **Morrowind is a cult classic substantially because it can be broken.**

## Deliverables — `corpus/95-experience/`
- **RI-EXP03** Session shape and the 20-hour pacing curve: per-hour event-type histograms from a full playthrough log against a required shape, including the mid-game sag both reference games have and how they survive it.
- **RI-EXP04** The novelty curve — how often the game shows something never shown before, and how that rate must **decay** rather than stay flat. **Amends wrong-bar W1** (RI-WLD05's "22 of 30 strangeness elements in the first 30 minutes" forces a flat surprise curve neither reference game would pass). Specify the curve, the measurement, and the long-tail rule that the final hour must still contain firsts. Propose the RI-WLD05 amendment in your reply; do not edit it.
- **RI-EXP05** Endings and the last hour: the final approach, the point of no return and its signalling, what the world says about what you did, and Morrowind's anticlimactic-but-earned quality.
- **RI-EXP06** The permissiveness budget — **≥12 sanctioned breakages** asserted to WORK and tested to keep working (alchemy loops, fortify-skill stacking, sequence breaks, killing someone important early, a utility spell skipping a designed route). Each with what it is, why it survives, what it costs the player, and a test that FAILS if the breakage stops working. Plus the governing rule: no new anti-exploit hard fail may be added anywhere without naming a sanctioned breakage it preserves. Argue the design position.
- **RI-CMP01** The cross-system payoff matrix (flagship for G2). A real matrix — systems on both axes (faction rank, disposition, gold, skills, spells, lore knowledge, stealth, quest state, world state, time of day, weather, equipment, level, upgrade tier, enemy roster, bosses, dungeon layout, NPC schedules, journal state) — each cell a specified interaction or an explicit "none", populated with real proposals for our game. Then the **numeric floor**, tiered: *trivial* (an NPC mentions a boss — does not count), *mechanical* (faction rank changes enemy aggro; a book reveals a boss's weakness; disposition opens a door that is otherwise a fight), *structural* (a questline resolvable by combat OR politics with different world outcomes — weighted heavily). Give the counting rule, the per-wave floor, and the measurement: static analysis over `game/data/**` plus harness probes verifying each claimed interaction **actually fires**. A claimed interaction that cannot be demonstrated firing scores zero — paper interactions are the easy fake.
- **RI-CMP02** Emergence: a harness fuzzing protocol combining systems in unplanned ways (lure an enemy into a faction camp, sell a quest item, bring a hostile NPC to a guard, use a utility spell where it wasn't intended) checking for a sensible non-degenerate result rather than a no-op or crash. **≥20 combination probes** with expected-outcome classes.
- **RI-CMP03** Build-identity payoff: N archetypes (heavy bruiser, dex duellist, spellsword, pure mage, stealth-alchemist, talker) each with a **full-game viability check** — main quest, a faction line, the hardest boss. Catches "build variety" that is three damage numbers.
- **CROSS-SYSTEM-BUILDER-BRIEF.md** — short, handed to every builder: your piece must create or carry ≥1 boundary-crossing interaction; here's the matrix, how to claim one, how it's verified.

New roots: `experience.*`, likely `composition.*` — list them in your reply.

## Binding reading
- `corpus/00-doctrine/ARBITRATION.md` — supreme rule, 19 seams, AR-1/AR-2/AR-3
- `corpus/00-doctrine/CORPUS-CONTRACT.md`, `CRITIC-DOCTRINE.md`, `SCORING.md`, `subsystems.json`
- `corpus/80-methods/HARNESS.md` — real `window.__HARNESS` API and `elder-souls/trace@1`

## Project
Browser Three.js game: **Morrowind in almost every system** set in **Black Marsh**, **Dark Souls combat**, **third-person** (S18). Souls level you; **gold is the only currency** (S15). ~1 hour to cross on foot. Original main quest, faction lines, many side quests, at Morrowind depth.

## Rules
- CORPUS-CONTRACT front-matter + all six mandatory sections on every RI-*.
- Canonical `judges:` paths only; list new paths/roots in your reply, never invent silently.
- `## Comparison method` executable against the real harness and `game/data/**`.
- Provenance honest: `canonical-recall` / `community-data` + citation / `constructed`. WebSearch works via ToolSearch `select:WebSearch,WebFetch`; direct page fetches usually 403.
- `## How we lose` brutally specific. No game code. Don't edit others' items or ARBITRATION.md.

## Local data on disk
- `corpus/40-dialogue/data/morrowind-dialogue.csv.gz` — 69,876 real dialogue rows
- `corpus/60-lore/data/argonian-dialogue-corpus.json` — 3,888 Argonian lines
- `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` — 6,299 UESP pages (`xz -dc` in /tmp only)
