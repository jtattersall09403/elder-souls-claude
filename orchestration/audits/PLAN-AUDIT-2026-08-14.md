# Plan audit — does the W1-30 defect live in the other Wave-1 plans?

**Task:** `plan-audit-w1-verdict-shape`. **Date:** 2026-08-14. **Branch:** `codex/wave1-build-experiment`.
**Authority for the question:** `orchestration/OWNER-DIRECTIVES-2026-08-14.md` §2 — *"Assume this failure
mode is not confined to graphics. Any piece whose verdict rests on a static, isolated check is suspect
until someone has played through the thing it claims"* — and its generalised rule, **"statistics can fail
a build and can never pass one."** The worked example is `orchestration/plans/W1-30.md` Part 1 and R1–R6.

**This audit changes no plan.** It is a read-only sweep. Amending a live bar is the orchestrator's call
and several of these plans have builders in flight.

---

## The population searched

Every file in `orchestration/plans/`, all 46, read in full or (for the three longest) read in full at
their acceptance contracts:

- **30 piece plans audited in detail:** W1-00 … W1-29, plus `W1-HUD-TOAST`.
- **13 excluded by the brief, not by judgement:** `W1-30` and its children `W1-30A/B/C/D/E/F/G/H/K/S/V`
  plus `W1-30-EVIDENCE` and `W1-30-LIBRARY`. These are the worked example and are live with builders in
  flight. `W1-30.md` was read in full as the reference shape.
- **2 read and classified out of scope:** `COST-EXPERIMENTS.md`, `COST-INSTRUMENT.md`. These are cost
  pieces, not player-experience pieces; the analogous question for them is whether the quality guard can
  fail, and it can — `COST-EXPERIMENTS` E3 G2 routes both arms through the **same separate Opus critic**
  and E5 uses a **blind adjudicator agent**. No defect of this shape found.
- **1 read as governing text, not audited:** `BUILDER-EXECUTION-CONTRACT.md`. Note its §3 already
  requires of *every* builder *"a moving and/or late-frame observation when the mechanism responds to
  motion or time"* and *"actual rendered output when pixels, text, animation, camera, UI or VFX are
  affected."* That is the right instinct and it predates the directive.

---

## The finding that outranks every per-plan finding

**Every plan outside the W1-30 tree was marked `satisfied` between 2026-08-09 and 2026-08-12. Not one of
them cites `OWNER-DIRECTIVES-2026-08-14.md` or Ruling W1.** Verified by grep across
`orchestration/plans/`: the only non-W1-30 hit for `2026-08-14` is `BUILDER-EXECUTION-CONTRACT.md` §9,
about publishing. `Ruling W1` and `worst constituent` appear nowhere at all.

So: 29 of 30 plans carry `Plan-State: satisfied` — build-ready, dispatchable — against a bar that has
since moved twice, in exactly the direction this audit is about:

1. **Ruling W1** (`OWNER-DIRECTIVES` §6): *"an aggregate may never be the binding predicate for something
   a player meets one at a time"*, and *"any axis asking for 'a difference' must state the effect size
   that counts."* It names five replaced predicates by id, three of them (`RI-WLD04` M18/M19,
   `RI-WLD09`) sitting inside plans below.
2. **Directive §2**: statistics can never pass a build; any acceptance a single still from a single angle
   can satisfy is broken.

`PLAN-LOOP.md` rule 1 says a materially changed governing bar returns a plan to criticism. The bar changed
underneath all of them at once. **That is the ranked recommendation in one line: this is not thirty
separate problems, it is one directive that has not been propagated.** The per-plan list below says where
propagating it actually changes something and where it would be ceremony.

---

## Verdict per plan

Three questions per the brief. Q1 is `PLAN-LOOP.md`'s own test. The **ratio** counts distinct acceptance
gates in the plan's own contract (approximate — I counted lettered/numbered acceptance rows, which is a
judgement call at the margins) against gates where a human being or a fresh agent experiences the thing
(exact — I counted rows requiring a fresh judge, naive participant or driven play-through).

Legend: **NEEDS A ROUND** · **CAVEAT** (sound, one named weakness worth writing down) · **CLEAR**.

