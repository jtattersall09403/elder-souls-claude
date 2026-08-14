# Owner directives, 2026-08-14 — binding on everyone, orchestrator included

Source: the owner's handover message on resuming after a six-day gap, alongside
`orchestration/2026-08-14 09:00 Codex to claude handover notes.md`. Where this file and an older
orchestration document disagree, **this file wins** and the older text should be corrected rather
than left to confuse a successor.

The owner's standing meta-instruction still holds and is why nothing here is phrased as a question:
*"make sure to keep using methods that don't require my approval as I will miss the Claude code
notifications."* Decide, record, proceed (`CLAUDE.md` rule 0).

---

## 1. Graphics and visual fidelity are Wave 1 work, across the whole game

> *"It sounds like most graphics quality and visual fidelity work wasn't going to come in until waves
> 4+. This is too late for me. A key determinant of whether this game is ever going to be worth
> playing will be whether you can make it look good enough… It's not worth progressing to wave 2's
> depth unless we can make the game look pretty good (the 7/10 bar vs the references)."*

This is **wide before deep**, correctly applied: player-facing graphics were in W1-24, and the rest
of the breadth must join it in Wave 1. `W1-30` is the whole-game visual foundation piece and it is
partway delivered. The immediate focus is getting this to the bar — *"so I have something nice
looking to demo while the rest is being built out"* — **while other pieces continue in parallel.**

The plan is not assumed correct. The owner's instruction: review W1-30's plan and the work done
against it, judge whether it will actually reach the bar, and **change the plan if it will not.**

## 2. Static inspection is not evidence — play the game, from many angles

> *"it seems to be inspecting relatively few screenshots/images from our actual game when making
> comparisons which means it is drawing flawed conclusions… For example it thinks it's fixed the
> player character body transparency issue, but if you just load the game rotate the camera around
> the player it's immediately obvious that it hasn't. There are many issues like that."*
>
> *"something may seem ok when inspected statically in isolation, but if you actually play the game
> for a short time then major issues become immediately clear."*

**Binding requirement for any visual or player-experience claim:** many screenshots **and motion
sequences**, from **many angles**, taken from the actual running game. One still from one angle is
not a measurement; it is the shape of evidence that has already certified a broken thing as fixed.

Assume this failure mode is **not confined to graphics.** Any piece whose verdict rests on a static,
isolated check is suspect until someone has played through the thing it claims.

**GPU is available, and as of 2026-08-14 it actually works.** RunPod tooling is in `tools/runpod/`
with `RUNPOD_API_KEY` and `RUNPOD_GPU_TEMPLATE_ID` in the environment. Use it rather than reasoning
about what SwiftShader showed you. Verified end to end: **NVIDIA RTX A4500, 20 GiB, $0.25/hr**, with
artefacts back in this repo 57 seconds after start including provisioning and teardown.

```
node tools/runpod/cli.mjs run --max-runtime 35        # Node + Playwright + the game
node tools/runpod/cli.mjs cleanup                     # safe: only your own Pods
node tools/runpod/cli.mjs selftest                    # 15 arms, no network, no spend
```

**Three things that used to cost an hour each — do not re-derive them.**

- **SSH cannot reach a Pod from here and never will.** Raw outbound TCP is blocked and the agent
  proxy's `CONNECT` re-terminates TLS, while SSH is not TLS, so every session dies at
  `kex_exchange_identification`. The transport that works is ordinary **HTTPS on 443** —
  `https://<podId>-<port>.proxy.runpod.net` — which the egress policy allows. **Never add a wildcard
  SSH config** (it changes behaviour for every agent on the box) and never disable TLS verification
  or unset `HTTPS_PROXY`.
