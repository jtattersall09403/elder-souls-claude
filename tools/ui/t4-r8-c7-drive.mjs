#!/usr/bin/env node
// t4-r8-c7-drive.mjs — DOES THE ROUTE EXIST, AND DOES IT WORK? `RI-UIX03` C7 under `ARBITRATION`
// S65(1)'s three guards, driven through the shipped input handler, over all 45 carried records.
//
// Owner: T4-r8 (builder). S65(1) scoped C7 to "the surface a player can reach in one input" and
// attached three guards, because a scope ruling is one step from an excuse:
//   (a) the expansion must WORK, driven through the shipped handler (`CRITIC-DOCTRINE` §1.2b);
//   (b) NO ELLIPSIS WITHOUT A ROUTE — a truncated string with no reachable expansion is still a
//       violation;
//   (c) the resting panel keeps DN5's depiction and DN4's floor.
// The r7 critic then tested exactly that and found the licensed design did not exist: 22 bound
// desktop controls pressed on a record needing 5 lines while showing 4, none expanded, none put
// the text on screen. This file is the evidence for the round that built it, and it is written to
// be able to say NO.
//
// THE INSTRUMENT'S OWN FAILURE MODES, GUARDED FIRST — because the r7 builder's `K0` reported
// "no real DOM KeyboardEvent moves the container selection" against a screen whose selection moves
// fine, and filed its own dead instrument as the build's defect:
//
//   K0  THE INPUT PATH IS LIVE. Before any negative result is believed, a real `ArrowRight`
//       KeyboardEvent must be seen to change `focus.container.side`. If it does not, every "the
//       control does nothing" line below is void and the run says so instead of scoring it.
//   K1  THE READ IS OF THE RECORD IT NAMES. The r7 critic's own correction: the band shows the
//       item selected on the FOCUSED side, so a tool that opens a container per record and reads
//       the band without asserting `item_id` returns the same item 45 times. Every read here
//       asserts identity before its numbers are used.
//   K2  THE ARMS MUST DISAGREE. The same press is applied to a record that needs MORE lines than
//       the band holds and to one that needs FEWER, and the run fails if the two produce the same
//       answer — an instrument that reports "complete" for everything is not measuring anything.
//
// Checks:
//   C7-0  K0/K1/K2, the instrument's own controls.
//   C7-1  at rest: shown vs needed per record, and the histogram (the number S65 asks the resting
//         panel to publish rather than hide).
//   C7-2  ONE INPUT: `lock_on` (Tab) opens the reading view on every record.
//   C7-3  the reading view is COMPLETE — `description_lines_shown === description_lines_needed`
//         on every record, i.e. guard (b) is satisfied.
//   C7-4  the reading view REPLACES the lists rather than covering them (no `list_row` while it
//         is open), which is what keeps `RI-UIX06` FD4's "0 overlap" true in the expanded state.
//   C7-5  it closes again — a second `lock_on`, and `back`, both return the two lists.
//   C7-6  it refuses to open on nothing: `_canExamine` is false with an empty selection.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || ''))
  ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r8/c7'));
ensureDir(OUT);
const STATE = String(args.state || 'ui-journal');

const CARRIED = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/items/carried.json'), 'utf8'));
const RECORDS = Array.isArray(CARRIED) ? CARRIED : (CARRIED.items || Object.values(CARRIED)[0]);

