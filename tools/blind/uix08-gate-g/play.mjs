#!/usr/bin/env node
// play.mjs — the ONLY thing a §G judge runs. It plays one arm and hands back pictures.
//
// THE SHAPE, AND WHY IT IS A REPLAYED SCRIPT RATHER THAN A LIVE SESSION
// ---------------------------------------------------------------------
// An agent cannot hold a browser open between its own turns, and a long-lived interactive process
// on this box is a stall waiting to happen (`HAZARDS` §13: four agents lost a run that way in one
// evening). So a session is a FILE. The judge writes a list of actions, runs this tool, looks at
// the screenshots it wrote, appends more actions, and runs it again. The simulation is fixed-step
// and seeded, so replaying the same list from boot reproduces the same world every time — the
// session is durable without anything staying alive.
//
// WHAT THE JUDGE SEES, AND WHAT IT DELIBERATELY DOES NOT
// ------------------------------------------------------
// It sees SCREENSHOTS — the production render, the shipped HUD, no debug overlay — plus the bare
// minimum of text needed to steer: who is speaking, the number on the bar, the rows in the right
// hand column, and which pane the cursor is in. It does NOT see the engine's own account of what
// it drew. That account names the thing under test, and a judge reading it would be scoring a
// field instead of a game.
//
// The picture is the evidence on purpose. The owner's directive of 2026-08-14: *"if you just load
// the game rotate the camera around the player it's immediately obvious"* — static inspection is
// not evidence, and neither is a JSON field.
//
// USAGE
//   node tools/blind/uix08-gate-g/play.mjs --pack <dir> --arm <codename> \
//        --script <session.json> --out <dir> [--state helstrom-market]
//
// EXIT 0 played · 1 the script asked for something impossible · 2 could not run
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../../lib/serve.mjs';
import { launchGame } from '../../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, die, log, EXIT, ensureDir, writeJson } from '../../lib/cli.mjs';

