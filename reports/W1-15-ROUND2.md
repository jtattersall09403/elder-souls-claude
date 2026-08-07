# W1-15 round 2 — closing `GAP-W1-stealth-crime-model-not-coupled-to-the-world`

**Builder report, round 2.** Round 1 scored **2/10** with all five items capped by hard fails.
The single biggest gap was not that the models were wrong — the round-1 critic went out of its
way to say the civilian detection model, the lock ruling and the property data were good — but
that **the models were computed beside the world instead of by it**. This report is organised
around that one sentence, because closing it is the whole job.

Re-measurable with:

```
node tools/harness/w1-15-coupling.mjs --width 320 --height 240 --json reports/w1-15-coupling.json
```

> **Run it at a small viewport.** Under SwiftShader the page's own rendering dominates: the same
> 3,600-frame in-page loop takes ~3 s at 320×240 and over twenty minutes at 1920×1080. The one
> measurement that genuinely needs the full viewport is NO-METER, which screenshots.

---

## 0. The one-line diagnosis, and why the critic's named call site was not the live one

The round-1 verdict named `game/src/sim/entities.js`'s perception branch as the place to fix.
**That function is dead code.** `stepEntities()` is not called from `sim/step.js` and has not been
since W1-09 made the combat bodies authoritative; `sim/combat-bridge.js` mirrors
`EnemyController.alert` into `sim.entities[].alert` at the bottom of every step.

The live `+4/frame` was here:

```js
// game/src/combat/enemy.js :: EnemyController._idleBehaviour  (round 1)
const sees = d <= this.stat.sight_radius_m && facing <= this.stat.sight_cone_deg / 2;
if (sees || b.aggro) this.alert = Math.min(100, this.alert + 4);
else                 this.alert = Math.max(0, this.alert - 1);
```

Two facts follow, and the second is the one that matters:

1. Patching `entities.js` as the verdict specified would have changed **nothing observable**, and
   the piece would have come back a third time with the same coupling of 0.00.
2. There were **two** perception implementations in the tree — `entities.js`'s and
   `enemy.js`'s — which is exactly how a build ends up with one good detection model and one
   broken one at the same time. The fix is therefore not "call the formula from the enemy too".

---

## 1. What was built: one perception kernel, and one caller

`game/src/sim/stealth/perception.js` (new) is now the **only** place an alert meter is filled.

| | round 1 | round 2 |
|---|---|---|
| enemy sight fill | flat `+4`/frame inside a radius and a cone | `150 · (1 − d/R) · V` per second, `RI-STL01` §2 |
| `V` in the loop | computed into the trace, read by nothing | the multiplier on the fill |
| hearing | `soundRadius()` computed, heard by nothing | `RI-AI01` §B rates 60/40/25 per second inside `r_effective`, ×0.4 through a wall |
| line of sight | **absent** | `sim.cell.sphereCast()` — the same static collision set the camera arm and the player's body use — plus a scenario occluder cell |
| `in_cover` (`A` = ×0.80) | an authored boolean | 12 probes on a ring at eye height; ≥ 60% blocked ⇒ in cover |
| peripheral cone | ×0.45 (in neither item) | ×0.35 with a 70 alert cap, `RI-AI01` §B verbatim |
| `alert_channel` | absent from the enemy record | `sight │ peripheral │ hearing │ shout │ damage │ bounty │ scripted │ null`, per frame |
| search | `search.js` never instantiated | `beginSearch` / `stepSearches` / `endSearch`, the searcher walks |
| witnesses | only ever from `addWitness()` | derived from live civilians and guards on the crime frame |
| bounty | only ever from `setBounty()` | only ever from a report landing |
| `stolen_from` | set on a world record and dropped | inventory + stolen registry + save |
| guards | did not exist | `guard_legion` entities, with a surrender parley |
| `reset()` | did not clear the subsystem | clears it, and asserts so |

`combat/enemy.js::_idleBehaviour` now **reads** the meter and owns only what the enemy does with
it. The comment block left in its place says what used to be there and why it moved, so the next
person to add perception to the fight finds a signpost instead of an empty slot.

