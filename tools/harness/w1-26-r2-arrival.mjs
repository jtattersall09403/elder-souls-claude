#!/usr/bin/env node
// w1-26-r2-arrival.mjs — does the opening ARRIVE anywhere, and does the province hitch land in it?
//
// Owner: W1-26 round 2. The round-2 dispatch put three tree-wide changes under this piece and
// this is the second: the province streamer now runs from the fixed step, so a walked opening
// builds the world around the player — but an ARRIVAL frame costs 337-484 ms and drops about
// 2.2 s of simulation, "so if your opening arrives somewhere, that hitch lands in it."
//
// So the question is not "is the streamer slow" — that is `W1-01`'s piece and its verdict.
// The question is whether THE OPENING ARRIVES, which is a fact about this scene's own shape:
//
//   * the whole creation happens in two interiors, `barge-hold` and `writ-house`;
//   * `sim/settlement.js leaveInterior()` does not walk you out, it calls `placeBody()` on the
//     interior's declared `continuity.exterior_spawn` — a teleport;
//   * so the first time the player is outdoors is a PLACEMENT at a province coordinate the
//     streamer has never been asked for. That is an arrival by any definition the province
//     piece uses, and it is the last thing that happens in this scene.
//
// WHAT THIS MEASURES, and what it deliberately does not. It reports the residency the exit
// point needs and how much of it exists before the door is used, and the wall-clock cost of the
// frames either side. Wall-clock on this box is contended and `AGENT-PROTOCOL` says so: "rates,
// counts and booleans survive contention; milliseconds do not." The residency figures are
// counts and are reported as the finding; the milliseconds are reported as an upper bound with
// the load average recorded beside them.
//
// USAGE
//   node tools/harness/w1-26-r2-arrival.mjs [--json <path>]
'use strict';

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, log, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-26-r2-arrival.mjs — the opening's exit as a province arrival.

