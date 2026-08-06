#!/usr/bin/env node
// cmb-exemplar.mjs — regenerate the RI-CMB07 exemplar fight.
//
// RI-CMB07 §0: seam S22 invalidated the exemplar trace and every statistic derived from it,
// and the item's acceptance condition for closing that gap is
//
//   "a regenerated RI-CMB07-exemplar-trace.segments.jsonl whose META carries no INVALIDATED
//    block, whose player constants match RI-CMB01 §B and RI-CMB02 §A/§B as rebased, and whose
//    29 statistics are recomputed into §D with the Mode-B bands re-derived"
//
// and it is explicit about the ONE thing that must not be done:
//
//   "The obvious 'regeneration' is to dilate the whole timeline f -> 2f. It produces a wrong
//    artifact ... Regeneration therefore means RE-RUNNING the authored input script against
//    the rebased constants — not scaling the output."
//
// This tool re-runs. Nothing here scales anything.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cmb-exemplar.mjs — re-run the RI-CMB07 exemplar fight against the S22-rebased constants.

  --out <dir>   output directory (default reports/w1-09/exemplar)
  --frames <n>  cap the run (default 7200 = 120 s)
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-09', 'exemplar');
fs.mkdirSync(outDir, { recursive: true });
const CAP = Number(args.frames || 7200);

// ------------------------------------------------------------------------------------------
// THE AUTHORED SCRIPT. Both sides are scripted on exact frames — RI-CMB07 M1 Mode-A: "the
// enemy executes its scripted actions on the exact frames given; the player executes the
// scripted inputs on the exact frames given. No AI, no randomness, seed 0."
//
// It is authored against the REBASED constants, so the beats are placed where the rebased
// numbers put them: a LIGHT roll is 52 f and its i-frames are f5-f30, a straight-sword R1 is
// 74 f with Ps 25, the enemy's chop offers a 76-frame punish window, and the regen delay is
// 42 f. Every "roll at X, punish at Y" below is arithmetic on those figures.
// ------------------------------------------------------------------------------------------
const ENEMY_SCRIPT = [];
const PLAYER_SCRIPT = [{ f: 0, move: [0, 0] }];

let f = 60;                         // the fight opens after a second of spacing
const chopStartup = 68, chopActive = 10, chopTotal = 154;
const thrustStartup = 54, thrustTotal = 122;
const rollTotal = 52, r1Total = 74;

// Beat A x6 — the canonical exchange: the enemy chops, the player rolls so the i-frame window
// BRACKETS the active frames, then punishes twice inside the 76-frame recovery.
for (let i = 0; i < 6; i++) {
  ENEMY_SCRIPT.push({ f, move: 'chop' });
  const active = f + chopStartup + 1;                 // first active frame
  const roll = active - 8;                            // i-frames open 4 f before the weapon
  PLAYER_SCRIPT.push({ f: roll, move: [0, 1] }, { f: roll + 1, press: ['roll'] }, { f: roll + 3, release: ['roll'] });
  const punish = roll + rollTotal + 1;
  PLAYER_SCRIPT.push({ f: punish, move: [0, 0] }, { f: punish + 1, press: ['light'] }, { f: punish + 3, release: ['light'] });
  PLAYER_SCRIPT.push({ f: punish + r1Total, press: ['light'] }, { f: punish + r1Total + 2, release: ['light'] });
  f += chopTotal + 120;
}

// Beat B x3 — the shield beat: the player blocks the enemy's two-hit combo instead of rolling.
for (let i = 0; i < 3; i++) {
  PLAYER_SCRIPT.push({ f: f - 20, press: ['block'] });
  ENEMY_SCRIPT.push({ f, move: 'combo_a' }, { f: f + 80, move: 'combo_b' });
  PLAYER_SCRIPT.push({ f: f + 190, release: ['block'] });
  const punish = f + 210;
  PLAYER_SCRIPT.push({ f: punish, press: ['light'] }, { f: punish + 2, release: ['light'] });
  f += 340;
}

