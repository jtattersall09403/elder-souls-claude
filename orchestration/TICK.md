# The orchestration tick

The owner's standing instruction: *"always be running as much in parallel as you can… always be
assessing and pushing how much you can safely and effectively run in parallel."*

The failure mode this file exists to prevent is not over-dispatching. It is **drifting down** — an
agent finishes, its result gets read and committed, and nothing is started in its place, so the box
quietly empties while thirteen wave-1 pieces have never been touched. That has happened repeatedly,
and it is invisible from inside a single turn because each turn feels busy.

**Run this list on every agent completion, and on every self-wakeup.**

## 1. Measure before deciding

```
pgrep -c headless_shell ; cat /proc/loadavg
```

Browsers, not agents, is the number that matters — one agent can be ten browsers. Under ~8, there is
room for stepping work. Over it, dispatch only work that needs no browser, of which there is always
some.

## 2. Bank

`node tools/harness/boot-check.mjs`, then commit and push. In-flight work is banked, not withheld —
the container has restarted twice in a day and killed every agent both times. A half-written tree
that boots is worth more than a clean tree that is gone.

If `boot-check` is red, find the call site that landed ahead of its method and guard it *at the call
site* with a note to remove the guard. Do not wait: every agent boot-checks, so a broken engine is
not one agent's problem, it is all of them.

## 2a. The floor — this is the part that makes it stick

> Owner, verbatim: *"I want you to **always** be **absolutely maximising** our compute use and
> running **as much in parallel simultaneously as is absolutely possible**… as long as you **do**
> achieve it, and it **sticks**."*

**Never fewer than 12 agents running.** Of those, **up to 8 may be browser-heavy**; the rest must be
work that needs no browser, and there is always some. If the count is below 12, dispatching is the
first thing you do — before writing a reply, before reading the next result.

Two things make this achievable rather than aspirational:

- **A browser is the only scarce thing.** Authoring, corpus work, data audits, tool building,
  prose, judging, planning and blogging all cost nothing but thinking. The 8 is a real ceiling; the
  12 is a floor with no ceiling above it.
- **Every piece splits.** If nothing is ready to dispatch, that is a queue failure, not a capacity
  one. Take any piece and separate its authoring half from its verification half — the authoring
  half needs no browser and can start immediately.

Never "wait for results before starting more". Results arrive continuously; the box does not care.

## 2b. Cost discipline — every token spent twice is a token not spent on the game

> Owner: *"be dramatically more token efficient… but with absolutely no drop in performance or
> quality."*

The budget is dominated by **subagent work**, not by orchestration prose: one agent costs 200–350k,
so a wave of fourteen is several million. That means the savings that matter are the ones that stop
work being *repeated*, and the ones that stop it being *wasted*. Trimming words is the small half.

**The four rules, in order of how much they save:**

1. **Never dispatch a piece that is already done.** Read the status file and the last commit before
   relaunching a successor. A successor sent to a complete piece spends its whole budget proving
   the piece is complete. That has happened; it was an orchestration error, not the agent's.
2. **Briefs point at files; they do not restate them.** The findings already live in the verdict,
   the status file and `NEXT-DISPATCH.md`, and the agent is going to read them anyway. Restating
   them costs tokens **and** risks a paraphrase being wrong — which has happened repeatedly, with
   writers and critics correcting the orchestrator's summaries dozens of times. A brief is: the
   role, the status file, the two or three files that carry the findings, and the one instruction
   that is genuinely new. Two hundred words, not nine hundred. **This is a quality gain, not a
   trade-off** — the file is authoritative and the summary is not.
3. **Status files earn their cost on the first restart.** Three restarts in one day, every agent
   killed each time. An agent that writes as it goes resumes; one that holds work in its head
   starts over and spends the budget twice.
4. **Say it once.** A finding belongs in its verdict. Commit messages carry a subject and a couple
   of lines; the detail is one `git show` away and nobody needs it duplicated in five places.

