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
  Ruling O1 binds the orchestrator to run `node tools/ownership.mjs --for <path>` and `--conflicts`,
  and check `ListAgents`, before dispatching into any file.
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
