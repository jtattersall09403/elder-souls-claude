# Three defects the frames found and the geometry could not — W1-30E kit remediation

Three defects handed over by `reports/w1-30de-remediation/README.md` §4, all of them found by
**rendering a frame** after the street gate started resolving. Two are fixed here; one is diagnosed
and handed on with the number that decides it. Branch `codex/wave1-build-experiment`.

The common thread is worth saying once, because it is the transferable part: **every geometric gate
in this tree measures building footprints, and none of these three defects is a footprint.** A roof
twice its building's size, a ground the colour of nothing, and a region label that is the same
string in all eight towns are all invisible to a proxy and impossible to miss in a picture. This is
`OWNER-DIRECTIVES-2026-08-14.md` §2 and *"statistics can fail a build and can never pass one"*, with
three worked examples on one afternoon.

---

## Defect 1 — the roof that swallowed the town

### The ruling: **the eave was wrong, not the footprint.** *(reversible)*

`roof.shell` drew a roof **1.97x its building's own plan** — an ~8 m overhang on every side of a
16 m building — in archon, helstrom, lilmoth and soulrest. A player 3.79 m clear of every footprint
in Soulrest was still standing under a roof, and Soulrest's street shot failed at every light in
both hardware runs because of it.

The brief asked for this to be ruled rather than assumed, because an 8 m overhang could plausibly be
authored intent for a stilt-and-shell architecture in a wet province — in which case the defect
would be that nothing else in the game knows about it. It is not intent. Three pieces of evidence,
in increasing order of how hard they are to argue with:

1. **The authored eave already exists and had no consumer.** `exterior.js buildKitRoof()` passes
   `over: 0.45 + jitter * 0.35` to all three roof kits. `roof.hip` reads it, `roof.reed` reads it,
   and `roof.shell` never did. An 8 m overhang cannot be what the author meant when the same author
   wrote 0.6 m one call up and the part threw it away.
2. **It is a units slip, in one place.** `drum()`'s parameters are radii — `prismGeometry` uses them
   as `Math.cos(a) * r`. Fifteen of its sixteen call sites in `kits.js` pass a radius. This one
   passed `r0 * 2`, where `r0 = 0.5 * cos(0) = 0.5` is the half-extent of a unit plan meant to be
   scaled by `(w, d)` into exactly `w x d`. Doubling it made the plan `2w x 2d`.
3. **The arithmetic predicts the observed number.** Not "about two" — **1.97**, which is what a
   9-sided prism's bounding box does to a diameter of exactly 2.

**What would overturn it:** a settlement document, art-direction plate or region record asking for a
deep sheltering canopy over the street in the shell towns. Nothing in `docs/art-direction/` or the
four settlement records says any such thing. If one turns up, the right answer is still not to
re-widen this part — it is to build the canopy as **public realm**, where the street can be planned
around it and collision can know about it.

**Reversal:** three edits in `game/src/render/lib/kits.js`, all inside `registerKit('roof.shell')` —
restore `drum(r1 * 2, r0 * 2, ...)` with `band.scale.set(w, 1, d)`, delete the `shelleaves` slab,
and restore `Math.max(w, d) * 0.96` as the rib length. **This reversal has been executed**, on a
hard-linked control clone, and the old numbers came back exactly (below).

### And the part that is not a units slip — deleting the `* 2` alone would have been wrong

An ellipse with the same span as a rectangle does not cover the rectangle. `w1-04-r4-join.mjs` §4
says so in its own header — *"an ellipsoid dome scaled to w x d has a bounding box exactly w x d and
leaves all four corners open to the sky"* — and that hole was photographed once already. A
circumscribing ellipse needs **1.41x** span before any eave, which still stands a player under a
roof outdoors, so it is not an escape either.

So the dome does not carry the corners at all. It sits on a **squared eaves plate**: one thin
chamfered slab at `w + 2*over` by `d + 2*over`, which is how a round roof meets a rectangular
building everywhere it is built that way. It covers the plan exactly, it spans footprint plus the
authored eave, and it gives this roof the one thing it never had — the eave shadow line that
`roof.hip`'s own comment calls *"the single line that says 'roof' at 60 m"*.

### A second overhang in the same part, found by the same probe and bigger than the first

