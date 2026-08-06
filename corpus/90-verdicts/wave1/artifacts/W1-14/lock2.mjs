import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
const h = await launchGame({});
const r = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  H.setSeed(1337);H.loadState('arena_flat');
  const out={};
  try { H.lockBegin('zzz'); } catch(e) { out.err=String(e.message).slice(0,400); }
  return out;
});
console.log(JSON.stringify(r,null,1).slice(0,1200));
await h.close();
