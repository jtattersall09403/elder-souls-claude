---
id: RI-WLD08
title: The living world — schedules, ecology, ambient events, weather and time
kind: number
side: morrowind
judges: [world.npc.schedule, world.ecology.behaviour, world.ambient.events, world.weather.systems, world.time.daynight, world.npc.population, audio.ambience.region]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

"Alive" is the vaguest word in world design and therefore the one most urgently in need of numbers.
A world is alive when **things happen that you did not cause**. Measurably: **≥70% of settlement NPCs
run 24-hour schedules with ≥4 waypoints**, so a shop is shut at night and its owner is in the tavern;
**≥3 creature sightings per minute** of wilderness walking, from an ecology with predators that hunt
prey rather than idle in spawn circles; **≥4 ambient events per 10 minutes** anywhere in the world;
**a per-region weather state machine with ≥4 states** transitioning on a real clock; and a **72-real-
minute day/night cycle** at timescale 20 — slightly longer than the hour it takes to cross the world,
so that a full traverse changes the light. The test is behavioural: park the camera and *don't play*.
If nothing happens in five minutes, the world is a diorama.

## The reference artifact

### 1. Time

| Property | Value |
|---|---|
| Timescale | **20×** (1 real minute = 20 game minutes) |
| Full day/night cycle | **72 real minutes** |
| Daylight / night split | 60% / 40% → ~43 min day, ~29 min night |
| Relationship to traversal | The canonical crossing is 57.6 walk-minutes (RI-WLD01) — **a full crossing always changes the light and usually crosses dusk or dawn.** Deliberate. |
| Dawn / dusk transitions | 6 real minutes each, with distinct fauna and NPC behaviour changes |
| Moons | 2, with independent phases on a 24-day and 8-day cycle; phase drives the tide and 3 quest gates |
| Tide cycle | **12 real minutes** (independent of day), 4 states: low / rising / high / falling |

### 2. NPC schedules

| Metric | Capital | City | Town | Village | Minor |
|---|---|---|---|---|---|
| Named NPCs (RI-WLD03) | 45 | 30 | 20 | 12 | 5 |
| **% with a 24 h schedule** | **≥75** | **≥72** | **≥70** | **≥70** | **≥60** |
| Min waypoints per schedule | 4 | 4 | 4 | 3 | 3 |
| NPCs asleep at 02:00 game time | ≥70% | ≥70% | ≥75% | ≥80% | ≥80% |
| Shops shut at night (doors locked, owner elsewhere) | 100% | 100% | 100% | 100% | 100% |
| NPCs whose schedule changes with weather | ≥25% | ≥25% | ≥30% | ≥30% | ≥40% |
| NPCs whose schedule changes with a world flag (quest, faction, disaster) | ≥6 | ≥4 | ≥3 | ≥2 | ≥1 |

**Schedule vocabulary (a waypoint is one of):** sleep, work (at a named workplace with a matching
animation set), eat, drink at a named tavern, pray at a shrine, patrol a route, market/trade, tend eggs,
gossip at a fixed meeting point, travel to another settlement (yes — some NPCs genuinely walk the
roads; see §4 E7).

**World totals:** 269 named settlement NPCs → **≥190 on schedules**, ≥760 authored waypoints.

### 3. Ecology (the wilderness must run without the player)

| Metric | Target | Fail |
|---|---|---|
| **Creature sightings per minute** (wilderness walk, any creature entering frustum ≥1 s) | **≥3.0** | <1.5 |
| Distinct creature species per region | ≥5 | <3 |
| Species shared between any two regions | ≤40% | >70% |
| Predator/prey pairs implemented (predator hunts prey without player involvement) | **≥6** | <2 |
| Observable predation events per 30 min of wilderness time | **≥2** | 0 |
| Herds/flocks with group movement (not independent wanderers) | ≥8 species | <3 |
| Creatures with diurnal/nocturnal behaviour change | ≥60% of species | <25% |
| Creatures with weather behaviour change (shelter in storms) | ≥40% of species | <10% |
| Non-hostile fauna as a fraction of all creatures | **35–55%** | <15% (everything wants to kill you = a shooting gallery) |
| Corpses persist and are scavenged | yes, ≤4 min to first scavenger in populated regions | corpses vanish or are inert |

