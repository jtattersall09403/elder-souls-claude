---
id: RI-CMB04
title: Hitboxes and hurtboxes — swept capsules, bone attachment, and the no-dice rule
kind: structure
side: souls
judges: [combat.hit.geometry, combat.hit.sweep, combat.hurtbox, combat.damage.resolution, combat.determinism, combat.frame.order]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Whether a blow lands is a **question about shapes in space at a moment in time**, and it has
exactly one answer. Not a probability, not a comparison of weapon skill against agility, not
a `Math.random()` anywhere in the call stack. The weapon carries a volume that exists for a
handful of frames; the target carries volumes bolted to its animated skeleton; if the first
sweeps through the second during those frames, damage happens. If it doesn't, it doesn't.

"Good" means the player can *aim* — can step 20 cm to the left and watch an ultra greatsword
pass in front of their nose, can walk around a spear thrust, can be clipped by the very tip
of a halberd at the edge of its arc and understand exactly why. It also means the reverse:
the player can never be hit by a weapon that visibly missed, and can never miss a weapon
that visibly connected. Every complaint about "phantom range" and "the hitbox went through
me" in the genre is a failure of this item, and we will produce those failures by default
unless the numbers below are met.

ARBITRATION seam **S1** is absolute here: Morrowind's to-hit roll is deleted. Weapon skill
affects scaling coefficients and out-of-fight options (S3), never whether the sword connects.

## The reference artifact

### A. The per-frame order of operations (BINDING — this is the artifact)

Every fixed 60 Hz simulation step executes exactly this sequence. Steps may not be
reordered, merged, or moved to the render loop.

```
 1. sample input             -> latch button/stick state for this frame
 2. advance state machine    -> resolve buffered inputs, transitions, stamina spends
 3. advance animation        -> anim_frame += 1 (integer; never dt-scaled)
 4. evaluate skeleton        -> world matrices for every bone, from the clip at anim_frame
 5. consume root motion      -> apply clip root delta to controller, resolve collision
 6. rebuild hurtboxes        -> transform each hurtbox capsule from its parent bone
 7. set hitbox active flags  -> from RI-CMB02 frame data at this anim_frame
 8. sweep + query            -> continuous overlap tests, this frame's pose vs last frame's
 9. resolve                  -> i-frames, block cone, dedup, poise, damage, events
10. emit trace record        -> RI-CMB07 es-combat-trace/1
```

Steps 4 and 6 in that order are the whole point: **hurtboxes are derived from the animated
pose, every frame, after the animation has been evaluated.** A hurtbox that is a static
capsule at the character's root is not a hurtbox.

Rendering interpolates between step-10 states for display. Rendering never queries.

### B. Weapon hit volumes

A weapon hitbox is a **capsule** defined by two bone sockets on the weapon mesh and a radius.

| Class | Socket A | Socket B | Radius (m) | Capsule length (m) | Peak tip speed (m/s) | Per-frame tip travel at peak (m) |
|---|---|---|---|---|---|---|
| Dagger | `wpn_guard` | `wpn_tip` | 0.055 | 0.28 | 14.0 | 0.233 |
| Straight sword | `wpn_guard` | `wpn_tip` | 0.070 | 0.95 | 18.5 | 0.308 |
| Spear | `wpn_mid` | `wpn_tip` | 0.060 | 0.70 | 21.0 | 0.350 |
| Axe | `wpn_head_a` | `wpn_head_b` | 0.090 | 0.32 | 17.0 | 0.283 |
| Halberd | `wpn_head_a` | `wpn_tip` | 0.085 | 0.75 | 22.0 | 0.367 |
| Greatsword | `wpn_guard` | `wpn_tip` | 0.095 | 1.35 | 23.5 | 0.392 |
| Ultra greatsword | `wpn_guard` | `wpn_tip` | 0.110 | 1.70 | 26.0 | 0.433 |

Note the last column against the radius column. **Every weapon travels 2.5× to 4× its own
capsule radius in a single 60 Hz frame at peak swing speed.** Discrete per-frame overlap
tests would therefore miss a stationary target entirely for most of the arc. This is not a
theoretical concern; it is the default behaviour of a naive implementation and the reason §C
exists.

### C. Sweeping (continuous collision)

