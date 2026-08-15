# Operational hazards on this box — read before you touch git, the disk, or a GPU pod

Written and owned by the orchestrator. Each entry cost somebody real work. Where an entry names a
mistake, the orchestrator made it unless stated otherwise.

## THE ONE THAT MATTERS — how to put work on the branch. Everything below §2 is history now.

**Use `node tools/bank.mjs "headline"`, or `node tools/land.mjs "headline" --paths <yours>` if you
want to carry only your own files. Nothing else. Do not hand-roll a push.**

Both go through `tools/land.mjs`, which commits by **three-way merge** (`git merge-tree`), takes no
`.git/index.lock`, retries when a sibling lands first, and exits non-zero unless the bytes are
actually on the remote. `node tools/land.mjs --self-test` proves it: 13 checks, and the arm running
the *old* recipe is required to lose an agent's work or the suite declares itself vacuous.

**Three things every agent should know, because each one cost a day:**

1. **There is no push race.** Git rejects a non-fast-forward push; two agents pushing at the same
   instant cannot overwrite each other. Every hour spent on that theory was spent on the wrong
   problem — which is why worktrees, adopted to fix it, changed nothing.
2. **Diff your work against `HEAD`, never against `origin`.** A file a sibling pushed is absent from
   this disk *and* absent from `HEAD`, so against `HEAD` it is not a change. Against `origin` it
   reads as a deletion — and that is the deletion that has been eating this project.
3. **Never give a commit a second parent unless its tree came from a real merge.** A merge parent is
   a *claim* that your tree already accounts for that branch. Snapshot the working tree and label it
   a merge and git believes the lie permanently: every later merge reads the absences as deliberate
   deletions and never brings the files back.

**If `land`/`bank` says "N path(s) are in HEAD but not on this disk", that is not an error and
nothing was lost — it is refusing to delete files written in other agents' worktrees. Run
`node tools/land.mjs --sync` to bring them onto this disk.**

### 2f. The forensic, because the diagnosis was half wrong for a day and cost the fleet a day

Commit `06dafd04` — an orchestrator bank — destroyed **18 files and 22,209 lines** of finished agent
work in one commit. It is the largest single loss found, and it is not the shape anyone assumed:

```
merge-base d7702f04 ── 18 commits of agents' pushed work ──▶ e469e6df   (origin, "theirs")
     └───────────────── 2 local commits ─────────────────▶ a8e4c938   ("ours", the shared tree)
```

`06dafd04` is recorded as a **merge** of both. Its tree is not a merge of both — it is a `git add -A`
snapshot of a shared working tree that had never received any of those 18 commits' files. Check it
yourself: `git diff --diff-filter=D --name-only e469e6df 06dafd04` returns 18 paths, and **every one
of them is absent from the merge base**, i.e. every one was work added by the branch it claimed to
have merged.

**The same merge, re-run through `git merge-tree --write-tree`: 18 of 18 kept, and ours' own addition
kept too.** That is not a simulation of the fix, it is the fix applied to the actual incident.

**There is a third mechanism, and `land.mjs` found it by deleting a file on its own first live run.**
`HEAD` is only a faithful description of the disk if the disk was checked out from it. In a shared
tree it never is: `HEAD` advances through merges and `reset --mixed` all day, while the files those
commits introduced were written in *other agents' worktrees* and never touched this disk. So HEAD's
tree is a superset of the disk and `add -A` reads the difference as deletions — faithfully, and
catastrophically. Nothing in the tree distinguishes "an agent deliberately deleted this" from "this
was never written here"; both are exactly *in HEAD, not on disk*. So the asymmetry is the answer:
a wrongly-kept file is a dead byte somebody removes later, a wrongly-deleted file is an agent's
afternoon. **Deletions are not carried unless asked for** (`--paths`, or `--allow-deletions`).

**Two guards, and they are independent — say so when you report it.** Base-is-HEAD and
deletions-are-opt-in each individually prevent the classic two-agent loss. The self-test's first
scenario therefore runs as a **2×2**: sabotage either guard alone and the work still survives;
sabotage both and it is lost, exactly as the old recipe loses it. The first version of that suite
sabotaged only the base, watched it pass, and would have shipped calling that a green light. That is
RULES rule 6's fourth shape, and it is why the arms are four and not two.

## 14a. A whole-tree bank can hang indefinitely — `land --paths` is also the faster tool

Measured twice on 2026-08-15, on the same tree, minutes apart:

| | elapsed |
|---|---|
| `bank.mjs` with no `--paths` | **hung — killed at 584 s**, no output, no children, box at load 4.3 |
| `land.mjs --paths <4 files>` | **~1 s**, landed and verified against the remote blob |

It is not load and it is not the network. A whole-tree bank walks every changed path in a tree that a
dozen agents are writing to, and the set it is walking keeps moving underneath it. Under `nohup` its
output is block-buffered, so a hung bank looks identical to a working one — **no output is not
evidence of no progress, and it is not evidence of progress either.**

**So `--paths` is not merely the polite choice, it is the fast one.** §14 already gives the
correctness reason (a whole-tree bank steals the commit headline and the finished piece never learns
it finished) and §12 the experimental one (it can carry a sibling's uncommitted edit into `HEAD` and
turn a delete-the-fix green). This is the third, and it is the one you notice first.

**If you must run a whole-tree bank — before a restart, to save the fleet — give it a deadline and
kill it by PID if it passes.** A bank that has produced nothing after five minutes on a quiet box is
hung, not slow.

## 14. A whole-tree bank steals the headline — and the piece never learns it finished

**Caused by the orchestrator, found three times in one day.**

