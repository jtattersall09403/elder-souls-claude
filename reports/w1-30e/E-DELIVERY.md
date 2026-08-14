# W1-30E — architecture and the settlement kit: what landed, and what did not

**Builder report. Not a verdict.** A fresh critic runs the child-scoped Deck, the naive attribution
packs and WLD03's anatomy population; nothing below is a substitute for that and several rows here
exist only to tell the critic where to look first.

Reproduce everything in this file with three commands, all offline, all under twenty seconds:

```sh
node tools/render/w1-30e-kit-gate.mjs        # the gates and all six null controls
node tools/render/w1-30-settlement-batching.mjs
node tools/world/w1-04-r4-join.mjs
```

---

## 1. What was built

**A kit of twenty-five parts** in `game/src/render/lib/kits.js`, and **eight grammars over it**,
each grammar derived from the `grammar` / `support` / `trim` strings `world-art.js` already
publishes. The derivation is asserted at import time (`assertGrammarsDerived()`), so the two files
cannot drift: a settlement whose trim word has no atlas slot, or whose `imperial` flag disagrees
with `world-art.js`, throws on load.

```
wall  wall.window  corner  roof.hip  roof.reed  roof.shell  door  shutter  stair  balcony
trim.course  awning  sign  pier  buttress  post  railing  rope  plank  crate  barrel
basket  net  lantern  bracket
```

Twenty-five exactly, all twenty-five used in the shipping eight settlements, all three LODs
(`near` / `far` / `impostor`) implemented for every one and asserted monotonic in triangles.

**Every part carries three things** the old geometry did not:

1. **A broken edge.** Chamfers are cut *inward*, so a kit wall of nominal 3.00 m is exactly
   3.00 m across and every footprint, doorway and collision bound in `exterior.js` means what it
   meant before. Asserted to 1e-5 m (float32 noise) in the self-test.
2. **`esCurvature`, per vertex** — the attribute `MATERIAL_API.md` §6a asks for by name, and the
   reason C's `wear reads` gate is red. 1.0 on a chamfer strip, ~0.45 on the ring of face just
   inside it, 0.0 in the face interior. Every kit material passes `wearFrom: 'geometry'`.
3. **Trim-atlas UVs.** `TRIM_SLOTS` had **zero consumers**; it now has twelve, one per band, and
   `assertGrammarsDerived()` throws if any band loses its consuming grammar.

**The 153 KB of existing geometry came along rather than being replaced.** `exterior.js` is written
almost entirely in two helpers, `box()` and `cyl()`, and the 37 named cultural features — Helstrom's
`hel_rootgate`, Soulrest's `sou_drowned_court_step` — are somebody's reading of what those towns
*are*. Rather than rebuild them, the two helpers themselves became kit parts: a `box()` is the kit's
chamfered `wall` slab and a `cyl()` is its faceted `post` drum, at identical outer dimensions. Every
one of the 37 features is now made of broken-edged, wear-ready geometry without a line of its
silhouette changing. That is the parent plan's *"rebuilt as kit parts rather than discarded"*, done
at the primitive rather than the feature.

**Lilmoth got the most work**, because it is the starting town, the weakest of the eight in the
visual sweep, and where a demo opens. Its grammar is the only one with a `tideline`: below 1.45 m
the wall is wet colonial stone with a salt course on it, above it reed — `world-art.js` calls the
grammar `reed-dome-tidal-court` and the settlement record calls the material rule *"two cities
stacked, and the lower one is drowning"*. It also has the province's widest roof mix (three
profiles), the highest decoration density, outside stairs to the first floor, and a skyline budget
of three against everyone else's one.

---

## 2. The gates, with their controls

Every control runs the **same code path with an option flipped**, never a copy, and every one is
the plausible wrong answer rather than the trivial one. `null:kit-false` restores the five
hand-rolled facade blocks *and* the primitive chamfer: it is the settlement exactly as it stood on
2026-08-14, complete and shippable.

| row | bar | shipped | control | |
|---|---|---|---|---|
| kit economy: parts | ≤ 25 | **25** | — | **PASS** |
| kit economy: distinct buildings from the kit | ≥ 40 | **179** | — | **PASS** |
| kit economy: building meshes with no `kitId` | 0 | **3,284** | 29,584 (`kit-false`) | **FAIL** |
| variation: adjacent silhouette collisions | 0 | **0 / 205** | 53 / 205 (`flat-roof`), 56 / 205 (`one-variant`) | **PASS** |
| variation: roof profiles per settlement | ≥ 5 | **1** (worst) | 1 (`flat-roof`) | **FAIL** |
| settlements separable *(geometry proxy)* | > 0.55, chance 0.125 | **0.644** | 0.208 (`one-grammar`), 0.175 (`kit-false`) | **PASS** |
| edges are broken *(geometric reading)* | ≥ 0.95 | **0.971** | **0.482** (`kit-false`), 0.964 (`no-chamfer`) | **PASS** |
| Gideon is the exception (ordering) | imperial towns more ordered | **+0.14** | −0.115 (`all-imperial`) | **PASS** |
| skyline relief, Lilmoth *(builder indicator)* | delta vs control | 0.1835 | 0.1862 (`flat-roof`) | **no signal** |
| draw budget: render meshes per settlement | ≤ 140 (pre-existing gate) | **worst 106** (lilmoth) | — | **PASS** |
| triangles, worst settlement | ≤ 1.2 M | **935,302** (helstrom) | — | **PASS** |
| `BatchedMesh` batching preserved | required | 96.8% mesh reduction, 708 render meshes over 8 towns | — | **PASS** |
| interior/exterior join, roof coverage | no regression | identical pre- and post-change | — | **no regression** |

