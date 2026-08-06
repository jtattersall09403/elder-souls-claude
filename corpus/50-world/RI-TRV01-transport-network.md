---
id: RI-TRV01
title: The transport network — modes, route graph, fares, stations and the walked-it-once rule
kind: graph
side: morrowind
judges: [world.traversal.transport, world.traversal.roads, world.traversal.time, world.settlement.anatomy, world.wayfinding.directions, world.time.daynight, progression.gold.economy]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Morrowind has fast travel. It has four kinds of it, and every one of them is a *place in the world
staffed by a person who wants money*: the silt strider on its platform outside the gate, the boat at the
dock, the Mages Guild guide in the guild hall, and the Mark/Recall pair in your spellbook. You walk to
the strider. You pay the caravaner. You go where the caravaner goes — the next town on her line, not
your quest objective — and you arrive on her platform, outside the walls, at whatever hour the ride
takes. **This is the system S7 mandates, and no reference item in this corpus has owned it until now**
(intent audit ID-02, `INTENT-AUDIT-01.md:174`). Worse, every existing travel-adjacent check in the
corpus tests only for the *absence* of warping — `RI-PRG04:255` awards its top score for "no warp code
path exists" (ID-09) — so **a build with no transport system whatsoever passes every check we currently
ship.** That asymmetry is the drift this item exists to correct.

The bar, therefore, is two-sided and every measurement below is written as a *pair*: **a check that
fails when the network is missing, and the same check failing when the network degenerates into
warp-to-map-pin.** Concretely: this world contains **68 purchasable services on 17 lines across 5
modes, over 26 stations**, water-first as a marsh should be (**7 of the 10 trunk legs and 7 of the 8
settlements are reachable by boat**); a fare tariff that reproduces `RI-PRG05`'s three published
transport prices exactly; a rule that **no ticket may span more than one line**, so a cross-map journey
is three purchases and three rides through three interchanges rather than one menu selection; and a
precondition that **you cannot buy passage anywhere you have not already walked**. Get it right and the
map is a thing you learn and then command. Get it wrong in the first direction and Black Marsh is a
14.5 km² walking simulator with no way to run an errand. Get it wrong in the second and it is a menu
with a gold cost, which is Skyrim, which is AR-2, which is an automatic fail.

## The reference artifact

Machine-readable: **`corpus/50-world/travel-network.json`** (schema `elder-souls/travel-network@1`).
Every number in the tables below is generated from it; it is generated in turn from
`world-scale.json` + `settlements.json`, so the network can never drift from the map.

### 1. The five modes

| # | Mode | Operator (RI-LOR02 §4) | Medium | Availability | Blocked by |
|---|---|---|---|---|---|
| **M1** | **The poled barge** — *primary* | The Wet Ledger (Gideon, Blackwood, the south); independent lukiul polers elsewhere | river and channel | departs **06:00 / 10:00 / 14:00 / 18:00** game clock | storm weather suspends the line for one game day |
| **M2** | **The coastal packet** | independent captains out of Lilmoth harbour | open coast | departs **07:00 / 15:00** | storm weather |
| **M3** | **The Rootway** — the silt-strider analogue | root-post keepers (Hist-tenders) | Hist root-tunnel, following the road graph exactly | on demand | **night: the roots close 20:00–05:00**; plot severance of a named root leg |
| **M4** | **The tide-poler** | any villager with a punt | shallow channel | hailed on demand | tide **high or rising**; **disposition < 30 → refusal** |
| **M5** | **Root-speaking** — the guild-guide analogue | Xul-Aneekh Hist-speakers | the deep root | on demand | **Xul-Aneekh rank ≥ 3** (≥ 5 for the Wayshrine); Rootward Tide crisis stage ≥ 3; joining the Wet Ledger revokes it |

