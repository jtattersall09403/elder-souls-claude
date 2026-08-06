---
id: RI-VIS02
title: Fidelity reference set — current-generation shots we are measured against
kind: image
side: modern-fidelity
judges: [visual.renderer.lighting, visual.renderer.materials, visual.renderer.atmosphere, visual.renderer.water, visual.renderer.foliage, visual.renderer.sky, visual.renderer.drawdistance]
provenance: derived
confidence: medium
blind_pair: yes
---

> **SIDE DECLARATION: this item is `modern-fidelity`.**
> It is cited **only** under `JUDGEMENT SIDE: FIDELITY` (RI-VIS01 §B).
> **This item REFUSES Morrowind references.** No 2002 screenshot, no Vvardenfell shot, no
> "for its time" argument may be introduced into any judgement that cites this file. A
> critic that cites RI-VIS05 alongside this file has triggered CC-1 and its verdict is void.
> Art direction is judged elsewhere (RI-VIS05). **Nothing in this file says anything about
> what our game should look like** — only about how *well rendered* it must be.

## The bar

Our game must not be identifiable as "a WebGL thing" from a still frame. The bar is that a
1920×1080 PNG from our renderer, placed unlabeled beside a 1920×1080 PNG from Elden Ring,
Skyrim SE/AE or RDR2, is not instantly sortable by a viewer who is looking only at render
quality and ignoring subject matter. We will lose that comparison — the bar is *how much*
we lose it by, measured in the quantities of RI-VIS03, not in adjectives.

Concretely: surfaces respond to light with roughness variation; shadows are soft, cascaded
and contact-tight; the darkest 25% of the frame still contains readable detail and is tinted
by ambient rather than crushed to black; distance is described by scattering, not by a fog
plane; the sky is a gradient with hue shift and no banding; foliage has depth and moves;
water reflects and refracts and has a shoreline; edges are anti-aliased; the whole frame is
tonemapped with a filmic shoulder rather than clipped. Every one of those clauses is a
measurable in RI-VIS03 with a target band derived from the shots below.

## The reference artifact

Eight reference shots. For each: **where to find it**, **what to look at**, **the verbal
specification** (so the shot is judgeable even when the image cannot be fetched), and the
**measurable signature** it contributes to RI-VIS03's target bands.

Provenance discipline: image files are not vendored into this repo (copyright). Each entry
carries a `FETCH:` line stating honestly whether the authoring agent retrieved the image,
retrieved only a text page, or is working from a verbal specification. Where `FETCH: spec
only`, the verbal specification **is** the reference and is binding — a critic judges
against the described properties, not against a remembered picture.

---

### REF-M1 — Elden Ring, Liurnia of the Lakes at dusk, looking toward Raya Lucaria

- **Find it:** <https://eldenring.wiki.fextralife.com/Liurnia+of+the+Lakes> ·
  <https://eldenring.fandom.com/wiki/Liurnia_of_the_Lakes> · artist recreation with author
  commentary on the fog/silhouette relationship:
  <https://aluisiocsantos.artstation.com/projects/X1Vnv3>
- **FETCH:** text pages confirmed to exist and describe the vista (search-confirmed, Aug
  2026); image bytes not retrieved by the authoring agent. Treat the spec below as binding.
- **The shot:** camera low near the water on the eastern shallows, looking west/north-west
  across the flooded plain. Foreground: shin-deep water with scattered reeds and a ruined
  half-submerged structure. Midground: 300–600 m of flat water broken by rock stacks and the
  drowned gate town. Background: the Academy of Raya Lucaria as a **silhouette**, its detail
  eaten by depth fog, backlit by a low sun.
- **What specifically to look at:**
  1. **Depth is legible without detail.** Four or five distinct depth planes are separable
     purely by contrast falloff and haze tint. The Academy is a shape, not a texture — and
     it still reads as architecture because its *silhouette* survives when its surface does
     not. Note the artist's own commentary that the castle "isn't super detailed because I
     was aiming for a tighter silhouette since all the fog would actually kill all details".
  2. **Water is not a mirror and not a plane.** Reflection is present but roughness-broken:
     the sun's reflected column is a stretched, wind-scattered smear, not a clean disc.
     Near the camera the water is transparent enough to show the bed; at grazing angles it
     goes opaque and reflective (Fresnel). There is a wet-darkening band at the shoreline.
  3. **Volumetric light.** The low sun produces god rays through the standing pillars and a
     visible brightening of the fog volume near the light, not a uniform grey.
  4. **Highlights roll off.** The sun disc and its water reflection are blown, but the
     transition into them is a smooth shoulder over many pixels — no hard clip edge.
  5. **The darks are not black.** Rock undersides and the ruin interiors are dark *blue*,
     lit by sky ambient, and retain silhouette-readable internal structure.
