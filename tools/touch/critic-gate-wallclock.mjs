#!/usr/bin/env node
// critic-gate-wallclock.mjs — W1-TOUCH critic. Is the roll/sprint gate reachable BY A THUMB?
//
// THE QUESTION THIS SETTLES. `critic-roll-matrix.mjs` arm B tapped the shared roll/sprint control
// for an intended 70 ms while the stick was held and the pipeline received `sprint:down` — the tap
// was PROMOTED. That has two completely different explanations and the difference decides whether
// there is a defect at all:
//
//   (i)  a REAL defect — the 12-frame gate is reachable by an ordinary thumb-tap, so a player who
//        means to roll sprints instead, which in a Souls fight is death;
//   (ii) MY INSTRUMENT — a CDP round trip on a loaded box is not free, so `waitForTimeout(70)`
//        between a `down` and an `up` is 70 ms plus two dispatches, and the press the game saw was
//        far longer than the press I asked for.
//
// RULES 6 calls (ii) an inert control wearing a finding's clothes, and the round's own F7/F8 are
// both this shape. So the press is no longer timed by me. It is timed BY THE GAME: `TouchInput`
// stamps `gateFrom` on the down and `sim.frame` is read on the up, so every row below reports the
// number of FIXED SIM FRAMES the game itself believes the finger was down, next to the wall-clock
// milliseconds I asked for. `holdGateFrames()` is 12. Anything at or above 12 is a sprint BY
// SPECIFICATION and is not a defect; the question is what a 12-frame press costs in thumb time.
'use strict';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
const SERVE_ROOT = String(process.env.ES_SERVE_ROOT || '') || REPO_ROOT;
const OUT = path.join(REPO_ROOT, 'reports', 'critic-w1-touch');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');
const rec = { schema: 'elder-souls/critic-gate-wallclock@1', rows: [] };

const server = await serveDir(SERVE_ROOT);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
await page.goto(server.origin + '/game/index.html?state=arena_duel', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
await page.evaluate(() => window.__HARNESS.ready());
const cdp = await ctx.newCDPSession(page);

class Finger {
  constructor(c) { this.c = c; this.p = new Map(); }
  l() { return [...this.p.values()].map((q) => ({ x: q.x, y: q.y, id: q.id, radiusX: 12, radiusY: 12, force: 1 })); }
  async down(id, x, y) { this.p.set(id, { id, x, y }); await this.c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.l() }); }
  async move(id, x, y) { const q = this.p.get(id); if (!q) return; q.x = x; q.y = y; await this.c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.l() }); }
  async up(id) { this.p.delete(id); await this.c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.l() }); }
}
const F = new Finger(cdp);
const lay = () => page.evaluate(() => window.__HARNESS.touchLayout());
const at = (l, a) => l.find((c) => c.action === a);

{ const l = await lay(); const ic = at(l, 'interact'); await F.down(9, ic.x, ic.y); await page.waitForTimeout(110); await F.up(9); await page.waitForTimeout(2500); }
const L = await lay(); const rc = at(L, 'roll');
{
  const f = () => page.evaluate(() => window.__ENGINE.sim.frame);
  const a = await f(); const t = Date.now(); await page.waitForTimeout(3000); const b = await f();
  rec.sim_rate = { sim_frames: b - a, ms: Date.now() - t, sim_fps: Math.round(((b - a) / (Date.now() - t)) * 1000 * 10) / 10 };
}
rec.gate_frames = await page.evaluate(() => {
  const cfg = window.__ENGINE.real.touch.cfg;
  const b = cfg.buttons.find((x) => x.action === 'roll');
  return b && b.hold_gate ? b.hold_gate.frames : null;
});
say(`sim rate ${rec.sim_rate.sim_fps} fixed steps/s   (the gate is ${rec.gate_frames} fixed frames)`);
say(`at this rate ${rec.gate_frames} fixed frames is ${Math.round((rec.gate_frames / rec.sim_rate.sim_fps) * 1000)} ms of thumb time; at a true 60 Hz it is ${Math.round((rec.gate_frames / 60) * 1000)} ms\n`);

/**
 * One press, timed by THE GAME. `gateFrom` is stamped by TouchInput on the down; `sim.frame` is
 * read on the up. `framesHeld` is the exact quantity `shouldPromote()` compares against 12.
 */
