---
id: RI-JRN06
title: Death and recovery, end to end — die, lose, respawn, run back, get it back
kind: structure
side: souls
judges: [journey.death.recovery, combat.death.corpserun, combat.death.worldreset]
provenance: constructed
confidence: high
blind_pair: no
---

> **This item judges a JOURNEY, not a subsystem.** It is one of eight in `corpus/88-journeys/`.
>
> **Division of labour, binding:** **`RI-PRG04` owns the rules** — what resting does, what
> dies on death, the bloodstain rules (one at a time, second death destroys the first, no
> timer, unreachable-death relocation), HEARTH spacing (2.0–11.0 min bounds, 28 shrines,
> fog-gate proximity 60–110 s), and what respawns. **This item owns the loop as a single
> executed sequence** and asks one question `RI-PRG04` cannot: *does it actually work, end to
> end, without losing anything, and does the run back feel like a run back rather than a
> punishment?* Where a number appears in both, `RI-PRG04` is authoritative and this item cites
> it. **`RI-JRN05` owns whether the bloodstain survives a save/load**; this item owns whether it
> survives a *death*. **`RI-QST04`/seam S6 own quest-state persistence across death**; this item
> executes the check. **`RI-JRN02` owns the first death as a teaching moment**; this item owns
> every death after it.
>
> **`blind_pair: no`.** The loop is Souls' outright (seam S6, `ARBITRATION.md` §1); there is
> nothing to compare against Morrowind, and comparing our corpse run to Dark Souls' as unlabeled
> artifacts would compare level design, not this loop.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

The player has 4,200 souls, has not levelled, and dies to the third enemy in a dungeon they
have half-cleared. What must happen, in order, with nothing lost and nothing added:

They die. Control is taken for a bounded, skippable moment. They are standing at the HEARTH
**they last rested at** — not the nearest one, not a helpful one. Their souls are 0. Their
flask is full. The ordinary enemies in that dungeon are alive again; the door they opened is
still open; the chest they emptied is still empty; the shortcut ladder they kicked down is still
down; the merchant they sold to still has their gold; the quest stage they advanced is still
advanced; the journal entry they earned is still there; the bounty they earned is still owed.
**Every one of those is a separate opportunity to lose state and every one of them is checked
individually below.**

They walk back. It takes two to three minutes and it crosses ground they now know, and because
they opened the shortcut on the way in it takes *less* time than the first descent. They reach
the spot. There is a bloodstain, visible from a distance, at the place they died — not at the
nearest navmesh node, not floating in geometry. They touch it and get **exactly 4,200** souls.

Or: they die again on the way back, and the 4,200 are gone forever, and the game does not
apologise, offer a retrieval item, or soften it. **That is the contract, and softening it is
the failure this item exists to catch**, because softening it is what every modern designer's
instinct says to do.

## The reference artifact

### A. `ES/DEATH` — the loop as a state sequence (BINDING)

