# Brief: weapons — movesets and per-weapon identity

**User direction, verbatim:** "One of the things souls games are known for is that each weapon has a subtly unique attack pattern and unique set of animations. Light attack, heavy attack, combos, roll-then-attack, backstep-then-attack, etc. Research this. Make sure this is included in the build, there is a dedicated harsh criticism evaluating our work on it, an appropriate bar to evaluate against, and that the bar critic thinks about and pushes on that bar as part of its review."

Also read: `corpus/10-combat/RI-CMB02` (attack frame data), `RI-CMB03` (stamina), `RI-CMB05` (poise/criticals), `RI-CMB06` (lock-on/directional roll), `corpus/15-camera/RI-CAM04`, and BAR-CRITIQUE-01 gap **G9** + wrong-bar **W8**. Those items own player frames — stay consistent, cite rather than restate.

**Research first** via WebSearch: the Souls moveset slot taxonomy (R1 chains, R2, two-handed variants, rolling/backstep/running/jumping attacks, kick, guard-break, parry/riposte, backstab, weapon arts); how weapon classes differ (arc, reach, recovery, poise damage, hyperarmour); and how From handles shared-vs-unique movesets within a class.

## Deliverables — `corpus/12-weapons/`
- **RI-WPN01** Moveset slot contract. Every attack slot a weapon MUST implement (id, trigger input, chains?, chain length, hyperarmour, stamina cost, poise damage, motion value). Ship it as a **JSON schema** that `game/data/weapons/**` serialises to. Closes hole `combat.attack.charge`.
- **RI-WPN02** Weapon-class differentiation matrix: ~12–16 classes × measurable properties. Headline measurable: a **behavioural fingerprint distance** between classes computed from harness traces — reuse RI-AI05's statistical method for consistency — with a minimum below which two weapons are "the same weapon with different numbers" and the item FAILS.
- **RI-WPN03** Within-class subtlety (the user's specific point): shared-moveset baseline, required deviations, how many weapons may share an animation set, and the measurable that detects "40 weapons, 3 animations".
- **RI-WPN04** Contextual attacks — roll-attack, backstep-attack, running, jumping. Input windows, per-class frame data, tactical role. **A slot that silently falls back to the standard light attack is a hard fail** — that is the specific fake to detect.
- **RI-WPN05** Weapon feel: hitstop frames by weight, impact by material (flesh/chitin/stone/shield), whiff feel, mass in the animation. Partially closes BAR-CRITIQUE **G5** ("nothing judges impact").
- **RI-WPN06** Two-handing (a distinct moveset, not a damage multiplier), shields, offhand, parry/riposte. Cite RI-CMB05.
- **WEAPON-CRITIC.md** — charter for the dedicated harsh critic: fresh context, drives every slot of every weapon through the harness, extracts animation ids and frame data from traces, computes the matrix, and tries to falsify every governing bar. State plainly that N weapons sharing a moveset with no variation fails regardless of frame-data quality.

Likely new subsystem root: `weapon.*` — list the full path set in your reply.

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
