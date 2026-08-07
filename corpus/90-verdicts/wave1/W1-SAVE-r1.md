# W1-SAVE round 1 — save and load, judged against `RI-JRN05`

**Score 2/10. Status FAIL. `HF1` triggered.**
Native: **2 / 100** — a triggered hard fail caps the item at 2 regardless of every other block,
and this item's own band table admits nothing below a perfect 100 as meeting the bar.

Critic: `critic.platform`, run `crit-w1-save-r1-live-audit`, no conflict of interest.
Build `b27373f`. `node tools/harness/boot-check.mjs` — **PASS** — before any measurement.

---

## The one-sentence answer

**The gold a player can spend has no writer in the save**, so a plain round trip destroys 600
gold on three of the thirty-eight shipped states while every instrument the build ships reports
clean — and separately, **a save taken inside the death sequence does not round-trip at all**,
which is `HF1`.

---

## 1. Does 76/76 survive an independent instrument and a wider seed sweep?

**The seeds were never the weakness. The pre-roll was.**

I did not use `tools/journey/state-diff.mjs`. It was written by the agent whose repair it
grades, and — more importantly — every one of its headline checks is taken on the **save blob**:

* **M1 is a fixed-point test on the serialiser.** `h0 = hash(save())`, load, `h1 = hash(save())`.
  A field written to the blob and never read back still passes M1 whenever the value it
  re-serialises to happens to equal the value that was saved. Every field sitting at its identity
  value is in exactly that position, and nine of this repair's own fields are declared at their
  identity values.
* **M2 is the same comparison at field level.** **M4** is a set difference of the blob against a
  manifest — a document against a document.
* `getDurableFieldCensus()` *is* a live-object differential and is the strongest thing in the
  build. But it walks a declared subset: `sim.player/camera/env/world/progression/quest/inventory/
  identity/character/captured/npcs/props/magic/entities` plus the combat bodies. It does **not**
  walk `engine.combat.world`, `engine.crime`, `engine.travel`, `engine.conversation` or
  `sim._traversal`. Its own comment warns about this: *"a census that walks a subset of the
  simulation is an instrument that certifies a subset."*

So I wrote `tools/journey/save-live-audit.mjs` (declared under `method_deviations`). It never
reads the blob. It observes the world through ~30 public harness getters in two arms —

```
CONTROL : preroll              -> observe -> step(N) -> observe
LOADED  : preroll -> save+load -> observe -> step(N) -> observe
```

— plus a **reproducibility control** (two identical pre-rolls, no save between them) so a
scenario that cannot reproduce itself is reported `unmeasurable` rather than used to convict.
Instead of maintaining a frame-exclusion list, every numeric leaf is compared **twice**, as an
absolute value and as `value - frameNow`, and classified `abs` / `rel` / **`stale`** / `diff` —
so a deadline restored *unrebased* is reported rather than quietly excluded.

And I chose the moments the builder's single pre-roll does not reach. `state-diff.mjs` applies
**one** pre-roll to all 38 states: spawn two `inf_trash`, aggro one, walk, swing, roll. It never
dies, never falls, never opens a menu, never holds money.

### The sweep: 9 scenarios × 10 seeds = 90 trials

| Scenario | Result |
|---|---|
| `idle` | **10/10 clean** |
| `mid-swing-hitactive` (saved inside an active hitbox window) | **10/10 clean** |
| `mid-cast` | **10/10 clean** |
| `mid-parry` (guard raised and held) | **10/10 clean** |
| `mid-menu` | 9/10 clean, 1 unmeasurable |
| `at-hearth` | **10/10 clean** |
| `deep-water-drowning` | **10/10 clean** |
| **`mid-death`** | **0/10 — hash mismatch on every seed** |
| **`mid-crime`** | **0/10 — 600 gold destroyed on every seed** |

1,239–1,530 live-world leaves compared per trial. Zero page errors.

**Seeds 4711, 1337, 90210, 2147483647, 7, 101, 31337, 555, 12345, 777 — the two failures fire on
all ten and the seven passes hold on all ten.** Widening from two seeds to ten changed nothing.
Widening the *moment* changed everything.

Three further province scenarios (`in-water`, `mid-fall`, `mid-travel`) came back
**`unmeasurable-preroll-not-reproducible`**: two identical pre-rolls with no save between them
produced different player positions, and in one case a live player in one arm and a corpse in the
other. That is a contamination finding in its own right (§6) and it is why the tool refuses to
convict on those three.

---

## 2. `HF1` — a save taken during death does not round-trip

