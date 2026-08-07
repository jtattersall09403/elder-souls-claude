#!/usr/bin/env node
// critic-w1-21-r1b.mjs — the W1-21 round-1 CRITIC's second pass. Three questions, each of which
// the first pass raised and could not settle.
//
// F — THE SAVE DOOR, WHICH IS NOT AN IN-PAGE CALL. Pass A got a square onto the map for 28
//     places the body never stood in by calling `Discovery.restore()` directly. A reader can
//     fairly answer "so can anything holding the sim". So do it the ordinary way instead:
//     `saveState()`, edit the blob, `loadState()`. `map-probe.mjs` L3 forges the PLACE LIST and
//     leaves the raster honest, and the load audit drops the places because the raster does not
//     corroborate them. But the raster is in the same blob. Forge both.
//
// G — THE BUILD'S OWN STRUCTURAL SELF-REPORT. `getUIState().map.mutator_arities` is the evidence
//     AMENDMENT-W1-MAP-01 §3b tells a critic to read "from the running object so a critic does
//     not have to take the source file's word for it". Compare it against the object's actual
//     prototype. A register and an enumeration are not the same thing.
//
// H — THE STALE PAUSED SCREEN, IN PIXELS. Pass C read the drawn element list, which is still a
//     register. So: screenshot the paused inventory, use an item through the real input pipeline,
//     screenshot again, and count differing pixels. Then close and reopen the screen (which
//     forces a build) and screenshot a third time. If A==B and B!=C, the model changed, the
//     player saw nothing, and the only thing that repainted it was closing the screen.
//
//     Plus the CONTROL: the same three shots around a FOCUS move, which W1-MAP's fix does cover.
//     A probe that cannot tell a repainting screen from a frozen one proves nothing.
//
// I — THE BOOK, correctly this time. Pass D compared `getUIState().book.page` — which is the
//     LEFT PAGE NUMBER, `spread * 2 + 1` — against a spread index. Over-turn the LONGEST book at
//     the SMALLEST viewport, where the spread count is lowest and the old defect was worst.
//
// USAGE  node tools/harness/critic-w1-21-r1b.mjs [--width 1024] [--height 576]
// EXIT   0 = every assertion held · 1 = at least one failed · 2 = could not measure
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-21-r1b.mjs — the W1-21 critic's second pass (F..I).`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const W = Number(args.width || 1280), H = Number(args.height || 720);
const RUN = path.join(RUNS_DIR, String(args.out || 'CRITIC-W1-21-R1B'));
ensureDir(RUN);
const decode = (u) => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'));
const diffPx = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 2 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 2
      || Math.abs(a.data[i + 2] - b.data[i + 2]) > 2) n++;
  }
  return n;
};

const out = {
  probe: 'critic-w1-21-r1b', at: new Date().toISOString(), viewport: [W, H],
  loadavg: fs.readFileSync('/proc/loadavg', 'utf8').trim(), checks: [],
};
const push = (id, what, ok, detail) => {
  out.checks.push({ id, what, result: ok ? 'pass' : 'fail', detail });
  say(`${ok ? 'ok  ' : 'FAIL'} ${id}  ${what}  — ${detail}`);
};

