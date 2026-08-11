#!/usr/bin/env node
// W1-04 / S42 cheap fail-closed gate: freeze the shipped population and classify all 20 judges.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/w1-04-r7/freeze.json');
const owned = [
  'world.settlement.anatomy', 'world.interior.named', 'world.interior.continuity',
  'world.npc.population', 'world.npc.schedule', 'world.property.ownership',
  'world.locks.security', 'world.faction.presence', 'world.persistence.state',
];
const itemIds = ['RI-AI07','RI-CAM05','RI-CHR02','RI-CRM01','RI-DLG02','RI-DLG03','RI-LOR01','RI-LOR02','RI-LOR04','RI-LOR06','RI-PRG03','RI-QST03','RI-QST07','RI-QST08','RI-STL02','RI-TRV01','RI-WLD03','RI-WLD07','RI-WLD08','RI-WLD13'];
const itemFile = new Map();
for (const dir of ['10-combat','15-camera','20-progression','22-character','23-stealth-crime','30-quests','40-dialogue','50-world','60-lore']) {
  const abs = path.join(ROOT, 'corpus', dir);
  for (const name of fs.readdirSync(abs)) for (const id of itemIds) if (name.startsWith(id + '-')) itemFile.set(id, `corpus/${dir}/${name}`);
}
const loadDir = (rel) => fs.readdirSync(path.join(ROOT, rel)).filter(f => f.endsWith('.json')).sort().map(file => {
  const bytes = fs.readFileSync(path.join(ROOT, rel, file));
  return { file: `${rel}/${file}`, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), data: JSON.parse(bytes) };
});
const settlements = loadDir('game/data/world/settlements');
const interiors = loadDir('game/data/world/interiors');
const npcs = loadDir('game/data/npcs');
const properties = loadDir('game/data/world/property');
const placed = new Map();
const exteriorById = new Map();
for (const {data:s} of settlements) for (const b of (s.buildings || [])) {
  if (b.id) exteriorById.set(b.id, {...b, settlement:s.id});
  if (b.interior) placed.set(b.interior, { settlement:s.id, building:b.id });
}
if (process.argv.includes('--self-test-orphan')) placed.delete(interiors[0].data.id);
const orphans = interiors.filter(({data}) => !placed.has(data.id)).map(({data}) => ({ id:data.id, declared_settlement:data.settlement || null }));
const requiredM71 = ['exterior_building_id','door_world_pos','door_world_bearing_deg','storeys','apertures','seamless','see_into','water_plane_m'];
if (process.argv.includes('--self-test-contract')) delete interiors[0].data.door_world_pos;
const contractMissing = interiors.map(({data}) => ({ id:data.id, missing:requiredM71.filter(k => !(k in data)) })).filter(r => r.missing.length);
const angleDelta = (a,b) => Math.abs((((a-b)+540)%360)-180);
const auditRows = interiors.filter(({data}) => requiredM71.every(k => k in data)).map(({data:r}) => {
  const e = exteriorById.get(r.exterior_building_id);
  if (!e) return {id:r.id, exterior_building_id:r.exterior_building_id, orphan:true};
  const interiorArea = r.storeys.reduce((n,s)=>n+Number(s.area_m2||0),0);
  const exteriorArea = Number(e.footprint_m2||0) * r.storeys.length;
  const apertureKey = a => `${a.kind}:${(a.world_pos||[]).map(Number).join(',')}`;
  const ia = r.apertures.map(apertureKey).sort(), ea = (e.apertures||[]).map(apertureKey).sort();
  const top = Math.max(...r.storeys.map(s=>Number(s.floor_height_m||0))) + ((r.bounds_m?.y?.[1]||3.2));
  return {id:r.id, exterior_building_id:e.id, orphan:false,
    n1_ratio:exteriorArea ? +(interiorArea/exteriorArea).toFixed(4) : null,
    n2_bearing_delta_deg:+angleDelta(r.door_world_bearing_deg,e.door_world_bearing_deg).toFixed(3),
    n4_aperture_diff:ia.length===ea.length && ia.every((v,i)=>v===ea[i]) ? 0 : Math.max(ia.length,ea.length),
    n5_top_below_roofline_m:+(Number(e.roofline_m||0)-top).toFixed(3)};
});
const breaches = {
  n1:auditRows.filter(r=>r.orphan || r.n1_ratio<0.70 || r.n1_ratio>1.15),
  n2:auditRows.filter(r=>r.orphan || r.n2_bearing_delta_deg>5),
  n4:auditRows.filter(r=>r.orphan || r.n4_aperture_diff>0),
  n5:auditRows.filter(r=>r.orphan || r.n5_top_below_roofline_m<0),
};
const m71Fail = breaches.n2.length > 0 || breaches.n1.length/interiors.length > .02 || breaches.n4.length/interiors.length > .02 || breaches.n5.length/interiors.length > .02;
const npcRows = npcs.flatMap(({data}) => data.npcs || []);

