import { serveDir } from '/home/user/elder-souls-claude/tools/lib/serve.mjs';
import { chromium } from 'playwright';
const { origin, close } = await serveDir('/home/user/elder-souls-claude', { port: 0 });
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0,200)));
p.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,200)); });
await p.goto(`${origin}/docs/play/index.html`, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(9000);
const got = await p.evaluate(() => ({
  harness: typeof window.__HARNESS,
  canvas: !!document.querySelector('canvas'),
  w: document.querySelector('canvas')?.width || 0,
  title: document.title,
}));
console.log(JSON.stringify({ ...got, errors: errs.slice(0,5) }, null, 1));
await b.close(); await close();
