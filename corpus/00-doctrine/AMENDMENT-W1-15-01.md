# AMENDMENT-W1-15-01 — three arithmetic defects in the stealth/crime items, and two harness additions

**Filed by:** wave-1 piece W1-15 (stealth, theft, crime and justice), builder.
**Status:** proposed. Each section states the arithmetic, so a critic can reject it by doing the
same arithmetic rather than by disagreeing with a preference.

Two prior amendments in this project were rejected as unearned. None of the four claims below is
a request to move a bar. Three are cases where a reference item **contradicts itself** and the
build cannot satisfy both halves; one is a vocabulary extension the items themselves demand by
name. Every threshold in every item stands.

---

## §1 — `RI-STL01` §2's stated light exponent cannot produce `RI-STL01` §2's own worked table

### The claim

RI-STL01 §2 gives the visibility formula as

```
V = clamp( L^0.7 × M × S × E × A , 0.05 , 1.30 )
```

and then publishes five worked rows for an INFANTRY (`R` = 16 m) at 8 m. **`γ = 0.7` cannot
produce three of those five rows.** `γ = 1.36` produces all five within 0.5%.

### The arithmetic

Every term but `L` is read straight off the item's own table.

| Row | item `V` | `V` at γ=0.7 | `t` at γ=0.7 | `V` at γ=1.36 | `t` at γ=1.36 | item `t` |
|---|---:|---:|---:|---:|---:|---:|
| 1 sprint, torchlit, heavy, Sneak 5 | 1.300 | 1.3000 *(clamped)* | 1.026 s | 1.3000 *(clamped)* | 1.026 s | **1.03 s** |
| 2 walk, dim, medium, Sneak 5 | 0.339 | **0.6745** | **1.977 s** | 0.3373 | 3.952 s | **3.94 s** |
| 3 crouch, dim, light, Sneak 45 | 0.157 | **0.3151** | **4.232 s** | 0.1576 | 8.461 s | **8.5 s** |
| 4 crouch, unlit, light, Sneak 45, cover | 0.050 *(the item writes "clamped")* | **0.0733 — not clamped** | **18.179 s** | 0.0500 *(clamped)* | 26.667 s | **26.7 s** |
| 5 still, unlit, light, Sneak 100, cover | 0.050 *(clamped)* | 0.0500 *(clamped)* | 26.667 s | 0.0500 *(clamped)* | 26.667 s | **26.7 s** |

Rows 1 and 5 clamp at both exponents and discriminate nothing. Rows 2 and 3 are 2.0× and 2.0×
wrong at γ=0.7. **Row 4 is the decisive one**: the item annotates its `V` as `0.050 (clamped)`,
and at γ=0.7 the raw value is 0.0733, so the floor the item says fired does not fire. The item's
own annotation is false at the item's own stated exponent.

Solving the two unclamped rows for the exponent gives 1.35533 and 1.36351.

### Why the table wins and the exponent loses

The Comparison method makes both normative and they are unsatisfiable together — method 1
asserts conformance to the *formula* on 100k cases, method 2 asserts the five *times* within 5%.
One must yield. The table is chosen because:

1. **It is three constraints and the exponent is one.** Three rows disagree with `0.7`; zero
   rows disagree with `1.36`.
2. **It carries the design intent.** The rows are what §2's prose argues about — "the floor at
   0.05 is a floor, not zero ... it finds you in 27 seconds", "the ceiling is 1.30, above the
   naive 1.00". At γ=0.7 the 27-second row is an 18-second row and the floor never fires.
3. **It agrees with §3's prose.** "The lighting artist is a stealth designer" and
   DARK-COVERAGE's `L ≤ 0.10` threshold both assume darkness is *dark*. At γ=0.7 an `L` = 0.10
   tile multiplies detection by 0.20; at γ=1.36 it multiplies it by 0.044.

### What was built

`game/data/stealth/detection.json` carries `visibility.light_exponent: 1.36` **as data**, with
the full arithmetic and a `how_to_disagree` field. Nothing in the code hardcodes it: set it to
0.7 and `tools/harness/stl-probe.mjs` STL01-M2 fails instead, which is the correct behaviour for
a disputed number.

### Requested

Correct `RI-STL01` §2's formula to `L^1.36`, or restate the five worked rows at `L^0.7`. Either
resolves it; shipping both does not.

---

## §2 — `RI-CRM02` §4's exclusivity table permits three simultaneous sanctioning authorities, and §8 asserts two

### The claim

RI-CRM02 §8's census row reads **"Max simultaneous sanctioning authorities: 2, hard fail ≥ 3"**.
§4's exclusivity table, taken as written, permits **three**.

### The arithmetic

The reachable triple is **Warrant of Attainder + Ledger silence + a ku-vastei Ruling**:

