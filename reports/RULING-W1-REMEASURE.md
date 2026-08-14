# Ruling W1 implemented: five bars now bind on what a player actually meets

**Task** `RULING-W1-IMPL` · **branch** `codex/wave1-build-experiment`
**Charge** `orchestration/OWNER-DIRECTIVES-2026-08-14.md` §6, Ruling W1
**Specification** `reports/BAR-AUDIT-WORLD-20260814.md` §5.1–§5.6
**Instrument** `corpus/80-methods/m-instance-bars.mjs` (`--selfcheck` green, five plausible-near-miss controls)

---

## 1. The short version

The five predicates the ruling named are implemented, and the world has been re-measured against
them. **The numbers went down, and that is the point** — the world did not get worse this morning,
the bar got real. Where the old form of a bar was passing something a player would notice, the new
form now says so.

The honest headline is more interesting than "everything failed", because it isn't that:

| Item | Old form | New form | What changed |
|---|---|---|---|
| `RI-WLD04` M18 | 78/78 pairs pass | **77/78** | the magnitude floors were *earned* — see §3 |
| `RI-WLD04` M19 | 13/13 elements pass | **12/13** | Valus Ridge's rock flutes sit in two quadrants of four |
| `RI-WLD07` §4 | world mean 10.07°, in band | **median region 5.32° against a ≥6° target** | the two steep regions were carrying eleven |
| `RI-WLD02` | every density metric passes | **0/13 regions own a POI class** | the POI system is early — see §5 |
| `RI-WLD09` | V1–V9 all pass | **0/5 tracts can be located in the world** | a coordinate-frame mismatch nobody had reason to look for |

Two of those five bit hard, two bit gently, and one — M18 — mostly held up under a much stricter
reading, which is a genuinely good result for the region work.

**Arm B of `RI-WLD15` has not run.** `RI-WLD15` and `RI-WLD16` remain `not_run`, correctly. What
exists now that did not this morning is a validated arm-B instrument that needs one command and a
quiet box; §7 is honest about the cost.

---

## 2. Verifying the derivation before encoding it

The brief asked that any figure taken from the mined Morrowind census be re-derived rather than
copied, and that was worth doing.

**The 20 pp weather floor is sound, end to end.** Recomputing all 36 Vvardenfell pairwise L1
distances from `morrowind-region-census.json` reproduces min 20 pp, median 90 pp, max 200 pp
exactly. Going one step further back, to the wikitext in the local UESP extract: Sheogorad is
`clear 15 / cloudy 40 / foggy 10 / overcast 15 / rain 10 / thunder 10` and West Gash is
`15 / 30 / 15 / 20 / 10 / 10`, summing to 20 pp by hand, and that pair is genuinely the closest of
the 36. The place-type Jaccard ceiling of 0.727 (Bitter Coast/Grazelands) reproduces too. Both
recomputations now run inside `--selfcheck`, so the figures cannot drift from the data silently.

**One derivation had to be designed rather than copied, and it matters.** The audit specified
"weather vectors differing ≥ 20 pp L1". Our thirteen regions use **41 region-specific weather state
names** (`canopy_dim`, `queen_agitation`, `sea_squall`…), so comparing raw state sets puts almost
every pair 200 pp apart by construction and the axis passes automatically — the same
instrument-validity failure the ruling exists to stop, one level down. Morrowind's REGN records
share an eight-word vocabulary, which is what makes 20 pp mean anything. So each state is bucketed
by the two things a player perceives — light level and sightline band — and the **stationary**
distributions of those buckets are compared. That choice is recorded in `RI-WLD04` M18, because a
successor who changes it will change every number in §3.

---

## 3. `RI-WLD04` M18 — the floors were mostly already earned

Four axes gained magnitude floors: weather ≥20 pp L1, audio ≥50% of *each* bed's assets differing,
hazard ≥15% areal occupancy, and slope on Cramér's V ≥ 0.20 instead of a bare χ².

