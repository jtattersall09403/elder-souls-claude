# The reverts the file-level sweep could not see — 2026-08-14

**What this is.** `RECOVERY-20260814` swept for the `HAZARDS` §2f signature — *a commit whose tree
does not contain files its own parents contain* — and recovered 74 whole files. That signature is
**per-path**, and it is structurally blind to a commit that reverts **part of a file that still
exists**: the path is in both trees, so nothing is missing. This pass is the content-level analogue,
plus the answer to `AQ-W1-20-B`.

**Headline.** The blind spot hid a bigger loss than the one it was opened for. The proven instance
(18 lines of `game/src/engine.js`) has been repaired by the W1-20 line while this pass ran. But the
same 08-10 octopus merge that dropped five whole files — five the recovery restored — also reverted
**W1-18's entire quest delivery**: 3,798 lines across 26 surviving files, 563 quest records by id,
still absent from `HEAD` four days later. And **the branch has been reporting it as a failure the
whole time and nobody read the print-out**: `node tools/analysis/quest-audit.mjs` returns a HARDFAIL
and a FAIL on exactly the three numbers W1-18's own status file — restored by the recovery — claims
to have fixed.

**The cheap detector won again, and it was not git.** No diff heuristic found the W1-18 loss first;
running the audit did. The instrument below exists to say *which* file to go and look at, not to
replace looking.

---

## 1. The population searched, and what was cleared

| tier | population | flagged | outstanding after reading |
|---|---:|---:|---:|
| **every merge reachable from `HEAD`**, each parent-side against `merge-base(p1, pN)` | **194 merges, every parent-side** | **60 commit-sides, 280 file-rows** | **3 incidents** |
| of those file-rows, ones whose dropped lines are **still absent from the whole `HEAD` tree** | 280 | **237** | — |
| of those, on **non-generated** paths | 237 | **75** | — |
| **targeted single-parent tier** — the whole-file-signature banks (`eed8e7fe`, `314e9f3f`, the six 08-07/08-08 collateral banks) and all 21 restore/revert-titled commits of 08-06, 08-08, 08-10, 08-11 and 08-14 | **29 commits** | **15** | **0** |

**The single-parent tier is clean, and that is a result rather than an absence of one.** All 15 hits
were read. Twelve are regenerated dashboards (`docs/index.html`, `docs/progress.html`,
`docs/status.json`, `docs/data/cost-ledger.json`, `orchestration/INDEX.md`) — churn by construction.
The four substantive-looking ones each resolve to supersession, checked at `HEAD` by name:

| hit | why it is not a loss |
|---|---|
| `corpus/25-magic/data/effects.json` (20 lines, `87f9759c`) | the spell-cost cross term was **revised**, not dropped: `0.75*M^0.85*D^0.55` → `0.55*M^0.80*D^0.45`, and `cross_term_rationale` is at `HEAD` carrying the new coefficients. `gen-effects.py` regenerates it. |
| `tools/world/signpost-audit.mjs` (10 lines, `58726586`) | the four inline place-name normalisations were **refactored into `addName()`** at `HEAD` §316–330, doing the same four transforms. |
| `tools/camera/cam-death-in-lock.mjs` (6 lines, `6ea5c0e5`) | `recentre_window_swing_deg` is live at `HEAD`; the control assertion was rewritten, not deleted. |
| `game/data/index.json` (4 lines, `0b2d6efe`) | `bytes` / `sha256` rows, regenerated every run. |

So: **the damage is concentrated in merges, not in ordinary banks.** That is the opposite of the
file-level finding, where the single largest loss (`eed8e7fe`, 39 files) was a one-parent bank. Both
things are true and they are worth holding together — a one-parent `add -A` loses whole *files*
readily and whole *hunks* almost never, because it has no second tree to prefer.

---

## 2. The three incidents, and what each one costs

### 2a. `c9603f64` reverted W1-18's quest delivery — the largest partial revert on the branch

The five-parent octopus of 2026-08-10 20:50, *"Integrate W1-08/W1-11/W1-14/W1-18 heads pending
semantic seam reconciliation"*. Its fifth parent is `9a0999fa` *"Complete W1-18 quest engine and
journal seams"*, filed `ready_for_independent_criticism`.

`RECOVERY-20260814` restored five whole files this merge dropped, one of them
`orchestration/status/W1-18-builder-codex-20260810.json`. **It restored the delivery record and not
the delivery.** The branch now carries a status file claiming numbers the tree does not have.

Measured three ways, because line-matching alone cannot tell a reformat from a revert:

