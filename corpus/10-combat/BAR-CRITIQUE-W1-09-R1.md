# BAR-CRITIQUE-W1-09-R1 — are the combat bars good enough?

**Critic:** bar-critic, combat pass 1. **Date:** 2026-08-06.
**Scope:** all of `corpus/10-combat/` — `RI-CMB01`–`RI-CMB11`, `RI-AI01`–`RI-AI07`, the four
`RI-CMB07` exemplar artifacts — read against `INTENT-AUDIT-CHARTER` §4 (the verbatim brief),
`ARBITRATION` §1/§2 (S22, S23, S26, S27, S29)/§3, `SCORING` §0/§1/§4, `CORPUS-CONTRACT`,
`RI-MTH07` and `EFFORT-POLICY`, with all three `W1-09` verdicts as the worked example of what
these bars actually did when they were run three times.
**This critic does not judge the build.** It judges whether these bars would catch a game that
fails the user's intent, and whether they can be passed by a game that does not.

---

# VERDICT: **NOT SATISFIED**

The one-line reason:

> **These bars can prove the machine is correct. They cannot prove the fight is a fight — and
> three of the twelve bars `W1-09` was scored against could not be passed by any build whatsoever,
> for reasons belonging to the corpus and to the piece boundary rather than to the builder.**

## Was it the bars, or the build?

**Both, and the split is measurable rather than rhetorical.** That answer is not a hedge; it is
the finding, because the two failures have been masking each other for three rounds. The bars
made the piece unpassable, which made the score flat, which fired the escalation trigger, which
sent an Ultracode dispatch at a build whose real defects the same bars were simultaneously
**under-charging**.

Said as plainly as I can:

- **The bars are why the piece cannot pass.** With `RI-AI01` pinned at 0 by a piece that does not
  exist and `RI-CMB07` capped at 2 by an artifact the corpus invalidated and never regenerated,
  the other ten items must average **8.2** for `W1-09` to reach a wave-1 gate of 7.0 — a
  configuration `SCORING` §4 instructs the project to disbelieve on sight.
- **The build is why the piece should not pass.** Round 3's own measurements contain two
  `coupling == 0` models and a sweep whose substep count changes nothing, and `RI-MTH07` and
  `RI-CMB04` M2 already say what each of those costs. **Round 3 was scored too generously, not
  too harshly.** Fixing the bars does not rescue this build; it stops the next round arguing
  about the wrong thing.

## What is good here, said first so the criticism is not mistaken for a survey

`RI-CMB07`'s row 22 — the committed-frame ratio — is the best single number in this corpus. It is
dimensionless, it survived a factor-of-two error in every frame count in the project unchanged,
and it is the one statistic that distinguishes a Souls fight from a hack-and-slash without
reference to any tuning. `RI-CMB02` §E's readability contract is built entirely from ratios and
separations and therefore cannot be satisfied by moving one number. `RI-CMB04` §A's ten-step
per-frame order is genuinely binding and would catch most of the ways a Three.js build goes wrong.
`RI-CMB11` exists at all, which is rare — almost no project instruments the gap before animation
frame 1. And `RI-CMB07` §0's refusal to mechanically dilate the exemplar `f → 2f`, with three
worked reasons for why that would produce a *wrong* artifact, is the corpus at its best.

None of that is in question below. What is in question is that eleven items of this quality
produced three consecutive 4/10s while three separate critics found the fights themselves broken
by hand, one round late each time.

---

# R1 — `AMENDMENT-W1-10-BAR-01`: the chain multipliers. **GRANTED IN FULL, and applied.**

**Verified.** `RI-CMB02` §C published the R1 chain modifiers as one row per chain position,
applied to every class alike — `×0.78 / ×1.00 / ×1.05` for hit 2, `×0.78 / ×1.00 / ×1.35` for
hit 3. That is a direct quotation, not an inference. `RI-WPN02` §B's authority note makes
`RI-CMB02` binding on frame values, so a builder who varied them would be publishing frame data
that contradicts the corpus. My predecessor's finding stands exactly as filed: **every combo in
the game shared one rhythm envelope by corpus construction**, and the only thing that differed
between a dagger's four-hit chain and an ultra greatsword's three-hit chain was the scale.

**It is a contradiction of the brief.** `INTENT-AUDIT-CHARTER` §5.4 records the user's direction
verbatim: *"each weapon subtly unique — light, heavy, **combos**, roll-attack, backstep-attack"*.
Combos are named. §7 of the same charter settles the conflict: *"when an item's language and the
brief's language differ, the brief wins."* This is the **narrowed** drift type from §6's table —
a rich requirement replaced by a thinner one because tabulating a modifier once was easier than
tabulating it fourteen times.

**Applied**, in `RI-CMB02` itself so builders and critics read amended text:

- §C's two chain rows become **defaults**, with a per-class override in `RI-WPN02` §B inside
  **±0.20**.
- §E's `recovery / startup ≥ 1.40` now binds **every link of the chain**, not only the chain root.
- New method **M4b** — per-class chain tempo, measured, with a required deviating set of **≥ 6 of
  the 14 melee classes** and a reported per-class link-tempo vector.
- New **automatic fail**: fewer than 6 of 14 classes deviating. That is failure mode 3
  ("everything is 20 frames") one level up, at the level of the combo.

