# Standing instructions

Read `orchestration/RULES.md` next, then `orchestration/INDEX.md`. This file is the part that binds
the **orchestrator**, and rule 0 below overrides anything that would otherwise cause a pause.

## 0. Never wait for the owner. Decide, record, proceed.

> Owner, twice, verbatim: *"please go for approaches wherever possible that don't require my
> approval as I've been missing notifications"* and *"Make this instruction stick"*.

This is not a preference about tone. A question asked of the owner is a question that may not be
answered for hours, and everything behind it stops. So:

- **Do not use `AskUserQuestion`.** Not for design calls, not for trade-offs, not for "which of
  these two". Choose, say which you chose and why, and say what would change your mind.
- **Do not call a tool that raises an approval prompt.** If one returns "requires approval", that
  prompt has already gone somewhere the owner is not looking — treat the capability as absent and
  find another way. This has already cost a scheduled self-wakeup that never existed.
- **Nothing is ever gated on the owner testing, reading or replying.** Their words:
  *"I do not want anything to be gated on that or dependent on me doing any testing."*
- **A design question is not an excuse to stop.** Rule it as the orchestrator, in writing, with the
  numbers, in `orchestration/NEXT-DISPATCH.md` — and mark it **reversible**, naming what evidence
  would overturn it. A ruling the owner can read and reverse in one line is worth more to them than
  a question they never saw. `ARBITRATION.md`'s S-rulings are the form; an arbiter *agent* is
  always available and needs no approval.
- **When genuinely torn, do both.** Two agents cost tokens; a stalled tree costs the day.

The one thing that does travel upward: **say what you decided, in the reply, plainly.** The owner
overrules by reading, not by being asked — that is exactly how S30 became S35 and how the map exists
at all.

## 0a. `STATUS.md` is the owner's window. Keeping it true is a standing duty, not a chore.

**One file, repo root, one screen, readable on a phone.** The owner's words: *"I just want to be able
to easily open up a file on my phone, look at something and see, 'oh cool our agents are currently
working on [bit x] of the roadmap; I should expect that everything before that bit is delivered to the
7/10 standard; if I play the game right now I know what to expect'."*

**The orchestrator updates it whenever any of these change — same turn, not later:**
what the fleet is working on · anything that closes to the bar · anything the owner would *see*
differently if they played right now · the cost position.

**It answers exactly one question: what will I find if I open the game now.** Not what we intend, not
what has landed in a branch, not what a number says. If something is fixed but unjudged, it says so.
**A status file that flatters is worse than none**, because the owner then plays the game and finds out
the file lies — and every other document loses its credit at the same moment.

**Resist making this a system.** It was briefly a tracker with schemas, evidence verification and a
publish pipeline; the owner called that over-engineered and was right. The only mechanism is a
**staleness warning** — the file itself is written by hand, and it is short so that writing it is
cheap. Rule 0b still binds it: what it claims must come from the repo, not from memory.

## 0b. Never write from memory about the repo. Read the repo, and say what you read.

**This rule exists because the orchestrator broke it on 2026-08-14 and the owner had to catch it three
times in one hour.** The roadmap — the document that decides what the whole project builds and in what
order — was written from an orchestrator's working memory. It never opened a W1 plan or a reference
item. It stopped at "combat feel", named none of Morrowind's systems, and compressed the entire visual
programme into one step, against a body of work that measures **49 plans, 211 reference items and 78
open gaps**. It was deleted and rewritten from the repo.

**The rule.** If a document asserts anything about what this repo *contains, plans, covers, has
delivered, or lacks* — that assertion must be derived by **reading the repo at the moment of writing**,
and the document must name what was read or which command enumerated it.

**The tell, and it is reliable: if you could have written it without opening a file, you did.** A
document that would read the same whether or not the repo existed is a memory dump wearing a
document's clothes.

**Context memory is not a source.** It is lossy, it is stale the moment anything lands, and it does not
survive compaction — this session compacted twice on the day this rule was written, and everything held
only in context was silently replaced by a summary of itself. **A summary of the repo is not the repo.**

**This is the same defect as every other one found on 2026-08-14**, arriving from the inside instead of
from history: a reference item that told builders for eight days that no images were vendored when 131
were; 33 interface screenshots on disk while the corpus asserted they were not there; a plate count
that was arithmetically correct over a wrongly-chosen anchor; a fix dispatched under the headline "72
of 83" where the 72 came from a sibling's summary and the true number was 6. **An agent inheriting a
figure from another agent's summary is the same failure as a document asserting something it never
checked — it just travels faster.**