```
detector      3,798 lines the W1-18 side added and the merge lacks, across 26 surviving files
semantic      563 records with an `id` present on the side and absent at HEAD, over 14 files:
              faction-continuation-wave1.json 157   magic-utility.json 86
              faction-wet-ledger.json 62   faction-xul-aneekh.json 61
              faction-imperial-assize.json 58   mainline-act4.json 28   (+8 more files)
              only 3 ids exist at HEAD that are not on the side — the loss is one-directional
live gate     node tools/analysis/quest-audit.mjs, at HEAD, today
```

| RI-QST04 / RI-QST09 row | W1-18's own ledger | at `HEAD` today | verdict printed |
|---|---:|---:|---|
| `mean_branches` | 1.94 | **1.03** | below target (hard fail < 1.0) |
| `multi_faction_consequence_pct` | 30.2 | **6.44** | **HARDFAIL** |
| `X7_cosmetic_pairs` | 0 | **267** | **FAIL** |

Those are the exact three numbers the delivery claims to have moved, sitting at their exact
pre-delivery values. What is missing is the `reward_*` block per resolution (the consumers W1-18
names are the canonical gold purse, inventory and durable quest/world flags) and the
`br_declared_choice` branch record — which is why the branch mean fell back from 1.94 to 1.03. The
schema that admits them went with it: `corpus/30-quests/quest.schema.json` at `HEAD` lacks the
`recovery` / `rescue` task kinds and the `comply` / `expose` / `investigate` / `lie` / `sabotage`
resolution methods, and `RI-QST04`'s amendment row `AM-QST04-W1-18-03` is absent.

**Intent, read the way `RECOVERY-20260814` reads it — from the record, not from a guess.** The
merge's own title claims to integrate W1-18. `git log -S` finds exactly one authoring commit for
every one of those ids and it is `9a0999fa`; no commit anywhere states a removal; no verdict on
W1-18 exists to have rejected it; `game/data/quests/magic-utility.json` has had **no commit touch it
at all since 2026-08-10**. This was an accident.

**Ruling, and it is reversible.** *This is a re-integration, not a recovery, and this pass will not
do it unilaterally.* Reasons, in order of weight: (1) it is ~29,000 lines across the 24 files W1-18's own record names that must
land **together** — schema, data, `engine.js`, `sim/quest/machine.js`, `sim/quest/reveal-routes.js`,
`harness/api.js`, `game/data/index.json` — because any subset either fails `check-quests` or is dead
data; (2) two of those files, `game/src/engine.js` and
`game/data/quests/faction-continuation-wave1.json`, are **claimed right now** by the in-flight
`W1-20-r3-remediation`, and landing 3,500 lines under another agent's live claim is the exact
behaviour this whole investigation is about; (3) a delivery that has never been criticised should
not re-enter the tree without a critic. **What would overturn this:** if nobody picks it up within a
day, the balance flips — a HARDFAIL standing on the branch is worse than a merge conflict, and the
restore recipe below is one command per file.

```sh
# every blob is permanent in the object database; nothing here can be lost again
git show 9a0999fa:<path> > <path>     # for each of the 24 files in W1-18's files_touched
node tools/analysis/quest-audit.mjs   # acceptance: multi_faction >= 30, X7 == 0, mean_branches >= 1.3
node tools/check-quests.mjs           # must stay at 202 quests, hooks and entry topics resolving
```

### 2b. `556c08e2` reverted `HAZARDS` §6 and the `bank.mjs` hardening — §6 is restored here

`fd5d7a24` (08-14) — *"bank.mjs stops lying about its own success: exit code now tracks reality"* —
wrote a 50-line hazard entry and 161 lines of hardening. `556c08e2`, a bank titled *"In-flight agent
work: visual children, plan audit, look target, HUD"*, dropped both hours later. The wound was
visible in the table of contents the whole time: **`HAZARDS` ran §5, §7, §8, §9 with no §6.**

- **`orchestration/HAZARDS.md` §6 — RESTORED here, byte-identical, and flagged.** A dated note
  underneath records that the *specific* code paths are superseded — `bank.mjs` no longer calls
  `git restore --staged` at all, and the four-arm self-test now lives in
  `node tools/land.mjs --self-test` — while the doctrine is not: on this box every retry loop reads
  the pipeline's exit code and not the words, so any tool that prints its own failure and exits 0 is
  read as success. That lesson is recorded nowhere else at `HEAD`.