| Pair | Forbidden by any §4 row? |
|---|---|
| Ninth Cohort ≥ 4 and Wet Ledger ≥ 3 | no — Cohort forbids only Morag Tong and Sap-Cutters; Ledger forbids only Xul-Aneekh and Sap-Cutters |
| Ninth Cohort ≥ 4 and ku-vastei | no — the only ku-vastei exclusion in §4 is *Morag Tong contact* |
| Wet Ledger ≥ 3 and ku-vastei | no — no row mentions the pair |

§4's prose lists the reachable pairs and never notices that their union is reachable too.
Found by exhaustive search over the 16-element join graph
(`tools/harness/stl-probe.mjs`, assertion `CRM02-M5b`), not by reading.

### What was built

One further exclusion, in `game/data/crime/sanction.json`, carrying its own provenance field:

> **Wet Ledger ≥ 3 cannot hold a ku-vastei petition.** The Ledger's product is that no report is
> ever made. A ku-vastei Ruling is a public record of the killing, spoken aloud to a family. The
> two are not merely incompatible services, they are opposite ones, and the Ledger will not pay
> for a silence you intend to break.

This is the only new pair whose in-fiction reason falls out of the two institutions' own stated
products rather than being invented to close an arithmetic hole. It raises §8's
`mutually_exclusive_pairs` count from 10 to 11, which is still inside the "≥ 8" band.

### Requested

Add the row to `RI-CRM02` §4, or lower §8's `max_simultaneous_authorities` to 3 and restate the
hard fail. The corpus should not assert 2 while permitting 3.

---

## §3 — `RI-STL02` §6 declares a fence-greed range that its own method 9 assertion excludes

### The claim, briefly

§6 declares `fenceGreed ∈ [0.85, 1.10]`. Method 9 asserts *"the best achievable fence multiplier
at Mercantile 100 is in [0.58, 0.62]"*. With the item's own `0.35 ×` base and its own worked
`mercantileTerm(100) = 1.71`:

```
0.35 × 1.71 × 1.10 = 0.658   — outside the asserted band
0.35 × 1.71 × 1.00 = 0.599   — the value §6's prose actually computes
```

§6's prose worked case silently uses greed 1.00, not the 1.10 its own range permits.

### What was built

The shipped roster of nine fences tops out at greed **1.02** (`0.35 × 1.71 × 1.02 = 0.6105`),
inside the declared envelope *and* inside the asserted band. `game/data/crime/fences.json`
states this in a `greed_envelope_note` rather than hiding it.

### Requested

Narrow §6's range to `[0.85, 1.02]`, or widen method 9's band to `[0.58, 0.66]`. This is the
smallest of the three and could reasonably be left as an authoring constraint.

---

## §4 — Two harness extensions, both demanded by name by the items they serve

Filed here rather than as a separate document because both are additions to closed sets that
`HARNESS.md` itself declares extensible, and neither changes anything already emitted.

### AM-W1-15-01 — `crouch` enters `HARNESS.md` §4's closed action set

RI-STL01's Comparison method opens: *"Button `crouch` added to `HARNESS.md` §4's closed button
set. Without it, no stealth scenario is scriptable at all. **This is a blocking dependency.**"*
Its "How we lose" states the consequence of not doing it: the item *"scores 0 fail-closed under
`HARNESS.md` §5, and it will look like a stealth-design failure rather than a tooling one."*

Built. Fifteen names now (`game/src/input/actions.js`), bound to `KeyC`/`KeyZ`, both previously
unbound; `auditBindings()` returns `[]`; none of RI-JRN03 §B's three collision rulings is
touched. It is a **toggle**, not a hold, and the reason is stated in the source: RI-STL01 §5 puts
sneak at 0.85 m/s and a 40 m warehouse at 47 s crouched, and a 47-second hold is a hand cramp.

### AM-W1-15-02 — 27 event types enter `HARNESS.md` §5's closed event vocabulary

§5 describes the vocabulary as *"a closed vocabulary, extensible by amendment"*. Four items name
events by string in their Comparison methods and cannot emit them:

| Item | Events it names |
|---|---|
| RI-STL01 | `detect` `challenge` `search_start` `search_end` `zone_alert` `light_snuffed` `distraction` |
| RI-STL02 | `theft` `pickpocket` `lock_attempt` `lock_open` `pick_break` `trespass_enter` `fence_sale` |
| RI-CRM01 | `crime` `witness` `report` `bounty_change` `arrest` `jail_serve` `corpse_found` `bloodprice` |
| RI-CRM02 | `writ` |

Added, plus four of this piece's own — `crouch`, `crouch_refused`, `civ_state`, `lock_ward_set`,
`death_flag` — named separately rather than folded into a neighbour's meaning. The event bus
still throws on an unknown type, so the set is still closed.

---

