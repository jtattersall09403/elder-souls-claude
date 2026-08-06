---
id: RI-WLD14
title: The built alienness — nine architectural grammars, the right-angle census, and the failing Empire
kind: structure
side: morrowind
judges: [world.strangeness.architecture]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

Morrowind's architecture is the reason a single screenshot of it is unmistakable. Not because it is
detailed — it is 2002 — but because **every building in it was made by a method no other game's
buildings were made by**. Telvanni towers are *grown*. Redoran halls are the *shell of a dead animal*.
Vivec's cantons are hollow artificial blocks in a lagoon. Ald'ruhn is a carapace. You cannot describe
one of these buildings without describing a *process*, and that is the whole trick.

`RI-WLD05` owns the strangeness **inventory** — the thirty things, ten of which are architecture. This
item owns the **grammar**: not *which* strange buildings exist, but the rules that make a building
belong to a people, and the measurements that tell an alien architecture from a fantasy one with a
different texture on it.

The bar: **nine declared architectural grammars**, each of which names its **material, method, joint,
opening, roofline, ornament and decay** — so that a builder can produce a *new* building in a grammar
without asking anyone; a **right-angle census** that fails a province built from boxes; a hard rule
that **every Imperial building in Argonia is visibly failing**; and a mesh-reuse ceiling that fails a
settlement kit-bashed from twelve meshes.

And the acceptance test is `RI-WLD05`'s, applied to buildings alone: **crop a single building onto a
neutral background, show it unlabeled, and ask what made it.** If the honest answer is "an artist with
a modular wall kit", the province has failed, however good the wall kit is.

## The reference artifact

### 1. The nine grammars

Every building in the province belongs to exactly one. Each grammar is a **process**, and the process
is what a builder implements.

| # | Grammar | Material | **Method — the verb** | Joint | Opening | Roofline | Decay |
|---:|---|---|---|---|---|---|---|
| 1 | **Root-arch** | living Hist root and trained cane | **grown** — trained over decades, never cut | graft | arch, never rectangular | continuous with the branch above | it does not decay; it *closes*, and the village moves |
| 2 | **Hist-bole** | the interior of a living Hist | **hollowed** — the tree consents | none; there are no parts | **bark sphincter** that opens to a touch | the tree's own crown | scarring; a refused door |
| 3 | **Nest-mound** | mud, spit, chewed reed | **extruded** — pushed out from inside | none; it is one piece | round hatch at the top or the side | a smooth dome; interiors *"smoothed like a throat"* | slumping, rain-melted, re-extruded each wet season |
| 4 | **Stilt-row** | lashed cane and salvaged plank on a hydraulic float | **floated** — it rises and falls with the tide | lashing, never nails | doorway above the high-water line | shallow pitch, shed water fast | rot from the waterline up; the lowest course is always new |
| 5 | **Xanmeer** | white limestone, quarried before records | **stacked** — stepped, corbelled, no true arch | dry-set, precision, no mortar | narrow slot, oriented astronomically | stepped ziggurat terraces | root-cracked, half-sunk, never ruined-*looking* — it just goes under |
| 6 | **Kiln-dome** | clay, fired in place with the kiln still burning under the floor | **fired** — the building is a pot | vitrified, one piece | low round door; a flue is not a window | dome, always | crazing, then a single catastrophic shatter |
| 7 | **Bone-scaffold** | leviathan rib, ship's keel, whale jaw | **lashed** — nothing is cut to fit | rope, wedge, weight | between the ribs; there is no wall | open, tarpaulined | creaking, then a collapse nobody predicted |
| 8 | **Salt-block** | cut salt-crust and bleached whale-bone frames | **sawn** — the only sawn material in Argonia | pegged | shuttered slot; the light is white | flat, weighted with stone | dissolution; a wall lost per bad season |
| 9 | **Imperial cut stone** | quarried ashlar, imported brick, mortar | **built** — the only grammar that uses that verb | mortar, iron cramps | **rectangular**, glazed, with a lintel | crenellation, tile, a pitch that was designed in Cyrodiil for snow | **always visibly failing** (§3) |

