---
id: RI-WLD03
title: Settlement anatomy — what makes a Morrowind town, and the per-settlement allocation
kind: structure
side: morrowind
judges: [world.settlements, world.interiors, world.architecture, npc.population, npc.services, quest.hubs]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

A Morrowind town is not a set-dressing cluster you pass through — it is a **readable machine**. Balmora
has ~94 NPCs and forty-odd doors that all open; you can enter almost every building you can see; the
Hlaalu canton-style layout, the Camonna Tong bar, the South Wall, the Fighters and Mages guilds and the
Temple all sit in a spatial arrangement that *tells you who actually runs the place* before anyone speaks
to you. Our bar: **≥65% of every building you can see has a working door to a named, hand-furnished
interior**; a capital carries **45 named NPCs, 26 named interiors, 7 shops, 4 guild halls**; and every
settlement's plan encodes its power structure — Blackrose has no square because every street is a
checkpoint; Lilmoth's rich live *below* the waterline in wet Imperial stone while the poor live dry
above them. A settlement that can be summarised as "a well and eight huts" is a failure regardless of
polygon count.

## The reference artifact

### 1. The settlement TEMPLATE (targets by tier)

Machine-readable in `corpus/50-world/settlements.json` under `tier_template`.

| Property | **Capital** | **City** | **Town** | **Village** | **Minor** |
|---|---|---|---|---|---|
| Count in world | 1 | 2 | 3 | 2 | 16 |
| Visible buildings | 40 | 28 | 18 | 10 | 5 |
| **Named interiors** | **26** | **18** | **12** | **7** | **3** |
| **Enterable %** | **≥65** | **≥64** | **≥67** | **≥70** | **≥60** |
| **Named NPCs** | **45** | **30** | **20** | **12** | **5** |
| NPCs on 24 h schedules | ≥75% | ≥72% | ≥70% | ≥70% | ≥60% |
| Shops / service vendors | 7 | 5 | 3 | 2 | 1 |
| Taverns / inns (with rentable bed + rumours) | 3 | 2 | 1 | 1 | 0 |
| Temples / Hist-shrines | 2 | 1 | 1 | 1 | 1 |
| Guild or faction halls | 4 | 3 | 2 | 0 | 0 |
| Skill trainers | 5 | 3 | 2 | 1 | 0 |
| Quest-givers | 9 | 7 | 5 | 3 | 1 |
| Distinct rumour variants (RI-DLG side) | 14 | 11 | 8 | 6 | 3 |
| Bonfire (Hist-shrine) | 1 | 1 | 1 | 1 | 0–1 |
| Road gates / approaches | 4 | 3 | 2 | 2 | 2 |
| Architecture kit | unique | unique | unique | shared + ≥2 unique props | shared |
| Souls-loop dungeon attached | 1 | 1 | 1 | 0 | 0 |

**World totals from the template:** 250 buildings, **160 settlement interiors**, **269 named
settlement NPCs**, 46 shops, 12 taverns, 25 temples/shrines, 16 guild halls, 19 trainers,
**60 quest-givers**, 120 rumour variants, 19 settlement bonfires, 6 attached loop-dungeons.

### 2. The five anatomy rules (each independently checkable)

**R1 — The door rule.** Every building mesh in a settlement is one of exactly three declared kinds:
`interior` (has a door → named cell), `sealed-with-reason` (boarded, collapsed, quarantined, sunk — and
its state is *visible and legible*, and at least one NPC will tell you why), or `structure` (wall, gate,
kiln, vat, aqueduct, dock — not a dwelling). **There is no fourth kind.** "Building that just doesn't
open" is banned.

**R2 — The service rule.** Every shop interior contains: a named merchant with a gold pool and a barter
inventory, ≥1 item that exists nowhere else in the world, and a back room or upper floor the merchant
lives in. A shop that is one room with a counter is half a shop.

**R3 — The faction rule.** Guild/faction halls are placed to encode rivalry. If two rival factions both
hold a settlement, their halls are within 120 m and their doors face each other, or they are at
opposite ends of the settlement's long axis. Never at random.

**R4 — The layout-legibility rule.** Each settlement declares a `power_reading` string and a spatial
proof of it. A fresh judge shown a top-down render with all labels stripped must be able to answer
"who runs this place?" from geometry alone (see M13).

