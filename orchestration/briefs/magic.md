# Brief: magic

**Closes BAR-CRITIQUE-01 gap G4:** magic did not exist in the taxonomy — one path, and it was a hole — while three items already depended on it (RI-WLD05 lists levitation as systemic strangeness, RI-PRG05 prices spells, RI-PRG03 gates them). Seam **S19** now rules it; you are its corpus owner. Read S19 and S7 (they were contradictory and are now reconciled — magic teleports are part of the travel network).

Also read: `corpus/20-progression/RI-PRG02` (stat sheet), `RI-PRG03` (skills), `RI-PRG05` (gold economy), `corpus/10-combat/RI-CMB01`, `RI-AI02` (telegraph law), `corpus/60-lore/RI-LOR05` (Hist metaphysics constrain what magic *is* here).

## Deliverables — `corpus/25-magic/`
- **RI-MAG01** Combat casting as a Souls action: cast frames per spell weight class, the resource (rule on FP-style bar vs stamina and justify), casting under lock-on, movement during cast, interrupt/poise interaction, spell hitboxes as geometry not dice, enemy casters obeying RI-AI02's telegraph law. Fills declared hole `combat.magic.casting`.
- **RI-MAG02** The effect catalogue — Morrowind's genius is the combinatorial effect list, not named spells. Produce the full catalogue as **machine-readable JSON** (effect, school, magnitude/duration/area params, cost formula). **Rule on the level-design breakers**: levitation and teleport effects. Do not simply delete them (the sterile choice) — design them bounded and interesting, consistent with S7/S19.
- **RI-MAG03** Spellmaking and enchanting — the maker's systems. Combine effects, set magnitude/duration/area, price formula, skill gates, failure cases. **Soul gems are a real seam problem**: souls are our levelling currency (S15) — rule on how soul gems coexist with that. Coordinate with RI-EXP06's permissiveness budget: name which magic breakages are **sanctioned** and must keep working.
- **RI-MAG04** Magic as quest solution — load-bearing for the ≥45% non-combat resolution bar. Required count of magic-solvable quests, diversity requirement (no single effect solving everything), static analysis over `game/data/quests/**` against `corpus/30-quests/quest.schema.json`. Direct **AR-3** seam-crossing contributor — say so.
- **RI-MAG05** Magic VFX, split per the bifurcation (read `corpus/70-visual/RI-VIS01`): VFX *quality* is FIDELITY (modern refs); spell *design language* is ART DIRECTION (Morrowind + Black Marsh — organic, fungal, Hist-derived, wet; not generic elemental sparkles). Declare both, keep them apart.

New root `magic.*` — list the full path set in your reply.

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

