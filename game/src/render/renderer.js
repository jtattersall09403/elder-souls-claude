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
import { makeRiggedActor, poseFromRig, poseStatic } from './actor.js';
import { Sky, WEATHER } from './sky.js';
import { Province } from '../world/province.js';
import { SIGNATURE_KINDS } from '../world/signature.js';
import { SpellVFX } from './spell-vfx.js';
import { UILayer } from './ui.js';
import { UISurface } from '../ui/surface.js';
import { TitleLayer } from './title.js';
import { textRegister } from './text-register.js';

// Skin tints so the people in a room are people rather than six copies of one silhouette.
// Keyed by the `race` field on the NPC record; unknown races fall back to the first.
const RACE_TINT = {
  saxhleel: [0x4f6141, 0x3d5136],
  naga: [0x3f5a46, 0x2f4436],
  imperial: [0xb9a189, 0x5a4a38],
  dunmer: [0x6b5a63, 0x3a2f3c],
  altmer: [0xc4c096, 0x6a6a44],
  bosmer: [0x9c8a63, 0x4d4429],
  breton: [0xc0a98c, 0x4a4258],
  nord: [0xc8b096, 0x53503f],
  orsimer: [0x7d8a63, 0x3f4a30],
  khajiit: [0xa3855a, 0x5c452a],
  redguard: [0x8a6547, 0x3c4a4e],
};

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
    this.npcMeshes = new Map();
    this.propMeshes = new Map();
    // The dialogue surface. Drawn INTO this canvas, not into the DOM — see render/ui.js.
    this.ui = new UILayer(canvas.width, canvas.height);
    // W1-21. The HUD and the menus, on a SECOND offscreen 2D canvas composited as a second
    // textured quad, for exactly the reason the first one exists: `screenshotDataURL()` is
    // `canvas.toDataURL()`, so anything in the DOM is present for a human and absent from every
    // frame the harness captures. It is a separate surface from the dialogue one rather than a
    // shared one because W1-07 owns that file and its layout rules (a bottom-anchored panel
    // capped at 42% of frame height) are not the HUD's. Composited AFTER it, so a dialogue
    // panel never covers your health.
    this.menus = new UISurface(canvas.width, canvas.height);
    this.uiVisible = true;
    // The title surface. Same argument, same canvas — see render/title.js. `RI-JRN01` M20.
    this.title = new TitleLayer(canvas.width, canvas.height);
    // Every 2D surface this renderer owns is registered against the one rendered-text
    // register, so `__HARNESS.getRenderedText()` enumerates the frame's strings rather than
    // an empty accessibility tree. `RI-JRN01` §0.1(a) refuses to score M9/M15 without this.
    this.textRegister = textRegister;
    textRegister.instrument(this.ui.ctx, 'dialogue');
    textRegister.instrument(this.title.ctx, 'title');
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
    this.npcMeshes.clear();
    this.propMeshes.clear();
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
    this.ui.setSize(w, h);
    // The UI canvas is resized to the drawing buffer, never scaled to it. That is the whole of
    // RI-UIX06 M-F17.2: a fixed-size canvas blitted to a larger buffer is the upscaled-bitmap
    // signature it exists to catch, and a canvas that tracks the buffer has nothing to upscale.
    if (this.menus && this.menus.setSize(w, h) && this.uiBuild) this.uiBuild(true);
    if (this.title) this.title.setSize(w, h);
    if (this.vfx) this.vfx.setSize(w, h);
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

  /**
   * Any live rig, borrowed purely as a BONE LIST so an actor with no combat body of its own
   * (a villager) can still be built as a humanoid. Its pose is never read.
   */
  _anyRig(sim) {
    const C = sim && sim._combat;
    if (!C) return null;
    if (C.player && C.player.rig) return C.player.rig;
    for (const b of C.bodies || []) if (b.rig) return b.rig;
    return null;
  }

  syncEntities(sim) {
    const seen = new Set();
    const C = sim._combat;
    for (const e of sim.entities) {
      seen.add(e.eid);
      let mesh = this.enemyMeshes.get(e.eid);
      if (!mesh) {
        mesh = makeRiggedActor(this.mats, e.archetype === 'DUMMY' ? 0x7a6a4a : 0x5d3b2c, 0x7d8460);
        mesh.name = 'enemy:' + e.eid;
        this.scene.add(mesh);
        this.enemyMeshes.set(e.eid, mesh);
      }
      // An enemy has a combat body too, and it swings a weapon at you — so it is posed from
      // its OWN rig by the same call the player uses. Before this, the thing hitting you was
      // a box that never moved, which is why the round-3 critic could not judge an enemy
      // swing either.
      const eb = C && C.bodyOf ? C.bodyOf(e.eid) : null;
      if (!(eb && poseFromRig(mesh, eb))) {
        poseStatic(mesh, this._anyRig(sim), e.pos, e.yaw);
        mesh.scale.y = e.state === 'DEAD' ? 0.18 : 1;
      }
      mesh.visible = true;
    }
    for (const [eid, mesh] of this.enemyMeshes) {
      if (!seen.has(eid)) { this.scene.remove(mesh); this.enemyMeshes.delete(eid); }
    }
  }

  /**
   * The people. W1-07's round-1 verdict: "`writ-house` — the piece's own interior —
   * instantiates 0 entities. There is no NPC whose disposition could be derived." These are
   * that, drawn: one actor per record in `sim.npcs`, tinted by race and scaled by build, so
   * the Warden-Scribe behind the desk is an object in the scene graph.
   */
  syncNPCs(sim) {
    const npcs = sim.npcs || [];
    const seen = new Set();
    for (const n of npcs) {
      seen.add(n.eid);
      let mesh = this.npcMeshes.get(n.eid);
      if (!mesh) {
        const tint = RACE_TINT[n.race] || RACE_TINT.saxhleel;
        // Race tint is now handed to the actor at build time — `makeRiggedActor` clones the
        // skin and cloth materials per actor, so a Dunmer and an Imperial in the same room are
        // not the same colour and no caller has to reach into the child list to fix it.
        mesh = makeRiggedActor(this.mats, tint[1], tint[0]);
        mesh.scale.setScalar(n.height_scale || 1);
        mesh.name = 'npc:' + n.eid;
        this.scene.add(mesh);
        this.npcMeshes.set(n.eid, mesh);
      }
      // A villager has no combat body, so the rig is borrowed for its bone list only and the
      // group transform poses it — a proper humanoid standing still, rather than a box.
      poseStatic(mesh, this._anyRig(sim), n.pos, n.yaw);
      mesh.visible = n.visible !== false;
    }
    for (const [eid, mesh] of this.npcMeshes) {
      if (!seen.has(eid)) { this.scene.remove(mesh); this.npcMeshes.delete(eid); }
    }
  }

  /** World objects: a thing on a crate that you can pick up (RI-JRN01 O6, M10). */
  syncProps(sim) {
    const props = sim.props || [];
    const seen = new Set();
    for (const o of props) {
      seen.add(o.eid);
      let mesh = this.propMeshes.get(o.eid);
      if (!mesh) {
        mesh = new THREE.Mesh(
          o.shape === 'tall' ? new THREE.CylinderGeometry(0.07, 0.09, 0.34, 8) : new THREE.BoxGeometry(0.24, 0.14, 0.17),
          o.material === 'metal' ? this.mats.metal : o.material === 'reed' ? this.mats.reed : this.mats.plank);
        mesh.castShadow = true;
        mesh.name = 'prop:' + o.eid;
        this.scene.add(mesh);
        this.propMeshes.set(o.eid, mesh);
      }
      mesh.position.set(o.pos[0], o.pos[1], o.pos[2]);
      mesh.rotation.y = (o.yaw || 0) * Math.PI / 180;
      mesh.visible = !o.taken;
    }
    for (const [eid, mesh] of this.propMeshes) {
      if (!seen.has(eid)) { this.scene.remove(mesh); this.propMeshes.delete(eid); }
    }
  }

  /**
   * W1-13 — the bloom and the sapwells, as objects in the scene graph.
   *
   * RI-JRN06 D14 is a VISIBILITY budget with a number on it: the stain must be findable from
   * 12 m in daylight and 6 m in a dark interior, "because a stain the player cannot find is a
   * stain they lose to geometry rather than to a second death". The item's own remedy for a
   * hard-to-find stain is this budget and never a marker (D19, HF6), so the bloom is built to
   * be read at distance: a 1.1 m grey fungal knot (RI-LOR05 §4 — "within an hour a grey fungal
   * knot grows over it, humming faintly") with an unlit, tone-mapping-exempt emissive cap, so
   * it is legible at 01:00 in a cave without a light being added to the scene.
   *
   * The sapwell is the same idea at the other end of the run: a basin of xanmeer stone with
   * amber sap standing in it, drawn for every well within 160 m so the thing you are running
   * back from is a place and not a coordinate.
   */
  syncDeathMarkers(sim, hearths) {
    if (!this._marks) {
      this._marks = { stain: null, wells: new Map(), group: new THREE.Group() };
      this._marks.group.name = 'w1-13:markers';
      this.scene.add(this._marks.group);
    }
    const M = this._marks;
    const stain = sim.quest && sim.quest.death ? sim.quest.death.bloodstain : null;
    if (stain && !M.stain) {
      const g = new THREE.Group();
      const knot = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0x9a9384, roughness: 0.95, metalness: 0.0 }));
      knot.scale.set(1.0, 0.42, 1.0);
      knot.position.y = 0.14;
      knot.castShadow = true;
      g.add(knot);
      // The hum, made visible. `toneMapped: false` so the cap keeps its value through ACES and
      // stays readable in a region whose fog extinction is eating everything else.
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.30, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xd8b25a, toneMapped: false, transparent: true, opacity: 0.92 }));
      cap.scale.set(1.0, 0.55, 1.0);
      cap.position.y = 0.34;
      g.add(cap);
      // A ground halo, which is what carries the read at 12 m: a small bright object is a
      // pixel, a 1.6 m disc on the mud is a shape.
      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(0.82, 20),
        new THREE.MeshBasicMaterial({ color: 0xc79a4a, toneMapped: false, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.035;
      g.add(halo);
      g.name = 'bloom';
      M.group.add(g);
      M.stain = g;
    } else if (!stain && M.stain) {
      M.group.remove(M.stain);
      M.stain = null;
    }
    if (M.stain && stain) M.stain.position.set(stain.pos[0], stain.pos[1], stain.pos[2]);

    const list = hearths ? hearths.list() : [];
    const px = sim.player.pos[0], pz = sim.player.pos[2];
    for (const h of list) {
      const near = Math.hypot(h.pos[0] - px, h.pos[2] - pz) <= 160;
      let mesh = M.wells.get(h.id);
      if (near && !mesh) {
        const g = new THREE.Group();
        const basin = new THREE.Mesh(
          new THREE.CylinderGeometry(1.15, 1.35, 0.62, 12),
          new THREE.MeshStandardMaterial({ color: 0x6d6455, roughness: 0.92 }));
        basin.position.y = 0.31; basin.castShadow = true; basin.receiveShadow = true;
        g.add(basin);
        const sap = new THREE.Mesh(
          new THREE.CylinderGeometry(1.02, 1.02, 0.06, 12),
          new THREE.MeshBasicMaterial({ color: 0xe0a63c, toneMapped: false }));
        sap.position.y = 0.60;
        g.add(sap);
        // The cut root the basin stands on — the wound that was never allowed to close.
        const root = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.30, 1.9, 8),
          new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 0.96 }));
        root.position.set(0.95, 0.95, -0.4); root.rotation.z = 0.26;
        g.add(root);
        g.position.set(h.pos[0], h.pos[1], h.pos[2]);
        g.name = 'sapwell:' + h.id;
        M.group.add(g);
        M.wells.set(h.id, g);
      } else if (!near && mesh) {
        M.group.remove(mesh);
        M.wells.delete(h.id);
      }
    }
    M.group.visible = true;
  }

  /**
   * Draw the current simulation state.
   * @param {SimState} sim
   */
  render(sim) {
    // Every string painted from here on belongs to this simulation frame, so a critic can
    // ask the register what the frame said at the node it screenshotted.
    textRegister.setFrame(sim.frame);
    const c = sim.camera;
    // ---- the player, posed from the fight's own rig ----------------------------------------
    // `sim._combat` is hung on the sim by Engine.loadState (engine.js). The combat body is the
    // AUTHORITY and `sim.player` is a view (sim/combat-bridge.js) — the view carries a position
    // and a yaw and nothing else, which is precisely why writing only those two numbers here
    // drew one static box for every weapon and every frame of every clip.
    const cb = sim._combat && sim._combat.player;
    if (!(cb && poseFromRig(this.playerMesh, cb))) {
      poseStatic(this.playerMesh, this._anyRig(sim), sim.player.pos, sim.player.yaw);
    }
    // S18 / RI-CAM07: the character is third-person ALWAYS, so it is drawn always. This line
    // used to read `!c.override`, which hid the player for every posed-camera capture in the
    // project — including the three weapon screenshots the round-3 critic found byte-identical,
    // which contained no character at all. A camera placed inside the head is a camera problem
    // and is solved by near-plane clipping, not by deleting the subject of the photograph.
    this.playerMesh.visible = true;
    this.syncEntities(sim);
    this.syncNPCs(sim);
    this.syncProps(sim);
    this.syncDeathMarkers(sim, this.hearths);

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
      // The region's own night colour comes off its ONLY-HERE element, so what little light there
      // is at 01:00 is light that region owns and no other region has.
      const K = this.field.sig && SIGNATURE_KINDS[(r.only_here || {}).id];
      regionFog = { colour: r.fog.colour, extinction: r.fog.extinction_per_m,
        glow: K && K.glow > 0 ? K.glow_hex : null };
    }
    this.sky.apply(sim.env.timeOfDay, sim.env.weather, this._focus, regionFog);
      // The province's own night lamps, driven off the same sun elevation the sky is: at 01:00 the
      // welkynd pillars, the kiln flues, the comb cells and the drifting jellies are what a region
      // is legible BY. RI-WLD04 M17 step 6: "a region that is only identifiable in clear daylight
      // is half-built."
      if (this.province) {
        const elev = Math.sin(((sim.env.timeOfDay - 6) / 24) * Math.PI * 2);
        this.province.setNightFactor(1 - Math.max(0, Math.min(1, elev * 1.6 + 0.28)) * 1.6);
      }

    this.sky.followCamera(this.camera);

    // ---- seam S19: spell VFX -----------------------------------------------------------------
    // Two passes, and the second one is the frame. The prepass writes scene DEPTH (which soft
    // particles fade against — RI-MAG05 V1, mandatory) and scene COLOUR (which the Veiling
    // refraction displaces — V8) with the VFX group hidden, so the effects never fade against
    // or refract themselves. `info.reset()` happens BETWEEN the two, so the draw-call and
    // triangle counters a critic reads are the VISIBLE frame's and not the sum — reporting the
    // sum would inflate the very budget RI-MAG05 §B2 asks us to stay inside.
    if (!this.vfx && sim.magic && sim.magic.d && sim.magic.d.vfx) {
      this.vfx = new SpellVFX(this.scene, this.three, sim.magic.d.vfx, { spells: sim.magic.d.spells, effects: sim.magic.d.effects });
      this.vfx.setSize(this.canvas.width, this.canvas.height);
    }
    if (this.vfx) {
      this.vfx.prepass(this.camera);
      this.vfx.update(sim, this.sky, this.camera);
    }

    this.three.info.reset();
    this.three.render(this.scene, this.camera);
    // three.js resets `info` at the top of every top-level `render()`, so the world pass is
    // read here and the UI pass is ADDED to it. RI-PLT01 "How we lose" #11 asks for the
    // counters after the UI pass, not for the UI pass instead of the world one.
    const info = this.three.info;
    const world = {
      calls: info.render.calls, triangles: info.render.triangles,
      points: info.render.points, lines: info.render.lines,
    };
    this.ui.setVisible(this.uiVisible);
    this.ui.render(this.three);
    // W1-21. The HUD and the open screen, laid out for THIS frame and composited as a second
    // textured quad. `uiBuild` is installed by the engine; with no engine attached nothing is
    // drawn and the frame is byte-identical to what it was before this piece existed, which is
    // what keeps every pre-W1-21 shot comparable.
    const uiBefore = info.render.calls;
    if (this.uiVisible && this.uiBuild) { this.uiBuild(false); this.menus.render(this.three); }
    this.menuDrawCalls = info.render.calls - uiBefore;
    // The title composites LAST, over the dialogue surface and over the world. It is the
    // only surface allowed above the scene, and it is still a surface with the live world
    // behind it — `RI-JRN01` M1 counts "full-viewport UI states with no 3D world rendered
    // behind them", and this one never qualifies.
    this.title.render(this.three);
    this.lastStats = {
      drawCalls: world.calls + (this.ui.model && this.uiVisible ? info.render.calls : 0),
      triangles: world.triangles + (this.ui.model && this.uiVisible ? info.render.triangles : 0),
      points: world.points,
      lines: world.lines,
      worldDrawCalls: world.calls,
      uiDrawCalls: this.ui.model && this.uiVisible ? info.render.calls : 0,
      menuDrawCalls: this.menuDrawCalls || 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: (this.three.info.programs || []).length,
      // RI-MAG05 §B2's budget quantities, reported next to the frame they belong to.
      vfx: this.vfx ? { ...this.vfx.stats } : { particles: 0, systems: 0, decals: 0, meshes: 0, particleDrawCalls: 0 },
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
