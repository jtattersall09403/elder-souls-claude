#!/usr/bin/env node
// critic-w1-08-r2 probe 2 — one browser. Clean ablation, the instruction budget driven directly,
// consumption, and the gamepad defect past the builder's single sequence.
import { launchGame } from '../lib/browser.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const OUT = process.env.OUT_DIR;
mkdirSync(OUT, { recursive: true });
const R = { at: new Date().toISOString(), load_at_start: null, legs: {} };
const say = (...a) => console.log(...a);
const bank = (n, o) => { R.legs[n] = o; writeFileSync(path.join(OUT, 'probe2.json'), JSON.stringify(R, null, 2)); say(`[${n}] ${JSON.stringify(o).slice(0, 1400)}`); };
R.load_at_start = (await import('node:fs')).readFileSync('/proc/loadavg', 'utf8').trim();

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
const md5 = (b) => createHash('md5').update(b).digest('hex').slice(0, 16);

async function diffPct(a, b) {
  return page.evaluate(async ({ A, B }) => {
    const load = (d) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = 'data:image/png;base64,' + d; });
    const [ia, ib] = await Promise.all([load(A), load(B)]);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const cx = c.getContext('2d');
    cx.drawImage(ia, 0, 0); const pa = cx.getImageData(0, 0, c.width, c.height).data;
    cx.clearRect(0, 0, c.width, c.height); cx.drawImage(ib, 0, 0); const pb = cx.getImageData(0, 0, c.width, c.height).data;
    let n = 0, tot = 0;
    for (let i = 0; i < pa.length; i += 4) { tot++; if (Math.abs(pa[i] - pb[i]) > 6 || Math.abs(pa[i + 1] - pb[i + 1]) > 6 || Math.abs(pa[i + 2] - pb[i + 2]) > 6) n++; }
    return +(100 * n / tot).toFixed(3);
  }, { A: a.toString('base64'), B: b.toString('base64') });
}