| Axis | Counted as differing, old | New | Note |
|---|---:|---:|---|
| ground albedo | 76/78 | 76/78 | unchanged |
| slope histogram | 78/78 | **75/78** | χ² passed every pair; V ≥ 0.20 drops three |
| flora / fauna / architecture | 78/78 | 78/78 | unchanged |
| audio bed | 78/78 | **78/78** | minimum observed difference is **67%** of the bed |
| weather | 78/78 | **78/78** | minimum observed L1 is **49.4 pp**, against a 20 pp floor |
| fog extinction | 66/78 | 66/78 | unchanged |
| hazard | 0/78 | **0/78** | **not measurable** — see below |
| landform *(new, compulsory)* | — | **77/78** | `RI-WLD16` §4's tenth axis, folded in |

**Result: 77 of 78 pairs pass.** The weather and audio axes cleared their new floors comfortably —
our regions genuinely sound and weather differently, and the old "any difference" wording was
under-claiming work that had actually been done. That is worth saying plainly: this part of the
world was built well, and the tightened bar confirms it rather than punishing it.

The single failing pair is **Deep Marshes / Western Rootlands** at 7 of 10, failing the compulsory
landform axis: both declare `levee-and-backswamp` *and* `anastomosing` drainage. `RI-WLD16` §1
anticipated exactly this — it permits the shared macro-form on condition the two are "separated by
drainage load", and they are not yet. A named, cheap piece of work for whoever owns landform.

**The hazard axis is honestly unmeasurable and is scored as not-differing on all 78 pairs.**
`hazards.json` declares which regions a hazard applies to and nothing about how much ground it
covers, so "occupies ≥15% of each region" has no field to read. Counting an axis as differing when
its magnitude cannot be checked is precisely the habit the ruling forbids, so the conservative
reading is the right one — but this is a *data* gap, not a design failure, and the item records the
falsifier: fix `hazards.json` (an `area_fraction` or footprint per hazard), not the bar.

---

## 4. `RI-WLD07` §4 — where the aggregate was hiding the most

This is the clearest illustration of the ruling in the whole set.

- Area-weighted **world mean slope: 10.07°**, comfortably inside the 6–14° band. The old row passes.
- **Median region: 5.32°**, below the band. **7 of 13 regions sit under 5.5°**; only **4 of 13** are
  inside 6–14°. Valus Ridge (30.28°) and the Salt Hills (16.62°) carry the average for everyone.

All thirteen regions *do* sit inside their `RI-WLD16` §3 landform-class envelope, and all thirteen
inside their relief envelope. That is a real pass and it is why pointing this row solely at the
class envelopes — the audit's literal suggestion — would have made the bar **weaker**: those
envelopes are deliberately wide, built to catch a playa modelled as a ridge, not to tune a slope.
So the implementation binds three ways at once, which is the ruling read properly rather than
literally:

1. **every region** inside its class envelope (worst-constituent form: no region may be the wrong shape);
2. **the median region ≥ 6°** (quantile form: two steep regions may not carry eleven flat ones);
3. **no region under 3°** (the old hard floor, now binding per region).

The quantile is deliberate and the ruling's own falsifier is why. Binding *every* region to 6–14°
would fail the Eastern Rootlands for being a tidal flat, which is exactly the "pathological cell in
a corner of the map" the ruling warns against. A tidal flat ought to be flat; a province ought not
to be.

Two rows — "land below +5 m: 35–50%" and "land above +100 m: ≥12%" — were **demoted to descriptive**
rather than re-scoped, because they have no honest per-region form: every region in a coastal marsh
is either almost entirely below 5 m or almost none of it, and any per-region band would be invented.
Their per-region job is done properly by the relief envelope. Saying so is better than leaving two
aggregate rows in place that look binding and are not.

---

## 5. `RI-WLD02` — a real gap, and an early system rather than a broken one

New rows: **D14**, place-type Jaccard ≤ 0.727 on every region pair; **D15**, ≥1 POI class unique to
each region. Both anchored on Vvardenfell's own measured spread (0.267–0.727, eight place types
unique to one region).

