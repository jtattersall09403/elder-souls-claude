# Auditing the bar itself: world design, region character, landform, and Black Marsh canon

**Task** `BAR-AUDIT-WORLD-20260814` · **branch** `codex/wave1-build-experiment` · **commit** `cf2755a`
**Charge** `orchestration/OWNER-DIRECTIVES-2026-08-14.md` §6 — *"our bar and reference materials might
be sufficient and they might not be."*

Every number below is stamped to commit `cf2755a` (rule 12) and was taken from static world data with
no browser; nothing here contended for a GPU or a headless shell.

---

## 1. The short version

The world corpus is in better shape than the question implies, and it has one clear hole that is
exactly the one the owner named.

Fourteen world reference items and eight lore items cover scale, density, settlements, region
identity, strangeness, markerless navigation, verticality, the living world, opacity, water, hazards,
region borders, interior/exterior continuity, built alienness, transport and travel magic. Region
identity in particular is strong: `RI-WLD04` already runs an unlabelled-screenshot test at 85%, a
nine-axis differentiation matrix over all 78 region pairs, an audio blind test and a lethality-gating
check. Canon is strong too — `RI-LOR01` carries a tiered fact registry, `RI-LOR08` picks six
Argonian peoples all traceable to shipped Bethesda/ZOS material and records, with reasons, the four
canonical Murkmire tribes it deliberately left on the table.

**The hole is the walk.** Every variety measure in the corpus is *between* regions or *across* the
world. Nothing measured what happens during the six minutes you spend inside one region — which is
where "you were never just walking over samey landscape for ages" actually lives. And nothing
anywhere in the corpus described the **shape of the ground**: `RI-WLD04` gives each region seven
things it owes and landform is not one of them, `regions.json` has no field for it, and the words
*geology*, *topography* and *geomorphology* appear **zero times** in the whole corpus.

That gap has a measurable consequence today. Running a new probe against the shipped world: the
Deep Marshes contains a **275-second walk that crosses one single ground state**, Valus Ridge has a
**312-second** one and a modal ground state covering **79%** of the region, and eleven of thirteen
regions sit over the target for unchanging-stretch length. All of that passes every item the corpus
had this morning.

Four things were added, and they are the deliverable: two reference items, an instrument for each
(both with working negative controls), and a mined Morrowind region census so the *Morrowind* side of
the bar stops being a recollection.

---

## 2. Coverage inventory — what the corpus actually has

| Subject the owner named | Status | Where |
|---|---|---|
| World scale, crossing time, coordinate system | **measurable item** | `RI-WLD01` — 14.5 km², 57.6-min crossing, walk-probe method |
| Density of things to find per minute | **measurable item** | `RI-WLD02` — TTNIT median ≤45 s, 1,060 POIs, D1–D13 + V5/V6 |
| Region character and differentiation | **measurable item** | `RI-WLD04` — M17 blind screenshot ≥33/39, M18 9-axis matrix, M19 ONLY-HERE, M20 audio blind, M21 lethality |
| Region borders and transitions | **measurable item** | `RI-WLD12` — staggered crossover, M64–M70, weighted |
| Settlement anatomy and placement | **measurable item** | `RI-WLD03` + `settlements.json`; Morrowind census in `data/morrowind-world-census.json` |
| Road / path network as a graph | **measurable item** | `RI-TRV01` (17 lines, 26 stations, fares), `RI-WLD06` (100% junctions signposted, road_class per maintainer) |
| Verticality and elevation | **measurable item, world-aggregate only** | `RI-WLD07` §4 — see §5 for why the aggregation hides regions |
| Water, tide, depth bands | **measurable item** | `RI-WLD10` |
| Environmental hazards | **measurable item** | `RI-WLD11` — thirteen, one per region |
| Deliberate emptiness | **measurable item** | `RI-WLD09` — ≥5 void tracts, ≥14% of land, ≥240 s POI-free walks |
| Black Marsh / Argonian canon | **measurable item + data** | `RI-LOR01` (tiered registry), `RI-LOR07` (conformance), `RI-LOR08` (six peoples), `canon-facts.json`, `blackmarsh-canon.json`, `jel-lexicon.json`, 160 Lore pages in the local UESP extract |
| Argonian naming and language | **measurable item + data** | `RI-LOR04`, `argonian-names.json`, `jel-lexicon.json` |
| **Within-region variety along a walk** | **was: nothing** | now `RI-WLD15` |
| **Landform, geology, drainage, bedrock** | **was: nothing** | now `RI-WLD16` + `landforms.json` |
| **Per-region POI *type* mix** | **prose only** | `RI-WLD02` is region-blind; see §5.4 |
| **Morrowind's own regions as measured reference** | **was: recall only** | now `data/morrowind-region-census.json` |
| Topological / contour map of our province | **partial** | `terrain.json` is a real 193×222 raster with 25 m cells and −42.3 m to +423.9 m relief; there is no rendered contour or region map artefact in the corpus, and `black-marsh-map-source.jpg` is a source image, not a derived map |

