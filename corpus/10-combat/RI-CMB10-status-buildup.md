---
id: RI-CMB10
title: Status buildup — the five meters, the proc, and the handoff to the affliction economy
kind: number
side: split
judges: [combat.status.buildup]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

Seam **S11** splits poison down the middle: **Souls owns the in-fight buildup meter and the proc,
Morrowind owns the affliction economy** — the named disease, the in-world cause, the cure you buy
from a temple. This item is the Souls half. `RI-PRG09` is the Morrowind half. The seam between them
is one function call and it is specified in §5, because the failure mode this pair exists to prevent
is the two halves being built as two unrelated systems that happen to share the word "poison".

The Souls half is a specific mechanism and it is not a debuff. **A status is a hidden race between
two rates**: how fast an enemy stacks it on you and how fast it drains off. You can win that race by
retreating for three seconds, and that decision — *break off now and lose your punish, or take one
more swing and eat the proc* — is the entire design. A status that applies on hit is a debuff and
teaches nothing. A status whose meter you cannot see approaching is a random event. A status you can
outrun forever is decoration.

"Good" means: five meters, each with a **visible fill on the character before it is visible on the
HUD**, each with a decay you can actually beat by disengaging, each with a proc that is a
**discrete, loud, animated event** rather than a number ticking, each escalating in cost if you let
it happen twice in one fight, and each — where it makes sense — handing a **named, curable
affliction** to the world when the fight ends. And symmetric: the enemy has the same five meters, and
a bleed build must be able to proc a boss.

**No status is an instant death.** The province has exactly one instant death, it is the voriplasm,
and it is a hazard, not a status (`RI-WLD11` H8). DS3's Curse is not imported.

## The reference artifact

### 1. The five

| # | Status | Analogue | Proc effect | Duration @60 Hz | Where it comes from |
|---|---|---|---|---|---|
| 1 | **BLEED** | Bleed | **burst: 12% of max HP, immediately**, plus 40 f hitstun-immune stagger-resist loss | instant + 40 f | naga blades, chitin-hound claws, tusk-lurkers, any `slash` weapon with a bleed rating |
| 2 | **ROT** | Poison | **0.35% max HP/s for 60 s**, and it does not stop when you leave the fight | 3600 f | mudcrabs, marsh water, corpse-lily pollen, rusted Imperial steel |
| 3 | **VENOM** | Toxic | **1.10% max HP/s for 25 s**, plus stamina regen **×0.55** | 1500 f | naga envenomed spears only, and two named assassins |
| 4 | **CHILL** | Frostbite | **absorption −18%** and stamina regen **×0.60**, no direct damage | 1200 f | Padomaic surf, Salt Hills night, Valus Ridge, the salt-storm, two frost casters |
| 5 | **MIRE-LUNG** | *(ours)* | **max stamina −25%** until cured — the only status that survives a HEARTH rest | until cured | spore blooms, fever fog, the Deep Marshes' air |

Four of the five are Souls-shaped. **MIRE-LUNG is the seam made visible**: it is built up in a fight
like any other meter and it is *cured like a disease*, at a temple, with an item, for gold
(`RI-PRG09`). It is the one status a player carries out of the fight and into the world, and it
exists so the two halves of S11 are provably joined rather than merely adjacent.

