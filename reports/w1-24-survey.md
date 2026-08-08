# W1-24 — the visual protocol and the player's body

**Piece:** `W1-24` · **paths:** `render.process.bifurcation`, `render.process.measurement` ·
**judged by:** RI-CAM07, RI-UIX06, RI-VIS01, RI-VIS03, RI-VIS06, RI-VIS09
**Commit:** see `reports/w1-24/*.json` — every artifact stamps its own (RULES.md rule 12).

This piece is **not** the fidelity pass; that is wave 4. It is the protocol that has to exist
before any visual number is quoted, and the one fidelity path the camera depends on.

---

## 0. What this is answering

Six visual numbers already published in this repository were wrong in six *different* ways, and
not one of them was wrong because a metric was miscalculated. Every one was wrong in **the act of
reading**:

| # | The failure | Where it is on disk |
|---|---|---|
| 1 | A check asserted a canvas existed, with non-zero dimensions, and no page errors. **All three were true of a black screen.** | the dispatch's own list |
| 2 | A distinctness measure returned **8 distinct images from one unchanged room** after two fixed steps. It was hashing the step counter. | `corpus/90-verdicts/wave1/W1-04-r2.md` |
| 3 | `interior.meshes` was quoted as a renderer read. It is a **build record**: empty the scene group and it still reports 127 meshes of a room that is not there. | `corpus/90-verdicts/wave1/W1-04-r3.md` Row 4 |
| 4 | A colour check compared a 0–255 **luma** overshoot against a threshold of 40 while its own item specifies **ΔE**. Converted properly: 58.291 dE2000, a hard fail. | `orchestration/status/W1-21-r3.json` FD6 |
| 5 | A camera projection was blind because posing a camera never wrote its yaw. | `corpus/90-verdicts/wave1/W1-13-r3.md` §5/§7 |
| 6 | A chart font sheared every glyph, so published **numbers** could be read as different numbers. | W1-16 round 3 |

So the deliverable is not a metric. It is **a protocol that says what a visual measurement must
do before its number counts**, and an instrument that refuses to produce a number without it.

---

## 1. `render.process.bifurcation` — `corpus/80-methods/cc-scan.mjs`

RI-VIS01 §Comparison-method step 5 names this exact path and this exact CLI. Its own provenance
note closes: *"`cc-scan.mjs` does not exist yet — it is specified here and owed by the methods
owner; until it exists, §C is run by hand and the critic states 'cc-scan: manual' in its
verdict."* RULES.md rule 24: build it, and make it able to fail.

**Two checks with different standing, and the tool says which is which in every output.** RI-VIS01
§How-we-lose names the danger itself: *"The lint becomes the judge. cc-scan.mjs passes because the
critic avoided the banned words while making the banned argument."*

**Structural (load-bearing — these decide the verdict):**

| | |
|---|---|
| S1 | a declaration block exists and is well-formed |
| S2 | `JUDGEMENT SIDE` is singular and one of the two legal values |
| S3 | every declared property exists in RI-VIS01 §A — **parsed from the item file, not restated** — and sits on the declared side |
| S4 | `PERMITTED` / `FORBIDDEN` reference sets match the declared side |
| S5 | `CAPTURE` resolves on disk **and its declared sha256 is the file's actual sha256** |
| S6 | ordering — no capture cited before the first declaration (§How-we-lose: "retroactive declaration ... detectable only by ordering") |
| S7 | score fusion (CC-5) — one fused visual number, or a mean over the two sides |
| S8 | the **body** does not judge a property belonging to the side it did not declare |

**Lexical (a tripwire — never decides a verdict alone):** CC-1 … CC-7, verbatim from §C, scoped to
the enclosing declaration's side exactly as §C requires.

Exit codes separate them: `0` clean · `4` TRIPWIRE (re-read the line) · `5` VOID (structural) ·
`6` ABSENT (visual claims, no declaration).

### The falsifier found one of my own checks doing nothing

`--self-test` runs 14 synthetic verdicts and then re-runs the whole suite **nine times with each
of the tool's own checks disabled**, requiring the suite to go red under every one.

