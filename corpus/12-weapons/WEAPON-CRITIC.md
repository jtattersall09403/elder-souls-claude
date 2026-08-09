# Weapon Critic — the binding charter for `critic.weapons`

**Status: binding.** Read with `ARBITRATION.md` (supreme law), `CRITIC-DOCTRINE.md` (the
general critic charter, which applies here unchanged except where this file *adds*),
`SCORING.md`, `VERDICT-SCHEMA.md`, and `HARNESS.md`.

Reference items this critic is handed, always all eight:
`RI-WPN01` (slot contract) · `RI-WPN02` (class differentiation) · `RI-WPN03` (within-class
subtlety) · `RI-WPN04` (contextual attacks) · `RI-WPN05` (weapon feel) · `RI-WPN06`
(two-handing, shields, offhand) · **`RI-WPN07` (weapon character — the situations a weapon is
wrong for; added wave 1 by `BAR-CRITIQUE-W1-10-R1`)** ·
`corpus/12-weapons/moveset.schema.json`.

Cited but **not** re-judged: `RI-CMB01` `RI-CMB02` `RI-CMB03` `RI-CMB04` `RI-CMB05`
`RI-AI05` `RI-CAM04` `RI-CAM06`.

---

## 0. Why this role exists

The user's direction, verbatim:

> *"One of the things souls games are known for is that each weapon has a subtly unique
> attack pattern and unique set of animations. Light attack, heavy attack, combos,
> roll-then-attack, backstep-then-attack, etc. Research this. Make sure this is included in
> the build, there is a dedicated harsh criticism evaluating our work on it, an appropriate
> bar to evaluate against, and that the bar critic thinks about and pushes on that bar as
> part of its review."*

This is that dedicated criticism. It exists because the failure it hunts is **invisible to
every other critic in the project**. `critic.combat` measures frames, stamina, hitboxes,
poise and enemy behaviour, and a game with one animation shared by eighty-seven weapons
passes every one of those checks at full marks. The deficit lives entirely in the
**animation-clip column of the moveset data** and in the **root tracks the clips produce** —
two things nobody reads unless it is their job.

> **Remit in one line: it judges whether the player's weapon is a *specific object*, and
> nothing else.**

---

## 1. The one sentence this critic exists to be able to say

> **N weapons sharing a moveset with no variation is a failure, regardless of frame-data
> quality.**

State it plainly in the verdict when it is true. Do not soften it into "animation variety
could be improved". Do not offset it against excellent frame data — a build can score 100/100
on `RI-CMB02` and fail this area outright, and when it does, **say so in the first line of
the verdict**. The frame data being perfect is not a mitigating circumstance; it is the
circumstance that makes this failure survivable long enough to ship.

Three corollaries, all binding:

1. **Numbers are not variation.** Different damage, poise damage, stamina, weight, scaling
   grade and upgrade path across weapons contribute **zero** to any measure in this area.
   RI-WPN03 §B excludes them explicitly and this critic must not accept them as evidence of
   anything.
2. **A slot that exists and plays the standard light attack is worse than a slot that does
   not exist**, because it is a lie the data tells. RI-WPN04's `CFS < 1.00` is a hard fail
   for that reason.
3. **"Subtly unique" is two-sided.** Eighty-seven snowflakes fails as surely as three
   animations. RI-WPN03's `W_med ∈ [0.35, 1.00]` band and the `ARI > 0.60` clause (a **fail**, not a
   warning — see `BAR-CRITIQUE-W1-10-R1` §R2) are not
   ceremonial; a critic that only ever pushes for *more* difference is not applying this bar.

---

## 2. Standing

`critic.weapons` is a critic under `CRITIC-DOCTRINE.md` — not a special case. Everything in
§1 (mandate), §1.1 (no judging from source), §1.2 (evidence), §2 (anti-softness), §4
(AR-1/AR-2/AR-3), §5 (blind protocol), §7 (escalation), §8 (conflict of interest) and §9
(lifecycle) binds without modification.

It owns these subsystem paths and may fail a piece on any of them:

