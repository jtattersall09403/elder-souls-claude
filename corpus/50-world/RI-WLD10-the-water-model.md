---
id: RI-WLD10
title: The water model — depth bands, wading, swimming, tide, substrate, and what standing water does to a fight
kind: number
side: split
judges: [world.water.marsh, world.terrain.form, world.traversal.locomotion, world.hazard.environment, combat.player.movement]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Until this item existed, the corpus had **no definition of what water is**. It had a swim speed
(1.1 m/s), a wade speed (1.3 m/s), a tide clock (12 real minutes, four states), a barge that sails
only at high tide, a walking tideway that is its exact inverse, a tide-gated dungeon, a stilt-village
on hydraulics, and an Argonian racial ability that grants "unlimited water breathing, no swim stamina
drain, and the ability to stand and act in deep water" — **against nothing.** Five reference items
depend on a water model that no reference item wrote down. That is the hole this closes.

The bar is a **continuous depth field, quantised into six bands you can read off your own body**, with
a per-band cost to locomotion, stamina, breath, stealth and the fight; a **substrate axis** that is
orthogonal to depth, so that shin-deep water over sucking mud is a different problem from
shin-deep water over root-wood; a **tide that moves the field itself** and therefore moves the map;
and — the ruling this item exists to enforce as much as any number in it — **a water model that is
regional, not global.**

Because the second half is the one that is easy to get wrong and fatal when you do: **Black Marsh is
the name, not the terrain** (`ARBITRATION.md` **S24**). The Clay Moor has no standing water. The
Stone Wastes' signature hazard is *the absence* of water. Valus Ridge is a mountain, The Hive has no
weather at all, and the Salt Hills are the only place in the province with open sky over dry ground.
An implementation in which the whole province is knee-deep and the regions differ by fog colour has
failed this item **even if every number below is exact**, and §8 is written as a two-sided census
specifically so that it fails: the province-wide water coverage index must land in a band, **five
regions must be effectively dry**, and no more than three may be effectively drowned.

Get it right and water is the province's second currency after gold: a thing you spend time and
stamina on, that hides you, that strands you, that your race may exempt you from, and that changes
between one visit and the next because the moons moved. Get it wrong in the first direction and the
world is a puddle with a shader on it. Get it wrong in the second and the water is a wall painted
blue, and half of `RI-TRV01`, `RI-WLD07`, `RI-WLD08` and `RI-CHR02` quietly stops meaning anything.

## The reference artifact

### 0. What this item owns, and what it does not

| Owned here | Owned elsewhere, cited here |
|---|---|
| The depth-band definition `ES-WATER/1` and every per-band number | Base locomotion speeds — `RI-WLD01` / `constants.json` (`walk 2.0`, `jog 3.2`, `sprint 5.0`, `swim 1.1`, `tide_wade 1.3`) |
| Tidal **range** in metres, per sea, per moon phase | Tidal **cycle** — `RI-WLD08` §1 (12 real minutes, 4 states, moon-driven) |
| The per-region water profile (§8) | Region identity and the blind region test — `RI-WLD04` (S24 enforcement lives there; this item does not duplicate it) |
| Breath, drowning, and the sink rule | Stamina pool, costs, regen delay and guard break — `RI-CMB03` |
| The substrate axis and the `MIRED` state | Roll frames, i-frames, equip-load tiers — `RI-CMB01` (this item may **not** change one of its frame numbers; see §5) |
| Water's effect on detection | The detection model itself — `RI-STL01` |
| Water as terrain cost and as escape route | Environmental hazards proper (fog, spore, voriplasm kill volumes, disease vectors) — `RI-WLD11` |
| The look of water as an art-direction and fidelity target | The bifurcation rule — `RI-VIS01`; the capture protocol — `HARNESS.md` §6 |

### 1. `ES-WATER/1` — the six bands

Depth `d` is the height of the water surface above the ground plane, sampled **at the character
capsule's foot position**, in metres, every fixed step. Reference body height `H = 1.80 m`. The
band boundaries are chosen to sit on **anatomical landmarks**, because the player's only readout is
their own silhouette — which is exactly why seam **S18** (third person always, everywhere) is
load-bearing for this system. You know how deep you are because you can see where the waterline
crosses your character. There is no depth meter and there must never be one.

| Band | `d` (m) | `d/H` | Waterline on the body | The one-sentence identity |
|---|---|---|---|---|
| **W0** `DRY` | 0.00 | 0 | — | Ground. |
| **W1** `FILM` | 0.01 – 0.20 | ≤ 0.11 | sole → ankle | Sheet water. Free to cross, impossible to cross **quietly**. |
| **W2** `SHIN` | 0.21 – 0.50 | 0.12 – 0.28 | ankle → knee | The default wet surface of the Rootlands. Slower, still a floor. |
| **W3** `WADE` | 0.51 – 0.95 | 0.28 – 0.53 | knee → hip | The band where the game changes: no sprint, no roll. |
| **W4** `DEEP` | 0.96 – 1.40 | 0.53 – 0.78 | hip → chest | Buoyant, slow, expensive. Non-amphibious races cannot fight here. |
| **W5** `SWIM` | > 1.40 | > 0.78 | feet leave the bottom | Swimming. No attacks, no block, a breath clock if you dive. |
| **W5-D** `SUBMERGED` | — | — | under the surface | A mode of W5, entered by the dive input. |

Three properties of this table are as binding as its numbers:

1. **The field is continuous; the bands are a quantisation of it, not a replacement for it.** The
   renderer, the audio and the character's waterline all read `d`. Only the *rules* read the band.
   A world built from `isInWater: bool` fails this item outright.
2. **Boundaries are hard and hysteretic.** Band transitions apply a **±0.03 m hysteresis** so a
   character standing on the W2/W3 line does not flicker between two locomotion states at 60 Hz.
   The hysteresis is on the *band*, never on the field.
3. **The boundaries sit where the immersion-physiology literature puts its measurement levels** —
   knee, thigh/hip, waist, xiphoid — which is not a coincidence and is the only reason the numbers in
   §2 have any external anchor at all (§Provenance).

### 2. Locomotion by band

Base speeds are `RI-WLD01`'s and are **not restated as new values** — every cell below is the base
speed times this item's multiplier. The `W3` walk cell is the load-bearing one: **0.65 × 2.00 =
1.30 m/s, which *is* `world.tide_wade_speed_mps`.** The constant already in the registry is the
knee-to-hip wading speed; this item is where it comes from.

