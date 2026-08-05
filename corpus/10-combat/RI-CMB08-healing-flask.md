---
id: RI-CMB08
title: Healing — the Hist-sap Flask, drink commitment frames, heal curve, and refill on rest
kind: number
side: souls
judges: [combat.player.heal, combat.resource.charges, combat.animation.commitment, progression.restsite.refill, combat.encounter.pacing]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

Healing is the second-most-important decision in a Souls fight and the only one that can
lose it outright. It must be **finite**, **slow**, and **committed**: a fixed number of
charges that do not come back until you rest, an animation long enough that using it is a
read on the enemy rather than a reflex, and no way to change your mind once you have started.
The good feeling is the one where you watch the enemy wind up a slow attack, recognise it as
your heal window, drink inside it, and come out the other side alive. The bad feeling — the
one that teaches — is drinking one frame too late and dying with a full flask.

"Good" means: the player can compute, from the enemy's recovery length, whether a drink is
safe, and be right. It means the charge is spent whether or not the heal lands. It means
there is no passive regeneration anywhere in the game, no instant-heal potion usable in
combat, and no way to buy your way out of a bad fight with gold.

## The reference artifact

### A. The item

**Hist-sap Flask.** A carved gourd of amber sap drawn from a Hist tree. Refilled by resting
at a Hist-stump (the rest-site / bonfire analogue owned by `corpus/20-progression/`).

| Property | Value |
|---|---|
| Charges at game start | **5** |
| Maximum charges | **15** |
| Charge increase | +1 per Hist Seed consumed at a rest site (10 seeds exist in the world) |
| Flask level | **+0 … +10**, raised at a rest site with Sap Amber |
| Charges refilled by | resting at a Hist-stump; respawning after death. **Nothing else.** |
| Charges refilled by potions / gold / merchants | **never** — see §E |
| Stamina cost | **0** |
| Usable while `OVERLOADED` | yes |
| Usable while staggered / guard-broken / mid-animation | no |

### B. Heal curve

Healing is a **percentage of maximum HP**, so a flask that mattered at level 20 still matters
at level 80. It is applied as a **ramp over 31 frames**, not as a lump.

| Flask level | Heal % of max HP | HP at 620 max (the RI-CMB07 exemplar build) | HP per frame over the 31-frame ramp |
|---|---|---|---|
| +0 | **40.0%** | **248** | 8.00 |
| +1 | 43.2% | 268 | 8.65 |
| +2 | 46.4% | 288 | 9.29 |
| +3 | 49.6% | 308 | 9.94 |
| +4 | 52.8% | 327 | 10.55 |
| +5 | 56.0% | 347 | 11.19 |
| +6 | 59.2% | 367 | 11.84 |
| +7 | 62.4% | 387 | 12.48 |
| +8 | 65.6% | 407 | 13.13 |
| +9 | 68.8% | 427 | 13.77 |
| +10 | **72.0%** | **446** | 14.39 |

`heal_pct = 0.400 + 0.032 × flask_level`. Overheal above max HP is discarded.

### C. Drink animation — the commitment contract (BINDING)

Total **65 frames (1.083 s)** at 60 Hz, identical at every flask level, for every build,
with every weapon, one- or two-handed, shield up or down.

| Phase | Frames | What happens |
|---|---|---|
| `HEAL_STARTUP` | **1 – 21** | Flask raised. Charge is consumed **on frame 1**. No healing yet. |
| `HEAL_ACTIVE` | **22 – 52** | Healing applied at `total_heal / 31` per frame. **31 frames.** |
| `HEAL_RECOVER` | **53 – 65** | Flask lowered. No healing. |

| Rule | Value |
|---|---|
| Charge consumed on | frame **1**, unconditionally, refunded **never** |
| Cancellable by any input | frames 1–58: **no**. Frames 59–65: dodge only, no refund |
| Movement during frames 1–52 | walk at **0.35×** base speed; no run, no sprint, no roll |
| Turn rate during frames 1–52 | ≤ **90 °/s** |
| Lock-on | retained; camera unaffected |
| Poise / hyperarmour during the drink | **none** — the player has their normal poise pool and no hyperarmour window |
| Stamina regeneration during the drink | normal (RI-CMB03 §A); drinking is not a spend, so the 42-frame delay is not re-armed |
| If interrupted on frames 1–21 | stagger per RI-CMB05 §B; **charge lost, 0 HP restored** |
| If interrupted on frames 22–52 | stagger; **charge lost, HP restored so far is kept** |
| If interrupted on frames 53–65 | stagger; heal was already complete |
| Enemy `AVOID`/reposition AI during the player's drink | governed by RI-AI01; the enemy is **not** made passive |

