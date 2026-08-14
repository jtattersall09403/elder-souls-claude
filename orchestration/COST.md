# The efficiency programme — a quarter of the cost, none of the quality

**This is a standing goal with the same status as the build.** It runs *in parallel with* the game,
through the same gauntlet, and it does not finish when a number is hit — it finishes when the number
is hit **and holds** with every quality guard intact.

> Owner, verbatim: *"reduce cost per hour of runtime to one quarter of what it is now (calculated
> from token usage by model types), **without making any sacrifices** in terms of quality, delivery
> speed (tasks running in parallel), and rigour. I don't want to save cost by running more slowly or
> performing worse. I want to increase **efficiency**."*
>
> And on method: *"Have the sub agents search online to research methods that are proposed to work
> for our type of project and gauntlet loop workflow and test them out, measuring the results,
> reversing things that haven't worked or have had negative effects (reversibility is essential),
> and iterating until the bar is met. They must use scientific method and **measure**, not guess."*

## 1. The bar, stated so it cannot be gamed

The headline metric is the owner's: **C/H — model spend in US dollars per wall-clock hour of fleet
runtime**, priced from token counts by model *and by token class* (input, cache write, cache read,
output are four different prices; treating them as one is the first way this measurement goes
wrong). **Target: ≤ 25% of the measured baseline.**

C/H alone is trivially gamed — run three agents instead of fifteen and it collapses, having achieved
nothing but a slower project. The owner ruled that out in the same breath, so the target is only met
when **all four guards hold simultaneously**:

| # | Guard | Measured as | Fails if |
|---|---|---|---|
| **G0** | **Cost** | C/H against baseline | > 25% of baseline |
| **G1** | **Parallelism** | mean concurrent agents over the window | < 12 (RULES/TICK floor) |
| **G2** | **Quality** | verdict scores; critic find-rate (findings per critic) | either falls vs baseline |
| **G3** | **Rigour** | count of runs of the five non-negotiables (below) | any declines |

**The diagnostic that proves it was efficiency and not idling: cost per agent-hour.** If C/H fell 4×
and cost-per-agent-hour did not fall, the fleet simply got smaller and the programme has failed.
Report both, always, in that order.

### Ruling C2 — G1 is the median, not the mean *(reversible)*

The `COST-INSTRUMENT` plan found G1 has **two honest readings that disagree**: mean concurrent agents
**13.10**, which passes, against a median of **11 with 35 of 63 hours below the floor**, which fails.
It reported that it *chose the passing one after seeing which passed*, and named that as its critic's
strongest move against itself. That disclosure is the reason this ruling can be made at all, and it
is exactly the standard expected.

**G1 is measured as the median, and additionally the fraction of hours below the floor must not
increase.** Two reasons, and the second is the one that decides it. First, the mean is inflated by
bursts, and a guard against fleet shrinkage that a burst can satisfy is not guarding. Second,
**selecting a metric after seeing which reading passes is the defect this whole project is built to
catch** — it is the inert control in another costume, and it would be indefensible to forbid it in a
builder and permit it in our own scorecard. On this reading **G1 currently fails**, which is the
correct starting state for a programme that has not yet done anything.

**Reversal**: one line in the instrument. **Falsifier**: if the median proves to be dominated by
container restarts and usage-limit kills — periods when the fleet was destroyed rather than
under-dispatched — then it is measuring survival, not intent, and the ruling should be revisited with
those windows excluded rather than the metric swapped.

> **AMENDED 2026-08-08 by the `COST-INSTRUMENT` plan critic (Ruling P1, plan §11.4.1).** C2 names a
> statistic without naming its series, and the two are not the same thing. Measured: the "median 11,
> 35 of 63 hours below floor" pair is the **span**-hour series; on the **52 active hours** that H
> itself uses, the median is **12.5** with **24 of 52 (46.2%)** below the floor. And the two readings
> §4.1 calls "honest readings that disagree" **do not disagree** on the same hour set — requesting
> 13.31/12.5/24 against present 13.42/12.5/24. The whole gap was the 11 idle hours, not the agent
> count. **Amended ruling: median, over the same active-hour set as H, requesting reading, present
> published beside it; the binding guard is that the below-floor fraction must not increase.** On
> this reading the baseline **passes** G1, reversing C2's factual conclusion while keeping its
> methodological core (median over mean; no post-hoc metric selection) intact. **Falsifier**: if
> 46.2% below floor is too lax a starting state, use the span hour set for *both* G1 and C/H — but
> then C/H must be republished at **$96.63/h**, and switching the fleet off would improve the
> headline, which is the one outcome the owner forbade. Move both numbers or neither.

### G3 currently ships as `unmeasured`, and that is the honest state

The same plan found that **four of G3's five non-negotiables are not honestly measurable today**:
they exist only in verdict prose, a grep counts the word rather than the act, and just 2 of 95
verdicts carry a structured header. They are published as `null`/`unmeasured` — **never as a green
tick.** A guard that cannot be measured must not be allowed to read as passing; that is how a
programme quietly loses the thing it promised to protect. Making G3 real is its own piece.

**The five non-negotiables (G3), which no cost measure may reduce.** Every one has caught something
expensive; each is cheap relative to what it prevents:
one separate critic with fresh context per piece · delete-the-fix · the CONSUMPTION check
(`RI-MTH07`) · a self-test with arms that genuinely disagree · reading the actual file rather than
trusting a summary.

## 2. What is measured — and the four ways the orchestrator's first reading of it was wrong

**Everything in the first version of this section was wrong, and the plan loop caught all of it
before a build agent was paid to inherit it.** Kept visible rather than quietly rewritten, because
the errors are the argument for the loop. Source of truth is the `COST-INSTRUMENT` plan
(`orchestration/plans/COST-INSTRUMENT.md`); its numbers below supersede this document's originals.

1. **The source is 403 files / 638 MB, not one file / 31 MB.** The glob this section originally gave
   — `/root/.claude/projects/-home-user-elder-souls-claude/*.jsonl` — matches only the
   **orchestrator's** session, which is **9.3% of the money**. Subagent transcripts live in
   `<session>/subagents/`. An instrument built to the original brief would have understated total
   cost by about **10.7×** and looked entirely plausible doing it.
2. **One API response is written as several JSONL records sharing one `message.id` and one identical
   `usage` block.** 84,490 usage-bearing records collapse to **46,575 distinct requests**. Summing
   records inflates cost **1.81× overall and 2.58× on output**. Deduplicate by `message.id`. This
   also means the original "3,230 Opus vs 29 Sonnet" *request* counts were themselves inflated.
3. **There are five priced token classes, not four.** `cache_creation` splits into `ephemeral_5m`
   (1.25× base) and `ephemeral_1h` (2×), and **both occur here** — the orchestrator uses the 1-hour
   TTL, subagents the 5-minute. The prices first declared in the contract were also roughly **3×**
   the real published figures.