**R5 — The architecture rule.** Each of the 8 named settlements gets a **unique architecture kit**:
≥8 bespoke building meshes, ≥1 silhouette element used nowhere else, and a declared material rule.
No two named settlements may share their primary building mesh set.

### 3. First-pass allocation: the 8 settlements

Coordinates are authoritative and live in RI-WLD01 / `settlements.json`.

| Settlement | Tier | X, Z | Region | Buildings / interiors / NPCs | Architecture rule | Identity — what this town is *about* |
|---|---|---|---|---|---|---|
| **Helstrom** | capital | 2262.5, 2773.5 | The Stone Forest | 40 / 26 / 45 | Nothing quarried. Everything grown, lashed or shell. No right angles anywhere. Streets are root-radial. | **The throne that was never Imperial.** Grown into and around the greatest Hist in Argonia; the "palace" is a hollowed bole and there is no chair in it, only a root you kneel at. Industry: hub of the root-travel network — every road ends here. Tension: Hist-speakers vs. nationalists vs. an Imperial legation everyone tolerates and nobody obeys. **Layout tells you:** every street runs inward to the tree. Whoever runs this town is not a person. |
| **Lilmoth** | city | 2766.5, 5027.5 | Western Rootlands | 28 / 18 / 30 | Two cities stacked: Imperial colonial stone sunk to its first-floor windows, Argonian stilt-slum built on top of the drowned storeys. Wet stone below, dry reed above. | **The great rotting port.** Shipping, smuggling, moon-sugar transhipment, the egg black market. Tension: the city sinks a hand's width a year and the Imperial families will not say so. **Layout tells you:** the rich live LOW in wet stone because status is masonry; the poor live DRY above them. The social order is upside down and visible from the harbour. |
| **Stormhold** | city | 2171.5, 761.0 | The Salt Hills | 28 / 18 / 30 | Imperial cut stone eaten by fungal bloom; grid inside the walls, Argonian sprawl leaning against the OUTSIDE of them. | **The border garrison** — the most "normal"-looking place in Argonia, which makes it the strangest by contrast. Industry: customs, the Legion, and the living memory of Dunmer slave-raids down the passes. Tension: the Legion is under-funded and outnumbered eight to one, and everyone has done the arithmetic. **Layout tells you:** two towns sharing one wall from opposite sides. |
| **Gideon** | town | 439.0, 2913.5 | Blackwood | 18 / 12 / 20 | Cyrodilic: timber frame, tile roofs, a market cross, a square. Right angles. Deliberately. | **The control group.** Timber, grain, road tolls; a proper inn and a chapel. It looks like Cyrodiil and that is the *point* — it is the one place in this game whose screenshot could belong to another game, placed so the other twelve regions can be measured against it. Tension: an Imperial county in all but name, worked by Argonians who are not paid. **Layout tells you:** somebody imported a plan. |
| **Blackrose** | town | 1905.5, 4450.0 | Western Rootlands | 18 / 12 / 20 | Everything is a wall. Imperial fortress masonry furred with fungus — the prison's own stone is being digested. | **A town that exists to feed and guard a prison.** The Imperial-built Blackrose Prison squats over it; the town is its outbuildings. Tension: half the townsfolk are ex-guards, half are inmates' families, and the warden is not who the Empire thinks. **Layout tells you:** there is no square, only corridors between compound walls. Every street is a checkpoint. |
| **Archon** | town | 3785.0, 3823.5 | Crimson Coast | 18 / 12 / 20 | Kiln-fired clay domes, red as a wound, raised by naga hands and bought cheap. | **The dye town.** Crimson tide-lichen harvested, boiled and sold to the Empire as imperial purple; everything and everyone is stained. Tension: the dye is killing the harvesters and the guild denies it in writing, repeatedly. **Layout tells you:** the vats are at the centre and the housing is downwind. Somebody ranked the vats above the people. |
| **Thorn** | village | 3820.0, 859.0 | Thornmarsh | 10 / 7 / 12 | Thatch of black thorn over a rotted Argonian great-hall; the whole village is a thicket you walk into and cannot see out of. | **A kingdom that shrank.** Thorn's "king" is an old Argonian holding court in a rotted hall with eleven subjects and a genuine, legally valid Imperial charter. Industry: thornwood cut for Dunmer bows and Imperial spears. Tension: Morrowind is one day's walk north and remembers what it used to take from here. **Layout tells you:** the hall is central and everything else leans against it. Built for a court that no longer exists. |
| **Soulrest** | village | 610.5, 4877.0 | Stone Wastes | 10 / 7 / 12 | Whale-bone frames and salt-block walls, bleached white. The only settlement in Argonia with no green in it. | **A dying village around a dying Hist.** It was a port; the bay silted; now it mines salt and old bones out of the Wastes. Tension: the villagers are openly debating whether to burn their Hist before it dies on its own — the single most blasphemous conversation in Argonia, and they are having it in the street. **Layout tells you:** every house faces the tree, and the tree is grey. |

