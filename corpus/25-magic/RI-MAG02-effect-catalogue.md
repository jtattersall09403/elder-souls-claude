---
id: RI-MAG02
title: The effect catalogue — 55 effects, the cost formula, and the rulings on levitation and teleport
kind: structure
side: morrowind
judges: [magic.effects.catalogue, magic.effects.parameters, magic.effects.utility, magic.effects.traversal, magic.effects.teleport, magic.economy.prices]
provenance: constructed
confidence: high
blind_pair: no
---

> **Seam S19, second half.** *Outside the fight, Morrowind, emphatically.* Machine-readable
> artifact: **`corpus/25-magic/data/effects.json`** (55 effects, generated, binding).
> This item is the parameter space; RI-MAG03 is the system that combines it.

## The bar

Morrowind's genius is not its spell list. It is that **there is no spell list** — there is an
*effect list*, a magnitude, a duration, an area, a range, and an arithmetic price, and every
spell in the game is just a popular point in that space. `Fire Damage 20 pts for 1 sec on
Target` is not a designed object; it is a coordinate. The player who discovers this stops
shopping and starts *building*, and from that moment the game is a different, larger game.
Every subsequent Elder Scrolls title has removed a piece of this and every removal made the
magic smaller.

The bar is therefore: **the catalogue is the content, the named spells are not.** Concretely —
≥40 effects (we ship 55); ≥12 of them with a use outside the fight that changes traversal or
quest resolution (we ship 40); a single published cost formula that prices any legal
combination including combinations no designer ever wrote; and no effect that exists only to
be damage or healing (8 of 55 are pure damage/heal — 14.5%). A build where magic is thirty
authored spells with fixed numbers has failed this item completely, no matter how good the
thirty spells are.

And two effects must be *ruled*, not deleted. **Levitation** and **teleport** are the two
that genuinely threaten a Souls level-design layer, and the sterile answer — cut them, as
Bethesda themselves did in 2006 and never undid — would amputate WLD05's own strangeness
catalogue (element 13: *"levitation and slowfall as normal, expected traversal — systemic"*)
and hand back S19's whole Morrowind half. They ship. They ship **bounded**, and every bound is
either arithmetic or architecture, never a message telling the player no.

## The reference artifact

### A. The four schools

Fixed by RI-PRG03 §1, which ships exactly four magic skills. There is no fifth school and no
school without a skill.

| School | Skill | Governing attribute | Domain | Effects |
|---|---|---|---:|---:|
| **Sorcery** | Sorcery | INTELLECT | Force applied outward: elements, unmaking, binding, theft of souls | 14 |
| **Root-Speech** | Root-Speech | HIST-BOND | Asking the marsh: mending, curing, fortifying, knowing, stilling | 14 |
| **Warding** | Warding | WILLPOWER | Altering physical law: locks, weight, water, air, distance | 15 |
| **Veiling** | Veiling | WILLPOWER | Altering perception: concealment, silence, disposition, will | 12 |

**Total: 55 effects.** Full records — magnitude unit and range, duration and area legality,
permitted cast ranges, minimum tier, geometry kind, in-fight/out-of-fight flags, status
buildup, per-effect rulings — are in `data/effects.json`. This document holds the formula, the
census, and the two contested rulings.

### B. The census (the numbers a critic checks first)

| Metric | Value | BAR-CRITIQUE-01 G4 threshold | |
|---|---:|---|---|
| Total effects | **55** | ≥ 40 | ✔ |
| With an out-of-fight use changing traversal **or** quest resolution | **40** | ≥ 12 | ✔ |
| `changes_traversal` | 16 | — | |
| `changes_quest_resolution` | 32 | — | |
| Usable in the fight | 31 | — | |
| **Pure damage or healing** | **8 (14.5%)** | hard fail if 100% | ✔ |
| Utility classes represented | 7 (`access` 21, `survival` 9, `traversal` 7, `social` 5, `knowledge` 4, `teleport` 3, `economy` 2) | — | |
| School balance (min/max) | 12 / 15 | no school < 8 | ✔ |

### C. Effect parameters — the axes

Every effect declares which axes it accepts. A spell is a **set** of effects, each with its
own magnitude, duration and area, plus one shared range and one shared weight class.

| Axis | Unit | Range | Notes |
|---|---|---|---|
| **Magnitude** `M` | effect points | 1 … the effect's `magnitude.max` | Converted to display units by `output_per_point`. Chameleon's 3%/point is why 20 points reads as 60%. |
| **Duration** `D` | seconds | 0 (instantaneous) … the effect's `duration.max_s` | `duration.allowed: false` forces instantaneous |
| **Area** `A` | metres, radius | 0 … the effect's `area.max_r_m` | `area.allowed: false` forces 0 |
| **Range** | enum | `self` `touch` `target` `projectile` `area_at_range` | Shared across all effects in one spell |
| **Weight class** | enum | `CANTRIP` `LIGHT` `HEAVY` `GREAT` `RITUAL` | RI-MAG01 §B. Shared. Determines the frames. |

