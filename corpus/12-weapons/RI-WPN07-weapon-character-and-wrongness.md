---
id: RI-WPN07
title: Weapon character — the situations a weapon is wrong for, and the reversal that proves it
kind: number
side: souls
judges: [weapon.identity.character, weapon.class.differentiation, weapon.identity.withinclass, combat.weapon.identity]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

`RI-WPN02` states the thing this project is actually trying to build, in its own opening
paragraph:

> *"A player who has spent an hour with a straight sword and then equips a great hammer should
> be wrong-footed for the next five minutes: the openings they had learned are gone, the
> spacing they had internalised is wrong, and **the enemies that were easy are now hard while
> the enemies that were hard are now easy.**"*

**No method in `corpus/12-weapons/` measures that sentence.** Six items measure whether weapons
are *different* — eleven fingerprint dimensions, an animation reuse index, a contextual fidelity
score, a two-hand divergence, an impact legibility score, a within-class subtlety band — and
every one of them is a measure of dispersion. Dispersion is not character. A roster of
eighty-seven statistically distinct movesets in which every weapon is roughly equally good
against every enemy passes all six items outright and has no weapons in it, only skins. The
`RI-WPN02` M6 wrong-footing probe comes closest and it measures the **variance** of outcomes
across classes, which a roster of uniformly-good weapons with different swing speeds also
produces.

What a Souls player means by a weapon's identity is not "it is measurably unlike the others". It
is that **the weapon teaches you a spacing, a rhythm, and a set of situations in which it is the
wrong tool**, and that picking it up is therefore a decision with a cost. A great hammer is
wrong against a fast duelist. A whip is wrong against anything with poise. A spear is wrong in a
corridor full of swarm enemies. That wrongness is what makes the *right* situations feel earned,
and it is the property that survives to hour forty.

"Good" means: for every class, there is at least one enemy archetype it is measurably **among
the worst** answers to, and at least one it is measurably **among the best** answers to; no two
classes rank the archetypes in the same order; and a player who swaps weapons mid-region
experiences a genuine **reversal** — encounters that were easy becoming hard and vice versa —
rather than a uniform scaling of difficulty.

This item owns **character**. `RI-WPN02` owns class separation, `RI-WPN03` owns within-class
subtlety, `RI-WPN04` owns the contextual slots, `RI-WPN05` owns impact, `RI-WPN06` owns stance,
`RI-AI05` owns the archetypes and `RI-CMB03` owns the stamina economy that prices every trade
here. Where any of them disagrees with this item on a value, they win and this item is amended.

## The reference artifact

### A. `ES-CHARACTER/1` — the class × archetype advantage matrix

The instrument is a 14 × 10 matrix `A[class][archetype]`: **how well this class answers this
enemy**, measured, never declared. Ten archetypes are `RI-AI05`'s A1 INFANTRY, A2 TURTLE, A3
DUELIST, A4 POISE_MONSTER, A5 RANGED, A6 AMBUSHER, A7 SWARM, A8 CASTER, A9 ELITE, A10 GANK_DUO.
BOW is scored but excluded from the reversal requirements — a ranged class is structurally
advantaged against half the roster and structurally helpless against the other half, which is
its character and needs no test.

The cell value is a single normalised **encounter cost**, low is good:

```
A[c][a] = median over 20 seeded runs of:
            ( player_hp_lost / player_max_hp )
          + ( stamina_bottom_outs / 10 )
          + ( elapsed_f / 3600 )            # time-to-kill, in units of one minute at 60 Hz
          , with the same scripted competent-play policy for every class
```

The policy is the load-bearing part and is fixed in `corpus/80-methods/policy-competent.json`:
a state-machine player that spaces to just outside the class's own measured `threat_m`
(`RI-WPN02` §B), attacks into the enemy's recovery, rolls on the enemy's telegraph, and never
uses a slot the class does not have. **The policy adapts to the weapon's numbers and not to the
weapon's identity** — that is what makes the matrix a measurement of the weapon rather than of
the script.

### B. What the matrix must look like

Rank every class within each archetype column (1 = best answer, 14 = worst).

| Symbol | Definition | Requirement |
|---|---|---|
| `BEST(c)` | archetypes where class `c` ranks in the top 3 | **≥ 1** for every melee class |
| `WORST(c)` | archetypes where class `c` ranks in the bottom 3 | **≥ 1** for every melee class |
| `SPAN(c)` | `max rank − min rank` across the ten archetypes | **≥ 6** for every melee class |
| `ρ(c1,c2)` | Spearman rank correlation between two classes' archetype orderings | **≤ 0.80** for every pair; **≤ 0.60** for the median pair |
| `DOM` | classes that are never in the bottom 3 of any column | **0**. A weapon with no bad matchup is not a weapon |
| `DUD` | classes that are never in the top 3 of any column | **0**. A weapon with no good matchup is a trap, not a choice |

