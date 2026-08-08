#!/usr/bin/env node
// hold-walkout.mjs — can the body walk out of the barge hold?
//
// Owner: W1-26 r3. Rule 24: the round-2 verdict recorded P10 as UNMEASURED because its walker
// "was pinned on geometry short of the companionway", and my own re-run of the same probe froze
// the body at (-1.342, 0, 3.862) and did not move it a single millimetre across twenty
// iterations of an EIGHT-DIRECTION sweep. Eight directions against a crate is not a crate.
// Nothing in the tree could tell the two apart, so this asks the question directly.
//
// It distinguishes the three things that look identical from outside:
//
//   FROZEN    the simulation is not advancing at all (`sim.frame` does not move). A UI screen
//             that pauses the world would do this, and `Engine._step()` has exactly that branch.
//   DEAF      the simulation advances but the movement never reaches the pipeline (`moveX/moveY`
//             zero on a frame a key is held) — an input layer eating the keys.
//   BLOCKED   the simulation advances and the move is latched and the body still does not
//             translate. That, and only that, is geometry.
//
// The scene is set up through the harness because reaching `hold.out` is not what is being
// measured; every key press in the walk is a real DOM event into the real listeners.
//
// EXIT: non-zero unless the body leaves the hold through the companionway trigger.
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
hold-walkout.mjs — can the body walk out of the barge hold, and if not, why not?

USAGE
  node tools/w1-26-r3/hold-walkout.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'w1-26-r3', 'hold-walkout.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');

const out = { schema: 'elder-souls/hold-walkout@1', piece: 'W1-26-r3', samples: [], verdict: null };

