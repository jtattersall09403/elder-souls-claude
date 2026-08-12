#!/usr/bin/env node
// mainline-chain-floor.mjs — the main quest played by a person, with consequences accumulating.
//
// Written by the W1-19 ROUND-2 BUILDER and declared under `orchestration/TOOL-LOOP.md`. It exists
// because every instrument that certified the round-1 build measured the wrong moment or was fed
// the answer, and a builder that reports a number from the tool which certified the defect has
// graded itself:
//
//   * `tools/harness/chr-quest-race-gate.mjs` measures the offer gate at a COLD START. The
//     round-1 clamp was set from it, so all nine clamped gates ended with a worst-signature
//     margin of exactly 0 and the first point of erosion closed them.
//   * `tools/quests/mainline-gate-margin.mjs` (round-1 critic) measures the margin, also at a
//     cold start. It is the right question at the wrong instant.
//   * `tools/quests/mainline-trace.mjs` and `tools/quests/mainline-race-trace.mjs` both call
//     `H.direct topic API(step.topic)` immediately before asking the gate for that topic —
//     `RI-MTH07`'s hand-feed failure. They can play a chain no player could start.
//
// This tool answers the two questions those three cannot, in one pass:
//
//   A. THE CHAIN FLOOR.  For every (race x upbringing) signature and every main-quest giver,
//      the MINIMUM derived standing reached at any point along the chain — not at frame zero.
//      `chain_floor(gate) = min over signatures, min over steps` is the number a
//      `giver.disposition_min` has to sit under if every signature is to finish, and the gap
//      between it and the gate is the RESERVE the design is choosing to leave.
//
//   B. COMPLETION WITHOUT A HAND-FEED.  The same run plays both chains with **zero**
//      `direct topic API()` calls AND — since W1-19 round 3 — zero `direct reveal API()` calls. The only topic granted from outside the quest graph is the one a
//      player gets by walking up to somebody in Soulrest and being greeted — the world-side
//      consumer of `opens_by.overheard_from` — after which every keyword must arrive through
//      `hooks.json`'s forward AddTopic edges or the chain stops where a player would stop.
//
// Exit 0 only when every signature completes both chains AND every clamped gate has a positive
// chain-floor margin. `--sabotage` breaks the thing on purpose so the instrument can be shown to
// go red (rule: a probe that cannot fail is worse than no probe).
//
//   node tools/quests/mainline-chain-floor.mjs [--out <dir>] [--json]
//                                              [--sabotage no-bootstrap|hand-feed]
//
//   --sabotage no-bootstrap   skip the greeting. Nothing supplies `the drowned tally`; the
//                             chain must stop at Q-MAIN-01 for all 40 signatures.
//   --sabotage hand-feed      call direct topic API() before every step, the way the round-1 tools
//                             did. Completion must NOT change — if it does, the forward AddTopic
//                             graph is not carrying the chain and something else is.
//   --hand-feed-reveals       W1-19 round 3. Restores the round-2 behaviour: call
//                             `H.direct reveal API()` for every reveal each step declares. This is a
//                             HAND-FEED and it is what made round 2 report 40/40; it is off by
//                             default and exists only to reproduce that number.
//
//   --sabotage no-purse       run with 0 gold and no persuasion. The chain must stop where a
//                             character who cannot pay stops, which is what shows that the purse
//                             is what is carrying the low-standing signatures and not the clamp.
//
// THE PURSE. Unless `--sabotage no-purse` is given, a signature refused on `giver
// .disposition_min` does what a player does: stands in front of the giver and tries to talk them
// round — `RI-DLG04` §C's Admire and the three bribe tiers, through `Engine
// .conversationPersuade()`, with a real seeded roll and gold spent either way (seam S15). It
// gets `--attempts` tries per gate and then gives up. This is the difference between a gate that
// prices a background and a gate that excludes one, and it is why the clamp below does not have
// to be lowered until every gate is decorative.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mainline-chain-floor.mjs — the chain played end to end per signature, with consequences kept.

USAGE
  node tools/quests/mainline-chain-floor.mjs [--out <dir>] [--json]
                                             [--sabotage no-bootstrap|hand-feed]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R2-FLOOR');
ensureDir(outDir);
const RESUME_OUTPUT = args['resume-output'] ? path.resolve(String(args['resume-output'])) : null;
const sabotage = args.sabotage ? String(args.sabotage) : null;
// W1-19 round 3: off by default. See the long note at the direct reveal API call site.
const handFeedReveals = false;
if (sabotage && !['no-bootstrap', 'no-purse'].includes(sabotage)) usage(USAGE);
const PURSE = args.purse === undefined ? 0 : Number(args.purse);
const ATTEMPTS = args.attempts === undefined ? 6 : Number(args.attempts);
const WALK_MAX_FRAMES = Number(args['walk-max-frames'] || 100000);
const STOP_AFTER = args['stop-after'] ? String(args['stop-after']) : null;
const resumeState = args['resume-state'] ? JSON.parse(fs.readFileSync(path.resolve(String(args['resume-state'])), 'utf8')) : null;
const saveWaypoint = args['save-waypoint'] ? String(args['save-waypoint']).split(',').map(Number) : null;
const waypointStatePath = args['waypoint-state'] ? path.resolve(String(args['waypoint-state'])) : null;
const stopAtWaypoint = !!args['stop-at-waypoint'];
// Historical route diagnostic only. The W1-19 quest contract does not require manufacturing or
// waiting out a salt storm, and its canonical Q8 route must not be gated on a crater visit.
const stormShelterDiagnostic = !!args['storm-shelter-diagnostic'];
if (saveWaypoint && (saveWaypoint.length !== 2 || saveWaypoint.some((n) => !Number.isFinite(n)) || !waypointStatePath)) usage(USAGE);
const CHAIN_NAMES = args.chain && args.chain !== 'both' ? [String(args.chain)] : ['intended', 'backpath'];
if (CHAIN_NAMES.some((x) => !['intended', 'backpath'].includes(x))) usage(USAGE);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));
const roads = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/world/roads.json'), 'utf8'));
const populationPosts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/world/population-posts.json'), 'utf8')).posts || [];
const travelStations = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/world/travel/stations.json'), 'utf8')).stations;


const npcActions = {};
for (const f of fs.readdirSync(path.join(process.cwd(), 'game/data/npcs'))) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/npcs', f), 'utf8'));
  for (const n of d.npcs || []) npcActions[n.id] = n.settlement ? { settlement: n.settlement, pos: n.post && n.post.pos || null, schedule:n.schedule || [] } : (n.post && n.post.site ? { site: n.post.site, pos: n.post.pos || null, schedule:n.schedule || [] } : null);
}

// Resolve authored document/mark sources to their production world objects once. The resulting
// table contains locations only; progression still happens exclusively when the player presses
// interact on the spawned prop in the running game.
const documentActions = {};
const knowledgeToBook = {};
for (const f of fs.readdirSync(path.join(process.cwd(), 'game/data/books'))) {
  if (!f.endsWith('.json') || f === 'manifest.json') continue;
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/books', f), 'utf8'));
  for (const b of d.books || []) if (b.knowledge_key) knowledgeToBook[b.knowledge_key] = b.id;
}
const interiorsDir = path.join(process.cwd(), 'game/data/world/interiors');
const interiorActions = {};
for (const f of fs.readdirSync(interiorsDir)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(interiorsDir, f), 'utf8'));
  interiorActions[d.id] = { interior:d.id, exterior_door:d.exterior_door, exterior_spawn:d.continuity && d.continuity.exterior_spawn, interior_spawn:d.continuity && d.continuity.interior_spawn };
  for (const r of Array.isArray(d.readable) ? d.readable : []) {
    const key = Object.keys(knowledgeToBook).find((k) => knowledgeToBook[k] === r.book);
    if (key) documentActions[key] = { interior: d.id, eid: `interior-readable:${r.id}`, book: r.book, exterior_spawn: d.continuity && d.continuity.exterior_spawn, interior_spawn: d.continuity && d.continuity.interior_spawn };
  }
}
const markActions = {};
const marksPath = path.join(process.cwd(), 'game/data/world/readables/site-marks.json');
if (fs.existsSync(marksPath)) for (const m of JSON.parse(fs.readFileSync(marksPath, 'utf8')).marks || []) markActions[m.id] = m.at;

// Q-MAIN-30 is a mandatory parallel mainline audience opened by the Ninth Clause rather than by
// a prerequisite quest.  It therefore is not present in mainline.acts, but W1-19 requires both
// production chains to visit it.  Put it after Act III, when its world-routed topic and evidence
// are available, and before the Act IV campaign/PONR so an intended completion cannot report the
// historical false-green where Hosk-Vei's gate was never reached.
const INTENDED = [
  ...mainline.acts.filter((a) => a.act <= 3).flatMap((a) => a.quests),
  'Q-MAIN-30',
  ...mainline.acts.filter((a) => a.act >= 4).flatMap((a) => a.quests),
  ...mainline.aftermath.quests,
];
const BACKPATH = [
  ...mainline.acts.filter((a) => a.act <= 3).flatMap((a) => a.quests),
  ...mainline.backpath.quests,
];

// The same plan shape `mainline-race-trace.mjs` builds, MINUS the topic, so that a difference in
// the result is a difference in what the world supplied and in nothing else.
const planFor = (ids) => ids.map((id) => {
  const q = defs[id];
  if (!q) throw new Error(`mainline-chain-floor: ${id} is not in game/data/quests/**`);
  return {
    id,
    topic: q.opens_by.topic,                                     // reported, and hand-fed ONLY under --sabotage hand-feed
    prereq_topics: q.opens_by.prerequisite_topics || [],
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => ({ id: r.id, channel: r.channel, source: r.source })),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch')
      .map((e) => e.index).filter((i) => i > 10),
    resolutions: (q.resolutions || []).filter((r) => !r.violence_required).map((r) => ({ id: r.id, requires_knowing: r.requires_knowing || [] })),
  };
});
const PREFER = {
  intended: { 'Q-MAIN-14': 'res_give_it_back', 'Q-MAIN-28': 'res_open_the_count' },
  backpath: { 'Q-MAIN-14': 'res_take_the_skei', 'Q-MAIN-31': 'res_drain_past_the_roots' },
};
const plans = { intended: planFor(INTENDED), backpath: planFor(BACKPATH) };

// Every main-quest gate, so the floor is sampled at the people the gates actually name.
const gates = [];
for (const q of Object.values(defs)) {
  if (q.category !== 'main' || !q.giver || q.giver.disposition_min == null) continue;
  gates.push({ quest: q.id, act: q.act ?? null, npc: q.giver.npc_id, min: q.giver.disposition_min });
}
const gateNpcs = [...new Set(gates.map((g) => g.npc))].sort();

const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
const UPBRINGINGS = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
let SIGS = [];
for (const r of RACES) for (const u of UPBRINGINGS) SIGS.push([r, u]);
const signatureStart = Number(args['signature-start'] || 0);
const signatureCount = args['signature-count'] == null ? SIGS.length : Number(args['signature-count']);
SIGS = SIGS.slice(signatureStart, signatureStart + signatureCount);

