---
id: RI-WLD04
title: Region identity and biome differentiation — the unlabeled screenshot test
kind: structure
side: morrowind
judges: [world.regions, world.biomes, world.terrain, world.flora, world.audio, world.weather, combat.difficulty-gating]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Vvardenfell has ~9 regions and you always know which one you are in. Ascadian Isles is green farmland
and comberry; Ashlands is grey pumice and blight; Bitter Coast is mangrove-and-fog; Molag Amur is
lava-tube badlands; Grazelands is open gold; Sheogorad is black rock islands. They differ in ground
texture, silhouette, flora species, fauna, architecture, weather, ambient audio and *danger*, not in fog
colour. Our thirteen regions must clear the same bar, and the acceptance test is brutal and simple:
**screenshot a random point in a region, strip every label, show it to a fresh judge, and they name the
region correctly ≥85% of the time.** Each region owes seven things — palette, dominant flora, dominant
fauna, architecture, ambient audio bed, weather profile, hazard — plus **one thing you see only here**,
plus a Souls difficulty tier (S9: gated by lethality, never by level-scaling).

## The reference artifact

Machine-readable in `corpus/50-world/regions.json` (with AABBs in both source pixels and world metres).
Region centroids are derived from label positions on the map source; boundaries on the map are
irregular and the AABBs are containment hints, not boundaries.

### The thirteen regions

| # | Region | km² | Tier | Palette (primary / secondary / light) | Dominant flora | Dominant fauna | Architecture |
|---|---|---|---|---|---|---|---|
| 1 | **Western Rootlands** | 1.17 | **1** | `#6E8A4E` `#6B5638` `#A8B7A6` | reed, paddy-fern, 8 m root-arches over the road | mudcrabs, egg-tender herds, hackwings | root-arch villages, nest-mounds; Blackrose's walls; Lilmoth's stilt slum |
| 2 | **Eastern Rootlands** | 1.44 | **2** | `#4F7A5E` `#2A211A` `#B7C4C0` | floating meadow, air-plants, tannin-black channels | swamp-jelly canopies, wamasu, tide-fishers | stilt-rows on platforms that rise and fall with the tide |
| 3 | **Blackwood** | 2.07 | **2** | `#1F2E1C` `#4A3423` `#C9A54B` | buttressed hardwood, strangler vine, luminous fungus shelves | chitin hounds (eyeless pack predators), tusk-lurkers, bandits | Ayleid white-stone drowned to the second storey; Imperial logging camps; Gideon |
| 4 | **The Hive** | 0.31 | **2** | `#D6C77A` `#9A6B2F` `#E6E2D0` | none — the ground is comb | drones the size of dogs; one queen | the hive IS the architecture: waxen towers, comb-cliffs, sphincter doors |
| 5 | **Marauder's Coast** | 0.49 | **2** | `#8E8A7E` `#2C3A2E` `#5E7C88` | mangrove, salt-grass, barnacle shelf | cart-sized mire-crabs (used as pack animals), gulls, drowned-things at night | bone-scaffold towers of lashed leviathan ribs; ship hulls beached hull-up and lived in |
| 6 | **The Stone Forest** | 1.80 | **3** | `#7C8794` `#B8712C` `#3D5A3A` | living trees among petrified ones — indistinguishable until touched | wamasu herds, stone-shelled beetles, Hist-tenders | xanmeer ziggurats; Helstrom grown into the greatest Hist |
| 7 | **The Salt Hills** | 0.94 | **3** | `#7D8B5C` `#9A968C` `#C6D2DA` | hill grass, salt-cedar, gorse | guar herds, hill-wamasu, Dunmer slaver-raiders | Imperial cut stone: milestones, watchtowers every third hill, a legion fort |
| 8 | **Valus Ridge** | 1.71 | **4** | `#B9B2A0` `#4E6B3C` `#8FA6B4` | stunted thorn-pine, hanging moss curtains, cliff-lichen | hackwing eyries, wamasu, mountain chitin-hounds | Ayleid watchtowers, Imperial border cairns — nothing lived in |
| 9 | **Thornmarsh** | 1.08 | **4** | `#241E1C` `#8B8577` `#46583F` | black needle-thorn thickets 6 m tall, impassable off the cut paths | hackwings nesting in thorn, feral guar, thorn-spiders | Thorn village: black-thorn thatch over a rotted great-hall |
| 10 | **The Clay Moor** | 0.81 | **4** | `#9C5B3C` `#C39A5C` `#C8BFA8` | sparse scrub on fired red clay; no standing water | naga (a hostile *culture*), clay-crawlers | naga kiln-cities: domes fired in place, kiln still lit beneath the floor |
| 11 | **Crimson Coast** | 0.63 | **4** | `#8E2B33` `#232021` `#6C7A80` | crimson tide-lichen over every surface to the high-water mark | dye-worms, red cormorants, lichen-blind beggars | Archon's clay domes; open dye-vats on the strand |
| 12 | **The Deep Marshes** | 1.26 | **5** | `#16191A` `#3B5A3A` `#4A3A55` | corpse-lily, drowned trees, black standing water | **voriplasm (living mud)**, naga raiders, unnamed things | nothing stands — drowned xanmeers break the surface like teeth |
| 13 | **Stone Wastes** | 0.81 | **5** | `#DCD2B8` `#8C5A3A` `#EDEDE6` | almost none: salt-crust and glass-thorn | salt-worms, bone-pickers, the last dying Hist | Soulrest: whale-bone frames, salt-block walls, bleached white |

