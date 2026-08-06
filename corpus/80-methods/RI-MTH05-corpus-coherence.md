---
id: RI-MTH05
title: Corpus coherence as a judged property — the corpus must pass its own audit
kind: structure
side: neutral
judges: [process.critic.discipline, process.verdict.format, coherence.naming.consistency, coherence.lore.consistency, coherence.systems.composition]
provenance: measured
confidence: high
blind_pair: no
---

## The bar

The corpus is the instrument every critic measures the game with. An instrument that
contradicts itself does not produce a wrong verdict — it produces a verdict that *cannot be
wrong*, because whichever way the build goes, some reference item was already on the other
side. BAR-CRITIQUE-01 named this **G7**: *"nobody audits the corpus — it has the exact
incoherence it exists to prevent in the game."*

The evidence that it was real, measured at the end of wave 0 before this item existed:

| Defect | Count |
|---|---:|
| Orphan `judges:` paths (an item claiming a subsystem that does not exist) | **147**, across 134 distinct spellings |
| Reference items **judging nothing** — every path in their `judges:` unresolvable | **1** (`RI-LOR06`); 3 more with a majority dead |
| Front-matter values outside the contract's enums | 1 |
| Shared constants with **two authoritative definitions** | 3 (walk speed 70% apart; the enemy census 2.1× apart; the dialogue corpus 1.35× apart) |
| Bars the reference itself loses | ≥ 2 found (`RI-DLG02` locality ratio; the Jel validator rejecting *Saxhleel*) |

Every one of those was invisible to the toolchain, because `corpus-index.mjs --check` gated
only on whether `INDEX.md` was stale. **The bar is that the corpus passes its own audit,
automatically, on every commit, and that failing it blocks the wave.**

Coherence is *not* quality. This item never asks whether a reference item is good. It asks
whether the corpus can be handed to a critic without the critic being set an impossible task.

## The reference artifact

### A. The five coherence properties

| # | Property | Stated |
|---|---|---|
| **C1** | **Front-matter validity** | Every `corpus/**/RI-*.md` opens with a parseable front-matter block carrying all eight required keys, each within the enum CORPUS-CONTRACT §2 defines |
| **C2** | **No orphan `judges:` path** | Every path in every `judges:` list resolves — canonically, or through a registered alias — to a path in `subsystems.json` |
| **C3** | **No item judges nothing** | No item's `judges:` list resolves to the empty set. An item that judges nothing is **invisible to the critic hand-off**: it never appears in `INDEX.md` §2, so the orchestrator never pastes it into a critic prompt, and it looks perfectly healthy in the item inventory while doing so |
| **C4** | **Shared-constant single ownership** | Every number used by more than one item is registered in `constants.json` with exactly one owning item. Owners and named consumers must be reference items that exist. A second, differing definition of an owned constant is a defect; a *recorded* divergence is not |
| **C5** | **No two items contradicting** | Where two items make incompatible claims about the same quantity, one is authoritative and the other cites it. Deliberate divergences are recorded as such and are not defects |

C1–C4 are **executable**. C5 is **partly** executable — C4 catches the numeric half, which is
where the damage was — and the rest is a reading obligation discharged by the audit report.
This item does not pretend otherwise; see the provenance note.

### B. What each property is protecting against

- **C1** — a reference item that does not parse is silently dropped from the index. It exists
  on disk, it looks finished in the file listing, and no critic ever sees it.
- **C2** — an unresolvable path means *a critic would be judging something no builder was ever
  told to address*, and, symmetrically, that the item's bar reaches no builder at all.
- **C3** — **worse than a hole.** A hole stops a builder (CORPUS-CONTRACT §4). An item that
  judges nothing stops no one and warns no one. `RI-CMB08` — 3,155 words specifying the
  healing flask — had all four of its paths dead; `combat.heal.charges` was therefore shown in
  `INDEX.md` as judged by `RI-PRG04` alone, and the item that actually specifies the flask
  would not have been handed to the critic who judges healing.
- **C4** — the failure mode that corrupts *numbers rather than process*. `RI-AI07` defined a
  traversal minute at 3.4 m/s while seam S17 and `RI-WLD01` fixed walk speed at 2.0 m/s. Every
  density, beat, runback and sightline figure downstream was stated in units the world is not
  built in, and both items were internally consistent, so no amount of careful reading of
  either one would have found it.
