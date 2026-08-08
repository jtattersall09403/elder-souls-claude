# W1-14 round 5 — magic

**Builder round against `corpus/90-verdicts/wave1/W1-14-r4.md` (FAIL, 4/10).**
Base commit `92b1860`. Every number below is a hit point, a metre, a frame count, an event
count, a gold price or a boolean. **No timing figure appears here** because none was taken.

The verdict's own sentence is what this round worked against:

> **"The door is excellent; what is on the other side of it does not work yet."**

---

## 1. THE GAP — `GAP-W1-magic-bolt-cannot-lead-a-body-that-walks`

**What it was.** At 14 m a body walking sideways at 1.5 m/s took **0** damage from all five damage
effects. The same body standing still took 48 / 43 / 41 / 43 / 29. The same body retreating ten
metres took 48 / 43 / 41 / 43 / 29. At 6 m the same walk was hit for full damage.

**What it was, mechanically.** Pure pursuit. The tracking loop steered at
`bearing(target.pos - p.pos)` — where the body *is*. A pursuit curve trails a crossing target and
the trail is paid at the end of the flight, after the cutoff has closed. For LIGHT at 14 m:

```
journey        (14 - 0.82) / 16          = 0.824 s = 49 f@60
cutoff         floor(0.35 x 49)          = 17 f    = 0.283 s
remaining      9.5 m / 16                = 0.59 s
the body walks 1.5 m/s x 0.59 s          = 0.89 m
the hit needs  radius 0.22 + hurtbox 0.45 = 0.67 m
```

0.89 > 0.67. It missed by twenty-two centimetres, on every effect, deterministically — which is
why the round-4 table is columns of clean zeroes rather than a scatter.

**Three changes, and they are three because the measurement said so, not because three sounded
thorough.** Each has its own teardown and they are run as a matrix, because RULES.md #6's third
shape — two guards over one defect — is exactly what this turned out to be.

| # | change | file | teardown |
|---|---|---|---|
| 1 | **LEAD.** A tracked bolt aims at the intercept — where the body will be when the bolt gets there — and then coasts. For a body holding a course that point is FIXED IN SPACE, so the required turning falls to zero: the steering is spent in the first few frames buying a straight line and the rest of the flight is ballistic. | `sim/magic/system.js` `_interceptOf` | `H.__breakLead` |
| 2 | **A CONTINUOUS SWEEP.** The bolt was swept along its own per-frame path against the body's END-OF-FRAME position — two segments tested as a segment and a point. The sweep is now taken in the relative frame, so both bodies move through the step. A stationary target is byte-identical. | `sim/magic/system.js` `step()` | `H.__breakRelativeSweep` |
| 3 | **A DERIVED ARC.** `turn_rate_dps` was 60 (LIGHT) and 45 (HEAVY), invented at a time when nothing tracked at all — wave 1 never set a target on a projectile and the trace measured 0.000 °/s. Under a lead the arc has one job with a closed-form size, and the binding case is the CLOSEST range, because the window shrinks with range while the angle does not. Derived: **95** and **115**. `tracking_cutoff` is untouched, so AP-M3 is exactly as tight. | `data/magic/cast-classes.json` `ballistics.turn_rate_law` | (the data) |

### The fix was INERT the first time, and the instrument is what caught it

`_stepBodyVelocity` read `p0[2]` on a **planar pair** — `[x, z]`, where z is at index 1. That is
`undefined`, so `vz` was `NaN`, so the intercept solve was `NaN`, so `_interceptOf` fell through
its own `!(dt > 0)` guard and returned the body's own position: **a lead that silently degraded
into the pure pursuit it was written to replace.** It measured as a partial improvement — 14 m
went from 0.89 m of miss to 0.19 m — which is rule 6's inert fix wearing a plausible number.

It was found by `tools/harness/w1-14-r5-diag.mjs`, which dumps one flight frame by frame and
printed `target_vel_mps: [1.5, null]` (CDP serialises `NaN` as `null`). The finiteness test in
`_interceptOf` is now explicit rather than accidental, and the comment says why.

