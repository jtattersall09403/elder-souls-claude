# W1-SOULS round 3 — the soul economy: the census it stands on, the routes it was proved over, and the two guards that each measure inert

**Verdict: 6 / 10. FAIL against the wave-1 gate of 7.0. Return for round 4.**
Aggregation: min-over-axes, which is a property of `RI-PRG06`, not of me.
Measured at **`e97347f`**, branch `claude/morrowind-souls-threejs-game-mou39v`.
*(HEAD moved to `e8ccf31` while I was writing this up — a neighbour's `git add -A` swept my blog line and the
docs rebuild into `e37d327`. `git diff e97347f..HEAD` touches exactly one file under `game/`: additive harness
verbs in `game/src/harness/api.js`. No soul source, no statblock, no `RI-PRG06` file, no `levels.json` and no
`constants.json`. Every number below is still a true claim about the tree.)*

---

## 0. What this is, and a filename I did not use

My brief named `corpus/90-verdicts/wave1/W1-SOULS-r2.md` as my output. **That file already exists**
and belongs to `critic-w1-souls-r2`, which filed a complete 6/10 verdict on the round-2 build at
`a5a637d`. The piece has moved a round since: `orchestration/status/W1-SOULS-r3.json` is `complete`
and ungraded. I am not going to overwrite another critic's verdict to satisfy a stale filename
(RULES 16), so this is **`W1-SOULS-r3`** and it grades the round-3 build.

I am the successor to `critic-w1-souls` (round 1), which the container restart killed. Its status
file said its next step was "run the `-DELETED` counterpart, then write the verdict". On disk it had
already got further than it wrote down — `reports/critic-souls-consumption-DELETED.json`,
`reports/critic-souls-r1-DELETED.json` and `corpus/90-verdicts/wave1/W1-SOULS-r1.md` all exist. The
only thing round 1 never wrote was its `.json`, and two rounds have since superseded it, so I have
not back-filled it. **I have banked nothing my predecessor projected and did not watch land.** Every
number below is mine, taken at `e97347f`.

**Contention, declared (RULES 21).** `node tools/contention.mjs --gate` read **GO** when I started
(3 browser instances, 2.46 per core) and **WAIT** (5 instances, 6.37–6.68 per core over 4 cores)
from the moment I finished the offline arms. **I proceeded past exit 3**, because the mandatory
finishing step of my brief — CONSUMPTION and the delete-the-fix — cannot be taken offline. The
mitigation is total: **no wall-clock or millisecond figure appears anywhere in this verdict.** Every
number here is a soul count, a body count, a level, a route count, a percentage or a boolean.

**My instrument:** `tools/economy/critic-souls-r3.mjs` (+ `-chart.mjs`). Fresh context, shares no
code with `tools/progression/souls-consumption.mjs` or `souls-ledger-oracle.mjs`. Nine arms, each
with a control that must go the other way, and a `--self-break` gate that **fails the tool** if any
paying arm survives `sim.souls.enabled = false`.

---

## 1. The short version

Round 3 is the best round this piece has had. The defect class round 2 charged is **closed, and I
proved the closure by deleting it and watching the old number come back**. The "level 120 exactly"
signature that got round 1 returned is **gone, and gone for the right reason** — the curve is no
longer landing on a boundary. The doctrine line is airtight and I can show you every place I looked.
CONSUMPTION is real: all four values this economy declares have a named world-side consumer, and I
perturbed all four and watched the world move.

What holds it at 6 is not a live defect. It is that **the evidence is thinner than it reads**:

* the "343 routes" that anchor the class fix are **14 distinct behaviours**, driven against **one
  statblock at one hour**, and the exhaustive arm found **nothing at all**;
* **each of the two shipped guards measures inert on its own** — only deleting both moves the number;
* the values stand on a census of **1,230 planned** bodies against **269 placed**, and the world's own
  generated copy of those soul values is **53% adrift** from the statblocks this round rewrote, with
  nothing anywhere checking it;
* **four of `RI-PRG06`'s eleven comparison methods have no instrument anywhere in the tree.**

---

## 2. A — the census. Which one do the values assume, and is it still the truth?

**The values assume the planning census.** `tools/progression/derive-soul-values.mjs` reads
`world.enemy_census = 1230` out of `corpus/00-doctrine/constants.json` — which is `RI-WLD07`'s
*plan*, registered under §7's normalisation rule — and applies `576 / 1230 = 0.4683` to every
archetype. The anchor is `inf_trash` at **41.96**, derived from §3's R1 **trash** mean (89.61)
rather than §1's all-tier mean, which is round 3's correction and is worth 1.52×. That much is
sound and I re-derived it by hand.

