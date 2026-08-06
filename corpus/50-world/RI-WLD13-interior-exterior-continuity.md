---
id: RI-WLD13
title: Interior/exterior continuity — footprint, bearing, windows, light, and the door round-trip
kind: number
side: morrowind
judges: [world.interior.continuity]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

This is the one place in the corpus where **we deliberately beat Morrowind rather than match it.**

Morrowind's interiors are separate cells with no obligation to their exteriors. Shacks are palatial
inside. Doors face the wrong way, so you walk out of a building at 90° to how you walked in. Windows
you counted from the street are not there when you get inside. Interiors are lit by their own eternal
noon whatever the sky is doing. It is a 2002 constraint and it is not a virtue, and copying it would
be copying the limitation instead of the design.

`ARBITRATION` gives Morrowind the world **outside the fight**, and it gives it *"hand-placed density,
named interiors"* — it does not give it the right to be spatially incoherent. Coherence is not a
Souls property either; it is simply what a place is. So the bar here is stated against the *idea* of
a named interior rather than against Morrowind's implementation of one, and it is stricter than both
reference games.

**Good** means: the inside fits inside the outside; the door you came through is where you left it
and points the way it pointed; every window you counted from the street is above you when you look
up; noon outside is noon through the shutters; you can step in and straight back out and be exactly
where you were; and where the exterior is flooded to the first-floor windows — because this province
has a city like that — **the interior is flooded to the same height, and it rises with the tide.**

The single most-repeated failure this item prevents: **the door that turns you.** It is invisible in
any screenshot, it costs nothing to build wrong, it silently destroys `RI-WLD06`'s entire
navigation-without-markers premise (you cannot navigate by memory in a world that rotates you every
time you enter a shop), and it is measurable to a tenth of a degree.

## The reference artifact

### 1. The seven continuity properties

Reference population: the **250 interiors** in `constants.json` (`world.interior_census.total` —
8 loop dungeons + 82 caves + 160 settlement interiors, owned by `RI-WLD07` / `RI-WLD03`).

| # | Property | Bar | Tolerance |
|---|---|---|---|
| **N1** | **Footprint containment.** Interior floor area, summed over storeys, against the exterior building's ground footprint × storey count | ratio ∈ **[0.70, 1.15]** | the 1.15 allows stairwells and wall thickness; **> 1.15 is the bigger-on-the-inside failure** |
| **N2** | **Door bearing.** The world-space compass bearing of the entrance door's outward normal, measured outside and inside | equal to **±5°**; exiting places you facing the *same* direction you faced when you entered, ±5° | zero exceptions |
| **N3** | **Door position round-trip.** Enter, then immediately exit | player position within **1.0 m** of the entry position; no world-state change; clock advanced only by real elapsed frames | |
| **N4** | **Window correspondence.** Count and position of glazed/shuttered/open apertures | counts **equal**; each exterior aperture has an interior counterpart within **0.50 m** in world space | applies to doors, hatches and chimneys too |
| **N5** | **Storey and height coherence.** Interior storey count, floor heights, and top-floor ceiling | storeys equal; each interior floor's world height within **0.30 m** of the exterior's floor line; top ceiling **below** the exterior roofline | |
| **N6** | **Light and weather continuity.** Time of day, sun bearing, weather and tide are one world state, shared across the door | interior light through apertures matches the exterior sun bearing within **10°**; a storm outside is audible and visible inside; **no interior has its own clock** | |
| **N7** | **Water continuity** (`RI-WLD10`). Where the exterior water surface intersects a building, the interior carries water at the **same world height**, in the same band, moving with the same tide | water height inside vs outside within **0.05 m** at all four tide states | this is what Lilmoth *is* |

**N7 is not an edge case in this province.** `RI-WLD03` describes Lilmoth as *"Imperial colonial stone
sunk to its first-floor windows, Argonian stilt-slum built on top of the drowned storeys"* and
`RI-WLD07` gives Ceyatatar-Zel as an *"Ayleid vault drowned to the second storey — the upper floor is
the water surface; drain it to unlock the lower loop."* Both of those are **interiors whose water
level is a gameplay object.** If interior and exterior water are independent numbers, Lilmoth's whole
premise — the rich live low in wet stone, the poor live dry above them — is a description rather than
a place, and Ceyatatar-Zel's drain puzzle cannot exist.

