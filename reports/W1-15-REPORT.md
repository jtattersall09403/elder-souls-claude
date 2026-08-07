# W1-15 — Stealth, theft, crime and justice

**Builder report.** Judged by RI-STL01, RI-STL02, RI-CRM01, RI-CRM02, RI-CHR02 (guard terms) and,
downstream, RI-QST05's PACIFIST-ALL metric, which W6 ruled `unmeasurable ⇒ 0` without this piece.

Everything below is reproducible with three commands:

```
node tools/analysis/crime-audit.mjs      # 37 static assertions over game/data/**
node tools/harness/stl-probe.mjs         # 125 assertions against the shipping sim modules
node tools/harness/stl-live.mjs          # 29 assertions against the RUNNING build in Chromium
```

---

## 1. The blocking dependency, first

RI-STL01's Comparison method opens with *"Button `crouch` added to `HARNESS.md` §4's closed
button set. Without it, no stealth scenario is scriptable at all. **This is a blocking
dependency**"*, and its "How we lose" adds that the absence would *"look like a stealth-design
failure rather than a tooling one."*

It is the first commit in this piece. `game/src/input/actions.js` now carries fifteen names;
`crouch` binds to `KeyC`/`KeyZ`, both previously unbound; `auditBindings()` returns `[]`; none of
RI-JRN03 §B's three collision rulings is touched. It is a **toggle** rather than a hold, because
RI-STL01 §5 puts sneak at 0.85 m/s and a 40 m warehouse at 47 s crouched, and a 47-second hold is
a hand cramp, not a design. Dark Souls' own crouch is a toggle for the same reason.

Live, from the running build:

```
PASS  LIVE-BTN   the closed action set contains `crouch`
              got 16 buttons: ...crouch, spell_cycle; crouch bound to ["KeyC","KeyZ"]
PASS  LIVE-CRO   pressing `crouch` toggles the sim state
              got crouched false -> true
```