Measured today: **13 of 77 measurable pairs are over the ceiling** (three pairs at Jaccard 1.0), and
**0 of 13 regions own a POI class**.

That reads worse than it is, and the reason belongs in the report rather than in a footnote.
`pois.json` currently holds **42 POIs across 4 classes** against this item's 1,060-POI, three-tier
target, and the file **says so itself** — its `declared_incomplete` block names dungeon entrances,
named caves, shrines, signposts and transport stations as not yet placed, owned by pieces still in
flight. Two regions (the Hive, Valus Ridge) have no POI at all yet. So D14/D15 are not reporting a
world that got the POI mix wrong; they are reporting a POI system that is early, which is the
ordinary state of a thing mid-wave. What they add is that **when it does get built, it now has to be
built with region character in it** — and that is much cheaper to honour now than to retrofit.

The item records the matching falsifier: with only four `kind` values, D14/D15 partly measure the
schema rather than the world, and the vocabulary should be widened before anyone is judged on them.

---

## 6. `RI-WLD09` — the finding nobody was looking for

The intended change was small: void tracts relax POI density and must **not** relax landscape
variety (`RI-WLD15` W15-7, now also `RI-WLD09` **V11**). Emptiness is authored; sameness is not.
`RI-WLD15` M-W15-4 had named this check since it was written and no instrument implemented it; it
exists now as check E.

Running it turned up something else. **The five declared void polygons are in a different
coordinate frame from the world.** V-01 "The Drowned Reach" is declared in the Deep Marshes and its
polygon spans x −940…−210, while the world runs x 0…4825 and the Deep Marshes sits at x 2472…3592.
No single offset reconciles them: V-01 would need +3412 in x, V-02 −692. **None of the five tracts
can currently be located in the world.**

V1–V9 all pass regardless, because every one of them reads a metadata field — area, reason,
payoff POI, route, declared walk length — and none reads a position. That is the same shape as the
failures this ruling is about, one layer further down: a record that describes something the world
does not contain. It also quietly disables `RI-WLD02`'s "outside declared void tracts" scoping for
D1/D2/D13, because you cannot exclude a polygon you cannot find.

New row **V10** is the cheapest possible guard: ≥50% of a tract's polygon must fall inside the
region it names. The instrument reports `frame mismatch` and refuses to produce a variety number for
an unlocatable tract, rather than measuring whatever ground the polygon happens to overlap — a
number about the wrong place is worse than no number.

Nothing here is anyone's blunder: `voids.json` has no runtime consumer in `game/src`, so there was
never a moment when the mismatch would have shown up in play. It is exactly the kind of thing that
only appears when someone tries to measure it.

---

## 7. Arm B of `RI-WLD15` — not run, and what it will cost

`RI-WLD15` and `RI-WLD16` remain **`not_run`**. Arm A is a gate, not a verdict, and it stays that way.

**What happened.** `tools/contention.mjs` said GO when I started, flipped to **WAIT** by the time I
reached arm B (load 4.4 per core against a 4.0 ceiling), then cleared again to GO. Rather than
guess, I ran a single-frame smoke test through the shared capture daemon: **it works** — a real
placed frame in the Deep Marshes, 640×360, **143.6 s cold including daemon boot**.

**Why I stopped there, and a correction to my own first estimate.** Arm B as `RI-WLD15` M-W15-2
specifies it is 6 transects × 13 regions × 90 frames = **7,020 frames**. At the capture service's own
published cold-cache rate of 21.9 s/frame that is **42.7 hours of exclusive browser time** — not the
"about six hours" I first wrote here, which was simply wrong and is corrected rather than quietly
edited. Rule 21 would forbid it on a busy box; 42.7 hours makes it unaffordable on any box.

**So arm B as written needs a scoping decision, and that is a finding, not an excuse.** The cost is
dominated by frame count, and three variants are affordable:

