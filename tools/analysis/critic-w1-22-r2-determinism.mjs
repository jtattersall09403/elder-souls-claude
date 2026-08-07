#!/usr/bin/env node
// WRITTEN BY THE W1-22 ROUND-2 CRITIC (round-3 judgement), declared under method_deviations.
//
// THE QUESTION THE BUILDER'S OWN FENCE DOES NOT ASK.
//
// `tools/analysis/ambience-determinism.mjs` D1 captures each bed `--repeat` times BACK TO BACK IN
// ONE PAGE, at `--seconds 8`, with `listener: null`. Its shipped report
// (`reports/w1-22/ambience-determinism.json`) records `fired: 0` for all forty bed x tod rows, so
// the twenty-beds-bit-identical headline is a claim about the CONTINUOUS BED ALONE, inside a
// single process, in a single capture order. RI-AUD03 R3's own words are "two RUNS of the same
// scenario produce the same ambience", and every blind pack is rebuilt in a new process.
//
// This tool varies the three conditions the fence holds fixed:
//
//   C1  PROCESS. Digests are written to disk so two independent invocations (two browsers, two
//       page loads, two heaps, minutes apart, different machine load) can be compared. The
//       builder's own stored report is a third process and is compared too.
//   C2  EVENTS. `--seconds 60` so the L3/L4 scheduler actually fires, and `--listener emitter`
//       so the R7 emitters render. Both add voices to the DeterministicMixer's ROTATING grain
//       lanes, which is the one part of the round-3 fix a zero-event capture never exercises.
//   C3  ORDER. `--order rev` captures the beds in the opposite order within the page.
//
// Exit 0 = every capture pair inside this process was identical. 1 = a divergence. 2 = could not
// drive the build. Cross-process comparison is done by `--compare a.json b.json ...`, which is a
// pure file operation and needs no browser.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `critic-w1-22-r2-determinism.mjs — is the ambience deterministic ACROSS runs, with events?

  --seconds N      capture length (default 60, long enough for L3 to fire)
  --rate HZ        sample rate (default 16000)
  --repeat N       captures per bed per tod inside this process (default 2)
  --beds a,b,c     only these beds
  --tod X          day | night | both (default day)
  --listener X     none | emitter   (default none; 'emitter' places the listener AT the bed's
                   first emitter so R7 renders)
  --order X        fwd | rev
  --out PATH       report path
  --compare a,b    NO BROWSER: compare digests across two or more reports and exit
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------- cross-process diff
if (args.compare) {
  const paths = String(args.compare).split(',').map((s) => s.trim()).filter(Boolean);
  const reports = paths.map((p) => ({ path: p, json: JSON.parse(readFileSync(p, 'utf8')) }));
  const keys = new Set();
  for (const r of reports) for (const k of Object.keys(r.json.beds || {})) keys.add(k);
  let mismatches = 0, compared = 0, skipped = 0;
  const rows = [];
  for (const k of [...keys].sort()) {
    const vals = reports.map((r) => (r.json.beds[k] || {}).digest || null);
    const shapes = reports.map((r) => {
      const b = r.json.beds[k];
      return b ? `${r.json.seconds}s/${r.json.sample_rate}/${r.json.tods ? '' : ''}${b.listener_mode || r.json.listener || 'none'}` : null;
    });
    const present = vals.filter(Boolean);
    if (present.length < 2) { skipped++; continue; }
    // Only compare rows whose capture SHAPE matches; a 60 s capture is not comparable to an 8 s one.
    const shapeSet = new Set(shapes.filter(Boolean));
    if (shapeSet.size > 1) { skipped++; rows.push({ key: k, skipped: 'shape differs', shapes }); continue; }
    compared++;
    const same = present.every((v) => v === present[0]);
    if (!same) mismatches++;
    rows.push({ key: k, same, digests: vals });
  }
  const verdict = { tool: 'critic-w1-22-r2-determinism --compare', reports: paths, compared, skipped, mismatches, rows };
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(mismatches === 0 ? 0 : 1);
}

const { launchGame } = await import('../lib/browser.mjs');
const SECONDS = Number(args.seconds || 60);
const RATE = Number(args.rate || 16000);
const REPEAT = Math.max(2, Number(args.repeat || 2));
const TOD = String(args.tod || 'day');
const TODS = TOD === 'both' ? ['day', 'night'] : [TOD];
const LISTENER = String(args.listener || 'none');
const ORDER = String(args.order || 'fwd');
const ONLY = args.beds ? String(args.beds).split(',').map((s) => s.trim()).filter(Boolean) : null;

function gitStamp() {
  try {
    const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit: sh('git rev-parse --short HEAD'), dirty: sh('git status --porcelain') !== '' };
  } catch { return {}; }
}
function loadStamp() {
  try {
    const la = readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).join(' ');
    let br = 0;
    try { br = Number(execSync('pgrep -c headless_shell', { encoding: 'utf8' }).trim()); } catch { br = 0; }
    return { loadavg: la, headless_shell: br };
  } catch { return {}; }
}
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function describeDiff(a, b, rate) {
  if (a === b) return null;
  const A = Buffer.from(a, 'base64'), B = Buffer.from(b, 'base64');
  if (A.length !== B.length) return { kind: 'length', a: A.length, b: B.length };
  let first = -1, differing = 0, maxAbs = 0;
  const n = A.length >> 1;
  for (let i = 0; i < n; i++) {
    const x = A.readInt16LE(i * 2), y = B.readInt16LE(i * 2);
    if (x !== y) { if (first < 0) first = i; differing++; const d = Math.abs(x - y); if (d > maxAbs) maxAbs = d; }
  }
  return { kind: 'samples', first_differing_sample: first, first_differing_s: +(first / 2 / rate).toFixed(4),
           differing_samples: differing, max_abs_lsb: maxAbs };
}

