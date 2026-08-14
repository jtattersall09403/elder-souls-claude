---
id: RI-EXP06
title: The permissiveness budget — fifteen sanctioned breakages, asserted to work and tested to keep working
kind: structure
side: neutral
judges: [experience.permissiveness.register, experience.permissiveness.durability]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Count the automatic fails in this corpus that are aimed at the player being clever.

`RI-PRG03`'s **Cost Gate**: *any no-cost action grants progress → automatic fail*. `RI-PRG05`'s
**flip invariant**: *any profitable flip → automatic fail*, plus the farming ceiling and the four
un-buyables. `RI-PRG08`: no reclaim, no respec, no transfer, no respawn-farmable materials, exactly
84 upgrade materials in the world. `RI-PRG06`: non-farmable bosses. `RI-PRG01`: no respec, no
training attributes. `RI-DLG04`: persuasion attempts that cost you on failure. `RI-AI05`: an
anti-farm ratio. `RI-WLD07`: bonfire scarcity. `RI-PRG04`: an unforgiving bloodstain.

Every one is defensible. Every one is correct in isolation. **Their sum is a game with no give in
it**, and `BAR-CRITIQUE-01` §3 rank 3 is right that nothing in the corpus points the other way.

Morrowind is a cult classic **substantially because it can be broken.** The alchemy loop. The
hundred-point jump. The Boots of Blinding Speed and the Resist Magicka trick. Killing Vivec.
Murdering the main quest and being told the thread of prophecy is severed *and you may still*. Those
are not defects the community tolerated; they are the reason people still talk about it twenty years
later, and every one of them is a story about a player outsmarting a designer who let them.

The design position this item asserts, and defends in §A:

> **A sealed system is cheaper to defend and worse to play, because the player never gets to be the
> smartest thing in the room.** The corpus's anti-exploit rules stay. What this item repeals is the
> *default* — that when a system's generosity is discovered, the response is to close it. From here
> on, closing something requires naming what it preserves.

> One sentence a builder can aim at: **fifteen named things the player can do that we know are
> overpowered, that we are not going to fix, each of which costs the player something real in the
> fiction, and each of which has a test that goes red the day somebody quietly closes it.**

This item is `blind_pair: no` on purpose: there is nothing to compare unlabelled. The instrument is a
register of assertions and a regression suite, not a judgement.

---

## The reference artifact

### A. The design position, argued

**1. The distinction is not exploit-versus-feature. It is priced-versus-free.**
A breakage belongs in the register when the player pays for it *in the fiction*: gold, a finite
resource, a permanent world state, a closed door, a reputation, a death. Morrowind's alchemy loop is
priced — it costs the ingredients, which are finite and hand-placed, and it costs the player the
experience of the intended difficulty curve, which is a real thing to lose. An unpriced breakage is
just a bug, and this item does not sanction bugs.

**2. Permissiveness and rigour are not opposites; permissiveness is what rigour is *for*.**
`RI-PRG05`'s flip invariant forbids *arbitrage* — buying and selling the same object at a profit. It
does not forbid stealing, and it never did. `RI-PRG03`'s Cost Gate forbids *no-cost* progress; the
alchemy ladder costs ingredients. `RI-PRG08`'s scarcity budget forbids *farming* upgrade materials;
it says nothing about a player who finds all 84. In almost every case the anti-exploit rule and the
sanctioned breakage coexist without contradiction, and the register's job is to make that explicit so
that the next well-meaning clamp does not take both out.

**3. The failure mode of a sealed game is invisible to every other instrument in this corpus.**
A build where every clever thing has been closed passes `AR-1`, `AR-2`, every progression item, every
economy item, and reads as *tight*. It fails `RI-EXP02`'s T4 class (a system that combined
unexpectedly) and it fails `RI-EXP04`'s late-hour recombination clause, and it fails them quietly.
This is the same defect `RI-CMP01` measures from the other side: **a game you cannot break is
usually a game whose systems do not touch.**

**4. The counter-argument, stated fairly.** A permissive game is easier to trivialise, and a player
who trivialises it on their first run may never see what was built. That is a real cost and the
register does not pretend otherwise. The answer is the **price** column: every entry costs the player
something they would have wanted, and several are irreversible. A player who ladders alchemy in hour
three spends the cure for a named disease and finds out in hour nine. That is not a punishment; it is
the design keeping its side of the bargain.

**5. Admission criteria (an entry is not sanctionable unless all five hold):**

