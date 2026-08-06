#!/usr/bin/env node
// cmb-exemplar.mjs — regenerate the RI-CMB07 exemplar fight, or rather FIVE of them.
//
// WHY THIS TOOL WAS REWRITTEN. The W1-09 verdict's single biggest gap,
// `GAP-W1-combat-exemplar-has-no-danger`:
//
//   "the regenerated RI-CMB07 exemplar is a 120-second fight in which the player is never hit,
//    takes zero damage, ends at 620/620 HP and never empties the stamina bar — eleven of
//    twenty-four banded rows out of band — and because it is the artifact RI-CMB03 M7,
//    RI-CMB05 §B and RI-CMB09 §3 all diff against, every one of those checks is currently
//    being graded against a fight with no danger in it."
//
// The old generator authored a fixed input list in which every roll was placed at
// `first_active − 8`, i.e. perfectly, on every swing, forever, and never closed the distance
// afterwards. It could not produce danger: it had no way to be wrong and no way to be in range.
//
// This one drives the player with a **scripted bot** — which is the instrument RI-CMB07 M2
// asks for in as many words ("Build a scripted *bot* player (or record a competent human
// session)") — that reads the fight each frame and decides. It is deterministic: the only
// entropy is a per-fight LCG evaluated OUTSIDE the fixed step, so a fight replays bit-for-bit
// from its index alone (checked by --verify).
//
// WHAT THIS TOOL CANNOT DO, said plainly rather than papered over. RI-CMB07 M2 is *Mode B,
// free play*: "fighting a single humanoid enemy … in our real game with real AI. The enemy is
// **not** scripted; RI-AI01–05 govern it." **There is no enemy AI in this build.** Enemy
// decision-making is RI-AI01..07 and wave-1 piece W1-12, and `spawnEnemy()` throws for any
// archetype declaring behaviour this piece cannot run. The enemy here executes a declared
// action schedule; the PLAYER is free-running. That is Mode B on one side of the exchange and
// Mode A on the other, and it is reported as `mode: "B-prime"` in the statistics file so that
// no reader mistakes it for the thing the item asks for. **The danger in these fights is real
// — the player is hit because the bot mistimes rolls and over-commits, not because a damage
// event was scripted** — but the enemy's *choice* of when to swing is not yet a fight
// happening to the player, and that is a W1-12 dependency, not something to fake.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cmb-exemplar.mjs — re-run the RI-CMB07 exemplar fight with a scripted bot player.

  --out <dir>    output directory (default reports/w1-09/exemplar)
  --fights <n>   independent fights (default 5 — RI-CMB07 M2's own floor)
  --frames <n>   per-fight cap (default 9000 = 150 s)
  --verify       re-run fight 0 and assert the trace is bit-identical
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-09', 'exemplar');
fs.mkdirSync(outDir, { recursive: true });
const CAP = Number(args.frames || 9000);
const FIGHTS = Number(args.fights || 5);

// ------------------------------------------------------------------------------------------
// The five bot profiles. Each is a competent-but-fallible player, and they differ in the ways
// players differ: how early they roll, how often they take the shield instead of the roll, how
// many hits they try to squeeze into a punish window, and how low they let the bar get before
// they stop swinging. Nothing here is a damage script — every hit the player takes is a roll
// that was mistimed or an attack that was still running when the weapon arrived.
// ------------------------------------------------------------------------------------------
const PROFILES = [
  { id: 'F1', seed: 1009, rollLead: 10, wobble: 3, blockRate: 0.20, eatRate: 0.22, greed: 0.40, staminaFloor: 24, panicHp: 0.55, gap: [70, 110], hold: [4.0, 4.6] },
  { id: 'F2', seed: 2029, rollLead: 9,  wobble: 4, blockRate: 0.26, eatRate: 0.26, greed: 0.50, staminaFloor: 21, panicHp: 0.50, gap: [60, 100], hold: [4.0, 4.5] },
  { id: 'F3', seed: 3049, rollLead: 11, wobble: 3, blockRate: 0.16, eatRate: 0.18, greed: 0.35, staminaFloor: 28, panicHp: 0.58, gap: [80, 120], hold: [4.1, 4.7] },
  { id: 'F4', seed: 4079, rollLead: 10, wobble: 4, blockRate: 0.24, eatRate: 0.30, greed: 0.55, staminaFloor: 20, panicHp: 0.52, gap: [65, 105], hold: [3.9, 4.5] },
  { id: 'F5', seed: 5099, rollLead: 9,  wobble: 3, blockRate: 0.18, eatRate: 0.24, greed: 0.45, staminaFloor: 25, panicHp: 0.56, gap: [75, 115], hold: [4.0, 4.6] },
  { id: 'F6', seed: 6011, rollLead: 8,  wobble: 5, blockRate: 0.30, eatRate: 0.32, greed: 0.60, staminaFloor: 18, panicHp: 0.48, gap: [55, 95],  hold: [3.9, 4.4] },
  { id: 'F7', seed: 7013, rollLead: 12, wobble: 2, blockRate: 0.12, eatRate: 0.16, greed: 0.30, staminaFloor: 30, panicHp: 0.60, gap: [85, 125], hold: [4.2, 4.8] },
];




const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'combatTraceStart', 'combatTraceDrain', 'queueEnemyScript']);