- **Node's global `fetch` ignores `HTTPS_PROXY`**, turning every RunPod API call into `403 Host not
  in allowlist`. The CLI now re-executes itself with `NODE_USE_ENV_PROXY=1`.
- **`cleanup` is owner-scoped now.** A bare `cleanup` used to terminate *every* managed Pod on the
  account and on 2026-08-14 it killed another agent's live Pod mid-capture. `--all` refuses without
  `--yes`; `--older-than <min>` is the safe sweep for orphans.

### The disk: `git gc` is the lever, not deleting agents' work

The box reached **96% with 1.5 GB free**, and the obvious culprits were seven full-tree null-control
copies at ~1.2 GB each — modified two to twenty-seven minutes earlier, i.e. **live delete-the-fix
work in progress**. Deleting those to buy space is never the trade.

**The space was in `.git`, which had grown to 9.3 GB.** `git gc --prune=now` took it to 1.2 GB and
returned **8.3 GB** in one command with nothing lost. Try it first, waiting for a quiet index
(`pgrep git`). Two follow-ons: null-control copies clone the whole tree when a control needs only
`game/` and `tools/` — **76 MB against 12 GB** — and `tools/lib/browser.mjs` now refuses to launch on
low free space, closing the silent-`ENOSPC` class where a run that wrote nothing looked clean.

### `git status` clean is not evidence your work is in the tree

Four agents have now had finished work silently reverted, including this file twice. Ruling O1 blames
two agents holding one file, and that is part of it — but the rest is **`index.lock` contention**:
`bank.mjs` times out, `git commit --only` loses the race, and the tree looks clean afterwards because
the edit is simply gone.

**The technique that works, found by the `RI-WLD` agent: git plumbing, which never takes
`index.lock`** — `git commit-tree` plus a compare-and-swap `update-ref`. Use it when the box is busy.
And whichever route you take, **verify by grepping the committed blob for a string you know you
wrote**, not by looking at `git status`.

### The generalised rule, and it is not only about graphics

> **Statistics can fail a build and can never pass one.**

From the W1-30 review, and it is the most transferable thing found this week. That plan's acceptance
contract had dozens of rows checking *instrument validity* — does the metric implement the equation,
does the sabotage go red, is the population complete — and **effectively one** row where a human
being looks at a picture and says whether it is good. A build could pass every gate and still look
like a prototype, and the current build is the proof: it is an honest attempt at that plan.

Worse, the load-bearing signal was a family of image statistics **that procedural noise raises**, and
`render/visual-foundation.js:112` binds a 96×96 hash-noise field as albedo, height, AO *and*
roughness for the whole world. The metric was not lying; it was measuring the wrong thing, and noise
is the cheapest way to satisfy it.

**So, for every piece, not just visual ones:** a green metric is necessary and never sufficient. Ask
what a person would experience, and make *that* the gate — then use the statistics to catch
regressions underneath it. Any acceptance a single still from a single angle can satisfy is broken.
Directive §9 says the owner plays this game and finds it far below the bar across the board while the
dashboards read green; that gap is this rule, unapplied.

## 3. Reuse is structural, not aspirational

> *"if an agent finds an approach that produces a fantastic looking player character, can you reuse
> any of that approach for NPCs? If an agent creates some really nice looking building model, can
> that be tweaked and reused in different places rather than starting from scratch each time?"*

Every visual piece must state **what it reused and what it published for reuse**. A builder that
produces a good result by a bespoke route and leaves no shared asset, material, shader or recipe
behind has done half the job. This applies to models, materials, lighting recipes, animation rigs and
art-direction decisions alike.

## 4. Parallelism is a judgement, not a floor

> *"Remove the hard floor of 12 simultaneous tasks. Instead continuously qualitatively review and use
> your judgment as the implementation lead to set as much working in parallel as is sensible in a
> dependency safe and performance aware way. Maximising delivery speed and quality and minimising
> cost… things that can safely run in parallel always should."*

The floor is gone; the ambition is not. Collisions are the thing to avoid — two agents in one file
cost more to reconcile than they save — and idleness is still failure. The owner's own illustration
of safe concurrency: visual fidelity / art direction / animation work running alongside the Morrowind
UI (menus, journal, inventory, dialogue), the Morrowind HUD, dialogue text quality, collisions, and
world design. **Stay on top of this continuously** — it is a standing duty.

## 5. Progress travels as merged PRs; blogs become a twice-daily roundup

> *"I quite like this approach of agents regularly opening and merging PRs as progress updates in
> plain English… and would like this to keep happening going forward."*

Work lands on the `codex/wave1-build-experiment` branch via PRs whose descriptions are plain English:
what changed and **what the owner should now expect to see in the game.**

> *"Reduce blogs frequency. More like a twice daily roundup of key things done/achieved/improved that
> day with a selection of visuals and images to showcase. And they should be less harsh."*

**Tone is a hard requirement now, and the old tone is banned.** The owner named it:

> *"several times they've said things like 'nobody had ever wired [x] into the actual game' but
> actually I don't think that was unexpected, we just hadn't gotten to that bit of the build yet. So
> far that have had this kind of sarcastic style that I don't like: '[x] NPCs had been written, [x]
> lines of dialogue, over [x] regions. Nothing in the actual game touched any of it.' I don't like
> this. Make them more positive and kind and progress-oriented. But not hype-y or cheesey or over the
> top."*

An unbuilt thing is **not yet built**, which is the normal state of a project mid-wave — not a
scandal. Report honestly, warmly, and in the plain register of the recent PR descriptions. Rigour in
the *verdicts* is unchanged; this is about how progress is narrated to a reader.

## 6. The reference corpus itself may be insufficient

> *"do we have detailed Morrowind game region maps, topological maps or descriptions of regions? What
> about equivalents for Black Marsh? Are we building (and testing) for a similar level of richness of
> topology, geology, world design, road network etc within areas, and for canonical faithfulness to
> what the Argonia region is actually supposed to be like? Exploring Morrowind never felt dull, you
> were never just walking over samey landscape for ages, and our game should be the same."*

The bar is a build artefact like any other and can be wrong by omission. **Audit it, and extend it
where it is thin** — this is in scope, not a distraction. A piece that meets a bar which does not
describe the thing we want has not succeeded.

### Ruling W1 — where a player experiences instances, the bar binds on instances *(reversible)*

The corpus audit tested §6's worry and found the owner exactly right, with numbers. Between regions
the world clears its bar on merit. **Within** a region it does not: the Deep Marshes holds a **275-second
walk crossing one ground state**, Valus Ridge a **312-second** one with a **79% modal state**, and 11
of 13 regions are over target. The shape is the interesting part — the Deep Marshes has **93 distinct
ground states** and a walk that crosses one. Variety exists; it is arranged in patches larger than a
walk. **All of that passed every item we had.**

Every weak predicate the audit found has the same shape, and so did the graphics failure:

| item | how it passes while the game fails |
|---|---|
| `RI-WLD04` M18 | three of nine axes ask only for *"any difference"*; the slope axis is a χ² with no effect-size floor, so it passes automatically at n > 3,000 |
| `RI-WLD04` M19 | ONLY-HERE wants ≥ 8 instances and says nothing about spread — eight in one clump passes |
| `RI-WLD07` §4 | aggregate slope 10.07° sits mid-band while **7 of 13 regions are under 5.5°** |
| `RI-WLD02` | region-blind, where Morrowind's own place-type Jaccard runs 0.267–0.727 |
| `RI-WLD09` | mandated ≥ 240 s empty walks with no obligation on the landscape crossed |

**The ruling: an aggregate may never be the binding predicate for something a player meets one at a
time.** A player does not experience the mean slope of the province; they experience the slope of the
ground under their feet for the next six minutes. So bars over such populations bind on the
**worst constituent** or a stated quantile — never the mean — and any axis asking for "a difference"
must state the **effect size** that counts. The five replacements the audit specified are adopted.

**Reversal**: revert the predicates; each is a named edit. **Falsifier**: if binding on the worst
constituent makes a bar unreachable for reasons the player would never notice — one pathological
cell in a corner of the map — then the quantile is the right instrument and the ruling should move to
it, not back to the mean.

*And note how it was found.* The audit's own new instrument was briefly **inert in the dangerous
direction**: it matched any word from an element's description, so "root-levee (the road itself…)"
matched on *road* and it reported **71% landform coverage against a world containing none of them.**
Its self-check missed it because the negative control was an *empty* world rather than a *generic*
one. The honest figure is 5%. A null control has to be the plausible wrong answer, not the trivial
one — an empty world will fail almost any check by accident.

### Ruling O1 — the orchestrator caused the silent-clobber bug, and owns the fix *(reversible)*

**Three agents have now had committed work silently reverted mid-task**: the verdict-evidence agent
lost three edits, and `tools/cost.mjs` was reverted during the cost-experiment run, destroying an
experiments module that had already produced results. Each recovered, but each paid a round.

**The cause is not git; it is two agents holding the same file.** A `Write` replaces a whole file, so
when two agents both have that file in scope, the second silently erases the first regardless of what
git does. And the reason two agents held the same file is an **orchestrator dispatch error**: the
cost-dashboard agent built `tools/cost.mjs` and the cost-experiments agent was dispatched to extend
it while the first still had pending writes. `tools/ownership.mjs --conflicts` exists precisely to
catch that and the orchestrator did not run it before dispatching.

**Binding on the orchestrator from now on:** before dispatching an agent into any file, run
`node tools/ownership.mjs --for <path>` and `--conflicts`, and check `ListAgents` for a live agent
that built or is building it. A piece that must extend a file another agent owns goes to **that
agent via `SendMessage`**, not to a new one. This is the same discipline the `W1-30` decomposition
applies to the visual programme — ten children split by file so nobody shares one — and it should
never have been applied there and not here.

**Reversal**: none needed; it is a check, not a change. **Falsifier**: if clobbering recurs between
agents that provably never shared a file, the cause is elsewhere — most likely `bank.mjs` staging or
a merge — and this ruling should not be allowed to mask it.

## 7. Housekeeping the previous run let slip

Workers have not been updating these, and must: `docs/index.html`, `docs/progress.html`,
`docs/status.json`, `orchestration/INDEX.md`, `reports/blog-feed.jsonl`.

**Cost reporting**: the owner wants *"a line chart showing this over time so I can see how the cost
optimisation workstream has progressed over time and what impact it's had if any."*

**Morrowind-style HUD** must be covered somewhere — *"including minimal with compass directions"* —
alongside the wider Morrowind UI (menus, journal, inventory, dialogue).

**Corpus gate failures on GitHub**: many are failing. The owner has left it to the implementation
lead to decide whether they matter and whether anything should own them. Decide it in writing.

**Use `/goal`** to keep agents on the overall objective.

## 8. What was changed while Claude was away, and must not be undone

- Work is on **`codex/wave1-build-experiment`**, not the old Claude branch.
- Plans for every piece exist in `orchestration/plans/`, produced by a writer → reviewer-editor loop,
  planning from where this project had got to toward the Wave 1 bar.
- **Builders have run without critics.** Most plans are partially built and **none has been judged**.
  Sorting that into a sound sequence is an explicit part of the handover.
- The critic rule was amended: a critic **may PASS without inventing a gap** when the written bar is
  evidenced. The old phrasing implied no critic could ever pass anything, which would have meant the
  project never finished.
- Builder/critic ownership was re-cut; see `orchestration/plans/BUILDER-EXECUTION-CONTRACT.md`.

## 9. The owner's own assessment of where the game is

> *"When I play the actual game I can see that it is currently far, far below the 7/10 wave 1 bar in
> virtually every respect and every system across the board."*

Treat that as the ground truth it is: a direct observation from the only person who has played it.
Any status file, verdict or dashboard that disagrees is the thing that is wrong.
