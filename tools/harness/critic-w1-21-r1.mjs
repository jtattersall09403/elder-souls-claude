#!/usr/bin/env node
// critic-w1-21-r1.mjs — the W1-21 round-1 CRITIC's own instrument.
//
// Written by the critic, not by the builder. Declared in orchestration/status/critic-w1-21.json.
//
// It asks five things the piece's own tools do not ask, in this order:
//
//   A  AR-2 / S35 ON THE MAP SCREEN. The map is the surface S35 defines by what it refuses, and
//      it did not exist when W1-21's detectors were written. NONE of ui-layer, ui-metrics,
//      ui-forbidden, ui-census or marker-diff ever opens it. So: open it, read every element it
//      declares, and apply the amended JU8 row (AMENDMENT-W1-MAP-01 §3a) to what is on screen.
//
//   B  THE MARKER ATTACK, INDEPENDENTLY. `tryPlaceMapMarker` is the BUILDER's attack list, so it
//      is evidence about the builder's imagination. This runs a different one: enumerate the
//      discovery model's own methods and their arity from the prototype (not from a list), then
//      go at the one mutator that DOES take a parameter and is not in the builder's list —
//      `restore(blob)` — through the save door, which is the route a hostile actor has.
//
//   C  THE PAUSED-SCREEN REDRAW, AT THE MODEL RATHER THAN THE FOCUS. W1-MAP found that no press
//      on a paused screen redrew anything and fixed it by adding `focusSignature` to the layout
//      cache key. But `Engine._afterStep()` applies `ui.pending` ON PAUSED FRAMES — using a
//      potion, transferring an item, spending souls — and those change the MODEL without moving
//      the focus. The cache key still has no term for that. Driven through the REAL input
//      pipeline (`queueInputs` at `f: 0`, because a frozen frame can never satisfy `f >= 1`).
//
//   D  THE BOOK'S OWN END, at two resolutions, through real input. RI-UIX05 T8.
//
//   E  DOES THE PICTURE AGREE WITH THE REGISTER. Every claim above is taken off `getUIState()`,
//      which is a self-report. So the map screen is also read back out of the FRAMEBUFFER: how
//      much of the drawing box is undiscovered ground, and does that number move when the model
//      does. A blank shot and a working shot are both "a PNG arrived".
//
// USAGE  node tools/harness/critic-w1-21-r1.mjs [--json <path>] [--width 1280] [--height 720]
// EXIT   0 = every assertion held · 1 = at least one failed · 2 = could not measure
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-21-r1.mjs — the W1-21 critic's own instrument (A..E).`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const W = Number(args.width || 1280), H = Number(args.height || 720);
const RUN = path.join(RUNS_DIR, String(args.out || 'CRITIC-W1-21-R1'));
ensureDir(RUN);
const decode = (u) => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'));

const out = {
  probe: 'critic-w1-21-r1',
  at: new Date().toISOString(),
  viewport: [W, H],
  loadavg: fs.readFileSync('/proc/loadavg', 'utf8').trim(),
  checks: [],
};
const push = (id, what, ok, detail) => {
  out.checks.push({ id, what, result: ok ? 'pass' : 'fail', detail });
  say(`${ok ? 'ok  ' : 'FAIL'} ${id}  ${what}  — ${detail}`);
};

