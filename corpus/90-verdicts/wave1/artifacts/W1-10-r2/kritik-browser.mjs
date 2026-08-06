// INDEPENDENT browser probe, W1-10 round 2. Critic-authored. Boots the SHIPPING game in
// headless Chromium with NO route repair, then:
//   B1  equipped_ok over all 87 roster ids, verified by an OBSERVABLE change (the weapon the
//       player is holding must change reach/frames), not by setLoadout() returning truthy.
//   B2  CFS_live: drive the five enclosing states from real scripted input and read the anim
//       the player actually plays out of the trace.
//   B3  node-vs-browser parity: the same rows, measured both ways, must agree exactly.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '/home/user/elder-souls-claude/tools/lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const ROOT = '/home/user/elder-souls-claude';
const OUT = process.argv[2] || '/dev/stdout';
const CLASSES = ['DGR', 'SSW', 'CSW', 'TSW', 'FST', 'SPR', 'AXE', 'MCE', 'WHP', 'HLB', 'GSW', 'CGS', 'GHM', 'UGS', 'BOW'];

const ms = {};
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/combat/movesets'))) {
  if (!f.endsWith('.json')) continue;
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/combat/movesets', f), 'utf8'));
  if (m.weapon_id) ms[m.weapon_id] = m;
}
const ids = Object.keys(ms).sort();

const { chromium } = await loadPlaywright();
const server = await serveDir(ROOT);
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 120000 });
let booted = true;
try { await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 90000 }); }
catch { booted = false; }
const out = { generated: new Date().toISOString(), instrument: 'kritik-browser.mjs (critic-authored)', booted_at_head_without_repair: booted, page_errors: pageErrors.slice(0, 5) };
if (!booted) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('GAME DID NOT BOOT'); await browser.close(); await server.close(); process.exit(1); }
await page.evaluate(() => window.__HARNESS.ready());
out.build = await page.evaluate(() => window.__HARNESS.getBuildInfo());

// ---- B1 equipped_ok, with an OBSERVABLE consequence -----------------------------------------
const eq = [];
for (const id of ids) {
  const r = await page.evaluate(async (w) => {
    const H = window.__HARNESS;
    try {
      const ok = await H.setLoadout({ weapon: w });
      const st = H.getPlayerStats();
      return { ok: !!ok, equipped: st && st.equipped ? { weapon: st.equipped.weapon, reach: st.equipped.reach_m, cls: st.equipped.class } : null };
    } catch (e) { return { err: String((e && e.message) || e) }; }
  }, id);
  eq.push({ weapon_id: id, class: ms[id].class, declared_reach: ms[id].reach_m, ...r });
}
const okRows = eq.filter((x) => x.ok);
const idMatch = okRows.filter((x) => x.equipped && x.equipped.weapon === x.weapon_id);
const reachMatch = okRows.filter((x) => x.equipped && Math.abs((x.equipped.reach ?? -1) - x.declared_reach) < 1e-6);
out.B1 = {
  attempted: eq.length, setLoadout_ok: okRows.length,
  live_id_matches_requested: idMatch.length,
  live_reach_matches_declared: reachMatch.length,
  distinct_live_reach_values: [...new Set(okRows.map((x) => x.equipped && x.equipped.reach))].length,
  rejected: eq.filter((x) => x.err).length,
  distinct_errors: [...new Set(eq.filter((x) => x.err).map((x) => x.err))].slice(0, 3),
  classes_with_zero_equippable: CLASSES.filter((c) => !eq.some((x) => x.class === c && x.ok)),
  rows: eq,
};

