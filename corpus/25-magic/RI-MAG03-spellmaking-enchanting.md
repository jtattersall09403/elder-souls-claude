---
id: RI-MAG03
title: Spellmaking and enchanting — the maker's systems, the soul-gem ruling, and eleven sanctioned breakages
kind: structure
side: morrowind
judges: [magic.spellmaking.combination, magic.spellmaking.cost, magic.enchanting.items, magic.enchanting.soulgems, magic.gating.skills, magic.economy.prices, magic.diegesis.lore]
provenance: constructed
confidence: high
blind_pair: no
---

> **Seam S19, outside the fight — "spellmaking, enchanting, and utility magic are first-class
> systems".** Depends on RI-MAG02's catalogue and cost formula, RI-PRG03's skill gates,
> RI-PRG05's economy, and RI-LOR05 §3's ruling on `xul-hesh`.
> Contributes eleven entries to **RI-EXP06**'s permissiveness register.

## The bar

There are two ways to ship magic. In the first, a designer writes spells and the player reads
them. In the second, a designer writes *parts* and the player writes the spells. Morrowind is
the only mainstream RPG that ever committed fully to the second, and the moment a player
realises they can walk into the Mages Guild and construct an object that has never existed
before, priced by a formula that does not care whether the object is sensible, the game stops
being something you consume. **That moment is what this item exists to make possible, and the
success test is blunt: a critic must be able to build, buy and cast a spell that appears
nowhere in `game/data/magic/spells.json` as shipped.** If the spellmaking UI can only assemble
authored combinations, we have shipped a spell list with extra steps.

Enchanting is the same argument applied to objects, and it carries a second load: it is the
caster's **sustain**. Focus never regenerates (RI-MAG01 §A), so an enchanted item — with its
own charge pool, refilled from soul gems — is the only renewable magic in the game. That makes
soul gems structurally load-bearing, and soul gems are where this area collides with S15.

## The reference artifact

### A. Spellmaking

**Where.** At a **spellwright** — a named NPC service, four in the world (Lilmoth, Gideon,
Helstrom, and one Telvanni-analogue recluse in the Stone Wastes gated behind a quest). Not a
menu you carry. Walking to one is part of the cost, which is Morrowind's shape and S7's.

**Prerequisites, all deterministic (S1 — there is no roll anywhere in this system):**

| Gate | Rule |
|---|---|
| **Effect knowledge** | You may only combine effects you already own a spell for. You cannot invent `paralyse` by naming it; you must own a `paralyse` spell first. This is what makes buying a cheap tier-1 spell of a new effect a real purchase. |
| **Tier gate, per effect** | Your school skill must be ≥ the tier requirement of the **resulting** spell's `focus_base` band (RI-MAG02 §D), evaluated **per effect's school**. A two-school spell is gated by both. |
| **Effect count** | `max_effects = 1 + floor(highest_relevant_school_skill / 25)`, capped at **5**. Skill 5 ⇒ 1 effect. Skill 25 ⇒ 2. Skill 50 ⇒ 3. Skill 75 ⇒ 4. Skill 100 ⇒ 5. |
| **Attunement** | The finished spell still obeys RI-PRG03 §6: **below the tier requirement it cannot be attuned at all.** Making a spell you cannot yet carry is legal and is MB-3. Per §E2 a fortify effect **does** satisfy this gate at the moment of attunement, and attunement is re-evaluated against base values at the next HEARTH rest. |
| **Cost ceiling** | **None.** You may commission a spell whose `focus_cost` exceeds your `focus_max`. See MB-3. |

**Price.** `gold = round( 1.6 × spell_gold_price ) + 150`, where `spell_gold_price` is
RI-MAG02 §D's `round(3.9 × focus_base^1.75)`. The 1.6 is the spellwright's markup — making is
always more expensive than buying an equivalent authored spell, which is why the authored list
is not dead content.

| Your spell | `focus_base` | Buy an equivalent | **Commission it** |
|---|---:|---:|---:|
| `slowfall` 20 s | 3 | 27 g | **193 g** |
| `fire_damage` M 30 / 30 s / projectile | 25 | 1,090 g | **1,894 g** |
| `open_lock` tier 3 | 25 | 1,090 g | **1,894 g** |
| `chameleon` 60% / 120 s | 38 | 2,268 g | **3,779 g** |
| `levitate` 60 s | 25 | 1,090 g | **1,894 g** |
| `recall` (computed at cast; base price at M 20) | 34 | 1,876 g | **3,152 g** |

**The failure cases, and what each does** — none of them is a refusal:

