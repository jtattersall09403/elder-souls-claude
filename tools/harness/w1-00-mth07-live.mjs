#!/usr/bin/env node
// Native RI-MTH07 treatment/null producer for the models owned by W1-00.
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
const out = path.resolve(String(args.out || 'reports/w1-00-codex-builder-sweep/mth07/live.json'));
const h = await launchGame(args);
let report;
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version);
  report = await h.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setRenderRate(0);
    const pos = () => H.getCombatState().player.pos.slice();
    const dist = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
    const rows = [];

    const enemySeed = (seed, withEnemy = true) => {
      H.loadState('arena_flat'); H.setSeed(seed); H.teleport(0, 0);
      if (!withEnemy) { H.stepFrames(180); return null; }
      H.spawn('inf_trash', 3, 5, { as: 'mth07-rng' }); H.aggro('mth07-rng');
      H.stepFrames(180);
      const e = H.listEntities().find((x) => x.eid === 'mth07-rng');
      return e ? { pos: e.pos.map((n) => Math.round(n * 1000) / 1000), state: e.state, hp: e.hp } : { dead: true };
    };
    const ra = enemySeed(1337), rb = enemySeed(4242), rn1 = enemySeed(1337, false), rn2 = enemySeed(4242, false);
    rows.push({ id: 'seeded-prng-stream', model_value_a: 1337, model_value_b: 4242, observed_a: ra, observed_b: rb,
      null_observed_a: rn1, null_observed_b: rn2, coupling: JSON.stringify(ra) !== JSON.stringify(rb) && JSON.stringify(rn1) === JSON.stringify(rn2) ? 1 : 0 });

    const integrate = (frames, moving) => {
      H.loadState('arena_flat'); H.setSeed(4711); H.teleport(0, 0); const a = pos();
      if (moving) H.queueInputs([{ f: 1, move: [0, 1] }, { f: frames + 1, move: [0, 0] }]);
      H.stepFrames(frames); const b = pos(); return { displacement_m: dist(a, b), pos: b };
    };
    const ia = integrate(60, true), ib = integrate(120, true), in1 = integrate(60, false), in2 = integrate(120, false);
    rows.push({ id: 'fixed-step-integrator', model_value_a: 60, model_value_b: 120, observed_a: ia, observed_b: ib,
      null_observed_a: in1, null_observed_b: in2, coupling: Math.abs(ib.displacement_m - ia.displacement_m) / 60 });

    // Drive the shipping rAF accumulator. The observable is body displacement, not the frame
    // counter. A no-input replay is the null arm and must leave the body fixed.
    const catchup = async (stall, moving) => {
      H.loadState('arena_flat'); H.setSeed(4711); H.teleport(0, 0); H.clearInputs();
      if (moving) H.queueInputs([{ f: 1, move: [0, 1] }, { f: 100, move: [0, 0] }]);
      const a = pos(), f0 = H.getFrame(); H.setMode('play'); H.setRenderRate(60);
      await new Promise((r) => requestAnimationFrame(() => r())); if (stall) H.stallMainThread(stall);
      await new Promise((r) => requestAnimationFrame(() => r())); H.setMode('harness'); H.setRenderRate(0); const b = pos();
      return { displacement_m: dist(a, b), advanced_frames: H.getFrame() - f0, pos: b };
    };
    const ca = await catchup(0, true), cb = await catchup(400, true), cn1 = await catchup(0, false), cn2 = await catchup(400, false);
    rows.push({ id: 'catch-up-cap', model_value_a: 0, model_value_b: 400, observed_a: ca, observed_b: cb,
      null_observed_a: cn1, null_observed_b: cn2, coupling: Math.abs(cb.displacement_m - ca.displacement_m) / 400,
      cap_respected: cb.advanced_frames - ca.advanced_frames <= 5 });

    const restore = (x, nullYaw) => {
      H.loadState('arena_flat'); H.teleport(0, 0); H.spawn('guard_legion', 5, 2, { as: 'mth07-save' }); H.aggro('mth07-save'); H.stepFrames(20);
      const b = H.saveState(); const rec = b.fight.enemies.find((e) => e.ctl && e.ctl.ai && e.ctl.ai.__live);
      if (!rec) return { error: 'missing live AI envelope' };
      if (nullYaw !== undefined) rec.ctl.ai.s.yawRate = nullYaw; else rec.ctl.ai.s.anchor = [x, 0, x];
      H.loadState(b); H.stepFrames(120); const e = H.listEntities().find((q) => q.eid === 'mth07-save');
      return e ? { pos: e.pos.slice(), state: e.state } : { dead: true };
    };
    const sa = restore(5), sb = restore(-300), sn1 = restore(0, 1), sn2 = restore(0, 999);
    rows.push({ id: 'durable-save-projection', model_value_a: 5, model_value_b: -300, observed_a: sa, observed_b: sb,
      null_observed_a: sn1, null_observed_b: sn2, coupling: JSON.stringify(sa) !== JSON.stringify(sb) && JSON.stringify(sn1) === JSON.stringify(sn2) ? 1 : 0 });
    return { schema: 'elder-souls/w1-00-mth07-live@1', rows };
  });
} finally { await h.close(); }
for (const r of report.rows) r.pass = r.coupling > 0 && r.id !== 'catch-up-cap' || (r.coupling > 0 && r.cap_respected);
report.pass = report.rows.every((r) => r.pass);
writeJson(out, report);
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