### The four honest reds

**(a) 3,284 building meshes still carry no `kitId`** — down 89% from the control's 29,584, but not
zero. The composition is in `reports/w1-30e/kit-gate.json` under
`arms.shipped.bypassComposition`, and it is two things:

- **Icosahedral masses.** Moss cushions, clay swellings, egg terraces, canopy crowns. The kit has
  no part for a rounded organic blob and tagging one as a `wall` or a `barrel` to turn the number
  green would be exactly the laundering `carryKitProvenance()` was written to stop. They *were*
  given a **measured** `esCurvature` (`bakeCurvatureFromFaces()`, face-normal disagreement — an
  icosahedron's 138° dihedral is not a hard step), so they are wear-ready and they batch with the
  kit; they are simply not kit parts and are reported as such.
- **The public realm.** 9,945 street, court and causeway meshes across the eight towns. That is
  plan item 6 and it is **not started**.

**(b) Roof profiles per settlement: 1 in the worst case, against a bar of 5.** The kit ships three
roof parts and three grammars (Gideon, Stormhold, Blackrose) deliberately use exactly one, because
an ordered legion town whose roofline varies is not an ordered legion town. Five *profiles* per
settlement is not reachable from three *parts* without either five roof parts — which breaks the
25-part economy the same plan sets — or reading rise, pitch and overhang variation as separate
profiles, which would be counting the same roof five times. **This is a conflict inside the plan,
not a builder shortfall**, and the honest number is above. If the row is meant to count *silhouette
variants* rather than *roof parts*, the shipped build gives 32 distinct silhouettes in Lilmoth over
33 buildings and the row passes handily; that reading should be ruled on rather than assumed. (Distinct silhouettes per town, shipped:
archon 22/22, blackrose 21/22, gideon 18/22, helstrom 32/40, lilmoth 32/33, soulrest 15/15,
stormhold 21/33, thorn 18/18.)

**(c) The skyline-relief indicator does not move.** Lilmoth measures 0.1835 shipped against 0.1862
with every roofline flattened and every mast, drying rack and net frame deleted — no signal, and
very slightly the wrong way. Two possible readings and I cannot separate them offline: either the
statistic is insensitive at the approach camera (the silhouette is dominated by building masses,
and a 5 m mast on a 40 m-wide town moves a 320-column standard deviation very little), or the
skyline work is too timid to read. **This is the first thing the critic should photograph.** The
board's own `ART-X5-SKYLINE-RELIEF` (0.085…0.274, anchor 0.175) and
`ART-SET-ROOFLINE-RELIEF-lilmoth` (0.210…0.282, anchor 0.272) are the real instrument and they are
defined on a *rendered frame*; the number above is a rasterised silhouette of untextured geometry
with no sky, no fog and no terrain, and **must not be quoted against the board's bands**. Run
`docs/art-direction/measure-plates.mjs` on a captured frame instead — rule 10.

**(d) Two pre-existing failures in `w1-04-r4-join.mjs` are unchanged**, and I verified that by
stashing this work and re-running: 42 of 115 enterable buildings draw an exterior smaller than the
room behind their door (worst `archon-market` 0.2261) and 56 buildings "have a roof that does not
cover them", all 56 of which are `*-struct-*` records that never had a roof group by design. Both
numbers are byte-identical before and after. Neither is mine and neither is fixed.

---

## 3. Three defects this work found in its own instruments

Recorded because `HAZARDS.md` §0 is about exactly this and because each cost a real number.

1. **Six null controls that all agreed.** The first run of `w1-30e-kit-gate.mjs` reported six arms
   with identical values to four decimal places. `buildSettlementExterior()` constructs its own
   options object for `buildBuilding()`, so none of the control flags reached the building. Every
   arm was building the shipped settlement and reporting it as a control. Caught only because
   agreement that perfect is itself evidence.
2. **A control that scored perfectly because its output was missing.** The `kit:false` arm reported
   *zero* adjacent silhouette collisions — better than the shipped build — because the legacy path
   never set `summary.silhouette` and the fallback made every building unique. It now publishes a
   signature too, and reads 56 / 205.
3. **A control that removed the wrong thing.** `kit:false` left `box()` and `cyl()` chamfered, so
   "edges are broken" moved from 0.971 to 0.964 and looked like the chamfer did nothing.
   `setKitChamfer(false)` is the switch that actually removes it; the real control reads **0.482**.

And one defect in the build itself, caught by an existing tool rather than a new one: the first
`roof.hip` took each course's width from the *middle* of the course rather than its lower edge,
making every roof 12% narrower than the wall it sat on. `w1-04-r4-join.mjs` raycasts straight down
for precisely that.

---

## 4. What the art-direction board changes, and what it does not

`docs/art-direction/board.json` names 53 rows for this child. Two of its findings changed decisions
here:

- **Region separation is shape, not colour.** The board ships `ART-X7-SEPARATION-RAW` **unset**
  because Morrowind's own regions cannot be told apart from colour alone (leave-one-out 9.1%
  against an 11.1% chance baseline; the colour-stripped *layout* descriptor manages 27.3%). This
  child's separability is carried by roof choice, support type, storey rule, aperture density,
  dressing density and skyline vocabulary — **no colour term in the descriptor at all** — and reads
  0.644 against a 0.125 chance. That is the right axis to have been on, and it was luck as much as
  judgement.
