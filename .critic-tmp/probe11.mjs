// CRITIC-OWNED probe 11: does queueInputs silently swallow unrecognised sugar keys?
// Then AR-1 A1/A2/A4/A5/A7 and RI-CMB07 M0 with the raw {press,release} the game actually takes.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';

const out = process.argv[2];
const h = await launchGame({});
const page = h.page;
const report = { schema: 'critic/w1-00-ar1@1', at: new Date().toISOString() };

report.sugar = await page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness');
  const o = {};
  const t = (k, fn) => { try { o[k] = { threw: false, v: JSON.parse(JSON.stringify(fn())) }; } catch (e) { o[k] = { threw: true, msg: String(e && e.message || e) }; } };
  H.loadState('arena_flat'); H.clearInputs();
  t('tap_sugar', () => H.queueInputs([{ f: 0, tap: 'light' }]));
  H.stepFrames(3);
  t('after_tap_pressed', () => H.snapshot().input);
  H.clearInputs();
  t('hold_until_sugar', () => H.queueInputs([{ f: 0, hold: ['block'], until: 20 }]));
  H.stepFrames(3);
  t('after_hold_held', () => H.snapshot().input);
  H.clearInputs();
  t('garbage_key', () => H.queueInputs([{ f: 0, wibble: 3 }]));
  t('empty_event', () => H.queueInputs([{ f: 0 }]));
  t('no_f', () => H.queueInputs([{ press: ['light'] }]));
  H.clearInputs();
  t('raw_press', () => H.queueInputs([{ f: 0, press: ['light'] }, { f: 2, release: ['light'] }]));
  H.stepFrames(1);
  t('after_raw_press', () => H.snapshot().input);
  return o;
});

report.AR1 = await page.evaluate(async () => {
  const H = window.__HARNESS; const o = {};
  // 50 identical swings on a stationary dummy at contact range
  H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
  H.spawn('dummy_passive', 0, 1.6, { as: 'dq' });
  H.lockOn('dq');
  const sc = [];
  for (let i = 0; i < 50; i++) { sc.push({ f: i * 90, press: ['light'] }); sc.push({ f: i * 90 + 3, release: ['light'] }); }
  H.queueInputs(sc);
  H.traceStart({}); H.stepFrames(50 * 90 + 200); const recs = H.traceStop();
  const ev = {}; const hits = []; const attacks = [];
  const states = new Set(), phases = new Set(), anims = new Set();
  let hbFrames = 0;
  for (const r of recs) {
    states.add(r.player.state); phases.add(r.player.phase); anims.add(r.player.anim);
    if ((r.player.hitboxes || []).length) hbFrames++;
    for (const e of (r.events || [])) { ev[e.type] = (ev[e.type] || 0) + 1; if (e.type === 'hit') hits.push(e); if (e.type === 'attack_start') attacks.push(r.f); }
  }
  const dmg = hits.map(x => (x.dmg && typeof x.dmg === 'object') ? x.dmg.phys : (x.dmg ?? x.damage ?? null)).filter(x => x != null);
  const mean = dmg.length ? dmg.reduce((a, b) => a + b, 0) / dmg.length : null;
  const sd = dmg.length ? Math.sqrt(dmg.reduce((a, b) => a + (b - mean) ** 2, 0) / dmg.length) : null;
  o.swings = { attacks: attacks.length, hits: hits.length, event_census: ev, damage_distinct: [...new Set(dmg)], damage_stdev: sd,
    player_states: [...states], player_phases: [...phases], player_anims: [...anims], frames_with_active_hitbox: hbFrames,
    rng_draws_max: Math.max(...recs.map(r => r.rng.draws)) };
  // A5 animation cancel: input roll at recovery frames 2, 5, 10
  const cancels = [];
  for (const at of [2, 5, 10]) {
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    H.queueInputs([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }]);
    H.traceStart({}); H.stepFrames(200); let r1 = H.traceStop();
    const base = r1.map(x => ({ f: x.f, st: x.player.state, ph: x.player.phase, af: x.player.anim_frame, an: x.player.anim }));
    // find first recovery frame
    const recIdx = base.findIndex(x => x.ph === 'recovery');
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    H.queueInputs([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }, { f: (recIdx < 0 ? 40 : recIdx) + at, press: ['roll'] }, { f: (recIdx < 0 ? 40 : recIdx) + at + 3, release: ['roll'] }]);
    H.traceStart({}); H.stepFrames(200); let r2 = H.traceStop();
    const cut = r2.map(x => ({ f: x.f, st: x.player.state, ph: x.player.phase, af: x.player.anim_frame, an: x.player.anim }));
    const attackFramesBase = base.filter(x => x.an && x.an.startsWith('atk')).length;
    const attackFramesCut = cut.filter(x => x.an && x.an.startsWith('atk')).length;
    cancels.push({ roll_at_recovery_frame: at, first_recovery_index: recIdx, attack_frames_uninterrupted: attackFramesBase, attack_frames_with_roll_input: attackFramesCut, frames_skipped: attackFramesBase - attackFramesCut });
  }
  o.A5_cancel = cancels;
  // A7 homing: yaw_rate during active/recovery
  o.A7_yaw = (() => {
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    H.spawn('inf_trash', 3, 3, { as: 'yr' });
    H.queueInputs([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }, { f: 5, look: [10, 0] }]);
    H.traceStart({}); H.stepFrames(200); const r = H.traceStop();
    const rows = r.filter(x => x.player.phase === 'active' || x.player.phase === 'recovery');
    let maxd = 0; for (let i = 1; i < rows.length; i++) { let d = rows[i].player.yaw_deg - rows[i - 1].player.yaw_deg; if (d > 180) d -= 360; if (d < -180) d += 360; maxd = Math.max(maxd, Math.abs(d)); }
    return { frames_in_active_or_recovery: rows.length, max_player_yaw_change_deg_per_frame: maxd };
  })();
  // A4 enemy telegraph: does any enemy ever attack?
  o.A4_enemy_attacks = (() => {
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    const e = H.spawn('inf_trash', 0, 2, { as: 'tg' }); H.aggro(e);
    H.traceStart({}); H.stepFrames(1800); const r = H.traceStop();
    const st = {}; let hitActive = 0; const ev = {};
    for (const x of r) { for (const en of x.enemies) { st[en.state] = (st[en.state] || 0) + 1; if (en.hit_active) hitActive++; } for (const q of (x.events || [])) ev[q.type] = (ev[q.type] || 0) + 1; }
    return { enemy_state_histogram: st, frames_with_enemy_hit_active: hitActive, events: ev };
  })();
  return o;
});

report.page_errors = h.errors;
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
await h.close();
