#!/usr/bin/env node
// critic-w1-08-r2 probe 3 — CONSUMPTION done properly (layout records are {action,x,y,r}),
// the stuck-calibration escape question, and the deliverable picture.
import { launchGame } from '../lib/browser.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT_DIR;
mkdirSync(OUT, { recursive: true });
const R = { at: new Date().toISOString(), load_at_start: readFileSync('/proc/loadavg', 'utf8').trim(), legs: {} };
const bank = (n, o) => { R.legs[n] = o; writeFileSync(path.join(OUT, 'probe3.json'), JSON.stringify(R, null, 2)); console.log(`[${n}] ${JSON.stringify(o).slice(0, 1600)}`); };

const handle = await launchGame({ width: 844, height: 390 });
const { page } = handle;
async function H(m, ...a) {
  return page.evaluate(async ({ m, a }) => {
    const h = window.__HARNESS;
    if (!h || typeof h[m] !== 'function') return { ok: false, e: `${m} absent` };
    try { return { ok: true, v: await h[m](...a) }; } catch (e) { return { ok: false, e: String(e && e.message || e) }; }
  }, { m, a });
}
const v = async (m, ...a) => (await H(m, ...a)).v;
const HANDHELD = { size: { w: 844, h: 390, dpr: 1 }, pointer: 'coarse', orientation: 'landscape' };