### The call graph, which is the answer to `RI-MTH07` §B1 ("name the consumer")

```
sim/step.js  stepOnce()
  └─ sim.stealth.step(sim, input, bus)                    game/src/sim/stealth/system.js
       ├─ 3. L, V, sound_r_m, in_cover      ← detection.js + perception.js deriveInCover()
       ├─ 5. stepPerception(sim, bus)       → EVERY sim.entities[] alert meter
       │     └─ perception.js perceiveInto() / stepAlert()
       │        └─ writes through to combat/enemy.js EnemyController.alert
       ├─ 5b. stepSearches(sim, bus)        → moves the combat BODY of a searching entity
       ├─ 6.  civilian pass                 → every civilian's suspicion, sight AND hearing
       ├─ 6b. stepGuards(sim, bus)          → guard band from the live bounty; band 3 ⇒ AGGRO
       └─ 7.  pending reports               → the ONLY path by which bounty exists
```

Crime creation has exactly one door, `StealthCrime.commitCrime()`, and it derives the witnesses
on the same frame from the same world state. There is no way to file a crime without asking the
world who saw it.

---

## 2. `RI-MTH07`, applied to this piece by its builder

`tools/harness/w1-15-coupling.mjs` is written against `RI-MTH07` §B and against my own round-1
failure. Its rule is stated at the top of the file and is worth repeating here:

> Every measurement is taken by **perturbing a model and observing an entity**. No assertion in
> the file reads the return value of the model it is testing. The observables are entity-side
> only: `enemies[].alert`, `enemies[].alert_state`, `enemies[].pos`, `civilians[].suspicion`,
> `crime.witnesses`, `crime.stolen_registry`, `bounty`, `inventory`.

Every block carries a **null control** — a perturbation the item predicts changes nothing — because
§C's own note is that every wave-1 orphan would have been caught by the control alone.

### The measurements

All from `reports/w1-15-coupling.json`, produced by the command at the top of this report.

**`RI-STL01` method 2 — one INFANTRY (`R` = 16 m) facing the player at 8 m.** Frame-exact, entity-side.

| Configuration | `V` | item says | **measured** | error | channel |
|---|---:|---:|---:|---:|---|
| sprint, torchlit, heavy, Sneak 5 | 1.3000 | 1.03 s | **1.033 s** | 0.32% | `sight` |
| walk, dim, medium, Sneak 5 | 0.3373 | 3.94 s | **3.967 s** | 0.68% | `sight` |
| crouch, dim, light, Sneak 45 | 0.1576 | 8.5 s | **8.467 s** | 0.39% | `sight` |
| crouch, unlit, light, Sneak 45, cover | 0.0500 | 26.7 s | **26.667 s** | 0.12% | `sight` |
| still, unlit, light, Sneak 100, cover | 0.0500 | 26.7 s | **26.667 s** | 0.12% | `sight` |
| **null control** — lit sprint at **30 m** | 1.3000 | — | **never alerts**, alert 0.00 | — | `null` |

> **`coupling` = 0.9986** on the `V` = 1.30 vs `V` = 0.05 pair. Round 1 measured **0.00**.

**`RI-STL01` method 4 — no proximity leak.** Crouched, unlit, still, 1.0 m *behind* a stationary
enemy for 3,600 f@60: **peak alert 0.000, final alert 0.000, state IDLE, no AGGRO.** Round 1
aggro'd in 30 frames. (The enemy's facing is `yaw: 0` at `+z`, and that is measured rather than
assumed — an enemy at `(0, 8)` with the default `yaw: 180` has bearing-to-player 0° and sees you.)

**`RI-STL01` §4 — sound reaching an entity that cannot see you.** Unlit room, enemy facing away.

| | `r_effective` | at 20 m | at 3 m | channel |
|---|---:|---|---|---|
| sprint, heavy, dry reed, Sneak 5 | **36.309 m** | AGGRO at **1.667 s** | AGGRO at 1.667 s | `hearing` |
| crouch, light, mud, Sneak 100 | **0.656 m** | alert **0.00** | alert **0.00** | `null` |
| **null control** — *still*, heavy, dry reed | **0 m** | — | alert **0.00** | `null` |