| Case | Behaviour |
|---|---|
| `focus_cost > focus_max` | **Made and sold.** The UI shows the number and shows your maximum. It is uncastable until WILLPOWER catches up, and that is a legitimate goal to have. |
| Effect count over the skill cap | Refused, with the exact skill number required stated. |
| Tier over your school skill | Made and sold; **unattunable** until the skill is reached (RI-PRG03 §6). |
| Magnitude over the effect's `magnitude.max` | Clamped to the max, and the clamp is shown. |
| Duration on a `duration.allowed: false` effect | Forced to 0, and the forcing is shown. |
| `area` on an `area.allowed: false` effect | Forced to 0, and the forcing is shown. |
| Two effects whose combination is nonsense (`invisibility` + `fire_damage` area) | **Made.** Nonsense is the player's business. Nothing in this system adjudicates taste. |
| Not enough gold | Refused. Gold is the only currency (S15). |

**There is no spell-failure chance and no cast-failure roll anywhere in this system.** Morrowind
had both; both are deleted by S1 and their deletion is a ruling, not an oversight.

### B. Enchanting

**There is no Enchant skill.** RI-PRG03 ships exactly 19 skills and adding a 20th would
invalidate its §3 event budget and RI-PRG02's 27-earned-attribute-points arithmetic. Enchanting
is instead gated by **the relevant school skill** and by **who is doing it** — which makes it a
social and geographic system rather than a grind, and that is more Morrowind, not less.

| Enchanter | Max enchant points | Gold |
|---|---:|---|
| **Yourself** | `floor(0.9 × highest relevant school skill)` — 58 at skill 65, 90 at 100 | Free (gem + item only) |
| **Journeyman** (4 in the world) | 70 | `round(6.5 × points^1.35)` |
| **Master** (2 in the world) | 110 | `round(6.5 × points^1.35) × 1.4` |
| **The Stone Wastes recluse** (1, quest-gated) | **160** | `round(6.5 × points^1.35) × 2.0` |

**Enchant point cost** of an effect set:

