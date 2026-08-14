---
id: RI-WLD16
title: Landform and geology — the terrain grammar each region is built out of
kind: structure
side: morrowind
judges: [world.terrain.form, world.region.identity, world.verticality.layout, world.hazard.environment]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

`RI-WLD04` gives every region seven things it owes: palette, dominant flora, dominant fauna,
architecture, ambient audio bed, weather profile, hazard. **Not one of them is the shape of the
ground.** Its differentiation matrix has nine axes and only one of them is terrain — "slope
histogram (χ² test)" — which two regions built from the same generator with different noise
amplitudes will pass while being the same landscape at two loudnesses. The word *geology* does not
appear anywhere in this corpus, and `corpus/50-world/regions.json` has no field for landform.

That is the hole. Morrowind's regions are told apart by their *ground* before their colour: a foyada
is a lava channel with walls you cannot climb, the Bitter Coast is hummocks between standing pools,
the Grazelands are open rolling downs, Sheogorad is basalt stacks in cold water. Change the palette
of any of those and you still know where you are, because the **landform** is doing the work. A
region defined only by a colour, a tree and a fog value is a region that will be built as one noise
field with a tint.

The bar: **every region declares a macro-form class, a drainage pattern, a bedrock, a soil and at
least five named landform elements; at most one macro-form class may be shared, and only by two
regions; the built terrain must sit inside the envelope its declared class implies; and the named
elements must exist as things in the world, not as prose in a table.** Landform then joins
`RI-WLD04` M18 as a **tenth differentiation axis, and a compulsory one** — see §4.

## The reference artifact

The full table is machine-readable in **`corpus/50-world/landforms.json`** and is this item's
artifact; the summary below is the same data. `measured_*` fields in that file are the shipped tree
at commit `cf2755a`, recorded as a baseline.

### 1. The thirteen grammars

| Region | Macro-form | Drainage | Bedrock / soil | Named elements (5 each; a walk must cross ≥3) |
|---|---|---|---|---|
| Western Rootlands | levee-and-backswamp | anastomosing | peat over white limestone | root-levee, backswamp basin, paddy terrace, crevasse splay, nest-mound |
| Eastern Rootlands | tidal-flat | anastomosing | unconsolidated tidal mud | tide channel, low-tide mud bar, floating meadow, oyster-shell chenier, drowned levee |
| Blackwood | karst-tower | deranged | white karstic limestone / rendzina | limestone tower, sinkhole, collapsed cave roof, buttress-root terrace, blind valley |
| The Hive | hummock-field | none | comb; no mineral soil at all | comb-cliff, sealed cell dome, collapse pit, wax terrace, the queen's shaft |
| Marauder's Coast | dune-and-pan | endorheic | coquina / salt-grass over barnacle shelf | barnacle shelf, tidal pan, beached-hull mound, mangrove hummock, storm berm |
| The Stone Forest | terrace-staircase | radial | silicified wood in tuff | petrified bole outcrop, tuff riser, xanmeer terrace, root-hollow amphitheatre, the Helstrom rise |
| The Salt Hills | escarpment | trellis | bedded gypsum and marl | scarp face, dip slope, salt flush, quarried bench, pass saddle |
| Valus Ridge | ridge-and-ravine | trellis | wind-holed limestone over folded slate | flute spire, ravine head, scree fan, cloud shelf, col |
| Thornmarsh | raised-bog | deranged | ash-dusted acid peat | bog dome, lagg, cut path trench, thorn-island, ash drift |
| The Clay Moor | badland | dendritic | fired red clay over shale | gully head, hardpan flat, clay pinnacle, kiln cut, dry wash |
| Crimson Coast | alluvial-fan | dendritic | red mudstone / dye-stained silt | fan lobe, abandoned distributary, dye-vat terrace, lichen shelf, sea stack |
| The Deep Marshes | levee-and-backswamp | anastomosing | drowned xanmeer masonry is the only hard surface | xanmeer stump, floating peat raft, black lead, drowned levee, gas-blister mound |
| Stone Wastes | playa | endorheic | glassed salt-crust over evaporite | crater rim, salt polygon field, whale-bone drift, deflation hollow, storm-scour lane |

Twelve distinct macro-forms across thirteen regions; `levee-and-backswamp` is the one permitted
sharing, and the two that share it are separated by drainage load — the Western Rootlands' levees are
walked on, the Deep Marshes' are drowned.

### 2. Why these classes and not others