**Required predator/prey pairs (≥6):** hackwing → mudcrab hatchling; chitin-hound pack → tusk-lurker;
wamasu → marsh-fish shoal; voriplasm → anything that stops moving; dye-worm → tide-lichen (grazing);
mire-crab → carrion; naga hunting party → guar herd; salt-worm → bone-picker.

### 4. Ambient events

**Target: ≥4 events per 10 minutes** anywhere the player is, ≥2 of which are region-specific.
An ambient event is a scripted or emergent occurrence that (a) is visible or audible at ≥40 m, (b) was
not triggered by the player, and (c) resolves on its own within 90 s.

| # | Event | Where | Freq / 10 min |
|---|---|---|---|
| E1 | A hackwing flock stoops and takes something off the ground | all outdoors | 0.8 |
| E2 | Two named NPCs meet on a schedule and hold a public argument you can walk into | settlements | 0.7 |
| E3 | The tide turns: water audibly moves, stilt-platforms rise or settle, a tideway opens or closes | coasts, Eastern Rootlands | 0.8 (12-min cycle) |
| E4 | A funeral barge passes on a river, poled by mourners who will speak if hailed | Rootlands, Deep Marshes | 0.3 |
| E5 | A slaver or Legion patrol passes on the road, with captives or prisoners | Salt Hills, roads | 0.4 |
| E6 | A preacher, Hist-speaker or Sithis-cultist begins a sermon at a shrine | settlements, shrines | 0.4 |
| E7 | A travelling merchant/pilgrim NPC walks a road leg between two settlements | roads | 0.5 |
| E8 | Weather transition with a visible front (rain line, fog bank, ash veil, salt-storm wall) | all | 0.6 |
| E9 | Lightning fells a tree / a rotted stilt-platform collapses / a kiln vents | region-specific | 0.3 |
| E10 | A predation event (§3) | wilderness | 0.4 |
| E11 | A wild Hist "sings" — a low chord and a visible sap-bloom; nearby Argonians stop and face it | Hist sites | 0.2 |
| E12 | Naga horns answer each other across the Clay Moor | Clay Moor | 0.5 |
| | **Sum (typical outdoor position)** | | **≈4.5** ✔ |

### 5. Weather

Each of the 13 regions declares a state machine with **≥4 states**, transition probabilities on a
**20-real-minute** tick, and mechanical effects. No region shares another's full state set.