M1 is canon-anchored: **CF-C012** — *"Travel is by poled barge along Hist-advised routes: a poler asks
the tree each morning which way the water moved in the night. Purchasable with gold, schedule-bound,
refusable, severable as a plot event. Sapwells never teleport."* M3 is the corpus's existing commitment
(`RI-WLD03:105–113`, "the root-network is our silt-strider", a post in all eight settlements;
`RI-WLD05` #22).

Each mode is broken by a *different* thing. That is the design: there is no single failure that strands
you, and there is no single mode that trivialises the map. The Rootway always runs but not at night; the
barge runs at night but only four times a day and not in a storm; the poler goes anywhere shallow but
only at low tide and only if he likes you; the packet is fast and dear and cancelled by weather; and
root-speaking is nearly instant, which is exactly why it costs a faction, a rank, 25% Fatigue, and is
capped at five destinations forever.

### 2. The route graph — lines and stations

Stations resolve **by name** through `settlements.json` / `world-scale.json`; coordinates are not
restated here (those files stay authoritative, `RI-WLD01` §3). Bold = named settlement (interchange);
plain = minor halt.

**The Rootway — 10 lines, 26 hops, every trunk road leg.**

| Line | Road leg (class) | Stations, in order | Hops | Line ticket | Ride | Walk |
|---|---|---|---|---:|---:|---:|
| RW‑STO‑THO | Stormhold–Thorn (causeway) | **Stormhold** · Ixtaxh‑Tzil · **Thorn** | 2 | 30 g | 107 gm | 18.6 min |
| RW‑STO‑HEL | Stormhold–Helstrom (river road) | **Stormhold** · Nine‑Mud · The Weeping Ford · **Helstrom** | 3 | 37 g | 142 gm | 24.3 min |
| RW‑HEL‑ARC | Helstrom–Archon (stone road) | **Helstrom** · Xal‑Ithix · Kiln Camp · **Archon** | 3 | 34 g | 126 gm | 21.6 min |
| RW‑HEL‑BLA | Helstrom–Blackrose (marsh trail) | **Helstrom** · Sunken Barrow · Mudwater Landing · **Blackrose** | 3 | 32 g | 121 gm | 20.7 min |
| RW‑HEL‑GID | Helstrom–Gideon (Imperial road) | **Helstrom** · Rootway Post · Tenmarch Bridge · **Gideon** | 3 | 29 g | 115 gm | 19.8 min |
| RW‑GID‑SOU | Gideon–Soulrest (coast road) | **Gideon** · Hollow‑Reeds · Bone Ladder · **Soulrest** | 3 | 31 g | 122 gm | 21.4 min |
| RW‑SOU‑BLA | Soulrest–Blackrose (rootland track) | **Soulrest** · Salt‑Egg Camp · **Blackrose** | 2 | 23 g | 88 gm | 15.3 min |
| RW‑BLA‑LIL | Blackrose–Lilmoth (stilt causeway) | **Blackrose** · Stilt‑Row · **Lilmoth** | 2 | 18 g | 73 gm | 12.5 min |
| RW‑ARC‑THO | Archon–Thorn (Clay Moor track) | **Archon** · Clayfast · The Red Wells · **Thorn** | 3 | 66 g | 206 gm | 35.8 min |
| RW‑LIL‑ARC | Lilmoth–Archon (tideway) | **Lilmoth** · Tideway Shrine · **Archon** | 2 | 36 g | 121 gm | 21.0 min |

**The barge — 7 lines, 17 hops. Water is the primary mode.**

| Line | Water | Stations, in order | Hops | Line ticket | Ride | Walk |
|---|---|---|---|---:|---:|---:|
| BG‑STO‑HEL | the Salt‑Race, upstream to the border | **Stormhold** · Nine‑Mud · The Weeping Ford · **Helstrom** | 3 | 34 g | 243 gm | 24.3 min |
| BG‑HEL‑GID | the Tenmarch | **Helstrom** · Tenmarch Bridge · **Gideon** | 2 | 32 g | 194 gm | 19.8 min |
| BG‑HEL‑BLA | the Rootway Channels | **Helstrom** · Sunken Barrow · Mudwater Landing · **Blackrose** | 3 | 29 g | 208 gm | 20.7 min |
| BG‑GID‑SOU | the Blackwood shore | **Gideon** · Hollow‑Reeds · Bone Ladder · **Soulrest** | 3 | 28 g | 210 gm | 21.4 min |
| BG‑SOU‑BLA | the rootland cuts | **Soulrest** · Salt‑Egg Camp · **Blackrose** | 2 | 21 g | 151 gm | 15.3 min |
| BG‑BLA‑LIL | under the stilts | **Blackrose** · Stilt‑Row · **Lilmoth** | 2 | 16 g | 125 gm | 12.5 min |
| BG‑LIL‑ARC | **the tideway, at HIGH tide only** | **Lilmoth** · Tideway Shrine · **Archon** | 2 | 34 g | 207 gm | 21.0 min |

> **The tideway inversion.** `RI-WLD01`'s Lilmoth–Archon leg is *walkable only at low tide*. The barge
> line over the same water runs *only at high or rising tide*. The one route in the province that is
> always available is available two different ways, never both at once, and the tide-pole at the fork
> (`RI-WLD06:57`) is the sign that tells you which. Rootway Post is a root-halt with no landing, which
> is why BG‑HEL‑GID has two hops where RW‑HEL‑GID has three: **not every halt serves every mode.**

**The coastal packet — 3 services.**

| From | To | Sea route | Fare | Ride | Replaces |
|---|---|---:|---:|---:|---|
| Lilmoth | Soulrest | 2,485 m across the mouth of the bay; Soulrest is lightered ashore because its bay silted | 58 g | 138 gm | 27.9 min walk via two lines |
| Lilmoth | Archon | 2,366 m round the point, outside the tideway | 55 g | 131 gm | 21.0 min walk, tide-gated |
| Archon | **Bloodmarl Isle** | 1,507 m | 30 g | 84 gm | *nothing.* There is no walk. |

Bloodmarl Isle is the network's one node with no land approach. Its walked-it-once precondition is
satisfiable **only by swimming 1,257 m of open water at 1.1 m/s — about 19 minutes** with everything
that lives out there. That is deliberate: it is the proof that the precondition is a real precondition
and not a formality, and it is the single best demonstration in the game that the network extends only
as far as your own legs already went.

**Root-speaking — 5 services, a star centred on Helstrom, and it will never be six.**

| From | To | Rank | Fare | Ride | Replaces | Side cost |
|---|---|---:|---:|---:|---:|---|
| Helstrom | Soulrest | 3 | 38 g | 20 gm | 36.0 min walk | Fatigue −25%, 2 game-hours |
| Helstrom | Lilmoth | 3 | 36 g | 20 gm | 33.2 min walk | ″ |
| Helstrom | Ixtaxh‑Tzil | 3 | 36 g | 20 gm | 33.7 min walk | ″ |
| Helstrom | Xal‑Ithix | 3 | 10 g | 20 gm | 10.3 min walk | ″ |
| Helstrom | Wayshrine of the Ninth Root | **5** | 14 g | 20 gm | 12.4 min walk | ″ |

Helstrom is "the hub of the root-network, so every road and every travel route ends here"
(`settlements.json`). Root-speaking is what that sentence *means* mechanically. The Fatigue cost is not
decoration: Fatigue drives disposition and persuasion (S4, `RI-PRG05` §3 barter), so **arriving by deep
root makes you worse at talking for two game-hours.** You pay for speed in the currency of the
conversation you came to have.

### 3. The graph, measured

| Property | Public network | Including faction-gated (M5) | Bar |
|---|---:|---:|---|
| Settlement–settlement edges | **11** | 13 | ≥ 9 and ≤ 15 |
| Graph density (of 28 possible) | **0.393** | 0.464 | **∈ [0.25, 0.55]** |
| Connected | ✔ | ✔ | must be true |
| **Bridges** (edges whose loss strands a settlement) | **none** | none | must be zero |
| Minimum settlement degree | **2** | 2 | ≥ 2 |
| Degrees | Sto 2 · Tho 2 · Gid 2 · Hel 4 · Arc 3 · Bla 3 · Sou 3 · Lil 3 | Hel 6, Sou 4, Lil 4 | — |
| Mean network legs between settlement pairs | **1.79** | 1.64 | **≥ 1.5** |
| Settlement pairs needing ≥ 3 legs | **5** | 3 | ≥ 3 |
| Modes serving each settlement | 3–5, except **Thorn: 1** | | ≥ 1, and ≥ 6 of 8 with ≥ 3 |
| Adjacent-station walking spacing | max **12.8 min**, mean **8.2**, min **4.0**, n = 26 | | max ≤ **13.0 min** |
| Stations / total named POIs | 26 / ~124 = **21%** | | **∈ [0.12, 0.30]** |

**Density is a two-sided bar and it is the single most important number in this item.** Below 0.25 the
network is a chain and settlements are effectively stranded. Above 0.55 you can get from anywhere to
anywhere in one purchase and the network has become a map-pin menu that charges admission. 0.393 means
**the shape of the province is still information**: Helstrom is the hub because four roads meet there,
Thorn is remote because two do, and a player who wants to get from Thorn to Soulrest is going to learn
why nobody does that.

**No settlement is stranded, and no single edge strands one.** There are zero bridges: the public graph
is 2-edge-connected. Sever the Rootway's Helstrom–Gideon leg as a plot event and Gideon is still reached
via Soulrest.

**Thorn is served by exactly one mode**, and this is declared, not accidental: Thornmarsh is a needle-
forest on high ground with no navigable water, so the Rootway is all it has. When the roots close at
20:00, Thorn is a walk. That is the province telling you something true about Thorn.

### 4. The tariff

Fares are **posted**, never bartered. `RI-PRG05` publishes three transport prices; this tariff is the
continuous function that passes through all three, so nothing in the economy moves:

```
tariff(m) =  12.0 · m/1000                       for m ≤ 1000     # 1,000 m → 12 g  "short hop within region"
          =  12.0 + 33.0·(m−1000)/1500           for m ≤ 2500     # 2,500 m → 45 g  "regional crossing"
          =  45.0 + 45.0·(m−2500)/4400           otherwise        # 6,900 m → 90 g  "cross-map"
          , floored at 6 g

fare = max(4, round( tariff(route_m) × mode_mult × faction_mult ))

mode_mult   : barge 0.80 · poler 1.00 · rootway 1.00 · packet 1.30 · rootspeak 0.60 (members only)
faction_mult: Wet Ledger member          ×0.60 on barge and packet only
              Ninth Cohort transit warrant ×0.00 on rootway and barge, and only between
                                            Stormhold, Gideon and Blackrose
```

**Barter does not apply.** Disposition and Mercantile do not move a fare by one gold. What disposition
buys is **access**: below 30, a poler or barge-master refuses the fare outright (CF-C012, *"refusable"*).
The social lever on travel is whether the boat leaves with you on it, not what it costs. This also keeps
`RI-PRG05`'s flip invariant untouched — a fare cannot be resold.

**The no-through-ticket rule.** There is no ticket to anywhere that is not on the line you are boarding.
A line ticket costs **exactly the sum of its hop fares** (verified: 17/17 lines, zero arbitrage in either
direction) and carries you through the intermediate halts as *stops*, not transfers. To leave the line
you alight at an interchange settlement, walk to the other operator's station, and buy again.

> **Stormhold → Lilmoth, the canonical crossing.** On foot: 6,909 m, **57.6 real minutes**, 1,152 game-
> minutes. By network: RW‑STO‑HEL (37 g) → *walk across Helstrom to the Blackrose post* → RW‑HEL‑BLA
> (32 g) → *walk across Blackrose* → RW‑BLA‑LIL (18 g). **87 gold, three purchases, three rides, two
> interchanges, 336 game-minutes.** `RI-PRG05` prices a cross-map journey at 90 g; the tariff lands on
> 87. You have not skipped the province. You have *commuted* across it, and you passed through two
> towns on the way, which is where the rumours are.

| Fare summary | Value |
|---|---:|
| Mean fare over the whole 68-service catalogue | **15.3 g** |
| Mean settlement-to-settlement service fare | **46.8 g** |
| Cheapest service (barge, Mudwater Landing → Blackrose) | **5 g** |
| Dearest service (packet, Lilmoth → Soulrest) | **58 g** |
| Cheapest full line ticket (BG‑BLA‑LIL) | **16 g** |
| Dearest full line ticket (RW‑ARC‑THO) | **66 g** |
| **Modelled lifetime fare spend** | **2,000 – 3,200 g** |

**Mean fare as a fraction of early-game income.** `RI-PRG05` gives region R1 an income of 3,500 g and a
disposable margin of **580 g**. A mean line ticket of ~29 g is **0.83% of R1 income and 5.0% of the R1
margin** — and it is exactly two-thirds of a light-weapon repair (45 g). In R1 a barge fare is a real
decision made against a real alternative. By R6 (margin 12,900 g) the same ticket is 0.22% of the margin
and the player stops counting. That curve *is* the intended arc: travel is a sacrifice for two hours and
a convenience for eighteen.

### 5. Time: two clocks, and both of them must move

| Mode | Vehicle speed | Ride game-time ÷ walk game-time | Real walk minutes typically replaced |
|---|---:|---:|---:|
| Rootway | 7.0 m/s | **0.286** | 8.2 |
| Packet | 6.0 m/s | 0.248 – 0.312 (mean **0.279**) | 21.4 |
| Barge | 4.5 m/s | **0.488** | 8.1 |
| Poler | 3.0 m/s | **0.727** | 8.1 |
| Root-speaking | fixed 20 game-min | 0.028 – 0.097 (mean **0.053**) | 25.1 |

`game_minutes = (route_m / vehicle_speed) / 60 × timescale(20)`, per `RI-WLD01` (walk 2.0 m/s,
timescale 20×, day = 72 real minutes).

- **In-world time always advances**, by a lot. A barge from Stormhold to Helstrom is **243 game-minutes
  — four game-hours**. You board in the morning and arrive in the afternoon; the NPC schedules
  (`RI-WLD08`) moved, the tide turned twice, and the shop you wanted is shut.
- **Real player time is 18–45 seconds per ride**, of which **at least 8 simulated seconds at each end
  must be rendered vehicle motion through the actual world** along the declared route polyline. The
  middle may be elided *only* by an explicit player action ("settle in"), which still advances the clock
  in full. A ride that is a black screen at both ends is a warp wearing a boat costume, and check **M6**
  exists to catch precisely that.
- The poler at 0.727 barely beats walking on the game clock and that is correct — you do not hire a punt
  to save the afternoon, you hire it because the channel is 3 m deep and you are carrying 40 kg.

### 6. Where the stations physically sit

Binding siting rules; `RI-WLD03`'s service table is the per-settlement inventory this refines.

| Station kind | Placement rule | Present at |
|---|---|---|
| **Root-post** | At the settlement's outermost road gate, **outside** the wall or perimeter. Never on the market square. **≥ 60 m from the nearest HEARTH shrine.** A hollow bole with a keeper, a fare-board, and a queue. | all 8 settlements |
| **Root-halt** | A carved post beside the road, no building, no keeper. Boarding only; you may buy passage to the next station on the line and nowhere beyond it. | all 16 minor settlements |
| **Barge quay** | On the waterline at the settlement's **lowest elevation point**, reached by steps; a tide-pole and a chalked departure board. | Stormhold, Helstrom, Gideon, Blackrose, Soulrest, Lilmoth, Archon |
| **Packet wharf** | Deep-water frontage; at Soulrest, a lighter-jetty offshore because the bay silted. | Lilmoth, Archon, Soulrest |
| **Rootward chamber** | **Interior**, inside a named interior cell, behind a Xul-Aneekh door. Never inside a dungeon volume, never behind a lock the player must pick. | Helstrom only (the departure end) |

**Arrival rule, absolute.** Every service deposits the player **standing at the destination station's
`arrive_at` marker, on foot, facing outward, with the vehicle behind them.** Never inside an interior,
never inside a dungeon or boss-arena volume, never behind a locked door, and never within 25 m of a live
quest objective. There is no service in the catalogue whose destination is anything other than a station.

### 7. The walked-it-once rule

> You may not buy passage to a place you have not already been to under your own power.

CF-089: *"The interior of Black Marsh is functionally impassable to outsiders — navigation by knowledge
no foreigner has."* CF-C012: the poler *asks* where you are going. In dialogue this is literal — the
destination topic does not appear in the travel-post topic list until you can name the place.

Formally, per directed leg `L = (A → B)` of a line:

1. `legs_walked[L]` is set when the player has, in **one continuous traversal without using any network
   service on that leg**, been within 30 m of station A, within 30 m of station B, and covered ≥ 85% of
   L's route polyline nodes. Swimming, wading, jogging and sprinting all count; being carried does not.
2. A **hop** service `A→B` is purchasable iff `legs_walked[(A→B)] ∨ legs_walked[(B→A)]`.
3. A **line ticket** `A→Z` is purchasable iff *every* hop between A and Z is walked.
4. **Root-speaking** additionally requires Xul-Aneekh rank ≥ 3 (≥ 5 for the Wayshrine); it does not
   waive rule 1.
5. Nothing else unlocks a route. Not a rumour, not a map, not a quest stage, not resting at a HEARTH.

At frame 0 of a new game the entire network is inert: 26 stations, 68 services, **zero of them
purchasable**. The first thing the network can ever sell you is the way back.

### 8. Where this crosses the seam (AR-3)

Not sterile. Five boundary-crossing interactions, each of which changes what a *fight* or a
*conversation* looks like:

1. **Faction membership changes the topology.** Joining the Xul-Aneekh opens 5 root-speak services and
   closes the Wet Ledger's ×0.60 water discount; joining the Wet Ledger does the reverse and revokes
   root-speaking outright. Two players have different maps.
2. **Disposition is the boarding gate.** Below 30, the poler refuses. A player who burned a village's
   goodwill walks out of it.
3. **The main quest degrades the network.** At Rootward Tide crisis stage ≥ 3, root-speaking stops
   working and named Rootway legs sever — the metaphysical plot is felt first as a cancelled service.
4. **Arriving by deep root costs you the conversation.** −25% Fatigue for two game-hours feeds S4, which
   feeds disposition, which feeds `RI-PRG05`'s barter and every persuasion check.
5. **Time-of-day gating is a combat decision.** The roots close at 20:00. Missing the last Rootway means
   walking a marsh trail at night, which is a different encounter roster (`RI-WLD08`).

## Comparison method

Every check below is stated as an explicit **pair**. `N-fail` fires when the network is missing, inert or
stubbed. `W-fail` fires when it has degenerated toward warp-to-map-pin. **A check that can only fire in
one direction is not admissible in this item** — that one-directional shape is the drift (ID-02/ID-09)
this item corrects, and a critic reproducing it has failed its own job.

Data root: `game/data/world/travel/` — `stations.json`, `lines.json`, `services.json`, `tariff.json`.
Static checks need no browser. Live checks use `tools/harness/run-headless.mjs` with the scenarios named
below and read `elder-souls/trace@1`.

---

**M0 — Regenerate the reference artifact.** Re-derive `travel-network.json` from `world-scale.json` +
`settlements.json` with the generator described in §Provenance, and diff. Any difference means the map
moved or this item is stale; resolve in favour of `world-scale.json` (`RI-WLD01` §3 is authoritative) and
amend this item.

**M1 — Existence and shape (static).** Load `game/data/world/travel/*.json`.
Compute: mode count, station count, service count, line count.
- **N-fail:** modes < 5, **or** stations < 24, **or** services < 45, **or** the directory is absent.
  Absent ⇒ score **0**, fail-closed — "unmeasurable" is not "unknown" (`HARNESS.md` §5).
- **W-fail:** any service whose `from` or `to` does not resolve to an id in `stations.json` — i.e. a
  service to a bare coordinate, a POI, a quest marker or a region centroid. **Any single occurrence is a
  hard fail**: that is warp-to-map-pin with a fare attached.

**M2 — Graph metrics (static).** Build the settlement graph from shipped services. Compute connectivity,
bridges, degree, density, mean legs, pairs needing ≥3 legs.
- **N-fail:** not connected, **or** any bridge exists, **or** min degree < 2, **or** density < 0.25,
  **or** any settlement served by 0 modes.
- **W-fail:** density > 0.55, **or** mean legs between settlement pairs < 1.5, **or** fewer than 3 pairs
  requiring ≥ 3 legs, **or** the graph is complete on any subset of ≥ 6 settlements. A network you can
  cross in one leg from anywhere is a menu.

**M3 — Water primacy (static).** Compute the fraction of trunk road legs with a parallel water service
and the fraction of settlements with a quay.
- **N-fail:** water legs / 10 < 0.5, **or** settlements with a quay < 6, **or** barge services < 12.
  A marsh whose transport is all overland has misread the province.
- **W-fail:** water legs / 10 = 1.0 **and** overland services < 10 — i.e. boats reach literally
  everywhere and the Rootway is vestigial. Reference: 7/10 legs, 7/8 settlements, 17 barge services.

**M4 — The walked-it-once gate (live).** Scenario `trv-walked-gate`, fresh save, seed fixed.
1. At frame 0, open every travel-post topic list reachable in the start settlement and attempt to
   purchase each of the 68 services via the harness.
   - **Assert 0 purchasable, 68 refusals**, and assert `getTravelState().legs_walked == []`.
   - **W-fail:** *any* service purchasable at frame 0. Hard fail.
2. Walk one full leg (scripted input, ~2,200 m, no network use). Re-open the topic list.
   - **Assert exactly the hops of that leg, and no others, became purchasable** (expected: 2 or 3).
   - **N-fail:** still 0 purchasable after walking ⇒ the gate is a wall and the network is inert. Hard
     fail, and it is the *more likely* of the two errors because a builder who implements only the
     refusal path ships a network that never opens.
3. Walk 85% of a leg and stop. **Assert still not purchasable.** Then walk the remaining 15%.
   **Assert now purchasable.** This proves the threshold is a real traversal test and not a
   "visited settlement B" flag, which would let a Recall or a quest teleport unlock a route.

**M5 — Arrival geometry (live).** Scenario `trv-arrival-geometry`. Pre-unlock all legs via
`loadState('trv-all-walked')`. Ride **all 68 services**, one per run segment. For each arrival capture
`player.pos`, `player.volume_tags`, and the live quest objective set.
- **Assert** arrival within **8 m** of the destination station's `arrive_at` marker.
- **Assert** `player.volume_tags` contains no `interior`, `dungeon`, `boss_arena`, or `locked`.
- **Assert** distance to the nearest live quest objective **> 25 m**.
- **N-fail:** fewer than 68 rides completed, or any ride throws.
- **W-fail:** **any single arrival** within 25 m of a quest objective, or inside a dungeon/interior/
  locked volume, or > 8 m from the marker. Hard fail. This is the check the brief calls out by name:
  *no route drops you at a quest objective.*

**M6 — The ride is a journey, not a cut (live).** Scenario `trv-ride-fidelity`. Trace one ride per mode
(5 rides) at 60 Hz with `traceStart`.
- **Assert** ≥ 480 consecutive frames (8 s) of continuous player motion at each end of the ride, with
  every sampled `player.pos` within **40 m** of the declared route polyline.
- **Assert** no single-frame position delta > **25 m** anywhere in the ride except across an explicit
  `travel_skip` event the player requested.
- **Assert** `gold` decreases by the tariff amount and the game clock advances by the declared
  `game_min`, on every ride.
- **N-fail:** no ride can be traced; or gold does not decrease; or the clock does not advance. **A ride
  that is free and instantaneous is not a ride.**
- **W-fail:** a single-frame teleport of the player from station to station with no rendered traversal —
  i.e. the mode is a fade-to-black warp with a boat sprite in front of it. Hard fail.

**M7 — Tariff conformance (static + live).** Evaluate `tariff(m)` at 1,000 / 2,500 / 6,900 m.
- **Assert** 12 / 45 / 90 g **exactly** (±1 g), reproducing `RI-PRG05` §2.
- **Assert** the function is monotonic and continuous over 0–10,000 m (sample at 50 m).
- **Assert** every line ticket **equals** the sum of its hop fares (reference: 17/17, zero deviation).
- **Assert** no service is purchasable that spans more than one line.
- **Assert** barter multipliers are *not* applied: buy the same fare as the Shell-Warden and as the Fence
  (`RI-PRG05` §3) and **assert identical gold**. Then set disposition to 25 and **assert the poler
  refuses**.
- **N-fail:** fares absent, or all fares 0, or lifetime modelled fare spend < 800 g.
- **W-fail:** any multi-line ticket exists; **or** a through-fare cheaper than its hop sum by > 5% (a
  volume discount on distance is the first step toward "one ticket, anywhere"); **or** total modelled
  fare spend > 8,000 g, which would make travel a tax rather than a choice.

**M8 — Time ratios (live).** For every service, compute `game_min_ride / game_min_walk`.
- **Assert** per-mode means within ±0.05 of: rootway 0.286, barge 0.488, packet 0.279, poler 0.727.
- **Assert** every non-magical mode ∈ **[0.20, 0.80]**.
- **Assert** root-speaking ∈ **[0.02, 0.10]** *and* that it has exactly 5 services, all rank-gated.
- **N-fail:** any mode ratio > 0.95 — the network is no faster than walking, so nobody uses it and it
  might as well not exist. **W-fail:** any non-magical mode ratio < 0.10, or root-speaking services > 5,
  or root-speaking reachable without a rank check. Instant is warp.

**M9 — Station siting (static + live).** For each of the 26 stations: distance to nearest HEARTH,
containment in wall/perimeter volume, containment in dungeon volume, market-square proximity.
- **Assert** every station **≥ 60 m from the nearest HEARTH** (S7: HEARTHs are not travel nodes).
- **Assert** zero stations inside a dungeon or boss-arena volume, or behind a lock.
- **Assert** every root-post is outside its settlement's perimeter volume.
- **Assert** the HEARTH interaction menu exposes **zero** destinations (this is `RI-PRG04` method 2,
  retained).
- **N-fail:** fewer than 8 root-posts, or fewer than 7 quays, or any settlement with no station.
- **W-fail:** any HEARTH with a destination list, **or** any station within 60 m of a HEARTH — because
  the moment the checkpoint and the travel node are the same object, resting *is* travelling and S7 is
  gone. Hard fail either way.

**M10 — Availability is real (live).** Scenario `trv-availability`, using `setTimeOfDay` and
`setWeather`.
- At 22:00 **assert** every Rootway service refuses ("the roots are shut"); at 12:00 **assert** they run.
- At high tide **assert** the Lilmoth–Archon *walk* is blocked and the *barge* runs; at low tide assert
  the inverse.
- Under `setWeather('storm')` **assert** barge and packet refuse and the Rootway still runs.
- Set Xul-Aneekh rank 2 → **assert** root-speaking refuses; rank 3 → **assert** it runs; then join the
  Wet Ledger → **assert** it refuses again.
- **N-fail:** any gate has no effect — every mode available always, at any hour, in any weather. That is
  a menu, not a network, and it is the *lazy* implementation.
- **W-fail:** likewise a menu — the same assertion. **This check fails identically in both directions,
  which is the point: an always-available network and an absent one are the same defect wearing
  different clothes.**

**M11 — Severance (live).** Set the plot flag that severs RW‑HEL‑GID.
- **Assert** the service disappears from the topic list and from `getTravelState()`.
- **Assert** the keeper's dialogue changes and names the alternative.
- **Assert** Helstrom→Gideon is still reachable (via Soulrest) and the graph still has no bridges.
- **N-fail:** severance changes nothing ⇒ the network is a static price list, not a system.
- **W-fail:** severance changes nothing *and* the pair remains one-leg reachable ⇒ there is a hidden
  any-to-any path.

**M12 — Reach is a subset of the world (static).** Count stations against all named POIs
(settlements + loop dungeons + caves + landmarks).
- **Assert** stations / POIs ∈ **[0.12, 0.30]** (reference 26/124 = 0.21).
- **N-fail:** < 0.12 — the network does not go anywhere worth going.
- **W-fail:** > 0.30, and hard fail at > 0.60 — if most of the world is a station, the world is a map
  screen. **Assert specifically that zero caves and zero loop-dungeons are stations.**

## Scoring

Native scale: **12 checks, each scored 2 / 1 / 0** (both directions pass / one marginal / either
direction fails). Maximum **24**.

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| **M1 Existence** | 5 modes, ≥ 60 services, ≥ 26 stations | 4 modes, ≥ 45 services | no travel data ⇒ **0, fail-closed** · or any service to a non-station ⇒ **hard fail** |
| **M2 Graph** | density 0.35–0.45, no bridges, mean legs ≥ 1.75 | density 0.25–0.55, connected, no bridges | disconnected or bridged · or density > 0.55 |
| **M3 Water primacy** | ≥ 7/10 legs, ≥ 7/8 settlements by water | ≥ 5/10 legs, ≥ 6 quays | < 5 water legs · or overland vestigial |
| **M4 Walked-once gate** | all three sub-assertions pass, threshold is a traversal test | 1 and 2 pass | anything purchasable at frame 0 ⇒ **hard fail** · nothing purchasable after walking ⇒ **hard fail** |
| **M5 Arrival geometry** | 68/68 within 8 m, no objective within 25 m | 68/68 within 15 m, no objective within 25 m | **any** arrival at an objective / in a dungeon ⇒ **hard fail** |
| **M6 Ride fidelity** | ≥ 8 s rendered motion both ends, no >25 m frame delta | ≥ 5 s one end | single-frame station-to-station teleport ⇒ **hard fail** · free or clock-less ride ⇒ **hard fail** |
| **M7 Tariff** | anchors exact, 17/17 lines additive, no multi-line ticket | anchors ±2 g, no multi-line ticket | any multi-line ticket ⇒ **hard fail** · all fares 0 ⇒ **hard fail** |
| **M8 Time ratios** | all four means ±0.03, rootspeak ∈ [0.02,0.10] | all modes ∈ [0.20,0.80] | any mode < 0.10 (instant) or > 0.95 (pointless) |
| **M9 Siting** | all 26 stations ≥ 60 m from HEARTH, all sited per §6 | ≥ 60 m, no dungeon stations | any HEARTH with destinations ⇒ **hard fail (AR-2)** |
| **M10 Availability** | all four gates observably bite | ≥ 3 gates bite | zero gates bite (always-on menu) |
| **M11 Severance** | service vanishes, dialogue changes, graph still unbridged | service vanishes | nothing changes |
| **M12 Reach subset** | 0.15–0.25, zero caves/dungeons as stations | 0.12–0.30 | > 0.60 ⇒ **hard fail** |

**Failure thresholds.** Native < 14/24 ⇒ *below bar, named remedy required* (ladder ceiling 6). Native
< 9/24 ⇒ *loses outright* (ceiling 4). **Any hard fail caps the item at 2** (`SCORING.md` §1.1).

**Both directions are failures of equal standing.** A verdict that reports "no warping found, passes" on
a build with zero transport services has scored a 0 as a 10 and is void.

## How we lose

- **The most likely outcome by a distance: nobody builds it, and every check we already shipped says
  fine.** `RI-PRG04:255` gives its top score to "no warp code path exists"; `RI-WLD01:185` still contains
  the words "no fast travel"; `subsystems.json` still titles the path *"In-fiction transport network
  only; no warp-to-pin"*. A naive Three.js build that ships a walkable 14.5 km² map and nothing else
  passes all of them. **M1's N-fail is the only thing standing between this project and shipping S7
  inverted**, and it must be run before anything else in this file.
- **The barge is a fade to black.** The path of least resistance in Three.js is: click keeper → `player.position.set(destX, 0, destZ)` → fade. It costs gold, it advances the clock, it obeys the walked-once rule, and it passes M1, M2, M4, M5, M7, M8 and M9. It is a warp. **Only M6 catches it**, and M6 is the most expensive check in this item, so it is the one that will be quietly dropped.
- **Someone adds a destination list to the HEARTH shrine.** "Just between discovered HEARTHs" — `RI-PRG04:274` already names this as the most seductive S7 violation. It arrives as a quality-of-life ticket in wave 3, and it deletes the entire network in one commit, because a free warp between 19 settlement bonfires strictly dominates 68 paid services.
- **The walked-once rule is implemented as a "visited" flag.** `settlement.visited = true` set on trigger-volume entry. Then a quest that teleports you to Lilmoth for a cutscene unlocks Lilmoth's whole network, and a Recall spell unlocks its destination. M4 sub-check 3 exists solely for this, and it is the subtlest failure in the item: everything looks right and the precondition is hollow.
- **Water gets built as decoration.** Rivers are shader planes, the quay is a prop, the barge is a static mesh with a collider, and all five modes are the Rootway with different names. M3's N-fail catches the count; nothing catches "the barge is a Rootway in a hat" except reading the per-mode ratio table in M8 and noticing every mode has the same speed.
- **The graph gets completed for convenience.** A playtester says "I hate that I can't get from Thorn to Soulrest directly". Someone adds the edge. Then four more. At density 0.6 every settlement is one leg from every other, Helstrom stops being a hub, the province stops having a shape, and 25 km of trunk road becomes scenery. **M2's W-fail is the only defence, and it will be argued with**, because each individual edge is reasonable and only the aggregate is fatal.
- **Fares get barter-modified "for consistency".** The shop applies `buy_mult` to the fare. A Fence pays 0.80×, and more importantly the fare becomes a number the player optimises rather than a fact about the world. Worse: someone lets a faction discount stack below 0.80 and the flip invariant's blast radius now includes travel.
- **Interchange gets removed.** The multi-line ticket is the single most requested convenience and the single most destructive one: it turns 68 station-to-station services into an origin-destination matrix, which is a map-pin menu that has learned to say "sum of hop fares". M7's W-fail must be a hard fail for exactly this reason.
- **Ride time is set to zero because "waiting isn't fun".** The clock stops advancing, the four-game-hour barge becomes instantaneous, NPC schedules and tide stop mattering, and the network's entire cost structure collapses to gold. At that point the only difference between our system and a Skyrim map-pin is that ours has a station mesh.
- **Root-speaking grows.** It is the most convenient mode, so it accretes destinations: a sixth, an eighth, one per settlement. At eight destinations it is a free-form teleport network with a rank check, and it has eaten the other four modes. The cap of five is arbitrary and it is load-bearing; M8 asserts the count, not just the ratio.
- **Thorn quietly gets a river.** The one settlement with a single mode is the one that will look like a bug. It is the province's texture, and the moment it is "fixed" the mode-coverage table becomes uniform and every settlement is interchangeable.
- **The tide inversion is never implemented**, so BG‑LIL‑ARC and RW‑LIL‑ARC are simply both always available, and the most interesting route in the province becomes the most ordinary. `RI-WLD07:170` predicts the same failure for the Drowned Xanmeer; it is the same tide and it will fail once for both.

## Provenance note

**`constructed`, confidence `medium`.**

**Derived, not invented** (high confidence, checkable): every station name, position and road distance
comes from `corpus/50-world/world-scale.json` and `settlements.json`, which `RI-WLD01` §3 declares
authoritative. The 26 hop distances are the minor settlements' own `on_leg` assignments projected onto
their road legs and scaled by each leg's published sinuosity; the sums reproduce the published `path_m`
to within 2.5% on all ten legs. The three tariff anchors are `RI-PRG05` §2's published transport prices,
unchanged. The tide cycle (12 real minutes, four states), timescale (20×) and walk speed (2.0 m/s) are
`RI-WLD08` and `RI-WLD01`. `travel-network.json` is generated, not hand-written; the generator is ~150
lines of Python reading only those two JSON files, and M0 requires it to be re-run rather than trusted.

**Canon-anchored** (`community-data` / prior corpus): the barge network and its Hist-advised routing is
**CF-C012**, verbatim, including "schedule-bound, refusable, severable as a plot event". The walked-once
rule's in-fiction justification is **CF-089**. The Rootway as the silt-strider analogue with a post in
every settlement, and the boat/tide service at Lilmoth/Archon/Soulrest, are `RI-WLD03:105–113`. The
faction operators are `RI-LOR02` §4. The silt-strider and Guild-Guide shapes being copied are
`canonical-recall` at medium confidence — Morrowind's silt striders ran fixed adjacent-town routes for
gold from a platform outside the walls, and Mages Guild guides teleported members between guild halls —
and nothing here depends on any recalled *number* from that game.

**Constructed and binding** (this is the load-bearing part, and it is ours): the five modes and their
distinct availability gates; the assignment of water to seven of ten trunk legs; the three packet
services and Bloodmarl Isle's swim-only precondition; the root-speaking star and its cap of five; the
tariff *function* between `RI-PRG05`'s anchors; the mode and faction multipliers; the no-through-ticket
rule; the vehicle speeds; the 60 m HEARTH separation; the 8 m / 25 m arrival tolerances; and every
threshold in §3 and in Scoring.

**Two known deviations, declared:**

1. **Intent audit ID-02 proposes "longest station-to-station walk ≤ 9 min". That threshold is
   unachievable against the authoritative map** and this item sets **≤ 13.0 min** instead. Measured
   adjacent-station spacing over all 26 hops: **max 12.8 min** (Clayfast → The Red Wells, on the
   Archon–Thorn Clay Moor track), mean 8.2, min 4.0. Meeting 9 min would require moving minor settlements
   that `settlements.json` places, and `RI-WLD01` §3 says the artefact that disagrees with the map is the
   artefact that is wrong. Three hops exceed 9 min, all of them on the province's two longest and most
   deliberately remote legs.
2. **ID-02 also proposes the id `RI-WLD10`.** This item and `RI-TRV02` discharge that remedy under the
   ids the travel brief assigned. If the taxonomy owner prefers `RI-WLD10`/`RI-WLD11`, rename both and
   update `INDEX.md`; nothing else depends on the ids.

**The weakest number** is the modelled lifetime fare spend (2,000–3,200 g). It is a *budget handed to
the quest and world owners*, not a measurement: it presumes a play pattern of roughly 46 line journeys
and 60 single hops, which no shipped content yet supports. When `corpus/30-quests/` and the beat sheet
settle, re-run M7 against the real journey count and amend. The **ratios** — fare against the R1 margin,
network time against walking time, station count against POI count — are the binding part and do not
move.