**One clarification the request did not make, added on grant.** *Only tempo is overridable.*
Active frames, stamina, motion value and poise damage stay on the shared rows, so a class cannot
buy damage or economy through the chain table. And the ±0.20 budget is **bounded by the new
per-link rule and not free**: the worst legal corner (startup ×0.98, recovery ×0.85) multiplies
the base ratio by **0.867**, giving 1.21 on a class sitting on §E's 1.40 floor. That corner is
illegal and a class must prove its declared pair rather than assume the budget.

**On the `Rh` rejection.** `AMENDMENT-W1-10-CRITIC-01` rejected a frame-side chain-rhythm metric
because, with uniform multipliers, its components correlated **−0.976** with `r1_startup` — i.e.
with mass. That rejection was correct *at the time* and is now obsolete **as a reason**: chain
tempo carries independent information once it can vary. `RI-WPN03` §D.3's geometry-based `Chg`
stays adopted; whether a frame-side companion is re-admitted is `RI-WPN03`'s call, on evidence.

---

# R2 — `RI-CMB07`'s exemplar. **The instrument is replaced, no threshold is lowered, and the orchestrator's refusal is upheld.**

The dispatch asked the harder question: *is a 24-to-29-row banded statistical fingerprint of a
single scripted fight the right way to measure whether combat feels like Souls at all?*

**My answer: it is the right *kind* of instrument, it was the wrong instrument as built, and the
defect nobody named across three rounds is that it has a free parameter under the control of the
party being measured.**

## R2.1 The fingerprint measures the bot, and the bot is the builder's

Every one of the banded rows is a joint function of two things: the engine, and the policy the
player follows. `RI-CMB07` M2 let the builder author the second one. Three rounds are the proof,
and each round moved the fingerprint by editing the player rather than the engine:

| Round | What moved the statistics | Consequence |
|---|---|---|
| 1 | a bot that was never hit | rows 13, 14, 16, 19, 29 wrong together — *"the exemplar has no danger"* |
| 2 | `eatRate`, a per-swing probability of declining to defend, **whose own comment said "it is where rows 13, 14 and 21 come from"** | the danger *was* a tuned constant |
| 3 | `staminaFloor` (18–30 per profile), below which the bot declines to swing | rows 16, 17, 22 and **28** left band; row 28 = 0 fired the item's automatic fail and capped the item at 2 |

Round 3 did not break the stamina economy. **It wrote a player who never tested it**, and this
item could not tell the difference. That is the identical disease `BAR-CRITIQUE-W1-10-R1` §R6
found in the weapons area, arriving here by a different road: an instrument that measures a very
good spreadsheet, accurately.

It is worth naming what round 3 *did* earn, because it is the hardest claim in this project:
`eatRate` is gone, and the danger survived `--greed-scale 0` **and** the roll jitter zeroed to
nothing, reproducing the shipped median 0.842 to the digit. That is a real result. It is also,
precisely, a result about the bot — which is why the next round could still delete the pressure
without touching a line of engine code.

**The fix, written into the item, and every part of it makes M2 harder:**

- **§F publishes the player.** `ES-PILOT/1` is a corpus-owned deterministic policy with every
  threshold fixed, whose only inputs are quantities a player can perceive; the enemy's scheduled
  future action, its internal timers and its declared frame table are forbidden inputs, on pain
  of `VOID`. **There is no greed, eat-rate, aggression or stamina-floor knob**, and rule 5 —
  the only stamina rule — backs the pilot off rather than letting it decline at the margin. *The
  pilot is required to spend into the bar and get caught doing it.*
- **The falsification triple.** M2 now runs three policies on the same engine: `ES-PILOT/1` must
  land ≥ 25 of 29 banded rows, and `ES-MASHER/1` and `ES-TURTLE/1` must each land ≤ 13. **A
  fingerprint that is in band however the player plays is measuring nothing**, and until this
  amendment nothing in the corpus detected that. Both degenerate policies must also *die* to an
  encounter the pilot survives.
- **The pilot diff is a deliverable.** `eatRate`'s deletion and `staminaFloor`'s arrival were each
  a one-line change to the thing being measured, and each cost a full critic round to find by hand.
- **The denominator is fixed at 29 and the pass fraction is held.** §D.1 closes the banded set at
  26 rows (the item said 24, the table always showed 26, and a build duly un-banded row 9 — which
  it failed 5 of 5 — while keeping the total at 24); §D.2 adds three attribution rows. `ceil(29 ×
  20/24) = 25`. Taking ≥20 of 26 would have been a quiet relaxation under cover of a counting fix
  and is refused. §D.1 also settles which median M2 means — per-row across fights, not per-fight
  across rows, which was the generous reading a build chose.

## R2.2 Row 28's automatic fail measured a bot. **Relocated, not deleted.**

`RI-CMB07`'s hard fail *"row 28 equal to 0 — the stamina bar never denied an input, so there is
no economy"* is a correct requirement attached to the wrong observable. A correct engine plus a
pilot that declines to over-commit gives row 28 = 0, and in round 3 exactly that capped the whole
item at **2** under `SCORING` §1.1 for a build whose stamina denial worked.

The requirement moves to where it discriminates:

- **Automatic fail: row 28 == 0 under `ES-MASHER/1`.** A player pressing attack on every accepted
  frame who is *never* refused has no stamina economy. That is an engine fact no policy can fake.
- **Row 28 == 0 under `ES-PILOT/1`** is an ordinary out-of-band row. It costs M2 a row and does
  not cap the item.
