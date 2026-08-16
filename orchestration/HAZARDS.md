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

## 26. `node --check` PASSES A FILE THAT CANNOT RUN — a backtick in a comment inside a shader template literal killed every browser tool on the branch

**Done by me, the F7 r4 builder, 2026-08-16, and caught by a sibling doing branch repair rather than
by any check of mine.** I added seven lines of explanatory comment inside `water.js`'s
`onBeforeCompile` injection. That injection is a **JavaScript template literal containing GLSL**,
and this repo's comment style quotes every identifier in backticks. Each of those backticks
**terminated the template literal**. What came after it was re-parsed as JavaScript, the string ran
to a later backtick, `water.js` still **parsed**, and the module was silently wrong from line 267 on.

**The symptom does not point at the cause.** `window.__HARNESS never appeared` after 60 s, one
`pageerror` reading `missing ) after argument list`, empty stack, no filename. That is the same
message every tool on the branch got, so **every browser-driven measurement on the branch was dead**
until a sibling bisected it — F7's, and everyone else's.

**The trap is the check that passed.** Both of these exited 0 on the broken file:

```sh
node --check game/src/render/water.js     # exit 0
node -e "import('./game/src/render/water.js')"   # error is about THREE, not the file
```

`--check` answers *"is this parseable"*, and it was. It does not answer *"is the string I meant
still one string"*. This is §14c's shape again — **a success line counts what the tool received, not
what you meant** — and §18's — an empty run reporting no errors.

**The rule, and it costs nothing:** in any file that builds shader source in a template literal,
**comments inside the literal use apostrophes or plain words, never backticks**, and after editing
one you check the literal is still whole *before* launching a browser:

```sh
# count backticks between the injection's opening and closing lines — must be exactly 2 per literal
awk 'NR>=A && NR<=B' <file> | grep -o '`' | wc -l
```

**Generalise it past backticks.** Any language-in-a-string — GLSL in JS, SQL in Python, HTML in a
tagged literal — turns the host language's *quoting* characters into landmines inside prose that
looks inert. The reviewer's eye skips comments; the parser does not. And when a whole-branch symptom
appears right after a one-file comment edit, **suspect the edit that "couldn't matter" first**.

## 25. A MASK DERIVED PER ARM LETS THE THING UNDER TEST CHOOSE THE PIXELS IT IS SCORED ON

**Found 2026-08-16 by the F7 r3 critic, which called it the most reusable thing in its round and did
not have room to write it up. Writing it here because it is not about water.**

Any comparison that says *"measure X over the region where Y"* has to build the region somehow. If it
builds it **separately for each arm**, then an arm that changes `Y` **changes its own denominator, its
own boundary, and every distance measured from that boundary.** The result is not a comparison; each
arm is scored on a different set of pixels.

**Concretely:** `f7-r3-sweep.mjs` derives a water mask per arm, and round 3 was the first F7 round to
touch water **alpha** — so the fix moved its own mask, and `gradient_width_px` is a distance transform
*of that mask*. Measured consequences on **one unchanged frame pair**, per-arm mask against a single
pinned mask:

- a `FresnelDelta` **sign flip** — `+0.148 → −0.145` becomes `+0.148 → +0.161`
- a **spurious `ShoreDelta` pass** — `0.024 → 0.093` becomes `0.024 → 0.021`

**It cuts both ways**, which is why it is not detectable by whether the answer flatters you. Here the
confound happened to have the *opposite* sign to the headline, so the k-ordering survived re-running
every arm over one pinned mask at thresholds 4/6/10 — but the **width monotonicity did not**, and that
half of the headline was withdrawn.

**The rule: pin the mask.** Derive it once, from one arm or from geometry, and score **both** arms
through it. If the mask must move, that is a finding to report, not a nuisance to normalise away —
and say which arm it came from. This is **S63's family in the spatial domain**: never normalise, mask
or bound by a quantity the fix is expected to change. The same trap waits for any AO/occlusion mask, any
"lit subset" (S60's clause (a) repair is derived from a shadow-map ablation for exactly this reason),
any silhouette or coverage measure, and any density metric scoped to a panel the build may resize.

## 24. `RI-VIS04` §3-D2's shadow ablation is ~10× cheaper with a uniform — and the BASE frame you subtract matters more than which form you use

**Claimed by the `F4` round-2 builder, re-derived independently by its critic, 2026-08-16, from that
round's own banked frames.** `RI-VIS04` §3-D2 specifies `renderer.shadowMap.enabled = false` with every
material marked `needsUpdate` — correct, because the flag is compiled into the program, and therefore a
**full-scene shader recompile per arm**. Measured on this box under SwiftShader that is roughly **five
minutes per swept hour**; F4 r2's first thirteen-hour diagnosis managed one hour in five minutes and was
killed by its own timeout with nothing written.

**The substitute.** `game/vendor/three/three.core.js` is `REVISION = '180'`, and r180 carries
`LightShadow.intensity`, which is a **uniform**: the shader computes
`shadowValue = 1 - intensity * (1 - shadowValue)`, so `sunLight.shadow.intensity = 0` means "fully lit"
with **no program change**.

**Not assumed — measured at two hours, and reproduced on a second implementation:**

| | 08:00 | 13:00 |
|---|---:|---:|
| the two ablation **forms** differ, mean \|Δ\|luma | **0.3368** | **0.1365** |
| the **same configuration** re-captured differs | **1.0918** | **0.4460** |
| ratio | **0.31** | **0.31** |
| `cast_shadow_area@tau8`, `shadowMap` form | 0.10364 | 0.13763 |
| `cast_shadow_area@tau8`, uniform form | 0.10431 | 0.13801 |

**The stronger statement, which the round did not make and which is the reusable part: swap which
`base` frame you subtract and the answer moves FOUR TIMES as much as swapping the ablation form.**
At 08:00 the `shadowMap` form's area@tau8 goes 0.10364 → **0.10630** when measured against
`base_recheck` instead of `base` — a shift of 0.00266, against 0.00067 between the two forms. So the
equivalence is not marginal: it sits comfortably inside an error every §3-D2 measurement already
carries and nobody was reporting.

**Bounded, and the bound is the round's own.** This licenses the cheap form for **area fractions at
daylight exteriors**. It does **not** license it for anything that turns on individual pixels — the two
forms are **not** byte-identical (`frames_identical: false`), and it has been checked at two hours, one
pose, one renderer class. **And restore it explicitly:** `shadow.intensity` is a uniform, so it survives
a light-intensity restore and will leak silently into every later arm of the same run unless the
harness's `__restore()` sets it back to 1. That bug was written and caught in this critic's own tool
before it ran.

Evidence: `corpus/90-verdicts/wave1/artifacts/W1-F4-r2/metrics/ablation-equivalence.json` (the round's)
and `corpus/90-verdicts/wave1/artifacts/W1-F4-r2-critic/metrics/ablation-form-equivalence-recheck.json`
(the recheck).

## 26. `R.playerMesh.position` is (0, 0, 0) and always will be. Do NOT derive a scene→world offset from it — the frames already coincide.

*(Renumbered from 24 by the orchestrator on 2026-08-16: the F4 r2 critic filed its own §24 in the same
hour and the F7 r3 finding landed as §25. **Three agents have now collided on a section number in this
append-only file in two days.** Before you pick one, run `grep -n "^## [0-9]" orchestration/HAZARDS.md`
and take the next free integer — and if a verdict already cites your old number, say so where you
renumber, as here.)*

**Found 2026-08-16 by the F10 r11 critic, and it cost F10 r11 its pictures and produced a harness
"defect" that does not exist.** The round's first admission is that four camera attempts failed, and
it filed the cause as: *"`__HARNESS.camera` and `teleport` speak the SIMULATION's frame and a
settlement's people are DRAWN in the cell's, with no method joining the two"*, asking ring 0 for a new
harness method. **There is no such mismatch. Measured this turn at the Lilmoth stand:**

| quantity | reading |
|---|---|
| drawn NPC world **x** − sim **x**, over 60 of 60 matched pairs | min **0.000000**, max **0.000000** |
| drawn NPC world **z** − sim **z** | min **0.000000**, max **0.000000** |
| `renderer.province.group.position` / `scene.position` | `(0,0,0)` / `(0,0,0)` |
| `three.camera.position` vs `sim.camera.pos` | identical to every printed digit |

`render/renderer.js:syncNPCs` writes `drawPos = [n.pos[0], groundResolver(n.pos[0], n.pos[2]),
n.pos[2]]` — **the simulation's own x and z**, with only the height replaced. `__HARNESS.camera({pos,
look})` in world metres has always pointed at the drawn crowd.

**The one object that lies, and why.** `R.playerMesh.position` reads **(0, 0, 0)**. It is the only
actor in the scene whose group is not at its world position, because the player is posed by
`poseFromRig`, which writes bone **world** matrices directly and never moves the group — while every
NPC is posed by `poseStatic`, which sets `group.position`. In the round's own artifact the player row
records `group_xz: [0, 0]` on the same page as a `root` bone at world **(2798.2, 2.66, 5047)**. Taking
the offset off that one object yields `OFF = (2785.6, 44.378, 5047)` — a pure restatement of the
teleport target — and the two frames that survived landed back over Lilmoth **only because that offset
cancelled** against a subject cluster the tool had placed at ≈(0.3, 0.9).

**Read a bone, not the group.** `S.bones[i].matrixWorld` is correct for every actor on both paths.
If you want an actor's drawn position, that is where it is.

**And the cluster at the origin is a second trap wearing the first one's clothes.** At the Lilmoth
stand `sim.npcs` holds 60 records and the renderer builds 60 meshes, but **29 of them are
`mesh.visible === false`, and all 29 sit within 5 m of the world origin on ground y ≈ −41 m**, i.e.
under the Topal. Four more are visible at ≈(4906, −594) on ground −33 m, outside the province's own
x extent. **A "densest knot of the crowd" computed over `npc:` meshes finds that heap, not the town** —
the round's own report says `people_within_9m: 29` and that is the tell. Filter on `o.visible` and on
distance to the stand before you point anything at a crowd, and **do not use a raw `npc:` mesh count as
a census denominator**: two consecutive F10 verdicts have reported "60 drawn NPCs" at a stand where the
drawn-and-in-settlement population is **27**.

## 23. The container took four agents at 20:03. Quarantine the orphans on a side ref — do NOT bank them.

**Third restart in one day, and it killed a full fleet mid-round: T4 r7, F10 r11, F4 r2 and the F7 r2
critic.** Symptom, and it is worth knowing because nothing announces it: `ListAgents` returns **"No
reachable agents"** and no file in the working tree has been touched for hours, while `git status`
still shows their edits. The agents are gone; their unbanked work is not.

**What was lost and what survived.** Only one of the four had banked anything — T4 r7's `b9b48766`.
The other three had **~1,500 lines between them and not one commit**: `actor.js` +302, `renderer.js`
+39, `swing.js` +29, `chrome.js` +28, three new tools of 208/423/426 lines, and three evidence
directories. **Bank often is not advice, it is the whole difference between those two outcomes.**

**What to do with the orphans, and what NOT to do.** Do **not** `land` them onto the working branch.
Three hundred unverified lines in `actor.js` become `HEAD`'s claim the moment you do, every sibling
that starts next inherits them as though they were finished, and a delete-the-fix arm taken against
that `HEAD` is measuring somebody's abandoned half-thought (§12, §14). Equally, do not throw them
away: they are real work.

**Quarantine them on a side ref instead** — recoverable, pushed, and structurally incapable of being
mistaken for a delivery:

```sh
git add -A -- game/src tools corpus/90-verdicts/wave1/artifacts
ORPHAN=$(git commit-tree $(git write-tree) -p HEAD -m "QUARANTINE <date> — <what died>")
git update-ref refs/orphaned/<date>-container-restart "$ORPHAN"
git reset --mixed HEAD && git checkout -- . && git clean -f -d <the paths>
git push origin "$ORPHAN":refs/heads/orphaned/<date>-container-restart
```

Then **re-dispatch each round with a pointer to the quarantine and one instruction: treat every line
of it as unverified.** There is no status file saying what it intended, no measurement, and no note of
which parts worked — so a successor that trusts it inherits an unchecked premise and will faithfully
build on sand. Recovering a single file is `git show <orphan>:<path> > <path>`.

**The asymmetry that decides this:** a quarantined orphan costs one command to recover and can never
lie to anyone; an orphan banked into `HEAD` costs nothing to recover and lies to every agent that
starts after it.

## 22. A CONTROL CLONE THAT RUNS THE MAIN TREE'S TOOL IS NOT A CONTROL. It measures the main tree.

**Found 2026-08-15 by the T4 r6 critic, and it invalidates a whole class of arms across this repo, not
one round.** A builder reported four independent arms — a frozen clone, a reverted clone, a `git
worktree` at a pinned commit, and the live tree — all returning the same number to four decimals, and
concluded the instrument was non-deterministic. **Four arms agreeing to four decimals was the
signature of four runs of the same tree.**

**The mechanism, and it is two lines:**

```js
// tools/lib/cli.mjs
export const HERE      = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');   // ← the SCRIPT's location, not the CWD
```

`browser.mjs` then serves `REPO_ROOT/game`. So **copying the game to a clone and running
`node tools/whatever.mjs` from the main tree serves the MAIN TREE's game.** The clone is never
opened. `grep -rl "lib/cli.mjs" tools/ | wc -l` returns **458**, so this is the default behaviour of
essentially every measurement tool here.

**An arm is isolated only if it is run through the CLONE'S OWN copy of the tool** — `node
<clone>/tools/....mjs`, not `node tools/....mjs --entry <clone>`.

**The discriminator, proved both ways rather than argued:** a genuine control clone records
`commit: "unknown"` in its manifest; a genuine worktree records the **pinned sha**. The builder's four
manifests each recorded **a live sibling's HEAD, timestamped to the minute the arm ran** — four
different shas, because siblings were landing while it measured. **Read the `commit` field of every
arm's manifest before believing any before/after pair.** If it names a commit you did not pin, the arm
ran somewhere you did not intend.

**What it cost here:** a real three-worktree comparison then showed round 6's own change moved the
container's density by **−0.0079**, the entire distance from a pass to a hard fail — where the builder
had reported *"exactly 0.0000"*. **The sign was inverted, not the magnitude**, and the conclusion drawn
from it ("the instrument is unreliable, distrust these scores") propagated as far as `STATUS.md`
before the critic caught it. The instrument was deterministic all along: same PNG in, same number out,
verified by recomputing both rounds' filed figures from their stored captures.

**This is §11 and §12's failure with the arms swapped.** §11: a shared tree moves under your
experiment. §12: `HEAD` is not your baseline. §22: **your baseline was never loaded.** All three end
with a delete-the-fix that proves nothing, and this one is the hardest to see, because it produces
*agreement* — which reads as rigour.

## 20. Four traps around `game/data/combat/clips.json` and its instruments — a generator that reverts a round, a `--pose` that silently means something else, a shared tree that is mid-edit under you, and a landmine that was filed with the wrong mechanism (20a–20c: F10 r9 critic; 20d: F10 r10 critic, 2026-08-15)

**20a. `tools/harness/anim-author.mjs` holds a SECOND COPY of the idle stance, and `--write` used to
revert the round that was in flight.** The generator declares its own `IDLE` / `IDLE_LOOP` constants
(~line 113) and regenerates `idle_loop` wholesale, while the shipped stance is hand-authored in
`game/data/combat/clips.json`. **Verified on a copy, not asserted**: `git archive HEAD` into a scratch
tree, then `node tools/harness/anim-author.mjs --only thrust --out <scratch>` with the generator at
`741bafb7^` (before round 9's sync) —

| `thrust` track | shipped | PRE-sync generator | HEAD generator |
|---|---|---|---|
| `pelvis.rz` | `[[0,5],[0.3,0],[2.7,0],[3,5]]` | **null** | `[[0,5],[0.3,0],[2.7,0],[3,5]]` |
| `spine_00 / spine_02 / thigh_l / thigh_r / neck .rz` | present | **null** | present |
| `idle_loop.pelvis.rz` | `[[0,0],[1.5,1.2],[3,0]]` | **absent** | present |

So the landmine was real: `--write` before `741bafb7` would have stripped the termination-rule
endpoints from **every re-solved archetype** — re-opening the 15× weapon-socket snap regression that
round had just closed — and deleted the weight-shift curve `RI-VIS10` C3's "the two frames differ" arm
depends on. Round 9 fixed it and said so.

**It is not fully disarmed and the round said that too.** At HEAD, `idle_ready` and the termination
endpoints round-trip exactly; `idle_loop` does **not** — the generator still writes rx amplitudes
`0.45 / 0.55 / 0.5 / 0.8` where the shipped file carries `0.68 / 0.82 / 0.75 / 1.2`, a ~34% shrink of
the breathing, hand-tuned by somebody before round 9. **`anim-author.mjs --write` is still not safe to
run blind.** Before running it: `git archive HEAD` to a scratch tree, run `--out` there, and diff
`idle_ready` and `idle_loop` against the shipped file.

**20b. A `--pose` flag that falls back to `Object.values(...)[0]` names one archetype and measures
another — but at phase 0 it is benign, and the difference matters.** `tools/visual/f10-silhouette.mjs`
line 109 and `tools/visual/f10-r8-torso.mjs` line 277 both read
`clips.archetypes[opts.pose] || Object.values(clips.archetypes)[0]`, and both default to
`pose: 'idle'`. **`clips.json` has no archetype called `idle`** — the names are `idle_ready` and
`idle_loop` — and `Object.keys(archetypes)[0]` is **`cut_diagonal`**. So the banner says `idle@0` and
the lookup lands on an attack. Round 9 recorded this against `f10-r8-torso.mjs` as *"r8's headline
trunk numbers were measured mid-swing"*.

**Half of that is wrong, and it was worth checking.** Evaluated on the built rig, `cut_diagonal@0` is
**byte-identical to `idle_ready@0`** on all 20 bones, in both the pre-round and post-round clip blobs —
every non-looping archetype begins *from* the stand, which is what the termination rule is for. At
`phase 0` the fallback measures the idle after all. It diverges the moment the phase is non-zero
(`cut_diagonal@1.5` differs on 18 of 20 bones). **So: the trap is real and one key rename from
biting, but do not assume a past number was taken mid-swing — check the phase the tool used.**

**20d. `anim-author --write` DOES destroy `root_offset` endpoints — but not for the reason round 10
filed, and the remedy it proposed would not have worked.** `orchestration/status/W1-F10-r10.json`
records the landmine as: *"`swing.js:311-324` … rounds through `r2()` — **two decimal places, so the
generator cannot express a 7.96 mm offset at all; the smallest value it can emit is 10 mm** … fixing
the generator needs a precision change, not a value change."* **Both halves are wrong, and the
conclusion is right anyway.**

- `game/src/combat/swing.js:64` reads `function r2(x) { return Math.round(x * 1000) / 1000; }` —
  **three** decimal places, not two. Its smallest non-zero step is **1 mm**, and `-0.00796` would
  survive rounding as `-0.008`, an error of **0.04 mm**. The name is the trap: `r2` rounds to 3 dp.
- The endpoints are destroyed by `swing.js:311-318`, where `rootY` is built from **hard-coded
  literals** — `[0.0, 0.0]` at phase 0 and `[3.0, -0.01 + cr * 0.25]` at phase 3 — with no stance
  term in the expression at all. **A precision change cannot fix that; only a value change can.**

**Verified on a copy, per 20a's own method**, not asserted: `git archive HEAD` to a scratch tree, then
`node tools/harness/anim-author.mjs --only thrust --out <scratch>`, and diff `root_offset.y` against
the shipped file —

| archetype | shipped | generated by HEAD's `anim-author --only thrust` |
|---|---|---|
| `thrust` | `[[0,-0.00796],…,[3,-0.00796]]` | **`[[0,0],…,[3,0]]`** |
| the other five r10 archetypes | `[[0,-0.00796],…,[3,-0.00796]]` | untouched by `--only thrust`; a full `--write` regenerates them the same way |

So the round's warning stands and its urgency is right — a `--write` re-opens the attack/idle vertical
step that r10 measured at `snapIn 0.0000 → 0.0080 m` on all fourteen weapon moves. **The fix is to add
the stance offset to `rootY`'s phase-0 and phase-3 entries**, not to widen `r2`.

**20a is still live and was re-derived this turn, not carried:** the same run writes `idle_loop`
`spine_00.rx` amplitude `0.68 → 0.45` and `neck.rx` `0.75 → 0.5`, a 33.8% / 33.3% shrink of the
hand-tuned breathing. `anim-author.mjs --write` remains unsafe to run blind.

**20c. Measure off `git archive HEAD`, not off the shared working tree.** At 17:52 on 2026-08-15 a
sibling had `game/src/render/water.js` half-written on disk: `node --check` on the working copy threw
`SyntaxError: missing ) after argument list`, while the same file at `HEAD` checked clean. Every tool
that imports `game/src/render/actor.js` transitively imports it, so three offline instruments died on
a defect that belonged to nobody's experiment. `--revision HEAD` already protects a **paid** run
(§15a); nothing protects a **local** one. `git archive HEAD | tar -x -C <scratch>` costs 2.5 GB and
about four seconds and makes the arms of an experiment stop moving.

## 5a. `reports/runpod-gpu/runs` is the top disk consumer — prune it, nothing else comes close

Measured 2026-08-15 at **96% full, 1.6 GB free**, with four agents live and two of them capturing:

| | size |
|---|---|
| `reports/runpod-gpu/runs` | **4.6 GB** |
| `.git` | 2.1 GB |
| `corpus` | 1.5 GB |
| everything else | under 500 MB |

Each paid GPU run leaves **100–150 MB** of raw frames behind, and nothing ever removes them. Deleting
the 46 run directories older than 8 hours reclaimed **3.2 GB** and took the box from 96% to 88%.

**The retention rule: keep GPU run directories for 8 hours, delete older ones.** Eight hours is chosen
so no live agent can be mid-run — a long capture is ~10 minutes — while still leaving same-session runs
inspectable.

**Two things that make this safe, and one that makes it necessary:**

- `reports/` is **gitignored**, so nothing there is on the branch and nothing is lost from history.
- Verdicts do cite paths under `reports/runpod-gpu/` — but per §9 those citations were **already
  unreachable off this box**, because evidence under `reports/` never lands. Cited evidence belongs in
  `corpus/90-verdicts/<wave>/artifacts/<piece>/`, and the citations that matter already point there.
- Disk exhaustion here is not a warning, it is a **silent failure** (§5): writes fail while deletes
  still succeed, and an agent reads that as its own code being broken.

**Check `df -h .` before starting a capture sweep**, and prune before you rent a Pod rather than after
a run has failed for a reason that looks like anything but disk.

## 14c. `--paths` is ONE comma-separated argument — space-separating it banked a quarter of the work

**Caught 2026-08-15 by reading the commit, not by any output.** This was run:

```sh
node tools/land.mjs "headline" --paths orchestration/HAZARDS.md tools/world/w1-04-r3-collision.mjs \
  reports/w1-04-r3-exterior-offline.json reports/blind/protocol-a-w1-r2-SEALED-KEY