| plan | Q1: green everywhere yet fails its purpose? | Q2: instrument gates : human gates | Q3: aggregate / degenerate-input / rule-10 / uncalibrated | verdict |
|---|---|---|---|---|
| **W1-00** harness, determinism, persistence | Narrowly, on time-scale only | 7 : 0 | continuation measured at one duration (600 f) | CAVEAT |
| **W1-01** province, regions, traversal | **Yes** | 11 : 6 (only 1 of the 6 judges frames; 5 judge charts) | **Ruling W1 predicates quoted in pre-ruling form** | **NEEDS A ROUND** |
| **W1-02** regions, borders, the strange | Partly | 11 : 4 (all stills) | one still per border-direction for a thing you walk through | CAVEAT |
| **W1-03** water, marsh, amphibious body | No | 10 : 1 | min-over-shots used correctly; moving paths required | CLEAR |
| **W1-04** settlements, interiors, people | Partly | 6 : 1 | 60-of-115 interior sample; 1/30/120/600-frame settle preserved | CAVEAT |
| **W1-05** roads, transport, wayfinding | No | 13 : 2 | a fresh navigator actually walks it, map closed | CLEAR |
| **W1-06** the camera | No | 7 : 7 | stale reference premise in one row | CAVEAT |
| **W1-07** character creation and opening | Partly | 4 : 1 | data census heavy; one 5-minute ordinary-play trace | CAVEAT |
| **W1-08** input, controls, discoverability | **Yes, arithmetically** | 6 : 1 | **naive row is 10/100 against a 90/100 bar** | **NEEDS A ROUND** |
| **W1-09** combat | **Yes** | 31 items : 2 runnable human rows | **the quality read is `not_possible` and the denominator is renormalised to 55 to exclude it** | **NEEDS A ROUND** |
| **W1-10** weapons | Partly | 6 : 2 (both differentiation) | medians as binding predicates; blind tests "are they different", not "are they good" | **NEEDS A ROUND** |
| **W1-11** impact, hitstop, mass, material, audio | No | 10 : 1 | real WAVs to a fresh judge; learned from the featureless-pack failure | CLEAR |
| **W1-12** enemy AI and encounters | **Yes** | 10 : 2 (both packs of numbers, zero gameplay) | **rule 25's exact failure: the pack does not contain the artifact under test** | **NEEDS A ROUND** |
| **W1-13** death, hearths, corpse runs | No | 29 : 2 | M-D17 is a 20-death agent-driven session; R1–R7 are banded intervals, not one-sided | CLEAR |
| **W1-14** magic | No | 7 items : 1 | moving targets mandated after a still-target round was lost | CLEAR |
| **W1-15** stealth, theft, crime, justice | **Yes** | 6 : 0 | **no blind pack, no fresh judge, no play-through anywhere** | **NEEDS A ROUND** |
| **W1-16** progression, encumbrance, economy | **Yes, on the feel question** | 16 : 0 | no human gate; every consumer proven by perturbation only | **NEEDS A ROUND** |
| **W1-17** dialogue and the topic graph | No | 10 : 1 | A10 splits pack construction from judgement correctly | CLEAR |
| **W1-18** quest engine and journal | No | 24 items : 5 (3 are play-throughs) | two fresh-agent journey families and a week-return protocol | CLEAR |
| **W1-19** the main quest, end to end | No | 6 items : 1 blind + 80 driven chains | forbids hand-fed progress by name | CLEAR |
| **W1-20** factions and rank gating | Partly | 15 : 1 (conditional) | **"blind comparison is required wherever either item specifies it"** — conditional, so droppable | CAVEAT |
| **W1-21** the UI | No | 11 items : 3 protocols / 8 judgements | worst-of-six aggregation; builder inspects every screen in the running game | CLEAR |
| **W1-22** regional ambience | **Yes, on quality** | 10 : 4 (all real audio) | **every human gate asks "which region is this", and the plan says so itself** | **NEEDS A ROUND** |
| **W1-23** canon, books, disputes, names | No | 18 : 4 | M3's author-voice read is a genuine quality question | CLEAR |
| **W1-24** visual protocol and the player's body | Partly | 13 : 6 | **stale reference premise; and the same "capped at 7" trap W1-30 R1 found** | CAVEAT |
| **W1-25** experience instruments and seams | No | 5 : 3 | this is the piece that measures whether play produces memories | CLEAR |
| **W1-26** the opening as a played scene | No | 8 : 1 + 4 driven journeys | a fresh agent drives the whole session and does not judge its own | CLEAR |
| **W1-27** density, loot, coherence | **Yes** | 14 items : ~2 | **A+B ≥276 is a province-wide count with no obligation on what a walk crosses** | **NEEDS A ROUND** |
| **W1-28** the first hour as interaction | No | 11 : 2 | naive agent plays a full hour; blind pair explicitly asks the quality question | CLEAR |
| **W1-29** mobile and gamepad | No | 7 : 1 | naive row is 4/100 **but** prose blocks closure without a naive *pass* | CLEAR |
| **W1-HUD-TOAST** | No | 7 : 0 | the metric *is* the player experience (ink cut off) | CLEAR |

