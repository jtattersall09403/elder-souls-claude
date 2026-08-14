# The first real cost experiments — four questions, four answers

**Piece:** `COST-EXPERIMENTS-BUILD`. **Date:** 2026-08-14. **Branch:** `codex/wave1-build-experiment`.
**Every number below was measured at commit `5cee352`** (rule 12) by `node tools/cost.mjs --experiments`,
over **50,286 deduplicated priced requests / 420 agents**. Raw output: `reports/cost/experiments.json`.
Ledger entries: `reports/cost/changes.json` → `docs/data/cost-ledger.json` → `docs/progress.html`.

**Nothing here changed any orchestration behaviour or any game code.** All four are retrospective reads
of banked transcripts, which is why they could run alongside the live visual programme.

**Not a second cost implementation (rule 10).** Every figure comes from `tools/cost.mjs` — its parser,
its dedup by `message.id` element-wise max, its five-class price table. The experiments are flags on it
(`--routing --growth --bursts --attribution`), sharing one extracted `collectPricedRequests()`.

**The attribution rule (`COST.md` §2) bound every one of them.** Cost per run has CV ≈ 0.97, so no
conclusion here rests on comparing dollar totals between two windows. Each number is a share, a
counterfactual repricing of one fixed recorded token flow, or a recomputation over a recorded curve.

---

## Before the answers: two corrections to the brief I was given

1. **`COST-EXPERIMENTS.md` has been criticised.** The brief said "plan never criticised — treat it as a
   draft". The file carries a full plan-critic section (7 BLOCKING items, independently re-derived at
   commit `b376ac4`). I treated its rulings as constraints, not authority, and reproduced its numbers
   rather than citing them. Where we agree I say so; the agreement is evidence, since we used different
   file-sets and different code.
2. **"The efficiency programme has so far delivered nothing measurable" is not quite right.** It has
   delivered **$244.41**, mechanistically attributable (Q1). That is 3.8% — real, small, and invisible
   in C/H because C/H is 100% of baseline for reasons Q2 explains.

---

## Q1 — Did the model routing actually save anything? **Yes: $244.41, and it is not confounded.**

**The confound is fatal if ignored and I did not try to control it away.** Sonnet was given the easier
tasks by design (`COST.md` §4.1 routes on decidability). So the headline is *not* a comparison between
agents. It is a **counterfactual repricing of the exact token flow that was actually recorded on
Sonnet**: hold the work fixed, change only the price vector. No Opus agent enters the sum, so task
difficulty cannot enter it either.

| | value |
|---|---:|
| requests that ran on Sonnet | 3,660 |
| what they cost | **$162.94** |
| the same recorded flow at Opus prices | **$407.34** |
| **saving** | **$244.41** |
| as a share of the bill it would otherwise have been | **3.77%** |
| Sonnet's share of spend as it stands | 2.61% |

**Did the cheaper model buy back its saving in volume?** No. On **38 request-count-matched pairs**
(±25%), the median ratio of **PIE tokens per request** — a model-*independent* volume measure, valid
because every model's price vector is `base_input × [1, 1.25, 2, 0.1, 5]` — is **1.019**. Sonnet agents
consumed essentially identical volume per request. The whole saving is the price ratio; the median
matched USD ratio is **0.407**, which is the price ratio (0.4) almost exactly.

**The naive comparison, shown so nobody reports it.** Sonnet agents averaged **$4.29** against Opus
**$14.42** — an apparent 70% saving. It is worthless: Sonnet's median agent made 82 requests against
Opus's 104.5. That number measures task size.

**Null control — the plausible wrong answer, not the trivial one.** The trivial control (reprice zero
tokens, get zero) proves nothing. The plausible wrong answer is reading $244.41 as evidence the *fleet*
got more efficient. Repricing **33 request-count-matched Opus agents** as if they had been Sonnet
"saves" **$335.03** — *more* than the real figure, on work nobody routed. So the headline measures
**volume routed**, not efficiency, and it must never be read as programme progress.