### The four remaining columns

| # | Region | Ambient audio bed | Weather profile | Hazard | **ONLY HERE** |
|---|---|---|---|---|---|
| 1 | Western Rootlands | frog chorus; reed rustle; a hide-drum on a 90 s beat | warm rain; dawn mist | low — mudcrabs, thieves, slaver press-gangs | **the road IS a Hist root** — you walk on living wood that flexes underfoot, and the arches over you are its branches |
| 2 | Eastern Rootlands | water slapping stilts; a low jelly-hum; oars | humid; night bioluminescence turns the water into a second sky | tide-gated paths; drowning; cut off for up to 6 real minutes | **drifting bell-organisms metres above the water**, glowing at night, throwing moving light down onto it |
| 3 | Blackwood | canopy drip; a solid wall of insect noise; distant axe-strokes | heavy rain; light only in shafts | sightline under 20 m — ambush country | **welkynd-lit Ayleid ruins swallowed by living wood**: white stone with roots through it, glowing blue in green dark |
| 4 | The Hive | a single sustained insect chord that shifts pitch with distance to the queen | **none — always warm and still; rain does not fall in the hive's air** | the floor is comb and gives way; falls into sealed cells | **a region with no weather and no plants, whose floor is edible and only sometimes load-bearing** |
| 5 | Marauder's Coast | surf; rope creak; gull-cry; one bell buoy audible at 600 m | sea-fog banks rolling in on a ~6 minute cycle | the tide — flats flood and strand you | **whole ships walked up the shore and inhabited hull-up**, chimneys punched through the keel |
| 6 | The Stone Forest | stone tick as boles cool; wind through petrified trunks; a low choral hum from the Hist | clear high light; dry thunder with no rain | moderate; wamasu pair-lightning | **a forest half turned to stone**, where you cannot tell which trees are alive until you put a hand on one |
| 7 | The Salt Hills | legion horn on the hour; guar-bells; wind with no insect layer under it | cold rain; snow on peaks you can see and never reach | slaver ambush on pass roads; exposure on the ridge at night | **Imperial road-milestones with distances carved in Cyrodilic** — the only place in Argonia where anyone measured anything |
| 8 | Valus Ridge | wind through rock flutes (a real audible chord); rockfall; hackwing screams | cold rain; cloud *below* the player on high paths | falls; hackwings that stagger you off ledges | **the rock flutes** — wind-holed limestone spires that hum a fixed chord audible at 400 m and usable as a compass |
| 9 | Thornmarsh | thorn-clatter like dice in a cup; **no birdsong inside the thicket** | grey ash carried south from Morrowind, dusting every surface | no sightlines; the cut paths are re-cut weekly | **an ash-dusted thorn labyrinth navigated by knife-marks cut into stems** |
| 10 | The Clay Moor | kiln roar; untranslated naga speech; wind over open ground | dry; dust-devils; heat shimmer | naga territory — the only hostile culture, with patrols, sentries and reprisal | **buildings fired like pots, with the kiln still lit underneath them** |
| 11 | Crimson Coast | **the lichen's thin scream when trodden**; surf; vat-bubble | sea-squalls off the Padomaic | dye-fume sickness (named, curable); slick lichen on rock | **a coastline that is red because it is alive**, and screams thinly under your boots |
| 12 | The Deep Marshes | **no birds.** A low intestinal gurgle. A sound like breathing that is not yours | green fever-fog carrying a named disease | **the ground is an animal** — voriplasm swallows and digests; instant-death sinks | **mud that moves toward you** |
| 13 | Stone Wastes | near-silence broken by the tick of cooling stone; then the salt-storm roar | salt-storms (ash-storm analogue): visibility to 15 m, chip damage | no water; the storm hides enemies as well as terrain | **crater-fields** — perfectly circular pits of glassed salt, and no one will say what made them |