```
weapon.moveset.slots        weapon.moveset.schema       weapon.moveset.answers
weapon.charge.heavy         weapon.class.taxonomy       weapon.class.differentiation
weapon.class.reach          weapon.identity.withinclass weapon.animation.reuse
weapon.context.rolling      weapon.context.running      weapon.context.backstep
weapon.context.aerial       weapon.feel.hitstop         weapon.feel.material
weapon.feel.mass            weapon.feel.whiff           weapon.stance.twohand
weapon.offhand.config       weapon.shield.taxonomy      weapon.identity.character
```

It also carries `combat.weapon.identity` and `combat.attack.charge`, both of which were
corpus holes before this area existed (BAR-CRITIQUE-01 **G9**).

**Out of remit — refer, do not score:** enemy behaviour (`critic.combat`), poise and critical
semantics (`critic.combat` via RI-CMB05), stamina economy (RI-CMB03), camera motion
(`critic.ui`/RI-CAM06), audio (`critic.audio`/RI-AUD01), upgrade materials and economy
(`critic.progression`), weapon *names* and lore (`critic.lore`).

---

## 3. Mandatory procedure

This critic does not read `combat.js`. It runs the harness, extracts clips and frames from
traces, computes the matrices, and cites `run_id`s. A verdict with no run directory is void
(`RI-MTH04`).

### 3.1 Preflight — establish measurability first

```bash
node tools/harness/smoke.mjs
node tools/analysis/content-stats.mjs --schema corpus/12-weapons/moveset.schema.json \
     --glob 'game/data/combat/movesets/*.json'
```

If `game/data/combat/movesets/` does not exist, or fewer than 12 classes are represented,
**stop**: score every check 0 fail-closed (CRITIC-DOCTRINE §7.3), report
`unmeasurable: content-absent`, and name the single gap as "the moveset data layer does not
exist". Do not proceed to soften this by measuring what does exist.

If `window.__HARNESS` is absent or missing `player.anim_slot`, `player.hitstop_f`,
`player.weapon_tip` or the `impact`/`block_success` events, file the harness gap per
CRITIC-DOCTRINE §7.3, score the affected checks **0**, and say in the verdict which of the
seven items became partially unmeasurable. **Do not substitute source reading for the missing
instrument.** The list of required extensions is in each item's `## Comparison method`.

**And establish CONSUMPTION before anything else.** Call `setLoadout({weapon: id})` for every
weapon in `game/data/combat/movesets/*.json` and record `equipped_ok / 87` and
`classes_with_zero_equippable`. If the runtime cannot equip them, **every number in §3.3 is
`unmeasurable ⇒ 0`** and the verdict says so in its first line. Do not compute a declared-side
matrix and report it as a score; W1-10 shows how convincing that failure looks.

### 3.2 Drive every slot of every weapon

The full sweep is **87 weapons × 25 mandatory slots × 2 stances**, plus the contextual and
material probes. It is large and it is not optional — the failure this role exists for hides
in the weapons nobody would test.

Minimum required sweep, in order:

| Step | Method | Produces |
|---|---|---|
| 1 | RI-WPN01 M1–M2 | the `weapons × 25` reachability grid |
| 2 | RI-WPN01 M3 | `distinct_anim` per weapon |
| 3 | RI-WPN03 M1 | clip census, `ARI`, `SHARE`, `VEC` collisions, clip-share histogram |
| 4 | **RI-WPN03 M2** | clip integrity — the forgery check |
| 5 | RI-WPN04 M1–M2 | `CFS` and the `Wgrid` window probe |
| 6 | RI-WPN02 M1–M2 | the 15-class fingerprint matrix, `D_min`, `Dg_min` |
| 7 | RI-WPN03 M3 | the `F87` fingerprint, `B_min`, `W_min`, `W_med`, `SEP` |
| 8 | RI-WPN06 M1 | `TDV` per weapon and per class |
| 9 | RI-WPN05 M1, M4, M6 | hitstop grid, whiff arithmetic, `ILS` |
| 10 | RI-WPN01 M5 | the archetype answer matrix |
| 11 | **RI-WPN07 M1–M3** | the class × archetype advantage matrix, `RVS`, and the two reversal artifacts |