**`heal_secure_frames = 52`.** This is the derived number that makes healing computable: the
player must be untouchable for 52 frames from the press to bank the full heal (frames 53–65
are free to be interrupted). It is the figure to compare against RI-AI03's `P_safe`. An enemy
move offering `P_safe ≥ 60` therefore affords a full heal with 8 frames of reaction slack —
which is exactly why RI-AI03 requires every ELITE and BOSS to own at least one such move, and
why that requirement and this number must be amended together.

**Worked, from the RI-CMB07 exemplar.** At frame 2860 the Hist-Marked Champion commits to
`A5`, a 70-frame windup great slam with a 78-frame recovery. Its hitbox is live on 2930–2937.
The player rolls at 2924 and drinks on **2952** — 14 frames into the recovery. `HEAL_ACTIVE`
runs 2973–3003; the animation ends on 3016; the enemy's recovery ends on 3015. The player
declined the punish and took the heal instead, and the trace records that decision as an
unused punish window. That is the intended shape of the decision, and it is why row 27 of
RI-CMB07 §D is 0.778 rather than 1.000.

### D. Rest sites (the healing half only)

Full rest-site semantics belong to `corpus/20-progression/`. Only the healing contract is
owned here:

| On resting at a Hist-stump | Effect |
|---|---|
| Flask charges | restored to maximum |
| HP | restored to maximum |
| Stamina | restored to maximum |
| Ordinary enemies | respawn (ARBITRATION S5) |
| Named NPCs, quest actors, merchants | **never** respawn, never die to respawn logic (S5) |
| Quest state, journal, faction standing, world flags | untouched (S6) |
| Souls carried | untouched |
| Rest cost | **zero gold** — resting is never a purchase |

On death: charges restored to maximum at the respawn point, with the rest of S6's semantics.

### E. What healing explicitly is NOT

| Forbidden | Ruling |
|---|---|
| Passive HP regeneration, anywhere, ever | Deleted outright |
| Instant-effect healing potions usable while `COMBAT` is active | See the proposed seam below |
| Buying flask charges, or any in-combat healing, with gold | ARBITRATION S15 — gold is the only currency, and it buys nothing that shortcuts a fight |
| Healing spells with no animation commitment | Any in-fight heal obeys §C's contract or does not exist |
| Flask charges as a difficulty setting | |
| Enemies healing without the same commitment | An enemy that heals must use a ≥ 52-frame committed, interruptible animation and must lose the heal when interrupted |
| Any speed-up ring, buff, or stat reducing the 65 frames | Frame counts are invariant (RI-CMB02 §D.7) |

**Proposed seam ruling S16 (for the doctrine owner; NOT yet enacted).** Morrowind owns the
alchemy economy — named potions, ingredients, merchants, gold prices — and that survives
untouched outside the fight. But an instantly-consumed Restore Health potion inside the fight
is an AR-1 Souls-leakage violation of the first order: it deletes the entire resource tension
this item exists to create. Proposed ruling: *alchemical and spell healing exist and are
Morrowind's outside combat; while `COMBAT` is active, healing consumables and healing spells
are locked exactly as topic lists are locked under S13, and the Hist-sap Flask is the only
in-fight recovery.* Recorded here as a proposal because ARBITRATION §2 amendments are the
doctrine owner's to make; a critic finding in-combat potion healing before S16 is enacted
should file it against this item rather than pass it.

### F. Behavioural targets (measured over the RI-CMB07 exemplar)

| Statistic | Exemplar | Acceptance band |
|---|---|---|
| Drinks per 60-second elite fight | **2** | 1 – 5 |
| Charges remaining at fight end | 3 of 5 | ≥ 1 |
| HP % at which the player chose to drink | **62.4%**, then **57.7%** | 35% – 75% |
| Drinks initiated inside a window with `P_safe ≥ 52` | **2 of 2** | ≥ 0.75 of drinks |
| Drinks interrupted | 0 | ≤ 0.25 of drinks |
| Frames spent in `HEAL_*` as a fraction of the fight | 130 / 3550 = **3.66%** | 1.5% – 9% |
| Overheal wasted | 15 HP of 496 healed (**3.0%**) — first drink capped at max, second did not | ≤ 0.25 of total healed |

## Comparison method

Script: **`corpus/80-methods/m-cmb08-estus.mjs`**

Harness: headless Node + Three.js, fixed 60 Hz, seeded, scripted inputs, emitting
`es-combat-trace/1` (RI-CMB07) with `ESTUS_START` events and per-frame `p.hp`, `p.state`.