`bank.mjs` with no `--paths` carries every sibling's in-flight work under **the orchestrator's own
commit headline**. The work lands correctly — nothing is lost — but the commit says something about,
say, a `HAZARDS.md` fix, and **nothing writes back to the originating piece's status file.** So a piece
that is completely finished still reads `in_progress`, and the next person to look at it either
re-dispatches work that is already on the branch or, worse, treats a finished remediation as unstarted.

Confirmed instances on 2026-08-14: `W1-20-r3-remediation` (its whole four-item remediation — twelve
`world_flags`, the locked-player dialogue bug, a deleted `Engine.factionAccess()`, a missing
faction-reactions row — arrived inside a bank titled about something else), plus `critic-w1-20` and
`critic-w1-attr-scale` found by the ownership sweep the same day.

**Two things follow:**

1. **`--paths` whenever you reasonably can.** A whole-tree bank is the right tool for saving the fleet
   before a restart and the wrong tool for landing your own work. It is an intervention in every live
   piece on the box, not neutral housekeeping — §12 is the other half of the same lesson.
2. **A status file is not evidence that work is unfinished.** Check the branch. `tools/stranded-check.mjs`
   exists for this, and `node tools/ownership.mjs` was fixed the same day for the mirrored problem.

**And do not use file mtime to judge staleness.** Independently confirmed twice: `W1-18`'s status file
read **11.5 hours** old by mtime and **122 hours** by `git log` — a 10.6× error, easily enough to
misdirect a fresh dispatch at an already-answered brief. Hundreds of files share a bulk-checkout
timestamp. Use git dates.

## 16. No capture in this project had ever photographed a MOVING player — `setInput` is not a verb

**Found 2026-08-15, and it voids a class of evidence rather than a single run.**

`grep -rn setInput game/` returns **0**. It is not a harness verb and never was. Two separate character
rounds opened their motion sequences with it, and `call()` **swallows the failure silently** — so the
capture ran, produced frames, reported success, and the player never moved.

Measured, and the contrast is not subtle: across one round's entire "walk" sequence the background
border ring changed on **0.2%** of pixels. A run that actually drives the player moves **71.35%**.

**So every motion claim made before this date rests on frames of a stationary character.** The owner's
standing directive — *"stills are not enough… motion captures, e.g. rotating the camera around the
player"* — was being satisfied on paper by sequences in which nothing moved.

**Two sibling defects found in the same pass, same shape:**

- **`gateBuffer` was being called with argument names it does not have** (`{framing, canvas}` where it
  expects `{box, subject}`), so **subject-presence never ran on any character frame.** The gate existed,
  was invoked, and checked nothing.
- **Importing `f10-r3-materials.mjs` runs its entire capture and exits** — no main-module guard. A Pod
  told to run a different tool ran that one instead, and the manifest recorded the wrong tool name.
  Cost $0.019 and a wasted Pod, and it means one round's tool could never have produced its own shot
  list.

**The common lesson, and it is the expensive one: a harness call that fails silently is worse than one
that throws.** Three separate instruments here reported success while doing nothing, and each was
caught only when somebody compared what the frames actually contained against what the tool claimed.
**Verify your verbs exist** (`grep` the harness), **verify your gate's argument names**, and **make
`call()` throw on an unknown verb** rather than swallow it.

## 15. The capture path can return a frame that is not a picture of anything — and nothing goes red

**Found 2026-08-15, and it outranks any single visual defect, because every visual judgement this
project makes rests on this path.**

Two stills from one paid run, same scene, same pose, same GPU, same process:

```
capture 1: p10=4.641  p90=55.646  shadow_levels=28  local_contrast_med=6.217
capture 2: p10=7.493  p90= 7.523  shadow_levels= 1  local_contrast_med=0
```

`p90` collapsed by 48 luma, **one distinct shadow level, zero local contrast**. That is a near-uniform
frame — not a dark scene, not a subtle change, *not a picture*. The **pinned-baseline tree, containing
none of the code under test, produced the identical degenerate capture.** Earlier runs on the same path
returned 15.001 and 14.353, plausible enough that a **+223% improvement** would have been published
from them. Every gate stayed green throughout.

**The rule: sanity-check every frame before you measure it, per frame and not per run.** Use
**`node tools/visual/frame-liveness.mjs`**, which is wired into `deck.mjs`, `deck-motion.mjs` and the
character sweep at capture time.

> **CORRECTION, 2026-08-15 — the prescription this entry originally gave was wrong, and it was mine.**
> It said a frame with *"~1 distinct shadow level and ~0 local contrast"* must fail loudly, and that
> *"the cost is an `if`"*. Calibrated against **932 real captures from 366 directories**, that pair
> armed as hard gates rejects **324 of 932 real frames — 34.76%**. `local_contrast_med` is **exactly 0
> on 177 real frames** (sky, water, UI panels); `shadow_levels` has corpus p01 = 0 and p02 = 1, i.e.
> *below* the incident's own value. The obvious repair — p90 local contrast, "is there detail
> anywhere" — reaches 0 on real frames too and rejected 43.75%. **Neither statistic leaves a usable
> gap in any formulation tested.**
>
> I derived a threshold from one incident's numbers and wrote it up as a rule without checking it
> against the corpus. That is rule 0b's defect — asserting something about the repo that a command
> would have refuted — committed inside the hazard entry warning about unmeasured claims. The agent
> that was sent to implement it measured first and refused it, which is the job working.
>
> **What actually ships:** a five-test battery — span, entropy, dominant-colour, structure ratio and
> duplicate detection — every threshold sitting in a *measured* gap. It rejects **7 of 932 real
> captures (0.75%)**, and that low false-positive rate is precisely what makes failing loudly safe.
> The original incident is still caught, by span, which it fails by three orders of magnitude. The two
> statistics above still ship, reported but **not fatal**; `--strict` arms them.
>
> **The transferable lesson: a gate's threshold must be calibrated against the real population before
> it is armed, not derived from the single failure that motivated it.** A gate that rejects a third of
> honest work gets switched off, and then the protection is worth less than nothing because everyone
> believes it is on. That is the same failure as §11's pinned-tree guard, arriving from the other side.

