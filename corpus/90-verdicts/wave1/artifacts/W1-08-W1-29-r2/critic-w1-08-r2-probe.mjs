#!/usr/bin/env node
// critic-w1-08-r2 probe — ONE browser, held for everything. Written by the critic, imports no
// builder check code. Every predicate here is mine.
import { launchGame } from '../lib/browser.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const OUT = process.env.OUT_DIR;
mkdirSync(OUT, { recursive: true });
const results = { at: new Date().toISOString(), legs: {} };
const say = (...a) => console.log(...a);
function bank(name, obj) {
  results.legs[name] = obj;
  writeFileSync(path.join(OUT, 'critic-probe.json'), JSON.stringify(results, null, 2));
  say(`[${name}] ${JSON.stringify(obj).slice(0, 1200)}`);
}

const handle = await launchGame({ width: 844, height: 390 });
const { page } = handle;

/** SOFT harness call — never dies, returns {ok,v} or {ok:false,e}. handle.h() calls die(). */
async function H(m, ...a) {
  return page.evaluate(async ({ m, a }) => {
    const h = window.__HARNESS;
    if (!h || typeof h[m] !== 'function') return { ok: false, e: `${m} absent` };
    try { return { ok: true, v: await h[m](...a) }; } catch (e) { return { ok: false, e: String(e && e.message || e) }; }
  }, { m, a });
}
const v = async (m, ...a) => (await H(m, ...a)).v;

