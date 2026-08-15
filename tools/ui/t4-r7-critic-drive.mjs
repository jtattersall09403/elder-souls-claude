#!/usr/bin/env node
// t4-r7-critic-drive.mjs — THE ROUND-7 CONTAINER, OPERATED BY THE CRITIC, ON THE INSTRUMENT THAT
// IS KNOWN TO WORK.
//
// Owner: crit-t4-r7 (independent critic). Binding: CRITIC-DOCTRINE §1.2b, ARBITRATION S57/S61/S65.
//
// WHY THIS FILE EXISTS RATHER THAN A RE-RUN OF THE BUILDER'S. The round-7 builder's own
// `t4-r7-container-drive.mjs` reports `K0` FAIL — no real key moves the container selection in its
// instrument — so its R3b/R3c are unmeasured, and it says so. Two differences from
// `t4-r2-critic-drive.mjs`, whose H0-H3 drove this screen green in round 6, are visible in the
// source and are reproduced here:
//   1. the r2 tool calls `loadState(<state>)` and then `setMode('play-instrumented')` AGAIN
//      afterwards; the r7 tool sets the mode once, BEFORE any state load, and never loads a state;
//   2. the r2 tool asserts `eng.real.attached` and a moved `input.moveX` before believing any key.
// Both are done below, and the attachment assertion is the FIRST check.
//
// WHAT IT ADDS BEYOND RE-DRIVING (each one is a way the round's own claims could be false):
//   G1  attachment + a key that demonstrably moves the game (the instrument falsified first).
//   G2  R3b — left/right switches side, read off `focus.side`.
//   G3  R3c — transfer in BOTH directions through real `interact` presses, watched in `sim`.
//   G4  R1 on the SHIPPED `ui-journal` fixture (7 rows, both sides) — the fixture the round-6
//       remedy's clause 1 actually names. The builder drove 4 rows on a default state.
//   G5  R1-numeric, HOSTILE: a probe whose WEIGHT and GOLD are far too wide for any column this
//       screen owns. The builder's R1b probes the NAME column; the claim under test is about
//       NUMBERS, and a positive control on one column is not a positive control on another.
//   G6  R2 across EVERY record, not one: the widest fact block in `carried.json`, measured against
//       the band rect that clips it.
//   G7  S57(b) REACHABILITY: a 45-row container walked with real presses, counting how many
//       distinct records the player can actually reach after the box was made smaller.
//   G8  S65(1) C7: with an item whose description does not fit selected, EVERY bound desktop
//       control is pressed and the screen is re-read. C7 is now scoped to "reachable in one
//       input"; if no input reaches the rest of the text, C7 still fails.
//
// EXIT 0 = every check passed · 1 = a check failed · 2 = could not run.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';

