# The efficiency programme — a quarter of the cost, none of the quality

**Owned by the orchestrator. What it is for: the one place that states what the cost bar is, which
rulings bind right now, and what may never be traded away to hit it.** It is a standing goal with the
same status as the build: it runs *in parallel with* the game, through the same gauntlet, and it does
not finish when a number is hit — it finishes when the number is hit **and holds** with every quality
guard intact.

> Owner, verbatim: *"reduce cost per hour of runtime to one quarter of what it is now (calculated
> from token usage by model types), **without making any sacrifices** in terms of quality, delivery
> speed (tasks running in parallel), and rigour. I don't want to save cost by running more slowly or
> performing worse. I want to increase **efficiency**."*
>
> And on method: *"Have the sub agents search online to research methods that are proposed to work
> for our type of project and gauntlet loop workflow and test them out, measuring the results,
> reversing things that haven't worked or have had negative effects (reversibility is essential),
> and iterating until the bar is met. They must use scientific method and **measure**, not guess."*

**The history of how this document reached its current shape — every superseded reading, every
correction the plan loop caught, the full ledger data contract and the levers ranked as hypotheses —
is preserved in full at `orchestration/archive/COST-HISTORY-20260814.md`.** Read it when you want to
know why a ruling says what it says, or before you re-adopt something this programme already killed.

## 1. The bar, stated so it cannot be gamed

The headline metric is the owner's: **C/H — model spend in US dollars per wall-clock hour of fleet
runtime**, priced from token counts by model *and by token class*. Input, cache write, cache read and
output are four different prices; treating them as one is the first way this measurement goes wrong.
**Target: ≤ 25% of the measured baseline.**

C/H alone is trivially gamed — run three agents instead of fifteen and it collapses, having achieved
nothing but a slower project. So the target is met only when **all four guards hold simultaneously**:

| # | Guard | Measured as | Fails if |
|---|---|---|---|
| **G0** | **Cost** | C/H against baseline | > 25% of baseline |
| **G1** | **Throughput per step** | steps of `ROADMAP.md` completed per day, each with a player-visible outcome | **no completed step in a working day** |
| **G2** | **Quality** | verdict scores; critic find-rate (findings per critic) | either falls vs baseline |
| **G3** | **Rigour** | count of runs of the five non-negotiables (below) | any declines |

**G1 is throughput, not concurrency, and there is no parallelism floor anywhere in this programme.**
The owner ruled on 2026-08-14: *"Run less in parallel at once… go slower, more methodically, make
fewer mistakes, do fewer things at once"*, and separately *"set as much working in parallel as is
sensible in a dependency safe and performance aware way."* Concurrency was only ever a proxy for
delivery; the direct measure is **a completed roadmap step with something the owner can see in the
game.** Three agents finishing one visible thing a day beats fourteen finishing none.

**What G1 still protects is the failure mode of paying less by delivering less.** This programme may
never buy a saving by running fewer agents than the dependency graph safely allows — that is the guard,
and it is not a number.

> **`tools/cost.mjs:500` still hard-codes `floor: 12`** and will keep printing `floor 12 -> ok`
> against a number that no longer means anything. **The field is stale, not authoritative, and nothing
> should be concluded from it.** Owed change, named here so it is not discovered as a surprise.

**The diagnostic that proves it was efficiency and not idling: cost per agent-hour, and cost per
completed player-visible roadmap step.** If C/H fell 4× and cost-per-agent-hour did not fall, the fleet
simply got smaller and the programme has failed. Report both, always, in that order.

### The five non-negotiables (G3), which no cost measure may reduce

Every one has caught something expensive, and each is cheap relative to what it prevents:

1. **One separate critic with fresh context per piece.** No agent grades its own work.
2. **Delete-the-fix** — remove the change on a copy and confirm the old number returns.
3. **The CONSUMPTION check (`RI-MTH07`)** — name the world-side consumer and perturb the model to
   demonstrate it.
4. **A self-test whose arms genuinely disagree.** A probe that cannot fail is worse than no probe.
5. **Reading the actual file rather than trusting a summary.**

**G3 ships as `unmeasured`, and that is the honest state.** Four of the five are not honestly
measurable today: they exist only in verdict prose, a grep counts the word rather than the act, and
just 2 of 95 verdicts carry a structured header. They are published as `null`/`unmeasured` — **never
as a green tick.** A guard that cannot be measured must not be allowed to read as passing.

## 2. The instrument, and where the money actually is

**`tools/cost.mjs` is the only thing that computes cost.** The ground truth is the session transcripts
under `/root/.claude/projects/`, and three facts about them are load-bearing:

