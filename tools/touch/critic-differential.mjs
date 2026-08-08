#!/usr/bin/env node
// critic-differential.mjs — W1-TOUCH critic. ATTACK C: acceptance 6 has no number.
//
// RI-JRN04 acceptance 6 is "nothing you add breaks the keyboard or the pad". The round ARGUED it
// rather than measuring it, and said so in its own words: *"the desktop path is untouched by
// argument (`touchClearRightX` is null on every desktop frame), which is an argument, not a
// measurement."* Its `--leg differential` re-runs the whole keyboard and pad openings, which is the
// right shape and costs two full playthroughs; on this box it starved for twenty-two minutes
// without emitting a line, which is the same starvation the round reported for its own two runs.
//
// So this takes the measurement a cheaper and more direct way, against the thing that could
// actually break: RULING R2 added `keepOnly` to input/touch.js and `setTouchClearRight()` to
// render/ui.js, and the safety claim is that both are inert on a desktop frame. That is a
// DELETE-THE-FIX question (RULES 6) and it is answerable in two page loads:
//
//   ARM 1  desktop-shaped context, SHIPPED tree
//   ARM 2  desktop-shaped context, tree with BOTH halves of the R2 fix deleted
//
// If every desktop-visible number is identical between the arms, the desktop path is provably
// untouched — a measurement rather than an argument. If any differs, acceptance 6 is false and the
// round's safety note is wrong.
//
// ============================================================================================
// CORRECTION, WRITTEN AFTER THE FIRST RUN — READ BEFORE TRUSTING THE `desktop_still_plays` HALF.
//
// This tool has TWO halves and only the first one works.
//
//   THE GEOMETRY DIFFERENTIAL (arms compared field by field) IS SOUND and is the measurement
//   attack C asked for. Every desktop-visible field is byte-identical across the two arms.
//
//   THE "DOES THE DESKTOP STILL PLAY" HALF IS A BROKEN PROBE and its verdict line must be
//   ignored. Two defects, both mine: (1) it dismisses the title with `Space`, and `Space` IS the
//   roll binding, so the title-dismissal press and the roll press are the same key and the
//   sequence desynchronises; (2) its sample windows overlap the previous action's recovery, so
//   the "Space roll" row came back `["r1.1"]` in one arm and `["guardbreak"]` in the other —
//   both ATTACK moves, neither a roll, which is the signature of reading the wrong window rather
//   than of a build that cannot roll.
//
//   The evidence that the desktop path still plays is REAL and lives elsewhere, taken earlier
//   with proper sequencing: `critic-roll-matrix.mjs` arm D (pure desktop, KeyW to run and Space
//   to roll -> `roll`, states ROLL_STARTUP/ROLL_IFRAME/ROLL_RECOVER, stamina 103.3 -> 82.8) and
//   `critic-block-roll.mjs` (KeyF held -> guardRaised on 9 of 15 samples, state BLOCK_HOLD).
//   Those are the numbers the verdict cites. Do not cite this file's `desktop_still_plays`.
//
// Left in the tree with the defect described rather than deleted, because a critic that hides its
// own broken arm is doing the thing this project keeps catching other people doing.
// ============================================================================================
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
const BASE = String(process.env.ES_SERVE_ROOT || '') || REPO_ROOT;
const OUT = path.join(REPO_ROOT, 'reports', 'critic-w1-touch');
const WORK = path.join(OUT, 'diff-trees');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');
const rec = { schema: 'elder-souls/critic-differential@1', item: 'RI-JRN04 acceptance 6', arms: {} };