| Band | walk ×  | walk m/s | jog × | jog m/s | sprint | roll / dodge | Notes |
|---|---:|---:|---:|---:|---|---|---|
| **W0** | 1.00 | 2.00 | 1.00 | 3.20 | **5.00** | full (`RI-CMB01`) | |
| **W1** | 0.97 | 1.94 | 0.95 | 3.04 | 4.60 | full | roll leaves a 2.2 m spray decal |
| **W2** | 0.85 | 1.70 | 0.78 | 2.50 | 3.60 | full, ground distance **×0.85** | |
| **W3** | **0.65** | **1.30** | 0.55 | 1.76 | **DENIED** | replaced by `WADE-LUNGE` | |
| **W4** | 0.43 | 0.86 | — | 0.86 (jog collapses into walk) | **DENIED** | `WADE-LUNGE` only | |
| **W5** | — | **1.10** (`swim`) | — | — | burst **1.70** | **DENIED** | |

- **`WADE-LUNGE`** (`RI-CMB01`'s dodge button, above W2): 6 f startup, **0 i-frames**, 22 f total,
  1.30 m of travel, stamina 26. It exists so the button does something, and it is deliberately a bad
  move. **Dodging does not work in deep water.** That is the design: the answer to a fight in W3+ is
  to get out of the water, not to get better at rolling in it.
- **Sprint is denied above W2, not slowed.** A denied action is legible; a silently degraded one is
  not. The press produces the sprint-denied audio cue and nothing else.
- **Swim-burst** (`sprint` held while swimming) is 1.70 m/s at 12 stamina/s and exists solely so the
  1,257 m open-water swim to Bloodmarl Isle (`RI-TRV01` §2) is a decision rather than a wait.
- **Falling into W4+ cancels nothing you were owed**: fall damage is computed against the *water
  surface* with a ×0.25 multiplier above 1.40 m depth and ×1.00 below it. Landing in ankle water from
  a height still kills you.

### 3. Stamina, breath, and drowning

These are **additive to** `RI-CMB03`'s economy. Nothing here changes a stamina cost, a pool size or
the 42-frame regen delay; water adds a **drain** and, above W3, a **regen suppression**.

| Band | drain, moving | drain, still | regen behaviour |
|---|---:|---:|---|
| W0 – W2 | 0 | 0 | normal |
| **W3** | **2.0 / s** (0.0333/f) | 0 | normal |
| **W4** | **5.0 / s** (0.0833/f) | 1.2 / s | **regen delay re-armed every frame while moving** (as sprint) |
| **W5** swim | **4.0 / s** | 0.6 / s (treading) | **regen suppressed entirely while in W5** |
| **W5** burst | 12.0 / s | — | suppressed |

Equip load enters through `RI-CMB01`'s existing four tiers — **this item defines no new tier and no
new boundary** (seam **S23**):

| `RI-CMB01` tier | swim stamina × | swim speed × | in water |
|---|---:|---:|---|
| `LIGHT` ≤ 30% | ×0.80 | ×1.00 | |
| `MEDIUM` ≤ 70% | ×1.00 | ×1.00 | |
| `HEAVY` ≤ 100% | ×1.60 | ×0.80 | |
| `OVERLOADED` > 100% | — | — | **cannot swim.** You walk the bottom, with a breath clock. |

> *"He was drowned in the Sea of Ghosts because he couldn't get his armor off. Call me overly
> particular, but I think the greatest warrior in the world should know how to take armor off."*
> — **Hallgerd's Tale**, verified in the vendored UESP extract. The sink rule is canon, and it is the
> one place in this corpus where an equipment decision can kill you without an enemy present.

**Breath.**

| Quantity | Value |
|---|---|
| `breath_max` | **40 s + 2.0 s per point of Endurance above 10**, capped at **100 s**. END 20 → **60 s** |
| Drain | 1 s per second while `W5-D SUBMERGED`, or while `OVERLOADED` in W4+ |
| Refill | ×3 real time on surfacing (empty → full in 20 s at END 20). **Not instant** |
| At 0 breath | **2% of max HP per second**, so drowning is not a stat check; plus forced camera shake and the drown audio bed |
| Death by drowning | leaves a normal bloodstain (`RI-PRG04`) **at the surface point above the body**, not at the corpse, so the recovery run is not itself a drowning |

**Amphibious races.** `RI-CHR02` grants Saxhleel and Naga *"unlimited water breathing; no swim
stamina drain; stand and act in deep water."* This item makes those three privileges exact:

| Privilege | Exact meaning |
|---|---|
| Unlimited water breathing | `breath_max = ∞`. The meter does not exist. Still cannot swim while `OVERLOADED` — it sinks you, it just does not kill you |
| No swim stamina drain | §3's W5 drain and W5 regen suppression are both zeroed. W3 and W4 drains still apply at **×0.5** |
| Stand and act in deep water | **W4 only.** Attacks, blocks and parries execute at full `RI-CMB01`/`RI-CMB02` frame data in W4. W5 remains no-attack for everyone — swimming is swimming |

This is the corpus's single largest **AR-3** payoff from a character-creation choice: an Argonian
player and a Nord player are handed **different maps**. §8's tidal regions are shortcuts for one and
walls for the other, and `RI-TRV01`'s Bloodmarl Isle swim is a stroll for one and a 19-minute
stamina-managed ordeal for the other.

### 4. The substrate axis

Substrate is sampled from the terrain material, **independently of depth**. Shin-deep water over
root-wood and shin-deep water over mudflat are different problems, and a world where they are the
same has thrown away half of what a marsh is.

| Substrate | speed × | Effect | Where |
|---|---:|---|---|
| `FIRM` | 1.00 | — | rock, root-wood roads, boardwalk, packed clay, xanmeer limestone |
| `SILT` | 0.92 | footprints and drag-marks persist ~120 s (`RI-WLD05` #26) | river and paddy bottoms, sand, Topal Bay flats |
| `SUCK` | 0.70 | each footfall adds **+1** to a `mire` counter (decays 1 per 45 f out of `SUCK`); at `mire ≥ 6` → **`MIRED`** | mudflats at low tide, the Deep Marshes floor, voriplasm margins |

**`MIRED`** — the sinking-mud state:

```
MIRED:
  locomotion      := 0            # you do not move, at all
  camera, look    := free         # you can watch it happen
  attacks         := allowed, at 0.70x speed, no root-motion travel
  roll / lunge    := denied
  escape          := one `roll` press per 30 f, costing 25 stamina, 3 successes to break out
  poise           := unchanged; you are not helpless, you are stuck
  on break out    := 20 f recovery, mire := 0
  drowning        := if d rises above 1.40 m while MIRED (a rising tide), the breath clock starts
```

`MIRED` is the corpus's answer to "sinking mud" as a *mechanic* rather than a kill volume. The kill
volume — voriplasm, which is an animal and eats you — is `RI-WLD11`'s. The distinction is that
`MIRED` is survivable, expensive, and something a competent player walks around.

### 5. Water inside the fight

This is the seam, and it is pre-decided here so no builder re-litigates it. It follows the supreme
rule exactly: **Souls owns how fighting works; water is world, and world may not reach inside the
frame table.**

> **PROPOSED SEAM RULING — "S25: water at the waterline".** Submitted by this item for entry in
> `ARBITRATION.md` §2. It is written as binding within this item and its method scripts; a critic
> enforcing it should cite this section until the ruling lands. **Water may change *where* you can
> fight and *what it costs to be there*. It may never change a frame number.**

| # | Rule | Why |
|---|---|---|
| **R1** | **Frame invariance.** Roll i-frames, startup / active / recovery frames, parry and critical windows, poise values and stamina *costs* are **identical at every band**. Not scaled, not offset, not interpolated. | An i-frame count that varies with terrain is an unlearnable dodge, which is precisely what `RI-CMB01`'s bar forbids. |
| **R2** | **Denial, not degradation.** Water removes actions from the legal set (sprint above W2; roll above W2; all attacks, blocks and parries in W5; attacks in W4 for the non-amphibious). A denied action produces its denial cue. Nothing is *silently* worse. | Legibility. The player must be able to name the rule after two minutes. |
| **R3** | **Cost, not chance.** Water charges stamina and suppresses regen (§3). It never introduces a probability, a slip roll, or a to-hit modifier. **S1 applies inside water exactly as on land.** | AR-1. A "chance to slip" is Morrowind leakage into the fight. |
| **R4** | **Arena ceiling: `W2`.** No boss arena, no fog-gated encounter volume, and no `RI-AI07` scripted ambush may place the player above **W2** at any tide state. Of the 8 loop dungeons (`S16`), **at most 2** may contain a W3+ *traversal* segment and **none** may contain a W3+ *arena*. | A Souls arena is a floor. If the floor is chest-deep, the fight is not a Souls fight and no amount of good frame data rescues it. The Drowned Xanmeer is tide-gated precisely so its arena is dry when you are in it. |
| **R5** | **Enemies declare their depth.** Every enemy archetype carries `water_max_band` and `water_native`. A land enemy **will not** pursue above its max band; it holds at the waterline and reacquires when you return. | This is what makes deep water a real **disengage route**, which `ARBITRATION` §1 explicitly protects. It also means the map has natural leashes that are not invisible walls. |
| **R6** | **Water-native enemies own what land enemies cannot.** At least **4** roster archetypes must be `water_native` with `water_max_band = W5`, and they must be genuinely dangerous there. | Otherwise R5 turns deep water into a free safe zone and the map's whole risk gradient inverts. Water is safe from one half of the roster and lethal from the other. |

**Hitbox geometry does change, and it is not an exception to R1.** Above W3 the character's animation
set is the wade set, whose hurtbox capsule sits higher and whose attack arcs are authored shorter.
Those are *different animations with their own declared frame data in `game/data/combat/movesets/`* —
measured, diffed and enforced by `RI-CMB04` and `RI-WPN01` like any other move. What R1 forbids is
taking the *same* move and multiplying its numbers by a depth factor at runtime.

### 6. Water and detection

Hooks into `RI-STL01`'s model; the model itself is not restated.

| Situation | Effect |
|---|---|
| Sprint or roll in **W1** | noise radius **×1.60** — sheet water is the loudest surface in the province |
| Walk in **W1–W2** | noise radius ×1.15 |
| Sneak (crouched) in **W1–W2** | noise ×1.00, **but** emits a `wake` event visible at 25 m for 6 s |
| Crouched and **still** in **W3+** | silhouette breaks at the waterline → visual detection range **×0.55** |
| **W5-D** submerged | visual detection **×0.15**; **cannot attack**; breath clock runs |
| Any movement in **W2+** | `wake` event, 6 s, visible 25 m — moving water is a tell |

The trade is Souls-correct: water is the best concealment in the game and it is only concealment
**while you hold still**, which is the one thing a player under pressure cannot do.

### 7. The tide — range, and where it exists

The **cycle** is `RI-WLD08`'s and is cited, not redefined: **12 real minutes**, four states
(`LOW → RISING → HIGH → FALLING`), driven by the two moons' 24-day and 8-day phases. This item owns
the **amplitude**, which nobody did.

| Quantity | Value |
|---|---|
| `world.tide_mean_range_m` | **1.20 m** peak-to-trough, at the Padomaic reference coast |
| Spring multiplier (moons in conjunction) | **×1.35** → 1.62 m |
| Neap multiplier (moons in quadrature) | **×0.65** → 0.78 m |
| Topal Bay multiplier | **×0.55** (wide, shallow, damped) → 0.66 m mean, 0.89 m spring |
| Surface height as a function of phase | `h(t) = A/2 · sin(2π t / 720 s)` about the region's mean water plane, `A` = that region's range |
| Damping inland | linear to zero over the first **400 m** of a tidal region's inland reach |
| **Amplitude outside a tidal region (§8)** | **exactly 0.00 m** |

**The consequence, and the reason the number is 1.20 m:** the band widths in §1 are 0.20, 0.30, 0.45
and 0.45 m. A 1.20 m range therefore moves the shoreline **two to three whole bands**. The same
causeway is `W1 FILM` at low water and `W4 DEEP` at high. That is what makes `RI-TRV01`'s tideway
inversion real — the Lilmoth–Archon walk and the Lilmoth–Archon barge over the same water, never both
at once — and what makes `RI-WLD07`'s Drowned Xanmeer a dungeon with a clock rather than a cave.
A range of 0.30 m would move one band and none of it would matter; a range of 3 m would make the
coasts unusable for half of every cycle.

**The tide is not a global shader and this is a hard rule.** A non-zero tidal amplitude in the Clay
Moor, The Hive, Valus Ridge, the Stone Forest, Thornmarsh, Blackwood, the Deep Marshes or the Salt
Hills is a **defect**, checked by **M54**. Five regions have a tide. Eight do not.

### 8. The regional water profile — S24 made countable

**`WCI`** (water coverage index) = the fraction of a region's walkable surface at **≥ W1** at
**mean tide**, mean moon phase. This is the table that fails a globally-swampy world.

| # | Region | km² | Tier | Water class | **WCI** | Deepest ordinary band | Tide | Sea | Signature |
|---|---|---:|---:|---|---:|---|---|---|---|
| 1 | **The Clay Moor** | 0.81 | 4 | **arid** | **0.00** | W0 | — | — | Fired clay. `regions.json`: *"no standing water"*. Water is carried, sold, and fought over |
| 2 | **The Hive** | 0.31 | 2 | **arid** | **0.00** | W0 | — | — | No weather at all. The comb is dry and the drones drink elsewhere |
| 3 | **Valus Ridge** | 1.71 | 4 | **dry upland** | **0.01** | W3 (two tarns) | — | — | Cloud *below* you. The only water is falling |
| 4 | **The Salt Hills** | 0.94 | 3 | **dry upland** | **0.02** | W2 (fords) | — | — | Open sky over dry ground; cold rain that runs straight off |
| 5 | **Stone Wastes** | 0.81 | 5 | **arid + salt fringe** | **0.03** | W3 (Soulrest's silted bay) | **yes** (fringe) | Topal | A port with no drinkable water. The hazard is thirst, not depth |
| 6 | **The Stone Forest** | 1.80 | 3 | **damp** | **0.06** | W2 | — | — | Dry thunder with no rain; rock pools in petrified boles |
| 7 | **Thornmarsh** | 1.08 | 4 | **seasonal** | **0.09** | W2 | — | — | A *thorn* labyrinth, not a bog. Sheet water on the thicket floor for ~90 s after rain |
| 8 | **Crimson Coast** | 0.63 | 4 | **tidal littoral** | **0.34** | W5 | **yes** | **Padomaic** | The lichen marks the high-water line for you; below it is red, above it is grey |
| 9 | **Blackwood** | 2.07 | 2 | **flooded forest** | **0.41** | W5 (drowned Ayleid vaults) | — | — | Standing fresh water in a forest, not a marsh. Ayleid white stone drowned to the second storey |
| 10 | **Western Rootlands** | 1.17 | 1 | **paddy + channel** | **0.47** | W4 | **yes** (fringe) | Topal | Engineered water: paddies, bunds, and a road that is a living root above them |
| 11 | **Marauder's Coast** | 0.49 | 2 | **tidal flat** | **0.58** | W5 | **yes** | Topal | The flats flood and strand you. Mangrove, barnacle shelf, `SUCK` everywhere |
| 12 | **Eastern Rootlands** | 1.44 | 2 | **tidal delta** | **0.71** | W5 | **yes** | **Padomaic** | Tannin-black channels; stilt-rows on real hydraulics; the tideway |
| 13 | **The Deep Marshes** | 1.26 | 5 | **drowned** | **0.86** | W5+ | — | — | Black standing water with no tide and no bottom you want to find |

**Derived, and these are the bars:**

| Property | Value | Bar | Fails what |
|---|---:|---|---|
| Province-wide area-weighted `WCI` | **0.294** | **∈ [0.22, 0.42]** | < 0.22: not a marsh at all. > 0.42: the puddle |
| `max(WCI) − min(WCI)` | **0.86** | **≥ 0.55** | a world with one water profile smeared over 13 regions |
| Regions with `WCI ≤ 0.05` ("effectively dry") | **5** | **≥ 4** | the same |
| Regions with `WCI = 0.00` (no standing water at all) | **2** | **≥ 2** | the same |
| Regions with `WCI ≥ 0.60` ("effectively drowned") | **2** | **≤ 3** | a world that is mostly swim |
| Regions with a non-zero tidal amplitude | **5** | **= 5, exactly these five** | the tide as a global shader |
| Distinct water classes in use | **11** | **≥ 6** | one water with several names |
| Land below +5 m elevation | (owned by `RI-WLD07`) | 35–50%, fail > 70% | cross-check: `WCI` and the elevation census must not contradict |

This table is also the corpus's cheapest **S24** instrument: it is a static file check that needs no
browser (**M47**), it runs before a single pixel exists, and it fails a globally-swampy world in
about 40 ms.

### 9. The two seas

Topal Bay to the west and south, the Padomaic Ocean to the east. They are **different bodies of
water** and must not share a material, a sound bed, a wave model or a tidal range.

| Property | **Topal Bay** (west/south: Marauder's Coast, Western Rootlands, Stone Wastes fringe, Lilmoth) | **Padomaic Ocean** (east: Crimson Coast, Eastern Rootlands) |
|---|---|---|
| Character | wide, shallow, silt-laden, warm | open ocean, steep shelf, cold, big |
| Tidal range (mean) | **0.66 m** | **1.20 m** |
| Tide behaviour | long slack, slow flood, the flats go out ~300 m | fast flood; the dangerous one |
| Attenuation `k` (1/m) | **1.4** — visibility ~1.6 m, brown-green | **0.35** — visibility ~6 m, grey-blue-black |
| Surface | short chop, ≤ 0.25 m; glassy at slack | swell, 0.6–1.4 m, breaking on the red rock |
| Colour (deep water, sRGB) | `#4A5A3E` → `#6B7355` | `#1B2A33` → `#2E4652` |
| Sound bed | lapping, mud-suck, gull, bell buoy at 600 m (`RI-WLD04`) | surf, undertow drag, no gulls at Archon (the dye kills them) |
| Fauna at the waterline | mire-crabs, mudskippers, drowned-things at night | dye-worms, red cormorants, the things that come in on the swell |
| Boat consequence (`RI-TRV01`) | the packet is *lightered ashore* at Soulrest because the bay silted | the Lilmoth–Archon barge runs **only at high or rising tide** |

**M56** makes this measurable: the two seas' VP06 histograms must be separable by a fresh judge, and
their tidal amplitudes differ by a factor of 1.8.

### 10. What water looks like

Bifurcated per `RI-VIS01` — art direction against Morrowind, fidelity against modern references, and
a critic citing the wrong side commits a hard error (`ARBITRATION` §4).

**Art direction (judged against Morrowind and `RI-WLD05`'s banned list):**

1. **Water is opaque before it is reflective.** Every region declares an extinction coefficient `k`
   (1/m); underwater visibility is `≈ 3/k`. Tannin-black channels `k = 3.2` (0.9 m). Deep Marshes
   `k = 4.5` (0.7 m). Topal `k = 1.4`. Padomaic `k = 0.35`. Blackwood flood `k = 2.6`. **No region may
   use `k < 0.30`** — clear tropical blue water is not in this province.
2. **No full-screen blue tint underwater.** The submerged look is the region's own `k` and colour,
   applied as extinction over distance, plus loss of high frequencies in audio. A blue post-effect
   over the whole frame is a defect.
3. **The waterline is on the character.** A meniscus band on the mesh at height `d`, wet-shading
   below it that persists **20 s** after leaving the water and dries visibly. This is the player's
   only depth readout (§1) and it is not optional.
4. **Water carries the region's sky, not a sky.** Reflections must resolve the region's own canopy,
   architecture and weather. A shared cubemap across regions is the exact mechanism by which
   "everything is swamp with recoloured fog" gets built, and **M56** is aimed at it.
5. **Caustics only where `d < 0.50 m` and `k < 1.5`.** Everywhere else the bottom is not lit and
   should not pretend to be.
6. **Wake and disturbance persist.** Ripples decay over 6 s; a wading trail through duckweed or
   floating meadow stays open for 25 s. The province notices you passed.

**Fidelity (judged against modern references only):** shoreline blend with no hard intersection line
(depth-fade against the depth buffer), refraction with correct total-internal-reflection at grazing
angles, foam driven by shoreline distance *and* by character velocity, and no visible tiling in the
normal maps at the VP06 grazing angle.

### 11. The data contract

Per `HARNESS.md` §7, none of this is measurable unless it is data. **`game/data/world/water.json`**,
schema `elder-souls/water@1`, is a **required** file and its absence is exit code 10 for every check
in this item.

```jsonc
{
  "schema": "elder-souls/water@1",
  "reference_body_height_m": 1.80,
  "bands": [
    {"id":"W0","name":"DRY",      "min_m":0.00,"max_m":0.00},
    {"id":"W1","name":"FILM",     "min_m":0.01,"max_m":0.20},
    {"id":"W2","name":"SHIN",     "min_m":0.21,"max_m":0.50},
    {"id":"W3","name":"WADE",     "min_m":0.51,"max_m":0.95},
    {"id":"W4","name":"DEEP",     "min_m":0.96,"max_m":1.40},
    {"id":"W5","name":"SWIM",     "min_m":1.41,"max_m":null}
  ],
  "band_hysteresis_m": 0.03,
  "locomotion": {
    "W1":{"walk":0.97,"jog":0.95,"sprint":0.92,"roll":"full"},
    "W2":{"walk":0.85,"jog":0.78,"sprint":0.72,"roll":"full","roll_distance":0.85},
    "W3":{"walk":0.65,"jog":0.55,"sprint":"denied","roll":"wade_lunge"},
    "W4":{"walk":0.43,"jog":0.43,"sprint":"denied","roll":"wade_lunge"},
    "W5":{"swim_mps":1.10,"burst_mps":1.70,"attacks":"denied","block":"denied"}
  },
  "wade_lunge": {"startup_f":6,"iframes":0,"total_f":22,"distance_m":1.30,"stamina":26},
  "stamina_drain_per_s": {"W3":{"moving":2.0,"still":0.0},
                          "W4":{"moving":5.0,"still":1.2},
                          "W5":{"moving":4.0,"still":0.6,"burst":12.0}},
  "regen": {"W4":"delay_rearmed_while_moving","W5":"suppressed"},
  "equip_load": {"LIGHT":{"swim_stam":0.80,"swim_speed":1.00},
                 "MEDIUM":{"swim_stam":1.00,"swim_speed":1.00},
                 "HEAVY":{"swim_stam":1.60,"swim_speed":0.80},
                 "OVERLOADED":{"can_swim":false,"walks_bottom":true}},
  "breath": {"base_s":40,"per_endurance_over_10_s":2.0,"cap_s":100,
             "refill_rate_multiple":3.0,"drown_hp_pct_per_s":2.0,
             "amphibious_races":["saxhleel","naga"]},
  "substrate": {"FIRM":{"speed":1.00},
                "SILT":{"speed":0.92,"print_persist_s":120},
                "SUCK":{"speed":0.70,"mire_per_step":1,"mire_threshold":6,
                        "mire_decay_frames":45,
                        "mired":{"escape_cost_stam":25,"escape_every_f":30,"escapes_needed":3,
                                 "break_recovery_f":20}}},
  "detection": {"W1_sprint_noise":1.60,"W1_walk_noise":1.15,
                "W3_still_visual":0.55,"submerged_visual":0.15,
                "wake_visible_m":25,"wake_persist_s":6},
  "combat": {"frame_invariance":true,"arena_max_band":"W2",
             "loop_dungeons_with_W3_traversal_max":2,
             "loop_dungeons_with_W3_arena_max":0,
             "min_water_native_archetypes":4},
  "tide": {"cycle_real_min":12,"states":["LOW","RISING","HIGH","FALLING"],
           "mean_range_m":1.20,"spring_mult":1.35,"neap_mult":0.65,
           "inland_damping_m":400,
           "seas":{"padomaic":{"range_mult":1.00,"k":0.35},
                   "topal":{"range_mult":0.55,"k":1.4}}},
  "regions": [
    {"region":"The Clay Moor","wci":0.00,"class":"arid","deepest_band":"W0",
     "tidal":false,"sea":null,"k":null,"substrates":["FIRM"]},
    {"region":"The Deep Marshes","wci":0.86,"class":"drowned","deepest_band":"W5",
     "tidal":false,"sea":null,"k":4.5,"substrates":["SUCK","SILT"]}
    // ... all 13, keyed by name to corpus/50-world/regions.json
  ]
}
```

Every enemy statblock in `game/data/combat/enemies/*.json` gains **`water_max_band`** and
**`water_native`**. Absent fields are a **fail-closed 0** for M53, not a default.

### 12. Harness amendment requested (`HARNESS.md` §10)

None of §1–§7 is observable through `HARNESS.md` version 1. This item formally requests, per
`HARNESS.md` §3 ("a critic that needs a number the API cannot produce ... files an amendment"):

| Addition | Form | Needed by |
|---|---|---|
| `player.water` in the frame record | `{"depth_m":0.62,"band":"W3","substrate":"SUCK","mire":2,"mired":false,"breath_s":60.0,"breath_max_s":60.0,"buoyant":false}` | M48–M53, M55 |
| `world.tide` in the frame record | `{"state":"RISING","height_m":0.31,"sea":"padomaic"}` | M54 |
| `__HARNESS.setTide(stateOrPhase01)` | pins the tide deterministically; returns the resulting height | M54, M56 |
| `__HARNESS.getWaterAt(x, z)` | `{depth_m, band, substrate, region, sea, tidal}` — samples the field without moving the player | M47, M48 |
| Events `water_enter`, `water_exit`, `mired`, `unmired`, `breath_empty`, `drown` | added to the §5 closed event vocabulary | M51, M52 |
| VP06 captured at **all four tide states** | capture-protocol addition to `viewpoints.json`; VP06's pose is unchanged, so no cross-wave comparison is invalidated | M56 |

Until the amendment lands, M48–M56 are **unmeasurable ⇒ 0**, fail-closed, and the item's score is
capped at M47's weight. That is the correct outcome and it is not a reason to relax it.

## Comparison method

Script: **`corpus/80-methods/m-wld10-water-census.mjs`** (M47 and M54's static half; no browser).
Everything else drives the real harness per `HARNESS.md` §9.

**M47 — The S24 regional census (static, runs today).**
```bash
node corpus/80-methods/m-wld10-water-census.mjs                     # reads game/data/world/water.json
node corpus/80-methods/m-wld10-water-census.mjs --against corpus/50-world/regions.json
```
1. Load `game/data/world/water.json`; exit **10** if absent.
2. Assert every one of the 13 `regions.json` region names appears exactly once, and no others.
3. Compute area-weighted `WCI` using `regions.json`'s `area_km2`.
4. Assert every bar in §8's derived table.
- **FAIL** if area-weighted `WCI ∉ [0.22, 0.42]`; if `max−min < 0.55`; if fewer than 4 regions have
  `WCI ≤ 0.05`; if fewer than 2 have `WCI = 0.00`; if more than 3 have `WCI ≥ 0.60`; if the tidal set
  is not exactly the five in §8; if fewer than 6 distinct water classes are used.
- **This check is the S24 gate and it runs before the game exists.**

**M48 — Declared vs observed depth field.** For each of the 13 regions: sample **400** points
uniformly over the region AABB (seeded, `setSeed(1337)`), rejecting non-walkable points; at each,
`getWaterAt(x,z)` and, for 40 of them, `teleport()` + `stepFrames(24)` + `snapshot()`.
- Compute observed `WCI` per region and diff against the declared value. **FAIL** if `|Δ| > 0.04` in
  any region, or if `getWaterAt` and the snapshot's `player.water.depth_m` disagree by `> 0.02 m`.
- Two independent sources — declared and observed — that must agree, exactly as `HARNESS.md` §7.4
  requires of movesets. A world whose `water.json` is decorative fails here and only here.

**M49 — The locomotion ladder.** On a purpose-built calibration ramp (a 60 m slope from +0.5 m to
−2.0 m, `FIRM`, no tide), for each of {walk, jog, sprint, roll, wade-lunge}: drive 300 frames of
sustained input, and from the trace compute per-frame displacement bucketed by the frame's `band`.
- **FAIL** if any band's measured speed differs from §2 by `> 0.02 m/s`.
- **FAIL** if sprint produces any displacement above W2, or if a `roll` press above W2 produces
  i-frames (`player.iframe == true` on any frame).
- **FAIL** if `W3` walk ≠ **1.30 m/s** — that is `world.tide_wade_speed_mps` and a divergence here is
  a broken constant, not a tuning difference.
- **FAIL** if the speed curve is *continuous* across a band boundary (a lerp where §1 specifies a
  step means someone smoothed the design).

**M50 — Stamina and regen in water.** Scenario `wld-water-stamina`: full bar, enemy despawned.
Walk 600 frames in each of W3/W4/W5, then stand still 600 frames in each.
- Fit drain rate per band; **FAIL** if `> 0.15 /s` from §3.
- **FAIL** if any stamina regenerates during a moving W5 sample, or during a moving W4 sample more
  than 42 frames after the last input.
- Repeat at each `RI-CMB01` equip tier; **FAIL** on any multiplier off by `> 0.05`.

**M51 — Breath, drowning, and the sink.**
1. Dive at END 10 and END 20; **FAIL** if `breath_max` ≠ 40 s / 60 s (±1 frame).
2. Hold to zero; **FAIL** if HP loss ≠ 2%/s of max (±0.2), or if death does not fire.
3. Surface at 10% breath; **FAIL** if refill is instant or slower than ×3.
4. Set equip load to 105%; enter W5. **FAIL** if the character swims.
5. Run 1–4 as Saxhleel and as Nord. **FAIL** if the two are identical, or if the Saxhleel has a
   breath meter, or if the Saxhleel cannot land an attack in W4, or if either can attack in W5.
   This check is `RI-CHR02`'s amphibious clause and it is the item's headline AR-3 evidence.

**M52 — Substrate and `MIRED`.** Walk 40 steps over `SUCK`; assert `mire` increments per footfall,
that `MIRED` fires at 6, that locomotion is exactly 0 while mired, that escape costs 25 stamina and
needs 3 successes, and that leaving `SUCK` decays the counter at 1/45 f.
- **FAIL** if `MIRED` can be escaped by a single input, if it can be entered on `FIRM`, or if it
  removes the player's ability to attack or to be attacked.

**M53 — Water inside the fight (S25).**
1. **Frame invariance.** Re-run `RI-CMB01` **M1** and **M2** (the i-frame boundary probe) and
   `RI-CMB02`'s attack census at W0, W1 and W2. **FAIL** on any difference of ≥ 1 frame.
2. **Denial.** Above W2, assert `sprint` and `roll` produce their denial event and no displacement;
   in W5, assert `light`, `heavy`, `block` and `parry` produce no `attack_start`.
3. **Arena ceiling.** For every boss arena and every `RI-AI07` encounter volume, sample the water
   field over the volume at all four tide states. **FAIL** if any sample exceeds **W2**.
4. **Dungeon census.** **FAIL** if more than 2 loop dungeons contain a W3+ traversal segment, or if
   any contains a W3+ arena.
5. **Leash.** Aggro a land enemy with `water_max_band = W2`, retreat to W4. **FAIL** if it follows,
   if it stands in water it declared it would not enter, or if it de-aggros permanently instead of
   holding and reacquiring.
6. **Native roster.** **FAIL** if fewer than 4 archetypes are `water_native`, or if a `water_native`
   enemy's DPS in W5 is below 60% of the roster median on land (a water enemy that cannot hurt you is
   scenery).

**M54 — The tide.** Pin the seed; `setTide` across a full 720-second cycle in 5-second steps at a
fixed probe point in each of the 13 regions.
- Fit the amplitude per region. **FAIL** if any of the 8 non-tidal regions shows amplitude
  `> 0.02 m`; if the Padomaic regions' mean range ≠ 1.20 m ±0.05; if Topal's ≠ 0.66 m ±0.05.
- **FAIL** if the spring/neap multipliers do not appear when the moon phases are set to conjunction
  and quadrature (`RI-WLD08` owns the phase clock).
- **The `RI-TRV01` inversion, asserted directly:** at `HIGH`, the Lilmoth–Archon *walk* must be
  blocked (≥ W5 somewhere on the polyline) and the barge line `BG-LIL-ARC` available; at `LOW`, the
  walk must be ≤ W3 along its whole length and the barge line unavailable. **FAIL** if both are ever
  simultaneously available or simultaneously blocked.
- **FAIL** if the Drowned Xanmeer's entrance is enterable at `HIGH` (`RI-WLD07` §2 #5).

**M55 — Stealth in water.** Run `RI-STL01`'s detection probe at each band, moving and still.
- **FAIL** if any multiplier in §6 is off by `> 0.05`, if a moving character in W2+ emits no `wake`,
  or if a submerged character can attack.

**M56 — The look (`blind_pair: yes`).**
1. Capture **VP06-water-surface** in **4 regions** (Eastern Rootlands, Marauder's Coast, the Deep
   Marshes, Crimson Coast) × **4 tide states** = 16 shots, per `HARNESS.md` §6 world-set config.
2. Compute per-shot: mean hue of the water region, extinction slope against depth, reflection-band
   colour histogram, and shoreline-edge gradient.
3. **Region separability.** **FAIL** if any two of the four regions' water histograms have a
   Bhattacharyya distance below **0.25** — that is the numeric form of *"everything is swamp with
   recoloured fog"*, and it is the check the user's failure mode is named after.
4. **Sea separability.** Topal and Padomaic shots must be separable on hue **and** on measured tidal
   amplitude. **FAIL** if either is shared.
5. **Blind pair.** Interleave our 16 with 16 Morrowind water shots (Bitter Coast, Vivec's canals, the
   Azura's Coast shallows, Sadrith Mora's water) downsampled to a common resolution, and ask a fresh
   judge to rank all 32 by *"how much this water looks like a place rather than an effect"*. Record
   the blind ranking before the reveal. **We lose if our median rank is in the bottom half.** Per
   `CORPUS-CONTRACT` §6, if the judge ranks ours above Morrowind, distrust the judge and re-run with
   a harsher lens.
6. **Attenuation audit.** **FAIL** if any region declares or measures `k < 0.30`.
7. Art-direction and fidelity claims must be filed separately (`ARBITRATION` §4); a critic citing a
   2002 screenshot against the fidelity half has voided its verdict.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| **M47** S24 regional census | **20** | every bar in §8 met |
| M48 declared vs observed field | 10 | all 13 regions within ±0.04 `WCI` |
| M49 locomotion ladder | 10 | all bands ±0.02 m/s; steps not lerps |
| M50 stamina and regen | 8 | rates ±0.15/s; W5 regen suppressed |
| M51 breath, drowning, sink, **amphibious diff** | 12 | all five sub-checks; Saxhleel ≠ Nord |
| M52 substrate and `MIRED` | 6 | counter, threshold, escape cost exact |
| **M53** water inside the fight (S25) | **16** | frame invariance exact; arena ceiling W2; leash and native roster |
| M54 tide amplitude, confinement, inversion | 10 | 5 tidal regions and only 5; RI-TRV01 inversion holds |
| M55 stealth in water | 4 | multipliers ±0.05 |
| M56 the look, blind pair | 4 | region and sea separability; median rank ≥ half |

Score = sum of passed weights, 0–100.

- **≥ 90** — the marsh is a place with water in it.
- **75–89** — playable; gap named and remediable inside a wave.
- **< 75** — **we lose.**

**Automatic fail regardless of score:**

- **Any of M47's S24 bars missed.** A globally-swampy world fails this item outright, no matter how
  good the water is. This is the ruling, not a dimension.
- **Water implemented as a boolean** (`inWater`), or as a single global plane at one height.
- **A tidal amplitude anywhere outside the five tidal regions** — the tide as a global shader.
- **Any frame number that varies with depth** (S25 R1 / AR-1: this is Morrowind leakage into the
  fight, and it is the same class of violation as a to-hit roll).
- **A slip chance, a wet-footing roll, or any probabilistic term introduced by water** (S1).
- **A boss arena, fog-gated volume or scripted ambush above W2 at any tide state.**
- **Amphibious races indistinguishable from the rest** — `RI-CHR02` promises three privileges and a
  build that delivers none of them has silently deleted a race.
- **A depth meter, depth number, or "you are wading" HUD element.** §1's readout is the character's
  own silhouette (S18); a UI element instead of a body is AR-2.
- **A full-screen blue underwater filter.**

**Blind pair procedure:** hand the critic two depth-vs-speed curves and two 16-shot water sets with
no labels — one ours, one generated from §2 and from Morrowind captures — and ask which describes a
province and which describes an effect. If the critic picks ours, halve the tolerances and re-run.

## How we lose

Written pessimistically, in advance.

1. **Everything is swamp with a recoloured fog per region.** *The* failure mode, named by the user,
   ruled on by **S24**, and the reason M47 exists and carries the largest weight in the item. It is
   the path of least resistance for every asset pipeline and every builder under time pressure: one
   water material, one fog volume, thirteen tint values. `RI-WLD04`'s blind region test (≥ 33/39
   identifications, ≥ 6 of 9 axes differing per pair) is the enforcement and this item does not
   duplicate it — but M47 and M56 §3 are its two cheapest early-warning instruments, and both run
   long before there is a screenshot to judge.
2. **The world becomes a puddle.** The opposite failure, and just as bad: a builder reads "Black
   Marsh" and floods everything, the Clay Moor gains standing water, the Stone Wastes get a river,
   and the province loses its arid half. `WCI ≤ 0.05` in five named regions is the guard.
3. **Water as a boolean.** `if (y < waterLevel)` with a swim animation, one speed, and nothing else.
   Every number in this item collapses to two states and the marsh becomes a texture.
4. **One global water plane.** Cheap, correct-looking in screenshots, and it makes tide, region
   profiles, drowned Ayleid vaults, paddies and rock pools all impossible simultaneously.
5. **The tide ships as a shader.** `RI-WLD07:170` already predicts this for the Drowned Xanmeer and
   `RI-TRV01:497` for the tideway. It is the same failure and it will happen once for both: the
   water surface bobs, the *collision and the depth field do not move*, and the two most interesting
   routes in the province become ordinary. M54 tests the field, never the mesh.
6. **The roll still works at chest depth.** Nobody removes it, because removing a verb feels like
   taking something away. Then deep water is just slower ground, the escape-route design in R5 never
   materialises, and water never changes a single tactical decision.
7. **Frames scaled by depth.** The opposite temptation — "i-frames ×0.7 in water, it feels heavier".
   It does feel heavier. It also makes the dodge unlearnable, and it is an AR-1 automatic fail.
8. **Deep water as a wall.** An invisible collider at W4 so the player cannot swim anywhere
   interesting. Bloodmarl Isle becomes unreachable, `RI-TRV01`'s walked-it-once precondition becomes
   a formality, and the province's only open-water journey disappears.
9. **Amphibious races as flavour text.** The Argonian gets a green "Amphibious" line on the character
   sheet and identical gameplay. This deletes the largest race payoff in the corpus and it will pass
   every check except M51 §5, which exists solely for it.
10. **The breath meter as a stat check.** Flat HP drain, so a high-HP build ignores drowning and a
    low-HP build dies instantly. The 2%-of-max rule makes drowning cost the *same fraction* of
    everyone.
11. **`MIRED` as a soft-lock.** Escape too expensive, or escape while three enemies hit you and it is
    an unavoidable death. Three escapes at 25 stamina with poise intact is deliberately survivable;
    the *interesting* version is being mired with a rising tide, and that is why the drowning clause
    is in the state definition.
12. **Underwater as a blue filter.** The single laziest look in the medium, and it deletes the whole
    per-region `k` system in one post-process.
13. **Two seas rendered with one material.** Topal and Padomaic sharing a shader, a sound bed and a
    tidal range. S24 names them as *"two genuinely different waters"* and M56 §4 is the check.
14. **Water without sound.** The province is defined as much by lapping, suck, drip and surf as by
    any mesh, and audio is unreachable through the harness (`HARNESS.md` §3) — so this failure is
    **structurally invisible to every automated check in this item** and must be caught by a human.
    `RI-AUD03` owns it; this item flags it so nobody assumes M56 covers it.
15. **The calibration ramp is the only place the numbers hold.** M49 passes on a purpose-built slope
    and the shipped world's depth field is authored by hand, by eye, in a heightmap, with none of the
    band boundaries landing where §1 says. M48 exists for exactly this and is the check most likely
    to fail on a real build.

## Provenance note

**`constructed`, confidence high, and binding.** Almost every number here is ours, defined so it can
be measured exactly — which, per `CORPUS-CONTRACT` §3, beats a "real" number we cannot check.

What is **not** ours, and is cited rather than invented:

- **`community-data`, verified this session from the vendored UESP extract** (`tools/uesp/`,
  `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz`, 2019-11-07 dump):
  - *Morrowind:Argonian* — the racial package is **Water Breathing 120 s on self (cost 5), Resist
    Poison 100%, Resist Common Disease 75%, Athletics +15**, and Argonians wear no footwear. Our
    amphibious clause is **deliberately stronger** (unlimited, not 120 s) because `RI-CHR02` already
    committed to that; recorded as a divergence from Morrowind, not as a Morrowind fact.
  - *Morrowind:Water Breathing* — *"All creatures can breathe underwater by default. Only NPCs can
    drown."* We do **not** copy this: our `water_max_band` in §5 R5 is a per-archetype declaration,
    because Morrowind's rule exists to paper over pathfinding and produces guar walking along the
    seabed.
  - *Morrowind:Water Walking* — water-walking suppresses submersion entirely. `RI-MAG02` owns the
    effect; §1's field is what it has to switch off.
  - *Lore:Hallgerd's Tale* — *"He was drowned in the Sea of Ghosts because he couldn't get his armor
    off."* The `OVERLOADED` sink rule in §3 is canon-anchored on this line.
- **`community-data`, retrieved 2026-08-06**, [NWS *Turn Around Don't Drown*](https://www.weather.gov/safety/flood-turn-around-dont-drown)
  (fetched and read this session): *"A mere 6 inches of fast-moving flood water can knock over an
  adult."* 0.15 m is inside our **W1 FILM** band, which is why W1 is the loudest and most
  destabilising *shallow* state rather than a free surface — and why we do **not** model current
  forces as damage: our standing water has no current, and a corpus that claimed it did would be
  claiming a physics it cannot measure.
- **`community-data`, confidence medium**, retrieved 2026-08-06 as search-result summaries only —
  both publishers returned HTTP 403 to direct fetch, so these are **not** first-hand reads and must
  not be upgraded:
  - [Complex dynamics of single-file pedestrian flow under varying flood water depths](https://www.sciencedirect.com/science/article/abs/pii/S0960077925018193)
    — free pedestrian speed in flood water is reported **~51.6% lower** than on land. Our W4
    multiplier of **0.43** sits just below that, and our W3 of **0.65** just above it, which is the
    only external anchor the locomotion ladder has.
  - [An in-depth look at shallow-water walking (Pflügers Arch, 2025)](https://link.springer.com/article/10.1007/s00424-025-03130-3)
    — shallow-water walking measured at four immersion levels, **knee / thigh / waist / xiphoid**, at
    **0.2–0.8 m/s**; minimum cost of transport at hip depth; above knee depth *"the optimal speed is
    as slow as possible."* §1's band boundaries are placed on those four anatomical levels for this
    reason, and §2's W4 walk of **0.86 m/s** sits at the top of the range that study could measure a
    human sustaining.
  - [On the physical vulnerability of pedestrians in urban flooding](https://www.sciencedirect.com/science/article/abs/pii/S2212095523000147)
    — instability rises sharply with depth (reported +123.2% at 0.30 m walking against flow). Cited
    as the reason W3 denies the sprint and the roll rather than merely slowing them.
- **Cited from the corpus, not redefined here:** `world.walk_speed_mps` 2.0, `world.jog_speed_mps`
  3.2, `world.sprint_speed_mps` 5.0, `world.swim_speed_mps` 1.1, `world.tide_wade_speed_mps` 1.3
  (all `RI-WLD01` / `constants.json`); the 12-real-minute four-state moon-driven tide cycle
  (`RI-WLD08` §1); the four equip-load tiers and every roll frame number (`RI-CMB01`, seam S23); the
  stamina pool, cost table and 42-frame regen delay (`RI-CMB03`); the 13 regions, their areas, tiers
  and hazards (`regions.json`); the tideway inversion and Bloodmarl Isle's swim (`RI-TRV01`); the
  Drowned Xanmeer's tide gate and the 8/82 dungeon census (`RI-WLD07`, seam S16); the amphibious
  clause (`RI-CHR02`).
- **New constants owned by this item** and registered in `corpus/00-doctrine/constants.json`:
  `world.water_band_boundaries_m`, `world.tide_mean_range_m`, `world.water_coverage_index`,
  `world.breath_base_s`, `world.arena_max_water_band`.
- **Deliberately unphysical, declared:** a 12-minute tide is not a semidiurnal tide. Real tides run
  ~12 h 25 min; at `world.timescale` 20 ours would be ~37 real minutes. `RI-WLD08` owns the cycle and
  chose 12 minutes so that **a player can wait out a tide inside a single session** — a tide you
  cannot experience twice in one sitting is a loading screen with extra steps. The amplitude in §7 is
  ours and is tuned to the band widths in §1, not to any real coastline.
- **Unverifiable and correctly declared as such:** every extinction coefficient in §10, both seas'
  colour values, the substrate speed multipliers, the `MIRED` constants, and every detection
  multiplier in §6. No external analogue exists to check them against; they are binding because they
  are exactly measurable, not because they are true.
