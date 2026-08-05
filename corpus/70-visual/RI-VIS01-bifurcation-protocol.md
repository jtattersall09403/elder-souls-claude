---
id: RI-VIS01
title: The bifurcation protocol — art direction and fidelity are judged separately, never together
kind: structure
side: neutral
judges: [visual.process.judgement, visual.process.declaration, visual.process.contamination, visual.artdirection, visual.renderer]
provenance: constructed
confidence: high
blind_pair: no
---

> **SIDE DECLARATION: this item is `neutral`.** It is the only VIS item permitted to hold
> both reference sets in the same file, and it holds them *only* to keep them apart. It
> cites no reference imagery of its own. Every other VIS item belongs to exactly one side
> and MUST refuse the other side's references.

## The bar

There are two entirely separate visual verdicts on this game and they share no evidence.
**Art direction** asks "is this Vvardenfell-grade strangeness transposed to Black Marsh, or
is it generic fantasy?" and is judged against Morrowind (2002) plus our transposition spec
in RI-VIS05. **Fidelity** asks "does this look like software rendered in the current
decade?" and is judged against Elden Ring, Skyrim SE/AE, RDR2 and equivalents per RI-VIS02
and the metrics in RI-VIS03. A 2002 screenshot is a *legitimate* art-direction reference
and a *hard error* as a fidelity reference. A modern AAA screenshot is a legitimate fidelity
reference and a hard error as an art-direction reference.

The bar is that this separation is **structural, not advisory**: a critic cannot produce a
visual verdict at all without first emitting a machine-checkable declaration naming which
side it is judging, and every citation it makes afterwards is validated against that
declaration. The failure mode this exists to kill is the **cardinal sin**: defending 2002
polygon counts, untextured surfaces, or a flat unlit look as "art direction". Morrowind's
art direction was not low fidelity — it was the *highest* fidelity Bethesda could buy in
2002, in service of a strange palette. We inherit the strangeness. We do not inherit the
triangle budget, the 256px textures, the vertex lighting, or the 200m draw distance.

## The reference artifact

### A. The partition — every visual property belongs to exactly one side

This table is exhaustive and closed. A property not listed is `UNASSIGNED` and the critic
MUST file a corpus extension (CORPUS-CONTRACT §5) before judging it.

| # | Property | Side | Judged against | Item |
|---|---|---|---|---|
| P01 | Palette / hue relationships / colour identity | ART | Morrowind + RI-VIS05 palette table | VIS05 |
| P02 | Silhouette language (buildings, props, creatures) | ART | Morrowind + RI-VIS05 silhouette vocabulary | VIS05 |
| P03 | Architectural vocabulary (forms, joinery, motifs) | ART | Redoran/Telvanni → xanmeer/Hist transposition | VIS05 |
| P04 | Creature design (anatomy, weirdness, non-Tolkien) | ART | Morrowind fauna → Black Marsh fauna | VIS05, VIS08 §D |
| P05 | Composition / framing / landmark placement | ART | Morrowind vista construction | VIS05 |
| P06 | Mood, alienness, "what world is this" | ART | Morrowind + the Skyrim test | VIS05, VIS07 |
| P07 | Flora *design* (what shape is a plant here) | ART | Vvardenfell fungal logic → marsh hybrid | VIS05 |
| P08 | Colour *grading intent* (warm/cool, tint direction) | ART | Morrowind region tints | VIS05 |
| P09 | UI/HUD visual language, fonts, iconography | ART | Morrowind UI → Argonian glyph transposition | VIS05 §H |
| F01 | Texture resolution, texel density, mip quality | FIDELITY | modern refs | VIS02, VIS03 M5 |
| F02 | Material response (PBR: roughness, metalness, normal, spec) | FIDELITY | modern refs | VIS03 M2/M8, VIS04 §1 |
| F03 | Lighting model (direct + indirect, IBL, bounce) | FIDELITY | modern refs | VIS03 M6, VIS04 §2 |
| F04 | Shadow quality (resolution, cascades, contact, softness) | FIDELITY | modern refs | VIS03 M6, VIS04 §3 |
| F05 | Ambient occlusion | FIDELITY | modern refs | VIS03 M6/M8, VIS04 §4 |
| F06 | Atmospheric scattering, fog, aerial perspective | FIDELITY | modern refs | VIS03 M10, VIS04 §6 |
| F07 | LOD, draw distance, pop-in | FIDELITY | modern refs | VIS03 M11, VIS04 §10 |
| F08 | Anti-aliasing / edge quality | FIDELITY | modern refs | VIS03 M5 (NYQ), VIS04 §8 |
| F09 | Post-processing (tonemap, bloom, exposure, colour space) | FIDELITY | modern refs | VIS03 M9, VIS04 §5/§7 |
| F10 | Animation smoothness, blending, IK, root motion | FIDELITY | modern refs | VIS08 |
| F11 | Geometric density (tri counts, silhouette smoothness) | FIDELITY | modern refs | VIS03 M4, VIS08 §B |
| F12 | Water rendering (reflection, refraction, normals, depth) | FIDELITY | modern refs | VIS03 M2/M5, VIS04 §9 |
| F13 | Foliage rendering (density, translucency, wind, shading) | FIDELITY | modern refs | VIS03 M4/M5, VIS04 §11 |
| F14 | Character/creature model quality (topology, weighting) | FIDELITY | modern refs | VIS08 |
| F15 | Sky rendering (model, gradient, sun/moon, banding) | FIDELITY | modern refs | VIS03 M7, VIS04 §12 |
| F16 | Particle/VFX quality (sorting, softness, resolution) | FIDELITY | modern refs | VIS04 §13 |