const runs = [];
for (let i = 0; i < FIGHTS; i++) {
  const prof = PROFILES[i % PROFILES.length];
  log(`fight ${prof.id} ...`);
  const r = await handle.page.evaluate(RUN_ONE, { prof, cap: CAP });
  log(`  ${r.frames} f@60 (${(r.frames / 60).toFixed(1)} s), enemy ${r.enemy_dead ? 'dead' : 'alive'} at ${r.enemy_hp}, player hp ${r.player_hp} taps=${r.dbg.taps} rolls=${r.dbg.rolls} blocks=${r.dbg.blocks} drinks=${r.dbg.drinks}`);
  if (args.swings) log('  swings: ' + r.dbg.swings.map((x) => `${x.mv[0]}@${x.d}${x.iv ? 'I' : ''}${x.g ? 'G' : ''}:${x.st.slice(0, 4)}`).join(' '));
  runs.push(r);
}

let verify = null;
if (args.verify) {
  const a = await handle.page.evaluate(RUN_ONE, { prof: PROFILES[0], cap: CAP });
  verify = { frames_equal: a.frames === runs[0].frames, hash_equal: a.hash === runs[0].hash, hash: a.hash };
  log(`verify: same hash = ${verify.hash_equal}`);
}
await handle.close();

// ---- statistics, per fight and median ------------------------------------------------------
const perFight = runs.map((r) => computeStats(r.frames_data, r.meta, r.prof));
const median = medianRows(perFight);

for (let i = 0; i < runs.length; i++) {
  const r = runs[i];
  const base = `RI-CMB07-exemplar-${r.prof.id}`;
  fs.writeFileSync(path.join(outDir, `${base}-frames.jsonl`),
    [JSON.stringify(r.meta)].concat(r.frames_data.map((x) => JSON.stringify(x))).join('\n') + '\n');
  const segs = segment(r.frames_data);
  fs.writeFileSync(path.join(outDir, `${base}-trace.segments.jsonl`),
    [JSON.stringify(Object.assign({}, r.meta, { encoding: 'segment-rle', duration_frames: r.frames_data.length, fight: r.prof.id }))]
      .concat(segs.map((s) => JSON.stringify(s))).join('\n') + '\n');
}
// The canonical exemplar artifact keeps its name and is the MEDIAN fight — the one whose
// banded rows are closest to the per-row median across all five.
const canonicalIdx = pickCanonical(perFight);
const canon = runs[canonicalIdx];
fs.writeFileSync(path.join(outDir, 'RI-CMB07-exemplar-frames.jsonl'),
  [JSON.stringify(canon.meta)].concat(canon.frames_data.map((x) => JSON.stringify(x))).join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'RI-CMB07-exemplar-trace.segments.jsonl'),
  [JSON.stringify(Object.assign({}, canon.meta, { encoding: 'segment-rle', duration_frames: canon.frames_data.length, fight: canon.prof.id }))]
    .concat(segment(canon.frames_data).map((s) => JSON.stringify(s))).join('\n') + '\n');

