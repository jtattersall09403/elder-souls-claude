#!/usr/bin/env node
// pad-run.mjs — the gamepad path, end to end, on a pad ALONE.
//
// Owner: W1-GAMEPAD. Items: RI-JRN01 M13 (pad leg), RI-JRN04 §C/§D, RI-CAM02 §C, RI-MTH07.
//
// WHY THIS EXISTS, given `tools/journey/gamepad-shim.mjs` and `tools/ui/critic-w1-21-r2-a.mjs`.
//
//   The shim answers "does a DESCRIPTOR reach the router" at the `navigator.getGamepads()` seam.
//   The W1-21 r2 critic answered "do the six screens open on a pad" over a handful of presses.
//   Neither answers the question the owner actually has, which is: **can the game be played on
//   the pad in my hands, from the title screen to a body walking in the world, without ever
//   touching a keyboard** — and **does the stick do anything other than full tilt**.
//
//   Not one keyboard event is dispatched by this file. Every input below is
//   `__HARNESS.gamepad(state)` -> `RealInput.pushGamepadState()` -> `RealInput.pollGamepad()`,
//   which is the identical call `FixedLoop.beforeTick` makes every rAF for a physical pad
//   (engine.js:634). No `censusAnswer`, no `titleActivate`, no `openMenu`, no `queueInputs`.
//
// THE POLL/STEP INTERLEAVE, AND WHY IT IS NOT A CHEAT (RULES 8).
//   `beforeTick` polls the pad in the rAF loop, NOT inside `stepOnce()`. `stepFrames(n)` steps
//   the sim n times without polling. So `gamepad(s); stepFrames(20)` gives the ROUTER one single
//   instant — and every hold discriminator in `input/gamepad.js` counts FIXED SIM FRAMES. A
//   twelve-frame sprint gate can never fire from one poll. This file therefore drives
//   `for (i<n) { gamepad(s); stepFrames(1); }`: one poll per sim frame, exactly the ratio a real
//   pad gets at 60 Hz. It is the difference between a button that was pressed and a button that
//   was HELD, and it is the difference between a screen that opened for one frame and a screen
//   that is open.
//
// LEGS
//   opening   title -> New -> the hold -> the whole census -> name -> out into the world
//   locomote  walk, sprint (index 1 held past the gate), roll (index 1 tapped inside it)
//   screens   all six screens opened AND closed on the pad, each held open across many frames,
//             under three different button patterns, with an unbound-index control that goes red
//   curve     the left-stick response curve at ten deflections on two bearings, distance AND
//             direction, sampled at three instants inside every hold
//   consume   RI-MTH07: perturb game/data/input/profiles.json in the running world and watch the
//             pad change what it does — a remap and a deadzone widening
//
// EXIT: 0 only if every leg run has zero failures.
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
pad-run.mjs — play the game on a gamepad alone, and measure the stick.

USAGE
  node tools/gamepad/pad-run.mjs [--leg all|opening|locomote|screens|curve|consume] [--json PATH]
                                 [--shot PATH] [--name-via ledger|typed] [--timeout MS]

OPTIONS
  --leg NAME     which legs to run (comma separated, default: all). One browser for all of them.
  --json PATH    the artifact (default reports/w1-gamepad/pad-run.json)
  --shot PATH    screenshot of a screen opened by the pad
  --break-dir    TEARDOWN: invert the left stick's move_x/move_y axis mapping in the running
                 profile before the curve leg. Distance-only checks stay GREEN and the
                 DIRECTION check must go RED. This is the gap TOOL-COVERAGE-R3 left uncharged
                 on gamepad-shim.mjs ("the check is dist(p0,p1) — a scalar").
  --break-gate   TEARDOWN: set the index-1 hold gate to 1 frame, so a tap that should ROLL
                 becomes a SPRINT. The locomote leg's roll/sprint discriminator must go RED.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const LEGS = String(args.leg || 'all').split(',').map((s) => s.trim()).filter(Boolean);
const want = (n) => LEGS.includes('all') || LEGS.includes(n);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'w1-gamepad', 'pad-run.json');
const shotPath = args.shot ? path.resolve(String(args.shot)) : path.join(REPO_ROOT, 'docs/shots/2026-08-08-w1-gamepad-the-map-screen-opened-by-a-gamepad.png');
ensureDir(path.dirname(jsonPath)); ensureDir(path.dirname(shotPath));
const say = (s) => process.stdout.write(s + '\n');

// ---- the pad ------------------------------------------------------------------------------
// souls-default (game/data/input/profiles.json): 0 interact, 1 roll/sprint gate, 2 use_item,
// 3 spell_cycle/two_hand gate, 4 block, 5 light, 6 parry (analog), 7 heavy (analog, charge),
// 9 menu, 10 jump/crouch gate, 11 lock_on, 14 swap_left, 15 swap_right, 16 never bindable.
const B = { interact: 0, roll: 1, use_item: 2, spell: 3, block: 4, light: 5, menu: 9, jump: 10, lock_on: 11, swap_left: 14, swap_right: 15, reserved: 16 };
// Index 8 is `journal` — RESERVED in souls-default and bound to no action of the closed set.
// It is the control: a real index on a real pad that the profile says must do nothing.
const UNBOUND_INDEX = 8;

const out = {
  schema: 'elder-souls/pad-run@1',
  piece: 'W1-GAMEPAD',
  commit: gitInfo().commit || null,
  items: ['RI-JRN01', 'RI-JRN04', 'RI-CAM02', 'RI-MTH07'],
  method: 'every input is __HARNESS.gamepad(state) -> RealInput.pollGamepad(), one poll per fixed sim frame. No keyboard event is dispatched anywhere in this file, and no censusAnswer/titleActivate/openMenu shortcut is used.',
  legs: LEGS,
  teardowns: { break_dir: !!args['break-dir'], break_gate: !!args['break-gate'] },
  passes: [], failures: [],
};
const pass = (id, w, d) => { out.passes.push(id); say(`  PASS ${id}  ${w}`); out[id] = { ok: true, ...(d || {}) }; };
const fail = (id, w, d) => { out.failures.push(id); say(`  FAIL ${id}  ${w}`); out[id] = { ok: false, ...(d || {}) }; };

