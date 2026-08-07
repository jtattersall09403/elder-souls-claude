import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const h = await launchGame(parseArgs());
const r = await h.page.evaluate(async () => { const H = window.__HARNESS; await H.ready(); H.loadState('arena_flat'); return { ok: true, frame: H.getFrame(), v: H.version }; });
console.log(JSON.stringify(r));
await h.close();