- **Measurable signature it anchors:** M10 aerial perspective (`R_aerial ≈ 0.3–0.5`),
  M7 sky gradient (large ΔY and ΔC* from zenith to horizon), M9 highlight shoulder,
  M6 shadow-region detail retention and shadow hue offset.
- **Our analogue shot:** `exterior_marsh_dusk` — standing water, a xanmeer silhouette at
  400 m, low sun. This is the single most important comparison in the corpus because the
  subject matter is nearly identical, which removes art-direction confound entirely.

---

### REF-M2 — Elden Ring, forest interior (Mistwood / Weeping Peninsula treeline), mid-morning

- **Find it:** <https://eldenring.wiki.fextralife.com/Limgrave> (Mistwood section);
  any first-party capture of the Mistwood treeline.
- **FETCH:** spec only. Verbal specification is binding.
- **The shot:** camera inside a broadleaf wood, 20–40 m of visible depth, canopy overhead,
  sun above and behind the canopy.
- **What specifically to look at:**
  1. **Foliage has volume.** Looking into the canopy you see *layers* of leaves occluding
     each other, not a flat green wall and not a hedge of crossed billboards. Individual
     leaf clusters read at 10 m and dissolve into mass at 30 m.
  2. **Translucency.** Leaves with the sun behind them are brighter and shifted in hue
     (yellower/warmer) than leaves facing the camera. This is transmission, and its absence
     is the single loudest foliage tell.
  3. **Dappled light on the ground.** The forest floor is a high-frequency mosaic of lit and
     shadowed patches with soft edges, produced by shadow-mapped canopy. Not a uniform
     darkened ground plane, not a single blob shadow per tree.
  4. **Trunks are round.** Bark normal maps produce visible directional shading; the
     silhouette of a trunk at 5 m has no visible facets.
  5. **Contact darkening.** Where a root meets the ground, where a rock sits in grass, there
     is a tight dark gradient (AO) independent of the sun direction.
  6. **Wind.** In motion, leaves and grass move at multiple frequencies with phase offsets
     across the field; a whole tree does not oscillate as one rigid object.
- **Measurable signature:** M4 edge density (high, `ED_1 ≈ 0.22–0.32`), M5 spectral slope
  (natural, `α ≈ 1.8–2.2`), M6 shadow detail retention (high — dapple means the dark pixels
  are structured, not crushed), M8 flat-shading detector (very low flat-region fraction).
- **Our analogue shot:** `foliage_dense` — mangrove/cypress interior in the Hixinoct Fen.

---

### REF-M3 — Skyrim Special Edition, The Rift in autumn, god rays through birches

- **Find it:** <https://elderscrolls.fandom.com/wiki/The_Rift_(Skyrim)> for the region;
  representative captures: <https://www.nexusmods.com/skyrimspecialedition/images/76193>
  ("Autumn Rift"), <https://www.nexusmods.com/skyrimspecialedition/images/41274> ("god
  rays"), <https://steamcommunity.com/sharedfiles/filedetails/?id=2590074404>
- **FETCH:** gallery pages confirmed to exist (search-confirmed, Aug 2026); image bytes not
  retrieved. **Caution flag:** Nexus gallery shots are frequently modded/ENB'd. For fidelity
  targets use the *vanilla SE/AE* baseline described below; a modded shot may be used as an
  upper reference only if the critic records that it is modded.
- **The shot:** low morning sun through an autumn birch/aspen stand on a slope, ground
  carpeted in fallen leaves, distant valley visible between trunks.