| Scope | Frames | Cold cost | What it buys |
|---|---:|---:|---|
| Full M-W15-2 as specified | 7,020 | **42.7 h** | not affordable |
| **All 13 regions, 2 transects, 24 m spacing** | 780 | **4.7 h** | province-wide coverage overnight; W15-6 quantises to 12 s |
| **Worst 2 regions, 2 transects, 8 m spacing** | 360 | **2.2 h** | full-resolution answer where arm A says it is worst |
| Any re-run on the same build | — | **0.4 h** | the daemon's warm cache makes repeats nearly free |

**My recommendation, ruled rather than asked** (rule 0): run the **worst-2-regions variant first** —
the Deep Marshes and Valus Ridge, which arm A ranks worst at 275 s and 312 s unchanging-ground runs.
It is 2.2 hours, it is at the specified 8 m resolution so no threshold needs reinterpreting, and if
those two regions pass, the item's own worst case has been cleared. **Reversible**: if they fail, the
province-wide 24 m variant is the next step and `RI-WLD15` M-W15-2 should be rewritten around it.
**What would overturn this**: if a critic judges that W15-5's "distinct views per 720 m walk" cannot
be compared across regions unless every region is sampled identically, then the 24 m province-wide
run is the only admissible form and the full protocol should be struck as unbuildable.

The instrument already supports `--regions`, so the first variant is one flag away.

**What exists instead, so the owed work is one command rather than a project:**
`corpus/80-methods/m-wld15-armb.mjs`, complete and validated **without a browser**:

- 64-bit DCT perceptual hash, chosen over a downsample because a downsample tracks brightness — an
  exposure control confirms the same scene at two exposures scores Hamming 0, and two genuinely
  different places score ≥12.
- Transect selection reusing arm A's worst three walks per region plus three random, with a control
  asserting the "worst" picks really are the most monotonous.
- Controls that are **realistic**, not empty: the negative control is a walk through *one kind of
  place* with the light drifting and the camera moving forward so props scroll past and no two
  frames are alike pixel-for-pixel. On those, W15-5 rates the monotonous walk at **5 distinct views**
  (below its fail threshold of 7) and the varied walk at **22** (above its target of 10); median
  pairwise Hamming separates them 12 vs 28.
- A suspected weakness in W15-5 — that forward motion alone would make any walk look eventful —
  **was tested and did not materialise**. Recorded either way.
- It refuses to start when the box is over ceiling, and takes one daemon connection so a long pack
  cannot starve another agent.
- **Admissibility is stated in the file** (`ARBITRATION.md` S34): the capture service *places* the
  camera, so these frames are evidence of **appearance** — which is exactly arm B's claim — and are
  **not** evidence of arrival. A verdict citing them for reachability is void.

**Run it with:** `node corpus/80-methods/m-wld15-armb.mjs --selfcheck` then
`node corpus/80-methods/m-wld15-armb.mjs --regions deep-marshes,valus-ridge --json <path>`, on a
quiet box, starting with the two regions arm A ranks worst.

---

## 8. The sweep: the same shape elsewhere in the corpus

**Population searched: all 147 reference items** across every corpus domain, for predicates binding
on a mean, a total, or "any difference" over a population a player meets one at a time. 57 items
produced 85 candidate lines; every one was read.

### Confirmed — the same shape, in priority order

| Item | Predicate | The bad result that passes |
|---|---|---|
| **`RI-WLD07` §5** | "Mean interior floor area — settlement **40 m²**", "small cave **120 m²**", "Mean interior volume — loop dungeon **≥9,000 m³**" | You open **one door at a time**. 150 broom cupboards and 10 halls average to 40 m². The fail floors are means too. *Strongest hit, and it is in the item I amended — §4 was fixed and §5 has the identical flaw three rows down.* |
| **`RI-QST04`** | scoring bands on "mean resolutions ≥ 2.4; mean branches ≥ 1.3", and a **hard fail on "mean resolutions < 2.0"** | You play **one quest at a time**. A majority of linear quests carried by a few elaborate ones passes every band. No per-quest floor on branches or resolutions exists. |
| **`RI-WLD14`** E2 | "Distinct decay **types** in use across the province ≥ 4" | Four decay types all in one city passes while twelve regions show one. Identical in shape to the `RI-WLD02` D15 gap this ruling just closed. |
| **`RI-DLG05`** Step 5 | "≥ 7/10 reachable, **mean time-to-find ≤ 4 minutes**" | Partly guarded by the 7/10 proportion, but the mean can hide one entry that takes twenty minutes. Weakest of the four. |

