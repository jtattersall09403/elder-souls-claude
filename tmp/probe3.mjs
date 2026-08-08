import { parseArgs } from '../tools/lib/cli.mjs';
import { launchGame, requireMethods } from '../tools/lib/browser.mjs';
const args = parseArgs(process.argv.slice(2));
const h = await launchGame(args);
try {
  await requireMethods(h, ['reset','setRenderRate','stepFrames']);
  await h.h('reset'); await h.h('setRenderRate', 0);
  await h.h('stepFrames', 4);
  const r = await h.page.evaluate(() => {
    const E = window.__ENGINE;
    const out = { done: !!E._provinceMarksDone, props: E.sim.props.length };
    E._provinceMarksDone = false;
    try { out.spawned = E._ensureProvinceMarks(); } catch (e) { out.threw = String(e && e.stack || e); }
    out.propsAfter = E.sim.props.length;
    out.sample = E.sim.props.slice(0,3).map(p=>({eid:p.eid,pos:p.pos,site_mark:p.site_mark}));
    // then step and see if they survive
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await h.h('stepFrames', 3);
  const r2 = await h.page.evaluate(() => ({ props: window.__ENGINE.sim.props.length, done: !!window.__ENGINE._provinceMarksDone }));
  console.log('after step:', JSON.stringify(r2));
} finally { await h.close(); }
