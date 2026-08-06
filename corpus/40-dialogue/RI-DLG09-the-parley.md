---
id: RI-DLG09
title: The parley — the non-lethal exit from a fight, its frames, its gate, and the PACIFIST-IN-FIGHT floor
kind: structure
side: split
judges: [combat.encounter.parley, combat.encounter.exit, dialogue.combat.lockout, combat.enemy.statemachine, quests.resolution.noncombat, input.action.set]
provenance: constructed
confidence: high
blind_pair: no
---

> **This item closes intent-audit gate B1.** `INTENT-AUDIT-02` ID-01 (partial) and ND-04 found
> that the ID-01 repair *stopped at the ruling*: `ARBITRATION.md` §1 and seam **S13** were
> amended to preserve fleeing, yielding, parley, bribery and non-lethal outcomes during combat,
> and then **nothing was written that gives the parley a form and nothing was written that
> detects its absence.** This item is the form. `CRITIC-DOCTRINE.md` AR-2 **B12** (added in the
> same pass) is the detector. `PACIFIST-IN-FIGHT` (§D below) is the count.
>
> **Division of labour, binding.**
> **This item owns the parley as an interaction** — the input, the frames, the commitment, the
> gate ladder, the enemy `YIELD` state, and the `PACIFIST-IN-FIGHT` metric.
> **`RI-CMB02` owns frame *conventions*** (`f@60`, the startup/active/recovery contract, the
> commitment rule); §A below is authored against them and is cross-checked by `critic.combat`
> under AR-1.
> **`RI-DLG04` owns disposition and persuasion**; §C consumes `derivedDisposition()` verbatim and
> defines no new formula.
> **`RI-CRM02` §3 owns the price of striking a yielded target** and the writ target's yield
> trigger; §B cites it and does not restate the numbers.
> **`RI-CRM01` §4 owns the guard band-3 surrender** and its route back to the arrest interaction.
> **`RI-AI01` owns leash and de-aggro**; the flee exit in §D is that item's, counted here.
> **`RI-JRN03` owns the closed 14-action set**; this item adds **no** fifteenth action and §A
> exists partly to prove it does not.
>
> **`blind_pair: no`.** There is no Souls artifact to hold this against: Souls has no parley.
> The comparison is against Morrowind's *out-of-fight* persuasion, and it is a structural
> comparison, not a preference one.

## The bar

A fight with a person must be endable without a corpse, and offering to end it must **cost
something**. That is the whole design in one sentence, and both halves are load-bearing.

The first half is `ARBITRATION.md` §1 as amended: *"Killing is one exit from a fight. A build in
which it is the only exit has failed the brief, regardless of how good the combat feels."* The
second half is what stops that ruling from producing a free button. **Offering to yield is a
committed, animated, punishable act.** You lower your weapon; your guard is gone for
90 `f@60`; if you did it inside an enemy's attack string you are about to eat a charged heavy.
That is what makes it a decision under pressure rather than a menu item, and it is the only
construction that satisfies **S13** (Souls owns the absence of a browsable topic list mid-swing)
and **S14** (nothing pauses the world) and **A10** (a topic list opening during `COMBAT` is an
automatic AR-1 fail) at the same time.

"Good" means: a player who has spent the fight *being someone* — a Hlaalu officer, a reader of a
particular book, a person with 800 gold and a reputation — can spend that in the middle of a
swing and watch an enemy stop. A player who has spent the fight being a stranger cannot, hears
the refusal, and pays for having asked. The verb is the same in both cases. The world decides.

And the negative half is harder than the positive one. **The parley must never open a surface.**
No topic list, no wheel, no radial, no prompt bank, no time dilation, not one frame of modal UI.
Everything the player learns about whether the offer will land, they learn from the fiction
before they make it. If a builder cannot make that legible without a menu, the correct answer is
better animation and better voice lines, not a menu with a stopwatch on it.

## The reference artifact

### A. `ES-PARLEY/1` — the input and the frame contract (BINDING)

**The input is `interact`, held.** No new action. `HARNESS.md` §4 fixes the button set at
fourteen names and `RI-JRN03` §A makes it closed — *"any new verb requires an amendment to
`HARNESS.md`, not a new binding"* — so the parley reuses the verb that already means *speak to
that person*. Outside a fight, `interact` talks, opens, takes, reads and rests. Inside a fight
there is nothing to open and nothing to take, so `interact` is free, and it means the same thing
it always meant. This satisfies `RI-JRN03` Rule A1 (reachable on every modality) for free, and
Rule A3 (no required chord) by construction.

**Target selection.** The lock-on target if one is held (`RI-CMB06`); otherwise the nearest
hostile with `speech: true` within **6.0 m** in a **±40°** facing cone. If no such target exists,
the input is inert — it does not fall through to a pickup, and it does not play the animation.
While `COMBAT` is active and a valid parley target is in the cone, `interact` **suppresses**
item pickup and corpse looting; those are not lost, they are simply not what `interact` means
while a person is trying to kill you.

**The frames.** All figures `f@60` per seam **S22**. Frame indices 1-based, inclusive, measured
from the frame the `interact` press is registered.

| Phase | Frames | Length | What happens | Cancellable |
|---|---|---:|---|---|
| **Arm** | 1–12 | **12 f@60** (200 ms) | Weapon still up. Guard still legal, roll still legal, the fight is unchanged. Releasing `interact` before f13 cancels cleanly at **zero cost**. | **yes** |
| **Startup** | 13–42 | **30 f@60** (500 ms) | Commitment. Weapon lowers to the off-side, the empty hand comes up, the spoken line begins. **Guard drops on f13 and does not come back.** No i-frames, no hyperarmour, poise contribution **0**. | no |
| **Offer** | 43–54 | **12 f@60** (200 ms) | The `parley` trace event is emitted on **f43** carrying the route that fired (§C). The target evaluates the ladder and answers on the frame it decides, within this window. | no |
| **Recovery** | 55–102 | **48 f@60** (800 ms) | Weapon comes back up. Guard, roll and attack are all illegal until f103. | no |
| **Total** | 1–102 | **102 f@60** (1700 ms) | of which **90 f@60 (1500 ms) are committed and defenceless** | |

