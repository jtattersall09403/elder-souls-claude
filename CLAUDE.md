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
2. **One builder, one separate critic with fresh context, per piece.** *A critic that cannot find a
   gap has failed.* No builder grades itself.
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

`orchestration/TICK.md` is the loop: measure contention, bank, top up. **Never fewer than 12 agents
running**, and dispatching comes before writing a reply. `node tools/dispatchable.mjs` before every
spawn; `node tools/contention.mjs` before every browser; `node tools/bank.mjs "<headline>"` to
commit the tree, which names whose work it carries.

Push after every bank. The container has restarted twice in one day and taken nine agents with it
each time; unbanked work dies with it.