`archon-shrine` is 5.18 x 14.41 m. Its ribs were cut to `max(w, d) * 0.96` and placed radially, so a
rib at 72 degrees projected **4.5 m past a wall 2.6 m from the centre** and the roof measured
**2.77x** its building on the short axis — a larger ratio than the eave defect, in a part nobody was
looking at. A member sized from `max()` of a plan it is placed radially in will always overhang the
narrow axis of an elongated plan. Each rib is now cut to the shell's own chord at its own bearing.

### Measured

`node tools/render/w1-30e-roof-extent.mjs`. Span ratio is `max(roof span / footprint)` matched by
size rather than by axis name, because `buildBuilding()` turns a building to face its entry side —
taking it by name reported a correctly-sized roof on a turned building as 2.8x. Coverage is the same
8x8 raycast `w1-04-r4-join.mjs` §4 ships, hit counted only at or above the wall head.

| | span ratio, median | span ratio, worst | min coverage |
|---|---|---|---|
| `roof.shell` **before** | **1.97** | **2.547** | 1.0 |
| `roof.shell` **after** | **1.116** | **1.238** | 1.0 |
| `roof.hip`, before and after | 1.146 | 1.502 | 1.0 |
| `roof.reed`, before and after | 1.114 | 1.312 | 1.0 |

The shell now sits between the other two roofs instead of at twice their size, and hip and reed are
identical to the digit across the change — the lever is single-variable.

**Delete-the-fix, on a hard-linked control clone** (`tools/control-clone.mjs`, 35 MB apparent,
0.1 MB actually new on disk), with the three edits above reverted and nothing else touched:

```
roof.shell   n= 44  span x1.97   (max 2.547)  min coverage 1
roof.hip     n= 79  span x1.146  (max 1.502)  min coverage 1
roof.reed    n= 26  span x1.114  (max 1.312)  min coverage 1
```

**1.97 came back to the digit**, on the same buildings the remediation report named —
`helstrom-hollow-bole` 11.21 x 13.21 m to a 26.02 m roof, `soulrest-grey-hist` 14.81 x 11.86 m to
28.73 m. So the fix is what moved the number, and the number is the one the frames were about.

### The null control is the plausible wrong answer, and it is `setShellEave(0)`

The trivial control is "no roof at all" and it is deliberately **not run**: an empty roof group fails
everything by accident. The plausible wrong answer is **the shell shrunk to exactly its footprint** —
which clears the street stand, resolves the approach shot, and costs the overhang. It is a public
lever (`setShellEave`) rather than a flag inside the instrument, for the reason `province.js` gives
about `drawBuildings`: a claim that the eave moved a number is only a claim until the eave can be
perturbed from outside and the number watched to move.

**And the honest finding about that control, said out loud because it is the fifth failure shape in
`HAZARDS.md` §0.** The first version of the self-test asserted that shrinking the shell *costs
coverage* — that span and coverage pull against each other, so the sweep was choosing between two
real things. **It does not.** With the eaves plate under the dome, coverage is 1.0 at any eave
including zero, so **coverage cannot discriminate the fix from the null control at all**. Every arm
would have agreed about that wrongly. What discriminates them is the span; what the null control
costs is the overhang and its shadow line, and that is a thing only a frame can score — which is why
this tool is not the gate. The self-test now asserts the insensitivity rather than the opposite, and
separately proves the coverage number is not inert (the 56 roofless civic structures still read 0).

### What else moved, including one number that moved the wrong way

`node tools/render/w1-30e-kit-gate.mjs`, before (delete-fix clone) against after:

| gate | before | after |
|---|---|---|
| parts / buildings / bypass | 25 / 179 / 3,284 | **unchanged** |
| adjacent silhouette collisions | 0/205 | **unchanged** |
| settlements separable | 0.6443 | **unchanged** |
| edges are broken | 0.971 | **unchanged** |
| Gideon ordering | +0.14 (control −0.115) | **unchanged** |
| kit meshes | 45,106 | 45,151 (**+45**) |
| **skyline relief, Lilmoth** | **0.1835** | **0.1862** |

The +45 is exactly one eaves plate per shell roof in that arm, and it costs nothing at the draw
call: `w1-30-settlement-batching.mjs` returns **106 production meshes for the worst settlement,
`failures: []`** — the same 106 the fresh critic reproduced.