- **The directed proof lives in `RI-CMB03` M6b (`M-STAM`)**, added in this pass: for every action,
  at `cost − 1`, `cost − 0.1`, `cost` and `cost + 0.1`, the two sub-cost values must emit
  `INPUT_DROPPED reason:"no_stamina"` with no state change and the two at-or-above must execute
  and deduct in full, mirrored for enemies. M6 tested stamina *exactly zero*; the margin case —
  where the whole economy actually lives — was untested by anything in the corpus.

Test the change honestly: **would round 3 have passed under it?** No. Row 28 = 0 under the pilot
is still an out-of-band row; 18 of 24 is still short of the pass; the masher run does not exist
and is unmeasured ⇒ 0. The build still fails, and now it fails for a reason it can act on.

## R2.3 Seventy of `RI-CMB07`'s hundred points could not be earned by any build

This is the finding the three rounds of argument about row sets were sitting on top of.

| Check | Weight | Status through all of wave 1 |
|---|---:|---|
| M0 format conformance | 15 | runnable |
| **M1 Mode A replay** | **30** | replays `RI-CMB07-exemplar-scenario.json`, which carries an `INVALIDATED` block and which a conforming harness is *designed* to fail on. **Unearnable. Corpus's debt, not the build's** |
| **M2 Mode B free play** | **40** | requires *"our real game with real AI … RI-AI01–05 govern it"*. `W1-12` does not exist. **Unearnable** |
| M3 fingerprint plots | 10 | runnable |
| M4 adversarial self-check | 5 | runnable |

**Maximum attainable native score: 30/100.** The item's own bands put <70 at "we lose" and its
ladder anchor row puts native 70 at ladder 4. **`RI-CMB07` could not exceed ladder 3 under any
build in wave 1**, and it was scored 2, 3, 2. The same fixture kills `RI-CMB03` M7's ten points
by the same mechanism, and nobody noticed because it is only ten.

The brief is unambiguous about what a reference item is for: *"for each dimension find or
construct a reference artifact a later agent can hold its own work against and lose to."* **Since
wave 0 there has been nothing here to lose to.** §0 said the first critic touching `combat.trace`
must open the regeneration as its `biggest_gap`; three critics touched it and none did, because
each had a louder defect in front of it.

**Ruled, in `RI-CMB07` §0.1 and `RI-CMB03` M7:**

- While an artifact carries `INVALIDATED`, **M1's weight is `corpus_debt`** — removed from
  numerator *and* denominator, with raw and runnable reported on the same line, and the debt filed
  against the corpus rather than the build. Same for `RI-CMB03` M7.
- **M2 splits by the question it asks.** `M2-CTRL` (weight 25) runs the falsification triple
  against a **declared, published, unchanging** enemy script and answers *is the fingerprint
  caused by play?* — a fixed enemy is the right control for that question, and it is runnable
  today. `M2-LIVE` (weight 15) keeps the real-AI requirement, answers *is the fingerprint caused
  by our game?*, and is recorded at 0 as a **cross-piece coupling debt owned by the
  `W1-09`↔`W1-12` seam**. The enemy script is subject to exactly the discipline §F imposes on the
  player, or the free parameter simply moves from the bot to the boss.
- **No band moves and no row is dropped.** Runnable weight in wave 1 is 55, and a build must still
  earn 70% of the renormalised total to escape "we lose". A build that would have scored 41/100
  scores 41/55 → still below 70 → still loses.

## R2.4 On the refused Mode B-prime — **I do not overturn it**

The dispatch offered me the chance to overturn the orchestrator's refusal of a reduced row set for
rows 2, 22 and 27. **I decline, and the refusal was right.** A bar that moves to meet the work
stops being a bar; a dependency is not a defect in the instrument; and the round-3 critic's
disposition — score them 0, leave the debt visible in the ledger, build `W1-12` — is correct.

But the refusal answered a smaller question than the one in front of it, and answering it
correctly is why the larger one went unexamined for two further rounds. Three rows out of band
because the AI does not exist is a dependency. **Seventy points of an item's weight unearnable —
thirty of them because the corpus invalidated its own reference artifact and never regenerated
it — is not a dependency. It is `SCORING` §0's own category: *"an item that cannot reach 10
because the corpus is broken is a corpus bug. Fix the corpus."*** Three of those are already
listed there. This is the fourth and the most expensive, because it sits on the one item whose
whole job is to judge whether the fight is Souls-shaped.

## R2.5 Is the fingerprint the right instrument at all? — the honest answer

It is **necessary and insufficient**, and it has been asked to carry more than it can.

What it does well: it measures the game *in motion* rather than in isolation; row 22 catches
attack cancellation, which is the failure this genre dies of; rows 7–9 catch an i-frame boolean
masquerading as a window; and the bands are ratios, so they cannot be satisfied by adjusting one
number.

What it structurally cannot do, each demonstrated by a wave-1 verdict rather than argued:

1. **It cannot see what hit you.** Round 3 measured that five to seven of the eight blows killing
   a motionless player were the champion's **torso** walking through them, each paying the
   greatsword's 96 damage. Rows 10–14 scored that as a healthy hit distribution, because a hit is
   a hit. Fixed here by §D.2 and the required `via` field (see R3, R6).
2. **It cannot see whether a telegraph was readable while playing.** Every row is a frames-over-
   frames ratio; none asks when the animation started *looking* different.
3. **It cannot see whether the player's decisions mattered**, because it is computed from a single
   timeline and cannot ask what would have happened otherwise.
4. **It is one fight, against one enemy.** "Median over ≥5 fights" is five samples of one point.
   M2b now requires ≥3 archetypes and cannot pass at one.
5. **It is blind to the wall clock.** See R7.