**There is no magnitude *range*.** `Fire Damage 5–15 points` does not exist here. Every
magnitude is a single integer and every outcome is deterministic — this is S1 applied to
magic and it is the single largest deliberate deviation from Morrowind in the whole area
(RI-MAG01 §E rule 2).

### D. The cost formula

```
focus_base = ceil(  weight × ( M^1.30  +  0.7 × D^0.95  +  0.55 × M^0.80 × D^0.45 )
                           × ( 1 + 0.09 × A^1.25 )
                           × range_mult
                    / 10  )

focus_cost = ceil( focus_base × class_mult × catalyst_mult × (1 − skill_discount) )
```

| Term | Values |
|---|---|
| `weight` | per-effect, `data/effects.json`. 1.1 (`drain_health`) … 9.0 (`levitate`, `recall`) |
| `range_mult` | `self` 0.70 · `touch` 0.85 · `target` 1.00 · `projectile` 1.15 · `area_at_range` 1.25 |
| `class_mult` | `CANTRIP` 0.50 · `LIGHT` 1.00 · `HEAVY` 2.10 · `GREAT` 4.40 · `RITUAL` 1.00 (RI-MAG01 §B) |
| `catalyst_mult` | great staff 0.80 · rod 1.00 · enchanted weapon 1.15 · none 1.35 (RI-MAG01 §B) |
| `skill_discount` | `0.005 × (skill − tier_req)`, clamped `[0, 0.35]` — **RI-PRG03 §6 verbatim** |

**The cross term `0.55 × M^0.80 × D^0.45` is the most important thing in this file.** Without
it the magnitude and duration axes are separable, and the optimal spell in every situation is
a one-second nuke — Morrowind's actual, famous, unbounded exploit. With it, the balanced
spell is cheap and the extremes are expensive, and the numbers say so:

| Spell | `focus_base` |
|---|---:|
| `fire_damage` M 30, D 30 s, projectile — *balanced* | **25** |
| `fire_damage` M 1, D 100 s, projectile — *long and weak* | **11** |
| `fire_damage` M 100, D 1 s, projectile — *the one-second nuke* | **73** |

Nuking costs **2.9×** balance for the same nominal magnitude-seconds. Removing or weakening
this term is an automatic fail of RI-MAG03.

**Tier bands and skill requirements** (RI-PRG03 §6's ladder, keyed to `focus_base`):

| Tier | `focus_base` | Skill req | Gold price `round(3.9 × focus_base^1.75)` |
|---:|---|---:|---:|
| 1 | ≤ 12 | 0 | 220 g at base 10 |
| 2 | 13 – 30 | 25 | 874 g at base 22 |
| 3 | 31 – 65 | 45 | 3,425 g at base 48 |
| 4 | 66 – 120 | 65 | 8,346 g at base 80 |
| 5 | ≥ 121 | 85 | 22,218 g at base 140 |

The gold formula is **fitted to RI-PRG05 §2's three published prices** (tier-1 220, tier-2
900, tier-3 3,400 at `focus_base` 10 / 22 / 48); residuals are under 3%. Tiers 4 and 5 have
no published price and this item supplies them — see the amendment requested in the
provenance note.

> **AMENDED wave 0 (corpus-audit) — queue B11. The formula degenerates for the teleport
> spells, and `min_tier` pricing overrides it for them.**
>
> `round(3.9 × focus_base^1.75)` prices a spell by its *computed magnitude*. The four S7/S19
> teleport effects — `mark`, `recall`, `intervention_root`, `intervention_imperial` — have
> essentially **no magnitude**: `mark` merely writes a position, so the formula prices it at
> **about 4 gold**, and `recall`'s magnitude scales with distance travelled, so **its shelf
> price would depend on where the player happens to be standing**. A shop price that moves
> when the customer walks is not a price.
>
> **Ruling: for the four teleport effects, gold price is set by `min_tier`, not by the
> magnitude formula.** `RI-TRV02` §P1 already prices them this way and asserts the numbers;
> this item defers to it rather than competing with it:
>
> | Spell | `min_tier` | Gold price |
> |---|---:|---:|
> | `recall` | 3 | **3,400 g** |
> | `intervention_root` | 3 | **3,400 g** |
> | `mark` | 2 | **900 g** |
> | `intervention_imperial` | 2 | **900 g** |
>
> These are `RI-PRG05` §2's published tier-3 and tier-2 spell prices, unmodified — so the
> exception introduces no new numbers into the economy. **The magnitude formula remains the
> rule for every other effect**; this is a narrow carve-out for effects whose whole value is
> *where they take you*, which magnitude cannot express. `RI-TRV02` owns the four spells'
> prices, gates and detectors; this item owns their effect records, Focus costs and cast class.
> Recorded so a later reader does not "fix" the inconsistency by re-applying the formula.

