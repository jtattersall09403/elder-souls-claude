import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
const h = await launchGame({});
const r = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const keys = Object.keys(H).sort();
  const st = H.getPlayerStats();
  return { version: H.version, keys, statKeys: Object.keys(st) };
});
console.log(JSON.stringify(r, null, 1));
await h.close();
