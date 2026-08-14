# W1-30D / W1-30E remediation — what was fixed, what it measured, what is still broken

Applying the four remediations named by the fresh critic in `corpus/90-verdicts/wave1/W1-30D-r1.md`
and `W1-30E-r1.md`. That critic reproduced **every number both builders reported**, so nothing here
overturns a build claim — the instruments were the problem, and these are the instruments.

Branch `codex/wave1-build-experiment`. Numbers below are from `82b6b79d` unless stated.

---

## 1. E's street gate never ran. It runs now, in seven towns of eight.

`GAP-W1-w1-30e-street-gate-never-ran`. The plan calls the eight settlement street shots the row that
decides E — *"building quality at 4-8 m is where a world stops being able to hide"* — and in all
three the critic examined on hardware the camera was **inside building geometry**.

The cause was `tools/visual/build-deck.mjs` placing the stand at `centre + 0.35 x radius, yaw 270`
without ever asking what was there. Measured against the shipping oriented footprints:

| settlement | old stand clearance | old camera clearance | new stand | new camera | facade aimed at |
|---|---|---|---|---|---|
| archon | +11.75 m | +11.50 m | 3.56 | 7.24 | 5.66 m |
| blackrose | +2.75 | +2.30 | 3.62 | 6.07 | 7.23 |
| **gideon** | **−0.80** | **−0.80** | 5.85 | 8.39 | 6.06 |
| **helstrom** | +0.25 | +1.17 | 3.10 | 2.58 | 5.94 |
| **lilmoth** | **−0.34** | **−5.24** | 4.76 | 9.02 | 5.50 |
| soulrest | +0.16 | +0.69 | 3.79 | 7.07 | 4.98 |
| **stormhold** | **−1.50** | +3.40 | 5.35 | 9.94 | 5.71 |
| **thorn** | **−7.40** | **−2.50** | 4.66 | 6.20 | 5.64 |

Negative means *inside a footprint*. **Four of eight teleports put the player inside a building** and
two more within 25 cm of a wall. The three the critic photographed — gideon, helstrom, lilmoth — are
−0.80, +0.25 and −0.34, which is the same diagnosis arrived at by a different instrument.

