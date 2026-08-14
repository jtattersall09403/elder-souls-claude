# Thorn — what chunk 2 built, and the thing the brief got wrong

**2026-08-14.** Chunk 2 of two. Chunk 1 established the target and measured the gap
(`reports/thorn-plates/2026-08-14-thorn-plates.md`); this chunk builds against it. Base commit
`f434730c`.

Two things shipped, one thing was ruled *not* to ship, and one premise in the brief turned out to be
false when it was measured. The false premise is the most useful thing in this report, so it is §1.

---

## 0. What I could not do — first, not last

1. **No frames. The capture pipeline was down for the whole chunk, and it is not specific to this
   piece.** The shared capture daemon took my requests, booted a browser three times — **111 s,
   165 s, 180 s**, 456 s of boot in total — and returned **`captures: 0, errors: 6`**. Every job dies
   with `closing browser: job timeout`: under the load that has held all day the browser takes longer
   to *boot* than the job timer allows. Contention was 7 browser instances and load 8.19 per core
   against a ceiling of 4.0 when I started, and **11 instances and 10.82 per core** by the time I
   finished. So **every appearance claim in this report is offline and derived from the game's own
   data and the renderer's own code**, exactly as chunk 1's §4 was, and **nothing here should be read
   as a statement about how Thorn looks.** Ruling W2's "a person looks at it and says whether it is
   good" is **not delivered** and is the single biggest hole in this chunk.
2. **The 48-frame sweep is not deliverable on this box, so I did not pretend to attempt it.** I
   committed `tools/visual/w1-thorn-core12.sh` — a 12-frame subset (4 yaws at noon and 3 further
   times of day at the writ-house door, 2 roofline reads, the approach, and a 2-frame town-centre
   control) chosen so a *before* and an *after* both fit in one budget. It has produced 0 frames.
3. **I reaped my own piece's orphan.** Chunk 1's `w1-thorn-sweep.sh` was still alive and respawning
   captures into `reports/thorn-plates/frames/` from a shell whose session had ended (pid 2426),
   doubling the load on a daemon that was already failing every job. Killed by pid — my own piece's
   processes; no `pkill`, and no sibling's browser touched.
4. **Material response stays n=0**, as chunk 1 left it: `pixel_metrics_valid: false` on all 89
   Morrowind plates, and I have no hardware frames either.
5. **The thicket (§6.5) is not built.** It was the stretch item behind the quay and the roof, and the
   quay turned into a measurement problem that was worth more than the stretch.

---

## 1. The brief's largest gap rests on a premise that is false, and here are the numbers

Chunk 1 §6.2 names the largest gap as *"the first exterior in the game is a quay with no quay on
it"*, and prescribes giving `GRAMMARS.thorn` a `tideline` and a drowned storey, reusing the Lilmoth
code path. That prescription assumes Thorn's quay **stands in water** as Lilmoth's does.

It does not. Measured from the same `WorldField` the engine builds — `heightAt`, `waterAt`,
`regionAt` — by `tools/render/w1-thorn-shoreline.mjs`, which is committed and exits non-zero if the
terrain field ever returns a constant:

| what | measured |
|---|---|
| ground under both quay doors, the quay spawn, the approach and the Rotted Hall | **13.28 m at every sample** — flat |
| `waterAt().depth_m` at both quay doors and the quay spawn | **0.00**, band `W0` |
| nearest water, walking north from the writ-house door | **30 m out**, at z = 938.5 |
| … from the barge-hold door | **33 m out** |
| the shoreline itself | a straight east–west line at **z = 938–939**, across **x = 3790 … 3835** |
| that water's surface | **14.60 m** — i.e. **1.32 m ABOVE the ground the quay stands on** |
| depth at the edge | **1.32 m immediately**, no shelving |
| is it tidal here | **no.** `tidal: false`, and `surface_y` is 14.60 at all four tide phases |

**So the Tidewrack quay is a quay 30 m inland of a hard-edged, non-tidal water body whose surface is
above its doorsteps.** The reason it reads as "a quay with no quay on it" is not that somebody forgot
to place the props. It is that the quay is not on the water.

### 1a. And there is no climb, either

Chunk 1 §4 records *"the quay sits at y ≈ 0 and the town at y = 13.31 m, about 50 m apart — a ~15%
grade the player climbs on their first walk"*, and calls making it read "the cheapest win in this
whole list".

