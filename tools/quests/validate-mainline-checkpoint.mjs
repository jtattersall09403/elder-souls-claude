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
  // Manifests are portable evidence, so their path component must not depend on the host OS.
  // The canonical fixture was sealed on a POSIX host; hashing Windows `\\` separators made the
  // unchanged inputs look stale on a production GPU machine.
  for (const file of files.sort()) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    hash.update(`${relative}\0`).update(fs.readFileSync(file)).update('\0');
  }
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
  production_runtime: hashFiles([
    path.join(root, 'game/data/index.json'),
    path.join(root, 'game/data/items/writ.json'),
    path.join(root, 'game/src/engine.js'),
    path.join(root, 'game/src/harness/api.js'),
    path.join(root, 'game/src/input/pipeline.js'),
    path.join(root, 'game/src/world/population.js'),
  ]),
  instruments: hashFiles([
    path.join(root, 'tools/quests/mainline-chain-floor.mjs'),
    path.join(root, 'tools/quests/mainline-production-guard.mjs'),
    path.join(root, 'tools/quests/validate-mainline-checkpoint.mjs'),
  ]),
};
for (const [group, expected] of Object.entries(manifest.input_hashes)) {
  if (!inputs[group]) fail(`unknown input hash group ${group}`);
  if (inputs[group] !== expected) fail(`${group} input hash changed`);
}
if (state.meta?.schema !== manifest.save_schema.schema || state.meta?.schema_version !== manifest.save_schema.version || state.meta?.harness_version !== manifest.harness_version) fail('save/harness schema mismatch');
const signature = state.identity?.creation;
for (const [key,value] of Object.entries(manifest.character)) if (signature?.[key] !== value) fail(`character ${key} mismatch`);
const completed = Object.entries(state.quests || {}).filter(([,q]) => q.opened && q.stage >= 90).map(([id]) => id).sort();
if (JSON.stringify(completed) !== JSON.stringify([...manifest.completed_quests].sort())) fail('completed quest set mismatch');
const active = Object.entries(state.quests || {}).filter(([,q]) => q.opened && q.stage < 90 && !q.failed).map(([id]) => id).sort();
if (JSON.stringify(active) !== JSON.stringify([...manifest.active_quests].sort())) fail('active quest set mismatch');
if (manifest.position) {
  if (JSON.stringify(state.pose?.pos) !== JSON.stringify(manifest.position.pos)
    || (state.pose?.settlement ?? null) !== (manifest.position.settlement ?? null)
    || (state.pose?.region ?? null) !== (manifest.position.cell ?? null)
    || (state.pose?.interior ?? null) !== (manifest.position.interior ?? null)) fail('pose/cell mismatch');
}
if (manifest.clock && (state.clock?.day_count !== manifest.clock.day
  || state.clock?.time_of_day !== manifest.clock.hour
  || (manifest.weather != null && state.clock?.weather !== manifest.weather))) fail('clock/weather mismatch');
if (manifest.health && (state.fight?.player?.hp !== manifest.health.hp
  || state.fight?.player?.hpMax !== manifest.health.hp_max
  || state.fight?.player_ctl?.estus !== manifest.health.estus)) fail('health/flask mismatch');
if (!manifest.provenance?.production_player_actions) fail('provenance declaration is not production-valid');
for (const field of [
  'violent_resolutions',
  'direct_progression_mutations',
  'teleports',
  'deaths_or_respawns',
  'bought_openings',
  'synthetic_spawns',
  'topic_or_reveal_hand_feeds',
  'direct_pose_mutations',
  'file_side_progress_injection',
]) {
  // The first checkpoint predates the expanded provenance vocabulary. Every field a manifest
  // declares is nevertheless consumed fail-closed, and current manifests declare the full set.
  if (Object.hasOwn(manifest.provenance, field) && manifest.provenance[field] !== 0) {
    fail(`provenance ${field} is not zero`);
  }
}
const expectedNonviolentNpcDeaths = [...(manifest.provenance.allowed_nonviolent_npcs_dead || [])].sort();
const actualNpcDeaths = [...(state.world?.npcs_dead || [])].sort();
if (JSON.stringify(actualNpcDeaths) !== JSON.stringify(expectedNonviolentNpcDeaths)) fail('checkpoint NPC death set differs from declared nonviolent consequences');
if ((state.world?.enemies_dead_until_rest || []).length) fail('checkpoint contains a violent enemy resolution');
const fixtureHash = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(fixturePath)).digest('hex')}`;
if (fixtureHash !== manifest.fixture_hash) fail('fixture hash mismatch');
console.log(`checkpoint valid: ${path.relative(root, fixturePath)} (${fixtureHash})`);
console.log(`completed: ${completed.join(', ')}; active: ${active.join(', ') || '(none)'}`);