const h = await launchGame({ ...args, width: W, height: H, timeout: 240000 });
try {
  await h.h('setRenderRate', 0);
  await h.h('setSeed', 1337);
  // `ui-journal` sets `env.interior = 'thorn-hall'` and Discovery is SUSPENDED in interiors by
  // design, so the exterior states are the only place the map can be judged. My first run used
  // it and recorded zero cells; that was my instrument, not the build, and it is recorded here
  // rather than deleted.
  await h.h('loadState', 'default');
  await h.h('stepFrames', 4);

  // ------------------------------------------------------------------ A: the map screen, judged
  // Walk the body to real place centres first, so there is something on the map to judge. The
  // site list comes from the world, not from a number typed here.
  const sites = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    return (eng.data.pois.pois || []).slice(0, 14).map((p) => ({ id: p.id, pos: p.pos }));
  });
  // `teleport(x, z, opts)` — TWO coordinates and an options object. Passing (x, y, z) puts the
  // body at z = the ground height and hands the real z in as `opts`. It cost me a run.
  for (const s of sites) {
    await h.h('teleport', s.pos[0], s.pos[2], {});
    await h.h('stepFrames', 3);
  }
  const walked = await h.h('mapState');
  push('A0', 'the body walked and the SHIPPED model recorded it (not a probe-built one)',
    walked.revealed_cells > 0 && walked.places.length > 0,
    `revealed_cells=${walked.revealed_cells} places=${walked.places.length}`);

  await h.h('openMenu', 'map');
  await h.h('stepFrames', 1);
  const uiMap = await h.h('getUIState');
  out.map_ui = { mode: uiMap.mode, navigable: uiMap.navigable, elements: uiMap.elements.map((e) => ({ id: e.id, kind: e.kind, text: e.text || null, meta: e.meta || null })) };

  // JU8 (amended) assertion 1 — journal and map are never adjacent, in either direction.
  const navMap = uiMap.navigable || [];
  await h.h('closeMenu');
  await h.h('openMenu', 'journal');
  const navJournal = (await h.h('getUIState')).navigable || [];
  await h.h('closeMenu');
  await h.h('openMenu', 'map');
  await h.h('stepFrames', 1);
  push('A1', 'JU8-amended: journal cannot reach map and map cannot reach journal',
    navJournal.indexOf('map') < 0 && navMap.indexOf('journal') < 0,
    `navigable(journal)=[${navJournal}] navigable(map)=[${navMap}]`);

  // JU8 (amended) assertions 2-5, applied to what the screen DECLARES.
  const FORBIDDEN_KIND = /^(quest_marker|waypoint|map_pin|minimap|objective_tracker|compass|route|path|trail)$/;
  const IDENTITY_KEY = /^(quest|objective|giver|target|rumour|rumor|destination|route|travel|distance|bearing|heading)$/;
  const NUMERALS = /\d/;
  const bad = { kind: [], identity: [], numeral: [], travel: [] };
  // THE MAP SCREEN'S OWN ELEMENTS. The HUD is drawn behind every screen (deliberately — opening
  // the inventory mid-fight must not hide your health), so sweeping every element would score
  // `hud.heal`'s estus count against the map. It did, on the first run.
  const mapEls = uiMap.elements.filter((e) => /^map\./.test(String(e.id)));
  out.map_element_count = mapEls.length;
  for (const e of mapEls) {
    if (FORBIDDEN_KIND.test(String(e.kind))) bad.kind.push(e.id + ':' + e.kind);
    for (const [k, v] of Object.entries(e.meta || {})) {
      if (IDENTITY_KEY.test(k) && v !== null && v !== false && v !== 0) bad.identity.push(`${e.id}.${k}=${JSON.stringify(v)}`);
    }
    if (e.text && NUMERALS.test(String(e.text))) bad.numeral.push(`${e.id}: ${e.text}`);
  }
  push('A2', 'map screen declares no forbidden kind', bad.kind.length === 0, JSON.stringify(bad.kind));
  push('A3', 'no element carries a quest/objective/giver/target/route/travel identity',
    bad.identity.length === 0, JSON.stringify(bad.identity));
  push('A4', 'no numeral is drawn on the map (S35: no distance or direction readout)',
    bad.numeral.length === 0, JSON.stringify(bad.numeral));

  // JU8 (amended) assertion: no square for a place the player has not stood in.
  const drawnPlaces = uiMap.elements.filter((e) => e.kind === 'map_place' && /^map\.place\./.test(e.id))
    .map((e) => e.id.replace('map.place.', ''));
  const stood = new Set(walked.places);
  const phantom = drawnPlaces.filter((p) => !stood.has(p));
  push('A5', 'no square drawn for a place the body has not stood in',
    phantom.length === 0, `drawn=${drawnPlaces.length} stood_in=${stood.size} phantom=${JSON.stringify(phantom)}`);

  // ------------------------------------------------------------------ B: the marker attack
  const attack = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const d = eng.sim.discovery;
    const res = { arity: [], attempts: [] };
    // Enumerate from the PROTOTYPE rather than from a list, so a mutator nobody remembered is
    // still counted. A getter is not a mutator and is recorded as such.
    const proto = Object.getPrototypeOf(d);
    for (const k of Object.getOwnPropertyNames(proto)) {
      if (k === 'constructor') continue;
      const desc = Object.getOwnPropertyDescriptor(proto, k);
      if (desc.get) { res.arity.push({ name: k, sort: 'getter', length: 0 }); continue; }
      if (typeof desc.value === 'function') res.arity.push({ name: k, sort: 'method', length: desc.value.length });
    }
    const attempt = (what, fn) => {
      try { const r = fn(); res.attempts.push({ what, threw: false, result: r === undefined ? null : JSON.stringify(r).slice(0, 200) }); }
      catch (e) { res.attempts.push({ what, threw: true, error: `${e.constructor.name}: ${e.message}`.slice(0, 200) }); }
    };
    // The routes the builder's own tryPlaceMapMarker already covers are skipped; these are the
    // ones it does not.
    attempt('discovery.observe.call({...forged sim})', () => d.observe.call({ sim: null }));
    attempt('Object.assign(discovery, {placeSet:new Set([...])})', () => { Object.assign(d, { placeSet: new Set(['stormhold']) }); return d.hasPlace('stormhold'); });
    attempt('Reflect.set(discovery, "reveal", fn)', () => Reflect.set(d, 'reveal', () => {}));
    attempt('Object.setPrototypeOf(discovery, {...})', () => Object.setPrototypeOf(d, Object.create(proto)));
    // THE ONE MUTATOR WITH A PARAMETER, and it names places by id. Forge a save blob whose
    // raster is all ones (so every place's own corroboration test passes) and whose place list
    // is every place in the world, then hand it to the live model through restore().
    attempt('discovery.restore(forged blob: raster all-ones + every place id)', () => {
      const ids = (eng.data.pois.pois || []).map((p) => p.id);
      const bytes = new Uint8Array(Math.ceil((d.cols * d.rows) / 8)).fill(255);
      let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      const r = d.restore({ cells: btoa(s), places: ids, revealed: d.cols * d.rows });
      return { dropped: r.dropped.length, places_now: d.places().length, revealed_now: d.revealedCells };
    });
    res.after_restore = { places: d.places().length, revealed: d.revealedCells, frac: d.revealedFrac };
    return res;
  });
  out.attack = attack;
  // A READER with a parameter is not what §3b is about — `seenAt(x, z)` answers a question and
  // changes nothing. The clause is about MUTATORS, so classify by what the method does to the
  // object rather than by its name: the mutators are the ones that write state.
  const MUTATORS = new Set(['observe', 'suspend', 'resume', 'restore']);
  const mutatorsWithArgs = attack.arity.filter((a) => a.sort === 'method' && MUTATORS.has(a.name) && a.length > 0);
  out.mutator_arity = attack.arity.filter((a) => MUTATORS.has(a.name));
  push('B1', 'AMENDMENT §3b: every MUTATING method on the discovery model has arity 0',
    mutatorsWithArgs.length === 0,
    `mutators with parameters: ${JSON.stringify(mutatorsWithArgs)}; all mutators: ${JSON.stringify(out.mutator_arity)}`);
  const restored = attack.attempts.find((a) => /restore\(forged/.test(a.what));
  push('B2', 'a forged discovery blob cannot name places the body never stood in',
    !!(restored && restored.threw),
    `restore attempt: ${restored ? (restored.threw ? restored.error : 'ACCEPTED ' + restored.result) : 'not run'}`);

  // Did the forged blob reach the SCREEN? This is the question that matters: a model change
  // nobody draws is not a marker.
  await h.h('closeMenu');
  await h.h('openMenu', 'map');
  await h.h('stepFrames', 1);
  const uiAfter = await h.h('getUIState');
  const drawnAfter = uiAfter.elements.filter((e) => e.kind === 'map_place' && /^map\.place\./.test(e.id))
    .map((e) => e.id.replace('map.place.', ''));
  const forgedOnScreen = drawnAfter.filter((p) => !stood.has(p));
  out.forged_on_screen = forgedOnScreen;
  push('B3', 'THE MARKER TEST: a forged blob puts no place-square on the drawn map',
    forgedOnScreen.length === 0,
    `${drawnAfter.length} squares drawn, ${forgedOnScreen.length} of them for places never stood in: ${JSON.stringify(forgedOnScreen.slice(0, 8))}`);

  const shotForged = decode(await h.h('screenshot'));
  fs.writeFileSync(path.join(RUN, 'map-after-forged-restore.png'), PNG.sync.write(shotForged));

  // ------------------------------------------------------------------ E: picture vs register
  // Read the drawing box out of the framebuffer. `undiscovered_hex` is #0B0A09; count how much
  // of the terrain element's rect is still that colour. If the register says 8% revealed and the
  // picture is 100% painted, the register is not what a player sees.
  const terrainEl = uiAfter.elements.find((e) => e.id === 'map.terrain');
  const pixelStats = (png, rect) => {
    const [x0, y0, w, h2] = rect.map((v) => Math.round(v));
    let und = 0, tot = 0;
    for (let y = y0; y < Math.min(png.height, y0 + h2); y++) {
      for (let x = x0; x < Math.min(png.width, x0 + w); x++) {
        const o = (y * png.width + x) * 4;
        const r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
        tot++;
        if (Math.abs(r - 0x0b) <= 3 && Math.abs(g - 0x0a) <= 3 && Math.abs(b - 0x09) <= 3) und++;
      }
    }
    return { total: tot, undiscovered: und, painted_frac: tot ? +(1 - und / tot).toFixed(4) : null };
  };
  out.picture_after_forged = terrainEl ? pixelStats(shotForged, terrainEl.rect) : null;
  out.register_after_forged = terrainEl ? terrainEl.meta : null;
  push('E1', 'the map picture is not blank — the frame contains its subject',
    !!(out.picture_after_forged && out.picture_after_forged.painted_frac > 0.01),
    `painted_frac=${out.picture_after_forged && out.picture_after_forged.painted_frac}`);

  // ------------------------------------------------------------------ C: paused-screen redraw
  //
  // Reset the world first: the forged restore above is a deliberately corrupted model.
  await h.h('closeMenu');
  await h.h('loadState', 'ui-journal');
  await h.h('stepFrames', 4);

  // f:0 ONLY. While a menu is open and the world is paused, `sim.frame` is frozen, and
  // `pipeline.latchForStep` fires a scripted event when `e.f + scriptBase === frame`, with
  // scriptBase taken at the queueInputs call. Any f >= 1 is therefore unreachable — W1-MAP
  // found this and it is the reason both this probe and map-probe look the way they do.
  const drivePress = async (name) => {
    await h.h('queueInputs', [{ f: 0, press: [name], release: [name] }]);
    await h.h('stepFrames', 1);
  };
  // The list axis is the STICK, not a button: `UISystem.step` reads `input.moveX/moveY` and
  // `_edge()` only fires when the axis CHANGES, so the stick has to return to centre between
  // moves. A held stick repeats on a frame count, and the frame is frozen, so it never repeats.
  const driveMove = async (dx, dy) => {
    await h.h('queueInputs', [{ f: 0, move: [dx, dy] }]);
    await h.h('stepFrames', 1);
    await h.h('queueInputs', [{ f: 0, move: [0, 0] }]);
    await h.h('stepFrames', 1);
  };
  const drive = async (presses) => { for (const p of presses) await drivePress(p); };
  const sig = (els) => JSON.stringify(els.map((e) => [e.id, e.text || null, e.focused || false, (e.rect || []).map((v) => Math.round(v))]));

  await h.h('openMenu', 'inventory');
  await h.h('stepFrames', 1);
  const invBefore = await h.h('getUIState');
  const frameAtOpen = await h.h('getFrame');

  // C1 — the fix W1-MAP landed: a focus move through the real pipeline redraws.
  await driveMove(0, -1);
  await driveMove(0, -1);
  const invMoved = await h.h('getUIState');
  const focusMoved = JSON.stringify(invBefore.focus) !== JSON.stringify(invMoved.focus);
  push('C1', 'focus moved by a real button press on a paused screen redraws the layout',
    focusMoved && sig(invBefore.elements) !== sig(invMoved.elements),
    `focus_moved=${focusMoved} layout_changed=${sig(invBefore.elements) !== sig(invMoved.elements)} frame=${frameAtOpen}->${await h.h('getFrame')}`);

  // C2 — THE MODEL, not the focus. Find a consumable, select it, use it through the pipeline,
  // and compare the inventory the simulation holds against the inventory the screen drew.
  const consumable = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const row = (eng.sim.inventory || []).find((r) => (r.count || 1) > 1);
    return row ? { id: row.id, count: row.count } : null;
  });
  if (!consumable) {
    push('C2', 'a stacked consumable exists to use on the paused screen', false, 'none found in ui-journal');
  } else {
    // Point the cursor at it through the harness (this is setup, not the measurement), then
    // press confirm through the REAL pipeline and let the paused step apply the pending action.
    const placed = await h.page.evaluate((id) => {
      const eng = window.__ENGINE;
      const ui = eng.ui;
      ui.focus.inventory.tagIdx = 0;
      const rows = ui._invRows(eng._uiCtx());
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return null;
      ui.focus.inventory.rowIdx = i; ui.focus.inventory.col = 1;
      return { i, rows: rows.length };
    }, consumable.id);
    await h.h('uiFocus', {});                       // force one clean build at the new focus
    await h.h('stepFrames', 1);
    const beforeUse = await h.h('getUIState');
    const beforeCount = await h.page.evaluate((id) => {
      const r = (window.__ENGINE.sim.inventory || []).find((q) => q.id === id); return r ? r.count : null;
    }, consumable.id);
    await drive(['interact']);                      // confirm — `use`
    await h.h('stepFrames', 2);                     // paused frames; _afterStep still applies pending
    const afterCount = await h.page.evaluate((id) => {
      const r = (window.__ENGINE.sim.inventory || []).find((q) => q.id === id); return r ? r.count : 0;
    }, consumable.id);
    // Read the DRAWN elements without forcing a build — this is exactly what the renderer would
    // put on the glass on the next frame.
    const drawnAfterUse = await h.page.evaluate(() => {
      const S = window.__ENGINE.renderer.menus;
      return S.elements.map((e) => [e.id, e.text || null]);
    });
    const drawnBefore = await h.page.evaluate(() => null);   // placeholder, see beforeUse
    out.paused_model = {
      item: consumable.id, model_count_before: beforeCount, model_count_after: afterCount,
      placed,
      drawn_row_after: (drawnAfterUse.find((e) => String(e[0]).includes(consumable.id)) || [null, null])[1],
      ui_row_before: (beforeUse.elements.find((e) => String(e.id).includes(consumable.id)) || {}).text || null,
      frame: await h.h('getFrame'),
    };
    const modelChanged = beforeCount !== null && afterCount !== beforeCount;
    const drawnRow = out.paused_model.drawn_row_after;
    const rowBefore = out.paused_model.ui_row_before;
    push('C2a', 'using an item on a paused screen changes the simulation model',
      modelChanged, `${consumable.id} count ${beforeCount} -> ${afterCount}`);
    push('C2b', 'and the DRAWN row changes with it (no stale screen)',
      !modelChanged || drawnRow !== rowBefore,
      `drawn row before="${rowBefore}" after="${drawnRow}"`);
    void drawnBefore;
  }

  // ------------------------------------------------------------------ D: the book's own end
  await h.h('closeMenu');
  const bookId = String(args.book || 'pilots-chart-book');
  const readBook = async () => {
    await h.h('openMenu', 'book', { id: bookId });
    await h.h('stepFrames', 1);
    const st = await h.h('getUIState');
    return st.book || null;
  };
  const b0 = await readBook();
  for (let i = 0; i < 40; i++) await driveMove(1, 0);
  const b1 = await h.h('getUIState');
  out.book = { at_open: b0, after_40_rights: b1.book || null };
  const bk = b1.book || {};
  const lastSpread = bk.spreads !== undefined ? bk.spreads - 1 : (bk.pages !== undefined ? Math.ceil(bk.pages / 2) - 1 : null);
  push('D1', 'holding right cannot walk the book past its own last spread',
    lastSpread === null ? false : bk.page <= lastSpread,
    `page=${bk.page} pages=${bk.pages} spreads=${bk.spreads} last_spread=${lastSpread}`);
  await h.h('closeMenu');
} catch (e) {
  out.error = `${e.constructor.name}: ${e.message}`;
  say('ERROR ' + out.error);
} finally {
  await h.close();
}

out.failed = out.checks.filter((c) => c.result === 'fail').map((c) => c.id);
writeJson(path.join(RUN, 'critic-w1-21-r1.json'), out);
if (args.json) writeJson(String(args.json), out);
say(`\n${out.checks.length - out.failed.length}/${out.checks.length} passed; failed: [${out.failed}]`);
say(`artifacts: ${RUN}`);
process.exit(out.error ? 2 : (out.failed.length ? 1 : 0));
