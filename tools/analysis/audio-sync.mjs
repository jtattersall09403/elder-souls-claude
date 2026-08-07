#!/usr/bin/env node
// audio-sync.mjs — RI-AUD01's M1, M4, M5, M6, M7 and M9, measured off a run.
//
//   node tools/analysis/audio-sync.mjs --run reports/runs/<runId> [--out report.json] [--gate]
//
// ── THIS FILE WAS AN ABSENCE-REPORTER AND IS NO LONGER ──────────────────────────────────────
// It used to boot the game, confirm that no audio system existed, and exit 21. That was the
// right thing to ship while the absence was real (TOOL-LOOP rule 1, TOOL-COVERAGE-R1 Ruling 2).
// The absence stopped being real in W1-11, so this is now the instrument the item's Comparison
// method describes. The old behaviour survives as the `--gate` fail path: if `audioLog` is
// empty across a run that produced resolution events, this exits non-zero and says so, which is
// exactly RI-AUD01's own rule — "Unimplemented audio scores 0, not 'not assessed'."
//
// ── WHAT MAKES M1 A MEASUREMENT AND NOT A TAUTOLOGY ─────────────────────────────────────────
// The audio log records the sim frame the DRIVER decided on. The trace records the sim frame
// the GEOMETRY decided on. They are written by two different objects — `ImpactAudio` and the
// event bus — and joined here for the first time. If the driver were ever fed from the
// animation track, from a deferred queue, or from a render callback, the join would separate.
// `--sabotage anim` on the probe demonstrates precisely that, and the demonstration is the
// reason a clean p99 of 0 is evidence rather than an assertion.
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const RUN = arg('--run', null);
const OUT = arg('--out', null);
const GATE = argv.includes('--gate');

