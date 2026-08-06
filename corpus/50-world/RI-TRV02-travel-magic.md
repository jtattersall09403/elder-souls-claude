---
id: RI-TRV02
title: Travel magic — Mark, Recall, the two Interventions, and the S19 reconciliation
kind: structure
side: morrowind
judges: [world.traversal.transport, world.dungeon.design, progression.bonfire.function, combat.magic.casting, quests.resolution.noncombat, progression.gold.economy]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

S19 was amended in wave 0 because its original wording banned utility magic from being a teleport
network, which contradicted S7. The reconciled ruling is precise and this item is its implementation:
**Mark/Recall and Intervention are part of the S7 travel network and obey its rules** — known places
only, above ground, out of combat, never into or within a dungeon, boss arena or locked area — and what
is forbidden is **teleport as a level-design solvent**: no recall out of a fight, no warping past a
shortcut you have not opened, no intervention as an escape button.

Two failures sit on either side of that sentence and the corpus currently only detects one of them.

The detected one is the solvent. It is real, it is what every check in `corpus/` is pointed at, and it
kills the Souls half of the game: a player who can leave a boss arena at 10% health has deleted the
encounter, and a player who can Recall past the drain in Blackrose Prison has deleted the loop that
`RI-WLD07` spent 18 shortcuts building. **Teleport is the only mechanic in this project capable of
invalidating level design from outside it**, and the detector for it must be a *reachability proof*, not
a list of banned situations.

The undetected one is that **the spells never get built at all**, and every check we ship reports
success. `RI-PRG04:255` scores its S7 axis with **10 = "no warp code path exists"**. Grep the corpus for
teleport and you find prohibitions; you find nothing that fails when a player finishes the game having
never once cast Recall because Recall does not exist. Morrowind's Mark and Recall are not a convenience
bolted onto its world — they are a *build*: the reason to carry a spell you rarely cast, the reason
Mysticism is a school, and the reason a merchant three towns away is a viable shop. Deleting them
deletes a route through the game.

So: four spells, exactly twelve possible destinations in the entire world, **at most three of them
available at any instant, and not one of them chosen from a list**. Bought with gold at `RI-PRG05`
prices, cast as an animated committed action, costing magicka, twenty in-world minutes and a quarter of
your Fatigue — the same arrival tax `RI-TRV01` charges root-speaking, because a spell that moves you is
a travel service and is priced like one. Every check below is written as a **pair**: one assertion that
fires when the spells are absent or inert, one that fires when they have become a warp.

## The reference artifact

### 1. The four spells

**Division of ownership, agreed with `RI-MAG02`:** that item owns the **effect records, the Focus costs
and the cast class**; this item owns the **network rules, the placement predicate and the
teleport-as-solvent detector**. Nothing below re-authors a number `RI-MAG02` already publishes; where
this item states one, it is quoting `corpus/25-magic/data/effects.json`.

| Spell (`effects.json` id) | Jel name | School | Min tier / skill | Gold (`RI-PRG05` §2) | Cast | Effect |
|---|---|---|---|---:|---|---|
| **`mark`** | *Setting the Knot* | Warding | **3** · Warding ≥ 45 | **3,400** | `RITUAL`, 210 f | Sets **the** anchor at your feet. There is one, game-wide. Setting a new one erases the old. |
| **`recall`** | *Pulling the Knot* | Warding | **3** · Warding ≥ 45 | **3,400** | `RITUAL`, 210 f | Moves you to your Mark. Destination count: **1**. |
| **`intervention_root`** | *Asking the Nearest Root* | Warding | **2** · Warding ≥ 25 | **900** | `RITUAL`, 210 f | Moves you to the **nearest discovered rootkeeper's shrine** — one of the 8 settlement shrines. Computed, never chosen. |
| **`intervention_imperial`** | *Asking the Chapel* | Warding | **2** · Warding ≥ 25 | **900** | `RITUAL`, 210 f | Moves you to the **nearest discovered Nine Divines chapel** — Stormhold, Gideon or Blackrose only. Computed, never chosen. |

**Cost is Focus (`vei-jul`), and it is computed at cast time, never authored** (`RI-MAG02` §G). The
magnitude of `recall` *is* the straight-line distance to your Mark in hundreds of metres; `intervention`
uses the same rule against the nearest qualifying site.

