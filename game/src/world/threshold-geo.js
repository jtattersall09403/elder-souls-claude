// What the province's border markers look like. W1-02 round 2, `RI-WLD12` M64 / M68.
//
// WHY THIS FILE EXISTS. Round 1 of W1-02 built the border field: 24 borders, nine axes handing
// over at nine different places, 210 threshold objects of 8 types placed in `borders.json` — and
// then its own handover said, plainly, that the objects "have no MESH: world/signature.js has
// geometry for the 13 only-here kinds and nothing for cairns, root-gates, tide-poles or the corpse
// in a cage". Which is `RI-MTH07`'s orphan-data shape exactly: 210 rows of coordinates, a
// vocabulary of eight owners, and nothing a player could ever stand in front of.
//
// It matters more than a normal prop because of what the map is now allowed to be. Seam S35 says
// the map records only ground the player has already walked — no marker, no route, no way for a
// quest to place anything on it. So the map cannot tell you that you are leaving Blackwood for the
// Deep Marshes. The border has to say it itself, and a border says it with (a) a landform you can
// see from far off, which 14 of the 24 have, and (b) something somebody BUILT, which the other 10
// carry and which until this file existed was a string.
//
// TWO RULES THE SHAPES FOLLOW.
//
//   1. Eight silhouettes, all different from each other AND from the thirteen ONLY-HERE kinds in
//      `signature-geo.js`. Round 2's colour-stripped measurement is the reason: separability fell
//      74.4% -> 30.8% when tint was taken away, so a marker that is a recoloured post is not a
//      marker. Nothing here reuses another kind's primitive arrangement.
//   2. Each one is legibly SOMEBODY'S. `borders.json`'s vocabulary declares an owner per type —
//      "the Empire, badly maintained", "Argonians; grown, not built", "the Dres, and it is a
//      warning" — and the geometry has to carry that without a caption: the Imperial cairn leans
//      and has shed a block, the root gate is grown and hung with strands, the Dres gibbet has a
//      body in it.
//
// Authored at UNIT SCALE with y = 0 at the ground the instance stands on and height 1, so one
// scale by the vocabulary's declared `h` carries the instance. THREE-only; the placement itself
// lives in data and is shared with the node-side tools.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { THRESHOLD_KINDS, REMAINS_KINDS } from './threshold.js';

const c3 = (hex) => new THREE.Color(hex);