They are real geomorphological classes, chosen so that a builder can look one up and know what to
model, and so that a critic can tell whether the ground obeys it. **Two regions in the same class is
a design decision that must be paid for in another axis; three is a generator with parameters.**

### 3. The class envelopes (what the built terrain must satisfy)

Enforced by `FORM_ENVELOPES` in `corpus/80-methods/m-wld16-landform-census.mjs`. Deliberately wide:
this check exists to catch a playa built as a ridge, not to tune a slope.

| Class | Relief range (m) | Mean slope (°) |
|---|---|---|
| tidal-flat | 0–20 | 0–6 |
| levee-and-backswamp | 5–40 | 0–8 |
| raised-bog | 10–90 | 2–10 |
| karst-tower | 60–400 | 7–25 |
| escarpment | 80–400 | 10–28 |
| ridge-and-ravine | 150–600 | 18–45 |
| alluvial-fan | 10–80 | 2–12 |
| playa | 0–25 | 0–7 |
| badland | 15–120 | 4–20 |
| dune-and-pan | 3–40 | 1–10 |
| hummock-field | 3–40 | 3–14 |
| terrace-staircase | 40–300 | 6–22 |
| crater-field | 5–60 | 2–14 |

### 4. The consequential amendment to `RI-WLD04` M18

`RI-WLD04`'s differentiation matrix requires ≥6 of 9 axes to differ for every region pair. **Landform
is added as a tenth axis and it is compulsory**: for any pair A/B, the pair must differ on ≥6 of 10
axes **and landform must be one of them** (different `macro_form`, or the same class with a different
`drainage` *and* a different `bedrock`). No threshold in `RI-WLD04` is lowered by this; the 6-of-9
requirement becomes 6-of-10 with one axis named, which is strictly stronger. Recorded here rather
than by editing `RI-WLD04`'s tables so the two items stay independently readable.

## Comparison method

**M-W16-1 — the landform census** (`corpus/80-methods/m-wld16-landform-census.mjs`).
```
node corpus/80-methods/m-wld16-landform-census.mjs --selfcheck    # must exit 0 first
node corpus/80-methods/m-wld16-landform-census.mjs --json <out>
```
Three checks, cheapest first, all static and headless (~1 s):
- **L1 — grammar declared.** Every region has all five fields; macro-form and drainage are from the
  declared vocabularies; ≥5 elements each; at most one shared macro-form class, used by ≤2 regions;
  no drainage pattern on more than 4 regions.
- **L2 — built terrain matches declared.** Each region's `mean_slope_deg` and relief range from
  `terrain.json` must fall inside its class envelope. A region that declares `escarpment` and builds
  a 4° flat fails here, which is the whole point of declaring anything.
- **L3 — CONSUMPTION (`RI-MTH07`, mandatory under `ARBITRATION.md` §3).** Each region's named
  elements must appear as entities in world data (`pois.json`, `terrain.json`, `hazards.json`,
  `signatures.json`, `architecture.json`; the list is additive). **≥3 of 5 per region.** A landform
  table nothing in the world reads is the failure mode rule 5 exists for.

**The selfcheck is mandatory and is not decoration.** It runs three negative controls — thirteen
regions collapsed onto one macro-form (L1), a 3.6° tidal flat declared `ridge-and-ravine` (L2), and
a world text made only of generic nouns like *road*, *water*, *stone* (L3) — and three positive ones.
The generic-world control exists because the **first version of L3 was inert in the dangerous
direction**: it matched any word in an element's description, so "root-levee (the road itself…)"
matched on *road*, and it reported **71% coverage against a world containing none of these
landforms.** It now matches the element's key phrase and reports **5%**. Quote no L3 number whose
selfcheck was not executed in the same run.

**M-W16-2 — the landform blind test** (extends `RI-WLD04` M17, no new capture cost). On the same 39
region screenshots, ask the judge a second question: *from the shape of the ground alone, ignoring
colour and plants, which of these thirteen macro-forms is this?* **Pass ≥26/39.** A region whose
landform is unreadable at 33% while its palette is readable at 90% is a region wearing a costume.

**M-W16-3 — the greyscale control.** Re-render 13 of those points with albedo forced to flat grey,
flora hidden and fog off. Show the pair unlabelled. **If region identity survives at ≥60%, landform
is carrying real signal; below 40% the palette is carrying all of it** and `RI-WLD04`'s screenshot
test is measuring a colour grade. This is the cheapest way to falsify a passing M17.