Mnemonic for the split: **ART owns the noun, FIDELITY owns the adjective.** *What* is a
Hist tree shaped like = ART. *How many triangles, what shader, what shadow* = FIDELITY.

### B. The mandatory declaration block

Before a critic cites **any** reference image, verbal spec, or metric target, it MUST emit
this block verbatim into its verdict. A verdict without it is **void** and scores 0.

```
=== VIS DECLARATION ===
JUDGEMENT SIDE: FIDELITY            # exactly one of FIDELITY | ART_DIRECTION
PROPERTIES UNDER JUDGEMENT: F02, F03, F05    # IDs from RI-VIS01 §A
PERMITTED REFERENCE SET: RI-VIS02 (modern)   # RI-VIS02 if FIDELITY, RI-VIS05 if ART_DIRECTION
FORBIDDEN REFERENCE SET: RI-VIS05 (Morrowind 2002)
CAPTURE: shots/w03/marsh_dusk_1920x1080.png  sha256:<hex>
=== END DECLARATION ===
```

Rules on the block:
- `JUDGEMENT SIDE` is singular. A critic judging both sides in one pass runs **two passes**
  and emits **two declarations**, with two independent scores that are never averaged.
- Every `PROPERTIES UNDER JUDGEMENT` entry must be from the same side column in §A.
  Mixing a `P*` and an `F*` in one declaration is an **automatic void**.
- The declaration is emitted *before* the first reference is looked at, not retrofitted.

### C. The cross-contamination check (CC-1 … CC-6)

Run after the verdict body is written, before the score is committed. Any HIT is an
**automatic fail of the item under review** (not a deduction), matching the AR-1/AR-2
severity in ARBITRATION.md §3.

