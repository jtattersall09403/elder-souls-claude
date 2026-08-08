#!/usr/bin/env node
// critic-w1-map-r1.mjs — the W1-MAP round-1 critic's instrument. ARBITRATION seam S35.
//
// EVERY ASSERTION HERE IS AN S35 REQUIREMENT. A FAIL IS A FINDING ABOUT THE BUILD, not about the
// tool. It exists because `tools/harness/map-probe.mjs` cannot answer four questions, and in three
// of them it cannot answer BY CONSTRUCTION rather than by oversight:
//
//   A — THE FORGED FOOTPRINT. map-probe L3 forges `world.discovery.places`, which is exactly the
//       field `Discovery.RESTORE_READS` was narrowed to EXCLUDE. The only field that IS read
//       (`stood`) is forged nowhere in this build. A1-A8 forge it, IN THE WIRE FORMAT THE SHIPPED
//       CODE ACTUALLY PARSES — a zigzag-varint delta trail of cell indices. A raw bitset (which is
//       what the builder's own status file still describes) decodes to nothing, so an attacker who
//       got the format wrong would wrongly credit the map with a defence it does not have.
//   B — REACHABILITY, EXECUTED. `api.js tryPlaceMapMarker` records "questEngine writes
//       sim.discovery = forged" as an attempt it declines to run. B1-B2 run it.
//   C — UNRENDERED, AT THE FRAMEBUFFER. map-probe S8 asserts `drawn_cells < half the province`, a
//       number the layout reports about itself. C1-C3 count DISTINCT COLOURS inside the terrain
//       box, EXCLUDING the player chevron — which is drawn on top of it and which, counted
//       naively, fakes 15 colours on a map that is in fact perfectly blank.
//   F — CONSUMPTION in RI-MTH07's sense. map-probe's C-block perturbs DATA and watches PIXELS.
//       RI-MTH07 asks for a world-side consumer: perturb the model, watch an ENTITY change. F2
//       ablates the model and hashes the running world with the discovery blob REMOVED from the
//       hash — without that exclusion the arms differ trivially because the save carries the map.
//
// SELF-TEST — `--break <what>` breaks THE THING UNDER TEST and asserts this tool goes red:
//   unrendered  the screen draws every cell regardless of discovery    -> C1,C2,C3 red
//   standing    a place is discovered by proximity rather than standing -> D1 red
//   consumer    install a real world-side reader of the model           -> F2 red
//   all         every break in sequence
//
// The `consumer` break is the one that matters: F2's pass condition is "the world did not change",
// and an assertion that passes when nothing happens is worthless until somebody has shown it can
// see something happen.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-map-r1.mjs — forged-footprint attack (in the real wire format), executed reachability,
unrendered pixel test and the world-side-consumer ablation for W1-MAP (ARBITRATION S35).

USAGE
  node tools/harness/critic-w1-map-r1.mjs [--break <what>] [--json] [--out <dir>]

OPTIONS
  --break <what>  unrendered | standing | consumer | all
  --out <dir>     default reports/runs/CRITIC-W1-MAP
  --json          print the whole report
  --help          this message

