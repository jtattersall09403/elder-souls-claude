#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.resolve(process.argv[2] || 'evidence/W1-19/q-main-07-checkpoint.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const fixturePath = path.resolve(path.dirname(manifestPath), manifest.fixture);
const state = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const fail = (message) => { console.error(`checkpoint invalid: ${message}`); process.exit(1); };
const hashFiles = (files) => {
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) hash.update(`${path.relative(root,file)}\0`).update(fs.readFileSync(file)).update('\0');
  return `sha256:${hash.digest('hex')}`;
};
const filesBelow = (dir) => fs.readdirSync(dir, { recursive:true, withFileTypes:true })
  .filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath || entry.path, entry.name));
const inputs = {
  quests: hashFiles(filesBelow(path.join(root, 'game/data/quests'))),
  npcs: hashFiles(filesBelow(path.join(root, 'game/data/npcs'))),
  world_route: hashFiles([
    path.join(root, 'game/data/world/roads.json'),
    path.join(root, 'game/data/world/population-posts.json'),
    path.join(root, 'game/data/world/travel/stations.json'),
  ]),
  save_schema: hashFiles(filesBelow(path.join(root, 'game/src/save'))),
};
for (const [group, digest] of Object.entries(inputs)) if (manifest.input_hashes[group] !== digest) fail(`${group} input hash changed`);
if (state.meta?.schema !== manifest.save_schema.schema || state.meta?.schema_version !== manifest.save_schema.version || state.meta?.harness_version !== manifest.harness_version) fail('save/harness schema mismatch');
const signature = state.identity?.creation;
for (const [key,value] of Object.entries(manifest.character)) if (signature?.[key] !== value) fail(`character ${key} mismatch`);
const completed = Object.entries(state.quests || {}).filter(([,q]) => q.opened && q.stage >= 90).map(([id]) => id).sort();
if (JSON.stringify(completed) !== JSON.stringify([...manifest.completed_quests].sort())) fail('completed quest set mismatch');
const active = Object.entries(state.quests || {}).filter(([,q]) => q.opened && q.stage < 90 && !q.failed).map(([id]) => id).sort();
if (JSON.stringify(active) !== JSON.stringify([...manifest.active_quests].sort())) fail('active quest set mismatch');
if (manifest.provenance.violent_resolutions !== 0 || manifest.provenance.direct_progression_mutations !== 0 || !manifest.provenance.production_player_actions) fail('provenance declaration is not production-valid');
if ((state.world?.npcs_dead || []).length || (state.world?.enemies_dead_until_rest || []).length) fail('checkpoint contains a violent world resolution');
const fixtureHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(fixturePath)).digest('hex')}`;
if (fixtureHash !== manifest.fixture_hash) fail('fixture hash mismatch');
console.log(`checkpoint valid: ${path.relative(root, fixturePath)} (${fixtureHash})`);
console.log(`completed: ${completed.join(', ')}; active: ${active.join(', ') || '(none)'}`);
