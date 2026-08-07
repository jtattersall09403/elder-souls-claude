# TOOL-COVERAGE-R4 — the tool critic's verdict on round 5 of `build-viability`

> `TOOL-LOOP.md` rule 3. A separate critic with fresh context. **I wrote none of this and I am not
> defending it.** My predecessors' standard is my standard: *every rejection is demonstrated by
> patching a shadow tree and booting the engine, not by reading source.* Every falsification below
> was constructed by me, and every number was produced on this tree in this pass.
>
> **Verdict: NOT SATISFIED.** `tools/analysis/build-viability.mjs` is rejected for the **fifth
> round running**. **I broke the model detector again, three different ways, and one of them is
> the round's own headline defect wearing a new coat.**

| | |
|---|---|
| Rebuild | **1** — `tools/analysis/build-viability.mjs` |
| Commit under test | **`0b2d6ef`** (predecessor worked at `e29ec21`; 10 commits and ~11 000 lines landed between, including `game/src/engine.js` +566 — every number below is re-stamped at `0b2d6ef`) |
| Worst instrument still standing | **`tools/analysis/build-viability.mjs`**, fifth round |
| C8 now | **26**, 0 errors (`node tools/corpus-index.mjs`) — unchanged |
| Harness state | `node tools/harness/boot-check.mjs` **PASS** before and after every measurement. `smoke.mjs` never boots the engine and was not used. |
| Self-test | **`build-viability self-test: FAIL (49/51)`** — run to completion for the first time (~37 min). The builder never finished it. |

**What round 5 got right, and it is a great deal.** The four synthetic constants are genuinely
gone: `gold = 1e9` is now a sum over real `rewards[]`, ranks come from the shipping
`FactionGates.highestQualifying()`, and the four collections that answered `true` to everything are
real Sets of what the data produces — I confirmed the empty-set ducks are gone and that an
unproduced token is now refused. `crossCheckVerdict()` is genuinely extracted and the shipping
function is genuinely what the self-test calls; a row without a boolean `agrees` genuinely refuses.
The six ungrounded requirement tokens and the twelve ungrounded ladder flags are **real findings**
that only became visible because the stubs were removed, and I verified them independently. The
`--verify-model` live differential is a real advance over three anchors of source-text pattern
matching, and it does catch round 3's break. None of that is in dispute.

**The pattern across the failures is one pattern, and it is the round's own lesson turned back on
it.** Round 5's best moment was its self-correction: *a field census over data cannot prove a read
dead, because the loader defines what shapes are legal.* The round wrote that down and then did not
apply it to its own producer branch, its own grant ledger, its own abstention path, or its own
model detector. In each case a **count** stands in for a **check**: 15 rows counted instead of
classified, 0 substitutions counted over a hand-written list, factions counted instead of tested for
compatibility, and givers counted as "moved" without asking *which race term moved them*.

---

## 1. Attack 4 — **I broke the model detector. Three ways. The best one is R3's defect, resurrected.**

This is the headline, so it goes first. Method: four shadow trees at `0b2d6ef` (`game/` + `tools/`
copied, `node_modules` symlinked), each a **one- or two-line** patch to
`Engine._questDispositionModel()`, each run through the shipping `--verify-model`.

**Controls both ways, first.** My instrument is calibrated before I use it:

| tree | break | `--verify-model` says | exit |
|---|---|---|---|
| `shadowS` | none (pristine) | RACE-SENSITIVE, **25/31** moved, 4/4 anchors **AGREE** | **0** |
| `shadowR` | R3's known `if (!this.__raceGatesEnabled) return null;` | RACE-INVARIANT, 0/31 moved, **CONTRADICTED** | **20** |

The builder's claim is discharged: R3's one-liner is caught. That is exactly why I did not use it.

### 1a. `shadowD3` — the RI-CHR02 matrix is 100 % dead and the detector certifies the build sound

```js
let race = ch ? ch.race : this.sim.identity.race;
const __matrixRace = 'dunmer';          // frozen for EVERY giver
...
derivedDisposition(this.chData, { group, race: __matrixRace, upbringing, ... })
```

The 12×10 reaction matrix — the arithmetic the tool models with `dispositionCeiling()`, the exact
thing R3's break killed — is now dead for all 31 gated givers. `_questPlayerView()` is untouched.

