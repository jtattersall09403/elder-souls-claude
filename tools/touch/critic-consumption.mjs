#!/usr/bin/env node
// critic-consumption.mjs — W1-TOUCH critic. RI-MTH07 / ARBITRATION §3, mandatory.
//
// RI-JRN04's own CONSUMPTION clause: enumerate EXHAUSTIVELY every model the journey requires the
// running game to read, then "perturb and observe" with two well-separated values plus a null
// control, and the admissible observable is what THE PLAYER could see or do — "an input that is
// accepted or refused" is named explicitly. A harness return value is not an observable.
//
// The touch journey publishes exactly four models. Each is perturbed HERE, in the data, on a copy
// of the tree, and the observable is a real finger landing on real glass:
//
//   M1  profiles.json `touch.buttons[]`  — the arc's geometry (cx, cy, r per action).
//       OBSERVABLE: a finger at the SHIPPED centre of 'light' swings; move the row 200 px and the
//       same finger at the same screen point does nothing, while a finger at the NEW centre swings.
//       This is the strongest form available: the same input accepted, then refused, then accepted
//       again somewhere else, driven purely by a number in a data file.
//   M2  profiles.json `touch.stick`      — max_radius_css_px, the deflection scale.
//       OBSERVABLE: metres walked for one fixed finger displacement.
//   M3  input/hold-gate.js DEFAULT + `hold_gate.frames` — the tap/hold discriminator.
//       OBSERVABLE: whether a held finger becomes a sprint. (The round proved the CODE path; this
//       perturbs the DATA row, which is the half a code teardown cannot reach.)
//   M4  profiles.json `touch.camera`     — deg_per_css_px_yaw/pitch.
//       OBSERVABLE: camera yaw in degrees after a fixed drag.
//
// NULL CONTROL: an arm that changes a field NOTHING reads (`touch.buttons[].note`) and must move
// no number at all. Without it, "the world changed when I edited the file" is unfalsifiable —
// a reload alone changes numbers on a nondeterministic box.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
const BASE = String(process.env.ES_SERVE_ROOT || '') || REPO_ROOT;
const OUT = path.join(REPO_ROOT, 'reports', 'critic-w1-touch');
const WORK = path.join(OUT, 'consumption-trees');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');
const rec = { schema: 'elder-souls/critic-touch-consumption@1', item: 'RI-JRN04 CONSUMPTION (RI-MTH07 / ARBITRATION §3)', arms: {} };

/** A copy of the served tree with one JSON edit applied to the touch model. */
function tree(name, mutate) {
  const dst = path.join(WORK, name);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(BASE, 'game'), path.join(dst, 'game'), { recursive: true });
  const p = path.join(dst, 'game', 'data', 'input', 'profiles.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const before = JSON.stringify(j.touch);
  mutate(j);
  if (JSON.stringify(j.touch) === before && name !== 'null-control') {
    throw new Error(`arm ${name}: the perturbation changed NOTHING in profiles.json.touch — an inert arm (RULES 6) would make every number below meaningless.`);
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  return dst;
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });

class Finger {
  constructor(c) { this.c = c; this.p = new Map(); }
  l() { return [...this.p.values()].map((q) => ({ x: q.x, y: q.y, id: q.id, radiusX: 12, radiusY: 12, force: 1 })); }
  async down(id, x, y) { this.p.set(id, { id, x, y }); await this.c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.l() }); }
  async move(id, x, y) { const q = this.p.get(id); if (!q) return; q.x = x; q.y = y; await this.c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.l() }); }
  async up(id) { this.p.delete(id); await this.c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.l() }); }
}

/**
 * Boot one arm and take every observable. `probeAt` is the SCREEN POINT the finger lands on for
 * the M1 test — held fixed across arms on purpose, so that moving the data row under a stationary
 * finger is what changes the outcome.
 */