**This is not the only way a frame lies here.** A separate `F10` capture tool reported `0 red` while
**17 of its 93 frames contained no subject at all** — it could not tell an empty frame from a full one.
So a frame needs two liveness checks, not one: *is this an image*, and *is the thing I am measuring in
it*.

**What it costs us retrospectively, stated plainly:** the Protocol A blind pack — the only blind visual
judgement in this project's history, which we lost 5 of 5 — was built by this path. Until the gate
exists, that result is not known to be a measurement of our renderer.

**Four hypotheses were tested and refuted before this was understood** — the analysis code, the world
clock, scene age, and harness call order (a flag was built for that last one and it produced the wrong
regime anyway). The agent found it by *looking at the numbers in the frame*, not by reasoning about the
pipeline. When an instrument is suspect, read what it actually returned.

## 15a. A paid GPU run inherits siblings' uncommitted edits — always pass `--revision`

A paid run snapshots `revision + worktree changes`, so it carries whatever is uncommitted in the shared
tree at that moment. **A mid-edit to `game/src/ui/icons.js` by one builder killed both arms of another
agent's paid run.** The CLI's existing `--revision` flag pins it. Pass it on every paid run and record
the sha — otherwise the arms of your experiment differ by whatever a neighbour happened to be typing.

## 13. Agents stall waiting on their own monitors — take the measurement or declare it unmeasured

**Measured on the evening of 2026-08-14: four separate agents stalled waiting on background tasks, and
one of them stalled twice.** Each ended its turn with some variant of *"I'll wait for the monitor to
report before deciding how to proceed."* The monitors were watching runs that had, in several cases,
already finished — the notifications were stale — so the agent was waiting on something that would
never arrive.

**A blocked agent produces nothing. An approximate answer produces something.**

Three rules:

1. **Never end a turn waiting.** If a background task has not reported, take the measurement inline,
   take a cheaper proxy, or write *"unmeasured, because X"* and carry on with the parts that do not
   depend on it. Ending a turn to wait converts a slow measurement into an indefinite one.
2. **Suspect the monitor before suspecting the run.** Several of tonight's stalls were on runs that had
   already completed successfully. One agent's own `pgrep` loop was matching *its own waiter shells*,
   so the condition could never clear — a check contaminated by the thing doing the checking, which is
   the same shape as §0's failure family.
3. **Know what is actually slow here.** `gl.readPixels` was measured at **10–20 seconds per call** on
   this box at load ~3–3.4 per core. A frame-by-frame pixel walk is not slow because something is
   broken; it is slow because that is what it costs. Budget for it or choose another instrument.

**Disarm your waiters before you finish.** A background `Monitor` or `until`-loop left armed keeps
firing after its agent has completed, and each notification **wakes the agent again**. Measured
2026-08-15: one agent's final report was delivered eight separate times, each wake costing a turn, and
its total went from ~500k to **539k tokens and 381 tool calls** — every one of them after the work was
landed and verified. `TaskStop` reports the agent as `completed`, so the orchestrator cannot kill it;
only the agent can, and only before it stops. Kill your own waiters by PID as your last act, and never
arm one you do not intend to read.

**And the deliverable is usually the fix, not the evidence.** A regression fix held back behind a
perfect capture is worse than an honestly-labelled unverified fix, because the tree stays broken while
the pack is assembled. Land the fix, label what is unverified, and let the evidence follow.

## 12. `HEAD` is not your baseline — a sibling's bank can turn your delete-the-fix green

**Reported by the agent it happened to, and caused by the orchestrator:** *"my first delete-the-fix came
back green because the orchestrator's bank had already carried my uncommitted edit into `HEAD`. On this
tree, `HEAD` is not your baseline — your session's base commit is."*

This is worse than an inconvenience. **Delete-the-fix is one of the five non-negotiables** — *a fix is
not a fix until it has been deleted on a copy and the old number has come back* — and this failure mode
makes it **pass when it should fail**, silently, with no error and nothing red. An agent removes its
change, measures, sees the improved number persist, and concludes... something. The honest conclusions
are all wrong, and the tempting one ("my change must not have been the cause") is the most expensive.

**Mechanism.** `bank.mjs` with no `--paths` stages the whole working tree, which in a shared checkout
includes every sibling's uncommitted, in-flight edits. Once banked, that edit is in `HEAD`. Any control
clone taken from `HEAD` therefore *already contains the fix* the experiment is trying to remove.

**Three rules follow.**

1. **Pin your baseline at the start of your piece and use that commit**, not `HEAD`, for every control
   clone. Record the sha in your status file. `HEAD` moves under you many times an hour here.
2. **Bank with `--paths <your files>` whenever you reasonably can.** A whole-tree bank is the right tool
   for landing the fleet's work before a restart, and the wrong tool for landing yours.
3. **Orchestrator: a whole-tree bank is an intervention in every live experiment on the box, not
   neutral housekeeping.** It is still correct to do — unbanked work dies with the container, and the
   container has restarted twice in one day taking nine agents each time — but the cost is real and it
   lands on exactly the agents doing the most careful work. `bank.mjs` already refuses files that do not
   parse; it cannot know which files are mid-experiment.

