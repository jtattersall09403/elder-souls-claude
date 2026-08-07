# BAR-CRITIQUE-W1-07-R1 — are the opening, creation and journey bars good enough?

**Critic:** bar-critic, journeys/creation pass 1. **Date:** 2026-08-07.
**Scope:** all of `corpus/88-journeys/` — `RI-JRN01`–`RI-JRN08`, `JOURNEY-CRITIC-FLEET.md`,
`AMENDMENT-PROPOSAL-JRN01-01`, `paths-requested.json` — plus the items `W1-07` is actually scored
against: `RI-CHR01`–`RI-CHR03`, `RI-PRG02`, `RI-PRG03`, and `RI-EXP01` and `RI-MTH06` as the two
items that own what the opening is *for* and what measures it. Read against
`INTENT-AUDIT-CHARTER` §4/§5/§6/§7, `ARBITRATION` §3 and S27, `SCORING` §0/§1.1/§1.2/§4,
`CORPUS-CONTRACT` §4, `CRITIC-DOCTRINE` §7, `RI-MTH06`, `RI-MTH07` and `EFFORT-POLICY`, with both
`W1-07` verdicts as the worked example of what these bars did when they were run twice.
**This critic does not judge the build.** It judges whether these bars would catch a game that
fails the user's intent, and whether they can be passed by a game that does not.

> **Note on this pass.** A container restart killed it between the last amendment and this file.
> The amendments below were written, are on disk, and are committed at `6e359ab`; this verdict is
> the record that was missing, written after re-reading every one of them. Where re-reading found
> my own text wrong, it is corrected here and in the file, and said so.

---

# VERDICT: **NOT SATISFIED**

The one-line reason:

> **These bars can prove the room was built. Not one of them could tell whether anybody spoke in
> it — and three of the six bars `W1-07` was scored against could not be passed by any build
> whatsoever, which is why two rounds of real work scored 1.5 and 3.8.**

The demonstration is not an argument. It is round 2's own table:

| Round 2 measured | Result | What the bars said |
|---|---|---|
| distinct creation frames | 19 of 19, both capture paths | **pass** |
| speaker resolves to a live NPC in a named interior | 18 of 18 | **pass** |
| opaque UI share of frame against a 0.55 ceiling | 0.14–0.34 | **pass** |
| ≥ 1 NPC and a walkable room at every node | yes | **pass** |
| whole census completable on a gamepad alone | 28 presses | **pass** |
| **authored dilemma questions that reached the player** | **0 of 10** | *no check owned this* |
| **named professions the mandatory route produced in play** | **0 of 14, over 240 runs** | *scored 4* |
| **the writ's text drawn at the node that stamps it** | **`rendered_text: []`** | **passed**, as an API string |

A build can hold every structural bar in this area and be a form with a room painted behind it.

## Was it the bars, or the build?

**The bars, first and decisively — and then the build, harder than it was charged.**

Unlike the combat area, where my counterpart found the split roughly even, here the corpus's share
is arithmetic and total:

- **`W1-07` could not pass its gate under any build, in any round.** Gate 7.0 over six items needs
  **42**. `RI-JRN01` was pinned at 0 by a tool the corpus mandated and assigned to nobody;
  `RI-CHR01` and `RI-CHR03` were pinned at native 0 by a `min-over-axes` rule biting on an axis
  whose instrument (`build-viability.mjs`) has never existed. **Three of six items at 0 caps the
  attainable total at 30 — a mean of 5.0.** Under the generous native-0 → ladder-4 translation both
  wave-1 critics actually used, the ceiling is 6.33. Three rounds have been dispatched at a wall
  with a door painted on it.
