---
id: RI-MAG05
title: Magic VFX — spell design language (ART) and particle quality (FIDELITY), declared separately
kind: image
side: neutral
judges: [magic.vfx.artdirection, magic.vfx.fidelity, render.fidelity.vfx, render.art.weirdness]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **SIDE DECLARATION: this item is `neutral`, under the same licence RI-VIS01 holds.** It
> contains both reference sets and it holds them **only to keep them apart**. It cites no
> reference imagery of its own. A critic scoring magic VFX runs **two passes with two
> declarations and reports an ordered pair** (RI-VIS01 §B, §E). A single fused "the spells look
> good" score is CC-5 and voids the verdict.

## The bar

Spell VFX is where a game's art direction goes to die, because effects are the one asset class
authored by feel, at 2 a.m., against a black background, by someone who is not looking at the
palette document. Every default is wrong for this world: fire is orange, ice is cyan, arcane is
purple, holy is gold, and everything is an additive sprite that glows. Ship those and Black
Marsh becomes a generic fantasy game **every time anyone casts anything** — which, for a caster,
is a few hundred times an hour. It is the single highest-frequency opportunity in the project to
undo RI-VIS05's entire palette specification.

Two bars, and they never touch:

- **ART DIRECTION.** Our spells are **fluids, spores, growths and insects**. They are wet, they
  are organic, they are Hist-derived, and they leave residue. Magic in this province is *sap
  doing something* — RI-LOR05 establishes sap as soul in liquid form, and Jel has one word,
  `vei`, for blood and sap both. Nothing in this catalogue is abstract light. Judged against
  Morrowind + RI-VIS05 only.
- **FIDELITY.** Soft, depth-faded, correctly sorted, **scene-lit** particles at adequate
  resolution with motion vectors and a stated budget. A lit smoke plume that takes colour from
  the marsh around it is the tell that separates 2026 from 2002 here, and it is a property no
  amount of art direction can substitute for. Judged against RI-VIS02's modern references and
  measured with RI-VIS03's metrics only.

**CC-3, the cardinal sin, is the specific hazard for this item.** "Our flat additive sprites are
fine, they're stylised, they match Morrowind's look" — Morrowind's spell effects were the
highest-fidelity particles Bethesda could ship in 2002. We inherit the strangeness. We do not
inherit the sprites.

---

## The reference artifact

# PART 1 — ART DIRECTION

```
=== VIS DECLARATION ===
JUDGEMENT SIDE: ART_DIRECTION
PROPERTIES UNDER JUDGEMENT: P01, P02, P06, P07, P08
PERMITTED REFERENCE SET: RI-VIS05 (Morrowind transposition) + RI-WLD05 (strangeness)
FORBIDDEN REFERENCE SET: RI-VIS02 (modern), RI-VIS03 (fidelity metrics), RI-VIS04
=== END DECLARATION ===
```

### A1. The eight design-language rules (binding on every spell asset)

| # | Rule | The failure it forbids |
|---|---|---|
| **L1** | **Spells are matter, never abstract light.** Fluids, spores, growths, insects, dust, rime, sap. | Floating runes, arcane circles, glyph rings, generic sparkle motes, lens flares |
| **L2** | **Everything is wet.** Surface tension, beading, running, dripping, stringing. Sap is the master material. | Dry, crisp, geometric energy |
| **L3** | **Summons unfold, grow, or pull themselves out.** `bind_lesser` takes ~40 frames to haul itself out of the water. | Portal flash, dissolve-in, a puff of smoke and a creature |
| **L4** | **Fire sticks and drips.** It is burning resin. It pools where it lands and keeps burning there. | A fireball that vanishes on impact |
| **L5** | **Nothing is symmetrical** (WLD05 element 30). AoE footprints are irregular blooms. | Radial mandala decals, hexagonal wards, concentric rings |
| **L6** | **The windup is dim; the release is bright.** RI-AI02 §D makes the *silhouette* the telegraph and explicitly rejects VFX as a substitute. If the windup is the brightest moment, the effect is doing the animation's job. | Charge-up glow as the readable tell |
| **L7** | **Every spell leaves residue for 20–90 s.** Char, rime, scorch, wet patch, spore bloom. Ties directly to WLD05 element 26, *"the mud remembers"*. | Effects that leave the world untouched |
| **L8** | **No school may use the hue a generic elemental palette would predict.** | Orange fire, cyan ice, gold holy, violet arcane, toxic green |

