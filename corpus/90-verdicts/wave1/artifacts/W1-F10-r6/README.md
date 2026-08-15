# W1-F10-r6 — the feet were underground and the face was inside the skull

**2026-08-15 · roadmap item `F10` · answers `orchestration/status/W1-F10-r5-appearance.json`**

> *"No, the characters do not look good. Round 4 fixed the hands, and the hands were never the first
> thing you look at."* — the r5 appearance judgement

Round 5 photographed the running game on hardware and found two things it could not explain. This
round explains both, and they turn out to be **the same defect the hands had, twice more**:
geometry that exists, is drawn every frame, and is enclosed by something else.

## What to open, in order

| | |
|---|---|
| **`sheets/01-feet-before-after.png`** | Rounded stubs half-sunk in the grass become feet with three splayed clawed toes. Four bearings, both arms, same camera. |
| **`sheets/02-face-before-after.png`** | A bald ovoid with a jutting muzzle becomes a face with brow, eyes, nose, cheekbones, mouth and chin. It is a **crude** face — that is the honest word — but the arm above it has no face at all. |
| **`sheets/03-walk-feet-before-after.png`** | Four phases of `locomotion_cycle` at the foot. All four differ between the arms. |

`frames/` holds the 24 individual PNGs.

## Finding 1 — the player's feet were 68 mm under the terrain

`poseFromRig`'s presentation IK ended with `e[13] = gy + .02`: a **constant pin**, putting the ankle
2 cm above the ground. But `game/data/combat/skeleton.json` places `foot_l` at world y **0.0900**,
and `buildSkeleton`'s own foot block states its own number — *"the sole's underside has to land at
foot-local y = -0.088"*. The pin therefore dropped the bone 70 mm and took the whole foot with it.

Measured by posing the shipped player through `poseFromRig` and reading the skinned world y of every
vertex whose dominant influence is `foot_l`:

```
without the conform   skin@foot_l   y  0.0020 .. 0.1539     sole 2 mm ABOVE ground
with the conform      skin@foot_l   y -0.0680 .. 0.0839     sole 68 mm BELOW ground
                      bone@foot_l   y -0.0466 .. -0.0302    all 36 claw vertices underground
```

**That is why r5's two arms were byte-identical at the feet.** Both had their feet in the dirt, so
replacing the foot geometry changed nothing a camera could see. The flat floating cap at the end of
the leg in r5's `04-feet-player.png` is the **cloth calf**, which is not conformed and so stops at
the rest ankle 81 mm above the grass while the foot is beneath it.

The fix is a **delta, not a pin** — `e[13] += clamp(gy - groundY, ±0.25)`. On flat ground the shift
is exactly zero, which is the correct null a pin can never have; on a slope or a stair each foot
rides its own terrain; and it no longer overwrites the foot's animated vertical motion with a
constant, which is what flattened every heel strike and toe-off.

**Acceptance.** The brief's condition was *"the foot frames stop being byte-identical"*. **24 of 24**
foot frames differ between the arms (8 bearings × 3 pitches), against r5's 0 of 3 static and 1 of 8
walking on hardware.

## Finding 2 — the humanoid face was not featureless, it was enclosed

Two independent bugs.

**The landmarks were authored against a typed-in `z` and the skull is an ellipsoid.** Solving the
ellipsoid for its own surface height above each landmark's (x, y) — head-local metres, before
`headScale`:

| landmark | front z | skull/jaw surface | |
|---|---|---|---|
| eye | 0.0870 | 0.0928 | **5.8 mm buried** |
| pupil | 0.0936 | 0.0928 | 0.7 mm proud |
| brow ridge, inner end | 0.0900 | 0.0969 | **6.9 mm buried** |
| orbit rim, top of ring | 0.0740 | 0.0878 | **13.8 mm buried** |
| nasal bridge, upper end | 0.0710 | 0.0998 | **28.8 mm buried** |
| mandible line, front end | 0.1040 | 0.1316 *(jaw)* | **27.6 mm buried** |

The only things clearing any surface were the nose, the ears and the jaw — which is exactly the
"bald ovoid" the judgement describes.

