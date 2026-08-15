#!/usr/bin/env node
/**
 * f2-why-probe.mjs — F2/F1 diagnosis (roadmap F2/F1, ring 1).
 *
 * Reads the LIVE scene state at the exact five Protocol A r2 setups and answers, per frame,
 * three questions that no existing instrument asks:
 *
 *  1. Is the sun's DIRECT contribution actually in the frame? (intensity, shadowMap state,
 *     shadow-camera fit, how many draw calls carry `castShadow`, what the shadow map contains)
 *  2. What materials are RESIDENT in the drawn frame — i.e. does this window exercise F1's
 *     20 authored material sets at all, or is it terrain and instanced foliage?
 *  3. What is the ratio of direct key irradiance to ambient (hemi + AmbientLight + environment)?
 *     A scene lit 90% by ambient cannot show a cast shadow no matter how good the shadow map is.
 *
 * This is a STATE probe, not an appearance claim, so it is valid on SwiftShader (HAZARDS §15
 * only voids appearance evidence from software renderers). Every number it prints is read out
 * of the live page, never derived from a source file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchForCapture, resolveGpuMode } from './lib/gpu-launch.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const OUT = path.resolve(REPO, args.out || 'reports/f2-why/probe.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const SEED = Number(DECK.capture.seed);
const SETTLE = Number(DECK.capture.settle_frames);
const [CW, CH] = [1920, 1080];

const { g } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: false,
  entry: 'game/index.html', width: 1280, height: 720,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h; window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (!H) return { __err: 'no __HARNESS' };
    if (typeof H[method] !== 'function') return { __err: `${method} is not a function` };
    try { return { __ok: await H[method](...callArgs) }; }
    catch (e) { return { __err: `${method}() threw: ${e && e.message || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) return { ok: false, e: String(res.__err).slice(0, 240) };
  return { ok: true, v: res ? res.__ok : undefined };
};

/** The whole diagnosis, evaluated inside the page against the live three.js scene. */
const INSPECT = () => {
  const E = window.__ENGINE;
  const R = E.renderer;
  const three = R.three || R.renderer || null;
  const scene = R.scene || E.scene || null;
  const camera = R.camera || E.camera || null;
  const out = { ok: true };
  if (!three || !scene || !camera) return { ok: false, why: 'could not reach three/scene/camera off __ENGINE.renderer' };

  // ---- 1. lights actually in the scene graph, with their live intensities -----------------
  const lights = [];
  scene.traverse((o) => {
    if (!o.isLight || !o.visible) return;
    const row = {
      type: o.type, name: o.name || null, intensity: o.intensity,
      colour: o.color ? [o.color.r, o.color.g, o.color.b] : null,
      castShadow: !!o.castShadow,
    };
    if (o.isHemisphereLight) row.groundColour = [o.groundColor.r, o.groundColor.g, o.groundColor.b];
    if (o.castShadow && o.shadow) {
      const c = o.shadow.camera;
      row.shadow = {
        mapSize: [o.shadow.mapSize.x, o.shadow.mapSize.y],
        mapAllocated: !!(o.shadow.map && o.shadow.map.texture),
        mapDims: o.shadow.map ? [o.shadow.map.width, o.shadow.map.height] : null,
        bias: o.shadow.bias, normalBias: o.shadow.normalBias,
        cam: c.isOrthographicCamera
          ? { kind: 'ortho', left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far }
          : { kind: c.type, near: c.near, far: c.far },
        lightPos: o.position ? [o.position.x, o.position.y, o.position.z] : null,
        targetPos: o.target && o.target.position ? [o.target.position.x, o.target.position.y, o.target.position.z] : null,
        autoUpdate: o.shadow.autoUpdate, needsUpdate: o.shadow.needsUpdate,
      };
    }
    lights.push(row);
  });
  out.lights = lights;

  // ---- 2. renderer-level shadow switches --------------------------------------------------
  out.renderer = {
    shadowMapEnabled: three.shadowMap.enabled,
    shadowMapType: three.shadowMap.type,
    shadowMapAutoUpdate: three.shadowMap.autoUpdate,
    toneMapping: three.toneMapping,
    toneMappingExposure: three.toneMappingExposure,
    outputColorSpace: three.outputColorSpace,
    info: { calls: three.info.render.calls, triangles: three.info.render.triangles },
  };
  out.sceneEnv = {
    hasEnvironment: !!scene.environment,
    environmentIntensity: scene.environmentIntensity,
    hasFog: !!scene.fog,
    fogColour: scene.fog && scene.fog.color ? [scene.fog.color.r, scene.fog.color.g, scene.fog.color.b] : null,
    fogDensity: scene.fog ? (scene.fog.density ?? null) : null,
    background: scene.background ? (scene.background.isColor ? 'colour' : scene.background.type || 'texture') : null,
  };

  // ---- 3. what is actually VISIBLE in this camera frustum, by material --------------------
  // Frustum-cull by hand so this counts what the frame draws, not what the world holds.
  const THREE = window.THREE || (E.THREE) || null;
  const proj = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  const planes = [];
  const me = proj.elements;
  const mk = (a, b, c, d) => {
    const l = Math.hypot(a, b, c) || 1; return [a / l, b / l, c / l, d / l];
  };
  planes.push(mk(me[3] + me[0], me[7] + me[4], me[11] + me[8], me[15] + me[12]));
  planes.push(mk(me[3] - me[0], me[7] - me[4], me[11] - me[8], me[15] - me[12]));
  planes.push(mk(me[3] + me[1], me[7] + me[5], me[11] + me[9], me[15] + me[13]));
  planes.push(mk(me[3] - me[1], me[7] - me[5], me[11] - me[9], me[15] - me[13]));
  planes.push(mk(me[3] + me[2], me[7] + me[6], me[11] + me[10], me[15] + me[14]));
  planes.push(mk(me[3] - me[2], me[7] - me[6], me[11] - me[10], me[15] - me[14]));
  const inFrustum = (obj) => {
    if (!obj.geometry) return false;
    if (!obj.geometry.boundingSphere) { try { obj.geometry.computeBoundingSphere(); } catch (e) { return false; } }
    const bs = obj.geometry.boundingSphere;
    if (!bs) return false;
    const c = bs.center.clone().applyMatrix4(obj.matrixWorld);
    const sc = obj.matrixWorld.getMaxScaleOnAxis ? obj.matrixWorld.getMaxScaleOnAxis() : 1;
    const r = bs.radius * sc;
    for (const p of planes) { if (p[0] * c.x + p[1] * c.y + p[2] * c.z + p[3] < -r) return false; }
    return true;
  };

  const visible = [];
  const allMats = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh && !o.isPoints && !o.isLine) return;
    let vis = o.visible, p = o.parent;
    while (vis && p) { vis = p.visible; p = p.parent; }
    if (!vis) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      const key = `${m.name || '(unnamed)'}|${m.type}`;
      if (!allMats.has(key)) {
        allMats.set(key, {
          name: m.name || null, type: m.type,
          colour: m.color ? [+m.color.r.toFixed(3), +m.color.g.toFixed(3), +m.color.b.toFixed(3)] : null,
          roughness: m.roughness ?? null, metalness: m.metalness ?? null,
          hasMap: !!m.map, hasNormalMap: !!m.normalMap, hasRoughnessMap: !!m.roughnessMap,
          hasAoMap: !!m.aoMap, hasEnvMap: !!m.envMap,
          vertexColors: !!m.vertexColors,
          onScreen: 0, offScreen: 0, castShadowMeshes: 0, receiveShadowMeshes: 0,
        });
      }
      const row = allMats.get(key);
      if (inFrustum(o)) { row.onScreen++; if (o.castShadow) row.castShadowMeshes++; if (o.receiveShadow) row.receiveShadowMeshes++; }
      else row.offScreen++;
    }
    if (inFrustum(o)) {
      visible.push({
        name: o.name || null, kind: o.isInstancedMesh ? 'instanced' : (o.isMesh ? 'mesh' : o.type),
        count: o.isInstancedMesh ? o.count : 1,
        castShadow: !!o.castShadow, receiveShadow: !!o.receiveShadow,
        mat: mats.map((m) => (m ? (m.name || '(unnamed)') : null)).join(','),
        matType: mats.map((m) => (m ? m.type : null)).join(','),
      });
    }
  });
  out.materials = [...allMats.entries()].map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.onScreen - a.onScreen);
  out.visible_summary = {
    onscreen_drawables: visible.length,
    onscreen_castshadow: visible.filter((v) => v.castShadow).length,
    onscreen_receiveshadow: visible.filter((v) => v.receiveShadow).length,
    distinct_materials_onscreen: out.materials.filter((m) => m.onScreen > 0).length,
    distinct_materials_total: out.materials.length,
  };
  out.visible_top = visible.slice(0, 40);

  // ---- 4. the composite's live uniform values ---------------------------------------------
  const comp = R.composite || R.compositor || R._composite || null;
  const cm = comp && (comp.material || comp.compositeMaterial) ? (comp.material || comp.compositeMaterial)
    : (R.compositeMaterial || null);
  if (cm && cm.uniforms) {
    const u = {};
    for (const k of Object.keys(cm.uniforms)) {
      const v = cm.uniforms[k].value;
      if (typeof v === 'number') u[k] = v;
      else if (v && v.isVector3) u[k] = [v.x, v.y, v.z];
      else if (v && v.isVector2) u[k] = [v.x, v.y];
    }
    out.composite_uniforms = u;
  } else out.composite_uniforms = null;

  // ---- 5. the published lighting frame ----------------------------------------------------
  const lf = R.lightingFrame || R._lightingFrame || (R.sky && R.sky.lastFrame) || null;
  if (lf) {
    out.lighting_frame = {
      sunIntensity: lf.sunIntensity, moonIntensity: lf.moonIntensity,
      sunDir: lf.sunDir ? [lf.sunDir.x, lf.sunDir.y, lf.sunDir.z] : null,
      sunColour: lf.sunColour ? [lf.sunColour.r, lf.sunColour.g, lf.sunColour.b] : null,
      ambientColour: lf.ambientColour ? [lf.ambientColour.r, lf.ambientColour.g, lf.ambientColour.b] : null,
      skyLuminance: lf.skyLuminance, exposureTarget: lf.exposureTarget,
      fogDensity: lf.fogDensity, regionId: lf.regionId, weatherId: lf.weatherId,
      timeOfDay: lf.timeOfDay, recipeId: lf.recipeId,
      day: lf.day, night: lf.night, dusk: lf.dusk, overcast: lf.overcast,
    };
  } else out.lighting_frame = null;

  out.camera = { pos: [camera.position.x, camera.position.y, camera.position.z], fov: camera.fov, far: camera.far };
  return out;
};

