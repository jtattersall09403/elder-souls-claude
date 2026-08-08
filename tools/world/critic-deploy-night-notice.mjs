#!/usr/bin/env node
// critic-deploy-night-notice.mjs — does the boot notice's own "is anything drawn?" test call a
// working night scene undrawn, and refuse to get out of the player's way?
//
// WHY. `game/index.html`'s notice used to hide when `window.__HARNESS` appeared, which is before
// boot resolves, so it flashed and left a black screen. The fix (fa96455) hides on two conditions:
// `ready()` resolving, and `painted()` — `readPixels(0, 0, 64, 64)` on the canvas, non-black if
// more than 1% of that window is lit.
//
// `readPixels(0, 0, …)` is the BOTTOM-LEFT corner of the framebuffer; WebGL's origin is
// bottom-left. Measured on the shipped states of this game at commit 09e11d0, that corner reads
// 0.00% non-black at midnight and 0.02% inside `dungeon_primary`, while the whole frame reads
// 52.9% and 33.3%. So the corner is dark in states where the game is plainly drawing.
//
// If `painted()` is false, the notice never hides. It is `position: fixed; inset: 0; z-index:
// 9999`. A player who loads into a night or an interior would be looking at a full-screen overlay
// reading "The world loaded, but nothing is being drawn" over a game that is drawing — and it
// never goes away. That is the same class of defect as the one it was written to fix, arriving
// from the other side.
//
//   node tools/world/critic-deploy-night-notice.mjs
//   node tools/world/critic-deploy-night-notice.mjs --self-test
//
// Exit 1 if the notice stays up on any state where the frame is demonstrably drawn.
import { chromium } from 'playwright';
import { serveDir } from '../lib/serve.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const selfTest = argv.includes('--self-test');

// `docs/play` is a generated mirror and is currently being removed from the tree, so `game/` is
// the only source that is certainly current. `--dir <path>` serves somewhere else instead, which
// is how this gets pinned to a commit: `git archive <sha> game | tar -x -C <tmp>` and point here.
// A dozen agents commit to this tree; a number taken against "whatever game/ was at the time" is
// not a claim about anything (rule 12).
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DIR = at('--dir', existsSync(join(ROOT, 'game', 'index.html')) ? join(ROOT, 'game') : join(ROOT, 'docs', 'play'));

// The notice's own numbers, restated so a change to either shows up as a diff here.
const NOTICE_WINDOW = 64;
const NOTICE_FRACTION = 0.01;
const NOTICE_GRACE_MS = 6200;   // `sinceBoot > 6` at a 200 ms poll

const CASES = [
  { label: 'default, midday (control)', state: 'default', hour: 12 },
  { label: 'default, midnight',         state: 'default', hour: 0 },
  { label: 'default, 03:00',            state: 'default', hour: 3 },
  { label: 'dungeon_primary',           state: 'dungeon_primary', hour: 12 },
  { label: 'dungeon_primary, night',    state: 'dungeon_primary', hour: 0 },
  { label: 'interior_firelit, night',   state: 'interior_firelit', hour: 0 },
];

// The two readings side by side: the notice's own corner window, and the whole frame. If they
// disagree the notice is deciding "is there a picture" from 0.2% of the picture.
const SAMPLER = `
window.__ns = function () {
  const c = document.querySelector('canvas');
  if (!c) return { canvas: false };
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return { canvas: true, gl: false };
  const lit = (b) => { let n = 0; for (let i = 0; i < b.length; i += 4)
    if (b[i] > 8 || b[i+1] > 8 || b[i+2] > 8) n++; return n; };
  const w = Math.min(c.width, ${NOTICE_WINDOW}), h = Math.min(c.height, ${NOTICE_WINDOW});
  const corner = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, corner);
  const full = new Uint8Array(c.width * c.height * 4);
  gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, full);
  const stride = Math.max(1, Math.floor((c.width * c.height) / 32768));
  let fs = 0, fn = 0;
  for (let px = 0; px < c.width * c.height; px += stride) {
    const i = px * 4; fs++;
    if (full[i] > 8 || full[i+1] > 8 || full[i+2] > 8) fn++;
  }
  return { canvas: true, gl: true, cornerFrac: lit(corner) / (w * h), fullFrac: fn / fs };
};
`;

const { origin, close } = await serveDir(DIR, { port: 0 });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });

