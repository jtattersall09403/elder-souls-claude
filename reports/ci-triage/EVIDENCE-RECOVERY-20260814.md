# Verdict evidence recovery — closing the citation hole, 2026-08-14

Task `verdict-evidence-20260814`. Implements the orchestrator's ruling on
`reports/ci-triage/TRIAGE-20260814.md` Rulings B, C and D. Branch `codex/wave1-build-experiment`.

> **A verdict's citation must resolve in a fresh clone, or it is not a citation.** But 119 MB of
> raw dumps is not the answer either: commit the evidence a reader actually needs to check the
> claim, and for anything large, commit a small artefact that pins it.

## The number that matters

Measured the way the triage measured it — a genuine fresh checkout, not this populated working
tree. `git archive <tree> | tar -x` into an empty directory, then `node tools/verdict-validate.mjs
--all` inside it.

| | fresh-checkout FAIL | OK | SKIP |
|---|---|---|---|
| **before** (HEAD at task start) | **54** | 22 | — |
| **after** | **9** | 32 | 35 |

Decomposed, so the credit goes where it is owed — each row is the same fresh-checkout measurement
with one more change applied:

| change | FAIL |
|---|---|
| before | 54 |
| + 203 cited evidence files committed, 3 pinned | 21 |
| + rotted reference-item paths corrected, `#section` anchors resolved, pins accepted | 20 |
| + only the latest round of a piece gates CI (shipped default) | **9** |

The 9 that remain are the 8 real corpus defects the triage named, plus `W1-22-B2-blind.json`.
None of them is a missing file. Every one is a verdict whose *content* does not conform, and §4
explains why I did not repair them.

## 1. The threshold, from the distribution rather than from a preference

211 of 215 missing citations still existed on this container, untracked. Re-derived across both
`artifacts[]` and `reference_items[]`: **234 distinct cited paths absent from `git ls-files`, 208
of them on disk, 119.3 MiB.** Their size distribution:

```
min 243 B · p10 1.7 K · p25 4.2 K · p50 11.2 K · p75 33.7 K
p90 111.8 K · p95 284.9 K · p99 3.15 M · max 79.0 M
```

Sorted by size, the two largest multiplicative gaps anywhere in the sequence are adjacent and sit
at the top:

```
  0.99 MiB -> 3.15 MiB    x3.3
  3.15 MiB -> 26.8 MiB    x8.5     <- the largest discontinuity in the whole distribution
 26.8  MiB -> 79.0 MiB    x3.0
```

**Threshold: 1 MiB.** It lands inside that measured gap. Any cut between 0.99 MiB and 3.15 MiB
partitions the same way, so the number is not load-bearing — the gap is.

| | files | bytes | share of bytes |
|---|---|---|---|
| **≤ 1 MiB — committed raw** | **205** | **10.4 MiB** | 8.6% |
| **> 1 MiB — pinned** | **3** | **108.9 MiB** | 91.4% |

The headline finding of this section is that **"119 MB" was never 184 files of bulk. It is three
files.** Two raw combat frame traces and one 36,000-frame session trace account for 91.4% of the
weight; everything else is a critic's probe JSON averaging 11 KiB that a human can open and read.
By extension: 185 `.json` (4.9 MiB), 6 `.png` (5.0 MiB), 4 `.jsonl` (109.2 MiB), 13 small logs and
text files (40 KiB). Committing the 205 costs about 1% of the tracked tree.

`git ls-files` says **203** were force-added rather than 205: two of the citations are
*directories* (`corpus/90-verdicts/wave1/artifacts/W1-09-r2/rerun-r1-probes/`,
`reports/packs/w1-22-r3-hard`), which git cannot track as such and which resolve once their
contents are in.

### Piece-aware, not `git add -f *`

