#!/usr/bin/env node
/**
 * landform-reach.mjs — how much of the ground's SHAPE reaches the camera?
 *
 * W1-30V's sweep found that all thirteen region vistas have a dead-flat horizon, including Valus
 * Ridge, whose record declares 286 m of amplitude. There are two entirely different explanations
 * and they cost different amounts to fix:
 *
 *   (a) AN AUTHORING GAP — the landform was never built, and the province is a plane with a tint.
 *   (b) A PIPELINE DEFECT — the landform is built and something downstream deletes it.
 *
 * This tool separates them, offline, in about two seconds, and it separates them by measuring the
 * SAME quantity at three stations along the pipeline:
 *
 *   1. `raster_relief_m`  — height range of the baked landform inside each region.
 *   2. `frustum_relief_m` — height range of the terrain a given deck camera can actually see, i.e.
 *                           inside its field of view and inside the province.
 *   3. `visible_relief_m` — the same, restricted to ground that still transmits >= 10% of its own
 *                           radiance through the region's declared fog. What survives to the frame.
 *
 * If (1) is large and (2) is small, the cameras are pointed at flat ground. If (2) is large and (3)
 * is small, the air in front of the landform is what is deleting it, and the terrain data is fine.
 *
 * THE NULL CONTROLS ARE THE PLAUSIBLE WRONG ANSWERS, NOT THE TRIVIAL ONES (`--selfcheck`):
 *
 *   flat-world   The plausible wrong DIAGNOSIS: "there is no landform, the province is a plane with
 *                a tint". Replaces every cell with the province's mean land height, leaving fog and
 *                cameras untouched. `frustum_relief_m` must collapse. If it does not collapse, this
 *                instrument cannot tell a plane from a mountain and nothing else it says is worth
 *                reading.
 *                (The first version of this arm flattened each region to ITS OWN mean, and only
 *                took the mean frustum relief from 158 m to 92 m — because a ray crossing a region
 *                boundary still steps between two flat plates at different elevations. That is a
 *                weak control AND a real finding, so it is kept as the `flat-plates` arm and
 *                reported: rather more than half of the relief a camera can see in this province is
 *                between-region elevation difference rather than landform inside a region, which is
 *                RI-WLD15's complaint arriving from a different direction.)
 *   clear-air    The plausible wrong MECHANISM: "the fog is not what is doing it". Sets every
 *                region's extinction to zero and changes nothing else. `visible_relief_m` must rise
 *                to meet `frustum_relief_m`. If it does not, the loss is somewhere this tool cannot
 *                see and the diagnosis is wrong.
 *   sea-level    The control that must NOT move: aerial perspective evaluated with camera and
 *                target both at the datum must leave `visible_relief_m` where it was. This is the
 *                guard against "it looks better because I turned the fog down everywhere", which is
 *                the cheap way to pass this metric while making thirteen regions the same again.
 *
 * WHICH INPUT DO ALL THE ARMS SUPPLY BY HAND? (`HAZARDS.md` §0, the fifth failure shape.) None.
 * Every arm, including the controls, reads `game/data/world/terrain.json`, `regions.json` and
 * `tools/visual/deck.json` off disk; the controls are PERTURBATIONS of those bytes, not a fabricated
 * world all arms agree on. The one shared premise that is fabricated is the camera list, and it
 * comes from the Deck, which is generated from `game/data/world/**` — so a deleted region turns this
 * tool red rather than quietly shrinking its population.
 *
 * The `after` column does not re-implement the shader. It imports `aerialScale` from
 * `game/src/world/aerial.js`, which is the function the fragment shader runs, so a check that
 * disagreed with the frame would be a bug in one place rather than a disagreement between two.
 *
 * IS `fog_wash` REAL, OR IS IT A NUMBER THIS TOOL MADE UP? Anchored in pixels, not asserted. Over
 * the thirteen region vistas captured by the Deck at t1300/clear (reports/w1-30f/deck/F-before), the
 * rank correlation between this tool's offline `fog_wash` and `tools/visual/frame-stats.mjs`'s
 * MEASURED `dominant_frac` — the fraction of the frame sitting in one flat colour bucket — is
 * **+0.95**, and against `luma_p95 - luma_p05` it is **-0.82**. The geometry predicts the picture.
 * (`edge_density` correlates only -0.34, and that is worth knowing rather than hiding: near-field
 * vegetation supplies most of the edge energy in this game, so a Blackwood frame can be 61% fog and
 * still be busy with trees. Contrast is the wrong pixel companion for this metric; flatness is the
 * right one.)
 *
 * Usage:
 *   node tools/visual/landform-reach.mjs                 # measure the shipped world
 *   node tools/visual/landform-reach.mjs --json <path>   # write the full result
 *   node tools/visual/landform-reach.mjs --selfcheck     # prove the instrument can fail
 *
 * Exit codes: 0 the landform reaches the frame, 1 it does not, 2 could not measure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { WorldField } from '../../game/src/world/field.js';
import { aerialScale } from '../../game/src/world/aerial.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const D2R = Math.PI / 180;

// RI-WLD16 §3's own language: a landscape whose shape a player can read. The thresholds are this
// tool's, and they are deliberately low — this is not asking for a mountain range, it is asking
// that more of the ground's shape survive the air than is deleted by it.
export const TH = {
  transmittance_floor: 0.10,   // ground dimmer than this is fog, whatever geometry is behind it
  ray_step_m: 10,
  ray_max_m: 3000,
  azimuth_step_deg: 1.5,
  vfov_deg: 60,
  aspect: 1280 / 720,
  // A shot passes when at least this fraction of the relief inside its frustum survives the air.
  min_survival: 0.25,
  // ...and the world passes when at most this many shots fail.
  max_failing_shots: 4,
};
const HHALF = Math.atan(Math.tan(TH.vfov_deg / 2 * D2R) * TH.aspect) / D2R;

/**
 * @param {object} opts
 * @param {number} opts.extinctionScale multiply every region's extinction (0 = the clear-air arm)
 * @param {false|'world'|'plates'} opts.flatten replace the raster with one height everywhere
 *   ('world', the flat-world control) or with each region's own mean ('plates', the finding arm)
 * @param {number} opts.aerialStrength 0 = today's uniform fog, 1 = height-attenuated
 * @param {boolean} opts.pinToDatum evaluate the aerial term at the datum (the sea-level arm)
 */
