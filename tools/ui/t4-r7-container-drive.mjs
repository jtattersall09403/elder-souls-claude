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

// SECOND PASS, and this line is why the first run of this tool reported nothing usable. It passed
// `state: 'ui-journal'`, a fixture state the working container prober (`t4-r2-critic-drive.mjs`,
// whose H0-H3 the r6 critic ran green) does NOT use — and under it every real key press below was
// swallowed: `KeyD` left the focused row unmoved, eight `ArrowDown`s selected the same bark token
// eight times, and the run then threw on `getUIState().screen.rows`. The recovered report
// `recovered-from-quarantine/drive/t4-r7-drive-after.json` is that run and its R1/R2 passes are
// void for the same reason a §22 arm is void: the thing under test was never operated.
const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, ...(args.state ? { state: String(args.state) } : {}) });

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
    // The engine's own focus record. The first pass compared row `focused` flags instead, and a
    // side switch that moves focus between two rows the harness reports identically is invisible
    // to that comparison — `t4-r2-critic-drive.mjs` reads `focus.side` and that is why its H1 works.
    focus: st.focus ? { ...st.focus } : null,
    // The SIMULATION's inventory, not `getUIState().screen.rows`. The first pass read the latter,
    // which is undefined outside a screen that publishes it, and threw.
    carried: window.__ENGINE && window.__ENGINE.sim && Array.isArray(window.__ENGINE.sim.inventory)
      ? window.__ENGINE.sim.inventory.map((i) => String(i.id || i)) : null,
    panel_rect: panel ? panel.rect : null,
    rows: els.filter((e) => e.kind === 'list_row' && e.meta && e.meta.item_id)
      .map((e) => ({
        id: e.id, text: e.text, rect: e.rect, focused: !!e.focused, item_id: e.meta.item_id,
        // T4 r7: what the row actually DRAWS, not what it declares. See `chrome.js` `row()`.
        columns_drawn: e.meta.columns_drawn || null,
      })),
    band: band ? { rect: band.rect, text: band.text, meta: band.meta } : null,
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
  //
  // SECOND PASS, AND THE FIRST PASS OF THIS CHECK COULD NOT FAIL. It split the row element's
  // `text` on a double space and looked for `…` in the trailing fields. But `row()` builds `text`
  // from `cols.map(c => c.text)` — **the DECLARED strings** — and the ellipsis is applied inside
  // the draw callback. Round 6 drew the weight `11.5` as `11…` and its element text still read
  // `"Bog-iron maul  11.5  96"`; that exact string is in round 6's own manifest and in this round's
  // recovered run. So a check reading `text` reports "0 truncated numbers" against a screen
  // visibly drawing one, which is `HAZARDS` §22's shape in a different instrument: **an arm that
  // cannot disagree with the thing it is testing.**
  //
  // `chrome.js` `row()` now publishes `meta.columns_drawn[i] = { text, declared, truncated }` —
  // the post-ellipsis string, decided once and consumed by the draw callback — so this check reads
  // what was drawn. It REFUSES to run against a build without that field rather than passing:
  // absence of the evidence is not evidence of absence.
  const missingDrawn = s0.rows.filter((r) => !Array.isArray(r.columns_drawn));
  const numTrunc = [], nameTrunc = [];
  for (const r of s0.rows) {
    if (!Array.isArray(r.columns_drawn)) continue;
    // Column 0 is the name; every column after it on this screen is a numeric value.
    r.columns_drawn.forEach((col, i) => {
      if (!col.truncated) return;
      if (i === 0) nameTrunc.push({ id: r.id, declared: col.declared, drawn: col.text });
      else numTrunc.push({ id: r.id, column: i, declared: col.declared, drawn: col.text });
    });
  }
  report.data.rows = s0.rows.map((r) => ({ id: r.id, text: r.text, columns_drawn: r.columns_drawn }));
  report.data.name_truncated_rows = nameTrunc;
  if (missingDrawn.length) {
    push('R1 no weight or gold value is ellipsised on any visible row', false,
      `REFUSED: ${missingDrawn.length} of ${s0.rows.length} rows publish no meta.columns_drawn, so this `
      + `build cannot be asked what it DREW and the declared text cannot answer for it`);
  } else {
    push('R1 no weight or gold value is ellipsised on any visible row', numTrunc.length === 0,
      `${s0.rows.length} rows driven, ${numTrunc.length} with a truncated number, read off `
      + `meta.columns_drawn (names still truncated on ${nameTrunc.length}, reported not hidden: `
      + `${JSON.stringify(nameTrunc.map((n) => n.declared + ' -> ' + n.drawn))})`,
      { truncated_numbers: numTrunc });
  }
  // R1b — THE ARM MUST BE ABLE TO DISAGREE. A guard nobody has seen fail is not evidence (`RULES`
  // rule 6) and R1's entire history is a guard that could not. Two halves, both required:
  //
  //   (i) the PREDICATE fires on a truncated numeric column when it meets one;
  //  (ii) the PIPELINE that feeds it is live — `row()` really does set `truncated: true` when the
  //       string it drew differs from the string it was given. This is asked of the game itself, in
  //       page, by re-running `row()`'s own ellipsise decision at a width the widest weight cannot
  //       possibly fit. If (ii) is false then R1 is green because nothing can ever be red.
  const widestWeight = s0.rows.map((r) => (r.columns_drawn || [])[1]).filter(Boolean)
    .reduce((a, c) => (String(c.declared).length > a.length ? String(c.declared) : a), '');
  // The positive control is a REAL ITEM ON THE REAL SCREEN: a probe record with an absurd name is
  // added to the UI's own item table and put in a container, so `drawContainer()` lays it out and
  // `row()` publishes what it drew. If that name comes back `truncated: false` the reader is dead
  // and every R1 pass this tool has ever printed is worthless.
  const r1b = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    if (!eng || !eng.ui || !eng.ui.data || !eng.ui.data.items) return { reachable: false };
    eng.ui.data.items.set('t4-r7-probe', {
      name: 'A probe record whose name is far too long to fit in any column this screen owns',
      category: 'misc', weight: 11.5, value_gold: 96,
      description: 'Positive control for T4 r7 R1b. Not a game item.', condition: 0.5,
    });
    eng.openContainer('R1b probe', [{ id: 't4-r7-probe', count: 1 }]);
    return { reachable: true };
  }).catch((e) => ({ reachable: false, error: String((e && e.message) || e) }));
  let r1bRow = null;
  if (r1b.reachable) {
    await h.h('stepFrames', 3);
    const sp = await snap();
    r1bRow = (sp.rows.find((r) => r.item_id === 't4-r7-probe') || null);
    report.data.r1b_probe_row = r1bRow;
    report.data.r1b_probe_band = sp.band ? sp.band.meta : null;
  }
  const nameSees = !!(r1bRow && r1bRow.columns_drawn && r1bRow.columns_drawn[0] && r1bRow.columns_drawn[0].truncated);
  const numHolds = !!(r1bRow && r1bRow.columns_drawn && r1bRow.columns_drawn.slice(1).every((c) => !c.truncated));
  push('R1b the R1 arm can disagree — a deliberately unfittable NAME comes back truncated:true',
    r1b.reachable && nameSees,
    r1b.reachable
      ? `probe row drew name '${r1bRow && r1bRow.columns_drawn ? r1bRow.columns_drawn[0].text : '(no row)'}'`
        + ` (truncated=${nameSees}); its 11.5 / 96 columns held: ${numHolds}`
      : `could not reach window.__ENGINE.ui.data.items — R1 is UNVERIFIED, not passed`);
  // Restore the fixture container so nothing after this reads the probe.
  if (r1b.reachable) {
    await h.page.evaluate(() => {
      window.__ENGINE.ui.data.items.delete('t4-r7-probe');
      window.__ENGINE.openContainer('Reed Creel', [
        { id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 },
      ]);
    });
    await h.h('stepFrames', 3);
  }

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
    // SECOND PASS. The first pass ended `push('R2 ...', true, ...)` — a literal `true`. It could
    // not fail, which is the same defect as R1 reading the declaration and the same defect
    // `HAZARDS` §0b names: a guard whose arms cannot disagree. The band's own rect IS the clip
    // (`surface.js`), and `inventory.js` `factLayout()` now publishes the laid-out right edge of
    // the LAST fact in band-relative units, derived once and consumed by the draw callback. So the
    // assertion is arithmetic on numbers the screen actually drew with, and it can be false.
    const m = b.meta || {};
    report.data.band_width = b.rect[2];
    report.data.band_facts = { facts: m.facts || null, facts_right: m.facts_right, facts_fit: m.facts_fit };
    const haveLayout = Array.isArray(m.facts) && typeof m.facts_right === 'number';
    push('R2 every fact — condition included — is laid out INSIDE the band rect that clips it',
      haveLayout && m.facts_right <= b.rect[2] && m.facts_fit === true,
      haveLayout
        ? `item ${m.item_id}, ${m.facts.length} facts (${m.facts.map((x) => x.key).join('/')}), `
          + `last right edge ${m.facts_right} vs band width ${b.rect[2]} — `
          + `${m.facts_right <= b.rect[2] ? 'inside' : 'OUTSIDE, clipped'}`
        : `REFUSED: the band publishes no facts layout, so 'the condition is on screen' cannot be `
          + `distinguished from 'the condition is clipped away', which is exactly how round 6 shipped it`);
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
  //
  // SECOND PASS on both. R3b compared row `focused` FLAGS, which is a comparison two different
  // rows can satisfy identically and which reported FAIL on the recovered run against a screen
  // whose sides switch fine under `t4-r2-critic-drive.mjs` H1. It reads `focus.side` now — the
  // engine's own record, the same field H1 reads. R3c read `getUIState().screen.rows.length`,
  // which is undefined here and threw, killing the run before its last shot; it reads the
  // SIMULATION's inventory instead, which is what "the player is carrying it" actually means.
  const before = await snap();
  await key('KeyD');
  const mid = await snap();
  const sideOf = (s) => (s.focus && s.focus.container ? s.focus.container.side : (s.focus ? s.focus.side : null));
  report.data.sides = [sideOf(before), sideOf(mid)];
  push('R3b left/right switches which side of the container has focus',
    sideOf(before) !== null && sideOf(mid) !== null && sideOf(before) !== sideOf(mid),
    `focus.side ${JSON.stringify(sideOf(before))} -> ${JSON.stringify(sideOf(mid))}`);

  const nBefore = (mid.carried || []).length;
  await key('KeyE');
  await h.h('stepFrames', 10);
  const sTake = await snap();
  const nTake = (sTake.carried || []).length;
  await key('KeyA');
  await key('KeyE');
  await h.h('stepFrames', 10);
  const sPut = await snap();
  const nPut = (sPut.carried || []).length;
  report.data.carried_counts = [nBefore, nTake, nPut];
  push('R3c items transfer in BOTH directions through real key presses',
    nTake === nBefore + 1 && nPut === nBefore,
    `sim.inventory ${nBefore} -(take)-> ${nTake} -(put)-> ${nPut}`);

  await shoot('03-after-transfers');
} catch (e) {
  push('run', false, `threw: ${String((e && e.message) || e)}`);
} finally {
  await h.close();
}

// HAZARDS §18, copied here on purpose: a run that measured nothing must not overwrite a run that
// did, and it must not exit 0. The guard is one-sided (§0b) — it can only ever refuse to destroy
// evidence, so it cannot manufacture a pass.
const reportPath = path.join(OUT, `t4-r7-drive-${LABEL}.json`);
if (!checks.length && fs.existsSync(reportPath)) {
  fs.writeFileSync(reportPath.replace(/\.json$/, '.EMPTY-RUN-REFUSED.json'), JSON.stringify(report, null, 2));
  log(`REFUSED to overwrite ${path.relative(REPO_ROOT, reportPath)} with a zero-check run`);
  process.exit(2);
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
log(`wrote ${path.relative(REPO_ROOT, reportPath)} — ${checks.filter((c) => c.pass).length}/${checks.length} pass, commit ${report.commit}`);
process.exit(exit);