async function run(c) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 839 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  // Do NOT touch the canvas before the renderer exists: calling getContext first creates the
  // context with default attributes, THREE inherits it, and every later readPixels returns zero.
  // That is measured, not assumed — see tools/world/critic-deploy-probe.mjs --settle.
  await page.addInitScript(SAMPLER);
  await page.goto(`${origin}/index.html?harness=1&state=${encodeURIComponent(c.state)}`,
    { waitUntil: 'load', timeout: 120000 });
  let note = '';
  try {
    await page.evaluate(async () => {
      for (let i = 0; i < 900 && !window.__HARNESS; i++) await new Promise((r) => setTimeout(r, 100));
      await window.__HARNESS.ready();
    });
    await page.evaluate(async (h) => {
      if (window.__HARNESS.setTimeOfDay) window.__HARNESS.setTimeOfDay(h);
      window.__HARNESS.stepFrames(60);
    }, c.hour);
  } catch (e) { note = String(e.message || e).slice(0, 60); }
  // Wait past the notice's own 6-second grace so its verdict is final, not in progress.
  await page.waitForTimeout(NOTICE_GRACE_MS + 2000);
  const out = await page.evaluate(() => {
    const s = window.__ns();
    const n = document.getElementById('boot-notice');
    return { ...s,
      noticeUp: !!n && n.className !== 'gone',
      noticeText: (n && n.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 110) };
  }).catch(() => ({ canvas: false, noticeUp: true, noticeText: '(page unreadable)' }));
  await ctx.close();
  return { ...c, ...out, note };
}

try {
  if (selfTest) {
    // Rule 4, and the arm that matters is the one that shows the two readings CAN disagree —
    // if they never disagree, every row below is a tautology. Midday is the agreeing case;
    // midnight is the disagreeing one. Require both to behave as claimed before reporting.
    const day = await run(CASES[0]);
    const night = await run(CASES[1]);
    const armA = day.gl && day.cornerFrac > NOTICE_FRACTION;             // corner lit by day
    const armB = night.gl && night.fullFrac > 0.2;                        // the frame IS drawn at night
    const armC = night.cornerFrac < day.cornerFrac;                       // and the corner is darker
    const ok = armA && armB && armC;
    console.log('critic-deploy-night-notice --self-test:');
    console.log(`  midday corner lit                  ${(day.cornerFrac * 100).toFixed(2)}%  -> ${armA}`);
    console.log(`  midnight frame is genuinely drawn   ${(night.fullFrac * 100).toFixed(2)}%  -> ${armB}`);
    console.log(`  midnight corner darker than midday  ${(night.cornerFrac * 100).toFixed(2)}% < ${(day.cornerFrac * 100).toFixed(2)}%  -> ${armC}`);
    console.log(ok ? '  PASS — the corner and the frame can disagree, so a red row below means something.'
                   : '  FAIL — no disagreement to measure; this instrument would report a tautology.');
    await browser.close(); await close();
    process.exit(ok ? 0 : 1);
  }

  console.log(`critic-deploy-night-notice: serving ${DIR.replace(ROOT + '/', '')}`);
  console.log(`  the notice calls the frame drawn if >${NOTICE_FRACTION * 100}% of readPixels(0,0,${NOTICE_WINDOW},${NOTICE_WINDOW}) is lit.`);
  console.log('');
  console.log('     state                       corner%   whole frame%   notice');
  const rows = [];
  let bad = 0, unmeasured = 0;
  for (const c of CASES) {
    const r = await run(c);
    rows.push(r);
    // A state whose frame is black everywhere did not boot — the engine threw, or the data is
    // broken — and this instrument has measured NOTHING about the notice there. The first version
    // of this tool counted that as a clean row and printed PASS over six states that never drew a
    // pixel, which is a fail-open of exactly the kind the round is about. It is `not_run` now.
    const measured = r.gl && r.fullFrac >= 0.02;
    if (!measured) unmeasured++;
    const wrong = measured && r.noticeUp;
    if (wrong) bad++;
    const tag = wrong ? 'GAP ' : measured ? ' ok ' : 'n/m ';
    console.log(`   ${tag} ${r.label.padEnd(24)} ${(r.cornerFrac * 100).toFixed(2).padStart(7)}   ` +
      `${(r.fullFrac * 100).toFixed(2).padStart(9)}      ${r.noticeUp ? 'STILL UP' : 'hidden'}${r.note ? '  (' + r.note + ')' : ''}`);
    if (wrong) console.log(`        over a drawn frame, the player is reading: "${r.noticeText}"`);
    if (!measured) console.log('        NOT MEASURED — the frame is black everywhere, so the world never came up here.');
  }
  console.log('');
  if (unmeasured === CASES.length) {
    console.log('critic-deploy-night-notice: NOT RUN — no state drew anything, so the build under');
    console.log('  test does not boot. This says nothing about the notice. Fix the build and re-run.');
    process.exit(2);
  }
  if (unmeasured) console.log(`  ${unmeasured} of ${CASES.length} state(s) could not be measured and are excluded.`);
  console.log(bad ? `critic-deploy-night-notice: FAIL — ${bad} state(s) draw a picture and keep the overlay.`
                  : 'critic-deploy-night-notice: PASS — the notice cleared on every state that draws.');
  process.exit(bad ? 1 : 0);
} finally {
  await browser.close();
  await close();
}