`SPAN ≥ 6` is the numeric statement of "wrong-footed for five minutes". A class that ranks
between 5th and 8th against everything is a weapon with no opinion: it never rewards a read and
never punishes a bad choice, and a player carrying it learns nothing about the game.

`ρ ≤ 0.80` is the clause that catches the failure this item exists for. Fourteen classes can all
be measurably distinct on eleven dimensions and still rank the ten archetypes in the same order
— that is precisely "a big weapon is good, a small weapon is bad, and the numbers in between are
decoration". Two classes with `ρ = 0.95` are the same weapon at two sizes, whatever `D_min` said.

### C. The headline measurable — the Role Reversal Score

```
For each unordered pair of melee classes (c1, c2), 91 pairs:
    reversed(c1,c2) = 1 if there exist archetypes a, b such that
                        A[c1][a] < A[c2][a]      # c1 strictly better at a
                    and A[c1][b] > A[c2][b]      # c2 strictly better at b
                    and both gaps exceed 0.15 of the matrix's own interquartile range
                      (so a reversal is a difference a player would feel, not a rounding)
RVS = reversed pairs / 91
```

| Threshold | Value | Meaning |
|---|---|---|
| **`RVS ≥ 0.70`** | **PASS** | For seven pairs in ten, which weapon is better *depends on what you are fighting*. This is a roster of choices |
| `0.40 ≤ RVS < 0.70` | Below bar | A partial ordering has formed: some weapons are simply better than others |
| **`RVS < 0.40`** | **HARD FAIL** | The roster is a **power ladder**. Weapons differ; they do not disagree. Every weapon-identity number in `RI-WPN02`–`RI-WPN06` can pass at full marks while this fires, and when it does, the eighty-seven movesets are cosmetics on a single difficulty slider |

Supporting requirement, checked separately because `RVS` can be carried by extremes: the
**median** pair's reversal gap must exceed 0.25 of the interquartile range. A roster where only
the dagger and the ultra greatsword genuinely disagree, and the twelve classes between them are
a ramp, passes `RVS` on the pairs involving those two and fails here.

### D. Within-class character

The same instrument, run over one class's weapons rather than over the classes, using the
`RI-WPN03` §A census. Subtlety means the reversal is smaller, not absent.

| Symbol | Requirement |
|---|---|
| `RVS_within(k)` | **≥ 0.30** for every class of ≥5 weapons — at least three same-class pairs in ten must disagree about some archetype |
| `SPAN_within(w)` | **≥ 2** ranks for every weapon, within its class's own 10-column ranking |

This is the numeric form of `RI-WPN03` §E's own worked example: *"`r1.3` is a rising cut rather
than horizontal: catches a rolling enemy the baseline whiffs"*. That claim is a claim about an
archetype ranking, and until now nothing in the corpus checked whether it was true.

## Comparison method

Script: **`corpus/80-methods/m-wpn07-character.mjs`**

**M0 — CONSUMPTION gate (ARBITRATION §3).** `setLoadout({weapon: id})` for every weapon in the
roster; record `equipped_ok / 87`. If the runtime cannot equip a class, that class's row is
`unmeasurable ⇒ 0` and the item cannot pass. Nothing in this item is computable from declared
data, by design: it is the one item in the area that a disconnected moveset layer cannot fake.

**M1 — The advantage matrix.** For each melee class baseline at +0 on the `wave-standard-build`
fixture, against each of the ten `RI-AI05` archetype dummies at their region-entry statlines,
run the §A competent-play policy for 20 seeds:
```js
await H.setSeed(seedN); await H.loadState('wpn-arena-' + archetype);
await H.setLoadout({weapon: classBaseline[c]});
H.runPolicy('competent', {maxFrames: 3600});
```
- Emit one trace per (class × archetype × seed) — 2 800 traces. **Sampling is permitted under
  `WEAPON-CRITIC` §3.2's stratification rule; the sample must include every class, and the
  seed count may drop to 5 before the class count drops to 13.**
- Build `A`, the rank matrix, `BEST`, `WORST`, `SPAN`, the 91-pair `ρ` matrix, `DOM` and `DUD`.
- **FAIL** any class violating §B. **HARD FAIL** on `DOM > 0` or `DUD > 0`.
- **The rank matrix is a mandatory verdict artifact**, printed as a 14 × 10 grid. It is the one
  page of this area a designer can read and immediately say "that is wrong".

**M2 — `RVS`.** Compute per §C, report the reversal map and the identity of the pairs that do
*not* reverse. Apply the thresholds; **HARD FAIL** on `RVS < 0.40`.

