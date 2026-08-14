#!/usr/bin/env node
// Throwaway diagnosis #3 for W1-MAP-DEFECTS.
//
// #2 showed the walk stops because `requestAnimationFrame` stops firing IN THE PAGE — the loop's
// own `running` is still true, nothing throws, and an independent rAF chain installed by the probe
// freezes on the same frame. That is a statement about the browser, not about the game, and the
// likeliest cause is `--run-all-compositor-stages-before-draw` in `DETERMINISTIC_CHROMIUM_ARGS`:
// it exists to make screenshots deterministic and it stalls BeginFrame on a software rasteriser
// that cannot finish a draw.
//
// So this runs the same key sequence twice — with the stock flags and without that one flag — and
// asks whether the map is reachable. If it is, the freeze is the instrument's and D1's real defect
// is somewhere else; if it is not, the game genuinely stops.
import { launchGame, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const say = (s) => process.stdout.write(s + '\n');
const STALL = '--run-all-compositor-stages-before-draw';

async function leg(label, chromiumArgs) {
  say(`\n== ${label} ==`);
  const h = await launchGame({ width: 640, height: 360, chromiumArgs });
  try {
    await h.page.goto(h.url.replace(/\?.*$/, '') + '?mode=play', { waitUntil: 'load', timeout: 240000 });
    await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 180000 });
    await h.page.evaluate(() => window.__HARNESS.ready());
    await h.page.waitForTimeout(800);
    await h.page.evaluate(() => {
      window.__RAF = 0;
      const beat = () => { window.__RAF++; requestAnimationFrame(beat); };
      requestAnimationFrame(beat);
    });
    const dump = async (l) => {
      const o = await h.page.evaluate(() => {
        const E = window.__ENGINE;
        return { mode: E.ui.mode, rafTicks: E.loop.stats.rafTicks, ourRaf: window.__RAF, paused: E.uiPausedFrames || 0 };
      }).catch((e) => ({ err: String(e && e.message || e).slice(0, 90) }));
      say(`  ${l.padEnd(14)} ${JSON.stringify(o)}`);
      return o;
    };
    await dump('settled');
    await h.page.keyboard.press('KeyM'); await h.page.waitForTimeout(500); await dump('KeyM');
    let reached = false;
    for (let i = 1; i <= 8; i++) {
      await h.page.keyboard.press('Digit3'); await h.page.waitForTimeout(500);
      const o = await dump(`Digit3 #${i}`);
      if (o.mode === 'map') { reached = true; break; }
    }
    say(`  -> map reached: ${reached}`);
    return reached;
  } finally { try { await h.close(); } catch { /* */ } }
}

const stock = await leg('stock DETERMINISTIC_CHROMIUM_ARGS', undefined);
const without = await leg(`without ${STALL}`, DETERMINISTIC_CHROMIUM_ARGS.filter((a) => a !== STALL));
say(`\nstock: map reached ${stock}   ·   without the stall flag: map reached ${without}`);
