#!/usr/bin/env node
// map-probe.mjs — the evidence for W1-MAP: the discovery map (ARBITRATION seam S35).
//
// Two halves, and the second is the one S35 actually cares about.
//
//   C — CONSUMPTION (RI-MTH07, mandatory under ARBITRATION §3). Names the world-side consumer
//       and demonstrates it by perturbing the model and watching behaviour change. Twelve
//       subsystems in this project have shipped a data file nothing read; the test is not "does
//       the map look right", it is "does changing the model change the map".
//
//   D — THE HOSTILE ATTEMPT. AMENDMENT-W1-MAP-01 §3b: "Then attempt it: call the plausible
//       mutators by name, pass a place id, pass a coordinate, mutate the collections directly,
//       and add a method to the instance. Record each attempt and its failure. An implementation
//       that passes this by convention rather than by construction fails it."
//
// And one that is neither, and matters as much:
//
//   L — THE LIVE-WORLD LOAD AUDIT. The protocol's own warning is that a round trip which
//       re-serialises cannot see a field nobody reads back — the 7 KB discovery raster
//       round-trips byte-perfect whether or not anything loads it into the running world. So L
//       saves, loads, and then reads `H.mapState()`, which is the LIVE `Discovery` object the
//       screen draws from. It also forges a save and asserts the forgery is refused.
//
// SELF-TEST. `--break <what>` breaks the thing being measured on purpose and asserts the probe
// goes RED. A probe that cannot fail is worse than no probe (protocol, failure mode 2). Run
// `--break all` to see every assertion this tool is capable of failing.
//
//   node tools/harness/map-probe.mjs
//   node tools/harness/map-probe.mjs --json --out reports/runs/MAP
//   node tools/harness/map-probe.mjs --break discovery   # must print SELF-TEST OK
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
map-probe.mjs — consumption evidence and the hostile quest-marker attempt for the discovery map.

USAGE
  node tools/harness/map-probe.mjs [--break <what>] [--json] [--out <dir>]

OPTIONS
  --break <what>  Break the thing being measured and assert the probe goes red. One of:
                    discovery  stop the model recording      (C1, C4, L1 must fail)
                    radius     force the reveal radius to 0  (C1 must fail)
                    world      ignore the region palette     (C3 must fail)
                    all        run every break in sequence
  --entry <path>  HTML entry (default game/index.html)
  --out <dir>     Output directory (default reports/runs/MAP)
  --json          Print the report
  --help          This message

Exit 0 = every assertion passed (or, under --break, every expected assertion failed).
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'MAP');
ensureDir(outDir);
const breakWhat = args.break ? String(args.break) : null;
const breaks = breakWhat === 'all' ? ['discovery', 'radius', 'world'] : breakWhat ? [breakWhat] : [null];

const handle = await launchGame(args);
const reports = [];
try {
  for (const brk of breaks) {
    reports.push(await run(handle, brk));
  }
} finally {
  await handle.close();
}