Two grammars appear only as **ruins the living do not use**: **Ayleid white stone** (drowned to the
second storey in Blackwood, welkynd-lit) and the **Kothringi mirror-plate** town in the Stone Wastes.
They are counted in the census as grammars 10 and 11 for the right-angle audit and are exempt from
§4's settlement rules, because nobody lives in them.

### 2. The measurable form of alienness

This is the section that separates this item from an art brief. All of it is computable from the
shipped meshes.

| # | Metric | Definition | Bar |
|---|---|---|---|
| **F1** | **Right-angle fraction** | of all adjacent wall-plane pairs in a building, the fraction within **3°** of 90° | **Argonian grammars (1–4, 6): ≤ 0.10.** Xanmeer (5): ≤ 0.45 (it is stacked, but corbelled and battered). Bone/salt (7, 8): ≤ 0.25. **Imperial (9): ≥ 0.85.** **Province-wide, by building volume: ≤ 0.35** |
| **F2** | **True-vertical fraction** | edges within **5°** of world up | organic grammars ≤ 0.35; Imperial ≥ 0.70 |
| **F3** | **Silhouette turning** | mean absolute turning per metre of the building's outline against the sky | organic ≥ **0.22 rad/m**; Imperial ≤ 0.08 |
| **F4** | **Opening rectangularity** | fraction of apertures that are 4-sided with right corners | grammars 1–8: ≤ **0.15**; grammar 9: ≥ 0.90 |
| **F5** | **Mesh reuse ceiling** | max instances of any single building mesh within one settlement | **≤ 12** |
| **F6** | **Top-10 volume share** | fraction of a settlement's built volume drawn from its 10 most-used meshes | **≤ 0.25** |
| **F7** | **Door-height variance** | stddev of doorway clear height across a settlement | **≥ 0.18 m** — a province where every door is 2.1 m was made by one tool |
| **F8** | **Process legibility** | fraction of buildings where the grammar's **verb** is visible in the mesh: a graft scar, an extrusion ripple, a firing crackle, a lashing, a saw-kerf | **≥ 0.80** |

**F8 is the item's real subject.** A dome is a dome. A dome with the crazing of something fired in
place, standing on a floor that is still warm, is architecture from somewhere else. Everything above
F8 is a proxy; F8 is the thing.

**F1 is the cheapest and most brutal.** A settlement built from a modular wall kit scores 0.9 on F1
regardless of what texture is on it, and no amount of fog fixes it.

### 3. The failing Empire

`RI-WLD05` #30: *"No settlement uses a grid and no building uses a right angle — except Imperial ones,
and every Imperial building in Argonia is visibly failing."* This item makes it checkable.

| # | Rule | Value |
|---|---|---|
| **E1** | Every structure in grammar 9 carries **≥ 1 declared decay state**, visible in the mesh and the material | 100%, no exceptions |
| **E2** | Distinct decay **types** in use across the province | **≥ 4**: fungal digestion of the stone (Blackrose); subsidence into soft ground (Lilmoth, *"a hand's width a year"*); roof loss and a local re-thatch over Imperial walls; root-jacking that has opened a joint |
| **E3** | Imperial structures **repaired in a local grammar** — lashed, extruded or grown patches on cut stone | **≥ 40%** of them |
| **E4** | Imperial structures in **good order** | **0**. Not one. The legion fort in the Salt Hills is the newest thing the Empire has here and its gate has been re-hung with rope |
| **E5** | Imperial share of the province's built volume | **≤ 18%** — Imperial architecture is the *contrast*, and if it is the default the world has become Cyrodiil (`RI-WLD05`'s own failure clause) |

E4's zero is deliberate and is the item's second-best single rule: **the Empire's condition is the
province's politics rendered as geometry**, and one well-maintained Imperial building would say
something the corpus does not mean (`RI-LOR02` §1).

### 4. Grammar composition per settlement