S8's first draft compared property-set overlap between two declarations. `--break=disjoint` left
the suite green — because §A assigns each id to exactly one side, so an overlap can only occur
alongside an S3 violation. **A check that cannot fail alone is not a check.** It was rewritten to
test what S3 structurally cannot see: one honest declaration followed by prose that judges the
other side anyway. That case now goes red under `--break=disjoint` and under nothing else.

```
PASS  14 cases, 9 deliberate self-defects, 0 inert.
```

### Run against the real corpus

`node corpus/80-methods/cc-scan.mjs corpus/90-verdicts/wave1/*.md corpus/90-verdicts/*.md`

> **Zero of seventy wave-1 verdicts carry a `=== VIS DECLARATION ===` block.**
> Fifteen of them make visual claims without one. Under RI-VIS01 §B those fifteen are **void and
> score 0**, and RI-VIS01 §Scoring's failure threshold voids the visual verdict for the wave.

The other 55 are reported `NOT_APPLICABLE`, not `CLEAN` — and that distinction is itself a
correction made during this piece. The tool's first run over the corpus returned **55 CLEAN**,
which is a pass over an empty sample set: those files were never examined, they simply are not
about visuals. `tools/lib/graded.mjs` exists for exactly this law and the scanner now obeys it.

The 15 voided files:

```
W1-00.md  W1-00-r2.md  W1-01.md  W1-01-r2.md  W1-03-r1.md  W1-07-r2.md  W1-09-r2.md
W1-10.md  W1-13-r1.md  W1-14.md  W1-14-r2.md  W1-15-r2.md  W1-21-r1.md  W1-21-r2.md
W1-23-r1.md
```

**This is a ruling, and it is reversible** (CLAUDE.md rule 0). I am not retro-voiding fifteen
verdicts by fiat — I am reporting that the item's own §B makes them void and that no critic has
ever emitted the block the item requires. What would overturn it: an arbiter ruling that RI-VIS01
§B binds only from the wave in which `cc-scan.mjs` exists. That is a defensible reading and it
would need saying out loud, because the alternative — quietly grandfathering — is how the
protocol becomes advisory.

---

## 2. `render.process.measurement` — `tools/render/visual-reading.mjs`

A **reading** cannot be constructed without answering five questions. Each maps to one of the six
failures above, and each is a field the caller cannot omit.

| | Question | Field | Kills |
|---|---|---|---|
| **Q1** | what surface was read? | `surface` + `claim_class`, checked against a closed `ADMISSIBLE` table | failure 3 — a `BUILD_RECORD` can never support an `ON_SCREEN` claim |
| **Q2** | can it tell the subject from time passing? | the **CLOCK 2×2**: `subjects` (≥ 2) × `clock_steps` | failure 2, in both directions |
| **Q3** | what is the null control? | `factors`, run through **`tools/experience/lib/sabotage.mjs`** — not re-implemented (rule 10) | the inert fix and the inert control |
| **Q4** | in what units? | `unit` and `band.unit`, which must be the same string | failure 4 |
| **Q5** | how is it shown able to fail? | `degenerate` — the predicate must go red on a subject that is definitionally a failure | failure 1 |

**Q3 and Q5 are not the same control, and conflating them is how failure 1 survived.** Q3 breaks
the *mechanism* and asks whether the number depends on it. Q5 breaks the *subject* and asks
whether the predicate can ever say no. A probe can pass Q3 perfectly and still be `canvas !== null`.

### The cascade, and why `PASSES_ON_DEGENERATE` outranks the discrimination arms

Rule 4 — *"a probe that cannot fail is worse than no probe"* — is a statement about whether the
check has a red state at all, and a probe with no red state has no discrimination worth measuring.
Every condition that held is recorded in `concurrent_failures`, so the collisions a cascade
necessarily creates are reported rather than swallowed. That is sabotage.mjs's own round-2 lesson,
applied unchanged.

`DEGENERATE_NOT_GRADEABLE` was added mid-piece, from a real result: FD6's `edgeFringe()` returns
`{worst: 0}` over zero edge pixels and 0 is inside a `max` band. **A degenerate subject that
produced no samples has shown nothing** — it is neither a pass nor a demonstrated red. EMPTY is
not a pass, and the reading now says so rather than claiming a Q5 it never ran.

