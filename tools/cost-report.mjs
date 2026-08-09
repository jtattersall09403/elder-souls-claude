#!/usr/bin/env node
// The cost programme, drawn on the page the owner actually opens (COST.md §6).
//
// Owner, twice: "report on the cost optimisation progress appropriately and with visuals in the
// GitHub pages progress report dashboard", and "must have frequent updates on the progress viz so
// that I always know AT ANY POINT how much the project is costing."
//
// THIS FILE COMPUTES NO COST. Rule 10 — two parallel implementations of one system is how this
// build had a good detection model and a broken one at the same time. The instrument
// (`tools/cost.mjs`) is the only thing that prices tokens; this reads the ledger it writes at
// `docs/data/cost-ledger.json` (contract: orchestration/COST.md §6.1) and draws it. Every figure
// on the page is a field in that file. Nothing here divides, sums or rescales money: a number the
// ledger does not state renders as an em dash, on purpose, because a plausible wrong figure is
// worse than a visible gap.
//
// The honesty rules this file exists to enforce, each of which has its own self-test arm:
//   - no ledger        -> say the instrument has not landed, name the path, show no money.
//   - unparseable      -> say so. Draw nothing else.
//   - present but old  -> STALE banner with the age and the timestamp of the reading.
//   - refresh failed   -> say the refresh failed, and give the timestamp of the LAST GOOD reading
//                         rather than serving its number as if it were current.
//   - partially wrong  -> the dangerous one. A string where a number belongs, a NaN, a negative
//                         total: each renders as "—" and is listed under "problems in the ledger",
//                         never as a confident figure.
//   - window not whole -> the headline reads "spend in window", not "spend to date".
//
//   node tools/cost-report.mjs                 # write a standalone preview to /tmp and print state
//   node tools/cost-report.mjs --self-test     # six arms that genuinely disagree (rule 6)
//   node tools/cost-report.mjs --fixture       # preview from tools/cost-fixture.json
//
// Colour: the dataviz method's validated dark categorical steps, checked with the skill's own
// validator against THIS page's surface (#1b1813), not eyeballed —
//   validate_palette.js "#3987e5,#d95926,#199e70,#c98500" --mode dark --surface "#1b1813"
//   -> all checks pass; worst adjacent CVD dE 8.4, normal-vision 19.8, all >= 3:1.
// The 6-8 CVD band requires secondary encoding, so every bar is direct-labelled and every line
// panel is a small multiple with its own heading — identity is never carried by hue alone.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const LEDGER_PATH = 'docs/data/cost-ledger.json';
export const ERROR_PATH = 'docs/data/cost-ledger.error.json';
const DEFAULT_STALE_MINUTES = 45;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- validation
// Deliberately strict. A string "1234.56" is not a number, and accepting it is how a renderer
// starts quietly repairing a broken instrument — at which point nobody finds out the instrument
// is broken. Anything not a finite number becomes null and is reported.
const DASH = '&mdash;';
function mkNum(problems) {
  return function num(v, where, { allowNegative = false } = {}) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      problems.push(`${where}: expected a number, got ${typeof v === 'string' ? `the string ${JSON.stringify(v)}` : JSON.stringify(v)}`);
      return null;
    }
    if (!allowNegative && v < 0) { problems.push(`${where}: negative (${v})`); return null; }
    return v;
  };
}
const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
const arr = v => (Array.isArray(v) ? v : []);