### 4. Service coverage matrix (what must exist *somewhere*, and where)

| Service | Helstrom | Lilmoth | Stormhold | Gideon | Blackrose | Archon | Thorn | Soulrest |
|---|---|---|---|---|---|---|---|---|
| General trader | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Smith / repairs | ✔ | ✔ | ✔ | ✔ | ✔ | — | — | ✔ |
| Alchemist | ✔ | ✔ | — | ✔ | — | ✔ | ✔ | — |
| Bookseller / scribe | ✔ | ✔ | ✔ | — | — | — | — | — |
| Pawnbroker / fence | — | ✔ | — | — | ✔ | — | — | ✔ |
| Inn with bed + rumours | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Healer / disease cure | ✔ | ✔ | ✔ | ✔ | — | ✔ | — | — |
| Root-network travel post (in-fiction fast travel, S7) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Boat/tide passage | — | ✔ | — | — | — | ✔ | — | ✔ |
| Trainers (count) | 5 | 3 | 3 | 2 | 2 | 2 | 1 | 1 |
| Bonfire (Hist-shrine) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Attached loop-dungeon | Xanmeer of Ix-Thakla | the drowned storeys | Stormhold Undercroft | Ceyatatar-Zel | **Blackrose Prison** | The Clay Kilns | — | — |

Every settlement has a travel post: S7 forbids map-pin warping but mandates in-fiction transport, and
the root-network is our silt-strider. Costs gold (S15), routes follow the road graph, and two legs
(Lilmoth–Archon tideway, Thorn–Archon) are unavailable at certain tide/weather states.

## Comparison method

**M12 — Anatomy audit (per settlement, all 24).**
1. From world data, enumerate every mesh within the settlement's declared radius. Classify each as
   `interior` / `sealed-with-reason` / `structure` using its declared kind field.
2. Compute enterable % = `interior / (interior + sealed-with-reason)`.
3. Count named interior cells reachable from that settlement, unique-named actors, actors with a
   barter component, actors with a training component, actors flagged quest-giver, bed-rentable inns,
   bonfires, faction halls.
4. Compare to the tier template. **Pass: within −10% of every target. Fail: any single metric below
   −40%, or enterable % below 50.**
5. **Fail immediately if any building is classified `structure` but has residential props inside its
   footprint bounding box** (the "fake house" tell).

**M13 — The blind layout test (R4).** `blind_pair: yes`.
1. Render each settlement top-down, orthographic, 512 px, **all labels, icons and UI stripped**, NPCs
   hidden.
2. Present the 8 renders shuffled to a fresh judge with the prompt: *"For each plan, in one sentence:
   who holds power here, and what does this place make or do?"*
3. Score each against the settlement's declared `power_reading`. **Pass: ≥6 of 8 substantially correct.
   Fail: ≤3.**
4. Also present our 8 alongside 8 unlabeled top-downs of Morrowind settlements (Balmora, Ald'ruhn,
   Sadrith Mora, Vivec, Pelagiad, Maar Gan, Gnisis, Seyda Neen). Ask the judge to sort all 16 by "how
   much this plan tells me about its town", *before* revealing which are ours. **We lose if our median
   rank is in the bottom half.**

**M14 — Architecture uniqueness (R5).** For each named settlement, hash the mesh-id set of its building
kit. **Fail if any two of the 8 share >30% of their building meshes.** Count bespoke meshes per
settlement (**≥8 required**) and confirm ≥1 silhouette element appears in that settlement only.

**M15 — Interior quality spot-check.** Sample 20 named interiors across tiers. For each count:
distinct prop meshes (**≥12**), containers (**≥2**), hand-placed named items (**≥1**), light sources
(**≥2**), readables or dialogue actors (**≥1**), and floor area (**≥18 m²**). **Fail if >4 of 20 miss
two or more criteria** — that is the "empty box behind the door" failure, which is worse than a
locked door because it spends the player's hope.

