#!/usr/bin/env node
/**
 * critic-w1-13-d.mjs — W1-13 round-1 critic, probe D: THE LOOP, WALKED, AND THE FOG-GATE RULE.
 *
 * D1  THE JOURNEY, END TO END, WALKED. Rest at a well; walk out; die on the ground the walk
 *     reached; respawn; WALK BACK; touch the bloom. Seam S34(b): the run back is evidence of
 *     ARRIVAL, so no part of it may be teleported. The only teleport in this trial is the
 *     scenario setup before the rest.
 * D2  The fog-gate placement rule at several offsets from the arena centre. `placeStain()`
 *     normalises by `Math.hypot(dx, dz) || 1`, so the behaviour at dx=dz=0 is worth a number.
 * D3  M-D18 / M-D19 re-run by the critic: what a player standing at the respawn well can reach,
 *     and what the HUD draws during the run back.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-d.mjs [--out <file>]'); process.exit(0); }
const out = { schema: 'critic/w1-13-d@1', walked_loop: null, fog_gate: [], no_travel: null, markers: null };
let handle;
const SOULS = 4200;

try {
  handle = await launchGame({ ...args, width: 960, height: 540 });
  const h = handle;
  await h.h('setRenderRate', 0);

  // ---- D1: the loop, walked --------------------------------------------------------------
  {
    await h.h('loadState', 'default');
    const list = await h.h('listHearths');
    const w = list.hearths.find((x) => x.id === 'hearth-archon') || list.hearths[0];
    await h.h('teleport', w.pos[0], w.pos[2]);
    await h.h('stepFrames', 3);
    await h.h('restAt', w.id);
    const b = await h.h('saveState'); b.character.souls_held = SOULS; await h.h('restoreState', b);
    await h.h('stepFrames', 2);

    // WALK out. Sample bearings first so a rejected ray is a statement about the marsh and
    // not about the probe (the builder's own note; it is right and it is reused here).
    let outLeg = null, bearingUsed = null;
    for (let a = 0; a < 24 && !outLeg; a++) {
      const th = (a / 24) * Math.PI * 2;
      const tx = w.pos[0] + Math.sin(th) * 220, tz = w.pos[2] + Math.cos(th) * 220;
      const r = await h.h('walkPath', [[w.pos[0], w.pos[2]], [tx, tz]], { speed: 'walk', miredAbort: 1200, stuckAbort: 600 });
      if (r && r.arrived) { outLeg = r; bearingUsed = +(th * 180 / Math.PI).toFixed(1); }
      else { await h.h('teleport', w.pos[0], w.pos[2]); await h.h('stepFrames', 2); }
    }
    if (!outLeg) { out.walked_loop = { skipped: 'no walkable 220 m bearing out of hearth-archon in 24 tries' }; }
    else {
      const deathPos = (await h.h('snapshot')).player.pos.slice();
      const heldBefore = (await h.h('getDeathState')).souls_held;
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 220);
      const woke = await h.h('getDeathState');
      const respawnPos = (await h.h('snapshot')).player.pos.slice();
      const bloom = woke.bloodstain;
      // WALK BACK. Nothing is teleported. `walkPath` starts by placing the body at points[0],
      // which is where it already is, so the walk is the whole distance.
      const back = await h.h('walkPath', [[respawnPos[0], respawnPos[2]], [bloom.pos[0], bloom.pos[2]]],
        { speed: 'walk', miredAbort: 1200, stuckAbort: 900, arrive_m: 1.5 });
      await h.h('stepFrames', 4);
      const after = await h.h('getDeathState');
      const arrivedAt = (await h.h('snapshot')).player.pos.slice();
      out.walked_loop = {
        hearth: w.id, bearing_deg: bearingUsed,
        out_leg: { arrived: outLeg.arrived, path_m: outLeg.path_m, frames: outLeg.frames, minutes: outLeg.minutes },
        death_pos: deathPos, souls_at_death: heldBefore,
        respawn_pos: respawnPos, respawn_hearth: woke.last_respawn ? woke.last_respawn.at : null,
        respawn_dist_from_well_m: +Math.hypot(respawnPos[0] - w.pos[0], respawnPos[2] - w.pos[2]).toFixed(2),
        bloom_pos: bloom.pos, bloom_souls: bloom.souls,
        run_back: { arrived: back.arrived, path_m: back.path_m, frames: back.frames, minutes: back.minutes, aborted: back.aborted || null },
        arrived_at: arrivedAt,
        dist_arrived_to_bloom_m: +Math.hypot(arrivedAt[0] - bloom.pos[0], arrivedAt[2] - bloom.pos[2]).toFixed(2),
        souls_after: after.souls_held,
        bloom_after: after.bloodstain_count,
        recovered_exactly: after.souls_held === SOULS,
        // R1 band is 1.5–3.0 min, R2 ceiling 4.0 min. One walk is one sample, and it is labelled.
        r1_band_1p5_to_3p0: back.minutes >= 1.5 && back.minutes <= 3.0,
        evidence_kind: 'walked (S34(b): the run back is arrival evidence and was not teleported)',
      };
      log(`D1 walked loop: out ${outLeg.path_m} m / ${outLeg.minutes} min; back ${back.path_m} m / ${back.minutes} min; recovered ${after.souls_held}/${SOULS}`);
    }
  }

  // ---- D2: the fog-gate rule at several offsets ------------------------------------------
  {
    const list = await h.h('listHearths');
    const gate = list.fog_gates[0];
    for (const off of [0, 0.001, 0.5, 5, 20]) {
      await h.h('loadState', 'default');
      await h.h('teleport', list.hearths[0].pos[0], list.hearths[0].pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', list.hearths[0].id);
      const bb = await h.h('saveState'); bb.character.souls_held = SOULS; await h.h('restoreState', bb);
      await h.h('teleport', gate.pos[0] + off, gate.pos[2]);
      await h.h('stepFrames', 4);
      const p = (await h.h('snapshot')).player.pos.slice();
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 220);
      const d = await h.h('getDeathState');
      const rec = d.deaths[d.deaths.length - 1];
      const dist = Math.hypot(rec.stain_pos[0] - gate.pos[0], rec.stain_pos[2] - gate.pos[2]);
      out.fog_gate.push({
        offset_from_centre_m: off, death_pos: p,
        placement_rule: rec.placement_rule,
        stain_dist_from_centre_m: +dist.toFixed(3),
        gate_radius_m: gate.radius_m,
        // RI-PRG04 §6: "placed OUTSIDE the fog gate, so recovering it never requires
        // re-entering the fight."
        outside_the_gate: dist > (gate.radius_m || 26),
      });
    }
    log('D2 fog gate: ' + out.fog_gate.map((r) => `${r.offset_from_centre_m}m->${r.stain_dist_from_centre_m}m ${r.outside_the_gate ? 'OUT' : 'INSIDE'}`).join('  '));
  }

  // ---- D3: M-D18 / M-D19 -------------------------------------------------------------------
  {
    await h.h('loadState', 'default');
    const list = await h.h('listHearths');
    const w = list.hearths.find((x) => x.id === 'hearth-archon');
    await h.h('teleport', w.pos[0], w.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', w.id);
    const menu = (await h.h('listHearths')).menu_sample
      || (await h.hOpt('hearthMenu', w.id));
    const stations = await h.hOpt('listStations');
    const net = await h.hOpt('getTravelNetwork');
    await h.h('teleport', w.pos[0] + 60, w.pos[2] + 60);
    await h.h('stepFrames', 3);
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 220);
    const ui = await h.hOpt('getUIState');
    const d = await h.h('getDeathState');
    out.no_travel = {
      hearth_menu_destinations: menu ? menu.destinations : 'no hearth menu surface exposed',
      travel_stations: stations ? (stations.stations ? stations.stations.length : (Array.isArray(stations) ? stations.length : null)) : null,
      travel_services: net ? (net.services ? net.services.length : null) : null,
      // S7 in both directions: the network must EXIST, and no station may sit on a well.
      min_station_to_hearth_m: (() => {
        const st = stations && (stations.stations || stations);
        if (!Array.isArray(st) || !st.length) return null;
        let best = Infinity, pair = null;
        for (const s2 of st) {
          const sp = s2.pos || s2.position;
          if (!sp) continue;
          for (const hh of list.hearths) {
            const dd = Math.hypot(sp[0] - hh.pos[0], sp[2] - hh.pos[2]);
            if (dd < best) { best = dd; pair = [s2.id, hh.id]; }
          }
        }
        return best === Infinity ? null : { m: +best.toFixed(1), pair };
      })(),
      compensation_block: d.compensation,
    };
    out.markers = ui ? {
      markers: ui.markers, map_exists: ui.map_exists,
      elements: (ui.elements || []).map((e) => ({ id: e.id, kind: e.kind, worldAnchor: e.worldAnchor || null, text: e.text || null })),
      world_anchored: (ui.elements || []).filter((e) => e.worldAnchor).length,
    } : 'getUIState() absent';
    log(`D3: hearth destinations ${JSON.stringify(out.no_travel.hearth_menu_destinations)}; markers ${JSON.stringify(out.markers && out.markers.markers)}; world-anchored HUD elements ${out.markers && out.markers.world_anchored}`);
  }

  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
} catch (e) {
  out.error = String(e && e.stack || e);
  if (args.out) writeJson(args.out, out);
  log('critic-w1-13-d: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}
