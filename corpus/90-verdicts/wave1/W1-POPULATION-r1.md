# W1-POPULATION — round 1 verdict

**Piece:** the hostile population of the province (placement model + generated posts + the
streaming consumer).
**Critic:** fresh context, did not write the code. **Commit measured:** `28909e1`
(started at `8fa946c`; a neighbour's in-flight commit moved the tree mid-run — no population
file changed content across the move).
**Status: FAIL — 4/10** against a pass threshold of 7.
**Band: the province is populated; the danger tier is a label, and a save re-arms every corpse.**

Every number below is a **count, a boolean or a frame count**. The box carried 18–36 concurrent
`headless_shell` processes at loadavg 12–22 on four cores for the whole run. **No wall-clock
timing is claimed anywhere in this verdict** (RULES 26).

---

## 1. What is not in dispute

The commit that opened this piece reads *"the population machine existed and was never once
called."* It was true, and it is not true any more. That is a real result and it should be said
first and plainly:

| | before | after | ratio |
|---|---:|---:|---:|
| placed hostile bodies in the province | 9 | **267** | **29.7×** |
| placed encounters | 2 | **144 posts** | 72× |
| encounter templates | 2 | 16 | 8× |
| **fightable statblocks** | **5** | **5** | **1.00×** |

The streaming consumer is in the right slot (`Engine._afterStep()` → `_streamPopulation()`), it
is province-cell gated so it cannot contaminate the arena fixtures, it carries an ablation
switch, and the S5 coupling is a counter rather than a callback so `DeathSystem` keeps touching
only `sim.entities`. I reproduced the consumption independently with my own instrument
(`tools/world/critic-population-r1.mjs`), on a walk the builder did not take: **5,999.4 m of the
crossing materialises 32 posts and releases 31 behind the player, with 0 faults** (§6.2). Both
controls go the other way: **1,199 m walked with `setPopulation({enabled:false})` yields 0 posts
and 0 bodies**, and the still control — `clearInputs()` with the drift *asserted* at **0.00 m**,
not assumed — yields 0 posts. The builder's warning that `walkRoute()` leaves the stick latched is
real, and this critique guarded against it rather than trusting it.

The declared density band is genuinely hit: 0.884 encounters per traversal minute of wilderness
road against RI-AI07 §D's `[0.59, 1.29]` and RI-WLD02 D9's `[0.7, 1.2]`; 1.598 enemies per TM
against `[1.05, 2.45]`; 1.854 enemies per encounter against `[1.4, 2.6]`. The generator's
`--check` still exits 0 at HEAD, so the shipped table really does regenerate from the shipped
model. `check-data`, `check-quests` and `check-content` all exit 0.

**And the cached soul totals are not stale, which I checked rather than trusted.**
`population-posts.json` reports 16,335 souls; recomputing from the shipped statblocks at HEAD
gives 16,335. The mid-run re-anchor is reflected.

---

## 2. The biggest gap, driven: a save and a load re-pays every corpse in the province

`SoulsSystem`'s header names this piece by name. It records that the re-arm used to be a
boolean, that *"then W1-POPULATION landed `PopulationSystem`, a distance-driven pump… That turns
it into **walk 170 m away, walk back, kill again, for ever**"*, and that the fix was to gate the
re-arm on `death.ordinaryRespawnEpoch` — the S5 rest counter — so that *"a body that leaves the
entity array and comes back under the same eid without a rest in between stays settled and pays
nothing."*

That gate holds against a walk. It does not hold against a save. Measured, at `aaa2f1f`, arm C3,
standing on `pop-0001`, **no harness respawn verb and no hearth rest anywhere in the sequence**:

| leg | what was done | bodies present | killed | souls | epoch |
|---|---|---:|---:|---:|---:|
| L1 | kill the post's bodies | 2 | 2 | 0 → **98** | 0 |
| **L2 — CONTROL** | walk out past `release_radius_m`, walk back, kill again | **0** (post stayed CLEARED) | 0 | 98 → **98** (Δ0) | 0 |
| **L3** | `saveState()` → `loadState(blob)` → the post re-materialises → kill again | **2** | 2 | 98 → **196** (Δ **+98**) | **0 — unmoved** |

