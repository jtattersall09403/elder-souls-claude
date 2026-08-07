---
id: RI-MTH06
title: The two missing instruments — build viability, and a journey you can actually record
kind: structure
side: neutral
judges: [process.critic.discipline, process.verdict.format]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Two reference items in this corpus name a tool by its path, make an assertion that only that
tool can settle, and the tool has never been written. `RI-CHR01` method 6 says
`node tools/analysis/build-viability.mjs --signatures all --out reports/viability.json` and then
asserts *"≥ 486 signatures pass all four §5 criteria"*. `RI-JRN01` says its entire instrumented
pass *"requires harness amendment `A-JRN1`"* and that *"until it exists every check below is
`unmeasurable` and scores 0, fail-closed"*. `RI-CHR03` method 5 depends on the first;
`RI-JRN01` M13 additionally depends on `A-JRN2` (gamepad shim) and the blind pack on
`beat-extract.mjs`.

The consequence, observed in wave 1 (`corpus/90-verdicts/wave1/W1-07.json`): an item whose other
nine axes scored between 5 and 8 aggregated to **0** by its own min-over-axes rule, because one
axis could not be measured at all, and a journey item scored **0** without a single check being
run. Neither zero is informative about the build. **A dimension nobody can measure is a dimension
we do not have** (`CRITIC-DOCTRINE` §7.3), and that ruling is correct — which is exactly why the
instrument is now a deliverable with an owner rather than a footnote in someone else's item.

The bar is: **every `## Comparison method` step in this corpus names a command that exists and
exits 0 or 1, and no reference item can be blocked to 0 by the absence of a tool for more than
one wave after the blocking is first recorded in a verdict.**

## The reference artifact

### A. `tools/analysis/build-viability.mjs` — required by `RI-CHR01` M6, `RI-CHR03` M5

**Input.** The shipped `game/data/progression/**` and `game/data/quests/**`. No browser needed;
this is a static walk, and it must stay static so it can run in CI on every data change.

**Contract.**

```
node tools/analysis/build-viability.mjs --signatures all --out reports/viability.json
node tools/analysis/build-viability.mjs --signature saxhleel/fighter/given/interior --explain
```

**Output shape**, one record per signature, and the *failure list is the product*:

```json
{ "signature": "dunmer/mage/withheld/foreign",
  "viable": false,
  "criteria": { "main_quest": true, "three_factions_rank5": true,
                "no_unpassable_gate": false, "tier5_survivable": true },
  "stopped_at": { "quest": "q-cold-ledger", "stage": 4,
                  "gate": "requires.disposition >= 45 with RG-DEEP",
                  "why": "race term -40 + upbringing -4 puts the ceiling at 41" } }
```

**The four criteria are `RI-CHR01` §5's and are not restated here**, with one binding clarification
that item asks for: **criterion 4 (`survive the tier-5 region at level ≥ 55 in ≤ 3 attempts per
encounter in the sim model`) may not be stubbed to `true`.** `RI-CHR01`'s own *How we lose* says
so: *"Method 6 is a static walk and will not catch a lethality problem; the viability checker's
criterion 4 exists for it and must actually be implemented rather than stubbed."* A checker that
returns `viable: true` for every signature is worse than no checker, because it converts an
unmeasured dimension into a measured-and-passing one.

**Exit code 1** when fewer than 486 of 540 signatures are viable, so it can gate.

### B. `A-JRN1` — `tools/journey/journey-run.mjs`

Three capabilities, all of which the current harness lacks and none of which are optional for
`RI-JRN01`:

| Capability | Why no existing tool substitutes |
|---|---|
| **Real input path** | `queueInputs` injects on the closed action set at a frame index. `RI-JRN01` M2 must dispatch a real input *on a surface's first rendered frame* and count frames until the surface is gone — a title screen and a dialogue panel are not sim frames. |
| **`first_input` / `first_control` trace events** | M4 (control precedes definition) is the interval between two events that nothing currently emits. Measuring it from screenshots is guesswork. |
| **UI-text stream capture** | M9's instruction budget greps *every string rendered outside a dialogue/journal/book surface* over the whole journey. `document.body.innerText` sampling misses canvas-drawn text, which is where this project's text will live. |