**What it costs to comply: one command.** `ls`, `grep -c`, `find | wc -l`. Then put the number and the
command in the document. That is the whole obligation, and it is cheaper than any of the above.

## The project

A browser game in Three.js: **Morrowind in almost every system** — quests, factions, dialogue,
journal, lore, world design, systems depth, strangeness — set in **Black Marsh**, with **Dark Souls'
combat**, stats and bonfires. **Souls are levelling only; gold is the currency.** The world takes
about an hour to cross on foot.

The rule that settles every argument: *where Morrowind and Souls conflict, **Souls wins inside the
fight** — frames, stamina, hitboxes, animation, enemy behaviour. **Morrowind wins everywhere else.***

## The method, in four lines

1. **Build the bar first.** A reference corpus of measurable requirements, then waves of work, wide
   before deep.
2. **One builder, one separate critic with fresh context, per piece.** Critics try to falsify the
   work and may PASS without inventing a gap when the written bar is evidenced. No builder grades itself.
3. **Nothing counts because someone says so.** A model nothing in the running world reads scores
   zero. A fix is not a fix until it has been deleted on a copy and the old number has come back.
4. **Report what you could not do as plainly as what you did.**

## The second standing goal: a quarter of the cost, none of the quality

`orchestration/COST.md` is binding and runs **in parallel with the build**, through the same
gauntlet — plan → plan critic → build → build critic, no agent grading its own saving. The bar:
**model spend per hour of runtime down to 25% of baseline**, with four guards that must hold
together — cost, **parallelism ≥ 12**, quality (verdict scores and critic find-rate), and rigour (the
five non-negotiables still run). *"I don't want to save cost by running more slowly or performing
worse. I want to increase efficiency."*

Two things make this real rather than aspirational. **Measure, never guess** — the session transcript
under `/root/.claude/projects/` carries per-request model, timestamp and token counts by class, and
it is the ground truth. **Reversibility is a hard requirement**: every change lands with a before, a
named one-step reversal that has actually been executed on a copy, an after, and a tripwire. The
largest known lever is that the fleet is essentially all Opus — 3,230 Opus requests against 29
Sonnet — while the model-choice policy that would fix it has been written down and never applied.

## 0e. Spawning blind judges is the ORCHESTRATOR's job, and nobody else can do it.

**Re-measured 2026-08-16 (the count grows as items land): `grep -rl "blind_pair: yes" corpus/
--include=*.md | wc -l` returns **103**. Verdicts that have ever RUN one: still **0**.**

**Derive that second number carefully — three agents got it wrong in one night**, reporting 98, 100,
101, 102 and "1 verdict records a run". A plain grep for `blind_status.*run` matches **prose that
quotes the phrase**, and one critic filed `W1-F7-WATER-r2.json` as the verdict that had run a gate
when that file records `"status": "not_possible"`. **Read the `blind_comparisons` array, not the file
text:** `node -e '...JSON.parse...blind_comparisons.some(b => b.status === "run")'`. The honest state
is that **no blind gate has ever been run to completion by a verdict in this project**, and it is
mine to fix. Ninety-eight reference items
declare a blind pair as their quality gate. Not one verdict has ever run one. Protocol A ran once, on
2026-08-14, and we lost 5 of 5 — that is the entire blind-judgement history of this project.

**This is not laziness and it is not a corpus defect. It is a structural hole, and it sits with the
orchestrator.** A blind gate needs a *fresh* judge with no project context. A critic cannot spawn one:
`create_session` is approval-gated (rule 0 forbids it) and a subagent cannot spawn subagents. So every
critic that reaches its item's quality gate writes `blind_status: not_possible` and fails closed — and
the item is capped, correctly, forever. Three separate critics did exactly this in two days, each
recording it honestly, each blocked by the same missing capability.

**Only the orchestrator can spawn a fresh judge, and therefore must.** The pattern, proven on
`RI-VIS06` Protocol A and repeated for `RI-UIX08` §G:

1. **Dispatch a pack-builder** that constructs the arms, seals the key, leak-checks the pair, and writes
   the verbatim prompt to a file. It must not judge, and its own opinion is void by construction because
   it has seen both arms.
2. **The orchestrator spawns the judges** — fresh agents, minimal brief, the prompt verbatim, no project
   context, arm identity quarantined. Ruling **S51**: a pack whose counterpart arm is derivable from the
   item's own tables is void.
