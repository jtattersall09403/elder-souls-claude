// CRITIC-OWNED probe 7: fair M5, M3 cold reload, M11 kill-during-write, CR10 eviction,
// M17 slot honesty, M15 sim stall during write.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;
const report = { schema: 'critic/w1-00-save2@1', at: new Date().toISOString() };

// ---- M5, fair: identical pre-roll on both sides ----
report.M5_fair = await page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness');
  const res = [];
  const script = [{ f: 0, move: [0, 1] }, { f: 60, tap: 'light' }, { f: 200, tap: 'roll', hold: 3 }, { f: 400, move: [1, 0] }, { f: 500, tap: 'heavy' }];
  const hashRecs = (recs) => { const s = JSON.stringify(recs.map(r => { const c = JSON.parse(JSON.stringify(r)); return c; })); let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return { h: h >>> 0, len: s.length }; };
  for (const state of ['sv1-midquest', 'sv5-journal-bloodstain', 'arena_flat', 'dungeon_primary', 'settlement_primary_street']) {
    // control: load, pre-roll 120, then run the script uninterrupted
    H.setSeed(4711); H.loadState(state); H.clearInputs(); H.stepFrames(120);
    H.clearInputs(); H.queueInputs(JSON.parse(JSON.stringify(script)));
    H.traceStart({}); H.stepFrames(600); const control = H.traceStop();
    // experiment: load, pre-roll 120, save, reload the blob, then run the same script
    H.setSeed(4711); H.loadState(state); H.clearInputs(); H.stepFrames(120);
    const blob = H.saveState();
    H.loadState(blob);
    H.clearInputs(); H.queueInputs(JSON.parse(JSON.stringify(script)));
    H.traceStart({}); H.stepFrames(600); const loaded = H.traceStop();
    const a = hashRecs(control.map(r => ({ ...r, f: r.f - control[0].f, t_ms: null })));
    const b = hashRecs(loaded.map(r => ({ ...r, f: r.f - loaded[0].f, t_ms: null })));
    // first differing frame
    let firstDiff = null, diffFields = [];
    for (let i = 0; i < Math.min(control.length, loaded.length); i++) {
      const ca = JSON.parse(JSON.stringify(control[i])); const cb = JSON.parse(JSON.stringify(loaded[i]));
      delete ca.f; delete cb.f; delete ca.t_ms; delete cb.t_ms;
      if (JSON.stringify(ca) !== JSON.stringify(cb)) {
        firstDiff = i;
        const fa = JSON.stringify(ca).length, fb = JSON.stringify(cb).length;
        // shallow field report
        for (const k of Object.keys(ca)) if (JSON.stringify(ca[k]) !== JSON.stringify(cb[k])) diffFields.push(k);
        break;
      }
    }
    res.push({ state, control_hash: a, loaded_hash: b, identical: a.h === b.h && a.len === b.len, first_diff_index: firstDiff, diff_top_fields: diffFields });
  }
  return res;
});

// ---- M15: does a save stall the sim? ----
report.M15 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('endgame-200q'); H.stepFrames(60);
  H.traceStart({});
  const p = H.writeSave('slotPerf');   // do NOT await: does the sim keep stepping?
  const f0 = H.getFrame();
  H.stepFrames(300);
  const f1 = H.getFrame();
  const recs = H.traceStop();
  const res = await p;
  // frame continuity
  let gaps = 0; for (let i = 1; i < recs.length; i++) if (recs[i].f !== recs[i - 1].f + 1) gaps++;
  return { frames_stepped: f1 - f0, records: recs.length, frame_gaps: gaps, write: JSON.parse(JSON.stringify(res)) };
});