The triage was right that this needed a reviewer rather than a bulk add, so the classification is
per citation and the tool that does it (`tools/verdict-evidence.mjs`) reports its own working.
Of the 213 citation instances recovered, **166 are load-bearing** — named inside a
`reference_items[].evidence[]`, a `checks[].evidence[]`, an `arbitration.*.evidence[]`, a
`blind.pack_artifacts[]` or a `biggest_gap.evidence[]` chain — and 47 are declared in `artifacts[]`
without being quoted anywhere else.

I committed both classes, and the reason is worth stating because it is the opposite of what a
storage argument would conclude. The 47 average about 9 KiB. Dropping them would not save anything
a reader would notice, and it would require *editing 40 other agents' verdicts* to remove the
declarations — a content edit on somebody else's judgement, made to save 400 KiB. The schema
already treats `artifacts[]` as the verdict's evidence record rather than a bibliography of
convenience, so a critic that declared a file declared it deliberately.

What that review *did* turn up, and what a blind add would have hidden:

- The largest single group by name, `reports/critic-souls-r3-DELETED-*.json` and its `INTACT` and
  `SELFBREAK` siblings, are delete-the-fix control arms — under this project's method these are the
  most load-bearing files in the set, not scratch.
- Six PNGs under `reports/runs/CRITIC-W1-21-R2/` (`map-honest.png` vs `map-forged.png`,
  `consume-arm-{full,half,none}.png`) are a forgery-detection control. They are 0.8–1.0 MiB each,
  i.e. just under the threshold, and a reader must *look* at them — a hash would have been useless.
  A round 1 MiB threshold chosen before measuring would plausibly have pinned them.
- Seven `reports/runs/_raw/*.log` files are `tools/run.mjs` execution records, 243 B to 14 KiB.
  Committed on the same precedent the triage set for `corpus/90-verdicts/**/*.log`.

Nothing in the set looked like abandoned scratch. That is a report of what I found, not a defence
of adding everything: had a group been junk, the tool's audit lists it by name and by group.

## 2. The pin, and what running its regeneration command actually showed

A pin is `<path>.pin.json`: the decisive numbers computed *from* the file, `bytes`, a SHA-256, the
regeneration command, and the verdicts that cite it. `tools/verdict-validate.mjs` accepts a
well-formed pin in place of the raw file; `tools/verdict-evidence.mjs --verify` re-checks shape and,
on any machine still holding the raw file, hash drift.

**This is a tightening, not a concession.** A committed 79 MiB trace can be silently regenerated
and nothing anywhere goes red. A pinned one cannot. Five malformed pins (missing `decisive`,
`sha256`, `produced_by`, `cited_by`; unparseable) are rejected in `--self-test`, so a stub next to a
missing file buys nothing.

The decisive numbers are computed independently and they corroborate the verdicts that cite them:
W1-25-r1 claims "36,000 frames … zero events" against "8,945 frames, 530 events, 28 kinds", and the
pins recompute exactly 36,000/0 and 8,945/530/28 from the bytes.

### The regeneration command, run

> *"A regeneration command that has not been run is not a regeneration command; run a sample and
> say so."*

Ran, for `reports/sessions/exp-w1-opening/trace.jsonl`. Its verdict recorded `produced_by` as the
prose `node tools/experience/session-run.mjs (another piece)`, which is not runnable; the artifact's
own manifest (`session.json`) records the parameters, so the real invocation is recoverable without
inventing anything. A one-minute sample instead of ten, because what a sample can answer is whether
the command exists, runs and emits the same shape:

```
node tools/experience/session-run.mjs --session verdict-evidence-20260814-regen-sample \
  --brief corpus/95-experience/briefs/first-hour.md --seed 1337 --minutes 1 \
  --render-policy on-demand --profile first-hour --drive none      # exit 0
```

**It runs. It does not reproduce the decisive number.** Same driver, same seed 1337, same
`first-hour` profile, same brief, same `--drive none`:

| | frames | events | event kinds |
|---|---|---|---|
| pinned artifact (10 sim-min) | 36,000 | **0** | 0 |
| regenerated at HEAD (1 sim-min) | 3,600 | **113** | 5 (spawn, npc_schedule, npc_presence, weather_change, settlement_enter) |