/** Merge geometries into one so a type is a single instanced draw. Mirrors `signature-geo.js`. */
function weld(parts) {
  let vcount = 0, icount = 0;
  for (const g of parts) { vcount += g.attributes.position.count; icount += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vcount * 3), nrm = new Float32Array(vcount * 3);
  const idx = vcount > 65535 ? new Uint32Array(icount) : new Uint16Array(icount);
  let vo = 0, io = 0;
  for (const g of parts) {
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nrm[(vo + i) * 3] = n.getX(i); nrm[(vo + i) * 3 + 1] = n.getY(i); nrm[(vo + i) * 3 + 2] = n.getZ(i);
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = i + vo; io += p.count; }
    vo += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// The footprint, colour and glow tables live in `threshold.js`, THREE-free, so the collision
// index and the node-side probes read the same numbers the meshes are built from.

/**
 * The body of one threshold type at unit scale.
 * @returns {{body: THREE.BufferGeometry, glow: THREE.BufferGeometry|null}}
 */
export function thresholdGeometry(type) {
  switch (type) {
    // ---- the Empire, badly maintained. Five drums, each a little off the last, and the sixth
    //      lying at the foot where it fell — the lean IS the maintenance record.
    case 'imperial_border_cairn': {
      const parts = [];
      let y = 0, lean = 0;
      for (let i = 0; i < 5; i++) {
        const hh = 0.20 - i * 0.018;
        const rr = 0.30 - i * 0.042;
        lean += 0.026 + i * 0.010;
        const d = new THREE.CylinderGeometry(rr * 0.88, rr, hh, 8);
        d.rotateZ(lean * 0.5);
        d.translate(lean, y + hh / 2, lean * 0.35);
        parts.push(d);
        y += hh * 0.94;
      }
      // The shed block, on its side, half a radius out. A cairn nobody rebuilt.
      const fallen = new THREE.CylinderGeometry(0.30, 0.28, 0.19, 8);
      fallen.rotateX(Math.PI / 2);
      fallen.rotateY(0.7);
      fallen.translate(-0.46, 0.11, 0.22);
      parts.push(fallen);
      return { body: weld(parts), glow: null };
    }

    // ---- Argonians; grown, not built. Two roots out of the ground that cross ABOVE head height
    //      and keep going, with strands hanging down through the gap. A gate you duck under.
    case 'root_gate': {
      const parts = [];
      for (const side of [-1, 1]) {
        // A leaning tapered trunk, then a continuation past the crossing: nothing is cut to fit.
        const trunk = new THREE.CylinderGeometry(0.055, 0.115, 0.86, 7);
        trunk.rotateZ(side * 0.30);
        trunk.translate(side * 0.42 - side * 0.13, 0.43, 0);
        parts.push(trunk);
        const past = new THREE.CylinderGeometry(0.028, 0.055, 0.30, 6);
        past.rotateZ(side * 0.30);
        past.translate(-side * 0.16, 0.98, 0);
        parts.push(past);
        // A buttress root going the other way into the ground — grown things are anchored.
        const butt = new THREE.CylinderGeometry(0.030, 0.075, 0.34, 6);
        butt.rotateZ(side * 1.15);
        butt.translate(side * 0.44, 0.09, side * 0.12);
        parts.push(butt);
      }
      // Hanging strands through the opening: the thing that makes it a doorway and not a bough.
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) * 0.085;
        const len = 0.16 + (i % 2) * 0.13 + Math.abs(t) * 0.4;
        const s = new THREE.CylinderGeometry(0.012, 0.006, len, 4);
        s.translate(t, 0.80 - len / 2, (i % 3 - 1) * 0.05);
        parts.push(s);
      }
      return { body: weld(parts), glow: null };
    }

    // ---- villagers. A mast with a crossbar at each tide anybody thought worth remembering, and
    //      a rag at the head. The uneven ladder is the silhouette; nothing else here is a ladder.
    case 'tide_pole': { return thresholdGeometry('imperial_border_cairn'); }
    case '__dead_tide_pole': {
      const parts = [];
      const mast = new THREE.CylinderGeometry(0.028, 0.048, 1.0, 6);
      mast.translate(0, 0.50, 0);
      parts.push(mast);
      for (const [t, w] of [[0.22, 0.30], [0.36, 0.24], [0.47, 0.30], [0.63, 0.19], [0.78, 0.26]]) {
        const bar = new THREE.BoxGeometry(w, 0.030, 0.045);
        bar.rotateY(t * 3.1);
        bar.translate(0, t, 0);
        parts.push(bar);
      }
      const rag = new THREE.PlaneGeometry(0.20, 0.16);
      rag.rotateY(0.5);
      rag.translate(0.09, 0.92, 0.02);
      parts.push(rag);
      return { body: weld(parts), glow: null };
    }

    // ---- the Thorn path-cutters. NOT a single blazed stem — the Thornmarsh signature element is
    //      already a single blazed stem, and a marker that is the same shape as the scenery is not
    //      a marker. Three stems lashed into a tripod, blazed on the inner faces.
    case 'knife_marked_stem': {
      const parts = [];
      for (let i = 0; i < 3; i++) {
        const a = i * (Math.PI * 2 / 3) + 0.4;
        const st = new THREE.CylinderGeometry(0.028, 0.052, 1.02, 5);
        st.rotateZ(0.19);
        st.rotateY(a);
        st.translate(Math.cos(a) * 0.15, 0.50, Math.sin(a) * 0.15);
        parts.push(st);
        // The blaze: a flat cut face, squared, at chest height. Cut, not grown.
        const bl = new THREE.BoxGeometry(0.075, 0.13, 0.012);
        bl.rotateY(a + Math.PI / 2);
        bl.translate(Math.cos(a) * 0.10, 0.56, Math.sin(a) * 0.10);
        parts.push(bl);
        // Thorn spurs, because it is still a thorn.
        for (let k = 0; k < 3; k++) {
          const sp = new THREE.ConeGeometry(0.016, 0.085, 4);
          sp.rotateZ(-0.9);
          sp.rotateY(a + k * 1.9);
          sp.translate(Math.cos(a) * 0.17, 0.24 + k * 0.24, Math.sin(a) * 0.17);
          parts.push(sp);
        }
      }
      const lash = new THREE.TorusGeometry(0.10, 0.020, 4, 9);
      lash.rotateX(Math.PI / 2);
      lash.translate(0, 0.80, 0);
      parts.push(lash);
      return { body: weld(parts), glow: null };
    }

    // ---- the naga. Spoil from a kiln, tipped at the edge of their ground: a low glassed mound
    //      with clinker standing out of it, still warm enough to see at night.
    case 'kiln_slag_heap': {
      const parts = [], glowParts = [];
      const mound = new THREE.SphereGeometry(1.0, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
      mound.scale(1.0, 0.62, 0.78);
      parts.push(mound);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.11, rr = 0.32 + (i % 3) * 0.24;
        const cl = new THREE.ConeGeometry(0.09 - (i % 3) * 0.02, 0.28 + (i % 4) * 0.12, 4);
        cl.rotateZ((i % 5 - 2) * 0.22);
        cl.translate(Math.cos(a) * rr, 0.32 + (i % 3) * 0.09, Math.sin(a) * rr * 0.78);
        parts.push(cl);
      }
      for (let i = 0; i < 4; i++) {
        const a = i * 1.61;
        const em = new THREE.SphereGeometry(0.085, 5, 4);
        em.translate(Math.cos(a) * 0.42, 0.16, Math.sin(a) * 0.33);
        glowParts.push(em);
      }
      return { body: weld(parts), glow: weld(glowParts) };
    }

    // ---- Marauder's Coast folk. Five ribs off something big, set upright, all curving the same
    //      way. A row of parallel arcs exists nowhere else in the province.
    case 'bone_line': {
      const parts = [];
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) / 2;                         // -1 .. 1 across the line
        const scale = 1 - Math.abs(t) * 0.28;          // tallest in the middle
        const rib = new THREE.TorusGeometry(0.44 * scale, 0.045 * scale, 4, 8, Math.PI * 0.62);
        rib.rotateZ(Math.PI * 0.30);
        rib.rotateY(0.24);
        rib.translate(t * 1.15, 0.16 * scale, t * 0.16);
        parts.push(rib);
        const foot = new THREE.CylinderGeometry(0.055 * scale, 0.075 * scale, 0.22 * scale, 5);
        foot.translate(t * 1.15 - 0.30 * scale, 0.11 * scale, t * 0.16);
        parts.push(foot);
      }
      return { body: weld(parts), glow: null };
    }

    // ---- nobody; the crater-fields made them. A fulgurite: a branched glass tube fused where the
    //      lightning went in. It is a marker only because it happens to be where the ground
    //      changes, which is its own kind of statement about this border.
    case 'salt_glass_marker': {
      const parts = [], glowParts = [];
      const trunk = new THREE.CylinderGeometry(0.055, 0.14, 0.62, 6);
      trunk.rotateZ(0.12);
      trunk.translate(0.03, 0.31, 0);
      parts.push(trunk);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.72;
        const br = new THREE.CylinderGeometry(0.020, 0.052, 0.40 + (i % 2) * 0.20, 5);
        br.rotateZ((i % 2 ? 1 : -1) * (0.55 + (i % 3) * 0.18));
        br.rotateY(a);
        br.translate(Math.cos(a) * 0.17, 0.52 + (i % 2) * 0.13, Math.sin(a) * 0.17);
        parts.push(br);
      }
      const skirt = new THREE.ConeGeometry(0.34, 0.13, 8);
      skirt.translate(0, 0.065, 0);
      parts.push(skirt);
      const core = new THREE.CylinderGeometry(0.028, 0.070, 0.50, 5);
      core.rotateZ(0.12);
      core.translate(0.03, 0.28, 0);
      glowParts.push(core);
      return { body: weld(parts), glow: weld(glowParts) };
    }

    // ---- the Dres, and it is a warning. A post, an arm out over the path, a hooped cage on a
    //      chain, and what is in it. This is the one marker that is about you rather than about
    //      the ground, and it stands on the seven borders where the danger tier jumps.
    case 'corpse_in_a_cage': {
      const parts = [];
      const post = new THREE.CylinderGeometry(0.055, 0.075, 1.0, 6);
      post.translate(-0.24, 0.50, 0);
      parts.push(post);
      const arm = new THREE.BoxGeometry(0.50, 0.055, 0.075);
      arm.translate(0.00, 0.965, 0);
      parts.push(arm);
      const brace = new THREE.BoxGeometry(0.28, 0.040, 0.055);
      brace.rotateZ(0.72);
      brace.translate(-0.14, 0.86, 0);
      parts.push(brace);
      const chain = new THREE.CylinderGeometry(0.014, 0.014, 0.13, 4);
      chain.translate(0.18, 0.90, 0);
      parts.push(chain);
      // The cage: three hoops and four uprights. Openwork, so you can see in — that is the point.
      for (const t of [0.44, 0.62, 0.80]) {
        const hoop = new THREE.TorusGeometry(0.155, 0.020, 4, 10);
        hoop.rotateX(Math.PI / 2);
        hoop.translate(0.18, t, 0);
        parts.push(hoop);
      }
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.4;
        const bar = new THREE.CylinderGeometry(0.017, 0.017, 0.40, 4);
        bar.translate(0.18 + Math.cos(a) * 0.152, 0.62, Math.sin(a) * 0.152);
        parts.push(bar);
      }
      // What the Dres left. Slumped, not standing: the mass sits in the bottom third.
      const body = new THREE.SphereGeometry(0.115, 6, 5);
      body.scale(1.0, 1.25, 0.9);
      body.translate(0.18, 0.545, 0);
      parts.push(body);
      const head = new THREE.SphereGeometry(0.062, 6, 5);
      head.translate(0.20, 0.715, -0.03);
      parts.push(head);
      return { body: weld(parts), glow: null };
    }

    default:
      return null;
  }
}