```
verify-model: the running gate is RACE-SENSITIVE (1/31 gated givers moved …)
  per-giver, live: 31 modelled, 0 unmodelled
  static anchors say "derived" (4/4): AGREES with the running gate
EXIT=0
```

A **VALID** attestation is written. The full walk on that tree then **publishes** —
`0/540 viable, 45 not viable, 495 UNMEASURABLE` — byte-identical to the sound tree, and does not
refuse. The builder's own stated acceptance test ("the full walk on that tree must REFUSE") fails.

**Why it works: race reaches `canOffer` through two independent channels, and `moved.length > 0`
cannot attribute movement to either.**

1. `game/src/character/reaction.js` `raceTerm()` — the RI-CHR02 12×10 matrix. **This is the one the
   tool models.**
2. `game/src/sim/dialogue/disposition.js:297` —
   `if (npc.race && player.race && npc.race === player.race) { x += G.fDispRaceMod; }`, a flat
   same-race bonus reached via `dlgMovableTerms`.

In `shadowD3`, channel 1 is entirely dead and channel 2 alone moves **one** giver —
`salt-factor-neloth-vaun`, a dunmer, δ −5. One giver is enough to certify the whole build.

**The damage it certifies, measured by my own probe.** `scratchpad/r4b/matrix-delta.mjs` imports the
shipped `raceTerm()` and computes the matrix term per gated giver for dunmer vs nord:

> matrix race term differs for **25 of 31** gated givers; largest |δ| **24** (RG-DEEP −40 → −16).

That 25/31 independently reproduces `shadowS`'s **live** 25/31 without booting anything — which is
also my cross-check of the tool's own control number.

### 1b. `shadowD2` — the detector cannot see **sign**

Swap `dunmer` ↔ `nord` before the matrix read. Output is identical to the sound control on **every
reported field** — RACE-SENSITIVE, 25/31, 31 modelled / 0 unmodelled, 4/4 AGREES, exit 0 — and only
`source_hash` differs. Measured from the two attestations: **12 of 12** recorded givers have their
arms *exactly swapped* (`dyer-sallis`: sound dunmer 9 / nord 31; D2 dunmer 31 / nord 9). A race term
wired backwards is indistinguishable from a correct one. The brief asked for a break that "fires
with the wrong sign"; this is literally that.

### 1c. `shadowD1` — the threshold is one

Freeze the matrix race for 30 of 31 givers. Detector: RACE-SENSITIVE, **2/31** moved (sound: 25/31),
`31 modelled, 0 unmodelled` — **the MIXED warning does not even fire**, because `modelled` reports
only that the closure returned an object, not that the race term inside it did anything — AGREES,
exit 0. `race_sensitive: moved.length > 0` (line 3226) is a threshold of one.

**What a fix must do.** `moved.length > 0` is not a measurement of the modelled term. The detector
must compare the live differential against **the term the tool actually models**: for each gated
giver, `explainDisposition(id).race_term` under both races must equal the shipped
`raceTerm(chData, group, race, upbringing).race`, per giver, by value and by sign. That is a
31-row equality check against an already-exposed field, and it kills D1, D2 and D3 at once.

---

## 2. Attack 1 — "15 granted fields, 0 substitutions" is a self-assessment, and it contradicts the file it is printed from

`--audit-grants` exits 0 and prints `substitutions remaining: 0`. That number is
`rows.filter(r => r.basis === 'SUBSTITUTION').length` computed over a **hand-written literal array**
(`build-viability.mjs:1432-1449`). No row is ever given the string `SUBSTITUTION`. The count is 0 by
construction and cannot be anything else, and `--self-test` asserts it to 0 — asserting a tautology.

The ledger's own doc comment at `:1422` defines `player-optimal-bound` as *"derived, then taken at
its independent maximum. **THE ONE SURVIVING SUBSTITUTION, stated as one.**"* The file says there
are four surviving substitutions and reports zero.

## 3. Attack 2 — the "player-optimal bounds" are not reachable; reputation is a **jointly unreachable vector**

`REPUTATION_GIFTS` (`:1379-1398`) takes, per quest, the maximum delta **per faction independently**
across all resolutions, and drops every negative (`if (d <= 0) continue`). Measured on the shipped
book: **64 of 121 quests** have their per-faction maxima coming from *different, mutually exclusive*
resolutions, and **200 negative deltas summing −3443** are discarded. `Q-ASSZ-04` credits
`imperial_assize +42` (res_hand_hallow), `xul_aneekh +25` (res_lodge_them) and `drowned_court +20`
(res_hide_vell) — from one quest, one of which a player may pick.