**Sound reaching a civilian** — the round-1 verdict's named failure, verbatim ("a civilian 2 m
away, facing away, after 10 s of that sprint, registers suspicion 0.00 and stays CALM"):

| | `r_effective` | after 10 s | channel |
|---|---:|---|---|
| sprinting, heavy, dry reed, Sneak 5 | 36.309 m | **CHALLENGE, suspicion 70** | `hearing` |
| **null control** — crouch-walking, light, mud, Sneak 100 | 0.656 m | CALM, suspicion 0.00 | `null` |

70 is not a coincidence: hearing alone is capped at the CHALLENGE threshold, so being *heard*
puts a townsperson in the dialogue off-ramp and only being *seen* raises the alarm.

**Line of sight.** Identical configurations, one axis-aligned box between the two:

| | occluders | `los` | alert after 30 s | state |
|---|---:|---|---:|---|
| open | 0 | `true` | **100** (AGGRO at 2.0 s) | AGGRO |
| one wall | 1 | `false` | **0.00** | IDLE |

**Cover, derived rather than authored.** Open ground: 0 of 12 ring probes blocked, `A` = 1.00.
Inside an eleven-pillar alcove: **11 of 12 blocked (0.917), `A` = 0.80**, and
`in_cover_source: "derived_from_geometry"`.

**`RI-STL01` §7 — the search.** Seen at 8 m, then removed to 120 m:

| | item | measured |
|---|---|---|
| enters SEARCH | `RI-AI01` T25: no LOS ≥ 6.0 s | **6.00 s** |
| search duration | 12.0 s | **12.00 s** |
| searcher speed | walks (S17: 2.0 m/s) | **2.00 m/s** |
| walks to LKP | S-1 | yes, target `[0,0,0]`, reaches it |
| S-3 propagation | allies within 12 m → alert 45, one hop, never chains | `ally` @ 6 m → **alert 45, hop 1**; `far` @ 60 m → **alert 0** |
| S-4 zone baseline | 25 for 180 s, then 0 | **25** immediately, **25** at 60 s, **0** at 200 s |
| S-4 context multiplier | ×1.4 | **1.4** |
| S-4 lights relit | yes | snuffed lamp **relit**, `lights_out: []` |

Round 1: alert 100 → 40 → 0 in two seconds, speed 0.00 m/s, position unchanged for 24 s,
`zone_baseline_alert` 0, and `search.js` never called.

**`RI-CRM01` method 3 — with zero `addWitness()` calls in the script.**

| guard at | witness on the crime frame | route | latency | bounty |
|---|---|---|---:|---|
| **120 m** | `wit`, `identified: true`, `reported: false` | `run_to_guard` | 2,065 f@60 | 0 until the report, then **17 g at 34.5 s** (item: 120/3.4 = 35.3 s, **2.3%**) |
| **20 m** | `wit` + the guard itself | `shout` **72 f@60 = 1.200 s** exactly, plus `guard_witness` at 0 s | | 17 g |
| **none** | `wit` | `delayed` | `null` | **0**, and stays 0 |

`takeObject` was called with **no** `observedBy`, and reports
`observed_by_source: "derived_from_the_world"`.

**Ownership, enforced.** After nine takes in an empty interior: bounty **0**, witnesses **0**,
`stolen_registry` **8 rows** with owner, value, scope and settlement — and the same 8 in
`saveState().crime.stolen_registry`, with 8 inventory rows carrying
`stolen: true, owner_of_record: "npc:gideon-fisher-0-sibling0"`. A save → load round trip leaves
the registry and the inventory **byte-identical**. Selling one to `fence.gideon.docks` clears
`stolen_from` on the inventory row and stamps `laundered_by` on the registry row — the fence is
reachable from the world rather than from a hand-built item object.

**`RI-CRM01` §3b — the responses to a witness the world created.** Same 17 g theft, guard at 120 m:

