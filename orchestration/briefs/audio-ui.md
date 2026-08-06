# Brief: audio and user interface

Two areas with almost no coverage. Canonical paths: `audio.combat.impact`, `audio.ambience.region`, `audio.music.policy`, `audio.voice.policy`; `ui.hud.combat`, `ui.hud.minimalism`, `ui.menu.inventory`, `ui.menu.journal`, `ui.menu.levelup`, `ui.menu.books`, `ui.dialogue.presentation`, `ui.style.diegesis`.

## `corpus/87-audio/` — audio sits on BOTH sides of the arbitration line
**Souls owns combat audio.** Impact sound is combat *feedback*, not decoration — it is how the player knows a hit landed, was blocked, parried or whiffed. It is frame-critical: sound fires on the hitbox-connect frame, not animation start, and latency is a correctness bug. Souls audio is also famously sparse — footsteps and breathing are what make the boss roar land.
**Morrowind owns everything else.** Ambience is regional identity; music is sparse and place-based, not wall-to-wall combat orchestra.

- **RI-AUD01** Combat impact as frame-critical feedback. Distinct sound classes distinguishable blind (light hit on flesh, on armour/chitin, blocked, parried, whiffed, riposte, taking damage, stamina break, backstab). Measurable: audio-event timestamp vs hitbox-connect frame (**≤1 frame**), blind class-distinguishability, dynamic range so a hit isn't as loud as a whiff. Partially closes BAR-CRITIQUE **G5** ("nothing judges impact") — note `combat.feedback.hitstop` currently mis-maps to RI-MTH03, a protocol document.
- **RI-AUD02** Web Audio constraints and budget: AudioContext unlock, `interactive` latency mode, scheduling ahead rather than on-frame, voice-count limits, the `new Audio()`-per-hit anti-pattern (latency + GC churn — specify detection), spatialisation, and the rule that scheduling is not coupled to rAF.
- **RI-AUD03** Regional ambience as identity: each region identifiable **by sound alone**. Bed structure (base drone, mid layer, event layer, creature calls), per-region briefs for the Black Marsh regions in `corpus/50-world/regions.json`, and a blind test mirroring the visual "could this be Skyrim" test — 20s of ambience, no label, name the region.
- **RI-AUD04** Music policy. Resolve the seam explicitly: boss music is inside the fight (Souls wins); overworld music policy is outside (Morrowind wins). Measurable: **% of playtime with music playing must be LOW** — specify the band; ordinary-enemy combat triggers NO music; boss music tied to the fog gate.
- **RI-AUD05** Voice policy. Full VO is out of scope and that is **correct, not a compromise** — Morrowind's text-first dialogue is exactly what the arbitration rule protects, and VO at 200-quest scale would force dialogue cuts. Then specify what audio dialogue *does* exist: greeting vocalisations, Argonian hisses and Jel phonemes, effort/pain/death vocalisations (Souls-side, frame-relevant), merchant barks, crowd murmur, plus a per-archetype vocal palette and the measurable that stops every NPC sharing one grunt.
State plainly: **unimplemented audio scores 0, not "not assessed"**. Request the harness audio-event log (`window.__HARNESS.audioLog()` → `{t, frame, event, class, gain, voice_id}`) explicitly in your reply.

## `corpus/86-ui/`
- **RI-UIX01** Combat HUD: what Souls shows (HP/stamina/flask, lock-on reticle, status buildup) and what it does NOT (no damage numbers, no floating names, no minimap, no markers). Stamina readability is a combat-correctness property. Measurables: element count, screen coverage %, stamina-bar contrast, same-frame bar update.
- **RI-UIX02** No-marker enforcement (S8): the automated screenshot check that detects marker-like UI, and the data check that no quest carries a HUD-destined coordinate.
- **RI-UIX03** Inventory: a place of stuff, encumbrance visible, real item descriptions — and per S14 it does **not** pause the world during combat. Resolve and specify.
- **RI-UIX04** The journal UI: numbered dated entries in the player's voice, chronological, searchable by topic; **no objective list, no quest tracker, no map pins**. This is where a modern-UI instinct most badly breaks Morrowind — make the check sharp.
- **RI-UIX05** Books and readable text: page turns, typography, reading as a real activity, books as a primary lore vector.
- **RI-UIX06** Diegesis and UI style: it must belong to Black Marsh (chitin, root, ink, bone, wet parchment), not a generic HUD or a bootstrap panel. **Note the bifurcation** (read `corpus/70-visual/RI-VIS01`): UI *style* is art direction (Morrowind); UI *rendering quality* (text crispness, DPI scaling, no blurry canvas text) is fidelity. Declare both, keep them apart.

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
