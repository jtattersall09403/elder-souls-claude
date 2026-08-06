import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
const out = process.argv[2];
const report = { schema: 'critic/w1-00-final@1', at: new Date().toISOString() };

// A. readSave return shape, and every documented way to get a persisted save back in
{
  const h = await launchGame({});
  report.readSave = await h.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness');
    H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(120);
    const h0 = H.getStateHash();
    await H.writeSave('s1');
    const r = await H.readSave('s1');
    const shape = { type: typeof r, isArray: Array.isArray(r), keys: (r && typeof r === 'object') ? Object.keys(r) : null };
    const attempts = {};
    const t = (k, fn) => { try { const v = fn(); attempts[k] = { ok: true, v: JSON.parse(JSON.stringify(v)) }; } catch (e) { attempts[k] = { ok: false, err: String(e && e.message || e) }; } };
    t('loadState_r', () => H.loadState(r));
    const h_after_r = H.getStateHash();
    for (const k of (shape.keys || [])) t('loadState_r_' + k, () => H.loadState(r[k]));
    return { h0, shape, attempts, h_after_r, hash_now: H.getStateHash() };
  });
  await h.close();
}

// B. exactly what differs in the M5 events block
{
  const h = await launchGame({});
  report.M5_event_diff = await h.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness'); H.setRenderRate(0);
    const script = [{ f: 0, move: [0, 1] }, { f: 60, press: ['light'] }, { f: 63, release: ['light'] }, { f: 200, press: ['roll'] }, { f: 203, release: ['roll'] }];
    H.setSeed(4711); H.loadState('arena_flat'); H.clearInputs(); H.stepFrames(120);
    H.clearInputs(); H.queueInputs(JSON.parse(JSON.stringify(script)));
    H.traceStart({}); H.stepFrames(300); const control = H.traceStop();
    H.setSeed(4711); H.loadState('arena_flat'); H.clearInputs(); H.stepFrames(120);
    const blob = H.saveState(); H.loadState(blob);
    H.clearInputs(); H.queueInputs(JSON.parse(JSON.stringify(script)));
    H.traceStart({}); H.stepFrames(300); const loaded = H.traceStop();
    const diffs = [];
    for (let i = 0; i < Math.min(control.length, loaded.length); i++) {
      const a = JSON.parse(JSON.stringify(control[i].events || [])), b = JSON.parse(JSON.stringify(loaded[i].events || []));
      if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push({ i, control: a, loaded: b });
    }
    // and non-event divergence
    let nonEvent = null;
    for (let i = 0; i < Math.min(control.length, loaded.length); i++) {
      const a = JSON.parse(JSON.stringify(control[i])), b = JSON.parse(JSON.stringify(loaded[i]));
      delete a.f; delete b.f; delete a.t_ms; delete b.t_ms; delete a.events; delete b.events;
      if (JSON.stringify(a) !== JSON.stringify(b)) { nonEvent = { i, keys: Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])) }; break; }
    }
    return { event_diffs: diffs.slice(0, 6), event_diff_count: diffs.length, first_non_event_divergence: nonEvent, frames: control.length };
  });
  await h.close();
}

// C. the 50-swing hit-rate: are player and target positions constant?
{
  const h = await launchGame({});
  report.swing_geometry = await h.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness'); H.setRenderRate(0);
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    H.spawn('dummy_passive', 0, 2.0, { as: 'g1' });
    const sc = []; for (let i = 0; i < 20; i++) { sc.push({ f: i * 120, press: ['light'] }); sc.push({ f: i * 120 + 3, release: ['light'] }); }
    H.queueInputs(sc);
    H.traceStart({}); H.stepFrames(20 * 120 + 200); const rec = H.traceStop();
    const swings = [];
    let cur = null;
    for (const x of rec) {
      const hb = (x.player.hitboxes || [])[0];
      if (hb) {
        if (!cur) cur = { start_f: x.f, player_pos: x.player.pos, target_pos: x.enemies[0]?.pos, dist: x.enemies[0]?.dist_m, a: hb.a, b: hb.b, hit: false, active: 0 };
        cur.active++;
        if ((hb.hits || []).length) cur.hit = true;
      } else if (cur) { swings.push(cur); cur = null; }
    }
    if (cur) swings.push(cur);
    return { swings: swings.length, hits: swings.filter(s => s.hit).length, detail: swings.slice(0, 8), last: swings.slice(-3) };
  });
  await h.close();
}
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