4. **The lever ranking in §4 was built on a false premise.** See below.

### The baseline, and what it says about where the money actually is

**$5,792.69 over 62 hours → C/H = $111.40/h.** Cost per agent-hour **$8.51**; mean concurrent agents
**13.10**. **Target: C/H ≤ $27.85/h.**

- **Cache reads are 81.2% of spend, and the hit ratio is already 98.39%.** The cache lever in §4 is
  therefore close to dead — there is almost no miss left to convert. What remains is the *write*
  side, $910.89, which is what Ruling C1 targets.
- **Output is 1.7% of spend and median output is 5 tokens.** Writing shorter is worth approximately
  nothing. Every instinct to trim prose is aimed at 1.7% of the bill.

  > **CORRECTED 2026-08-08 by the `COST-INSTRUMENT` plan critic (BLOCKING 1/3, plan §11).** Those two
  > figures are artefacts of a dedup bug. One API response is written as several records and only the
  > **terminal** one carries the true `output_tokens`; 12.6% of requests disagree across records, in
  > the output class alone, and taking the first record reads **40.8%** of the output. Corrected:
  > **output is 3.93% of spend ($236.80), median output is 16 tokens** (mean 204, p90 492);
  > `cache_read` is **79.34%**, C is **$6,025.85**, C/H **$115.88**, $/agent-hour **$8.71**. The
  > conclusion survives — 3.9% is still small — but the number that justified it was wrong by 2.3×,
  > and the plan's own §0.2 verification ("byte-identical `usage`") was done on the orchestrator's
  > session, i.e. **9.3% of the money**, and generalised to the other 90.7%. Full derivation and the
  > remedy (dedup by element-wise max, plus null-control arm N7): `orchestration/plans/COST-INSTRUMENT.md` §11.
- **Cost is context volume × request count.** Median context **190k**, **103 requests per agent**.
  That product is the thing to attack, and nothing else is close.
- **Model mix alone caps at 0.6× at list price**, because every model's price vector is
  `base_input × [1, 1.25, 2, 0.1, 5]`. It cannot reach the 25% bar by itself: **volume must fall
  about 2.8×** on top of it.

### The methodological finding that constrains every experiment

