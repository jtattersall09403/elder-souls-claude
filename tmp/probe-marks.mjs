import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../tools/lib/cli.mjs';
import { launchGame, requireMethods } from '../tools/lib/browser.mjs';
const args = parseArgs(process.argv.slice(2));
const h = await launchGame(args);
try {
  await requireMethods(h, ['reset','setRenderRate','whereAmI','teleport','stepFrames','listEntities','enterInterior','exitInterior']);
  await h.h('reset'); await h.h('setRenderRate', 0);
  console.log('where0', JSON.stringify(await h.h('whereAmI')));
  await h.h('stepFrames', 4);
  console.log('where1', JSON.stringify(await h.h('whereAmI')));
  let ents = await h.h('listEntities');
  console.log('marks before teleport:', ents.filter(e=>String(e.eid).startsWith('mark:')).length, 'props total', ents.filter(e=>e.kind==='object').length);
  await h.h('teleport', 639, 4891);
  await h.h('stepFrames', 6);
  console.log('where2', JSON.stringify(await h.h('whereAmI')));
  ents = await h.h('listEntities');
  console.log('marks after teleport:', ents.filter(e=>String(e.eid).startsWith('mark:')).map(e=>e.eid).slice(0,10));
  await h.h('enterInterior','helstrom-undertemple');
  await h.h('stepFrames', 3);
  ents = await h.h('listEntities');
  console.log('interior marks:', ents.filter(e=>String(e.eid).startsWith('mark:')).map(e=>e.eid));
} finally { await h.close(); }