### The falsifier

`--self-test` replays all six published failures as readings with known verdicts, plus a clean
control and three edge cases, then re-runs the suite with each of the module's own checks disabled.

```
PASS  11 readings, 7 deliberate self-defects, 0 inert.
```

The clean control is load-bearing: an instrument that voids everything is exactly as useless as
one that voids nothing, and failure 1 was a check whose green arm had never been tried against a
subject that should have been red.

---

## 3. The protocol run against numbers this project has already published

`node tools/render/w1-24-audit.mjs` — see `reports/w1-24/published-claims-audit.json`.
One browser, launched once and kept (rule 21), closed by handle. **Taken under fleet load** — 3–6
browser instances and 2.6–4.1 per core throughout (rule 26: say under what load every timing figure
was taken).

### 3.1 Results

| | The published claim | Verdict | What the reading found |
|---|---|---|---|
| **B** | *"115 rooms read, 100 distinct"* (`W1-04-r5`) | **SURVIVES — `OK`** | all five questions answered |
| **C** | *"a canvas exists, with non-zero dimensions, and no page errors"* — the boot-liveness shape | **FAILS — `PASSES_ON_DEGENERATE`** | and it holds **three** failures at once |
| **A** | *"8 distinct images at 8 town centres"* (`W1-04-r2` round-3 acceptance 3) | **FAILS — `NULL_CONTROL_FAILED` (INERT)** | the number is the same with the buildings cut |
| **D** | *"58.291 dE2000 against a hard-fail bar of 8"* (`W1-21-r3` FD6) | **`DEGENERATE_NOT_GRADEABLE`** | Q1–Q4 all survive; Q5 is unanswerable from the record |

**One of four survives outright.** Its number also disagrees with nothing published — it is the one
claim whose instrument answers all five questions.

**C is the result this piece exists for, and it is live, on the running build.**

```
degenerate: every canvas in the document cleared to black AFTER the renderer has drawn
            value 1, support 1, in_band TRUE     <- the check says the game is rendering
clock     : t0 = 1, t120 = 1, other subject = 1  <- BLIND_TO_SUBJECT
null      : INERT — "no arm produced a different value from any other (1, 2 arms).
                     Breaking `render` changed nothing."
ALSO HELD : PASSES_ON_DEGENERATE, BLIND_TO_SUBJECT, NULL_CONTROL_FAILED
```

That check **cannot say no**, **cannot see its own subject**, and **nothing it reports depends on
the renderer having drawn**. Three independent failures in one three-clause assertion, and every
one of them is reproducible in about four seconds. It was used as evidence that the build was
rendering while the owner was looking at a black screen.

**D survives everything the published record can answer.** The clock arm holds (58.291 at t0 and
t1), the subject arm moves (58.291 vs the round-2 figure of 151), the units conform (`dE2000`
against a `dE2000` band — the exact thing round 2 got wrong), and the null control is `OK`:
*"breaking `colourspace` moved it from 58.291 to 151, over 98,659 graded edge pixels."* Only Q5 is
unanswered, because a degenerate subject for FD6 would need a capture set with known-bad fringing
and the round-3 captures are run artifacts `reports/.gitignore` deliberately does not track. The
nearest thing available — a capture set with zero graded edge pixels — is **FD6's own documented
empty-set hole**, and it produces no samples, so it demonstrates nothing. The reading says so
instead of awarding a pass.

**B survives, and it is the only one that does.** Over the first 24 authored interiors:

```
value     : 24 distinct scene-graph signatures over 24 interiors
clock     : t0 = 24, t+60 = 24                          <- does not move with time alone
subject   : one interior entered 24 times = 1           <- moves with the subject
degenerate: every signature replaced by a constant = 1  <- out of band, the predicate can say no
null      : OK — breaking `scenegraph` moved it 24 -> 1 over 24 interiors
```

The claim is declared `IN_THE_SCENE` off `SCENE_GRAPH`, which is admissible. **The same number
declared `ON_SCREEN` would have been refused at Q1 before a single frame was captured** — which is
the `interior.meshes` failure, prevented rather than caught.