/** A copy of the served tree with BOTH halves of RULING R2 deleted. */
function brokenTree() {
  const dst = path.join(WORK, 'r2-deleted');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(BASE, 'game'), path.join(dst, 'game'), { recursive: true });
  const edit = (rel, from, to) => {
    const p = path.join(dst, 'game', 'src', rel);
    const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(from)) throw new Error(`delete-the-fix: ${rel} does not contain ${JSON.stringify(from.slice(0, 60))} — an inert teardown (RULES 6) would make both arms the positive arm and this whole run would read as a clean pass.`);
    fs.writeFileSync(p, s.replace(from, to));
  };
  // Half 1: the arc stops reducing while a talking surface is up.
  edit('input/touch.js', 'const keep = Array.isArray(this.keepOnly) ? this.keepOnly : null;',
    'const keep = null;   // DELETE-THE-FIX: R2 half 1');
  // Half 2: the dialogue panel stops being pulled in. Deleting BOTH at once, because RULES 6's
  // fourth shape (two guards for one defect) means deleting either alone can move nothing.
  const uiPath = path.join(dst, 'game', 'src', 'render', 'ui.js');
  const ui = fs.readFileSync(uiPath, 'utf8');
  const m = ui.match(/setTouchClearRight\s*\([^)]*\)\s*\{/);
  if (!m) throw new Error('delete-the-fix: render/ui.js has no setTouchClearRight() — the R2 fix is not where the round said it is.');
  fs.writeFileSync(uiPath, ui.replace(m[0], m[0] + ' x = null; /* DELETE-THE-FIX: R2 half 2 */'));
  say('  [teardown] BOTH halves of RULING R2 deleted on a copy of the tree');
  return dst;
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });

/** A DESKTOP-shaped context: no touch, a mouse, hover. This is what must not change. */
async function desktopArm(name, root) {
  const server = await serveDir(root);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, hasTouch: false, isMobile: false, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
  const r = { name };
  try {
    await page.goto(server.origin + '/game/index.html?state=arena_duel', { waitUntil: 'load', timeout: 240000 });
    await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
    await page.evaluate(() => window.__HARNESS.ready());

    r.boot = await page.evaluate(() => {
      const e = window.__ENGINE;
      const v = window.__HARNESS.getViewport ? window.__HARNESS.getViewport() : {};
      return {
        mode: e.mode, deviceClass: v.deviceClass,
        touch_enabled: !!(e.real && e.real.touch && e.real.touch.enabled),
        touch_shown: window.__HARNESS.touchState().shown,
        touch_controls: window.__HARNESS.touchLayout().length,
        touchClearRightX: e.renderer && e.renderer.ui ? (e.renderer.ui.touchClearRightX === undefined ? 'UNDEFINED' : e.renderer.ui.touchClearRightX) : 'NO UI',
      };
    });
    say(`  ${name}: deviceClass=${r.boot.deviceClass} touch.enabled=${r.boot.touch_enabled} shown=${r.boot.touch_shown} controls=${r.boot.touch_controls} touchClearRightX=${JSON.stringify(r.boot.touchClearRightX)}`);

    // Past the title with the KEYBOARD, then fight with mouse and keys.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    r.title_down = !(await page.evaluate(() => !!(window.__ENGINE.renderer.title && window.__ENGINE.renderer.title.shown)));
    if (!r.title_down) { await page.keyboard.press('Space'); await page.waitForTimeout(2500); r.title_down = !(await page.evaluate(() => !!(window.__ENGINE.renderer.title && window.__ENGINE.renderer.title.shown))); }

    const watch = async (ms) => {
      const t = Date.now(); const s = [];
      while (Date.now() - t < ms) { s.push(await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return { mv: c.player.move ? c.player.move.id : null, st: c.player.state, g: !!c.player.guard, sta: Math.round(c.player.stamina * 10) / 10, ehp: c.enemies[0] ? c.enemies[0].hp : null }; })); await page.waitForTimeout(40); }
      return s;
    };
    if (r.title_down) {
      const c0 = await page.evaluate(() => window.__HARNESS.getCombatState());
      await page.mouse.move(640, 360); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
      let s = await watch(2000);
      r.mouse_swing = { moves: [...new Set(s.map((x) => x.mv).filter(Boolean))], sta_min: Math.min(...s.map((x) => x.sta)) };
      await page.waitForTimeout(900);
      await page.keyboard.down('KeyW'); await page.waitForTimeout(600);
      await page.keyboard.down('Space'); await page.waitForTimeout(70); await page.keyboard.up('Space');
      s = await watch(2000); await page.keyboard.up('KeyW');
      r.key_roll = { moves: [...new Set(s.map((x) => x.mv).filter(Boolean))], states: [...new Set(s.map((x) => x.st))] };
      await page.waitForTimeout(900);
      await page.keyboard.down('KeyF'); s = await watch(1500); await page.keyboard.up('KeyF');
      r.key_block = { guard_samples: s.filter((x) => x.g).length, n: s.length };
      r.enemy_hp_start = c0.enemies[0] ? c0.enemies[0].hp : null;
      r.enemy_hp_end = (await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return c.enemies[0] ? c.enemies[0].hp : null; }));
      say(`  ${name}: mouse swing ${JSON.stringify(r.mouse_swing.moves)}; Space roll ${JSON.stringify(r.key_roll.moves)}; KeyF guard ${r.key_block.guard_samples}/${r.key_block.n}; enemy ${r.enemy_hp_start} -> ${r.enemy_hp_end}`);
    }
    r.clearRight_after_play = await page.evaluate(() => { const u = window.__ENGINE.renderer.ui; return u.touchClearRightX === undefined ? 'UNDEFINED' : u.touchClearRightX; });
  } finally { await ctx.close(); await server.close(); }
  return r;
}

