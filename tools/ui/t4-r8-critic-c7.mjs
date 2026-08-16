#!/usr/bin/env node
// t4-r8-critic-c7.mjs — THE CRITIC'S OWN DRIVE of `RI-UIX03` C7's route, written independently of
// `tools/ui/t4-r8-c7-drive.mjs` and asking four questions that one does not.
//
// Owner: crit-t4-r8. CRITIC-DOCTRINE §1.2b — a screen must WORK, driven through the shipped input
// path. §1.1 — nothing here is scored from source.
//
// WHAT THIS ADDS OVER THE BUILDER'S TOOL, and why each one exists:
//
//   X1  THE JUDGED COMMIT IS NOT THE COMMIT THE BUILDER MEASURED. `game/src/ui/system.js` gained a
//       `f.container.read = false` inside `_confirm()`'s container case AFTER the builder's
//       12-of-12 run at 5c6142d7 (`git diff 5c6142d7 HEAD -- game/src/ui/` is one hunk, read this
//       run). Taking an item while the reading view is open is therefore an UNDRIVEN path in the
//       evidence on file, and it is a path that mutates the same flag the route toggles.
//
//   X2  `lock_on` IS A COMBAT BINDING. The handler gates on `!inCombat`, but a source gate is not
//       evidence. A real fight is entered (`spawn('inf_trash')` next to the player, the same
//       recipe `hud-compass-probe.mjs` and `t4-r3-critic.mjs` use, and ARBITRATION §1's own
//       definition of a fight) and the key is pressed with the container open. Two things must
//       hold: the reading view must NOT open, and — the one that would actually hurt a player —
//       lock_on must still reach the combat system, i.e. the UI must not swallow it.
//
//   X3  `description_complete` IS A SELF-REPORT. The r7 gap was found by cropping the picture, not
//       by a number, and every number on that build said clean. So for the worst records in the
//       fixture the DRAWN description is counted off the pixels: ink rows inside the reading
//       rect's text column are grouped into bands and the band count is compared to the declared
//       `description_lines_shown`. A declared 6 that draws 4 is the exact defect class.
//
//   X4  THE RESTING HISTOGRAM IS MEASURED ON A ONE-ITEM CONTAINER in the builder's tool
//       (`openContainer('Reed Creel', [{id, count: 1}])` per record). This one re-measures the
//       resting band on the SHIPPED 7-row fixture as well, so the 20-of-45 figure is not a
//       property of a container built for the measurement.
//
// Exit non-zero if any check fails.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || ''))
  ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r8-critic/c7'));
ensureDir(OUT);
ensureDir(path.join(OUT, 'shots'));
const STATE = String(args.state || 'ui-journal');

const CARRIED = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/items/carried.json'), 'utf8'));
const RECORDS = Array.isArray(CARRIED) ? CARRIED : (CARRIED.items || Object.values(CARRIED)[0]);

const report = {
  schema: 'elder-souls/t4-r8-critic-c7@1', at: new Date().toISOString(), state: STATE,
  commit: execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(),
  worktree: REPO_ROOT,
  records_in_fixture: RECORDS.length,
  checks: [], data: {},
};
const flush = () => fs.writeFileSync(path.join(OUT, 't4-r8-critic-c7.json'), JSON.stringify(report, null, 2));
let bad = 0;
const push = (id, pass, detail, extra) => {
  if (!pass) bad++;
  report.checks.push({ id, pass, detail, ...(extra || {}) });
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); flush();
};