**Totals: 8 need a round, 8 carry a named caveat, 14 are clear.**

---

## Ranked list: which plans need a reviewer-editor round

Ranked by how central player experience is to the piece × severity × cheapness of the fix. Each names the
specific defective predicate, quoted.

### 1. W1-15 — stealth, theft, crime, justice. No human gate of any kind.

The whole plan is 33 lines and its acceptance is:

> *"Run browser/pixel work only for predicates that cannot be proved offline: rendered light reaching
> detection, natural guard damage/arrest consequences, save/load world consumption, and the applicable
> CHR02 live branches."*

There is no blind pack, no fresh judge, no naive participant and no play-through anywhere in the
document. Stealth is a *feel* system — a light exponent of 1.36 and a Wet-Ledger threshold of 3 are
inputs to an experience nobody in this plan ever has. A build can satisfy every arithmetic row in S43 and
produce sneaking that is unreadable, unfair or trivially exploitable, and nothing here would notice.
Cheapest repair: one row requiring a fresh agent to attempt a theft and an escape under the shipped
detection model and report whether it was legible.

### 2. W1-12 — enemy AI. Two human gates, and neither contains the thing under test.

> *"Build two anonymised 60 s distance/state series with identical presentation"* (step 8)
> *"ten unlabelled 90-second behaviour fingerprints from the build mixed with ten generated from
> RI-AI05 §B"* (step 9)

Both packs are numeric. This is `RULES.md` rule 25's already-paid-for failure verbatim — *"an audio pack
was built as a single JSON file of numeric feature vectors — no sound … Ship the thing itself: the
recording, the text, the picture."* A judge clustering fingerprints into six roles is answering a
question about the fingerprint format. **Nobody in this plan ever fights an enemy and says whether the
fight was good.** The piece's own history shows the hazard: the round-2 verdict scored 2/10 because a
hard fail fired on a *stationary-player* fixture while the builder's *moving-player* number looked fine.

### 3. W1-09 — combat. The one quality read is unavailable, and the denominator is renormalised around it.

> *"Blind is `not_possible` until the exemplar returns; never synthesize a counterpart or substitute
> gameplay footage for the specified two runtime-generated plot packs."*
> *"Report raw and runnable scores with the current **55 runnable-weight denominator**."*

The plan elsewhere forbids exactly this — *"A cross-piece dependency may make a row `not_run`; it may not
turn it green, **be renormalised away**, or permit an aggregate that natively consumes that row to pass"*
— and then the RI-CMB07 row does it, on the item's own authority. The result is that combat, the Souls
half of the project, closes at ≥7.0/10 with its human quality read removed from the denominator, judged
by scripted PILOT/MASHER/TURTLE bots against banded row medians. Note also that when the blind *is*
available it judges **"two runtime-generated plot packs"** — charts again, not fights.

### 4. W1-01 — province and traversal. Quotes the exact predicates Ruling W1 overturned, in their pre-ruling form.

> *"M18 min 9/13 measured axes; M19 13/13 placed, exclusive signatures"* and
> *"every only-here signature appears at declared count in its own region and zero elsewhere"* (step 5)
> *"≤8% of road samples are below 1.6 m/s"* and *"the maximum inhabited-place gap is ≤9.0 min"* (step 2)

Ruling W1 says of M19: *"ONLY-HERE wants ≥ 8 instances and says nothing about spread — **eight in one
clump passes**."* W1-01 reproduces the clumpable predicate. Ruling W1 says of M18: *"three of nine axes
ask only for 'any difference'; the slope axis is a χ² with no effect-size floor, so it passes
automatically at n > 3,000."* W1-01 requires *"at least 6 measured world axes"* differ, with no effect
size. And the ruling's headline case — the Deep Marshes' **275-second walk across one ground state** —
lives in this piece's population. This is the single highest-value round on the list because W1-01 is
`satisfied` and dispatchable **today** against superseded predicates.

