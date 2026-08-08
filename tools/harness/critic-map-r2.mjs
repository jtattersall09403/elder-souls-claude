#!/usr/bin/env node
// critic-map-r2.mjs — the W1-MAP ROUND-2 critic's instrument. ARBITRATION seam S35 (supersedes S30).
//
// WHY THIS EXISTS AND WHY IT IS NOT critic-w1-map-r1.mjs RE-RUN.
//
// A defect in `game/src/save/fight.js` serialised the live `SoulsAI` as a plain object, so the next
// fixed step after any save/load with a hostile present threw `this.ai.step is not a function` while
// `boot-check` stayed green. The W1-MAP round-1 critic hit that throw, recorded it as a foreign
// fault, and armed preconditions (C0/D0) against it. `W1-SAVE-AI` has since fixed it and listed
// W1-MAP's C2/D1/D2/D3 as measurements to re-take.
//
// So every block here is taken TWICE where it can be — once in an empty world and once with live
// hostiles on the floor, which is the condition that used to kill the walk — and the fault counter
// is per block per arm. If the two arms agree, the finding is a property of the map and not of the
// save. If they disagree, the round-1 number was an artefact.
//
//   P  PREMISE. Is the save defect actually gone at this commit? And — rule 6 — is my own fault
//      detector capable of going red? P3 breaks a live AI back into a plain object on purpose and
//      requires the detector to fire. A control that has never been seen fail is not a control.
//   R  THE RE-TAKE. C2, D1, D2, D3, in both arms.
//   A  THE FORGED SAVE, HARDER THAN ROUND 1. Round 1 forged `world.discovery.stood` and handed the
//      object to `loadState()`. A9 instead writes a save file THROUGH THE GAME'S OWN CONTAINER
//      (`save/exchange.js exportSave`) and reads it back through `importSave()` — the player-facing
//      route, sha-256 seal and all. A10 then steps 180 frames with hostiles present, because a
//      forgery that dies on the next step is not a forgery; that is the exact operation the save
//      defect used to break, so a round-1 "the attack passed" could have been a load that died.
//      A11 asks the question the brief names: is the HOLE closed, or was the REPORT closed?
//   Q  "no API by which a quest could touch the map", executed — including through `window.__ENGINE`,
//      which `main.js` publishes and which capability prohibitions do not cover.
//   U  UNDISCOVERED IS UNRENDERED, at the renderer. Distinct colours in the terrain box with the
//      player chevron excluded (counted naively a blank map reads as ~15 colours, all chevron
//      antialiasing), plus a channel-range test that a drawn-then-masked province cannot pass.
//   E  HOVER NAMES. A square only after STANDING — not after entering the region, not after being
//      NEARBY, and not after being TOLD (E3 feeds the place to the quest machine's own
//      `learnFrom('place', …)` and requires the map to stay blank).
//   G  CONSUMPTION (RI-MTH07).
//
// SELF-TEST — `--break <what>` breaks the thing under test and requires this tool to go red:
//   unrendered  the screen draws every cell regardless of discovery      -> U1,U2,U3 red
//   standing    a place is discovered by proximity rather than standing  -> R:D1 red
//   consumer    install a real world-side reader of the model            -> G2 GREEN (opposite
//               polarity on purpose: G2's pass condition is "nothing happened", and such an
//               assertion is worth nothing until it has been shown to notice something happening)
//   all         each in sequence
//
// P3 is a control that runs in EVERY mode, not only under --break, because the premise of this
// whole verdict is that the step-fault detector works.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-map-r2.mjs — the W1-MAP round-2 critic's instrument (ARBITRATION S35).

USAGE
  node tools/harness/critic-map-r2.mjs [--break <what>] [--json] [--out <dir>]

OPTIONS
  --break <what>  unrendered | standing | consumer | all
  --out <dir>     default reports/runs/CRITIC-W1-MAP-R2
  --json          print the whole report
  --help          this message

Exit 0 = every S35 assertion held (or, under --break, the expected assertions moved).
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'CRITIC-W1-MAP-R2');
ensureDir(outDir);
const breakWhat = args.break ? String(args.break) : null;
const breaks = breakWhat === 'all' ? ['unrendered', 'standing', 'consumer'] : breakWhat ? [breakWhat] : [null];

const handle = await launchGame(args);
const reports = [];
try {
  for (const brk of breaks) reports.push(await run(handle, brk));
} finally {
  await handle.close();
}