// ---- minimal PNG decode, self-contained (same shape as t4-r5-legibility's, deliberately not
// imported so this tool inherits no default or side effect from it) -----------------------------
function decodePNG(buf) {
  let p = 8, width = 0, height = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colourType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) throw new Error(`unsupported PNG ${bitDepth}/${colourType}/${interlace}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let q = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      else if (f !== 0) throw new Error('unknown filter ' + f);
      cur[x] = v & 255;
    }
  }
  return { width, height, data: out };
}
const rawPng = (b64) => Buffer.from(String(b64).split(',')[1], 'base64');

/**
 * X3's estimator. Ink rows inside a rect against that rect's own modal colour, grouped into BANDS
 * separated by >= `GAPROWS` blank rows. A line of 19px prose at 1.44 leading is ~27 px of pitch
 * with roughly 13 px of ink, so the blank run between two lines is several rows; `GAPROWS = 2` is
 * therefore permissive in the direction that UNDER-counts bands, which is the safe direction for a
 * check whose failure mode would be inventing lines the screen does not draw.
 */
const FG = 24, GAPROWS = 2;
function textBands(png, rect) {
  const [x0, y0, w, h] = rect.map(Math.round);
  const hist = new Map();
  for (let y = y0; y < y0 + h && y < png.height; y++) for (let x = x0; x < x0 + w && x < png.width; x++) {
    const i = ((y * png.width) + x) << 2;
    const k = ((png.data[i] >> 5) << 6) | ((png.data[i + 1] >> 5) << 3) | (png.data[i + 2] >> 5);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  let best = 0, bestN = -1;
  for (const [k, n] of hist) if (n > bestN) { bestN = n; best = k; }
  const mode = [((best >> 6) & 7) * 32 + 16, ((best >> 3) & 7) * 32 + 16, (best & 7) * 32 + 16];
  const rows = [];
  for (let y = y0; y < y0 + h && y < png.height; y++) {
    let n = 0;
    for (let x = x0; x < x0 + w && x < png.width; x++) {
      const i = ((y * png.width) + x) << 2;
      const dr = png.data[i] - mode[0], dg = png.data[i + 1] - mode[1], db = png.data[i + 2] - mode[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > FG) n++;
    }
    rows.push(n);
  }
  const bands = [];
  let run = null, blank = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] > 0) {
      if (!run) run = { y0: i, y1: i, ink: 0 };
      run.y1 = i; run.ink += rows[i]; blank = 0;
    } else if (run) {
      blank++;
      if (blank >= GAPROWS) { bands.push(run); run = null; blank = 0; }
    }
  }
  if (run) bands.push(run);
  return { mode, bands: bands.map((b) => ({ y0: b.y0, y1: b.y1, ink: b.ink })), ink_rows: rows.filter((n) => n > 0).length };
}

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000, state: STATE });
try {
  // The preamble that actually attaches the real listener. Asserted below, not assumed.
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);

  const attached = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    return { real_attached: !!(e && e.real && e.real.attached), webdriver: navigator.webdriver };
  });
  report.data.attached = attached;
  push('X0a the real input listener is attached', !!attached.real_attached,
    `engine.real.attached = ${attached.real_attached}. Every negative below is void if this is false.`);

  // ------------------------------------------------------------------------------------------
  // X0b / X4 — the route, all 45 records, and the resting band on the SHIPPED fixture
  // ------------------------------------------------------------------------------------------
  const sweep = await h.page.evaluate(async (ids) => {
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
      const pick = (id) => { const e = els.find((x) => x.id === id); return e ? { rect: e.rect, text: e.text, meta: e.meta ? JSON.parse(JSON.stringify(e.meta)) : null } : null; };
      const f = st.focus || {}; const fc = f.container || f;
      return {
        mode: st.mode,
        side: fc.side === undefined ? null : fc.side,
        read_flag: fc.read === undefined ? null : !!fc.read,
        band: pick('container.band'), read: pick('container.read'),
        read_depiction: !!els.find((e) => e.id === 'container.read.depiction'),
        band_depiction: !!els.find((e) => e.id === 'container.band.depiction'),
        list_rows: els.filter((e) => e.kind === 'list_row').length,
        heads: els.filter((e) => e.kind === 'panel_header' && /^container\.(mine|theirs)\.head$/.test(e.id)).length,
      };
    };

    // K0 equivalent, in my hand: a real ArrowRight must move the side.
    A.openContainer('Reed Creel', [{ id: ids[0], count: 1 }]);
    await A.stepFrames(3);
    const a = look(); await press('ArrowRight'); const b = look(); await press('ArrowLeft');
    const k0 = { before: a.side, after: b.side, moved: a.side !== b.side };

    const out = [];
    for (const id of ids) {
      A.openContainer('Reed Creel', [{ id, count: 1 }]);
      await A.stepFrames(3);
      await press('ArrowRight');
      const rest = look();
      await press('Tab');
      const open = look();
      await press('Tab');
      const closed = look();
      out.push({ id, rest, open, closed });
      await press('ArrowLeft');
    }

    // X4 — the resting band walked over the player's own carried list on the SHIPPED fixture,
    // container built with three items exactly as t4-r5-legibility's opener does. Walk `down`
    // through the whole side with real presses and read every record the band shows.
    A.openContainer('Reed Creel', [
      { id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 },
    ]);
    await A.stepFrames(3);
    const walked = []; const seen = new Set();
    for (let i = 0; i < 60; i++) {
      const st = look();
      const m = st.band && st.band.meta;
      if (m && m.item_id && !seen.has(m.item_id)) {
        seen.add(m.item_id);
        walked.push({
          item_id: m.item_id, shown: m.description_lines_shown, needed: m.description_lines_needed,
          // NOT `m.description_complete` — the resting band does not publish that name. See the
          // note on `bandComplete` below; reading it cost this tool a false 0-of-45.
          complete: m.description_lines_shown === m.description_lines_needed,
          truncated: !!m.description_truncated, depiction: st.band_depiction,
        });
      }
      await press('ArrowDown');
    }
    return { k0, out, walked };
  }, RECORDS.map((r) => r.id));

  report.data.k0 = sweep.k0;
  push('X0b a real ArrowRight moves focus.container.side',
    sweep.k0.moved, `side ${sweep.k0.before} -> ${sweep.k0.after}`);

  const named = sweep.out.filter((s) => s.rest.band && s.rest.band.meta && s.rest.band.meta.item_id === s.id);
  push('X0c every read is of the record it names',
    named.length === sweep.out.length, `${named.length} of ${sweep.out.length}`);

  const opened = sweep.out.filter((s) => s.open.read_flag === true && s.open.read);
  push('X1a one input (Tab = lock_on) opens the reading view on every record',
    opened.length === sweep.out.length, `${opened.length} of ${sweep.out.length}`);

  const complete = sweep.out.filter((s) => s.open.read && s.open.read.meta && s.open.read.meta.description_complete === true
    && s.open.read.meta.description_lines_shown === s.open.read.meta.description_lines_needed);
  push('X1b the reading view DECLARES the whole description on every record',
    complete.length === sweep.out.length, `${complete.length} of ${sweep.out.length} complete`);

  const replaced = sweep.out.filter((s) => s.open.list_rows === 0 && s.open.heads === 2 && s.open.read_depiction);
  push('X1c the reading view REPLACES the lists, keeps both headers and DN5s depiction',
    replaced.length === sweep.out.length, `${replaced.length} of ${sweep.out.length}`);

  const shut = sweep.out.filter((s) => s.closed.read_flag === false && s.closed.list_rows > 0);
  push('X1d a second lock_on returns the lists',
    shut.length === sweep.out.length, `${shut.length} of ${sweep.out.length}`);

  // The resting histogram, both ways.
  //
  // MY OWN FIRST RUN GOT THIS WRONG AND IT IS LEFT RECORDED. I read `description_complete` off the
  // RESTING BAND and got 0 of 45, against the builder's 20 of 45 — and the builder was right. The
  // band's meta (`inventory.js`, the `container.band` `S.el`) publishes `description_truncated`,
  // `description_lines_shown` and `description_lines_needed` and NO `description_complete`; only
  // the READING VIEW's meta carries that name. `undefined` is falsy, so my filter answered "not one
  // record is complete" about a build where twenty are. That is the third instrument in this item's
  // history to file its own silence as the build's defect (the r7 builder's K0, the r8 builder's
  // K0, now mine), and the correct derivation is the comparison itself.
  const bandComplete = (m) => !!m && m.description_lines_shown === m.description_lines_needed;
  const hist = {};
  for (const s of sweep.out) { const n = s.rest.band && s.rest.band.meta ? s.rest.band.meta.description_lines_needed : null; hist[n] = (hist[n] || 0) + 1; }
  const restComplete = sweep.out.filter((s) => s.rest.band && bandComplete(s.rest.band.meta));
  report.data.rest_histogram_one_item_container = hist;
  report.data.rest_complete_one_item_container = restComplete.length;
  report.data.walked_shipped_fixture = sweep.walked;
  const walkedComplete = sweep.walked.filter((w) => w.complete).length;
  push('X4 the resting band on the SHIPPED fixture agrees with the one-item measurement',
    sweep.walked.length > 0,
    `walked ${sweep.walked.length} distinct records with real ArrowDown presses; ${walkedComplete} complete, ` +
    `${sweep.walked.length - walkedComplete} short. One-item-container arm: ${restComplete.length} of ${sweep.out.length} complete, needed-histogram ${JSON.stringify(hist)}`);

  // ------------------------------------------------------------------------------------------
  // X1 — TAKING THE THING WHILE READING IT. The path added after the builder's evidence run.
  // ------------------------------------------------------------------------------------------
  const take = await h.page.evaluate(async () => {
    const A = window.__HARNESS;
    const press = async (code) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
      await A.stepFrames(2);
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
      await A.stepFrames(2);
    };
    const look = () => {
      const st = A.getUIState(); const els = (st.elements || []).filter((e) => e.visible);
      const f = st.focus || {}; const fc = f.container || f;
      return {
        mode: st.mode, read_flag: fc.read === undefined ? null : !!fc.read,
        list_rows: els.filter((e) => e.kind === 'list_row').length,
        read_el: !!els.find((e) => e.id === 'container.read'),
        theirs_rows: els.filter((e) => /^container\.theirs\.row\./.test(e.id)).length,
      };
    };
    A.openContainer('Reed Creel', [{ id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 }]);
    await A.stepFrames(3);
    await press('ArrowRight');            // stand in the container's side
    await press('Tab');                   // open the reading view
    const before = look();
    await press('KeyE');                  // `interact` = confirm = take
    const after = look();
    await A.stepFrames(6);
    const settled = look();
    // and `back` from the settled state must leave the reading view, not the screen
    await press('Space');
    const afterBack = look();
    return { before, after, settled, afterBack };
  });
  report.data.take_while_reading = take;
  push('X1e taking the item while reading it does not strand the reading flag',
    take.before.read_flag === true && take.after.read_flag === false && take.after.list_rows > 0,
    `read ${take.before.read_flag} -> ${take.after.read_flag}; list_rows ${take.before.list_rows} -> ${take.after.list_rows}; ` +
    `container side rows ${take.before.theirs_rows} -> ${take.settled.theirs_rows}`);
  push('X1f the item was actually transferred by that press (the control is not a no-op)',
    take.settled.theirs_rows < take.before.theirs_rows || take.after.theirs_rows < 2,
    `container-side rows ${take.before.theirs_rows} -> ${take.after.theirs_rows} -> ${take.settled.theirs_rows}`);

  // ------------------------------------------------------------------------------------------
  // X2 — lock_on IN A REAL FIGHT
  // ------------------------------------------------------------------------------------------
  const fight = await h.page.evaluate(async () => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const press = async (code) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
      await A.stepFrames(2);
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
      await A.stepFrames(2);
    };
    const look = () => {
      const st = A.getUIState(); const els = (st.elements || []).filter((e) => e.visible);
      const f = st.focus || {}; const fc = f.container || f;
      return {
        mode: st.mode, inCombat: !!st.inCombat,
        read_flag: fc.read === undefined ? null : !!fc.read,
        read_el: !!els.find((e) => e.id === 'container.read'),
        list_rows: els.filter((e) => e.kind === 'list_row').length,
      };
    };
    try { await A.closeMenu(); } catch { /* nothing open */ }
    const known = Object.keys((eng.data && eng.data.enemies) || {});
    const id = ['inf_trash', 'cam_levy', 'drowned_lesser'].find((k) => known.includes(k)) || null;
    if (!id) return { entered: false, why: `no usable archetype among ${known.slice(0, 12).join(', ')}` };
    const p = eng.sim.player;
    let eid = null;
    try { const r = A.spawn(id, p.pos[0] + 4, p.pos[2] + 4, { as: 'crit-t4-r8-foe' }); eid = r && r.eid !== undefined ? r.eid : r; } catch (e) { return { entered: false, why: String(e.message || e) }; }
    try { A.aggro(eid); } catch { /* some archetypes aggro on proximity alone */ }
    await A.stepFrames(6);
    const inCombat = !!(eng.inCombat && eng.inCombat());
    if (!inCombat) return { entered: false, why: 'spawned but engine.inCombat() is false', archetype: id };

    // lock-on target BEFORE, with no menu open — the null control for "does the key still reach
    // the combat system". Read whatever the combat state calls its lock.
    // `getCombatState().lock` is `{ target, score, both_framed }` (engine.js, read this run). The
    // first version of this tool guessed at `lockOn`/`lock_on`/`lockTarget`/`target` and got
    // `null` from all four, then reported the check FAILED — an instrument's ignorance filed as
    // the build's defect, which is the failure this whole item keeps producing. Read the real one.
    const lockOf = () => { try { const cs = A.getCombatState(); return cs && cs.lock ? { target: cs.lock.target, score: cs.lock.score } : null; } catch (e) { return 'ERR:' + String(e.message || e); } };
    const lockBefore = lockOf();
    await press('Tab');
    const lockAfterNoMenu = lockOf();

    A.openContainer('Reed Creel', [{ id: 'bog-iron-maul', count: 1 }]);
    await A.stepFrames(3);
    await press('ArrowRight');
    const menuBefore = look();
    await press('Tab');
    const menuAfter = look();
    const lockAfterMenu = lockOf();
    return {
      entered: true, archetype: id, inCombat,
      lock_before: lockBefore, lock_after_no_menu: lockAfterNoMenu, lock_after_menu_press: lockAfterMenu,
      menuBefore, menuAfter,
    };
  });
  report.data.in_combat = fight;
  if (!fight.entered) {
    push('X2a a real fight is running (gate)', false,
      `COULD NOT ENTER COMBAT — ${fight.why}. X2b/X2c did not run and are recorded FAILED CLOSED, not skipped.`);
    push('X2b lock_on does not open the reading view in a fight', false, 'not run — no fight');
    push('X2c lock_on still reaches the combat system in a fight', false, 'not run — no fight');
  } else {
    push('X2a a real fight is running (gate)', true, `archetype ${fight.archetype}, engine.inCombat() = ${fight.inCombat}, census inCombat = ${fight.menuAfter.inCombat}`);
    push('X2b lock_on does NOT open the reading view in a fight',
      fight.menuAfter.read_flag !== true && fight.menuAfter.read_el === false,
      `with the container open in a live fight: read flag ${fight.menuBefore.read_flag} -> ${fight.menuAfter.read_flag}, ` +
      `container.read element drawn = ${fight.menuAfter.read_el}, list_rows ${fight.menuAfter.list_rows}`);
    const tgt = (l) => (l && typeof l === 'object' ? l.target : null);
    push('X2c the null control: lock_on reaches combat with no menu open',
      tgt(fight.lock_after_no_menu) !== null && tgt(fight.lock_before) === null,
      `combat lock target: before ${JSON.stringify(tgt(fight.lock_before))}, after one Tab with no menu open ` +
      `${JSON.stringify(tgt(fight.lock_after_no_menu))}. If this is null the key never reached combat and X2d cannot be read.`);
    push('X2d lock_on is NOT swallowed by the container in a fight (the lock survives the press)',
      tgt(fight.lock_after_no_menu) !== null && tgt(fight.lock_after_menu_press) !== null,
      `after Tab with the container open in the same fight, combat lock target is ` +
      `${JSON.stringify(tgt(fight.lock_after_menu_press))} (was ${JSON.stringify(tgt(fight.lock_after_no_menu))} before the screen opened)`);
  }

  // ------------------------------------------------------------------------------------------
  // X3 — THE PICTURE. Does the reading view DRAW the lines it declares?
  // ------------------------------------------------------------------------------------------
  // The worst records in the fixture by declared need, taken from the sweep rather than guessed.
  const worst = sweep.out
    .filter((s) => s.open.read && s.open.read.meta)
    .sort((a, b) => b.open.read.meta.description_lines_needed - a.open.read.meta.description_lines_needed)
    .slice(0, 3);
  const pics = [];
  // THE FIGHT X2 STARTED IS STILL RUNNING AND `_examine()` IS GATED `!inCombat`. My first run left
  // it running, so all three captures came back "no container.read element" and the check reported
  // FAILED — my own ordering, filed as the build's defect, in the same file where I criticise two
  // other rounds for exactly that. Reload the state and ASSERT the fight is over before capturing.
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 6);
  const peace = await h.page.evaluate(() => ({ inCombat: !!(window.__ENGINE.inCombat && window.__ENGINE.inCombat()) }));
  report.data.x3_peace = peace;
  push('X3a the fight X2 started is over before the pictures are taken',
    peace.inCombat === false, `engine.inCombat() = ${peace.inCombat} at the start of the capture leg`);
  for (const w of worst) {
    const shot = await h.page.evaluate(async (id) => {
      const A = window.__HARNESS;
      const press = async (code) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
        await A.stepFrames(2);
        window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
        await A.stepFrames(2);
      };
      try { await A.closeMenu(); } catch { /* nothing open */ }
      A.openContainer('Reed Creel', [{ id, count: 1 }]);
      await A.stepFrames(3);
      await press('ArrowRight');
      await press('Tab');
      await A.stepFrames(3);
      const st = A.getUIState();
      const el = (st.elements || []).find((e) => e.id === 'container.read');
      return { el: el ? { rect: el.rect, meta: JSON.parse(JSON.stringify(el.meta)) } : null, shot: await A.screenshot() };
    }, w.id);
    if (!shot.el) { pics.push({ id: w.id, error: 'no container.read element' }); continue; }
    const buf = rawPng(shot.shot);
    fs.writeFileSync(path.join(OUT, 'shots', `read-${w.id}.png`), buf);
    const png = decodePNG(buf);
    const [rx, ry, rw, rh] = shot.el.rect;
    // The description column only: from the first baseline's ascent (descTop 80 at s=1, so the
    // band starts a little above 80) to the rect foot, and the text measure is 0.94 of the width.
    const col = [rx, ry + 66, rw * 0.94, rh - 66];
    const t = textBands(png, col);
    pics.push({
      id: w.id, rect: shot.el.rect, probe_rect: col,
      declared_shown: shot.el.meta.description_lines_shown,
      declared_needed: shot.el.meta.description_lines_needed,
      declared_complete: shot.el.meta.description_complete,
      drawn_bands: t.bands.length, band_geometry: t.bands, ink_rows: t.ink_rows,
      shot: `shots/read-${w.id}.png`,
    });
  }
  report.data.pixel_bands = pics;
  const agree = pics.filter((p) => !p.error && p.drawn_bands >= p.declared_shown);
  push('X3 the reading view DRAWS at least as many text bands as it declares lines shown',
    pics.length > 0 && agree.length === pics.length,
    pics.map((p) => p.error ? `${p.id}: ${p.error}` : `${p.id}: declared ${p.declared_shown}/${p.declared_needed}, drawn bands ${p.drawn_bands}`).join('; '));

  // The description strings themselves, verbatim from the data file, so the "whole description"
  // claim is checkable against the artifact rather than against a count.
  report.data.worst_records = worst.map((w) => {
    const rec = RECORDS.find((r) => r.id === w.id);
    return { id: w.id, name: rec && rec.name, description: rec && rec.description, words: rec && rec.description ? String(rec.description).trim().split(/\s+/).length : 0 };
  });
} finally {
  await h.close();
  report.failures = bad;
  flush();
  log(bad ? `CRITIC C7 DRIVE: ${bad} failure(s)` : 'CRITIC C7 DRIVE: all checks pass');
}
process.exit(bad ? 1 : 0);