**A's number does not depend on the buildings.** The eight-town distinct-image sweep passes every
arm except the one that matters:

```
clock     : t0 = 8, t+60 = 8                            <- holds
subject   : one town photographed eight times = 1       <- moves; this IS the acceptance's own control arm
degenerate: eight captures, canvases cleared to black = 1  <- out of band
null      : INERT — intact 8, `buildings` cut 8, over 8 captures.
            "Breaking `buildings` changed nothing."
```

The acceptance was written to prove **settlements render**. The number it specifies — eight
distinct images from eight town centres — **comes out at 8 with the settlement building draw cut**.
Eight different places on a province look different from each other whether or not anyone built a
town on them: terrain, lighting and horizon are doing the work. A round that satisfies acceptance 3
as written will have demonstrated that the eight towns are in eight different places.

> **This is a finding about the acceptance criterion, not about the build.** The fix is one clause:
> acceptance 3's control arm should be *the same eight poses with `drawBuildings` cut*, not *one
> pose eight times*. Written that way it measures buildings; written as it stands it measures
> geography. I have not edited `W1-04-r2.md` — it is a critic's verdict and not my file — and I am
> recording the correction here for whoever runs W1-04 round 6.

---

## 4. `render.fidelity.character` — the one fidelity path the camera depends on

RI-CAM07's premise is seam S18: the camera is behind the character 100% of the time, so the back
is the front. Its Comparison method M1 opens with a **build** instruction that had never been
carried out — *"Add `player_back_closeup` and `player_front_closeup` to
`tools/harness/viewpoints.json` by amendment"* — which is why M1, M2 and M4 were unrunnable by
construction and the item's own harness-dependency note scores them 0 fail-closed.

`tools/render/cam07-back.mjs` adds and captures them. See §4.1.

### §B1 is unmeasurable as written, and this piece says so rather than substituting a number

§B1 says *"RI-VIS03 M5 `HFR` on the back crop and the front crop"*. `tools/metrics/lib/vis03.mjs`
M5 requires a **native 1024×1024** window and explicitly refuses to resample — *"a resampled M5
measures the resampler, not the render"* — while §B1's own framing requirement puts the character
at ≥ 45% of a 1080-line frame, about 486 px. **No 1024 window exists inside the crop.** The tool
runs `spectrum()` on the largest common native window of the full frame, identical for both
captures, and records the deviation. It is a parity ratio; it is not an RI-VIS03 M5 number and is
not reported as one.

**This is a corpus finding, not a tooling excuse.** Either §B1 names a crop size M5 can serve, or
M5 gains a smaller-K path with its own band. It cannot stand as written.

---

## 5. What I did not do

Stated as plainly as what I did (RULES.md rule 26).

- **I did not run the fidelity pass.** That is wave 4 and the plan says so explicitly. Nothing in
  this piece scores the game's *look*.
- **RI-CAM07 §B2, §B4, §B5, §C1–C8, §D1–D7, §E1–E7 were not run**, each for a stated structural
  reason recorded in `reports/w1-24/cam07-back.json`: no RI-VIS08 verdict exists anywhere under
  `corpus/90-verdicts/`, and neither `bones` nor `bones_ndc` is emitted by `game/src/sim/record.js`
  (established by `corpus/80-methods/m-cam07-presentation.mjs`, not re-derived here).
- **RI-CAM07 §F1–F5 were not touched.** They are the art-direction side, judged blind per RI-VIS06.
  RULES.md rule 25: do not judge a pack you built.
- **No blind pack was built and no blind comparison was run.** RI-VIS06 Protocol A needs a modern
  reference image and RI-VIS09 §5 records that the set holds exactly one; Protocol B's degradation
  recipe needs re-tuning against 320×320 AVIF references before any result from it is trustworthy.
  Both are named in RI-VIS09 and neither is closable by this piece.
- **`cc-scan.mjs` does not judge.** It is a lint plus eight structural gates. RI-VIS01 §C's
  human-readable rule remains the law and a confirmed CC hit still needs a reader.
- **The 15 voided verdicts were not re-judged.** Voiding is the item's consequence; re-judging is a
  critic's work and needs fresh context.