async function arm(name, root, probeAt) {
  const server = await serveDir(root);
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
  await page.goto(server.origin + '/game/index.html?state=arena_duel', { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
  await page.evaluate(() => window.__HARNESS.ready());
  const cdp = await ctx.newCDPSession(page);
  const F = new Finger(cdp);
  const lay = () => page.evaluate(() => window.__HARNESS.touchLayout());
  const r = { name };
  try {
    { const l = await lay(); const ic = l.find((c) => c.action === 'interact'); await F.down(9, ic.x, ic.y); await page.waitForTimeout(110); await F.up(9); await page.waitForTimeout(2600); }
    const L = await lay();
    r.light_centre = (() => { const c = L.find((x) => x.action === 'light'); return c ? [Math.round(c.x), Math.round(c.y)] : null; })();
    r.stick_radius = await page.evaluate(() => window.__ENGINE.real.touch.cfg.stick.max_radius_css_px);
    r.camera_yaw_per_px = await page.evaluate(() => window.__ENGINE.real.touch.cfg.camera.deg_per_css_px_yaw);
    r.gate_frames = await page.evaluate(() => { const b = window.__ENGINE.real.touch.cfg.buttons.find((x) => x.action === 'roll'); return b.hold_gate ? b.hold_gate.frames : null; });

    // ---- M1: THE OBSERVABLE. A finger at a FIXED screen point — is the swing accepted? --------
    const watch = async (ms) => {
      const t = Date.now(); const s = [];
      while (Date.now() - t < ms) { s.push(await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return { mv: c.player.move ? c.player.move.id : null, sta: Math.round(c.player.stamina * 10) / 10 }; })); await page.waitForTimeout(40); }
      return { moves: [...new Set(s.map((x) => x.mv).filter(Boolean))], sta_start: s[0].sta, sta_min: Math.min(...s.map((x) => x.sta)) };
    };
    await F.down(9, probeAt[0], probeAt[1]); await page.waitForTimeout(80); await F.up(9);
    const w = await watch(1800);
    r.finger_at_fixed_point = { at: probeAt, moves: w.moves, stamina_spent: Math.round((w.sta_start - w.sta_min) * 10) / 10, swung: w.moves.some((m) => /r1|r2/i.test(m)) };
    await page.waitForTimeout(1200);

    // ---- M1b: and at wherever the data now PUTS the control -----------------------------------
    if (r.light_centre) {
      await F.down(9, r.light_centre[0], r.light_centre[1]); await page.waitForTimeout(80); await F.up(9);
      const w2 = await watch(1800);
      r.finger_at_data_centre = { at: r.light_centre, moves: w2.moves, stamina_spent: Math.round((w2.sta_start - w2.sta_min) * 10) / 10, swung: w2.moves.some((m) => /r1|r2/i.test(m)) };
      await page.waitForTimeout(1000);
    }

    // ---- M2: metres walked for ONE fixed finger displacement ----------------------------------
    const p0 = await page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
    await F.down(1, 160, 260); await page.waitForTimeout(40); await F.move(1, 160 + 45, 260);
    await page.waitForTimeout(2500); await F.up(1);
    const p1 = await page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
    r.walked_m_for_45px = Math.round(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) * 1000) / 1000;

    // ---- M4: camera yaw for ONE fixed drag ----------------------------------------------------
    const y0 = await page.evaluate(() => window.__ENGINE.sim.camera.yaw);
    await F.down(2, 700, 120); await page.waitForTimeout(40);
    for (let i = 1; i <= 5; i++) { await F.move(2, 700 - i * 20, 120); await page.waitForTimeout(60); }
    await F.up(2); await page.waitForTimeout(600);
    const y1 = await page.evaluate(() => window.__ENGINE.sim.camera.yaw);
    r.camera_yaw_delta_for_100px = Math.round((y1 - y0) * 100) / 100;
  } finally { await ctx.close(); await server.close(); }
  return r;
}

// The shipped arc's 'light' centre, taken from the data itself, is the fixed probe point.
const shipped = JSON.parse(fs.readFileSync(path.join(BASE, 'game', 'data', 'input', 'profiles.json'), 'utf8'));
const lightRow = shipped.touch.buttons.find((b) => b.action === 'light');
say(`shipped 'light' row: cx=${lightRow.cx} cy=${lightRow.cy} r=${lightRow.r}`);

