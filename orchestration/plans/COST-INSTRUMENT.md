# Plan — `COST-INSTRUMENT`: the measurement, the baseline, and the experiment protocol

**Piece:** `COST-INSTRUMENT` · **Plan agent:** `COST-INSTRUMENT-plan` · **Status:** **BLOCKED pending items 1–6** (plan critic `COST-INSTRUMENT-plancritic`, exchange 1 of 2 — see §11)
**Reads:** `orchestration/COST.md` (binding), `CLAUDE.md`, `orchestration/PLAN-LOOP.md`, `orchestration/RULES.md`
**Deliverable of the build:** `tools/cost.mjs` + `tools/fixtures/cost-null/` + `docs/data/cost-ledger.json`

Everything numeric below was derived by this plan agent from
`/root/.claude/projects/-home-user-elder-souls-claude/**/*.jsonl` on **2026-08-08**, at
**403 files / 638 MB**. Scripts are in the scratchpad, suffixed `-COST-INSTRUMENT-plan`. Where this
document contradicts the orchestrator's dispatch brief or `COST.md`, the contradiction is called out
and the file is corrected rather than worked around.

## Builder/critic execution allocation (binding)

This plan uses the shared [builder execution contract](BUILDER-EXECUTION-CONTRACT.md). Its existing
`BLOCKED pending items 1–6` state remains binding. Once those plan-authority blockers are resolved,
the following allocation governs a single builder run; the native predicates below remain the final
critic acceptance bar.

**Builder-owned after unblock:** implement `tools/cost.mjs`, request/message deduplication, all five
priced token classes, effective-dated price selection, frozen comparison windows, attribution and the
ledger output required by this plan. Build the null/malformed fixture set, run exhaustive cheap parser,
deduplication, pricing, window and schema self-tests, and produce one bounded real-data snapshot when
the canonical source is available. Run targeted red and delete-the-fix controls for each distinct
measurement mechanism.

**Critic-owned:** independent recomputation from raw records; adversarial duplication, malformed-data,
boundary-window and price-table challenges beyond the bounded builder fixtures; independent ledger
comparison; final measurement judgement; and verdict.

**Completion rule:** before unblock, report the exact plan-authority dependency. After unblock, finish
all builder-owned implementation and bounded proof in one run. Absence of the historical external
transcript source is recorded as an exact data dependency and does not excuse independent fixture work.

---

## 0. Four corrections to what everyone currently believes

These are the findings that change the shape of the piece. Each is reproducible in one command.

### 0.1 The data is 638 MB in 403 files, not 31 MB in one

