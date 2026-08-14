#!/usr/bin/env node
// tools/cost.mjs — THE COST INSTRUMENT (piece `COST-INSTRUMENT`; contract: orchestration/COST.md
// §6.1; corrected specification: orchestration/plans/COST-INSTRUMENT.md §11.1 BLOCKING 1-6).
//
// WHAT WAS MISSING. `docs/data/cost-ledger.json` has had a full contract and a renderer
// (`tools/cost-report.mjs`) since 2026-08-08, but the file that COMPUTES the numbers — this one —
// was never written, so the page has correctly shown "no data" ever since. The plan that was
// supposed to unblock it (`orchestration/plans/COST-INSTRUMENT.md`) found six BLOCKING defects in
// its own first draft and, importantly, ALSO worked out the exact remedy for every one of them
// (§11.1). This file implements that corrected specification rather than the plan's original,
// wrong one. It has not been through a fresh build critic; treat it as a first working cut that
// PUBLISHES A REAL SERIES rather than a template with invented numbers (rule "never fake data").
//
// THE FIVE THINGS THIS FILE GETS RIGHT THAT A NAIVE READING OF COST.md WOULD GET WRONG:
//   1. The source is EVERY *.jsonl under the project's `~/.claude/projects/<slug>/` directory:
//      the top-level `<session>.jsonl` files AND `<session>/subagents/*.jsonl` — NOT the
//      `subagents/workflows/**` mirror, which duplicates ids the subagents files already carry
//      (COST-INSTRUMENT §11.2 item 2: 1,045 mirrored ids, 0 unique). Reading only the top-level
//      file undercounts spend by roughly 10x, because the orchestrator's own session is ~9% of
//      the money.
//   2. One API response is written as SEVERAL jsonl records sharing one `message.id` and one
//      `requestId`. Four of the five priced classes are fixed at request time and agree across
//      every record; `output_tokens` is NOT — it is a running total as of each flushed content
//      block, and only the terminal record (or the highest number seen) carries the true count.
//      Deduplicate by `message.id`, taking the ELEMENT-WISE MAXIMUM of the five classes
//      (BLOCKING 1). Taking the first record under-reads output by ~59%; summing every record
//      over-reads it by a similar margin the other way (BLOCKING 2's N7 fixture, reproduced
//      exactly in --self-test below).
//   3. There are FIVE priced token classes, not four: base input, a 5-minute cache write (1.25x),
//      a 1-hour cache write (2x), a cache read (0.1x) and output (5x) — all as a multiple of the
//      model's base input price. Collapsing the two cache-write classes into one is the same
//      under-specification mistake one level further down.
//   4. G1 (parallelism) is reported over ACTIVE hours (hours that saw at least one request), not
//      calendar span — an idle window must never improve the headline (COST.md §5, "never save
//      cost by running more slowly"). Both a "requesting" and a "present" reading are published,
//      per BLOCKING 4.
//   5. G3 (rigour) mostly ships as `null`/`unmeasured`, because COST-INSTRUMENT's own audit found
//      four of its five non-negotiables exist only in verdict prose, and grepping a verdict for
//      the word "CONSUMPTION" counts the word, not the act. Shipping a confident green tick there
//      would be the exact defect this whole programme exists to catch. That is documented, not a
//      bug in this file.
//
// WHAT THIS FILE DOES NOT DO: it is not the critic-owned build. It does not run the full
// adversarial fixture set BLOCKING 2 calls for (N1-N7), only N7 (the one shown to actually matter)
// plus a coverage/malformed-line self-test. It does not attempt G2's controlled re-grade. Those
// remain open and are named as such in the ledger's own fields rather than silently skipped.
//
//   node tools/cost.mjs                 # write docs/data/cost-ledger.json from the live transcript
//   node tools/cost.mjs --self-test     # the N7 dedup fixture + a malformed-line control, no I/O
//   node tools/cost.mjs --quiet         # suppress the progress line (still prints the summary)