const usd = v => v === null ? DASH : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Cents matter below $1,000 — a target of $20.13 rounded to "$20" is a different bar. Above that
// the cents are noise on a figure nobody reads to the penny.
const usdShort = v => v === null ? DASH : '$' + v.toLocaleString('en-US', { minimumFractionDigits: Math.abs(v) < 1000 ? 2 : 0, maximumFractionDigits: Math.abs(v) < 1000 ? 2 : 0 });
const pct = v => v === null ? DASH : `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
const n1 = v => v === null ? DASH : v.toLocaleString('en-US', { maximumFractionDigits: 1 });
const tok = v => {
  if (v === null) return DASH;
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return Math.round(v / 1e3) + 'k';
  return String(v);
};
const when = iso => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) + 'Z' : null;
};
const ageText = mins => {
  if (mins === null) return 'unknown age';
  if (mins < 1) return 'seconds ago';
  if (mins < 90) return `${Math.round(mins)} min ago`;
  const h = mins / 60;
  return h < 36 ? `${h.toFixed(1)} h ago` : `${(h / 24).toFixed(1)} days ago`;
};

/**
 * Load and validate. Returns { state, ledger, problems, ... }; never throws, because this runs on
 * the commit path and a cost report that stops the fleet has cost more than it saves (rule 13).
 */
export function loadLedger({ root = ROOT, now = Date.now(), ledgerPath = LEDGER_PATH, errorPath = ERROR_PATH } = {}) {
  const problems = [];
  const out = { state: 'missing', ledger: null, problems, path: ledgerPath, failure: null, ageMinutes: null, staleAfter: DEFAULT_STALE_MINUTES };

  // The refresh failure marker is read first and reported whatever else is true: a page that
  // silently serves the previous reading after a failed refresh is exactly the lie §6 forbids.
  const ep = join(root, errorPath);
  if (existsSync(ep)) {
    try {
      const e = JSON.parse(readFileSync(ep, 'utf8'));
      out.failure = { at: str(e.at), message: str(e.message) || 'no message recorded' };
    } catch { out.failure = { at: null, message: 'the failure marker itself could not be parsed' }; }
  }

  const lp = join(root, ledgerPath);
  if (!existsSync(lp)) return out;

  let raw;
  try { raw = JSON.parse(readFileSync(lp, 'utf8')); }
  catch (e) { out.state = 'malformed'; problems.push(`${ledgerPath} is not valid JSON — ${e.message}`); return out; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    out.state = 'malformed'; problems.push(`${ledgerPath} is not an object`); return out;
  }

  const schema = str(raw.schema);
  if (schema && !/^elder-souls\/cost-ledger@1/.test(schema)) {
    problems.push(`schema is "${schema}", not elder-souls/cost-ledger@1 — drawn anyway, field by field, but the contract in COST.md §6.1 is what this page reads`);
  }
  if (!schema) problems.push('no "schema" field — cannot confirm this is a cost ledger');

  const num = mkNum(problems);
  const generatedAt = str(raw.generated_at);
  const gt = Date.parse(generatedAt ?? '');
  if (generatedAt && !Number.isFinite(gt)) problems.push(`generated_at "${generatedAt}" is not a parseable timestamp`);
  if (!generatedAt) problems.push('no generated_at — the age of this reading is unknown, so it is treated as stale');
  out.ageMinutes = Number.isFinite(gt) ? (now - gt) / 60000 : null;
  out.staleAfter = num(raw.stale_after_minutes, 'stale_after_minutes') ?? DEFAULT_STALE_MINUTES;

  const w = raw.window && typeof raw.window === 'object' ? raw.window : {};
  const h = raw.headline && typeof raw.headline === 'object' ? raw.headline : {};
  const b = raw.baseline && typeof raw.baseline === 'object' ? raw.baseline : {};
  const tg = raw.target && typeof raw.target === 'object' ? raw.target : {};
  const g = raw.guards && typeof raw.guards === 'object' ? raw.guards : {};
  if (!raw.headline) problems.push('no "headline" block — the top-of-page figures are unavailable');

  const led = {
    schema, generatedAt, commit: str(raw.commit), generator: str(raw.generator), source: str(raw.source),
    window: {
      from: str(w.from), to: str(w.to), hours: num(w.hours, 'window.hours'),
      // Absent is NOT treated as complete. An incremental roll-up that forgets the flag must read
      // as "spend in window", not as "spend to date".
      complete: w.complete === true,
      completeStated: typeof w.complete === 'boolean',
    },
    prices: raw.prices && typeof raw.prices === 'object' ? raw.prices : null,
    headline: {
      spend: num(h.spend_to_date_usd, 'headline.spend_to_date_usd'),
      burn: num(h.burn_usd_per_hour, 'headline.burn_usd_per_hour'),
      burnWindow: num(h.burn_window_hours, 'headline.burn_window_hours'),
      ch: num(h.ch_usd_per_hour, 'headline.ch_usd_per_hour'),
      chPct: num(h.ch_pct_of_baseline, 'headline.ch_pct_of_baseline'),
      perAgentHour: num(h.usd_per_agent_hour, 'headline.usd_per_agent_hour'),
      perAgentHourPct: num(h.usd_per_agent_hour_pct_of_baseline, 'headline.usd_per_agent_hour_pct_of_baseline'),
    },
    baseline: {
      ch: num(b.usd_per_hour, 'baseline.usd_per_hour'),
      perAgentHour: num(b.usd_per_agent_hour, 'baseline.usd_per_agent_hour'),
      from: str(b.from), to: str(b.to), commit: str(b.commit),
    },
    target: {
      fraction: num(tg.fraction_of_baseline, 'target.fraction_of_baseline'),
      ch: num(tg.usd_per_hour, 'target.usd_per_hour'),
      perAgentHour: num(tg.usd_per_agent_hour, 'target.usd_per_agent_hour'),
    },
    series: arr(raw.series).map((p, i) => ({
      t: str(p?.t), ts: Date.parse(p?.t ?? ''),
      ch: num(p?.usd_per_hour, `series[${i}].usd_per_hour`),
      perAgentHour: num(p?.usd_per_agent_hour, `series[${i}].usd_per_agent_hour`),
      agents: num(p?.mean_agents, `series[${i}].mean_agents`),
      commit: str(p?.commit), note: str(p?.note),
      windowHours: num(p?.window_hours, `series[${i}].window_hours`),
    })).filter(p => Number.isFinite(p.ts)),
    byModel: arr(raw.by_model).map((m, i) => ({
      model: str(m?.model) || `(unnamed model ${i})`,
      usd: num(m?.usd, `by_model[${i}].usd`),
      requests: num(m?.requests, `by_model[${i}].requests`),
      // Read whatever classes the ledger names rather than four fixed keys. The contract was
      // amended from four token classes to five (a 5-minute cache write is 1.25x base input, a
      // 1-hour write is 2x, and both occur here) and a renderer with the class list hard-wired
      // would have silently dropped the new one — the exact failure the split exists to expose.
      tokens: m?.tokens && typeof m.tokens === 'object'
        ? Object.fromEntries(Object.keys(m.tokens).map(k => [k, num(m.tokens[k], `by_model[${i}].tokens.${k}`)]))
        : null,
    })),
    byClass: arr(raw.by_token_class).map((c, i) => ({
      cls: str(c?.class) || `(unnamed class ${i})`,
      usd: num(c?.usd, `by_token_class[${i}].usd`),
      tokens: num(c?.tokens, `by_token_class[${i}].tokens`),
    })),
    guards: {
      // G1 publishes TWO honest readings that disagree, and the contract requires both on the page:
      // mean_agents counts agents that issued a request in the hour; mean_agents_present counts
      // agents alive between their first and last request. A >20% divergence means agents are
      // alive and idle, which is a cost finding in its own right, so the flag is drawn, not hidden.
      g1: g.g1_parallelism && typeof g.g1_parallelism === 'object' ? {
        agents: num(g.g1_parallelism.mean_agents, 'guards.g1_parallelism.mean_agents'),
        present: num(g.g1_parallelism.mean_agents_present, 'guards.g1_parallelism.mean_agents_present'),
        divergence: g.g1_parallelism.divergence_flag === true,
        floor: num(g.g1_parallelism.floor, 'guards.g1_parallelism.floor'),
        status: str(g.g1_parallelism.status),
        windowHours: num(g.g1_parallelism.window_hours, 'guards.g1_parallelism.window_hours'),
      } : null,
      // G2 is one-sided and low-powered and says so on the page. The structural alarm is a
      // find-rate of ZERO (rule 23), which is what a context-cutting change produces; the windowed
      // mean score is a tripwire, never proof, and must never be drawn as proof.
      g2: g.g2_quality && typeof g.g2_quality === 'object' ? {
        score: num(g.g2_quality.mean_verdict_score, 'guards.g2_quality.mean_verdict_score'),
        scoreBase: num(g.g2_quality.baseline_mean_verdict_score, 'guards.g2_quality.baseline_mean_verdict_score'),
        n: num(g.g2_quality.n, 'guards.g2_quality.n'),
        power: str(g.g2_quality.power),
        find: num(g.g2_quality.critic_find_rate, 'guards.g2_quality.critic_find_rate'),
        findBase: num(g.g2_quality.baseline_critic_find_rate, 'guards.g2_quality.baseline_critic_find_rate'),
        regrade: g.g2_quality.regrade && typeof g.g2_quality.regrade === 'object' ? {
          piece: str(g.g2_quality.regrade.piece),
          known: num(g.g2_quality.regrade.known_findings, 'guards.g2_quality.regrade.known_findings'),
          recovered: num(g.g2_quality.regrade.recovered, 'guards.g2_quality.regrade.recovered'),
        } : null,
        status: str(g.g2_quality.status),
      } : null,
      // G3: four of the five non-negotiables are not honestly measurable today and ship as null
      // with a stated reason. The page must show "1 of 5 measured", never a green 5/5 — a guard
      // measurable only by grepping for its own name is gameable by the process it constrains.
      g3: g.g3_rigour && typeof g.g3_rigour === 'object' ? {
        counts: g.g3_rigour.counts && typeof g.g3_rigour.counts === 'object' ? g.g3_rigour.counts : null,
        base: g.g3_rigour.baseline_counts && typeof g.g3_rigour.baseline_counts === 'object' ? g.g3_rigour.baseline_counts : null,
        unmeasured: arr(g.g3_rigour.unmeasured).filter(x => typeof x === 'string'),
        unmeasuredReason: str(g.g3_rigour.unmeasured_reason),
        status: str(g.g3_rigour.status),
      } : null,
    },
    // Blocks added to the contract by the instrument on 2026-08-08.
    comparableKey: str(raw.comparable_key),
    coverage: raw.coverage && typeof raw.coverage === 'object' ? {
      filesTotal: num(raw.coverage.files_total, 'coverage.files_total'),
      filesRead: num(raw.coverage.files_read, 'coverage.files_read'),
      bytesRead: num(raw.coverage.bytes_read, 'coverage.bytes_read'),
      complete: raw.coverage.complete === true,
      stated: typeof raw.coverage.complete === 'boolean',
    } : null,
    drivers: raw.drivers && typeof raw.drivers === 'object' ? {
      requests: num(raw.drivers.requests, 'drivers.requests'),
      meanContext: num(raw.drivers.mean_context_tokens, 'drivers.mean_context_tokens'),
      pie: num(raw.drivers.pie_tokens, 'drivers.pie_tokens'),
      perAgentHour: num(raw.drivers.requests_per_agent_hour, 'drivers.requests_per_agent_hour'),
    } : null,
    denominator: raw.denominator && typeof raw.denominator === 'object' ? {
      definition: str(raw.denominator.definition),
      active: num(raw.denominator.active_hours, 'denominator.active_hours'),
      agentHours: num(raw.denominator.agent_hours, 'denominator.agent_hours'),
      span: num(raw.denominator.span_hours, 'denominator.span_hours'),
    } : null,
    changes: arr(raw.changes).map((c, i) => ({
      id: str(c?.id) || `#${i + 1}`, title: str(c?.title) || '(untitled change)',
      landed: str(c?.landed), commit: str(c?.commit),
      state: (str(c?.state) || 'unstated').toLowerCase(),
      beforeCh: num(c?.before?.usd_per_hour, `changes[${i}].before.usd_per_hour`),
      afterCh: num(c?.after?.usd_per_hour, `changes[${i}].after.usd_per_hour`),
      beforePah: num(c?.before?.usd_per_agent_hour, `changes[${i}].before.usd_per_agent_hour`),
      afterPah: num(c?.after?.usd_per_agent_hour, `changes[${i}].after.usd_per_agent_hour`),
      deltaPct: num(c?.delta_pct, `changes[${i}].delta_pct`, { allowNegative: true }),
      reversal: str(c?.reversal), reversalExecuted: c?.reversal_executed === true,
      tripwire: str(c?.tripwire), outcome: str(c?.outcome),
    })),
  };

  out.ledger = led;
  const tooOld = out.ageMinutes === null || out.ageMinutes > out.staleAfter;
  // A refresh failure outranks staleness: the reader must be told the number stopped updating,
  // not merely that it is old.
  if (out.failure) out.state = 'failed';
  else if (tooOld) out.state = 'stale';
  else out.state = 'fresh';
  return out;
}