So: keep it, shrink its claim, remove its free parameter — and build the thing it cannot do. That
is `RI-CMB12`, filed under R3.

---

# R3 — Does anything in `corpus/10-combat/` measure whether a fight is *good*? **No. Hole filed.**

I read all nineteen items in the directory for this. The answer before this pass was **no**, and
the demonstration is the wave-1 record rather than my opinion: the build passed frame censuses,
i-frame windows, stamina curves, commitment grids, root-motion fidelity and determinism, in three
consecutive rounds, while three independent critics found by hand —

1. a 120-second exemplar in which **the player was never hit at all**;
2. a boss whose correct answer was **to walk inside it and stand still**;
3. a hole in every enemy weapon arc, covered by a second volume that paid the blade's damage.

Not one was caught by an instrument. Each was caught by a critic being clever, one round late.
**A bar that depends on the critic being cleverer than the bar is not a bar.**

**Filed: `RI-CMB12` — the exchange: reactability, decision divergence, and whether the fight is a
decision at all.** Two measures, both runnable against the build that exists today, neither
requiring an exemplar, enemy AI or a tuned bot — which matters, because every other quality
instrument in this area is currently blocked on one of those three:

- **`ES-REACT/1` — reactability.** `t_react = f_active − f_vis`, where `f_vis` is the frame the
  windup pose becomes *distinguishable* (12° max joint deviation over six named joints, or
  silhouette IoU ≤ 0.92, later wins on disagreement). Budget **≥ 19 f@60** = 15 f human + 4 f
  machine from `RI-CMB11`'s own table. And `lie = t_label − t_react ≤ 8 f@60`: **`RI-AI02` checks
  the state window; nothing checks whether the animation is visible inside it.** A 44-frame windup
  that reads as idle for 40 frames passes every existing check and is what a Three.js build
  produces when the clip is authored as a slow ease-in.
- **`ES-DIVERGE/1` — decision divergence.** The counterfactual: fork the sim at 200 sampled
  frames, run 8 alternative actions to a 120-frame horizon, measure the spread of exchange value.
  `DIV < 0.02` is a slideshow with a health bar — frame-perfect and the player is a spectator.
  `DIV_dominant > 0.70` is a solved fight, and **rounds 1, 2 and 3 are each a high-`DIV_dominant`
  state**: this single number would have caught all three at the round they appeared, without a
  critic having to invent a probe. `DIV_dead` puts a number on `RI-CMB07`'s "How we lose" #7
  ("technically correct and dramatically dead") for the first time. M3 additionally hard-fails if
  `do_nothing` is the dominant action on more than 5% of sampled frames — the turtle, which has
  now been shipped twice.
- **§D — the feel citation.** The corpus *does* own hit feel: `RI-WPN05`, `RI-CAM06` and
  `RI-AUD01` jointly judge `combat.feedback.hitstop`. All three live outside `corpus/10-combat/`
  and **no `W1-09` verdict has ever cited one**, while `W1-09` owns the resolver that applies
  hitstop and `W1-10` round 2 found the hitstop tables **INERT**. `RI-CMB12` M5 makes citing
  `ILS` and the hitstop consumption result mandatory in a combat verdict. Eleven verdicts now
  exist with no number in them about what a hit feels like.

`RI-CMB12` requires two harness surfaces that do not exist — **fork/restore of full sim state**
and a **per-frame tracked-joint dump** — and says so, with M2 scoring 0 fail-closed if fork/restore
is absent. Naming them is the point: a counterfactual you cannot run is not a measurement.

---

# R4 — CONSUMPTION. **It never reached `corpus/10-combat/` at all, and where the equivalent check already existed it was not enforced.**

**Measured, before this pass:** `grep -c 'RI-MTH07|CONSUMPTION|world-side consumer'` over
`corpus/10-combat/*.md` returns **0 for all eighteen items**. My predecessor found the same
stalled correction in `12-weapons` and fixed it there; here it had not moved at all. `ARBITRATION`
§3 carries it, which is why the round-3 critic ran it — the check reached the **critics** and
never reached the **items**, so nothing said which models must be enumerated, and nothing said
what a zero costs.

**And the consequence was under-applied.** Round 3 enumerated six models by its own choice and
found two orphans:

| model | perturbation | observed | `RI-MTH07` verdict |
|---|---|---|---|
| `hitgeometry §bodies.separation` | both radii → 0 | **no change whatsoever** — 585/2617 interpenetrating frames and 0.015 m minimum centre distance, byte-identical | `coupling == 0` |
| `hitgeometry §sweep.substeps` | 4 → 1 | **hit set byte-identical**, 36 of 71 distances, none lost, none gained | `coupling == 0` |

`RI-MTH07`'s threshold is binary — *"any `coupling == 0` on a model the piece's own reference
items require to act"* forces that dimension to **0**. The verdict recorded `CONSUMPTION: partial`
and scored `RI-CMB04` at 55/100. **`partial` is not a disposition this check has.**

Worse, and this is the sharpest thing in the round-3 record: the substep ablation **was already in
`RI-CMB04` M2** — *"Re-run with substeps forced to 1 and confirm the sim now produces misses; if
it does not, sweeping is not actually implemented and the substep parameter is decorative."* The
critic measured exactly that outcome and **filed it as a proposed corpus extension (`M2c`)** rather
than as the M2 failure the item already defined. The bar was adequate and was not applied.

**Applied in this pass:**