- **What specifically to look at:**
  1. **Volumetric god rays** are the SE-specific feature: discrete shafts with soft edges
     that occlude correctly against trunks and *change with camera angle*. A screen-space
     radial blur from a sun sprite looks similar in one frame and wrong the moment the
     camera moves — check across two frames.
  2. **Saturated but not clipped foliage.** Autumn oranges and golds sit at high chroma
     while the frame's overall mean chroma stays moderate. This is the proof that "muted
     palette" and "full colour range present somewhere in the frame" are compatible — the
     exact thing our marsh palette must also achieve (RI-VIS03 M3).
  3. **Ground clutter density.** Leaf litter, grass tufts and small rocks are instanced at
     high density near the camera and thin out with distance; the transition is not a
     visible ring.
  4. **Distant valley.** Aerial perspective desaturates and lightens the far slope; contrast
     there is maybe 40% of near-field contrast.
  5. **Specular on wet/waxy leaves** gives a per-pixel glint field, not a uniform sheen.
- **Measurable signature:** M3 colour distribution (`p95 C* ≥ 55` with `mean C* ≈ 20–28`),
  M10 aerial perspective, M2 local contrast, M5 HFR (fine leaf litter → high).
- **Our analogue shot:** `exterior_marsh_noon` and `foliage_dense`.

---

### REF-M4 — A modern marsh/bayou: RDR2, Bluewater Marsh / Lagras at dawn

- **Find it:** <https://reddead.fandom.com/wiki/Bluewater_Marsh> ·
  <https://reddead.fandom.com/wiki/Bayou_Nwa>
- **FETCH:** text pages confirmed; image bytes not retrieved. Spec binding.
- **The shot:** dawn, ground fog lying on still black water, bald cypress with buttressed
  roots and Spanish moss, a half-sunk shack, birds. This is **the** genre reference for
  Black Marsh and the closest current-gen subject match we have.
- **What specifically to look at:**
  1. **Ground fog is a volume with a height.** It pools in hollows, sits at roughly knee
     height, and objects *intersect* it — a cypress trunk is fogged at its base and clear at
     3 m. A uniform full-screen fog cannot do this. This is the single feature that most
     defines "modern marsh render" and the one a naive Three.js `FogExp2` cannot produce.
  2. **Still black water.** Near-perfect mirror at grazing angle, near-total darkness
     looking down (high absorption, low scatter), with the two regimes blending by Fresnel
     across the frame. Reflections are *distorted* by slow low-amplitude ripples. Floating
     duckweed and scum break the reflection with hard-edged flecks.
  3. **Spanish moss / hanging organics** are alpha-tested geometry with correct sorting and
     no visible black fringing or popping cutouts.
  4. **Wet material response.** Roots at the waterline are darker, glossier, and have a
     visible wet-line. Above it, dry bark is rough and matte.
  5. **Mist scattering around the light.** Where the sun hits the fog, the fog *glows* and
     desaturates toward white; away from the sun it is blue-grey.
  6. **Insects and motes** as tiny sub-pixel particles catching light — the frame is never
     empty air.
- **Measurable signature:** M10 (strong), M6 (very dark frame that still passes shadow
  detail — the discipline case), M1 dynamic range on a low-key scene, M7 (dawn sky with
  strong hue gradient), M12 (see VIS04 §6) height-fog presence.
- **Our analogue shot:** `exterior_marsh_dusk`, `water_edge`.

---

### REF-M5 — Elden Ring, Siofra River, bioluminescent underground

- **Find it:** <https://eldenring.wiki.fextralife.com/Siofra+River> ·
  <https://eldenring.fandom.com/wiki/Siofra_River>
- **FETCH:** text pages confirmed (described as "a bioluminescent dreamscape"); image bytes
  not retrieved. Spec binding.
- **The shot:** vast dark cavern lit almost entirely by emissive sources — glowing plants, a
  false starfield ceiling, blue lantern-light — with a river and a ziggurat-like structure.
- **What specifically to look at:**
  1. **Emissive surfaces light their surroundings.** A glowing plant produces a falloff on
     the ground and on nearby geometry. An emissive material that glows but casts no light
     is the tell of a fake — check the ground within 1 m of every glowing thing.
  2. **Bloom is tight and threshold-gated.** Only the emissive pixels bloom; the whole frame
     is not veiled. Bloom has multiple mip levels — a tight bright core and a wide faint
     halo, not one gaussian.
  3. **Very low key, full range.** Mean luminance is low but the histogram still runs to
     both ends: deep blacks *and* clipped emissive cores.
  4. **Coloured shadows.** Because there are multiple coloured lights, shadow regions take
     the hue of whichever light still reaches them. Neutral grey shadows in a coloured-light
     scene = one-light rendering.
  5. **Fog carries the light colour.** The air itself is tinted blue and brightens near
     sources.