Separately: the M17 human read is **three 1920×1080 stills per region**. A player crosses a region on
foot for six minutes. Directive §2's rule applies directly.

### 5. W1-27 — density, loot, coherence. A province-wide count where a player walks one route.

> *"A+B **≥276 merely to avoid the fail floor** and ≥460 for its target"*
> *"a reproducible seeded random sample of **60** … **>5/60 is the item hard fail**"*

276 points of interest spread over 13 regions is a number about the province. Ruling W1's table convicts
exactly this shape in `RI-WLD09`: *"mandated ≥ 240 s empty walks **with no obligation on the landscape
crossed**."* M6/M8/M9 traversal exists in the plan but is gated behind the static density floor, so the
count decides whether the walk is ever measured. The 5/60 tolerance additionally permits 8% of POIs to be
repeated-mesh or inert scatter — a player who walks up to one of those experiences it at 100%.

### 6. W1-16 — progression. Sixteen acceptance rows, zero human gates.

The strongest row in the plan is genuinely strong:

> *"For each, perturb only the governing ratio/tier and observe the named world-side entity behavior."*

That proves the number reaches the world. It does not ask whether levelling up feels like anything. This
piece owns souls, levels, attributes, skills, burden and gold — the whole Morrowind-side reward loop —
and the only player-facing row is `RI-UIX03`'s *"player-visible burden and equip-load readouts show
correct units."* Lowest-cost repair on the list: this piece can borrow W1-25's `RI-EXP02` session or
W1-28's naive hour rather than commission anything.

### 7. W1-22 — regional ambience. Rich human gates that deliberately answer a different question.

> *"one fresh judge assigns all clips from the audio-bed column alone; **≥26/39**"* (M20)
> *"**Do not infer a quality verdict from identity answers.**"* (step 5)

This plan is admirable — real 20-second WAVs, 13 fresh judges, 78 independently-contexted pair
judgements, preregistered catch trials. And it says outright that none of that is a quality verdict. So
the ambience can be perfectly identifiable per region, hit every LUFS band, and still sound bad, and
`RI-AUD03` 6/6 would be true. This is the W1-30 VIS07 problem restated in sound: *"a blockout of grey
boxes in a swamp passes VIS07 with distinction: nobody would mistake it for Skyrim."*

### 8. W1-24, W1-06 and W1-03 — a stale premise that R1 already convicted, still live in three plans.

W1-30 R1's second finding was that the plan justified inventing a new scale on a claim *"that had been
false for eight days"* — that legal paired modern reference pixels did not exist. **I verified the
corpus: `corpus/70-visual/refs/modern/` holds exactly 131 files across seven folders** —
`exterior_daylight` 43, `exterior_lowlight` 24, `interior_darkemissive` 22, `character_closeup` 13,
`combat` 12, `material_closeup` 9, `ui` 8. R1's count is correct. **That correction was written into
W1-30 and nowhere else.** Three satisfied plans still carry the old premise:

- `W1-24.md:124` — *"Missing reference images are SKIPPED, not fabricated; **zero runnable pairs caps
  fidelity at 7**."* W1-24's own bar is native score ≥7. This is precisely the trap R1 found in W1-30:
  a tree pinned at exactly its own bar, unable to demonstrate above it.
- `W1-06.md:71` — *"separately apply RI-VIS06 Protocol A to the `character_closeup`/RI-VIS02 REF-M6 pair
  **when the reference is usable, otherwise record the native skip** rather than a pass."*
  `character_closeup` holds 13 files.
- `W1-03.md` W9 — REF-M4 paired shots, same conditional shape.

This is the cheapest item on the list: three plans, one sentence each, and it converts three skipped or
capped human reads into runnable ones. It also inherits W1-30's open question — R1 requires W1-30V to
confirm through `ARBITRATION.md` whether `RI-VIS09` §2's routing extends to the folders acquired on
2026-08-06. **Whatever that arbitration rules should be written back to W1-24, W1-06 and W1-03 in the
same pass**, or three more plans will re-derive it.

### 9. W1-08 — the one human row is 10 points against a 90-point bar.

> *"**Controls work (28 points)** … **Browser hazards (26)** … **Look (10)** … **Rebinding (12)** …
> **Discoverability (14)** … **Naive (10)** … Native score must reach **≥90/100**."*

