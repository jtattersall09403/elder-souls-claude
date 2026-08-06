#!/usr/bin/env node
// kritik-consume.mjs — the remaining RI-MTH07 pairs: derived cover, the fence, the guard band.
import { parseArgs, wantsHelp, usage, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';
const args = parseArgs(); if (wantsHelp(args)) usage('kritik-consume.mjs\n');
args.width = args.width || 320; args.height = args.height || 240;
const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'consume', blocks: {} };
const rec = (k, v) => { R.blocks[k] = v; process.stdout.write(`--- ${k}\n${JSON.stringify(v, null, 1)}\n`); };
try {
  await h.h('setRenderRate', 0);
  const cov = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setStealthState({ sneak: 5, load: 'medium', zone: 'zcv' });
    H.setZoneAmbient('zcv', 0.35);
    H.setPlayerMotion('walk');
    out.open_field = H.coverAt(0, 0, 0);
    // an alcove: three walls round the origin
    H.addOccluder({ id: 'a1', min: [-2, 0, 1.2], max: [2, 3, 1.6] });
    H.addOccluder({ id: 'a2', min: [1.2, 0, -2], max: [1.6, 3, 2] });
    H.addOccluder({ id: 'a3', min: [-1.6, 0, -2], max: [-1.2, 3, 2] });
    out.alcove = H.coverAt(0, 0, 0);
    H.stepFrames(12);
    out.state_in_alcove = H.getStealthState();
    H.teleport(30, 30);
    H.stepFrames(12);
    out.state_outside = H.getStealthState();
    return out;
  });
  rec('B28-cover-derived', cov);

  const fence = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setStealthState({ sneak: 5, load: 'medium', zone: 'zf', mercantile: 50, speechcraft: 40 });
    const z = H.listPropertyZones().find((x) => x.objects >= 2);
    const objs = H.listOwnedObjects(z.id);
    H.takeObject(objs[0].instance);
    out.registry_before = H.getCrimeState().stolen_registry;
    const cs = H.getCrimeState();
    out.crime_state_keys = Object.keys(cs);
    // find a fence id from the data surface
    out.fence_quote_try = (() => { try { return H.fenceQuote('x', {}); } catch (e) { return String(e.message || e); } })();
    for (const id of ['fence_gideon', 'gideon_fence', 'fence_marsh', 'fence0']) {
      try { out['sell_' + id] = H.fenceSell(id, objs[0].instance); break; }
      catch (e) { out['sell_' + id] = String(e.message || e); }
    }
    out.registry_after = H.getCrimeState().stolen_registry;
    return out;
  });
  rec('B29-fence', fence);

  const gb = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = { runs: [] };
    for (const bounty of [0, 3000]) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
      H.setTimeOfDay(12);
      H.setStealthState({ sneak: 5, load: 'medium', zone: 'zgb', race: 'imperial' });
      H.setZoneAmbient('zgb', 1.0);
      H.setPlayerMotion('still');
      H.setBounty('imperial', bounty);
      H.spawnGuard({ eid: 'gq', pos: [0, 0, 5], yaw: 180 });
      H.spawn('guard_legion', 0, 5, { as: 'gq', yaw: 180 });
      H.stepFrames(5);
      const ev = H.drainStealthEvents().filter((e) => e.type === 'guard_band');
      out.runs.push({ bounty, guard_band_events: ev, entity: H.perceptionState().find((x) => x.eid === 'gq') });
    }
    return out;
  });
  rec('B30-guard-band-coupling', gb);
  rec('page_errors', h.errors);
} finally {
  if (args.json) writeJson(String(args.json), R);
  await h.close();
}
