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
import { buildScene, makeActor, terrainHeight } from './scene.js';
import { Sky, WEATHER } from './sky.js';

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
    this.setCell('exterior');

    this.sky = new Sky(this.scene);
    this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 900);
    this.enemyMeshes = new Map();
    this.uiVisible = true;
    this.lastStats = { drawCalls: 0, triangles: 0, programs: 0, geometries: 0, textures: 0 };
    this._look = new THREE.Vector3();
    this._focus = new THREE.Vector3();
    this.setSize(canvas.width, canvas.height);
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
  groundAt(x, z, seed, cell) {
    const c = cell || this.cell;
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
    this.sky.apply(sim.env.timeOfDay, sim.env.weather, this._focus);
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

  /** A-JRN8: the extended scene census. Counted from the live scene graph, never declared. */
  sceneCensus() {
    const materials = new Set();
    let skinned = 0, shadowLights = 0, meshes = 0, instancedTris = 0;
    this.scene.traverse((o) => {
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
    this.scene.traverse((o) => {
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