The brief and `COST.md` §2 both say the source is
`/root/.claude/projects/-home-user-elder-souls-claude/*.jsonl`. That glob matches **one** file
(31 MB — the orchestrator's own session). The subagent transcripts live one level down in
`<session-id>/subagents/*.jsonl`: **386 files, 534 MB**, plus a `subagents/workflows/wf_*/`
directory holding **10 more**.

An instrument built to the brief's glob would report the orchestrator's spend and nothing else —
and the orchestrator is **9.3 %** of the money. It would have understated cost by ~10.7×, and it
would have looked entirely plausible while doing it.

The main transcript contains **zero** `isSidechain: true` records. Subagent records carry
`isSidechain: true`, `agentId`, `attributionAgent` (the agent type, e.g. `general-purpose`) and
`slug`. `agentId` appears **only** in the subagent files.

### 0.2 One API response is written as several records with one identical `usage` block

An assistant turn containing text + two `tool_use` blocks is stored as **three** JSONL records
sharing one `message.id`, one `requestId`, and **three byte-identical copies of `usage`**. In the
main transcript alone there are 770 such groups; across the tree, **84,490 usage-bearing records
collapse to 46,575 distinct requests**.

Summing records instead of requests inflates the answer by **1.81× overall** — and unevenly by
class (2.06× on cache-writes, 1.61× on cache-reads, **2.58× on output**). Verified: in all 770
main-transcript groups the `usage` blocks are identical and the `message.id` is shared, so
**dedup on `message.id`, keep one, never sum**.

A second, independent duplication: `subagents/workflows/wf_d3ec8655-368/` mirrors **1,045**
message-ids that already exist in `subagents/`. Same defect, different route.

### 0.3 There are **five** priced token classes, not four — and the split is in the data

`COST.md` §1 says four ("input, cache write, cache read, output"). The `usage` block carries
`cache_creation.ephemeral_5m_input_tokens` and `cache_creation.ephemeral_1h_input_tokens`
separately, and **they are priced differently**: a 5-minute cache write is 1.25× base input, a
1-hour write is **2×**. Both appear here: 149.4 M tokens at 5 m and **7.5 M at 1 h** — and the 1-hour
writes are almost entirely the orchestrator's own session, which uses the 1 h TTL while subagents
use 5 m. Collapsing them is the same mistake `COST.md` warns about, one level further down.

Prices (USD per million tokens, from the `claude-api` skill's model table, not from memory):

| model | input | cache write 5 m | cache write 1 h | cache read | output |
|---|---:|---:|---:|---:|---:|
| `claude-opus-5` | 5.00 | 6.25 | 10.00 | 0.50 | 25.00 |
| `claude-sonnet-5` **(intro, to 2026-08-31)** | 2.00 | 2.50 | 4.00 | 0.20 | 10.00 |
| `claude-sonnet-5` (list, from 2026-09-01) | 3.00 | 3.75 | 6.00 | 0.30 | 15.00 |
| `claude-haiku-4-5` | 1.00 | 1.25 | 2.00 | 0.10 | 5.00 |

**Sonnet 5 is inside an introductory price window that expires 2026-08-31 — 23 days from now.**
On 1 September, Sonnet's price rises 50 % with no change to anything the fleet does. Any C/H series
that crosses that date will show a cost *rise* attributable to nothing. **The instrument must price
every reading from a table pinned by `effective` date and publish the table it used** (the contract
already has a `prices` block; §6 below fixes its shape). A baseline priced at intro rates and a
later reading priced at list rates are not comparable, and the ledger must say which it used.

**A structural fact worth exploiting:** every model's price vector is the same shape —
`base_input × [1, 1.25, 2, 0.1, 5]`. Output is exactly 5× input for Opus, Sonnet *and* Haiku.
So cost separates cleanly (§3.3), and the instrument should **assert** that shape and fail loudly
if a future model breaks it.

### 0.4 The source is being appended to while you read it

Two full parses eleven minutes apart returned 46,575 and 46,643 requests. The fleet is writing.
Consequences the build must honour: a "total to date" is only meaningful with its `window.to`
stamp, and **a baseline must be a frozen `[from, to]` window, not "everything so far"** — otherwise
the baseline moves every time it is measured and no later reading can be compared to it.

---

## 1. The acceptance number, its predicate and its units

### 1.1 C — the numerator

> **C(window, prices) = Σ over distinct requests r in the window, of**
> `Σ_class tokens[r][class] × price[model(r)][class][effective_date]`
> **in US dollars**, over the five classes of §0.3.

A **request** is one distinct `message.id` among records where `type == "assistant"` and
`message.usage` exists and `message.model != "<synthetic>"`. Fields consumed, exhaustively — the
build depends on these and nothing else:

| field | use |
|---|---|
| `type` | select `"assistant"` |
| `message.id` | **dedup key.** One request = one id. |
| `message.model` | price-table key; `"<synthetic>"` ⇒ **exclude** (40 such records, all with null usage) |
| `message.usage.input_tokens` | class `input` |
| `message.usage.cache_creation.ephemeral_5m_input_tokens` | class `cache_write_5m` |
| `message.usage.cache_creation.ephemeral_1h_input_tokens` | class `cache_write_1h` |
| `message.usage.cache_read_input_tokens` | class `cache_read` |
| `message.usage.output_tokens` | class `output` |
| `timestamp` | window filter; hour bucketing |
| `agentId` | agent identity; absent ⇒ the orchestrator (`__main__`) |
| `attributionAgent` | agent class, for attribution (§5) |

Verified on the real data: `ephemeral_5m + ephemeral_1h == cache_creation_input_tokens` in
**every** record (0 exceptions). `usage.iterations`, where present, sums to the top-level figures
(0 mismatches) and **must be ignored** — reading both double-counts. `server_tool_use` web-search
counts exist and are **not** priced here; declared as out of scope in §8.

### 1.2 H — the denominator, and what the number means when the fleet is idle

Three candidate definitions, all computable, all giving different answers on the same data:

| H | value | baseline C/H | idle behaviour |
|---|---:|---:|---|
| (a) span: `last − first` request time | 61.94 h | **$93.52/h** | idle hours dilute ⇒ **switching the fleet off improves the metric** |
| (b) **active clock-hours**: count of wall-clock hours containing ≥1 request | 52 h | **$111.40/h** | idle hours excluded ⇒ idling is neutral |
| (c) union of per-agent busy intervals | — | — | finest, but needs an arbitrary "still alive?" rule |

**Ruling — H is (b), active clock-hours, and this is reversible.** Reason: (a) is fatally gameable
in the one direction the owner explicitly forbade — a fleet that runs three agents and sleeps beats
one that runs fifteen. (c) requires inventing an end-of-run rule that the transcript does not carry.
(b) needs no assumption beyond the timestamps that already produce the numerator, so numerator and
denominator can never disagree about what an hour is.

**What the number means when the fleet is idle: nothing at all, and the instrument must say so
rather than print a figure.** Under (b) an idle hour is not in the denominator, so C/H is undefined
over a fully idle window and the ledger must emit `null` (which the page renders "—"), not 0.

**(b) is still gameable, and pretending otherwise would be the exact failure this project keeps
finding.** An hour containing one cheap request counts as a full hour and drags C/H down. Two
things close that, and **the instrument must refuse to publish C/H without both beside it**:

1. **cost per agent-hour** = C / (agent-active-hours), where an agent-active-hour is a distinct
   `(hour, agentId)` pair. Baseline **$8.51**. This is `COST.md` §1's mandated diagnostic: if C/H
   falls 4× and this does not, the fleet shrank and the programme failed.
2. **G1** (§4.1). A near-empty hour shows up immediately as mean-agents below floor.

### 1.3 The baseline, and how a window is chosen so two measurements compare

**Baseline window: `2026-08-05T22:16:46Z` → `2026-08-08T12:11:52Z`**, the full transcript to date —
frozen by writing `from`/`to`/`commit` into `baseline` in the ledger and never recomputing it.

| | Sonnet at intro price | Sonnet at list price |
|---|---:|---:|
| **C (total spend)** | **$5,792.69** | $5,847.02 |
| `claude-opus-5` | $5,684.01 (98.1 %) | $5,684.01 (97.2 %) |
| `claude-sonnet-5` | $108.68 (1.9 %) | $163.01 (2.8 %) |
| orchestrator (main session) | $540.02 (9.3 %) | — |
| subagents | $5,252.66 (90.7 %) | — |
| **C/H** (H = active hours, 52) | **$111.40/h** | $112.44/h |
| **cost per agent-hour** (681 agent-hours) | **$8.51** | $8.59 |
| **mean concurrent agents** | **13.10** | — |

**Target: C/H ≤ $27.85/h and cost-per-agent-hour ≤ $2.13**, both at intro prices, with G1–G3 held.

**Comparability rule.** Two readings are comparable only if all four match: same H definition, same
price table `effective` date, same file-set discovery rule, and window length ≥ 4 active hours
(§5.3). The ledger stamps all four; the build must emit `comparable_key` as a hash of them so a
reader — or a later agent — can tell at a glance whether two dots on the chart mean the same thing.

---

## 2. Where the money actually is — and what it does to the lever ranking

`COST.md` §4 ranks the levers as hypotheses. The baseline settles two of them and demotes a third.

**Cost by token class** (Sonnet at intro):

| class | tokens | USD | share |
|---|---:|---:|---:|
| `input` | 1,161,679 | $5.00 | 0.1 % |
| `cache_write_5m` | 149,421,270 | $910.89 | 15.7 % |
| `cache_write_1h` | 7,506,770 | $75.07 | 1.3 % |
| **`cache_read`** | **9,687,969,280** | **$4,706.03** | **81.2 %** |
| `output` | 3,878,309 | $95.69 | 1.7 % |

**Cache reads are 81 % of all spend.** Cache-hit ratio is already **98.39 %** of input tokens.

Three consequences, each of which overturns something currently written down:

- **`COST.md` §4 lever 2 ("cache economics") is nearly dead, exactly as it suspected it might be.**
  It says *"measure the ratio first; it may already be high."* It is 98.39 %. Driving it to 100 %
  would save under 1.6 % of input-token cost. **The remaining lever inside cache economics is not
  the hit ratio — it is the volume of cached tokens re-read**, and secondarily the orchestrator's
  1 h TTL (2× write vs 1.25×), worth at most $75 in total.
- **Output verbosity is worth almost nothing.** Median output per request is **5 tokens**; mean 83;
  p90 100. Output is 1.7 % of spend. Any efficiency change justified by "terser agents" is
  optimising 1.7 % of the bill, and the instrument will show that within one window.
- **The cost is context volume.** Median context per request is **190,096 tokens** (mean 211,164;
  p90 364,111; max 782,126), and the median agent makes **103 requests**, each re-reading its whole
  prefix. That is the mechanism, and it is what the levers must attack.

### 2.1 The arithmetic ceiling on model mix, stated before anyone spends a round on it

Because every model's price vector is `base_input × [1, 1.25, 2, 0.1, 5]` (§0.3), substituting a
model multiplies that work's cost by a scalar: Sonnet **0.40×** (intro) / **0.60×** (list),
Haiku **0.20×**.

**Moving 100 % of the fleet to Sonnet reaches 0.60× of baseline at list price — not 0.25×.**
Even at intro pricing it reaches 0.40×, and intro expires in 23 days. `COST.md` calls model mix
"the largest single lever"; on these numbers it is a large lever that **cannot reach the bar alone**,
and it is bounded above by 0.60× for any Sonnet-only fleet after 1 September. With critics staying
Opus (`COST.md` §5, non-negotiable) the realistic mix factor is nearer 0.7×.

So the bar decomposes: to reach 0.25× with a mix factor of 0.7×, **token volume per active hour must
fall by 2.8×**. That is the real target, it lands on cache-read volume, and the external literature
in §7 is about exactly that. Stating it now stops the programme spending its first three rounds
discovering that Sonnet alone was never going to be enough.

---

## 3. The null control — the arm that must come out worse, and what it looks like if it is inert

This is the section the piece lives or dies on. A cost instrument reports a plausible number
under every defect it has; **no reading of the real transcript can tell you whether it is right.**

The control is `node tools/cost.mjs --self-test`, which prices a set of hand-built fixtures under
`tools/fixtures/cost-null/` whose correct answers are integers a person can verify with a
calculator, and which **exits non-zero on any mismatch**. It runs in `tools/run-all.mjs`.

### 3.1 The positive fixture: arithmetic anyone can check by hand

`fixtures/cost-null/01-arithmetic.jsonl` — two requests, round numbers chosen so every term is
visible:

| record | model | input | cw 5 m | cw 1 h | cache read | output |
|---|---|---:|---:|---:|---:|---:|
| A | `claude-opus-5` | 1,000,000 | 1,000,000 | 1,000,000 | 1,000,000 | 1,000,000 |
| B | `claude-sonnet-5` (list) | 1,000,000 | 1,000,000 | 1,000,000 | 1,000,000 | 1,000,000 |

A = 5.00 + 6.25 + 10.00 + 0.50 + 25.00 = **$46.75**
B = 3.00 + 3.75 + 6.00 + 0.30 + 15.00 = **$28.05**
**Expected total: $74.80.** Written in the fixture's own `_expected_usd` field and in this plan, so
the two must agree or someone has changed one and not the other.

### 3.2 Five arms that must come out **red** — each derived from a defect present in the real data

Each is a fixture plus an assertion. For each, the plan states the wrong answer a defective
instrument gives, so the critic can check that the arm can actually fail.

| # | arm | fixture | correct | a defective instrument says | the real defect it guards |
|---|---|---|---:|---:|---|
| **N1** | **split records** — record A written as 3 records sharing one `message.id`, each carrying the same `usage` | `02-split-records.jsonl` | **$74.80** | **$168.30** (sums records) | §0.2 — 1.81× overall, 2.58× on output |
| **N2** | **collapsed cache classes** — a cache-heavy request at real proportions: 10,000,000 cache-read, 0 elsewhere, Opus | `03-cache-heavy.jsonl` | **$5.00** | **$50.00** (prices cache-read as input) | §0.3 — 81 % of spend is this class |
| **N3** | **collapsed write TTLs** — 1,000,000 at 5 m + 1,000,000 at 1 h, Opus | `04-write-ttl.jsonl` | **$16.25** | $12.50 (all 5 m) or $20.00 (all 1 h) | §0.3 — both TTLs occur here |
| **N4** | **cross-file duplicate** — one `message.id` present in two files in the tree | `05-dup/` (two files) | **$46.75** | $93.50 (counts twice) | §0.2 — 1,045 real cases |
| **N5** | **missing source** — a tree of 4 files where one is unreadable | `06-coverage/` | **exit ≠ 0, no ledger written** | a confident, complete-looking figure ~25 % low | §0.1 — the glob-based instrument would have looked fine |

**N5 is the arm this project would otherwise have skipped, and it is the most important one.**
N1–N4 all test *pricing*. An instrument that prices perfectly but discovers half the files passes
every one of them and reports a beautiful, wrong number — which is precisely the shape of the
defect in §0.1 that the dispatch brief itself carries. So `--self-test` asserts
`coverage.files_read == coverage.files_total`, and N5 hides a file and requires the tool to go red.

**The idle arm (N6), which tests the denominator rather than the numerator.**
`07-idle.jsonl`: two requests, one at `T+0h`, one at `T+40h`, nothing between. The instrument must
report `window.hours = 40.0`, **`denominator.active_hours = 2`**, and C/H computed on 2 — not 40.
An instrument using span reports a C/H twenty times lower. This is the anti-gaming check, and it is
the one that decides whether the metric can be cheated by idling.

### 3.3 What it looks like if the control is inert — and the check that proves it is not

Rule 6 distinguishes an inert *fix* from an inert *control*, and this project has shipped both.
An inert control here looks like: `--self-test` prints `6/6 PASS` on a correct implementation and
**also** on a broken one, because the fixtures are too small to exercise the defect, or because the
assertions compare the instrument to itself rather than to a written constant.

**The build must execute, and paste into its report, this sequence — not assert that it would
pass it:**

1. On a scratch copy of `tools/cost.mjs`, **delete the dedup** (`seen.has(message.id)` guard).
   Re-run `--self-test`. **N1 and N4 must go red**, with the exact wrong figures in the table above.
2. On a second copy, **replace the five-class price lookup with a single input price**. **N2 and
   N3 must go red.**
3. On a third copy, **change H to span**. **N6 must go red.**
4. On a fourth copy, **make file discovery use the brief's `*.jsonl` glob**. **N5 must go red.**
5. Run `--self-test` on the unmodified tool. **All six must pass.**

Five deliberate breaks, five reds, one green. If any break fails to produce a red, that arm is
inert and the build has not finished. **A `--self-test` that has never been seen to fail is not
evidence; it is a second copy of the implementation.**

**And one check that no fixture can provide:** on the real tree, `--full` (ignore cache) and the
default incremental read (§6.2) must agree **to the cent**. A disagreement means the cache is
lying, which is a defect the fixtures cannot see because they are too small to be cached.

---

## 4. How G0–G3 are actually measured — including the one that cannot be

### 4.1 G1 — parallelism. Measurable, but two honest readings disagree, and I must own that.

**Definition: mean over active clock-hours of the count of distinct `agentId`s issuing ≥1 request
in that hour.** Baseline **13.10**, floor 12 ⇒ **ok**.

**The disagreement, stated plainly because it is the critic's best line of attack on me.**
A second, equally defensible reading — an agent is "present" for every hour between its first and
last request — gives median **11** concurrent agents, with **35 of 63 hours below the floor of 12**.
Under that reading the *baseline itself breaches G1*.

I have chosen the reading that passes. My reason is that it shares an event stream with the
numerator, so an "hour" means one thing throughout the ledger, and it counts agents that are
*working* rather than merely alive. But I chose it **after** seeing which one passes, and a critic
should hold me to that. Mitigation, which I would accept as a BLOCKING fix: **publish both**.
`g1_parallelism.mean_agents` (requesting) and `g1_parallelism.mean_agents_present` (span-based),
with the floor applied to the first and the second shown beside it. If they ever diverge by more
than 20 % the ledger flags it, because that divergence means agents are alive and idle — which is
itself a cost finding (agents blocked on browsers, per rule 21).

### 4.2 G0 — cost. §1. Measurable exactly.

### 4.3 G2 — quality. **Partly measurable, and much weaker than the contract implies.**

Available: `tools/scores.mjs` already parses **64 scored verdicts across 16 domains** into
trajectories, and `corpus/90-verdicts/` carries a `Status: PASS/FAIL` and an `n/10` score per
verdict. `tools/verdict-staleness.mjs` and `tools/verdict-validate.mjs` exist. **Reuse
`tools/scores.mjs`; do not write a second verdict parser** (rule 10).

**Why the obvious metric is not honest.** `mean_verdict_score` over a window is confounded beyond
use: 64 verdicts over 16 domains is ~4 per domain; scores range 0 → 6 and move by whole points
between rounds (`Stealth & crime` 2 → 3 → **0**); and a verdict scores *the piece*, whose difficulty
varies far more than any efficiency change will. A change that halved quality would be invisible
inside that noise, and a change that did nothing could easily print a red. **Publishing a
"quality guard" that cannot detect the harm it exists to detect is worse than publishing none**,
because the page would colour it green and everyone would believe it.

**So G2 ships in two parts, and the ledger must distinguish them:**

- **G2a — the continuous tripwire (cheap, one-sided, low power, honestly labelled).** Two alarms
  that fire on a *structural* signal rather than a score:
  1. **Critic find-rate = 0.** Rule 23: a critic that cannot find a gap has failed. Findings per
     critic verdict, counted from verdict structure. If any critic in the affected agent class
     returns zero findings on two consecutive pieces, that is a blind critic, and it is the exact
     shape a context-cutting change would produce. Baseline find-rate must be measured by the
     build and written to `baseline_critic_find_rate`.
  2. **Any verdict below the baseline 10th percentile.** Flag, not fail.
  Both published with `"power": "low"` and the N they rest on, so nobody reads them as proof.
- **G2b — the controlled re-grade, which gates *landing* a change.** Before a change is kept, one
  already-verdicted piece is re-graded by a **fresh critic under the new regime**, blind to the old
  verdict, and its findings are compared against the known finding set of the original verdict.
  If the new critic recovers materially fewer known findings, the change cost quality — measured,
  not inferred. This is expensive (one critic run, ~$13 at baseline) and it is the **only** honest
  controlled quality measurement available. It is a per-change gate, not a continuous metric.

### 4.4 G3 — rigour. **Four of the five are not honestly measurable today. This is a finding.**

The five non-negotiables appear in verdict prose. Grepping for them counts the *word*, not the
*act*: "delete-the-fix" appears in 59 files, "CONSUMPTION" in 143, "self-test" in 55 — and a
builder who writes the phrase scores the same as one who did the work. Worse, only **2 of 95**
verdicts carry the structured header row (`| Critic run id |`, `| Judged commit |`); the rest are
free prose, so there is nothing reliable to parse.

**A guard that can only be measured by grepping for its own name is not a guard.** It is
maximally gameable by exactly the process it is meant to constrain, and a cost programme that
optimises against it will produce verdicts that say the words.

So:

- **`separate_critic` — measurable now, structurally, and this one is real.** `tools/ownership.mjs`
  and `orchestration/status/*.json` carry task ids and piece ownership; a piece with a critic whose
  `task_id` differs from its builder's is provable without trusting prose. Ship this count.
  **Reuse `tools/ownership.mjs`; do not re-derive ownership** (rule 10).
- **`delete_the_fix`, `consumption`, `self_test`, `arms_disagree` — ship as `null` with
  `"status": "unmeasured"` and the reason in the ledger**, so the page draws "—". Do not ship a
  prose grep. A `—` that says "we cannot measure this" is worth more than a green tick that means
  "the word was present".
- **The fix belongs to a different piece, and should be dispatched:** add a machine-readable block
  to the verdict template (`delete_the_fix: yes|no|n/a`, etc.) and have `tools/verdict-validate.mjs`
  — which already validates verdicts — require it. Then G3 becomes countable honestly. **Until then
  G3 is one-fifth measured, and the ledger must say so rather than imply four-fifths of a guard.**

---

## 5. The experiment protocol

### 5.1 Unit of comparison

**Not the hour.** An hour contains whatever the fleet happened to be doing; two hours are never
alike. **The unit is the agent-run** — one subagent from first to last request — attributed by
`attributionAgent` and by piece. Baseline for the dominant class (`general-purpose`, 389 runs):
mean **$13.15**, sd **$12.77**, median $9.31, p90 $30.30, p50 duration 34 min.

C/H remains the **published headline** (the owner asked for it) but is **never used for
attribution**. Attribution is always cost-per-run within a class.

### 5.2 The design: paired arms inside one wave

Cost-per-run has **CV = 0.97** — the noise is as large as the mean. A before/after comparison
across days is therefore worthless: tree state, piece difficulty, browser contention and time of day
all move it more than any change will.

**So: randomise within a wave.** When a wave of ≥12 agents dispatches, assign each agent to
treatment or control at random and run both arms **in the same wave, on the same tree, in the same
hours**. This costs nothing extra — the wave was running anyway — and it controls for every
confound that varies with time. Held constant across arms: model, effort, wave, tree commit, and
piece-difficulty mix (by randomising assignment, not by matching).

### 5.3 How long a window must be to beat noise — with the number, not a guess

From the measured CV of 0.97, for α = 0.05 two-sided at 80 % power:

| effect to detect | runs **per arm** |
|---|---:|
| 25 % mean cost reduction | **238** |
| 35 % | 122 |
| 50 % | **60** |

A log-scale test (cost is right-skewed; log-sd 1.20) gives 274 per arm for 25 %. **The fleet
produced 389 `general-purpose` runs in 62 hours**, so a 50 % effect is detectable in roughly
**19 hours of fleet time** (120 runs), a 35 % effect in ~39 hours, and a **25 % effect needs about
76 hours — longer than the entire history of the project so far.**

**This is the single most consequential number in the plan and it must not be softened.** It means:

- **Small changes cannot be proven here.** Any change with an expected effect under ~35 % on
  cost-per-run should be justified by *mechanism* (a measured reduction in tokens read, which is
  near-deterministic and needs no statistics) rather than by an end-to-end cost A/B.
- **Therefore the primary attribution metric is the mechanism, not the money.** Report
  **PIE tokens per run** — priced-input-equivalent tokens, `input + 1.25·cw5 + 2·cw1h + 0.1·cr +
  5·out` — which is model-independent (§0.3) and has far lower variance than dollars because it
  removes the model-mix term. Then cost decomposes exactly and multiplicatively:
  > **C/H = (PIE per active hour) × (weighted mean base input price)**
  Model-mix changes move only the second term and are computable in closed form with **no
  experiment at all** — a mix change's effect is arithmetic, not empirical. Volume changes move
  only the first. **Two levers, independently measurable, no confound between them.**
- Minimum publishable window: **4 active hours**, below which the ledger marks the reading
  `"comparable": false`.

### 5.4 Reversibility — the owner's hard condition, in four parts

Every change lands with all four, and the ledger's `changes[]` entry carries them:

1. **Before** — an instrument reading, commit-stamped (rule 12), taken with `--full`, not recalled.
2. **A named one-step reversal.** Prefer a **flag over a revert**: a single
   `orchestration/COST-FLAGS.json` entry (`{"CH-01": true}`) read by the dispatch templates, so
   reversal is one edit and touches no history on a tree a dozen agents are committing to.
   `git revert <sha>` is the fallback where a flag will not fit.
3. **The reversal executed on a copy, before the change is trusted.** On a worktree: flip the flag
   off, re-run the affected path, and show **the old number comes back**. `reversal_executed: true`
   is a lie unless this happened; the ledger field exists precisely so it can be checked.
4. **A tripwire that triggers automatic reversal.** Concrete defaults, per change:
   - `g1_parallelism.mean_agents < 12` over **two consecutive active hours** → revert;
   - critic find-rate **= 0** on two consecutive verdicts in the affected class → revert (G2a);
   - cost-per-run in the affected class **rises** > 10 % vs its own baseline → revert (the change
     backfired);
   - G2b re-grade recovers **fewer** known findings → revert.

---

## 6. Which existing instruments are reused, by path — and the contract amendments

### 6.1 Reuse (rule 10 — a second implementation is a defect)

| need | reuse | how |
|---|---|---|
| verdict scores for G2 | **`tools/scores.mjs`** | already parses 64 verdicts into per-domain series. Import or shell it; do not re-parse verdicts. |
| verdict validity / staleness | `tools/verdict-validate.mjs`, `tools/verdict-staleness.mjs` | for the G3 fix piece (§4.4), not for this build |
| agent + piece ownership for G1 cross-check and G3 `separate_critic` | **`tools/ownership.mjs`** | task ids, live pieces, `--conflicts` |
| dispatchability, piece state | `tools/dispatchable.mjs`, `tools/dispatch-staleness.mjs` | context for `changes[]`; not a cost source |
| concurrent *load* | `tools/contention.mjs` | **not** G1. It counts browser instances and run-queue per core (rule 21), which is a different quantity from concurrent agents. Cite it, do not reuse it for parallelism. |
| noisy command capture | `tools/run.mjs` | wrap long parses |
| publishing / staging | `tools/publish.mjs`, `tools/bank.mjs` | the refresh path; the instrument does not commit |
| the ledger renderer | **`tools/cost-report.mjs`** (COST-DASHBOARD) | draws the ledger; **computes no money.** This build writes the file and nothing else. |

**There is no existing cost or token tool** (`ls tools/ | grep -iE 'cost|token|spend|usage|price'`
returns nothing but the dashboard agent's `cost-fixture.json`). `tools/cost.mjs` is new, and it must
be the **only** thing in the repo that multiplies tokens by a price.

### 6.2 The declared contract: accepted, with five amendments

`COST.md` §6.1 declares `docs/data/cost-ledger.json` (`elder-souls/cost-ledger@1`), instrument
writes / dashboard draws, refreshed on every bank via `tools/cost-refresh.mjs` with a 25 s timeout.
**Accepted in full** — the path, the schema name, the writer/renderer split, and the
`cost-ledger.error.json` failure mode are all right, and `tools/cost.mjs` is the right name. The
contract also says cost is mine to change by editing the file, so I have. **Five amendments, all
made in `COST.md` §6.1 itself so nothing depends on this plan being read:**

1. **`prices` gains the fifth class and real numbers.** The declared example shows Opus at
   `input 15, cache_write 18.75, cache_read 1.5, output 75` — **3× the published price** — and one
   `cache_write` where there are two. Corrected to the §0.3 table, with `effective` and an explicit
   `sonnet_intro_expires: "2026-08-31"`.
2. **`by_token_class` and `by_model.tokens` carry five classes**, not four.
3. **New `coverage` block** — `{files_total, files_read, bytes_read, complete}`. **When
   `complete` is false, every headline field is `null`.** This is the §3.2 N5 defence carried into
   the wire format: a partial read must render "—", never a confident under-count.
4. **New `drivers` block** — `{requests, mean_context_tokens, pie_tokens, requests_per_agent_hour}`.
   Without it the page shows *what* the cost is and never *why*, and 81 % of the story (§2) is
   invisible. The renderer draws it; it does not compute it.
5. **New `denominator` block** — `{definition: "active_clock_hours", active_hours, agent_hours,
   span_hours}` plus `comparable_key` (§1.3), so two dots on the chart can be checked for
   comparability rather than assumed.

### 6.3 The 25 s budget — a real constraint, and the honest failure mode

A full parse of all 403 files / 638 MB takes **8.85 s** today. That fits, with 2.8× headroom. But
the tree grew **6 MB during the ~40 minutes** this plan took to write, and **401 of 403 files were
appended to in the last 6 hours** — so mtime-based skipping buys nothing. On the current trajectory
the full parse crosses 25 s within days.

**Design: byte-offset roll-up over an append-only source.**
- Cache at `docs/data/cost-cache.json`: per file `{path, bytes_read, last_mtime, totals_by_model_
  and_class, tail_message_ids[50]}`. Committed, so a restarted container resumes (containers have
  killed the fleet three times in a day).
- Each run seeks to `bytes_read` and parses only the tail. Totals are additive.
- If a file's size **shrank**, the cache entry is invalidated and the file re-read whole.
- **Dedup under incrementalism** is the correctness risk, and it is handled two ways: (i) the
  canonical file set **excludes `subagents/workflows/**`**, which is where all 1,045 cross-file
  duplicates live, so remaining duplicates are within-file; (ii) a 50-id trailing ring buffer per
  file catches a message whose blocks straddle the tail boundary.
- **`--full` ignores the cache entirely.** Every published baseline, and every `changes[]`
  before/after reading, **must** use `--full`. The cache is for the every-bank refresh only.
- **The correctness check that makes the cache trustworthy** (§3.3): `--full` and cached must agree
  **to the cent** on the real tree. The build runs this and records the output.

**When the budget is exceeded: fail loudly, never truncate.** On timeout or any read error the tool
writes `docs/data/cost-ledger.error.json` and exits non-zero, **leaving the previous good ledger
untouched**. It must never write a ledger with `complete: false` and populated headline numbers.
A silently truncated read that under-reports cost is the inert-instrument shape this project keeps
finding, and it would under-report in the flattering direction.

---

## 7. External research — hypotheses to test here, never results

The owner asked for techniques proposed for this kind of workflow, cited, and then **tested here**.
Each below is a hypothesis with its source and its specific claim. **None is a result until it has
been measured on this repo.** Ranked by how directly it attacks our actual cost structure (§2:
81 % cache reads = context volume × request count).

**Read `COST.md` §4a and `reports/cost/RESEARCH-RESEARCH-COSTEXT01.md` first — they are the
authoritative research register.** A parallel agent (`RESEARCH-COSTEXT01`) landed them while this
plan was being written; the table below is kept because it is scored against *our measured cost
structure*, which the register is not, but where the two overlap the register wins. Two notes on
the overlap, both useful:

- **Corroboration.** We independently found the same context-pruning result (H1). Our figures differ
  slightly — they report completion 71 % → 91.6 %, I read 79.0 % → 91.6 % — which is the sort of
  discrepancy that means at least one of us is quoting a different arm of the same table. **Neither
  of us read the paper** (see the caveat below); the build critic should not treat either figure as
  settled.
- **A claim of theirs that my baseline can test cheaply, and should.** §4a reports that *concurrent
  requests cannot hit each other's cache until the first has begun streaming*, and notes this box
  dispatches 5–8 agents in one block sharing a prefix — so the fleet may be paying 1.25× writes N
  times where it could pay one write and N−1 reads at 0.1×. **My baseline says cache writes are
  $910.89 (15.7 % of spend), the second-largest line after cache reads**, which makes this the
  largest testable claim in the register. It is directly checkable with `tools/cost.mjs`: group
  `cache_write_5m` by dispatch block and look for N agents each writing a near-identical prefix
  within seconds of one another. **Recommend this as the first change tested after the instrument
  lands** — it needs no behaviour change to measure, only the instrument.

**Access caveat, reported plainly (rule 26):** `WebFetch` is blocked by the egress proxy for
`anthropic.com`, `claude.com` and `arxiv.org` (verified: `EGRESS_BLOCKED`). `WebSearch` works. So
the claims below come from **search-result summaries, not from reading the primary sources**. Every
number is second-hand and must be treated as weaker than a figure I read myself. A build or critic
agent with working fetch should verify them before any of them is relied on.

| # | technique & source | the specific claim | why it may or may not transfer here |
|---|---|---|---|
| **H1** | **Context pruning to the last N tool-call pairs, + summarisation.** *Less Context, Better Agents: Efficient Context Engineering for Long-Horizon Tool-Using LLM Agents*, arXiv 2606.10209 | Pruning to the **last 5 tool call/response pairs** gave a **63.9 % token reduction** (535,274 vs 1,480,996 tokens over a 50-task benchmark) at 79.0 % task completion; **adding summarisation raised completion to 91.6 %** at 553,374 tokens — i.e. **quality went up while tokens fell 2.68×** | **The most relevant claim we have.** Attacks context volume directly, which is our 81 %. But their agents do expense itemisation; ours read code and hold a brief. **Test:** measure PIE-per-run with and without tool-result pruning on one wave, paired arms (§5.2) |
| **H2** | **Server-side context editing (`clear_tool_uses_20250919`) / compaction.** Anthropic context-management docs & `platform.claude.com` context-editing page | A **100-turn web-search evaluation reduced token consumption by 84 %** while completing workflows that otherwise failed on context exhaustion; clearing happens **after prompt-cache lookup**, so it is claimed not to destroy cache prefixes | Directly available as an API feature, so cheap to trial. **The claim I most distrust:** clearing content *inside* a prefix must change the prefix, and our spend is 98.4 % cache reads — if it invalidates the cache it could make cost **worse** before it makes it better. **Test:** one agent class, measure cache_read *and* cache_write_5m; a rise in writes is the tell |
| **H3** | **Sub-agent isolation — subagents return a distilled summary, not their trace.** Anthropic, *Effective context engineering for AI agents* | A subagent may use tens of thousands of tokens and return **1,000–2,000 tokens** to the parent | We already do this (subagents are separate transcripts). **Already banked; not a lever.** Worth stating so nobody re-proposes it |
| **H4** | **Model routing by task shape.** Multiple 2026 practitioner sources (fast.io, tokenoptimize.dev) | **40–60 % token-cost reduction** from routing cheap work to cheap models | Matches our closed-form ceiling (§2.1: 0.40–0.60×) almost exactly — a rare case where an external claim and our arithmetic agree. **Needs no experiment**: the effect is computable from the price table |
| **H5** | **Trajectory reduction.** *Reducing Cost of LLM Agents with Trajectory Reduction*, arXiv 2509.23586 | Reduces cost by shortening the stored action trajectory | Same family as H1. Could not read the paper (blocked). **Flagged, not costed** |
| **H6** | **Adaptive context omission.** *Agent-Omit*, arXiv 2602.04284; *Beyond Compaction: Structured Context Eviction for Long-Horizon Agents*, arXiv 2606.11213 | Omit/evict context adaptively rather than by recency | Blocked; summaries only. **Lowest confidence of the set** |
| **H7** | **Multi-agent systems cost 4–15× a single call.** Anthropic multi-agent research post, via secondary sources | Their system used **~15× the tokens of chat**; **token usage alone explains 80 % of performance variance** on BrowseComp | A warning, not a lever — and a sharp one for this programme: if token spend *predicts* quality, a 4× cost cut may be a 4× quality cut wearing a disguise. **This is the strongest external argument that G2 must be real** (§4.3), and it is why I refuse to ship a G2 that cannot fail |
| **H8** | **Retrieval instead of restatement (RAG / just-in-time exploration).** Anthropic context-engineering post; practitioner guides | **60–80 % token reduction** vs reading full documents | This is `RULES.md` rule 18 ("point at files; do not restate them"), which the orchestrator has broken four times. **Testable directly:** brief size is measurable, and PIE-per-run is the readout |

**What the numbers say about the bar.** §2.1 gives a mix factor of ~0.7×; the bar needs 0.25×;
so volume must fall ~2.8×. H1 claims 2.68× and H2 claims 6.25× on their own benchmarks.
**The bar is arithmetically reachable if either transfers — and neither has been tested here.**
That, and not the model-mix lever, is where the programme's rounds should go.

---

## 8. Scope, declared risks, and what this build does not do

- **Not priced:** `server_tool_use` (web search/fetch request counts are in `usage` but are
  per-request charges, not tokens). Baseline counts are ~0 in this window; the ledger should carry
  the raw counts so a successor can price them without re-parsing.
- **Not covered:** session running-time charges, if any. The transcript does not carry them, so
  **this instrument measures model spend only** and must say so on the page. If the owner's actual
  bill exceeds C by a fixed margin, that margin is outside this instrument and pretending otherwise
  would be a fabricated number.
- **Not covered:** the cost of agents whose transcripts were lost to the three container restarts.
  Spend that left no record cannot be measured; the ledger's `coverage` block is the honest place
  to note it.
- **CARRIED risk:** G1 has two readings that disagree (§4.1); shipping both is the mitigation.
- **CARRIED risk:** the incremental cache is a correctness surface with no fixture that can catch a
  drift; only the `--full` reconciliation can, and it must be run on every baseline.
- **CARRIED risk:** the Sonnet intro-price expiry on 2026-08-31 will move C/H with no change to
  behaviour. The pinned price table makes it visible; it does not make it go away.

---

## 9. Recommended build model, with the reason (evidence, not taste)

**Build: `claude-sonnet-5`. Build critic: `claude-opus-5`.**

`PLAN-LOOP.md`: *"A build with a landed plan, an existing instrument, and a machine-checkable
acceptance is a Sonnet job"*, and *"any critic"* is Opus. Against those three tests:

- **Landed plan** — this document, which specifies every consumed field (§1.1), every price
  (§0.3), every fixture with its expected dollar figure (§3), and the exact wire format (§6.2).
- **Machine-checkable acceptance** — `node tools/cost.mjs --self-test` must print six passes and
  exit 0, and the five deliberate breaks must each go red (§3.3). The headline fixture is
  **$74.80**, checkable on a calculator in thirty seconds. A wrong parse cannot hide.
- **Existing instrument** — this is the one test it *fails*: `tools/cost.mjs` is new. But the
  novelty is in the *measurement design*, which is done here, in the plan, by Opus. What remains is
  read JSONL → dedup on a stated key → multiply by a stated table → write a stated schema.

**And the evidence from the programme itself.** `COST.md` §4 names model mix as the largest lever
and records that the policy "has been written down and almost never applied" — 3,230 Opus against
29 Sonnet in the orchestrator's own session; **44,018 against 2,557 across the whole fleet** on my
count. `PLAN-LOOP.md` records Sonnet catching four errors in the orchestrator's briefs including a
fabricated figure. Building the cost instrument on Sonnet is the first application of the
programme's own headline lever, and it generates a data point about that lever while producing the
tool that measures it. **A cost programme whose first build ignores its own largest lever has
already failed to take itself seriously.**

**Risk and mitigation:** if Sonnet gets the parse wrong we lose a build round (~$13 at baseline,
~$5 at Sonnet rates). The `--self-test` arithmetic detects that in minutes, not hours, so the
downside is bounded and small. **Reversible:** if the build critic finds the Sonnet build defective
on measurement *judgement* rather than mechanics, that is the evidence that overturns this ruling,
and the re-build goes to Opus.

**Haiku: no.** `COST.md` §4 and `PLAN-LOOP.md` both say it is unproven and no build should be its
first job. This build is not the place; a mechanical trial elsewhere is.

---

## 10. What I am least sure of, and the plan critic's strongest move against this document

Per `PLAN-LOOP.md`, naming the weak joint is the cheapest way to spend a critic's exchange.

**The critic's strongest move — and it lands.** *"You chose the G1 denominator after seeing which
reading passes. On the span-based reading, 35 of 63 hours are below the floor of 12 and your
baseline breaches its own parallelism guard. You then built the whole comparability story on the
definition that makes the number green."* That is fair. §4.1 says so and mitigates by publishing
both readings, but the mitigation was written after the choice, not before it, and a critic should
mark it **BLOCKING** if it wants the floor re-derived from the span reading instead. I would not
argue.

**Second strongest.** *"Your null control tests pricing, not selection — N1–N4 all pass on an
instrument that reads half the tree."* I caught this while writing §3.2 and added **N5**, which is
now the most important arm. But it was nearly absent, and the near-miss is exactly the defect in
§0.1 that the dispatch brief itself carries. A critic should check that N5 is real and that it has
been *seen to fail*, not merely written down.

**Third.** *"Cost per agent-hour does not defend against idling the way you claim — a fleet of
fifteen cheap agents and a fleet of fifteen expensive ones both pass G1, and the first has achieved
nothing."* True. Neither C/H nor cost-per-agent-hour measures *work done*; only G2/G3 do, and §4.3
and §4.4 concede that G2 is weak and G3 is four-fifths unmeasurable. **The honest summary is that
this programme's quality guards are its soft flank, and no amount of cost precision fixes that.**

**What I am least sure of, in order:**

1. **That the 25 % bar is reachable without touching rigour.** §2.1 and §5.3 together say model mix
   caps at ~0.7×, so volume must fall 2.8×, and the only published techniques that large (H1, H2)
   work by *removing context the agent would otherwise see*. That is a hair's breadth from "give
   the critic less to work with", which `COST.md` §5 forbids. I believe the bar is reachable; I am
   not confident it is reachable *and* G2 stays honest, and I would rather that tension were on the
   record now than discovered in round four.
2. **That G2 can be measured at all at N = 64 verdicts.** §4.3 argues it cannot, as a continuous
   metric, and proposes a per-change re-grade instead. If the critic thinks a windowed mean verdict
   score is defensible, I want the argument, because I would rather be wrong here than ship a
   `—` where a number could have gone.
3. **That the incremental cache can be made correct.** §6.2 specifies the ring buffer and the
   `--full` reconciliation, but I have not built it, and dedup-under-incrementalism is the kind of
   thing that is right in a plan and wrong in code. If the build finds it fragile, **the correct
   answer is to drop the cache and run `--full` every time until the parse actually exceeds the
   budget** — 8.85 s today, and a slow honest number beats a fast wrong one.
4. **The external citations.** All second-hand (§7 caveat): egress blocks `anthropic.com`,
   `claude.com` and `arxiv.org`, so I read search summaries rather than papers. The H2 84 % figure
   in particular deserves verification before anyone plans a round around it.

**Sources** (search-result summaries only — see the §7 caveat):
[Less Context, Better Agents (arXiv 2606.10209)](https://arxiv.org/abs/2606.10209) ·
[Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) ·
[Anthropic — Managing context on the Claude Developer Platform](https://claude.com/blog/context-management) ·
[Claude Platform — Context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) ·
[Reducing Cost of LLM Agents with Trajectory Reduction (arXiv 2509.23586)](https://arxiv.org/pdf/2509.23586) ·
[Agent-Omit (arXiv 2602.04284)](https://arxiv.org/pdf/2602.04284) ·
[Beyond Compaction (arXiv 2606.11213)](https://arxiv.org/pdf/2606.11213) ·
[AI Agent Token Cost Optimization 2026 — fast.io](https://fast.io/resources/ai-agent-token-cost-optimization/) ·
[LLM Token Optimization Strategies — tokenoptimize.dev](https://www.tokenoptimize.dev/guides/llm-token-optimization-strategies) ·
[Multi-Agent Cost Compounding — Augment Code](https://www.augmentcode.com/guides/multi-agent-cost-compounding) ·
[How Anthropic Built a Multi-Agent Research System — ByteByteGo](https://blog.bytebytego.com/p/how-anthropic-built-a-multi-agent)

---

# 11. PLAN CRITIC — `COST-INSTRUMENT-plancritic` (exchange 1 of 2)

**Verdict: BLOCKED pending items 1–6.** Twelve further items are CARRIED into the build brief as
declared risks. Three rulings the orchestrator asked for are at §11.4, all reversible.

**How this was produced.** Everything below is re-derived independently from
`/root/.claude/projects/-home-user-elder-souls-claude/**` on **2026-08-08T12:46Z at commit
`70d40ab`**, by three scripts in the scratchpad suffixed `-COST-INSTRUMENT-plancritic`, which parse
every `.jsonl` line, build their own `message.id` map and price it from their own table. Nothing
here is taken from §0–§10. No browser was used. The tree grew *during* this critique — 47,838 →
47,915 → 48,199 distinct request ids across three passes forty minutes apart — which is §0.4
confirmed live and is the reason every figure below carries its snapshot.

**This plan is the best document in the repo and it has a defect that would have shipped a wrong
number.** Its four corrections in §0 are real: I reproduced the 9.3 % orchestrator share (**9.26 %**),
the zero-unique workflow mirror, the five token classes, the growing source. Its §10 self-criticism
is honest. And precisely because §0.1 is so good, the plan's readers — and the plan itself — stopped
looking for a *second* instance of the same shape. There is one, it is in §0.2, and it is BLOCKING 1.

---

## 11.1 BLOCKING — resolve before the build starts

### **BLOCKING 1 — "dedup on `message.id`, keep one, never sum" is under-specified, and the natural implementation loses 59 % of the output tokens.**

§0.2 states that the several records sharing a `message.id` carry "**three byte-identical copies of
`usage`**", verified "in all 770 main-transcript groups". **I reproduced that verification and it is
true — of the main transcript.** My pass over the orchestrator's own file finds **786 multi-record
groups and zero disagreements**, exactly as claimed.

**It is false across the rest of the tree.** Over the canonical set (main + `subagents/*.jsonl`),
**6,034 of 47,915 request ids — 12.6 % — carry records whose `usage` blocks disagree**, and the
disagreement is *exclusively* in `output_tokens`:

| class | ids whose records disagree |
|---|---:|
| `input`, `cache_write_5m`, `cache_write_1h`, `cache_read` | **0** |
| `output` | **6,034** |

The mechanism, from the raw records of `msg_011CdpFfEUfTg8xgv1N2Kbqx`:

| record | ts | `stop_reason` | blocks | `output_tokens` |
|---|---|---|---|---:|
| 1 | 23:26:47.167 | `null` | `thinking` | 4 |
| 2 | 23:26:47.567 | `null` | `text` | 4 |
| 3 | 23:26:54.638 | `null` | `tool_use` | 4 |
| 4 | 23:26:55.208 | **`tool_use`** | `tool_use` | **1,177** |

The writer flushes a record per content block with the usage snapshot *as of that moment*; only the
terminal record carries the response's true output count. The other four classes are fixed at
request time, which is why they never disagree.

**What it costs.** Selecting the first record — the natural reading of "keep one" and, on the
evidence of §2's own figures, what this plan did — yields **4,001,487 output tokens against a true
9,797,208. First-wins reads 40.8 % of the output.**

**The remedy, with its proof.** Dedup on `message.id` taking the **element-wise maximum** of each of
the five classes. Do *not* select on `stop_reason`: it is `null` on **36,845 of 48,199** ids (76 %),
so it cannot be the primary selector — but wherever it exists it agrees with the maximum in **every
single case** (0 mismatches among single-terminal ids; 9,941,804 tokens by either rule, identical to
the token). So max is safe, total, and equivalent to the semantically correct rule. §1.1's field
table must state it, and the two-word phrase "keep one" must not survive into the build brief.

**Why this is the item that matters most.** It is the same shape as §0.1 one notch smaller and one
level deeper: a verification performed on the orchestrator's session — **9.3 % of the money** — and
generalised to the other **90.7 %**. That is the defect this plan is celebrated for finding, and the
plan committed it in the very section that documents it.

### **BLOCKING 2 — the null control cannot fail on BLOCKING 1. N1 is inert against the defect actually present in the data.**

N1's fixture is specified as "record A written as 3 records sharing one `message.id`, **each carrying
the same `usage`**". Every arm N1–N6 is satisfied by a first-wins instrument. **A build that
implements the plan's dedup rule wrongly passes `--self-test` 6/6 and publishes a confident,
wrong number** — which is the exact sentence §3 opens with.

**Add N7 — the partial-usage arm.** One `message.id` written as four records on `claude-opus-5`,
**zero in all four fixed classes** so the arithmetic is purely output, with `output_tokens`
`4, 4, 4, 1177` and `stop_reason` `null, null, null, "tool_use"`:

| instrument | says | why |
|---|---:|---|
| **correct (max / terminal)** | **$0.0294** (1,177 out) | the only right answer |
| first-wins | $0.0001 (4 out) | the defect above, 294× low on this fixture |
| sums records | $0.0297 (1,189 out) | the N1 defect |

Add it to the §3.3 deliberate-break sequence as a **sixth break**: on a scratch copy, change the
merge from `max` to `first`, and **N7 must go red while N1–N6 stay green** — which is the whole point,
because it demonstrates that N1 could never have caught it.

### **BLOCKING 3 — the numbers downstream of BLOCKING 1 are wrong, in both this plan and `COST.md` §2, and one of them is currently being used to demote a lever.**

Re-derived on the canonical set at 2026-08-08T12:46Z, terminal-record selection, Sonnet at intro:

| | plan §2 (first-wins) | **corrected (max)** |
|---|---:|---:|
| output tokens | 3,878,309 | **9,797,208** |
| output USD | $95.69 | **$236.80** |
| **output share of spend** | **1.7 %** | **3.93 %** |
| median output per request | **5** | **16** |
| mean / p90 output per request | 83 / 100 | **204 / 492** |
| `cache_read` share | 81.2 % | **79.34 %** |
| C (total) | $5,792.69 | **$6,025.85** |
| C/H (52 active hours) | $111.40 | **$115.88** |
| $/agent-hour (692 agent-hours) | $8.51 | **$8.71** |

`COST.md` §2 currently reads *"Output is 1.7% of spend and median output is 5 tokens. Writing shorter
is worth approximately nothing."* The direction survives — 3.9 % is still small — but the figure is
wrong by **2.3×** and the median by **3.2×**, and it is the stated basis for writing off a lever.
A demotion argued from a number that is itself an artefact of the bug is not a demotion, and this
programme cannot afford to publish one. Both files must be corrected together, with the corrected
totals re-stamped against a commit.

### **BLOCKING 4 — G1 is specified two different ways in the two binding documents, and the numbers each cites belong to different hour sets. The build cannot implement both.**

§4.1 says mean over active hours of requesting agents (13.10, passes). `COST.md` Ruling C2 says
median, and cites "**median 11, 35 of 63 hours below the floor**" — but that pair comes from a
*different series*: the span-hour set, not the active-hour set that H uses. All four readings,
measured:

| reading | hour set | mean | median | hours < 12 |
|---|---|---:|---:|---|
| **requesting** | **52 active** | **13.31** | **12.5** | **24 / 52 (46.2 %)** |
| **present** (alive between first and last request) | **52 active** | **13.42** | **12.5** | **24 / 52 (46.2 %)** |
| requesting | 63 span (idle = 0) | 10.98 | 11 | 35 / 63 |
| present | 63 span | 11.25 | 11 | 35 / 63 |

**And the row that changes the shape of §4.1 entirely: on the same hour set, the two "honest readings
that disagree" do not disagree.** Requesting and present give **13.31 vs 13.42** mean, **12.5 vs
12.5** median, **24 vs 24** hours below floor. The 13.10-against-11 gap that §4.1 calls "the critic's
best line of attack on me" — and that C2 was ruled on — **is not a disagreement about how to count
agents at all. It is produced entirely by putting 11 idle hours into the denominator**, and it
appears identically under *both* agent-count rules. §4.1's whole confession is filed against the
wrong variable.

Two consequences. First, "G1 is the median" does not by itself pick a value: it is **12.5 (passing)**
or **11 (failing)** depending on a choice about hours that neither §4.1 nor C2 makes. Ruled at
§11.4.1. Second, §4.1's proposed mitigation — publish both readings, flag a >20 % divergence — will
essentially never fire once the hour set is fixed (the readings differ by 0.8 %). Keep publishing
both, but **move the divergence flag onto the hour sets** (`active_hours` vs `span_hours`, currently
52 vs 63, a 21 % gap), which is where the information actually is and which is the genuine cost
finding: agents alive and not requesting.

The build must implement one reading, publish both, and the ledger must name the **hour set** beside
every G1 figure — `comparable_key` already exists for exactly this.

### **BLOCKING 5 — both published metrics are monotone in idleness, which is the failure the owner named in the same breath as the target.**

Owner, verbatim in `COST.md`: *"I don't want to save cost by running more slowly."*

- **C/H = C ÷ active clock hours.** A fleet that does *identical work* spread over more hours has the
  same C and a larger H, so **C/H falls**. §1.2 analyses only the idle direction (which (b) fixes)
  and concedes the dilution direction in one line ("an hour containing one cheap request counts as a
  full hour") without following it: dilution is not an edge case, it is the general behaviour of the
  metric under slowdown.
- **$/agent-hour = C ÷ (hour, agentId) pairs.** Identical defect and it is offered as *the guard*.
  An agent that is alive and idle longer accrues more agent-hours at the same spend, so the
  diagnostic falls too. §10's third self-criticism gets close ("neither measures work done") and then
  §1.2 asserts this metric closes the gap anyway. It does not.
- **G1 counts agents, not work.** Twelve agents each issuing one cheap request an hour satisfies it.

**All three headline numbers improve if the fleet slows down**, and nothing in the declared ledger
would show it. The remedy is cheap and does not change the bar: the ledger must carry, beside C/H,

- `drivers.requests_per_active_hour` (baseline **920.0**) and `drivers.runs_per_active_hour`
  (baseline **7.75**; 403 runs / 52 h; median run 33.9 min, mean 40.9, p90 76.1), and
- a throughput count for the window from tools already being reused — verdicts landed
  (`tools/scores.mjs`) and pieces closed (`tools/ownership.mjs`) — published as `drivers.work`.

None of these is a new definition of the bar. They are the counters that make a slowdown visible on
the page instead of invisible in the numerator. **A cost figure whose only guards are also monotone
in idleness is not guarded.**

### **BLOCKING 6 — §5.3's stated reason for mechanism-based attribution is measurably false, and the correct mechanism metric is ~6× more powerful than the one proposed.**

§5.3: *"Report **PIE tokens per run** … which is model-independent (§0.3) and **has far lower
variance than dollars** because it removes the model-mix term."* Measured over the same 403 runs:

| per-run metric | mean | **CV** | runs per arm, 25 % effect |
|---|---:|---:|---:|
| dollars | $13.65 | **0.928** | 217 |
| **PIE tokens** | 2.83 M | **0.888** | **198** |
| requests | 114.4 | 0.643 | 104 |
| **mean context tokens per request** | 166,568 | **0.386** | **38** |

PIE per run is **4 % less variable than dollars**, not "far lower" — because **94.7 % of PIE is
already Opus**, so there is almost no mix variance available to remove. The proposed primary
attribution metric does not solve the power problem it is introduced to solve.

**The conclusion is right and the reason must be replaced.** Mechanism-based attribution is correct
because the PIE decomposition `C/H = (PIE per active hour) × (weighted mean base input price)` is
*exact* — mix effects are closed-form and need no experiment at all — not because PIE is quieter.

**And the constructive half, which is the most useful number I found.** The variance lives in *run
length*, not in tokens: **mean context tokens per request has CV 0.386**, giving **38 runs per arm
for a 25 % effect (~5 hours of fleet time at 7.75 runs/h) and 235 per arm even at 10 %**. So
§5.3's headline — *"a 25 % effect needs about 76 hours — longer than the entire history of the
project"* — is true of **dollars per run** and **false of context per request**. A 25 % context cut,
which is exactly what H1/H2/H8 propose, is provable here **in an afternoon**. The plan must declare
**context tokens per request** (equivalently PIE per request) as the primary acceptance for volume
levers, with dollars per run demoted to the confirmatory readout it can actually support.

---

## 11.2 CARRIED — declared risks for the build brief, not blockers

1. **"403 files / 638 MB" matches no set the instrument will read.** Today: **416 `.jsonl`** =
   405 subagents + 10 mirror + 1 main, **602.0 MB**; the whole directory is **998 files / 674.8 MB**
   including 405 `.meta.json`, 174 `tool-results/*.txt` and a workflow script, none of which are ever
   parsed. The plan's own arithmetic does not close either: **386 + 10 + 1 = 397 ≠ 403**. Define
   `coverage.files_total` as the *enumerated canonical set* (main + `<session>/subagents/*.jsonl`,
   mirror excluded) or N5's `files_read == files_total` assertion has no referent.
2. **Coverage attacked in four directions and it holds — recorded so nobody spends a round repeating
   it.** (a) One `projects` directory on disk; no second `.claude` tree; `/root/.claude/sessions` and
   `/root/.claude/backups` hold no transcripts. (b) One session; its first record is
   `2026-08-05T22:16:46Z`, **earlier than the repo's first commit at 22:25:34**, so no earlier day is
   missing. (c) **396 `Task` tool_use invocations, 396 `.meta.json` sidecars, 0 spawns without a
   transcript** — no agent died before writing. (d) The mirror holds **1,045 ids of which 0 are
   unique**, so §6.2's exclusion of `subagents/workflows/**` loses nothing. §0.1's replacement claim
   survives independent attack.
3. **`attributionAgent` is not a stratifier, and §5.1 leans on it as one.** 395 files
   `general-purpose`, **9 `workflow-subagent`**, **2 carrying no `attributionAgent` at all**; every
   `.meta.json` reads `agentType: general-purpose, spawnDepth: 1`. There is effectively **one class**,
   so "cost-per-run within a class" is unstratified, and the 9 workflow-subagents have no `.meta.json`
   at all. Key attribution on `agentId`; treat `attributionAgent` as a nullable label.
   **And I tried to break the 238-run finding by stratifying and failed:** pooled within-role CV
   (critic / build / plan / research, from `.meta.json` descriptions) is **0.928** — identical to the
   overall 0.928. Stratification buys nothing. §5.3's constraint stands, stronger than it claimed.
4. **The price table deserves *more* confidence than the plan gives it, and §10.4 conflates two
   different things.** The `EGRESS_BLOCKED` caveat is right about H1–H8 and wrong about prices.
   Verified offline, independently, against the bundled `claude-api` skill —
   `claude-api/shared/models.md` and `claude-api/shared/prompt-caching.md`: **Opus 5 $5/$25**;
   **Sonnet 5 $3/$15 sticker, "introductory $2/$10 per MTok applies through 2026-08-31"** (verbatim,
   including the date); **Haiku 4.5 $1.00/$5.00**; **cache read 0.1×, write 1.25× (5 m) / 2× (1 h)**.
   Every figure in §0.3 matches. This is a versioned local reference, not a search snippet.
5. **The mix ceiling, measured rather than asserted.** All-Sonnet at list = **0.620×** (§2.1 says
   0.60×). **Critics pinned to Opus, everything else Sonnet-list = 0.719×** — §2.1 guessed "nearer
   0.7×" and it is 0.719. Critics are **23.4 % of subagent PIE**. So 0.25 ÷ 0.719 ⇒ **volume must fall
   2.88×**. §2.1's headline survives contact with the data.
6. **Two tokenizer facts qualify the scalar-substitution argument.** Opus 5 and Sonnet 5 share the
   Opus 4.7/4.8 tokenizer (verified), so Opus → Sonnet really is a pure price scalar and §2.1 is
   sound. **Haiku is a different tokenizer** — "the Opus 4.7 tokenizer tokenizes the same content to
   roughly 1×–1.35× as many tokens" as Sonnet/Haiku/older — so "Haiku 0.20×" is a *price* scalar, not
   a cost scalar, and PIE is not strictly model-independent across the Haiku boundary.
7. **§8's unquantified margin can be given a bound.** The same reference states list cost includes
   **web search at $10 per 1,000** and **session running time at $0.08/hour**. Web-search calls in
   this window: **0** (I counted `usage.server_tool_use` across the tree). Session time:
   692 agent-hours × $0.08 = **$55.36 ≈ 0.9 % of C**. Replace "if the owner's actual bill exceeds C by
   a fixed margin" with that number and its source.
8. **The instrument reads a path that is not in the repo, on a container destroyed three times.**
   If `/root/.claude/projects/**` is lost, §1.3's frozen baseline can never be recomputed and every
   published number becomes unfalsifiable — rule 12's spirit, violated by the storage layer. §6.2's
   committed cache nearly fixes it; make it sufficient by committing an **hourly roll-up**
   (`hour × model × agentId → five class totals + request count`, a few hundred KB) from which C/H,
   $/agent-hour and both G1 readings for any past window can be rebuilt without the transcripts.
9. **The 25 s budget has 2× headroom, not 2.8×.** My equivalent full parse of 416 files — same line
   parse, same id map — took **12.5 s** wall against the plan's 8.85 s on a tree 6 % smaller. §10.3's
   own fallback is the right one: build the cache **last**, and be prepared to ship `--full`-only.
10. **`separate_critic` is measurable but not "provable without trusting prose".** `tools/ownership.mjs`
    reads `orchestration/status/*.json` — which agents write about themselves. Two distinct declared
    task ids is far better evidence than a grep for a word, so ship it; word the ledger as
    "distinct declared task ids", not "provable".
11. **Strike §9's second justification for Sonnet.** "Generates a data point about that lever" is
    worth nothing: at CV 0.93, **55 runs per arm** are needed to see even a 50 % effect. One build
    carries no information about routing, and offering it as evidence is the anecdote-for-measurement
    substitution §5.3 exists to forbid. The routing axis alone justifies the choice — see §11.4.3.
12. **G2b's gate is under-budgeted.** §4.3 prices a re-grade at "~$13"; measured critic runs mean
    **$12.81** with **CV 0.768** and a long right tail. Budget the gate at ~$30 or it will be skipped
    at precisely the moment a change looks good.

---

## 11.3 What I attacked and could not break

Recorded because a critic who reports only hits is describing its own search, not the document.

- **The 9.3 % orchestrator share** — I get **9.26 %** ($544.81 of $5,880.99 at that pass). Holds.
- **The workflow mirror is a pure mirror** — 1,045 shared ids, **0 unique**. Excluding it is safe.
- **Dedup never false-merges** — **0 ids appear under more than one `agentId`**, and **0 ids carry
  more than one `requestId`**. The dedup key is sound; only the *selection rule* is wrong (B1).
- **`ephemeral_5m + ephemeral_1h == cache_creation_input_tokens`** — 0 exceptions, as claimed.
- **`usage.iterations` sums to the top-level figures** — 13,152 present, **0 mismatches**; ignoring
  it is correct.
- **40 `<synthetic>` records** — exactly as stated.
- **The 238-runs-per-arm arithmetic** — `n = 2(z₀.₀₂₅+z₀.₂)²CV²/δ²` with CV 0.97 gives 236; my
  measured CV 0.933 gives 219. The formula and the conclusion are right.
- **The 2.8× volume target** — 0.25 ÷ 0.719 = 0.348 ⇒ **2.88×**. Right.
- **The price-vector shape `base × [1, 1.25, 2, 0.1, 5]`** — holds for Opus 5, Sonnet 5, Haiku 4.5
  *and* Fable 5 ($10/$50). §0.3's proposal to assert it and fail loudly is well-founded.
- **The 98.39 % cache-hit ratio** — I get **0.98394**. Identical.
- **Run duration median 34 min** — I get **33.9**.

---

## 11.4 The three rulings the orchestrator asked for. All reversible.

### 11.4.1 Ruling P1 — **`COST.md` Ruling C2 is UPHELD in substance and AMENDED in specification.**

**Upheld:** G1 is the **median**, not the mean, plus the fraction of hours below the floor. C2's
reasoning is correct and I would have ruled the same way unprompted — a guard a burst can satisfy is
not guarding, and choosing the statistic after seeing which passes is the inert control in another
costume.

**Amended, because C2 names a statistic without naming its series (BLOCKING 4).** The median is
**12.5** or **11** depending on a choice C2 does not make. I rule:

> **G1 is measured over the same hour set as H — the 52 active clock hours — using the *requesting*
> reading, with the *present* reading published beside it. Baseline: median 12.5, floor met;
> 24 of 52 active hours (46.2 %) below the floor; present-reading median 13. The binding guard is
> that the below-floor fraction must not increase.**

**The principle, stated before the numbers rather than after them:** §1.2's own argument is that
numerator and denominator must never disagree about what an hour is. A guard measured in hours is
subject to the identical constraint. Publishing "median 11 over 63 span hours" beside "C/H over 52
active hours" is reading two clocks and calling it one scorecard. This is a principle about *which
hours exist*, not about which number is prettier — and I apply it knowing it flips G1 from breach to
pass, which I dislike and cannot honestly avoid.

**What changes:** on this reading the baseline **passes** G1, where C2 concluded it fails. That
reverses C2's factual conclusion while keeping its methodological core intact — and the 46.2 %
below-floor fraction is a far more honest description of this fleet than either "13.10, ok" or
"fails" was.

**Falsifier:** if 46.2 % of active hours below the floor is judged too lax a starting state, the
alternative is to use the **span** hour set for *both* G1 and C/H — but then C/H must be republished
at **$96.63/h** on 63 span hours, and §1.2's decisive objection returns: switching the fleet off
would improve the headline. Whoever overturns this must move both numbers, not one.

### 11.4.2 Ruling P2 — **G3 ships as `unmeasured`, not as passing. UPHELD without qualification.**

The plan is right and the argument is airtight: a guard whose only measurement is a grep for its own
name is maximally gameable by the process it constrains, and `delete-the-fix` in 59 files against
2 of 95 verdicts carrying a parseable header is not a measurement. A green tick for four of five
would be a fabricated guard on the page the owner actually reads, and this project has already
shipped an instrument that passed against an empty register.

Two refinements, neither blocking: ship `separate_critic` with the wording of CARRIED 10; and dispatch
the verdict-template piece (§4.4's third bullet) **now** rather than "eventually", because G3 is the
guard the whole efficiency programme is supposed to protect and it is currently four-fifths dark —
the longer it stays dark, the longer any cost saving is unfalsifiable in the dimension that matters
most. **Falsifier:** a machine-readable rigour block landing in the verdict template, at which point
the four flip from `null` to counted and this ruling expires by itself.

### 11.4.3 Ruling P3 — **Sonnet build / Opus critic: UPHELD, conditional on BLOCKING 1 and 2 landing first.**

Against the adopted axis — *is the acceptance decidable without judgement?* — the build passes:
`--self-test` prints 6/6 and exits 0, the headline fixture is $74.80 on a calculator, and six
deliberate breaks must each go red. Nothing in that requires judgement. The measurement *design*,
which does, was done here in Opus. Correctly routed.

**But the axis has a blind spot this piece has just demonstrated, and it must be named.** The axis
asks whether the acceptance is *decidable*; it does not ask whether the acceptance is *complete*.
BLOCKING 1 is a specification defect that a faithful builder would implement wrongly and that all six
declared arms would wave through. A decidable-but-incomplete acceptance routed to a cheaper model
does not produce a cheap correct build — it produces a cheap confident wrong one, at a discount.
**So the general rule, which I am ruling and which generalises beyond this piece: route on the
acceptance being decidable *and* complete — complete meaning every defect known to exist in the data
has an arm that goes red on it.** Here that is one extra fixture (N7) and one extra break.

**Therefore:** with N7 landed and the dedup rule stated as element-wise max, **Sonnet**. Without them,
Opus, because the build would then be re-deriving the measurement rather than implementing it.

**The reflexivity, faced squarely.** This is the piece that measures whether such routing works, so a
routing mistake here is invisible to the instrument meant to catch it — and worse, per CARRIED 11, at
CV 0.93 a single build tells us nothing either way. The honest position: this ruling rests entirely
on the *a priori* axis, and **no evidence about routing will come out of this piece at all**. Anyone
citing this build as a data point about model mix is misusing it.

**Falsifier:** if the build critic finds the Sonnet build defective on measurement *judgement* rather
than mechanics, the re-build goes to Opus and the completeness clause above becomes the standing
routing rule rather than a ruling on one piece.

---

## 11.5 The critique's own weak joint

Rule 23 cuts both ways, so: **the reading I am least sure of is BLOCKING 5.** I claim C/H and
$/agent-hour are both monotone in idleness and therefore reward slowness. That is arithmetically
true, but I have not shown that this fleet *can* slow down in the relevant way — a slower fleet
plausibly also holds more agents alive, which moves agent-hours and the numerator together in ways I
have not modelled. I have asked for counters rather than a redefinition of the bar precisely because
I am not confident enough to move the bar. If the build finds `runs_per_active_hour` stable across
every window, BLOCKING 5 is a theoretical hazard rather than a live one and should be downgraded to
CARRIED by the build critic, with the number.

**Second weakest: the role classification behind CARRIED 3 and 5** is a keyword match on
`.meta.json` descriptions, and 259 of 403 runs fall in `other`. The pooled-CV result is robust to
that (the pooled figure equals the overall figure, so no plausible reclassification rescues
stratification), but the **critic share of 23.4 %** — and therefore the 0.719 mix factor — would move
if `other` hides many critics. It would move *upward*, making the mix lever smaller and the 2.88×
volume requirement larger, so the plan's conclusion is safe in the direction the error runs.