**And the head scale was applied twice.** `addPresentation` computed `bs = M.build * extra`, and head
pieces pass `extra = headScale`. `headScale` **already solves for build** — its derivation is
`(TARGET_EXTENT − 0.070·build) / headTopLocal`, written precisely so a heavy character is not a
different number of heads tall. Multiplying build back in applied the compensation twice, and only to
head-attached pieces, because the skinned skull is scaled by `headScale` alone.

**The population, counted rather than inherited.** `game/data/npcs/*.json`: 408 records with a race,
148 humanoid. `characterFor()` hashes `npc:<eid>` into the `base.humanoid` pool (its own filter
excludes `hum.drowned`), giving 37 / 30 / 29 / 27 / 25. The two variants whose eyes measured **zero**
visible pixels — `hum.dunmer-lean` and `hum.imperial-clerk` — carry **52 of 148, 35.1%**.

### Eye + pupil + mouth, visible pixels over four bearings

| variant | before (`6df8d003`) | after |
|---|---:|---:|
| `hum.imperial-clerk` | **0** | 3,512 |
| `hum.dunmer-lean` | **0** | 3,752 |
| `hum.drowned` | **0** | 3,928 |
| `hum.legion-heavy` | 7,120 | 2,232 |
| `hum.breton-stout` | 4,438 | 3,058 |
| `hum.marauder` | 5,691 | 2,971 |
| `sax.hive-drone` (build 0.80) | **0** | 2,908 |
| `sax.deep-warden` (build 1.22) | 8,398 | 1,353 |
| `player.saxhleel` (build 1.00) | 1,805 | 1,805 — the exact null |

Three humanoid variants went from nothing to something, and the whole family collapsed into one
band. **The spread was the double-scaling**, and closing it is as much the point as raising the zeros.

## What is in the fix, beyond un-burying

- The skull and jaw are **named bindings**; `faceZ(x,y)` returns whichever mass is in front there, so
  the mandible is measured against the jaw it lies on rather than the skull 46 mm behind it.
- Landmarks carry an explicit **`proud` in millimetres** instead of a `sink` that meant different
  things at different radii. A joint ball at every interior ridge joint, for the reason the digit
  builder has one at every knuckle.
- **Lids, not a ring** — the full 8-arc orbit read as spectacles.
- The eye is **seated 12 mm in**, so its front stands ~1 mm proud at the centre and falls behind the
  skull toward its edges. That is what makes the visible patch an almond rather than a circle.
- **A mouth**, which was absent entirely — two low lips plus a dark seam.
- The **jaw was pulled back**: it front-faced at z 0.141 against the nose at 0.130, so the most
  forward point of a human head was its jaw. The order is now nose 0.130 > jaw 0.116 > skull 0.102.

## Provenance, and what this evidence is not

**These are not photographs of the running game.** Every image and number here comes from
`tools/visual/f10-r6-visible-surface.mjs`, an offline z-buffer rasteriser that builds the shipped
actor in Node and poses it through the game's own `poseFromRig` — same geometry, same pose code, and
**not** the game's renderer. No shadows, no ambient occlusion, no textures, no post. The claim is
*"the geometry the camera can see has changed, by these amounts"*, not *"the game looks like this"*.
`f10-r5-appearance.mjs` on a Pod would settle the rest for about $0.026.

**Delete-the-fix** ran against an explicitly pinned sha, `6df8d003`, verified free of this work
before use (`grep -c 'e\[13\]=gy+\.02'` → 1; `grep -c 'THE HEIGHT WAS PINNED TO A CONSTANT'` → 0) and
compared by sha256 against `git show`.

**Regression.** `actor-orbit-holes --angles=12`: humanoid 3,066 crack px in 1,155 frames → 3,078 in
1,142; saxhleel 2,894 in 1,192 → 2,831 in 1,247. Both arms FAIL that tool's gate before and after —
this is a no-regression check, not a pass. `character-digit-read` hand and foot gates: unchanged, 0
of 6 and 0 of 8 outside.

**Worth recording:** the foot gate passed at 0.24–0.29 throughout the period the foot was 68 mm
underground, because it selects triangles by dominant skin weight and so measures a foot in isolation
from anything that could hide it. It answers *"is a foot shaped like a foot"* and cannot answer
*"can you see a foot"*.

The full account, including what could not be done, is
`orchestration/status/W1-F10-r6.json` — its `what_i_could_not_do` is first, as it should be.
