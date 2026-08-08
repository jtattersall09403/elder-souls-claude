// THE PRE-W1-CROSSING PARAPET, verbatim from game/src/world/field.js at commit 345dcca, turned
// into a function expression so the delete-the-fix arm can install it on the live field object.
// `clamp` is inlined because the method borrowed it from the module scope.
function (px, pz, x, z) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    if (!this.roadGrid) return null;
    // Both buckets. A body pressed against the parapet sits within 0.35 m of the deck edge, and
    // that point can fall in the NEIGHBOURING 120 m grid cell from the one the span segment was
    // registered in — at which point the lookup came back empty, the parapet vanished and the
    // walker leaked off the side of a 40 m viaduct after 1.75 s of pushing.
    const a = this.roadGrid.at(px, pz), b = this.roadGrid.at(x, z);
    const segs = a === b ? a : a.concat(b);
    // ---- THE 0.15 m HOLE, and why this is a two-pass search now ------------------------------
    //
    // Round 3 reported a parapet that "holds in a direct test but leaks after ~3.5 m of sustained
    // sideways push", refused to claim a railing it had not proved, and could not find the cause.
    // `tools/world/parapet-probe.mjs` reproduces it: hold the stick perpendicular to the deck at
    // the midpoint of every declared span and ten of twenty-eight pushes walk clean off, reaching
    // 46 m from the centreline and dropping 3.3 m onto the valley side.
    //
    // The cause is an arithmetic mismatch between two widths. The parapet stands at `hw + 0.35`.
    // The bail-out below it — "two spans can overlap where the road doubles back, so clamp only
    // when the destination is on no deck at all" — asked `_deckY`, whose sampling footprint is
    // `hw + 0.5`. Between those two numbers is a 0.15 m annulus in which the destination is
    // simultaneously OUTSIDE the parapet and INSIDE `_deckY`, so the function returned null and
    // clamped nothing; and once the body is past `hw + 0.5`, the `d0 > hw + 0.5` test at the top
    // says it "was not on this deck" and the parapet is gone for good. At a 0.055 m step it takes
    // three frames to walk through the hole, which is why a direct test passes and a sustained
    // push does not: the direct test lands in the annulus and stops, the sustained one crosses it.
    //
    // The exemption itself is right — stepping from one span onto an overlapping other one is not
    // stepping off a bridge — but it has to mean "the destination is on the WALKABLE surface of a
    // DIFFERENT segment", not "some span's sampling footprint contains it". So: find the segment
    // the body was actually on (the nearest one, not the first in bucket order), and let it go
    // only if some OTHER segment's own parapet limit contains the destination.
    let best = null, bestD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.span) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const len2 = dx * dx + dz * dz || 1;
      const t0 = ((px - s.ax) * dx + (pz - s.az) * dz) / len2;
      // A TOLERANCE, not a hard bound. A deck is a chain of 12 m segments and the body spends
      // every twelfth metre standing exactly on a joint, where t lands a hair either side of 0 or
      // 1 on BOTH adjoining segments — so a hard bound skipped both and the parapet had a 0.03 m
      // hole in it once per segment.
      if (t0 < -0.02 || t0 > 1.02) continue;
      const d0 = Math.hypot(px - (s.ax + dx * t0), pz - (s.az + dz * t0));
      if (d0 > s.hw + 0.5) continue;                      // was not on this deck
      if (d0 < bestD) { bestD = d0; best = { s, dx, dz, len2 }; }
    }
    if (!best) return null;
    const { s, dx, dz, len2 } = best;
    const t1 = ((x - s.ax) * dx + (z - s.az) * dz) / len2;
    // Off an END is the abutment, and the road continues there — but only if no other segment of
    // the chain carries on. `t1` outside the tolerance means the next segment owns the point, and
    // THAT segment will be `best` on the following frame, so letting go here is correct.
    if (t1 < -0.05 || t1 > 1.05) return null;
    const tc = clamp(t1, 0, 1);
    const cx = s.ax + dx * tc, cz = s.az + dz * tc;
    const d1 = Math.hypot(x - cx, z - cz);
    const lim = s.hw + 0.35;
    if (d1 <= lim || d1 < 1e-6) return null;
    // The genuine overlap case: a DIFFERENT span segment whose own deck surface — not its sampling
    // footprint — contains the destination.
    for (let i = 0; i < segs.length; i++) {
      const o = segs[i];
      if (!o.span || o === s) continue;
      const ox = o.bx - o.ax, oz = o.bz - o.az;
      const ol2 = ox * ox + oz * oz || 1;
      const ot = clamp(((x - o.ax) * ox + (z - o.az) * oz) / ol2, 0, 1);
      if (Math.hypot(x - (o.ax + ox * ot), z - (o.az + oz * ot)) <= o.hw + 0.35) return null;
    }
    return [cx + (x - cx) / d1 * lim, cz + (z - cz) / d1 * lim];
  }
