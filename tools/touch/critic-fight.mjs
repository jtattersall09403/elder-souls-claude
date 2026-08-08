#!/usr/bin/env node
// =================================================================================================
// critic-fight.mjs — W1-TOUCH critic round 1.
//
// The round W1-TOUCH said, in its own `not_done`:
//
//   "NO FIGHT WAS MEASURED ON TOUCH. Every verb a fight needs is reachable (T1 16/16) and the
//    roll/sprint discriminator is the pad's to the frame, but nobody has swung, rolled and blocked
//    against a live enemy with a finger. The claim 'a phone can play a Souls-shaped fight' is NOT
//    established by this round and must not be read out of it."
//
// This tool takes that acceptance, plus the four the round left open that a critic can close in
// the same browser:
//
//   --leg fight    RI-JRN04 §G T1/T4/T5/T6/T9 against a LIVE, AGGROED enemy: swing, roll (and its
//                  i-frames), block (and the stamina the block costs), the charged heavy T6 that
//                  the round explicitly never put a finger on, and the strafing attack — stick and
//                  button at the same time — which is T9's real form and the commonest touch bug.
//   --leg menu     RULING R2's own declared, unmeasured consequence: with the arc reduced to
//                  ['interact','block'] while somebody is talking, the DRAWER goes too, and `menu`
//                  lives in the drawer. Is a touch player able to reach the pause menu during a
//                  conversation, and if not, can they get out of the conversation at all?
//   --leg insets   T8 clause ONE under a REAL cutout. Every profile the round ran had zero insets,
//                  so `insetViolations == 0` was measured against an inset of zero. M-P17's
//                  {top:0,right:44,bottom:21,left:44} is applied here.
//   --leg portrait Coverage the round declared UNMEASURED: portrait phone and portrait tablet.
//   --leg all
//
// TEARDOWNS (RULES 4/6). Each names the check id it must turn red:
//   --break-deaf        pointer events swallowed in the capture phase   -> C-SWING
//   --break-iframes     roll's i-frame window zeroed on a patched tree  -> C-ROLL-IFRAMES
//   --break-keeponly    RULING R2's keepOnly filter deleted             -> C-MENU-TRAPPED (control)
//   --break-inset-anchor  the safe-area anchor deleted from layout()    -> C-INSET
//
// DRIVE. Every touch is a real CDP `Input.dispatchTouchEvent`. No `__HARNESS.touchDown/Move/Up`,
// no `queueInputs`, no keyboard event in any leg. Harness calls are used ONLY to CONSTRUCT the
// arena (`aggro`, and reading `getCombatState`) — never to supply an input. That distinction is
// the whole point: an arena-construction call places a subject, an input call would be the tool
// playing the game instead of the finger.
//
// USAGE
//   node tools/touch/critic-fight.mjs --leg fight
//   node tools/touch/critic-fight.mjs --leg fight --break-deaf
//   node tools/touch/critic-fight.mjs --leg all --out reports/critic-w1-touch
// =================================================================================================
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) {
  usage('critic-fight.mjs', [
    '  --leg <name>   fight | menu | insets | portrait | all   (default fight)',
    '  --out <dir>    default reports/critic-w1-touch',
    '  --break-deaf | --break-iframes | --break-keeponly | --break-inset-anchor',
  ]);
  process.exit(0);
}

const LEG = String(args.leg || 'fight');
const OUT = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'critic-w1-touch');
const SHOTS = path.join(REPO_ROOT, 'docs', 'shots');
ensureDir(OUT); ensureDir(SHOTS);

const BREAK = {
  deaf: !!args['break-deaf'],
  iframes: !!args['break-iframes'],
  keeponly: !!args['break-keeponly'],
  insetAnchor: !!args['break-inset-anchor'],
};
const ANY_BREAK = Object.entries(BREAK).filter(([, v]) => v).map(([k]) => k);
const SIGNATURE = { deaf: 'C-SWING', iframes: 'C-ROLL-IFRAMES', keeponly: 'C-MENU-TRAPPED', insetAnchor: 'C-INSET' };

const say = (s) => process.stdout.write(s + '\n');
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { return null; } };
const commit = String(process.env.ES_COMMIT || (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch { return ''; } })());

const out = {
  schema: 'elder-souls/critic-touch-fight@1',
  piece: 'W1-TOUCH', role: 'critic',
  items: ['RI-JRN04 §G T1/T4/T5/T6/T8/T9/T10', 'RI-JRN01 O17', 'RI-MTH07'],
  commit, leg: LEG, teardowns: ANY_BREAK,
  drive: 'CDP Input.dispatchTouchEvent ONLY. No __HARNESS.touchDown/Move/Up, no queueInputs, no keyboard in any leg. Harness used for arena construction and readout only.',
  conditions: { loadavg_at_start: loadavg(), node: process.version },
  checks: {}, passes: [], failures: [], shots: [], notes: [],
};
const pass = (id, what, d) => { if (!out.passes.includes(id)) out.passes.push(id); out.checks[id] = { ok: true, what, ...d }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, d) => { if (!out.failures.includes(id)) out.failures.push(id); out.checks[id] = { ok: false, what, ...d }; say(`  FAIL ${id}  ${what}`); };
const note = (s) => { out.notes.push(s); say(`  .... ${s}`); };