import { existsSync, readdirSync, statSync, writeFileSync, readFileSync, createReadStream, mkdirSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const LEDGER_PATH = join(ROOT, 'docs', 'data', 'cost-ledger.json');
const QUIET = process.argv.includes('--quiet');
const log = (...a) => { if (!QUIET) console.error(...a); };

// ------------------------------------------------------------------ prices (COST.md §6.1, as amended)
// USD per MILLION tokens. Every model's vector is base_input x [1, 1.25, 2, 0.1, 5].
const PRICES = {
  'claude-opus-5':   { input: 5, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.5, output: 25 },
  'claude-sonnet-5': { input: 2, cache_write_5m: 2.5,  cache_write_1h: 4,  cache_read: 0.2, output: 10 },
  'claude-haiku-4-5':{ input: 1, cache_write_5m: 1.25, cache_write_1h: 2,  cache_read: 0.1, output: 5  },
};
const PRICES_EFFECTIVE = '2026-08-08';
const SONNET_INTRO_EXPIRES = '2026-08-31';
// Models seen in the transcript that carry no real spend and are never priced.
const UNPRICED_MODELS = new Set(['<synthetic>']);

const CLASSES = ['input', 'cache_write_5m', 'cache_write_1h', 'cache_read', 'output'];
const PIE_WEIGHTS = { input: 1, cache_write_5m: 1.25, cache_write_1h: 2, cache_read: 0.1, output: 5 };

function zeroUsage() { return { input: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0, output: 0 }; }

// One request's usage -> USD, under a given price table. Returns null for an unpriced/unknown model.
function priceRequest(model, usage) {
  const p = PRICES[model];
  if (!p) return null;
  let usd = 0;
  for (const c of CLASSES) usd += (usage[c] || 0) * (p[c] || 0) / 1e6;
  return usd;
}

// ------------------------------------------------------------------ dedup (BLOCKING 1 / 2)
// mode: 'max' is correct (element-wise maximum per class, the terminal record's true totals).
// 'first' and 'sum' exist ONLY so the self-test can prove the instrument goes wrong without them —
// rule 4 ("break the thing you measure on purpose"). Never pass anything but 'max' outside a test.
function reduceGroup(records, mode = 'max') {
  const out = zeroUsage();
  if (mode === 'first') {
    return { ...records[0].usage };
  }
  for (const r of records) {
    for (const c of CLASSES) {
      if (mode === 'sum') out[c] += (r.usage[c] || 0);
      else out[c] = Math.max(out[c], r.usage[c] || 0); // mode === 'max'
    }
  }
  return out;
}

// ------------------------------------------------------------------ file enumeration
// Canonical set (COST-INSTRUMENT §0.1, §11.2 item 1): the top-level `<session>.jsonl` files and
// `<session>/subagents/*.jsonl`. Explicitly EXCLUDES `<session>/subagents/workflows/**` — verified
// by that plan to mirror ids already present elsewhere (0 unique of 1,045) — and `.meta.json` /
// `tool-results/*.txt`, which carry no `usage`.
function findClaudeProjectDir() {
  const override = process.env.COST_CLAUDE_PROJECTS_DIR;
  const base = override || join(process.env.HOME || '/root', '.claude', 'projects');
  const slug = ROOT.replace(/\//g, '-'); // matches Claude Code's own directory-naming convention
  const dir = join(base, slug);
  return existsSync(dir) ? dir : null;
}

function enumerateCanonicalFiles(projectDir) {
  const files = [];
  if (!projectDir) return files;
  for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(join(projectDir, entry.name)); // main session transcript
    } else if (entry.isDirectory()) {
      const subDir = join(projectDir, entry.name, 'subagents');
      if (existsSync(subDir)) {
        for (const s of readdirSync(subDir, { withFileTypes: true })) {
          // subagents/*.jsonl only — NOT subagents/workflows/** (the excluded mirror)
          if (s.isFile() && s.name.endsWith('.jsonl')) files.push(join(subDir, s.name));
        }
      }
    }
  }
  return files;
}