| Property | Value | Source / cross-check |
|---|---|---|
| Stamina cost | **20**, spent on **f13** (the commitment frame), never refunded | equal to a straight-sword light attack, `RI-CMB03` §A |
| Regen delay | spending re-arms the standard **42 f@60** pause | `RI-CMB03` §A |
| Insufficient stamina | the arm phase runs and the parley **does not commit** — you cannot offer to yield while empty | `RI-CMB03` |
| Poise contribution | **0** | any stagger interrupts it |
| Hyperarmour | **none**, at any phase | `RI-CMB05` §C |
| i-frames | **none**, at any phase | `RI-CMB01` |
| Root displacement | **0.0 m** — you stand still to do this | `RI-CMB02` §A convention |
| Enemy punish window against it | **90 f@60** (f13–f102) | see below |
| Cooldown after a refusal, same target | **600 f@60** (10 s) | §C |
| Committed parleys per target per encounter | **2**; the second refusal sets `parley_locked` | §C |

**The punish window is the point.** `RI-AI03` sets the absolute floor for a punishable player
recovery at **29 `f@60`** and calls **≥ 60 `f@60`** a *"big punish, worth a charged heavy"*. A
committed parley leaves the player open for **90 `f@60`** — **3.1×** the floor and **1.5×** the
big-punish threshold — with the guard down for all of it. An `A1 INFANTRY` whose light attack
has `Ps` = 25 `f@60` and lands 12 poise damage gets a guaranteed hit and a stagger; an
`A4 POISE_MONSTER` gets a free heavy. **Parleying inside an enemy's attack string is a mistake
the enemy is built to punish, and it must feel like one.** Compare `RI-CMB02` §A/§B: 90 `f@60`
of exposure sits between a straight-sword light (74 `f@60` total) and a heavy (122 `f@60`), so a
player already has an intuition for what they are spending.

**Interrupt rule.** Any hit landing on the player during f13–f102 cancels the parley outright.
The offer is not made; if it was already made (f43+) and the target has not yet answered, it is
**withdrawn**. Stamina is not refunded, the refusal costs of §C are **not** applied (you were
interrupted, not refused), and the 600 `f@60` cooldown does not start. This is deliberate: being
punished for a parley must not *also* close the door, or the punish becomes a double penalty and
nobody offers twice.

**What must not exist.** Zero frames of full-screen or modal surface. Zero time dilation. Zero
input capture beyond the `interact` hold. Zero prompt text on screen naming the route. The
presentation is: the character animation (readable in third person, which **S18** guarantees),
**one** spoken line drawn from the target's diegetic voice bank, and a distinct non-HUD audio
cue on f43. A surface appearing at any point in the 102 frames is `CRITIC-DOCTRINE` **A10** and
fails the piece — see §F for the `RI-JRN02` M-I11 reconciliation this requires.

### B. `ES-PARLEY/2` — the enemy's side: the `YIELD` state

`YIELD` is a legal state of `combat.enemy.statemachine`, alongside `RI-AI01`'s `AGGRO`,
`CIRCLE`, `APPROACH`, `LEASH_RETURN` and the rest. It is entered two ways.

| Entry | Condition |
|---|---|
| **Player-initiated** | An accepted parley (§C). Transition fires on the answer frame inside the offer window f43–f54. |
| **Enemy-initiated** | The target's own `yield_hp` threshold or `yield_after_parries` counter is crossed. Every `speech: true` statblock declares both; the defaults are **`yield_hp: 0.15`** and **`yield_after_parries: 2`**, which are `RI-CRM02` §3's writ-target figures generalised to the whole roster. An enemy may offer to *you*. |

**Behaviour in `YIELD`, all mandatory and all trace-observable:**

1. `hitboxes` go **inactive on the transition frame and stay inactive** (`RI-CRM02` method 3
   already asserts exactly this for writ targets; it is now the general rule).
2. The attack token is released to the encounter pool (`RI-AI01` / `combat.encounter.grouping`),
   so yielding one member of a group does not leave a phantom slot.
3. Locomotion becomes a withdrawal or a kneel. Poise regeneration stops. The enemy does not
   heal.
4. Lock-on releases the target after **30 `f@60`** (`RI-CMB06`); the camera does not fight the
   player.
5. **The yielded enemy counts as *dormant* under `ARBITRATION.md` §1's own definition of the
   fight's end.** `COMBAT` therefore ends on the frame the last hostile yields. **A build where
   `COMBAT` stays active after every hostile has yielded has built a stagger, not a yield**, and
   that is the single most likely way this ships broken.
6. Souls award: **zero**. A yield is not a kill (`RI-EXP06` PB-10 reds if souls are awarded).
7. The yield is **persistent world state**, not encounter state: `has_yielded_to_player` is
   written to world flags and survives death and reload (**S6**, `RI-JRN05`). On next meeting the
   NPC is not hostile, their `baseDisposition` is **−10** (they remember being beaten), and at
   least one greeting and one rumour must reflect it (`RI-DLG03`). **A yield that evaporates on
   reload was a cutscene.**

**What breaks a yield:**

| Break | Result |
|---|---|
| You strike the yielded target | It is a **murder** on `RI-CRM01`'s schedule when unwitnessed, and it costs standing with **3 factions when a witness saw the yield** — priced in full by **`RI-CRM02` §3**, which is the one place the corpus prices *how* you killed someone. Not restated here. |
| You strike another member of the yielded NPC's faction inside the encounter volume before leaving | `YIELD → COMBAT` for all of them, **once**. Thereafter `parley_locked` for the encounter. |
| You kill an ally of the yielded NPC after the yield | Same: one re-entry, then locked. |
| Time passing | **Nothing.** A yield has no timer. |
| You loot a corpse, rest, drink, or walk away | **Nothing.** |