**Cost-per-run has a coefficient of variation of 0.97.** Detecting a 25% effect in dollars would need
roughly **238 runs per arm (~76 hours — longer than this project's entire history).** So attribution
**cannot** rest on comparing dollar totals between waves. It must rest on **mechanism** — measured
token flows through the specific path a change touches. Any experiment whose acceptance is "the bill
went down" is unfalsifiable here, and saying so is not pessimism, it is the difference between this
programme producing knowledge and producing anecdotes.

## 3. How the programme runs — the same gauntlet, pointed at ourselves

> Owner: *"do it all via subagents (plan-critic-build-critic loops)"* and *"You're improving the
> efficiency of your team as you go — that's the idea."*

Each efficiency change is a **piece**, and it runs `PLAN-LOOP.md` exactly as a game piece does:
plan → fresh plan critic → remediation and fresh re-criticism until SATISFIED → build → fresh build
critic, repeating remediation/criticism until the governing bar is satisfied. No agent grades its
own saving. Critics attempt falsification and may PASS without inventing a gap when evidence meets
the written bar
applies here too, and it is more important here than anywhere, because a change that quietly costs
quality shows up as a cost saving on every dashboard.

**Research is part of the method, not a preamble.** The owner asked for agents to *search online* for
techniques proposed for this kind of multi-agent gauntlet workflow and then **test them here**. An
external claim is a hypothesis with a citation, never a result: cite it, test it on this repo,
publish the measured delta. A technique that works in someone's blog post and not in our numbers is
a finding worth writing down.

**Reversibility is a hard requirement, not a preference.** Every change lands with:
1. the **measurement before**, taken with the instrument, not recalled;
2. a **named reversal** — the commit or flag that undoes it, in one step;
3. the **measurement after**, on the same instrument;
4. a **stated tripwire**: the guard value that, if breached, triggers the reversal automatically.

A change whose reversal has not been *executed at least once on a copy* is not reversible — it is
merely believed to be. That is the delete-the-fix rule (rule 6) applied to cost.

## 4. The candidate levers, ranked by expected size — hypotheses, not conclusions

Written down so successors start from the evidence rather than re-deriving it. **Each is a
hypothesis to be measured; none is a decision.**

### 0. Cost is SUPERLINEAR in tool calls — the largest structural lever, and it was missing

> **CORRECTED AND STRENGTHENED 2026-08-14 by `COST-EXPERIMENTS-BUILD`, measured with `tools/cost.mjs
> --growth` at commit `5cee352` over 419 agents / 50,286 deduplicated requests.** Two changes, and
> the second is the one that matters.
>
> **The heading said "quadratic". It is not.** Regressing `log(usd)` on `log(requests)` gives
> **exponent 1.268, R² 0.876**; quadratic would be 2.0. The bin table below survives ($4.79 → $48.43
> per agent, measured) but the multiplier stated with it does not: the bin *means* are 55.3 → 329.1
> requests, so a **6.0× rise in request count buys 10.1×** the cost, not "3.5× buys 11×". The lever
> is real and stays ranked first; it is about **half the size this section recorded**. The plan critic
> reached 1.286 independently on a different file-set, which is the same answer.
>
> **The confound this section never tested is now tested, and it falls the section's way — harder
> than it claimed.** "Are long agents expensive because each call re-sends a grown context, or because
> they did more work?" At **matched request index** the bins agree at k=0 (25.7k–26.1k) and long
> agents are thereafter *lighter*, not heavier: at k=80 the 0–99 bin carries **240,931** context
> tokens against the 300+ bin's **192,972**. The work proxy agrees — context growth per request at
> matched index is flat across bins, and output tokens show no trend. Predicting each bin's mean
> context from the **pooled** context-vs-index curve and that bin's own index distribution reproduces
> the actual within **0.96–1.06**. Accumulation explains all of it; nothing is left for workload.
>
> **And now it is sized.** **87.1% of every context token re-read is accumulation** above the agent's
> own first-request context — **$4,032.52, or 71.1% of subagent spend.** The harness recovers none of
> it: **0 compaction events across 419 agents**, and only 2 agents show any context decline at all.
> Splitting every agent into 100-request pieces would not have re-read **$1,728.02**, i.e. **27.7% of
> the bill** — an **upper bound** that models no re-orientation and no handoff, which is the missing
> term and was not measured.
>
> **What would overturn this:** agents run long enough that the ~26k fixed prefix stops dominating —
> the exponent then rises toward 2. Or a harness that starts compacting, which would mean part of the
> accumulation is already being recovered and the split ceiling is overstated.
> Full output: `reports/cost/experiments.json`, `reports/cost/EXPERIMENTS-20260814.md`.

### Ruling C3 — the missing term is measured, and the split lever survives it *(reversible, trial)*

> **Measured 2026-08-14 by `COST-REORIENTATION` with `tools/cost.mjs --reorientation` at commit
> `defc376b`, over 53,748 deduplicated requests and 440 subagents.** §4.0's ceiling assumed a split
> was free. It is not, and the term it left out is now sized.

**A handoff costs $0.43. Break-even is $6.26. The lever is real.**

The measurement uses the natural experiments this project already ran without meaning to: **52 agents
killed by usage limits or container restarts and dispatched again as explicitly-marked successors**
("Resume W1-14 r3 magic", "W1-05 wayfinding (successor)"). A successor is a split's second half with
the split already performed, so nothing had to be constructed.

**Re-orientation is paid in extra requests, not heavier ones.** A successor takes **20 requests** to
reach its first `Write`/`Edit` against **11** for a fresh agent dispatched in the same six-hour
window — **860,320 extra context tokens, $0.4302** at the marginal cache-read rate (n = 50,
stratified-shuffle p = 0.002, null band [−0.116, +0.276]). Against break-even of **$6.264** per
handoff at chunk 100 that is a **14.6× margin**, and the ceiling survives it nearly intact:
**$1,872.81 − $128.63 across 299 handoffs = $1,744.18.**

**The controls are what make that number worth anything.**

| control | result | what it rules out |
|---|---|---|
| N2 — 91 round-2+ agents that were *not* resumed | **−$0.01** | "later agents just carry fuller briefs". The effect is handoff-specific. |
| S — fresh against fresh | **−$0.001** | a matching procedure biased by construction |
| time-matching, **deleted on a copy** | $0.4302 → **$0.3031**, p 0.003 → 0.027 | the control is load-bearing, not decorative (rule 6) |
| N1 — 1,000 stratified label shuffles | p = 0.002 | arm composition reproducing the effect by itself |

**A statistic was disqualified on the way, and it is published with the control that caught it.**
The obvious measure — integrate the resumed-versus-fresh context premium over the first 60 requests —
returns **minus $0.40**, successors apparently re-reading three-quarters of a million tokens *fewer*.
Its late-index placebo shows the gap **still widening at k = 200**, where orientation is long over.
The curve is flat for five requests and then diverges linearly: a *slope* difference, not an
*intercept* difference. Resumed agents were given **narrower jobs** (3,367 tokens of context growth
per request against 3,974), and integrating over 60 indices measures the narrower job and calls it a
free handoff. Reporting it would have been this project's own favourite failure — a green number from
an instrument measuring the wrong thing.

**What this does not measure, stated because the margin is large enough that it can be.** Every
handoff here was **accidental**: no predecessor wrote a note by design, so this bounds the *unplanned*
case and says nothing about whether a *planned* split decomposes work sensibly. And some of the
successor's extra requests may be work **redone** rather than merely re-read; the transcript cannot
tell those apart, which would make both the cost and the quality risk larger than stated.

**The quality arm can refuse this and can never licence it**, and it is used in that direction only.
Resumed rounds score **3.88** against 3.56 on 70 verdicts — no alarm, but the power is low and the
selection confound is fatal: a piece is resumed *because* it was long or hard. So resumed pieces
needing 2.38 rounds against 1.61 is **not** evidence against splitting either.

**The ruling, therefore: split long pieces at ~100 requests, as a trial, with three tripwires.** §5
binds hardest here — this shortens an agent's *waste*, never its *work*, and the second tripwire is
what enforces that.

1. **Cost** — the handoff figure re-measured on deliberately split agents rises above **$2.00** (still
   under a third of break-even, so it fires long before the lever stops paying).
2. **Scope** — total requests summed across a split piece's agents falls below the pre-split median
   for comparable pieces. A split that shortens the work is not a saving.
3. **Quality** — critic find-rate or the G3 separate-critic count falls on the split arm.

**Reversal**: one line in the dispatch brief returns long pieces to a single marathon agent;
`git revert` restores this section. **Falsifier**: a planned handoff that costs more than an
accidental one — plausible if a deliberate status file is larger than what a killed agent left behind
— would move the $0.43 upward, and the trial's own re-measurement is what would show it.

### Ruling C3a — C3's falsifier is run and does not fire, and the trial now has an instrument *(reversible, trial)*

> **Measured 2026-08-14 by `SPLIT-TRIAL` with `tools/cost.mjs --split-trial`.** C3 named one
> falsifier and left two of its three tripwires with nothing to compute them. Both are now fixed.
> **The planned arm is still empty and this ruling says so in its first line rather than its last.**

**Nothing has been split on purpose yet — `planned_split: 0` across 478 subagents — so every "after"
column in `--split-trial` is empty by construction, not by measurement.** The instrument refuses a
verdict rather than returning a green light from an empty arm, and `--experiments-self-test` proves
the refusal: fed the same $2.64 handoff on two agents it returns `UNDERPOWERED`, and fed ten it
returns `REVERT`.

**The falsifier does not fire, and the confound pushes the other way.** C3 worried that a *deliberate*
note is bigger than what a killed agent leaves behind and might therefore cost more to absorb. That
has a gradient inside the accidental population already: successors differ enormously in how much
their predecessor had written down. Measured from **git, as of the successor's first request** — not
as of today, because those files have been rewritten many times since:

| arm | richer written record vs poorer | shuffle p |
|---|---|---|
| **accidental handoffs** (n = 11 vs 10) | **−$0.486** — a richer record orients *cheaper* | 0.072 |
| **fresh agents, same measurement** (n = 26 vs 23) | **+$0.358** — on the identical contrast, *dearer* | 0.207 |

The maturity control is the plausible wrong answer made concrete: a big written record belongs to a
*mature piece*, and an agent on a mature piece may orient differently for reasons that have nothing
to do with a handoff. It moves the **opposite** way. So the confound cannot be manufacturing the
handoff arm's gradient — it is working against it. A planned split always writes the richest note
there is, so **the planned handoff is predicted at or below the accidental $0.4302**, and C3's
$6.264 break-even is not threatened from this direction.

**Two things that number is not.** p = 0.072 is not significance, and it is reported as a *direction*
that survives its control, never as a size. And it measures the **size** of a note, not its quality —
a long useless note scores the same as a short excellent one, which biases towards "notes do not
help", i.e. against the reading that makes the trial safe.

**Delete-the-fix, executed on a copy, and it flips the sign.** Remove the git time-travel — read each
piece's status files as they are *today* instead of as the successor found them — and the same
analysis returns **+$0.2767 (p = 0.370)** and prints **"FALSIFIER FIRES"**. The wrong implementation
reaches the opposite conclusion, so the time-travel is load-bearing rather than believed to be. The
mechanism is visible in the strata: today's files are 35 KB / 102 KB where the successors actually
inherited 15 KB / 43 KB.

**The frozen BEFORE, so a later run has something to compare against.** Tripwire 1: **$0.4302**
(n = 50). Tripwire 2: **265** requests per unsplit piece (28 pieces), against 1,197.5 for the 14
accidentally-split ones. Tripwire 3: find-rate **1.30** gaps per verdict on unsplit pieces and
**1.47** separate critics per piece, against 1.52 and 3.00 on the accidental-split arm.

**Tripwire 2 is biased against firing and that is the right direction** — a piece is split *because*
it is long, so its total starts above the median for reasons unrelated to the change. Read a quiet
tripwire 2 as "no alarm", never as "scope preserved".

**How to dispatch a split so the instrument can see it.** The planned marker is explicit, exactly as
`RESUMED_RE` is: the dispatch description must contain **`chunk N`**, **`part N of M`** or
**`split N/M`** (e.g. `"W1-33 canopy — chunk 2 of 3"`). A split that does not say so is invisible to
every tripwire, and a regex that guessed would fold ordinary round-2 dispatches into the planned arm
and manufacture the population this ruling reports as absent. **The predecessor's last act is its
status file**: findings, `files_touched`, and a `next_step` naming what the successor picks up.

**Reversal**: `git checkout <this commit>~1 -- tools/cost.mjs` removes `--split-trial` and the hoist
in one step, and one line of the dispatch brief stops marking chunks. **Executed on a copy**, and the
arms genuinely differ: the reverted copy has no `--split-trial` flag at all and `--experiments`
writes no `q7_split_trial`. **Regression guard on the hoist**: `--reorientation` is unchanged to the
last decimal ($0.4302 / −$0.0113 / −$0.0011) and its `null_controls` block is byte-identical.

Found by the `COST-EXPERIMENTS` plan, absent from this document's original ranking **and** from the
external research: **$4.55 → $51.83 per agent across request-count bins**, because every tool call
re-sends a context that the previous calls grew. One agent's context went **23,757 → 578,648 tokens
over 314 requests**. Since cost is context volume × request count and the two are *coupled*, a long
agent is not linearly more expensive than a short one — it is quadratically so.

**This reframes the whole programme.** The 2.8× volume reduction that §2 says is required cannot come
from writing less (output is ~1% of spend) or from cache tuning (already 98.3% hit). It has to come
from **shorter agent lifetimes and fewer, better-chosen tool calls** — which points at splitting long
pieces into several short agents rather than one marathon, at briefs that make the first three reads
the right ones, and at instruments that answer in one call rather than ten.

**It is also the lever most likely to collide with quality**, and therefore the one where G2 and G3
matter most: an agent cut short is an agent that stops before the delete-the-fix. Nothing here
authorises shortening an agent's *work* — only its *waste*. Measure, do not assume.

1. **Model mix.** 3,230 Opus vs 29 Sonnet. Route by task shape, not by habit: measurement design,
   seam rulings, graded prose and every critic stay Opus; a build with a landed plan, an existing
   instrument and a machine-checkable acceptance is a Sonnet job. **Haiku is unproven here and no
   build should be its first job** — trial it on one mechanical task and measure before trusting it.

   **The routing axis is discretion, not difficulty.** Ruled by the `W1-HUD-TOAST` plan critic from
   its own exchange and adopted: *route on whether the acceptance is **decidable without
   judgement**, not on how hard the subject sounds.* Its worked case is the proof — of two pieces,
   the harder engineering job was the Sonnet one because its acceptance was machine-checkable, and
   the piece that was "mostly grep" was the Opus one because deciding what to count required
   judgement. Two readers had already accepted an uncounted premise about that population; a Sonnet
   build would have inherited it. Sorting by apparent difficulty gets this exactly backwards.

   **Levers 1 and 4 are one coupled lever, and it is the largest uncosted saving in the programme.**
   Same source: **the plan loop converts Opus builds into Sonnet builds**, because it manufactures
   precisely the three conditions the middle row of `PLAN-LOOP.md`'s table requires — a landed plan,
   a named existing instrument, and a machine-checkable acceptance. So a plan exchange does not
   merely remove a build round; it *changes the price of the round that remains*. Measure them
   together or the saving is attributed to the wrong thing and the wrong one gets scaled.
2. **Cache economics.** Cache reads are an order of magnitude cheaper than fresh input. Brief shape,
   file-read order and prompt stability all move the cache-hit ratio. Measure the ratio first; it may
   already be high, in which case this lever is smaller than it looks.
3. **Work never repeated.** `dispatchable.mjs` and `dispatch-staleness.mjs` exist because a
   successor once spent its whole budget proving a piece was already complete, and because five of
   five bullets on a dispatch list were dead. Every such round is ~100% waste.
4. **The plan loop itself**, which is already a cost programme: it caught a repair that had already
   landed and a brief whose framing was wrong, before a build agent was paid to discover either.
5. **Context discipline.** Briefs that point at files rather than restating them (rule 18, broken by
   the orchestrator four times). Status files that let a killed agent resume rather than restart —
   the container has killed the whole fleet three times in a day, and a weekly limit killed fifteen
   agents at once.
6. **Orchestrator cost.** The orchestrator is itself one of the most expensive agents in the fleet.
   It is in scope. Nothing here exempts it.

## 4a. External evidence, gathered — hypotheses with citations, not results

Full report: `reports/cost/RESEARCH-RESEARCH-COSTEXT01.md`. Every figure below is **someone else's
measurement under someone else's conditions**, and is a hypothesis until it survives our numbers.

- **Cache prices are exact, not estimated**: cache read **0.1×** input, 5-minute write **1.25×**,
  1-hour write **2×**; invalidation cascades tools → system → messages, with a 20-block lookback.
- **The finding that indicts the orchestrator specifically**: *concurrent requests cannot hit each
  other's cache until the first has begun streaming.* This box dispatches **5–8 agents in a single
  block, all sharing a prefix** — so on shared tokens the fleet may be paying 1.25× writes N times
  where it could pay one write and N−1 reads at 0.1×. See the ruling below.
- **Routing/cascades**: RouteLLM 35–85% cost reduction at ~95% quality; RLM-Cascade **45.8%** on an
  actual Claude Code workload at quality parity. Independent support for lever 1.
- **Context pruning + summarisation**: tokens **−63%** *and* task completion **71% → 91.6%** — the
  rare case where cost and quality move together, and therefore the one to test hardest for being
  too good to be true.
- **Criteria injection for judges: +13.5pp accuracy, near zero cost.** This is the only lever found
  that **increases rigour per token** rather than trading against it, so it is the one most aligned
  with §5 and should be tried on critics early.
- **Rejected, and why** — reported because a research pass that returns only good news is not
  research: distilled judge models and cascades inside a critic's run/no-run decision (both cut
  verification, forbidden by §5); Batch API (trades speed for cost, forbidden by §5); LLMLingua
  compression (unmatched domain, new dependency, in tension with our exact-number rules);
  Agent-Omit (needs fine-tuning). Plus a standing caution that multi-agent gains often fail to hold
  under matched compute budgets.