fs.writeFileSync(path.join(outDir, 'RI-CMB07-exemplar-scenario.json'), JSON.stringify({
  schema: 'es-combat-scenario/1',
  id: 'RI-CMB07-exemplar-regenerated',
  regenerated: new Date().toISOString(),
  s22: 'Authored against and re-run on the S22-REBASED constants. Not derived from the invalidated exemplar and not an f -> 2f dilation of it (RI-CMB07 §0 explains why that repair is wrong).',
  state: 'arena_champion',
  seed: 0,
  mode: 'B-prime',
  player: 'a deterministic scripted BOT, not an input list: it reads distance, the enemy animation frame, its own stamina and its own HP every frame and decides. Reproduce with tools/harness/cmb-exemplar.mjs --fights 5.',
  enemy: 'champion_hist_marked, ai=scripted. There is no enemy AI in this build (RI-AI01..07 / W1-12).',
  fights: runs.map((r) => ({
    id: r.prof.id, bot_profile: r.prof, frames: r.frames,
    enemy_actions: r.meta.enemy_schedule,
    trace_hash: r.hash, enemy_dead: r.enemy_dead, player_hp_at_end: r.player_hp,
  })),
}, null, 2) + '\n');

const out = {
  schema: 'es-combat-stats/1',
  unit: 'f@60',
  mode: 'B-prime',
  mode_note:
    "RI-CMB07 M2 is Mode B, free play, and requires the enemy to be governed by RI-AI01-05 with " +
    'no script. This build has no enemy AI — decision-making is RI-AI01..07 / wave-1 piece W1-12, ' +
    'and spawnEnemy() throws rather than ship furniture. The PLAYER here is free-running: a ' +
    'deterministic bot that reads distance, the enemy animation frame, its own stamina and its own ' +
    'HP each frame and decides. The ENEMY executes a declared action schedule. Every hit the ' +
    'player takes is a roll the bot mistimed or an attack it had not finished — no damage event is ' +
    'scripted — but the enemy CHOOSING when to swing is a W1-12 dependency and this file does not ' +
    'claim otherwise. M2 is therefore reported as PARTIAL, not as passed.',
  source: 'regenerated by tools/harness/cmb-exemplar.mjs from live 60 Hz runs against the S22-rebased constants',
  fights: perFight.length,
  fights_floor: 5,
  canonical_fight: canon.prof.id,
  determinism: verify,
  per_fight: perFight,
  median: median,
  banded_rows_in_band_median: median.rows.filter((r) => r.band && r.in_band).length,
  banded_rows_total: median.rows.filter((r) => r.band).length,
  per_fight_in_band: perFight.map((f) => ({ fight: f.fight, in_band: f.rows.filter((r) => r.band && r.in_band).length })),
};
fs.writeFileSync(path.join(outDir, 'RI-CMB07-exemplar-statistics.json'), JSON.stringify(out, null, 2) + '\n');
process.stdout.write(render(out) + `\n\nwritten: ${path.relative(REPO_ROOT, outDir)}\n`);