async function run(h, brk) {
  return h.page.evaluate(async (breakMode) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);                       // protocol: never step with the renderer live
    const R = [];
    const A = (id, name, got, pass, target) => { R.push({ id, name, got: typeof got === 'object' ? JSON.stringify(got) : String(got), target, pass: !!pass }); return !!pass; };

    const eng = H._engine || window.__ENGINE || null;
    const sim = eng ? eng.sim : null;
    const d = sim ? sim.discovery : null;
    if (!d) return { fatal: 'sim.discovery does not exist — the model was never constructed', checks: [] };

    // ---- the break, applied BEFORE anything is measured -----------------------------------
    //
    // Each of these disconnects the model in a way the project has actually shipped before: a
    // system that is never stepped, a number that is read but has no effect, and a screen drawn
    // from an authored constant rather than from the world.
    const breakNote = { mode: breakMode || 'none' };
    if (breakMode === 'discovery') d.suspend();                    // the model stops recording
    if (breakMode === 'radius') { eng.data.mapUI.reveal.min_m = 0; eng.data.mapUI.reveal.max_m = 0; }
    if (breakMode === 'world') {
      // The defect C3 exists to catch is "the map is drawn from something other than the
      // province" — an authored image, a copied palette, a constant. The first version of this
      // break merely set the region palettes to grey, which is not a disconnection at all: the
      // screen went on reading `regions.json` faithfully and C3 stayed green, correctly. It was
      // the BREAK that was wrong, not the check. So the break now severs the actual link.
      const orig = eng.ui._mapModel.bind(eng.ui);
      eng.ui._mapModel = (ctx) => { const m = orig(ctx); m.cellHex = () => '#7A6A4A'; return m; };
    }

    const startPos = [...sim.player.pos];
    const walkTo = (x, z) => { H.teleport(x, z, {}); H.stepFrames(2); };

    // =========================================================================================
    // C — CONSUMPTION. The consumer is `game/src/ui/screens/map.js`, reached through
    // `UISystem._mapModel()`. Named, and then demonstrated.
    // =========================================================================================

    const uiMapAfter = (opts) => {
      H.openMenu('map', {});
      const st = H.getUIState();
      H.closeMenu();
      return st;
    };

    // ---- C1. Perturbing the RADIUS changes how much ground is revealed and drawn -----------
    //
    // The radius is not a constant in the screen: it is `regions.json sightline_m` clamped by
    // `game/data/ui/map.json`. Three settings, one walk each, from a clean model. If the drawn
    // area does not move with the number, the number has no consumer.
    const sweep = [];
    for (const maxR of [450, 150, 25]) {
      // A clean model each time. `restore(null)` clears without needing a mutator that names
      // anything — it is the save path, run with no save.
      d.restore(null);
      if (breakMode === 'radius') { eng.data.mapUI.reveal.min_m = 0; eng.data.mapUI.reveal.max_m = 0; }
      else { eng.data.mapUI.reveal.min_m = Math.min(40, maxR); eng.data.mapUI.reveal.max_m = maxR; }
      // The model reads the doc at CONSTRUCTION, so rebuild it the way the engine does. This is
      // the same constructor the game runs; nothing here is a scratch model.
      const Disc = d.constructor;
      const fresh = new Disc({ field: eng.field, player: sim.player, env: sim.env, doc: eng.data.mapUI, pois: eng.data.pois });
      sim.discovery = fresh;
      if (breakMode === 'discovery') fresh.suspend();
      // Walk a line across the salt hills — an open region, so the region's own sightline is
      // what the clamp is biting on rather than a canopy.
      for (let i = 0; i < 12; i++) walkTo(2000 + i * 120, 800);
      const st = uiMapAfter();
      sweep.push({ max_m: maxR, revealed: fresh.revealedCells, drawn: (st.map && st.map.drawn_cells) || 0 });
    }
    const monotone = sweep[0].revealed > sweep[1].revealed && sweep[1].revealed > sweep[2].revealed;
    A('C1', 'reveal radius is CONSUMED: 450 m > 150 m > 25 m revealed cells',
      sweep.map((s) => `${s.max_m}m:${s.revealed}`).join(' '), monotone, 'strictly decreasing');
    A('C1b', 'the SCREEN draws what the model revealed (drawn_cells tracks revealed_cells)',
      sweep.map((s) => `${s.drawn}/${s.revealed}`).join(' '),
      sweep.every((s) => s.revealed === 0 ? s.drawn === 0 : s.drawn > 0) && sweep[0].drawn > sweep[2].drawn,
      'drawn > 0 wherever revealed > 0, and falls with it');

    // Restore the shipped numbers and a fresh model for everything below.
    if (breakMode !== 'radius') { eng.data.mapUI.reveal.min_m = 40; eng.data.mapUI.reveal.max_m = 450; }
    const Disc = d.constructor;
    let D = new Disc({ field: eng.field, player: sim.player, env: sim.env, doc: eng.data.mapUI, pois: eng.data.pois });
    sim.discovery = D;
    if (breakMode === 'discovery') D.suspend();

    // ---- C2. The map is drawn from the WORLD, so moving a site moves the square ------------
    //
    // The point of C2 is the claim "the map cannot drift from the province". If the square is
    // drawn from an authored image or a copied coordinate list, moving the province leaves the
    // square where it was.
    const site = eng.field.sites.find((s) => s.id === 'stormhold');
    const home = { x: site.x, z: site.z };
    walkTo(home.x, home.z);
    H.openMenu('map', {});
    const before = H.getUIState().elements.find((e) => e.id === 'map.place.stormhold');
    H.closeMenu();
    site.x += 900; site.z += 600;                       // move the province
    D = new Disc({ field: eng.field, player: sim.player, env: sim.env, doc: eng.data.mapUI, pois: eng.data.pois });
    sim.discovery = D;
    if (breakMode === 'discovery') D.suspend();
    walkTo(site.x, site.z);
    H.openMenu('map', {});
    const after = H.getUIState().elements.find((e) => e.id === 'map.place.stormhold');
    H.closeMenu();
    site.x = home.x; site.z = home.z;                    // put the province back
    const moved = before && after && (Math.abs(before.rect[0] - after.rect[0]) > 4 || Math.abs(before.rect[1] - after.rect[1]) > 4);
    A('C2', 'the map is drawn from game/data/world/: moving a site moves its square',
      before && after ? `${before.rect[0].toFixed(1)},${before.rect[1].toFixed(1)} -> ${after.rect[0].toFixed(1)},${after.rect[1].toFixed(1)}` : 'square missing',
      moved, 'the drawn square follows the world data');

    // ---- C3. The terrain colour is the REGION's, not the screen's --------------------------
    D = new Disc({ field: eng.field, player: sim.player, env: sim.env, doc: eng.data.mapUI, pois: eng.data.pois });
    sim.discovery = D;
    if (breakMode === 'discovery') D.suspend();
    for (let i = 0; i < 8; i++) walkTo(2000 + i * 150, 800);
    // Real pixels off the interface's own 2D canvas — the bitmap `UISurface.render()` composites
    // as a textured quad, i.e. the thing the player sees. Read here rather than through
    // `H.screenshot()` because that forces a full SwiftShader render, and the protocol is
    // explicit that a stepping loop with the renderer live is the most expensive thing in this
    // project. The canvas IS the map's pixels; the WebGL pass only blits it.
    const inkOf = () => {
      H.openMenu('map', {});                            // openMenu forces a layout
      const cv = eng.ui.S.canvas, c2 = eng.ui.S.ctx;
      const box = eng.ui.S.elements.find((e) => e.kind === 'map_terrain').rect;
      const img = c2.getImageData(Math.round(box[0]), Math.round(box[1]),
        Math.max(1, Math.round(box[2])), Math.max(1, Math.round(box[3]))).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < img.length; i += 4) { r += img[i]; g += img[i + 1]; b += img[i + 2]; }
      H.closeMenu();
      return { r, g, b, w: cv.width };
    };
    const inkA = inkOf();
    const saved = eng.data.regions.regions.map((r) => r.palette_hex.slice());
    eng.data.regions.regions.forEach((r) => { r.palette_hex = ['#FF00FF', r.palette_hex[1], r.palette_hex[2]]; });
    eng.ui._mapShade = null;
    const inkB = inkOf();
    if (breakMode !== 'world') eng.data.regions.regions.forEach((r, i) => { r.palette_hex = saved[i]; });
    eng.ui._mapShade = null;
    // A MATERIAL change, not any change. The first version of this assertion was `!==`, and
    // under `--break world` it passed on a difference of 92 parts in 5.9 million — the panel's
    // procedural parchment texture and the label's antialiasing, not the terrain. A check that
    // a disconnected model can satisfy with rounding noise is not a check. Recolouring every
    // region to magenta moves the red channel by ~32%; the break moves it by 0.002%; the bar
    // is 5%, which is an order of magnitude clear of both.
    const rel = (a, b) => Math.abs(a - b) / Math.max(1, a);
    const worst = Math.max(rel(inkA.r, inkB.r), rel(inkA.g, inkB.g), rel(inkA.b, inkB.b));
    A('C3', 'terrain colour is CONSUMED from regions.json palette_hex — the PIXELS change',
      `RGB sum ${inkA.r},${inkA.g},${inkA.b} -> ${inkB.r},${inkB.g},${inkB.b} (worst channel ${(worst * 100).toFixed(3)}%)`,
      worst > 0.05, 'a channel moves by more than 5% when the region palette changes');

    // ---- C4. A place appears only after the body has been inside it ------------------------
    D = new Disc({ field: eng.field, player: sim.player, env: sim.env, doc: eng.data.mapUI, pois: eng.data.pois });
    sim.discovery = D;
    if (breakMode === 'discovery') D.suspend();
    const thorn = eng.field.sites.find((s) => s.id === 'thorn');
    // Stand OUTSIDE the built pad — just beyond r_flat, so "near" is genuinely not "in".
    walkTo(thorn.x + thorn.r_flat + 60, thorn.z);
    const outside = D.hasPlace('thorn');
    walkTo(thorn.x, thorn.z);
    const inside = D.hasPlace('thorn');
    A('C4', 'a place is discovered by STANDING IN IT, not by being near it',
      `outside pad: ${outside}, inside pad: ${inside}`, outside === false && inside === true,
      'false then true');

    // =========================================================================================
    // S — WHAT THE SCREEN REFUSES (the amended RI-UIX04 JU8)
    // =========================================================================================
    H.openMenu('map', {});
    const ui = H.getUIState();
    const els = ui.elements.filter((e) => e.id.startsWith('map.'));
    const m = ui.map;
    A('S1', 'the map exists and reports itself', `map_exists=${ui.map_exists} mode=${ui.mode}`,
      ui.map_exists === true && ui.mode === 'map', 'true / map');
    A('S2', 'no forbidden element kind anywhere on the screen',
      els.map((e) => e.kind).filter((k) => ['map', 'map_pin', 'minimap', 'compass', 'quest_marker', 'waypoint', 'objective_tracker'].includes(k)).join(',') || 'none',
      els.every((e) => ['map_terrain', 'map_place', 'map_player', 'panel', 'panel_header', 'divider', 'hint'].includes(e.kind)), 'none');
    A('S3', 'no element carries a quest, objective, giver, target or rumour identity',
      m.quest_bearing_elements.join(',') || 'none', m.quest_bearing_elements.length === 0, '0');
    A('S4', 'no route, path or line is drawn', `routes_drawn=${m.routes_drawn}`, m.routes_drawn === 0, '0');
    A('S5', 'no numeral is drawn anywhere on the map (no distance, bearing or coordinate)',
      m.numeric_text.join(',') || 'none', m.numeric_text.length === 0, '0');
    A('S6', 'no travel affordance', m.travel_affordances.join(',') || 'none', m.travel_affordances.length === 0, '0');
    A('S7', 'every drawn square is a place the body has stood in',
      `drawn ${m.places_drawn} / discovered ${m.places_discovered}`,
      m.places_drawn <= m.places_discovered, 'drawn <= discovered');
    A('S8', 'undiscovered is UNRENDERED — most of the province is not drawn',
      `${m.drawn_cells} of ${m.total_cells} cells`,
      m.total_cells > 0 && m.drawn_cells > 0 && m.drawn_cells < m.total_cells * 0.5,
      '0 < drawn < half the province');
    const navFromMap = ui.navigable;
    H.closeMenu();
    H.openMenu('journal', {});
    const navFromJournal = H.getUIState().navigable;
    H.closeMenu();
    A('S9', 'RI-UIX04 Q7 UNAMENDED: the journal cannot reach the map',
      navFromJournal.join(','), !navFromJournal.includes('map'), 'no `map`');
    A('S10', 'and the map cannot reach the journal either',
      navFromMap.join(','), !navFromMap.includes('journal'), 'no `journal`');

    // ---- S11. The local view exists and is a DIFFERENT view, not a relabelled one ----------
    //
    // S35 permits "a local view for the cell you are in". A local view that draws the same
    // thing as the province view with a different heading is the failure worth checking for,
    // so the assertion is on the drawn cell count: 500 m across at a 25 m raster is at most a
    // 21x21 window, against the whole province at 193x222.
    H.openMenu('map', {});
    const worldCells = H.getUIState().map.drawn_cells;
    // Through the REAL input path — a scripted `interact` press, latched inside the fixed step
    // exactly as a swing is — rather than by calling `UISystem._confirm()` directly. A probe
    // that reaches past the input layer cannot tell a bound button from an unbound one, which
    // is the difference between a view a player can reach and one only a critic can.
    // `f` is RELATIVE to the queueInputs call — `pipeline.js` stores the current frame as
    // `scriptBase` — so `f: getFrame()+1` schedules the press thousands of frames into the
    // future and the view never swaps. That is exactly how this check failed the first time,
    // and it failed CORRECTLY: the assertion caught its own driver.
    H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    H.stepFrames(5);
    const localSt = H.getUIState();
    const localCells = localSt.map.drawn_cells;
    A('S11', 'the LOCAL view is a real second view, not the province with a new heading',
      `view=${localSt.map.view}, cells ${worldCells} -> ${localCells}`,
      localSt.map.view === 'local' && localCells <= 21 * 21, 'local, and at most a 21x21 window');
    A('S11b', 'and confirm does NOT travel: the body has not moved',
      'no `pending` action was queued', eng.ui.pending === null || eng.ui.pending === undefined,
      'no queued action');
    eng.ui.focus.map.view = 'world';
    H.closeMenu();

    // ---- S12. THE AMENDMENT'S OWN APPENDIX TEST --------------------------------------------
    //
    // "Open the game, walk nowhere, open the map. If it shows you the province, this amendment
    // has been implemented as a repeal rather than as a narrowing." A character who has
    // discovered nothing must get an empty screen — not a loading state, not a dimmed province.
    const empty = new Disc({ field: eng.field, player: sim.player, env: sim.env, doc: eng.data.mapUI, pois: eng.data.pois });
    const keep = sim.discovery;
    sim.discovery = empty;
    H.openMenu('map', {});
    const blank = H.getUIState().map;
    H.closeMenu();
    sim.discovery = keep;
    A('S12', "APPENDIX: a character who has been nowhere sees nothing (not a dimmed province)",
      `drawn ${blank.drawn_cells} cells, ${blank.places_drawn} squares`,
      blank.drawn_cells === 0 && blank.places_drawn === 0, '0 cells, 0 squares');

    // =========================================================================================
    // D — THE HOSTILE ATTEMPT. Every one of these must fail, structurally.
    // =========================================================================================
    const hostile = H.tryPlaceMapMarker('helstrom');
    const named = hostile.attempts.filter((a) => !a.attempt.startsWith('questEngine') && a.no_effect === undefined);
    A('D1', 'no mutator on the discovery model names a place — every attempt throws',
      named.filter((a) => !a.threw).map((a) => a.attempt).join(' | ') || 'all threw',
      named.length >= 8 && named.every((a) => a.threw), 'every attempt throws');
    // The one call that is LEGAL and must be reported honestly: JS ignores surplus arguments, so
    // `observe(x, z)` runs. The guarantee is not refusal, it is that the arguments do nothing —
    // `observe()` never reads `arguments`, it reads the player it captured at construction.
    const surplus = hostile.attempts.find((a) => a.no_effect !== undefined);
    A('D1b', 'surplus arguments to observe() are legal JS and have NO EFFECT on the raster',
      surplus ? surplus.detail : 'attempt missing', surplus && surplus.no_effect === true,
      'the named coordinate is not revealed');
    A('D2', 'and the place is still not discovered afterwards',
      `hasPlace('helstrom') = ${hostile.discovered_after}`, hostile.discovered_after === false, 'false');
    const st = H.mapState();
    const mut = st.mutators.filter((x) => ['observe', 'suspend', 'resume', 'restore'].includes(x.name));
    const zeroArity = mut.filter((x) => x.name !== 'restore').every((x) => x.arity === 0);
    A('D3', 'AMENDMENT §3b: every mutator has arity 0 — there is no parameter to name a place in',
      mut.map((x) => `${x.name}/${x.arity}`).join(' '), zeroArity, 'observe, suspend, resume all arity 0');
    A('D4', 'the model is frozen — a mutator cannot be bolted on at runtime',
      `frozen=${st.frozen}`, st.frozen === true, 'true');
    let uiThrew = false, uiErr = '';
    try { H.openMenu('map', { place: 'helstrom' }); } catch (e) { uiThrew = true; uiErr = e.message; }
    H.closeMenu();
    A('D5', "openMenu('map', {place}) is REFUSED rather than ignored",
      uiThrew ? uiErr.slice(0, 70) : 'accepted the argument', uiThrew, 'throws');
    // D6 is a statement of scope, not an assertion, and is reported as one. Anything holding
    // `sim` can replace `sim.discovery` wholesale. The claim this piece makes is narrower and
    // is the claim S35 asks for: there is no CALL, so a quest FILE cannot express a marker and
    // a quest HOOK has no verb for one. `check-quests.mjs` and the data scan below are what
    // hold that half.
    A('D6', 'SCOPE: the claim is "no call exists", not "the object is unreachable"',
      'declared', true, 'declared, not asserted');

    // =========================================================================================
    // L — THE LIVE-WORLD LOAD AUDIT. Not the bytes.
    // =========================================================================================
    D = new Disc({ field: eng.field, player: sim.player, env: sim.env, doc: eng.data.mapUI, pois: eng.data.pois });
    sim.discovery = D;
    if (breakMode === 'discovery') D.suspend();
    for (let i = 0; i < 10; i++) walkTo(2000 + i * 130, 800);
    walkTo(site.x, site.z);
    const live0 = H.mapState();
    const blob = H.saveState();
    H.loadState(JSON.parse(JSON.stringify(blob)));
    const live1 = H.mapState();
    A('L1', 'THE LIVE WORLD after the load, not the blob: revealed cells survive',
      `${live0.revealed_cells} -> ${live1.revealed_cells}`,
      live0.revealed_cells > 0 && live1.revealed_cells === live0.revealed_cells, 'equal and non-zero');
    A('L2', 'and the places survive into the live model',
      `${live0.places.join(',')} -> ${live1.places.join(',')}`,
      live0.places.length > 0 && JSON.stringify(live0.places) === JSON.stringify(live1.places), 'identical');
    // The forgery. A save that names a place its own raster does not corroborate.
    const forged = JSON.parse(JSON.stringify(blob));
    forged.world.discovery.places = [...forged.world.discovery.places, 'lilmoth', 'blackrose'];
    H.loadState(forged);
    const live2 = H.mapState();
    A('L3', 'a FORGED save naming a place the raster does not corroborate is refused',
      `dropped ${live2.dropped_on_load.join(',') || 'nothing'}`,
      live2.dropped_on_load.includes('lilmoth') && !live2.places.includes('lilmoth'),
      'lilmoth and blackrose dropped');
    // And the control: the forgery test must be capable of accepting a legitimate place, or it
    // is a check that refuses everything and proves nothing.
    const honest = JSON.parse(JSON.stringify(blob));
    H.loadState(honest);
    const live3 = H.mapState();
    A('L4', 'CONTROL: an honest save is NOT refused (the check is not "drop everything")',
      `dropped ${live3.dropped_on_load.join(',') || 'nothing'}, kept ${live3.places.length}`,
      live3.dropped_on_load.length === 0 && live3.places.length > 0, 'nothing dropped, places kept');

    H.teleport(startPos[0], startPos[2], {});
    return {
      schema: 'elder-souls/map-probe@1',
      break: breakNote,
      sweep,
      live_after_load: live1,
      hostile,
      checks: R,
      passed: R.filter((c) => c.pass).length,
      total: R.length,
    };
  }, brk);
}

