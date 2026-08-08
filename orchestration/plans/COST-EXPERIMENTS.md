# COST-EXPERIMENTS — the plan

**Piece:** `COST-EXPERIMENTS`. **Stage:** plan (per `orchestration/PLAN-LOOP.md`). **Status:** ready for the
plan critic. **Nothing here is built.** Reads: `orchestration/COST.md`,
`reports/cost/RESEARCH-RESEARCH-COSTEXT01.md`, `orchestration/PLAN-LOOP.md`, `orchestration/RULES.md`.

**Every number below was measured at commit `db449a5`** (rule 12), by this plan agent, from the transcript
tree — not recalled. The scripts that produced them are named in §0.6.

---

## 0. What the transcript actually says — read this before the experiments

`COST.md` §2 says the transcript is ground truth. It is, but **the numbers in §2 were taken from the wrong
file**, and that changes the ranking of every lever. This section is the corrected baseline. It is the
single most load-bearing thing in this document, and the plan critic should attack it first.

### 0.1 The fleet's cost is not in the file `COST.md` §2 points at

`/root/.claude/projects/-home-user-elder-souls-claude/*.jsonl` matches **one** file — the orchestrator's
own main thread. Every record in it has `isSidechain=false`; it contains **zero** subagent requests and
**zero** Sonnet requests. Its 3,283 `claude-opus-5` requests are the orchestrator talking, and nothing else.

The fleet's own transcripts are one directory down:

```
.../3c195166-6f14-54d0-bf0f-867f7b39d84b/subagents/agent-<id>.jsonl   403 files, 540 MB
.../3c195166-6f14-54d0-bf0f-867f7b39d84b/subagents/agent-<id>.meta.json
```

Each `.meta.json` carries `{agentType, description, toolUseId, spawnDepth}`. **`description` is the
dispatch headline** — `"Critic: the map"`, `"W1-10 remediation (ultracode)"`, `"Blog: four posts"`. That
field is the attribution key this whole programme needs, and nothing in `COST.md` mentions it exists.

**Consequence for the ledger contract (`COST.md` §6.1):** `source` must be the **directory tree**, not the
single glob. An instrument that reads only the glob reports the orchestrator and calls it the fleet.

### 0.2 The corrected baseline

Priced at the real published rates (`claude-api` skill, cached 2026-06-24): Opus 5 **$5 / $25** per Mtok;
Sonnet 5 **$2 / $10** per Mtok (introductory rate, in effect until 2026-08-31 — today is 2026-08-08);
cache read **0.1×** input, 5-minute cache write **1.25×**, 1-hour cache write **2×**.

| | requests | cache_read | cache_write | output | input | **USD** |
|---|---:|---:|---:|---:|---:|---:|
| `claude-opus-5` | 78,537 | 15.25 Btok | 290.7 Mtok | 12.29 Mtok | 2.44 Mtok | **$9,821.40** |
| `claude-sonnet-5` | 5,780 | 952.4 Mtok | 16.16 Mtok | 0.54 Mtok | 0.69 Mtok | **$237.69** |
| **total** | **84,317** | **16.21 Btok** | **306.9 Mtok** | **12.84 Mtok** | **3.13 Mtok** | **$10,059.08** |

Over a 62.1-hour span: **C/H ≈ $161.98/hour. The 25% bar is C/H ≤ $40.50/hour.**

### 0.3 Where the money is, which is not where §4 assumes

| token class | USD | share |
|---|---:|---:|
| **cache_read** | **$7,817.34** | **77.7%** |
| cache_write (5m) | $1,760.36 | 17.5% |
| output | $312.76 | 3.1% |
| cache_write (1h) | $155.06 | 1.5% |
| input (uncached) | $13.56 | 0.14% |

**The cache-hit ratio is already 98.1%** of non-output input volume. `COST.md` §4.2 anticipated this
(*"it may already be high, in which case this lever is smaller than it looks"*) — but the conclusion it
draws is wrong in an important way. The ratio being high does not make the lever small; it means **the
lever is not the ratio.** Cost is dominated by re-reading an already-cached context on every request:

> **cost ≈ Σ over requests of ( context_size × 0.1 × input_price )**

So there are exactly three multiplicative handles, and only the third is in `COST.md`'s lever list:

1. **requests per agent** — median **186**, p95 443, max 545.
2. **context size per request** — median **151,760** tokens re-read per request, p95 262,931.
3. **price per token** — the model.

### 0.4 Cost is roughly quadratic in tool calls, and nothing in the programme says so

Traced through the single largest agent (`W1-10 remediation (ultracode)`, 473 priced requests): context
grows near-linearly with request index — 23.8k at request 0, 245k at 118, 505k at 354, 578k at 472. Summed
context read across the turn is 172.2 Mtok; `sum / (n × max) = 0.629` (0.5 would be exactly linear growth).

Across all 401 live agents, binned by request count:

| requests | agents | mean cost-equivalents | per request |
|---|---:|---:|---:|
| 0–99 | 86 | 1.02 M | 16,226 |
| 100–199 | 129 | 2.82 M | 18,714 |
| 200–299 | 109 | 5.61 M | 22,796 |
| 300–399 | 51 | 9.41 M | 27,488 |
| 400–499 | 20 | 13.57 M | 29,613 |