Found with my instrument; **reproduced with the builder's own** `__HARNESS.saveRoundTrip()`, so
it cannot be blamed on my tooling. `save-consume-critic.mjs` P3 sweeps four states × nine points
of the death sequence: **24 of 36 mismatch.**

### Cause (a) — the `-1` sentinel eats the rebased death frame

```
save   game/src/save/state.js:356
       camera_death_frames_ago: c.deathFrame < 0 ? -1 : Math.max(0, f - c.deathFrame)
load   game/src/save/state.js:741
       c.deathFrame = pose.camera_death_frames_ago < 0 ? -1 : f - pose.camera_death_frames_ago
```

`loadState()` resets the frame to 0. So a save written 119 frames into a death restores
`deathFrame = 0 - 119 = -119`. `resolveMode()` is correct about this — `camera.js:323` tests
`!== -1` precisely so a death that began before the load is still a death, and the comment at
`camera.js:321` says so. **The serialiser is not.** It tests `< 0`, so the second save writes
`-1`, and the round trip is not a fixed point.

Measured, on `arena_flat`, `default`, `sv1-midquest` and `sv5-journal-bloodstain` — two of them
the item's own SV fixtures — at 3, 10, 40, 100 and 150 frames after death:

```
M2 diff: pose.camera_death_frames_ago   a: "119"  ->  b: "-1"
```

At 0 frames after death and at 250 (death over) it is clean. Everywhere between, it is not.

### Cause (b) — a move reference nested inside `pendingReaction`

A save taken on the exact frame of the killing blow, 4 of 4 states:

```
M2 diff: fight.player.pendingReaction.move.clip
         a: {"__move":"stagger_medium"}  ->  b: null
```

This is the same class of defect the repair found and fixed for `pose.move` — *"move references
were serialised by the wrong key"* — applied to the top-level move and not to the one nested
inside the pending reaction. The stagger you were about to be put into is deleted by the save.

### The behavioural half

`death.controllable_at` is restored **raw** (161) while the frame resets to 0, so
`surface_frames_left` goes **137 → 161**: a player who reloads 137 frames into a death waits the
full 161 again. The post-load trace diverges with it (`events[].time_dead_frames` 54 vs 30),
which is the **M5 clause of HF1**.

The Death state group on the manifest is *one path* — `death.bloodstain`. The death runtime is
not in the save. It only appears to survive a warm load because nothing clears it.

---

## 3. The single biggest gap — `GAP-W1-save-purse-has-no-writer`

`subsystem_path: journey.save.roundtrip`

**The gold a player can spend lives in `combat.world.gold` and `sim.stealth.p.gold`. Neither is
ever written back into `sim.progression.gold`, which is the only gold register the save carries.**

Swept over **every one of the 38 shipped named states**:

| State | `combat.world.gold` before | after | M1 |
|---|---:|---:|---|
| `helstrom-market` | 600 | **0** | equal |
| `rootlands-well-graph` | 600 | **0** | equal |
| `stormhold-street` | 600 | **0** | equal |

`blob.progression.gold` = 0 and `blob.fight.loadout.gold` = 0 in all three, because
`game/src/save/fight.js:183` writes the loadout's gold from `sim.progression.gold` — the register
nothing spends from — rather than from the purse. `Engine._buildCombat` then rebuilds
`world.gold` from that zero.

**It survives a real cold reload.** `writeSave` → `page.reload()` → `readSave` on
`stormhold-street`: hash **equal**, gold **600 → 0**.

### Every shipped instrument says clean while it happens

I falsified this directly with `save-break-critic.mjs`, which asks a different question from the
builder's falsifier: not *"does the failure come back"* but **"which of the build's own shipped
instruments notices?"**

| Break | M1 | M4 | census | live world changed |
|---|---|---|---|---|
| `no-traversal-restore` | no | yes | no | no |
| `no-encounter-latches` | no | no | **yes** | yes |
| **`no-gold`** | **no** | **no** | **no** | **yes** |
| `no-lkp` | no | no | **yes** | yes |

`no-gold` is **blind to all three**. And the **baseline** — with no break installed at all —
already loses the gold. Blanking `progression.gold` and `fight.loadout.gold` out of the blob
produces *exactly the same world* as leaving them alone.

**That is CONSUMPTION coupling 0** (`RI-MTH07` §B, `ARBITRATION` §3), on a field this very repair
added to the manifest with the note that it is *"read by `_buildCombat` into the parley price and
by the spell merchant"*. The field was added, given a writer and a reader, and the number the
consumer actually uses is somewhere else.