// ------------------------------------------------------------------- drawing
const C = {
  ch: '#3987e5',        // slot 1 — cost per hour
  pah: '#d95926',       // slot 2 — cost per agent-hour
  agents: '#199e70',    // slot 3 — parallelism (a guard, drawn on the same x as the cost)
  extra: '#c98500',     // slot 4 — fourth bar category
  fifth: '#d55181',     // slot 5 — fifth bar category (the second cache-write class)
  target: '#7d9a5a', baseline: '#9a8f79', grid: '#332d24', ink: '#e8ddc8', dim: '#9a8f79',
  surface: '#1b1813', good: '#7d9a5a', warn: '#c8a253', bad: '#b4553f',
};
// Five slots, because the contract now carries five token classes. Validated as a set against this
// page's surface, not eyeballed:
//   validate_palette.js "#3987e5,#d95926,#199e70,#c98500,#d55181" --mode dark --surface "#1b1813"
//   -> all pass; worst adjacent CVD dE 8.4, normal-vision 19.3, all >= 3:1.
const BAR_COLOURS = [C.ch, C.pah, C.agents, C.extra, C.fifth];

const svgEl = (tag, attrs, inner = '') =>
  `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}${inner ? `>${inner}</${tag}>` : '/>'}`;

/** One small-multiple line panel: every measurement as a dot, reference levels marked. */
function linePanel({ title, unit, pointUnit = '', points, colour, refs = [], W = 960, H = 190, fmt = n1 }) {
  // R is the gutter the reference labels live in. It was 116 and "target $20.13 (25%)" ran off the
  // right edge of the SVG — a target the reader cannot finish reading is not a marked target.
  const L = 62, R = 168, T = 26, B = 26;
  const pts = points.filter(p => p.y !== null);
  if (!pts.length) return `<div class="cost-panel"><h3>${esc(title)}</h3><div class="cost-empty">no measurements in the ledger yet</div></div>`;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const refVals = refs.map(r => r.value).filter(v => v !== null && v !== undefined);
  const yMax = Math.max(...ys, ...refVals) * 1.12 || 1;
  const t0 = Math.min(...xs), t1 = Math.max(...xs);
  const sx = t => L + (t1 === t0 ? (W - L - R) / 2 : ((t - t0) / (t1 - t0)) * (W - L - R));
  const sy = v => T + (1 - v / yMax) * (H - T - B);

  let s = '';
  // Recessive grid, four steps.
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i, y = sy(v);
    s += svgEl('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: C.grid, 'stroke-width': 1, opacity: i ? 0.7 : 1 });
    s += svgEl('text', { x: L - 8, y: y + 4, fill: C.dim, 'font-size': 11, 'text-anchor': 'end' }, esc(fmt(v)));
  }
  // Reference levels, each directly labelled — never a bare line the reader must decode.
  for (const r of refs) {
    if (r.value === null || r.value === undefined) continue;
    const y = sy(r.value);
    s += svgEl('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: r.colour, 'stroke-width': 2, 'stroke-dasharray': r.dash || '5 4', opacity: 0.9 });
    s += svgEl('text', { x: W - R + 8, y: y + 4, fill: r.colour, 'font-size': 11 }, esc(r.label));
  }
  // The line, then every dot on top of it. "Line charts with many dots on them" — the owner.
  s += svgEl('polyline', {
    points: pts.map(p => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' '),
    fill: 'none', stroke: colour, 'stroke-width': 2, 'stroke-linejoin': 'round',
  });
  for (const p of pts) {
    s += `<g class="cost-dot"><title>${esc(p.tip)}</title>${svgEl('circle', {
      cx: sx(p.x).toFixed(1), cy: sy(p.y).toFixed(1), r: 4.5, fill: colour, stroke: C.surface, 'stroke-width': 2,
    })}</g>`;
  }
  // The newest reading, labelled directly, because it is the one the reader came for.
  const last = pts[pts.length - 1];
  // The dot label carries the per-unit only ("$42.10/h"), not the axis unit ("$/h"), or it reads
  // "$42.10$/h".
  s += svgEl('text', { x: Math.min(sx(last.x) + 10, W - R - 4), y: sy(last.y) - 10, fill: colour, 'font-size': 12, 'font-weight': 600 }, esc(fmt(last.y) + pointUnit));
  s += svgEl('text', { x: L, y: H - 6, fill: C.dim, 'font-size': 10 }, esc(when(new Date(t0).toISOString()) || ''));
  s += svgEl('text', { x: W - R, y: H - 6, fill: C.dim, 'font-size': 10, 'text-anchor': 'end' }, esc(when(new Date(t1).toISOString()) || ''));

  return `<div class="cost-panel"><h3>${esc(title)} <span class="cost-unit">${esc(unit)}</span> <span class="cost-n">${pts.length} measurement${pts.length === 1 ? '' : 's'}</span></h3>
<div class="cost-scroll"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${s}</svg></div></div>`;
}

/** Horizontal bars for a split. Every bar direct-labelled: identity never rests on hue alone. */
function barPanel({ title, rows, note }) {
  const good = rows.filter(r => r.value !== null);
  if (!good.length) return `<div class="cost-panel"><h3>${esc(title)}</h3><div class="cost-empty">not in the ledger</div></div>`;
  const max = Math.max(...good.map(r => r.value)) || 1;
  const body = rows.map((r, i) => {
    const w = r.value === null ? 0 : Math.max(1.5, (r.value / max) * 100);
    const col = BAR_COLOURS[i % BAR_COLOURS.length];
    return `<div class="cost-bar-row">
      <div class="cost-bar-label">${esc(r.label)}</div>
      <div class="cost-bar-track"><i style="width:${w.toFixed(1)}%;background:${col}"></i></div>
      <div class="cost-bar-val">${r.display}</div>
      <div class="cost-bar-sub">${esc(r.sub || '')}</div>
    </div>`;
  }).join('\n');
  return `<div class="cost-panel"><h3>${esc(title)}</h3>${note ? `<div class="cost-note">${esc(note)}</div>` : ''}<div class="cost-bars">${body}</div></div>`;
}

function guardTile({ label, value, sub, status }) {
  const cls = status === 'breach' || status === 'bad' ? 'bad' : status === 'ok' || status === 'good' ? 'ok' : status === 'warn' ? 'warn' : 'dimtext';
  const mark = status === 'breach' || status === 'bad' ? '&#10007;' : status === 'ok' || status === 'good' ? '&#10003;' : '&middot;';
  return `<div class="cost-tile cost-guard"><div class="cost-tile-v ${cls}">${value}</div>
    <div class="cost-tile-l">${label}</div><div class="cost-tile-s"><span class="${cls}">${mark}</span> ${sub}</div></div>`;
}

/**
 * The whole section, as HTML for docs/progress.html. Pure: give it a load result, get a string.
 */
export function renderCost(load) {
  const { state, ledger, problems, failure } = load;
  const lastGood = ledger?.generatedAt ? when(ledger.generatedAt) : null;

  // --- the banner. It is the first thing on the page and it must never read as current when it
  //     is not. Each state says what is true, when it was true, and what to do about it.
  let banner, bannerClass;
  if (state === 'missing') {
    bannerClass = 'cost-banner-wait';
    banner = `<b>The cost instrument has not landed yet.</b> This page renders <code>${esc(LEDGER_PATH)}</code> and computes no cost of its own (rule 10 &mdash; one implementation of one system).
      Until <code>tools/cost.mjs</code> writes that file there is nothing here to show, and inventing a figure would be worse than an empty panel.
      Contract: <code>orchestration/COST.md</code> §6.1 &middot; shape: <code>tools/cost-fixture.json</code>.`;
  } else if (state === 'malformed') {
    bannerClass = 'cost-banner-bad';
    banner = `<b>The cost ledger could not be read.</b> <code>${esc(LEDGER_PATH)}</code> exists but does not parse, so <b>no cost figure is shown at all</b> &mdash; the previous reading is not redrawn as if it were current. ${problems.map(p => esc(p)).join(' &middot; ')}`;
  } else if (state === 'failed') {
    bannerClass = 'cost-banner-bad';
    banner = `<b>Cost regeneration FAILED${failure?.at ? ` at ${esc(when(failure.at) || failure.at)}` : ''}.</b> ${esc(failure?.message || '')}<br>
      The figures below are the <b>last good reading, taken ${esc(lastGood || 'at an unknown time')}${load.ageMinutes !== null ? ` &mdash; ${esc(ageText(load.ageMinutes))}` : ''}</b>. They are not current. Fix the instrument before quoting them.`;
  } else if (state === 'stale') {
    bannerClass = 'cost-banner-warn';
    banner = `<b>STALE.</b> The last good reading was taken ${esc(lastGood || 'at an unknown time')}${load.ageMinutes !== null ? ` (${esc(ageText(load.ageMinutes))})` : ''}, older than the ${n1(load.staleAfter)} minute freshness bar. It refreshes on every bank; if this stays stale the instrument has stopped running.`;
  } else {
    bannerClass = 'cost-banner-ok';
    banner = `Reading taken <b>${esc(lastGood)}</b> (${esc(ageText(load.ageMinutes))})${ledger.commit ? ` at commit <code>${esc(ledger.commit.slice(0, 7))}</code>` : ''}, and it refreshes on every bank.`;
  }

  const head = `<h2 id="cost">What this is costing <span class="dimtext">(the efficiency programme &mdash; <code>orchestration/COST.md</code>)</span></h2>
<div class="cost-banner ${bannerClass}">${banner}</div>`;

  if (!ledger) return `<section class="cost">${head}</section>`;

  // --- headline. Spend first: it is the question "what has this cost me so far" (COST.md §6).
  const windowLine = ledger.window.from && ledger.window.to
    ? `${esc(when(ledger.window.from) || ledger.window.from)} &rarr; ${esc(when(ledger.window.to) || ledger.window.to)}${ledger.window.hours !== null ? ` &middot; ${n1(ledger.window.hours)} h of fleet runtime` : ''}`
    : 'window not stated in the ledger';
  const spendLabel = ledger.window.complete ? 'Spend to date' : 'Spend in this window';
  const spendCaveat = ledger.window.complete ? ''
    : `<div class="cost-caveat">This is <b>not</b> the whole project: the ledger does not declare <code>window.complete</code>, so the total above covers only the window named below. Earlier spend is not included.</div>`;

  // Coverage. The source is hundreds of transcript files and reading only the top-level glob
  // under-reports by roughly ten times while looking entirely plausible — so a partial read is
  // called out above the number, not beneath it. The contract requires every headline field to be
  // null when coverage.complete is false, which is what makes the dashes appear.
  const cov = ledger.coverage;
  const coverageBlock = !cov ? ''
    : cov.complete
      ? `<div class="cost-caveat cost-caveat-ok">Read <b>${cov.filesRead === null ? DASH : cov.filesRead.toLocaleString('en-US')}</b> of ${cov.filesTotal === null ? DASH : cov.filesTotal.toLocaleString('en-US')} transcript files${cov.bytesRead === null ? '' : ` (${(cov.bytesRead / 1e9).toFixed(2)} GB)`} &mdash; complete.</div>`
      : `<div class="cost-caveat"><b>PARTIAL READ.</b> Only ${cov.filesRead === null ? DASH : cov.filesRead.toLocaleString('en-US')} of ${cov.filesTotal === null ? DASH : cov.filesTotal.toLocaleString('en-US')} transcript files were read${cov.stated ? '' : ', and the ledger does not state whether the read was complete'}. Every headline figure is withheld rather than shown low: an under-count reads as good news, which is the direction that hides a problem.</div>`;

  // Which denominator produced "per hour". Idle hours are excluded on purpose — with a wall-clock
  // denominator, switching the fleet off improves the metric, which is the one outcome the owner
  // explicitly forbade. Publishing the choice beside the number keeps it auditable.
  const den = ledger.denominator;
  const denLine = !den ? '' : `<div class="cost-hero-s" style="margin-top:8px">Per hour of <b>${esc(den.definition || 'unstated')}</b>: ${n1(den.active)} active h of ${n1(den.span)} elapsed &middot; ${n1(den.agentHours)} agent-hours. Idle hours are excluded, or switching the fleet off would improve the metric.</div>`;

  const hero = `<div class="cost-hero">
  <div class="cost-hero-main">
    <div class="cost-hero-l">${spendLabel}</div>
    <div class="cost-hero-n">${usd(ledger.headline.spend)}</div>
    <div class="cost-hero-s">${windowLine}</div>
    ${denLine}
    ${spendCaveat}
    ${coverageBlock}
  </div>
  <div class="cost-hero-side">
    <div class="cost-tile"><div class="cost-tile-v">${usdShort(ledger.headline.burn)}<span class="cost-per">/h</span></div>
      <div class="cost-tile-l">Burn rate now</div>
      <div class="cost-tile-s">${ledger.headline.burnWindow !== null ? `over the last ${n1(ledger.headline.burnWindow)} h` : 'window not stated'}</div></div>
    <div class="cost-tile"><div class="cost-tile-v">${usdShort(ledger.headline.ch)}<span class="cost-per">/h</span></div>
      <div class="cost-tile-l">C/H &mdash; the headline metric</div>
      <div class="cost-tile-s">${ledger.headline.chPct === null ? 'no baseline stated' : `${pct(ledger.headline.chPct)} of baseline &middot; bar is ${ledger.target.fraction === null ? '25' : n1(ledger.target.fraction * 100)}%`}</div></div>
    <div class="cost-tile"><div class="cost-tile-v">${usdShort(ledger.headline.perAgentHour)}<span class="cost-per">/agent-h</span></div>
      <div class="cost-tile-l">Cost per agent-hour</div>
      <div class="cost-tile-s">${ledger.headline.perAgentHourPct === null ? 'no baseline stated' : `${pct(ledger.headline.perAgentHourPct)} of baseline`} &mdash; if this did not fall, the fleet just got smaller</div></div>
  </div>
</div>`;

  // --- the guards, in the same panel as the cost. COST.md §5: "a cost number published without
  //     G1-G3 beside it is not a result", so they are not separable by layout either.
  const g = ledger.guards;
  // G3: measured means a number is present. Four of the five ship as null with a stated reason, so
  // "1 of 5 measured" is the honest headline — never a green 5/5 over four blanks.
  const g3counts = g.g3?.counts ? Object.entries(g.g3.counts) : [];
  const g3measured = g3counts.filter(([, v]) => typeof v === 'number').length;
  const g3total = g3counts.length || 5;
  const findZero = g.g2 && g.g2.find === 0;   // rule 23: the structural alarm, not the mean score.

  const guards = `<div class="cost-guards">
  <div class="cost-guards-h">The guards. <span class="dimtext">A cost figure published without these is not a result &mdash; C/H alone is gamed by running fewer agents.</span></div>
  <div class="cost-tiles">
    ${guardTile({
      label: 'G1 &mdash; mean concurrent agents',
      value: g.g1 ? n1(g.g1.agents) : DASH,
      sub: g.g1
        ? `floor ${g.g1.floor === null ? '12' : n1(g.g1.floor)}${g.g1.windowHours !== null ? ` &middot; over ${n1(g.g1.windowHours)} h` : ''}` +
          `${g.g1.present === null ? '' : `<br>${n1(g.g1.present)} alive on the second reading${g.g1.divergence ? ' &mdash; <b>they disagree by more than 20%, so agents are alive and idle</b>' : ''}`}`
        : 'not in the ledger',
      status: g.g1?.status,
    })}
    ${guardTile({
      label: 'G2a &mdash; verdict score <span class="cost-weak">tripwire, low power</span>',
      value: g.g2 ? n1(g.g2.score) : DASH,
      sub: g.g2
        ? `baseline ${n1(g.g2.scoreBase)} / 10${g.g2.n === null ? '' : ` &middot; n=${n1(g.g2.n)}`}${g.g2.power ? ` &middot; power ${esc(g.g2.power)}` : ''}<br>One-sided and under-powered: it cannot prove quality held, only shout if it falls.`
        : 'not in the ledger',
      status: g.g2?.status,
    })}
    ${guardTile({
      label: 'G2 &mdash; critic find-rate',
      value: g.g2 ? n1(g.g2.find) : DASH,
      sub: g.g2
        ? `baseline ${n1(g.g2.findBase)} findings per critic${findZero ? '<br><b>ZERO findings &mdash; audit evidence rigour and outcome mix; do not assume either softness or satisfaction.</b>' : ''}` +
          `${g.g2.regrade ? `<br>G2b re-grade on <code>${esc(g.g2.regrade.piece || '?')}</code>: ${n1(g.g2.regrade.recovered)} of ${n1(g.g2.regrade.known)} known findings recovered` : '<br>G2b controlled re-grade: not run yet'}`
        : 'not in the ledger',
      status: findZero ? 'bad' : g.g2?.status,
    })}
    ${guardTile({
      label: 'G3 &mdash; the five non-negotiables',
      value: g3counts.length ? `${g3measured}/${g3total} <span class="cost-weak">measured</span>` : DASH,
      sub: g3counts.length
        ? g3counts.map(([k, v]) => `${esc(k.replace(/_/g, ' '))} ${typeof v === 'number' ? v : '<span class="warn">unmeasured</span>'}${g.g3.base && typeof g.g3.base[k] === 'number' ? ` (was ${g.g3.base[k]})` : ''}`).join(' &middot; ') +
          (g.g3.unmeasuredReason ? `<br><b>${g.g3.unmeasured.length} of ${g3total} are not honestly measurable yet</b> &mdash; ${esc(g.g3.unmeasuredReason)}.` : '')
        : 'not in the ledger',
      status: g.g3?.status === 'partial' ? 'warn' : g.g3?.status,
    })}
  </div>
</div>`;

  // --- the three panels share one x-axis: C/H, cost per agent-hour, and the parallelism guard.
  //     Two measures of different scale never share a y-axis (no dual axes, ever), so they are
  //     small multiples; putting G1 in the same stack is what stops cost being read alone.
  const mk = (key, fmtFn) => ledger.series.map(p => ({
    x: p.ts, y: p[key],
    tip: `${when(p.t)}\n${key === 'agents' ? `${n1(p.agents)} agents` : usd(p[key]) + (key === 'ch' ? ' per hour' : ' per agent-hour')}` +
      `${p.commit ? `\ncommit ${p.commit.slice(0, 7)}` : ''}${p.windowHours !== null ? `\nmeasured over ${n1(p.windowHours)} h` : ''}${p.note ? `\n${p.note}` : ''}`,
  }));
  const provisional = cov && !cov.complete
    ? '<div class="cost-problems">These charts are drawn from a <b>partial read</b> of the transcript. The instrument withholds the headline totals in this state; the series below are whatever it did publish, and they under-report by an unknown amount.</div>'
    : '';
  const charts = ledger.series.length ? provisional + `
${linePanel({
    title: 'C/H — model spend per hour of fleet runtime', unit: '$/h', pointUnit: '/h', colour: C.ch, points: mk('ch'), fmt: usdShort,
    refs: [
      { value: ledger.baseline.ch, colour: C.baseline, label: `baseline ${usdShort(ledger.baseline.ch)}`, dash: '2 4' },
      { value: ledger.target.ch, colour: C.target, label: `target ${usdShort(ledger.target.ch)} · ${ledger.target.fraction === null ? '25' : n1(ledger.target.fraction * 100)}% bar` },
    ],
  })}
${linePanel({
    title: 'Cost per agent-hour — the diagnostic that proves efficiency, not idling', unit: '$/agent-h', pointUnit: '/agent-h', colour: C.pah, points: mk('perAgentHour'), fmt: usdShort,
    refs: [
      { value: ledger.baseline.perAgentHour, colour: C.baseline, label: `baseline ${usdShort(ledger.baseline.perAgentHour)}`, dash: '2 4' },
      { value: ledger.target.perAgentHour, colour: C.target, label: `target ${usdShort(ledger.target.perAgentHour)}` },
    ],
  })}
${linePanel({
    title: 'G1 — mean concurrent agents, on the same clock as the cost', unit: 'agents', pointUnit: ' agents', colour: C.agents, points: mk('agents'),
    refs: [{ value: ledger.guards.g1?.floor ?? 12, colour: C.warn, label: `floor ${n1(ledger.guards.g1?.floor ?? 12)}` }],
  })}
<details class="cost-details"><summary>Every measurement, as a table</summary>
<div class="cost-scroll"><table><tr><th>Taken</th><th>C/H</th><th>$/agent-h</th><th>Agents</th><th>Commit</th><th>Note</th></tr>
${ledger.series.slice().reverse().map(p => `<tr><td>${esc(when(p.t) || p.t)}</td><td>${usd(p.ch)}</td><td>${usd(p.perAgentHour)}</td><td>${n1(p.agents)}</td><td><code>${esc((p.commit || '').slice(0, 7))}</code></td><td class="rem">${esc(p.note || '')}</td></tr>`).join('\n')}
</table></div></details>` : `<div class="cost-empty">The ledger carries no measurements yet, so there is nothing to plot. One dot appears per instrument run.</div>`;

  // --- the two levers, split out, because a single total hides both.
  const modelBars = barPanel({
    title: 'Cost by model',
    note: 'Routing is the largest single lever: 3,230 Opus requests against 29 Sonnet when the programme opened.',
    rows: ledger.byModel.map(m => ({
      label: m.model, value: m.usd, display: usd(m.usd),
      // Whatever classes the ledger names, in its order. Nothing is hard-wired here: the class list
      // has already changed once under this renderer, from four to five.
      sub: `${m.requests === null ? DASH : m.requests.toLocaleString('en-US')} distinct requests${m.tokens ? ' · ' + Object.entries(m.tokens).map(([k, v]) => `${k.replace(/_/g, ' ')} ${tok(v)}`).join(' / ') : ''}`,
    })),
  });
  // WHY the cost is what it is. Cost here is context volume × request count, not verbosity, and a
  // page that shows only the total never says so — every lever lives in the why.
  const d = ledger.drivers;
  const driverPanel = !d ? '' : `<div class="cost-panel"><h3>What drives it</h3>
<div class="cost-note">Cost is context volume multiplied by request count, not how much anything writes. These four numbers are where the levers act.</div>
<div class="cost-tiles">
  <div class="cost-tile"><div class="cost-tile-v">${d.requests === null ? DASH : d.requests.toLocaleString('en-US')}</div><div class="cost-tile-l">Requests</div><div class="cost-tile-s">distinct API responses, not transcript records</div></div>
  <div class="cost-tile"><div class="cost-tile-v">${tok(d.meanContext)}</div><div class="cost-tile-l">Mean context per request</div><div class="cost-tile-s">what every request pays to re-read</div></div>
  <div class="cost-tile"><div class="cost-tile-v">${tok(d.pie)}</div><div class="cost-tile-l">Price-indexed token volume</div><div class="cost-tile-s">model-independent volume, so mix and volume never confound</div></div>
  <div class="cost-tile"><div class="cost-tile-v">${n1(d.perAgentHour)}</div><div class="cost-tile-l">Requests per agent-hour</div><div class="cost-tile-s">how hard each agent-hour leans on the API</div></div>
</div></div>`;

  const classBars = barPanel({
    title: 'Cost by token class',
    note: 'Input, two kinds of cache write (5-minute and 1-hour, billed differently), cache read and output are five different prices. A single total hides cache economics entirely.',
    rows: ledger.byClass.map(c => ({
      label: c.cls.replace(/_/g, ' '), value: c.usd, display: usd(c.usd),
      sub: `${tok(c.tokens)} tokens`,
    })),
  });

  // --- every change, including the reversed ones.
  const stateCls = s => s === 'kept' ? 'ok' : s === 'reversed' ? 'bad' : s === 'trial' ? 'warn' : 'dimtext';
  const changes = `<div class="cost-panel"><h3>Every change, kept or reversed <span class="cost-n">${ledger.changes.length}</span></h3>
<div class="cost-note">A ledger showing only what worked is the same failure as a critic who finds no gaps. Reversibility is a hard requirement: a change whose reversal has never been executed on a copy is only believed to be reversible.</div>
<div class="cost-scroll cost-wide"><table><tr><th>Change</th><th>State</th><th>C/H before</th><th>C/H after</th><th>Delta</th><th>Reversal</th><th>Tripwire &amp; outcome</th></tr>
${ledger.changes.length ? ledger.changes.map(c => `<tr>
  <td><b>${esc(c.id)}</b> ${esc(c.title)}<div class="rem">${esc(when(c.landed) || '')}${c.commit ? ` &middot; <code>${esc(c.commit.slice(0, 7))}</code>` : ''}</div></td>
  <td class="${stateCls(c.state)}">${esc(c.state)}</td>
  <td>${usdShort(c.beforeCh)}${c.beforePah !== null ? `<div class="rem">${usdShort(c.beforePah)}/agent-h</div>` : ''}</td>
  <td>${usdShort(c.afterCh)}${c.afterPah !== null ? `<div class="rem">${usdShort(c.afterPah)}/agent-h</div>` : ''}</td>
  <td class="${c.deltaPct === null ? 'dimtext' : c.deltaPct < 0 ? 'ok' : 'bad'}">${c.deltaPct === null ? DASH : (c.deltaPct > 0 ? '+' : '') + pct(c.deltaPct)}</td>
  <td class="rem"><code>${esc(c.reversal || '')}</code><div class="${c.reversalExecuted ? 'ok' : 'warn'}">${c.reversalExecuted ? '&#10003; executed on a copy' : 'not yet executed &mdash; not reversible until it has been'}</div></td>
  <td class="rem">${esc(c.tripwire || '')}${c.outcome ? `<div class="gapq">${esc(c.outcome)}</div>` : ''}</td>
</tr>`).join('\n') : '<tr><td colspan=7 class="empty">no changes recorded yet &mdash; the programme has not landed one</td></tr>'}
</table></div></div>`;

  const problemBlock = problems.length ? `<div class="cost-problems"><b>${problems.length} problem${problems.length === 1 ? '' : 's'} in the ledger</b> &mdash; each of these renders as ${DASH} above rather than as a number:
    <ul>${problems.slice(0, 12).map(p => `<li>${esc(p)}</li>`).join('')}</ul>${problems.length > 12 ? `<div class="rem">and ${problems.length - 12} more.</div>` : ''}</div>` : '';

  // The price table, published so a reader can audit the money rather than take it on trust. The
  // page prints it; it never multiplies by it.
  const prices = ledger.prices;
  const pricesEffective = prices && typeof prices.effective === 'string' ? prices.effective : null;
  const pricesLine = !prices ? '' : Object.entries(prices)
    .filter(([k, v]) => v && typeof v === 'object')
    .map(([model, tbl]) => `${model} ${Object.entries(tbl).map(([k, v]) => `${k.replace(/_/g, ' ')} $${v}`).join(' / ')} per Mtok`)
    .join(' · ');

  const foot = `<div class="cost-foot">Rendered from <code>${esc(LEDGER_PATH)}</code>${ledger.generator ? ` written by <code>${esc(ledger.generator)}</code>` : ''}${ledger.source ? ` from <code>${esc(ledger.source)}</code>` : ''}.
    This page computes no cost: every figure above is a field in that file (contract: <code>orchestration/COST.md</code> §6.1).
    ${ledger.comparableKey ? `Comparability key <code>${esc(ledger.comparableKey)}</code> &mdash; two readings are comparable only if this matches; the page reports it and never infers it.` : ''}
    ${prices ? `Priced from the table published in the ledger${pricesEffective ? `, effective ${esc(pricesEffective)}` : ''}: ${esc(pricesLine)}` : ''}</div>`;

  return `<section class="cost">${head}${hero}${guards}${problemBlock}${charts}<div class="cost-two">${modelBars}${classBars}</div>${driverPanel}${changes}${foot}</section>`;
}

/**
 * One line for the site header. The full section lives behind a tab on docs/index.html, and the
 * owner's requirement is that they know what this costs "at any point" — one click away is not
 * that. Same loader, same fields, no second implementation: this is a shorter view of the same
 * data, and it carries its own freshness word so a strip can never read as current when it is not.
 */
export function costStripHtml(opts = {}) {
  try {
    const load = loadLedger(opts);
    const l = load.ledger;
    if (!l) return `<div class="cost-strip"><a href="#cost">Cost</a> <span class="cost-strip-dim">&mdash; ${load.state === 'malformed' ? 'ledger unreadable' : 'instrument not landed yet'}, so no figure is published</span></div>`;
    const word = load.state === 'failed' ? '<b class="bad">REFRESH FAILED</b>' : load.state === 'stale' ? '<b class="warn">STALE</b>' : '<span class="ok">&#10003;</span>';
    return `<div class="cost-strip">${word} <a href="#cost">${l.window.complete ? 'Spend to date' : 'Spend in window'}</a>
      <b>${usd(l.headline.spend)}</b> <span class="cost-strip-dim">&middot; burn ${usdShort(l.headline.burn)}/h &middot; C/H ${usdShort(l.headline.ch)}/h${l.headline.chPct === null ? '' : ` (${pct(l.headline.chPct)} of baseline, bar 25%)`} &middot; agents ${n1(l.guards.g1?.agents ?? null)} &middot; read ${esc(when(l.generatedAt) || 'at an unknown time')}, ${esc(ageText(load.ageMinutes))}</span></div>`;
  } catch { return ''; }
}

export const COST_CSS = `
.cost-strip{font-size:11px;color:var(--dim);margin-top:8px;line-height:1.6}
.cost-strip a{color:var(--gold);text-decoration:none;border-bottom:1px dotted var(--gold)}
.cost-strip b{color:var(--ink)}
.cost-strip-dim{color:var(--dim)}
.cost{margin:0 0 34px}
.cost-banner{border:1px solid var(--line);border-radius:6px;padding:12px 15px;font-size:12px;line-height:1.7;margin-bottom:14px}
.cost-banner-ok{border-color:#3f5230;background:linear-gradient(180deg,#161d12,#1b1813);color:var(--dim)}
.cost-banner-warn{border-color:#6b5522;background:linear-gradient(180deg,#241f12,#1b1813);color:#e6cf9a}
.cost-banner-bad{border-color:#6b2f22;background:linear-gradient(180deg,#241512,#1b1813);color:#e8b6a6}
.cost-banner-wait{border-color:var(--line);background:var(--panel);color:var(--dim)}
.cost-hero{display:grid;grid-template-columns:minmax(240px,1fr) minmax(0,2.1fr);gap:12px;margin-bottom:12px}
.cost-hero-main{background:linear-gradient(180deg,#221d15,#1b1813);border:1px solid var(--gold);border-radius:6px;padding:18px 20px}
.cost-hero-l{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.cost-hero-n{font-size:44px;line-height:1.1;font-weight:700;color:var(--gold);margin:6px 0 8px;font-variant-numeric:tabular-nums}
.cost-hero-s{font-size:11px;color:var(--dim);line-height:1.6}
.cost-caveat{margin-top:10px;font-size:11px;color:#e6cf9a;border-top:1px solid var(--line);padding-top:8px}
.cost-hero-side{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.cost-tile{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px}
.cost-tile-v{font-size:26px;font-weight:600;color:var(--ink);line-height:1.1;font-variant-numeric:tabular-nums}
.cost-per{font-size:12px;color:var(--dim);margin-left:2px}
.cost-tile-l{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-top:7px}
.cost-tile-s{font-size:11px;color:var(--dim);margin-top:5px;line-height:1.5}
.cost-guards{border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:6px;padding:13px 15px;margin-bottom:16px;background:#17140f}
.cost-guards-h{font-size:11px;color:var(--ink);margin-bottom:11px;letter-spacing:.04em}
.cost-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.cost-guard .cost-tile-s{word-break:break-word}
.cost-weak{font-size:9px;color:var(--dim);letter-spacing:.06em}
.cost-caveat-ok{color:var(--dim);border-top-color:var(--line)}
.cost-panel{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin-bottom:14px}
.cost-panel h3{margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);font-weight:600}
.cost-unit{color:var(--dim);text-transform:none;letter-spacing:0;font-weight:400}
.cost-n{color:var(--dim);font-size:10px;font-weight:400;letter-spacing:.06em}
.cost-note{font-size:11px;color:var(--dim);margin:-4px 0 12px;line-height:1.6}
.cost-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.cost-scroll svg{display:block;width:100%;min-width:620px;height:auto}
.cost-scroll table{min-width:620px}
.cost-wide table{min-width:820px}
.cost-dot{cursor:crosshair}
.cost-empty{color:var(--dim);font-style:italic;padding:12px 0;font-size:12px}
.cost-bars{display:grid;gap:9px}
.cost-bar-row{display:grid;grid-template-columns:minmax(110px,150px) minmax(60px,1fr) 88px;grid-template-areas:"l t v" ". s s";gap:4px 10px;align-items:center}
.cost-bar-label{grid-area:l;font-size:12px;color:var(--ink);word-break:break-word}
.cost-bar-track{grid-area:t;height:14px;background:#241f19;border-radius:3px;overflow:hidden}
.cost-bar-track>i{display:block;height:100%;border-radius:3px}
.cost-bar-val{grid-area:v;text-align:right;font-size:12px;color:var(--ink);font-variant-numeric:tabular-nums}
.cost-bar-sub{grid-area:s;font-size:10px;color:var(--dim)}
.cost-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
.cost-details{margin:0 0 14px;font-size:12px}
.cost-details summary{cursor:pointer;color:var(--dim);padding:8px 0}
.cost-problems{border:1px solid #6b5522;border-radius:6px;padding:11px 14px;margin-bottom:14px;font-size:11px;color:#e6cf9a;line-height:1.6}
.cost-problems ul{margin:7px 0 0;padding-left:18px}
.cost-foot{font-size:11px;color:var(--dim);line-height:1.6;margin-top:4px}
@media(max-width:700px){.cost-hero{grid-template-columns:1fr}.cost-hero-n{font-size:34px}}
`;

/** What progress.mjs calls. Never throws — rule 13, this runs on the commit path. */
export function costHtml(opts = {}) {
  try { return renderCost(loadLedger(opts)); }
  catch (e) {
    return `<section class="cost"><h2 id="cost">What this is costing</h2>
<div class="cost-banner cost-banner-bad"><b>The cost section could not be rendered</b> &mdash; ${esc(e.message)}.
No figure is shown, because a page that guesses here is worse than one that admits it failed.</div></section>`;
  }
}

// ------------------------------------------------------------------ self-test
// Rule 6 and the five non-negotiables: arms that GENUINELY DISAGREE. Two of these arms exist to
// catch the failure that matters most — a ledger that is present and partially wrong, which would
// otherwise render as a confident number. The last check runs arm A's assertions against arm B's
// output and REQUIRES them to fail; an assertion set that passes on every arm is testing nothing.
async function runSelfTest() {
  const { mkdtempSync, mkdirSync, writeFileSync: wf, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const NOW = Date.parse('2026-08-08T11:20:00Z');

  const sandbox = (files) => {
    const dir = mkdtempSync(join(tmpdir(), 'cost-selftest-COST-DASHBOARD-'));
    mkdirSync(join(dir, 'docs', 'data'), { recursive: true });
    for (const [p, body] of Object.entries(files)) wf(join(dir, p), body);
    return dir;
  };
  const fixture = readFileSync(join(ROOT, 'tools', 'cost-fixture.json'), 'utf8');

  const arms = [];
  const add = (name, files, nowMs = NOW) => {
    const dir = sandbox(files);
    const load = loadLedger({ root: dir, now: nowMs });
    const html = renderCost(load);
    // The header strip is a second surface on the same data, so it gets the same arms: a strip
    // that stayed confident while the section admitted it did not know would be the worst of both.
    const strip = costStripHtml({ root: dir, now: nowMs });
    rmSync(dir, { recursive: true, force: true });
    arms.push({ name, load, html, strip });
    return arms[arms.length - 1];
  };

  const A = add('A fixture with known numbers', { [LEDGER_PATH]: fixture });
  const B = add('B no ledger at all', {});
  const C_ = add('C ledger is not JSON', { [LEDGER_PATH]: '{ this is not json' });
  const D = add('D present but partially wrong', {
    [LEDGER_PATH]: JSON.stringify({
      schema: 'elder-souls/cost-ledger@1',
      generated_at: '2026-08-08T11:02:00Z',
      window: { from: '2026-08-08T00:00:00Z', to: '2026-08-08T11:00:00Z', hours: 11 },
      // Each of these is a shape that survives JSON.stringify and would otherwise reach the page:
      // a numeric string, an explicit null, a boolean, and a negative dollar figure. (A literal
      // NaN cannot survive JSON at all — that case is arm C, an unparseable file.)
      headline: { spend_to_date_usd: '1234.56', burn_usd_per_hour: null, ch_usd_per_hour: true, usd_per_agent_hour: -3 },
      series: [{ t: '2026-08-08T10:00:00Z', usd_per_hour: 'lots' }],
    }),
  });
  const E = add('E stale — 3 h old', { [LEDGER_PATH]: fixture }, Date.parse('2026-08-08T14:02:00Z'));
  // G: a PARTIAL read. The source is hundreds of transcript files and reading only some of them
  // under-reports by roughly ten times while looking entirely plausible. The contract requires the
  // instrument to null every headline field when coverage.complete is false; this arm proves the
  // page then draws dashes and says PARTIAL READ, instead of a confident low number.
  const G = add('G coverage incomplete', {
    [LEDGER_PATH]: JSON.stringify({
      ...JSON.parse(fixture),
      coverage: { files_total: 403, files_read: 38, bytes_read: 31000000, complete: false },
      headline: {
        spend_to_date_usd: null, burn_usd_per_hour: null, burn_window_hours: null,
        ch_usd_per_hour: null, ch_pct_of_baseline: null,
        usd_per_agent_hour: null, usd_per_agent_hour_pct_of_baseline: null,
      },
    }),
  });
  const F = add('F refresh failed', {
    [LEDGER_PATH]: fixture,
    [ERROR_PATH]: JSON.stringify({ at: '2026-08-08T11:18:00Z', message: 'tools/cost.mjs exited 1: transcript unreadable' }),
  });

  // Assertions. `has` must appear; `hasNot` must not.
  const expect = {
    A: {
      state: 'fresh',
      has: ['$1,234.56', 'Spend to date', '$42.10', '52.3%', '13.1', 'CH-02', 'reversed', 'claude-opus-5',
        'cache write', 'cache read', 'target $20.13', 'baseline $80.50', 'floor 12', '19 measurements',
        'separate critic 41', 'executed on a copy', 'not yet executed',
        // The blocks COST-INSTRUMENT added to the contract on 2026-08-08.
        'cache write 5m', 'cache write 1h', '11 alive on the second reading', 'alive and idle',
        '1/5', 'not honestly measurable yet', 'grep counts the word, not the act',
        'What drives it', 'Requests per agent-hour', 'active_clock_hours', 'Idle hours are excluded',
        'sha1:9f2c1ab4de77', 'cache write 5m $6.25', '8 of 9 known findings recovered',
        'Read <b>403</b> of 403 transcript files'],
      hasNot: ['STALE', 'FAILED', 'has not landed yet', 'Spend in this window'],
      stripHas: ['Spend to date', '$1,234.56', 'burn $42.10/h'], stripHasNot: ['STALE', 'REFRESH FAILED'],
    },
    B: { state: 'missing', has: ['has not landed yet', 'docs/data/cost-ledger.json'], hasNot: ['$1,234.56', '42.10', 'Spend to date'],
      stripHas: ['instrument not landed yet'], stripHasNot: ['1,234.56', 'Spend to date'] },
    C: { state: 'malformed', has: ['could not be read', 'no cost figure is shown at all'], hasNot: ['$1,234.56', 'Spend to date', 'CH-02'] },
    D: {
      state: 'fresh',
      // The whole point: a string, a NaN and a negative must render as gaps, not as numbers, the
      // partial window must be labelled, and the problems must be named.
      has: ['&mdash;', 'Spend in this window', 'the whole project', 'problems in the ledger',
        'expected a number, got the string &quot;1234.56&quot;', 'headline.usd_per_agent_hour: negative (-3)',
        'headline.ch_usd_per_hour: expected a number'],
      hasNot: ['$1,234.56', '1,234.56', '$-3', 'Spend to date'],
    },
    E: { state: 'stale', has: ['STALE', '2026-08-08 11:02Z', '3.0 h ago', '$1,234.56'], hasNot: ['FAILED'],
      stripHas: ['STALE', '3.0 h ago'], stripHasNot: ['REFRESH FAILED'] },
    G: {
      state: 'fresh',
      has: ['PARTIAL READ', '38 of 403 transcript files', 'reads as good news',
        'cost-hero-n">&mdash;<', 'under-report by an unknown amount'],
      // The whole point of the arm: no headline money at all when the read was partial.
      hasNot: ['$1,234.56', 'cost-hero-n">' + '$'],
      stripHasNot: ['$1,234.56'],
    },
    F: {
      state: 'failed',
      has: ['FAILED', 'transcript unreadable', 'last good reading', '2026-08-08 11:02Z', 'They are not current'],
      hasNot: ['Reading taken <b>2026-08-08 11:02Z</b> (18 min ago)'],
      stripHas: ['REFRESH FAILED'],
    },
  };
  const key = a => a.name[0];
  const check = (arm, exp) => {
    const fails = [];
    if (exp.state && arm.load.state !== exp.state) fails.push(`state is "${arm.load.state}", expected "${exp.state}"`);
    for (const s of exp.has || []) if (!arm.html.includes(s)) fails.push(`missing: ${JSON.stringify(s)}`);
    for (const s of exp.hasNot || []) if (arm.html.includes(s)) fails.push(`present but must not be: ${JSON.stringify(s)}`);
    for (const s of exp.stripHas || []) if (!arm.strip.includes(s)) fails.push(`strip missing: ${JSON.stringify(s)}`);
    for (const s of exp.stripHasNot || []) if (arm.strip.includes(s)) fails.push(`strip must not say: ${JSON.stringify(s)}`);
    return fails;
  };

  let bad = 0;
  for (const arm of arms) {
    const fails = check(arm, expect[key(arm)]);
    if (fails.length) { bad++; console.error(`FAIL  ${arm.name}\n      ${fails.join('\n      ')}`); }
    else console.log(`ok    ${arm.name}  (state: ${arm.load.state}, ${arm.html.length} chars)`);
  }

  // The control on the controls. If arm A's expectations also pass against the no-ledger and
  // partially-wrong arms, the assertions are vacuous and everything above is theatre.
  const crossFails = [
    { of: 'A', against: B }, { of: 'A', against: C_ }, { of: 'A', against: D },
    { of: 'B', against: A }, { of: 'F', against: A }, { of: 'A', against: G }, { of: 'G', against: A },
  ];
  for (const x of crossFails) {
    const fails = check(x.against, expect[x.of]);
    if (!fails.length) { bad++; console.error(`FAIL  control: arm ${x.of}'s assertions PASS against "${x.against.name}" — the arms do not disagree, so they prove nothing`); }
    else console.log(`ok    control: arm ${x.of}'s assertions go red on "${x.against.name}" (${fails.length} disagreement${fails.length === 1 ? '' : 's'})`);
  }

  console.log(bad ? `\ncost-report --self-test: ${bad} FAILED` : `\ncost-report --self-test: all ${arms.length} arms and ${crossFails.length} controls pass`);
  return bad;
}

const isMain = process.argv[1] && process.argv[1].endsWith('cost-report.mjs');
if (isMain) {
  if (process.argv.includes('--self-test')) {
    process.exit((await runSelfTest()) ? 1 : 0);
  } else {
    const useFixture = process.argv.includes('--fixture');
    let load;
    if (useFixture) {
      const { mkdtempSync, mkdirSync, writeFileSync: wf } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const dir = mkdtempSync(join(tmpdir(), 'cost-preview-COST-DASHBOARD-'));
      mkdirSync(join(dir, 'docs', 'data'), { recursive: true });
      const fx = readFileSync(join(ROOT, 'tools', 'cost-fixture.json'), 'utf8');
      wf(join(dir, LEDGER_PATH), fx);
      // Preview the FRESH state by pretending it is five minutes after the fixture was written.
      // The fixture's timestamps are fixed so the self-test can assert on them; left alone, every
      // preview would show the stale banner and never exercise the layout the owner will see.
      const t = Date.parse(JSON.parse(fx).generated_at);
      load = loadLedger({ root: dir, now: (Number.isFinite(t) ? t : Date.now()) + 5 * 60000 });
    } else load = loadLedger();
    const page = `<!doctype html><html><head><meta charset="utf-8"><title>cost preview</title><style>
:root{--bg:#12100d;--panel:#1b1813;--ink:#e8ddc8;--dim:#9a8f79;--line:#332d24;--gold:#c8a253;--green:#7d9a5a;--red:#b4553f}
*{box-sizing:border-box}body{margin:0;padding:22px 28px;background:var(--bg);color:var(--ink);font:14px/1.55 ui-monospace,Menlo,monospace}
h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);padding-bottom:8px;margin:0 0 14px}
table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;color:var(--dim);font-weight:500;padding:6px 10px;border-bottom:1px solid var(--line);font-size:10px;text-transform:uppercase}
td{padding:6px 10px;border-bottom:1px solid #241f19;vertical-align:top}code{color:#5f7f96;font-size:11px}
.ok{color:var(--green)}.bad{color:var(--red)}.warn{color:var(--gold)}.dimtext,.rem{color:var(--dim)}.rem{font-size:11px}.gapq{color:var(--ink)}
.empty{color:var(--dim);font-style:italic}
.fixture-stamp{border:2px solid var(--red);background:#2a1512;color:#f0c0b0;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:13px;line-height:1.6}
${COST_CSS}</style></head><body>${useFixture ? `<div class="fixture-stamp"><b>FIXTURE — every number below is invented.</b> This is <code>tools/cost-fixture.json</code>, the worked example of the ledger contract, rendered to prove the layout. It is not a measurement of this project and no figure here is real spend. The live page renders <code>docs/data/cost-ledger.json</code>, written by the instrument.</div>` : ''}${renderCost(load)}</body></html>`;
    const out = join((await import('node:os')).tmpdir(), 'cost-preview-COST-DASHBOARD.html');
    writeFileSync(out, page);
    console.log(`cost-report: state=${load.state}, ${load.problems.length} ledger problem(s) -> ${out}`);
    for (const p of load.problems) console.log('  problem:', p);
  }
}