- **Not read first-hand**: `anthropic.com`, `simonwillison.net` and `khaledzaky.com` were
  unreachable from this container even via `curl`, so several vendor claims are at one remove from
  search snippets. Flagged rather than laundered into fact.

### Ruling C1 — burst dispatch is staggered, and it is measured retrospectively *(reversible)*

The orchestrator dispatches the first agent of a burst alone, then the remainder once its prefix is
warm. **This is adopted before the instrument exists, which normally this document forbids** — the
justification is narrow and it is a sequencing argument, not an exception to "measure, don't guess":
**the baseline is already banked.** The transcript records `cache_creation_input_tokens` and
`cache_read_input_tokens` per request with timestamps, so every burst already dispatched is a
recorded control, and the before/after is measurable retrospectively the moment `tools/cost.mjs`
lands. Adopting now costs one extra tool round per burst and destroys no measurement.

**Reversal**: stop staggering — one line of orchestrator behaviour, no code. **Tripwire**: if the
retrospective measurement shows no improvement in the cache-read fraction on shared prefixes, it is
reverted and recorded as a failed hypothesis, with the number.

> ### C1 IS REVERTED — the tripwire fired, and here is the number
>
> The `COST-EXPERIMENTS` plan measured it: **ceiling 0.32% of spend, against C1's own 2% bar.**
> Tight versus staggered bursts give a warm fraction of **0.958 vs 0.965** against a 10pp bar, and
> **378 of 403 agents already read cache on their first request** — there was almost no cold start to
> remove. Staggering stops; bursts dispatch together again.
>
> **This is the first hypothesis this programme has killed, and it was the orchestrator's own.** It
> was adopted on plausible external evidence and one turn's reasoning, and it did not survive
> contact with the data. That is the discipline working, not a mistake to bury — the failure is
> recorded here with its magnitude precisely so nobody re-adopts it next month on the same argument.
>
> **It is a revert, not a closed question.** The figure is from the plan agent's own prototype
> parser, not the instrument, so experiment **E1** requires a builder to *reproduce it independently
> rather than confirm it*, with a cold-start control that fails loudly if the builder reproduces the
> prototype's bug instead of its finding. If E1 overturns this, staggering comes back.


