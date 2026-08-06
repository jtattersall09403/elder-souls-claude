// CRITIC-OWNED probe. Independent of tools/harness/api-probe.mjs (builder-authored).
// RI-MTH01 M1-M7 + the lying test (-2) applied to every one of the 33 methods.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;

const R = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const o = {};
  const T = async (name, fn) => { try { o[name] = { ok: true, v: await fn() }; } catch (e) { o[name] = { ok: false, threw: String(e && e.message || e) }; } };
  const J = (x) => JSON.parse(JSON.stringify(x));

  await H.ready();
  await T('setMode', () => H.setMode('harness'));

  // ---------- M3 step exactness ----------
  await T('m3', async () => {
    H.loadState('arena_flat');
    const f0 = H.getFrame();
    const r = H.stepFrames(137);
    const f1 = H.getFrame();
    const s = H.snapshot();
    return { f0, f1, delta: f1 - f0, ret: J(r), t_ms: s.t_ms, expect_t: f1 * (1000 / 60), err: Math.abs(s.t_ms - f1 * (1000 / 60)) };
  });

  // ---------- M4 loop suspension (wall-clock wait done outside) ----------
  await T('m4_before', () => H.getFrame());

  return o;
});

// M4: wait 1500ms of real wall clock, no calls
await new Promise(r => setTimeout(r, 1500));
const m4after = await page.evaluate(() => window.__HARNESS.getFrame());

const R2 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  const o = {};
  const T = async (name, fn) => { try { o[name] = { ok: true, v: await fn() }; } catch (e) { o[name] = { ok: false, threw: String(e && e.message || e) }; } };
  const J = (x) => JSON.parse(JSON.stringify(x));

  // ---------- M5 input relativity ----------
  await T('m5', async () => {
    H.loadState('arena_flat'); H.clearInputs();
    H.stepFrames(30);
    const n = H.queueInputs([{ f: 0, press: ['light'] }]);
    H.stepFrames(1);
    const s = H.snapshot();
    return { queued: n, pressed: s.input.pressed, held: s.input.held };
  });

  // ---------- M6 argument rejection ----------
  const rej = {};
  const tryThrow = async (k, fn) => { try { const v = await fn(); rej[k] = { threw: false, returned: J(v) }; } catch (e) { rej[k] = { threw: true, msg: String(e && e.message || e) }; } };
  await tryThrow('queueInputs_banana', () => H.queueInputs([{ f: 0, press: ['banana'] }]));
  await tryThrow('stepFrames_neg1', () => { const a = H.getFrame(); const r = H.stepFrames(-1); return { before: a, ret: r, after: H.getFrame() }; });
  await tryThrow('stepFrames_nan', () => H.stepFrames('seven'));
  await tryThrow('spawn_nope', () => H.spawn('nope', 0, 0));
  await tryThrow('spawn_inf_trash', () => H.spawn('inf_trash', 0, 7, { as: 'ecrit' }));
  await tryThrow('spawn_dummy_passive', () => H.spawn('dummy_passive', 2, 7, { as: 'edum' }));
  await tryThrow('loadState_nope', () => H.loadState('no_such_state_xyz'));
  await tryThrow('teleport_nan', () => H.teleport('a', 'b'));
  await tryThrow('setWeather_nope', () => H.setWeather('not_a_weather'));
  await tryThrow('setTimeOfDay_99', () => H.setTimeOfDay(99));
  await tryThrow('lockOn_nope', () => H.lockOn('e_does_not_exist'));
  await tryThrow('despawn_nope', () => H.despawn('e_does_not_exist'));
  await tryThrow('setSeed_nan', () => H.setSeed('abc'));
  await tryThrow('camera_bad', () => H.camera({ pos: [1, 2] }));
  await tryThrow('setMode_bad', () => H.setMode('turbo'));
  o.m6 = rej;

  // ---------- aggro on a live entity ----------
  await T('aggro_probe', async () => {
    H.loadState('arena_flat');
    const before = J(H.listEntities());
    let spawned = null, spawnErr = null;
    try { spawned = H.spawn('dummy_passive', 0, 5, { as: 'ez' }); } catch (e) { spawnErr = String(e.message || e); }
    let aggroRes = null, aggroErr = null;
    try { aggroRes = H.aggro('e0'); } catch (e) { aggroErr = String(e.message || e); }
    H.stepFrames(10);
    const s = H.snapshot();
    return { before, spawned, spawnErr, aggroRes, aggroErr, enemies: J(s.enemies || []) };
  });

  // ---------- teleport truth ----------
  await T('teleport', async () => {
    H.loadState('arena_flat');
    H.teleport(12.5, -7.25);
    const s0 = J(H.snapshot().player.pos);
    H.stepFrames(1);
    const s1 = J(H.snapshot().player.pos);
    return { after_call: s0, after_step: s1 };
  });

  // ---------- getWorldStats / getQuestState across two states (M lie test) ----------
  await T('cross_state', async () => {
    const res = {};
    for (const st of ['arena_flat', 'settlement_primary_street', 'sv5-journal-bloodstain', 'endgame-200q', 'dungeon_primary']) {
      try {
        H.loadState(st);
        res[st] = { world: J(H.getWorldStats()), quest: J(H.getQuestState()) };
      } catch (e) { res[st] = { err: String(e.message || e) }; }
    }
    return res;
  });

  // ---------- setSeed / getSeed ----------
  await T('seed', async () => {
    const a = H.setSeed(1337), b = H.getSeed();
    const c = H.setSeed(4242), d = H.getSeed();
    return { a, b, c, d };
  });

  // ---------- reset ----------
  await T('reset', () => J(H.reset({ seed: 9 })));

  // ---------- listAnchors ----------
  await T('anchors', () => J(H.listAnchors()));

  // ---------- getPlayerStats ----------
  await T('playerStats', () => J(H.getPlayerStats()));

  // ---------- extra methods beyond the 33 ----------
  await T('extra_methods', () => Object.keys(H).sort());

  return o;
});