- **`tools/bank.mjs`, 150 lines — ruled SUPERSEDED, deliberately not restored.** Written evidence,
  from the file itself at `HEAD` (lines 121–123): *"`land.mjs` takes them as `--exclude`, which is
  the same behaviour the old `git restore --staged` had … without needing an index to restore them
  out of."* The bug those 150 lines fixed cannot occur in code that no longer exists. Restoring them
  would reintroduce the code path, which is the wrong direction.

### 2c. `091a6cec` — the proven instance, repaired by its owners while this pass ran

Recorded for completeness and because the timing matters. Both halves — the 18 lines of
`game/src/engine.js` and the whole body of `orchestration/status/W1-20.json` — were absent from
`HEAD` when this pass opened and are present now, put back by `W1-20-r3-remediation` and the
`W1-20-r2` critic that found them. `W1-20.json` at `HEAD` carries a `superseded_next_step_note`
naming `091a6cec` explicitly. **Nothing was restored here that its owner was already restoring**, and
the tool's self-test still pins the incident as its positive control so the regression stays testable.

---

## 3. `AQ-W1-20-B` — answered, and it is not one incident

> *Has a wrapper surviving while the function under it is reverted happened elsewhere? That is the
> shape that makes a partial revert invisible to every existing check — the harness answers, so
> nothing goes red.*

**Yes, repeatedly, and once catastrophically.** `node tools/forensics/wrapper-orphans.mjs --history`
reads `game/src/harness/api.js`'s `engine.X(` call set against `game/src/engine.js`'s declared
members at every commit that touched either file — 199 commits.

| | |
|---|---:|
| commits where at least one wrapper pointed at a method the engine did not declare | **46 of 199** |
| distinct symbols orphaned at some point in this history | **150** |
| `factionAccess`, orphaned across consecutive commits 08-10 → 08-14 | **43 commits, four days** |
| `e0b03132` (08-11, *"Merge current Wave-1 builder flight"*) — orphaned **at once** | **150 wrappers** |
| `setLoadout` / `consumeBossOutcome` / `equipItem` | 3 / 2 / 2 commits |
| **at `HEAD` today** | **0 of 235 unresolved** |

`e0b03132` is the whole point of the question. The entire harness surface — `talkTo`, `saveState`,
`spawn`, `killPlayer`, `getUIState`, 145 more — pointed at an engine that had been cut to a stub, and
that is the damage `669ae9b7` *"Restore executable engine after Wave 1 merge"* (+11,583 / −1,825) was
undoing. For as long as that state was on the branch, **the harness loaded and answered**, because a
one-line forwarder is syntactically fine whether or not anything is under it.

**And the recovery pass itself ran inside the `factionAccess` window.** `1db3f66c` — *"Orchestrator
tick: 74 files recovered, the disease is eight days old"* — is one of the 43. Nothing it could have
run would have gone red.

**The gates that cannot see this, named so nobody trusts them for it:** `boot-check` PASSes (it
constructs the engine and asks the harness to answer, which it does), `check-data` PASSes (408 NPCs,
310 soul rows), `check-content` PASSes (551 resolutions), `check-quests` PASSes (202 quests). All
four pass at `HEAD` today and all four passed throughout. The detectors that *did* fire were
`node tools/quests/w1-20-builder.mjs` — which calls the verb, and threw — and
`node tools/analysis/quest-audit.mjs`, which counts the data rather than asking whether it loads.

---

## 4. The instrument, its null control, and the arm that had to go red

Both tools are landed and both refuse to report a sweep unless their controls behave.

```
node tools/forensics/partial-revert-sweep.mjs --self-test     7/7 arms pass
node tools/forensics/wrapper-orphans.mjs      --self-test     2/2 arms pass
```

**The null control is the plausible wrong answer, not the trivial one.** The trivial control is *"a
commit that removes nothing"*, which proves only that a detector can stay quiet. The plausible wrong
answer is **a merge whose side legitimately deleted code as part of a refactor**, where the merge
correctly carried the deletion through — that leaves byte-for-byte the same evidence a partial
revert leaves, and a detector that keys on *"content the merge lacks"* condemns the refactor.