## 4b. WASTE — the second cost axis, and nothing has been measuring it

> Owner, 2026-08-14: *"your cost control setup should also be looking at things like wasted/lost/
> duplicated work and how to prevent it… if a subagent somehow loses a load of work that then has to
> get rebuilt, that's a huge unnecessary token cost. If two agents clash on something we then have to
> waste tokens fixing the clash. If two agents are both independently generating the same outputs
> from tool uses then that's a waste — could it be generated once and they both use it."*

**This is invisible to C/H, which is why it has grown unchecked.** Cost-per-hour does not fall when
work is lost — it *rises*, and the rise is indistinguishable from doing more work. Every other lever
in §4 asks "can this token be cheaper"; this one asks **"did this token need to be spent at all"**.

### Ruling C4 — waste is a measured category with its own ledger *(reversible)*

**The taxonomy, each class observed on 2026-08-14 with a named instance. This is not hypothetical.**

| # | Class | What it costs | Observed instance |
|---|---|---|---|
| **W1** | **Lost work** — completed, then destroyed | the full re-do | A GPU agent's transport code, already proven on live hardware, clobbered and rewritten from source. Seven-plus agents affected; several lost 30–60 min each |
| **W2** | **Clobber-and-repair** — work survives but must be reconstructed | repair + verification | `reports/blog-feed.jsonl` clobbered **three times in forty minutes by three agents; ten lines from nine agents lost, restored, and lost again** |
| **W3** | **Duplicated build** — two agents produce the same artefact | one whole agent | Two agents independently built capture tooling; two independently built fresh-checkout validators |
| **W4** | **Re-derivation** — the same fact recomputed because it was not published as data | small each, large in aggregate | The count of reference plates in `refs/modern/` was independently established **three times**; the tool population was counted 786, then 776, then again |
| **W5** | **Wasted dispatch** — an agent sent at work already done, or against a bar that has moved | the whole agent | A successor once spent its entire budget proving a piece was complete. **29 plans sat `satisfied` and dispatchable against predicates overturned that morning** |
| **W6** | **Failed-run waste** — paid work that produced nothing | the run | GPU runs lost to a transport 404 and a SIGTERM; captures silently truncated by `ENOSPC` and banked as zero bytes |
| **W7** | **Clash reconciliation** — tokens spent merging rather than building | pure overhead | `git merge` dying against five agents' uncommitted files; conflicts resolved by regeneration |

**How to measure it, from ground truth rather than impression.** Agents *report* these in their own
final summaries — today's are full of them — and git history carries the rest. A waste ledger is
buildable from three sources already on disk: agent reports and status files (self-reported W1/W2/W6),
git history (a path reverted and restored; two commits producing equivalent content from different
authors — W2/W3), and the transcripts (an agent's requests before its first useful output, which is
already how re-orientation cost was measured at $0.43).

**Publish it beside C/H on the dashboard**, because a saving that is really a waste reduction should
be visible as one, and because waste is the category most likely to *look* like productivity.

### The prevention rules, which are worth more than the measurement

1. **A fact measured is published as data, not prose** (kills W4). `docs/art-direction/board.json` and
   the blind-pair census are the model: a number in a JSON file with its method beside it is consumed;
   a number in a report paragraph is recomputed by the next three agents.
2. **Before dispatching, name what already exists** (kills W3/W5). `tools/dispatchable.mjs`,
   `tools/ownership.mjs --conflicts` and `ListAgents` all exist for this and the orchestrator has
   skipped them. Every brief should say what to consume rather than leaving the agent to rebuild it.
3. **A ruling needs a route into the documents it binds** (kills W5). Twenty-nine plans against a
   superseded bar was **one unpropagated directive**, not twenty-nine defects.
4. **Landing work is a solved problem — use the solution** (kills W1/W2). `HAZARDS.md` §2, §2d and
   §2e: plumbing through a temporary index, rebuild append-only files from origin, verify against the
   remote blob. Every loss today was preventable by an already-written procedure.
5. **Fail loudly or not at all** (kills W6). A truncated capture banked as zero bytes, a bank exiting
   0 after failing, a gate satisfied by a comment — each cost more than the failure it hid.

**Reversal**: drop the ledger; it is additive and nothing depends on it. **Falsifier**: if the
measured waste is small relative to the levers in §4, this ruling is over-engineering and the
prevention rules alone should stand without the accounting.

## 5. What this programme may never do

- **Never cut a critic.** The separate-critic rule is where the quality lives; a build with no critic
  is cheaper and worthless.
