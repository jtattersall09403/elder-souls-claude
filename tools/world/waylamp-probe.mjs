#!/usr/bin/env node
/**
 * waylamp-probe — is the waylamp a thing in the world, or a field in a JSON file?
 *
 * Owner: W1-05. Binding: RI-MTH07 / ARBITRATION §3 (CONSUMPTION), RI-WLD04 M17 step 6, RI-WLD06 L2.
 *
 * WHY. `signpost-audit.mjs` check H found that neither named route passes within the 160 m lamp
 * range of a glowing thing anywhere along 6.8 km and 12.4 km — the road was structurally the
 * darkest line in the province, because the one signature kind placed roadside is the one that
 * does not glow. The answer was to let the road light itself: the 9 waystation posts and the 3
 * junction posts carry a lamp, and its colour is read out of `SIGNATURE_KINDS` by region, so a lit
 * post says WHERE as well as WHICH WAY.
 *
 * That is a claim about the running game, and this project has failed the same way fifteen times:
 * a field lands in a JSON file, a report cites it, and nothing in `game/src` ever reads it. The
 * waystations in `roads.json` were exactly that until this piece — three offline tools read them
 * and the player could never see one. So the lamp does not count until it is measured HERE:
 *
 *   C1  the MESH        the scene really contains a `waylamp:<post id>` object at the post.
 *   C2  the LIGHT       at night, `province.updateSignatureLights()` puts a live PointLight at the
 *                       post, of the post's own colour — not merely an emissive material, which
 *                       makes the object glow and lights nothing. That distinction is the whole
 *                       reason the region lights exist (see province.js's own note: "a welkynd
 *                       pillar in Blackwood at 01:00 was a blue dot in a black frame").
 *   C3  the BUDGET      the lamps join the existing pool. `MAX_SIG_LIGHTS` is 2 and it is a
 *                       MEASUREMENT, not a taste: six dynamic lights cost 3.75 minutes a frame on
 *                       this rasteriser. A fix that buys night legibility by adding lights is not
 *                       a fix.
 *   C4  DAY             the same light is dark at noon. A lamp that burns at midday is a bug.
 *   C5  PERTURBATION    strip `lamp` off the field's signposts and re-run C2. If the light is
 *                       still there, C2 was measuring something else.
 *
 * Run: node tools/world/waylamp-probe.mjs [--post <id>]
 * Exits non-zero if any check fails. Check the browser count first — AGENT-PROTOCOL's cap is on
 * concurrent browsers, not on agents.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const OUT = arg('--out', 'reports/w1-05-waylamp.json');

const doc = JSON.parse(readFileSync(join(ROOT, 'game/data/world/signposts.json'), 'utf8'));
const lamped = (doc.signposts || []).filter((s) => s.lamp);
if (!lamped.length) { console.error('waylamp-probe: no post in signposts.json carries a lamp — nothing to measure'); process.exit(1); }

// Default to the Welkynd Shrine post: it is the one whose colour is most obviously NOT lamp-oil,
// so a wrong colour shows up as a wrong answer rather than as a plausible one.
const wanted = arg('--post', 'sign-way-way-helstrom-blackrose-3');
const post = lamped.find((s) => s.id === wanted) || lamped[0];

const results = [];
const check = (id, pass, detail) => { results.push({ id, pass: !!pass, detail }); return !!pass; };

const { launchGame } = await import('../lib/browser.mjs');
const h = await launchGame({ width: 320, height: 240 });
let code = 0;
try {
  await h.page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));

  const probe = await h.page.evaluate(({ id, x, z, hex }) => {
    const H = window.__HARNESS;
    const eng = H.engine ? H.engine() : (window.__ENGINE || null);
    const prov = eng && eng.renderer && eng.renderer.province;
    if (!prov) return { error: 'no province on the engine' };

    H.teleport(x, z);
    H.streamAround(x, z);

    // C1 — the mesh. Named `waylamp:<id>` in province.js#_signposts, so it is findable by name
    // rather than by guessing at geometry.
    let mesh = null;
    prov.group.traverse((o) => { if (o.name === `waylamp:${id}`) mesh = o; });

    const sample = () => {
      const lights = [];
      prov.group.traverse((o) => { if (o.isPointLight && /^signature-light-/.test(o.name)) lights.push(o); });
      return lights.map((l) => ({
        name: l.name, visible: !!l.visible, intensity: +l.intensity.toFixed(3),
        hex: '#' + l.color.getHexString().toUpperCase(),
        d: +Math.hypot(l.position.x - x, l.position.z - z).toFixed(2),
      }));
    };

    // C2 — night. `setNightFactor` is what the renderer calls off the sun elevation.
    prov.setNightFactor(1);
    const nearNight = prov.updateSignatureLights(x, z);
    const night = sample();

    // C4 — day.
    prov.setNightFactor(0);
    prov.updateSignatureLights(x, z);
    const day = sample();

    // C5 — perturbation. Take the lamps off the field's records and ask again, at night.
    const saved = [];
    for (const s of (prov.field.signs || [])) if (s.lamp) { saved.push([s, s.lamp]); delete s.lamp; }
    prov.setNightFactor(1);
    prov.updateSignatureLights(x, z);
    const stripped = sample();
    for (const [s, l] of saved) s.lamp = l;
    prov.setNightFactor(1);
    prov.updateSignatureLights(x, z);

    return {
      mesh_found: !!mesh,
      mesh_emissive: mesh ? '#' + mesh.material.emissive.getHexString().toUpperCase() : null,
      light_slots: night.length,
      near_count_night: nearNight,
      night, day, stripped, want_hex: hex, lamps_stripped: saved.length,
    };
  }, { id: post.id, x: post.x, z: post.z, hex: post.lamp.hex });

  if (probe.error) throw new Error(probe.error);

  const hex = post.lamp.hex.toUpperCase();
  const lit = (rows) => rows.filter((r) => r.visible && r.intensity > 0.01);
  const atPost = (rows) => lit(rows).filter((r) => r.hex === hex && r.d < 4);

  check('C1 mesh', probe.mesh_found && probe.mesh_emissive === hex,
    `waylamp:${post.id} in the scene: ${probe.mesh_found}, emissive ${probe.mesh_emissive} (want ${hex})`);
  check('C2 light at night', atPost(probe.night).length >= 1,
    `${lit(probe.night).length} live light(s) at night; ${atPost(probe.night).length} of them at the post in ${hex} — ${JSON.stringify(probe.night)}`);
  check('C3 budget', probe.light_slots <= 2,
    `${probe.light_slots} signature-light slot(s) exist; MAX_SIG_LIGHTS is 2 and it is a measurement`);
  check('C4 dark by day', lit(probe.day).length === 0,
    `${lit(probe.day).length} live light(s) at noon — ${JSON.stringify(probe.day)}`);
  check('C5 perturbation', atPost(probe.stripped).length === 0,
    `with lamp stripped from ${probe.lamps_stripped} post(s): ${atPost(probe.stripped).length} light(s) still at the post — ${JSON.stringify(probe.stripped)}`);

  const report = {
    tool: 'tools/world/waylamp-probe.mjs', owner: 'W1-05',
    question: 'Is the waylamp a thing in the running world, or a field in a JSON file?',
    post: { id: post.id, kind: post.kind, region: post.region, lamp: post.lamp },
    lamped_posts: lamped.length, raw: probe, checks: results,
    passed: results.every((r) => r.pass),
  };
  mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
  writeFileSync(join(ROOT, OUT), JSON.stringify(report, null, 2) + '\n');

  console.log(`waylamp-probe ${post.id} (${post.region}, ${post.lamp.source} ${hex})`);
  for (const r of results) console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.id.padEnd(18)} ${r.detail}`);
  console.log(`  wrote ${OUT}`);
  code = report.passed ? 0 : 1;
} finally { await h.close(); }
process.exit(code);