Companions: **`A-JRN2`** `tools/journey/gamepad-shim.mjs` (M13), **`A-JRN4`** viewport/orientation
control (M13's touch run), and `tools/journey/beat-extract.mjs`, which the item's blind-pair
section names as the producer of pack side **A**.

### C. The blind-pack shape `RI-JRN01` actually needs

Wave 1 built the `RI-JRN01` pack by hand and had to record `reference-wins-on-review` partly
because the pack was unfair in form: our side was verbatim transcript from the running build, the
reference side was `RI-JRN01` §A's recalled beat *table*, which is narration. A pack in which one
side is dialogue and the other is stage direction is discriminable on register, not on the
property under test. `beat-extract.mjs` must therefore emit **both** sides in one form — actor,
place, utterance, field-set — and a matching extraction of `MW/OPEN` rows 3–12 must be committed
under `corpus/88-journeys/data/` once, so every future critic compares against the same text.

### D. The standing rule this item adds

> A reference item's `## Comparison method` may name a tool that does not yet exist **only if**
> the same item, or an item in `corpus/80-methods/`, names an owner and a wave for it. A method
> step that names a phantom command is a corpus defect and is filed as one, not absorbed into a
> build's score.

### E. **The phantom-command sweep, run for the first time** — *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R2)*

Method 1 has existed since wave 0 and **had never been run.** Run at this pass over the
`## Comparison method` section of all 144 reference items, resolving each `tools/**.mjs|cjs|js|py`
path against the tree. Reproduce with `node tools/corpus-index.mjs` (check **C8**):

```
reference items scanned                    : 144
distinct tool paths named in their methods :  82
        …resolving to a file on disk       :  15
        …PHANTOM                           :  67
```

**Sixty-seven of eighty-two — 82% of the instruments this corpus names do not exist.** Only 15 do.
This item's own Scoring puts *"≥ 5, or any in an item that gates a wave"* at the **0 band** on the
Phantom-commands axis, so under its own min-over-axes rule `RI-MTH06` is at **0**. It is the only
item in the corpus that fails on a measurement of the corpus, and recording that here rather than
in a verdict is the point of it existing.

The distribution is not uniform, and the shape is the finding:

| Area | Phantom tools named |
|---|---:|
| `95-experience` (played experience, anecdotes, cross-system payoff) | **30** |
| `86-ui` | 10 | 
| `40-dialogue` | 9 |
| `85-platform` | 8 |
| `88-journeys` | 6 |
| `80-methods`, `87-audio` | 4 each |
| `15-camera`, `22-character`, `23-stealth-crime` | 1 each |

**Every quality instrument pointed at the opening is in that list** — `session-run.mjs`,
`beat-diff.mjs`, `beat-extract.mjs`, `isolation-check.mjs`, `log-lint.mjs`, `journey-run.mjs`,
`gamepad-shim.mjs`, `naive-driver.mjs`, `build-viability.mjs` — while the *correctness* instruments
(`run-headless.mjs`, `content-stats.mjs`, `creation-audit.mjs`, `cmb-reach.mjs`, `determinism.mjs`,
`smoke.mjs`, `trace.mjs`) all exist and are used every round. **The corpus built the tools that
check whether the artifact is right and did not build the tools that check whether it is any
good** — and `corpus/95-experience/`, the area whose entire subject is whether the game is any
good, is 30 of the 67.

**Two rules follow, and neither lowers a threshold.**

**E.1 — The sweep is wired into the gate.** Method 1 becomes a check in
`node tools/corpus-index.mjs --check` (alongside `RI-MTH05` C6's ladder-anchor check), reported as
`phantom tools : N/137`, so the debt cannot regrow silently. A sweep run once and never again is
how 74 accumulated.

**E.2 — A dimension blocked *only* by a phantom tool is `corpus_debt`, not a zero against the
build.** This is the rule the corpus most needed and did not have, and its absence has cost three
builders a score each:

> Where a reference item's axis or check cannot be measured **solely** because a tool this item
> lists as phantom does not exist, that axis is recorded `unmeasurable`, its weight is **removed
> from the numerator and the denominator**, the item reports `raw / runnable`, and the debt is
> filed **against `RI-MTH06`** in the piece's `status_reasons` as `corpus_debt`. It is **not**
> averaged into the piece's mean.
>
> This does not soften `CRITIC-DOCTRINE` §7.3. §7.3 governs a **harness gap the piece could
> close**: fail-closed at 0, never "unknown". A tool the corpus mandated, assigned to nobody and
> never wrote is the *other* case, and `CRITIC-DOCTRINE` §7's own closing paragraph already rules
> it: *"if an item cannot reach 10 because the corpus is broken … file it as `corpus_extended`, do
> not absorb it into the piece's score."* The two clauses have been in tension since wave 0 and
> every wave-1 critic resolved it the harsher way, against the builder.
>
> **The axis keeps every threshold it had** and returns to the aggregation the day the tool exists.
> **`corpus_debt` is not a pass**: it is reported on every line, it escalates by method 6's ledger,
> and an item carrying it may not be scored above the band its *runnable* fraction earns.

**E.3 — What this rule was hiding, measured.** Under min-over-axes an unmeasurable axis is not a
lost fraction; it is the whole item.

| Item | Axis blocked | Tool | Consequence under min-over-axes |
|---|---|---|---|
| `RI-CHR01` | Distinctness | `build-viability.mjs` | **native 0 for every build that will ever exist** |
| `RI-CHR03` | Decidability | `build-viability.mjs` | **native 0 for every build that will ever exist** |
| `RI-JRN01` | all of it, as written | `journey-run.mjs` (`A-JRN1`) | **0 for every build**, and it scored 0 twice |

`W1-07`'s gate is **7.0** over six items — a required total of **42**. With three of the six pinned
at 0 by the corpus, the maximum attainable total is **30**, i.e. a mean of **5.0**. Under the
generous translation two wave-1 critics actually used (native 0 → ladder 4, because the anchor rows
were silent below 4) the ceiling is **38/6 = 6.33**. **`W1-07` could not pass its gate under any
build, in any round, by arithmetic**, and three rounds have been dispatched at it. That is the same
finding `BAR-CRITIQUE-W1-09-R1` §R6.4 made about `W1-09`, arrived at independently, in a second
area, one wave later.

## Comparison method

1. **Phantom-command sweep.** Extract every fenced command and every `tools/**` path from every
   `## Comparison method` section in the corpus. **Assert each resolves to a file on disk.**
   Print the misses with the items that name them. *Run for the first time at wave 1: **74 of 137
   phantom**. See §E for the result, the distribution and the two rules it forces. This step is
   now a gate check in `tools/corpus-index.mjs --check` and may not go another wave unrun.*
2. **Exit-code contract.** For each resolved tool, run it with `--help`. **Assert exit 0 and a
   usage block.** A tool that cannot describe itself will not be run by a critic under time
   pressure.
3. **Viability checker liveness.** Run `build-viability.mjs --signatures all`. **Assert the output
   contains at least one `viable: false` record with a populated `stopped_at`**, or that a
   `--explain` run on a deliberately over-gated fixture produces one. An all-true result on real
   data is only credible after the fixture proves the checker can say no.
4. **Criterion-4 liveness.** Run the checker twice: once as shipped, once with every tier-5
   encounter's damage multiplied by 10 in a fixture overlay. **Assert the viable count falls.**
   If it does not, criterion 4 is a stub and the tool fails this item.
5. **Journey instrument liveness.** Run `journey-run.mjs --journey jrn01-opening`. **Assert the
   trace contains `first_input` and `first_control` events, that the UI-text stream is non-empty
   for at least one frame, and that a real input dispatched on the first rendered frame of each
   surface is recorded with a frame delta.**
6. **Blocked-dimension ledger.** For every verdict in `corpus/90-verdicts/**`, collect every
   `checks[].result == "unmeasurable"` whose stated cause is a missing tool. **Assert no cause
   appears in two consecutive waves.**

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Phantom commands | 0 across the corpus | ≤ 2, each with a named owner and wave | ≥ 5, or any in an item that gates a wave |
| Viability checker | exists, criterion 4 live (method 4 passes), failure list published | exists, criteria 1–3 live, criterion 4 declared incomplete in-file | absent, or all-true with a stubbed criterion 4 |
| Journey instrument | `A-JRN1`+`A-JRN2`+`A-JRN4` all live, M1–M15 runnable | `A-JRN1` live, M1–M12 runnable | absent — `RI-JRN01` scores 0 for a second wave |
| Blind pack form | both sides emitted by one extractor into one form | reference side committed once under `corpus/88-journeys/data/` | packs assembled by hand per critic |
| Blocked-dimension ledger | empty | no cause repeated across two waves | a cause in three waves |

**Failure threshold: any axis below 6.** The viability-checker axis is binary on criterion 4:
a stub scores 0 regardless of the rest.

**Native → ladder anchors:** native 4 → ladder 4; native 6 → ladder 6; native 8 → ladder 8.

**Aggregation:** min-over-axes.

## How we lose

- **The checker ships with `criterion_4: true` hard-coded**, because the lethality model is the
  expensive part and the other three are graph walks. Every signature is then "viable", the axis
  scores 10, and the trap the criterion exists to catch — Mage- and Root-family starts that cannot
  survive the first authored fight — ships undetected. Method 4 is the only defence.
- **`journey-run.mjs` is written as a screenshot loop** rather than as a real-input driver,
  because screenshots are easy and `page.keyboard` on a canvas app is fiddly. M2 and M4 then
  measure nothing and the item stays at 0 while appearing instrumented.
- **The phantom-command sweep is run once and never wired into CI**, so the next reference item
  written names the next phantom tool and the debt regrows. It belongs in `npm run gate:strict`.
- **This item becomes the place tools go to be listed rather than built.** The blocked-dimension
  ledger (method 6) is the counterweight: it is the only check here that gets *worse* with time
  if nothing happens.
- **The `MW/OPEN` reference extraction is written by whoever needs it that week**, so every
  critic's blind pack has a slightly different reference side and no two `RI-JRN01` verdicts are
  comparable. Committing it once under `corpus/88-journeys/data/` costs an hour and fixes it
  permanently.

## Provenance note

**Everything in this item is `constructed`** and binding on that basis: the two tool contracts,
the output shapes, the five scoring axes, the standing rule in §D and all six method steps.

The *facts* that motivated it are measured, not constructed, and are cited rather than recalled:
`tools/analysis/build-viability.mjs`, `tools/journey/journey-run.mjs`,
`tools/journey/beat-extract.mjs` and `tools/journey/gamepad-shim.mjs` were each found absent at
commit `65275dc` by `tools/analysis/critic-w1-07-audit.mjs`, recorded in
`corpus/90-verdicts/wave1/artifacts/W1-07/audit/critic-audit.txt`, and the resulting zeroes are
recorded in `corpus/90-verdicts/wave1/W1-07.json` under `RI-CHR01` M6, `RI-CHR03` M5 and
`RI-JRN01` M1–M15.

The requirements restated in §A and §B are quotations from `RI-CHR01`, `RI-CHR03` and
`RI-JRN01` and carry those items' own provenance; **no threshold from any of them is changed
here.** Confidence **high**, because every claim in this item is either a quotation from another
item or an observation that a named file does or does not exist.