const report = {
  schema: 'elder-souls/t4-r8-c7-drive@1', at: new Date().toISOString(), state: STATE,
  commit: execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(),
  records_in_fixture: RECORDS.length,
  checks: [], data: {},
};
const flush = () => fs.writeFileSync(path.join(OUT, 't4-r8-c7-drive.json'), JSON.stringify(report, null, 2));
const push = (id, pass, detail, extra) => {
  report.checks.push({ id, pass, detail, ...(extra || {}) });
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); flush();
};

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, state: STATE });
let exit = 0;
try {
  // The r2 preamble the r7 critic established as the one that actually attaches the listener:
  // `loadState` then a SECOND `setMode`. Without it `real.attached` is false and every key press
  // below is a no-op that looks exactly like a dead control.
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);

  const run = await h.page.evaluate(async (ids) => {
    const A = window.__HARNESS;
    const press = async (code) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
      await A.stepFrames(2);
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
      await A.stepFrames(2);
    };
    const look = () => {
      const st = A.getUIState();
      const els = (st.elements || []).filter((e) => e.visible);
      const pick = (id) => {
        const e = els.find((x) => x.id === id);
        return e ? { rect: e.rect, meta: e.meta ? JSON.parse(JSON.stringify(e.meta)) : null } : null;
      };
      // `getUIState().focus` is the CURRENT MODE'S focus record, flattened — not a map keyed by
      // mode. The first run of this file read `st.focus.container.side` and got `null -> null`,
      // so K0 reported the input path dead on a screen whose 45 subsequent reads all named the
      // record `ArrowRight` had just selected. That is the r7 builder's own `K0` failure
      // reproduced in my hand: an instrument's silence filed as the build's defect. The reading is
      // written both ways and takes whichever exists, so a future shape change shows up as `null`
      // in BOTH rather than as a confident false negative in one.
      const f = st.focus || {};
      const fc = f.container || f;
      return {
        mode: st.mode,
        side: fc.side === undefined ? null : fc.side,
        read_flag: fc.read === undefined ? null : !!fc.read,
        focus_shape: Object.keys(f).slice(0, 8),
        band: pick('container.band'),
        read: pick('container.read'),
        read_depiction: !!els.find((e) => e.id === 'container.read.depiction'),
        band_depiction: !!els.find((e) => e.id === 'container.band.depiction'),
        list_rows: els.filter((e) => e.kind === 'list_row').length,
        heads: els.filter((e) => e.kind === 'panel_header' && /^container\.(mine|theirs)\.head$/.test(e.id)).length,
        hint_lines: (() => { const hd = els.find((e) => e.id === 'container.mine.head'); return hd && hd.meta ? hd.meta.hint_lines : null; })(),
        numeric_columns: (() => { const hd = els.find((e) => e.id === 'container.mine.head'); return hd && hd.meta ? hd.meta.numeric_columns : null; })(),
      };
    };

    // ---- K0: is the input path live at all? ---------------------------------------------------
    A.openContainer('Reed Creel', [{ id: ids[0], count: 1 }]);
    await A.stepFrames(3);
    const k0a = look();
    await press('ArrowRight');
    const k0b = look();
    await press('ArrowLeft');
    const k0 = { before_side: k0a.side, after_right: k0b.side, moved: k0a.side !== k0b.side };

    // ---- the per-record sweep -----------------------------------------------------------------
    const out = [];
    for (const id of ids) {
      A.openContainer('Reed Creel', [{ id, count: 1 }]);
      await A.stepFrames(3);
      await press('ArrowRight');                       // stand in the container's own list
      const rest = look();
      await press('Tab');                              // ONE INPUT — `lock_on`
      const open = look();
      await press('Tab');                              // and it closes again
      const closed = look();
      out.push({ opened: id, rest, open, closed });
      await press('ArrowLeft');
    }

    // ---- C7-5b: `back` also leaves the reading view before it leaves the screen ---------------
    A.openContainer('Reed Creel', [{ id: ids[0], count: 1 }]);
    await A.stepFrames(3);
    await press('ArrowRight');
    await press('Tab');
    const beforeBack = look();
    await press('Space');                              // `roll` = back
    const afterBack = look();

    // ---- C7-6: it refuses to open on an empty side -------------------------------------------
    A.openContainer('Reed Creel', []);
    await A.stepFrames(3);
    await press('ArrowRight');
    const emptyRest = look();
    await press('Tab');
    const emptyAfter = look();

    return { k0, out, back: { beforeBack, afterBack }, empty: { emptyRest, emptyAfter } };
  }, RECORDS.map((r) => r.id));

  report.data = run;

  // ---- C7-0: the instrument's own controls ---------------------------------------------------
  push('C7-0a K0 the input path is live (a real ArrowRight moves focus.container.side)',
    run.k0.moved, `side ${run.k0.before_side} -> ${run.k0.after_right}. Every negative below is void if this is false.`);

  const named = run.out.filter((s) => s.rest.band && s.rest.band.meta && s.rest.band.meta.item_id === s.opened);
  push('C7-0b K1 the read is of the record it names',
    named.length === run.out.length,
    `${named.length} of ${run.out.length} reads select the record opened`);

  // ---- C7-1: at rest ------------------------------------------------------------------------
  const restUsable = named.filter((s) => s.rest.band.meta && typeof s.rest.band.meta.description_lines_needed === 'number');
  const restHist = restUsable.reduce((a, s) => { const n = s.rest.band.meta.description_lines_needed; a[n] = (a[n] || 0) + 1; return a; }, {});
  const restComplete = restUsable.filter((s) => s.rest.band.meta.description_lines_shown >= s.rest.band.meta.description_lines_needed);
  const restShown = [...new Set(restUsable.map((s) => s.rest.band.meta.description_lines_shown))].sort();
  report.data.rest = { n: restUsable.length, complete: restComplete.length, histogram: restHist, lines_shown_values: restShown };
  push('C7-1 at rest: the resting band shows what it holds and publishes the shortfall',
    restUsable.length === run.out.length,
    `${restComplete.length} of ${restUsable.length} complete AT REST; needed histogram ${JSON.stringify(restHist)}; `
    + `lines shown ${JSON.stringify(restShown)}. S65 does not require this to be 45 — it requires the ROUTE below.`);

  // ---- C7-2 / C7-3: one input, and it is complete --------------------------------------------
  const opened = named.filter((s) => s.open.read && s.open.read.meta && s.open.read.meta.item_id === s.opened);
  push('C7-2 ONE INPUT opens the reading view on every record (S65 guard a, driven through the shipped handler)',
    opened.length === run.out.length,
    `${opened.length} of ${run.out.length} records opened on a single Tab (lock_on); `
    + `read_flag true on ${run.out.filter((s) => s.open.read_flag).length}`);

  const completeOpen = opened.filter((s) => s.open.read.meta.description_lines_shown === s.open.read.meta.description_lines_needed
    && s.open.read.meta.description_complete === true);
  const shortfall = opened.filter((s) => !(s.open.read.meta.description_lines_shown === s.open.read.meta.description_lines_needed))
    .map((s) => ({ id: s.opened, shown: s.open.read.meta.description_lines_shown, needed: s.open.read.meta.description_lines_needed }));
  const openShown = [...new Set(opened.map((s) => s.open.read.meta.description_lines_shown))].sort((a, b) => a - b);
  report.data.expanded = { n: opened.length, complete: completeOpen.length, shortfall, lines_shown_values: openShown };
  push('C7-3 RI-UIX03 C7: the WHOLE description is on screen, unabbreviated and untruncated, on every record',
    opened.length === run.out.length && completeOpen.length === run.out.length,
    `${completeOpen.length} of ${run.out.length} complete in the reading view; shortfalls ${JSON.stringify(shortfall.slice(0, 6))}`);

  // ---- K2: the arms must disagree -------------------------------------------------------------
  // The instrument is only worth something if the SAME press produces different answers on a
  // record the band can hold and one it cannot. If every record reported the same thing at rest,
  // the "complete" count above would be a constant, not a measurement.
  const restDistinct = new Set(restUsable.map((s) => s.rest.band.meta.description_lines_shown >= s.rest.band.meta.description_lines_needed));
  push('C7-0c K2 the arms disagree — at rest the fixture contains BOTH complete and incomplete records',
    restDistinct.size === 2,
    `distinct rest outcomes ${[...restDistinct].join(', ')} over ${restUsable.length} records. `
    + 'One outcome for all 45 would mean this tool cannot tell the two cases apart.');

  // ---- C7-4: it replaces, it does not overlay --------------------------------------------------
  const overlaid = opened.filter((s) => s.open.list_rows > 0);
  push('C7-4 the reading view REPLACES the lists (0 list_row elements while open) — FD4 "0 overlap" survives the expansion',
    overlaid.length === 0,
    `${overlaid.length} records left list rows declared under the reading view; heads still drawn on `
    + `${opened.filter((s) => s.open.heads === 2).length} of ${opened.length}; depiction present on `
    + `${opened.filter((s) => s.open.read_depiction).length} (RI-UIX09 DN5)`);

  // ---- C7-5: it closes ------------------------------------------------------------------------
  const reclosed = named.filter((s) => s.closed.read === null && s.closed.list_rows > 0);
  push('C7-5a a second lock_on returns the two lists on every record',
    reclosed.length === run.out.length,
    `${reclosed.length} of ${run.out.length} closed back to the lists`);
  push('C7-5b `back` leaves the reading view before it leaves the screen (not GAP-W1-ui-journal-search-view-has-no-exit again)',
    run.back.beforeBack.read !== null && run.back.afterBack.read === null && run.back.afterBack.mode === 'container',
    `open -> read element ${run.back.beforeBack.read ? 'present' : 'absent'}; after back -> mode ${run.back.afterBack.mode}, `
    + `read element ${run.back.afterBack.read ? 'present' : 'absent'}, rows ${run.back.afterBack.list_rows}`);

  // ---- C7-6: it refuses on nothing ------------------------------------------------------------
  push('C7-6 lock_on does nothing on an empty side — a control that opens an empty reading view is a control that lies',
    run.empty.emptyAfter.read === null,
    `empty side: read element ${run.empty.emptyAfter.read ? 'present' : 'absent'}, read_flag ${run.empty.emptyAfter.read_flag}`);

  // ---- the two carried-over claims, re-derived here rather than inherited ----------------------
  const nc = run.out[0] && run.out[0].rest.numeric_columns;
  report.data.numeric_columns = nc || null;
  push('C7-7 the RESTATED numeric claim (job 2): the layout publishes its headroom instead of asserting it cannot truncate',
    !!nc && typeof nc.cannot_truncate === 'boolean',
    nc ? `clamp ${nc.clamp}; weight widest ${nc.weight.widest} headroom ${nc.weight.headroom}; `
      + `gold widest ${nc.gold.widest} headroom ${nc.gold.headroom}; cannot_truncate ${nc.cannot_truncate} `
      + `over ${nc.rows_measured} rows` : 'the header publishes no numeric_columns block');
  const hl = [...new Set(run.out.map((s) => s.rest.hint_lines).concat(run.out.map((s) => s.open.hint_lines)))];
  push('C7-8 the foot hint wraps to the SAME number of lines in both views (so the inner box does not jump)',
    hl.length === 1 && hl[0] === 2,
    `hint_lines observed across both views: ${JSON.stringify(hl)}`);
} catch (e) {
  report.data.threw = String((e && e.stack) || e);
  log(`  THREW ${String((e && e.message) || e)}`); exit = 1;
}
report.summary = { passed: report.checks.filter((c) => c.pass).length, failed: report.checks.filter((c) => c.pass === false).length };
flush();
if (report.checks.length === 0) process.exit(2);
if (report.checks.some((c) => c.pass === false)) exit = 1;
log(`written: ${path.join(OUT, 't4-r8-c7-drive.json')}`);
try { await Promise.race([h.close(), new Promise((r) => setTimeout(r, 20000))]); } catch { /* reaped */ }
process.exit(exit);