**The Lilmoth number moved onto its own control's value and that is reported as a change, not
explained away.** 0.1862 is what that indicator reads for `kit:false`, `one-grammar`, `one-variant`
and `flat-roof` alike; 0.1835 was a value only the wide-shell build ever produced. The reading this
suggests — that the indicator was registering the 8 m eaves rather than the roofline, which is
consistent with the critic already finding it could not separate the shipped build from a flattened
one — is **a reading, not a measurement**, and the row it belongs to is already `blocked` on the
atmospherics work rather than scoreable here. A fresh critic should treat this as the first thing to
attack.

### The half of the defect that survives the fix: the extent is now published

Fixing the eave closes the instance. The class is that **nothing outside `kits.js` could ask how big
a roof was**, so `settlementFootprintClearance()`, `build-deck.mjs`'s street stand and the camera's
spring arm all reasoned about `drawn_footprint_m` and were structurally blind to a roof of any size.

All three roof kits now stamp `userData.roofPlan = { w, d, over, footprint }`, and
`roofPlanExtent(node)` — exported from `kits.js` — reads the union roof plan off a built node with
no renderer, no raycast and no world. **The wiring into `build-deck.mjs` is NOT in this change** and
should be: its street stand should gate on `footprintClearance − roofOverhang` instead of on the
footprint alone. That file belongs to `W1-30V` and `W1-30DE-REMEDIATION`; saying so is more use than
pretending the join exists.

---

## Defect 2 — Gideon's ground renders black. Diagnosed: the authored region palette.

**It is the region-palette lookup, and specifically the authored value.** Not a material, not a
missing map, not the atmosphere work.

`node tools/render/w1-30e-ground-albedo.mjs` evaluates the shipping `Province._groundColour()` — the
one function that decides what colour a terrain vertex is — on the real `WorldField`, at the eight
street stands `deck.json` actually sends the camera to. Relative luminance in 0–255 sRGB units, so
it is directly comparable with the pixels:

| town | region at the stand | authored ground albedo | authored L | rendered | rendered L |
|---|---|---|---|---|---|
| **gideon** | **blackwood** | **`#14231A`** | **3.6** | **`#020202`** | **2.1** |
| archon | crimson-coast (palette axis: eastern-rootlands) | `#4F7A5E` | 41.8 | `#122015` | 28.2 |
| blackrose | western-rootlands | `#6E8A4E` | 56.2 | `#141c0e` | 25.5 |
| helstrom | stone-forest | `#7C8794` | 60.6 | `#3b4147` | 64.1 |
| lilmoth | western-rootlands | `#6E8A4E` | 56.2 | `#1a2412` | 32.8 |
| soulrest | stone-wastes | `#DCD2B8` | 165.2 | `#766b4c` | 107.3 |
| stormhold | salt-hills | `#7D8B5C` | 60.2 | `#2b351d` | 49.4 |
| thorn | thornmarsh | `#A98C72` | 72.4 | `#4e392b` | 60.4 |

Gideon renders at **2.1 of 255**. The next darkest town is **25.5**, twelve times brighter. That
matches the frames: the lower third of `street-gideon__t1300__clear.jpg` measures mean sRGB
(10.3, 15.3, 7.5) with **60% of its pixels at literally (0,0,0)**, against 27–54 luminance for the
other seven at the same light — and it is not a shadow, because the boulders and stepping stones
sitting on that ground are correctly lit in the same frame.

**The null control is the plausible wrong answer, not the trivial one.** The trivial control is "no
region data", which would black everything out by accident. The plausible one is
`null:swap-albedo` — give Blackwood **another region's authored ground albedo and change nothing
else**, at the same coordinates, through the same code. Gideon moves **2.1 → 44.9** and **all seven
other towns are identical to the digit**. So the authored value is the cause and the render path is
innocent.

The chain, for whoever fixes it: `regions.json` authors blackwood's ground as `#14231A`, *"black
leaf mulch over standing root-water"*, at luminance 3.6/255. `_groundColour()`'s closing clamp,
`setHSL(h, min(.34, s*.66), min(.38, l*.88))`, multiplies lightness by 0.88 and lands on `#020202`.
Nothing is broken; the authored colour is simply below the level at which any material information
survives — no relief, no wetness, no paddy bunds, no footprints. Deep Marshes' `#121424` is darker
still and will read the same way wherever it meets a camera.

