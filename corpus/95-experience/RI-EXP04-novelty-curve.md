---
id: RI-EXP04
title: The novelty curve — the rate must decay, the weight must not
kind: graph
side: neutral
judges: [experience.novelty.curve, experience.novelty.decay, experience.novelty.longtail]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

How often does the game show the player something it has never shown them before?

The naive answer — *as often as possible, forever* — is wrong, and it is wrong in a way the corpus
currently mandates. `RI-WLD05` requires **≥22 of the 30 strangeness elements to be encounterable in
the first 30 minutes**. `BAR-CRITIQUE-01` §4 W1 calls this the most consequential wrong threshold in
the corpus and it is right: 73% of the world's entire novelty vocabulary spent inside half an hour
leaves nineteen and a half hours of recombination. Neither reference game does this. Both would fail
it. Morrowind's Telvanni towers, Vivec, the Ghostfence, the Dwemer and the Sixth House arrive over
dozens of hours; Anor Londo is hour ten.

But the opposite demand — that the rate stay high and *flat* — is equally wrong and is the trap the
correction walks into. A world that shows you a genuinely new kind of thing every twelve minutes at
hour eighteen is a world with no vocabulary: nothing recurs, nothing accumulates, nothing means
anything, and the player never gets the specific pleasure of recognising something. Novelty that
never decays is noise.

The resolution is that **novelty is two curves, not one**, and they go in opposite directions:

> **The rate of new things must decay. The weight of new things must not.** Hour one shows you nine
> things and they are all small. Hour sixteen shows you two, and one of them makes the previous
> fifteen hours mean something different. A build where both curves fall is dead by hour ten; a
> build where the rate stays flat is a build with no vocabulary; a build where the rate decays and
> the weight rises is both reference games.

The heaviest class of novelty — the **revision**, a thing that changes what already-seen content
meant — is *only possible late*, because it requires a stock of prior experience to revise. That is
the mechanical reason the weight curve rises, and it is why front-loading the vocabulary does not
merely spend novelty early: it destroys the material the late game is made of.

This item owns `experience.novelty.*`. `RI-EXP03` owns the shape of the hours and **cites** this
item's per-hour rate as an input to its sag composite; `RI-WLD05` owns the *inventory* (that the 30
elements exist, are placed ≥6 times, and are not generic fantasy) and, under the amendment proposed
in §H, cites this item for their *distribution*. `RI-EXP02` owns whether any of it was remembered.

---

## The reference artifact

### A. The closed element register (this is the instrument; everything else is arithmetic)

A **first-time event** is the player's first *encounter* — not the world's first placement — with a
member of a **closed, pre-declared register**. The register is the whole instrument: an open-ended
"anything the critic thinks is new" definition lets a motivated agent find one first per hour
forever, and the number becomes decorative.

`corpus/95-experience/RI-EXP04.elements.json` is that register. It is **generated, not authored** —
`tools/experience/elements-build.mjs` assembles it from six existing sources, so a builder cannot add
a novelty element without adding the content that carries it:

| Class | Source of truth | Weight | Example |
|---|---|---|---|
| **N1 — strangeness element** | the 30 in `RI-WLD05` §2, by id | **2** | first tidewalk; first hackwing flock; first nest-mound interior |
| **N2 — creature archetype** | `game/data/combat/enemies/*.json` grouped by `archetype`, cross-checked against `RI-AI05`'s role list | **2** | first ranged harasser; first shielded archetype; first pack hunter |
| **N3 — architecture vocabulary** | `RI-WLD04` region identity + `RI-WLD07` interior kinds, by declared vocabulary id | **1** | first root-tunnel; first Xanmeer interior; first kiln-dome |
| **N4 — systemic rule** | `RI-WLD05`'s `S`-flagged elements + `game/data/progression/*` + any rule that changes what the player can do | **3** | rot; egg-law; the tide clock; marsh-fever; the mud remembering |
| **N5 — faction / social structure** | `game/data/progression/factions.json`, by faction id, first contact | **2** | first Naga settlement that will talk; first Imperial writ authority |
| **N6 — revision** | declared in `game/data/quests/*.json` as an `outcomes[].revises` edge, and verified by a changed dialogue/journal/world-flag state on already-seen content | **5** | the prophecy is propaganda; the disease is the antagonist's; the wall you have seen from every region is a prison |

