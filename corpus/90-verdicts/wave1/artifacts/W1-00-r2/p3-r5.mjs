#!/usr/bin/env node
// CRITIC-OWNED probe: RI-MTH02 R5 (warm-up invariance), the reanchor's genuineness,
// the stepDepth guard on the trace record, and the determinism trap.
import fs from 'node:fs';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());

const INPUTS = [
  { f: 0, move: [0, 1] }, { f: 120, move: [0, 0] },
  { f: 130, press: ['light'] }, { f: 133, release: ['light'] },
  { f: 200, press: ['roll'] }, { f: 203, release: ['roll'] },
  { f: 300, move: [1, 0] }, { f: 420, move: [0, 0] },
  { f: 430, press: ['heavy'] }, { f: 452, release: ['heavy'] },
];

async function run({ warmup, reanchor, spawnEnemy, seed = 1337, frames = 600 }) {
  return page.evaluate(async (o) => {
    const H = window.__HARNESS;
    H.setSeed(o.seed);
    H.loadState('arena_flat');
    H.setTimeOfDay(12.0); H.setWeather('clear');
    H.teleport(0, 0);
    if (o.spawnEnemy) { H.spawn('inf_trash', 0, 7, { as: 'e0' }); H.lockOn('e0'); }
    H.stepFrames(o.warmup);
    let ra = null;
    if (o.reanchor) ra = H.reanchorFreeRunning();
    const originFrame = H.getFrame();
    const hashAtOrigin = H.getStateHash ? H.getStateHash() : null;
    const snapAtOrigin = H.snapshot();
    H.clearInputs();
    H.queueInputs(o.inputs);
    H.traceStart();
    H.stepFrames(o.frames);
    const recs = H.traceStop();
    return { originFrame, hashAtOrigin, reanchor: ra, recs, snapAtOrigin };
  }, { ...arguments[0], inputs: INPUTS, warmup, reanchor, spawnEnemy, seed, frames });
}

function rebase(rec, origin) {
  const r = JSON.parse(JSON.stringify(rec));
  r.f = r.f - origin;
  if (typeof r.t_ms === 'number') delete r.t_ms;
  if (Array.isArray(r.events)) for (const e of r.events) if (typeof e.f === 'number') e.f = e.f - origin;
  if (Array.isArray(r.enemies)) for (const e of r.enemies) {
    if (typeof e.state_entered_f === 'number') e.state_entered_f = e.state_entered_f < origin ? 'pre-window' : e.state_entered_f - origin;
  }
  if (r.rng) delete r.rng;
  return r;
}
function flat(o, p, out) {
  if (o === null || typeof o !== 'object') { out[p] = o; return out; }
  if (Array.isArray(o)) { o.forEach((x, i) => flat(x, `${p}[${i}]`, out)); if (!o.length) out[p] = '[]'; return out; }
  const ks = Object.keys(o); if (!ks.length) { out[p] = '{}'; return out; }
  for (const k of ks) flat(o[k], p ? `${p}.${k}` : k, out); return out;
}
function compare(A, B) {
  const n = Math.min(A.recs.length, B.recs.length);
  const fields = {}; const ex = {};
  for (let i = 0; i < n; i++) {
    const a = flat(rebase(A.recs[i], A.originFrame), '', {});
    const b = flat(rebase(B.recs[i], B.originFrame), '', {});
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        const nk = k.replace(/\[\d+\]/g, '[]');
        fields[nk] = (fields[nk] || 0) + 1;
        if (!ex[nk]) ex[nk] = { i, a: a[k], b: b[k] };
      }
    }
  }
  return { frames: n, differing_fields: fields, examples: ex, pass: Object.keys(fields).length === 0 };
}

const out = { produced_by: 'critic-owned p3-r5.mjs' };

// --- R5 WITH the reanchor (the build's claim) -----------------------------
const a1 = await run({ warmup: 30, reanchor: true, spawnEnemy: true });
const b1 = await run({ warmup: 90, reanchor: true, spawnEnemy: true });
out.R5_with_reanchor_enemy = { ...compare(a1, b1), reanchor_30: a1.reanchor, reanchor_90: b1.reanchor };

// --- R5 WITHOUT the reanchor (does the rung still have teeth?) ------------
const a2 = await run({ warmup: 30, reanchor: false, spawnEnemy: true });
const b2 = await run({ warmup: 90, reanchor: false, spawnEnemy: true });
out.R5_without_reanchor_enemy = compare(a2, b2);

// --- R5 on the critic's no-enemy counter-example --------------------------
const a3 = await run({ warmup: 30, reanchor: true, spawnEnemy: false });
const b3 = await run({ warmup: 90, reanchor: true, spawnEnemy: false });
out.R5_noenemy = compare(a3, b3);

// --- Is the reanchor a simulation mutation or a trace edit? ---------------
out.reanchor_genuineness = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
  H.spawn('inf_trash', 0, 7, { as: 'e0' }); H.lockOn('e0');
  H.stepFrames(30);
  const before = { snap: H.snapshot().enemies.map(e => [e.eid, e.anim_frame, e.state_entered_f]), hash: H.getStateHash() };
  const ra = H.reanchorFreeRunning();
  const after = { snap: H.snapshot().enemies.map(e => [e.eid, e.anim_frame, e.state_entered_f]), hash: H.getStateHash() };
  // does the mutation survive a save/load round trip?
  const blob = JSON.parse(JSON.stringify(H.saveState()));
  const hashAfterSave = H.getStateHash();
  H.setSeed(999); H.loadState('arena_flat'); H.stepFrames(5);
  H.loadState(blob);
  const reloaded = { snap: H.snapshot().enemies.map(e => [e.eid, e.anim_frame, e.state_entered_f]), hash: H.getStateHash() };
  // and does the clock keep running from the new phase?
  H.stepFrames(3);
  const plus3 = H.snapshot().enemies.map(e => [e.eid, e.anim_frame]);
  return { before, ra, after, hashAfterSave, reloaded, plus3 };
});

// --- The stepDepth guard: force a record build from inside a fixed step ---
out.stepdepth_guard = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
  H.spawn('inf_trash', 0, 7, { as: 'e0' });
  const results = [];
  // A queued input event whose `move` is a getter: the read happens inside stepFrames().
  const evt = { f: 1 };
  Object.defineProperty(evt, 'move', {
    enumerable: true,
    get() {
      try { H.snapshot(); results.push('snapshot-ok'); }
      catch (e) { results.push('snapshot-threw: ' + String(e && e.message).slice(0, 200)); }
      try { Math.random(); results.push('random-ok'); }
      catch (e) { results.push('random-threw: ' + String(e && e.message).slice(0, 120)); }
      try { Date.now(); results.push('date-ok'); }
      catch (e) { results.push('date-threw: ' + String(e && e.message).slice(0, 120)); }
      return [0, 0];
    },
  });
  try { H.queueInputs([evt]); } catch (e) { results.push('queue-threw: ' + String(e && e.message).slice(0, 200)); }
  try { H.stepFrames(4); } catch (e) { results.push('step-threw: ' + String(e && e.message).slice(0, 200)); }
  // outside a step the same calls must work
  const outside = { random: typeof Math.random() === 'number', date: typeof Date.now() === 'number', snapshot: !!H.snapshot() };
  return { inside: results, outside };
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  R5_with_reanchor: out.R5_with_reanchor_enemy.differing_fields,
  R5_without_reanchor: out.R5_without_reanchor_enemy.differing_fields,
  R5_noenemy: out.R5_noenemy.differing_fields,
  reanchor: out.reanchor_genuineness,
  guard: out.stepdepth_guard,
}, null, 2));
await h.close();