| ID | Contamination | Detection | Verdict |
|---|---|---|---|
| CC-1 | 2002 reference cited under `SIDE: FIDELITY` | Verdict text mentions Morrowind, 2002, Vvardenfell, Telvanni, Redoran, Bethesda-era, "for its time", or cites RI-VIS05 while the declaration says FIDELITY | **FAIL, verdict void** |
| CC-2 | Modern AAA reference cited under `SIDE: ART_DIRECTION` | Verdict mentions Elden Ring, Skyrim SE, RDR2, Unreal, "AAA", "next-gen" or cites RI-VIS02/VIS03 while declaration says ART_DIRECTION | **FAIL, verdict void** |
| CC-3 | **The cardinal sin.** Low fidelity excused as style | Verdict contains any of: "stylised so it's fine", "intentionally low-poly", "matches Morrowind's look", "retro aesthetic", "art direction compensates", "charmingly simple", "the flatness is deliberate" — *applied to any `F*` property* | **FAIL, verdict void, and the piece under review fails** |
| CC-4 | Art direction excused by fidelity | "It's generic but it looks great", "the lighting carries it", "high fidelity so the setting reads" | **FAIL, verdict void** |
| CC-5 | Score fusion | A single combined "visual score" is reported anywhere | **FAIL** — the two scores are reported as an ordered pair `(ART x/10, FIDELITY y/10)` and never summed, averaged, or weighted |
| CC-6 | Reference-free assertion | A fidelity claim made with no metric from RI-VIS03 and no shot from RI-VIS02; or an art claim with no swatch/silhouette from RI-VIS05 | **FAIL** — "it looks bad" is not a verdict |

**CC-3 note.** This is the one the whole document exists for. Morrowind at release ran
`bump-mapped` water, per-pixel-lit interiors and the highest texture budget Bethesda could
ship. Its look is *strange*, not *cheap*. Any argument of the form "our untextured/unlit/
low-poly thing is Morrowind-like" is inverted history and is treated as fraud, not opinion.

### D. Adjudication when a property genuinely straddles

Four properties are commonly *claimed* to straddle. They do not. Pre-decided:

| Claim | Ruling |
|---|---|
| "Fog is mood, so it's art direction" | **SPLIT, and both are judged.** *That* the marsh is fogged, and its colour, is ART (P08). The scattering model, height falloff, depth-correctness, and whether it is per-vertex or analytic is FIDELITY (F06). Two declarations. |
| "Low-poly silhouettes are our silhouette language" | **FIDELITY (F11).** Silhouette *vocabulary* (P02) is the set of shapes; the number of segments used to describe a curve is fidelity. A Telvanni tower is a bulbous organic mass in both 2002 and 2026; only the tessellation differs. |
| "Our palette is muted, that's why contrast is low" | **SPLIT and the fidelity side still applies.** A muted palette (P01) is ART and can pass. Low *local* contrast (RI-VIS03 M2/M8) is FIDELITY and fails independently. Muted ≠ flat: a muted scene still has full luminance range and full material variation. |
| "Water is a blue plane because Morrowind's was simple" | **FIDELITY (F12), and CC-3 fires.** |

### E. Scoring is a pair, forever

```
VISUAL VERDICT (wave N, piece P)
  ART DIRECTION : 6/10   biggest gap: <one thing>
  FIDELITY      : 3/10   biggest gap: <one thing>
  SHIP GATE     : min(ART, FIDELITY) >= 6   ->  BLOCKED (fidelity 3)
```

The ship gate is `min()`, never `mean()`. A gorgeous generic-fantasy game fails. A strange
untextured game fails. Both must clear independently.

## Comparison method

A critic executes this before any other VIS item. It is the entry point.

1. **Capture.** Render headless and screenshot per `corpus/80-methods/capture-shots.md`
   (harness owner). Minimum capture set per wave, all 1920×1080, PNG, no UI overlay unless
   the shot is a UI shot:
   `exterior_marsh_noon`, `exterior_marsh_dusk`, `interior_rootway`, `xanmeer_vista`,
   `combat_midfight`, `character_closeup`, `water_edge`, `foliage_dense`.
   Record `sha256` of every PNG in the declaration.
2. **Partition the question.** For each thing you intend to say, look it up in §A and get
   its `P*`/`F*` ID. If it is not in §A → stop, file a corpus extension, then continue.
3. **Split into two passes.** Group the `P*` IDs into an ART pass, the `F*` IDs into a
   FIDELITY pass.
4. **Emit declaration for pass 1**, judge it using **only** that side's item set, write the
   verdict body, then emit declaration for pass 2 and repeat. Do not read the other side's
   items during a pass — if the agent is a single context, it MUST re-read only the
   permitted item file and MUST NOT quote from memory of the other file.