0 against 113 is not an artifact of the shorter run. The trace record has also grown 16 fields
since the pinned file was written — the animation channels (`rig`, `clip`, `bones`, `pose_hash`, …).

**W1-25-r1 cites this file for exactly that number, as the counter-example to W1-09's event-bearing
trace. That finding does not reproduce at HEAD.** Whether the gap has since been closed by other
work or the original run was taken under conditions the manifest does not capture is a question for
a fresh W1-25 round, and it is named in `orchestration/NEXT-DISPATCH.md`.

**The pin was not re-pinned to today's numbers.** A pin records what the verdict actually read;
overwriting it would erase the only evidence that the claim has moved. The divergence is recorded
inside the pin under `regeneration_verified`.

This is the entire argument for the ruling's insistence on running the command. Nine days of green
paperwork would not have found it.

The other two pins record `run: false` **honestly**, and that is itself a defect worth naming: the
W1-09 exemplar traces record `produced_by` as *"the W1-09 builder"* and *"game/src/combat/trace.js
from a live headless run"* — an author and a source file, neither of which is a command. The schema
requires "the exact command". I did not invent a plausible-looking invocation to fill the field.

## 3. The citations that recovery cannot repair

The triage counted 4 genuinely-gone citations against `artifacts[]`. Sweeping `reference_items[]`
as well raises it to 26 unresolvable paths, which split three ways:

### 3a. 20 are path rot, and are repaired — not fabricated

Twenty cite a reference item that was **moved or re-slugged**, e.g.
`corpus/20-camera/RI-CAM05-camera-outside-the-fight.md` → `corpus/15-camera/…`,
`corpus/30-progression/RI-PRG04-hearth.md` → `corpus/20-progression/RI-PRG04-hearth-and-death.md`.
The `RI-xxxNN` id is the item's identity and is unique across `corpus/<topic>/RI-*.md`, so each
resolves to exactly one tracked file and the document being pointed at is the same document. 21
corrections across 5 verdicts (`W1-04-r4`, `W1-09-r3`, `W1-13-r2`, `W1-19-r2`, `W1-FACTIONS-r2`).

Rewrites were derived **only** from values of `path` keys that fail to resolve. An earlier draft
matched any path-shaped string in the file and would have rewritten prose; that draft was discarded.
Anything not resolving to exactly one tracked item is left alone and listed.

### 3b. 2 are citation *format*, and are handled in the validator

- `corpus/00-doctrine/ARBITRATION.md#3` (W1-19-r2) is a citation of §3 **of** a tracked file.
  Stripping the anchor to satisfy the checker would have thrown the section pointer away, so
  `resolveCitedPath` now resolves a `#fragment` against its base path. The document must still exist.
- `"NOT READ - quarantined"` (`W1-22-B2-blind`, for `RI-AUD03`) is not a lost file. It is a blind
  judge recording, deliberately, that it did **not** read the item its pack serves — *"deliberately
  unread by this judge, which is the point of the exercise."* This is honest practice colliding with
  a schema that has no way to express it. **The schema is what is wrong here, not the judge.** Do
  not "fix" this by inserting a path the judge never opened. It is named in §4.

### 3c. 4 are genuinely gone — `W1-01.json`

| citation | piece |
|---|---|
| `reports/region-shots/ANSWERS.json` | W1-01 (province streaming / region identity), round 1 |
| `reports/region-shots/REGIONS.txt` | " |
| `reports/region-shots/frame-01.png` | " |
| `reports/region-shots/frame-39.png` | " |

All four belong to one verdict, the oldest in the corpus. They are nowhere on this container and
nothing regenerates them: `ANSWERS.json` and `REGIONS.txt` are a **sealed blind answer key**, which
is by construction not reproducible — regenerating it would produce a *different* key and prove
nothing about the trial that was run against the original.