The new rule is in `build-deck.mjs` and it chooses rather than assumes: candidates on 9-33 m rings
off `settlementApproach()`'s civic focus, crossed with 24 yaws, gated on three constraints declared
before running (stand clear ≥ 3.0 m, the camera's own point ≥ 1.5 m clear at the 4.9 m spring-arm
distance behind, and a ray cast along forward that ENTERS a real building's footprint at 4-9 m).

**Captured on hardware twice**, NVIDIA L4, `ANGLE (NVIDIA, Vulkan 1.4.312)`, `HARDWARE — valid for
appearance claims`, 960x540, seed 20260814, 48 frames each (8 towns x 3 times x 2 weathers), 0 red.
$0.023 and $0.022. Frames in `docs/shots/2026-08-14-w1-30de-remediation/`.

**Result: 0 of 3 usable before, 7 of 8 usable now.** Gideon, Lilmoth and Stormhold are proper street
reads — facades both sides, windows, mortar courses, market canopies, stepping stones. Archon,
Blackrose, Helstrom and Thorn are usable. **Soulrest still fails**, and §4 says why.

The first hardware run also earned its keep by falsifying the first version of the rule: it scored
"how much building is within 30 degrees", which put Lilmoth's and Blackrose's facades at the edge of
frame with open marsh in the middle, and it stood Soulrest in the civic court under the public
realm's own canopy. Both are fixed by the ray test and a 9 m minimum off the focus. Nothing here was
believed until a frame was looked at.

## 2. The 3% silhouette guard could not catch the cheat it exists to catch. It can now.

Verdict D-1. Deleting **both of the character's hands** improves the crack metric by 31% and moves
the guarded quantity by **−0.31%** against a 3.0% threshold. The guard's own docstring justified 3%
by citing −1.0% for *"the whole of this build's change"*; the measured figure is **−2.9%**, so the
real headroom between a correct fix and a deleted limb was **0.4 points, not two**.

Both halves are now in `tools/visual/actor-hole-control.mjs`:

* the **area guard** is kept, with the arithmetic corrected in the docstring — it is the arm that
  catches `weld-arm-to-rib` at +9.0%, which ADDS geometry, and a presence census cannot see that;
* a **per-part presence census** is added. `actor-orbit-holes.mjs` already carried `owner[]` and a
  part label per triangle, so it now reports pixels owned per named part across the whole run, and
  a build whose part set is a strict subset of the baseline's fails. No new threshold.

**Proved by deleting the hands again**, as a patched copy of the source tree, never a flag inside the
instrument. `hide-both-hands` — palms, three fingers and an opposed thumb each, three separate edits
because the digits are built in a different loop from the palm:

```
hide-both-hands : 123 crack px (−31%), silhouette 52913 px (−0.3%), 39 parts
                  — CAUGHT by part census (actor-body:saxhleel:skin/hand_l, hand_r)
```

Those are the critic's numbers to the pixel (123, −31%, −0.31%).

**Delete-the-fix**, on a copy of the control tool with the census branch removed and nothing else:

```
hide-both-hands : 123 crack px, silhouette −0.3% — NOT CAUGHT — the guard is too loose
```

So the census is what moved the verdict, not something else carrying the number.

**Two things the census cannot do**, said out loud because a guard nobody knows the edge of is a
guard nobody can trust. It cannot see a part shrunk to one pixel, only a part gone from every frame.
And **it cannot compare across a rename** — the `a1d24f58` baseline predates the labelling scheme
entirely (`SkinnedMesh/hand_l` where the shipping tree has `actor-body:saxhleel:skin/hand_l`), so all
37 of its parts read as deleted. A delta with an empty intersection is therefore reported and not
counted. The first version of this fix did count it, which would have shipped a guard crying wolf on
the one arm everybody runs.

A bone-level census would survive the rename and was tried first. **It does not work**: deleting both
hands leaves the gauntlet equipment attached to `hand_l`, so the bone is still on screen. That is
recorded because it is the plausible wrong answer to this fix.

## 3. The successor mistake, and how much it was hiding

Verdict D-2. `actor-orbit-holes.mjs:350` computed `held` — the surviving gate — on the **unfiltered**
ring, so one stray pixel of a greatsword bordering a pocket reclassified the whole pocket from
`crack` to `bordered-by-held-object`. The stray-pixel filter described in the comment on the very
next line was applied only to `major`, which feeds `allJointed`, which is explicitly only reported.
Both branches now read the same filtered ring.

The critic said it did not re-run the full profile and so did not know how much the bug was hiding.
It is measured now, pre and post on the same tree:

| profile | before | after |
|---|---|---|
| 5,760 frames (24 angles x 3 distances, res 512) | 2,204 crack px in 978 frames | **2,207 in 981** |
| 640 frames (8 angles x 1.5 m, res 384) | 178 | 178 |

**Three crack pixels in three frames, 0.14% of the total.** Small, and real — the fix is not inert,
and the honest reading is that the veto was a latent hole rather than a live one.

## 4. What is still broken, and one new defect the working gate found immediately

**Soulrest's street shot still fails**, in both hardware runs, at every light. The camera and the
player are both enclosed. The stand is 3.79 m clear of every footprint, so the footprint test is not
lying — it is measuring the wrong thing:

```
meshes whose XZ bounding box contains the Soulrest stand or its camera:
  kitId roof.shell   43.7 x 3.5 x 42.7 m   y 5.0 .. 8.5
  kitId roof.shell   38.0 x 2.6 x 37.2 m   y 8.5 .. 11.1
  ...four more
```

**`roof.shell` draws a roof 1.97x the building's own footprint** — a ~16 m span on a 16 m building,
i.e. an eight-metre eave on every side. Worst case per town, measured from the drawn meshes:

| town | worst roof | footprint | roof span | ratio | kit |
|---|---|---|---|---|---|
| archon | archon-vat-house | 8.0 x 15.6 | 30.7 | **1.97** | roof.shell |
| helstrom | helstrom-hollow-bole | 11.2 x 13.2 | 26.0 | **1.97** | roof.shell |
| lilmoth | lilmoth-scribe | 11.2 x 13.2 | 26.0 | **1.97** | roof.shell |
| soulrest | soulrest-court-steps | 14.8 x 16.3 | 32.1 | **1.97** | roof.shell |
| blackrose | blackrose-family-row | 8.0 x 3.4 | 9.5 | 1.19 | roof.hip |
| gideon | gideon-cellar | 8.0 x 9.0 | 10.5 | 1.17 | roof.hip |
| stormhold | stormhold-old-customs | 8.0 x 7.5 | 9.4 | 1.18 | roof.hip |
| thorn | thorn-burnt-stilt | 8.0 x 9.0 | 10.4 | 1.16 | roof.hip |

`roof.hip` and `roof.reed` are ~1.17x, which is an ordinary eave. `roof.shell` is 1.97x on all four
towns that use it. **This is a W1-30E kit defect, not a Deck defect**, and it is exactly the class of
thing the critic predicted unblocking the street gate would surface: a proxy on footprints cannot see
it and a rendered frame cannot miss it. Soulrest's street row stays **blocked** until it moves.

Also visible in the frames and not mine to fix: **Gideon's ground renders black** at every light
(`street-gideon__*`), and the deck manifest reports `region_reported: western-rootlands` for a
`blackwood` setup.

## 5. What this could not do

* **No naive attribution pack on the new street frames.** The pack must be built by an agent that is
  not the judge (`RULES.md` rule 25); the 48 hardware frames are in the tree for a pack-builder. E's
  `settlements are attributable` row is still **not run**, and no number is offered for it.
* **Soulrest was not fixed**, only diagnosed. Moving it needs `roof.shell` to change, which is E's
  file and E's decision, or a stand chosen against drawn mesh bounds rather than footprints — which
  is the better instrument and is a bigger change than this remediation.
* **`unbed-belt` still does not go red** and is still left failing by design. That was the builder's
  call, the critic upheld it, and nothing here touches it.
* **The full 5,760-frame profile was re-run only for the held-object fix**, not for the census; the
  census is measured at the 640-frame control profile.
* **`applyInteriorBounds` is now called by `build-deck.mjs`**, matching `world/province.js`, because a
  plan without the join is footprints nobody ships. **It changed nothing today** — 0 of 264 buildings'
  drawn footprints moved and `rooms_limited_by_the_plan` is 0 — so it is a correctness fix with no
  measured effect, and it is reported that way rather than as a cause.
* **Ruling E1 and Lilmoth's approach row were left alone**, as instructed and as ruled correctly.

## Reproduce

```sh
node tools/visual/actor-hole-control.mjs --poses=default --angles=8 --distances=1.5
node tools/visual/actor-orbit-holes.mjs --poses=default --angles=24 --distances=1.5,4,12 --res=512
node tools/visual/build-deck.mjs                       # rewrites tools/visual/deck.json
node tools/visual/gpu-deck.mjs --estimate --profile street    # spends nothing
node tools/visual/gpu-deck.mjs --profile street --tag <tag> --no-motion --max-runtime 12
```
