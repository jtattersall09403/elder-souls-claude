import { chromium } from 'playwright';
import { serveDir } from '../lib/serve.mjs';
const { origin, close } = await serveDir('/home/user/elder-souls-claude/docs/play', { port: 0 });
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--no-sandbox'] });
const SAMP = () => {
  const c=document.querySelector('canvas');
  const gl=c.getContext('webgl2')||c.getContext('webgl');
  if(!gl) return 'nogl';
  const w=Math.min(c.width,160),h=Math.min(c.height,160);
  const buf=new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  let n=0; for(let i=0;i<buf.length;i+=4) if(buf[i]>8||buf[i+1]>8||buf[i+2]>8) n++;
  return +(n/(w*h)).toFixed(4);
};
async function run(label, fn) {
  const ctx = await b.newContext({ viewport:{width:412,height:839}, deviceScaleFactor:2.6, isMobile:true, hasTouch:true });
  const p = await ctx.newPage();
  await p.goto(`${origin}/index.html`, { waitUntil:'load', timeout:120000 });
  const r = await fn(p);
  await ctx.close();
  console.log(label.padEnd(52), JSON.stringify(r));
}
// A: at 2s only CALL getContext (no readPixels); then read at 15s
await run('A getContext at 2s (no read), read at 15s', async p => {
  await p.waitForTimeout(2000);
  const early = await p.evaluate(() => { const c=document.querySelector('canvas');
    const gl=c.getContext('webgl2')||c.getContext('webgl');
    return { gl: !!gl, rendererExists: !!(window.__ENGINE && window.__ENGINE.renderer) }; });
  await p.waitForTimeout(13000);
  return { early, at15: await p.evaluate(SAMP) };
});
// B: at 2s do nothing at all; read at 15s  (control)
await run('B nothing at 2s, read at 15s (control)', async p => {
  await p.waitForTimeout(15000); return { at15: await p.evaluate(SAMP) };
});
// C: when does the renderer exist / boot resolve / first nonzero read (separate pages handled outside)
await run('C timeline: harness / renderer / ready', async p => {
  const t = await p.evaluate(async () => {
    const t0 = performance.now(); const marks = {};
    marks.harness = typeof window.__HARNESS;
    await window.__HARNESS.ready();
    marks.readyMs = Math.round(performance.now() - t0);
    marks.renderer = !!(window.__ENGINE && window.__ENGINE.renderer);
    return marks;
  });
  return t;
});
await b.close(); await close();