**Ruling: the verdict is not repaired, and it is not re-taken either.** `W1-01.json` is round 1 and
`W1-01-r2.json` is the standing verdict for the piece and passes; the piece has already been
re-judged with evidence that does exist. Re-taking a superseded round would spend a critic to
produce a document nothing consumes. It stays in the corpus as history, no longer gates CI under §5,
and its four dead citations are recorded here so nobody re-derives this. **Do not backfill it.** A
replacement answer key would be a fabricated blind trial, which is worse than the red it removes.

*Overturned by:* the files turning up in another container or in `git log` on a branch not examined
here — in which case `--recover` picks them up with no further judgement needed.

## 4. The 8 real corpus defects — fixed where honest, red where not

These are the current standing verdicts for their pieces, non-conformant to a schema that tightened
after they were written. What I could fix without inventing a result, I fixed: rotted paths (§3a),
section anchors (§3b), and the missing-file errors that recovery removed. What is left is **fields
whose values are measurements I did not take**, and filling them is precisely the failure this
project exists to prevent.

| verdict | remaining errors | dominant defect | owner |
|---|---|---|---|
| `W1-14-r4` | 30 | no `artifacts[]`, `score`, `status` or `self_audit`; 15 evidence citations undeclared; `subsystem_paths: magic.spellmaking` not canonical | W1-14 critic (magic) |
| `W1-19-r2` | 99 | 7 artifacts with no `path`; 6 items with no `native_scale` and no `evidence[]`; `gap_closure` rows with no `gap_id`; no `self_audit` | W1-19 critic (lore/opacity) |
| `W1-FACTIONS-r2` | 47 | 3 items with no `native_scale`/`evidence[]`; 2 artifacts with no `kind`; non-canonical `quests.faction`, `crime.faction_sanction` | W1-FACTIONS critic |
| `W1-LIBRARY-r1` | 62 | as above, across most items | W1-LIBRARY critic |
| `W1-LIBRARY-MARTIAL-r4` | 4 | 2 `gap_closure` rows with no `evidence[]`; `status: "partial"` (enum wants `partially-closed`); one undeclared citation | W1-LIBRARY-MARTIAL critic |
| `W1-TOUCH-r1` | 21 | **a different document shape entirely** — see below | W1-TOUCH critic |
| `W1-PROSE-BLIND-r1` | 20 | **a blind-pack judgement, not a critic verdict** — see below | prose blind judge |
| `W1-PROSE-TICS-r4` | 17 | **a blind-pack judgement, not a critic verdict** — see below | prose tics judge |
| `W1-22-B2-blind` | 32 | **a blind-pack judgement, not a critic verdict** — see below | W1-22 B2 judge |

`W1-LIBRARY-MARTIAL-r4` is the closest to salvageable: `"status": "partial"` is plainly the
critic's own word for `partially-closed`. I left it, because the same two rows also lack `evidence[]`
— closure is a re-measurement, and I cannot supply the measurement — so normalising the spelling
would have moved 4 errors to 3 and left the verdict red anyway, at the cost of an edit to somebody
else's judgement that changes nothing. Not worth the precedent.

### The finding underneath four of the nine

**`W1-PROSE-BLIND-r1`, `W1-PROSE-TICS-r4` and `W1-22-B2-blind` are not critic verdicts.** They are
blind-pack judgements: their top-level fields are `pack`, `answers_sealed_before_reveal`, `results`,
`trios_i_got_wrong_and_would_change`, `leak_audit`, `quarantine`. They have no `artifacts[]`,
no `reference_items[]`, no `arbitration` and no `bifurcation` — and structurally they *cannot*,
because a blind judge scores a masked pack without seeing the piece, which is the entire discipline.
They carry `schema_version: 1` and sit in `corpus/90-verdicts/wave1/`, so the verdict validator
sweeps them and demands a verdict's shape from a document that is not one.

**`W1-TOUCH-r1` is a third shape again**: it declares `"schema": "elder-souls/verdict@1"` — claiming
to *be* the verdict schema — while using `piece`/`role`/`verdict`/`items` where the real schema uses
`piece_id`/`critic`/`status`/`reference_items`. There are two incompatible documents in this repo
answering to the same schema name.