### A2. The per-school emissive palette (BINDING — hex values are the spec)

High chroma in this world is a **light source, never a surface** (RI-VIS05 §C), and a spell is
the most legitimate light source the game has. That licence comes with the same budget: spell
chroma must be drawn from the **`EMISSIVE` family already declared for the regions**, not
invented. Every value below is an existing RI-VIS05 §C emissive or an interpolation inside that
family.

| School / element | Core | Mid | Decay | Residue (L7) | The idea |
|---|---|---|---|---|---|
| **Sorcery — Marshfire** | `#F0B24E` | `#C86A2A` | `#6B3A18` | `#241C14` char, glossy | Burning sap-resin. Sticks, drips, pools, keeps burning where it pooled. **Never `#FF6600`.** |
| **Sorcery — Saltrime** | `#D9CFC0` | `#B8C4A8` | `#97A08A` | `#C6CEBE` salt bloom | Salt and stilled water. Crystal growth along surfaces, not a projectile of ice. **Never cyan.** |
| **Sorcery — Wamasu-arc** | `#E8DCF2` | `#C77CE8` | `#86F06A` afterimage | `#2A2620` scorch pits | Violet-white strike, **green** afterimage burned into the eye. The green is the tell and it is why this is not lightning. |
| **Sorcery — Wither / Unmaking** | `#86F06A` | `#4A6B3A` | `#1F2622` | `#2E3A2C` bloom of grey fuzz | Rot accelerated. A visible fungal fruiting on whatever it touched. |
| **Root-Speech** | `#F0B24E` | `#D8A050` | `#8E6A32` | `#6B5330` sap bead | Sap, wet, with real surface tension. **It runs upward** along the body, against gravity. That single inversion carries the school. |
| **Warding** | `#D8C070` | `#A9AF90` | `#6A745E` | `#B3B49E` stone dust | Xanmeer gold. Carved-relief geometry made of settling dust, not of light. The only school permitted straight edges — and they are *broken* edges. |
| **Veiling** | `#7CE0E8` at ≤ 0.25 intensity | heat shimmer, no colour | — | none (it is the school that leaves nothing) | Mostly refraction and a thin swarm. If you can see it clearly, it has failed. |

**Forbidden VFX anchors** (any dominating a spell's frames is an art-direction hard fail for
that spell): `#FF6600` fire-orange · `#00BFFF` / `#87CEEB` ice-blue · `#FFD700` holy-gold ·
`#8A2BE2` arcane-violet · `#39FF14` toxic-green · pure `#FFFFFF` core · additive-white bloom
with no hue at all.

**Chroma budget, inherited unchanged:** in any frame, **≤ 8% of non-sky pixels may exceed
CIELAB `C* = 45`** (RI-VIS05 §C). A spell release is allowed to spend that budget — that is what
it is for — but **a `GREAT` release must not exceed 14%**, because past that the frame stops
being Black Marsh and becomes a light show. This is the one place this item raises a VIS05
number, and it is raised by exactly six points, for eight frames.

### A3. Per-effect visual briefs (the nine that carry the language)