**The tell:** a delete-the-fix control that comes back green on the first attempt deserves suspicion
before celebration. Check whether your baseline moved before you conclude anything about your change.

## 11. A shared tree moves under every experiment — freeze the arms, don't guard them

**Measured today: four different agents changed four files under `game/` in 45 seconds.** That is the
normal state of this box, not a bad moment.

So any browser experiment that serves its arms from the live repo is being run against a moving target,
and one of its arms will differ from another for reasons that have nothing to do with the thing under
test. This has already voided a real experiment — the fog control's source changed *between two of its
own arms*, and the run's `pass` was computed across a discontinuity nobody noticed.

**The obvious remedy is a guard, and the obvious remedy is wrong.** An agent built a `pinned-tree`
check that aborts a run if the tree moves. It works — and it aborted **both** of its real runs, neither
time because of the deliberate test perturbation, both times because siblings were simply working. A
guard that fires on every honest run is a guard people switch off, and then the protection is worth
less than nothing because everyone believes it is on.

**Freeze by construction instead.** Serve **every** arm from its own `control-clone`, not just the
sabotage arms. Then the tree cannot move during the experiment, because the experiment is not reading
the tree. The half-measure is the trap: `fog-control.mjs` served its `head` arm from the live repo
while serving its sabotage arms from frozen clones — so the one arm that mattered most was the only one
exposed to drift, and it is exactly the arm whose evidence turned out to be stale.

**The general rule:** when the environment is shared and mutable, prefer *making the variable constant*
over *detecting that it changed*. A detector on a genuinely noisy input produces alarms you will learn
to ignore. This is the same family as §8's arm-to-arm image diffs — the answer there was also to stop
comparing across a noisy axis rather than to build a better comparison.

## 10. `pkill -f headless_shell` is a fleet-wide kill, not a cleanup — kill by PID

An agent cleaning up **its own** stalled browser ran `pkill -9 -f headless_shell`. The pattern matches
every agent's browser on the box. Three siblings' capture runs — `deck.mjs`, `gpu-deck.mjs` and
`deck-motion.mjs` — were resident immediately before and gone immediately after, and **nobody can now
tell whether they finished or were killed**, which is the expensive part: a killed capture that looks
like a completed one gets cited.

It also killed the perpetrator's own probe arm, so it did not even work as cleanup.

**Kill by PID, and only your own.** Record the PID when you start a browser. The same warning applies
to every `pkill -f`, `killall`, and `pgrep`-driven loop on this box: the fleet shares one machine, so
any pattern that matches a *program* rather than a *process you started* is a fleet-wide action. This
is the same shape as `runpod cleanup` with no arguments (§4) and `git gc --prune=now` (§1) — a command
whose blast radius is the whole box, run by an agent reasoning about its own work.

## 9. Evidence under `reports/` can silently never reach the remote — and nothing goes red

**Symptom, from the agent who found it: three landing attempts that "succeeded" and put nothing on the
branch but a `.pin.json`.**

The mechanism is a disagreement between two tools that both look correct on their own.
`tools/verdict-evidence.mjs --recover` does `git add -f` **into the real index**, which is exactly right
— `-f` is there to defeat `.gitignore` for cited artefacts. But `land.mjs#buildOurs` does not use the
real index. It builds a **temporary** one and runs `git add -A` into it, and `git add` without `-f`
**honours `.gitignore`**. So the `-f` is applied to an index that is then thrown away, and every cited
artefact under an ignored path evaporates between the two steps.

Nothing reports a failure, because nothing failed: `verdict-evidence` did add the files, `land.mjs` did
land what its index contained, and both exit 0. The verdict then cites screenshots that exist only on
the box that made them — and the box is ephemeral.

**What to do instead, and it is the route other verdicts already use.** Put cited evidence in
`corpus/90-verdicts/wave1/artifacts/<PIECE>/`, not under `reports/`. Then **verify it against the remote
blob**, not against `git status` — §2 of this file is the same lesson in a different disguise, and it
has now cost two separate agents on two separate days. `bank.mjs` prints `verified N path(s) against the
remote blob`; if your artefact count is not in that number, it did not land.

**The general form, worth carrying past this specific bug:** a `-f` flag only defeats `.gitignore` for
the index it is run against. Any pipeline that stages into one index and commits from another will drop
exactly the files someone went out of their way to force-add — which is to say, exactly the files that
mattered enough to force.

## 8. Two measurement traps that cost ~40 minutes each today

**Arm-to-arm image diffs are meaningless at a foliage site.** Two frames that look identical to a
person differed on **77% of pixels** — wind, alpha-tested leaf edges and sub-pixel sampling move
almost everything every frame. A diff between *arms* therefore measures noise, not the change. Only
a **within-arm sabotage diff** — same arm, one thing deliberately broken — carries signal. A visual
agent that reports "X% of pixels moved" between two arms has measured its own foliage.

**`| tail -N` buffers the whole pipeline until the command exits.** Two healthy capture runs looked
hung and were killed; roughly forty minutes lost, twice. If you need to watch progress, write to a
file and read the file — do not pipe a long-running capture through `tail`.

## 7. A git worktree cannot render the game — and it fails as `GAME_BROKEN`

**The orchestrator moved most agents into isolated worktrees to stop the clobbering, and thereby
broke rendering for nine of eleven of them without noticing.**