- **Never cut the controls.** Delete-the-fix, the null control and the self-test that goes red are
  the only reason any number here means anything.
- **Never trade speed for cost.** ~~The parallelism floor of 12 is a floor during this programme
  too.~~ **SUPERSEDED 2026-08-14 by the owner, via `CLAUDE.md` — struck here rather than deleted so
  the change of mind is legible.** The owner's words: *"Instead continuously qualitatively review
  and use your judgment as the implementation lead to set as much working in parallel as is
  sensible in a dependency safe and performance aware way."* **There is no number to hit and no
  excuse to idle.** So the guard this line was protecting still stands, restated in the terms that
  replaced it: this programme may never buy a cost saving by running fewer agents than the
  dependency graph safely allows. `COST.md` §4's guard **G2 (parallelism)** must be re-read the
  same way — as "no reduction in safe concurrency", not as "≥ 12".
  *(Found by AUDIT-CITATION-STALENESS: `CLAUDE.md` has said "The hard floor of 12 is removed" since
  the 2026-08-14 directives landed, and this document went on asserting the floor — a binding
  document contradicting the binding document that overrides it.)*
- **Never report a saving without its guards.** A cost number published without G1–G3 beside it is
  not a result, and the orchestrator should reject it and say so.

## 6. Reporting — on the published dashboard, with pictures

> Owner: *"report on the cost optimisation progress appropriately and with visuals in the GitHub
> pages progress report dashboard"*.

The programme keeps a running ledger: baseline, every change with its before/after and reversal, and
the current C/H against the 25% bar with all four guards. **That ledger is published on
`docs/progress.html`, the page the owner actually opens** — a number that lives only in a report file
is a number the owner never sees, and this project has already learned that a check nobody looks at
is a check that does not exist.

**The data contract, so this does not become two implementations of one system (rule 10).** The
instrument is the only thing that computes cost. It writes a machine-readable ledger — path and
schema fixed below — and **the dashboard renders that file and computes nothing of its own.** A
dashboard that recalculates cost is a second implementation, and this build has already had a good
detection model and a broken one at once.

### 6.1 The ledger contract — `docs/data/cost-ledger.json`

**Declared by `COST-DASHBOARD` on 2026-08-08 because the instrument had not landed yet and a written
contract either side can read beats two agents guessing. Reversible:** the instrument owns cost and
may change any of this by editing this section and saying so — the renderer follows the file, not the
other way round. What would overturn it: a field the instrument cannot honestly produce, or one the
transcript does not carry. Renderer: `tools/cost-report.mjs`; worked example with known numbers:
`tools/cost-fixture.json` (the `--self-test` fixture, and the shape to copy).

> **AMENDED 2026-08-08 by `COST-INSTRUMENT` (plan), which owns cost, under the reversibility clause
> in the paragraph above. Five changes, each marked inline below, each because the transcript does
> not support what was declared** — the reason the clause names. Full derivation and the numbers
> behind every one: **`orchestration/plans/COST-INSTRUMENT.md`**.
> 1. **`prices` carries five token classes and the real figures.** The declared example priced Opus
>    at `input 15 / cache_write 18.75 / cache_read 1.5 / output 75` — about **3× the published
>    price** — and had a single `cache_write` where the API bills **two** (5-minute at 1.25× base,
>    1-hour at 2×), both of which occur here.
> 2. **`by_token_class` and `by_model.tokens` carry the same five classes.**
> 3. **New `coverage`** — a partial read must render `—`, never a confident under-count.
> 4. **New `drivers`** — 81 % of spend is cache reads, and without this the page never shows why.
> 5. **New `denominator`** + `comparable_key`, and **G1/G2/G3 rewritten** to state what is actually
>    measurable: G1 has two disagreeing readings and publishes both; G2 is low-power and says so;
>    **four of G3's five non-negotiables are not honestly measurable and ship as `null`.**
>
> **What would overturn these:** a published price table that differs from the one in `prices`, or a
> `usage` shape that stops carrying `cache_creation.ephemeral_{5m,1h}_input_tokens` separately.

- **Path: `docs/data/cost-ledger.json`.** Under `docs/` so the raw numbers are fetchable on the
  published site beside the page that draws them, the same way `docs/status.json` already is;
  committed, so the page regenerates identically from any checkout.
- **Writer: the instrument, and nothing else.** The renderer never writes it and never derives a
  dollar figure. Anything the ledger does not state is drawn as `—`, never inferred: the renderer
  will not divide, sum or rescale money, so **every number the page shows must appear in the file.**
- **Refresh: every bank.** `tools/publish.mjs` calls `tools/cost-refresh.mjs`, which runs the
  instrument (`tools/cost.mjs`, if present) with a timeout and **never blocks the commit** (rule 13).
  On failure it writes `docs/data/cost-ledger.error.json` (`{ "at": ISO, "message": str }`) and the
  page reports the failure with the timestamp of the last good reading, rather than serving an old
  number as current.

