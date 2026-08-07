// The blind packs, GENERATED IN THE RUNNING BROWSER BUILD, motion only.
//
// `BAR-CRITIQUE-W1-10-R1` §H1/§R6 makes a pack that could have been built from JSON **VOID, not
// PASS**, and names W1-10 round 1 as the proof: both mandatory blind tests returned PASS on a
// build where `setLoadout()` rejected all 87 weapons, because the pick was a recitation of design
// columns with the header removed. So:
//
//   * every trace is produced by `setLoadout()` + `queueInputs()` + `stepFrames()` in headless
//     Chromium against the shipping build — not in the node arena, not from the moveset JSON;
//   * every row carries per-frame world MOTION and nothing else: frame, player x/z/yaw, weapon
//     socket A and B world positions, target hp, and the input script that produced it;
//   * the pack is asserted, programmatically, to contain no clip id, slot id, shape, arc, reach,
//     frame count, class code, weapon id or damage number — and the assertion FAILS THE RUN, so
//     a leak cannot be discovered later by a reader;
//   * the sealed key is written to a separate file so a critic can record picks before opening it.
//
// This tool GENERATES. It does not score, and the builder that wrote it does not take the test.
//
//   node tools/weapons/blind-pack.mjs [outdir]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const DIR = process.argv[2] || path.resolve(REPO_ROOT, 'reports/w1-10-blind-r3');
fs.mkdirSync(DIR, { recursive: true });

// A 1 200-frame script exercising the five verbs the user named — light chain, heavy, charged
// heavy, roll-attack, backstep-attack, running attack — identical for every weapon, so any
// difference in the trace is the weapon and not the operator.
const script = [];
{
  let f = 10;
  const tap = (b) => { script.push({ f, press: [b] }, { f: f + 2, release: [b] }); f += 10; };
  for (let i = 0; i < 4; i++) tap('light');
  f += 40; tap('heavy');
  f += 60; script.push({ f, press: ['heavy'] }, { f: f + 45, release: ['heavy'] }); f += 90;
  script.push({ f, move: [0, 1] }, { f: f + 1, press: ['roll'] }, { f: f + 2, release: ['roll'] }); f += 32; tap('light'); f += 60;
  script.push({ f, move: [0, 0] }, { f: f + 1, press: ['roll'] }, { f: f + 2, release: ['roll'] }); f += 18; tap('light'); f += 60;
  script.push({ f, move: [0, 1] }, { f, press: ['sprint'] }); f += 40; tap('light');
  script.push({ f, release: ['sprint'] }); f += 60;
  for (let i = 0; i < 3; i++) tap('light');
}

const { chromium } = await loadPlaywright();
const server = await serveDir(REPO_ROOT);
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 320, height: 240 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 120000 });
await page.evaluate(async () => { await window.__HARNESS.ready(); window.__HARNESS.setRenderRate(0); });

/**
 * One 1 200-frame trace, in the browser. The rows are read off the COMBAT TRACE's own per-frame
 * record — `x.p_pos`, `x.p_yaw`, `x.sockets` and the target's hp — rather than off anything the
 * probe computes, so the pack is what the engine produced.
 */
const trace = (weapon, sc) => page.evaluate(async ([w, s]) => {
  const H = window.__HARNESS;
  await H.ready();
  await H.loadState('wpn-dummy-arena');
  await H.setSeed(1);
  H.setLoadout({ weapon: w });
  for (const e of H.listEntities()) { if (e.kind !== 'enemy') continue; try { H.despawn(e.eid); } catch { /* fixture */ } }
  H.teleport(0, 0, { yaw: 0 });
  H.spawn('dummy_passive', 0, 2.2, { as: 'T', yaw: 180 });
  H.lockOn('T');
  H.combatTraceStart({});
  H.queueInputs(s);
  H.stepFrames(1200);
  const seg = H.combatTraceDrain();
  H.combatTraceStop();
  const rows = [];
  for (const r of seg) {
    const o = typeof r === 'string' ? JSON.parse(r) : r;
    if (!o || !o.x) continue;
    const sk = o.x.sockets || [0, 0, 0, 0, 0, 0];
    const hp = o.e && o.e.length ? o.e[0][3] : null;
    rows.push([o.f, o.x.p_pos[0], o.x.p_pos[2], o.x.p_yaw, sk[0], sk[1], sk[2], sk[3], sk[4], sk[5], hp]);
  }
  return rows;
}, [weapon, sc]);

// RI-WPN03 M6: twelve traces, four each from three classes, chosen for difficulty rather than
// for comfort — GHM/SPR/TSW are the trio the round-2 critic separated only 10 of 12.
const M6 = {
  GHM: ['ghm_bog_maul', 'ghm_kings_ruin', 'ghm_pile_driver', 'ghm_stone_breaker'],
  SPR: ['spr_drowned_harpoon', 'spr_fishers_gig', 'spr_mire_trident', 'spr_reed_gig'],
  TSW: ['tsw_bog_rapier', 'tsw_duelling_pick', 'tsw_oath_of_salt', 'tsw_reed_estoc'],
};
// RI-WPN02: three traces, three classes, three styles to be named from motion alone.
const M2 = { A: 'csw_naga_sickle', B: 'hlb_garrison_bill', C: 'mce_bog_iron_mace' };

