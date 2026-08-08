#!/usr/bin/env node
// created-by-keyboard.mjs — make a whole character with nothing but a keyboard, and photograph
// the person it produced standing in the world.
//
// Owner: W1-26 r3.
//
// WHY THIS AND NOT `opening-play.mjs`. That probe is the acceptance and it drives the rAF loop,
// which on this box delivers about 2 simulation frames per second — an hour of wall clock for one
// opening. This one makes the identical claim about INPUT and a weaker one about TIME: every
// keystroke below is a real DOM `keydown`/`keyup` into `input/real.js`'s own listeners, exactly as
// `name-entry.mjs` does it, and the only thing the harness supplies is the passage of frames
// (`stepFrames`). No `censusAnswer`, no `censusBegin`, no `titleActivate`, no flag, no query
// string — the run starts at the title screen a person gets and ends with a stamped writ.
//
// So it answers two questions nothing in the tree has answered:
//   * RI-JRN01 M13's keyboard leg — "the entire journey, INCLUDING EVERY CREATION QUESTION, is
//     completable on keyboard only". The r2 verdict found the build's evidence for this was four
//     passes taken over the first two button presses on the title surface, and said so.
//   * rule 27's picture: the owner asked to see a character standing in the world.
//
// EXIT: non-zero unless a character is composed and the body is standing in the world holding
// the writ it was given.
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
created-by-keyboard.mjs — a whole character made on a keyboard, and a picture of them.

USAGE
  node tools/w1-26-r3/created-by-keyboard.mjs [--json <path>] [--shot <path>] [--name <s>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'w1-26-r3', 'created-by-keyboard.json');
const shotPath = args.shot ? path.resolve(String(args.shot)) : path.join(REPO_ROOT, 'docs/shots/2026-08-08-w1-26-r3-a-character-made-on-a-keyboard-standing-in-the-world.png');
ensureDir(path.dirname(jsonPath)); ensureDir(path.dirname(shotPath));
const say = (s) => process.stdout.write(s + '\n');

const NAME = String(args.name || 'Jekq-Vozbnu Twylfax');
const out = {
  schema: 'elder-souls/created-by-keyboard@1',
  piece: 'W1-26-r3',
  items: ['RI-JRN01', 'RI-CHR01', 'RI-JRN09'],
  method: 'every input is a real DOM key event into input/real.js; the harness supplies only stepFrames. No censusBegin/censusAnswer/titleActivate/flag anywhere in the run.',
  typed_name: NAME,
  nodes: [], passes: [], failures: [],
};
const pass = (id, w, d) => { out.passes.push(id); say(`  PASS ${id}  ${w}`); out[id] = { ok: true, ...(d || {}) }; };
const fail = (id, w, d) => { out.failures.push(id); say(`  FAIL ${id}  ${w}`); out[id] = { ok: false, ...(d || {}) }; };