### Difficulty tiers (S9 — lethality gating, never level-scaling)

| Tier | Regions | Design contract |
|---|---|---|
| 1 | Western Rootlands | Player starts at **Lilmoth**. Enemies telegraph slowly, 1–2 per group, forgiving punish windows. |
| 2 | Eastern Rootlands, Blackwood, The Hive, Marauder's Coast | 2–4 per group; first enemies that punish greed. |
| 3 | The Stone Forest, The Salt Hills | Ranged + melee mixes; first roaming elite. |
| 4 | Valus Ridge, Thornmarsh, The Clay Moor, Crimson Coast | Ambush geometry; naga patrols with reinforcement; environmental death. |
| 5 | The Deep Marshes, Stone Wastes | Kills an unprepared level-1 player in under 10 seconds and is **reachable from the start**. No barrier, no warning but the world's own look. Morrowind lets you walk into Molag Amur at level 1; so do we. |

**Binding:** no enemy anywhere scales to player level (AR/S9). Region tier is expressed purely as enemy
roster, group size, damage and hazard.

### The differentiation contract (what must differ, mechanically)

For any two regions A and B, **at least 6 of these 9 axes must differ measurably**:
ground albedo/material, terrain slope histogram, dominant flora species set, dominant fauna species
set, architecture mesh set, ambient audio bed, weather state machine, fog/extinction profile, and
hazard type. Fog colour alone counts as **one** axis and can never be more than one.

## Comparison method