| Enchantment kind | Points | Charge spent per activation |
|---|---|---|
| `on_use` (activate from the item) | `ceil(focus_base × 2.5)` | `focus_base × 4` |
| `on_strike` (fires on a weapon's hit) | `ceil(focus_base × 4.0)` | `focus_base × 4` |
| `constant` (always on; duration forced to 0 in the formula) | `ceil(focus_base × 18)` | none — **but a `constant` enchantment can only be made from a `greater` or `grand` soul** |

**Item enchant capacity:**

| Item | Capacity |
|---|---:|
| Robe / clothing | 30 |
| Ring / amulet | 60 |
| Light armour piece | 55 |
| Medium armour piece | 75 |
| Heavy armour piece | 100 |
| Shield | 90 |
| One-handed weapon | 70 |
| Two-handed weapon | 110 |

Worked: a ring of `open_lock` tier 2 (`focus_base` 15) `on_use` costs `ceil(15 × 2.5)` = **38
points** — fits a 60-point ring, 60 charge per use. Tier 3 (`focus_base` 25) costs **63
points** and does *not* fit a ring; it needs a weapon or heavy armour. A `constant`
`resist_element` at 30% (`focus_base` 3) costs **54 points** and fits medium armour. A
`constant` `fortify_attribute` +5 (`focus_base` 2) costs **36 points**. The `×18` on `constant`
is what stops the endgame being a walking permanent-buff statue.

**Charge and recharge.** An enchanted item's charge pool is set by the soul used to make it and
is **refilled only by consuming another filled soul gem**. Excess is discarded. **Charge is not
Focus, is not restored at a HEARTH, and is not purchasable.** This is the caster's renewable
resource and the reason the gem economy exists mechanically as well as politically.

### C. ⚖ RULING — SOUL GEMS AND SEAM S15

The problem stated plainly: **souls level you and only level you; gold is the only currency
(S15).** Morrowind's soul gems are (a) enchanting fuel, (b) recharge fuel, and (c) the single
largest money exploit in that game — trap a soul, enchant a cheap item, sell it, repeat.
Importing them naively would create a second currency, and importing them as a currency would
destroy S15 outright.

RI-LOR05 §3 has already done the hard part. `Xul-hesh` — root-theft — is established: a soul
gem takes a soul that would have gone down to the Hist and puts it in a rock, which reads
locally as somewhere between poisoning a well and kidnapping, and Molag Bal is its patron
whether the traders know it or not. The gem trade is **Cause A of the main-quest crisis**. All
this ruling has to do is refuse to let the mechanics contradict the fiction.

**Six clauses. All binding.**

**SG-1 — A soul gem never contains `xul-teekh`.**
Sap-debt (the levelling currency) and gem-soul are **different substances in the fiction and
different quantities in the code.** Killing a creature yields its full sap-debt to you,
*always*, whether or not you also trapped it. Soul-trapping does not reduce, replace, convert,
increase or substitute for your souls, in either direction. The two economies never touch at
any point. This is what makes the gem system **additive** rather than a second currency, and it
is the clause a critic checks first: `grep` every code path where a gem is filled or spent and
**assert `souls` is never read or written on any of them.**

**SG-2 — A gem's contents are denominated in `charge`, and `charge` has exactly two sinks.**
Enchanting an item, and recharging an enchanted item. It cannot be spent on levelling, buying,
bribing, training, travel, lodging, repair or a fare. A thing with two sinks and no
medium-of-exchange role is not a currency; it is a consumable, like a lockpick.

**SG-3 — A filled soul gem may not be sold, at any price, by anyone, ever.**
`sell_value: null`, not `0` — the distinction matters, because `null` means *there is no
transaction here*, and `0` means *this is worthless*, which it emphatically is not. This is the
clause that protects RI-PRG05's flip invariant and closes Morrowind's largest exploit, and it
is airtight in fiction rather than arbitrary: an Argonian merchant will not touch one. The
smugglers who *do* buy filled gems are not a merchant — **they are a quest**, with a faction, a
price paid in reputation, and consequences that outlive the sale. Empty gems are ordinary
crystal and are freely bought, sold and carried.

**SG-4 — An enchantment adds full value on purchase and zero value on sale.**
You pay for the enchantment when you buy an enchanted item; you are paid the **base item's**
value when you sell one you made. The asymmetry is deliberate and it is the second half of the
flip-invariant defence (RI-PRG05 §3: `max(sell) = 0.60 < min(buy) = 0.80` must hold under all
special cases). Diegetically: nobody in this province will pay you extra for a stolen soul in a
knife. Between SG-3 and SG-4, **there is no path from magic to gold**, which is the whole
requirement.

**SG-5 — Grand and greater souls are hand-placed, and filling is not farmable.**
Empty gems are purchasable at every grade because they are just crystal. **Filled** ones are
not, and the souls large enough to fill the top grades come from **named, non-respawning
creatures** (S5 protects named actors). The anti-farm rule, stated as a mechanic:

> **A respawned creature yields a soul one grade lower than its first death**, floored at
> `petty`. Soul grade is a property of an individual, not of an archetype.

So resting to respawn an elite and re-trapping it produces a diminishing return that bottoms
out immediately, and the twelve grand souls and twenty-two greater souls in the world are a
**finite hand-placed resource** exactly as RI-PRG08's upgrade materials are. Gem grades:

| Grade | Charge | Source | Count in the world |
|---|---:|---|---:|
| Petty | 80 | small fauna | empty: purchasable |
| Lesser | 180 | ordinary fauna | empty: purchasable |
| Common | 400 | elite fauna | empty: purchasable |
| **Greater** | 900 | named creatures only | **22 fillable sources** |
| **Grand** | 2,000 | named creatures only | **12 fillable sources** |
| **The Unfilling Stone** | 900, **reusable** | one artifact, quest-gated | **1** |

**NPC souls cannot be trapped.** `soul_trap` on anything that can speak does nothing and the
Focus is spent. There is exactly one exception in the game and it is a main-quest artifact
whose use is the transgression the plot is about.

**SG-6 — Root-theft is tracked, and it costs you socially, never mechanically in a fight.**
A `xul_hesh` counter increments on every soul trapped and every enchantment made. It:

- moves **Argonian disposition province-wide** on the same model as WLD05 element 27's egg-law;
- **gates two faction lines in opposite directions** — the Deep-Kin (`xul-aneekh`) close, the
  Imperial/Telvanni-analogue enchanting interest opens;
- becomes **visible on the player** at high counts, in RI-LOR05's taint idiom;
- and **never touches frames, hitboxes, telegraphs, damage or AI** (AR-1, RI-LOR05 §7 rule 4).

The player is never told any of this. RI-LOR05 §3 is explicit: *"They should not be told; they
should be shown, repeatedly, and left to work it out."* A tooltip explaining the soul-gem
penalty is a defect.

**What this ruling buys.** The maker's system is fully alive — you can trap, enchant, recharge,
and build the item you wanted. S15 is untouched: souls still buy exactly one thing. Morrowind's
biggest money exploit is closed by a rule the world already believed. And enchanting has become
a **political act**, which is the strongest AR-3 crossing this area produces.

### D. The sanctioned breakages — eleven entries for RI-EXP06's register

A breakage is a thing the player does that the designer did not intend, that *works*, and that
we commit to keeping working. Each entry states what it is, why it survives, what it costs, and
**the test that fails if the breakage stops working** — the register is asserted-to-work, so an
unrun probe scores zero.

| # | The breakage | Why it survives | What it costs the player | The test that FAILS if it stops working |
|---|---|---|---|---|
| **MB-1** | **Levitate/slowfall into a region you have no business in.** Climb a cliff at level 12 and walk into R5. | S9 gates by lethality, never by level. A world you can only enter in the intended order is not a world. | It kills you, and your sap-debt stays where you dropped it. | Scripted run: `levitate` from an R2 vantage into R5. **FAIL if the crossing is blocked, teleported back, or fenced.** |
| **MB-2** | **Fortify Skill across a gate.** `fortify_skill` Security +40 at base Security 40 opens a tier-5 seal. Same family as RI-EXP06 **B-02**, at a lower stake; where they overlap, B-02 wins (§E2). | A temporary skill is still a skill, and RI-PRG03's gates are deterministic thresholds evaluated at a moment. Every gate is satisfiable this way, station gates included. | The spell is tier 3 and expensive; the item behind the seal is hand-placed (S12), so you get one thing early and nothing else. On a *station* gate the cost is larger and is B-02's: the rank is real and its quests are at that tier. | Set Security 40, cast `fortify_skill` +40, attempt a tier-5 lock. **FAIL if it refuses**, and **FAIL if a base-skill-only evaluation appears anywhere.** |
| **MB-3** | **Commissioning a spell no designer authored** — including one you cannot cast. | This is the entire point of spellmaking. A UI that only assembles authored combinations has deleted the system. | Gold, at a 1.6× markup, for an object that may be useless. | Build a 3-effect spell absent from `spells.json`; buy it; cast it. **FAIL if the UI refuses any legal combination, or if the spell does not appear in the save.** |
| **MB-4** | **Telekinesis theft through geometry.** Lift a ledger off a desk through a window, outside a guard's cone. | The crime system already handles being seen. Reach is not the same as impunity. | 25 m of reach, a spell slot, and the crime still counts if witnessed. | Place an owned item behind a barred window; steal it with `telekinesis` from outside. **FAIL if the interaction is range-clamped to melee.** |
| **MB-5** | **Frenzy as an indirect murder weapon.** Frenzy a guard into killing your quest target. | Two systems (disposition/AI aggression and crime attribution) producing a result nobody wrote. This is RI-EXP02's T4 class, verbatim. | If **anyone with line of sight saw the cast**, every consequence is attributed to you: bounty, faction standing, and S10's severed thread if the victim mattered. **Produces permanent unrecoverable world state.** | Frenzy an NPC into a lethal fight. **FAIL if the death is unattributed, or if the target is immune, or if the world state reverts.** |
| **MB-6** | **Bound weapon as an early-game power spike.** A tier-2 conjured blade that outclasses everything in R1–R2. | Morrowind's exact bargain: free excellence early, a dead end late. | Fixed grade, **no upgrade path** (RI-PRG08), weight 0, and it is obsolete by R4 while your +7 real weapon is not. | Conjure at level 8 and clear an R2 encounter. **FAIL if the weapon scales, upgrades, or is nerfed to parity with starting gear.** |
| **MB-7** | **Drain Health self-cast to pass a threshold.** Lower your own max HP to survive a scripted check, then let it expire. | It is a legal reading of a legal effect and it is *clever*. Cleverness is the reward. | You are at reduced max HP in a place designed to kill you. | Self-cast `drain_health`, cross a max-HP-gated trigger. **FAIL if self-targeting is blocked or the trigger reads base HP.** |
| **MB-8** | **Enchantment stacking to reach a magnitude you cannot cast.** Three `constant` items summing to an effect strength your Focus pool could never afford in one cast. | Enchanting is the caster's renewable resource; converting scarcity into permanence is what it is *for*. | 34 finite greater/grand souls in the entire world, and the enchant-capacity table. Also the 80%/85% clamps, which are global. | Equip three `constant` items and measure the summed effect. **FAIL if stacking is blocked outright** (a *clamp* is not a block). |
| **MB-9** | **The Unfilling Stone as an infinite enchanting engine.** One reusable greater gem, quest-gated. | Safe **only because SG-3 and SG-4 already closed the money loop**. With no path from enchantment to gold, an infinite gem buys convenience, not economy. This is the register's clearest illustration of why closing the right hole lets you leave the fun one open. | It is one quest deep, it is greater-grade not grand, and every use increments `xul_hesh`. | Fill, enchant, refill 20 times. **FAIL if the stone is consumed, capped, or if the resulting items become sellable.** |
| **MB-10** | **Paralysis/demoralise as a total fight bypass.** Paralyse the room, walk past, take nothing, kill nobody. | ARBITRATION §1 names paralysis explicitly as a legitimate non-lethal outcome, and "the right to disengage" is Morrowind's retained right *inside* the fight. | You get no sap-debt, no loot beyond what you can pick up, and the enemies are still there on the way back. | Paralyse an R4 group and reach the far exit without a kill. **FAIL if any enemy is paralysis-immune by flag, or if the exit is combat-locked.** |
| **MB-11** | **Opening a quest door before you were told it existed.** `open_lock` on a sealed door the journal has not mentioned. | S8 means the world is navigated, not signposted. A door that only opens after a flag is a corridor pretending to be a place. | You arrive without context, the room's occupants react to a stranger, and you may have burned a resolution you would rather have had. | `open_lock` a quest-flagged door at stage 0. **FAIL if the lock is unpickable-until-flagged, or the interior is unloaded.** |

**The governing cross-rule this item accepts (RI-EXP06's, restated as a binding obligation on
`corpus/25-magic/`):**

> **No new anti-exploit hard fail may be added anywhere in `25-magic` without naming the MB
> entry it leaves open.**

The hard fails this item and RI-MAG02 *do* add, each with the entry it preserves:

| Hard fail added | The breakage it deliberately leaves open |
|---|---|
| Filled gems unsellable (SG-3) | MB-9 — the reusable gem is safe *because* of this |
| Enchantment adds no sale value (SG-4) | MB-8, MB-9 |
| Respawn soul-grade downgrade (SG-5) | MB-8 — finite souls make stacking a decision, not a grind |
| `chameleon` clamped at 80% | MB-10 — bypass stays available through paralysis and demoralise, which cost resources |
| Resist clamped at 85% | MB-8 — stacking still works, it just cannot reach immunity |
| The `M^0.80 × D^0.45` cross term | MB-3 — the nuke is buildable, it is simply priced |
| Fortify does not satisfy **station** gates | MB-2 — fortify still satisfies every **action** gate |
| Focus never regenerates | MB-1, MB-10 — both remain available, both are budgeted |

### E. Resolving RI-EXP06's conditional entry, and one deference

RI-EXP06 landed in the same wave and two of its register entries were written against an empty
`corpus/25-magic/`. Both are resolved here rather than left to drift.

**E1 — B-08 (Enchantment self-supply) is NOT struck. It is re-based, and it survives intact.**

RI-EXP06 §B-08 is *"a constant-effect enchantment supplies the magicka to cast the spell that
fills the soul gem that pays for the next enchantment"*, marked conditional because *"whether
soul gems exist at all is an open ruling"* and because the register may not fall below twelve
live entries.

Soul gems exist (§C). The loop exists. **Only its plumbing changes**, because RI-MAG01 §A rules
that nothing restores Focus — so the literal "enchantment supplies the magicka" clause cannot
stand. It does not need to:

> An **`on_use` enchantment of `soul_trap`** costs **no Focus at all.** Enchanted items run on
> **charge**, not on Focus (§B), and charge comes from gems. So: trap with the enchanted item →
> fill a gem → spend part of that gem recharging the item and the rest funding the next
> enchantment. **Zero Focus, zero gold, two systems meeting.** That is B-08's substance exactly,
> and it is arguably a cleaner instance of it than the magicka version, because the loop is
> closed entirely inside the enchantment economy.

**B-08's probe `PB-08` passes unmodified** — *"enchant → trap → enchant, two rungs; assert the
second enchantment is fundable entirely from resources produced by the first; assert no per-day,
per-rest or per-session cap fires."* Nothing in §C caps it per day, per rest or per session.
What bounds it instead is **SG-5's finite hand-placed greater/grand sources and the respawn
soul-grade downgrade** — a *scarcity*, which PB-08 does not red on, not a *cap*, which it does.
And S15 is untouched for the reason B-08 already states and §C now rules formally: sap-debt and
gem-charge are different substances.

**RI-EXP06 should amend B-08's `What it is` clause to the charge-based formulation above and
lift the conditional.** It stays `Sys ✔` and it stays live.

**E2 — B-02 (Fortify-skill stacking into a rank you have not earned): this item defers.**

An earlier draft of RI-MAG02 ruled that fortified values satisfy *action* gates but never
*station* gates — faction rank, spell-tier attunement, quest rank. **That ruling is withdrawn.**
RI-EXP06 is the permissiveness owner, its argument is better, and its argument is that the bound
should be a **cost**, not a **refusal**: the rank is real, the next quest is at that tier, S9
forbids scaling it down, and RI-QST03's expulsion machinery is live. A prohibition where a
consequence would do is exactly what the permissiveness budget exists to prevent.

The amended ruling, now in `data/effects.json` under both fortify effects:

> **Fortified values satisfy every gate at the instant it is evaluated**, faction rank and
> spell-tier attunement included. **Attunement is re-evaluated against base values at every
> HEARTH rest**, so a tier-5 spell attuned on a lapsed buff is dropped from its slot at the next
> rest — you may carry it into the dungeon, and you may not keep it for free. Fortified skill
> still grants **no** skill progress (RI-PRG03's Cost Gate is untouched: a fortified use consumed
> nothing of yours).

**MB-2 below is therefore the same breakage RI-EXP06 calls B-02, at a lower stake** (an action
gate rather than a station gate), and the two entries should be read as one family. Where they
overlap, **RI-EXP06 wins.**

## Comparison method

**M1 — The unauthored-spell assertion (this item's headline test).**
1. Read `game/data/magic/spells.json` and enumerate every shipped `(effect-set, M, D, A, range,
   class)` tuple.
2. Construct **20 tuples that are legal under RI-MAG02's parameter declarations and are absent
   from that set**, including at least: one 3-effect spell, one at an effect's `magnitude.max`,
   one at `duration.max_s`, one whose `focus_cost` exceeds `focus_max`, and one deliberately
   nonsensical (`invisibility` + area `fire_damage`).
3. Drive the spellmaking UI through the harness for each. **Assert 19 of 20 are produced**
   (the effect-count-over-skill-cap case is the legal refusal), **assert each appears in
   `saveState()`**, and **assert each computes the `focus_base` RI-MAG02 §D predicts, exactly.**
4. Cast the ones that are castable and **assert the observed effect matches the commissioned
   magnitude.**
- **FAIL if any legal combination is refused for any reason other than the four declared gates.**
  A whitelist of designer-approved combinations is an automatic fail of this item.

**M2 — Gate determinism.** For each of the four spellmaking gates, probe at
`threshold − 1` and `threshold`, **100 trials each**. **Assert failure is total and success is
total.** Any probabilistic gate reintroduces the dice S1 abolished (RI-PRG03 method 7's rule,
applied here).

**M3 — Enchanting arithmetic.** For 30 (item, effect-set, kind) triples spanning all three
enchantment kinds and all eight item classes:
- **Assert points = `ceil(focus_base × {2.5, 4.0, 18})` exactly**, and **assert the capacity
  table is enforced** (a 63-point enchantment must be refused on a 60-point ring).
- **Assert `constant` is refused for petty/lesser/common souls.**
- **Assert self-enchant ceiling = `floor(0.9 × school skill)`** by probing at skill 64/65/66.
- **Assert gold = `round(6.5 × points^1.35)` × the enchanter's multiplier**, within 3%.
- **Assert charge spent per activation = `focus_base × 4`**, and that a depleted item does
  nothing and consumes nothing.

**M4 — THE S15 FIREWALL (the ruling's test, and the most important check in this item).**
- `grep -rn "souls\|xul_teekh\|sapDebt" game/src/**/{soulgem,enchant,magic}*` — **assert the
  souls quantity is never read or written on any gem, enchant or recharge path** (SG-1).
- Live: record `souls` before and after (a) trapping a soul, (b) enchanting an item, (c)
  recharging one, (d) killing a creature with `soul_trap` active versus without.
  **Assert `souls` is identical in the trapped and untrapped kills, and unchanged by (b) and
  (c).**
- **Assert every filled-gem item record has `sell_value: null`** and that **no merchant record
  anywhere accepts a filled gem** — attempt to sell one to all 29 merchants (RI-PRG05 §4).
  **Any sale is an automatic fail of this item and of RI-PRG05.**
- **Assert the sale price of a self-enchanted item equals the sale price of its unenchanted
  base**, over 40 item/enchantment pairs.
- **Re-run RI-PRG05 method 4's flip-invariant fuzz (10,000 tuples) with enchanted items and
  gems in the item pool.** **Assert `max(sell/buy) ≤ 0.76` still holds.** This is the check
  that proves the ruling did its job.
- **Assert no price field anywhere in `game/data/**` is denominated in `charge` or in souls.**

**M5 — Anti-farm.** Kill and trap a named greater-soul creature; rest at a HEARTH 20 times and
re-trap whatever respawns.
- **Assert the first trap yields `greater` and every subsequent one yields at most `common`,
  decaying to `petty`.**
- **Assert the world contains exactly 22 greater and 12 grand fillable sources**, by scanning
  `game/data/combat/enemies/**` for `soul_grade`.
- **Assert no merchant sells a filled gem** (M4 covers the reverse direction).
- **Assert `soul_trap` on any NPC with a dialogue record does nothing**, and that the Focus is
  still spent, for 20 sampled NPCs.

**M6 — `xul_hesh` consequences.** Trap 15 souls in view of Argonian NPCs.
- **Assert province-wide Argonian disposition moves** (diff `getQuestState().flags` and NPC
  disposition records before/after).
- **Assert at least one faction line closes and at least one opens.**
- **Assert zero change** to any frame, hitbox, telegraph, damage or aggro value: record two
  combat traces at `xul_hesh = 0` and `xul_hesh = 15` against the same enemy at the same seed
  and **assert `body_sha256` is identical.** **Any diff is an AR-1 automatic fail** (this is
  RI-LOR05 method 6's taint-fairness harness, reused).
- **Assert no UI string explains the penalty** (RI-LOR05 §3's show-don't-tell rule).

**M7 — THE BREAKAGE REGISTER (run every wave; unrun probes score 0).**
Execute all eleven MB tests in §D as written. Each is a scripted scenario producing a trace.
- **Report pass/fail per entry in the verdict, individually and by id.**
- **≥ 10 of 11 must pass.** Below 9 the permissiveness budget for magic has collapsed and the
  item fails regardless of every other score.
- For every failing entry, the verdict must name **which anti-exploit rule closed it** — that
  is the diagnostic the cross-rule exists to produce.

**M8 — Economy cross-check.** Sum every purchasable spell and enchanting service in
`game/data/**`. **Assert the magic line totals 28,000 g ± 15%** against RI-PRG05's 152,900-gold
discretionary menu, and **re-run RI-PRG05 method 1** with magic included. **Assert
`income/sinks` stays in `[0.38, 0.53]`.**

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Unauthored spells | 19/20 produced, all costs exact | 15/20 produced | any whitelist of approved combinations → **automatic fail** |
| Gate determinism | 100/100 both sides, all four gates | same | any probabilistic gate |
| Enchanting arithmetic | all 30 triples exact; capacity + soul-grade gates enforced | ≤ 2 deviations | costs are hand-set per item |
| **S15 firewall** | souls untouched on every gem path; filled gems unsellable at all 29 merchants; enchantment adds 0 sale value; flip invariant holds under fuzz | same | **any** of: souls readable from a gem path, a filled gem sold, an enchantment adding sale value → **automatic fail** |
| Anti-farm | downgrade on respawn; 22/12 sources exact; NPC souls untrappable | downgrade present | grand souls farmable from respawns |
| `xul_hesh` | disposition moves, two factions react, trace sha identical, no explanatory UI | disposition moves, trace identical | any combat diff → **AR-1 automatic fail** |
| **Breakage register** | 11/11 | 10/11 | ≤ 8 → **item fails regardless of all other axes** |
| Economy | magic line within 10%, PRG05 ratios hold | within 15% | prices ad hoc, or PRG05's ratio band broken |

**Failure threshold: any axis below 6.** Two axes are the item's reason for existing and cannot
be traded against the others: the **S15 firewall** (which is what makes the system legal) and
the **breakage register** (which is what makes it worth having).

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **Spellmaking ships as a spell *shop*.** The most likely failure. The UI lists authored
  spells, the "custom" tab is cut in week four because the cost preview was fiddly, and the
  entire second half of S19 evaporates while every other check still passes. M1 is the only
  instrument that detects it and it must be run against the *shipped* combination set.
- **Soul gems become a second currency.** Someone needs an early-game sink, gems are right
  there with a number on them, and a merchant starts buying them. S15 does not die loudly — it
  dies as a merchant inventory entry. M4's sell-attempt against all 29 merchants exists for
  exactly this, and it must be exhaustive rather than a spot-check.
- **The enchant-and-sell loop.** Trap, enchant, sell, repeat. It is Morrowind's actual, famous
  money machine, it will be reproduced faithfully by anyone implementing enchanting from
  memory, and it makes RI-PRG05's entire 98,000-gold balance sheet fiction within one hour of
  a player finding it. SG-3 and SG-4 are two lines of data and both will be forgotten.
- **`xul_hesh` is implemented as a debuff.** A −5% something with an icon. The canon reading is
  that root-theft is *kidnapping*; the only honest implementation is social, permanent, and
  never explained. A mechanical penalty is both weaker and an AR-1 risk.
- **`xul_hesh` is implemented as nothing.** The counter increments and no NPC in the game has a
  line about it. This is RI-LOR05's "the explanation stays in the corpus" failure, and it is
  more likely than the debuff.
- **The breakage register is never run.** It is eleven scripted scenarios, they take a while,
  and they test things that *should* work — which is exactly the kind of test that gets skipped.
  RI-EXP06 scores unrun probes as zero for this reason and this item adopts that.
- **Anti-exploit creep.** A patch closes MB-2 because a tester opened a tier-5 lock "too early",
  and nobody notices that the fix also closed the only route a low-Security caster had. The
  cross-rule — name the entry you leave open — is the entire defence and it is a process rule,
  which means it will be the first thing dropped under time pressure.
- **`constant` enchantments become the whole endgame.** If the `×18` multiplier is softened to
  `×8` "so constant effects are usable", every late-game character is wearing six permanent
  buffs and the Focus reservoir stops mattering. The multiplier is load-bearing.
- **An Enchant skill gets added.** It is the obvious thing to do, it is what Morrowind did, and
  it silently breaks RI-PRG03 §3's event budget and RI-PRG02 §2's 27-point earned-attribute
  figure — two items that will not be re-derived, and two numbers nobody will notice are wrong.
- **NPC souls become trappable** because a designer wants a dramatic moment. It is one flag and
  it converts a political system into a farming one, since NPCs are the densest soul source in
  any settlement.
- **The four spellwrights become one, in the starting town.** Then spellmaking is a menu,
  walking is not part of the cost, and S7's whole argument that distance is content is
  undermined by a convenience nobody defended in writing.

## Provenance note

**Everything in this item is `provenance: constructed`.** No multiplier, capacity, charge
value, gem count, price coefficient or gate threshold is measured in or copied from Morrowind.

Three structural debts are `canonical-recall`, confidence **medium**, and are lineage:

1. **Spellmaking as a service you walk to**, gated on already knowing an effect, priced by the
   same formula that prices bought spells, and permitting combinations no designer authored.
   This is the idea being reproduced and it is the only thing here that is not ours.
2. **Enchanting with soul gems of graded size**, `cast-when-used` / `cast-on-strike` /
   `constant-effect` as the three kinds, and per-item enchant capacity. Shape recalled;
   every number ours.
3. **The exploits.** That Morrowind's enchant-and-sell loop was its dominant money strategy,
   that a reusable soul gem (Azura's Star) existed, that Fortify Skill opened locks, that
   100% Chameleon trivialised the game, and that Oblivion removed spellmaking and levitation
   outright. Recalled as community knowledge, confidence medium; **the closures and the
   sanctions are constructed rulings.**

Values **inherited** and which must move together if they move at all: the cost formula, the
`focus_base` bands and the gold formula (**RI-MAG02 §D**); the 19-skill sheet, the
0/25/45/65/85 tier ladder and the Cost Gate (**RI-PRG03 §1, §4, §6**); the flip invariant, the
four un-buyables, the 29 merchants and the 152,900-gold discretionary menu (**RI-PRG05 §3, §4,
§6**); `xul-hesh`, Molag Bal's patronage, and the sap-debt/gem-soul distinction
(**RI-LOR05 §3, §4**); the Focus reservoir and its non-regeneration (**RI-MAG01 §A**).

The three decisions most worth re-litigating with evidence:

1. **`constant`'s `×18` multiplier.** It is the only thing standing between the late game and
   permanent-buff stacking, and it was set so that a 30% `resist_element` (54 points) consumes
   most of a heavy armour piece. If world data shows players never make a `constant`
   enchantment at all, it is too high; if every endgame character has four, it is too low.
2. **22 greater / 12 grand fillable sources.** These are budgets handed to the world and
   combat owners, not measurements — the same honesty RI-PRG05 states about its income side.
   When `game/data/combat/enemies/**` exists, M5 must be re-run against the shipped totals and
   this table amended.
3. **The eleven-entry register.** Eleven is a floor chosen to clear RI-EXP06's ≥12 requirement
   in combination with the other areas' entries, and the specific eleven are the magic
   breakages I judged most valuable. A better register is a longer one, and the correct
   response to a critic who names a twelfth is to add it, not to argue.

### Amendments requested of other owners

- **RI-EXP06 (experience owner):** **two resolutions first** (§E). (a) **B-08 is not struck** —
  amend its `What it is` clause to the charge-based formulation in §E1 and **lift the
  conditional**; `PB-08` passes unmodified and the register stays at twelve live entries.
  (b) **B-02 is accepted and this item has withdrawn its conflicting ruling** — no change is
  requested there, only acknowledgement that `corpus/25-magic/` now conforms.
  Then: eleven register entries (MB-1 … MB-11) are offered above in
  the register's own shape — what it is, why it survives, what it costs, and a test that fails
  if it stops working. **MB-5 and MB-11 produce permanent unrecoverable world state**, which is
  the register's ≥2 requirement, and **MB-1, MB-3, MB-8 and MB-10 are systemic**, which is its
  ≥4 requirement. Requesting they be adopted by reference rather than duplicated, and that
  RI-EXP06's cross-rule be stated as binding on `corpus/25-magic/` — this item accepts it in §D.
- **RI-PRG05 (progression owner):** requesting the addition of **filled soul gems** to the §6
  un-buyables list (a sixth entry), and of **filled soul gems** to method 6's id-class scan.
  Also requesting that method 4's flip-invariant fuzz include enchanted items in its item pool,
  since SG-4 is the clause that keeps it true.
- **RI-PRG08 (upgrade-path owner):** `bound_weapon` (MB-6) must be excluded from the upgrade
  path by construction, and greater/grand soul gems should be treated by RI-PRG08's scarcity
  discipline as a parallel hand-placed material class — same rules, different sink.
- **RI-LOR05 (lore owner):** SG-6's `xul_hesh` counter, its province-wide disposition effect and
  its two-faction gating are mechanical consequences of that item's §3. Requesting registration
  in `canon-facts.json` so the two files cannot drift, and confirmation that the single
  NPC-soul exception belongs to the main quest.