### Why it matters, and why it is an AR-2 failure

`game/src/combat/parley.js:97`:

```js
case 'GOLD': {
  const price = cfg.gold_price || 0;
  const enough = (world.gold || 0) >= price;
```

`ARBITRATION` §1, as amended, gives Morrowind **the right to yield, parley, bribe or talk down**
inside a Souls fight, and says a fight with a person must have a non-lethal exit. `inf_trash`'s
`gold_price` is 180; the champion's is 900. With 600 gold you can buy your way out of a trash
fight. After a save/load you cannot — and nothing else about the world has changed.
`getTravelState().gold` reads the same destroyed register, so a fare you could afford is refused.

**The Morrowind half's money is destroyed by the save, and the consequence lands inside the Souls
fight.** That is AR-2, and it is a genuine seam crossing rather than a subsystem bug.

### Remedy (buildable, and the acceptance is re-measurable)

1. Make `sim.progression.gold` the single authority: `setGold`, `parley.applyAccept`
   (`world.gold -= spent`), `travelRide` (`world.gold -= fare`), `fenceSell` / `bribeWitness`
   (`stealth.p.gold`) and the capture path all write through to it, and `_buildCombat` reads only
   from it. Or, if three registers must stay, give `combat.world.gold` and `sim.stealth.p.gold`
   their own manifest paths.
2. Widen `getDurableFieldCensus()`'s `shot()` to clone `this.combat.world`, `this.travel`,
   `this.crime` / `sim.stealth`, `this.conversation` and `sim._traversal`.
3. Put money in `state-diff.mjs`'s pre-roll so the sweep can fail.

**Acceptance:** on the three states, at ten seeds, `getTravelState().gold` and
`getCombatState().world_knowledge.gold` unchanged across `saveRoundTrip()` *and* across
`writeSave` + page reload + `readSave`; and `node tools/harness/save-break-critic.mjs` reports
`no-gold` as `detected_by_any_shipped_instrument: true`.

---

## 4. Do the nine identity-valued fields carry any information?

**Seven do. Two do not, and one of those is the repair's own headline example.**

| Declaration | Can it be driven off its identity? | Restored? |
|---|---|---|
| `progression.gold` | yes (`setGold(2750)`) | value yes — **but not to its consumer** (§3) |
| `progression.sap_taint` | yes (4 hearth rests → `{band:1, rests:4}`) | **yes, exactly** |
| `entities[].lkp` / `lastSeenF` / `percept_*` | yes | yes — `no-lkp` break is caught by the census |
| `entities[].encounter*` latches | yes | yes — `no-encounter-latches` caught by the census |
| `CombatBody.worldDeny` / `mireStruggle` | yes (band W5 denies roll/sprint/attack) | yes |
| `skills[].levels_since_rest` / `rest_clamped` | present on all 19 skills, driven by use | yes |
| `traversal.band` / `depth_m` / `denies` | yes (W5 at 40.3 m) | **yes** — verified by perturb-then-load |
| **`traversal.breath_s` / `submerged`** | **NO** | vacuously |
| **`player.burdenRatio` / `carriedWeight`** | **NO** by `setEquipLoad` | vacuously (derived) |

* **`traversal.breath_s` stays at exactly 60.0 and `submerged` stays `false` after 3,000 frames
  of swimming in 40.33 m of water in band W5.** The character floats. The repair's headline claim
  — *"a save taken drowning in W5 water reloaded with a full lungful"* — describes a state this
  build cannot reach, so that manifest row round-trips perfectly and carries nothing.
* `player.burdenRatio` is recomputed every step from inventory weight by `_recomputeBurden()`;
  it is derived, not durable, and saving it cannot be wrong or right.

**Negative evidence for the builder, and it matters:** the traversal *restore* is real. I
perturbed `sim._traversal` by hand after the save — `breath 3.25`, `mire 0.77`, `mired true`,
`slide 4.5`, `vy -12.5`, `mireEscapes 9` — loaded the blob, and every one came back to its saved
value. My first hypothesis, that the group survived by never being cleared, is **wrong** and is
recorded as wrong. What *is* true is that with `blob.traversal` blanked the live traversal is
silently inherited rather than reset, and no shipped instrument sees it.

---

## 5. Is the manifest agreement, or accommodation?

**Mostly agreement, with one structural exemption that is exactly where the purse fell through.**

