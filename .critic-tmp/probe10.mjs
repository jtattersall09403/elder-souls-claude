// CRITIC-OWNED probe 10: RI-PLT03 (TTFP / load surfaces / boundaries), AR-1/AR-2/AR-3 probes,
// RI-CMB07 M0 format conformance, and the RI-CAM06 blind-pack residual series.
import { launchGame, DETERMINISTIC_CHROMIUM_ARGS } from '../tools/lib/browser.mjs';
import { serveDir } from '../tools/lib/serve.mjs';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
const report = { schema: 'critic/w1-00-load-ar@1', at: new Date().toISOString() };

// ---------- RI-PLT03: cold load, surfaces, TTFP_model ----------
{
  const { chromium } = await import('playwright');
  const server = await serveDir(path.resolve('.'));
  const url = server.origin + '/game/index.html';
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const net = [];
  page.on('response', (r) => net.push({ url: r.url().replace(server.origin, ''), status: r.status() }));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCache');
  await cdp.send('Network.clearBrowserCookies');

  const shots = [];
  const t0 = Date.now();
  const nav = page.goto(url, { waitUntil: 'commit' });
  const shooter = (async () => {
    for (let i = 0; i < 24; i++) {
      try { const b = await page.screenshot({ timeout: 4000 }); shots.push({ t_ms: Date.now() - t0, bytes: b.length, uniq: null, buf: b }); } catch { }
      await new Promise(r => setTimeout(r, 250));
      if (shots.length && shots[shots.length - 1].t_ms > 6000) break;
    }
  })();
  await nav;
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  const tHarness = Date.now() - t0;
  await page.evaluate(() => window.__HARNESS.ready());
  const tReady = Date.now() - t0;
  await shooter;
  const timing = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    const H = window.__HARNESS;
    return {
      navigation: { domContentLoaded: n.domContentLoadedEventEnd, loadEvent: n.loadEventEnd, responseEnd: n.responseEnd },
      loadState: H.getLoadState ? JSON.parse(JSON.stringify(H.getLoadState())) : null,
      resources: performance.getEntriesByType('resource').map(r => ({ n: r.name.split('/').slice(-1)[0], start: Math.round(r.startTime), dur: Math.round(r.duration), size: r.transferSize })).sort((a, b) => b.dur - a.dur).slice(0, 15),
      longTasks: (window.__CRIT_LT || []),
    };
  });
  // count distinct load surfaces: screenshots whose top-left 200x200 region is a flat colour
  const { PNG } = await import('pngjs');
  const surfaces = [];
  for (const s of shots) {
    try {
      const png = PNG.sync.read(s.buf);
      const colours = new Set();
      for (let y = 0; y < png.height; y += 17) for (let x = 0; x < png.width; x += 17) {
        const i = (png.width * y + x) << 2;
        colours.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
      }
      surfaces.push({ t_ms: s.t_ms, unique_colours: colours.size, flat: colours.size <= 3 });
    } catch { surfaces.push({ t_ms: s.t_ms, unique_colours: null, flat: null }); }
  }
  // save the first and the last screenshot as artifacts
  if (shots.length) {
    fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-00/load-t0.png', shots[0].buf);
    fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-00/load-tlast.png', shots[shots.length - 1].buf);
  }
  report.PLT03 = {
    method: 'cold profile: Network.clearBrowserCache + fresh context; screenshot every 250 ms from navigationStart',
    t_harness_present_ms: tHarness, t_ready_resolved_ms: tReady,
    note: 'These are SwiftShader wall-clock numbers and are Tier-H under RI-PLT01 T1 — reported for the surface census only, NOT as TTFP.',
    timing, surface_census: surfaces,
    distinct_flat_surfaces: surfaces.filter(s => s.flat).length,
    responses: net.length, response_list: net.slice(0, 60),
  };
  await ctx.close(); await browser.close(); await server.close();
}

