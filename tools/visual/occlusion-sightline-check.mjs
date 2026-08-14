#!/usr/bin/env node
/**
 * occlusion-sightline-check.mjs — can a tree still bury the player?
 *
 * The first-ten-minutes critic photographed the player rendering at ZERO pixels behind a tree ten
 * seconds from spawn, on real GPU hardware, while the collision arm reported `arm_len 3.993 m,
 * arm_hit false` — because a tree is not a collider and never was. The prescribed remedy at the
 * time was deck undersides in `settlementSolids()`; the frames say the occluder is vegetation, so
 * the remedy belongs in `world/province.js#updateOcclusion`.
 *
 * This exercises THE SHIPPED METHOD — `Province.prototype.updateOcclusion` called against a
 * synthetic scene — rather than a copy of its arithmetic. If someone guts the method, this goes
 * red; a check that re-implemented the test would not, and that is the failure shape the
 * consumption sweep found today (rename -> red, delete the call site -> GREEN, gut the body ->
 * GREEN, because a grep counts words and not behaviour).
 *
 * THE NULL CONTROL IS THE PLAUSIBLE WRONG ANSWER: "the old proximity bubble already covered the
 * sightline, so there was nothing to fix." Arm A places the tree exactly where it defeats a bubble
 * and defeats nothing else — origin 7 m from the camera, 2 m to the side of the camera-to-actor
 * line, with a 4 m crown that hangs right over it. The old test must say NOT HIDDEN and the new
 * one must say HIDDEN. If the old test hides it, the diagnosis is wrong and this file should say so.
 *
 * Arm C is the guard against the cheap way to pass: hiding everything. A tree 14 m away and well
 * off the line must remain visible under BOTH tests. A camera-occlusion fix that empties the forest
 * has not fixed anything, it has deleted the scenery.
 *
 * Usage: node tools/visual/occlusion-sightline-check.mjs
 * Exit codes: 0 all arms as specified, 1 an arm disagrees.
 */
import * as THREE from '../../game/vendor/three/three.module.js';
import { Province } from '../../game/src/world/province.js';

/** One canopy instance at (x, z) with a crown of `r` metres, registered the way the builder does. */
function scene(x, z, r) {
  const g = new THREE.Group();
  const im = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 1);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1),
  );
  im.setMatrixAt(0, m);
  // The real registration path, so the baked radius is produced by shipped code.
  Province.prototype._registerOccludable.call(null, im, [m], r);
  g.add(im);
  return { group: g, im };
}

/** Run the shipped method against a synthetic province with one tree. */
function hidden({ x, z, r, camera, player, sightline }) {
  const s = scene(x, z, r);
  const self = { group: s.group, occlusionSightline: sightline, _occlusionAt: null };
  Province.prototype.updateOcclusion.call(self, camera[0], camera[1], player[0], player[1]);
  return s.im.userData.w130Occlusion.hidden[0] === 1;
}

// The critic's geometry: camera 4 m behind the actor, which is what `arm_len 3.993 m` measured.
const camera = [0, 0], player = [0, 4];

const arms = [
  {
    name: 'A  the tree that defeats a bubble and drapes the line',
    // Origin 7.3 m from the camera and 2 m to the side: outside the 5.6 m camera disc, outside the
    // 2.7 m player disc, and its 4 m crown covers the sightline.
    tree: { x: 2, z: 7, r: 4 },
    expect_old: false, expect_new: true,
  },
  {
    name: 'B  a trunk squarely on the line and close in',
    tree: { x: 0, z: 2, r: 0.4 },
    expect_old: true, expect_new: true,   // the old bubble did catch this one; it must still.
  },
  {
    name: 'C  a tree well off the line stays in the world',
    tree: { x: 14, z: 14, r: 4 },
    expect_old: false, expect_new: false,
  },
];

let ok = true;
for (const a of arms) {
  const oldHide = hidden({ ...a.tree, camera, player, sightline: false });
  const newHide = hidden({ ...a.tree, camera, player, sightline: true });
  const pass = oldHide === a.expect_old && newHide === a.expect_new;
  ok = ok && pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${a.name}`);
  console.log(`        proximity-only: ${oldHide ? 'hidden' : 'VISIBLE'} (expected ${a.expect_old ? 'hidden' : 'VISIBLE'})`
    + `   with sightline: ${newHide ? 'hidden' : 'VISIBLE'} (expected ${a.expect_new ? 'hidden' : 'VISIBLE'})`);
}
console.log(`\n${ok
  ? 'the sightline test catches the tree the bubble let through, keeps everything the bubble caught, and does not empty the forest'
  : 'AN ARM DISAGREES — read the two lines above before trusting any occlusion claim'}`);
process.exit(ok ? 0 : 1);
