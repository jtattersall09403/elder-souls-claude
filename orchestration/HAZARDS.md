# Operational hazards on this box — read before you touch git, the disk, or a GPU pod

Written and owned by the orchestrator. Each entry cost somebody real work. Where an entry names a
mistake, the orchestrator made it unless stated otherwise.

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

**The technique that survives it — git plumbing through a temporary index, which never takes
`.git/index.lock`:**

```sh
git fetch origin <branch>
export GIT_INDEX_FILE=/tmp/idx-$$
git read-tree origin/<branch>
git add -A
TREE=$(git write-tree); P=$(git rev-parse origin/<branch>)
C=$(git commit-tree "$TREE" -p "$P" -m "…")
unset GIT_INDEX_FILE
git push origin "$C":<branch>
```

**Then verify against the remote blob, not local state:**
`git show origin/<branch>:<path> | grep -c '<a string you know you wrote>'`.

### 2a. Never create a file as a blob without also writing it to the working tree

The orchestrator created this very file by hashing `/tmp` content straight into a temporary index and
pushing it. It landed and verified. Then the **next** routine `git add -A` — run from a working tree
that had never contained the file — staged its **deletion**, and the file vanished from the remote
one commit later. If you use the plumbing route for a *new* file, write it to disk as well, or the
next bulk stage will delete it for you.

### 2c. The actual fix: dispatch file-writing agents into their own worktree

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

**The guard: stage a path only when the working-tree file is newer than origin's tip commit.**

```sh
P=$(git rev-parse origin/<branch>); PT=$(git log -1 --format=%ct "$P")
export GIT_INDEX_FILE=/tmp/idx-$$; git read-tree "$P"
while IFS= read -r f; do
  [ -f "$f" ] || continue
  [ "$(stat -c %Y "$f")" -gt "$PT" ] && git add -- "$f"     # else it is stale: skip
done < <(git diff --name-only "$P"; git ls-files --others --exclude-standard)
```

First run of the guard: **0 files genuinely newer, 4 stale** — i.e. the unguarded routine would have
reverted four files that instant. Assume it has been doing so all along.

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