`rules.dynamic_containers` declares 20 paths to be **leaves** for M4's set difference, and six of
them are this repair's own additions: `fight.player`, `fight.player_ctl`, `crime.bounty`,
`crime.zones`, `world.capture`, `progression.sap_taint`. The declaration is honest — the note
says so and points at `getDurableFieldCensus()` as the check that looks inside. But it means the
check the item calls *completeness* does not look inside the combat body at all, and the census
that is supposed to cover it walks `sim.*` and the bodies and not `engine.combat.world`.

I looked for the falsification pattern the item names — *"a field quietly moved to `volatile` to
make the diff pass"* (`RI-MTH04`, `How we lose` #8) — and **did not find it.** The volatile list
is unchanged from `RI-JRN05` §B: `written_at`, playtime, thumbnail, UI focus, audio, frame index.
Nothing was moved onto it. The manifest additions are genuine requirements restated, not a
description of the code, with one exception: `progression.gold` restates §B's Progression row
against a register the game does not spend from, which is `How we lose` **#7** — *"the manifest
is written after the code"* — in its subtler form.

---

## 6. `save-break.mjs` — do the three rewritten breaks take?

**Yes. I re-ran the builder's falsifier unmodified: 8/8, `baseline_clean: true`, `applied: true`
on every break, in a single run rather than the two the builder needed.**

The three that "failed to take" in round 2 all take in their rewritten form, and each rewrite
names honestly why the first version could not have taken:

* `creation-terms` blanked two arrays that are already empty on `arena_flat` (no character ships
  in that state) — it now creates a character first, and carries **its own observer**, because
  blanking a field in the blob makes `save == load == blanked` and the round-trip diff can never
  see it. That observer is the sharpest single piece of evidence in the repair.
* `no-body-grid` nudged 1e-9, three orders below the declared 6-dp grid, so `r6()` rounded it
  back — now 4.9e-7, just under half a grid cell.
* `no-stamp-rebase` guarded on `stamp > 0` when every stamp had expired — now unconditional.

**I found no break rewritten to make itself pass.** What I found instead is what the eight breaks
do not cover, which is §3's table: a repair can be deleted and every shipped instrument stay
green.

---

## 7. The two uncoupled CONSUMPTION rows — probe defects, or real?

* **C1 (the cast refused because teleport never grounds the body): probe defect, and the
  underlying coupling is real.** The builder establishes it independently through
  `save-break --only creation-terms`: with the fix deleted, `drawbacks_after_load 0`,
  `dry_well_drawback_alive false`, `focus_max 30`; with it present, `1`, `true`, `48`. That is
  seam **S27** — the Dry Well takes the hearth rest's Focus refill — restored across a load, on a
  defect the round-trip hash could never see. I re-ran the break; it holds.

  **But the probe defect is not only a probe defect.** The reason `teleport()` leaves the body
  airborne is worth its own finding (§8), and it interacts with the save.

* **C3 (the guard with line of sight overwriting the restored `lkp`): probe defect.** Confirmed
  by a different route: my `no-lkp` break blanks `lkp` and `last_seen_ago_frames` out of the blob
  and `getDurableFieldCensus()` **goes red**, and the live entity records change. The field is
  carried and consumed; the probe's guard simply had eyes on the player.

---

## 8. Secondary — a save taken in mid-air is lethal

Falling 40 m from `default`, three seeds, both arm orders, **6/6**:

| | mid-fall | just after | on landing |
|---|---|---|---|
| control, never saved | airborne `true`, vel 2.126 | airborne `true`, vel 2.126 | **hp 620 — alive** |
| saved and loaded mid-air | airborne `true`, vel 2.126 | airborne **`false`**, vel **0**, peak **0** | **hp 0 — dead** |

`Engine._buildCombat` constructs a fresh `MagicSystem` on every load, and `magic.airborne`,
`magic.fall.velMps` and `magic.peakY` are a **second fall model** that is on no manifest row at
all. The Traversal group carries `airborne`, `vy` and `apex_y`; the model that actually resolves
the landing does not.

**The post-load trace is byte-identical in both arms**, because the trace carries neither
`magic.fall` nor `combat.world.gold`. M5 cannot see either of this verdict's two largest defects.

---

## 9. Scenario contamination across `loadState('<name>')`

Three of five province scenarios failed my instrument's reproducibility control: two identical
pre-rolls, no save and no load between them, produced different player positions — and for
`mid-fall`, a live player in one repeat and a corpse in the other. `loadState('<name>')` does not
clear the fall model, and the previous scenario's airborne state leaks in.

