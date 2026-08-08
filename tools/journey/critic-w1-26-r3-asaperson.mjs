#!/usr/bin/env node
// critic-w1-26-r3-asaperson.mjs — play the opening the way the owner will, and time it.
//
// Owner: the W1-26 round-3 CRITIC. Rule 24.
//
// WHAT MAKES THIS DIFFERENT FROM EVERY OTHER PROBE IN THE TREE, INCLUDING `opening-play.mjs`:
//
//   * it opens the URL `./play.sh` prints, not a path this tool serves itself. §P gate 1 is
//     "clone, one command, a browser window" and the one command is the thing under test.
//   * it goes past `writ.sex`. `opening-play.mjs` P10 passes the moment the node after the desk
//     is reached — one press past `writ.race-observed` — and the tool's own header calls that
//     "the scene can be finished". Nothing in play mode has ever driven the OTHER NINE nodes.
//     `created-by-keyboard.mjs` does drive them, and says so honestly in its own header, but it
//     is `play-instrumented` + `stepFrames`. This one is rAF, no flag, no harness mutator.
//   * it types a PANGRAM as the hatch-name, so all 26 letters are exercised in one commit
//     rather than in the two-name A/B `name-entry.mjs` runs.
//   * it walks out of the Writ House into the world afterwards, and confirms the keyboard is
//     given back: §P gate 1 ends at "and a world", not at "and a stamped writ".
//
// The only `__HARNESS`/`__ENGINE` calls are READS — `census.state()`, `sim.player.pos`,
// `getRenderedText`, `real.debugState()`. No `setMode`, no `stepFrames`, no `censusAnswer`,
// no `titleActivate`, no `queueInputs`, no query string. Grep the file: every mutation of the
// game's state arrives as a real DOM key event from `page.keyboard`.
//
// It can fail. `--red-team=deaf` swallows keydown at the window in the capture phase, and the
// run must then fail to make a character; the exit code is inverted in that mode.
//
// EXIT: non-zero unless a character is created from the title by key alone and the body is
// standing in the world with the keyboard back.
//
// USAGE
//   node tools/journey/critic-w1-26-r3-asaperson.mjs --url http://127.0.0.1:8137/index.html
//        [--json <path>] [--shots <dir>] [--red-team deaf]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-26-r3-asaperson.mjs — play the opening end to end through ./play.sh, as a person.

USAGE
  node tools/journey/critic-w1-26-r3-asaperson.mjs --url <url> [--json <p>] [--shots <d>]
                                                   [--red-team deaf]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const URL = String(args.url || 'http://127.0.0.1:8137/index.html');
const RED = args['red-team'] ? String(args['red-team']) : null;
const shotsDir = args.shots ? path.resolve(String(args.shots)) : path.join(REPO_ROOT, 'docs', 'shots');
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'critic-w1-26-r3', 'asaperson.json');
ensureDir(path.dirname(jsonPath));
if (!RED) ensureDir(shotsDir);

// A pangram, hyphenated the way the hold's own ledger names are. 37 characters, under the
// surface's 40-character cap, and it contains every letter of the alphabet exactly as the brief
// asks. Fourteen of these letters were bound to buttons at round 2.
const PANGRAM = 'Jackdaws-Love-My-Big-Sphinx-Of-Quartz';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

const say = (s) => process.stdout.write(s + '\n');
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { return null; } };

const out = {
  schema: 'elder-souls/critic-asaperson@1',
  piece: 'W1-26-r3',
  role: 'critic',
  red_team: RED,
  url: URL,
  drive: 'real DOM key events only; every __ENGINE/__HARNESS call in this file is a read',
  conditions: { loadavg_at_start: loadavg() },
  timeline: [],
  nodes_visited: [],
  shots: [],
  passes: [], failures: [], checks: {},
};
const T0 = Date.now();
const stamp = () => Number(((Date.now() - T0) / 1000).toFixed(2));
const pass = (id, what, d) => { out.passes.push(id); out.checks[id] = { ok: true, what, ...d }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, d) => { out.failures.push(id); out.checks[id] = { ok: false, what, ...d }; say(`  FAIL ${id}  ${what}`); };
const note = (what, d) => { out.timeline.push({ t: stamp(), what, ...(d || {}) }); say(`  [${stamp()}s] ${what}`); };