Exit 0 = every S35 assertion held (or, under --break, the expected assertions went red).
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'CRITIC-W1-MAP');
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
    const A = (id, name, got, pass, target) => {
      R.push({ id, name, got: typeof got === 'object' ? JSON.stringify(got) : String(got), target, pass: !!pass });
      return !!pass;
    };
    const notes = [];
    // `unrendered` and `standing` break a property that currently HOLDS, so the named checks
    // must go RED. `consumer` is the other polarity and it is the important one: F2 currently
    // FAILS (nothing in the world reads the map), so the falsification is to install a real
    // consumer and require F2 to go GREEN. An assertion whose pass condition is "nothing
    // happened" is worth nothing until it has been shown to notice something happening.
    const EXPECT = { unrendered: ['C1', 'C2', 'C3'], standing: ['D1'], consumer: [] };
    const EXPECT_GREEN = { consumer: ['F2'] };

    const eng = H._engine || window.__ENGINE;
    const sim = eng.sim;
    const D = sim.discovery;
    const cols = D.cols, rows = D.rows, cell = D.cell;
    const total = cols * rows;

    // The tree currently throws inside the fixed step from `combat/enemy.js _idleBehaviour`
    // ("this.ai.step is not a function") on some routes; enemy AI is being rewritten by another
    // piece as this runs. `critic-w1-map-stepcheck.mjs` reproduces it with `sim.discovery`
    // removed entirely, so it is the tree's and not the map's. Guarded and COUNTED here, because
    // an ablation whose two arms threw different numbers of times is not an ablation.
    const stepErrors = [];
    const step = (n) => { try { H.stepFrames(n); return true; } catch (e) { stepErrors.push(String(e.message)); return false; } };
    const walkTo = (x, z) => { H.teleport(x, z, {}); step(2); };
    const openMap = () => { H.openMenu('map', {}); return H.getUIState(); };
    const siteOf = (id) => eng.field.sites.find((s) => s.id === id);

    // ---- THE WIRE FORMAT. Copied from `sim/discovery.js`'s own `zigzag()`. ------------------
    // A forged save has to speak the format the loader parses. This is that format: cell indices
    // in walk order, delta-coded, zigzagged, varint-packed, base64'd.
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
    // A hash of the world EXCLUDING the discovery blob.
    const worldHash = () => {
      const b = H.saveState();
      if (b.world) delete b.world.discovery;
      const s = JSON.stringify(b);
      let a = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 0x01000193) >>> 0; }
      return (a >>> 0).toString(16).padStart(8, '0') + ':' + s.length;
    };

    // =========================================================================================
    // A — THE FORGED SAVE, AIMED AT THE ONE FIELD `restore()` ACTUALLY READS
    // =========================================================================================
    await H.loadState('default');
    D.restore(null);
    const startSite = siteOf('thorn') || eng.field.sites[0];
    walkTo(startSite.x, startSite.z);
    const honestLive = H.mapState();
    const honestBlob = H.saveState();
    A('A0', 'BASELINE: an honest walk to one place discovers that place, and the save round-trips',
      `places=[${honestLive.places.join(',')}] revealed=${honestLive.revealed_cells} stood_chars=${(honestBlob.world.discovery.stood || '').length}`,
      honestLive.place_count >= 1 && honestLive.revealed_cells > 0, '>=1 place, >0 cells');

    const totalPois = (eng.data.pois.pois || []).length;

    // ---- A_fmt. PROVE THE ATTACK IS DELIVERABLE before crediting any defence. -----------------
    // A forged trail of ONE cell the body never stood in. If this does not move the model, the
    // format is wrong and every "the forgery failed" result below would be a false negative.
    const proofIdx = cellIndexAt(4200, 4800);
    D.restore({ stood: forgeTrail([proofIdx]) });
    const proofOk = D.stoodCells === 1 && D.seenCell(proofIdx % cols, (proofIdx / cols) | 0);
    A('Afmt', 'PRECONDITION: a forged trail in the real wire format reaches the model at all',
      `one forged cell -> stood_cells=${D.stoodCells}, that cell revealed=${D.seenCell(proofIdx % cols, (proofIdx / cols) | 0)}`,
      proofOk, 'the forgery is delivered — otherwise every A-result below is a false negative');

    // ---- A1/A2/A3. THE WHOLE-PROVINCE FORGERY ------------------------------------------------
    // Every cell index, in order. Forge ONLY `stood`, and leave the redundant claim fields empty,
    // which is the shape a forger would write: nothing for the model's own audit to disagree with.
    const everyCell = [];
    for (let i = 0; i < total; i++) everyCell.push(i);
    const forgedAll = JSON.parse(JSON.stringify(honestBlob));
    forgedAll.world.discovery = { stood: forgeTrail(everyCell), cells: '', places: [], revealed: 0, derived_from: 'stood' };
    H.loadState(forgedAll);
    const liveAll = H.mapState();
    A('A1', 'S35: no square for a place the body has not stood in — a forged `stood` must not mint them',
      `place_count=${liveAll.place_count} of ${totalPois} pois (the honest walk gave ${honestLive.place_count})`,
      liveAll.place_count <= honestLive.place_count, 'no more places than the body actually stood in');
    A('A2', 'S35: undiscovered is unrendered — a forged `stood` must not reveal the province',
      `revealed=${liveAll.revealed_cells}/${total} (${((liveAll.revealed_cells / total) * 100).toFixed(1)}%)`,
      liveAll.revealed_cells <= honestLive.revealed_cells, 'no more ground than was walked');
    A('A2b', 'and the load audit must refuse it',
      `dropped_on_load=[${(liveAll.dropped_on_load || []).join(',') || 'nothing'}]`,
      (liveAll.dropped_on_load || []).length > 0, 'the forgery is reported');
    const stAll = openMap();
    const squaresAll = stAll.elements.filter((e) => e.id.startsWith('map.place.'));
    const mAll = stAll.map;
    H.closeMenu();
    A('A3', 'THE SCREEN: a forged footprint must not draw phantom squares',
      `map_place squares drawn=${squaresAll.length}, drawn_cells=${mAll.drawn_cells}/${mAll.total_cells}`,
      squaresAll.length <= honestLive.place_count, 'no phantom squares rendered');

    // ---- A4/A5. IS THE COMPLIANCE INSTRUMENT CAPABLE OF NOTICING? ----------------------------
    A('A4', "the screen's compliance report must not be a fixed point on its own model",
      `places_drawn=${mAll.places_drawn} places_discovered=${mAll.places_discovered} — map-probe S7 compares exactly these two`,
      !(mAll.places_drawn === mAll.places_discovered && squaresAll.length > honestLive.place_count),
      'either no forgery, or a report that can tell drawn-from-forged apart');
    const lastRestore = D.lastRestore || {};
    const published = Object.keys(liveAll).concat(Object.keys(mAll));
    const publishesFootprintAudit = published.includes('phantom_cells') || published.includes('stood_cells')
      || published.includes('missing_cells');
    A('A5', 'the footprint-disagreement signal restore() computes must reach an instrument',
      `Discovery.lastRestore=[${Object.keys(lastRestore).join(',')}]; published=${publishesFootprintAudit}`,
      publishesFootprintAudit,
      'phantom_cells / missing_cells / stood_cells published — save/state.js keeps only .dropped');

    // ---- A6. THE TARGETED FORGERY — the round-1 attack's exact shape, through the survivor ----
    const want = ['lilmoth', 'blackrose'];
    const idxs = [];
    for (const id of want) {
      const s = siteOf(id) || (() => { const p = (eng.data.pois.pois || []).find((q) => q.id === id); return p ? { x: p.pos[0], z: p.pos[2] } : null; })();
      if (s) idxs.push(cellIndexAt(s.x, s.z));
    }
    idxs.sort((a, b) => a - b);
    const forgedTwo = JSON.parse(JSON.stringify(honestBlob));
    forgedTwo.world.discovery = { stood: forgeTrail(idxs), cells: '', places: [], revealed: 0, derived_from: 'stood' };
    H.loadState(forgedTwo);
    const liveTwo = H.mapState();
    const gotWanted = want.filter((id) => liveTwo.places.includes(id));
    A('A6', 'a TARGETED forged footprint must not name the places the forger chose',
      `asked [${want.join(',')}], map shows [${liveTwo.places.join(',')}], dropped=[${(liveTwo.dropped_on_load || []).join(',') || 'nothing'}]`,
      gotWanted.length === 0, 'neither place appears');

    // ---- A7. map-probe L3's OWN assertion, replayed against a footprint forgery ---------------
    const l3SaysRefused = (liveTwo.dropped_on_load || []).includes('lilmoth') && !liveTwo.places.includes('lilmoth');
    A('A7', 'map-probe L3 must be able to see the forgery it is aimed at',
      `L3 verdict "refused"=${l3SaysRefused}; the live map holds lilmoth=${liveTwo.places.includes('lilmoth')}`,
      !(liveTwo.places.includes('lilmoth') && !l3SaysRefused),
      'L3 goes red when a place the body never stood in is on the map');

    // ---- A8. Is the one trusted field guarded at all? -----------------------------------------
    let guarded = false;
    try {
      const s = JSON.stringify(H.getSaveManifest()).toLowerCase();
      guarded = s.includes('hmac') || s.includes('signature') || s.includes('tamper');
    } catch (e) { /* absent */ }
    A('A8', 'the one field the map trusts is guarded by an integrity check',
      `the save manifest declares a signature/HMAC/tamper check: ${guarded}`, guarded,
      'some check — narrowing to a single trusted field made forgery simpler, not harder');

    // =========================================================================================
    // B — REACHABILITY, EXECUTED RATHER THAN DECLARED
    // =========================================================================================
    const desc = Object.getOwnPropertyDescriptor(sim, 'discovery');
    const questHoldsSim = !!(eng.questEngine && eng.questEngine.sim === sim);
    A('B1', 'sim.discovery must not be a writable slot reachable from the quest machine',
      `writable=${desc ? desc.writable : 'n/a'} configurable=${desc ? desc.configurable : 'n/a'}; questEngine.sim===sim: ${questHoldsSim}`,
      !(desc && desc.writable && questHoldsSim),
      'non-writable, or not reachable — api.js declares this route "not defended"');
    const forgedModel = {
      cols, rows, cell, revealedCells: total, revealedFrac: 1, observations: 1,
      seenCell: () => true, seenAt: () => true,
      places: () => Object.freeze(['lilmoth', 'blackrose', 'stormhold']),
      hasPlace: () => true, placeCount: 3, suspended: false, stoodCells: total,
      placePos: (id) => { const p = (eng.data.pois.pois || []).find((q) => q.id === id); return p ? [p.pos[0], p.pos[2]] : [100, 100]; },
      raster: () => new Uint8Array(((total + 7) >> 3)).fill(0xFF), footprint: () => [],
      serialise: () => ({ stood: '', cells: '', places: [], revealed: 0 }),
      restore: () => ({ dropped: [] }), lastRestore: null,
    };
    const realD = sim.discovery;
    let swapDrawn = -1;
    try {
      sim.discovery = forgedModel;              // the line tryPlaceMapMarker declines to execute
      const stSwap = openMap();
      swapDrawn = stSwap.elements.filter((e) => e.id.startsWith('map.place.')).length;
      H.closeMenu();
    } catch (e) { swapDrawn = -1; notes.push('substitution threw: ' + e.message); }
    sim.discovery = realD;
    A('B2', 'substituting the model must not put squares on the drawn map',
      `squares drawn from a substituted model: ${swapDrawn}`, swapDrawn <= 0, 'refused or inert');

    // =========================================================================================
    // C — UNRENDERED, READ AT THE FRAMEBUFFER (chevron excluded)
    // =========================================================================================
    if (breakMode === 'unrendered') {
      const origModel = eng.ui._mapModel.bind(eng.ui);
      eng.ui._mapModel = (ctx) => { const m = origModel(ctx); m.seen = () => true; return m; };
      notes.push('BREAK unrendered: the screen now draws every cell regardless of discovery');
    }
    const terrainInk = () => {
      H.openMenu('map', {});
      const S = eng.ui.S;
      const terr = S.elements.find((e) => e.kind === 'map_terrain');
      const plr = S.elements.find((e) => e.kind === 'map_player');
      const box = terr.rect;
      const x0 = Math.round(box[0]) + 2, y0 = Math.round(box[1]) + 2;
      const w = Math.max(1, Math.round(box[2]) - 4), hgt = Math.max(1, Math.round(box[3]) - 4);
      const img = S.ctx.getImageData(x0, y0, w, hgt).data;
      // The player chevron and the naming label are drawn INSIDE this box and are permitted by
      // S35. Counting them as "rendered terrain" invents a finding: a blank map reads as 15
      // colours purely because of the chevron's antialiased edge.
      const pr = plr ? plr.rect : [-9, -9, 0, 0];
      const seen = new Map();
      let counted = 0;
      for (let py = 0; py < hgt; py++) {
        for (let px = 0; px < w; px++) {
          const gx = x0 + px, gy = y0 + py;
          if (gx >= pr[0] - 3 && gx <= pr[0] + pr[2] + 3 && gy >= pr[1] - 3 && gy <= pr[1] + pr[3] + 3) continue;
          const i = (py * w + px) * 4;
          const k = (img[i] << 16) | (img[i + 1] << 8) | img[i + 2];
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
        meta_drawn: terr.meta.drawn_cells, meta_total: terr.meta.total_cells,
      };
    };
    // A CLEAN WORLD FIRST. The forged loads above leave the fight in a state that trips the
    // tree's current enemy-AI fault, and a walk whose steps threw is a walk that recorded
    // nothing — which would read as a map defect and is not one. Faults are counted per block.
    await H.loadState('default');
    D.restore(null); sim.discovery = D;
    const cFaults0 = stepErrors.length;
    const inkEmpty = terrainInk();
    A('C1', 'EMPTY MAP: the terrain box holds ONE colour — no coastline is readable',
      `distinct=${inkEmpty.distinct} over ${inkEmpty.pixels}px, dominant=${inkEmpty.dominant} (${(inkEmpty.dominant_frac * 100).toFixed(2)}%), drawn_cells=${inkEmpty.meta_drawn}`,
      inkEmpty.distinct === 1 && inkEmpty.meta_drawn === 0,
      'exactly 1 distinct colour and 0 cells drawn');
    for (let i = 0; i < 10; i++) walkTo(2000 + i * 130, 800);
    const inkSome = terrainInk();
    A('C2', 'PARTIAL: the undiscovered ground is still the screen ground and still dominates',
      `distinct=${inkSome.distinct}, dominant=${inkSome.dominant} at ${(inkSome.dominant_frac * 100).toFixed(2)}%, drawn=${inkSome.meta_drawn}/${inkSome.meta_total}`,
      inkSome.distinct > 1 && inkSome.dominant === inkEmpty.dominant && inkSome.dominant_frac > 0.5,
      'many colours, the undiscovered hex still the majority');
    A('C3', 'the unrendered ground carries no shade gradient (drawn-then-masked would leak one)',
      `empty-map distinct colours=${inkEmpty.distinct}`, inkEmpty.distinct === 1,
      '1 — a masked province leaks its height raster as many near-black shades');
    A('C0', 'PRECONDITION: the walk this block measures actually stepped the world',
      `foreign step faults during C: ${stepErrors.length - cFaults0}, cells drawn after walking: ${inkSome.meta_drawn}`,
      stepErrors.length - cFaults0 === 0 && inkSome.meta_drawn > 0,
      'no faults and a non-empty map — otherwise C2 measures a walk that never happened');
    if (breakMode === 'unrendered') delete eng.ui._mapModel;

    // =========================================================================================
    // D — THE SQUARE APPEARS ONLY AFTER STANDING, AND NAMES THE PLACE
    // =========================================================================================
    await H.loadState('default');
    D.restore(null); sim.discovery = D;
    const dFaults0 = stepErrors.length;
    const site = siteOf('thorn') || eng.field.sites[0];
    let origHasPlace = null;
    if (breakMode === 'standing') {
      const proto = Object.getPrototypeOf(D);
      origHasPlace = proto.hasPlace;
      proto.hasPlace = function (id) {
        if (origHasPlace.call(this, id)) return true;
        // Proximity discovery, which S35 forbids: "within a few hundred metres" counts as found.
        const s = eng.field.sites.find((q) => q.id === id);
        const p = sim.player;
        if (!s || !p || !p.pos) return false;
        const dx = p.pos[0] - s.x, dz = p.pos[2] - s.z;
        return Math.sqrt(dx * dx + dz * dz) <= (s.r_flat || 25) + 600;
      };
      notes.push('BREAK standing: hasPlace() now returns true for anything merely SEEN');
    }
    walkTo(site.x + site.r_flat + 400, site.z + 200);
    const afterRegion = D.hasPlace(site.id);
    const intRegion = !!(sim.env && sim.env.interior);
    walkTo(site.x + site.r_flat + 40, site.z);
    const afterNear = D.hasPlace(site.id);
    walkTo(site.x, site.z);
    const afterStand = D.hasPlace(site.id);
    const intStand = !!(sim.env && sim.env.interior);
    A('D1', 'a square appears ONLY after standing in the pad — not on region entry, not when near',
      `region(+${Math.round(site.r_flat) + 400}m):${afterRegion} near(+40m):${afterNear} standing:${afterStand} (interior at stand=${intStand}, at region=${intRegion})`,
      afterRegion === false && afterNear === false && afterStand === true, 'false / false / true');
    if (breakMode === 'standing') Object.getPrototypeOf(D).hasPlace = origHasPlace;

    const stName = openMap();
    const naming = stName.elements.find((e) => e.id === 'map.naming');
    const squares = stName.elements.filter((e) => e.id.startsWith('map.place.'));
    const poiRec = (eng.data.pois.pois || []).find((p) => p.id === site.id);
    H.closeMenu();
    A('D2', 'the hover name is the PLACE name out of pois.json, not a quest string',
      `naming="${naming ? naming.text : '(none)'}" pois.name="${poiRec ? poiRec.name : '?'}"`,
      !!naming && !!poiRec && naming.text === poiRec.name, 'identical to the world-data name');
    A('D3', 'the naming element carries no quest, objective or travel identity',
      JSON.stringify(naming ? naming.meta : {}),
      !!naming && naming.meta.quest === null && naming.meta.objective === null && naming.meta.travel === false,
      'quest:null objective:null travel:false');
    A('D0', 'PRECONDITION: the walk this block measures actually stepped the world',
      `foreign step faults during D: ${stepErrors.length - dFaults0}`,
      stepErrors.length - dFaults0 === 0,
      'no faults — otherwise D1 measures a body that never moved');
    A('D4', 'one square per discovered place, and no more',
      `squares=${squares.length} discovered=${D.placeCount}`,
      squares.length === D.placeCount, 'equal');

    // =========================================================================================
    // F — CONSUMPTION (RI-MTH07): does ANY entity in the world read this model?
    // =========================================================================================
    const armHash = async (ablate) => {
      await H.loadState('default');
      sim.discovery.restore(null);
      if (ablate) sim.discovery.suspend(); else sim.discovery.resume();
      const errBefore = stepErrors.length;
      for (let i = 0; i < 8; i++) walkTo(1800 + i * 160, 900);   // rule 8: the target must move
      for (let k = 0; k < 6; k++) {
        step(100);
        if (breakMode === 'consumer') {
          // A REAL world-side consumer, installed so F2 can be seen to fail: an entity whose
          // state is a function of how much of the province this character has seen. The positive
          // control for an assertion whose pass condition is "nothing happened".
          // Must be DURABLE. Stamina was the first choice and it regenerates to full before the
          // hash is taken, so the control did nothing and the self-test passed vacuously.
          if (sim.progression) sim.progression.gold = (sim.progression.gold || 0) + (sim.discovery.revealedCells > 0 ? 1 : 0);
        }
      }
      sim.discovery.resume();
      return {
        hash: worldHash(), revealed: sim.discovery.revealedCells,
        places: sim.discovery.placeCount, step_errors: stepErrors.length - errBefore,
      };
    };
    const armFull = await armHash(false);
    const armNone = await armHash(true);
    sim.discovery.resume();
    A('F1', 'ABLATION IS REAL: the model records in arm A and records nothing in arm B',
      `full: ${armFull.revealed} cells / ${armFull.places} places — ablated: ${armNone.revealed} cells / ${armNone.places} places`,
      armFull.revealed > 0 && armNone.revealed === 0,
      'arm A non-zero, arm B zero — otherwise the ablation is inert and F2 proves nothing');
    A('F1b', 'and the two arms are comparable: the same number of foreign step faults in each',
      `step faults full=${armFull.step_errors} ablated=${armNone.step_errors}`,
      armFull.step_errors === armNone.step_errors, 'equal');
    A('F2', 'RI-MTH07: a world-side consumer exists — destroying the model changes the world',
      `world hash (discovery blob excluded) full=${armFull.hash} ablated=${armNone.hash} differ=${armFull.hash !== armNone.hash}`,
      armFull.hash !== armNone.hash,
      'the hashes DIFFER — identical means the only consumer is the map screen\'s own draw call');

    const red = R.filter((c) => !c.pass).map((c) => c.id);
    return {
      schema: 'elder-souls/critic-w1-map@1',
      break: breakMode || 'none',
      expected_red: breakMode ? (EXPECT[breakMode] || []) : [],
      expected_green: breakMode ? (EXPECT_GREEN[breakMode] || []) : [],
      red, notes, step_errors: stepErrors.slice(0, 5), step_error_count: stepErrors.length,
      ink_empty: inkEmpty, ink_partial: inkSome,
      honest: honestLive, forged_all: liveAll, forged_targeted: liveTwo,
      arms: { full: armFull, ablated: armNone },
      checks: R,
      passed: R.filter((c) => c.pass).length,
      total: R.length,
    };
  }, brk);
}