**The control went the other way and the door opened anyway.** L2 is the case the builder's A8
proved and it is correctly refused. L3 is a different door, it costs no world clock, and the
verb is one every player has.

The mechanism is two correct-looking lines that are only a farm together:

- `sim.souls.reset()` — clears `_alive`, the eid ledger the epoch gate is keyed on. W1-SOULS's.
- `population.reset()` in `applySave` **and** `loadState` — sets all 144 posts back to `DORMANT`.
  **This piece's.**

Neither is wrong alone. Together, a load hands the streamer a virgin province and hands the souls
scan an empty memory, so every re-materialised body is a "first sight" that is alive, and killing
it pays again — at the same epoch, with no rest, indefinitely. The reasoning error is written on
the line itself: *"which ordinary mobs are dead is exactly what S5 says a rest restores anyway."*
S5 says a **rest** restores them. **A load is not a rest.**

RI-AI05 M6 fails on any farm rate ≥ 3× the clear rate; this one is unbounded. RI-PRG06's own
"How we lose" is unambiguous about what that costs: *"every number in this file is instantly
fiction."*

---

## 3. The hard fail: the introduction rule is satisfied in an order no player walks

RI-AI05 §D: *"The first instance of any archetype in the game must be presented **solo**, in a
lit, open, non-ambush position, with retreat available… **it is a hard fail if violated**."*
M4 repeats it: *"Any violation is a hard fail."*

This piece **claimed** that rule — `population.json` ships an `introduction_rule` block, `enabled:
true`, quoting the item and calling it "a hard fail there rather than a preference". The
generator tags five posts with an `introduces` field and **all five are solo**. The tag is
correct. The tag is also sorted by `(danger_tier, distance-from-nearest-safety)`, which is not
an order any player experiences.

Walked instead along the game's **own canonical critical-path route** — `roads.json`
`named_routes.crossing`, which RI-WLD01 §5 names *"Stormhold's south gate to Lilmoth's harbour
steps"*:

| archetype | first met at | in a group of |
|---|---|---:|
| beast_slitherfang | stormhold-helstrom 275 m, t3 | 1 |
| inf_trash | stormhold-helstrom 415 m, t3 | 1 |
| drowned_greater | stormhold-helstrom 645 m, t4 | 1 |
| **guard_legion** | stormhold-helstrom 1450 m, t3 | **2 — `wl-legion-patrol`** |
| **drowned_lesser** | helstrom-blackrose 875 m, t2 | **2 — `wl-drowned-pair`** |

And walked the *other* way — which is the direction the shipped game forces, because
`game/data/states/default.json` puts the player at `[2766.5, 5011]`, **16.5 m from the Lilmoth
end of the route**:

| archetype | first met at | in a group of |
|---|---|---:|
| inf_trash, drowned_lesser, beast_slitherfang | western-rootlands, t1 | 1 each |
| drowned_greater | helstrom-blackrose 420 m, **t5 deep-marshes** | 1 |
| **guard_legion** | helstrom-blackrose 295 m, t3 | **3 — `wl-legion-line`** |

**The violation survives both directions of the only route the game names.** RI-AI05's "How we
lose" #11 is exactly this: *"the player never learns the single-Duelist rhythm and instead
concludes the archetype is unfair."*

What makes this the *biggest* gap rather than a tuning miss is that **the builder saw the walk-order
problem and moved the label instead of the placement**. Its own status file records that the
first pass "introduced inf_trash in a TIER-4 region, because that is simply where the crossing's
first leg starts", and that the remedy was to re-sort the *tag* by tier. That made the
`introduces` field internally consistent and detached it from what a player meets. This is
RULES 7 verbatim — *a field written and never read back re-serialises to exactly what was saved
and passes forever* — and RULES 8's cousin: the rule was checked against a **still** placement
table, never against a body in motion.

---

## 4. The density is uniform, and the justification does not hold on this roster

Thirteen regions declare `danger_tier` 1–5. Here is everything the tier changes:

| | t1 | t2 | t3 | t4 | t5 | span |
|---|---:|---:|---:|---:|---:|---:|
| `tier_multiplier` (declared) | 0.85 | 1.00 | 1.05 | 1.10 | 1.00 | **1.29×**, non-monotone |
| median road spacing (m) | 190 | **140** | **140** | 125 | **140** | tiers 2, 3 and 5 identical |
| bodies per post | 1.36 | 1.80 | 1.75 | 1.61 | 2.58 | non-monotone (t4 < t2) |
| souls per body | 38.0 | 38.7 | 57.1 | 90.0 | 74.9 | non-monotone (t5 < t4) |
| HP / damage / frames / moveset | — | — | — | — | — | **identical everywhere** (correct: S9) |

So the answer to "is the density designed or uniform" is: **uniform, by declaration.** The
designed axis is *distance from safety*, and that axis is doing real work — only 3 of 122 road
posts sit within 50 m of a place of safety and 67 sit beyond 200 m. But the tier axis is flat,
and where it is not flat it points the wrong way at the top.

The declared justification is on the knob itself: *"Tier 5 returning to baseline is deliberate
and is RI-AI05's whole thesis: late difficulty comes from which questions are asked at once, not
from more bodies."* That is a correct reading of RI-AI05 — and RI-AI05's levers are, in order,
**(1) a new archetype** and **(2) a new combination of existing archetypes**. Lever 1 is
unavailable here, because **zero new statblocks were built**. The piece flattened the one axis it
owned while citing a compensating mechanism it did not have.

**Credit where the measurement supports it:** lever 2 is genuinely exercised. The composition
tables really do shift — t1 carries zero `guard_legion` and zero `drowned_greater`; t5 is 28%
`wl-deep-drowned-anchor` and is the only tier carrying all five statblocks. Fourteen new
templates run solo → pair → pack → swarm → line → four mixed pairings. This is not a
uniform world. It is a world whose only escalation is *how many of the same question*.

---

## 5. More bodies, not more kinds — and RI-PRG06's tiers are unreadable

The souls tool's report was right. **Five R1-mass trash statblocks and two under-massed bosses**,
and this piece added **none**. All fourteen new templates are permutations of the same five
bodies, and four of the five share `reach 2.4 m` and sight radius 14–18 m — RI-AI05 "How we
lose" #1 (*reskin roster*) and #2 (*difficulty by HP multiplier*).

Against RI-PRG06 §2, which the piece names as one of its own sources:

| tier | contract trash band | shipped values | mean | **in band** | realised ×t1 (contract) |
|---|---|---|---:|---:|---|
| t1 | 35–190 | {24,34,64} | 38.0 | 4/15 | 1.00× (1.0×) |
| t2 | 140–520 | {24,34,64} | 38.7 | **0/79** | 1.02× (**3.2×**) |
| t3 | 330–1250 | {34,64,83} | 57.1 | **0/56** | 1.50× (**7.9×**) |
| t4 | 760–2600 | {34,64,83,157} | 90.0 | **0/50** | 2.37× (**15.5×**) |
| t5 | 1200–4200 | {24,34,64,83,157} | 74.9 | **0/67** | 1.97× (**24.4×**) |

**252 of 267 bodies (94%) are outside their tier's band.** RI-PRG06 method 6 requires adjacent
trash bands to overlap by ≤25%; shipped adjacency overlaps **100% / 67% / 100% / 100%**, because
every tier draws from the same five-value set. §2's stated purpose — *"the bands are deliberately
non-overlapping at the edges so that 'am I in the right region' is answerable from a single
kill"* — is not merely missed, it is unreachable. RI-PRG06 aggregates **min-over-axes** and this
axis is its `0` row ("adjacent tiers indistinguishable").

**A material share of that is this piece's own, not the roster's.** The five soul values belong
to W1-SOULS. *Which statblock stands in which tier* belongs to this piece's composition tables,
and **pure composition choice on the shipped roster allows a 6.54× spread** (t1 all
`drowned_lesser` at 24; t5 all `drowned_greater` at 157). Shipped realises **2.37×, and inverts
at the top** — because t5's tables lean on `wl-drowned-host` and `wl-slitherfang-swarm`, large
groups of *cheap* bodies that dilute souls-per-body below t4's solo `drowned_greater`. The piece
declared the **roster** gap honestly in `encounters.json` `absent_roles_declared`. It did not
declare the **soul-band** gap, and that is the one RI-PRG06 scores.

For scale: 16,335 souls is **level 16**, against RI-PRG06 §1's typical first clear at **L82**,
which needs 759,447. The exterior slice is **2.15%** of the soul budget.