export function measure(opts = {}) {
  const {
    extinctionScale = 1, flatten = false, aerialStrength = 0, pinToDatum = false,
    extinctionFrom = 'shipped',
  } = opts;
  const terrain = J('game/data/world/terrain.json');
  const regionsDoc = J('game/data/world/regions.json');
  const deck = J('tools/visual/deck.json');
  const field = new WorldField(terrain, regionsDoc, J('game/data/world/water.json'));
  const byId = new Map(regionsDoc.regions.map((r) => [r.id, r]));

  // --- station 1: the baked raster, per region -------------------------------------------------
  const n = terrain.cols * terrain.rows, C = terrain.channels;
  const bbuf = Buffer.from(C.base_dm, 'base64');
  const base = new Int16Array(n);
  for (let i = 0; i < n; i++) base[i] = bbuf.readInt16LE(i * 2);
  const reg = new Uint8Array(Buffer.from(C.region, 'base64').subarray(0, n));
  const ocean = new Uint8Array(Buffer.from(C.ocean, 'base64').subarray(0, n));
  const perRegion = new Map(), meanOf = new Map();
  let landSum = 0, landCount = 0;
  for (let i = 0; i < n; i++) {
    if (ocean[i]) continue;
    const k = reg[i];
    if (!perRegion.has(k)) perRegion.set(k, []);
    perRegion.get(k).push(base[i] / 10);
    landSum += base[i] / 10; landCount++;
  }
  const worldMean = landSum / landCount;
  const raster = [];
  for (const [k, v] of [...perRegion].sort((a, b) => a[0] - b[0])) {
    const id = regionsDoc.regions[k].id;
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    meanOf.set(id, mean);
    raster.push({
      region: id, declared_amp_m: regionsDoc.regions[k].terrain.amp_m,
      raster_relief_m: +(Math.max(...v) - Math.min(...v)).toFixed(1),
      mean_height_m: +mean.toFixed(1),
    });
  }

  // The flat-world arm swaps ONE function and nothing else: same regions, same fog, same cameras,
  // same code path. That is what makes it a control on the diagnosis rather than a second world.
  const heightAt = flatten === 'world' ? () => worldMean
    : flatten === 'plates' ? (x, z) => meanOf.get(regionsDoc.regions[field.regionIndexAt(x, z)].id) ?? worldMean
      : (x, z) => field.baseAt(x, z);

  // --- stations 2 and 3: per deck camera -------------------------------------------------------
  const shots = [];
  for (const s of deck.setups) {
    if (s.block !== 'region-vista' && s.block !== 'region-eye') continue;
    const r = byId.get(s.region);
    if (!r) { shots.push({ id: s.id, region: s.region, status: 'red', reason: 'no region record' }); continue; }
    // Each region carries TWO independent statements about how far you can see, and they disagree
    // in eight of thirteen: `fog.extinction_per_m`, which the renderer uses, and `sightline_m`,
    // which `RI-WLD04` declares and W1-02's weather machine reads. Valus Ridge says 2,200 m and
    // renders 599 m; the Stone Wastes say 1,400 m and render 521 m; Thornmarsh says 30 m and
    // renders 264 m. This arm answers "what would the frames look like if the region got the
    // sightline it declares?" — a question for whoever owns regions.json, not for this builder.
    const declared = r.sightline_m > 0 ? 1.978 / r.sightline_m : r.fog.extinction_per_m;
    const ext = (extinctionFrom === 'declared' ? declared : r.fog.extinction_per_m) * extinctionScale;
    const H = r.fog.height_falloff_m || 0;
    const cx = s.place.x, cz = s.place.z;
    const eyeY = heightAt(cx, cz) + (s.camera.kind === 'gameplay' ? 1.7 : (s.camera.height_m || 26));
    let fMin = Infinity, fMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (let a = -HHALF; a <= HHALF; a += TH.azimuth_step_deg) {
      const th = (s.camera.yaw_deg + a) * D2R, dx = Math.sin(th), dz = Math.cos(th);
      for (let d = TH.ray_step_m; d <= TH.ray_max_m; d += TH.ray_step_m) {
        const x = cx + dx * d, z = cz + dz * d;
        if (x < 0 || z < 0 || x >= field.sizeX || z >= field.sizeZ) break;
        const h = heightAt(x, z);
        if (h < fMin) fMin = h; if (h > fMax) fMax = h;
        const scale = aerialScale(pinToDatum ? 0 : eyeY, pinToDatum ? 0 : h, H, 0, aerialStrength);
        const T = ext > 0 ? Math.exp(-Math.pow(ext * scale * d, 2)) : 1;
        if (T >= TH.transmittance_floor) { if (h < vMin) vMin = h; if (h > vMax) vMax = h; }
      }
    }
    const frustum = fMax === -Infinity ? 0 : fMax - fMin;
    const visible = vMax === -Infinity ? 0 : vMax - vMin;

    // FOG WASH: the fraction of the actual frame that is flat fog colour rather than a picture of
    // anything. `visible_relief_m` above is a range of heights and can stay large while every one
    // of those heights is 2 km away and washed out — which is exactly what vista-valus-ridge is,
    // a white rectangle whose relief metric reads 310 m. This casts the real 2D frustum: every ray
    // that either hits nothing or hits ground transmitting under the floor is a fogged pixel.
    const pitch = (s.camera.kind === 'gameplay' ? 0 : (s.camera.pitch_deg || 0));
    let rays = 0, fogged = 0;
    for (let a = -HHALF; a <= HHALF; a += TH.azimuth_step_deg * 2) {
      const th = (s.camera.yaw_deg + a) * D2R, dx = Math.sin(th), dz = Math.cos(th);
      for (let e = pitch - TH.vfov_deg / 2; e <= pitch + TH.vfov_deg / 2; e += 2) {
        rays++;
        const slope = Math.tan(e * D2R);
        let hitT = 0;
        for (let d = TH.ray_step_m; d <= TH.ray_max_m; d += TH.ray_step_m) {
          const x = cx + dx * d, z = cz + dz * d;
          if (x < 0 || z < 0 || x >= field.sizeX || z >= field.sizeZ) break;
          if (eyeY + slope * d <= heightAt(x, z)) {
            const scale = aerialScale(pinToDatum ? 0 : eyeY, pinToDatum ? 0 : heightAt(x, z), H, 0, aerialStrength);
            hitT = ext > 0 ? Math.exp(-Math.pow(ext * scale * d, 2)) : 1;
            break;
          }
        }
        if (hitT < TH.transmittance_floor) fogged++;
      }
    }
    shots.push({
      id: s.id, region: s.region, block: s.block, status: 'ok',
      eye_y_m: +eyeY.toFixed(1), extinction_per_m: +ext.toFixed(5), height_falloff_m: H,
      frustum_relief_m: +frustum.toFixed(1), visible_relief_m: +visible.toFixed(1),
      survival: frustum > 0.5 ? +(visible / frustum).toFixed(3) : 1,
      fog_wash: +(fogged / rays).toFixed(3),
    });
  }
  const scored = shots.filter((s) => s.status === 'ok');
  const failing = scored.filter((s) => s.survival < TH.min_survival);
  return {
    aerial_strength: aerialStrength, extinction_scale: extinctionScale, flattened: flatten,
    raster, shots,
    mean_frustum_relief_m: +(scored.reduce((s, o) => s + o.frustum_relief_m, 0) / scored.length).toFixed(1),
    mean_visible_relief_m: +(scored.reduce((s, o) => s + o.visible_relief_m, 0) / scored.length).toFixed(1),
    mean_survival: +(scored.reduce((s, o) => s + o.survival, 0) / scored.length).toFixed(3),
    mean_fog_wash: +(scored.reduce((s, o) => s + o.fog_wash, 0) / scored.length).toFixed(3),
    failing_shots: failing.map((s) => s.id),
    pass: failing.length <= TH.max_failing_shots && shots.every((s) => s.status === 'ok'),
  };
}