- A **`### CONSUMPTION`** block written into `RI-CMB01`, `02`, `03`(via `04`'s full statement),
  `05`, `06`, `07`, `09`, `11` — exhaustive enumeration, perturb-and-observe with the null control,
  entity-side observable only, and the binary consequence stated at the item.
- `RI-CMB04` carries the full statement with its own model list and the wave-1 evidence.
- **`RI-CMB04` M9** makes the substep ablation a **scored check with its own weight**, failing when
  the set of outcomes that change is *empty*, so it cannot be filed away a second time.

---

# R5 — The `RI-CMB07` M3(d) blind pack. **VOID as run, and `not_possible` until the exemplar exists.**

`RI-CMB07`'s blind protocol says: *"hand the critic the four M3 plots for our fight **and for the
exemplar**"*. The exemplar is `INVALIDATED`. Round 3 therefore generated the counterpart *"from
§D's stated fingerprint"* — **from this item's own published bands** — and ours won.

That is not a blind test of whether our fight looks like a Souls fight. It is a test of which
strip better matches a table both sides can read, and it is precisely the defect my predecessor
required `VOID` for in the weapons area, where blind packs were being passed by reciting JSON
columns with the header removed. I apply the same scrutiny and the same consequence.

**Ruled, in the item:**

- **A pack whose counterpart is generated from §D, from this item's text, or from any published
  design table is `VOID`.** A verdict citing one records `blind: void` with the reason.
- Until the exemplar is regenerated, record `blind_pair: not_possible`, reason *"reference
  artifact INVALIDATED since wave 0"*, per `SCORING` §1's allowance. **An honest `not_possible` is
  worth more than a test the build can win by reading the bar.**
- When the exemplar returns: both sides runtime-generated, all axis labels, band annotations and
  row numbers stripped — and the fine discriminator becomes a **numeric gate**.
  `p90_iframe_to_hitbox ≤ 40 f@60`. Round 3 won the coarse strip and measured **58–96 f**, with
  the player invulnerable for 803–1014 frames against 360–443 frames of anything trying to hit it.
  **A blind test that can be won coarsely and lost finely is not yet an instrument**, and the
  round-3 critic was right to file it; it is now a band rather than an observation.

---

# R6 — S26, and the piece decomposition

## R6.1 Is S26 as amended testable, and did anything in `corpus/10-combat/` contain a method for it?

**Testable in principle. And the corpus contained no method for it whatsoever.**

`grep -n 'S26|body corridor|body capsule|body hazard|root translation'` across `RI-CMB01`,
`RI-CMB02`, `RI-CMB04` and `RI-CMB05` returns **nothing but `RI-CMB02`'s unrelated use of the word
"separation" in its S22 unit table.** S26 imposed a positive requirement binding on every attack in
the game, and required every combat critic to *"measure minimum reaching distance directly, at
contact range, against a stationary target"*, to *"confirm the reachable band is contiguous"*, and
to *"never infer reach from declared values"* — **and not one of `RI-CMB04`'s seven methods tested
any of it.**

This is `INTENT-AUDIT-CHARTER` §6's **stalled correction** in its purest form: *"a ruling amended
without its enforcement amended is not fixed. Always trace a correction all the way to the check
that would catch a violation."* The ruling was traced to a paragraph in `ARBITRATION` and stopped
there. The consequence is exactly what the charter predicts — the round-2 critic found the hole by
diligence, the round-3 critic found the cover by diligence, and no third round has any guarantee
of a critic diligent enough.

**Does the corpus contain a method that would have caught a body corridor paying a weapon's
damage?** No. Nothing anywhere in the corpus recorded *what hit you*.

## R6.2 The open arbitration question. **Ruled: the corridor is a hazard, not a weapon.**

The round-3 critic filed rather than invented a ruling, which was correct and is why it lands
here. S26 said *use the same volume for pushing and for hitting* and said nothing about the damage
number; a build read the silence as "the weapon's". Measured: **96 damage whether the greatsword
cut at 3.65 m or the champion's chest arrived at 0.05 m**, and on the player's side 14 of a
dagger's 19 connecting distances and 15 of a straight sword's 36 were torso-checks paying the
blade's damage.

**That makes reach cosmetic**, which is `RI-CMB02` "How we lose" #10 — *"damage applied on the
frame of input rather than the frame of geometric overlap, which makes every weapon feel identical
and makes reach a cosmetic property"* — arriving through a door nobody was watching. It also
quietly guts the entire `12-weapons` area: eighty-seven weapons differentiated by reach, in a game
where reach does not decide what your damage is.

**Ruled and written into `ARBITRATION` S26:** a body corridor **must declare its own
`motion_value` and `poise_damage`**, and a `via: "body"` hit's damage must be **strictly less**
than the same attack's `via: "weapon"` damage. A shoulder-check is a shove.

**And S26 now has an instrument**, in the items rather than the ruling:

- **`RI-CMB04` M8** — for *every* attack, player and enemy: measured minimum reach at 0.05 m
  resolution against a stationary target; **contiguity as a hard fail** (the spear's 1.20–1.25 m
  and halberd's 1.15–1.30 m interior gaps mean a spearman standing at 1.22 m cannot be hit by
  anything, and no aggregate in this corpus would ever surface that); the **two-volume ablation**,
  failing if removing the corridor moves minimum reach by more than 0.35 m — *that difference is
  the hole the corridor is covering*; the `root_dz = 0` guard, which is the one thing rounds 2→3
  got right and which now has a check; **attribution**, hard-failing when a body hit's damage
  meets or exceeds the weapon's; and **one body, one radius**, because a player who is 0.30 m wide
  to a sword and 0.55 m wide to a wall is two different characters.
- **`RI-CMB07` §D.2** — the required `via` field on every `HIT`, and rows 30–32
  (`body_share_of_hits` ≤ 0.20, `body_share_of_damage` ≤ 0.10, `mean_body_dmg / mean_weapon_dmg`
  ≤ 0.50), with an automatic fail above 0.50 and 1.00 respectively.
- `RI-CMB04`'s weights are re-cut to make room — 22 points out of the seven existing checks,
  proportionally, **with no band moved and no pass condition weakened**. This item scored **86** in
  round 1 while the geometry it measures could not hit a stationary target at one metre. That is
  the gap M8 closes.

## R6.3 **Is the decomposition wrong? Yes — and in a specific, checkable way.**

`W1-09` declares five subsystem paths: `combat.hitbox.sweep`, `combat.hitbox.resolution`,
`combat.dodge.iframes`, `combat.stamina.costs`, `platform.determinism.harness`. Resolved through
the alias table, those are judged by `RI-CMB01`, `RI-CMB03`, `RI-CMB04`, `RI-CMB07`, `RI-AI02`,
`RI-CAM06`, `RI-MTH01`, `RI-MTH02`, `RI-MTH07`, `RI-PLT01`.

**It was scored against twelve items assembled from `ls corpus/10-combat/`.** The two sets
disagree in both directions at once:

| | |
|---|---|
| Scored but judges **none** of the piece's declared paths | `RI-CMB02`, `RI-CMB05`, `RI-CMB06`, `RI-CMB09`, `RI-CMB11`, `RI-AI01`, `RI-AI03` |
| Judges a declared path but was **never scored** | `RI-MTH01`, `RI-MTH02`, `RI-MTH07`, `RI-PLT01` |

`CORPUS-CONTRACT` §4 already says *"every critic is handed exactly the reference items whose
`judges:` list contains that path"*. The rule was in force and was not followed, and the cost is
not cosmetic:

- **`RI-AI01` judges `combat.enemy.perception / statemachine / movement / leash`.** It was scored
  **0 — "unmeasurable: there is no enemy AI in this build"** — into the mean of a piece that was
  never going to ship one, three rounds running.
- **`RI-PLT01`** — the item that would catch a frame-perfect slideshow — judges a path `W1-09`
  *does* declare and has never been scored on it.
- **`combat.feedback.hitstop`** is judged by `RI-WPN05` + `RI-CAM06` + `RI-AUD01`, is on neither
  `W1-09`'s path list nor its item list, and is implemented by `W1-09`'s resolver. `W1-10` round 2
  found the hitstop tables **INERT**. Two pieces, one hole, no owner — which is `RI-MTH07` "How we
  lose" clause 2 word for word: *"a cross-piece coupling debt with no owner is how both pieces pass
  and the game does nothing."*

**Amended into `CORPUS-CONTRACT` §4, in two halves, because shipping only the first would be the
relaxation this is not:**

1. **A piece is scored against the items that judge the paths it declares.** An item judging a
   path the piece does not own is not averaged into its mean — it becomes a **cross-piece coupling
   debt owned by the seam**, recorded at its measured value against the piece that does own it.
2. **A piece's declared path set must cover what it ships.** `W1-09`'s five paths do not mention
   attacks, poise, lock-on, latency, exhaustion or hitstop, all of which it builds. A piece that
   ships a subsystem it did not declare has silently escaped the item that judges it; the
   declaration is checked against the piece's outputs at verdict time and a mismatch is a
   `method_deviation`.

**Net effect on `W1-09`: it stops being charged for a piece nobody built, and starts being charged
for hitstop, latency, wall-clock delivery and harness coupling, which it was ducking.**

## R6.4 The arithmetic that made the piece unpassable

Gate 7.0 over 12 items needs a total of **84**. Two contributions were fixed by the corpus rather
than the build:

- `RI-AI01` = **0** (no enemy AI exists; `SCORING` §1.1: unmeasurable ⇒ 0, fail-closed)
- `RI-CMB07` ≤ **2**, because its maximum attainable native was 30/100 (R2.3) against an anchor
  row that puts native 70 at ladder 4

**The remaining ten items therefore had to average 8.2.** `SCORING` §1.1 requires a *passed blind
comparison* for every score of 8. `SCORING` §4's anti-inflation audit fires when the share of
scores ≥ 8 exceeds **15%** of a wave. **The only configuration in which `W1-09` could clear its
gate is one the corpus instructs the project to disbelieve on sight.** A bar whose sole passing
route trips the project's own inflation alarm is not a bar; it is a wall with a door painted on it.

That, and not builder incompetence, is why three dispatches produced 4, 4, 4.

## R6.5 A note on the escalation trigger itself

`EFFORT-POLICY` trigger 1 is *"two consecutive critic rounds with no score improvement"*. Round 1
scored **9** items (mean 36/9 = 4.0); rounds 2 and 3 scored **12**, adding `RI-AI01` at a
structural 0 and two AI items that cannot exceed a dependency ceiling. **The denominator changed
between the rounds the trigger compares**, and each round had a different, visibly harsher critic
— round 1 gave `RI-CMB04` an **86** for geometry that could not reach a stationary target at one
metre.

The trigger fired on a number that was not comparable across the rounds it compared. It happened
to fire on a piece that genuinely needed this critique, so the outcome was right; the reasoning was
not. **Recommend: the trigger requires a constant item set, or it compares per-item deltas rather
than the mean.** A flat mean across a changing denominator is not evidence of a stuck builder.

---

# R7 — Would these bars pass a game that is frame-perfect and feels like a slideshow?

**Yes, and it would score 10.**

Every one of `RI-CMB07` §D's 29 statistics is a ratio of simulation frames to simulation frames or
a count per fight. There is exactly one wall-clock row — row 1, fight duration, banded 70–220 s —
and it is computed from the simulation frame count divided by the nominal 60. **A build delivering
six frames per second produces byte-identical statistics.** The same is true of every frame count
in `RI-CMB01`–`RI-CMB06`, of `RI-CMB05`'s stagger lengths and of `RI-CMB02`'s entire census.

`RI-CMB11` is the item that noticed, and it handles it with unusual honesty: it takes L2 (dispatch,
harness-measurable) and **assigns L1 and L4 to `RI-JRN03` and `RI-PLT01`** *"so that nobody assumes
the other pair measured them."* That is good item hygiene and it left an unowned obligation: at the
*piece* level nobody has been holding the other pair, and neither `RI-PLT01` nor `RI-JRN03` has
appeared on any combat verdict.

**Filed:** `RI-CMB12` §C makes the wall clock a **gate** on any combat verdict — cite
`RI-PLT01`'s measured p50/p99 sim-step delivery for the same build, cite `RI-CMB11`'s `L2 == 0`,
or record `blocked_on_hardware` with a wave. `SCORING` §0's third honest exception (SwiftShader)
is an admissible reason and an indefinite one is an excuse; the debt escalates like any other.

**And "does anything measure what a Souls player means by *it feels good to hit things*?"** In the
corpus: yes — `RI-WPN05`, `RI-CAM06`, `RI-AUD01`. On the combat piece: **no, not once, in eleven
verdicts.** `RI-CMB12` M5 closes it by citation rather than duplication.

---

# The single biggest weakness

**Every quality instrument in this area is blocked on something that does not exist, and the two
that are not are pointed at the wrong thing.**

- `RI-CMB07` M1 — blocked on an artifact the corpus invalidated three waves ago and never rebuilt.
- `RI-CMB07` M2 — blocked on a piece nobody has built.
- `RI-CMB07`'s blind pair — unbuildable, and was built anyway, out of the bar's own numbers.
- `RI-AI01` — blocked on the same missing piece, and averaged into the score regardless.
- `RI-CMB03` M7 — blocked on the same missing artifact.
- What *was* runnable measured the builder's bot (`RI-CMB07` M2's rows) and the builder's declared
  values (`RI-CMB04`, until M8).