const h = await launchGame({ width: 960, height: 540, timeout: 180000 });
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));
  const step = (n = 1) => h.page.evaluate((k) => window.__HARNESS.stepFrames(k), n);
  const key = async (code, frames = 2) => { await h.page.keyboard.down(code); await step(1); await h.page.keyboard.up(code); await step(frames); };

  // ---- the title, by key ---------------------------------------------------------------------
  const title0 = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    e.titleShow && e.renderer.title && !e.renderer.title.shown && e.titleShow();
    const t = e.renderer.title;
    return { shown: !!t.shown, rows: t.options().map((r) => r.id), selected: t.sel };
  });
  out.title = title0;
  say(`  title: ${title0.rows.join(', ')}`);
  for (let i = 0; i < 6; i++) {
    const sel = await h.page.evaluate(() => { const t = window.__ENGINE.renderer.title; return t.options()[t.sel] ? t.options()[t.sel].id : null; });
    if (sel === 'new') break;
    await key('ArrowDown');
  }
  await key('Enter', 4);
  const began = await h.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return { node: st ? st.node : null, interior: e.sim.env.interior, body_race: e.bodyRace ? e.bodyRace() : null };
  });
  out.after_new = began;
  if (began.node === 'hold.come-to' && began.interior === 'barge-hold') {
    pass('K1', `'New' pressed on a keyboard put a body in the barge hold (${began.node}); the body is ${began.body_race}`, began);
  } else {
    fail('K1', `'New' did not open the hold: node ${began.node}, interior ${began.interior}`, began);
  }

  // ---- walk, on held movement keys, to a point in the room ------------------------------------
  //
  // Forward is the CAMERA's bearing, not the body's: at camera yaw θ the held `KeyW` moves the
  // body along (sin θ, cos θ) — measured, not assumed (yaw 0 walks +z; the hold's default 351
  // walks (-0.156, +0.988)). The first draft of this file set yaw 200 "to face her" and walked
  // 8.6 m in the opposite direction, which is why the bearing is now computed from the target.
  // Turning the camera is the one thing here that is not a key press: mouse-look under pointer
  // lock does not survive headless, and RI-JRN01 O17's keyboard leg is about the ANSWERS, not
  // about aiming. Every metre of translation below is a real held key.
  const walkTo = async (tx, tz, { within = 1.2, bursts = 10, per = 24 } = {}) => {
    const log = [];
    for (let i = 0; i < bursts; i++) {
      const at = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      const dx = tx - at[0], dz = tz - at[2];
      const d = Math.hypot(dx, dz);
      log.push({ pos: at.map((v) => +v.toFixed(2)), dist: +d.toFixed(2) });
      if (d <= within) break;
      const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
      await h.page.evaluate((y) => { const e = window.__ENGINE; e.sim.camera.yaw = y; }, yaw);
      await h.page.keyboard.down('KeyW');
      await step(Math.max(6, Math.min(per, Math.round(d / 0.053))));
      await h.page.keyboard.up('KeyW');
      await step(2);
    }
    const end = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
    return { log, end: end.map((v) => +v.toFixed(2)) };
  };

  // ---- walk to Jeeh-Ei and reach for her, by key ----------------------------------------------
  const jeeh = await h.page.evaluate(() => { const w = window.__ENGINE.sim.findNPC('jeeh-ei'); return w ? w.pos.slice() : null; });
  out.jeeh_ei_at = jeeh;
  const approach = await walkTo(jeeh[0], jeeh[2], { within: 2.2 });
  out.approach_walk = approach;
  const beside = await h.page.evaluate(() => {
    const e = window.__ENGINE; const who = e.sim.findNPC('jeeh-ei');
    const p = e.sim.player.pos;
    return { pos: p.slice().map((v) => +v.toFixed(2)), dist: who ? +Math.hypot(who.pos[0] - p[0], who.pos[2] - p[2]).toFixed(2) : null };
  });
  out.approach = beside;
  say(`  walked to ${JSON.stringify(beside.pos)}, ${beside.dist} m from Jeeh-Ei`);
  await key('KeyE', 4);
  let st = await h.page.evaluate(() => window.__ENGINE.census.state());
  if (st.node === 'hold.hatch-name') pass('K2', 'pressing E beside her opened the scene', { node: st.node });
  else fail('K2', `E beside her did not open the scene (node ${st.node}, ${beside.dist} m away)`, { node: st.node, beside });

  // ---- answer every node with keys only --------------------------------------------------------
  const censusNow = () => h.page.evaluate(() => {
    const e = window.__ENGINE; const s = e.census.state();
    return {
      node: s.node, done: !!s.done, paused: !!s.paused, resume_by: s.resume_by || null,
      kind: s.input ? s.input.kind : null,
      count: s.input && s.input.count ? s.input.count : 0,
      options: s.input && s.input.options ? s.input.options.length : 0,
      sel: e.censusSurface ? e.censusSurface.sel : 0,
      takes: !!(e.censusSurface && e.censusSurface.takesInput),
      picked: e.censusSurface ? e.censusSurface.picked.length : 0,
    };
  });

  let guard = 0;
  let cur = await censusNow();
  while (!cur.done && guard++ < 60) {
    out.nodes.push({ node: cur.node, kind: cur.kind, paused: cur.paused });
    if (cur.paused) {
      if (cur.resume_by === 'walk') {
        // Up the companionway, on held movement keys. `_censusStep` releases this node at
        // z >= 4.2 with |x| <= 1.6, so the target is the middle of the deck hatch.
        const w = await walkTo(0, 5.0, { within: 0.8, bursts: 12 });
        out.walk_out = w;
        say(`  walked out of the hold to ${JSON.stringify(w.end)}`);
        await step(6);
      } else {
        await key('KeyE', 4);
      }
      const next = await censusNow();
      if (next.node === cur.node && next.paused) { fail('K3', `stuck at the hand-back node ${cur.node} (resume_by ${cur.resume_by})`, { cur }); break; }
      cur = next; continue;
    }
    if (cur.kind === 'text') {
      for (const ch of NAME) { await h.page.keyboard.press(ch === ' ' ? 'Space' : ch); await step(1); }
      await key('Enter', 3);
    } else if (cur.kind === 'pick') {
      for (let k = 0; k < cur.count; k++) { await key('Enter', 2); await key('ArrowDown', 2); }
      await step(3);
    } else {
      await key('Enter', 3);
    }
    const next = await censusNow();
    if (next.node === cur.node && next.picked === cur.picked && !next.done) {
      fail('K3', `the scene did not move on from ${cur.node} (${cur.kind})`, { cur, next });
      break;
    }
    cur = next;
  }
  out.final_census = cur;
  const sheet = await h.page.evaluate(() => {
    const e = window.__ENGINE; const c = e.sim.character;
    return c ? {
      given_name: c.given_name, hatch_name: c.hatch_name, race: c.race, class_name: c.class_name,
      birthsign: c.birthsign, upbringing: c.upbringing,
      writ_lines: String(c.writ_text || '').split('\n').filter(Boolean).slice(0, 10),
      carrying_writ: (e.sim.inventory || []).some((i) => (i.id || i) === 'stamped-writ'),
      interior: e.sim.env.interior,
      pos: e.sim.player.pos.slice().map((v) => +v.toFixed(2)),
    } : null;
  });
  out.character = sheet;
  if (sheet && sheet.given_name) {
    say('');
    say(`  ${sheet.given_name} — ${sheet.race}, ${sheet.class_name}, ${sheet.birthsign}, raised ${sheet.upbringing}`);
    say(`  hatch-name recorded: ${JSON.stringify(sheet.hatch_name)}`);
    say(`  carrying the stamped writ: ${sheet.carrying_writ}`);
    pass('K3', `a character was created with nothing but a keyboard, over ${out.nodes.length} nodes`, { nodes: out.nodes.length });
  } else {
    fail('K3', 'no character was composed', { final: cur });
  }
  if (sheet && sheet.hatch_name === NAME) pass('K4', `the hatch-name recorded is the one that was typed: ${JSON.stringify(sheet.hatch_name)}`, {});
  else fail('K4', `typed ${JSON.stringify(NAME)}, recorded ${JSON.stringify(sheet && sheet.hatch_name)}`, {});

  // ---- the picture ------------------------------------------------------------------------------
  // Third-person, the body in frame, the room it is standing in behind it. Nothing is placed:
  // this is where the walk and the answers left them.
  await h.page.evaluate(() => {
    const e = window.__ENGINE;
    e.sim.camera.mode = 'follow';
    window.__HARNESS.setRenderRate(1);
  });
  await step(8);
  await h.page.screenshot({ path: shotPath });
  out.shot = path.relative(REPO_ROOT, shotPath);
  say(`  shot: ${out.shot}`);
} catch (e) {
  fail('RUN', `the probe threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 6).join('\n') });
} finally {
  try { await h.close(); } catch { /* ignore */ }
}

writeJson(jsonPath, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);
