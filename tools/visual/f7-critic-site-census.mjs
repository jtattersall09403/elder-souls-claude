#!/usr/bin/env node
/**
 * f7-critic-site-census.mjs — F7 CRITIC. DOES THE DECK LAND WHERE IT SAYS IT LANDS?
 *
 * The builder's headline artefact (before-after-topdown.png) is captioned `vista-deep-marshes`
 * and its in-frame region label reads `western-rootlands`. The builder separately recorded that
 * `eye-blackwood` puts the camera under terrain and ALSO reads `western-rootlands`, and called
 * that a deck issue it did not own. Two sites reading the same wrong region is not two site
 * bugs; it is a hypothesis that `teleport` is not doing what the deck thinks.
 *
 * This runs no shader edits and takes no recompiles. For every deck setup it teleports, settles,
 * snapshots, and records: the deck's declared (x,z), the observed player position, the observed
 * region id, the terrain height under the player, and the camera's y relative to it.
 *
 *   node tools/visual/f7-critic-site-census.mjs --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f7-critic/site-census');
fs.mkdirSync(OUT, { recursive: true });
const SEED = Number(args.seed || DECK.capture.seed);

const g = await launchGame({ entry: 'game/index.html', width: 960, height: 540 });
await g.h('ready');
await g.h('setSeed', SEED);
const step = (n) => g.h('stepFrames', n);

const probe = () => g.page.evaluate(() => {
  const E = window.__ENGINE, R = E.renderer;
  const p = E.player || E.world?.player || null;
  const pos = p?.pos ? [p.pos.x, p.pos.y, p.pos.z] : null;
  let region = null;
  try { region = R.field?.regionAt ? R.field.regionAt(pos[0], pos[2]) : null; } catch { /* */ }
  if (region && typeof region === 'object') region = region.id || region.name || JSON.stringify(region).slice(0, 60);
  let ground = null, water = null;
  try { ground = R.field?.heightAt ? R.field.heightAt(pos[0], pos[2]) : null; } catch { /* */ }
  try { water = R.field?.waterSurfaceAt ? R.field.waterSurfaceAt(pos[0], pos[2]) : null; } catch { /* */ }
  // The on-screen region label, read from the DOM, which is what the artefact photographs.
  let label = null;
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent || '').trim();
    if (el.children.length === 0 && /^[a-z-]{4,30}$/.test(t) && /rootlands|marsh|blackwood|coast|hive|clay|salt|stone|valus|thorn|wastes|forest/.test(t)) { label = t; break; }
  }
  return { pos, region, ground, water, label, cellName: R.cell || null };
});

const rows = [];
for (const s of DECK.setups) {
  await g.h('teleport', s.place.x, s.place.z);
  await step(30);
  const snap = await g.h('snapshot');
  const pr = await probe();
  const [px, py, pz] = snap.player.pos;
  rows.push({
    setup: s.id, declared_region: s.region,
    declared_x: s.place.x, declared_z: s.place.z,
    observed_x: +px.toFixed(2), observed_y: +py.toFixed(2), observed_z: +pz.toFixed(2),
    dx: +(px - s.place.x).toFixed(2), dz: +(pz - s.place.z).toFixed(2),
    landed: Math.hypot(px - s.place.x, pz - s.place.z) < 2.0,
    observed_region: pr.region, hud_label: pr.label,
    ground_y: pr.ground === null ? null : +Number(pr.ground).toFixed(2),
    water_y: pr.water === null || pr.water === undefined ? null : +Number(pr.water).toFixed(2),
  });
  process.stderr.write(`${s.id}: declared ${s.region} -> observed ${pr.region} / hud ${pr.label} landed=${rows[rows.length - 1].landed}\n`);
}

const mismatched = rows.filter((r) => r.observed_region && String(r.observed_region).replace(/^the-/, '') !== String(r.declared_region).replace(/^the-/, ''));
const notLanded = rows.filter((r) => !r.landed);
const out = {
  tool: 'f7-critic-site-census', generated: new Date().toISOString(), seed: SEED,
  commit: null, setups: rows.length,
  summary: {
    teleport_failed: notLanded.length,
    region_mismatch: mismatched.length,
    mismatched_ids: mismatched.map((r) => `${r.setup}: declared ${r.declared_region}, observed ${r.observed_region}`),
    not_landed_ids: notLanded.map((r) => r.setup),
  },
  rows,
};
fs.writeFileSync(path.join(OUT, 'site-census.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.summary, null, 2));
await g.close();