`tools/node_modules` **is gitignored**, so a `git worktree` never receives it. `launchGame()` then
exits 70 and the shared capture daemon returns **`GAME_BROKEN`** — which reads as *the game is
broken*, not *your environment is missing a directory*. Two agents hit it, one correctly diagnosed it
as a worktree artefact and said so; anything concluded from it before 2026-08-14 should be re-run.

**Fixed by symlinking `tools/node_modules` (and the root `node_modules`) into every agent worktree.**
Any new worktree needs the same link before it can capture anything.

**Second trap in the same place:** an agent in a worktree that calls `tools/harness/shot.mjs` starts
a **second capture daemon rooted at its own worktree**, which cannot work and competes for the
browser ceiling with the real one. Use the shared daemon.

## 6. `tools/bank.mjs` could print failure and still exit 0 — rule 28's trap, live

An agent lost finished work to this: `bank.mjs` reported a problem in its own output and then exited
0 anyway. Every retry loop on this box checks the *pipeline's* exit code, not the words —
`if node tools/bank.mjs "…"; then echo OK; break; fi` — so a truthful-sounding failure message that
exits 0 is read as success and the agent moves on believing its work is saved. Seven agents lost
finished work on 2026-08-14; this is the mechanism behind several of those losses.

**Before, two concrete lies, both real code paths, not a hypothetical:**

1. Two call sites un-staged a path (a file that failed `node --check`, or a file `check-shipped-
   files.mjs` said would 404 on the deployed site) via `git restore --staged`, inside
   `try { … } catch {}`. If the restore itself failed — index contention, a stray lock — the
   exception was swallowed, the code kept trusting its own hand-spliced JS array of "what got
   excluded," and the final commit carried the excluded file anyway while the printed message said
   `excluded N path(s) from this commit`. The exit code at the end was still 0.
2. Nothing checked, after `git commit` returned success, that HEAD's own tree actually contained
   every staged path. `execFileSync` not throwing only means git's exit code was 0 — it says nothing
   about content. A hook that rewrites the index, or a race that lands a different commit in
   between, could drop a path with `git commit` itself still reporting success, and the tool printed
   `bank: committed N path(s)…` regardless.

**After (this branch, `codex/wave1-build-experiment`):**

- `git restore --staged` failures are no longer swallowed: a failed un-stage is now a hard stop
  (non-zero exit, nothing committed), and every call site re-reads `git diff --cached --name-only`
  from git itself afterward instead of trusting a spliced array — the ground truth, not the tool's
  memory of what it intended.
