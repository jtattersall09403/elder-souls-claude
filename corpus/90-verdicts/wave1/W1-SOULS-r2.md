# W1-SOULS — round 2 verdict

**Piece:** the soul economy — the source (`game/src/sim/souls.js`), the derivation
(`tools/progression/derive-soul-values.mjs`), the per-archetype values
(`game/data/combat/enemies/*.json`), the hazard death path (`game/src/sim/hazards.js`) and the
instrument (`tools/progression/souls-consumption.mjs`).
**Reference items:** `RI-PRG06` (yield and pace), `RI-PRG01` (the curve), `RI-PRG02` §2 (the bought
attribute stream). **Seams:** S2, S5, S6, S9, S15. **Doctrine:** `ARBITRATION.md` §3 (CONSUMPTION),
`RI-MTH04`, `RI-MTH07`.
**Judged against:** `corpus/90-verdicts/wave1/W1-SOULS-r1.md` (RETURNED at 5/10) and
`orchestration/status/W1-SOULS-r2.json`.

**Score: 6 / 10 — PASS at the floor, named remedy required. Read it as PROVISIONAL.** Aggregation
is `RI-PRG06`'s own: min-over-axes. Pass floor is 6.

*Provisional, and this is not a hedge.* The piece passes on every axis that can be measured today.
Four of `RI-PRG06`'s eight axes — the region-1 assertion, the all-region levels, the Monte Carlo
sim and the pace curve — need a world holding at least 891 of its 1,230 hostiles, and 269 are
placed. The piece's own `--census` fails closed on exactly that and is right to. Re-open when
`W1-POPULATION` and the enemy-roster piece put bodies past the band floor; nothing in the two hard
fails below waits on that.

---

## The one-paragraph summary

Round 2 did the eight things the round-1 verdict told it to do, and it did seven of them well. The
central charge is answered: **arm K kills a live `inf_trash` with forty-two latched `light` swings
and no harness kill verb anywhere**, the sentry dies on frame 1421, and the suite that had twelve
arms none of which landed a hit now has fifteen of which three are a real fight, a real hazard and
a real respawn cycle, each carrying its own control. The re-anchor is not a re-fit and I checked it
the hard way: I recomputed all eighteen of `RI-PRG06` §2's band rows from §3's roster **in the
markdown**, not from the JSON the tool reads, and all eighteen are the min and max of the region's
own values, with all six region totals reconciling. The bands really do scale as arithmetic. And
the number the piece was returned on is closed to the digit — round 1's projected 2,400,817 souls
times the §7 factor is **1,124,285**, which is `RI-PRG06` §1's contract exactly, L93, with
`souls_for_L120 / world_total = 2.128` against the item's stated target of 2.13.

It is not clean, and two of the three reasons are the same reason. **`SoulsSystem._alive` is keyed
on the eid and nothing in the build is authorised to clear it.** That has a face pointing at every
probe in this tree and a face pointing at every player. Round 2 found the first face itself — its
epoch gate took its own suite from 15/15 to 8/15 — and fixed its own instrument with unique tags
rather than fixing the boundary, so `loadState('<named>')`, the scenario boundary every probe here
uses, still does not clear the observer: I measured the same fight paying **+384 then +0** across
it with zero rests. The second face is live in the shipped world: a road post the player only
*partly* cleared is released as `DORMANT` and re-materialised under the **same tag**, so its
corpses' eids come back on live, full-HP, hostile bodies. I killed five of six, walked the post
away and back, and killed the same five again for **zero souls** while the sixth — which happened
not to have died the first time — paid 64. `RI-PRG06` §4's row is *"Respawned enemy ×1.00"*.

The third reason is the one the brief asked about and it is not an engineering defect. The
re-anchor's *band* step is derived. Its *anchor* step is not. `12,665 / 93 = 136.18` is the mean
over all ninety-three region-1 bodies, of which one boss and two minibosses are 36% of the souls,
and it is pinned to a **trash** statblock at premium 1.0. §3's own R1 trash mean is 89.61 — a
factor of 1.52 — and the consequence lands on the item's zero row, measured below.

---

## What I ran

Every browser figure below is a frame count at a fixed 60 Hz, a soul count, a level or a boolean.
**No wall-clock number is published**, because `pgrep -c headless_shell` was **24–30** and
`loadavg` **14.8–23.7** through every browser run — well above the protocol cap of 8. The offline
arms were taken at loadavg 1.01 with no browsers running.

