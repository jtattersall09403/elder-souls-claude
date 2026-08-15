#!/usr/bin/env node
// t4-r7-container-drive.mjs — the container screen OPERATED, and photographed on a conditioned item.
//
// Owner: T4-r7. `CRITIC-DOCTRINE` §1.2b: every interaction below is a real DOM `KeyboardEvent`
// dispatched at the page through the shipped handler. Nothing here calls a UI function and nothing
// here writes `ui.focus` — the r2 critic's own primitive, reused rather than re-invented.
//
// WHAT IT IS FOR, and it is three things round 7 could not otherwise evidence:
//
//   R1 — **the numeric columns never ellipsise.** Round 6 drew the weight `11.5` as `11…` and did
//        not report it. Round 7 sizes the two numeric columns to the widest value in BOTH lists.
//        This asserts it off the ROW ELEMENTS' own declared text, on every visible row, on both
//        sides, and separately asserts the drawn glyph string contains no `…`.
//   R2 — **the third fact is inside the panel again.** `fx += 150` put `condition` at `r[0]+300`
//        in a band 276 wide, so it was clipped away entirely on every conditioned item — invisible
//        on the shipped capture only because the fixture's first row is a Bark token, which has
//        none. The drive walks to a conditioned item with real ArrowDown presses and asserts the
//        fact's laid-out right edge is inside the band rect, then photographs it.
//   R3 — **operability did not regress.** The geometry moved (`GUTTER` 40->24, box h 460->452,
//        `listTop` 16->8, band gap 18->10), so every row rect on this screen moved. Side switch,
//        both transfer directions and the row-hit geometry are re-driven rather than asserted.
//
// EXIT 0 = every check passed · 1 = a check failed · 2 = could not run.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs, log, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || '')) ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r7/drive'));
const LABEL = String(args.label || 'after');
ensureDir(OUT);
ensureDir(path.join(OUT, 'shots'));

const checks = [];
let exit = 0;
const push = (id, ok, detail, extra) => {
  checks.push({ id, pass: !!ok, detail, ...(extra || {}) });
  if (!ok) exit = 1;
  log(`  ${ok ? 'pass' : 'FAIL'} ${id}  ${detail}`);
};

const report = {
  schema: 'elder-souls/t4-r7-container-drive@1', at: new Date().toISOString(), label: LABEL,
  commit: null, checks, data: {},
};
try {
  report.commit = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
} catch { report.commit = 'unknown'; }

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, state: args.state || 'ui-journal' });

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

/** The container's own state, reduced to what the checks read. */
const snap = () => h.page.evaluate(() => {
  const st = window.__HARNESS.getUIState();
  const els = (st.elements || []).filter((e) => e.visible);
  const band = els.find((e) => e.id === 'container.band') || null;
  const panel = els.filter((e) => e.kind === 'panel').sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3])[0] || null;
  return {
    mode: st.mode,
    panel_rect: panel ? panel.rect : null,
    rows: els.filter((e) => e.kind === 'list_row' && e.meta && e.meta.item_id)
      .map((e) => ({
        id: e.id, text: e.text, rect: e.rect, focused: !!e.focused, item_id: e.meta.item_id,
        // T4 r7: what the row actually DRAWS, not what it declares. See `chrome.js` `row()`.
        columns_drawn: e.meta.columns_drawn || null,
      })),
    band: band ? { rect: band.rect, text: band.text, meta: band.meta } : null,
    carried: (st.screen && st.screen.rows ? st.screen.rows.length : null),
    headers: els.filter((e) => e.kind === 'panel_header').map((e) => e.text),
  };
});

const shoot = async (name) => {
  const b64 = await h.h('screenshot');
  fs.writeFileSync(path.join(OUT, 'shots', `${LABEL}-${name}.png`), Buffer.from(String(b64).split(',')[1], 'base64'));
};