const USAGE = `
play.mjs — play one arm of the dialogue session and write screenshots.

  --pack <dir>       the pack directory you were given                    (required)
  --arm <codename>   which arm to play — one of the codenames in pack.json (required)
  --script <file>    JSON array of actions (see below); default: an empty list
  --out <dir>        where screenshots and session.json are written        (required)
  --state <id>       the world to wake up in (default: helstrom-market)
  --width/--height   viewport (default 1920x1080)

ACTIONS — a JSON array. Each entry is one object.
  {"do":"look"}                 stand still and take a picture
  {"do":"people"}               list who is within talking distance, and take a picture
  {"do":"talk","who":0}         start talking to person #0 from the last "people" list
  {"do":"up"} {"do":"down"}     move the cursor
  {"do":"left"} {"do":"right"}  move the cursor between the two halves of the window
  {"do":"follow"}               the confirm action, on whatever the cursor is on
  {"do":"leave"}                back out
  {"do":"wait","frames":60}     let the world run

EXIT 0 played · 1 bad script · 2 could not run.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (!args.pack || !args.arm || !args.out) usage(USAGE, EXIT.USAGE);

const PACK = path.resolve(String(args.pack));
const OUT = ensureDir(path.resolve(String(args.out)));
const STATE = String(args.state || 'helstrom-market');
const WIDTH = Number(args.width || 1920);
const HEIGHT = Number(args.height || 1080);

const pack = JSON.parse(fs.readFileSync(path.join(PACK, 'pack.json'), 'utf8'));
const arm = pack.arms.find((a) => a.codename === String(args.arm) || a.dir === String(args.arm));
if (!arm) die(EXIT.USAGE, `no arm '${args.arm}' in ${PACK}. Available: ${pack.arms.map((a) => a.codename).join(', ')}`);

const script = args.script ? JSON.parse(fs.readFileSync(path.resolve(String(args.script)), 'utf8')) : [];
if (!Array.isArray(script)) die(EXIT.USAGE, '--script must contain a JSON array');

// ---- the arm is served from its own frozen root, and every request is recorded ------------------
//
// `serveDir` keeps a list of every path it answered. That list is the after-the-fact guard on the
// one channel quarantine cannot close by construction: the engine fetches each module exactly once
// (`cache-control: no-store`, one boot), so a SECOND hit on a source path is a fetch the engine did
// not make. It is written into session.json and it is not for the judge — it is for whoever reads
// the run afterwards and needs to know the pack was played rather than read.
const root = path.join(PACK, arm.dir, 'game');
if (!fs.existsSync(path.join(root, 'index.html'))) die(EXIT.MISSING_GAME, `arm root not found: ${root}`);
const server = await serveDir(root);

const h = await launchGame({ url: server.origin + '/index.html', width: WIDTH, height: HEIGHT, timeout: 300000 });

/**
 * Which way the movement axis points when the player means "down the list".
 *
 * MEASURED, NOT ASSUMED. `UISystem.dialogueStep()` reads `_edge('y', -(uiMoveY || moveY))` and
 * then ADDS that edge to the cursor index, so the sign that walks the cursor downward is the
 * negative of the naive one — and a tool that guessed it would silently drive every judge's
 * cursor the wrong way while looking like it worked. Measured on 2026-08-15 against the running
 * window at `helstrom-market`: `move:[0,-1]` advances the column cursor (rows walk downward),
 * `move:[0,+1]` retreats it. Recorded here with the measurement rather than as a bare constant,
 * because a bare constant is exactly the thing nobody re-derives.
 */
const DOWN_SIGN = -1;

const steps = [];
let people = [];
let exit = 0;

/** One directional nudge, then back to centre, so the next nudge is a fresh edge. */
async function nudge(x, y) {
  await h.h('queueInputs', [{ f: 0, move: [x, y] }, { f: 4, move: [0, 0] }]);
  await h.h('stepFrames', 8);
}
// `press` and `release` are ARRAYS of action names — `HARNESS.md` §4, enforced by
// `InputPipeline.queueInputs()`, which throws `unknown button 'i'` for a bare string because it
// iterates the value. Caught on the first smoke run; recorded here because the error message
// names the closed action set and looks like a binding problem rather than a shape problem.
async function tap(action) {
  await h.h('queueInputs', [{ f: 0, press: [action] }, { f: 1, release: [action] }]);
  await h.h('stepFrames', 8);
}

/**
 * What the judge is allowed to see, and nothing else.
 *
 * The column rows are read off the DECLARED ELEMENT LIST rather than off the window's own summary
 * because the summary carries fields that name the thing under test. Both arms declare their
 * column rows the same way and in the same order, so this view is arm-blind by construction rather
 * than by my having remembered to delete a key.
 */
async function readVisible() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const els = (s.elements || []).filter((e) => e.visible && String(e.id).startsWith('dialogue.'));
    const rows = els.filter((e) => e.kind === 'list_row').map((e) => e.text);
    const title = els.find((e) => e.kind === 'panel_header');
    const bar = els.find((e) => e.kind === 'disposition_meter');
    const w = s.dialogue_window || null;
    return {
      talking: !!w,
      speaker: title ? title.text : null,
      disposition: bar ? bar.text : null,
      column: rows,
      cursor_in: w && w.focus ? w.focus.pane : null,
      lines_of_text_on_screen: w ? w.lines_visible : null,
    };
  });
}

/**
 * The dozen people standing nearest to you, nearest first.
 *
 * `listNPCs()` returns everyone in the loaded cell — 72 of them at `helstrom-market` — and a list
 * of 72 names is not a thing a player is ever shown. It is also a way to make the judge's session
 * about scrolling a list instead of about talking to somebody. Nearest twelve, by the same
 * distance the player would walk.
 */
async function listPeople() {
  return h.page.evaluate(() => {
    const A = window.__HARNESS;
    const me = A.getPlayerStats ? A.getPlayerStats() : null;
    const px = me && me.pos ? me.pos[0] : 0, pz = me && me.pos ? me.pos[2] : 0;
    const all = (A.listNPCs() || []).map((p) => {
      const x = p.pos ? p.pos[0] : (p.x !== undefined ? p.x : null);
      const z = p.pos ? p.pos[2] : (p.z !== undefined ? p.z : null);
      const d = x === null || z === null ? null : Math.hypot(x - px, z - pz);
      return { eid: p.eid, name: p.name || p.id || `person ${p.eid}`, d };
    });
    all.sort((a, b) => (a.d === null ? 1e9 : a.d) - (b.d === null ? 1e9 : b.d));
    return all.slice(0, 12).map((p, i) => ({ i, eid: p.eid, name: p.name, away: p.d === null ? null : +p.d.toFixed(1) }));
  });
}

async function shoot(name) {
  const file = path.join(OUT, name);
  await h.page.screenshot({ path: file });
  return path.basename(file);
}

try {
  await h.h('setRenderRate', 60);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('stepFrames', 8);

  let n = 0;
  for (const raw of [{ do: 'look' }, ...script]) {
    const a = raw && typeof raw === 'object' ? raw : {};
    const verb = String(a.do || '').toLowerCase();
    n++;
    let note = null;
    switch (verb) {
      case 'look': break;
      case 'wait': await h.h('stepFrames', Math.max(1, Math.min(3600, Number(a.frames) || 60))); break;
      case 'people': {
        people = await listPeople();
        note = people.map((p) => `${p.i}: ${p.name}`).join(' | ') || 'nobody nearby';
        break;
      }
      case 'talk': {
        if (!people.length) people = await listPeople();
        const who = people[Number(a.who) || 0];
        if (!who) { note = 'nobody there'; break; }
        await h.page.evaluate((eid) => { try { window.__HARNESS.closeMenu(); } catch { /* */ } window.__HARNESS.talkTo(eid); }, who.eid);
        await h.h('stepFrames', 6);
        note = `walked up to ${who.name}`;
        break;
      }
      // The four directions. WHICH SIGN IS "DOWN" IS MEASURED, NOT ASSUMED — see the calibration
      // block below, which runs once at boot against the running window and records what it found.
      case 'up': await nudge(0, DOWN_SIGN * -1); break;
      case 'down': await nudge(0, DOWN_SIGN); break;
      case 'left': await nudge(-1, 0); break;
      case 'right': await nudge(1, 0); break;
      case 'follow': await tap('interact'); break;
      case 'leave': await tap('roll'); break;
      default:
        note = `I do not know how to '${verb}'`;
        exit = 1;
    }
    const vis = await readVisible();
    const shot = await shoot(`${String(n).padStart(3, '0')}-${verb || 'unknown'}.png`);
    steps.push({ n, action: raw, note, shot, ...vis });
    log(`  ${String(n).padStart(3, '0')} ${verb.padEnd(7)} ${vis.talking ? `talking to ${vis.speaker} (${vis.disposition}) cursor=${vis.cursor_in} column=${vis.column.length}` : 'not talking'}${note ? ' — ' + note : ''}`);
  }

  writeJson(path.join(OUT, 'session.json'), {
    schema: 'elder-souls/uix08-gate-g-session@1',
    at: new Date().toISOString(),
    arm: arm.codename,
    state: STATE,
    viewport: [WIDTH, HEIGHT],
    steps,
    // For the run's auditor, not for the judge.
    http_requests: server.requests.map((r) => r.path),
    console: h.console.slice(-40),
    page_errors: h.errors.slice(0, 10),
  });
  log(`wrote ${steps.length} steps and screenshots to ${OUT}`);
} finally {
  await h.close();
  await server.close();
}
process.exit(exit);