**The Focus pool is the only ceiling spellmaking needs.** Maximum reachable cost is
`focus_max` = 124 (WIL 99, RI-MAG01 §A), so the largest legal spell of each class is:

| Class | Max `focus_base` at WIL 99, great staff, −35% skill discount |
|---|---:|
| `CANTRIP` | 477 |
| `LIGHT` | **238** |
| `HEAVY` | 113 |
| `GREAT` | **54** |

Read the last row. A `GREAT`-class spell — the one with 52 frames of startup and
hyperarmour — can never exceed `focus_base` 54, so the genuinely enormous magnitudes must be
authored at `LIGHT` or `CANTRIP`, which have **no hyperarmour at all** (RI-MAG01 §B). The
biggest spell in your book is also the one you are most easily interrupted casting. That
tension is emergent from three independently-motivated numbers and it is the best argument
that this cost model is doing real work.

### E. Effect output — scaling, deterministically

```
output = M × output_per_point × ( 1 + gradeCoeff(effective_grade) × scalingBonus(stat) )
```

- `gradeCoeff` and `scalingBonus` are **RI-PRG02 §4's tables verbatim**. Nothing new.
- `stat` is the effect's `governing_attribute` (INTELLECT / HIST-BOND / WILLPOWER).
- `effective_grade` is the spell's printed grade shifted by **RI-PRG03 §5's skill-vs-req
  table**, using the school's skill against the spell's tier requirement — identical machinery
  to a weapon's effective grade.

So a spell's output is a pure function of two integers (attribute, skill) and one authored
constant, and the same spell in two hands does different amounts of damage **without ever
touching whether it connects**. That is S3 satisfied for magic by reusing S3's own mechanism
rather than inventing a parallel one.

### F. ⚖ RULING — LEVITATION

`levitate` · Warding · **tier 4 (req Warding 65)** · weight 9.0 · self/touch/target.
`focus_base` **8** for a 15-second hop, **25** for 60 seconds, **66** for the 180-second maximum.

It ships. It is bounded by **four independent mechanisms, none of which is a rule the player
can read**:

**F1 — Neutral buoyancy, not thrust. Horizontal drift 1.4 m/s.**
Walk speed is 2.0 m/s and S17 forbids lowering it. **Levitation is therefore permanently
slower than walking, per metre travelled.** It is a route-opener and it can never be a
time-saver *over open ground*, which is what keeps it structurally out of competition with the
S7 travel network. Nobody will ever levitate across the map because walking is faster; they
will levitate the forty metres they cannot climb.

*Reconciliation with RI-EXP06 PB-03*, whose probe asserts a levitation route completes in
**< 40% of the walked time**: that probe is about **vertical** objectives, and it still passes.
Levitation is slower per metre and **collapses the metres**. A roof reached by 400 m of stairs
(200 s at 2.0 m/s) is 12 m of climb (15 s at 0.8 m/s). *The straight line is what is cheap;
the speed never is.*

**F2 — Altitude is metered, and Focus never comes back.**
Climb rate 0.8 m/s, and ascent costs an **additional 1.5 Focus per metre of net altitude
gained**, charged continuously. A 40 m ascent is 60 Focus *on top of* the spell. Since Focus
regenerates by no mechanism whatsoever (RI-MAG01 §A, M3), altitude is bought out of the same
reservoir you need to fight with, and there is no way to top it up short of walking back to a
HEARTH — which is the thing you were levitating to avoid. **The bound is arithmetic. There is
no fence and no volume flag anywhere in the data.**

**F3 — `AIRBORNE` is defenceless.**
While levitating: no attack, no cast except `slowfall`, no block, no roll, **no i-frames of
any kind**. Enemies target normally, and a target that cannot dodge is a target the geometry
hits every time. **Any damage taken ends the effect** — you fall, and a levitating mage
without `slowfall` attuned is a mage who dies. Levitating over hostile ground is suicide, not
a bypass. This is the Souls-legal answer to "flying trivialises encounters": it does not
trivialise them, it forfeits them.

**F4 — The ceiling is diegetic, and above it there are hackwings.**
Every interior, every root-tunnel and **all 8 Souls-loop dungeons** (RI-WLD07 §2 — which
requires them to be single continuous enclosed spaces) have a ceiling four metres away.
Levitation works there and is useless there. Outdoors, ~70% of the exterior map is under a
**collidable canopy at 25–40 m**. Clear the canopy and you are in the **hackwing layer**
(WLD05 element 12, *"the airborne nuisance that defines the skyline"*): a real R5-tier flock
aggroes on a fixed timer, and by F3 you cannot fight it. Cliff racers made levitating over
Vvardenfell miserable **by accident**; here it is designed, and it is the most Morrowind
possible bound.

**F5 — Load-bearing, not merely tolerated.**
**≥6 map routes and ≥3 quest resolutions must be reachable only-or-most-easily by
`levitate`/`slowfall`**, asserted by RI-MAG04 M4. An effect that ships and opens nothing has
been deleted by neglect, which is the sterile outcome wearing a compliance badge.

