#!/usr/bin/env node
/**
 * spawn-truth-thorn.mjs — settles where the game actually starts, on the DEPLOYED build.
 *
 * Boots https://jtattersall09403.github.io/elder-souls-claude/game/index.html (the real play
 * URL from the README, not a local file), goes through the title screen and the "New" ->
 * character-creation flow the way a player does (censusBegin via titleActivate('new'),
 * censusEnter/censusAnswer through the questionnaire, then walking to the writ house's back
 * door and pressing interact), and photographs every stage plus the first 30 seconds of
 * walking after the player is handed control. Desktop and phone viewports.
 *
 * Every input goes through the real input pipeline (queueInputs -> ACTIONS, censusAnswer ->
 * the same census graph `interact` drives) — nothing here poses a camera except where a shot
 * is explicitly labelled `orbit`.
 *
 * USAGE
 *   node tools/harness/spawn-truth-thorn.mjs [--out <dir>] [--url <url>]
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

// The deployed game is on the public internet; this container's outbound HTTPS only reaches it
// through the pre-configured agent proxy (see /root/.ccr/README.md). `launchGame()` in
// `../lib/browser.mjs` never sets a browser-level proxy because every other caller in this repo
// serves `game/` locally, so this tool launches Chromium itself with the proxy wired in rather
// than editing that shared file.
async function launchDeployed({ url, width, height, timeout = 90000 }) {
  const { chromium } = await loadPlaywright();
  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy || null;
  const browser = await chromium.launch({
    headless: true,
    args: DETERMINISTIC_CHROMIUM_ARGS,
    proxy: proxyServer ? { server: proxyServer } : undefined,
  });
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light',
    reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC', ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push({ kind: 'pageerror', message: String(e && e.message || e) }));
  page.on('requestfailed', (r) => errors.push({ kind: 'requestfailed', url: r.url(), failure: r.failure()?.errorText }));
  await page.goto(url, { waitUntil: 'load', timeout });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout });
  const handle = {
    page, browser, errors,
    async close() { try { await context.close(); } catch {} try { await browser.close(); } catch {} },
    async h(method, ...callArgs) {
      const res = await page.evaluate(async ({ m, a }) => {
        const H = window.__HARNESS;
        try { return { __ok: await H[m](...a) }; } catch (e) { return { __err: String(e && e.message || e) }; }
      }, { m: method, a: callArgs });
      if (res && res.__err) throw new Error(`${method}(): ${res.__err}`);
      return res ? res.__ok : undefined;
    },
    async hOpt(method, ...callArgs) {
      const present = await page.evaluate((m) => !!(window.__HARNESS && typeof window.__HARNESS[m] === 'function'), method);
      if (!present) return undefined;
      return handle.h(method, ...callArgs);
    },
  };
  await handle.h('ready');
  return handle;
}

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(args.out || 'reports/spawn-truth/shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = String(args.url || 'https://jtattersall09403.github.io/elder-souls-claude/game/index.html');

const log = [];
const note = (o) => { log.push(o); console.log(JSON.stringify(o)); };

async function runViewport(tag, width, height) {
  const g = await launchDeployed({ url: URL, width, height, timeout: 90000 });
  let shotN = 0;
  const shot = async (label) => {
    const d = await g.h('screenshot');
    const f = `${tag}-${String(shotN++).padStart(2, '0')}-${label}.png`;
    fs.writeFileSync(path.join(OUT, f), Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64'));
    return f;
  };
  const telemetry = async (label) => {
    const t = await g.page.evaluate(() => {
      const E = window.__ENGINE, s = E.sim;
      return {
        interior: s.env.interior, settlement: s.env.settlement, region: s.env.region,
        pos: s.player.pos.map((n) => +n.toFixed(2)), yaw: +s.player.yaw.toFixed(1),
        camYaw: s.camera ? +s.camera.yaw.toFixed(1) : null, camPitch: s.camera ? +s.camera.pitch.toFixed(1) : null,
      };
    });
    note({ label, ...t });
    return t;
  };

  try {
    const buildInfo = await g.hOpt('getBuildInfo');
    note({ tag, url: URL, buildInfo });

    // 1. Title screen, exactly as boot leaves it.
    await g.h('titleShow');
    await g.page.waitForTimeout(150);
    await shot('title');

    // 2. Click New. Engine._titleApply('new') -> censusBegin({}) -> barge-hold.
    await g.h('titleActivate', 'new');
    await g.page.waitForTimeout(50);
    await shot('barge-hold');
    await telemetry('barge-hold');

    // 3. Drive the whole census graph the way `interact` does: enter paused nodes, answer
    // every prompt (questionnaire answers cycled, free text filled, picks take the first N).
    let qi = 0;
    for (let guard = 0; guard < 250; guard++) {
      const st = await g.h('getCensusState');
      if (st.done) break;
      if (st.paused) { await g.h('censusEnter', st.resume_by); continue; }
      const inp = st.input;
      if (!inp) { await g.h('censusAnswer', null); continue; }
      let v;
      if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
      else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
      else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
      else if (st.node === 'writ.class-routes') v = 'questionnaire';
      else v = (inp.options && inp.options[0]) ? inp.options[0].id : null;
      await g.h('censusAnswer', v);
    }
    await shot('writ-house-done');
    await telemetry('writ-house-done');

    // 4. Walk out through the real door: to the interior's own `interior_spawn` anchor (the
    // reach gate `sim/settlement.js` checks), then press interact.
    const doorInfo = await g.page.evaluate(async () => {
      const E = window.__ENGINE, H = window.__HARNESS;
      const interior = E.sim.env.interior;
      const rec = interior ? E.sim.settlements.interior(interior) : null;
      const face = rec && rec.continuity ? rec.continuity.interior_spawn : null;
      for (let a = 0; a < 40 && face; a++) {
        const p = E.sim.player.pos;
        const d = Math.hypot(face[0] - p[0], face[2] - p[2]);
        if (d <= 1.2) break;
        const yaw = (H.getPlayerStats().yaw || 0) * Math.PI / 180;
        const dx = face[0] - p[0], dz = face[2] - p[2];
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
        const n = Math.max(1e-6, Math.hypot(fwd, str));
        const step = [];
        for (let i = 0; i < 20; i++) step.push({ f: i, move: [str / n, fwd / n] });
        H.queueInputs(step); H.stepFrames(20);
      }
      const atDoor = E.sim.player.pos.slice();
      const yawAtDoor = E.sim.player.yaw;
      H.queueInputs([{ f: 0, press: ['interact'] }, { f: 1, release: ['interact'] }]);
      H.stepFrames(3);
      return {
        interior, exteriorSpawn: rec && rec.continuity ? rec.continuity.exterior_spawn : null,
        atDoor: atDoor.map((n) => +n.toFixed(2)), yawAtDoor: +yawAtDoor.toFixed(1),
        nowInterior: E.sim.env.interior, posAfter: E.sim.player.pos.map((n) => +n.toFixed(2)), yawAfter: +E.sim.player.yaw.toFixed(1),
      };
    });
    note({ label: 'door-transit', ...doorInfo });

    await shot('spawn-moment');
    const spawnTel = await telemetry('spawn-moment');

    // 5. The first 30 real seconds (1800 frames @ 60Hz) of walking forward from that spawn,
    // photographed every 5 seconds — directive §2: sequences, not a single still.
    for (let sec = 5; sec <= 30; sec += 5) {
      await g.h('queueInputs', Array.from({ length: 300 }, (_, i) => ({ f: i, move: [0, 1] })));
      await g.h('stepFrames', 300);
      await shot(`walk-${String(sec).padStart(2, '0')}s`);
    }
    await telemetry('walk-30s-end');

    return { tag, buildInfo, spawnTel, doorInfo };
  } finally {
    await g.close();
  }
}

const desktop = await runViewport('desktop', 1280, 720);
const phone = await runViewport('phone', 390, 844);

fs.writeFileSync(path.join(OUT, '..', 'spawn-truth-telemetry.json'), JSON.stringify({
  schema: 'elder-souls/spawn-truth@1', at: new Date().toISOString(), url: URL,
  desktop, phone, log,
}, null, 2));
console.log('wrote', path.join(OUT, '..', 'spawn-truth-telemetry.json'));