### 2. Seamless interiors

Not every interior needs a cell transition, and the ones that do not are worth disproportionately
more.

| # | Bar | Value |
|---|---|---|
| **S1** | Interiors with **no cell transition at all** — you walk in, the geometry is continuous, the exterior is visible behind you through the door | **≥ 20% of settlement interiors (≥ 32 of 160)**, and **all 8 loop-dungeon entrances** |
| **S2** | Interiors visible **into** from outside, through an open door or window, showing the real interior or a matched impostor | **≥ 50% of settlement interiors** |
| **S3** | Cell transition cost, where one exists | **≤ 30 frames (500 ms)**, and **no fade to black longer than 12 frames** (`RI-PLT03` owns the streaming budget) |
| **S4** | Interiors that are **exterior cells** — open-air, roofless, continuous with the world | **3 of the 8 loop dungeons** (`RI-WLD07` §1 already commits to this: the Xanmeer, the Clay Kilns, the Drowned Xanmeer) |

**S2 is the cheapest legibility win in the world area.** An open doorway you can see a lit room
through, from the street, is the difference between a settlement of buildings and a settlement of
building-shaped doors — and it is `RI-WLD03`'s settlement anatomy made visible without adding a
single interior.

### 3. The audit population

A full 250-interior audit is affordable statically and is therefore required for N1–N5. N6–N7 and §2
are sampled.

| Check | Population |
|---|---|
| N1, N2, N4, N5 | **all 250**, from `game/data/world/interiors/*.json` + `settlements/*.json` |
| N3 | seeded sample of **60**, plus **all 8** loop-dungeon entrances |
| N6 | **24** interiors × 4 times of day × 2 weathers |
| N7 | **all** interiors intersecting water at any tide state (≥ 18 expected: Lilmoth's drowned storeys, Ceyatatar-Zel, the Drowned Xanmeer, Marauder's Coast hulls, Blackrose's lower cells) |
| S1–S4 | all 160 settlement interiors + all 8 loops |

### 4. Data contract

`game/data/world/interiors/<id>.json` must carry, per interior: `exterior_building_id`,
`door_world_pos`, `door_world_bearing_deg`, `storeys[]{floor_height_m, area_m2}`,
`apertures[]{world_pos, kind}`, `seamless: bool`, `see_into: bool`, and `water_plane_m | null`.
`game/data/world/settlements/<id>.json` carries the matching exterior `footprint_m2`,
`roofline_m`, `apertures[]` and `door_world_bearing_deg`.

**Both sides must be present.** A continuity check is a diff between two independently authored
records; if the interior derives its numbers from the exterior at load time, the check proves nothing
and the item scores 0 (this is the same "two independent sources" discipline `HARNESS.md` §7.4
applies to movesets).

## Comparison method

**M71 — The static continuity audit (N1, N2, N4, N5).** Walk all 250 interiors; join to exteriors by
`exterior_building_id`.
- **FAIL** if any interior lacks an exterior record, or vice versa (an orphan interior is a room
  nobody built a building for).
- Compute and report N1's ratio, N2's bearing delta, N4's aperture diff and N5's storey/height deltas
  per interior.
- **FAIL** if **any** interior breaches N2 (**zero tolerance — the door that turns you**), if more
  than **2%** breach N1, if more than **2%** breach N4, or if more than **2%** breach N5.
- Report the worst ten by each metric. The N1 top-ten list is the "bigger on the inside" list and it
  is what a builder fixes first.

**M72 — The door round-trip (N3, harness).** For 60 seeded interiors + all 8 loop entrances:
`teleport` to the exterior door, record pose and `saveState()`; `interact` to enter; `stepFrames(60)`;
`interact` to exit; record pose and `saveState()`.
- **FAIL** if position differs by > 1.0 m, if bearing differs by > 5°, if the state diff is non-empty
  beyond the world clock (cross-check `RI-QST09` §5), or if the clock advances by more than the real
  frames elapsed × `world.timescale`.
- **FAIL** if entering and exiting twice accumulates drift (run it 5× and check the total).

**M73 — Light and weather continuity (N6).** For 24 interiors × `setTimeOfDay` ∈ {6, 12, 18, 1} ×
`setWeather` ∈ {clear, storm}: capture an interior shot framing an aperture, and an exterior shot of
the same aperture, per `HARNESS.md` §6.
- Compute the interior light's incident bearing from the aperture's cast shadow. **FAIL** if it
  differs from the exterior sun bearing by > 10°.
- **FAIL** if any interior's aperture luminance is invariant across the four times of day — that is
  an interior with its own clock, and it is the most common form of this failure.
- **FAIL** if a storm outside produces no change inside any of the 24.

**M74 — Water continuity (N7).** For every interior intersecting water: `setTide` across all four
states; sample water height inside and outside via `getWaterAt` and the interior probe.
- **FAIL** on any difference > 0.05 m, at any tide state, in any interior.
- **FAIL** if Lilmoth's drowned storeys do not change band with the tide, or if Ceyatatar-Zel's
  drainable water is a scripted one-shot rather than a change to the interior's water plane.

**M75 — Seamlessness (S1–S4, harness).** Traverse into every settlement interior and every loop
entrance with a trace running.
- Count transitions. **FAIL** if seamless interiors < 32 of 160, if any loop-dungeon entrance has a
  cell transition, or if fewer than 3 loops are open-air (**S4**).
- Measure transition cost where one exists. **FAIL** if > 30 frames, or if a fade exceeds 12 frames.
- **FAIL** if a seamless interior's exterior is not visible from inside the doorway.

**M76 — See-into (S2).** From a fixed street pose in each settlement, cast against every building's
door and window apertures and record whether the real interior (or a matched impostor) renders.
- **FAIL** if < 50% of settlement interiors are see-into, or if any impostor's palette differs from
  the real interior's by more than a Bhattacharyya distance of 0.20 (an impostor that is a black box
  is not a matched impostor).