try {
  await page.waitForFunction(() => !!(window.__HARNESS && window.__ENGINE && window.__ENGINE.real), null, { timeout: 180000 });
  say('booted, frame', await v('getFrame'));

  const md5 = (b) => createHash('md5').update(b).digest('hex').slice(0, 16);
  async function shotStats(buf) {
    const b64 = buf.toString('base64');
    return page.evaluate(async (d) => {
      const img = new Image();
      await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + d; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
      const p = cx.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set(); let sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < p.length; i += 4) {
        const l = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000;
        sum += l; sum2 += l * l; n++;
        if (seen.size < 60000) seen.add((p[i] >> 3 << 10) | (p[i + 1] >> 3 << 5) | (p[i + 2] >> 3));
      }
      const mean = sum / n;
      const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      return { w: img.width, h: img.height, distinct_colours: seen.size, mean_luma: +mean.toFixed(2),
               stdev_luma: +sd.toFixed(3), blank: seen.size < 8 || sd < 1.0 };
    }, b64);
  }

  const HANDHELD = { width: 844, height: 390, deviceClass: 'handheld', pointer: 'coarse', orientation: 'landscape' };
  const DESKTOP = { width: 1280, height: 720, deviceClass: 'desktop', pointer: 'fine', orientation: 'landscape' };

  // ============================================================ LEG A/B — is it PAINTED?
  say('vp probe:', JSON.stringify(await H('setViewport', HANDHELD)));
  say('vp state:', JSON.stringify(await v('getViewport')));
  await H('loadState', 'arena_flat');
  await H('setRenderRate', 0);
  await H('stepFrames', 24);

  async function arm(tag, viewport, mutate) {
    await H('setViewport', viewport);
    if (mutate) await page.evaluate(mutate);
    await H('setTouchEnabled', true);
    await H('stepFrames', 1);
    await H('renderFrame');
    await new Promise((r) => setTimeout(r, 200));
    const buf = await page.screenshot({ type: 'png' });
    const layout = await v('touchLayout');
    const state = await v('touchState');
    const inp = await v('getInputState');
    const list = layout && (layout.controls || layout.items || layout.list);
    return { tag, md5: md5(buf), n_controls: Array.isArray(list) ? list.length : null,
             layout_keys: layout ? Object.keys(layout) : null,
             visible: state ? state.visible : null,
             held: inp ? inp.held : null,
             stats: await shotStats(buf), buf, list };
  }

  const aDesk = await arm('desktop', DESKTOP, null);
  const aHand = await arm('handheld', HANDHELD, null);
  const aNull = await arm('desktop-resample', DESKTOP, null);
  const aBroken = await arm('handheld-fix-deleted', HANDHELD, () => {
    const E = window.__ENGINE;
    if (!window.__ES_SAVED_UICTX) window.__ES_SAVED_UICTX = E._uiCtx.bind(E);
    E._uiCtx = function () { const c = window.__ES_SAVED_UICTX(); if (c) { c.touch = null; c.rotate = null; } return c; };
  });
  const aRestored = await arm('handheld-restored', HANDHELD, () => {
    if (window.__ES_SAVED_UICTX) { window.__ENGINE._uiCtx = window.__ES_SAVED_UICTX; window.__ES_SAVED_UICTX = null; }
  });

  writeFileSync(path.join(OUT, 'handheld.png'), aHand.buf);
  writeFileSync(path.join(OUT, 'desktop.png'), aDesk.buf);
  writeFileSync(path.join(OUT, 'handheld-fix-deleted.png'), aBroken.buf);

  bank('A_B_ablation', {
    arms: [aDesk, aHand, aNull, aBroken, aRestored].map(({ buf, list, ...r }) => r),
    handheld_controls: aHand.list ? aHand.list.map((c) => c.id || c.action || c.name) : null,
    null_control_stable: aDesk.md5 === aNull.md5,
    handheld_differs: aHand.md5 !== aDesk.md5,
    delete_fix_returns_to_desktop: aBroken.md5 === aDesk.md5,
    restored_matches: aRestored.md5 === aHand.md5,
  });

  // ============================================================ LEG C — the text register
  await H('setViewport', HANDHELD);
  const cov = await v('registerSurfaces');
  const perState = {};
  for (const s of ['arena_flat', 'default', 'barge-hold', 'helstrom-market']) {
    const r = await H('loadState', s);
    if (!r.ok) { perState[s] = { error: r.e }; continue; }
    await H('setTouchEnabled', true);
    await H('renderedTextClear');
    await H('stepFrames', 2);
    await H('renderFrame');
    const rt = await v('getRenderedText');
    perState[s] = rt ? { entries: rt.entries.length, distinct: rt.distinct_count, complete: rt.complete,
                         blind: rt.blind_surfaces, sample: rt.distinct.slice(0, 8) } : { error: 'no result' };
  }
  const uiStates = {};
  await H('loadState', 'arena_flat');
  for (const m of ['journal', 'map', 'inventory']) {
    const o = await H('openMenu', m);
    if (!o.ok) { uiStates[m] = { error: o.e }; continue; }
    await H('renderedTextClear'); await H('stepFrames', 2); await H('renderFrame');
    const rt = await v('getRenderedText');
    uiStates[m] = rt ? { entries: rt.entries.length, distinct: rt.distinct_count, complete: rt.complete, sample: rt.distinct.slice(0, 6) } : { error: 'none' };
    await H('closeMenu');
  }
  await H('renderedTextClear');
  const sent = await v('drawOnMenus', 'Press E to open');
  const rtAfter = await v('getRenderedText');
  const LEX = ['press ', 'hold ', 'tap ', 'click', 'd-pad'];
  const myHits = rtAfter ? rtAfter.distinct.filter((t) => LEX.some((w) => t.toLowerCase().includes(w))) : [];
  bank('C_register', { coverage: cov, per_state: perState, ui_states: uiStates,
                       sentinel: sent, my_grep_hits: myHits, instrument_goes_red: myHits.length > 0 });

  // ============================================================ LEG D — M-P20 re-derived
  await H('closeMenu');
  await H('setViewport', HANDHELD);
  const D = {};
  await H('renderedTextClear');
  await H('uiOpen', 'dialogue');
  await H('stepFrames', 3);
  await H('renderFrame');
  const rtd = await v('getRenderedText');
  if (rtd) {
    D.entry_keys = rtd.entries[0] ? Object.keys(rtd.entries[0]) : [];
    D.sample_entry = rtd.entries[0] || null;
    const runs = rtd.entries.map((e) => ({ t: String(e.text).slice(0, 70), surface: e.surface, px: e.px ?? e.fontPx ?? e.font_px ?? e.size ?? null }));
    const withPx = runs.filter((r) => Number.isFinite(r.px)).sort((a, b) => a.px - b.px);
    D.n = runs.length; D.n_with_px = withPx.length; D.smallest = withPx.slice(0, 6); D.largest = withPx.slice(-3);
    D.by_surface = {};
    for (const r of withPx) { const s = r.surface || '?'; if (!D.by_surface[s] || r.px < D.by_surface[s].px) D.by_surface[s] = r; }
  }
  D.dpr = await v('getDevicePixelRatio');
  D.viewport = await v('getViewport');
  bank('D_typesize', D);

  // ============================================================ LEG E — the gamepad
  await H('uiClose');
  await H('setViewport', DESKTOP);
  await H('loadState', 'arena_flat');
  await page.evaluate(() => {
    window.__CW = {
      pads(desc, downIdx) {
        const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
        if (downIdx != null) buttons[downIdx] = { pressed: true, touched: true, value: 1 };
        return [{ id: desc.id, index: desc.index, mapping: desc.mapping, connected: true,
                  buttons, axes: [0, 0, 0, 0], timestamp: performance.now() }];
      },
      press(desc, idx, frames = 3) {
        const h = window.__HARNESS;
        h.setSyntheticPads(this.pads(desc, null)); h.stepFrames(2);
        const mark = h.getInputEdges().length;
        h.setSyntheticPads(this.pads(desc, idx)); h.stepFrames(frames);
        const got = h.getInputEdges().slice(mark);
        h.setSyntheticPads(this.pads(desc, null)); h.stepFrames(2);
        return got.map((e) => `${e.button || e.action || e.name}:${e.edge}`);
      },
      unplug() { const h = window.__HARNESS; h.setSyntheticPads([]); h.stepFrames(3); return true; },
      cal() {
        const p = window.__ENGINE.real.pad;
        return { calibrating: !!p.calibration, cal_done: p.calibration ? p.calibration.done : null,
                 prompt: p.calibrationPrompt ? p.calibrationPrompt() : null,
                 result_id: p.calibrationResult ? p.calibrationResult.id : null,
                 result_map: p.calibrationResult ? { ...p.calibrationResult.map } : null,
                 profile: p.profileName, active: p.activeIndex, n_pads: p.pads.size };
      },
      calibrate(desc, order) {
        const h = window.__HARNESS;
        for (const i of order) {
          h.setSyntheticPads(this.pads(desc, null)); h.stepFrames(2);
          h.setSyntheticPads(this.pads(desc, i)); h.stepFrames(3);
        }
        h.setSyntheticPads(this.pads(desc, null)); h.stepFrames(2);
        return this.cal();
      },
      wipe() {
        const p = window.__ENGINE.real.pad;
        p.calibration = null; p.calibrationResult = null; p.sessionProfiles.clear();
        for (const k of Array.from(p.pads.keys())) p.pads.delete(k);
        p.activeIndex = null; p.connected = false;
        window.__HARNESS.setSyntheticPads([]); window.__HARNESS.stepFrames(2);
        return true;
      },
    };
    return true;
  });
  const cw = (f, ...a) => page.evaluate(({ f, a }) => window.__CW[f](...a), { f, a });

  const STRANGER = { id: 'Some Unknown Pad 9000', mapping: '', index: 0 };
  const STANDARD = { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', mapping: 'standard', index: 0 };
  const E = {};

  // E3 first — the clean control, so I know what "right" looks like
  await cw('wipe');
  E.control_clean_standard_idx0 = await cw('press', STANDARD, 0);
  E.control_clean_standard_idx5 = await cw('press', STANDARD, 5);

  // E1 — the builder's own sequence, my driver
  await cw('wipe');
  E.e1_stranger_arrives = await cw('press', STRANGER, 0);
  E.e1_after_arrival = await cw('cal');
  E.e1_calibrated = await cw('calibrate', STRANGER, [0, 1, 2, 3, 4, 5]);
  E.e1_stranger_raw0 = await cw('press', STRANGER, 0);
  await cw('unplug');
  E.e1_standard_idx0 = await cw('press', STANDARD, 0);
  E.e1_standard_idx5 = await cw('press', STANDARD, 5);
  E.e1_final_cal = await cw('cal');
  bank('E_gamepad', E);

  // E2 — PAST the builder's sequence: unplug the stranger MID-calibration
  await cw('wipe');
  E.e2_stranger_arrives = await cw('press', STRANGER, 0);
  E.e2_partial = await cw('calibrate', STRANGER, [0, 1]);
  await cw('unplug');
  E.e2_after_unplug = await cw('cal');
  E.e2_standard_idx0 = await cw('press', STANDARD, 0);
  E.e2_standard_idx1 = await cw('press', STANDARD, 1);
  E.e2_standard_idx2 = await cw('press', STANDARD, 2);
  E.e2_standard_idx3 = await cw('press', STANDARD, 3);
  E.e2_after_standard = await cw('cal');
  E.e2_standard_idx0_again = await cw('press', STANDARD, 0);
  bank('E_gamepad', E);

  // ============================================================ LEG F — CONSUMPTION
  await cw('wipe');
  await H('setViewport', HANDHELD);
  await H('loadState', 'arena_flat');
  await H('setTouchEnabled', true);
  await H('stepFrames', 5);
  const lay = await v('touchLayout');
  const list = (lay && (lay.controls || lay.items || lay.list)) || [];
  const F = { control_ids: list.map((c) => c.id || c.action || c.name), sample_control: list[0] || null };
  const stick = list.find((c) => /stick|move/i.test(String(c.id || c.action || c.kind || '')));
  if (stick) {
    const cx = stick.cx ?? stick.x, cy = stick.cy ?? stick.y;
    const p0 = await v('snapshot');
    await H('touchDown', 1, cx, cy);
    await H('touchMove', 1, cx + 70, cy);
    for (let i = 0; i < 40; i++) await H('stepFrames', 1);
    const mv = await v('getMoveVector');
    const p1 = await v('snapshot');
    await H('touchUp', 1);
    const pos = (s) => s && s.player ? [s.player.x, s.player.z] : (s && s.p ? [s.p.x, s.p.z] : null);
    F.stick = { id: stick.id || stick.action, centre: [cx, cy], move_vector: mv, from: pos(p0), to: pos(p1),
                displacement_m: pos(p0) && pos(p1) ? +Math.hypot(pos(p1)[0] - pos(p0)[0], pos(p1)[1] - pos(p0)[1]).toFixed(3) : null };
  }
  // a button: press the light-attack mark and watch combat state
  const btn = list.find((c) => /light/i.test(String(c.id || c.action || '')));
  if (btn) {
    const cx = btn.cx ?? btn.x, cy = btn.cy ?? btn.y;
    const c0 = await v('getCombatState');
    await H('touchDown', 2, cx, cy);
    await H('stepFrames', 4);
    const c1 = await v('getCombatState');
    await H('touchUp', 2);
    await H('stepFrames', 20);
    F.button = { id: btn.id || btn.action, before: c0 && (c0.player ? c0.player.state : c0.state),
                 after: c1 && (c1.player ? c1.player.state : c1.state) };
  }
  bank('F_consumption', F);
  say('DONE');
} catch (e) {
  say('PROBE ERROR', String(e && e.stack || e));
  results.error = String(e && e.stack || e).slice(0, 2000);
  writeFileSync(path.join(OUT, 'critic-probe.json'), JSON.stringify(results, null, 2));
} finally {
  await handle.close();
}