| # | State | Requirement | Owner |
|---|---|---|---|
| **D1** | Lethal damage lands | HP reaches 0 on a specific frame, recorded in the trace as a `death` event with the killing hitbox id | this item |
| **D2** | Death is legible | The frame HP reached 0 is within **12 frames** of the last hit's active window. **No delayed death, no "you died from a hit two seconds ago"** — the player must be able to attribute the death to the swing they saw | this item |
| **D3** | Souls drop | 100% of unspent souls, as **one** bloodstain, at the player's position at D1, clamped to the nearest standable surface **within 2.0 m** | `RI-PRG04` |
| **D4** | Unreachable-death relocation | If the D1 position is unreachable, the stain relocates to the nearest reachable point *on the path toward it*. **Never deleted** | `RI-PRG04` |
| **D5** | Death surface | Duration **≤ 3.0 s**, skippable by any input on any device from its first frame (`RI-JRN01` O2). Contains no statistics, no tips, no "try dodging" | this item |
| **D6** | Respawn location | The **last HEARTH rested at**. Not nearest, not last passed, not a checkpoint auto-set by entering a room | `RI-PRG04` |
| **D7** | Respawn → controllable | **≤ 4.0 s** from the death frame including D5, on the reference class. This is the number that decides whether dying feels like a lesson or like a load screen | this item (consumes `RI-PLT03` for the streaming component) |
| **D8** | Player state on respawn | HP full, stamina full, flask charges full, Fatigue full, souls **0**, equipment untouched, quick-slot selection untouched, active effects with a duration **expired**, diseases **retained** | `RI-PRG04`, executed here |
| **D9** | World reset | Ordinary enemies respawn. **Named NPCs, quest actors and merchants do not, ever** (seam S5) | `RI-PRG04` / seam S5 |
| **D10** | World mutation preserved | Opened doors, kicked-down ladders, opened shortcuts, emptied containers, taken hand-placed items, lit/extinguished things, killed named NPCs, merchant gold pools | this item — the full list is `RI-JRN05` §B's `World` group and **must be identical to it** |
| **D11** | Progression preserved | Quest stages, quest flags, journal entries, faction rank, disposition, bounty, witnesses, topics known, discovered HEARTHs, transport nodes visited | seam S6, executed here |
| **D12** | The route back | From the respawn HEARTH to the death point: `RI-PRG04` bounds apply (≤ 11.0 min worst case; 3.0–5.5 min between consecutive HEARTHs on the critical path) | `RI-PRG04` |
| **D13** | The shortcut pays | If the player opened a shortcut before dying, the run back is **40–70% shorter** than the original descent | `RI-PRG04` |
| **D14** | Bloodstain visibility | Visible from **≥ 12 m** with clear line of sight, and from **≥ 6 m** in a dark interior. It is the target of the run; a stain the player cannot find is a stain they lose to geometry rather than to a second death | this item |
| **D15** | Recovery | `interact` at ≤ 1.8 m returns **exactly** the stored souls, in one event, with no animation the player can be interrupted out of losing them | this item |
| **D16** | Second death | The first stain is destroyed the instant the second death's stain is created. **No grace period. No retrieval item. No partial carry-over.** | `RI-PRG04` |
| **D17** | Persistence | The stain survives rests, region changes, quits, reloads and a browser restart until recovered or replaced | `RI-PRG04` + `RI-JRN05` |
| **D18** | No compensation | No "you lost X souls" toast, no consolation currency, no reduced-loss difficulty option, no insurance item | this item — **hard fail if present** |

### B. `ES/RUN` — the four runs (BINDING scenarios)

| Id | Scenario | What it exists to catch |
|---|---|---|
| **RN1** | **Ordinary death in a cave.** Die 200 m into a Morrowind-type cave with one door opened and one chest emptied. Recover. | The baseline. Catches world-mutation loss (D10) and stain placement (D3). |
| **RN2** | **Souls-loop dungeon with a shortcut.** Descend, open a shortcut, die deeper, respawn, take the shortcut back. | D13 — the shortcut must actually pay, which is the entire reason `RI-WLD07`'s closed/open ratio exists. |
| **RN3** | **Double death.** Die with 4,200 souls; die again on the run back; verify the first stain is gone and the second holds only what was carried at the second death (0, if nothing was earned). | D16, and the temptation to soften it. |
| **RN4** | **Death mid-everything.** Die with: a quest at stage 3 of 5, a bounty of 500 with two live witnesses, a disease incubating, an active 40-entry journal, a merchant who bought something from you, a named NPC you killed, and an unopened fog gate. Recover, then load a save taken before the death and compare. | D9/D10/D11 all at once. This is `RI-JRN05` SV5's twin and the two must agree. |
| **RN5** | **Death in an unreachable place.** Die in a one-way drop / resealed arena. | D4 — geometry may never destroy souls. |

### C. The feel constraint (BINDING, and it is a number)

The run back is the most-criticised mechanic in the reference game and the one most often
"improved" into meaninglessness. Two numbers keep it honest in both directions:

| Id | Quantity | Target | Fail |
|---|---|---|---|
| **R1** | `run_back_median` — HEARTH → death point, walking, over RN1/RN2/RN4 | **1.5 – 3.0 min** | > 4.5 min |
| **R2** | `run_back_p95` | ≤ **4.0 min** | > 6.0 min |
| **R3** | `encounters_on_run_back` — respawned hostiles between HEARTH and death point | **1 – 4** | 0, or > 6 |
| **R4** | `run_back_ratio` — run back ÷ original approach, **with** the shortcut opened (RN2) | **0.30 – 0.60** (`RI-PRG04` D13) | > 0.85 |
| **R5** | `deaths_to_stain_loss` — over a 20-death scripted session, fraction of stains lost to a second death | **0.10 – 0.35** | 0 (nothing is at stake), or > 0.60 (the loop is a shredder) |
| **R6** | `time_dead` — death frame → controllable frame | ≤ **4.0 s** (D7) | > 8.0 s |
| **R7** | `stain_find_time` — arrival within 15 m of the stain → recovery, median | ≤ **12 s** | > 30 s (D14 failed) |