**M1 — Animation census.** From full HP−300, drink once with the enemy disabled.
- **FAIL** if total is not exactly **65** frames.
- **FAIL** if `HEAL_STARTUP` is not frames 1–21, `HEAL_ACTIVE` not 22–52, `HEAL_RECOVER`
  not 53–65.
- **FAIL** if HP increases on any frame outside 22–52.
- **FAIL** if HP increases as a single step rather than 31 approximately equal increments;
  require `max(Δhp) − min(Δhp) ≤ 1` across the ramp.
- Repeat with a dagger, an ultra greatsword, two-handed, shield up, at `LIGHT` and at
  `OVERLOADED`. **FAIL** on any variation in any frame count.

**M2 — Heal curve.** For flask levels +0…+10 at three different max-HP values (400, 620,
1100), drink from 1 HP and read the total.
- **FAIL** if `|healed − round(max_hp × (0.400 + 0.032 × level))| > 1`.
- Drink at 95% HP: **FAIL** if HP exceeds max, or if the unused portion is refunded to the
  charge.

**M3 — Commitment probe.** Inject each of {dodge, attack ×2, block, sprint, parry, heal
again, item, two-hand} on every frame `k ∈ [1, 65]` of the drink, in separate runs.
- Build `C[action][k] ∈ {ignored, buffered, cancelled}`.
- **FAIL** if any `cancelled` appears for `k ≤ 58`.
- **FAIL** if `cancelled` appears for any action other than dodge on `k ∈ [59, 65]`.
- **FAIL** if a cancel refunds the charge.
- **FAIL** if movement speed during 1–52 differs from 0.35× by more than 3%, or if sprint or
  roll is possible.
- **FAIL** if turn rate exceeds 90 °/s.

**M4 — Charge accounting.** Drink 5 times from 5 charges, then a 6th time.
- **FAIL** if the count is not 5,4,3,2,1,0 read from `ESTUS_START.left`.
- **FAIL** if the 6th input produces any animation at all (it must be dropped, not played
  with no effect).
- Interrupt a drink on frame 10: **FAIL** unless the charge is gone and HP is unchanged.
- Interrupt on frame 37: **FAIL** unless the charge is gone and HP gained is
  `round(total × 16/31)` ±2 (frames 22–37 inclusive).
- Interrupt on frame 60: **FAIL** unless the full heal was banked.

**M5 — Refill and non-refill.** Rest at a Hist-stump: **FAIL** unless charges, HP and stamina
are at maximum. Then, without resting, attempt every other refill vector the build offers —
merchant purchase, potion use, level-up, area transition, save/load, killing an enemy, waiting
600 frames.
- **FAIL** if any of them restores a charge.
- **FAIL** if resting costs gold, or if it fails to respawn ordinary enemies, or if it
  respawns any named NPC (S5).

**M6 — No passive regeneration.** Idle at 50% HP for 3600 frames with no input.
- **FAIL** if HP changes by even 1.

**M7 — In-combat healing lockout (pending S16).** Enter `COMBAT`, then attempt to consume any
alchemical healing item and to cast any healing spell.
- Report the outcome. Under the proposed S16 both must be refused. Until S16 is enacted, a
  critic **files this as a finding against this item** and does not silently pass it.

**M8 — Window arithmetic.** For every enemy in the roster (RI-AI05), compute
`max(P_safe)` from RI-AI03's M2 and compare against `heal_secure_frames = 52`.
- **FAIL** if any ELITE or BOSS has `max(P_safe) < 52` — that enemy is unhealable-against and
  the fight is a damage race by construction.
- Report the list of moves per enemy that afford a full heal. This list is a design artifact
  and should be attached to the verdict.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 animation census | 20 | 65 f, three phases exact, 31-frame ramp, invariant across builds |
| M2 heal curve | 10 | All 33 cells within ±1 HP; overheal discarded |
| M3 commitment probe | 25 | No cancel ≤ 58, dodge-only after, no refund, movement clamped |
| M4 charge accounting | 20 | Consumed on frame 1, partial heals exact, 6th drink dropped |
| M5 refill and non-refill | 10 | Rest refills; nothing else does; free; S5 respected |
| M6 no passive regen | 5 | Zero HP change in 60 s |
| M7 in-combat lockout | 5 | Reported honestly, filed if open |
| M8 window arithmetic | 5 | Every elite/boss affords one full-heal window |

- **≥ 90** — parity.
- **70–89** — gap named, remediable.
- **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - passive health regeneration of any kind;
  - healing that can be cancelled with the charge refunded;
  - an instant heal (0 or near-0 frame animation) usable in combat;
  - flask charges purchasable with gold or refilled by anything but rest/respawn (S15);
  - healing that grants i-frames or hyperarmour;
  - a heal amount that scales with anything other than flask level and max HP;
  - the charge being consumed on the *heal* frame rather than frame 1, which lets a player
    fake a drink for free.