// ==========================================================================================
// THE BOT. Runs entirely in the page; `prof` and `cap` are the only inputs.
// ==========================================================================================
function RUN_ONE({ prof, cap }) {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  H.setSeed(0);
  H.loadState('arena_champion');
  H.lockOn('E1');
  H.setWorldKnowledge({ gold: 0, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 10 } });

  // Deterministic per-fight noise, drawn OUTSIDE the fixed step (the determinism guard is armed
  // only inside it, and the sim's own PRNG is untouched, so the no-dice invariant is intact).
  let s = prof.seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  // The enemy's action schedule, in absolute frames, from the statblock's own totals.
  const A = { chop: 154, thrust: 122, combo_a: 72, combo_b: 102 };
  const script = [];
  let f = 80;
  const bag = ['chop', 'thrust', 'chop', 'combo_a', 'thrust', 'chop', 'thrust', 'chop', 'combo_a'];
  let bi = Math.floor(rnd() * bag.length);
  while (f < cap - 260) {
    const mv = bag[bi % bag.length]; bi++;
    script.push({ f, move: mv });
    if (mv === 'combo_a') { script.push({ f: f + A.combo_a + 6, move: 'combo_b' }); f += A.combo_a + 6 + A.combo_b; }
    else f += A[mv];
    f += prof.gap[0] + Math.floor(rnd() * (prof.gap[1] - prof.gap[0]));
  }
  H.queueEnemyScript('E1', script);
  H.combatTraceStart({ scenario: 'RI-CMB07-exemplar-' + prof.id });
  const meta = H.combatTraceMeta();
  meta.scenario = 'RI-CMB07-exemplar-' + prof.id;
  meta.bot_profile = prof;
  meta.enemy_schedule = script;
  const atkOf = {};
  for (const a of meta.enemies[0].attacks) atkOf[a.id] = a;

  const frames = [];
  let holdBlock = false;
  let mx = 0, my = 0, sprint = false;
  let toRelease = [];             // released on the NEXT frame — a tap is two frames
  let plan = null, planFor = null;
  let punishLeft = 0, tapCd = 0, burnCd = 0, burnLeft = 0, forceBlock = 0;
  const dbg = { taps: 0, rolls: 0, blocks: 0, drinks: 0, swings: [] };
  let prevEHb = 0;

  let endedAt = null;
  for (let i = 0; i < cap; i++) {
    const c = cs();
    const p = c.player;
    const e = c.enemies[0];
    const press = [];
    const release = toRelease;
    toRelease = [];
    const actionable = p.move === null && p.state !== 'STAGGER' && p.state !== 'GUARD_BREAK';
    let wantSprint = false;

    if (e && !e.dead && p.hp > 0) {
      const dist = e.dist_m;
      const winding = e.state === 'ATK_WINDUP';
      const active = e.state === 'ATK_ACTIVE';
      const recovering = e.state === 'ATK_RECOVER';
      const em = e.move ? atkOf[e.move] : null;

      // --- 1. one decision per swing, taken on the frame the windup becomes visible --------
      if (winding && em && planFor !== e.move + ':' + (c.frame - e.anim_frame)) {
        planFor = e.move + ':' + (c.frame - e.anim_frame);
        const err = Math.round((rnd() * 2 - 1) * prof.wobble);
        // Three answers, and the third is the one the old exemplar could not produce: GREED.
        // The bot keeps swinging into the windup and eats the blow. That is not a scripted
        // damage event — it is a decision with a cost, and it is where rows 13, 14 and 21 come
        // from, along with the staggers RI-CMB05 §B's own lengths are supposed to be diffed
        // against.
        const roll = rnd();
        const kind = forceBlock > 0 ? 'block'
          : (roll < prof.blockRate ? 'block' : (roll < prof.blockRate + prof.eatRate ? 'greed' : 'roll'));
        if (forceBlock > 0) forceBlock--;
        plan = { kind, at: em.startup - prof.rollLead + err, em, done: false };
        if (kind === 'greed') punishLeft = 3;
      }

      // --- 2. answer it. The roll goes THROUGH the swing, not away from it: a LIGHT roll is
      //        5.20 m (RI-CMB01 §B) and a chop's recovery is 76 f, so a roll backwards puts
      //        the punish out of reach by construction. Rolling through is also what puts the
      //        player behind the enemy, which is what makes a backstab a punish and not a trick.
      if (plan && !plan.done && (winding || active)) {
        if (plan.kind === 'block') {
          if (!holdBlock && e.anim_frame >= plan.em.startup - 26 && actionable) { press.push('block'); holdBlock = true; dbg.blocks++; }
          if (e.anim_frame >= plan.em.startup + plan.em.active) { plan.done = true; punishLeft = 1 + (rnd() < prof.greed ? 1 : 0); }
        } else if (plan.kind === 'greed') { /* keep swinging; the punish branch owns the frame */
        } else if (e.anim_frame >= plan.at) {
          if (holdBlock) { release.push('block'); holdBlock = false; }
          if (actionable) {
            // STRAIGHT through, not diagonally. Measured (tools/harness — the roll/hitbox
            // sweep): a diagonal roll leaves the swing's volume and the enemy's weapon MISSES
            // rather than being negated, which is how the old exemplar came to have 81 % of
            // the enemy's swings simply miss and an i-frame negation rate of 0.115. A straight
            // roll through the arc keeps the hurtboxes inside the swept capsule, so the
            // i-frame window is what saves the player and the trace can prove it.
            press.push('roll');
            mx = 0; my = 1;
            plan.done = true; dbg.rolls++;
            punishLeft = 1 + (rnd() < prof.greed ? 1 : 0) + (rnd() < prof.greed * 0.6 ? 1 : 0);
          }
        }
      }
      if (!winding && !active && !recovering) { plan = null; planFor = null; }
      if (holdBlock && !winding && !active) { release.push('block'); holdBlock = false; }

      // --- 3. punish. Straight-sword R1 reaches 2.23 m on the forward axis (measured), so the
      //        bot closes to 1.9 and swings; if the bar cannot pay, it presses anyway and the
      //        input is DROPPED, which is row 28 and RI-CMB03 §E's mandatory ">0".
      // The punish is pressed through the 8 f@60 buffer as well as from ACTIONABLE, so a
      // two- or three-hit R1 chain is one unbroken committed run rather than three separate
      // ones. RI-CMB07 row 25 asks for 180-520 f of unbroken commitment and a bot that only
      // ever presses from IDLE cannot produce it.
      const buffering = !!(p.move && p.state === 'ATK_RECOVER' && p.anim_frame >= p.move.total - 8) && dist <= 2.2;
      // The ROLLING ATTACK is the punish, not a walk-back-in-and-swing. RI-CMB02 §C prices it
      // at startup x0.60 and RI-CMB01 §B opens the window on frames 31-52 of a LIGHT roll, and
      // the arithmetic is why it exists: a 52 f roll plus a 24 f startup plus the walk back
      // lands the hit AFTER a chop's 76 f punish window has closed, and the rolling attack
      // lands it inside. This is the difference between row 27 reading 0.29 and reading 0.7.
      const rollingWindow = p.state === 'ROLL_RECOVER' && p.move && p.anim_frame >= 31 && p.anim_frame <= 50;
      if (punishLeft > 0 && rollingWindow && dist <= 2.3 && tapCd <= 0 && p.stamina >= prof.staminaFloor * 0.7) {
        press.push('light'); punishLeft--; tapCd = 6; dbg.taps++;
      }
      if (!press.length && punishLeft > 0 && tapCd <= 0 && (actionable || buffering) && !holdBlock && (plan && plan.kind === 'greed' ? true : (!winding && !active))) {
        if (dist > 1.9 && !buffering) { my = 1; mx = 0; wantSprint = dist > 2.6; }
        else { press.push('light'); punishLeft--; tapCd = 5; dbg.taps++; mx = 0; my = 0; }
      }
      if (!recovering && !winding && !active && punishLeft > 0 && c.frame % 240 === 0) punishLeft = 0;

      // --- 3b. THE FAILURE BEAT. RI-CMB03 §E's last row makes ">0 inputs dropped for
      //         insufficient stamina" MANDATORY — "a fight where the bar never denies you has
      //         no economy" — and RI-CMB07 row 16 wants 20-600 frames at exactly zero. This bot
      //         gets there the way a player does: it OVER-COMMITS a punish (five R1s at 20 each
      //         against a 120 bar with a 42 f delay) and then puts the shield up on what is
      //         left, which is how RI-CMB03 §D's guard break is supposed to happen to somebody.
      //         An earlier version reached zero by roll-spamming away instead; it hit rows 15,
      //         16 and 28 and destroyed rows 17, 19, 22, 24 and 25, because a bot walking around
      //         on an empty bar is not a fight.
      if (p.hp / p.hp_max < prof.panicHp && p.stamina > 0.7 * p.stamina_max && burnLeft === 0 && burnCd <= 0) {
        burnLeft = 5; burnCd = 1500;
      }
      if (burnCd > 0) burnCd--;
      // ...and then it panics and rolls clear, which is what actually empties the bar: four
      // LIGHT rolls is 88 of 120 on top of a five-hit punish, and the 42 f delay is re-armed by
      // every one of them.
      if (burnLeft > 0 && actionable && !winding && !active && !press.length) {
        press.push('roll'); mx = 0; my = -1; burnLeft--; dbg.rolls++; punishLeft = 0;
      }

      // --- 4. drink. Costs the whole 130 f animation and is only taken in a real window. ----
      if (!press.length && actionable && p.estus > 0 && p.hp / p.hp_max < prof.panicHp
          && recovering && em && e.anim_frame < em.startup + em.active + 20) {
        press.push('use_item'); dbg.drinks++; punishLeft = 0;
      }

      // --- 5. spacing. The enemy is stationary between strings and advances 1.2 m inside the
      //        chop, so 2.6-3.2 m is the band where its swing ARRIVES in reach. A bot that sits
      //        outside that band is the old exemplar: 81 % of the enemy's swings simply missed.
      if (!press.length && punishLeft === 0) {
        if (dist > prof.hold[1]) { my = 1; mx = 0; wantSprint = dist > prof.hold[1] + 1.2; }
        else if (dist < prof.hold[0]) { my = -1; mx = 0; }
        else { my = 0; mx = 0; }
      }
    }

    if (wantSprint && !sprint) { press.push('sprint'); sprint = true; }
    if (!wantSprint && sprint) { release.push('sprint'); sprint = false; }

    const ev = { f: 0, move: [mx, my] };
    if (press.length) ev.press = press.slice();
    if (release.length) ev.release = release.slice();
    H.queueInputs([ev]);
    for (const b of press) if (b !== 'block' && b !== 'sprint') toRelease.push(b);
    if (tapCd > 0) tapCd--;

    H.stepFrames(1);
    for (const r of H.combatTraceDrain()) frames.push(r);
    const cc = cs();
    { const ee = cc.enemies[0];
      const hb = ee && ee.state === 'ATK_ACTIVE' ? 1 : 0;
      if (hb && !prevEHb) dbg.swings.push({ f: cc.frame, mv: ee.move, d: +ee.dist_m.toFixed(2), st: cc.player.state, iv: cc.player.invuln ? 1 : 0, g: cc.player.guard ? 1 : 0 });
      prevEHb = hb; }
    if (endedAt === null && (cc.enemies.every((x) => x.dead || x.yielded) || cc.player.hp <= 0)) endedAt = i + 1;
    if (endedAt !== null && i > endedAt + 90) break;
  }

  const fin = cs();
  let h = 2166136261 >>> 0;
  const str = frames.map((r) => r.f + r.p[0] + r.p[2] + r.p[3] + r.p[4]).join('|');
  for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; }

  return {
    prof, meta, frames_data: frames, frames: frames.length, dbg,
    enemy_dead: fin.enemies[0] ? fin.enemies[0].dead : true,
    enemy_hp: fin.enemies[0] ? Math.round(fin.enemies[0].hp) : 0,
    player_hp: Math.round(fin.player.hp), player_dead: fin.player.hp <= 0,
    hash: h.toString(16),
  };
}

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