// The one world action the trace is allowed. `bone-ladder-carter` is named in Q-MAIN-01's own
// `opens_by.overheard_from`, and greeting somebody is the cheapest thing a player can do.
const BOOTSTRAP_NPC = 'bone-ladder-carter';
const STATE = 'soulrest-quay';

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 900000) });
let report;
try {
  report = await handle.page.evaluate(async ({ plans, prefer, sigs, gateNpcs, gates, sabotage, handFeedReveals, BOOTSTRAP_NPC, STATE, PURSE, ATTEMPTS, documentActions, markActions, npcActions, roads, populationPosts, travelStations, chainNames, walkMaxFrames, interiorActions, resumeState, stopAfter, saveWaypoint, stopAtWaypoint, stormShelterDiagnostic }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    let shelterRequired = false;
    let routeCheckpoint = null;

    // One interact edge can both take a doorway and greet a body standing on the destination
    // spawn. The transition is legitimate, but the resulting player-visible conversation owns
    // movement until it is dismissed. Close it with the shipped block/back input before the
    // next walk; never clear the UI or conversation object directly.
    const closeDoorwayConversation = () => {
      let closed = false;
      for (let retry=0; retry<3 && H.getUIState().dialogue_surface?.open; retry++) {
        H.queueInputs([{f:0,release:['interact']},{f:1,press:['block']},{f:3,release:['block']}]);
        H.stepFrames(8); closed = true;
      }
      H.clearInputs(); H.stepFrames(2);
      return { attempted:closed, closed:!H.getUIState().dialogue_surface?.open };
    };

    const walkTo = (x, z, reach = 1.0) => {
      H.queueInputs([{f:0,release:['block','interact','use_item','light','heavy','sprint','roll']}]);H.stepFrames(2);
      const started = H.whereAmI().pos.slice();
      const already = Math.hypot(x-started[0],z-started[2]);
      if (already <= reach) return { ok:true, frames:0, left_m:already, started, ended:started.slice(), production_input:true, already_in_reach:true, planned_route:[], planned_clearance:[], planner:null, walk:{arrived:true,aborted:null,frames:0,path_m:0,end:[started[0],started[2]],target:[x,z],offset_m:already,teleports:0,teleported_m:0,teleport_log:[],arrival_is_clean:true} };
      // A legitimate bounded checkpoint preserves damage. Resume with the player's real flask
      // action when needed, and wait through the declared 130-frame commitment before walking.
      // The former 120-frame probe began locomotion during HEAL_RECOVER and therefore measured
      // an animation lock as a stuck road. clearInputs also makes the recovery edge self-contained.
      let recoveryHeals=0;
      if (!H.whereAmI().interior && already>80) for(let i=0;i<3;i++) {
        const ps=H.getPlayerStats();
        if(ps.hp>=ps.hp_max*.9||ps.estus<=0)break;
        H.queueInputs([{f:0,move:[0,0],press:['use_item']},{f:2,release:['use_item']}]);
        H.stepFrames(140);H.clearInputs();H.stepFrames(2);recoveryHeals++;
      }
      // Follow the authored road graph between the nearest settlements. The short joins at
      // each end are walked too; no pose is written and walkPath reports any discontinuity.
      const here = started;
      const roadNodes=new Set(roads.legs.flatMap(l=>[l.from.toLowerCase(),l.to.toLowerCase()]));
      const nearest = (px, pz) => [...travelStations].filter(s=>roadNodes.has(s.id)).sort((a,b) => Math.hypot(a.x-px,a.z-pz)-Math.hypot(b.x-px,b.z-pz))[0];
      let from = nearest(here[0], here[2]); const to = nearest(x, z);
      // A bounded resume can be geographically closer to the destination station while still
      // standing on the incoming road. Choosing stations alone then collapses the route to a
      // one-point beeline (and, on Soulrest--Blackrose, sends the body through deep water).
      // Recover the authored suffix whenever the current body is close to a leg ending at the
      // destination. This is a route lookup only: the suffix is still consumed by walkPath.
      let incoming=null;
      for(const leg of roads.legs){const ids=[leg.from.toLowerCase(),leg.to.toLowerCase()];if(!ids.includes(to.id))continue;for(let i=0;i<leg.points.length;i++){const q=leg.points[i],d=Math.hypot(q[0]-here[0],q[1]-here[2]);if(!incoming||d<incoming.d)incoming={leg,i,d};}}
      const resumedIncoming=incoming&&incoming.d<180&&Math.hypot(here[0]-to.x,here[2]-to.z)>180;
      if(resumedIncoming){const a=incoming.leg.from.toLowerCase(),b=incoming.leg.to.toLowerCase();from=travelStations.find(s=>s.id===(a===to.id?b:a))||from;}
      const dist = Object.fromEntries(travelStations.map(q => [q.id, Infinity])); dist[from.id]=0;
      const prev = {}, unused = new Set(travelStations.map(q => q.id));
      while (unused.size) {
        const u=[...unused].sort((a,b)=>dist[a]-dist[b])[0]; unused.delete(u); if(u===to.id || !Number.isFinite(dist[u])) break;
        for (const leg of roads.legs.filter(l=>l.from.toLowerCase()===u||l.to.toLowerCase()===u)) { const v=(leg.from.toLowerCase()===u?leg.to:leg.from).toLowerCase(), nd=dist[u]+leg.built_path_m; if(nd<dist[v]){dist[v]=nd;prev[v]={u,leg};} }
      }
      const hops=[]; let cur=to.id; while(cur!==from.id && prev[cur]) { hops.unshift({from:prev[cur].u,to:cur,leg:prev[cur].leg});cur=prev[cur].u; }
      const route=[]; let plannerReport={from:from.id,to:to.id,resumed_incoming:!!resumedIncoming};
      for (const h of hops) { const pts=h.leg.from.toLowerCase()===h.from?h.leg.points:[...h.leg.points].reverse(); for(const q of pts) if(!route.length||q[0]!==route.at(-1)[0]||q[1]!==route.at(-1)[1]) route.push([q[0],q[1]]); }
      route.push([x,z]);
      // A resumed production walk starts from the body's saved pose, not from the station it
      // left in an earlier bounded segment. Rejoin at the nearest authored road point rather
      // than backtracking through already-walked ground.
      if (route.length > 2) { let near={i:0,d:Infinity}; for(let i=0;i<route.length-1;i++){const d=Math.hypot(route[i][0]-here[0],route[i][1]-here[2]);if(d<near.d)near={i,d};} if(near.i>0&&near.d<180)route.splice(0,near.i); }
      // Find a collision-free street egress to the provincial road. Settlement road splines
      // begin at civic centres and can lie behind the building whose door the player just left;
      // a beeline therefore walks through a visible wall. This A* reads the rendered footprints
      // and emits ordinary walking waypoints. It neither places the body nor advances a quest.
      if (route.length) {
        let nearestRoad={i:0,d:Infinity}; for(let ri=0;ri<route.length;ri++){const rd=Math.hypot(route[ri][0]-here[0],route[ri][1]-here[2]);if(rd<nearestRoad.d)nearestRoad={i:ri,d:rd};}
        let join = nearestRoad.i > 0 && nearestRoad.d < 180 ? nearestRoad.i : route.findIndex(q => Math.hypot(q[0]-from.x, q[1]-from.z) >= 120);
        if (join < 0) join = Math.min(route.length-1, 1);
        const rawGoal = route[join]; let goal = rawGoal; const localDistance=Math.hypot(rawGoal[0]-here[0],rawGoal[1]-here[2]), grid = localDistance < 60 ? 0.5 : localDistance < 300 ? 2 : 5, margin = localDistance < 60 ? 30 : 100, collisionY=here[1]+0.9;
        const blocked=(bx,bz)=>{
          if(H.solidAt(bx,collisionY,bz).distance_m < .42)return true;
          const w=H.getWaterAt(bx,bz); return Number(w.depth_m??w.depth??0)>1.05;
        };
        if (blocked(goal[0], goal[1])) {
          const candidates=[]; for(let rr=Math.max(1.5,reach);rr<=Math.max(6,reach+3);rr+=1.5) for(let k=0;k<24;k++){const a=k*Math.PI/12,q=[rawGoal[0]+Math.sin(a)*rr,rawGoal[1]+Math.cos(a)*rr];if(!blocked(q[0],q[1]))candidates.push(q);}
          if(candidates.length) goal=candidates.sort((a,b)=>Math.hypot(a[0]-here[0],a[1]-here[2])-Math.hypot(b[0]-here[0],b[1]-here[2]))[0];
          route[join]=goal;
        }
        const minX=Math.min(here[0],goal[0])-margin,maxX=Math.max(here[0],goal[0])+margin;
        const minZ=Math.min(here[2],goal[1])-margin,maxZ=Math.max(here[2],goal[1])+margin;
        const cols=Math.ceil((maxX-minX)/grid)+1, rows=Math.ceil((maxZ-minZ)/grid)+1;
        const ix=x0=>Math.max(0,Math.min(cols-1,Math.round((x0-minX)/grid)));
        const iz=z0=>Math.max(0,Math.min(rows-1,Math.round((z0-minZ)/grid)));
        const key=(a,b)=>a+','+b, sx=ix(here[0]),sz=iz(here[2]); let gx=ix(goal[0]),gz=iz(goal[1]);
        const open=[[0,sx,sz]], cost=new Map([[key(sx,sz),0]]), came=new Map();
        const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
        let found=false,bestReach={d:Infinity,x:sx,z:sz};
        while(open.length){open.sort((a,b)=>a[0]-b[0]);const [,cx,cz]=open.shift(),ck=key(cx,cz),cwx=minX+cx*grid,cwz=minZ+cz*grid,goalDist=Math.hypot(cwx-rawGoal[0],cwz-rawGoal[1]);if(goalDist<bestReach.d)bestReach={d:goalDist,x:cx,z:cz,world:[cwx,cwz]};if(goalDist<=Math.max(Math.min(reach*.35,.6),grid*.75)&&!blocked(cwx,cwz)){found=true;gx=cx;gz=cz;goal=[cwx,cwz];route[join]=goal;break;}
          for(const [di,dj] of dirs){const nx=cx+di,nz=cz+dj;if(nx<0||nz<0||nx>=cols||nz>=rows)continue;const wx=minX+nx*grid,wz=minZ+nz*grid,cwx=minX+cx*grid,cwz=minZ+cz*grid;let edgeBlocked=false;for(let et=.2;et<=1;et+=.2)if(blocked(cwx+(wx-cwx)*et,cwz+(wz-cwz)*et)){edgeBlocked=true;break;}if(edgeBlocked)continue;const nk=key(nx,nz),ng=cost.get(ck)+Math.hypot(di,dj);if(ng<(cost.get(nk)??Infinity)){cost.set(nk,ng);came.set(nk,ck);open.push([ng+Math.hypot(gx-nx,gz-nz),nx,nz]);}}
        }
        plannerReport={...plannerReport,found,cols,rows,start:[sx,sz],goal:[gx,gz],open_left:open.length,cost_nodes:cost.size,best_reachable:bestReach};
        if(found){const cells=[];let k=key(gx,gz);while(k!==key(sx,sz)){const [a,b]=k.split(',').map(Number);cells.unshift([minX+a*grid,minZ+b*grid]);k=came.get(k);if(!k)break;}
          // Keep the collision-checked grid edges. Pure pursuit may smooth a long polyline, but
          // a settlement doorway can be narrower than that smoothing radius.
          route.splice(0,join+1,...cells);
        }
      }
      // Wilderness encounters are authored *on* the road.  Concealment alone cannot make a
      // four-body gank occupying the carriageway nonviolent: the Q-MAIN-08 trace repeatedly died
      // at pop-0119's exact coordinate.  A player can leave the road, so bend the consumed route
      // around any live hostile post whose centre is within 24 m of it.  Both candidate shoulders
      // are checked against production collision/water and the body still walks every metre.
      const encounterDetours=[];
      const sampleSegment=(p0,p1,post,requiredClearance)=>{
        const length=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]), samples=[];
        let previousGround=null, safe=true, reason=null;
        for(let m=0;m<=length+.001;m+=Math.min(2,Math.max(.5,length))){
          const t=length?Math.min(1,m/length):0,x=p0[0]+(p1[0]-p0[0])*t,z=p0[1]+(p1[1]-p0[1])*t;
          const waterReport=H.getWaterAt(x,z),water=Number(waterReport.depth_m??waterReport.depth??0),ground=Number(waterReport.ground_y),substrate=H.getTerrainAt(x,z).substrate;
          const solid=H.solidAt(x,ground+.9,z).distance_m<.42;
          const grade=previousGround==null?0:Math.atan2(Math.abs(ground-previousGround.ground),Math.hypot(x-previousGround.x,z-previousGround.z))*180/Math.PI;
          const bodyClearance=Math.hypot(x-post.x,z-post.z);
          samples.push({x:+x.toFixed(2),z:+z.toFixed(2),water_m:+water.toFixed(3),substrate,ground_y:+ground.toFixed(3),grade_deg:+grade.toFixed(2),solid,encounter_clearance_m:+bodyClearance.toFixed(2)});
          // The coastal carriageway and its shoulders deliberately include walkable W3 water.
          // The production discontinuities are W4 depth and deep saturated SUCK. Shallow SUCK is
          // deliberately traversable: the movement consumer pays the mire/struggle cost and its
          // refractory window permits a crossing. Keep the previously observed 0.621 m shoulder
          // rejected while allowing the <=0.4 m connected-grid route a player can actually use.
          const unsafeWater=water>.95||(substrate==='SUCK'&&water>.4);
          if(solid||unsafeWater||grade>35||(t>.08&&t<.92&&bodyClearance<requiredClearance)){safe=false;reason=solid?'collision':unsafeWater?(water>.95?'water':'saturated-suck'):grade>35?'grade':'encounter-clearance';break;}
          previousGround={x,z,ground};
        }
        return {safe,reason,length_m:+length.toFixed(2),samples};
      };
      const findConnectedDetour=(entry,exit,post,requiredClearance)=>{
        const grid=2;
        // A coastal post can occupy the only firm centreline while the first dry shoulder lies
        // beyond a local inlet. Search successively larger *bounded* envelopes; 100 m remains
        // the common case, while 300 m is still smaller than the population release radius plus
        // its ordinary streaming hysteresis. Never make a failed search mean "walk through it".
        for(const margin of [100,180,300]){
        const rawMinX=Math.min(entry[0],exit[0],post.x)-margin,rawMaxX=Math.max(entry[0],exit[0],post.x)+margin,rawMinZ=Math.min(entry[1],exit[1],post.z)-margin,rawMaxZ=Math.max(entry[1],exit[1],post.z)+margin;
        // Anchor the lattice on the exact authored entry. The Archon carriageway can be less
        // than one grid cell wide where it crosses coastal water; rounding the exit to an
        // arbitrary lattice point put the alleged goal in W4 even though the road itself is W3.
        const minX=entry[0]-Math.ceil((entry[0]-rawMinX)/grid)*grid,maxX=entry[0]+Math.ceil((rawMaxX-entry[0])/grid)*grid,minZ=entry[1]-Math.ceil((entry[1]-rawMinZ)/grid)*grid,maxZ=entry[1]+Math.ceil((rawMaxZ-entry[1])/grid)*grid;
        const cols=Math.ceil((maxX-minX)/grid)+1,rows=Math.ceil((maxZ-minZ)/grid)+1,ix=x=>Math.round((x-minX)/grid),iz=z=>Math.round((z-minZ)/grid),key=(x,z)=>x+','+z;
        const sx=ix(entry[0]),sz=iz(entry[1]),gx=ix(exit[0]),gz=iz(exit[1]);
        const blockedCache=new Map();
        const blocked=(x,z)=>{const cacheKey=`${x.toFixed(3)},${z.toFixed(3)}`;if(blockedCache.has(cacheKey))return blockedCache.get(cacheKey);const w=H.getWaterAt(x,z),g=Number(w.ground_y),water=Number(w.depth_m??w.depth??0),substrate=H.getTerrainAt(x,z).substrate,value=water>.95||(substrate==='SUCK'&&water>.4)||H.solidAt(x,g+.9,z).distance_m<.42||Math.hypot(x-post.x,z-post.z)<requiredClearance;blockedCache.set(cacheKey,value);return value;};
        const open=[],heapPush=v=>{open.push(v);let i=open.length-1;while(i){const p=(i-1)>>1;if(open[p][0]<=v[0])break;open[i]=open[p];i=p;}open[i]=v;},heapPop=()=>{const top=open[0],last=open.pop();if(open.length){let i=0;while(true){let c=i*2+1;if(c>=open.length)break;if(c+1<open.length&&open[c+1][0]<open[c][0])c++;if(open[c][0]>=last[0])break;open[i]=open[c];i=c;}open[i]=last;}return top;};
        heapPush([0,sx,sz]);const cost=new Map([[key(sx,sz),0]]),came=new Map(),dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];let found=false,endKey=null;
        while(open.length){const [,cx,cz]=heapPop(),ck=key(cx,cz),x0=minX+cx*grid,z0=minZ+cz*grid;if(Math.hypot(x0-exit[0],z0-exit[1])<=grid*1.75&&sampleSegment([x0,z0],exit,post,requiredClearance).safe){found=true;endKey=ck;break;}for(const[dix,diz]of dirs){const nx=cx+dix,nz=cz+diz;if(nx<0||nz<0||nx>=cols||nz>=rows)continue;const x=minX+nx*grid,z=minZ+nz*grid;let edgeBlocked=false;for(let et=.2;et<=1;et+=.2)if(blocked(x0+(x-x0)*et,z0+(z-z0)*et)){edgeBlocked=true;break;}if(edgeBlocked)continue;const nk=key(nx,nz),ng=cost.get(ck)+Math.hypot(dix,diz);if(ng<(cost.get(nk)??Infinity)){cost.set(nk,ng);came.set(nk,ck);heapPush([ng+Math.hypot(exit[0]-x,exit[1]-z)/grid,nx,nz]);}}}
        if(!found)continue;const cells=[];let k=endKey;while(k!==key(sx,sz)){const[a,b]=k.split(',').map(Number);cells.unshift([minX+a*grid,minZ+b*grid]);k=came.get(k);if(!k){cells.length=0;break;}}if(cells.length){if(Math.hypot(cells.at(-1)[0]-exit[0],cells.at(-1)[1]-exit[1])>.01)cells.push(exit.slice());return {cells,margin};}
        }
        return null;
      };
      // Select against one immutable road. Selecting against a route after each insertion made
      // a detour attract unrelated posts, which recursively grew a local bypass into a
      // province-scale route. Work destination-to-source so higher-index splices cannot shift
      // the still-pending baseline indices.
      const encounterBaseline=route.map(q=>q.slice());
      const encounterCandidates=[];
      for (const authoredPost of populationPosts) {
        const placement=H.getPopulationPostPlacement(authoredPost.id);
        const post={...authoredPost,x:placement?.x??authoredPost.x,z:placement?.z??authoredPost.z,production_placement:placement};
        let near={i:-1,d:Infinity};
        for(let i=2;i<encounterBaseline.length-2;i++){const d=Math.hypot(encounterBaseline[i][0]-post.x,encounterBaseline[i][1]-post.z);if(d<near.d)near={i,d};}
        if(near.i<0||near.d>24)continue;
        encounterCandidates.push({post,near});
      }
      let unsafeEncounterRoute=null;
      for (const {post,near} of encounterCandidates.sort((a,b)=>b.near.i-a.near.i)) {
        const a=encounterBaseline[Math.max(0,near.i-8)],b=encounterBaseline[Math.min(encounterBaseline.length-1,near.i+8)],dx=b[0]-a[0],dz=b[1]-a[1],dl=Math.hypot(dx,dz)||1;
        // Perception is per body (12--20 m by archetype), not multiplied by group size. Keep a
        // 35 m centreline clearance for every post: it covers the largest sight radius plus the
        // authored spawn offsets without demanding a fictitious 70 m exclusion disc that can
        // make an otherwise passable coastal road topologically impossible.
        const clearance=35;
        // Replace the road points through the occupied circle.  Merely inserting the shoulder
        // left the original centreline immediately after it, so pure pursuit walked straight
        // back through the post and died at the authored x/z despite reporting a 70 m waypoint.
        let lo=near.i,hi=near.i;
        const replaceRadius=28;
        while(lo>1&&Math.hypot(encounterBaseline[lo-1][0]-post.x,encounterBaseline[lo-1][1]-post.z)<replaceRadius)lo--;
        while(hi+1<encounterBaseline.length-1&&Math.hypot(encounterBaseline[hi+1][0]-post.x,encounterBaseline[hi+1][1]-post.z)<replaceRadius)hi++;
        const entry=encounterBaseline[lo-1],exit=encounterBaseline[hi+1],requiredClearance=24,tested=[];
        for(const side of [-1,1]) for(const shoulder of [clearance,clearance+15,clearance+30]){
          const q=[post.x+side*(-dz/dl)*shoulder,post.z+side*(dx/dl)*shoulder];
          const inbound=sampleSegment(entry,q,post,requiredClearance),outbound=sampleSegment(q,exit,post,requiredClearance);
          tested.push({q,side,shoulder,inbound,outbound,safe:inbound.safe&&outbound.safe,min_water_margin_m:+(.4-Math.max(...inbound.samples.concat(outbound.samples).map(s=>s.water_m))).toFixed(3)});
        }
        const pick=tested.filter(c=>c.safe).sort((a,b)=>b.min_water_margin_m-a.min_water_margin_m||a.shoulder-b.shoulder)[0];
        if(!pick){
          const connected=findConnectedDetour(entry,exit,post,requiredClearance);
          if(!connected){unsafeEncounterRoute={post:post.id,encounter:post.encounter,reason:'no-connected-production-safe-detour',authored_entry:entry.slice(),authored_exit:exit.slice(),baseline_index:near.i};encounterDetours.push({...unsafeEncounterRoute,rejected:true,tested});continue;}
          route.splice(lo,hi-lo+1,...connected.cells);
          encounterDetours.push({post:post.id,encounter:post.encounter,production_placement:post.production_placement,road_distance_m:+near.d.toFixed(2),clearance_m:clearance,required_body_clearance_m:requiredClearance,side:'connected-grid',waypoints:connected.cells,segment_validation:{grid_m:2,search_margin_m:connected.margin,water_max_m:.95,saturated_suck_max_m:.4,collision_clearance_m:.42,connected_to_authored_road:true},alternatives_tested:tested.map(c=>({side:c.side,shoulder:c.shoulder,safe:c.safe,inbound_reason:c.inbound.reason,outbound_reason:c.outbound.reason,min_water_margin_m:c.min_water_margin_m}))});
          continue;
        }
        route.splice(lo,hi-lo+1,pick.q);
        encounterDetours.push({post:post.id,encounter:post.encounter,production_placement:post.production_placement,road_distance_m:+near.d.toFixed(2),clearance_m:clearance,required_body_clearance_m:requiredClearance,side:pick.side,waypoint:pick.q,segment_validation:{inbound:pick.inbound,outbound:pick.outbound},alternatives_tested:tested.map(c=>({side:c.side,shoulder:c.shoulder,safe:c.safe,inbound_reason:c.inbound.reason,outbound_reason:c.outbound.reason,min_water_margin_m:c.min_water_margin_m}))});
      }
      plannerReport.encounter_detours=encounterDetours;
      plannerReport.encounter_candidates=encounterCandidates.length;
      plannerReport.unsafe_encounter_route=unsafeEncounterRoute;
      // A bounded checkpoint before a later rejected segment is still a valid production state.
      // Do not walk the unsafe segment, but do permit the already-validated prefix to be consumed
      // when the explicit stop waypoint lies before its authored entry.
      let unsafeBeyondCheckpoint=false;
      if(unsafeEncounterRoute&&stopAtWaypoint&&saveWaypoint){
        let waypointI=-1,waypointD=Infinity,unsafeI=-1,unsafeD=Infinity;
        for(let i=0;i<route.length;i++){const wd=Math.hypot(route[i][0]-saveWaypoint[0],route[i][1]-saveWaypoint[1]);if(wd<waypointD){waypointD=wd;waypointI=i;}const ud=Math.hypot(route[i][0]-unsafeEncounterRoute.authored_entry[0],route[i][1]-unsafeEncounterRoute.authored_entry[1]);if(ud<unsafeD){unsafeD=ud;unsafeI=i;}}
        unsafeBeyondCheckpoint=waypointD<=5&&waypointI>=0&&unsafeI>waypointI;
        plannerReport.unsafe_beyond_checkpoint=unsafeBeyondCheckpoint?{waypoint_index:waypointI,unsafe_index:unsafeI}:null;
      }
      if(unsafeEncounterRoute&&!unsafeBeyondCheckpoint){
        const ended=H.whereAmI().pos.slice();
        return {ok:false,failure:'unsafe-route-planning',frames:0,left_m:Math.hypot(x-ended[0],z-ended[2]),started,ended,production_input:true,planned_route:route.slice(0,40),planned_clearance:[],planner:plannerReport,stealth:null,recovery_heals:recoveryHeals,shelter:null,hazards:[],walk:{arrived:false,aborted:'unsafe-route-planning',frames:0,minutes:0,path_m:0,mean_speed_mps:0,end:[ended[0],ended[2]],target:[x,z],offset_m:Math.hypot(x-ended[0],z-ended[2]),longest_stuck_frames:0,mired_frames:0,survival_inputs:{heals:0,sprint_frames:0,defensive_swings:0},regions_entered:[],deepest_water_on_the_walk:null,worst_off_path_m:0,off_path_frames:0,regains:0,teleports:0,teleported_m:0,teleport_log:[],arrival_is_clean:false}};
      }
      // Provincial legs are crossed in the player's ordinary crouched stance. Road patrols are
      // authored encounters, not unavoidable damage volumes; lowering the detection profile is
      // the nonviolent production route and still leaves every metre to the movement consumer.
      let stealth=null;
      if(!H.whereAmI().interior && already>80){
        const ss=H.getStealthState();
        if(!ss.crouched){H.queueInputs([{f:0,press:['crouch']},{f:2,release:['crouch']}]);H.stepFrames(4);}
        stealth={action:ss.crouched?'already-crouched':'crouch-to-avoid',production_input:true};
      }
      const walkOptions = {
        fromCurrent: true,
        speed: 'jog',
        maxFrames: walkMaxFrames,
        arrive_m: Math.max(.15,Math.min(reach*.45,.8)),
        lookahead_m: 0.5,
        stuckAbort: 1800,
        miredAbort: 36000,
        // Ordinary player inputs keep a long provincial journey alive: heal, sprint away, and
        // defend when a streamed patrol catches the player.  Disabling these inputs made the
        // Q-MAIN-08 proof deliberately tank attacks until a hearth respawn, which measured a
        // helpless harness rather than the player-available route.
        // Sprinting advertised the player to every streamed patrol and produced a combat death
        // near Archon after all flask charges had been consumed.  The intended nonviolent route
        // is concealment, not repeatedly healing while dragging a patrol across the province.
        survival: false,
        // Quest-chain proof is explicitly nonviolent.  Flee and heal, but never let the generic
        // survival walker swing at a patrol (which also keeps combat open across interior doors).
        defensive: false,
      };
      const settleCheckpoint=()=>{
        H.clearInputs();
        let stableFrames=0,last=null;
        for(let waited=0;waited<3600;waited++){
          H.stepFrames(1);
          const combat=H.getCombatState(),player=combat.player||{},stats=H.getPlayerStats(),input=H.getInputState(),traversal=H.getTraversalReport().observed,death=H.getDeathState(),ui=H.getUIState(),conversation=H.getConversationState(),where=H.whereAmI(),collision=H.solidAt(where.pos[0],where.pos[1]+.9,where.pos[2]);
          const clean=player.state==='IDLE'&&!player.move&&Number(player.speed_mps||0)<.01&&!stats.in_combat&&!stats.locked_on&&!stats.mired&&!traversal.mired&&!traversal.sinking&&!traversal.submerged&&!player.pending_reaction&&!player.dead&&!player.hitstop&&!death.surface_active&&Number(death.deaths_this_session||0)===0&&(death.frames_since_last_damage==null||death.frames_since_last_damage>=180)&&ui.mode==='world'&&!ui.dialogue_surface?.open&&!conversation.open&&!collision.solid&&input.held.length===0&&input.pressed.length===0&&input.pendingPress.length===0&&input.pendingRelease.length===0&&Math.hypot(...input.move)<.001;
          stableFrames=clean?stableFrames+1:0;
          last={waited_frames:waited+1,stable_frames:stableFrames,clean,player:{state:player.state,move:player.move||null,speed_mps:player.speed_mps,pending_reaction:player.pending_reaction,dead:player.dead,hitstop:player.hitstop},stats:{hp:stats.hp,hp_max:stats.hp_max,estus:stats.estus,in_combat:stats.in_combat,locked_on:stats.locked_on,mired:stats.mired},traversal:{band:traversal.band,depth_m:traversal.depth_m,substrate:traversal.substrate,mired:traversal.mired,sinking:traversal.sinking,submerged:traversal.submerged},death:{surface_active:death.surface_active,frames_since_last_damage:death.frames_since_last_damage,deaths_this_session:death.deaths_this_session},ui:{mode:ui.mode,dialogue_surface_open:!!ui.dialogue_surface?.open},conversation_open:!!conversation.open,input:{held:input.held,pressed:input.pressed,pending_press:input.pendingPress,pending_release:input.pendingRelease,move:input.move},where,collision};
          if(stableFrames>=120)return {ok:true,...last};
        }
        return {ok:false,...last};
      };
      const walkWithCheckpoint=(points)=>{
        if(!saveWaypoint||routeCheckpoint)return H.walkPath(points,walkOptions);
        let wi=0,wd=Infinity;for(let i=0;i<points.length;i++){const d=Math.hypot(points[i][0]-saveWaypoint[0],points[i][1]-saveWaypoint[1]);if(d<wd){wd=d;wi=i;}}
        if(wd>5)return H.walkPath(points,walkOptions);
        const first=H.walkPath([...points.slice(0,wi+1),saveWaypoint],walkOptions);
        const stable=first.arrived&&first.arrival_is_clean?settleCheckpoint():null;
        if(first.arrived&&first.arrival_is_clean&&stable?.ok)routeCheckpoint={declared_waypoint:saveWaypoint.slice(),route_distance_m:+wd.toFixed(2),state:H.saveState(),where:H.whereAmI(),production_movement:true,production_valid_stable_state:stable};
        if(stopAtWaypoint&&first.arrived&&first.arrival_is_clean&&!stable?.ok)return {...first,arrived:false,arrival_is_clean:false,aborted:'checkpoint-unstable',checkpoint_stability:stable};
        if(routeCheckpoint&&stopAtWaypoint)return {...first,arrived:false,arrival_is_clean:false,aborted:'checkpoint-captured'};
        const second=first.arrived?H.walkPath([saveWaypoint,...points.slice(wi+1)],walkOptions):{arrived:false,arrival_is_clean:false,aborted:first.aborted,frames:0,path_m:0,teleports:0,teleported_m:0,teleport_log:[],survival_inputs:{heals:0,sprint_frames:0,defensive_swings:0},regions_entered:[]};
        return {...second,arrived:first.arrived&&first.arrival_is_clean&&second.arrived&&second.arrival_is_clean,aborted:first.aborted||second.aborted,frames:first.frames+second.frames,path_m:first.path_m+second.path_m,teleports:first.teleports+second.teleports,teleported_m:first.teleported_m+second.teleported_m,teleport_log:[...first.teleport_log,...second.teleport_log],survival_inputs:{heals:first.survival_inputs.heals+second.survival_inputs.heals,sprint_frames:first.survival_inputs.sprint_frames+second.survival_inputs.sprint_frames,defensive_swings:first.survival_inputs.defensive_swings+second.survival_inputs.defensive_swings},regions_entered:[...new Set([...first.regions_entered,...second.regions_entered])]};
      };
      // The Soulrest--Blackrose road crosses the Stone Wastes during shipped salt storms.  Its
      // player-facing counter is not another flask: it is the bowl of a real glassed crater.
      // Locate that shipping signature through the live consumer, leave the road by ordinary
      // movement, descend to its authored centre, and wait there before rejoining the same road.
      // Keeping the two walkPath results also makes a death/respawn on either half fail closed.
      let shelter = null;
      let walked;
      const craters = H.getSignatures({ kind:'glassed_crater', region:'stone-wastes' });
      let craterJoin = null;
      for (const crater of craters) for (let i=0;i<route.length;i++) {
        const d=Math.hypot(route[i][0]-crater.x,route[i][1]-crater.z);
        if (!craterJoin || d<craterJoin.d) craterJoin={ crater, i, d };
      }
      // Roads are deliberately sparse in the wastes.  A competent traveller can see the storm
      // shelter well beyond interaction range, so permit a bounded 300 m ordinary-movement
      // detour rather than requiring the road spline itself to pass within 90 m of the bowl.
      if (shelterRequired && already > 500 && craterJoin && craterJoin.d < 300 && route.length > 2) {
        // The centre floor is deliberately surrounded by an unclimbable-looking glass wall.
        // The shipped shelter predicate reaches 22 m, so enter at the road-facing shoulder:
        // visibly below natural ground, but on the ordinary walkable approach back out.
        const roadPoint=route[craterJoin.i], rdx=roadPoint[0]-craterJoin.crater.x, rdz=roadPoint[1]-craterJoin.crater.z;
        const rdl=Math.hypot(rdx,rdz)||1, shelterRadius=15;
        const bowl=[craterJoin.crater.x+rdx/rdl*shelterRadius,craterJoin.crater.z+rdz/rdl*shelterRadius];
        const inbound=walkWithCheckpoint([...route.slice(0,craterJoin.i+1),bowl]);
        const atBowl=H.whereAmI().pos.slice();
        const arrivedBowl=inbound.arrived && inbound.arrival_is_clean
          && Math.hypot(atBowl[0]-bowl[0],atBowl[2]-bowl[1]) < 2;
        const before=H.getPlayerStats();
        let shelteredReport=H.getHazardReport();
        let waited=0, recoveryHeals=0, stormWasActive=false;
        const shelterTrace=[];
        // Weather transitions on a shipped 72,000-frame cadence.  The old fixed 600-frame wait
        // had no production meaning and sent the player back into the same lethal front.  Remain
        // in the authored counter until the live weather machine says the storm has passed.
        if (arrivedBowl) for (let f=0;f<144060;f+=30) {
          const ps=H.getPlayerStats(), script=[{f:0,release:['sprint','light','heavy','block']}];
          if (ps.hp < ps.hp_max*.9 && ps.estus>0) { script.push({f:0,press:['use_item']},{f:2,release:['use_item']}); recoveryHeals++; }
          H.queueInputs(script); H.stepFrames(30); waited+=30;
          const hr=H.getHazardReport();
          const liveSalt=(hr.here||[]).find(h=>h.id==='salt-storm')||null;
          if (liveSalt && liveSalt.inside) stormWasActive=true;
          if (liveSalt && liveSalt.sheltered) shelteredReport=hr;
          if (waited===30 || waited%3600===0 || (stormWasActive && (!liveSalt || !liveSalt.inside)))
            shelterTrace.push({ frame:waited, weather:H.getEnvironment().weather, stats:H.getPlayerStats(), salt:liveSalt });
          if (stormWasActive && (!liveSalt || !liveSalt.inside)) break;
          // When no storm was active on arrival, a ten-second observation is sufficient; do not
          // manufacture one with a harness weather setter.
          if (!stormWasActive && waited>=600) break;
        }
        const after=H.getPlayerStats();
        const salt=(shelteredReport.here||[]).find(h=>h.id==='salt-storm')||null;
        const outbound=arrivedBowl
          ? H.walkPath([bowl,roadPoint,...route.slice(craterJoin.i+1)],walkOptions)
          : { arrived:false, arrival_is_clean:false, aborted:'crater-unreachable', frames:0, path_m:0, teleports:0, teleported_m:0, teleport_log:[], survival_inputs:{heals:0,sprint_frames:0,defensive_swings:0}, regions_entered:[] };
        shelter={ signature:craterJoin.crater, road_detour_m:+craterJoin.d.toFixed(2), arrived:arrivedBowl,
          waited_frames:waited, hp_before:before.hp, hp_after:after.hp, recovery_heals:recoveryHeals,
          hazard:salt, sheltered:!!(salt&&salt.sheltered), storm_was_active:stormWasActive,
          trace:shelterTrace, inbound, outbound };
        walked={ ...outbound,
          arrived:inbound.arrived&&inbound.arrival_is_clean&&outbound.arrived&&outbound.arrival_is_clean,
          aborted:inbound.aborted||outbound.aborted,
          frames:inbound.frames+waited+outbound.frames,
          minutes:+((inbound.frames+waited+outbound.frames)/3600).toFixed(3),
          path_m:+(inbound.path_m+outbound.path_m).toFixed(1),
          teleports:inbound.teleports+outbound.teleports,
          teleported_m:+(inbound.teleported_m+outbound.teleported_m).toFixed(1),
          teleport_log:[...inbound.teleport_log,...outbound.teleport_log],
          survival_inputs:{ heals:inbound.survival_inputs.heals+recoveryHeals+outbound.survival_inputs.heals,
            sprint_frames:inbound.survival_inputs.sprint_frames+outbound.survival_inputs.sprint_frames,
            defensive_swings:inbound.survival_inputs.defensive_swings+outbound.survival_inputs.defensive_swings },
          regions_entered:[...new Set([...inbound.regions_entered,...outbound.regions_entered])].sort(),
        };
      } else walked=walkWithCheckpoint(route);
      const ended=H.whereAmI().pos.slice(), actualLeft=Math.hypot(x-ended[0],z-ended[2]);
      const namedFailure = (walked.teleports||0)>0 ? 'death-respawn'
        : shelter && !shelter.arrived ? 'crater-entry-failed'
        : shelter && shelter.storm_was_active && !shelter.sheltered ? 'shelter-predicate-inactive'
        : shelter && shelter.outbound && !shelter.outbound.arrived ? 'crater-exit-failed'
        : !walked.arrived ? (walked.aborted || 'journey-incomplete') : actualLeft>reach ? 'final-approach-failed' : null;
      return {
        ok: !namedFailure,
        failure: namedFailure,
        frames: walked.frames,
        left_m: actualLeft,
        started,
        ended,
        production_input: true,
        planned_route: route.slice(0, 40),
        planned_clearance: route.length ? [0,.2,.4,.6,.8,1].map(et=>{const q=route[0];return {et,...H.solidAt(started[0]+(q[0]-started[0])*et,started[1]+.9,started[2]+(q[1]-started[2])*et)};}) : [],
        planner: plannerReport,
        stealth,
        recovery_heals: recoveryHeals,
        shelter,
        hazards: H.getHazardReport(),
        walk: walked,
      };
    };

    const reachNpc = (npcId) => {
      const inside=H.whereAmI().interior;
      let ent=H.listEntities().find((x)=>x.eid===npcId);
      if(inside&&(!ent||ent.interior!==inside)){
        const door=interiorActions[inside];
        if(!door||!door.interior_spawn)return {ok:false,why:`cannot production-exit ${inside} before reaching ${npcId}`};
        H.queueInputs([{f:0,release:['block','interact','use_item','light','sprint']}]);H.stepFrames(180);
        const exitWalk=walkTo(door.interior_spawn[0],door.interior_spawn[2],1.5);
        if(!exitWalk.ok||!(H.whereAmI().door_in_reach||{}).way)return {ok:false,why:`production exit from ${inside} incomplete`,exit_walk:exitWalk};
        H.queueInputs([{f:1,press:['interact']},{f:3,release:['interact']}]);H.stepFrames(8);
        if(H.whereAmI().interior)return {ok:false,why:`production interact did not exit ${inside}`,exit_walk:exitWalk};
        const exit_dialogue=closeDoorwayConversation();
        if(!exit_dialogue.closed)return {ok:false,why:`production doorway conversation held movement after exiting ${inside}`,exit_walk:exitWalk,exit_dialogue};
        H.queueInputs([{f:0,release:['interact','block']}]);H.stepFrames(180);const ev=door.exterior_spawn,ed=door.exterior_door||ev,dx=ev[0]-ed[0],dz=ev[2]-ed[2],dl=Math.hypot(dx,dz)||1;const egress=walkTo(ev[0]+dx/dl*3,ev[2]+dz/dl*3,1.0);
        if(!egress.ok)return {ok:false,why:`production egress from ${inside} incomplete: ${egress.failure}`,exit_walk:exitWalk,exit_dialogue,egress};
      }
      const loc = npcActions[npcId];
      const inferScheduledInterior = (actor) => {
        if(!actor||actor.interior||Math.abs(actor.pos?.[0]??Infinity)>=100||Math.abs(actor.pos?.[2]??Infinity)>=100||!loc?.schedule)return actor;
        const minute=H.whereAmI().hour*60, cv=t=>{const [h,m]=String(t).split(':').map(Number);return h*60+m;};
        const active=loc.schedule.find(s=>{const a=cv(s.from),b=cv(s.to);return b>a?minute>=a&&minute<b:minute>=a||minute<b;});
        return active?.at&&interiorActions[active.at]?{...actor,interior:active.at}:actor;
      };
      // Resolve a scheduled interior before walking to the actor's daytime post. At night the
      // list projection carries cell-local coordinates but no interior id; approaching the old
      // exterior post first can drive straight into an unrelated fitted building and never even
      // attempt the real public doorway (Bel-Mourne at the Grey Hist was the production case).
      ent=inferScheduledInterior(ent);
      // Cross the world before asking its population consumer for an entity. A record with a
      // post supplies the exact public destination; otherwise the settlement station is the
      // player-facing landmark from which the scheduled population is discoverable.
      let approach = null;
      if (!ent?.interior && loc && loc.pos) approach = walkTo(loc.pos[0], loc.pos[2], 4.0);
      else if (loc && loc.settlement) {
        // A scheduled interior's canonical exterior_spawn below is the more precise public
        // landmark; do not add a redundant settlement-centre leg in that case.
        if(!ent?.interior){const station = travelStations.find((x) => x.id === loc.settlement);
        if (station) approach = walkTo(station.x, station.z, 12.0);}
      }
      if (approach && !approach.ok) return { ok:false, why:`production approach to ${npcId} incomplete: ${approach.walk?.aborted || approach.left_m}`, location:loc || null, approach };
      ent = inferScheduledInterior(H.listEntities().find((x) => x.eid === npcId));
      // Site populations have no settlement boundary; this is the same production consumer
      // `stepSettlement` calls for towns, invoked only after the body reached the authored site.
      if (!ent && loc && loc.site && approach && approach.ok) { H.populateSite(loc.site); ent = H.listEntities().find((x) => x.eid === npcId); }
      if (!ent || !ent.pos) return { ok:false, why:`${npcId} absent after reaching its production location`, location:loc || null, approach };
      // Scheduled interior actors expose cell-local coordinates, but older population rows do
      // not copy the schedule's interior id onto listEntities(). Infer only from the actor's own
      // authored active schedule row; never guess an unrelated door from proximity.
      let schedule_entry=null;
      if(ent.interior&&H.whereAmI().interior!==ent.interior){
        const door=interiorActions[ent.interior];if(!door)return {ok:false,why:`scheduled interior ${ent.interior} has no production doorway`,approach};
        // Approach the public-side continuity spawn, not the raw facade anchor.  Fitted
        // production buildings can rotate/resize away from their declared geometry (Archon's
        // inn is one such case), leaving exterior_door inside the solid footprint while
        // exterior_spawn remains the canonical walkable side of the transition.
        const doorstep=door.exterior_spawn||door.exterior_door;
        schedule_entry=walkTo(doorstep[0],doorstep[2],1.5);
        if(!schedule_entry.ok||!(H.whereAmI().door_in_reach||{}).interior)return {ok:false,why:`production door to scheduled ${npcId} unreachable`,approach,schedule_entry};
        // Settle the movement release before using the doorway. A crowded frontage can consume
        // the first interaction as a greeting even though door_in_reach selects the transition;
        // close that player-visible conversation and repeat the ordinary key edge, as the placed
        // document route already does for the same shipping affordance.
        H.queueInputs([{f:0,release:['block','interact','use_item','light','heavy','sprint','roll']}]);H.stepFrames(30);
        for(let retry=0;H.whereAmI().interior!==ent.interior&&retry<3;retry++){
          H.queueInputs([{f:0,press:['interact']},{f:2,release:['interact']}]);H.stepFrames(12);
          const dui=H.getUIState();if(dui.dialogue_surface&&dui.dialogue_surface.open){H.queueInputs([{f:1,press:['block']},{f:3,release:['block']}]);H.stepFrames(8);}
          if(H.whereAmI().interior!==ent.interior){H.queueInputs([{f:0,release:['interact','block']}]);H.stepFrames(30);}
        }
        if(H.whereAmI().interior!==ent.interior)return {ok:false,why:`production interact did not enter scheduled ${ent.interior}`,approach,schedule_entry};
        ent=H.listEntities().find((x)=>x.eid===npcId)||ent;
      }
      const walk = walkTo(ent.pos[0], ent.pos[2], 3.0);
      return { ok:walk.ok, walk, approach, schedule_entry, entity_pos:ent.pos, location:loc || null };
    };

    const reachGiver = (questId) => {
      const def = H.questDef(questId), giver = def && def.giver && def.giver.npc_id;
      if (!giver) return { quest:questId, giver:null, present:false, reached:false, why:'quest names no giver' };
      const reached = reachNpc(giver);
      return { quest:questId, giver, went_to:(npcActions[giver]||{}).settlement || (npcActions[giver]||{}).site || null,
        present:!!reached.entity_pos, reached:reached.ok, why:reached.why || null, ...reached };
    };

    const evidenceSnapshot = (giver) => {
      const where=H.whereAmI(), qs=H.getQuestState(), ui=H.getUIState();
      const ent=giver && H.listEntities().find((x)=>x.eid===giver), pos=where.pos;
      return { where, giver_distance_m:ent&&ent.pos?Math.hypot(ent.pos[0]-pos[0],ent.pos[2]-pos[2]):null,
        topics_known:qs.topicsKnown.slice(), books_read:qs.booksRead.slice(), journal_n:qs.journal.length,
        completed:qs.completed.slice(), active:qs.active.map((q)=>({id:q.id,stage:q.stage,branch:q.branch,flags:{...q.flags}})),
        durable_flags:Object.keys(qs.flags).filter((k)=>qs.flags[k]).sort(), gold:H.getGold?H.getGold():null,
        hour:where.hour, marker_count:ui.markers, ui_mode:ui.mode };
    };

    const sampleStanding = () => {
      const v = H.getGateDispositions();
      const out = {};
      for (const n of gateNpcs) out[n] = v[n] ?? null;
      return out;
    };

    // A bounded run may end on the exact movement frame that consumed maxFrames. Preserve only
    // a production-valid resume state: release player input and require 120 consecutive quiet
    // fixed steps before serialising. This is observation plus ordinary input release, not a
    // pose, combat, UI, quest, or world mutation.
    const captureStableResume = () => {
      H.clearInputs(); let stableFrames=0,last=null;
      for(let waited=0;waited<3600;waited++){
        H.stepFrames(1);
        const combat=H.getCombatState(),player=combat.player||{},stats=H.getPlayerStats(),input=H.getInputState(),traversal=H.getTraversalReport().observed,death=H.getDeathState(),ui=H.getUIState(),conversation=H.getConversationState(),where=H.whereAmI(),collision=H.solidAt(where.pos[0],where.pos[1]+.9,where.pos[2]);
        const clean=player.state==='IDLE'&&!player.move&&Number(player.speed_mps||0)<.01&&!stats.in_combat&&!stats.locked_on&&!stats.mired&&!traversal.mired&&!traversal.sinking&&!traversal.submerged&&!player.pending_reaction&&!player.dead&&!player.hitstop&&!death.surface_active&&Number(death.deaths_this_session||0)===0&&(death.frames_since_last_damage==null||death.frames_since_last_damage>=180)&&ui.mode==='world'&&!ui.dialogue_surface?.open&&!conversation.open&&!collision.solid&&input.held.length===0&&input.pressed.length===0&&input.pendingPress.length===0&&input.pendingRelease.length===0&&Math.hypot(...input.move)<.001;
        stableFrames=clean?stableFrames+1:0;
        last={waited_frames:waited+1,stable_frames:stableFrames,clean,player:{state:player.state,move:player.move||null,speed_mps:player.speed_mps,pending_reaction:player.pending_reaction,dead:player.dead,hitstop:player.hitstop},stats:{hp:stats.hp,hp_max:stats.hp_max,estus:stats.estus,in_combat:stats.in_combat,locked_on:stats.locked_on,mired:stats.mired},traversal:{band:traversal.band,depth_m:traversal.depth_m,substrate:traversal.substrate,mired:traversal.mired,sinking:traversal.sinking,submerged:traversal.submerged},death:{surface_active:death.surface_active,frames_since_last_damage:death.frames_since_last_damage,deaths_this_session:death.deaths_this_session},ui:{mode:ui.mode,dialogue_surface_open:!!ui.dialogue_surface?.open},conversation_open:!!conversation.open,input:{held:input.held,pressed:input.pressed,pending_press:input.pendingPress,pending_release:input.pendingRelease,move:input.move},where,collision};
        if(stableFrames>=120)return {ok:true,...last,state:H.saveState()};
      }
      return {ok:false,...last,state:null};
    };

    const retainResume = (out) => {
      const checkpoint=captureStableResume(); out.resume_stability={...checkpoint};
      if(checkpoint.state){out.resume_state=checkpoint.state;delete out.resume_stability.state;}
    };

    const runChain = (name, plan) => {
      const alreadyCompleted = new Set(H.getQuestState().completed || []);
      const out = {
        chain: name, precompleted: [...alreadyCompleted], completed: [], blocked_at: null, why: null, violent: [], journal_n: 0,
        // per gate NPC: the lowest standing seen at any step of this chain
        floor: {},
        // per QUEST: the standing at this quest's own giver at the instant the chain arrives at
        // it, before anything is done about it.
        //
        // SUCCESSOR ADDITION, and it is the number a clamp should be set from. `floor` is the
        // minimum over EVERY step, which is more conservative than a gate needs: a gate only has
        // to be passable at the moment you walk up to it, and a standing that dipped in Act I and
        // recovered by Act IV is not evidence against an Act IV gate. Setting a clamp from
        // `floor` prices gates that nothing is actually short at; setting it from the cold start
        // (round 1) prices nothing and leaves a margin of exactly zero. `arrival` is the
        // measured form of the round-1 verdict's own prescription — "worst cold-start standing
        // minus the largest cumulative negative faction term the mainline can itself produce at
        // that giver" — with the subtraction performed by the running build rather than by an
        // author's arithmetic.
        arrival: {},
        trace: [],
      };
      const fold = (s) => { for (const [k, v] of Object.entries(s)) { if (v == null) continue; if (out.floor[k] == null || v < out.floor[k]) out.floor[k] = v; } };
      // Frame zero counts: it is a step of the chain like any other.
      let st = sampleStanding(); fold(st);
      out.trace.push({ after: '(cold start)', standing: st });

      for (const step of plan) {
        if (alreadyCompleted.has(step.id)) continue;
        // What the gate would say about THIS quest at the moment the chain reaches it, before
        // anything is done about it. This is the number the round-1 clamp never looked at.
        const activeRecord = H.getQuestState().active.find((q)=>q.id===step.id) || null;
        const offer = activeRecord ? null : (H.questOffers().find((o) => o.id === step.id) || null);
        // The standing at THIS quest's own giver, at the instant the chain arrives. Sampled
        // before `direct open API`, so a gate that the purse then buys open is still recorded at the
        // standing the character actually walked up with.
        {
          const g = (H.questDef(step.id).giver || {}).npc_id;
          if (g) {
            const v = H.getGateDispositions()[g];
            if (v != null) out.arrival[step.id] = v;
          }
        }
        // ---- GAP-W1-quest-givers-not-in-the-world -------------------------------------------
        // Walk to the town this quest's giver lives in, BEFORE asking the gate. This used to
        // happen only on a standing refusal, and it happened by conjuring:
        //
        //     H.direct spawn API({ from_record: giver, pos: [0, 0, 2] })
        //
        // with a comment conceding that `direct open API` already assumed the person was there,
        // "since the gate has never had a proximity term". So the instrument manufactured the
        // one thing it was supposed to be measuring, and 40/40 signatures completed both chains
        // in a world where nine of ninety-four givers existed. `travelToGiver` runs the world's
        // own `populateSettlement`/`populateSite` — the call walking across a town boundary
        // makes — and returns `present: false` when the person's record names no place at all,
        // which is the failure the old line could not express.
        shelterRequired = stormShelterDiagnostic && step.id === 'Q-MAIN-08';
        const trip = activeRecord ? {quest:step.id,giver:(H.questDef(step.id).giver||{}).npc_id,present:true,reached:true,resumed_active:true} : reachGiver(step.id);
        shelterRequired = false;
        out.giver_journeys = out.giver_journeys || []; out.giver_journeys.push({ quest: step.id, phase: 'accept', ...trip });
        if (!trip.present || !trip.reached) { out.giver_absent = out.giver_absent || []; out.giver_absent.push(trip); }
        // Accept through the production conversation choice published by talkTo().  The runner
        // never calls QuestEngine/open or a harness quest verb: if the giver does not publish the
        // choice, play stops here.
        let o = activeRecord ? {ok:true,resumed_active:true} : (trip.reached ? { ok: false, reason: 'acceptance choice absent' } : { ok: false, reason: `production movement did not reach giver: ${trip.why || trip.walk?.walk?.aborted || trip.walk?.left_m}` });
        const giver = (H.questDef(step.id).giver || {}).npc_id;
        const evidence = { quest:step.id, topic:step.topic, prerequisite_topics:step.prereq_topics.slice(),
          arrival:evidenceSnapshot(giver), offer:offer ? {...offer} : null, giver_journey:trip, world_actions:[] };
        const acceptThroughConversation = () => {
          const c = H.talkTo(giver);
          const choice = (c.topics || c.list || []).find((x) => x.id === `quest-accept:${step.id}`);
          if (!choice) { H.conversationClose(); return { ok: false, reason: 'production acceptance choice absent' }; }
          const said = H.conversationSay(choice.id);
          H.conversationClose();
          const qa = said && said.quest_action;
          return qa && qa.act === 'accept' ? qa.result : { ok: false, reason: (said && said.refused) || 'production acceptance refused' };
        };
        if (!activeRecord && trip.reached) try { o = acceptThroughConversation(); } catch (e) { o = { ok: false, reason: String(e && e.message || e) }; }
        // Refused on standing? Go and talk them round, then retry the published choice.
        if (!activeRecord && !o.ok && sabotage !== 'no-purse' && /disposition \d/.test(String((offer && offer.why) || o.reason || ''))) {
          if (giver) {
            try {
              H.talkTo(giver);
              const attempt = { quest: step.id, npc: giver, tries: [] };
              for (let k = 0; k < ATTEMPTS && !o.ok; k++) {
                const gold = H.getGold ? H.getGold() : PURSE;
                const verb = gold >= 1000 ? 'bribe1000' : gold >= 100 ? 'bribe100' : gold >= 10 ? 'bribe10' : 'admire';
                const r = H.conversationPersuade(verb);
                attempt.tries.push({ verb, success: !!r.success, standing: r.standing_now, gold_left: r.gold_left });
                H.conversationClose();
                o = acceptThroughConversation();
                if (!o.ok && k + 1 < ATTEMPTS) H.talkTo(giver);
              }
              attempt.opened = o.ok;
              out.persuasion = out.persuasion || [];
              out.persuasion.push(attempt);
              H.conversationClose();
            } catch (e) { out.persuasion_error = String(e && e.message || e); }
          }
        }
        if (!o.ok) {
          out.blocked_at = step.id;
          out.why = o.reason;
          out.blocked_offer_why = offer ? offer.why : null;
          evidence.failure={phase:'accept',reason:o.reason}; evidence.after=evidenceSnapshot(giver); out.trace.push(evidence); retainResume(out);
          break;
        }
        // Perform every authored reveal through its shipped player-facing world action.
        // Talking/eavesdropping/examining are production verbs. Documents and marks require the
        // same interact input a player presses after walking to the spawned prop.
        out.world_actions = out.world_actions || [];
        const preferredId = prefer[name] && prefer[name][step.id];
        const preferredResolution = step.resolutions.find((x) => x.id === preferredId)
          || [...step.resolutions].sort((a, b) => a.requires_knowing.length - b.requires_knowing.length)[0];
        const neededReveals = new Set((preferredResolution && preferredResolution.requires_knowing) || []);
        for (const r of step.reveals.filter((x) => neededReveals.has(x.id))) {
          const a = { reveal: r.id, channel: r.channel, source: r.source, ok: false };
          try {
            if (r.channel === 'talk_to_target' || r.channel === 'rival_npc') {
              a.reach = reachNpc(r.source); if (!a.reach.ok) throw new Error(a.reach.why || 'source unreachable');
              const st = H.talkTo(r.source); const learned = Array.isArray(st.learned) ? st.learned : (st.learned && st.learned.learned) || []; a.ok = learned.some((x) => x.reveal === r.id && x.ok); H.conversationClose();
            } else if (r.channel === 'eavesdrop') {
              a.reach = reachNpc(r.source); if (!a.reach.ok) throw new Error(a.reach.why || 'source unreachable');
              const st = H.eavesdrop(r.source); const learned = Array.isArray(st) ? st : (st.learned || []); a.ok = learned.some((x) => x.reveal === r.id && x.ok);
            } else if (r.channel === 'corpse') {
              a.reach = reachNpc(r.source); if (!a.reach.ok) throw new Error(a.reach.why || 'source unreachable');
              const st = H.examineCorpse(r.source); const learned = Array.isArray(st) ? st : (st.learned || []); a.ok = learned.some((x) => x.reveal === r.id && x.ok);
            } else if (['book', 'ledger', 'letter'].includes(r.channel) && documentActions[r.source]) {
              const d = documentActions[r.source];
              if (!d.exterior_spawn || !d.interior_spawn) throw new Error(`${d.interior} has no two-sided production doorway`);
              const currentInterior=H.whereAmI().interior;
              if(currentInterior){const currentDoor=interiorActions[currentInterior];if(!currentDoor)throw new Error(`cannot production-exit ${currentInterior} for ${d.interior}`);H.queueInputs([{f:0,release:['block','interact','use_item','light','sprint']}]);H.stepFrames(180);const ew=walkTo(currentDoor.interior_spawn[0],currentDoor.interior_spawn[2],1.5);if(!ew.ok||!(H.whereAmI().door_in_reach||{}).way)throw new Error(`production exit not reachable in ${currentInterior}`);H.queueInputs([{f:1,press:['interact']},{f:3,release:['interact']}]);H.stepFrames(8);if(H.whereAmI().interior)throw new Error(`interact did not leave ${currentInterior}`);if(!closeDoorwayConversation().closed)throw new Error(`doorway conversation held movement after leaving ${currentInterior}`);H.queueInputs([{f:0,release:['interact','block']}]);H.stepFrames(180);const ev=currentDoor.exterior_spawn,ed=currentDoor.exterior_door||ev,dx=ev[0]-ed[0],dz=ev[2]-ed[2],dl=Math.hypot(dx,dz)||1;const egress=walkTo(ev[0]+dx/dl*3,ev[2]+dz/dl*3,1.0);if(!egress.ok)throw new Error(`production egress incomplete after leaving ${currentInterior}`);}
              a.entry_walk = walkTo(d.exterior_spawn[0], d.exterior_spawn[2], 1.5);
              a.entry_prompt = H.whereAmI().door_in_reach;
              if (!a.entry_walk.ok || !a.entry_prompt || a.entry_prompt.interior !== d.interior) throw new Error(`production door not reachable for ${d.interior}`);
              H.queueInputs([{f:0,release:['block','interact','use_item','light','heavy','sprint','roll']}]);H.stepFrames(30);
              H.queueInputs([{ f: 0, press: ['interact'] }, { f: 2, release: ['interact'] }]); H.stepFrames(8);
              // A crowded exterior can consume the first press as a nearby greeting even while
              // the door prompt is the selected world affordance. Close that player-visible
              // surface and press the still-live door once more; no transition state is written.
              for (let retry=0; H.whereAmI().interior !== d.interior && retry<3; retry++) {
                if ((H.getUIState().dialogue_surface||{}).open) {
                  H.queueInputs([{f:1,press:['block']},{f:3,release:['block']}]);H.stepFrames(8);
                }
                // Door transitions are fixed-step affordances; keep the body at the prompted
                // public point and repeat the normal key press after the prior release settles.
                H.queueInputs([{f:0,release:['interact','block']}]);H.stepFrames(30);
                H.queueInputs([{f:0,press:['interact']},{f:2,release:['interact']}]);H.stepFrames(12);
              }
              if (H.whereAmI().interior !== d.interior) throw new Error(`interact did not enter ${d.interior}`);
              a.entry_where=H.whereAmI(); a.entry_ui=H.getUIState();
              if (a.entry_ui.dialogue_surface && a.entry_ui.dialogue_surface.open) {
                H.queueInputs([{f:1,press:['block']},{f:3,release:['block']}]); H.stepFrames(6);
                a.entry_dialogue_closed = !(H.getUIState().dialogue_surface || {}).open;
                if (!a.entry_dialogue_closed) throw new Error(`production dialogue held movement in ${d.interior}`);
              }
              const prop = H.listEntities().find((x) => x.eid === d.eid);
              if (!prop) throw new Error(`${d.eid} absent in entered interior`);
              a.reader_walk = walkTo(prop.pos[0], prop.pos[2], Math.min(prop.reach_m || 1.6, 1.2));
              if (!a.reader_walk.ok) throw new Error(`production movement did not reach ${d.eid}`);
              a.reader_at={where:H.whereAmI(),prop:{eid:prop.eid,pos:prop.pos,reach_m:prop.reach_m,readable_book:prop.readable_book},distance_m:Math.hypot(H.whereAmI().pos[0]-prop.pos[0],H.whereAmI().pos[2]-prop.pos[2])};
              H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]); H.stepFrames(8);
              const ui = H.getUIState();
              a.reader_ui={mode:ui.mode,book:ui.book,books_read:H.getQuestState().booksRead.slice()};
              a.ok = ui.mode === 'book' && ui.book && ui.book.id === d.book && H.getQuestState().booksRead.includes(d.book);
              if (ui.mode === 'book') {
                // Outside combat the book pauses the simulation frame, so a queued `f:1`
                // can never mature. Send the down/up edges at the current paused frame, exactly
                // as the real input path does across two render ticks.
                H.queueInputs([{f:0,press:['menu']}]); H.stepFrames(1);
                H.queueInputs([{f:0,release:['menu']}]); H.stepFrames(1);
                if (H.getUIState().mode === 'book') throw new Error(`production book close failed in ${d.interior}`);
                // Let the production close/release edge finish before feeding locomotion. A
                // held block edge shares the combat controller with movement and otherwise
                // leaves the reader rooted beside tightly placed shelves.
                H.stepFrames(180);
              }
              a.exit_walk = walkTo(d.interior_spawn[0], d.interior_spawn[2], 1.5);
              a.exit_prompt = H.whereAmI().door_in_reach;
              if (!a.exit_walk.ok || !a.exit_prompt || a.exit_prompt.way !== 'out') throw new Error(`production exit not reachable in ${d.interior}`);
              H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]); H.stepFrames(8);
              if (H.whereAmI().interior) throw new Error(`interact did not leave ${d.interior}`);
              if(!closeDoorwayConversation().closed)throw new Error(`doorway conversation held movement after leaving ${d.interior}`);
            } else if (r.channel === 'environment' && markActions[r.source]) {
              const at = markActions[r.source]; let markInterior=null;
              if (at.interior) {
                markInterior=interiorActions[at.interior]; if(!markInterior || !markInterior.exterior_spawn) throw new Error(`${at.interior} has no production doorway`);
                a.entry_walk=walkTo(markInterior.exterior_spawn[0],markInterior.exterior_spawn[2],1.5);
                a.entry_prompt=H.whereAmI().door_in_reach;
                if(!a.entry_walk.ok||!a.entry_prompt||a.entry_prompt.interior!==at.interior)throw new Error(`production door not reachable for ${at.interior}`);
                H.queueInputs([{f:1,press:['interact']},{f:3,release:['interact']}]);H.stepFrames(8);
                const dui=H.getUIState();if(dui.dialogue_surface&&dui.dialogue_surface.open){H.queueInputs([{f:1,press:['block']},{f:3,release:['block']}]);H.stepFrames(6);}
                if(H.whereAmI().interior!==at.interior)throw new Error(`interact did not enter ${at.interior}`);
              } else if (H.whereAmI().interior) throw new Error('exterior mark requested while still inside an interior');
              H.stepFrames(3);
              let prop = H.listEntities().find((x) => x.eid === `mark:${r.source}` || x.eid === `mark:${r.source}#0`);
              if (!prop && at.world) { a.walk = walkTo(at.world[0], at.world[1], 2.0); H.stepFrames(3); prop = H.listEntities().find((x) => x.eid === `mark:${r.source}` || x.eid === `mark:${r.source}#0`); }
              if (prop) { a.walk = walkTo(prop.pos[0], prop.pos[2], Math.max(1.4,Math.min(prop.reach_m || 1.6,1.8))); if (a.walk.ok) { H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]); H.stepFrames(8); const qr=H.getQuestState().active.find(q=>q.id===step.id); a.ok = !!(qr && qr.flags && qr.flags[`know:${r.id}`]); } }
              if(markInterior){H.queueInputs([{f:0,release:['block','interact']}]);H.stepFrames(30);a.exit_walk=walkTo(markInterior.interior_spawn[0],markInterior.interior_spawn[2],1.5);if(!a.exit_walk.ok||!(H.whereAmI().door_in_reach||{}).way)throw new Error(`production exit not reachable in ${at.interior}`);H.queueInputs([{f:1,press:['interact']},{f:3,release:['interact']}]);H.stepFrames(8);if(H.whereAmI().interior)throw new Error(`interact did not leave ${at.interior}`);if(!closeDoorwayConversation().closed)throw new Error(`doorway conversation held movement after leaving ${at.interior}`);}
            }
          } catch (e) { a.error = String(e && e.message || e); }
          out.world_actions.push(a);
        }

        evidence.world_actions = out.world_actions.filter((wa)=>step.reveals.some((rv)=>rv.id===wa.reveal));
        evidence.after_accept=evidenceSnapshot(giver);
        const want = prefer[name] && prefer[name][step.id];
        const ordered = [...step.resolutions].sort((a, b) => (a.id === want ? -1 : b.id === want ? 1 : 0));
        // Select an actually published shipped resolution choice in the giver's ordinary
        // conversation. Absence is a production gate refusal, not something the runner repairs.
        let res;
        let pick = null;
        try {
          const returnTrip = reachGiver(step.id);
          out.giver_journeys.push({ quest: step.id, phase: 'resolve', ...returnTrip });
          if (!returnTrip.reached) throw new Error(`production movement did not reach giver: ${returnTrip.why || returnTrip.walk?.walk?.aborted || returnTrip.walk?.left_m}`);
          const c = H.talkTo(giver);
          const topics = c.topics || c.list || [];
          for (const candidate of ordered) {
            const choice = topics.find((x) => x.id === `quest-resolve:${step.id}:${candidate.id}`);
            if (choice) { pick = { id: candidate.id, violence_required: false }; break; }
          }
          const choice = pick && topics.find((x) => x.id === `quest-resolve:${step.id}:${pick.id}`);
          if (!choice) res = { ok: false, reason: 'no nonviolent production resolution choice available' };
          else {
            const said = H.conversationSay(choice.id);
            res = said && said.quest_action && said.quest_action.act === 'resolve'
              ? said.quest_action.result : { ok: false, reason: (said && said.refused) || 'production resolution refused' };
          }
          H.conversationClose();
        } catch (e) { res = { ok: false, reason: String(e && e.message || e) }; }
        if (!res.ok) { out.blocked_at = step.id; out.why = 'resolve refused — ' + res.reason; evidence.failure={phase:'resolve',reason:res.reason}; evidence.after=evidenceSnapshot(giver); out.trace.push(evidence); retainResume(out); break; }
        if (pick.violence_required) out.violent.push(step.id);
        out.completed.push(step.id);
        st = sampleStanding(); fold(st);
        evidence.after=step.id; evidence.resolution=pick.id; evidence.standing=st; evidence.after_resolution=evidenceSnapshot(giver); out.trace.push(evidence);
        retainResume(out);
        if (stopAfter === step.id) { out.stopped_after=step.id; break; }
      }
      const qs = H.getQuestState();
      out.journal_n = qs.journal.length;
      out.topics_known = (qs.topicsKnown || []).length;
      out.flags_ending = Object.keys(qs.flags).filter((f) => qs.flags[f] && f.startsWith('ending_'));
      return out;
    };

    const rows = [];
    for (const [race, upbringing] of sigs) {
      const row = { race, upbringing, chains: {} };
      for (const name of chainNames) {
        H.setSeed(1337);
        if (resumeState) H.restoreState(resumeState); else {
          H.loadState(STATE);
          H.setGold(sabotage === 'no-purse' ? 0 : PURSE);
          H.setCharacter({ race, upbringing, class: 'reed-walker', birthsign: 'raj-xul' });
        }
        H.setRenderRate(0);
        // Build the same collision/population cell the first live frame builds before planning
        // any movement; planning against EMPTY_CELL makes every street look unobstructed.
        H.stepFrames(2);
        if (resumeState) {
          const entry=captureStableResume(); delete entry.state; row.resume_entry_stability=entry;
          if(!entry.ok){row.chains[name]={chain:name,precompleted:H.getQuestState().completed||[],completed:[],blocked_at:'resume-state',why:'restored production state did not become stable after input release',violent:[],journal_n:H.getQuestState().journal.length,floor:{},arrival:{},trace:[],resume_stability:entry};continue;}
        }
        // THE ONLY THING GRANTED FROM OUTSIDE THE QUEST GRAPH, and it is not granted, it is
        // done: walk up to a carter on the Soulrest quay and be greeted. Everything after this
        // has to arrive through the world's own AddTopic edges.
        const boot = { topics_before: H.getQuestState().topicsKnown.length };
        if (!resumeState && sabotage !== 'no-bootstrap') {
          const b = H.listEntities().find((x) => x.eid === BOOTSTRAP_NPC);
          boot.world_action = b && b.pos ? walkTo(b.pos[0], b.pos[2], 4.0) : { ok:false, why:'bootstrap NPC absent' };
          if (boot.world_action.ok) { H.talkTo(BOOTSTRAP_NPC); H.conversationClose(); }
        }
        boot.topics_after = H.getQuestState().topicsKnown.length;
        row.bootstrap = boot;
        row.chains[name] = runChain(name, plans[name]);
      }
      rows.push(row);
    }
    return { schema: 'elder-souls/mainline-chain-floor@1', harness_version: H.version, gates, rows, routeCheckpoint };
  }, { plans, prefer: PREFER, sigs: SIGS, gateNpcs, gates, sabotage, handFeedReveals, BOOTSTRAP_NPC, STATE, PURSE, ATTEMPTS, documentActions, markActions, npcActions, roads, populationPosts, travelStations, chainNames: CHAIN_NAMES, walkMaxFrames: WALK_MAX_FRAMES, interiorActions, resumeState, stopAfter: STOP_AFTER, saveWaypoint, stopAtWaypoint, stormShelterDiagnostic });
} catch (error) {
  writeJson(path.join(outDir, 'browser-failure.json'), {
    error: String(error && error.message || error),
    stack: String(error && error.stack || ''),
    browser_connected: handle.browser.isConnected(),
    page_closed: handle.page.isClosed(),
    page_errors: handle.errors,
    console_tail: handle.console.slice(-30),
  });
  throw error;
} finally { await handle.close(); }

