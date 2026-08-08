#!/usr/bin/env node
/**
 * parapet-probe.mjs — does a viaduct parapet hold under SUSTAINED sideways push?
 *
 * Round 3 could not account for a parapet that "holds in a direct test but leaks after ~3.5 m of
 * sustained sideways push, after which the body slides down the valley wall rather than falling",
 * and refused to claim a railing it had not proved. This is the instrument that settles it.
 *
 * For every declared deck span in `roads.json`, the body is teleported onto the deck at the span's
 * midpoint, given a few frames to settle, and then driven with the stick held FULLY SIDEWAYS,
 * perpendicular to the deck's own bearing, for `--frames` frames (default 900 = 15 s, which at
 * 2 m/s is 30 m of push — an order of magnitude more than the 3.5 m at which the leak was seen).
 * Both sides are tested, because a clamp bug is rarely symmetric.
 *
 * What is reported per span, per side, is the WORST perpendicular offset from the deck centreline
 * reached at any frame, against the deck's own half width; whether `onDeckAt` was ever false after
 * the body had been on the deck; and whether a `fall_start` or a SLIDE state was ever entered.
 * A parapet that holds shows |offset| <= half_width + 0.35 m for every frame of every span.
 *
 * The probe is built to FAIL: `--no-clamp` disables `field.clampToDeck` in the running page and
 * must produce leaks, so a green result is not a green result against a disconnected model.
 *
 * Usage: node tools/world/parapet-probe.mjs [--frames 900] [--out reports/parapet.json] [--no-clamp]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const argv = process.argv.slice(2);
const FRAMES = argv.includes('--frames') ? Number(argv[argv.indexOf('--frames') + 1]) : 900;
const NOCLAMP = argv.includes('--no-clamp');
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/parapet.json';
const roads = JSON.parse(readFileSync(join(ROOT, 'game/data/world/roads.json'), 'utf8'));

const spans = [];
for (const leg of roads.legs) {
  for (const sp of leg.deck_spans || []) {
    const pts = leg.points;
    const at = (s) => {
      // `s` is metres along the leg; walk the polyline.
      let acc = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        if (acc + d >= s) {
          const t = (s - acc) / (d || 1);
          return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
            Math.atan2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])];
        }
        acc += d;
      }
      const n = pts.length - 1;
      return [pts[n][0], pts[n][1], Math.atan2(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1])];
    };
    const mid = at((sp.from_m + sp.to_m) / 2);
    spans.push({ leg: leg.id, from_m: sp.from_m, to_m: sp.to_m, kind: sp.kind || 'span',
      half_width_m: leg.half_width_m, x: mid[0], z: mid[1], bearing: mid[2] });
  }
}

const handle = await launchGame({ width: 320, height: 240 });
const rows = [];
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.page.evaluate(() => window.__HARNESS.setRenderRate(0));
  if (NOCLAMP) await handle.page.evaluate(() => { window.__ENGINE.field.clampToDeck = () => null; });
  for (const sp of spans) {
    for (const side of [-1, 1]) {
      const r = await handle.page.evaluate(({ sp, side, FRAMES }) => {
        const E = window.__ENGINE, H = window.__HARNESS;
        H.teleport(sp.x, sp.z);
        const p = E.sim.player;
        // settle onto the deck
        for (let i = 0; i < 30; i++) { E.input.reset(E.sim.frame); E.loop.stepOnce(); }
        const onDeckStart = E.field.onDeckAt(p.pos[0], p.pos[2]);
        const ax = Math.sin(sp.bearing), az = Math.cos(sp.bearing);       // along
        const nx = az * side, nz = -ax * side;                            // perpendicular
        const cy = E.sim.camera.yaw * Math.PI / 180;
        const b = Math.atan2(nx, nz);
        let worst = 0, leftDeck = 0, fell = 0, slid = 0, worstAt = null;
        for (let f = 0; f < FRAMES; f++) {
          E.input.reset(E.sim.frame);
          E.input.queueInputs([{ f: 0, move: [Math.sin(b - cy), Math.cos(b - cy)] }], E.sim.frame);
          E.loop.stepOnce();
          const off = Math.abs((p.pos[0] - sp.x) * nx + (p.pos[2] - sp.z) * nz);
          if (off > worst) { worst = off; worstAt = [+p.pos[0].toFixed(2), +p.pos[2].toFixed(2), +p.pos[1].toFixed(2)]; }
          if (onDeckStart && !E.field.onDeckAt(p.pos[0], p.pos[2])) leftDeck++;
          for (let i = 0; i < E.bus.count; i++) if (E.bus.pool[i].type === 'world_fall_start') fell++;
          if (E.traversal && E.traversal.sliding) slid++;
          if (p.state === 'SLIDE') slid++;
        }
        return { on_deck_at_start: onDeckStart, worst_offset_m: +worst.toFixed(3),
          frames_off_deck: leftDeck, fall_starts: fell, slide_frames: slid, worst_at: worstAt,
          end_y: +p.pos[1].toFixed(2) };
      }, { sp, side, FRAMES });
      const lim = sp.half_width_m + 0.35;
      rows.push({ ...sp, side, ...r, parapet_limit_m: +lim.toFixed(2), held: r.on_deck_at_start ? (r.worst_offset_m <= lim + 0.05 && r.frames_off_deck === 0) : null });
      process.stdout.write(`${sp.leg} ${sp.from_m}-${sp.to_m} side ${side > 0 ? '+' : '-'}  worst ${r.worst_offset_m} m / limit ${lim.toFixed(2)}  offdeck ${r.frames_off_deck}  falls ${r.fall_starts}\n`);
    }
  }
} finally { await handle.close(); }

const tested = rows.filter((r) => r.on_deck_at_start);
const leaked = tested.filter((r) => !r.held);
const git = (() => {
  try {
    const q = (c) => execSync(c, { cwd: ROOT }).toString().trim();
    return { commit: q('git rev-parse HEAD'), branch: q('git rev-parse --abbrev-ref HEAD'), dirty: q('git status --porcelain').length > 0 };
  } catch { return null; }
})();
const doc = {
  schema: 'w1-01/parapet@2',
  measured_at: new Date().toISOString(), git,
  method: 'stick held fully perpendicular to the deck bearing for ' + FRAMES + ' frames (' + (FRAMES / 60).toFixed(0)
    + ' s, ~' + (FRAMES / 60 * 2).toFixed(0) + ' m of push at walk speed) at the midpoint of every declared deck span, both sides',
  clamp_disabled: NOCLAMP,
  frames_per_push: FRAMES,
  spans_declared: spans.length, pushes: rows.length, pushes_from_a_deck: tested.length,
  leaked: leaked.length,
  pass: !NOCLAMP && tested.length > 0 && leaked.length === 0,
  worst_offset_over_limit_m: tested.length ? +Math.max(...tested.map((r) => r.worst_offset_m - r.parapet_limit_m)).toFixed(3) : null,
  rows,
};
mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(doc, null, 2));
console.log(`\n${leaked.length} of ${tested.length} sustained pushes leaked off a deck${NOCLAMP ? ' (clamp DISABLED — leaks are the expected result)' : ''}`);
console.log('  ' + OUT);
process.exit(doc.pass || NOCLAMP ? 0 : 1);
