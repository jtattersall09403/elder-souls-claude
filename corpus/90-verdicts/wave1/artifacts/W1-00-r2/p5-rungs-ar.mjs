#!/usr/bin/env node
// CRITIC-OWNED probe: determinism rungs R3/R6/R7/R8, AR-1 probes, RI-MTH01 fail-closed.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const out = { produced_by: 'critic-owned p5-rungs-ar.mjs' };

const SETUP = { seed: 1337, state: 'arena_flat' };
const INPUTS = [
  { f: 0, move: [0, 1] }, { f: 120, move: [0, 0] },
  { f: 130, press: ['light'] }, { f: 133, release: ['light'] },
  { f: 200, press: ['roll'] }, { f: 203, release: ['roll'] },
  { f: 300, press: ['heavy'] }, { f: 322, release: ['heavy'] },
];

// ---- R3 batch invariance -------------------------------------------------
async function batched(batch, total) {
  const recs = await page.evaluate(async (o) => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    H.spawn('inf_trash', 0, 7, { as: 'e0' }); H.lockOn('e0');
    H.stepFrames(30); H.reanchorFreeRunning();
    H.clearInputs(); H.queueInputs(o.inputs); H.traceStart();
    for (let i = 0; i < o.total; i += o.batch) H.stepFrames(Math.min(o.batch, o.total - i));
    return H.traceStop();
  }, { batch, total, inputs: INPUTS });
  return sha(recs.map(r => JSON.stringify(r)).join('\n'));
}
out.R3 = { b1: await batched(1, 600), b60: await batched(60, 600), b600: await batched(600, 600) };
out.R3.pass = out.R3.b1 === out.R3.b60 && out.R3.b60 === out.R3.b600;

// ---- R6 load order -------------------------------------------------------
out.R6 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const go = (order) => {
    if (order === 'seed-first') { H.setSeed(1337); H.loadState('arena_flat'); }
    else { H.loadState('arena_flat'); H.setSeed(1337); }
    H.teleport(0, 0); H.spawn('inf_trash', 0, 7, { as: 'e0' });
    H.stepFrames(300);
    return H.getStateHash();
  };
  return { seed_then_load: go('seed-first'), seed_then_load_again: go('seed-first'), load_then_seed: go('load-first') };
});
out.R6.pass = out.R6.seed_then_load === out.R6.seed_then_load_again;

// ---- R7 wall-clock invariance (host sleeps between chunks) ---------------
async function chunked(sleepMs) {
  const parts = [];
  await page.evaluate(() => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    H.spawn('inf_trash', 0, 7, { as: 'e0' }); H.stepFrames(30); H.reanchorFreeRunning();
    H.clearInputs(); H.queueInputs([{ f: 0, move: [0, 1] }, { f: 120, move: [0, 0] }]);
    H.traceStart();
  });
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate(() => { const H = window.__HARNESS; H.stepFrames(100); return H.traceDrain(); });
    parts.push(...r);
    if (sleepMs) await new Promise(res => setTimeout(res, sleepMs));
  }
  await page.evaluate(() => window.__HARNESS.traceStop());
  return sha(parts.map(r => JSON.stringify(r)).join('\n'));
}
out.R7 = { no_sleep: await chunked(0), sleep_1200ms: await chunked(1200) };
out.R7.pass = out.R7.no_sleep === out.R7.sleep_1200ms;

// ---- R8 resolution invariance -------------------------------------------
const at = async (w, hh) => {
  await page.setViewportSize({ width: w, height: hh });
  const recs = await page.evaluate(async (o) => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
    H.spawn('inf_trash', 0, 7, { as: 'e0' }); H.stepFrames(30); H.reanchorFreeRunning();
    H.clearInputs(); H.queueInputs(o.inputs); H.traceStart(); H.stepFrames(400);
    return H.traceStop();
  }, { inputs: INPUTS });
  return sha(recs.map(r => JSON.stringify(r)).join('\n'));
};
out.R8 = { at_1920x1080: await at(1920, 1080), at_640x360: await at(640, 360) };
out.R8.pass = out.R8.at_1920x1080 === out.R8.at_640x360;
await page.setViewportSize({ width: 1920, height: 1080 });

