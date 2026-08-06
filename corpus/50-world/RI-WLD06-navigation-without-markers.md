---
id: RI-WLD06
title: Navigation without markers — landmarks, signposts and prose directions
kind: structure
side: morrowind
judges: [world.navigation, world.sightlines, world.roads, world.signage, quest.journal, dialogue.directions, ui.hud]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Seam S8 is settled: **no compass markers, no objective arrows, no quest pins.** That is not a
subtraction — it is a set of obligations on the world. Morrowind is navigable because it pays for
markerlessness three times over: **landmark sightlines** (Red Mountain, the Ghostfence, a Telvanni tower
on the horizon — you always have a bearing), **roads and signposts** (Vvardenfell's roads are signed at
junctions with named, directional posts), and **prose directions in dialogue** ("follow the road east
from Seyda Neen; at the fork take the north road; the tomb is on the ridge above Pelagiad"). Our bar:
**≥3 named landmarks visible from every settlement gate**, **every road junction signposted with named
destinations and directions**, and **100% of quest destinations reachable using the journal text
alone**. The acceptance test is behavioural: a fresh agent, given only the journal entry and no
coordinates, must reach **≥9 of 10** targets.

## The reference artifact

### 1. The three navigation layers (all three mandatory; each is separately measured)

| Layer | Requirement | Measured by |
|---|---|---|
| **L1 Sightlines** | ≥2 distinct landmark silhouettes visible from 95% of walkable points; **≥3 from every settlement gate**; ≥1 "province-scale" landmark visible from ≥45% of the landmass | M27 |
| **L2 Roads & signage** | Every junction on the road graph carries a signpost naming ≥2 destinations with a direction and (where a road is Imperial) a distance; roads are visually distinct from terrain at ≥80 m | M28 |
| **L3 Prose** | Every quest destination has a `directions` string that is a walkable route description using only L1/L2 nouns; the journal reproduces it verbatim | M29, M30 |

### 2. Landmark hierarchy

| Class | Visible range | Count | Examples |
|---|---|---|---|
| **Province-scale** (visible from ≥45% of land) | 2,500–4,000 m | **4** | The Border Falls (2752.5, 425); the Great Hist of Helstrom (at Helstrom); Blackrose Prison's tower (at Blackrose); the Valus Ridge rock-flute spires (~1209, 2179) |
| **Region-scale** (visible across most of one region) | 800–2,000 m | **18** | The Xanmeer of Ix-Thakla, The Counting Obelisk, The Drowned Xanmeer, Bloodmarl Isle, Xanmeer of Sunken Teeth, Ceyatatar-Zel, The Leaning Stone, The Glassed Crater, Archon's dye-vat smoke, the Hive's waxen towers, Stormhold's legion fort, Thorn's black thicket wall, the naga kiln-plumes, Lilmoth's harbour crane, Soulrest's grey Hist, the Clay Moor's dust-devil line, the Marauder's Coast bone-scaffolds, the Salt Hills' snow peaks |
| **Local** (a bearing within 2–4 min of walking) | 200–800 m | **≥90** | wayshrines, milestones, hanging cages, broken idols, single trees of note, ford-markers, cairns |

The ten map-derived landmark coordinates are tabled in RI-WLD01 §7 and in `world-scale.json`.

### 3. Signposts — the required format

Every junction post is a readable world object with:
`{ destination_name, direction (8-point compass), distance_if_imperial_road, road_class }`
rendered in-world as legible text/glyphs at ≤6 m. Post styles differ by who maintains the road, and
that difference is itself information:

| Road class | Post style | Carries distance? | Legible to a non-reader? |
|---|---|---|---|
| Imperial road (Gideon–Helstrom, Salt Hills) | carved milestone, Cyrodilic numerals | **yes** | no — this is a *tell* about who built it |
| Causeway / stone road | painted board, two languages | no | partly |
| Marsh trail / rootland track | knife-marks cut into a root or thorn stem, Argonian glyph | no | only if you know the glyphs (learnable via dialogue) |
| Tideway | tide-pole with a painted waterline showing when it is passable | **tide state, not distance** | yes |

### 4. Prose-direction grammar (what a `directions` string may reference)

A directions string may reference **only**: settlement names; region names; the 22 province/region
landmarks; road classes and their signposted destinations; cardinal directions; water features on the
map (rivers, the bay, the ocean); and relative time-to-walk ("about a quarter-hour"). It may **not**
reference coordinates, minimap features, or anything invisible from the route.

**Worked examples (the artifact — these are the shape every quest must produce):**

> *"Out of Lilmoth by the north gate and onto the stilt causeway. Keep the harbour crane at your back.
> Where the causeway forks at the tide-pole, go left — the right-hand road drowns twice a day. Walk
> until the prison tower stands over the reeds, then take the ditch-track west before you reach the
> gate; nobody who goes through the gate comes back out the same."*
> → Lilmoth → Stilt-Row → Blackrose approach → the ditch-track. ~14 walk-minutes. Uses: settlement,
> local landmark (crane), signpost object (tide-pole), province landmark (prison tower), road class.

> *"Take the Imperial road east out of Gideon. You will pass three milestones; at the third, the white
> stone in the trees to your south is Ceyatatar-Zel. Don't go in. Keep east until the road climbs and
> you can hear the flutes on the ridge — that's Valus. The camp is under the first spire that hums."*
> → Gideon → Blackwood road → Ceyatatar-Zel as a *waypoint you are told to ignore* → Valus Ridge rock
> flutes as an **audible** landmark. ~26 walk-minutes.

> *"South from Helstrom on the river road until the ground stops being sure of itself. When the birds
> stop, you are in the Deep Marshes and you have gone too far, so turn east at the last standing tree
> and follow the teeth — the xanmeer tops break the water in a line, and they lead to the drowned one."*
> → Uses **absence of ambient audio** as a navigation cue (the Deep Marshes' no-birds rule from
> RI-WLD04) and a chain of region landmarks. ~22 walk-minutes.

### 5. What is banned (S8 enforcement)

No compass marker, no objective arrow, no floating waypoint, no "distance to objective" readout, no
minimap, no auto-path, no fog-of-war reveal-on-approach, no glowing outline on quest objects visible
through geometry. A world map item may exist (paper, static, hand-drawn, **no player dot** — or a
player dot only while standing still and only at settlements, if a later item rules that way). Any
of these appearing is an **AR-2 Morrowind-leakage violation and fails the piece outright.**

## Comparison method

**M27 — Sightline audit (L1).** Shares machinery with RI-WLD02 M8.
1. 200 random walkable points + all 24 settlement gate positions.
2. At each: 72-ray horizontal fan × 3 elevation bands, 900 m for local/region, 4,000 m for
   province-scale (raise the far plane; disable fog culling for the test but **record** whether each
   hit would have been visible under that region's median fog).
3. **Pass: ≥2 distinct landmarks at ≥95% of random points; ≥3 at 100% of settlement gates; ≥1
   province-scale landmark from ≥45% of sampled land.**
4. **Fog honesty:** re-run with fog enabled at each region's median density. **Fail if the pass rate
   drops below 80%** — landmarks that only exist with fog disabled are not landmarks.

**M28 — Signage audit (L2).**
1. Extract the road graph; enumerate every node of degree ≥3 (junction) and every settlement approach.
2. For each, search 30 m for a signpost object with the required fields.
   **Pass: 100% of junctions signposted. Fail: <85%.**
3. Check every signpost's `destination_name` resolves to a real place and its `direction` is within
   ±22.5° of the true bearing. **Any signpost pointing the wrong way is a defect, and three is a fail**
   — a lying signpost is worse than none.
4. Road visibility: from 20 random road points, screenshot forward and measure the pixel-contrast of
   the road surface against adjacent terrain at 80 m. **Fail if the road is indistinguishable at 80 m**
   in >4 of 20.

**M29 — THE FRESH-AGENT NAVIGATION TEST** (the item's primary instrument).
1. Choose 10 quest destinations spanning all 13 regions and all difficulty tiers.
2. For each, hand a **fresh agent with no world knowledge** exactly three things: the journal entry
   text, a screenshot of its starting position, and control of the capsule. **No coordinates, no map
   data, no region list.**
3. The agent may walk, look, read signposts, and re-read the journal. It may not query world data.
4. Success = capsule enters a 40 m radius of the destination within **3× the ideal walk time**.
5. **Pass: ≥9 of 10. Fail: ≤6 of 10.** Record for each failure whether the cause was (a) missing
   landmark, (b) missing/wrong signpost, (c) ambiguous prose, (d) route blocked. Each cause maps to a
   specific fix; a critic reporting "navigation is bad" without this attribution has failed its job.

**M30 — Prose-grammar audit.** Parse every `directions` string in the quest data against the §4
vocabulary. **Fail on any string containing coordinates, "marker", "waypoint", compass degrees, or a
noun that does not resolve to a placed world object.** Also assert every quest with a destination
*has* a directions string; **coverage must be 100%.**

**M31 — Marker-leakage scan (S8/AR-2).** Grep the UI layer and shader manifest for compass-marker,
objective-arrow, minimap, waypoint, auto-path and see-through-outline components. Play 15 minutes and
screenshot the HUD every 10 s. **Any marker found = the world piece fails regardless of every other
score.**

**M32 — Blind pair against Morrowind journals** (`blind_pair: yes`). Take 6 of our journal direction
entries and 6 Morrowind ones, strip attribution, and ask a fresh judge: *"which of these could you
actually follow, and which is just flavour?"* Record the blind pick before the reveal. **We lose if
our entries are judged less followable than Morrowind's on median.**

## Scoring

| Score | Condition |
|---|---|
| 10 | M29 10/10; M27 ≥3 landmarks at 100% of gates and ≥2 at 98% of points with fog on; M28 100% signage, 0 wrong bearings; M31 clean |
| 8 | M29 9/10; M27/M28 at threshold; M31 clean |
| 6 | M29 7–8/10; ≤15% junctions unsignposted |
| 4 | M29 5–6/10; sightlines pass but prose is vague |
| 2 | M29 3–4/10; the world is navigable only by wandering |
| **0 — WE LOSE** | Any of: M31 finds any marker/arrow/minimap/auto-path (automatic fail, AR-2); M29 ≤2/10; M30 coverage <100%; >3 signposts pointing the wrong way; fog-on sightline pass rate <80% |

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band.

## How we lose

- **We delete markers and add nothing.** The cheapest possible failure: strip the compass, ship a flat
  marsh with no skyline, no signposts and journal entries that say "find the shrine". The player
  wanders for forty minutes and quits. Markerlessness is a *cost* the world pays for in landmarks and
  prose; if we don't pay it, S8 makes the game worse rather than better.
- **Landmarks that fog eats.** Beautiful spires at 900 m, and a fog extinction that hides everything
  past 250 m. M27's fog-on re-run exists for this exact contradiction between atmosphere and
  navigability. Resolution: fog gets *height and direction*, so distant silhouettes read as pale
  shapes rather than vanishing.
- **Flat land with no horizon.** A marsh at uniform elevation has no sightlines at all. Verticality is
  a navigation requirement, not a visual preference — see RI-WLD07's terrain-relief targets.
- **Signposts as decoration.** Modelled posts with unreadable texture text, or posts that name places
  that don't exist, or posts pointing the wrong way. A wrong signpost destroys trust in *every*
  signpost; the world becomes unnavigable at the third one.
- **Prose written after the world.** Directions authored by someone reading coordinates off a spawner,
  producing "head north-east 400 metres". M30's grammar check bans it. Directions must be written by
  someone who walked it.
- **Prose that is atmosphere, not instruction.** "Seek the place where the roots weep." Beautiful,
  unfollowable, and precisely how a Morrowind-nostalgia pastiche fails. M32 puts our entries next to
  Morrowind's, where the actual entries are surprisingly concrete.
- **Directions that assume the road exists.** The journal says "follow the causeway east", the built
  causeway ends 200 m short, and the player is in the water. M29's failure-attribution column (d) is
  there because this is common and invisible in review.
- **Audible landmarks specified and never implemented.** The rock flutes, the Hive's chord, the bell
  buoy and the Deep Marshes' silence are all *navigation instruments* in the prose examples above. If
  the audio ships as one loop, three of our worked examples become unfollowable.

## Provenance note

- `canonical-recall`, confidence medium: Morrowind's markerless design — signposted road junctions on
  Vvardenfell, Red Mountain and the Ghostfence as province-scale orienting landmarks, and dialogue/
  journal directions given in walkable prose ("follow the road east from Seyda Neen…"). Recalled from
  play, not verified this session. The claim that Vvardenfell junction signposts name destinations
  with directions is confidently recalled; that they never carry distances is **not**, and a critic
  should not rely on it.
- `derived-from-map`: the ten landmark coordinates in the province/region tiers, read from icons on
  `black-marsh-map-source.jpg` (see RI-WLD01 §7), ±28 m.
- `constructed` (binding): the three-layer model, the landmark hierarchy and its counts (4 / 18 / ≥90),
  the signpost format table and its per-road-class styles, the prose-direction grammar, the three
  worked direction examples, the ban list, and M27–M32 with all thresholds. The 9-of-10 fresh-agent
  pass mark is chosen so that one genuinely hard route may fail without failing the world; 10/10 is
  the target and 6/10 is the floor.
- The seam ruling S8 (no quest markers) is `doctrine`, quoted from `00-doctrine/ARBITRATION.md` §2 and
  not re-litigated here.