async function press(askedMs, withStick) {
  if (withStick) { await F.down(1, 160, 260); await page.waitForTimeout(40); await F.move(1, 240, 220); await page.waitForTimeout(400); }
  const t0 = Date.now();
  await F.down(8, rc.x, rc.y);
  const atDown = await page.evaluate(() => {
    const t = window.__ENGINE.real.touch; const h = t.held.get('roll');
    return { gateFrom: h ? h.gateFrom : null, frame: window.__ENGINE.sim.frame };
  });
  await page.waitForTimeout(askedMs);
  const atUp = await page.evaluate(() => ({ frame: window.__ENGINE.sim.frame, promoted: !!(window.__ENGINE.real.touch.held.get('roll') || {}).promoted }));
  await F.up(8);
  const wall = Date.now() - t0;
  const s = [];
  const tEnd = Date.now() + 1500;
  while (Date.now() < tEnd) {
    s.push(await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return { st: c.player.state, mv: c.player.move ? c.player.move.id : null, sta: Math.round(c.player.stamina * 10) / 10 }; }));
    await page.waitForTimeout(30);
  }
  if (withStick) await F.up(1);
  await page.waitForTimeout(1000);
  const framesHeld = atDown.gateFrom == null ? null : (atUp.frame - atDown.gateFrom + 1);
  const moves = [...new Set(s.map((x) => x.mv).filter(Boolean))];
  const states = [...new Set(s.map((x) => x.st))];
  const outcome = states.includes('SPRINT') || moves.some((m) => /sprint/i.test(m)) ? 'sprint'
    : moves.some((m) => /roll/i.test(m)) ? 'roll'
      : moves.some((m) => /backstep/i.test(m)) ? 'backstep'
        : atUp.promoted ? 'promoted-to-sprint (no distinct move id)' : 'nothing';
  return { asked_ms: askedMs, wall_ms: wall, with_stick: !!withStick, frames_held_by_the_game: framesHeld, promoted_at_up: atUp.promoted, moves, states, outcome };
}

// A sweep of thumb times, each arm reporting the frames THE GAME counted.
for (const withStick of [false, true]) {
  for (const ms of [20, 60, 120, 250, 500]) {
    const r = await press(ms, withStick);
    rec.rows.push(r);
    say(`  ${withStick ? 'stick held ' : 'no stick   '} asked ${String(ms).padStart(3)} ms -> wall ${String(r.wall_ms).padStart(4)} ms, the game counted ${String(r.frames_held_by_the_game).padStart(3)} fixed frames -> ${r.outcome}  ${JSON.stringify(r.moves)}`);
  }
}

// ---- the reading -------------------------------------------------------------------------------
const short = rec.rows.filter((r) => r.frames_held_by_the_game !== null && r.frames_held_by_the_game < rec.gate_frames);
const long = rec.rows.filter((r) => r.frames_held_by_the_game !== null && r.frames_held_by_the_game >= rec.gate_frames);
const shortWrong = short.filter((r) => r.outcome === 'sprint' || r.promoted_at_up);
const longWrong = long.filter((r) => r.outcome === 'roll' || r.outcome === 'backstep');
const shortDead = short.filter((r) => r.outcome === 'nothing');
rec.reading = {
  under_gate: short.length, under_gate_wrongly_sprinted: shortWrong.length, under_gate_did_nothing: shortDead.length,
  over_gate: long.length, over_gate_wrongly_rolled: longWrong.length,
};
say(`\nunder the ${rec.gate_frames}-frame gate: ${short.length} presses, ${shortWrong.length} wrongly sprinted, ${shortDead.length} produced nothing at all`);
say(`at or over the gate:      ${long.length} presses, ${longWrong.length} wrongly rolled`);
if (shortWrong.length === 0 && longWrong.length === 0) {
  rec.verdict = `NO GATE DEFECT. Every press the GAME counted under ${rec.gate_frames} fixed frames rolled or backstepped and every press it counted at or over ${rec.gate_frames} sprinted. The earlier 'sprint on a 70 ms tap' was my own instrument: a CDP round trip on a loaded box made the press the game saw far longer than the press I asked for, which is exactly RULES 6's inert control wearing a finding's clothes.`;
} else if (shortWrong.length) {
  rec.verdict = `GATE DEFECT: ${shortWrong.length} of ${short.length} presses that the GAME ITSELF counted as under the ${rec.gate_frames}-frame gate came out as a sprint. The discriminator is not honouring its own frame count.`;
} else {
  rec.verdict = `GATE DEFECT (other direction): ${longWrong.length} of ${long.length} presses the game counted at or over the gate still rolled.`;
}
if (shortDead.length) rec.verdict += `  SEPARATELY: ${shortDead.length} press(es) under the gate produced NO move at all — see the rows.`;
say(`\nVERDICT: ${rec.verdict}`);
writeJson(path.join(OUT, 'critic-gate-wallclock.json'), rec);
say(`artifact reports/critic-w1-touch/critic-gate-wallclock.json`);
await ctx.close(); await browser.close(); await server.close();