| Command | Exit | Artifact |
|---|---|---|
| `node tools/harness/boot-check.mjs` | 0 | PASS, before and after |
| `node tools/check-data.mjs` / `check-content.mjs` / `check-quests.mjs` | 0 / 0 / 0 | — |
| `node tools/progression/derive-soul-values.mjs --check` | 0 | clean |
| `…--check --strict` | 1 | four roster gaps, deliberate |
| `…--census` | 1 | fail-closed at 269 of 891 |
| `node tools/progression/souls-consumption.mjs` (theirs, re-run by me) | 0 | **15/15, 0 unfalsifiable** |
| `node tools/progression/critic-souls-r1.mjs` (the round-1 critic's, re-run) | 1 | 5/8 — **K5 now green**, K3/K6/K7 stale |
| `node tools/progression/critic-souls-r2.mjs` (mine) | 1 | 3/11 — `reports/critic-souls-r2.json` |

**The tree, stamped.** Measurements were taken across `88ee56d → a5a637d`. `git diff` on that
range touches no soul source, no enemy statblock, no `RI-PRG06` file, no `constants.json` and no
world data — only a neighbour's audio work — so every number here is a claim about a5a637d. A
neighbour swept my instrument and my screenshot into `a5a637d`; **I did not commit.**

---

## What round 2 got right, and it is most of it

All eight items of the round-1 path to ten were delivered. Six of them I verified independently
rather than taking the status file's word for:

- **The re-anchor (1).** `K = 0.102646`, `inf_trash` 136 → 64, exactly the verdict's predictions.
  The values are now read out of `constants.json` and `RI-PRG06-souls-yield.json` at run time and
  nothing is typed by hand; a census amendment moves the roster by re-running the tool.
- **The hazard path (2).** Arm L is the fix *and its own control, same function, same hazard, same
  body*: with the `CombatSystem` passed, body hp 40 → 0, dead, souls +64; without it — which is
  byte-for-byte the pre-fix write to the mirror — the entity's hp reads 0 and is **back at 40 four
  frames later**. The corpse resurrecting is a live control now instead of a description.
- **The rest-epoch gate (3).** Confirmed twice, once by an instrument written *before* the fix
  existed: the round-1 critic's `K5` used to read `+816, +816, +816` and now reads
  **`+384, +0, +0` with the same eids reused and zero rests**. That is the cleanest possible
  evidence that the gate is real.
- **De-vacuuming B, D and I (4).** I read the predicates rather than the claim. `B` now filters
  skipped kills and requires `bReal.length > 0`; `D` requires `!!D.kill && !D.kill.skipped`; `I`
  requires `!I.the_kill.skipped && I.the_kill.delta > 0`. Each is exactly the clause the verdict
  named. The suite also carries a real unfalsifiability gate that fails the run if A passes while
  the ablation does not go red, or if the day and night arms agree, or if a control behaves like
  its treatment.
- **A real fight (5).** Arm K, above. `1421` frames — the same count the round-1 critic measured,
  so the fight is unchanged by the re-derivation and only the payout moved.
- **The death-path list (8).** I checked the one claim a header can get wrong: `stepPlayer` is
  exported from `sim/player.js` and imported by nothing. Dead, as stated. The rewritten
  six-entry list matches the step order.

**And the headline number is closed.** Round 1's charge was arithmetic and so is its closure:

| | round 1 | round 2 | `RI-PRG06` §1 |
|---|---:|---:|---:|
| projected world total | 2,400,817 | **1,124,285** | 1,124,285 |
| first-clear level | **120** | **93** | 93 |
| `souls_for_L120 / world_total` | 1.00 | **2.128** | 2.13 (band 1.8–2.6) |

`RI-PRG06`'s L120-guard axis moves from its zero row to its ten row.

---

## The findings

### HF-1 — `_alive` is keyed on the eid and nothing may clear it: the scenario boundary *(measured)*

Round 2's own status file contains the sentence **"ANY probe in this tree that recycles an
encounter is doing the same thing."** It is right, and it then fixed only its own instrument, by
passing a unique `opts.tag` per fight. Tagging is a workaround at the call site. The boundary is
where the class lives.

`loadState('<named>')` → `applyNamedState()` → `sim.reset()`. That empties `sim.entities`, and the
engine re-seeds two subsystems immediately afterwards *for exactly this reason*, with the comment
still in the file:

> `sim.reset()` empties `sim.entities`, so every eid the population system was holding is already
> gone … `if (this.population) this.population.reset();`

`sim.souls` is not in that list. The blob path at `engine.js:5926` does clear it, and says why in
eight lines of comment. The named path does not. Measured, `critic-souls-r2` arm C4:

```
pass 1  (fresh boot, untagged fight)          souls +384   6 eids
loadState('arena_flat')                       entities = 0
pass 2  (the same fight, across the boundary) souls +0     same eids: true   refused re-arms 12
pass 3  (boundary + sim.souls.reset())        souls +384
pass 4  (boundary + a unique tag)             souls +384
```

Pass 3 is the remedy, applied through `window.__ENGINE` rather than by editing source, and it is
one line. Pass 4 is what round 2 did instead, and it works only for code that remembers to do it.

**This is not hypothetical damage; it has already landed.** Re-running
`tools/progression/critic-souls-r1.mjs` — the round-1 critic's instrument, listed in `INDEX.md` —
gives 5/8 with three failures that are *not* defects in the build: `K3` writes `ent.hp = 0` on a
`sim.entities` record, which is what `hazards.js` used to do and no longer does; `K6` and `K7`
replay round-1 predicates that round 2 replaced. The round-1 verdict told round 2 that "`K1` is 30
lines and can be lifted wholesale". It was lifted, and the original was left in the tree reporting
three false reds at anyone who runs it.

### HF-2 — the same key, pointing at the player: a partly-cleared post pays nothing *(measured)*

`game/src/world/population.js` is unambiguous, and its own comments state the intent:

- step (2) marks a post `CLEARED` only when **every** body is down — *"walking away and coming back
  is not a respawn, resting is"*;
- step (3) releases anything past `release_radius_m` and sets a **non-cleared** post `DORMANT`;
- step (4) re-materialises a `DORMANT` post with `{ tag: p.id }` — the post id, **stable by
  construction**, which is precisely what makes the eids repeat.

So a post the player *partly* cleared comes back with its corpses' eids attached to live, full-HP,
hostile bodies. The souls observer still has those eids recorded as dead-and-paid at the current
epoch, so it refuses the re-arm and never pays for them again. Measured, arm C5, driving
`spawnEncounter` with the same stable tag `_materialise()` uses:

```
first visit    killed 5 of 6, paid +320
released       0 entities left
returned       same tag -> same eids: true;  6 alive, 5 of them recycled eids, full hp
second visit   killing those 5 live hostiles paid  +0
               the one body never killed before paid  +64
```

The fight is real, the bodies are real, the danger is real, and the reward is zero. `RI-PRG06` §4's
modifier row reads **"Respawned enemy — ×1.00 — unchanged"**; this is ×0.00 until the player
happens to rest. Round 1 charged the opposite error (an unlimited farm) and round 2 over-corrected
past the design into an under-payment. Note that `PopulationSystem`'s own `CLEARED` state already
prevents the farm the gate was written for, so the gate is belt-and-braces that mis-fires: the
correct key is the **body**, not the eid — `paidEpoch` should be stamped alongside something that
identifies the corpse (its spawn generation), or the re-arm should key on "this body is at full HP
and was not the one I paid for".

**The picture** is this finding: `docs/shots/2026-08-07-w1-souls-critic-r2-five-live-enemies-worth-nothing.png`
— the sapwell screen after killing five live enemies. *Souls held ◇ 0. To the next 418. "Not
enough souls yet. Come back."*

### F-3 — the band rescale is derived; the anchor it rests on is not *(measured)*

This was the brief's first question and the answer is split.

**The band step is arithmetic, and it survives a harder test than the one round 2 ran.** The
shipped tool reads `RI-PRG06-souls-yield.json`. I recomputed §2's bands from §3's roster **in the
markdown**, with no reference to the JSON, and compared all eighteen band rows plus all six region
totals (`critic-souls-r2` arm C1a):

```
24 rows checked, 0 mismatch — every §2 band is the min/max of §3's own roster,
and every region's count x value reconciles to §1's Region-souls column
```

The claim holds, the JSON and the markdown agree on every row (C1c), and the inference — a rule
that rescales §3's values rescales §2's bands by the same factor — is sound. **The tool guards one
of those twenty-four rows** (a hard-coded `PUBLISHED_R1_TRASH = [35, 190]`). The other twenty-three
can drift between §2, §3 and the JSON with nothing red, which is the check-not-constructor rule
applied only once.

**The anchor step is a judgement wearing a derivation's clothes.** `derive-soul-values.mjs` prints:

```
anchor inf_trash -> 63.77 souls = RI-PRG06 §1's R1 mean kill (12665/93)
```

`12,665 / 93` is the mean over **all** ninety-three region-1 bodies. One boss at 3,000 and two
minibosses at 700 and 900 are **4,600 of those 12,665 — 36% of the region's souls from 3% of its
bodies.** It is then pinned to `inf_trash`, which is `tier: "trash"` and carries
`TIER_PREMIUM 1.0`. §3's own R1 **trash** mean is `8,065 / 90 = 89.61`. The ratio is **1.520**, and
it multiplies every trash value in the game before the tier premium — which round 2 correctly
records as already double-counting mass — is applied on top.

### F-4 — and the consequence is on `RI-PRG06`'s zero row *(measured)*

The anchor is a claim about a quantity, so I measured the quantity. The placed danger-tier-1
roster is 15 bodies paying 570 souls — **a mean kill of 38.00**.

| | souls/kill | R1 at §7's 199 bodies | level | `RI-PRG06` method 1 |
|---|---:|---:|---:|---|
| the anchor, as used | 63.77 | 12,691 | **14** | ✓ target |
| §3's R1 **trash** mean, §7-scaled | 41.96 | 8,350 | 11 | edge of the 0 row |
| **the placed tier-1 roster** | **38.00** | **7,562** | **10** | **0 — "level outside 11–17"** |

Two things follow, and the second is the useful one.

First, the *trash* is well calibrated: 38.00 against §3's own scaled trash mean of 41.96 is 9%
low, and `--check` confirms all three tier-1 statblocks sit inside the scaled R1 band. **Region 1
is not short because its trash is mispriced. It is short because it has no boss.** Both shipped
elites are fog gates at danger tiers 2 and 5; danger tier 1 has no boss and no miniboss at all, and
that is where 36% of §1's region-1 souls live.

Second, **no mode of any tool asserts this.** `--check` is a per-value *range* test — 38 and 63.77
are both legal members of R1's band, so a 1.68× error in the region's mean passes it silently. The
mode that would catch it, `--census`, is fail-closed at 269 of 891 world bodies and therefore says
nothing about region 1, whose own shortfall is already fully visible at 15 bodies. Round 2 was
right to fail closed on the *world* contract. It was not obliged to be silent about a region.

### F-5 — the census scale is keyed to a plan, and the guard lifts exactly when it starts to lie

`CENSUS_SCALE = progression.roster_derivation_n / world.enemy_census = 576 / 1230`. `enemy_census`
is `RI-WLD07`'s **planning** figure. 269 bodies are placed. Nothing anywhere binds the denominator
to the count, so **the derivation is invariant to the population builder landing** — the values
move only when a human edits `constants.json` and remembers to re-run the tool.

That is tolerable while `--census` refuses to assert. It stops being tolerable at the moment it
starts, and the arithmetic is unkind (arm C2):

| bodies placed | the §7 scale for that N | the scale shipped values carry | error |
|---:|---:|---:|---:|
| 269 (today) | 2.1413 | 0.4683 | −78% |
| **891** (the band floor — where `--census` **starts asserting**) | **0.6465** | 0.4683 | **−28%** |
| 1,230 (the adopted census) | 0.4683 | 0.4683 | 0% |
| 1,569 (the band ceiling) | 0.3671 | 0.4683 | +28% |

The fail-closed guard is `bodies < 891`. At 891 placed bodies it opens and asserts methods 1 and 2
against values carrying a 28% scale error, with nothing red. `--census` should assert *the scale's
own premise* — that `world.enemy_census` is within some tolerance of what is placed, or that the
derivation was last run at the census now on disk — before it asserts anything derived from it.

### F-6 — the L120 guard is printed and never asserted

`--census` emits, in **both** branches:

```js
console.log(`  L120 guard  cum(120) = ${…}; a 100% clear reaches L${world.level}, and RI-PRG06 §1 forbids L120…`);
```

There is no comparison and no failure path. `RI-PRG06` method 10 asks for
`souls_for_L120 / world_total ∈ [1.8, 2.6]`; on the placed world that ratio is **110.4**, and on
the projection it is the 2.128 this piece deserves credit for. Neither number is checked by
anything. **This is the axis round 1 returned the piece on**, and the fix moved the number without
arming the tripwire that would notice it moving back.

### F-7 — `RI-PRG06` method 6 has no instrument, and the item fails it five times out of five

Round 2's F-5 remedy — bind each value to the band of the region it is placed in — is built on §2's
bands. §2 states its own purpose: *"the bands are deliberately non-overlapping at the edges so that
'am I in the right region' is answerable from a single kill"*, and method 6 caps adjacent overlap
at 25% of the lower band's width. Measured from §2 as published (arm C7):

| pair | overlap | % of the lower band's width |
|---|---:|---:|
| R1 35–190 / R2 140–520 | 50 | **32.3%** |
| R2 140–520 / R3 330–1,250 | 190 | **50.0%** |
| R3 330–1,250 / R4 760–2,600 | 490 | **53.3%** |
| R4 760–2,600 / R5 1,200–4,200 | 1,400 | **76.1%** |
| R5 1,200–4,200 / R6 2,100–6,200 | 2,100 | **70.0%** |

The percentages are scale-invariant, so §7 neither causes nor cures this. **This is a corpus defect
and I am not charging it to the piece** — it is filed as an arbitration question below. But it
belongs in this verdict for two reasons: the piece's new region binding rests on these bands, and
method 6 has never had an instrument in this tree, which is why nobody noticed that §2's central
claim about itself is false.

### Clean, and worth saying so

- **CONSUMPTION** is unchanged and still three layers deep: `sim/souls.js` → `soulsHeld` →
  `_spendSouls()` → `vigour` → derived pools → combat body `hp_max` 196 → 222 → a 210-point blow
  that kills at the old ceiling and leaves 12 hp at the new. Arms G1/G2/G3 hold.
- **S9.** Arm E: the same kill pays 64 at level 1 and 64 at level 90. Nothing in `souls.js` reads
  level, playtime or clear count. No AR-1.
- **S15.** Arm J: zero of ten kills moved gold; ten `souls_awarded` events all declaring
  `gold_awarded: 0`. The known `fenceSell` two-purse defect is untouched and not made worse.
- **Props.** Fifteen at zero; the 99,999-hp dummy pays nothing, and arm D can no longer pass by
  failing to spawn it.
- **Night.** ×1.35 at 23:00 and 03:00, ×1.00 at 14:00 and 20:59 — the edge case is tested.
- **The `--strict` and `--census` modes are the placeholder round 1 asked for**, they fail closed
  with stated reasons, and neither is wired into a project gate, which is the right call while the
  world is a quarter built.
- **The §8 filing** of the TTK tension is well done: it names the three figures, names who owns
  each, and explicitly refuses the fourth option of leaving the pace table as the answer.
- **Honesty.** The status file reports its own instrument failing first and being wrong before the
  world was, reports a neighbour staging its delete-the-fix into the index, and hands
  `population-posts.json`'s now-stale cached `souls` to W1-POPULATION rather than editing their
  file. That is the standard.

---

## Arbitration

- **AR-1 (Morrowind into the fight):** clear. No level scaling, no dice in the award, no to-hit.
  Arm E is a byte-level check at level 1 and level 90.
- **AR-2 (Souls into the world):** clear. Souls buy a level and nothing else; gold untouched.
- **AR-3 (seam sterility):** `seam_sterile: false`, unchanged and correct — the piece *is* seam S2,
  and the night multiplier makes the Morrowind world clock change a Souls reward. Round 2 adds a
  second real crossing: the S5 rest epoch now reaches the reward, which is `RI-PRG04` §2 arriving
  in `RI-PRG06` §4.
- **CONSUMPTION (`RI-MTH07`):** satisfied. Named consumer chain, perturbed four ways, and the
  builder's delete-the-fix leg takes the suite to 3/15.

---

## Biggest remaining gap

**`GAP-W1-SOULS-02` — `SoulsSystem._alive` is keyed on the eid, and nothing in the build is
authorised to clear it. That is one bug with two faces: every probe in this tree, and every
player.**

The probe face is measured in HF-1 (`+384` then `+0` across `loadState('arena_flat')`, twelve
refused re-arms, zero rests) and has already cost one instrument in the tree three false reds. The
player face is measured in HF-2 (five live, full-HP, hostile bodies worth zero souls after a
partly-cleared road post is released and re-materialised under its stable tag).

*Remedy, and it is two lines and a rethink.*

1. In `engine.js applyNamedState()`, beside the two identical lines already there:
   ```js
   if (this.sim.souls) this.sim.souls.reset();   // the same per-session observation as stealth and population
   ```
   Round 2's tagging is then belt-and-braces rather than the mechanism, and no future probe has to
   remember anything.
2. In `sim/souls.js`, stop keying the gate on the eid alone. A recycled eid attached to a body at
   full HP that the observer last saw as a corpse is a **new body**, not the old one refusing to
   stay dead: `spawnEncounter` should stamp a spawn generation on the entity and `_alive` should
   record `{ alive, paidEpoch, gen }`, re-arming when `gen` moves *or* the rest epoch moves. That
   keeps HF-3's farm shut (a rest is still what respawns a corpse) while restoring `RI-PRG06` §4's
   ×1.00 to a body that was genuinely built again.

*Acceptance.* Two arms in `souls-consumption.mjs`, neither of which can pass without the other
failing under a delete-the-fix: **(a)** an untagged fight, killed, crossed over
`loadState('<named>')`, killed again, must pay both times; **(b)** a post with `n` bodies, `n−1`
killed, despawned wholesale and re-spawned under the *same* tag, must pay for all `n−1` of the
recycled bodies on the second visit **and** must still pay nothing for a body that was never
despawned and never rested past. `tools/progression/critic-souls-r2.mjs` arms C4 and C5 are those
two arms and can be lifted wholesale.

---

## Path to ten

1. **Close `GAP-W1-SOULS-02`** — the boundary line and the spawn generation. Non-negotiable; one
   half is a live payment defect and the other is a measurement-integrity hazard for the whole
   project.
2. **Arm the L120 guard** (F-6). `--census` prints method 10 and asserts nothing. Assert
   `souls_for_L120 / world_total ∈ [1.8, 2.6]` in the asserting branch and report it with a stated
   reason in the fail-closed one. This is the axis the piece was returned on.
3. **Assert the scale's own premise** (F-5). Before `--census` asserts anything derived from
   `world.enemy_census`, assert that the census is consistent with what is placed — or fail with
   "the values on disk were derived at N = 1,230 and 891 bodies are placed; re-run `--write`". The
   guard currently opens at exactly the count where the error is 28%.
4. **Re-derive the anchor, or rename it** (F-3, F-4). Either pin `K` to §3's R1 **trash** mean
   (89.61 × 0.4683 = 41.96) and let `TIER_PREMIUM` carry the set pieces — which is what the model
   says it does — or keep 136.18 and stop calling `inf_trash` "the R1 mean kill", and say in the
   header that trash carries a deliberate 1.52× because the region's bosses are not built yet. The
   first is right; the second is at least honest. Then add a **mean** assertion beside the range
   assertion: `--check --region 1` should fail when the placed tier-1 roster's mean kill is more
   than ±15% from the anchor. That is the check that would have caught this in one run.
5. **Guard the other 23 corpus rows** (F-3). `PUBLISHED_R1_TRASH` is one row of twenty-four.
   Assert all eighteen band rows and all six region totals against `RI-PRG06`'s markdown, in
   `tools/check-*.mjs` where content integrity belongs, so a corpus edit to §2 or §3 is caught
   rather than absorbed.
6. **Retire or repair `tools/progression/critic-souls-r1.mjs`.** `K5` is now valuable evidence that
   the gate works and should stay; `K3`, `K6` and `K7` test code shapes this round replaced and
   report three false reds. A tool that cannot fail is worse than no probe; so is one that fails
   for reasons that no longer exist.
7. **Build region 1 a boss** — or file that it has none. F-4's shortfall is 36% of §1's region-1
   souls sitting in set pieces that danger tier 1 does not have. That is the enemy-roster piece's
   work, and the soul economy should say so in the same place it says the four roster gaps.
8. **File method 6** (F-7) as an arbitration question against `RI-PRG06`, and give it an
   instrument. `critic-souls-r2.mjs` arm C7 is eight lines.

---

## Arbitration questions

**AQ-1 — `RI-PRG06` §2 contradicts its own method 6, and the contradiction is load-bearing.**
§2 says the bands are "deliberately non-overlapping at the edges so that 'am I in the right region'
is answerable from a single kill". Method 6 caps adjacent trash-band overlap at 25% of the lower
band's width. The published bands overlap by 32.3%, 50.0%, 53.3%, 76.1% and 70.0%. Since §2's bands
are exactly the min and max of §3's roster (proved above), the two cannot be reconciled without
moving §3's values — which §7 froze, and which §1's cumulative column depends on. Somebody must
rule on whether §2's separation claim, method 6's threshold, or §3's spread yields. This blocks
nothing today and will block the enemy-roster piece the moment it builds a tier-appropriate body.

**AQ-2 — is `world.enemy_census` a plan or a measurement?** The soul values are derived from it as
though it were a fact about the shipped world; `--census` treats the shipped world as the thing
being tested against it. Both cannot be true. `RI-WLD07` owns the number and should say which.

---

## Method deviations

- **I wrote a tool mid-critique**, per `TOOL-LOOP` rule 1, and declare it here:
  `tools/progression/critic-souls-r2.mjs` — seven arms covering the band derivation recomputed
  from the item's markdown, the census scale's provenance, the anchor's semantics, method 6's
  separation, the named-state boundary, the partly-cleared post, and its own self-break (`C6`:
  six bodies spawned and stepped for sixty frames with nothing killed must report zero souls — it
  does). Its two live arms carry controls in both directions: `C4` pass 3 and pass 4 show the
  remedy and round 2's workaround both restoring payment; `C5` contrasts a recycled body with a
  never-killed one in the same encounter on the same frame.
- **My instrument was wrong before the world was, and it cost me a run.** The scan is *lazily
  seeded*: a body already dead the first time the scan looks at it is recorded as settled and never
  paid. My first C4/C5 pass killed within the spawn frame and read `+0` everywhere — it was
  measuring the seeding rule, not the gate. Fixed with `stepFrames(2)` after every spawn, and the
  note is now in the tool so the next person does not pay for it.
- **I edited no game source.** The one-line remedy in HF-1 is demonstrated through
  `window.__ENGINE.sim.souls.reset()` — the back door `INDEX.md` names — rather than by patching
  `engine.js` on a shared tree. Nothing of mine is staged; `git status` shows one modified path and
  it is a neighbour's.
- **Contention, declared.** `pgrep -c headless_shell` 24–30 and `loadavg` 14.8–23.7 for every
  browser run; loadavg 1.01 and no browsers for the offline arms. No wall-clock figure is published
  anywhere in this verdict. One browser per tool invocation, closed after; the photograph was taken
  inside a run that already had the world open, per `AGENT-PROTOCOL` and S34(a) — it is evidence of
  a *screen*, not of arrival.
- **What I did not do.** I did not re-run the builder's delete-the-fix leg (3/15); I accepted it,
  because the in-suite ablation (arm B) is an independent test of the same coupling and it is green
  while arm A is green, which is the gate the suite itself enforces. I did not drive
  `PopulationSystem` end-to-end for HF-2 — I drove `spawnEncounter` with the same stable tag
  `_materialise()` passes, and read steps (2), (3) and (4) of `world/population.js` for the
  reachability. That is a code-read reachability argument on top of a measured mechanism, and I say
  so rather than implying I walked a player 260 metres and back.

---

## Evidence

```yaml
evidence:
  environment:
    node: v22.22.2
    boot_check: "PASS before and after"
    gates: { check-data: 0, check-content: 0, check-quests: 0 }
    headless_shell_concurrent: "0 for the offline arms; 24-30 for every browser run"
    loadavg: "1.01 offline; 14.79 -> 23.66 through the browser phase"
    git: { commit: a5a637d, range_measured_across: "88ee56d..a5a637d", souls_paths_unchanged_in_range: true, dirty: 1 }
  runs:
    - command: node tools/progression/souls-consumption.mjs --out reports/critic-r2-souls-consumption-INTACT.json
      exit: 0
      result: "15/15 arms, 0 unfalsifiable. K: 42 swings, frame 1421, souls 0 -> 64, 1 event, self-break control never kills. L: with the CombatSystem body hp 40 -> 0 souls +64; without it, entity hp 0 -> 40 four frames later, souls +0. M: +192, then +0, +0 across two despawn/respawn cycles with no rest, then +192 after one rest; 12 refused re-arms."
    - command: node tools/progression/critic-souls-r1.mjs --out reports/critic-r2-souls-r1-rerun.json
      exit: 1
      result: "5/8. K5 GREEN (+384, +0, +0, same eids, 0 rests) — the round-1 falsifier now confirms the fix. K3/K6/K7 red against code shapes round 2 replaced."
    - command: node tools/progression/critic-souls-r2.mjs --out reports/critic-souls-r2.json --shot docs/shots/2026-08-07-w1-souls-critic-r2-five-live-enemies-worth-nothing.png
      exit: 1
      result: "3/11. C1a, C1c, C6 pass; C1b, C2a, C2b, C3a, C3b, C7, C4, C5 fail."
    - command: node tools/progression/derive-soul-values.mjs --check / --check --strict / --census
      exit: "0 / 1 / 1"
      result: "clean; four roster gaps; fail-closed at 269 of 891"
  claims:
    - claim: "all 18 of RI-PRG06 §2's band rows are the min/max of §3's own MARKDOWN roster, and all six region totals reconcile"
      source: reports/critic-souls-r2.json
      json_path: arms.C1
      value: { rows_checked: 24, mismatches: 0, rows_guarded_by_the_shipped_tool: 1 }
    - claim: "the scale factor is keyed to a planning constant and the fail-closed guard opens at a 28% error"
      source: reports/critic-souls-r2.json
      json_path: arms.C2
      value: { placed_now: 269, band_floor: 891, scale_at_891: 0.6465, scale_shipped: 0.4683, error_pct: -27.6 }
    - claim: "the anchor equates the all-tier R1 mean with a trash statblock, a factor of 1.520"
      source: reports/critic-souls-r2.json
      json_path: arms.C3
      value: { r1_mean_all_tiers: 136.18, r1_mean_trash_only: 89.61, ratio: 1.520, anchor_used: 63.77, anchor_if_trash_mean: 41.96 }
    - claim: "the placed tier-1 roster's mean kill is 38.00, which at §7's 199-body region 1 is level 10 — RI-PRG06 method 1's zero row"
      source: reports/critic-souls-r2.json
      json_path: arms.C3.placed_tier1
      value: { bodies: 15, souls: 570, mean_kill: 38.00, projected_r1_souls: 7562, projected_level: 10, required: [13, 15], zero_row: "outside 11-17" }
    - claim: "loadState('<named>') does not clear the souls observer: the same fight pays +384 then +0"
      source: reports/critic-souls-r2.json
      json_path: arms.C4
      value: { pass1: 384, pass2: 0, same_eids: true, refused_rearms: 12, hearth_rests: 0, after_observer_reset: 384, with_unique_tag: 384 }
    - claim: "a partly-cleared post re-materialised under its stable tag gives live full-HP hostiles worth zero souls"
      source: reports/critic-souls-r2.json
      json_path: arms.C5
      value: { bodies: 6, killed_first_visit: 5, paid_first_visit: 320, same_eids: true, alive_on_return: 6, recycled_alive: 5, paid_second_visit: 0, paid_for_the_never_killed_body: 64 }
    - claim: "RI-PRG06 §2's adjacent trash bands overlap by 32-76% against method 6's 25% ceiling"
      source: reports/critic-souls-r2.json
      json_path: arms.C7
      value: { pairs_over_25pct: 5, of: 5, max_pct: 76.1, scale_invariant: true }
    - claim: "HF-1 is closed: round 1's projection x the §7 scale is RI-PRG06 §1's contract exactly"
      source: game/data/progression/levels.json + corpus/20-progression/RI-PRG06-souls-yield.json
      value: { r1_projection: 2400817, x_scale: 1124285, item_contract: 1124285, level: 93, l120_ratio: 2.128, target: 2.13 }
  unmeasured:
    - claim: "RI-PRG06 methods 1-4 and 10 against a POPULATED world"
      reason: "269 of the band's 891 hostiles are placed. --census fails closed and says so. The
        projections above are arithmetic onto constants.json's adopted census, not measurements."
    - claim: "HF-2 driven end-to-end through PopulationSystem's own release/re-materialise pump"
      reason: "I drove spawnEncounter with the same stable tag `_materialise()` passes and read
        world/population.js steps (2)-(4) for the reachability. Mechanism measured; reachability
        argued from source."
    - claim: "the builder's delete-the-fix leg (3/15) re-run independently"
      reason: "accepted rather than reproduced; the in-suite ablation (arm B) tests the same
        coupling and the suite's own unfalsifiability gate enforces that A cannot pass while B does."
    - claim: "boss and miniboss soul values as a TIER"
      reason: "unchanged from round 1 — no statblock carries tier `boss`, and the two `elite`
        bodies are fog gates at danger tiers 2 and 5. The premium 7.111/26.667 is exercised by two
        bodies, both of which --check --strict reports as out of band."
```