// ---- reporting --------------------------------------------------------------------------------
let bad = 0;
for (const rep of reports) {
  log(`\n=== critic-w1-map-r1  break=${rep.break}  ${rep.passed}/${rep.total} ===`);
  for (const c of rep.checks) log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id}  ${c.name}\n         got:  ${c.got}\n         want: ${c.target}`);
  for (const n of rep.notes) log(`  note: ${n}`);
  if (rep.step_error_count) log(`  note: ${rep.step_error_count} foreign step fault(s) (combat/enemy.js, not the map): ${rep.step_errors[0] || ''}`);
  if (rep.break === 'none') {
    if (rep.passed !== rep.total) { log(`  FINDINGS (S35 assertions that failed): ${rep.red.join(', ')}`); bad++; }
  } else {
    const hitRed = rep.expected_red.filter((id) => rep.red.includes(id));
    const green = (rep.expected_green || []);
    const hitGreen = green.filter((id) => !rep.red.includes(id));
    const okRed = hitRed.length === rep.expected_red.length;
    const okGreen = hitGreen.length === green.length;
    if (okRed && okGreen) {
      const parts = [];
      if (hitRed.length) parts.push(`turned ${hitRed.join(',')} red`);
      if (hitGreen.length) parts.push(`turned ${hitGreen.join(',')} GREEN (the check can see a consumer when one exists)`);
      log(`  SELF-TEST OK: --break ${rep.break} ${parts.join(' and ')}, as designed`);
    } else {
      log(`  SELF-TEST FAILED: --break ${rep.break} expected red=[${rep.expected_red.join(',')}] green=[${green.join(',')}]; red was [${rep.red.join(',') || 'nothing'}]`);
      bad++;
    }
  }
}
writeJson(path.join(outDir, 'critic-w1-map-r1.json'), { schema: 'elder-souls/critic-w1-map@1', reports });
if (args.json) log(JSON.stringify(reports, null, 2));
log(`\nwrote ${path.join(outDir, 'critic-w1-map-r1.json')}`);
process.exit(bad ? EXIT.FAIL : EXIT.OK);