Suggested repairs, in the ruling's own grammar: for `RI-WLD07` §5, a **floor on the smallest**
interior of each class plus a median (a 6 m² closet should fail on its own); for `RI-QST04`, a
per-quest floor — every quest ≥1 resolution beyond "do the thing", with the mean kept as a
supplementary; for `RI-WLD14` E2, "≥2 decay types visible in every region"; for `RI-DLG05`, replace
the mean with a p90. **I have not made these edits.** They are other items' territory with pieces in
flight against them, and amending a live bar is an orchestrator's call — the same discipline the
audit applied to the five I was given. They are filed here with predicates spelled out, ready to be
ruled on in one line.

### Cleared, and why — the part a sweep that reports only hits would have hidden

- **"Any difference" as a *fail* condition (8 lines: `RI-AI05`, `RI-WLD10`, `RI-WLD13`, `RI-JRN03`,
  `RI-PLT01`, `RI-TRV01`).** These are determinism and equality assertions — *any* difference fails
  the piece. Opposite polarity to the ruling, which is about "any difference" counting as a **pass**.
  The largest single group of grep hits and entirely benign.
- **Frame-data ratios (`RI-CMB02`, `RI-WPN02`, `RI-WPN05`, `RI-AI04`, `RI-CAM04`).** `active/total ≤
  0.16` is a ratio *within one animation*, not an aggregate over a population. False positives.
- **Pixel- and frame-population means (`RI-VIS02`, `RI-VIS03`, `RI-MAG05`).** The population is
  pixels, which a player does not meet one at a time. Out of the ruling's scope by construction.
- **Already in the correct form** — worth naming, because these are the models:
  - `RI-WPN03` `UNQ`: "**≥ 1 for every weapon**; mean ≥ 2.0 across the roster" — per-constituent
    floor *and* an aggregate. Exactly right.
  - `RI-LOR01`: "**min-over-axes** across the three axes, **never the mean**" — the ruling, written
    down before the ruling existed.
  - `RI-WLD07` §5's bonfire row: "≤6 min from **any** road point, **median** ≤3 min" — worst
    constituent *and* a quantile, three rows above the interior-area rows that have neither.
  - `RI-DLG02` §5: mean words 22–40 bounded by *two* tail requirements (≥15% over 60 words, ≥20%
    under 12) plus a cap on how many NPCs may fall below 120 words.
  - `RI-AI01` (99th percentile alongside the mean) and `RI-QST01` (monotonic mean stakes with a
    stated ≥2 effect size on any drop).
- **World-level variety totals** (`RI-STL02` distinct owners ≥240, `RI-QST02` patterns ≥10,
  `RI-AUD03` voices ≤8). Variety floors and caps with no per-constituent experience claim attached.
  `RI-WLD14` E2 is the one exception above, because it *is* a claim about what you see in a place.

---

## 9. The null controls, and what they caught

Every check has a control that is the **plausible wrong answer**, and each asserts **both**
directions — the old predicate passing and the new one failing — because a control that could never
have passed is not a control. This was not ceremony; it caught four real defects before any number
was published:

1. **The audio metric was wrong.** "≥50% of assets differ" implemented as Jaccard distance gives
   exactly 0.50 when one asset of three is swapped — the audit's own named near-miss ("one extra
   bird sample") would have cleared the floor on a technicality. Measuring the shared fraction
   against *each* bed's own size gives 0.33, and the control went red until it did.
2. **The C control was toothless.** My first version gave the flat regions landform classes that
   *matched* their flat terrain, so it passed and proved nothing. Rebuilt as seven flat regions
   *declaring* karst towers and escarpments — a world whose design says hills and whose ground says
   plain.