- After every real commit, `bank.mjs` diffs `HEAD`'s own tree (`git diff-tree --no-commit-id
  --name-only -r --root HEAD`) against the staged-path list and refuses to report success if
  anything staged is missing from what actually landed. The commit is left in place (no auto-amend
  on a tree a dozen agents are touching) but the exit code is non-zero and the message says exactly
  which paths did not land.
- `bank.mjs` still does not push (that remains `TICK.md` step 2's job, run right after), but it now
  says so unconditionally on every successful run — `NOT PUSHED. … run git push … before treating
  this work as landed on origin` — so a retry loop that only checks this tool's exit code cannot
  mistake "committed locally" for "published." **Decision, reversible:** folding an actual `git push`
  into `bank.mjs` was considered and rejected, on the grounds that it would add network latency to a
  tool that "runs constantly" (the explicit constraint on this fix) and that a push failure is a
  different failure mode than a commit failure worth distinguishing rather than conflating. Evidence
  that would overturn this: if stranded-local-commit incidents continue after this fix despite the
  explicit message, that means the message is being ignored rather than missed, and folding the push
  in becomes the better trade.
- `node tools/bank.mjs --self-test` now exists (previously did not) and drives the real functions
  above against disposable scratch git repos — not a reimplementation of the logic, not a tautology.
  Four arms, each watched to fail before the fix and pass after: a lock that never clears must be
  reported held; a lock that is already clear must not be; a clean commit that carries everything
  staged must verify clean; a commit that drops a staged path (built with `git commit --only`, the
  exact shape a stripping hook produces — `git commit` itself still returns 0) must be caught, not
  waved through. Watched arm 1 and arm 3 actually go red on deliberately reintroduced copies of the
  old behavior (`held: false` unconditionally; `missingFromCommit` returning `[]` unconditionally)
  before confirming the shipped file passes all four.

Nothing on the commit path itself changed (rule 13): the restore fix makes an existing un-stage step
honest about its own result, and the post-commit verify runs strictly after `git commit` has already
returned, so neither can block or delay a commit that was going to happen anyway.

> **Restored 2026-08-14 by `PARTIAL-REVERTS-20260814`, and read it as history.** This entry and the
> `bank.mjs` hardening it describes were written by `fd5d7a24` and dropped hours later by
> `556c08e2` — a bank commit about visual children, plan audit, look target and HUD — leaving the
> visible §5 → §7 hole above. The *specific* code paths are superseded: `bank.mjs` no longer calls
> `git restore --staged` at all (it passes `--exclude` to `land.mjs`), and the four-arm self-test now
> lives in `node tools/land.mjs --self-test`. **The doctrine is not superseded, which is why it is
> back:** on this box every retry loop reads the pipeline's exit code and not the words, so any tool
> that prints its own failure and exits 0 is read as success. Ask it of any tool you ship here.

## 0. A fifth failure shape: a self-test whose arms agree about a false premise

Rule 6 lists four ways a control fails. Here is a fifth, found on 2026-08-14 when the fix for the
Pod-killing bug **killed a sibling's live Pod through its own guard**, hours after shipping with a
green self-test.

The guard tagged ownership into the RunPod resource name, keyed on `CLAUDE_CODE_SESSION_ID`. The
author asserted that identifies an agent. **It identifies the container** — four runs started by four
different sibling agents all carried the same slug. In the author's own words:

> *"My self-test passed the whole time because every arm **injected** distinct slugs. The arms
> disagreed about classification logic and agreed, wrongly, about the identity source — a test that
> cannot falsify its own premise."*

**The shape: every arm supplies the disputed input by hand, so they can only argue about what happens
downstream of an assumption none of them tests.** It looks exactly like a rigorous multi-arm suite.
Ask of any self-test: *which input do all my arms fabricate identically, and what would happen if the
real value were not what I assume?* If the answer is "they would all still pass", that input is
untested no matter how many arms there are.

**The repair is also worth copying: two guards, each covering the other's blind spot.** An owner tag
in the RunPod name separates containers, accounts and worktrees and survives a container restart; a
per-process claim in `/tmp` separates **sibling agents inside one container** but dies with the
container. Neither is sufficient; together they cover it. Verified against the real collision — a
sibling's Pod carrying the author's own slug, zero minutes old, came back `PROTECTED`.

## 0b. A sixth failure shape: the one-sided guard

Rule 6 lists four ways a control fails; §0 above adds a fifth. Here is a sixth, found 2026-08-14 by
the canopy-shimmer measurement — **a guard that can only see deviation in the direction its author
expected.**

The rule asked `(A / C) > 1.02` — *is this arm noisier than the floor?* The arm came back at **0.82**,
an 18% departure in the **quieter** direction, and the tool printed **"NO POWER"** over a real and
important result. In the author's own words:

> *"It wasn't blind; I'd given it one eye."*

**A guard that only sees deviation in the direction you expected is the same failure as a control
that cannot fail** — it simply fails on half the number line instead of all of it. Ask of any
threshold: *what would this print if the effect went the other way, and is that outcome
distinguishable from no effect at all?*

Two things the same round did right and worth copying. It **wrote the confound into the finding
rather than banking a win**: the metric is mean *absolute* luminance change, shadowing darkens the
ground, and darker images have smaller absolute deltas — so the magnitude is confounded and must not
be read as "18% calmer". The *direction* is what supports the negative claim, and the negative claim
was what was owed. And when it found two published manifests carried the wrong verdict string, it
**superseded them in a named file** rather than quietly rewriting them.

## 1. `git gc --prune=now` destroys other agents' staged work — use plain `git gc`

On 2026-08-14 the disk hit 96%. The space was in `.git`, which had grown to **9.3 GB**;
`git gc --prune=now` returned **8.3 GB** and took it to 1.2 GB. Reclaiming from `.git` is still the
first thing to try when the box is tight — ahead of deleting anything, because the obvious culprits
were seven ~1.2 GB **live null-control clones**, which are delete-the-fix work in progress.

**But `--prune=now` was the wrong flag.** A GPU agent's `run-http.mjs`, disk guard and CLI wiring
were clobbered by a concurrent checkout, and because `--prune=now` had already collected the
**staged but uncommitted blobs**, nothing was recoverable — it had to rewrite and re-verify work that
had already run on live hardware. Plain `git gc` keeps unreachable objects for two weeks and frees
nearly as much. With a dozen agents holding staged work, those blobs are the only copy.

## 2. `git status` clean is not evidence your work is in the tree

Six agents have had finished work silently reverted. Three distinct causes, all real:

- **Two agents holding one file.** A whole-file write erases the other's edit regardless of git.
  Ruling O1 (**defined in `orchestration/OWNER-DIRECTIVES-2026-08-14.md` § "Ruling O1", NOT in
  `corpus/00-doctrine/ARBITRATION.md` — the orchestrator sent agents to the wrong file all day on
  2026-08-14, and a pointer that resolves to nothing is obeyed by guesswork) binds the orchestrator to
  run `node tools/ownership.mjs --for <path>` and `--conflicts`, and check `ListAgents`, before
  dispatching into any file.
- **`index.lock` contention.** `bank.mjs` times out, `git commit --only` loses the race, `git merge`
  dies with `fatal: stash failed` against other agents' uncommitted files, and the tree looks clean
  afterwards because the edit is simply gone.
- **A push built from a stale parent** silently drops files added since that parent.

**⚠ RETIRED — 2026-08-14. THE RECIPE THAT USED TO BE HERE IS THE THING THAT LOSES THE WORK. Do not
use it, do not copy it out of an old status file, do not "just this once".**

```sh
#  ────────────────  DO NOT RUN THIS  ────────────────
#  git read-tree origin/<branch>     ←  the defect is this word: `origin`, not `HEAD`
#  git add -A                        ←  now every file a sibling pushed is staged as a DELETION
#  git commit-tree "$TREE" -p "$P"   ←  and the parent makes git believe you meant it
```

It got the *lock* right and the *baseline* wrong, and the baseline is the whole game. Staging against
`origin` means the shared working tree — which never receives anything anyone else pushes — is
treated as the truth about the branch. This is the mechanism behind §2d, §2e and §2f, and behind at
least eight agents' silently reverted work.

**Use `node tools/bank.mjs "headline"` or `node tools/land.mjs "headline" --paths <yours>` instead.**
They keep the good half — a private `GIT_INDEX_FILE`, so `.git/index.lock` is never taken and no
commit can lose a race — and replace the bad half with `git merge-tree`, an actual three-way merge.

**Verifying against the remote blob is still right, and `land` does it for you.** If you do it by
hand, compare against **what you committed**, not against what is on disk a minute later: a live
agent rewriting its own file between your snapshot and your check is not a loss, and a verifier that
reports losses that are not losses is a verifier everyone learns to ignore.

### 2a. Never create a file as a blob without also writing it to the working tree

The orchestrator created this very file by hashing `/tmp` content straight into a temporary index and
pushing it. It landed and verified. Then the **next** routine `git add -A` — run from a working tree
that had never contained the file — staged its **deletion**, and the file vanished from the remote
one commit later. If you use the plumbing route for a *new* file, write it to disk as well, or the
next bulk stage will delete it for you.

### 2c. Worktrees — still worth having, but they were never "the actual fix" (superseded by §2f)

> **Read this heading's original claim as a warning about confident diagnosis.** Worktrees were
> adopted to stop the clobbering, cost nine of eleven agents their ability to render the game
> (hazard §7), and **did not stop the losses**, because the losses were never two agents writing one
> file. Keep worktrees for what they genuinely do — two agents cannot overwrite each other's edits on
> disk — and stop expecting them to protect the branch. Landing is what protects the branch (§2f).

Seven agents have now lost an hour or more to this, and several independently arrived at the same
workaround — *"the final push needed an isolated worktree, because `git merge` in the shared copy
dies with `fatal: stash failed` against five other agents' uncommitted files."* One had a rebase
destroy its report, status file, tool and blog line an hour into the work.

**The orchestrator has a built-in answer it was not using: the Agent tool's `isolation: "worktree"`
option**, which gives the agent its own git worktree. From now on, any agent that will write files
gets it, unless it genuinely needs to see another agent's uncommitted work — which is rare, and is
usually the thing that goes wrong anyway. Read-only agents (critics reading a diff, judges, research)
do not need it. The worktree is removed automatically if unchanged, so the cost is near zero.

This does not replace Ruling O1's ownership check; it removes the *class* of damage that check can
only warn about.

### 2d. Banking from the shared tree reverts other agents' pushed work — and worktrees do not stop it

**The orchestrator did this and it is the largest single source of lost work found so far.** Commit
`06dafd04` — an orchestrator bank — **reverted all twenty files an agent had already pushed**, taking
a canonical artifact back to a three-day-old refusal record and deleting two tools outright. The
agent only noticed because it re-read the remote blob after a second fetch.

**The mechanism, and it is not the one I assumed.** Banking does `git read-tree` from origin (correct),
then **`git add -A`** — which stages the *working tree*. The shared working tree is stale for every
file another agent has pushed from its own worktree, because nothing updates it. So `add -A`
faithfully stages an old copy over the new one, and the merge "keeps the pre-push side".

> **Worktree isolation does not prevent this.** It stops two agents writing one file. It does not
> stop a bank staging a stale index over a branch that has moved. Those are different failures and
> the second is the orchestrator's alone.

**⚠ THE mtime GUARD IS RETIRED — 2026-08-14. It was a timestamp patch over a baseline bug.** It kept
`read-tree origin` and then tried to guess, from file dates, which of the resulting deletions were
real. §2e already recorded that it rejects safe paths and is blind to append-only files; §2f explains
why no timestamp could ever have worked. **Diffing against `HEAD` makes the whole question vanish** —
a file a sibling pushed is not a change at all, so there is nothing to guess about.

The diagnosis it came with is still exactly right and worth keeping: *"`add -A` faithfully stages an
old copy over the new one."* It is the fix that was wrong, not the observation.

### 2e. The mtime guard is not sufficient, and append-only files need rebuilding from origin

**Correction to §2d, from an agent that watched it fail.** The guard — stage a path only when the
working file is newer than origin's tip — is **over-conservative and blind in one direction**:

- Origin's tip is routinely newer than your file's mtime, so **it rejects safe paths too**, and an
  agent relying on it alone will silently fail to land good work.
- It does nothing for **append-only files**. `reports/blog-feed.jsonl` was clobbered **three times in
  forty minutes by three agents — ten lines from nine agents lost**, restored, and lost again. A
  whole-file stage of an append-only log reverts every line the stager never saw, and mtime cannot
  see that.

**This entry called it exactly right and is now implemented rather than remembered.** Its own
prescription — *"per-path content comparison against the merge base rather than a timestamp"* — is
precisely what a three-way merge is, and `tools/land.mjs` does it with `git merge-tree`.

**And append-only files need no procedure at all any more.** `.gitattributes` marks
`reports/blog-feed.jsonl` as `merge=union`, so git keeps **both** sides' lines instead of calling it
a conflict. Verified under `merge-tree` specifically, not just under `git merge`, and covered by the
self-test's second scenario: the old recipe loses a line, `land` keeps both. Nobody has to remember
to re-read origin and union by content key before writing; just append your line and land.

### 2b. Never `git reset --hard` a shared working tree

A dozen agents hold uncommitted edits in it. `--hard` discards every one of them with no warning and
no recovery. Use `git reset --mixed`, which moves the ref and leaves the files alone.

## 3. Blanket `git add -A` sweeps things that must never be committed

The orchestrator's banking committed an agent's **deliberately-sabotaged validator copy** — a file
whose entire purpose was to be broken — and at another point a bank deleted an agent's report from
disk. Exclude sabotage copies, null-control clones and scratch. A sweep for the roughly sixteen
sabotage-shaped files already tracked is owed.

## 4. RunPod: HTTPS works, SSH never will, and `cleanup` used to kill everyone

- **SSH cannot reach a Pod from this container.** Raw outbound TCP is blocked and the agent proxy's
  `CONNECT` re-terminates TLS, while SSH is not TLS — every session dies at
  `kex_exchange_identification`. **Never add a wildcard SSH config**; it changes behaviour for every
  agent on the box. Never disable TLS verification or unset `HTTPS_PROXY`.
- **What works is ordinary HTTPS on 443**: `https://<podId>-<port>.proxy.runpod.net`. Verified on
  real hardware — RTX A5000, `ANGLE (NVIDIA, Vulkan 1.4.312)`, not SwiftShader, full run in 2m51s.