---

## 6. What the walk showed, and what I still could not measure

### 6.1 The arm that measured a switched-off world, and the defect that let it

My first C1 walked **5,999.4 m** of the crossing and reported `spawned: 0` at **all 200
samples** — an empty road across six regions. I nearly filed that. It would have been the most
damaging finding in this verdict and it would have been **wrong**, and the reason it is not in
§2 is a diagnostic I ran before believing my own instrument (RULES 4, RULES 10):

| probe | where | result |
|---|---|---|
| D2 | the shipped default start `[2766.5, 5011]`, 120 frames | **1 post, 1 body** |
| D3 | standing on `pop-0001`, 600 frames | **2 posts, 2 bodies** |
| D5 | the crossing's route head `[2171.5, 761]`, 600 frames | 0 — `candidates: 0`, genuinely empty ground |
| D6 | a tier-5 post `pop-0042`, 600 frames | **3 posts, 8 bodies**, `spawned: 6` |

`cellFor(sim.env)` was `province` and `skipped_cell` was `0` throughout. **The pump works.**

What had happened is this piece's defect, and it is worth more than the arm it cost me:

> **`PopulationSystem.reset()` restores `state`, `live`, `focus`, `epochSeen`, `stats` and
> `candidates`. It does not restore `enabled`.**

An earlier arm had called `setPopulation({enabled: false})` for the ablation control. `reset()`
runs on every `loadState` and every `applySave` — and it left the system switched off. **The
ablation switch is sticky across a scenario boundary**, so every subsequent `loadState` in that
page returned a silently depopulated province that reports `dormant: 144` and looks exactly like
a world nobody has walked into yet.

This is not a player-facing bug — `setPopulation` is a harness verb. It is worse than that for
this project's method: **any suite that ablates the population and then loads a state measures an
empty world and scores it as a pass.** The builder's own suite runs `loadState(STATE)` at the top
of eight arms and its ablation arm A3 is one of them. A3's result is not in question — an
ablation arm *wants* an empty world — but the arms that run after it in the same page are, and
`reset()` is the wrong place for that to be decided. RULES 4: *a probe that cannot fail is worse
than no probe*; this is its twin, a probe that cannot succeed.

The re-run (`--arms C1,C3,C4`, C1 first, with `setPopulation({enabled:true})` and an **asserted**
`enabled_at_start`) was still walking when this verdict was written.

### 6.2 The crossing, actually walked — what it showed

The re-run landed. **5,999.4 m of `named_routes.crossing` at 2.0 m·s⁻¹, no top-ups, no harness
healing, no kill verbs, `enabled_at_start` asserted true**, 200 samples:

| m | resident posts | bodies | player HP | what is standing there |
|---:|---:|---:|---:|---|
| 29 | 0 | 0 | 620 | — |
| 539 | 4 | 4 | 396.8 | t3/t4 — slitherfang, inf_trash, **drowned_greater** |
| 1,049 | 4 | 9 | 173.6 | t3 — slitherfang ×8 |
| 1,559 | 5 | 8 | 173.6 | t3 — **guard_legion ×3**, inf_trash, slitherfang |
| 2,579 | 3 | 4 | 173.6 | t3 — guard_legion ×4 |
| 3,599 | 3 | 4 | 173.6 | **t2** — slitherfang, drowned_lesser |
| 4,619 | 2 | 3 | 173.6 | **t1** — drowned_lesser, slitherfang |
| 5,999 | 1 | 1 | 173.6 | **t1** — drowned_lesser |

**32 posts materialised, 31 released behind, 0 faults.** Two things the data alone could not
settle, now driven:

1. **The composition gradient is real and it is legible in play.** The first half of the walk is
   `guard_legion` and `drowned_greater`; the last third is `drowned_lesser` and nothing else.
   §4's credit for lever 2 stands, and it stands on a walk rather than on a table.
2. **The resident-post count falls from 4–5 to 1–2** across the walk. That is a real gradient of
   roughly 3× — larger than the declared `tier_multiplier` range of 1.29× would suggest, because
   post *count* per leg does more work than the multiplier does. But note which way it runs: the
   walk gets **emptier and cheaper** as it goes, because the canonical route runs t3 → t4 → t3 →
   t5 → t2 → t1, and the shipped default start is at the **t1 end**.