| Region | States | Mechanical effect of the worst state |
|---|---|---|
| Western Rootlands | clear / warm rain / dawn mist / heavy rain | mist: sightline 90 m |
| Eastern Rootlands | humid clear / rain / night-bloom / squall | night-bloom: bioluminescence lights the water (a *help*, not a hazard) |
| Blackwood | canopy-dim / downpour / steam / still | downpour: sightline 40 m, tracks wash out (RI-WLD05 #26 disabled) |
| The Hive | **still (only state)** + queen-agitation | agitation: drone aggro radius ×2 |
| Marauder's Coast | clear / sea-fog / squall / gale | sea-fog on a ~6-min cycle: sightline 60 m, bell buoy becomes the only bearing |
| Stone Forest | high clear / dry thunder / overcast / hail | dry thunder: wamasu pair-lightning damage ×1.5 |
| Salt Hills | clear / cold rain / hill-mist / sleet | sleet: stamina regen −20% |
| Valus Ridge | clear / cloud-below / cold rain / rockfall wind | rockfall wind: falling-damage hazards activate |
| Thornmarsh | ash-fall / clear / ash-storm / drizzle | ash-storm: sightline 50 m, cut-marks obscured (navigation degraded) |
| Clay Moor | dry heat / dust-devils / haze / night-cold | dust-devils: knockback, sightline 70 m |
| Crimson Coast | clear / squall / red-haze / storm | red-haze: dye-fume disease buildup |
| Deep Marshes | fever-fog / black-clear / rain / **thick fog** | thick fog: sightline 25 m, voriplasm invisible until 8 m |
| Stone Wastes | white-clear / heat-shimmer / **salt-storm** / night-freeze | salt-storm: sightline 15 m, chip damage 2 HP/s, enemies hidden |

**Weather is never purely cosmetic.** Every region's worst state must change at least one of:
sightline, stamina, damage, disease buildup, enemy behaviour, or navigation.

### 6. Audio (the cheapest half of "alive")

| Metric | Target |
|---|---|
| Distinct ambient beds | ≥13 (one per region) + ≥8 settlement beds + ≥4 interior beds |
| Beds that change with time of day | ≥10 of 13 |
| Beds that change with weather | ≥10 of 13 |
| Positional ambient emitters per km² | ≥25 (kilns, waterfalls, bell buoys, rock flutes, hives, drums, forges) |
| Regions where audio alone identifies the region (RI-WLD04 M20) | ≥9 of 13 |

## Comparison method

**M40 — THE DIORAMA TEST** (the item's primary instrument, and the one a critic should run first).
1. Place the camera at 10 fixed observation points: 4 in settlements, 4 on roads, 2 in wilderness.
2. **Do not move. Do not act.** Observe each for 10 real minutes (100 minutes total; run at fixed
   timestep headless with video capture).
3. Count: ambient events (per §4's three-clause definition), NPCs who changed activity, creatures
   entering/leaving, weather transitions, and light change.
4. **Pass: ≥4 ambient events per 10 min at ≥8 of 10 points, and ≥1 event within the first 150 s at
   ≥8 of 10 points.** **Fail: any observation point with 0 events in 10 minutes** — that is a diorama
   and it must be named in the verdict.

**M41 — Schedule audit.** Fast-forward a full 72-minute day with all NPCs simulated. For each named
NPC log position every game-hour. Compute: % with ≥4 distinct waypoints, % asleep at 02:00, % of shops
with locked doors and absent owners at 01:00, and the number whose route changed under a forced
weather state. Compare to §2. **Fail: <50% scheduled in any named settlement, or any settlement where
shops stay open 24 h.**

**M42 — Ecology probe.** Walk 30 min of wilderness (M6's route, wilderness segments only) logging every
creature entering the frustum, its species, its behaviour state, and any predation events. Then run a
**player-absent** simulation: place an observer 400 m away with LOD forced high, and log predator/prey
interactions for 30 min. **Pass: ≥3.0 sightings/min; ≥2 observed predation events; ≥6 functioning
predator/prey pairs. Fail: creatures only act when the player is within aggro range** — check by
comparing the player-absent log to the player-present one; if the absent log is empty, the ecology is
a spawn system wearing a costume.

**M43 — Weather machine audit.** For each region, force 3 hours of simulated time and log state
transitions. Assert ≥4 states, all reachable, no state with 0 or 1.0 transition probability. Then for
each region's worst state, assert the declared mechanical effect actually fires (measure sightline by
raycast, stamina regen by probe, damage by HP delta). **Fail: any region whose worst weather has no
measurable mechanical effect** — that is fog-as-decoration, the same failure RI-WLD04 punishes.

**M44 — Day/night proof.** Sample the same 6 vantage points at 00:00, 06:00, 12:00, 18:00 game time.
Assert: sun/moon positions differ, ambient colour ΔE > 25 between noon and midnight, ≥3 of 6 points
show different creature species, and ≥4 of 6 show different NPC positions. **Fail: night is noon with
a blue filter.**

**M45 — Audio liveness.** Record 60 s at 12 points, day and night. Assert ≥3 distinct positional
emitters audible at ≥8 of 12 points, and that the day and night recordings differ (spectral distance)
at ≥10 of 12.

**M46 — Blind pair** (`blind_pair: yes`). Take 6 unlabeled 60-second silent video clips of our world
with the camera static, interleaved with 6 static-camera clips from Morrowind. Ask a fresh judge:
*"in which of these does the world seem to be doing something without you?"* Rank all 12, blind, before
the reveal. **We lose if our median rank is below Morrowind's.**

## Scoring

| Score | Condition |
|---|---|
| 10 | M40 ≥5 events/10 min at 10/10 points; M41 ≥80% scheduled; M42 ≥4 sightings/min with a full player-absent ecology; M43/M44/M45 clean; M46 median above Morrowind's |
| 8 | M40 ≥4 events at 8/10 points; M41 at target; M42 at target; M43 all regions pass |
| 6 | M40 3–4 events; M41 55–70% scheduled; M42 2–3 sightings/min |
| 4 | Schedules exist but ecology is spawn-on-approach; weather is cosmetic in >6 regions |
| 2 | NPCs stand still; creatures idle in spawn circles; one weather state per region |
| **0 — WE LOSE** | Any of: any observation point with 0 ambient events in 10 min; <50% NPCs scheduled in any named settlement; player-absent ecology log is empty; ≥6 regions whose weather has no mechanical effect; day/night ΔE ≤25 |

## How we lose

- **The diorama.** NPCs standing at fixed posts forever, creatures idling in a 6 m circle, weather as a
  particle system. Every metric in this file exists to make the diorama impossible to ship unnoticed,
  and M40 is designed so that a critic can detect it in ten minutes without playing.
- **Schedules that are two waypoints.** "Home" and "shop". The NPC oscillates. It looks alive for eight
  seconds and dead thereafter. Four waypoints minimum, with eating, drinking and praying, is the floor.
- **Shops open at 3 a.m.** The single most immersion-destroying convenience, and the one builders add
  under deadline. 100% shop closure at night is non-negotiable, and the compensation is that inns work
  and NPCs are findable in them.
- **Spawn-on-approach ecology.** Creatures that instantiate 60 m ahead and despawn 60 m behind. The
  world is then exactly as alive as the player's view frustum. M42's player-absent probe is the only
  check that catches it, and it must be run.
- **Everything is hostile.** 100% of creatures aggro, so the wilderness is a shooting gallery and there
  is no *ecology*, only encounters. The 35–55% non-hostile band is a deliberate constraint.
- **Weather as a colour grade.** Thirteen fog presets. RI-WLD04 punishes it for region legibility; this
  item punishes it for liveness. Weather must cost or give the player something.
- **Events that only fire near the player.** An "ambient event" that is really a proximity trigger, so
  the world performs for an audience of one and stops when unwatched. Clause (b) of the event
  definition and M42's absent-observer probe both target this.
- **Night deleted.** Making night bright because dark is hard to light. Forty percent of the cycle then
  has no identity, the nocturnal species never appear, and the swamp-jelly bioluminescence — one of our
  thirty strangenesses — never happens.
- **The 72-minute day forgotten.** If timescale ships at Morrowind's 30 or Skyrim's 20-per-hour default
  without checking, the day either flickers or never turns, and the deliberate resonance between the
  hour-long crossing and the 72-minute day is lost.
- **Alive only in the capital.** Helstrom is bustling and the other 23 settlements are car parks. M40's
  ten points span settlements, roads and wilderness precisely so this cannot hide.

## Provenance note

- `canonical-recall`, confidence medium: Morrowind's NPC behaviour is the *weak* half of its liveness —
  Vvardenfell NPCs largely stand at posts and do not run Oblivion-style radiant schedules. This item
  therefore sets a bar **above** Morrowind on schedules (drawing on the later Bethesda titles' Radiant
  AI) while keeping Morrowind authoritative on everything else in the world domain per the Arbitration
  Rule. This is a deliberate, declared deviation, not an error, and a critic should not "correct" it by
  citing Morrowind's static NPCs.
- `community-data`, confidence medium: 2,824 NPCs on Vvardenfell and 94 in Balmora (retrieved
  2026-08-05), used to sanity-check that 269 named scheduled NPCs is a defensible density for a
  14.5 km² world with hand-authored actors.
- `canonical-recall`, confidence low-medium: Morrowind's timescale (~30 by default, giving ~48 real
  minutes per game day). Our 20× / 72-minute figure is `constructed` and chosen for its relationship to
  the 57.6-minute crossing, not copied.
- `constructed` (binding): every number in §1–§6 — the schedule percentages and waypoint minima, the
  ecology targets and the eight predator/prey pairs, the twelve ambient events and their frequencies,
  the thirteen weather state machines and their mechanical effects, the audio targets, and M40–M46 with
  all thresholds. The ≈4.5 events/10 min figure in §4 is derived arithmetic from the listed
  frequencies and is included so a critic can verify the target is met by design rather than by hope.