- **Measurable signature:** M1 (low mean, high range), M6 (coloured shadow test — hue offset
  between shadow and lit regions ≥ 15°), M9 (bloom shoulder), M8.
- **Our analogue shot:** `interior_rootway` — the root-tunnels are our Siofra. This is where
  our art direction is strongest, which makes it the shot most likely to be used to excuse
  fidelity failures. It is judged here on fidelity only.

---

### REF-M6 — Elden Ring, character close-up (any armoured NPC, third person, 2–3 m)

- **Find it:** any Fextralife armour-set page, e.g.
  <https://eldenring.wiki.fextralife.com/Armor+Sets>
- **FETCH:** spec only.
- **What specifically to look at:**
  1. **Material separation at a glance.** Steel, leather, cloth, fur and skin are each
     immediately identifiable from their *response*, not their colour: metal has a tight
     bright specular that moves with the camera, cloth has a broad dim sheen, fur has
     silhouette breakup.
  2. **Silhouette has no facets.** Shoulders, helmets, and limbs are smooth in outline at
     1080p; no polygon corners visible on any curve.
  3. **Cloth and hanging parts move** with secondary motion, lagging the body.
  4. **Contact shadows** where a pauldron meets a shoulder, a strap crosses a chest.
  5. **Eyes and face** — subsurface warmth in ears/nose, not plastic.
- **Measurable signature:** VIS08 §B silhouette faceting, M2 local contrast on the model
  crop, M4 edge density on the model crop.
- **Our analogue shot:** `character_closeup`.

---

### REF-M7 — Skyrim SE, a long vista with LOD (Whiterun plains from a ridge)

- **Find it:** <https://elderscrolls.fandom.com/wiki/Whiterun_Hold>
- **FETCH:** spec only.
- **What specifically to look at:** 2–5 km of visible terrain with a settlement at range;
  distant objects present as simplified geometry but *present*; the LOD transition band is
  not visible as a ring of appearing trees; terrain silhouette against sky is smooth; distant
  mountains carry snow specular. The point of this reference is **draw distance as a fidelity
  property**: a 200 m fog wall is a fidelity failure even if the fog is pretty.
- **Measurable signature:** M11 pop events, M10 aerial perspective.
- **Our analogue shot:** `xanmeer_vista`.

---

### REF-M8 — The negative reference: what a default Three.js scene looks like

This is the *anti-reference*. It is our own baseline, generated by the harness, and it is
the thing we must be visibly distant from. It is included so the critic has a lower anchor
as well as an upper one.

- **How to produce it:** a `MeshStandardMaterial` sphere and box on a plane, one
  `DirectionalLight`, one `AmbientLight`, `FogExp2`, no environment map, no tonemapping
  (`NoToneMapping`), no post, `antialias: false`, `scene.background = new Color(0x87ceeb)`.
  Rendered by the harness at 1920×1080 into `refs/anti/threejs-default.png`.
- **Its signature (measured, not recalled — the harness regenerates it each wave):**
  flat-shading detector fires; sky gradient ΔY ≈ 0; shadow regions have near-zero internal
  contrast; HFR far below band; NYQ ratio far above band (no AA); highlight clipping without
  shoulder.
- **Use:** every fidelity metric in RI-VIS03 must be reported as a triple
  `(anti-reference value, our value, modern target band)` so the critic can see whether we
  have moved off the floor at all. **A metric where our value is within 15% of the
  anti-reference value is reported as `AT DEFAULT` and fails that metric outright.**

---

### Target-band summary (bands owned by RI-VIS03; this table is the provenance link)