function report(res, title) {
  console.log(`\n${title}`);
  console.log('| shot | eye y (m) | relief in frustum | relief surviving the air | survives | frame that is fog |');
  console.log('|---|---:|---:|---:|---:|---:|');
  for (const s of res.shots) {
    if (s.status !== 'ok') { console.log(`| ${s.id} | RED | | | | ${s.reason} |`); continue; }
    console.log(`| ${s.id} | ${s.eye_y_m} | ${s.frustum_relief_m} | ${s.visible_relief_m} | ${(s.survival * 100).toFixed(1)}% | ${(s.fog_wash * 100).toFixed(1)}% |`);
  }
  console.log(`\nmean relief inside the frustum : ${res.mean_frustum_relief_m} m`);
  console.log(`mean relief surviving the air  : ${res.mean_visible_relief_m} m`);
  console.log(`mean survival                  : ${(res.mean_survival * 100).toFixed(1)}%`);
  console.log(`mean fraction of frame that is fog rather than a picture : ${(res.mean_fog_wash * 100).toFixed(1)}%`);
  console.log(`shots below the ${(TH.min_survival * 100)}% floor    : ${res.failing_shots.length} of ${res.shots.length}${res.failing_shots.length ? ` — ${res.failing_shots.join(', ')}` : ''}`);
}

