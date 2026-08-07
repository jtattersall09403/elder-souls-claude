# The rules

**Every agent reads this. It is short on purpose.** Each line is a rule that has already cost this
project at least one wasted round, and the evidence for every one of them is in
`orchestration/AGENT-PROTOCOL.md` — go there when you want to know *why*, not before. Do not read
the evidence to work out the rule; the rule is here and it is complete.

Read next: `orchestration/INDEX.md` (generated — tools, items, gates, harness verbs, who owns what
right now). Between these two you should not need to go looking for anything.

## Survive

1. **Write your status file first, before you read anything**, at `orchestration/status/<task>.json`,
   and update it as you go. The container has restarted three times in one day and killed every
   agent each time. An agent that writes as it works resumes; one that holds work in its head pays
   for it twice.
2. **Write each deliverable the moment it is ready.** A partial file with a WIP marker is a good
   outcome. A perfect one that was never saved is nothing.
3. **If your status file already exists, you are a successor.** Read it, read what is on disk,
   continue from `next_step`. Do not restart and do not re-claim finished work — check whether the
   piece is already done before spending a budget proving that it is.

## Measure honestly

4. **Break the thing you measure on purpose and confirm your instrument goes red.** A probe that
   cannot fail is worse than no probe. Several have shipped here passing against empty registers,
   disconnected models and vacuous controls.
5. **CONSUMPTION (`RI-MTH07`, mandatory under `ARBITRATION.md` §3).** For every model you ship,
   name the world-side consumer and demonstrate it by perturbing the model and watching an entity
   change behaviour. **Sixteen subsystems have shipped a correct, instrumented model that nothing
   in the running world reads.**
6. **Delete-the-fix.** Remove your own change on a copy and confirm the old number returns. Then
   check the two arms actually differ — an "inert fix" has passed here twice.
7. **Audit the running world after a load, not the bytes.** A field written and never read back
   re-serialises to exactly what was saved and passes forever.
8. **A still target hides every steering defect.** If what you measure responds to motion, the
   target must move. The easiest fixture collects the most data and distinguishes nothing.
9. **Run the aggregation, not just the standalone probes.** Ten checks confirmed individually and
   never together is how a green build ships broken.
10. **Confirm the code you are about to change actually runs**, by perturbing it and watching the
    world. Two parallel implementations of one system is how this build had a good detection model
    and a broken one at the same time.
11. **A field census over data cannot prove a read dead.** The loader decides what shapes are legal.
12. **Stamp the commit on every number.** The tree moves fast; a measurement is a claim about a
    commit, not about the project.

## Do not break everyone else

13. **Never land a fail-closed assertion before the data it demands exists.** Every agent
    boot-checks, so a throwing engine is not your problem — it is everyone's. Author the data,
    prove the assertion is silent on the shipped tree, then arm it.
14. **Content integrity belongs in a check, not in a constructor.** `tools/check-*.mjs`.
15. **The event vocabulary in `game/src/sim/events.js` is closed.** Emitting an unlisted name
    throws inside the fixed step and kills every stepping probe in the project — while boot-check
    stays green, because boot does not step. Add names additively.
16. **Read the status files of agents near your files before you write**, and record which files
    you touch in your own: `files_touched` (paths already written) and `files_claimed` (paths you
    expect to write next) — plain arrays of repo-relative paths, nothing heavier; a path ending in
    `/` claims a whole directory. `INDEX.md` lists what is in flight; `node tools/ownership.mjs
    --conflicts` reports two live pieces that claim the same file without saying why. If the
    overlap is deliberate — a second critic, a competing hypothesis, the project's whole method —
    declare it with `"redundant_with": ["<other task_id>"]` instead of leaving it to read as a
    collision; a declared pair is never reported as a conflict.
17. **A delete-the-fix on a shared tree must check the git index**, not just the file. A
    neighbour's `git add -A` has staged a temporary deletion before now.

## Cost

18. **Point at files; do not restate them.** The verdict, the status file and the item are
    authoritative and a summary of them is not — orchestrator summaries have been corrected by
    builders and critics dozens of times. Read the file.
19. **Wrap noisy commands**: `node tools/run.mjs -- <command>` keeps the whole output on disk and
    shows you the failures, the head and the tail. Nothing is discarded; the path is printed.
20. **Use `tools/capture/` for pictures.** Launch your own browser only when you are stepping the
    simulation, and say which you did.
21. **Check `pgrep -c headless_shell` and `cat /proc/loadavg` before browser work.** Above ~8
    browsers, do the work that needs none and come back. Contention has cost two pieces their
    headline numbers. **Launch one browser and keep it** for the whole run.

## Judgement

22. **You do not grade yourself.** A separate critic with fresh context judges every piece.
23. **A critic that cannot find a gap has failed.**
24. **If a method names a tool that does not exist, build it** — and make it able to fail. Never
    stub a tool to pass; if the system it measures does not exist, it reports that absence and
    exits non-zero. See `orchestration/TOOL-LOOP.md`.
25. **Do not judge a blind pack you built.** Two comparisons here were voided for it, and a third
    turned out to be asking a provenance question when the item specifies a quality one.
26. **Report what you could not do as plainly as what you did.** A blocked task honestly reported
    is a result; a silent failure is not. Say under what load every timing figure was taken, or
    publish no timing figure.

## Leave something behind

27. **One line in `reports/blog-feed.jsonl`**, in plain words a non-developer would understand, and
    one illustrative image in `docs/shots/` with a dated descriptive name. This is how the owner
    sees progress, and it costs you a minute.
28. **Do not commit.** The orchestrator banks the tree.
