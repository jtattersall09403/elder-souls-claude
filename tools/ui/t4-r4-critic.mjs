#!/usr/bin/env node
// t4-r4-critic.mjs — T4 round 4, the independent critic's own instrument.
//
// Owner: crit-t4-r4. Built none of the game code, and is not the round-1/2/3 critic.
//
// WHY A FIFTH PROBE RATHER THAN A SIXTH RE-RUN. Round 4 is judged against `ARBITRATION` ruling
// **S57**, written the same day, which permits a *fall* in element count only under two conditions
// that no existing instrument asks about:
//
//   (a) no element TYPE disappears — fewer rows is allowed, fewer KINDS of thing is not;
//   (b) every element is still reachable BY PAGING, demonstrated by operating the pager under
//       CRITIC-DOCTRINE §1.2b — real key events — and NOT by arithmetic.
//
// `t4-r2-critic-drive.mjs` turns one journal page (`D1`) and never enumerates the document;
// `t4-r2-critic-focus.mjs` transfers one container item and never scrolls either side to its end.
// So neither can tell a journal that pages to all 19 entries from one that silently drops 7.
//
// It also carries the leg that caught this round's regression, which is a PIXEL leg and had to be:
//
//   OVERLAP  RI-UIX09 P4's D2 counts every pixel that differs from the panel's modal colour. Ink
//            drawn ON TOP OF ink still counts. So a box shrunk until the attribute NAME, its VALUE
//            and its GAUGE occupy the same pixels raises D2 while destroying the screen. The
//            element census cannot see it (`row()` declares the RAW column text and ellipsises only
//            inside the draw callback — RI-UIX09's own "how we lose" #2), and no existing tool
//            looks at the pixels of a row. This one does: for each attribute row band it reports
//            the x-span of glyph ink and the x-span of the gauge fill, and their intersection.
//
// Usage:
//   node tools/ui/t4-r4-critic.mjs --out <dir> --shots <dir> [--legs pager,overlap]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';
import { decodePNG } from './t4-r2-critic-measure.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('t4-r4-critic.mjs [--out <dir>] [--shots <dir>] [--legs pager,overlap]');
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r4c/reports'));
const SHOTS = path.join(REPO_ROOT, String(args.shots || 'corpus/90-verdicts/wave1/artifacts/T4-r4c/screens'));
ensureDir(OUT); ensureDir(SHOTS);
const LEGS = String(args.legs || 'all').split(',').map((x) => x.trim()).filter(Boolean);
const leg = (n) => LEGS.includes('all') || LEGS.includes(n);

const checks = [];
const push = (id, pass, detail) => { checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };
const report = { schema: 'elder-souls/t4-r4-critic@1', at: new Date().toISOString(), checks: [], data: {} };

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

async function key(code, holdFrames = 2) {
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true })), code);
  await h.h('stepFrames', holdFrames);
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })), code);
  await h.h('stepFrames', 2);
}
async function read() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const els = (s.elements || []).filter((e) => e.visible);
    const kinds = {};
    for (const e of els) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    return {
      mode: s.mode, frame: window.__HARNESS.getFrame(),
      focus: s.focus ? JSON.parse(JSON.stringify(s.focus)) : null,
      count: els.length, kinds,
      els: els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect, text: e.text == null ? null : String(e.text), meta: e.meta || null })),
    };
  });
}
async function goto(target) {
  for (let i = 0; i < 3; i++) { const r = await read(); if (r.mode !== 'world') break; await key('KeyM'); }
  for (let i = 0; i < 14; i++) {
    const r = await read();
    if (r.mode === target) return target;
    if (r.mode === 'world') await key('KeyM'); else await key('Digit3');
  }
  return (await read()).mode;
}
async function shot(name) {
  const p = path.join(SHOTS, `${name}__1920x1080.png`);
  const buf = await h.page.screenshot({ type: 'png' });
  fs.writeFileSync(p, buf);
  return p;
}

// The boot sequence is `t4-r3-critic.mjs`'s, verbatim, and it is not decoration: without
// `setMode('play-instrumented')` the loop does not step, so `stepFrames` blocks and every real key
// press lands in a game that is not running. My first run of this file omitted it and hung.
await h.h('setMode', 'play-instrumented');
await h.h('setRenderRate', 0);
await h.h('setDevicePixelRatio', 1);
await h.h('loadState', 'ui-journal');
await h.h('setMode', 'play-instrumented');
await h.h('stepFrames', 4);
await h.h('closeMenu');
await h.h('stepFrames', 4);

// I0: the real input path is attached and a real key reaches it. RI-UIX10 trap I0.
const i0 = await h.page.evaluate(async () => {
  const eng = window.__ENGINE;
  const attached = !!(eng.real && eng.real.attached);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
  await new Promise((r) => setTimeout(r, 30));
  const mx = eng.sim && eng.sim.input ? eng.sim.input.moveX : null;
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
  return { attached, moveX: mx };
});
await h.h('stepFrames', 2);
push('I0 the shipped input layer is attached and a real key reaches the pipeline',
  !!i0.attached && i0.moveX !== 0 && i0.moveX !== null, JSON.stringify(i0));