const USAGE = `
t4-r7-critic-drive.mjs — operate the round-7 container through the shipped input path.

  --state <id>  world state (default ui-journal — the fixture the r6 remedy names)
  --out <dir>   report directory (default corpus/90-verdicts/wave1/artifacts/T4-r7c/drive)
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.isAbsolute(String(args.out || ''))
  ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r7c/drive'));
ensureDir(OUT);
ensureDir(path.join(OUT, 'shots'));
const STATE = String(args.state || 'ui-journal');

const report = {
  schema: 'elder-souls/t4-r7-critic-drive@1',
  at: new Date().toISOString(),
  state: STATE,
  commit: null,
  checks: [],
  data: {},
};
const flush = () => fs.writeFileSync(path.join(OUT, 't4-r7-critic-drive.json'), JSON.stringify(report, null, 2));
const push = (id, pass, detail, extra) => {
  report.checks.push({ id, pass, detail, ...(extra || {}) });
  log(`  ${pass === null ? 'n/a ' : pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`);
  flush();
};

report.commit = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
flush();

const CARRIED = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/items/carried.json'), 'utf8'));
const RECORDS = Array.isArray(CARRIED) ? CARRIED : (CARRIED.items || Object.values(CARRIED)[0]);

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, state: STATE });
let exit = 0;

async function key(code, holdFrames = 2) {
  await h.page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true }));
  }, code);
  await h.h('stepFrames', holdFrames);
  await h.page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true }));
  }, code);
  await h.h('stepFrames', 2);
}

const snap = () => h.page.evaluate(() => {
  const st = window.__HARNESS.getUIState();
  const els = (st.elements || []).filter((e) => e.visible);
  const band = els.find((e) => e.id === 'container.band') || null;
  const panel = els.filter((e) => e.kind === 'panel').sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3])[0] || null;
  return {
    mode: st.mode,
    focus: st.focus ? { ...st.focus } : null,
    carried: window.__ENGINE && window.__ENGINE.sim && Array.isArray(window.__ENGINE.sim.inventory)
      ? window.__ENGINE.sim.inventory.map((i) => String(i.id || i)) : null,
    panel_rect: panel ? panel.rect : null,
    n_elements: els.length,
    kinds: els.reduce((a, e) => { a[e.kind] = (a[e.kind] || 0) + 1; return a; }, {}),
    ids: els.map((e) => e.id),
    all_text: els.filter((e) => e.text !== null && e.text !== undefined).map((e) => String(e.text)),
    rows: els.filter((e) => e.kind === 'list_row' && e.meta && e.meta.item_id).map((e) => ({
      id: e.id, text: e.text, rect: e.rect, focused: !!e.focused, item_id: e.meta.item_id,
      columns_drawn: e.meta.columns_drawn || null,
    })),
    band: band ? { rect: band.rect, text: band.text, meta: band.meta } : null,
    headers: els.filter((e) => e.kind === 'panel_header').map((e) => e.text),
  };
});

const openContainer = (name, contents) => h.page.evaluate(([n, c]) => {
  window.__HARNESS.openContainer(n, c);
}, [name, contents]);

const shoot = async (name) => {
  try {
    const b64 = await h.h('screenshot');
    fs.writeFileSync(path.join(OUT, 'shots', `${name}.png`), Buffer.from(String(b64).split(',')[1], 'base64'));
  } catch (e) { report.data[`shot_${name}_failed`] = String(e && e.message || e); }
};

const sel = (s) => (s.band && s.band.meta ? s.band.meta.item_id : null);

try {
  // ---- G1: the instrument, falsified before anything is believed ------------------------------
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');   // loadState can put the engine back
  await h.h('stepFrames', 4);

  const wired = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const attached = !!(eng.real && eng.real.attached);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true, cancelable: true }));
    const moveX = eng.input.moveX;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    return { attached, moveX };
  });
  report.data.wired = wired;
  push('G1 real DOM keys reach the engine (listeners attached AND a key moves input)',
    wired.attached === true && Math.abs(wired.moveX) > 0,
    `real.attached=${wired.attached}, ArrowRight -> input.moveX=${wired.moveX}`);
  if (!(wired.attached && Math.abs(wired.moveX) > 0)) throw new Error('input path dead — everything below would be the instrument');

  // ---- open the container on the SHIPPED fixture ----------------------------------------------
  await h.page.evaluate(() => { try { window.__HARNESS.conversationClose(); } catch { /* none */ } });
  await openContainer('Reed Creel', [
    { id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 },
  ]);
  await h.h('stepFrames', 3);
  const s0 = await snap();
  report.data.open = { mode: s0.mode, headers: s0.headers, panel_rect: s0.panel_rect, rows: s0.rows.length, kinds: s0.kinds };
  push('G0 the container opens on the ui-journal fixture and names itself',
    s0.mode === 'container' && !s0.headers.some((t) => /^(undefined|null)$/i.test(String(t))),
    `mode ${s0.mode}, headers ${JSON.stringify(s0.headers)}, ${s0.rows.length} rows, panel ${JSON.stringify(s0.panel_rect)}`);
  await shoot('01-open-ui-journal');

  // ---- G4: R1 on all rows of the shipped fixture ----------------------------------------------
  const numTrunc = [], nameTrunc = [], missing = [];
  for (const r of s0.rows) {
    if (!Array.isArray(r.columns_drawn)) { missing.push(r.id); continue; }
    r.columns_drawn.forEach((col, i) => {
      if (!col.truncated) return;
      (i === 0 ? nameTrunc : numTrunc).push({ id: r.id, column: i, declared: col.declared, drawn: col.text });
    });
  }
  report.data.g4 = { rows: s0.rows.map((r) => ({ id: r.id, columns_drawn: r.columns_drawn })), numTrunc, nameTrunc, missing };
  push('G4 R1 on the SHIPPED fixture: no numeric column ellipsised on any of the rows both sides',
    missing.length === 0 && numTrunc.length === 0,
    missing.length ? `REFUSED: ${missing.length} rows publish no meta.columns_drawn`
      : `${s0.rows.length} rows, ${numTrunc.length} truncated numbers, ${nameTrunc.length} truncated names `
        + JSON.stringify(nameTrunc.map((n) => `${n.declared} -> ${n.drawn}`)));
  push('G4b the r6 remedy clause 2 — at most 1 item name ellipsised across both sides',
    nameTrunc.length <= 1, `${nameTrunc.length} names ellipsised on the shipped fixture`);

  // ---- G5: the HOSTILE NUMERIC probe ----------------------------------------------------------
  //
  // R1b proves the reader can report a truncated NAME. It does not prove it can report a truncated
  // NUMBER, and "no numeric column can truncate" is a claim about numbers. So: a record whose
  // weight and gold are wider than any real record's, put in a real container and laid out by the
  // shipped drawContainer().
  const probe = await h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const items = eng.ui && eng.ui.data && eng.ui.data.items ? eng.ui.data.items : null;
    if (!items || typeof items.set !== 'function') return { ok: false, why: 'no eng.ui.data.items Map' };
    items.set('t4-r7c-numprobe', {
      name: 'Numprobe', category: 'misc',
      weight: 987654.5, value_gold: 987654321, condition: 0.5,
      description: 'A critic probe: its weight and its price are both far too wide for the columns this screen owns.',
    });
    A.openContainer('Reed Creel', [{ id: 't4-r7c-numprobe', count: 1 }, { id: 'bog-iron-maul', count: 1 }]);
    return { ok: true };
  });
  await h.h('stepFrames', 3);
  const sp = await snap();
  await shoot('02-numeric-probe');
  const probeRow = sp.rows.find((r) => r.item_id === 't4-r7c-numprobe') || null;
  report.data.g5 = { probe, probeRow, rows: sp.rows.map((r) => ({ id: r.id, columns_drawn: r.columns_drawn })) };
  if (!probeRow || !Array.isArray(probeRow.columns_drawn)) {
    push('G5 a HOSTILE numeric probe (weight 987654.5, gold 987654321) does not truncate a number',
      false, `REFUSED: the probe row did not lay out (${probe.why || 'no row'})`);
  } else {
    const cols = probeRow.columns_drawn;
    const numsTrunc = cols.slice(1).filter((c) => c.truncated);
    push('G5 a HOSTILE numeric probe (weight 987654.5, gold 987654321) does not truncate a number',
      numsTrunc.length === 0,
      `columns drawn ${JSON.stringify(cols.map((c) => `${c.declared}->${c.text}${c.truncated ? ' TRUNCATED' : ''}`))}; `
      + `name column width ${cols[0].w.toFixed(2)}`);
    push('G5b the probe still leaves the NAME column able to draw something',
      cols[0].text.length > 1, `name column drew ${JSON.stringify(cols[0].text)} at width ${cols[0].w.toFixed(2)}`);
  }
  // remove the probe again
  await h.page.evaluate(() => {
    const items = window.__ENGINE.ui.data.items;
    if (items && typeof items.delete === 'function') items.delete('t4-r7c-numprobe');
  }).catch(() => {});

  // ---- G6: R2 across EVERY record --------------------------------------------------------------
  const factScan = await h.page.evaluate((ids) => {
    const A = window.__HARNESS;
    const out = [];
    for (const id of ids) {
      A.openContainer('Reed Creel', [{ id, count: 1 }]);
      A.stepFrames(2);
      const st = A.getUIState();
      const els = (st.elements || []).filter((e) => e.visible);
      const band = els.find((e) => e.id === 'container.band');
      const rows = els.filter((e) => e.kind === 'list_row' && e.meta && e.meta.item_id);
      out.push({
        id,
        band_w: band ? band.rect[2] : null,
        meta: band && band.meta ? {
          item_id: band.meta.item_id, facts: band.meta.facts, facts_right: band.meta.facts_right,
          facts_fit: band.meta.facts_fit, shown: band.meta.description_lines_shown,
          needed: band.meta.description_lines_needed, truncated: band.meta.description_truncated,
        } : null,
        row_cols: rows.filter((r) => r.meta.item_id === id).map((r) => r.meta.columns_drawn),
      });
    }
    return out;
  }, RECORDS.map((r) => r.id));
  report.data.g6 = factScan;
  const overflow = factScan.filter((f) => f.meta && typeof f.meta.facts_right === 'number' && f.meta.facts_right > f.band_w);
  const noLayout = factScan.filter((f) => !f.meta || typeof f.meta.facts_right !== 'number');
  const maxRight = Math.max(...factScan.filter((f) => f.meta && typeof f.meta.facts_right === 'number').map((f) => f.meta.facts_right));
  push('G6 R2 across ALL 45 records: every fact block is laid out inside the band rect that clips it',
    noLayout.length === 0 && overflow.length === 0,
    `${factScan.length} records; ${noLayout.length} publish no layout; ${overflow.length} overflow; `
    + `widest right edge ${Number.isFinite(maxRight) ? maxRight.toFixed(2) : 'n/a'} vs band width ${factScan[0] && factScan[0].band_w}`);
  // numeric truncation over every record, selected one at a time
  const numTruncAll = [];
  for (const f of factScan) {
    for (const cols of f.row_cols || []) {
      if (!Array.isArray(cols)) continue;
      cols.slice(1).forEach((c, i) => { if (c.truncated) numTruncAll.push({ id: f.id, column: i + 1, declared: c.declared, drawn: c.text }); });
    }
  }
  push('G6b no numeric column truncates on ANY of the 45 records, one at a time',
    numTruncAll.length === 0, `${numTruncAll.length} truncated numeric columns ${JSON.stringify(numTruncAll.slice(0, 5))}`);
  // the C7 population, driven rather than computed offline
  const withMeta = factScan.filter((f) => f.meta && typeof f.meta.needed === 'number');
  const complete = withMeta.filter((f) => f.meta.shown >= f.meta.needed);
  report.data.c7_population = {
    n: withMeta.length, complete: complete.length,
    histogram: withMeta.reduce((a, f) => { a[f.meta.needed] = (a[f.meta.needed] || 0) + 1; return a; }, {}),
  };
  push('G6c RI-UIX03 C7: the resting band shows every line of the description for all 45 records',
    complete.length === withMeta.length,
    `${complete.length} of ${withMeta.length} records complete at rest; needed-histogram `
    + JSON.stringify(report.data.c7_population.histogram));

  // ---- G7: S57(b) reachability on a 45-row container ------------------------------------------
  await openContainer('Reed Creel', RECORDS.map((r) => ({ id: r.id, count: 1 })));
  await h.h('stepFrames', 3);
  const sBig = await snap();
  await shoot('03-45-row-container');
  const seen = new Set();
  const start = sel(sBig);
  if (start) seen.add(start);
  const walk = [start];
  for (let i = 0; i < 70; i++) {
    await key('ArrowDown', 2);
    const s = await snap();
    const id = sel(s);
    walk.push(id);
    if (id) seen.add(id);
  }
  report.data.g7 = {
    rows_visible: sBig.rows.length, distinct_reached: seen.size, presses: 70,
    walk: walk.slice(0, 20), reached: [...seen],
  };
  push('G7 S57(b): every record in a 45-row container is reachable with real presses',
    seen.size >= RECORDS.length,
    `${sBig.rows.length} rows drawn; ${seen.size} distinct records selected in 70 real ArrowDown presses`);

  // ---- G2/G3: R3b and R3c, the checks the builder could not measure ---------------------------
  await openContainer('Reed Creel', [
    { id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 },
  ]);
  await h.h('stepFrames', 3);
  const b1 = await snap();
  await key('KeyD');
  const b2 = await snap();
  await key('KeyA');
  const b3 = await snap();
  report.data.g2 = {
    before: b1.focus, after_right: b2.focus, after_left: b3.focus,
  };
  const side = (s) => (s.focus ? (s.focus.side !== undefined ? s.focus.side : JSON.stringify(s.focus)) : null);
  push('G2 R3b: left/right switches which side of the container has focus',
    side(b1) !== side(b2) && side(b3) === side(b1),
    `focus.side ${JSON.stringify(side(b1))} -(KeyD)-> ${JSON.stringify(side(b2))} -(KeyA)-> ${JSON.stringify(side(b3))}`);

  const w0 = (await snap()).carried;
  // make sure focus is on the container's side, then take
  await key('KeyD');
  await key('KeyE');
  const w1 = (await snap()).carried;
  await key('KeyA');
  await key('KeyE');
  const w2 = (await snap()).carried;
  report.data.g3 = { before: w0 && w0.length, after_take: w1 && w1.length, after_put: w2 && w2.length, lists: { w0, w1, w2 } };
  push('G3 R3c: items transfer in BOTH directions through real presses',
    Array.isArray(w0) && Array.isArray(w1) && Array.isArray(w2) && w1.length === w0.length + 1 && w2.length === w0.length,
    `carried ${w0 && w0.length} -(KeyD,KeyE take)-> ${w1 && w1.length} -(KeyA,KeyE put)-> ${w2 && w2.length}`);

  // ---- G8: S65(1) — is the full description reachable in ONE input? ---------------------------
  //
  // S65 scopes C7 to a surface the player can reach, with guard (b): "no ellipsis without a route".
  // So: select a record the resting band cannot hold, then press EVERY bound desktop control and
  // re-read the screen. A route exists only if some single input increases the lines shown or puts
  // the rest of the string on screen.
  const truncatedRecord = withMeta.find((f) => f.meta.needed > f.meta.shown);
  if (!truncatedRecord) {
    push('G8 S65(1): a truncated description has a reachable expansion, in one input', null,
      'not applicable — no record was found whose description does not fit');
  } else {
    await openContainer('Reed Creel', [{ id: truncatedRecord.id, count: 1 }]);
    await h.h('stepFrames', 3);
    const base = await snap();
    const baseShown = base.band && base.band.meta ? base.band.meta.description_lines_shown : null;
    const baseIds = new Set(base.ids);
    const CODES = ['KeyE', 'Enter', 'KeyF', 'KeyV', 'KeyR', 'Space', 'KeyX', 'Digit1', 'Digit2', 'Tab',
      'KeyG', 'Digit3', 'Digit4', 'KeyC', 'KeyZ', 'KeyT', 'ShiftLeft', 'KeyW', 'KeyS', 'KeyQ', 'KeyH', 'KeyI'];
    const tried = [];
    let route = null;
    for (const code of CODES) {
      await openContainer('Reed Creel', [{ id: truncatedRecord.id, count: 1 }]);
      await h.h('stepFrames', 2);
      const pre = await snap();
      await key(code, 3);
      const post = await snap();
      const shown = post.band && post.band.meta ? post.band.meta.description_lines_meta : null;
      const postShown = post.band && post.band.meta ? post.band.meta.description_lines_shown : null;
      const newIds = post.ids.filter((id) => !baseIds.has(id));
      const grew = typeof postShown === 'number' && typeof baseShown === 'number' && postShown > baseShown;
      // does the FULL text appear anywhere on screen after this press?
      const rec = RECORDS.find((r) => r.id === truncatedRecord.id);
      const tail = rec ? String(rec.description).slice(-40) : null;
      const fullOnScreen = !!(tail && post.all_text.some((t) => String(t).includes(tail)));
      tried.push({ code, mode_before: pre.mode, mode_after: post.mode, shown_before: baseShown, shown_after: postShown, new_element_ids: newIds.slice(0, 6), full_text_on_screen: fullOnScreen });
      if ((grew || fullOnScreen) && post.mode === 'container') { route = { code, postShown, fullOnScreen }; break; }
    }
    report.data.g8 = { record: truncatedRecord.id, needed: truncatedRecord.meta.needed, shown: truncatedRecord.meta.shown, tried, route };
    push('G8 S65(1) guard (b): the truncated description has a route — one input reaches the rest of it',
      route !== null,
      route ? `${route.code} expands it (lines -> ${route.postShown}, full text on screen ${route.fullOnScreen})`
        : `${tried.length} bound controls pressed on '${truncatedRecord.id}' (needs ${truncatedRecord.meta.needed} lines, shows ${truncatedRecord.meta.shown}); `
          + 'none increased the lines shown and none put the remainder of the string on screen');
  }

  await shoot('04-final');
} catch (e) {
  report.data.threw = String((e && e.stack) || e);
  log(`  THREW ${String(e && e.message || e)}`);
  exit = Math.max(exit, 1);
}

report.summary = {
  passed: report.checks.filter((c) => c.pass === true).length,
  failed: report.checks.filter((c) => c.pass === false).length,
  na: report.checks.filter((c) => c.pass === null).length,
};
flush();
if (report.checks.length === 0) { log('EMPTY RUN — refusing to report a pass'); process.exit(2); }
if (report.checks.some((c) => c.pass === false)) exit = Math.max(exit, 1);
log(`written: ${path.join(OUT, 't4-r7-critic-drive.json')}`);
try { await Promise.race([h.close(), new Promise((r) => setTimeout(r, 20000))]); } catch { /* reaped */ }
process.exit(exit);
