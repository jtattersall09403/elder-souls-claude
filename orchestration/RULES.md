# The rules

**Every agent reads this. It is short on purpose.** Each line is a rule that has already cost this
project at least one wasted round, and the evidence for every one of them is in
`orchestration/AGENT-PROTOCOL.md` — go there when you want to know *why*, not before. Do not read
the evidence to work out the rule; the rule is here and it is complete.

Read next: `orchestration/INDEX.md` (generated — tools, items, gates, harness verbs, who owns what
right now). Between these two you should not need to go looking for anything.

## Rule 0 — never wait for the owner

0. **Decide, record, proceed. Never block on the project owner.** They have said twice that they
   miss notifications and that nothing is to be gated on them. So: no `AskUserQuestion`, no tool
   that raises an approval prompt (if one says "requires approval", treat the capability as absent
   — the prompt went somewhere nobody is reading), and no work parked pending an answer.

   **A design question is not an excuse to stop.** Rule it in writing with the numbers, in
   `orchestration/NEXT-DISPATCH.md` or as an `ARBITRATION.md` S-ruling, and mark it **reversible** —
   name the evidence that would overturn it. An arbiter agent needs no approval and is the right
   instrument for anything genuinely contested. When you are torn between two answers and both are
   cheap, build both and measure.

   The owner overrules by reading, not by being asked. That is how the map exists: S30 said there
   would be none, they read a blog post, and S35 replaced it.

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
6. **Delete-the-fix, and then check your control is not itself inert.** Remove your own change on a
   copy, confirm the old number returns, and confirm the two arms genuinely differ. There are two
   distinct failures here and conflating them has already cost a wrong published count:

   - **An inert fix** — the change does nothing and the measurement passes anyway, because
     something else was carrying the number. That has passed here **twice**.
   - **An inert control** — the *teardown* does nothing, so both arms are the positive arm. W1-04's
     wall-collision control nulled `engine._townCell` one line before calling a function whose
     off-branch reads `if (this._townCell && …)`, so all fifteen walks came back byte-identical and
     the control looked like a clean negative result. **When you write a teardown, break the thing
     under test and confirm the control arm goes red** — a control you have never seen fail is not
     evidence, it is a second copy of the experiment.

   - **An inert fix that improves the number** — the most dangerous of the three, because every
     signal says it worked. A magic round's first lead-the-target fix computed `p0[2]` on a planar
     pair, got `NaN`, and fell silently back to pure pursuit — and the miss distance went from
     0.89 m to 0.19 m. It was caught only by a frame-by-frame diagnostic, because a number moving
     the right way is not evidence that your change is what moved it. **Check the code you wrote
     actually executed**, not just that the measurement improved.

   A fourth shape exists and is not any of these: **two guards for one defect**, where deleting
   either alone changes nothing and only deleting both moves the number. Honest reporting of it
   looks exactly like an inert fix, so say which you have when you report it (see
   `corpus/90-verdicts/wave1/W1-SOULS-r3.md`, run as a 2×2).
7. **Audit the running world after a load, not the bytes.** A field written and never read back
   re-serialises to exactly what was saved and passes forever.