try {
  await page.waitForFunction(() => !!(window.__HARNESS && window.__ENGINE && window.__ENGINE.real), null, { timeout: 180000 });

  const HANDHELD = { size: { w: 844, h: 390, dpr: 1 }, pointer: 'coarse', orientation: 'landscape' };
  const DESKTOP = { size: { w: 844, h: 390, dpr: 1 }, pointer: 'fine', orientation: 'landscape' };

  // ================= P2A — CLEAN ablation. Device class only. Frame PINNED, never stepped. ====
  await H('loadState', 'arena_flat');
  await H('setMode', 'play-instrumented');
  await H('setRenderRate', 0);
  await H('stepFrames', 24);
  const pinnedFrame = await v('getFrame');

  async function shoot(tag) {
    await H('renderFrame');
    await new Promise((r) => setTimeout(r, 180));
    return page.screenshot({ type: 'png' });
  }
  async function arm(tag, viewport, mutate) {
    await H('setViewport', viewport);
    if (mutate) await page.evaluate(mutate);
    const buf = await shoot(tag);
    const lay = await v('touchLayout');
    const st = await v('touchState');
    const n = Array.isArray(lay) ? lay.length : (lay && Array.isArray(lay.controls) ? lay.controls.length : null);
    return { tag, md5: md5(buf), frame: await v('getFrame'), n_layout: n, shown: st ? st.shown : null,
             visible: st ? st.visible : null, enabled: st ? st.enabled : null, buf, lay };
  }

  const A = {};
  const desk1 = await arm('desktop-1', DESKTOP, null);
  const desk2 = await arm('desktop-2-NULLCONTROL', DESKTOP, null);
  const hand1 = await arm('handheld-1', HANDHELD, null);
  const hand2 = await arm('handheld-2-NULLCONTROL', HANDHELD, null);
  const broke = await arm('handheld-fix-deleted', HANDHELD, () => {
    const E = window.__ENGINE;
    if (!window.__SAVED) window.__SAVED = E._uiCtx.bind(E);
    E._uiCtx = function () { const c = window.__SAVED(); if (c) { c.touch = null; c.rotate = null; } return c; };
  });
  const rest = await arm('handheld-restored', HANDHELD, () => {
    if (window.__SAVED) { window.__ENGINE._uiCtx = window.__SAVED; window.__SAVED = null; }
  });
  A.arms = [desk1, desk2, hand1, hand2, broke, rest].map(({ buf, lay, ...r }) => r);
  A.pinned_frame = pinnedFrame;
  A.null_desktop_identical = desk1.md5 === desk2.md5;
  A.null_handheld_identical = hand1.md5 === hand2.md5;
  A.diff_desktop_vs_handheld_pct = await diffPct(desk1.buf, hand1.buf);
  A.diff_handheld_null_pct = await diffPct(hand1.buf, hand2.buf);
  A.diff_handheld_vs_fixdeleted_pct = await diffPct(hand1.buf, broke.buf);
  A.diff_fixdeleted_vs_desktop_pct = await diffPct(broke.buf, desk1.buf);
  A.handheld_layout = Array.isArray(hand1.lay) ? hand1.lay.map((c) => ({ id: c.id || c.action, r: c.r, cx: c.cx, cy: c.cy, label: c.label ?? null, glyph: c.glyph ?? null })) : hand1.lay;
  A.desktop_layout_n = desk1.n_layout;
  writeFileSync(path.join(OUT, 'p2-handheld.png'), hand1.buf);
  writeFileSync(path.join(OUT, 'p2-desktop.png'), desk1.buf);
  writeFileSync(path.join(OUT, 'p2-fixdeleted.png'), broke.buf);
  bank('P2A_ablation', A);

  // ================= P2B — the instruction budget, driven directly =========================
  await H('setViewport', DESKTOP);
  const inst = await page.evaluate(() => {
    // Re-implemented HERE by the critic — I do not import the builder's __IC.
    const H = window.__HARNESS;
    H.renderedTextClear();
    const states = [];
    const go = (label, fn) => { try { fn(); H.getUIState(); states.push(label); } catch (e) { states.push(label + ':ERR:' + (e && e.message || e).slice(0, 60)); } };
    go('arena_flat', () => { H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0); H.stepFrames(4); });
    go('settlement', () => { H.reset({ state: 'settlement_primary_street' }); H.setRenderRate(0); H.stepFrames(4); });
    go('helstrom-market', () => { H.reset({ state: 'helstrom-market' }); H.setRenderRate(0); H.stepFrames(4); });
    go('barge-hold', () => { H.reset({ state: 'barge-hold' }); H.setRenderRate(0); H.stepFrames(4); });
    go('inventory', () => { H.openMenu('inventory'); H.stepFrames(2); });
    go('journal', () => { H.openMenu('journal'); H.stepFrames(2); });
    go('sheet', () => { H.openMenu('sheet'); H.stepFrames(2); });
    go('spells', () => { H.openMenu('spells'); H.stepFrames(2); });
    go('close', () => { H.closeMenu(); H.stepFrames(2); });
    go('title', () => { H.titleShow(); H.stepFrames(2); });
    go('handheld', () => {
      H.reset({ state: 'arena_flat' }); H.setRenderRate(0);
      H.setViewport({ size: { w: 844, h: 390, dpr: 2 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
      H.stepFrames(4); H.setViewport({ pointer: 'fine' });
    });
    const t = H.getRenderedText({});
    const bySurface = {};
    for (const e of t.entries) bySurface[e.surface] = (bySurface[e.surface] || 0) + 1;
    return { states, entries: t.entries.length, distinct: t.distinct_count, complete: t.complete,
             blind: t.blind_surfaces, by_surface: bySurface, sample: t.distinct.slice(0, 24) };
  });
  bank('P2B_budget_register', inst);

  // ================= P2C — BREAK IT ON PURPOSE via the SHIPPED toast ======================
  const brk = await page.evaluate(() => {
    const H = window.__HARNESS;
    H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
    H.renderedTextClear();
    H.uiToast('Press E to open the door', 120);
    H.stepFrames(4); H.getUIState();
    const t = H.getRenderedText({});
    const LEX = ['press ', 'tap ', 'click ', 'hold '];
    const hits = t.distinct.filter((s) => LEX.some((w) => s.toLowerCase().includes(w)));
    return { entries: t.entries.length, hits, sample: t.distinct.slice(0, 10) };
  });
  bank('P2C_break_MK20', { ...brk, instrument_goes_red: brk.hits.length > 0 });

  // ================= P2D — CONSUMPTION: a touch press must move the world =================
  await H('reset', { state: 'arena_flat' });
  await H('setMode', 'play-instrumented');
  await H('setRenderRate', 0);
  await H('setViewport', HANDHELD);
  await H('stepFrames', 6);
  const lay = await v('touchLayout');
  const ctrls = Array.isArray(lay) ? lay : (lay && lay.controls) || [];
  const D = { n: ctrls.length, ids: ctrls.map((c) => c.id || c.action), sample: ctrls[0] || null,
              shown: await v('touchState') };
  // stick: the profile's floating stick region
  const tstate = await v('touchState');
  D.touch_state_keys = tstate ? Object.keys(tstate) : null;
  const p0 = await v('snapshot');
  await H('touchDown', 1, 120, 300);
  await H('touchMove', 1, 190, 300);
  for (let i = 0; i < 40; i++) await H('stepFrames', 1);
  D.move_vector = await v('getMoveVector');
  const p1 = await v('snapshot');
  await H('touchUp', 1);
  const pos = (s) => { const p = s && (s.player || s.p); return p ? [p.x ?? p.px, p.z ?? p.pz] : null; };
  D.snapshot_keys = p0 ? Object.keys(p0) : null;
  D.from = pos(p0); D.to = pos(p1);
  if (D.from && D.to) D.displacement_m = +Math.hypot(D.to[0] - D.from[0], D.to[1] - D.from[1]).toFixed(3);
  // button
  const light = ctrls.find((c) => /light/.test(String(c.id || c.action)));
  if (light) {
    const e0 = (await v('getInputEdges')).length;
    await H('touchDown', 2, light.cx, light.cy);
    await H('stepFrames', 3);
    await H('touchUp', 2);
    await H('stepFrames', 10);
    const edges = await v('getInputEdges');
    D.button = { id: light.id || light.action, centre: [light.cx, light.cy],
                 edges: edges.slice(e0).map((e) => `${e.button}:${e.edge}`) };
    const cs = await v('getCombatState');
    D.combat_after = cs ? { state: cs.state ?? (cs.player && cs.player.state), frame: cs.frame } : null;
  }
  bank('P2D_consumption', D);

  // ================= P2E — the gamepad, past the builder's one sequence ====================
  await H('setViewport', DESKTOP);
  await H('reset', { state: 'arena_flat' });
  await H('setMode', 'play-instrumented');
  await H('setRenderRate', 0);
  await page.evaluate(() => {
    window.__CW = {
      pads(d, i) { const b = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
        if (i != null) b[i] = { pressed: true, touched: true, value: 1 };
        return [{ id: d.id, index: d.index, mapping: d.mapping, connected: true, buttons: b, axes: [0, 0, 0, 0], timestamp: performance.now() }]; },
      press(d, i) { const h = window.__HARNESS;
        h.setSyntheticPads(this.pads(d, null)); h.stepFrames(2);
        const m = h.getInputEdges().length;
        h.setSyntheticPads(this.pads(d, i)); h.stepFrames(3);
        const g = h.getInputEdges().slice(m);
        h.setSyntheticPads(this.pads(d, null)); h.stepFrames(2);
        return g.map((e) => `${e.button}:${e.edge}`); },
      unplug() { const h = window.__HARNESS; h.setSyntheticPads([]); h.stepFrames(3); return true; },
      cal() { const p = window.__ENGINE.real.pad;
        return { calibrating: !!p.calibration, prompt: p.calibrationPrompt ? p.calibrationPrompt() : null,
                 result_id: p.calibrationResult ? p.calibrationResult.id : null,
                 result_map: p.calibrationResult ? { ...p.calibrationResult.map } : null, n_pads: p.pads.size }; },
      calibrate(d, order) { const h = window.__HARNESS;
        for (const i of order) { h.setSyntheticPads(this.pads(d, null)); h.stepFrames(2); h.setSyntheticPads(this.pads(d, i)); h.stepFrames(3); }
        h.setSyntheticPads(this.pads(d, null)); h.stepFrames(2); return this.cal(); },
      wipe() { const p = window.__ENGINE.real.pad; p.calibration = null; p.calibrationResult = null;
        p.sessionProfiles.clear(); for (const k of Array.from(p.pads.keys())) p.pads.delete(k);
        p.activeIndex = null; p.connected = false; window.__HARNESS.setSyntheticPads([]); window.__HARNESS.stepFrames(2); return true; },
      // MY PROPOSED ONE-LINE FIX: a calibration belongs to the pad it was begun on.
      applyFix() { const p = window.__ENGINE.real.pad;
        if (p.__critFixed) return 'already';
        const orig = p._dropPad.bind(p);
        p._dropPad = function (idx, frame) { const st = this.pads.get(idx); orig(idx, frame);
          if (st && this.calibration && !this.calibration.done) this.calibration = null; };
        p.__critFixed = true; return 'applied'; },
    }; return true;
  });
  const cw = (f, ...a) => page.evaluate(({ f, a }) => window.__CW[f](...a), { f, a });
  const STRANGER = { id: 'Some Unknown Pad 9000', mapping: '', index: 0 };
  const STANDARD = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', mapping: 'standard', index: 0 };
  const E = {};

  await cw('wipe');
  E.control_standard_idx0 = await cw('press', STANDARD, 0);

  // E-A: unplug MID-calibration, then a standard pad arrives — BEFORE my fix
  await cw('wipe');
  await cw('press', STRANGER, 0);
  E.a_partial = await cw('calibrate', STRANGER, [0, 1]);
  await cw('unplug');
  E.a_cal_survives_unplug = await cw('cal');
  E.a_standard_presses = { i0: await cw('press', STANDARD, 0), i1: await cw('press', STANDARD, 1),
                           i2: await cw('press', STANDARD, 2), i3: await cw('press', STANDARD, 3) };
  E.a_cal_after = await cw('cal');
  // finish it off on the standard pad and see what the standard pad ends up mapped to
  E.a_finish_on_standard = await cw('calibrate', STANDARD, [4, 5, 6, 7]);
  E.a_standard_after_finish = { i0: await cw('press', STANDARD, 0), i4: await cw('press', STANDARD, 4),
                                i5: await cw('press', STANDARD, 5) };
  bank('P2E_gamepad', E);

  // E-B: same sequence WITH my one-line fix — delete-the-fix in reverse
  E.fix = await cw('applyFix');
  await cw('wipe');
  await cw('press', STRANGER, 0);
  E.b_partial = await cw('calibrate', STRANGER, [0, 1]);
  await cw('unplug');
  E.b_cal_after_unplug = await cw('cal');
  E.b_standard_presses = { i0: await cw('press', STANDARD, 0), i5: await cw('press', STANDARD, 5) };
  bank('P2E_gamepad', E);

  // ================= P2F — S35 screen suppression, and a map picture ======================
  await cw('wipe');
  await H('reset', { state: 'arena_flat' });
  await H('setMode', 'play-instrumented');
  await H('setRenderRate', 0);
  await H('setViewport', HANDHELD);
  await H('stepFrames', 4);
  const S = {};
  const readLayout = async () => { const l = await v('touchLayout'); const a = Array.isArray(l) ? l : (l && l.controls) || []; return a.map((c) => c.id || c.action); };
  S.world = await readLayout();
  for (const m of ['map', 'journal', 'inventory']) {
    const o = await H('openMenu', m);
    if (!o.ok) { S[m] = { error: o.e }; continue; }
    await H('stepFrames', 3);
    S[m] = await readLayout();
    if (m === 'map') { await H('renderFrame'); await new Promise((r) => setTimeout(r, 150)); writeFileSync(path.join(OUT, 'p2-map-handheld.png'), await page.screenshot({ type: 'png' })); }
    await H('closeMenu'); await H('stepFrames', 3);
  }
  S.world_after = await readLayout();
  bank('P2F_screen_suppression', S);

  say('DONE');
} catch (e) {
  say('ERR', String(e && e.stack || e));
  R.error = String(e && e.stack || e).slice(0, 2500);
  writeFileSync(path.join(OUT, 'probe2.json'), JSON.stringify(R, null, 2));
} finally { await handle.close(); }