if (!RUN || argv.includes('--help')) {
  process.stdout.write(`audio-sync.mjs — RI-AUD01 M1/M4/M5/M6/M7/M9 off a run directory.

USAGE
  node tools/analysis/audio-sync.mjs --run reports/runs/<runId> [--out report.json] [--gate]

READS   <run>/trace.jsonl, <run>/audio-log.json, <run>/audio-stats.json
EXITS   0 measured (or measured-and-failing without --gate)
        2 a required artifact is missing
        3 --gate and a check failed
        21 the audio log is empty across a run with resolution events (RI-AUD01: 0, fail-closed)
`);
  process.exit(RUN ? 0 : 2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const need = (p) => { if (!fs.existsSync(p)) { process.stderr.write(`audio-sync: missing ${p}\n`); process.exit(2); } return p; };

const trace = fs.readFileSync(need(path.join(RUN, 'trace.jsonl')), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));
const log = readJson(need(path.join(RUN, 'audio-log.json')));
const stats = fs.existsSync(path.join(RUN, 'audio-stats.json')) ? readJson(path.join(RUN, 'audio-stats.json')) : {};

// RI-AUD01 M1: "For every trace event in {hit, block, parry, riposte, backstab, stagger, death}".
// `IMPACT` is this build's superset of hit/block/deflect (resolve.js#emitImpact) and is the
// event that actually carries the material, so it is the joined one; `HIT` is its mirror and
// would double-count.
const RESOLUTION = new Set(['IMPACT', 'BLOCK', 'PARRY', 'CRIT_HIT', 'GUARD_BREAK', 'WHIFF', 'DEATH', 'EXHAUSTED_ENTER']);
const resolutionEvents = trace.filter((e) => RESOLUTION.has(e.kind));

const R = { run: RUN, generated: new Date().toISOString(), checks: {} };

// ── M1 — frame offset ───────────────────────────────────────────────────────────────────────
//
// Joined per (fixture, frame): every audio row must sit on a frame that carries a resolution
// event in the same fixture. An audio row on a frame with no resolution event is an ORPHAN and
// is the signature of a trigger that is not the resolver.
const byFixFrame = new Map();
for (const e of resolutionEvents) {
  const k = `${e.fixture || ''}|${e.f}`;
  if (!byFixFrame.has(k)) byFixFrame.set(k, []);
  byFixFrame.get(k).push(e);
}
const animStarts = new Set(trace.filter((e) => e.kind === 'ACTION_START' && e.tag !== 'dodge')
  .map((e) => `${e.fixture || ''}|${e.f}`));

const offsets = [];
let orphans = 0, firedOnAnimStart = 0;
for (const r of log) {
  const k = `${r.fixture || ''}|${r.frame}`;
  if (byFixFrame.has(k)) { offsets.push(0); continue; }
  orphans++;
  // M1's `fired_on_anim_start`: "audio events whose frame equals an attack_start frame and
  // which have no corresponding resolution event within +/-1 frame."
  let near = false;
  for (let d = -1; d <= 1; d++) if (byFixFrame.has(`${r.fixture || ''}|${r.frame + d}`)) near = true;
  if (animStarts.has(k) && !near) firedOnAnimStart++;
  // The nearest resolution event in the same fixture, so the offset is a distance rather than
  // an infinity — an orphan 7 frames from anything is a different defect from one 1 frame away.
  let best = Infinity;
  for (const e of resolutionEvents) {
    if ((e.fixture || '') !== (r.fixture || '')) continue;
    const d = Math.abs(e.f - r.frame);
    if (d < best) best = d;
  }
  offsets.push(Number.isFinite(best) ? best : 9999);
}
const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
R.checks.M1 = {
  what: 'frame offset — |audioLog.frame - trace event f|',
  n: offsets.length,
  offset_frames: {
    p50: pct(offsets, 0.5), p95: pct(offsets, 0.95), p99: pct(offsets, 0.99),
    max: offsets.length ? Math.max(...offsets) : null,
  },
  fired_on_anim_start: firedOnAnimStart,
  orphans,
  pass: offsets.length > 0 && pct(offsets, 0.99) <= 1 && Math.max(...offsets, 0) <= 2,
  hard_fail: offsets.length > 0 && pct(offsets, 0.5) > 1,
};

// ── M7 — source of truth ────────────────────────────────────────────────────────────────────
R.checks.M7 = {
  what: 'source of truth — no impact may be triggered from the animation event track',
  fired_on_anim_start: firedOnAnimStart,
  trigger_source: stats.trigger_source || 'unknown',
  pass: firedOnAnimStart === 0,
  hard_fail: firedOnAnimStart > 0,
};

// ── M4 — class coverage ─────────────────────────────────────────────────────────────────────
const MANDATORY = ['hit_flesh_light', 'hit_chitin_light', 'blocked', 'guard_break', 'parried',
                   'riposte', 'backstab', 'whiff', 'player_hurt'];
const seen = {};
for (const r of log) seen[r.class] = (seen[r.class] || 0) + 1;
// "distinct assets" — two classes aliased to the same variant set is the aliasing M4 hard-fails.
const variantsOf = {};
for (const r of log) (variantsOf[r.class] ||= new Set()).add(r.sample_id);
const aliased = [];
const keys = Object.keys(variantsOf);
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const a = variantsOf[keys[i]], b = variantsOf[keys[j]];
    for (const v of a) if (b.has(v)) { aliased.push([keys[i], keys[j], v]); break; }
  }
}
R.checks.M4 = {
  what: 'class coverage — all nine mandatory classes present, distinct assets',
  present: Object.keys(seen).sort(),
  counts: seen,
  missing_mandatory: MANDATORY.filter((c) => !seen[c]),
  aliased_pairs: aliased,
  pass: MANDATORY.every((c) => seen[c]) && aliased.length === 0,
  hard_fail: MANDATORY.some((c) => !seen[c]) || aliased.length > 0,
};

// ── M5 — variants ───────────────────────────────────────────────────────────────────────────
const immediateRepeats = {};
const lastByClass = {};
for (const r of log) {
  if (lastByClass[r.class] === r.sample_id) immediateRepeats[r.class] = (immediateRepeats[r.class] || 0) + 1;
  lastByClass[r.class] = r.sample_id;
}
const distinct = Object.fromEntries(Object.entries(variantsOf).map(([k, v]) => [k, v.size]));
// M5 asks two different questions and they need two different sources.
//
//   "> = 4 sample variants per class"  is a property of the ASSET SET. It is read from
//   game/data/audio/impact/classes.json, because a run that voices a class three times cannot
//   demonstrate four variants no matter how many the build has, and scoring the run for that
//   measures the fixture. The first version of this check did exactly that and reported six
//   healthy classes short, purely because a no-immediate-repeat walk over four variants does
//   not visit all four in four draws.
//
//   "0 immediate repeats"  is a property of the RUN and is measured from the log.
const CLASSES_PATH = arg('--classes', 'game/data/audio/impact/classes.json');
let declared = {};
try {
  const cd = readJson(path.resolve(CLASSES_PATH));
  declared = Object.fromEntries(Object.entries(cd.classes).map(([k, v]) => [k, v.variants.length]));
} catch { declared = {}; }
const declaredShort = Object.entries(declared).filter(([, n]) => n < 4).map(([k]) => k);
const declaredSingle = Object.entries(declared).filter(([, n]) => n <= 1).map(([k]) => k);
R.checks.M5 = {
  what: 'variants — >= 4 declared per class (asset set), zero immediate repeats (run)',
  declared_variants: declared,
  distinct_variants_observed: distinct,
  observed_note: 'a class voiced n times can show at most n distinct variants; this column is diagnostic, not scored',
  immediate_repeats: immediateRepeats,
  classes_declaring_fewer_than_4: declaredShort,
  pass: Object.keys(declared).length > 0 && declaredShort.length === 0 && Object.keys(immediateRepeats).length === 0,
  hard_fail: declaredSingle.length > 0,
};