// Only run the CLI when this file IS the command. `measure()` and `TH` are exported so a critic can
// re-derive every number here without shelling out, and an import that printed a report and called
// process.exit would make that impossible.
const IS_CLI = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (IS_CLI && args.selfcheck) {
  const live = measure({ aerialStrength: 0 });
  const flat = measure({ aerialStrength: 0, flatten: 'world' });
  const plates = measure({ aerialStrength: 0, flatten: 'plates' });
  const clear = measure({ aerialStrength: 0, extinctionScale: 0 });
  const datum = measure({ aerialStrength: 1, pinToDatum: true });
  const lines = [];
  const check = (name, ok, detail) => { lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); return ok; };
  let ok = true;
  ok = check('flat-world collapses the frustum relief',
    flat.mean_frustum_relief_m < live.mean_frustum_relief_m * 0.15,
    `${live.mean_frustum_relief_m} m -> ${flat.mean_frustum_relief_m} m`) && ok;
  ok = check('clear-air restores what the fog took',
    clear.mean_survival > 0.98,
    `survival ${(live.mean_survival * 100).toFixed(1)}% -> ${(clear.mean_survival * 100).toFixed(1)}%`) && ok;
  ok = check('sea-level datum moves nothing (guards a global fog cut)',
    Math.abs(datum.mean_visible_relief_m - live.mean_visible_relief_m) < 0.05 * Math.max(1, live.mean_visible_relief_m),
    `${live.mean_visible_relief_m} m -> ${datum.mean_visible_relief_m} m`) && ok;
  ok = check('the live world is NOT already passing (a green instrument on a red world is broken)',
    !live.pass, `${live.failing_shots.length} of ${live.shots.length} shots below floor`) && ok;
  for (const l of lines) console.log(l);
  console.log(`\nnot a control, a finding: with every region flattened to its own mean height the mean frustum relief`);
  console.log(`is still ${plates.mean_frustum_relief_m} m of the shipped world's ${live.mean_frustum_relief_m} m —`);
  console.log(`${(100 * plates.mean_frustum_relief_m / live.mean_frustum_relief_m).toFixed(0)}% of the shape a camera can see here is between-region step, not landform inside a region.`);
  console.log(`\nselfcheck: ${ok ? 'the instrument separates a flat world from a hazed one, and goes red on the shipped one' : 'THE INSTRUMENT IS NOT TRUSTWORTHY'}`);
  process.exit(ok ? 0 : 1);
}

if (IS_CLI) {
  const strength = args.aerial === undefined ? 0 : Number(args.aerial === true ? 1 : args.aerial);
  const res = measure({ aerialStrength: strength, extinctionFrom: args['declared-sightline'] ? 'declared' : 'shipped' });
  report(res, `landform reach — aerial perspective strength ${strength}`);
  if (args.compare) {
    const other = measure({ aerialStrength: strength > 0 ? 0 : 1 });
    console.log(`\ncompare: strength ${other.aerial_strength} gives mean survival ${(other.mean_survival * 100).toFixed(1)}%, `
      + `mean fog wash ${(other.mean_fog_wash * 100).toFixed(1)}% and ${other.failing_shots.length} failing shots, `
      + `against ${(res.mean_survival * 100).toFixed(1)}%, ${(res.mean_fog_wash * 100).toFixed(1)}% and ${res.failing_shots.length} here.`);
  }
  if (args.json) fs.writeFileSync(path.resolve(ROOT, String(args.json)), JSON.stringify(res, null, 1));
  console.log(`\nverdict: ${res.pass ? 'PASS — the landform reaches the frame' : 'FAIL — the landform is deleted between the raster and the frame'}`);
  process.exit(res.pass ? 0 : 1);
}
