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
.../3c195166-6f14-54d0-bf0f-867f7b39d84b/subagents/agent-<id>.jsonl   ~405 files, 540 MB
.../3c195166-6f14-54d0-bf0f-867f7b39d84b/subagents/workflows/wf_*/                 (duplicates — exclude)
.../3c195166-6f14-54d0-bf0f-867f7b39d84b/subagents/agent-<id>.meta.json
```

Each `.meta.json` carries `{agentType, description, toolUseId, spawnDepth}`. **`description` is the
dispatch headline** — `"Critic: the map"`, `"W1-10 remediation (ultracode)"`, `"Blog: four posts"`. That
field is the attribution key this whole programme needs, and nothing in `COST.md` mentions it exists.

**Consequence for the ledger contract (`COST.md` §6.1):** `source` must be the **directory tree**, not the
single glob. An instrument that reads only the glob reports the orchestrator and calls it the fleet.

### 0.1a Correction, made by this plan agent before the critic saw it

**My first pass double-counted, and the numbers in an earlier draft of this section were ~1.7× too high.**
The transcript repeats requests across files: deduplicating on `requestId` (falling back to `message.id`)
removes **39,245 priced requests carrying 6.90 Btok of cache_read**. `subagents/workflows/wf_*/` is a second
duplication route and is excluded here (top-level `subagents/*.jsonl` only).

The sibling `COST-INSTRUMENT` plan, banked at `db449a5`, independently derived **$5,792.69** and found the
same duplication. My deduped figure is **$5,887.01** all-in (**$5,346.01** subagents + ~$541 orchestrator);
the residual gap is file-set selection, not method. **`COST-INSTRUMENT`'s number is the one of record** —
the instrument owns cost (rule 10), and this piece consumes it. I record the disagreement and my own error
rather than quietly restating a corrected figure as if it had always been there.

**Every qualitative conclusion in this section survived the correction**, and two got stronger: cache_read's
share rose 77.7% → **81.6%**, and C1's ceiling rose 0.20% → **0.32%** — still an order of magnitude below
its own bar. Nothing in §2's ranking changed. That is worth stating precisely because it is the kind of
claim a critic should distrust: the numbers moved and the conclusions did not, which is either robustness or
motivated reasoning. The reason it is the former is that all four conclusions are **ratios and shares**,
and uniform double-counting of whole requests scales numerator and denominator together.

### 0.2 The corrected baseline

Priced at the real published rates (`claude-api` skill, cached 2026-06-24): Opus 5 **$5 / $25** per Mtok;
Sonnet 5 **$2 / $10** per Mtok (introductory rate, in effect until 2026-08-31 — today is 2026-08-08);
cache read **0.1×** input, 5-minute cache write **1.25×**, 1-hour cache write **2×**.

Deduplicated, subagents only (403 agents; the orchestrator's own thread adds ~$541 on top):

| | agents | requests | **USD** | share of spend |
|---|---:|---:|---:|---:|
| `claude-opus-5` | 368 | 42,893 | **$5,218.97** | 97.6% |
| `claude-sonnet-5` | 35 | 3,089 | **$127.04** | **2.4%** |
| **subagent total** | **403** | **45,982** | **$5,346.01** | |

All-in (with the orchestrator) **≈ $5,887**; use `COST-INSTRUMENT`'s $5,792.69 as the figure of record.
Its C/H is **$111.40/hour over 52 active clock-hours**, and its 25% bar is **C/H ≤ $27.85/hour**. I adopt
its window convention (active hours, excluding idle) rather than my earlier 62.1-hour span, because
excluding idle hours is what makes idling cost-neutral — otherwise the fleet can improve C/H by pausing,
which is the exact gaming `COST.md` §1 forbids.

### 0.3 Where the money is, which is not where §4 assumes

Subagent spend by token class, deduplicated:

| token class | USD | share |
|---|---:|---:|
| **cache_read** | **$4,362.72** | **81.6%** |
| cache_write (5m) | $926.72 | 17.3% |
| output | $51.46 | 1.0% |
| input (uncached) | $5.11 | 0.1% |
| cache_write (1h) | $0.00 | 0.0% |

**Output is 1% of spend.** Every instinct that says "make the agent write less" is aimed at a rounding
error. The 1-hour cache writes are entirely the orchestrator's, not the fleet's — but the ledger schema
must still split the TTLs, because 5m and 1h are priced 1.25× and 2× and the orchestrator is in scope.

**The cache-hit ratio is already 98.3%** of non-output input volume. `COST.md` §4.2 anticipated this
(*"it may already be high, in which case this lever is smaller than it looks"*) — but the conclusion it
draws is wrong in an important way. The ratio being high does not make the lever small; it means **the
lever is not the ratio.** Cost is dominated by re-reading an already-cached context on every request:

> **cost ≈ Σ over requests of ( context_size × 0.1 × input_price )**

So there are exactly three multiplicative handles, and only the third is in `COST.md`'s lever list:

1. **requests per agent** — median **102**, p95 258, max 359.
2. **context size per request** — median **159,515** cached tokens re-read per request.
3. **price per token** — the model.

### 0.4 Cost is roughly quadratic in tool calls, and nothing in the programme says so

Traced through the single largest agent (`W1-10 remediation (ultracode)`, 314 deduplicated priced
requests): context grows near-linearly with request index — **23,757 tokens at request 0, 257,686 at 78,
390,748 at 156, 513,409 at 234, 578,648 at 313**. Summed context read across the turn is **119.6 Mtok**;
`sum / (n × max) = 0.658`, where 0.5 is exactly linear growth and 1.0 would be a flat context. Near-linear
growth in per-request context means **total cost grows with the square of the tool-call count.**

Across all 403 live agents, binned by request count (deduplicated, real USD):

| requests | agents | mean USD/agent | USD per request |
|---|---:|---:|---:|
| 0–99 | 190 | $4.55 | $0.0836 |
| 100–199 | 162 | $16.17 | $0.1159 |
| 200–299 | 42 | $33.20 | $0.1389 |
| 300–399 | 9 | $51.83 | $0.1565 |

**A ~3.5× rise in request count buys an ~11× rise in cost**, because each extra call also enlarges the
context every *subsequent* call re-reads — per-request cost itself nearly doubles across the range. This is
the largest structural lever in the programme and it appears in neither `COST.md` §4 nor the research
report's §6 ranking. It is also the lever with the most obvious quality hazard: the cheapest agent is one
that does no work, so **any experiment on it must be paired with a quality arm or it is worthless.**

### 0.5 Three other corrections the successors need

- **`COST.md` §2: "3,230 Opus against 29 Sonnet."** That is the orchestrator's main thread. The fleet is
  **42,893 Opus requests / 368 agents** against **3,089 Sonnet / 35 agents** — Sonnet is already **6.7%
  of requests and 2.4% of spend**, not 0.9%. Sonnet has been used for camera work, stealth, water,
  progression, blog rounds, playability and successors. The lever is real but it is **not untouched**, and
  a claim that it is will overstate the headroom.
- **`COST.md` §2: "a typical subagent costs 130–420k tokens."** The median agent makes 102 priced requests
  and costs **$4.55–$16.17** depending on bin; in tokens it is dominated by cache_read, which the 130–420k
  figure omits entirely. Stating agent cost in undifferentiated "tokens" is the error — four token classes
  differ in price by 250× (cache_read $0.50/Mtok vs output $25/Mtok on Opus), so a token count without its
  class mix carries almost no information about cost.
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
- `dollars-PLAN-COST-EXPERIMENTS.mjs` — the priced table, splitting 5m and 1h cache writes.
- `dedup-PLAN-COST-EXPERIMENTS.mjs` — **the one that found my own double-count**; compares raw vs
  deduplicated totals and counts duplicate priced requests. Run this before trusting any of the others.
- `redo-PLAN-COST-EXPERIMENTS.mjs` — every §0 figure recomputed with deduplication (the numbers above).
- `trace-PLAN-COST-EXPERIMENTS.mjs` — the §0.4 context-growth trace.

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
| **E1** | Ruling C1 retrospective — did staggered dispatch help? | **≤0.32% of spend (measured ceiling)** | Trivial — already prototyped | **Perfect** — recorded control, no behaviour change | first |
| **E2** | Context-composition profile — what is in the 81.6% | No saving itself; **sizes E4** | Cheap, no browser | **Perfect** — read-only | first |
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
Deduplicated: 403 agents; 168 bursts, 79 multi-agent, largest 16. **Tight bursts (n=30): mean
warm_fraction 0.958. Staggered (n=49): 0.965. Difference +0.7pp — an order of magnitude below the 10pp
bar.** First-request `cache_write` totals 3.02 Mtok = **2.0% of all cache_write = 0.32% of spend** — an
order of magnitude below the 2%-of-spend ceiling. **378 of 403 agents (93.8%) already read cache on their
very first request**, because the shared prefix stays warm across the session regardless of dispatch
timing.

**Expected verdict: C1 is inert and should be reverted**, per its own stated tripwire. Its ceiling is 0.32%
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

### E2 — Context-composition profile: what is inside the 81.6%

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
the 62.1 h wall-clock span is **4.40** with a peak of 16 — apparently already below the floor of 12, and
over `COST-INSTRUMENT`'s 52 *active* hours it is **5.3**, still less than half the floor. That is either a
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
4. **That E1's ceiling argument generalises.** I measured first-request cache_write at 0.32% of spend *in
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

---

# PLAN CRITIC — `PLAN-COST-EXPERIMENTS-critic`

**Verdict: BLOCKED pending items 1–7.** Bounded at two exchanges (`PLAN-LOOP.md`); this is exchange 1.
No browser, nothing built, read-only on the transcript tree and on a scratch copy of `tools/`.

**Everything numeric below was re-derived by this critic at commit `b376ac4`**, independently of the plan's
prototypes, with scripts in the scratchpad suffixed `-PLAN-COST-EXPERIMENTS-critic`
(`verify-`, `verify2-`, `e5probe-`). Tree read: 1 orchestrator file + **408** `subagents/*.jsonl`
(workflows excluded and separately confirmed to contribute **0** new distinct `message.id`).
88,068 usage-bearing records → **48,418 distinct requests**; 39,650 duplicate records dropped.

## §0 first, because the plan is right that it is the load-bearing thing

The plan named its own strongest weakness correctly: §0 rewrites the programme's baseline from one
unreviewed parser. So I re-derived it from scratch. **The method survives; two of the three headline
claims survive intact; the third is materially overstated.**

| plan §0 | this critic, independently | |
|---|---|---|
| subagent spend $5,346.01 / 403 agents | **$5,396.58 / 406 agents** | agrees |
| all-in ≈ $5,887 | **$5,942.81** | agrees; the 2.6 % spread across three readings (instrument $5,792.69) is **source drift, not method** — the tree is appended to while it is parsed (`COST-INSTRUMENT` §0.4), and the three readings saw 403 / 406 / 408 agents |
| cache_read 81.6 % of subagent spend | **81.3 % all-in** | agrees |
| output ≈ 1 % | **1.7 % all-in** | agrees |
| Sonnet 35 agents / 3,089 requests | **35 agents / 3,178 requests** | agrees — `COST.md` §2's "29 Sonnet" really was the main thread only |

**So the plan's §0 is sound and its corrections to `COST.md` §2 stand.** The three consequential claims
are ruled on individually below.

---

## Ruling A — Ruling C1 is inert. The revert was correct. *(reversible)*

Reproduced without reading the plan's parser, on the same predicates stated in §3 E1:

| | plan | this critic |
|---|---|---|
| multi-agent bursts | 79 | **80** (170 bursts, largest 16) |
| tight arm mean `warm_fraction` | 0.958 (n=30) | **0.9591 (n=31)** |
| staggered arm | 0.965 (n=49) | **0.9646 (n=49)** |
| difference | +0.7 pp | **+0.56 pp** (bar: 10 pp) |
| agents warm on their first request | 378 / 403 (93.8 %) | **381 / 406 (93.8 %)** |
| first-request `cache_write` as share of spend | 0.32 % | **0.322 % of subagent spend, 0.292 % all-in** (3.05 Mtok, $17.36) |

Two things the plan did not have, both of which strengthen the revert:

- **The cold-start null control fires.** The first-ever agent (`agent-ad66e5f929e554104`) shows
  `cache_read = 0`, `cache_write_5m = 22,925` on its first priced request. The control can go red, and
  it goes red exactly where it should. The parser is not reading the wrong field.
- **A label-shuffle permutation null.** Shuffling the tight/staggered labels 2,000 times gives a
  95 % band of **[−5.78, +7.58] pp**; observed +0.56 pp, **p = 0.854**. The effect is not merely below
  the bar, it is indistinguishable from label noise.

**C1 stays reverted.** A live saving has *not* been switched off on bad evidence — the ceiling is
$17.36 against a $5,942 bill, and no dispatch policy can recover money that was never spent.
**What would overturn it:** a session whose shared prefix is materially larger than this one's, or a
cold start with no 1-hour cache holding the prefix — the plan's own §5.4 caveat, which is correct and
should be kept in the published finding as "inert under these conditions".

## Ruling B — cost is superlinear in tool calls, but it is **not** quadratic, and `COST.md` §4.0 overstates it

**The mechanism is real and it is not confounded.** I ran the confound test the brief asks for: mean
context tokens at request index *k*, split by the agent's eventual size bin. If long agents were simply
heavier work, their early requests would already be dearer. They are not — they are marginally *lighter*:

| k | 0–99 | 100–199 | 200–299 | 300+ |
|---:|---:|---:|---:|---:|
| 0 | 25,571 | 25,845 | 25,929 | 25,608 |
| 20 | 114,061 | 105,810 | 102,085 | 97,291 |
| 40 | 158,397 | 145,488 | 140,067 | 143,644 |
| 80 | 244,483 | 214,865 | 204,915 | 199,337 |
| 150 | — | 323,396 | 298,456 | 300,022 |

At every matched index the four bins agree to within a few percent. **The rise in cost per request across
bins is accumulation, not workload.** Context grows at a median **2,005 tokens per request**
(p10 1,234, p90 3,311) almost independently of what the agent is doing — this is a property of the
harness, not of the piece. The lever exists.

**But the magnitude in `COST.md` §4.0 is wrong in two ways:**

1. **"A ~3.5× rise in request count buys an ~11× rise in cost"** compares bin *labels*, not bin *means*.
   The 0–99 bin's mean is **54** requests, the 300+ bin's is **331** — a **6.1×** rise, not 3.5×. The
   cost rise is 11.3×. So the superlinear part is **1.85×**, which is exactly the measured per-request
   cost ratio ($0.0842 → $0.1565 = 1.86×).
2. **The measured exponent is 1.29, not 2.** Regressing `log(usd)` on `log(requests)` over 404 agents:
   **exponent 1.286, R² 0.876**. Quadratic would be 2.0. The reason is in the same data: the context
   curve is concave, not linear — `sum/(n·max)` has median **0.637** (0.5 = linear from zero), so growth
   flattens, and a ~25 k fixed prefix sits under every agent.

**Consequence.** §0.4's finding is correct in kind and roughly **half the size** it is now recorded at in
`COST.md` §4.0, which calls it "roughly QUADRATIC" and ranks it top on that basis. The honest statement is
*"cost is clearly superlinear in tool calls — measured exponent 1.29 across 404 agents; per-request cost
1.86× from the shortest to the longest bin"*. It is still the largest structural lever and it still
belongs at the top of the ranking; it is not a squared law. **This is BLOCKING (item 2) because the wrong
exponent is now the programme's top-ranked lever in a doctrine file.**

**What would overturn it:** a fleet whose agents run long enough that the fixed prefix stops dominating —
the exponent rises toward 2 as `n × slope ≫ ctx₀`, so this is a statement about *this* fleet's agent
lengths, not about the mechanism.

## Ruling C — G1: **`COST-EXPERIMENTS` is right and `COST-INSTRUMENT`'s 13.10 is a biased estimator.** *(reversible)*

This is the item the brief calls highest-value, and it resolves cleanly. Three readings, one dataset,
all computed here:

| reading | value | what it counts |
|---|---:|---|
| **A** — `COST-INSTRUMENT` §4.1: agents *issuing* ≥1 request in an hour, over active hours | **12.65** (they report 13.10) | hour-bucket membership |
| **B** — `COST-INSTRUMENT`'s alternative: agents *present* in an hour | mean 12.73, **median 12**, 25 of 51 hours below floor | hour-bucket membership |
| **C** — time-integral of live agents (Σ agent-durations ÷ hours) | **5.44** mean, **4.95** median, peak 17 | instantaneous concurrency |

**C is correct and A and B are both wrong, for the same reason.** `TICK.md` §2a says *"Never fewer than
12 agents running"* — that is a statement about an instantaneous count, and the only unbiased estimator
of the mean of an instantaneous count is the time integral. Hour-bucketing credits an agent with a whole
hour of presence for any part of it. Measured here: the mean agent touches **1.59 hour buckets** while
living **0.575 h** (median lifetime 34.5 min) — a **2.76× inflation**, which is exactly the gap between
645 bucket agent-hours and **276 real agent-hours**.

**And the bias is not neutral — it points the wrong way for this programme.** The inflation factor is a
function of agent lifetime, so *shortening agents inflates bucket-counted concurrency for free*. The
programme's top-ranked lever (§0.4, `COST.md` §4.0) is "shorter agents". A parallelism guard that the
headline cost lever improves by construction is not a guard.

**The under-count objection, tested and dismissed.** "First→last priced request" ignores spawn and
teardown. Measured: head gap median **2.2 s**, tail gap median **0.0 s** (p90 9.4 s); using the full
record span instead raises total agent-hours from 278.2 to 280.9, **+1.0 %**. Reading C is not materially
short.

**So: the fleet has been in standing, severe G1 breach for its entire history.** Mean live agents
**5.44** against a floor of 12; **1 of 51 active hours** reaches the floor; **92.1 %** of live wall-clock
time has fewer than 12 agents alive. Peak instantaneous 17 — the orchestrator does hit the target at
dispatch and then decays between waves. Neither plan's number was a lie; `COST-EXPERIMENTS`' 4.40 simply
used the span denominator that `COST.md` forbids for gameability, and its own **5.3 over active hours**
was the right figure all along (I get 5.41–5.44).

**Two consequences that belong to `COST.md`, not only to this plan, and which I rule now rather than ask:**

- **`COST.md`'s Ruling C2 ("G1 is the median, not the mean") chose between two readings that share the
  same bias.** It should be superseded: **G1 is the time-weighted mean of live agents over active hours,
  published beside the fraction of live time below the floor.** C2's actual argument — do not pick the
  metric after seeing which passes — is untouched and is why this ruling goes the way it does: reading C
  is the one that fails, and it is still the correct one.
- **C/H is not scale-invariant in parallelism, and the 25 % bar is stated against a baseline measured at
  5.4 concurrent agents.** If the fleet complies with its own floor, spend per active hour roughly
  doubles with no change in efficiency whatsoever, and the 25 % target silently becomes ~11 % of a
  compliant baseline. **Cost per agent-hour is the parallelism-invariant metric and `COST.md` §1 already
  mandates it as the diagnostic; the bar should be carried on it.** What would overturn this: a
  demonstration that C/H and cost-per-agent-hour move together across a real parallelism change.

**This resolves the disagreement, so it is not BLOCKING for being unresolved.** It is BLOCKING (item 1)
for its consequence: every G1 predicate in E1–E5 is written against "≥ 12", a value the fleet has never
met, which makes "G1 holds" unanswerable exactly as §5.3 feared.

---

## BLOCKING — resolve before build

**1. Every G1 predicate in E1–E5 is written against a floor the fleet has never met. Adopt the plan's own
fallback as the operative predicate.** Per Ruling C, replace "mean concurrent agents ≥ 12" everywhere in
§3 with the predicate §3 E3 already drafted and then declined to adopt: *"the trial does not make
time-weighted mean live agents worse than the same-length window immediately before it"*, measured as
Reading C, with the absolute value published beside it. Record Ruling C in `COST.md` (superseding C2) so
`COST-INSTRUMENT` inherits it — its `g1_parallelism` block must gain a third field for the time-integral
reading, and the floor applies to that one.

**2. §0.4's magnitude is overstated and it is now doctrine.** Per Ruling B: correct §0.4 and `COST.md`
§4.0 to the measured exponent (**1.29, R² 0.876**), correct "3.5× buys 11×" to "**6.1× buys 11.3×**", and
drop "quadratic" for "superlinear". Keep the ranking — the lever survives at roughly half the claimed
size, and the confound test above is the evidence it deserves and currently lacks.

**3. E1's acceptance predicate is arithmetically unsatisfiable.** *"Mean `warm_fraction` over staggered
bursts exceeds tight by ≥ 10 percentage points"* requires the staggered arm to reach **1.059** when the
tight arm sits at 0.959. No data can satisfy it. A predicate no outcome can meet is not a predicate, and
a builder who executes it will report "bar not met" without noticing the bar was impossible — which is
the right answer for the wrong reason. Fix: make the **ceiling test the primary acceptance** (it is the
one that actually decides, and it is stated in the right units already), and restate the effect test as a
**fraction of available headroom**: `(warm_stag − warm_tight) / (1 − warm_tight)`. Observed here:
0.0055 / 0.0409 = **13.4 % of the headroom that existed** — which is honest, satisfiable, and still
irrelevant next to a 0.29 %-of-spend ceiling.

**4. E3's headline acceptance is a dollar comparison, which `COST.md` §2 forbids — and the dollar answer
is closed-form arithmetic that needs no experiment at all.** *"`usd_per_agent` for the Sonnet arm ≤ 50 %
of the Opus arm's"* is exactly the "the bill went down" shape §2 rules out at CV ≈ 0.97, and
`COST-INSTRUMENT` §5.3 says so explicitly: *"a mix change's effect is arithmetic, not empirical"* —
every model's price vector is `base_input × [1, 1.25, 2, 0.1, 5]`, so substituting the model multiplies
that work's cost by a known scalar. **Spending 10 agent-pairs to measure a price ratio is the single
largest waste in this document.** Reframe E3 around the two things that are *not* arithmetic:
(a) **does token volume change?** — headline `PIE tokens per request` (`COST-INSTRUMENT` §5.3),
model-independent by construction, so any deviation from parity is a real behavioural change and the
dollar saving is then computed, not measured; and (b) **does quality change?** — G2/G3, which is what the
pairs should be spent on. The dollar figure becomes a derived line, not an acceptance.

Supporting measurement, because the plan's stated diagnostic does not do what it claims: it says *"if
`usd_per_request` does not fall by ≈2.5×, something other than the model changed"*. Measured at matched
request index, Opus vs Sonnet cost ratio is **1.41× at k=0**, 2.28× at k=10, 2.38× at k=20, 2.75× at
k=60, and **2.87× pooled** — because `usd_per_request` conflates the price ratio with the context ratio
(Sonnet agents here carried *larger* early contexts: 29,794 vs 25,365 tokens at k=0). The diagnostic
would flag a clean routing as confounded and vice versa. Keep the `model == "claude-sonnet-5"` transcript
assertion — that one is exact — and use PIE for the quantitative check.

**5. E2 names the wrong field, and the failure it produces is indistinguishable from E4's kill signal.**
§3 E2 says *"the transcript already carries `toolUseResult` on 1,828 main-thread records and the
equivalent in subagent files"*. It does not: across 40 subagent files / 12,937 records, `toolUseResult`
appears on **78** (0.6 %), against **4,807 `tool_use` blocks and 4,806 `tool_result` blocks**. The data
E2 needs is there, but it lives in the content blocks — `tool_use` carries `input.file_path` (Read) and
`input.command` (Bash), paired to a `tool_result` by `tool_use_id`. A classifier built on the named field
returns a near-zero supersession share, E2's decision rule then reads < 25 %, and **the programme's
largest lever is abandoned on a parser bug**. Name the right fields in the plan. E2's own null control
does catch this (a flat share across request index is listed as the inert signature) — but the plan must
not rely on the control to discover a field name it could simply state correctly.

**6. E4 has no named implementation surface, so its arms cannot be built and its inert signature is its
predicted outcome.** The plan says the intervention is *"a flag on the dispatch/brief path"* and never
says what the flag does. There is **no context-editing or tool-result-eviction surface in this harness**:
`grep -rl "clear_tool_uses|context_management|contextEditing|prune"` over `orchestration/` and `tools/`
returns only the two cost plans and two status files, and the orchestrator dispatches subagents through
the Task tool with no per-agent context-management parameter. So E4 as written cannot prune anything, and
its stated inert signature — *"all three arms within noise, `re_read_rate` at zero everywhere"* — is
precisely what a non-existent mechanism produces. The experiment could not tell "pruning does not help"
from "pruning never happened", which is the rule-6 failure this plan is otherwise careful about.

**The constructive fix is already inside this document.** §0.4's mechanism — confirmed above, and
confirmed as *not* workload-confounded — says the accumulator is agent lifetime. The intervention this
harness actually supports is **splitting one long piece across several short agents**, which resets the
context accumulator, has a named mechanism (the dispatch brief), a named one-step reversal (dispatch as
one agent), and a mechanistic readout (PIE tokens per accepted piece). Size it from the measured curve:
one 331-request agent costs $51.83; three ~110-request agents cost ≈ $34.7 — **~33 % before re-orientation
overhead**, where each split re-pays a ~25 k prefix and whatever it must re-read. That overhead is the
real hypothesis and `re_read_rate` is the right instrument for it. Either name the pruning surface or
restate E4 as the split experiment; do not ship an experiment whose intervention does not exist.

**7. E5's quarantine is broken as specified, and I proved it by perturbation rather than asserting it.**
`corpus/90-verdicts/shadow/` is **inside the tree `tools/scores.mjs` walks recursively** (`scores.mjs`
lines 104–113: `walk(join(ROOT,'corpus','90-verdicts'))`, every `.json` at any depth). Executed on a
scratch copy of `tools/` + `corpus/90-verdicts/`:

> One shadow verdict at `corpus/90-verdicts/shadow/absurd.json` with `piece_id: "w1-00-r9"` and
> `score.overall_0_10: 0` moves the published **"Engine & harness" series from 3.05 to 1.00** and the
> row count from 66 to 67. **The shadow lane writes the record.**

Two distinct fatal modes, and the plan's proposed check catches neither reliably:

- shadow verdict with a **mapped** piece id → silently enters the published score series (above);
- shadow verdict with an **unmapped** piece id → `tools/publish.mjs` lines 30–34 set `exitCode 1`, and
  publish runs on the pre-commit path on every bank. The quarantine would break the fleet's commit path.
- `tools/verdict-validate.mjs` (line 392–397) enumerates `corpus/90-verdicts/<wave>/*.json`, so `shadow/`
  is validated as if it were a wave.

**Fix: move the shadow lane out of `corpus/90-verdicts/` entirely** — `reports/cost/e5-shadow/` is
outside every one of those three walks. **And fix the perturbation check itself, which as specified is an
inert control:** the plan says *"write a deliberately absurd shadow verdict (score 0 or 10)"*. My first
probe did exactly that — set `score = 0` as a bare number — and `scores.mjs` skipped the file, because it
reads `v.score.overall_0_10ourselves ?? v.score_0_10` and a malformed file is silently `continue`d. The check
reported a clean quarantine that was not clean. **The probe must be a schema-valid verdict with a mapped
piece id**, or it cannot distinguish "the path is quarantined" from "my probe file did not parse".

---

## CARRIED — declared risks for the build brief, not blockers

**8. The three independent dollar totals differ by 2.6 % and that is source drift, not disagreement.**
$5,792.69 (instrument, 403 agents) / $5,887.01 (plan, 406) / $5,942.81 (this critic, 408). The tree is
appended to while it is parsed. Any published figure needs its agent count and `window.to` beside it, and
the plan's deference to the instrument as the figure of record stays correct.

**9. E1's `warm_fraction` statistic has a wide own-noise band.** The permutation null spans
[−5.78, +7.58] pp at n = 80 bursts, so even a satisfiable version of the 10 pp bar would sit barely
outside noise. The plan's instinct — *"the ceiling test dominates the significance test"* — is right and
item 3 makes it operative.

**10. E4's `re_read_rate` denominator dilutes the signal by an order of magnitude.** Measured over 103
sampled agents / 12,396 tool calls: **973 Read calls of which 13.6 % repeat a path already read**, but
**9,414 Bash calls of which 0.9 % repeat an identical command**. Denominated over *all* tool calls the
natural rate is **1.7 %** pooled (per-agent median 0.0 %, p90 4.6 %). Pruning removes file reads; report
`re_read_rate` over **Read calls**, where the floor is meaningful, and keep the all-calls figure as a
secondary. The signal *is* sensitive — the per-agent median is 0.0 %, so an induced re-read shows — but
the plan's chosen denominator hides it behind Bash.

**11. E4's 5 % tripwire is calibrated at the untouched population's p90.** The control arm's own p90 is
4.6 % on the plan's denominator. A tripwire that fires on roughly one control agent in ten is not a
tripwire. Set it against the paired control arm's realised rate, not an absolute.

**12. E3's matched pairs are a design, not a hope — but only if the matching variable is *realised*
request count, and the plan matches on *expected*.** Measured over 62,481 Opus/Opus pairs, cost-ratio
spread:

| pairing rule | median ratio | p90 | p95 | > 2× |
|---|---:|---:|---:|---:|
| any two Opus agents | 2.39 | 8.42 | 12.59 | 59 % |
| same work class (description prefix) | 1.86 | 4.76 | 6.75 | 45 % |
| **request count within ±10 %** | **1.25** | 1.72 | 1.94 | **4 %** |
| request count within ±25 % | 1.31 | 1.90 | 2.17 | 8 % |
| same class **and** ±25 % | 1.29 | 1.83 | 2.06 | 6 % |

Matching on request count collapses the spread almost entirely; matching on work class alone barely
helps. Log-ratio sd of a count-matched Opus/Opus pair is **0.397**, at which **3 pairs** detect a 50 %
cut and 10 detect 30 % — so **n = 8 is comfortable, and §5.1's fear that E3 "needs more pairs than the
fleet can afford" is unfounded**. The catch is that request count is not knowable at dispatch, and
routing may itself change it. So: report the realised request-count ratio for every pair as a validity
check, exclude pairs diverging > 25 % from the headline and report them separately.

**13. E3 need not spend 2 A/A pairs to size itself.** The A/A spread the plan says "has never been
measured" is measurable retrospectively on banked data at **n = 15,598 pairs** (row 4 above), for free.
Keep the 2 live A/A pairs — as a check that the historical spread still holds, not as the sizing
instrument, because an sd estimated from n = 2 is worthless.

**14. E5's budget estimate is a p90, not a central estimate.** Measured over 111 agents whose dispatch
description names a critic: median **$9.95**, mean **$11.96**, p90 $22.55. 12 extra critics plus 2
degenerate-criteria arms ≈ **$167 at the mean**, ~$316 at p90. The plan's "roughly $300" is a defensible
ceiling; saying so makes E5 look cheaper and better-ranked than it currently reads.

**15. E5's A′ arm and degenerate-criteria arm are the strongest control design in this document and
should be kept exactly as written.** Defining the acceptance relative to the measured A/A spread rather
than an absolute threshold is the right answer to a variance problem the rest of the programme solves
with power calculations. Item 7 is about the path, not the design.

**16. E2's Opus routing is correctly argued and its sample guard is sound.** Requiring the median of 12
agents to clear 25 % *and* 8 of 12 individually is a real guard against one outlier carrying the result.
Carried only as a note that n = 12 gives a wide interval on the median, which the report should state.

**17. Stop citing peak concurrency as reassurance.** Both plans report a peak of 16–17 (I measure 17).
Peak is the one statistic that says nothing about a *floor*; 92.1 % of live time is below 12.

**18. E1's cold-start control verified working** (Ruling A) — carried as confirmation, no action. The
plan's insistence that the builder *reproduce rather than confirm* §0 is correct and should stay in the
build brief verbatim; this critique does not discharge it.

---

## Attribution check against `COST.md` §2 (CV ≈ 0.97 — no acceptance may be "the bill went down")

| | acceptance rests on | verdict |
|---|---|---|
| **E1** | a proportion over bursts + a ceiling share of a token class | **passes** — mechanistic |
| **E2** | share of context tokens by classification | **passes** — mechanistic, no dollars |
| **E3** | `usd_per_agent` ratio over 8 pairs | **FAILS — BLOCKING (item 4)** |
| **E4** | `usd_per_accepted_piece` ≤ 70 %, with `re_read_rate` as primary *signal* but not as *acceptance* | **fails as written** — fold into item 6's restatement: make PIE per accepted piece the acceptance and `re_read_rate` the guard |
| **E5** | find-rate relative to the A/A spread | **passes** — `usd_per_finding` is correctly secondary |

## What I could not do (rule 26)

- **I did not verify the plan's `superseded_share` hypothesis**, only that the data supports building the
  classifier (item 5). Whether a second `Read` of a path is supersession or diligence is the plan's own
  §5.2 worry and it remains open; E2's early-turn control tests sensitivity, not validity, and I have no
  better proposal than the plan's.
- **I did not run `tools/scores.mjs` against the live tree with a shadow file present** — the perturbation
  was run on a scratch copy under the scratchpad, because `tools/bank.mjs` stages the whole tree every few
  minutes (rule 17) and a probe verdict in the real `corpus/90-verdicts/` would have been committed. The
  finding is unaffected: the walk is the same code and the numbers above are from executing it.
- **No browser** (`tools/contention.mjs` reported the box at its ceiling; nothing here needed one).

## Verdict

**BLOCKED pending items 1, 2, 3, 4, 5, 6, 7.** Items 3, 5 and 7 are one-line corrections. Items 1 and 2
are corrections to text that has already reached `COST.md` and must be made there too. Items 4 and 6 are
genuine reframings and are where the second exchange should go. **E1 and E2 are otherwise ready and
should still ship first and alone**, exactly as §5 concedes — E1 with its ceiling promoted to primary,
E2 with the right field names.

**Recommended models — unchanged from the plan, and its reasoning is right.** E1 Sonnet (fully decidable
predicate), E2 Opus (the supersession judgement decides whether E4 happens), E3 split, E4 Opus, E5 Opus
throughout. The one addition: whoever fixes items 1 and 2 is editing doctrine and should be Opus.