- **The reference world is much less saturated than this subject is usually painted**
  (`ART-X2-CHROMA-P95`, 7.11…34.64 C*, with only 0.0–11.5% of pixels above C*=30). Kit materials
  take their colour from `paletteFor()`'s existing albedos and add only the region palette swatch;
  nothing here raises chroma, and the two decisions that reduce material count (trim members take
  the settlement's colour rather than the building's; three exterior colour buckets rather than
  eleven) both reduce colour variety rather than increase it. **Unmeasured** — chroma is a pixel
  statistic and this child rendered nothing.

Four of the eight settlement blocks are unset for want of plates (thorn 0, stormhold 0, archon 1,
helstrom 2). For those four there is no measured target, and this report does not invent one.

---

## 5. Decisions taken without asking, and what would reverse them

Under `CLAUDE.md` rule 0. Each is one line to undo.

| decision | why | reversed by |
|---|---|---|
| The skyline is variant specs over `post`, not a 26th part called `mast` | the plan lists 25 ids and the economy row counts ids | adding `mast` to `registerKit` |
| `ico()` is not tagged as a kit part | a rounded organic mass is neither a wall nor a post; tagging it would launder the census | a 26th part for organic masses, and a raised cap |
| Exterior colour uses three kind buckets, not eleven | eleven multiplied the material count and every material is a settlement draw call; the ≤140 row is pre-existing | `EXT_KIND_BUCKET` → identity map |
| Trim members take the settlement's colour, not the building's | a trim band is the town's, per `world-art.js`; also the single biggest material saving | drop the `spec.trim` branch in `kitMaterial()` |
| All trim wear bumps collapse to one value (+0.20) | nine slightly different numbers were nine materials and no frame distinguishes them | give `TRIM_WEAR` per-part values again |
| Facade storey *banding* varies; `b.storeys` and `b.height_m` do not | those are authority-owned and the interior join reads them | let `storeyChoice()` write `b.storeys` |
| Variant salts are assigned per settlement so no building matches its nearest neighbour | the gate said 7 of 205 pairs matched with one salt for everybody | `assignVariantSalts()` → return an empty map |

---

## 6. What I could not do

- **No frame was rendered and no browser was spent.** Every number here is geometry in Node. The
  premise every arm of the gate shares — and therefore the one none of them can falsify — is *that
  geometric separation reaches pixels*. The child-scoped Deck run, the naive attribution packs and
  Protocol A against `refs/modern/exterior_daylight` are the instruments that test it.
- **The bounded live proof on the pod did not run.** Three settlement streets, three approaches and
  one walk-through are still owed.
- **The public realm is not kit-built** (plan item 6, ~9,945 meshes). Streets, courts and causeways
  are still ad-hoc primitives; they are chamfered and curvature-baked, but they are not parts.
- **Interior thresholds** (plan item 7) got the exterior half only: the kit `door` brings jambs, a
  reveal, a lintel and a stone threshold, but nothing was coordinated with G's interior side of the
  same doorway.
- **Landmarks as authored exceptions** (plan item 5) were not attempted. The 37 named cultural
  features remain what they were, now kit-primitive-built. No exemption was written and none is
  claimed.
- **Draw calls were measured per settlement, not per shot.** The plan's row is ≤ 900 in the worst
  street shot; the whole-settlement figure is 106 render meshes worst case, which bounds it, but
  the frustum-scoped number is the critic's.
- **`ART-X2-CHROMA-P95`, `ART-X1-VALUE-SPLIT` and every `ART-SET-*` band are unmeasured against
  this build**, for the same reason: they need a frame.