// Beat C — the failure beat: an over-greedy roll-spam empties the bar, an input is DENIED,
// the guard goes up on an empty bar and the enemy's chop shatters it.
const beatC = f;
for (let i = 0; i < 9; i++) {
  PLAYER_SCRIPT.push({ f: beatC + i * 54, move: [1, 0] }, { f: beatC + i * 54 + 1, press: ['roll'] }, { f: beatC + i * 54 + 3, release: ['roll'] });
}
PLAYER_SCRIPT.push({ f: beatC + 470, move: [0, 0] }, { f: beatC + 474, press: ['block'] });
ENEMY_SCRIPT.push({ f: beatC + 480, move: 'chop' });
PLAYER_SCRIPT.push({ f: beatC + 700, release: ['block'] });
f = beatC + 760;

// Beat D — recovery: drink, at the cost of the whole of an enemy recovery.
ENEMY_SCRIPT.push({ f, move: 'thrust' });
PLAYER_SCRIPT.push({ f: f + thrustStartup - 8, move: [0, 1] }, { f: f + thrustStartup - 7, press: ['roll'] }, { f: f + thrustStartup - 5, release: ['roll'] });
PLAYER_SCRIPT.push({ f: f + thrustStartup + 50, move: [0, 0] }, { f: f + thrustStartup + 52, press: ['use_item'] }, { f: f + thrustStartup + 54, release: ['use_item'] });
f += thrustTotal + 200;

// Beat E — the parry and the riposte.
ENEMY_SCRIPT.push({ f, move: 'thrust' });
PLAYER_SCRIPT.push({ f: f + thrustStartup - 14, press: ['parry'] }, { f: f + thrustStartup - 12, release: ['parry'] });
PLAYER_SCRIPT.push({ f: f + thrustStartup + 20, press: ['light'] }, { f: f + thrustStartup + 22, release: ['light'] });
f += 260;

// Beat F — close it out. Heavy attacks into the enemy's recovery until it dies.
for (let i = 0; i < 14; i++) {
  ENEMY_SCRIPT.push({ f, move: i % 2 ? 'thrust' : 'chop' });
  const startup = i % 2 ? thrustStartup : chopStartup;
  const roll = f + startup - 7;
  PLAYER_SCRIPT.push({ f: roll, move: [1, 0] }, { f: roll + 1, press: ['roll'] }, { f: roll + 3, release: ['roll'] });
  const punish = roll + rollTotal + 2;
  PLAYER_SCRIPT.push({ f: punish, move: [0, 0] }, { f: punish + 1, press: ['heavy'] }, { f: punish + 3, release: ['heavy'] });
  f += 300;
}
const TOTAL = Math.min(CAP, f + 120);

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'combatTraceStart', 'combatTraceDrain', 'queueEnemyScript']);

log(`exemplar: ${TOTAL} frames, ${PLAYER_SCRIPT.length} player events, ${ENEMY_SCRIPT.length} enemy actions`);

const result = await handle.page.evaluate(({ ps, es, total }) => {
  const H = window.__HARNESS;
  H.setSeed(0);
  H.loadState('arena_champion');
  H.lockOn('E1');
  H.setWorldKnowledge({ gold: 0, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 10 } });
  H.queueEnemyScript('E1', es);
  H.queueInputs(ps);
  H.combatTraceStart({ scenario: 'RI-CMB07-exemplar-regenerated' });
  const meta = H.combatTraceMeta();
  const frames = [];
  let endedAt = null;
  for (let i = 0; i < total; i++) {
    H.stepFrames(1);
    const drained = H.combatTraceDrain();
    for (const r of drained) frames.push(r);
    const c = H.getCombatState();
    if (endedAt === null && c.enemies.every((e) => e.dead || e.yielded)) endedAt = i + 1;
    if (endedAt !== null && i > endedAt + 60) break;
  }
  return { meta, frames, endedAt, final: H.getCombatState() };
}, { ps: PLAYER_SCRIPT, es: ENEMY_SCRIPT, total: TOTAL });
await handle.close();

