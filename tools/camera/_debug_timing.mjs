import { launchGame } from '../lib/browser.mjs';
import { startOpening } from '../lib/opening.mjs';

const t0 = Date.now();
const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720 });
console.log('launched', Date.now() - t0);
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
console.log('ready', Date.now() - t0);
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: 320, h: 180 });
console.log('resized', Date.now() - t0);
const opening = await startOpening(g, { start: 'debug', label: 'debug-timing' });
console.log('opened', Date.now() - t0, JSON.stringify(opening));

let t = Date.now();
await g.h('stepFrames', 1);
console.log('stepFrames(1)', Date.now() - t); t = Date.now();

const r1 = await g.page.evaluate(() => {
  const t0 = performance.now();
  window.__ENGINE.loop.renderNow();
  return performance.now() - t0;
});
console.log('renderNow()', Date.now() - t, 'in-page ms', r1); t = Date.now();

const r2 = await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  const t0 = performance.now();
  R.three.render(R.scene, R.camera);
  const t1 = performance.now();
  const c = R.three.domElement;
  const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height;
  cv.getContext('2d').drawImage(c, 0, 0);
  const t2 = performance.now();
  const data = cv.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const t3 = performance.now();
  return { render_ms: t1 - t0, draw_ms: t2 - t1, getImageData_ms: t3 - t2, total: t3 - t0 };
});
console.log('raw render+read', Date.now() - t, JSON.stringify(r2));

await g.close();
console.log('total', Date.now() - t0);
process.exit(0);