A real one-resolution-per-quest playthrough optimising `the_dockhands` reaches dockhands 521 but
`house_dres −236` and `rootkeepers −3`. The tool's context holds dockhands 521 **and** house_dres 169
**and** rootkeepers 184 simultaneously. This is precisely the faction-ladder error R2 named — a
ladder asserted against the best of 240 sheets *plus* every governed skill ground to 90 — and it is
a derived value computed from an optimistic assumption: a substitution wearing a derivation.

---

## 4. Attack 3 — the grant-dependency test is **dead code**, and the real abstention path has no attribution check at all

### 4a. It fires **0 times in 540 rows**

I patched a probe copy (`scratchpad/r4b/bv-attrib.mjs`) adding a **third arm** to the
grant-dependency test: instead of full omniscience, grant **only the quest's own ungrounded tokens**,
and tally whether the flip is attributable to them. Over `--signatures all`:

```
[R4-ATTRIB] hatch taken 0 times: ATTRIBUTED 0, LAUNDERED 0
```

The guard the round advertises as its anti-substitution mechanism **never executes on this tree**.
It is untested by the data and cannot be credited. (It is also unsound in shape: `omniscient: true`
grants all five collections, and the flip is then blamed on whichever ungrounded tokens the quest
happens to carry, with nothing checking causation. That defect is latent only because the path is
dead.)

### 4b. All 495 abstentions come from somewhere else — and **that** path converts failure into abstention

Every one of the 495 `UNMEASURABLE` rows is stopped by `null[ungrounded requirement]` inside
`criterionThreeFactionsRank5`. That path abstains on a **pure counting argument**:

```js
if (blockedOnlyByAnUngroundedFlag.length
    && qualifying.length + blockedOnlyByAnUngroundedFlag.length >= 3) {   // :2044
```

It never re-runs the compatibility search over `qualifying ∪ blocked`. The grant-dependency
discipline the builder invented is not applied on the path carrying **91.7 % of the rows**.

**Demonstrated.** `shadowE` rewrites `exclusivity.enemy_pairs` into 12 pairs, making the
compatibility graph bipartite K4,4 and therefore **triangle-free**. My independent probe
(`scratchpad/r4b/triple.mjs`, using the shipping `FactionGates` class) confirms **0 mutually
compatible triples with all 8 ladders granted rank 5** — the criterion cannot pass for any
signature, for a reason no flag grant can repair. The tool reports:

```
three_factions_rank5: {"fail":0,"unmeasurable":540}
UNM … "4 faction(s) reach rank 5 …, and 4 more are held back ONLY by a rank-5 world_state flag …"
```

— output byte-identical to the sound tree, still claiming the factions are held back *only* by the
flags. A total, permanent, data-irreparable build failure is laundered into an abstention.

**What a fix must do.** Replace the count at `:2044` with the flip test the builder already wrote
for quests: grant the ungrounded flags, re-run the triple search, and abstain **only if the verdict
actually flips**. Otherwise `FAIL`.

---

## 5. Attack 5 — the content findings are real. Three verified independently.

A tool that invents findings is worse than one that misses them, so these were re-derived from
`game/data` without the tool.

| finding | verified |
|---|---|
| 12 of 24 faction-ladder `world_state.flag` rows have no producing resolution | **YES** — my own recursive scan over all of `game/data` finds 786 produced flags and the same 12 missing (dockhands / drowned_court / ixtu_vakh / rootkeepers, ranks 5/6/7); the 12 grounded controls also match |
| 6 requirement tokens have no producer | **YES** — items `item_pitch_flask`, `item_ash_barrow`, `saltrice_bundle`; knowledge `topic_the_low_tide_hour`, `topic_ledger_assembly_procedure`, `topic_the_barge_schedule` |
| "no three rank-5-capable factions compatible under exclusivity" | **YES for the qualifying set, and the reasoning is now stale.** Using the shipping `FactionGates` at `0b2d6ef`: 8 ladders, exactly 5 incompatible pairs of 28 (drowned_court/imperial_assize `hard_group`; imperial_assize/wet_ledger `enemy_pair`; imperial_assize/xul_aneekh, ixtu_vakh/wet_ledger, wet_ledger/xul_aneekh `earned`), and **32** compatible triples once all 8 are granted rank 5. The abstention is defensible **today, by luck**, not by any check the tool performs — which is exactly §4b. |

