# Brief: travel — the fast-travel network as a built, judged system

**This closes a critical intent drift (ID-02/ID-17).** Seam **S7** was originally drafted as "no fast travel", which inverted the user's intent. It is now corrected and *mandates* a Morrowind-style network — but **no reference item owns it**, and every travel-related check in the corpus still tests only for ABSENCE of warping. That asymmetry means a build with no travel system at all would pass every existing check.

Read **S7 in ARBITRATION.md** (and S19's reconciled teleport clause) before anything else.

## Deliverables — `corpus/50-world/`
- **RI-TRV01 — The transport network.** Morrowind's actual systems, transposed to Black Marsh: a silt-strider analogue on fixed routes between settlements, a boat/barge network on the rivers and coast (this world is a marsh — water travel should be *primary*, not decorative), and guild-guide teleport for faction members. Specify: the **route graph** (which of the 8 settlements + 16 minor sites connect to which, by which mode — derive from `corpus/50-world/settlements.json` and `world-scale.json`), fares in gold tuned against `corpus/20-progression/RI-PRG05`'s economy, in-world time cost, where stations physically sit in each settlement, and the rule that you must have walked a route once before you can ride it. Measurables: graph connectivity (is any settlement stranded?), mean fare as a fraction of early-game income, ratio of network travel time to walking time, and the check that no route drops you at a quest objective.
- **RI-TRV02 — Travel magic and the S19 reconciliation.** Mark/Recall and an Intervention-style effect as **part of the travel network**, obeying its rules: known places only, above ground, out of combat, never into or within a dungeon/boss arena/locked area. Specify the spells, their costs, their gating, and the **detector** for teleport-as-level-design-solvent (recall out of a fight, warping past an unopened shortcut). Also: the positive test that these spells *exist and work*, since the corpus currently only tests that warping is absent.

**Important framing:** every check you write must be **two-directional** — it must fail both when the network is missing and when it degenerates into warp-to-map-pin. Say so explicitly; the one-directional checks are the drift being corrected.

## Binding reading (all agents)
- `corpus/00-doctrine/ARBITRATION.md` — supreme rule, 19 seam rulings, AR-1/AR-2/AR-3
- `corpus/00-doctrine/CORPUS-CONTRACT.md` — front-matter + the six mandatory sections; provenance honesty
- `corpus/00-doctrine/CRITIC-DOCTRINE.md`, `SCORING.md`, `subsystems.json` (canonical `judges:` paths ONLY)
- `corpus/80-methods/HARNESS.md` — the real `window.__HARNESS` API and `elder-souls/trace@1`

## Project
Browser Three.js game: **Morrowind in almost every system** (quests, factions, dialogue, journal, lore, world design, systems depth, strangeness) set in **Black Marsh**, with **Dark Souls combat**, **third-person** (seam S18). Souls level you; **gold is the only currency** (S15). ~1 hour to cross on foot. Original main quest, faction questlines, many side quests, at Morrowind depth.

## Rules
- CORPUS-CONTRACT front-matter + all six mandatory sections, exactly, on every RI-* file.
- Canonical `judges:` paths only. If you need a new subsystem path or root, **list it in your reply** for the taxonomy owner — never invent silently.
- `## Comparison method` must be **executable**: real harness calls, real trace fields, real static analysis over `game/data/**`. Request harness/trace extensions explicitly in your reply.
- Provenance honesty is non-negotiable: `canonical-recall` for recalled facts (verify via ToolSearch `select:WebSearch,WebFetch`; direct page fetches usually 403 here, search summaries work), `community-data` + citation when sourced, `constructed` for what you design (equally binding).
- `## How we lose` must be brutally specific to a naive Three.js build.
- Do NOT write game code. Do NOT edit other agents’ reference items or `ARBITRATION.md` — propose amendments in your reply.

## Local data already on disk (use it)
- `corpus/40-dialogue/data/morrowind-dialogue.csv.gz` — 69,876 real Morrowind dialogue rows (Race/Gender/SpeakerId/FactionId/FactionRank/Text)
- `corpus/60-lore/data/argonian-dialogue-corpus.json` — all 3,888 Argonian-voiced lines
- `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` — 6,299 UESP pages (4,961 Morrowind + 1,338 Black Marsh). `xz -dc` it in /tmp, never into the repo.