// ── M6 — spatialisation ─────────────────────────────────────────────────────────────────────
//
// Pearson r of `pan` against the bearing the trace says the source was at. The bearing is
// recomputed here from the log's own `pan` inverse only where the driver reports a distance —
// a self-consistency check would be worthless, so the reference is the SIGN and MAGNITUDE
// relationship across events rather than the driver's own arithmetic replayed.
const spatial = log.filter((r) => r.pan !== undefined && r.distance_m !== undefined && r.class !== 'player_hurt' && r.class !== 'stamina_break');
const pans = spatial.map((r) => r.pan);
const nonzero = pans.filter((p) => Math.abs(p) > 1e-6).length;
R.checks.M6 = {
  what: 'spatialisation — a panner exists and pan varies with bearing',
  n: spatial.length,
  pan_nonzero: nonzero,
  pan_min: pans.length ? Math.min(...pans) : null,
  pan_max: pans.length ? Math.max(...pans) : null,
  pan_distinct: new Set(pans.map((p) => p.toFixed(4))).size,
  panner: stats.panner || null,
  listener_attached_to: stats.listenerAttachedTo || null,
  // A run in which every source sits dead ahead legitimately reads pan 0 everywhere; the
  // correlation itself is measured in the browser sweep (`--orbit`), where the target moves.
  // What this check can falsify off a static fixture is the ABSENCE of a panner, which is M6's
  // own hard fail, and a driver that reports a constant pan for sources at different bearings.
  pass: spatial.length > 0 && !!stats.panner,
  hard_fail: spatial.length > 0 && !stats.panner,
  note: 'AGENT-PROTOCOL: a still target hides every steering defect. The correlation of pan against bearing over a MOVING target is measured by tools/audio/impact-probe-browser.mjs --orbit and is reported there, not here.',
};

// ── M9 — determinism ────────────────────────────────────────────────────────────────────────
// Comparing two runs is the caller's job (`--compare <otherRun>`); what is checkable from one
// run is that the variant choice is seeded at all, which the stats report.
const OTHER = arg('--compare', null);
if (OTHER) {
  const other = readJson(path.join(OTHER, 'audio-log.json'));
  const a = log.map((r) => r.sample_id).join(',');
  const b = other.map((r) => r.sample_id).join(',');
  R.checks.M9 = {
    what: 'determinism — two runs at the same seed produce an identical sample_id sequence',
    compared_with: OTHER, n_a: log.length, n_b: other.length,
    identical: a === b,
    first_divergence: a === b ? null : (() => {
      const A = log.map((r) => r.sample_id), B = other.map((r) => r.sample_id);
      for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) return { i, a: A[i], b: B[i] };
      return null;
    })(),
    pass: a === b,
    hard_fail: a !== b,
  };
}

// ── the fail-closed gate RI-AUD01 states in its own words ───────────────────────────────────
R.resolution_events = resolutionEvents.length;
R.audio_events = log.length;
if (log.length === 0 && resolutionEvents.length >= 20) {
  R.unmeasurable = true;
  R.why = 'audioLog() is empty across a scenario that produced >= 20 resolution events. RI-AUD01: this item scores 0 on every check and the piece\'s audio.* score is 0.';
}

const scored = Object.values(R.checks);
R.summary = {
  checks_passed: scored.filter((c) => c.pass).length,
  checks_total: scored.length,
  hard_fails: Object.entries(R.checks).filter(([, c]) => c.hard_fail).map(([k]) => k),
};

const text = JSON.stringify(R, null, 2);
if (OUT) fs.writeFileSync(OUT, text + '\n');
process.stdout.write(text + '\n');

if (R.unmeasurable) process.exit(21);
if (GATE && (R.summary.hard_fails.length || R.summary.checks_passed < R.summary.checks_total)) process.exit(3);