USAGE
  node tools/harness/w1-26-r2-arrival.mjs [--json <path>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = path.join(REPORTS_DIR, 'journeys');
ensureDir(outDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, 'w1-26-r2-arrival.json');

const say = (s) => process.stdout.write(s + '\n');
const loadavg = readFileSync('/proc/loadavg', 'utf8').trim();
const out = { schema: 'elder-souls/w1-26-arrival@1', piece: 'W1-26', loadavg, checks: {}, failures: [], passes: [] };
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => { out.passes.push(m); say(`  pass  ${m}`); };

const handle = await launchGame({ ...args, width: 320, height: 240 });

try {
  const r = await handle.page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    await H.ready();
    await H.setRenderRate(0);
    await H.setSeed(1337);
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    let qi = 0;
    for (let guard = 0; guard < 200; guard++) {
      const st = H.getCensusState();
      if (st.done) break;
      if (st.paused) { H.censusEnter(st.resume_by); continue; }
      const inp = st.input;
      if (!inp) { H.censusAnswer(null); continue; }
      let v;
      if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
      else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
      else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
      else if (st.node === 'writ.class-routes') v = 'questionnaire';
      else v = (inp.options && inp.options[0]) ? inp.options[0].id : null;
      H.censusAnswer(v);
    }

    // Where the scene leaves you, and where the door would put you. Both read off the data the
    // door itself uses (`continuity.exterior_spawn`), not guessed.
    const interior = E.sim.env.interior;
    const rec = interior ? E.sim.settlements.interior(interior) : null;
    const spawnOut = rec && rec.continuity ? rec.continuity.exterior_spawn : null;
    const inside = E.sim.player.pos.slice();

    // Residency BEFORE the door is used: how much of what a camera at the exit point needs
    // already exists. A budget of 0 builds nothing, so this is a pure read.
    const beforeStats = spawnOut ? H.streamAround(spawnOut[0], spawnOut[2], 0) : null;
    // Put it back where it was: a pure read still moves `focus`, and the next call must not
    // measure the consequence of this one.
    if (spawnOut) H.streamAround(inside[0], inside[2], 0);

    // THE ARRIVAL ITSELF, timed. Walk out through the real door rather than teleporting: the
    // door is what the player presses, and `sim.doorVeto` holds it until the writ is stamped,
    // so this also proves the veto has lifted.
    //
    // AND THE PLAYER HAS TO WALK TO IT. The way out is reach-gated on the interior's own
    // `continuity.interior_spawn` at DOOR_REACH_M, which is this round's own fix — before it,
    // the out-door had no proximity test at all and a press anywhere inside teleported you 3.9 km
    // onto the Tidewrack dock with the census still paused. My first draft of this probe pressed
    // interact where the scene leaves you, 4.4 m from the door, and reported "the door did not
    // open" as a build failure. It is the gate working. Walk first.
    const face = rec && rec.continuity ? rec.continuity.interior_spawn : null;
    const walkTo = (tgt) => {
      for (let a = 0; a < 30 && tgt; a++) {
        const p = E.sim.player.pos;
        const d = Math.hypot(tgt[0] - p[0], tgt[2] - p[2]);
        if (d <= 1.2) break;
        const yaw = (H.getPlayerStats().yaw || 0) * Math.PI / 180;
        const dx = tgt[0] - p[0], dz = tgt[2] - p[2];
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
        const n = Math.max(1e-6, Math.hypot(fwd, str));
        const step = [];
        for (let i = 0; i < 20; i++) step.push({ f: i, move: [str / n, fwd / n] });
        H.queueInputs(step); H.stepFrames(20);
      }
    };
    walkTo(face);
    const atDoor = E.sim.player.pos.slice();
    const doorSeen = E.sim.door ? { way: E.sim.door.way, dist_m: E.sim.door.dist_m } : null;
    const t0 = performance.now();
    H.queueInputs([{ f: 0, press: ['interact'] }, { f: 1, release: ['interact'] }]);
    H.stepFrames(2);
    const tExit = performance.now() - t0;
    const leftAt = E.sim.player.pos.slice();
    const nowInterior = E.sim.env.interior;

    // The frames right after the arrival, one at a time, so a single expensive one is visible
    // rather than averaged away.
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const a = performance.now();
      H.stepFrames(1);
      frames.push(+(performance.now() - a).toFixed(1));
    }
    const afterStats = H.streamAround(leftAt[0], leftAt[2], 0);

    return {
      exited: nowInterior == null,
      interior_at_end_of_scene: interior,
      exterior_spawn: spawnOut,
      pos_inside: inside.map((n) => +n.toFixed(2)),
      interior_spawn: rec && rec.continuity ? rec.continuity.interior_spawn : null,
      pos_at_door: atDoor.map((n) => +n.toFixed(2)),
      walked_to_door_m: +Math.hypot(atDoor[0] - inside[0], atDoor[2] - inside[2]).toFixed(2),
      door_the_world_offered: doorSeen,
      pos_outside: leftAt.map((n) => +n.toFixed(2)),
      teleport_m: +Math.hypot(leftAt[0] - atDoor[0], leftAt[2] - atDoor[2]).toFixed(2),
      residency_before: beforeStats,
      residency_after: afterStats,
      exit_frame_ms: +tExit.toFixed(1),
      frames_after_ms: frames,
      worst_frame_after_ms: Math.max(...frames),
    };
  });
  out.checks = r;

  say('DOES THE OPENING ARRIVE?');
  say(`  the scene ends inside '${r.interior_at_end_of_scene}'; its declared exterior_spawn is ${JSON.stringify(r.exterior_spawn)}`);
  say(`  the scene leaves you at ${JSON.stringify(r.pos_inside)}; the door's inside face is ${JSON.stringify(r.interior_spawn)}`);
  say(`  walked ${r.walked_to_door_m} m back to it; the world then offered ${JSON.stringify(r.door_the_world_offered)}`);
  say(`  pressing interact moved the body ${r.teleport_m} m, to ${JSON.stringify(r.pos_outside)}`);
  if (r.exited) pass('the opening ends by leaving an interior — a placement at a province coordinate, i.e. an ARRIVAL');
  else fail('the door did not open: the scene could not be walked out of, so this measurement is void');

  say('WHAT THE STREAMER OWES AT THAT POINT');
  const b = r.residency_before || {}, a = r.residency_after || {};
  say(`  queued before the door was used: ${b.queued}   tiles resident: ${b.tiles ?? b.resident ?? 'n/a'}`);
  say(`  queued after the arrival:        ${a.queued}   tiles resident: ${a.tiles ?? a.resident ?? 'n/a'}`);
  if ((b.queued ?? 0) > 0) {
    pass(`the arrival is a real one: ${b.queued} tile(s) the exit point needs did not exist while the player was still inside`);
  } else {
    pass('nothing was owed at the exit point when the door was used — the hitch does not land in this scene');
  }

  say(`TIMING (upper bounds; loadavg ${out.loadavg})`);
  say(`  the exit frame: ${r.exit_frame_ms} ms`);
  say(`  the twelve frames after it: ${JSON.stringify(r.frames_after_ms)} ms`);
  say(`  worst: ${r.worst_frame_after_ms} ms against a 16.7 ms budget at 60 Hz`);
} finally {
  out.page_errors = handle.errors.slice(0, 6);
  await handle.close();
}

out.verdict = out.failures.length ? 'FAIL' : 'PASS';
say('');
say(`w1-26-r2-arrival: ${out.passes.length} pass, ${out.failures.length} fail -> ${out.verdict}`);
writeJson(jsonPath, out);
log(`wrote ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);