The last two rows are stated as explicit non-breaks because the tempting implementation is a
timed reprieve, and a timed reprieve is a stagger with a voice line on it.

**Who is exempt.** Every enemy statblock in `game/data/combat/enemies/**.json` declares
`speech: true|false`. Beasts and mindless things — mire-crabs, swamp-wyrms, root-golems, the
`A7 SWARM` packs — are `speech: false`, **Souls owns them entirely**, they have no parley and no
`YIELD`, and **S13** says so in as many words. The check is two-directional, which is the lesson
of B2/B13:

- `speech: true` and no `parley` block → **S13 defect**, hard fail.
- `speech: false` and a `parley` block present → **defect**, hard fail. A crab that negotiates is
  as wrong as a legionary who cannot.
- `speech` absent → **defect**. There is no default; somebody has to decide.

Speech-capable things still lose fights they cannot talk their way out of: exits 2–5 in §D
(flee, calm/paralyse, stealth-break, bribe) apply to beasts too, and that is why beasts are in
the `PACIFIST-IN-FIGHT` denominator rather than excused from it.

### C. `ES-PARLEY/3` — the gate ladder (BINDING)

**There is no list to browse. The world picks the line.** On the offer frame f43 the game
evaluates the target's `parley` block against the player's state in a fixed precedence order and
**the first satisfied route fires**. The player controls which one fires by *what they did before
the fight*, never by choosing from a menu — and that is precisely the property that keeps this
inside **S13**'s Souls half while delivering **S13**'s Morrowind half.

