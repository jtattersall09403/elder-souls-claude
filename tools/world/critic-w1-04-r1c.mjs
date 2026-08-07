#!/usr/bin/env node
/** critic-w1-04-r1c — AR-2 (Souls convention leaking into the world) over W1-04's own surface,
 *  plus the second half of the render finding: is the interior drawn for ANY of the 115? */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson, log } from '../lib/cli.mjs';
const args = parseArgs(process.argv.slice(2));
const handle = await launchGame({ timeout: 90000, width: 960, height: 540 });
const H = (fn, ...a) => handle.page.evaluate(({ f, a }) => (new Function('h','E',`return (${f})(h,E,...${JSON.stringify(a)})`))(window.__HARNESS, window.__ENGINE), { f: fn.toString(), a });
const R = {};
try {
  R.ar2 = await H((h, E) => {
    const s = h.__w1_04_settlement('thorn');
    h.teleport(s.pos[0] + 4, s.pos[2] + 4); h.setTimeOfDay(12); h.stepFrames(6);
    const out = { markers: null, marker_err: null, map_pin: null, hearths_in_town: null, ui: null };
    try { out.markers = h.getDrawnMarkers(); } catch (e) { out.marker_err = String(e.message).split('\n')[0]; }
    try { out.map_pin = h.tryPlaceMapMarker({ x: s.pos[0], z: s.pos[2] }); } catch (e) { out.map_pin = 'THREW: ' + String(e.message).split('\n')[0]; }
    try { out.hearths_in_town = h.listHearths().filter((x) => Math.hypot(x.pos[0] - s.pos[0], x.pos[2] - s.pos[2]) < (s.radius_m || 60)).length; } catch (e) { out.hearths_in_town = 'ERR ' + e.message; }
    try { out.ui = h.getUIState(); } catch (e) { out.ui = 'ERR'; }
    return out;
  });
  // Sweep every interior: does ANY of them switch the drawn cell through the door?
  R.sweep = await H((h, E) => {
    const vis = () => { const o = []; for (const k of Object.keys(E.renderer.cells)) if (E.renderer.cells[k].visible) o.push(k); return o; };
    const ids = h.listInteriors().map((i) => i.id);
    h.exitInterior && (E.sim.env.interior = null); E._applyCell(); h.stepFrames(2);
    const start = vis();
    const rows = [];
    for (const id of ids) {
      E.sim.env.interior = null; E._applyCell(); h.stepFrames(1);
      const before = vis();
      let r; try { r = h.enterInterior(id); } catch (e) { rows.push({ id, error: String(e.message).split('\n')[0] }); continue; }
      h.stepFrames(3); h.renderFrame();
      const after = vis();
      rows.push({ id, entered: !!(r && r.entered), reason: r && r.reason || null, before, after, switched: JSON.stringify(before) !== JSON.stringify(after) });
    }
    return { start, total: rows.length, switched: rows.filter((x) => x.switched).length,
      entered: rows.filter((x) => x.entered).length, refused: rows.filter((x) => x.entered === false).length,
      errors: rows.filter((x) => x.error).length, sample: rows.slice(0, 4), any_switched: rows.filter((x) => x.switched).map((x) => x.id) };
  });
  log(JSON.stringify(R, null, 1).slice(0, 2500));
} finally { writeJson(args.out || 'reports/critic-w1-04-r1c.json', R); await handle.close(); }