| # | Rule | Value |
|---|---|---|
| **G1** | Grammars used in one settlement | **≤ 3**, and a settlement using 3 must have a **stated reason** in `settlements.json` |
| **G2** | Settlements whose grammar mix is **narrated** — the mix is the settlement's identity, not a variety pack | 100% of multi-grammar settlements |
| **G3** | Every one of the 9 living grammars is the **primary** grammar of ≥ 1 settlement or named site | 9/9 |
| **G4** | Grammars confined regionally (**S24**) | no living grammar primary in more than **3** of the 13 regions |
| **G5** | Interiors obey their exterior's grammar | 100% — a nest-mound has no rectangular rooms; cross-checked by `RI-WLD13` |

**Lilmoth is the worked example of G2** and it is already written: *"Imperial colonial stone sunk to
its first-floor windows, Argonian stilt-slum built on top of the drowned storeys… the rich live LOW in
wet stone because status is masonry; the poor live DRY above them. The social order is upside down and
visible from the harbour."* Two grammars, stacked vertically, and the stack *is* the sentence. That is
what G2 asks for and it is not decoration — it is the settlement's whole meaning delivered by
geometry.

### 5. The banned list (architecture half)

Any instance is a defect. Extends `RI-WLD05` §3 with the specifically architectural cases:

Crenellated stone castles (**except** Imperial forts, and those must be failing per E4). Thatched
cottages with flower boxes. Cobblestone streets with lamp-posts. Half-timbered inns of any kind.
Gothic vaults, rose windows, flying buttresses. Dwemer brass and gears (that is Morrowind's, not
Argonia's, and importing it is the laziest possible "strangeness"). Palisade forts with sharpened
logs. Orc skull-totem camps. **A right angle in grammars 1–4.** A tin roof. **A generic swamp shack on
stilts with a plank porch** — the default output of every marketplace swamp pack and the single most
likely thing to be built, which is why grammar 4 specifies hydraulics, lashing, and a lowest course
that is always new.

### 6. Data contract

`game/data/world/architecture.json`, schema `elder-souls/architecture@1`: the 9 (+2 ruin) grammars
with their seven columns, each grammar's F1–F4 bounds, and the banned list as matchable mesh/tag
patterns. Every building record in `game/data/world/settlements/*.json` carries `grammar`,
`decay_states[]` (mandatory and non-empty for grammar 9), `mesh_id` and `volume_m3`.

## Comparison method

**M78 — The grammar census (static).** Load `architecture.json` and every settlement record.
- **FAIL** if fewer than 9 living grammars; if any building lacks a `grammar`; if any grammar lacks
  any of its seven columns; if **G3** is not 9/9; if any settlement exceeds **G1**'s three grammars
  without a stated reason; or if a living grammar is primary in more than 3 regions (**G4**, S24).

**M79 — The right-angle census (mesh analysis).** For every building mesh, compute F1–F4 from the
geometry: adjacent wall-plane angles, edge verticality, silhouette turning against a horizon plane,
and aperture corner angles.
- **FAIL** on any grammar-level bound in §2 breached by more than **5% of that grammar's buildings**.
- **FAIL** if the province-wide volume-weighted F1 exceeds **0.35**.
- Report F1 per grammar. **A single number — the province's F1 — is the best one-line summary of
  whether this world was built or assembled**, and it belongs in every world verdict.

**M80 — Reuse and monotony (F5–F7, static).** Count mesh instances and volumes per settlement;
measure doorway clear heights.
- **FAIL** if any mesh exceeds 12 instances in one settlement; if the top-10 volume share exceeds
  0.25; or if door-height stddev is below 0.18 m in any settlement.

**M81 — Process legibility (F8, `blind_pair: yes`).** Sample 40 buildings across all grammars; render
each at `HARNESS.md` §6 world config, cropped to the building on a neutral background, HUD off.
- Show each unlabeled to a fresh judge: *"how was this made? Name the verb."*
- **PASS: ≥ 32 of 40 named a verb matching the building's declared grammar** (grown / hollowed /
  extruded / floated / stacked / fired / lashed / sawn / built).
- **FAIL** if ≥ 12 of 40 are answered "built" for a non-Imperial building — "built" is grammar 9's
  verb and its overuse is the exact signature of a modular kit.