**R3 = 0 is a failure, and this is the counter-intuitive one.** A corpse run through an empty
corridor is a loading screen the player walks through. The respawn rule (D9) exists so that the
run back is *play*, and if the route is empty the run back has no content and should be
shortened instead by moving the HEARTH.

## Comparison method

Run by `critic.combat` with `critic.progression` co-signing (fleet critic **JC-06**).

```bash
node tools/journey/journey-run.mjs --journey jrn06-death --seed 4711 \
     --scenario RN1,RN2,RN3,RN4,RN5 --deaths 20 --input-mode real \
     --out reports/journeys/<runId>
node tools/journey/state-diff.mjs --in reports/journeys/<runId> --mode across-death
```

Requires **`A-JRN1`**, **`A-JRN3`** (`getStateHash()` — the across-death diff is the same
instrument as `RI-JRN05`'s round-trip diff, pointed at a different transition) and **`A-JRN7`**
(`bloodstain_create` / `bloodstain_recover` trace events). Until they exist every check is
`unmeasurable` and scores **0**, fail-closed.

| # | Check | Procedure | Threshold |
|---|---|---|---|
| **M-D1** | **Souls conservation** | For 20 deaths: souls held at D1, souls in the `bloodstain_create` event, souls returned by `bloodstain_recover` | All three **exactly equal**, 20/20. **Hard fail: any discrepancy** — including a "rounding" one |
| **M-D2** | **Stain placement** | Distance from the D1 player position to the stain position; and whether the stain is on a standable surface | ≤ 2.0 m, 20/20; 0 stains inside geometry or in the air |
| **M-D3** | **Unreachable relocation (RN5)** | Die in a sealed/one-way location; path-find from the respawn HEARTH to the stain | Path exists; stain reachable; souls recoverable. **Hard fail: an unreachable stain** |
| **M-D4** | **Across-death state diff** | `getStateHash()` immediately before the killing blow and immediately after respawn, with the manifest's `death-volatile` group (souls, HP, stamina, flask, position, active timed effects, ordinary-enemy alive flags) excluded **by name** | Diff otherwise **empty**, for all 5 scenarios. **Hard fail: any non-`death-volatile` field changed** (D10, D11, seam S6) |
| **M-D5** | **World reset scope (D9)** | Enumerate entities alive before death and after respawn, by archetype | 100% of ordinary enemies respawned; **0** named NPCs, quest actors or merchants respawned. **Hard fail: a respawned named actor** — seam S5 and an AR-1 failure |
| **M-D6** | **Dead-named-NPC stays dead** | Kill a named NPC, die, respawn | Still dead; `quests.failure.severed` state intact |
| **M-D7** | **Merchant gold pool** | Sell to a merchant, die, respawn | Pool unchanged (`progression.merchant.barter`) |
| **M-D8** | **Second death (RN3)** | Die with 4,200; die again; enumerate stains | Exactly **1** stain exists globally at all times; the first is destroyed on the second `bloodstain_create`. **Hard fail: two stains, or any retrieval of the first** (D16) |
| **M-D9** | **No compensation (D18)** | Grep the UI-text stream across 20 deaths for `lost`, `souls lost`, `Retrieve`, `insurance`, `recover your`, and any numeral adjacent to a loss verb; enumerate every item in the game's data whose effect restores a lost bloodstain | **0 hits**, **0 such items**. **Hard fail: any** — this is an AR-1 failure (a Morrowind-side forgiveness contaminating the Souls death loop) |
| **M-D10** | **Death legibility (D2)** | Frames between the last hit's active window and HP reaching 0, over 20 deaths | ≤ 12 frames, 20/20 |
| **M-D11** | **Death surface (D5)** | Screenshot every 100 ms from the death frame; dispatch an input on its first rendered frame | ≤ 3.0 s; gone within 30 frames of an input; **0** statistics or tips rendered. **Hard fail: an unskippable death surface** |
| **M-D12** | **`time_dead` (R6)** | Death frame → first frame a player input moves the character, 20 samples | median ≤ 4.0 s, p95 ≤ 6.0 s |
| **M-D13** | **Run-back timing (R1–R4)** | Auto-walk the shortest path from respawn HEARTH to stain for RN1/RN2/RN4 at the `RI-WLD01` walk speed; count respawned hostiles on the path; for RN2 compare to the original approach | R1–R4 met. Cross-checked against `RI-PRG04`'s spacing table — if they disagree, `RI-PRG04` wins and this item files the discrepancy |
| **M-D14** | **Stain visibility (D14)** | From 8 viewpoints at 12 m with LOS (and 6 m in RN1's dark cave), render and detect the stain's pixels | Visible in 8/8 and 8/8. Report the screenshots |
| **M-D15** | **Recovery robustness (D15)** | Recover while: rolling, mid-attack, at 1 HP, with a hostile aggroed, and with the input pressed for 1 frame | Souls returned in 5/5; **0** cases where the interaction started and the souls were not credited. **Hard fail: an interruptible recovery that consumes the stain** |
| **M-D16** | **Persistence (D17)** | Die; rest at a HEARTH; change region; save; close the browser; reopen; `Continue` | Stain present at the same position with the same souls. Shares evidence with `RI-JRN05` M3 |
| **M-D17** | **Stain-loss rate (R5)** | 20-death agent-driven session at a difficulty-appropriate region | 0.10 ≤ rate ≤ 0.35 |
| **M-D18** | **No fast travel to the stain** | Enumerate every transport option reachable from the respawn HEARTH | **0** route that ends at, or within 60 s of, the death point unless it is a station that existed before (seam S7). **Hard fail: a "return to death location" affordance** — AR-2 |
| **M-D19** | **Marker sweep** | `RI-WLD06` M31 over the run-back HUD frames | **0** markers, arrows, minimap or compass pointing at the stain (AR-2). The stain is found by memory and by looking |

## Scoring

Native scale **0–100**, weighted, hard fails cap at **2**.

| Block | Weight | Checks |
|---|---|---|
| **Nothing is lost** | **34** | M-D4 (14), M-D1 (12), M-D5 (4), M-D6 (2), M-D7 (2) |
| **The stain behaves** | **24** | M-D8 (7), M-D2 (5), M-D3 (4), M-D15 (4), M-D14 (2), M-D16 (2) |
| **The loop is not softened** | **18** | M-D9 (8), M-D18 (6), M-D19 (4) |
| **The run back is play** | 14 | M-D13 (9), M-D17 (5) |
| **Death is legible and fast** | 10 | M-D10 (3), M-D11 (4), M-D12 (3) |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 92 | Meets the bar | 8 |
| 75–91 | Below bar — named remedy required | 6 |
| 55–74 | Recognisably attempting it | 5 |
| < 55 | **We lose** | 4 |

**Hard fails (any one caps at 2, `status: FAIL`):**

- **HF1** — Souls held ≠ souls stored ≠ souls returned (M-D1).
- **HF2** — Any non-`death-volatile` state field changed by a death (M-D4) — seam S6.
- **HF3** — A named NPC, quest actor or merchant respawned (M-D5) — seam S5, AR-1.
- **HF4** — Two bloodstains, a grace period, or any retrieval of a replaced stain (M-D8).
- **HF5** — Any loss-compensation mechanism, item, or message (M-D9) — AR-1.
- **HF6** — A travel option, marker or arrow that leads to the death point (M-D18, M-D19) — AR-2.
- **HF7** — An unreachable bloodstain (M-D3).
- **HF8** — An unskippable death surface (M-D11).
- **HF9** — A recovery interaction that consumes the stain without crediting the souls (M-D15).

## How we lose

1. **The dungeon rebuilds itself on respawn.** The respawn code reloads the region from
   `game/data/`, which is correct for enemies and catastrophic for everything else: the shortcut
   re-locks, the chest refills, the door re-locks. This is `RI-JRN05`'s "How we lose" #2 arriving
   through a different door, and it will be introduced by whoever writes the respawn path
   *without* having read `RI-JRN05`. **Cross-rule: D10's preserved-mutation list and
   `RI-JRN05` §B's `World` group are the same list and must be implemented once.**
2. **The bloodstain is a spawned prefab with no persistence.** It exists until you quit. The
   player quits mid-run-back and loses 4,200 souls to a save system, not to a mistake.
3. **The stain lands inside a wall,** because the death position was inside an enemy's push-out
   volume or on a slope the navmesh does not cover. Souls destroyed by geometry, which D4 exists
   to make impossible and which the implementation will get wrong exactly once, in the worst
   possible place.
4. **Somebody adds a retrieval item.** It is a kind, obvious, well-meaning design instinct, it
   is what a modern game would do, and it deletes the entire tension of the loop. HF5. The same
   instinct produces "you lost 4,200 souls" toasts and a "reduced death penalty" accessibility
   option, and all three are AR-1 failures.
5. **A marker appears on the stain.** Because otherwise it is hard to find. The correct fix is
   D14's visibility budget — make the stain readable at 12 m — not an arrow. AR-2, HF6.
6. **The run back is empty.** All the enemies between the HEARTH and the death point are named
   or scripted, so nothing respawns, and the corpse run is a two-minute walk down a corridor.
   R3 = 0. This scores *worse* than a hard run back and it will look like a kindness.
7. **The run back is 8 minutes.** The HEARTH is 11 minutes away because `RI-PRG04`'s spacing
   table was aspirational and the actual level built out longer. R1/R2, and it is the single
   most common reason a Souls-like is abandoned.
8. **Death takes 12 seconds.** A death animation, a fade, a 4-second "YOU DIED", a load, a
   fade-in, and a camera settle. Multiply by the 86 deaths `RI-PRG04` budgets for a 20-hour run
   and that is seventeen minutes of the player's life spent watching a word.
9. **The death surface shows statistics.** "Souls lost: 4,200. Deaths: 37. Time survived:
   4:12." Every one of those numbers is a small act of contempt and none of them are in either
   reference game.
10. **The recovery is a 1.2 s animation you can be knocked out of, and it consumes the stain
    anyway.** The souls are gone and the player did everything right. M-D15's five conditions
    exist because this bug is invisible until it happens to someone with 40,000 souls.
11. **Diseases are cured by death.** D8 says diseases are *retained* and timed effects expire.
    Death as a free cure turns the Morrowind affliction economy (`progression.affliction.economy`)
    into a nuisance with a free solution, and nobody will notice until a disease quest is
    trivially bypassable.
12. **The across-death diff is never run** because "death obviously doesn't change quest state".
    It obviously does, the moment respawn calls anything that also resets a region.

## Provenance note

- **`constructed`, confidence high, and binding** — §A rows owned by "this item" (D1, D2, D5,
  D7, D10, D14, D15, D18), the five scenarios in §B, every number in §C, and every threshold and
  weight in `## Comparison method` and `## Scoring`.
- **Owned by `RI-PRG04`, cited not restated** — D3, D4, D6, D8, D9, D12, D13, D16, D17. The
  bloodstain rules (one at a time, second death destroys the first, no timer, unreachable
  relocation), HEARTH spacing (2.0–11.0 min, 28 shrines, fog gate 60–110 s), rest effects, the
  86-deaths / ≈3.6-hours corpse-run budget, and the shortcut ratio all belong there. **If this
  item and `RI-PRG04` ever disagree on one of those numbers, `RI-PRG04` is authoritative and the
  disagreement is a corpus defect this item must file, not resolve.**
- **`canonical-recall`, confidence medium** — the Dark Souls loop this is transposed from
  (souls drop at the death spot as a single recoverable stain; a second death destroys it
  permanently; respawn at the last rested bonfire; ordinary enemies respawn and named ones do
  not; shortcuts permanently shorten the run back). Recalled, not measured. **No threshold here
  is a claimed measurement of Dark Souls** — §C's bands are ours.
- **Owned elsewhere, cited not restated:** seam S5 (respawn scope), seam S6 (death preserves
  quest/journal/faction state), seam S7 (no warp to the death point) → `ARBITRATION.md`. Save
  persistence of the stain → `RI-JRN05` (M-D16 shares its evidence). Walk speed and traversal
  time → `RI-WLD01`, seam S17. Shortcut density → `RI-WLD07`. Marker sweep → `RI-WLD06` M31.
  Respawn streaming cost → `RI-PLT03`. The first death as teaching → `RI-JRN02`, `RI-EXP01`
  `T_death`.
- **Harness dependency.** `A-JRN1`, `A-JRN3`, `A-JRN7`. Until they land this item is
  **unmeasurable** and scores **0**, fail-closed. Full request in
  `JOURNEY-CRITIC-FLEET.md` §7.