There is no grade. Sampled every 4 m from the writ-house door to the Rotted Hall door, **the terrain
is 13.28 m at all eleven points.** The 13.31 m figure is the *authored `door` y* of the town
buildings and the 0 is the *authored `door` y* of the two quay buildings — and
`buildSettlementExterior()` does not use `door` y at all: it founds every building on `groundY()` at
its own four corners (`exterior.js` ~line 2507). So the two quay buildings are drawn standing on the
same flat pad as the rest of the town, and the "climb" exists only in a comparison between two
record fields. **§6.4 of the brief is void as written.** What is real is a **1.32 m step up into the
water** at the shoreline, which is a much smaller and much more local piece of verticality.

### 1b. Ruling T1 — Thorn does not get a tideline in chunk 2 (reversible)

A tideline is a mark left by water on a thing the water touches. Nothing at Thorn's quay touches
water, and no tide moves there. Painting a wet line and a drowned stone storey onto buildings
standing on dry ground 30 m from the shore would be dressing a lie, and it would then be cited as
evidence that the quay had been fixed.

**What would overturn it:** a terrain or water edit that brings the waterline to the quay — moving
the shore from z ≈ 938 to z ≈ 912, or moving the quay pad north. At that point **`tideline: 1.32` is
the measured value to use** (water surface 14.60 − quay ground 13.28), the Lilmoth code path at
`exterior.js:1613` works against it unchanged, and this ruling reverses in one line.

`game/data/world/terrain.json` and `game/data/world/water.json` both have other live claimants, so
the number is handed over rather than acted on. **This is the single highest-value thing anyone can
do for the opening of this game**, and it is about 25 m of shoreline.

---

## 2. What shipped

### 2.1 `roof.needle` — the first new roof profile the game has had

`thorn.json architecture_kit.silhouette` promises *"the thorn thatch — black needle-wood laid in
courses, **which no other settlement uses**"*. The renderer had three roof ids in total and Thorn
drew `roof.reed` and `roof.hip` — the same two Lilmoth and Helstrom draw. The one thing the starting
town's own record calls unique to it existed nowhere in the renderer.

`roof.needle` is registered in `game/src/render/lib/kits.js` and `GRAMMARS.thorn` now reads
`roofs: ['roof.needle', 'roof.reed', 'roof.hip'], roofMix: [0.58, 0.24, 0.18]`.

It is a **different silhouette**, not a reed roof in a different colour — which matters, because
Ruling E1 counts silhouettes:

- **it is steep** — `rise = 0.62 × min(w,d)` against reed's 0.38 and hip's 0.30;
- **it is a gable, not a hip** — two pitches, so the end elevations are open triangles;
- **the ridge bristles** — needle butts project past the ridge, which is the detail the record names
  and the thing that breaks a skyline.

Measured with the renderer's own `planSettlement → assignVariantSalts → previewSilhouette`:

| settlement | roofed buildings | **distinct roof profiles** | roof mix |
|---|---|---|---|
| **thorn** | 13 | **3** (was 2) | **roof.needle ×8**, roof.reed ×4, roof.hip ×1 |
| lilmoth | 23 | 3 | reed ×9, hip ×7, shell ×7 |
| archon | 16 | 2 | hip ×10, shell ×6 |
| helstrom | 32 | 2 | shell ×24, reed ×8 |
| soulrest | 10 | 2 | shell ×8, hip ×2 |
| blackrose / gideon / stormhold | 16 / 16 / 23 | 1 | hip |

**Ruling E1's ≥ 5 is still not reachable and I am not claiming it.** The kit now defines **four** roof
ids in total against E1's five, so no grammar in the game can mix five. That is a kit gap, not a
Thorn gap. **2 → 3 is the honest step**, and Thorn now ties Lilmoth for the most varied skyline in
the province.

> **A note on the count.** This table excludes records of kind `structure`, because a structure
> returns early in `buildBuilding()` and draws no roof — counting one credits a town with a profile
> nothing draws. Chunk 1's table counted every record, which is why its Thorn row says 18 buildings
> and this one says 13. The **profile counts are unaffected**: chunk 1 reported thorn 2, lilmoth 3,
> archon 2, helstrom 2, soulrest 2, blackrose 1, gideon 1, stormhold 1, and this instrument
> reproduces every one of those seven untouched towns exactly.

#### The trap this nearly shipped into, which every count in the tree would have missed

`exterior.js buildKitRoof()` hard-codes the pitch per roof id **and passes `rise` explicitly**, so a
part's own `s.rise ?? …` default never fires. A `roof.needle` registered at 0.62 and left out of that
table renders at **0.30** — a slightly bristly hip — while every census in the project still happily
counts a fourth distinct profile, because `previewSilhouette` only reads the roof *id*. That is
precisely RULES rule 5's *"a correct, instrumented model that nothing in the running world reads"*,
and it would have passed every offline gate here. The pitch table is now the change's real consumer
seam and it is commented as such.

