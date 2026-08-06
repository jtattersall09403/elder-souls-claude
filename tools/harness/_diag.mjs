#!/usr/bin/env node
// TEMPORARY diagnostic — deleted before hand-off.
import fs from 'node:fs';
import { parseArgs } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const args = parseArgs();
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'getHitGeometry']);

const MOVE = String(args.move || 'chop');
const D = String(args.d || '0.8,1.2,2.0').split(',').map(Number);

const out = await handle.page.evaluate(({ D, MOVE }) => {
  const H = window.__HARNESS;
  const segseg = (p1, q1, p2, q2) => {
    const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]];
    const d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
    const r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
    const a = d1[0] * d1[0] + d1[1] * d1[1] + d1[2] * d1[2];
    const e = d2[0] * d2[0] + d2[1] * d2[1] + d2[2] * d2[2];
    const f = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
    const c = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2];
    const b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2];
    const den = a * e - b * b;
    let s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
    let t = e > 1e-12 ? (b * s + f) / e : 0;
    if (t < 0) { t = 0; s = a > 1e-12 ? Math.min(1, Math.max(0, -c / a)) : 0; }
    else if (t > 1) { t = 1; s = a > 1e-12 ? Math.min(1, Math.max(0, (b - c) / a)) : 0; }
    const cx = p1[0] + d1[0] * s - (p2[0] + d2[0] * t);
    const cy = p1[1] + d1[1] * s - (p2[1] + d2[1] * t);
    const cz = p1[2] + d1[2] * s - (p2[2] + d2[2] * t);
    return Math.sqrt(cx * cx + cy * cy + cz * cz);
  };
  const res = {};
  for (const d of D) {
    H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
    H.setEntityPos('E1', 0, 0, { yaw: 0 });
    H.teleport(0, d, { yaw: 180 });
    H.queueEnemyScript('E1', [{ f: 4, move: MOVE }]);
    H.queueInputs([{ f: 0, move: [0, 0] }]);
    const rows = [];
    const hp0 = H.getCombatState().player.hp;
    for (let i = 0; i < 100; i++) {
      H.stepFrames(1);
      const g = H.getHitGeometry();
      const cs = H.getCombatState();
      const E = g.actors.find((a) => a.id === 'E1');
      const P = g.actors.find((a) => a.id === 'P');
      if (!E || !P) continue;
      const wn = E.weapon.now, wp = E.weapon.prev;
      const A = [wn[0], wn[1], wn[2]], B = [wn[3], wn[4], wn[5]];
      const PA = [wp[0], wp[1], wp[2]], PB = [wp[3], wp[4], wp[5]];
      let best = Infinity, bestId = null, bestPrev = Infinity;
      for (const h of P.hurtboxes) {
        const gNow = segseg(A, B, h.a, h.b) - (E.weapon.r + h.r);
        const gPrev = segseg(PA, PB, h.a, h.b) - (E.weapon.r + h.r);
        if (gNow < best) { best = gNow; bestId = h.id; }
        if (gPrev < bestPrev) bestPrev = gPrev;
      }
      rows.push({
        f: i + 1, st: E.state, af: E.anim_frame, hb: E.hitbox_active,
        ez: E.pos[2], pz: P.pos[2],
        sa: A.map((v) => Math.round(v * 1000) / 1000), sb: B.map((v) => Math.round(v * 1000) / 1000),
        pa: PA.map((v) => Math.round(v * 1000) / 1000), pb: PB.map((v) => Math.round(v * 1000) / 1000),
        gapNow: Math.round(best * 1000) / 1000, gapPrev: Math.round(bestPrev * 1000) / 1000,
        part: bestId, hpLost: hp0 - cs.player.hp,
      });
    }
    res[d] = rows;
  }
  return res;
}, { D, MOVE });

if (args.out) fs.writeFileSync(String(args.out), JSON.stringify(out, null, 1));
await handle.close();
for (const d of Object.keys(out)) {
  console.log('=== d =', d, 'move =', MOVE);
  for (const r of out[d]) {
    if (r.st !== 'ATK_ACTIVE' && r.st !== 'ATK_WINDUP') continue;
    console.log(`f${r.f} ${r.st.padEnd(10)} af=${String(r.af).padStart(2)} hb=${r.hb} ez=${r.ez.toFixed(3)} pz=${r.pz.toFixed(2)} sa=[${r.sa.map((v) => v.toFixed(2)).join(',')}] sb=[${r.sb.map((v) => v.toFixed(2)).join(',')}] gapNow=${r.gapNow} gapPrev=${r.gapPrev} ${r.part} hpLost=${r.hpLost}`);
  }
}
