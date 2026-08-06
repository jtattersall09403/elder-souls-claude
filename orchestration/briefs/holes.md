# Brief: close the last 14 corpus holes

`node tools/corpus-index.mjs --check` reports **0 errors and 0 unresolved paths** after the audit,
but **14 canonical subsystem paths still have no reference item judging them**. Per
CORPUS-CONTRACT §4, *a subsystem with zero judging items is a corpus hole and the builder must not
start until the hole is filled*. So these 14 are, right now, the exact set of things nobody is
allowed to build. Wave 1 is gated on them.

## The 14

| Path | Why it matters |
|---|---|
| `combat.dodge.recovery` | The frames after a roll ends — where punishes land. Souls-critical. |
| `combat.stamina.exhaustion` | What happens at zero stamina: guard break, the exhausted state, recovery. |
| `combat.status.buildup` | Poison/rot/bleed/frost buildup meters and their procs (S11 splits this). |
| `combat.input.latency` | Input-to-action latency as a combat-correctness property. |
| `progression.affliction.economy` | Diseases with names, causes and cures — Morrowind's affliction system. |
| `quests.resolution.exclusive` | Mutually exclusive resolutions: choosing one closes another. |
| `quests.state.persistence` | Quest/journal/faction/world flags surviving death, rest, save/load (S6). |
| `world.region.transition` | What happens at a region border — tone, difficulty, streaming, legibility. |
| `world.interior.continuity` | Interiors matching their exteriors; door-to-cell coherence. |
| `world.strangeness.architecture` | The built alienness — the architecture half of the strangeness bar. |
| `world.hazard.environment` | Environmental hazards: drowning, tides, sinking mud, spore clouds, disease water. |
| `world.water.marsh` | **The game is set in a marsh.** Water depth tiers, wading, swimming, what water does to combat and traversal. Arguably the most conspicuous hole in the corpus. |
| `lore.canon.argonian` | Argonian canon as a judged property — naming, Hist relationship, culture. |
| `lore.canon.geography` | Black Marsh geography as a judged property against canon. |

## What to do

For each, either:

**(a) Write a reference item** in the right area, following CORPUS-CONTRACT exactly (front-matter +
all six mandatory sections), with an executable `## Comparison method` against the real harness and
`game/data/**`. Reuse existing canonical `judges:` paths — the taxonomy is now complete at 323
paths and you should not need new ones. If you genuinely do, list them in your reply.

**or (b) Explicitly accept the hole in writing** in `corpus/00-doctrine/ACCEPTED-HOLES.md`, with the
path, why no bar is needed, what the risk of not judging it is, and who accepted it. This is a
legitimate outcome for a path that is genuinely covered by another item under a different name —
but it is **not** legitimate for anything load-bearing, and `world.water.marsh` in a marsh game is
not acceptable as an accepted hole.

Prefer (a). Several of these are small and can share an item where they are genuinely one subject —
e.g. `lore.canon.argonian` and `lore.canon.geography` may be one canon-conformance item judged
against `corpus/60-lore/data/blackmarsh-canon.json` (which now holds 194 real places, 66 creatures,
471 NPCs and 147 lore facts mined from UESP).

## Read first

- `corpus/00-doctrine/ARBITRATION.md` — **23 seam rulings now**, including S22 (all combat
  durations rebase to 60 Hz; upstream frame counts are 1/30 s) and S23 (equip load split by
  domain). Anything you write in the combat area must obey S22.
- `corpus/00-doctrine/CORPUS-CONTRACT.md`, `CRITIC-DOCTRINE.md`, `subsystems.json`
- `corpus/00-doctrine/CORPUS-COHERENCE-01.md` — the audit ledger; do not contradict its rulings
- `corpus/80-methods/HARNESS.md` — the real API and trace schema
- `corpus/10-combat/data/souls-frame-data.json` — verified upstream figures with sources, for the
  combat items
- `corpus/60-lore/data/blackmarsh-canon.json`, `argonian-names.json` — for the lore items
- `corpus/50-world/regions.json`, `settlements.json`, `world-scale.json` — for the world items

## Rules

- Provenance honest. Internet is unrestricted — **verify rather than recall**, and cite URLs.
- Do NOT edit other agents' items; propose amendments in your reply.
- Follow `orchestration/AGENT-PROTOCOL.md`: status file first, write incrementally, bank findings.

## The one to get right

> **CORRECTED wave 0 (rebase-s22), ARBITRATION seam **S24**.** ~~"Our entire world is standing
> water"~~ **is false and was an orchestrator misstatement.** Black Marsh is the *name*, not the
> terrain: `corpus/50-world/black-marsh-map-source.jpg` and `corpus/50-world/regions.json` define
> **thirteen** regions — mountains at Valus Ridge, the arid Stone Wastes, Blackwood jungle, the
> petrified Stone Forest, the dry Clay Moor, the red Crimson Coast, the two Rootlands, the Hive,
> the Deep Marshes, Marauder's Coast, the Salt Hills, and two different seas. `RI-WLD10` §7 (the
> item this brief commissioned, which caught the error itself) records **five regions with a tide
> and eight without**, and two with a water-class index of exactly **0.00**. Water is a property
> of *some* regions. Any agent reading this brief must treat the sentence below as scoped to the
> wetland regions.

**`world.water.marsh`.** ~~Our entire world is standing water~~ **Several of our thirteen regions
are wetland — and several emphatically are not** — and there is currently no bar for what
water *is* — how deep it gets, what wading does to movement and stamina, whether you can fight in
it, whether it hides you, what swimming costs, how tides change routes (RI-TRV01 already has a
high-tide-only barge run and a walking tideway that is its inverse), and what it looks like. Give
it the depth it deserves.