3. **The arm-B controls were the empty-world trap again.** Featureless gradient frames made the
   pHash pure noise. Rebuilt with horizons, landmark silhouettes, props, forward motion and drifting
   light — and only then did the metric's real behaviour show.
4. **`m-wld15-monotony.mjs` could not be imported.** Its CLI ran at module load, so importing it
   exited the importer. Fixed with an entry-point guard; a method file must be safe to import.

The audit's own lesson, applied: an empty world fails almost anything by accident.

---

## 10. What I could not do, plainly

- **Arm B of `RI-WLD15` did not run.** §7 gives the cost, the reason, the smoke-test proof that the
  path works, and the command. `RI-WLD15` and `RI-WLD16` stay `not_run`. **This is still owed.**
- **The hazard occupancy axis cannot be measured** from shipped data; `hazards.json` has no
  footprint field. Scored conservatively as not-differing on all 78 pairs and flagged in the item.
- **`RI-WLD04` M17 and M20 were not run** — the blind screenshot and audio tests need a browser and
  fresh judges. Nothing in this report rests on them.
- **`en.uesp.net` is egress-blocked from this container** (403 via curl, `EGRESS_BLOCKED` via
  WebFetch). All Morrowind figures come from the local 2019-11-07 UESP extract, which predates the
  ESO *Blackwood* chapter. No live-wiki verification happened.
- **I made no edits under `game/`.** The bar is not the world; `W1-30F` owns terrain and vegetation.
  The `voids.json` frame mismatch (§6) is a world-data defect I have reported and deliberately not
  fixed.
- **The four sweep hits in §8 are reported, not repaired**, for the reason given there.
- **Git index contention is severe, and it silently reverted finished work twice.** Mid-task another
  agent's bank committed my in-flight files *and reset the working tree*, dropping edits that had
  already been made and verified. It hit twice:
  1. **`m-instance-bars.mjs`** lost three fixes. Caught only because the published slope figure
     (8.28°, the raster derivation) did not match the 10.07° I had verified by hand an hour earlier.
  2. **`RI-WLD04`'s M18 and M19 replacements** — the single most important edit in this task — were
     reverted while the four smaller edits to the same file survived. Caught only by grepping the
     **HEAD blob** for a string I knew I had written, rather than trusting that a commit had happened.

  Both were re-applied and re-verified. The lesson for successors is concrete: **`git status` clean
  and "the commit succeeded" are not evidence your work is in the tree.** Check the committed blob:
  `git show HEAD:<path> | grep '<a string you added>'`. `bank.mjs` timed out at 180 s (exit 143) and
  again later; `git commit --only` on this index takes minutes and repeatedly lost the `index.lock`
  race — at one point a `git gc --prune=now` was running with several agents' commits queued behind
  it. Staging the file and letting the next bank sweep it turned out to be the reliable path, which
  is worth knowing rather than rediscovering. The orchestrator has since banked *"Ruling O1: the
  orchestrator caused the silent-clobber bug and owns the fix"*, so this is already in hand.

---

## 11. Paths touched

**Amended (bar):** `corpus/50-world/RI-WLD04-region-identity.md` (M18, M19, differentiation
contract, scoring note, how-we-lose) · `RI-WLD07-verticality-and-interiors.md` (§4) ·
`RI-WLD02-density-per-minute.md` (D14, D15, scoring, how-we-lose) ·
`RI-WLD09-the-opacity-budget.md` (V10, V11) · `RI-WLD15-within-region-variety.md` (M-W15-4 pointer).

**New (instrument):** `corpus/80-methods/m-instance-bars.mjs` ·
`corpus/80-methods/m-wld15-armb.mjs`.

**Fixed:** `corpus/80-methods/m-wld15-monotony.mjs` (entry-point guard only; no threshold or
measurement changed).

**Evidence:** `reports/ruling-w1/instance-bars.{json,txt}` · `reports/ruling-w1/wld15-armA.{json,txt}`.

**Not touched:** anything under `game/`.