**M3 — Within-class.** Repeat M1 for every weapon of three classes chosen adversarially — the
class with the lowest `CLIPS(k)/N(k)`, the class with the lowest mean `UNQ`, and the class with
the fewest weapons. Apply §D.
- **FAIL** if any of the three is below `RVS_within ≥ 0.30`.
- Choosing the three healthiest classes here is the softness failure of this item and
  `CRITIC-DOCTRINE` §2.4 already bans it.

**M4 — The wrong-weapon blind test.** Take one archetype and the two classes the matrix ranks
1st and 14th against it. Record the same scripted encounter twice, once with each, **through the
runtime a player uses**, and hand the critic the two recordings with weapon names, clip names,
class codes and every declared column stripped — per-frame motion, target state and the input
stream only.
- The critic states, **before the reveal**, which recording is the fight going badly, and names
  the reason in one sentence.
- **PASS** only if the pick is correct *and* the reason names a mechanism (reach, recovery,
  arc, poise trade, stamina), not an outcome ("it took longer").
- **FAIL** if the two recordings are indistinguishable. That result means the matrix's own
  extremes are invisible in play, and it voids `RVS` regardless of what M2 computed.

**M5 — The policy-sensitivity control.** Re-run M1 for three classes under a deliberately
*wrong* policy (space to half `threat_m`, attack on the enemy's startup).
- **PASS** if every class's cost rises and the *ranking* is substantially preserved
  (Spearman ≥ 0.7 against M1's ranks).
- **FAIL** if the ranking inverts — that would mean the matrix is measuring the script rather
  than the weapon, and every number in this item is void.
- This control is not optional and it is what makes the item honest: an instrument that has
  never been shown to survive a change in the operator is an opinion with a decimal point.

**M6 — Determinism.** M1 at five seeds per cell already; footers must match on re-run
(`HARNESS.md` §8 D5).

### Harness extensions this method requires

1. `H.runPolicy(name, opts)` — a scripted play policy driven from the harness rather than from
   a fixed input list, so the same *behaviour* can be applied to fifteen different weapons. This
   is the substantial ask in this item and nothing else in `12-weapons` needs it.
2. Scenarios `wpn-arena-<archetype>` for the ten `RI-AI05` archetypes, each a flat arena with one
   archetype dummy at its region-entry statline.
3. `getPlayerStats().stamina_bottom_outs` — a counter, or the raw stamina trace to derive it.
4. `getPlayerStats().equipped` and `setLoadout({weapon})` accepting every roster id (shared
   request; it is `RI-WPN02`'s and the CONSUMPTION check's too).

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 advantage matrix | 25 | Every class `BEST ≥ 1`, `WORST ≥ 1`, `SPAN ≥ 6`; `DOM = DUD = 0` |
| M2 `RVS` | 25 | `RVS ≥ 0.70`; median reversal gap ≥ 0.25 IQR |
| M1 `ρ` matrix | 15 | No pair above 0.80; median pair ≤ 0.60 |
| M3 within-class character | 15 | All three adversarially-chosen classes at `RVS_within ≥ 0.30` |
| M4 wrong-weapon blind | 12 | Correct pick, mechanism named |
| M5 policy-sensitivity control | 8 | Ranking preserved at Spearman ≥ 0.7 under a wrong policy |

Max 100.

| Native | Verdict band |
|---|---|
| ≥ 85 | Meets the bar |
| 60–84 | Below bar — named remedy required |
| < 60 | Loses outright |

**Native-to-ladder mapping (SCORING.md §1.2 / BAR-CRITIQUE-01 W7):**

| Ladder | Native score |
|---|---|
| 4 | 60 |
| 6 | 74 |
| 8 | 90 |

**Hard fails regardless of score:**
- `RVS < 0.40` — the roster is a power ladder, not a set of choices.
- Any class that is never in the bottom 3 against any archetype (`DOM > 0`) — a weapon with no
  bad matchup.
- Any class that is never in the top 3 against any archetype (`DUD > 0`) — a weapon with no
  reason to be picked up.
- M5 failing: the ranking inverts under a different play policy, so the matrix measures the
  script.
- M4 failing: the best and worst answers to one archetype are indistinguishable in play.
- Any cell computed from declared data rather than from a trace (ARBITRATION §3 CONSUMPTION).
- Any archetype whose answer depends on the player's level (ARBITRATION S9 / AR-1).

**Blind pair:** M4, above. It is deliberately the item's blind test rather than an extra one:
this is the only measure in the area whose blind form asks about *character* rather than about
difference, and the whole item exists because the area's other blind tests can be passed by
reading a spreadsheet with its header removed.

## How we lose

1. **Every weapon is fine at everything.** The most likely outcome, and the hardest to see. The
   team tunes each class until it "feels good" against the training dummy, which is A1 INFANTRY,
   and never checks A2 or A7. `SPAN` collapses to 2–3 for every class, `RVS` lands near 0.2, and
   every other number in the area still passes at full marks.
2. **The matrix is computed from motion values.** Someone builds `A` from declared damage,
   poise damage and reach instead of from play. It will correlate beautifully with weight, will
   look like a real matrix, and will be a restatement of the stat block — the exact thing
   `WEAPON-CRITIC` §1 corollary 1 forbids. M0 and the CONSUMPTION hard fail exist for this.
3. **The policy is tuned per weapon.** The script is adjusted until each class performs well,
   because a class doing badly looks like a bug. The matrix then measures the tuner's patience.
   M5's control is the only defence and it will be the first check dropped for time.
4. **Whip and fist are simply bad.** The two classes with the fewest weapons and the strangest
   propositions become `DUD`s: never in the top 3 against anything. The temptation will be to
   buff their damage, which changes nothing here — a `DUD` is fixed by giving the class a
   *situation*, not a number. WHP's 3.60 m against A5 RANGED and A10 GANK_DUO is the obvious
   one; FST's 5-chain against a staggered A4 is the other.
5. **Ultra greatsword is a `DOM`.** Highest poise damage, hyperarmour, largest lunge — it will
   be in the top 3 against everything unless A3 DUELIST and A7 SWARM genuinely punish it, which
   requires `RI-AI05`'s duelist to actually whiff-punish. If the archetypes are thin, this item
   measures their thinness and correctly reports it as our failure, not theirs.
6. **Reversal faked by time-to-kill.** The cost function's third term is elapsed frames, and a
   slow weapon will lose on it everywhere. If `RVS` is being carried entirely by that term, the
   matrix is a DPS chart. Report the three terms separately, always: a reversal that appears in
   `hp_lost` is a real one, and a reversal that appears only in `elapsed_f` is not.
7. **Ten archetypes is not ten situations.** Terrain, numbers, verticality and corridor width
   change which weapon is right at least as much as the enemy does, and none of them is in this
   matrix. That is a known limit of this item, recorded here rather than hidden: a second
   version should add a terrain axis once `RI-WLD07`'s dungeon geometry is real.
8. **The item is run once and never again.** Character drifts with every balance pass, and this
   is the most expensive measurement in the area. Expect it to be run in the wave it lands and
   skipped afterwards; expect the skip to be justified by the six cheaper items all passing.

## Provenance note

`provenance: constructed`, confidence **medium** — deliberately lower than this area's other
items. The advantage matrix, the cost function and its three terms, the `BEST`/`WORST`/`SPAN`/
`ρ`/`DOM`/`DUD` requirements, `RVS` and every threshold in §B–§D are **defined for this
project**. No FromSoftware title publishes a matchup matrix, and no community source publishes
one that is not a tier list. Confidence is medium rather than high for one honest reason: the
`RVS ≥ 0.70` bar is set from the structure of the argument — seven pairs in ten disagreeing is
what "a roster of choices" means — and **not** from a measurement of any shipped game. It should
be re-derived in wave 2 from this project's own first full run, and this note updated to
`derived` when it is. That is the same discipline this item's parent ruling applied to
`Rh_min < 0.03` when it rejected it: a threshold nobody has computed against a real roster is
not yet a threshold.

Grounding is `canonical-recall`, confidence **medium**, of the following observed properties of
Dark Souls 1/3 and Elden Ring: that weapon choice changes which encounters are hard rather than
uniformly changing difficulty; that thrusting weapons are the answer to narrow corridors and
shielded enemies while sweeping weapons are the answer to groups; that great hammers and ultra
greatswords trade poise for a losing matchup against fast duelists; and that players describe
weapons by what they are *for* rather than by their statistics. None of those recollections
carries a number and none should be cited as one.

**Why this item exists at all.** It was filed by `BAR-CRITIQUE-W1-10-R1` §R5 as hole **H3**. The
bar critic's finding was that `RI-WPN02`'s own opening paragraph promises a reversal, that the
promise is the user's actual concept of a weapon's identity, and that six items and twenty-eight
methods measured everything about a weapon except whether it is ever the wrong one. A corpus
that can prove eighty-seven weapons are different, and cannot prove any of them has an opinion,
has measured the easy half.

Cross-dependencies, and who wins on a conflict: `RI-AI05` wins on the archetype roster, their
statlines and their behaviour — if an archetype is thin, this item reports it and does not
compensate; `RI-CMB03` wins on the stamina economy the cost function's second term reads;
`RI-WPN02` wins on the class taxonomy, on `threat_m` and on every frame value the policy uses;
`RI-WPN03` wins on the weapon census M3 samples from; `RI-CMB01` wins on the roll and equip-load
behaviour the policy depends on; `HARNESS.md` wins on the button set and on whether `runPolicy`
can exist at all. If this item and any of those disagree, they win and this file is amended.