const { meta, frames } = result;
log(`  ran ${frames.length} frames; enemy dead at ${result.endedAt ?? 'never'}`);

// ---- write the per-frame stream, the segment RLE, and the scenario ------------------------
const perFrame = path.join(outDir, 'RI-CMB07-exemplar-frames.jsonl');
fs.writeFileSync(perFrame, [JSON.stringify(meta)].concat(frames.map((r) => JSON.stringify(r))).join('\n') + '\n');

const segs = segment(frames);
fs.writeFileSync(path.join(outDir, 'RI-CMB07-exemplar-trace.segments.jsonl'),
  [JSON.stringify(Object.assign({}, meta, { encoding: 'segment-rle', duration_frames: frames.length }))]
    .concat(segs.map((s) => JSON.stringify(s))).join('\n') + '\n');

fs.writeFileSync(path.join(outDir, 'RI-CMB07-exemplar-scenario.json'), JSON.stringify({
  schema: 'es-combat-scenario/1',
  id: 'RI-CMB07-exemplar-regenerated',
  regenerated: new Date().toISOString(),
  s22: 'Authored against and re-run on the S22-REBASED constants. Not derived from the invalidated exemplar and not a f -> 2f dilation of it (RI-CMB07 §0 explains why that repair is wrong).',
  state: 'arena_champion',
  seed: 0,
  frames: frames.length,
  player_inputs: PLAYER_SCRIPT,
  enemy_actions: ENEMY_SCRIPT,
}, null, 2) + '\n');

const stats = computeStats(frames, meta);
fs.writeFileSync(path.join(outDir, 'RI-CMB07-exemplar-statistics.json'), JSON.stringify(stats, null, 2) + '\n');

process.stdout.write(renderStats(stats) + `\n\nwritten: ${path.relative(REPO_ROOT, outDir)}\n`);

// ==========================================================================================

function segment(rows) {
  const out = [];
  let cur = null;
  const key = (r) => [r.p[0], r.p[1], r.p[5], r.p[6], (r.e[0] || [])[0], (r.e[0] || [])[1], (r.e[0] || [])[4]].join('|');
  for (const r of rows) {
    const k = key(r);
    if (cur && cur.k === k && r.p[2] === cur.lastAnim + 1) {
      cur.f1 = r.f; cur.lastAnim = r.p[2]; cur.sp[1] = r.p[3]; cur.hp[1] = r.p[4];
      if (r.e[0]) { cur.e[3] = r.e[0][2]; cur.ehp[1] = r.e[0][3]; }
      continue;
    }
    if (cur) out.push(emit(cur));
    cur = {
      k, f0: r.f, f1: r.f, lastAnim: r.p[2],
      p: [r.p[0], r.p[1], r.p[2], r.p[2]], sp: [r.p[3], r.p[3]], hp: [r.p[4], r.p[4]],
      iv: r.p[5], hb: r.p[6],
      e: r.e[0] ? [r.e[0][0], r.e[0][1], r.e[0][2], r.e[0][2]] : null,
      ehp: r.e[0] ? [r.e[0][3], r.e[0][3]] : null,
      ehb: r.e[0] ? r.e[0][4] : 0,
    };
  }
  if (cur) out.push(emit(cur));
  for (const r of rows) if (r.v) for (const ev of r.v) out.push(Object.assign({ t: 'E', f: r.f, k: ev.type }, ev));
  out.sort((a, b) => (a.f0 ?? a.f) - (b.f0 ?? b.f));
  return out;
  function emit(c) {
    const s = { t: 'S', f0: c.f0, f1: c.f1, p: [c.p[0], c.p[1], c.p[2], c.lastAnim], sp: c.sp, hp: c.hp, iv: c.iv, hb: c.hb };
    if (c.e) { s.e = [c.e[0], c.e[1], c.e[2], c.e[3]]; s.ehp = c.ehp; s.ehb = c.ehb; }
    return s;
  }
}

