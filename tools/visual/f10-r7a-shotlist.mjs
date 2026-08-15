#!/usr/bin/env node
/**
 * f10-r7a-shotlist.mjs — decide WHERE to point the camera and WHO to photograph, offline.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND WHY IT IS SEPARATE FROM THE CAPTURE
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Two findings, both measured, both of which say the shot list — not the renderer — decided the
 * result of the last three paid runs:
 *
 *  1. `W1-F10-r7.json`: *"the three F10 stands offer at most 0.034 m of per-foot ground
 *     difference — a capture there is predetermined to be a null, whatever the GPU."*
 *  2. `W1-F10-r6-appearance.json` and r7 both: **`hum.imperial-clerk` has never been in frame.**
 *     Subjects were chosen by PROXIMITY to three fixed stands, and both humanoids standing near
 *     those stands hash to `hum.dunmer-lean`. Four rounds photographed the same two bodies.
 *
 * A shot list is a hypothesis about where the thing under test is visible. Nobody had checked
 * this one, so it is checked here, before any money is spent — and it is checked OFFLINE, because
 * every input is a pure function of shipped data:
 *
 *  - **The ground** is `WorldField.heightAt`, which is literally what `renderer.groundAt`'s
 *    province branch returns (renderer.js:630-634) and what `renderer.groundResolver` resolves to
 *    (engine.js:543). The foot conform and the new NPC placement both read that function.
 *  - **The variant** is `characterFor()` in `actor.js:2052-2065`: FNV-1a over `group.name`, which
 *    `syncNPCs` sets to `npc:<eid>`, modulo the family's character pool. It is deterministic, so
 *    which body an eid gets is knowable without booting anything. `--verify` re-derives the pool
 *    from `actor.js` at run time and fails if the file's pool has changed under this tool.
 *  - **The authored height** is `post.pos[1]` in `game/data/npcs/*.json`, taken verbatim by
 *    `sim/npc.js:62`.
 *
 * WHAT IT REPORTS AND WHAT EACH COLUMN IS FOR
 *
 *  - `ground_error_m` = authored y − ground y. This is the defect round 7 fixed: negative is
 *    buried, positive is airborne. It also decides **which subjects are comparable between the
 *    two arms at all**: a subject whose error is ~0 stands in the same place in both arms, so a
 *    face close-up of it is a fair before/after of the EYE. A subject with a large error is in a
 *    different place in each arm, which is the point of the wide shot and useless for the eye.
 *  - `variant` — so a subject can be chosen because of the body it wears rather than because of
 *    where it happens to stand.
 *
 * Usage:
 *   node tools/visual/f10-r7a-shotlist.mjs --stand 2766,5011 --radius 60
 *   node tools/visual/f10-r7a-shotlist.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { WorldField } from '../../game/src/world/field.js';
import { artFamilyForRace } from '../../game/src/render/lib/race-art.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/** `actor.js:2060-2064`, verbatim. FNV-1a over the group name. */
export function fnv1a(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/**
 * Re-derive the character pools FROM `actor.js` rather than retyping them, so this tool cannot
 * drift from the file it is modelling. HAZARDS §17: an inherited tool carries its author's
 * assumptions in its constants — so this constant is read, not written.
 */
export function poolsFromActorSource(src) {
  const block = src.match(/const CHARACTER_SPECS = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error('CHARACTER_SPECS block not found in actor.js — the pool cannot be derived');
  const ids = [];
  for (const m of block[1].matchAll(/^\s*'([a-z0-9.$-]+)':\s*\{\s*base:\s*'([a-z0-9.]+)'/gim)) {
    ids.push({ id: m[1], base: m[2] });
  }
  const FAMILY_BASE = { saxhleel: 'base.saxhleel', humanoid: 'base.humanoid', undead: 'base.humanoid', beast: 'base.slitherfang' };
  const pools = {};
  for (const family of Object.keys(FAMILY_BASE)) {
    const base = FAMILY_BASE[family];
    const all = ids.filter((r) => r.base === base).map((r) => r.id);
    const pool = all.filter((id) => (family === 'undead') === /drowned|undead/.test(id));
    pools[family] = pool.length ? pool : all;
  }
  return { pools, count: ids.length };
}

/** `characterFor()` for an NPC: the player short-circuit does not apply, `characterId` is unset. */
export function variantFor(eid, family, pools) {
  const list = pools[family] || pools.humanoid;
  if (!list || !list.length) return null;
  return list[fnv1a(`npc:${eid}`) % list.length];
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — arms required to disagree.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const fails = [];
  const src = fs.readFileSync(path.join(ROOT, 'game/src/render/actor.js'), 'utf8');
  const { pools, count } = poolsFromActorSource(src);
  if (count < 10) fails.push(`only ${count} character specs parsed out of actor.js — the regex is wrong`);
  if (!pools.humanoid.includes('hum.imperial-clerk')) fails.push('hum.imperial-clerk is not in the humanoid pool');
  if (pools.humanoid.includes('hum.drowned')) fails.push('hum.drowned must be filtered out of the humanoid pool');
  if (!pools.undead.includes('hum.drowned')) fails.push('hum.drowned must be the undead pool');
  if (!pools.saxhleel.includes('player.saxhleel')) fails.push('player.saxhleel missing from the saxhleel pool');
  // FNV-1a against a value computed by hand from the algorithm in actor.js.
  let h = 2166136261; for (const c of 'npc:x') { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  if (fnv1a('npc:x') !== (h >>> 0)) fails.push('fnv1a disagrees with the inline reference');
  // THE ONE THAT MATTERS: the hash must actually spread. If every eid mapped to one variant the
  // tool would "work" and report a single body, which is exactly the defect it exists to fix.
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(variantFor(`e${i}`, 'humanoid', pools));
  if (seen.size !== pools.humanoid.length) fails.push(`400 eids reached only ${seen.size} of ${pools.humanoid.length} humanoid variants`);
  // And two different eids must be able to disagree — a constant function would pass the above.
  if (variantFor('a', 'humanoid', pools) === variantFor('b', 'humanoid', pools)
      && variantFor('c', 'humanoid', pools) === variantFor('d', 'humanoid', pools)
      && variantFor('a', 'humanoid', pools) === variantFor('c', 'humanoid', pools)) {
    fails.push('variantFor looks constant');
  }
  // AND THE ONE THAT CAUGHT A REAL BUG IN THIS FILE. The first version read `r.eid`, which does
  // not exist on an NPC record (the field is `id`), so every key was the string `npc:undefined`
  // and the tool confidently reported that 49 people in Lilmoth wear two bodies between them.
  // A hash of one repeated key is indistinguishable from a working hash unless you check it.
  if (variantFor(undefined, 'humanoid', pools) === variantFor('lilmoth-factor-0', 'humanoid', pools)
      && variantFor(undefined, 'humanoid', pools) === variantFor('lilmoth-dock-3', 'humanoid', pools)) {
    fails.push('an undefined eid is hashing to the same variant as real eids — the id field is wrong');
  }
  const realIds = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/npcs/pop-lilmoth.json'), 'utf8')).npcs.map((r) => r.id);
  if (realIds.some((v) => !v)) fails.push('pop-lilmoth.json has a record with no id — the reader is looking at the wrong field');
  console.log(fails.length ? `SELF-TEST FAILED\n  ${fails.join('\n  ')}`
    : `SELF-TEST PASSED — 7 checks; humanoid pool ${pools.humanoid.join(', ')}`);
  process.exit(fails.length ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
const field = new WorldField(J('game/data/world/terrain.json'), J('game/data/world/regions.json'), J('game/data/world/water.json'));
const { pools } = poolsFromActorSource(fs.readFileSync(path.join(ROOT, 'game/src/render/actor.js'), 'utf8'));

const [sx, sz] = String(args.stand || '2766,5011').split(',').map(Number);
const RADIUS = Number(args.radius || 60);

const dir = path.join(ROOT, 'game/data/npcs');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const people = [];
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const recs = Array.isArray(doc) ? doc : (doc.npcs || doc.records || Object.values(doc).find(Array.isArray) || []);
  for (const r of recs) {
    if (!r || typeof r !== 'object') continue;
    // The DRAWN person is the one with a post: `sim/npc.js` reads `post.pos`, and an NPC with no
    // post is inside a cell rather than on the street.
    const p = (r.post && r.post.pos) || r.pos;
    if (!p) continue;
    const [x, y, z] = [Number(p[0]), Number(p[1]), Number(p[2])];
    const d = Math.hypot(x - sx, z - sz);
    if (d > RADIUS) continue;
    // THE eid IS THE RECORD'S `id`, not an `eid` field. `engine.js:2304` sets `merged.eid =
    // rec2.id` and `sim/npc.js:41` copies it, and `syncNPCs` writes `npc:<eid>` as the group
    // name — which is the hash key. The first version of this tool read `r.eid`, got `undefined`
    // for all 49 records, and reported that every NPC in Lilmoth wears one of two bodies. It was
    // a plausible, wrong answer produced with total confidence, which is why the assertion below
    // exists and why the run fails rather than reports.
    const eid = String(r.id || r.eid || '');
    if (!eid || eid === 'undefined') throw new Error(`record in ${f} has no id — the variant hash key would be 'npc:undefined' for every one of them`);
    const race = String(r.race || 'saxhleel').toLowerCase();
    const family = artFamilyForRace(race);
    const g = field.heightAt(x, z);
    people.push({
      eid, name: r.name || eid, race, family,
      variant: variantFor(eid, family, pools),
      file: f, x: +x.toFixed(2), z: +z.toFixed(2),
      authored_y: +y.toFixed(3), ground_y: +g.toFixed(3),
      ground_error_m: +(y - g).toFixed(3),
      dist_from_stand_m: +d.toFixed(1),
    });
  }
}
people.sort((a, b) => a.dist_from_stand_m - b.dist_from_stand_m);

const byVariant = {};
for (const p of people) (byVariant[p.variant] = byVariant[p.variant] || []).push(p.eid);
const buried = people.filter((p) => p.ground_error_m < -0.15);
const airborne = people.filter((p) => p.ground_error_m > 0.15);
const onGround = people.filter((p) => Math.abs(p.ground_error_m) <= 0.15);
// A subject the two arms can BOTH photograph in the same place — the eye comparison needs one.
const armStable = people.filter((p) => Math.abs(p.ground_error_m) <= 0.05);

const out = {
  tool: 'f10-r7a-shotlist', generated: new Date().toISOString(),
  stand: [sx, sz], radius_m: RADIUS,
  npc_files_read: files.length, people_within_radius: people.length,
  ground_source: 'WorldField.heightAt — the same function renderer.groundAt returns for cell=province (renderer.js:630-634)',
  variant_source: 'characterFor() in actor.js:2052-2065, pools re-derived from CHARACTER_SPECS at run time',
  census: {
    buried_over_0_15m: buried.length, airborne_over_0_15m: airborne.length, on_ground: onGround.length,
    worst_buried_m: buried.length ? Math.min(...buried.map((p) => p.ground_error_m)) : null,
    worst_airborne_m: airborne.length ? Math.max(...airborne.map((p) => p.ground_error_m)) : null,
  },
  variants_present: Object.fromEntries(Object.entries(byVariant).map(([k, v]) => [k, v.length])),
  arm_stable_subjects: armStable.map((p) => ({ eid: p.eid, variant: p.variant, family: p.family, ground_error_m: p.ground_error_m, dist_from_stand_m: p.dist_from_stand_m })),
  people,
};
if (args.out) { fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true }); fs.writeFileSync(path.resolve(args.out), `${JSON.stringify(out, null, 2)}\n`); }

console.log(`${people.length} posted NPCs within ${RADIUS} m of ${sx},${sz} (${files.length} data files read)`);
console.log(`census by AUTHORED height: ${buried.length} buried >0.15 m (worst ${out.census.worst_buried_m}), `
  + `${airborne.length} airborne >0.15 m (worst ${out.census.worst_airborne_m}), ${onGround.length} on the ground`);
console.log(`variants present: ${JSON.stringify(out.variants_present)}`);
console.log(`arm-stable subjects (|error| <= 0.05 m, so both arms draw them in the same place): ${armStable.length}`);
console.log('\neid                       variant                 race        dist   authored   ground   error');
for (const p of people.slice(0, Number(args.top || 40))) {
  console.log(`${p.eid.padEnd(25)} ${String(p.variant).padEnd(22)} ${p.race.padEnd(11)} ${String(p.dist_from_stand_m).padStart(5)} `
    + `${String(p.authored_y).padStart(9)} ${String(p.ground_y).padStart(8)} ${String(p.ground_error_m).padStart(8)}`);
}