const PROFILES = {
  phone: { id: 'phone-844x390', w: 844, h: 390, dpr: 3, kind: 'reference phone', orientation: 'landscape' },
  portraitPhone: { id: 'phone-portrait-390x844', w: 390, h: 844, dpr: 3, kind: 'reference phone', orientation: 'portrait' },
  portraitTablet: { id: 'tablet-portrait-820x1180', w: 820, h: 1180, dpr: 2, kind: 'tablet', orientation: 'portrait' },
};

// ---- the patched tree, for the two source-level teardowns --------------------------------------
function makePatchedTree() {
  const dst = path.join(OUT, 'patched-tree');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'game'), path.join(dst, 'game'), { recursive: true });
  const edit = (rel, from, to, why) => {
    const p = path.join(dst, 'game', 'src', rel);
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) throw new Error(`teardown ${why}: the sabotage did NOT apply — ${rel} does not contain ${JSON.stringify(from.slice(0, 70))}. An inert teardown (RULES 6) would void every number below.`);
    fs.writeFileSync(p, src.replace(from, to));
    say(`  [teardown] ${why}: patched game/src/${rel}`);
  };
  if (BREAK.keeponly) {
    // RULING R2 deleted: the arc is no longer reduced while a talking surface is up, and the
    // drawer (which carries `menu`) comes back with it. Both halves, because `keep` gates two
    // separate places in layout() and deleting one alone is the two-guards-for-one-defect shape
    // RULES 6 names as its fourth.
    edit('input/touch.js', 'const keep = Array.isArray(this.keepOnly) ? this.keepOnly : null;',
      'const keep = null;   // SABOTAGE --break-keeponly: RULING R2 deleted', 'break-keeponly');
  }
  if (BREAK.insetAnchor) {
    // T8 clause 1 deleted: the arc is anchored at the FRAME corner rather than the safe-area
    // corner, which is precisely the "true by construction" the overlay comment claims.
    edit('input/touch.js', 'const o = this._origin();\n    const out = [];',
      'const o = { x: this.viewport.w, y: this.viewport.h };   // SABOTAGE --break-inset-anchor\n    const out = [];', 'break-inset-anchor');
  }
  return dst;
}
const NEEDS_PATCH = BREAK.keeponly || BREAK.insetAnchor;

const { chromium } = await loadPlaywright();
let serveRoot = REPO_ROOT;
if (NEEDS_PATCH) { try { serveRoot = makePatchedTree(); } catch (e) { say(`  FATAL ${e.message}`); process.exit(2); } }
const server = await serveDir(serveRoot);
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
say(`  [browser] ONE instance, kept for the whole run; served from ${server.origin}`);

/** A hand. Every method is one CDP dispatch; the point list is carried so multi-touch is real. */
class Finger {
  constructor(cdp) { this.cdp = cdp; this.pts = new Map(); }
  _list() { return Array.from(this.pts.values()).map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 12, radiusY: 12, force: 1 })); }
  async down(id, x, y) { this.pts.set(id, { id, x, y }); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this._list() }); }
  async move(id, x, y) { const p = this.pts.get(id); if (!p) return; p.x = x; p.y = y; await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this._list() }); }
  async up(id) { this.pts.delete(id); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this._list() }); }
  async allUp() { this.pts.clear(); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
}