## What this amendment does NOT ask for

- No threshold is lowered. DARK-COVERAGE stays ≥ 30%, SNUFFABLE ≥ 60%, ownership 100%/92%/240,
  trespass ≥ 180 zones, R5-BYPASS ≥ 67%, BOSS-BYPASS 0, the 17-crime schedule, the jail ledger.
- No binary axis is softened. OPENER-PURITY, NO-METER, lock determinism, bounty persistence,
  S10 handling, mid-fight accrual and the AR-3 encounter flip are all built as written.
- Seam **S21** is applied against `RI-STL02` §5's text rather than amended: ARBITRATION §2 names
  RI-STL02 as the item to be reconciled, and ARBITRATION §5 puts the seam rulings above an
  item's own comparison method. The pickpocket keeps its roll. That is a precedence *application*,
  not an amendment, and it is documented in
  `game/data/stealth/theft.json → pickpocket.the_die.conflict`.

---

# Round-2 additions (W1-15 builder, after the round-1 verdict)

The round-1 critic **confirmed §1 independently** — "row 2 gives 0.6745 at γ = 0.7 against the
item's stated 0.339, and row 4's raw value is 0.0733, so the item's own *'(clamped)'* annotation
is false at the item's own exponent … `RI-STL01` §2 should be corrected, not the build" — and
reproduced §2 and §3. Those three stand unchanged. The two sections below are new, and both were
found while closing `GAP-W1-stealth-crime-model-not-coupled-to-the-world`.

## §5 — `RI-AI01` §B and `RI-STL01` §2 give incompatible primary sight-fill curves

### The claim

`RI-AI01` §B's perception table gives the primary sight cone as

> 100/s at ≤0.5·R, 50/s at 1.0·R, 0 at >R

which is a plateau of 100 out to half the sight radius and then a straight line to 50 at `R`,
i.e. `rate(d) = min(100, 150 − 100·d/R)`.

`RI-STL01` §2's worked table gives, for an INFANTRY (`R` = 16 m) at 8 m with `V` = 1.30, a fill
rate of **97.5/s**. That is `75 × 1.30`. So `RI-STL01` assumes a base rate of **75/s at 0.5·R**,
i.e. `rate(d) = 150·(1 − d/R)`.

**At exactly the distance both items work an example at, they differ by a third: 100 vs 75.**

### Which one this build implements, and why

`150·(1 − d/R)`, which is `RI-STL01`'s. The reason is narrow and is not a preference:

1. **`RI-STL01` method 2 is an assertion and `RI-AI01` §B is a table.** Method 2 says *"assert
   times within 5% of {1.03, 3.94, 8.5, 26.7, 26.7} s"*. Those five numbers are only reachable
   from the 75/s base. `RI-AI01` has no method that pins the rate at 0.5·R.
2. **`RI-STL01` §1 disclaims the geometry, not the rate.** It says `RI-AI01`'s cones, radii,
   decay and thresholds are "not re-opened here" — and this build takes all four verbatim
   (±55°/±100°, the archetype radii, decay 12/s, SUSPICIOUS 50 / AGGRO 100, the peripheral
   0.35× and its 70 cap, the hearing rates 60/40/25, the ×0.4 wall attenuation). The
   *distance falloff* is the one term the two items state differently.
3. **The difference is invisible on `RI-AI01`'s own methods and fatal on `RI-STL01`'s.**

### What is asked

A one-line correction to whichever item is wrong. This is a `RI-MTH05` corpus-coherence defect,
not a bar dispute, and the builder has no standing to pick — so it is implemented in the way
that makes the *asserted* numbers reproducible and filed here rather than silently resolved.
It is recorded in the build at
`game/data/stealth/detection.json → perception_inherited_from_RI_AI01.base_fill_conflict_with_RI_AI01`,
where the value is data: set it the other way and `RI-STL01` method 2's five rows fail instead.

## §6 — `RI-STL01` §9's `SNEAK-QUESTS` floor is a COUNT against a quest tree that does not exist yet

### The claim

`RI-STL01` §9 sets `SNEAK-QUESTS` at **≥ 22** quests carrying a `method: "sneak"` resolution, and
annotates it *"≈ 12% of ~180, inside `RI-QST05`'s ≤40% verb-spread cap"*. The annotation is the
real bar and the number is a projection of it onto a tree of 180 quests.

Wave 1 ships **33**. Reaching 22 on 33 quests means **two thirds of every quest in the game has a
sneak route**, which is not what 12% means and which would itself breach the spirit of
`RI-QST05`'s spread cap.

### What is asked

**Read `SNEAK-QUESTS` as its own stated ratio (≥ 12% of the shipped tree) until the tree reaches
~180, then as the count.** Nothing is lowered: 12% is the item's own annotation of its own number.