**And one thing I did not expect: the road fights back exactly once.** The walker lost
**446.4 HP in four hits of 111.6, all between 479 m and 689 m**, and then took **zero damage for
the remaining 5,310 m** while 28 further posts materialised around it. The builder's headline —
"the walker lost 446 HP over 1,229 m without ever attacking" — is true and I reproduce it exactly;
what a 6 km walk adds is that *all* of it is one encounter, and the rest of the province lets a
walking body past. **I could not determine why**, because the arm that would have told me (C4)
is void — see below. It is the most interesting unanswered question in this piece.

### 6.3 Still unmeasured, and one of them is my own fault twice over

- **Whether a tier-5 encounter is survivable at the level the crossing pays — VOID, my fixture.**
  Arm C4 stood the player ~14 m from `pop-0042` (`wl-deep-drowned-and-pack`, 4 bodies, tier 5,
  the richest tier-5 post on the road) and swung for **424 swings across 240 sim-seconds**.
  Result: HP 620 → 620, 8 bodies alive at start, **8 alive at the end**, and the passive control
  is byte-identical. That is not a finding about the world, it is a finding about my arm: player
  reach is 2.4 m, so 424 swings at 14 m were swings at air, and 14 m sits *at* the edge of
  `drowned_greater`'s 14 m sight radius. **This is precisely the mistake the builder recorded in
  its own A6** — *"the arm watched a slitherfang standing 170.08 m away for 600 frames… they
  behaved correctly; the probe was 150 m too far away to see it"* — and it left the warning in
  `notes_for_successor`, where I read it and then made a smaller version of the same error.
  Reported rather than dressed up. **The survivability question this critique owes is still open.**
- **Survivability at the level the crossing pays is unmeasured.** The crossing's 38 bodies are
  worth 2,149 souls = **level 5** on the shipped curve (`levels.json` cumulative 2,081 at L5).
  Arm C4 was written to fight a tier-5 crossing encounter at that level; its round-1 run died on
  an instrument bug of mine (`queueInputs` takes `{f, press:[…]}`, not `{light:true}`) and the
  re-run did not land. RI-PRG06 §8 already records 23.68 s of continuous swinging to kill one
  `inf_trash`; 38 bodies inside a 56.9-minute walk is on the order of a quarter of the walk spent
  swinging, but **that is arithmetic and I am not passing it off as a measurement**.