3. **A third fresh reader checks separability.** An inseparable pair is `inert` and cannot pass.

**Treat an unrun gate as a live blocker, not a footnote.** It caps the item no matter how many
structural checks pass — `RI-UIX08` scores 2 with a look measured at **ΔE 0.00** against the reference,
purely because §G has not run. A tree of green leak-checks under an unrun quality gate is exactly the
shape the visual audit found: *statistics can fail a build and can never pass one.*

**Ring 0's `I3` owns closing this at scale.** Ninety-eight is too many to run one at a time, and the
answer is a standing judge fleet, not heroics.

## 0d. "Continue" means deliver the whole roadmap. Do not stop at a good stopping point.

**Owner, 2026-08-15, verbatim:** *"when I say 'continue', I mean continue with delivering the whole
roadmap as discussed until the whole game is delivered."*

So: when a piece lands, **dispatch the next one**. Do not end a turn with an empty fleet and a summary.
Do not wait to be told which item is next — `ROADMAP.md` says which item is next, and rule 0c says work
the lowest unfinished ring. The only reasons to stop dispatching are a hard blocker recorded in the
roadmap, or the box being at its ceiling.

**Two to four agents at a time, always.** An idle fleet is the one failure mode the owner has named
repeatedly and it wastes wall-clock rather than money.

**At dispatch, route by `COST.md` C5/C5a: Sonnet by default, Opus for judgement — and Opus ALWAYS for
3D visuals work** (`F1`–`F14`, `G1`, and any capture or comparison judging how the scene looks). The
owner ruled that carve-out after finding Sonnet was not up to it.

## 0c. Work from the roadmap. Every dispatch names its item.

**`orchestration/ROADMAP.md` decides what gets built and in what order.** It is not a summary of what
we happen to be doing — it is the instruction, and the orchestrator follows it rather than choosing
freshly each tick. It exists because an orchestrator's context does not survive compaction and this one
compacted twice in a day.

- **Work the lowest unfinished ring.** Rings are ordered by dependency, not importance. Two to four
  agents at a time, never two that can touch the same files.
- **Every dispatch brief names the roadmap item it serves** (`F2`, `G1`, `I5`…). A piece of work that
  cannot name its item is either not on the roadmap — in which case the roadmap is wrong and should be
  fixed first — or it is a distraction.