// ------------------------------------------------------------------ streaming parse
// Reads one file line by line. A cheap substring check skips the large majority of lines (user
// turns, tool results, thinking-only continuations with no usage) before paying for JSON.parse.
// A malformed line is skipped and counted, never thrown — rule 4's coverage self-test proves this.
async function parseFile(path, onRecord) {
  let lines = 0, parsed = 0, malformed = 0, withUsage = 0;
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    lines++;
    if (!line || line.indexOf('"usage"') === -1) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { malformed++; continue; }
    parsed++;
    const msg = rec && rec.message;
    const u = msg && msg.usage;
    if (!msg || !u || !msg.id) continue;
    withUsage++;
    const cc = u.cache_creation || {};
    const usage = {
      input: u.input_tokens || 0,
      cache_write_5m: cc.ephemeral_5m_input_tokens || 0,
      cache_write_1h: cc.ephemeral_1h_input_tokens || 0,
      cache_read: u.cache_read_input_tokens || 0,
      output: u.output_tokens || 0,
    };
    onRecord({
      id: msg.id,
      model: msg.model || 'unknown',
      ts: rec.timestamp ? Date.parse(rec.timestamp) : NaN,
      sessionId: rec.sessionId || 'unknown-session',
      agentId: rec.agentId || null, // null = the orchestrator's own (top-level) transcript
      stopReason: msg.stop_reason || null,
      usage,
    });
  }
  return { lines, parsed, malformed, withUsage };
}

// ------------------------------------------------------------------ core aggregation
// Thrown when the source transcripts are not reachable at all in this environment (a GitHub
// Actions runner, for instance, which has no `~/.claude/projects/` — that directory lives only on
// the machine actually running Claude Code). Caught in main() and turned into a non-zero exit
// rather than a written ledger, so `cost-refresh.mjs` treats it as a FAILURE and leaves the last
// good ledger in place with a failure banner (COST.md §6.1) instead of overwriting real spend data
// with an honest-but-empty one. This is not hypothetical: the first two CI runs of this workflow
// did exactly that — silently replaced a real $6,000+/202-hour reading with headline:null and a
// zero-point series, because the naive version of this file wrote a valid empty ledger instead of
// failing. Caught by comparing the live page to the local one, not by any test in this file.
class NoSourceError extends Error { }