| Effect | What the player sees |
|---|---|
| `fire_damage` | A gout of amber resin, thick enough to have weight, that **strings** as it flies. On contact it clings, runs down the target's silhouette, and drips into a burning pool on the ground that outlives the cast by 60 s. |
| `shock_damage` | A single violet-white strike with almost no travel presence, then a **green afterimage** that decays over ~24 frames. Arcs visibly to standing water and wet chitin (deterministically — RI-MAG02). Leaves scorch pits and the smell is implied by insects fleeing. |
| `frost_damage` | Not a projectile. **Rime grows** across the target's surface, following its geometry, from the contact point outward over ~18 frames. On water it spreads into a walkable plate (its traversal use, made visible). |
| `restore_health` | Amber sap beads out of the *ground* and runs **up** the caster's legs and body against gravity. Wet, slow, with visible surface tension. It looks like being fed, not like being blessed. |
| `levitate` | The single most easily ruined asset in the game. **No glow, no aura, no wings.** The character's *shadow* detaches and stays on the ground where the feet left it, and a thin skirt of disturbed spore-dust hangs beneath them. From below it reads as a silhouette against the canopy. |
| `invisibility` | Not transparency — **wetness.** The silhouette becomes a refractive water-film that the marsh shows through, distorted. It is legible if you are looking, which is what makes `detect_life` a real counter. |
| `paralyse` | The target's own posture freezes mid-motion; a **rime of grey fuzz** blooms along the joints. Nothing is added to the air. The horror is that the animation stopped. |
| `soul_trap` | A hair-fine amber thread from the target to the gem in your hand, taut, visibly under tension, **thinning** as the target's health falls. When it snaps the gem is warm and slightly wet. This asset must make the player uncomfortable; it is `xul-hesh` (RI-LOR05 §3). |
| `bind_lesser` | Over ~40 frames the water bulges, something inside it takes shape, and it **hauls itself out**. It never appears. There is no flash at any point. |

### A4. The Skyrim test, applied to spells

RI-VIS05's acceptance test transposed: **show a fresh judge a frame from a spell release, with
the HUD off and the caster cropped out, and ask "could this be from Skyrim, Elden Ring, or a
UE5 VFX pack?"** A spell effect that reads as any of them has failed regardless of how good the
particle simulation underneath it is.

---

# PART 2 — FIDELITY

```
=== VIS DECLARATION ===
JUDGEMENT SIDE: FIDELITY
PROPERTIES UNDER JUDGEMENT: F16, F09, F02
PERMITTED REFERENCE SET: RI-VIS02 (modern) + RI-VIS03 (metrics) + RI-VIS04 §13
FORBIDDEN REFERENCE SET: RI-VIS05 (Morrowind 2002), RI-WLD05
=== END DECLARATION ===
```

### B1. The feature checklist (extends RI-VIS04 §13 for spells specifically)

| # | Feature | MUST HAVE | The tell that it is missing |
|---|---|---|---|
| **V1** | **Soft particles** — depth fade against geometry | all particles, no exceptions | hard rectangular edges where a plume meets a wall |
| **V2** | **Correct sorting** — depth-sorted translucency, per-system | yes | a flame drawn in front of the pillar it is behind |
| **V3** | **Not additive-only** — alpha-blended with an additive *component*, never additive alone | yes | everything white-clips at the core; no dark smoke is possible |
| **V4** | **Scene-lit particles** — receive directional + ambient + IBL, and write into the light probe | smoke, dust, sap, spore | smoke that is the same brightness at noon and at midnight, in the open and in a cave |
| **V5** | **Emissive is HDR and tonemapped** — spell cores exceed 1.0 and are brought back by RI-VIS03 M9's tonemap | yes | cores that are `#FFFFFF` flat with no roll-off |
| **V6** | **Resolution ≥ ½ native with bilateral (depth-aware) upsample** | yes | visible chunky edges on smoke against fine geometry |
| **V7** | **Motion vectors** written by particles for TAA | yes | ghosting trails behind fast projectiles |
| **V8** | **Distortion / refraction pass** for `invisibility`, `Veiling`, heat | yes | Veiling implemented as a flat alpha fade |
| **V9** | **Decals for residue (L7)** — projected, depth-correct, normal-aware | yes | scorch decals floating off the terrain or clipping through it |
| **V10** | **Mesh-based effects where the shape matters** (rime growth, sap running, root unfolding) | ≥ 4 spells use animated mesh, not billboards | everything is a camera-facing card |

### B2. The budget (draw calls and counts, **never frame rate**)

HARNESS §1 forbids scoring FPS on this software renderer. Budgets are therefore in the
quantities `getWorldStats()` reports.