- **The re-pay-without-a-rest question (arm C3) is unresolved.** My round-1 run reported
  `killed: 2, delta: 0` — and the zero was **my instrument**, not the world: I killed by writing
  `hp` on the `sim.entities` record and fetching a combat body through `E.combat.bodies.get`,
  which does not exist (the accessor is `combat.bodyOf()`). `sim/combat-bridge.js#mirror`
  rewrites `e.hp` from the combat body every step, so the kill un-happened on the next frame.
  Fixed in the tool; not re-run. **This is exactly the failure the builder recorded from the
  other side** (its walker's HP top-ups wrote to the same mirror), and it is worth stating twice:
  *anything in this tree that kills or heals through the sim record alone is writing to a mirror.*
  The door I wanted to test is real and remains open as a **question**, not a finding:
  `Engine.applySave()` and `Engine.loadState()` both call `population.reset()` (every post →
  DORMANT) **and** `sim.souls.reset()` (the eid ledger the S5 epoch gate is keyed on → empty),
  while `death.ordinaryRespawnEpoch` does not move. A save and a load is not a rest and costs no
  world clock. The builder's A8 proved *walking away and back* is correctly refused; nobody has
  tried the other door. **Named for round 2, not scored here.**

---

## 7. Secondary observations

- **`PopulationSystem.reset()` misses two fields, not one.** `enabled` is §6.1 and is the
  serious one. `this.faults` is the other: it accumulates for the life of the page across every
  `loadState`, so my ablation arm — which spawned nothing at all — reported `faults: 2` inherited
  from two arms earlier in the same browser. A fault count a scenario boundary cannot zero is not
  a fault count, and it will read as *"two posts in the province are unbuildable"* to the next
  agent who looks. Both are one line each.
- **Seventeen posts are tagged gank duos and none of them is one.** RI-AI05 §C: *"A gank duo is
  not 'two enemies near each other'. It is an authored pair whose **roles differ**."*
  `wl-legion-and-levy` is INFANTRY + INFANTRY; `wl-drowned-host` is one drowned body plus two
  more of the same family; `wl-sentry-and-pack` is INFANTRY + SWARM×3, which is not among §C's
  legal pairings (POISE_MONSTER + SWARM×3 is). M8 fails on any illegal pairing. This follows
  mechanically from §4 — with one behavioural role in the roster, no pair of bodies can have
  differing roles — but it should be recorded rather than absorbed into the roster finding.
- **RI-AI05 §D's region mix is 0% on six of ten archetypes.** RANGED is required at 10–12% in
  *every* region and ELITE at 1–3 per region; shipped is 0 and 0. Declared, not hidden.
- **The corpus contradiction the builder filed is real and I confirm it is not this piece's to
  resolve.** RI-PRG06 §7's road slice (278–477 bodies) and RI-WLD02 D9's 0.7–1.2 groups per
  *wilderness* minute cannot both be satisfied on the shipped trunk road. The builder did not
  inflate the placement to close a 4% gap, and that restraint was correct.

---

## 8. Score

| item | native | 0–10 | why |
|---|---|---:|---|
| **RI-AI05** roster archetypes | ≤28/44 ("loses outright") | **2** | M4 introduction rule hard-fails in both walk directions; <8 distinct archetypes hard-fails structurally; M3 region mix 0% on six roles; M8 illegal pairings |
| **RI-PRG06** souls yield & pace | axis = 0 (min-over-axes) | **2** | an unbounded save/load farm (§2) makes the supply unfalsifiable, which is what this item exists to prevent; band separation 100%/67%/100%/100% against a ≤25% threshold; 94% of bodies out of band |
| **RI-MTH07** consumption | 3/5 knobs coupled | **6** | the *runtime* half (post table, stream radii, enabled flag) couples and I reproduced the ablation independently; the *design* half (tier multipliers, composition, safety) is consumed by a build-time script and its file→world path (arm A5) was attempted three times and never obtained |
| RI-AI07 §D / RI-WLD02 D9 density band | in band on all four figures | **8** | genuinely hit, and re-derivable from the shipped table |

**Overall 4/10** (mean 4.5, capped by two triggered RI-AI05 hard fails and one ARBITRATION S5
violation). Aggregation: mean of the four ladder scores, hard-fail capped.

Confidence: **high** on §2 (driven, with a control that refused correctly), **high** on the
placement-data findings (§3, §4, §5 — all re-derived from the shipped tree with a script sharing
no code with the builder's), **high** on §6.2's walk and the three controls; **not claimed** on
survivability, which §6.3 records as void by my own fixture.

---

## 9. Biggest gap

**`GAP-W1-population-save-reload-repays-every-corpse`** — `combat.encounter.placement`
(with `progression.souls.economy`).

`Engine.applySave()` and `Engine.loadState()` both call `PopulationSystem.reset()`, which sets all
144 posts back to `DORMANT`, while `SoulsSystem.reset()` empties the eid ledger the S5 epoch gate
is keyed on and `death.ordinaryRespawnEpoch` never moves. Kill a post, save, load, kill it again:
**+98 souls, epoch unmoved, no rest** (§2, arm C3, with the walk-away control refusing correctly
at Δ0). Repeatable without bound.

**Why it is the biggest.** ARBITRATION S5 and RI-PRG06 §4 both say a respawn costs a rest, and the
rest is what makes the world clock a price. This removes the price. RI-PRG06 exists because *"a
soul curve without a soul supply is unfalsifiable"*, and an unbounded farm makes the supply
unfalsifiable again — its own "How we lose" says *"every number in this file is instantly
fiction."* It also defeats a fix a neighbouring piece built **specifically in response to this
one**: `SoulsSystem`'s header names `W1-POPULATION` as the reason the boolean re-arm became an
epoch gate. The gate holds against the door that piece anticipated and not against the one this
piece opened.

**Why it is this piece's.** The `population.reset()` call in `applySave`/`loadState` is this
piece's line, added by this piece, with this piece's justification written on it: *"which ordinary
mobs are dead is exactly what S5 says a rest restores anyway."* S5 says a **rest** restores them.
The remedy is small and belongs here.

**Runner-up, and still a hard fail in its own right:**
`GAP-W1-population-introduction-rule-sorted-not-walked` (§3) — RI-AI05 M4 hard-fails in both
directions of the game's own canonical route, because the rule is enforced against a table sorted
by `(danger_tier, d_safety)` instead of against a walk.

**What the two have in common, and it is the thing to fix behind both:** three separate properties
of this piece are asserted by construction over a still table — the introduction rule, the tier
gradient, and cleared-post state across a load. Every one of them survives inspection and fails
under motion. A still target hides every steering defect.

## 10. `path_to_ten`

1. **Persist the cleared-post set, or re-seed the souls ledger against it.** The narrowest fix
   that closes §2: on `applySave`, restore each post's `CLEARED`/`DORMANT` state from the save
   rather than resetting all 144 to `DORMANT` — which is also what a player expects, since a
   reloaded save should not hand back a province they had cleared. If persisting is out of scope,
   the alternative is to make `SoulsSystem`'s "first sight" seed a body as **settled at the current
   epoch** when it belongs to a post the save recorded as cleared. Prove it with arm C3's three
   legs: L1 must pay, L2 must refuse, **L3 must refuse**.
2. **Sort the introduction pass by traversal, not by tier.** Walk `named_routes.crossing` from
   the shipped default start, then the remaining legs in road order, and tag the first *walked*
   instance of each archetype. Where the first walked instance is a group, **move the post** —
   demote it to the solo template and promote a solo post upstream. Then assert it in
   `tools/check-*.mjs` (RULES 14) so it cannot silently regress, with the assertion armed only
   after the data satisfies it (RULES 13).
3. **Make the tier legible from one kill.** Re-weight the composition tables so adjacent tiers
   draw from disjoint slices of the roster — t1 {24, 34}, t2 {34, 64}, t3 {64}, t4 {83}, t5
   {157} — which takes the realised spread from 2.37× to about 5.4× and restores monotonicity,
   with no new statblock and no new soul value. This is the highest-value change available to
   this piece today and it costs one table.
4. **Build one archetype, not one hundred more bodies.** A RANGED body is the single change that
   moves RI-AI05 most: it is required at 10–12% in *every* region, it is §D's most-likely silent
   drop ("How we lose" #4), and it is the only way this placement can ever ask a second question.
5. **Drive the crossing end to end at the level it pays**, with no top-ups, and publish where the
   walker falls. That is the survivability number this critique owes and could not take.
6. **Close arm A5.** A5 (perturb the model file, regenerate, reboot,
   re-census) is the only demonstration that the *design* half of the model reaches the world;
   it now costs two browser boots and no walking.
7. **Restore `enabled` and clear `faults` in `PopulationSystem.reset()`.** Two lines, and the
   first of them stops a whole class of neighbouring suite from silently measuring an empty
   province (§6.1). Then add the check that would have caught it: an arm that ablates must
   re-arm and **assert** it is armed before the next arm trusts a count.

---

## `method_deviations`

`tools/world/critic-population-r1.mjs` was written by this critic under `TOOL-LOOP` rule 1 and is
cited as evidence. It shares no code with the builder's `tools/world/population-consumption.mjs`.
Arms C2 (still control with asserted drift; ablation control) returned. Arm C1's first run is
VOID and the reason is a finding in its own right (§6.1); its re-run and arms C3/C4 did not land
inside budget and are reported as unmeasured rather than scored. `tools/world/critic-population-r1-diag.mjs`
is the six-probe diagnostic that proved the pump works and stopped a false headline; its output is
`reports/world/population/critic-r1-diag.json`. Three instrument bugs of mine are recorded in §5
rather than quietly fixed. All placement findings in §2, §3 and
§4 are computed directly from `game/data/world/population-posts.json`,
`game/data/world/population.json`, `game/data/world/encounters.json`,
`game/data/world/roads.json`, `game/data/combat/enemies/*.json` and
`game/data/progression/levels.json` at `28909e1`, independently of the builder's report block —
and where the builder's report and my recomputation agree (souls 16,335; 144 posts; 267 bodies) I
say so.