- **Node's global `fetch` ignores `HTTPS_PROXY`**, turning every RunPod API call into
  `403 Host not in allowlist`. The CLI now re-execs itself with `NODE_USE_ENV_PROXY=1`.
- **`cleanup` is owner-scoped now.** A bare `cleanup` used to terminate *every* managed Pod on the
  account and killed another agent's live Pod mid-capture. Ownership travels in the RunPod resource
  name, so it survives a container restart.
- The proxy takes **40–90 s to start routing** after a Pod reads `RUNNING`; a run budget under
  ~4 minutes will not survive it.
- **`node tools/visual/gpu-deck.mjs --help` does not print help — it rents a Pod and starts
  spending.** The tool has no `--help` handler, so an unrecognised flag falls straight through to
  provisioning. **Use `--estimate`**, which prints the cost model with no spend at all. (This was
  recorded only in `reports/thorn-plates/2026-08-14-thorn-plates.md` and was not reachable from any
  document an agent reads; moved here 2026-08-14 by `DOC-SLIM-HOTPATH`.)

## 5. The disk fails silently

Captures were failing with `ENOSPC` and looking exactly like clean runs. `tools/lib/browser.mjs` now
refuses to launch on short free space, covering all 247 harness tools; override deliberately with
`ELDER_SOULS_MIN_FREE_MB`.