| Quantity | Per released spell, at peak | Whole-frame ceiling |
|---|---:|---:|
| Live particles | ≤ 900 (`GREAT` ≤ 1,600) | ≤ 4,000 |
| Particle draw calls | ≤ 6 | ≤ 24 |
| Overdraw factor on the particle buffer | ≤ 3.5× | ≤ 6× |
| Distinct systems per released spell | **≥ 3** (core, trail/decay, impact) | — |
| World residue decals per spell | **≥ 1** | ≤ 60 live |
| VFX texture budget | — | ≤ 24 MB |

The `≥ 3 systems` and `≥ 1 decal` floors are as binding as the ceilings: a spell that is one
sprite is a fidelity failure, not a performance saving.

### B3. Metrics (RI-VIS03's, applied to a new crop)

All measured on a new canonical viewpoint, requested below: **`spell_release_combat`** — the
`HEAVY` release frame (`startup + 1`), gameplay camera transform, HUD off, fixed weather and
time of day, 1920×1080 PNG sRGB.

| Metric | Applied to | Pass |
|---|---|---|
| **M2** local RMS contrast | 256 px crop centred on the spell core | within the profile band; **fail if the core is a flat clipped disc** |
| **M5** spectral slope | the smoke/spore crop | fail if the slope indicates a low-frequency blur — smoke with no structure |
| **M8** flat-shading detector | the whole frame | **fail if the frame's M8 score worsens by > 15% versus the same viewpoint with no spell active** — a spell must not flatten the scene it is in |
| **M9** tonemap response | the core | fail on hard white clipping (V5) |
| **VFX-SOFT** *(new, defined here)* | every particle/geometry intersection line in the frame | fail if the 95th-percentile luminance gradient across the intersection exceeds **3.2× the local median gradient** — that is a hard edge, i.e. no depth fade |
| **VFX-LIT** *(new, defined here)* | the same spell captured at `setTimeOfDay(12)` and `setTimeOfDay(0)`, and in an interior | fail if the mean luminance of the **non-emissive** particle systems differs by < **25%** across the three — unlit particles do not care what time it is |

`VFX-SOFT` and `VFX-LIT` are the two checks that cannot be faked by a good artist, and they are
the two this item contributes to the methods area.

---

## Comparison method

The critic runs **two passes**, in this order, with a fresh context or a re-read between them
(RI-VIS01 method step 4). Neither pass may read the other's reference set.

**PASS 1 — ART DIRECTION.**

1. Emit the Part 1 declaration block, with capture `sha256`s, **before** looking at anything.
2. **A-M1 — Palette conformance.** For each of the 7 school/element rows in §A2, capture the
   release frame and sample the spell's core, mid and decay pixels (top 2% luminance, the
   50–80th percentile, and the trailing 10 frames respectively). Compute **ΔE2000** against the
   declared hex. **Pass if ΔE2000 ≤ 12 for core and mid.**