- **If the item is MAPPED IN `orchestration/IMPLEMENTATION-LEADS.md`, the brief links its exact
  heading.** Owner-set, merged 2026-08-15 (PR #187), and it binds the dispatcher, not the builder:
  **26 items are mapped** — ring 0 `I2`; ring 1 `G1` `F1` `F4` `F5` `F6` `F8` `F10` `F11` `F12` `F13`
  `F14`; ring 2 `G2`–`G7`; ring 3 `W1` `W4` `W5` `W6` `W7` `W8` `W10` `W11`; ring 4 `C6` `C7` `C8`.
  The builder inspects the candidates named there and records **one finding per candidate —
  `used` / `adapted` / `concept-only` / `declined` — with the decisive reason.** A `declined` finding
  *completes* the evaluation and creates no follow-on work; `concept-only` permits no source copying;
  anything copied or adapted carries its pin, licence and attribution beside the vendored code.
  **These leads inform implementation choice ONLY** — ring order, item scope, acceptance, ownership,
  dependencies, critic independence and done-state stay governed by the roadmap, the plan and the
  corpus, and the file names the Elder authorities an adapter may sit behind but must not replace.
  Agents already running when it merged continue unchanged; **the routing applies at a mapped item's
  next entry into planning, remediation or building** — for the four rounds in flight on 15 Aug, that
  means their *successor* rounds.
- **An item is `done` only when delivered AND independently judged at or above the bar.** Delivered and
  judged are different words. Nothing counts because someone says so.
- **Coverage is machine-checked.** `node tools/roadmap-coverage.mjs` exits non-zero if any reference
  item, plan or open gap has no home, or if the order violates a recorded dependency. **Run it after
  changing the roadmap**, and fix the generator rather than the markdown — they are two views of one
  source and they must not drift.
- **When the roadmap is wrong, change the roadmap** — then work it. Do not quietly work around it, and
  do not carry the correction only in your head.

## The character directive — binding, and deliberately hard to lose

**Owner, 2026-08-14, verbatim:** *"the player character and every NPC when I load the game look frankly
ridiculous. Some serious work is needed on them, and I suspect some serious work is needed to build out
the set of reference images/gifs for builders to use as their target and for critics to compare
against. They could be compared against Skyrim and ESO images and gifs for example. We need our
character design and overall quality to be at that level. Builders must look at the actual reference
images/gifs to guide their work, and must look at actual screenshots and motion captures (e.g. rotating
the camera around the player to view from multiple angles) — stills are not enough — from our actual
game; critics must as well."*

**Four requirements, all of them binding:**

1. **A character reference set must exist before the character work is judged** — images **and motion**,
   at the quality level of Skyrim and ESO. It does not exist today. Acquiring it is `I5` in ring 0, and
   `F10` cannot be judged without it: `RI-VIS08`'s own comparison method runs its blind pass *"if and
   only if a usable reference image exists"*, and it **refuses Morrowind references** for characters
   (Morrowind characters are ~1,000 triangles).
2. **Builders look at the references.** Not at a written description of them. A builder who has not
   opened the plates is building from imagination.
3. **Builders and critics both look at our actual game, in motion.** Orbit the camera around the
   character, multiple angles, motion sequences. **Stills are not enough** — this is the same directive
   that was bought when a transparency defect was declared fixed from one still and was still broken.
4. **There is a hole in the bar and it must be filled, not worked around.** `RI-VIS08` §D is titled
   *"the design/quality seam for creatures — where this item stops"*: the item covers **fidelity**
   (model quality, silhouette readability) and stops short of holistic character and creature **design**.
   Checked against all 149 reference items — `RI-CHR01/02/03` are creation, race and birthsigns and land
   in `C1`, which is not design language. **Nothing covers the other side of that seam.** Until a
   reference item does, `F10` is judged against an incomplete bar and any pass it earns is worth less
   than it looks.

**Why this is written here rather than only in the roadmap:** the owner asked for certainty it would
survive compaction. `tools/readpath.mjs` carries named probes for this section, so if it is deleted or
weakened, **a check goes red in `pre-commit`**. Do not remove the phrases those probes match without
replacing the requirement.

## Before every dispatch, and before writing anything into a document — the four-line check

**Owner, 2026-08-14, on going to bed: *"Keep checking the actual repo rather than relying on your
memory (bake that into your own system prompt or whatever your equivalent of claude.md is)."* This is
that.** It is here rather than only in rule 0b because rule 0b is a principle and this is the moment it
actually gets broken: writing a brief, at speed, from what you think you know.

1. **Did I read it, or do I remember it?** Every number, every file path, every "X is unowned", every
   "this covers that" — from a file opened or a command run **in this turn**. Not from a sibling's
   summary, not from a status file's headline, not from earlier in this conversation.
2. **Am I passing on a figure I did not derive?** A number inherited from another agent's report is
   the same defect as an unverified document — it just travels faster. A piece was dispatched under
   the headline *"72 of 83"* where the 72 came from a sibling's summary and the true number was **6**.
   If a figure goes into a brief, either check it or mark it explicitly as unverified and tell the
   agent to re-derive it.
3. **`node tools/ownership.mjs --for <file>`, actually run.** Two agents were sent at the same four
   findings in one afternoon because this was assumed rather than run. Note the opposite failure too:
   a piece was held back for an hour on stale claims that a check would have cleared in seconds.
4. **What would make this brief wrong?** Name it in the brief. Every good result today came from an
   agent that could see the premise it was allowed to falsify — the overlap resolver overturned its own
   dispatch, the backlog triage corrected its own population, the roadmap audit refused a count.

**Put the same obligation in the brief itself.** An agent that inherits an unchecked premise will
faithfully build on sand and report success.

## Running the fleet

`orchestration/TICK.md` is the loop: measure contention, bank, top up. `node tools/dispatchable.mjs`
before every spawn; `node tools/contention.mjs` before every browser; `node tools/bank.mjs
"<headline>"` to land the tree, which names whose work it carries.

**`bank.mjs` now commits AND pushes, in one operation, and there is no separate push step.** It
lands through `tools/land.mjs`, which builds the commit with a real three-way merge (`git
merge-tree`) instead of snapshotting the working tree, takes no `.git/index.lock`, retries when a
sibling lands first, and **exits non-zero unless the bytes are on the remote**. An agent that wants
to carry only its own files uses `node tools/land.mjs "<headline>" --paths <yours>`.

Bank often and in small increments. The container has restarted twice in one day and taken nine
agents with it each time; unbanked work dies with it.

**Do not hand-roll a push, and do not copy the `read-tree origin/<branch> && git add -A` recipe out
of an old status file — that recipe is what has been destroying the fleet's work.** It stages every
file a sibling pushed as a *deletion*, because it measures the working tree against `origin` instead
of against `HEAD`. One bank built that way deleted 18 files and 22,209 lines of finished work in a
single commit; re-run through `merge-tree` the same merge keeps 18 of 18. `HAZARDS.md`'s opening
section is the whole instruction, and `node tools/land.mjs --self-test` is the proof — 13 checks
whose arms are required to disagree, with the old recipe losing an agent's work in four of them.

There is **no push race**: git rejects a non-fast-forward push, so two agents pushing at the same
instant cannot overwrite each other. A day was spent on that theory, and the worktrees bought to fix
it broke rendering for nine agents and stopped none of the losses. Worktrees are still worth having
for what they actually do — two agents cannot overwrite each other's edits on disk — and nothing
more.

**~~The hard floor of 12 is removed… things that can safely run in parallel always should.~~
SUPERSEDED 2026-08-14 evening — DO NOT ACT ON THE STRUCK TEXT.** It ran the fleet at ~14 agents and
burned **37% of a weekly cap in nine hours**. Kept, struck, so nobody re-derives it.

**GO NARROW AND SEQUENTIAL.** Owner, 2026-08-14 evening, verbatim: *"Run less in parallel at once…
I would prefer you to go slower, more methodically, make fewer mistakes, do fewer things at once, and
make continuous, incremental progress (in terms of things I can actually see in the game), going
through a big picture plan that breaks down into sensible sequential steps, with regular updates
written about them… I am keen that you don't get lost or lose track of work and more like just go
through things one at a time, so we get less done at once but can be more sure we're making progress
towards our perfect game."*

The standing shape of the work is now:

- **Two to four agents at a time, not fourteen.** Not one — one wastes wall-clock without saving much
  per unit of work — but few enough that no two can collide and every result is read properly before
  the next dispatch.
- **Sequence by what the player sees**, not by subsystem. Each step ends in something the owner could
  look at in the game. A step that moves an internal number and changes nothing visible is not a step.
- **`orchestration/ROADMAP.md` is the source of truth**, ordered, each step carrying its visible
  outcome and its state. **The orchestrator's context is not the plan** — this session compacted twice
  in one day, and a plan held only in context dies there.
- **A short written update per completed step**, cheap, on the blog or the progress page.
- **Fewer pieces in flight, not fewer checks per piece.** The builder/critic gauntlet stays intact and
  critics stay on Opus. The gauntlet is exactly what catches the false claims the repo is now known to
  be full of; cutting it to save money would buy the saving with the one thing that makes any of this
  trustworthy.

**This is not a retreat from the cost goal, it is how to hit it.** Width at fourteen manufactured work
that existed only because of width: two agents dispatched onto the same four findings, contradictory
status files needing reconciliation, and whole-tree banks that carried siblings' in-flight edits into
`HEAD` and silently turned a delete-the-fix green. That overhead is pure loss and it scales with the
number of agents.

## The 2026-08-14 owner directives — binding, and they override older text

Full detail and the owner's own words: **`orchestration/OWNER-DIRECTIVES-2026-08-14.md`**. Read it
after this file. The five that change day-to-day behaviour most:

1. **Graphics and visual fidelity are Wave 1, not Wave 4.** *"It's not worth progressing to wave 2's
   depth unless we can make the game look pretty good."* Breadth across the whole game, not just the
   player-facing slice W1-24 owned.
2. **Static inspection is not evidence. Play the game.** *"if you just load the game rotate the
   camera around the player it's immediately obvious that it hasn't [been fixed]."* Any visual claim
   needs **many screenshots and motion sequences from many angles**; a single still from one angle is
   how the player-transparency defect got declared fixed while still broken.
3. **Reuse deliberately.** A good-looking player should teach the NPCs; a good building model should
   be tweaked and reused, not rebuilt. Make this structural, not a hope.
4. **Progress travels as merged PRs in plain English**, and blogs drop to a **twice-daily roundup** —
   warm, factual, progress-oriented, with pictures. Not sarcastic, not hype.
5. **The bar itself may be insufficient.** Do we actually have Morrowind region/topological maps and
   their Black Marsh equivalents? *"Exploring Morrowind never felt dull… our game should be the
   same."* Auditing and extending the reference corpus is in scope, not a distraction from it.