Nothing in the world domain is a *hole* in the `INDEX.md` sense — coverage was and remains 0 holes
across 330 subsystem paths. The gaps found here are gaps inside items that exist, which is the harder
kind to see.

---

## 3. Testing the specific claim

> *"Morrowind's regions are strongly differentiated… Does our corpus encode anything that would force
> that differentiation, and would our current world pass it?"*

**Between regions: yes, and the world would probably pass on merit.** `RI-WLD04` M18 is a real
constraint and the built world clears its spirit as well as its letter. Measured from
`weather.json`, the thirteen regions' stationary weather distributions span P(sun) 0.00 (Deep
Marshes) to 0.80 (the Hive) and mean sightline 204 m to 920 m; from `terrain.json`, mean slope spans
3.61° (Eastern Rootlands) to 30.28° (Valus Ridge) and max elevation 5.6 m to 423.9 m. These are not
thirteen tints of one swamp.

**Within a region: no — and that is where the answer is "we would pass while being samey."**
`corpus/80-methods/m-wld15-monotony.mjs` walks 24 straight 720 m transects per region (six minutes at
2.0 m/s), samples every 25 m, and records the *ground state* at each sample — substrate, standing
water, local relief band, macro-form, enclosure. Measured on `cf2755a`:

| region | ground states in region | modal share | min states / 6-min walk | median run | p90 run |
|---|---:|---:|---:|---:|---:|
| blackwood | 72 | 21% | 2 | 112.5 s | 212.5 s |
| clay-moor | 31 | 24% | 4 | 137.5 s | 175 s |
| crimson-coast | 67 | 16% | 3 | 87.5 s | 162.5 s |
| deep-marshes | 93 | 29% | 1 | 137.5 s | **275 s** |
| eastern-rootlands | 82 | 33% | 2 | 137.5 s | 212.5 s |
| hive | 9 | 46% | 5 | 75 s | 75 s |
| marauders-coast | 64 | 11% | 6 | 137.5 s | 137.5 s |
| salt-hills | 52 | 39% | 3 | 112.5 s | 162.5 s |
| stone-forest | 44 | 27% | 1 | 150 s | 225 s |
| stone-wastes | 50 | 26% | 4 | 137.5 s | 237.5 s |
| thornmarsh | 79 | 14% | 2 | 112.5 s | 187.5 s |
| valus-ridge | 26 | **79%** | 1 | 225 s | **312.5 s** |
| western-rootlands | 90 | 20% | 4 | 112.5 s | 175 s |

The interesting shape is not "the world is flat" — it plainly is not. It is that **variety exists but
is arranged in patches larger than a walk**. The Deep Marshes holds 93 distinct ground states and
still contains a four-and-a-half-minute walk that crosses one. Inventory is not itinerary, and no
item in the corpus was counting itinerary.

Two supporting tells, same commit:

- **The drainage texture is uniform province-wide.** Per-region mean `chan_noise` spans 119–142 out
  of 255 across all thirteen regions — one channel field, everywhere.
