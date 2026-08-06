#!/usr/bin/env node
// CRITIC-OWNED probe: RI-JRN05 M3 cold reload, M5 post-load divergence, M10 backend,
// M12 corruption/hostility, M15 save does not stall the sim.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const out = { produced_by: 'critic-owned p7-jrn05.mjs' };

// ---- M10 backend + localStorage budget -----------------------------------
out.M10 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(60);
  if (H.writeSave) await H.writeSave('critslot');
  const info = H.getStorageInfo ? H.getStorageInfo() : 'absent';
  const items = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); items.push([k, (localStorage.getItem(k) || '').length]); }
  return { storage_info: info, localStorage_items: items, localStorage_total_bytes: items.reduce((a, b) => a + b[1], 0) };
});

// ---- M15 save does not stall the sim -------------------------------------
out.M15 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('endgame-200q'); H.stepFrames(60);
  const t0 = performance.now();
  const p = H.writeSave ? H.writeSave('critslot2') : Promise.resolve(null);
  const f0 = H.getFrame(); const seen = [];
  for (let i = 0; i < 300; i++) { H.stepFrames(1); seen.push(H.getFrame()); }
  const r = await p;
  const wall = performance.now() - t0;
  let gaps = 0; for (let i = 1; i < seen.length; i++) if (seen[i] - seen[i - 1] !== 1) gaps++;
  return { frames_stepped_during_write: seen.length, frame_gaps: gaps, wallMs: +wall.toFixed(2), write_result: r, bytes: JSON.stringify(H.saveState()).length };
});

// ---- M5 post-load divergence (identical pre-roll on both sides) ----------
out.M5 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const script = [{ f: 0, move: [0, 1] }, { f: 60, move: [0, 0] }, { f: 70, press: ['light'] }, { f: 73, release: ['light'] }];
  // control
  H.setSeed(4711); H.loadState('arena_flat'); H.teleport(0, 0); H.spawn('inf_trash', 0, 7, { as: 'e0' });
  H.stepFrames(120);
  const blob = JSON.parse(JSON.stringify(H.saveState()));
  H.clearInputs(); H.queueInputs(script); H.traceStart(); H.stepFrames(300);
  const ctrl = H.traceStop();
  // loaded
  H.setSeed(999); H.loadState('swamp_canopy'); H.stepFrames(30);
  H.loadState(blob);
  H.clearInputs(); H.queueInputs(script); H.traceStart(); H.stepFrames(300);
  const load = H.traceStop();
  return { ctrl, load };
});
{
  const rebase = (recs) => { const o = recs[0].f; return recs.map(r => { const c = JSON.parse(JSON.stringify(r)); c.f -= o; delete c.t_ms; (c.events || []).forEach(e => { if (typeof e.f === 'number') e.f -= o; }); (c.enemies || []).forEach(e => { if (typeof e.state_entered_f === 'number') e.state_entered_f = e.state_entered_f < o ? 'pre' : e.state_entered_f - o; }); delete c.rng; return c; }); };
  const A = rebase(out.M5.ctrl), B = rebase(out.M5.load);
  const n = Math.min(A.length, B.length); let firstDiff = null; const fields = {};
  const flat = (o, p, acc) => { if (o === null || typeof o !== 'object') { acc[p] = o; return acc; } if (Array.isArray(o)) { o.forEach((x, i) => flat(x, `${p}[${i}]`, acc)); if (!o.length) acc[p] = '[]'; return acc; } const ks = Object.keys(o); if (!ks.length) { acc[p] = '{}'; return acc; } for (const k of ks) flat(o[k], p ? `${p}.${k}` : k, acc); return acc; };
  for (let i = 0; i < n; i++) { const a = flat(A[i], '', {}), b = flat(B[i], '', {}); for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { const nk = k.replace(/\[\d+\]/g, '[]'); fields[nk] = (fields[nk] || 0) + 1; if (!firstDiff) firstDiff = { i, k: nk, a: a[k], b: b[k] }; } } }
  out.M5_result = { frames: n, differing_fields: fields, first_divergence: firstDiff, control_sha: sha(A.map(x => JSON.stringify(x)).join('\n')), loaded_sha: sha(B.map(x => JSON.stringify(x)).join('\n')) };
  delete out.M5;
}

// ---- M12 hostile imports --------------------------------------------------
out.M12 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(30);
  const good = JSON.parse(JSON.stringify(H.saveState()));
  const before = H.getStateHash();
  const cases = {
    png_as_save: '\x89PNG\r\n\x1a\n' + 'x'.repeat(200),
    empty: '',
    truncated: JSON.stringify(good).slice(0, 120),
    byte_flipped: (() => { const s = JSON.stringify(good); const i = Math.floor(s.length / 2); return s.slice(0, i) + (s[i] === 'a' ? 'b' : 'a') + s.slice(i + 1); })(),
    future_schema: JSON.stringify({ ...good, schema: 'elder-souls/save@99' }),
    past_schema: JSON.stringify({ ...good, schema: 'elder-souls/save@0' }),
  };
  const res = {};
  for (const [k, v] of Object.entries(cases)) {
    let r;
    try { r = { loaded: JSON.stringify(H.loadState(v)).slice(0, 200) }; }
    catch (e) { r = { rejected: String(e.message).slice(0, 220) }; }
    r.state_hash_unchanged = H.getStateHash() === before;
    res[k] = r;
  }
  return res;
});

out.M3 = { not_run: 'page.reload() timed out at 30 s in this container; M3 scored 0, fail-closed' };

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ M10: out.M10, M15: out.M15, M5: out.M5_result, M12: out.M12, M3: out.M3, h0: null, h1: null }, null, 1).slice(0, 6000));
await h.close();