**M16 — Service reachability.** From each settlement, compute walk-minutes to the nearest instance of
every service in §4. **Pass: every service reachable within 25 walk-minutes from every settlement.**

## Scoring

| Score | Condition |
|---|---|
| 10 | M12 within −5% everywhere; M13 ≥7/8 and our median rank ≥ Morrowind's; M14/M15/M16 clean |
| 8 | M12 pass; M13 ≥6/8; ≤2 flags in M15 |
| 6 | M12 pass on interiors and NPCs, fails on services; M13 4–5/8 |
| 4 | Enterable % 50–64; NPC counts 60–90% of target |
| 2 | Settlements exist with interiors but no services, no schedules, no faction geometry |
| **0 — WE LOSE** | Any of: enterable % <50 in any named settlement; a named settlement with fewer than 5 named interiors; two settlements sharing >30% of building meshes (M14); M13 ≤3/8; a settlement with zero named NPCs |

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band.

## How we lose

- **Five identical huts and a well.** The canonical failure. A "village" that is one mesh instanced ten
  times, no doors, no names, one merchant standing in the open. M12 + M14 catch it.
- **Doors that do nothing.** Buildings modelled with door meshes that never open, because interiors are
  expensive. R1 exists to forbid this; the honest alternative is fewer, better buildings — a 10-building
  village where 7 open beats a 40-building "city" where 6 do.
- **The empty room.** The door opens onto a 4 × 4 box with a bed and a barrel. M15 is specifically
  calibrated against this: 12 distinct props, 2 containers, 1 named item, 1 reason to be there.
- **Copy-paste towns.** Archon and Gideon built from the same kit with a different tint. Nothing tells
  the player where they are, RI-WLD04's blind region test also fails, and the world collapses into one
  place seen eight times.
- **Population without personality.** 30 actors called "Argonian Commoner" with a shared greeting.
  Named-NPC counts must be *named* NPCs; the RI-DLG items will independently check that ≥120 of them
  have non-shared topics.
- **Layout by scatter.** Buildings placed on a noise field so the town has no streets, no centre, no
  approach, and nothing to read. M13 is unpassable if this happens, and M13 is the item that most
  directly measures "Morrowind-ness".
- **Services centralised into the capital** so the other seven towns are scenery. M16 catches the
  reverse (unreachable services); a critic should additionally flag any settlement with <2 services.
- **Blackrose without the prison, Lilmoth without the sinking, Soulrest without the dying Hist.** The
  identity column is not flavour text — it is the acceptance criterion. A settlement that does not
  visibly do its one thing has failed even if every count passes.

## Provenance note

- `community-data`, confidence medium: Balmora's ~94 NPCs and its status as the second-largest
  Vvardenfell settlement; the 2,824 total Vvardenfell NPC count (UESP/forum tallies, retrieved
  2026-08-05). Used to calibrate the capital's 45 named NPCs — deliberately *below* Balmora's 94,
  because our count is of individually authored NPCs and Balmora's includes generic guards and extras.
- `community-data`, confidence medium: the canonical rulers and one-line descriptions of the eight
  Black Marsh cities (Queen Artomeda of Lilmoth, King Claudios of Blackrose, King Germanus in the
  capital Helstrom, Queen Heciana of Soulrest, Queen Aphiana of Stormhold, King Tibus of Thorn, Queen
  Demia of Gideon, King Herula of Archon; Blackrose known for the Imperial-built Blackrose Prison;
  Thorn located in Thornmarsh; Helstrom in the nigh-unexplored interior; Lilmoth a southern port).
  From UESP Lore/Arena pages. These constrain the identities but do not determine them.
- `canonical-recall`, confidence medium: Balmora's layout reading (Hlaalu quarter, South Wall
  Cornerclub, guild placement) and Morrowind's near-universal enterability.
- `constructed` (binding): the entire tier template and every count in it, the five anatomy rules, the
  identity paragraphs, the service matrix, the architecture rules, and M12–M16 with their thresholds.
  The 65% enterability floor is a deliberate concession below Morrowind's near-100%, chosen because a
  browser target cannot carry 250 hand-furnished cells at Morrowind's ratio; it is set high enough that
  the *feeling* survives and low enough that it can actually be built.