28+26+10+12+14+10 = 100. The cheapest route to 90 is a perfect instrument sweep and a naive result of
zero. The plan does block a *missing* naive result — *"Complete plan green is impossible without the
independent naive result"* — so the row must **exist**; nothing requires it to **pass**. A build where
fresh participants could not work out the controls scores 90/100 and closes. W1-29 has the identical
arithmetic (naive is 4 of 100 against a 90 bar) and is safe because of one extra clause: *"A green
implementation without … **independent naive pass** … is not closure."* The repair for W1-08 is to copy
that sentence.

### 10. W1-10 — the blind gates test differentiation, and the binding predicates are medians.

> *"blind class comparison uses rendered clips"* (WPN02) · *"Fresh blind grouping names within-group
> differences"* (WPN03) · *"median TDV≥0.60"* (WPN06) · *"`W_med∈[0.35,1.00]`" · "`Chg_med∈[0.30,1.10]`"*

Eighty-seven weapons that are reliably distinguishable from one another can be uniformly bad; both blind
questions would still pass. And a median over classes is an aggregate over a population a player meets
one at a time — a player wields one weapon, and Ruling W1 says such a bar *"binds on the worst
constituent or a stated quantile — never the mean."* W1-10 does carry mins alongside (`W_min≥0.20`,
`Chg_min≥0.15`), so this is a partial rather than total instance; the medians are the rows to revisit.

### Two smaller ones, listed for completeness rather than dispatch

- **W1-00** — the persistence continuation is measured at one duration: *"never-saved versus loaded
  **600-frame** `body_sha256`."* Rule 8: *"If your number is taken at a single instant, take it again
  later and publish both."* 600 frames is ten seconds. The plan's own history proves the instrument
  bites at that scale (`prev_state` diverged 219/600), so this is a hardening, not a hole.
- **W1-20** — *"Blind comparison is required **wherever either item specifies it**, with the actual
  prose/artifact and a fresh judge."* A conditional gate is a droppable gate; name the rows.

---

## What I cleared, and why it counts

Fourteen plans are sound on this axis and several are better than W1-30's rewrite was. Reporting them is
half the job.

- **W1-05** has the best human gate in the project: *"a fresh navigator receives only information
  available to a player in the running world, starts without route coordinates, and travels the native
  WLD06 population **with the map closed**"* — plus an ablation arm that must make it worse, plus
  *"measure at departure, junction decisions, arrival, and **after sufficient settling frames**; one
  instant cannot establish arrival."* Somebody actually plays it, and the instrument knows about rule 8.
- **W1-28** ships the artifact and asks the right question: *"The question must be the item's quality
  question, **not SAME/DIFFERENT**"* — rule 25's lesson applied by name — and a fresh isolated naive
  agent plays a full 216,000-frame hour.
- **W1-18** has *two* fresh-agent journey families, a week-return protocol and a marker sweep. **W1-19**
  runs 40 signatures through two complete chains and forbids hand-fed progress by name.
- **W1-21** already did the W1-30 rewrite's job for the UI, and did it before the directive: two ordered
  and isolated ART/FIDELITY passes, six fresh Bootstrap judges with **worst-of-six** aggregation, a
  neutralised structure-only pack, a contamination scan, and a builder instruction to *"inspect every
  production screen in the population above **in the running game**."*
- **W1-24** is the richest human contract anywhere in the tree: separate quarantined Protocol A and
  Protocol B judges, verbatim native prompts, a disjoint sealed calibration panel, and aggregation that
  is *"worst-surface/pair/pose … **never an average or selected frame**."* Its caveat is a stale premise,
  not a structural one.
- **W1-22** built exactly the pack rule 25 demands after the audio round failed: real 48 kHz WAVs,
  preregistered catch trials, one fresh judge context per pair. Its gap is which question it asks, not
  whether the judge can hear anything.