| Distance to destination | `focus_base` | As a fraction of a WIL-30 pool (94) |
|---:|---:|---:|
| 500 m | 6 | 6% |
| 1.5 km | 26 | 28% |
| 3 km | 57 | 61% |
| 4 km (map diagonal) | 77 | 82% |

**Focus never regenerates** — not by potion, not by time, not by gold; only a HEARTH rest refills it
(`RI-MAG01` §A). Those two facts together give travel magic a **diegetic range limit that nobody had to
draw on a map**: you cannot Recall from further than your Focus reaches, and the only way to get more
Focus is the rest you were trying to avoid. It also inverts the escape-button shape exactly — an
Intervention is cheap when you are near help and unaffordable in the Deep Marshes, which is where you
would want an escape button and is precisely where you cannot have one.

**Total gold to own all four: 8,600 g** — 24% of `RI-PRG05`'s entire 35,900 g lifetime discretionary
budget. Against its §5 running balance (R1 580 · R2 2,960 · R3 5,900 · R4 11,800 · R5 23,000) the
intended arc is: **one Intervention in R3** (900 g, a real sacrifice against a trainer), and the
**Mark/Recall pair not before R5** (6,800 g, one of the largest single commitments in the game, and it
costs you a weapon line or the land grant). Travel magic is not a convenience you pick up; it is a build
you commit to, gated on Warding 45 as well as on gold.

