import { chromium } from 'playwright';
import { serveDir } from './lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from './lib/browser.mjs';
const server = await serveDir('/home/user/elder-souls-claude');
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.addInitScript(() => { Object.defineProperty(navigator,'webdriver',{get:()=>false,configurable:true}); });
await page.goto(server.origin + '/game/index.html?mode=play-instrumented&title=1', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
await page.evaluate(() => window.__HARNESS.ready());
console.log(await page.evaluate(() => {
  const e = window.__ENGINE;
  return { ui_mode: e.ui ? e.ui.mode : null, ui_keys: e.ui ? Object.keys(e.ui).slice(0,30) : null,
           uiModel: e.renderer && e.renderer.ui ? Object.keys(e.renderer.ui) .slice(0,25): null };
}));
// start a new game and get to the census, using harness (this is a DIAGNOSTIC spike, not a measurement)
await page.evaluate(() => { window.__HARNESS.titleActivate ? window.__HARNESS.titleActivate('new') : null; });
await page.evaluate(() => window.__HARNESS.stepFrames(60));
console.log('after new:', await page.evaluate(() => ({ ui_mode: window.__ENGINE.ui.mode, node: window.__ENGINE.census && window.__ENGINE.census.state ? window.__ENGINE.census.state().node : null })));
// force the census open
await page.evaluate(() => { const e=window.__ENGINE; e.sim.player.pos[0]=e.sim.npcs[0].pos[0]; e.sim.player.pos[2]=e.sim.npcs[0].pos[2]-1; });
await page.evaluate(() => window.__HARNESS.queueInputs([{f:1,press:['interact']},{f:2,release:['interact']}]));
await page.evaluate(() => window.__HARNESS.stepFrames(40));
console.log('at census:', await page.evaluate(() => {
  const e = window.__ENGINE;
  const m = e.renderer && e.renderer.ui ? e.renderer.ui.model : null;
  return { ui_mode: e.ui.mode, takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
           model_keys: m ? Object.keys(m) : null, model_kind: m ? m.kind : null,
           box: m && m.box ? m.box : null,
           uiRect: e.renderer && e.renderer.ui && e.renderer.ui.lastRect ? e.renderer.ui.lastRect : null };
}));
await ctx.close(); await browser.close(); await server.close();