1. **The source is 403 files / 638 MB, not one file.** The orchestrator's own session is **9.3% of the
   money**; subagent transcripts live in `<session>/subagents/`. An instrument that reads only the
   orchestrator's glob understates total cost by about **10.7×** and looks entirely plausible doing it.
2. **Deduplicate by `message.id`.** One API response is written as several JSONL records sharing one
   `usage` block; 84,490 usage-bearing records collapse to **46,575 distinct requests**. Summing
   records inflates cost **1.81× overall and 2.58× on output**. Take the element-wise **max** across a
   message's records — only the terminal record carries the true `output_tokens`.
3. **There are five priced token classes, not four.** `cache_creation` splits into `ephemeral_5m`
   (1.25× base) and `ephemeral_1h` (2×), and **both occur here** — the orchestrator uses the 1-hour
   TTL, subagents the 5-minute.

**The baseline: $5,792.69 over 62 hours → C/H = $111.40/h, cost per agent-hour $8.51. Target:
C/H ≤ $27.85/h.** The corrected instrument reads the same window at **C $6,025.85, C/H $115.88,
$/agent-hour $8.71**.

**Where the money is, and it is not where instinct says:**

- **Cache reads are ~79–81% of spend and the hit ratio is already 98.39%.** The cache lever is close
  to dead — there is almost no miss left to convert.
- **Output is 3.93% of spend, median 16 tokens.** **Writing shorter is worth approximately nothing.**
  Every instinct to trim prose is aimed at 4% of the bill.
- **Cost is context volume × request count.** Median context **190k**, **103 requests per agent**.
  That product is the thing to attack, and nothing else is close.
- **Model mix alone caps at 0.6× at list price**, because every model's price vector is
  `base_input × [1, 1.25, 2, 0.1, 5]`. It cannot reach the 25% bar by itself: **volume must fall about
  2.8×** on top of it.

**Current standing, measured 2026-08-14: 94,831 Opus requests against 9,113 Sonnet — 91.2% Opus,
$124.26/h, 107.2% of baseline.** The largest lever in the programme is the one C5 and C6 name.

### The methodological finding that constrains every experiment

