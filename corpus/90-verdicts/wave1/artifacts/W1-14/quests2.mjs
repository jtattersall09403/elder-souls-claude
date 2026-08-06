import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const r = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const qs = H.getQuestState();
  return { questState: qs, quest_related_harness_calls: Object.keys(H).filter(k=>/quest|journal|resolve|stage/i.test(k)) };
});
fs.writeFileSync('/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-14/quest-runtime-absence.json', JSON.stringify(r,null,1));
console.log(JSON.stringify(r.questState._declared_incomplete));
await h.close();