**Weights are the point.** N6 is worth five N3s because a revision is the only class that pays back
the hours already spent, and it is the only class that cannot be front-loaded — you cannot revise
something the player has not seen.

**What does NOT count, ever** (each of these is how the number gets faked):

- A new *instance* of a class already encountered. The eleventh hackwing is not a first.
- A new *name* on an existing archetype. "Elder Wamasu" with the same moveset is not an N2.
- A new item, weapon or spell — those are `RI-PRG08`'s and `RI-WLD05`'s, and item churn is the
  cheapest fake novelty in the genre.
- A place the player *passed*. An N1/N3 fires only on **perception at interaction distance**: the
  element's entity within 25 m, in the camera frustum, for ≥ 2 s, unoccluded — or, for systemic
  classes, the rule *acting on the player* (rot consumed food; the tide closed a road; the fog
  infected them).
- Anything the player was *told about* but did not encounter. An NPC mentioning the Hive is
  `RI-CMP01`'s trivial tier and scores zero here too.

### B. Reference distributions (canonical-recall — **and the numbers here are the untrustworthy part**)

Reconstructions of roughly how novelty arrives in each reference game. **No critic may cite these as
measured.** The binding claims are the *shapes*: rate falls, weight does not, and the heaviest
events are late.

**Morrowind, ~20 h.** Estimated firsts per hour: `9, 7, 6, 5, 4, 4, 3, 3, 3, 3, 2, 3, 4, 3, 3, 2, 2, 2, 2, 3`.
Fit: roughly `N(h) ≈ 8.4 · h^-0.42`, i.e. an hour-1-to-hour-10 ratio near 2.6 : 1.
The revisions (N6) are almost all after hour 12: corprus is the antagonist's own disease; the
Nerevarine prophecies are partly Temple propaganda; the Tribunal are thieves; Vivec tells you the
truth and it is worse. The heaviest single hour of the run is hour ~15, and it contains **two**
firsts.

**Dark Souls, ~20 h.** Estimated firsts per hour: `8, 6, 6, 5, 4, 4, 4, 5, 6, 4, 3, 3, 2, 2, 2, 2, 3, 2, 2, 2`.
Fit: roughly `N(h) ≈ 7.6 · h^-0.38`. Note the **bump at hours 8–9**: Sen's Fortress and Anor Londo.
The curve is not smooth and is not supposed to be — a monotone fit with a good R² would itself be a
finding, because it would mean the run has no landmarks.

The revisions are late and structural: the Lordvessel makes the whole map re-traversable; Gwynevere
is an illusion; Frampt and Kaathe are two liars with opposite agendas; the "prophecy" is a system for
recycling undead.

**What both share, and what this item measures:**

1. The rate falls by a factor of **2.5–3× from hour 1 to hour 10** and then **flattens rather than
   reaching zero**.
2. The rate is **not monotone**. Both have a mid-run bump where a new act opens.
3. The *weight* is roughly flat or rising: fewer things, bigger things.
4. **The final hours still contain firsts.** Dagoth Ur's heart-chamber and the Kiln are both places
   the player has never seen, at hour twenty, in games that had spent nineteen hours.

### C. The required curve (binding)

Fit `N(h) = N₁ · h^(−α)` by ordinary least squares on `log N` vs `log h`, over hours 1..H, excluding
hour 1 from the fit and using it only as the reported intercept anchor (hour 1 is `RI-EXP01`'s and is
measured there).

| id | Requirement | Bar | Below bar | We lose |
|---|---|---|---|---|
| **NV1** | **Decay exponent** `α` | **0.25 ≤ α ≤ 0.48** | 0.15–0.24 or 0.49–0.60 | α < 0.10 or α > 0.75 |
| **NV2** | **Hour-1 : hour-10 rate ratio** — the direct form of NV1, since the ratio is exactly `10^α` | ≤ 3.0 : 1 and ≥ 1.8 : 1 | ≤ 4.0 : 1 | > 5 : 1 |
| **NV3** | **Sustained rate** — firsts per hour, rolling 3-hour mean, through hour 10 | ≥ 1.5/h (i.e. ≥ 1 per 40 min) | 1.0–1.4/h | < 1.0/h |
| **NV4** | **Weighted curve** `α_w`, fit the same way over Σweights per hour | **−0.10 ≤ α_w ≤ +0.25** | +0.26 to +0.45 | α_w > 0.60 |
| **NV5** | **Non-monotonicity** — hours whose rate exceeds the fitted curve by ≥ 40% (an act opening) | ≥ 2, at least one after hour 8 | 1 | 0 |
| **NV6** | **Fit quality** `R²` of the unweighted fit | **0.35 ≤ R² ≤ 0.90** | 0.20–0.34 | R² > 0.95 |