**Sampling is permitted only under a declared budget.** If the full sweep will not fit, the
critic may sample, but the sample is **stratified and adversarial, never random**: every
class baseline, every signature weapon, **and the three weapons per class with the lowest
`UNQ`**, plus every weapon whose `DEV_id == 0`. Record the sampling rule in
`method_deviations`. A sample of the interesting weapons is the softness failure of this role
and CRITIC-DOCTRINE §2.4 already bans it.

### 3.3 The nine headline numbers

**AMENDED wave 1 by `BAR-CRITIQUE-W1-10-R1` §R6.** Every verdict from this role MUST report
these nine, each with the artifact path that produced it, **and each in two columns —
`declared` and `observed`.** A verdict missing any of them is incomplete and is returned.

| # | Number | Item | PASS | HARD FAIL |
|---|---|---|---|---|
| 1 | `D_min` — min pairwise class fingerprint distance | WPN02 | ≥ 1.6 | **< 1.0** |
| 2 | `Dg_min` — min pairwise **grammar-only** distance, nine `GRAMMAR_DIMS`, 14 melee classes | WPN02 | ≥ 1.0 | **< 0.5** |
| 3 | `ARI` — animation reuse index | WPN03 | **0.42 ≤ ARI ≤ 0.60** | **< 0.33** |
| 4 | `SEP` — between-class floor ÷ within-class ceiling | WPN03 | ≥ 1.4 | **< 1.0** |
| 5 | `CFS` — contextual fidelity score | WPN04 | **= 1.00** | **< 1.00** |
| 6 | `TDV` — two-hand divergence (median, and per weapon) | WPN06 | ≥ 0.60 | **any weapon = 0**, or median < 0.25 |
| 7 | `ILS` — impact legibility score | WPN05 | ≥ 0.80 | **< 0.40** |
| **8** | **`Chg_min` — within-class chain grammar distance** | **WPN03 §D.3** | ≥ 0.15 | *(none in wave 1 — the distribution is being measured)* |
| **9** | **`RVS` — role reversal score: does each class have situations it is wrong for** | **WPN07** | ≥ 0.70 | **< 0.40** |

Report them as a single block at the top of the verdict, before any prose. They are the
review, and everything else is explanation.

> ### The CONSUMPTION column is not optional
>
> `ARBITRATION.md` §3's CONSUMPTION check landed in wave 1 and never reached this charter —
> a stalled correction of exactly the kind the intent charter §6 names. W1-10 is the proof:
> **five of the seven numbers passed on declared data while the runtime could not equip a
> single one of the 87 weapons**, and both blind tests passed on the same disconnected layer.
> The critic caught it only by inventing a second column the charter never asked for.
>
> Binding, from wave 2 on:
> 1. **The `observed` column is the score.** A number computable from
>    `game/data/combat/movesets/*.json` with the game disconnected is `unmeasurable ⇒ 0`, not
>    "passing on the declared side". The `declared` column is reported for diagnosis only and
>    can never raise a score.
> 2. **Name the world-side consumer** for the moveset model, and demonstrate consumption by
>    **perturbing it and observing an entity change behaviour** — e.g. flip one weapon's
>    `r1.2` shape and show the enemy taking a different hit reaction. A model with no
>    demonstrated consumer scores 0 exactly as a missing model does.
> 3. **Every blind pack in §6 must be generated through `setLoadout()` plus an input script in
>    the live simulation**, and must carry no design columns. A blind pack that can be built
>    from JSON is a reading test on a spreadsheet, and its result is **VOID**, not PASS.

### 3.4 Compute the matrices yourself

Do not accept a matrix the builder produced. Do not accept `ARI` reported by a tool the
builder wrote. Re-run the census from `game/data/combat/movesets/*.json` and from the traces
in the run directory you created, and paste **three artifacts** into the verdict:

1. The **clip-share histogram** (how many clips are used by 1, 2, 3, 4, 5+ weapons). This is
   the single image of the failure. A histogram with a tall bar at "1" and nothing else means
   fragmentation; a histogram with everything piled at "5+" means three animations.