This is the same family the repair itself found and closed for `sim.captured` (*"a scenario that
ran after a capture inherited it"*). It is not closed for the fall model. **Any critic running
two arms in one page on a province state is measuring contamination unless it checks** — which is
why my tool checks, and why I report those three as `unmeasurable` rather than as save defects.

---

## 10. What the repair got right

Recorded because the item is capped at 2 and the work is much better than 2 reads.

* **Nine scenarios × ten seeds clean**, including three moments the builder's own pre-roll never
  reaches: a save inside an active hitbox window, a save mid-cast with resources already charged,
  and a save with the guard raised and held. 1,239–1,530 live leaves compared per trial, zero
  differing, zero unrebased stamps, byte-identical traces.
* **M3 — which the builder never ran** and `state-diff.mjs` cannot run, being entirely warm-path.
  `writeSave` → real `page.reload()` → `readSave`: hash **equal on 4/4 states**, backend
  `indexeddb`, `listSaveSlots()` honest, `save_read` emitted with `degraded: false`, 42 journal
  entries carried through on `sv5`.
* **The schema bump is real and refuses before it mutates.** `SAVE_SCHEMA_VERSION` 2;
  `state.js:477–492` throws a legible line for both a future and a past schema before touching the
  sim. The `HF3` silent-partial-load risk is closed on the paths I read.
* **The traversal restore works**, verified by perturb-then-load rather than by trusting the diff.
* **8/8 on the builder's own falsifier**, re-run by me.
* `GAP-W1-platform-save-drops-entity-prev-state` is **closed**: `entities[].prev_state` is carried
  and the post-load trace does not diverge, on 90/90 trials.

---

## Score

| Ladder | 0 | 2 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| `RI-JRN05` native | unmeasurable | **any hard fail, or < 60** | < 60 | 60–89 | 90–99 |

Aggregation: **min over the item's blocks**, with §1.1's hard-fail cap applied on top.

`HF1` is triggered twice over — an M1 round-trip hash mismatch on 24 of 36 death-window trials,
and an M5 post-load trace divergence with it. **`score_0_10: 2`, `status: FAIL`.**
`AR-1` passes. `AR-2` fails on S6 and on `ARBITRATION` §1's non-lethal exit.
`AR-3`: not sterile — `seam_sterile: false`; this piece carries live crossings, and two of them
are where it fails.

`why_not_ten`, `path_to_ten` and `ten_by_wave` are in the JSON.

---

## Instruments written for this verdict (`method_deviations`)

| Tool | What it does |
|---|---|
| `tools/journey/save-live-audit.mjs` | The round trip measured on the **live world** through ~30 public getters, never on the blob. Two arms plus a reproducibility control; dual absolute/frame-relative leaf comparison instead of an exclusion list; ten pre-rolls the builder's does not reach. |
| `tools/harness/save-consume-critic.mjs` | Independent CONSUMPTION: the purse, the fall, the death window (run through the **builder's own** `saveRoundTrip()` so the headline cannot be blamed on me), and the identity-value audit. |
| `tools/harness/save-break-critic.mjs` | Four breaks the builder's falsifier does not contain, each asking **which shipped instrument notices**. This is what found the purse. |

All three are in `tools/` and copied into
`corpus/90-verdicts/wave1/artifacts/W1-SAVE-r1/`.

**Nine of the item's nineteen methods were not run** (M6, M7, M9, M11, M13, M14, M15, M18, M19;
M12/M16/M17 in part) for wall clock on a shared four-core box. Every one is recorded
`unmeasurable` and fail-closed. None of them would raise the score, which is already capped.

---

## Build state

Measured against the working tree at `b27373f` with other agents' uncommitted edits present.
`git diff` over `game/src/engine.js`, `game/src/save/**`, `game/data/save-manifest.json` and
`tools/journey/state-diff.mjs` at the end of the run showed a single change — +125 lines in
`engine.js`, all of it W1-07 round 4's quest-offer disposition model, none of it on the save or
load path. `boot-check.mjs` passed before measuring; the 90-trial sweep recorded zero page errors.

## Corpus debt found

`RI-JRN05`'s ladder anchor block is Form B (a `Ladder ceiling` column) covering **8 / 6 / 5 / 4**.
Its own `## Scoring` section defines nine hard fails that cap the item at **2**, and this verdict
lands there. `SCORING.md` §1.2b requires any item that can produce a score below its ladder-4
anchor to extend its row to cover the **0** and **2** rungs. `RI-JRN05` does not. I read the cap
off the item's hard-fail clause rather than off its anchor row, which is the thing §1.2b was
written to stop a critic having to do. Filed as debt against the item's owner rather than as a
correction written here.