- **`RI-WLD09`'s void tracts land on top of the worst of it.** V-01 "The Drowned Reach" declares a
  420-second POI-free walk in the Deep Marshes, which is precisely the region with the 275-second
  unchanging-ground run. The corpus was requiring long empty walks and requiring nothing of the
  landscape during them. `RI-WLD15` W15-7 closes that by binding unrelaxed inside declared tracts.

**Verdict on the claim: the corpus forces between-region differentiation and does not force
within-region variety, and the built world reflects exactly that.** `RI-WLD15` is the missing item;
this table is its baseline.

---

## 4. Black Marsh canon — what I found, and what I could not reach

### 4.1 Reachability, plainly

- **`en.uesp.net` is not reachable from this container.** `curl` returns **HTTP 403** on
  `Lore:Black_Marsh` and `Lore:Argonia`; `WebFetch` returns `EGRESS_BLOCKED`. Nothing on the live
  wiki was read this session and no claim below is sourced to it.
- **`elderscrolls.fandom.com` was not fetched**; it appeared only as a search result title.
- **What I used instead:** `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz`, the local 2019-11-07
  UESP dump already in the repo — 6,299 pages, 160 of them Black Marsh Lore pages. For this subject
  it is better than the network: it carries the primary in-world sources in full.

### 4.2 The canonical geography, from the local extract

- **Named regions.** *Shadowfen* — "the northwest region of Black Marsh… a fetid mire, often fought
  over by the Imperial Legion and Dunmer slavers", holds Stormhold, source of the Knahaten Flu.
  *Murkmire* — "a coastal region in southern Black Marsh with access to Oliis Bay", holds Lilmoth,
  "inhabited by both Argonian and Naga tribes". *Middle Argonia* — "the impenetrable center, and the
  dark heart of Black Marsh, where only the Argonians can survive", holds Helstrom and "Heart-Mud,
  which is known for being really black". Plus Blackwood, Thornmarsh and Arnesia as border regions.
- **The province's structural principle**, stated in almost identical words by PGE 1st and 3rd
  editions and by Flaccus Terentius: **the borderlands and coasts are ravaged, colonised and legible;
  the interior is inviolate.** *"Its borderlands and coasts have been ravaged by civilization after
  civilization, but its heart is inviolate, for so poisonous is its air, ground, and water, its
  mysteries are secure."* This is the canonical **gradient** of Black Marsh, and it is the one
  large-scale canonical fact our corpus does not test (see §5.5).
- **Water is the road network.** "The province is known for various river systems, all of which flow
  into Middle Argonia" — Onkobra, Oortrel, Keel-Sakka; Topal Bay, Oliis Bay, the Southern Sea. The
  Imperial Navy's first penetration of the interior was **up a river**, following Red Bramman to
  Blackrose. `RI-TRV01` already honours this: 7 of 10 trunk legs and 7 of 8 settlements are
  boat-reachable.
- **Xanmeers.** Merethic-era stepped stone pyramids with carvings of reptilian heads "stylized with
  right angles"; many present-day settlements are built on them, using them as palaces and plazas.
  `Lore:Xanmeer` on UESP is a stub — the substance is in the Murkmire material and the Improved
  Emperor's Guide.
- **Peoples.** Black Marsh held more cultures than any comparable province: Kothringi, Orma, Yespest,
  Horwalli (men), Barsaebic Ayleids and Cantemiric Ashlanders (mer), and the vulpine Lilmothiit.
  Stormhold and Gideon were **founded by Ayleids**. The Knahaten Flu (2E 560, forty years) killed
  everything not of reptilian stock and is why the province is Argonian now.
- **The wet has varieties, and outsiders' categories fail on them.** The sources distinguish salt
  marsh, mangrove thicket, "inland waterways", bayou, "ash mires"-equivalent bogs and open channel —
  and consistently say the outsider cannot tell them apart, which is itself the point. *"Imperial
  geographers seem to have circumvented this entire swamp and used imagination instead."*