```
SUBSTEPS = 4                       # 5 sampled poses per frame: t = 0, .25, .50, .75, 1.0
for s in 0..SUBSTEPS-1:
    A0 = lerp(socketA_prev, socketA_now, s     / SUBSTEPS)
    A1 = lerp(socketA_prev, socketA_now, (s+1) / SUBSTEPS)
    B0 = lerp(socketB_prev, socketB_now, s     / SUBSTEPS)
    B1 = lerp(socketB_prev, socketB_now, (s+1) / SUBSTEPS)
    volume = convex_hull_of_capsules( capsule(A0,B0,r), capsule(A1,B1,r) )
    for each candidate hurtbox H (broadphase: AABB of volume):
        if overlap(volume, H): record (target, H, substep s, t = (s+0.5)/SUBSTEPS)
```

| Parameter | Value | Rationale |
|---|---|---|
| Substeps per frame | **4** | Worst case (UGS, 0.433 m/frame) → 0.108 m per substep ≈ one capsule radius. Effective sampling rate **240 Hz** |
| Sampled poses per frame | **5** (t = 0.00, 0.25, 0.50, 0.75, 1.00) | Includes both frame boundaries |
| Interpolation of socket transforms | linear position, **slerp** rotation | Linear rotation lerp on a fast arc under-covers the swept region |
| First active frame's `prev` pose | the pose on frame `first_active − 1` | The sweep starts from *before* the hitbox turns on, so the leading edge is covered |
| Broadphase | AABB of the swept hull, expanded by 0.05 m | |
| Max targets per swing | unlimited | Damage de-dup is per (attack instance, target), §E.3 |

**Substeps are not a quality setting.** They are part of the rule. Reducing them to 1
changes which attacks connect, which changes the game.

### D. Hurtboxes

Eleven capsules per humanoid, each parented to a bone, rebuilt at step 6 every frame:

| Part | Parent bone | Radius (m) | Length (m) | Damage mult |
|---|---|---|---|---|
| `head` | `head` | 0.115 | 0.14 | 1.00 (player) / declared per enemy |
| `torso_upper` | `spine_02` | 0.170 | 0.22 | 1.00 |
| `torso_lower` | `spine_00` | 0.160 | 0.20 | 1.00 |
| `pelvis` | `pelvis` | 0.165 | 0.12 | 1.00 |
| `upper_arm_l/r` | `upperarm_l/r` | 0.075 | 0.26 | 1.00 |
| `forearm_l/r` | `lowerarm_l/r` | 0.065 | 0.25 | 1.00 |
| `thigh_l/r` | `thigh_l/r` | 0.100 | 0.40 | 1.00 |
| `shin_l/r` | `calf_l/r` | 0.080 | 0.38 | 1.00 |

Rules:

1. **Capsules follow bones, including during hitstun, rolls, and death.** A rolling player's
   hurtbox capsules are low and forward, which is why an ultra greatsword's high arc can pass
   over a roll *even outside i-frames*. That emergent property is desirable and must survive.