**NV1's band is derived, not asserted.** The hour-1-to-hour-10 ratio is `10^α`. `BAR-CRITIQUE-01`
§2.3 requires the decay to be no steeper than 3 : 1, and `log₁₀ 3 = 0.477`, giving the upper edge.
The lower edge is the "must decay rather than stay flat" requirement made numeric: `α ≥ 0.25` is a
ratio of ≥ 1.78 : 1, which is the least decay compatible with a world that has a vocabulary at all.

**NV6 is the anti-fabrication check and is deliberately two-sided.** A curve with `R² > 0.95` over
twenty hours has not been measured; it has been fitted by someone with a spreadsheet, or the content
was placed to satisfy the curve, which is worse. Both reference games are lumpy. Lumpiness is a
positive result.

**NV4 is the item's actual claim** and the one that inverts W1. The unweighted rate must fall; the
weighted rate must not. A build that satisfies NV1 by decaying and fails NV4 has decayed in
*importance too*, which is the hour-ten death this whole area exists to detect.

### D. The long-tail rule (binding)

Decay is not permission to stop.

| id | Requirement | Bar | Fail |
|---|---|---|---|
| **LT1** | **No 90-minute window after hour 2 contains zero first-time events.** Windows slide in 15-minute steps over the concatenated chain. | 0 empty windows | ≥ 1 → **hard fail** |
| **LT2** | **The final hour contains ≥ 2 firsts**, of which **≥ 1 has weight ≥ 3** (an N4 systemic rule or an N6 revision). | ≥ 2, ≥ 1 heavy | 0 firsts → **hard fail** |
| **LT3** | **Revisions are back-loaded.** `N6_total ≥ 4` across the run, with **≥ 3 after hour 10** and **≥ 1 in the final 3 hours**. | met | `N6_total < 2`, or 0 after hour 10 → **hard fail** |
| **LT4** | **The last new place.** The final 3 hours contain ≥ 1 interior or exterior area the player has never loaded — the Red Mountain / Kiln property. | ≥ 1 | 0 |
| **LT5** | **Vocabulary completion.** ≥ 26 of `RI-WLD05`'s 30 elements encountered by hour 10; **all 30 by hour 18**; the remaining 4 are late by design and are named in the data as such. | met | < 22 by hour 10 |

LT1 is the hard floor and it is inherited verbatim from `BAR-CRITIQUE-01` §2.3. It is the number that
catches the specific failure mode where the mean passes and hour twelve is empty — and it is the
same failure `RI-EXP02`'s `blank_hours` catches from the memory side. **Both must be read together;
a build can pass this item's mean and fail `RI-EXP02`'s hour twelve, and vice versa.**

### E. The recombination clause

After the raw firsts decay, something has to fill hours 11–20 or the run is padding. The corpus's
answer is not "more elements". It is **combination**: two already-seen systems meeting for the first
time is itself a first, and it is the only class of novelty that scales without new content.

A **combination-first** (`NC`) is the first observed co-occurrence of a specific *pair* of the systems
enumerated in `RI-CMP01`, in a way that produced a different outcome than either alone. Combination
firsts are counted **separately** from N1–N6, are worth **weight 2**, and are reported as
`combination_firsts_per_hour`.

| id | Requirement | Bar | Fail |
|---|---|---|---|
| **RC1** | `combination_firsts` in hours 11–20 as a fraction of all firsts in hours 11–20 | ≥ 0.30 | < 0.10 |
| **RC2** | Combination firsts are **demonstrated, not declared** — each resolves to a `RI-CMP01` cell whose harness probe fired | 100% | any undemonstrated |