**M77 — The navigation consequence (cross-check).** Re-run `RI-WLD06`'s prose-direction navigation
probe with the route passing **through** 3 interiors (in one door, out another).
- **FAIL** if success rate drops by more than **10 percentage points** against the same routes
  without interiors. A world whose interiors rotate the player cannot be navigated from prose, and
  this check is what makes N2's zero tolerance worth its weight.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| **M71** static audit N1/N2/N4/N5 | **30** | **zero** N2 breaches; ≤ 2% on the others |
| M72 door round-trip | 16 | ≤ 1.0 m, ≤ 5°, no drift, clean state diff |
| M73 light and weather | 12 | sun bearing ±10°; no interior with its own clock |
| **M74** water continuity | **14** | ≤ 0.05 m at all four tide states |
| M75 seamlessness | 12 | ≥ 32 seamless, 8/8 loop entrances, 3 open-air |
| M76 see-into | 8 | ≥ 50%, matched impostors |
| M77 navigation consequence | 8 | ≤ 10 pp drop |

- **≥ 88** — interiors are inside their buildings.
- **75–87** — playable, gap named.
- **< 75** — **we lose.**

**Automatic fail regardless of score:** **any** interior whose door bearing differs from its exterior
by > 5° (N2); an interior with its own time of day; an interior whose water level is independent of
the exterior's; a loading screen at a loop-dungeon entrance; an orphan interior with no exterior
record; interior geometry derived from the exterior at load time (which makes every check vacuous).

## How we lose

1. **The door that turns you.** Interiors authored in their own local space with the entrance at the
   origin facing +Z, and the exterior door placed wherever it looked good. Every building rotates the
   player by an arbitrary angle. Invisible in screenshots, fatal to `RI-WLD06`, and it is why N2 has
   zero tolerance and M77 exists.
2. **Bigger on the inside.** The interior is authored to be a nice room, not to fit the shack. It is
   Morrowind's own failure and it will be reproduced by default, because the interior artist and the
   exterior artist are working from different references. N1's ratio is a one-line check that nobody
   runs unless it is written down.