// ---- CR10 / M17: what database names exist, and does the slot list survive deletion ----
report.CR10 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const dbsBefore = (await indexedDB.databases()).map(d => d.name + '@' + d.version);
  H.loadState('arena_flat'); H.stepFrames(10);
  await H.writeSave('slotA');
  const dbsAfterWrite = (await indexedDB.databases()).map(d => d.name + '@' + d.version);
  const slotsBefore = JSON.parse(JSON.stringify(await H.listSaveSlots()));
  for (const d of await indexedDB.databases()) {
    await new Promise((res) => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = res; r.onerror = res; r.onblocked = res; setTimeout(res, 1500); });
  }
  const dbsAfterDelete = (await indexedDB.databases()).map(d => d.name + '@' + d.version);
  const slotsAfterDelete = JSON.parse(JSON.stringify(await H.listSaveSlots()));
  let readResult = null, readErr = null;
  try { readResult = JSON.parse(JSON.stringify(await H.readSave('slotA'))); } catch (e) { readErr = String(e && e.message || e); }
  const ls = localStorage.getItem('elder-souls.pointer');
  return { dbsBefore, dbsAfterWrite, dbsAfterDelete, slotsBefore, slotsAfterDelete, readResult, readErr, pointer_after_delete: ls };
});

report.page_errors = handle.errors;
await handle.close();

// ---- M3 cold reload: a genuinely fresh browser context ----
{
  const h2 = await launchGame({});
  const cold = { };
  cold.write = await h2.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness');
    H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(120);
    const h0 = H.getStateHash();
    const w = await H.writeSave('coldslot');
    return { h0, w: JSON.parse(JSON.stringify(w)) };
  });
  // hard reload the page in the SAME browser context so IDB persists
  await h2.page.reload({ waitUntil: 'load' });
  await h2.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  cold.after = await h2.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness');
    const slots = JSON.parse(JSON.stringify(await H.listSaveSlots()));
    let loaded = null, err = null;
    try { const blob = await H.readSave('coldslot'); loaded = JSON.parse(JSON.stringify(H.loadState(blob))); } catch (e) { err = String(e && e.message || e); }
    return { slots, loaded, err, h1: H.getStateHash(), quest: { journal: H.getQuestState().journal.length, flags: Object.keys(H.getQuestState().flags).length, topics: H.getQuestState().topicsKnown.length } };
  });
  cold.equal = cold.write.h0 === cold.after.h1;
  cold.page_errors = h2.errors;
  report.M3_cold_reload = cold;
  await h2.close();
}

// ---- M11 CR1: kill the page mid-write ----
{
  const kills = [];
  for (const frac of [0.25, 0.5, 0.75]) {
    const h3 = await launchGame({});
    const pre = await h3.page.evaluate(async () => {
      const H = window.__HARNESS; await H.ready(); H.setMode('harness');
      H.setSeed(4711); H.loadState('endgame-200q'); H.stepFrames(60);
      const w = await H.writeSave('killslot');          // generation 1, known good
      const h0 = H.getStateHash();
      return { h0, w: JSON.parse(JSON.stringify(w)) };
    });
    const p50 = pre.w.wallMs || 15;
    // start generation 2 and crash partway through
    await h3.page.evaluate(() => { const H = window.__HARNESS; H.loadState('sv5-journal-bloodstain'); H.stepFrames(30); window.__CRIT_P = H.writeSave('killslot'); });
    await new Promise(r => setTimeout(r, Math.max(1, Math.round(p50 * frac))));
    let crashed = false;
    try { const cdp = await h3.page.context().newCDPSession(h3.page); await cdp.send('Page.crash').catch(() => {}); crashed = true; } catch { }
    await new Promise(r => setTimeout(r, 300));
    // reopen in the same context
    let after = null, err = null;
    try {
      const p2 = await h3.context.newPage();
      await p2.goto(h3.url, { waitUntil: 'load' });
      await p2.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
      after = await p2.evaluate(async () => {
        const H = window.__HARNESS; await H.ready(); H.setMode('harness');
        const slots = JSON.parse(JSON.stringify(await H.listSaveSlots()));
        let blob = null, e = null;
        try { blob = await H.readSave('killslot'); } catch (x) { e = String(x && x.message || x); }
        let hash = null, loadErr = null;
        try { H.loadState(blob); hash = H.getStateHash(); } catch (x) { loadErr = String(x && x.message || x); }
        return { slots, readErr: e, hash, loadErr, gen: slots.find(s => s.slot === 'killslot')?.gen ?? null, journal: blob ? (blob.journal || []).length : null };
      });
    } catch (e) { err = String(e && e.message || e); }
    kills.push({ kill_fraction_of_p50: frac, p50_write_ms: p50, crashed, after, err });
    await h3.close();
  }
  report.M11_kill_during_write = kills;
}

fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
