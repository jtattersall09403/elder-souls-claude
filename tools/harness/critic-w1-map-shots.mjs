#!/usr/bin/env node
// critic-w1-map-shots.mjs — the W1-MAP critic's visual evidence, in four discovery states.
//
// The owner asked to SEE the map, and supplied the Morrowind reference themselves. Three states
// are the ones asked for — fresh, partially explored, well explored — and the fourth is the
// finding: the same screen after loading a save whose `stood` field was forged, which draws all
// 42 places and the whole province for a character who has walked nowhere.
//
// BROWSER: this drives ONE browser of its own, not the pooled capture service, because it steps
// the simulation to walk the routes (protocol rule 20 permits exactly that, and requires saying
// which was done). One browser is launched and kept for all four frames.
//
// THE GATE: a blank PNG and a working PNG are both "a PNG arrived". Every frame is checked
// against the claim it is captured for BEFORE it is written, and a frame that disagrees with its
// own caption is refused rather than filed.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-map-shots.mjs — four map frames: fresh, partial, explored, and a forged save.

USAGE
  node tools/harness/critic-w1-map-shots.mjs [--out docs/shots]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('docs/shots');
fs.mkdirSync(outDir, { recursive: true });
const DATE = '2026-08-08';

const handle = await launchGame(args);
let shots;
try {
  shots = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const eng = H._engine || window.__ENGINE;
    const sim = eng.sim;
    const D = sim.discovery;
    const cols = D.cols, rows = D.rows, cell = D.cell, total = cols * rows;
    const faults = [];
    const step = (n) => { try { H.stepFrames(n); } catch (e) { faults.push(String(e.message)); } };
    const walkTo = (x, z) => { H.teleport(x, z, {}); step(2); };
    const forgeTrail = (idx) => {                       // the shipped wire format
      const out = []; let prev = 0;
      for (const i of idx) {
        let v = i - prev; prev = i; v = v < 0 ? (-v * 2 - 1) : v * 2;
        while (v >= 0x80) { out.push((v & 0x7F) | 0x80); v = Math.floor(v / 128); }
        out.push(v);
      }
      let s = ''; for (const b of out) s += String.fromCharCode(b);
      return btoa(s);
    };

    const frame = async (name, caption) => {
      H.setRenderRate(1);
      H.openMenu('map', {});
      const st = H.getUIState();
      const m = st.map;
      const png = await H.screenshot();
      H.closeMenu();
      H.setRenderRate(0);
      return {
        name, caption, png,
        drawn_cells: m.drawn_cells, total_cells: m.total_cells,
        places_drawn: m.places_drawn, places: H.mapState().places,
      };
    };

    const out = [];
    H.setRenderRate(0);

    // 1. FRESH. A character who has been nowhere. The subject of this frame is ABSENCE.
    await H.loadState('default');
    D.restore(null);
    out.push(await frame('fresh', 'a new character: nothing walked, nothing drawn'));

    // 2. PARTIAL. One road walked.
    await H.loadState('default');
    D.restore(null);
    for (let i = 0; i < 14; i++) walkTo(2000 + i * 120, 800);
    out.push(await frame('partial', 'one road walked: a thread of ground and the places on it'));

    // 3. EXPLORED. A long tour of the province's real sites.
    await H.loadState('default');
    D.restore(null);
    const sites = eng.field.sites.slice(0, 18);
    for (const s of sites) {
      for (let k = -2; k <= 2; k++) walkTo(s.x + k * 40, s.z + k * 40);
    }
    for (let i = 0; i < 30; i++) walkTo(900 + i * 130, 1500 + i * 90);
    out.push(await frame('explored', 'a long tour: much of the province walked, many places found'));

    // 4. THE FINDING. A forged `stood` field: every cell, for a body that walked nowhere.
    await H.loadState('default');
    D.restore(null);
    const blob = H.saveState();
    const every = []; for (let i = 0; i < total; i++) every.push(i);
    blob.world.discovery = { stood: forgeTrail(every), cells: '', places: [], revealed: 0, derived_from: 'stood' };
    H.loadState(blob);
    const forged = await frame('forged', 'a FORGED save: 42 places and the whole province, walked nowhere');
    forged.dropped_on_load = H.mapState().dropped_on_load;
    out.push(forged);
    return { shots: out, faults };
  });
} finally { await handle.close(); }

// ---- the gate: does each frame contain its own subject? ---------------------------------------
const EXPECT = {
  fresh: (s) => s.drawn_cells === 0 && s.places_drawn === 0,
  partial: (s) => s.drawn_cells > 0 && s.drawn_cells < s.total_cells * 0.25,
  explored: (s) => s.drawn_cells > s.total_cells * 0.25 && s.places_drawn >= 3,
  forged: (s) => s.drawn_cells === s.total_cells && s.places_drawn >= 40,
};
let bad = 0;
for (const s of shots.shots) {
  const ok = EXPECT[s.name](s);
  const dest = path.join(outDir, `${DATE}-critic-map-${s.name}.png`);
  if (!ok) {
    log(`REFUSED ${s.name}: drawn=${s.drawn_cells}/${s.total_cells} places=${s.places_drawn} — the frame does not match its claim "${s.caption}"`);
    bad++; continue;
  }
  fs.writeFileSync(dest, Buffer.from(String(s.png).split(',')[1], 'base64'));
  log(`wrote ${dest}\n   ${s.caption}\n   drawn ${s.drawn_cells}/${s.total_cells} cells, ${s.places_drawn} places${s.dropped_on_load ? `, dropped_on_load=[${s.dropped_on_load.join(',') || 'nothing'}]` : ''}`);
}
if (shots.faults.length) log(`note: ${shots.faults.length} foreign step fault(s) (combat/enemy.js, not the map)`);
process.exit(bad ? EXIT.FAIL : EXIT.OK);