**M17 — THE BLIND REGION TEST** (`blind_pair: yes`; this is the item's primary instrument).
1. For each of the 13 regions, sample 3 random walkable points ≥120 m from any settlement.
2. At each point render a 1280 × 720 screenshot, eye height 1.7 m, FOV 70°, random yaw, weather sampled
   from that region's profile, **daytime**. Strip HUD, labels, compass, region name — everything.
3. Shuffle the 39 images. Give a fresh judge (no context) the list of 13 region names plus the seven
   descriptor columns above, and ask: *"assign each image to exactly one region."*
4. **Pass: ≥33/39 correct (85%). Fail: <28/39 (72%).** Report the confusion matrix.
5. **Any pair of regions confused ≥4 times across the set is a named defect** and must be reported with
   the specific axes that failed to differentiate.
6. Repeat the sample at **night** and in **each region's worst weather**. Night accuracy ≥70% required
   — a region that is only identifiable in clear daylight is half-built.

**M18 — Differentiation matrix (mechanical, no human).** For all 78 region pairs, compute the 9 axes
from world data: mean ground albedo (ΔE > 12 to count as different), slope histogram (χ² test),
flora species Jaccard (<0.4 to count), fauna Jaccard (<0.4), architecture mesh Jaccard (<0.3), audio
bed asset set (any difference), weather state set (any difference), fog extinction coefficient
(>25% relative), hazard type (any difference). **Pass: every pair differs on ≥6 axes. Fail: any pair
differs on ≤3.**

**M19 — The "only here" audit.** For each region's ONLY-HERE element, query world data for entities of
that class. **Pass: the element exists in its region with ≥8 instances (≥1 for singular features like
the queen), and 0 instances in any other region.** An ONLY-HERE element found in two regions is a
straight fail for both.

**M20 — Audio blind test.** Record 20 s of ambient audio at 3 points per region, no music, no combat.
Shuffle the 39 clips; a fresh judge assigns regions from the audio bed column alone. **Pass: ≥26/39
(67%). Fail: <18/39.** Morrowind's regions are audibly distinct and ours must be too; audio is the
cheapest region signal and the first one cut.

**M21 — Lethality gating (S9).** For each region, spawn a scripted level-1 loadout and walk 400 m along
the region's main track with a fixed defensive policy (block, no dodge). Record time-to-death or
survival. **Expected: tier 1 survives; tier 2 survives with <50% HP; tier 3 dies in 60–180 s; tier 4
dies in 20–60 s; tier 5 dies in <15 s.** Then assert from enemy data that **no enemy anywhere has a
level-scaling component**. Any level-scaling found is an AR-1/S9 violation and fails the whole world.

## Scoring

| Score | Condition |
|---|---|
| 10 | M17 ≥37/39 day and ≥32/39 night; M18 all pairs ≥7 axes; M19/M20/M21 clean |
| 8 | M17 ≥33/39; night ≥27; M18 all pairs ≥6 axes; M20 ≥26/39 |
| 6 | M17 28–32/39; M18 has ≤3 pairs at 4–5 axes |
| 4 | M17 22–27/39; regions differ but two or three are interchangeable |
| 2 | M17 15–21/39; regions differ mainly by tint and fog |
| **0 — WE LOSE** | Any of: M17 <15/39 (chance is 3/39); M18 finds any pair differing on ≤3 axes; two regions share an ONLY-HERE element; a level-scaling component exists on any enemy |

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band.

## How we lose

- **Regions that differ only in fog colour.** The named failure from the brief. One terrain material,
  one tree, one grass, one rock, and a per-region `fogColor` — thirteen tints of the same swamp. M18's
  6-of-9 rule exists exactly to make this arithmetically impossible to pass.
- **One green swamp.** The whole province reads as "generic marsh", so Blackwood, the Rootlands, the
  Deep Marshes and Thornmarsh are one region seen four times. Note that four of our thirteen regions
  are deliberately *not green*: Stone Wastes (bleached), Clay Moor (fired red), Crimson Coast (blood),
  Salt Hills (upland). If the built world is majority-green, this item has already failed.
- **Palette without material.** Getting the hex values right and applying them as a colour grade over
  the same ground texture. Albedo must come from different materials, not a LUT.
- **Silent regions.** Shipping one ambient loop for the whole world. M20 catches it, and it is the
  single cheapest way to double region legibility.
- **ONLY-HERE assets reused.** The rock flutes look great, so they get scattered into the Stone Forest
  too, and now neither region owns anything. M19 fails both.
- **Difficulty by numbers.** Making tier 5 hard by multiplying enemy HP rather than by changing the
  roster, the group sizes and the hazard. A voriplasm that is a reskinned mudcrab with 4× health is not
  a tier-5 region, it is a spreadsheet.
- **Tiers enforced by walls.** Blocking the Deep Marshes until level 20. That is Souls-leakage into
  world structure (AR-2). The Deep Marshes must be walkable from minute one and must kill you.
- **Night forgotten.** Regions that are distinct at noon and identical at midnight. Half the day is
  night; M17's night pass is not optional.
- **The Hive built as a cave.** Its whole identity is "no weather, no plants, edible floor, one chord".
  If it ships as a brown cave with bee props, the world loses its strangest 0.31 km².

## Provenance note

- `derived-from-map`: all 11 map-labelled region names, their label positions and approximate extents,
  read from `black-marsh-map-source.jpg` with a 128 px grid overlay. Centroid error ≈ ±30 m; AABBs are
  eyeballed containment boxes with error up to ±150 m and are explicitly **not** authoritative
  boundaries.
- `canonical-recall` / `community-data`, confidence medium: **Thornmarsh** is a canonical Black Marsh
  region name (UESP lists Thorn as "a settlement in Thornmarsh, near Morrowind"), retrieved 2026-08-05,
  and is therefore added to the map's 11 to cover the north-east. **The Salt Hills** is `constructed` —
  the map leaves the Stormhold uplands unlabelled and a region with a capital-tier settlement in it
  cannot stay nameless. Also `community-data`: Argonian xanmeers as stepped stone pyramids, Hist roots
  running province-wide beneath soil and white limestone, and naga as a distinct Argonian people —
  UESP Lore:Black Marsh and ESO Murkmire material.
- `canonical-recall`, confidence medium: Vvardenfell's region roster and their differentiating features
  (Ascadian Isles / Ashlands / Bitter Coast / Molag Amur / Grazelands / Sheogorad / West Gash /
  Azura's Coast / Red Mountain) used as the bar in §The bar. Not verified this session.
- `constructed` (binding): every palette hex, flora/fauna/architecture/audio/weather/hazard assignment,
  every ONLY-HERE element, all thirteen area figures, the difficulty tiers, the 6-of-9 differentiation
  contract, and M17–M21 with their thresholds. The area figures are apportioned to sum to the 14.52 km²
  land figure derived in RI-WLD01 and carry the same ±8% error.