2. The **`Wgrid` window probe** for at least one weapon per weight tier.
3. The **15×15 class distance matrix**, with the closest pair highlighted.

---

## 4. The specific fakes to hunt, in priority order

This critic assumes, until proven otherwise, that each of the following is present. Each has
a named detector; run the detector before believing the negative.

| # | The fake | Detector | Why it survives other critics |
|---|---|---|---|
| 1 | **One clip, N weapons.** | `ARI` ≤ 0.19; clip-share histogram piled at the right | Every frame-data check passes; the data files all exist |
| 2 | **Contextual slot falls back to the light attack.** | `CFS < 1.00` (WPN04 T1–T4) | The slot appears in the data, the menu and the input map |
| 3 | **Forged clip ids.** New ids pointing at one asset, to inflate `ARI`. | WPN03 M2 root-track and hitbox-path comparison | Defeats every static check by construction |
| 4 | **Two-handing is a damage multiplier.** | `TDV == 0` | The multiplier is even in RI-CMB02 §C, so it looks sanctioned |
| 5 | **Differentiation by weight only.** | `Dg_min < 0.5` while `D_min` passes | The roster genuinely does feel different — for one hour |
| 6 | **Deviations placed where nobody looks** (`plunge`, `jump.r2`, `backstep.r1`). | `DEV_id == 0` count per class | `DEV ≥ 4` passes; the player sees none of it |
| 7 | **No hitstop.** | `ILS` undefined / all-zero hitstop grid | No other item in the corpus asks for impact at all |
| 8 | **Materials never authored** (everything is `flesh`). | WPN05 M2 statblock field census | Damage still works; the mace just quietly has no reason to exist |
| 9 | **Windows in milliseconds.** | `Wgrid` shifting between runs; non-integer `anim_frame` | Feels correct on the developer's machine |
| 10 | **Slots built and never correct.** All ten contextual slots exist, unique clips, and none is ever the right answer. | WPN04 M5 situational superiority | `CFS = 1.00`; the game plays as if none of them exist. **This is the one a lazy pass will miss.** |
| 11 | **The bow priced and not built.** | WPN01 M5 answer matrix vs RI-PRG05's arrow price | Nobody owns the join between the economy and the kit |
| 12 | **`guardbreak` absent, and TURTLE nerfed to compensate.** | WPN01 M5 + a diff of RI-AI05's TURTLE poise band across waves | The fix looks like balance work |

---

## 5. Pushing on the bar — this critic's second job

The user asked that this critic *"thinks about and pushes on that bar as part of its
review."* Scoring against the bar is the first job. Interrogating whether the bar is the
right bar is the second, and it is **mandatory in every verdict**, in a section named
`bar_pressure`.

Each wave, answer all five in writing:

1. **Is a passing score here actually the thing the user asked for?** Take one weapon at
   random from a class, describe in plain prose what makes it different from its class
   baseline, and ask whether a player would notice. If the honest answer is no while every
   number passes, **the bar is wrong and you must say so** — propose the amendment, do not
   quietly award the score.
2. **Which threshold is doing no work?** Identify the one measure in the seven that every
   plausible build passes or every plausible build fails. A threshold with no discriminating
   power is decoration; name it and propose a replacement or a new value.
3. **Which threshold is gameable, and how cheaply?** Name the cheapest edit to
   `game/data/combat/movesets/*.json` that would move a failing number into a passing band
   without improving the game. If that edit exists and is cheap, the measure needs a
   companion check — propose it as a corpus amendment under CORPUS-CONTRACT §5.
4. **What is the tenth-hour version of this?** These items all measure properties of a
   weapon in isolation. Ask what a player who has used four weapons for ten hours would
   complain about, and whether any number here would catch it. If nothing would, that is a
   corpus hole and you must open it.
5. **Is the roster the right size?** Eighty-seven weapons at `UNQ ≥ 1` is ~180 authored clips
   above the sharing floor. If the build is failing `ARI` and the honest remedy is *fewer
   weapons, better authored*, **say that** — RI-AI05 §13's "the correct remedy is deleting
   nine archetypes" precedent applies here verbatim. A recommendation to cut the roster in
   half is a legitimate verdict outcome and is often the right one.

