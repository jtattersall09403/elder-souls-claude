#!/usr/bin/env node
// CRITIC-OWNED probe: RI-JRN05 M5 "divergence after load", run exactly as the item states —
// 600 frames, identical script, same seed, control vs loaded — with an identical pre-roll on
// both sides so the ONLY difference is the save/load.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const flat = (o, p, acc) => { if (o === null || typeof o !== 'object') { acc[p] = o; return acc; } if (Array.isArray(o)) { o.forEach((x, i) => flat(x, `${p}[${i}]`, acc)); if (!o.length) acc[p] = '[]'; return acc; } const ks = Object.keys(o); if (!ks.length) { acc[p] = '{}'; return acc; } for (const k of ks) flat(o[k], p ? `${p}.${k}` : k, acc); return acc; };

const r = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const script = [{ f: 0, move: [0, 1] }, { f: 60, move: [0, 0] }, { f: 70, press: ['light'] }, { f: 73, release: ['light'] },
    { f: 200, press: ['roll'] }, { f: 203, release: ['roll'] }, { f: 400, press: ['heavy'] }, { f: 422, release: ['heavy'] }];
  const preroll = () => { H.setSeed(4711); H.loadState('arena_flat'); H.teleport(0, 0); H.spawn('inf_trash', 0, 7, { as: 'e0' }); H.lockOn('e0'); H.stepFrames(120); };
  // (a) never-saved control, but it still produces the blob so both sides are identical up to here
  preroll();
  const blob = JSON.parse(JSON.stringify(H.saveState()));
  const snapCtl = H.snapshot();
  H.clearInputs(); H.queueInputs(script); H.traceStart(); H.stepFrames(600); const ctrl = H.traceStop();
  // (b) loaded: identical pre-roll, then load the blob taken at the same point
  preroll();
  H.loadState(blob);
  const snapLoad = H.snapshot();
  H.clearInputs(); H.queueInputs(script); H.traceStart(); H.stepFrames(600); const load = H.traceStop();
  return { ctrl, load, snapCtl_enemies: snapCtl.enemies, snapLoad_enemies: snapLoad.enemies, blob_entities: blob.world && blob.world.entities };
});

const rebase = (recs) => { const o = recs[0].f; return recs.map(x => { const c = JSON.parse(JSON.stringify(x)); c.f -= o; delete c.t_ms; (c.events || []).forEach(e => { if (typeof e.f === 'number') e.f -= o; }); (c.enemies || []).forEach(e => { if (typeof e.state_entered_f === 'number') e.state_entered_f = e.state_entered_f < o ? 'pre' : e.state_entered_f - o; }); delete c.rng; return c; }); };
const A = rebase(r.ctrl), B = rebase(r.load);
const n = Math.min(A.length, B.length); const fields = {}; let first = null;
for (let i = 0; i < n; i++) { const a = flat(A[i], '', {}), b = flat(B[i], '', {}); for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { const nk = k.replace(/\[\d+\]/g, '[]'); fields[nk] = (fields[nk] || 0) + 1; if (!first) first = { frame: i, field: nk, control: a[k], loaded: b[k] }; } } }
const out = {
  produced_by: 'critic-owned p10-m5.mjs — RI-JRN05 M5 as written: 600 frames, identical script and seed, identical pre-roll on both sides',
  frames: n,
  control_body_sha256: sha(A.map(x => JSON.stringify(x)).join('\n')),
  loaded_body_sha256: sha(B.map(x => JSON.stringify(x)).join('\n')),
  identical: sha(A.map(x => JSON.stringify(x)).join('\n')) === sha(B.map(x => JSON.stringify(x)).join('\n')),
  differing_fields: fields,
  first_divergence: first,
  snapshot_at_window_open: { control: r.snapCtl_enemies, loaded: r.snapLoad_enemies },
  saved_entity_record: r.blob_entities,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ identical: out.identical, differing_fields: fields, first: first, ctl: r.snapCtl_enemies, load: r.snapLoad_enemies, saved: r.blob_entities }, null, 1).slice(0, 3000));
await h.close();