**F6 — Sequence breaks over the open world are SANCTIONED.**
Climbing a cliff into an R5 region at level 12 is legal, must keep working, and is
RI-MAG03 §D **MB-1**. The region kills you (S9 gates by lethality, never by level), and your
sap-debt stays where you dropped it. That is the cost, and it is sufficient.

**The canopy is not a blocking volume.** RI-EXP06's PB-03 explicitly reds on *"a height clamp
or an exterior blocking volume"*, and this ruling agrees with it. The canopy is **authored,
visible, renderable tree geometry carrying the same collider every arrow and every falling body
already uses.** It has gaps — clearings, river channels, burn scars, the xanmeer plazas — and
you can fly up through them and over the top, which is precisely what puts you in the hackwing
layer. It blocks nothing a physical canopy would not block, and a critic can see it in the
frame. A canopy that is an invisible plane, or that has no gaps, is the failure this paragraph
exists to forbid.

**What is explicitly NOT a bound:** there is no `no_levitation_zone`, no altitude clamp, no
"you cannot levitate here" message, and no invisible ceiling. A build that adds one **fails
this item**, because it has replaced a designed world with a rule.

**`slowfall`** is the traversal workhorse, not levitation — tier 1, weight 2.6, `focus_base`
**3** for 20 seconds, terminal velocity 3.5 m/s, zero fall damage. With RI-WLD07's −40 m to
+420 m of relief, **descent is cheap and ascent is expensive**, and that asymmetry is the
entire shape of caster traversal: a caster gets down anywhere and up almost nowhere.

### G. ⚖ RULING — TELEPORT (`mark` / `recall` / `intervention`)

All three are **`RITUAL` class**, and that is the whole enforcement. A `RITUAL` cast is 210
frames with zero hyperarmour and zero movement, and it **aborts on any damage, on entering
`COMBAT`, and on any movement input** (RI-MAG01 §B). *"No recall out of a fight"* is therefore
not a rule anyone has to remember to write — it is a consequence of the clock. There is no
`can_cast_in_combat: false` flag to forget.

**`recall`'s magnitude is not authored — it is computed at cast time as the straight-line
distance to your mark, in hundreds of metres.**

| Distance to mark | `M` | `focus_base` | As a fraction of a WIL-30 pool (94) |
|---|---:|---:|---:|
| 500 m | 5 | **6** | 6% |
| 1.5 km | 15 | **26** | 28% |
| 3 km | 30 | **57** | 61% |
| 4 km (map diagonal) | 40 | **77** | 82% |

This gives teleport a **completely diegetic range limit**: you cannot recall from further than
your Focus reaches, you cannot get more Focus without resting, and resting is the thing you
were trying to avoid. Nobody had to draw a circle on a map. `intervention` uses the same rule
against the *nearest* qualifying site, so it is cheap near help and useless in the deep
marsh — the exact inverse of what an escape button would be.

**The network's rules are owned by RI-TRV02, not by this item.** `mark` may only be set
outdoors, above ground, outside the 8 loop-dungeons, outside boss arenas and locked areas, and
only where the player has already stood. RI-TRV02 owns that placement predicate and owns the
teleport-as-solvent detector; this item owns the effect records, the costs and the class. Two
variants of `intervention` exist and go to **different networks** — `intervention_root`
(nearest rootkeeper's shrine) and `intervention_imperial` (Nine Divines chapel: Gideon,
Stormhold, Blackrose only) — so which one you carry is a faction statement. **Neither ever
goes to a HEARTH:** S7 states that HEARTH shrines are checkpoints and level-up stations and are
not part of the travel network.

### H. The ten effects most likely to be quietly ruined

Each carries a `rulings` array in `data/effects.json`. These are the ones where the obvious
implementation breaks a different reference item:

