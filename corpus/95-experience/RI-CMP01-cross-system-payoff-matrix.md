---
id: RI-CMP01
title: The cross-system payoff matrix — the seam-sterility floor
kind: structure
side: neutral
judges: [composition.matrix.coverage, composition.seam.crossings, coherence.systems.composition]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

`ARBITRATION.md` §3 carries three checks. `AR-1` and `AR-2` are **leakage** detectors: they fire when
Souls contaminates the world or Morrowind contaminates the fight. Both are excellent. Both are
asymmetric, and neither of them ever asks whether the two halves **touch**.

`AR-3` asks it, and `AR-3` ends by deferring: *"the project-level floor in `RI-CMP01` (cross-system
payoff matrix) governs how many such pieces are tolerable."* **This item is that floor.**

The failure it exists for is precise. Read the nineteen seam rulings as a set and they are a
membrane: `S13` locks the topic list out of combat, `S14` forbids the pause, `S4` splits fatigue from
stamina and forbids them to interact, `RI-PRG07` makes it an automatic `AR-1` fail if inventory Burden
affects the roll by any amount, `RI-PRG03` makes it an automatic fail if any skill is read during hit
resolution. Every ruling is individually correct. Their sum is a game that can pass every item in this
corpus and be **two products stapled together**: a competent Souls arena bolted to a competent
Morrowind world, sharing a save file and nothing else. Eighteen hours of investment change nothing in
the ten seconds when it matters, and the ten seconds change nothing about the world you walk back
into.

The best moments in both reference games are membrane crossings. Levitating out of a fight.
Paralysing a guard. Talking an Ordinator down. A Restore Health potion brewed twenty hours earlier
deciding a fight. Luring a knight off a ledge. The plunging attack from the ladder. Opening a shortcut
*because* you learned the level while dying in it.

> One sentence a builder can aim at: **name the thing the player invested in outside the fight that
> changes what happens inside one, and the thing that happened inside the fight that changes the
> world outside it — then make a harness probe watch both of them fire.**

**The instrument's hardest rule, stated first because it is the one that will be argued with:**
a cell that cannot be demonstrated firing in a trace scores **zero**. Paper interactions are the easy
fake and they are what an under-pressure wave will produce — a beautiful matrix, a data file full of
conditions, and nothing in the game that a player could ever observe.

---

## The reference artifact

### A. The nineteen systems