3. **A-M2 — Forbidden anchors.** Compute ΔE2000 from every spell's core against each of the six
   forbidden anchors in §A2. **Fail any spell whose core is within ΔE2000 ≤ 13 of a forbidden
   anchor.** Re-usable implementation: `corpus/80-methods/palette-selfcheck.mjs` (RI-VIS05's).
4. **A-M3 — Chroma budget.** Compute the fraction of non-sky pixels with CIELAB `C* > 45` on
   the release frame. **Pass if ≤ 8% for `CANTRIP`/`LIGHT`/`HEAVY` and ≤ 14% for `GREAT`.**
5. **A-M4 — The eight rules (§A1), per spell, as a checklist.** L1/L3/L5 are asset audits
   (is there a rune ring? a portal flash? a radial decal?). L4/L7 are traces: **assert a
   residue decal entity exists 20 s after the cast, for every spell.** L6 is a measurement:
   **assert peak frame luminance during `startup` is < 45% of peak luminance during `active`.**
   **Fail the spell on any rule.**
6. **A-M5 — The Skyrim test for spells (`blind_pair`, primary instrument).** 20 release frames,
   HUD off, caster cropped out, unlabeled, one at a time, to a fresh judge:
   *"Could this be Skyrim, Elden Ring, or a UE5 VFX pack? If none of these, name the specific
   thing in frame that made you say so."*
   **Pass: ≥ 17 of 20 "none of these" AND ≥ 14 of 20 name a specific object.**
   **Fail: ≥ 4 of 20 identified as one of the three.**
7. **A-M6 — Blind pair against Morrowind.** Interleave 8 of our spell frames with 8 Morrowind
   spell-effect screenshots, downsampled to a common resolution so 2002 fidelity is not the
   tell, and ask a fresh judge to rank all 16 by *"how much this looks like magic nobody else
   has written"*. Record the blind ranking before the reveal. **We lose if our median rank is
   in the bottom half.** Per CORPUS-CONTRACT §6, if the judge ranks ours above Morrowind,
   distrust the judge and re-run harsher.

**PASS 2 — FIDELITY.**

1. Emit the Part 2 declaration block with capture `sha256`s.
2. **F-M1 — Feature checklist V1–V10.** Each ☐/☑ with the named detection from §B1.
   **Pass floor: 8 of 10, and V1, V2, V4 are mandatory** (missing any of the three fails the
   pass outright — they are the three that separate a modern particle system from a 2002 one).
3. **F-M2 — `VFX-SOFT`.** Detect particle/geometry intersection lines by depth discontinuity in
   the alpha-weighted particle buffer; compute the 95th-percentile luminance gradient across
   each. **Fail if > 3.2× the local median.**
4. **F-M3 — `VFX-LIT`.** Capture the same spell at `setTimeOfDay(12)`, `setTimeOfDay(0)` and in
   a `dark dungeon` interior anchor. **Fail if mean non-emissive particle luminance varies by
   < 25% across the three.**
5. **F-M4 — RI-VIS03 metrics** M2, M5, M8, M9 on the crops in §B3. **The M8 delta assertion is
   the headline: a spell must not flatten the frame by more than 15%.**
6. **F-M5 — Budget.** `getWorldStats()` at the release frame and 20 frames later. **Assert
   every §B2 ceiling and every §B2 floor.**
7. **F-M6 — Blind pair against modern references.** 8 of our spell frames against 8 RI-VIS02
   modern-reference VFX frames, unlabeled, ranked for *"which of these was rendered this
   decade"*. Record blind pick before reveal.

**CROSS-CONTAMINATION SWEEP.** Run `cc-scan.mjs` (or §C by hand, stating `cc-scan: manual`)
over both verdict bodies. **CC-3 is the expected hit for this item**: any sentence excusing a
`V*` or `M*` failure with "it matches Morrowind's look", "stylised", "retro" or "the art
direction carries it" **voids the verdict and fails the piece.**

**REPORT** as an ordered pair, never summed:
`MAGIC VFX — ART DIRECTION x/10, FIDELITY y/10; SHIP GATE min(x,y) ≥ 6`.

## Scoring

**Two independent scores. `min()`, never `mean()` (RI-VIS01 §E).**

**ART DIRECTION**

| Score | Condition |
|---|---|
| 10 | A-M5 ≥ 19/20 "none of these"; all 7 palette rows ΔE ≤ 8; chroma budget clean; 8/8 rules on every spell; A-M6 median rank in the top third |
| 8 | A-M5 ≥ 17/20; ΔE ≤ 12; ≤ 1 rule failure across the whole spell set |
| 6 | A-M5 15–16/20; ΔE ≤ 15; ≤ 3 rule failures |
| 4 | Palette is in-family but the language is generic — the colours are right and the shapes are sparkles |
| 2 | Recoloured stock effects |
| **0 — WE LOSE** | Any of: ≥ 4/20 read as Skyrim/Elden Ring/UE5 pack; any spell core within ΔE2000 ≤ 13 of a forbidden anchor; a rune ring, arcane circle or portal flash anywhere; `levitate` has an aura |

**FIDELITY**

| Score | Condition |
|---|---|
| 10 | V1–V10 all present; `VFX-SOFT` and `VFX-LIT` clean; M8 delta ≤ 5%; every budget met; F-M6 blind pick reads as modern |
| 8 | 9/10 features; both new metrics clean; M8 delta ≤ 10% |
| 6 | 8/10 features **including V1, V2, V4**; M8 delta ≤ 15% |
| 4 | Soft particles present but unlit; everything additive |
| 2 | Camera-facing additive sprites with hard intersection edges |
| **0 — WE LOSE** | Any of: V1, V2 or V4 missing; `VFX-SOFT` fails; M8 delta > 25% (spells flatten the game); no residue decals; particle count or overdraw over ceiling with no mitigation |

**Failure threshold: `min(ART, FIDELITY) < 6`.** And the meta-failure: **a verdict that reports
one number for magic VFX is void** (CC-5), scores 0 on RI-VIS01, and the wave is re-judged.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 on the worse scale | 6 / 10 on the worse scale | 8 / 10 on the worse scale |

**Aggregation (a property of this item, not of the critic):** min over the two independent 0-10 scales (art direction, fidelity) — never averaged.

## How we lose

- **The cardinal sin, in its natural habitat.** The build lands with flat additive sprites. A
  critic primed on "Morrowind" writes *"the spell effects have a pleasantly retro Elder Scrolls
  feel"*. CC-3 fires, the verdict is void — except nobody runs CC-3 on VFX because VFX feels
  like art direction, and three waves later the corpus records a 7/10 for a particle system with
  no depth fade. This is the reason this item is `neutral` and has two declaration blocks.
- **Orange fire.** The single most likely individual defect in the project. It is the default in
  every particle editor, every asset pack and every tutorial, and it is one hex value away from
  correct. A-M2's ΔE check exists because "it looks amber-ish to me" is not a measurement.
- **`levitate` gets an aura.** Someone needs the effect to be *readable* and adds a glow, and in
  one commit the most Morrowind traversal verb in the game starts reading as a superhero
  ability. The detached shadow in §A3 is harder to build and is the whole idea.
- **Everything is additive, so nothing can be dark.** Additive-only blending makes a black
  smoke, a grey rime and a wet refractive film *impossible to author*, which quietly forbids
  five of the seven school palettes. V3.
- **Unlit particles.** The most invisible fidelity failure: the effects look fine in the
  screenshot everyone looks at (noon, exterior) and read as pasted-on stickers in a cave at
  night, which is where half this game happens. `VFX-LIT` exists because no one will notice
  this by eye until it is everywhere.
- **VFX becomes the telegraph.** An artist makes the windup brighter because it "reads better",
  and RI-AI02 §D's silhouette requirement is quietly satisfied by a colour flash instead of a
  body. That is an AR-1 failure *and* an art failure, and L6's measurement is the only thing
  that separates a well-lit windup from a windup made of light.
- **Residue is cut for performance.** Decals are the first thing to go under a draw-call budget,
  and with them goes L7, and with L7 goes the connection to WLD05 element 26. The `≥ 1 decal`
  floor is in §B2 rather than §A1 precisely so it is argued about in the fidelity budget, where
  the cut would otherwise happen silently.
- **Radial AoE decals.** Every AoE telegraph in every game is a circle, RI-MAG01 §E requires the
  decal to match the hitbox footprint within ±5%, and a circle is the easiest way to satisfy
  that. L5 forbids symmetry; the reconciliation is an **irregular bloom of equal area**, which
  is more work and is the difference between our floor and everyone else's.
- **One system per spell.** A single emitter, retinted per school. It passes every palette check
  in Part 1 and fails B2's `≥ 3 systems` floor, and it is what happens when VFX is assigned to
  whoever has time.
- **The two passes are run by one agent in one context.** The ART pass contaminates the FIDELITY
  pass by memory, the critic forms a gestalt, and the pair becomes an average. RI-VIS06's blind
  protocol with a fresh agent is the mitigation and it must be used here specifically, because
  spell frames are unusually easy to form an opinion about.

## Provenance note

**Everything in this item is `provenance: constructed`,** `confidence: medium` — lower than
RI-MAG01–03 for one honest reason: **no reference imagery has been captured or verified this
session.** Every hex value, threshold, budget and metric constant is defined for this project
and is binding because it is measurable; none is sampled from a screenshot of anything.

Values **inherited** and which must move together if they move at all: the P/F property
partition, the declaration block, CC-1…CC-6 and the `min()` ship gate (**RI-VIS01 §A, §B, §C,
§E**); every emissive hex in §A2, the ≤8% chroma budget, the forbidden palette anchors and the
ΔE2000 ≤ 13 separation rule (**RI-VIS05 §C**); the metric definitions M2/M5/M8/M9
(**RI-VIS03**); the soft-particle and ambient-VFX minimum bar (**RI-VIS04 §13**); the Skyrim
test's shape and thresholds (**RI-WLD05 M22**); the windup/silhouette telegraph law
(**RI-AI02 §D**); the decal-matches-hitbox rule (**RI-MAG01 §E**).

Two structural debts are `canonical-recall`, confidence **medium**, and are lineage, not bar:
that Morrowind's spell effects were coloured per school and were the highest-fidelity particles
that engine could produce; and that Black Marsh's canonical material vocabulary is sap, chitin,
fungus and standing water (which RI-LOR05 and RI-VIS05 establish from `community-data`, and
which this item transposes onto effects rather than surfaces).

The three decisions most worth re-litigating with evidence:

1. **The `GREAT`-release chroma allowance of 14%.** It is the only number in this item that
   *raises* a RI-VIS05 limit, and it was chosen by argument (a spell is a light source and this
   world's palette already reserves high chroma for light sources) rather than by measurement.
   If a `GREAT` release frame fails RI-VIS05's own Skyrim test at 14%, the allowance is wrong
   and the effect must get smaller, not the budget bigger.
2. **`VFX-SOFT`'s 3.2× gradient threshold and `VFX-LIT`'s 25% luminance delta.** Both are new
   metrics defined here and neither has been calibrated against a real capture. They should be
   run against RI-VIS02's modern reference frames first, to establish what a *passing* build
   actually scores, before they are used to fail ours.
3. **The seven-school palette itself.** It is derived from RI-VIS05 §C's region emissives, which
   is the right method, but no ΔE2000 self-check has been run on it — see the amendment below.

### Amendments requested of other owners

- **RI-VIS05 / visual owner:** requesting that `corpus/80-methods/palette-selfcheck.mjs` be
  extended to cover §A2's 7 school palettes against the 6 forbidden VFX anchors, and that the
  results be committed here in the same format RI-VIS05 §C uses for its own self-check. **Until
  that runs, §A2's values are proposed-and-binding-but-unverified and A-M2 must be run by hand.**
  Also requesting §A2 be cross-referenced from RI-VIS05 §C as the emissive family's eighth
  member, so a palette amendment there cannot silently orphan the spells.
- **Harness owner (HARNESS §6):** requesting one new canonical viewpoint,
  **`spell_release_combat`** — gameplay camera transform, HUD off, fixed weather/time, captured
  at the `HEAVY` release frame (`startup + 1`) via `stepFrames` + `renderFrame`. Viewpoints are
  append-only in practice, so this adds a slot rather than changing one. Also requesting
  `getWorldStats()` be extended with `particlesLive` and `particleOverdraw`, without which
  F-M5's budget is unmeasurable and scores 0 fail-closed.
- **Methods owner:** `VFX-SOFT` and `VFX-LIT` are defined here and owed as implementations in
  `corpus/80-methods/` (suggested `m-mag05-vfx-metrics.mjs`), alongside RI-VIS03's existing
  metric suite.
- **RI-VIS01 / visual owner:** §A of that item is described as exhaustive and closed, and spell
  VFX currently resolves to `F16` (fidelity) with **no `P*` entry for effect *design language***.
  Requesting a new art-direction property — **`P10` — Effect and VFX design language** — so this
  item's Part 1 is judging a declared property rather than an `UNASSIGNED` one, which RI-VIS01 §A
  otherwise requires a corpus extension for.
