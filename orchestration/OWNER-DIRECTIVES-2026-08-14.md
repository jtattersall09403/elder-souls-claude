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

**GPU is available.** RunPod tooling is in the repo (`tools/runpod/`) with `RUNPOD_API_KEY` and
`RUNPOD_GPU_TEMPLATE_ID` in the environment. Subagents that need real rendering should use it rather
than reasoning about what SwiftShader showed them.

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