**Casting is animated and committed even outside the fight** (S19's first half, applied consistently).
`RITUAL` class: **210 frames, zero hyperarmour, zero movement, and the cast aborts on any damage, on
entering `COMBAT`, and on any movement input** — with Focus refunded, the only refund in the magic area
(`RI-MAG01` §B). This is why "no recall out of a fight" is largely a consequence of the clock rather
than a rule someone must remember to write. **Largely, not entirely** — see G3.

### 2. The twelve destinations, and why twelve is the whole point

| Destination class | Count | How it is chosen |
|---|---:|---|
| The Mark anchor | **1** | You stood there and cast `mark`. |
| Rootkeeper's shrines (the 8 settlement shrines) | **8**, minus undiscovered | Nearest discovered. Computed. |
| Nine Divines chapels (Stormhold, Gideon, Blackrose) | **3**, minus undiscovered | Nearest discovered. Computed. |
| **Universe** | **12** | |
| **Available at any single instant** | **3** | `recall`, `intervention_root`, `intervention_imperial` — each with exactly one determined destination. |

> **This is the measurable difference between our travel magic and warp-to-map-pin.** A map-pin system
> offers *n* destinations chosen from a list, where *n* grows with play. Ours offers three spells whose
> destinations are each computed or self-set, and **no spell in the game ever opens a destination
> picker**. If a picker appears, the spell has become a map screen and it does not matter what the icon
> looks like.

The two Intervention destination sets exist to be *different*. Standing on the Clay Moor track between
Archon and Thorn, `intervention_root` takes you back to Archon and `intervention_imperial` takes you to
Stormhold, which is an hour the other way — and because cost scales with distance to the destination,
they cost different amounts of Focus from the same spot. Choosing which one to carry is a reading of the
map and a faction statement (`RI-MAG02` §G). A build that ships one Intervention, or two that always
resolve to the same place, has shipped one spell twice.

### 3. The five gates

Every gate applies to **all four spells**. Refusal is diegetic (a line, a failed gesture), spends no
Focus, and writes a `spell_refused` trace event with a `reason`. This is the **placement predicate**
that `RI-MAG02`'s effect records defer to by name.

| # | Gate | Exact condition |
|---|---|---|
| **G1** | **Known places only** | `recall` requires an existing Mark. An Intervention resolves over **discovered** shrines/chapels only; with none discovered it **fizzles** and says so. There is no spell that reaches a place you have not been. |
| **G2** | **Above ground** | The caster must be in an exterior cell **and** have unobstructed sky within 60 m on a vertical raycast. `mark`'s *anchor* must satisfy the same test at the moment of setting. |
| **G3** | **Out of combat — and this gate is not redundant** | `RI-MAG01`'s `RITUAL` clock aborts the cast on damage, on entering `COMBAT`, and on any movement input, which closes the case at melee range by construction. **It has a hole at long range:** a hostile in `alert_state: AGGRO` 200 m away, or one that leashed but has not de-aggroed, leaves the player free to stand still for 210 frames and complete the cast — while `ARBITRATION.md` §1 says the fight is still on. G3 closes it: **no hostile anywhere in the loaded scene may be in `alert_state ∈ {AGGRO, SEARCH}` with the player as `target`, and ≥ 300 frames (5 s) must have elapsed since the last combat event.** A de-aggro gate, never a distance gate. |
| **G4** | **Never into or within a dungeon, boss arena or locked area** | Neither the caster's position nor the destination may be inside a volume tagged `dungeon`, `boss_arena`, `interior` or `locked`. `mark` **cannot be set** inside such a volume, so no re-entry anchor can ever exist. |
| **G5** | **One anchor, no lists** | Exactly one Mark exists at a time, game-wide. No spell presents a destination menu. |

**Arrival tax: the game clock advances 20 in-world minutes**, the same as root-speaking in `RI-TRV01`
§2. That is what makes travel magic a *member* of the travel network rather than an exception to it —
every mode in this game advances the world while it moves you. The Fatigue penalty that root-speaking
also carries is **deliberately not applied here**, because Focus does not regenerate (`RI-MAG01` §A) and
double-taxing a spell that already costs an expedition's ammunition would make Recall strictly worse
than walking.

**Arrival geometry, identical to `RI-TRV01` §6**: you arrive at the shrine's or the Mark's marker,
standing, on foot, and **never within 25 m of a live quest objective**.

**A teleport arrival never sets `legs_walked`.** This is the seam between the two items: if Recall could
unlock a travel leg, the walked-it-once rule (`RI-TRV01` §7) would be laundered through the spellbook,
and a single scripted quest teleport would open the network. `RI-TRV01` M4 sub-check 3 and D6 below test
the same wall from opposite sides.

### 4. What the spells are *for* (S19's positive half)

S19 makes utility magic "a legitimate route through the world" and a load-bearing part of the ≥45%
non-combat resolution bar. Travel magic's specific contributions:

- **The merchant three towns away becomes your merchant.** Mark at Lilmoth's pawnbroker, adventure, sell
  at the ceiling multiplier, Recall out. The Fence build (`RI-PRG05` §3) gains a second engine.
- **The overloaded return.** Encumbrance (`RI-PRG07`) makes a full pack a walking penalty. Recall is the
  answer that costs 900 g and 45% of a pool, which is why Strength is still worth having.
- **The escape that is not an escape.** Intervention gets you out of a *region*, never out of a *fight*.
  It is the correct answer to marsh-fever fog, a lost night on a trail, a disease you must cure in a
  town — never to a boss.
- **A quest route.** At least four shipped quests must be resolvable by placing a Mark before an event
  and Recalling into its aftermath, or by using an Intervention to make a timed delivery. Those quests
  are the reason a non-combat player buys these spells.

## Comparison method

Every check is a **pair**. `N-fail` fires when the spells are missing or inert. `W-fail` fires when they
have degenerated into warp-to-map-pin or into a level-design solvent. **A one-directional check is not
admissible here** — the absence of casting is not evidence of correctness, and a verdict that reads "no
teleport-past-shortcut found" on a build with no teleport at all has scored 0 as 10 and is void.

Static root: `game/data/spells/*.json`, `game/data/world/dungeons/*.json` (nav graph + shortcut edges),
`game/data/world/travel/stations.json`. Live: `tools/harness/run-headless.mjs` with the scenarios named,
reading `elder-souls/trace@1`.

---

### Positive tests — do the spells exist and work?

**P1 — The catalogue (static).** Load `game/data/spells/` and `corpus/25-magic/data/effects.json`.
- **Assert** the four ids `mark`, `recall`, `intervention_root`, `intervention_imperial` exist, each with
  a computed Focus cost, `class: "RITUAL"`, a 210-frame cast, a min tier, and a gold price.
- **Assert** gold prices are **3,400 / 3,400 / 900 / 900**, i.e. `RI-PRG05` §2's tier-3 and tier-2 spell
  prices at the min tiers `RI-MAG02` declares (3 / 3 / 2 / 2).
- **Assert** each is stocked by **≥ 3 distinct vendors** in **≥ 2 distinct settlements**.
- **Assert** the shipped records match `effects.json` field for field (weight 3.0 / 9.0 / 5.0, school
  Warding, range `self`, `in_fight: false`).
- **N-fail:** fewer than four spells, **or** any missing from every vendor inventory — a spell nobody
  sells does not exist. Score **0, fail-closed**.
- **W-fail:** a fifth teleport spell, **or** any spell whose destination field is a list, a map pin, a
  quest id, a POI id, or a region centroid.

**P2 — Mark → Recall round trip (live).** Scenario `trv-mark-recall`, fixed seed.
Buy `mark` and `recall`. Stand at Helstrom's north gate, exterior, no hostiles, Warding ≥ 45. Cast
`mark`. Record `pos_mark`. Walk (scripted, not teleported) to Rootway Post, ~840 m. Cast `recall`.
- **Assert** a `mark_set` event and a `teleport{spell:"recall"}` event appear in the trace.
- **Assert** final `player.pos` is within **5 m** of `pos_mark`.
- **Assert** `player.focus` fell by the **computed** cost — for 840 m, `focus_base` ≈ 10 — and
  **assert** the same recall from 3 km away costs ≈ 57, i.e. that the cost is a function of distance and
  not a constant. A constant-cost Recall is an authored magnitude and fails `RI-MAG02` §G.
- **Assert** the game clock advanced by **20 in-world minutes**.
- **Assert** the cast occupied **210 frames** with `player.state == "CAST"` throughout, zero movement,
  and no cancel.
- **N-fail:** any assertion fails, **or** the cast is refused in this clean situation. A spell that is
  always refused is a spell that does not exist. **This is the single most important check in the item**
  and it must be run first, because it is the one the corpus has never had.
- **W-fail:** the clock does not advance, **or** the cast completes in < 100 frames, **or** the cost is
  distance-independent, **or** `recall` succeeds without a Mark having been set.

**P3 — Intervention resolves to the nearest *discovered* (live).** Scenario `trv-intervention`.
- With **zero** shrines discovered, cast `intervention_root`. **Assert it fizzles**, spends no Focus, and
  writes `spell_refused{reason:"nothing known"}`.
- Discover Gideon only. Cast from a point nearer to Helstrom's shrine than to Gideon's.
  **Assert arrival at Gideon**, not Helstrom.
- Then discover Helstrom and repeat. **Assert arrival at Helstrom.**
- **N-fail:** the spell never resolves anywhere, or always fizzles.
- **W-fail:** arrival at an *undiscovered* shrine — the spell reaches a place you have never been, which
  is the exact clause S7 forbids. **Hard fail.**

**P4 — The two Interventions are two spells (live).** From a fixed point on the Clay Moor track between
Archon and Thorn, with all shrines and posts discovered, cast each.
- **Assert** the two destinations are **different**, and ≥ 1,500 m apart.
- **N-fail / W-fail (same assertion, both directions):** identical destinations means either only one
  destination set was implemented (absence) or both spells were collapsed into "nearest safe place"
  (a generic warp). Either way the choice S19 asks for is gone.

**P5 — Affordability (static).** Sum the four gold prices against `RI-PRG05` §5's running balance.
- **Assert** 2,240 g is **not** affordable at the R2 balance (2,960 g) alongside that region's necessary
  spend, **and is** affordable by R4 (11,800 g).
- **W-fail:** total < 600 g — travel magic bought in the first hour trivialises the R1–R3 poverty arc and
  short-circuits `RI-TRV01`'s network before the player has walked a single leg.

**P6 — The spells are a route through the world (static).** Scan `game/data/quests/`.
- **Assert ≥ 4 quests** declare a resolution path that uses Mark/Recall or an Intervention.
- **N-fail:** zero — the spells exist and nothing in the game is designed around them, so they are a
  convenience, not a build, and S19's "legitimate route through the world" is unmet.

---

### Solvent detectors — has teleport become a level-design solvent?

**D1 — Recall out of a fight (live).** Scenario `trv-combat-gate`.
1. Aggro an enemy (`aggro(eid)`), stand at 6 m, cast Recall. **Assert refused**, `reason:"in combat"`,
   zero magicka spent, `player.pos` unchanged.
2. Sprint to **60 m** while the enemy remains `alert_state:"AGGRO"` targeting the player. Cast again.
   **Assert still refused.** This is the sub-check that separates a de-aggro gate from a distance gate,
   and a naive implementation passes step 1 and fails step 2.
3. Break line of sight, wait for `alert_state:"IDLE"`, wait 300 frames, cast. **Assert it now succeeds.**
- **N-fail:** step 3 fails — the gate is a wall and the spell is unusable.
- **W-fail:** step 1 or 2 succeeds. **Hard fail.**
- Additionally scan **every** trace produced anywhere in the wave: **assert zero `teleport` events occur
  within 300 frames of any `attack_start`, `hit`, `stagger` or `enemy_state{AGGRO}` event.**

**D2 — Warping past an unopened shortcut (static, and this is the strong one).**
Build the world navigation graph from `game/data/world/**` with **all 18 loop-dungeon shortcut edges
closed** and **all locked doors locked** — the same graph `RI-WLD07` method step 1 already constructs.
Let `R` be the set of positions reachable on foot from the world start point in that graph.
- **Assert every one of the 12 teleport destinations lies in `R`.**
- **Assert** the Mark anchor cannot be set outside `R` — i.e. Mark is refused inside every `dungeon`,
  `boss_arena`, `interior` and `locked` volume, tested at one sample point per volume across all 8 loop
  dungeons and all 82 caves.
- **N-fail:** the graph cannot be built, or no dungeon declares shortcut edges — then `RI-WLD07` is
  unmeasurable too and both items score 0.
- **W-fail:** any destination outside `R`. **Hard fail.** A destination reachable only through a closed
  gate means teleport is a bypass, and no amount of situational rules fixes it — it is a topology fact.
- Live confirmation: enter Blackrose Prison stratum 3 with all three shortcuts unopened and cast each of
  the four spells. **Assert all four refused.** Exit to the courtyard and cast. **Assert all succeed.**

**D3 — Intervention as an escape button (live).** Scenario `trv-escape-button`.
- Reduce the player to 25% HP with a hostile at 15 m in AGGRO. Cast Imperial Intervention.
  **Assert refused.**
- Repeat at 5% HP. **Assert refused.** Repeat inside a boss arena at any HP. **Assert refused.**
- **W-fail:** any success. **Hard fail** — this is the failure that deletes the Souls half of the game.
- **N-fail:** paired with D1 step 3; if the spell is refused everywhere including the clean case, it is
  inert.

**D4 — No destination picker (static + live).**
- **Assert** no UI state in the shipped build presents a list of teleport destinations. Grep `game/data/ui/`
  and the spell records for `destinations`, `destination_list`, `pins`, `markers`, `travel_menu`.
- Live: cast each spell 10 times from 10 positions. **Assert** the destination is fully determined by
  position and discovery state — the same input yields the same output, and no input is ever solicited.
- **W-fail:** a picker exists, or the destination varies with a player choice. **Hard fail.** This is
  warp-to-map-pin, whatever it is called.

**D5 — Teleport is not a HEARTH and a HEARTH is not a teleport (static + live).**
- **Assert** no spell's destination set contains a HEARTH shrine.
- **Assert** the HEARTH interaction exposes zero destinations (retaining `RI-PRG04` method 2 unchanged).
- **Assert** every teleport destination is ≥ **60 m** from the nearest HEARTH, matching `RI-TRV01` M9.
- **W-fail:** any overlap. S7 says HEARTHs are not part of the travel network and this is the clause that
  will be violated first, because it looks like a convenience and reads like a bugfix.

**D6 — Teleport does not launder the walked-it-once rule (live).**
- Fresh save. Harness-teleport the player to Lilmoth to simulate a scripted quest cutscene, then cast
  Mark and Recall around Lilmoth.
- **Assert** `getTravelState().legs_walked` is still empty and **assert** no Lilmoth service became
  purchasable.
- **W-fail:** any leg unlocked by a teleport arrival. This is `RI-TRV01`'s gate being bypassed through
  this item, and it is the kind of failure that only shows up when the two systems are tested together.

**D7 — Death and souls (live).** Die with souls held, Recall away before the corpse run, then return.
- **Assert** the soul stain remained at the death position (S6, `RI-PRG04`) and was not carried,
  duplicated or destroyed by the teleport.

## Scoring

Native scale: **13 checks (P1–P6, D1–D7), each 2 / 1 / 0** — both directions pass / one marginal /
either direction fails. Maximum **26**.

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| **P1 Catalogue** | 4 spells, prices exact, ≥3 vendors each | 4 spells, ≥2 vendors | fewer than 4 ⇒ **0, fail-closed** · a fifth teleport spell or a list-destination ⇒ **hard fail** |
| **P2 Round trip** | all six assertions pass | arrival + magicka + clock pass | Recall refused in the clean case ⇒ **hard fail (absence)** · instant/free/clock-less ⇒ **hard fail (warp)** |
| **P3 Intervention discovery** | fizzle, then correct nearest, twice | correct nearest | arrival at an undiscovered shrine ⇒ **hard fail** |
| **P4 Two Interventions** | destinations ≥1,500 m apart | destinations differ | identical destinations |
| **P5 Affordability** | unaffordable ≤R2, affordable by R4 | affordable by R5 | total < 600 g |
| **P6 Quest routes** | ≥6 quests | ≥4 quests | 0 |
| **D1 Combat gate** | steps 1–3 all correct, zero wave-wide violations | steps 1 and 3 | any cast during AGGRO ⇒ **hard fail** |
| **D2 Shortcut solvent** | all 12 destinations in `R`, Mark refused in 90/90 volumes | all 12 in `R` | any destination outside `R` ⇒ **hard fail** |
| **D3 Escape button** | refused at 25%, 5%, and in-arena | refused at 5% and in-arena | any success ⇒ **hard fail** |
| **D4 No picker** | no picker, determinism verified over 40 casts | no picker | a picker exists ⇒ **hard fail (AR-2)** |
| **D5 HEARTH separation** | ≥60 m, zero overlap, HEARTH menu empty | zero overlap | any HEARTH destination ⇒ **hard fail** |
| **D6 No laundering** | legs_walked untouched, no service unlocked | legs_walked untouched | any leg unlocked by teleport |
| **D7 Souls** | stain persists at death position | stain persists | souls carried or destroyed |

**Failure thresholds.** Native < 16/26 ⇒ *below bar, named remedy required* (ladder ceiling 6).
Native < 10/26 ⇒ *loses outright* (ceiling 4). **Any hard fail caps the item at 2.**

**And the rule that this item exists to install:** a verdict may not report a pass on D1–D7 unless P1 and
P2 also passed. **Absence cannot score as compliance.** If the spells do not exist, the correct native
score is **0**, not 14/26 for seven solvent detectors that had nothing to detect.

## How we lose

- **The spells are never built, and the corpus congratulates us.** `RI-PRG04:255` awards its top S7 score
  to "no warp code path exists". Grep for teleport in `game/src/`, find zero hits, pass. This is not a
  hypothetical: it is the current, shipped, one-directional shape of the checks, and P1/P2's N-fail is
  the only thing that changes it. Expect the first verdict written against this item to try to score D1–D7
  as passes on a build with no spellbook.
- **Recall becomes an escape button in the first bugfix.** The combat gate is implemented as "is the
  player in the COMBAT state", the player runs 40 m, the state clears, and Recall fires with a wamasu
  ten seconds behind them. Every Souls encounter in the game now has a free exit. D1 step 2 is the only
  check that catches it and it is the one that looks redundant.
- **Mark gets allowed inside dungeons "because it's the player's choice".** It is not a choice; it is a
  re-entry warp. Mark at the bottom of Blackrose Prison, die, Recall in, and the five strata, three
  shortcuts and one boss between the entrance and that spot have been deleted permanently. D2's static
  reachability proof is the only defence that does not depend on someone anticipating the specific route.
- **A destination picker appears.** It starts as "Recall to your Mark — or your house". Then houses are
  properties (`RI-PRG05` has three), then guild halls, and within one wave Recall is a map screen with
  four pins. Nothing about the icon or the animation changes; the system has silently become the thing
  S7 bans. D4 is a cheap check and it will be the first one skipped.
- **Intervention resolves to the nearest shrine rather than the nearest *discovered* shrine.** A one-word
  difference, invisible in play until a player teleports into a region they have never seen, at which
  point S7's "travelling to somewhere you have never been" has been violated by a spell that looked
  correct in every other respect. P3.
- **The arrival tax gets cut.** Twenty in-world minutes and 25% Fatigue read as friction with no fun in
  them, and someone removes them for feel. Travel magic is now strictly better than every mode in
  `RI-TRV01` — free, instant, no station, no schedule, no tide — and the 68-service network it was
  supposed to belong to becomes the slow, expensive option nobody takes. **This is how the two items kill
  each other**, and it does not trip a single anti-warp check.
- **Magicka costs get tuned down** until Recall is castable four times without recovery, at which point
  the spell is a movement ability and the map is a hub-and-spoke.
- **The 180-frame committed cast becomes instant out of combat.** "It's not a fight, why animate it?"
  Because the commitment is what makes the combat gate redundant rather than load-bearing, and because
  S19 owns casting *everywhere*, not only inside the fight.
- **The two Interventions are merged.** One "Return" spell that goes to the nearest safe place. Cheaper
  to build, half the content, and it deletes the only navigational decision the spellbook contains.
- **D2 is run only against the 8 loop dungeons.** The 82 caves have locked doors and hand-placed named
  loot (`RI-WLD07` §3, S12). A Mark set behind a lock in a cave is a smaller version of the same exploit,
  and the sample must be 90 volumes, not 8.
- **Everything passes and nobody ever casts Recall**, because it costs 900 g in an economy where 900 g is
  a weapon upgrade and the network in `RI-TRV01` is cheaper for every journey a real player actually
  makes. That is a balance failure this item cannot detect on its own; it needs `RI-EXP01`'s playthrough
  data, and P6 is the closest proxy we have.

## Provenance note

**`constructed`, confidence `medium`.**

**Recalled, and labelled as such** (`canonical-recall`, confidence medium): the *shapes* of Mark, Recall
and Intervention are Morrowind's — Mark sets a single anchor, Recall returns to it, and Morrowind
shipped two Intervention effects with two different destination sets (Almsivi to the nearest Tribunal
temple, Divine to the nearest Imperial cult shrine) so that choosing between them was a map decision.
**No number from Morrowind is used here.** Its magicka costs, its spell prices, its Mysticism
requirements and its destination lists are all deliberately not carried over, because they belong to a
different economy.

**Derived from this corpus** (high confidence): the gold prices are `RI-PRG05` §2's tier-1 and tier-2
spell prices, unchanged; the affordability windows are its §5 running balance; the 8 Hist-shrine and 3
Legion-post destination sets come from `RI-WLD03`'s service table and `RI-LOR02` §4; the combat-end
definition (all hostiles dead, dormant or de-aggroed for > 5 s) is `ARBITRATION.md` §1 verbatim; the
18 shortcut edges, 8 loop dungeons and 82 caves in D2 are `RI-WLD07` §§2–3; the 20-minute / 25%-Fatigue
arrival tax is `RI-TRV01` §2's root-speaking cost, applied identically so that travel magic sits inside
the network rather than beside it.

**Constructed and binding** (ours, and just as binding): the four-spell catalogue and its Jel names; the
twelve-destination universe and the three-at-any-instant rule; the five gates and their exact
thresholds (60 m sky raycast, 300-frame de-aggro window, 25 m objective clearance, 60 m HEARTH
separation); the 180-frame committed cast; the fraction-of-pool magicka costs; and every scoring
threshold above.

**The known soft spot** is magicka. `corpus/25-magic/` is empty, no item defines the pool or its growth,
and `subsystems.json` has no `magic.*` root at all — only `combat.magic.casting`. The absolute magicka
numbers here are a budget, not a measurement, and P2 currently asserts only that magicka *decreases* by
the declared amount rather than that the amount is right. When the magic owner lands, re-fit the three
costs to the real pool, keep the ratios (Recall ≈ 2 × Mark ≈ 1.5 × Intervention), and re-run P2.

**One structural request, recorded here so it is not lost:** the harness has no way to cast a spell. The
closed button set (`HARNESS.md` §4) has no `cast`, and `queueInputs` is the only input path. Every live
check in this item is unrunnable until that is amended; until then this item scores **0,
fail-closed**, which is the correct outcome and not a loophole.