// ---------- M7 camera exactness (needs two screenshots) ----------
await page.evaluate(() => { const H = window.__HARNESS; H.loadState('vista_primary'); H.setTimeOfDay(12); H.setWeather('clear'); H.setUIVisible(false); });
const camRead1 = await page.evaluate(() => { const H = window.__HARNESS; const r = H.camera({ pos: [10, 2, 10], look: [0, 1, 0], fov: 55 }); H.renderFrame(); return { ret: JSON.parse(JSON.stringify(r)), snap: JSON.parse(JSON.stringify(H.snapshot().camera)) }; });
const shot1 = await page.screenshot();
const camRead2 = await page.evaluate(() => { const H = window.__HARNESS; H.camera({ pos: [40, 8, -30], look: [0, 0, 0], fov: 70 }); H.renderFrame(); H.stepFrames(24); const r = H.camera({ pos: [10, 2, 10], look: [0, 1, 0], fov: 55 }); H.renderFrame(); return { ret: JSON.parse(JSON.stringify(r)), snap: JSON.parse(JSON.stringify(H.snapshot().camera)) }; });
const shot2 = await page.screenshot();
const crypto = await import('node:crypto');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const report = {
  schema: 'critic/w1-00-probe1@1',
  at: new Date().toISOString(),
  url: handle.url,
  buildInfo: handle.buildInfo,
  pass1: R,
  m4: { before: R.m4_before?.v, after_1500ms_wallclock: m4after, advanced: m4after - R.m4_before?.v },
  pass2: R2,
  m7: { call1: camRead1, call2: camRead2, sha1: sha(shot1), sha2: sha(shot2), identical: sha(shot1) === sha(shot2) },
  page_errors: handle.errors,
  console_errors: handle.console.filter(c => c.type === 'error'),
};
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
await handle.close();