// S42 makes applicability row-level. These are execution classifications, not scores: mixed means
// native rows must still be selected from the item; external means cite sibling evidence only.
const applicability = {
  'RI-AI07':'mixed','RI-CAM05':'mixed','RI-CHR02':'mixed','RI-CRM01':'mixed',
  'RI-DLG02':'mixed','RI-DLG03':'mixed','RI-LOR01':'external','RI-LOR02':'external',
  'RI-LOR04':'external','RI-LOR06':'mixed','RI-PRG03':'external','RI-QST03':'mixed',
  'RI-QST07':'mixed','RI-QST08':'mixed','RI-STL02':'mixed','RI-TRV01':'mixed',
  'RI-WLD03':'owned','RI-WLD07':'mixed','RI-WLD08':'owned','RI-WLD13':'owned',
};
const ledger = itemIds.map(id => ({ item:id, source:itemFile.get(id), applicability:applicability[id], disposition:applicability[id] === 'external' ? 'sibling evidence required; no rebuild' : 'execute every native row whose population or predicate reads an owned path' }));
const report = {
  schema:'elder-souls/w1-04-s42-freeze@1',
  commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
  generated_at:new Date().toISOString(), owned_paths:owned,
  manifest:{ settlements:settlements.map(x=>({file:x.file,id:x.data.id,sha256:x.sha256})), interiors:interiors.map(x=>({file:x.file,id:x.data.id,sha256:x.sha256})), npc_files:npcs.map(x=>({file:x.file,sha256:x.sha256})), property_files:properties.map(x=>({file:x.file,sha256:x.sha256})) },
  counts:{settlements:settlements.length,interiors:interiors.length,npc_files:npcs.length,npc_records:npcRows.length,property_files:properties.length},
  s42:{denominator:interiors.length,placed:placed.size,orphans,zero_orphans:orphans.length===0},
  m71_contract:{required_fields:requiredM71,complete_records:interiors.length-contractMissing.length,incomplete_records:contractMissing.length,rows:contractMissing},
  m71_audit:{population:auditRows.length,breach_counts:Object.fromEntries(Object.entries(breaches).map(([k,v])=>[k,v.length])),rows:auditRows,
    worst_n1:auditRows.filter(r=>!r.orphan).sort((a,b)=>Math.abs(1-b.n1_ratio)-Math.abs(1-a.n1_ratio)).slice(0,10)},
  applicability_ledger:ledger,
  hard_failures:[...(orphans.length ? [`${orphans.length} orphan interior(s)`] : []), ...(contractMissing.length ? [`${contractMissing.length} interior record(s) lack the native M71 data contract`] : []), ...(m71Fail ? ['native M71 tolerance breach'] : [])],
  outcome:(orphans.length || contractMissing.length || m71Fail) ? 'RED' : 'GREEN',
};
fs.mkdirSync(path.dirname(OUT), {recursive:true});
fs.writeFileSync(OUT, JSON.stringify(report,null,2)+'\n');
console.log(`w1-04-r7-freeze @ ${report.commit.slice(0,7)}: ${report.counts.settlements} settlements, ${report.counts.interiors} interiors, ${report.counts.npc_records} NPCs; ${orphans.length} orphan(s); ${contractMissing.length} M71-contract-incomplete record(s)`);
console.log(`20/20 judges classified; ${report.outcome}; -> ${path.relative(ROOT,OUT)}`);
if (report.outcome === 'RED') process.exit(1);