**Cost-per-run has a coefficient of variation of 0.97.** Detecting a 25% effect in dollars would need
roughly **238 runs per arm (~76 hours — longer than this project's entire history).** So attribution
**cannot** rest on comparing dollar totals between waves. It must rest on **mechanism** — measured
token flows through the specific path a change touches. **Any experiment whose acceptance is "the bill
went down" is unfalsifiable here.**

## 3. How the programme runs — the same gauntlet, pointed at ourselves

Each efficiency change is a **piece** and runs `PLAN-LOOP.md` exactly as a game piece does: plan →
fresh plan critic → remediation and fresh re-criticism until SATISFIED → build → fresh build critic.
**No agent grades its own saving.** This matters more here than anywhere, because a change that
quietly costs quality shows up as a cost saving on every dashboard.

**Research is part of the method, not a preamble.** An external claim is a hypothesis with a citation,
never a result: cite it, test it on this repo, publish the measured delta. A technique that works in
someone's blog post and not in our numbers is a finding worth writing down.

**Reversibility is a hard requirement, not a preference.** Every change lands with:

1. the **measurement before**, taken with the instrument, not recalled;
2. a **named reversal** — the commit or flag that undoes it, in one step;
3. the **measurement after**, on the same instrument;
4. a **stated tripwire**: the guard value that, if breached, triggers the reversal.

**A change whose reversal has not been *executed at least once on a copy* is not reversible — it is
merely believed to be.** That is rule 6 applied to cost.

## 4. The rulings that bind

Each is reversible and names its own reversal. Full reasoning, controls and measurements for every one
are in `orchestration/archive/COST-HISTORY-20260814.md`.

### Ruling C1 — burst staggering is REVERTED, because its own tripwire fired

Staggering a burst's first agent to warm the cache prefix was adopted, measured, and killed:
**ceiling 0.32% of spend against C1's own 2% bar**; tight versus staggered bursts give a warm fraction
of **0.958 vs 0.965** against a 10pp bar, and **378 of 403 agents already read cache on their first
request** — there was almost no cold start to remove. **Bursts dispatch together.**

**This is the first hypothesis this programme killed, and it was the orchestrator's own.** It is
recorded with its magnitude precisely so nobody re-adopts it next month on the same argument. It is a
revert, not a closed question: the figure came from a prototype parser, so experiment **E1** requires a
builder to *reproduce it independently rather than confirm it*, with a cold-start control that fails
loudly if the builder reproduces the prototype's bug instead of its finding.

### Ruling C2 — never select a metric after seeing which reading passes

C2's subject was G1 as it stood *before* the 2026-08-14 inversion — mean versus median concurrent
agents — and **the concurrency statistic is no longer a guard**, so that half of it is spent. What
binds, and binds everywhere in this programme, is its methodological core:

**A metric is chosen before its readings are seen. Report the median rather than the mean where a
burst can satisfy a guard the median would fail, and publish the alternative reading beside it.**
Selecting the passing reading after the fact is the inert control in another costume, and it would be
indefensible to forbid it in a builder and permit it in our own scorecard.

### Ruling C3 — split long pieces at ~100 requests, as a trial *(reversible, trial)*

**A handoff costs $0.43. Break-even is $6.26. The lever is real** — a 14.6× margin, and the ceiling
survives nearly intact at **$1,872.81 − $128.63 across 299 handoffs = $1,744.18**. Re-orientation is
paid in **extra requests, not heavier ones**: a successor takes **20 requests** to reach its first
`Write`/`Edit` against **11** for a fresh agent in the same window.

**Three tripwires, and §5 binds hardest here — this shortens an agent's *waste*, never its *work*:**

1. **Cost** — the handoff figure re-measured on deliberately split agents rises above **$2.00**.
2. **Scope** — total requests summed across a split piece's agents falls below the pre-split median for
   comparable pieces. **A split that shortens the work is not a saving.**
3. **Quality** — critic find-rate or the G3 separate-critic count falls on the split arm.

**Reversal**: one line in the dispatch brief returns long pieces to a single marathon agent.

### Ruling C3a — the trial has an instrument, and the planned arm is still empty

`tools/cost.mjs --split-trial` computes all three tripwires. **Nothing has been split on purpose yet —
`planned_split: 0` across 478 subagents — so every "after" column is empty by construction, not by
measurement**, and the instrument refuses to pretend otherwise.

**How to dispatch a split so the instrument can see it: put `split N/M` in the dispatch title** (e.g.
`"W1-33 canopy — chunk 2 of 3"`). **A split that does not say so is invisible to every tripwire.**

**The frozen BEFORE:** tripwire 1 **$0.4302** (n = 50); tripwire 2 **265** requests per unsplit piece
(28 pieces) against 1,197.5 for the 14 accidentally-split ones; tripwire 3 find-rate **1.30** gaps per
verdict on unsplit pieces. **Tripwire 2 is biased against firing** — a piece is split *because* it is
large — so read it as "no alarm", never as "scope preserved".

### Ruling C4 — waste is a measured category with its own ledger

> Owner: *"if a subagent somehow loses a load of work that then has to get rebuilt, that's a huge
> unnecessary token cost. If two agents clash on something we then have to waste tokens fixing the
> clash. If two agents are both independently generating the same outputs from tool uses then that's a
> waste."*

**Waste is invisible to C/H, which is why it has grown unchecked.** Cost-per-hour does not fall when
work is lost — it *rises*, and the rise is indistinguishable from doing more work. Every other lever
asks "can this token be cheaper"; this one asks **"did this token need to be spent at all"**.

| # | Class | Observed instance |
|---|---|---|
| **W1** | **Lost work** — completed, then destroyed | a GPU agent's transport code, proven on live hardware, clobbered and rewritten |
| **W2** | **Clobber-and-repair** | `reports/blog-feed.jsonl` clobbered **three times in forty minutes by three agents** |
| **W3** | **Duplicated build** | two agents independently built capture tooling; two independently built fresh-checkout validators |
| **W4** | **Re-derivation** — a fact recomputed because it was not published as data | the tool population counted 786, then 776, then again |
| **W5** | **Wasted dispatch** — an agent sent at work already done, or against a bar that moved | **29 plans sat `satisfied` and dispatchable against predicates overturned that morning** |
| **W6** | **Failed-run waste** | captures silently truncated by `ENOSPC` and banked as zero bytes |
| **W7** | **Clash reconciliation** — tokens spent merging rather than building | conflicts resolved by regeneration |

**The prevention rules, which are worth more than the measurement:**

1. **A fact measured is published as data, not prose** (kills W4). A number in a JSON file with its
   method beside it is consumed; a number in a report paragraph is recomputed by the next three agents.
2. **Before dispatching, name what already exists** (kills W3/W5). `node tools/dispatchable.mjs` and
   `node tools/ownership.mjs --conflicts` exist for this. Every brief should say what to consume.
3. **A ruling needs a route into the documents it binds** (kills W5). Twenty-nine plans against a
   superseded bar was **one unpropagated directive**, not twenty-nine defects.
4. **Landing work is a solved problem — use the solution** (kills W1/W2). `node tools/land.mjs
   "<headline>" --paths <yours>`, and verify against the remote blob. Every loss was preventable by an
   already-written procedure.
5. **Fail loudly or not at all** (kills W6). A truncated capture banked as zero bytes, a bank exiting 0
   after failing, a gate satisfied by a comment — each cost more than the failure it hid.

**Reversal**: drop the ledger; it is additive and nothing depends on it.

### Ruling C5 — model routing is the ORCHESTRATOR's act, at dispatch

**Nothing an agent writes into a file changes which model the next agent runs on — the model is chosen
by whoever calls the dispatch tool, at the moment of the call.** The policy had been written down since
the programme began and never applied, because it was filed as work an agent could land. Every cost
agent that "adopted" routing adopted a document while the fleet kept running on Opus.

Route by **what the agent's output has to survive**, never by how important the piece sounds. The test:
***if this agent is subtly wrong, does something else catch it?***

**Reversal, one step: stop passing `model` at dispatch.** The fleet returns to inheriting the session
model on the very next spawn — no file to revert, no state to unwind. That is the cheapest reversal in
the programme, and it is a reason to start now rather than plan more.

### Ruling C6 — route aggressively, size the task to the model, and VERIFY it in the transcript

**2026-08-14 evening, at the owner's direction:** *"Route more aggressively to Sonnet, and make sure
this is actually happening in practice and not just theory. Keep Opus for where it's really needed.
Break tasks down to an appropriate size for each sonnet agent."*

**The default is Sonnet.** Opus is the exception and must be *justified at dispatch*.

- **Opus, and the list is deliberately short:** critics, plan reviewers, arbiters, blind judges,
  anything producing a score or a verdict, anything *designing* a control or a null arm, and the
  orchestrator. **That is the quality guard and it does not move** — the gauntlet is what catches the
  false claims, and buying a saving with it would be buying it with the only thing that makes the
  numbers trustworthy.
- **Sonnet, which is now most work:** builders following an approved plan, censuses, sweeps,
  enumeration, data authoring, tooling, fixes with a stated acceptance number, and anything a
  downstream critic will check.

**Sizing is the half that makes it work.** A model change without a scope change just moves the
failure. **A Sonnet piece is one clear objective with a stated acceptance number, not a five-part
investigation.** Practical shape: **if a brief contains the words "decide whether", "rule on", or
"judge which", it is either an Opus piece or it is two pieces** — the ruling is the orchestrator's job,
and what reaches the builder is the decision plus the acceptance test.

**Verify, because "in theory" is exactly how routing failed for weeks.** The policy existed for weeks
and the fleet ran 91% Opus the entire time, and nobody checked. So the check is part of the tick:

```
cd /root/.claude/projects/-home-user-elder-souls-claude/<session>/subagents \
  && grep -ho '"model":"claude-[a-z0-9-]*"' *.jsonl | sort | uniq -c
```

**Baseline at the moment of this ruling: 94,831 Opus against 9,113 Sonnet — 91.2% Opus.** Report the
ratio in every cost update. **A ruling whose adoption is never measured is a document, and this project
has enough of those.**

**Guards for C5 and C6, which are the same guards.** Quality tripwire: verdict scores and critic
find-rate per tier — if Sonnet-routed builders are overturned by their critics materially more often,
the class moves back. Read it carefully: a cheap builder whose critic finds *more* may be the gauntlet
working as designed; **the silent failure is a cheap *critic* missing things, which is why critics
never move.** The confound, stated so nobody quotes a rigged comparison: **Sonnet pieces are *selected*
for being easier, so cross-tier quality comparison is confounded by construction.** The only clean read
is within one class of work, before and after it moved.

## 5. What this programme may never do

- **Never cut a critic.** The separate-critic rule is where the quality lives; a build with no critic
  is cheaper and worthless.
- **Never cut the controls.** Delete-the-fix, the null control and the self-test that goes red are the
  only reason any number here means anything.
- **Never trade delivery for cost.** This programme may never buy a saving by running fewer agents than
  the dependency graph safely allows, and never by shortening an agent's *work* rather than its
  *waste*.
- **Never report a saving without its guards.** A cost number published without G1–G3 beside it is not
  a result, and the orchestrator should reject it and say so.

## 6. Reporting — on the published dashboard, with pictures

The programme keeps a running ledger: baseline, every change with its before/after and reversal, and
the current C/H against the 25% bar with all four guards. **That ledger is published on
`docs/progress.html`, the page the owner actually opens** — a number that lives only in a report file
is a number the owner never sees.

**The instrument is the only thing that computes cost** (rule 10 — not two implementations of one
system). It writes the machine-readable ledger at **`docs/data/cost-ledger.json`**; the full field-by-
field data contract is in `orchestration/archive/COST-HISTORY-20260814.md` §6.1.

**A cost figure is never published without its guards beside it** — verdict scores, critic find-rate,
and the count of the five non-negotiables. **Refresh cadence: every bank.** `tools/bank.mjs` runs every
few minutes and the pre-commit hook refreshes the ledger with it.