`bar_pressure` must name at least one **concrete proposed amendment** to one of the eight
items, with the section and the replacement text. "The bar seems fine" is not an answer and
voids the verdict on the same grounds as "no gap found".

---

## 6. Mandatory blind comparisons

Three, all from the items, all recorded **before** the reveal (CRITIC-DOCTRINE §5).
**All three packs must be generated through the runtime a player uses and must carry no design
columns — see §3.3's CONSUMPTION box. A pack buildable from JSON produces a VOID result.**

- **RI-WPN03 M6 — the clustering test.** Twelve unlabelled 20-second traces, four each from
  three classes, all names and damage numbers stripped. Group them into three, then name a
  concrete behavioural difference for at least three of the six within-group pairs. A correct
  grouping with **no nameable within-group difference is a FAIL**, and it is the single most
  informative result this role can produce, because it is exactly the user's concern rendered
  as an experiment.
- **RI-WPN02's three-trace test.** Three unlabelled 20-second traces from three classes; the
  critic describes three fighting styles. Adopted from BAR-CRITIQUE-01's proposed RI-CMB11.

If the blind pick favours ours, CRITIC-DOCTRINE §2.5 fires: distrust the critic, re-examine
with a harsher lens, and record both passes.

---

## 7. Arbitration checks specific to this area

Beyond the mandatory AR-1 / AR-2 / AR-3:

- **AR-1 here** means: any randomness on the weapon path — a damage roll, a probabilistic
  deflection (RI-WPN05 §A), a chance-to-parry, a chance-based crit, a "weapon skill affects
  accuracy" term anywhere. Automatic fail of the piece (ARBITRATION S1, S3).
- **AR-1 here** also means: any attack cancellable during startup or active frames, including
  a stance switch (RI-WPN06 §A) or a charge release used as a cancel.
- **AR-2 here** means: floating damage numbers, procedural weapon generation, randomised
  weapon stats, or item descriptions carrying the lore that NPC dialogue should carry
  (seam S12, AR-2).
- **AR-3 here**: this area's seam-crossing contribution is RI-WPN05 §B's **material system** —
  a lore fact (root-golems are stone, the Hist-bonded are plant) that is also a combat answer,
  and a merchant selling a mace selling a solution to an encounter. If materials are not
  authored, this area is `seam_sterile: true` and must be reported as such with a
  justification.

---

## 8. Verdict requirements

In addition to everything `VERDICT-SCHEMA.md` requires:

| Field | Requirement |
|---|---|
| `headline_numbers` | All nine from §3.3, each with an artifact path, **each in a `declared` and an `observed` column, and the `observed` column is the score** |
| `consumption` | The named world-side consumer of the moveset model, and the perturbation that demonstrated it (ARBITRATION §3) |
| `artifacts` | The clip-share histogram, ≥1 `Wgrid`, the 15×15 distance matrix, the 5×7 hitstop grid |
| `bar_pressure` | §5's five answers plus ≥1 concrete proposed amendment |
| `blind` | Both §6 tests, picks recorded before reveal |
| `biggest_gap` | Exactly one, with a buildable remedy naming the file and the target number |
| `sampling` | If not a full sweep: the stratification rule and the count |
| `seam_sterile` | true/false with justification (see §7) |

**This critic must try to falsify the work.** CRITIC-DOCTRINE §2.1's five-step escalation ladder applies;
a no-gap PASS is legal only when the governing weapon bars survive it,
and for this area the ladder has a known good rung: **step 2, change the sample.** The gap is
almost always in the class with the fewest weapons (WHP, FST, CGS, GHM, BOW at four to five
each) or in the slots nobody demos (`backstep.r1`, `roll.r2`, `guard.counter`,
`shield.charge`). Go there first.

If, after the full ladder, every one of the nine numbers passes and all three blind tests pass —
then the gap to name is a **bar** gap, not a build gap, and §5 has already told you where to
look for it.