RC1 is the numerical link between this item and the whole `RI-CMP*` set, and it is the reason G2 and
G3 are one problem: a build with a sterile seam has nothing to recombine, so its late hours have
nothing in them, so it fails here. **An `RI-CMP01` floor failure and an `RI-EXP04` late-hour failure
are usually the same defect seen from two sides**, and a verdict that reports one without checking
the other has under-diagnosed.

### F. The two ways the exponent goes wrong, and what each means

`α` out of band is a symptom, not a diagnosis. The critic must state which:

| Observed | Diagnosis | Refer to |
|---|---|---|
| `α > 0.60`, hour-1 count high | **The W1 failure.** The vocabulary was spent in the opening; everything after is recombination of things seen in hour one. | `RI-WLD05` distribution (§H), `RI-WLD04` |
| `α > 0.60`, hour-1 count normal | **Content ran out.** The world is not deep enough for 20 hours. | `RI-WLD02`, `RI-WLD04` |
| `α < 0.15`, hour-1 count < 7 | **The opening under-delivered.** The curve is flat because it started low. This is `RI-EXP01`'s finding, not this item's. | `RI-EXP01` |
| `α < 0.15`, hour-1 count ≥ 7, weights all tier 1–2 | **Padding.** Late hours are being topped up with cheap firsts to hold the rate flat. Check `N6_total` and `NV4`. | this item, `N6` |
| `α` in band, `α_w > 0.45` | **Decayed in importance.** The rate is textbook and the late game is small. The hour-ten death. | `RI-QST06`, `RI-EXP03` sag |

---

## Comparison method

**Step 0 — build and freeze the register, before play.** `tools/experience/elements-build.mjs
--data game/data --wld05 corpus/50-world/RI-WLD05-strangeness-bar.md --ai05
corpus/10-combat/RI-AI05-roster-archetypes.md --out corpus/95-experience/RI-EXP04.elements.json`
then `sha256sum` it into the wave's artifacts. **The register is frozen before the playthrough
starts and may not be regenerated after.** A register regenerated after the run is inadmissible and
the item scores 0 — that is the single easiest way to fake this number and the hash is the only
defence.

**Step 1 — play.** This item reads the existing chain (`PLAYTHROUGH-CRITIC.md` §3/§5). It does not
commission its own run. The playing agents are never told the register exists.

**Step 2 — first-encounter extraction.**

```bash
node tools/experience/novelty-curve.mjs \
  --chain reports/sessions/exp-w<N>-s01..s13 \
  --elements corpus/95-experience/RI-EXP04.elements.json \
  --cells   corpus/95-experience/RI-CMP01.cells.json \
  --out reports/experience/w<N>/novelty-curve.json
```

Emits, per element: `{element_id, class, weight, first_frame, first_session, t_hours, evidence:[trace lines], perception_check}`.
`perception_check` records which rule fired (25 m + frustum + 2 s unoccluded, or systemic-rule-acted-on-player,
or `first_visit` from `A-EXP2`). An element with no `perception_check` is **not counted** even if it
exists in the data — this is the "the player passed it" exclusion and it is the difference between a
world audit and a novelty measurement.

**Step 3 — fit.** `novelty-fit.mjs` emits `α`, `α_w`, `R²`, per-hour counts and weights, the residual
series, the rolling 3-hour mean, the LT1 sliding-window scan, and the NV5 bump list. Both fits are
reported with their **confidence intervals**; an `α` whose 95% CI spans the whole band is reported as
`underpowered` and the item is capped at 6 rather than scored on a point estimate.

**Step 4 — revisions.** N6 events are the only class that cannot be detected structurally, because a
revision is a *semantic* change. Each declared `outcomes[].revises` edge is verified by a paired
observation: the same topic/journal/world-flag queried before and after, showing different content on
**already-encountered** material. An N6 whose target the player never encountered is not a revision —
it is an N1 — and is downgraded automatically.