**The world places 269.** Recomputed independently from
`game/data/world/population-posts.json` × `encounters.json` × the shipped statblocks:
**267 road bodies + 2 fog-gate bosses** (`champion_hist_marked` at the Drowned Xanmeer,
`cst_sap_speaker` at the Ceyatatar vault). `--census` reports exactly this and then **refuses to
assert methods 1, 2 and 10**, because 269 is below the adopted band floor of 891, and it prints its
reason rather than passing quietly on a quarter-built world. That is the correct behaviour and I
want it on the record as a credit: the guard that would otherwise have gone green on an empty world
is the single best piece of engineering in this round.

### 2.1 But the world's copy of those values is 53% wrong, and nothing checks it

This is the finding. `game/data/world/population-posts.json` is generated, and it **caches a
`souls` figure per post** plus `by_tier`, `by_region` and a `crossing` summary. Round 3 re-derived
seven statblocks (`inf_trash` 64→42, `drowned_lesser` 24→16, `beast_slitherfang` 34→22,
`guard_legion` 83→54, `drowned_greater` 157→103, `cst_sap_speaker` 286→188, `champion_hist_marked`
5043→3319). **Nobody re-ran the world's generator.**

| what the world file publishes | what the shipped statblocks pay today | over |
|---|---:|---:|
| all 267 road bodies — `report.souls` **16,335** | **10,679** | **+53.0%** |
| danger tier 1 — **570** | **374** | +52.4% |
| danger tier 5 — **5,015** | **3,286** | +52.6% |
| the three-town crossing — **2,149 souls**, `level_if_fully_cleared: **5**` | **1,404 souls → level 3** | +53.1% |

Every derived row in that file is wrong the same way. The crossing headline — the number
`W1-POPULATION`'s own round used — says a player who clears the whole Stormhold→Lilmoth road reaches
**level 5**; at the values this piece shipped, they reach **level 3**.

The parenthetical in my brief said *"16,335 souls is the 267 road bodies; 21,664 adds the two
fog-gate bosses"*. **Both of those numbers are stale.** 21,664 is what the round-2 critic measured
at `a5a637d`; today the same 269 bodies pay **14,186**, because round 3's re-anchor cut every value
by roughly a third. So the answer to "is the census still the truth" is: the *body count* is, and
**the soul totals attached to it are not, in two different files, by two different amounts.**

**Neither `derive-soul-values --check`, `--census`, `check-souls-corpus`, `check-data` nor any
other gate reads `population-posts.json`'s `souls` field.** The economy checks the corpus against
the statblocks and the statblocks against the corpus. Nothing checks the world against either.

---

## 3. B — "level 120 exactly". Is the new curve still fitted to a target?

**No. This one is genuinely fixed, and I checked it without using any of the piece's own tools.**

I recomputed the cumulative curve directly from `game/data/progression/levels.json`
(`cost(n) = round(0.015n³ + 2.00n² + 55n + 300)`) and dropped `RI-PRG06` §1's totals into it:

| | souls | lands at | how far into that level |
|---|---:|---:|---:|
| R1 cumulative | 12,665 | **L14** | 52.4% |
| R2 cumulative | 54,265 | **L29** | 49.3% |
| R3 cumulative | 154,725 | **L45** | 68.0% |
| R4 cumulative | 356,885 | **L62** | 72.9% |
| R5 cumulative | 647,685 | **L77** | 59.5% |
| **R6 — the full clear** | **1,124,285** | **L93** | **69.75%** |

A curve fitted to a target lands *on* the boundary. **All six of these land in the middle of a
level**, between 49% and 73% of the way through, which is what a derived number looks like. For
contrast, round 1's projected world total of 2,400,817 landed **inside level 120** — it crossed
`cum(120) = 2,391,999` and sat 14% into it. That signature is gone.

`cum(120)` computed from the shipped curve is **2,391,999**, which matches `RI-PRG06` §1's declared
`souls_for_L120` **to the digit**, and `2,391,999 / 1,124,285 = 2.1276` against the item's target
2.13 and band 1.8–2.6.