The build's position under that reading, measured by `H.questVerbCensus()` in the running game:

| | shipped | as a ratio | `RI-STL01` §9 |
|---|---:|---:|---|
| quests | 33 | — | ~180 |
| quests with a `sneak` resolution | **13** | **39.4%** | ≥ 12% |
| quests with a `steal` resolution | **8** | **24.2%** | ≥ 5.6% (10/180) |
| VERB-SPREAD (top verb's share of non-violent resolutions) | 24.7% | — | ≤ 40% (hard fail above) |

Twelve of those routes were authored this round, each with a real gate against a quantity the
perception model now consumes and each with its own hand-written journal entry. They are marked
`added_by: "W1-15-r2"` in `game/data/quests/**` so a critic can subtract them and re-measure.

**And the honest half:** `PACIFIST-ALL` reads 100% over 33 quests and that figure still means
almost nothing, exactly as the round-1 verdict said. `questVerbCensus()` therefore returns
`meaningful: false` with the denominator attached, and will keep returning it until the tree
passes 90 quests. A build should not be able to quote that number without the sample size.

## §4b — Two more event types, both because the build now derives what it used to be handed

`AM-W1-15-02`'s list is extended by two, under `HARNESS.md` §5's own "closed vocabulary,
**extensible by amendment**":

| event | why it must exist |
|---|---|
| `report_route` | Which of `RI-CRM01` §3a's five routes a witness took, which guard they are running at, and the latency in `f@60`. Without it a critic sees a bounty appear and cannot tell a 1.2 s shout from a 35.3 s run — the distinction method 3 spends three of its five assertions on. |
| `guard_band` | `RI-CRM01` §4's ladder as an **observed transition** rather than a lookup: which band a guard who can see you is in, whether their weapon is drawn, and which parley is open. Round 1 had no guard entity to emit it, which is why the ladder was verifiable only as arithmetic on a number `setBounty()` wrote. |

Both are emitted by `game/src/sim/stealth/system.js` and both carry the eid of the person the
event is about, so they join to `civilians[]` in the same frame record.

## §7 — `RI-STL01` method 6's S-2 distance assertion is unreachable jointly with S-1's 8 m cap

### The claim

Method 6 says:

> **Assert S-1**: the searcher visits LKP then ≤ 3 cover volumes … **Assert S-2**: measure
> searcher distance from LKP over the 12 s and assert it exceeds 13 m and 19 m at the band
> boundaries.

S-1 caps the plausible set at **cover volumes within 8 m of the LKP**, with a 2.0 s dwell at the
LKP and 3.0 s per volume (`game/data/stealth/search.json`, transcribed from §7). S-2's bands are
**8 / 14 / 20 m** across a **12.0 s** window. Walk speed is **2.0 m/s** and seam **S17** forbids
lowering it to make traversal figures work.

The arithmetic, for a searcher that starts 8 m from the LKP — which is the geometry method 6's
own scenario produces:

| leg | distance | time |
|---|---:|---:|
| walk to the LKP | 8 m | 4.0 s |
| S-1's LKP dwell | — | 2.0 s |
| S-1's three cover volumes, all within 8 m | ≤ 8 m each | 9.0 s |
| **subtotal before the searcher may leave the 8 m disc** | | **15.0 s** |
| walk out to 19 m | 19 m | 9.5 s |
| **total** | | **24.5 s** |

**The window is 12.0 s.** The searcher cannot be 19 m from the LKP and have visited three cover
volumes within 8 m of it, at 2.0 m/s, in 12 s. It cannot even reach 19 m *without* the cover
volumes: 4.0 + 2.0 + 9.5 = 15.5 s.

### Which reading this build implements

**S-2's bands are a SEARCH radius, not a distance walked** — which is what §7's own prose says
they are: *"Search radius grows 8 m → 14 m → 20 m across the 12 s, then leashes. A player who
hides at 10 m and holds still is found; one who keeps moving away is not."* A player who hides
at 10 m is *found*, not *reached*: the band is the volume being searched.

So the band is implemented as the **re-acquire radius** — inside it, with line of sight, the
searcher re-acquires — which makes "hides at 10 m and holds still is found" literally true, and
makes it false at 8 m of band and true at 14 m, which is the behaviour the sentence describes.

The searcher additionally **sweeps outward to the band radius once S-1's plan is exhausted**, so
distance-from-LKP does grow across the window and method 6 has something to measure. It reaches
the band radius when the geometry allows and does not when it does not, and the trace says which.

### What is asked

Replace method 6's S-2 clause with an assertion about the **re-acquire radius** — e.g. *"place a
motionless player at 10 m from the LKP with line of sight; assert re-acquisition occurs in the
second band and not the first"* — or raise the window past 12 s. As written, the two assertions
in the same numbered method contradict each other, and no implementation can pass both.