**Step 5 — the sabotage control (mandatory, `PLAYTHROUGH-CRITIC.md` §4.5).** This item is the primary
detector for **SAB-N (novelty stripped)**: the orchestrator replaces the nth distinct instance of each
novel element class with the 1st and adds no new element classes after minute 30, from the same
commit, by data filter. Two matched 90-minute segments, labelled A/B by recorded coin flip. The
critic states which is sabotaged and how it knew **before the reveal**. Required margin:
**first-time events per hour in hours 2–4 lower by ≥ 60%.** Failure to separate ⇒ **`VOID`, not
`FAIL`**.

**Step 6 — cross-check.** `novelty-curve.json` records `exp03_agreement` (does the sag window contain
an LT1-empty window?) and `exp02_agreement` (does any `blank_hour` in `RI-EXP02`'s M3 recall coincide
with a low-novelty hour?). A `blank_hour` that is *not* a low-novelty hour is a memory finding; one
that *is* is a content finding, and the two go to different owners.

**Step 7 — the negative artifact.** For every element with no first-encounter, the extraction records
the search that would have found it and its empty output, plus whether the element exists in
`game/data/**` at all. "Element 29 never fired" and "element 29 does not exist" are different
verdicts and must not be conflated (`RI-WLD05` M23 owns the second).

---

## Scoring

Native scale 0–100, translated per `SCORING.md` §1.2.

| Component | Weight | Full marks |
|---|---|---|
| Decay in band (NV1, NV2) | 20 | 0.25 ≤ α ≤ 0.48 |
| **Weight curve (NV4)** | **20** | −0.10 ≤ α_w ≤ +0.25 |
| Sustained rate (NV3) | 10 | ≥ 1.5/h rolling through hour 10 |
| Shape honesty (NV5, NV6) | 10 | ≥ 2 bumps, 0.35 ≤ R² ≤ 0.90 |
| **Long tail (LT1–LT5)** | **25** | all five |
| Recombination (RC1, RC2) | 15 | ≥ 0.30 of late firsts are demonstrated combinations |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 85 | Meets the bar | 8 |
| 70–84 | Below bar — named remedy required | 6 |
| 50–69 | Loses outright | 4 |
| < 50 | We lose | 2 |

**Native → ladder anchors:** native 55 → ladder 4; native 75 → ladder 6; native 88 → ladder 8.
Ladder 9 requires beating a reference distribution on this dimension with artifacts — which, given
§B's provenance, is effectively unreachable and should be. There is no defensible ladder 9 here until
someone instruments a reference game, and nobody in this project can.

**Hard fails — any one caps the item at 2 and, per `PLAYTHROUGH-CRITIC.md` §2, makes the wave `DEAD`:**

1. **LT1 violated** — any 90-minute window after hour 2 with zero first-time events.
2. **LT2 violated** — the final hour contains no firsts. The game stopped before the player did.
3. **LT3 violated** — fewer than 2 revisions in the run, or zero after hour 10. Twenty hours that
   never reinterpreted themselves.
4. **`α > 0.75`** — novelty collapse. Everything was in the opening.
5. **The register was not frozen before play**, or was regenerated after, or its hash does not match
   the wave artifact.
6. **`RI-WLD05`'s unamended M24 is still in force and was satisfied** — i.e. ≥ 22 of 30 elements
   encounterable in the first 30 minutes. Under §H this is a *distribution* defect and it is a hard
   fail here even if every other number in this item passes, because it guarantees the failure LT1
   and NV4 exist to catch. (Until the §H amendment lands, this fail is recorded as `pending_amendment`
   and reported to the orchestrator rather than applied — this item may not fail a build for
   satisfying a rule that is still binding on it.)
7. **The sabotage control was not run, or failed to separate at the ≥60% margin** ⇒ **`VOID`**.
8. **The curve could not be produced** (`novelty-curve.mjs` absent, chain incomplete, `A-EXP2`
   missing so `first_visit` cannot fire) — `unmeasurable ⇒ 0`, fail-closed.

---

## How we lose

- **The register grows during the wave.** Somebody notices hour fourteen is empty and adds three
  elements to `RI-EXP04.elements.json`. The curve improves and measures nothing. The freeze-and-hash
  in step 0 is the only thing standing between this item and a tautology, and it will be the first
  thing skipped when the wave is late.
- **Firsts are counted from the data files.** A static pass over `game/data/**` says all 30 elements
  exist, distributed nicely across regions, and the curve is beautiful. The player walked past nine
  of them in the dark. The perception rule in §A is the defence and it is expensive to implement,
  which is exactly why it will be argued down to "the element is in the loaded region".