const h = await launchGame({ width: 960, height: 540, timeout: Number(args.timeout || 180000) });
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: Number(args.timeout || 180000) });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));

  // Install the pad driver IN THE PAGE. Node<->browser round trips cost about 1 ms each and a
  // 240-frame hold needs 240 polls; doing the loop in the page keeps the poll:step ratio exactly
  // 1:1 without paying 480 round trips for it.
  await h.page.evaluate(() => {
    window.__PAD = {
      /** Build a `navigator.getGamepads()`-shaped state. `down` are booleans; `analog` are values. */
      make(o) {
        o = o || {};
        const b = new Array(17).fill(false);
        for (const i of (o.down || [])) b[i] = true;
        for (const k of Object.keys(o.analog || {})) b[+k] = o.analog[k];
        // axes: [lx, ly, rx, ry]. y_is_down, so pushing the stick AWAY from you is ly = -1.
        return { buttons: b, axes: [o.lx || 0, o.ly || 0, o.rx || 0, o.ry || 0] };
      },
      /** n fixed frames with this pad state held: one poll, one step, n times. */
      hold(state, n) {
        for (let i = 0; i < n; i++) { window.__HARNESS.gamepad(state); window.__HARNESS.stepFrames(1); }
        return window.__ENGINE.sim.frame;
      },
      /** press for `downF` frames, release for `upF`. A TAP if downF < the gate, a HOLD if not. */
      tap(o, downF, upF) {
        this.hold(this.make(o), downF);
        this.hold(this.make({}), upF);
        return window.__ENGINE.sim.frame;
      },
      /** Everything a leg needs to know about where the game is, in one round trip. */
      where() {
        const e = window.__ENGINE;
        const t = e.renderer && e.renderer.title;
        const st = e.census ? e.census.state() : null;
        return {
          frame: e.sim.frame,
          title_shown: !!(t && t.shown),
          title_sel: t && t.shown ? (t.options()[t.sel] ? t.options()[t.sel].id : null) : null,
          title_rows: t && t.shown ? t.options().map((r) => r.id) : [],
          ui_mode: e.ui ? e.ui.mode : null,
          pad_ui_mode: !!(e.real && e.real.pad && e.real.pad.uiMode),
          interior: e.sim.env.interior,
          pos: e.sim.player.pos.slice().map((v) => +v.toFixed(3)),
          move: [+e.input.moveX.toFixed(4), +e.input.moveY.toFixed(4)],
          census: st ? { node: st.node, done: !!st.done, paused: !!st.paused, resume_by: st.resume_by || null, kind: st.input ? st.input.kind : null } : null,
          surface: e.censusSurface ? { takes: !!e.censusSurface.takesInput, sel: e.censusSurface.sel, picked: e.censusSurface.picked.length, typed: e.censusSurface.typed, options: e.censusSurface.options.map((o) => o.id) } : null,
          active_device: e.real ? e.real.activeDevice : null,
          pad_connected: !!(e.real && e.real.pad && e.real.pad.connected),
        };
      },
    };
  });

  const W = () => h.page.evaluate(() => window.__PAD.where());
  const hold = (o, n) => h.page.evaluate(({ o: oo, n: nn }) => window.__PAD.hold(window.__PAD.make(oo), nn), { o, n });
  const tap = (o, d = 3, u = 4) => h.page.evaluate(({ o: oo, d: dd, u: uu }) => window.__PAD.tap(oo, dd, uu), { o, d, u });

  // Nothing held, several frames — settles the router, adopts the pad, and proves the device.
  await hold({}, 4);
  const boot = await W();
  out.boot = boot;
  if (boot.pad_connected && boot.active_device === 'gamepad') {
    pass('P0', `a pad is attached and IS the active device before anything is pressed — active_device=${boot.active_device}, title=${boot.title_shown}`, boot);
  } else {
    fail('P0', `no pad on the input path: connected=${boot.pad_connected} active_device=${boot.active_device}`, boot);
  }

  // ================================================================================ opening ==
  if (want('opening')) {
    say('\n-- LEG: the opening, on a pad alone ------------------------------------------------');
    const seq = [];
    const note = (s) => { seq.push(s); say(`     ${s}`); };

    // 1. The title. The stick walks the rows; index 0 (`interact`) commits. `TitleLayer.step()`
    //    reads `input.moveY` and `pressedName('interact')` and nothing else.
    let w = await W();
    if (!w.title_shown) { await h.page.evaluate(() => { const e = window.__ENGINE; e.titleShow && e.titleShow(); }); await hold({}, 2); w = await W(); }
    out.title_rows = w.title_rows;
    note(`title: [${w.title_rows.join(', ')}], focused '${w.title_sel}'`);
    let guard = 0;
    while (w.title_sel !== 'new' && guard++ < 8) {
      // Stick DOWN is +ly (y_is_down), which the surface reads as "later row".
      await hold({ ly: 1 }, 2); await hold({}, 2);
      w = await W();
      note(`stick down -> focused '${w.title_sel}'`);
    }
    if (w.title_sel !== 'new') fail('O1', `the stick could not reach 'New' on the title (stuck on '${w.title_sel}')`, w);
    await tap({ down: [B.interact] }, 2, 6);
    const afterNew = await W();
    out.after_new = afterNew;
    note(`pad button ${B.interact} (interact) on 'New' -> interior ${afterNew.interior}, census node ${afterNew.census && afterNew.census.node}`);
    if (afterNew.census && afterNew.census.node === 'hold.come-to' && afterNew.interior === 'barge-hold') {
      pass('O1', `'New' chosen with the stick and pad button ${B.interact}: a body is in the barge hold at ${afterNew.census.node}`, afterNew);
    } else {
      fail('O1', `'New' on the pad did not open the hold: node=${afterNew.census && afterNew.census.node} interior=${afterNew.interior}`, afterNew);
    }

    // 2. Walk to Jeeh-Ei ON THE STICK. Forward is the camera bearing, so the bearing is set and
    //    the metres are the stick's. (Turning the camera is right-stick look under pointer lock,
    //    which headless has no pointer lock for; the walk itself is entirely the left stick.)
    const jeeh = await h.page.evaluate(() => { const n = window.__ENGINE.sim.findNPC('jeeh-ei'); return n ? n.pos.slice() : null; });
    const walkTo = async (tx, tz, { within = 1.2, bursts = 12, mag = 1 } = {}) => {
      const log = [];
      for (let i = 0; i < bursts; i++) {
        const at = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
        const dx = tx - at[0], dz = tz - at[2];
        const d = Math.hypot(dx, dz);
        log.push({ pos: at.map((v) => +v.toFixed(2)), dist: +d.toFixed(2) });
        if (d <= within) break;
        const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
        await h.page.evaluate((y) => { window.__ENGINE.sim.camera.yaw = y; }, yaw);
        await hold({ ly: -mag }, Math.max(6, Math.min(30, Math.round(d / 0.053))));
        await hold({}, 2);
      }
      return { log, end: (await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice())).map((v) => +v.toFixed(2)) };
    };
    const approach = await walkTo(jeeh[0], jeeh[2], { within: 2.2 });
    out.approach = approach;
    note(`walked to Jeeh-Ei on the LEFT STICK: ${JSON.stringify(approach.end)}`);
    await tap({ down: [B.interact] }, 2, 6);
    let cur = await W();
    if (cur.census && cur.census.node === 'hold.hatch-name') {
      pass('O2', `walked to her on the stick and pad button ${B.interact} opened the scene (${cur.census.node})`, { node: cur.census.node, end: approach.end });
    } else {
      fail('O2', `pad interact beside her did not open the scene (node ${cur.census && cur.census.node})`, cur);
    }

    // 3. The whole census on the stick and two buttons.
    //
    //    THE NAME QUESTION, AND THE RULING (rule 0 — decided, not asked).
    //    `character/scene.js:_nameOptions()` already offers a LEDGER of names at every text node,
    //    and `step()` commits `this.typed ? this.typed : opt.id`, tagging the commit `via:
    //    'ledger'`. So the shipped design is NAME FROM A LIST on a pad and free typing on a
    //    keyboard, and its stated reason is RI-JRN01 O8: an on-screen keyboard would be the
    //    full-screen panel O8 forbids. I am adopting that ruling rather than inventing a third
    //    option, and this leg is what makes it a measured claim instead of a comment: the run
    //    below never dispatches a key, so if the ledger did not commit, the census would stall
    //    at `hold.hatch-name` forever and O3 would go red.
    //    REVERSIBLE, and here is the evidence that would overturn it: if a play-test shows
    //    players want a name not in the ledger and reach for a keyboard to get it, the ledger is
    //    not sufficient and an O8-compatible inline (NOT full-screen) character wheel is owed.
    const answers = [];
    let g2 = 0;
    while (g2++ < 60) {
      cur = await W();
      if (!cur.census || cur.census.done) break;
      const c = cur.census, s = cur.surface;
      if (c.paused) {
        if (c.resume_by === 'walk') {
          const wk = await walkTo(0, 5.0, { within: 0.8, bursts: 14 });
          out.walk_out = wk;
          note(`the census handed control back: walked out of the hold ON THE STICK to ${JSON.stringify(wk.end)}`);
          await hold({}, 6);
        } else {
          await tap({ down: [B.interact] }, 2, 5);
        }
        const nx = await W();
        if (nx.census && nx.census.node === c.node && nx.census.paused) { fail('O3', `stuck at the paused node ${c.node} (resume_by=${c.resume_by})`, { cur, nx }); break; }
        continue;
      }
      if (c.kind === 'pick') {
        // Two distinct picks: commit, walk the caret one row on the STICK, commit again.
        for (let k = 0; k < 2; k++) {
          await tap({ down: [B.interact] }, 2, 4);
          await hold({ ly: 1 }, 2); await hold({}, 2);
        }
        await hold({}, 3);
      } else {
        // 'text' commits the highlighted LEDGER name; 'option'/'observed' commit the row.
        await tap({ down: [B.interact] }, 2, 5);
      }
      const nx = await W();
      answers.push({ node: c.node, kind: c.kind, chose: s ? (s.options[s.sel] || null) : null, next: nx.census ? nx.census.node : null });
      if (nx.census && nx.census.node === c.node && !nx.census.done && nx.surface && s && nx.surface.picked === s.picked) {
        fail('O3', `the scene did not move on from ${c.node} (${c.kind}) on pad button ${B.interact}`, { c, nx });
        break;
      }
    }
    out.census_answers = answers;
    const sheet = await h.page.evaluate(() => {
      const e = window.__ENGINE, c = e.sim.character;
      return c ? {
        given_name: c.given_name, hatch_name: c.hatch_name, race: c.race, class_name: c.class_name,
        birthsign: c.birthsign, upbringing: c.upbringing,
        carrying_writ: (e.sim.inventory || []).some((i) => (i.id || i) === 'stamped-writ'),
        interior: e.sim.env.interior, pos: e.sim.player.pos.slice().map((v) => +v.toFixed(2)),
      } : null;
    });
    out.character = sheet;
    if (sheet && sheet.given_name) {
      note(`${sheet.given_name} — ${sheet.race}, ${sheet.class_name}, ${sheet.birthsign}, raised ${sheet.upbringing}`);
      note(`hatch-name taken from the ledger with the stick and one button: ${JSON.stringify(sheet.hatch_name)}`);
      pass('O3', `a whole character was created on a PAD ALONE over ${answers.length} answered nodes, no keyboard event anywhere`, { nodes: answers.length, name: sheet.given_name, hatch_name: sheet.hatch_name });
    } else {
      fail('O3', 'no character was composed on the pad', { last: cur });
    }
    if (sheet && sheet.hatch_name && String(sheet.hatch_name).length) {
      pass('O4', `the name question was answered WITHOUT A KEYBOARD, from the ledger: ${JSON.stringify(sheet.hatch_name)} (ruling recorded in this file and in the status file)`, { hatch_name: sheet.hatch_name });
    } else {
      fail('O4', `the name question could not be answered on a pad: hatch_name=${JSON.stringify(sheet && sheet.hatch_name)}`, {});
    }
    // Into the world.
    const world = await W();
    out.into_world = world;
    if (world.census && world.census.done) {
      pass('O5', `the census is done and the body is standing at ${JSON.stringify(world.pos)} (interior=${world.interior})`, world);
    } else {
      fail('O5', `the census never finished: ${JSON.stringify(world.census)}`, world);
    }
    out.opening_sequence = seq;
  }

  // ============================================================================== locomote ==
  if (want('locomote')) {
    say('\n-- LEG: walk, sprint, roll ---------------------------------------------------------');
    if (args['break-gate']) {
      const r = await h.page.evaluate(() => window.__HARNESS.perturbInput({ path: 'pad_profiles.souls-default.hold_gate.1.frames', value: 1 }));
      out.break_gate_applied = r;
      say(`  TEARDOWN --break-gate: hold_gate[1].frames ${r.before} -> ${r.after}`);
    }
    const measure = async (o, n) => {
      const p0 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      await hold(o, n);
      const p1 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      await hold({}, 2);
      return { d: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3), p0: p0.map((v) => +v.toFixed(2)), p1: p1.map((v) => +v.toFixed(2)) };
    };
    const N = 60;
    // WHERE THIS IS MEASURED, DECLARED. When the opening leg has run, the body is the one the pad
    // just created and it is standing in the writ-house — four walls and about six metres of
    // floor. A 60-frame sprint is 5 m, so an indoor measurement is a measurement of the wall.
    // Try in place first, and if the room is too small to hold a sprint, step out to open ground
    // and SAY SO rather than publishing a number the geometry chose.
    const where0 = await W();
    let venue = { interior: where0.interior, moved_out: false };
    let still = await measure({}, N);
    let walk = await measure({ ly: -1 }, N);
    if (walk.d < 1.0) {
      await h.page.evaluate(() => { window.__HARNESS.teleport(2766.5, 5011); });
      await hold({}, 4);
      venue = { interior: where0.interior, moved_out: true, to: [2766.5, 5011], why: `the walk covered only ${walk.d} m where the body was standing, which is a room and not a walk` };
      say(`     the body created on the pad is in '${where0.interior}' and the room is too small to hold a 60-frame sprint; measuring in open ground instead (declared, not hidden)`);
      still = await measure({}, N);
      walk = await measure({ ly: -1 }, N);
    }
    out.locomotion_venue = venue;
    // Sprint: index 1 held. The gate promotes at 12 sim frames, which needs 12 POLLS, which is
    // the whole reason this file interleaves poll and step.
    const sprint = await measure({ ly: -1, down: [B.roll] }, N);
    out.locomotion = { frames: N, venue, still, walk, sprint };
    say(`     still ${still.d} m · walk ${walk.d} m · stick+index1 held ${sprint.d} m over ${N} frames`);
    if (still.d < 0.05) pass('L0', `NULL CONTROL: nothing held, the body does not drift — ${still.d} m over ${N} frames`, still);
    else fail('L0', `the body drifts with nothing held: ${still.d} m over ${N} frames — every distance below is suspect`, still);
    if (walk.d > 1.0) pass('L1', `the LEFT STICK walks: ${walk.d} m over ${N} frames`, walk);
    else fail('L1', `the left stick does not walk the body: ${walk.d} m over ${N} frames`, walk);
    if (sprint.d > walk.d * 1.15) pass('L2', `HOLDING pad index ${B.roll} past the 12-frame gate SPRINTS: ${sprint.d} m vs ${walk.d} m walking (${(sprint.d / walk.d).toFixed(2)}x)`, { sprint, walk });
    else fail('L2', `holding index ${B.roll} did not sprint: ${sprint.d} m vs ${walk.d} m walking (${(sprint.d / (walk.d || 1)).toFixed(2)}x) — the hold gate never promoted`, { sprint, walk });

    // Roll: index 1 TAPPED inside the gate. Read the action, not the distance — a roll and a
    // sprint both move you, and distance alone cannot tell them apart. `getInputEdges()` is the
    // A-JRN7 edge log and names the action the pipeline received.
    await h.page.evaluate(() => { window.__ENGINE.input.edges.length = 0; });
    await tap({ down: [B.roll] }, 5, 20);          // 5 frames held: inside the 12-frame gate
    const edgesTap = await h.page.evaluate(() => window.__HARNESS.getInputEdges().map((e) => e.button + ':' + e.edge));
    await h.page.evaluate(() => { window.__ENGINE.input.edges.length = 0; });
    await tap({ down: [B.roll] }, 20, 8);          // 20 frames held: past the gate
    const edgesHold = await h.page.evaluate(() => window.__HARNESS.getInputEdges().map((e) => e.button + ':' + e.edge));
    out.gate = { tap_5f: edgesTap, hold_20f: edgesHold };
    say(`     index ${B.roll} tapped 5 frames -> [${edgesTap.join(', ')}]`);
    say(`     index ${B.roll} held  20 frames -> [${edgesHold.join(', ')}]`);
    const tapRolled = edgesTap.some((e) => e.startsWith('roll:'));
    const tapSprinted = edgesTap.some((e) => e.startsWith('sprint:'));
    const heldSprinted = edgesHold.some((e) => e.startsWith('sprint:'));
    if (tapRolled && !tapSprinted && heldSprinted) {
      pass('L3', `ONE pad index, two verbs: tapped for 5 frames it ROLLS, held for 20 it SPRINTS — and never both`, out.gate);
    } else {
      fail('L3', `the roll/sprint discriminator is wrong: tap gave [${edgesTap.join(', ')}], hold gave [${edgesHold.join(', ')}]`, out.gate);
    }
    if (args['break-gate']) {
      await h.page.evaluate(() => window.__HARNESS.perturbInputReset());
      say('  TEARDOWN --break-gate reverted (perturbInputReset)');
    }
  }

  // =============================================================================== screens ==
  if (want('screens')) {
    say('\n-- LEG: every screen, opened AND closed on the pad ----------------------------------');
    const RING = ['inventory', 'journal', 'sheet', 'spells', 'map', 'levelup'];
    // `levelup` is in the ring only at a hearth. Declared, not hidden — the other five need no
    // world state at all, and this is the same declaration the W1-21 r2 critic made.
    await h.page.evaluate(() => { try { window.__HARNESS.setAtHearth(true); } catch { /* not at a hearth; levelup will simply not be advertised */ } });
    await hold({}, 2);

    // -- the control FIRST, and it must go red before anything else is believed --------------
    // Pad index 8 is `journal` in souls-default's RESERVED table: a real index on the real pad
    // that the profile binds to no action of the closed set.
    const before = (await W()).ui_mode;
    await tap({ down: [UNBOUND_INDEX] }, 4, 8);
    await tap({ down: [UNBOUND_INDEX] }, 4, 8);
    const afterUnbound = (await W()).ui_mode;
    out.control_unbound = { index: UNBOUND_INDEX, before, after: afterUnbound };
    if (before === afterUnbound && afterUnbound === 'world') {
      pass('S0', `CONTROL: pad index ${UNBOUND_INDEX} is bound to nothing and opens nothing — world -> ${afterUnbound}, pressed twice`, out.control_unbound);
    } else {
      fail('S0', `pad index ${UNBOUND_INDEX} is supposed to be unbound but moved the UI: ${before} -> ${afterUnbound}`, out.control_unbound);
    }
    // And the same control ARMED: if index 9 does nothing either, S0 is vacuous.
    await tap({ down: [B.menu] }, 4, 8);
    const afterMenu = (await W()).ui_mode;
    out.control_armed = { index: B.menu, before: afterUnbound, after: afterMenu };
    if (afterMenu !== afterUnbound) {
      pass('S0b', `and the control is not inert: pad index ${B.menu} (menu) on the SAME body on the SAME frames moves ${afterUnbound} -> ${afterMenu}`, out.control_armed);
    } else {
      fail('S0b', `pad index ${B.menu} moved nothing either (${afterUnbound} -> ${afterMenu}) — S0 proves nothing`, out.control_armed);
    }

    // -- three different button patterns, so "reachable" is not one lucky sequence ------------
    // A: menu(9) to open, swap_right(15) to walk the ring, menu(9) to close.
    // B: menu(9) to open, swap_LEFT(14) to walk the ring backwards, roll(1) to close ("back").
    // C: as A but each screen is HELD OPEN for 90 further frames before it is read, so a screen
    //    that opens on the press and closes on the next frame cannot pass (RULES 8).
    const patterns = [];
    const modeNow = async () => (await W()).ui_mode;
    const closeAll = async () => { for (let i = 0; i < 8 && (await modeNow()) !== 'world'; i++) await tap({ down: [B.menu] }, 4, 8); };

    const runPattern = async (label, { stepIdx, closeIdx, dwell }) => {
      await closeAll();
      const rows = [];
      let m = await modeNow();
      await tap({ down: [B.menu] }, 4, 8);
      m = await modeNow();
      const order = [];
      for (let i = 0; i < 8; i++) {
        order.push(m);
        if (dwell) { await hold({}, dwell); }
        const stillOpen = await modeNow();
        rows.push({ mode: m, after_dwell: stillOpen, dwell_frames: dwell || 0 });
        if (stillOpen !== m) break;
        await tap({ down: [stepIdx] }, 4, 8);
        m = await modeNow();
        if (m === 'world') break;
      }
      // close from wherever we are
      const beforeClose = await modeNow();
      await tap({ down: [closeIdx] }, 4, 10);
      const afterClose = await modeNow();
      const p = { label, step_index: stepIdx, close_index: closeIdx, dwell_frames: dwell || 0, order, rows, close: { from: beforeClose, to: afterClose } };
      patterns.push(p);
      say(`     ${label}: ${order.join(' -> ')}   | close on index ${closeIdx}: ${beforeClose} -> ${afterClose}`);
      return p;
    };

    const pa = await runPattern('A open=9 step=15 close=9', { stepIdx: B.swap_right, closeIdx: B.menu, dwell: 0 });
    const pb = await runPattern('B open=9 step=14 close=1', { stepIdx: B.swap_left, closeIdx: B.roll, dwell: 0 });
    const pc = await runPattern('C open=9 step=15 close=9 +90f dwell', { stepIdx: B.swap_right, closeIdx: B.menu, dwell: 90 });
    out.screen_patterns = patterns;

    const seen = new Set();
    for (const p of patterns) for (const m of p.order) if (m !== 'world') seen.add(m);
    const missing = RING.filter((r) => !seen.has(r));
    out.screens_reached = Array.from(seen);
    out.screens_missing = missing;
    if (!missing.length) pass('S1', `all six screens opened on the pad across three different button patterns: ${RING.join(', ')}`, { reached: Array.from(seen) });
    else fail('S1', `screens never reached on a pad: [${missing.join(', ')}] (reached ${Array.from(seen).join(', ')})`, { missing });

    // -- CLOSING, per screen, and it is a separate claim from opening -------------------------
    //
    // The ring walk above cannot answer this: index 15 from `levelup` wraps to `world` and index
    // 14 from `inventory` steps to `world`, both of which are the ring behaving correctly, so a
    // "close" measured at the end of a walk is measuring the wrap. Each of the six is therefore
    // opened from the world on its own, held for 45 frames, and then closed — twice, once with
    // index 9 (`menu`) and once with index 1 (`roll` = "back"). Two close buttons x six screens.
    const closes = [];
    for (const closeIdx of [B.menu, B.roll]) {
      for (let n = 0; n < RING.length; n++) {
        await closeAll();
        await tap({ down: [B.menu] }, 4, 8);
        for (let k = 0; k < n; k++) await tap({ down: [B.swap_right] }, 4, 8);
        const opened = await modeNow();
        await hold({}, 45);                       // RULES 8 again: it is open a while, not a frame
        const stillOpen = await modeNow();
        await tap({ down: [closeIdx] }, 4, 10);
        const after = await modeNow();
        closes.push({ want: RING[n], opened, still_open_after_45f: stillOpen, close_index: closeIdx, after, ok: opened === RING[n] && stillOpen === RING[n] && after === 'world' });
      }
      say(`     close on index ${closeIdx}: ${closes.filter((c) => c.close_index === closeIdx).map((c) => `${c.opened}->${c.after}`).join(', ')}`);
    }
    out.screen_closes = closes;
    const badClose = closes.filter((c) => !c.ok);
    if (!badClose.length) {
      pass('S2', `all six screens CLOSE on the pad, on both close buttons — 12 of 12 open-hold-close cycles ended back in the world (index ${B.menu} 'menu' and index ${B.roll} 'roll'/back)`, { cycles: closes.length });
    } else {
      fail('S2', `a screen would not open or close on the pad: ${badClose.map((c) => `${c.want}: opened=${c.opened} after45f=${c.still_open_after_45f} close(${c.close_index})->${c.after}`).join('; ')}`, { bad: badClose });
    }

    const dwelt = pc.rows.filter((r) => r.dwell_frames > 0);
    const heldOpen = dwelt.filter((r) => r.after_dwell === r.mode);
    if (dwelt.length && heldOpen.length === dwelt.length) {
      pass('S3', `RULES 8: every screen was still open 90 fixed frames after the press that opened it (${dwelt.map((r) => r.mode).join(', ')}) — these are open screens, not one-frame flickers`, { rows: dwelt });
    } else {
      fail('S3', `a screen did not survive its 90-frame dwell: ${JSON.stringify(dwelt)}`, { rows: dwelt });
    }

    // -- the picture: a screen the pad opened ------------------------------------------------
    await closeAll();
    await tap({ down: [B.menu] }, 4, 8);
    for (let i = 0; i < 6 && (await modeNow()) !== 'map'; i++) await tap({ down: [B.swap_right] }, 4, 8);
    const shotMode = await modeNow();
    // `renderFrame()` draws ONE frame on demand and leaves renderRate at 0. Turning the rAF
    // render loop on and then asking Playwright for a screenshot deadlocks here: the compositor
    // never reaches a quiescent frame and page.screenshot() times out at 30 s (seen, twice).
    await hold({}, 4);
    await h.page.evaluate(() => window.__HARNESS.renderFrame());
    const png = await h.page.evaluate(async () => window.__HARNESS.screenshot());
    const fs = await import('node:fs');
    fs.writeFileSync(shotPath, Buffer.from(String(png).replace(/^data:image\/png;base64,/, ''), 'base64'));
    out.shot = { path: path.relative(REPO_ROOT, shotPath), mode: shotMode, opened_by: `pad index ${B.menu} then index ${B.swap_right}` };
    say(`     shot: ${out.shot.path} (mode '${shotMode}', opened by pad indices ${B.menu} then ${B.swap_right})`);
    await closeAll();
  }

  // ================================================================================= curve ==
  if (want('curve')) {
    say('\n-- LEG: the left-stick response curve ----------------------------------------------');
    await h.page.evaluate(() => { const e = window.__ENGINE; if (e.ui && e.ui.mode !== 'world') e.ui.close(); });
    await hold({}, 4);

    // EVERY ROW STARTS FROM THE SAME PATCH OF OPEN GROUND, and this is not tidiness.
    // The first draft let each deflection start where the last one stopped, and by the eighth
    // row of the diagonal sweep the body was against a wall: 45 deg commanded came back as
    // 63.7 deg, then 90.0 deg, then 0 m at full tilt. Every one of those numbers is real and
    // none of them is about the stick — they are the collision solver sliding a body along a
    // surface. Publishing them as a stick defect would have been the exact mistake this project
    // keeps paying for. So: teleport home before each row, and flag obstruction explicitly
    // rather than letting it masquerade as a steering error.
    const START = { x: 2766.5, z: 5011 };
    const home = () => h.page.evaluate((s) => { window.__HARNESS.teleport(s.x, s.z); window.__ENGINE.sim.camera.yaw = 0; }, START);

    if (args['break-dir']) {
      const r = await h.page.evaluate(() => window.__HARNESS.perturbInput({ path: 'pad_profiles.souls-default.axes.move_x', value: 1 }));
      const r2 = await h.page.evaluate(() => window.__HARNESS.perturbInput({ path: 'pad_profiles.souls-default.axes.move_y', value: 0 }));
      out.break_dir_applied = [r, r2];
      say(`  TEARDOWN --break-dir: move_x ${r.before}->${r.after}, move_y ${r2.before}->${r2.after} (the two stick axes are swapped under the router)`);
    }

    const DEFLECTIONS = [0.05, 0.10, 0.14, 0.16, 0.20, 0.25, 0.27, 0.30, 0.40, 0.45, 0.55, 0.70, 0.85, 0.92, 1.00];
    const SEGMENTS = [30, 30, 60];        // RULES 8: three consecutive windows inside one hold
    const BEARINGS = [{ name: 'forward', deg: 0 }, { name: 'right-45', deg: 45 }, { name: 'left-90', deg: -90 }];

    /** One sweep. `dz` overrides combat locomotion's SECOND deadzone; null leaves it shipped. */
    const sweep = async (label, dz) => {
      if (dz !== null && dz !== undefined) {
        await h.page.evaluate((v) => { window.__ENGINE.combat.d.locomotion.move_deadzone = v; }, dz);
      }
      const shipped = await h.page.evaluate(() => window.__ENGINE.combat.d.locomotion.move_deadzone);
      const rows = [];
      for (const bear of BEARINGS) {
        const rad = bear.deg * Math.PI / 180;
        for (const m of DEFLECTIONS) {
          const lx = +(Math.sin(rad) * m).toFixed(6);
          const ly = +(-Math.cos(rad) * m).toFixed(6);
          await home();
          await hold({}, 3);
          const samples = [];
          let cumFrames = 0;
          let prev = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
          const first = prev;
          for (const seg of SEGMENTS) {
            await hold({ lx, ly }, seg);
            cumFrames += seg;
            const s = await h.page.evaluate(() => ({ p: window.__ENGINE.sim.player.pos.slice(), mv: [window.__ENGINE.input.moveX, window.__ENGINE.input.moveY], sp: window.__ENGINE.combat.player.speedMps }));
            const sdx = s.p[0] - prev[0], sdz = s.p[2] - prev[2];
            const sd = Math.hypot(sdx, sdz);
            samples.push({
              at_frame: cumFrames, window_frames: seg,
              window_dist_m: +sd.toFixed(4),
              window_m_per_s: +(sd / seg * 60).toFixed(4),
              window_heading_deg: sd > 1e-3 ? +(Math.atan2(sdx, sdz) * 180 / Math.PI).toFixed(2) : null,
              move_vec: s.mv.map((v) => +v.toFixed(4)),
              move_mag: +Math.hypot(s.mv[0], s.mv[1]).toFixed(4),
              model_speed_mps: +Number(s.sp || 0).toFixed(4),
            });
            prev = s.p;
          }
          await hold({}, 3);
          const last = samples[samples.length - 1];
          const total = Math.hypot(prev[0] - first[0], prev[2] - first[2]);
          // The STEADY-STATE speed is the last window's, not the whole hold's: the first window
          // contains the body accelerating from a standstill and the bounded turn-rate law
          // swinging it onto the commanded bearing. Averaging that in is how a curve gets a
          // spurious knee at the bottom.
          const steady = last.window_m_per_s;
          // Obstruction: what the MODEL says the body's speed is, versus what the world gave it.
          const obstructed = last.model_speed_mps > 0.01 && steady < last.model_speed_mps * 0.8;
          // DIRECTION, on two independent observables:
          //   (a) the latched move vector - pure input layer, and NOTHING in the world can bend
          //       it. This is the gap TOOL-COVERAGE-R3 left open on gamepad-shim.mjs.
          //   (b) the body's own heading in open ground - the world-side confirmation.
          const mvBearing = last.move_mag > 1e-4 ? +(Math.atan2(last.move_vec[0], last.move_vec[1]) * 180 / Math.PI).toFixed(2) : null;
          const err = (a) => (a === null ? null : +(((a - bear.deg + 540) % 360) - 180).toFixed(2));
          rows.push({
            arm: label, move_deadzone: shipped,
            bearing: bear.name, commanded_bearing_deg: bear.deg, deflection: m, stick: [lx, ly],
            samples, total_dist_m: +total.toFixed(4),
            steady_m_per_s: steady, model_speed_mps: last.model_speed_mps,
            move_mag: last.move_mag, move_vec_bearing_deg: mvBearing,
            move_vec_error_deg: err(mvBearing),
            body_heading_deg: last.window_heading_deg, body_heading_error_deg: err(last.window_heading_deg),
            obstructed,
            gait: last.move_mag <= 0 ? 'idle' : last.move_mag < 0.55 ? 'walk' : 'run',
          });
          if (bear.deg === 0) {
            say(`     [${label}] |stick|=${m.toFixed(2)}  move_mag=${last.move_mag.toFixed(3)}  model ${last.model_speed_mps.toFixed(3)} m/s  world ${steady.toFixed(3)} m/s  heading ${last.window_heading_deg === null ? '   --' : last.window_heading_deg.toFixed(1) + '°'}${obstructed ? '  [OBSTRUCTED]' : ''}`);
          }
        }
      }
      return rows;
    };

    // ARM 1: the tree exactly as it ships.
    const shippedRows = await sweep('shipped', null);
    out.stick_curve = shippedRows;
    const fwd = shippedRows.filter((r) => r.bearing === 'forward');
    const clean = shippedRows.filter((r) => !r.obstructed);
    out.obstructed_rows = shippedRows.filter((r) => r.obstructed).map((r) => ({ b: r.bearing, d: r.deflection }));
    say(`     ${shippedRows.length} rows, ${out.obstructed_rows.length} of them obstructed by geometry and excluded from the direction claim`);

    // -- C1 the documented deadzone -----------------------------------------------------------
    const dead = fwd.filter((r) => r.deflection <= 0.14);
    const deadMoved = dead.filter((r) => r.steady_m_per_s > 0.01);
    if (dead.length >= 3 && !deadMoved.length) pass('C1', `the documented 0.15 inner deadzone holds: ${dead.map((r) => r.deflection).join(', ')} all give 0.000 m/s`, { dead: dead.map((r) => ({ d: r.deflection, v: r.steady_m_per_s })) });
    else fail('C1', `the stick moves inside its own deadzone: ${deadMoved.map((r) => `${r.deflection}->${r.steady_m_per_s}`).join(', ')}`, { deadMoved });

    // -- C2 proportional, not a switch --------------------------------------------------------
    const liveRows = fwd.filter((r) => r.steady_m_per_s > 0.01 && r.deflection < 0.92);
    const distinct = new Set(liveRows.map((r) => r.steady_m_per_s.toFixed(3)));
    const full = fwd.find((r) => r.deflection === 1.00);
    const mid = fwd.find((r) => r.deflection === 0.45);
    if (distinct.size >= 4 && mid && full && mid.steady_m_per_s > 0.01 && mid.steady_m_per_s < full.steady_m_per_s * 0.85) {
      pass('C2', `the stick is PROPORTIONAL, not a switch: ${distinct.size} distinct speeds below saturation; 0.45 deflection walks ${mid.steady_m_per_s} m/s against ${full.steady_m_per_s} m/s at full tilt`, { distinct: distinct.size, mid: mid.steady_m_per_s, full: full.steady_m_per_s });
    } else {
      fail('C2', `the stick only walks at full tilt: ${distinct.size} distinct speeds, 0.45 gives ${mid && mid.steady_m_per_s} against ${full && full.steady_m_per_s}`, { distinct: distinct.size });
    }

    // -- C3 monotonic -------------------------------------------------------------------------
    const mono = fwd.filter((r) => r.deflection >= 0.15 && !r.obstructed);
    const bad = [];
    for (let i = 1; i < mono.length; i++) if (mono[i].steady_m_per_s < mono[i - 1].steady_m_per_s - 0.02) bad.push(mono[i].deflection);
    if (!bad.length) pass('C3', `the curve is monotonic across ${mono.length} deflections from the deadzone edge to full tilt`, { seq: mono.map((r) => [r.deflection, r.steady_m_per_s]) });
    else fail('C3', `the curve is not monotonic — speed DROPS at deflection(s) ${bad.join(', ')}`, { bad });

    // -- C4 outer saturation ------------------------------------------------------------------
    const sat = fwd.find((r) => r.deflection === 0.92);
    if (sat && full && Math.abs(sat.steady_m_per_s - full.steady_m_per_s) < full.steady_m_per_s * 0.05) pass('C4', `outer saturation at 0.92 is real: 0.92 gives ${sat.steady_m_per_s} m/s and 1.00 gives ${full.steady_m_per_s} m/s`, { sat: sat.steady_m_per_s, full: full.steady_m_per_s });
    else fail('C4', `0.92 and 1.00 differ by more than 5%: ${sat && sat.steady_m_per_s} vs ${full && full.steady_m_per_s}`, {});

    // -- C5 RULES 8: three consecutive windows in one hold, not one instant --------------------
    const steadyRows = clean.filter((r) => r.steady_m_per_s > 0.05);
    const unsteady = steadyRows.filter((r) => {
      const v = r.samples.slice(1).map((s) => s.window_m_per_s);     // drop the acceleration window
      return v.length >= 2 && (Math.max(...v) - Math.min(...v)) > Math.max(...v) * 0.1;
    });
    if (steadyRows.length >= 10 && !unsteady.length) {
      pass('C5', `RULES 8: inside every one of ${steadyRows.length} holds the 30-60 and 60-120 frame windows agree within 10% — a steady walk, not a first-frame impulse. (The 0-30 window is SLOWER at every deflection: that is the body accelerating and turning onto the bearing, and a single cumulative average would have hidden it.)`, { rows: steadyRows.length });
    } else {
      fail('C5', `the speed is not steady inside the hold at ${unsteady.map((r) => `${r.bearing}@${r.deflection}`).join(', ')}`, { unsteady: unsteady.map((r) => ({ b: r.bearing, d: r.deflection, w: r.samples.map((s) => s.window_m_per_s) })) });
    }

    // -- C6 DIRECTION -------------------------------------------------------------------------
    // (a) the latched move vector. Unobstructable: this is the input layer's own output and no
    //     wall, slope or solver can bend it. THIS is the check TOOL-COVERAGE-R3 asked for.
    const mvRows = shippedRows.filter((r) => r.move_vec_error_deg !== null);
    const mvWrong = mvRows.filter((r) => Math.abs(r.move_vec_error_deg) > 1.0);
    // (b) the body, in open ground only.
    const bodyRows = clean.filter((r) => r.body_heading_error_deg !== null);
    const bodyWrong = bodyRows.filter((r) => Math.abs(r.body_heading_error_deg) > 5);
    out.direction = { move_vec_rows: mvRows.length, move_vec_wrong: mvWrong.length, body_rows: bodyRows.length, body_wrong: bodyWrong.length,
      worst_move_vec_deg: mvRows.length ? Math.max(...mvRows.map((r) => Math.abs(r.move_vec_error_deg))) : null,
      worst_body_deg: bodyRows.length ? Math.max(...bodyRows.map((r) => Math.abs(r.body_heading_error_deg))) : null };
    say(`     direction: ${mvRows.length} live rows on 3 bearings; worst move-vector error ${out.direction.worst_move_vec_deg}°, worst body-heading error ${out.direction.worst_body_deg}° in open ground`);
    if (mvRows.length >= 20 && !mvWrong.length && bodyRows.length >= 15 && !bodyWrong.length) {
      pass('C6', `DIRECTION, not just distance: across 3 bearings (0°, +45°, -90°) x ${DEFLECTIONS.length} deflections the latched move vector points where the stick points to within ${out.direction.worst_move_vec_deg}°, and in open ground the body's own heading follows to within ${out.direction.worst_body_deg}°`, out.direction);
    } else {
      fail('C6', `the body does not go where the stick points — move-vector errors on ${mvWrong.length} row(s) (worst ${out.direction.worst_move_vec_deg}°), body-heading errors on ${bodyWrong.length} row(s) (worst ${out.direction.worst_body_deg}°)`, { mvWrong: mvWrong.map((r) => ({ b: r.commanded_bearing_deg, d: r.deflection, err: r.move_vec_error_deg })), bodyWrong: bodyWrong.map((r) => ({ b: r.commanded_bearing_deg, d: r.deflection, err: r.body_heading_error_deg })) });
    }

    // -- C7 THE SECOND DEADZONE, NOW A REGRESSION GUARD ---------------------------------------
    //
    // The finding this leg had when it was written, and the guard it became once the fix landed.
    // On the UNFIXED tree this check established the defect by A/B. On the fixed tree the two
    // arms are identical by construction, so establishing it again is impossible and asking for
    // it would be a check that fails on a correct build. It now asserts the CORRECT state — the
    // body starts moving at the documented deadzone edge and not one rescale further out — and
    // the historical A/B lives in tools/gamepad/deadzone-deletefix.mjs, which sets the old value
    // back on a live body and watches the old number return.
    //
    // The original finding, for the record. `input/gamepad.js shapeMoveStick()` removes the
    // 0.15 inner deadzone and RESCALES what is left onto [0,1] — its own comment says the rescale
    // is there "so there is no dead step at the deadzone edge". `combat/player.js:994` then
    // applies `move_deadzone: 0.15` (engine.js:707) A SECOND TIME, to that already-rescaled
    // magnitude, and puts the dead step back.
    //
    // Only an ANALOGUE device can reach it. `real.js _pushMove()` normalises the keyboard to
    // magnitude 1 and `touch.js` pre-shapes exactly as the pad does, so the keyboard never sees
    // this branch and the pad and the touchscreen are the only two devices that do.
    const firstLive = fwd.find((r) => r.steady_m_per_s > 0.01);
    const ls = { inner: 0.15, outer: 0.92 };
    const predicted = +(ls.inner + 0.15 * (ls.outer - ls.inner)).toFixed(4);
    const modelSaysMove = fwd.filter((r) => r.move_mag > 0 && r.steady_m_per_s <= 0.01);
    out.second_deadzone = {
      documented_inner_deadzone: ls.inner,
      first_deflection_that_moves_the_body: firstLive ? firstLive.deflection : null,
      predicted_from_double_application: predicted,
      dead_but_commanded: modelSaysMove.map((r) => ({ deflection: r.deflection, rescaled_move_mag: r.move_mag, world_m_per_s: r.steady_m_per_s })),
      site: 'game/src/combat/player.js:994 reads game/src/engine.js:707 locomotion.move_deadzone = 0.15',
    };
    if (modelSaysMove.length) {
      say(`     SECOND DEADZONE: ${modelSaysMove.length} deflection(s) where the router commands a non-zero move and the body does not move at all:`);
      for (const r of modelSaysMove) say(`        stick ${r.deflection.toFixed(2)} -> rescaled magnitude ${r.move_mag.toFixed(3)} -> ${r.steady_m_per_s.toFixed(3)} m/s`);
    }

    // ARM 2: the SAME sweep with the second deadzone removed. Two arms, one browser, one body.
    const fixedRows = await sweep('move_deadzone=0', 0);
    out.stick_curve_deadzone_zero = fixedRows;
    const fwdFixed = fixedRows.filter((r) => r.bearing === 'forward');
    const firstLiveFixed = fwdFixed.find((r) => r.steady_m_per_s > 0.01);
    out.second_deadzone.first_deflection_that_moves_with_it_removed = firstLiveFixed ? firstLiveFixed.deflection : null;
    // Restore the shipped value before anything else runs against this browser.
    await h.page.evaluate(() => { window.__ENGINE.combat.d.locomotion.move_deadzone = 0.15; });

    const gainedRows = fwd.map((r) => {
      const f = fwdFixed.find((x) => x.deflection === r.deflection);
      return { deflection: r.deflection, shipped_m_per_s: r.steady_m_per_s, deadzone_zero_m_per_s: f ? f.steady_m_per_s : null };
    });
    out.second_deadzone.arms = gainedRows;
    const recovered = gainedRows.filter((g) => g.shipped_m_per_s <= 0.01 && g.deadzone_zero_m_per_s > 0.01 && g.deflection > 0.15);
    say('     ARM COMPARISON (forward bearing):');
    for (const g of gainedRows) say(`        stick ${g.deflection.toFixed(2)}   shipped ${g.shipped_m_per_s.toFixed(3)} m/s   move_deadzone=0 ${String(g.deadzone_zero_m_per_s).padStart(6)} m/s`);
    const shippedDeadzone = await h.page.evaluate(() => window.__ENGINE.combat.d.locomotion.move_deadzone);
    out.second_deadzone.shipped_move_deadzone = shippedDeadzone;
    if (shippedDeadzone === 0 && firstLive && firstLive.deflection <= 0.20 && recovered.length === 0) {
      pass('C7', `NO SECOND DEADZONE. \`locomotion.move_deadzone\` is ${shippedDeadzone} on this tree, so the body starts moving at deflection ${firstLive.deflection} — the documented ${ls.inner} edge — and setting it to 0 explicitly changes nothing (${recovered.length} rows recovered), which is the arms being identical because the fix is already in. With the old 0.15 the first live deflection was 0.27, one rescale further out than the item says; that A/B is in tools/gamepad/deadzone-deletefix.mjs, run on a live body with the old value put back.`, out.second_deadzone);
    } else if (shippedDeadzone > 0 && recovered.length >= 2 && firstLive && firstLiveFixed && firstLiveFixed.deflection < firstLive.deflection) {
      fail('C7', `A SECOND DEADZONE IS APPLIED TO AN ALREADY-DEADZONED STICK. Shipped, the body does not move until deflection ${firstLive.deflection} — not the documented ${ls.inner}, and within rounding of the ${predicted} that double application predicts. With \`locomotion.move_deadzone\` set to 0 in the running world, the same body starts moving at ${firstLiveFixed.deflection} and ${recovered.length} previously dead deflections come alive (${recovered.map((g) => `${g.deflection}: 0 -> ${g.deadzone_zero_m_per_s} m/s`).join(', ')}). The keyboard cannot reach this branch; a pad and a touchscreen are the only devices that can.`, out.second_deadzone);
    } else {
      fail('C7', `neither state established: move_deadzone=${shippedDeadzone}, shipped first-live ${firstLive && firstLive.deflection}, deadzone-zero first-live ${firstLiveFixed && firstLiveFixed.deflection}, ${recovered.length} recovered`, out.second_deadzone);
    }

    if (args['break-dir']) {
      await h.page.evaluate(() => window.__HARNESS.perturbInputReset());
      say('  TEARDOWN --break-dir reverted (perturbInputReset)');
    }
  }

  // =============================================================================== consume ==
  if (want('consume')) {
    say('\n-- LEG: CONSUMPTION (RI-MTH07) — perturb the model, watch the world -----------------');
    // The model is game/data/input/profiles.json. The world-side consumers are (a) UISystem,
    // which opens a screen when the pipeline receives `menu`, and (b) the sim body, whose walk
    // speed is the rescaled stick magnitude. Both are perturbed here and both change.
    await h.page.evaluate(() => { const e = window.__ENGINE; if (e.ui && e.ui.mode !== 'world') e.ui.close(); });
    await hold({}, 3);
    const modeNow = async () => (await W()).ui_mode;

    // (a) MOVE `menu` FROM INDEX 9 TO INDEX 3, in the running world, and watch which button
    //     opens the screen change.
    const base9 = await (async () => { await tap({ down: [B.menu] }, 4, 8); const m = await modeNow(); await tap({ down: [B.menu] }, 4, 8); return m; })();
    // THE TARGET INDEX IS 8, AND THE CHOICE IS THE POINT.
    // Index 8 is the one the screens leg already proved DEAD (S0: `journal` in souls-default's
    // RESERVED table, bound to no action of the closed set, pressed twice and opened nothing).
    // Perturbing `menu` onto it therefore does not merely move a binding — it brings back to life
    // the exact index this run has already watched do nothing.
    //
    // The first draft of this check used index 3 and FAILED, correctly: index 3 carries a
    // `hold_gate` (tap `spell_cycle` / hold `two_hand`), and `_applyButtons` takes the gate branch
    // and `continue`s BEFORE it ever consults `actionFor(i)`. A gated index cannot take a plain
    // button binding at all. That is a real property of the router and it was worth finding.
    const base3 = await (async () => { await tap({ down: [UNBOUND_INDEX] }, 4, 8); const m = await modeNow(); if (m !== 'world') await tap({ down: [B.menu] }, 4, 8); return m; })();
    const perturbed = await h.page.evaluate((i) => window.__HARNESS.perturbInput({ path: 'pad_profiles.souls-default.buttons.menu', value: i }), UNBOUND_INDEX);
    await h.page.evaluate(() => { window.__ENGINE.real.pad.setProfile('souls-default'); });   // re-read the table
    await hold({}, 3);
    const after9 = await (async () => { await tap({ down: [B.menu] }, 4, 8); const m = await modeNow(); if (m !== 'world') await tap({ down: [UNBOUND_INDEX] }, 4, 8); return m; })();
    const after3 = await (async () => { await tap({ down: [UNBOUND_INDEX] }, 4, 8); const m = await modeNow(); if (m !== 'world') await tap({ down: [UNBOUND_INDEX] }, 4, 8); return m; })();
    await h.page.evaluate(() => window.__HARNESS.perturbInputReset());
    await hold({}, 3);
    const restored9 = await (async () => { await tap({ down: [B.menu] }, 4, 8); const m = await modeNow(); if (m !== 'world') await tap({ down: [B.menu] }, 4, 8); return m; })();
    out.consumption_remap = { target_index: UNBOUND_INDEX, base: { idx9: base9, idx3: base3 }, perturbed, after: { idx9: after9, idx3: after3 }, restored: { idx9: restored9 } };
    say(`     shipped:   index 9 -> ${base9},  index ${UNBOUND_INDEX} -> ${base3}`);
    say(`     perturbed: index 9 -> ${after9},  index ${UNBOUND_INDEX} -> ${after3}   (buttons.menu 9 -> ${UNBOUND_INDEX})`);
    say(`     restored:  index 9 -> ${restored9}`);
    if (base9 !== 'world' && base3 === 'world' && after9 === 'world' && after3 !== 'world' && restored9 !== 'world') {
      pass('M1', `CONSUMPTION: moving \`menu\` from index 9 to index ${UNBOUND_INDEX} in game/data/input/profiles.json, in the RUNNING world, moved which physical button opens the screen — index 9 went dead, and index ${UNBOUND_INDEX} (the very index S0 watched do nothing on this same body) came alive. The reset put it back. The data file is the map the pad reads, not paperwork about it`, out.consumption_remap);
    } else {
      fail('M1', `the profile edit did not change what the pad does: ${JSON.stringify(out.consumption_remap)}`, out.consumption_remap);
    }

    // (b) WIDEN THE DEADZONE and watch a walk that worked stop working. This is the model's
    //     other consumer: the body's speed, not a menu.
    const speedAt = async (m) => {
      await h.page.evaluate(() => { window.__ENGINE.sim.camera.yaw = 0; });
      await hold({}, 3);
      const p0 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      await hold({ lx: 0, ly: -m }, 60);
      const p1 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      await hold({}, 3);
      return +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(4);
    };
    const dzBefore = { at_0_30: await speedAt(0.30), at_1_00: await speedAt(1.00) };
    const dzP = await h.page.evaluate(() => window.__HARNESS.perturbInput({ path: 'analog.left_stick.inner_deadzone', value: 0.5 }));
    await hold({}, 3);
    const dzAfter = { at_0_30: await speedAt(0.30), at_1_00: await speedAt(1.00) };
    await h.page.evaluate(() => window.__HARNESS.perturbInputReset());
    await hold({}, 3);
    const dzRestored = { at_0_30: await speedAt(0.30) };
    out.consumption_deadzone = { perturb: dzP, before: dzBefore, after: dzAfter, restored: dzRestored };
    say(`     deadzone 0.15: stick 0.30 walks ${dzBefore.at_0_30} m, stick 1.00 walks ${dzBefore.at_1_00} m`);
    say(`     deadzone 0.50: stick 0.30 walks ${dzAfter.at_0_30} m, stick 1.00 walks ${dzAfter.at_1_00} m`);
    say(`     restored:      stick 0.30 walks ${dzRestored.at_0_30} m`);
    if (dzBefore.at_0_30 > 0.3 && dzAfter.at_0_30 < 0.05 && dzAfter.at_1_00 > 0.3 && dzRestored.at_0_30 > 0.3) {
      pass('M2', `CONSUMPTION: widening \`analog.left_stick.inner_deadzone\` from 0.15 to 0.50 in the running world made a 0.30 stick deflection stop moving the body (${dzBefore.at_0_30} m -> ${dzAfter.at_0_30} m over 60 frames) while full tilt kept working (${dzAfter.at_1_00} m) — the data file is the model the body reads`, out.consumption_deadzone);
    } else {
      fail('M2', `widening the deadzone did not change the walk: ${JSON.stringify(out.consumption_deadzone)}`, out.consumption_deadzone);
    }
  }
} catch (e) {
  fail('RUN', `the probe threw: ${String((e && e.message) || e)}`, { stack: String((e && e.stack) || '').split('\n').slice(0, 8).join('\n') });
} finally {
  try { await h.close(); } catch { /* ignore */ }
}

writeJson(jsonPath, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);