**The caveat, and it is real.** `--check`'s L120 guard is *invariant by construction*: `world_total`
is §3's own roster sum and `souls_for_L120` is §1's own declared figure, so the ratio it asserts
cannot be moved by any shipped statblock. The only falsifiable content in that arm is
**curve-vs-declared-figure**, which is a genuine cross-item check and does pass. The half that would
actually catch a re-tuning — the world side in `--census` — **has never asserted once**, because the
world is at 269 of 891. So method 10 today is one real assertion about two documents and a silent
branch about the game.

---

## 4. C — the 343-route oracle. Distinct routes, or 343 permutations of a handful?

`tools/progression/souls-ledger-oracle.mjs` is a good idea, honestly built, and it found a real
fourth instance of the defect class. It is also **advertised much wider than it is**.

343 is 7³ — every route of length 3 over a seven-symbol alphabet
(`kill_some, kill_all, release, materialise, named_load, save_load, rest`). Reading
`reports/souls-ledger-oracle.json` back:

| | |
|---|---:|
| exhaustive routes of length 3 | **343** |
| distinct **paid-signatures** among them | **27** |
| distinct **behaviour vectors** (event labels stripped) | **14** |
| routes that pay **zero souls end to end** | **153** (44.6%) |
| routes with a **completely empty** payment trace | **125** |
| distinct route **totals** in the whole set | **6** — {0, 210, 252, 420, 462, 504} |

**Three of the seven alphabet symbols are behaviourally indistinguishable at this resolution.**
`named_load`, `save_load` and `rest` produce *identical* total-payment distributions
(`{0: 27, 210: 9, 252: 13}`). The alphabet is nominally seven events; the oracle can tell four apart.

**The exhaustive arm found nothing.** All 12 I3 violations in the INTACT run come from a *single*
route pattern of length **5** — `save_load > kill_all > materialise > release > materialise` —
which appears twice in the 120 seeded long routes. **Zero of the 343 violated anything.** The
headline number in the tool's own banner contributed no findings; 2 sampled routes contributed all
of them.

**One statblock, one hour, across all 463 routes.** Every route drives `dres-raid-party` (six
`inf_trash` at 42) and sets `setTimeOfDay(12)`. Every route total in the file is a multiple of 42.
So invariant **I2** — *"a body-life that dies is paid exactly its statblock value × night"* — has
been tested against exactly **one value** and the `night` half of its own statement is **dead in
every route the oracle has ever driven**. The ×1.35 term is in the oracle's `valueOf()` and has
never once been reached.

**Falsifiability.** The builder declared that it skipped `--self-break` and argued the world-memory
delete-the-fix served the same purpose. It does not — that leg moves **I3**, which the tool's own
header says is *not* `sim/souls.js`'s invariant. So I ran it (`--len 2 --samples 10`, 59 routes):

| invariant | owner | shown able to fail? | by what |
|---|---|---|---|
| **I1** no double pay | `sim/souls.js` | **NO — never, by any arm anyone has run** | — |
| I2 no free kill | `sim/souls.js` | yes | my `--self-break`: **21 violations** |
| I3 no free resurrection | `world/population.js` | yes | builder's world-memory ablation: 11 violations |

**Of the two invariants this piece owns, one has never been shown red.** (16 of the 59 self-break
routes also *threw*, on the non-atomic `spawnEncounter` the builder found and routed around in
`_materialise` rather than fixing at source.)

---

## 5. D — CONSUMPTION (`RI-MTH07`, mandatory under `ARBITRATION.md` §3)

The soul economy declares **four** values. I named a consumer for each, perturbed each, and watched
an entity change behaviour. All four are plugged in.

| declared value | world-side consumer | perturbation | result |
|---|---|---|---|
| per-statblock `souls` | `sim/souls.js` `step()` → `awardFor(stat, awardHour)` → `progression.soulsHeld` | `inf_trash.souls` 42 → **999** | six-body fight pays **252 → 5,994**; restoring 42 returns **252** |
| night **×1.35** | `sim/souls.js` `isNight(env.awardTimeOfDay)` → `awardFor()` | clock 14:00 → **23:00** → **04:00** | **252 → 342 → 342** = 6 × `round(42×1.35)`. **The value the oracle never exercises.** |
| the level curve | `engine.js _spendSouls()` → `prog.level` / `attributes` → `sim._poolsDirty` → `applyDerivedPools()` → the combat body | fund by **killing** (504 earned), then spend | one soul short → **refused, and not debited** (417 held); undeclared attribute → **refused**; funded → **418 debited, level 1→2**, and the body's pools move |
| **S15** — souls level, gold buys | `engine.js:4024` is the only debit of `soulsHeld` in the build | 100,000 gold, zero souls, ask for a level | **refused**, reason `"not enough souls"`, gold untouched. A kill moves **zero** gold. |

