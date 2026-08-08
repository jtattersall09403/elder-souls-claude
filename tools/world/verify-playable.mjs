#!/usr/bin/env node
// verify-playable.mjs — is there a picture on the screen, on the devices people actually hold?
//
// WHY THIS EXISTS. The owner opened the published game on a phone and got a black rectangle. The
// check that was supposed to have caught that — `verify-published-game.mjs` — had passed, because
// it asserted a canvas existed with non-zero dimensions and no page errors. All three were true of
// the black screen. It measured something adjacent to the thing that matters.
//
// The thing that matters is: **are there pixels a person can see, on a viewport they own.** So this
// reads the framebuffer and counts non-black pixels, at four viewports, and fails if the boot
// notice is still covering the page.
//
// It also fails on a 4xx/5xx for any request the page makes. A missing file on a static host does
// not throw — the fetch resolves and the caller quietly gets nothing — which is the single most
// likely cause of a silent black screen and the one a page-error check cannot see.
//
//   node tools/world/verify-playable.mjs                 # the local docs/play copy
//   node tools/world/verify-playable.mjs --game          # the source tree at game/
//   node tools/world/verify-playable.mjs --self-test     # prove it can go red
//
// Exit 0 only if every viewport drew something.
import { chromium, devices } from 'playwright';
import { serveDir } from '../lib/serve.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const selfTest = argv.includes('--self-test');
const useGame = argv.includes('--game');

// Four shapes, chosen because each has broken something in some project at some point: a desktop,
// a portrait phone, the same phone in landscape (which is how anyone actually plays), and a tablet.
const VIEWPORTS = [
  { name: 'desktop',        width: 1440, height: 900,  isMobile: false },
  { name: 'phone-portrait', width: 412,  height: 839,  isMobile: true, deviceScaleFactor: 2.6 },
  { name: 'phone-landscape',width: 839,  height: 412,  isMobile: true, deviceScaleFactor: 2.6 },
  { name: 'tablet',         width: 820,  height: 1180, isMobile: true, deviceScaleFactor: 2 },
];

// A frame is "drawn" if a meaningful share of sampled pixels are not the near-black the page paints
// before the first render. 2% is deliberately low: a night scene is mostly dark, and the failure we
// are catching is *nothing at all*, not *dim*.
const MIN_NONBLACK_FRACTION = 0.02;

async function measure(browser, origin, vp, { breakPage } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor || 1,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    userAgent: vp.isMobile
      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36'
      : undefined,
  });
  const page = await ctx.newPage();
  const errors = [], badRequests = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) badRequests.push(`${r.status()} ${r.url().split('/').slice(-2).join('/')}`); });
  page.on('requestfailed', (r) => badRequests.push(`${r.failure()?.errorText} ${r.url().split('/').slice(-2).join('/')}`));

  // The sabotage arm: block the renderer so the page cannot draw. This is what a real missing
  // asset looks like from the page's side, and the check must fail on it.
  if (breakPage) await page.route('**/three.module.js', (route) => route.abort());

  await page.goto(`${origin}/index.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(15000);

  const read = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const notice = document.getElementById('boot-notice');
    const noticeVisible = !!notice && notice.className !== 'gone';
    const noticeText = noticeVisible ? (notice.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    if (!c) return { canvas: false, noticeVisible, noticeText };
    let nonblack = 0, sampled = 0;
    try {
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl) {
        const w = Math.min(c.width, 160), h = Math.min(c.height, 160);
        const buf = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        sampled = w * h;
        for (let i = 0; i < buf.length; i += 4) if (buf[i] > 8 || buf[i + 1] > 8 || buf[i + 2] > 8) nonblack++;
      }
    } catch { /* reported as sampled 0 below */ }
    return { canvas: true, cw: c.width, ch: c.height, clientW: c.clientWidth, clientH: c.clientHeight,
             sampled, nonblack, noticeVisible, noticeText };
  });
  await ctx.close();

  const fraction = read.sampled ? read.nonblack / read.sampled : 0;
  const drew = read.canvas && read.sampled > 0 && fraction >= MIN_NONBLACK_FRACTION;
  // The canvas must also actually fill the viewport — a 1-pixel canvas draws "something" and is
  // still a black screen to the person holding the phone.
  const fills = read.clientW >= vp.width * 0.9 && read.clientH >= vp.height * 0.5;
  return { vp: vp.name, drew, fills, fraction: +fraction.toFixed(4), ...read, errors, badRequests,
           ok: drew && fills && !read.noticeVisible && errors.length === 0 && badRequests.length === 0 };
}

const dir = useGame ? join(ROOT, 'game') : join(ROOT, 'docs', 'play');
const { origin, close } = await serveDir(dir, { port: 0 });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });

let failed = 0;
if (selfTest) {
  // Rule 4: a probe that cannot fail is worse than no probe. Break the renderer and require red.
  console.log('verify-playable --self-test: breaking the renderer on purpose; every row must FAIL.');
  for (const vp of VIEWPORTS) {
    const r = await measure(browser, origin, vp, { breakPage: true });
    const red = !r.ok;
    console.log(`  ${red ? 'GOES-RED' : 'STAYED GREEN'}  ${vp.name.padEnd(16)} nonblack ${String(r.fraction).padEnd(7)} notice="${r.noticeText || ''}"`);
    if (!red) failed++;
  }
  console.log(failed ? `verify-playable --self-test: FAILED — ${failed} viewport(s) passed a broken page.`
                     : 'verify-playable --self-test: PASS — the check goes red on a page that cannot draw.');
} else {
  for (const vp of VIEWPORTS) {
    const r = await measure(browser, origin, vp);
    if (!r.ok) failed++;
    console.log(`  ${r.ok ? 'DREW' : 'BLANK'}  ${vp.name.padEnd(16)} ${r.clientW}x${r.clientH}  nonblack ${(r.fraction * 100).toFixed(1)}%` +
      (r.noticeVisible ? `  NOTICE STILL UP: "${r.noticeText}"` : '') +
      (r.badRequests.length ? `  BAD: ${r.badRequests.slice(0, 2).join(', ')}` : '') +
      (r.errors.length ? `  ERR: ${r.errors[0]}` : ''));
  }
  console.log(failed ? `verify-playable: FAIL — ${failed} of ${VIEWPORTS.length} viewport(s) showed no picture.`
                     : `verify-playable: PASS — a picture on all ${VIEWPORTS.length} viewports.`);
}

await browser.close();
await close();
process.exit(failed ? 1 : 0);