**An agent that makes twice as many tool calls costs roughly four times as much**, because each extra call
also enlarges the context every *subsequent* call re-reads. This is the largest structural lever in the
programme and it appears in neither `COST.md` §4 nor the research report's §6 ranking.

### 0.5 Three other corrections the successors need

- **`COST.md` §2: "3,230 Opus against 29 Sonnet."** That is the orchestrator's main thread. The fleet is
  **78,537 Opus requests / 366 agents** against **5,780 Sonnet / 35 agents** — Sonnet is already **7%
  of requests and 2.4% of spend**, not 0.9%. Sonnet has been used for camera work, stealth, water,
  progression, blog rounds, playability and successors. The lever is real but it is **not untouched**, and
  a claim that it is will overstate the headroom.
- **`COST.md` §2: "a typical subagent costs 130–420k tokens."** Excluding cache_read, per-agent median is
  **561k** (p25 390k, p75 771k, max 11.8 M). Including cache_read — which is what is billed — the median
  agent is **29.1 M tokens**. The 130–420k figure is roughly the output+write half of a *small* agent.
- **`COST.md` §6.1's published example prices are 3× the real rate** (`input: 15, cache_write: 18.75,
  cache_read: 1.5, output: 75`). The *ratios* are right; the absolute values look like Opus-4.1-era pricing.
  The instrument must not copy them, and the schema comment should be corrected. **Reversible ruling:** use
  $5/$25 for Opus 5 and $2/$10 for Sonnet 5, with the Sonnet introductory rate expiring 2026-08-31 encoded
  as a date-dependent price, not a constant. What would overturn it: the org's actual invoice, or a
  published price change.

### 0.6 What already exists, so the builder does not re-derive it

Four prototype scripts, written by this plan agent, live in the scratchpad suffixed with the task id.
They are prototypes, not deliverables — the builder should read them and then write the real thing.
**The scratchpad is session-scoped and may not survive to the build**, so every predicate this plan
depends on is stated in closed form in §3 and does not require them; they save time, they are not inputs:

- `survey-PLAN-COST-EXPERIMENTS.mjs` — per-agent token totals by class and model, from `subagents/`.
- `burst-PLAN-COST-EXPERIMENTS.mjs` — first-request cache behaviour, burst grouping, concurrency.
- `growth-PLAN-COST-EXPERIMENTS.mjs` — context growth within a turn, per-request cost by bin.
- `dollars-PLAN-COST-EXPERIMENTS.mjs` — the priced table in §0.2, splitting 5m and 1h cache writes.

**The 5m/1h split matters and the ledger schema omits it.** `usage.cache_creation` carries
`ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` separately, and they are priced 1.25× and 2×.
15.5 Mtok of Opus writes were 1-hour. An instrument that treats `cache_creation_input_tokens` as one
number misprices writes by up to 60%.

---

## 1. The dependency, stated honestly

**Nothing in §3 can be measured until `COST-INSTRUMENT` lands `tools/cost.mjs` writing
`docs/data/cost-ledger.json`.** `docs/data/` does not exist yet. `tools/cost-report.mjs` and
`tools/cost-fixture.json` (the renderer and its self-test fixture) do exist; `tools/cost.mjs` does not.

I am **not** planning around that by assuming it away, and I am **not** proposing this piece build its own
cost calculator — that is rule 10 and it is the exact failure `COST.md` §6 forbids. Instead:

- **E1 and E2 are specified as instrument capabilities, not as separate tools.** They are retrospective
  reads of a recorded control. They should ship *inside* `tools/cost.mjs` as flags
  (`--bursts`, `--context-profile`), because they need the same transcript parser, the same price table and
  the same per-agent attribution the instrument already needs. If `COST-INSTRUMENT` does not want them,
  they become `tools/cost-bursts.mjs` importing the instrument's parser — never re-implementing it.
- **E3, E4 and E5 change fleet behaviour and cannot start before the instrument reports a before-number.**
  `COST.md` §3 requires *"the measurement before, taken with the instrument, not recalled."* A behaviour
  change landed before the instrument has no before-number and is unmeasurable forever after.

**Sequencing ruling (reversible).** E1 and E2 are gated only on the instrument's parser; E3–E5 are gated on
the instrument's *ledger*. If the instrument slips, E1/E2 still run and still produce results, because the
control is already recorded. What would overturn it: the instrument landing with a parser that cannot
attribute a request to an agent — in which case E3's matched-pair design fails and must be redesigned
around wave-level aggregates, losing attributability.

**What this piece must not do:** compute a dollar figure of its own, write `docs/data/cost-ledger.json`, or
touch `tools/cost-report.mjs`. It consumes the instrument.

---

## 2. The ranking, and why

Ranked by **expected size × ease of testing × attributability**. The third factor does most of the work
here and it is why the order is not the research report's §6 order.

| # | Experiment | Expected size | Ease | Attributability | Lands |
|---|---|---|---|---|---|
| **E1** | Ruling C1 retrospective — did staggered dispatch help? | **≤0.20% of spend (measured ceiling)** | Trivial — already prototyped | **Perfect** — recorded control, no behaviour change | first |
| **E2** | Context-composition profile — what is in the 77.7% | No saving itself; **sizes E4** | Cheap, no browser | **Perfect** — read-only | first |
| **E3** | Model routing: Sonnet for landed-plan builds | **Up to −60% on routed agents** (price ratio 2.5×, 1.67× after 31 Aug) | Moderate — policy exists | **Weak by default**; matched pairs required | second |
| **E4** | Tool-call / context reduction | **Largest — superlinear** | Hard — new behaviour | Weak; needs replay pairs | third |
| **E5** | Criteria injection on critics (rigour, not cost) | **+13.5pp claimed judge accuracy** | Moderate; needs shadow lane | Good if A/A-controlled | parallel with E3 |

**Why E1 first despite being the smallest.** Three reasons, and only the first is about cost. (a) It is
already adopted, so it is currently unmeasured live behaviour. (b) Its control is *already banked* — it
needs no new behaviour at all, which makes it the only experiment in this document whose attribution is
beyond argument. (c) It is a **negative result**, and a programme that publishes only its wins has failed
the same way a critic who finds no gaps has failed. Getting a published negative early sets the standard.

**Why E2 before E3 despite E3 being bigger.** E2 is not a saving; it is the measurement that decides
whether E4 is worth building at all. Running E4 without E2 means building a pruning mechanism against a
guess about what is in the context. The research report ranked pruning #2 and explicitly noted it *"needs
new instrumentation before the experiment can even be designed"* — E2 is that instrumentation.

**Why E3 is second and not first, against `COST.md` §4.1.** §4.1 calls model mix *"the largest single
lever and it has barely been pulled."* On the corrected numbers it has been pulled 35 times, and its
ceiling is bounded by a price ratio of 2.5× (falling to 1.67× on 2026-08-31), not by the 99:1 request
split §2 implies. Routing *every* Opus subagent to Sonnet — which is impossible, since every critic stays
Opus — would give at most −60%. **The 25% bar cannot be reached by routing alone.** It needs E4's
structural lever. That is a correction to the programme's expectations, and it is the kind of thing the
owner should be able to read and overrule in one line.

---

## 3. The experiments

Each states: hypothesis · acceptance number, predicate, units · **how we know it is not noise** · **null
control and what inert looks like** · G1/G2/G3 checks · reversal + tripwire · instrument reused by path ·
model and why.

---

### E1 — Ruling C1: did staggered burst dispatch improve cache economics?

**Hypothesis (from `COST.md` Ruling C1).** Dispatching the first agent of a burst alone, then the rest once
its prefix is warm, raises the cache-read fraction on the followers' first requests, because *concurrent
requests cannot hit each other's cache until the first has begun streaming*.

**Acceptance number, predicate, units.**
Let a **burst** be a maximal set of agents whose first priced request timestamps are each within **120 s**
of the previous one. Let a burst be **staggered** if the gap from the 1st to the 2nd agent's first request
is **≥ 20 s**, otherwise **tight**. For each burst, over the followers (agents 2..n), compute

> `warm_fraction = (# followers whose first priced request has cache_read_input_tokens > 0) / (n − 1)`

**Accept C1 as effective iff mean `warm_fraction` over staggered bursts exceeds that over tight bursts by
≥ 10 percentage points, AND the first-request `cache_write` share of total spend is ≥ 2%** (i.e. the
mechanism is large enough to be worth a tool round). Units: percentage points, and USD share.

**How we know it is not noise.** Two guards, because per-agent cost varying 48k–419k (really 0–172 M) says
nothing about *this* statistic — `warm_fraction` is a proportion over 78 multi-agent bursts, not a cost.
(a) Report a bootstrap 95% CI over bursts; a difference whose CI crosses zero is not a difference.
(b) **The ceiling test dominates the significance test**: first-request `cache_write` is capped at a
measurable fraction of spend, so if that ceiling is below 2% the effect cannot matter regardless of p-value.
Compute the ceiling first and stop if it fails — that is cheaper than arguing about significance.

**Null control — the arm that must come out worse.** The session's **first-ever agent** is guaranteed cold:
no prior agent existed to warm anything. Its first request must show `cache_read_input_tokens == 0` and a
non-zero `cache_write`. **If the instrument reports the first-ever agent as warm, the instrument is inert
and every other number in E1 is void.** Second control arm: a synthetic burst assignment that shuffles the
tight/staggered labels at random should produce `warm_fraction` differences centred on zero — if the
shuffled labels also produce a 10pp difference, the statistic is measuring burst size, not stagger.
**What inert looks like:** both arms identical *and* the cold-start check also warm — that is a parser
reading the wrong field, not a null result.

**Prototype result, already computed (this is a prediction the builder must reproduce or refute).**
401 agents; 167 bursts, 78 multi-agent, largest 16. **Tight bursts (n=30): mean warm_fraction 0.958.
Staggered (n=48): 0.964. Difference +0.6pp — an order of magnitude below the 10pp bar.** First-request
`cache_write` totals 3.0 Mtok = **1.0% of all cache_write = 0.20% of spend** — an order of magnitude below
the 2% ceiling. Median first-request write is **6,284 tokens**; **376 of 401 agents (93.8%) already read
cache on their very first request**, because the 1-hour cache holds the shared prefix across the whole
session regardless of dispatch timing.

**Expected verdict: C1 is inert and should be reverted**, per its own stated tripwire. Its ceiling is 0.20%
of spend; it cannot matter. The mechanism the research report identified is real in the API docs and
essentially absent in this fleet, because the shared prefix is ~6k tokens, not the large corpus prefix the
hypothesis assumed. **The builder must reproduce this independently before it is published** — a plan
agent's prototype is not a result, and a build that merely agrees with this section has not checked it.

**G1 / G2 / G3.** All three are structurally untouched: E1 changes no behaviour, dispatches no agent
differently and reads only banked records. The G-check is therefore a **statement that they are unchanged
by construction**, plus the reversal's own G1 check (below). Reporting "G1/G2/G3 unaffected" without saying
*why* would be exactly the unguarded-number failure §5 forbids; the reason is: read-only on banked data.

**Reversal + tripwire.** Reversal: **stop staggering** — one line of orchestrator behaviour in
`orchestration/TICK.md`, no code. Executed on a copy: the reversal is the *absence* of a delay, so the
"copy" test is to dispatch one burst without the stagger and confirm the instrument still classifies it
(as a tight burst) and still reports warm_fraction — i.e. confirm the measurement survives the reversal.
**Tripwire (from C1 itself): if warm_fraction difference < 10pp, revert and record as a failed hypothesis
with the number.** Second tripwire on the reversal: if after reverting, mean concurrent agents falls
below 12 or spend/hour rises, restore the stagger — but note staggering *costs* one tool round per burst,
so its reversal should if anything help G1.

**Instrument reused (rule 10).** `tools/cost.mjs` (`--bursts`), from `COST-INSTRUMENT`. Prototype:
`burst-PLAN-COST-EXPERIMENTS.mjs`. Concurrency for G1: `tools/contention.mjs` is live-process contention,
not historical concurrency — **do not reuse it here**; historical concurrency comes from agent
first/last timestamps in the same parser.

**Model: Sonnet.** The acceptance is fully decidable without judgement — two proportions, a bootstrap CI
and a ceiling, all computed by a script against a fixed predicate this plan states in closed form. There
is a landed plan (this document), a named instrument, and a machine-checkable acceptance: that is the
middle row of `PLAN-LOOP.md`'s table exactly. The subject *sounds* like cache architecture, which is the
trap `COST.md` §4 lever 1 warns about — route on decidability, not on how hard the subject sounds.

---

### E2 — Context-composition profile: what is inside the 77.7%

**Hypothesis.** A large fraction of the context re-read on every request is **superseded tool output** —
file reads later re-read, command output already acted on, search results already consumed — and that
fraction is the addressable target for E4. The research report's §3.1 assumes this; nobody has measured it
here.

**Acceptance number, predicate, units.** For a stratified sample of **12 agents** (4 each from the
100–199, 200–299 and 300+ request bins, spanning builder / critic / blog `description` types), reconstruct
each turn's message array from its `.jsonl` and classify every content block at the **final** request into:
`system+brief` · `tool_result still current` · `tool_result superseded` (a later `Read`/`Bash` of the same
path or command exists, or the file was subsequently edited) · `assistant text/thinking` · `other`.

> **Report `superseded_share` = superseded tool_result tokens ÷ total final-request context tokens.**
> Units: percent of context tokens, and the USD that share represents at 0.1× input price × request count.

**This experiment has no pass/fail bar — it is a measurement, and pretending otherwise would be gaming.**
Its output is a decision rule for E4, fixed *now* so it cannot be fitted afterwards:
**if `superseded_share` ≥ 25%, E4 proceeds; if < 25%, E4 is abandoned and recorded as a hypothesis that did
not transfer**, with the number, because pruning 10% of context cannot repay the risk of a builder losing
a file it needed.

**How we know it is not noise.** `superseded_share` is a within-turn structural share, not a cost draw, so
the 48k–419k per-agent spread is irrelevant to it. Report **per-agent shares, not a pooled mean** — a
pooled mean is dominated by the largest agent (172 M tokens is 6× the median). Accept the ≥25% finding
only if the **median across the 12 agents** clears it *and* at least 8 of 12 do individually. That guards
against one browser-heavy outlier carrying the result.

**Null control — the arm that must come out worse.** The classifier must be shown able to return a **low**
number. Run it against **the first 20 requests of the same agents**, where by construction almost nothing
can yet be superseded. **That arm must report `superseded_share` near zero.** If early-turn and late-turn
context report the same share, the classifier is labelling by block type rather than by supersession and
every number is void. Second control: an agent with **≤ 30 requests** (there are 86 in the 0–99 bin) should
also come out low. **What inert looks like:** a flat share across request index — the signature of a
classifier that never actually checks whether a later read superseded an earlier one.

**G1 / G2 / G3.** Read-only on banked transcripts; no dispatch, no verdict, no rigour count is touched.
Stated as unchanged by construction, with that reason given.

**Reversal + tripwire.** The deliverable is a report plus an instrument flag; the reversal is
`git revert <commit>` of the flag, executed on a copy by running the instrument with the flag removed and
confirming the ledger still generates. **Tripwire: if `--context-profile` adds more than 20 s to the
instrument's runtime, it is moved behind an explicit opt-in flag** — `tools/cost-refresh.mjs` runs on every
bank under a timeout and must never block the commit path (rule 13, `COST.md` §6.1).

**Instrument reused.** `tools/cost.mjs` parser (`--context-profile`). The transcript already carries
`toolUseResult` on 1,828 main-thread records and the equivalent in subagent files, so supersession can be
determined from recorded tool inputs — no re-running of anything.

**Model: Opus.** This is the `W1-HUD-TOAST` case verbatim. The work *looks* like grep over JSONL, but the
load-bearing decision — **what counts as "superseded"** — is a judgement call that determines whether E4
happens at all. A `Read` of the same path twice may be supersession or may be a deliberate re-check after
an edit; a `Bash` re-run may be a retry or a new measurement. Two readers have already accepted an
uncounted premise in this project by routing that kind of decision to a builder. Opus.

---

### E3 — Model routing: Sonnet for builds with a landed plan

**Hypothesis (`COST.md` §4.1, research report #1).** Routing builds that have a landed plan, a named
existing instrument and a machine-checkable acceptance to Sonnet cuts cost per agent substantially at
quality parity. Coupled with lever 4: **the plan loop manufactures the conditions that make a build
Sonnet-eligible**, so the two must be measured together or the saving is attributed to the wrong one.

**Acceptance number, predicate, units.** The headline is **not** C/H — C/H over a wave confounds routing
with everything else running that wave. The predicate is per-agent and paired:

> Over **8 matched pairs** of build agents, `usd_per_agent` for the Sonnet arm ≤ **50%** of the Opus arm's,
> with **no degradation in G2** (below). Units: USD per agent, and USD per agent-hour.

A **matched pair** is two build agents whose dispatches share: the same landed plan section or the same
item class, a machine-checkable acceptance, a named existing instrument, and a comparable expected tool-call
count. Because true replication is impossible on a moving tree, pairs are formed **prospectively at
dispatch** — the orchestrator dispatches the pair together in the same wave, one arm each — never selected
afterwards from history, which would be fitting.

**How we know it is not noise. This is the hardest problem in the document and the place my plan is
weakest.** Per-agent cost on legitimate work spans 0 to 172 M tokens; a 2× difference between two agents
is entirely unremarkable. Three guards:

1. **Pair, do not pool.** The statistic is the **ratio within each pair**, and the test is on the 8 ratios
   (a sign test needs 7 of 8 below 1.0 for p<0.05; report the median ratio and its bootstrap CI). This
   removes between-task variance, which is the dominant term.
2. **Normalise by request count.** Report `usd_per_request` alongside `usd_per_agent`. Sonnet at the
   *same* token behaviour costs 2.5× less; measured per-request cost-equivalents are already close
   (Opus 23,538 vs Sonnet 20,591 across all agents), so the price ratio should show up almost undiluted.
   **If `usd_per_request` does not fall by ≈2.5×, something other than the model changed** — that is the
   diagnostic that catches a confounded pair.
3. **Pre-register the pairs.** The 8 pairs and their arms are named in `NEXT-DISPATCH.md` *before* the wave
   runs. A pair added afterwards is excluded from the statistic and reported separately.

**Null control — the arm that must come out worse.** An **Opus/Opus A/A pair**: two agents on the same
matched task, both Opus. **Its cost ratio must be indistinguishable from 1.0, and its spread defines the
noise floor against which the Sonnet effect is judged.** If the A/A pair itself shows a 2× cost ratio, then
a 2× Sonnet result means nothing and the acceptance bar must move to the A/A spread's upper bound. Run
**2 A/A pairs alongside the 8 test pairs.** **What inert looks like:** A/A ratio ≈ 1.0 *and* Sonnet ratio
≈ 1.0 — i.e. the routing did not take effect. Guard against that directly by asserting the arm's
transcript records `model == "claude-sonnet-5"` on ≥95% of its priced requests; a dispatch that *said*
Sonnet and *ran* Opus is rule 6's inert fix, and here it would silently report "no saving from routing."

**G1 — parallelism.** Pairs are dispatched **together in the same wave**, so the trial *adds* agents rather
than serialising them; mean concurrent agents over the trial window must not fall below the baseline.
**Caveat the instrument must resolve:** measured from agent first/last timestamps, mean concurrency over
the 62.1 h span is **4.40** with a peak of 16 — apparently already below the floor of 12. That is either a
real standing G1 breach or an artefact of averaging across idle overnight periods. **This plan does not
rule on it; it flags it as a blocking question for `COST-INSTRUMENT`,** because every experiment's G1 check
compares against a baseline, and a baseline in breach makes "G1 holds" unanswerable. If the breach is real,
the honest G1 predicate becomes *"the trial does not make concurrency worse than the same-length window
before it"*, not *"concurrency ≥ 12."*

**G2 — quality.** The Sonnet arm's output goes through the **same separate Opus critic** as the Opus arm
(critics never route — `COST.md` §4.1, §5). Compare **critic find-rate (findings per critic) and verdict
score** across arms. **This is the check that reveals a quiet quality trade**: a Sonnet build that is
cheaper *and* draws more findings from its critic is not a saving, it is a cost shifted onto the next
round. Report **cost per *accepted* piece**, i.e. including the cost of any extra remediation round the
arm triggers — a 50% cheaper build that needs one extra round is a **net loss**, because a build round is
the most expensive thing in the fleet. That single derived number is the honest G2 guard for E3.

**G3 — rigour.** Count the five non-negotiables on each arm from its verdict and status files: separate
critic with fresh context · delete-the-fix · CONSUMPTION (`RI-MTH07`) · self-test with disagreeing arms ·
read-the-actual-file. **The specific risk: a cheaper model quietly skipping delete-the-fix or the
CONSUMPTION check** because they are the most laborious steps. Any arm with a lower count than its pair
fails E3 regardless of cost. This is checkable from the shipped files, not from the agent's self-report.

**Reversal + tripwire.** Reversal: **one line in the dispatch brief** — the model field returns to Opus;
no code, no revert. Executed on a copy: dispatch one throwaway agent with the routing line removed and
confirm from its transcript that it ran Opus — that is the delete-the-fix, and it proves the routing line
was what changed the model rather than something else. **Tripwires, any one of which reverts routing
automatically:** (a) critic find-rate on Sonnet arms exceeds Opus arms by >20%; (b) any G3 count lower on a
Sonnet arm; (c) cost per accepted piece higher on the Sonnet arm; (d) mean concurrent agents falls below
the E3 baseline window.

**Instrument reused.** `tools/cost.mjs` for per-agent USD (attributed via `subagents/*.meta.json`
`description`); `tools/scores.mjs` and `tools/verdict-validate.mjs` for verdict scores;
`corpus/90-verdicts/` for find-rate; `tools/dispatchable.mjs` to identify build items that genuinely have a
landed plan (its `needs-builder` state *is* the eligibility predicate, so eligibility is machine-checked,
not judged).

**Model: Opus for the pair design, Sonnet for the analysis.** Split deliberately, on the decidability axis.
*Choosing* the matched pairs requires judgement — deciding two tasks are comparable is exactly the kind of
premise that gets accepted uncounted, and getting it wrong invalidates every number downstream. *Computing*
the 8 ratios, the sign test and the G3 counts is a fixed predicate over files. Note the recursion the brief
warns about: this piece is about measuring savings, so routing its own analysis to a cheaper model is only
legitimate because the acceptance is decidable without judgement — which for the analysis half, it is.

---

### E4 — Reducing tool-call count and context growth

**Hypothesis (research report #2, `COST.md` §4.5).** Pruning superseded tool output from a long turn cuts
tokens sharply *and* raises task completion (paper: −63% tokens, 71% → 91.6% completion). Amplified by
§0.4: because cost is superlinear in tool calls, reducing *either* calls or per-call context compounds.

**Gate:** E4 runs **only if E2 reports `superseded_share` ≥ 25%** by E2's stated rule. Written down before
E2 runs so the threshold cannot be fitted to the answer.

**Acceptance number, predicate, units.** Over **6 replay pairs** (same item, same landed plan, one arm with
the intervention, one without, dispatched together):

> `usd_per_accepted_piece` on the pruned arm ≤ **70%** of the control arm's, **and** the pruned arm's
> build-critic find-rate is **no higher** than the control's, **and** the pruned arm's G3 counts equal the
> control's. Units: USD per accepted piece; findings per critic; integer counts.

Note the acceptance is deliberately **weaker than the paper's −63%** and includes the remediation round.
A technique that halves tokens and adds a round has saved nothing.

**The experiment that catches it failing, which is what the brief asked for.** The paper's claim is that
cost and quality move *together*. The shape of a result that does not transfer is: it was measured on a
workload with verbose tool responses and no requirement to re-read ground truth, and **this project's rules
require the opposite** — rule 18 says read the actual file rather than trusting a summary, and rule 4/6
require re-reading to confirm a fix executed. So the specific failure mode is: **pruning removes a file
read the agent later needs, the agent re-reads it, and cost goes UP while the agent looks fine.**

Therefore the primary instrumented signal is not tokens. It is:

> **`re_read_rate` = the number of `Read`/`Bash` calls whose target was previously in context and was
> pruned, divided by total tool calls.**

A pruning scheme that works shows low `re_read_rate` and lower cost. A pruning scheme that fails shows
`re_read_rate` climbing and **cost flat or higher** — and crucially it fails *quietly*, because the agent
recovers by re-reading and its output looks normal. **Publish `re_read_rate` beside every E4 cost number**;
a cost saving reported without it is not a result. Second catching signal: the pruned arm's critic is asked
specifically whether the build shows evidence of acting on stale information — a criterion injected into
the critic brief (which is E5's mechanism, used here as a probe).

**How we know it is not noise.** Same paired design and A/A control as E3, plus: `re_read_rate` is a
within-agent rate, so it is comparable across agents of very different sizes. Six pairs is thin; report the
median ratio with a bootstrap CI and **state plainly that n=6 cannot resolve effects below about 20%**.

**Null control — the arm that must come out worse.** An **over-pruning arm**: prune aggressively (say,
everything beyond the last 3 tool results, well past what the intervention proposes). **That arm must come
out worse** — higher `re_read_rate`, lower verdict score, or a failed acceptance. **If the over-pruned arm
performs as well as the tuned one, the pruning is not doing anything** and the "saving" is coming from
somewhere else (rule 6's inert fix that improves the number). This is the most important control in the
document, because the pruning mechanism is exactly the sort of change that could be silently no-op'd by the
harness while the measurement still moves.
**What inert looks like:** all three arms — control, tuned, over-pruned — within noise of each other, with
`re_read_rate` at zero everywhere. That means the pruning never executed; check the code ran (rule 6),
do not report a null.

**G1.** Pairs dispatched together; concurrency measured over the trial window against the preceding window.
**G2.** Verdict score and find-rate per arm, same Opus critic both arms; plus the stale-information
criterion above. **G3.** The five counts per arm; a pruned arm that reads fewer actual files is a **direct**
rule-18 violation and fails outright — this is the guard most likely to fire, and it should.

**Reversal + tripwire.** Reversal: the intervention is a flag on the dispatch/brief path; `git revert
<commit>` plus removing the flag. **Executed on a copy before the trial is reported**: re-run one pruned
agent's task with the flag off and confirm the token count returns to the control arm's level — if it does
not, something else was carrying the number. **Tripwires:** `re_read_rate` > 5%; any G3 count lower than
control; find-rate up >20%; or cost per accepted piece not below control.

**Instrument reused.** `tools/cost.mjs` (`--context-profile` from E2 supplies the classifier that also
computes `re_read_rate`); `tools/scores.mjs`; `corpus/90-verdicts/`.

**Model: Opus.** The acceptance depends on judging whether a build acted on stale information and whether a
re-read was caused by pruning or was a legitimate re-check — not decidable without judgement. Critics on
both arms are Opus by standing rule.

---

### E5 — Criteria injection on critics, without contaminating the verdict record

**Hypothesis (research report §4.1).** Injecting task-specific criteria into a judge's brief raises
accuracy by **+13.5pp at near-zero cost**. This is the only lever found that **raises rigour per token**
rather than defending it — it moves G2 upward instead of protecting it, which makes it more valuable than
any saving in this document if it holds.

**The contamination problem, and the design that solves it.** A critic whose method changes mid-wave makes
the score series incomparable, and `docs/progress.html`'s entire value is that scores are comparable over
time. So **the criteria-injected critic must never write a verdict of record.** Three arms per trial piece:

| arm | brief | verdict written to | counts toward the record? |
|---|---|---|---|
| **A — control** | unchanged | `corpus/90-verdicts/` | **yes** — this is the verdict of record |
| **A′ — A/A duplicate** | unchanged, fresh context | `corpus/90-verdicts/shadow/` | no |
| **B — treatment** | criteria-injected | `corpus/90-verdicts/shadow/` | no |

`corpus/90-verdicts/shadow/` must be a path **`tools/scores.mjs` and `tools/verdict-staleness.mjs` do not
read**. The builder must **prove** that by perturbation, not by inspection: write a deliberately absurd
shadow verdict (score 0 or 10), run `tools/scores.mjs`, and confirm the published score series does not
move. That is the CONSUMPTION check (`RI-MTH07`) pointed at the quarantine — if the shadow lane can move
the record, the whole experiment is contaminated and must not run.

**Acceptance number, predicate, units.** Over **6 trial pieces** (18 critic runs):

> **`find_rate_B − find_rate_A ≥ 1.5 × |find_rate_A′ − find_rate_A|`**, where `find_rate` = number of
> distinct findings the critic raises, counted by a **blind adjudicator agent** that sees the three verdicts
> with arm labels stripped. Units: findings per critic. Secondary: **`usd_per_finding`** per arm — the
> rigour-per-token number this lever is actually about.

Counting findings is a judgement call, so it is not done by the arms or by this piece's builder — rule 25's
principle: do not grade a pack you built. The adjudicator is a separate agent with fresh context.

**How we know it is not noise.** **This is what the A′ arm is for and it is the whole design.** Two critics
with the same brief and fresh context will differ; `|A′ − A|` measures that irreducible spread directly, on
the same pieces, at the same time. The acceptance is defined *relative to* that spread rather than against
an absolute threshold, so no separate variance model is needed. Report the per-piece triples, not a pooled
mean. With n=6, state plainly that only a large effect is detectable — the paper's +13.5pp on judge
accuracy is not the same statistic as find-rate, so **a null here does not refute the paper**; it says the
mechanism did not transfer to our critic shape, which is a publishable finding either way.

**Null control — the arm that must come out worse.** The **A′ arm is itself the null control**: it receives
the treatment's *form* (a second dispatch, a shadow path, an adjudicated verdict) and none of its
*content* (identical brief). **If B beats A but A′ also beats A by the same margin, the effect is
dispatch-order or shadow-lane artefact, not criteria injection.** Additionally, a **degenerate-criteria
arm** on 2 of the 6 pieces: inject criteria that are true but vacuous ("check the file exists"). **That arm
must not improve find-rate.** If vacuous criteria help as much as real ones, the effect is "the brief is
longer", not "the criteria are better".
**What inert looks like:** all three arms within one finding of each other on every piece, with
`usd_per_finding` flat — which is a plausible real null and must be reported as such, *provided* the shadow
lane has been shown live by the perturbation check above. An untested quarantine plus a flat result is
indistinguishable from the shadow critics never having run.

**G1.** E5 **adds** agents (2 extra critics per trial piece); concurrency can only rise. The real G1 risk is
budget, not parallelism — 12 extra Opus critics at ~$25 each is roughly $300, which the plan should state
plainly rather than hide. **G2.** E5's entire purpose is G2; the treatment must not be allowed to touch the
record, which the quarantine enforces and the perturbation check proves. **G3.** Unchanged — no critic is
cut, none is replaced, the separate-fresh-context rule is honoured three times over. E5 is the one
experiment here that *strengthens* G3 by construction.

**Reversal + tripwire.** Reversal: delete the shadow lane and the injected-criteria brief template;
`git revert <commit>`. **Executed on a copy:** confirm `tools/scores.mjs` output is byte-identical before
and after the revert — since the shadow lane never fed the record, a correct implementation reverts to a
no-op, and **if the published scores change on revert, the record was contaminated** and the trial must be
voided and said so. **Tripwire:** if any shadow verdict is ever read by `tools/scores.mjs`,
`tools/verdict-staleness.mjs` or the progress page, stop immediately and void the trial.

**Instrument reused.** `tools/scores.mjs` (as the thing that must *not* move), `tools/verdict-validate.mjs`,
`tools/verdict-staleness.mjs`, `corpus/90-verdicts/`, `tools/cost.mjs` for `usd_per_finding`.

**Model: Opus, all arms, no exceptions.** Every critic is Opus by standing rule (`COST.md` §4.1,
`PLAN-LOOP.md`); routing any arm differently would confound the treatment with the model and destroy the
comparison. The adjudicator is Opus because counting distinct findings across three prose verdicts is
irreducibly a judgement call — the exact opposite of a machine-checkable acceptance.

---

## 4. What this plan does not cover

- **The orchestrator's own cost** (`COST.md` §4.6). Its main thread is $3,283 requests' worth and is in
  scope for the programme but not for these five experiments. §0.1's finding — the orchestrator's thread is
  a *separate* file from the fleet's — makes it independently measurable, which is a gift; it deserves its
  own piece.
- **Compaction** (research #5). Correctly ranked last; needs an agent crossing the 150k trigger and a check
  that the harness exposes the API at all. Not planned here.
- **Cache TTL choice.** 15.5 Mtok of Opus writes were 1-hour (2×) rather than 5-minute (1.25×). At $155 it
  is 1.5% of spend, below the threshold worth an experiment, but the instrument must split them or it
  misprices writes.

## 5. What I am least sure of, and the plan critic's strongest move

**Least sure of, in order.**

1. **That E3's matched pairs can be made to hold.** Two build agents on "comparable" tasks on a tree that a
   dozen agents are changing underneath them is a weaker control than I have written it as. The A/A pair
   is my guard, but if the A/A pair's cost ratio comes back at 2× — entirely possible given the 0–172 M
   spread — then E3's 50% acceptance bar is *inside the noise* and the experiment cannot conclude anything
   with n=8. I have not sized n against a measured A/A spread because that spread has never been measured.
   **The honest fix, which I am ruling now: run the 2 A/A pairs FIRST, before the 8 test pairs, and let
   their spread set both the acceptance bar and n.** If the A/A spread is wide, E3 needs more pairs than the
   fleet can afford, and that itself is the finding.
2. **That `superseded_share` is well-defined enough to survive a critic.** A `Read` of the same file twice
   is supersession or diligence depending on intent, and I have specified a classifier that must decide.
   E2's early-turn null control tests the classifier's *sensitivity* but not its *validity*.
3. **The G1 baseline.** Mean concurrency of 4.40 against a floor of 12 is either a standing breach nobody
   has noticed or an artefact of my averaging window. I flagged it rather than ruling it, which is the
   right call for a plan agent, but it leaves every G1 predicate in this document conditional.
4. **That E1's ceiling argument generalises.** I measured first-request cache_write at 0.20% of spend *in
   this session*, where a 1-hour cache kept the prefix warm throughout. A fresh session, or a much larger
   shared prefix, could make C1 matter. The result should be stated as "inert under these conditions",
   not "the mechanism is fake".

**The plan critic's strongest move against this document — I think there are two, and the second is worse.**

**The obvious one:** *"You have written five experiments and only two of them can run, because three depend
on an instrument that does not exist and on matched pairs you admit may not hold. Cut to E1 and E2."* I
think that move is half-right and I would concede half of it: E1 and E2 should ship first and alone. But
cutting E3–E5 entirely would leave the programme with two read-only measurements and no test of any
intervention, which fails the owner's actual instruction to *test techniques and measure results*.

**The sharper one, and the one I would lead with if I were the critic:** *"Your §0 rewrites the programme's
baseline from a prototype you ran once, and then you rank every experiment using those numbers — including
the decision to demote `COST.md`'s largest lever and to declare an already-adopted ruling inert. You have
made this plan's entire ranking depend on a measurement that has had no critic, taken with a script you
wrote yourself, against a file nobody else has parsed."* That is correct and it is the real weakness.
My mitigations are: every §0 number names the script that produced it; E1 explicitly requires the builder to
**reproduce the C1 result independently rather than confirm mine**; and the E2/E1 null controls are designed
to catch a mis-parse (a cold-start agent reading warm, a flat supersession share). But the honest statement
is: **§0 is a plan agent's prototype, not a result, and if the instrument's parser disagrees with it, the
instrument wins and this plan's ranking must be redone.** I would rather write that sentence than have the
critic extract it.

**A third, narrower move I will pre-empt:** *"E1 predicts its own result, which makes the build a
rubber stamp."* Fair. The mitigation is that E1's acceptance, predicate, burst definition and both null
controls are stated in closed form *above* the prototype result, so the builder can execute them without
reading my number — and the cold-start control fails loudly if the builder simply reproduces my parser's
bug rather than my parser's finding.
