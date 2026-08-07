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
