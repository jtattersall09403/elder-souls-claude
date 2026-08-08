// THE PARAPET AS IT STOOD AT THE END OF W1-CROSSING ROUND 1, verbatim from
// game/src/world/field.js at the commit this round started from, turned into a function
// expression so the delete-the-fix arm can install it on a live field object.
//
// This is NOT `old-clamp-345dcca.js`. That one is the parapet from BEFORE round 1 — a useful
// second control and the one round 1's own arms used, but not the thing round 2 changed. The
// teardown for round 2's change is this file: everything round 1 shipped, without the
// "the parapet may not stand between a body and its own road" exemption.
//
// `clamp` and `lerp` are inlined at the top of the body because the method borrowed them from the
// module scope, and this file is eval'd as a bare function expression with no module around it.
  function (px, pz, x, z) {
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    if (!this.roadGrid) return null;
    // Both buckets. A body pressed against the parapet sits within 0.35 m of the deck edge, and
    // that point can fall in the NEIGHBOURING 120 m grid cell from the one the span segment was
    // registered in — at which point the lookup came back empty, the parapet vanished and the
    // walker leaked off the side of a 40 m viaduct after 1.75 s of pushing.
    const a = this.roadGrid.at(px, pz), b = this.roadGrid.at(x, z);
    const segs = a === b ? a : a.concat(b);
    // ---- WHY THIS IS A DISTANCE TEST AND NOT A PROJECTION-PARAMETER TEST ----------------------
    //
    // Round 3 found a parapet that leaked after a sustained push and could not say why; round 4
    // found a 0.15 m annulus between the parapet's `hw + 0.35` and `_deckY`'s `hw + 0.5` and closed
    // it. W1-CROSSING measured what was left with `tools/world/road-grade.mjs`: **286 of 3,632
    // sideways pushes still walked off a bridge deck**, and they were not spread over the decks —
    // they clustered at the ENDS of every span chain and on the earth approach within 3.5 m of one.
    //
    // The cause was that "off the end" was inferred from `t`, the projection parameter, on a
    // SINGLE segment. Near a chain's terminal vertex the body's `t` on the terminal segment falls
    // outside [0, 1] for a push that is purely sideways, so a body walking around the corner of
    // the end cap was read as a body walking off the abutment and let go — into 4.7 m of air with
    // no way back up. And a body standing on the earth in front of an abutment IS on the deck as
    // far as `heightAt`/`onDeckAt` are concerned (`_deckY` samples to `hw + 0.5` past the end
    // vertex), so it was standing on a slab with no railing at all.
    //
    // So the question is asked of the STRUCTURE, not of a segment, and it is asked as a distance:
    //   1. was the body on some span's walkable surface?          (nearest CLAMPED distance)
    //   2. is the destination still on one?                       (same measure, same limit)
    //   3. if not, is it beyond a chain END and still within the parapet's width ACROSS the chain?
    //      That is the abutment, and the road continues there.
    //   4. otherwise it is going over the side. Put it back against the railing.
    // Steps 2 and 4 use the same `lim`, so there is no width for an annulus to hide in.
    const near = (s, qx, qz) => {
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const len2 = dx * dx + dz * dz || 1;
      const t = ((qx - s.ax) * dx + (qz - s.az) * dz) / len2;
      const tc = clamp(t, 0, 1);
      const cx = s.ax + dx * tc, cz = s.az + dz * tc;
      return { t, cx, cz, d: Math.hypot(qx - cx, qz - cz) };
    };
    let onSeg = null, onD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.span) continue;
      const n = near(s, px, pz);
      if (n.d < onD) { onD = n.d; onSeg = s; }
    }
    if (!onSeg || onD > onSeg.hw + 0.5) return null;      // was not on a deck at all
    const lim = onSeg.hw + 0.35;
    let toSeg = null, toN = null, toD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s.span) continue;
      const n = near(s, x, z);
      if (n.d < toD) { toD = n.d; toSeg = s; toN = n; }
    }
    if (toD <= lim || toD < 1e-6) return null;            // still on the structure
    // Off an END. The perpendicular distance from the terminal segment's INFINITE line is the
    // "across the chain" measure; inside the railing's width, walking past the last vertex is
    // walking onto the abutment, which is the way off a bridge.
    if ((toSeg.spanFirst && toN.t <= 0) || (toSeg.spanLast && toN.t >= 1)) {
      const dx = toSeg.bx - toSeg.ax, dz = toSeg.bz - toSeg.az;
      const L = Math.hypot(dx, dz) || 1;
      const across = Math.abs((x - toSeg.ax) * (-dz / L) + (z - toSeg.az) * (dx / L));
      if (across <= lim) return null;
    }
    return [toN.cx + (x - toN.cx) / toD * lim, toN.cz + (z - toN.cz) / toD * lim];
  }