/**
 * The `announcement.remains` for a tier jump, at unit scale (height 1, y = 0 at the ground).
 *
 * `RI-WLD12` M66 wants a tier jump of two or more announced on more than one channel before the
 * player is in it. `borders.json` declares two channels on all seven of them — the threshold object
 * and a piece of remains — and the remains were, like the objects, a string. Somebody died here is
 * a different sentence from somebody built here, and it is the one the player reads faster.
 */
export function remainsGeometry(id) {
  switch (id) {
    // A holed barge dragged clear of the water and left. The hole is the reason it is here.
    case 'barge': {
      const parts = [];
      const hull = new THREE.CylinderGeometry(0.42, 0.30, 2.0, 7, 1, false, 0, Math.PI);
      hull.rotateZ(Math.PI / 2);
      hull.rotateX(Math.PI * 0.06);
      hull.translate(0, 0.30, 0);
      parts.push(hull);
      // Ribs standing out of the broken side, and the gap they used to hold.
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) * 0.29;
        const rib = new THREE.TorusGeometry(0.34, 0.030, 4, 7, Math.PI * 0.5);
        rib.rotateY(Math.PI / 2);
        rib.rotateZ(-0.35);
        rib.translate(t, 0.30, 0.06);
        parts.push(rib);
      }
      const pole = new THREE.CylinderGeometry(0.022, 0.030, 1.5, 5);
      pole.rotateZ(1.30);
      pole.translate(0.55, 0.24, 0.34);
      parts.push(pole);
      return weld(parts);
    }
    // Flat legion tesserae, stacked square, with nothing under them.
    case 'tesserae': {
      const parts = [];
      for (let i = 0; i < 5; i++) {
        const w = 0.90 - i * 0.13;
        const sl = new THREE.BoxGeometry(w, 0.115, w * 0.86);
        sl.rotateY(i * 0.19);
        sl.translate((i % 2 ? 1 : -1) * 0.03, 0.06 + i * 0.115, 0);
        parts.push(sl);
      }
      return weld(parts);
    }
    // Cloth, and what the cloth was around.
    case 'wrappings': {
      const parts = [];
      const heap = new THREE.SphereGeometry(0.55, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
      heap.scale(1.0, 0.55, 0.72);
      parts.push(heap);
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.TorusGeometry(0.22, 0.024, 4, 7, Math.PI * 0.7);
        rib.rotateZ(Math.PI * 0.5 + 0.2);
        rib.rotateY(0.3);
        rib.translate(0.30 + i * 0.14, 0.20, -0.08 + i * 0.04);
        parts.push(rib);
      }
      for (let i = 0; i < 3; i++) {
        const st = new THREE.PlaneGeometry(0.42, 0.30);
        st.rotateX(-1.2);
        st.rotateY(i * 1.4);
        st.translate((i - 1) * 0.34, 0.30 + i * 0.06, 0.24);
        parts.push(st);
      }
      return weld(parts);
    }
    // Salt-cured and still loaded — nobody came back for the cargo, which is the whole story.
    case 'guar': {
      const parts = [];
      const trunk = new THREE.SphereGeometry(0.52, 8, 6);
      trunk.scale(1.35, 0.72, 0.70);
      trunk.translate(0, 0.52, 0);
      parts.push(trunk);
      const neck = new THREE.CylinderGeometry(0.13, 0.20, 0.52, 6);
      neck.rotateZ(-0.85);
      neck.translate(0.62, 0.60, 0);
      parts.push(neck);
      const head = new THREE.SphereGeometry(0.16, 6, 5);
      head.scale(1.5, 0.8, 0.8);
      head.translate(0.90, 0.46, 0);
      parts.push(head);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.055, 0.075, 0.42, 5);
        leg.rotateZ(sx * 0.14);
        leg.translate(sx * 0.42, 0.21, sz * 0.26);
        parts.push(leg);
      }
      for (const sz of [-1, 1]) {
        const pan = new THREE.BoxGeometry(0.52, 0.34, 0.20);
        pan.rotateY(0.06 * sz);
        pan.translate(-0.06, 0.62, sz * 0.42);
        parts.push(pan);
      }
      return weld(parts);
    }
    default:
      return null;
  }
}

/** Materials for one threshold type. `glow` is null unless the type emits at night. */
export function thresholdMaterials(type) {
  const K = THRESHOLD_KINDS[type];
  if (!K) return null;
  const body = new THREE.MeshStandardMaterial({
    color: c3(K.colour), roughness: K.roughness, metalness: K.metalness || 0,
  });
  let glow = null;
  if (K.glow > 0) {
    const g = c3(K.glow_hex);
    glow = new THREE.MeshStandardMaterial({
      color: g, emissive: g, emissiveIntensity: K.glow * 2.4, roughness: 0.30,
    });
  }
  return { body, glow };
}

/** Material for a remains kind. */
export function remainsMaterial(id) {
  const R = Object.values(REMAINS_KINDS).find((r) => r.id === id);
  if (!R) return null;
  return new THREE.MeshStandardMaterial({ color: c3(R.colour), roughness: R.roughness });
}