**Two corrections to the builder's own record**, both stale against `0b2d6ef`:

- "only 3 factions reach rank 5" — the tool now reports **4 qualifying**.
- "`deep_kin` attainable reputation is 5 against a rank-1 demand of 10, so that ladder cannot be
  entered at all" — `--audit-grants` prints `deep_kin 159` against a rank-1 demand of 10.

**A content finding the tool does *not* surface:** `the_xul_aneekh`'s rank 5/6/7 world flags are
`deepkin_hollow_kept` / `deepkin_coast_decided` / `deepkin_speaker_vacant` — **the same three flags
as `deep_kin`'s**. Two ladders share one flag triple.

---

## 6. Attack 6 — **the self-test is red**, and only running it to the end shows it

The builder shipped with the battery still running and reported anyway. Run to completion at
`0b2d6ef`, the battery's own last line is **`build-viability self-test: FAIL (49/51)`** — two failures, both in the walk-based half that nobody had ever reached.

**Failure 1 — the seed ladder cannot saturate.**

```
FAIL the NUMBER is read, not the presence of a record (monotone ladder, saturating at 0)
  — seed 0 -> 468 | 15 -> 252 | 30 -> 99 | 45 -> 45 | 60 -> 27 | 100 -> 27
```

The assertion (`:2868-2871`) requires `ladder[last].fail === 0`. It cannot be met on this tree: the
residual 27 stop at `Q-XULA-06 [offer]` on `the_xul_aneekh rank 4/5` — a **rank** gate that no
disposition seed can move. The builder wrote a saturation guard for **total** saturation
(`:2846`, `=== base.length`) and none for **partial**.

**Failure 2 — and this one is the tool convicting itself.**

```
FAIL criterion 2 falsifiable (faction ladder)
  — rank-5 attribute floor -> 500: three_factions_rank5 FAIL 0 -> 0
```

This is the **red control** for criterion 2. It sets the rank-5 attribute floor to an impossible
500 and requires the criterion to go FAIL. It stays at **zero**, because every signature is already
`UNMEASURABLE` through the counting abstention at `:2044`. **Criterion 2 is unfalsifiable on this
tree** — the tool cannot make it fail even when it deliberately tries. That is §4b and §8 confirmed
by the instrument's own battery, and it is the single strongest argument that `0 of 540 viable` is
a property of the instrument rather than of the build.

This is the fifth round in which finishing the suite found something nobody had seen, and it is the
same reason each time: nobody finishes it.

---

## 7. Attack 7 — sweep the class. The round's own lesson was not applied to its own producer branch.

Round 5's best insight: *a field census over data cannot prove a read dead, because the loader
defines what shapes are legal.* It was not applied to `PRODUCERS`.

`PRODUCERS`' `npcs/**` branch is `for (const g of Object.values(d)) if (g && Array.isArray(g.npcs))`
— a **nested-group** shape. Re-measured at `0b2d6ef`:

> `game/data/npcs`: **15** files, **15** with top-level `doc.npcs` (what `loadNPCs()` reads),
> **0** with a nested `group.npcs`. **347** records and **776** topics under the loader shape;
> the tool's branch collects **0**.

The grant ledger prints `topicsKnown … from: … npcs[].topics …` — a cited source contributing
nothing. The builder's sweep recorded "npc record fields … topics 336/336", a **field census**,
while its own code path reached 0 of those records. The defect has grown with the tree (14 files /
336 records at `e29ec21` → 15 / 347 now).

**Impact, measured honestly:** exactly one shipped gate names a topic produced only by an npc record
(`Q-LILM-01.opens_by.prerequisite_topics[0] = "the rotting quarter"`). Repairing the branch in a
probe copy moves `GRANTED_TOPICS` 226 → 227; the verdict does not move, because the dialogue layer
separately produces the slug and `topicsInclude()` folds it. So the read is **dead, cited, and
currently harmless — a false red waiting for a topic only an NPC teaches.**

The rest of the sweep is clean: `dialogue/topics`, `books/`, `items/`, `magic/` and hooks are all
shape-correct against their loaders. `npcs/**` is the only dead branch.

---

## 8. `viable = 0` is still true by construction

