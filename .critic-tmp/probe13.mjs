import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
const out = process.argv[2];
const h = await launchGame({});
const page = h.page;
const report = { schema: 'critic/w1-00-save2@1', at: new Date().toISOString() };

report.M5_fair = await page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness'); H.setRenderRate(0);
  const res = [];
  const hs = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0) + ':' + s.length; };
  const script = [{ f: 0, move: [0, 1] }, { f: 60, press: ['light'] }, { f: 63, release: ['light'] }, { f: 200, press: ['roll'] }, { f: 203, release: ['roll'] }, { f: 400, move: [1, 0] }];
  for (const state of ['sv1-midquest', 'sv5-journal-bloodstain', 'arena_flat', 'dungeon_primary', 'thorn-hall']) {
    H.setSeed(4711); H.loadState(state); H.clearInputs(); H.stepFrames(120);
    H.clearInputs(); H.queueInputs(JSON.parse(JSON.stringify(script)));
    H.traceStart({}); H.stepFrames(600); const control = H.traceStop();
    H.setSeed(4711); H.loadState(state); H.clearInputs(); H.stepFrames(120);
    const blob = H.saveState(); H.loadState(blob);
    H.clearInputs(); H.queueInputs(JSON.parse(JSON.stringify(script)));
    H.traceStart({}); H.stepFrames(600); const loaded = H.traceStop();
    const norm = (r) => JSON.stringify(r.map(x => { const c = JSON.parse(JSON.stringify(x)); c.f = c.f - r[0].f; c.t_ms = null; return c; }));
    let firstDiff = null; const fields = [];
    for (let i = 0; i < Math.min(control.length, loaded.length); i++) {
      const a = JSON.parse(JSON.stringify(control[i])), b = JSON.parse(JSON.stringify(loaded[i]));
      delete a.f; delete b.f; delete a.t_ms; delete b.t_ms;
      if (JSON.stringify(a) !== JSON.stringify(b)) { firstDiff = i; for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) fields.push(k); break; }
    }
    res.push({ state, control: hs(norm(control)), loaded: hs(norm(loaded)), identical: hs(norm(control)) === hs(norm(loaded)), first_diff_frame: firstDiff, diff_blocks: fields });
  }
  return res;
});

report.M15 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('endgame-200q'); H.stepFrames(60);
  H.traceStart({});
  const started = performance.now();
  const p = H.writeSave('slotPerf');
  const f0 = H.getFrame();
  H.stepFrames(300);
  const f1 = H.getFrame();
  const recs = H.traceStop();
  let gaps = 0; for (let i = 1; i < recs.length; i++) if (recs[i].f !== recs[i - 1].f + 1) gaps++;
  const res = await Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error('writeSave did not settle in 10 s')), 10000))]).catch(e => ({ error: String(e.message) }));
  return { frames_stepped: f1 - f0, records: recs.length, frame_gaps: gaps, write: JSON.parse(JSON.stringify(res)), wall_ms_total: performance.now() - started };
});
report.page_errors = h.errors;
await h.close();

{
  const h2 = await launchGame({});
  const cold = {};
  cold.write = await h2.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness');
    H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(120);
    const h0 = H.getStateHash();
    const w = await H.writeSave('coldslot');
    return { h0, w: JSON.parse(JSON.stringify(w)) };
  });
  await h2.page.reload({ waitUntil: 'load' });
  await h2.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  cold.after = await h2.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness');
    const slots = JSON.parse(JSON.stringify(await H.listSaveSlots()));
    let err = null;
    try { const blob = await H.readSave('coldslot'); H.loadState(blob); } catch (e) { err = String(e && e.message || e); }
    const q = H.getQuestState();
    return { slots, err, h1: H.getStateHash(), journal: q.journal.length, flags: Object.keys(q.flags).length, topics: q.topicsKnown.length };
  });
  cold.equal = cold.write.h0 === cold.after.h1;
  cold.page_errors = h2.errors;
  report.M3_cold_reload = cold;
  await h2.close();
}
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
