# Agent durability protocol

**Every agent dispatched in this project MUST follow this. It is not optional.**

Agents in this environment are killed without warning when the session hits its usage limit.
Several have already died after doing 20+ minutes of good research and writing **nothing**, losing
all of it. The rule that prevents this is simple:

> **Write early, write often, write incrementally. Never hold work in your head.**

## The three rules

### 1. Checkpoint before you research

Your **first action** — before any reading, searching or thinking — is to create your status file:

```
orchestration/status/<your-task-id>.json
```

```json
{
  "task_id": "weapons",
  "brief": "orchestration/briefs/weapons.md",
  "started": "wave-0",
  "state": "researching",
  "outputs_expected": ["corpus/12-weapons/RI-WPN01-...md", "..."],
  "outputs_written": [],
  "findings": [],
  "next_step": "read RI-CMB02 for frame conventions",
  "notes_for_successor": ""
}
```

### 2. Write each deliverable as soon as it is ready

Do **not** research everything and then write everything. Finish one reference item, write it to
disk, append its path to `outputs_written`, update `next_step`, move on. A half-finished corpus
area is worth enormously more than a perfect one that was never saved.

If a deliverable is large, write it in sections and keep appending. A partial file with a
`<!-- WIP: sections 4-6 outstanding -->` marker at the bottom is a good outcome.

### 3. Bank findings the moment you have them

Anything you discover that a successor would otherwise have to rediscover — a measured number, a
usable data source, a contradiction between two corpus items, a dead end you ruled out — goes
into `findings` in your status file **immediately**. Research is the expensive part; never lose it.

Use `notes_for_successor` for anything that would let a fresh agent pick up mid-task: what you
had decided, what you were about to do, what you'd try differently.

## On resume

If your status file already exists when you start, **you are a successor**. Read it, read your
brief, read whatever outputs already exist on disk, and **continue from `next_step`**. Do not
restart. Do not rewrite finished deliverables — extend and finish the unfinished ones.

## Finishing

When every expected output exists, set `"state": "complete"` and summarise in your reply. If you
finish early or find the brief impossible, set `"state": "blocked"` with the reason — a blocked
task honestly reported is a result; a silent failure is not.

## Why this matters more than it looks

The corpus is the project's memory. An agent that dies with unwritten work costs the project the
whole session's budget for that area, and the next agent starts from zero. An agent that dies
having written four of six items and a good status file costs almost nothing — its successor
finishes in a fraction of the time.

## Driving the game from a probe — read this before you write a stepping loop

Found by the W1-15 round-2 builder after it had cost several rounds of wall clock, and almost
certainly costing others the same:

`Engine.stepFrames()` ends with `if (loop.renderRateHz !== 0) loop.renderNow()`. So a probe that
steps **one frame at a time** renders one full SwiftShader frame per *simulation* frame. Measured:
600 bare simulation frames cost **71 ms**; the same 600 driven one at a time with the renderer live
never returned and killed the page.

**Before any stepping loop:**

```js
await page.evaluate(() => window.__HARNESS.setRenderRate(0));   // then step freely
```

and launch at `--width 320 --height 240` unless you are actually capturing screenshots. Turn
rendering back on only for the frames you photograph.

Also: `tools/lib/combat-node.mjs` runs the combat modules headless in bare Node — no engine, no
browser, roughly 500× faster. **It agrees with the browser for short measurements and diverges for
long fights, and the difference is not a rounding error.** It runs `CombatSystem.step` alone, while
the engine's fixed step *also* runs stealth perception — and perception is what sets
`alertState = AGGRO` and makes an enemy steer at 240 °/s between attacks. In the node arena the
enemy never turns: the W1-09 round-3 critic measured the two as frame-identical for 194 frames and
then diverging, with the champion's yaw drifting 85.5° off the player by frame 1700. Reach figures
agree to the digit. Fight outcomes do not, and a fight the node arena says you survive is one the
game kills you in.

Use it to iterate on frame-level geometry. **Confirm every behavioural claim in the browser.** Do
not publish a number that has only ever been seen outside the browser — and note that
`cmb-reach.mjs --verify`, which two files claim cross-checks node against browser, **does not
exist**; the flag is silently ignored. Check that a flag you are relying on is implemented before
you cite it.

## If a method names a tool that does not exist, build it

Binding on builders and critics alike. See `orchestration/TOOL-LOOP.md` for the full rule.

**67 of the 82 tools named across the corpus did not exist on disk.** Items that name a phantom
tool still *score*, so four builders were charged for the corpus's missing instruments — one piece
could not reach its gate by arithmetic, and another item had never been run on any build.

So: **write the tool then and there.** The item's `## Comparison method` is the specification —
build what it describes, not a simpler thing wearing its name. If the tool cannot be written
honestly because the system it measures does not exist, make it report that absence and exit
non-zero; never stub it to pass. A critic that writes a tool mid-run must declare it under
`method_deviations`. A builder that writes a tool still does not grade itself with it.

Run `node tools/corpus-index.mjs` and read the C8 warnings to see what is missing. C8 is a warning
in wave 1 and a hard error from wave 2.

## Two failure modes that have each cost a full round

1. **The verdict may name a dead call site.** The W1-15 round-1 verdict named `sim/entities.js`
   as the place to fix. `stepEntities()` is not called from `sim/step.js` at all — the live code
   was in `combat/enemy.js`. Patching the named file would have changed nothing observable and the
   piece would have returned a third time at the same measurement. **Confirm the code you are about
   to change actually runs**, by perturbing it and watching the world, before you change it. Two
  parallel implementations of the same system is how this build came to have one good detection
   model and one broken one at the same time.
2. **A probe that cannot fail is worse than no probe.** Several wave-1 probes passed against
   disconnected models, empty result lists and vacuous controls. Before trusting your own
   instrument, break the thing it measures on purpose and confirm the instrument goes red.
3. **A still target hides every steering defect.** A spell's tracking cutoff was applied to the
   flight a bolt *would* have had if it hit nothing, rather than the flight it actually had — so it
   was still steering well past its fence. Against a stationary target the arc closes in about 15
   frames and the defect is invisible, which is exactly how wave 1 recorded it as "0.000 °/s" and
   passed. The same trap applies to reach, aggro, perception and hit resolution: **if the thing you
   are measuring responds to motion, the target must move.** A control that cannot exhibit the
   failure is not a control.

## Network access (updated mid-wave)

**Outbound internet is now unrestricted.** Earlier agents worked under a policy proxy that
403'd almost everything, which is why much of the corpus is `provenance: canonical-recall,
confidence: medium`. That constraint is gone. Reachable and verified: Wikimedia, imgur, Steam,
YouTube, the Fextralife wikis, GitHub, and general web fetches via `curl`, plus `WebSearch` /
`WebFetch` through `ToolSearch`.

Two consequences, both binding:

1. **Verify before you recall.** If a number can be checked against a real source, check it.
   `canonical-recall` is now a last resort, not a default. Anything you verify becomes
   `community-data` with the URL cited inline.
2. **`en.uesp.net` still returns 403** — that is UESP's own bot protection, not the proxy. Do
   not waste effort on it. Use the vendored extract instead:
   `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` (6,299 pages) via `tools/uesp/`, and
   `corpus/40-dialogue/data/morrowind-dialogue.csv.gz` (69,876 dialogue rows).

If you are resuming a task whose predecessor worked under the old restriction, its provenance
notes may understate what is now checkable. Upgrading a `canonical-recall` figure to a cited
`community-data` one is always in scope.
