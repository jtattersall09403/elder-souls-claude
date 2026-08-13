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
const checkpoint = JSON.parse(fs.readFileSync(path.join(root, 'evidence/W1-19/fixtures/resume-saxhleel-interior-intended-q8.json'), 'utf8'));
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

async function consumeRestored(entry, state, id) {
  const handle = await launchGame({ ...args, entry, width:320, height:240, timeout:Number(args.timeout || 180000) });
  try {
    return await handle.page.evaluate(async ({ state, id }) => {
      const H=window.__HARNESS; await H.ready(); H.setRenderRate(0);
      H.restoreState(state); H.clearInputs();
      const observe=()=>{
        const report=H.populationReport();
        const enemies=H.snapshot({ enemies:true, events:false }).enemies.filter((row) => row.eid.startsWith(`${id}-`));
        const centroid=enemies.length ? [enemies.reduce((n,row)=>n+row.pos[0],0)/enemies.length,enemies.reduce((n,row)=>n+row.pos[2],0)/enemies.length] : null;
        return { report, enemies, centroid };
      };
      const before=observe(); H.stepFrames(2); const after=observe();
      return { before, after };
    }, { state, id });
  } finally { await handle.close(); }
}

ensureDir(path.dirname(outPath));
const candidatePosts = posts.filter((p) => p.kind === 'road' && p.leg);
const greenAll = await consume(path.join(root, 'game/index.html'), candidatePosts.map((p) => p.id));
const supported = candidatePosts.map((post, i) => ({ post, placement:greenAll[i] }))
  .filter(({post,placement}) => placement?.relocated && roadDistance(post,[post.x,post.z]) < 24
    && roadDistance(post,[placement.x,placement.z]) >= 31)
  .sort((a,b) => a.post.id.localeCompare(b.post.id));
if (!supported.length) throw new Error('no non-zero road-clearance support row');
const chosen = ['pop-0119','pop-0111'].map((id) => supported.find((row) => row.post.id === id)).filter(Boolean);
if (!chosen.length) chosen.push(supported[0]);
const restorePost = posts.find((post) => post.id === 'pop-0115');
if (!restorePost) throw new Error('Q8 checkpoint restore control requires shipped post pop-0115');
const greenRestore = await consumeRestored(path.join(root, 'game/index.html'), checkpoint, restorePost.id);
const needle = '  _routeSafeCentre(engine, p) {\n    const original = { x: p.x, z: p.z, relocated: false, reason: null };';
if (!source.includes(needle)) throw new Error('population placement consumer source needle changed');

if (fs.existsSync(scratch)) fs.rmSync(scratch, { recursive:true, force:true });
const copyGame = path.join(scratch, 'game');
fs.cpSync(path.join(root, 'game'), copyGame, { recursive:true });
const redSource = source.replace(needle, `${needle}\n    return original; // CONTROL: delete production route-safe relocation`);
const redSourcePath = path.join(copyGame, 'src/world/population.js');
fs.writeFileSync(redSourcePath, redSource);
const redPlacements = await consume(path.join(copyGame, 'index.html'), chosen.map((entry) => entry.post.id));
const redRestore = await consumeRestored(path.join(copyGame, 'index.html'), checkpoint, restorePost.id);
const restoredPlacements = await consume(path.join(root, 'game/index.html'), chosen.map((entry) => entry.post.id));
const restoredRestore = await consumeRestored(path.join(root, 'game/index.html'), checkpoint, restorePost.id);
fs.rmSync(scratch, { recursive:true, force:true });

const row = (label, support, placement) => ({
  label, post:support.post.id, consumer:'PopulationManager._routeSafeCentre via H.getPopulationPostPlacement',
  consumer_calls:1, support_rows:supported.length, bodies:support.post.bodies,
  authored_road_distance_m:+roadDistance(support.post,[support.post.x,support.post.z]).toFixed(3),
  effective_centre:[placement.x,placement.z], relocated:!!placement.relocated,
  effective_road_clearance_m:+roadDistance(support.post,[placement.x,placement.z]).toFixed(3),
  route_detour_safe:!!placement.relocated && roadDistance(support.post,[placement.x,placement.z]) >= 31,
});
const restoreRow = (label, arm) => {
  const placement=(arm.before.report?.resident_detail || []).find((entry) => entry.post === restorePost.id);
  const road=arm.before.centroid ? roadDistance(restorePost,arm.before.centroid) : 0;
  return {
    label, post:restorePost.id, consumer:'PopulationManager.reconcileRestored via H.restoreState',
    consumer_calls:1, restored_bodies:arm.before.enemies.length, centroid:arm.before.centroid,
    bodies_after_two_steps:arm.after.enemies.length,
    population_centre:placement ? [placement.x,placement.z] : null,
    effective_road_clearance_m:+road.toFixed(3),
    restored_checkpoint_safe:arm.before.enemies.length===Number(restorePost.bodies||0) && road>=24 && arm.after.enemies.length===0,
  };
};
const report = {
  schema:'elder-souls/mainline-route-safety-control@1',
  method:'green consumer; isolated source deletion; same consumer red; restored green consumer',
  source:'game/src/world/population.js', source_hash:`sha256:${sha(source)}`,
  changed_source_hash:`sha256:${sha(redSource)}`, changed_hash:sha(source)!==sha(redSource),
  selected_support:{posts:chosen.map((entry) => entry.post.id),non_zero_support:supported.length,selection:'Q8 four-body and Q9 two-body causeway posts when present; otherwise first road post relocated from <24 m to >=31 m'},
  expected_red_rows:[...chosen.map((entry) => ({post:entry.post.id,id:'route_detour_safe',expected:false})),{post:restorePost.id,id:'restored_checkpoint_safe',expected:false}],
  rows:[...chosen.flatMap((entry,i) => [row('green-before',entry,entry.placement),row('red-deleted-consumer',entry,redPlacements[i]),row('green-restored',entry,restoredPlacements[i])]),restoreRow('green-before-restore',greenRestore),restoreRow('red-deleted-consumer-restore',redRestore),restoreRow('green-restored-checkpoint',restoredRestore)],
  pass:false,
};
report.pass=report.changed_hash && report.selected_support.non_zero_support>0
  && chosen.every((entry) => {
    const rows=report.rows.filter((row) => row.post === entry.post.id);
    return rows[0].route_detour_safe && !rows[1].route_detour_safe && rows[2].route_detour_safe;
  }) && report.rows.find((row)=>row.label==='green-before-restore')?.restored_checkpoint_safe
  && !report.rows.find((row)=>row.label==='red-deleted-consumer-restore')?.restored_checkpoint_safe
  && report.rows.find((row)=>row.label==='green-restored-checkpoint')?.restored_checkpoint_safe
  && report.rows.every((r)=>r.consumer_calls>0);
writeJson(outPath,report);
console.log(JSON.stringify(report,null,2));
process.exitCode=report.pass?0:1;
