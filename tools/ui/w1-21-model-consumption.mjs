#!/usr/bin/env node
// Exhaustive RI-MTH07 coupling gate for every player-facing UISystem model/drawer in W1-21.
// Each model is perturbed through its production model method, observed through UISurface.el(),
// then equalised at the consumer boundary. The equalised arm must return to the baseline.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
const outDir = path.join(RUNS_DIR, String(args.out || 'W1-21-MODEL-CONSUMPTION'));
ensureDir(outDir);
const handle = await launchGame({ width: 1280, height: 720, timeout: 240000 });

const report = await handle.page.evaluate(async () => {
  const H = window.__HARNESS;
  await H.ready();
  H.setRenderRate(0);
  await H.loadState('ui-journal');
  const E = window.__ENGINE;
  const U = E.ui;
  const stable = (v) => JSON.stringify(v, (k, x) => typeof x === 'function' ? '[function]' : x);
  const visible = () => U.S.elements.filter((e) => e.visible).map((e) => ({
    id: e.id, kind: e.kind, text: e.text || null, rect: e.rect.map((n) => +n.toFixed(2)), action: e.action || null,
  }));
  const fingerprint = () => stable(visible());
  const rows = [];
  const modes = new Set(H.listMenus());
  const open = (mode) => {
    if (mode === 'world') H.closeMenu();
    else if (mode === 'book') {
      const id = U.data.books.keys().next().value;
      U.bookId = id;
      U.mode = 'book';
    } else U.mode = mode;
  };
  const cases = [
    ['_hudModel', 'world', (m) => ({ ...m, estus: m.estus === 47 ? 46 : 47 })],
    ['_inventoryModel', 'inventory', (m) => ({ ...m, load: 98765.4 })],
    ['_containerModel', 'container', (m) => ({ ...m, containerName: 'CONSUMPTION CONTAINER' })],
    ['_journalModel', 'journal', (m) => ({ ...m, entries: m.entries.map((e, i) => i ? e : ({ ...e, text: 'CONSUMPTION JOURNAL' })) })],
    ['_bookModel', 'book', (m) => ({ ...m, book: { ...m.book, title: 'CONSUMPTION BOOK' } })],
    ['_levelModel', 'levelup', (m) => ({ ...m, souls: 987654321 })],
    ['_sheetModel', 'sheet', (m) => ({ ...m, name: 'CONSUMPTION SHEET' })],
    ['_spellModel', 'spells', (m) => ({ ...m, spells: m.spells.map((s, i) => i ? s : ({ ...s, name: 'CONSUMPTION SPELLS' })) })],
    ['_mapModel', 'map', (m) => ({ ...m, player: { ...m.player, x: m.player.x + 1000, z: m.player.z + 1000 } })],
  ];
  for (const [method, mode, perturb] of cases) {
    const row = { model: method, mode, consumer: `UISystem.build -> ${mode} production drawer`, consequence: 'registered visible pixels/text change' };
    if (!modes.has(mode) && !['world', 'book', 'container'].includes(mode)) {
      rows.push({ ...row, pass: false, reason: 'mode absent from listMenus()' });
      continue;
    }
    open(mode);
    U.build(E._uiCtx(), true);
    const baseline = fingerprint();
    const original = U[method];
    const baselineModel = original.call(U, E._uiCtx());
    U[method] = function (ctx) { return perturb(original.call(this, ctx)); };
    U.build(E._uiCtx(), true);
    const changed = fingerprint();
    U[method] = function () { return baselineModel; };
    U.build(E._uiCtx(), true);
    const equalised = fingerprint();
    U[method] = original;
    U.build(E._uiCtx(), true);
    const restored = fingerprint();
    rows.push({ ...row, baseline_elements: JSON.parse(baseline).length,
      changed: changed !== baseline, equalised_red: equalised === baseline,
      restored: restored === baseline, pass: changed !== baseline && equalised === baseline && restored === baseline });
  }

  // The three non-screen player-facing models use their own production drawers/state consumer.
  H.closeMenu();
  const base = E._uiCtx();
  U.build(base, true);
  const baseFp = fingerprint();
  const touch = { shown: true, viewport: { w: 1280, h: 720 }, controls: [
    { action: 'interact', x: 1100, y: 560, r: 34, down: false },
  ], stick: { active: false } };
  U.build({ ...base, touch }, true);
  const touchFp = fingerprint();
  U.build({ ...base, touch: null }, true);
  rows.push({ model: 'touch-overlay model', mode: 'world', consumer: 'drawTouchOverlay', consequence: 'actionable interact control',
    changed: touchFp !== baseFp, equalised_red: fingerprint() === baseFp, pass: touchFp !== baseFp && fingerprint() === baseFp });

  const rotate = { line: 'Turn the marsh upright.' };
  U.build({ ...base, rotate }, true);
  const rotateFp = fingerprint();
  U.build({ ...base, rotate: null }, true);
  rows.push({ model: 'rotate/calibration model', mode: 'world', consumer: 'drawRotateState', consequence: 'orientation refusal text',
    changed: rotateFp !== baseFp, equalised_red: fingerprint() === baseFp, pass: rotateFp !== baseFp && fingerprint() === baseFp });

  let refusal = null;
  try { H.openMenu('minimap'); } catch (e) { refusal = String(e.message || e); }
  const refusalState = H.getUIState();
  rows.push({ model: 'rebinding/refusal view', mode: 'world', consumer: 'UISystem.open/navigable/state', consequence: 'forbidden minimap action is refused',
    changed: !!refusal || !!refusalState.refused, equalised_red: !H.listMenus().includes('minimap'),
    pass: (!!refusal || !!refusalState.refused) && !H.listMenus().includes('minimap') });

  return { schema: 'elder-souls/w1-21-model-consumption@1', viewport: [1280, 720], dpr: 1,
    models_expected: 12, models_sampled: rows.length, rows, pass: rows.length === 12 && rows.every((r) => r.pass),
    page_errors: [], build: H.getBuildInfo ? H.getBuildInfo() : null };
});
report.page_errors = handle.errors;
await handle.close();
report.sha256 = crypto.createHash('sha256').update(JSON.stringify(report.rows)).digest('hex');
writeJson(path.join(outDir, 'model-consumption.json'), report);
fs.writeFileSync(path.join(outDir, 'sample-table.md'), [
  '# W1-21 exhaustive UI model consumption', '',
  `Population: ${report.models_sampled}/${report.models_expected}; viewport 1280×720; DPR 1.`, '',
  '| Model | Mode | Changed | Null red | Restored | Result |', '|---|---|---:|---:|---:|---|',
  ...report.rows.map((r) => `| ${r.model} | ${r.mode} | ${!!r.changed} | ${!!r.equalised_red} | ${r.restored === undefined ? 'n/a' : !!r.restored} | ${r.pass ? 'PASS' : 'FAIL'} |`),
  '', `Aggregate: **${report.pass ? 'PASS' : 'FAIL'}**.`, '',
].join('\n'));
console.log(`UI model CONSUMPTION: ${report.pass ? 'PASS' : 'FAIL'} ${report.rows.filter((r) => r.pass).length}/${report.rows.length}`);
if (!report.pass) process.exitCode = 1;