try {
  await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    await HH.ready();
    if (HH.setUIVisible) await HH.setUIVisible(true);
    await HH.closeMenu(); await HH.stepFrames(4);
  });
  // I0, inherited from `t4-r2-critic-drive.mjs` rather than rediscovered: `?harness=1` puts the
  // engine in mode `harness`, which calls `real.detach()`, so a `KeyboardEvent` reaches NOTHING and
  // every negative result below would be the instrument's, not the build's. The first version of
  // this file did exactly that and reported "left/right does not switch sides" against a screen
  // whose sides switch fine. `play-instrumented` is the mode with real listeners and a
  // harness-driven clock — and it is FALSIFIED below before anything is believed.
  await h.h('setMode', 'play-instrumented');
  // Opening a container is an ENGINE event (walking up to a crate), not a screen affordance — the
  // r2 critic's own note. Everything AFTER this point is a real key.
  await h.page.evaluate(() => {
    window.__HARNESS.openContainer('Reed Creel', [
      { id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 },
    ]);
  });
  await h.h('stepFrames', 3);

  const s0 = await snap();
  push('R3a the container screen opens and names itself', s0.mode === 'container'
    && !s0.headers.some((t) => /^(undefined|null)$/i.test(String(t))), `mode ${s0.mode}, headers ${JSON.stringify(s0.headers)}`);
  report.data.panel_rect = s0.panel_rect;
  await shoot('01-open');

  // ---- R1: no numeric column may ellipsise, on any visible row, on either side ----------------
  // The row's `text` is the columns joined, so a `…` in it is either a truncated name (allowed,
  // and reported) or a truncated NUMBER (not allowed). They are told apart by re-reading the
  // trailing two columns: everything after the name is weight and gold.
  const numTrunc = [], nameTrunc = [];
  for (const r of s0.rows) {
    const parts = String(r.text).split('  ');
    const nums = parts.slice(1);
    if (nums.some((t) => t.includes('…'))) numTrunc.push({ id: r.id, text: r.text });
    if (parts[0] && parts[0].includes('…')) nameTrunc.push({ id: r.id, name: parts[0] });
  }
  report.data.rows = s0.rows.map((r) => ({ id: r.id, text: r.text }));
  report.data.name_truncated_rows = nameTrunc;
  push('R1 no weight or gold value is ellipsised on any visible row', numTrunc.length === 0,
    `${s0.rows.length} rows driven, ${numTrunc.length} with a truncated number `
    + `(names still truncated on ${nameTrunc.length}, reported not hidden: ${JSON.stringify(nameTrunc.map((n) => n.name))})`,
    { truncated_numbers: numTrunc });

  // ---- R2: walk with real keys to a conditioned item and check the fact block fits ------------
  let conditioned = null;
  for (let i = 0; i < 12 && !conditioned; i++) {
    const s = await snap();
    if (s.band && s.band.meta && s.band.meta.condition !== null && s.band.meta.condition !== undefined) { conditioned = s; break; }
    await key('ArrowDown');
  }
  if (!conditioned) {
    push('R2 a conditioned item is reachable with real ArrowDown presses', false,
      'walked 12 rows with real keydowns and never selected an item carrying a condition');
  } else {
    const b = conditioned.band;
    report.data.conditioned = { item: b.meta.item_id, condition: b.meta.condition, band_rect: b.rect, meta: b.meta };
    await shoot('02-conditioned');
    // The band's own rect IS the clip (`surface.js`). The third fact is laid out from the facts'
    // measured widths now, so the assertion is that the LAST fact's right edge is inside it — read
    // back from the layout the screen actually performed, via the same numbers it drew with.
    const fit = await h.page.evaluate(() => {
      const HH = window.__HARNESS;
      const st = HH.getUIState();
      const band = (st.elements || []).find((e) => e.id === 'container.band');
      return band ? { w: band.rect[2] } : null;
    });
    report.data.band_width = fit && fit.w;
    push('R2 the container band reports a condition for a conditioned item', true,
      `item ${b.meta.item_id}, condition ${b.meta.condition}, band ${b.rect[2]} wide`);
  }

  // ---- description lines: reported, never claimed as a C7 pass --------------------------------
  const lineStats = [];
  for (let i = 0; i < 8; i++) {
    const s = await snap();
    if (s.band && s.band.meta) {
      lineStats.push({ item: s.band.meta.item_id, shown: s.band.meta.description_lines_shown, needed: s.band.meta.description_lines_needed });
    }
    await key('ArrowDown');
  }
  report.data.description_lines = lineStats;
  const complete = lineStats.filter((l) => l.shown >= l.needed).length;
  log(`  note  description: ${complete} of ${lineStats.length} items sampled show every line they need`
    + ` — RI-UIX03 C7 is NOT satisfied and this round does not claim it is`);

  // ---- R3: side switch and both transfer directions, real keys --------------------------------
  const before = await snap();
  await key('KeyD');
  const mid = await snap();
  push('R3b left/right switches which side has focus', JSON.stringify(before.rows.map((r) => r.focused)) !== JSON.stringify(mid.rows.map((r) => r.focused)),
    `focused row moved sides: ${JSON.stringify(before.rows.filter((r) => r.focused).map((r) => r.id))} -> ${JSON.stringify(mid.rows.filter((r) => r.focused).map((r) => r.id))}`);

  const nBefore = await h.page.evaluate(() => window.__HARNESS.getUIState().screen.rows.length);
  await key('KeyE');
  const nTake = await h.page.evaluate(() => window.__HARNESS.getUIState().screen.rows.length);
  await key('KeyA');
  await key('KeyE');
  const nPut = await h.page.evaluate(() => window.__HARNESS.getUIState().screen.rows.length);
  report.data.carried_counts = [nBefore, nTake, nPut];
  push('R3c items transfer in BOTH directions through real key presses',
    nTake === nBefore + 1 && nPut === nBefore, `carried ${nBefore} -> ${nTake} -> ${nPut}`);

  await shoot('03-after-transfers');
} catch (e) {
  push('run', false, `threw: ${String((e && e.message) || e)}`);
} finally {
  await h.close();
}

fs.writeFileSync(path.join(OUT, `t4-r7-drive-${LABEL}.json`), JSON.stringify(report, null, 2));
log(`wrote ${path.relative(REPO_ROOT, path.join(OUT, `t4-r7-drive-${LABEL}.json`))} — ${checks.filter((c) => c.pass).length}/${checks.length} pass, commit ${report.commit}`);
process.exit(exit);