| # | Criterion |
|---|---|
| **P1** | It is reachable **with the game's own verbs**. No clipping, no collision failure, no determinism break, no page error. A bug is a defect, not a breakage. |
| **P2** | It has a **price paid in fiction** — gold, a finite resource, an irreversible world state, a closed route, a reputation, or death. |
| **P3** | It is **discoverable by reasoning about the systems**, not only by reading the data files. A player who understands two systems can predict it. |
| **P4** | It violates **neither `AR-1` nor `AR-2`**. A breakage that puts a dice roll in the fight, or an objective marker in the world, is not sanctioned. |
| **P5** | It does not make another item's hard fail **false**. A breakage that produces a profitable flip is a defect in the economy, not an entry here. |

### B. The register — fifteen sanctioned breakages (binding)

Columns: **Sys** = systemic (arises from two systems meeting, not from one lenient number).
**Perm** = produces a permanent, unrecoverable world state.
Each entry's probe id is `PB-<nn>` and lives in `corpus/95-experience/RI-EXP06.probes.json`.

---

**B-01 — The potion ladder (alchemy self-amplification).** `Sys ✔`
*What it is.* Ingredients that fortify the attribute governing alchemy, brewed into a potion; drinking
it raises that attribute; brewing again under the effect yields a stronger potion. Morrowind's loop,
unpatched.
*Why it survives.* It is the single most-told story about the reference game and the exemplar of
`RI-EXP02`'s T4 class. It is not a no-cost action, so `RI-PRG03`'s Cost Gate is untouched.
*What it costs the player.* The fortifying ingredients are **hand-placed, finite and not
respawn-farmable** (`RI-PRG08`'s rule preserved), so the ladder terminates at a height set by how much
of the world the player searched — the reward is for exploration, not for repetition. The same
ingredient is a component of the only cure for a named disease (`RI-WLD05` #24, marsh-fever); a player
who ladders spends the cure. And the potions have a duration: the resulting character is temporary,
and a player who builds a plan around it dies when it lapses.
*Probe `PB-01` (**FAILS if the breakage stops working**).* Brew → drink → brew, three rungs. Assert
`magnitude(n+1) > magnitude(n) × 1.0` for every rung; assert the terminating condition is **ingredient
exhaustion**, not a clamp; assert no `cannot_brew_while_affected` refusal fires. **Red the moment a
magnitude cap, a diminishing-returns curve or a self-stacking prohibition is added.**

---

**B-02 — Fortify-skill stacking into a rank you have not earned.** `Sys ✔`
*What it is.* Fortify-skill effects — potion, enchantment or spell — count toward faction rank skill
thresholds and toward equip/spell gates **at the instant the gate is evaluated**.
*Why it survives.* It is Morrowind's actual behaviour and it is the clearest case of `S19`'s ruling
that out-of-fight magic is a legitimate route through the world. It converts a wall into a puzzle, and
`RI-PRG03` explicitly gates *access and utility* on skills — a temporary skill is still a skill.
*What it costs the player.* Gold and finite reagents. And the rank is **real**: the faction's next
quest is at the new rank's difficulty tier, `S9` forbids level-scaling it down, and `RI-QST03`'s
expulsion machinery is live. A player who buys a rank they cannot sustain is expelled, and expulsion
is a world state.
*Probe `PB-02`.* Apply fortify-skill; request rank advancement at a threshold the base skill fails;
assert the rank is granted; assert the rank **persists after the effect lapses**; assert the next
quest's tier is unchanged. **Red if a "sustained skill" check, a base-skill-only evaluation, or a
rank rollback is added.**

---

**B-03 — The utility spell that skips a designed route.** `Sys ✔`
*What it is.* A levitation / water-walk / root-step effect lets the player enter an exterior location
by a route no designer drew: over a wall, across a tide channel, onto a roof, down a shaft.
*Why it survives.* `S19` states utility magic is a first-class system and *a legitimate route through
the world*; `RI-WLD07`'s verticality is real geometry, and magic that ignores gravity ignores real
geometry. Closing this would require invisible ceilings, which are `RI-EXP01` hard fail 5.
*What it costs the player.* Magicka, and a spell bought or made with gold. And the place you arrive at
is **lethality-gated, not level-gated** (`S9`) — arriving early means dying there.
*Bound (not a nerf — the pre-existing `S19` line).* Forbidden **into or within** dungeons, boss arenas
and locked areas, where `S19` already bans teleport-as-level-design-solvent. Levitation over exterior
geometry is explicitly sanctioned and is not covered by that ban.
*Probe `PB-03`.* A named exterior objective whose only walking route is a designed path; assert it is
reachable by levitation in < 40% of the walked time; assert **no** invisible ceiling, no "you cannot
go this way" string, no teleport-back, no despawn. **Red if a height clamp or an exterior blocking
volume appears.**

---

**B-04 — Sequence break into a late region at level 1.**
*What it is.* A walkable, unfenced route from the tier-1 start region to a tier-5 region, at level 1,
where a player who survives can take tier-5 loot back.
*Why it survives.* `RI-EXP01` hard fail 5 already forbids fencing exits; this entry states the
**upside** explicitly so it is defended as a feature rather than tolerated as a consequence. `S9`
gates by lethality, and lethality is a fence a player can beat.
*What it costs the player.* Forty deaths, and `RI-PRG04`'s unforgiving bloodstain means the souls lost
on the second death are gone. The region does not get easier for having been reached — `S9` forbids
level-scaling in both directions.
*Probe `PB-04`.* Pathfind start settlement → tier-5 region boundary on walkable navmesh with no combat
required; assert the path exists; assert **zero** blocking volumes, zero level checks, zero
"you are not strong enough" strings; assert a tier-5 item is obtainable and equippable at level 4
subject only to its own stat requirement. **Red if any soft wall, level gate or difficulty warning
is added to that route.**

---

**B-05 — Killing someone important, early.** `Perm ✔`
*What it is.* A main-quest-critical NPC can be killed in Act I. The severance warning fires and the
game remains completable via `RI-QST06`'s backpath.
*Why it survives.* `S10` already rules this. The register's contribution is to make it a **tested**
assertion rather than a stated intention, because "essential NPC" flags are added late, quietly, by
someone fixing a quest bug.
*What it costs the player.* **Permanently and unrecoverably**: the intended ending closes; the backpath
is harder; its ending's world state is worse (`RI-EXP05` LH12/LH16); several factions' lines close
with it.
*Probe `PB-05`.* Kill the Act II informant. Assert (a) the death succeeds; (b) the severance warning
arrives as a **journal entry in the player's own voice**, not a modal (`RI-DLG05`); (c) an irreversible
flag is set in `getQuestState().flags`; (d) an ending is still reachable, verified by scripting the
backpath to completion. **Red if the NPC becomes unkillable/essential, if a game-over fires, or if the
quest silently reassigns to a substitute NPC** — the last being the most likely and the most
corrosive, because it looks like it still works.

---

**B-06 — Robbing a merchant you can survive.** `Perm ✔`
*What it is.* A merchant's stock and gold pool are physical objects in a lockable room. A player who
picks the lock, or kills the town, keeps them.
*Why it survives.* `RI-PRG05` forbids the **flip** — arbitrage on the buy/sell multipliers. Theft is
not a flip: it is a one-time transfer priced in bounty and in a town. P5 holds because the flip
invariant is untouched: you still cannot sell the stolen goods back at a profit.
*What it costs the player.* Crime, witnesses and bounty accrue during and after — `ARBITRATION` §1
states consequences keep accruing mid-fight. And **the merchant does not respawn** (`S5`): that
merchant's services, stock, repairs, training and any quest that needed him are gone from the world
forever.
*Probe `PB-06`.* Assert the stock is a real container; assert the gold pool is takeable; assert bounty
and disposition deltas fire with a witness; assert the merchant is **absent from the world in a later
session** and that a quest depending on him reports an alternative or an in-fiction dead end. **Red if
merchant inventories become virtual, if the gold pool is untakeable, or if merchants respawn.**

---

**B-07 — The movement scroll that kills you, used correctly.**
*What it is.* `RI-EXP01` B09's *Scrolls of the Drowned Step* (Fortify Athletics 1000 / 6 s) — three of
them, on a body nobody explains. Reading one near open water kills you. Reading one **with fall
mitigation** crosses a third of the map.
*Why it survives.* It is the game demonstrating it will let you do the stupid thing, and then
rewarding the player who works out the clever version of the stupid thing. `RI-EXP01` requires the
scrolls to exist; this entry requires them to keep **working at their stated magnitude**.
*What it costs the player.* Usually death. Three scrolls exist and are consumed.
*Probe `PB-07`.* Read a scroll; assert the athletics/jump multiplier is applied at the declared
magnitude with **no clamp**; assert fall damage applies normally; assert that combined with a slowfall
or a water landing the traverse succeeds and lands the player > 400 m from the origin. **Red if the
magnitude is clamped, if velocity is capped, or if the scrolls are removed for being dangerous.**

---

**B-08 — Enchantment self-supply.** `Sys ✔` *(conditional — see the note)*
*What it is.* A constant-effect enchantment on a worn item supplies the magicka to cast the spell that
fills the soul gem that pays for the next enchantment.
*Why it survives.* It is the second canonical T4 exemplar and it is two systems meeting rather than
one lenient number. `S15` is not violated: souls-as-levelling-currency and soul-gems-as-enchanting-
reagents are different things, and gold remains the only *currency*.
*What it costs the player.* Soul gems are hand-placed or bought with gold; the loop consumes the gold
that would have bought training and the hours that would have been a faction rank.
**Conditional entry.** `corpus/25-magic/` is **empty**. Whether soul gems exist at all is an open
ruling. If the magic area rules them out, or rules that soul-trapping cannot fund enchanting, **this
entry is struck and must be replaced in the same wave** — the register may not fall below twelve live
entries (§C, PB-RULE clause 3).
*Probe `PB-08`.* Enchant → trap → enchant, two rungs; assert the second enchantment is fundable
entirely from resources produced by the first; assert no per-day, per-rest or per-session cap fires.

---

**B-09 — The disposition snowball.** `Sys ✔`
*What it is.* Disposition affects prices (`RI-DLG04`). A player who invests in Speechcraft, gifts,
faction reputation and fatigue management gets prices that break the intended gold curve.
*Why it survives.* This *is* Morrowind's economy. `RI-PRG05` forbids arbitrage, not being liked.
Closing it means clamping the disposition-price curve, which is the most likely single "balance fix"
in the whole project and would delete `RI-DLG04`'s reason to exist.
*What it costs the player.* Failed persuasion attempts cost disposition (`RI-DLG04`), so each push is a
gamble; gifts and bribes cost gold; and the hours spent making a town like you are hours not spent
levelling.
*Probe `PB-09`.* Measure buy price at disposition 30 vs 90 on the same merchant for the same item;
assert the delta ≥ 25%; **and assert `RI-PRG05`'s flip invariant still holds at disposition 100** —
buy-then-sell must still lose money. That second assertion is what keeps this entry inside P5, and it
is why the probe must be re-run every wave rather than once.

---

**B-10 — Talking a boss out of the fight.** `Sys ✔`
*What it is.* `S13` as amended requires a non-lethal exit for anything that can speak. A named,
factioned, humanoid boss can be ended by **knowledge** (speaking a name found in a book), by rank, or
by gold — without a corpse.
*Why it survives.* It is simultaneously a sanctioned breakage and the flagship seam crossing: it is
`RI-CMP01`'s `LOR → BOS` and `FAC → BOS` cells, and `RI-QST05`'s non-combat resolution bar depends on
it. `AR-1` is untouched — nothing about how fighting *works* changed; a fight simply ended a different
way.
*What it costs the player.* No souls, no boss drop, no upgrade material. The boss **walks away**, is
somewhere else later, and has an opinion about you that other NPCs share.
*Probe `PB-10`.* Enter the arena with the knowledge flag set; invoke parley; assert the encounter ends
with **no** `death` event; assert the boss entity persists in a later session at a different location;
assert zero souls awarded. **Red if bosses become parley-exempt, if the boss despawns, or if souls are
awarded anyway "so the player isn't punished".**

---

**B-11 — Bringing a monster to a fight you did not want.** `Sys ✔`
*What it is.* Leash rules (`RI-AI01`) let a hostile follow the player a bounded distance. The player
walks a tier-4 predator into a bandit camp, a guard patrol or a rival faction's outpost and lets them
resolve it.
*Why it survives.* It is the Dark Souls "lure the knight off the ledge" and the Morrowind "let the
cliff racer meet the Ordinator" in one entry, and it requires nothing to be built — only for NPCs to
remain mutually hostile and for aggro not to be cancelled at a settlement boundary.
*What it costs the player.* The survivor is at full aggro with the player's advantage spent. If
witnesses saw the lure, the faction blames the player — `ARBITRATION` §1 keeps crime accruing.
*Probe `PB-11`.* Aggro a hostile; path to a faction camp; assert NPC-vs-NPC combat occurs (a `hit`
event where neither owner is the player); assert a survivor exists; assert a faction-standing delta if
witnessed. **Red if hostiles de-aggro on entering a settlement volume, if NPCs become non-combatant to
each other, or if a "no monsters in town" despawn rule appears.**

---

**B-12 — Selling the quest item.**
*What it is.* Quest items are ordinary items. You can sell one. The quest does not break — it gets
harder: buy it back at a markup, steal it back, or resolve the quest by admitting what you did.
*Why it survives.* It is the purest single test of whether the world is a world or an administration.
A game that refuses this refuses it everywhere, in one line of inventory code, and nobody notices
until a player tries.
*What it costs the player.* Gold on the buy-back, a disposition hit with the giver, and a resolution
branch that is worse than the intended one.
*Probe `PB-12`.* Sell the Act I sealed case. Assert the sale succeeds; assert the merchant **actually
holds the item** in stock afterwards; assert the quest remains completable; assert ≥ 1 dialogue topic
exists that did not before (the confession route). **Red the day an `is_quest_item` sell-block is
added.**

---

**B-13 — The lock you should not be able to pick.**
*What it is.* One hand-placed, high-magnitude Open scroll (or equivalent) that opens the highest-tier
lock in the game, anywhere, **once**.
*Why it survives.* A finite, world-placed skeleton key converts exploration into any door in the game
and makes the player choose which one. It is a reward for looking, spent on a decision.
*What it costs the player.* One use. The door you chose is the door you did not choose, and there is
no second scroll.
*Probe `PB-13`.* Use it on a tier-5 lock at Security 5. Assert it opens; assert it is consumed; assert
no "you need skill X" refusal fires; assert no lock in the game is flagged unopenable-by-effect.
**Red if a "quest locks cannot be opened by magic" exception list appears.**

---

**B-14 — Reading the answer instead of earning it.** `Sys ✔`
*What it is.* A book (`RI-LOR03`) contains a boss's weakness, a faction's secret, or a route. A player
who reads it in hour two can act on it in hour three, skipping the quest chain that would have told
them.
*Why it survives.* `RI-LOR03`'s books exist to be read and acted on, and `PLAYTHROUGH-CRITIC.md` P7
requires ≥ 1 book acted on in every playthrough. If knowledge is not a key, books are furniture.
*What it costs the player.* Acting on lore you were not given costs the **credit**: the faction does
not know you did it, the rank does not advance, the reward is smaller, and the quest that would have
granted the standing is now resolvable only in a shorter, poorer form.
*Probe `PB-14`.* Set only the book-read flag, with no quest stage. Assert the target dialogue topic /
ability / route is available; assert the corresponding quest is resolvable in a shortened form; assert
the faction reputation delta is **strictly smaller** than the intended route's. **Red if knowledge
gates are re-expressed as quest-stage gates.**

---

**B-15 — Standing where the boss cannot reach you.**
*What it is.* Arena geometry the player reads better than the designer wanted: a ledge, a pillar, a
doorway the boss's capsule does not fit through, a height a jump attack does not cover.
*Why it survives.* It uses only rules the game already has, and it is a permanent part of the Souls
culture the fight is modelled on. Closing it requires anti-cheese teleports, arena invisible walls, or
an enrage timer — each of which is a Morrowind-side leakage into the fight's honesty and each of which
players read instantly as the designer arguing with them.
*What it costs the player.* It is slow, and `RI-AI01`'s leash will eventually reset and heal the boss,
so a player who takes too long loses the fight's souls and starts again. It is a legal strategy with a
bad exchange rate, which is the correct shape.
*Probe `PB-15`.* From a named ledge in a named arena: assert ranged damage lands; assert the boss does
**not** gain a teleport it lacks elsewhere, does not gain a ranged attack it lacks elsewhere, does not
become invulnerable, and does not enrage. Assert the leash **does** eventually reset it. **Red if an
unreachable-player enrage rule is added.**

---

**Register totals.** 15 entries · **8 systemic** (B-01, B-02, B-03, B-08, B-09, B-10, B-11, B-14) ·
**2 permanent unrecoverable world state** (B-05, B-06). Against `BAR-CRITIQUE-01` §3 rank 3's
thresholds of ≥ 12 / ≥ 4 / ≥ 2, that is 15 / 8 / 2. The margin above 12 is deliberate: B-08 is
conditional on a magic ruling that does not exist yet, and entries will be struck.

### C. The governing rule (binding, project-wide)

> **PB-RULE.** **No reference item anywhere in this corpus may introduce a new anti-exploit hard
> fail, clamp, cap, cooldown, exception list, or "cannot X while Y" rule without naming, in the same
> item, at least one `RI-EXP06` register entry that the new rule **preserves**, and stating how it
> preserves it.**

Three clauses follow and all three bind:

1. **The naming is a section, not a sentence.** An item adding an anti-exploit rule carries a line of
   the form `preserves: B-09 — the clamp is on arbitrage ratios, not on the disposition-price curve`.
   An anti-exploit rule that names no preserved entry is **out of process**; the coherence agent
   refers it here and this item's critic reports it.
2. **A rule that *closes* a register entry is legal, and expensive.** It must either (a) name a
   **substitute entry** added to this register in the same wave, or (b) **strike** the entry, with the
   wave number recorded, in an append-only strike log at the foot of the register. Struck entries are
   never deleted, exactly as `ARBITRATION.md` §5 handles superseded seam rulings.
3. **The register may never fall below twelve live entries.** If a wave's strikes would take it below
   twelve, the wave does not ship the strikes.
4. **The rule is symmetric.** This item may not add a breakage that makes another item's hard fail
   false (admission criterion P5). A proposed entry that would break the flip invariant, put a die in
   the fight, or produce no-cost progress is refused here, not negotiated there.

`PB-RULE` is the actual deliverable of this item. The fifteen entries are its evidence; the rule is
what changes behaviour in every future wave.

### D. What is *not* sanctioned (so the register cannot be read as permission)

Failing P1–P5. Named explicitly because each will be proposed:

- **Anything that puts randomness in hit resolution** (`S1`, `AR-1`). Not negotiable, not here.
- **Anything that produces a profitable flip** (`RI-PRG05`, P5). Steal, do not arbitrage.
- **Anything that grants progress at no cost** (`RI-PRG03` Cost Gate, P5). Jumping to raise Acrobatics
  is not in this register and never will be — Morrowind's *grind* is not Morrowind's *breakage*, and
  conflating the two is the most common misreading of the reference game.
- **Anything reached through a collision, physics or determinism failure** (P1). Out-of-bounds
  geometry is a bug report.
- **Respec, reclaim or transfer of upgrades** (`RI-PRG08`). Irreversibility is the point of the 84.
- **Warp-to-map-pin, teleport-to-objective, or recall out of a fight** (`S7`, `S19`). B-03 is
  exterior levitation and nothing more.

---

## Comparison method

**Step 0 — the register is data.** `corpus/95-experience/RI-EXP06.probes.json` is generated from §B by
`tools/experience/probes-from-md.mjs` so the register and the probe suite cannot drift. Each record:
`{id, title, systemic, permanent, admission:[P1..P5], probe:{scenario, setup, assertions[]}, status:"live"|"struck", struck_wave}`.

**Step 1 — run every probe, every wave.**

```bash
node tools/experience/breakage-probe.mjs \
  --probes corpus/95-experience/RI-EXP06.probes.json \
  --out reports/experience/w<N>/breakage-register.json
```

Each probe is a normal harness scenario (`HARNESS.md` §2) with a seed and an input script. Probes are
**assertions that the breakage succeeds** — the inverse of every other test in the project. A probe
that errors, times out, or cannot be set up scores **0** for its entry (`unmeasurable ⇒ 0`), exactly
like any other unmeasurable check. `PLAYTHROUGH-CRITIC.md` §3 P9 requires every probe attempted in the
playthrough; unrun probes score 0 and are listed.

**Step 2 — the regression comparison (this is the teeth).**
`breakage-register.json` from the previous wave is loaded and diffed. For every entry:

| Previous | Current | Result |
|---|---|---|
| pass | pass | `held` |
| pass | **fail**, no strike recorded | **`REGRESSION`** — see hard fail 4 |
| pass | fail, strike recorded with substitute or log entry | `struck` |
| fail | pass | `recovered` |
| absent | pass | `new` |

A `REGRESSION` is the specific event this whole item exists to catch: somebody closed a sanctioned
breakage while fixing something else, nobody noticed, and the game got tighter and worse in a way no
other verdict in the wave can see.

**Step 3 — the PB-RULE audit.** `tools/experience/pbrule-audit.mjs --corpus corpus/` scans every
`RI-*.md` changed or added in the wave for anti-exploit language (`automatic fail`, `hard fail`,
`clamp`, `cap`, `cooldown`, `may not`, `cannot … while`) in a scoring or threshold context, and
checks each hit for a `preserves:` line naming a live register entry. Emits
`pbrule-audit.json` with `violations[]`. **The audit's false-positive rate is expected to be high and
that is acceptable** — a flagged rule that legitimately has nothing to preserve clears itself with a
one-line `preserves: none — this rule constrains X, which no register entry uses`, and that line is
itself the useful artifact.

**Step 4 — the playthrough cross-check.** `PLAYTHROUGH-CRITIC.md` §3 P9 requires the probes attempted
in play, not only in isolated scenarios. A breakage that works in a fresh scenario and not in a
20-hour save is a different and worse defect, and is reported as `works_isolated_fails_in_chain`.

**Step 5 — the negative artifact.** Every failing probe carries its full trace excerpt and the exact
assertion that failed, plus a `git log -S` search over the wave's diff for the mechanism that closed
it, and that search's output — empty or not. Naming *who closed it* is not a blame exercise; it is how
the substitute-or-strike decision gets made by someone who understands the trade.

**No sabotage control is defined for this item**, and that is deliberate rather than an omission:
`PLAYTHROUGH-CRITIC.md` §4.5's control exists to validate instruments whose numbers have no absolute
meaning. This item's numbers are pass/fail assertions about whether a specific action succeeds. There
is nothing to calibrate — a probe either fires or it does not. The item is exempted from §4.5 and the
exemption is recorded in the verdict as `sabotage_control: "not_applicable"` with this reason, so it
cannot be confused with a skipped control.

---

## Scoring

Native scale: the register itself.

| Metric | Definition | Bar | Below bar | We lose |
|---|---|---|---|---|
| `live_entries` | entries with `status: live` | ≥ 12 | 10–11 | < 10 |
| `probes_passing` | entries whose probe asserted success | ≥ 12, and ≥ 0.85 of live | 0.65–0.84 | < 0.65 |
| `systemic_passing` | passing entries marked `Sys` | ≥ 4 | 3 | ≤ 2 |
| `permanent_passing` | passing entries marked `Perm` | ≥ 2 | 1 | 0 |
| `regressions` | `REGRESSION` rows in step 2 | **0** | — | ≥ 1 |
| `pbrule_violations` | anti-exploit rules added this wave with no `preserves:` line | **0** | 1 | ≥ 2 |
| `probes_run` | probes attempted (P9) | all | ≥ 0.80 | < 0.80 |
| `works_isolated_fails_in_chain` | entries passing in scenario, failing in the 20-h chain | 0 | 1 | ≥ 2 |

| Native | Band | Ladder ceiling |
|---|---|---|
| all bars met | Meets the bar | 8 |
| any one below bar | Below bar — named remedy required | 6 |
| any one at "we lose" | Loses outright | 4 |
| ≥ 2 at "we lose" | We lose | 2 |

**Native → ladder anchors:** 12 live / 9 passing / 3 systemic → ladder 4. 13 live / 12 passing /
5 systemic / 2 permanent / 0 regressions → ladder 6. 15 live / 15 passing / 8 systemic / 2 permanent /
0 regressions / 0 PB-RULE violations, all attempted in the 20-hour chain → ladder 8. There is no
ladder 9–10 for this item: "beats the reference on this dimension" would mean our game is more
breakable than Morrowind, which is not a claim anyone can evidence and not one worth making.

**Hard fails — any one caps the item at 2 and, per `PLAYTHROUGH-CRITIC.md` §2, makes the wave `DEAD`:**

1. **`live_entries < 12`.** The register fell below its floor.
2. **Every passing entry is a single tuned number** — `systemic_passing ≤ 2`. `BAR-CRITIQUE-01` §3
   rank 3's stated hard fail: a register of lenient constants is not a permissiveness budget.
3. **`permanent_passing == 0`.** Nothing the player can do to this world is unrecoverable, so nothing
   they do to it is real.
4. **`regressions ≥ 1`.** A sanctioned breakage stopped working and nobody struck it. This is the
   item's whole purpose and it is a hard fail rather than a scored metric because a silent regression
   is indistinguishable from a design decision after one wave and impossible to reconstruct after two.
5. **`pbrule_violations ≥ 2`.** The governing rule is not being honoured, so the register will erode
   on schedule regardless of this wave's number.
6. **`probes_run < 0.80`** — `unmeasurable ⇒ 0` on the rest, fail-closed. An asserted-to-work register
   that nobody ran is a wish list.
7. **B-05 fails specifically.** The severance path is the load-bearing entry: `S10` is a seam ruling,
   not a preference, and a build where quest-critical NPCs are essential has failed the Arbitration
   Rule, not merely this item.

---

## How we lose

- **The register is written once and never run.** Fifteen beautifully argued entries, zero probes,
  and the game quietly seals itself over four waves. This is the single most likely failure and it is
  why `probes_run` is a hard fail rather than a scored metric.
- **A regression is reclassified as a strike after the fact.** The probe goes red, someone writes a
  strike into the log retroactively, and the `REGRESSION` becomes a `struck`. The append-only log and
  the wave number are the only defence, and they are weak — the real defence is that a strike requires
  naming a substitute or dropping below twelve, and both are visible.
- **`PB-RULE` is honoured with boilerplate.** Every new clamp carries `preserves: B-04` whether or not
  it does, because the audit only checks that a line exists. The mitigation is that the *content* of
  the `preserves:` line is read by this item's critic and a false one is a finding — but nobody will
  read forty of them, and this is a real hole in the instrument. Stated rather than hidden.
- **We confuse the grind with the breakage.** Somebody reads this item as licence to reopen
  jump-to-raise-Acrobatics, `RI-PRG03`'s Cost Gate is weakened "in the spirit of permissiveness", and
  Morrowind's genuinely bad part ships alongside its good one. §D exists solely for this and it will
  still happen.
- **The conditional entry is never resolved.** `corpus/25-magic/` stays empty, B-08 stays conditional
  for three waves, nobody strikes it and nobody probes it, and `live_entries` is quietly 14 with one
  fiction in it.
- **The breakages get built and the *prices* do not.** Every entry works; none of them costs anything.
  Then the register has produced a trivially exploitable game rather than a generous one, and P2 was
  the entire difference. The probes assert the breakage succeeds; **most of them do not assert the
  price is paid**, because the price is usually a world state observable hours later. That asymmetry
  is the weakest part of this item's method and the honest place to attack it.
- **A player-facing "balance patch" mentality arrives with the first playtest.** Somebody plays for an
  hour, ladders alchemy, becomes a god, and files it as a bug. The correct response is B-01's price
  column and the incorrect response is a magnitude cap, and the incorrect response is the default
  everywhere in the industry. `PB-RULE` exists so that response costs a paragraph and a named strike
  rather than a one-line commit.

---

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **register** is constructed for this project. No upstream source defines a permissiveness budget,
a sanctioned-breakage register, or a rule requiring anti-exploit rules to name what they preserve.
`PB-RULE` and admission criteria P1–P5 are original and are the item's real content. Binding anyway
per `CORPUS-CONTRACT` §3.

The **premise** — that Morrowind's durability is substantially owed to its breakability — is
`canonical-recall` and is well supported by which of its properties are still discussed: the alchemy
fortify-intelligence loop, the Boots of Blinding Speed and the Resist Magicka workaround, the
hundred-point Acrobatics jump, the Scrolls of Icarian Flight, killing Vivec, and the "thread of
prophecy is severed… you may still" state after murdering a quest-critical NPC. Each is an event a
player caused by outsmarting a system, and each is retold. The Dark Souls half is weaker and is
labelled as such: soul farming, poise stacking and boss cheese are real and discussed but they are
**tolerated** rather than designed, and the claim that FromSoftware *sanctioned* them is not
supportable. B-15 is therefore argued from design consequence (closing it requires anti-cheese
teleports and enrage timers, which are worse) rather than from authorial intent.

**The individual entries are proposals of varying strength.** B-01, B-02, B-05, B-07, B-09 and B-12
are close transpositions of documented Morrowind behaviour and are the strongest. B-04, B-13 and B-14
are constructed from existing corpus rules (`S9`, `RI-LOR03`, `RI-EXP01` hard fail 5) and are safe.
B-03, B-10 and B-11 depend on rulings that exist (`S19`, `S13` as amended, `RI-AI01`) but on
implementations that do not, and their probes may need rewriting once those systems are real.
~~**B-08 is conditional and may not exist**: `corpus/25-magic/` is empty, soul gems have no ruling,~~
**CORRECTED 2026-08-14 (AUDIT-CITATION-STALENESS): both halves of that condition are false and have
been for some time.** `corpus/25-magic/` holds **six reference items** — `RI-MAG01`–`RI-MAG06` —
plus a `data/` directory; and magic *does* have a ruling: **`S19`**, which this same paragraph cites
two lines above as an existing ruling that B-03/B-10/B-11 depend on. The paragraph contradicted
itself within four lines. **B-08 is therefore not conditional on the existence of a magic corpus.**
What survives, and is the only live part of the condition: `S15`
is close enough to the question that a reasonable magic item could rule enchanting-by-soul-trap
out entirely. It is included with its condition stated rather than quietly assumed, and the register
carries three entries of margin above the floor for exactly this reason.

The **weakest part of the method** is named in `How we lose`: the probes assert that each breakage
*succeeds* and mostly do not assert that its *price is paid*, because prices are world states
observable hours later rather than assertions available in a 60-second scenario. A future amendment
should add a `price_probe` per entry, run inside the 20-hour chain rather than in isolation. Until it
exists, this item measures that the game is breakable and only partially measures that the breaking
costs anything, and a critic should say so in the verdict rather than let the pass stand unqualified.