`dummy_passive` at `souls: 0` pays nothing and is still *settled* by the scan, so a 99,999-HP
training dummy is not a farm.

**My instrument can fail, and it caught me twice.** Under `--self-break`
(`sim.souls.enabled = false`) all seven paying arms go red. Both times my own arm was wrong, the
gate is what told me:

1. My first level-curve arm wrote `soulsHeld = cost` instead of earning it, and **passed** under
   `--self-break` — proving the spend side and nothing about the source. It now funds the first
   level with two real fights.
2. My attribute arm read `getDerivedStats()` in `arena_flat`, **which ships with no character**, so
   the call answered `{created: false}` and I was reading a **5-key** snapshot of the combat body
   while claiming to read the sheet. It charged 8 of 10 attributes as inert. With a character
   written down the snapshot is **113 keys** and the answer is that **4 of 10** attributes
   (strength, endurance, vigour, willpower) reach the derived sheet. The coverage census
   (`snapshot_keys`, `derived_sheet_keys`, `character_created`) is published in my report so nobody
   has to take my word for the fix.

**Reported, not charged:** six declared attributes — agility, speed, intellect, hist-bond,
personality, luck — move nothing in the derived sheet or the combat body even at **+15**. That is
`RI-PRG02` / `W1-21`'s axis, not this one's, and my snapshot does not cover movement speed,
disposition, loot or skill-use, which is where they would land if they land anywhere. It is here
because a level is this economy's only sink and somebody should know what a level buys.

---

## 6. X — delete-the-fix, run as a 2×2, because one at a time cannot answer it

Round 3 shipped **two** fixes for one class:

* **identity** — `sim/souls.js` keys `_alive` on the entity **object** (`rec.ref !== e`), not the eid;
* **boundary** — `engine.js _sessionObservers()` is one declared list that calls `sim.souls.reset()`
  at **both** scenario boundaries.

The builder deleted each on its own and the number stayed green both times, and wrote that down
honestly (*"defence in depth today, not the mechanism"*). That is the exact shape my brief warns
about — an inert fix that correlates with a passing measurement — and it **cannot be resolved by
deleting one at a time**, because the other one holds the number up. So I ran the same fixture under
all four states. The fixture is round 2's own shape: an **untagged** six-body fight, killed, crossed
over `loadState('arena_flat')`, killed again — **same eids both times, zero hearth rests**.

| identity | boundary | first fight | same fight again | arms |
|---|---|---:|---:|---:|
| kept | kept | **+252** | **+252** | 9/9 |
| **deleted** | kept | +252 | **+252** | 9/9 |
| kept | **deleted** | +252 | **+252** | 9/9 |
| **deleted** | **deleted** | **+0** ¹ | **+0** | **2/9** |

¹ with both gone the ledger never clears across the whole page, so by the time this arm runs even
its *first* fight is already settled. That is the defect, amplified.

**Both halves of the brief's test are satisfied.** Removing the change returns the old number
exactly — the same fight pays 252 and then nothing, six live enemies worth zero, which is round 2's
HF-1 reproduced. And the two arms genuinely differ: **9/9 against 2/9**. **The change is not inert.**

**But each guard measures inert on its own**, and that is worth filing. The project is carrying two
independent guards where every delete-the-fix anyone has run measured one at a time and came back
green. That is precisely how the next agent deletes one of them in good faith.

**Restore, verified.** `sha256sum -c` on `game/src/sim/souls.js`, `game/src/engine.js` and
`game/src/world/population.js` matched the pre-run baseline after every ablation. RULES 17: nothing
of mine was staged; the ` M game/src/engine.js` in `git status` is a **neighbour's** pre-existing
worktree edit, and my restore wrote back the **worktree** bytes I snapshotted, not `HEAD`.

---

## 7. E — doctrine. Souls are levelling only; gold is the currency.

**Clean, and here is everything I searched for so that the absence is checkable.**

**Every write to `soulsHeld` in `game/src` — four lines and a save round-trip:**

