// What the thirteen ONLY-HERE elements look like.
//
// The landform half of each element is the GROUND — `signature.js profile()` is evaluated by
// `WorldField.heightAt()`, so the crater, the comb tread, the petrified crown and the root
// causeway are already in the terrain mesh and in the collision by the time this file runs. What
// is here is everything that is not ground: the flute's bore, the kiln's flue, the hull's ribs and
// chimney, the arch over the root, and the six kinds that are structures rather than landform.
//
// Every kind is a DIFFERENT SILHOUETTE, deliberately, because the round-2 critic stripped colour
// and exposure out of the region frames and separability fell from 74.4% to 30.8%: what survives
// that is shape. None of these reuses another's geometry, which is also RI-WLD04's "ONLY-HERE
// assets reused" failure mode read forwards.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { SIGNATURE_KINDS } from './signature.js';

const c3 = (hex) => new THREE.Color(hex);

/** Merge a list of geometries into one, so a kind is a single instanced draw. */
export function mergeAll(parts) { return weld(parts); }
function weld(parts) {
  let vcount = 0, icount = 0;
  for (const g of parts) { vcount += g.attributes.position.count; icount += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vcount * 3), nrm = new Float32Array(vcount * 3);
  // Preserve texture coordinates whenever any source contributes them.  This merger is shared
  // by the instanced regional silhouettes and vegetation; dropping UVs made alpha-tested foliage
  // sample a single texel and disappear even though its instances were alive and counted.
  const hasUv = parts.some((g) => !!g.attributes.uv);
  const uv = hasUv ? new Float32Array(vcount * 2) : null;
  const idx = vcount > 65535 ? new Uint32Array(icount) : new Uint16Array(icount);
  let vo = 0, io = 0;
  for (const g of parts) {
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nrm[(vo + i) * 3] = n.getX(i); nrm[(vo + i) * 3 + 1] = n.getY(i); nrm[(vo + i) * 3 + 2] = n.getZ(i);
      if (uv) {
        uv[(vo + i) * 2] = t ? t.getX(i) : 0;
        uv[(vo + i) * 2 + 1] = t ? t.getY(i) : 0;
      }
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = i + vo; io += p.count; }
    vo += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/**
 * The non-ground body of one kind, built at unit scale in the instance's local frame with y = 0
 * at the ground the instance stands on. Returned as `{ body, glow }` — `glow` is null unless the
 * kind emits at night, and RI-WLD04 M17 step 6 is the reason six of them do.
 */
export function signatureGeometry(kind) {
  switch (kind) {
    // ---- Valus Ridge: a limestone flute. The bore is the identity — you can see sky through it.
    case 'rock_flute_spire': {
      const H = 1;                                        // scaled by the instance height
      const parts = [];
      const shaft = new THREE.CylinderGeometry(0.10, 0.34, H * 0.92, 9, 1, true);
      shaft.translate(0, H * 0.50, 0);
      parts.push(shaft);
      // Three wind-bored holes, cut as visible ring collars rather than as CSG (a software
      // rasteriser has no CSG): the collar reads as a hole at any distance the frame is taken at.
      for (const [t, r] of [[0.44, 0.13], [0.62, 0.10], [0.76, 0.075]]) {
        const ring = new THREE.TorusGeometry(r, r * 0.34, 5, 10);
        ring.rotateY(t * 7.3);
        ring.translate(0, H * t, 0);
        parts.push(ring);
      }
      const cap = new THREE.ConeGeometry(0.11, H * 0.10, 7);
      cap.translate(0, H * 0.96, 0);
      parts.push(cap);
      return { body: weld(parts), glow: null };
    }

    // ---- The Stone Forest: the stump is ground; the snapped shards standing on it are not.
    case 'petrified_bole': {
      const parts = [];
      for (let i = 0; i < 3; i++) {
        const a = i * 2.31;
        const sh = new THREE.ConeGeometry(0.10 - i * 0.02, 0.30 + i * 0.12, 5);
        sh.rotateZ((i - 1) * 0.22);
        sh.translate(Math.cos(a) * 0.16, 0.16 + i * 0.06, Math.sin(a) * 0.16);
        parts.push(sh);
      }
      return { body: weld(parts), glow: null };
    }

    // ---- Stone Wastes: the crater is ground. What stands is the glass — shards on the floor.
    case 'glassed_crater': {
      const parts = [];
      for (let i = 0; i < 9; i++) {
        const a = i * 2.79, r = 0.10 + (i % 4) * 0.10;
        const sh = new THREE.ConeGeometry(0.030 + (i % 3) * 0.010, 0.10 + (i % 5) * 0.05, 4);
        sh.rotateZ(Math.sin(a) * 0.4);
        sh.translate(Math.cos(a) * r, 0.05, Math.sin(a) * r);
        parts.push(sh);
      }
      return { body: weld(parts), glow: null };
    }

    // ---- The Clay Moor: the dome is ground; the flue and its ember mouth are not.
    case 'naga_kiln_dome': {
      const parts = [];
      const flue = new THREE.CylinderGeometry(0.055, 0.085, 0.34, 7);
      flue.translate(0, 1.10, 0);
      parts.push(flue);
      const lip = new THREE.TorusGeometry(0.075, 0.022, 4, 8);
      lip.rotateX(Math.PI / 2); lip.translate(0, 1.27, 0);
      parts.push(lip);
      // The door: a fired arch on the apron, so the dome reads as a BUILDING and not as a hill.
      const door = new THREE.CylinderGeometry(0.14, 0.14, 0.10, 8, 1, false, 0, Math.PI);
      door.rotateZ(Math.PI / 2); door.rotateY(Math.PI / 2);
      door.translate(0, 0.16, 0.68);
      parts.push(door);
      const glow = new THREE.SphereGeometry(0.085, 8, 6);
      glow.translate(0, 1.24, 0);
      const mouth = new THREE.CircleGeometry(0.13, 8);
      mouth.translate(0, 0.14, 0.735);
      return { body: weld(parts), glow: weld([glow, mouth]) };
    }

    // ---- The Hive: the treads are ground; the comb cells in the risers are not.
    case 'comb_cliff': {
      const parts = [], cells = [];
      for (let tier = 0; tier < 4; tier++) {
        const rr = 1 - tier * 0.25;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + tier * 0.31;
          const hex = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 6);
          hex.rotateX(Math.PI / 2);
          hex.rotateY(-a);
          hex.translate(Math.cos(a) * rr * 0.99, 0.045 + tier * 0.25, Math.sin(a) * rr * 0.99);
          (i % 3 === 0 ? cells : parts).push(hex);
        }
      }
      return { body: weld(parts), glow: weld(cells) };
    }

    // ---- Marauder's Coast: the hull is ground; the ribs, the keel and the chimney are not.
    case 'beached_hull_house': {
      const parts = [];
      const keel = new THREE.BoxGeometry(2.0, 0.06, 0.08);
      keel.translate(0, 1.00, 0);
      parts.push(keel);
      for (let i = -3; i <= 3; i++) {
        const t = i / 3.4;
        const rib = new THREE.TorusGeometry(0.30 * Math.sqrt(Math.max(0.04, 1 - t * t)), 0.022, 4, 10, Math.PI);
        rib.rotateY(Math.PI / 2);
        rib.translate(t * 0.98, 0.62, 0);
        parts.push(rib);
      }
      const chim = new THREE.CylinderGeometry(0.045, 0.055, 0.34, 6);
      chim.translate(0.34, 1.14, 0);
      parts.push(chim);
      const glow = new THREE.SphereGeometry(0.055, 7, 5);
      glow.translate(0.34, 1.30, 0);
      // A door cut low in the hull, where the deck used to be.
      const door = new THREE.BoxGeometry(0.10, 0.20, 0.02);
      door.translate(-0.55, 0.10, 0.21);
      return { body: weld(parts), glow: weld([glow, door]) };
    }

    // ---- Western Rootlands: the causeway is ground; the branch arching over it is not.
    case 'root_arch': {
      const parts = [];
      const arch = new THREE.TorusGeometry(1.55, 0.20, 6, 14, Math.PI);
      arch.rotateY(Math.PI / 2);
      arch.translate(0, 0.35, 0);
      parts.push(arch);
      for (const s of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.20, 0.30, 0.9, 6);
        leg.translate(0, 0.0, s * 1.55);
        parts.push(leg);
      }
      const drop = new THREE.ConeGeometry(0.07, 0.55, 5);
      drop.rotateX(Math.PI);
      drop.translate(0, 1.42, 0.5);
      parts.push(drop);
      return { body: weld(parts), glow: null };
    }

    // ---- Blackwood: white stone with roots through it, welkynd-lit.
    case 'welkynd_pillar': {
      const parts = [];
      const shaft = new THREE.CylinderGeometry(0.115, 0.145, 0.86, 8);
      shaft.translate(0, 0.44, 0);
      parts.push(shaft);
      const cap = new THREE.CylinderGeometry(0.20, 0.155, 0.09, 8);
      cap.translate(0, 0.92, 0);
      parts.push(cap);
      const plinth = new THREE.BoxGeometry(0.40, 0.10, 0.40);
      plinth.rotateY(0.4); plinth.translate(0, 0.05, 0);
      parts.push(plinth);
      // Roots through it: three helical bands. This is the "swallowed by living wood" clause.
      for (let i = 0; i < 3; i++) {
        const root = new THREE.TorusGeometry(0.155, 0.035, 4, 9, Math.PI * 1.5);
        root.rotateX(0.34); root.rotateY(i * 2.1);
        root.translate(0, 0.22 + i * 0.26, 0);
        parts.push(root);
      }
      const stone = new THREE.OctahedronGeometry(0.10, 0);
      stone.translate(0, 1.03, 0);
      return { body: weld(parts), glow: weld([stone]) };
    }

    // ---- Eastern Rootlands: a translucent bell hanging in the air over the water.
    case 'swamp_jelly_canopy': {
      const bell = new THREE.SphereGeometry(1.0, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.58);
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const t = new THREE.CylinderGeometry(0.020, 0.006, 1.5, 4);
        t.translate(Math.cos(a) * 0.62, -0.75, Math.sin(a) * 0.62);
        parts.push(t);
      }
      return { body: weld(parts), glow: weld([bell]) };
    }

    // ---- The Deep Marshes: mud that moves toward you. Low, wide, lobed.
    case 'voriplasm': {
      const parts = [];
      const core = new THREE.SphereGeometry(1.0, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
      core.scale(1, 0.42, 1);
      parts.push(core);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.257;
        const lobe = new THREE.SphereGeometry(0.42, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
        lobe.scale(1, 0.36, 1);
        lobe.translate(Math.cos(a) * 0.86, 0, Math.sin(a) * 0.86);
        parts.push(lobe);
      }
      const eye = new THREE.SphereGeometry(0.16, 7, 5);
      eye.translate(0, 0.30, 0);
      return { body: weld(parts), glow: weld([eye]) };
    }

    // ---- Crimson Coast: an open stone vat, full, fuming.
    case 'open_dye_vat': {
      const parts = [];
      const wall = new THREE.CylinderGeometry(1.0, 1.05, 0.85, 12, 1, true);
      wall.translate(0, 0.42, 0);
      parts.push(wall);
      const rim = new THREE.TorusGeometry(1.02, 0.075, 5, 14);
      rim.rotateX(Math.PI / 2); rim.translate(0, 0.85, 0);
      parts.push(rim);
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1;
        const post = new THREE.CylinderGeometry(0.055, 0.055, 1.5, 5);
        post.translate(Math.cos(a) * 1.28, 0.75, Math.sin(a) * 1.28);
        parts.push(post);
      }
      const surface = new THREE.CircleGeometry(0.95, 14);
      surface.rotateX(-Math.PI / 2); surface.translate(0, 0.74, 0);
      return { body: weld(parts), glow: weld([surface]) };
    }

    // ---- The Salt Hills: a cut post with a carved face, set square to the road.
    case 'imperial_milestone': {
      const parts = [];
      const post = new THREE.BoxGeometry(0.34, 1.0, 0.24);
      post.translate(0, 0.5, 0);
      parts.push(post);
      const cap = new THREE.CylinderGeometry(0.20, 0.20, 0.16, 8, 1, false, 0, Math.PI);
      cap.rotateZ(Math.PI / 2); cap.rotateY(Math.PI / 2);
      cap.translate(0, 1.0, 0);
      parts.push(cap);
      // The carved face: three incised bands, which is what "distances carved in Cyrodilic" is
      // at this polygon budget, and it is the thing that distinguishes it from a rock.
      for (let i = 0; i < 3; i++) {
        const line = new THREE.BoxGeometry(0.22, 0.030, 0.02);
        line.translate(0, 0.74 - i * 0.15, 0.13);
        parts.push(line);
      }
      const base = new THREE.BoxGeometry(0.46, 0.10, 0.36);
      base.translate(0, 0.05, 0);
      parts.push(base);
      return { body: weld(parts), glow: null };
    }

    // ---- Thornmarsh: a stem blazed at eye height. The blaze is the navigation system.
    case 'knife_mark_stem': {
      const parts = [];
      const stem = new THREE.CylinderGeometry(0.045, 0.085, 1.0, 6);
      stem.translate(0, 0.5, 0);
      parts.push(stem);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.9;
        const thorn = new THREE.ConeGeometry(0.022, 0.16, 4);
        thorn.rotateZ(Math.PI / 2 + Math.sin(a) * 0.5);
        thorn.rotateY(a);
        thorn.translate(Math.cos(a) * 0.10, 0.24 + i * 0.16, Math.sin(a) * 0.10);
        parts.push(thorn);
      }
      // The blaze: a pale chevron cut at 1.6 m, on the side that points to the next one.
      for (const s of [-1, 1]) {
        const cut = new THREE.BoxGeometry(0.012, 0.14, 0.055);
        cut.rotateX(s * 0.6);
        cut.translate(0.052, 0.47, s * 0.035);
        parts.push(cut);
      }
      return { body: weld(parts), glow: null };
    }

    default: throw new Error(`signatureGeometry: no geometry for kind '${kind}'`);
  }
}