// ---- reporting ------------------------------------------------------------------------------

let bad = 0;
for (const rep of reports) {
  if (rep.fatal) { log(`FATAL: ${rep.fatal}`); bad++; continue; }
  const brk = rep.break.mode;
  log(`\n=== map-probe${brk === 'none' ? '' : `  [--break ${brk}]`} ===\n`);
  for (const c of rep.checks) {
    log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(5)} ${c.name}`);
    log(`             got ${c.got}   target ${c.target}`);
  }
  log(`\n${rep.passed}/${rep.total} passed.`);
  if (brk === 'none') {
    if (rep.passed !== rep.total) bad++;
  } else {
    // Under a break the expected outcome is INVERTED: at least one assertion must have failed,
    // and it must be one of the ones the break is supposed to reach. A break that leaves the
    // probe green means the probe was not measuring what it claims to measure.
    const expect = { discovery: ['C1', 'C4', 'L1'], radius: ['C1'], world: ['C3'] }[brk] || [];
    const red = rep.checks.filter((c) => !c.pass).map((c) => c.id);
    const hit = expect.filter((id) => red.includes(id));
    if (hit.length) log(`SELF-TEST OK — breaking '${brk}' turned ${hit.join(', ')} red.`);
    else { log(`SELF-TEST FAILED — breaking '${brk}' left ${expect.join(', ')} green. The probe is not measuring what it claims.`); bad++; }
  }
  writeJson(path.join(outDir, `map-probe${brk === 'none' ? '' : `-break-${brk}`}.json`), rep);
}
log(`\nreports in ${outDir}`);
process.exit(bad ? EXIT.FAIL : EXIT.OK);