**When it happened.** Sonnet share of daily token volume: 0% (5 Aug), 0% (6 Aug), 8.0% (7 Aug), 7.3%
(8 Aug), **27.5%** (14 Aug). The routing decision is visible in the data and is still ramping.

**What this cannot tell you.** Whether the Sonnet arms produced *worse work*. G2 is not measured here —
no verdict re-grade, no find-rate comparison per arm. A 3.8% saving that costs one extra remediation
round is a net loss, and this piece did not test for that.

---

## Q2 — Is cost quadratic in tool calls? **No — exponent 1.27. But the mechanism is accumulation, and it is 71% of the bill.**

This was the most valuable question and it has the sharpest answer.

**It is not quadratic.** `log(usd)` on `log(requests)` over 419 agents: **exponent 1.268, R² 0.876**.
Quadratic is 2.0. `COST.md` §4.0's bin table survives — measured **$4.79 → $48.43** per agent against
its recorded $4.55 → $51.83 — but its multiplier does not: bin *means* are **55.3 → 329.1** requests, so
**6.0× buys 10.1×**, not "3.5× buys 11×". §4.0 has been corrected in place.

| requests | agents | mean $/agent | $/request | mean context/request |
|---|---:|---:|---:|---:|
| 0–99 | 197 | $4.79 | $0.0866 | 136,864 |
| 100–199 | 169 | $16.52 | $0.1178 | 196,657 |
| 200–299 | 43 | $33.77 | $0.1402 | 249,245 |
| 300+ | 10 | $48.43 | $0.1472 | 282,103 |

**The confound the brief named — accumulation or workload? — falls decisively to accumulation, and it
falls *harder* than the doctrine claimed.** Three independent tests:

**(a) Matched request index.** If long agents were doing heavier work, their *early* requests would
already be heavier. Mean context tokens at index *k*, split by the agent's *eventual* bin:

| k | 0–99 | 100–199 | 200–299 | 300+ |
|---:|---:|---:|---:|---:|
| 0 | 25,727 | 25,892 | 25,982 | 26,135 |
| 10 | 85,450 | 79,176 | 75,147 | 70,468 |
| 40 | 158,095 | 145,792 | 140,628 | 139,413 |
| 80 | 240,931 | 215,097 | 206,076 | **192,972** |

They agree at k=0 and long agents are thereafter **lighter**, not heavier — the opposite of what the
workload hypothesis predicts.

**(b) The work proxy.** "More work" predicts more *new* content per request. Context growth per request
at matched index is flat across bins (≈3.3k at k=10; 1.1–2.1k at k=80) and output tokens show no trend.

**(c) Pooled-curve prediction.** Predicting each bin's mean context from the *pooled* context-vs-index
curve and that bin's own index distribution reproduces the actual within **0.96–1.06**. Accumulation
explains the entire per-request cost rise across bins. Nothing is left for workload.

**Why this matters more than the exponent:** the self-test builds a synthetic fleet that is *purely*
workload-driven, and it returns an exponent of **1.79**. Both hypotheses predict superlinearity. Anyone
citing the exponent as proof of the mechanism is citing a statistic that cannot distinguish them.

