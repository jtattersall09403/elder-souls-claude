# Brief: character creation, race, birthsign; stealth, theft, crime, justice

Closes BAR-CRITIQUE-01 gaps **G8** and **G10** and wrong-bar **W6**: stealth, crime and justice have **no subsystem paths at all** while three items depend on them, and character creation/race/birthsign have no path and no item while two items depend on them.

Read: `corpus/20-progression/RI-PRG02` (stats), `RI-PRG03` (skills), `corpus/30-quests/RI-QST05` (non-combat resolution — it *depends on you*), `corpus/40-dialogue/RI-DLG04` (disposition/persuasion). Seams S3, S10, S15, and the amended §1 (a fight must have non-lethal exits) all bear on this.

## `corpus/22-character/`
- **RI-CHR01** Character creation. Morrowind's opening *is* character creation — the census office, the questions, name/race/class/birthsign, the custom class builder. Souls' is a loadout, not an identity. Morrowind wins. Specify the flow, what it changes, irreversibility, and the property that class shapes but never locks a build. Measurable: count of meaningfully distinct starting configurations, end-to-end viable.
- **RI-CHR02** Race, and what race means **in Argonia** — not cosmetic and not neutral. Argonians are the majority; everyone else is a visitor, a coloniser, or cargo, and a Dunmer player carries the slave trade on their back. Specify playable races with real stat/skill/ability/resistance profiles, and — the important part — **how race changes the world's reaction**: base disposition per faction and settlement, dialogue that differs, quests that open or close, prices, guard behaviour. Major **AR-3** contributor (a world property that changes fights, via who attacks you). Use `corpus/60-lore/data/argonian-dialogue-corpus.json` for the real register.
- **RI-CHR03** Birthsigns rooted in Hist cosmology, not Imperial constellations. **At least two must carry a real drawback** (cf. The Atronach). Closes hole `progression.build.identity`.

## `corpus/23-stealth-crime/`
- **RI-STL01** Detection model (light, sound, LOS, distance, sneak skill gating *access* never to-hit per S3), sneak state, NPC search on losing you, and how stealth feeds Souls combat — backstabs/ripostes already exist in RI-CMB05/RI-AI03. Rule the seam: opening a fight from stealth is Souls; *avoiding* it is Morrowind.
- **RI-STL02** Theft, lockpicking, pickpocketing, ownership of every object, trespass, fencing. **Rule explicitly** whether lockpicking keeps a probability roll — S1 bans to-hit dice *in combat*; lockpicking is outside it. Justify either way.
- **RI-CRM01** Crime, witnesses, bounty per crime type, guard response, the arrest interaction (pay/resist/jail) and jail's skill cost, faction consequences, and the S10 interaction (killing a witness is a legitimate response — handle it). Bounty must survive death/respawn; specify.
- **RI-CRM02** Faction crime — sanctioned murder, writs, the Morag Tong problem, and how membership changes guard behaviour. Direct AR-3 contributor.

New roots: `character.*`, `stealth.*`, `crime.*` — list full path sets in your reply.

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