| Metric | Band anchored by | Band |
|---|---|---|
| M1 dynamic range | M1/M3/M4 daylight | `DR ≥ 0.72`, occupancy ≥ 0.80 |
| M2 local contrast | M2/M3 | `C_local_med ≥ 0.045` |
| M3 chroma | M3 (autumn) + M1 (dusk) | `mean C* 12–32`, `p95 C* ≥ 45` |
| M4 edge density | M2 (forest) | `ED_1 0.10–0.32` |
| M5 HFR / slope | M2/M3 | `HFR 0.06–0.22`, `α 1.6–2.6`, `NYQ ratio ≤ 0.18` |
| M6 shadow retention | M4/M5 (dark scenes) | `C_shadow_med ≥ 0.6 × C_local_med` |
| M7 sky gradient | M1/M4 (dusk/dawn) | `ΔY_sky ≥ 0.06`, `ΔC*_sky ≥ 4`, `BI ≤ 2/100px` |
| M8 flat-shading | all, vs REF-M8 anti-ref | `FS ≥ 0.035`, `LargestFlat ≤ 0.06` |
| M9 tonemap | M1/M5 | `ClipFrac ≤ 0.02`, highlight desaturation present |
| M10 aerial perspective | M1/M4/M7 | `R_aerial 0.25–0.70` |
| M11 LOD pop | M7 | `≤ 1 event / 120 frames` |

## Comparison method

1. Emit the RI-VIS01 §B declaration with `JUDGEMENT SIDE: FIDELITY`.
2. **Pair the shots.** Each of our capture slots maps to exactly one reference above:
   | Our capture | Reference |
   |---|---|
   | `exterior_marsh_dusk` | REF-M1, REF-M4 |
   | `foliage_dense` | REF-M2, REF-M3 |
   | `exterior_marsh_noon` | REF-M3 |
   | `water_edge` | REF-M4 |
   | `interior_rootway` | REF-M5 |
   | `character_closeup` | REF-M6 |
   | `xanmeer_vista` | REF-M7 |
   | `combat_midfight` | REF-M6 + REF-M2 |

   > **⚠ S24 COVERAGE NOTE — AMENDED wave 0 (rebase-s22), ARBITRATION seam S24. Flagged, not
   > changed.** Six of the eight capture slots are wetland or interior (`exterior_marsh_dusk`,
   > `exterior_marsh_noon`, `water_edge`, `foliage_dense`, `interior_rootway`,
   > `xanmeer_vista`), so **no capture in this set exercises the dry and high half of the
   > world** — Valus Ridge's open-sky cliff silhouettes and cloud-below-the-player, the Stone
   > Wastes' and Clay Moor's hard-shadow arid rock, the Salt Hills' rime, the Stone Forest's
   > mineral response. Those are *different fidelity problems*: aerial perspective over long
   > uninterrupted sightlines, hard sun with no canopy diffusion, and dry-matte materials with
   > no wet-line and no subsurface to flatter them.
   >
   > **Deliberately not changed by this sweep, and why.** This item's job is to pin *fidelity*
   > references to real published shots, each with a hand-written "what to look at" clause list.
   > Adding capture slots without adding the matching REF-M entries — which means finding,
   > citing and analysing new source imagery — would leave dangling pairs and would be
   > manufacturing an edit rather than making one. **The gap is real and belongs to this item:
   > at least one arid/high-altitude reference (long-sightline aerial perspective, hard shadow,
   > dry matte) and a matching `exterior_ridge_noon` capture slot.** Recorded in
   > `REBASE-S22-REPORT.md` §6.
