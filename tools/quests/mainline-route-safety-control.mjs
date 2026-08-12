#!/usr/bin/env node
// W1-19 route-detour red/delete control. It executes the shipped population-placement consumer
// on the green tree, on an isolated copy with that consumer's relocation deleted, and again on
// the restored green tree. No player, quest, topic, reveal, entity, or save state is mutated.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args) || !args.out) usage('mainline-route-safety-control.mjs --out <report.json> [--chromium <path>]');
const root = process.cwd();
const outPath = path.resolve(String(args.out));
const scratch = path.join(path.dirname(outPath), 'route-safety-control-copy');
const sourcePath = path.join(root, 'game/src/world/population.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const posts = JSON.parse(fs.readFileSync(path.join(root, 'game/data/world/population-posts.json'))).posts;
const roads = JSON.parse(fs.readFileSync(path.join(root, 'game/data/world/roads.json'))).legs;
const roadById = new Map(roads.map((leg) => [leg.id, leg]));
const roadDistance = (post, q) => {
  const leg = roadById.get(post.leg); let best = Infinity;
  for (let i = 1; i < leg.points.length; i++) {
    const a=leg.points[i-1],b=leg.points[i],dx=b[0]-a[0],dz=b[1]-a[1],d2=dx*dx+dz*dz||1;
    const t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/d2));
    best=Math.min(best,Math.hypot(q[0]-(a[0]+dx*t),q[1]-(a[1]+dz*t)));
  }
  return best;
};

async function consume(entry, ids) {
  const handle = await launchGame({ ...args, entry, width:320, height:240, timeout:Number(args.timeout || 180000) });
  try {
    return await handle.page.evaluate(async (postIds) => {
      const H=window.__HARNESS; await H.ready(); H.setRenderRate(0);
      return postIds.map((id) => H.getPopulationPostPlacement(id));
    }, ids);
  } finally { await handle.close(); }
}

ensureDir(path.dirname(outPath));
const candidatePosts = posts.filter((p) => p.kind === 'road' && p.leg && Number(p.bodies || 0) >= 4);
const greenAll = await consume(path.join(root, 'game/index.html'), candidatePosts.map((p) => p.id));
const supported = candidatePosts.map((post, i) => ({ post, placement:greenAll[i] }))
  .filter(({post,placement}) => placement?.relocated && roadDistance(post,[post.x,post.z]) < 24
    && roadDistance(post,[placement.x,placement.z]) >= 31)
  .sort((a,b) => a.post.id.localeCompare(b.post.id));
if (!supported.length) throw new Error('no non-zero four-body road-clearance support row');
const chosen = supported.find((row) => row.post.id === 'pop-0119') || supported[0], needle = '  _routeSafeCentre(engine, p) {\n    const original = { x: p.x, z: p.z, relocated: false, reason: null };';
if (!source.includes(needle)) throw new Error('population placement consumer source needle changed');

if (fs.existsSync(scratch)) fs.rmSync(scratch, { recursive:true, force:true });
const copyGame = path.join(scratch, 'game');
fs.cpSync(path.join(root, 'game'), copyGame, { recursive:true });
const redSource = source.replace(needle, `${needle}\n    return original; // CONTROL: delete production route-safe relocation`);
const redSourcePath = path.join(copyGame, 'src/world/population.js');
fs.writeFileSync(redSourcePath, redSource);
const redPlacement = (await consume(path.join(copyGame, 'index.html'), [chosen.post.id]))[0];
const restoredPlacement = (await consume(path.join(root, 'game/index.html'), [chosen.post.id]))[0];
fs.rmSync(scratch, { recursive:true, force:true });

const row = (label, placement) => ({
  label, post:chosen.post.id, consumer:'PopulationManager._routeSafeCentre via H.getPopulationPostPlacement',
  consumer_calls:1, support_rows:supported.length, bodies:chosen.post.bodies,
  authored_road_distance_m:+roadDistance(chosen.post,[chosen.post.x,chosen.post.z]).toFixed(3),
  effective_centre:[placement.x,placement.z], relocated:!!placement.relocated,
  effective_road_clearance_m:+roadDistance(chosen.post,[placement.x,placement.z]).toFixed(3),
  route_detour_safe:!!placement.relocated && roadDistance(chosen.post,[placement.x,placement.z]) >= 31,
});
const report = {
  schema:'elder-souls/mainline-route-safety-control@1',
  method:'green consumer; isolated source deletion; same consumer red; restored green consumer',
  source:'game/src/world/population.js', source_hash:`sha256:${sha(source)}`,
  changed_source_hash:`sha256:${sha(redSource)}`, changed_hash:sha(source)!==sha(redSource),
  selected_support:{post:chosen.post.id,non_zero_support:supported.length,selection:'Q8 causeway post pop-0119 when present; otherwise first sorted four-body road post relocated from <24 m to >=31 m'},
  expected_red_row:{id:'route_detour_safe',expected:false},
  rows:[row('green-before',chosen.placement),row('red-deleted-consumer',redPlacement),row('green-restored',restoredPlacement)],
  pass:false,
};
report.pass=report.changed_hash && report.selected_support.non_zero_support>0
  && report.rows[0].route_detour_safe && !report.rows[1].route_detour_safe
  && report.rows[2].route_detour_safe && report.rows.every((r)=>r.consumer_calls>0);
writeJson(outPath,report);
console.log(JSON.stringify(report,null,2));
process.exitCode=report.pass?0:1;