| Code | System | Side | What "the state" is |
|---|---|---|---|
| `FAC` | faction rank and standing | world | rank per faction, expulsion state, rival standing |
| `DIS` | disposition | world | per-NPC disposition, derived (`RI-DLG04`) |
| `GLD` | gold | world | holdings, merchant pools (`S15`: the only currency) |
| `SKL` | skills | both | skill values, grown by use (`S3`) |
| `SPL` | spells and magic effects | both | known spells, active effects, enchantments (`S19`) |
| `LOR` | lore knowledge | world | `topicsKnown[]`, books read, secrets |
| `STL` | stealth and crime | both | detection state, bounty, witnesses, stolen flags |
| `QST` | quest state | world | stages, outcomes taken, branches closed |
| `WLD` | world state | world | world flags: places changed, people dead, things burned |
| `TOD` | time of day | world | the clock |
| `WEA` | weather and tide | world | weather state, the 12-minute tide (`RI-WLD05` #21) |
| `EQP` | equipment | both | worn and carried, encumbrance (`RI-PRG07`) |
| `LVL` | character level | both | souls-bought levels (`S2`) |
| `UPG` | upgrade tier | both | weapon +N, the 84-material budget (`RI-PRG08`) |
| `ROS` | enemy roster | **fight** | what is present, patrolling, and hostile, and where |
| `BOS` | bosses | **fight** | boss presence, phase set, escort, arena state |
| `DUN` | dungeon layout | both | routes, shortcuts, doors, arena geometry (`S16`) |
| `SCH` | NPC schedules | world | who is where, when (`RI-WLD08`) |
| `JRN` | journal state | world | entries written and read (`S8`, `RI-DLG05`) |

**Seam definition (binding).** A cell is **seam-crossing** if it has one of two shapes:

- **W→F** — the source is state accumulated *outside* the fight and the target is `ROS`, `BOS`, or
  `DUN`-as-arena: an out-of-fight investment changing what happens inside a fight.
- **F→W** — the source is `ROS` or `BOS` (a fight outcome) and the target is any world-side system
  beyond souls and corpses: a fight outcome changing the world.

`AR-3`'s sentence is exactly the negation of both shapes, so this definition is not a new bar; it is
`AR-3` made countable.

### B. The matrix

Rows are the **source** (the state that exists). Columns are the **target** (what changes).
`/` diagonal (intra-system; owned by that system's own reference items) ·
`.` none · `t` trivial (scores 0) · `m` mechanical · `S` structural ·
**`M` mechanical + seam-crossing** · **`T` structural + seam-crossing**.

| ↓src \ tgt→ |FAC|DIS|GLD|SKL|SPL|LOR|STL|QST|WLD|TOD|WEA|EQP|LVL|UPG|ROS|BOS|DUN|SCH|JRN|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **FAC** |/|m|m|.|m|m|m|S|m|.|.|m|.|m|**M**|**M**|m|m|t|
| **DIS** |m|/|**S**|.|m|m|m|**S**|m|.|.|m|.|m|**M**|**M**|.|m|t|
| **GLD** |m|m|/|m|m|m|m|m|m|.|.|m|.|m|**M**|**M**|.|m|t|
| **SKL** |**S**|m|m|/|m|m|m|**S**|m|.|.|m|.|.|**M**|**M**|m|.|t|
| **SPL** |m|m|m|m|/|m|m|**S**|**S**|.|m|m|.|.|**M**|**M**|**M**|.|t|
| **LOR** |m|m|m|.|m|/|m|**S**|**S**|m|m|m|.|m|**M**|**M**|m|m|t|
| **STL** |**S**|m|m|.|.|m|/|**S**|m|.|.|m|.|m|**M**|**M**|m|m|t|
| **QST** |**S**|m|m|.|m|m|m|/|**S**|.|m|m|.|m|**M**|**M**|m|m|m|
| **WLD** |m|m|m|.|.|m|m|**S**|/|.|m|m|.|m|**M**|**M**|m|**S**|t|
| **TOD** |.|m|m|.|.|m|**S**|m|m|/|m|.|.|.|**M**|**M**|m|**S**|t|
| **WEA** |.|m|m|.|m|.|m|m|**S**|.|/|m|.|.|**M**|**M**|m|m|t|
| **EQP** |m|m|m|.|m|.|m|m|m|.|m|/|.|m|**M**|**M**|m|.|t|
| **LVL** |.|.|.|.|m|.|.|.|.|.|.|m|/|.|**·**|**·**|.|.|.|
| **UPG** |.|.|m|.|.|.|.|.|.|.|.|m|.|/|**·**|**M**|.|.|.|
| **ROS** |**M**|**M**|m|m|.|m|.|**M**|**M**|.|.|m|m|m|/|m|.|**M**|t|
| **BOS** |**T**|**M**|m|.|m|**M**|.|**T**|**T**|.|m|m|m|m|m|/|m|**M**|m|
| **DUN** |.|.|.|.|.|m|m|m|m|.|.|.|.|.|**M**|**M**|/|.|t|
| **SCH** |m|m|m|m|.|m|**S**|m|m|.|.|.|.|m|**M**|**M**|.|/|t|
| **JRN** |.|.|.|.|.|m|.|m|m|.|.|.|.|.|.|**t**|m|m|/|

**Declared totals** (342 off-diagonal ordered pairs): **206 non-`none`** = **60.2%** ·
`m` 146 · `S` 19 · `M` 38 · `T` 3 · trivial 15 · none 121.
**Seam-crossing (`M`+`T`) = 41.** **Structural (`S`+`T`) = 22.** Declared matrix score **297**.

**The crossings split 30 W→F / 11 F→W**, and that ratio is a declared *deficit* — see §H. Direction is
computed from §A's definition by the tooling, never from which table in §D a cell is printed under.

`RI-CMP01.cells.json` is generated from this table and §D–§F by
`tools/composition/cells-from-md.mjs`, so the grid, the register and the probe suite cannot drift.

### C. The tiers and the counting rule

| Tier | Test | Points | Example |
|---|---|---|---|
| **trivial** | The interaction is **only** informational: something is *said about* something else, and nothing observable changes. | **0** | An NPC mentions a boss. The journal names a boss. A rumour describes the weather. |
| **mechanical** | A specific, observable state change: a number moves, an option appears, a gate opens, a behaviour switches. | **1** | Faction rank changes patrol aggro. A book reveals a boss's weakness. Disposition opens a door that is otherwise a fight. |
| **structural** | The interaction changes **which shape the game takes** for hours afterwards: a questline resolvable by combat *or* politics with different world outcomes; a system that reorganises another system's availability. | **3** | Killing vs sparing a boss reshapes a faction's leadership and its whole line. Disposition rewriting the entire price economy. Tide deciding which half of a region exists. |
| **seam-crossing** | Either W→F or F→W per §A. **Applies as a ×2 multiplier**, not as a separate tier. | ×2 | `m` crossing = 2. `S` crossing = 6. |

**The counting rule, in full:**

1. `cell_points = tier_points × (2 if seam_crossing else 1)`, `tier_points ∈ {0, 1, 3}`.
2. **A cell scores its points only if a harness probe demonstrated it firing this wave.** A cell that
   is claimed in the data and not demonstrated scores **0** and is recorded in `paper_cells[]`.
3. **A cell scores once**, on its highest demonstrated tier. A cell demonstrated at `mechanical` when
   `structural` was claimed is scored `mechanical` and the over-claim is reported.
4. **Trivial cells never score, but must still be declared.** An undeclared trivial cell that a critic
   finds is fine; a `mechanical` claim that turns out on probing to be trivial is an **over-claim** and
   is counted in `overclaim_rate`, which is itself scored.
5. **Reciprocal cells are distinct.** `DIS→GLD` and `GLD→DIS` are two cells and two probes. Directed
   edges only; there is no symmetry shortcut.
6. **The diagonal is out of scope.** Intra-system interaction is owned by that system's own items.

### D. The seam-crossing register — all 41 cells (this is the `AR-3` instrument)

Each cell names the mechanism a builder implements and the observable a probe asserts.

**W→F — an out-of-fight investment changes what happens inside a fight (26 printed here; 30 formally,
once the four `DUN`/`SCH` rows printed below are classified by §A rather than by table)**

| Cell | Mechanism | Probe observable |
|---|---|---|
| `FAC→ROS` | Rank ≥ 3 in a faction makes its outposts non-hostile; rank ≥ 2 in its rival makes its patrols hostile on sight | `enemies[].alert_state` differs between a rank-0 and rank-3 fork on the same patrol, same seed |
| `FAC→BOS` | A boss who is a faction officer accepts parley at rank; a rival faction's boss gains a two-NPC escort | boss encounter ends without `death` in the rank fork; `listEntities()` shows +2 escort in the rival fork |
| `DIS→ROS` | A town guard's alert threshold scales with disposition; above 70 guards escort rather than engage a suspected player | `alert` value rises to `AGGRO` in the low-disposition fork only |
| `DIS→BOS` | The `S13` parley threshold on a humanoid boss is a disposition gate | `parley` event fires only above the threshold |
| `GLD→ROS` | A hired escort (paid in gold, `S15`) joins the encounter; a paid caravan route meets a different roster | `listEntities()` contains the escort eid; roster ids differ between walked and paid routes |
| `GLD→BOS` | A boss with a price ends the encounter for gold (`RI-EXP06` B-10's third route) | gold delta + no `death` event |
| `SKL→ROS` | Sneak decides whether the encounter starts at all — a stealth build's roster on the same route is materially smaller | count of `alert_state == AGGRO` transitions on a fixed route differs ≥ 50% between Sneak 20 and Sneak 80 |
| `SKL→BOS` | Security opens a boss arena's back door (a different opening position); Alchemy's pre-fight potion changes the fight's phase timings | entry position differs; boss phase transition frames shift |
| `SPL→ROS` | Calm / Paralyse / Command remove an enemy from an encounter without killing it; Invisibility prevents the encounter | enemy leaves `AGGRO` with no `death`; or never enters it |
| `SPL→BOS` | A utility effect solves a boss: a resist that nullifies its one damage type, a bind that costs it a phase | boss `hp` curve differs; a phase transition is skipped |
| `SPL→DUN` | Levitation bypasses an arena's designed approach, **bounded by `S19`**: exterior only, never into or within a dungeon or boss arena | player enters the exterior objective volume off-navmesh; and the same probe asserts the dungeon-interior case is **refused** |
| `LOR→ROS` | Knowing what a thing is changes which roster the player chooses to face — avoidance is a build (`RI-WLD06`) | route selection differs after the `topic` is known, on the same brief |
| `LOR→BOS` | **A book reveals a boss's weakness** — `BAR-CRITIQUE-01`'s own worked example. The weakness is inert until the book is read | damage multiplier / stagger threshold applies only with the book-read flag set |
| `STL→ROS` | An undetected player faces no encounter; a witnessed crime spawns guards into the roster | `spawn` events keyed to `crime_witnessed` |
| `STL→BOS` | A backstab opener (Souls) and, via `SCH`, assassinating a boss during a scheduled sleep or rite | `backstab` event as the encounter's first `hit`; or the boss begins the encounter at reduced hp |
| `QST→ROS` | A completed quest changes an area's enemy composition — the camp is cleared, or reoccupied by a rival | roster ids at the same POI differ pre/post `quest_stage` |
| `QST→BOS` | A quest outcome adds or removes a boss, or changes its escort or phase set | `listEntities()` at the arena differs by branch |
| `WLD→ROS` | World state changes who patrols where. **The flagship F↔W loop when combined with `ROS→WLD`** | patrol composition on a road differs by world flag |
| `WLD→BOS` | A boss relocates, or gains/loses an escort, after a world change | boss `pos` or escort differs |
| `TOD→ROS` | A nocturnal roster: different creatures patrol the same ground at night | roster ids at hour 3 vs hour 15 on the same route |
| `TOD→BOS` | A boss present or awake only at a time — the window `SCH→BOS` opens | boss `alert_state` at entry differs by `setTimeOfDay` |
| `WEA→ROS` | Salt-storms hide enemies (`RI-WLD05` #28): visibility to 15 m, so the roster you can *see* changes | `in_sight_cone` / detection distance differs by weather state |
| `WEA→BOS` | A boss fought in a storm: reduced player visibility, or a weather-gated ability | boss moveset ids differ by weather |
| `EQP→ROS` | **The disguise.** Wearing a faction's armour changes patrol aggro — the most legible seam crossing in the game | `alert_state` differs by worn item id, same patrol, same seed |
| `EQP→BOS` | A specific item is a boss's counter: a resist, a tool, a key that opens its arena from behind | boss damage output or arena entry differs by item |
| `UPG→BOS` | An upgrade tier threshold is what makes a specific boss's poise breakable — the cleanest progression W→F cell | `stagger` events occur at +6 and not at +3, same input script |

**F→W — a fight outcome changes the world beyond souls and corpses (15 printed here; 11 formally.
This is the short side of the matrix and §H makes that a debt rather than a rounding note)**

| Cell | Mechanism | Probe observable |
|---|---|---|
| `ROS→FAC` | Clearing a roster from a region changes faction control of it | faction standing / territory flag delta |
| `ROS→DIS` | Killing the thing that was eating the village raises disposition across the settlement | disposition delta for ≥ 5 NPCs |
| `ROS→QST` | A roster state satisfies a quest without the quest being "handed in" | `quest_stage` advances on the roster condition |
| `ROS→WLD` | A cleared road changes traversal safety and is recorded as a world flag | world flag set; `TRANSIT` hazard rate drops |
| `ROS→SCH` | A cleared route lets a caravan run again — NPC schedules change | ≥ 2 NPCs' positions at a fixed hour differ |
| `BOS→FAC` | **structural.** A boss killed or spared reshapes a faction's leadership and its remaining line | ≥ 3 quests' availability differs; a new rank holder appears |
| `BOS→DIS` | Province-wide reaction to the outcome | disposition delta for ≥ 10 NPCs |
| `BOS→LOR` | The boss's death or parley produces the truth about something — an `RI-EXP04` N6 revision | ≥ 2 existing topics return different text |
| `BOS→QST` | **structural.** The outcome branches the questline for hours | ≥ 2 downstream quests differ by branch |
| `BOS→WLD` | **structural.** A gate opens, a regional hazard ends, a district repopulates | ≥ 8 observable world changes |
| `BOS→SCH` | NPCs move in, or flee | ≥ 3 schedules differ |
| `DUN→ROS` | Layout decides encounter composition and whether the player can be flanked | encounter count on route A vs route B through the same dungeon |
| `DUN→BOS` | The arena is a system: the ledge, the plunging attack, the pillar (`RI-EXP06` B-15) | boss reachability and `plunge` availability from a named anchor |
| `SCH→ROS` | Patrol schedules *are* part of the roster: a road is safe at noon and not at midnight | roster at the same POI differs by hour |
| `SCH→BOS` | A boss's schedule — asleep, at a rite — is an attack window | boss `alert_state` at entry differs by hour |

`DUN`, `SCH`, `TOD` and `WEA` appear as sources of W→F cells because they are world-side systems whose
targets are the fight. **`DUN→ROS`, `DUN→BOS`, `SCH→ROS` and `SCH→BOS` are printed under F→W for
grouping convenience and are formally W→F** — which is why the printed 26/15 and the formal 30/11
differ. The probe suite classifies from §A's definition, not from this table's headings, and the
formal numbers are the ones §H scores.

**`BOS→ROS` is deliberately *not* here.** "The boss's faction's patrols change composition afterwards"
is fight-side source to fight-side target: it satisfies neither shape in §A, because `ROS` is not a
world-side system. It is a real and desirable interaction, it is `mechanical`, and it scores 1 rather
than 2 — it lives in §F's `BOS` row. It is called out because it is the single easiest cell in the
matrix to mistake for a crossing, and a wave that meets its crossing floor partly with fight-to-fight
cells has met nothing.

### E. The structural register — all 22 cells

Three (`BOS→FAC`, `BOS→QST`, `BOS→WLD`) are in §D and are not repeated.

| Cell | The structural claim |
|---|---|
| `FAC→QST` | Rank gates quest availability *and* rank-gated resolutions of the main quest (`RI-QST06` Act IV leverage) |
| `DIS→GLD` | Disposition sets barter prices (`RI-DLG04`) — it reshapes the whole economy, not one price |
| `DIS→QST` | **Disposition opens a resolution that is otherwise a fight** (`RI-QST05`'s ≥45% non-combat bar rests on this cell) |
| `SKL→FAC` | Skill + attribute thresholds gate rank (`RI-QST03`) — the shape of faction progression |
| `SKL→QST` | Skill-gated resolutions: pick it, climb it, brew it, talk it |
| `SPL→QST` | Spell-solvable quests (`S19`, `RI-QST05`) — a first-class route, not a shortcut |
| `SPL→WLD` | Levitation and water-walk change **which of the world is reachable** (`RI-EXP06` B-03); Mark/Recall inside the `S7` network |
| `LOR→QST` | A quest resolvable by knowledge alone (`RI-EXP06` B-14) |
| `LOR→WLD` | A book names a place that is otherwise unfindable — the whole of `RI-WLD06`'s no-markers navigation |
| `STL→FAC` | A bounty in one province closes a faction and opens another |
| `STL→QST` | Stealth resolutions (`RI-QST05`) |
| `QST→FAC` | Quest outcomes advance, close and expel from factions |
| `QST→WLD` | Quest outcomes change the world: a village saved or burned |
| `WLD→QST` | World state closes and opens quests — the reciprocal, and the one that makes consequences persist |
| `WLD→SCH` | Schedules rewrite around a changed world (`RI-WLD08`) |
| `TOD→STL` | Night is the stealth system's enabling condition |
| `TOD→SCH` | Schedules *are* time of day (`RI-WLD08`) |
| `WEA→WLD` | Tidewalking: roads, dungeons and one whole route exist only at low tide (`RI-WLD05` #21) |
| `SCH→STL` | Schedules are the substrate theft is planned against |

**The structural exemplar the floor is written for** is the composite
`FAC→QST` + `DIS→QST` + `QST→FAC` + `BOS→FAC`: **a questline resolvable by combat OR by politics,
with different world outcomes.** A build that can demonstrate that one loop end-to-end has done the
thing this item exists for, and it is worth 6 points as a crossing structural cell (`BOS→FAC`) plus
9 for the three non-crossing structural cells.

### F. The mechanical layer — the 145 remaining cells, by source

One line per source row. Each names its targets and the mechanism; `RI-CMP01.cells.json` expands them.

- **`FAC`** → `DIS` faction members' base disposition shifts with rank, rivals' drops · `GLD` rank
  unlocks faction prices, stipend, services · `SPL` rank-only vendors · `LOR` archive access grants
  topics · `STL` membership changes who reports you · `WLD` faction presence posted at locations ·
  `EQP` uniform and rank equipment · `UPG` a faction smith upgrades beyond the public tier ·
  `DUN` a faction-held door in a dungeon · `SCH` officers attend you.
- **`DIS`** → `FAC` disposition threshold on rank advancement · `SPL`/`EQP`/`UPG` a vendor, smith or
  teacher will or will not serve you · `LOR` disposition-gated topics (`RI-DLG01`) · `STL` a friendly
  witness does not report · `WLD` a doorkeeper opens a gate · `SCH` an NPC changes their day for you.
- **`GLD`** → `FAC` dues and writs · `DIS` the bribe verb · `SKL` training · `SPL` bought spells ·
  `LOR` bought books, paid informants · `STL` bounty paid off · `QST` a resolution bought ·
  `WLD` the `S7` travel network, paid, and property · `EQP`/`UPG` purchase and smithing ·
  `SCH` a guide hired to be somewhere.
- **`SKL`** → `DIS` Speechcraft/Personality in the persuasion ratings · `GLD` Mercantile in prices ·
  `SPL` which spells can be equipped at all (`RI-PRG03`) · `LOR` a scholarly skill lets you see
  through an unreliable book (`RI-LOR06`) · `STL` Sneak and Security · `WLD` Athletics and Acrobatics
  decide which terrain is passable · `EQP` effective use of weapon classes — **scaling coefficients
  only, never to-hit (`S1`)** · `DUN` skill-opened routes.
- **`SPL`** → `FAC` fortify-skill satisfies rank thresholds (`RI-EXP06` B-02) · `DIS` Charm ·
  `GLD` enchanting and spellmaking as gold sinks · `SKL` fortify-skill · `LOR` divination reveals a
  hidden thing as a topic · `STL` invisibility, chameleon, silence · `WEA` an effect negates a tide or
  fog hazard · `EQP` enchanting makes equipment.
- **`LOR`** → `FAC` a faction's secret opens or closes membership · `DIS` knowing a person's history
  is a topic · `GLD` knowing where a cache is · `SPL` a book teaches a spell · `STL` a known routine
  enables a theft · `TOD` a rite happens at an hour · `WEA` the tide table · `EQP` a book names where
  an item is · `UPG` a book names the only source of a material · `DUN` a described back route ·
  `SCH` a rumour names when someone will be somewhere.
- **`STL`** → `DIS` being caught tanks it · `GLD` theft as income, bounty as sink · `LOR`
  eavesdropping · `WLD` a stolen key opens a world door · `EQP` stolen goods are flagged and
  unsellable in that town · `UPG` stolen materials · `DUN` a stolen key is a shortcut · `SCH` a killed
  or imprisoned NPC's schedule vanishes and others' rewrite.
- **`QST`** → `DIS` outcomes move disposition · `GLD` rewards (`RI-QST08`) · `SPL`/`EQP`/`UPG` reward
  items · `LOR` granted topics · `STL` a writ legitimises a crime · `WEA` an outcome changes a
  region's hazard · `DUN` a permanently opened door · `SCH` outcomes move people · `JRN` entries are
  quest state's face (`RI-DLG05`).
- **`WLD`** → `FAC` a destroyed outpost weakens a faction · `DIS` province-wide shifts (egg-law,
  `RI-WLD05` #27) · `GLD` a destroyed market removes a gold source · `LOR` a changed world makes new
  rumours · `STL` a burned town has no witnesses · `WEA` a world change alters a hazard ·
  `EQP`/`UPG` a destroyed smith removes a source · `DUN` a collapsed route.
- **`TOD`** → `DIS` NPCs are worse-tempered when woken · `GLD` shops shut · `LOR` a vision at an hour ·
  `QST` timed stages · `WLD` places that only open at a time · `WEA` fog and dew cycles ·
  `DUN` light state changes routes.
- **`WEA`** → `DIS` NPCs shelter and greet differently · `GLD` a salt-storm closes the caravan ·
  `SPL` a hazard forces a spell · `STL` a storm hides you · `QST` a stage only doable at low tide ·
  `EQP` a mask or cure required in marsh-fever fog · `DUN` a level floods at high tide ·
  `SCH` everyone goes indoors.
- **`EQP`** → `FAC` a uniform changes how members and rivals treat you · `DIS` appearance in greetings ·
  `GLD` encumbrance limits what you can carry to sell (`RI-PRG07`, **out of fight only**) ·
  `SPL` enchantments grant effects · `STL` heavy armour breaks stealth · `QST` a carried token opens a
  resolution · `WLD` equip-load changes traversal · `WEA` protective gear · `UPG` equipment is what
  gets upgraded · `DUN` a light source or tool opens a route.
- **`LVL`** → `SPL` attribute points raise the magicka pool · `EQP` stat requirements to wield.
  **Everything else in this row is `none`, and two of them are mandated (§G).**
- **`UPG`** → `GLD` upgrading costs gold · `EQP` the item's scaling and effects change.
- **`ROS`** → `GLD` hand-placed loot (`S12`) · `SKL` skills grow by use (`S3`) · `LOR` an enemy's
  existence is a rumour source · `EQP` drops · `LVL` souls (`S2`, `S15`) · `UPG` materials, bounded by
  `RI-PRG08`'s non-farmable rule · `BOS` the roster around a boss.
- **`BOS`** → `GLD` a hand-placed reward · `SPL` a dropped or taught effect · `WEA` killing it ends a
  regional weather state · `EQP` a unique drop · `LVL` souls · `UPG` a unique material ·
  `DUN` the arena becomes a shortcut · `JRN` the entry that records it.
- **`DUN`** → `LOR` architecture is evidence (Xanmeer inscriptions) · `STL` layout decides stealth
  viability · `QST` layout gates a route · `WLD` an opened shortcut is a world route (`S16`).
- **`SCH`** → `FAC` officers present only at hours · `DIS` waking someone · `GLD` shops open ·
  `SKL` trainers available · `LOR` a conversation only at a time and place · `QST` meeting someone who
  moves · `WLD` where people are is what a settlement looks like · `UPG` the smith at the forge by day.
- **`JRN`** → `LOR` re-reading an entry surfaces a topic · `QST` journal directions are the only
  navigation (`S8`) · `WLD` journal prose is the map (`RI-WLD06`) · `DUN` a described route ·
  `SCH` a recorded appointment. **`JRN→BOS` is `trivial` and is the brief's own worked example of a
  cell that must be declared and must score zero.**

### G. Mandated-`none` and forbidden cells (the negative half of the matrix)

Some cells must be empty, and their emptiness is a **check**, not an absence. A build that fills one
of these has violated a seam ruling and the finding is `AR-1`, not a matrix bonus.

| Cell | Must be | Because |
|---|---|---|
| `LVL→ROS` | **none** | `S9`: no enemy level-scaling to the player, ever |
| `LVL→BOS` | **none** | `S9` |
| `UPG→ROS` | **none** | `S9`: upgrade tier must not change what spawns |
| `LVL→SKL`, `SKL→LVL` | **none** | `S2`: souls buy levels, skills grow by use; two currencies, no exchange |
| `ROS→GLD` **via souls** | **none** | `S15`: souls level you and only level you. Loot is gold; souls never are |
| `SKL→ROS/BOS` **via hit resolution** | **forbidden mechanism** | `S1`, `RI-PRG03`: skill may change *which encounters occur* and scaling coefficients; it may never be read during hit resolution |
| `EQP→ROS/BOS` **via Burden** | **forbidden mechanism** | `RI-PRG07`: all four multipliers exactly 1.00 in combat. The `EQP→ROS` cell is the disguise, not the weight |
| `SPL→DUN` **into a dungeon or arena** | **forbidden mechanism** | `S19`: no teleport as level-design solvent. The cell is exterior levitation only |
| `TOD→*`, `WEA→*` **as a pause** | **forbidden mechanism** | `S14`: nothing pauses the world in combat |

`tools/composition/matrix-probe.mjs` runs a **negative probe** for each of these: it attempts to
observe the interaction and asserts it does **not** fire. A mandated-`none` cell that fires is an
automatic `AR-1` fail of the piece that produced it and is reported to that piece's critic, not
scored here.

### H. The floor (this is what `AR-3` defers to)

**Two coverage numbers, and they are different bars.**

- **Declared coverage** — `BAR-CRITIQUE-01` §3 rank 2's `≥ 35% of pairs non-none`, applied to the
  matrix as designed. Our declared matrix is **60.2%** and passes with margin. This number is cheap
  and is reported for continuity with the audit, **not scored**.
- **Demonstrated coverage** — the real bar, and it is strictly harder than what the audit proposed,
  because the audit's threshold counted *declared* cells. The floors below are set against
  demonstrated cells and are deliberately lower in absolute terms and higher in evidentiary cost.

| Wave / tier | demonstrated live cells (`m`+`S`+`M`+`T`) | structural (`S`+`T`) | **seam-crossing (`M`+`T`)** | matrix score |
|---|---|---|---|---|
| **W1 / `FRAGMENT`** | ≥ 10 | ≥ 1 | **≥ 4** | ≥ 20 |
| **W2 / `PARTIAL`** | ≥ 30 | ≥ 4 | **≥ 8** | ≥ 55 |
| **W3** | ≥ 60 | ≥ 8 | **≥ 14** | ≥ 110 |
| **W4+ / `FULL` / ship** | ≥ 100 | ≥ 14 | **≥ 24** | ≥ 185 |

Ship requires roughly **half the declared matrix demonstrated firing**, and more than half the
declared seam crossings. `BAR-CRITIQUE-01`'s `≥ 8 crossing cells` is the W2 floor here — reached at
partial tier and then exceeded, because 8 demonstrated crossings in a finished game is not a
membrane, it is a perforation.

**Quality gates on top of the counts:**

| Metric | Definition | Bar | Fail |
|---|---|---|---|
| `paper_fraction` | claimed cells with no demonstrated firing / all claimed cells | ≤ 0.35 | > 0.60 |
| `overclaim_rate` | cells demonstrated at a lower tier than claimed / demonstrated cells | ≤ 0.20 | > 0.40 |
| `crossing_both_directions` | ≥ 1/3 of demonstrated crossings are F→W, and ≥ 1/3 are W→F | true | either direction < 1/6 |
| `mandated_none_violations` | cells in §G observed firing | **0** | ≥ 1 |
| `sterile_pieces` | pieces reporting `seam_sterile: true` in this wave's verdicts / all pieces | ≤ 0.30 | > 0.50 |

`sterile_pieces` is the number `AR-3` actually generates, and it is this item's answer to *"how many
such pieces are tolerable"*: **up to 30% of pieces may legitimately be internal.** Above 50%, the
project is building two products, and the finding is a project-level one regardless of every piece's
own verdict.

---

## Comparison method

**Stage 1 — static claim extraction.**

```bash
node tools/composition/matrix-scan.mjs --data game/data --systems corpus/95-experience/RI-CMP01.cells.json \
  --out reports/composition/w<N>/claims.json
```

Parses conditions and effects out of `game/data/**` — quest `stages[].conditions` and
`outcomes[].effects`, dialogue topic `condition`, npc `disposition`/`schedule`/`services`, faction
records, enemy statblocks, boss records, POI and interior records — and emits a **claimed edge list**.
Every claimed edge carries the data path and the JSON pointer that produced it. An edge with no data
path is not a claim; it is an opinion, and the scanner refuses it.

Per `HARNESS.md` §7, content that exists only as literals inside `.js` is unmeasurable and is treated
as content that does not exist. A cross-system interaction implemented in a `switch` statement scores
zero here for the same reason a quest does.

**Stage 2 — the probes. This is the stage that matters.**

```bash
node tools/composition/matrix-probe.mjs --claims reports/composition/w<N>/claims.json \
  --cells corpus/95-experience/RI-CMP01.cells.json \
  --out reports/composition/w<N>/matrix.json
```

Every claimed cell gets a **paired A/B harness run**, same seed, same scenario, same input script,
differing **only** in the source state:

1. `setSeed(n)`, `loadState(scenario)` — the fork point.
2. Fork **A**: source state **unset**. Fork **B**: source state **set** (rank granted, book read,
   disposition raised, armour worn, hour changed, quest branch taken — by legitimate state
   manipulation at the fork, which is permitted here because this is a probe, not a playthrough).
3. Run the identical input script in both. `traceStart` / `traceDrain`.
4. Assert the cell's **declared observable** differs between A and B, in the direction claimed, by the
   declared magnitude.
5. Record both traces, both `body_sha256`, and the diff.

A cell whose A/B traces are **identical** is a paper cell and scores 0. This is the single rule the
whole item turns on: *the probe is a difference, and a difference cannot be asserted, only observed.*

**Determinism.** `HARNESS.md` §8's `D5` requires byte-identical traces for the same
(scenario, seed, input script). Fork A and fork B differ only in state, so **if A and B produce the
same `body_sha256`, the cell demonstrably did nothing** — the hash comparison is the cheap
pre-filter and the observable assertion is the real check. A cell where the hashes differ but no
declared observable differs is a **side-effect**, not an interaction, and is reported separately in
`incidental_differences[]`.

**Stage 3 — tier verification.** A cell claimed `structural` must additionally demonstrate
**persistence**: the observable difference is still present ≥ 30 simulated minutes later, in a state
loaded from the fork's `saveState()`. A `structural` claim that does not persist is scored
`mechanical` and counted in `overclaim_rate`. This is `PLAYTHROUGH-CRITIC.md` §4.3's S2 reused as a
tier test.

**Stage 4 — the negative probes.** Every §G mandated-`none` cell is probed for **absence**: the same
A/B fork, asserting the observable does *not* differ. A firing mandated-`none` cell is written to
`ar1_violations[]` and referred to the owning piece's critic.

**Stage 5 — playthrough corroboration.** `matrix.json` records, for each demonstrated cell, whether
it was **also observed in the 20-hour chain** without any state manipulation
(`observed_in_play: true|false`). A cell that fires only under a forced fork and never in ordinary
play is *reachable* but possibly *unreachable in practice*, and `reachable_in_play_fraction` is
reported. It is not scored this wave — it is the number this item will be scored on in a later wave,
and it is announced now so builders can aim at it.

**Stage 6 — the `AR-3` roll-up.** `sterile_pieces` is computed from the wave's verdicts, not from the
data. Every critic must report `seam_sterile` per `ARBITRATION.md` §3; this item aggregates them and
is the only place the project-level number exists.

**Stage 7 — the negative artifact.** Every paper cell carries: its claim, its data path, the exact
probe that was run, both trace hashes, and the diff that was empty. "The interaction is in the data
and does not reach the player" is a finding a builder can act on in an afternoon; "coverage is low"
is not.

---

## Scoring

Native scale: the matrix score and the floors in §H.

| Component | Weight | Full marks |
|---|---|---|
| Demonstrated live cells vs the wave's floor | 20 | at or above floor |
| **Demonstrated seam crossings vs the wave's floor** | **30** | at or above floor, both directions ≥ 1/3 |
| Demonstrated structural cells vs the wave's floor | 20 | at or above floor, all persisting 30 min |
| Honesty (`paper_fraction`, `overclaim_rate`) | 20 | ≤ 0.35 and ≤ 0.20 |
| Mandated-`none` integrity + `sterile_pieces` | 10 | 0 violations, ≤ 0.30 sterile |

| Native | Band | Ladder ceiling |
|---|---|---|
| all floors met, honesty bars met | Meets the bar | 8 |
| floors met, one honesty bar missed | Below bar — named remedy required | 6 |
| any floor missed | Loses outright | 4 |
| crossing floor missed by > 50%, or `paper_fraction > 0.60` | We lose | 2 |

**Native → ladder anchors:** W2 floor met exactly with `paper_fraction = 0.5` → ladder 4; W2 floors met
with `paper_fraction ≤ 0.35` and both crossing directions present → ladder 6; W3 floors met, ≤ 0.20
paper, ≥ 1 structural crossing loop demonstrated end to end and persisting → ladder 8. Ladder 9–10 is
not available: there is no reference measurement of Morrowind's or Dark Souls' matrix to beat, and a
constructed matrix cannot beat a reference that was never measured.

**Hard fails — any one caps the item at 2:**

1. **Fewer than 4 demonstrated seam-crossing cells.** `BAR-CRITIQUE-01` §3 rank 2's stated hard fail,
   kept verbatim: *the two halves are bolted together.*
2. **Zero demonstrated F→W cells** — the fight changes nothing about the world beyond souls and
   corpses, which is `AR-3`'s sentence, satisfied.
3. **`paper_fraction > 0.60`** — the matrix is mostly fiction, and a fictional matrix is worse than a
   small one because it hides the problem it was built to expose.
4. **Any mandated-`none` cell fires** (§G) — a seam ruling is broken. Capped here *and* referred as an
   `AR-1`/`AR-2` fail to the owning piece.
5. **The probe harness could not run** (`matrix-probe.mjs` absent, `saveState`/`loadState` absent so
   forks are impossible) — `unmeasurable ⇒ 0`, fail-closed. `HARNESS.md` lists `saveState` as
   *optional*; amendment `A-EXP1` already makes it mandatory for experience items and this item
   depends on that.
6. **Claims are demonstrated by static analysis only.** A wave that reports coverage from
   `matrix-scan.mjs` with no probe stage scores 0 for every cell, regardless of the data.

---

## How we lose

- **The matrix gets filled in and nothing fires.** This is the failure the item is written against and
  it is the *likely* one, because writing a condition into a quest file is ten minutes and making it
  observable is a day. Every defence in this item — the A/B fork, the hash pre-filter, the declared
  observable, `paper_fraction` as a scored metric, hard fail 3 — exists for this single failure, and
  it will still happen partially.
- **Crossings are all in one direction.** W→F is easy: a faction rank is a number and an aggro check
  is a number. F→W is content: a boss dying has to *change the world*, which means somebody writes the
  changed world. Twenty-six of our 42 declared crossings are W→F and sixteen are F→W, and under time
  pressure the ratio will get worse. `crossing_both_directions` is the defence and it is a soft gate;
  hard fail 2 is the hard one.
- **`ROS` and `BOS` columns get filled with aggro tweaks.** Every W→F cell resolves to "the enemy's
  `alert_state` differs", because that is the cheapest observable in the trace. A matrix of nineteen
  aggro flags passes the count and is one interaction wearing nineteen hats. The tier system is a
  partial defence — aggro tweaks are `mechanical`, worth 2 with the crossing multiplier, and the
  structural floor cannot be met with them — but a critic must read the register and say so.
- **The structural tier gets claimed for mechanical work.** "Structural" is a judgement, and the
  incentive is 3 points instead of 1. Stage 3's 30-minute persistence test is the only objective part
  of that judgement and it should be treated as the definition rather than as evidence for it.
- **The `S9` cells get filled by accident.** Somebody adds a difficulty curve that reads player level,
  because it makes the mid-game feel better, and it lands as `LVL→ROS`. It will look like a matrix
  improvement to anyone counting cells. §G's negative probes are why the count cannot be read without
  the integrity check.
- **`sterile_pieces` is never computed** because it requires every critic to have reported
  `seam_sterile`, which requires every critic to have read `ARBITRATION.md` §3's third bullet. One
  wave where half the verdicts omit the field and the project-level number is unavailable forever for
  that wave.
- **The item is scored by whoever built the interactions.** `CRITIC-DOCTRINE` §8 applies; the probe
  suite is generated from this file and the claims from the data, which limits the damage, but the
  *tier* assignment is a judgement and must not be made by the author of the cell.
- **We meet the floor and the game still feels like two products**, because 24 crossings distributed
  one per system is thinner than 8 crossings that form a loop. The matrix counts edges; it does not
  count *cycles*, and a cycle — `EQP→ROS→WLD→SCH→STL→…` — is what a player experiences as a world.
  This is a real and unaddressed weakness of the instrument, and the honest remedy is a future
  amendment adding a cycle-length metric rather than pretending the count covers it.

---

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **matrix, the tiers, the crossing multiplier, the counting rule and the floors are all original**
to this project. No upstream source defines a cross-system payoff matrix. Binding anyway per
`CORPUS-CONTRACT` §3.

**The relationship to `BAR-CRITIQUE-01` §3 rank 2 is a deliberate divergence and is recorded here
rather than absorbed silently.** The audit proposed `≥ 35% of pairs non-none` and `≥ 8 crossing
cells` over a 17-system matrix. This item keeps its hard fail (`< 4` crossing cells) verbatim, keeps
its 35% as a *declared-coverage* figure reported for continuity, and **replaces its thresholds as
scored bars** with the demonstrated floors in §H. The reason: the audit's 35% counts cells that exist
in a design document, and this item's central claim is that such cells are worth zero. Applying 35%
to *demonstrated* cells would mean 120 probed interactions at every wave, which is not achievable at
W1 and would be met by declaring the count rather than by running the probes. The divergence makes
the early floors lower and the evidentiary standard much higher, and a critic who thinks that trade is
wrong should file an amendment.

**The cell assignments in §D–§F are proposals for our game, not measurements of anything**, and their
confidence varies sharply:

- **Well grounded** (`confidence: high`) — cells that transpose documented reference-game behaviour or
  restate an existing corpus ruling: `DIS→GLD` (`RI-DLG04`), `SKL→FAC` (`RI-QST03`), `SPL→WLD` (`S19`),
  `WEA→WLD` (`RI-WLD05` #21), `TOD→SCH` (`RI-WLD08`), `JRN→QST` (`S8`), all of §G.
- **Reasonable but unbuilt** (`confidence: medium`) — `EQP→ROS` (the disguise), `LOR→BOS` (the book
  weakness), `FAC→ROS` (rank aggro), `UPG→BOS` (poise threshold). Each is a normal design idea with no
  implementation and no ruling behind it; a builder may find a better mechanism for the same cell and
  should.
- **Speculative** (`confidence: low`) — the `BOS→*` structural cells. `BOS→FAC`, `BOS→QST` and
  `BOS→WLD` are the three highest-scoring cells in the matrix (6 points each) and they are the least
  specified: "a boss killed or spared reshapes a faction" is a sentence, not a design. They are the
  cells most likely to be claimed and least likely to fire, and a critic should probe them first for
  exactly that reason.

**The declared totals (206 / 60.2% / 42 / 22 / score 298) are arithmetic over §B and are exact.** They
are not a claim about the game; they are a claim about this document, and they will be wrong the moment
a builder proposes a better mechanism for a cell marked `none`. That is expected: the matrix is a
starting position, `RI-CMP01.cells.json` is the living artifact, and this file is the rule for how the
artifact is scored.
