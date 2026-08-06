// The renderable province: 4,825 x 5,540 m of Argonia, streamed.
//
// Three layers, and the split is what makes a 27 km2 world drawable at all on a software
// rasteriser: a single coarse mesh of the WHOLE province so the Valus Ridge is on the horizon
// from Helstrom; a ring of detailed tiles around the player, built on a budget so a region
// border is not a hitch (RI-PLT03); and per-tile instanced flora whose species, silhouette,
// height, colour and density come from `regions.json` (RI-WLD04's nine axes, three of which are
// here and not in a fog colour).
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { noise2, clamp, smoothstep, lerp } from './noise.js';
import { SIGNATURE_KINDS } from './signature.js';
import { signatureGeometry, signatureMaterials } from './signature-geo.js';

const TILE_M = 300;
const TILE_SEG = 40;              // 7.5 m per quad
const WATER_SEG = 24;
const RADIUS = 2;                 // 5 x 5 tiles resident => 1.5 km of detailed ground
const FAR_SEG_X = 96, FAR_SEG_Z = 110;
const MAX_INSTANCES = { canopy: 700, under: 2600, rock: 420 };

const c3 = (hex) => new THREE.Color(hex);

export class Province {
  /** @param {import('./field.js').WorldField} field */
  constructor(field) {
    this.field = field;
    this.group = new THREE.Group();
    this.group.name = 'province';
    this.tiles = new Map();
    this.queue = [];
    this.built = 0;
    this.focus = [0, 0];

    this.mats = {
      ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.0 }),
      far: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0.0 }),
      farWater: new THREE.MeshStandardMaterial({ color: 0x33454a, roughness: 0.14, metalness: 0.45, transparent: true, opacity: 0.92 }),
    };
    this.regionMats = field.regions.map((r) => ({
      water: new THREE.MeshStandardMaterial({
        color: c3(r.palette_hex[0]).lerp(c3(r.fog.colour), 0.30),
        roughness: clamp(0.06 + (r.water.k || 1) * 0.03, 0.05, 0.28),
        metalness: 0.42, transparent: true,
        opacity: clamp(0.62 + (r.water.k || 1) * 0.08, 0.6, 0.96),
      }),
      trunk: new THREE.MeshStandardMaterial({ color: c3(r.props.canopy.trunk), roughness: 0.95 }),
      crown: new THREE.MeshStandardMaterial({ color: c3(r.props.canopy.colour), roughness: 0.88 }),
      under: new THREE.MeshStandardMaterial({ color: c3(r.props.under.colour), roughness: 0.92, side: THREE.DoubleSide }),
      rock: new THREE.MeshStandardMaterial({ color: c3(r.props.rock.colour), roughness: 0.80 }),
    }));
    this.geoCache = new Map();

    this._buildFar();
  }

  // ---- the whole province, coarse ------------------------------------------------------------
  _buildFar() {
    const f = this.field;
    const geo = new THREE.PlaneGeometry(f.sizeX, f.sizeZ, FAR_SEG_X, FAR_SEG_Z);
    geo.rotateX(-Math.PI / 2);
    geo.translate(f.sizeX / 2, 0, f.sizeZ / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = clamp(pos.getX(i), 0, f.sizeX - 0.01), z = clamp(pos.getZ(i), 0, f.sizeZ - 0.01);
      const h = f.baseAt(x, z);
      pos.setY(i, h - 0.6);
      this._groundColour(x, z, h, tmp);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mats.far);
    mesh.name = 'province-far';
    mesh.receiveShadow = false;
    this.group.add(mesh);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(f.sizeX + 2400, f.sizeZ + 2400, 1, 1).rotateX(-Math.PI / 2), this.mats.farWater);
    sea.position.set(f.sizeX / 2, 0, f.sizeZ / 2);
    sea.name = 'province-sea';
    this.group.add(sea);
    this.farMesh = mesh;
    this.seaMesh = sea;
  }

  /**
   * Ground albedo at a point. Region material first, then the two things that must modulate it or
   * the terrain reads as a painted LUT: wetness under standing water, and rock exposed by slope.
   */
  _groundColour(x, z, h, out) {
    const f = this.field;
    const r = f.regions[f.regionIndexAt(x, z)];
    out.set(r.ground.albedo);
    const mottle = (noise2(x / 21, z / 21, 4111) - 0.5) * 0.16 + (noise2(x / 5.5, z / 5.5, 4127) - 0.5) * 0.08;
    out.offsetHSL(0, 0, mottle);
    const d = f.depthAt(x, z);
    if (d > 0) out.lerp(c3(r.palette_hex[0]).multiplyScalar(0.42), clamp(0.30 + d * 0.55, 0, 0.88));
    return out;
  }

  // ---- streaming ------------------------------------------------------------------------------
  key(tx, tz) { return `${tx},${tz}`; }

  /** Ask for the tiles around (x, z); returns the number still queued. */
  request(x, z) {
    this.focus = [x, z];
    const tx0 = Math.floor(x / TILE_M), tz0 = Math.floor(z / TILE_M);
    const want = new Set();
    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const tx = tx0 + dx, tz = tz0 + dz;
        if (tx < 0 || tz < 0 || tx * TILE_M >= this.field.sizeX || tz * TILE_M >= this.field.sizeZ) continue;
        want.add(this.key(tx, tz));
        if (!this.tiles.has(this.key(tx, tz)) && !this.queue.some((q) => q.k === this.key(tx, tz))) {
          this.queue.push({ k: this.key(tx, tz), tx, tz, d: dx * dx + dz * dz });
        }
      }
    }
    this.queue.sort((a, b) => a.d - b.d);
    for (const [k, t] of this.tiles) {
      if (!want.has(k)) { this._release(k, t); }
    }
    this.queue = this.queue.filter((q) => want.has(q.k));
    return this.queue.length;
  }

  /** Build at most `budget` queued tiles. Returns how many were built. */
  pump(budget = 2) {
    let n = 0;
    while (n < budget && this.queue.length) {
      const q = this.queue.shift();
      if (this.tiles.has(q.k)) continue;
      this.tiles.set(q.k, this._buildTile(q.tx, q.tz));
      this.built++; n++;
    }
    return n;
  }

  /** Build every queued tile — used by the harness so a screenshot is never of a half-built world. */
  drain(limit = 400) { let n = 0; while (this.queue.length && n < limit) n += this.pump(4); return n; }

  update(x, z, budget = 2) { this.request(x, z); return this.pump(budget); }

  _release(k, t) {
    this.group.remove(t.group);
    t.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.tiles.delete(k);
  }

  _buildTile(tx, tz) {
    const f = this.field;
    const g = new THREE.Group();
    g.name = `tile:${tx},${tz}`;
    const ox = tx * TILE_M, oz = tz * TILE_M;

    // ---- ground ------------------------------------------------------------------------------
    const geo = new THREE.PlaneGeometry(TILE_M, TILE_M, TILE_SEG, TILE_SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(ox + TILE_M / 2, 0, oz + TILE_M / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = f.heightAt(x, z);
      pos.setY(i, h);
      this._groundColour(x, z, h, tmp);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, this.mats.ground);
    ground.receiveShadow = true;
    ground.name = 'ground';
    g.add(ground);

    // ---- water -------------------------------------------------------------------------------
    // One water mesh per region present in the tile, because Topal and the Padomaic and a
    // tannin-black channel are not one material with three names (RI-WLD10 §9/§10).
    const byRegion = new Map();
    const step = TILE_M / WATER_SEG;
    for (let iz = 0; iz < WATER_SEG; iz++) {
      for (let ix = 0; ix < WATER_SEG; ix++) {
        const x0 = ox + ix * step, z0 = oz + iz * step;
        const corners = [[x0, z0], [x0 + step, z0], [x0 + step, z0 + step], [x0, z0 + step]];
        const surf = corners.map(([cx, cz]) => f.waterSurfaceAt(cx, cz));
        if (surf.some((s) => s === null)) continue;
        const ri = f.regionIndexAt(x0 + step / 2, z0 + step / 2);
        if (!byRegion.has(ri)) byRegion.set(ri, { v: [], i: [], n: 0 });
        const b = byRegion.get(ri);
        for (let k = 0; k < 4; k++) b.v.push(corners[k][0], surf[k], corners[k][1]);
        b.i.push(b.n, b.n + 2, b.n + 1, b.n, b.n + 3, b.n + 2);
        b.n += 4;
      }
    }
    for (const [ri, b] of byRegion) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(b.v, 3));
      wg.setIndex(b.i);
      wg.computeVertexNormals();
      const wm = new THREE.Mesh(wg, this.regionMats[ri].water);
      wm.name = `water:${f.regions[ri].id}`;
      g.add(wm);
    }

    // ---- flora and rock ----------------------------------------------------------------------
    this._scatter(g, ox, oz);
    // ---- the region's ONLY-HERE element ------------------------------------------------------
    this._signatures(g, ox, oz);

    this.group.add(g);
    return { group: g, tx, tz };
  }

  /**
   * The thirteen ONLY-HERE elements, in this tile. `RI-WLD04` M19.
   *
   * The landform half of seven of them is already in the ground mesh above, because
   * `field.heightAt()` evaluates `signature.profile()` — the crater is a hole in the terrain, not
   * a decal on it. What is added here is everything that is not ground, plus the night emission
   * six of them carry, which is M17 step 6's "a region that is only identifiable in clear daylight
   * is half-built" answered with light sources the region owns rather than with exposure.
   */
  _signatures(group, ox, oz) {
    const sig = this.field.sig;
    if (!sig) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const buckets = new Map();
    // Cover the tile plus the largest footprint, so a crater rim that reaches into this tile is
    // drawn with it rather than popping when the neighbouring tile streams in.
    const pad = 40;
    for (const it of sig.items) {
      if (it.x < ox - pad || it.x >= ox + TILE_M + pad || it.z < oz - pad || it.z >= oz + TILE_M + pad) continue;
      // One instance belongs to exactly one tile — the one containing its centre — so a feature
      // straddling a tile edge is not drawn twice.
      if (it.x < ox || it.x >= ox + TILE_M || it.z < oz || it.z >= oz + TILE_M) continue;
      const K = SIGNATURE_KINDS[it.kind];
      let b = buckets.get(it.kind);
      if (!b) { b = { kind: it.kind, xf: [] }; buckets.set(it.kind, b); }
      // The body stands on the ground the profile already raised, except the jelly, which floats.
      const gy = it.kind === 'swamp_jelly_canopy'
        ? (this.field.waterSurfaceAt(it.x, it.z) ?? this.field.heightAt(it.x, it.z)) + it.hover
        : this.field.heightAt(it.x, it.z);
      q.setFromAxisAngle(up, it.rot);
      v.set(it.x, gy, it.z);
      // Unit geometry is authored at height 1 and radius ~1, so one scale carries both.
      const sc = K.landform && it.kind !== 'root_arch' ? it.h : (K.r_base * it.s * 0.5);
      s.set(it.kind === 'petrified_bole' || it.kind === 'glassed_crater' ? K.r_base * it.s * 0.5 : sc,
        it.kind === 'petrified_bole' || it.kind === 'glassed_crater' ? K.r_base * it.s * 0.5 : it.h,
        it.kind === 'petrified_bole' || it.kind === 'glassed_crater' ? K.r_base * it.s * 0.5 : sc);
      if (it.kind === 'rock_flute_spire') s.set(K.r_base * it.s * 0.9, it.h, K.r_base * it.s * 0.9);
      if (it.kind === 'root_arch') s.setScalar(K.r_base * it.s * 0.62);
      if (it.kind === 'beached_hull_house') s.set(K.r_base * it.s, it.h, K.r_base * it.s);
      if (it.kind === 'comb_cliff') s.set(K.r_base * it.s, it.h, K.r_base * it.s);
      if (it.kind === 'naga_kiln_dome') s.set(K.r_base * it.s, it.h, K.r_base * it.s);
      m.compose(v, q, s);
      b.xf.push(m.clone());
    }
    for (const b of buckets.values()) {
      if (!b.xf.length) continue;
      const ri = this.field.regionIndexAt(b.xf[0].elements[12], b.xf[0].elements[14]);
      const geo = this._sigGeo(b.kind);
      const mat = this._sigMat(b.kind, ri);
      const im = new THREE.InstancedMesh(geo.body, mat.body, b.xf.length);
      for (let i = 0; i < b.xf.length; i++) im.setMatrixAt(i, b.xf[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      im.name = `signature:${b.kind}`;
      group.add(im);
      if (geo.glow && mat.glow) {
        const gm = new THREE.InstancedMesh(geo.glow, mat.glow, b.xf.length);
        for (let i = 0; i < b.xf.length; i++) gm.setMatrixAt(i, b.xf[i]);
        gm.instanceMatrix.needsUpdate = true;
        gm.name = `signature-glow:${b.kind}`;
        group.add(gm);
      }
    }
  }

  _sigGeo(kind) {
    const k = `sig:${kind}`;
    if (!this.geoCache.has(k)) this.geoCache.set(k, signatureGeometry(kind));
    return this.geoCache.get(k);
  }

  _sigMat(kind, ri) {
    this.sigMats = this.sigMats || new Map();
    if (!this.sigMats.has(kind)) this.sigMats.set(kind, signatureMaterials(kind, this.field.regions[ri]));
    return this.sigMats.get(kind);
  }

  _geo(kind, r) {
    const key = `${kind}:${r.id}`;
    if (this.geoCache.has(key)) return this.geoCache.get(key);
    const p = r.props;
    let geo;
    switch (kind) {
      case 'trunk': {
        const h = p.canopy.h;
        if (p.canopy.shape === 'arch') { geo = new THREE.TorusGeometry(p.canopy.r, 0.35, 6, 10, Math.PI); geo.rotateY(Math.PI / 2); }
        else { geo = new THREE.CylinderGeometry(p.canopy.r * 0.16, p.canopy.r * 0.34, h, 6, 1); geo.translate(0, h / 2, 0); }
        break;
      }
      case 'crown': {
        const h = p.canopy.h, rr = p.canopy.r;
        if (p.canopy.shape === 'cone') geo = new THREE.ConeGeometry(rr, h * 0.65, 7);
        else if (p.canopy.shape === 'sphere') geo = new THREE.IcosahedronGeometry(rr, 1);
        else if (p.canopy.shape === 'spire') geo = new THREE.ConeGeometry(rr * 0.55, h * 0.5, 5);
        else if (p.canopy.shape === 'dome') geo = new THREE.SphereGeometry(rr, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        else if (p.canopy.shape === 'column') geo = new THREE.CylinderGeometry(rr * 0.7, rr * 0.9, h * 0.4, 7);
        else geo = new THREE.IcosahedronGeometry(rr * 0.8, 0);
        break;
      }
      case 'under': {
        const h = p.under.h;
        if (p.under.shape === 'shelf' || p.under.shape === 'comb') { geo = new THREE.CylinderGeometry(0.7, 0.7, h, 6); geo.translate(0, h / 2, 0); }
        else if (p.under.shape === 'crust') { geo = new THREE.CircleGeometry(0.9, 6).rotateX(-Math.PI / 2); geo.translate(0, h, 0); }
        else if (p.under.shape === 'frond') { geo = new THREE.ConeGeometry(0.55, h, 4, 1, true); geo.translate(0, h / 2, 0); }
        else { geo = new THREE.PlaneGeometry(0.8, h); geo.translate(0, h / 2, 0); }
        break;
      }
      default: geo = new THREE.IcosahedronGeometry(1, 0);
    }
    this.geoCache.set(key, geo);
    return geo;
  }

  _scatter(group, ox, oz) {
    const f = this.field;
    const area = TILE_M * TILE_M / 100;      // in units of 100 m2
    const buckets = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    // One Poisson-ish jittered lattice per tile, sampled at the LOCAL region's density: the same
    // point set feeds every layer, so density is a per-region measurable and not a per-mesh mood.
    const N = 46;
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const jx = noise2(ix * 1.7 + ox, iz * 2.3 + oz, 7717);
        const jz = noise2(ix * 2.9 + ox, iz * 1.3 + oz, 7723);
        const x = ox + (ix + jx) * (TILE_M / N), z = oz + (iz + jz) * (TILE_M / N);
        if (!f.isLandAt(x, z)) continue;
        const ri = f.regionIndexAt(x, z);
        const r = f.regions[ri];
        const p = r.props;
        const y = f.heightAt(x, z);
        const depth = f.depthAt(x, z);
        const cellArea = area / (N * N) * 100;      // m2 per lattice cell
        const roll = noise2(x * 0.37, z * 0.37, 7741);
        const roll2 = noise2(x * 0.61, z * 0.61, 7757);
        const roll3 = noise2(x * 0.83, z * 0.83, 7761);
        const push = (kind, mat, geo, scale, yOff) => {
          let b = buckets.get(`${kind}:${ri}`);
          if (!b) { b = { kind, ri, mat, geo, xf: [] }; buckets.set(`${kind}:${ri}`, b); }
          if (b.xf.length >= MAX_INSTANCES[kind]) return;
          q.setFromAxisAngle(up, noise2(x, z, 7789) * Math.PI * 2);
          v.set(x, y + yOff, z); s.setScalar(scale);
          m.compose(v, q, s);
          b.xf.push(m.clone());
        };
        if (p.canopy.shape !== 'none' && depth < 0.9 && roll < p.canopy.per100m2 * cellArea / 100) {
          const sc = 0.72 + noise2(x * 3.1, z * 3.1, 7793) * 0.66;
          push('canopy', this.regionMats[ri].trunk, this._geo('trunk', r), sc, 0);
          const b = buckets.get(`crown:${ri}`) || (buckets.set(`crown:${ri}`, { kind: 'canopy', ri, mat: this.regionMats[ri].crown, geo: this._geo('crown', r), xf: [] }), buckets.get(`crown:${ri}`));
          if (b.xf.length < MAX_INSTANCES.canopy) {
            q.setFromAxisAngle(up, noise2(x, z, 7797) * Math.PI * 2);
            v.set(x, y + p.canopy.h * sc * (p.canopy.shape === 'arch' ? 0.5 : 0.86), z); s.setScalar(sc);
            m.compose(v, q, s); b.xf.push(m.clone());
          }
        }
        if (roll2 < p.under.per100m2 * cellArea / 100 && depth < 0.6) {
          push('under', this.regionMats[ri].under, this._geo('under', r), 0.7 + noise2(x * 5, z * 5, 7801) * 0.8, 0);
        }
        if (roll3 < p.rock.per100m2 * cellArea / 100) {
          push('rock', this.regionMats[ri].rock, this._geo('rock', r), p.rock.scale * (0.5 + noise2(x * 7, z * 7, 7817)), 0.1);
        }
      }
    }
    for (const b of buckets.values()) {
      if (!b.xf.length) continue;
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.xf.length);
      for (let i = 0; i < b.xf.length; i++) im.setMatrixAt(i, b.xf[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = b.kind !== 'under';
      im.receiveShadow = true;
      im.name = `${b.kind}:${this.field.regions[b.ri].id}`;
      im.frustumCulled = true;
      group.add(im);
    }
  }

  stats() {
    let instances = 0, meshes = 0;
    this.group.traverse((o) => { if (o.isInstancedMesh) { instances += o.count; meshes++; } else if (o.isMesh) meshes++; });
    return {
      tilesResident: this.tiles.size, tilesQueued: this.queue.length, tilesBuiltTotal: this.built,
      tileSizeM: TILE_M, residentRadiusTiles: RADIUS, meshes, instances,
    };
  }
}