- **We satisfy the rate with N3s.** Architecture vocabulary is weight 1 and is the cheapest class to
  manufacture — a new doorway shape is a first. Twenty hours of new doorway shapes passes NV1, NV3
  and LT1 and fails NV4, and the build is dead. NV4's weight of 20 in the score exists for this
  single failure.
- **The revisions never get built** because a revision is the most expensive content in the game: it
  requires the earlier content to exist, to have been encountered, and to be *rewritten* rather than
  extended. It is always the thing cut when a wave runs short, and it is the thing the last hour is
  made of. LT3 is a hard fail rather than a scored component for that reason.
- **We fix W1 by inverting it.** The obvious reading of this item is "hold novelty flat", and a
  builder who reads it that way will spread the 30 elements evenly across 20 hours, produce `α ≈ 0`,
  give the player an opening with three strange things in it, and fail `RI-EXP01` instead. NV1's
  *lower* bound and §F's diagnosis table exist to make the two failures distinguishable — but the
  corpus will still be read quickly by someone under pressure.
- **The bump gets smoothed.** NV5 requires the curve to be lumpy, which means somebody has to defend
  an hour that is deliberately quieter so hour nine can be loud. Under any per-hour quality pressure
  that hour gets filled, `R²` climbs past 0.95, and the run turns into a gradient. A perfectly smooth
  novelty curve is a designed curve, and NV6's upper bound is the only thing in the corpus that says
  so.
- **`combination_firsts` are declared rather than fired.** RC2 exists because the cheapest way to fill
  hours 11–20 on paper is to assert that alchemy and faction rank interacted. `RI-CMP01`'s probe
  requirement is the shared defence and the two items must be scored in the same wave or neither
  number means anything.
- **Nobody notices that this item and `RI-WLD05` contradict each other**, both pass their own
  measurement, and the build satisfies M24, front-loads the vocabulary, and dies at hour ten with two
  green verdicts. Hard fail 6 exists to make that state impossible to reach silently, and §H is the
  actual fix.

---

## The `RI-WLD05` amendment this item requires (§H — **proposal only, not applied here**)

This item does not edit `RI-WLD05`. Per `PLAYTHROUGH-CRITIC.md` §2 an experience item may not amend a
reference item outside `corpus/95-experience/`. The amendment below is **proposed** to `RI-WLD05`'s
owner and to the orchestrator, closing `BAR-CRITIQUE-01` wrong-bar **W1**. Until it is applied, hard
fail 6 above is recorded as `pending_amendment` and not enforced.

**Proposed change to `RI-WLD05`.** Replace the first-30-minutes threshold in the item's bar statement
(currently *"≥22 must be encounterable in the first 30 minutes of play"*) and the M24 audit with a
**distribution** requirement, and delegate the curve here:

| | Current | Proposed |
|---|---|---|
| First 30 min | **≥ 22** of 30 encounterable | **≤ 12** of 30 encounterable |
| By hour 10 | not specified | **≥ 26** of 30 encountered |
| By hour 18 | not specified | **30** of 30 encountered |
| Sustained | not specified | **no 90-minute window after hour 2 with zero first-time elements** — measured by `RI-EXP04` LT1, not by `RI-WLD05` |
| M23 (≥6 placed instances per visual element) | unchanged | **unchanged** |
| Systemic count (≥8 `S`) | unchanged | **unchanged** |
| M24's method | scripted 30-min session, count elements encounterable | **retained but re-thresholded**, and its result becomes an *input* to `RI-EXP04` rather than a standalone pass/fail |
| Score table rows citing `M24 ≥22 / ≥18 / 15–17` | — | re-express as `M24 ≤ 12` with the hour-10 and hour-18 completions, since under the amendment a *high* M24 is a defect |
| `## How we lose` | *"M23's ≥6-instances rule and M24's first-30-minutes rule together forbid it"* | replace the M24 clause: the ≥6-instances rule alone forbids hero-asset strangeness; the distribution rule forbids front-loading |