**Not fixed here, and deliberately.** The fix is one authored value in
`game/data/world/regions.json` (claimed by `W1-25-persistent-builder`) or a luminance floor in
`Province._groundColour()` (`game/src/world/province.js`, **five** live claimants including one
in-progress remediation). Editing either from here is the two-agents-one-file failure Ruling O1 is
about. The tool, the numbers and the null control are in the tree so the fix is a five-minute job
for whoever owns the file, and the acceptance is stated: **rendered luminance at Gideon's street
stand ≥ 20**, which is the bottom of the band the other seven towns already occupy, with the other
seven unmoved.

---

## Defect 3 — the region label. It is not one bad row; it is every row.

The remediation report found `region_reported: western-rootlands` on a `blackwood` setup. Reading
the whole manifest: **all 48 rows in all eight settlements report `western-rootlands`**, including
`stone-wastes` Soulrest and `salt-hills` Stormhold. The field is a constant.

`deck.mjs` read it off `sim.env.region`, which is written by the save loader and by a scenario patch
and by **nothing else** — no engine code updates it from the player's position, and the Deck
teleports to every one of its setups. That is `reports/visual-truth/INVENTORY.md` row **V15**, still
open, owned by W1-02 / W1-30F, and `render/sky.js` already routes around it in a comment.

**This change does not fix the engine field; it stops the manifest presenting it as truth.** Each
row now carries:

* `region_at_player` — from `getTerrainAt(x, z).region`, the position-derived `field.regionAt()`
  lookup that the ground colour, the fog and the ambience bed all actually use. This is the region
  the frame is a picture of.
* `region_env_cached_see_V15` — the cached scenario field, renamed so V15 stays visible and
  measurable rather than hidden by its own fix. Nothing in the tree reads the old key, so the rename
  breaks nothing, and a key named "reported" is a key a reader trusts.
* `region_mismatch` — a boolean, so a sweep can find the drift without knowing the story.

One subtlety worth recording, because it will otherwise be read as a second bug: `setup.region` and
`region_at_player` can legitimately differ. Archon's street stand is in `crimson-coast` by the region
raster while the ground under it is already `eastern-rootlands`, because `W1-02`/`RI-WLD12` moves the
**palette axis across a border band before the rest** — *"the material under your feet changes tens
of metres before anything standing on it does"*. Both values are recorded and neither is silently
preferred.

---

## What this could not do

* **`roof.shell`'s new eave is not yet backed by a naive-judge read.** The span number and the
  delete-the-fix are geometry; whether a shell town now reads as architecture or as a row of boxes
  is exactly the question the null control was built to pose and exactly the question geometry
  cannot answer. The hardware frames are in the tree for a pack-builder, who must not be the judge
  (`RULES.md` 25).
* **Gideon's ground is diagnosed and not fixed**, for the ownership reason above. The acceptance
  number is stated so nobody has to re-derive it.
* **`build-deck.mjs` does not yet read `roofPlanExtent()`.** The publication exists; the join does
  not. Named owner, named change, not done here.
* **`w1-04-r4-join.mjs` still reports 56 roofs that do not cover their building**, and it did before
  this change too — they are the `archon-struct-*` class of civic structure that carries no roof by
  design (`renderCivicFeature()`: *"a quay, vat or root gate should preserve its negative space"*).
  Unchanged by this work in all three arms including the legacy one; it is a pre-existing red in
  somebody else's column and it is not touched.
* **Lilmoth's approach row and Ruling E1 were left alone**, as instructed.
* **No arm-to-arm image diff is offered anywhere in this report.** `HAZARDS.md` §8: two frames that
  look identical to a person differed on 77% of pixels at a foliage site, so a between-arm pixel
  diff at a settlement measures its own canopy. Only within-arm sabotage carries signal, and the
  sabotage here is the delete-the-fix on geometry.

## Reproduce

```sh
node tools/render/w1-30e-roof-extent.mjs                  # span + coverage, three arms
node tools/render/w1-30e-roof-extent.mjs --self-test      # 6 checks
node tools/render/w1-30e-ground-albedo.mjs                # the eight stands, two arms
node tools/render/w1-30e-ground-albedo.mjs --self-test    # 4 checks
node tools/render/w1-30e-kit-gate.mjs                     # E's offline gates, unchanged but for two rows
node tools/render/w1-30-settlement-batching.mjs           # 106 worst-settlement meshes, failures []
node tools/world/w1-04-r4-join.mjs                        # roof coverage, unchanged
```