async function poseCamera(setup) {
  const s = await call('snapshot');
  if (!s.ok) return `snapshot failed: ${s.e}`;
  let [px, py, pz] = s.v.player.pos;
  if (setup.camera.subject === 'npc') {
    const ents = await call('listEntities');
    const npcs = (ents.ok ? ents.v : []).filter((e) => e.kind === 'npc' || e.kind === 'NPC');
    if (!npcs.length) return 'no NPC in range';
    npcs.sort((a, b) => Math.hypot(a.pos[0] - px, a.pos[2] - pz) - Math.hypot(b.pos[0] - px, b.pos[2] - pz));
    [px, py, pz] = npcs[0].pos;
  }
  const cam = setup.camera;
  const yaw = (cam.yaw_deg || 0) * Math.PI / 180, pitch = (cam.pitch_deg || 0) * Math.PI / 180;
  const dist = cam.distance_m || 0;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * dist, py + 1.5 - Math.sin(pitch) * dist, pz + Math.cos(yaw) * Math.cos(pitch) * dist];
  const r = await call('camera', { pos: eye, look: [px, py + 1.1, pz] });
  return r.ok ? null : `camera pose refused: ${r.e}`;
}

const results = [];
for (const setup of DECK.setups) {
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  await call('teleport', setup.place.x, setup.place.z);
  await call('stepFrames', 4);
  await call('stepFrames', SETTLE);
  await call('setWeather', 'clear');
  for (const hour of [8, 13, 19.5]) {
    await call('setTimeOfDay', hour);
    const perr = await poseCamera(setup);
    await call('stepFrames', SETTLE);
    const insp = await g.page.evaluate(INSPECT);
    results.push({ setup: setup.id, hour, pose_error: perr, inspect: insp });
    console.log(`  ${setup.id} t${hour}: ${insp.ok ? 'ok' : 'FAILED — ' + insp.why}`);
  }
}

fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), deck: 'tools/blind/deck-protocol-a.json', results }, null, 2));
console.log(`\nwrote ${OUT}`);
await g.close();
process.exit(0);
