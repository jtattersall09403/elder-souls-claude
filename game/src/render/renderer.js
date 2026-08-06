// The renderer. It READS simulation state and never writes it.
//
// The one rule this file exists to keep: nothing here can change a traced value. There is
// no camera smoothing, no clock, no randomness, no readback. Throttle the render rate to
// 15 Hz or disable it entirely (`setRenderRate(0)`) and every byte of the trace is the
// same — RI-PLT01 M6/M7, RI-CAM06 M1.
//
// Draw-call and triangle counters are read AFTER the final present of the frame, which is
// RI-PLT01 "How we lose" #11: a `renderer.info` snapshot taken before the UI pass is
// honest-looking and wrong by half.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
import { buildScene, makeActor, terrainHeight } from './scene.js';
import { Sky, WEATHER } from './sky.js';
import { Province } from '../world/province.js';

export class Renderer {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.three = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: true,     // so __HARNESS.screenshot() can read the buffer back
    });
    this.three.setPixelRatio(1);
    this.three.shadowMap.enabled = true;
    this.three.shadowMap.type = THREE.PCFSoftShadowMap;
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.three.toneMapping = THREE.ACESFilmicToneMapping;
    this.three.toneMappingExposure = 1.0;

    const built = buildScene(seed);
    this.seed = seed;
    this.scene = built.scene;
    this.cells = built.cells;
    this.props = built.props;
    this.anchors = built.anchors;
    this.terrain = built.terrain;
    this.playerMesh = built.player;
    this.mats = built.mats;
    this.cell = 'exterior';
    this.province = null;
    this.field = null;
    this.setCell('exterior');

    this.sky = new Sky(this.scene);
    // 6 km of far plane: the Valus Ridge is 400 m high and must be on the horizon from the
    // Stone Forest, which is 1.6 km away. A 900 m far plane is a 900 m world.
    this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 6400);
    this.enemyMeshes = new Map();
    this.uiVisible = true;
    this.lastStats = { drawCalls: 0, triangles: 0, programs: 0, geometries: 0, textures: 0 };
    this._look = new THREE.Vector3();
    this._focus = new THREE.Vector3();
    this.setSize(canvas.width, canvas.height);
  }

  /**
   * Rebuild the procedural world for a new generation seed — HARNESS.md §8 D6, "setSeed() is
   * honoured for WORLD GENERATION and content selection, so a seed change visibly changes
   * the run".
   *
   * Before this, the scene was built with a HARDCODED 1337 and `setSeed()` reached exactly
   * one animation counter on one class of object: on a scenario with no entity in it, a seed
   * change altered nothing at all, over 1,800 frames (W1-00 round-2 verdict §9.1). The
   * terrain function was already seeded — the seed was simply never connected to it.
   *
   * `groundAt()` reads the same `terrainHeight()` the mesh is built from, so the rebuild has
   * to be a real rebuild: a renderer whose collision height and whose visible ground came
   * from different seeds would be a lie of exactly the kind this project's methods items
   * exist to catch. Measured cost: 55-100 ms, paid only when the seed actually changes, and
   * never inside a fixed step.
   */
  setWorldSeed(seed) {
    const s = seed >>> 0;
    if (s === this.seed) return this.seed;
    const old = this.scene;
    const built = buildScene(s);
    this.seed = s;
    this.scene = built.scene;
    this.cells = built.cells;
    this.props = built.props;
    this.anchors = built.anchors;
    this.terrain = built.terrain;
    this.playerMesh = built.player;
    this.mats = built.mats;
    this.sky = new Sky(this.scene);
    this.enemyMeshes.clear();          // re-created against the new scene by syncEntities()
    // The province is authored, not generated, so a seed change must not rebuild it — but the
    // scene graph it was attached to has just been replaced, so it is re-parented.
    if (this.province) { old.remove(this.province.group); this.scene.add(this.province.group); this.cells.province = this.province.group; }
    this.setCell(this.cell);
    disposeGraph(old);
    return this.seed;
  }

  setSize(w, h) {
    this.three.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    return { width: w, height: h };
  }

  /**
   * Which cell is drawn. Every cell is built at the world origin and switched by
   * visibility, because the canonical viewpoints carry absolute poses near the origin
   * (HARNESS.md §6) and a cell parked at y = -400 could never be shot at y = 1.6.
   */
  setCell(name) {
    if (!this.cells[name]) throw new Error(`setCell('${name}'): unknown cell. Known: ${Object.keys(this.cells).join(', ')}`);
    for (const k of Object.keys(this.cells)) this.cells[k].visible = (k === name);
    this.cell = name;
    return name;
  }

  setProp(name, visible) {
    if (!this.props[name]) throw new Error(`setProp('${name}'): unknown prop group`);
    this.props[name].visible = !!visible;
    return !!visible;
  }

  /** Height of the ground under (x,z). Flat inside every non-exterior cell. */
  /**
   * The province: 4,825 x 5,540 m of Argonia, streamed, with its own ground field.
   *
   * It is a FIFTH cell alongside exterior/interior/dungeon/arena rather than a replacement for
   * the exterior one, and that is deliberate: HARNESS.md §6 pins the twelve canonical viewpoints
   * to absolute poses within 130 m of the world origin, the world origin is 250 m out in the
   * Topal, and "changing a pose invalidates every cross-wave comparison that used it". So W1-00's
   * origin neighbourhood survives as the capture rig those twelve poses were framed against, and
   * the province gets its own viewpoint set (tools/harness/viewpoints-province.json) shot at real
   * province coordinates. Nothing W1-00 measured is invalidated and nothing the player walks on
   * is a stand-in.
   */
  setWorld(field, roads) {
    this.field = field;
    if (roads) field.setRoads(roads);
    this.province = new Province(field);
    this.cells.province = this.province.group;
    this.scene.add(this.province.group);
    this.province.group.visible = false;
    for (const [id, s] of Object.entries(this.provinceAnchors(field))) this.anchors[id] = s;
    return this.province;
  }

  provinceAnchors(field) {
    const out = {};
    for (const s of field.sites) out[`site_${s.id}`] = new THREE.Vector3(s.x, s.y, s.z);
    for (const r of field.regions) {
      out[`region_${r.id.replace(/-/g, '_')}`] = new THREE.Vector3(r.centroid_m[0], field.heightAt(r.centroid_m[0], r.centroid_m[1]), r.centroid_m[1]);
    }
    return out;
  }

  groundAt(x, z, seed, cell) {
    const c = cell || this.cell;
    if (c === 'province') return this.field ? this.field.heightAt(x, z) : 0;
    if (c !== 'exterior') return 0;
    return terrainHeight(x, z, seed === undefined ? this.seed : seed);
  }

  syncEntities(sim) {
    const seen = new Set();
    for (const e of sim.entities) {
      seen.add(e.eid);
      let mesh = this.enemyMeshes.get(e.eid);
      if (!mesh) {
        mesh = makeActor(this.mats, e.archetype === 'DUMMY' ? 0x7a6a4a : 0x5d3b2c);
        mesh.name = 'enemy:' + e.eid;
        this.scene.add(mesh);
        this.enemyMeshes.set(e.eid, mesh);
      }
      mesh.position.set(e.pos[0], e.pos[1], e.pos[2]);
      mesh.rotation.y = (e.yaw * Math.PI) / 180;
      mesh.visible = true;
      mesh.scale.y = e.state === 'DEAD' ? 0.18 : 1;
    }
    for (const [eid, mesh] of this.enemyMeshes) {
      if (!seen.has(eid)) { this.scene.remove(mesh); this.enemyMeshes.delete(eid); }
    }
  }

  /**
   * Draw the current simulation state.
   * @param {SimState} sim
   */
  render(sim) {
    const c = sim.camera;
    this.playerMesh.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
    this.playerMesh.rotation.y = (sim.player.yaw * Math.PI) / 180;
    this.playerMesh.visible = !c.override;    // a posed camera is usually inside the character
    this.syncEntities(sim);

    this.camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    this._look.set(c.pivot[0], c.pivot[1], c.pivot[2]);
    this.camera.lookAt(this._look);
    this.camera.up.set(0, 1, 0);              // roll is exactly 0 (RI-CAM06 §E)
    if (this.camera.fov !== c.fov) { this.camera.fov = c.fov; this.camera.updateProjectionMatrix(); }

    this._focus.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
    // Region fog. RI-WLD04 counts fog as ONE of nine axes and never more than one, but it is the
    // axis Morrowind leans on hardest — an Ashlands frame is red because the fog is red — so it is
    // driven from the region under the camera rather than from a single global constant.
    let regionFog = null;
    if (this.cell === 'province' && this.field) {
      const cx = clamp(c.pos[0], 0, this.field.sizeX - 1), cz = clamp(c.pos[2], 0, this.field.sizeZ - 1);
      const r = this.field.regionAt(cx, cz);
      regionFog = { colour: r.fog.colour, extinction: r.fog.extinction_per_m };
    }
    this.sky.apply(sim.env.timeOfDay, sim.env.weather, this._focus, regionFog);
    this.sky.followCamera(this.camera);

    this.three.info.reset();
    this.three.render(this.scene, this.camera);
    // Read the counters AFTER the present, not before (RI-PLT01 "How we lose" #11).
    const info = this.three.info;
    this.lastStats = {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: (this.three.info.programs || []).length,
    };
    return true;
  }

  /**
   * A-JRN8: the extended scene census. Counted from the live scene graph, never declared —
   * and counted only over VISIBLE subtrees, because a light in a cell that is not being
   * drawn is not a shadow caster this frame and reporting it would overstate the budget.
   */
  sceneCensus() {
    const materials = new Set();
    let skinned = 0, shadowLights = 0, meshes = 0, instancedTris = 0;
    const visit = (root, fn) => {
      if (!root.visible) return;
      fn(root);
      for (const c of root.children) visit(c, fn);
    };
    visit(this.scene, (o) => {
      if (o.isMesh || o.isInstancedMesh) {
        meshes++;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mm) if (mat) materials.add(mat.uuid);
        if (o.isSkinnedMesh) skinned++;
        if (o.isInstancedMesh && o.geometry.index) instancedTris += (o.geometry.index.count / 3) * o.count;
      }
      if (o.isLight && o.castShadow) shadowLights++;
    });
    let textureBytes = 0, geometryBytes = 0;
    visit(this.scene, (o) => {
      if (!o.geometry) return;
      for (const name of Object.keys(o.geometry.attributes)) {
        const a = o.geometry.attributes[name];
        geometryBytes += a.array.byteLength;
      }
      if (o.geometry.index) geometryBytes += o.geometry.index.array.byteLength;
    });
    return {
      meshes,
      materials: materials.size,
      skinnedMeshes: skinned,
      shadowLights,
      instancedTriangles: Math.round(instancedTris),
      geometryMB: +(geometryBytes / 1048576).toFixed(3),
      textureMB: +(textureBytes / 1048576).toFixed(3),
      programs: (this.three.info.programs || []).length,
      atlasCount: 0,
    };
  }

  setUIVisible(v) { this.uiVisible = !!v; return this.uiVisible; }

  listAnchors() { return Object.keys(this.anchors).sort(); }

  anchor(name) { return this.anchors[name] || null; }

  weatherIds() { return Object.keys(WEATHER); }

  async screenshotDataURL() { return this.canvas.toDataURL('image/png'); }
}

/** Release a replaced scene graph. A rebuild per seed change must not be a leak per seed. */
function disposeGraph(root) {
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry.uuid)) { seen.add(o.geometry.uuid); o.geometry.dispose(); }
    const mm = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mm) if (m && !seen.has(m.uuid)) { seen.add(m.uuid); m.dispose(); }
  });
}