// ---- B2 CFS_live from real input, in the browser ---------------------------------------------
const STATES = {
  ROLL: { pre: [{ f: 1, move: [0, 1] }, { f: 2, press: ['roll'] }, { f: 3, release: ['roll'] }], k: 30 },
  BACKSTEP: { pre: [{ f: 2, press: ['roll'] }, { f: 3, release: ['roll'] }], k: 16 },
  SPRINT: { pre: [{ f: 1, move: [0, 1] }, { f: 1, press: ['sprint'] }], k: 30 },
  AIRBORNE: { pre: [{ f: 2, press: ['jump'] }, { f: 3, release: ['jump'] }], k: 14 },
  BLOCK: { pre: [{ f: 1, press: ['block'] }], k: 6 },
};
const PROBE_W = ['dagger', 'straight-sword', 'axe', 'ultra-greatsword'];
const b2 = [];
for (const w of PROBE_W) {
  // baseline standing r1.1
  const base = await page.evaluate(async (wid) => {
    const H = window.__HARNESS;
    await H.loadState('wpn-dummy-arena');
    await H.setLoadout({ weapon: wid });
    H.traceStart({ fields: ['anim', 'state'] });
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    await H.stepFrames(120);
    const ev = H.traceDrain();
    H.traceStop();
    const rows = (ev.events || ev.log || ev || []);
    const st = (Array.isArray(rows) ? rows : []).filter((e) => e.kind === 'ACTION_START' && e.tag === 'attack');
    return st[0] ? { slot: st[0].anim_slot, anim: st[0].anim, f: [st[0].startup, st[0].active, st[0].recovery] } : null;
  }, w);
  for (const [name, cfg] of Object.entries(STATES)) {
    const r = await page.evaluate(async ({ wid, pre, k }) => {
      const H = window.__HARNESS;
      await H.loadState('wpn-dummy-arena');
      await H.setLoadout({ weapon: wid });
      H.traceStart({ fields: ['anim', 'state'] });
      const script = pre.slice();
      const pf = pre[pre.length - 1].f + k;
      script.push({ f: pf, press: ['light'] }, { f: pf + 2, release: ['light'] });
      H.queueInputs(script);
      await H.stepFrames(240);
      const ev = H.traceDrain();
      H.traceStop();
      const rows = (ev.events || ev.log || ev || []);
      const st = (Array.isArray(rows) ? rows : []).filter((e) => e.kind === 'ACTION_START' && e.tag === 'attack');
      const dr = (Array.isArray(rows) ? rows : []).filter((e) => e.kind === 'INPUT_DROPPED');
      return st[0]
        ? { slot: st[0].anim_slot, anim: st[0].anim, f: [st[0].startup, st[0].active, st[0].recovery], from: st[0].from_state, at: st[0].from_state_frame }
        : { slot: null, drop: dr[0] ? dr[0].reason : 'nothing-fired' };
    }, { wid: w, pre: cfg.pre, k: cfg.k });
    b2.push({ weapon: w, state: name, baseline: base, ...r });
  }
}
const ctxRows = b2.filter((r) => r.slot && (!r.baseline || (r.anim !== r.baseline.anim && JSON.stringify(r.f) !== JSON.stringify(r.baseline.f))));
out.B2 = { total: b2.length, contextual: ctxRows.length, CFS_live_browser: ctxRows.length / b2.length, rows: b2 };

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('booted at HEAD without repair:', booted);
console.log('build:', JSON.stringify(out.build));
console.log(`B1 setLoadout_ok ${out.B1.setLoadout_ok}/${out.B1.attempted}  live_id_match ${out.B1.live_id_matches_requested}  live_reach_match ${out.B1.live_reach_matches_declared}  distinct_reach ${out.B1.distinct_live_reach_values}  zero_classes ${JSON.stringify(out.B1.classes_with_zero_equippable)}`);
if (out.B1.distinct_errors.length) console.log('  errors:', out.B1.distinct_errors);
console.log(`B2 CFS_live(browser) ${out.B2.CFS_live_browser.toFixed(4)}  ${out.B2.contextual}/${out.B2.total}`);
for (const r of b2) console.log(`   ${r.weapon.padEnd(18)} ${r.state.padEnd(9)} ${(r.slot || 'NONE:' + r.drop).padEnd(16)} ${(r.anim || '').padEnd(30)} ${r.f ? r.f.join('/') : ''}`);
await browser.close(); await server.close();