#### Delete-the-fix, and the control went red

On a control clone (`tools/control-clone.mjs`, hard-linked, `--writable` on both touched files) with
`kits.js` and `exterior.js` reverted to base commit `f434730c`:

- **thorn falls back to 2 profiles — `roof.reed ×13, roof.hip ×5`, byte-identical to chunk 1's
  reported baseline**, and the kit falls back to 3 roof ids;
- **the other seven towns are identical in both arms**, which is the proof the change is scoped.

The instrument also carries chunk 1's own mistake as a permanent negative control: `--arm constant`
feeds one seed to everybody, which collapses **every** town to 1 profile, and
`w1-thorn-roof-census.mjs` **exits non-zero if the two arms ever agree**.

> A trap worth recording for the next person: my first delete-the-fix arm came back **green**, i.e.
> the control did not go red — because `git show HEAD:` no longer had the "before". The orchestrator
> bank had already carried my uncommitted edit into `HEAD` (commit `9aac1cbb`) minutes earlier, which
> is exactly what RULES rule 17 says the bank does. **On a tree banked every few minutes, `HEAD` is
> not your baseline; your session's base commit is.**

### 2.2 The Tidewrack landing — Lilmoth's quay, in Thorn's palette

`tidewrack-quay` held **two buildings and no props at all**, while a complete quay vocabulary sat one
town over. Six structures are now placed **at the measured waterline** — z = 935–941, x = 3796–3820,
which is where `w1-thorn-shoreline.mjs` says the water actually is — rather than scattered on dry
ground where they would be untrue:

| structure | mesh | provenance |
|---|---|---|
| The Tide Courses | `tho_tide_mark` | Lilmoth's `lil_tide_mark` |
| The Tidewrack Piles | `tho_pile_cluster` | Lilmoth's `lil_pile_cluster` |
| The Landing Stage | `tho_stilt_platform` | Lilmoth's `lil_stilt_platform` |
| The Boom Chain | `tho_boom_chain` | Lilmoth's `lil_boom_chain` |
| The Writ Quay | `tho_silt_quay` | Soulrest's `sou_silt_quay` |
| **The Moored Barge** | `tho_moored_barge` | **new — REF-A19's own subject** |

**Five of the six are reuse, and the reuse is structural rather than a copy-paste.** `THORN_QUAY_REUSE`
is a table in `exterior.js` that binds Thorn's ids to the neighbours' *builders* through `kitMesh()`,
so there is exactly one definition of a driven pile in this build and a fix to it reaches both
shores. What differs is that `kitMesh` is handed **Thorn's** palette, so the same piles come out in
thornmarsh's swatch. That is the 2026-08-14 directive §3's *"tweaked and reused, not rebuilt"*, and it
is four lines instead of five new part builders.

The one new part is the moored longboat with a green-and-white striped sail — REF-A19's own subject,
and the thing that says a barge came in, which is how the player got here: the first room of the game
is the hold of the Gideon barge.

#### CONSUMPTION, with three controls that all went red

`tools/render/w1-thorn-quay-consumption.mjs` exercises the whole chain and perturbs every link:

- all six parts are **declared** in `thorn.json`, **bound** in `STRUCTURE_KIT`, **buildable** by
  `kitMesh()`, and **placed** by `planSettlement()` at the intended coordinates;
- **perturbation 1** — undeclare the mesh in the settlement kit → all six resolve to `null` (6/6);
- **perturbation 2** — the committed `semantic=false` arm (the old hash rule) → 5 of 6 bind to
  something different. The moored barge happens to hash to itself, which is reported rather than
  hidden;
- **perturbation 3** — `kitBuildable('tho_a_part_that_does_not_exist')` → `false`.

`buildNamedStructure()` **throws** if a structure's mesh cannot be built, so a green run here is also
the proof that adding these six records cannot break Thorn's exterior build. `check-data` (587 files,
115/115 interiors) and `check-content` (551 quest resolutions, 1108 topic/actor pairs) are both green
on the changed tree.

### 2.3 The board anchor — one line in someone else's generator

`docs/art-direction/build-board.mjs` routed `thorn` to **REF-A3**, whose five plates are **all square
crops** — 0 of 5 composition-valid — so Thorn's rows could never be set whatever the town looked like.
The old basis also read `spiral-palisade`, which is `world-art.js`'s word for Thorn and **is not one
of the nine grammars in `architecture.json` at all**.

