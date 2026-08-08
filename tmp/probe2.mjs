import { parseArgs } from '../tools/lib/cli.mjs';
import { launchGame, requireMethods } from '../tools/lib/browser.mjs';
const args = parseArgs(process.argv.slice(2));
const h = await launchGame(args);
try {
  await requireMethods(h, ['reset','setRenderRate','stepFrames','teleport']);
  await h.h('reset'); await h.h('setRenderRate', 0);
  await h.h('stepFrames', 4);
  const r = await h.page.evaluate(() => {
    const E = window.__ENGINE;
    return {
      hasEngine: !!E,
      cell: E ? E.cellFor(E.sim.env) : null,
      drawnKey: E ? E._drawnCellKey : null,
      siteMarks: E && E.data && E.data.siteMarks ? (E.data.siteMarks.marks||[]).length : null,
      worldMarks: E && E.data && E.data.siteMarks ? (E.data.siteMarks.marks||[]).filter(m=>m.at&&m.at.world).length : null,
      done: E ? !!E._provinceMarksDone : null,
      failures: E ? E._provinceMarkFailures : null,
      props: E ? E.sim.props.length : null,
      spawned: E ? E._ensureProvinceMarks() : null,
      propsAfter: E ? E.sim.props.length : null,
    };
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await h.close(); }