## Scoring

| Score | Condition |
|---|---|
| 10 | L1/L2/L3 pass; L3 ≥4 of 5 elements per region; M-W16-2 ≥32/39; M-W16-3 ≥70% |
| 8 | L1/L2/L3 pass at threshold (L3 ≥3 of 5); M-W16-2 ≥26/39; M-W16-3 ≥60% |
| 6 | L1 and L2 pass; L3 fails in ≤3 regions; M-W16-2 run and ≥20/39 |
| 4 | L1 passes, L2 passes, L3 fails broadly — the grammar is written but the world does not contain it |
| 2 | L1 passes only; the table exists and the terrain does not match it |
| **0 — WE LOSE** | Any of: ≥3 regions sharing a macro-form class; L2 failing on ≥4 regions; M-W16-3 below 40% (the regions are a colour grade); the census quoted without its selfcheck |

**Native → ladder anchors** (`SCORING.md` §1.2): bands above are 0–10 native.

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation:** band, worst-check-wins across L1/L2/L3.

## How we lose

- **The table ships and the world does not change.** Measured today: L1 and L2 **pass**, L3 finds
  **3 of 65** elements (5%). The grammar is written; the world contains almost none of it. This is
  the honest starting state and the only dishonest thing would be to score it as a pass.
- **Landform declared to match what was already built.** L2 is satisfiable by writing the class that
  fits the terrain you have. That is legitimate for a first pass and fatal as a habit — it turns the
  item into a description. M-W16-3's greyscale control is the defence: a landform reverse-engineered
  from a noise field will not be identifiable with the colour removed.
- **One generator, thirteen parameter sets.** The specific tell is that every region's channel-noise
  field has the same statistics; measured on the shipped tree the per-region mean `chan_noise` spans
  119–142 out of 255, i.e. **the drainage texture is the same everywhere.** Declaring `trellis` for
  Valus Ridge and `anastomosing` for the Rootlands means nothing until those two look different.
- **Geology as a word in a lore book.** "Bedded gypsum and marl" is worth nothing if the rock renders
  as the same grey cliff as the limestone. Bedrock must reach the player through material, outcrop
  shape and what the quarry/kiln/tomb near it is made of.
- **Elements built once as set-dressing.** A single sinkhole in Blackwood satisfies a naive L3 and
  nothing else. `RI-WLD15` W15-3 is the pair to this: elements must recur often enough to change a
  six-minute walk, not exist once to tick a box.
- **Two regions sharing a class quietly.** L1 permits exactly one shared class. The pressure to add a
  second "levee-and-backswamp" because it is the marsh default is exactly the pressure that produced
  one green swamp seen four times (`RI-WLD04` How we lose).

## Provenance note

- `constructed` (binding): the macro-form and drainage vocabularies, all thirteen assignments, every
  class envelope in §3, the L1/L2/L3 thresholds, and the §4 amendment adding landform as `RI-WLD04`
  M18's compulsory tenth axis.
- `derived`, high confidence: every `measured_*` field in `landforms.json`, and the L3 = 3/65 and
  `chan_noise` 119–142 figures, taken from `game/data/world/terrain.json` at commit `cf2755a`.
- `community-data`, confidence medium: xanmeers as Merethic-era stepped stone pyramids of white
  limestone, with later Argonian settlements built on them (UESP *Lore:Xanmeer* is a stub; the claim
  is carried by *Lore:The Improved Emperor's Guide to Tamriel/Black Marsh* and the Murkmire material
  in `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz`). Helstrom "Heart-Mud, known for being
  really black" and the province's river systems all draining into Middle Argonia are from
  *Lore:Middle Argonia* in the same extract. `en.uesp.net` was **not reachable from this container**
  (403 via `curl`, egress-blocked for `WebFetch`), so nothing here was verified against the live wiki
  this session; the local 2019 dump is the source.
- `canonical-recall`, confidence medium: the Vvardenfell landform examples in §The bar (foyada,
  Bitter Coast hummocks, Grazelands downs, Sheogorad stacks). The `Foyadas` place-type heading unique
  to Red Mountain is corroborated in `corpus/50-world/data/morrowind-region-census.json`; the rest is
  recalled from play.
- Everything below the bedrock line is invention constrained by canon: Black Marsh's published
  geography names regions, rivers and cities but no rock. Where canon is silent this item invents and
  is bound by its own invention (`RI-LOR01` tier `constructed`).