| response | measured | bounty after 60 s |
|---|---|---:|
| let them go | the witness runs 120 m and reports | **17 g** |
| bribe | `ok: true, paid: 34` — `2 × quote`, exactly as §3b prices it | **0** |
| talk down | `ok: true, retryable: false` | **0** |

**S13 — the parley.** Bounty 2,500 puts an Imperial player in **band 3** (`attack_on_sight`,
`draws_weapon: true`, `parley: "surrender"`, against an arrest threshold of 405 and an attack
threshold of 1,620). A `guard_legion` spawned at 3 m and aggro'd goes `REPOSITION` → **`YIELDED`
at full HP** on one `interact` press. The fight ended without a corpse.

**Scenario isolation.** After `reset()` and after `loadState()`: bounty `{imperial: 0}`, context
`public_street_sheathed`, **0** civilians, **0** occluders. Round 1 leaked all four.

The hand-feed audit (§C3) is answered field by field:

| harness method | round-1 hand-feed | round-2 derived path |
|---|---|---|
| `takeObject(inst, {observedBy})` | the caller listed the observers | default is `_observersOf()` — live civilians with line of sight; the return value says which source was used |
| `addWitness(crimeRef, {eid, identified})` | the only way a witness existed | still present for scenario setup; `RI-CRM01` method 3 now passes with **zero** calls to it |
| `setStealthState({inCover})` | the only way `A` = 0.80 happened | derived from geometry every 6 frames; `in_cover_source` in the trace says `derived_from_geometry` or `forced_by_scenario` |
| `reportRoute({nearestGuardDist})` | the caller supplied the distance | computed from live guard positions, with `wallsBetween()` from the same collision set |
| `getGuardBand({bounty})` | a function of `setBounty()` | `stepGuards()` reads the live ledger every frame and puts a guard entity into AGGRO at band 3 |
| `setPlayerMotion(m)` | *(new)* | a world fact like `setZoneAmbient`; `motion_forced` is reported in the trace, and `null` returns the band to the controller's own speed |

---

## 3. Corpus defects found while closing the gap

Filed in `corpus/00-doctrine/AMENDMENT-W1-15-01.md` §5 §6 §7. Sections §1–§4 stand from round 1;
the round-1 critic recomputed §1 independently and confirmed it.

**§5 — `RI-AI01` §B and `RI-STL01` §2 give incompatible sight-fill curves.** `RI-AI01` says
"100/s at ≤0.5·R"; `RI-STL01`'s worked table implies 75/s at 0.5·R (97.5 = 150 × 1.30 × 0.5).
At exactly the distance both items work an example at, they differ by a third. This build uses
`RI-STL01`'s, because `RI-STL01` method 2 *asserts* five times against it and `RI-AI01` has no
method that pins the rate. Recorded as data in `detection.json`; set it the other way and
`RI-STL01` method 2 fails instead.

**§6 — `SNEAK-QUESTS ≥ 22` is a count against a tree that does not exist yet.** The item annotates
its own number as "≈ 12% of ~180". Wave 1 ships 33 quests; 22 of 33 would be two thirds of the
game. Asked to be read as the ratio it says it is until the tree reaches ~180. The build is at
**13 / 33 (39.4%)** for `sneak` and **8 / 33 (24.2%)** for `steal`, with VERB-SPREAD at **24.7%**
against a 40% cap.

**§7 — `RI-STL01` method 6's two S-2 assertions contradict each other.** S-1 caps the plausible set
at 8 m from the LKP with a 2 s dwell and 3 s per volume; S-2 asks the critic to assert the searcher
gets 19 m from the LKP inside a 12 s window. At S17's 2.0 m/s that is 24.5 s of walking. The band
is implemented as the **re-acquire radius**, which is what §7's prose describes ("a player who
hides at 10 m and holds still is *found*"), plus an outward sweep once the plan is exhausted so
there is a distance to measure.

---

## 4. What is deliberately unchanged

The round-1 verdict was emphatic about four things and none of them has been touched:

- **The lock ruling.** Deterministic skill gate, `W` = 4.00/12.25/20.50/34.00° clamping at 34.0,
  719 authored ward angles, χ² 226.1 on 35 df, and **zero** RNG draws across a live interaction.
- **The pickpocket die.** Kept, drawn exactly once per completed hold, 0.357 → 0.070 across
  Sneak 5 → 100. Seam S21 applied by precedence rather than copied.
- **The civilian detection model.** Its arithmetic is unchanged; it now additionally hears you,
  tests line of sight, and produces witnesses.
- **The property data.** 1,878 owned objects, 292 owners, 233 trespass zones, 0 single-owner
  interiors. What changed is that taking one of them now has consequences that persist.

Re-measured after the rewrite (`reports/w1-15-r2-regression.json`):

| assertion | round 1 | round 2 |
|---|---|---|
| `W` at Security 40 / 55 / 70 / 100 / 140 | 4.00 / 12.25 / 20.50 / 34.00 / 34.0 | **identical** |
| lock gate at Security 39 vs a tier-3 lock | not offered, 0 picks, spoken prompt | **identical** |
| RNG draws across a lock interaction | **0** | **0** |
| pickpocket draws per completed hold | exactly 1 | **exactly 1** (30 / 30) |
| pickpocket curve live across the skill range | yes | **yes** (0.850 → 0.146 at this scenario's `V`) |
| `isStealthOpener` gate | 19 → false, 20 → true, AGGRO → false, front → false | **identical** |
| `hud_elements` | 0 | **0** |
| `stl-probe.mjs` | 125 / 125 | **125 / 125** |
| `crime-audit.mjs` | 37 / 37 | **37 / 37** |
| `stl-live.mjs` (live, in Chromium) | 29 / 29 | **29 / 29** |

`inf_trash.sight_radius_m` moved 14.0 → 16.0 — `RI-AI01` §B's *nominal* INFANTRY value, inside
its own ±2 tolerance, and the value `RI-STL01` §2's worked table is computed at. Nothing in the
fight reads that field; only perception does.

---

## 5. What I could not close, stated rather than hidden

- **`RI-STL01` §9's bypass census** — REGION-BYPASS ≥ 8/13, R5-BYPASS ≥ 67%, DUNGEON-ROUTE 8/8,
  CAVE-CROUCH 82/82 — needs 13 walkable overworld routes, 8 Souls-loop dungeons and 82 caves with
  placed encounters. Those are `W1-01`/`W1-03`/`W1-12`'s, and none exists yet. The detection model
  they would be measured with is now real; the world to walk is not. **Unmeasurable, and it should
  be scored 0 fail-closed on that axis rather than credited.**
- **`RI-QST05`'s live verification** — "complete ten pacifist quests in-engine and record the kill
  count" — still cannot run, because quest *progression* does not exist at this commit. The census
  is computable; the playthrough is not. `questVerbCensus()` returns `meaningful: false` with the
  denominator attached so the 100% cannot be quoted without its sample size.
- **`RI-CRM01` method 4's content half** — "≥ 6 NPCs with a line conditioned on
  `settlement_death_flags ≥ 3`" and "≥ 2 quests with such a stage" — is dialogue and quest content
  this piece does not own. The mechanism is built and the lines are not written.
- **0 tier-1 locks**, still, against the ~410 `locks.json` publishes. The generator places 235
  locks in total, so the tier bands (48 / 120 / 48+11) consume the whole ranking before tier 1
  is reached. Fixing it means regenerating `game/data/property/**` — the 1,878 owned objects the
  round-1 verdict called "the best data in the repository" — while three other builders are in
  the tree, and the verdict itself filed this under "not work for the next builder". **Left
  deliberately, and named here rather than left to be rediscovered.**
- **The arrest as a played interaction.** `getGuardBand`, `arrestTopics` and `answerArrest` are
  correct and are now driven by a guard who is really standing there and really reads the live
  bounty. What is still a function call rather than a played scene is the *dialogue* — the three
  answers are topics, and the topic surface belongs to `W1-08`.