const h = await launchGame({
  url: URL, width: 960, height: 540, timeout: 180000,
  initScripts: [
    // The automation tell, and nothing else. `main.js` reads `navigator.webdriver` to pick
    // harness mode; a person's browser says false.
    "Object.defineProperty(navigator,'webdriver',{get:()=>false,configurable:true});",
    ...(RED === 'deaf' ? ["window.addEventListener('keydown',(e)=>{e.stopImmediatePropagation();},true);"] : []),
  ],
});

let exitCode = 0;
try {
  await h.page.waitForFunction(() => window.__ENGINE && window.__ENGINE.sim, { timeout: 180000 });

  const frame = () => h.page.evaluate(() => window.__ENGINE.sim.frame);
  const pos = () => h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
  const census = () => h.page.evaluate(() => {
    const e = window.__ENGINE;
    const st = e.census ? e.census.state() : null;
    return st ? {
      node: st.node, kind: st.input ? st.input.kind : null, paused: !!st.paused, done: !!st.done,
      takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      sel: e.censusSurface ? e.censusSurface.sel : null,
      options: e.censusSurface ? e.censusSurface.options.map((o) => o.id) : [],
      picked: e.censusSurface ? e.censusSurface.picked.slice() : [],
      typed: e.censusSurface ? e.censusSurface.typed : '',
      refusal: e.censusSurface ? (e.censusSurface.refusal || null) : null,
      fault: e.censusSurface ? (e.censusSurface.fault || null) : null,
      race: e.census ? e.census.spec.race : null,
      pick_want: e.censusSurface && st.input && st.input.kind === 'pick' ? e.censusSurface.pickCount(st) : 0,
    } : null;
  });
  const drawn = (since) => h.page.evaluate((m) => window.__HARNESS.getRenderedText(m === null ? {} : { since: m }), since === undefined ? null : since);

  /** Wait for the rAF loop to deliver `n` sim frames. Nothing here steps the sim. */
  async function advance(n, capMs = 90000) {
    const f0 = await frame(); const t0 = Date.now(); let f = f0;
    while (f - f0 < n && Date.now() - t0 < capMs) { await h.page.waitForTimeout(100); f = await frame(); }
    return f - f0;
  }
  /** A press that is guaranteed to have been latched by a fixed step before the next one. */
  async function press(key, frames = 3) {
    await h.page.keyboard.press(key);
    await advance(frames, 30000);
  }
  async function shot(name) {
    const p = path.join(shotsDir, `2026-08-08-w1-26-r3-critic-${name}.png`);
    try { await h.page.screenshot({ path: p, timeout: 120000, animations: 'disabled' }); out.shots.push(p); say(`  [shot] ${path.relative(process.cwd(), p)}`); }
    catch (e) { say(`  [shot FAILED] ${name}: ${e.message}`); }
  }

  // ---- A1 — the title a person gets --------------------------------------------------------
  const boot = await h.page.evaluate(() => ({ mode: window.__ENGINE.mode, search: location.search, origin: location.origin }));
  out.checks.boot = boot;
  await advance(6, 60000);
  note('title reached', boot);
  await shot('01-the-title-play-sh-serves');
  if (boot.mode === 'play' && boot.search === '') pass('A1', `play.sh served a play-mode title at ${boot.origin} with no query string`, boot);
  else fail('A1', `mode '${boot.mode}' search '${boot.search}' — not what a person gets`, boot);

  // ---- A2 — New, by key alone --------------------------------------------------------------
  await press('Enter', 6);
  await advance(20, 90000);
  let st = await census();
  const inWorld = await h.page.evaluate(() => !!(window.__ENGINE.sim.env && window.__ENGINE.sim.env.interior !== undefined));
  out.checks.after_new = { census: st, inWorld };
  note('pressed Enter on New', { node: st ? st.node : null });
  await shot('02-the-hold-a-body-in-a-world');
  if (st && st.node === 'hold.come-to') pass('A2', `Enter on 'New' put a body in the hold at '${st.node}'`, { node: st.node });
  else fail('A2', `after Enter the census is ${JSON.stringify(st && st.node)}`, { st });

  // ---- A3 — walk to her and press E --------------------------------------------------------
  const p0 = await pos();
  await h.page.keyboard.down('KeyW');
  await advance(50, 90000);
  await h.page.keyboard.up('KeyW');
  await advance(3, 20000);
  const p1 = await pos();
  const walked = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
  out.checks.free_walk_m = Number(walked.toFixed(3));
  note(`walked ${walked.toFixed(2)} m on held KeyW with nothing asked`);

  // reach her: press interact until the scene opens, walking toward her if it does not
  let opened = false;
  for (let i = 0; i < 14 && !opened; i++) {
    await press('KeyE', 4);
    st = await census();
    if (st && st.node === 'hold.hatch-name') { opened = true; break; }
    await h.page.keyboard.down('KeyW'); await advance(14, 40000); await h.page.keyboard.up('KeyW'); await advance(2, 10000);
  }
  st = await census();
  note('reached for her', { node: st ? st.node : null, opened });
  if (opened) pass('A3', `walked ${walked.toFixed(2)} m unprompted, then KeyE opened '${st.node}'`, { walked_m: Number(walked.toFixed(3)) });
  else fail('A3', `could not open the scene: node is ${JSON.stringify(st && st.node)}`, { st });

  // ---- A4 — type a pangram -----------------------------------------------------------------
  const typeStart = Date.now();
  for (const ch of PANGRAM) {
    await h.page.keyboard.press(ch === '-' ? 'Minus' : ch);
    await h.page.waitForTimeout(20);
  }
  await advance(3, 30000);
  st = await census();
  const typed = st ? st.typed : '';
  out.checks.typed = { want: PANGRAM, got: typed, ms: Date.now() - typeStart };
  const missing = [...ALPHABET].filter((c) => !typed.toLowerCase().includes(c));
  out.checks.alphabet_missing = missing;
  await shot('03-a-pangram-in-the-name-field');
  if (typed === PANGRAM && missing.length === 0) pass('A4', `all 26 letters typed verbatim into the field: "${typed}"`, { typed });
  else fail('A4', `typed "${PANGRAM}" and the field holds "${typed}" — missing letters: ${missing.join('') || 'none'}`, out.checks.typed);

  // ---- A5 — drive the WHOLE census by key --------------------------------------------------
  // Generic: text -> Enter (commits what is typed), observed/choice -> Enter, pick -> move the
  // caret and Enter until the required count is reached. Nothing node-specific, so a graph
  // change cannot silently make this script wrong.
  const visited = [];
  let guard = 0;
  let stamped = false;
  while (guard++ < 220) {
    st = await census();
    if (!st || st.done) { stamped = true; break; }
    visited.push({ t: stamp(), node: st.node, kind: st.kind, paused: st.paused, takes_input: st.takes_input, refusal: st.refusal, fault: st.fault });
    if (st.refusal || st.fault) { note(`REFUSAL at ${st.node}`, { refusal: st.refusal, fault: st.fault }); break; }
    if (st.paused && !st.takes_input) {
      // a hand-back node: the body has the keys. hold.out resumes on a walk to z>=4.2, |x|<=1.6.
      const before = st.node;
      let moved = false;
      for (let k = 0; k < 26 && !moved; k++) {
        const q = await pos();
        const dx = 0 - q[0], dz = 5.2 - q[2];
        const cy = (await h.page.evaluate(() => window.__ENGINE.sim.camera ? window.__ENGINE.sim.camera.yaw || 0 : 0)) * Math.PI / 180;
        const mx = dx * Math.cos(cy) - dz * Math.sin(cy);
        const my = dx * Math.sin(cy) + dz * Math.cos(cy);
        const held = [];
        if (my > 0.4) held.push('KeyW'); else if (my < -0.4) held.push('KeyS');
        if (mx > 0.4) held.push('KeyD'); else if (mx < -0.4) held.push('KeyA');
        if (!held.length) held.push('KeyW');
        for (const kk of held) await h.page.keyboard.down(kk);
        await advance(16, 60000);
        for (const kk of held) await h.page.keyboard.up(kk);
        await advance(2, 10000);
        const now = await census();
        if (!now || now.node !== before) { moved = true; note(`walked out of '${before}' to '${now ? now.node : 'done'}'`); }
      }
      if (!moved) { note(`STUCK at hand-back node '${before}'`); break; }
      continue;
    }
    if (!st.takes_input) { await advance(4, 20000); continue; }
    if (st.kind === 'pick') {
      const want = st.pick_want || 2;
      for (let k = 0; k < want; k++) { await press('ArrowDown', 2); await press('Enter', 3); }
      continue;
    }
    if (st.kind === 'text' && st.node !== 'hold.hatch-name' && !st.typed) {
      // type something at every other text node too, so no text node is answered off the ledger
      for (const ch of 'Vashk-Doon') { await h.page.keyboard.press(ch === '-' ? 'Minus' : ch); await h.page.waitForTimeout(20); }
      await advance(2, 20000);
    }
    const before = st.node;
    await press('Enter', 4);
    const now = await census();
    if (now && now.node === before && now.takes_input && !now.picked.length) {
      // one more nudge, then give up on this node
      await press('Enter', 4);
      const again = await census();
      if (again && again.node === before) { note(`node '${before}' did not advance on two Enters`); }
    }
  }
  out.nodes_visited = visited;
  const finalCensus = await census();
  const character = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    const c = e.sim && e.sim.character ? e.sim.character : (e.character || null);
    const writ = (e.readWrit ? (() => { try { return e.readWrit(); } catch { return null; } })() : null);
    return {
      character: c ? { name: c.name || null, race: c.race || null, cls: c.class || c.cls || null, birthsign: c.birthsign || null } : null,
      writ_lines: writ && writ.lines ? writ.lines.length : (Array.isArray(writ) ? writ.length : null),
      identity: e.sim && e.sim.identity ? { race: e.sim.identity.race, name: e.sim.identity.name || null } : null,
    };
  }).catch((e) => ({ error: e.message }));
  out.checks.character = character;
  out.checks.final_census = finalCensus;
  out.checks.creation_seconds = stamp();
  await shot('04-the-writ-stamped');
  const uniqueNodes = [...new Set(visited.map((v) => v.node))];
  out.checks.unique_nodes = uniqueNodes;
  if (stamped || (finalCensus && finalCensus.done)) {
    pass('A5', `the whole census was answered by key alone — ${uniqueNodes.length} nodes, ${stamp()} s of wall clock`, { nodes: uniqueNodes });
  } else {
    fail('A5', `creation did not complete: last node '${finalCensus ? finalCensus.node : 'null'}' after ${uniqueNodes.length} nodes`, { nodes: uniqueNodes, last: finalCensus });
  }

  // ---- A6 — walk out into the world, keyboard back -----------------------------------------
  const q0 = await pos();
  const dbg0 = await h.page.evaluate(() => window.__ENGINE.real.getInputState ? window.__ENGINE.real.getInputState() : null).catch(() => null);
  await h.page.keyboard.down('KeyW');
  await advance(60, 120000);
  await h.page.keyboard.up('KeyW');
  await advance(3, 20000);
  const q1 = await pos();
  const outWalk = Math.hypot(q1[0] - q0[0], q1[2] - q0[2]);
  const dbg1 = await h.page.evaluate(() => window.__ENGINE.real.getInputState ? window.__ENGINE.real.getInputState() : null).catch(() => null);
  out.checks.walk_after_creation_m = Number(outWalk.toFixed(3));
  out.checks.input_debug = { before: dbg0, after: dbg1 };
  await shot('05-standing-in-the-world-after-creation');
  if (outWalk > 1.0 && !(dbg1 && dbg1.textFocused)) {
    pass('A6', `the body walked ${outWalk.toFixed(2)} m after the writ, with textFocused=${dbg1 ? dbg1.textFocused : 'n/a'}`, { m: Number(outWalk.toFixed(3)) });
  } else {
    fail('A6', `after creation the body moved ${outWalk.toFixed(2)} m; textFocused=${dbg1 ? dbg1.textFocused : 'n/a'}`, { m: Number(outWalk.toFixed(3)), dbg1 });
  }

  // ---- A7 — the world after the writ: walk, sprint, roll, and every screen ------------------
  //
  // The other half of the text-focus fix. A companion probe tried to measure this by reading the
  // input pipeline under `stepFrames` and could not: `pressed` is an edge cleared by the next
  // latch and `moveX/moveY` are consumed by the step, so a read taken after the step returns
  // zero on a healthy build. Measured here by OUTCOME instead, under rAF, where a player is.
  const world = { };
  const travel = async (keys, frames) => {
    const a = await pos();
    for (const k of keys) await h.page.keyboard.down(k);
    const adv = await advance(frames, 90000);
    for (const k of keys) await h.page.keyboard.up(k);
    await advance(2, 20000);
    const b = await pos();
    return { m: Number(Math.hypot(b[0] - a[0], b[2] - a[2]).toFixed(3)), frames: adv };
  };
  world.walk = await travel(['KeyW'], 40);
  world.sprint = await travel(['ShiftLeft', 'KeyW'], 40);
  world.strafe = await travel(['KeyD'], 25);
  world.back = await travel(['KeyS'], 25);
  world.roll = await travel(['Space'], 25);
  // per-frame travel, so the two gaits are comparable even when the frame budget differs
  const perFrame = (r) => (r.frames ? Number((r.m / r.frames).toFixed(4)) : 0);
  world.walk_per_frame = perFrame(world.walk);
  world.sprint_per_frame = perFrame(world.sprint);
  const screens = [];
  for (const key of ['KeyM', 'Escape']) {
    const before = await h.page.evaluate(() => (window.__ENGINE.ui ? window.__ENGINE.ui.mode : null));
    await press(key, 4);
    const opened = await h.page.evaluate(() => (window.__ENGINE.ui ? window.__ENGINE.ui.mode : null));
    await press('Escape', 4);
    const closed = await h.page.evaluate(() => (window.__ENGINE.ui ? window.__ENGINE.ui.mode : null));
    screens.push({ key, before, opened, closed, opened_ok: opened !== 'world', closed_ok: closed === 'world' });
  }
  world.screens = screens;
  world.textFocused = (await h.page.evaluate(() => window.__ENGINE.real.getInputState())).textFocused;
  out.checks.world_after_writ = world;
  const gaitsOk = world.walk.m > 0.5 && world.sprint_per_frame > world.walk_per_frame * 1.05;
  const screensOk = screens.every((s) => s.opened_ok && s.closed_ok);
  if (gaitsOk && world.strafe.m > 0.2 && world.back.m > 0.2 && screensOk && world.textFocused === false) {
    pass('A7', `after the writ: walked ${world.walk.m} m, sprinted ${world.sprint_per_frame} m/frame against a walk of ${world.walk_per_frame}, strafed ${world.strafe.m} m, backed ${world.back.m} m, ${screens.length} screen(s) opened and closed, textFocused=false`, world);
  } else {
    fail('A7', `walk ${world.walk.m} m, sprint/frame ${world.sprint_per_frame} vs walk/frame ${world.walk_per_frame}, strafe ${world.strafe.m}, back ${world.back.m}, screens ${JSON.stringify(screens)}, textFocused=${world.textFocused}`, world);
  }

  out.conditions.loadavg_at_end = loadavg();
  out.conditions.total_seconds = stamp();
  out.conditions.page_errors = h.errors.slice(0, 8);
} catch (e) {
  fail('RUN', `threw: ${e.message}`, { stack: String(e.stack || '').split('\n').slice(0, 6) });
} finally {
  const failed = out.failures.length > 0;
  if (RED) { exitCode = failed ? 0 : 1; say(`\n  RED TEAM '${RED}': ${failed ? 'the sabotage was caught' : 'NOT CAUGHT — this probe cannot fail'}`); }
  else exitCode = failed ? 1 : 0;
  say(`\n  ${out.passes.length} pass · ${out.failures.length} fail · ${stamp()} s wall clock`);
  writeJson(jsonPath, out);
  say(`  artifact: ${path.relative(process.cwd(), jsonPath)}`);
  await h.close();
  process.exit(exitCode);
}