| site | what |
|---|---|
| `sim/souls.js:321` | `+= a.souls` — the kill credit. The only producer. |
| `sim/death.js:403` | `= 0` — dropped on death |
| `sim/death.js:603` | `+= souls` — recovering your own bloodstain |
| **`engine.js:4024`** | **`-= cost` — the level. The only debit in the build.** |
| `save/state.js:580` | restored from the blob |

* Souls reaching a price: `grep -rniE "(souls?|soulsHeld)[^;]{0,60}(price|cost|shop|merchant|vendor|bribe|toll|fare|buy|purchase|barter|sell)"` over `game/src/**/*.js` → **the only hits are comments asserting the rule**. No price table, no function that takes souls and returns a thing.
* Gold reaching a level: `grep -rniE "(gold|coin|drake|septim)[^;]{0,60}(level|levelUp|levelling)"` over `game/src/**/*.js` → **zero hits**. Confirmed dynamically: 100,000 gold buys no level.
* Quest souls (`RI-PRG06` method 7, S15): **zero** quest files under `game/data/quests/` mention `souls` at all.
* Bribes are gold: `combat/parley.js:125` `world.gold -= spent`, and the same function returns `souls_awarded: 0`.
* The `souls_awarded` event carries `gold_awarded: 0` on its face, so a critic reading the stream can see the line being held rather than trusting the file.

**AR-1 / S9 — no level scaling.** `grep -rniE "playerLevel|player\.level|soulLevel|scaleTo|levelScal|difficultyScal"` over `sim/souls.js`, `world/population.js`, `combat/`, `sim/death.js`, `sim/step.js` → **zero hits**. The dynamic half (instantiate the R5 roster at L10 and L90 and byte-diff) **cannot be run: there is no R5 roster.** Declared as unmeasured, not as passed.

**AR-2 — Morrowind leakage.** No soul-currency purchase exists. Clean.

**AR-3 — seam.** `seam_sterile: false`. Two crossings, both source-level rather than measured, and I say so: a **parley** accepted on Morrowind-side social ground ends the fight with gold spent, a faction delta, and **zero souls** — the Souls-side reward is removed by a Morrowind-side resolution; and the **night ×1.35** ties the Souls reward rate to the Morrowind world clock, which is a choice the player makes by resting.

---

## 8. Scoring

Min-over-axes. `RI-PRG06`'s own table, plus the mandatory CONSUMPTION axis.

| axis | score | why |
|---|---:|---|
| Region-1 assertion | **6** | The derivation is exact at the census it is derived at — 12,665 → **L14**, dead on §1. The **placed** world cannot be scored and the tool fails closed and says so. Held at 6 because `--check`, the green mode, prints a **−40.6%** anchor error against its own ±15% tolerance and exits 0; the mode that fails (`--strict`) is wired into no gate. |
| All-region levels | **8** | All six land exactly on {14, 29, 45, 62, 77, 93}, verified by me off the shipped curve file rather than the corpus. Not 10: it is a curve-vs-corpus result, not a world result. |
| Typical sim (method 3) | **unmeasured** | No Monte Carlo instrument exists anywhere in the tree. |
| Pace (method 4) | **unmeasured** | §5's table is invariant under every change that could move it — the item says so itself in §8. No instrument. |
| S9 / no level scaling | **9** | Static: zero hits across every module that could carry it. Dynamic byte-diff not runnable — no R5 roster exists. |
| Band separation (method 6) | *below floor — **not charged*** | 5 of 5 pairs over the 25% ceiling (32.3 / 50.0 / 53.3 / 76.1 / 70.0%). A **corpus** contradiction: §2's bands *are* §3's roster min/max and §7 froze §3, so this piece cannot fix it. AQ-1 is filed and open. **Under a literal min-over-axes reading of `RI-PRG06`, nothing can score above 4 until somebody rules on it.** |
| Quest souls | **10** | Zero, everywhere, and checkable. |
| L120 guard | **8** | The round-1 defect is gone and lands mid-level. Not 10: the asserting half is invariant by construction and the world half has never fired. |
| **CONSUMPTION** | **9** | All four declared values perturbed, all four consumed, entity behaviour changed, self-break red on all seven paying arms. |
| **Method integrity** | **6** | The change is load-bearing as a whole and the old number returns. But each guard measures inert alone; the oracle's headline 343 is 14 behaviours over one statblock at one hour; its exhaustive arm found nothing; and **I1 has never been shown able to fail**. |

