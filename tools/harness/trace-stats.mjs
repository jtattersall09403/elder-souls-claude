#!/usr/bin/env node
// trace-stats.mjs — turn a per-frame JSONL trace into the combat statistics the
// combat reference items score against.
// Spec: corpus/80-methods/HARNESS.md §5, §7. Consumers: corpus/10-combat/RI-*.
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, wantsHelp, usage, die, log, EXIT, readJsonl, writeJson,
  summarise, entropyOf, quantile, mean, TRACE_SCHEMA,
} from '../lib/cli.mjs';

const USAGE = `
trace-stats.mjs — compute combat statistics from a JSONL trace.

USAGE
  node tools/harness/trace-stats.mjs --in <trace.jsonl> [--out <stats.json>] [--json]

OPTIONS
  --in <path>    Trace file, or a run directory containing trace.jsonl  (required)
  --out <path>   Where to write the stats JSON (default: <run dir>/trace-stats.json)
  --json         Print the full stats object on stdout
  --quiet        Suppress the human-readable summary on stderr
  --help         This message

COMPUTES
  attack_rate         attacks started per minute, inter-attack interval distribution + CV
  stamina             floor / ceiling / time-at-zero, spend events, regen delay + rate,
                      denied-action count (input pressed, no action, low stamina)
  commitment          committed-frame ratio, mean commitment length, cancel violations
  rolls               count, i-frame window lengths and offsets, dodge outcomes,
                      roll start offset relative to the nearest enemy active window
  punish              enemy recovery windows offered / used / hit rate / mean reaction frames
  iframes             every observed contiguous i-frame run, with the state that produced it
  enemies             per-enemy state histogram + entropy, distance stats, concurrent COMMIT
  integrity           field coverage, frame continuity, schema + hash echo (fail-closed)

Any required field that is absent is reported under integrity.missing_fields. Per the
corpus contract a critic scores 0 for the affected check — never "unknown".
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (!args.in) usage(USAGE, EXIT.USAGE);

let inPath = path.resolve(String(args.in));
if (fs.existsSync(inPath) && fs.statSync(inPath).isDirectory()) inPath = path.join(inPath, 'trace.jsonl');
if (!fs.existsSync(inPath)) {
  die(EXIT.MISSING_GAME, `trace not found: ${inPath}\n` +
    '  Produce one first:  node tools/harness/trace.mjs --scenario cmb-duel-infantry');
}

let all;
try { all = readJsonl(inPath); } catch (e) { die(EXIT.MEASUREMENT_FAIL, e.message); }
const header = all.find((r) => r._ === 'header') || null;
const footer = all.find((r) => r._ === 'footer') || null;
const rows = all.filter((r) => !r._);
if (!rows.length) die(EXIT.MEASUREMENT_FAIL, `trace ${inPath} contains no per-frame records.`);
if (header && header.schema !== TRACE_SCHEMA) {
  log(`WARNING: trace schema ${header.schema} != expected ${TRACE_SCHEMA}`);
}

const HZ = (header && header.fixed_step_hz) || 60;
const seconds = rows.length / HZ;

// ---------------------------------------------------------------- integrity
const REQUIRED_FRAME = ['f', 't_ms', 'player'];
const REQUIRED_PLAYER = ['pos', 'state', 'anim', 'anim_frame', 'phase', 'stamina', 'hp', 'iframe'];
const REQUIRED_ENEMY = ['eid', 'state', 'phase', 'pos', 'dist_m', 'hp', 'anim_frame'];
const coverage = {};
const bump = (k, ok) => { coverage[k] = coverage[k] || { present: 0, total: 0 }; coverage[k].total++; if (ok) coverage[k].present++; };
let enemyRecords = 0;
for (const r of rows) {
  for (const k of REQUIRED_FRAME) bump(k, r[k] !== undefined);
  for (const k of REQUIRED_PLAYER) bump('player.' + k, r.player && r.player[k] !== undefined);
  for (const e of r.enemies || []) { enemyRecords++; for (const k of REQUIRED_ENEMY) bump('enemy.' + k, e[k] !== undefined); }
}
const missing = Object.entries(coverage).filter(([, v]) => v.present < v.total).map(([k, v]) => ({ field: k, present: v.present, total: v.total }));
let discontinuities = 0;
for (let i = 1; i < rows.length; i++) if (rows[i].f !== rows[i - 1].f + 1) discontinuities++;

// ---------------------------------------------------------------- helpers
const ev = [];
for (const r of rows) for (const e of r.events || []) ev.push(Object.assign({ f: r.f }, e));
const evOf = (t) => ev.filter((e) => e.type === t);
const P = (r) => r.player || {};
const COMMITTED_STATES = new Set(['ATTACK', 'ROLL', 'HEAL', 'BACKSTEP', 'PARRY', 'RIPOSTE', 'HITSTUN', 'STAGGER', 'DEATH']);
const isAttacking = (r) => P(r).state === 'ATTACK' || /^atk_/.test(P(r).anim || '');

/** Contiguous runs of frames satisfying pred; returns [{start,end,len}] (frame numbers). */
function runs(pred) {
  const out = []; let cur = null;
  for (const r of rows) {
    if (pred(r)) { if (!cur) cur = { start: r.f, end: r.f, len: 0 }; cur.end = r.f; cur.len++; }
    else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------------------------------------------------------- attacks
const attackRuns = runs(isAttacking);
const attackStarts = evOf('attack_start').length ? evOf('attack_start').map((e) => e.f) : attackRuns.map((r) => r.start);
const intervals = [];
for (let i = 1; i < attackStarts.length; i++) intervals.push(attackStarts[i] - attackStarts[i - 1]);
const ivMean = mean(intervals);
const attack_rate = {
  attacks: attackStarts.length,
  attacks_per_min: +(attackStarts.length / (seconds / 60)).toFixed(3),
  inter_attack_frames: summarise(intervals),
  inter_attack_cv: intervals.length > 1 && ivMean > 0
    ? +(Math.sqrt(intervals.reduce((s, x) => s + (x - ivMean) ** 2, 0) / (intervals.length - 1)) / ivMean).toFixed(4) : null,
  attack_lengths_frames: summarise(attackRuns.map((r) => r.len)),
};

// ---------------------------------------------------------------- stamina
const stam = rows.map((r) => P(r).stamina).filter((v) => typeof v === 'number');
const stamMax = P(rows[0]).stamina_max ?? Math.max(...stam, 0);
const spends = evOf('stamina_spend');
// regen delay: frames from a spend to the first frame where stamina rises again.
const regenDelays = [], regenRates = [];
for (const s of spends) {
  const i = rows.findIndex((r) => r.f === s.f);
  if (i < 0) continue;
  for (let j = i + 1; j < rows.length - 1; j++) {
    const a = P(rows[j]).stamina, b = P(rows[j + 1]).stamina;
    if (typeof a !== 'number' || typeof b !== 'number') break;
    if (b > a + 1e-6) { regenDelays.push(rows[j + 1].f - s.f); regenRates.push((b - a) * HZ); break; }
    if (rows[j].f - s.f > 300) break;
  }
}
// denied actions: an action button pressed while nothing entered a committed state soon after.
let denied = 0;
for (let i = 0; i < rows.length - 3; i++) {
  const pressed = (rows[i].input && rows[i].input.pressed) || [];
  if (!pressed.some((b) => ['light', 'heavy', 'roll'].includes(b))) continue;
  const after = rows.slice(i, i + 3).some((r) => COMMITTED_STATES.has(P(r).state));
  if (!after && P(rows[i]).stamina < 0.3 * (stamMax || 1)) denied++;
}
const stamina = {
  max: stamMax,
  floor: stam.length ? +Math.min(...stam).toFixed(3) : null,
  ceiling: stam.length ? +Math.max(...stam).toFixed(3) : null,
  distribution: summarise(stam),
  frac_at_zero: stam.length ? +(stam.filter((v) => v <= 0.001).length / stam.length).toFixed(4) : null,
  frac_below_25pct: stam.length && stamMax ? +(stam.filter((v) => v < 0.25 * stamMax).length / stam.length).toFixed(4) : null,
  spend_events: spends.length,
  spend_amounts: summarise(spends.map((s) => s.amount).filter((x) => typeof x === 'number')),
  regen_delay_frames: summarise(regenDelays),
  regen_rate_per_sec: summarise(regenRates),
  regen_blocked_frac: +(rows.filter((r) => P(r).stamina_regen_blocked).length / rows.length).toFixed(4),
  denied_actions_low_stamina: denied,
};

// ---------------------------------------------------------------- commitment
const committedRuns = runs((r) => COMMITTED_STATES.has(P(r).state) || (P(r).phase && P(r).phase !== 'none'));
const committedFrames = committedRuns.reduce((s, r) => s + r.len, 0);
// cancel violation: leaving an attack's active/recovery phase before the animation ends.
let cancels = 0;
for (let i = 1; i < rows.length; i++) {
  const a = P(rows[i - 1]), b = P(rows[i]);
  if (a.state === 'ATTACK' && b.state !== 'ATTACK' && a.phase === 'active') cancels++;
  if (a.state === 'ATTACK' && b.state === 'ROLL' && a.phase === 'windup') cancels++;
}
const commitment = {
  committed_frames: committedFrames,
  committed_ratio: +(committedFrames / rows.length).toFixed(4),
  commitment_lengths: summarise(committedRuns.map((r) => r.len)),
  free_ratio: +(1 - committedFrames / rows.length).toFixed(4),
  suspected_cancels: cancels,
};

// ---------------------------------------------------------------- i-frames & rolls
const iframeRuns = runs((r) => P(r).iframe === true);
const rollRuns = runs((r) => P(r).state === 'ROLL');
// enemy active windows across all enemies
const activeWindows = [];
{
  const open = new Map();
  for (const r of rows) {
    const seen = new Set();
    for (const e of r.enemies || []) {
      const act = e.phase === 'active' || e.hit_active === true;
      seen.add(e.eid);
      if (act && !open.has(e.eid)) open.set(e.eid, { eid: e.eid, start: r.f, end: r.f });
      else if (act) open.get(e.eid).end = r.f;
      else if (open.has(e.eid)) { activeWindows.push(open.get(e.eid)); open.delete(e.eid); }
    }
    for (const [eid, w] of [...open]) if (!seen.has(eid)) { activeWindows.push(w); open.delete(eid); }
  }
  for (const w of open.values()) activeWindows.push(w);
}
const nearestActive = (f) => {
  let best = null;
  for (const w of activeWindows) {
    const d = w.start - f;
    if (best === null || Math.abs(d) < Math.abs(best.delta)) best = { delta: d, window: w };
  }
  return best;
};
const rolls = rollRuns.map((r) => {
  const na = nearestActive(r.start);
  const ifr = iframeRuns.find((w) => w.start >= r.start && w.start <= r.end);
  const overlap = ifr && na ? Math.max(0, Math.min(ifr.end, na.window.end) - Math.max(ifr.start, na.window.start) + 1) : 0;
  return {
    start_f: r.start, len: r.len,
    iframe_start_offset: ifr ? ifr.start - r.start : null,
    iframe_len: ifr ? ifr.len : 0,
    nearest_enemy_active_delta_f: na ? na.delta : null,
    overlapped_active_frames: overlap,
    dodged: overlap > 0,
  };
});
const dodgeEvents = evOf('iframe_dodge').length;
const rollStats = {
  count: rollRuns.length,
  roll_lengths: summarise(rollRuns.map((r) => r.len)),
  iframe_windows: summarise(iframeRuns.map((r) => r.len)),
  iframe_start_offsets: summarise(rolls.map((r) => r.iframe_start_offset).filter((v) => v !== null)),
  rolls_overlapping_active: rolls.filter((r) => r.dodged).length,
  dodge_events_logged: dodgeEvents,
  roll_vs_active_delta_f: summarise(rolls.map((r) => r.nearest_enemy_active_delta_f).filter((v) => v !== null)),
  samples: rolls.slice(0, 40),
};

// ---------------------------------------------------------------- punish windows
const recoveryWindows = [];
{
  const open = new Map();
  for (const r of rows) {
    const seen = new Set();
    for (const e of r.enemies || []) {
      const rec = e.phase === 'recovery' || e.state === 'RECOVER' || e.state === 'STAGGER';
      seen.add(e.eid);
      if (rec && !open.has(e.eid)) open.set(e.eid, { eid: e.eid, start: r.f, end: r.f, kind: e.state === 'STAGGER' ? 'stagger' : 'recovery' });
      else if (rec) open.get(e.eid).end = r.f;
      else if (open.has(e.eid)) { recoveryWindows.push(open.get(e.eid)); open.delete(e.eid); }
    }
    for (const [eid, w] of [...open]) if (!seen.has(eid)) { recoveryWindows.push(w); open.delete(eid); }
  }
  for (const w of open.values()) recoveryWindows.push(w);
}
const playerHits = evOf('hit').filter((e) => e.attacker === 'player');
const used = [], reactions = [];
for (const w of recoveryWindows) {
  const hit = playerHits.find((h) => h.f >= w.start && h.f <= w.end + 6 && (!h.victim || h.victim === w.eid));
  if (hit) { used.push(w); }
  const start = attackStarts.find((f) => f >= w.start - 2 && f <= w.end);
  if (start !== undefined) reactions.push(start - w.start);
}
const punish = {
  windows_offered: recoveryWindows.length,
  window_lengths: summarise(recoveryWindows.map((w) => w.end - w.start + 1)),
  windows_used: used.length,
  usage_rate: recoveryWindows.length ? +(used.length / recoveryWindows.length).toFixed(4) : null,
  reaction_frames: summarise(reactions),
  player_hits: playerHits.length,
  player_hits_outside_windows: playerHits.length - used.length,
};

// ---------------------------------------------------------------- enemies
const byEnemy = new Map();
let concurrentCommit = [];
for (const r of rows) {
  let commits = 0;
  for (const e of r.enemies || []) {
    if (!byEnemy.has(e.eid)) byEnemy.set(e.eid, { eid: e.eid, archetype: e.archetype || null, states: {}, dist: [], speed: [], yawDuringActive: [], hp: [] });
    const b = byEnemy.get(e.eid);
    b.states[e.state] = (b.states[e.state] || 0) + 1;
    if (typeof e.dist_m === 'number') b.dist.push(e.dist_m);
    if (typeof e.speed_mps === 'number') b.speed.push(e.speed_mps);
    if (typeof e.hp === 'number') b.hp.push(e.hp);
    if ((e.phase === 'active' || e.phase === 'recovery') && typeof e.yaw_rate_dps === 'number') b.yawDuringActive.push(Math.abs(e.yaw_rate_dps));
    if (e.state === 'COMMIT') commits++;
  }
  concurrentCommit.push(commits);
}
const enemies = [...byEnemy.values()].map((b) => ({
  eid: b.eid, archetype: b.archetype,
  state_histogram: b.states,
  state_entropy_bits: +entropyOf(b.states).toFixed(4),
  dist_m: summarise(b.dist),
  spacing_variance_m: +(summarise(b.dist).stdev || 0).toFixed(4),
  min_dist_dwell: b.dist.length ? +(b.dist.filter((d) => d < 2.04).length / b.dist.length).toFixed(4) : null,
  speed_mps: summarise(b.speed),
  max_yaw_rate_during_active_recovery: b.yawDuringActive.length ? +Math.max(...b.yawDuringActive).toFixed(3) : null,
  hp_start: b.hp[0] ?? null, hp_end: b.hp[b.hp.length - 1] ?? null,
}));

// ---------------------------------------------------------------- assemble
const stats = {
  schema: 'elder-souls/trace-stats@1',
  source: { path: inPath, records: rows.length, seconds: +seconds.toFixed(3), hz: HZ },
  run: header ? {
    run_id: header.run_id, scenario: header.scenario, seed: header.seed,
    started_at: header.started_at, harness_version: header.harness_version,
    build: header.build || null, git: header.git || null, data: header.data || null,
  } : null,
  trace_body_sha256: footer ? footer.body_sha256 : null,
  computed_at: new Date().toISOString(),
  attack_rate,
  stamina,
  commitment,
  rolls: rollStats,
  punish,
  enemies,
  concurrency: {
    concurrent_commit_p50: quantile(concurrentCommit, 0.5),
    concurrent_commit_p99: quantile(concurrentCommit, 0.99),
    concurrent_commit_max: concurrentCommit.length ? Math.max(...concurrentCommit) : 0,
    concurrent_commit_mean: +mean(concurrentCommit).toFixed(4),
  },
  events: ev.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
  integrity: {
    has_header: !!header, has_footer: !!footer,
    schema: header ? header.schema : null,
    frame_discontinuities: discontinuities,
    enemy_records: enemyRecords,
    missing_fields: missing,
    fail_closed: missing.length > 0 || discontinuities > 0 || !header,
  },
};

const outPath = args.out ? path.resolve(String(args.out)) : path.join(path.dirname(inPath), 'trace-stats.json');
writeJson(outPath, stats);

if (!args.quiet) {
  log(`frames=${rows.length} (${seconds.toFixed(1)}s)  attacks/min=${attack_rate.attacks_per_min}` +
      `  committed=${(commitment.committed_ratio * 100).toFixed(1)}%  stamina floor=${stamina.floor}` +
      `  rolls=${rollStats.count}  punish=${punish.windows_used}/${punish.windows_offered}`);
  if (stats.integrity.fail_closed) log(`INTEGRITY: fail-closed — ${missing.length} missing field(s), ${discontinuities} frame gap(s)`);
}
if (args.json) process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
else process.stdout.write(outPath + '\n');