```

`val('paths')` reads **only `argv[i + 1]`**, so one path landed. The other three fell through to the
bare-word collector and became **body paragraphs of the commit message** — they are legible in
`3373be81`'s message, describing files the commit does not contain. And `land` printed
`1 path(s) ... verified 1 path(s)` and exited **0**, because one path is exactly what it was given
and it verified that one honestly. Nothing lied; the tool answered a different question from the one
asked.

**Correct:** `--paths a,b,c` — commas, no spaces.

**Guarded, one-sided (§0b):** `land` now refuses when a message word is also an existing path in the
repo, prints the comma-joined command you meant, and exits 2. Three arms, required to disagree:
the space-separated form refuses; the comma form proceeds; a genuine multi-paragraph message with no
stray path proceeds. The guard can only ever *stop* a bank, so it cannot manufacture one.

**The general shape is worth more than the fix.** A success line counts what the tool *received*, not
what you *meant* — the same distance between the question asked and the question answered as §9
(evidence added to an index that is then thrown away) and §18 (an empty run reported as no errors).
When a bank prints a smaller number than the number of things you handed it, that gap is the whole
signal, and there is no other one.

## 14b. `land` cannot untrack a file that still exists on disk once you gitignore it

Small, and it will cost you three attempts if you do not know it. Found 2026-08-15 cleaning up a `tmp/`
tree that a whole-tree bank had swept into the repo.

The sequence that does **not** work:

```
echo 'tmp/' >> .gitignore
git rm -r --cached tmp/
node tools/land.mjs "..." --paths tmp --allow-deletions      # lands nothing
```

`land` builds its own temporary index from the **working tree**. `git add` skips ignored paths, so the
newly-ignored files are simply not added — and `land` will not carry a *deletion* for a file that is
sitting right there on disk, which is the §2f guard working exactly as designed (a wrongly-deleted file
is an agent's afternoon; a wrongly-kept one is a dead byte). Your `git rm --cached` staging is
irrelevant to it, because it never touches the real index.

**So the two effects separate:** the `.gitignore` lands and stops the tree growing, and the
already-tracked files stay tracked. **That is an acceptable outcome — take it.** 660 KB of stale scratch
on the branch is harmless; hand-rolling a commit to tidy it is the thing that has destroyed work here
repeatedly, and no cosmetic tidy is worth that risk.

If it genuinely must go, delete the files from disk first *and be certain no live agent is using them* —
several were mid-run when this was found, which is the other reason to just leave it.

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

## 21. The stop hook tells you to commit the fleet's in-flight files. DO NOT. It is asking for §14's failure.

*(Renumbered from 20 on 2026-08-15: the F10 r9 critic filed its own §20 in the same hour, and its
verdict cites §20a/§20b/§20c by name, so that number belongs to it. Two agents numbering sections in
one append-only file is a collision this file will keep having — check the existing headings before
you pick a number.)*

**Standing, seen three times in one hour on 2026-08-15.** The session's stop hook checks `git status`
and, whenever the tree is dirty, prints:

> *There are uncommitted changes in the repository. Please commit and push these changes to the
> remote branch.*

It is **correct that the tree is dirty and wrong about what to do**, and the gap between those two is
the whole hazard. With two to four agents running, a dirty tree is the *normal* state: those files are
being written this minute. Doing what the hook says means banking a sibling's half-written edit —
§14 exactly, and the mechanism that once carried an in-flight edit into `HEAD` and turned a
delete-the-fix control green.

**The check that settles it in one command**, and it is evidence rather than assumption:

```sh
git status --porcelain | awk '{print $NF}' | xargs -I{} ls -ld --time-style=+%H:%M:%S {}; date +%H:%M:%S
```

Three runs of it today returned files modified **11 seconds**, **53 seconds** and **under 5 minutes**
before the check. A file a live agent touched a minute ago is not yours under any reading.

**So: answer the hook by verifying, not by committing.** Land your own paths with
`land.mjs --paths a,b,c` (commas — §14c), leave everything else, and say in the reply whose it is and
how you know. The hook will fire again next turn; that is the correct state of a repo with a working
fleet, not a backlog. **The one thing never to do is the thing it asks for.**

## 19. The branch the session was told to deliver on was 1,439 commits behind the branch we work on

**Found 2026-08-15 by a builder reading its own brief, not by any check.** The F10 round-9 brief named
`claude/morrowind-souls-threejs-game-mou39v` as the branch to develop on. The checked-out branch is
`codex/wave1-build-experiment`, and the builder said so in the first line of its report rather than
quietly obeying either one.

**Measured before doing anything about it:**

```sh
git rev-list --left-right --count \
  origin/claude/morrowind-souls-threejs-game-mou39v...origin/codex/wave1-build-experiment