// ---------- AR probes + CMB07 M0 + CAM06 blind residual ----------
{
  const h = await launchGame({});
  const page = h.page;

  report.AR = await page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness');
    const o = {};
    // A1/A2: 50 identical swings at a stationary dummy
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    const eid = H.spawn('dummy_passive', 0, 2.0, { as: 'dq' });
    const script = []; for (let i = 0; i < 50; i++) script.push({ f: i * 80, tap: 'light' });
    H.queueInputs(script);
    H.traceStart({});
    H.stepFrames(50 * 80 + 120);
    const recs = H.traceStop();
    const hits = [], attacks = [], rngDraws = new Set();
    for (const r of recs) {
      for (const e of (r.events || [])) {
        if (e.type === 'hit') hits.push({ f: r.f, dmg: e.dmg ?? e.damage ?? null, ev: e });
        if (e.type === 'attack_start') attacks.push(r.f);
      }
      rngDraws.add(r.rng.draws);
    }
    const dmgs = hits.map(x => (typeof x.dmg === 'object' && x.dmg) ? (x.dmg.phys ?? null) : x.dmg).filter(x => x !== null);
    const mean = dmgs.length ? dmgs.reduce((a, b) => a + b, 0) / dmgs.length : null;
    const sd = dmgs.length ? Math.sqrt(dmgs.reduce((a, b) => a + (b - mean) ** 2, 0) / dmgs.length) : null;
    o.A1_A2 = { attacks: attacks.length, hits: hits.length, damage_values: [...new Set(dmgs)].slice(0, 10), damage_stdev: sd, rng_draws_distinct: [...rngDraws] };
    // A3: does the world advance while a menu is open?
    H.loadState('arena_flat'); H.clearInputs();
    H.queueInputs([{ f: 0, tap: 'menu' }]);
    const f0 = H.getFrame(); H.stepFrames(120); const f1 = H.getFrame();
    o.A3_menu = { frames_advanced_with_menu_input: f1 - f0 };
    // A6: level scaling — is there any player level in the state that changes enemy stats?
    H.loadState('arena_flat'); const e1 = H.spawn('inf_trash', 0, 6, { as: 'lv1' }); H.stepFrames(1);
    const s1 = JSON.parse(JSON.stringify(H.snapshot().enemies.find(e => e.eid === 'lv1')));
    H.loadState('endgame-200q'); const ps = JSON.parse(JSON.stringify(H.getPlayerStats()));
    const e2 = H.spawn('inf_trash', 0, 6, { as: 'lv40' }); H.stepFrames(1);
    const s2 = JSON.parse(JSON.stringify(H.snapshot().enemies.find(e => e.eid === 'lv40')));
    o.A6_levelscale = { player_level_endgame: ps.level ?? null, low: { hp: s1.hp_max, poise: s1.poise_max }, high: { hp: s2.hp_max, poise: s2.poise_max }, identical: s1.hp_max === s2.hp_max && s1.poise_max === s2.poise_max };
    // B1: HUD — is there any UI at all?
    o.B1_ui = { setUIVisible_true: H.setUIVisible(true), setUIVisible_false: H.setUIVisible(false) };
    // B5: souls as currency? read the player stat block
    o.B5_currency = { playerStats: JSON.parse(JSON.stringify(H.getPlayerStats())) };
    // B12/A10: parley / non-lethal exit surface
    o.B12 = { has_parley_action: H.getActionSet ? JSON.parse(JSON.stringify(H.getActionSet())) : null };
    // AR-3 seam sterility: does anything cross?
    o.AR3 = { quest_state_keys: Object.keys(H.getQuestState()), world_keys: Object.keys(H.getWorldStats()) };
    return o;
  });

  // CMB07 M0 format conformance over my own long trace
  report.CMB07_M0 = await page.evaluate(async () => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.teleport(0, 0);
    H.spawn('inf_trash', 0, 3.0, { as: 'c7' });
    const sc = []; for (let i = 0; i < 40; i++) { sc.push({ f: i * 90, tap: 'light' }); sc.push({ f: i * 90 + 45, tap: 'roll', hold: 3 }); }
    H.queueInputs(sc);
    H.traceStart({}); H.stepFrames(3600); const recs = H.traceStop();
    const P = new Set(), E = new Set(), EV = new Set(), PH = new Set(), AL = new Set();
    let gaps = 0, animResetNoStateChange = 0, animBadIncrement = 0, prev = null;
    for (const r of recs) {
      P.add(r.player.state); PH.add(r.player.phase);
      for (const e of r.enemies) { E.add(e.state); AL.add(e.alert_state); }
      for (const ev of (r.events || [])) EV.add(ev.type);
      if (prev) {
        if (r.f !== prev.f + 1) gaps++;
        const a = prev.player, b = r.player;
        if (b.anim === a.anim) {
          if (b.anim_frame === 0 && a.anim_frame !== 0 && a.anim_frame + 1 < a.anim_len) animResetNoStateChange++;
          else if (b.anim_frame !== a.anim_frame + 1 && !(a.anim_frame + 1 >= a.anim_len && b.anim_frame === 0)) animBadIncrement++;
        }
      }
      prev = r;
    }
    return { frames: recs.length, player_states: [...P], player_phases: [...PH], enemy_states: [...E], alert_states: [...AL],
      event_types: [...EV], frame_gaps: gaps, anim_resets_without_state_change: animResetNoStateChange, anim_bad_increments: animBadIncrement };
  });

  // CAM06 blind-pack residual series — ours
  report.CAM06_blind_ours = await page.evaluate(async () => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('swamp_canopy'); H.clearInputs(); H.setRenderRate(0); H.teleport(0, 0);
    H.queueInputs([{ f: 0, move: [0, 1] }]);
    H.traceStart({}); H.stepFrames(900); const r = H.traceStop();
    return { y: r.map(x => x.camera.pos[1]), roll: r.map(x => x.camera.roll_deg), anim: r.map(x => x.player.anim), speed: r.map(x => x.player.speed_mps) };
  });

  report.page_errors2 = h.errors;
  await h.close();
}

fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