- **C5** — the case a critic handed both items must fail one of, through no fault of the build.

### C. The false-mapping rule (C2's second clause)

A path is **not** judged merely because some item lists it. It is judged when an item states a
**bar** for it. A protocol or process document that names a domain path is a **false mapping**:
it tells the builder to proceed and tells the critic it has a bar, and there is none.

`RI-MTH03`, a blind-comparison *protocol*, claimed `combat.feel` (aliasing to
`combat.feedback.hitstop`), `visual.fidelity`, `visual.artdirection`, `dialogue.prose` and
`quests.structure`. None of those is a bar a protocol document can set. **A false mapping is
worse than a hole and is treated as one:** on removal the path reverts to a hole, which is the
honest state, and a builder is correctly stopped.

### D. Severity

| Level | Properties | Consequence |
|---|---|---|
| **Blocking** | C1, C2, C3, C4 | `corpus-index.mjs --check` exits non-zero. The wave does not start |
| **Reported** | corpus holes | listed by `--check`, blocking only under `--strict`. A hole is a legitimate state — it means *do not build this yet*, not *the corpus is broken* |
| **Reported** | legacy alias use | listed in `INDEX.md` §4a with every user, so migration is visible and finite |
| **Audit** | C5 beyond C4 | discharged by `corpus/00-doctrine/CORPUS-COHERENCE-01.md` and its successors |

## Comparison method

**M1 — run the gate.**

```
node tools/corpus-index.mjs --check
```

Exit 0 = pass. Exit 1 = the corpus is incoherent; the output names every defect with its file
and the property it violates. `--strict` additionally fails on corpus holes; use it when a wave
is meant to start with none.

**M2 — C1, front-matter validity.** The tool parses every `corpus/**/RI-*.md`, requires the
eight keys of CORPUS-CONTRACT §2, and checks `kind`, `side`, `provenance`, `confidence` and
`blind_pair` against their enums. Missing mandatory `##` sections are reported at `warn`,
because a section can be legitimately in progress; an invalid enum value cannot.

**M3 — C2, orphan paths.** Every `judges:` entry is resolved against `subsystems.json`
directly, then through `aliases`. Unresolved ⇒ error, naming the item and the path.
Alias-resolved ⇒ recorded in `INDEX.md` §4a, not an error.

**M4 — C3, judges-nothing.** After resolution, any item whose resolved `judges:` list is empty
is an error in its own right. This is a distinct check from M3 and must stay distinct: an item
with four dead paths produces four M3 errors *and* one M4 error, and it is the M4 error that
says the item is invisible.

**M5 — C4, the constant registry.** `corpus/00-doctrine/constants.json` must exist and parse.
For each entry: `id` present and unique; `owner` present and resolving to a real reference item
id; every `consumers` entry whose text begins with an `RI-XXNN` id resolves to a real item.
Same for `deliberate_divergences[].item`.

**M6 — the numeric half of C5 (manual, per wave).** For each constant in the registry, grep the
corpus for its value and its unit. Any item stating a different value for the same quantity is
either (a) a defect ⇒ amend the item to cite the owner, or (b) a deliberate divergence ⇒ add it
to `deliberate_divergences` with a reason. **There is no third outcome**, and "recorded both and
moved on" is the failure this item exists to prevent.

**M7 — the wrong-bar sweep (manual, per wave).** For every threshold stated against a
reference measurement, recompute the *reference's own* score against the threshold. **If the
reference loses our bar, the bar is broken** (CORPUS-CONTRACT §6), not demanding. Two were
found this way in wave 0: `RI-DLG02`'s locality-ratio floor of 0.35, which Morrowind's own
Balmora fails at 0.30; and `jel-phonotactics.py`, which rejected *Saxhleel*.

**M8 — CI.** `--check` is wired as a blocking gate. It must run on any change to
`corpus/**/RI-*.md`, `subsystems.json`, `constants.json` or `tools/corpus-index.mjs`.

## Scoring

Coherence is not a quality dimension and does not enter the ladder as one. It is a
**precondition**: an incoherent corpus makes every other score untrustworthy, so it gates
rather than contributes.