So `W1-09` was judged, three times, almost entirely on whether its frame tables were arithmetically
correct — which they largely are — while the fight itself was danger-free, then solvable by
standing still, then killing the player with a torso. **The bars were not wrong about the numbers.
They were pointed away from the game.** That is the same sentence my predecessor wrote about the
weapons area, and finding it twice in two areas is the finding: *this corpus systematically
verifies the artifact and not the artifact's effect.*

---

# What was changed, and where

| Change | File | Referral |
|---|---|---|
| §C chain multipliers become per-class with a ±0.20 budget; only tempo overridable | `RI-CMB02` §C | R1 |
| §E `recovery/startup ≥ 1.40` binds every chain link, not only the root | `RI-CMB02` §E | R1 |
| **M4b** — per-class chain tempo census, ≥6 of 14 classes must deviate | `RI-CMB02` M4b | R1 |
| Automatic fail: fewer than 6 of 14 classes deviating | `RI-CMB02` Scoring | R1 |
| Amendment marked **GRANTED and APPLIED**, with the ruling recorded in the filing | `AMENDMENT-W1-10-BAR-01` | R1 |
| **§0.1** — M1's 30 points are `corpus_debt`; renormalise, report raw and runnable, file against the corpus | `RI-CMB07` §0.1 | R2 |
| **§F** — `ES-PILOT/1`, `ES-MASHER/1`, `ES-TURTLE/1`, corpus-owned, no tunable parameters | `RI-CMB07` §F | R2 |
| **M2 falsification triple**; pilot and enemy-script diffs as deliverables | `RI-CMB07` M2 | R2 |
| **M2 split** into `M2-CTRL` (25, runnable) and `M2-LIVE` (15, seam debt) | `RI-CMB07` M2 / Scoring | R2 |
| **M2b** — ≥3 archetypes, cannot pass at one | `RI-CMB07` M2b | R2 |
| **§D.1** — banded set closed at 26 rows, enumerated; which median M2 means | `RI-CMB07` §D.1 | R2 |
| Row 28's automatic fail **relocated** to `ES-MASHER/1`; ordinary row under the pilot | `RI-CMB07` Scoring | R2 |
| **M6b `M-STAM`** — the margin gate, `0 < stamina < cost`, both sides; M7 marked `corpus_debt`; weights re-cut | `RI-CMB03` | R2 |
| **§D.2** — required `via` field, rows 30–32, attribution hard fails | `RI-CMB07` §A/§D.2 | R3, R6 |
| Blind pair **VOID** if synthesised; `not_possible` until the exemplar exists; `p90_iframe_to_hitbox ≤ 40 f@60` gate | `RI-CMB07` Scoring | R5 |
| `CONSUMPTION` block written into eight combat items; full statement with wave-1 evidence | `RI-CMB01`–`07`, `09`, `11` | R4 |
| **M9** — substep ablation as a scored check, failing on an empty change set | `RI-CMB04` M9 | R4 |
| **M8** — S26 enforcement: measured reach, contiguity hard fail, two-volume ablation, attribution, one body radius | `RI-CMB04` M8 | R6 |
| Weights re-cut for M8/M9 (22 points, proportional, no band moved) | `RI-CMB04` Scoring | R6 |
| Three new automatic fails: interior gap, body damage ≥ weapon damage, corridor at zero root translation | `RI-CMB04` Scoring | R6 |
| **S26 amended**: the corridor declares its own motion value and poise damage; enforcement named | `ARBITRATION` S26 | R6 |
| **§4 amended**: item set by `judges:` never by directory; declared paths must cover what the piece ships | `CORPUS-CONTRACT` §4 | R6 |
| **New item: the exchange — reactability, decision divergence, feel citation, wall-clock gate** | `RI-CMB12` | **R3, R7** |
| `combat.exchange.reactability`, `combat.exchange.divergence` registered | `subsystems.json`, `INDEX.md` | R3 |