const h = await launchGame({ ...args, width: W, height: H, timeout: 240000 });
try {
  await h.h('setRenderRate', 0);
  await h.h('setSeed', 1337);
  await h.h('loadState', 'default');
  await h.h('stepFrames', 4);

  // =============================================================== F: the save door
  const sites = await h.page.evaluate(() => (window.__ENGINE.data.pois.pois || []).slice(0, 6).map((p) => ({ id: p.id, pos: p.pos })));
  for (const s of sites) { await h.h('teleport', s.pos[0], s.pos[2], {}); await h.h('stepFrames', 3); }
  const honestState = await h.h('mapState');

  const forge = await h.page.evaluate(() => {
    const H2 = window.__HARNESS;
    const eng = window.__ENGINE;
    const blob = H2.saveState();
    const d = eng.sim.discovery;
    const before = { places: d.places().length, revealed: d.revealedCells };
    // The forgery map-probe L3 does not do: forge the RASTER TOO. The load audit corroborates a
    // named place against the raster in the SAME BLOB, so an attacker who controls one controls
    // the other and the corroboration is a fixed-point test on its own input.
    const forged = JSON.parse(JSON.stringify(blob));
    const bytes = new Uint8Array(Math.ceil((d.cols * d.rows) / 8)).fill(255);
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    forged.world.discovery.cells = btoa(s);
    forged.world.discovery.places = (eng.data.pois.pois || []).map((p) => p.id);
    forged.world.discovery.revealed = d.cols * d.rows;
    H2.loadState(forged);
    const st = H2.mapState();
    return { before, dropped: st.dropped_on_load || [], after: { places: st.places.length, revealed: st.revealed_cells, list: st.places } };
  });
  out.forge = { honest: honestState, ...forge };
  push('F1', 'a forged SAVE (raster + place list) is refused by the live-world load audit',
    forge.dropped.length > 0 && forge.after.places <= honestState.places.length,
    `dropped=[${forge.dropped}] places ${honestState.places.length} -> ${forge.after.places}, revealed ${honestState.revealed_cells} -> ${forge.after.revealed}`);

  await h.h('openMenu', 'map');
  await h.h('stepFrames', 1);
  const uiForged = await h.h('getUIState');
  const drawn = uiForged.elements.filter((e) => e.kind === 'map_place' && /^map\.place\./.test(e.id)).map((e) => e.id.replace('map.place.', ''));
  const stood = new Set(honestState.places);
  const phantom = drawn.filter((p) => !stood.has(p));
  out.forged_screen = { drawn: drawn.length, phantom: phantom.length, phantom_ids: phantom.slice(0, 10), map_report: uiForged.map };
  push('F2', 'and no square for an unvisited place reaches the DRAWN map after that load',
    phantom.length === 0, `${drawn.length} squares drawn, ${phantom.length} of them phantom: ${JSON.stringify(phantom.slice(0, 8))}`);
  const shotForged = decode(await h.h('screenshot'));
  fs.writeFileSync(path.join(RUN, 'map-forged-save.png'), PNG.sync.write(shotForged));
  push('F3', "and the screen's own report says so: map.places_drawn == places_discovered by standing",
    (uiForged.map || {}).places_drawn === honestState.places.length,
    `places_drawn=${(uiForged.map || {}).places_drawn} places_discovered=${(uiForged.map || {}).places_discovered} stood_in=${honestState.places.length}`);
  await h.h('closeMenu');

  // =============================================================== G: register vs enumeration
  const g = await h.page.evaluate(() => {
    const d = window.__ENGINE.sim.discovery;
    const proto = Object.getPrototypeOf(d);
    const methods = {};
    for (const k of Object.getOwnPropertyNames(proto)) {
      if (k === 'constructor') continue;
      const desc = Object.getOwnPropertyDescriptor(proto, k);
      if (typeof desc.value === 'function') methods[k] = desc.value.length;
    }
    return { methods, reported: window.__HARNESS.getUIState().map.mutator_arities };
  });
  out.arity = g;
  const reportedNames = Object.keys(g.reported || {});
  // A mutator is a method that writes the object's state. `restore` is one: it clears the
  // raster, refills it and rebuilds the place list.
  const actualMutators = ['observe', 'suspend', 'resume', 'restore'].filter((k) => k in g.methods);
  const missing = actualMutators.filter((k) => !reportedNames.includes(k));
  push('G1', 'the build\'s mutator_arities report enumerates every mutator the object has',
    missing.length === 0,
    `reported=[${reportedNames}] actual mutators=[${actualMutators}] missing from the report=[${missing}]`);
  push('G2', 'and every mutator it omits also has arity 0',
    missing.every((k) => g.methods[k] === 0),
    missing.map((k) => `${k}/${g.methods[k]}`).join(',') || 'nothing omitted');

  // =============================================================== H: the stale screen, in pixels
  await h.h('loadState', 'ui-journal');
  await h.h('stepFrames', 4);
  const drivePress = async (name) => {
    await h.h('queueInputs', [{ f: 0, press: [name], release: [name] }]);
    await h.h('stepFrames', 1);
  };
  const driveMove = async (dx, dy) => {
    await h.h('queueInputs', [{ f: 0, move: [dx, dy] }]); await h.h('stepFrames', 1);
    await h.h('queueInputs', [{ f: 0, move: [0, 0] }]); await h.h('stepFrames', 1);
  };
  const shoot = async (name) => {
    await h.h('renderFrame');
    const png = decode(await h.h('screenshot'));
    fs.writeFileSync(path.join(RUN, name + '.png'), PNG.sync.write(png));
    return png;
  };

  await h.h('openMenu', 'inventory');
  await h.h('stepFrames', 1);

  // CONTROL FIRST. A focus move is what W1-MAP's fix covers; if this does not move pixels the
  // probe is broken and nothing below it means anything.
  const ctlA = await shoot('H-control-a-before-focus-move');
  await driveMove(0, -1);
  const ctlB = await shoot('H-control-b-after-focus-move');
  const ctlDiff = diffPx(ctlA, ctlB);
  push('H0', 'CONTROL: a focus move on the paused screen moves pixels (the probe can see a repaint)',
    ctlDiff > 0, `${ctlDiff} differing pixels`);

  // Now the model. Select a stacked consumable and use it through the real pipeline.
  const consumable = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const ui = eng.ui;
    ui.focus.inventory.tagIdx = 0;
    const rows = ui._invRows(eng._uiCtx());
    const i = rows.findIndex((r) => (r.count || 1) > 2 && r.usable !== false);
    if (i < 0) return null;
    ui.focus.inventory.rowIdx = i; ui.focus.inventory.col = 1;
    return { id: rows[i].id, count: rows[i].count, row: i };
  });
  if (!consumable) {
    push('H1', 'a stacked consumable is selectable on the inventory screen', false, 'none found');
  } else {
    await h.h('uiFocus', {});                  // one clean forced build at the new focus
    await h.h('stepFrames', 1);
    const A = await shoot('H-a-before-use');
    const countBefore = await h.page.evaluate((id) => {
      const r = (window.__ENGINE.sim.inventory || []).find((q) => q.id === id); return r ? r.count : null;
    }, consumable.id);
    await drivePress('interact');              // confirm = use
    await h.h('stepFrames', 2);
    const countAfter = await h.page.evaluate((id) => {
      const r = (window.__ENGINE.sim.inventory || []).find((q) => q.id === id); return r ? r.count : 0;
    }, consumable.id);
    const B = await shoot('H-b-after-use-screen-still-open');
    // Third shot: close and reopen, which forces a build. This separates "the model did not
    // change" from "the model changed and the screen did not repaint".
    await h.h('closeMenu');
    await h.h('openMenu', 'inventory');
    await h.h('stepFrames', 1);
    const C = await shoot('H-c-after-reopening-the-screen');
    const ab = diffPx(A, B), bc = diffPx(B, C);
    out.paused_pixels = { item: consumable.id, count_before: countBefore, count_after: countAfter, diff_a_b: ab, diff_b_c: bc, control_diff: ctlDiff };
    push('H1', 'using an item on the paused screen changes the model',
      countBefore !== null && countAfter !== countBefore, `${consumable.id} ${countBefore} -> ${countAfter}`);
    push('H2', 'and the PLAYER SEES it: the frame changes when the model does',
      ab > 0, `${ab} pixels differ between the frame before the use and the frame after it`);
    push('H3', 'and closing and reopening the screen is not what repaints it',
      bc === 0, `${bc} pixels differ between the still-open frame and the reopened one`);
  }
  await h.h('closeMenu');

  // =============================================================== I: the book, correctly
  const books = await h.page.evaluate(() => {
    // `engine.data.books` is the RAW loaded file bucket (an object of docs, each of which may
    // hold a `books` array); the UI's own Map is `engine.ui.data.books`. Use the UI's, because
    // that is the set the book screen can actually open.
    const bs = [...window.__ENGINE.ui.data.books.values()];
    return bs.map((b) => ({ id: b.id, len: (b.text || '').length })).sort((a, b) => b.len - a.len);
  });
  const bookId = books[0].id;
  await h.h('openMenu', 'book', { id: bookId });
  await h.h('stepFrames', 1);
  const bk0 = (await h.h('getUIState')).book;
  for (let i = 0; i < 60; i++) await driveMove(1, 0);
  const bk1 = (await h.h('getUIState')).book;
  out.book = { id: bookId, at_open: bk0, after_60_rights: bk1, all: books.slice(0, 3) };
  // `book.page` is the LEFT PAGE NUMBER (spread*2+1), so the last legal value is
  // (ceil(pages/2)-1)*2+1. Assert against that, not against a spread index.
  const lastLegalPage = (Math.ceil(bk1.pages / 2) - 1) * 2 + 1;
  push('I1', 'over-turning cannot walk the book past its own last spread',
    bk1.page <= lastLegalPage, `page=${bk1.page} pages=${bk1.pages} last_legal_page=${lastLegalPage} (book ${bookId})`);
  push('I2', 'and the page actually moved (the clamp is not just a frozen screen)',
    bk1.page > bk0.page || bk1.pages <= 2, `open at page ${bk0.page}, ended at ${bk1.page} of ${bk1.pages}`);
  await h.h('closeMenu');
} catch (e) {
  out.error = `${e.constructor.name}: ${e.message}`;
  say('ERROR ' + out.error + '\n' + (e.stack || ''));
} finally {
  await h.close();
}

out.failed = out.checks.filter((c) => c.result === 'fail').map((c) => c.id);
writeJson(path.join(RUN, 'critic-w1-21-r1b.json'), out);
say(`\n${out.checks.length - out.failed.length}/${out.checks.length} passed; failed: [${out.failed}]`);
say(`artifacts: ${RUN}`);
process.exit(out.error ? 2 : (out.failed.length ? 1 : 0));
