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
    // Q5 needs to know WHEN an agent stopped orienting and started producing, and the only honest
    // marker of that in a transcript is the first mutating tool call. The names are read off content
    // blocks that are already parsed, so this costs one array map and no extra IO.
    const tools = Array.isArray(msg.content)
      ? msg.content.filter((b) => b && b.type === 'tool_use' && b.name).map((b) => b.name)
      : [];
    onRecord({
      id: msg.id,
      model: msg.model || 'unknown',
      tools,
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

// ONE parser, one dedup, one price table, for the ledger AND for every experiment flag below.
// Extracted from buildLedger() unchanged on 2026-08-14 by COST-EXPERIMENTS-BUILD so the retrospective
// experiments (--experiments) consume the instrument rather than re-implementing it (rule 10). If you
// are tempted to write a second parser for an analysis, add a flag here instead.
async function collectPricedRequests() {
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
        if (rec.tools && rec.tools.length) { if (!g.tools) g.tools = new Set(); for (const t of rec.tools) g.tools.add(t); }
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
    requests.push({ id, model, ts: g.tsMin, sessionId: g.sessionId, agentId: g.agentId, usage, tools: g.tools ? [...g.tools] : [] });
  }

  const priced = [];
  const unpriced = { count: 0, byModel: {} };
  for (const r of requests) {
    if (UNPRICED_MODELS.has(r.model)) { unpriced.count++; unpriced.byModel[r.model] = (unpriced.byModel[r.model] || 0) + 1; continue; }
    const usd = priceRequest(r.model, r.usage);
    if (usd == null) { unpriced.count++; unpriced.byModel[r.model] = (unpriced.byModel[r.model] || 0) + 1; continue; }
    priced.push({ ...r, usd });
  }

  return { projectDir, files, fileStats, groups, requests, priced, unpriced, filesRead, bytesRead, parseErrors };
}

async function buildLedger() {
  const collected = await collectPricedRequests();
  const { projectDir, files, fileStats, groups, requests, priced, unpriced, filesRead, bytesRead, parseErrors } = collected;

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
    // The programme's ledger of changes. The instrument is still the only writer of the ledger
    // (COST.md §6.1) — it reads the experiment findings it itself computed and cached under
    // reports/cost/experiments.json via `--experiments`, rather than a second tool writing here.
    changes: readExperimentChanges(),
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

// ==================================================================================================
// RETROSPECTIVE EXPERIMENTS — piece `COST-EXPERIMENTS-BUILD`, 2026-08-14.
//
// Four questions, all answerable from banked history, none of which changes any orchestration
// behaviour or any game code. They consume the parser, dedup and price table above rather than
// re-deriving them (rule 10; COST.md §6.1 "the instrument is the only thing that computes cost").
//
//   Q1 --routing      Did routing mechanical builds to Sonnet save anything?
//   Q2 --growth       Is cost really superlinear in tool calls, and is it accumulation or workload?
//   Q3 --bursts       Confirm or overturn the C1 revert (staggered burst dispatch).
//   Q4 --attribution  Where the money actually goes, by role and by model.
//   Q5 --reorientation  What does a successor pay to pick up where a predecessor stopped? The term
//                     the split ceiling in Q2 leaves out, and the one that decides whether it is real.
//   --experiments     all five, writing reports/cost/experiments.json which the ledger's `changes`
//                     array is then built from.
//   --experiments-self-test   synthetic arms with known answers that must genuinely disagree.
//
// THE ATTRIBUTION RULE (COST.md §2) BINDS EVERY ONE OF THEM. Cost per run has CV ~0.97, so no
// conclusion here may rest on comparing dollar totals between two windows. Every number below is
// either (a) a share/proportion, (b) a counterfactual repricing of the SAME recorded token flow, or
// (c) a recomputation over a recorded per-request context curve. Where a dollar figure appears it is
// arithmetic on a fixed flow, never a between-window difference.
// ==================================================================================================

const EXPERIMENTS_DIR = join(ROOT, 'reports', 'cost');
const EXPERIMENTS_PATH = join(EXPERIMENTS_DIR, 'experiments.json');
// NOT under reports/ — `reports/.gitignore` excludes every .json there by design (run artifacts are
// large and reproducible), and this file is neither: it is authored narrative that no tool can
// regenerate. Left in reports/ it would be absent from a fresh clone, the ledger's `changes` array
// would silently regenerate EMPTY on the next bank, and the programme's negative evidence would
// disappear from the page — the same defect that made 56 of 76 verdicts fail a real checkout while
// passing on the container that made them.
const CHANGES_PATH = join(ROOT, 'orchestration', 'cost-changes.json');

// The programme's ledger of changes, kept as authored narrative in reports/cost/changes.json and
// copied into the ledger unchanged. Every FIGURE in it is the instrument's own output (from
// reports/cost/experiments.json, generated by --experiments) — the file carries the sentence, not
// the arithmetic, so this is not a second thing that computes cost (rule 10). It is separate from
// experiments.json so that regenerating the measurements never silently drops the record of what
// was decided on the strength of them.
function readExperimentChanges() {
  for (const p of [CHANGES_PATH, EXPERIMENTS_PATH]) {
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'));
      if (Array.isArray(j.changes) && j.changes.length) return j.changes;
    } catch { /* absent is fine — the ledger then shows "no changes recorded yet" */ }
  }
  return [];
}

// ---- small deterministic statistics helpers (no dependency, seeded RNG so runs reproduce) --------
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
function quantile(arr, q) {
  if (!arr.length) return null;
  const s = [...arr].sort((x, y) => x - y);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
const median = (a) => quantile(a, 0.5);
function mulberry32(seed) { // deterministic RNG: the same permutation null every run
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// least-squares slope/intercept/R^2 of y on x
function regress(xs, ys) {
  const n = xs.length;
  if (n < 3) return { slope: null, intercept: null, r2: null, n };
  const mx = mean(xs), my = mean(ys);
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r2 = syy === 0 ? null : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

// ---- agents: the unit every experiment is expressed over ----------------------------------------
// An "agent" is one dispatched subagent (its own transcript file), or the orchestrator's own thread.
// Requests are ordered by timestamp; `ctx` is the CONTEXT RE-READ on each request — input + both
// cache-write classes + cache_read. That is the quantity cost is proportional to, and it is the
// quantity Q2 is about.
function buildAgents(priced, projectDir) {
  const byAgent = new Map();
  for (const r of priced) {
    if (!Number.isFinite(r.ts)) continue;
    const key = r.agentId ? `${r.sessionId}:${r.agentId}` : `${r.sessionId}:orchestrator`;
    let a = byAgent.get(key);
    if (!a) {
      a = { key, agentId: r.agentId, sessionId: r.sessionId, isOrchestrator: !r.agentId, reqs: [] };
      byAgent.set(key, a);
    }
    a.reqs.push(r);
  }
  for (const a of byAgent.values()) {
    a.reqs.sort((x, y) => x.ts - y.ts);
    a.n = a.reqs.length;
    a.usd = sum(a.reqs.map((r) => r.usd));
    a.first = a.reqs[0].ts;
    a.last = a.reqs[a.n - 1].ts;
    a.ctx = a.reqs.map((r) => r.usage.input + r.usage.cache_read + r.usage.cache_write_5m + r.usage.cache_write_1h);
    a.pie = a.reqs.map((r) => CLASSES.reduce((s, c) => s + r.usage[c] * PIE_WEIGHTS[c], 0));
    a.out = a.reqs.map((r) => r.usage.output);
    a.tools = a.reqs.map((r) => r.tools || []);
    // majority model over priced requests, plus the purity of that majority (routing assertion)
    const tally = {};
    for (const r of a.reqs) tally[r.model] = (tally[r.model] || 0) + 1;
    a.model = Object.keys(tally).sort((x, y) => tally[y] - tally[x])[0];
    a.model_purity = tally[a.model] / a.n;
    // dispatch attribution, from the harness's own sidecar file
    a.description = null; a.agentType = null;
    if (a.agentId && projectDir) {
      const metaPath = join(projectDir, a.sessionId, 'subagents', `agent-${a.agentId}.meta.json`);
      try {
        const m = JSON.parse(readFileSync(metaPath, 'utf8'));
        a.description = m.description || null;
        a.agentType = m.agentType || null;
      } catch { /* no sidecar — stays null, and is reported as unattributed, never guessed */ }
    }
    a.role = classifyRole(a);
  }
  return [...byAgent.values()].sort((x, y) => x.first - y.first);
}

// ---- role classification (Q4) --------------------------------------------------------------------
// EXPLICIT MARKERS ONLY. Anything that does not match a marker is `unclassified` and is reported as
// such — it is NEVER folded into `builder`. That default is the whole trap: a catch-all bucket makes
// a classifier look like it covers 100% of the money while distinguishing nothing, which is exactly
// the failure mode of an instrument that reported 71% coverage of a world containing none of the
// thing it measured. The generic-classifier null control in --experiments-self-test demonstrates it.
const ROLE_RULES = [
  ['orchestrator', (d, a) => a.isOrchestrator],
  ['judge',        (d) => /^(blind judge|arbiter|intent audit)/i.test(d)],
  ['plan',         (d) => /^(plan:|plan critic|cost plan)/i.test(d) || /\bplan critic\b/i.test(d)],
  ['critic',       (d) => /^(critic\b|.*\bcritic:)/i.test(d) || /\bcritic\b/i.test(d)],
  ['blog',         (d) => /^blog/i.test(d)],
  ['research',     (d) => /^(cost research|research\b)/i.test(d)],
  ['corpus',       (d) => /^corpus/i.test(d)],
  ['builder',      (d) => /^(w1-|ri-|s\d|cost dashboard|make |fix|build|implement|wire |repair|resume|write |populate|put |join |give |apply |close |mine |acquire|tighten|reconcile|own |finish|triage|do tools)/i.test(d)
                          || /\b(remediation|round \d|successor|rebuild|builder)\b/i.test(d)],
];
function classifyRole(a) {
  const d = a.description || '';
  if (a.isOrchestrator) return 'orchestrator';
  if (!d) return 'unattributed';
  for (const [role, test] of ROLE_RULES) { try { if (test(d, a)) return role; } catch { } }
  return 'unclassified';
}

// ==================================================================== Q1 — did Sonnet routing save?
// THE CONFOUND, stated first because it is fatal if ignored: Sonnet was given the EASIER tasks by
// design (COST.md §4.1 routes on decidability). A raw per-agent dollar comparison therefore measures
// task difficulty, not model efficiency, and it will flatter the routing enormously. So the headline
// here is NOT a comparison between agents. It is a COUNTERFACTUAL REPRICING of the exact token flow
// that was actually recorded on Sonnet: hold the work fixed, change only the price vector. That is
// arithmetic on a fixed flow (COST-INSTRUMENT §5.3: "a mix change's effect is arithmetic, not
// empirical") and it is immune to the difficulty confound by construction, because no Opus agent
// enters the sum at all.
//
// What the counterfactual CANNOT tell us is whether routing changed the amount of work done. That is
// the second half, and it is measured model-independently in PIE tokens at matched request index.
function experimentRouting(agents, priced) {
  const bySonnet = agents.filter((a) => a.model === 'claude-sonnet-5');
  const byOpus = agents.filter((a) => a.model === 'claude-opus-5' && !a.isOrchestrator);

  // ---- (1) counterfactual repricing of the recorded Sonnet flow at Opus prices
  let actual = 0, counterfactual = 0, sonnetReqs = 0;
  const sonnetTokens = zeroUsage();
  for (const r of priced) {
    if (r.model !== 'claude-sonnet-5') continue;
    sonnetReqs++;
    for (const c of CLASSES) sonnetTokens[c] += r.usage[c];
    actual += r.usd;
    counterfactual += priceRequest('claude-opus-5', r.usage);
  }
  const totalSpend = sum(priced.map((r) => r.usd));
  const saving = counterfactual - actual;

  // ---- (2) the naive (confounded) comparison, computed so the report can show what it looks like
  const naive = {
    sonnet_mean_usd_per_agent: mean(bySonnet.map((a) => a.usd)),
    opus_mean_usd_per_agent: mean(byOpus.map((a) => a.usd)),
    sonnet_median_requests: median(bySonnet.map((a) => a.n)),
    opus_median_requests: median(byOpus.map((a) => a.n)),
  };
  naive.apparent_ratio = naive.opus_mean_usd_per_agent ? naive.sonnet_mean_usd_per_agent / naive.opus_mean_usd_per_agent : null;

  // ---- (3) request-count-matched comparison. Matching on REALISED request count collapses the
  // between-task spread (the plan critic measured median cost ratio 2.39 unmatched -> 1.25 matched).
  // The statistic is the PIE-token ratio, which is model-INDEPENDENT: every model's price vector is
  // base_input x [1,1.25,2,0.1,5], so PIE is the same units on both arms. If routing changed only the
  // price, matched PIE per request is ~1.0 and the whole saving is the price ratio. If matched PIE
  // rises on Sonnet, the cheaper model bought MORE volume and ate part of its own saving.
  const matched = [];
  const opusPool = [...byOpus].sort((x, y) => x.n - y.n);
  for (const s of bySonnet) {
    const cands = opusPool.filter((o) => Math.abs(o.n - s.n) <= 0.25 * s.n);
    if (!cands.length) continue;
    // nearest by request count; ties broken deterministically by first timestamp
    cands.sort((x, y) => (Math.abs(x.n - s.n) - Math.abs(y.n - s.n)) || (x.first - y.first));
    const o = cands[0];
    matched.push({
      sonnet: s.description, opus: o.description, n_sonnet: s.n, n_opus: o.n,
      pie_per_req_sonnet: mean(s.pie), pie_per_req_opus: mean(o.pie),
      ctx_per_req_sonnet: mean(s.ctx), ctx_per_req_opus: mean(o.ctx),
      usd_ratio: o.usd ? s.usd / o.usd : null,
    });
  }
  const pieRatios = matched.map((m) => m.pie_per_req_sonnet / m.pie_per_req_opus).filter(Number.isFinite);
  const usdRatios = matched.map((m) => m.usd_ratio).filter(Number.isFinite);

  // ---- (4) matched-index context, the same test Q2 uses: do Sonnet agents carry a different context
  // at the same point in their life? (The plan critic found Sonnet agents carried LARGER early
  // contexts, 29,794 vs 25,365 at k=0, which is why usd_per_request is a broken diagnostic.)
  const idxTable = [];
  for (const k of [0, 5, 10, 20, 40, 80]) {
    const s = bySonnet.filter((a) => a.n > k).map((a) => a.ctx[k]);
    const o = byOpus.filter((a) => a.n > k).map((a) => a.ctx[k]);
    idxTable.push({ k, sonnet_mean_ctx: s.length ? Math.round(mean(s)) : null, sonnet_n: s.length,
                    opus_mean_ctx: o.length ? Math.round(mean(o)) : null, opus_n: o.length });
  }

  // ---- (5) when did routing actually happen? A mix share per day is a proportion, not a dollar
  // comparison between windows, so it is admissible under COST.md §2.
  const byDay = new Map();
  for (const r of priced) {
    if (!Number.isFinite(r.ts)) continue;
    const day = new Date(r.ts).toISOString().slice(0, 10);
    let d = byDay.get(day);
    if (!d) { d = { day, sonnet_pie: 0, total_pie: 0, sonnet_requests: 0, total_requests: 0 }; byDay.set(day, d); }
    const pie = CLASSES.reduce((s, c) => s + r.usage[c] * PIE_WEIGHTS[c], 0);
    d.total_pie += pie; d.total_requests++;
    if (r.model === 'claude-sonnet-5') { d.sonnet_pie += pie; d.sonnet_requests++; }
  }
  const timeline = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ day: d.day, sonnet_share_of_pie: +(d.sonnet_pie / d.total_pie).toFixed(4),
                   sonnet_share_of_requests: +(d.sonnet_requests / d.total_requests).toFixed(4),
                   requests: d.total_requests }));

  // ---- NULL CONTROL, and it is deliberately the PLAUSIBLE wrong answer rather than the trivial one.
  // The trivial control ("reprice zero tokens, get zero saving") proves nothing. The plausible wrong
  // answer is that the counterfactual-repricing number is evidence the FLEET got more efficient. It
  // is not: it measures only how much volume was routed. Demonstrate that by repricing an equal-sized,
  // request-count-matched set of OPUS agents as if they had been Sonnet. If that placebo produces a
  // "saving" of the same order, then the headline number is a statement about volume, not efficiency,
  // and nobody may read it as programme progress.
  let placeboActual = 0, placeboCounterfactual = 0;
  const placeboSet = new Set(matched.map((m) => m.opus));
  for (const a of byOpus) {
    if (!placeboSet.has(a.description)) continue;
    for (const r of a.reqs) {
      placeboActual += r.usd;
      placeboCounterfactual += priceRequest('claude-sonnet-5', r.usage);
    }
  }

  return {
    question: 'Q1 — did routing mechanical builds to Sonnet save anything?',
    method: 'counterfactual repricing of the recorded Sonnet token flow at Opus prices (holds work fixed; immune to the difficulty confound), plus a request-count-matched model-independent PIE comparison to test whether routing changed the volume of work.',
    sonnet: { agents: bySonnet.length, requests: sonnetReqs, tokens: sonnetTokens,
              actual_usd: +actual.toFixed(2), at_opus_prices_usd: +counterfactual.toFixed(2) },
    saving_usd: +saving.toFixed(2),
    saving_pct_of_counterfactual_bill: +((saving / (totalSpend + saving)) * 100).toFixed(2),
    total_spend_usd: +totalSpend.toFixed(2),
    sonnet_share_of_spend_pct: +((actual / totalSpend) * 100).toFixed(2),
    naive_confounded_comparison: naive,
    matched_pairs: { n: matched.length,
                     median_pie_per_request_ratio: pieRatios.length ? +median(pieRatios).toFixed(3) : null,
                     median_usd_ratio: usdRatios.length ? +median(usdRatios).toFixed(3) : null,
                     pairs: matched.map((m) => ({ ...m, pie_per_req_sonnet: Math.round(m.pie_per_req_sonnet), pie_per_req_opus: Math.round(m.pie_per_req_opus), ctx_per_req_sonnet: Math.round(m.ctx_per_req_sonnet), ctx_per_req_opus: Math.round(m.ctx_per_req_opus), usd_ratio: m.usd_ratio != null ? +m.usd_ratio.toFixed(3) : null })) },
    matched_index_context: idxTable,
    timeline,
    null_control_placebo: {
      description: 'request-count-matched OPUS agents repriced as if they had been Sonnet. If this "saving" is the same order as the real one, the headline measures VOLUME ROUTED, not efficiency.',
      agents: placeboSet.size,
      actual_usd: +placeboActual.toFixed(2),
      at_sonnet_prices_usd: +placeboCounterfactual.toFixed(2),
      would_be_saving_usd: +(placeboActual - placeboCounterfactual).toFixed(2),
    },
  };
}

// ================================================== Q2 — superlinear in tool calls: which mechanism?
// The confound the brief names: are long agents expensive because each call re-sends a grown context,
// or simply because they did more work? The two imply completely different remedies, so the analysis
// must separate them rather than confirm superlinearity (which both stories predict).
//
// The discriminating test is MATCHED REQUEST INDEX. If long agents are doing heavier work, their
// EARLY requests are already heavier than a short agent's early requests. If the mechanism is
// accumulation, then at the same index k every bin looks the same and the only difference is how far
// up the curve each bin travels. Test B adds the work proxy: per-request context GROWTH and OUTPUT
// tokens, which are the "new content" an agent generates, again at matched index.
function experimentGrowth(agents) {
  const subs = agents.filter((a) => !a.isOrchestrator && a.n >= 2);
  const BINS = [[0, 99], [100, 199], [200, 299], [300, Infinity]];
  const binOf = (n) => BINS.findIndex(([lo, hi]) => n >= lo && n <= hi);
  const binLabel = (i) => (BINS[i][1] === Infinity ? `${BINS[i][0]}+` : `${BINS[i][0]}-${BINS[i][1]}`);

  // ---- (1) the exponent. Is it 2 (quadratic) or something smaller?
  const withCost = subs.filter((a) => a.usd > 0 && a.n > 0);
  const reg = regress(withCost.map((a) => Math.log(a.n)), withCost.map((a) => Math.log(a.usd)));

  // ---- (2) the bins, as COST.md §4.0 states them
  const bins = BINS.map((_, i) => {
    const g = subs.filter((a) => binOf(a.n) === i);
    return {
      bin: binLabel(i), agents: g.length,
      mean_requests: g.length ? +mean(g.map((a) => a.n)).toFixed(1) : null,
      mean_usd_per_agent: g.length ? +mean(g.map((a) => a.usd)).toFixed(2) : null,
      usd_per_request: g.length ? +(sum(g.map((a) => a.usd)) / sum(g.map((a) => a.n))).toFixed(4) : null,
      mean_ctx_per_request: g.length ? Math.round(mean(g.flatMap((a) => a.ctx))) : null,
    };
  });

  // ---- (3) THE CONFOUND TEST. mean context at index k, split by the agent's EVENTUAL bin.
  const idxs = [0, 10, 20, 40, 80, 150, 250];
  const matchedIndex = idxs.map((k) => {
    const row = { k };
    BINS.forEach((_, i) => {
      const vals = subs.filter((a) => binOf(a.n) === i && a.n > k).map((a) => a.ctx[k]);
      row[binLabel(i)] = vals.length ? Math.round(mean(vals)) : null;
      row[`${binLabel(i)}_n`] = vals.length;
    });
    return row;
  });

  // ---- (4) THE WORK PROXY, i.e. the plausible-wrong-answer's own prediction, measured.
  // "They did more work" predicts long agents produce MORE NEW CONTENT per request. Context growth
  // per request (delta) and output tokens per request are that new content, and both are measured at
  // matched index so position in the turn is held constant.
  const workProxy = [10, 40, 80].map((k) => {
    const row = { k };
    BINS.forEach((_, i) => {
      const g = subs.filter((a) => binOf(a.n) === i && a.n > k + 1);
      row[`${binLabel(i)}_ctx_growth`] = g.length ? Math.round(mean(g.map((a) => a.ctx[k + 1] - a.ctx[k]))) : null;
      row[`${binLabel(i)}_output`] = g.length ? Math.round(mean(g.map((a) => a.out[k]))) : null;
    });
    return row;
  });

  // ---- (5) DOES ACCUMULATION FULLY EXPLAIN THE PER-REQUEST COST RISE? Predict each bin's mean
  // context per request using the POOLED context-vs-index curve and that bin's own index distribution.
  // If predicted ~= actual, the rise across bins is entirely "long agents spend more of their life at
  // high k" — accumulation — and nothing is left for a workload explanation.
  const pooledByIdx = new Map();
  for (const a of subs) for (let k = 0; k < a.n; k++) {
    let p = pooledByIdx.get(k); if (!p) { p = { s: 0, n: 0 }; pooledByIdx.set(k, p); }
    p.s += a.ctx[k]; p.n++;
  }
  const pooledMean = (k) => { const p = pooledByIdx.get(k); return p ? p.s / p.n : null; };
  const explained = BINS.map((_, i) => {
    const g = subs.filter((a) => binOf(a.n) === i);
    const actualVals = g.flatMap((a) => a.ctx);
    const predVals = g.flatMap((a) => a.ctx.map((_, k) => pooledMean(k)).filter((v) => v != null));
    const act = mean(actualVals), pred = mean(predVals);
    return { bin: binLabel(i), actual_mean_ctx: act != null ? Math.round(act) : null,
             predicted_from_pooled_curve: pred != null ? Math.round(pred) : null,
             ratio: (act && pred) ? +(act / pred).toFixed(3) : null };
  });

  // ---- (6) HOW BIG IS THE LEVER? Decompose every agent's re-read context into the unavoidable floor
  // (its own first-request context, re-read n times) and the accumulation on top of it. The
  // accumulation share is the ceiling of everything "shorter agents" could ever recover.
  let floorTok = 0, accumTok = 0, totalTok = 0, floorUsd = 0, accumUsd = 0;
  for (const a of subs) {
    const c0 = a.ctx[0];
    for (let k = 0; k < a.n; k++) {
      const p = PRICES[a.reqs[k].model];
      // the marginal price of carrying one more token of context on one more request is the
      // cache_read rate — cache_read is ~80% of spend and is what a re-sent context is billed at.
      const marginal = p ? p.cache_read / 1e6 : 0;
      totalTok += a.ctx[k];
      floorTok += Math.min(c0, a.ctx[k]);
      accumTok += Math.max(0, a.ctx[k] - c0);
      floorUsd += Math.min(c0, a.ctx[k]) * marginal;
      accumUsd += Math.max(0, a.ctx[k] - c0) * marginal;
    }
  }

  // ---- (7) THE SPLIT COUNTERFACTUAL — a recomputation over the recorded curve, not a guess.
  // If an agent of n requests had instead been s-request agents, chunk j would restart at its own
  // first-request context c0 and follow the SAME recorded deltas: c'[js+i] = c0 + (c[js+i] - c[js]).
  // The saved context per request is therefore exactly (c[js] - c0). This is an UPPER BOUND: it
  // models no re-orientation, no re-reading, and no handoff cost, all of which are real and
  // unmeasured here. Reported as a ceiling and labelled as one.
  function splitSaving(chunk) {
    let saved = 0;
    for (const a of subs) {
      const c0 = a.ctx[0];
      for (let k = 0; k < a.n; k++) {
        const boundary = Math.floor(k / chunk) * chunk;
        if (boundary === 0) continue;
        const p = PRICES[a.reqs[k].model];
        saved += Math.max(0, a.ctx[boundary] - c0) * (p ? p.cache_read / 1e6 : 0);
      }
    }
    return +saved.toFixed(2);
  }

  // ---- (8) DOES THE HARNESS ALREADY RESET THE CONTEXT? If compaction were already recovering the
  // accumulation, the split ceiling in (7) would be overstated — it would be proposing to recover
  // money the harness has already recovered. A reset is a request whose context falls below 60% of
  // the previous request's, from a base above 50k tokens. The count of agents whose context ever
  // falls AT ALL is published beside it, so an unfired diagnostic can be told from a blind one.
  let resetEvents = 0, agentsWithReset = 0, agentsWithAnyDecline = 0;
  for (const a of subs) {
    let hadReset = false, hadDecline = false;
    for (let k = 1; k < a.n; k++) {
      if (a.ctx[k] < a.ctx[k - 1]) hadDecline = true;
      if (a.ctx[k - 1] > 50_000 && a.ctx[k] < 0.6 * a.ctx[k - 1]) { resetEvents++; hadReset = true; }
    }
    if (hadReset) agentsWithReset++;
    if (hadDecline) agentsWithAnyDecline++;
  }

  const totalUsd = sum(subs.map((a) => a.usd));
  return {
    question: 'Q2 — is cost quadratic in tool calls, and is the driver accumulation or workload?',
    method: 'log-log regression of agent cost on request count; matched-request-index context and work-proxy tables to separate accumulation from workload; pooled-curve prediction; split counterfactual recomputed over the recorded context curve.',
    population: { agents: subs.length, requests: sum(subs.map((a) => a.n)), usd: +totalUsd.toFixed(2) },
    exponent: { value: reg.slope != null ? +reg.slope.toFixed(3) : null, r2: reg.r2 != null ? +reg.r2.toFixed(3) : null, n: reg.n,
                quadratic_would_be: 2.0, linear_would_be: 1.0 },
    bins,
    matched_index_context: matchedIndex,
    work_proxy_at_matched_index: workProxy,
    accumulation_explains: explained,
    decomposition: {
      total_context_tokens_reread: totalTok,
      floor_tokens_first_request_context_x_n: floorTok,
      accumulation_tokens: accumTok,
      accumulation_share_of_context: +(accumTok / totalTok).toFixed(4),
      floor_usd: +floorUsd.toFixed(2),
      accumulation_usd: +accumUsd.toFixed(2),
      accumulation_usd_share_of_subagent_spend: +(accumUsd / totalUsd).toFixed(4),
    },
    split_counterfactual_ceiling_usd: { chunk_50: splitSaving(50), chunk_100: splitSaving(100), chunk_150: splitSaving(150) },
    split_counterfactual_caveat: 'UPPER BOUND. Models no re-orientation, no re-reading and no handoff between the split agents, all of which are real. The measured re-read cost is the missing term and this piece did not measure it.',
    context_resets: { reset_events: resetEvents, agents_with_reset: agentsWithReset,
                      agents_with_any_context_decline: agentsWithAnyDecline, agents: subs.length,
                      note: 'a reset is ctx dropping below 60% of the previous request from a base > 50k. If this is ~0 the harness is not compacting, and the accumulation above has never been recovered by anything.' },
  };
}

// ============================== Q5 — what does a successor pay to pick up where a predecessor left?
//
// THE QUESTION. Q2 measured that 87.1% of all context re-read is accumulation above each agent's own
// first-request context, and that splitting every agent into 100-request pieces would not have
// re-read $1,728.02 — 27.7% of the bill. That figure ASSUMES A SPLIT IS FREE. It is not: a successor
// must read a status file, re-derive what its predecessor knew, and find its place again. **If
// re-orientation costs more than the accumulation it avoids, splitting is a loss and the lever is a
// mirage.** Q2 said so itself and did not measure it. This does.
//
// WHY NATURAL EXPERIMENTS RATHER THAN A CONSTRUCTED ONE. This fleet has already run the experiment
// 52 times without meaning to: agents killed by usage limits or container restarts and dispatched
// again as an explicitly-marked successor ("Resume W1-14 r3 magic", "W1-05 wayfinding (successor)").
// A successor is a split's second half with the split already performed. A synthetic one would
// measure our own idea of a handoff; these are the handoffs that actually happened.
//
// ---------------------------------------------------------------------------------------------
// THE STATISTIC, AND WHY IT IS NOT THE OBVIOUS ONE. The first version of this experiment integrated
// the resumed-vs-fresh context premium over the agent's first 60 requests. **That statistic is
// contaminated and it is kept below only as a diagnostic, with its own control firing on it.** It
// came out at MINUS $0.40 — successors apparently re-reading three-quarters of a million tokens
// FEWER than a fresh agent — and its late-index placebo (N3) showed the gap still widening at
// k = 200, where re-orientation is long over. The premium curve is ~0 for the first five requests
// and then diverges linearly: that is a SLOPE difference, not an INTERCEPT difference. Resumed
// agents are given narrower jobs, so their context grows more slowly, and integrating over 60
// indices measures the narrower job and calls it a free handoff. Reporting −$0.40 as "handoffs cost
// nothing" would have been this project's own favourite failure — a green number from an instrument
// measuring the wrong thing.
//
// **The primary statistic is therefore the context consumed BEFORE FIRST USEFUL OUTPUT.** For each
// agent: the sum of context re-read across every request up to and including the first that carries
// a mutating tool call (Write/Edit/MultiEdit/NotebookEdit). That is orientation, bounded, and it
// ends exactly where orientation ends. It is a TOKEN FLOW through the specific path a split would
// change — which is what COST.md §2 demands of any attribution here (cost-per-run CV ~0.97 forbids
// resting anything on dollar totals between windows). It is priced afterwards at the marginal
// cache_read rate, which is arithmetic on a fixed flow, not a comparison of two bills.
// ---------------------------------------------------------------------------------------------
//
// THE PLAUSIBLE WRONG ANSWER, and it is very plausible: **successors are later in calendar time, and
// this repo grows.** Measured here at 26 tokens/hour of first-request context across 205 hours on
// the fresh arm alone. Any agent dispatched late carries a heavier first request whether or not it
// is resuming anything, so every figure below compares a resumed agent only against agents
// dispatched within +/- REORIENT_WINDOW_H hours of it, and the raw uncontrolled number is published
// beside the matched one so the size of that contamination is visible rather than asserted.
//
// FOUR CONTROLS, each the plausible wrong answer rather than the trivial one:
//   N1  STRATIFIED LABEL SHUFFLE. Reassign the "resumed" label at random within (role x
//       request-count bin) strata and re-run the IDENTICAL pipeline, 1,000 times. The trivial
//       control would be "compare against zero"; this asks whether ARM COMPOSITION alone reproduces
//       the effect.
//   N2  GENERIC SECOND-GENERATION CONTROL. Round-2+ agents that are NOT resume-marked. They carry a
//       fuller, later brief and a critic's findings but inherited no half-finished state. Whatever
//       they show is the part of the resumed figure that is NOT handoff, and the difference is
//       published as the conservative reading.
//   N3  LATE-INDEX PLACEBO, on the diagnostic integral. It FIRES on the live data, which is why that
//       integral does not carry the verdict.
//   S   FRESH-VS-FRESH SELF-CONTROL, which must land at ~0 or the matching itself is biased.
//
// THE QUALITY ARM GATES EVERYTHING (COST.md §5, and the experiments run's own confession: "a cheaper
// build that triggers one extra remediation round is a net loss and I did not test for it"). A
// successor that loses its predecessor's context and re-derives a wrong conclusion is that failure
// exactly. Verdict scores come from tools/scores.mjs's own collect() — the existing instrument, not
// a second implementation — passed in by the caller so the ledger path never depends on it.

const REORIENT_WINDOW_H = 6;          // time-matching half-width, hours
const REORIENT_K_MAX = 60;            // indices spanned by the DIAGNOSTIC integral
const REORIENT_SHUFFLES = 1000;       // N1 draws
const REORIENT_MIN_CONTROLS = 3;      // fewer than this is not a control set

// Explicit markers only, exactly as ROLE_RULES does it: an agent that does not SAY it is a successor
// is not counted as one. A regex that guessed would put fresh agents into the resumed arm and shrink
// the very effect this is trying to see.
const RESUMED_RE = /\bresumed\b|\bresumes?\b|\bresume:|\(successor(?:\s*\d+)?\)|\bsuccessor\b|\btook over\b|\bhand ?off\b/i;
const LATER_ROUND_RE = /\br([2-9])\b|\bround\s*([2-9])\b/i;

function reorientArm(a) {
  if (a.isOrchestrator) return 'orchestrator';
  const d = a.description || '';
  if (!d) return 'unattributed';
  if (RESUMED_RE.test(d)) return 'resumed';
  if (LATER_ROUND_RE.test(d)) return 'later_round';
  return 'fresh';
}

// The first request on which the agent MUTATED something. Reading, grepping and thinking are
// orientation; a Write or an Edit is the first thing it could not have done without having oriented.
// Agents that never mutate (pure-measurement critics, probes) are CENSORED and counted — never
// scored as "oriented at request 0", which would silently flatter whichever arm holds more of them.
const MUTATING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
function firstMutationIndex(a) {
  for (let k = 0; k < a.n; k++) {
    const t = a.tools && a.tools[k];
    if (t && t.length && t.some((name) => MUTATING_TOOLS.has(name))) return k;
  }
  return -1;
}

function experimentReorientation(agents, scoresRows) {
  const subs = agents.filter((a) => !a.isOrchestrator && a.n >= 2);
  for (const a of subs) {
    a.arm = reorientArm(a);
    a.orientIdx = firstMutationIndex(a);
    a.orientTok = a.orientIdx < 0 ? null : sum(a.ctx.slice(0, a.orientIdx + 1));
    a.orientUsd = a.orientIdx < 0 ? null : sum(a.reqs.slice(0, a.orientIdx + 1).map((r) => r.usd));
  }
  const armOf = (name) => subs.filter((a) => a.arm === name);
  const resumed = armOf('resumed'), fresh = armOf('fresh'), later = armOf('later_round');
  const HOUR = 3600e3, WIN = REORIENT_WINDOW_H * HOUR;
  const cacheReadRate = (m) => { const p = PRICES[m]; return p ? p.cache_read / 1e6 : 0; };

  // ---- (0) IS THE TIME CONFOUND REAL? First-request context of FRESH agents against dispatch time.
  const t0 = Math.min(...subs.map((a) => a.first));
  const growthReg = regress(fresh.map((a) => (a.first - t0) / HOUR), fresh.map((a) => a.ctx[0]));
  const repoGrowth = {
    fresh_c0_vs_hours_slope_tokens_per_hour: growthReg.slope != null ? Math.round(growthReg.slope) : null,
    r2: growthReg.r2 != null ? +growthReg.r2.toFixed(3) : null, n: growthReg.n,
    hours_spanned: +((Math.max(...subs.map((a) => a.first)) - t0) / HOUR).toFixed(1),
    note: 'fresh agents only, so the slope cannot be produced by the resumed arm itself. It is why every figure below is time-matched.',
  };

  // =============== THE PRIMARY STATISTIC ===========================================================
  // Orientation cost = context re-read before first useful output, differenced against time-matched
  // controls and priced at the marginal cache_read rate. ONE implementation, used for the observed
  // figure AND every null draw, so a null can never differ from the measurement by a second code path.
  function orientationDelta(arm, controls) {
    const ctl = controls.filter((c) => c.orientTok != null).sort((x, y) => x.first - y.first);
    const times = ctl.map((c) => c.first), toks = ctl.map((c) => c.orientTok);
    const lowerBound = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
    const rows = [];
    let unmatched = 0, censored = 0;
    for (const a of arm) {
      if (a.orientTok == null) { censored++; continue; }
      const lo = lowerBound(times, a.first - WIN), hi = lowerBound(times, a.first + WIN + 1);
      const window = [];
      for (let i = lo; i < hi; i++) if (ctl[i] !== a) window.push(toks[i]);
      if (window.length < REORIENT_MIN_CONTROLS) { unmatched++; continue; }
      // MEDIAN control, not mean: orientation-token distributions are long-tailed (one agent that
      // reads forty files before writing would otherwise set the bar for its whole time window).
      const base = median(window);
      rows.push({ key: a.key, n: a.n, controls: window.length,
                  orient_requests: a.orientIdx + 1, orient_tokens: a.orientTok,
                  delta_tokens: Math.round(a.orientTok - base),
                  delta_usd: +((a.orientTok - base) * cacheReadRate(a.model)).toFixed(4) });
    }
    return { rows, unmatched, censored };
  }
  const summariseD = (d, label, armSize) => ({
    arm: label, agents_in_arm: armSize, matched: d.rows.length,
    censored_no_mutating_call: d.censored, unmatched_no_controls: d.unmatched,
    median_delta_usd: d.rows.length ? +median(d.rows.map((r) => r.delta_usd)).toFixed(4) : null,
    mean_delta_usd: d.rows.length ? +mean(d.rows.map((r) => r.delta_usd)).toFixed(4) : null,
    median_delta_tokens: d.rows.length ? Math.round(median(d.rows.map((r) => r.delta_tokens))) : null,
    median_orient_requests: d.rows.length ? median(d.rows.map((r) => r.orient_requests)) : null,
    median_orient_tokens: d.rows.length ? Math.round(median(d.rows.map((r) => r.orient_tokens))) : null,
  });
  const dResumed = orientationDelta(resumed, fresh);
  const dLater = orientationDelta(later, fresh);
  const dFresh = orientationDelta(fresh, fresh);
  const sResumed = summariseD(dResumed, 'resumed', resumed.length);
  const sLater = summariseD(dLater, 'later_round (N2)', later.length);
  const sFresh = summariseD(dFresh, 'fresh (self-control)', fresh.length);

  // the raw, unmatched version — every fresh agent regardless of when it ran
  const rawBase = fresh.filter((a) => a.orientTok != null).map((a) => a.orientTok);
  const rawMedian = rawBase.length ? median(rawBase) : null;
  const rawResumed = rawMedian == null ? null
    : +median(resumed.filter((a) => a.orientTok != null).map((a) => (a.orientTok - rawMedian) * cacheReadRate(a.model))).toFixed(4);

  // ---- N1, on the PRIMARY statistic, through the identical pipeline
  const nBin = (n) => (n < 50 ? 0 : n < 100 ? 1 : n < 200 ? 2 : 3);
  const strata = new Map();
  for (const a of [...resumed, ...fresh]) {
    const s = `${a.role}|${nBin(a.n)}`;
    if (!strata.has(s)) strata.set(s, { members: [], resumed: 0 });
    const st = strata.get(s);
    st.members.push(a);
    if (a.arm === 'resumed') st.resumed++;
  }
  const rng = mulberry32(0x5EED17);
  const nullMedians = [];
  for (let d = 0; d < REORIENT_SHUFFLES; d++) {
    const fakeResumed = [], fakeFresh = [];
    for (const st of strata.values()) {
      const order = st.members.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      order.forEach((m, rank) => (rank < st.resumed ? fakeResumed : fakeFresh).push(st.members[m]));
    }
    if (fakeResumed.length < 3 || fakeFresh.length < REORIENT_MIN_CONTROLS) continue;
    const p = orientationDelta(fakeResumed, fakeFresh);
    if (p.rows.length) nullMedians.push(median(p.rows.map((r) => r.delta_usd)));
  }
  nullMedians.sort((x, y) => x - y);
  const obs = sResumed.median_delta_usd;
  const nullLo = nullMedians.length ? +quantile(nullMedians, 0.025).toFixed(4) : null;
  const nullHi = nullMedians.length ? +quantile(nullMedians, 0.975).toFixed(4) : null;
  const pValue = (nullMedians.length && obs != null)
    ? +((nullMedians.filter((v) => Math.abs(v) >= Math.abs(obs)).length + 1) / (nullMedians.length + 1)).toFixed(4) : null;

  // =============== THE DIAGNOSTIC INTEGRAL, AND THE CONTROL THAT DISQUALIFIED IT ===================
  const timeSorted = [...subs].sort((x, y) => x.first - y.first);
  function buildControlIndex(members) {
    const inSet = new Set(members.map((a) => a.key));
    const times = [], sums = [];
    for (let k = 0; k < REORIENT_K_MAX; k++) {
      const t = [], s = [0];
      for (const a of timeSorted) { if (!inSet.has(a.key) || a.n <= k) continue; t.push(a.first); s.push(s[s.length - 1] + a.ctx[k]); }
      times.push(t); sums.push(s);
    }
    return { inSet, times, sums };
  }
  const lb = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
  function premiumCurve(arm, idx) {
    const num = new Array(REORIENT_K_MAX).fill(0), den = new Array(REORIENT_K_MAX).fill(0), per = [];
    for (const a of arm) {
      let tok = 0, used = 0;
      for (let k = 0; k < Math.min(a.n, REORIENT_K_MAX); k++) {
        const arr = idx.times[k], pre = idx.sums[k];
        const lo = lb(arr, a.first - WIN), hi = lb(arr, a.first + WIN + 1);
        let n = hi - lo, s = pre[hi] - pre[lo];
        if (idx.inSet.has(a.key) && a.n > k && Math.abs(a.first - a.first) <= WIN) { n--; s -= a.ctx[k]; }
        if (n < REORIENT_MIN_CONTROLS) continue;
        const dd = a.ctx[k] - s / n;
        tok += dd; used++; num[k] += dd; den[k]++;
      }
      if (used) per.push(tok * cacheReadRate(a.model));
    }
    return { curve: num.map((s, k) => (den[k] ? Math.round(s / den[k]) : null)),
             median_usd: per.length ? +median(per).toFixed(4) : null };
  }
  const freshIdx = buildControlIndex(fresh);
  const integralResumed = premiumCurve(resumed, freshIdx);
  const placebo = [100, 150, 200].map((k) => {
    const r = resumed.filter((a) => a.n > k).map((a) => a.ctx[k]);
    const f = fresh.filter((a) => a.n > k).map((a) => a.ctx[k]);
    return { k, resumed_n: r.length, fresh_n: f.length,
             premium_tokens: (r.length >= 3 && f.length >= 3) ? Math.round(mean(r) - mean(f)) : null };
  });
  const placeboFired = placebo.some((p) => p.premium_tokens != null && Math.abs(p.premium_tokens) > 20_000);

  // scope diagnostics — WHY the integral is contaminated, shown rather than asserted
  const scopeOf = (arm) => ({
    n: arm.length,
    median_requests: arm.length ? median(arm.map((a) => a.n)) : null,
    median_ctx_growth_per_request: arm.length
      ? Math.round(median(arm.filter((a) => a.n > 20).map((a) => (a.ctx[20] - a.ctx[0]) / 20))) : null,
  });

  // =============== THE DECISION ARITHMETIC =========================================================
  function splitSavingLocal(chunk) {
    let saved = 0, boundaries = 0;
    for (const a of subs) {
      const c0 = a.ctx[0];
      boundaries += Math.floor((a.n - 1) / chunk);
      for (let k = 0; k < a.n; k++) {
        const b = Math.floor(k / chunk) * chunk;
        if (b === 0) continue;
        saved += Math.max(0, a.ctx[b] - c0) * cacheReadRate(a.reqs[k].model);
      }
    }
    return { chunk, ceiling_usd: +saved.toFixed(2), boundaries };
  }
  const conservative = (obs != null && sLater.median_delta_usd != null)
    ? +(obs - sLater.median_delta_usd).toFixed(4) : null;
  const decision = [50, 100, 150].map((chunk) => {
    const s = splitSavingLocal(chunk);
    const cost = obs != null ? +(s.boundaries * obs).toFixed(2) : null;
    return { ...s, measured_handoff_usd_each: obs,
             reorientation_cost_usd: cost,
             net_usd: cost != null ? +(s.ceiling_usd - cost).toFixed(2) : null,
             breakeven_handoff_usd: +(s.ceiling_usd / s.boundaries).toFixed(3),
             margin_x: (obs != null && obs > 0) ? +((s.ceiling_usd / s.boundaries) / obs).toFixed(1) : null };
  });

  // =============== THE QUALITY ARM — it gates, it does not decorate ================================
  let quality = { available: false, reason: 'no verdict rows supplied by the caller' };
  if (Array.isArray(scoresRows) && scoresRows.length) {
    const pieceRound = (d) => {
      const s = String(d || ''); const p = s.match(/\b(w1-[a-z0-9]+)\b/i);
      if (!p) return null;
      const r = s.match(/\br(\d+)\b/i) || s.match(/\bround\s*(\d+)\b/i);
      return { piece: p[1].toLowerCase(), round: r ? Number(r[1]) : 1 };
    };
    const resumedRounds = new Set();
    for (const a of resumed) { const pr = pieceRound(a.description); if (pr) resumedRounds.add(`${pr.piece}|${pr.round}`); }
    const tagged = scoresRows.map((r) => ({ ...r, resumedRound: resumedRounds.has(`${r.piece}|${r.round}`) }));
    const A = tagged.filter((r) => r.resumedRound), B = tagged.filter((r) => !r.resumedRound);
    const byPiece = new Map();
    for (const r of tagged) {
      let p = byPiece.get(r.piece); if (!p) { p = { rounds: 0, resumed: false }; byPiece.set(r.piece, p); }
      p.rounds = Math.max(p.rounds, r.round); if (r.resumedRound) p.resumed = true;
    }
    const pr = [...byPiece.values()].filter((p) => p.resumed), pf = [...byPiece.values()].filter((p) => !p.resumed);
    const meanA = A.length ? +mean(A.map((r) => r.score)).toFixed(2) : null;
    const meanB = B.length ? +mean(B.map((r) => r.score)).toFixed(2) : null;
    quality = {
      available: true,
      source: 'tools/scores.mjs collect() — the existing verdict instrument, not a second implementation',
      matched_resumed_rounds: resumedRounds.size, verdicts_total: tagged.length,
      resumed_rounds: { n: A.length, mean_score: meanA,
                        pass_rate: A.length ? +(A.filter((r) => r.status === 'pass').length / A.length).toFixed(3) : null },
      other_rounds: { n: B.length, mean_score: meanB,
                      pass_rate: B.length ? +(B.filter((r) => r.status === 'pass').length / B.length).toFixed(3) : null },
      score_delta: (meanA != null && meanB != null) ? +(meanA - meanB).toFixed(2) : null,
      rounds_needed: { resumed_pieces_n: pr.length, resumed_pieces_mean_rounds: pr.length ? +mean(pr.map((p) => p.rounds)).toFixed(2) : null,
                       other_pieces_n: pf.length, other_pieces_mean_rounds: pf.length ? +mean(pf.map((p) => p.rounds)).toFixed(2) : null },
      power: 'low',
      alarm: (meanA != null && meanB != null && meanA < meanB - 0.5) ? 'RESUMED ROUNDS SCORE MATERIALLY LOWER — this is the failure the change must not cause' : null,
      confound: 'FATAL AND UNRESOLVED, stated rather than buried: a piece is resumed BECAUSE it was long or hard, and long hard pieces need more rounds and score lower for reasons that have nothing to do with the handoff. This arm can therefore REFUSE a change — a large quality drop is a real alarm — and can never LICENCE one. It is used in that direction only, and the rounds-needed figure below is NOT evidence against splitting for the same reason.',
    };
  }

  // =============== THE VERDICT =====================================================================
  const chunk100 = decision.find((d) => d.chunk === 100);
  const inNull = obs != null && nullLo != null && obs >= nullLo && obs <= nullHi;
  let verdict, verdict_reason;
  if (obs == null || sResumed.matched < 8) {
    verdict = 'inconclusive';
    verdict_reason = `only ${sResumed.matched} resumed agents survived time-matching — too few to size a handoff.`;
  } else if (obs <= 0) {
    verdict = 'inconclusive';
    verdict_reason = `the measured orientation delta is ${obs}, i.e. successors did not cost MORE to orient than time-matched fresh agents. That cannot be read as "handoffs are free": it more likely means resumed agents were given narrower jobs. Reported, not converted into a saving.`;
  } else if (quality.available && quality.alarm) {
    verdict = 'refused_on_quality';
    verdict_reason = `${quality.alarm}. COST.md §5: no saving may come from cutting verification, and a split that re-derives a wrong conclusion is that. The cost arithmetic is published for the record and the change is NOT recommended.`;
  } else if (inNull || (pValue != null && pValue > 0.05)) {
    verdict = 'supported_cost_term_indistinguishable_from_noise';
    verdict_reason = `the orientation delta (${obs}) sits inside the stratified-shuffle null band [${nullLo}, ${nullHi}] (p = ${pValue}). The handoff is therefore SMALL — too small to separate from arm composition — and the ceiling stands well clear of it: break-even at chunk 100 is ${chunk100.breakeven_handoff_usd} per handoff against a measured ${obs}. A lever survives a cost term it cannot resolve only when the term is bounded far below the saving, which is the case here; the bound, not the point estimate, is what supports it.`;
  } else if (chunk100 && chunk100.net_usd != null && chunk100.net_usd <= 0) {
    verdict = 'not_supported';
    verdict_reason = `re-orientation costs ${chunk100.reorientation_cost_usd} across ${chunk100.boundaries} handoffs against a ${chunk100.ceiling_usd} ceiling. Splitting at 100 is a loss and the lever is a mirage at that chunk size.`;
  } else {
    verdict = 'supported_pending_quality';
    verdict_reason = `orientation costs a measured ${obs} per handoff (p = ${pValue}) against a break-even of ${chunk100.breakeven_handoff_usd} — a margin of ${chunk100.margin_x}x. Net ${chunk100.net_usd} at chunk 100. The quality arm gates it and is low-powered; see \`quality\`.`;
  }

  return {
    question: 'Q5 — what does a successor pay to re-orient, and does it exceed the accumulation a split avoids?',
    method: 'natural experiment on 52 explicitly-marked resumed agents. PRIMARY: context re-read before first useful output (first Write/Edit/MultiEdit/NotebookEdit), differenced against TIME-MATCHED controls and priced at the marginal cache_read rate — a token flow through the path a split changes, as COST.md §2 requires. SECONDARY and DISQUALIFIED: the 60-index context premium integral, kept with the control that disqualified it. Controls: stratified label shuffle, generic second-generation arm, late-index placebo, fresh-vs-fresh self-control. Quality arm from tools/scores.mjs gates the recommendation.',
    parameters: { time_window_hours: REORIENT_WINDOW_H, k_max_diagnostic: REORIENT_K_MAX,
                  shuffles: REORIENT_SHUFFLES, min_controls: REORIENT_MIN_CONTROLS,
                  mutating_tools: [...MUTATING_TOOLS], control_statistic: 'median' },
    population: { subagents: subs.length, resumed: resumed.length, later_round: later.length,
                  fresh: fresh.length, unattributed: armOf('unattributed').length },
    repo_growth_confound: repoGrowth,
    orientation_cost: {
      definition: 'context tokens re-read across every request up to and including the first that carries a mutating tool call, minus the median of time-matched controls, priced at cache_read. Agents that never mutate are censored and counted.',
      resumed: sResumed, later_round_N2: sLater, fresh_self_control: sFresh,
      resumed_raw_unmatched_median_usd: rawResumed,
      conservative_handoff_usd_net_of_generic: conservative,
    },
    diagnostic_integral_DISQUALIFIED: {
      why: 'kept because a negative result that was thrown away is a result nobody can check. Integrating the resumed-vs-fresh context premium over 60 request indices returns a NEGATIVE number — successors apparently re-reading far LESS than fresh agents — and its own late-index placebo shows the gap still widening at k=200, where re-orientation is long over. The curve is flat for the first five requests and then diverges linearly: a SLOPE difference (resumed agents were given narrower jobs), not an INTERCEPT difference (orientation). It measures scope and would have been reported as a free handoff.',
      median_usd: integralResumed.median_usd,
      mean_premium_curve_tokens_by_index: integralResumed.curve,
      n3_late_index_placebo: { rows: placebo, fired: placeboFired,
        note: 'a premium surviving to k=100+ is not re-orientation. This control FIRED, and that is why the integral does not carry the verdict.' },
      scope_diagnostic: { resumed: scopeOf(resumed), fresh: scopeOf(fresh), later_round: scopeOf(later),
        note: 'the mechanism behind the contamination, shown rather than asserted.' },
    },
    null_controls: {
      n1_stratified_shuffle: { draws: nullMedians.length, strata: strata.size, observed_median_usd: obs,
        null_p2_5: nullLo, null_median: nullMedians.length ? +median(nullMedians).toFixed(4) : null,
        null_p97_5: nullHi, p_value_two_sided: pValue,
        note: 'labels reassigned within (role x request-count bin) strata, so the null preserves arm composition. The trivial control — comparing against zero — is not run, because it cannot fail.' },
      n2_generic_second_generation: { orientation_delta_usd: sLater.median_delta_usd,
        note: 'round-2+ agents that are NOT resume-marked. Fuller, later brief; no half-finished state inherited. Whatever they show is the part of the resumed figure that is not handoff.' },
      s_fresh_self_control: { orientation_delta_usd: sFresh.median_delta_usd,
        note: 'must be ~0. If it is not, the matching is biased and nothing here holds.' },
    },
    decision: { rows: decision, verdict, verdict_reason,
      ceiling_source: 'recomputed here over the same recorded context curve Q2 uses, so the two cannot drift apart.' },
    quality,
    what_this_does_not_measure: [
      'Whether a DELIBERATE split hands off as well as, better than, or worse than these accidental ones. Every resumed agent here inherited an UNPLANNED death — a usage limit or a container restart — so its predecessor wrote no handoff note by design. That makes this a WORST-CASE reading of the handoff, which is the safe direction, but it says nothing about whether a planned split would decompose the work sensibly.',
      'Whether the successor REDID work rather than merely re-reading. The extra requests before its first write are counted as orientation; some of them may be duplicated effort, which would be both a larger cost and a quality problem, and the transcript cannot tell the two apart.',
      'Any quality effect the verdict scores are too coarse to see: 69 verdicts over 16 domains moving by whole points cannot detect a small regression, and the arm is published with its power.',
      'The orchestrator, which is excluded from every arm and is itself one of the most expensive agents in the fleet.',
    ],
  };
}

// ================================================ Q3 — confirm or overturn the C1 revert (E1)
// Ruling C1 staggered burst dispatch on the argument that concurrent requests cannot hit each other's
// cache until the first has begun streaming. It was then reverted as inert on a PROTOTYPE's figures.
// E1 requires reproduction, not confirmation, with a cold-start control that fails loudly if the
// prototype's bug is reproduced instead of its finding.
//
// NOTE ON THE PREDICATE. C1's own acceptance ("staggered exceeds tight by >= 10 percentage points")
// is arithmetically unsatisfiable when the tight arm already sits at ~0.96 — no data can reach 1.06.
// The plan critic caught this (BLOCKING 3). The satisfiable restatement, used here, is the fraction of
// AVAILABLE HEADROOM closed: (warm_stag - warm_tight) / (1 - warm_tight). The primary acceptance is
// the ceiling: what share of total spend could first-request cache writes possibly represent?
function experimentBursts(agents, priced) {
  const subs = agents.filter((a) => !a.isOrchestrator).sort((x, y) => x.first - y.first);
  const GAP_MS = 120_000, STAGGER_MS = 20_000;

  // burst = maximal run of agents each starting within 120s of the previous one
  const bursts = [];
  let cur = [];
  for (const a of subs) {
    if (!cur.length || a.first - cur[cur.length - 1].first <= GAP_MS) cur.push(a);
    else { bursts.push(cur); cur = [a]; }
  }
  if (cur.length) bursts.push(cur);
  const multi = bursts.filter((b) => b.length >= 2);

  const warmOfBurst = (b) => {
    const followers = b.slice(1);
    return followers.filter((a) => a.reqs[0].usage.cache_read > 0).length / followers.length;
  };
  const isStaggered = (b) => (b[1].first - b[0].first) >= STAGGER_MS;

  const tight = multi.filter((b) => !isStaggered(b));
  const stag = multi.filter((b) => isStaggered(b));
  const wTight = mean(tight.map(warmOfBurst));
  const wStag = mean(stag.map(warmOfBurst));
  const diffPp = (wStag - wTight) * 100;
  const headroomClosed = (1 - wTight) > 0 ? (wStag - wTight) / (1 - wTight) : null;

  // ---- THE CEILING, which is the primary acceptance. First-request cache_write is the ENTIRE pool
  // of money any dispatch-timing change can address: it is what a cold first request pays that a warm
  // one does not. Priced at each agent's own model.
  let firstReqWriteUsd = 0, firstReqWriteTok = 0;
  for (const a of subs) {
    const u = a.reqs[0].usage, p = PRICES[a.reqs[0].model];
    if (!p) continue;
    firstReqWriteTok += u.cache_write_5m + u.cache_write_1h;
    firstReqWriteUsd += (u.cache_write_5m * p.cache_write_5m + u.cache_write_1h * p.cache_write_1h) / 1e6;
  }
  const totalSpend = sum(priced.map((r) => r.usd));
  const warmOnFirst = subs.filter((a) => a.reqs[0].usage.cache_read > 0).length;

  // ---- COLD-START NULL CONTROL. The session's first-ever agent had nothing before it to warm the
  // prefix, so its first request MUST show cache_read == 0 and a non-zero cache_write. If it reads as
  // warm, the parser is reading the wrong field and every number above is void — that is the "fails
  // loudly if you reproduce the prototype's bug instead of its finding" requirement, made operative.
  const firstAgent = subs[0];
  const coldControl = firstAgent ? {
    agent: firstAgent.agentId, description: firstAgent.description,
    first_request_cache_read: firstAgent.reqs[0].usage.cache_read,
    first_request_cache_write: firstAgent.reqs[0].usage.cache_write_5m + firstAgent.reqs[0].usage.cache_write_1h,
    fires_correctly: firstAgent.reqs[0].usage.cache_read === 0
      && (firstAgent.reqs[0].usage.cache_write_5m + firstAgent.reqs[0].usage.cache_write_1h) > 0,
  } : null;

  // ---- LABEL-SHUFFLE PERMUTATION NULL. This is the plausible wrong answer, not the trivial one: the
  // trivial control is "compare a burst with itself". The plausible wrong answer is that warm_fraction
  // is really tracking BURST SIZE (bigger bursts are more likely staggered AND more likely to have a
  // warm follower), in which case a random relabelling that preserves the burst-size distribution
  // would reproduce the effect. Shuffling the tight/staggered labels across the same bursts tests
  // exactly that, and its spread is the noise band the observed difference must clear.
  const rnd = mulberry32(20260814);
  const warms = multi.map(warmOfBurst);
  const nStag = stag.length;
  const perm = [];
  for (let it = 0; it < 4000; it++) {
    const idx = warms.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const sArm = idx.slice(0, nStag).map((i) => warms[i]);
    const tArm = idx.slice(nStag).map((i) => warms[i]);
    perm.push((mean(sArm) - mean(tArm)) * 100);
  }
  perm.sort((a, b) => a - b);
  const pTwoSided = perm.filter((v) => Math.abs(v) >= Math.abs(diffPp)).length / perm.length;

  // ---- burst-size cross-check: is stagger just a proxy for size?
  const sizeCheck = {
    mean_burst_size_tight: tight.length ? +mean(tight.map((b) => b.length)).toFixed(2) : null,
    mean_burst_size_staggered: stag.length ? +mean(stag.map((b) => b.length)).toFixed(2) : null,
  };

  return {
    question: 'Q3 — confirm or overturn the C1 revert (staggered burst dispatch).',
    method: 'independent reproduction from the instrument parser: burst segmentation at 120s, stagger at 20s, warm_fraction over followers, ceiling on first-request cache_write share of spend, cold-start control and a 4,000-draw label-shuffle permutation null.',
    bursts: { total: bursts.length, multi_agent: multi.length, largest: Math.max(...bursts.map((b) => b.length)),
              tight: tight.length, staggered: stag.length, ...sizeCheck },
    warm_fraction: { tight: wTight != null ? +wTight.toFixed(4) : null, staggered: wStag != null ? +wStag.toFixed(4) : null,
                     difference_pp: +diffPp.toFixed(2),
                     headroom_closed_pct: headroomClosed != null ? +(headroomClosed * 100).toFixed(1) : null,
                     c1_original_bar_pp: 10, c1_bar_is_satisfiable: (wTight != null && wTight + 0.10 <= 1) },
    permutation_null: { draws: perm.length, p_two_sided: +pTwoSided.toFixed(3),
                        band_95_pp: [ +quantile(perm, 0.025).toFixed(2), +quantile(perm, 0.975).toFixed(2) ] },
    ceiling: { agents: subs.length, agents_warm_on_first_request: warmOnFirst,
               warm_on_first_pct: +((warmOnFirst / subs.length) * 100).toFixed(1),
               first_request_cache_write_tokens: firstReqWriteTok,
               first_request_cache_write_usd: +firstReqWriteUsd.toFixed(2),
               pct_of_total_spend: +((firstReqWriteUsd / totalSpend) * 100).toFixed(3),
               c1_ceiling_bar_pct: 2 },
    cold_start_control: coldControl,
  };
}

// =============================================== Q4 — where the money actually goes, by role & model
function experimentAttribution(agents, priced, byTokenClass) {
  const total = sum(priced.map((r) => r.usd));
  const roles = new Map();
  for (const a of agents) {
    let r = roles.get(a.role);
    if (!r) { r = { role: a.role, agents: 0, requests: 0, usd: 0, pie: 0 }; roles.set(a.role, r); }
    r.agents++; r.requests += a.n; r.usd += a.usd; r.pie += sum(a.pie);
  }
  const byRole = [...roles.values()].sort((x, y) => y.usd - x.usd).map((r) => ({
    ...r, usd: +r.usd.toFixed(2), pie: Math.round(r.pie),
    pct_of_spend: +((r.usd / total) * 100).toFixed(2),
    mean_usd_per_agent: +(r.usd / r.agents).toFixed(2),
    mean_requests_per_agent: +(r.requests / r.agents).toFixed(1),
  }));

  // ---- NULL CONTROL, the plausible wrong answer rather than the trivial one. The trivial control is
  // an empty input. The plausible wrong answer is a classifier with a CATCH-ALL: label every
  // subagent "builder" and it reports 100% coverage while distinguishing nothing — which is exactly
  // how an instrument came to report 71% coverage of a world containing none of the thing it measured.
  // Reported here beside the real classifier so the two can be compared, and the real classifier's
  // unmatched residual is published rather than absorbed.
  const genericUsd = sum(agents.filter((a) => !a.isOrchestrator).map((a) => a.usd));
  const unmatched = byRole.filter((r) => r.role === 'unclassified' || r.role === 'unattributed');
  const nullControl = {
    generic_catch_all_classifier: { role: 'builder (everything)', agents: agents.filter((a) => !a.isOrchestrator).length,
                                    usd: +genericUsd.toFixed(2), pct_of_spend: +((genericUsd / total) * 100).toFixed(2),
                                    distinguishes: 0 },
    explicit_classifier_residual: { roles: unmatched.map((r) => r.role), usd: +sum(unmatched.map((r) => r.usd)).toFixed(2),
                                    pct_of_spend: +(sum(unmatched.map((r) => r.pct_of_spend))).toFixed(2) },
    interpretation: 'The catch-all reports 100% coverage and separates nothing. The explicit classifier leaves a residual it publishes rather than absorbing. A coverage figure is only meaningful beside the residual it refuses to claim.',
  };

  // ---- VALIDITY CHECK on the labels, independent of the words they were derived from. If the
  // critic label means anything, a critic for item X must START AFTER a builder for item X: that is
  // the project's own gauntlet order, and it is nowhere in the description text the label came from.
  // A classifier labelling noise would come out near 50%.
  const itemRe = /\b(W1-\d+|RI-[A-Z0-9]+|W1-[A-Z-]+)\b/i;
  const buildersByItem = new Map();
  for (const a of agents) {
    if (a.role !== 'builder' || !a.description) continue;
    const m = a.description.match(itemRe); if (!m) continue;
    const item = m[1].toUpperCase();
    const prev = buildersByItem.get(item);
    if (prev == null || a.first < prev) buildersByItem.set(item, a.first);
  }
  let ordered = 0, testable = 0;
  for (const a of agents) {
    if (a.role !== 'critic' || !a.description) continue;
    const m = a.description.match(itemRe); if (!m) continue;
    const b = buildersByItem.get(m[1].toUpperCase()); if (b == null) continue;
    testable++; if (a.first > b) ordered++;
  }

  return {
    question: 'Q4 — where is the money actually going?',
    method: 'per-agent spend attributed via the harness\'s own subagents/*.meta.json dispatch description, classified by explicit markers only; the unmatched residual is published, never folded into a catch-all.',
    total_spend_usd: +total.toFixed(2),
    by_role: byRole,
    by_token_class: byTokenClass,
    null_control: nullControl,
    label_validity_check: {
      description: 'critics for an item must start after that item\'s first builder — an ordering the label was NOT derived from. Noise labels would land near 50%.',
      testable_pairs: testable, correctly_ordered: ordered,
      pct: testable ? +((ordered / testable) * 100).toFixed(1) : null,
    },
  };
}

// ---- the experiments driver -----------------------------------------------------------------------
async function runExperiments(which) {
  const collected = await collectPricedRequests();
  const { priced, projectDir } = collected;
  const agents = buildAgents(priced, projectDir);
  log(`cost: ${agents.length} agents (${agents.filter((a) => !a.isOrchestrator).length} subagents + orchestrator), ${priced.length} priced requests.`);

  // by_token_class, reused from the ledger's own definition rather than recomputed differently
  const byClassAgg = {};
  for (const c of CLASSES) byClassAgg[c] = { class: c, usd: 0, tokens: 0 };
  for (const r of priced) {
    const p = PRICES[r.model];
    for (const c of CLASSES) { byClassAgg[c].tokens += r.usage[c]; byClassAgg[c].usd += (r.usage[c] || 0) * (p[c] || 0) / 1e6; }
  }
  const totalSpend = sum(priced.map((r) => r.usd));
  const byTokenClass = CLASSES.map((c) => ({ class: c, usd: +byClassAgg[c].usd.toFixed(2), tokens: byClassAgg[c].tokens,
                                             pct_of_spend: +((byClassAgg[c].usd / totalSpend) * 100).toFixed(2) }));

  const out = {};
  if (which.has('routing')) out.q1_routing = experimentRouting(agents, priced);
  if (which.has('growth')) out.q2_growth = experimentGrowth(agents);
  if (which.has('bursts')) out.q3_bursts = experimentBursts(agents, priced);
  if (which.has('reorientation')) {
    // Verdict scores come from the EXISTING instrument (rule 10), imported dynamically so the
    // ledger path — the thing publish.mjs runs on every bank — can never be broken by scores.mjs.
    let scoresRows = null;
    try { scoresRows = (await import('./scores.mjs')).collect().rows; }
    catch (e) { log(`cost: Q5 quality arm unavailable — ${e.message}`); }
    out.q5_reorientation = experimentReorientation(agents, scoresRows);
  }
  if (which.has('attribution')) out.q4_attribution = experimentAttribution(agents, priced, byTokenClass);
  return { results: out, agents, priced, totalSpend, collected };
}

// ---- experiment self-test: synthetic arms with known answers that must genuinely disagree ---------
// Rule 4/6. Each analysis is fed a synthetic fleet where the RIGHT answer is known in advance, and a
// second fleet where the OPPOSITE is true. An analysis that reports the same thing on both is inert
// and its live number means nothing.
function synthAgent(id, n, ctx0, growth, model = 'claude-opus-5', t0 = 0) {
  const reqs = [];
  for (let k = 0; k < n; k++) {
    const ctx = ctx0 + growth * k;
    const usage = { input: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: ctx, output: 10 };
    reqs.push({ id: `${id}-${k}`, model, ts: t0 + k * 1000, sessionId: 's', agentId: id, usage, usd: priceRequest(model, usage) });
  }
  return reqs;
}
function runExperimentsSelfTest() {
  let pass = true;
  const say = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) pass = false; };

  console.log('cost --experiments-self-test\n');

  // ---- Q2 arms. Arm A: pure accumulation (identical ctx0 and growth; only n differs).
  //               Arm W: pure workload (flat context within an agent, but bigger for bigger agents).
  //               Arm L: flat and identical (the linear control).
  console.log('Q2 growth — three synthetic fleets whose right answers differ:');
  const armA = [];
  [40, 40, 150, 150, 250, 250, 330, 330].forEach((n, i) => armA.push(...synthAgent(`a${i}`, n, 25000, 2000, 'claude-opus-5', i * 1e7)));
  const armW = [];
  [40, 40, 150, 150, 250, 250, 330, 330].forEach((n, i) => armW.push(...synthAgent(`w${i}`, n, 25000 + n * 2000 / 2, 0, 'claude-opus-5', i * 1e7)));
  const armL = [];
  [40, 40, 150, 150, 250, 250, 330, 330].forEach((n, i) => armL.push(...synthAgent(`l${i}`, n, 25000, 0, 'claude-opus-5', i * 1e7)));
  const gA = experimentGrowth(buildAgents(armA, null));
  const gW = experimentGrowth(buildAgents(armW, null));
  const gL = experimentGrowth(buildAgents(armL, null));
  say(Math.abs(gL.exponent.value - 1.0) < 0.05, `flat arm exponent ${gL.exponent.value} ~ 1.0 — the regression can report "linear"`);
  say(gA.exponent.value > 1.3, `accumulation arm exponent ${gA.exponent.value} > 1.3 (superlinear)`);
  // THE POINT OF THIS ARM: the workload story ALSO produces a superlinear exponent. So the exponent
  // on its own cannot answer the brief's question, and anyone who reports it as if it could is
  // reporting a statistic that both hypotheses predict. The two arms must be separated by the
  // matched-index and accumulation-share tests below, and they are.
  say(gW.exponent.value > 1.3, `workload arm exponent ${gW.exponent.value} > 1.3 TOO — the exponent alone does NOT discriminate; it is not the answer to the confound`);
  say(gA.decomposition.accumulation_share_of_context > 0.5,
      `accumulation arm: accumulation share ${(gA.decomposition.accumulation_share_of_context * 100).toFixed(1)}% > 50%`);
  say(gW.decomposition.accumulation_share_of_context < 0.02,
      `workload arm: accumulation share ${(gW.decomposition.accumulation_share_of_context * 100).toFixed(1)}% < 2% — the analysis CAN report "it is workload"`);
  const wRow = gW.matched_index_context.find((r) => r.k === 10);
  const aRow = gA.matched_index_context.find((r) => r.k === 10);
  say(aRow['0-99'] != null && aRow['300+'] != null && Math.abs(aRow['0-99'] - aRow['300+']) / aRow['0-99'] < 0.05,
      `accumulation arm: matched-index k=10 context agrees across bins (${aRow['0-99']} vs ${aRow['300+']})`);
  say(wRow['0-99'] != null && wRow['300+'] != null && wRow['300+'] / wRow['0-99'] > 1.5,
      `workload arm: matched-index k=10 context DIVERGES across bins (${wRow['0-99']} vs ${wRow['300+']}) — the confound test goes red when it should`);
  say(gA.split_counterfactual_ceiling_usd.chunk_100 > 0 && gW.split_counterfactual_ceiling_usd.chunk_100 === 0,
      `split ceiling: accumulation arm ${gA.split_counterfactual_ceiling_usd.chunk_100} vs workload arm ${gW.split_counterfactual_ceiling_usd.chunk_100} (splitting cannot help a flat context)`);

  // ---- Q3 arms. Cold fleet: every first request is a miss. Warm fleet: every first request hits.
  console.log('\nQ3 bursts — cold vs warm synthetic fleets:');
  const mkBurst = (warm, stagger) => {
    const reqs = [];
    for (let i = 0; i < 6; i++) {
      const t0 = i === 0 ? 0 : (stagger ? 30_000 + i * 1000 : i * 1000);
      const a = synthAgent(`b${warm ? 'w' : 'c'}${stagger ? 's' : 't'}${i}`, 5, 50000, 1000, 'claude-opus-5', t0);
      if (!warm) { a[0].usage.cache_read = 0; a[0].usage.cache_write_5m = 50000; a[0].usd = priceRequest('claude-opus-5', a[0].usage); }
      reqs.push(...a);
    }
    return reqs;
  };
  const cold = experimentBursts(buildAgents(mkBurst(false, false), null), mkBurst(false, false));
  const warm = experimentBursts(buildAgents(mkBurst(true, false), null), mkBurst(true, false));
  say(cold.warm_fraction.tight === 0, `cold fleet warm_fraction ${cold.warm_fraction.tight} == 0`);
  say(warm.warm_fraction.tight === 1, `warm fleet warm_fraction ${warm.warm_fraction.tight} == 1`);
  say(cold.cold_start_control.fires_correctly === true, 'cold fleet: cold-start control fires (cache_read 0, cache_write > 0)');
  say(warm.cold_start_control.fires_correctly === false, 'warm fleet: cold-start control correctly REFUSES to fire — it is not a rubber stamp');
  say(cold.ceiling.pct_of_total_spend > warm.ceiling.pct_of_total_spend,
      `ceiling separates the arms: cold ${cold.ceiling.pct_of_total_spend}% vs warm ${warm.ceiling.pct_of_total_spend}%`);

  // ---- Q1 arm. A known repricing: 1M Opus cache_read tokens cost $0.50; the same flow on Sonnet is
  // $0.20, so routing it saves $0.30. The analysis must recover exactly that.
  console.log('\nQ1 routing — a repricing with a hand-computable answer:');
  const sonnetFlow = synthAgent('s0', 10, 100_000, 0, 'claude-sonnet-5', 0);       // 1.0 Mtok cache_read
  const opusFlow = synthAgent('o0', 10, 100_000, 0, 'claude-opus-5', 1e7);
  const rt = experimentRouting(buildAgents([...sonnetFlow, ...opusFlow], null), [...sonnetFlow, ...opusFlow]);
  say(Math.abs(rt.sonnet.actual_usd - 0.2010) < 0.002, `sonnet flow actual ${rt.sonnet.actual_usd} ~ $0.201 (1 Mtok cache_read @ $0.20 + 100 output tokens)`);
  say(Math.abs(rt.saving_usd - 0.3015) < 0.002, `counterfactual saving ${rt.saving_usd} ~ $0.3015 — the exact price delta on the SAME flow`);
  say(rt.null_control_placebo.would_be_saving_usd > 0.29,
      `placebo control also "saves" ${rt.null_control_placebo.would_be_saving_usd} on identical Opus work — proving the headline measures VOLUME ROUTED, not efficiency`);


  // ---- Q5 arms. FOUR synthetic fleets whose right answers differ. The last two are the ones that
  // earn the live number, because each is a PLAUSIBLE WRONG ANSWER made concrete rather than an
  // empty input that would fail any check by accident.
  //   Arm H  a real handoff, paid in EXTRA REQUESTS rather than heavier ones — the successor reads
  //          for 20 requests before it writes, where a fresh agent writes at 5. Must be DETECTED by
  //          the primary statistic, and — the point of the arm — MISSED by the 60-index integral,
  //          which compares context at matched index and cannot see a longer runway at all.
  //   Arm Z  no handoff. Must NOT be detected; an analysis that finds one here is manufacturing it.
  //   Arm T  no handoff, but the repo grows and every successor was dispatched twenty hours LATE.
  //          The RAW figure must be large and spurious and the TIME-MATCHED one must go to ~0.
  //   Arm S  no handoff, but successors were given NARROWER jobs (slower context growth). This is
  //          the live failure in miniature: the 60-index integral must go strongly NEGATIVE and its
  //          placebo must FIRE, while the primary statistic stays at ~0. It is the arm that proves
  //          the disqualification in the live output is the instrument working, not an excuse.
  console.log('\nQ5 reorientation — four synthetic fleets, including the two traps that disqualified a statistic:');
  const HR = 3600e3;
  const mkFleet = (spec) => { const reqs = []; for (const s of spec) reqs.push(...synthAgent(s.id, s.n, s.ctx0, s.growth, 'claude-opus-5', s.t)); return reqs; };
  const label = (list, isResumed, writeAt) => {
    for (const a of list) {
      const r = isResumed(a.agentId);
      a.description = r ? 'W1-99 thing (successor)' : 'W1-99 thing';
      a.role = 'builder';
      const w = writeAt(r);
      a.tools = a.reqs.map((_, k) => (k === Math.min(w, a.n - 1) ? ['Write'] : ['Read']));
    }
    return list;
  };
  const spec = (id, n, ctx0, growth, t) => ({ id, n, ctx0, growth, t });

  // Arm H — identical context curves, different runway to first write.
  const hs = [];
  for (let i = 0; i < 30; i++) hs.push(spec(`f${i}`, 80, 30_000, 2_000, i * 6 * 60e3));
  for (let i = 0; i < 12; i++) hs.push(spec(`rh${i}`, 80, 30_000, 2_000, i * 12 * 60e3));
  const armH = label(buildAgents(mkFleet(hs), null), (id) => id.startsWith('rh'), (r) => (r ? 20 : 5));
  const q5H = experimentReorientation(armH, null);

  // Arm Z — the same fleet with the same runway on both arms.
  const armZ = label(buildAgents(mkFleet(hs), null), (id) => id.startsWith('rh'), () => 5);
  const q5Z = experimentReorientation(armZ, null);

  // Arm T — no handoff; repo grows 6,000 tokens/hour and successors all ran twenty hours later.
  const ts = [];
  for (let i = 0; i < 30; i++) { const h = i * 0.4; ts.push(spec(`tf${i}`, 80, 30_000 + 6_000 * h, 2_000, h * HR)); }
  for (let i = 0; i < 45; i++) { const h = 16 + i * 0.4; ts.push(spec(`tg${i}`, 80, 30_000 + 6_000 * h, 2_000, h * HR)); }
  for (let i = 0; i < 12; i++) { const h = 24 + i * 0.2; ts.push(spec(`tr${i}`, 80, 30_000 + 6_000 * h, 2_000, h * HR)); }
  const armT = label(buildAgents(mkFleet(ts), null), (id) => id.startsWith('tr'), () => 5);
  const q5T = experimentReorientation(armT, null);

  // Arm S — no handoff; successors were given narrower jobs, so their context grows six times slower.
  const ss = [];
  for (let i = 0; i < 30; i++) ss.push(spec(`sf${i}`, 220, 30_000, 3_000, i * 6 * 60e3));
  for (let i = 0; i < 12; i++) ss.push(spec(`sr${i}`, 220, 30_000, 500, i * 12 * 60e3));
  const armS = label(buildAgents(mkFleet(ss), null), (id) => id.startsWith('sr'), () => 5);
  const q5S = experimentReorientation(armS, null);

  const primary = (q) => q.orientation_cost.resumed.median_delta_usd;
  say(primary(q5H) > 0.3 && primary(q5H) < 0.5,
      `extra-requests arm: orientation cost ${primary(q5H)} detected at the hand-computable size (810k extra tokens @ $0.50/Mtok = $0.405)`);
  say(Math.abs(q5H.diagnostic_integral_DISQUALIFIED.median_usd) < 0.02,
      `extra-requests arm: the 60-index integral reports ${q5H.diagnostic_integral_DISQUALIFIED.median_usd} and MISSES the handoff entirely — the two statistics are not redundant, and the old one was blind to the mechanism that actually operates`);
  say(Math.abs(primary(q5Z)) < 0.02, `no-handoff arm: orientation cost ${primary(q5Z)} ~ 0 — no handoff is manufactured`);
  say(Math.abs(q5H.orientation_cost.fresh_self_control.median_delta_usd) < 0.02,
      `self-control: fresh-vs-fresh ${q5H.orientation_cost.fresh_self_control.median_delta_usd} ~ 0 — the matching is not biased by construction`);
  say(q5H.decision.verdict !== q5Z.decision.verdict,
      `the handoff and no-handoff arms reach DIFFERENT verdicts ('${q5H.decision.verdict}' vs '${q5Z.decision.verdict}')`);
  // the time trap
  const tRaw = q5T.orientation_cost.resumed_raw_unmatched_median_usd, tFix = primary(q5T);
  say(tRaw > 0.05 && tRaw / Math.max(Math.abs(tFix), 1e-4) > 5,
      `time-confound arm: RAW figure ${tRaw} against a time-matched ${tFix} — an uncontrolled analysis reports a spurious handoff a quarter the size of arm H's real one, and the control removes over 80% of it`);
  say(Math.abs(tFix) < 0.02,
      `time-confound arm: TIME-MATCHED figure ${tFix} ~ 0. This is what makes the live number a handoff rather than a calendar.`);
  say(q5T.repo_growth_confound.fresh_c0_vs_hours_slope_tokens_per_hour > 3000,
      `time-confound arm: the confound detector fires on its own (${q5T.repo_growth_confound.fresh_c0_vs_hours_slope_tokens_per_hour} tokens/hour of growth measured)`);
  // the scope trap — the live failure, reproduced
  say(q5S.diagnostic_integral_DISQUALIFIED.median_usd < -1.0,
      `scope-contamination arm: the 60-index integral reports ${q5S.diagnostic_integral_DISQUALIFIED.median_usd} — a large NEGATIVE "handoff" produced entirely by narrower jobs`);
  say(q5S.diagnostic_integral_DISQUALIFIED.n3_late_index_placebo.fired === true,
      `scope-contamination arm: the late-index placebo FIRES, which is how that statistic is caught`);
  say(Math.abs(primary(q5S)) < 0.05,
      `scope-contamination arm: the primary statistic is unmoved at ${primary(q5S)} — it is not fooled by scope`);
  say(q5H.diagnostic_integral_DISQUALIFIED.n3_late_index_placebo.fired === false,
      `and the placebo is not a rubber stamp: on the clean handoff arm it correctly does NOT fire`);

  console.log(`\ncost --experiments-self-test: ${pass ? 'all arms pass and the arms genuinely disagree.' : 'FAILED — see FAIL lines.'}`);
  process.exit(pass ? 0 : 1);
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
const EXP_FLAGS = { '--routing': 'routing', '--growth': 'growth', '--bursts': 'bursts', '--attribution': 'attribution', '--reorientation': 'reorientation' };
const wantedExperiments = new Set(process.argv.filter((a) => EXP_FLAGS[a]).map((a) => EXP_FLAGS[a]));
if (process.argv.includes('--experiments')) for (const k of Object.values(EXP_FLAGS)) wantedExperiments.add(k);

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else if (process.argv.includes('--experiments-self-test')) {
  runExperimentsSelfTest();
} else if (wantedExperiments.size) {
  try {
    const { results, collected } = await runExperiments(wantedExperiments);
    mkdirSync(EXPERIMENTS_DIR, { recursive: true });
    let commit = null;
    try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { }
    // Preserve any `changes` already written; only the results this run owns are replaced.
    let prior = {};
    try { prior = JSON.parse(readFileSync(EXPERIMENTS_PATH, 'utf8')); } catch { }
    const doc = {
      schema: 'elder-souls/cost-experiments@1',
      generated_at: new Date().toISOString(),
      generator: 'tools/cost.mjs --experiments',
      commit,                                   // rule 12: every number is a claim about a commit
      piece: 'COST-EXPERIMENTS-BUILD',
      requests_parsed: collected.priced.length,
      results: { ...(prior.results || {}), ...results },
      changes: Array.isArray(prior.changes) ? prior.changes : [],
    };
    writeFileSync(EXPERIMENTS_PATH, JSON.stringify(doc, null, 2) + String.fromCharCode(10));
    console.error(`cost: wrote ${EXPERIMENTS_PATH.replace(ROOT, '.')} at commit ${commit}`);
  } catch (e) {
    console.error(`cost: FAILED — ${e.message}`);
    process.exitCode = 1;
  }
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