### The fixture was also wrong, and rule 8 applies to it

The round-4 fixture spawned the body dead ahead and **never turned the caster**. At 6 m against a
3 m/s crosser the body has walked 13.6° off the caster's nose during the 24-frame startup, so most
of the arc the bolt was being asked to buy was correcting the PLAYER'S AIM — which RI-MAG01 M4
exists to forbid. Lock-on is a free action at any stamina (RI-CMB03 §B) and a locked stationary
body turns onto its target (`combat/player.js` ~1069). **Both grids are published**: `grid` is a
caster who is looking at the enemy, `grid_free` is one who is not.

### The table — `reports/w1-14-r5/lead-fix.json`

Five ranges x eleven motions x five damage effects, LIGHT/`projectile`, magnitude 20, 260 f@60,
the body driven one frame at a time by `setEntityPos` and its displacement **measured off
`listEntities()` and asserted** (the probe exits 4 if a cell that declared motion did not move —
which is exactly how the round-4 critic's first attempt at this arm failed).

The eleven motions are *not* one direction at one speed. That was the brief's warning and it is
the same warning the round-4 verdict's §12 gave: still; strafe **left and right** at 1.5, 3.0 and
5.0 m/s; retreat and advance along the axis at 3.0; both diagonals; and a real **orbit** around
the caster, whose path is curved and therefore violates the constant-velocity assumption the fix
is built on.

### The result, and the teardown watched going red

| arm | cells | delivered | **zero** |
|---|---:|---:|---:|
| **the fix** (`lead-fix.json`) | 275 | **275** | **0** |
| `--break nolead` (`lead-nolead.json`) | 275 | 120 | **155** |

**The round-4 verdict's own acceptance, written as it wrote it** — five damage effects at
magnitude 20, LIGHT/`projectile`, at **6 m and 14 m**, at **0, 1.5 lateral, 3.0 lateral and 3.0
axial** m/s, 40 cells:

| arm | cells delivering |
|---|---|
| **the fix** | **40 of 40** |
| `--break nolead` | 25 of 40 |

and the fifteen that go to zero under the teardown are **exactly the lateral ones**:
`6m@3.0`, `14m@1.5`, `14m@3.0`, all five effects each. Nothing else moves. **That is the width of
the fix measured rather than asserted**, which is what round 4 §4 was praised for and what §5 was
charged for not doing with the dial arms.

Its reading of today's build against criterion 1 was *"8 of 40 cells at zero"*. It is **0 of 40**.

See `lead-fix.json` `grid` for the full 275 cells, `grid_free` for the unaimed caster, `classes`
for the four ballistic classes and `dodge` for the roll arm.

### Which spells are *supposed* to be dodgeable, and the proof that the others are not

`CANTRIP` and `GREAT` declare `turn_rate_dps: 0` and `tracking_cutoff: null` in
`cast-classes.json`. They do not track, they never tracked, and **they are not given a lead** —
the lead rides on the arc. They are the dodgeable classes, by declaration, and the `classes` block
of the report puts them missing a walking body next to LIGHT and HEAVY hitting it, so that
sentence is a measurement rather than an excuse.

| class | `turn_rate_dps` | still | walking 1.5 | jogging 3.0 |
|---|---:|---|---|---|
| CANTRIP | **0** | 48 at 6/14/20 m | hit at 6 m only | **miss at all three** |
| LIGHT | 95 | 48 | **48 at all three** | **48 at all three** |
| HEAVY | 115 | 48 | **48 at all three** | **48 at all three** |
| GREAT | **0** | 48 at 6/14/20 m | **miss at all three** | **miss at all three** |

### The dodge still works, and that is the arm that stops this being "home harder"

`dodge` rolls the body **2.6 m** sideways at `min_dodge_window_f` (20 f@60) before the bolt
arrives — **timed off the RELEASE frame**, which is `startup + 1` and therefore 25 frames after
the button. The first version of this arm timed it off the button, and with LIGHT's 24 frames of
startup that put the roll *seven frames before the bolt existed* at 10 and 14 m; it reported 48
damage on a "dodged" cell, which is a fixture measuring itself.

| range | journey | no roll | **rolled** | closest approach |
|---|---:|---:|---:|---:|
| 10 m | 38 f | 48 | **0** | 1.98 m |
| 14 m | 53 f | 48 | **0** | 1.96 m |
| 20 m | 75 f | 48 | **0** | 1.90 m |

The bolt is already committed to the intercept it computed against the course the body was
holding. A body that changes course after the cutoff is not followed.

### AP-M3 still passes, which is the fence the arc change could have broken

`tracking_cutoff` is untouched, so the fence is exactly as tight — but "structurally unchanged"
is not a measurement, so `tools/harness/w1-14-r3-apm3.mjs` was re-run unmodified at this commit:

```
LIGHT  declared 95 dps  cutoff_f 41 | flight 120 f, AP-M3 fence 42 f
       observed max 95.4 dps before / 0 dps after   arc 28.25 deg -> PASS
HEAVY  declared 115 dps cutoff_f 54 | flight 184 f, AP-M3 fence 64.4 f
       observed max 115.2 dps before / 0 dps after  arc 33.08 deg -> PASS
```

Zero violating frames past `0.35 x travel_f` on both. A higher rate under a lead means the bolt
reaches its collision course *sooner* and then turns 0 °/s for the rest of the flight; it does
not mean it steers for longer.

---

## 2. THE ALIAS AUDIT — complete, with a count

`reports/w1-14-r5/alias-fix.json`, `alias-alias.json`.

The round-4 critic verified the fix on a route the round did not add and audited the rest **by
grep**. A grep cannot close this — a two-level assignment can be written through a local, a
destructure, `Object.assign`, or a handler added after the grep. So this asks the running world
two questions, and neither of them mentions `_weapon`.

**A. The alias census.** Every archetype the build declares is spawned, and the object graph of the
body and of its controller is walked to bounded depth against the statblock's own graph by
**identity** (`===`). That is the complete set of places a write through a body can reach a
statblock, whether or not anything writes there today.

> **22 archetypes · 22 spawnable · 121 shared-object edges · 31 distinct shapes.**

Three of the shapes are on the BODY: `.materialByRegion → stat.material_by_region`,
`.parley → stat.parley`, `.parley.grounds → stat.parley.grounds` (3 archetypes each). The
remaining 28 are all under `ctl.stat` — the controller holds the statblock by reference, which is
by design because it has to read it. **`_weapon` does not appear**: round 4's copy removed it, and
its absence from an identity census is a stronger statement than its absence from a grep.

**B. The mutation census.** Every statblock is deep-copied, then the world is run at it — every
spawnable archetype, six casts of every summon/bind/command/charm/frenzy spell in the catalogue,
105 casts in all — and the statblocks are deep-compared afterwards. A leak by ANY route shows up
here without anybody knowing what the route was.

| arm | statblocks moved |
|---|---|
| **fixed** | **0 of 22** |
| `--break alias` | **1 of 22** — `drowned_lesser.weapon.attack_rating: 86 → 495` |

The teardown goes red on the known leak, which is what makes the zero mean something.

---

## 3. THE ENCHANTING COUNTER — built, with a consumer

`reports/w1-14-r5/enchant.json`. New file: `game/src/sim/magic/enchant-counter.js`.

The round-4 verdict §7: *"`enchantQuote` is called from exactly one place —
`game/src/harness/api.js:1434` … nothing behind any of those sentences opens … If round 5 does not
close it, it should be floored there."*

It is closed. `tools/harness/w1-14-r5-enchant.mjs` **reads its own source at start-up and refuses
to run** if it names the model's verbs or the raw engine handle; the only verbs it uses are
`walkPath`, `talkTo` and `conversationSay`.

- **It walked.** All six towns with a spellwright or enchanter, every leg published. **Only
  Lilmoth arrives** (4.72 m, `arrived: true`). Blackrose stops 7.99 m short, Soulrest 6.98,
  Gideon 6.17, Helstrom 25.72, Stormhold 49.57 — all `stuck`. **That is a new finding and it is
  not this piece's to fix**: it is W1-04's town collision, the same class the round-4 commission
  probe hit in Lilmoth's market side. Five of six enchanters cannot be reached on foot.
- **The counter opened** on `enchanting` with Tsona-Ixtu, and read **her** ceiling (70) rather
  than a default — the Blackrose master reads 110 from the same code.
- **The refusals are hers.** With no filled gem: *"You are carrying no filled gem. Bring me a soul
  and we will talk about the rest."* For an effect nobody owns a spell for, asked **before** the
  character learns everything (after that the gate cannot be shown to exist): *"You do not own a
  spell that does paralyse. I put things into objects; I do not invent them."*
- **The purchase.** Gold 400,000 → **399,854** through `getGold()`. Filled gems **1 → 0**.
  `saveState()` carries `ench_1_ring_of_fire_damage` and the gold.
- **THE CONSUMER, which is the part that matters.** `useEnchantedItem` spends the object's
  **charge**, not Focus. Three uses of the ring, on a body, out of the **saved blob**:

| arm | damage | Focus spent | charge |
|---|---:|---:|---|
| **fixed** | **66** | **0** | 2000 → 1952 |
| `__breakEnchantUse` | 0 | 0 | 2000 → 2000 |

**What is still not built, said plainly.** `on_strike` and `constant` enchantments can be quoted,
made, carried and saved, and **nothing reads either one** — a struck weapon does not fire its
enchantment and a worn ring does not apply one, because both need a hook in `combat/resolve.js`
and in the equip path that belong to W1-09 and W1-16. That is declared in `spellwrights.json` for
an auditor **and said by the enchanter before she takes the money**: *"I will make it and I will
not lie to you: nothing in these lands has learned to read a blade yet. It will sit in your hand
and wait."*

---

## 4. DEEP WATER — and the fix I shipped first was not the fix

`reports/w1-14-r5/world.json` §water. Same control shape as the ground plane: **every named state
swept, the real cast button pressed through the combat bus, every load doubled** (the round-4
verdict §11's own instrument finding), thirty frames of settle.

**14 of 49 named states put the player in W5.** And the first fix — making the magic system's
floor the swimmer's float line instead of the sea bed — **changed nothing measurable**. `airborne`
went false and the press still produced no cast. That is what found the real block:

`combat/player.js`'s water gate denies **every** button but `roll` while `Traversal.denies('attack')`
is true, and `light` is that button. RI-WLD10 §5 R2 denies *attacks* while swimming and the reason
it gives is a body — you cannot swing a weapon while treading water. **A spell is a word and a
hand.** The precedent is thirty lines below, where the levitation denial list has exactly one hole
and that hole is a cast (`airborne_permits_cast`). The exemption is as narrow as that one: it is
the cast predicate (`light`/`heavy` **with a catalyst in the right hand**), so a sword swing in W5
is denied exactly as before.

**Two guards over one defect, run as a 2×2** — casts out of the 14 deep-water states:

| | gate open | gate shut (`__breakCastInWater`) |
|---|---:|---:|
| **floor fixed** | **14** | 2 |
| floor broken (`__breakWaterPlane`) | 2 | 2 |

Deleting either guard alone loses 12 of the 14, and only removing both is the world as it shipped.
**Honest reporting of that shape looks exactly like an inert fix** — RULES.md #6 says to say which
you have, so: this is the third shape, two guards, and the 2×2 is why I can say it. The two states that cast in every arm are
`town-stormhold` and `wld-dres-raid-road`, whose bodies are not actually at the water line; they
are named rather than dropped.

**And the denial is spoken.** `action_denied_by_water` was a bus event nothing under `ui/` or
`render/` read, which is why the press was silent from the chair *and* from a probe draining the
magic stream. Every water denial now goes through the same `uiToast` channel.

---

## 5. THE PURSE — closed at the write site, and the fix is INERT, and I say so

`reports/w1-14-r5/world.json` §purse.

`save/state.js:592` restored `sim.progression.gold` bare. `applySave` now takes a `setGold` hook
and the engine passes `_setGold` down, so the load path has one writer like every other path.

**And the delete-the-fix arm shows it is carrying nothing.** With `__breakPurseHook` armed —
`applySave` writing the bare field, exactly as it shipped — all four mirrors still agree after a
load:

```
FIXED   {get_gold 500000, save_gold 500000, stealth_gold 500000, combat_world_gold 500000, magic_gold 500000, progression_gold 500000}  -> ONE PURSE
BROKEN  {get_gold 500000, save_gold 500000, stealth_gold 500000, combat_world_gold 500000, magic_gold 500000, progression_gold 500000}  -> ONE PURSE
```

**That is RULES.md #6's first shape and it is named rather than hidden: an inert fix.** The
round-4 critic said the bare write was "masked by a rebuild rather than correct" and could not
produce a stale mirror; this is that claim measured rather than inferred, in both arms, through
`H.goldMirrors()` — a new read-only surface that publishes all four purses side by side, because
this project has now found **four** mirrored-value defects (two soul ledgers, `magic.gold`, and
this) and every one of them was found by grep, since `getGold()` reads the authority and a stale
copy is invisible to it by construction.

**The change stays.** A write that is correct only because of one caller's rebuild order is a
rule-7 landmine, and closing it costs nothing. But it is not a result, and reporting it as one
would be the thing this project keeps being burned by.

---

## 6. THE REFUSAL — half withdrawn, half fixed, and a correction to the verdict

`reports/w1-14-r5/world.json` §refusal.

Round 4 §9 was right and round 3 was wrong: `INPUT_DROPPED button: cast reason: no_focus` is real,
is on the **combat** bus, and carries `have` and `need`. `magicEventsDrain()` does not carry combat
events, so a probe draining only the magic stream sees emptiness either way. **No plumbing is owed
and none was added.**

The half that stood is the player's. Nothing under `game/src/ui/` or `game/src/render/` reads
`INPUT_DROPPED`, so the button did nothing and said nothing. All seven cast refusals now go through
`uiToast` — the channel W1-21 built and W1-16 gave a way in — and the diagnostic stays on the event.

**A correction to the verdict, found by going to copy the good example and discovering there was
nothing to copy.** §9 says the S29 travel fence *"attaches `e.text` and speaks"*, against `no_focus`
which *"attaches numbers and says nothing"*. It attaches `e.text`. **It does not speak.** Grep
`travel_refused` and `e.text` across `game/src/ui/` and `game/src/render/` and there is no reader,
exactly as there is none for `INPUT_DROPPED`. Both refusals were on events and neither reached a
person; the fence was held up as the example and was equally mute.

**Measured at the draw call, both arms:**

| arm | combat bus | on the screen |
|---|---|---|
| **fixed** | `INPUT_DROPPED reason: no_focus` | `"Not enough Focus for r5 over-reservoir. It asks 417; you hold 105."` |
| `__breakRefusalVoice` | `INPUT_DROPPED reason: no_focus` — **identical** | `[]` |

The trace does not move between the arms and the screen does. That is the two halves separated by
measurement rather than by argument.

**Two wrong readers on the way here, and both produced an INERT CONTROL** (RULES.md #6's second
shape) rather than a wrong fix — worth writing down because both are traps for anybody measuring a
HUD in this build:

1. `getUIState()` **does not publish the toast at all**. It is built inside `ui/system.js`'s HUD
   model and only ever leaves through `fillText`. Reading `getUIState().toast` returns `undefined`
   for a line that is on the screen — verified by raising one with `H.uiToast('CONTROL LINE')` and
   finding it in `getRenderedText()` and nowhere in `getUIState()`.
2. `render/text-register.js` **accumulates**. `getRenderedText()` returns every string drawn since
   the register was cleared, not the last frame's — so the BROKEN arm, run second, found the FIXED
   arm's own line still sitting in it and both arms reported speaking. `{ since }` is the
   register's own cursor and it is what the arm uses now.

---

## 7. THE POSITIVE ARM, BESIDE EVERY TEARDOWN

Charged in round 4 §5 and it is not a formatting note: *"publishing four control arms and no
treatment arm is the same shape as publishing a treatment arm and no control."* **Every arm in
this directory is published with its own unbroken run at the same commit.**

| pair | positive | teardown |
|---|---|---|
| the lead grid | `lead-fix.json` — 275/275 | `lead-nolead.json` — 120/275 |
| the alias census | `alias-fix.json` — 0 of 22 moved | `alias-alias.json` — 1 of 22 moved |
| deep water | `world.json` `water.all_fixed` — 14/14 cast | `all_no_floor`, `all_no_gate`, `all_broken` — 2/14 each |
| the purse | `world.json` `purse.fixed` | `purse.broken` — **identical, and named as inert** |
| the refusal | `world.json` `refusal.fixed` — on screen | `refusal.broken` — `[]` |
| the enchanted object | `enchant.json` `consumer.fixed` — 66 hp | `consumer.broken` — 0 hp |
| **the dial census** | `dials.json` — the arm round 4 did not run | `dials-nulldial.json` |

**And the dial census is re-run whole, which is RULES.md #9** — ten checks confirmed individually
and never together is how a green build ships broken, and this round changed the projectile
steering, a data file two of the dials read, and the input gate. The positive arm at this commit:

```
break=(none)   rows 55   ACTIVE 55   INERT 0   NOT_DELIVERED 0
MAGNITUDE  declared 48  coupled 33  BLIND 15
DURATION   declared 37  coupled 31  BLIND 6
AREA       declared 12  coupled 10  BLIND 2
```

**33 / 31 / 10, which is the round-4 critic's own reading at `9fadada` to the number.** Nothing
this round perturbed the census, which is the regression statement the change to
`cast-classes.json` needed and could not get from an argument.

---

## 8. CONSUMPTION (RI-MTH07, mandatory)

| model | world-side consumer | demonstrated by |
|---|---|---|
| **the projectile's steering** | the damage an enemy takes when it is MOVING | 275-cell grid; `__breakLead` restores round 4's zeroes (§1) |
| **the swept collision** | the same, at close range against a fast crosser | `__breakRelativeSweep` (§1) |
| **the enchanting model** | **an object in the player's pack that kills something for no Focus** | 66 hp, charge 2000 → 1952, `__breakEnchantUse` red (§3) |
| **the spellwright/enchanter records** | a person in a town, a topic, a counter, a purse, a gem, a save | §3 |
| **the water floor + the cast gate** | the cast input gate itself, in 14 states | 2×2, 14 → 2 (§4) |
| **the refusal** | the HUD, read at the draw call | §6 |
| **the load-path purse** | **none that the teardown can distinguish** | §5 — named as an inert fix rather than claimed |

---

## 9. WHAT I DID NOT DO

- **`on_strike` and `constant` enchantments are made and not read.** §3. Declared in the data and
  said by the enchanter. Both need hooks in files this piece does not own.
- **RI-MAG04, RI-MAG05, RI-PRG03 and RI-QST05 were not re-measured**, and **RI-MAG05's round-3
  hard fail on a forbidden anchor has not been retired by me.** If it stands, the piece is 0
  regardless of everything here.
- **Duration is still not read on the four effects that matter** (round-4 §13 secondary gap 1),
  **`engine.spawn` still drops `opts.side`** (gap 4), and **`frenzy` still writes a target nothing
  reads** (gap 6). Untouched this round.
- **The dial census's world-side-only signature** (gap 7) is untouched.
- **Five of six enchanter posts cannot be reached on foot.** Found, measured, published, and left
  for W1-04.
- **Contention.** `node tools/contention.mjs --gate` returned **GO** before every run in this
  report and I never proceeded past a WAIT. At most three browsers overlapped against a ceiling of
  six instances. **No timing figure is published here**, which is why none appears.