try {
  await page.waitForFunction(() => !!(window.__HARNESS && window.__ENGINE && window.__ENGINE.real), null, { timeout: 180000 });

  // ============ C1 — CONSUMPTION: does a touch press move the WORLD? ====================
  await H('reset', { state: 'arena_flat' });
  await H('setMode', 'play-instrumented');
  await H('setRenderRate', 0);
  await H('setViewport', HANDHELD);
  await H('stepFrames', 6);

  const C = {};
  const lay = await v('touchLayout');
  const ctrls = Array.isArray(lay) ? lay : (lay && lay.controls) || [];
  C.controls = ctrls.map((c) => ({ action: c.action, x: c.x, y: c.y, r: c.r, gate: c.gate || null }));

  // ---- the stick. Where is it? Ask the profile rather than guessing.
  C.touch_cfg = await page.evaluate(() => {
    const t = window.__ENGINE.real.touch;
    return { cfg_keys: Object.keys(t.cfg || {}), stick: t.cfg && t.cfg.stick ? t.cfg.stick : null,
             regions: t.cfg && t.cfg.regions ? t.cfg.regions : null };
  });

  const posOf = async () => page.evaluate(() => {
    const p = window.__ENGINE.sim.player;
    const q = p.pos || [p.x, p.y, p.z];
    return { x: +Number(q[0]).toFixed(4), z: +Number(q[2]).toFixed(4), yaw: +Number(p.yaw ?? 0).toFixed(4) };
  });

  // stick drag inside the left half
  const s0 = await posOf();
  await H('touchDown', 1, 150, 300);
  await H('stepFrames', 1);
  C.stick_after_down = (await v('touchState')).stick;
  await H('touchMove', 1, 230, 300);
  await H('stepFrames', 1);
  C.stick_after_move = (await v('touchState')).stick;
  for (let i = 0; i < 60; i++) await H('stepFrames', 1);
  C.move_vector = await v('getMoveVector');
  const s1 = await posOf();
  await H('touchUp', 1);
  await H('stepFrames', 5);
  const s2 = await posOf();
  C.stick = { from: s0, during: s1, after_release: s2,
              displacement_m: +Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(4),
              drift_after_release_m: +Math.hypot(s2.x - s1.x, s2.z - s1.z).toFixed(4) };

  // ---- NULL CONTROL for the stick: touch down in the same place and DO NOT move it
  const n0 = await posOf();
  await H('touchDown', 3, 150, 300);
  for (let i = 0; i < 60; i++) await H('stepFrames', 1);
  const n1 = await posOf();
  await H('touchUp', 3);
  C.stick_null_control = { displacement_m: +Math.hypot(n1.x - n0.x, n1.z - n0.z).toFixed(4) };

  // ---- every button: press it, and record which action the WORLD saw
  const btnResults = {};
  for (const c of ctrls) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) { btnResults[c.action] = { error: 'no coords' }; continue; }
    await H('reset', { state: 'arena_flat' });
    await H('setMode', 'play-instrumented');
    await H('setRenderRate', 0);
    await H('setViewport', HANDHELD);
    await H('stepFrames', 4);
    const e0 = (await v('getInputEdges')).length;
    const b0 = await page.evaluate(() => { const p = window.__ENGINE.sim.player; const q = p.pos || [p.x,p.y,p.z]; return { st: p.state ?? p.anim ?? null, stam: p.stamina ?? null, x: Number(q[0]), z: Number(q[2]) }; });
    await H('touchDown', 5, c.x, c.y);
    await H('stepFrames', 3);          // a TAP — under the 12-frame hold gate
    await H('touchUp', 5);
    await H('stepFrames', 14);
    const edges = (await v('getInputEdges')).slice(e0);
    const b1 = await page.evaluate(() => { const p = window.__ENGINE.sim.player; const q = p.pos || [p.x,p.y,p.z]; return { st: p.state ?? p.anim ?? null, stam: p.stamina ?? null, x: Number(q[0]), z: Number(q[2]) }; });
    btnResults[c.action] = {
      edges_down: edges.filter((e) => e.edge === 'down').map((e) => e.button),
      state_before: b0.st, state_after: b1.st,
      stamina_delta: (b0.stam != null && b1.stam != null) ? +(b1.stam - b0.stam).toFixed(3) : null,
      moved_m: +Math.hypot(b1.x - b0.x, b1.z - b0.z).toFixed(3),
    };
  }
  C.buttons = btnResults;
  // NULL CONTROL for the buttons: press dead glass
  await H('reset', { state: 'arena_flat' }); await H('setMode', 'play-instrumented');
  await H('setRenderRate', 0); await H('setViewport', HANDHELD); await H('stepFrames', 4);
  const de0 = (await v('getInputEdges')).length;
  await H('touchDown', 6, 422, 30); await H('stepFrames', 3); await H('touchUp', 6); await H('stepFrames', 14);
  C.dead_glass_null_control = (await v('getInputEdges')).slice(de0).filter((e) => e.edge === 'down').map((e) => e.button);
  bank('C1_consumption', C);

  // ============ C2 — is a stuck calibration escapable on a phone? ======================
  await page.evaluate(() => {
    window.__CW = {
      pads(d, i) { const b = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
        if (i != null) b[i] = { pressed: true, touched: true, value: 1 };
        return [{ id: d.id, index: d.index, mapping: d.mapping, connected: true, buttons: b, axes: [0, 0, 0, 0], timestamp: performance.now() }]; },
      calibrate(d, order) { const h = window.__HARNESS;
        for (const i of order) { h.setSyntheticPads(this.pads(d, null)); h.stepFrames(2); h.setSyntheticPads(this.pads(d, i)); h.stepFrames(3); }
        h.setSyntheticPads(this.pads(d, null)); h.stepFrames(2); return true; },
      unplug() { const h = window.__HARNESS; h.setSyntheticPads([]); h.stepFrames(3); return true; },
      cal() { const p = window.__ENGINE.real.pad; return { calibrating: !!p.calibration, prompt: p.calibrationPrompt ? p.calibrationPrompt() : null }; },
      wipe() { const p = window.__ENGINE.real.pad; p.calibration = null; p.calibrationResult = null; p.sessionProfiles.clear();
        for (const k of Array.from(p.pads.keys())) p.pads.delete(k); p.activeIndex = null; p.connected = false;
        window.__HARNESS.setSyntheticPads([]); window.__HARNESS.stepFrames(2); return true; },
    }; return true;
  });
  const cw = (f, ...a) => page.evaluate(({ f, a }) => window.__CW[f](...a), { f, a });
  const STRANGER = { id: 'Some Unknown Pad 9000', mapping: '', index: 0 };
  const STANDARD = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', mapping: 'standard', index: 0 };

  await cw('wipe');
  await H('reset', { state: 'arena_flat' }); await H('setMode', 'play-instrumented');
  await H('setRenderRate', 0); await H('setViewport', HANDHELD); await H('stepFrames', 4);
  await cw('calibrate', STRANGER, [0, 1]);
  await cw('unplug');
  const K = { cal_stuck: await cw('cal') };
  // Can the player still play on the glass while the pad calibration is stuck?
  const lay2 = await v('touchLayout');
  const c2 = Array.isArray(lay2) ? lay2 : [];
  K.touch_controls_during_stuck_cal = c2.map((c) => c.action);
  const light2 = c2.find((c) => c.action === 'light');
  if (light2) {
    const e0 = (await v('getInputEdges')).length;
    await H('touchDown', 7, light2.x, light2.y); await H('stepFrames', 3); await H('touchUp', 7); await H('stepFrames', 10);
    K.touch_light_during_stuck_cal = (await v('getInputEdges')).slice(e0).filter((e) => e.edge === 'down').map((e) => e.button);
  }
  // and does the prompt keep drawing?
  await H('renderFrame');
  K.prompt_still_drawn = (await cw('cal')).prompt;
  // does the standard pad ever recover on its own after N frames?
  await H('stepFrames', 600);
  K.after_600_frames = await cw('cal');
  bank('C2_stuck_calibration', K);

  // ============ C3 — the deliverable picture ==========================================
  await cw('wipe');
  await H('reset', { state: 'arena_flat' });
  await H('setMode', 'play-instrumented');
  await H('setRenderRate', 60);
  await H('setViewport', HANDHELD);
  await H('stepFrames', 30);
  await H('renderFrame');
  await new Promise((r) => setTimeout(r, 400));
  writeFileSync(path.join(OUT, 'deliver-handheld.png'), await page.screenshot({ type: 'png' }));
  // and with the drawer open, so the shot shows the whole affordance set
  const drawer = (Array.isArray(await v('touchLayout')) ? await v('touchLayout') : []).find((c) => c.action === '__drawer');
  if (drawer) {
    await H('touchDown', 9, drawer.x, drawer.y); await H('stepFrames', 3); await H('touchUp', 9); await H('stepFrames', 6);
    await H('renderFrame'); await new Promise((r) => setTimeout(r, 300));
    writeFileSync(path.join(OUT, 'deliver-handheld-drawer.png'), await page.screenshot({ type: 'png' }));
    const l3 = await v('touchLayout');
    bank('C3_drawer', { open: (await v('touchState')).drawerOpen, controls: (Array.isArray(l3) ? l3 : []).map((c) => c.action) });
  }
  console.log('DONE');
} catch (e) {
  console.log('ERR', String(e && e.stack || e));
  R.error = String(e && e.stack || e).slice(0, 2500);
  writeFileSync(path.join(OUT, 'probe3.json'), JSON.stringify(R, null, 2));
} finally { await handle.close(); }