const COLUMNS = ['f', 'px', 'pz', 'yaw', 'ax', 'ay', 'az', 'bx', 'by', 'bz', 'target_hp'];

/**
 * The leak assertion. Round 1 passed both blind tests on a pack of design columns; the only
 * defence that works is a machine reading the bytes back. Anything that names a weapon, a class,
 * a clip or a declared number fails the run.
 */
const BANNED = [
  /\b(ghm|spr|tsw|csw|hlb|mce|dgr|fst|ssw|axe|whp|gsw|cgs|ugs|bow)_[a-z_]+\b/i,
  /\bclip_[a-z0-9_]+\b/i,
  /\b(r1\.1|r1\.2|r1\.3|r2\.charged|roll\.r1|backstep\.r1|run\.r1|jump\.r1)\b/,
  /\b(arc_sweep_deg|reach_m|root_dz_m|motion_value|poise_damage|startup_f|active_f|recovery_f|hitbox_span_m|weight_tier|max_chain)\b/i,
  /\b(slash_h|slash_v|slash_d|thrust|smash|sweep|spin|lash|plunge)\b/i,
];
function assertBlind(obj, label) {
  const s = JSON.stringify(obj);
  for (const re of BANNED) {
    const m = s.match(re);
    if (m) throw new Error(`BLIND PACK LEAK in ${label}: /${re.source}/ matched ${JSON.stringify(m[0])}`);
  }
}

const key = { warning: 'do not read before recording picks', m6: {}, m2: {} };
const items = [];
for (const [cls, ws] of Object.entries(M6)) {
  for (const w of ws) items.push({ truth: { cls, w }, rows: await trace(w, script) });
}
// Deterministic shuffle by hash, so the label order carries no information about the truth.
items.sort((a, b) => crypto.createHash('sha256').update(a.truth.w).digest('hex')
  .localeCompare(crypto.createHash('sha256').update(b.truth.w).digest('hex')));
items.forEach((it, i) => {
  const id = 'T' + (i + 1);
  key.m6[id] = it.truth;
  const doc = { id, generated_in: 'headless Chromium against the shipping build', columns: COLUMNS, input_script: script, rows: it.rows };
  assertBlind(doc, `blind-m6-${id}`);
  fs.writeFileSync(`${DIR}/blind-m6-${id}.json`, JSON.stringify(doc));
});
for (const [lbl, w] of Object.entries(M2)) {
  key.m2[lbl] = w;
  const doc = { id: lbl, generated_in: 'headless Chromium against the shipping build', columns: COLUMNS, input_script: script, rows: await trace(w, script) };
  assertBlind(doc, `blind-m2-${lbl}`);
  fs.writeFileSync(`${DIR}/blind-m2-${lbl}.json`, JSON.stringify(doc));
}
fs.writeFileSync(`${DIR}/blind-KEY-SEALED.json`, JSON.stringify(key, null, 1));

// A summary a reader can check the pack against without opening a trace.
const stat = (id) => {
  const d = JSON.parse(fs.readFileSync(`${DIR}/${id}.json`, 'utf8'));
  const r = d.rows;
  const tip = r.map((x) => Math.hypot(x[7] - x[1], x[9] - x[2]));
  let maxSpd = 0;
  for (let i = 1; i < r.length; i++) maxSpd = Math.max(maxSpd, 60 * Math.hypot(r[i][7] - r[i - 1][7], r[i][8] - r[i - 1][8], r[i][9] - r[i - 1][9]));
  const hp = r.map((x) => x[10]).filter((x) => x !== null);
  return { rows: r.length, tip_radius_max_m: +Math.max(...tip).toFixed(3), tip_speed_max_mps: +maxSpd.toFixed(2), hp_lost: hp.length ? +(hp[0] - hp[hp.length - 1]).toFixed(1) : null };
};
const summary = {
  generated: new Date().toISOString(),
  generated_in: 'headless Chromium, shipping build, setLoadout + queueInputs + stepFrames',
  columns: COLUMNS,
  leak_assertion: `${BANNED.length} patterns, every trace checked, run fails on a match`,
  page_errors: pageErrors,
  m6: Object.fromEntries(Object.keys(key.m6).map((id) => [id, stat('blind-m6-' + id)])),
  m2: Object.fromEntries(Object.keys(key.m2).map((id) => [id, stat('blind-m2-' + id)])),
};
fs.writeFileSync(`${DIR}/PACK-SUMMARY.json`, JSON.stringify(summary, null, 1));
console.log(`generated ${Object.keys(key.m6).length} M6 + ${Object.keys(key.m2).length} M2 traces in ${DIR}`);
console.log(`columns: ${COLUMNS.join(',')}`);
console.log(`leak assertion: PASSED on all ${Object.keys(key.m6).length + Object.keys(key.m2).length} traces`);
console.log(`page errors: ${pageErrors.length}`);
for (const [id, s] of Object.entries(summary.m6)) console.log(`  ${id}  rows ${s.rows}  tip_r ${s.tip_radius_max_m}  tip_v ${s.tip_speed_max_mps}  hp_lost ${s.hp_lost}`);
for (const [id, s] of Object.entries(summary.m2)) console.log(`  ${id}   rows ${s.rows}  tip_r ${s.tip_radius_max_m}  tip_v ${s.tip_speed_max_mps}  hp_lost ${s.hp_lost}`);

await ctx.close(); await browser.close(); await server.close();