5. **Run CC-1 … CC-6** as a literal text scan over both verdict bodies:
   ```bash
   node corpus/80-methods/cc-scan.mjs verdicts/w03-visual.md
   # exits 1 and prints the offending line on any CC hit
   ```
   `cc-scan.mjs` (harness owner to implement) holds the CC-1/CC-2/CC-3/CC-4 phrase lists
   above as case-insensitive regexes, scoped to the declaration block that encloses each
   line. It is a lint, not a judge: a hit is a prompt to re-read, and a confirmed hit voids.
6. **Report the pair** in the RI-VIS01 §E format. Never a single number.

## Scoring

This item scores the **critic**, not the game. It is the meta-check.

| Score | Meaning |
|---|---|
| 10 | Two declarations emitted, disjoint property sets, cc-scan clean, two independent scores reported as a pair with a named single biggest gap on each side |
| 7 | Declarations present and disjoint, cc-scan clean, but one side's gap is vague ("needs polish") |
| 4 | Declarations present but a property appears in the wrong pass, or a reference set is cited without a declaration |
| 0 | **Any of:** missing declaration; a CC hit confirmed; a single fused visual score; a fidelity claim defended by a Morrowind reference |

**Failure threshold: < 7 voids the visual verdict for that wave.** The wave is re-judged by
a fresh critic. A voided critic's numbers may not be carried forward, quoted, or averaged
into anything.

**What we lose looks like:** a wave verdict reading "Visuals: 6/10 — has a nice Morrowind
feel, a bit rough around the edges but that suits the style." That sentence contains a
fused score (CC-5), an art claim with no swatch (CC-6), and the cardinal sin (CC-3). It is
worth zero and the wave ships blind.

## How we lose

- **The cardinal sin, in its natural habitat.** A build lands with untextured flat-shaded
  geometry. The critic, primed on "Morrowind", writes "captures the 2002 Elder Scrolls
  aesthetic". Fidelity is never measured. Three waves later nobody remembers that the game
  has no textures, because the corpus recorded a 6/10.
- **One critic, one pass, one number.** The agent reads both reference sets in one context,
  forms a gestalt impression, and emits "visual: 5/10". No declaration, no partition, no
  metric. Everything downstream is vibes.
- **Retroactive declaration.** The critic writes the verdict first and pastes a declaration
  on top afterwards to satisfy the lint. Detectable only by ordering: the declaration must
  cite the capture `sha256` before the body references any specific shot region.
- **Property drift.** A new visual feature (subsurface scattering on Hist sap, say) appears
  and is judged without an §A entry, so it lands on whichever side is convenient — always
  the side where it passes.
- **`min()` quietly becomes `mean()`.** Someone notices the ship gate is blocking and
  "reasonably" averages 8 and 3 into 5.5. The game ships looking like a WebGL tutorial with
  good taste. This is the single most likely way this whole area fails.
- **The lint becomes the judge.** cc-scan.mjs passes because the critic avoided the banned
  words while making the banned argument. The lint is a tripwire; the human-readable rule in
  §C is the law.
- **Two passes, same eyes.** The same agent runs both passes back to back and the ART pass
  contaminates the FIDELITY pass by memory. Mitigation: RI-VIS06 blind protocol runs the
  fidelity comparison with a *fresh* agent that has never seen RI-VIS05.

## Provenance note

`provenance: constructed`, `confidence: high`. Nothing here is recalled from an upstream
source; it is a protocol authored for this project. Its authority derives from
ARBITRATION.md §4, which is binding doctrine and which this item operationalises — §4 states
the bifurcation and the hard-error rule; everything in this file (the §A partition, the
declaration block, CC-1…CC-6, the `min()` ship gate) is our construction and is binding
because it is measurable, per CORPUS-CONTRACT §3.

The §A partition was built by enumerating every visual property named in the brief and in
ARBITRATION.md §4 and forcing each to one column; the four §D straddle rulings were the only
genuinely contested assignments and are recorded as rulings so they are not re-litigated.
`cc-scan.mjs` does not exist yet — it is specified here and owed by the methods owner; until
it exists, §C is run by hand and the critic states "cc-scan: manual" in its verdict.
