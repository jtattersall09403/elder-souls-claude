#!/usr/bin/env node
/**
 * critic-w1-13-e.mjs — W1-13 round-1 critic, probe E: DOES THE BODY STAY AT THE WELL?
 *
 * RI-JRN06 D6 is one sentence: "They are standing at the HEARTH they last rested at." The
 * builder measured the respawn frame and a 50-frame settle at ONE well and reported 16.97 m
 * and 0.00 m. Probe D's walked loop respawned and, 220 frames later, the body was 89.42 m from
 * the basin — which is not standing at the hearth, and it silently shortens every run back.
 *
 * This probe samples the position from the respawn frame outward at several wells, with a
 * MATCHED no-death control that stands at the same well for the same frames, so a drift that
 * is the province's is separated from a drift that is the respawn's.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-e.mjs [--out <file>]'); process.exit(0); }
const out = { schema: 'critic/w1-13-e@1', wells: [] };
let handle;

const SAMPLES = [0, 10, 30, 60, 120, 220, 400];

try {
  handle = await launchGame({ ...args, width: 640, height: 400 });
  const h = handle;
  await h.h('setRenderRate', 0);
  const list = await h.h('listHearths');
  const picks = ['hearth-archon', 'hearth-lilmoth', 'hearth-gideon', 'hearth-stormhold', 'hearth-blackrose', 'hearth-cross-01']
    .map((id) => list.hearths.find((x) => x.id === id)).filter(Boolean);

  for (const w of picks) {
    // --- the death path ---------------------------------------------------------------
    await h.h('loadState', 'default');
    await h.h('teleport', w.pos[0], w.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', w.id);
    await h.h('teleport', w.pos[0] + 45, w.pos[2] + 45);
    await h.h('stepFrames', 3);
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 150);          // the surface closes and the respawn happens here
    const respawnFrame = (await h.h('snapshot')).player.pos.slice();
    const dSeries = [{ frames_after_respawn: 0, dist_from_basin_m: +Math.hypot(respawnFrame[0] - w.pos[0], respawnFrame[2] - w.pos[2]).toFixed(2) }];
    let last = 0;
    for (const f of SAMPLES.slice(1)) {
      await h.h('stepFrames', f - last); last = f;
      const p = (await h.h('snapshot')).player.pos;
      dSeries.push({ frames_after_respawn: f, dist_from_basin_m: +Math.hypot(p[0] - w.pos[0], p[2] - w.pos[2]).toFixed(2) });
    }

    // --- the matched control: stand at the same well, no death, same frames -------------
    await h.h('loadState', 'default');
    await h.h('teleport', w.pos[0], w.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', w.id);
    const cSeries = [];
    last = 0;
    for (const f of SAMPLES) {
      if (f > last) { await h.h('stepFrames', f - last); last = f; }
      const p = (await h.h('snapshot')).player.pos;
      cSeries.push({ frames: f, dist_from_basin_m: +Math.hypot(p[0] - w.pos[0], p[2] - w.pos[2]).toFixed(2) });
    }

    const row = {
      hearth: w.id, kind: w.kind, region: w.region, basin: w.pos,
      after_death: dSeries, control_no_death: cSeries,
      dist_on_respawn_frame_m: dSeries[0].dist_from_basin_m,
      dist_at_220f_m: (dSeries.find((s) => s.frames_after_respawn === 220) || {}).dist_from_basin_m,
      control_dist_at_220f_m: (cSeries.find((s) => s.frames === 220) || {}).dist_from_basin_m,
      // D6 asks that the player is STANDING AT the well. The well's own interact radius is the
      // only threshold the build itself publishes, so it is the one used here.
      interact_radius_m: w.interact_radius_m,
      within_interact_radius_at_220f: ((dSeries.find((s) => s.frames_after_respawn === 220) || {}).dist_from_basin_m || 0) <= (w.interact_radius_m || 3),
    };
    out.wells.push(row);
    log(`${w.id}: respawn frame ${row.dist_on_respawn_frame_m} m from basin -> ${row.dist_at_220f_m} m at 220 f  (control, no death: ${row.control_dist_at_220f_m} m)`);
  }

  out.summary = {
    wells: out.wells.length,
    max_dist_on_respawn_frame_m: Math.max(...out.wells.map((r) => r.dist_on_respawn_frame_m)),
    max_dist_at_220f_m: Math.max(...out.wells.map((r) => r.dist_at_220f_m || 0)),
    max_control_at_220f_m: Math.max(...out.wells.map((r) => r.control_dist_at_220f_m || 0)),
    wells_still_at_the_basin_at_220f: out.wells.filter((r) => r.within_interact_radius_at_220f).length,
  };
  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
  log(JSON.stringify(out.summary));
} catch (e) {
  out.error = String(e && e.stack || e);
  if (args.out) writeJson(args.out, out);
  log('critic-w1-13-e: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}