**M82 — The Empire's condition (E1–E5).** Enumerate every grammar-9 structure.
- **FAIL** if any lacks a decay state (**E1**); if fewer than 4 decay types are in use (**E2**); if
  fewer than 40% carry a local-grammar repair (**E3**); if **any** is in good order (**E4**, zero
  tolerance); or if Imperial volume share exceeds 18% (**E5**).

**M83 — The banned list (static + sampled render).** Grep the mesh manifest, entity registry and
material names for the §5 patterns; then classify 40 randomly sampled buildings by render.
- **FAIL** on any banned instance in normal use, on any right angle in grammars 1–4 above F1's 0.10,
  or on any Dwemer-analogue material.

**M84 — The single-building blind test.** Interleave 12 of our building crops with 12 Morrowind
building crops (a Telvanni tower, Ald'ruhn's shell, a Vivec canton, a Redoran hut, a Velothi tower, a
Dwemer facade, a Daedric shrine, an ancestral tomb, a Hlaalu manor, a silt-strider platform, an
Imperial fort, an ashlander yurt) and 12 from a generic marketplace fantasy-village pack, all
downsampled to a common resolution so 2002 fidelity is not the tell.
- Ask a fresh judge to sort all 36 into *"made by a people"* and *"made by an asset pipeline"*, before
  the reveal.
- **PASS: ≥ 10 of our 12 sorted into "made by a people".**
- **FAIL** if ≥ 4 of ours land with the marketplace pack. Per `CORPUS-CONTRACT` §6, if the judge ranks
  ours above Morrowind's, distrust the judge and re-run with a harsher lens.
- **Art direction only** (`ARBITRATION` §4). A critic citing a modern AAA screenshot here has voided
  its verdict.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| M78 grammar census | 14 | 9 grammars, complete, regionally confined |
| **M79** right-angle census | **22** | every grammar bound; province F1 ≤ 0.35 |
| M80 reuse and monotony | 12 | ≤ 12 instances, ≤ 0.25 top-10, ≥ 0.18 m door variance |
| **M81** process legibility | **20** | ≥ 32/40 name the right verb |
| M82 the Empire's condition | 14 | E1–E5, zero buildings in good order |
| M83 banned list | 8 | zero instances |
| **M84** single-building blind test | **10** | ≥ 10 of 12 read as made by a people |

- **≥ 85** — the buildings could not be anywhere else.
- **70–84** — playable, gap named.
- **< 70** — **we lose.**

**Automatic fail regardless of score:** province-wide F1 > 0.50 (a world of boxes); any banned-list
instance in normal use; any Imperial structure in good order (**E4**); any right angle above 0.10 in
grammars 1–4; ≥ 4 of 12 building crops sorted with the marketplace pack (**M84**); Dwemer brass
anywhere; a settlement using more than 3 grammars with no stated reason.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **The modular wall kit.** Nine grammars declared in JSON, one wall kit in the meshes, nine
   material variants on top. Every grammar column is satisfied on paper, F1 comes out at 0.9, and the
   province looks like every other game. M79 is a single number that catches it and it should be
   computed in wave 1 before a settlement is finished.
2. **Strangeness as texture.** The dome is a hemisphere primitive with a crackle map. F8/M81's "name
   the verb" test is the only instrument that can tell a fired pot from a sphere, and it needs a human.
3. **The generic swamp shack.** Stilts, planks, a porch, a lantern. It is what every asset pack ships,
   it is what "Black Marsh village" autocompletes to, and grammar 4 specifies hydraulics and a
   perpetually-new lowest course precisely to make it un-buildable by default. Named in `RI-WLD05`'s
   how-we-lose too, because it is the province's most likely single failure.
4. **The Empire in good repair.** An Imperial fort is the easiest building to make look good, it is
   the one whose reference art is most available, and one well-kept ashlar wall says the Empire is
   winning — which is a lore claim (`RI-LOR02`) made by an artist who was told to make it look nice.
   E4's zero exists for that.