async function openPhone(prof, query = '', insets = null) {
  const ctx = await browser.newContext({
    viewport: { width: prof.w, height: prof.h }, deviceScaleFactor: prof.dpr,
    hasTouch: true, isMobile: true,
    colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
  if (BREAK.deaf) {
    await page.addInitScript(() => {
      window.addEventListener('pointerdown', (e) => e.stopImmediatePropagation(), true);
      window.addEventListener('pointermove', (e) => e.stopImmediatePropagation(), true);
    });
  }
  if (insets) {
    // M-P17's cutout, pushed in the way the real thing arrives: through the safe-area env(), which
    // `Viewport` reads. Set before load so the first layout already has it.
    await page.addInitScript((ins) => {
      window.__CRITIC_INSETS = ins;
      const apply = () => {
        const s = document.documentElement.style;
        s.setProperty('--sat', ins.top + 'px'); s.setProperty('--sar', ins.right + 'px');
        s.setProperty('--sab', ins.bottom + 'px'); s.setProperty('--sal', ins.left + 'px');
      };
      if (document.documentElement) apply(); else addEventListener('DOMContentLoaded', apply);
    }, insets);
  }
  await page.goto(server.origin + '/game/index.html' + query, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
  await page.evaluate(() => window.__HARNESS.ready());
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors, prof, finger: new Finger(cdp) };
}

const mk = (H) => ({
  frame: () => H.page.evaluate(() => window.__ENGINE.sim.frame),
  combat: () => H.page.evaluate(() => window.__HARNESS.getCombatState()),
  touch: () => H.page.evaluate(() => window.__HARNESS.touchState()),
  layout: () => H.page.evaluate(() => window.__HARNESS.touchLayout()),
  pos: () => H.page.evaluate(() => window.__ENGINE.sim.player.pos.slice()),
  mode: () => H.page.evaluate(() => window.__ENGINE.mode),
});

/** Wait for the rAF loop to advance n sim frames. Play mode: the world runs on its own clock. */
async function advance(H, n, capMs = 90000) {
  const f = () => H.page.evaluate(() => window.__ENGINE.sim.frame);
  const f0 = await f(); const t0 = Date.now(); let cur = f0;
  while (cur - f0 < n && Date.now() - t0 < capMs) { await H.page.waitForTimeout(50); cur = await f(); }
  return { advanced: cur - f0, ms: Date.now() - t0 };
}

const centreOf = (layout, action) => { const c = (layout || []).find((x) => x.action === action); return c ? { x: c.x, y: c.y, r: c.r } : null; };

/**
 * Sample the combat state as fast as the page will answer while a finger is doing something.
 * RULES 8: one instant is a still target in time. A roll's i-frame window is ~26 f@60 out of a
 * move that is longer than that, so a single sample after the fact sees `invuln:false` and would
 * report the i-frames missing. This polls THROUGH the move.
 */
async function sampleWhile(H, ms, everyMs = 16) {
  const t0 = Date.now(); const s = [];
  while (Date.now() - t0 < ms) {
    s.push(await H.page.evaluate(() => {
      const c = window.__HARNESS.getCombatState();
      const e = c.enemies[0] || null;
      return {
        f: c.frame, st: c.player.state, anim: c.player.anim, move: c.player.move ? c.player.move.id : null,
        inv: !!c.player.invuln, guard: !!c.player.guard, sta: c.player.stamina, hp: c.player.hp,
        e_hp: e ? e.hp : null, e_state: e ? e.state : null, e_move: e ? e.move : null, e_dist: e ? e.dist_m : null,
      };
    }));
    await H.page.waitForTimeout(everyMs);
  }
  return s;
}

const shot = async (H, name) => {
  const p = path.join(SHOTS, name);
  await H.page.screenshot({ path: p });
  out.shots.push(path.relative(REPO_ROOT, p));
  say(`  [shot] ${path.relative(REPO_ROOT, p)}`);
};

// =============================================================================================
// LEG: fight — the acceptance nobody had taken
// =============================================================================================
async function legFight() {
  const prof = PROFILES.phone;
  say(`\n-- LEG fight · ${prof.id} · a live sentry, a finger -----------------------------------`);
  // `?state=arena_duel` is ARENA CONSTRUCTION, not a mode override: `main.js:17` resolves `mode`
  // from the `mode` param or `navigator.webdriver`, and both say PLAY here. The world is driven by
  // requestAnimationFrame exactly as it is for a human, and every input below is a finger.
  const H = await openPhone(prof, '?state=arena_duel');
  const g = mk(H);
  const rec = { profile: prof, beats: [] };
  try {
    const boot = await H.page.evaluate(() => ({
      mode: window.__ENGINE.mode,
      deviceClass: window.__HARNESS.getViewport ? window.__HARNESS.getViewport().deviceClass : null,
      shown: window.__HARNESS.touchState().shown,
    }));
    rec.boot = boot;
    if (boot.mode !== 'play') { fail('C-BOOT', `the fight fixture did not boot into play mode (mode=${boot.mode}) — every number below would be taken in the harness's world, not the player's`, boot); return rec; }
    pass('C-BOOT', `arena_duel booted in mode '${boot.mode}' as deviceClass '${boot.deviceClass}', touch overlay shown=${boot.shown}`, boot);

    const layout = await g.layout();
    rec.layout = layout.map((c) => c.action);
    const c0 = await g.combat();
    rec.start = { player_hp: c0.player.hp, player_sta: c0.player.stamina, weapon: c0.player.weapon, enemies: c0.enemies.map((e) => ({ id: e.id, hp: e.hp, dist: e.dist_m })) };
    if (!c0.enemies.length) { fail('C-ENEMY', 'no enemy in the arena — there is nothing to fight and every check below is vacuous', rec.start); return rec; }

    // ---- make the fight LIVE. RULES 8: a still target hides every defect. ---------------------
    await H.page.evaluate(() => { const c = window.__HARNESS.getCombatState(); window.__HARNESS.aggro(c.enemies[0].id); });
    await advance(H, 20);
    const cA = await g.combat();
    rec.aggroed = { state: cA.enemies[0].state, dist: cA.enemies[0].dist_m };
    say(`  .... sentry '${cA.enemies[0].id}' is ${cA.enemies[0].state} at ${cA.enemies[0].dist_m.toFixed(2)} m`);
    await shot(H, `2026-08-08-critic-touch-fight-01-the-sentry-aggroed.png`);

    // ---- C-SWING: a finger on `light`, and an enemy that loses hp -----------------------------
    // The observable is the ENEMY'S HP, not a harness return value and not an input edge. RI-JRN04
    // CONSUMPTION §2: "a state that survives" / "an input that is accepted".
    const eHp0 = cA.enemies[0].hp;
    const pSta0 = cA.player.stamina;
    const lc = centreOf(layout, 'light');
    if (!lc) { fail('C-SWING', "'light' is not laid out on the arc — a phone cannot attack at all", { layout: rec.layout }); }
    else {
      const swings = [];
      for (let i = 0; i < 6 && swings.length < 6; i++) {
        await H.finger.down(9, lc.x, lc.y);
        await H.page.waitForTimeout(70);
        await H.finger.up(9);
        const s = await sampleWhile(H, 900);
        const moved = s.find((x) => x.move && /r1|light|attack/i.test(x.move));
        swings.push({ i, move: moved ? moved.move : null, e_hp: s.length ? s[s.length - 1].e_hp : null, sta_min: Math.min(...s.map((x) => x.sta)) });
        await H.page.waitForTimeout(120);
      }
      rec.swings = swings;
      const cB = await g.combat();
      const eHp1 = cB.enemies[0].hp;
      const anyMove = swings.some((x) => x.move);
      const dmg = eHp0 - eHp1;
      const staSpent = pSta0 - Math.min(...swings.map((x) => x.sta_min));
      if (dmg > 0 && anyMove) pass('C-SWING', `six taps on 'light' with a finger drove the straight sword and took the sentry from ${eHp0} to ${eHp1} hp (${dmg} damage); the move ids seen were ${[...new Set(swings.map((x) => x.move).filter(Boolean))].join(', ')}`, { e_hp_before: eHp0, e_hp_after: eHp1, damage: dmg, moves: swings.map((x) => x.move) });
      else fail('C-SWING', `taps on 'light' did not damage the sentry (hp ${eHp0} -> ${eHp1}); move ids seen: ${JSON.stringify([...new Set(swings.map((x) => x.move))])}`, { e_hp_before: eHp0, e_hp_after: eHp1, swings });
      if (staSpent > 0) pass('C-SWING-STAM', `the swing costs stamina on touch exactly as it does on a pad — ${pSta0.toFixed(1)} down to ${(pSta0 - staSpent).toFixed(1)} at the trough`, { stamina_before: pSta0, stamina_spent: Math.round(staSpent * 100) / 100 });
      else fail('C-SWING-STAM', `stamina never moved across six swings (${pSta0}) — a Souls fight whose universal currency is not spent is not a Souls fight`, { stamina_before: pSta0 });
    }

    // ---- C-ROLL + C-ROLL-IFRAMES: a tap under the gate, and the i-frames it must buy ----------
    const rc = centreOf(layout, 'roll');
    if (!rc) fail('C-ROLL', "'roll' is not laid out on the arc", { layout: rec.layout });
    else {
      // Under the 12-frame gate => roll, not sprint (T5). 70 ms is ~4 frames at 60 Hz.
      await H.finger.down(8, rc.x, rc.y);
      await H.page.waitForTimeout(70);
      await H.finger.up(8);
      const s = await sampleWhile(H, 1200, 12);
      rec.roll_samples = s.length;
      const rolled = s.filter((x) => x.move && /roll|dodge/i.test(x.move));
      const invuln = s.filter((x) => x.inv);
      rec.roll = { move_ids: [...new Set(s.map((x) => x.move).filter(Boolean))], invuln_samples: invuln.length, samples: s.length };
      if (rolled.length) pass('C-ROLL', `a 70 ms tap on the shared roll/sprint control rolled — move '${rolled[0].move}' — with a finger, at a live enemy`, rec.roll);
      else fail('C-ROLL', `a short tap on the roll control produced no roll; move ids seen across ${s.length} samples: ${JSON.stringify(rec.roll.move_ids)}`, rec.roll);
      if (invuln.length) pass('C-ROLL-IFRAMES', `the roll a FINGER started carries real i-frames — invuln true on ${invuln.length} of ${s.length} samples through the move. This is the Souls half of the brief reaching the touchscreen, not just the input layer.`, rec.roll);
      else fail('C-ROLL-IFRAMES', `the finger's roll never went invulnerable across ${s.length} samples — the touch path reaches the move but not its i-frame window`, rec.roll);
    }

    // ---- C-BLOCK: a held finger, a raised guard, and a hit that costs stamina not hp ----------
    const bc = centreOf(layout, 'block');
    if (!bc) fail('C-BLOCK', "'block' is not laid out on the arc", { layout: rec.layout });
    else {
      await H.finger.down(7, bc.x, bc.y);
      const s = await sampleWhile(H, 2500, 20);
      await H.finger.up(7);
      const guarded = s.filter((x) => x.guard);
      rec.block = { guard_samples: guarded.length, samples: s.length, hp_start: s[0] && s[0].hp, hp_end: s[s.length - 1] && s[s.length - 1].hp, sta_start: s[0] && s[0].sta, sta_end: s[s.length - 1] && s[s.length - 1].sta };
      if (guarded.length) pass('C-BLOCK', `holding the 'block' control with a finger raises and HOLDS the guard — ${guarded.length} of ${s.length} samples with guard true across 2.5 s. A held touch control is a different mechanism from a tapped one and this is the one a Souls fight leans on.`, rec.block);
      else fail('C-BLOCK', `the guard never came up under a held finger across ${s.length} samples`, rec.block);
    }

    // ---- C-STRAFE (T9's real form): stick AND button at the same time -------------------------
    // "A build that drops the camera drag when a button is held has failed this check, and it is
    // the most common touch bug there is." The round measured four simultaneous touches
    // REGISTERING. It never measured whether the world still moves under them. This does.
    {
      const p0 = await g.pos();
      const origin = { x: 160, y: 260 };
      await H.finger.down(1, origin.x, origin.y);
      await H.page.waitForTimeout(30);
      await H.finger.move(1, origin.x + 80, origin.y);            // hard right on the stick
      await H.page.waitForTimeout(250);
      const lc2 = centreOf(layout, 'light');
      await H.finger.down(9, lc2.x, lc2.y);                        // and swing WHILE strafing
      await H.page.waitForTimeout(80);
      await H.finger.up(9);
      const s = await sampleWhile(H, 900, 20);
      await H.finger.up(1);
      const p1 = await g.pos();
      const dist = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      const swungWhileMoving = s.some((x) => x.move && /r1|light|attack/i.test(x.move));
      rec.strafe = { moved_m: Math.round(dist * 1000) / 1000, swung: swungWhileMoving, moves: [...new Set(s.map((x) => x.move).filter(Boolean))] };
      if (dist > 0.2 && swungWhileMoving) pass('C-STRAFE', `stick and attack button held by two fingers at once: the body travelled ${dist.toFixed(3)} m AND the swing came out. The commonest touch bug — a build that drops one input while the other is held — is not present.`, rec.strafe);
      else if (dist > 0.2) fail('C-STRAFE', `the stick moved the body ${dist.toFixed(3)} m but the simultaneous tap on 'light' produced no attack — the second finger is dropped while the first is down`, rec.strafe);
      else fail('C-STRAFE', `the body moved ${dist.toFixed(3)} m under a held stick while a button was tapped — movement is dropped when a second finger lands`, rec.strafe);
    }

    // ---- C-T6-CHARGE: the charged heavy the round explicitly never put a finger on ------------
    const hc = centreOf(layout, 'heavy');
    if (!hc) fail('C-T6-CHARGE', "'heavy' is not laid out on the arc", { layout: rec.layout });
    else {
      // T6: "charged heavy is a hold on the `heavy` button, thresholded on duration". The round
      // established that the threshold lives in combat/player.js `_chargeTick` and said plainly
      // that nobody had put a finger on it. Two arms, same finger, different hold duration.
      const arm = async (ms) => {
        await H.finger.down(6, hc.x, hc.y);
        const s1 = sampleWhile(H, ms + 700, 16);
        await new Promise((r) => setTimeout(r, ms));
        await H.finger.up(6);
        const s = await s1;
        await H.page.waitForTimeout(800);
        return [...new Set(s.map((x) => x.move).filter(Boolean))];
      };
      const shortHold = await arm(60);
      await advance(H, 40);
      const longHold = await arm(700);
      rec.t6 = { short_hold_60ms: shortHold, long_hold_700ms: longHold };
      const charged = longHold.some((m) => /charg/i.test(m));
      const plain = shortHold.some((m) => /r2|heavy/i.test(m));
      if (charged && !shortHold.some((m) => /charg/i.test(m))) pass('C-T6-CHARGE', `T6 measured on touch for the first time: a 60 ms hold on 'heavy' gives ${JSON.stringify(shortHold)}, a 700 ms hold gives ${JSON.stringify(longHold)} — the charged variant appears only on the long hold, thresholded on duration exactly as T6 asks`, rec.t6);
      else if (plain || longHold.length) fail('C-T6-CHARGE', `the heavy comes out on touch but the DURATION THRESHOLD does not discriminate: 60 ms -> ${JSON.stringify(shortHold)}, 700 ms -> ${JSON.stringify(longHold)}. T6 asks for a charged heavy thresholded on hold duration; on this path both holds give the same move.`, rec.t6);
      else fail('C-T6-CHARGE', `no heavy move at all came out under either hold: 60 ms -> ${JSON.stringify(shortHold)}, 700 ms -> ${JSON.stringify(longHold)}`, rec.t6);
    }

    // ---- C-FIGHT-END: did any of it actually matter to the world? -----------------------------
    const cEnd = await g.combat();
    rec.end = { player_hp: cEnd.player.hp, enemies: cEnd.enemies.map((e) => ({ id: e.id, hp: e.hp, state: e.state, dead: e.dead })) };
    await shot(H, `2026-08-08-critic-touch-fight-02-after-the-exchange.png`);
    const eEnd = cEnd.enemies[0];
    const tookDamage = cEnd.player.hp < c0.player.hp;
    rec.player_took_damage = tookDamage;
    if (eEnd && eEnd.hp < eHp0) pass('C-FIGHT', `A PHONE FOUGHT. Over one exchange driven entirely by fingers the sentry went ${eHp0} -> ${eEnd.hp} hp (state ${eEnd.state}) and the player ${c0.player.hp} -> ${cEnd.player.hp}. Swing, roll with i-frames, held guard and a strafing attack all came out of real touch events.`, rec.end);
    else fail('C-FIGHT', `after the whole exchange the sentry is unchanged at ${eEnd ? eEnd.hp : 'n/a'} hp — nothing a finger did reached the fight`, rec.end);
    if (H.errors.length) note(`page errors during the fight: ${JSON.stringify(H.errors.slice(0, 3))}`);
  } finally { await H.ctx.close(); }
  return rec;
}

// =============================================================================================
// LEG: menu — RULING R2's own declared, unmeasured consequence
// =============================================================================================
async function legMenu() {
  const prof = PROFILES.phone;
  say(`\n-- LEG menu · R2 says the drawer goes with the arc, and 'menu' lives in the drawer ------`);
  const H = await openPhone(prof, '');
  const g = mk(H);
  const rec = { profile: prof };
  try {
    // Get to a conversation the way the round did: on the glass. The opening's first talking
    // surface is reached without a query string, so this is a player's real launch.
    await advance(H, 30);
    const layoutIdle = await g.layout();
    rec.arc_idle = layoutIdle.map((c) => c.action);
    rec.menu_in_idle_arc = rec.arc_idle.includes('menu');
    rec.drawer_in_idle_arc = rec.arc_idle.some((a) => /drawer|more|radial/i.test(a));

    // Open the title -> New with a finger, then walk and talk. Reuse the round's beats minimally:
    // all we need is ANY talking surface up.
    const tapAt = async (x, y, ms = 90) => { await H.finger.down(9, x, y); await H.page.waitForTimeout(ms); await H.finger.up(9); await H.page.waitForTimeout(60); };
    const ic = centreOf(layoutIdle, 'interact');
    if (ic) { await tapAt(ic.x, ic.y); await advance(H, 20); }

    // Drive to a talking surface by whatever route the build offers, then assert on it.
    const upState = async () => H.page.evaluate(() => {
      const e = window.__ENGINE;
      const st = e.census ? e.census.state() : null;
      return {
        node: st ? st.node : null,
        takesInput: !!(e.censusSurface && e.censusSurface.takesInput),
        uiMode: e.renderer && e.renderer.ui ? e.renderer.ui.mode : null,
        menuOpen: !!e.sim.menuOpen,
        clearRight: e.renderer && e.renderer.ui ? e.renderer.ui.touchClearRightX : undefined,
      };
    });
    let st = await upState();
    // If the opening has not put a surface up yet, walk toward the first speaker on the stick.
    for (let i = 0; i < 12 && !st.takesInput; i++) {
      await H.finger.down(1, 150, 250); await H.page.waitForTimeout(20);
      await H.finger.move(1, 150, 170); await H.page.waitForTimeout(500); await H.finger.up(1);
      const l = await g.layout(); const c = centreOf(l, 'interact');
      if (c) await tapAt(c.x, c.y);
      await advance(H, 15);
      st = await upState();
    }
    rec.surface = st;
    if (!st.takesInput) { fail('C-MENU-SETUP', `could not get a talking surface up on touch inside the budget — R2's consequence is UNMEASURED by me too, and I am saying so rather than inferring it`, st); return rec; }

    const layoutTalk = await g.layout();
    rec.arc_talking = layoutTalk.map((c) => c.action);
    rec.menu_reachable_while_talking = rec.arc_talking.includes('menu') || rec.arc_talking.some((a) => /drawer|more|radial/i.test(a));
    say(`  .... arc idle    : ${JSON.stringify(rec.arc_idle)}`);
    say(`  .... arc talking : ${JSON.stringify(rec.arc_talking)}`);
    await shot(H, `2026-08-08-critic-touch-03-the-arc-while-someone-is-talking.png`);

    // The claim under test is R2's OWN: "nobody is trapped in a conversation — `interact` ends it
    // and `block` steps back". So: is the menu gone (the declared consequence), and if it is, does
    // the escape hatch R2 relies on actually work FROM A FINGER?
    if (!rec.menu_reachable_while_talking) {
      pass('C-MENU-GONE', `R2's declared consequence is REAL and is now measured rather than asserted: the arc reduces from ${rec.arc_idle.length} controls to ${rec.arc_talking.length} (${JSON.stringify(rec.arc_talking)}) while a surface takes input, and neither 'menu' nor the drawer that carries it is on the glass. A touch player CANNOT open the pause menu mid-conversation.`, { idle: rec.arc_idle, talking: rec.arc_talking });
    } else {
      fail('C-MENU-GONE', `R2 declared that the drawer goes with the arc and that 'menu' therefore becomes unreachable mid-conversation. It is still reachable (${JSON.stringify(rec.arc_talking)}) — the ruling's own description of its consequence does not match the build.`, { idle: rec.arc_idle, talking: rec.arc_talking });
    }

    // The escape hatch, on the glass.
    const before = await upState();
    const l2 = await g.layout(); const ic2 = centreOf(l2, 'interact');
    let escaped = false, taps = 0;
    for (let i = 0; i < 25 && ic2 && !escaped; i++) {
      await tapAt(ic2.x, ic2.y); taps++;
      await advance(H, 12);
      const s = await upState();
      if (!s.takesInput) { escaped = true; }
    }
    rec.escape = { escaped, taps, before: before.node, after: (await upState()).node };
    if (escaped) pass('C-MENU-TRAPPED', `nobody is trapped: ${taps} taps on 'interact' with a finger carried the conversation from '${before.node}' to its end and gave the full arc back. R2's safety argument survives contact.`, rec.escape);
    else fail('C-MENU-TRAPPED', `A TOUCH PLAYER IS TRAPPED. The menu is off the glass while a surface takes input AND ${taps} taps on 'interact' did not end the conversation (still at '${(await upState()).node}'). R2 traded the menu away for a guarantee that does not hold.`, rec.escape);
  } finally { await H.ctx.close(); }
  return rec;
}

// =============================================================================================
// LEG: insets — T8 clause ONE against a REAL cutout, not against zero
// =============================================================================================
async function legInsets() {
  const prof = PROFILES.phone;
  const insets = { top: 0, right: 44, bottom: 21, left: 44 };   // RI-JRN04 M-P17
  say(`\n-- LEG insets · M-P17's cutout ${JSON.stringify(insets)} ------------------------------`);
  const H = await openPhone(prof, '', insets);
  const g = mk(H);
  const rec = { profile: prof, insets_requested: insets };
  try {
    await advance(H, 20);
    const s = await H.page.evaluate(() => {
      const t = window.__ENGINE.real.touch;
      return { insets_seen: t.insets ? { ...t.insets } : null, vw: t.viewport ? t.viewport.w : null, vh: t.viewport ? t.viewport.h : null };
    });
    rec.seen = s;
    say(`  .... TouchInput.insets = ${JSON.stringify(s.insets_seen)} at ${s.vw}x${s.vh}`);
    // Whether or not the CSS env() route reaches it, force the insets through the same setter the
    // Viewport uses, so T8 clause 1 is tested against a NON-ZERO inset one way or another.
    await H.page.evaluate((ins) => {
      const e = window.__ENGINE; const t = e.real.touch;
      t.setViewport(t.viewport.w, t.viewport.h, window.devicePixelRatio, ins);
    }, insets);
    await advance(H, 10);
    const layout = await g.layout();
    const vp = await H.page.evaluate(() => { const t = window.__ENGINE.real.touch; return { w: t.viewport.w, h: t.viewport.h, insets: { ...t.insets } }; });
    rec.viewport = vp;
    const violations = layout.filter((c) => (
      c.x + c.r > vp.w - vp.insets.right || c.x - c.r < vp.insets.left ||
      c.y + c.r > vp.h - vp.insets.bottom || c.y - c.r < vp.insets.top
    )).map((c) => ({ action: c.action, x: Math.round(c.x), y: Math.round(c.y), r: c.r }));
    rec.controls = layout.length;
    rec.violations = violations;
    await shot(H, `2026-08-08-critic-touch-04-a-44px-cutout-on-both-sides.png`);
    if (!layout.length) fail('C-INSET', 'no controls laid out under the cutout at all', rec);
    else if (!violations.length) pass('C-INSET', `T8 clause 1 measured against a REAL inset for the first time: with M-P17's {0,44,21,44} cutout applied, all ${layout.length} controls stay clear of every inset. Every profile the round ran had insets of ZERO, so its 'insetViolations: 0' was a measurement against nothing.`, rec);
    else fail('C-INSET', `under M-P17's cutout ${violations.length} of ${layout.length} controls sit inside a safe-area inset: ${violations.map((v) => v.action).join(', ')}. T8 clause 1 fails the moment the inset is not zero, which is every notched phone.`, rec);
  } finally { await H.ctx.close(); }
  return rec;
}

// =============================================================================================
// LEG: portrait — the coverage the round declared unmeasured
// =============================================================================================
async function legPortrait() {
  const rec = { profiles: [] };
  for (const prof of [PROFILES.portraitPhone, PROFILES.portraitTablet]) {
    say(`\n-- LEG portrait · ${prof.id} (${prof.kind}) -------------------------------------------`);
    const H = await openPhone(prof, '');
    const g = mk(H);
    const r = { profile: prof };
    try {
      await advance(H, 20);
      const st = await H.page.evaluate(() => {
        const e = window.__ENGINE;
        const v = window.__HARNESS.getViewport ? window.__HARNESS.getViewport() : {};
        return { deviceClass: v.deviceClass, rotate: e.real.viewport.rotateState ? e.real.viewport.rotateState() : null, shown: window.__HARNESS.touchState().shown, controls: window.__HARNESS.touchLayout().length };
      });
      r.portrait = st;
      say(`  .... deviceClass=${st.deviceClass} rotate=${JSON.stringify(st.rotate)} shown=${st.shown} controls=${st.controls}`);
      await shot(H, `2026-08-08-critic-touch-05-${prof.id}.png`);
      // A REAL rotation, no reload.
      await H.page.setViewportSize({ width: prof.h, height: prof.w });
      await advance(H, 15);
      const st2 = await H.page.evaluate(() => {
        const e = window.__ENGINE;
        return { rotate: e.real.viewport.rotateState ? e.real.viewport.rotateState() : null, shown: window.__HARNESS.touchState().shown, controls: window.__HARNESS.touchLayout().length, w: e.real.touch.viewport.w, h: e.real.touch.viewport.h };
      });
      r.after_rotate = st2;
      const id = `C-PORTRAIT-${prof.id}`;
      const cleared = !st2.rotate;
      if (st.rotate && cleared && st2.controls > 0) pass(id, `${prof.kind} in portrait shows the rotate state, and a REAL rotation with no reload clears it and relays out ${st2.controls} controls at ${st2.w}x${st2.h}`, r);
      else if (!st.rotate && st.controls > 0) pass(id, `${prof.kind} in portrait does NOT ask to rotate and lays out ${st.controls} controls in portrait directly`, r);
      else fail(id, `${prof.kind} portrait: rotate=${JSON.stringify(st.rotate)} before, ${JSON.stringify(st2.rotate)} after a real rotation, ${st2.controls} controls. The device is either stuck on the rotate card or has no controls.`, r);
    } finally { await H.ctx.close(); }
    rec.profiles.push(r);
  }
  return rec;
}

// =============================================================================================
const t0 = Date.now();
const legs = LEG === 'all' ? ['fight', 'menu', 'insets', 'portrait'] : [LEG];
try {
  for (const l of legs) {
    if (l === 'fight') out.fight = await legFight();
    else if (l === 'menu') out.menu = await legMenu();
    else if (l === 'insets') out.insets = await legInsets();
    else if (l === 'portrait') out.portrait = await legPortrait();
    else { say(`unknown leg '${l}'`); process.exitCode = 2; }
  }
} catch (e) {
  out.fatal = String(e && e.stack || e);
  say(`\nFATAL ${out.fatal}`);
  process.exitCode = 2;
} finally {
  await browser.close(); await server.close();
  if (NEEDS_PATCH) fs.rmSync(path.join(OUT, 'patched-tree'), { recursive: true, force: true });
}

out.conditions.loadavg_at_end = loadavg();
out.conditions.ms = Date.now() - t0;
// RULES 4: a teardown that turns nothing red proves nothing, and one that turns EVERYTHING red
// proves nothing either. Name the signature check and report collateral separately.
if (ANY_BREAK.length === 1) {
  const sig = SIGNATURE[ANY_BREAK[0]];
  out.teardown_signature = { teardown: ANY_BREAK[0], must_go_red: sig, went_red: out.failures.includes(sig), collateral: out.failures.filter((f) => f !== sig) };
  say(`\n[teardown] --break-${ANY_BREAK[0]} : ${sig} ${out.teardown_signature.went_red ? 'WENT RED (the control works)' : 'STAYED GREEN — THE TEARDOWN IS INERT (RULES 6)'}; collateral ${JSON.stringify(out.teardown_signature.collateral)}`);
}
const name = `critic-fight-${LEG}${ANY_BREAK.length ? '-' + ANY_BREAK.join('-') : ''}.json`;
writeJson(path.join(OUT, name), out);
say(`\npasses ${out.passes.length}: ${out.passes.join(' ')}`);
say(`failures ${out.failures.length}: ${out.failures.join(' ')}`);
say(`artifact ${path.relative(REPO_ROOT, path.join(OUT, name))}`);
if (out.failures.length && !ANY_BREAK.length) process.exitCode = 1;