if (!i0.attached) throw new Error('I0 failed — every result below would be void');

// ---------------------------------------------------------------------------------------------
// PAGER — S57 condition (b), and the type census for condition (a).
// ---------------------------------------------------------------------------------------------
if (leg('pager')) {
  // --- the journal ---------------------------------------------------------------------------
  const m = await goto('journal');
  push('JP0 the journal opens through real presses', m === 'journal', `mode=${m}`);

  // Every entry the DATA holds, read from the sim, so the union below has something to be a
  // union OF. This is the denominator and it is not a self-report of the screen.
  const total = await h.page.evaluate(() => {
    const j = window.__ENGINE.sim.quest.journal || [];
    return j.map((e) => `${e.quest}.${e.n}`);
  });
  report.data.journal_entries_in_data = total.length;

  // Walk to page 0, then press right until the page stops changing. Union the visible entries.
  for (let i = 0; i < 14; i++) { const r = await read(); if (r.focus && r.focus.page === 0) break; await key('KeyA', 1); }
  const seen = new Set();
  const pages = [];
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const r = await read();
    const ents = r.els.filter((e) => e.kind === 'journal_entry');
    for (const e of ents) seen.add(e.id.replace(/^journal\.entry\./, ''));
    const pc = r.els.find((e) => e.kind === 'page_count');
    pages.push({ page: r.focus.page, entries: ents.length, page_count_text: pc ? pc.text : null,
      entry_ids: ents.map((e) => e.id), entry_rects: ents.map((e) => e.rect) });
    if (r.focus.page === last) break;
    last = r.focus.page;
    await key('KeyD', 1);
  }
  report.data.journal_pages = pages;
  report.data.journal_entries_seen = seen.size;
  push('JP1 paging right reaches every journal entry the data holds',
    seen.size === total.length, `${seen.size} distinct entries seen over ${pages.length} page states; data holds ${total.length}`);
  push('JP2 the journal declares a page count while paging',
    pages.every((p) => p.page_count_text), `page_count texts: ${JSON.stringify(pages.map((p) => p.page_count_text).slice(0, 12))}`);

  // Entries per spread — S57's decrease, measured rather than asserted.
  push('JP3 entries visible per spread', true, `per page: ${JSON.stringify(pages.map((p) => p.entries))}`);

  // The index: every quest name reachable.
  const jr = await read();
  report.data.journal_kinds = jr.kinds;
  const idxRows = jr.els.filter((e) => e.kind === 'journal_index_row');
  const quests = await h.page.evaluate(() => {
    const j = window.__ENGINE.sim.quest.journal || [];
    return [...new Set(j.map((e) => e.quest))];
  });
  push('JP4 every quest in the data has an index row on screen',
    idxRows.length === quests.length, `${idxRows.length} index rows drawn, ${quests.length} quests in data: ${JSON.stringify(idxRows.map((e) => e.text))}`);

  // JP5 — J2's "never truncated": does any journal entry's declared block extend past the panel's
  // own inner box? A block drawn below the panel foot is drawn over the hint line and off the
  // panel, which is a truncation the census cannot see and the pixels can.
  const panel = jr.els.find((e) => e.kind === 'panel');
  const hint = jr.els.find((e) => e.kind === 'hint');
  const overflow = jr.els.filter((e) => e.kind === 'journal_entry')
    .map((e) => ({ id: e.id, rect: e.rect, bottom: e.rect[1] + e.rect[3],
      panel_bottom: panel.rect[1] + panel.rect[3],
      over_panel_px: Math.round(e.rect[1] + e.rect[3] - (panel.rect[1] + panel.rect[3])),
      over_hint_px: hint ? Math.round(e.rect[1] + e.rect[3] - hint.rect[1]) : null }));
  report.data.journal_entry_overflow = overflow;
  report.data.journal_panel_rect = panel.rect;
  report.data.journal_hint_rect = hint ? hint.rect : null;
  push('JP5 no journal entry block is drawn past the panel foot (J2 "rendered whole")',
    overflow.every((o) => o.over_panel_px <= 0),
    overflow.map((o) => `${o.id} bottom=${Math.round(o.bottom)} panel_bottom=${o.panel_bottom} over=${o.over_panel_px}px`).join(' | '));
  await shot('journal-page0');

  // --- the container -------------------------------------------------------------------------
  await h.h('closeMenu'); await h.h('stepFrames', 3);
  await h.page.evaluate(() => {
    window.__HARNESS.openContainer('Reed Creel', [
      { id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 },
    ]);
  });
  await h.h('stepFrames', 4);
  const c0 = await read();
  report.data.container_kinds = c0.kinds;
  push('CP0 the container screen is up', c0.mode === 'container', `mode=${c0.mode}`);

  const carried = await h.page.evaluate(() => (window.__ENGINE.sim.inventory || []).length);
  report.data.carried_in_data = carried;
  const rowsSeen = new Set();
  const walk = [];
  for (let i = 0; i < 120; i++) {
    const r = await read();
    for (const e of r.els.filter((x) => x.kind === 'list_row' && /container\.mine\./.test(x.id))) rowsSeen.add(e.id);
    walk.push({ rowIdx: r.focus.rowIdx, rows: r.els.filter((x) => x.kind === 'list_row' && /container\.mine\./.test(x.id)).length });
    if (r.focus.rowIdx >= carried - 1) break;
    await key('KeyS', 1);
  }
  report.data.container_walk_len = walk.length;
  push('CP1 the carried side scrolls to every one of its rows (S57 (b))',
    rowsSeen.size === carried, `${rowsSeen.size} distinct carried rows reached over ${walk.length} presses; data holds ${carried}`);
  const cEnd = await read();
  const ext = cEnd.els.find((e) => e.kind === 'scroll_extent');
  push('CP2 the extent marker reports the true total while scrolled',
    !!(ext && ext.meta && ext.meta.total === carried), `extent meta=${JSON.stringify(ext ? ext.meta : null)}`);
  await shot('container-scrolled');
}