const out = {
  tool: 'tools/analysis/critic-w1-22-r2-determinism.mjs', taken_at: new Date().toISOString(),
  git: gitStamp(), load_at_start: loadStamp(), pid: process.pid,
  seconds: SECONDS, sample_rate: RATE, repeat: REPEAT, tods: TODS, listener: LISTENER, order: ORDER,
  beds: {}, checks: {}, notes: [],
};

let handle, exitCode = 0;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  let bedIds = await page.evaluate(() => Object.keys(window.__ENGINE.ambience.beds));
  let beds = ONLY ? bedIds.filter((b) => ONLY.includes(b)) : bedIds;
  if (ORDER === 'rev') beds = [...beds].reverse();
  if (!beds.length) { console.error('no beds selected'); process.exit(2); }
  out.beds_measured = beds;

  // Where the listener goes. 'emitter' puts it exactly on the bed's first emitter so R7 is
  // guaranteed audible; a bed with no emitter falls back to null and says so.
  const emitterPos = await page.evaluate(() => {
    const E = window.__ENGINE, o = {};
    for (const [id, b] of Object.entries(E.ambience.beds)) {
      const e = (b.emitters || [])[0];
      o[id] = e && e.pos ? [e.pos[0], e.pos[1], 0] : null;
    }
    return o;
  });

  const capture = (bed, tod, listener, n) => page.evaluate(async (a) => {
    const E = window.__ENGINE;
    const caps = [];
    for (let i = 0; i < a.n; i++) {
      const c = await E.ambienceCapture({
        region: a.bed, seconds: a.seconds, sampleRate: a.rate, tod: a.tod, listener: a.listener,
      });
      if (!c.ok) return { ok: false, why: c.why };
      caps.push({ b64: c.pcm16_interleaved_b64, samples: c.samples,
                  fired: (c.fired || []).map((f) => `${f.layer}:${f.id}@${f.at_s}`) });
    }
    return { ok: true, caps };
  }, { bed, tod, n, seconds: SECONDS, rate: RATE, listener });

  const failures = [];
  for (const tod of TODS) {
    for (const bed of beds) {
      const key = `${bed}|${tod}`;
      const listener = LISTENER === 'emitter' ? (emitterPos[bed] || null) : null;
      const r = await capture(bed, tod, listener, REPEAT);
      if (!r.ok) { out.notes.push(`${key}: ${r.why}`); failures.push(`${key}: capture failed`); continue; }
      const rec = out.beds[key] = {
        bed, tod, listener_mode: listener ? 'emitter' : 'none',
        listener: listener || null, samples: r.caps[0].samples,
        digest: sha(r.caps[0].b64),
        all_digests: r.caps.map((c) => sha(c.b64)),
        fired: r.caps[0].fired.length, fired_list: r.caps[0].fired.slice(0, 12),
        identical: true, diffs: [],
      };
      for (let i = 1; i < r.caps.length; i++) {
        const d = describeDiff(r.caps[0].b64, r.caps[i].b64, RATE);
        if (d) {
          rec.identical = false;
          rec.diffs.push({ capture: i, ...d });
          if (r.caps[i].fired.join('|') !== r.caps[0].fired.join('|')) rec.schedule_moved = true;
        }
      }
      if (!rec.identical) failures.push(`${key}: captures differ (${rec.diffs[0].differing_samples} samples, max ${rec.diffs[0].max_abs_lsb} LSB${rec.schedule_moved ? ', SCHEDULE MOVED' : ''})`);
    }
  }

  const firedTotal = Object.values(out.beds).reduce((a, b) => a + b.fired, 0);
  const firedRows = Object.values(out.beds).filter((b) => b.fired > 0).length;
  out.checks.C_intra_process_identical = {
    pass: failures.length === 0, failures,
    what: 'Every capture of a bed inside THIS process is byte-identical to the first.',
  };
  out.checks.C_events_actually_fired = {
    pass: firedRows === Object.keys(out.beds).length,
    rows_with_events: firedRows, rows: Object.keys(out.beds).length, events_total: firedTotal,
    what: 'A determinism claim taken over captures that scheduled ZERO events says nothing about '
      + 'the seeded event scheduler, which is the half of R3 the item actually writes down.',
  };
  out.load_at_end = loadStamp();
  for (const c of Object.values(out.checks)) if (!c.pass) exitCode = 1;
} finally {
  if (handle) await handle.close();
}

const outPath = args.out || join(ROOT, `reports/w1-22-critic/r2/determinism-${SECONDS}s-${LISTENER}-${ORDER}-${TODS.join('')}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`critic determinism @ ${out.git.commit}${out.git.dirty ? ' (dirty)' : ''} — ${out.beds_measured.length} beds`
  + ` x ${out.tods.length} tod x ${REPEAT} captures, ${SECONDS}s @ ${RATE} Hz, listener=${LISTENER}, order=${ORDER}`);
console.log(`load at start ${JSON.stringify(out.load_at_start)}  at end ${JSON.stringify(out.load_at_end)}`);
for (const [k, b] of Object.entries(out.beds)) {
  console.log(`  ${k.padEnd(26)} ${(b.identical ? 'same' : 'DIFFERS').padEnd(8)} ${b.digest}  fired=${String(b.fired).padStart(3)}`
    + (b.identical ? '' : `  first@${b.diffs[0].first_differing_s}s n=${b.diffs[0].differing_samples} max=${b.diffs[0].max_abs_lsb}LSB${b.schedule_moved ? ' SCHEDULE MOVED' : ''}`));
}
for (const [k, c] of Object.entries(out.checks)) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${k}`);
console.log(`report: ${outPath}`);
process.exit(exitCode);