5. **Imperial architecture as the default.** It is the cheapest to build and the most familiar, so it
   spreads. At 40% of built volume the province is Cyrodiil with lizards in it. E5's 18% ceiling is
   the guard and it will be argued with.
6. **Grammar declared, interiors ignored.** A nest-mound extruded like a throat on the outside and
   four square rooms inside. G5 and `RI-WLD13` catch it, and it is the most likely place the two items
   have to be run together.
7. **Every door 2.1 m.** A single invisible tell that one tool made everything. F7 costs nothing to
   satisfy and will be failed by default.
8. **Dwemer smuggled in.** Brass, gears, steam — the most beloved strange architecture in the series
   and it belongs to a different province. Importing it is instantly recognisable as borrowed and it
   would make the world *less* specific, not more.
9. **All nine grammars in one settlement.** A "variety" instinct that turns the capital into an
   architectural zoo and destroys G4's regional confinement, which is **S24** operating on buildings.
10. **Ruins used as living architecture.** The xanmeers and the Ayleid vaults are the most beautiful
    assets in the province and someone will put a shopkeeper in one. Grammars 10 and 11 are exempt from
    §4 *because nobody lives in them*, and that exemption is load-bearing: the dead architecture of a
    people who are still here is the province's whole thesis (`RI-WLD05`), and it stops being that the
    moment it becomes real estate.

## Provenance note

- **`constructed`, confidence medium.** The nine grammars and their seven columns, every F1–F8 metric
  and bound, E1–E5, G1–G5 and the architectural banned list are ours. Confidence is *medium* rather
  than high because the numeric bounds — 0.10, 0.35, 0.22 rad/m, 12 instances, 0.18 m — have **not**
  been calibrated against a measurement of any real game's meshes. They are stated as a starting
  calibration and the highest-value follow-up is to run M79 over a Morrowind mesh export and publish
  the real figures; if Ald'ruhn's shells come out at 0.2 rather than 0.1, this item should be amended,
  not the world.
- **Not ours, cited:** the strangeness inventory and its ten architecture elements, the ≥ 6-placed-
  instances rule, the Skyrim test and the general banned list are `RI-WLD05` — **this item introduces
  no new strangeness element**, it specifies the grammar behind the ten that exist. Every grammar's
  *content* is drawn from `corpus/50-world/regions.json`'s `architecture` and `only_here` columns and
  from `settlements.json`: root-arch villages and nest-mounds, stilt-rows on tide platforms, xanmeer
  ziggurats, naga kiln-domes *"fired in place, the kiln still lit beneath the floor"*, bone-scaffold
  towers of *"lashed leviathan ribs"*, Soulrest's *"whale-bone frames and salt-block walls, bleached
  white"*, Blackrose's stone *"furred with fungus that is visibly digesting it"*, Lilmoth's two stacked
  cities, and the Ayleid white stone *"drowned to the second storey"*. Lilmoth's G2 narration is quoted
  from `RI-WLD03` verbatim. Regional confinement is **S24**. Interior conformance is `RI-WLD13` G5.
  The bifurcation rule governing M84 is `ARBITRATION` §4 / `RI-VIS01`.
- **`community-data`, confidence medium**, via `RI-WLD05`'s own provenance (UESP Lore:Black Marsh,
  ESO Murkmire): Argonians built stone structures across Black Marsh, from solitary statues and
  wayshrines to stepped pyramids called **xanmeers**, many of them shrines to Sithis, with an intact
  one at Hissmir; mud nests serve as settlements; **naga** are a distinct Argonian people. Grammars 3,
  5 and 6 are constrained by those facts and do not exceed them.
- **`canonical-recall`, confidence medium:** the Vvardenfell architectural comparison that motivates
  the whole item — grown Telvanni towers, Ald'ruhn's emperor-crab shell, Vivec's cantons, Redoran
  chitin. Recalled, not verified this session, and used as design rationale rather than as a cited
  number. M84's Morrowind crop set must be assembled from real screenshots before that check can run;
  until it is, M84 is **unmeasurable ⇒ 0**, fail-closed.
