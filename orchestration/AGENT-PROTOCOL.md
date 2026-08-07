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

## Leave something for the blog — every agent, every run

The owner reads the blog to see progress, and it must not depend on a writer re-deriving your work
from your artifacts. **Make the blog agent cheap by doing the two things only you can do.**

Before you finish, if you found or built anything a person would find interesting:

1. **Copy one illustrative image into `docs/shots/`** with a dated, descriptive name — a before/after
   pair if you have one. You already have the world open; the blog writer would have to boot it
   again to get the same picture, and captures are the most expensive thing on this box.
2. **Append one line to `reports/blog-feed.jsonl`**:
   ```json
   {"at":"<ISO>","piece":"W1-xx","kind":"finding|fix|verdict|ruling","headline":"one sentence a
    non-developer would understand","shots":["docs/shots/…png"],"detail":"where to read more"}
   ```
   One sentence, in plain words. Not "CFS_live 0.0000" but "every weapon played the same animation".

This costs you a minute and saves a writer an hour of archaeology. A finding nobody can explain to a
player is a finding the owner cannot see.

## Parallelism: run as much as is safe, and the limit is contention, not headcount

> User direction: *"always be running as much in parallel as you can… always be assessing and
> pushing how much you can safely and effectively run in parallel."*

**Classify the work, then cap only the contended kind.** An agent authoring dialogue, quests, lore,
corpus items or a plan costs almost nothing beyond its own thinking. An agent driving a browser
costs a core. Capping both at one number starves the cheap work for no reason — which is what the
original blanket cap did.

| Class | What it does | Cap |
|---|---|---|
| **Browser-heavy** | steps the simulation in a page: probes, journeys, stepping loops | **6–8 concurrently** |
| **Picture-only** | needs frames but not a stepping loop | **uncapped — go through `tools/capture/`, never your own browser** |
| **Light** | writes content, edits the corpus, plans, decomposes, audits data, writes prose | **effectively uncapped** — run as many as there is useful work for |

### The number that actually matters is concurrent browsers, not agents

**Measure it, every time, before and during browser work:**

```
pgrep -c headless_shell ; cat /proc/loadavg
```

Measured on this box with eleven agents running: **36 `headless_shell` processes on four cores, loadavg 38–48.** A W1-13 journey that normally takes minutes ran for 35 minutes and had to be killed, so the round's aggregate figures went untaken — the second time in this project that contention, not the work, has cost a piece its headline numbers.

The reason the agent count misleads is that **one agent is not one browser**. A probe suite that opens a page per scenario, or a capture script that relaunches between shots, is five or ten browsers by itself. Eleven agents was never eleven browsers.

**The working rule: keep `pgrep -c headless_shell` under about 8.** If it is above that when you are about to start a stepping run, do something else first — there is nearly always corpus, data or content work in your piece that needs no browser — and come back. If you take a measurement anyway, say so in your report and treat every timing figure as an upper bound. Rates, counts and booleans survive contention; milliseconds do not.

**Reuse one browser across your whole run.** Launch once, keep the page, `setRenderRate(0)`, step. Relaunching per scenario is the single most expensive habit in this project.

### Do not launch a browser for a photograph

`tools/capture/` pools captures behind one warm browser with a build-keyed cache. A hit is **9 ms
against a 47.9 s miss**, and four agents through the service left load flat where four direct
browsers took it from 10.8 to 23.0. It is now also **safe to cite**: the arrival gate went from
accepting **28 of 30** laundering specs to **0 of 30**, and the cache no longer replays a manifest it
did not write — a hand-written sidecar that used to be served in 24 ms stamped `arrival: "walked"`
is refused and falls through to a real render. `--pin-build` if you are testing the cache itself;
on a busy box the build key changed **four times inside one run**, so an unpinned two-request test
measures other agents' edit rate, not the cache.

So: if what you need is a picture of somewhere, **ask the service**. Launch your own browser only
when you are genuinely stepping the simulation, and say in your report which you did.

### Split your piece into a phase that needs a browser and one that does not

This is how the project runs more work at once without measuring under distortion. Most pieces are
mostly authoring: data, dialogue, quests, corpus text, tools that read JSON. **Do all of that
first**, with no browser open, and bank it. Then take the browser for the verification pass only.
Two agents phased this way finish in the wall clock of one, and a stall in the browser phase does
not cost the authoring.

