#!/usr/bin/env node
// RI-STL02 §6: the fence launders a registered stolen item, for real, with a real fence id.
// The fence roster is NOT reachable through the harness (getCrimeState() omits it and
// fenceQuote throws `no fence "x"`), so the id below comes from game/data/crime/fences.json.
import { parseArgs, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';
const args = parseArgs(); args.width = 320; args.height = 240;
const h = await launchGame(args);
await h.h('setRenderRate', 0);
const r = await h.page.evaluate(() => {
  const H = window.__HARNESS;
  const out = {};
  H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
  H.setStealthState({ sneak: 5, load: 'medium', zone: 'zf', mercantile: 50 });
  const z = H.listPropertyZones().find((x) => x.objects >= 2);
  const objs = H.listOwnedObjects(z.id);
  H.takeObject(objs[0].instance);
  out.before = H.getCrimeState().stolen_registry;
  out.quote = H.fenceQuote('fence.lilmoth.rot-hookline', { value_g: 11, stolen: true, unique: false, owner: objs[0].owner });
  out.sell = H.fenceSell('fence.lilmoth.rot-hookline', objs[0].instance);
  out.after = H.getCrimeState().stolen_registry;
  out.save_after = H.saveState().crime.stolen_registry;
  out.unique_delayed_bounty = H.fenceQuote('fence.lilmoth.rot-hookline', { value_g: 900, stolen: true, unique: true, owner: 'npc:hookline' });
  out.roster_reachable_from_harness = (() => { try { H.fenceQuote('x', {}); return true; } catch (e) { return String(e.message || e); } })();
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 2500));
writeJson('corpus/90-verdicts/wave1/artifacts/W1-15-r2/kritik-fence.json', { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'fence', blocks: r, page_errors: h.errors });
await h.close();