async function run(h, brk) {
  return h.page.evaluate(async (breakMode) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const R = [];
    const notes = [];
    const A = (id, name, got, pass, target) => {
      R.push({ id, name, got: typeof got === 'object' ? JSON.stringify(got) : String(got), target, pass: !!pass });
      return !!pass;
    };
    const EXPECT_RED = { unrendered: ['U1', 'U2', 'U3'], standing: ['R-D1-clean', 'R-D1-hostile'], consumer: [] };
    const EXPECT_GREEN = { consumer: ['G2'] };

    const eng = window.__ENGINE;
    const sim = eng.sim;
    const D = sim.discovery;
    const cols = D.cols, rows = D.rows, cell = D.cell;
    const total = cols * rows;
    const pois = (eng.data.pois.pois || []);
    const siteOf = (id) => eng.field.sites.find((s) => s.id === id);

    // ---- the fault detector. Everything in this tool steps through it. ----------------------
    const faults = [];
    const step = (n) => { try { H.stepFrames(n); return true; } catch (e) { faults.push(String(e.message).slice(0, 160)); return false; } };
    const walkTo = (x, z) => { H.teleport(x, z, {}); step(2); };
    const liveAI = () => {
      const c = eng.combat;
      if (!c || !c.enemies) return 0;
      let n = 0;
      for (const [, ctl] of c.enemies) if (ctl.ai && typeof ctl.ai.step === 'function') n++;
      return n;
    };
    const anyCtl = () => {
      const c = eng.combat;
      if (!c || !c.enemies) return null;
      for (const [, ctl] of c.enemies) if (ctl.ai) return ctl;
      return null;
    };
    /** Put N hostiles on the floor around the player and get their AI built. */
    const putHostiles = (n) => {
      const p = H.getCombatState().player;
      const eids = [];
      for (let i = 0; i < n; i++) {
        try {
          const eid = H.spawn('guard_legion', p.pos[0] + 4 + i * 3, p.pos[2] + 1 + i * 2, {});
          eids.push(eid);
          try { H.aggro(eid); } catch (e) { /* not fatal */ }
        } catch (e) { notes.push('spawn failed: ' + e.message); }
      }
      step(2);                                  // the AI is built on the controller's first step
      return { eids, live: liveAI() };
    };

    // ---- the wire format, copied from `sim/discovery.js zigzag()` ---------------------------
    const forgeTrail = (indices) => {
      const out = [];
      let prev = 0;
      for (const i of indices) {
        let v = i - prev; prev = i;
        v = v < 0 ? (-v * 2 - 1) : v * 2;
        while (v >= 0x80) { out.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
        out.push(v);
      }
      let s = '';
      for (const b of out) s += String.fromCharCode(b);
      return btoa(s);
    };
    const cellIndexAt = (x, z) => {
      const c = Math.min(cols - 1, Math.max(0, Math.floor(x / cell)));
      const r = Math.min(rows - 1, Math.max(0, Math.floor(z / cell)));
      return r * cols + c;
    };
    const worldHash = () => {
      const b = H.saveState();
      if (b.world) delete b.world.discovery;    // else the arms differ trivially: the save IS the map
      const s = JSON.stringify(b);
      let a = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 0x01000193) >>> 0; }
      return (a >>> 0).toString(16).padStart(8, '0') + ':' + s.length;
    };
    const openMap = () => { H.openMenu('map', {}); return H.getUIState(); };

    /**
     * Distinct colours inside the terrain box, EXCLUDING the player chevron and the naming label,
     * both of which S35 permits and both of which are drawn inside that box. Counted naively a
     * perfectly blank map reads as many colours purely from the chevron's antialiased edge, and a
     * critic who did not exclude it would invent a finding.
     */
    const terrainInk = () => {
      H.openMenu('map', {});
      const S = eng.ui.S;
      const terr = S.elements.find((e) => e.kind === 'map_terrain');
      const plr = S.elements.find((e) => e.kind === 'map_player');
      const nam = S.elements.find((e) => e.id === 'map.naming');
      const box = terr.rect;
      const x0 = Math.round(box[0]) + 2, y0 = Math.round(box[1]) + 2;
      const w = Math.max(1, Math.round(box[2]) - 4), hgt = Math.max(1, Math.round(box[3]) - 4);
      const img = S.ctx.getImageData(x0, y0, w, hgt).data;
      const boxes = [plr, nam].filter(Boolean).map((e) => e.rect);
      const seen = new Map();
      let counted = 0;
      let rlo = 255, rhi = 0, glo = 255, ghi = 0, blo = 255, bhi = 0;
      for (let py = 0; py < hgt; py++) {
        for (let px = 0; px < w; px++) {
          const gx = x0 + px, gy = y0 + py;
          let skip = false;
          for (const b of boxes) {
            if (gx >= b[0] - 3 && gx <= b[0] + b[2] + 3 && gy >= b[1] - 3 && gy <= b[1] + b[3] + 3) { skip = true; break; }
          }
          if (skip) continue;
          const i = (py * w + px) * 4;
          const cr = img[i], cg = img[i + 1], cb = img[i + 2];
          if (cr < rlo) rlo = cr; if (cr > rhi) rhi = cr;
          if (cg < glo) glo = cg; if (cg > ghi) ghi = cg;
          if (cb < blo) blo = cb; if (cb > bhi) bhi = cb;
          const k = (cr << 16) | (cg << 8) | cb;
          seen.set(k, (seen.get(k) || 0) + 1);
          counted++;
        }
      }
      const sorted = [...seen.entries()].sort((a, b) => b[1] - a[1]);
      H.closeMenu();
      return {
        distinct: seen.size, pixels: counted,
        dominant: '#' + sorted[0][0].toString(16).padStart(6, '0'),
        dominant_frac: +(sorted[0][1] / counted).toFixed(4),
        channel_range: [rhi - rlo, ghi - glo, bhi - blo],
        meta_drawn: terr.meta.drawn_cells, meta_total: terr.meta.total_cells,
      };
    };

    // =========================================================================================
    // P — THE PREMISE. Is the save defect gone, and can my detector see it if it comes back?
    // =========================================================================================
    await H.loadState('default');
    D.restore(null);
    const p0 = putHostiles(2);
    const aiBefore = liveAI();
    const ctorBefore = anyCtl() ? anyCtl().ai.constructor.name : '(none)';
    const pFaults0 = faults.length;
    H.loadState(JSON.parse(JSON.stringify(H.saveState())));
    const aiAfter = liveAI();
    const ctlAfter = anyCtl();
    const ctorAfter = ctlAfter ? ctlAfter.ai.constructor.name : '(none)';
    const steppedOK = step(60);
    A('P1', 'PREMISE: after a save/load with hostiles present, the fixed step runs and the AI is live',
      `live AI ${aiBefore} -> ${aiAfter}, ctor ${ctorBefore} -> ${ctorAfter}, 60 steps ok=${steppedOK}, faults=${faults.length - pFaults0}`,
      aiBefore > 0 && aiAfter >= aiBefore && ctorAfter === 'SoulsAI' && steppedOK && faults.length === pFaults0,
      'a live SoulsAI survives the round trip and the step does not throw');

    // P3 — THE CONTROL, AND IT RUNS IN EVERY MODE. Break a live AI back into the plain object the
    // defect used to produce and require the detector to fire. Rule 6: a teardown that has never
    // been seen to go red is a second copy of the experiment, not evidence.
    let controlFired = false, controlMsg = '';
    const victim = anyCtl();
    if (victim) {
      const realAI = victim.ai;
      victim.ai = JSON.parse(JSON.stringify({ b: {}, stat: {}, anchor: [0, 0, 0] }));  // exactly the defect's shape
      const f0 = faults.length;
      step(2);
      controlFired = faults.length > f0;
      controlMsg = controlFired ? faults[faults.length - 1] : '(the step did not throw)';
      victim.ai = realAI;
    }
    A('P3', 'CONTROL: replacing a live AI with a plain object makes the fault detector go RED',
      `detector fired=${controlFired} — "${controlMsg}"`, controlFired,
      'the detector fires — otherwise every "0 faults" below is a detector that cannot fail');
    // A step that threw leaves the fight mid-frame; start every block below from a clean load.

    // =========================================================================================
    // R — THE RE-TAKE OF C2, D1, D2, D3, IN BOTH ARMS
    // =========================================================================================
    const retake = async (arm) => {
      const hostile = arm === 'hostile';
      await H.loadState('default');
      D.restore(null); sim.discovery = D;
      const f0 = faults.length;
      const frame0 = H.getFrame ? H.getFrame() : sim.frame;
      let live = 0;
      if (hostile) live = putHostiles(3).live;

      // --- C2: partial map. The undiscovered ground is still the screen's own colour and still
      //     the majority. Measured against the empty map taken in the same arm.
      const inkEmpty = terrainInk();
      for (let i = 0; i < 10; i++) walkTo(2000 + i * 130, 800);
      const inkSome = terrainInk();
      const c2 = inkSome.distinct > 1 && inkSome.dominant === inkEmpty.dominant && inkSome.dominant_frac > 0.5;

      // --- D1: the square appears ONLY after standing in the pad.
      await H.loadState('default');
      D.restore(null); sim.discovery = D;
      if (hostile) putHostiles(3);
      const site = siteOf('thorn') || eng.field.sites[0];
      let origHasPlace = null;
      if (breakMode === 'standing') {
        const proto = Object.getPrototypeOf(D);
        origHasPlace = proto.hasPlace;
        proto.hasPlace = function (id) {
          if (origHasPlace.call(this, id)) return true;
          const s = eng.field.sites.find((q) => q.id === id);
          const pp = sim.player;
          if (!s || !pp || !pp.pos) return false;
          const dx = pp.pos[0] - s.x, dz = pp.pos[2] - s.z;
          return Math.sqrt(dx * dx + dz * dz) <= (s.r_flat || 25) + 600;      // proximity: S35 forbids it
        };
      }
      walkTo(site.x + site.r_flat + 400, site.z + 200);
      const afterRegion = D.hasPlace(site.id);
      walkTo(site.x + site.r_flat + 40, site.z);
      const afterNear = D.hasPlace(site.id);
      walkTo(site.x, site.z);
      const afterStand = D.hasPlace(site.id);
      const d1 = afterRegion === false && afterNear === false && afterStand === true;
      if (breakMode === 'standing') Object.getPrototypeOf(D).hasPlace = origHasPlace;

      // --- D2 / D3: the hover name, and what the naming element carries.
      const st = openMap();
      const naming = st.elements.find((e) => e.id === 'map.naming');
      const squares = st.elements.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming');
      const poiRec = pois.find((p) => p.id === site.id);
      const mapRep = st.map;
      H.closeMenu();
      const d2 = !!naming && !!poiRec && naming.text === poiRec.name;
      const d3 = !!naming && naming.meta.quest === null && naming.meta.objective === null && naming.meta.travel === false;

      const frame1 = H.getFrame ? H.getFrame() : sim.frame;
      return {
        arm, faults: faults.length - f0, live_ai: live, frames_advanced: frame1 - frame0,
        ink_empty: inkEmpty, ink_partial: inkSome,
        c2, d1, d2, d3,
        d1_detail: `region(+${Math.round(site.r_flat) + 400}m):${afterRegion} near(+40m):${afterNear} standing:${afterStand}`,
        naming: naming ? naming.text : '(none)', poi_name: poiRec ? poiRec.name : '?',
        naming_meta: naming ? naming.meta : null,
        squares: squares.length, discovered: D.placeCount,
        quest_bearing: mapRep.quest_bearing_elements, travel_affordances: mapRep.travel_affordances,
        numeric_text: mapRep.numeric_text, routes: mapRep.routes_drawn,
      };
    };

    const clean = await retake('clean');
    const hostileArm = await retake('hostile');

    for (const a of [clean, hostileArm]) {
      const tag = a.arm;
      A(`R-pre-${tag}`, `PRECONDITION (${tag}): the walk this arm measures actually stepped the world`,
        `step faults=${a.faults}, frames advanced=${a.frames_advanced}, cells drawn after walking=${a.ink_partial.meta_drawn}, live hostile AI=${a.live_ai}`,
        a.faults === 0 && a.frames_advanced > 0 && a.ink_partial.meta_drawn > 0 && (tag === 'clean' || a.live_ai > 0),
        'no faults, the frame advanced, the map filled — and in the hostile arm, hostiles really were on the floor');
      A(`R-C2-${tag}`, `C2 (${tag}): partial map — undiscovered ground is still the screen ground and still the majority`,
        `distinct=${a.ink_partial.distinct}, dominant=${a.ink_partial.dominant} at ${(a.ink_partial.dominant_frac * 100).toFixed(2)}%, drawn=${a.ink_partial.meta_drawn}/${a.ink_partial.meta_total}`,
        a.c2, 'more than one colour, the undiscovered hex unchanged and over 50%');
      A(`R-D1-${tag}`, `D1 (${tag}): a square appears ONLY after standing in the pad`,
        a.d1_detail, a.d1, 'false / false / true');
      A(`R-D2-${tag}`, `D2 (${tag}): the hover name is the place name from pois.json`,
        `naming="${a.naming}" pois.name="${a.poi_name}"`, a.d2, 'identical to the world-data name');
      A(`R-D3-${tag}`, `D3 (${tag}): the naming element carries no quest, objective or travel identity`,
        JSON.stringify(a.naming_meta), a.d3, 'quest:null objective:null travel:false');
    }
    A('R-agree', 'THE RE-TAKE ITSELF: the two arms agree, so these are properties of the map and not of the save',
      `clean C2/D1/D2/D3 = ${clean.c2}/${clean.d1}/${clean.d2}/${clean.d3}; hostile = ${hostileArm.c2}/${hostileArm.d1}/${hostileArm.d2}/${hostileArm.d3}`,
      clean.c2 === hostileArm.c2 && clean.d1 === hostileArm.d1 && clean.d2 === hostileArm.d2 && clean.d3 === hostileArm.d3,
      'identical in both arms');

    // =========================================================================================
    // A — THE FORGED SAVE, AGAIN AND HARDER
    // =========================================================================================
    await H.loadState('default');
    D.restore(null); sim.discovery = D;
    const startSite = siteOf('thorn') || eng.field.sites[0];
    walkTo(startSite.x, startSite.z);
    const honestLive = H.mapState();
    const honestBlob = H.saveState();
    A('A0', 'BASELINE: an honest walk to one place discovers exactly that place',
      `places=[${honestLive.places.join(',')}] revealed=${honestLive.revealed_cells}/${total}`,
      honestLive.place_count >= 1 && honestLive.revealed_cells > 0, '>=1 place, >0 cells');

    const proofIdx = cellIndexAt(4200, 4800);
    D.restore({ stood: forgeTrail([proofIdx]) });
    const proofOk = D.stoodCells === 1 && D.seenCell(proofIdx % cols, (proofIdx / cols) | 0);
    A('Afmt', 'PRECONDITION: a forged trail in the real wire format reaches the model at all',
      `one forged cell -> stood_cells=${D.stoodCells}, revealed=${D.seenCell(proofIdx % cols, (proofIdx / cols) | 0)}`,
      proofOk, 'delivered — otherwise every A-result below is a false negative');

    const everyCell = [];
    for (let i = 0; i < total; i++) everyCell.push(i);
    const forgedDiscovery = { stood: forgeTrail(everyCell), cells: '', places: [], revealed: 0, derived_from: 'stood' };
    const forgedAll = JSON.parse(JSON.stringify(honestBlob));
    forgedAll.world.discovery = forgedDiscovery;
    H.loadState(forgedAll);
    const liveAll = H.mapState();
    A('A1', 'S35: no square for a place the body has not stood in — a forged `stood` must not mint them',
      `place_count=${liveAll.place_count} of ${pois.length} pois (the honest walk gave ${honestLive.place_count})`,
      liveAll.place_count <= honestLive.place_count, 'no more places than the body actually stood in');
    A('A2', 'S35: undiscovered is unrendered — a forged `stood` must not reveal the province',
      `revealed=${liveAll.revealed_cells}/${total} (${((liveAll.revealed_cells / total) * 100).toFixed(1)}%)`,
      liveAll.revealed_cells <= honestLive.revealed_cells, 'no more ground than was walked');
    const stAll = openMap();
    const squaresAll = stAll.elements.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming');
    const mAll = stAll.map;
    H.closeMenu();
    A('A3', 'THE SCREEN: a forged footprint must not draw phantom squares',
      `map_place squares drawn=${squaresAll.length}, drawn_cells=${mAll.drawn_cells}/${mAll.total_cells}`,
      squaresAll.length <= honestLive.place_count, 'no phantom squares rendered');
    A('A4', "the screen's compliance report must not be a fixed point on its own model",
      `places_drawn=${mAll.places_drawn} places_discovered=${mAll.places_discovered}, squares on screen=${squaresAll.length}`,
      !(mAll.places_drawn === mAll.places_discovered && squaresAll.length > honestLive.place_count),
      'either no forgery, or a report that can tell drawn-from-forged apart');
    const lastRestore = D.lastRestore || {};
    const publishedKeys = Object.keys(liveAll).concat(Object.keys(mAll));
    const publishesAudit = ['phantom_cells', 'stood_cells', 'missing_cells', 'legacy']
      .filter((k) => publishedKeys.includes(k));
    A('A5', 'the footprint-disagreement signal restore() already computes must reach an instrument',
      `Discovery.lastRestore computes [${Object.keys(lastRestore).join(',')}]; published by mapState/getUIState: [${publishesAudit.join(',') || 'nothing'}]`,
      publishesAudit.length > 0,
      'phantom_cells / stood_cells / missing_cells published — save/state.js keeps only .dropped');

    // ---- A9. THROUGH THE PLAYER-FACING SAVE FILE, SEAL AND ALL. --------------------------------
    // Round 1 handed a JS object to `loadState()`. A builder could fairly answer "that is a harness
    // verb". So this writes a real container with the game's own `exportSave()` — which computes
    // the sha-256 the reader checks — and reads it back through `importSave()`, the route the
    // player's save file takes. If the seal stopped a forger this is where it would.
    let a9 = { ok: false, err: null, place_count: -1, revealed: -1, squares: -1, bytes: 0 };
    try {
      const ex = await import('/game/src/save/exchange.js');
      const bytes = ex.exportSave(forgedAll);          // the game seals the forger's blob for him
      a9.bytes = bytes.length;
      await H.loadState('default');
      D.restore(null); sim.discovery = D;
      H.importSave(bytes);                             // the reader verifies the seal and accepts
      const live = H.mapState();
      const st = openMap();
      a9.squares = st.elements.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming').length;
      H.closeMenu();
      a9.place_count = live.place_count; a9.revealed = live.revealed_cells; a9.ok = true;
    } catch (e) { a9.err = String(e.message).slice(0, 200); }
    A('A9', 'THE PLAYER-FACING ROUTE: a sealed save file, imported through importSave(), must not fill the map',
      a9.err ? `importSave refused: ${a9.err}` : `${a9.bytes} sealed bytes accepted -> place_count=${a9.place_count}/${pois.length}, revealed=${a9.revealed}/${total}, squares drawn=${a9.squares}`,
      a9.err !== null || (a9.place_count <= honestLive.place_count),
      'refused by the seal, or no more places than were walked');

    // ---- A10. DOES THE FORGERY SURVIVE A REAL STEPPING SESSION WITH HOSTILES? -----------------
    // This is precisely the operation the save defect used to break. A round-1 forged-save attack
    // that "passed" could have passed because the load died on the next step.
    const a10Faults0 = faults.length;
    const a10Live = putHostiles(2).live;
    const a10Stepped = step(180);
    const a10After = H.mapState();
    A('A10', 'the forgery must not survive 180 fixed steps with hostiles on the floor',
      `stepped ok=${a10Stepped}, faults=${faults.length - a10Faults0}, live hostile AI=${a10Live}, place_count after=${a10After.place_count}, revealed after=${a10After.revealed_cells}/${total}`,
      a10After.place_count <= honestLive.place_count,
      'the map is not still full — and the step ran, so this is not a load that died');

    // ---- A11. IS THE HOLE CLOSED, OR WAS THE REPORT CLOSED? -----------------------------------
    // Take every number the build publishes about the map on the forged state, and ask whether any
    // of them is different from what an HONEST body that had walked that much would publish.
    const stF = openMap(); const mF = stF.map; H.closeMenu();
    const forgedReport = {
      places_drawn: mF.places_drawn, places_discovered: mF.places_discovered,
      drawn_cells: mF.drawn_cells, revealed_cells: mF.revealed_cells,
      markers: mF.markers, routes_drawn: mF.routes_drawn,
      quest_bearing: mF.quest_bearing_elements.length, travel: mF.travel_affordances.length,
      numeric_text: mF.numeric_text.length,
      dropped_on_load: (H.mapState().dropped_on_load || []).length,
    };
    const allGreen = forgedReport.places_drawn === forgedReport.places_discovered
      && forgedReport.markers === 0 && forgedReport.routes_drawn === 0
      && forgedReport.quest_bearing === 0 && forgedReport.travel === 0
      && forgedReport.numeric_text === 0 && forgedReport.dropped_on_load === 0;
    A('A11', 'HOLE vs REPORT: some published number must distinguish a forged map from an honest one',
      `on the forged state every compliance number reads clean: ${JSON.stringify(forgedReport)}`,
      !(allGreen && forgedReport.places_drawn > honestLive.place_count),
      'a forged map that fills the province must move at least one published number');

    // ---- A12. Is the seal an INTEGRITY check or an AUTHENTICITY check? -------------------------
    // My first version of this check grepped the save manifest for the string "signature" and
    // PASSED — on `regionSignature`/`focusSignature`, which have nothing to do with saves. An
    // inert check that passes for the wrong reason is worse than no check, so it is replaced by
    // two executed arms that distinguish the two properties the word "seal" conflates:
    //   A12a  edit the sealed bytes WITHOUT resealing -> must be refused (integrity works)
    //   A12b  reseal the edited blob with the game's own writer -> is it still refused?
    //         (authenticity — and this is the property that stops a forger)
    let a12a = null, a12b = null;
    try {
      const ex = await import('/game/src/save/exchange.js');
      const honestBytes = ex.exportSave(honestBlob);
      const dec = new TextDecoder().decode(honestBytes);
      const nl = dec.indexOf('\n');
      const tampered = dec.slice(0, nl + 1) + dec.slice(nl + 1).replace(/"revealed":\s*\d+/, '"revealed":99999');
      try { H.importSave(new TextEncoder().encode(tampered)); a12a = 'ACCEPTED'; }
      catch (e) { a12a = 'refused: ' + String(e.message).slice(0, 90); }
      try { H.importSave(ex.exportSave(forgedAll)); a12b = 'ACCEPTED'; }
      catch (e) { a12b = 'refused: ' + String(e.message).slice(0, 90); }
    } catch (e) { a12a = a12b = 'could not run: ' + String(e.message).slice(0, 90); }
    A('A12a', 'INTEGRITY: bytes edited after sealing must be refused',
      String(a12a), String(a12a).startsWith('refused'), 'refused — the sha-256 over the body works');
    A('A12b', 'AUTHENTICITY: a forged blob RESEALED by the game\'s own writer must still be refused',
      String(a12b), String(a12b).startsWith('refused'),
      'refused — an unkeyed digest stops corruption, not a forger who can recompute it');

    // =========================================================================================
    // Q — "NO API BY WHICH A QUEST COULD TOUCH THE MAP", EXECUTED
    // =========================================================================================
    await H.loadState('default');
    D.restore(null); sim.discovery = D;
    const desc = Object.getOwnPropertyDescriptor(sim, 'discovery');
    const questHoldsSim = !!(eng.questEngine && eng.questEngine.sim === sim);
    A('Q1', 'sim.discovery must not be a writable slot the quest machine holds a reference to',
      `writable=${desc ? desc.writable : 'n/a'} configurable=${desc ? desc.configurable : 'n/a'}; questEngine.sim === sim: ${questHoldsSim}`,
      !(desc && desc.writable && questHoldsSim),
      'non-writable, or not reachable from the quest machine');

    const forgedModel = (ids) => ({
      cols, rows, cell, revealedCells: total, revealedFrac: 1, observations: 1,
      seenCell: () => true, seenAt: () => true,
      places: () => Object.freeze(ids), hasPlace: () => true, placeCount: ids.length,
      suspended: false, stoodCells: total,
      placePos: (id) => { const p = pois.find((q) => q.id === id); return p ? [p.pos[0], p.pos[2]] : [100, 100]; },
      raster: () => new Uint8Array((total + 7) >> 3).fill(0xFF), footprint: () => [],
      serialise: () => ({ stood: '', cells: '', places: [], revealed: 0 }),
      restore: () => ({ dropped: [] }), lastRestore: null,
      mutatorReport: () => [], restoreReads: ['stood'],
    });
    const realD = sim.discovery;
    // Q2 — the route through the object the QUEST MACHINE itself holds. `QuestEngine` is constructed
    // with the sim (`engine.js:538`) and stores it (`machine.js:79`); `engine.js:8141` re-assigns it
    // on every rebind. So `this.sim.discovery = …` is a line a quest-machine method could contain.
    let q2 = -1, q2err = null;
    try {
      const qe = eng.questEngine;
      qe.sim.discovery = forgedModel(['lilmoth', 'blackrose', 'stormhold']);
      const st = openMap();
      q2 = st.elements.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming').length;
      H.closeMenu();
    } catch (e) { q2err = String(e.message).slice(0, 160); }
    sim.discovery = realD;
    A('Q2', 'writing sim.discovery from the object the quest machine holds must not draw squares',
      q2err ? `refused: ${q2err}` : `squares drawn from a model installed via questEngine.sim: ${q2}`,
      q2err !== null || q2 <= 0, 'refused or inert');

    // Q3 — THE BACK DOOR THE BRIEF NAMES. `main.js:24` publishes `window.__ENGINE`. Capability
    // prohibitions are installed on the harness, so they do not cover it.
    let q3 = -1, q3err = null, q3Covered = null;
    try {
      const rep = H.getCapabilityReport ? JSON.stringify(H.getCapabilityReport()) : '';
      q3Covered = rep.includes('__ENGINE');
    } catch (e) { q3Covered = null; }
    try {
      window.__ENGINE.sim.discovery = forgedModel(['lilmoth', 'blackrose']);
      const st = openMap();
      q3 = st.elements.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming').length;
      H.closeMenu();
    } catch (e) { q3err = String(e.message).slice(0, 160); }
    sim.discovery = realD;
    A('Q3', 'the window.__ENGINE back door must not reach a map setter either',
      q3err ? `refused: ${q3err}` : `squares drawn via window.__ENGINE.sim.discovery = forged: ${q3}; capability report mentions __ENGINE: ${q3Covered}`,
      q3err !== null || q3 <= 0, 'refused or inert');

    // Q4 — the honest half: the model's OWN surface really does refuse to name a place.
    // The comparison is BEFORE-vs-AFTER, not "zero". My first version asserted `placeCount === 0`
    // and went red at 1 — because the default start position is inside Lilmoth's own pad, so the
    // body legitimately stands in a place before anything is attempted. A fixture that mistakes
    // the spawn point for an attack is how a false finding gets filed.
    const q4Before = sim.discovery.places().slice();
    const marker = H.tryPlaceMapMarker ? H.tryPlaceMapMarker('blackrose') : null;
    const markerWorked = marker && Array.isArray(marker.attempts)
      ? marker.attempts.filter((a) => a.ok === true || a.result === 'installed' || a.result === 'added' || a.result === 'pushed')
      : [];
    const q4After = sim.discovery.places().slice();
    A('Q4', 'no method ON the model accepts a place — tryPlaceMapMarker tries them all',
      `attempts=${marker && marker.attempts ? marker.attempts.length : 0}, succeeded=${markerWorked.length}, places [${q4Before.join(',') || 'none'}] -> [${q4After.join(',') || 'none'}]`,
      markerWorked.length === 0 && q4After.join(',') === q4Before.join(','), 'every attempt refused, the place list unchanged');

    // =========================================================================================
    // U — UNDISCOVERED IS UNRENDERED, AT THE RENDERER
    // =========================================================================================
    if (breakMode === 'unrendered') {
      const origModel = eng.ui._mapModel.bind(eng.ui);
      eng.ui._mapModel = (ctx) => { const m = origModel(ctx); m.seen = () => true; return m; };
      notes.push('BREAK unrendered: the screen draws every cell regardless of discovery');
    }
    await H.loadState('default');
    D.restore(null); sim.discovery = D;
    const uFaults0 = faults.length;
    const inkBlank = terrainInk();
    A('U1', 'EMPTY MAP: the terrain box holds ONE colour — no coastline is readable',
      `distinct=${inkBlank.distinct} over ${inkBlank.pixels}px, dominant=${inkBlank.dominant} (${(inkBlank.dominant_frac * 100).toFixed(2)}%), drawn_cells=${inkBlank.meta_drawn}`,
      inkBlank.distinct === 1 && inkBlank.meta_drawn === 0, 'exactly 1 colour, 0 cells drawn');
    A('U2', 'NOT DRAWN-THEN-MASKED: no channel varies anywhere in the undiscovered ground',
      `per-channel range across the box = ${JSON.stringify(inkBlank.channel_range)}`,
      inkBlank.channel_range[0] === 0 && inkBlank.channel_range[1] === 0 && inkBlank.channel_range[2] === 0,
      '[0,0,0] — a province drawn at low alpha leaks its height raster as a range');
    for (let i = 0; i < 8; i++) walkTo(2400 + i * 150, 3200);
    const inkPart = terrainInk();
    A('U3', 'PARTIAL: the discovered ground appears and the undiscovered hex is unchanged',
      `distinct ${inkBlank.distinct} -> ${inkPart.distinct}, dominant ${inkPart.dominant} at ${(inkPart.dominant_frac * 100).toFixed(2)}%, drawn ${inkPart.meta_drawn}/${inkPart.meta_total}`,
      inkPart.distinct > 1 && inkPart.dominant === inkBlank.dominant && inkPart.dominant_frac > 0.5,
      'more colours, same ground colour, still the majority');
    A('U4', 'PRECONDITION: the U block stepped',
      `faults=${faults.length - uFaults0}, drawn after walking=${inkPart.meta_drawn}`,
      faults.length - uFaults0 === 0 && inkPart.meta_drawn > 0, 'no faults, non-empty map');
    if (breakMode === 'unrendered') delete eng.ui._mapModel;

    // =========================================================================================
    // E — HOVER NAMES: STOOD IN, NOT ENTERED, NOT NEARBY, NOT TOLD
    // =========================================================================================
    await H.loadState('default');
    D.restore(null); sim.discovery = D;
    const eSite = siteOf('thorn') || eng.field.sites[0];
    // E3 — BEING TOLD. The quest machine's own place channel (`engine.js:2314` calls
    // `questEngine.learnFrom('place', o.site_mark)` when the player reads a signpost) plus the
    // knowledge and topic channels. None of them may put a square on the map.
    //
    // THE BASELINE IS TAKEN AFTER STEPPING, and that repair is the point. My first version took it
    // immediately after `loadState('default')` and watched placeCount go 0 -> 1, which reads
    // exactly like "being told revealed a place" and is not: the default start position is inside
    // LILMOTH'S OWN PAD, so the four steps that follow the tells record the ground the body is
    // already standing on. Filed as written it would have been a false finding about the build.
    step(4);                                    // let the spawn cell register FIRST
    const beforeTold = D.places().slice();
    const toldAttempts = [];
    const tryTell = (label, fn) => { try { fn(); toldAttempts.push(`${label}: ran`); } catch (e) { toldAttempts.push(`${label}: threw`); } };
    tryTell("questEngine.learnFrom('place', site)", () => eng.questEngine.learnFrom('place', eSite.id));
    tryTell('setWorldKnowledge', () => H.setWorldKnowledge && H.setWorldKnowledge({ places: [eSite.id] }));
    tryTell('learnTopic', () => H.learnTopic && H.learnTopic(eSite.id));
    step(4);
    const afterTold = D.places().slice();
    A('E3', 'being TOLD about a place must not put a square on the map',
      `places [${beforeTold.join(',') || 'none'}] -> [${afterTold.join(',') || 'none'}] after [${toldAttempts.join('; ')}] (baseline taken AFTER the spawn cell registered)`,
      afterTold.join(',') === beforeTold.join(','), 'unchanged');
    walkTo(eSite.x, eSite.z);
    const stE = openMap();
    const eSquares = stE.elements.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming');
    const eNaming = stE.elements.find((e) => e.id === 'map.naming');
    const eMapRep = stE.map;
    H.closeMenu();
    const ids = eSquares.map((e) => e.meta.place);
    A('E4', 'ONE square per place personally stood in, and no duplicates',
      `squares=${eSquares.length} discovered=${D.placeCount} unique ids=${new Set(ids).size} [${ids.join(',')}]`,
      eSquares.length === D.placeCount && new Set(ids).size === eSquares.length, 'equal, unique');
    // The naming element names `places[placeIdx]`, which is the FIRST place discovered until the
    // stick is moved — Lilmoth, from the spawn — not the place last walked into. Asserting it must
    // say "Thorn" was a bug in this instrument, not a finding. The property S35 actually requires
    // is that whatever it names, the string is that place's own name out of `pois.json`.
    const namedId = eNaming ? eNaming.meta.place : null;
    const ePoi = pois.find((p) => p.id === namedId);
    const poiNames = new Set(pois.map((p) => p.name));
    A('E5', "the name is the named PLACE's own name from pois.json, not a quest string",
      `naming="${eNaming ? eNaming.text : '(none)'}" names place "${namedId}" whose pois.name is "${ePoi ? ePoi.name : '?'}"`,
      !!eNaming && !!ePoi && eNaming.text === ePoi.name && poiNames.has(eNaming.text),
      'identical to that place\'s world-data name');
    A('E6', 'S35 surface refusals on the drawn map: no markers, routes, numerals, travel or quest identity',
      `markers=${eMapRep.markers} routes=${eMapRep.routes_drawn} numerals=[${eMapRep.numeric_text.join(',') || 'none'}] travel=[${eMapRep.travel_affordances.join(',') || 'none'}] quest_bearing=[${eMapRep.quest_bearing_elements.join(',') || 'none'}] reachable_from_journal=${eMapRep.reachable_from_journal}`,
      eMapRep.markers === 0 && eMapRep.routes_drawn === 0 && eMapRep.numeric_text.length === 0
      && eMapRep.travel_affordances.length === 0 && eMapRep.quest_bearing_elements.length === 0
      && eMapRep.reachable_from_journal === false,
      'all zero and no "show on map" route from the journal');

    // =========================================================================================
    // G — CONSUMPTION (RI-MTH07)
    // =========================================================================================
    const armHash = async (ablate) => {
      await H.loadState('default');
      sim.discovery.restore(null);
      if (ablate) sim.discovery.suspend(); else sim.discovery.resume();
      const e0 = faults.length;
      for (let i = 0; i < 8; i++) walkTo(1800 + i * 160, 900);      // rule 8: the target must move
      for (let k = 0; k < 6; k++) {
        step(100);
        if (breakMode === 'consumer') {
          // A REAL world-side consumer, so an assertion whose pass condition is "nothing happened"
          // can be seen to notice something happening. Durable on purpose: a stamina perturbation
          // regenerates away before the hash is taken and the control does nothing.
          if (sim.progression) sim.progression.gold = (sim.progression.gold || 0) + (sim.discovery.revealedCells > 0 ? 1 : 0);
        }
      }
      sim.discovery.resume();
      return { hash: worldHash(), revealed: sim.discovery.revealedCells, places: sim.discovery.placeCount, faults: faults.length - e0 };
    };
    const armFull = await armHash(false);
    const armNone = await armHash(true);
    sim.discovery.resume();
    A('G1', 'ABLATION IS REAL: the model records in arm A and records nothing in arm B',
      `full: ${armFull.revealed} cells / ${armFull.places} places — ablated: ${armNone.revealed} cells / ${armNone.places} places`,
      armFull.revealed > 0 && armNone.revealed === 0, 'arm A non-zero, arm B zero');
    A('G1b', 'the two arms are comparable: the same number of step faults in each',
      `full=${armFull.faults} ablated=${armNone.faults}`, armFull.faults === armNone.faults, 'equal');
    A('G2', 'RI-MTH07: a world-side consumer exists — destroying the model changes the running world',
      `world hash (discovery blob excluded) full=${armFull.hash} ablated=${armNone.hash} differ=${armFull.hash !== armNone.hash}`,
      armFull.hash !== armNone.hash,
      'the hashes DIFFER — identical means the only consumer is the map screen\'s own draw call');

    const red = R.filter((c) => !c.pass).map((c) => c.id);
    return {
      schema: 'elder-souls/critic-map-r2@1',
      break: breakMode || 'none',
      expected_red: breakMode ? (EXPECT_RED[breakMode] || []) : [],
      expected_green: breakMode ? (EXPECT_GREEN[breakMode] || []) : [],
      red, notes, faults: faults.slice(0, 6), fault_count: faults.length,
      retake: { clean, hostile: hostileArm },
      honest: honestLive, forged_all: liveAll, a9, forged_report: forgedReport,
      arms: { full: armFull, ablated: armNone },
      checks: R, passed: R.filter((c) => c.pass).length, total: R.length,
    };
  }, brk);
}