Backfilling any of these with `arbitration.ar1`/`ar2`, `native_scale` and `bifurcation` would be
inventing a critic's method record. The remediation is a **document-type declaration** — a
judgement validated against judgement rules and a verdict against verdict rules — which is a schema
design decision affecting every future pack, not a repair I should make unilaterally inside four of
somebody else's files. Named as a dispatch in `orchestration/NEXT-DISPATCH.md`.

**These 9 keep the corpus gate red, and that is correct.** The gate is now red for nine named,
owned, content-level defects instead of fifty-four mostly-plumbing ones, and every remaining error
is legible to a reader with a clone.

## 5. Only the latest round of a piece gates CI

Ruling D, designed by the triage and explicitly not built by it: *"a naive round-number heuristic
could misclassify"* `W1-01-province-stream-r1.json`, which is a **different sub-piece** of W1-01 and
not a round of it. Built here, with the tests the triage asked for.

Piece identity is *the filename with a trailing `-r<N>` removed* — an exact string, **never a prefix
match** — scoped per wave directory, with rounds compared numerically so `r10` beats `r9`, and a
verdict with no suffix treated as round 1. 35 superseded rounds are now skipped, 11 of them
non-conformant; each prints a visible `SKIP … — superseded by …` line with its error count, and
`--all-rounds` validates everything.

**One deliberate divergence from the triage's sketch.** It proposed skipping a round only when a
later round exists *and validates clean*. I made gate-relevance depend on the round number alone,
pass or fail. Making the *scope* of a gate depend on the gate's own *output* is circular and
unstable — repairing round 3 would silently un-gate round 2, and the set of gating files would
change every time somebody edited a neighbour. The simplest deterministic rule is that the highest
round gates; if the latest round is broken, CI is red for that piece, which is what should happen.

Tested in `node tools/verdict-validate.mjs --self-test`, wired as its own CI step ahead of the sweep
because the failure mode is silent — a mis-parsed filename un-gates a live verdict and nothing goes
red. 12 naming edge cases and 9 relevance cases, all drawn from real filenames except two marked
hypothetical:

| case | identity | why it is in the tests |
|---|---|---|
| `W1-01.json` | `W1-01` r1 | no suffix is round 1 |
| `W1-01-province-stream-r1.json` | `W1-01-province-stream` r1 | **a sub-piece, not a round of W1-01** — the exact trap the triage named |
| `W1-08-W1-29-r2.json` | `W1-08-W1-29` r2 | two piece ids in one filename |
| `W1-17-act5-r1.json` | `W1-17-act5` r1 | a lowercase sub-piece segment |
| `W1-22-B2-blind.json` | `W1-22-B2-blind` r1 | no round, and **not** a round of W1-22 |
| `W1-LIBRARY-r1` vs `W1-LIBRARY-MARTIAL-r4` | distinct | a prefix match would make r4 supersede r1 across two different pieces |
| `W1-30-r2-addendum.json` (hyp.) | whole name, r1 | `-rN` not at the end is not a round |
| `W1-04-r10.json` (hyp.) | `W1-04` r10 | numeric, so r10 > r9 |
| same basename in `wave1/` and `w2/` | both gate | identity is scoped per wave directory |

## 6. The policy, put where a builder or a critic will actually meet it

A rule that lives only in a report gets broken next week, so it is in four places a person is
already reading, and one that fails:

1. **`corpus/00-doctrine/verdict.schema.json`** — `artifacts[]` and `artifacts[].path`
   descriptions now say the path must resolve in a fresh clone, name `git add -f`, name the 1 MiB
   pin threshold, and name the command.
2. **`corpus/00-doctrine/CRITIC-PROMPT-TEMPLATE.md`** — STEP 3, immediately after "write every
   artifact to…", with the three commands to run *before* filing the verdict.
3. **`orchestration/plans/BUILDER-EXECUTION-CONTRACT.md`** — a new clause 8b, positioned so it
   cannot be read as contradicting clause 8 ("do not commit those binaries"): 8 is about binaries a
   builder made for its own inspection, 8b is about files something else *cites*.