function computeStats(rows, meta) {
  const n = rows.length;
  const COMMITTED = /^(ATK_|ROLL_|HEAL_|CRIT_|PARLEY_)|^STAGGER$|^GUARD_BREAK$|^KNOCKDOWN$|^BACKSTEP$/;
  const FREE = /^(IDLE|WALK|RUN|SPRINT)$/;
  const ev = [];
  for (const r of rows) if (r.v) for (const e of r.v) ev.push(Object.assign({ f: r.f }, e));
  const of = (k) => ev.filter((e) => e.type === k);
  const staminaMax = meta.player.stamina_max;
  const stam = rows.map((r) => r.p[3]);
  const committed = rows.filter((r) => COMMITTED.test(r.p[0])).length;
  const free = rows.filter((r) => FREE.test(r.p[0])).length;
  const blockHold = rows.filter((r) => r.p[0] === 'BLOCK_HOLD' || r.p[0] === 'BLOCK_IMPACT').length;
  const attacks = of('ACTION_START').filter((e) => e.tag === 'attack' || e.tag === 'chain2' || e.tag === 'chain3' || e.tag === 'guard_counter' || e.tag === 'rolling' || e.tag === 'running');
  const rolls = of('ACTION_START').filter((e) => e.tag === 'dodge');
  const hits = of('HIT').filter((e) => e.src === 'P');
  const taken = of('HIT').filter((e) => e.dst === 'P');
  const negated = of('IFRAME_NEGATE');
  const blocked = of('BLOCK');
  const whiffs = of('WHIFF').filter((e) => e.src === 'P');
  const dur = n / 60;

  // roll timing delta: i-frame window start minus enemy hitbox activation frame
  const enemyActive = [];
  let prev = 0;
  for (const r of rows) { const a = (r.e[0] || [])[4] || 0; if (a && !prev) enemyActive.push(r.f); prev = a; }
  const iframeStarts = [];
  let wasIv = 0;
  for (const r of rows) { if (r.p[5] && !wasIv) iframeStarts.push(r.f); wasIv = r.p[5]; }
  const deltas = [];
  for (const a of enemyActive) {
    let best = null;
    for (const s of iframeStarts) if (best === null || Math.abs(s - a) < Math.abs(best - a)) best = s;
    if (best !== null && Math.abs(best - a) <= 40) deltas.push(best - a);
  }
  const mean = deltas.length ? deltas.reduce((x, y) => x + y, 0) / deltas.length : null;
  const sd = deltas.length ? Math.sqrt(deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length) : null;

  let longest = 0, cur = 0;
  for (const r of rows) { if (COMMITTED.test(r.p[0])) { cur++; if (cur > longest) longest = cur; } else cur = 0; }

  const row = (i, name, value, band) => ({ n: i, statistic: name, value, band, in_band: band === null ? null : inBand(value, band) });
  return {
    schema: 'es-combat-stats/1',
    unit: 'f@60',
    source: 'regenerated by tools/harness/cmb-exemplar.mjs from a live 60 Hz run against the S22-rebased constants',
    frames: n,
    rows: [
      row(1, 'Fight duration (s)', +dur.toFixed(2), [70, 220]),
      row(2, 'Attack animations started / min', +(attacks.length / dur * 60).toFixed(2), [7, 17]),
      row(3, 'Hits landed', hits.length, null),
      row(4, 'Whiff rate', +(whiffs.length / Math.max(1, attacks.length)).toFixed(3), [0.03, 0.25]),
      row(5, 'Rolls / min', +(rolls.length / dur * 60).toFixed(2), [4, 13]),
      row(6, 'Dodge rolls (within 20 f of an enemy hitbox)', +(deltas.length / Math.max(1, rolls.length)).toFixed(3), [0.70, 1.0]),
      row(7, 'Roll timing delta, mean (f)', mean === null ? null : +mean.toFixed(2), [-16.0, -2.0]),
      row(8, 'Roll timing delta, sd', sd === null ? null : +sd.toFixed(2), [0, 8.0]),
      row(9, 'Roll timing delta, range', deltas.length ? [Math.min(...deltas), Math.max(...deltas)] : null, null),
      row(10, 'Enemy swings faced', enemyActive.length, null),
      row(11, 'Swings negated by i-frames', +(negated.length / Math.max(1, enemyActive.length)).toFixed(3), [0.40, 0.80]),
      row(12, 'Swings blocked', +(blocked.length / Math.max(1, enemyActive.length)).toFixed(3), [0.00, 0.35]),
      row(13, 'Swings taken', +(taken.length / Math.max(1, enemyActive.length)).toFixed(3), [0.05, 0.35]),
      row(14, 'Damage taken / max HP', +(taken.reduce((s, e) => s + (e.dmg || 0), 0) / meta.player.hp_max).toFixed(3), [0.4, 1.6]),
      row(15, 'Stamina floor (fraction of max)', +(Math.min(...stam) / staminaMax).toFixed(3), [0, 0.15]),
      row(16, 'Frames at exactly 0 stamina', stam.filter((s) => s === 0).length, [20, 600]),
      row(17, '% frames below 25% stamina', +(stam.filter((s) => s < 0.25 * staminaMax).length / n).toFixed(4), [0.03, 0.20]),
      row(18, '% frames above 90% stamina', +(stam.filter((s) => s > 0.90 * staminaMax).length / n).toFixed(4), [0.12, 0.45]),
      row(19, 'Mean stamina (fraction)', +(stam.reduce((a, b) => a + b, 0) / n / staminaMax).toFixed(4), [0.55, 0.80]),
      row(20, 'Guard breaks suffered', of('GUARD_BREAK').length, [0, 3]),
      row(21, 'Estus charges used', of('ESTUS_START').length, [1, 5]),
      row(22, 'Committed-frame ratio', +(committed / n).toFixed(4), [0.34, 0.56]),
      row(23, 'Block-hold ratio', +(blockHold / n).toFixed(4), [0.00, 0.20]),
      row(24, 'Free-frame ratio', +(free / n).toFixed(4), [0.28, 0.62]),
      row(25, 'Longest unbroken committed run (f)', longest, [180, 520]),
      row(26, 'Punish windows offered by the enemy', of('ACTION_START').filter((e) => e.who === 'E1').length, null),
      row(27, 'Punish-window usage rate', null, [0.50, 0.95]),
      row(28, 'Inputs dropped for insufficient stamina', ev.filter((e) => e.type === 'INPUT_DROPPED' && e.reason === 'no_stamina').length, [1, 9999]),
      row(29, 'Player hp at fight end', rows[n - 1].p[4], null),
    ],
    events: countBy(ev),
  };
}

function inBand(v, b) { return v !== null && v >= b[0] && v <= b[1]; }
function countBy(ev) {
  const o = {};
  for (const e of ev) o[e.type] = (o[e.type] || 0) + 1;
  return o;
}
function renderStats(s) {
  const L = [`RI-CMB07 exemplar, REGENERATED — ${s.frames} f@60 (${(s.frames / 60).toFixed(2)} s)`, ''];
  L.push('  #  statistic                                        value        band            in band');
  for (const r of s.rows) {
    L.push(`  ${String(r.n).padStart(2)} ${String(r.statistic).padEnd(48)} ${String(JSON.stringify(r.value)).padEnd(12)} ${String(r.band ? JSON.stringify(r.band) : '—').padEnd(15)} ${r.in_band === null ? '—' : r.in_band ? 'yes' : 'NO'}`);
  }
  L.push('', 'events: ' + JSON.stringify(s.events));
  return L.join('\n');
}