// ---- reporting ---------------------------------------------------------------------------------
let bad = 0;
for (const rep of reports) {
  log(`\n=== critic-map-r2  break=${rep.break}  ${rep.passed}/${rep.total} ===`);
  for (const c of rep.checks) log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id}  ${c.name}\n         got:  ${c.got}\n         want: ${c.target}`);
  for (const n of rep.notes) log(`  note: ${n}`);
  if (rep.fault_count) log(`  note: ${rep.fault_count} step fault(s): ${rep.faults[0] || ''}`);
  if (rep.break === 'none') {
    if (rep.passed !== rep.total) { log(`  FINDINGS (S35 assertions that failed): ${rep.red.join(', ')}`); bad++; }
  } else {
    const hitRed = rep.expected_red.filter((id) => rep.red.includes(id));
    const green = rep.expected_green || [];
    const hitGreen = green.filter((id) => !rep.red.includes(id));
    const okRed = hitRed.length === rep.expected_red.length;
    const okGreen = hitGreen.length === green.length;
    if (okRed && okGreen) {
      const parts = [];
      if (hitRed.length) parts.push(`turned ${hitRed.join(',')} red`);
      if (hitGreen.length) parts.push(`turned ${hitGreen.join(',')} GREEN`);
      log(`  SELF-TEST OK: --break ${rep.break} ${parts.join(' and ')}, as designed`);
    } else {
      log(`  SELF-TEST FAILED: --break ${rep.break} expected red=[${rep.expected_red.join(',')}] green=[${green.join(',')}]; red was [${rep.red.join(',') || 'nothing'}]`);
      bad++;
    }
  }
}
writeJson(path.join(outDir, 'critic-map-r2.json'), { schema: 'elder-souls/critic-map-r2@1', reports });
if (args.json) log(JSON.stringify(reports, null, 2));
log(`\nwrote ${path.join(outDir, 'critic-map-r2.json')}`);
process.exit(bad ? EXIT.FAIL : EXIT.OK);