- **W1-11**, **W1-13**, **W1-14**, **W1-17**, **W1-23**, **W1-25**, **W1-26**, **W1-29** and
  **W1-HUD-TOAST** all carry a human or fresh-agent gate that is load-bearing, and several carry
  min-over-population aggregation of their own accord (**W1-03** W9: *"every paired shot ≥7 because
  RI-VIS02 aggregates by the minimum across shots"*).

And one thing worth saying plainly: **the plan-loop worked.** Almost every plan in this population has a
BLOCKING critique in its history that caught precisely the class of defect this audit is about — W1-06's
critic caught a builder about to administer its own blind judgement; W1-17's caught the same for
RI-DLG07; W1-12's caught a 1.8 pass floor silently lowered to 1.0; W1-25's caught 1.5 substituted for
4.0 verified anecdotes per hour; W1-27's caught a loot-name census substituted for RI-WLD02 M7. The gap
this audit found is not that the loop is weak. It is that the loop finished on 2026-08-12 and the bar
moved on 2026-08-14.

---

## Two cross-cutting patterns, worth a ruling rather than thirty edits

**(a) A large share of this project's "human reads" ask a judge to look at a chart.** Counting across the
population: W1-01 (three of six), W1-06 (five of seven), W1-09 (both), W1-12 (both). The judge is shown a
`distance/state` series, an `arm_len_m` series, a 64-row result table, a behaviour fingerprint, a
depth-vs-speed curve. For some of these that is the correct instrument — *"which of these is a character
with mass"* is genuinely a question about a time series. For others it is rule 25's convicted shape: a
pack of features tests the features. **Suggested ruling: any protocol whose pack is a chart must state,
in the plan, which of the two it is** — a mechanism test (legitimate) or a stand-in for a quality read
(not legitimate) — and if the latter, name the artefact it should ship instead.

**(b) Genericness is not quality, and this project mostly measures genericness.** W1-30 Part 1 names it:
*"RI-VIS07 … asks 'could this be Skyrim?' — a genericness test, not a quality test. A blockout of grey
boxes in a swamp passes VIS07 with distinction."* The same substitution is load-bearing in **W1-22**
(*which region is this?*), **W1-10** (*can you tell the classes apart?*), **W1-11** (*can you tell the
twelve impact classes apart?*), **W1-12** (*can you cluster the roles?*) and **W1-23** M2 (*which
world?*). These are all necessary and all insufficient, in exactly the way the visual plan's were. The
counter-examples show the fix is cheap and already known here: **W1-23 M3** asks a judge to state a
book's author, want and wrong belief; **W1-28** asks the item's quality question outright; **W1-24**
Protocol A forces a preference between our frame and a shipped AAA frame. Each of those is a quality
question, and each costs the same judge.

---

## What I could not do

- **I did not read the reference items.** Everything above is checked against what the *plans* say. Where
  a plan quotes an item's weights or thresholds I have used the plan's own numbers and said so; where a
  defect might live in the item rather than the plan (W1-02's one-still-per-border M68, W1-09's
  55-weight denominator, W1-27's 5/60 tolerance) I have flagged it as **corpus-level** and not blamed the
  plan, which is faithfully transcribing an item. Confirming those needs a corpus reader, and it is the
  natural successor to this piece.
- **The instrument-gate counts in the ratio column are approximate.** I counted lettered and numbered
  acceptance rows in each plan's own contract; several plans state a row as "every native method in item
  X", which is one row and dozens of checks. The human-gate counts are exact. Read the ratios as orders
  of magnitude, not measurements — the direction is unambiguous and the precision is not.
- **I did not audit the W1-30 children individually.** The brief excluded them and they are live. R1–R6
  bind them and W1-30V's first action already covers the reference-routing question.
- **I ran no browser and no GPU pod.** This was a text sweep, per `PLAN-LOOP.md`'s cheap-first
  discipline.

---

## Exact next orchestrator actions, in cost order

1. **Cheapest, highest certainty:** update the stale reference premise in `W1-24.md:124`, `W1-06.md:71`
   and `W1-03.md` W9 — 131 files exist in `refs/modern/` — and route W1-30V's `RI-VIS09` routing
   arbitration back to all three when it lands. Three sentences.
2. **Cheapest structural:** copy W1-29's *"independent naive **pass** … is not closure"* clause into
   `W1-08.md`. One sentence.
3. **Highest value:** one reviewer-editor round on **W1-01** to absorb Ruling W1 before its builder is
   dispatched, since it is satisfied and owns the overturned predicates.
4. Then **W1-15**, **W1-12**, **W1-09**, **W1-27**, **W1-16**, **W1-22** — each needs a human-experience
   gate added, and four of the six can borrow an existing protocol from a sibling rather than commission
   a new one (W1-16 ← W1-25/W1-28; W1-12 and W1-09 ← W1-28's naive hour; W1-15 ← W1-18's fresh-agent
   journey shape).
5. Consider a single S-ruling for the two cross-cutting patterns instead of thirty plan edits.