// ---- AR-1 -----------------------------------------------------------------
out.AR1 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const res = {};
  // A1/A2: 50 identical scripted swings on a stationary dummy at a fixed range
  H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
  const eid = H.spawn('dummy_passive', 0, 1.6, { as: 'd0' });
  H.lockOn(eid); H.stepFrames(30);
  const dmg = []; let starts = 0, draws0 = 0;
  H.traceStart();
  for (let i = 0; i < 50; i++) {
    H.teleport(0, 0);
    H.clearInputs(); H.queueInputs([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }]);
    H.stepFrames(60);
  }
  const recs = H.traceStop();
  for (const r of recs) {
    draws0 = Math.max(draws0, (r.rng && r.rng.draws) || 0);
    for (const e of (r.events || [])) {
      if (e.type === 'attack_start') starts++;
      if (e.type === 'damage' || e.type === 'hit' || (e.dmg !== undefined)) dmg.push(JSON.stringify(e.dmg !== undefined ? e.dmg : e));
    }
  }
  const evTypes = {}; for (const r of recs) for (const e of (r.events || [])) evTypes[e.type] = (evTypes[e.type] || 0) + 1;
  res.A1_A2 = { attack_starts: starts, event_types: evTypes, distinct_damage_events: [...new Set(dmg)].slice(0, 10), max_rng_draws: draws0 };

  // A3: menu during combat must not freeze the world
  H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0);
  const e2 = H.spawn('inf_trash', 0, 3, { as: 'e1' }); H.aggro(e2); H.stepFrames(30);
  const f0 = H.getFrame();
  H.clearInputs(); H.queueInputs([{ f: 0, press: ['menu'] }]);
  H.stepFrames(120);
  res.A3 = { frames_advanced: H.getFrame() - f0 };

  // A5: animation cancel — inject roll at recovery frames 2, 5, 10
  const cancel = [];
  for (const at of [2, 5, 10]) {
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0); H.stepFrames(24);
    H.clearInputs(); H.queueInputs([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }]);
    H.traceStart(); H.stepFrames(90); const r1 = H.traceStop();
    const base = r1.filter(r => r.player.state === 'ATTACK').length;
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0); H.stepFrames(24);
    H.clearInputs(); H.queueInputs([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] },
      { f: 30 + at, press: ['roll'] }, { f: 33 + at, release: ['roll'] }]);
    H.traceStart(); H.stepFrames(90); const r2 = H.traceStop();
    cancel.push({ inject_at: at, attack_frames_control: base, attack_frames_interrupted: r2.filter(r => r.player.state === 'ATTACK').length });
  }
  res.A5 = cancel;

  // A6: level scaling
  const stats = {};
  for (const st of ['arena_flat', 'endgame-200q']) {
    try {
      H.setSeed(1337); H.loadState(st); H.teleport(0, 0);
      const e = H.spawn('inf_trash', 0, 5, { as: 'x0' }); H.stepFrames(5);
      const en = H.snapshot().enemies.find(x => x.eid === 'x0');
      stats[st] = { hp_max: en.hp_max, poise_max: en.poise_max, player: H.getPlayerStats && H.getPlayerStats() };
    } catch (e) { stats[st] = { error: String(e.message).slice(0, 120) }; }
  }
  res.A6 = stats;

  // A7: homing — player yaw rate while attacking with a look input held
  H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  H.clearInputs();
  const sc = [{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }];
  for (let f = 0; f < 60; f++) sc.push({ f, look: [10, 0] });
  H.queueInputs(sc); H.traceStart(); H.stepFrames(60); const r7 = H.traceStop();
  let maxYawRate = 0;
  for (let i = 1; i < r7.length; i++) {
    if (['windup', 'active', 'recovery'].includes(r7[i].player.phase)) {
      let d = r7[i].player.yaw_deg - r7[i - 1].player.yaw_deg;
      while (d > 180) d -= 360; while (d < -180) d += 360;
      maxYawRate = Math.max(maxYawRate, Math.abs(d));
    }
  }
  res.A7 = { max_player_yaw_change_per_frame_during_attack_deg: +maxYawRate.toFixed(6) };

  // A10: topic list mid-combat
  res.A10 = { has_dialogue_verb: Object.keys(H).filter(k => /talk|topic|dialog/i.test(k)) };
  return res;
});

// ---- RI-MTH01 A12 fail-closed on event shape ------------------------------
out.MTH01_failclosed = await page.evaluate(() => {
  const H = window.__HARNESS;
  const t = (ev) => { try { return { ok: H.queueInputs([ev]) }; } catch (e) { return { threw: String(e.message).slice(0, 160) }; } };
  return {
    tap_sugar: t({ f: 0, tap: 'light' }),
    wibble: t({ f: 0, wibble: 3 }),
    empty: t({ f: 0 }),
    unknown_button: t({ f: 0, press: ['nope'] }),
    good: t({ f: 0, press: ['light'] }),
    spawn_bad: (() => { try { return { ok: H.spawn('nope', 0, 0) }; } catch (e) { return { threw: String(e.message).slice(0, 200) }; } })(),
    camera_short: (() => { try { return { ok: JSON.stringify(H.camera({ pos: [1, 2] })).slice(0, 120) }; } catch (e) { return { threw: String(e.message).slice(0, 160) }; } })(),
    buildinfo: H.getBuildInfo(),
  };
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ R3: out.R3.pass, R6: out.R6.pass, R7: out.R7.pass, R8: out.R8.pass, AR1: out.AR1, MTH01: out.MTH01_failclosed }, null, 1).slice(0, 5000));
await h.close();
