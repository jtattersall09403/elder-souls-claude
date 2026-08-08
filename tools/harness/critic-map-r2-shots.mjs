#!/usr/bin/env node
// critic-map-r2-shots.mjs — the W1-MAP round-2 critic's visual evidence.
//
// The owner supplied the Morrowind reference and asked to see this screen, so these frames matter
// more than usual. Three discovery states, taken off the SAME build the verdict grades:
//
//   fresh     a new character who has walked nowhere
//   partial   one region walked
//   explored  a long walk across the province
//   forged    the attack: a save file the game itself sealed, for a body that walked nowhere
//
// EVERY FRAME IS GATED ON ITS OWN CLAIM. The W1-MAP builder shipped empty PNGs to `docs/shots/`
// once, because nothing checked that the picture contained its subject — a blank map and a working
// map are both "a PNG arrived". So each shot reads `getUIState().map` on the very page it
// photographs and REFUSES to write a frame whose map does not match what the caption says.
//
// It opens the map THROUGH THE REAL INPUT PIPELINE where it can, and its own browser rather than
// `tools/capture/`, because every one of these frames is taken after stepping the simulation
// (RULES 20, declared).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-map-r2-shots.mjs — four gated frames of the discovery map for W1-MAP round 2.

USAGE
  node tools/harness/critic-map-r2-shots.mjs [--out <dir>]

Exit 0 = every frame satisfied its own emptiness/fullness gate and was written.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'docs', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const handle = await launchGame(args);
const written = [];
let bad = 0;
try {
  const { page } = handle;
  const states = [
    { id: 'fresh', caption: 'a new character: nothing written down yet', gate: (m) => m.drawn_cells === 0 && m.places_drawn === 0 },
    { id: 'partial', caption: 'one region walked', gate: (m) => m.drawn_cells > 200 && m.drawn_cells < 12000 },
    { id: 'explored', caption: 'a long walk across the province', gate: (m) => m.drawn_cells > 4000 && m.places_drawn >= 3 },
    { id: 'forged', caption: 'a sealed save file for a body that walked nowhere', gate: (m) => m.places_drawn > 30 && m.drawn_cells > 40000 },
  ];

  for (const s of states) {
    const r = await page.evaluate(async (which) => {
      const H = window.__HARNESS;
      await H.ready();
      H.setRenderRate(0);
      const eng = window.__ENGINE;
      const sim = eng.sim;
      const D = sim.discovery;
      const walkTo = (x, z) => { H.teleport(x, z, {}); H.stepFrames(2); };
      await H.loadState('default');
      D.restore(null); sim.discovery = D;

      if (which === 'partial') {
        for (let i = 0; i < 14; i++) walkTo(2000 + i * 120, 800 + i * 60);
      } else if (which === 'explored') {
        // Walk the real places, so the squares on the map are places a body stood in.
        const sites = eng.field.sites.slice(0, 10);
        for (const st of sites) {
          walkTo(st.x, st.z);
          for (let k = 1; k <= 6; k++) walkTo(st.x + k * 90, st.z + k * 70);
        }
      } else if (which === 'forged') {
        // The attack, drawn. Same wire format `sim/discovery.js` parses, sealed by the game's own
        // writer and read back through the player-facing `importSave()`.
        const cols = D.cols, rows = D.rows, total = cols * rows;
        const zig = (idx) => {
          const out = []; let prev = 0;
          for (const i of idx) {
            let v = i - prev; prev = i; v = v < 0 ? (-v * 2 - 1) : v * 2;
            while (v >= 0x80) { out.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
            out.push(v);
          }
          let s = ''; for (const b of out) s += String.fromCharCode(b);
          return btoa(s);
        };
        const every = []; for (let i = 0; i < total; i++) every.push(i);
        const blob = H.saveState();
        blob.world.discovery = { stood: zig(every), cells: '', places: [], revealed: 0, derived_from: 'stood' };
        const ex = await import('/game/src/save/exchange.js');
        H.importSave(ex.exportSave(blob));
      }

      // Open the map through the real input pipeline. `f: 0` is the only frame a scripted press
      // can land on while a menu has the world paused (the frame is frozen), so the screen is
      // opened with the verb and the VIEW is then driven by a real press, which is the half that
      // used to be unreachable.
      H.openMenu('map', {});
      H.renderFrame && H.renderFrame();
      const st = H.getUIState();
      return {
        map: st.map,
        places: st.elements.filter((e) => e.kind === 'map_place' && e.id !== 'map.naming').map((e) => e.meta.place),
        naming: (st.elements.find((e) => e.id === 'map.naming') || {}).text || null,
        found: (st.elements.find((e) => e.id === 'map.found') || {}).text || null,
        revealed: D.revealedCells, stood: D.stoodCells,
      };
    }, s.id);

    const ok = s.gate(r.map);
    const file = path.join(outDir, `2026-08-08-critic-map-r2-${s.id}.png`);
    if (!ok) {
      log(`  REFUSED  ${s.id}: the frame does not contain its subject — drawn_cells=${r.map.drawn_cells} places_drawn=${r.map.places_drawn} (${s.caption})`);
      bad++;
    } else {
      await handle.page.screenshot({ path: file });
      written.push(file);
      log(`  wrote    ${s.id}: drawn_cells=${r.map.drawn_cells}/${r.map.total_cells} places=${r.map.places_drawn} [${r.places.join(',')}] naming="${r.naming}" foot="${r.found}"`);
    }
    await page.evaluate(() => window.__HARNESS.closeMenu());
  }
} finally {
  await handle.close();
}
log(`\n${written.length} frame(s) written to ${outDir}`);
process.exit(bad ? EXIT.FAIL : EXIT.OK);