*(The 16th name, `spell_cycle`, is W1-14's, added concurrently. See §8 for a collision it
introduced that is not mine to fix but is worth someone's attention.)*

---

## 2. What was built

| Subsystem path | Where | What it is |
|---|---|---|
| `stealth.detection.model` | `sim/stealth/detection.js` + `data/stealth/detection.json` | RI-STL01 §2's `V`, §4's sound scaling, §6's civilian model. Continuous, per-frame, **no RNG imported by the module at all** |
| `stealth.sneak.state` | same | 0.85 m/s, zero stamina, refused while an AGGRO enemy is inside 8 m |
| `stealth.npc.search` | `sim/stealth/search.js` + `data/stealth/search.json` | S-1 plausible set, S-2 escalating radius, S-3 one-hop propagation, **S-4 persistent zone memory** |
| `stealth.opener.seam` | `detection.js → isStealthOpener()` | Returns a **boolean**. Routes to W1-09's existing backstab; contributes nothing else |
| `stealth.trespass.zones` | `sim/stealth/theft.js` + `data/world/property/*.json` | 7 classes, 233 zones, no bounty ever |
| `stealth.theft.ownership` | same | 1,878 placed objects, 100% carrying an `owner` key, 292 distinct owners |
| `stealth.theft.pickpocket` | `sim/stealth/pickpocket.js` | Deterministic geometry + **the one die S21 keeps** |
| `stealth.lock.picking` | `sim/stealth/lock.js` + `data/stealth/locks.json` | The ward-collar. 235 authored locks, 0 RNG draws |
| `stealth.fence.economy` | `theft.js` + `data/crime/fences.json` | 9 fences, refusal by name, unique-item delayed bounty |
| `crime.witness.model` | `sim/crime/witness.js` | The predicate, the five report routes, the four responses |
| `crime.bounty.schedule` | `sim/crime/state.js` + `data/crime/bounty.json` | All 17 crimes, 3 jurisdictions, no decay |
| `crime.guard.response` | `sim/crime/justice.js` | 3 bands × race × faction, composed from W1-07's table |
| `crime.arrest.interaction` | same | Pay / resist / serve, plus two earned escape hatches |
| `crime.jail.consequence` | same | Deterministic ledger; loses your best cell-blocked skill |
| `crime.persistence.death` | `sim/crime/state.js` | Seam S6. Bounty is world state |
| `crime.faction.standing` | `sim/crime/sanction.js` + `data/crime/sanction.json` | 4 authorities, 0 universal, the writ that never suppresses a witness |

Plus the wiring: the subsystem is stepped inside `sim/step.js` after physics and before the
camera; `player.stealth` and `civilians[]` join `elder-souls/trace@1`; 27 event types and ~45
methods join the harness.

---

## 3. The evidence

### 3.1 Static — `node tools/analysis/crime-audit.mjs`, 37/37

```
PASS  OWN-1  takeable placed objects carrying an owner KEY            1878/1878 (100.0%)   target 100%
PASS  OWN-2  settlement-interior objects with owner != null                      100.0%   target >= 92%
PASS  OWN-3  distinct owner strings                                                 292   target >= 240
PASS  OWN-4  single-owner interiors                                        0/233 (0.0%)   target <= 15%
PASS  OWN-5  share of owned objects held by the single largest owner                3.9%   target < 10%
PASS  OWN-6  objects held by the largest PERSONAL owner                              15   target <= 30
PASS  LCK-2  chi-square vs uniform over 10-deg bins (df 35, p<0.01 needs >57.34)   226.1   target reject uniform
PASS  LCK-3  empty 10-deg bins (a generated field fills them all)                     3   target > 0
PASS  LCK-5  tier-5 sealed locks                                                     11   target 11
PASS  LCK-6  tier-4 masterwork locks                                                 48   target 48
PASS  LCK-7  tier-4/5 locks with >= 1 documented alternate route                  59/59   target 59/59
PASS  LCK-8  quest-variant tier-5 locks that reject Unbind                          4/4   target 4/4
PASS  TRS-1  trespass zones with an owner and a schedule                            233   target >= 180
PASS  TRS-4  distinct zone classes in the world    7 (faction_interior, dwelling, shop_closed,
                                          restricted, shop_open, sapwell_precinct, prison)   target >= 5
PASS  LGT-1  extinguishable share of placed interior lights                       71.5%   target >= 60%
PASS  SAN-2  authorities honoured in ALL THREE jurisdictions                          0   target 0
PASS  SAN-7  factionLawFactor spread (max/min on Imperial guards)                 5.33x   target >= 5x
PASS  SAN-9  the same Naga under two factions                     45 vs 238 (5.29x)   target >= 5x
PASS  FNC-2  best achievable fence multiplier at Mercantile 100                  0.6105   target [0.58, 0.62]

37/37 assertions pass
owner histogram (objects per owner, top 12): 73 25 19 15 14 13 13 13 13 12 12 11 ... tail length 292
```

**OWN-4 is the number I care about most.** RI-STL02 predicts the lazy pass — *"One owner per
building ... produces a world where stealing from a house is stealing from 'Gideon' — no name, no
face"* — and asserts ≤15% single-owner interiors. The measured figure is **0%**, because a
household in `tools/world/build-property.mjs` is a head plus a partner or a lodger or a
grandmother, and the objects in a room belong to whichever of them would own that thing. The
histogram's head (73) is a faction's shared trade stock spread across every Legion room in the
province, which is what `shared` scope is for; the largest *personal* owner holds 15 objects.

### 3.2 The sim modules — `node tools/harness/stl-probe.mjs`, 125/125

The five worked rows of RI-STL01 §2, stepped at 60 Hz by the shipping code:

```
sprinting, torchlit, heavy, Sneak 5        V     1.3 (item 1.3)  fill  97.5/s  t  1.033 s (item 1.03)  err 0.32%
walking, dim, medium, Sneak 5              V  0.3373 (item 0.339) fill  25.3/s  t  3.967 s (item 3.94)  err 0.68%
crouched, dim, light, Sneak 45             V  0.1576 (item 0.157) fill 11.82/s  t  8.467 s (item 8.5)   err 0.39%
crouched, unlit, light, Sneak 45, in cover V    0.05 (item 0.05)  fill  3.75/s  t 26.667 s (item 26.7)  err 0.12%
still, unlit, light, Sneak 100, in cover   V    0.05 (item 0.05)  fill  3.75/s  t 26.667 s (item 26.7)  err 0.12%
PASS  STL01-M2 worst error 0.68%   target within 5%
```

Formula conformance against an oracle written independently from the item's prose:

```
PASS  STL01-M1a 310,464 cases, max |oracle - engine|   0.00e+0    target < 1e-6
PASS  STL01-M1b the 0.05 floor fires                   46,608 cases
PASS  STL01-M1c the 1.30 ceiling fires                 12,309 cases
```

The lock ruling — the thing this piece exists to decide:

```
PASS  STL02-M3a 100 identical input scripts at 100 different seeds   1 distinct outcome, open=true
PASS  STL02-M3b RNG draws across a whole lock interaction            0
PASS  STL02-M3c Security 39 against a tier-3 lock (req 40)           100/100 refused, 0 picks consumed
PASS  STL02-M3d 100 deliberately mistimed scripts                    100/100 fail, 7 picks broken

   Security  40  W =  4.00 deg   window  2.7 f@60 =  44 ms
   Security  55  W = 12.25 deg   window  8.2 f@60 = 136 ms
   Security  70  W = 20.50 deg   window 13.7 f@60 = 228 ms
   Security 100  W = 34.00 deg   window 22.7 f@60 = 378 ms
```

S10 — the assertion RI-CRM01 calls mandatory:

```
PASS  CRM01-M4a bounty after killing the only witness, unobserved     0
PASS  CRM01-M4b the suppressed bounty                                 225 g suppressed
PASS  CRM01-M4c a permanent death_flag for the settlement             1
PASS  CRM01-M4d bounty when a second civilian watches the killing     1450   (1,000 + 2 x 225)
```

The report chain, which is the structural decision the whole item rests on:

```
   guard is the witness       -> guard_witness      0 f@60 =  0.00 s
   shout, guard at 20 m       -> shout             72 f@60 =  1.20 s
   run to a guard at 120 m    -> run_to_guard    2118 f@60 = 35.30 s
   no guard within 400 m      -> delayed         (no timer)
   the interior jurisdiction  -> never           (no timer)
PASS  CRM01-M3d bounty before the report lands   0
PASS  CRM01-M3e bounty after the report lands    225
```

Persistence (seam S6), the axis RI-CRM01 makes binary:

```
PASS  CRM01-M10a bounty and blood-price after three deaths   1600 g / 900 g, byte-identical
PASS  CRM01-M10b the unreported witness is still running     1
PASS  CRM01-M10c dying to a guard mid-arrest                 jail, not the sapwell
PASS  CRM01-M10d save/load round trip                        byte-identical
```

The AR-3 numbers:

```
   imperial, no faction       arrest  405 (declared 405)  attack 1620  bands 1/2/3
   imperial, ninth-cohort 5   arrest  972 (declared 972)  attack 3888  bands 1/2/3
   imperial, xul-aneekh 4     arrest  182 (declared 182)  attack  729  bands 1/2/3
   naga, xul-aneekh 4         arrest   45 (declared  45)  attack  178  bands 1/2/3
   naga, ninth-cohort 5       arrest  238 (declared 238)  attack  950  bands 1/2/3
PASS  CRM02-M6a 15 behaviour bands   15/15
PASS  CRM02-M6d a single faction decision, same character   5.29x
```

### 3.3 The running build — `node tools/harness/stl-live.mjs`

`stl-probe.mjs` imports the same modules the game imports, which is the right check for
arithmetic and the wrong check for **wiring**: it would pass unchanged if the engine never
stepped any of it. `stl-live.mjs` boots the real build in headless Chromium and drives it a frame
at a time.

```
PASS  LIVE-LGT   getLightAt() returns a real falloff, not a constant
              L along a line from a single 0.55 lamp:
              0 m -> 1.000   1 m -> 0.407   2 m -> 0.126   4 m -> 0.083   9 m -> 0.065   18 m -> 0.043
PASS  LIVE-PRP   property data reaches the running game
              29 zones in Gideon, first: gideon.fisher0.r0 (dwelling, owner Sees-All-Colours the
              Elder, 9 objects, 1 lock)
PASS  LIVE-OWN   listOwnedObjects on one room
              9 objects, 3 distinct owners, e.g. fish hook box (npc:gideon-fisher-0-sibling0, 7 g)
PASS  LIVE-LCK   a tier-3 ward-collar exists in the running world
              {"tier":3,"wards":3,"collar_deg":0,"ward_deg":74,"W_deg":20.5,"picks":12}
              the live interaction: 3 presses over 153 f@60, W = 20.5 deg, 3/3 wards set, 0 broken
PASS  LIVE-RNG   RNG draws across a whole live lock interaction        0 (counter 0 -> 0)
PASS  LIVE-OPN   the collar opens under timed `interact` presses       open=true, 3/3 wards
PASS  LIVE-PPK   a completed pickpocket hold draws from the seeded PRNG exactly once (seam S21)
              T = 1.97 s = 118 f@60, draws moved by 1
PASS  LIVE-PPG   all four geometry gates refuse, live, with a reason   4 refusals
PASS  LIVE-DRK   DARK-COVERAGE of the probe room at L <= 0.10          98.5% of 1681 samples
PASS  LIVE-TRC   trace player.stealth block present with RI-STL01's named fields
PASS  LIVE-THF   taking an owned object unobserved
              stolen_from=npc:gideon-fisher-0-sibling0, bounty 0 -> 0
PASS  LIVE-RPT   crime quote 225 g; bounty 0 before the report, 225 after
PASS  LIVE-S6a   bounty after a death            225 g, ledger unchanged=true
PASS  LIVE-S6b   dying to a guard mid-arrest     jail
PASS  LIVE-SAV   the engine's own save round trip with a live bounty   equal=true
PASS  LIVE-BND   200 g -> greeting_only; 600 g -> arrest_dialogue; 2,000 g -> attack_on_sight
PASS  LIVE-ARR   pay(refused), resist, serve — "You're 100 gold short, and I can count. Choose again."
PASS  LIVE-AR3a  Deep-Kin regard:  0 g -> +0;  3,000 g -> +12
PASS  LIVE-AR3b  war-brood shift at Xul-Aneekh rank 4:  -40
PASS  LIVE-HUD   stealth HUD elements   0
PASS  LIVE-DET   determinism guard violations across the whole probe   0

29/29 live assertions pass
```

`LIVE-RNG` and `LIVE-PPK` are a **pair** and only mean something together: the lock's "0 draws"
is vacuous unless the counter can move at all, and `LIVE-PPK` is the one place in this piece
where it does — by exactly 1, on the completion frame of a pickpocket hold. Seam S21 in two
measurements.

The trace block RI-STL01 asked for, taken from a real `run-headless.mjs` run:

```json
"stealth": {"crouched": false, "light": 0.04, "V": 0.05, "sound_r_m": 0, "surface": "earth",
            "in_cover": false, "motion": "still", "sneak": 5, "context": "public_street_sheathed",
            "context_weight": 0, "zone": null, "zone_baseline_alert": 0, "lock": null,
            "bounty_imperial": 0, "witnesses_pending": 0}
```

---

## 4. Seam S21, applied rather than argued

The brief is explicit: *"keep the die where failure is PERMANENT, delete it where failure is a
retry. Lockpicking becomes a deterministic skill threshold plus a timed execution challenge …
Pickpocketing KEEPS its roll because getting caught cannot be undone."*

**Lockpicking.** `sim/stealth/lock.js` imports no RNG. That is the enforcement, and it catches
all three side doors RI-STL02 names at once — a critical-failure chance on the pick, a Luck term
on breakage, and "a small random jitter on the collar rate so it doesn't feel robotic". The
engine's own draw counter reads 0 → 0 across a complete live interaction.

The other half of the ruling is the harder half. RI-STL02 warns that *"removing the die obliges
us to build an INTERACTION … The path of least resistance is `if (security >= req) open()`, which
is deterministic, passes method 3 perfectly, and turns the most-used verb in the thief build into
a keypress."* It is not a keypress: the collar rotates at a constant 90°/s, the ward angles are
authored per lock instance, and the player presses `interact` inside a window whose **width** is
the skill — 44 ms at the requirement, 378 ms at mastery.

**Pickpocketing.** Here the corpus contradicts itself, and I am flagging it rather than quietly
picking a side:

- RI-STL02 §5 says *"Same ruling, same reasons: **no roll**"*, and its method 7 asserts
  *"100 identical scripted pickpockets at 100 seeds: assert 100/100 identical."*
- ARBITRATION §2 seam **S21**, as amended by intent audit 02 (ND-01), says the opposite, names
  RI-STL02 by id, and says *"RI-STL02 and RI-MAG03 must be reconciled to this."*

ARBITRATION §5's precedence puts the seam rulings (rung 2) above an item's own comparison method
(rung 3), and S21 names RI-STL02 as the item to be reconciled rather than the reverse. **The die
is built.** The reconciliation's shape matters more than the ruling: everything RI-STL02 §5
specifies deterministically stays deterministic — eligibility geometry, slot count, weight
ceiling, hold duration `T`, suspicion fill, the caught-by-CHALLENGE path — and **exactly one
draw** is taken, once, on the completion frame, deciding only whether the target felt the hand.
Every geometry gate method 7 lists still fires and is still assertable at 100/100.

```
PASS  STL02-M7j  same seed, same outcome              true / true, rolls 0.285392 / 0.285392
PASS  STL02-M7k  draws per attempt                    exactly 1
PASS  STL02-M7l  20,000 seeds at notice_chance 0.3186 empirical 0.3237
PASS  STL02-M7n  the die is LIVE at every skill level 4.1% .. 85.0%
```

The last row is the one I would have got wrong. My first calibration used a subtractive Sneak
term and collapsed to the 2% floor by Sneak 45 — which passes every assertion and makes S21
decorative, a die that never decides anything. The shipped form is multiplicative and stays live
across the whole skill range. Both drafts are recorded in
`game/data/stealth/theft.json → pickpocket.the_die.calibration_intent`.

---

## 5. AR-3 — the seam crossings this piece creates

**The one I am claiming: an Imperial bounty, earned in a town, decides whether a fight starts in
a region three days' walk away.**

The chain, every link measured:

1. You commit a crime in Gideon. A witness reports. Imperial bounty rises (`LIVE-RPT`: 0 → 225).
2. RI-CRM01 §7's Xul-Aneekh row — *"Being wanted by the Empire is a reference"* — converts that
   bounty into Deep-Kin regard at +2 per 500 g, capped +12 (`LIVE-AR3a`: 3,000 g → +12).
3. That regard is added to the player's disposition with the Deep-Kin reaction group.
4. W1-07's **existing** `hostile_below_disposition` check in `character/encounter.js` reads that
   disposition. RI-CHR02 §4e sets the war-brood threshold at 15.
5. A Dunmer arriving at disposition 6 is attacked on sight. The same Dunmer, same save, carrying
   a 3,000-gold Imperial bounty, arrives at 18 and **the camp does not aggro**.

```
PASS  CRM02-M7b a Dunmer at disposition 6 meeting a war-brood camp
              rank 0: HOSTILE;  rank 4: neutral
PASS  CRM02-M7c the same Dunmer at rank 0 with a 3,000 g IMPERIAL BOUNTY
              disposition 6 + 12 regard = 18 vs threshold 15  -> neutral
```

The AR-1 discipline is the point. RI-CRM02 names the wrong way to build this: *"somebody makes
war-broods 'friendly variants' with a different archetype id … That is an AR-1 failure — the
world reached into the fight and changed the fighters. The legal lever is ONLY
`hostile_below_disposition` and the disposition the player carries."* Nothing in `sanction.js`
can express anything else: `warbroodDispositionShift()` and `deepKinRegard()` return **numbers
added to a disposition**, and there is no code path from this piece to an archetype id, a
statblock, a moveset or a frame count.

Two more crossings, both real:

- **The stealth opener.** A light attack on an unaware target inside its rear arc routes to
  W1-09's existing backstab. Sneak's entire contribution is a **boolean** — `isStealthOpener()`
  returns `true`/`false` and nothing else, so there is no number for a damage formula to
  multiply by. The rear arc is 101° at Sneak 5 and at Sneak 100; below Sneak 20 the blow still
  *hits*, because geometry decides hits (S1), it just is not a critical.
- **Dying to a guard mid-arrest wakes you in jail**, sentence already running. Souls' death rule
  and Morrowind's justice system meet in one branch of the respawn handler and neither loses.
  RI-CRM01 predicts this gets cut *"because it complicates respawn, which is Souls-owned code
  that nobody wants a Morrowind system reaching into."* `LIVE-S6b` is that branch firing.

---

## 6. AR-1 and AR-2

**AR-1 (no Morrowind mechanic in the fight).** No dice anywhere near combat: `detection.js` and
`lock.js` import no RNG at all; the pickpocket's single draw is out-of-fight by construction
(eligibility requires `civ_state == CALM`). Sneak never touches backstab damage, frames,
i-frames, the crit multiplier or the rear-arc angle — the seam function's return type is
`boolean`. Crime does not pause the fight; it accrues inside it.

**AR-2 (no Souls convention in the world).** Zero HUD elements — no eye icon, no visibility bar,
no hidden/detected word (`LIVE-HUD`). No objective markers. Gold is the only currency in the
fence economy and the arrest. Ownership is per-person and hand-rostered, not procedural.

---

## 7. What I am least confident about

**The bypass census (RI-STL01 §9) is not measured, and it is 1 of 10 scoring axes.**

REGION-BYPASS (≥ 8 of 13 regions traversable at Sneak 60 with zero AGGRO), R5-BYPASS (≥ 67% of
tier-5 encounters avoidable), DUNGEON-ROUTE (8/8), CAVE-CROUCH (82/82) and BOSS-BYPASS (0) all
require encounter placement across the province and the eight Souls-loop dungeons, which W1-02,
W1-04, W1-05 and W1-12 own and which do not exist yet. I can show the **model** produces the
right answer for any given encounter — the detection formula, the sound radii, the cone geometry
— and I cannot show that the province contains routes through it. A critic should score that axis
`unmeasurable ⇒ 0` under HARNESS.md §5 rather than take my word, and it is the axis most likely to
still be 0 at ship, because "every region has *a* stealth route and each one requires 40 minutes
of crouch-walking" is exactly the failure RI-STL01 warns about and exactly the one a script
cannot detect.

Two smaller ones, honestly:

- **`γ = 1.36` is my reading of a contradiction, not a fact.** §1 of the amendment shows the
  arithmetic and the value is data with a `how_to_disagree` field, but a critic who prefers
  `L^0.7` and re-derives the five worked rows would not be wrong to say I picked the table over
  the formula. I think the table is right for the three reasons given. I would not bet the piece
  on it.
- **The tier-1 and tier-2 lock counts are short.** `locks.json` publishes ~410/~230 for a
  250-interior world; 233 interiors exist, so the shipped counts are 0/56 at tiers 1–2 while the
  *design-load-bearing* tiers land exactly (120/48/11). The high tiers are the ones that make
  Security a build decision; the low ones are texture and will fill in as W1-04/W1-05 build
  interiors. Stated rather than discovered.

---

## 8. One thing that is not mine, noticed in passing

W1-14 added `spell_cycle` to the action set concurrently with this piece and bound it to
**`KeyR`**, which is already `heavy`'s primary binding (`game/src/input/bindings.js`).
`buildControlMap()` is last-write-wins, so on the desktop path `KeyR` currently resolves to
`spell_cycle` and the heavy attack has no keyboard binding. `auditBindings()` does not check for
duplicate controls, which is why it still returns `[]`. Flagging rather than fixing: it is
W1-14's binding and a concurrent edit to it would be worse than a note.