**A concrete, buildable split of the 30** (advisory — `RI-WLD05`'s owner may choose a different
twelve; the count is what binds). The twelve that stay in the first 30 minutes are the ones that are
*everywhere* or that the opening settlement is literally made of, per `RI-EXP01` §D:

> **First 30 min (12):** 1 Hist-tree architecture · 2 Xanmeer ziggurats (as horizon silhouette) ·
> 6 nest-mounds · 12 hackwing flocks · 13 wamasu · 15 egg-tending · 18 mire-crabs / no horses ·
> 21 tidewalking · 22 root-network travel · 25 rot · 26 the mud remembers · 30 nothing is symmetrical.
>
> **Deferred (the rest), with the heaviest deliberately latest:** 11 rooted intelligences that speak,
> 23 Hist-sap dreaming, 27 egg-law and 29 the Hive's chord are `N4`/`N6`-weight and belong to hours
> 6–18, not to minute 20. Withholding *Hist-sap dreaming* — a playable visionary interior — until the
> mid-game is worth more than four hackwings in the opening.

**Two defects found in `RI-WLD05` while deriving this** — reported, not fixed, per
`PLAYTHROUGH-CRITIC.md` §1 (these are coherence findings and go to `referred_to_coherence[]`):

1. **The `E` column does not sum to 22.** Counting the ✔ marks in §2 gives **20** (architecture 6:
   #1,2,3,4,6,8 · flora/fauna 7: #11,12,13,15,17,18,20 · systems 7: #21,22,23,24,25,26,30), while the
   totals line asserts `E = 22 ✔ (target ≥22)`. The item currently fails its own threshold by its own
   table. This is an arithmetic defect, not a design one, and it becomes moot under the amendment.
2. **Element 29, "the Hive's chord", is an audio element** whose entire mechanism is a sustained note
   shifting pitch with distance. `HARNESS.md` §3 and `PLAYTHROUGH-CRITIC.md` §4.7 both state audio is
   unreachable through the harness. Element 29 is therefore permanently `unmeasurable ⇒ 0` for every
   automated instrument, including this one, and either needs a non-audio observable (a visible
   correlate, a UI-free directional cue in the trace) or must be excluded from every count with the
   exclusion recorded. It is currently counted toward the 30 and toward the 15 systemic.

---

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **two-curve model** (rate decays, weight does not) is `constructed` for this project. No upstream
source states it. Its support is the observation in §B that both reference games' heaviest novelty
events are late and their densest are early, and the structural argument that the heaviest class —
the revision — is *mechanically impossible* early because it operates on prior experience. That
argument is the item's real claim and a critic is entitled to attack it.

The **numbers in §B are reconstructions from memory and are the untrustworthy part.** The per-hour
counts `9, 7, 6, 5, …` are not measurements of anything; they are an estimate of how those games
feel to play, expressed as a series so it can be fitted. **No critic may cite them as measured, and
no build may be failed for differing from them.** What is well supported is the ordering: Anor Londo
is around hour ten and is a novelty peak, not a trough; Morrowind's corprus/Tel Fyr revelation is
around hour fifteen; both games' final areas are places the player has never been. Those are
`canonical-recall` at `confidence: high` and they are what NV5, LT2 and LT4 actually encode.

The **exponent band is half-derived and half-asserted.** The upper edge (`α ≤ 0.48`) is derived
exactly from `BAR-CRITIQUE-01`'s 3 : 1 requirement via `ratio = 10^α`. The lower edge (`α ≥ 0.25`) is
**asserted** — it is the numeric form of "must decay rather than stay flat" and it has no derivation.
It should be re-examined against the first `FULL` run: if our build lands at `α = 0.20` with a rising
weight curve and a healthy long tail, the band is probably wrong and the item should be amended rather
than the build.

The **weights (2/2/1/3/2/5)** are asserted and are the most consequential asserted numbers here,
because they set `α_w` directly. They encode a design position — that a systemic rule is worth three
architecture vocabularies and a revision is worth five — and a critic who disagrees should file an
amendment with a different vector rather than argue the resulting score.

Until the SAB-N control in step 5 has run at least once, this item carries `calibrated: false` in the
verdict and **may not exceed ladder 6** — per `PLAYTHROUGH-CRITIC.md` §4.5, an instrument that has
never been shown to discriminate is an opinion with a number attached.