Re-routed to **REF-A19** (n = 6 composition-valid; Morrowind's own waterside settlement at Hla Oad),
with the reasoning and the reversal condition written into the file. `board.json` and `ART.md` are
generated and **I did not touch them** — they are `W1-30K`'s, and this change lands in the generator
so the next regeneration picks it up. **`stormhold` is in the same n=0 position and is deliberately
not fixed here**; it needs its own judgement, not a copy of this one.

---

## 3. What was published for reuse

- **`roof.needle`** — a fourth roof profile, available to all eight grammars. Any town can now mix it.
- **`THORN_QUAY_REUSE` / `thornQuayReuse()`** — the pattern for binding one town's kit ids to
  another's builders through `kitMesh()`, so a shared part has one definition and per-town materials.
  Any settlement that needs a quay, a stair or a wall another town already has can copy four lines.
- **`w1-thorn-roof-census.mjs`** — Ruling E1's number for *every* settlement, with a built-in negative
  control that fails the tool rather than the town.
- **`w1-thorn-shoreline.mjs`** — where the water is relative to any stand, for any town on a shore.

---

## 4. The honest state of the bar

| axis | target | Thorn after chunk 2 | status |
|---|---|---|---|
| roof profiles (Ruling E1, silhouettes) | ≥ 5 | **3** (was 2) | **improved, still short** — and ≥5 is unreachable at 4 roof ids in the kit |
| quay vocabulary | REF-A19's piles, stage, moored hull | **6 structures at the waterline**, 5 reused | **built** |
| tideline | REF-A19's wet line | **none, deliberately** | **ruled out, T1 — the quay is 30 m from the water** |
| verticality | REF-A19 relief σ 0.23–0.33 | terrain is flat at 13.28 m; the only real step is 1.32 m at the shore | **the brief's premise was wrong; nothing to compose** |
| the thicket | *"a thicket you cannot see out of"* | unbuilt | **not yet built** |
| material response | — | — | **n=0 and honestly so** |
| **the read from eye height** | REF-A19 eye-height framing | — | **NOT DELIVERED.** No frames; the daemon captured nothing all chunk. Ruling W2 is unanswered. |

**A statistic can fail this town and can never pass it.** Nothing above says Thorn looks good. It
says Thorn now has the roof its own record promised, a landing where its water actually is, and an
art-direction anchor that can be satisfied. Whether it *reads* is unanswered, and the next person
should answer it with frames before building anything else on top.

---

## 5. Evidence index

| what | where |
|---|---|
| Roof-profile census, all eight towns, both arms | `corpus/90-verdicts/wave1/artifacts/W1-THORN-PLATES/roof-census-after.json` |
| Shoreline and water measurements | `corpus/90-verdicts/wave1/artifacts/W1-THORN-PLATES/shoreline.json` |
| CONSUMPTION for the six quay parts, with three controls | `corpus/90-verdicts/wave1/artifacts/W1-THORN-PLATES/quay-consumption.json` |
| The census instrument | `tools/render/w1-thorn-roof-census.mjs` |
| The shoreline instrument | `tools/render/w1-thorn-shoreline.mjs` |
| The consumption instrument | `tools/render/w1-thorn-quay-consumption.mjs` |
| The 12-frame sweep, for whoever has a working daemon | `tools/visual/w1-thorn-core12.sh` |
| Target plates (unchanged from chunk 1) | `corpus/70-visual/refs/morrowind/REF-A19/REF-A19__mw-fullframe-*.jpg` (6), `REF-A11/…` (3) |

---

## 6. What the next person should do, in order

1. **Move the waterline to the quay** — `terrain.json` / `water.json`, about 25 m of shore. Then
   reverse Ruling T1 and set `tideline: 1.32` on `GRAMMARS.thorn`. This is the largest single
   improvement available to the opening of this game and everything else on the quay is waiting on it.
2. **Run `tools/visual/w1-thorn-core12.sh` twice** — once against `f434730c`, once against now — and
   look at the pictures. Ruling W2 is still owed and no offline number substitutes for it.
3. **Two more roof profiles**, if Ruling E1's ≥ 5 is to mean anything for any town. Four ids is the
   ceiling today and three settlements are still on one profile.
4. **The thicket.** `thornmarsh` already declares `depth: 'hook-arch-thickets'`; nothing closes the
   sky over Thorn's streets, and it is the town's strongest identity line.
5. **`stormhold`'s board anchor**, which is n=0 for the same reason Thorn's was.