| Native | Meaning | Ladder |
|---|---|---:|
| `--check` exits 0 | The corpus is coherent | **gate passed — no score contributed** |
| `--check` exits 1 | The corpus is incoherent | **the wave does not start** |

Native-band anchors, per SCORING.md §1.2, for a critic that must nonetheless report a number:

| Native | Ladder |
|---|---:|
| `--check` and `--strict` both exit 0 | 8 |
| `--check` exits 0, holes remain | 6 |
| `--check` exits 1 | 4 |
| `--check` cannot run (tool absent or unparseable taxonomy) | 0 — unmeasurable, fail-closed |

**Hard fails regardless of anything else:**

1. Any C1–C4 error at the start of a wave.
2. A path judged **only** by a protocol or process document (§C false mapping).
3. A shared constant with two definitions and no recorded divergence.
4. `--check` made non-blocking, or the gate removed from CI. The gate being advisory is the
   precise condition that let 147 orphan paths accumulate; restoring it is not a refactor.
5. A bar that the reference artifact itself fails, once demonstrated (M7).

## How we lose

1. **The gate is advisory.** It prints errors and exits 0. This is not hypothetical — it is
   what the tool did for the whole of wave 0, and 147 orphan paths is the measured cost.
2. **Coherence is confused with quality.** An agent "fixes" a contradiction by rewriting the
   weaker item. Coherence work rules which item is authoritative; it does not improve either.
3. **Both sides are recorded and neither is ruled.** The comfortable outcome, and the useless
   one: a critic handed both items still cannot proceed. §M6 admits exactly two outcomes.
4. **A deliberate divergence is silently "corrected".** An item's number differs from a
   reference *on purpose* and an auditor flattens it. Every divergence must be **recorded as
   one**, which is what `deliberate_divergences` is for. An unrecorded divergence is
   indistinguishable from an error, and that is the item author's responsibility, not the
   auditor's.
5. **Aliases become a second vocabulary.** Every unresolvable path gets an alias instead of a
   fix, the taxonomy quietly doubles, and two items judging "the same" path judge two things.
   Aliases are a migration aid with a visible, finite list; new items must use canonical paths.
6. **New constants are not registered.** The registry is only as good as its coverage, and
   an unregistered constant cannot collide-detect. Registration is the *author's* obligation at
   the point of writing the number, not the auditor's at the end of the wave.
7. **The audit runs once.** G7 is closed by a *standing* gate, not by one report. A single
   clean sweep with no CI behind it decays at the rate agents write items.
8. **Holes are treated as failures and filled with thin items.** A hole is an honest signal.
   Filling it with a stub to make a number go green converts a stop sign into a false bar,
   which is §C's failure in a new costume.

## Provenance note

`provenance: measured`, confidence **high**, for §The-bar's defect table and for C1–C4: those
counts are the output of `node tools/corpus-index.mjs --check` run against this corpus on the
dates recorded in `CORPUS-COHERENCE-01.md`, and they are reproducible by re-running it.

`constructed`, and stated as such, for the **severity model** in §D and the scoring anchors:
nothing published defines "corpus coherence" for a project like this, and the decision that
C1–C4 block while holes only report is ours.

**The honest limit of this item: C5 is not fully executable and this item does not claim it
is.** C4 catches contradictions between *numbers that someone registered*. It cannot catch a
contradiction between two prose claims, a bar that is wrong for a reason arithmetic cannot see,
or a constant nobody registered. M6 and M7 are manual sweeps, and a manual sweep is exactly the
thing that does not happen unless someone is tasked with it. **The residual risk is that the
executable half passes and the corpus is still incoherent** — which is what happened in wave 0,
where the index reported "up to date" while 147 paths were orphaned and three constants had two
owners each.

Two mitigations, both weaker than a check: the audit report is a standing deliverable with a
named owner per wave, and every wrong bar found by M7 is recorded there with the arithmetic, so
the *class* of error becomes cheaper to find next time.

Cross-dependencies: CORPUS-CONTRACT §2 owns the front-matter schema this validates and §6 owns
the "a bar the reference loses is broken" rule. `subsystems.json` owns the path vocabulary.
`constants.json` owns shared values — **paths and values are deliberately separate files with
separate ownership**, because a path is a permanent name and a value is a number that moves.
`CORPUS-COHERENCE-01.md` is the wave-0 discharge of M6 and M7.