/** The body and glow materials for a kind. */
export function signatureMaterials(kind, region) {
  const K = SIGNATURE_KINDS[kind];
  const BODY = {
    rock_flute_spire: { color: '#CFC6AC', roughness: 0.72 },
    petrified_bole: { color: '#8B93A0', roughness: 0.55 },
    glassed_crater: { color: '#DCE8EE', roughness: 0.12, metalness: 0.30 },
    naga_kiln_dome: { color: '#A85536', roughness: 0.48 },
    comb_cliff: { color: '#D9BE70', roughness: 0.62 },
    beached_hull_house: { color: '#4A3A2C', roughness: 0.88 },
    root_arch: { color: '#7A5F36', roughness: 0.80 },
    welkynd_pillar: { color: '#E8ECE6', roughness: 0.42 },
    swamp_jelly_canopy: { color: '#9FE8D0', roughness: 0.20 },
    voriplasm: { color: '#3B2A50', roughness: 0.35 },
    open_dye_vat: { color: '#6E5A50', roughness: 0.74 },
    imperial_milestone: { color: '#C9C3B2', roughness: 0.66 },
    knife_mark_stem: { color: '#3A3028', roughness: 0.94 },
  }[kind];
  const body = new THREE.MeshStandardMaterial({
    color: c3(BODY.color), roughness: BODY.roughness, metalness: BODY.metalness || 0,
    side: kind === 'swamp_jelly_canopy' ? THREE.DoubleSide : THREE.FrontSide,
  });
  let glow = null;
  if (K.glow > 0) {
    const g = c3(K.glow_hex || region.palette_hex[2]);
    glow = new THREE.MeshStandardMaterial({
      color: g, emissive: g, emissiveIntensity: K.glow * 2.2, roughness: 0.35,
      transparent: kind === 'swamp_jelly_canopy', opacity: kind === 'swamp_jelly_canopy' ? 0.66 : 1,
      side: kind === 'swamp_jelly_canopy' ? THREE.DoubleSide : THREE.FrontSide,
    });
  }
  return { body, glow };
}
