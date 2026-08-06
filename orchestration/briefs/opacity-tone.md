# Brief: the opacity budget, and tonal range

Closes BAR-CRITIQUE-01 **G11** and **G12** — the two gaps closest to *why Morrowind is a cult classic*, which the corpus is blind to because every existing bar pushes toward legibility and consistency.

**G11 — no opacity budget.** Every bar pushes toward legibility: prose directions, discoverable rumours, readable telegraphs, signposted junctions, reachable topic graphs. **Nothing protects mystery.** Morrowind is loved substantially for what it *refuses to explain*. A game passing every current bar would be maximally legible and would have lost the thing.

**G12 — tone is checked for consistency, never existence.** RI-DLG06 measures whether voices *differ*; the coherence agent checks tone doesn't *drift*. Nothing checks the writing has a tone worth having.

Read: `corpus/50-world/RI-WLD02` (density), `RI-WLD05` (strangeness), `RI-WLD06` (navigation); `corpus/40-dialogue/RI-DLG01..07`.

## `corpus/50-world/RI-WLD09` — the opacity budget
Specify with numbers: **unexplained things** (places/objects/creatures/ruins never explained anywhere — a critic finding an explanation has found a defect); **assembled lore** (facts existing only as the intersection of ≥3 sources, never stated directly, with the static analysis proving no single source states it); **unanswered questions** (the main quest may not answer all its own); and **deliberate emptiness** — this also fixes wrong-bar **W2**, since RI-WLD02's global density floors make sustained emptiness illegal, and Vvardenfell is not uniformly dense. Specify how much of the map must be sparse, minimum tract size, and **how a critic distinguishes designed emptiness from unbuilt world** — solve this properly, e.g. a manifest of intentional voids declared in `game/data/` and matched against measured density.

**The crux — anti-gaming:** the obvious failure is leaving things unexplained because nobody wrote the explanation. Distinguish *designed* opacity from *absent* content rigorously — e.g. every intentional mystery registered with a **sealed authorial answer that exists in the corpus but never in the game**, so a critic can verify the mystery is deliberate and coherent without the game ever revealing it.

Also propose (do not edit) the **RI-WLD05 amendment** for wrong-bar **W1**: "22 of 30 strangeness elements in the first 30 minutes" mandates a flat surprise curve neither reference game would pass.

## `corpus/40-dialogue/RI-DLG08` — tonal range and the indifference ratio
**Use the real corpus on disk** (`corpus/40-dialogue/data/morrowind-dialogue.csv.gz`, 69,876 rows) and measure, don't recall: sentence length distribution, subordinate clause rate, adjective density, absence of contemporary idiom, rate of second-person address.

**The indifference ratio** is the headline metric: in Morrowind most NPCs do not care about you. Measure the real proportion of dialogue that is dismissive/indifferent/transactional/hostile versus deferential/helpful, and set ours against it. A game where every NPC is pleased to see you is a modern RPG, not Morrowind.

Also: **anti-registers** with detectors (quippy banter, modern idiom, self-aware humour, exclamation rate, NPCs complimenting the player, chosen-one deference before it is earned, tutorialising in dialogue) as a lint that fails the build; the **good-bad writing property** (Morrowind's over-formal, stilted, occasionally purple prose is part of its charm — distinguish it from *bad* writing, honestly, reusing RI-DLG07's blind infrastructure); and **tonal range** — required counts of registers other than the dominant one (a comic NPC, a frightening text, a beautiful one, a boring bureaucratic one), because a monotone world is as dead as an inconsistent one.

## Binding reading (all agents)
- `corpus/00-doctrine/ARBITRATION.md` — supreme rule, 19 seam rulings, AR-1/AR-2/AR-3
- `corpus/00-doctrine/CORPUS-CONTRACT.md` — front-matter + six mandatory sections; provenance honesty
- `corpus/00-doctrine/CRITIC-DOCTRINE.md`, `SCORING.md`, `subsystems.json` (canonical `judges:` paths ONLY)
- `corpus/80-methods/HARNESS.md` — the real `window.__HARNESS` API and `elder-souls/trace@1`

## Project
Browser Three.js game: **Morrowind in almost every system** set in **Black Marsh**, with **Dark Souls combat**, **third-person** (S18). Souls level you; **gold is the only currency** (S15). ~1 hour to cross on foot. Original main quest, faction questlines, many side quests, at Morrowind depth.

## Rules
- CORPUS-CONTRACT front-matter + all six mandatory sections, exactly, on every RI-* file.
- Canonical `judges:` paths only; **list any new path or root in your reply** — never invent silently.
- `## Comparison method` must be **executable**: real harness calls, real trace fields, real static analysis over `game/data/**`. Request harness/trace extensions in your reply.
- Provenance honesty: `canonical-recall` (verify via ToolSearch `select:WebSearch,WebFetch`; direct fetches usually 403, search summaries work), `community-data` + citation, or `constructed` (equally binding).
- `## How we lose` brutally specific to a naive Three.js build.
- Do NOT write game code. Do NOT edit other agents' items or `ARBITRATION.md` — propose amendments in your reply.

## Local data already on disk (use it)
- `corpus/40-dialogue/data/morrowind-dialogue.csv.gz` — 69,876 real Morrowind dialogue rows
- `corpus/60-lore/data/argonian-dialogue-corpus.json` — all 3,888 Argonian-voiced lines
- `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` — 6,299 UESP pages. `xz -dc` in /tmp, never into the repo.