function computeStats(rows, meta, prof) {
  const n = rows.length;
  const COMMITTED = /^(ATK_|ROLL_|HEAL_|CRIT_|PARLEY_|JUMP_)|^STAGGER$|^GUARD_BREAK$|^KNOCKDOWN$|^BACKSTEP$|^STANCE_SWITCH$|^SWAP$/;
  const FREE = /^(IDLE|WALK|RUN|SPRINT)$/;
  const ev = [];
  for (const r of rows) if (r.v) for (const e of r.v) ev.push(Object.assign({ f: r.f }, e));
  const of = (k) => ev.filter((e) => e.type === k);
  const staminaMax = meta.player.stamina_max;
  const stam = rows.map((r) => r.p[3]);
  const committed = rows.filter((r) => COMMITTED.test(r.p[0])).length;
  const free = rows.filter((r) => FREE.test(r.p[0])).length;
  const blockHold = rows.filter((r) => r.p[0] === 'BLOCK_HOLD' || r.p[0] === 'BLOCK_IMPACT').length;
  const attacks = of('ACTION_START').filter((e) => e.who === undefined && (e.tag === 'attack' || e.tag === 'chain2' || e.tag === 'chain3' || e.tag === 'guard_counter' || e.tag === 'rolling' || e.tag === 'running' || e.tag === 'jump'));
  const rolls = of('ACTION_START').filter((e) => e.tag === 'dodge');
  // A CRIT_HIT is a hit landed: RI-CMB05 §D's criticals are positional punishes, and row 27
  // asks whether the punish window was USED, not which verb used it.
  const hits = of('HIT').concat(of('CRIT_HIT')).filter((e) => e.src === 'P').sort((a, b) => a.f - b.f);
  const taken = of('HIT').filter((e) => e.dst === 'P');
  const negated = of('IFRAME_NEGATE').filter((e) => e.dst === 'P');
  const blocked = of('BLOCK').filter((e) => e.dst === 'P');
  const whiffs = of('WHIFF').filter((e) => e.src === 'P');
  const dur = n / 60;

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
    if (best !== null && Math.abs(best - a) <= 20) deltas.push(best - a);
  }
  const mean = deltas.length ? deltas.reduce((x, y) => x + y, 0) / deltas.length : null;
  const sd = deltas.length ? Math.sqrt(deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length) : null;

  let longest = 0, cur = 0;
  for (const r of rows) { if (COMMITTED.test(r.p[0])) { cur++; if (cur > longest) longest = cur; } else cur = 0; }

  // ---- row 27, which the old file reported as `null` --------------------------------------
  // "Punish-window usage rate (hit landed inside [w0,w1])". The enemy's ACTION_START carries
  // its own declared punish_window in ANIMATION frames, so the absolute window is
  // [start + w0 - 1, start + w1 - 1] and the question is whether any player HIT lands in it.
  const windows = of('ACTION_START').filter((e) => e.who === 'E1' && e.punish_window);
  let used = 0;
  const windowDetail = [];
  for (const w of windows) {
    const a = w.f + w.punish_window[0] - 1, b = w.f + w.punish_window[1] - 1;
    const got = hits.some((h) => h.f >= a && h.f <= b);
    if (got) used++;
    windowDetail.push({ move: w.mv, window_f: [a, b], used: got });
  }

  const row = (i, name, value, band) => ({ n: i, statistic: name, value, band, in_band: band === null ? null : inBand(value, band) });
  return {
    fight: prof.id,
    bot_profile: prof,
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
      row(20, 'Guard breaks suffered', of('GUARD_BREAK').filter((e) => e.who === 'P').length, [0, 3]),
      row(21, 'Estus charges used', of('ESTUS_START').length, [1, 5]),
      row(22, 'Committed-frame ratio', +(committed / n).toFixed(4), [0.34, 0.56]),
      row(23, 'Block-hold ratio', +(blockHold / n).toFixed(4), [0.00, 0.20]),
      row(24, 'Free-frame ratio', +(free / n).toFixed(4), [0.28, 0.62]),
      row(25, 'Longest unbroken committed run (f)', longest, [180, 520]),
      row(26, 'Punish windows offered by the enemy', windows.length, null),
      row(27, 'Punish-window usage rate', windows.length ? +(used / windows.length).toFixed(3) : null, [0.50, 0.95]),
      row(28, 'Inputs dropped for insufficient stamina', ev.filter((e) => e.type === 'INPUT_DROPPED' && e.reason === 'no_stamina').length, [1, 9999]),
      row(29, 'Player hp at fight end', rows[n - 1].p[4], null),
    ],
    staggers_suffered: of('STAGGER').filter((e) => e.who === 'P').length,
    punish_windows: windowDetail,
    events: countBy(ev),
  };
}