if (report.routeCheckpoint && waypointStatePath) {
  ensureDir(path.dirname(waypointStatePath));
  writeJson(waypointStatePath, report.routeCheckpoint.state);
  report.routeCheckpoint.state_file = waypointStatePath;
  delete report.routeCheckpoint.state;
}

// ---- reduce ---------------------------------------------------------------------------------
const floors = {};                       // npc -> lowest standing anywhere, any signature, any chain
const floorBySig = {};                   // npc -> {sig, value}
for (const row of report.rows) {
  for (const ch of Object.values(row.chains)) {
    for (const [npc, v] of Object.entries(ch.floor)) {
      if (floors[npc] == null || v < floors[npc]) { floors[npc] = v; floorBySig[npc] = `${row.race}/${row.upbringing}`; }
    }
  }
}

// ARRIVAL: the worst standing any signature walks up to THIS gate with, on either chain. A gate
// only has to be passable when you reach it, so this — not `chain_floor` — is the number a clamp
// is set from. A quest no signature ever reaches has no arrival and reports null; that is a
// completion failure and shows up in `failures`, not here.
const arrivals = {};
const arrivalBySig = {};
for (const row of report.rows) {
  for (const ch of Object.values(row.chains)) {
    for (const [quest, v] of Object.entries(ch.arrival || {})) {
      if (arrivals[quest] == null || v < arrivals[quest]) { arrivals[quest] = v; arrivalBySig[quest] = `${row.race}/${row.upbringing}`; }
    }
  }
}

