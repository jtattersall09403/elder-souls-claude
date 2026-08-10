#!/usr/bin/env node
/** Live RI-CHR03 consumer and null-control probe. */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const h = await launchGame({ width: 640, height: 360 });
const result = await h.page.evaluate(() => {
  const H = window.__HARNESS;
  H.setRenderRate(0); H.loadState('default');
  const set = (birthsign, birthsignSecond = null) => {
    H.setCharacter({ race: 'saxhleel', upbringing: 'interior', classId: 'ledger-hand', birthsign, birthsignSecond, givenName: 'Consumer' });
    return { derived: H.getDerivedStats(), player: H.getPlayerStats(), fare: H.travelFare(6900, 'silt-strider'), price: H.getPriceQuote({ group: 'RG-TOWN', base_price: 60, disposition: 50 }) };
  };
  const neutral = set('xan-kheel');
  const control = set('raj-xul');
  const trade = set('deek-xul');
  const dry = set('nu-ixtu');
  H.setAttuned(['spark_dart']); H.setCatalyst('rod'); H.castNow('spark_dart');
  const before = H.getPlayerStats().focus; const rest = H.hearthRest(); const after = H.getPlayerStats().focus;
  const twoDrink = set('kaal-kaal', 'nu-ixtu');
  return { neutral, control, trade, dry: { ...dry, rest: { before, after, event: rest } }, twoDrink };
});
const checks = [
  ['First Tithe changes combat flask inventory', result.control.player.estus === result.neutral.player.estus + 1],
  ['Long Root changes live fare', result.trade.fare < result.control.fare],
  ['Long Root changes merchant quote', JSON.stringify(result.trade.price) !== JSON.stringify(result.control.price)],
  ['Dry Well enlarges live Focus', result.dry.derived.focus_live.focus_max > result.control.derived.focus_live.focus_max],
  ['Dry Well blocks a real hearth refill', result.dry.rest.after === result.dry.rest.before],
  ['Two-Drink halves power and keeps drawback', result.twoDrink.derived.focus_live.focus_max < result.dry.derived.focus_live.focus_max && result.twoDrink.derived.focus_restores_at_hearth === false],
];
await h.close();
const out = { schema: 'elder-souls/w1-07-birthsign-consume@1', commit: process.env.W1_COMMIT || 'WORKTREE', result, checks: checks.map(([id, pass]) => ({ id, pass })) };
const dir = path.join(REPO_ROOT, 'reports/w1-07-r4'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'birthsign-consume.json'), JSON.stringify(out, null, 2) + '\n');
for (const [id, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${id}`);
if (h.errors.length) console.error(h.errors);
process.exit(checks.every(x => x[1]) && !h.errors.length ? 0 : 1);
