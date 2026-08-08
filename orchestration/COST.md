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
plan → plan critic (BLOCKING/CARRIED, bounded at two exchanges, no browser) → build → build critic
with fresh context. No agent grades its own saving. **A critic that cannot find a gap has failed**
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

### 0. Cost is roughly QUADRATIC in tool calls — the largest structural lever, and it was missing

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

## 5. What this programme may never do

- **Never cut a critic.** The separate-critic rule is where the quality lives; a build with no critic
  is cheaper and worthless.
- **Never cut the controls.** Delete-the-fix, the null control and the self-test that goes red are
  the only reason any number here means anything.
- **Never trade speed for cost.** The parallelism floor of 12 is a floor during this programme too.
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
    // critic_find_rate = 0 (rule 23: a critic that cannot find a gap has failed) — the exact shape
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
  reversed ones. A ledger showing only what worked is the same failure as a critic who finds no gaps.

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