**Now the size, which nobody had.** Decomposing every re-read context token into the unavoidable floor
(the agent's own first-request context, re-read *n* times) and the accumulation on top:

| | tokens | USD |
|---|---:|---:|
| floor — first-request context × n | 1,250,566,958 | $592.34 |
| **accumulation** | **8,413,685,214** | **$4,032.52** |
| accumulation as a share | **87.1% of context** | **71.1% of subagent spend** |

**The harness recovers none of it.** **0 compaction events across 419 agents**; only 2 agents show any
context decline at all. So this is not money already being clawed back by something else.

**The split counterfactual — a recomputation over the recorded curve, not a guess.** If an agent of *n*
requests had been *s*-request agents, chunk *j* restarts at its own `c₀` and follows the same recorded
deltas, so the context saved per request is exactly `c[js] − c₀`:

| chunk size | context never re-read |
|---|---:|
| 50 | $2,799.60 |
| **100** | **$1,728.02 (27.7% of the bill)** |
| 150 | $956.30 |

**This is an upper bound and I am labelling it as one.** It models no re-orientation, no re-reading and
no handoff between the split agents. That overhead is the real hypothesis and **this piece did not
measure it** — `re_read_rate` over `Read` calls is the right instrument for it and it has not been built.
Nothing here authorises shortening an agent's *work*, only its *waste*.

---

## Q3 — Confirm or overturn the C1 revert? **Confirmed. Reproduced independently; the ceiling is 0.291% of spend.**

Reproduced from the instrument's parser against the predicate stated in closed form in
`COST-EXPERIMENTS` §3 E1, without reading the prototype's code.

| | this run | plan critic (`b376ac4`) | plan prototype |
|---|---:|---:|---:|
| multi-agent bursts | 83 | 80 | 79 |
| tight `warm_fraction` | 0.9604 (n=32) | 0.9591 (n=31) | 0.958 (n=30) |
| staggered `warm_fraction` | 0.9621 (n=51) | 0.9646 (n=49) | 0.965 (n=49) |
| difference | **+0.17 pp** | +0.56 pp | +0.7 pp |
| agents warm on first request | **393/420 (93.6%)** | 381/406 (93.8%) | 378/403 (93.8%) |
| first-request cache-write share of spend | **0.291%** | 0.292% | 0.32% |

**The ceiling is the acceptance and it decides.** First-request cache writes total **$18.13** of a
**$6,231** bill. C1's own bar was 2% of spend. No dispatch policy can recover money that was never spent.

**The effect is noise.** A 4,000-draw label-shuffle permutation null spans **[−5.71, +7.41] pp** and
gives **p = 0.973**. That control is deliberately the *plausible* wrong answer: it tests whether
`warm_fraction` is really tracking burst *size* (tight bursts here are larger — mean 5.34 vs 3.06). It is
not tracking anything.

**The cold-start control fires exactly where it must.** The session's first-ever agent —
`ad66e5f929e554104`, *"Corpus: Souls combat frame data"* — shows `cache_read = 0` and
`cache_write = 22,925` on its first priced request. The same agent the plan critic found. The instrument
can report "cold", so a fleet reading 93.6% warm is a finding and not a field-name bug. The synthetic
warm arm in `--experiments-self-test` confirms the control *refuses* to fire when it should not.

**One defect in C1 worth recording.** Its stated acceptance — "staggered exceeds tight by ≥ 10 pp" — is
arithmetically unsatisfiable from a 0.96 base: no data can reach 1.06. Restated as headroom closed,
`(warm_stag − warm_tight) / (1 − warm_tight)` = **4.4%**.

**C1 stays reverted — but "inert under these conditions", not "the mechanism is fake".** A session with
a much larger shared prefix, or a genuinely cold start with no cache holding the prefix, could still
make it matter.

---

## Q4 — Where is the money actually going?

**$6,231.11** at this reading. (The tree is appended to while it is parsed; three readings today span
$6,175.91 → $6,249.75. Any published figure needs its request count and window beside it.)

### By role — attributed from the harness's own `subagents/*.meta.json` dispatch descriptions

| role | agents | requests | USD | % of spend | mean $/agent |
|---|---:|---:|---:|---:|---:|
| builder | 188 | 26,398 | $3,266.11 | **52.6%** | $17.37 |
| critic | 106 | 11,244 | $1,335.74 | **21.5%** | $12.60 |
| *unclassified* | 43 | 5,338 | $575.40 | 9.3% | $13.38 |
| orchestrator | 1 | 2,032 | $559.15 | 9.0% | $559.15 |
| *unattributed* (no sidecar) | 9 | 1,045 | $151.41 | 2.4% | $16.82 |
| corpus | 30 | 1,521 | $150.28 | 2.4% | $5.01 |
| blog | 23 | 1,597 | $90.13 | 1.5% | $3.92 |
| judge | 13 | 664 | $53.26 | 0.9% | $4.10 |
| plan | 7 | 249 | $29.52 | 0.5% | $4.22 |
| research | 1 | 28 | $0.73 | 0.01% | $0.73 |

**Null control — the plausible wrong answer, not the trivial one.** A catch-all classifier that labels
every subagent "builder" reports **91% coverage and distinguishes nothing** — the exact shape of an
instrument that reported 71% coverage of a world containing none of the thing it measured. The explicit
classifier instead **publishes its 11.7% residual** rather than absorbing it into a default bucket.

**Validity check on the labels, independent of the words they came from.** A critic for item X must
start *after* that item's first builder — the project's own gauntlet order, which appears nowhere in the
description text the label was derived from. Of 45 testable pairs, **41 (91.1%)** are correctly ordered.
Noise labels would land near 50%.

### By token class

| class | USD | tokens | % of spend |
|---|---:|---:|---:|
| cache_read | $4,960.84 | 10.33 B | **79.9%** |
| cache_write_5m | $953.55 | 157.3 M | 15.4% |
| output | $213.41 | 8.89 M | 3.4% |
| cache_write_1h | $78.36 | 7.84 M | 1.3% |
| input (uncached) | $5.56 | 1.29 M | 0.1% |

### What the programme could move without touching §5

**Out of bounds by §5, and therefore not levers:** the **$1,335.74** on critics (21.5%), the
**$53.26** on judges, and the **$29.52** on plans. Cutting a critic is cheaper and worthless; a saving
whose source is doing less verification is forbidden. Note how cheap the plan loop already is — **0.5%
of spend** to manufacture the conditions that make a build Sonnet-eligible.

**In bounds:**

1. **Agent lifetime — $4,032.52 of accumulated context (71.1% of subagent spend), ceiling $1,728.02 at
   100-request chunks.** By far the largest, and it touches no verification step: splitting a piece
   across two agents runs the same checks in two shorter turns. The unmeasured term is re-orientation.
2. **The remaining Opus→Sonnet headroom.** At 27.5% of daily volume today, the ceiling on the rest is
   the price ratio applied to whatever else has a machine-checkable acceptance — and it shrinks on
   2026-08-31 when Sonnet's introductory rate expires (2.5× → 1.67×).
3. **The orchestrator, $559.15 in one thread** — the single most expensive agent in the fleet, 9.0% of
   spend, and explicitly in scope (`COST.md` §4.6). Untouched by all four experiments.
4. **Output is 3.4% of spend.** Writing shorter remains close to worthless.

---

## What I could not do (rule 26)

- **No quality arm anywhere.** G2 and G3 are untouched by all four experiments. Q1 says routing saved
  $244.41 and says **nothing** about whether the Sonnet arms drew more critic findings or triggered
  extra remediation rounds. A cheaper build that needs one more round is a net loss, and that test is
  not in this piece.
- **The split ceiling's overhead term is not measured.** `re_read_rate` over `Read` calls — the plan
  critic's corrected denominator — is the right instrument and it does not exist. $1,728.02 is an upper
  bound with an unmeasured deduction.
- **I did not run E2 (context composition / `superseded_share`).** It needs a supersession classifier
  over `tool_use` content blocks (the plan names `toolUseResult`, which appears on 0.6% of records —
  the plan critic's BLOCKING 5). Q2's accumulation decomposition sizes the *same* lever from a
  different direction and does not require that judgement call, so I did the one I could defend.
- **Three dollar totals in one day span $6,175.91 → $6,249.75 (1.2%).** Source drift, not disagreement —
  the transcript tree is appended to while it is parsed. Ratios and shares are unaffected.
- **G1 is reported by the ledger as 13.33 requesting / 13.44 present, status ok.** The plan critic's
  Ruling C argues both are biased estimators and the honest reading (time-integral of live agents) is
  ~5.4, a standing breach. **I did not re-derive that** and I am not endorsing either number here; it is
  a live disagreement between `COST.md` Ruling C2 and the plan critic, and it belongs to whoever owns
  the instrument's G1 block.
- **No browser.** Nothing here needed one.