- **Argonian time is not Imperial time.** *The Seasons of Argonia* gives twelve months named for the
  Hist's life cycle — Vakka, Xeech, Sisei, Hist-Deek, Hist-Dooka, Hist-Tsoko, Thtithil-Gah, Thtithil,
  Nushmeeko, Shaja-Nushmeeko, Saxhleel, Xulomaht — with Three Mournings. `RI-LOR04` and the shipped
  `jel-lexicon.json` already carry Jel; the calendar is a good, cheap wave-2 strangeness hook.

### 4.3 How our corpus stands against it

Well, on the whole. Our eight settlements (Lilmoth, Gideon, Stormhold, Helstrom, Archon, Blackrose,
Soulrest, Thorn) are all canonical and correctly characterised; Blackrose as a Second-Era prison on a
Lilmothiit site is right; `RI-LOR08`'s six peoples are all canon-named; the four Murkmire tribes it
did not use (Bright-Throats, Black-Tongues, Ghost People, Root-House People) are listed in its
rejected-names table with a reason each, which is the correct form and not a gap.

Two things worth naming:

1. **Ten of our thirteen region names are invented** (Western/Eastern Rootlands, The Hive,
   Marauder's Coast, Stone Forest, Salt Hills, Clay Moor, Crimson Coast, Deep Marshes, Stone Wastes);
   three are canonical (Blackwood, Thornmarsh, Valus Ridge ← Valus Mountains). That is defensible —
   Morrowind invented most of Vvardenfell's place names too — but **Shadowfen, Murkmire and Middle
   Argonia are the three names an Elder Scrolls player will look for**, and none of them is used. A
   cheap fix costing no built content: name our regions' *canonical parents* in `regions.json` and in
   the in-world books, so Stormhold's uplands are "the Salt Hills, in Shadowfen".
2. **The coast→interior gradient is not encoded anywhere.** See §5.5.

---

## 5. Where the existing bar is too weak — with the predicate that would pass a bad result

This section is the one to read. New items are cheap; a weak predicate in an item everyone is already
building against is expensive.

### 5.1 `RI-WLD04` M18 — three of nine axes are set-membership with no magnitude

The differentiation matrix requires ≥6 of 9 axes to differ. Three of them are *"any difference"*:

> audio bed asset set (**any difference**), weather state set (**any difference**), hazard type (**any
> difference**)

**The bad result that passes:** region A and region B share an ambient loop, a weather machine and a
hazard, and A adds one extra rain state that fires 0.5% of the time, one extra bird sample, and a
hazard that exists on 3 m² of its territory. Three axes now "differ". Add ground albedo, a flora
species and an architecture mesh and the pair passes 6-of-9 while being indistinguishable in play.

**A fourth axis has the same problem for the opposite reason.** "Slope histogram (χ² test)" has no
effect-size floor. With 3,494 cells in Blackwood and 3,083 in Valus Ridge, χ² will report
significance on essentially any real pair — it is measuring *detectability at large n*, not
perceptibility. As written the axis passes automatically.

**Suggested repair, using measured Morrowind data rather than a guess.**
`corpus/50-world/data/morrowind-region-census.json` (new, §6) mines the exact weather probability
vectors from the nine Vvardenfell region pages. Their pairwise L1 distances have a **minimum of 20
percentage points** and a **median of 90**. So: *the weather axis counts only if the two regions'
stationary weather distributions differ by ≥20 pp L1* — Morrowind's own closest pair as the floor.
Similar magnitude floors are wanted on audio (≥50% of the bed's assets differ) and hazard (the
hazard must occupy ≥15% of each region). The slope axis wants an effect size — Cramér's V ≥ 0.2 —
not a p-value.

### 5.2 `RI-WLD04` M19 — ONLY-HERE elements have a count but no spread

> *"Pass: the element exists in its region with ≥8 instances… and 0 instances in any other region."*

**The bad result that passes:** all eight rock flutes stand in one 50 m clump beside the road, and
the other 1.7 km² of Valus Ridge has none. The region's unique feature is a single diorama. A spread
requirement — e.g. instances distributed across ≥3 of the region's quartiles, and ≥40% of the
region's area within 400 m of one — costs nothing to add and is what makes the element feel like a
property of the place.

### 5.3 `RI-WLD07` §4 — verticality targets are world-aggregate, so most regions can be flat

> *"Mean slope on non-road walkable land — target 6–14°, fail <3°."*

**The bad result that passes, and it is the current build.** The area-weighted mean slope of the
shipped world is **10.07°**, comfortably mid-band — while **7 of the 13 regions are below 5.5°**
(Eastern Rootlands 3.61, Western Rootlands 4.00, Stone Wastes 4.17, Marauder's Coast 4.99, Crimson
Coast 5.15, Deep Marshes 5.24, Clay Moor 5.32). Valus Ridge at 30.28° and the Salt Hills at 16.62°
are carrying the average for everyone. The same is true of "land below +5 m: 35–50%" and "land above
+100 m: ≥12%", both global. Repair: state the row **per region**, with per-class envelopes — which is
what `RI-WLD16` §3 now provides, so the fix is to point `RI-WLD07` §4 at it rather than to invent a
second table.

### 5.4 `RI-WLD02` — the density model is region-blind

The whole POI apparatus — three tiers, 1,060 targets, D1–D13 — is province-global. There is **no
requirement that different regions offer different *kinds* of thing to find**, only different
amounts. A world that scatters the same tier mix uniformly passes every D-metric.

Morrowind does not do this, and now we can show it rather than assert it. From the mined census, the
**place-type Jaccard between region pairs runs 0.267 to 0.727** — no two Vvardenfell regions offer
the same menu — and **eight place types are unique to exactly one region**: Lakes and Shipwrecks
(Ascadian Isles), Ashlander Camps and House Strongholds (Ashlands), Taverns & Inns (Azura's Coast),
Main Gate and Foyadas (Red Mountain), Velothi Tower (Sheogorad). Suggested addition to `RI-WLD02`:
**place-type Jaccard ≤ 0.73 for every region pair, and ≥1 POI class unique to each region.** Both are
computable from `pois.json` today.

### 5.5 Nothing tests the canonical coast→interior gradient

Black Marsh's single most-repeated large-scale fact is that its rim is colonised and legible and its
heart is not. Our world has a plausible core (Helstrom and the greatest Hist at the centre; the Deep
Marshes at tier 5 next to it) but the pattern does not hold at the rim — the Stone Wastes are tier 5
at 2,619 m from centre while the Imperial Salt Hills sit at 2,038 m — and **no item requires it
either way**. This is a design question, not a defect, and per rule 0 I am ruling rather than
asking: **it belongs in `RI-LOR02` (era and political brief) as a measurable predicate**, not in a
new item, because it is a claim about who holds what, not about terrain. A workable predicate:
*Imperial-maintained road kilometres, Imperial architecture instances and Cyrodilic signage all
decline monotonically with distance from the province centre, and no Imperial-built structure exists
within 800 m of Helstrom.* **Reversible**: if a builder shows the Salt Hills' interior position is
load-bearing for the Stormhold quest line, drop the monotonicity and keep only the Helstrom
exclusion. I did not write this into `RI-LOR02` — it is another item's territory and the lore agents
are live — so it is filed here as a recommendation with the predicate spelled out.

### 5.6 `RI-WLD09` and `RI-WLD15` needed reconciling, and now do

`RI-WLD09` requires ≥5 void tracts covering ≥14% of the landmass with ≥240 s POI-free walks.
`RI-WLD15` requires the landscape to keep changing. Left unreconciled, the tempting move would have
been to declare the monotonous parts of the map as void tracts and collect points for it.
`RI-WLD15` W15-7 states that void tracts relax POI density and **not** landscape variety, and
M-W15-4 runs the probe restricted to each declared polygon. Emptiness is authored; sameness is not.

---

## 6. What was added

| Artefact | What it is |
|---|---|
| `corpus/50-world/RI-WLD15-within-region-variety.md` | New item. The six-minute walk. W15-1..W15-7, arm A static + arm B rendered, blind pair, delete-the-fix control, void-tract cross-check. |
| `corpus/80-methods/m-wld15-monotony.mjs` | Its instrument. Headless, ~1 s. `--selfcheck` builds a uniform world and an aperiodic varied one and asserts the metric fails the first and passes the second. Exit 2 on missing data — absence is never a pass. |
| `corpus/50-world/RI-WLD16-landform-and-geology.md` | New item. Macro-form, drainage, bedrock, soil and five named landform elements per region; class envelopes; the greyscale control; adds landform as `RI-WLD04` M18's compulsory tenth axis (6-of-9 → 6-of-10 with one named). |
| `corpus/50-world/landforms.json` | Its artefact: the thirteen grammars, machine-readable, with the shipped tree's measurements as baseline. |
| `corpus/80-methods/m-wld16-landform-census.mjs` | Its instrument. L1 grammar / L2 built-terrain-matches-declared / L3 CONSUMPTION. Six controls in `--selfcheck`. |
| `corpus/50-world/data/morrowind-region-census.json` | Mined from the nine Vvardenfell region pages: exact weather probability vectors, per-region place-type inventories, pairwise distances. Replaces recall with data on the Morrowind side of `RI-WLD04`. |
| `tools/uesp/mine-regions.mjs` | Its miner. `--check` re-mines and diffs; `--selfcheck` runs four parser probes, three of them negative. |

Both new items are in `corpus/00-doctrine/INDEX.md` (regenerated: 147 items, 330 paths, 0 holes, 0
errors) and neither adds a phantom tool.

**Measured today, honestly:** `m-wld15-monotony.mjs` exits 1 with 15 threshold breaches;
`m-wld16-landform-census.mjs` passes L1 and L2 and fails L3 at **3 of 65** landform elements present
in world data. That is the expected state of a bar written before the thing it measures, and it names
work rather than hiding it.

### A note on an instrument that was briefly wrong in the dangerous direction

The first version of `m-wld16` L3 matched any word from an element's description, so *"root-levee
(the road itself…)"* matched on **road** — and it reported **71% coverage against a world containing
none of these landforms**. Its selfcheck did not catch it because the negative control was an *empty*
world rather than a *generic* one. Both controls now run: the generic-noun control feeds it *road,
water, stone, cave, ruin, camp…* and asserts zero matches. With the phrase matcher the honest figure
is **5%**. Recording it because a passing control that could never have failed is exactly the shape
rule 4 exists to catch, and it nearly shipped inside the item that was auditing everyone else.

---

## 7. What I could not do

- **`en.uesp.net` is egress-blocked from this container** — 403 via `curl`, `EGRESS_BLOCKED` via
  `WebFetch`. No live-wiki verification happened. Everything canonical above is from the local
  2019-11-07 dump, which predates the ESO *Blackwood* chapter (2021); if that chapter published
  Black Marsh geography, we do not have it.
- **Arm B of `RI-WLD15` was not run.** It needs a browser and rendered walks, and other agents are
  live on visual fidelity; taking a browser to run a variety measurement while W1-30 is being
  captured would have cost someone else their headline number (rule 21). Arm A is a gate, not a
  verdict, and the item says so. **`RI-WLD15` and `RI-WLD16` should both be scored `not_run` until a
  critic runs arm B**, and neither should be quoted as a passing or failing verdict on the world yet.
- **I did not run `RI-WLD04` M17** for the same reason. §3's between-region evidence is from world
  data, not from the blind screenshot test that item specifies.
- **I did not edit `RI-WLD02`, `RI-WLD04`, `RI-WLD07`, `RI-WLD09` or `RI-LOR02`.** §5 names the weak
  predicates and proposes exact replacements, but amending a live item that other pieces are being
  judged against is an orchestrator's call, not an auditor's. `RI-WLD16` §4's amendment to
  `RI-WLD04` M18 is recorded inside `RI-WLD16` for the same reason — it is strictly stronger and it
  is readable in one place without touching anyone's in-flight bar.
- **No rendered contour or region map artefact was produced.** `terrain.json` is a real raster and
  could be rendered to a topographic map cheaply; it would be a genuinely useful corpus artefact and
  is not one this task had time for.
