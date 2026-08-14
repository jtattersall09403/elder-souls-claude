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