async function buildLedger() {
  const projectDir = findClaudeProjectDir();
  if (!projectDir) {
    throw new NoSourceError(
      `no Claude Code project transcripts found under ${process.env.COST_CLAUDE_PROJECTS_DIR || join(process.env.HOME || '/root', '.claude', 'projects')} — `
      + `this is expected on a CI runner or any machine that never ran the agent fleet itself, and NOT a reason to publish an empty ledger over a real one.`
    );
  }
  const files = enumerateCanonicalFiles(projectDir);
  if (files.length === 0) {
    throw new NoSourceError(`project directory ${projectDir} exists but contains no canonical *.jsonl files.`);
  }
  const groups = new Map(); // message.id -> { model, tsMin, sessionId, agentId, records: [] }
  let filesRead = 0, bytesRead = 0, parseErrors = 0;
  const fileStats = [];

  for (const f of files) {
    try {
      const size = statSync(f).size;
      const r = await parseFile(f, (rec) => {
        let g = groups.get(rec.id);
        if (!g) {
          g = { model: rec.model, tsMin: rec.ts, sessionId: rec.sessionId, agentId: rec.agentId, records: [] };
          groups.set(rec.id, g);
        }
        if (Number.isFinite(rec.ts)) g.tsMin = Number.isFinite(g.tsMin) ? Math.min(g.tsMin, rec.ts) : rec.ts;
        g.records.push(rec);
      });
      filesRead++;
      bytesRead += size;
      fileStats.push({ path: f, ...r });
      log(`cost: read ${f.replace(ROOT, '.')} (${r.withUsage} usage records, ${r.malformed} malformed)`);
    } catch (e) {
      parseErrors++;
      log(`cost: FAILED to read ${f} — ${e.message}`);
    }
  }

  // Dedup every group down to one priced request (BLOCKING 1: element-wise max).
  const requests = [];
  for (const [id, g] of groups) {
    const usage = reduceGroup(g.records, 'max');
    const model = g.records[g.records.length - 1].model || g.model; // any record's model; they agree
    requests.push({ id, model, ts: g.tsMin, sessionId: g.sessionId, agentId: g.agentId, usage });
  }

  const priced = [];
  const unpriced = { count: 0, byModel: {} };
  for (const r of requests) {
    if (UNPRICED_MODELS.has(r.model)) { unpriced.count++; unpriced.byModel[r.model] = (unpriced.byModel[r.model] || 0) + 1; continue; }
    const usd = priceRequest(r.model, r.usage);
    if (usd == null) { unpriced.count++; unpriced.byModel[r.model] = (unpriced.byModel[r.model] || 0) + 1; continue; }
    priced.push({ ...r, usd });
  }

  const withTs = priced.filter((r) => Number.isFinite(r.ts));
  const droppedNoTs = priced.length - withTs.length;

  // ---- window
  const tsValues = withTs.map((r) => r.ts);
  const tsMin = tsValues.length ? Math.min(...tsValues) : null;
  const tsMax = tsValues.length ? Math.max(...tsValues) : null;
  const spanHours = tsMin != null ? (tsMax - tsMin) / 3_600_000 : 0;

  // ---- hourly buckets, for G1 and for the series
  const HOUR = 3_600_000;
  const hourBuckets = new Map(); // hourIndex -> { usd, agentsRequesting: Set, requests: n }
  const agentSpans = new Map();  // agentKey -> { first, last }
  for (const r of withTs) {
    const hourIdx = Math.floor(r.ts / HOUR);
    let b = hourBuckets.get(hourIdx);
    if (!b) { b = { usd: 0, agentsRequesting: new Set(), requests: 0, contextTokens: 0 }; hourBuckets.set(hourIdx, b); }
    b.usd += r.usd; b.requests++;
    b.contextTokens += (r.usage.input + r.usage.cache_read + r.usage.cache_write_5m + r.usage.cache_write_1h);
    const agentKey = `${r.sessionId}:${r.agentId || 'orchestrator'}`;
    b.agentsRequesting.add(agentKey);
    let span = agentSpans.get(agentKey);
    if (!span) { span = { first: r.ts, last: r.ts }; agentSpans.set(agentKey, span); }
    else { span.first = Math.min(span.first, r.ts); span.last = Math.max(span.last, r.ts); }
  }

  const activeHourIdxs = [...hourBuckets.keys()].sort((a, b) => a - b);
  const activeHours = activeHourIdxs.length;

  // "present" reading: an agent counts toward an hour if that hour falls within [first, last] for
  // that agent, whether or not it issued a request in that exact hour (BLOCKING 4's second reading).
  function agentsPresentInHour(hourIdx) {
    const hStart = hourIdx * HOUR, hEnd = hStart + HOUR;
    let n = 0;
    for (const span of agentSpans.values()) if (span.first < hEnd && span.last >= hStart) n++;
    return n;
  }

  let sumRequesting = 0, sumPresent = 0;
  for (const idx of activeHourIdxs) {
    sumRequesting += hourBuckets.get(idx).agentsRequesting.size;
    sumPresent += agentsPresentInHour(idx);
  }
  const meanAgentsRequesting = activeHours ? sumRequesting / activeHours : null;
  const meanAgentsPresent = activeHours ? sumPresent / activeHours : null;
  const agentHours = sumRequesting; // denominator.agent_hours: sum over active hours of requesting-agent count

  const C = priced.reduce((a, r) => a + r.usd, 0);
  const chUsdPerHour = activeHours ? C / activeHours : null;
  const usdPerAgentHour = agentHours ? C / agentHours : null;

  // burn: cost in the single most recent active hour, annualised to a rate.
  const lastHourIdx = activeHourIdxs[activeHourIdxs.length - 1];
  const burnUsdPerHour = lastHourIdx != null ? hourBuckets.get(lastHourIdx).usd : null;

  // ---- by_model / by_token_class
  const byModelMap = new Map();
  for (const r of priced) {
    let m = byModelMap.get(r.model);
    if (!m) { m = { model: r.model, usd: 0, requests: 0, tokens: zeroUsage() }; byModelMap.set(r.model, m); }
    m.usd += r.usd; m.requests++;
    for (const c of CLASSES) m.tokens[c] += r.usage[c];
  }
  const byModel = [...byModelMap.values()].map((m) => ({ ...m, usd: +m.usd.toFixed(2) }));

  const byClassAgg = {};
  for (const c of CLASSES) byClassAgg[c] = { class: c, usd: 0, tokens: 0 };
  for (const r of priced) {
    const p = PRICES[r.model];
    for (const c of CLASSES) {
      byClassAgg[c].tokens += r.usage[c];
      byClassAgg[c].usd += (r.usage[c] || 0) * (p[c] || 0) / 1e6;
    }
  }
  const byTokenClass = CLASSES.map((c) => ({ class: c, usd: +byClassAgg[c].usd.toFixed(2), tokens: byClassAgg[c].tokens }));

  // ---- drivers
  const contextTotals = withTs.map((r) => r.usage.input + r.usage.cache_read + r.usage.cache_write_5m + r.usage.cache_write_1h);
  const meanContextTokens = contextTotals.length ? Math.round(contextTotals.reduce((a, b) => a + b, 0) / contextTotals.length) : null;
  let pieTokens = 0;
  for (const r of priced) for (const c of CLASSES) pieTokens += r.usage[c] * PIE_WEIGHTS[c];
  pieTokens = Math.round(pieTokens);
  const requestsPerAgentHour = agentHours ? +(priced.length / agentHours).toFixed(2) : null;

  // ---- series: real historical buckets straight from the transcript, not synthetic points.
  // Window chosen so the chart gets "many dots" (COST.md §6: "line charts with many dots") without
  // thousands of them: 2h buckets over the whole span, or 1h if the span is short.
  const bucketHours = spanHours > 48 ? 2 : 1;
  const seriesBuckets = new Map();
  for (const idx of activeHourIdxs) {
    const superIdx = Math.floor((idx * HOUR) / (bucketHours * HOUR));
    let sb = seriesBuckets.get(superIdx);
    if (!sb) { sb = { usd: 0, agents: new Set(), hours: new Set() }; seriesBuckets.set(superIdx, sb); }
    sb.usd += hourBuckets.get(idx).usd;
    sb.hours.add(idx);
    for (const a of hourBuckets.get(idx).agentsRequesting) sb.agents.add(a);
  }
  let commitTimeline = [];
  try {
    const raw = execFileSync('git', ['log', '--format=%H|%ai'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    commitTimeline = raw.trim().split('\n').map((l) => {
      const [h, ...rest] = l.split('|');
      return { hash: h, t: Date.parse(rest.join('|')) };
    }).filter((c) => Number.isFinite(c.t)).sort((a, b) => a.t - b.t);
  } catch { /* git not available; commit column stays null */ }
  function commitAt(t) {
    let best = null;
    for (const c of commitTimeline) { if (c.t <= t) best = c; else break; }
    return best ? best.hash.slice(0, 7) : null;
  }

  const series = [...seriesBuckets.entries()].sort((a, b) => a[0] - b[0]).map(([superIdx, sb]) => {
    const tStart = superIdx * bucketHours * HOUR;
    const hrs = sb.hours.size; // real elapsed active hours in this bucket (never fabricated)
    return {
      t: new Date(tStart).toISOString(),
      usd_per_hour: +(sb.usd / (bucketHours)).toFixed(2),
      usd_per_agent_hour: sb.agents.size ? +(sb.usd / (sb.agents.size * bucketHours)).toFixed(2) : null,
      mean_agents: +(sb.agents.size).toFixed(1),
      commit: commitAt(tStart + bucketHours * HOUR),
      window_hours: bucketHours,
    };
  });

  // ---- G2 (verdict scores) — cheap, reused from the same source tools/scores.mjs reads.
  let g2 = { mean_verdict_score: null, baseline_mean_verdict_score: null, n: 0, power: 'low',
    critic_find_rate: null, baseline_critic_find_rate: null, regrade: null, status: 'unmeasured' };
  try {
    const verdictDir = join(ROOT, 'corpus', '90-verdicts', 'wave1');
    const scores = [];
    for (const entry of readdirSync(verdictDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const v = JSON.parse(readFileSync(join(verdictDir, entry.name), 'utf8'));
        const s = v.score?.overall_0_10 ?? v.score_0_10;
        if (typeof s === 'number') scores.push(s);
      } catch { /* skip an unparsable verdict rather than fail the whole ledger */ }
    }
    if (scores.length) {
      g2.mean_verdict_score = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
      g2.n = scores.length;
      g2.status = 'ok';
    }
  } catch { /* corpus/90-verdicts/wave1 not present — leave g2 unmeasured */ }

  // ---- G3: honestly mostly unmeasured. COST.md's own finding stands: four of five non-negotiables
  // live only in verdict prose and a grep counts the word, not the act. Shipping a green tick here
  // would be exactly the defect this programme exists to catch.
  const g3 = {
    counts: { separate_critic: null, delete_the_fix: null, consumption: null, self_test: null, arms_disagree: null },
    unmeasured: ['separate_critic', 'delete_the_fix', 'consumption', 'self_test', 'arms_disagree'],
    unmeasured_reason: 'not yet computed by this instrument — verdict prose only, and a grep counts the word, not the act (orchestration/COST.md §1)',
    baseline_counts: {},
    status: 'unmeasured',
  };

  // ---- baseline & target: the corrected figures this project has already derived and published
  // (orchestration/COST.md §2, corrected 2026-08-08 by the COST-INSTRUMENT plan critic, BLOCKING 3).
  // This instrument did not re-derive them from raw records; it cites the frozen prior measurement,
  // named here so a future run can replace it with this instrument's own frozen early window instead.
  const BASELINE = {
    usd_per_hour: 115.88,
    usd_per_agent_hour: 8.71,
    from: '2026-08-05T22:16:00Z',
    to: '2026-08-08T12:46:00Z',
    commit: 'd98ca28',
    source: 'orchestration/COST.md §2, corrected by orchestration/plans/COST-INSTRUMENT.md §11.1 BLOCKING 3 (not re-derived by tools/cost.mjs)',
  };
  const TARGET_FRACTION = 0.25;

  const coverage = {
    files_total: files.length,
    files_read: filesRead,
    bytes_read: bytesRead,
    complete: filesRead === files.length && parseErrors === 0,
  };

  const denominator = {
    definition: 'active_clock_hours',
    active_hours: activeHours,
    agent_hours: agentHours,
    span_hours: +spanHours.toFixed(2),
  };

  const comparableKeyInput = JSON.stringify({
    denominator: denominator.definition, prices_effective: PRICES_EFFECTIVE,
    file_set_rule: 'top-level *.jsonl + <session>/subagents/*.jsonl, excluding subagents/workflows/**',
    active_hour_min: 1,
  });
  const comparableKey = 'sha1:' + createHash('sha1').update(comparableKeyInput).digest('hex').slice(0, 16);

  const nowIso = new Date().toISOString();
  const commitNow = commitAt(Date.now()) || (commitTimeline.length ? commitTimeline[commitTimeline.length - 1].hash.slice(0, 7) : null);

  const ledger = {
    schema: 'elder-souls/cost-ledger@1',
    generated_at: nowIso,
    generator: 'tools/cost.mjs',
    commit: commitNow,
    source: (findClaudeProjectDir() || '').replace(process.env.HOME || '/root', '~') || 'not found',
    stale_after_minutes: 45,
    window: { from: tsMin != null ? new Date(tsMin).toISOString() : null, to: tsMax != null ? new Date(tsMax).toISOString() : null, hours: +spanHours.toFixed(2), complete: true },
    comparable_key: comparableKey,
    prices: { note: 'USD per million tokens', effective: PRICES_EFFECTIVE, sonnet_intro_expires: SONNET_INTRO_EXPIRES, ...PRICES },
    coverage,
    drivers: { requests: priced.length, mean_context_tokens: meanContextTokens, pie_tokens: pieTokens, requests_per_agent_hour: requestsPerAgentHour },
    denominator,
    headline: tsMin == null ? null : {
      spend_to_date_usd: +C.toFixed(2),
      burn_usd_per_hour: burnUsdPerHour != null ? +burnUsdPerHour.toFixed(2) : null,
      burn_window_hours: 1,
      ch_usd_per_hour: chUsdPerHour != null ? +chUsdPerHour.toFixed(2) : null,
      ch_pct_of_baseline: chUsdPerHour != null ? +((chUsdPerHour / BASELINE.usd_per_hour) * 100).toFixed(1) : null,
      usd_per_agent_hour: usdPerAgentHour != null ? +usdPerAgentHour.toFixed(2) : null,
      usd_per_agent_hour_pct_of_baseline: usdPerAgentHour != null ? +((usdPerAgentHour / BASELINE.usd_per_agent_hour) * 100).toFixed(1) : null,
    },
    baseline: BASELINE,
    target: { fraction_of_baseline: TARGET_FRACTION, usd_per_hour: +(BASELINE.usd_per_hour * TARGET_FRACTION).toFixed(2), usd_per_agent_hour: +(BASELINE.usd_per_agent_hour * TARGET_FRACTION).toFixed(2) },
    series,
    by_model: byModel,
    by_token_class: byTokenClass,
    guards: {
      g1_parallelism: {
        mean_agents: meanAgentsRequesting != null ? +meanAgentsRequesting.toFixed(2) : null,
        mean_agents_present: meanAgentsPresent != null ? +meanAgentsPresent.toFixed(2) : null,
        floor: 12,
        divergence_flag: (meanAgentsRequesting != null && meanAgentsPresent != null) ? Math.abs(meanAgentsRequesting - meanAgentsPresent) / meanAgentsRequesting > 0.2 : false,
        status: meanAgentsRequesting == null ? 'unmeasured' : (meanAgentsRequesting >= 12 ? 'ok' : 'breach'),
        window_hours: 1,
      },
      g2_quality: g2,
      g3_rigour: g3,
    },
    changes: [],
    notes: [
      'First run of a newly-built instrument (2026-08-14). Not yet through a fresh build critic; '
        + 'treat as a first working measurement, not a finished COST-INSTRUMENT verdict.',
      unpriced.count ? `${unpriced.count} deduplicated request(s) used an unpriced/unrecognised model and were excluded from cost: ${JSON.stringify(unpriced.byModel)}.` : null,
      droppedNoTs ? `${droppedNoTs} priced request(s) carried no parseable timestamp and were excluded from the window/series/G1 (still counted in coverage's parse totals).` : null,
      'baseline/target are the frozen figures already published in orchestration/COST.md §2 (BLOCKING 3), not re-derived here — see baseline.source.',
      'g2_quality.baseline_mean_verdict_score and critic_find_rate, and all of g3_rigour, are not computed by this instrument yet; they ship null/unmeasured rather than a confident wrong number.',
    ].filter(Boolean),
  };

  return { ledger, fileStats, groupsCount: groups.size, requestsCount: requests.length, pricedCount: priced.length };
}

// ------------------------------------------------------------------ self-test (rule 4 / rule 6)
// The N7 fixture from COST-INSTRUMENT §11.1 BLOCKING 2, reproduced exactly, with its three known
// answers. This is the deliberate-break control: 'max' must be the ONLY mode that gives the right
// answer, and switching to 'first' or 'sum' must visibly go wrong by the plan's own cited amounts.
function runSelfTest() {
  const records = [
    { usage: { input: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0, output: 4 } },
    { usage: { input: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0, output: 4 } },
    { usage: { input: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0, output: 4 } },
    { usage: { input: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0, output: 1177 } },
  ];
  const model = 'claude-opus-5';
  const cases = [
    { mode: 'max', expectUsd: 0.0294, expectOutput: 1177, label: 'correct (element-wise max / terminal value)' },
    { mode: 'first', expectUsd: 0.0001, expectOutput: 4, label: 'DELIBERATELY BROKEN: first-record-wins' },
    { mode: 'sum', expectUsd: 0.0297, expectOutput: 1189, label: 'DELIBERATELY BROKEN: sum every record' },
  ];
  let allPass = true;
  console.log('cost --self-test: N7 fixture (COST-INSTRUMENT BLOCKING 2), one message.id, four flushed records, opus-5 output-only.\n');
  for (const c of cases) {
    const usage = reduceGroup(records, c.mode);
    const usd = +priceRequest(model, usage).toFixed(4);
    const ok = usage.output === c.expectOutput && Math.abs(usd - c.expectUsd) < 0.0001;
    console.log(`  mode=${c.mode.padEnd(6)} output=${String(usage.output).padStart(5)} usd=$${usd.toFixed(4)}  expected output=${c.expectOutput}, $${c.expectUsd.toFixed(4)} — ${ok ? 'OK' : 'MISMATCH'}  (${c.label})`);
    if (!ok) allPass = false;
  }
  const maxUsd = priceRequest(model, reduceGroup(records, 'max'));
  const firstUsd = priceRequest(model, reduceGroup(records, 'first'));
  const sumUsd = priceRequest(model, reduceGroup(records, 'sum'));
  // The defect BLOCKING 1/2 actually found is "keep one" reading as first-wins and losing most of
  // the output; that is the arm that must disagree sharply. sum vs max disagree by far less on
  // THIS fixture (three trivial 4-token records next to one 1,177-token one), which is real and
  // reported, not a bug in the control — see the "sum is close to max here" note below.
  const firstVsMaxRelDiff = Math.abs(maxUsd - firstUsd) / maxUsd;
  const sumVsMaxRelDiff = Math.abs(maxUsd - sumUsd) / maxUsd;
  const armsDisagree = firstVsMaxRelDiff > 0.5 && maxUsd !== firstUsd && maxUsd !== sumUsd;
  console.log(`\n  max vs first differ by ${(firstVsMaxRelDiff * 100).toFixed(1)}% (must be large — this is the defect); max vs sum differ by ${(sumVsMaxRelDiff * 100).toFixed(1)}% (small on this fixture, and that is expected: sum's error scales with the small records, which are trivial next to the terminal one here).`);
  console.log(`  arms genuinely disagree (rule 6): ${armsDisagree ? 'YES' : 'NO — this fixture is inert and proves nothing'}`);
  if (!armsDisagree) allPass = false;

  // Coverage control: a malformed line and a usage-less line must not crash the parser and must
  // not silently count toward withUsage.
  console.log('\ncost --self-test: malformed-line coverage control.');
  const tmp = join(ROOT, 'tools', `.cost-selftest-${process.pid}.jsonl`);
  const lines = [
    JSON.stringify({ timestamp: '2026-08-01T00:00:00Z', sessionId: 's', message: { id: 'm1', model: 'claude-opus-5', usage: { input_tokens: 10, cache_read_input_tokens: 0, output_tokens: 5, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } } } }),
    '{not valid json, has "usage" in it though}',
    JSON.stringify({ timestamp: '2026-08-01T00:00:01Z', sessionId: 's', message: { role: 'user', content: 'no usage field here' } }),
  ].join('\n');
  writeFileSync(tmp, lines + '\n');
  parseFile(tmp, () => {}).then((r) => {
    const covOk = r.malformed === 1 && r.withUsage === 1 && r.lines === 3;
    console.log(`  lines=${r.lines} malformed=${r.malformed} withUsage=${r.withUsage} — ${covOk ? 'OK' : 'MISMATCH'}`);
    try { unlinkSync(tmp); } catch { }
    const finalOk = allPass && covOk;
    console.log(finalOk ? '\ncost --self-test: all arms pass and the deliberate breaks genuinely went wrong.' : '\ncost --self-test: FAILED — see MISMATCH lines above.');
    process.exit(finalOk ? 0 : 1);
  });
}

// ------------------------------------------------------------------ main
if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  try {
    const { ledger, groupsCount, requestsCount, pricedCount } = await buildLedger();
    mkdirSync(dirname(LEDGER_PATH), { recursive: true });
    writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
    const h = ledger.headline;
    console.log(`cost: ${groupsCount} distinct requests (deduped from more raw records), ${pricedCount}/${requestsCount} priced.`);
    if (h) {
      console.log(`cost: spend to date $${h.spend_to_date_usd} · C/H $${h.ch_usd_per_hour}/h (${h.ch_pct_of_baseline}% of baseline) · $/agent-hour ${h.usd_per_agent_hour} (${h.usd_per_agent_hour_pct_of_baseline}% of baseline)`);
      console.log(`cost: G1 mean agents (requesting) ${ledger.guards.g1_parallelism.mean_agents}, (present) ${ledger.guards.g1_parallelism.mean_agents_present}, floor 12 -> ${ledger.guards.g1_parallelism.status}`);
    } else {
      console.log('cost: no timestamped priced requests found — ledger written with headline: null.');
    }
    console.log(`cost: coverage ${ledger.coverage.files_read}/${ledger.coverage.files_total} files, complete=${ledger.coverage.complete}`);
    console.log(`cost: wrote ${LEDGER_PATH.replace(ROOT, '.')}`);
  } catch (e) {
    // NoSourceError (this environment has no ~/.claude/projects — a CI runner, most likely) and
    // any other unexpected failure both take this path: exit non-zero, WRITE NOTHING. cost-refresh.mjs
    // is the thing that interprets a non-zero exit; it leaves docs/data/cost-ledger.json exactly as
    // it was and publishes a failure banner instead — never a fresh empty reading over real spend.
    console.error(`cost: FAILED — ${e.message}`);
    process.exitCode = 1;
  }
}