3. **Walk the "what to look at" list** for the paired reference, item by item, and for each
   numbered clause record `PRESENT / PARTIAL / ABSENT` on our shot with the pixel region
   cited (e.g. "clause 2 water Fresnel: ABSENT — water is uniform 0.42 alpha across the
   whole plane, sampled at (300,900) and (1600,620), identical RGB").
   A clause may **not** be recorded as `PRESENT` without a cited pixel region or crop.
4. **Run the metrics** from RI-VIS03 on our shot and on `refs/anti/threejs-default.png`,
   and report every metric as the triple `(anti, ours, band)`.
5. **Where an image reference could not be fetched**, judge against the verbal specification
   only, and write `basis: spec` next to that clause. Do not invent remembered pixel values
   from an unfetched image; that is a provenance violation (CORPUS-CONTRACT §3).
6. **Blind pass**: run RI-VIS06 §A (fidelity blind protocol) with a fresh agent.

## Scoring

Per paired shot, score = fraction of "what to look at" clauses marked `PRESENT`, with
`PARTIAL` counting 0.5, multiplied by 10.

| Score | Meaning |
|---|---|
| 9–10 | Every clause present; metrics inside band; blind judge cannot sort the pair by render quality alone |
| 7–8 | All clauses present or partial; ≤ 2 metrics outside band by < 25% |
| 5–6 | 1–2 clauses absent; blind judge sorts the pair immediately but names a specific fixable gap |
| 3–4 | ≥ 3 clauses absent, or any metric `AT DEFAULT` vs REF-M8 |
| 0–2 | Frame is closer to REF-M8 (the anti-reference) than to its paired modern reference on ≥ half the metrics |

**Failure threshold: < 6 on any paired shot blocks the wave** (RI-VIS01 §E ship gate uses
the *minimum* across paired shots as the FIDELITY score).

**Hard fails, independent of score:**
- Any metric within 15% of the REF-M8 anti-reference (`AT DEFAULT`).
- A clause recorded `PRESENT` without a cited pixel region.
- Any Morrowind reference introduced (CC-1).

## How we lose

- **The 200-metre world.** We hide a tiny draw distance behind dense fog, call it
  "atmospheric", and REF-M7 is quietly never paired. Detection: M10 `R_aerial < 0.10` plus a
  visible fog wall where distant geometry terminates rather than fades.
- **Water as a blue plane.** `MeshBasicMaterial({color:0x3355aa, transparent:true})` on a
  `PlaneGeometry`. No Fresnel, no reflection, no refraction, no shoreline, no depth
  darkening, no normal animation. It will read as a bathtub next to REF-M4 and the critic
  will be tempted to call it "stylised" — that is CC-3.
- **Crossed-quad foliage.** Two intersecting alpha-tested planes per bush, no wind, no
  translucency, hard alpha cutout fringes, all facing the same way so the whole field
  flickers as one when the camera turns. Against REF-M2 this is the loudest failure we have.
- **One directional light, no AO, no IBL.** Every surface facing the same way is exactly the
  same brightness. Interiors are lit by an `AmbientLight` that flattens everything.
  Detection: M8 fires; M6 shadow retention near zero; shadow hue offset ≈ 0°.
- **No tonemapping.** `NoToneMapping` plus a linear output leaves the frame either washed
  (everything crowded into 0.3–0.7) or clipped (sky and all highlights at pure white with a
  hard edge). Detection: M9 `ClipFrac`, highlight desaturation absent.
- **Textureless coloured boxes** defended as blockout. A blockout is fine in week one and is
  a fidelity zero; the failure is *shipping it into a wave verdict* and letting the art score
  carry it.
- **2002 polygon counts defended as art direction.** The cardinal sin (RI-VIS01 CC-3). A
  Telvanni tower is a bulbous organic mass in both 2002 and 2026; only the tessellation
  differs, and tessellation is on this side of the line.
- **Reference laundering.** The critic cites a heavily ENB-modded Nexus screenshot as the
  "vanilla Skyrim SE" bar, sets an unreachable target, declares total failure, and the team
  stops trusting the metric. Guard: REF-M3's caution flag; modded shots are upper references
  only and must be labelled.

## Provenance note

`provenance: derived`, `confidence: medium`.

**Honest accounting of what was and was not retrieved.** The authoring agent ran web searches
in August 2026 and confirmed that every URL listed above exists and describes the location
claimed. Search results directly corroborated: Liurnia's fog-shrouded Raya Lucaria vista and
the artist's silhouette-vs-fog commentary; Siofra River as "a bioluminescent dreamscape";
The Rift as "lush, autumn-colored valleys and rivers" with Skyrim SE's volumetric god rays;
Bluewater Marsh as a Louisiana-Atchafalaya-modelled wetland with cypress and night fog.
**No image bytes were fetched.** The per-shot "what to look at" specifications are therefore
`derived` — written from the authoring agent's knowledge of these games, constrained by the
confirmed textual descriptions — not `measured`. They are binding as verbal specifications
per CORPUS-CONTRACT §3 ("a constructed bar we can measure beats a real number we can't").

The numeric target bands in the summary table are **constructed**, not measured off these
shots. They are the honest weak point of this item. The remedy is owed by the methods owner
and is the first upgrade this item should receive: obtain three legally-usable current-gen
captures (own-capture from an owned copy, or a permissively-licensed render), place them in
`refs/modern/`, run RI-VIS03's harness on them, and **replace the constructed bands with
measured ones**, upgrading this item to `provenance: measured, confidence: high`. Until then
a critic must report bands as `band: constructed` in its verdict.

REF-M8, by contrast, is genuinely `measured` — the harness regenerates it every wave, so the
floor anchor is always real even when the ceiling anchor is not.