4. **`reports/.gitignore`** — the reasoning, plus `!**/*.pin.json` so a future pin is tracked by
   rule rather than by somebody remembering to force-add it. The blanket `*` stays: scratch is still
   excluded by default and evidence is force-added per file, by name.
5. **`.github/workflows/corpus-gate.yml`** — two new steps ahead of the sweep,
   `verdict-validate.mjs --self-test` and `verdict-evidence.mjs --self-test && --verify`.

**Nothing was added to the commit path** (rule 13). No hook, no `pre-commit`, no fail-closed check
that can fire on a neighbour's in-flight work. The gate stays at push/CI where it already was.

## 7. Reversal

Every change here is one step back:

| change | reverse |
|---|---|
| 203 committed evidence files + 3 pins | `git rm --cached` the paths `node tools/verdict-evidence.mjs --audit` lists; `.gitignore` re-excludes them unchanged |
| `!**/*.pin.json` in `reports/.gitignore` | delete the line |
| pin substitution in the validator | delete `resolveCitedPath`, restore `existsSync(join(ROOT, a.path))` |
| round skip | `--all-rounds`, or delete `roundRelevance` |
| 21 path corrections | `git revert` the commit; the old paths are rotted, not destroyed |
| the two CI steps | delete them |

**Executed, not asserted:** the before/after figures in the headline table were each taken by
extracting a tree into an empty directory and running the validator there, and the decomposition
row "old validator, new tree = 21" was produced by copying the *original* `verdict-validate.mjs`
out of the before-archive into the after-tree and re-running it — i.e. the rule changes were
deleted on a copy and the intermediate number came back.

## 8. What I could not do

- **Did not repair the 9 remaining verdicts.** Every remaining error is a field whose value is a
  measurement I did not take. Named and owned in §4.
- **Did not build the document-type split** that four of those nine actually need (§4). It is a
  schema decision for every future blind pack, not a repair to make inside four files.
- **Did not re-take `W1-01.json`** (§3c) and ruled that it should not be re-taken; its sealed blind
  answer key is unreproducible by construction and its piece already has a passing later round.
- **Did not run the regeneration command for the two W1-09 exemplar traces** — neither records a
  command to run. Recorded as `run: false` with the reason, rather than filled with a guess.
- **Did not chase the W1-25-r1 divergence to a conclusion** (§2). Finding it was in scope; deciding
  whether the zero-event trace was a since-fixed defect or a differently-conditioned run is a fresh
  W1-25 round's job.
- The browser box was over its contention ceiling on the first attempt at the regeneration sample;
  the run was deferred and taken later at 3 of 6 instances and 3.06 of 4.0 load per core.
- Another agent's `bank` committed the recovered files mid-task, so they landed in
  `3e44d3a`/`bb50bef` rather than under this task's own headline. The content is unaffected.

## Evidence index

- `tools/verdict-evidence.mjs` — audit / recover / pin / verify / self-test. Threshold and its
  derivation are in the file header.
- `tools/verdict-validate.mjs` — `resolveCitedPath`, `pieceIdentity`, `roundRelevance`, `--self-test`.
- Fresh-checkout method: `git write-tree` → `git archive <tree> | tar -x -C <empty dir>` →
  `node tools/verdict-validate.mjs --all` inside it. Never measured against this working tree.
- The three pins: `reports/sessions/exp-w1-opening/trace.jsonl.pin.json`,
  `reports/w1-09/exemplar/RI-CMB07-exemplar-F3-trace.jsonl.pin.json`,
  `reports/w1-09/exemplar/RI-CMB07-exemplar-frames.jsonl.pin.json`.
- Regeneration sample: `reports/sessions/verdict-evidence-20260814-regen-sample/session.json`
  (the 18 MiB trace it produced was deleted; the manifest and the pin record what it showed).
- Status file: `orchestration/status/VERDICT-EVIDENCE-20260814.md`.
