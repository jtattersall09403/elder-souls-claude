#!/usr/bin/env node
// t4-r7-critic-band.mjs — the detail band, PER RECORD, with the record actually SELECTED.
//
// Owner: crit-t4-r7. WHY IT EXISTS, and it is a correction of my own first instrument: my
// `t4-r7-critic-drive.mjs` G6 opened a container holding one record and read `container.band` —
// but the band shows the item selected on the FOCUSED side, and focus starts on the player's
// carried list. All 45 reads returned `hist-bark-token`. That is the same "an arm that cannot
// disagree" defect this round is about, in my own hand, and the fix is to press `right` (real
// KeyboardEvent through the shipped handler) so the container's own record is the selection, and
// to ASSERT `band.meta.item_id === the record I opened` before believing any number it carries.
//
// Checks:
//   B0  the selection assertion itself — how many of the 45 reads are of the record they name.
//   B1  RI-UIX03 C7 at rest, per record: description_lines_shown vs description_lines_needed.
//   B2  R2 per record: the fact block's right edge against the band rect that clips it.
//   B3  the row's own drawn columns for that record while it is selected.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || ''))
  ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r7c/drive'));
ensureDir(OUT);
const STATE = String(args.state || 'ui-journal');

const CARRIED = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/items/carried.json'), 'utf8'));
const RECORDS = Array.isArray(CARRIED) ? CARRIED : (CARRIED.items || Object.values(CARRIED)[0]);

const report = {
  schema: 'elder-souls/t4-r7-critic-band@1', at: new Date().toISOString(), state: STATE,
  commit: (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(),
  checks: [], data: {},
};
const flush = () => fs.writeFileSync(path.join(OUT, 't4-r7-critic-band.json'), JSON.stringify(report, null, 2));
const push = (id, pass, detail, extra) => {
  report.checks.push({ id, pass, detail, ...(extra || {}) });
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); flush();
};

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, state: STATE });
let exit = 0;
try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);

  const scan = await h.page.evaluate(async (ids) => {
    const A = window.__HARNESS;
    const press = async (code) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
      await A.stepFrames(2);
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
      await A.stepFrames(2);
    };
    const readBand = () => {
      const st = A.getUIState();
      const els = (st.elements || []).filter((e) => e.visible);
      const band = els.find((e) => e.id === 'container.band');
      const rows = els.filter((e) => e.kind === 'list_row' && e.meta && e.meta.item_id);
      return {
        side: st.focus ? st.focus.side : null,
        band_rect: band ? band.rect : null,
        meta: band && band.meta ? JSON.parse(JSON.stringify(band.meta)) : null,
        rows: rows.map((r) => ({ id: r.id, item_id: r.meta.item_id, focused: !!r.focused, columns_drawn: r.meta.columns_drawn })),
      };
    };
    const out = [];
    for (const id of ids) {
      A.openContainer('Reed Creel', [{ id, count: 1 }]);
      await A.stepFrames(3);
      await press('KeyD');                 // focus the container's own side
      const r = readBand();
      out.push({ opened: id, ...r });
      await press('KeyA');                 // back to the carried side for a clean next open
    }
    return out;
  }, RECORDS.map((r) => r.id));

  report.data.scan = scan;
  const named = scan.filter((s) => s.meta && s.meta.item_id === s.opened);
  push('B0 the band read is of the record it names (selection assertion, not assumption)',
    named.length === scan.length,
    `${named.length} of ${scan.length} reads select the record opened; distinct band items `
    + JSON.stringify([...new Set(scan.map((s) => s.meta && s.meta.item_id))].slice(0, 8)));

  const usable = named.filter((s) => s.meta && typeof s.meta.description_lines_needed === 'number');
  const complete = usable.filter((s) => s.meta.description_lines_shown >= s.meta.description_lines_needed);
  const hist = usable.reduce((a, s) => { a[s.meta.description_lines_needed] = (a[s.meta.description_lines_needed] || 0) + 1; return a; }, {});
  report.data.c7 = {
    n: usable.length, complete: complete.length, histogram: hist,
    incomplete: usable.filter((s) => s.meta.description_lines_shown < s.meta.description_lines_needed)
      .map((s) => ({ id: s.opened, shown: s.meta.description_lines_shown, needed: s.meta.description_lines_needed })),
  };
  push('B1 RI-UIX03 C7 at rest: the band shows every line of the description, per record',
    usable.length > 0 && complete.length === usable.length,
    `${complete.length} of ${usable.length} records complete at rest; needed-line histogram ${JSON.stringify(hist)}`);

  const withFacts = named.filter((s) => s.meta && typeof s.meta.facts_right === 'number' && s.band_rect);
  const over = withFacts.filter((s) => s.meta.facts_right > s.band_rect[2] || s.meta.facts_fit !== true);
  const widest = withFacts.reduce((a, s) => (s.meta.facts_right > a ? s.meta.facts_right : a), 0);
  report.data.r2 = {
    n: withFacts.length, overflowing: over.map((s) => ({ id: s.opened, right: s.meta.facts_right, band_w: s.band_rect[2] })),
    widest_right: widest, band_w: withFacts[0] ? withFacts[0].band_rect[2] : null,
    fact_counts: withFacts.reduce((a, s) => { const n = (s.meta.facts || []).length; a[n] = (a[n] || 0) + 1; return a; }, {}),
  };
  push('B2 R2 per record: every fact block — condition included — lies inside the band rect that clips it',
    withFacts.length === named.length && over.length === 0,
    `${withFacts.length} records publish a layout, ${over.length} overflow; widest right edge ${widest} vs band width `
    + `${withFacts[0] ? withFacts[0].band_rect[2] : '?'}; fact-count histogram ${JSON.stringify(report.data.r2.fact_counts)}`);

  const numTrunc = [];
  for (const s of named) {
    for (const r of s.rows || []) {
      if (r.item_id !== s.opened || !Array.isArray(r.columns_drawn)) continue;
      r.columns_drawn.slice(1).forEach((c, i) => { if (c.truncated) numTrunc.push({ id: s.opened, column: i + 1, declared: c.declared, drawn: c.text }); });
    }
  }
  push('B3 no numeric column truncates on any of the 45 records while it is the selected row',
    numTrunc.length === 0, `${numTrunc.length} truncated numeric columns ${JSON.stringify(numTrunc.slice(0, 5))}`);
} catch (e) {
  report.data.threw = String((e && e.stack) || e);
  log(`  THREW ${String((e && e.message) || e)}`); exit = 1;
}
report.summary = { passed: report.checks.filter((c) => c.pass).length, failed: report.checks.filter((c) => c.pass === false).length };
flush();
if (report.checks.length === 0) process.exit(2);
if (report.checks.some((c) => c.pass === false)) exit = 1;
log(`written: ${path.join(OUT, 't4-r7-critic-band.json')}`);
try { await Promise.race([h.close(), new Promise((r) => setTimeout(r, 20000))]); } catch { /* reaped */ }
process.exit(exit);