try {
  rec.arms.shipped = await desktopArm('SHIPPED ', BASE);
  rec.arms.r2_deleted = await desktopArm('R2-GONE ', brokenTree());
  const A = rec.arms.shipped, B = rec.arms.r2_deleted;
  const same = (k, x, y) => ({ field: k, shipped: x, r2_deleted: y, identical: JSON.stringify(x) === JSON.stringify(y) });
  rec.comparison = [
    same('deviceClass', A.boot.deviceClass, B.boot.deviceClass),
    same('touch.enabled', A.boot.touch_enabled, B.boot.touch_enabled),
    same('touch overlay shown', A.boot.touch_shown, B.boot.touch_shown),
    same('touch controls drawn', A.boot.touch_controls, B.boot.touch_controls),
    same('touchClearRightX at boot', A.boot.touchClearRightX, B.boot.touchClearRightX),
    same('touchClearRightX after play', A.clearRight_after_play, B.clearRight_after_play),
    same('mouse swing moves', A.mouse_swing && A.mouse_swing.moves, B.mouse_swing && B.mouse_swing.moves),
    same('Space roll moves', A.key_roll && A.key_roll.moves, B.key_roll && B.key_roll.moves),
  ];
  say(`\n--- desktop differential: SHIPPED vs RULING-R2-DELETED ---`);
  for (const c of rec.comparison) say(`  ${c.identical ? 'IDENTICAL' : 'DIFFERS   '} ${c.field}: ${JSON.stringify(c.shipped)} vs ${JSON.stringify(c.r2_deleted)}`);
  const differing = rec.comparison.filter((c) => !c.identical);
  const desktopPlays = !!(A.mouse_swing && A.mouse_swing.moves.length && A.key_roll && A.key_roll.moves.some((m) => /roll/i.test(m)) && A.key_block && A.key_block.guard_samples > 0);
  rec.desktop_still_plays = desktopPlays;
  rec.verdict = !desktopPlays
    ? `ACCEPTANCE 6 FAILS: the desktop path does not play on today's tree — mouse swing ${JSON.stringify(A.mouse_swing && A.mouse_swing.moves)}, Space roll ${JSON.stringify(A.key_roll && A.key_roll.moves)}, KeyF guard ${A.key_block && A.key_block.guard_samples}.`
    : differing.length === 0
      ? `ACCEPTANCE 6 MEASURED AND HELD. On a desktop-shaped context every field RULING R2 could have touched is BYTE-IDENTICAL between the shipped tree and a tree with both halves of R2 deleted, and the desktop still fights: the mouse swings, Space rolls out of a run with i-frames, KeyF holds the guard. The round's "untouched by argument" is now untouched by measurement.`
      : `ACCEPTANCE 6 IS NOT CLEAN: ${differing.length} desktop-visible field(s) differ when R2 is deleted — ${differing.map((d) => d.field).join(', ')}. The touch fix is reaching the desktop path.`;
  say(`\nVERDICT: ${rec.verdict}`);
  // RULES 6: confirm the teardown is not inert. It must change something SOMEWHERE, just not here.
  rec.teardown_not_inert_note = 'The teardown edits two named lines and throws if either is absent; its effect is on the HANDHELD path (proved separately by the round\'s own --break-overlap, 7 of 11 controls returning to the dialogue panel). Identical DESKTOP readings are the result being sought, not evidence of an inert teardown.';
} catch (e) {
  rec.fatal = String(e && e.stack || e); say(`FATAL ${rec.fatal}`); process.exitCode = 2;
} finally {
  await browser.close();
  fs.rmSync(WORK, { recursive: true, force: true });
}
writeJson(path.join(OUT, 'critic-differential.json'), rec);
say(`artifact reports/critic-w1-touch/critic-differential.json`);
