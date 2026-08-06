// CRITIC-OWNED probe 12: close the remaining RI-MTH01 A-rows I had not probed myself,
// and settle the 11-of-50 hit rate from probe11.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const out = process.argv[2];
const h = await launchGame({});
const page = h.page;
const o = { schema: 'critic/w1-00-probe12@1', at: new Date().toISOString() };

o.rows = await page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness'); H.setRenderRate(0);
  const r = {};
  const t = (k, fn) => { try { r[k] = { ok: true, v: JSON.parse(JSON.stringify(fn())) }; } catch (e) { r[k] = { ok: false, threw: String(e && e.message || e) }; } };
  H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs();
  // A16 traceDrain
  t('traceDrain', () => { H.traceStart({}); H.stepFrames(10); const a = H.traceDrain(); H.stepFrames(5); const b = H.traceDrain(); const c = H.traceStop(); return { first: a.length, second: b.length, stop: c.length, first_f: a[0]?.f, second_f: b[0]?.f, cleared: a.length === 10 && b.length === 5 }; });
  // A19/A20 spawn/despawn
  t('despawn', () => { const e = H.spawn('inf_trash', 0, 5, { as: 'dz' }); H.stepFrames(1); const before = H.listEntities().length; H.despawn(e); H.stepFrames(1); return { before, after: H.listEntities().length, snapshot_enemies: H.snapshot().enemies.length }; });
  // A21 aggro on an entity that has an ai
  t('aggro', () => { H.loadState('arena_flat'); const e = H.spawn('inf_trash', 0, 5, { as: 'ag' }); H.stepFrames(1); const b = H.snapshot().enemies[0].alert_state; H.aggro(e); H.stepFrames(1); return { before: b, after: H.snapshot().enemies[0].alert_state, ai: H.snapshot().enemies[0].ai }; });
  t('aggro_on_dummy', () => { H.loadState('arena_flat'); const e = H.spawn('dummy_passive', 0, 5, { as: 'ad' }); H.stepFrames(1); let err = null, ret = null; try { ret = H.aggro(e); } catch (x) { err = String(x.message || x); } H.stepFrames(1); return { ret, err, alert: H.snapshot().enemies[0].alert_state }; });
  // A22 lockOn
  t('lockOn', () => { H.loadState('arena_flat'); const e = H.spawn('inf_trash', 0, 5, { as: 'lo' }); H.stepFrames(1); H.lockOn(e); H.stepFrames(1); const s = H.snapshot(); return { player_locked_on: s.player.locked_on, camera_mode: s.camera.mode, camera_lock: s.camera.lock_on }; });
  // A23/A24 determinism of time-of-day and weather
  t('tod_weather', () => { H.loadState('vista_primary'); const a = H.setTimeOfDay(1.0); const w = H.setWeather('storm'); H.stepFrames(1); const e1 = JSON.parse(JSON.stringify(H.snapshot().env)); H.setTimeOfDay(1.0); H.setWeather('storm'); H.stepFrames(1); const e2 = JSON.parse(JSON.stringify(H.snapshot().env)); return { ret_tod: a, ret_weather: w, env1: e1, env2: e2, stable: JSON.stringify(e1) === JSON.stringify(e2) }; });
  // A26 listAnchors vs viewpoints.json
  t('anchors', () => H.listAnchors());
  // A28/A29
  t('listEntities', () => { H.loadState('arena_flat'); H.spawn('inf_trash', 1, 4, { as: 'q1' }); H.spawn('dummy_passive', -1, 4, { as: 'q2' }); H.stepFrames(1); return H.listEntities(); });
  // A03
  t('buildInfo', () => H.getBuildInfo());
  // hit-rate diagnosis: swing at 5 ranges, look at the hitbox record
  t('hit_ranges', () => {
    const rows = [];
    for (const d of [0.8, 1.2, 1.6, 2.0, 2.4, 2.8]) {
      H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
      H.spawn('dummy_passive', 0, d, { as: 'hr' });
      H.queueInputs([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }]);
      H.traceStart({}); H.stepFrames(120); const rec = H.traceStop();
      let hits = 0, hbFrames = 0, hbSample = null;
      for (const x of rec) { for (const hb of (x.player.hitboxes || [])) { hbFrames++; if (!hbSample) hbSample = hb; if ((hb.hits || []).length) hits++; } }
      rows.push({ dist_m: d, hitbox_active_frames: hbFrames, frames_with_a_hit: hits, sample_hitbox: hbSample });
    }
    return rows;
  });
  // 50-swing at the range that connects, to settle the 11/50
  t('fifty_at_best', () => {
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    H.spawn('dummy_passive', 0, 2.0, { as: 'f5' });
    const sc = []; for (let i = 0; i < 50; i++) { sc.push({ f: i * 120, press: ['light'] }); sc.push({ f: i * 120 + 3, release: ['light'] }); }
    H.queueInputs(sc);
    H.traceStart({}); H.stepFrames(50 * 120 + 200); const rec = H.traceStop();
    let atk = 0, hit = 0; const dmgs = []; const stam = [];
    for (const x of rec) { for (const e of (x.events || [])) { if (e.type === 'attack_start') atk++; if (e.type === 'hit') { hit++; dmgs.push(e.dmg && typeof e.dmg === 'object' ? e.dmg.phys : (e.dmg ?? null)); } } stam.push(x.player.stamina); }
    return { attacks: atk, hits: hit, distinct_damage: [...new Set(dmgs)], min_stamina: Math.min(...stam), rng_draws_max: Math.max(...rec.map(x => x.rng.draws)) };
  });
  return r;
});

// A33 screenshot + A25/A27 render path
const dataUrl = await page.evaluate(async () => { const H = window.__HARNESS; H.loadState('vista_primary'); H.setTimeOfDay(12); H.setWeather('clear'); H.setUIVisible(false); H.camera({ pos: [12, 6, 24], look: [0, 1, 0], fov: 60 }); H.stepFrames(24); H.renderFrame(); return await H.screenshot(); });
o.screenshot = { is_data_url: typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png;base64,'), length: (dataUrl || '').length };
if (o.screenshot.is_data_url) {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-00/vista-primary-1920x1080.png', buf);
  o.screenshot.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  o.screenshot.bytes = buf.length;
  o.screenshot.camera_pose = 'pos [12,6,24] look [0,1,0] fov 60, state vista_primary, tod 12.0, weather clear, HUD off, 1920x1080 dpr1, 24 settle steps';
}
o.page_errors = h.errors;
fs.writeFileSync(out, JSON.stringify(o, null, 2));
console.log('wrote', out);
await h.close();