```jsonc
{
  "schema": "elder-souls/cost-ledger@1",
  "generated_at": "2026-08-08T11:02:00Z",   // when the instrument last ran; drives the stale banner
  "generator": "tools/cost.mjs",
  "commit": "abc1234",                       // rule 12: every number is a claim about a commit
  "source": "/root/.claude/projects/.../*.jsonl",
  "stale_after_minutes": 45,                 // older than this and the page says STALE (default 45)
  "window": { "from": ISO, "to": ISO, "hours": 62.4,
              "complete": true },            // true = covers ALL history, so the total really is
                                             // "spend to date". FALSE (or absent) and the page
                                             // labels the headline "spend in window" and says so:
                                             // a total that silently covers less than the reader
                                             // assumes is the same defect as a stale one. Set it
                                             // false if the instrument rolls up incrementally.
  "comparable_key": "sha1:…",                // hash of {H definition, price `effective` date,
                                             // file-set rule, >=4 active hours}. Two readings are
                                             // comparable only if these match. The page may say so;
                                             // it never infers it.

  // ── AMENDED 2026-08-08 by COST-INSTRUMENT (plan), under the reversibility clause above. ──
  // FIVE token classes, not four. A 5-minute cache write is 1.25x base input; a 1-hour write is 2x;
  // and BOTH occur here (149.4M tokens at 5m, 7.5M at 1h — the orchestrator's own session uses the
  // 1h TTL, subagents use 5m). Collapsing them is the §1 mistake one level further down.
  // The previously declared figures were ~3x the real published prices and had one cache_write key.
  "prices": {
    "note": "USD per million tokens",
    "effective": "2026-08-08",
    "sonnet_intro_expires": "2026-08-31",    // Sonnet 5 rises 50% on 2026-09-01 with NO change in
                                             // behaviour. A series crossing that date is not
                                             // comparable unless repriced from one pinned table.
    "claude-opus-5":    { "input": 5, "cache_write_5m": 6.25, "cache_write_1h": 10,
                          "cache_read": 0.5, "output": 25 },
    "claude-sonnet-5":  { "input": 2, "cache_write_5m": 2.5,  "cache_write_1h": 4,
                          "cache_read": 0.2, "output": 10 },  // intro; list = 3 / 3.75 / 6 / 0.3 / 15
    "claude-haiku-4-5": { "input": 1, "cache_write_5m": 1.25, "cache_write_1h": 2,
                          "cache_read": 0.1, "output": 5 }
  },

  // Coverage — the anti-truncation guard, and the arm the null control nearly missed.
  // The source is 403 files / 638MB: `<session>.jsonl` AND `<session>/subagents/**`. The
  // orchestrator's own file is 31MB and only 9.3% of the money, so an instrument reading the
  // top-level glob alone under-reports ~10x and looks entirely plausible doing it.
  // WHEN `complete` IS false, EVERY `headline` FIELD MUST BE null, so the page draws "—".
  // A partial read rendered as a confident number is the inert-instrument shape (rule 4).
  "coverage": { "files_total": n, "files_read": n, "bytes_read": n, "complete": true },

  // Why the cost is what it is. 81% of spend is `cache_read`: cost is context volume x request
  // count, NOT verbosity (median output is 5 tokens; output is 1.7% of spend). Without this block
  // the page shows what the cost is and never why, and every lever lives in the why.
  // pie_tokens = input + 1.25*cw5 + 2*cw1h + 0.1*cr + 5*output — a model-independent volume measure,
  // valid because every model's price vector is base_input x [1, 1.25, 2, 0.1, 5]. It gives the
  // exact decomposition  C/H = (PIE per active hour) x (weighted mean base input price),
  // so model-mix and volume levers are separately measurable and never confounded.
  "drivers": { "requests": n, "mean_context_tokens": n, "pie_tokens": n,
               "requests_per_agent_hour": n },

  // Which denominator produced C/H. Idle hours are EXCLUDED, because with a span denominator
  // switching the fleet off improves the metric — the one outcome the owner explicitly forbade.
  // Over a fully idle window C/H is null, never 0. `span_hours` is published beside it so the
  // choice stays auditable rather than buried in the tool.
  "denominator": { "definition": "active_clock_hours", "active_hours": 52, "agent_hours": 681,
                   "span_hours": 61.94 },
  "headline": {                              // the top of the page. Every field pre-computed.
    "spend_to_date_usd": 1234.56,
    "burn_usd_per_hour": 42.1,               // current burn, over burn_window_hours
    "burn_window_hours": 1.0,
    "ch_usd_per_hour": 42.1,                 // C/H, the headline metric
    "ch_pct_of_baseline": 52.3,              // null if no baseline yet — never inferred by the page
    "usd_per_agent_hour": 3.21,              // the diagnostic that proves efficiency, not idling
    "usd_per_agent_hour_pct_of_baseline": 71.0
  },
  "baseline": { "usd_per_hour": 80.5, "usd_per_agent_hour": 4.5, "from": ISO, "to": ISO,
                "commit": "def5678" },
  "target": { "fraction_of_baseline": 0.25, "usd_per_hour": 20.1 },  // the 25% bar, as a level
  "series": [                                // EVERY measurement. The owner asked for many dots.
    { "t": ISO, "usd_per_hour": 61.2, "usd_per_agent_hour": 4.4, "mean_agents": 13.9,
      "commit": "abc1234", "window_hours": 0.5, "note": "" }
  ],
  // FIVE classes throughout (see `prices` above). `requests` counts DISTINCT `message.id`, not
  // records: one API response is written as several JSONL records sharing one identical `usage`
  // block, and summing records inflates the answer 1.81x overall — 2.58x on output.
  "by_model": [ { "model": "claude-opus-5", "usd": 1180.2, "requests": 3230,
                  "tokens": { "input": n, "cache_write_5m": n, "cache_write_1h": n,
                              "cache_read": n, "output": n } } ],
  "by_token_class": [ { "class": "input|cache_write_5m|cache_write_1h|cache_read|output",
                        "usd": n, "tokens": n } ],
  "guards": {                                // G1-G3, beside the cost and never on another page
    // G1: two honest readings disagree and BOTH are published. `mean_agents` counts agents that
    // ISSUED a request in the hour (13.10 at baseline, floor met). `mean_agents_present` counts
    // agents alive between their first and last request (median 11 — 35 of 63 hours BELOW the
    // floor, i.e. the baseline breaches G1 on that reading). The floor applies to the first; the
    // second is shown beside it, and a >20% divergence is itself flagged, because it means agents
    // are alive and idle — a cost finding in its own right (rule 21, browser contention).
    "g1_parallelism": { "mean_agents": 13.9, "mean_agents_present": 11.0, "floor": 12,
                        "divergence_flag": false, "status": "ok|breach", "window_hours": 1 },

    // G2 ships in two parts and the page must not conflate them.
    // G2a — continuous tripwire, ONE-SIDED and LOW POWER, and labelled as such: 64 scored verdicts
    // across 16 domains, ~4 per domain, moving by whole points between rounds. A windowed mean
    // verdict score CANNOT detect the harm this guard exists to detect, so it is published with its
    // `power` and its `n` and must never be drawn as proof. The alarm that IS structural is
    // Track critic outcomes without treating fault-finding as success: evidence-earned passes are valid.
    // a context-cutting change produces.
    // G2b — the controlled re-grade that GATES LANDING a change: a fresh critic re-grades an
    // already-verdicted piece under the new regime, blind, and its recovery of the known finding
    // set is compared. This is the only honest controlled quality measurement available.
    "g2_quality": { "mean_verdict_score": 7.4, "baseline_mean_verdict_score": 7.1, "n": 64,
                    "power": "low", "critic_find_rate": 3.2, "baseline_critic_find_rate": 3.0,
                    "regrade": { "piece": "…", "known_findings": n, "recovered": n } | null,
                    "status": "ok" },

    // G3: FOUR OF THE FIVE ARE NOT HONESTLY MEASURABLE TODAY, and the ledger says so rather than
    // shipping a number the page would colour green. The five non-negotiables live in verdict PROSE
    // ("delete-the-fix" in 59 files, "CONSUMPTION" in 143, "self-test" in 55) and only 2 of 95
    // verdicts carry the structured header row. Grepping counts THE WORD, NOT THE ACT — and a guard
    // measurable only by grepping for its own name is maximally gameable by the process it
    // constrains. `separate_critic` IS structural and real: `tools/ownership.mjs` + status files
    // prove a critic whose task_id differs from the builder's, without trusting prose.
    // The other four ship as null / "unmeasured". The fix is a SEPARATE PIECE: add a
    // machine-readable rigour block to the verdict template and have tools/verdict-validate.mjs
    // require it. Until then G3 is one-fifth measured and must not imply otherwise.
    "g3_rigour": { "counts": { "separate_critic": n, "delete_the_fix": null, "consumption": null,
                               "self_test": null, "arms_disagree": null },
                   "unmeasured": ["delete_the_fix", "consumption", "self_test", "arms_disagree"],
                   "unmeasured_reason": "verdict prose only; a grep counts the word, not the act",
                   "baseline_counts": { "separate_critic": n },
                   "status": "ok|partial" }
  },
  "changes": [                               // including the reversed ones
    { "id": "CH-01", "title": "Sonnet for landed-plan builds", "landed": ISO, "commit": "abc1234",
      "state": "kept|reversed|trial",
      "before": { "usd_per_hour": 61.2, "usd_per_agent_hour": 4.4 },
      "after":  { "usd_per_hour": 44.0, "usd_per_agent_hour": 3.9 },
      "delta_pct": -28.1,                    // instrument's number; the page never computes it
      "reversal": "git revert abc1234", "reversal_executed": true,
      "tripwire": "mean agents < 12 over 30 min",
      "outcome": "one line on what happened, and why it was reversed if it was" }
  ]
}
```

Every block is optional; the renderer draws what is present and says plainly what is missing. `status`
fields are the instrument's verdict, not the page's — the page colours by them and never re-judges.

**What the dashboard must show**, because a cost chart without its guards invites exactly the
misreading the programme exists to prevent:

- **C/H over time against the 25% bar**, as a line with a marked target — the owner has asked
  before for "line charts with many dots on them", i.e. every measurement, not a smoothed summary.
- **Cost split by model and by token class**, since routing and cache economics are the two largest
  levers and a single total hides both.
- **The three guards beside the cost, not on another page**: mean concurrent agents (floor 12),
  verdict scores and critic find-rate, and the count of the five non-negotiables. **A cost figure
  published without its guards is not a result.**
- **Every change with its before/after and whether it was kept or reversed** — including the
  reversed ones. A ledger showing only what worked hides negative evidence and cannot support a
  causal cost claim.

- **Spend to date, and the current burn rate, at the top.** Owner: *"must have frequent updates on
  the progress viz so that I always know **at any point** how much the project is costing."* C/H is
  the efficiency metric; **the running total is the one that answers "what has this cost me so far",
  and it is the first thing on the page.** State the window it covers and the time it was taken —
  a stale total is worse than none, because it reads as current.

**Refresh cadence: every bank.** `tools/bank.mjs` runs every few minutes and the pre-commit hook
already regenerates and stages `docs/progress.html`, so the cost ledger regenerates on that same
path — no new schedule, no separate job to fall behind, and the published number is never more than
one bank old. **If regeneration fails it must say so on the page** with the timestamp of the last
good reading, rather than silently serving an old figure. It must never be *blocking* on the commit
path (rule 13): a cost report that stops the fleet has cost more than it saves.

Charts follow the project's visualisation method: pick the form from the data's job, assign colour by
role, and **run the palette validator rather than eyeballing contrast**.

The owner reads rather than approves — **nothing in this programme is ever gated on their reply**
(`CLAUDE.md` rule 0). Decisions are ruled in writing, marked reversible, with the evidence that would
overturn them.

---

## Ruling C5 — model routing is the ORCHESTRATOR's act, at dispatch, and it starts now

**2026-08-14, orchestrator. Reversible; the tripwire and the reversal are named at the bottom.**

### Why this ruling exists at all

The routing policy has been written down since the cost programme began and **never applied**, and the
reason is a category error I made and should name: routing was filed as *a change an agent could
research and land*, like an instrument or a batching scheme. It is not. Nothing an agent writes into a
file changes which model the next agent runs on — **the model is chosen by whoever calls the dispatch
tool, at the moment of the call.** So every cost agent that "adopted" routing adopted a document, the
fleet kept running on Opus, and the largest measured lever in the programme sat at zero while smaller
ones were argued about. The dispatcher is the only actor who can pull it, and the dispatcher is me.

Measured now, across this session's subagent transcripts: **94,831 Opus requests against 9,113 Sonnet**
— 91.2% Opus. Headline: **$124.26/h, 107.2% of baseline**, mean parallelism 14.08. The programme's
target is 25% of baseline. Nothing else on the table is the size of this.

### The policy, in the only form that can be obeyed

Route at dispatch, by **what the agent's output has to survive**, never by how important the piece
sounds:

- **Opus** — anything that *judges*: critics, plan reviewers, arbiters, adversarial verification,
  blind judges, anything producing a score or a verdict, anything designing a control. Also anything
  where being subtly wrong is expensive and hard to detect. **This is the quality guard and it is not
  negotiable**: `CLAUDE.md` binds the programme to *"no sacrifices in quality, delivery speed, or
  rigour"*, and the four guards must hold **together** — a cost win bought with a worse verdict is a
  failed change, not a trade.
- **Sonnet** — enumeration, census, sweeps, mechanical verification, format and schema work, applying
  a decision already made, and any piece whose output is itself checked by a downstream critic. The
  test: *if this agent is subtly wrong, does something else catch it?* If yes, it does not need Opus.
- **When genuinely unsure, Opus.** The asymmetry is deliberate. A wrongly-cheap judge costs a bad
  verdict that misdirects weeks; a wrongly-expensive census costs a few dollars.

### Applied, not merely written

First application landed with this ruling: the repo-wide **orphaned-consumption census** dispatched on
**Sonnet** — a large, genuinely mechanical grep-and-classify sweep whose output is a map that a critic
will check. Its sibling, the **citation-staleness audit**, stayed on Opus because it must judge whether
a document's claim about the repo is false and which of two contradictory sources is authoritative.
That pair is the policy's own worked example, and the two were dispatched within a minute of each
other so they are close to a matched comparison.

### Guards, tripwire, reversal

- **Tripwire (quality).** Verdict scores and critic find-rate, tracked per model tier. If Sonnet-routed
  pieces show a materially higher rate of being overturned by their critic than Opus-routed ones, the
  routing is wrong for that class of work and the class moves back. Watch find-rate specifically:
  a cheap builder whose critic finds *more* is not necessarily a failure — it may be the gauntlet
  working — but a cheap builder whose *critic* misses things is a silent one, which is why critics
  never move.
- **Tripwire (the honest confound).** Sonnet-routed pieces will be systematically *easier* pieces,
  because that is the selection rule. So a raw quality comparison across tiers is confounded by
  construction and must never be read as "Sonnet is as good". The only clean read is within a class:
  the same kind of piece, before and after the class moved.
- **Reversal, one step:** stop passing `model` at dispatch. The fleet returns to inheriting the
  session model on the very next spawn, with no file to revert and no state to unwind. That is the
  cheapest reversal in the whole programme, and it is a reason to start now rather than to plan more.
- **This is not a licence to run fewer agents.** Parallelism is a separate guard with its own floor;
  routing must move spend per unit of work, never the amount of work in flight.
