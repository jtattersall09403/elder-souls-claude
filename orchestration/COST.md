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

**The five non-negotiables (G3), which no cost measure may reduce.** Every one has caught something
expensive; each is cheap relative to what it prevents:
one separate critic with fresh context per piece · delete-the-fix · the CONSUMPTION check
(`RI-MTH07`) · a self-test with arms that genuinely disagree · reading the actual file rather than
trusting a summary.

## 2. What is already known, measured not guessed

Taken from the session transcript at `/root/.claude/projects/-home-user-elder-souls-claude/*.jsonl`,
which carries per-request `model`, `timestamp` and a `usage` block with `input_tokens`,
`cache_creation_input_tokens`, `cache_read_input_tokens` and `output_tokens`. **That file is the
ground truth for this programme.** Anything not derived from it is an opinion.

- **The fleet is essentially all Opus: 3,230 `claude-opus-5` requests against 29 Sonnet.** The
  existing model-choice policy in `PLAN-LOOP.md` — Sonnet for a build with a landed plan and an
  existing instrument — has been written down and almost never applied. This is the largest single
  lever and it has barely been pulled.
- A typical subagent costs **130–420k tokens**. Recent completions: 131k, 137k, 155k, 165k, 204k,
  372k, 376k, 419k. A wave of fourteen is several million.
- The **plan loop's own estimate was wrong and low** — 60–100k projected for plan *and* critic; the
  plan half alone cost 131k. Corrected in `PLAN-LOOP.md`. Assume estimates here are optimistic until
  measured; that is exactly the failure this programme must not repeat about itself.

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

1. **Model mix.** 3,230 Opus vs 29 Sonnet. Route by task shape, not by habit: measurement design,
   seam rulings, graded prose and every critic stay Opus; a build with a landed plan, an existing
   instrument and a machine-checkable acceptance is a Sonnet job. **Haiku is unproven here and no
   build should be its first job** — trial it on one mechanical task and measure before trusting it.
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
  "window": { "from": ISO, "to": ISO, "hours": 62.4 },  // what the totals cover
  "prices": { "note": "usd per Mtok", "claude-opus-5": { "input": 15, "cache_write": 18.75,
              "cache_read": 1.5, "output": 75 } },      // published so a reader can audit the money
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
  "by_model": [ { "model": "claude-opus-5", "usd": 1180.2, "requests": 3230,
                  "tokens": { "input": n, "cache_write": n, "cache_read": n, "output": n } } ],
  "by_token_class": [ { "class": "input|cache_write|cache_read|output", "usd": n, "tokens": n } ],
  "guards": {                                // G1-G3, beside the cost and never on another page
    "g1_parallelism": { "mean_agents": 13.9, "floor": 12, "status": "ok|breach", "window_hours": 1 },
    "g2_quality": { "mean_verdict_score": 7.4, "baseline_mean_verdict_score": 7.1,
                    "critic_find_rate": 3.2, "baseline_critic_find_rate": 3.0, "status": "ok" },
    "g3_rigour": { "counts": { "separate_critic": n, "delete_the_fix": n, "consumption": n,
                   "self_test": n, "arms_disagree": n }, "baseline_counts": { ... },
                   "status": "ok" }
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
