import { launchGame } from '../lib/browser.mjs';
import { startOpening } from '../lib/opening.mjs';

const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720 });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: 96, h: 54 });
await startOpening(g, { start: 'debug', label: 'debug-timing2' });
await g.h('stepFrames', 1);

const r = await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  const gl = R.three.getContext();
  const w = R.three.domElement.width, h = R.three.domElement.height;
  const t0 = performance.now();
  R.three.render(R.scene, R.camera);
  const t1 = performance.now();
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const t2 = performance.now();
  // second call, warm
  R.three.render(R.scene, R.camera);
  const t3 = performance.now();
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const t4 = performance.now();
  return { w, h, render1: t1 - t0, readPixels1: t2 - t1, render2: t3 - t2, readPixels2: t4 - t3 };
});
console.log(JSON.stringify(r));
await g.close();
process.exit(0);
