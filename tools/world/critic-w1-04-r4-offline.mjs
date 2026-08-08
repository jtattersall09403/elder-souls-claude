#!/usr/bin/env node
/*
 * CRITIC W1-04 r4 — the offline arm. Bare Node, no browser.
 *
 * The round claims the join costs 41 rooms some of their declared area and says that is "the
 * town plan's conflict made visible". The dispatch asks whether that cost is acceptable, and
 * names three things to check specifically: props outside the room, a unique item in a wall, an
 * NPC post out of reach. This measures all three off the BUILT trees rather than off the data,
 * and adds a fourth the round does not mention.
 *
 * SECTIONS
 *   C1  reproduce the join independently (do not take the builder's 41 / 0-of-112 on trust)
 *   C2  build every shrunk room and ask whether every mesh in it is inside the room's own walls
 *   C3  the authored `lights[]` — the one placement in `buildInterior()` that is NOT derived
 *       from `bounds_m` but taken verbatim from the record
 *   C4  the NPC anchor rule (`sim/npc.js#anchorFor`) against the joined bounds
 *   C5  the geometry signature's algebra, offline: degenerate inputs it must survive
 *
 * Exits non-zero if any section finds a defect, so it can be re-run as a check.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/critic-w1-04-r4');
fs.mkdirSync(OUT, { recursive: true });

// --- the same bare-Node three shim the builder's tool uses ---------------------------------------
const THREE = await import(path.join(ROOT, 'game/vendor/three/three.module.js'));
const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));

function loadData() {
  const S = {}, I = {};
  const sdir = path.join(ROOT, 'game/data/world/settlements');
  for (const f of fs.readdirSync(sdir)) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8')); if (d.id) S[d.id] = d; }
  const idir = path.join(ROOT, 'game/data/world/interiors');
  for (const f of fs.readdirSync(idir)) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(idir, f), 'utf8')); if (d.id) I[d.id] = d; }
  return { S, I };
}

const out = { tool: 'tools/world/critic-w1-04-r4-offline.mjs', when: new Date().toISOString(), commit: process.env.W1_04_COMMIT || null, sections: {}, findings: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'offline.json'), JSON.stringify(out, null, 2));

const { S, I } = loadData();
const plans = Object.values(S).map((d) => EX.planSettlement(d, I));

// ==================================================================================================
// C1 — the join, reproduced. Do not take 41 / 0-of-112 on trust.
// ==================================================================================================
{
  // BEFORE: every record still at its declared bounds.
  const before = [];
  for (const p of plans) for (const b of p.buildings) {
    if (!b.enterable || !b.interior) continue;
    const rec = I[b.interior]; if (!rec || !rec.bounds_m) continue;
    const W = rec.bounds_m.x[1] - rec.bounds_m.x[0], D = rec.bounds_m.z[1] - rec.bounds_m.z[0];
    before.push({ id: b.id, interior: b.interior, drawn: b.drawn_footprint_m, room: [+W.toFixed(2), +D.toFixed(2)], ratio: +((b.drawn_footprint_m[0] * b.drawn_footprint_m[1]) / (W * D)).toFixed(4) });
  }
  const rep = EX.applyInteriorBounds(plans, I);
  const after = [];
  for (const p of plans) for (const b of p.buildings) {
    if (!b.enterable || !b.interior) continue;
    const rec = I[b.interior]; if (!rec || !rec.bounds_m) continue;
    const W = rec.bounds_m.x[1] - rec.bounds_m.x[0], D = rec.bounds_m.z[1] - rec.bounds_m.z[0];
    after.push({ id: b.id, interior: b.interior, drawn: b.drawn_footprint_m, room: [+W.toFixed(2), +D.toFixed(2)], ratio: +((b.drawn_footprint_m[0] * b.drawn_footprint_m[1]) / (W * D)).toFixed(4), fits: b.drawn_footprint_m[0] + 1e-6 >= W && b.drawn_footprint_m[1] + 1e-6 >= D });
  }
  out.sections.C1 = {
    enterable: after.length,
    before_ratio_lt_1: before.filter((r) => r.ratio < 1).length,
    before_worst: before.slice().sort((a, b) => a.ratio - b.ratio)[0],
    after_ratio_lt_1: after.filter((r) => r.ratio < 1).length,
    after_worst_ratio: Math.min(...after.map((r) => r.ratio)),
    after_not_fitting: after.filter((r) => !r.fits).length,
    join_report: { rooms: rep.rooms, limited: rep.rooms_limited_by_the_plan, at_declared_less_walls: rep.rooms_at_declared_bounds_less_walls, spawns_moved: rep.spawns_moved, worst: rep.worst },
    limited_ids: rep.limited.map((l) => ({ id: l.id, area_kept: l.area_kept, declared_m: l.declared_m, room_m: l.room_m })),
  };
  console.log(`C1  enterable=${after.length}  before ratio<1: ${out.sections.C1.before_ratio_lt_1}  after: ${out.sections.C1.after_ratio_lt_1}  worst after ${out.sections.C1.after_worst_ratio}`);
  console.log(`C1  join: ${rep.rooms_limited_by_the_plan} rooms limited by the plan, worst ${rep.worst && rep.worst.id} keeping ${rep.worst && rep.worst.area_kept}`);
}
save();

// ==================================================================================================
// C2 / C3 — build every room and ask what is outside its own walls.
// ==================================================================================================
{
  const limited = new Map(out.sections.C1.limited_ids.map((l) => [l.id, l]));
  const rows = [];
  const P = IN.interiorPalette ? IN.interiorPalette() : null;
  for (const [id, rec] of Object.entries(I)) {
    if (!rec.bounds_m) continue;
    const bx = rec.bounds_m.x, bz = rec.bounds_m.z;
    const W = bx[1] - bx[0], D = bz[1] - bz[0];
    // --- C3: authored lights, taken verbatim by BOTH buildInterior() and the detection model.
    const seen = new Set(); const lampsOut = []; let lampsUnique = 0;
    for (const L of rec.lights || []) {
      const q = L.pos || [0, 1.4, 0];
      const key = `${Math.round(q[0] * 10)},${Math.round(q[1] * 10)},${Math.round(q[2] * 10)}`;
      if (seen.has(key)) continue; seen.add(key); lampsUnique++;
      // "outside the room" = outside the inner face of the wall. Walls are drawn ON the bounds,
      // so a lamp at |x| > W/2 is in or through the masonry.
      if (q[0] < bx[0] || q[0] > bx[1] || q[2] < bz[0] || q[2] > bz[1]) lampsOut.push({ id: L.id || L.kind, pos: q, kind: L.kind, snuffable: !!L.snuffable, intensity: L.intensity });
    }
    // --- C2: build the room and measure every mesh against the shell.
    let summary = null, meshesOut = 0, worstOut = 0, meshCount = 0, uniqueOut = false;
    try {
      // buildInterior(root, rec) — the ROOT IS THE FIRST ARGUMENT and the return value is a
      // summary, not the tree. My first version called `buildInterior(rec)`, which returned
      // `{error: 'no record'}` and built nothing: the whole census read 0 meshes in 115 of 115
      // rooms and "0 props outside their walls" was vacuous. RULES.md rule 4 caught it; the
      // assertion at the end of this block is what stops it coming back.
      const grp = new THREE.Group();
      summary = IN.buildInterior(grp, rec);
      if (grp) {
        grp.updateMatrixWorld(true);
        const bb = new THREE.Box3();
        grp.traverse((m) => {
          if (!m.isMesh || !m.geometry) return;
          meshCount++;
          bb.setFromObject(m);
          // slack: the wall itself has thickness and the roof beams overhang by design.
          const ox = Math.max(bx[0] - bb.min.x, bb.max.x - bx[1]);
          const oz = Math.max(bz[0] - bb.min.z, bb.max.z - bz[1]);
          const o = Math.max(ox, oz);
          if (o > 0.6) { meshesOut++; if (o > worstOut) worstOut = o; if (/^unique:/.test(m.name) || (m.parent && /^unique:/.test(m.parent.name || ''))) uniqueOut = true; }
        });
      }
    } catch (e) { rows.push({ id, build_error: String(e).slice(0, 200) }); continue; }
    rows.push({
      id, limited: limited.has(id), area_kept: limited.has(id) ? limited.get(id).area_kept : 1,
      room_m: [+W.toFixed(2), +D.toFixed(2)],
      lamps_unique: lampsUnique, lamps_outside_the_room: lampsOut.length, lamps: lampsOut.slice(0, 4),
      meshes: meshCount, declared_meshes: summary ? summary.meshes : null,
      meshes_outside_by_gt_0_6m: meshesOut, worst_overhang_m: +worstOut.toFixed(2), unique_item_outside: uniqueOut,
    });
  }
  // RULE 4, AGAINST MYSELF. A census that traversed nothing reports "0 outside" and looks clean.
  const emptyRooms = rows.filter((r) => !r.build_error && !(r.meshes > 0)).length;
  if (emptyRooms) { out.findings.push(`C2: MY OWN PROBE IS VACUOUS — ${emptyRooms} of ${rows.length} rooms traversed 0 meshes.`); }
  const lim = rows.filter((r) => r.limited);
  const unl = rows.filter((r) => !r.limited && !r.build_error);
  const sum = (a, f) => a.reduce((s, r) => s + (f(r) || 0), 0);
  out.sections.C2_C3 = {
    records: rows.length,
    build_errors: rows.filter((r) => r.build_error).length,
    limited_rooms: lim.length,
    lamps_outside_total: sum(rows, (r) => r.lamps_outside_the_room),
    lamps_outside_in_limited_rooms: sum(lim, (r) => r.lamps_outside_the_room),
    lamps_outside_in_unlimited_rooms: sum(unl, (r) => r.lamps_outside_the_room),
    rooms_with_a_lamp_outside: rows.filter((r) => r.lamps_outside_the_room > 0).length,
    limited_rooms_with_a_lamp_outside: lim.filter((r) => r.lamps_outside_the_room > 0).length,
    meshes_outside_total: sum(rows, (r) => r.meshes_outside_by_gt_0_6m),
    rooms_with_a_mesh_outside: rows.filter((r) => r.meshes_outside_by_gt_0_6m > 0).length,
    unique_item_outside_count: rows.filter((r) => r.unique_item_outside).length,
    worst_lamp_rooms: rows.filter((r) => r.lamps_outside_the_room > 0).sort((a, b) => b.lamps_outside_the_room - a.lamps_outside_the_room).slice(0, 12),
    rows,
  };
  const s = out.sections.C2_C3;
  console.log(`C2  ${s.records} rooms built, ${s.build_errors} build errors; meshes outside their own walls by >0.6 m: ${s.meshes_outside_total} in ${s.rooms_with_a_mesh_outside} rooms; unique item outside in ${s.unique_item_outside_count}`);
  console.log(`C3  authored lamps outside their own room: ${s.lamps_outside_total} in ${s.rooms_with_a_lamp_outside} rooms (${s.lamps_outside_in_limited_rooms} of them in the ${s.limited_rooms} rooms the join shrank, ${s.lamps_outside_in_unlimited_rooms} in rooms it did not)`);
  if (s.lamps_outside_in_limited_rooms > 0) out.findings.push(`C3: ${s.lamps_outside_in_limited_rooms} authored lamps in the ${s.limited_rooms} shrunk rooms are now outside their own walls — buildInterior() places lamps at the record's verbatim pos and the join does not clamp them, and sim/stealth/system.js#syncInteriorLights() adds a detection light source at the same verbatim pos.`);
  if (s.meshes_outside_total > 0) out.findings.push(`C2: ${s.meshes_outside_total} meshes in ${s.rooms_with_a_mesh_outside} rooms stand more than 0.6 m outside their own room's bounds.`);
}
save();

// ==================================================================================================
// C4 — the NPC anchor rule, against the joined bounds.
// ==================================================================================================
{
  // sim/npc.js#anchorFor: interior anchors are derived from `d.bounds_m` and inset 1.2 m. The join
  // mutates the SAME record objects, so anchors should follow. Verify the inset survives the
  // smallest room the join produced (a 1.2 m inset on a 2.0 m room is a negative half-extent).
  const src = fs.readFileSync(path.join(ROOT, 'game/src/sim/npc.js'), 'utf8');
  const m = src.match(/function anchorFor\(sim, n, at, activity\)[\s\S]{0,1800}?\n}/);
  const body = m ? m[0] : '';
  const insetM = (body.match(/1\.2/g) || []).length ? 1.2 : null;
  const rooms = [];
  for (const [id, rec] of Object.entries(I)) {
    if (!rec.bounds_m) continue;
    const W = rec.bounds_m.x[1] - rec.bounds_m.x[0], D = rec.bounds_m.z[1] - rec.bounds_m.z[0];
    rooms.push({ id, W: +W.toFixed(2), D: +D.toFixed(2), inset_collapses: insetM !== null && (W / 2 - insetM <= 0 || D / 2 - insetM <= 0) });
  }
  const bad = rooms.filter((r) => r.inset_collapses);
  const smallest = rooms.slice().sort((a, b) => Math.min(a.W, a.D) - Math.min(b.W, b.D))[0];
  out.sections.C4 = {
    reads_bounds_m: /bounds_m/.test(body), inset_m: insetM,
    smallest_room_after_join: smallest,
    rooms_where_the_1_2m_inset_collapses: bad.length, examples: bad.slice(0, 8),
    note: 'anchorFor() derives interior anchors from d.bounds_m, and applyInteriorBounds() mutates the same record objects, so NPC posts inside a shrunk room follow the shrink. The failure mode to look for is not "out of reach" but an inset larger than the half-extent.',
  };
  console.log(`C4  anchorFor reads bounds_m=${out.sections.C4.reads_bounds_m}, inset ${insetM} m; smallest joined room ${smallest.W}x${smallest.D} m; inset collapses in ${bad.length} rooms`);
  if (bad.length) out.findings.push(`C4: the 1.2 m NPC anchor inset exceeds the half-extent in ${bad.length} joined rooms.`);
}
save();

// ==================================================================================================
// C5 — the geometry signature's algebra, offline. Degenerate inputs it MUST survive.
// ==================================================================================================
{
  // Re-implement the shipped fold EXACTLY as api.js#getDrawnSignature does, over an arbitrary
  // root, so the degenerate cases can be built by hand without a browser.
  const fold = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  function sig(root) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const keys = [];
    root.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry, p = g.parameters || {};
      const par = Object.keys(p).sort().map((k) => `${k}=${typeof p[k] === 'number' ? p[k].toFixed(3) : p[k]}`).join(',');
      const col = m.material && m.material.color ? m.material.color.getHexString() : '-';
      const rel = inv.clone().multiply(m.matrixWorld);
      const mx = Array.from(rel.elements).map((n) => n.toFixed(3)).join(',');
      keys.push(`${g.type || '?'}|${par}|${col}|${mx}|${(m.name || '').replace(/[0-9]+$/, '')}`);
    });
    keys.sort();
    return { hash: fold(keys.join('\n')), meshes: keys.length };
  }
  const mk = () => {
    const r = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshStandardMaterial({ color: 0x445566 }));
    m.name = 'wall7'; m.position.set(1, 0, 2); r.add(m);
    const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 8), new THREE.MeshStandardMaterial({ color: 0x998877 }));
    m2.name = 'prop:barrel3'; m2.position.set(-1, 0, 0); r.add(m2);
    return r;
  };
  const t = {};
  t.empty_group = sig(new THREE.Group());
  const a = mk(), b = mk();
  t.same_content_twice = { a: sig(a).hash, b: sig(b).hash, equal: sig(a).hash === sig(b).hash };
  // MOVE THE WHOLE ROOT: relative transform means the signature must not change.
  const c = mk(); c.position.set(4000, 3, -900); c.rotation.y = 1.1;
  t.root_moved = { equal: sig(c).hash === sig(a).hash };
  // REORDER THE CHILDREN: the keys are sorted, so a permutation must not change the hash.
  const d = mk(); d.children.reverse();
  t.children_reordered = { equal: sig(d).hash === sig(a).hash };
  // HIDE A MESH: Object3D.traverse() visits invisible children. Does the signature see it?
  const e = mk(); e.children[1].visible = false;
  t.mesh_hidden = { equal: sig(e).hash === sig(a).hash, meshes: sig(e).meshes, note: 'if equal, the signature counts meshes that are visible:false' };
  // REMOVE A MESH: must change.
  const f = mk(); f.remove(f.children[1]);
  t.mesh_removed = { equal: sig(f).hash === sig(a).hash, meshes: sig(f).meshes };
  // ONLY A LIGHT DIFFERS: lights are not meshes.
  const g2 = mk(); g2.add(new THREE.PointLight(0xff0000, 9, 20, 2));
  t.only_a_light_differs = { equal: sig(g2).hash === sig(a).hash, note: 'if equal, the signature is blind to lighting — conservative for a distinctness claim' };
  // ONLY A MATERIAL PROPERTY (not colour) DIFFERS.
  const h2 = mk(); h2.children[0].material = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.05, metalness: 0.9 });
  t.only_non_colour_material_differs = { equal: sig(h2).hash === sig(a).hash };
  // SUB-MILLIMETRE MOVE: toFixed(3) quantises.
  const i2 = mk(); i2.children[0].position.x += 0.0004;
  t.sub_mm_move = { equal: sig(i2).hash === sig(a).hash };
  // 1 CM MOVE: must change.
  const j2 = mk(); j2.children[0].position.x += 0.01;
  t.one_cm_move = { equal: sig(j2).hash === sig(a).hash };
  // TRAILING DIGITS IN THE NAME ARE STRIPPED — two differently-numbered instances collide.
  const k2 = mk(); k2.children[0].name = 'wall99';
  t.instance_number_only = { equal: sig(k2).hash === sig(a).hash, note: 'names are stripped of trailing digits by design' };
  // A NAME CHANGE THAT IS NOT A NUMBER: must change.
  const l2 = mk(); l2.children[0].name = 'roof';
  t.name_changed = { equal: sig(l2).hash === sig(a).hash };

  out.sections.C5_signature_algebra = t;
  const musts = [
    ['same content twice = 1', t.same_content_twice.equal === true],
    ['root moved = 1 (relative transform)', t.root_moved.equal === true],
    ['children reordered = 1 (sorted keys)', t.children_reordered.equal === true],
    ['a mesh removed changes it', t.mesh_removed.equal === false],
    ['a 1 cm move changes it', t.one_cm_move.equal === false],
    ['a non-numeric name change changes it', t.name_changed.equal === false],
  ];
  for (const [n, ok] of musts) if (!ok) out.findings.push(`C5: the signature fails a floor it must pass — ${n}`);
  console.log('C5  signature algebra:', JSON.stringify(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.equal === undefined ? v.meshes : v.equal]))));
  if (t.mesh_hidden.equal) console.log('C5  NOTE: a mesh with visible=false is still counted — the verb hashes every mesh under a visible CELL, not the visible meshes.');
  if (t.only_a_light_differs.equal) console.log('C5  NOTE: two rooms differing only in a light are one signature — the measure is geometry-only.');
}
save();

console.log(`\nwrote ${path.relative(ROOT, path.join(OUT, 'offline.json'))}  findings=${out.findings.length}`);
for (const f of out.findings) console.log('  - ' + f);
process.exit(out.findings.length ? 1 : 0);