#   0    1439
git merge-base --is-ancestor origin/claude/... origin/codex/wave1-build-experiment   # → true
```

**Zero commits on one side, 1,439 on the other, and a strict-ancestor relationship** — the two never
diverged. `claude/…` was a stale pointer at an old merge *from* `codex/wave1-build-experiment`, last
moved 2026-08-11, and its final commit is literally a merge of the branch it is now behind.

**So nothing was lost and nothing conflicted**, and the fix is a fast-forward, which git will refuse
if it is anything else:

```sh
git push origin HEAD:refs/heads/claude/morrowind-souls-threejs-game-mou39v
#   509941a9..0a67808f
```

**Two things worth keeping.** First, **the working tree was NOT switched.** Agents were mid-run,
`land.mjs` resolves its branch from the checked-out upstream, and moving a shared tree under running
agents is §2d and §11's failure. Mirroring the ref costs one push and disturbs nobody. Second, and
more useful: **a stale branch pointer is silent in exactly the way that matters** — every bank all
session reported `verified … against the remote blob` and every one of them was true, because they
verified against the branch they pushed to. A tool that checks its own push cannot notice it is
pushing somewhere nobody is reading. **Re-run the fast-forward whenever the work needs to be visible
on the named branch; there is no mechanism doing it.**

## 18. A report tool that writes in a `finally` block destroys the previous run when THIS run fails

**Caught 2026-08-15 by the stop hook, not by any check we wrote.** `reports/w1-04-r3-collision.json`
was sitting uncommitted in the working tree, **1,425 lines shorter than the version in `HEAD`**. Its
entire content was:

```json
{ "tool": "tools/world/w1-04-r3-collision.mjs", "commit": null,
  "sections": {}, "errors": [], "fatal": null }