`tools/lib/combat-node.mjs` runs the combat modules in bare Node — no engine, no browser, ~500×
faster — and is the right instrument for frame-level geometry. It **diverges from the browser for
long fights** because the engine's fixed step also runs stealth perception, which is what makes an
enemy turn. Iterate in node; confirm every behavioural claim in the browser.

**Why the browser cap moved.** It was 6–7 when *every* agent launched its own browser: fourteen
agents drove load to 44–103 on four cores, a 1280×720 capture went from 25 s to 150–260 s, and a
builder's 117-frame region pack managed three frames in twelve minutes and had to be abandoned.
`tools/capture/` now pools that work behind one warm browser with a build-keyed cache — a cache hit
is **9 ms against a 47.9 s miss**, and four agents through the service left load flat where four
direct browsers took it from 10.8 to 23.0. Pooled capture raises the ceiling; it does not remove it,
because probes that step the simulation still each need a page.

**Check before dispatching, every time:** `cat /proc/loadavg`. Sustained load above ~12 on this box
means measurements are being distorted, and an agent that reports a number taken under that load
should say so. If you are near the cap, prefer dispatching light work — there is nearly always
content or corpus work that needs no browser at all.

**The standing instruction is to keep the pipeline full.** A finished piece with no critic dispatched
is the loop stalled; an unstarted wave-1 piece is the plan not being executed. Both are worse than a
busy machine.

Measured during wave 1: with fourteen agents running, load reached **44–103 on four cores**. A
1280×720 headless capture costs **25 s on a quiet box and 150–260 s under that load**. The W1-01
round-4 builder's 117-frame region pack managed **three frames in twelve minutes** and had to be
abandoned, so the piece's headline number — the one the whole round existed to move — went
unmeasured. That was an orchestration failure, not a builder's.

If you are an agent and the box is loaded, say so in your report rather than shipping a number you
could not take properly. Check with `cat /proc/loadavg`. Prefer `--width 320 --height 240` and
`__HARNESS.setRenderRate(0)` for anything that is not a screenshot; a stepping loop that renders is
the single most expensive thing in this project.

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

## Your numbers expire, and the tree moves under you

Fifteen agents edit this repository at once. A measurement is a claim about a **commit**, not about
the project, and a neighbour landing an hour later can make it false without anyone touching your
files.

This has now happened for real. A faction round reported **16 of 16**, with its proudest claim being
*"the walk wrote no reputation at all — 398 was paid entirely by the quests' own consequences."* A
critic re-ran the same probe with the same command line eighty minutes later and got **8 of 16**,
with the walk writing reputation at every rank. Nothing in the faction files had changed. A
different agent had given the quest offer gate a giver-presence term, and neither faction probe
stands the player in a populated world — so `open()` refused, so the probe's own fallback fired, so
the reputation the walk was supposed not to write got written. **The headline was never independent
of a gate that did not exist when it was measured.**

So, binding on builders and critics alike:

1. **Stamp the commit on every number you report** — `git rev-parse --short HEAD` at the moment you
   take it, not at the moment you write it up. `git.dirty` is worth recording too; it usually is.
2. **Re-run your headline measurement immediately before you finish.** If it moved, that is your
   most interesting finding, not an inconvenience.
3. **Read the status files of agents working nearby before you start**, and list in your own which
   files you are touching. Their `next_step` tells you what is about to land on you.
4. **A critic re-running a builder's probe unchanged is doing the single highest-value thing
   available**, and should do it before writing anything else.
5. **When your instrument disagrees with the world, suspect the instrument first.** The same critic's
   first run said *"0 of 17 givers, 53 quests given by nobody"* and it was one paragraph from filing
   *"the content is unreachable"* — when another critic's tool, written for another piece, showed 62
   of 62 present. The content was placed; the probe was not standing in the world.

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
3. **A round trip that re-serialises cannot see a field nobody reads back.** The save repair
   reported 76 of 76 trials clean across every shipped state and two seeds. A critic pointed out
   that the headline check is a *fixed-point test on the serialiser*: a field that is written and
   never read back into the live world still re-serialises to exactly what was saved, so it passes
   forever. It then audited the **live world** after a load instead of the blob, and found the
   spendable purse is destroyed on a plain round trip while every existing check reports clean.
   **Audit the running world after the load, not the bytes.**
   The same critic's other half is worth as much: widening the seed sweep from 2 to 10 changed
   **nothing**, and widening the *moment* the save is taken changed everything — the builder's
   single pre-roll never died, never fell and never held money, and both failing scenarios were
   moments rather than seeds. **Vary when you save, not just what.**
4. **A still target hides every steering defect.** A spell's tracking cutoff was applied to the
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