| Effect | The trap | The ruling |
|---|---|---|
| `hist_sight` | Ships as a quest marker | **Emits ONE prose journal line** in the Hist's idiom, giving a direction and a landmark. No marker, no arrow, no waypoint. A HUD marker here is an **AR-2 automatic fail** (S8). |
| `detect_life` | Ships as a minimap / through-wall outline | Diegetic warm smudges at real world positions. No icons, no compass, no names. |
| `feather` | Silently lerps the roll tier | Changes the equip-load **tier**, so a feathered caster genuinely rolls `LIGHT`. The 30.00%/70.00% cliff must remain a cliff (RI-CMB01 M5). |
| `burden` | Slows the enemy's *attacks* | Moves the enemy's equip-load tier — its roll and reposition. **Never** its windup, tracking cutoff, hitbox or telegraph. RI-AI02 is untouchable. |
| `paralyse` | Instant lock, or immunity flags on bosses | **Buildup on S11's meter**, magnitude × 4 per contact. Bosses get a raised threshold, never immunity. Nothing in this game is immune to a system. |
| `invisibility` | Never breaks; drops aggro to IDLE | Breaks on attack, cast, interact, container, `COMBAT`. Drops a seen enemy to `SEARCH`, never `IDLE`. Never touches a hitbox. |
| `chameleon` | Reaches 100% | **Hard clamp at 80%.** Morrowind's worst breakage, closed by a clamp rather than by removal. |
| `fortify_attribute` / `fortify_skill` | Refuses to satisfy "important" gates | **Satisfies every gate at evaluation time, including faction rank and spell-tier attunement** (RI-EXP06 B-02 is authoritative and this item defers to it). Bounded by **consequence**: a rank so bought is real and its next quest is at that tier (S9 forbids scaling down; RI-QST03's expulsion machinery is live); an attunement so made survives until the next HEARTH rest, where attunement is re-evaluated against base values. **Nothing is refused; everything is priced.** |
| `mend_item` | Deletes repair from the economy | Cannot repair below 10% condition (that needs a smith) and cannot restore an enchantment's charge. Repair is 27% of RI-PRG05's necessary spend and must stay a cost. |
| `restore_health` | Becomes a free flask | A full `CANTRIP`/`LIGHT` cast with RI-MAG01 §C commitment: **slower than drinking**, cheaper in charges, and paid in Focus you cannot get back. It does not refill the tithe-gourd and is not refilled by it. |

### I. Effects that cross the seam (the AR-3 contribution)

Each of these carries a mechanism from one side of the arbitration boundary to the other and
is demonstrable in a single trace:

| Effect | Crossing |
|---|---|
| `burden` | An out-of-fight-authored stat (equip load) changes an enemy's in-fight movement without touching its telegraph |
| `feather` | An out-of-fight buff moves the player across RI-CMB01's `MEDIUM`/`LIGHT` roll cliff mid-fight |
| `paralyse` | A Morrowind effect resolves as a Souls status meter, and its payoff is a Souls critical |
| `demoralise` / `calm_beast` | A fight ends with no corpse — ARBITRATION §1's "right to disengage" made mechanical |
| `frenzy` | A spell cast outside the fight determines who is alive at the end of one, and the crime system attributes it |
| `speak_to_the_dead` | A corpse produced by combat becomes a `requires.knowledge` key for a non-combat resolution |
| `shock_damage` | A lore fact (wamasu arc through standing water, WLD05 element 13) is also a boss-arena tactic |
| `soul_trap` | A combat action increments a province-wide social counter |

## Comparison method

Static analysis; no browser required for M1–M6.

**M1 — Catalogue census.** Load `game/data/magic/effects.json` and diff it against
`corpus/25-magic/data/effects.json` by `id`.
- **Assert ≥ 40 effects present** and **assert every id in the corpus file exists in the game
  file** with matching `school`, `weight`, `min_tier` and `geometry`.
- **Assert ≥ 12 effects have `changes_traversal == true` or `changes_quest_resolution == true`**
  (corpus figure: 40).
- **Assert the pure-damage-or-heal share is < 40%** (corpus figure: 14.5%). **Hard fail at
  100%** — the G4 threshold.
- **Assert no school has < 8 effects.**

**M2 — Formula fidelity.** Implement §D in the analyser and evaluate against the shipped
spell list `game/data/magic/spells.json`.
- For every shipped spell, recompute `focus_base` from its declared effects/M/D/A/range.
  **Assert the shipped `focus_base` matches the recomputed value exactly, 100% of spells.**
- **Assert the cross term is present** by evaluating the three §D reference spells.
  **Assert `nuke / balanced ∈ [2.6, 3.2]`.** Below 2.0 the cross term has been removed or
  weakened and one-second nukes are optimal again — this is an automatic fail of RI-MAG03.
- **Assert tier assignment follows the §D bands** for every shipped spell, and **assert every
  spell's `skill_req` equals its band's** (RI-PRG03 §6's 0/25/45/65/85).
- **Assert gold price = `round(3.9 × focus_base^1.75)`** within 3%, and **assert the tier-1/2/3
  representative prices land within 5% of RI-PRG05's 220 / 900 / 3,400.**

**M3 — Determinism sweep (S1 for magic).**
- `grep -rniE "random|rand\(|chance|variance|spread|miss" game/src/**/{spell,effect,magic}*`
  and inspect every hit. **Assert none is on a magnitude, duration, contact, status, resist or
  cost path.**
- **Assert no effect record in the shipped data declares a magnitude range** — scan for
  `magnitude_min`/`magnitude_max` pairs on a *spell* (the *effect* may declare a legal range;
  a *spell* must pin a single integer). Any spell with a magnitude range is an automatic fail.
- **Assert no effect declares a `failure_chance`, `resist_chance` or `proc_chance` field.**

**M4 — The levitation bounds (the item's headline test).** Harness required.
1. `setAttuned(["levitate","slowfall"])`, `teleport` to each of 20 sampled exterior points,
   cast, and trace 600 frames of ascent input.
   - **Assert horizontal drift ≤ 1.45 m/s** and **assert it is strictly less than the walk
     speed reported in the same trace.**
   - **Assert `focus` decreases by 1.5 ± 0.05 per metre of net altitude gain**, continuously.
   - **Assert `player.state == "AIRBORNE"` and that `light`, `heavy`, `block`, `roll` and
     `parry` inputs are all dropped**, and **assert `player.iframe == false` on every frame.**
   - Spawn an archer, `aggro`, and let one arrow land. **Assert the levitate effect ends on
     the contact frame** and the player begins falling.
2. **The no-fence assertion.** `grep -rniE "no_levitat|levitation_(banned|blocked|zone)|maxAltitude|ceilingClamp" game/src game/data`.
   **Assert zero hits.** A levitation prohibition flag anywhere in the build **fails this item.**
3. **The ceiling assertion.** For all 8 loop-dungeons and a sample of 25 of the 82 caves,
   `teleport` inside and cast. **Assert the ceiling is < 8 m above the floor at every sampled
   point** — the bound must be geometry.
4. **The canopy assertion.** Rasterise the exterior canopy collider at 5 m.
   **Assert ≥ 65% of walkable exterior area has a collidable canopy at 25–40 m.** Fly above it
   and **assert a hackwing flock aggroes within 45 s**, and that it is R5-tier.
5. **The load-bearing assertion** (delegated to RI-MAG04 M4): ≥ 6 routes, ≥ 3 quest resolutions.

**M5 — The teleport bounds.**
- **Assert `mark`, `recall` and all `intervention` variants declare `class: "RITUAL"`.**
- Live: begin a `recall` and, on frame 40, (a) apply 1 damage, (b) `aggro` an enemy into
  `COMBAT`, (c) inject a `move` input — three separate runs.
  **Assert all three abort, with Focus refunded and no position change.**
- **Assert `recall`'s magnitude is computed, not authored**: mark at three distances and check
  `focus_spend` in the trace against §G's table within ±1.
- **Assert no `intervention` destination is a HEARTH** (S7), by diffing the destination id set
  against `game/data/world/hearths.json`.
- Cross-reference: run RI-TRV02's teleport-as-solvent detector. A failure there is also a
  failure here.

**M6 — The §H rulings (10 probes).** For each row, one targeted probe:
`hist_sight` → **assert zero HUD marker entities are created** and exactly one journal entry
is appended · `detect_life` → **assert no UI-layer entity is created** · `feather`/`burden` →
run RI-CMB01 M5's cliff sweep with the effect active and **assert the discontinuity is still
at exactly 30.00/70.00** · `paralyse` → **assert the status arrives via a buildup field** and
never 0→applied in one frame · `invisibility` → **assert it breaks on all five triggers** and
that a previously-aggroed enemy reaches `SEARCH` not `IDLE` · `chameleon` → **assert the 80%
clamp** by casting magnitude 40 · `mend_item` → **assert an item at 5% condition is
unrepairable** by the spell · `restore_health` → **assert the cast is slower than the 65-frame
flask drink** and that neither refills the other.

**M7 — Blind pair (against the upstream idea, not the upstream numbers).** Hand a fresh
critic our `data/effects.json` field list and a plausible "modern RPG spell list" of 30
authored spells with fixed numbers, unlabeled, and ask: *"which of these is a system a player
can build inside?"* Record the blind pick. If the critic cannot tell them apart, the catalogue
has failed its reason for existing.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Catalogue size | ≥ 55 effects, all four schools ≥ 10 | ≥ 40, no school < 8 | < 40, or a school missing |
| Out-of-fight breadth | ≥ 35 effects change traversal or quest resolution | ≥ 12 | < 12, **or every effect is damage/heal → automatic fail** |
| Formula | 100% of spells recompute exactly; nuke/balanced ratio 2.8–3.0 | 100% recompute; ratio ≥ 2.6 | spells have hand-set costs, **or the cross term is gone → automatic fail** |
| Determinism | zero PRNG on any magic path; no magnitude ranges anywhere | same | any magnitude range, resist roll or failure chance → **automatic fail** |
| **Levitation** | all of M4.1–M4.5 pass; zero prohibition flags; ≥ 6 routes + ≥ 3 quests | M4.1–M4.4 pass, ≥ 4 routes | levitate absent, **or** bounded by a prohibition flag/invisible ceiling — **both are the same failure and both are 0** |
| **Teleport** | RITUAL class, all three aborts, computed magnitude, RI-TRV02 detector clean | RITUAL class + aborts | recall usable in combat, **or** teleport deleted entirely |
| The §H rulings | 10/10 probes pass | 8/10 | any AR-2 marker (`hist_sight`, `detect_life`) → **automatic fail** |
| Economy | prices within 3% of formula and within 5% of RI-PRG05 anchors | within 8% | spell prices are ad hoc |

**Failure threshold: any axis below 6.** The levitation axis has a deliberate symmetry that
should be read twice: **deleting the effect and fencing the effect score identically — zero.**
The sterile answer is not the safe answer here.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **Thirty authored spells.** The most likely failure by a very large margin, because it is
  what every other RPG does and it is *much* easier to implement than a parameter space with a
  price. Nothing breaks. The game ships with a competent spell list, the player never
  discovers that magic is a system, and S19's Morrowind half is a menu. M1 and M2 are the only
  checks that catch it, and M2 must be run against the *shipped* spells, not against ours.
- **Levitation is cut in week three.** It will be cut for exactly one reason — a tester flew
  over a wall — and the cut will be framed as a level-design fix. It is the amputation
  BAR-CRITIQUE-01 G4 names, it removes WLD05's own element 13, and it is scored zero here.
- **Levitation is kept and fenced.** The subtler version, and it scores the same. Someone adds
  `no_levitation_zone` volumes around anything that breaks, and now the world is a set of
  invisible walls with a spell attached. M4.2's grep is deliberately blunt.
- **Focus regenerates.** Every bound in §F2 and §G is denominated in a resource that does not
  come back. A 0.5 FP/s trickle added anywhere makes levitation free flight and recall free
  travel in the same commit, and neither change will be described as touching magic.
- **The cross term is "simplified".** Someone reads `0.55 × M^0.80 × D^0.45`, cannot see what
  it is for, and removes it in a refactor. The formula still looks reasonable. Within a week
  the community-optimal spell is a one-second nuke and every combat encounter in the game has
  one answer. M2's ratio assertion exists solely for this.
- **`hist_sight` ships a waypoint.** It is the natural implementation of "the tree shows you
  where to go", it is a five-line change, and it deletes S8 for the entire game — because once
  one marker exists, every subsequent navigation problem gets solved the same way.
- **The one-second-nuke's cousin: the zero-area-radius-1 spell.** A caster discovers that
  `area_at_range` at A = 0.5 is nearly free and hits everything anyway because the projectile
  radius already covers it. Guard: `area.allowed: false` on most single-target effects, and the
  `projectile` radius table in RI-MAG01 §E is fixed per class, not per spell.
- **Effects that exist in the catalogue and are never referenced.** Fifty-five records in a
  JSON file, twelve of which any quest, route or enemy actually consults. This is RI-PRG02's
  "defined but never read" failure transposed, and it is why RI-MAG04 asserts on quest data and
  M4.5 asserts on routes.
- **Teleport gets a combat variant "for emergencies".** Framed as quality-of-life, it is S19's
  named prohibition and it is the reason `RITUAL` exists as a class rather than as a flag.
- **Paralysis becomes instant and the game becomes unplayable in both directions.** Instant
  paralysis on the player is unfair; instant paralysis on enemies deletes the fight. The
  buildup meter is the only construction where the effect is strong, legible and survivable,
  and it is more work than a boolean.
- **Chameleon reaches 100%.** It is one clamp. It will be forgotten, and the stealth game will
  be over.

## Provenance note

**Everything in this item and in `data/effects.json` is `provenance: constructed`.** No
weight, exponent, coefficient, threshold, magnitude cap or price is measured in or copied
from Morrowind. The generator that produced the artifact is
`corpus/25-magic/data/effects.json`'s own header; all 55 records, both rulings and the entire
cost model are original design for this project and are fully binding.

Three structural debts are `canonical-recall`, confidence **medium**, and are lineage rather
than bar:

1. **The combinatorial effect list itself** — that Morrowind's magic is an effect × magnitude ×
   duration × area × range space with an arithmetic price, rather than a spell list. This is
   the idea we are copying and it is the only thing in this file that is not ours.
2. **The named effects** — Levitate, Slowfall, Mark, Recall, Divine/Almsivi Intervention, Open,
   Water Walking, Water Breathing, Feather, Burden, Telekinesis, Chameleon, Invisibility,
   Silence, Paralyze, Frenzy, Demoralize, Charm, Detect Life/Key/Enchantment, Night Eye, Soul
   Trap, Bound Weapon, Fortify Skill/Attribute, Drain Health. Their *existence* in the Elder
   Scrolls tradition is recalled; every parameter, weight, clamp and ruling here is ours.
3. **The known breakages we are deliberately closing or keeping** — 100% chameleon, the
   one-second-nuke cost exploit, Fortify Skill lock-opening, the Alchemy/Fortify-Intelligence
   loop, and the fact that Oblivion removed levitation outright. Recalled as community
   knowledge; the closures (an 80% clamp, a cross term, a base-vs-fortified boundary) are
   constructed.

Values **inherited** and which must move together if they move at all: the four magic skills
and their governing attributes and the 0/25/45/65/85 tier ladder and the −0.5%/pt Focus
discount (**RI-PRG03 §1, §6**); `gradeCoeff` and `scalingBonus` (**RI-PRG02 §4**); the Focus
pool curve and the class multipliers and the `RITUAL` abort semantics (**RI-MAG01 §A, §B**);
the three spell prices the gold formula is fitted to (**RI-PRG05 §2**).

The two decisions most worth re-litigating with evidence:

1. **`levitate`'s 1.5 Focus/metre ascent tax.** It is the load-bearing bound and it is a
   single number. It was chosen so that a 40 m ascent (60 Focus) plus a 60-second spell
   (25 Focus) exceeds a WIL-30 caster's entire 94-Focus reservoir. If world data shows the
   interesting vertical gaps are 15 m rather than 40 m, this number must rise, not the fence.
2. **The `focus_base / 10` divisor.** It sets the absolute scale of every cost in the game and
   it was calibrated backwards from RI-MAG01 §G's exemplar (Spark-Dart = 4 Focus, 23 casts on a
   full bar). If RI-PRG06's encounter pacing shows a caster running dry in the first third of
   every dungeon, this divisor moves — and every price in §D moves with it, since the gold
   formula is a function of it.

### Amendments requested of other owners

- **RI-PRG05 (progression owner):** §2's price table lists tier-1/2/3 spells only. Requesting
  two rows: **tier-4 8,350 g**, **tier-5 22,200 g**, derived here from
  `round(3.9 × focus_base^1.75)` at the band midpoints. Also requesting that the magic line of
  the 152,900-gold discretionary menu be pinned at **≈28,000 g across 60 purchasable spells**
  (tier mix 26/18/10/5/1) so that RI-PRG05 method 1's sink total can be recomputed against a
  real number rather than an unallocated share. **This adds no gold to the total** — it
  allocates part of an existing line.
- **RI-TRV02 (travel owner):** this item supplies the `mark`/`recall`/`intervention` effect
  records, costs and `RITUAL` class. RI-TRV02 owns the placement predicate, the network graph
  and the teleport-as-solvent detector. Requesting that RI-TRV02's detector run against
  `magic.effects.teleport` and that its verdict be cited by any critic scoring this item.
- **RI-WLD07 / world owner:** §F4 depends on two world properties this item cannot supply —
  that all 8 loop-dungeons are enclosed (already required by RI-WLD07 §2's continuous-space
  rule) and that **≥65% of walkable exterior area carries a collidable canopy at 25–40 m**.
  The second is a new requirement and is requested as an amendment to RI-WLD07 §4's
  verticality targets.
- **RI-AI05 / combat owner:** §F4 requires the hackwing flock to exist as an **R5-tier aerial
  archetype with a fixed aggro timer against `AIRBORNE` targets**. Requested as a roster entry.

### New subsystem paths requested (`subsystems.json`, append-only) — the full `magic.*` set

| Path | `arb` | `area` | `critic` |
|---|---|---|---|
| `magic.casting.frames` | souls | 25-magic | critic.combat |
| `magic.casting.resource` | split | 25-magic | critic.combat |
| `magic.casting.commitment` | souls | 25-magic | critic.combat |
| `magic.casting.geometry` | souls | 25-magic | critic.combat |
| `magic.casting.enemy` | souls | 25-magic | critic.combat |
| `magic.effects.catalogue` | morrowind | 25-magic | critic.magic |
| `magic.effects.parameters` | morrowind | 25-magic | critic.magic |
| `magic.effects.utility` | morrowind | 25-magic | critic.magic |
| `magic.effects.traversal` | split | 25-magic | critic.magic |
| `magic.effects.teleport` | split | 25-magic | critic.world |
| `magic.spellmaking.combination` | morrowind | 25-magic | critic.magic |
| `magic.spellmaking.cost` | morrowind | 25-magic | critic.magic |
| `magic.enchanting.items` | morrowind | 25-magic | critic.magic |
| `magic.enchanting.soulgems` | split | 25-magic | critic.progression |
| `magic.gating.skills` | morrowind | 25-magic | critic.progression |
| `magic.economy.prices` | morrowind | 25-magic | critic.progression |
| `magic.quests.solutions` | morrowind | 25-magic | critic.quests |
| `magic.vfx.artdirection` | art-direction | 25-magic | critic.artdirection |
| `magic.vfx.fidelity` | modern-fidelity | 25-magic | critic.fidelity |
| `magic.diegesis.lore` | morrowind | 25-magic | critic.lore |

Plus one critic: **`critic.magic`** — *"Judges the effect catalogue, spellmaking, enchanting
and utility magic outside the fight. Must run the static analyser over `game/data/magic/**`
and the quest analyser over `game/data/quests/**`, never source."* If the taxonomy owner
prefers not to add a critic, the fallback is `critic.progression` for
`magic.effects.*`/`magic.spellmaking.*`/`magic.enchanting.*` and `critic.quests` for
`magic.quests.solutions`. **`magic.casting.*` must stay with `critic.combat` in either case** —
they are inside the fight and AR-1 applies.