**Deliberate absences.** No Curse (no status may kill outright). No Hollowing (our death economy is
`RI-PRG04`'s). No sleep, charm or paralysis as a *buildup* — paralysis exists as a spell effect with
an animated cast (`RI-MAG02`, S19) and a status meter would launder it past S1.

### 2. The buildup model, `ES-STATUS/1`

```
per status S, per entity:
    meter[S]        : float, 0 .. threshold[S]        # never negative, never above threshold
    threshold[S]    : base 100, x1.30 per proc already suffered this HEARTH cycle
    procs[S]        : int, reset on HEARTH rest (RI-PRG04)
    last_applied[S] : frame index

on a hit that carries buildup b for status S:
    meter[S] += b * (1 - resistance[S])            # resistance in [0, 0.95]; NEVER a dice roll (S1)
    last_applied[S] = frame
    if meter[S] >= threshold[S]:  PROC

decay, every frame, if frame - last_applied[S] > grace[S]:
    meter[S] = max(0, meter[S] - decay_rate[S] / 60)

PROC:
    meter[S]     := 0
    procs[S]     += 1
    apply effect from the table in section 1
    immunity     := 300 f (5.00 s) during which buildup is not accumulated at all
    emit event `status_proc`
    if the damage source declares an affliction id -> hand off (section 5)
```

| Status | Buildup per hit (typical) | `grace` | `decay_rate` /s | Time to full decay from 99 | Threshold ×/proc |
|---|---:|---:|---:|---:|---:|
| BLEED | 22–38 | **180 f (3.0 s)** | 30 | 3.3 s + 3.0 s grace | ×1.30 |
| ROT | 14–26 | 300 f (5.0 s) | 12 | 8.3 s + 5.0 s | ×1.30 |
| VENOM | 30–45 | 240 f (4.0 s) | 18 | 5.5 s + 4.0 s | ×1.40 |
| CHILL | 8–20 (also **4/s** while standing in a chill environment) | 240 f (4.0 s) | 20 | 5.0 s + 4.0 s | ×1.25 |
| MIRE-LUNG | 10–18 (also **6/s** in fever fog) | 600 f (10.0 s) | 4 | 24.8 s + 10.0 s | ×1.50 |

**The grace period is the design.** BLEED's 3 seconds is the length of one disengage: back off, roll
twice, and you have paid for the reset in tempo and stamina rather than in health. MIRE-LUNG's 10
seconds is deliberately un-outrunnable inside a fight — you leave the fever fog or you get it.

**Resistances** come from three places and are **summed then clamped to 0.95**, never rolled:

| Source | Contribution |
|---|---|
| Armour | each piece declares per-status resistance; a full set of chitin is 0.30 BLEED, 0.10 ROT |
| Attributes | Endurance → BLEED, Vigor → ROT/VENOM, Willpower → CHILL, at **+0.006 per point over 10** |
| Race (`RI-CHR02`) | Saxhleel / Naga: Poison **0.75** (applies to ROT and VENOM); Nord: CHILL **0.90**; Naga: CHILL **−0.25** (vulnerable, and a negative resistance is legal) |

A resistance of 0.95 means buildup accrues at 5%, **not** that you are immune. **No entity in the
game is immune to all five**, and a boss immune to more than two is a defect (M7).

### 3. Legibility — the meter is on the body first

| Requirement | Value |
|---|---|
| **Character tell** | every status renders on the mesh, proportional to `meter/threshold`: BLEED = spreading wet red on cloth and blade; ROT = grey-green bloom at the wound; VENOM = black veining; CHILL = rime advancing over armour; MIRE-LUNG = pale spore dust on the chest |
| First visible at | **`meter/threshold ≥ 0.25`** — a quarter of the way, so it is a warning and not a result |
| **HUD** | the bar appears only at `≥ 0.25` and only for statuses currently accruing (`RI-UIX01` owns the layout) |
| **Proc** | a discrete, non-repeating event: 12 f hitstop on the victim, a one-shot VFX burst, a one-shot sound, and a screen-edge pulse for the player. **Never** a number that starts ticking with no announcement |
| Enemy statuses | identical rendering rules. **The player must be able to see a boss's bleed meter filling from the mesh alone**, at 8 m, with the HUD off |

The 0.25 threshold on the body is the item's most important single number: it is what converts a
status from a random event into a decision.

### 4. Symmetry

| Rule | Value |
|---|---|
| Enemies carry all five meters | mandatory |
| Archetypes proccable by at least one status | **100%** — no enemy is immune to everything |
| Archetypes immune to ≥ 3 statuses | **0** allowed |
| Bosses proccable | **all 8** (`RI-AI06`), each by at least two of the five |
| Boss threshold multiplier | `×2.5` base, `×1.30` per proc — a bleed build beats a boss faster, and the *fourth* proc costs 2.5 × 1.30³ = 5.5× the first |
| Proc effect on enemies | BLEED 12% of *their* max HP; ROT/VENOM as %/s; CHILL costs them absorption and stamina regen exactly as it costs the player |

If a bleed build cannot measurably shorten a boss fight, the whole system is cosmetic on the offence
side, and half of `RI-CMP03`'s build-identity payoff for status-oriented builds evaporates.

### 5. The S11 handoff — where Souls stops and Morrowind starts

```
on PROC of status S on the PLAYER, by a source with `affliction_id` set:
    if disease_immune(player)  ->  no affliction        # Saxhleel and Naga, RI-CHR02
    else                       ->  RI-PRG09.contract(affliction_id)    # DETERMINISTIC. No roll (S1)
```

- The **in-fight** consequence is §1's proc effect, and it ends when its duration ends.
- The **out-of-fight** consequence is a **named affliction** with in-world symptoms, an in-world
  cause and a purchasable cure — `RI-PRG09`'s domain entirely. This item names no disease and prices
  no cure.
- **It is deterministic.** A proc from a diseased mudcrab always transmits swamp fever. S1 bans dice
  inside the fight and this is inside the fight; the *uncertainty* the player manages is whether the
  meter fills, not whether the coin lands.
- Not every source declares one. Naga steel makes you bleed and gives you nothing to cure.
- **The reverse direction does not exist.** An affliction you are already carrying does **not** alter
  a buildup rate. If it did, a player who skipped a cure would silently have a different combat game,
  which is exactly the kind of hidden state `RI-AI02`'s telegraph doctrine exists to forbid.

### 6. Data and harness

`game/data/combat/status.json` (schema `elder-souls/status@1`) carries §1 and §2 in full. Every
moveset entry gains `buildup: {status, value}`; every enemy statblock gains `status_resistance` and
optional `affliction_id`; every armour piece gains per-status resistance. Absent fields are
**fail-closed 0**.

Requested `HARNESS.md` §10 amendments: `player.status` and `enemies[].status` frame-record blocks
(`{bleed:{meter,threshold,procs}, rot:…, venom:…, chill:…, mire_lung:…}`), and `status_apply`,
`status_proc`, `status_decay_start`, `status_expire` added to the §5 event vocabulary. Without them
M2–M7 are **unmeasurable ⇒ 0**.

## Comparison method

**M1 — Data conformance (static).** Diff `game/data/combat/status.json` against §1/§2, and scan every
moveset for `buildup` entries.
- **FAIL** on any threshold, grace, decay or proc effect differing from §1/§2; if any status is
  missing; if a sixth exists that is not declared here; if any status declares `kind: "death"`.

**M2 — The buildup race (the item's core check).** Scenario `cmb-status-<S>`: an enemy scripted to
land a fixed-buildup hit every 90 frames, player passive.
- From the trace, fit accrual per hit and decay per second. **FAIL** if either differs from §2 by
  `> 5%`, or if decay begins earlier or later than `grace` by `> 2 frames`.
- Re-run with the player disengaging after each hit for `grace + 60 f`. **FAIL** if the meter does
  not return to 0 — the race must be winnable by retreating.
- **FAIL** if buildup ever accrues during the 300-frame post-proc immunity.

**M3 — The proc.** Force each of the five to 99, then land one more hit.
- **FAIL** if the meter does not reset to 0; if `procs` does not increment; if the next threshold is
  not `×` §2's multiplier; if the effect magnitude or duration differs from §1 by `> 2%`/`> 2 f`; if
  no `status_proc` event is emitted; or if the proc has no hitstop and no one-shot VFX.
- **FAIL** if any proc reduces HP to 0 by itself from full — no status kills outright.

**M4 — Determinism (S1).** Run M3 ten times at ten different seeds.
- **FAIL** if accrual, threshold, proc frame or affliction handoff differ **at all** between seeds. A
  status system with a proc chance is a to-hit roll wearing a lab coat.

**M5 — Resistance.** Sweep armour, attributes and race.
- **FAIL** if resistances are not additive-then-clamped; if any clamp exceeds 0.95; if a Saxhleel's
  ROT accrual is not `0.25 ×` a Nord's; if a negative resistance (Naga CHILL) does not increase
  accrual; or if any entity accrues nothing at all.

**M6 — Legibility (`blind_pair: yes`).** Capture 1280×720 frames, HUD off, of a character at meter
0.00 / 0.24 / 0.26 / 0.75 / just-procced, for each status, at 8 m.
- Present the 0.24 and 0.26 pair unlabeled: *"which of these two is about to bleed?"* **FAIL** if a
  fresh judge cannot tell.
- **FAIL** if any status is visible only on the HUD, or if the proc is not identifiable from a single
  frame.

**M7 — Symmetry and the boss check.** For all 8 bosses and every roster archetype, drive each of the
five meters with a scripted weapon.
- **FAIL** if any archetype is proccable by nothing; if any is immune to ≥ 3; if any boss is
  proccable by fewer than 2; or if a boss's threshold multiplier differs from `2.5 × 1.30^procs`.
- **FAIL** if a bleed-oriented build does not measurably shorten the median boss fight against a
  neutral build (`RI-CMP03`'s instrument, cited not duplicated).

**M8 — The S11 handoff.** Take a ROT proc from a source declaring `affliction_id: "swamp-fever"`.
- **FAIL** if `RI-PRG09`'s affliction is not contracted; if it is contracted probabilistically; if it
  is contracted by a Saxhleel; if the affliction is cleared by the proc effect expiring; or if
  carrying an affliction changes any buildup rate (the banned reverse direction).

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| M1 data conformance | 10 | all five, exact |
| **M2** the buildup race | **22** | accrual, decay, grace, immunity; winnable by disengaging |
| **M3** the proc | **18** | reset, escalation, effect, announcement; nothing kills outright |
| M4 determinism | 12 | identical across seeds (S1) |
| M5 resistance | 10 | additive, clamped, race-correct |
| **M6** legibility | **14** | visible on the body at 0.25, before the HUD |
| M7 symmetry and bosses | 10 | every archetype proccable; bleed builds work |
| M8 the S11 handoff | 4 | deterministic, one-directional |

- **≥ 85** — statuses are a decision.
- **70–84** — playable, gap named.
- **< 70** — **we lose.**

**Automatic fail regardless of score:** any probabilistic proc or resistance roll (**S1**, AR-1); any
status that kills outright; a status with no decay (an unwinnable race); a status visible only on the
HUD; a status the enemy has and the player does not, or vice versa; a sixth status added without an
amendment; an affliction contracted with a probability (**S11** handoff, and it is the same S1
violation at one remove).

## How we lose

1. **Status applied on hit.** No meter, no race, no decision — the classic debuff. It is one line of
   code and it deletes the entire item.
2. **The meter is HUD-only.** Correct in the simulation, invisible on the body, so the player learns
   to watch a bar instead of an enemy. M6's 0.25 body-tell threshold is the guard, and it is the
   check most likely to be skipped because it needs art.
3. **The decay is too slow to beat.** Set `decay_rate` at 4/s for BLEED and disengaging stops being
   an answer; the status becomes a tax on the fight's length rather than a response to how you fought
   it.
4. **A proc chance.** Someone will implement `if (rand() < 0.3) proc` because it is how a hundred
   other games do it. It is a to-hit roll inside the fight, it is AR-1, and it is why M4 runs ten
   seeds.
5. **Enemies do not have statuses.** The most likely asymmetry, because building the meters for the
   player is half the work. It kills bleed builds, it kills `RI-CMP03`'s payoff, and it makes bosses
   HP sponges.
6. **Bosses immune to everything.** The "boss fights should be about the moveset" instinct. Our answer
   is the `×2.5` threshold: a boss is *resistant*, and the fourth proc costs 5.5 times the first.
7. **The two halves of S11 never meet.** The in-fight meters ship and `RI-PRG09`'s diseases ship, and
   nothing ever transmits one to the other, so the seam ruling is satisfied on paper by two systems
   that have never spoken. §5 is one function call and M8 is four assertions, precisely so this is
   cheap to prove and expensive to fake.
8. **MIRE-LUNG gets deleted as "confusing".** It is the only status that survives a rest and the only
   one that is a disease, which makes it the odd one out in every menu — and it is the single piece
   of evidence that the seam is real.
9. **Escalation forgotten.** Thresholds never rise, so a long fight is five bleed procs and the
   player takes 60% of their health from a mechanic that was supposed to punish greed once.
10. **Statuses with no audio and no hitstop.** A proc that is a number changing is not an event. Audio
    is unreachable through the harness (`HARNESS.md` §3) so half of this is human-signed-off; the
    hitstop and the VFX burst are not, and M3 checks them.

## Provenance note

- **`constructed`, confidence medium.** The five statuses, every buildup/grace/decay number, the
  escalation multipliers, the 0.25 body-tell threshold, MIRE-LUNG in its entirety, and the whole of
  §5 are ours. Confidence is *medium*, not high, because no citable public table of Souls buildup
  rates or decay rates was reachable — `corpus/10-combat/data/souls-frame-data.json` carries no
  status section at all — so §2's rates are reasoned from our own hit cadences (`RI-CMB02`) rather
  than converted from anything.
- **`community-data`, confidence medium-high**, retrieved 2026-08-06 by direct fetch of
  [Dark Souls 3 — Status Effects (Fextralife)](https://darksouls3.wiki.fextralife.com/Status+Effects):
  - the DS3 status-effect set and their effects — **Frostbite** *"inflicts damage, lower absorption,
    and slows stamina regeneration"*; **Bleed** *"take damage equal to percentage of max HP"*;
    **Poison** *"slowly inflicts HP damage"*; **Toxic** *"rapidly inflicts HP damage… & lowers
    Stamina Regeneration"*; **Curse** *"instant death"*, with *"all Enemies are immune to Curse"*.
    Our BLEED / CHILL / ROT / VENOM take their *shape* from those four; Curse is deliberately not
    imported (§1).
  - the page's note that DS3 status bars are segmented at **33 / 103 / 300 / 500** and *"the values
    can go further"* — i.e. upstream thresholds are non-linear and inconsistently displayed. Our flat
    base of 100 with a `×1.30` per-proc escalation is a **deliberate simplification**, chosen because
    it is legible and exactly measurable, and it is recorded here as a divergence rather than
    presented as the Souls model.
  - that DS3 poison is *"much slower to damage health than in DSI and DSII"* — the reason our ROT is
    a long, low-rate 0.35%/s and VENOM is the fast one.
- **`community-data`, verified from the vendored UESP extract** (`Morrowind:Argonian`): Argonians
  carry **Resist Poison 100%** and **Resist Common Disease 75%** in Morrowind. `RI-CHR02` set ours at
  Poison 0.75 / disease immune, and §2 uses `RI-CHR02`'s numbers, not Morrowind's — recorded so the
  divergence is visible.
- **Cited, not redefined:** the S11 split (`ARBITRATION` §2); S1's ban on dice inside the fight; the
  stamina regen model those multipliers apply to (`RI-CMB03` §A); the 8 bosses (`RI-AI06`); the
  HEARTH rest that resets proc counts (`RI-PRG04`); the race table (`RI-CHR02`); the one instant death
  in the province (`RI-WLD11` H8); the HUD layout (`RI-UIX01`).
- **Unverifiable, correctly declared:** every number in §2 and §3, the boss `×2.5`, the 300-frame
  immunity, and the 12% BLEED burst. Binding because measurable; the two most likely to move after a
  human plays the result are BLEED's 3.0 s grace and the 12% burst.