// ---------------------------------------------------------------------------------------------
// OVERLAP — the pixel leg. Attribute rows on the level-up screen and the character sheet.
// ---------------------------------------------------------------------------------------------
if (leg('overlap')) {
  for (const mode of ['levelup', 'sheet']) {
    await h.page.evaluate(async (m) => {
      const HH = window.__HARNESS;
      await HH.closeMenu();
      if (m === 'levelup') HH.setAtHearth(true);
      await HH.openMenu(m, {});
      await HH.stepFrames(3);
    }, mode);
    await h.h('stepFrames', 3);
    const r = await read();
    const rows = r.els.filter((e) => e.kind === 'attribute_row');
    const p = await shot(`${mode}-attributes`);
    const png = decodePNG(fs.readFileSync(p));
    const at = (x, y) => { const i = ((y * png.width) + x) << 2; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
    const out = [];
    for (const row of rows) {
      const [rx, ry, rw, rh] = row.rect.map((v) => Math.round(v));
      let inkMin = Infinity, inkMax = -Infinity, gMin = Infinity, gMax = -Infinity, inkInGauge = 0, inkN = 0;
      for (let y = ry; y < ry + rh && y < png.height; y++) {
        for (let x = rx; x < rx + rw && x < png.width; x++) {
          const [R, G, B] = at(x, y);
          const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
          // glyph ink: near-black, low chroma
          const isInk = lum < 70 && Math.max(R, G, B) - Math.min(R, G, B) < 40;
          // the filled part of the gauge: the dark green plate
          const isGauge = G > R + 12 && G > B + 12 && lum >= 40 && lum < 110;
          if (isInk) { inkN++; if (x < inkMin) inkMin = x; if (x > inkMax) inkMax = x; }
          if (isGauge) { if (x < gMin) gMin = x; if (x > gMax) gMax = x; }
        }
      }
      for (let y = ry; y < ry + rh && y < png.height; y++) {
        for (let x = Math.max(rx, gMin); x <= Math.min(rx + rw - 1, gMax) && x < png.width; x++) {
          const [R, G, B] = at(x, y);
          const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
          if (lum < 70 && Math.max(R, G, B) - Math.min(R, G, B) < 40) inkInGauge++;
        }
      }
      out.push({
        id: row.id, rect: [rx, ry, rw, rh], text: row.text,
        ink_x: inkN ? [inkMin, inkMax] : null, gauge_x: Number.isFinite(gMin) ? [gMin, gMax] : null,
        ink_px: inkN, ink_px_inside_gauge_span: inkInGauge,
        ink_fraction_inside_gauge: inkN ? +(inkInGauge / inkN).toFixed(3) : null,
      });
    }
    report.data[`${mode}_attribute_rows`] = out;
    const bad = out.filter((o) => o.ink_px_inside_gauge_span > 0);
    push(`OV-${mode} no attribute-row glyph ink falls inside the gauge's own x-span`,
      bad.length === 0,
      `${bad.length} of ${out.length} rows overlap; worst ${bad.length ? Math.max(...bad.map((b) => b.ink_fraction_inside_gauge)) : 0} of the row's ink inside the gauge span`);
  }
}

report.checks = checks;
report.passed = checks.filter((c) => c.pass).length;
report.total = checks.length;
writeJson(path.join(OUT, 't4-r4-critic.json'), report);
log(`\n${report.passed}/${report.total} checks passed  ->  ${path.join(OUT, 't4-r4-critic.json')}`);
if (report.passed !== report.total) exit = 1;
await h.close();
process.exit(exit);