8. **A still target hides every steering defect — and one instant is a still target in time.** If
   what you measure responds to motion, the target must move. The easiest fixture collects the most
   data and distinguishes nothing.

   Both halves have now cost a round. A magic bolt hit a standing body at every range and a
   *walking* body at none, for two rounds, because every fixture used a target that stood still.
   And a doorstep fix reported **0 of 115 bodies stuck inside a building** — measured one fixed
   frame after the door. At 30, 120 and 600 frames the same 115 doors give **8, 10 and 10**: the
   collision solver slides the body into a neighbour and it rests there. In the critic's words,
   *"the round measured the one frame at which its number is zero."* **Let the world run.** If your
   number is taken at a single instant, take it again later and publish both.
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
17. **Commit with `git commit --only <your paths>`. Never `git add -A`, and staging by name is
    not enough.** Three times in one session an agent's commit carried a neighbour's in-flight
    work; once it buried a critic's staged verdict, tools, screenshot and blog line under a
    builder's message. The first version of this rule said "stage your own paths by name", and an
    agent corrected it within the hour with the reason: **`git commit` commits the whole index**,
    so on a tree where a dozen agents are staging concurrently, staging carefully still sweeps up
    whatever someone else already staged. `--only` is the flag that actually restricts the commit
    to the paths you name. A delete-the-fix on a shared tree must likewise check the *index*, not
    just the file — a neighbour's `git add -A` has staged a temporary deletion before now.
    `node tools/ownership.mjs --staged <your-task-id>` names every staged path another live piece
    has declared, and the pre-commit hook prints it. Read it before you commit, not after.

    **Two things will put files you did not write into your commit, and neither is a neighbour.**
    This paragraph has been wrong twice; both corrections came from agents, and the second one
    corrected me after I had told the first it was mistaken.

    1. **`tools/bank.mjs`.** The orchestrator stages the whole tree every few minutes on purpose —
       the container has restarted twice in a day and unbanked work dies with it — so anything you
       have written but not yet committed gets carried under the bank's message. Not a race you
       can win. The bank names whose work it carries, from the ownership registry, in its own
       commit message; look there before diagnosing anyone.
    2. **The pre-commit hook stages five generated files itself** — `orchestration/INDEX.md`,
       `corpus/00-doctrine/INDEX.md`, `docs/index.html`, `docs/progress.html` and
       `docs/status.json` — because they are regenerated during the hook and a commit that
       regenerates them without committing them leaves the tree permanently dirty. So
       `git commit --only <your paths>` still comes out with those five. **That is expected and
       it is not a sweep.**

    **Finding your own file's real history:** every bank commit carries an `Orchestrator-Bank: true`
    trailer, so `git log --invert-grep --grep=Orchestrator-Bank -- <path>` gives you the authored
    history without the banks. A builder hunting a delete-the-fix base found eight banks that had
    carried its file mid-edit under other agents' messages and reported `git log` as useless; it was
    right, and this is the fix.

    **If the index is locked, retry — do not wait.** A dozen agents commit concurrently and the
    lock is held for seconds at a time. An agent that blocks on it is an agent whose staged work
    sits in the shared index waiting to be swept; retrying with a short backoff gets you in
    between other commits. `tools/bank.mjs` now refuses to stage while a commit is in progress,
    which closes the orchestrator's half of this, but it is not airtight. If your work is banked
    while you wait, verify the content landed and move on — do not unpick it.

    `--only` itself is sound and you should still use it: tested directly, `git commit --only
    a.txt` with `b.txt` staged commits `a.txt` alone and leaves `b.txt` staged. An agent reported
    otherwise, I tested that narrow claim, found it false, and said so — and was then shown the
    hook, which produces the same symptom by a different route. Test the mechanism you are
    accused of, not the one you assumed.

## Cost

18. **Point at files; do not restate them.** The verdict, the status file and the item are
    authoritative and a summary of them is not — orchestrator summaries have been corrected by
    builders and critics dozens of times. Read the file.
19. **Wrap noisy commands**: `node tools/run.mjs -- <command>` keeps the whole output on disk and
    shows you the failures, the head and the tail. Nothing is discarded; the path is printed.
20. **Use `tools/capture/` for pictures.** Launch your own browser only when you are stepping the
    simulation, and say which you did.
21. **Run `node tools/contention.mjs --gate` before browser work.** Exit 3 means do the work that
    needs no browser and come back. Contention has cost two pieces their headline numbers.
    **Launch one browser and keep it** for the whole run — and **never `pkill -f headless_shell`**.
    A critic did, unscoped, and reports it may have taken a neighbour's browser mid-measurement.
    Kill your own child process by pid; the fleet's browsers are not yours to reap.

    This rule used to say "above ~8 `pgrep -c headless_shell`, wait", and that was wrong in a way
    that quietly throttled the whole fleet: Chromium forks a browser process, a zygote, a GPU
    process and a renderer per tab, so **one browser is six `headless_shell` entries here**. The
    ceiling as written was about one and a third browsers, and agents have been sleeping, queueing
    and skipping measurements to respect a number that never meant what it said. The tool counts
    browser *instances* (a shell whose parent is not itself a shell) and the run queue per core,
    which are the two things that actually contend. If you proceed past exit 3 anyway, that is
    allowed — say in your status file that you did and why.

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
28. **Commit your own declared files, by explicit path. The orchestrator banks everything else.**

    This rule used to read "do not commit — the orchestrator banks the tree", and dispatch briefs
    have been telling agents to commit for some time; two agents in one session reported the
    contradiction rather than guessing, which is the right behaviour and the reason it is now
    fixed here instead of in the next brief. Both readings had a point. Attribution is better when
    the agent who did the work writes the message, and a tree banked only by the orchestrator loses
    an hour of work every time the container restarts — which happened today. But a finishing agent
    reaching for `git add -A` is how a neighbour's work ends up under someone else's name.

    So: `git commit --only <the paths you declared>` — never `-A`, never `.`, and not a bare
    `git add` either (see rule 17: the commit takes the whole index, not your additions to it). If
    you find you need a file you did not declare, declare it first (rule 16) and say why in the
    status file. The orchestrator banks whatever is left, and says in its message that that is
    what it is doing.
