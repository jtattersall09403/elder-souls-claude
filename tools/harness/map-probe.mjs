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

    // ---- C0. THE SHIPPED MODEL RECORDS, AFTER A LOAD. Run before the probe touches anything.
    //
    // This check exists because everything below it used to be worthless, and nothing below it
    // could have told you. C1 rebuilds `sim.discovery` for its radius sweep and the old code
    // never put the engine's own object back, so C2, C3, C4 and the whole of S, D and L measured
    // a model THE PROBE HAD WIRED ITSELF. It read 30/30 green while the shipped map recorded 255
    // cells and could not name a single place for the whole run.
    //
    // So: touch nothing, load a state the way the game and the capture daemon both do, then walk
    // to real site centres taken from the built world, and require that the object the ENGINE
    // constructed moved. The bug it catches is `SimState.reset()` replacing `sim.player` and
    // `sim.env`, which left the model observing a body that could never move again.
    await H.loadState('default');
    const shipped = sim.discovery;
    const c0Before = { revealed: shipped.revealedCells, places: shipped.placeCount };
    const c0Sites = eng.field.sites.slice(0, 6);
    for (const s of c0Sites) walkTo(s.x, s.z);
    const c0After = { revealed: shipped.revealedCells, places: shipped.placeCount };
    A('C0', 'THE SHIPPED MODEL — the object engine.js built — still records after a state load',
      `revealed ${c0Before.revealed} -> ${c0After.revealed}, places ${c0Before.places} -> ${c0After.places}`,
      c0After.revealed > c0Before.revealed && c0After.places > c0Before.places,
      'both rise; a frozen count means the model is watching a body reset() replaced');
    A('C0b', 'and it is still the object the engine hung on the sim, not one the probe swapped in',
      `sim.discovery === engine-built: ${sim.discovery === shipped}`, sim.discovery === shipped,
      'true');

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
      const fresh = new Disc({ field: eng.field, sim, doc: eng.data.mapUI, pois: eng.data.pois });
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
    // AMENDMENT-W1-MAP-02. This used to assert the opposite — "the SCREEN draws what the model
    // revealed (drawn_cells tracks revealed_cells)" — and it was the fog of war, measured. The
    // terrain layer no longer follows the footprint, so the check is now that it DOESN'T: the
    // reveal radius still swings the model (C1 above, unchanged, so the number still has a
    // consumer) while the drawn geography stays put. Put the one-line gate back in
    // `screens/map.js` and this goes red, which is what `tools/map/fog-control.mjs` demonstrates.
    A('C1b', 'the TERRAIN no longer follows the footprint: drawn is constant while revealed falls',
      sweep.map((s) => `${s.drawn}/${s.revealed}`).join(' '),
      sweep.every((s) => s.drawn > 0) && sweep[0].drawn === sweep[1].drawn && sweep[1].drawn === sweep[2].drawn,
      'drawn > 0 and identical across all three radii, while C1 shows revealed falling');

    // PUT THE ENGINE'S OWN MODEL BACK. Everything below this line measures the object
    // `engine.js` constructed and the fixed step drives — not a replacement built here. The
    // radius sweep above has to construct models because `min_m`/`max_m` are read at
    // construction, but it is the only part of this file allowed to, and it hands the sim back.
    // The previous version left its last scratch model installed for the whole rest of the run,
    // which is how this probe scored 30/30 against a map that recorded nothing.
    if (breakMode !== 'radius') { eng.data.mapUI.reveal.min_m = 40; eng.data.mapUI.reveal.max_m = 450; }
    sim.discovery = d;
    d.restore(null);                     // the save path with no save: a clean raster, no mutator
    const D = d;
    const Disc = d.constructor;          // still needed by S12, which wants a genuinely empty one
    if (breakMode === 'discovery') D.suspend(); else D.resume();

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
    // THE SECOND AND LAST PLACE ALLOWED TO CONSTRUCT A MODEL, and it is forced by what C2 is
    // asking. A place's position is read at construction (from `terrain.json sites`, matched by
    // id) and `placePos()` is what the screen draws the square from, so a model built before the
    // province moved will draw the square where the province USED to be — correctly, since the
    // province does not move at runtime in a real game. Re-reading the world is the whole point
    // of the check, so the model has to be rebuilt after the move. The engine's own object is
    // handed back four lines below, before C3.
    const moved2 = new Disc({ field: eng.field, sim, doc: eng.data.mapUI, pois: eng.data.pois });
    sim.discovery = moved2;
    if (breakMode === 'discovery') moved2.suspend();
    walkTo(site.x, site.z);
    H.openMenu('map', {});
    const after = H.getUIState().elements.find((e) => e.id === 'map.place.stormhold');
    H.closeMenu();
    site.x = home.x; site.z = home.z;                    // put the province back
    sim.discovery = D; D.restore(null);                 // and the engine's model back with it
    if (breakMode === 'discovery') D.suspend();
    const moved = before && after && (Math.abs(before.rect[0] - after.rect[0]) > 4 || Math.abs(before.rect[1] - after.rect[1]) > 4);
    A('C2', 'the map is drawn from game/data/world/: moving a site moves its square',
      before && after ? `${before.rect[0].toFixed(1)},${before.rect[1].toFixed(1)} -> ${after.rect[0].toFixed(1)},${after.rect[1].toFixed(1)}` : 'square missing',
      moved, 'the drawn square follows the world data');

    // ---- C3. The terrain colour is the REGION's, not the screen's --------------------------
    D.restore(null); sim.discovery = D;   // clean raster, still the ENGINE's object
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
    D.restore(null); sim.discovery = D;   // clean raster, still the ENGINE's object
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
    // AMENDMENT-W1-MAP-02 inverted this one. It used to read "undiscovered is UNRENDERED — most
    // of the province is not drawn" and required `drawn_cells < total_cells * 0.5`. The owner
    // struck the map's fog of war on 2026-08-14, and `RI-WLD06` §5 had banned "fog-of-war
    // reveal-on-approach" all along, so the assertion is now the opposite one — and it is still
    // an assertion with teeth, because it is paired with S7 above: the geography is whole AND
    // every square is earned. Either half alone passes a broken map.
    //
    // W1-MAP-DEFECTS r1 — THE ASSERTION WAS A TAUTOLOGY AND THIS IS THE REPAIR.
    //
    // It read `drawn_cells === cells_in_view`. In `game/src/ui/screens/map.js` those two counters
    // are incremented on ADJACENT LINES with nothing between them, and the comment beside them
    // says so outright — "equal by construction now". The equality could therefore be broken by
    // exactly one edit in the world: a gate spliced BETWEEN the two increments, which is the
    // shape `tools/map/fog-control.mjs --arms deletefix` uses and nothing else. A gate one line
    // EARLIER, above `inView++`, hides any fraction of the province you like and both counters
    // fall together — the check stays green while the map goes black. The critic found it; the
    // check did not.
    //
    // THE ASSERTION WITH TEETH IS AGAINST THE PROVINCE TOTAL. In the province view the drawing
    // box spans the whole raster (`c0..c1` = `0..cols-1`, `r0..r1` = `0..rows-1`), so a map that
    // draws everything draws all 42,846 cells and `total_cells` is a number the draw loop cannot
    // move. `cells_in_view` is kept in the detail line because it is still the honest description
    // of what the layout could have painted; it is no longer what the pass rests on.
    //
    // PROVEN ABLE TO FAIL, not asserted able to fail: `tools/map/fog-control.mjs --arms
    // head,hiddenhalf` splices a gate ABOVE `inView++` on a control clone and requires the OLD
    // form to stay green on it while this one goes red. A check nobody has watched fail is a
    // check nobody knows works.
    A('S8', 'the GEOGRAPHY is drawn whole — the WHOLE PROVINCE is painted (W1-MAP-02)',
      `${m.drawn_cells} of ${m.total_cells} province cells (${m.cells_in_view} in view); geography_always_drawn=${m.geography_always_drawn}`,
      m.total_cells > 0 && m.drawn_cells === m.total_cells && m.geography_always_drawn === true,
      'drawn === total_cells (42,846), not merely === cells_in_view');
    const navFromMap = ui.navigable;
    H.closeMenu();
    H.openMenu('journal', {});
    const navFromJournal = H.getUIState().navigable;
    H.closeMenu();
    A('S9', 'RI-UIX04 Q7 UNAMENDED: the journal cannot reach the map',
      navFromJournal.join(','), !navFromJournal.includes('map'), 'no `map`');
    A('S10', 'and the map cannot reach the journal either',
      navFromMap.join(','), !navFromMap.includes('journal'), 'no `journal`');

    // ---- S13. THE FORWARD PAGE-WALK, WALKED. W1-MAP-DEFECTS r1's biggest gap ----------------
    //
    // S9/S10 above are the mechanism that broke this, and they were both GREEN while it was
    // broken. `navigable()` drops the NEVER_ADJACENT partner OF THE MODE YOU STAND ON, so an
    // excluded neighbour in `WALK_ORDER` is not stopped at — it is STEPPED OVER. r1 moved `map`
    // to second, which put it immediately before `journal`, and the forward walk went
    // inventory -> map -> sheet -> spells -> wait -> (closes): five peer screens down to four,
    // with the journal — the screen a Morrowind player opens most — off the walk at any number
    // of presses, in that direction, forever. Q7 held perfectly the whole time. THE RULE:
    //
    //     no two screens named in NEVER_ADJACENT may be NEIGHBOURS in WALK_ORDER.
    //
    // WALKED, NOT READ. Every step below is a real `swap_right` edge queued into the fixed step
    // and latched exactly as a swing is, so this fails if the binding is lost, if `_walkPeer`
    // stops being called, or if the order is edited — not merely if a constant changes shape.
    // `f: 0` for S11's reason: the menu pauses the world, `sim.frame` is frozen while it is up,
    // and a scripted event at `f >= 1` can never fire and is never counted as dropped either.
    H.closeMenu();
    H.openMenu('inventory', {});
    const walked = [];
    for (let i = 0; i < 10; i++) {
      H.queueInputs([{ f: 0, press: ['swap_right'] }, { f: 0, release: ['swap_right'] }]);
      H.stepFrames(2);
      const md = H.getUIState().mode;
      if (md === 'world' || md === 'inventory' || walked.includes(md)) break;
      walked.push(md);
    }
    H.closeMenu();
    const OWED = ['map', 'sheet', 'journal', 'spells', 'wait'];
    const skipped = OWED.filter((m) => !walked.includes(m));
    A('S13', 'the forward page-walk reaches EVERY screen, and reaches the map first',
      `inventory -> ${walked.join(' -> ')} -> (closes); skipped: ${skipped.join(',') || 'nothing'}`,
      skipped.length === 0 && walked[0] === 'map',
      'nothing skipped, and `map` one page-turn from the inventory');

    // ---- S11. The local view exists and is a DIFFERENT view, not a relabelled one ----------
    //
    // S35 permits "a local view for the cell you are in". A local view that draws the same
    // thing as the province view with a different heading is the failure worth checking for,
    // so the assertion is on the drawn cell count: 500 m across at a 25 m raster is at most a
    // 21x21 window, against the whole province at 193x222.
    //
    // TRAVEL FIRST, AND THIS IS THE POINT OF THE CHECK. The first version of S11 ran from the
    // state left by C4 — seventeen discovered cells, every one of them inside the local window
    // — so the world view and the local view drew the SAME SEVENTEEN CELLS and the count could
    // not tell them apart. It read `cells 17 -> 17` and passed, and it would have passed just
    // as happily against a local view that was the province with a new caption. A control that
    // cannot exhibit the failure is not a control (protocol, failure mode 4). So: spread the
    // body across the province until the discovered set is comfortably larger than the local
    // window, and only then compare. S11a asserts the precondition itself, so if this setup
    // ever stops producing a discriminating state the probe says so instead of passing quietly.
    for (const [x, z] of [[2171.5, 761], [2674.8, 751.6], [3200, 820], [3820, 859],
      [3400, 1600], [2800, 2100], [2200, 2600], [1600, 2850], [1000, 2950], [439, 2913.5]]) {
      walkTo(x, z);
    }
    H.openMenu('map', {});
    const worldCells = H.getUIState().map.drawn_cells;
    A('S11a', 'PRECONDITION: the province view now draws more than a local window could hold',
      `world view draws ${worldCells} cells`, worldCells > 21 * 21,
      'more than 441, else S11 cannot discriminate');
    // Through the REAL input path — a scripted `interact` press, latched inside the fixed step
    // exactly as a swing is — rather than by calling `UISystem._confirm()` directly. A probe
    // that reaches past the input layer cannot tell a bound button from an unbound one, which
    // is the difference between a view a player can reach and one only a critic can.
    // THE PRESS MUST BE AT `f: 0`, AND THIS IS NOT A STYLE CHOICE — it is the only frame that
    // exists. The map pauses the world (RI-UIX03 §A, out of combat), and `engine._step()`'s
    // paused branch calls `input.latchForStep(sim.frame)` WITHOUT calling `stepOnce()`. So
    // `sim.frame` is FROZEN for as long as the screen is up. `pipeline.latchForStep` fires a
    // scripted event only when `e.f + scriptBase === frame`, and `scriptBase` is that same
    // frozen frame — so every scripted event at `f >= 1` is unreachable inside a paused menu.
    // Worse, it is unreachable SILENTLY: the dropped-input branch needs `f + base < frame`,
    // which a frozen frame can never satisfy, so the event is never fired and never counted as
    // lost either. This check failed twice for two different driver bugs before it failed for
    // no reason at all, and both times the assertion was right and the driver was wrong.
    // `tools/harness/critic-w1-15.mjs:191` already uses `f: 0` for exactly this reason.
    //
    // Press and release in the SAME latch is a clean tap, not a cancellation: `latchForStep`
    // ORs both into `pendingPress`/`pendingRelease`, then computes `pressed = pendingPress &
    // ~held` BEFORE `released = pendingRelease & held`. The edge fires; the button ends up.
    H.queueInputs([{ f: 0, press: ['interact'] }, { f: 0, release: ['interact'] }]);
    H.stepFrames(2);
    const localSt = H.getUIState();
    const localCells = localSt.map.drawn_cells;
    A('S11', 'the LOCAL view is a real second view, not the province with a new heading',
      `view=${localSt.map.view}, cells ${worldCells} -> ${localCells}`,
      localSt.map.view === 'local' && localCells <= 21 * 21 && localCells < worldCells,
      'local, at most a 21x21 window, and STRICTLY FEWER cells than the province view');
    A('S11b', 'and confirm does NOT travel: the body has not moved',
      'no `pending` action was queued', eng.ui.pending === null || eng.ui.pending === undefined,
      'no queued action');
    eng.ui.focus.map.view = 'world';
    H.closeMenu();

    // ---- S12. THE AMENDMENT'S OWN APPENDIX TEST, AS AMENDED BY W1-MAP-02 --------------------
    //
    // W1-MAP-01's appendix read: "Open the game, walk nowhere, open the map. If it shows you the
    // province, this amendment has been implemented as a repeal." W1-MAP-02 §3b keeps the test in
    // exactly this place and inverts it, because the owner's ruling inverted the rule:
    //
    //   Open the game, walk nowhere, open the map. You must see the WHOLE PROVINCE, and you must
    //   see ZERO PLACE SQUARES.
    //
    // The second half is the one that matters now, and it is the null control this round was
    // dispatched with: "geography revealed AND every marker revealed with it" would look like a
    // working map in a screenshot and would quietly delete discovery from the game.
    // `tools/map/fog-control.mjs --arms markers` is that mistake made on purpose, and this
    // assertion is what goes red on it.
    const empty = new Disc({ field: eng.field, sim, doc: eng.data.mapUI, pois: eng.data.pois });
    const keep = sim.discovery;
    sim.discovery = empty;
    H.openMenu('map', {});
    const blank = H.getUIState().map;
    H.closeMenu();
    sim.discovery = keep;
    // The same tautology repair as S8 above, for the same reason and against the same number.
    A('S12', 'APPENDIX: a character who has been nowhere sees the WHOLE province and NOT ONE square',
      `drawn ${blank.drawn_cells} of ${blank.total_cells} province cells (${blank.cells_in_view} in view), ${blank.places_drawn} squares, ${blank.revealed_cells} cells in the footprint`,
      blank.total_cells > 0 && blank.drawn_cells === blank.total_cells && blank.places_drawn === 0,
      'the whole province (42,846), zero squares');

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
    D.restore(null); sim.discovery = D;   // clean raster, still the ENGINE's object
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
    const expect = { discovery: ['C0', 'C1', 'C4', 'L1'], radius: ['C1'], world: ['C3'] }[brk] || [];
    const red = rep.checks.filter((c) => !c.pass).map((c) => c.id);
    const hit = expect.filter((id) => red.includes(id));
    if (hit.length) log(`SELF-TEST OK — breaking '${brk}' turned ${hit.join(', ')} red.`);
    else { log(`SELF-TEST FAILED — breaking '${brk}' left ${expect.join(', ')} green. The probe is not measuring what it claims.`); bad++; }
  }
  writeJson(path.join(outDir, `map-probe${brk === 'none' ? '' : `-break-${brk}`}.json`), rep);
}
log(`\nreports in ${outDir}`);
process.exit(bad ? EXIT.FAIL : EXIT.OK);
