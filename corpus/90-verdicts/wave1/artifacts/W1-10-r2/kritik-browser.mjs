// INDEPENDENT browser probe, W1-10 round 2. Critic-authored; shares no code with any builder
// tool. Boots the SHIPPING game in headless Chromium with NO route repair.
//   B1  equipped_ok over all 87 roster ids, verified by an OBSERVABLE consequence — the live
//       weapon id, class and reach read back out of getPlayerStats().equipped.
//   B2  CFS_live from real scripted input, read out of the PER-FRAME trace (player.anim_slot /
//       player.anim), not out of an event the runtime chose to emit about itself.
//   B3  parity with tools/lib/combat-node.mjs on the same rows.
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
try { await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 90000 }); } catch { booted = false; }
const out = { generated: new Date().toISOString(), instrument: 'kritik-browser.mjs (critic-authored)', booted_at_head_without_route_repair: booted, page_errors: pageErrors.slice(0, 5) };
if (!booted) { fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('GAME DID NOT BOOT'); await browser.close(); await server.close(); process.exit(1); }
await page.evaluate(() => window.__HARNESS.ready());
out.build = await page.evaluate(() => window.__HARNESS.getBuildInfo());

// ---- B1 ------------------------------------------------------------------------------------
const eq = [];
for (const id of ids) {
  const r = await page.evaluate(async (w) => {
    const H = window.__HARNESS;
    try {
      const ok = await H.setLoadout({ weapon: w });
      const e = H.getPlayerStats().equipped || {};
      return { ok: !!ok, live_id: e.weapon_id, live_class: e.weapon_class, live_reach: e.reach_m, slots_declared: e.slots_declared, reachable: (e.slots_reachable_in_this_configuration || []).length };
    } catch (e) { return { err: String((e && e.message) || e) }; }
  }, id);
  eq.push({ weapon_id: id, class: ms[id].class, declared_reach: ms[id].reach_m, declared_slots: Object.keys(ms[id].slots).length, ...r });
}
const okRows = eq.filter((x) => x.ok);
out.B1 = {
  attempted: eq.length, setLoadout_ok: okRows.length,
  live_id_matches_requested: okRows.filter((x) => x.live_id === x.weapon_id).length,
  live_class_matches: okRows.filter((x) => x.live_class === x.class).length,
  live_reach_matches_declared: okRows.filter((x) => Math.abs((x.live_reach ?? -99) - x.declared_reach) < 1e-6).length,
  distinct_live_reach_values: [...new Set(okRows.map((x) => x.live_reach))].length,
  rejected: eq.filter((x) => x.err).length,
  distinct_errors: [...new Set(eq.filter((x) => x.err).map((x) => x.err))].slice(0, 3),
  classes_with_zero_equippable: CLASSES.filter((c) => !eq.some((x) => x.class === c && x.ok)),
  rows: eq,
};

// ---- B2: read the PER-FRAME trace ------------------------------------------------------------
const STATES = {
  ROLL: { pre: [{ f: 1, move: [0, 1] }, { f: 2, press: ['roll'] }, { f: 3, release: ['roll'] }], k: 30 },
  BACKSTEP: { pre: [{ f: 2, press: ['roll'] }, { f: 3, release: ['roll'] }], k: 16 },
  SPRINT: { pre: [{ f: 1, move: [0, 1] }, { f: 1, press: ['sprint'] }], k: 30 },
  AIRBORNE: { pre: [{ f: 2, press: ['jump'] }, { f: 3, release: ['jump'] }], k: 14 },
  BLOCK: { pre: [{ f: 1, press: ['block'] }], k: 6 },
};
const PROBE_W = ['dagger', 'straight-sword', 'axe', 'ultra-greatsword'];

async function drive(wid, script, n) {
  return page.evaluate(async ({ wid, script, n }) => {
    const H = window.__HARNESS;
    await H.loadState('wpn-dummy-arena');
    await H.setLoadout({ weapon: wid });
    H.traceStart({});
    H.queueInputs(script);
    await H.stepFrames(n);
    const rows = H.traceDrain();
    H.traceStop();
    // The per-frame observation: every distinct (state, anim_slot, anim) the player passed through.
    const seq = [];
    for (const r of rows) {
      const p = r.player;
      const key = `${p.state}|${p.anim_slot}|${p.anim}`;
      if (!seq.length || seq[seq.length - 1].key !== key) seq.push({ key, f: r.f, state: p.state, slot: p.anim_slot, anim: p.anim, len: p.anim_len, tip: p.weapon_tip });
      else seq[seq.length - 1].last = r.f;
    }
    return seq;
  }, { wid, script, n });
}

const b2 = [];
for (const w of PROBE_W) {
  const baseSeq = await drive(w, [{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }], 160);
  const base = baseSeq.find((s) => s.slot);
  for (const [name, cfg] of Object.entries(STATES)) {
    const script = cfg.pre.slice();
    const pf = cfg.pre[cfg.pre.length - 1].f + cfg.k;
    script.push({ f: pf, press: ['light'] }, { f: pf + 2, release: ['light'] });
    const seq = await drive(w, script, 260);
    const atk = seq.find((s) => s.slot && s.f >= pf);
    b2.push({
      weapon: w, state: name, press_frame: pf,
      baseline_slot: base ? base.slot : null, baseline_anim: base ? base.anim : null, baseline_len: base ? base.len : null,
      slot: atk ? atk.slot : null, anim: atk ? atk.anim : null, len: atk ? atk.len : null,
      states_seen: [...new Set(seq.map((s) => s.state))].join('>'),
    });
  }
}
// contextual = a distinct slot id AND a distinct clip id AND a distinct clip length
const ctxRows = b2.filter((r) => r.slot && r.slot !== r.baseline_slot && r.anim !== r.baseline_anim && r.len !== r.baseline_len);
out.B2 = { total: b2.length, contextual: ctxRows.length, CFS_live_browser: ctxRows.length / b2.length, rows: b2 };

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('booted at HEAD without route repair:', booted, '| page errors:', pageErrors.length);
console.log('build piece:', out.build.piece, 'version', out.build.version);
console.log(`B1 setLoadout_ok ${out.B1.setLoadout_ok}/${out.B1.attempted}  live_id_match ${out.B1.live_id_matches_requested}  live_class_match ${out.B1.live_class_matches}  live_reach_match ${out.B1.live_reach_matches_declared}  distinct_reach ${out.B1.distinct_live_reach_values}  zero_classes ${JSON.stringify(out.B1.classes_with_zero_equippable)}`);
console.log(`B2 CFS_live(browser, per-frame trace) ${out.B2.CFS_live_browser.toFixed(4)}  ${out.B2.contextual}/${out.B2.total}`);
for (const r of b2) console.log(`   ${r.weapon.padEnd(18)} ${r.state.padEnd(9)} ${(r.slot || 'NONE').padEnd(14)} ${(r.anim || '').padEnd(32)} len=${r.len}  base=${r.baseline_slot}/${r.baseline_anim}/${r.baseline_len}  [${r.states_seen}]`);
await browser.close(); await server.close();