2. **`damage_mult` is a per-enemy declaration, defaulting to 1.00.** Weak points (Aggressor
   Naga's exposed gill cluster, `damage_mult 1.35`) live in the enemy statblock, not here.
   The player's hurtboxes are all 1.00 — there are no player weak points.
3. **When multiple hurtboxes on one target are struck by one swing, the highest
   `damage_mult` wins.** Exactly one damage event is emitted (§E.3).
4. **Hurtboxes are never scaled by difficulty, level, or distance.** No aim assist. No
   forgiveness radius. No "you were close enough".

### E. Resolution order and the no-dice rule

On step 9, for each recorded overlap, in this order, stopping at the first that applies:

```
1. target.invulnerable (frame window, RI-CMB01)   -> emit IFRAME_NEGATE. Nothing else happens.
2. target is BLOCK_HOLD
   AND angle(target.forward, incoming_direction) <= 60 deg
   AND the attack is not flagged unblockable        -> emit BLOCK, apply RI-CMB03 §C.
3. already-hit dedup: (attack_instance_id, target_id) seen -> discard silently.
4. apply poise damage (RI-CMB05); stagger if broken.
5. apply damage:
       damage = motion_value * weapon_ar * hurtbox.damage_mult * (1 - target.absorption[type])
   -> emit HIT.
```

**The no-dice rule, stated as a testable invariant:**

> For a fixed input script and a fixed initial state, the set of `(frame, attacker, target,
> hurtbox, damage)` tuples produced by a run is **bit-identical** across every RNG seed and
> every run. No call to any random source occurs on the hit-resolution path.

Corollaries, each of which is independently a fail condition if violated:

| Deleted concept | Why |
|---|---|
| To-hit roll / miss chance | ARBITRATION S1 |
| Weapon skill affecting accuracy | S3 — skill scales damage coefficients, never connection |
| Agility / evasion stat reducing incoming hit chance | Dodging is i-frames and geometry, nothing else |
| Damage variance range (`dmg ± 10%`) | Damage is a deterministic function of the tuple above |
| Critical-hit chance | Criticals are positional (backstab/riposte, RI-CMB05), never random |
| Glancing blows / partial hits | A capsule either overlaps or does not |
| Blocked-hit chance from shield "skill" | Blocking is a 120° cone and a stamina subtraction |

The **only** legal randomness anywhere near combat is enemy behaviour selection (RI-AI04's
declared `rng_draws`), and that is upstream of hit resolution, never inside it.

### F. Precision budget

| Quantity | Tolerance |
|---|---|
| Hurtbox capsule centre vs parent bone origin, any frame | ≤ 0.005 m |
| Hit/no-hit boundary vs analytic capsule surface | ≤ 0.030 m |
| Substep count | exactly 4 (±0) |
| Overlap events per swing per target | exactly 1 (±0) |
| Variance in damage across seeds | exactly 0 |

## Comparison method

Script: **`corpus/80-methods/m-cmb04-hitgeometry.mjs`**

Harness: headless Node + Three.js, fixed 60 Hz, seeded, scripted inputs. Requires a debug
channel that dumps, per frame, every hitbox and hurtbox as `{id, parent_bone, a[3], b[3], r}`
in world space. If that channel does not exist, this item scores **0** — the geometry is
unauditable and therefore not a bar.

**M1 — Bone attachment.** Play a full attack animation with a large pose excursion.
1. Dump all 11 hurtbox capsules and all bone world matrices every frame.
2. For each hurtbox, compute the distance from its capsule axis midpoint to its declared
   parent bone origin, per frame.
- **FAIL** if any distance varies by > 0.005 m across the animation (means it is attached to
  the root, or updated once at spawn).
- **FAIL** if the set of hurtbox transforms is identical across two visually different poses.
- **FAIL** if hurtboxes are rebuilt *before* the skeleton is evaluated — detect by injecting
  a one-frame 90° spine rotation and checking the hurtbox lags by exactly 0 frames.

**M2 — Tunneling.** For each weapon class, script the swing against a 0.06 m-radius static
pole target placed at 24 lateral offsets across the arc, one run each.
- Compute the analytic answer (does the swept hull contain the pole?) offline from the dumped
  socket transforms.
- **FAIL** on any disagreement between sim and analytic.
- Re-run with substeps forced to 1 and confirm the sim *now* produces misses; if it does not,
  sweeping is not actually implemented and the substep parameter is decorative.

**M3 — Boundary sharpness.** For the straight sword R1, place a static target and sweep its
lateral offset in 0.005 m increments through the hit/no-hit transition.
- **FAIL** if there is more than one hit→no-hit crossing (a fragmented hitbox).
- **FAIL** if the crossing is more than 0.030 m from the analytic capsule surface.
- Report the measured crossing offset; this is the "phantom range" number and it should be
  quoted in every verdict.

**M4 — Determinism / no dice.** Run the identical 600-frame input script 200 times with 200
distinct RNG seeds, enemy AI disabled (scripted enemy actions only).
- Hash the ordered list of `(frame, attacker, target, hurtbox, damage)` tuples.
- **FAIL** if any two hashes differ.
- Statically grep the build's hit-resolution module for `Math.random`, `random(`, `rng.`,
  `noise(`. **FAIL** on any occurrence reachable from `resolveHit`.

**M5 — De-dup.** Script a slow horizontal swing that keeps the capsule inside the target for
6 consecutive frames.
- **FAIL** if more than one `HIT` event is emitted for that swing/target pair.
- Then script a 3-hit combo: **FAIL** if fewer than 3 events are emitted (over-eager dedup).

**M6 — Resolution order.** Construct four scenarios: (a) i-framed *and* blocked,
(b) blocked from 75° off-axis, (c) blocked from 45° off-axis, (d) unblockable attack onto a
raised guard.
- Expected: (a) `IFRAME_NEGATE` only; (b) `HIT` (outside the 60° half-cone); (c) `BLOCK`;
  (d) `HIT` with full damage and poise.
- **FAIL** on any deviation, and **FAIL** if (a) emits both events.

**M7 — Render decoupling.** Run M2 with the render loop at 30, 60, 90, 144 and uncapped Hz.
- **FAIL** if any hit/miss outcome changes. Queries must live in the fixed step only.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 bone attachment | 20 | Hurtboxes track bones every frame, after evaluation |
| M2 tunneling | 25 | Sim matches analytic on all 7 classes × 24 offsets |
| M3 boundary sharpness | 15 | Single crossing, within 0.03 m |
| M4 determinism / no dice | 20 | 200 identical hashes, no reachable RNG |
| M5 de-dup | 5 | Exactly one event per swing per target |
| M6 resolution order | 10 | All four scenarios exact |
| M7 render decoupling | 5 | Outcomes invariant to render rate |

- **≥ 90** — parity.
- **70–89** — gap named, remediable.
- **< 70** — **we lose.**
- **Automatic fail regardless of score** (AR-1 violations, any one of them):
  - any random number reachable from hit resolution;
  - a to-hit check, miss chance, evasion stat, or skill-vs-skill comparison determining
    connection;
  - damage sampled from a range;
  - distance-based or "close enough" hit approximation (sphere-around-the-player,
    `distance < 2.0 && facing`);
  - hurtboxes that do not move with the animated skeleton;
  - hit queries executed in the render loop or scaled by `dt`.

`blind_pair: no` — this item is judged by measurement, not by comparative aesthetics. There
is no unlabelled artifact a critic could usefully pick between; the analytic answer is
computable and either matched or not.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **The distance check.** `if (target.position.distanceTo(player.position) < 2.0 &&
   isFacing(target))` on the attack's damage frame. It is four lines, it works, and it is
   the death of the combat system: no aiming, no spacing, no weapon reach, phantom hits
   through corners, and enemies hit you from behind their own swing.
2. **Three.js `Raycaster` as a hitbox.** A single ray from hand to tip, tested once per
   frame. Thin targets are missed constantly and the arc's swept area is never covered.
3. **`Box3.setFromObject(weaponMesh)` per frame.** An axis-aligned bounding box of a rotated
   sword is enormous and its size *changes with the sword's angle*, so the hitbox is largest
   exactly when the sword is diagonal. Players will feel this as random reach.
4. **No sweeping at all.** The default. §B's last column proves every weapon tunnels through
   a standing target for most of its arc at 60 Hz; the bug presents as "sometimes the swing
   just doesn't hit" and gets misdiagnosed as a timing issue for weeks.
5. **Hurtbox = the character's capsule collider.** Reusing the movement controller's capsule
   as the hurtbox is nearly free and is wrong: it does not duck when the player rolls, does
   not lean when they lunge, and makes every enemy's attacks connect at the same height.
   M1 exists for this, and it is the check most likely to fail on the first pass.
6. **Hurtboxes rebuilt before animation evaluation**, so the geometry is one frame stale.
   Invisible in a still, decisive at 26 m/s: a one-frame lag is 0.43 m of sword.
7. **`Math.random()` for damage variance**, added by someone to make combat "feel less
   robotic". It makes the trace diff in RI-CMB07 statistically meaningless and it is an
   automatic AR-1 fail.
8. **Morrowind leakage by good intentions.** Someone will notice we have a Long Blade skill
   and wire it to a hit chance, because that is what the skill means in Morrowind. S1 and S3
   exist precisely because this will be proposed, sincerely, more than once.
9. **Multi-hit spam.** No dedup, so a slow swing that overlaps for 6 frames deals 6× damage.
   Usually discovered by a player before a developer.
10. **Substeps as a graphics option.** Someone wires `SUBSTEPS` to a quality slider. Now the
    game is easier on low settings, and no two players are playing the same game.
11. **Everything correct, nothing observable.** We implement all of the above and ship no
    debug dump, so no critic can ever verify it and the item scores 0 anyway. The debug
    channel is a deliverable, not a nicety.

## Provenance note

`provenance: constructed`, confidence **high**. Every number here — capsule radii, socket
names, the 4 substeps, the 11-part hurtbox layout, the 60° block half-cone, the 0.005 m and
0.030 m tolerances, the peak tip speeds — was defined for this project. None is a measurement
of any FromSoftware title. The peak tip speeds in §B are derived from our own §A/§B frame
data in RI-CMB02 combined with our own reach figures, and exist to justify the substep count
arithmetically; they are engineering assumptions, and if our animations differ, the substep
count must be re-derived rather than kept out of habit.

Grounding is `canonical-recall`, confidence **medium**, of these observed properties of the
genre: weapon hitboxes are volumes swept along the blade rather than points or rays; hurtboxes
are bone-attached and visibly duck under high attacks during rolls; hits are fully
deterministic with no accuracy stat; criticals are positional rather than probabilistic; and
blocking is directional within a frontal cone. The specific implementation contract in §A —
the ten-step per-frame order — is entirely ours, and it is the single most important thing in
this file, because every other number here is unenforceable if steps 4, 6, 8 and 9 are not in
that order inside a fixed timestep.