const perGate = gates.map((g) => ({
  ...g,
  chain_floor: floors[g.npc] ?? null,
  floor_signature: floorBySig[g.npc] || null,
  chain_margin: (floors[g.npc] ?? 0) - g.min,
  arrival_floor: arrivals[g.quest] ?? null,
  arrival_signature: arrivalBySig[g.quest] || null,
  arrival_margin: arrivals[g.quest] == null ? null : arrivals[g.quest] - g.min,
})).sort((a, b) => (a.arrival_margin ?? -1e9) - (b.arrival_margin ?? -1e9));

const finished = report.rows.filter((r) => CHAIN_NAMES.every((name) => !r.chains[name].blocked_at));
const failures = [];
for (const r of report.rows) {
  for (const [name, ch] of Object.entries(r.chains)) {
    if (ch.blocked_at) failures.push(`${r.race}/${r.upbringing} ${name}: ${ch.completed.length}/${plans[name].length}, blocked at ${ch.blocked_at} — ${ch.why}`);
  }
}
const violent = [...new Set(report.rows.flatMap((r) => Object.values(r.chains).flatMap((c) => c.violent)))];

const out = {
  tool: 'tools/quests/mainline-chain-floor.mjs',
  schema: 'elder-souls/mainline-chain-floor@1',
  measured_at: new Date().toISOString(),
  sabotage,
  state: STATE,
  bootstrap_npc: sabotage === 'no-bootstrap' ? null : BOOTSTRAP_NPC,
  hand_fed_topics: sabotage === 'hand-feed',
  signatures: SIGS.length,
  chains_run: CHAIN_NAMES,
  signatures_finishing_selected_chains: finished.length,
  signatures_finishing_both_chains: CHAIN_NAMES.length === 2 ? finished.length : null,
  chain_lengths: { intended: plans.intended.length, backpath: plans.backpath.length },
  bootstrap_sample: report.rows[0] ? report.rows[0].bootstrap : null,
  gates: perGate,
  // A gate whose measured chain floor sits BELOW its `disposition_min` is not a broken gate; it
  // is a PRICED one — some signature has to reach for the purse to get through it. That is the
  // design (see the re-clamp note on `giver.disposition_min_note`). What would be broken is a
  // gate nothing can pay past, and that shows up in `failures`, not here.
  priced_gates: perGate.filter((g) => g.chain_floor < g.min).map((g) => `${g.quest} (${g.npc} floor ${g.chain_floor} vs min ${g.min}, worst ${g.floor_signature})`),
  // The gates somebody actually walks up to short. Under `--sabotage no-purse` this is the set
  // that decides whether a penniless character can finish, and it is a much smaller set than
  // `priced_gates` — most of those dips happen in acts the gate is not in.
  arrival_short: perGate.filter((g) => g.arrival_margin != null && g.arrival_margin < 0)
    .map((g) => `${g.quest} (${g.npc}: arrives ${g.arrival_floor} vs min ${g.min}, short ${Math.round(-g.arrival_margin * 1000) / 1000}, worst ${g.arrival_signature})`),
  gates_never_short: perGate.filter((g) => g.chain_floor >= g.min).length,
  persuasion: report.rows.flatMap((r) => Object.entries(r.chains).flatMap(([n, c]) => (c.persuasion || []).map((p) => ({ sig: `${r.race}/${r.upbringing}`, chain: n, ...p })))),
  failures,
  violent_resolutions_taken: violent,
  route_checkpoint: report.routeCheckpoint || null,
  rows: report.rows,
};
let exportedResumeStates=0;
let resumeOutputFailure=null;
for (const row of out.rows) for (const [chain,ch] of Object.entries(row.chains)) if (ch.resume_state) {
  const exportEligible=!ch.blocked_at&&(!STOP_AFTER||ch.stopped_after===STOP_AFTER);
  if (RESUME_OUTPUT&&exportEligible) {
    if (exportedResumeStates) resumeOutputFailure='--resume-output requires exactly one signature and one chain';
    else { ensureDir(path.dirname(RESUME_OUTPUT)); writeJson(RESUME_OUTPUT,ch.resume_state); exportedResumeStates++; }
  }
  const statePath=path.join(outDir,`resume-${row.race}-${row.upbringing}-${chain}.json`); writeJson(statePath,ch.resume_state);
  ch.resume_state_file=path.basename(statePath); delete ch.resume_state;
}
if (RESUME_OUTPUT && exportedResumeStates !== 1 && !resumeOutputFailure) resumeOutputFailure='--resume-output requested but no completed production-valid stable state was emitted';
out.resume_output=RESUME_OUTPUT?{file:path.relative(process.cwd(),RESUME_OUTPUT),exported_states:exportedResumeStates,failure:resumeOutputFailure}:null;
writeJson(path.join(outDir, 'mainline-chain-floor.json'), out);

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nmainline chain floor — ${SIGS.length} signatures x ${CHAIN_NAMES.length} chain(s), state '${STATE}'${sabotage ? `  [SABOTAGE ${sabotage}]` : ''}`);
  console.log(`bootstrap: ${out.bootstrap_npc ? `greeted ${out.bootstrap_npc}, topics ${out.bootstrap_sample.topics_before} -> ${out.bootstrap_sample.topics_after}` : 'NONE'}; topics hand-fed: ${out.hand_fed_topics}\n`);
  const n2 = (v) => (v == null ? '  -  ' : (Math.round(v * 100) / 100).toFixed(2));
  console.log('  quest        act npc                          min  arrival  margin  worst signature      | chain floor  margin');
  for (const g of perGate) {
    console.log(`  ${g.quest.padEnd(11)} ${String(g.act ?? '-').padEnd(3)} ${g.npc.padEnd(28)} ${String(g.min).padStart(3)}  ${n2(g.arrival_floor).padStart(7)}  ${n2(g.arrival_margin).padStart(6)}  ${(g.arrival_signature || '').padEnd(20)} | ${n2(g.chain_floor).padStart(11)}  ${n2(g.chain_margin).padStart(6)}`);
  }
  const short = perGate.filter((g) => g.arrival_margin != null && g.arrival_margin < 0);
  console.log(`\n  gates some signature ARRIVES SHORT of  ${short.length}/${perGate.length}${short.length ? '  ' + short.map((g) => `${g.quest} by ${(Math.round(-g.arrival_margin * 100) / 100)}`).join(', ') : ''}`);
  console.log(`\n  signatures completing selected chains  ${finished.length}/${SIGS.length}`);
  console.log(`  gates never short of their min     ${out.gates_never_short}/${perGate.length}`);
  console.log(`  PRICED gates (floor below the min, so somebody has to pay)  ${out.priced_gates.length}`);
  for (const s of out.priced_gates) console.log(`     ${s}`);
  const paid = out.persuasion.filter((p) => p.opened).length;
  console.log(`  gate-openings bought with the purse ${paid} across ${new Set(out.persuasion.map((p) => p.sig)).size} signatures`);
  for (const f of failures.slice(0, 12)) console.log(`     FAIL ${f}`);
  if (failures.length > 12) console.log(`     ... and ${failures.length - 12} more`);
  console.log(`  violent resolutions taken          ${violent.length}`);
  console.log(`\nwrote ${path.join(outDir, 'mainline-chain-floor.json')}`);
}

const ok = failures.length === 0 && !resumeOutputFailure;
process.exit(ok ? 0 : 1);
