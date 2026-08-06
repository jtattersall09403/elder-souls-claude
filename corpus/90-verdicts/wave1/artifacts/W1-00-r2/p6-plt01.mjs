#!/usr/bin/env node
// CRITIC-OWNED probe: RI-PLT01 M6 decoupling, M7 frame-rate independence, M8 catch-up,
// M9 integer step, M1/M2 scene budget, M15 measurement honesty; RI-JRN05 M10/M15/M12.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const out = { produced_by: 'critic-owned p6-plt01.mjs' };

out.api = await page.evaluate(() => Object.keys(window.__HARNESS).sort());

// ---- M6 decoupling + M7 frame-rate independence ---------------------------
const rates = [60, 30, 15, 0];
out.M6_M7 = {};
for (const hz of rates) {
  const r = await page.evaluate(async (hz) => {
    const H = window.__HARNESS;
    if (H.setRenderRate) H.setRenderRate(hz);
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    H.spawn('inf_trash', 0, 7, { as: 'e0' }); H.stepFrames(30); H.reanchorFreeRunning();
    H.clearInputs();
    const sc = [{ f: 0, move: [0, 1] }];
    for (let f = 0; f < 600; f++) sc.push({ f, look: [2, 0] });
    H.queueInputs(sc);
    H.traceStart();
    const f0 = H.getFrame();
    H.stepFrames(600);
    const recs = H.traceStop();
    const s = H.snapshot();
    return {
      steps: H.getFrame() - f0, n: recs.length,
      hash_src: recs.map(x => JSON.stringify(x)).join('\n'),
      pos: s.player.pos, stamina: s.player.stamina, yaw: s.player.yaw_deg, cam_yaw: H.camera().yaw_deg,
      setRenderRate_present: !!H.setRenderRate,
    };
  }, hz);
  out.M6_M7[hz] = { steps: r.steps, records: r.n, body_sha256: sha(r.hash_src), pos: r.pos, stamina: r.stamina, yaw: r.yaw, cam_yaw: r.cam_yaw, setRenderRate_present: r.setRenderRate_present };
}
const hs = rates.map(hz => out.M6_M7[hz].body_sha256);
out.M6_pass = new Set(hs).size === 1 && rates.every(hz => out.M6_M7[hz].steps === 600);
out.M7_pass = new Set(rates.map(hz => JSON.stringify([out.M6_M7[hz].pos, out.M6_M7[hz].stamina, out.M6_M7[hz].yaw, out.M6_M7[hz].cam_yaw]))).size === 1;

// ---- M9 integer step ------------------------------------------------------
out.M9 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  if (H.setRenderRate) H.setRenderRate(60);
  H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0); H.stepFrames(24);
  H.traceStart(); H.stepFrames(3600); const recs = H.traceStop();
  let badF = 0, badT = 0; const dts = new Set();
  for (let i = 1; i < recs.length; i++) {
    if (recs[i].f - recs[i - 1].f !== 1) badF++;
    const dt = +(recs[i].t_ms - recs[i - 1].t_ms).toFixed(3);
    dts.add(dt);
    if (Math.abs(dt - 1000 / 60) > 0.002) badT++;
  }
  const last = recs[recs.length - 1];
  return { frames: recs.length, non_unit_f: badF, off_step_dt: badT, distinct_dt: [...dts], t_over_f: last.t_ms / last.f };
});

// ---- M8 catch-up ----------------------------------------------------------
out.M8 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  if (!H.stallMainThread || !H.setMode) return { unmeasurable: 'stallMainThread or setMode absent', keys: Object.keys(H).filter(k => /stall|mode|rate/i.test(k)) };
  H.setSeed(1337); H.loadState('arena_flat'); H.setMode('play');
  await new Promise(r => requestAnimationFrame(() => r()));
  const t0 = performance.now();
  H.stallMainThread(400);
  const stalled = performance.now() - t0;
  const perFrame = []; let prev = H.getFrame();
  for (let i = 0; i < 6; i++) {
    await new Promise(r => requestAnimationFrame(() => r()));
    const f = H.getFrame(); perFrame.push(f - prev); prev = f;
  }
  const st = H.getPerfStats ? H.getPerfStats() : {};
  H.setMode('harness');
  return { stall_measured_ms: +stalled.toFixed(2), steps_per_raf: perFrame, catchupClamps: st.catchupClamps, actionSetCap: H.getActionSet ? H.getActionSet().catchupCap : null };
});

// ---- M1/M2 scene budget ---------------------------------------------------
out.M1_M2 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const states = ['arena_flat', 'swamp_canopy', 'dungeon_primary'];
  const rows = {};
  for (const s of states) {
    try {
      H.setSeed(1337); H.loadState(s); H.stepFrames(10); H.renderFrame();
      rows[s] = H.getWorldStats();
    } catch (e) { rows[s] = { error: String(e.message).slice(0, 120) }; }
  }
  return rows;
});

// ---- M15 measurement honesty ---------------------------------------------
out.M15 = await page.evaluate(() => {
  const H = window.__HARNESS;
  const p = H.getPerfStats ? H.getPerfStats() : null;
  const l = H.getLoadState ? H.getLoadState() : null;
  return { perf_unmeasurable: p && p._unmeasurable, load_unmeasurable: l && l._unmeasurable, buildinfo: H.getBuildInfo() };
});

// ---- RI-JRN05 storage discipline + save-during-sim -------------------------
out.JRN05 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const r = {};
  H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(60);
  r.storage = H.getStorageInfo ? H.getStorageInfo() : 'absent';
  try {
    const before = localStorage.length; const items = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); items.push([k, (localStorage.getItem(k) || '').length]); }
    r.localStorage = { count: before, items };
  } catch (e) { r.localStorage = String(e.message); }
  // M14 export / wipe / import
  if (H.exportSave && H.importSave) {
    const h0 = H.getStateHash();
    const blob = await H.exportSave();
    H.setSeed(999); H.loadState('swamp_canopy'); H.stepFrames(30);
    await H.importSave(blob);
    r.M14 = { h0, h1: H.getStateHash(), equal: h0 === H.getStateHash() };
  } else r.M14 = { absent: Object.keys(H).filter(k => /export|import|save|slot/i.test(k)) };
  return r;
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ M6_pass: out.M6_pass, M7_pass: out.M7_pass, M9: out.M9, M8: out.M8, M15: out.M15, JRN05: out.JRN05, M1: out.M1_M2 }, null, 1).slice(0, 5000));
await h.close();