- **And the build should have scored lower, not higher.** Round 2 recorded two triggered hard fails
  against `RI-CHR01` in the verdict's own `hard_fails[]` array and scored it **4**, against
  `SCORING` §1.1's *"any triggered hard fail caps the whole item at 2"*. It recorded `native_score:
  0` on three items and translated all three to **4**. It carried `RI-PRG02` at 6 and `RI-PRG03` at
  5 on a `min-over-axes` rule with an unmeasurable axis in each. **Re-read under the amended items,
  round 2 scores 1.3, not 3.8** (§R9).

Both failures were invisible for the same reason: **every rule they broke was already binding, and
not one of them had an instrument.** That is the finding of this pass, and it is the third time a
bar critic has written a version of it.

## What is good here, said first so the criticism is not mistaken for a survey

`RI-JRN01` is the most ambitious item in this corpus and much of it is excellent. §A's beat list is
a real reference artifact. **O6 — "≥ 60 s of available play before the first character-defining
question"** — is the single best idea in the area: it puts a number on Morrowind's actual trick,
that you get a *body* before you get a *character*, and no other item in this project would have
caught its loss. `RI-JRN01` M7's parenthesis — *"as presented in play (not from the data file)"* —
is six words that caught the largest defect of round 2, and the critic who took it seriously found
what four instruments missed. `RI-CHR01` §6's five class prohibitions are binary and unlobbiable.
`RI-CHR02`'s AR-3 encounter test is the best behavioural check outside `corpus/10-combat/`, and it
worked: it distinguished three races' opening behaviour while proving their statblocks identical.
And `RI-CHR01`'s refusal to let the questionnaire mention a stat by name is a content bar that
cannot be satisfied by tuning.

None of that is in question below.

---

# R1 — `AMENDMENT-PROPOSAL-JRN01-01`: the fail-closed clause. **GRANTED IN PART, applied, and the proposal understated its own case.**

The round-2 critic's charge: `RI-JRN01` *"scores 0 identically for twenty grey frames and for a
rendered scene — it measures the toolchain rather than the journey."*

**The diagnosis is upheld in full.** Round 1 produced twenty byte-identical grey PNGs with no room,
no person and no text. Round 2 produced nineteen distinct nodes with a barge hold, a Writ House,
two present NPCs and dialogue two independent critics called better written than Morrowind's own.
`RI-JRN01` scored both **0**, for the same reason — the absence of `tools/journey/journey-run.mjs`,
which is `A-JRN1`, which is `RI-MTH06`'s deliverable and **has never been anyone's assignment**. A
scale that returns the same number for those two builds is measuring the toolchain.

**The remedy is granted per check, not wholesale**, because two of the checks the proposal asked to
release cannot see the thing they are pointed at. The full ruling is in
`AMENDMENT-PROPOSAL-JRN01-01` and applied in `RI-JRN01` §0.1 so builders read amended text. The
four dispositions that matter:

| | |
|---|---|
| **M4 — SPLIT, and this is the sharpest thing in the ruling** | The proposal listed M4 as released and round 2 duly measured *"≥ 1 NPC and ≥ 1 takeable entity"* — which is **clause 2**. M4's actual threshold is **≥ 60 s of available play before the first character-defining question**, i.e. the interval between `first_control` and the first field-writing `dialogue_open`, and **neither event exists**. Releasing M4 whole would have converted the item's own How-we-lose #5 — *"control arrives after definition"*, Morrowind's cheapest and best trick — from a timing bar into an entity count. Clause 2 released; clause 1 stays blocked. **Nobody has ever measured the item's headline number.** |
| **M9, M15 — released ONLY against a named, demonstrated accessor** | Both are greps over *"every string rendered"*. This build draws all text into a canvas: `document.body.innerText` is `""` and the accessibility tree has no children. **A grep over an empty set returns 0 hits and reads as a clean pass.** Released as proposed, M9 would have been a 10-point check that a canvas-only build passes *by being unreadable*. `RI-MTH06` §B names this failure in advance. A build with no enumerable rendered-text surface now scores M9/M15 `unmeasurable ⇒ 0`, never pass. |
| **M8 — released, STIFFENED** | As written, satisfied by a string in `readWrit()`. That is How-we-lose #10 word for word — *"exists in the save file, is never rendered, cannot be read"* — reproduced by the check written to prevent it. Round 2: the writ is complete and correct in the API and the stamped node draws `rendered_text: []`. **The item's own predicted failure passed its own check.** M8 now requires the text to reach the frame, and *"present only as an API return value"* is a hard fail. |
| **M13 — SPLIT** | The gamepad evidence is good and is accepted: `__HARNESS.gamepad(state)` → `RealInput.pushGamepadState()` → **the same `pollGamepad()`** the engine's `beforeTick` calls for a physical pad, so a `tools/` shim could only drift from a path that already exists. But `A-JRN2` requires injection at the `navigator.getGamepads()` seam with a `mapping:''` descriptor, one layer outside this path. Reachability legs released; descriptors and hot-plug stay `RI-JRN04`'s and stay blocked. |

**What replaces the fail-closed clause, exactly.** `RI-JRN01`'s preamble now reads: `A-JRN1` blocks
**M1, M2, M3, M12, M14 and M4 clause 1**; the isolated channel blocks **M16–M19**;
`beat-extract.mjs` blocks the blind pair. Those score 0 and their weight is **`corpus_debt`** —
removed from numerator *and* denominator, reported as `raw / runnable`, filed against `RI-MTH06`,
**never averaged into the build's mean**. Everything else is measurable today and the critic must
name its instrument. **Runnable weight in wave 1 is 67 of 100**, and the bands apply to the
runnable *fraction*, so a build must earn the same proportion it always had to.

**The proposal's claim that it "does not weaken the bar" was too modest. Applied honestly the
amendment makes round 2 fail harder**, and this is the test that matters:

- M13 has four reachability legs; round 2 completed **two** (keyboard, gamepad — mouse+keyboard and
  touch never run) ⇒ **HF5** fires, where before it scored 0 with no named defect.
- M7's questionnaire produced **0 of 14** professions ⇒ **HF7** fires.
- M8's writ is an API string ⇒ its new hard fail fires.
- And the pass adds **M20/HF9** for a defect two verdicts recorded as an observation and no check
  owned: **there is no title surface at all.** O1 caps surfaces at two from *above* and nothing
  bounded them from below, so a build that boots straight into the world scores M1 perfectly while
  offering a returning player no route to their save. Five points for M20 are taken **out of** the
  Flow block proportionally (M1 10→8, M2 5→4, M3 5→4, M12 5→4); the block total and the item total
  are unchanged.

**`RI-JRN01` goes from 0 to 2 for round 2, and I want that stated plainly rather than buried.** It
is not a relaxation: the 0 was charged for a missing corpus tool, and the 2 is a hard-fail cap
earned by three of the build's own defects, each now named and actionable. An item that says *"0,
because we never wrote your instrument"* teaches a builder nothing. An item that says *"2, because
there is no title screen, the writ is invisible and two of four input modalities were never run"*
is a bar.

---

# R2 — `RI-MTH06`: two mandated tools that have never existed. **Audited, and it is 67, not two.**

The referral asked me to audit every item in scope for methods naming instruments absent from the
tree. `RI-MTH06` method 1 — *"extract every `tools/**` path from every `## Comparison method`
section; assert each resolves to a file on disk"* — **has existed since wave 0 and had never been
run.** I ran it. Reproduce with `node tools/corpus-index.mjs`, check **C8**:

```
reference items scanned                    : 144
distinct tool paths named in their methods :  82
        …resolving to a file on disk       :  15
        …PHANTOM                           :  67
```

**Sixty-seven of eighty-two. Eighty-two per cent of the instruments this corpus names do not
exist.** The distribution is the finding:

| Area | Phantom tools named |
|---|---:|
| `95-experience` — the area whose entire subject is whether the game is any *good* | **30** |
| `86-ui` | 10 |
| `40-dialogue` | 9 |
| `85-platform` | 8 |
| `88-journeys` | 6 |
| `80-methods`, `87-audio` | 4 each |
| `15-camera`, `22-character`, `23-stealth-crime` | 1 each |

**Every quality instrument pointed at the opening is in that list** — `session-run.mjs`,
`beat-diff.mjs`, `beat-extract.mjs`, `isolation-check.mjs`, `log-lint.mjs`, `journey-run.mjs`,
`gamepad-shim.mjs`, `naive-driver.mjs`, `build-viability.mjs`. Meanwhile every *correctness*
instrument exists and is run every round: `run-headless.mjs`, `content-stats.mjs`,
`creation-audit.mjs`, `cmb-reach.mjs`, `determinism.mjs`, `smoke.mjs`, `trace.mjs`.

> **The corpus built the tools that check whether the artifact is right, and did not build the
> tools that check whether it is any good.**

That sentence is the whole of this critique in one line, and it is *measured*, not asserted.

**The ruling, in two rules, neither of which lowers a threshold.**

**R2.1 — The sweep is wired into the gate.** It is now check **C8** in `tools/corpus-index.mjs`,
printing `phantom tools : N` on every run. It is `warn` in wave 1 and **`error` from wave 2**, and
that is a deliberate, stated choice rather than a soft one: making it blocking on the pass that
first counted it would fail the coherence gate for every agent in the tree, which is how a check
gets deleted instead of a debt getting paid. **A sweep run once and never again is how 67
accumulated.** It caught three more the moment it existed — `load-run.mjs`, `perf-run.mjs`,
`stream-audit.mjs` in `corpus/85-platform/` — which nobody had noticed and which pin `RI-PLT01` and
`RI-PLT03`, the two items the *combat* critic just made a mandatory citation.

**R2.2 — A dimension blocked *only* by a phantom tool is `corpus_debt`, not a zero against the
build.** This is the rule the corpus most needed and did not have:

> Where an item's axis cannot be measured **solely** because a tool this item lists as phantom does
> not exist, that axis is `unmeasurable`, its weight is removed from **numerator and denominator**,
> the item reports `raw / runnable`, and the debt is filed against **`RI-MTH06`**. It is **not**
> averaged into the piece's mean.

This does not soften `CRITIC-DOCTRINE` §7.3. §7.3 governs a **harness gap the piece could close** —
fail-closed at 0, never "unknown". A tool the corpus mandated, assigned to nobody and never wrote is
the *other* case, and §7's own closing paragraph already ruled it: *"if an item cannot reach 10
because the corpus is broken … do not absorb it into the piece's score."* **The two clauses have
been in tension since wave 0 and every wave-1 critic resolved it the harsher way, against the
builder.** `corpus_debt` is not a pass: it is reported on every line, it escalates, and an item
carrying it may not score above what its *runnable* fraction earns.

**R2.3 — What the rule was hiding.** Under `min-over-axes` an unmeasurable axis is not a lost
fraction; it is the whole item.

| Item | Axis | Tool | Consequence |
|---|---|---|---|
| `RI-CHR01` | Distinctness | `build-viability.mjs` | **native 0 for every build that will ever exist** |
| `RI-CHR03` | Decidability | `build-viability.mjs` | **native 0 for every build that will ever exist** |
| `RI-JRN01` | all of it, as written | `journey-run.mjs` | **0 for every build** — and it scored 0 twice |

**Correction to my own text, found on re-reading.** `RI-MTH06` §E and the C8 code comment said
*"74 of 137"*. 74 is the **sum of the per-area column** — seven tools are named by items in more
than one area — and 137 was a stale item count. The distinct figure is **67 of 82 named across 144
items**. Both files are corrected and the double-count is now explained in §E. The area table was
right; the headline was two numbers from two different denominators.

---

# R3 — Does anything measure whether the opening is *good*? **No. `RI-JRN09` filed.**

The owner's words are the referral: *"is the new game flow good enough Vs Morrowind's famously
brilliant opening scenes."*

I read all nine journey items, all three character items, both progression items and `RI-EXP01` for
this. Before this pass the answer was **no**, and the demonstration is the wave-1 record: the build
passed distinct-frame counts, UI area fractions, speaker resolution, entity presence, token purity
and gamepad reachability — and delivered **zero of ten authored questions to the player**. Not one
instrument noticed. It was caught by a critic reading a parenthesis carefully. **A bar that depends
on the critic being cleverer than the bar is not a bar**, which is the sentence my combat
counterpart wrote about `corpus/10-combat/` one day earlier, arrived at independently.

**Filed: `RI-JRN09` — the opening as an exchange.** Morrowind's opening is not remembered for
having few surfaces. It is remembered because somebody asked your name and said it back; because
ten questions about wounded dogs were **printed where you could read them**; because a bored
functionary **told you what you apparently were**; and because he stamped a form and handed it to
you. Every one is an *exchange*: the player put something in and the world visibly took it. Three
measures, all runnable **today** against the build that exists, with no exemplar, no naive channel
and no unwritten tool — which is the point, because every other quality instrument aimed at this
journey is in R2's list of 67:

- **`ES-LEGIBLE/1` — the delivered-text ratio.** `DTR = |distinct authored strings drawn| /
  |distinct authored strings computed|`, per node. `DTR_q = 1.00` required: a question the player
  cannot read is not a question, and there is no defensible fraction below 1. **Distinct counts,
  never character counts** — round 2's own instrument passed this scene because it counted
  characters and the *answers* differed while the *question* was the same stock line at all ten
  nodes. Weight 45, because it is the largest failure.
- **`ES-ANSWERED/1` — the answers are consumed inside the scene.** For each of `RI-CHR01`'s eight
  inputs, the value must be used before the player leaves the interior, in a **drawn** line, a
  visible object, or a visible written record. `AC ≥ 6 of 7` (`sex` exempt by `RI-CHR01` §2). A
  `getCensusState()` field is **not** consumption — `RI-MTH07` §B1 rules the trace an observer.
  Note deliberately that Morrowind itself scores 5 of 6, not 6 of 6: **the bar is not that
  everything is echoed** — a scene that repeats every answer is a receipt, not a conversation.
- **`ES-NAMED/1` — the naming moment.** `RI-CHR01` §4 states the questionnaire's purpose in its own
  words — *"the Warden-Scribe says the name aloud, **which is the moment the route is for**"* — and
  **no method in the corpus asserted that the line fires.** ≥ 240 completions, published a/b/c/d
  histogram, ≥ 10 of 14 distinct classes for full marks, and the naming line drawn 100% of the time
  on a named match. `NAMED_rate` is reported and deliberately **unbanded**: *"I do not have a word
  for what you are"* is a good answer for a customs officer and forcing it to zero is worse design.

`RI-JRN01` §0.2 now makes citing `DTR`, `AC` and `NAMED` mandatory in a verdict on this journey,
alongside `RI-PLT03`'s `T_control` (O5 delegates the number and never asks for it — **two verdicts
exist with no figure for how long it takes to get a body**) and `RI-EXP01`'s beat numbers.

**And `RI-EXP01` is the quiet scandal here.** It is the corpus's only existing instrument that asks
whether the opening is any good. Its tools — `session-run.mjs`, `beat-diff.mjs`, `beat-extract.mjs`,
`beats-from-md.mjs`, `isolation-check.mjs` — are **all five phantom**. Its paths,
`experience.opening.hook` and `experience.opening.beats`, are declared by **no wave-1 piece**. It
has **never been run on any build**, and nothing in the process would ever have said so out loud.

---

# R4 — Does anything measure that the questions are readable? **It does now, and the mis-weighting the referral suspected was real and worse.**

The referral's framing: round 2 reaches the player with **0 of 10 question texts drawn** and **0 of
14 named classes across 240 runs**, and still scored 4/10 on two creation items. *"If the bars let
'the questionnaire prints nothing and names nothing' score 4, they are mis-weighted."*

**Upheld, and the mis-weighting had three independent causes**, which is why it survived:

1. **No axis measured delivery at all.** `RI-CHR01`'s Questionnaire axis measured *12 questions,
   zero stat tokens, all 19 skills ≥ 5 answers* — every clause a property of the **data file**. The
   Class-roster axis measured *≥ 10 questionnaire-reachable*, and `RI-CHR01` M4 satisfies it by
   enumerating `4^10` combinations **against the data file**. The round-3 builder's own measurement
   is the proof that this is not a quibble: `reachableClasses()` reaches **11 of 14 in principle**
   while a 1,600-run play sweep produces **0**, because the matcher requires set equality over
   116,280 shapes and exact match is a measure-zero event in play. **Both numbers are true at once,
   and only one of them is a fact about the game a player plays.** Method 4 could not tell them
   apart. **Fixed:** new **method 11** requires `RI-JRN09` M1 and M3 to be run and cited; the
   Questionnaire axis now requires **`DTR_q = 1.00` at its pass floor**, and the Class-roster axis's
   0 band now reads *"reachable only in principle: 0 in a published-histogram sweep"*.

2. **The hard-fail cap had no instrument.** `SCORING` §1.1 — *"any triggered hard fail caps the
   whole item at 2"* — is binding, fail-closed, and round 2 recorded **two** triggered hard fails
   against `RI-CHR01`, in the verdict's own `hard_fails[]` array, and scored it **4**.
   `tools/verdict-validate.mjs` **read that array**, used it to force `status: FAIL`, and never
   checked the cap. A binding rule with its data already in hand went unenforced for a whole wave.

3. **The ladder anchor row was silent below 4.** See R5.2.

**Verified as code, not claimed:** `verdict-validate.mjs` now errors on both. Run over the tree at
this pass it fails `W1-07-r2` (`RI-CHR01` scored 4 with two hard fails), `W1-07` and `W1-10`
(`RI-WPN06` scored 3 with a hard fail) — **and no verdict where the rule was applied correctly.**
That is the test of an instrument, and it is also the regression test for this amendment: it makes
the historical record score *worse*, in a second area I was not looking at.

---

# R5 — `RI-CHR02` §4c's greeting bands, and two scoring rules with no instrument

## R5.1 The 0–7% headroom. **The referral's premise is REFUSED on the evidence, and the axis is replaced with a harder one anyway.**

The referral: the build passes every §4c floor with **0–7% headroom** against a band wanting ≥ 20%,
and *"passing by a whisker on every axis at once is a signature of tuning to the bar."*

I expected to uphold this and the arithmetic does not support it. Round 2 measured greetings
**1,500 / 1,500 (0%)**, race-gated topics 96/90 (6.7%), `forbids` 32/30 (6.7%), rumours **16 / 16
(0%)**, slavery lines 61/60 (1.7%). **Three of those five minimums are not floors a builder chose to
sit on. They are exact products this item computes for them:**

- greetings: §4c states `12 groups × 5 bands × 5 classes = 300 cells, 1,500 lines` at ≥ 5 per cell.
  **1,500 is simultaneously the floor and the natural exact value.** Twenty per cent headroom means
  writing a sixth line into every one of 300 cells for no stated reason, and the only thing it
  measures is willingness to pad.
- rumours: `≥ 2 per settlement × 8 settlements = 16`. Headroom of 20% is **19.2**, which is not
  expressible as a per-settlement rule at all.
- `forbids` is a sub-count of the topic count, so headroom on it double-counts headroom on its
  parent.

**A band asking for 20% more of a number the item itself derives as a product is not a bar; it is an
invitation to generate.** The 0–6.7% pattern is what this band's *structure* produces. And the
tuning charge, if it were sustainable, would be sustained against a bar that published its target to
the unit — which this one does.

**But the axis was pointed at the wrong property entirely, and that is the real finding.** The
round-2 verdict spent a section correctly defending the 1,500 lines as a combinatorial expansion of
300 authored stances × 60 authored addresses — **and in the same verdict recorded that
`greetings.json` has zero world-side consumers**. From the player's chair 1,500 lines and 0 lines
are the same thing. The axis rewarded the count and was blind to the delivery.

**Replaced, taking points out of volume and putting them into distribution and consumption:**

| Sub-axis | 10 | 6 (pass floor) | 0 |
|---|---|---|---|
| **Volume** | every §4c minimum met | every §4c minimum met | any minimum missed, or zero `forbids.race` records |
| **Distribution** | no cell below 5 distinct lines; per-cell counts vary with a stated authored reason for every cell at the floor | no cell below 5; ≥ 250 of 300 populated | any cell empty at bands 3–5, or **every cell exactly equal in size** — a generator's signature |
| **Consumption** | ≥ 1 line from ≥ 250 of 300 cells observed **selected and drawn in play**, and the race-gated topic filter observed changing a **live** NPC's offered list | ≥ 1 line drawn from ≥ 100 cells, and the filter demonstrated once | **`coupling == 0` on greetings or race-gated topics ⇒ 0**, whatever the volume |

**Volume keeps every floor verbatim — not one minimum is reduced** — and loses only its 10 band,
which was unearnable honestly. Applied to round 2: Volume 6, Distribution ≥ 6, **Consumption 0** —
the topic list is byte-identical for a Dunmer and a Saxhleel and no harness verb matches `/greet/`.
Under `min-over-axes` this axis is **0** where it was scored **6**. **The amendment lowers round 2's
score.** That is how I know it is not a relaxation.

## R5.2 The missing rungs. **`min-over-axes` stopped being dispositive because the anchor row was silent below 4.**

Form A was specified as `| Ladder | 4 | 6 | 8 |`. On a `min-over-axes` item — where a *single* axis
at its 0 band sets the whole native score to 0, which is the entire purpose of a min rule — the
mandated row said **nothing at all about the region the item actually lands in**. `W1-07` round 2
recorded `native_score: 0` for `RI-CHR01`, `RI-CHR02` **and** `RI-CHR03` and translated all three to
ladder **4**, which §1.2's "the native band is a ceiling" permits only because the row was silent
and the critic had to fall back on prose.

The consequence is not cosmetic. **An axis at its 0 band cost these items six ladder points in
principle and zero in practice.** `SCORING` §1.2b now requires any item that can produce a native
below its ladder-4 anchor to publish **0 and 2 rungs**; the rows are added to `RI-CHR01`,
`RI-CHR02`, `RI-CHR03`, `RI-PRG02` and `RI-PRG03`. And C6's checker previously required the first
three cells to be *exactly* 4, 6, 8 — **a mandatory format that quietly forbade the better version
of itself** — so it now accepts any row whose rungs *cover* 4, 6 and 8.

**A gap between that amendment's text and its instrument, found on re-reading and closed here.**
§1.2b says the ceiling is *read off the item's anchor row*; `verdict-validate.mjs` guessed a generic
ceiling of 4 instead, which is exactly the score round 2 gave. It now reads the row: where an item
publishes `Ladder 0 = Native 0`, a native 0 is a **ladder 0**. Applied narrowly — only on an exact
native 0, only where the item publishes a 0 rung — it fires on `W1-07` (5 items) and `W1-07-r2`
(3 items) and **on no other verdict in the tree**.

## R5.3 **`min-over-axes` had no instrument at all — and that is a new finding, beyond the referrals.**

Twenty-one items declare `**Aggregation (a property of this item, not of the critic):**
min-over-axes`. The parenthesis is the whole point of the line: it exists so a critic cannot choose
a kinder rule. **Nothing has ever checked that the reported native score is the minimum.** In one
file, `W1-07` round 2, the rule was applied three different ways:

| Item | Axes marked `unmeasurable`/`fail` in the same verdict | `native_score` recorded | The min |
|---|---|---:|---:|
| `RI-CHR02` | 4 | **0** | 0 — correct |
| `RI-PRG02` | 1 (`M5-earned-fraction`) | **6** | 0 |
| `RI-PRG03` | 2 (`M-air-swings`, `M7-skill-scales-damage`) | **5** | 0 |

§1.1 already fixes an unmeasurable axis at 0, fail-closed. On a min rule that is the item. **Two of
six items were carried at 6 and 5 by an aggregation nobody performed, moving the piece mean by
1.8.** `SCORING` §1.2c and a new check in `verdict-validate.mjs` close it. It is a **warning, not an
error, for a stated reason rather than a tactical one**: `checks[]` are *methods* and the min is
over *axes*, and the two are not always one-to-one; a critic who has mapped them says which, in
prose. It tightens to error at wave 2.

Run over the tree it fires **seven** times across four verdicts — `W1-14-r2` (3), `W1-07-r2` (2),
`W1-01-r2` (1), `W1-14` (1). **Three of those pieces are not mine.** It is silent on the eleven
verdicts where the min was taken correctly.

---

# R6 — CONSUMPTION. **It had reached 0 of 14 items in this scope. Now 15, and the failure has a fourth shape.**

**Measured before this pass:** `grep -cE 'RI-MTH07|CONSUMPTION|world-side consumer'` over
`RI-JRN01`–`RI-JRN08`, `RI-CHR01`–`RI-CHR03`, `RI-PRG02`, `RI-PRG03` and `RI-EXP01` returned **0
for every one of the fourteen.** My combat counterpart found the identical stalled correction at 0
of 18, one day earlier, in a different directory. `ARBITRATION` §3 carries it, which is why critics
ran it — **the check reached the critics and never reached the items**, so nothing said which models
must be enumerated and nothing said what a zero costs. That is
`INTENT-AUDIT-CHARTER` §6's stalled correction in its purest form: *"a ruling amended without its
enforcement amended is not fixed."*

**A `### CONSUMPTION` block is now written into all fifteen items in scope** (`RI-JRN01`–`RI-JRN09`,
`RI-CHR01`–`RI-CHR03`, `RI-PRG02`, `RI-PRG03`, `RI-EXP01`): exhaustive enumeration, perturb-and-
observe with the null control, **an entity-side or frame-side observable only**, and the binary
consequence stated at the item. For a journey the admissible observable is *what the player could
see or do* — a drawn string, a rendered object, a surface that appears, an input that is accepted.
**A `getCensusState()` return value is not an observable**; `RI-MTH07` §B1 rules the trace an
observer. And there is no `partial`: round 2 recorded `PARTIAL — unobservable` on `RI-CHR03`'s Dry
Well, which is not a disposition this check has.

**The fourth shape.** `RI-MTH07` §A names orphan model, orphan data and orphan predicate. This area
produced a fourth and it needs a name:

> **Orphan text** — a string authored, computed correctly, carried through the model, exposed
> through the harness, and **never drawn**. From the player's chair it is identical to a string that
> was never written.

`greetings.json`'s 1,500 lines and the ten dilemma questions are the same failure at two different
distances from the screen. This project has now found **seven** subsystems shipping models nothing
reads; the weapon impact model, whose five of six perturbations change nothing, is an eighth by a
different route. **`RI-JRN09` is the instrument for the text-shaped ones.**

`RI-PRG02` gets the opposite treatment, because it contains the corpus's **best worked instance of
this check passing** and it should be copied: round 1 reported `hp_max` 620 for VIGOUR 6 and 18
alike; round 2 reported 508 and 196 — *and then counted hits*, **11 blows of 50 to fell the Orsimer
and 4 to fell the Bosmer**. The second number is the consumption proof and the first is not, because
the pool being right and the fight reading the pool are two different claims.

---

# R7 — Is the decomposition right? **The set is right and the piece boundary is badly wrong, and the number is stark.**

`CORPUS-CONTRACT` §4 as amended requires a piece's item set to be built from the `judges:` field and
requires the declared path set to cover what the piece ships. I checked `W1-07`'s set both ways,
resolving through the 226-entry alias table.

**Direction 1 — scored but judging nothing declared: clean.** All six scored items judge a declared
path once `progression.attributes → progression.level.attributes` and
`progression.skills → progression.skill.usegrowth` are resolved. This area did not repeat `W1-09`'s
mistake, and the naive by-directory check that flags `RI-PRG02`/`RI-PRG03` is the checker's error,
not the piece's.

**Direction 2 — judging a declared path and never scored: two items.** `RI-QST03` and `RI-DLG04`
both judge `progression.skill.usegrowth` and neither has ever appeared on a `W1-07` verdict.

**Direction 3 — the piece is charged for paths it does not own.** `RI-JRN01` judges **three** paths:
`journey.firstlaunch.flow`, `journey.chargen.diegesis`, `journey.onboarding.explanation`. `W1-07`
declares **only the middle one**. Under §4 rule 1 the Flow block (25 points) and the Restraint block
(20 points) — **45 of the item's 100 points** — measure paths the piece does not own and are a
cross-piece coupling debt owned by the `journey.firstlaunch.flow` seam.

**And the seam has no owner. Here is the number:**

> `subsystems.json` defines **38** `journey.*`, `input.*` and `experience.*` paths. Across every
> verdict in `corpus/90-verdicts/wave1/`, **exactly one** is declared by any piece:
> `journey.chargen.diegesis`. **Thirty-seven of thirty-eight are owned by nobody** — including all
> ten `input.*` paths, all six `journey.*` paths beyond chargen and firstlaunch, both of
> `RI-EXP01`'s, and both of `RI-JRN09`'s new ones.

That is `RI-MTH07` "How we lose" clause 2 at the scale of a whole subsystem family: *"a cross-piece
coupling debt with no owner is how both pieces pass and the game does nothing."* Under §4 rule 2 the
remedy is **not** to drop the 45 points — the build *ships* a boot path and has therefore silently
escaped the item that judges it for two rounds. **Both halves, or it is a relaxation:** the blocks
stay, and `journey.firstlaunch.flow` must be declared by a piece.

---

# R8 — Are the bars judging the writing? **They were not, and one of them now credits it, deliberately narrowly.**

Two verdicts have called this build's writing better than Morrowind's own, and **no bar in the
corpus could say so.** Morrowind's opening is remembered for its writing as much as its structure,
so a set of bars that scores only structure is measuring the smaller half of the thing the owner
asked about.

But a bar that says *"score the prose"* is worse than no bar: it is unfalsifiable, it moves with the
critic, and it is exactly the sort of check a well-written verdict can win by being well written.
So the ruling is narrow and I want its narrowness on the record:

- **`RI-JRN09` M2 is the only place writing is credited, and it is credited as a countable
  property.** A line that is *responsive to what the player just said* is a thing no generator
  produces and no template survives. Round 2's Warden-Scribe observing the player's race and
  mis-recording it — *"Altmer. — No, of course not, you are not tall enough and you are not smug
  enough. Dunmer. I will write Dunmer."* — is a full credit under M2(a), and it is a better idea
  than Morrowind's own. **This item exists partly to make that scoreable.**
- **The mitigation against it becoming a receipt** is in M2's own How-we-lose: every answer read
  back verbatim scores 7 of 7 and is *worse* writing. The critic must **quote the drawn line for
  each of the seven**, and a verdict whose seven quotes are seven templates must say so in prose and
  score the axis at its floor. **That is the one place in the item where a critic exercises
  judgement, and it is declared there rather than hidden.**
- **Everything else stays a count.** All three of `RI-JRN09`'s measures are counts of strings,
  answers or runs. The item's own How-we-lose names *"the item is read as 'score the prose'"* as a
  way it dies.

**What I did not do, and why.** I did not add a prose-quality bar to `RI-JRN01` or `RI-CHR01`. The
honest position is that the corpus can measure *whether the writing was delivered and used* and
cannot measure *whether it is good*, and pretending otherwise would produce a number that means
nothing. `RI-DLG06`'s blind register test is the corpus's one real instrument in this class and it
belongs to dialogue, not here. **Delivered and consumed is a floor, not a ceiling, and it is stated
as a floor.**

---

# R9 — The regression test: does round 2 still fail under every amended item?

**Yes, and by a wider margin.** An amendment that happens to pass the current build is a lowered bar
in disguise, so this table is the test that matters. Re-read under the amended items, using round
2's own measurements and nothing new:

| Item | Round 2 as scored | Re-read | Why |
|---|---:|---:|---|
| `RI-CHR01` | 4 | **0** | Distinctness leaves the min as `corpus_debt`; Questionnaire axis 0 (`DTR_q` = 0, questions never drawn); Class-roster 0 (0 of 14 in play). Native 0 → the item's own new 0 rung. Two hard fails cap at 2 independently |
| `RI-CHR02` | 4 | **0** | Dialogue-delivery Consumption 0 — `coupling == 0` on `greetings.json` **and** on race-gated topics **and** on the guard tables. Three axes at 0 under min-over-axes |
| `RI-CHR03` | 4 | **0** | Decidability leaves the min as `corpus_debt`; Drawback-reality 0 — Focus never fell below max in anything the critic could drive, and `RI-MTH07` has no `partial`. Cause is cross-piece ⇒ `W1-07`↔`W1-14` seam debt |
| `RI-PRG02` | 6 | **0** | §1.2c: min-over-axes with `M5-earned-fraction` unmeasurable. (Its consumption proof is genuinely the best in the corpus and it still scores 0, because a min rule means what it says) |
| `RI-PRG03` | 5 | **0** | §1.2c: two unmeasurable axes, one of them `M7-skill-scales-damage` — **the only place skill is allowed to touch the fight, never measured on any build** |
| `RI-JRN01` | 0 | **2** | Now measurable; capped at 2 by HF5 (2 of 4 modalities), HF7 (0 of 14 professions), M8's new hard fail (writ is an API string) and HF9 (no title surface) |
| `RI-JRN09` | — | **2** | HF1 (`DTR` < 0.50 on the questionnaire node class) and HF3 (`NAMED_distinct` == 0) |
| **Piece mean** | **3.8** | **≈ 1.3 over six, 1.4 over seven** | |

**The bars got harder in every direction except one, and that one is explained.** `RI-JRN01`'s
0 → 2 is the corpus ceasing to charge a builder for its own missing tool and starting to charge the
builder for four defects it can actually fix.

**One thing this test cannot cover, said rather than hidden.** A round-3 builder is working in
parallel and its plan targets exactly `RI-JRN09` M1 and M3 — it reports questions drawn 10 of 10 and
named classes 12 of 14 over the critic's own sweep shape. If that lands, `RI-JRN09` will credit it.
**That is the item working, not the bar bending:** the item was written against round 2's
measurements, before round 3 existed, and its M2 (`AC ≥ 6 of 7`, each with the drawn line quoted)
is not on that builder's plan. A bar filed on Monday and passed on Tuesday by a fix aimed at the
defect that motivated it is the system succeeding.

---

# Which bars in this scope could not be passed by any build?

Three, all now fixed, and a fourth that is not mine to fix:

1. **`RI-JRN01`, entire** — 100 of 100 points fail-closed on `journey-run.mjs`, which does not
   exist, was mandated by `RI-MTH06`, and was assigned to nobody. Scored 0 twice. **Fixed:** 67 of
   100 runnable, 33 `corpus_debt`.
2. **`RI-CHR01`** — `min-over-axes` × an axis blocked on `build-viability.mjs`. **Native 0 for every
   build that will ever be written.** Fixed: the axis leaves the min as `corpus_debt`, keeping its
   486/540 target verbatim, and returns the day the tool exists.
3. **`RI-CHR03`** — identical mechanism, identical tool. Fixed identically.
4. **`RI-EXP01`** — all five of its tools phantom, its two paths declared by no piece, **never run
   on any build.** Not fixed here: it needs its tools written and its paths owned, and both are
   `RI-MTH06`'s and the orchestrator's, not a builder's.

Half of `W1-07`'s scored item set was unpassable by construction. That, and not builder
incompetence, is why two rounds produced 1.5 and 3.8 — and it is the same finding
`BAR-CRITIQUE-W1-09-R1` §R6.4 made about `W1-09`, arrived at independently, in a second area.

---

# The single biggest weakness

**This corpus measures the room and not the conversation, and it does so systematically.**

Every instrument that works in this area is pointed at a *structural* property: how many surfaces,
what fraction of the frame, which entity is speaking, how many entities exist, whether a token
appears in a data file, whether an input path reaches a poll function. Every one of those is
necessary. Together they scored a build that delivered **zero of ten authored questions** at 19 of
19, pass, pass, pass.

The instruments that would have caught it are the 67 that do not exist — thirty of them in
`corpus/95-experience/`, the area whose entire subject is whether the game is any good. **The
corpus built the tools that check whether the artifact is right and did not build the tools that
check whether it is any good.** Three bar critics working independently in three areas have now each
written a version of that sentence. It is no longer an observation about an area; it is a fact about
the project, and it has a measured number attached to it for the first time.

---

# What was changed, and where

| Change | File | Referral |
|---|---|---|
| Fail-closed clause **narrowed per check**; blocked weight becomes `corpus_debt`; bands apply to the runnable fraction (67/100) | `RI-JRN01` §0.1 | R1 |
| **M4 SPLIT** — the ≥ 60 s threshold stays blocked and is named as never measured | `RI-JRN01` M4 | R1 |
| **M5 stiffened** — UI area from a pixel readback, never the build's own layout report | `RI-JRN01` M5 | R1 |
| **M8 stiffened** — the writ's text must reach the frame; API-only is a hard fail | `RI-JRN01` M8 | R1 |
| **M9/M15 gated on a named, demonstrated rendered-text accessor**; no accessor ⇒ `unmeasurable ⇒ 0`, never pass | `RI-JRN01` M9/M15 | R1 |
| **M13 SPLIT** — reachability released, descriptors stay `RI-JRN04`'s; `gamepad-shim.mjs` struck for the released legs | `RI-JRN01` M13 | R1 |
| **M20 + HF9 added** — a title surface must exist and a save must be reachable from it; 5 points taken *out of* the Flow block | `RI-JRN01` M20 | R1 |
| **§0.2** — mandatory citation of `DTR`/`AC`/`NAMED`, `T_control`, and `RI-EXP01`'s beats | `RI-JRN01` §0.2 | R3, R7 |
| Four new How-we-lose entries, each a way the item **was already being passed** | `RI-JRN01` | R1, R3 |
| Amendment ruled **GRANTED IN PART** clause by clause, in the proposal file | `AMENDMENT-PROPOSAL-JRN01-01` | R1 |
| **§E — the phantom-command sweep run for the first time**: 67 of 82, area distribution, and the two rules | `RI-MTH06` §E | R2 |
| **C8** — phantom-tool detection wired into the corpus gate; `warn` in wave 1, `error` from wave 2 | `tools/corpus-index.mjs` | R2 |
| Stale `74 of 137` corrected to the measured `67 of 82 across 144`, with the double-count explained | `RI-MTH06`, `corpus-index.mjs` | R2 |
| **Distinctness axis → `corpus_debt`** while `build-viability.mjs` is absent; thresholds kept verbatim | `RI-CHR01` method 6 | R2 |
| **Decidability axis → `corpus_debt`**, same mechanism | `RI-CHR03` method 5 | R2 |
| **Method 11** — the naming moment and the delivered scene; `4^10` enumeration declared *not sufficient* | `RI-CHR01` method 11 | R4 |
| Questionnaire axis requires **`DTR_q = 1.00`**; Class-roster requires reachability **in play** | `RI-CHR01` Scoring | R4 |
| **"Dialogue volume" replaced by "Dialogue delivery"** — Volume / Distribution / Consumption, floors kept verbatim, 10 band removed | `RI-CHR02` §4c + Scoring | R5.1 |
| **0 and 2 ladder rungs added** to five items; C6 widened to accept them | `RI-CHR01`–`03`, `RI-PRG02`, `RI-PRG03`, `corpus-index.mjs` | R5.2 |
| **§1.2b** — rungs below 4 mandatory on min-over-axes items; hard-fail cap and native-0 ceiling get an instrument | `SCORING` §1.2b | R4, R5.2 |
| Ceiling now **read off the item's anchor row** rather than guessed at 4 | `verdict-validate.mjs` | R5.2 |
| **§1.2c** — `min-over-axes` gets an instrument; warns in wave 1, errors in wave 2 | `SCORING` §1.2c, `verdict-validate.mjs` | R5.3 |
| **`### CONSUMPTION` written into all fifteen items in scope**; the **orphan text** shape named | `RI-JRN01`–`09`, `RI-CHR01`–`03`, `RI-PRG02`/`03`, `RI-EXP01` | R6 |
| Piece-decomposition block: 45 of `RI-JRN01`'s 100 points measure paths `W1-07` does not own | `RI-JRN01` Scoring | R7 |
| **New item: the opening as an exchange — `DTR`, `AC`, `NAMED`, and the citations** | `RI-JRN09` | **R3, R4, R8** |
| `journey.opening.exchange`, `journey.opening.legibility` registered | `subsystems.json`, `INDEX.md` | R3 |

**Thresholds lowered: none.** Every re-cut takes points *out of* existing checks; every
renormalisation removes weight from numerator and denominator alike and leaves the bands untouched;
the one axis that lost a band (`RI-CHR02` Volume) lost only its **10**, kept every floor verbatim,
and was replaced by two harder sub-axes. **Every amendment in this pass makes round 2 score lower,
and three of them make verdicts in other people's areas fail.**

---

# Conditions for SATISFIED

This area is **not cleared by these edits.** Five of them are the kind whose correctness cannot be
established by argument, and my predecessors' standard applies: they must be **run once**.

1. **`RI-JRN09` M1, M2 and M3 are run once**, with the published a/b/c/d histogram. If `DTR_q`
   comes back at 1.00 and `AC` at 6 of 7 on the same build, that is the most important number this
   piece has produced.
2. **`tools/journey/journey-run.mjs`, `beat-extract.mjs` and the `A-JRN1` trace events exist**, at
   which point `RI-JRN01`'s 33 points of `corpus_debt` expire by their own condition and **M4
   clause 1 — the ≥ 60 s bar nobody has ever measured — is measured for the first time.**
3. **`tools/analysis/build-viability.mjs` exists**, returning `RI-CHR01`'s Distinctness and
   `RI-CHR03`'s Decidability to their mins at their unchanged thresholds.
4. **`RI-EXP01` is run on a build, ever.** It needs five phantom tools and an owner for
   `experience.opening.hook` / `experience.opening.beats`. It is the corpus's only pre-existing
   answer to the owner's actual question and it has never produced a number.
5. **`W1-07`'s declared path set is corrected**: `journey.firstlaunch.flow`,
   `journey.onboarding.explanation`, `journey.opening.exchange` and `journey.opening.legibility`
   given owners, and `RI-QST03`/`RI-DLG04` either scored or moved to the seam ledger. **37 of 38
   `journey.*`/`input.*`/`experience.*` paths are owned by nobody.**
6. **A `W1-07` verdict cites `RI-PLT03`'s `T_control`.** Two exist with no figure for how long it
   takes to get a body, in a piece whose first requirement is the time to a controllable body.
7. **The phantom count goes down.** 67 today. It becomes a blocking error at wave 2 and nothing else
   in this project has ever paid a debt down without a gate.

Until then this critic's position is **NOT SATISFIED**, and the honest summary for the orchestrator:

> **Do not dispatch `W1-07` round 4 against the old bars — it could not pass them, and half its item
> set was unpassable by construction.** Round 3 is aimed at the right defects and should be judged
> against `RI-JRN09` and the amended `RI-CHR01`/`RI-CHR02` on evidence. But dispatch
> `build-viability.mjs`, `journey-run.mjs` and `session-run.mjs` **as corpus work with a corpus
> owner**, because they are not a builder's job and three builders have now been charged for them.

---

# Provenance

`provenance: constructed`, confidence **high** on every finding derived by reading the corpus and
**measured** on every figure quoted from a wave-1 verdict.

- The phantom census (144 items scanned, 82 distinct paths, 15 present, 67 absent, and the per-area
  table), the absence of `RI-MTH07`/CONSUMPTION from all fourteen items before this pass, the
  21 `min-over-axes` items, the alias-resolved `judges:` comparison, and the count of
  `journey.*`/`input.*`/`experience.*` paths declared by any wave-1 verdict (1 of 38) are **direct
  reads of files in this repository**, each reproducible by `node tools/corpus-index.mjs`,
  `node tools/verdict-validate.mjs --all`, or the scripts quoted in this file.
- Every measurement quoted about the build — 19 of 19 distinct frames, 18 of 18 speaker
  resolutions, 0 of 10 questions drawn, 0 of 14 named classes over 240 runs, `rendered_text: []` at
  the stamped node, UI area 0.136–0.336 self-reported against 0.17–0.49 measured, 1,500/1,500 and
  16/16 headroom, `hp_max` 508 vs 196 with 11 and 4 hits, `focus_max` 74 → 46, disposition 6 → 60
  and 92 g → 68 g, 28 gamepad presses, 11-of-14 reachable in principle against 0 in 1,600 runs — is
  **quoted from `W1-07.md`, `W1-07-r2.md`, their artifacts and `orchestration/status/W1-07-r3.json`**
  and attributed to the critic or builder who measured it. **This critic did not re-run the build**;
  it judges standards, not code.
- The arithmetic in "Was it the bars, or the build?" (gate 7.0 × 6 = 42; three items pinned at 0 ⇒
  ceiling 30 ⇒ mean 5.0; 38/6 = 6.33 under the generous translation) is computed here from
  `SCORING` §1.1/§1.2 and the two verdicts' own item tables, and is reproducible by hand.
- The thresholds introduced in `RI-JRN09` — `DTR_q = 1.00`, `DTR_scene ≥ 0.90`, `AC ≥ 6 of 7`, the
  45/30/20/5 weights and the four hard fails — are **conventions defined by that item**, in the same
  class as `RI-MTH07`'s `[0.95, 1.05]` coupling band, and are declared as such in its Provenance
  note. `NAMED_distinct ≥ 10` is **inherited unchanged** from `RI-CHR01` §5 and is not a new
  threshold. `RI-JRN09` §A (`MW/EXCHANGE`) is `canonical-recall`, confidence medium, and **no
  threshold in that item is derived from a Morrowind timing.**
- **Corrections to my own earlier text made in this pass**, recorded rather than quietly fixed:
  `RI-MTH06` §E's "74 of 137" (→ 67 of 82 across 144, with the per-area double-count explained), and
  §1.2b's ceiling being *guessed* at 4 by the validator rather than *read* from the item's anchor
  row as the amendment's own text requires.