**Thresholds lowered: none.** Every re-cut of weights takes points *out of* existing checks to pay
for new ones; every renormalisation removes weight from both numerator and denominator and leaves
the bands untouched; the one denominator correction (24 → 26 → 29) holds the original 0.833 pass
fraction and is very slightly stricter than the rule it replaces.

---

# Conditions for SATISFIED

This area is **not cleared by these edits.** Four of them are the kind whose correctness cannot be
established by argument, and my predecessor's standard applies: they must be **run once**.

1. **The `RI-CMB07` exemplar is regenerated** — `META` carrying no `INVALIDATED` block, constants
   matching `RI-CMB01` §B and `RI-CMB02` §A/§B as rebased, §D's statistics recomputed. §0.1's
   renormalisation and `RI-CMB03` M7's debt expire by their own condition on that day. **This is
   the corpus's debt and it is now three waves old.**
2. **The falsification triple is run once**, with `ES-PILOT/1`, `ES-MASHER/1` and `ES-TURTLE/1`
   implemented from §F, both degenerate policies losing, and the pilot and enemy-script diffs
   published. If a degenerate policy lands in band, the finding is far larger than `W1-09`.
3. **`RI-CMB04` M8 is run on every attack**, with the two-volume ablation and the attribution
   table, and **M9 reports a non-empty change set**.