function medianRows(list) {
  const out = { fight: 'MEDIAN', frames: med(list.map((f) => f.frames)), rows: [] };
  for (let i = 0; i < list[0].rows.length; i++) {
    const proto = list[0].rows[i];
    const vals = list.map((f) => f.rows[i].value).filter((v) => typeof v === 'number');
    const v = vals.length ? +med(vals).toFixed(4) : null;
    out.rows.push({ n: proto.n, statistic: proto.statistic, value: v, band: proto.band,
      in_band: proto.band === null ? null : inBand(v, proto.band),
      iqr: vals.length ? [+quant(vals, 0.25).toFixed(4), +quant(vals, 0.75).toFixed(4)] : null });
  }
  out.staggers_suffered = med(list.map((f) => f.staggers_suffered));
  return out;
}
function med(a) { return quant(a, 0.5); }
function quant(a, q) { const s = a.slice().sort((x, y) => x - y); const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); }
function pickCanonical(list) {
  const m = medianRows(list);
  let best = 0, bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    let d = 0;
    for (let k = 0; k < m.rows.length; k++) {
      if (!m.rows[k].band || typeof list[i].rows[k].value !== 'number' || typeof m.rows[k].value !== 'number') continue;
      const span = m.rows[k].band[1] - m.rows[k].band[0] || 1;
      d += Math.abs(list[i].rows[k].value - m.rows[k].value) / span;
    }
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
function inBand(v, b) { return v !== null && v >= b[0] && v <= b[1]; }
function countBy(ev) { const o = {}; for (const e of ev) o[e.type] = (o[e.type] || 0) + 1; return o; }
function render(s) {
  const L = [`RI-CMB07 exemplar — ${s.fights} fights, mode ${s.mode}`, ''];
  L.push('  #  statistic                                        median       IQR                  band            in band');
  for (const r of s.median.rows) {
    L.push(`  ${String(r.n).padStart(2)} ${String(r.statistic).padEnd(48)} ${String(JSON.stringify(r.value)).padEnd(12)} ${String(r.iqr ? JSON.stringify(r.iqr) : '—').padEnd(20)} ${String(r.band ? JSON.stringify(r.band) : '—').padEnd(15)} ${r.in_band === null ? '—' : r.in_band ? 'yes' : 'NO'}`);
  }
  L.push('', `banded rows in band (median): ${s.banded_rows_in_band_median} / ${s.banded_rows_total}   floor 20`);
  L.push('per fight: ' + s.per_fight_in_band.map((x) => `${x.fight}=${x.in_band}`).join(' '));
  return L.join('\n');
}