**What must not be cut, because it is where the quality lives:** the separate critic, the
delete-the-fix, the CONSUMPTION check, the self-test that goes red on purpose, and reading the
actual file rather than trusting a summary. Every one of those has caught something expensive. Cost
discipline means not paying twice for the same work — never paying less for the verification.

## 3. Top up, in this order of preference

1. **A critic owed a piece that has reported.** A finished builder with no critic dispatched is the
   loop stalled. This outranks starting anything new.
2. **The next thing in `NEXT-DISPATCH.md`.**
3. **An unstarted wave-1 piece** from `docs/PLAN.md` §3. Wide before deep. Over half own no path any
   dispatched verdict declares.
4. **A blog writer**, if none is running and there is anything in `reports/blog-feed.jsonl` the
   ledger has not covered. Cheap, no browser, always safe to add.

**Every dispatch is one builder or one critic, never both in the same agent.** No builder ever
checks its own homework.

### 3z. Before you spawn anything, ask whether the piece needs it

```
node tools/dispatchable.mjs <task-id>      # exits 3 if this piece is done and judged
node tools/dispatchable.mjs                # everything, grouped by what it actually needs
```

Written because the orchestrator dispatched a successor to a piece whose status file already read
`state: "complete"`, and the agent spent 92k tokens correctly proving there was nothing to do —
**an hour after writing the rule that forbids exactly that.** A rule you have to remember is not a
control. Run the command.

It separates the two answers that matter and are easy to conflate: *unfinished* wants a successor,
**finished but never judged wants a critic, not a builder.** That second category is currently the
largest one on the board, which is the loop stalling in the quietest possible way — a builder
reports, nothing is dispatched against it, and the piece looks busy on every dashboard.

### 3a. Check who is already in the area before you add a thirteenth agent

Before dispatching into a file or directory another live piece might also be touching, run:

```
node tools/ownership.mjs --for <path>          # who is in this file right now
node tools/ownership.mjs --conflicts           # every undeclared overlap among live pieces
```

`--conflicts` exits non-zero when two live pieces claim the same file and neither has declared the
other in `redundant_with` (RULES.md rule 16). Two pieces attacking the same file on purpose — a
second critic, a competing hypothesis — are not a conflict and are not what this catches; an
**undeclared** overlap is one agent about to overwrite another's in-flight work without either
knowing, which is the exact failure this registry exists to make visible before it happens instead
of after.

If the answer is noisy — the area you were about to dispatch into already has an undeclared
claimant, or several live pieces have declared nothing at all near it — **prefer dispatching the
next agent into an unclaimed area instead.** There is nearly always one: §4 below exists precisely
because decomposing a piece into its authoring half and its verification half almost always frees
up something nobody else is standing in. Do not read a clean `--conflicts` as proof the area is
actually clear, either — most live pieces today declare nothing (`node tools/ownership.mjs` shows
the count), so silence is the registry's blind spot, not a green light. This tool is advisory, not
a gate: it informs where you dispatch next, and it is never wired into `boot-check` or the
pre-commit hook — see `tools/ownership.mjs`'s header for why a self-reported, unverifiable claim
must not be allowed to turn red for everybody the way `tools/check-quests.mjs` used to.

## 4. Ask the question the owner keeps asking

*What else could be running right now that is not?* Write the answer down even when it is "nothing"
— if it is "nothing" twice in a row, the queue is the problem, not the box. Decompose a piece into
its authoring half and its verification half and dispatch the authoring half; it needs no browser
and there is nearly always some.

## 5. Keep the blog honest

At least one post in four is a **follow-up** — a defect the reader was already told about, shown
fixed, with a before-and-after picture. `node tools/blog-threads.mjs` lists which stories are owed
an ending and which are still open. Do not write a follow-up about something still broken.

## 6. Re-arm

Schedule the next self check-in before finishing the turn, so the tick survives a quiet period. A
loop that only runs when an agent happens to finish is not a loop.