Carried forward and re-confirmed at `0b2d6ef`. `criterionThreeFactionsRank5` is `UNMEASURABLE` for
**540 of 540** signatures, and `evaluateSignature` sets `viable` only when all four criteria PASS.
**No signature on this tree can be viable, whatever the build does.** The headline
`0 of 540 viable (target 486)` is once again a number the instrument's own shape guarantees — the
same class as round 4's `0 of 540` from `reputation = 100`, reached from the restrictive side
instead of the permissive one. The report must say so on its own front page.

## 9. Two surviving tautologies in the cross-check

Attack 2 of the brief is largely satisfied by shape — `crossCheckVerdict()` takes
`comparedRows.length`, refuses on a non-boolean `agrees`, and returns `agrees:false` when nothing was
compared. Two assertions still cannot fail:

- `pairs_enumerated` is **defined** as `comparedRows.length + unresolvedRows.length` (`:3309`), so
  `accounting_holds: comparedRows.length + unresolvedRows.length === pairsEnumerated` (`:3332`) is
  identically true. The self-test asserts it.
- The loop at `:3412` does `if (engineValue === undefined) continue;`, dropping pairs into **neither**
  array — so the `why` string's claim that "`${pairsEnumerated}` (signature, giver) pairs were
  enumerated" under-reports the real enumeration.

---

## Rebuild list — `tools/analysis/build-viability.mjs`

1. **Model detector must measure the modelled term, not movement.** Per gated giver, assert
   `explainDisposition(id).race_term` under both races equals the shipped
   `raceTerm(chData, group, race, upbringing).race` — by value and by sign. Kills D1, D2, D3.
   Name the second race channel (`fDispRaceMod`) explicitly and measure it separately.
2. **Delete `substitutions_remaining` or make it derivable.** A count over a hand-written literal
   is not an audit. Either classify each row by a rule the code applies, or state the four
   surviving player-optimal bounds as the four substitutions the file already calls them.
3. **Reputation must be a reachable vector.** Choose one resolution per quest, carry the negatives,
   and report the per-faction bound *under a single consistent playthrough*. If the tool will not
   solve that, it must report reputation as an upper bound that is **not jointly attainable** and
   refuse any verdict that turns on two factions at once.
4. **Apply the grant-dependency flip test at `:2044`.** Grant the ungrounded flags, re-run the
   triple search, abstain only on an actual flip. Otherwise `FAIL`.
5. **Attribute the quest-level hatch too** — grant only the quest's own ungrounded tokens, not full
   omniscience — and report that it fires 0 times, so a reader knows it is untested.
6. **Fix the `npcs/**` producer branch** to the loader's top-level `doc.npcs` shape, and re-run the
   sweep against **loaders**, never against field censuses.
7. **Green the self-test.** Give the seed ladder a partial-saturation guard naming the residual
   non-disposition stop (`Q-XULA-06`, `the_xul_aneekh rank 4/5`), the way `:2846` already does for
   total saturation.
8. **Put `0 of 540 viable` in context on the front page** — it is guaranteed by criterion 2 being
   unmeasurable for every signature, and must not read as a build verdict.
9. Remove the two cross-check tautologies (`accounting_holds`, `pairs_enumerated`) and count the
   `engineValue === undefined` pairs into a third named bucket.

---

## Method

- Commit **`0b2d6ef`** for every number. `boot-check` **PASS** before and after.
- Shadow trees: `game/` + `tools/` copied at `0b2d6ef`, `node_modules` symlinked; `shadowS`
  (pristine), `shadowR` (R3's known break — my red control), `shadowD1`/`D2`/`D3` (three new
  breaks), `shadowE` (triangle-free exclusivity). All under
  `scratchpad/r4b/`; **nothing was written into `game/` or `tools/` on the real tree**, and the
  predecessor's in-repo probe directory `tools/analysis/.r4probe/` was removed.
- My own probes, none of them the builder's: `matrix-delta.mjs` (matrix term per giver),
  `triple.mjs` (compatibility triples via the shipping `FactionGates`), `bv-attrib.mjs` (the
  grant-dependency third arm).
- Instrument calibrated in both directions before use: `shadowS` green / `shadowR` red.
- Contention: `pgrep -c headless_shell` and `/proc/loadavg` checked before each browser run
  (6 → 12 browsers, loadavg 2.98 → 11.5); all analysis after that point was Node-side.