**Overall: 6.** Below the wave-1 gate of 7.0. **PROVISIONAL**, carried forward from round 2 for the
same reason and now with a second one: four of the item's eleven methods have no instrument, and
four of its eight axes have no world to run on.

Round 2 also scored 6. **The reasons are completely different**, and that matters more than the
digit: round 2's 6 carried two hard fails that were live in the running world. **I found no live
defect in the soul economy at `e97347f`.** Round 3's 6 is entirely about the strength of the
evidence and the census the evidence stands on.

---

## 9. The single biggest remaining gap

**`GAP-W1-souls-world-copy-of-the-values-is-53pc-stale`**
`progression.souls.economy` × `world.encounter.placement` — **major**.

**What.** Round 3 re-derived seven statblocks. `game/data/world/population-posts.json` is generated
and caches a `souls` figure per post plus `by_tier`, `by_region` and `crossing`. It was generated
against the *old* values and nothing re-ran it, so the world file publishes **16,335** souls for the
267 road bodies where the shipped statblocks pay **10,679** — **+53.0%**, on every derived row —
and its crossing headline says a full clear of the Stormhold→Lilmoth road reaches **level 5** where
it reaches **level 3**.

**Why it matters.** These are not internal scratch numbers. `W1-POPULATION`'s round used them, this
piece's own `--census` walks the same file (correctly, from the statblocks, which is why the two
disagree), and any future agent reading the world's placement report gets a soul economy that is
half again too generous. The two pieces are the *same system*: the economy owns the value and the
world owns the count, joined by §7's normalisation rule — and there is **no check anywhere in the
tree that reads both**. That is the same shape as the census amendment this piece exists to honour.

**Remedy — buildable, and small.** Extend `tools/check-souls-corpus.mjs` (or add
`tools/check-souls-world.mjs`) with a **world row**: recompute every post's `souls` from
`encounters.json` × the shipped statblocks, and every `report.by_tier` / `by_region` /
`crossing.souls` / `crossing.level_if_fully_cleared` from those, and **fail on any drift**. The
economy already owns the arithmetic — `placedByTier()` in `derive-soul-values.mjs` does exactly this
walk. It is the *comparison against the cached copy* that does not exist.

**Acceptance test.** (a) Change one statblock's `souls` by 1; the check goes **red** and names the
file and the row. (b) Re-run `tools/world/build-population.mjs`; the check goes **green**.
(c) The check is silent on the shipped tree only *after* (b) — arm it after the regeneration, not
before (RULES 13).

---

## 10. Path to 7+ for round 4

1. **Close the gap above.** One checker, cross-piece, fail-closed after the regeneration.
2. **Widen the oracle where it is narrow, not where it is already wide.** 343 routes over one
   statblock at one hour is less evidence than 40 routes over five statblocks across the night
   boundary. Publish the **behaviour-vector count** beside the route count in the tool's own banner
   so nobody reads 343 as 343 again.
3. **Give I1 a way to fail.** It is one of the two invariants this file owns and no arm anyone has
   run has ever moved it. A leg that pays a body twice inside one epoch — by hand, in the oracle —
   and requires I1 to go red.
4. **Say in the source that neither guard is load-bearing alone**, with this 2×2 in the comment. The
   next delete-the-fix on either one will come back green and somebody will believe it.
5. **Method 3 or method 4, whichever is cheaper.** Both are unmeasured; the typical-player sim needs
   no world at all — it runs over §3 and `RI-PRG04` §7's retention — and it would close the axis
   round 1 and round 2 were both unable to score.
6. **Escalate AQ-1.** It is a corpus ruling, not a build task, and until it lands this item's own
   scoring table caps every future round at 4 under a literal reading.

---

## 11. What I could not do

* **Methods 3, 4, 8 and 11 of `RI-PRG06` have no instrument anywhere in the tree.** I did not build
  them; my brief was to grade, and building four missing methods is a round of work.
* **Methods 1, 2 and 10 against the world.** 269 bodies against a band floor of 891. The tool
  refuses and I agree with the refusal.
* **Method 5's dynamic half** (byte-diff the R5 roster at L10 vs L90) — there is no R5 roster.
* **Method 9's second half** (night HP / damage / aggro deltas) — I measured the soul half only.
* **The parley and night seam crossings** are read from source, not measured in a running world.
* **`W1-SOULS-r1.json` was never written** by my predecessor and I have not back-filled it; two
  rounds have superseded it.
