# External research for the cost-efficiency programme

**Task:** RESEARCH-COSTEXT01 (research agent, no repository behaviour changed). **Reads first:**
`orchestration/COST.md`, `orchestration/PLAN-LOOP.md`, `orchestration/TICK.md`, `orchestration/RULES.md`.
**Method:** WebSearch + WebFetch/curl against primary sources (Anthropic docs, arXiv abstracts) where
reachable; blog/aggregator numbers are marked as secondary and treated as lower-confidence. `curl`
via the CA bundle reached `arxiv.org` (200) but not `anthropic.com` or several independent blogs
(403/EGRESS_BLOCKED) — noted per-source below, per the brief's instruction to say what could not be
done.

Every hypothesis below is written as: **claim → source → magnitude → conditions → what would have to
be true here → cheapest single-wave experiment.** Ranking is a guess until measured, as instructed.

---

## 0. What could not be done

- `WebFetch` to `www.anthropic.com`, `simonwillison.net`, `khaledzaky.com` returned
  `EGRESS_BLOCKED`. `curl --cacert /root/.ccr/ca-bundle.crt` to `anthropic.com` (which is in the
  proxy's `noProxy` list, so it goes direct) returned HTTP 403 even with a browser user-agent —
  this reads as the site's own bot protection, not the agent proxy, since `/__agentproxy/status`
  shows no relayed failure for that host. Content from Anthropic's own engineering blog
  (`effective-context-engineering-for-ai-agents`, `managed-agents`, the multi-agent research
  writeup) is therefore reported at one remove, via WebSearch snippets and third-party
  summaries/reposts (`ai.plainenglish.io`, MarkTechPost), not read first-hand. Treat the exact
  wording of any Anthropic-attributed claim below as paraphrase until someone with a working fetch
  path confirms it against the primary page.
- `arxiv.org` abstract pages were reachable via `curl` with a browser UA (HTTP 200); full PDFs were
  not fetched — magnitudes below for arXiv papers come from the abstract text, which for every
  paper cited here already states the headline number.
- No access to a live billing dashboard or the transcript JSONL referenced in `COST.md` §2 — this
  agent did not compute anything from this repo's own data. That is the build/measurement agent's
  job; this is the citation layer it should test against.

---

## 1. Prompt caching

### 1.1 Mechanics — read from the primary Anthropic docs (`platform.claude.com`, reachable directly)

This is the one category where a primary source was reachable, so treat these numbers as high
confidence rather than blog paraphrase.

| Fact | Value |
|---|---|
| Cache read price | **0.1× base input** (e.g. Opus 5: $0.50/MTok vs $5/MTok base) |
| 5-min cache write price | **1.25× base input** |
| 1-hour cache write price | **2× base input** |
| Minimum cacheable prefix | 512 tok (Opus 5/Fable 5/Mythos 5) · 1,024 tok (Sonnet 5, Opus 4.1) · 2,048–4,096 tok (Haiku family, some older Opus) |
| Invalidation order | `tools → system → messages`; a change at any level invalidates that level and everything after it. Tool *definition* changes invalidate everything. |
| Lookback window | Cache read walks backward **at most 20 blocks** from the request's breakpoint looking for a prior write; a match outside that window is a full miss even if the exact prefix was cached minutes ago |
| Concurrency | **A cache entry is not available to a second request until the first request's response has begun streaming.** Simultaneous parallel requests sharing an identical prefix will not hit each other's cache — the first writer has to be already-in-flight before a sibling can read. |

**What would have to be true here, and why it matters more than the "measure the ratio first"
framing in `COST.md` §4.2 suggests:** the fleet dispatches **12–16 concurrent subagents**, several
of which plausibly share a large, byte-identical prefix — the same corpus files, the same rules
files, the same `CLAUDE.md`. Under the concurrency rule above, if the orchestrator dispatches a
wave in a tight burst, **none of the siblings can prime each other's cache** — every one of them
pays the 1.25×/2× write price on an identical prefix, redundantly, because none had "begun" yet
when the next one's request left. This is a testable, fleet-shaped failure mode that generic advice
("cache your system prompt") does not surface.

- **Cheapest experiment (no browser, one wave):** before the next dispatch burst, have the
  orchestrator send one throwaway `max_tokens: 0` pre-warm call (the docs' documented pattern) with
  the shared prefix and its `cache_control` breakpoint, wait for it to return, *then* dispatch the
  wave. Compare `cache_read_input_tokens` share across the wave's first requests against a wave
  dispatched without the pre-warm. If the shared prefix (rules + corpus pointers, not the
  per-agent brief, per rule 18) is stable and above the per-model minimum, this should show up as a
  step change in cache-read ratio for request #2 onward within the same wave, not just turn 2 of a
  single agent's own conversation.
- **Second, cheaper-still experiment:** confirm the ordering claim already implicit in rule 18 —
  static rules/corpus content first, per-agent brief (the part that's actually unique) last —
  is what the briefs already do. If briefs interleave stable and variable content (e.g. a
  timestamp or task-id early in the prompt), that alone caps the hit ratio regardless of
  concurrency. Auditing 3–5 recent briefs against the "static content first, mutable content last"
  rule from the docs is a text-only, sub-hour check.
- **Tripwire:** if measured `cache_read_input_tokens` share is already >70% of input volume
  (plausible if briefs are already short per rule 18 and point at stable files), this lever is
  smaller than it looks, exactly as `COST.md` §4.2 already warns — don't re-derive that warning,
  test it against it.

### 1.2 Compaction — official Anthropic Compaction API (read directly, `platform.claude.com`)

- **Claim:** Compaction summarises older context when input tokens cross a trigger (default
  150k, configurable down to 50k), extending effective context without hand-rolled truncation.
- **Magnitude:** **not quantified by Anthropic in the docs** — no published compression ratio or
  cost-savings percentage. The docs give only a worked example where the compaction call itself
  costs 180k input + 3.5k output tokens, i.e. compaction is not free and can net-lose on short
  conversations. Third-party paraphrase (not verified against the primary) claims "a two-hour
  session at 400k tokens costs roughly 2× what it costs with compaction," but this is unsourced in
  the docs page itself and should be treated as marketing until measured.
- **Cache interaction (documented, reliable):** compaction does **not** invalidate a system-prompt
  cache breakpoint placed at the end of the system block — only the new summary needs a fresh
  write. Placing the breakpoint on the conversation instead of the system prompt would force a
  full rewrite on every compaction.
- **Conditions where it is documented to hurt:** short conversations (compaction adds a pure-cost
  summarisation iteration for no gain), and any task needing verbatim recall of early content.
- **What would have to be true here:** our subagents run **single long turns of 40–260 tool
  calls**, which is exactly the shape compaction targets, but our agents are explicitly required to
  read the actual file rather than trust a summary (rule 18, rule 4 in effect) — a compacted
  summary of, say, an early tool-call's file read is precisely the kind of "trusting a summary"
  the project has repeatedly found wrong (rule 18's own text: "orchestrator summaries have been
  corrected by builders and critics dozens of times"). This is a real tension, not a free lunch:
  compaction summarises the agent's *own* trajectory, which is a different thing from an
  orchestrator's prose summary, but the failure mode (a stale or lossy paraphrase standing in for
  ground truth) is the same shape this project has already been burned by. **Flagging under §5:**
  this is not automatically out of bounds — it doesn't touch a critic or a control — but any use of
  compaction on a *critic's* turn specifically should be treated as suspect until tested, since a
  critic's entire job is reading the actual file, and a summary standing in for that read is close
  to the rule-18 failure mode it must not repeat.
- **Cheapest experiment:** compaction is currently a distinct Anthropic API surface
  (`context_management`/compaction beta), not something this harness necessarily calls today —
  first check whether the Claude Code SDK this fleet runs on exposes it at all before spending a
  wave testing it. If it does: trigger it deliberately on one long-running non-critic agent (a
  builder, not a critic), and diff its output quality against a matched agent that hit the context
  window without compaction (i.e. failed or was killed). This is a single-piece, single-wave test
  but needs a genuinely long-running agent (>150k input tokens) to reach the trigger.

---

## 2. Model routing and cascades

### 2.1 RouteLLM (LMSYS/Berkeley, arXiv 2406.18665 + project blog) — read via WebSearch snippets, not fetched directly

- **Claim:** A trained router (matrix-factorisation, on Chatbot-Arena preference data) sends easy
  queries to a weak model and hard ones to a strong model, targeting a fixed quality floor (e.g.
  90% of the strong model's win rate).
- **Magnitude:** **85% cost reduction on MT-Bench, 45% on MMLU, 35% on GSM8K**, holding ~95% of
  GPT-4's performance, with only ~14% of queries escalated to the strong model on MT-Bench.
- **Conditions:** trained on human preference-judged conversational data; the router itself needs
  training data specific to the query distribution it will route. This is the caveat that matters
  most for us — **we do not have labelled preference data for "which of our subagent turns needed
  Opus,"** so a RouteLLM-style trained router is not a drop-in; it would need to be built from our
  own verdict history first, which is itself a piece of work.
- **What would transfer without training a router:** the *rule-based* routing already proposed in
  `COST.md` §4.1 — model choice by task shape (has a landed plan + existing instrument + a
  machine-checkable acceptance → Sonnet) — is the cheap, untrained version of the same idea, and
  `PLAN-LOOP.md` already states it is barely applied (3,230 Opus vs 29 Sonnet). This paper's
  contribution to the hypothesis is a magnitude anchor: **rule-based/simple routing on easier task
  categories plausibly recovers a large fraction of an 85%-on-easy-cases saving without training
  anything**, if this fleet's task-shape split resembles MT-Bench's mix of easy/hard turns better
  than it resembles GSM8K's (harder, less amenable to routing — only 35% saved there). Our
  workload (mechanical builds with a landed plan and machine-checkable acceptance) is closer to the
  "easy, high routing yield" end than to unconstrained reasoning.
- **Cheapest experiment (already the largest known lever per `COST.md` §4.1, now with a published
  comparator):** this needs no new research, it needs the existing policy applied and measured —
  pick one wave, route every eligible build (per the `PLAN-LOOP.md` table) to Sonnet, leave every
  critic/plan/measurement-design agent on Opus, and report the C/H delta against the published
  35–85% band. If actual savings land far outside that band in either direction, that is itself a
  finding about how (un)like our workload is to MT-Bench/GSM8K.

### 2.2 RLM-Cascade — response-level speculative decoding for agentic coding (arXiv 2606.22840, abstract read directly via curl)

- **Claim:** A cheap draft model (DeepSeek) proposes a response; a lightweight complexity router
  decides whether to accept the draft outright (SKIPPED path, no Opus call), have Opus
  enhance/check it, or bypass to Opus entirely for schema-critical tool-selection turns.
- **Magnitude — this is the most directly analogous published number found:** measured **on a
  real-world Claude Code agentic coding workload**, 125 production requests: **88.8% draft-use
  rate**, **45.8% API cost reduction relative to a direct Opus baseline**, **and quality matched or
  exceeded the Opus baseline** (100% vs 95% pass rate on a 20-task Code/Math/Instruct benchmark) —
  plus a latency win (1.83× faster at p50) because the SKIPPED path dominates.
- **Conditions:** production Claude Code usage, not a research benchmark; the router is
  rule-based/complexity-based, not learned; tool-selection turns are deliberately excluded from
  the speculative path (bypassed straight to Opus) because schema correctness there is
  load-bearing.
- **What would have to be true here for it to transfer:** this is a pattern for **build-agent
  turns**, not critic turns — it is squarely inside what `COST.md` §5 permits (nothing here cuts a
  critic or a control; it changes which model proposes a build step). The self-reported quality
  parity (100% vs 95%) is the single strongest published data point in this research pass against
  the fear that cheaper-model-first necessarily costs correctness, but it is one paper's own
  benchmark, not independently replicated, and "100% vs 95% on 20 tasks" has a wide confidence
  interval at n=20 — do not treat 100% as proven ceiling.
- **Cheapest experiment:** this is a heavier lift than 2.1 because it needs a second, cheaper model
  in the loop and a router — plausibly Haiku (already flagged "unproven, trial on one mechanical
  task" in `PLAN-LOOP.md`) drafting a build, Sonnet (not Opus, to keep this cheap to test) checking
  and either accepting or escalating. Given `PLAN-LOOP.md`'s explicit caution that Haiku's first
  job should be one mechanical, measured trial, this is naturally sequenced *after* 2.1 (rule-based
  Sonnet routing), not instead of it, and should reuse whatever acceptance check that first Haiku
  trial establishes.

### 2.3 FrugalGPT (Chen, Zaharia & Zou, arXiv 2305.05176) — general cascade framework, older but foundational

- **Claim:** cascade across LLM providers of increasing cost, stopping when a cheap model's
  answer is judged adequate.
- **Magnitude:** matches best single-LLM (GPT-4-era) performance at **up to 98% cost reduction**,
  or beats it by 4% accuracy at equal cost; one concrete reported case: 80% cost cut with a **1.5%
  accuracy gain** (not just no loss).
- **Conditions:** benchmarked on discriminative QA-style tasks with a scorable answer, using an
  external small scoring model to decide "is this answer good enough" before escalating — the
  scoring step is itself a cost, not accounted for as zero in every reported number.
- **What would have to be true here:** our tasks are not single-shot QA, they're multi-hundred-tool-call
  agentic runs, so FrugalGPT's own benchmark shape does not transfer directly; it is included
  because it's the origin of the cascade idea cited by both papers above, and because its "stopping
  criterion needs a scorer, and the scorer has a cost" caveat applies just as much to any cascade
  we build (2.1/2.2 above): a routing decision is never free, and the router's own cost must be
  counted against the saving, not treated as overhead-free.
- **Not separately tested** — folded into the 2.1/2.2 experiments above rather than given its own
  wave.

### 2.4 Cost-saving cascades with early abstention (arXiv 2502.09054)

- **Claim:** allowing a cheap early-stage model to abstain (rather than only the final, expensive
  model) anticipates cases the expensive model would also fail on.
- **Magnitude:** **13.0% cost reduction and 5.0% error-rate reduction**, trading a 4.1-point rise
  in overall abstention rate, averaged across six QA/reasoning benchmarks (GSM8K, MedMCQA, MMLU,
  TriviaQA, TruthfulQA, XSum).
- **Conditions:** risk-sensitive domains (finance/medicine framing) where abstention is an
  acceptable outcome — the paper's whole point is that abstaining is better than a wrong answer at
  full cost.
- **What would have to be true here:** we have a rough analogue — **`dispatchable.mjs` reporting
  "needs-plan" before "needs-builder"**, and a plan agent's job of possibly reporting "the repair
  already landed" before a build agent is dispatched, is a form of early abstention already in the
  method (`PLAN-LOOP.md`'s own measured example: a plan found the piece already done and saved a
  full 600k build round). This paper's number is weak independent support for a policy this project
  already runs, not a new lever — noted for completeness, **not ranked separately below** since it's
  not a new hypothesis to test, it's evidence the existing plan-loop policy has outside backing.

---

## 3. Context management

### 3.1 "Less Context, Better Agents" (arXiv 2606.10209) — the strongest single data point found for this category

- **Claim:** on a 50-task enterprise tool-use benchmark (expense itemisation via MCP tools,
  GPT-5, 5 runs each config, cross-validated against Claude Sonnet 4.5), compare: no context
  management, full conversation history retained, pruning to the last 5 tool call/response pairs,
  and pruning + automated summarisation.
- **Magnitude (all four arms measured against each other, same benchmark, same model):**

  | Config | Completion | Tokens | Runtime |
  |---|---|---|---|
  | No user model (baseline) | 8.0% | — | — |
  | Full history retained | 71.0% | 1,480,996 | 14.56 h |
  | Pruned to last 5 tool calls | 79.0% | 535,274 (**−64%**) | 5.39 h |
  | Pruned + summarisation | **91.6%** | 553,374 (**−63%**) | 5.79 h |

- **Conditions:** enterprise MCP tool-use workload with verbose tool responses; explicitly a
  domain where "verbose tool responses... cause context overflow, stale-state errors, and high
  inference cost" — i.e. a workload shape close to ours (long tool-call trajectories, large
  intermediate outputs).
- **This is the one result in this whole pass where cutting tokens and improving quality moved
  the same direction at once**, not a trade-off — worth flagging because `COST.md` explicitly
  worries that "a technique that quietly costs quality shows up as a cost saving on every
  dashboard"; here the paper's own control (full-history retention) is the *worse*-performing arm,
  which is the shape of evidence this programme should be looking for, not assuming.
- **What would have to be true here for it to transfer:** our subagents already do something
  adjacent by discipline (rule 18: point at files, don't restate; read the actual file rather than
  a summary) but there is no evidence anyone has measured whether **old tool outputs mid-turn**
  (a `Read` from tool-call #12 still sitting in context at tool-call #180) are pruned or
  compacted at all, versus accumulating for the whole 40–260-call turn. If they accumulate
  unpruned, this paper's exact intervention (drop old tool call/response pairs beyond a window,
  optionally summarise them) is untested here and its magnitude (−63% tokens, **quality up**, not
  down) is the best available anchor.
- **Cheapest experiment:** instrument one long builder turn (browser-heavy, since those run
  longest per rule 21) to log context size against the wall-clock/tool-call-index at which stale
  tool outputs (e.g. an early `Read` of a large corpus file, later superseded) are still present in
  context at the final turn. If a meaningful fraction of tokens at turn end are old, superseded
  tool outputs, that's the target for a prune-old-tool-results experiment, matched against a
  control arm with no pruning, same task, same acceptance check — directly reproducing this
  paper's own 3-arm design at small scale.

### 3.2 Context rot / premature termination in long-horizon search (arXiv 2606.29718)

- **Claim:** under extensive context, models don't just get less accurate — they **give up early**
  ("premature termination"), and the termination rate correlates positively with context length.
  Parallel-sampling with behaviour-aware filtering recovers **2.6–4.9%** performance across three
  aggregation methods.
- **Conditions:** deep-search benchmarks, four flagship models, controlled for query difficulty.
- **What would have to be true here:** this is evidence *for why* rule 8 ("a still target hides
  every steering defect") and this project's own long-context critic runs might be vulnerable to
  a failure mode nobody has named yet — a critic that reads a huge reference corpus mid-turn might
  not just get slightly worse, it might quietly stop looking before it's done, which would look
  identical to "a critic that cannot find a gap" except the cause is context length, not
  diligence. **This is a quality risk, not a cost lever** — filed here because context-shortening
  interventions (3.1, RAG in 3.3) that reduce a critic's context are not just cost-neutral-or-better
  for correctness, they may specifically *reduce* this failure mode, which reframes "shrink the
  critic's context" as a possible rigour improvement rather than only a cost cut. Worth a critic
  specifically checking whether any of its own verdicts show late-turn abandonment correlated with
  context size — a cheap audit of existing verdict transcripts, no new dispatch needed.

### 3.3 RAG vs. long-context stuffing

- **Claim:** for corpora that don't fit cheaply in context or that change often, retrieval beats
  reading everything.
- **Magnitude:** secondary/blog sources (not a single controlled paper) report **60–80% token
  reduction** vs. reading full documents, and in one framing **~1,250× cheaper per query** than
  restuffing a multi-million-token archive every call. Quality note from the same search pass:
  multi-hop reasoning and cross-document synthesis show measurable drops **past ~500k tokens** even
  on 1M-context models, i.e. long-context-only degrades on exactly the kind of cross-document work
  a critic does.
- **Conditions:** these are aggregator/marketing numbers, not one peer-reviewed benchmark — lower
  confidence than 3.1. Flagged as **directionally supportive, not load-bearing** until a primary
  source is found.
- **What would transfer:** this project's corpus (`corpus/00-doctrine`, `corpus/12-weapons`, etc.)
  is exactly the kind of large, mostly-stable reference material this describes, and rule 18
  already mandates "point at files, don't restate" — which is retrieval-by-reference, the cheap
  end of this spectrum, already policy. A heavier RAG layer (embeddings, semantic search over the
  corpus rather than an agent reading whole files) is **not yet justified by any number found
  here** specific to a corpus this project's size — the 60–80%/1,250× figures are for corpora
  "over a few million tokens" or "changing daily," neither of which obviously describes a design
  corpus that's mostly settled prose. **Recommend not building a RAG layer without first measuring
  whether current full-file reads are actually the bottleneck** (see 1.1's caching experiment
  first — a cached, pointed-at file may already be cheap).

---

## 4. Techniques specific to critic/verification loops

This is the category `COST.md` is most careful about ("we will not cut them, so we need them
cheaper *per unit of rigour*, not fewer") and the one with the thinnest published evidence that
actually respects that constraint — most cost-for-verification literature reduces the verification
itself, which is explicitly out of bounds here (§5). Reporting what was found and rejected as such.

### 4.1 Cost-effective LLM-as-judge techniques (arXiv 2604.13717) — the one paper that improves accuracy at ~zero marginal cost

- **Claim:** four drop-in techniques for LLM-judge accuracy — ensemble scoring, task-specific
  criteria injection, calibration context, adaptive model escalation — tested on RewardBench 2
  across OpenAI and Anthropic model families.
- **Magnitude:** **ensembling + criteria injection together reach 85.8% judge accuracy, +13.5
  percentage points over baseline**, and criteria injection alone is described as "virtually cost
  free." Calibration context and adaptive escalation help too but are Pareto-dominated by the
  criteria+ensemble combination.
- **Conditions:** RewardBench 2, a response-ranking benchmark — not our critics' actual task (they
  read a diff/build and a spec and write a verdict against a bar), but the mechanism (criteria
  injection = telling the judge specifically what to check, rather than "review this") is directly
  testable on our own critic prompts without touching what a critic is asked to verify.
- **What would have to be true here for it to transfer, and why this is in-bounds under §5:** this
  is the one technique in this whole report that plausibly makes a critic **better per token
  spent, not merely cheaper** — criteria injection means writing sharper, more specific verdict
  criteria into the critic brief (which the plan loop already half-does via the acceptance table
  in `PLAN-LOOP.md`'s second change), at no extra dispatch cost. It does **not** propose fewer
  critics, fewer runs, or a weaker model doing the checking — squarely allowed.
- **Cheapest experiment:** take one already-run critic verdict and its plan's stated acceptance
  table; check whether the critic brief stated task-specific criteria (not just "review this
  build against the plan") as sharply as this paper's method would. If existing briefs are already
  criteria-specific (plausible, given `PLAN-LOOP.md`'s emphasis on acceptance-number-first plans),
  this technique may already be substantially captured — a text-only audit of 3–5 recent critic
  briefs against this paper's "criteria injection" definition answers it without a new dispatch.

### 4.2 Small distilled judges (Luna-2, Prometheus 2, Patronus Lynx) — found and explicitly rejected here

- **Claim (from search aggregation, not a single controlled source):** small (3B–8B) judge models
  can replace large-model judges for "high-throughput inline checking," reportedly at **97% cost
  reduction and 0.88–0.95 accuracy** relative to a large judge, reserving the large model for
  "final audits."
- **Why rejected rather than queued as a hypothesis:** this is precisely the shape `COST.md` §5
  forbids — it is a proposal to make the *critic itself* cheaper by making it a weaker model doing
  the checking, i.e. cutting the critic. The whole premise of a "high-throughput pre-screen /
  reserve the strong judge for final audit" tier is a two-stage critic where the first stage is
  allowed to miss things the way small judges (0.88–0.95 accuracy, meaning 5–12% disagreement with
  the reference judge) are documented to. `COST.md`: *"one separate critic with fresh context per
  piece"* and *"never cut a critic"* — a distilled pre-screen critic followed by a full critic only
  "if flagged" is functionally a critic that sometimes doesn't run, which is the exact failure this
  project has already priced in as unacceptable. **Explicitly marking this out of bounds**, not
  merely low-priority.

### 4.3 RLM-Cascade's SKIPPED-path pattern, reconsidered for critics specifically — rejected for the same reason

- Section 2.2's cascade is fine for **build** agents (a build accepted without Opus involvement is
  still checked by a full, separate, fresh-context critic afterward — nothing about the cascade
  weakens verification). But the same pattern applied to the **critic's own** turn — e.g. "let a
  cheap model decide whether Opus needs to review this build at all" — would collapse into 4.2's
  forbidden shape. **This report explicitly recommends the cascade only ever sit upstream of a
  critic, never inside one.**

### 4.4 What was searched for and not found

- No published, controlled study of "does caching a critic's read of a large, stable reference
  corpus (as opposed to a chat history) preserve verdict quality while cutting cost" — the closest
  is the general prompt-caching mechanics in §1.1 plus the general RAG-vs-stuffing numbers in §3.3,
  neither of which is critic-specific. This is a gap this programme could plausibly fill itself and
  publish, rather than one it can cite.
- No published study measuring whether a **separate, fresh-context critic** (this project's own
  central discipline) is more or less expensive per unit of caught defect than alternative
  verification shapes (self-critique by the same agent, majority-vote self-consistency, etc.) — the
  literature on self-consistency and self-refine exists but was not surfaced with a magnitude
  strong enough to report here in the time available; flagged as an area for a follow-up research
  pass specifically, not folded into this one to avoid reporting a claim without a number.

---

## 5. Techniques found and rejected, with reasons (as distinct from §4.2/4.3 above)

| Technique | Why rejected / not queued as a hypothesis |
|---|---|
| Small distilled judge models (§4.2) | Directly cuts critic rigour — forbidden by `COST.md` §5 |
| Cascade inside the critic's own decision to run (§4.3) | Same as above, one layer removed |
| LLMLingua-style prompt compression (up to 20× compression, <2% quality loss on GSM8K/BBH/ShareGPT/Arxiv-March23, EMNLP 2023) | Requires running a separate small compressor model (GPT2-small/LLaMA-7B) as infrastructure we don't have, and its published benchmarks are ICL/reasoning/summarisation tasks, not long agentic tool-use trajectories with code and file diffs — no evidence it preserves fidelity on the kind of exact-value, exact-path content this project's rules explicitly require (rule 12: "stamp the commit on every number"; a lossy compressor is a direct risk to that). Not ruled fully out, but ranked lowest: high build cost (new model dependency), untested domain match, and a specific tension with rules that require exact preservation of numbers and paths. |
| Batch API (50% off input+output, stacks with caching to ~95% off) | **Out of bounds under `COST.md` §5** ("never trade speed for cost") — Batch API returns results within 24 hours, incompatible with a fleet that must keep ≥12 agents running concurrently in near-real-time and never wait. Noted for completeness since it's a real, large, official discount, but explicitly not queued. |
| Agent-Omit (arXiv 2602.04284, adaptive thought/observation omission) | Requires **fine-tuning** a model (cold-start data + RL) to learn what to omit — not a prompting or orchestration change we can apply to Opus/Sonnet/Haiku as served via API. Filed as evidence that omission-of-context is a real, measured lever (comparable to seven "frontier LLM agent" baselines) but not directly actionable here. |
| Single-agent-beats-multi-agent under matched compute (arXiv 2604.02460) | Not a lever, a **caution**: under a fixed reasoning-token budget, single-agent systems matched or beat multi-agent systems on multi-hop reasoning across three model families, with reported multi-agent gains often explained by unaccounted extra computation rather than architecture. This does not argue against this project's *use* of subagents (which is for parallelism and context isolation on largely independent pieces, not multi-hop reasoning by committee on one question) but it is a real caveat against assuming "split it into more agents" is free quality — if a future lever proposes decomposing one piece into more, smaller subagents to save tokens per agent, this paper says to check the token budget is actually matched before crediting the split with a quality win. |
| Structured-output-by-default (JSON/TOON for everything) | Mixed evidence, not a clean win: one source reports JSON/TOON formats cut tokens 5–15% on structured extraction; another reports JSON mode costs *more* output tokens than free text for typical endpoints, and that forcing JSON during reasoning **degrades accuracy 10–15%** by cutting off free-form thinking before the answer. Net: worth using only where output is already schema-shaped (status files, verdict scores) — which this project already does — and actively harmful if imposed on a critic's reasoning/prose verdict. Not queued as a new hypothesis because current practice (status JSON for state, prose for verdicts) already matches the evidence-supported split. |

---

## 6. Ranked hypotheses — expected size × ease of testing (a guess, not a conclusion)

| Rank | Hypothesis | Expected size | Ease of testing | Why this rank |
|---|---|---|---|---|
| 1 | **Apply the existing rule-based model-routing policy** (build-with-landed-plan → Sonnet) that `PLAN-LOOP.md` already states and `COST.md` §2 says is "barely applied" — now anchored to RouteLLM's 35–85% published band and RLM-Cascade's 45.8%-with-quality-parity number on an *agentic coding* workload specifically | Largest of everything found — fleet is 99%+ Opus today | Easiest — no new tooling, the policy exists, it needs applying and measuring for one wave | Directly matches `COST.md`'s own §4.1 ranking; this report's job was to confirm outside evidence supports it at that magnitude, and it does, on the workload shape (agentic coding) closest to ours |
| 2 | **Prune/summarise stale tool-call context mid-turn**, per the "Less Context, Better Agents" 3-arm design (§3.1) | Large (−63% tokens in the cited paper) **and quality went up, not down** in that paper — the rare case where this isn't a trade-off | Moderate — needs instrumenting one long builder turn to find how much context is stale tool output, then a matched pruned-vs-unpruned pair | Ranked 2 not 1 because it needs new instrumentation before the experiment can even be designed, where #1 can be measured this wave with tools that already exist |
| 3 | **Fix cache-priming order across a concurrent wave burst** (§1.1) — pre-warm the shared static prefix before dispatching a burst, since concurrent requests can't hit each other's cache until the first has begun | Unknown magnitude — depends on how much of the fleet's prefix is genuinely shared and stable, and how tight dispatch bursts actually are; plausibly large given 12–16 concurrent agents, all Opus, all reading similar rules/corpus | Cheap to test — one pre-warm call plus comparing `cache_read_input_tokens` across a bursted vs. staggered wave, no new tooling | Ranked 3 not higher purely because the size is unmeasured, not because the test is hard — this is the "cheapest experiment relative to expected size" pick if #1 and #2 are already in flight |
| 4 | **Criteria-injection audit of critic briefs** (§4.1) — the one lever that improves rigour-per-token rather than trading against it | Small in tokens saved directly, but potentially valuable as a **quality** gain that also reduces re-rounds (fewer 4–6-round pieces if critics catch more on round 1) | Very cheap — text-only audit of 3–5 existing critic briefs against the paper's "criteria injection" definition, no dispatch needed | Ranked lower on raw C/H size but flagged as the one item that is unambiguously safe under §5 and cheap enough to do alongside anything else |
| 5 | **Compaction on long non-critic builder turns** (§1.2) | Unquantified by Anthropic's own docs — genuinely unknown, possibly negative on short turns | Moderate-to-hard — needs an agent that actually crosses the 150k-input trigger, and needs checking first whether this harness's SDK surface even exposes the compaction API | Ranked lowest of the "keep" list because the primary source itself declines to publish a savings number, and the failure mode (summary standing in for ground truth) rhymes with a documented project failure (rule 18) — test only after 1–4, and never on a critic turn without separate justification |

Not ranked (rejected, §5): small distilled judges, cascading inside a critic's run/no-run decision,
LLMLingua compression, Batch API, Agent-Omit, structured-output-by-default.

---

## 7. Summary for the plan/build loop that picks this up

- Two of five queued hypotheses (#1, #3) need **no new tooling** and can be measured this wave.
- One (#2) needs a small instrumentation step first (measure how much mid-turn context is stale
  tool output) before an experiment can even be designed — that instrumentation step is itself a
  cheap, no-browser piece.
- One (#4) is a text-only audit, effectively free, and is the only item here that plausibly
  improves rigour rather than only cost — worth doing regardless of what else is prioritised.
- One (#5) is explicitly sequenced last and flagged as needing extra caution specifically because
  it summarises an agent's own working context, which is close to a failure shape (rule 18) this
  project has already paid for once.
- Six techniques were found and explicitly rejected, with reasons, per the brief's requirement not
  to report only good news — three of them (§4.2, §4.3, Batch API) rejected specifically because
  they would cut verification or trade speed for cost, which `COST.md` §5 forbids outright, not
  because the evidence for them was weak.