3. **Eternal noon.** Interiors lit by a baked ambient with a fixed sun vector, so the world clock —
   which `RI-WLD08`, `RI-TRV01`, `RI-CRM01` and `RI-WLD10` all depend on — stops at the doorway.
   M73's invariance check catches it in one sweep.
4. **Windows that are decals.** The exterior has eleven beautiful shuttered windows and the interior
   is a windowless box with a light in it. N4 counts both sides.
5. **Interior water as a separate number.** Lilmoth's drowned storeys authored with a static water
   plane at a nice-looking height, so the tide moves the street and not the room. It breaks the single
   most striking thing in the province's biggest city, and it will be built that way because interior
   water and exterior water are usually different systems.
6. **Everything is a cell.** 250 loading doors. It passes N1–N7 perfectly and the settlement still
   reads as a facade with menus behind it. S1's 32 seamless interiors are the antidote and they are
   the first thing cut for schedule.
7. **The black doorway.** Every open door is an unlit hole because the interior is not resident. It is
   the cheapest possible tell that the world is cells, and S2/M76 is a 50% bar precisely because 100%
   is not affordable and 0% is what will happen by default.
8. **Interiors generated from exteriors at load.** Someone "solves" continuity by deriving the room
   from the building. Every check in this item passes trivially, all 250 interiors become the same
   room at different scales, and `world.interior.named` — named interiors with owners, contents and
   reasons to exist — is deleted. §4's two-independent-records rule is the guard, and it is the one
   most likely to be argued with.
9. **Stairs that go nowhere real.** Interior floor heights authored for the room, so the second-floor
   window you can see from the street is at 3.2 m outside and 4.8 m inside, and a player who climbs
   to look out is looking out of a different building. N5.
10. **Interior audio unaffected by the storm.** Unmeasurable through the harness (`HARNESS.md` §3) and
    therefore invisible to M73's visual half. `RI-AUD03` owns it; flagged here so nobody assumes it is
    covered.

## Provenance note

- **`constructed`, confidence high.** Every property N1–N7, every bar in §2, the audit population and
  all tolerances are ours. High confidence because all of them are **geometric diffs between two
  authored records** — the least arguable kind of check this corpus can write — and because M71 needs
  no browser at all.
- **Deliberate divergence from the reference game, declared:** Morrowind fails N1, N2, N4, N5 and N6
  routinely, and Morrowind is the `side:` this item is filed under. That is not a contradiction. The
  Arbitration Rule gives Morrowind authority over *what the world is made of* — hand-placed density,
  named interiors with owners and contents — not over 2002's cell system. Where Morrowind's
  implementation is a limitation rather than a design, this corpus is allowed to be better, and this
  item says so out loud so no critic can cite Morrowind's incoherence as a defence.
- **Cited, not redefined:** the 250-interior census and its 8/82/160 split (`constants.json`
  `world.interior_census.total`, owner `RI-WLD07`); the three open-air loop dungeons and
  Ceyatatar-Zel's drainable vault (`RI-WLD07` §1/§2); Lilmoth's drowned storeys and the 160 settlement
  interiors (`RI-WLD03`); named interiors with owners (`world.interior.named`, `RI-WLD03`); water
  bands, tide states and `getWaterAt` (`RI-WLD10` §1/§7/§12); the world clock and `world.timescale`
  (`RI-WLD01`, `RI-WLD08`); the state-diff discipline and the allowed-diff table (`RI-QST09` §5);
  prose-direction navigation (`RI-WLD06`); streaming and fade budgets (`RI-PLT03`); the capture
  protocol (`HARNESS.md` §6); interior audio (`RI-AUD03`).
- **Unverifiable, correctly declared:** the 1.15 footprint ceiling, the 5° bearing tolerance, the
  0.50 m aperture tolerance, the 20%/50% seamless and see-into shares, the 30-frame transition budget
  and the 10-percentage-point navigation bar. Binding because measurable. The 5° is the one that
  matters and it is deliberately tight: 5° is invisible to a player and 15° is not.