```

**Zero sections, zero errors, no fatal — and the process exited 0.** A run that measured nothing is
byte-for-byte indistinguishable from a run that found nothing wrong, and it had already overwritten
the real measurement by the time anyone could read it. Restored with `git checkout --`; nothing was
lost, purely because the deletion had not yet been committed.

**The mechanism generalises, and it is not one file. Counted 2026-08-15:**

```sh
grep -rlz --include=*.mjs -P '\}\s*finally\s*\{[^}]*writeFileSync' tools/ | tr '\0' '\n' | grep -c .
```

returns **31** — including `f10-r7-appearance.mjs` and `f10-r7-ground-truth.mjs`, which are the tools
the character rounds shoot their evidence with. It is a shape we like, for a good reason:

```js
try   { /* fill out.sections, section by section */ }
finally { fs.writeFileSync(reportPath, JSON.stringify(out)); await B.close(); }
```

The `finally` exists so a crashed run still leaves a partial report — which is right. But it also
means **a run that dies on line 1 writes an empty report over a complete one**, and if it dies before
`fatal` is set (a browser that never launches under contention, an import that throws, a `pkill` from
a sibling — see §10) it writes `errors: []` too. The exit code is computed from `fatal || errors.length`,
so an empty run exits **0**.

**The fix, and both halves are one-sided on purpose (§0b):** refuse to overwrite an existing report
with a zero-section run, diverting it to `<report>.EMPTY-RUN-REFUSED.json` so the failure is still
readable; and treat a zero-section run as fatal so it cannot exit 0. Landed on
`tools/world/w1-04-r3-collision.mjs`. **A guard that only ever refuses to destroy evidence cannot
itself manufacture a pass** — which is why it is safe to copy into any sibling tool with the same
`finally`, and it should be.

**This is §9 and §17's failure from a third direction.** §9: cited evidence that never reaches the
remote. §17: cited evidence overwritten by a later round. §18: cited evidence overwritten by a run
that *failed*, reporting success. All three end with a document pointing at something that is not what
it was written against.

## 17. A filed verdict's artefacts are immutable — reused capture tools hard-code their output path

**Caught 2026-08-15, in flight.** A builder ran a capture and four files under
`corpus/90-verdicts/wave1/artifacts/T4-r2/` changed — a *previous round's* evidence, for a verdict
already filed and landed.

**Why it matters:** a verdict's cited artefacts are the record of what was judged. Overwrite them and
the verdict silently points at images it was never written against. It becomes an unfalsifiable claim,
which is the same harm as evidence that never lands (§9) — arriving from the opposite direction.

**The cause is almost never intent. It is a hard-coded output path in a reused tool.** A capture script
written for round 2 writes to `artifacts/T4-r2/` *by construction*, so running it in round 5 re-points at
round 2's directory. Same family as `f10-r3-materials.mjs`, which **runs its entire capture on import**
so a Pod told to run a different tool ran that one and recorded the wrong tool name in its manifest.

**Three rules:**

1. **Never write into another round's artefact directory.** Yours is `artifacts/<your-piece-id>/`.
2. **Check the tool's output path before you run it**, especially one you inherited. Parameterise it
   rather than working around it, and say so, or the next round inherits the same trap.
3. **If you have already overwritten one, `git checkout` it** — landed artefacts are on the remote, so
   restoring costs nothing. Do not try to reconstruct it by re-running; you will produce a *different*
   image and the verdict will still be citing something it never saw.

**The general shape, worth carrying:** an inherited tool carries its author's assumptions in its
constants. This project has now been bitten by hard-coded output paths, hard-coded entry points
(a gate that silently ignored `--entry`), hard-coded dates (screenshot filenames stamped with the day
the tool was written), and a hard-coded renderer verdict (`getPerfStats()._unmeasurable` asserting
"this container is SwiftShader" on a run reporting an RTX A4500). **Read the constants before you trust
the output.**

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

## 13. DO NOT USE `Monitor` OR A BACKGROUND WAIT AS YOUR LAST ACTION. This is a prohibition, not advice.

**Six agents have now ended a turn in a wait state on 2026-08-15 alone.** Two of them did it *after* the
briefing told them not to, and one did it after a direct message telling it to stop. **So the rule has
been rewritten as a prohibition, because the advisory version demonstrably does not work.**

> **You may not end a turn waiting on a `Monitor`, a background task, or a poll loop. If a result has
> not arrived by the time you would otherwise stop, land what you have and record the missing piece as
> `"unmeasured, because X"`.**

**NAMING THE TOOLS, because naming the behaviour has failed three times.** Seven agents stalled on
2026-08-15; **three of them did it after their brief told them not to**, and one after the rule was
promoted to a prohibition. So:

> **Do not call `Monitor`. Do not pass `run_in_background`. Do not write a poll loop.**
> **Block in the foreground with an explicit ceiling instead:**
>
> ```
> timeout 600 node tools/whatever.mjs 2>&1 | tail -40
> ```

That waits up to ten minutes *inside your turn*, returns what it got, and **a timeout is itself a
result** — it means the run is too slow to belong to this piece, which is worth writing down. If you
need longer, write to a file, do other work, and read the file later in the same turn.

**Do not pipe a still-running capture through `| tail`** — it buffers the whole pipeline and a healthy
run looks hung. Two capture runs were killed that way at ~40 minutes each.

**Why this keeps happening, so you can catch it in yourself:** it is not laziness, it is
conscientiousness. The agent wants the verification before claiming the result. The correction is the
priority — **the deliverable is almost always the fix, not the evidence.** A repaired thing landed and
honestly labelled *"verification not run"* beats a perfect verification that never arrives, because
meanwhile the broken thing is in the game.

**Why agents do it, and why the instinct is wrong.** It is not laziness — it is conscientiousness. The
agent wants the verification before claiming the result. But the deliverable is almost always the
*fix*, not the evidence: a repaired probe landed and honestly labelled *"verification not run"* is worth
more today than a perfect verification that never arrives, because the unrepaired probe is meanwhile
reporting a fixed build as broken. **An honest gap is cheap. A blocked agent produces nothing at all.**

**Three practical replacements, in order of preference:**

1. **Run it in the foreground with a timeout.** `timeout 240 node tools/whatever.mjs`. If it does not
   finish, you have your answer: it is too slow to be part of this piece, which is itself a finding.
2. **Write to a file and read the file later in the same turn.** Never pipe a long capture through
   `| tail` — that buffers the whole pipeline and makes a healthy run look hung (two capture runs were
   killed that way, ~40 minutes each).
3. **Take a cheaper proxy and say it is a proxy.**

**And know what is actually slow here before you blame your code:** `gl.readPixels` was measured at
**10–20 seconds per call** under load. A dense frame-by-frame walk is expensive by nature, not broken.

**Suspect the monitor before the run.** Several of these stalls were on runs that had *already
finished* — the notification was stale. One agent's own `pgrep` loop was matching **its own waiter
shells**, so the condition could never clear: a check contaminated by the thing doing the checking,
which is §0's failure family wearing different clothes.

**Disarm every waiter you arm, by PID, as your last act.** A background waiter left armed keeps firing
after its agent completes and **wakes the agent again each time**. Measured: one agent's final report
was delivered eight times and its total went from ~500k to **539k tokens and 381 tool calls**, every one
of them after the work was landed and verified. `TaskStop` reports the agent as `completed`, so the
orchestrator **cannot** kill them — only you can, and only before you stop.

### 13-old. The original advisory wording, kept because its incidents are the evidence


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