### 5a. `tools/control-clone.mjs` — the cheap null-control clone, built and proven

The disk hit 99% twice in one day, and every time the seven live clones taking the space were
delete-the-fix work in progress (RULES.md rule 6) — legitimate, un-deletable, and each one copying
the *whole* tree when a control almost never reads most of it. Reading the seven existing controls
that do this by hand (`tools/world/road-join-deletefix.mjs` and its two siblings,
`tools/lore/*-consume.mjs` ×3, `tools/harness/w1-15-r4-deletefix.mjs`) turned up one consistent
answer: every one of them needs `game/` and `tools/`, and three of them additionally need one small
fixture, `corpus/50-world/world-scale.json` — never `corpus/`, `reports/`, `docs/` or `.git` wholesale.
A `git clone` of the whole tree (the worst case, and what "1.2 GB per copy" measures — `.git` alone is
1.2 GB after `git gc`, hazard §1) is not needed at all.

**The fix is hard links, not a smaller copy.** `game/` and `tools/` sit on the same filesystem as
`os.tmpdir()` (verified: same device id under ext4), so `fs.linkSync` costs one directory entry and
zero marginal bytes, versus `fs.copyFileSync`'s full byte-for-byte cost. `tools/control-clone.mjs
make --label <name> --writable <paths>` builds exactly this: everything under the requested paths is
hard-linked *except* whatever the caller names in `--writable`, which is real-copied because a
control always mutates at least one file (`game/data/world/roads.json`, an edited source file, a
quest doc) and **writing into a hard link truncates the shared inode and corrupts the real repository
file** — this is the one way the saving turns dangerous, and getting the `--writable` list right is
the only thing standing between a control and that corruption.

**Measured, on the actual road/settlement-join case** (`node tools/control-clone.mjs --self-test`):
apparent size — what a full `fs.cpSync` copy costs — **45.7 MB**; what the hard-linked clone actually
added to the disk — **0.2 MB** (the one declared-writable file). **A ~228× reduction**, and against a
naive full `git clone` (1.2 GB) it is closer to 6,000×. `--self-test` proves three things, not just
the disk number, because "cheap but stops detecting things" is the failure `COST.md` §5 forbids
absolutely:
1. **Equivalence** — the hard-linked clone and a full deep copy give byte-identical `roads.json` and
   identical measurements on the same real instrument (`tools/world/road-through-building.mjs`).
2. **Discrimination survives** — the SAME cheap clone, torn down with `--no-join`, goes red (legs
   blocked jumps and the bytes change) exactly like the deep-copy control does.
3. **Source safety, proven both ways** — on a synthetic tree (nothing real at risk), writing into a
   *declared*-writable file leaves the source untouched; writing into the same file *without*
   declaring it corrupts the source, which is deliberately reproduced once to show the danger is real
   and that `--writable` is what prevents it, not an assumption. On the real case, the actual
   repository's `game/data/world/roads.json` is hashed before and after and is byte-identical.

Cleanup follows `tools/runpod/cli.mjs`'s pattern exactly, because it solved this exact problem today:
ownership travels in the clone's directory name (an owner slug, the same computation
`tools/runpod/lib/owner.mjs` uses, so it is visible across a container restart), and a live-process
check (pid + `/proc` start tick, the same idea as `tools/runpod/lib/claims.mjs`) protects a sibling
agent in this container from a bare `sweep` — a bare `node tools/control-clone.mjs sweep` removes
only clones this agent made whose owning process has already exited; `--all --yes` or
`--older-than <min>` are required to reach anyone else's, and even `--older-than` still protects a
live claim unless `--force`.

`road-join-deletefix.mjs` now builds its scratch tree this way — read it as the worked example before
writing a new one by hand. `critic-road-join-consume.mjs`, `road-join-consumption.mjs`, the three
`tools/lore/*-consume.mjs` files and `w1-15-r4-deletefix.mjs` all do the same `fs.cpSync(ROOT/game,
...)` today and are candidates for the same swap; converting them was out of scope for this pass —
say so plainly rather than claim it happened.