4. **`RI-CMB12` M1 and M2 are run once.** This needs the two harness surfaces the item names —
   fork/restore and the tracked-joint dump. If `DIV` comes back below 0.02 on a build that passes
   every frame check, that is the most important number this project has produced.
5. **`W1-09`'s declared path set is corrected and its item set rebuilt from `judges:`**, with
   `RI-AI01`/`RI-AI03` moved to the `W1-09`↔`W1-12` seam ledger at their measured values, and
   `RI-WPN05`, `RI-PLT01`, `RI-MTH07` added.
6. **A combat verdict cites `RI-WPN05`'s `ILS` and the hitstop consumption result.** Eleven exist
   without one.
7. **`RI-CMB02` M4b reports ≥ 6 of 14 melee classes deviating** from the default chain tempo.

Until then this critic's position is **NOT SATISFIED**, and the honest summary for the
orchestrator is:

> **Do not dispatch `W1-09` round 4 against the old bars.** It cannot pass them, and it does not
> deserve to pass the new ones yet. Dispatch it against `RI-CMB04` M8/M9 and the `RI-CMB07` §F
> triple, and dispatch the exemplar regeneration as its own piece with its own owner, because it
> is not a builder's job and three builders have now been charged for it.

---

# Provenance

`provenance: constructed`, confidence **high** on every finding derived by reading the corpus, and
**measured** on every figure quoted from a wave-1 verdict.

- The class-uniformity of `RI-CMB02` §C, the absence of `RI-MTH07`/CONSUMPTION from all eighteen
  `corpus/10-combat/` items, the absence of any S26 method, the `INVALIDATED` blocks in all four
  exemplar artifacts, `RI-CMB07`'s 15/30/40/10/5 weight split, and the `judges:`-vs-declared-paths
  mismatch are all **direct reads of files in this repository**, reproducible by `grep` and by
  `node tools/corpus-index.mjs`.
- Every measurement quoted about the build — 96 damage via torso and via blade, the 1.20–1.25 m
  and 1.15–1.30 m interior gaps, `substeps 4 → 1` byte-identical, `separation` radii → 0
  byte-identical, `p90` 58–96 f, 803–1014 invulnerable frames against 360–443 active,
  `eatRate`/`wobble`/`staminaFloor`, row 28's `0 1 0 3 0`, 21/24 → 18/24 — is **quoted from
  `W1-09.md`, `W1-09-r2.md` and `W1-09-r3.md`** and their artifacts. **This critic did not re-run
  the build**; it judges standards, not code, and every build figure here is attributed to the
  critic who measured it.
- The arithmetic in R6.4 (mean 8.2 required over ten items) is computed here from `SCORING` §1.1,
  §4 and the three verdicts' own item tables, and is reproducible by hand.
- The thresholds introduced in `RI-CMB12` — 12°, 0.92 IoU, `lie ≤ 8 f`, `DIV ≥ 0.06`,
  `DIV_dominant ≤ 0.40`, `DIV_dead ≤ 0.15`, `DIV_identity ≤ 0.45` — are **conventions defined by
  that item**, in the same class as `RI-MTH07`'s `[0.95, 1.05]` coupling band, and are declared as
  such in its Provenance note. The 250 ms reaction budget is `canonical-recall`, confidence
  medium; the 4-frame machine share is read from `RI-CMB11` §1 and moves if that table moves.