const h = await launchGame({ width: 480, height: 270, timeout: 180000 });
let code = 1;
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));

  // Put the scene at `hold.out`: the hold, the hatch-name given, the body handed back.
  const opened = await h.page.evaluate(() => {
    const H = window.__HARNESS, e = window.__ENGINE;
    H.censusBegin({});
    H.censusEnter('talk');
    H.censusAnswer('Silence-Under-Salt');
    const st = e.census.state();
    return { node: st.node, paused: st.paused, resume_by: st.resume_by, pos: e.sim.player.pos.slice() };
  });
  out.opened = opened;
  say(`  scene at ${opened.node} (paused ${opened.paused}, resumes on '${opened.resume_by}'), body at ${JSON.stringify(opened.pos.map((v) => +v.toFixed(3)))}`);

  const probe = () => h.page.evaluate(() => {
    const e = window.__ENGINE;
    return {
      frame: e.sim.frame,
      pos: e.sim.player.pos.slice().map((v) => +v.toFixed(3)),
      moveX: e.input ? e.input.moveX : null,
      moveY: e.input ? e.input.moveY : null,
      ui_paused_frames: e.uiPausedFrames || 0,
      ui_is_menu: !!(e.ui && e.ui.isMenu && e.ui.isMenu()),
      ui_pauses: !!(e.ui && e.ui.pausesSimulation && e.ui.pausesSimulation(e.inCombat())),
      ui_screen: e.ui && e.ui.state ? (e.ui.screen || e.ui.open || null) : null,
      text_focused: e.real && e.real.textFocus ? !!e.real.textFocus() : null,
      census_node: e.census ? e.census.state().node : null,
      surface_takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      held: e.real && e.real.pipe ? e.real.pipe.heldNames().slice() : [],
    };
  });

  // Hold forward for a fixed number of REAL frames, sampling on both sides of the window.
  for (let i = 0; i < 8; i++) {
    const before = await probe();
    await h.page.keyboard.down('KeyW');
    await h.page.evaluate(() => window.__HARNESS.stepFrames(30));
    const during = await probe();
    await h.page.keyboard.up('KeyW');
    const after = await probe();
    const moved = Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]);
    const stepped = after.frame - before.frame;
    out.samples.push({ i, before, during, after, moved: +moved.toFixed(4), frames_stepped: stepped });
    say(`  [${i}] frames ${stepped}  moveY(held) ${during.moveY}  pos ${JSON.stringify(after.pos)}  moved ${moved.toFixed(3)} m  node ${after.census_node}`);
    if (after.census_node !== 'hold.out') break;
    // Face the companionway and try again — the body carries a yaw and forward is not +z.
    await h.page.evaluate(() => { window.__ENGINE.sim.player.yaw = 0; window.__ENGINE.sim.camera.yaw = 0; });
  }

  // ---- THE CORNER. Is there a spot in the first room of the game a player cannot get out of?
  // The round-2 verdict's walker and my re-run of it both stopped at (-1.342, 0, 3.862), between
  // the after bunk and the rotated cargo crate at (-2.2, 3.4). "Pinned on geometry" is a fair
  // reading of one direction; both runs swept EIGHT and moved 0.000 m, and a corner no direction
  // leaves is not a crate, it is a trap in the room the game opens in.
  //
  // EACH ARM RESETS THE WHOLE SCENE. The first draft of this leg set up `hold.out` once and then
  // only moved the body between arms — so arm 1 crossed the companionway trigger, the census
  // resumed into the Writ House, `_censusPlace` put the body at the desk, and arms 2-8 all
  // reported the SAME 4.816 m to the SAME position (1.9, 0.3). Eight identical numbers and not
  // one of them an experiment: rule 6's inert control, in the control written to detect one.
  const corner = [];
  const atTheCorner = () => h.page.evaluate(() => {
    const H = window.__HARNESS, e = window.__ENGINE;
    H.censusBegin({}); H.censusEnter('talk'); H.censusAnswer('Silence-Under-Salt');
    e.sim.player.pos[0] = -1.342; e.sim.player.pos[1] = e.groundAt(-1.342, 3.862); e.sim.player.pos[2] = 3.862;
    e.sim.player.yaw = 329; e.sim.camera.yaw = 351;
    if (e.combat && e.combat.player) { e.combat.player.pos[0] = -1.342; e.combat.player.pos[2] = 3.862; }
    return { node: e.census.state().node, pos: e.sim.player.pos.slice().map((v) => +v.toFixed(3)) };
  });
  for (const [name, keys] of [['forward', ['KeyW']], ['back', ['KeyS']], ['left', ['KeyA']], ['right', ['KeyD']],
    ['fwd+right', ['KeyW', 'KeyD']], ['fwd+left', ['KeyW', 'KeyA']], ['back+right', ['KeyS', 'KeyD']], ['back+left', ['KeyS', 'KeyA']]]) {
    const reset = await atTheCorner();
    if (reset.node !== 'hold.out') { corner.push({ direction: name, moved: null, why: `reset landed on ${reset.node}` }); continue; }
    const b = await probe();
    for (const k of keys) await h.page.keyboard.down(k);
    await h.page.evaluate(() => window.__HARNESS.stepFrames(30));
    for (const k of keys) await h.page.keyboard.up(k);
    const a = await probe();
    const moved = Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);
    corner.push({ direction: name, moved: +moved.toFixed(4), from: b.pos, to: a.pos, node_after: a.census_node });
    say(`  corner ${name.padEnd(10)} moved ${moved.toFixed(3)} m -> ${JSON.stringify(a.pos)} (${a.census_node})`);
  }
  out.corner_sweep = corner;
  // The arms must also DIFFER from each other, or they are one experiment run eight times.
  const dests = new Set(corner.map((c) => JSON.stringify(c.to)));
  out.corner_arms_distinct = dests.size;
  out.corner_is_a_trap = corner.every((c) => c.moved !== null && c.moved < 0.05);
  say(`  ${dests.size} distinct destinations across 8 directions (1 would mean this control is inert)`);
  say(`  the corner at (-1.342, 3.862) is a trap: ${out.corner_is_a_trap}`);

  const last = out.samples[out.samples.length - 1];
  const anyStepped = out.samples.some((s) => s.frames_stepped > 0);
  const anyLatched = out.samples.some((s) => Math.abs(s.during.moveY || 0) > 0.01 || Math.abs(s.during.moveX || 0) > 0.01);
  const anyMoved = out.samples.some((s) => s.moved > 0.05);
  const left = last && last.after.census_node && last.after.census_node !== 'hold.out';

  out.verdict = {
    left_the_hold: !!left,
    simulation_advanced: anyStepped,
    move_reached_the_pipeline: anyLatched,
    body_translated: anyMoved,
    diagnosis: !anyStepped ? 'FROZEN — the simulation is not advancing'
      : !anyLatched ? 'DEAF — the world steps but the held key never reaches the pipeline'
        : !anyMoved ? 'BLOCKED — the move is latched and the body does not translate: geometry'
          : left ? 'the body walked out' : 'the body moves but never crosses the companionway trigger',
  };
  say('');
  say(`  ${out.verdict.diagnosis}`);
  code = left ? 0 : 1;
} catch (e) {
  out.error = String(e && e.stack || e);
  say('  the probe threw: ' + String(e && e.message || e));
} finally {
  try { await h.close(); } catch { /* ignore */ }
}
writeJson(jsonPath, out);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(code);