The control used is `b823e03d` (PR #168), whose merged side carries `78838f1f` *"remove idle VFX and
vegetation shadow waste"* and `ff42b238` *"remove marsh water lattice banding"* — two deliberate
removals.

| | naive detector (base lines absent from the merge) | this detector (side-**added** lines the merge lacks) |
|---|---:|---:|
| **null control** `b823e03d` — a real refactor | **274 lines over 30 files** — 274 false findings | **0** |
| positive `091a6cec` — the proven revert | 661 | **83 over 6 files**, incl. `engine.js` / `factionAccess` |
| positive `c9603f64` p5 — the W1-18 revert | **50** | **3,798 over 26 files** |

Read the last row twice. On the largest real partial revert on this branch the naive answer sees 50
lines and this one sees 3,798, while on the refactor the naive answer invents 274 findings and this
one is silent. **The naive detector is not merely noisier — it is pointed the wrong way**, because a
refactor's removals are in the base and a revert's losses are not.

**Both directions, per `HAZARDS` §0b.** A guard that only fires the way its author expected fails on
half the number line, so there is a second arm: **RESURRECT** — lines the side *deleted* that the
child has *back*, i.e. a deletion silently undone by a stale snapshot. It is not decoration: it
returns 30 on `091a6cec` and 809 on `c9603f64` p5, and 0 on the null control. A self-test arm
asserts it fires somewhere, because an arm that has never fired is an arm nobody has tested.

**Delete-the-fix, executed rather than described.** On a copy, the base-relative filter — the single
line that separates "the side added this" from "this is merely absent" — was removed. The null
control's DROP arm immediately fired (**0 → 8** false hits on the refactor) and the suite went red,
exit 1. The guard is load-bearing.

---

## 5. Is the disease worse than recorded?

**Yes, and the eight-day figure understates it in kind rather than in span.** The dates hold: the
oldest content-level hit found is 2026-08-06, the same day the file-level sweep reaches. What
changes is the *unit of loss*.

- The file-level count says 74 files. It cannot count **a delivery**. `c9603f64` cost one file the
  recovery could see and 26 files' worth of contents it could not — and it restored the delivery
  record while the delivery stayed gone, which is worse than either alone, because the tree now
  carries a status file that is a false statement about the tree.
- **The 11,500-line engine restores of 08-10 and 08-11 are the same disease at a scale nobody
  costed.** `e0b03132` orphaning 150 wrappers at once is what an engine reduced to a stub looks like
  from the harness side, and `669ae9b7` is the repair. Two of those in two days.
- **Two of the three incidents here are inside commits whose titles are about something else** — a
  bank about "visual children, plan audit, look target, HUD", a merge "pending semantic seam
  reconciliation". `git log --grep` will never find these. The signature is in the trees.

---

## 6. What this pass could not do

- **The full single-parent sweep over all 1,401 commits did not finish.** It was killed after ~50
  minutes without producing output; the targeted 29-commit population above ran in its place. So the
  claim "the single-parent tier is clean" is measured over the commits the task named and **not**
  over the whole branch. `node tools/forensics/partial-revert-sweep.mjs --all-commits` is the run
  somebody should let finish.
- **W1-18's delivery is not restored** — ruled a dispatch in §2a, with the reasons and the one thing
  that would overturn the ruling. That is the largest outstanding item on this branch and it is
  written down rather than done.
- **Line matching cannot distinguish a reformat from a revert in general.** For JSON the pass parses
  both sides and compares ids and leaf keys, which settles it. For Markdown and JavaScript it does
  not, so a wholesale re-indentation of a `.js` file would read as a total revert. None of the three
  incidents rests on that, but a future hit might.
- **The detector matches trimmed line content, so a line that moved to a different file counts as
  present.** That direction is deliberate — it under-reports rather than manufacturing findings —
  but it means the true count is a floor, not a total.
- **`orchestration/status/W1-20.json` and `game/src/engine.js` moved under this pass while it ran.**
  Both were absent at the start and repaired by their owners before the end; the numbers in §2c are
  re-verified at the current `HEAD` and the earlier ones are stated as history, not as findings.
- **No browser was run.** `node tools/contention.mjs` reported 5 instances and load 22.95 over 4
  cores — at or over the ceiling — so the live arm of the wrapper audit (calling each verb on a
  constructed engine) was not run; the static arm returns zero candidates at `HEAD`, which is why
  there was nothing to take to a browser. `boot-check` was run once, before the ceiling was checked.
- **Only `HEAD`'s ancestry is swept**, and only `harness/api.js` → `engine.js` for the wrapper
  question. Wrappers over other modules, and the ~20 local `worktree-agent-*` branches, are unswept.
- **`RI-VIS09`'s 30-line "moving-reference correction" was ruled superseded rather than restored**,
  on the evidence that its substance — 207 animated sequences, 304 behaviour-valid, and the §5a
  preregistration requirement — is all present at `HEAD` in integrated form. If that reading is
  wrong, the block is one `git show e74f6582^1:` away.