**Blind pair:** show the critic two 60-second HP-vs-frame plots with heal events marked but
unlabelled, and ask which belongs to a game where healing is a decision. Record the blind
pick before the reveal. The tell is whether the HP line ever climbs while nothing else is
happening.

## How we lose

1. **The instant heal.** `hp += 250; charges--` on button press. Zero frames, zero risk,
   zero decision. It is one line and it removes the second-most-important choice in the game.
   M1 catches it, but the more dangerous version is the *nearly* instant heal — a 20-frame
   animation that feels responsive and is never a read.
2. **Cancel-and-refund.** An input queue that treats the drink like any other animation, so
   pressing roll aborts it and the charge comes back. The player now drinks speculatively
   every time the enemy is more than a metre away, and the resource stops existing. §C's
   frame-1 consumption is specifically designed so that a fake-out costs a real charge.
3. **Charge consumed on the heal frame.** Subtly different from (2) and just as bad: the
   player starts a drink, sees the windup, rolls at frame 15, and pays nothing.
4. **Healing that grants i-frames**, because someone will notice players dying mid-drink and
   "fix" it. The whole point is that they die mid-drink.
5. **Passive regeneration**, added because it makes exploring less tedious. It makes every
   fight winnable by retreating, which makes the flask decorative and the enemy design moot.
6. **Alchemy leaking in.** We are building Morrowind's world, and Morrowind's world is full
   of Restore Health potions you can chug five of in a second while paused. Without seam
   ruling S16 this is not even a bug — it is two correctly-implemented systems producing a
   broken game at their junction. This is the single likeliest AR-1 failure in the whole
   project, and it will arrive via the quest and economy work, not via combat.
7. **The inventory pause.** ARBITRATION S14 says menus do not pause combat, but a browser
   game's first inventory screen will pause the render loop by default, which pauses the sim,
   which makes healing free. Check this specifically: open the inventory mid-fight and verify
   the simulation frame counter keeps advancing.
8. **Flat heal amounts.** A fixed 250 HP that is enormous at level 15 and irrelevant at level
   80, so the flask silently stops mattering. §B is a percentage for this reason.
9. **A lump heal on one frame.** Cosmetically invisible in a still, but it means the player
   who is interrupted on frame 40 gets everything or nothing instead of a proportional
   amount, which removes the "drink anyway, bank half" decision.
10. **Rest sites that cost gold or restore only some resources**, which turns the checkpoint
    into an economy sink and reintroduces attrition farming.
11. **No enemy in the roster offering a 52-frame safe window**, so healing is theoretically
    correct and practically impossible. M8 is the only check here that judges the *enemies*
    rather than the flask, and it is the one most likely to be skipped.

## Provenance note

`confidence: medium`, split by section.

- **`canonical-recall`, confidence medium:** the design shape — a finite, rest-refilled
  healing flask; a drink animation on the order of one second that cannot be aborted once
  committed; movement allowed but slowed during the drink; the charge spent regardless of
  outcome; upgradeable both in count and in potency; no passive regeneration anywhere in the
  game; healing as the primary read-the-enemy decision. No community frame data was consulted
  and none is cited. In particular, the real Estus Flask's frame data is **not** reproduced
  here and 65 frames should not be attributed to it.
- **`constructed`, confidence high, and binding:** every number. The 5/15 charge counts, the
  +0…+10 flask levels and the `0.400 + 0.032 × level` curve, the 65-frame animation and its
  21/31/13 phase split, the frame-1 charge consumption, the 59–65 dodge-only tail, the 0.35×
  movement and 90 °/s turn clamps, the interruption rules, and all of §F.
- **`derived`:** `heal_secure_frames = 52`, computed from §C's phase split. It is the number
  that couples this item to RI-AI03's `P_safe ≥ 60` heal-window requirement and to RI-CMB07's
  punish-usage statistic. If §C's phases change, M8 and RI-AI03's §C table must both be
  revisited.

The §F values are computed from the RI-CMB07 exemplar trace and are exact for that artifact:
2 drinks, at 62.4% and 57.7% HP, both inside a `P_safe ≥ 52` window, neither interrupted, 130
of 3550 frames (3.66%) spent healing, 15 HP of 496 wasted to the HP cap on the first drink. The 248 HP figure in §B's `+0` row is the
same value the exemplar uses and the two must be changed together.

Seam ruling **S16** in §E is a **proposal only**. It has not been added to
`corpus/00-doctrine/ARBITRATION.md` §2 and this item does not have the standing to add it.