| # | Route | Condition | On accept |
|---|---|---|---|
| **K** | `knowledge` | the player holds any id in `parley.knowledge[]` — a name, a fact, a book read, a topic learned | `YIELD`; disposition **+10** perm. Knowing a thing is the best solution in the game (`RI-QST05` KNOWLEDGE-KEYS) and it is ranked first for that reason |
| **F** | `faction_rank` | player rank in `parley.faction` ≥ `parley.rank_min`, not expelled | `YIELD` |
| **R** | `reputation` | `player.Reputation ≥ parley.reputation_min` | `YIELD` |
| **G** | `gold` | `player.gold ≥ ceil(parley.buyoff × 1.5)` — **`RI-CRM02` §3's in-combat premium; panic costs money** | gold spent, `YIELD` |
| **D** | `disposition` | `derivedDisposition(target) ≥ parley.disposition_min` (default **40**, the floor of `RI-DLG04` §E's Neutral band) | `YIELD` |
| — | *none satisfied* | | **refuse** — see below |

**Disposition is read live, mid-fight, through `RI-DLG04` §B unchanged**, which means two of its
terms bite exactly when they should:

- `fDispWeaponDrawn` = **−5** always applies. You are obviously armed.
- `fDispAttacking` = **−10** applies once you have landed a hit on this NPC in this encounter.

So **opening with a swing and then asking to talk is 15 disposition points harder than asking
first.** A player who walked in at 40 and drew blood is at 25 and will be refused. That is the
decision the item exists to create, it costs no new formula, and it makes the pre-fight
approach (`RI-QST05` §D's non-hostile approach state) genuinely valuable rather than merely
permitted.

**On refusal:**

| Cost | Value |
|---|---|
| `Fight` | **+10** on the target (`RI-DLG04` §C's channel) |
| Disposition | `permChange` **−5** |
| Cooldown, same target | **600 `f@60`** (10 s) before another parley will commit |
| Second refusal from the same target in one encounter | `parley_locked: true` for the rest of the encounter |
| Stamina | **not** refunded |
| The 90 `f@60` | already spent, and the enemy has already punished you or not |

**Why there is no die here, and why S21 is satisfied anyway.** Seam **S21** says a check whose
failure is *permanent* keeps its roll — and a parley's failure is permanent, so S21 appears to
demand one. **S1** and AR-1 check **A1** ban dice inside the fight, and the parley is inside the
fight. The two rulings collide on this one interaction, and the resolution is this:

> **The die is real. It is simply not thrown inside the fight.**

`derivedDisposition()` is a number produced by `RI-DLG04`'s *rolled* Admire / Intimidate / Taunt
/ Bribe attempts, made **outside** combat, where S21 governs and the roll survives. The parley
reads that number against an authored threshold. There is no `Math.random()` in the resolution
frame — which is literally A1's own tell — and there is no certainty either, because the number
was won or lost on dice the player already threw. The uncertainty lives where Morrowind put it;
the resolution lives where Souls requires it. **A build that rolls at f43 has failed AR-1; a
build whose `parley.disposition_min` is unreachable for a character who never talked to anyone
has failed the point.**

**Bosses.** `RI-EXP06` PB-10 reds if bosses become parley-exempt, `RI-CMP03` O12/ID8 requires
the hardest boss to be finishable by parley, and `RI-EXP05` LH9 requires a non-violent route to
the final confrontation. Therefore: **100% of `speech: true` bosses carry a `parley` block**, and
**≥ 50% of them carry a route that is *not* `knowledge`** — otherwise the boss parley is a secret
rather than a system.

**Guards.** `RI-CRM01` §4 already routes the guard band-3 fight (`bounty ≥ attackThreshold`) to a
surrender that lands back in the arrest interaction. That surrender **is** this parley: the
`interact` hold, the same 102 `f@60`, route **D** against the guard's disposition, with the
accept branch entering `YIELD` and immediately opening `RI-CRM01` §5's three answers. No second
mechanism.

### D. `PACIFIST-IN-FIGHT` — of fights entered, how many can end without a death (BINDING)

`RI-QST05` measures the **pre-aggro** half of the brief's clause *"how many quests resolve
without combat"*: quests you can finish without a fight ever starting. Its unit is a quest
record and its population is `game/data/quests/**`. **This metric is the other half**, and it is
a different population entirely: its unit is an **encounter** and it asks a question `RI-QST05`
structurally cannot — *once the swords are out, how often is there still a way out?*

**Definition.**

```
PACIFIST-IN-FIGHT = |{ e ∈ E : e has ≥1 non-lethal exit, verified in-engine }| / |E|
```

where `E` is the set of **authored encounters** — every group record under
`game/data/combat/encounters/**.json`, plus every boss record — that a player can enter
`COMBAT` with. Encounters that cannot be entered are not in `E`; encounters that can be avoided
entirely are in `E` (avoiding is not the same as exiting).

**The five legal non-lethal exits.** An encounter counts toward the numerator when at least one
of these is *reachable from inside `COMBAT`* and a harness probe actually leaves the encounter
with `deaths == 0`:

| # | Exit | Owned by | Reachable when |
|---|---|---|---|
| **1** | **Parley / yield** | this item | every hostile in `e` with `speech: true` has a `parley` block with ≥1 satisfiable route, and any `speech: false` members are covered by exits 2–4 |
| **2** | **Flee / leash** | `RI-AI01` | every hostile has a finite `L_hard` and the encounter volume has an egress the player can reach — a sealed boss arena has no exit 2 |
| **3** | **Calm / paralyse / soul-trap-without-kill** | `RI-MAG02` (**S19**) | an effect exists that applies to every hostile in `e` and the player can plausibly hold it |
| **4** | **Stealth break** | `RI-STL01` | the player can return to `HIDDEN` and all hostiles de-aggro |
| **5** | **Bribe / buy-off** | `RI-CRM02` §3 | a `buyoff` figure exists and the ×1.5 in-combat premium is affordable at region-appropriate wealth |

**The floors.** Constructed and binding. The headline number is deliberately derivable from the
segment floors so that it cannot be gamed by changing the encounter mix.

| Metric | Definition | Target | Hard fail |
|---|---|---:|---:|
| **PACIFIST-IN-FIGHT** | headline, all of `E` | **≥ 35%** | **< 15%** |
| — speech-capable segment | `e` contains ≥1 `speech: true` hostile | **≥ 70%** | < 45% |
| — beast/mindless segment | all hostiles `speech: false` | **≥ 25%** | < 10% |
| — boss segment (humanoid) | `speech: true` bosses | **100%** | any humanoid boss with no parley route (`RI-EXP06` PB-10) |
| **PARLEY-COVERAGE** | `speech: true` hostiles carrying a `parley` block | **100%** | < 100% — S13 defect |
| **PARLEY-REACHABLE** | speech-capable encounters where ≥1 route is satisfiable by a level-appropriate character who has played normally | **≥ 60%** | < 35% |
| **YIELD-RATE** | `speech: true` hostiles with `yield_hp > 0` (they can offer to *you*) | **≥ 70%** | < 40% |
| **EXIT-SPREAD** | share of non-lethal exits held by the single most common exit kind | **≤ 50%** | **> 70%** |
| **PARLEY-COST** | measured committed frames of a parley in a live trace | **90 `f@60`** ±2 | outside 80–110 `f@60` |

**Two directions, both fatal, and this is the whole reason the metric exists:**

- **`PACIFIST-IN-FIGHT == 0` → automatic fail.** This is the build the audit described: every
  fight ends in a corpse, every subsystem passes, nothing notices. It is now noticed here and by
  AR-2 **B12**.
- **`EXIT-SPREAD > 70%` → hard fail.** This is the build that shipped one exit — almost always
  fleeing, because leash logic is free — and called the ruling implemented. One exit is not a
  system, it is an escape hatch.

**Sanity check on the headline.** If 30% of encounters are speech-capable at the 70% floor and
70% are beasts at the 25% floor, the headline is `0.30×0.70 + 0.70×0.25 = 38.5%`. At a 20%
speech-capable share it is 34% — just under, which is correct: **a world whose fights are four
fifths beasts should not comfortably clear this bar**, because a world whose fights are four
fifths beasts is not the world the brief described.

**Where this metric lives, and why not in `RI-QST05`.** Three reasons, and the third is the one
that matters. (a) Different population — every jq query in `RI-QST05`'s comparison method runs
over `game/data/quests/*.json` and its unit is a quest record; nothing in that method can see an
encounter. (b) Different critic — the exits are enemy statblocks, AI states and combat traces,
and `critic.quests` does not run the combat harness. (c) **The charter's stalled-correction
lesson**: a metric filed away from the thing it measures is a metric that stops moving when the
thing moves. `PACIFIST-IN-FIGHT` sits in the same file as the parley's frame table so that
changing one forces a reader past the other. `RI-QST05` should carry a **citation**, not a copy —
the proposed amendment is §F.

### E. The AR-3 crossing

`ARBITRATION.md` §3 AR-3 asks whether a piece carries at least one interaction that crosses the
seam. **This item is very nearly nothing but seam crossing**, and it crosses in both directions.

**World → fight.** A fight's outcome is decided by a property of the world that has nothing to do
with the fight: who you are (`faction_rank`), what you are known for (`reputation`), what you can
afford (`gold`), how you have treated people (`disposition`), and **what you read** (`knowledge`).
The `knowledge` route is the sharpest form the project has of the brief's own sentence about
books being keys: a name learned from a `corpus/60-lore` book, forty hours earlier, ends a boss
fight in 102 `f@60`. `RI-CMP01` already declares the cells — `FAC→BOS` (:155), `DIS→BOS` (:157),
`BOS→LOR` (:193) — and `RI-CMP01`'s rule is *demonstrated, not declared*. **This item is what
demonstrates them.** Nothing else in the corpus can: without a parley, those three cells are
assertions with no mechanism underneath.

**Fight → world.** A yield writes `has_yielded_to_player` into persistent world flags (§B.7),
which changes greetings, rumours (`RI-DLG03`), base disposition and — through `RI-CRM02` §3 —
faction standing if you finish a yielded target in front of a witness. The fight edits the
world's opinion of you. Both directions are required; a build with only the first has made
parley a lockpick.

`seam_sterile: false`, and any critic reporting otherwise on a piece containing this interaction
has misread it.

### F. Proposed amendments to items this item does not own

Filed here per `CORPUS-CONTRACT` §5 and the charter's rule that the auditor proposes and the
owner applies. **None of these files were edited by this task.**

**F.1 — `RI-JRN02` M-I11 and HF7 contradict `CRITIC-DOCTRINE` A10 and must be reconciled.**

`RI-JRN02:192` M-I11 currently reads: *"…and **0** frames with a surface open during `COMBAT`
**other than the dialogue-locked parley** (seam S13/S14)"*, and `:259` HF7 hard-fails a surface
during combat *"outside the S13 parley"*. Both carve out a modal surface for the parley.
`CRITIC-DOCTRINE` §4.1 **A10** automatically fails any piece where *"a topic list opens"* during
`COMBAT`. As written, one document permits what the other auto-fails, and `INTENT-AUDIT-02`
ND-04 found that a builder guessing between them has a coin-flip chance of tripping an automatic
fail on every piece the parley appears in. With §A above, the carve-out is no longer needed: the
parley is an action, not a surface.

- **M-I11 threshold becomes:** *"C8; and **0** frames with any full-screen or modal surface open
  during `COMBAT`, **with no exception**. The S13 parley is an animated action
  (`RI-DLG09` §A) — it opens no surface, pauses nothing, and presents as animation, one spoken
  line and an audio cue. A surface appearing during a parley is AR-1 **A10** and fails the piece
  there; it is not tolerated here."*
- **HF7 becomes:** *"Any menu, inventory or topic surface open during combat (M-I11). **The S13
  parley carries no carve-out** — it is an action, not a surface (`RI-DLG09`)."*
- **Add M-I15, so removing the carve-out does not delete the parley** (the B2/B13 two-directional
  lesson): *"**M-I15 — the parley is present in the hour.** At least one speech-capable encounter
  reachable in the first hour offers a parley the player can reach. Threshold: **≥ 1**, the
  `parley` trace event fires, and **0** frames of surface while it runs. **Hard fail: the first
  hour contains a speech-capable fight and no reachable parley.**"*

**F.2 — `RI-QST05` should cite `PACIFIST-IN-FIGHT` as its post-aggro half.**

`INTENT-AUDIT-02` §3.1 marks the brief's clause *"how many quests resolve without combat"* as
**Partial** because `RI-QST05` measures only the pre-aggro fraction. Proposed addition to
`RI-QST05` §B, mirroring the shape of the amendment it already carries for W6:

> **AMENDED — gate B1 (`INTENT-AUDIT-02` ID-01/ND-04).** The metrics above measure the
> **pre-aggro** half of the brief's clause: quests completable without a fight ever starting.
> The **post-aggro** half — *of fights actually entered, what proportion can end without a
> death* — is `PACIFIST-IN-FIGHT`, owned by **`RI-DLG09` §D** (floor **≥ 35%**, hard fail
> **< 15%**), because its population is encounters and not quests and its evidence is combat
> traces and enemy statblocks. **If `PACIFIST-IN-FIGHT` is absent or unmeasurable, PACIFIST-ALL
> is reported `unmeasurable ⇒ 0`** per `CRITIC-DOCTRINE` §7.3 — exactly as this item already
> treats a missing stealth/crime system — because a pacifist fraction computed over quests you
> can avoid fighting, in a world where every fight you do enter ends in a corpse, is a number
> that flatters a build the brief forbids.

**F.3 — `ARBITRATION.md` S13 is missing audit 01's second sentence.**

ND-04(a): audit 01's correction specified *"an action with startup and recovery that the enemy
can punish, **not a menu**"* and that sentence never reached S13. Proposed append to S13, after
*"…gated on disposition, reputation, faction rank or knowledge"*:

> *"The parley is an **action**, not a menu: a committed, animated, interruptible interaction
> with startup and recovery that the enemy can punish, bound to the existing `interact` verb and
> opening **no** surface of any kind. **A10 stands unamended** — a topic list opening during
> `COMBAT` remains an automatic AR-1 fail, and that includes a parley built as one. Form,
> frames, gate and the enemy `YIELD` state are specified by `RI-DLG09`; the price of striking a
> yielded target by `RI-CRM02` §3."*

**F.4 — `HARNESS.md` §5 event vocabulary.** `RI-EXP03` §B amendment **A-EXP2** already proposes
a `parley` trace event. This item additionally requires **`yield`** (fired on the `COMBAT → YIELD`
transition, carrying `eid`, `initiator ∈ {player, enemy}`, and `route ∈ {K,F,R,G,D,hp,parries}`).
Both are needed before §D's harness probes can run. Filed as part of A-EXP2 rather than as a
competing amendment.

**F.5 — `HARNESS.md` §7 required layout.** §D's census reads
`game/data/combat/encounters/**.json`, which §7's example layout does not list. §7's binding rule
— *"All game content lives in inspectable data files under `game/data/`"* — already requires it;
the layout block should name it so "absent" can be told from "never built".

## Comparison method

Run in this order. Steps 1–2 are static and cheap; 3–6 need the harness. **Every step that
reports a frame count reports it as `f@60`.**

**Step 1 — statblock census (static, `game/data/**`).** Two-directional per §B.

```bash
# Speech flag present on every enemy, and parley presence agrees with it.
jq -s -r '.[] | select((.speech|type) != "boolean")
  | "\(.id): `speech` missing or not boolean — DEFECT"' game/data/combat/enemies/*.json

jq -s -r '.[] | select(.speech == true and ((.parley // {}) | length) == 0)
  | "\(.id): speech:true with no parley block — S13 HARD FAIL"' game/data/combat/enemies/*.json

jq -s -r '.[] | select(.speech == false and ((.parley // {}) | length) > 0)
  | "\(.id): speech:false with a parley block — DEFECT (a crab does not negotiate)"' \
  game/data/combat/enemies/*.json

# PARLEY-COVERAGE and YIELD-RATE.
jq -s '{ speech: (map(select(.speech==true))|length),
         covered: (map(select(.speech==true and ((.parley//{})|length)>0))|length),
         yielders: (map(select(.speech==true and ((.yield_hp//0) > 0)))|length) }
       | . + { parley_coverage: (.covered/.speech*100), yield_rate: (.yielders/.speech*100) }' \
  game/data/combat/enemies/*.json

# Route mix across every parley block — feeds EXIT-SPREAD's parley column.
jq -s '[.[] | select(.speech==true) | (.parley // {}) | keys[]]
       | group_by(.) | map({route: .[0], n: length})' game/data/combat/enemies/*.json
```

**Step 2 — encounter census and the headline ratio (static).**

```bash
node tools/analysis/pacifist-in-fight.mjs \
  --encounters 'game/data/combat/encounters/**/*.json' \
  --enemies    'game/data/combat/enemies/*.json' \
  --spells     'game/data/magic/spells.json' \
  --out /tmp/pif.json
```

The analyser classifies each encounter into the speech / beast / boss segments, evaluates exits
1–5 against §D's reachability conditions, and emits `pacifist_in_fight`, the three segment
ratios, `exit_spread` and the per-encounter exit list. **Static classification is a candidate
list, not a result** — every encounter it marks pacifist is a claim to be falsified in step 4.

**Step 3 — the frame contract (live trace).** Scenario `dlg-parley-frames`, seed pinned.

```js
await __HARNESS.reset({seed: 1337, state: 'dlg-parley-duel'});
__HARNESS.aggro('e0'); __HARNESS.lockOn('e0');
__HARNESS.traceStart();
__HARNESS.queueInputs([{f: 60, hold: ['interact'], until: 200}]);
__HARNESS.stepFrames(400);
const t = __HARNESS.traceStop();
```

From the trace, assert, all in `f@60`:

- **P1** `parley` event fires on **f+43** of the press (±0 frames). Exact.
- **P2** `player.state` is a distinct parley state from **f+13** to **f+102**; total **102**.
- **P3** `stamina_spend` of **20** on **f+13**; `stamina_regen_blocked` true for the following
  **42 f@60**; **no** stamina movement on f1–f12.
- **P4** Releasing `interact` at f+11 produces **no** `parley` event, **no** `stamina_spend`, and
  the player returns to the prior state within **1 f@60**. The arm window is genuinely free.
- **P5** `player.poise_cur` contribution during f+13…f+102 is **0**; no `iframe: true` on any
  frame; a scripted enemy light attack landing anywhere in f+13…f+102 produces `stagger: true`
  on the player and cancels the parley (no `parley` event if before f+43).
- **P6** `player.hitboxes` is empty for all 102 frames, and **block/roll/attack inputs queued in
  f+13…f+102 produce no state change**. Commitment is real.
- **P7** Root displacement over the 102 frames ≤ **0.05 m**.
- **P8** **Zero** frames with any surface open (`RI-JRN02` M-I11), and zero frames where
  `fixed_step_hz` deviates or the enemy's `anim_frame` fails to advance (**S14**, A3).
- **P9** The measured enemy punish window against the parley — computed by `RI-AI03`'s own
  `P_safe` procedure treating f+13…f+102 as the player's recovery — is **≥ 60 `f@60`**. If an
  enemy cannot punish a parley, the parley is free and the item's central claim is false.

**Step 4 — the gate ladder, five routes × accept/refuse (live).** For each route K/F/R/G/D, from
identical saves, set exactly the one qualifying property and assert the accept; then clear it by
one point/rank/gold piece and assert the refusal.

- **P10** Accept: `yield` event with the expected `route`; enemy `hitboxes` inactive from the
  transition frame to the end of the trace; attack token released; **`COMBAT` ends** within
  **5 `f@60`** of the last hostile yielding; souls awarded **0**.
- **P11** Refuse: target `Fight` +10, disposition `permChange` −5, no `yield` event, and a second
  `interact` hold inside **600 `f@60`** does **not** commit; a third attempt after the cooldown
  commits once and then sets `parley_locked`.
- **P12** Precedence: with **both** a knowledge id and 10× the buyoff gold, the fired `route` is
  **K**. Precedence is authored, not incidental.
- **P13** **No RNG at resolution.** Run the same parley 200× at the same seed **and** at 200
  different seeds with identical state: the outcome and the fired route are identical in all 400
  runs, and `rng.draws` is unchanged across the offer frame. This is AR-1 **A1** applied to the
  parley, and it is the check that S21 vs S1 turns on (§C).
- **P14** Attack-first penalty: land one hit, then parley. `derivedDisposition` at f+43 is
  **15 lower** than the same probe without the hit (`fDispWeaponDrawn` −5 + `fDispAttacking` −10),
  and an encounter authored at `disposition_min: 40` against a base-40 NPC **refuses**.

**Step 5 — the yield's persistence and its breaks (live).**

- **P15** Yield, then `saveState()` → `loadState()` → the NPC is non-hostile,
  `has_yielded_to_player` is set, `baseDisposition` is **−10**, and ≥1 greeting and ≥1 rumour
  differ from the pre-yield capture. Then die, respawn (**S6**) and assert the same. **A yield
  that does not survive a reload is a cutscene and fails the item outright.**
- **P16** Strike the yielded target with a civilian in line of sight: assert `RI-CRM02` §3's
  3-faction standing loss lands on the strike frame. (Assertion owned by `RI-CRM02` method 3;
  cited, not duplicated — a divergence between the two is `RI-CRM02`'s to resolve.)
- **P17** Non-breaks: step **3600 `f@60`** with no input; assert the enemy is still `YIELD`.
  Loot a corpse, drink, walk 30 m and return; assert still `YIELD`.

**Step 6 — `PACIFIST-IN-FIGHT` live verification (the falsification pass).** Mandatory once per
wave. Sample **20** encounters from step 2's pacifist candidate list, stratified across the three
segments, plus **every** humanoid boss. For each, enter `COMBAT` and attempt exits 1–5 in order,
scripted, with a level-appropriate character built *without* combat investment.

- Record the exit that worked, the frame `COMBAT` ended, and the death count.
- **Any encounter that step 2 classified as pacifist and that cannot in fact be exited with
  `deaths == 0` is a data lie and fails this item outright**, exactly as `RI-QST05`'s live
  verification treats a false `kill_required_npcs`. The static number is then recomputed with the
  lie removed and the delta is reported.
- Record the run under `corpus/90-verdicts/`.

**Step 7 — B12.** `CRITIC-DOCTRINE` §4.2 **B12** runs the same probe over five encounter classes
and is the doctrine-level check. A critic on any piece touching combat, enemies, dialogue or
quests runs B12 **and** A10 together — they are a pair, in the way B2 and B13 are a pair.

## Scoring

| Axis | Weight | 10 | 6 (pass) | 0 |
|---|---:|---|---|---|
| **The parley exists as an action** | 20 | P1–P8 all pass, 102 `f@60` exact, zero surface frames | fires, committed, no surface, total within 80–110 `f@60` | it is a menu (**A10 automatic fail**), or it does not exist |
| **It is punishable** | 15 | P9 ≥ 60 `f@60` and a scripted punish lands and staggers | P9 ≥ 29 `f@60` (`RI-AI03`'s floor) | i-frames, hyperarmour, cancellable after f12, or the enemy cannot punish it |
| **The gate ladder** | 15 | all five routes accept and refuse correctly, P12 precedence, P14 penalty | ≥ 3 routes work, P13 clean | one route (always disposition), or P13 finds a die at f43 (**AR-1 fail**) |
| **The `YIELD` state** | 15 | P10, P15, P17 all pass; `COMBAT` ends on the yield | hitboxes inactive, `COMBAT` ends | a timer, a stagger, or it does not survive a reload |
| **Exemption is two-directional** | 10 | step 1 clean in both directions, `speech` on 100% of statblocks | no `speech: true` without a parley | beasts negotiate, or a humanoid faction NPC has no parley (**S13 defect**) |
| **`PACIFIST-IN-FIGHT`** | 15 | ≥ 35% headline, all three segment floors, EXIT-SPREAD ≤ 50%, step 6 clean | ≥ 25% headline, ≥ 2 segment floors, EXIT-SPREAD ≤ 70% | **< 15%**, or **0**, or step 6 finds a data lie |
| **The AR-3 crossing** | 10 | K and F both demonstrated on a boss; the fight→world direction verified at P15 | ≥ 1 world property demonstrably resolves ≥ 1 fight | every parley resolves on disposition alone — the crossing is decorative |

**Hard fails, any one of which caps the piece at 2:**

1. A surface — topic list, wheel, radial, prompt bank — opens during a parley. This is
   `CRITIC-DOCTRINE` **A10** and it fails the piece under AR-1 regardless of this item's score.
2. `PACIFIST-IN-FIGHT == 0`, or **< 15%**. This is `CRITIC-DOCTRINE` **B12** and it fails the
   piece under AR-2.
3. Any `speech: true` hostile with no `parley` block (**S13**: *"a humanoid faction NPC with no
   parley path is a defect"*).
4. Any `speech: false` hostile with one.
5. A die at the resolution frame (P13) — **AR-1 A1**.
6. The parley is cancellable, i-framed, hyperarmoured, or costs no stamina. A free button is not
   this item.
7. `COMBAT` does not end when the last hostile yields.
8. The yield does not survive save/load or death.
9. **EXIT-SPREAD > 70%** — one exit is not a system.
10. Step 6 finds an encounter whose data claims a non-lethal exit that does not exist.

**What "we lose" looks like:** a critic runs step 3 and finds the parley is a 4-frame instant
state change with a fade-in panel; or runs step 2 and finds `parley` blocks on 100% of statblocks
with `disposition_min: 0` on all of them, so PARLEY-COVERAGE reads 100% and the gate is
decoration; or runs step 6 and finds that nineteen of twenty candidate encounters end in a corpse
because the exits were authored in JSON and never wired.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7,
BAR-CRITIQUE-02 C1).** The native score is the **weighted sum over the seven axes, out of 100**
(each axis scored 0 / 6 / 10, weight applied, `Σ weight = 100`, so the native scale is 0–100).

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native (weighted sum / 100) | **40** | **60** | **80** |
| What that build looks like | the parley exists and is committed, and **nothing else** — one route, no `YIELD` persistence, `PACIFIST-IN-FIGHT` 15–25% | the parley is punishable and gated on ≥ 3 routes, `YIELD` ends `COMBAT`, `PACIFIST-IN-FIGHT` ≥ 25%, EXIT-SPREAD ≤ 70% | all five routes, `YIELD` survives save/load, `PACIFIST-IN-FIGHT` ≥ 35% with all three segment floors, EXIT-SPREAD ≤ 50%, step 6 clean |

**Aggregation (a property of this item, not of the critic):** `weighted-sum` over the seven axes,
then hard-gated — **any one of the ten hard fails caps the piece at 2 regardless of the sum**,
and hard fails 1, 2 and 5 additionally fail the piece under AR-1 A10 / AR-2 B12 / AR-1 A1, which
is an arbitration failure and outranks any score.

## How we lose

- **The parley ships as a menu, because a menu is one afternoon and an animation is a week.**
  This is the single most likely outcome and it is the one `RI-JRN02`'s current M-I11 carve-out
  actively invites (§F.1). It will read as "done" in a demo and it fails A10 on every piece.
- **The parley ships as a free button.** No stamina, cancellable, i-framed "because it felt bad
  to get hit while trying to be nice". Then the optimal play in every hard fight is to mash
  `interact`, and the item's whole thesis — that offering to yield is a decision under pressure —
  is gone. The tell is P9 and it is the first thing to check.
- **The `YIELD` state is a stagger with a voice line.** Hitboxes go inactive for 300 `f@60`, then
  the enemy stands up and resumes. Everything looks right in a clip. P17 and P15 are the checks;
  the specific tell is `COMBAT` never ending.
- **The yield does not survive a reload**, because it was written to encounter state instead of
  world flags. Discovered in wave 4 by a coherence agent, after every quest that depends on it
  has been authored.
- **`disposition_min: 0` everywhere.** PARLEY-COVERAGE reads 100%, every parley succeeds, and
  the fight has an "I win" button that costs 20 stamina. GATED-SOLUTIONS is `RI-QST05`'s version
  of this failure and it is the failure this corpus is most practised at.
- **The mirror: `disposition_min: 95` everywhere.** Coverage reads 100%, nothing is reachable,
  PARLEY-REACHABLE reads 4%, and the ruling is satisfied on paper by a system no player will ever
  see fire. This is why PARLEY-REACHABLE exists as a separate metric from PARLEY-COVERAGE.
- **Only beasts get built.** Speech-capable enemies are expensive — a parley block, a voice line,
  a yield animation, a persistent flag — so the roster quietly fills with crabs and wyrms, every
  statblock honestly declares `speech: false`, step 1 passes cleanly, and the world has no people
  in it to talk down. The beast-segment floor and the headline's sensitivity to the speech-capable
  share are what catch this, and it is the failure mode I have least confidence we will avoid.
- **One exit, and it is fleeing.** Leash logic is free (`RI-AI01` builds it for other reasons), so
  every encounter technically has a non-lethal exit and `PACIFIST-IN-FIGHT` reads 90%.
  EXIT-SPREAD > 70% is the check; without it this metric would be trivially satisfiable by
  building nothing.
- **Bosses are exempted "for now".** The arena seals, exit 2 is gone, `speech` is set false on the
  antagonist because a boss that can be talked out of the fight sounds like it undermines the
  climax. `RI-EXP06` PB-10, `RI-CMP03` ID8 and `RI-EXP05` LH9 all fire, and so does this item's
  boss-segment 100% floor — but the argument will be made every wave and it should be refused
  every wave.
- **The knowledge route is never wired.** It is the best route in the design and the most work:
  it needs a book (`corpus/60-lore`), a topic (`RI-DLG01`), a flag and a `parley.knowledge[]`
  entry that all agree. It will be the last one built and the first one cut, and its absence
  reduces the AR-3 crossing to a disposition check.
- **The two metrics are computed and never reconciled.** `RI-QST05` reports 46% PACIFIST-ALL,
  this item reports 8% PACIFIST-IN-FIGHT, both pieces pass their own critics, and nobody adds
  them up. F.2's `unmeasurable ⇒ 0` clause exists precisely to make that arithmetic mandatory.

## Provenance note

- **`constructed`, `confidence: high`.** Every number in §A, §C and §D is defined by this project.
  There is no upstream source: **Souls has no parley**, and Morrowind's persuasion has no frames
  because it happens in a paused menu. Per `CORPUS-CONTRACT` §3 a constructed bar we can measure
  binds exactly as hard as a recalled one, and the confidence is `high` because the numbers are
  *derivable* rather than guessed — see the derivations below.
- **The frame figures are derived from items already in the corpus, not invented.** The 90 `f@60`
  committed window is chosen to sit above `RI-AI03`'s **60 `f@60`** "big punish, worth a charged
  heavy" threshold and well above its absolute **29 `f@60`** punishability floor, and between
  `RI-CMB02` §A's straight-sword light (74 `f@60` total) and §B's heavy (122 `f@60`) so the cost
  is legible against actions the player already understands. The 12 `f@60` arm window is one
  input-buffer's worth of grace. The 20 stamina is `RI-CMB03` §A's light-attack cost, matched
  deliberately. All figures carry `f@60` per seam **S22**.
- **The yield trigger defaults (`yield_hp: 0.15`, `yield_after_parries: 2`) are `RI-CRM02` §3's
  writ-target figures generalised**, not new numbers. The ×1.5 in-combat bribe premium is
  likewise `RI-CRM02` §3's, cited not redefined.
- **The gate ladder consumes `RI-DLG04` §B/§E unchanged.** `derivedDisposition()`, the GMST
  constants, `fDispWeaponDrawn` (−5), `fDispAttacking` (−10), the `permChange` channel and the
  Neutral-band floor of 40 are all that item's, `provenance: community-data, confidence: high`.
  This item defines **no** disposition formula of its own; the `disposition_min` default of 40 is
  a threshold placed on someone else's number.
- **The `PACIFIST-IN-FIGHT` floors are constructed and the headline is derived from the segment
  floors**, shown arithmetically in §D so a future wave can move one input and see the headline
  move rather than re-arguing the number. **15% is the hard-fail floor named by `INTENT-AUDIT-02`
  gate B1**; the 35% target is this item's, set higher because 15% is a floor for "not
  catastrophic", not a target for "built".
- **The S21/S1 resolution in §C is a ruling this item makes and does not have the authority to
  make permanent.** It is internally consistent — the die exists, it is thrown outside the fight,
  and AR-1 A1's tell is clean — but it touches two seam rulings and should be ratified into
  `ARBITRATION.md` alongside F.3. Until then, treat §C as the corpus's position and P13 as the
  check that enforces it.
- **Two subsystem paths are new** with this item and are registered in `subsystems.json`:
  `combat.encounter.parley` and `combat.encounter.exit`. Both were genuinely absent —
  `grep parley corpus/00-doctrine/subsystems.json` was empty before this pass, which is
  `INTENT-AUDIT-02` ND-04's *"no subsystem path, so nothing in `INDEX.md` routes it to a
  critic"*. Everything else in `judges:` is an existing canonical path.
- **Not verified against any external source, and none exists.** This is one of the few items in
  the corpus where `canonical-recall` was never an option: the interaction has no upstream. What
  *is* checkable is internal consistency against `RI-CMB02`, `RI-CMB03`, `RI-AI03`, `RI-DLG04`,
  `RI-CRM01`, `RI-CRM02` and `HARNESS.md`, and every figure above cites the item it is consistent
  with.
