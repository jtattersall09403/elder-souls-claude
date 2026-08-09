# Brief: user journeys, the journey-critic fleet, and the platform budget

**RI-JRN01 already exists** — read it, match its shape, do not rewrite it.

**User direction:** "a fan of multiple subagents, who are also harsh critics, testing and criticising specific user journeys against appropriately high bars. E.g. the new game flow — is it good enough vs Morrowind's famously brilliant opening. Are the controls intuitive and do they work — on desktop *and* on mobile with a controller attached (a **GameSir X2s Type-C** telescopic gamepad). Does saving and loading work correctly."

## `corpus/88-journeys/` — one item per journey
- **RI-JRN02** The first hour as a journey (the *interaction* view; `corpus/95-experience/RI-EXP01` owns the *beat* view — cite, don't duplicate).
- **RI-JRN03** Desktop controls: pointer lock, WASD+mouse, the full Souls action set, discoverability, rebinding, and a **first-time-user protocol** where a fresh agent gets the game and no documentation. Browser hazards: pointer-lock loss, key ghosting, Escape stealing focus, context menu, layout assumptions.
- **RI-JRN04** Mobile + attached gamepad. Research the **GameSir X2s Type-C** via WebSearch: Gamepad API exposure, standard mapping, button indices, analog axes, triggers. Specify the full button map for our action set, deadzones, trigger thresholds, hot-plug/disconnect, and no-gamepad fallback. Plus mobile reality: landscape lock, safe areas/notch, browser chrome, touch fallback, and a phone GPU. Specify how the harness injects Gamepad API state for automated testing.
- **RI-JRN05** Save/load. Correctness is binary. Save mid-quest, mid-dungeon, post-rank-up, with a bounty and an active journal; load; verify **every** piece of state survives. Define the state manifest, corruption tests, and **rule on the storage backend** (IndexedDB vs localStorage vs file download) for a 200-quest world. Browser hazards: quota, private browsing, eviction, tab closed mid-write. **Measurable: a round-trip state diff must be empty.**
- **RI-JRN06** Death and recovery: die → lose souls → respawn at HEARTH → run back → recover bloodstain, end to end.
- **RI-JRN07** The quest journey without markers — hear a rumour → find the giver → prose directions → navigate by landmark → resolve → journal updates. THE Morrowind journey, and the one a modern instinct most easily breaks. A fresh agent must complete it using only in-game text.
- **RI-JRN08** Returning after a week: from a cold mid-game save, can a fresh agent determine its objectives from in-game information alone?
- **JOURNEY-CRITIC-FLEET.md** — the charter: one harsh critic per journey, fresh context, only its own reference item + the harness; evidence required (screenshots, traces, state diffs, timing logs); each must try to falsify the work and may PASS only against the evidenced bar; how verdicts aggregate. Define the **enforced first-time-user protocol** — some journeys can only be judged by an agent that has not read the corpus.

## `corpus/85-platform/` — closes BAR-CRITIQUE **G13** ("good for a browser game" is a banned defence)
- **RI-PLT01** Frame budget as a **combat-correctness** requirement: below stable 60fps, i-frame windows and telegraph reads become unreliable. Target fps, p1/p0.1 frame times, variance ceiling, "no frame over 33ms in combat", GC pause budget (per-frame allocation in the sim loop is a defect — specify detection), and the rule that the fixed 60Hz sim must not slow when render does.
  **Environmental fact:** this container renders via SwiftShader software rasterisation, and HARNESS.md already declares scoring measured FPS here a hard error. Design metrics that survive that — draw calls, triangles, material/shader count, texture memory, allocations/frame, CPU sim time measured independently of GPU — and state clearly which metrics are valid here vs which need real hardware.
- **RI-PLT02** Memory, asset budgets, and a 10-minute traversal leak test (heap returns to baseline after forced GC). Sized for a **phone**, not a workstation.
- **RI-PLT03** Load, streaming, hitches: time to first playable, no stutter at region borders, hitch count per traversal minute.

New roots likely: `journey.*`, possibly `input.*`. `platform.*` already exists.

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