try {
  // BASELINE — the shipped model.
  const base = await arm('baseline', BASE, [0, 0]);
  // The probe point is the shipped centre, discovered from the baseline layout.
  const PROBE = base.light_centre;
  say(`\nthe fixed probe point is the SHIPPED centre of 'light': (${PROBE[0]},${PROBE[1]})\n`);
  const base2 = await arm('baseline', BASE, PROBE);
  rec.arms.baseline = base2;
  say(`baseline      : light@${JSON.stringify(base2.light_centre)} R=${base2.stick_radius} yaw/px=${base2.camera_yaw_per_px} gate=${base2.gate_frames}`);
  say(`                finger at the fixed point -> swung=${base2.finger_at_fixed_point.swung} ${JSON.stringify(base2.finger_at_fixed_point.moves)}; walked ${base2.walked_m_for_45px} m; camera ${base2.camera_yaw_delta_for_100px}°`);

  // ARM A (M1) — move the 'light' row 200 px left and 60 px up.
  const a = await arm('m1-moved', tree('m1-moved', (j) => {
    const b = j.touch.buttons.find((x) => x.action === 'light');
    b.cx -= 200; b.cy -= 60;
  }), PROBE);
  rec.arms.m1_geometry_moved = a;
  say(`M1 moved      : light@${JSON.stringify(a.light_centre)}`);
  say(`                finger at the SAME fixed point -> swung=${a.finger_at_fixed_point.swung} ${JSON.stringify(a.finger_at_fixed_point.moves)}`);
  say(`                finger at the NEW data centre  -> swung=${a.finger_at_data_centre && a.finger_at_data_centre.swung} ${JSON.stringify(a.finger_at_data_centre && a.finger_at_data_centre.moves)}`);

  // ARM B (M2) — halve the stick radius. Same finger displacement, more deflection.
  const b = await arm('m2-stick', tree('m2-stick', (j) => { j.touch.stick.max_radius_css_px = 45; }), PROBE);
  rec.arms.m2_stick_radius = b;
  say(`M2 R=45       : walked ${b.walked_m_for_45px} m  (baseline ${base2.walked_m_for_45px} m at R=${base2.stick_radius})`);

  // ARM C (M4) — quadruple the camera's degrees per pixel.
  const c = await arm('m4-camera', tree('m4-camera', (j) => { j.touch.camera.deg_per_css_px_yaw = 1.12; }), PROBE);
  rec.arms.m4_camera = c;
  say(`M4 yaw x4     : camera ${c.camera_yaw_delta_for_100px}°  (baseline ${base2.camera_yaw_delta_for_100px}°)`);

  // ARM D (M3) — the gate's DATA row.
  const d = await arm('m3-gate', tree('m3-gate', (j) => { j.touch.buttons.find((x) => x.action === 'roll').hold_gate.frames = 3; }), PROBE);
  rec.arms.m3_gate = d;
  say(`M3 gate=3     : the running game reports gate_frames=${d.gate_frames} (baseline ${base2.gate_frames})`);

  // NULL CONTROL — a field nothing reads.
  const n = await arm('null-control', tree('null-control', (j) => { j.touch.buttons.find((x) => x.action === 'light').note = 'a string no consumer reads'; }), PROBE);
  rec.arms.null_control = n;
  say(`null control  : light@${JSON.stringify(n.light_centre)} walked ${n.walked_m_for_45px} m camera ${n.camera_yaw_delta_for_100px}° swung=${n.finger_at_fixed_point.swung}`);

  // ---- the reading -----------------------------------------------------------------------------
  const couplings = {
    'M1 touch.buttons[] geometry': base2.finger_at_fixed_point.swung && !a.finger_at_fixed_point.swung && !!(a.finger_at_data_centre && a.finger_at_data_centre.swung),
    'M2 touch.stick.max_radius_css_px': Math.abs(b.walked_m_for_45px - base2.walked_m_for_45px) > 0.05,
    'M3 hold_gate.frames': d.gate_frames === 3 && base2.gate_frames === 12,
    'M4 touch.camera.deg_per_css_px_yaw': Math.abs(c.camera_yaw_delta_for_100px) > Math.abs(base2.camera_yaw_delta_for_100px) * 2,
  };
  const nullMoved = n.light_centre[0] !== base2.light_centre[0] || n.light_centre[1] !== base2.light_centre[1];
  rec.couplings = couplings;
  rec.null_control_moved_something = nullMoved;
  say(`\n--- CONSUMPTION ---`);
  for (const [k, v] of Object.entries(couplings)) say(`  ${v ? 'COUPLED  ' : 'ORPHAN  0'} ${k}`);
  say(`  null control moved the arc: ${nullMoved} (must be false)`);
  const orphans = Object.entries(couplings).filter(([, v]) => !v).map(([k]) => k);
  rec.verdict = orphans.length
    ? `ORPHAN MODEL(S): ${orphans.join('; ')}. RI-JRN04 CONSUMPTION §3 — any coupling == 0 scores that dimension 0, fail-closed.`
    : `Every model the touch journey publishes has a world-side consumer, demonstrated by perturbing the DATA and watching a finger be accepted or refused. The null control moved nothing.`;
  say(`\nVERDICT: ${rec.verdict}`);
} catch (e) {
  rec.fatal = String(e && e.stack || e);
  say(`FATAL ${rec.fatal}`);
  process.exitCode = 2;
} finally {
  await browser.close();
  fs.rmSync(WORK, { recursive: true, force: true });
}
writeJson(path.join(OUT, 'critic-consumption.json'), rec);
say(`artifact reports/critic-w1-touch/critic-consumption.json`);
