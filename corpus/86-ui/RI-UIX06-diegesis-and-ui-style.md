---
id: RI-UIX06
title: UI diegesis and the UI bifurcation — style is art direction, rendering quality is fidelity
kind: structure
side: neutral
judges: [ui.style.diegesis, visual.process.declaration]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SIDE DECLARATION: this item is `neutral`, for the same reason RI-VIS01 is.** It is the only
> UI item permitted to hold both reference sets, and it holds them **only to keep them apart**.
> It cites no reference imagery of its own. Every other UI item belongs to one side and must
> refuse the other's references.
>
> **This item files a corpus extension against RI-VIS01 §A** (CORPUS-CONTRACT §5). RI-VIS01 §A
> assigns `P09 — UI/HUD visual language, fonts, iconography` to ART. It assigns **nothing** to
> UI rendering quality, and §A is declared "exhaustive and closed: a property not listed is
> `UNASSIGNED` and the critic MUST file a corpus extension before judging it." Text crispness,
> DPI scaling and compositing correctness on a UI surface are therefore currently unjudgeable.
> §C below proposes **F17, F18, F19** and **CC-7** for append to RI-VIS01. ~~Until they are
> appended, a critic judging UI rendering quality is out of process and its verdict is void.~~
> **APPENDED wave 0 (corpus-audit): F17–F19 are in RI-VIS01 §B and CC-7 is in §C.** A critic
> judging UI rendering quality is now in process.

## The bar

There are **two** verdicts on this game's interface and they share no evidence.

**UI style** asks: *does this interface belong to Black Marsh?* It is judged against Morrowind
and RI-VIS05 §H. A Morrowind menu is an object — a scroll, a carved frame, a paper with a
texture — made of materials that exist in its world. Ours must be made of **chitin, root, ink,
bone, wet parchment, resin, reed and shell**, because those are the materials of a marsh
civilisation that builds with what grows and what it kills. The failure state is a
**bootstrap panel**: a rounded rectangle with a drop shadow, a system sans-serif, a blue accent,
and a 1 px hairline border. That interface belongs to a web dashboard. It would look identical
in a game about spaceships.

**UI rendering quality** asks: *is this interface rendered like software from the current
decade?* It is judged against modern references only. Crisp glyph edges at every device pixel
ratio. Text that is vector or SDF, never a bitmap upscaled from a 1024 px canvas. A layout that
survives 1280×720 and 3840×2160 without clipping, overlapping or blurring. Correct alpha
compositing with no dark fringes, correct sRGB, no banding across a panel gradient.

**The two are independent and both are load-bearing, and the entire reason this item exists is
that one specific sentence will otherwise be said out loud:** *"the text is soft because it's
meant to look like old wet parchment."* That sentence is RI-VIS01 §C's **cardinal sin** (CC-3)
transposed to the interface — low fidelity excused as style — and it is *more* seductive here
than in the world, because a UI genuinely can be art-directed toward age, damp and hand-work, and
those are genuinely blurry-looking things. Age is a texture. Blur is a bug. **A weathered
parchment panel must be rendered at 4K crispness, with the weathering in the albedo and not in
the sampler.**

RI-VIS01's mnemonic transposes exactly: **ART owns the noun, FIDELITY owns the adjective.** *A
frame made of lashed root* = ART. *How many device pixels its edge resolves to* = FIDELITY.

## The reference artifact

### §A — The material vocabulary (ART, P09)

Judged against Morrowind + RI-VIS05 §H, under `JUDGEMENT SIDE: ART_DIRECTION` only.

| Material | Where it belongs | Reads as |
|---|---|---|
| **Chitin** | frames, borders, bar casings, the HUD's bar housings | segmented, iridescent, slightly asymmetric plates; the joins are visible |
| **Root** | menu frames, the journal's binding, book covers | lashed, fibrous, grown-not-cut; corners are knots, not mitres |
| **Ink** | all body text, the journal, books | iron-gall on damp fibre; slight bleed at stroke ends (**a glyph property, not a blur** — see CC-7) |
| **Wet parchment / bark-paper** | journal pages, book pages, letters | fibrous, translucent at edges, cockled |
| **Bone** | dividers, tick marks, level-up attribute pips, buttons | worked, polished, scrimshawed |
| **Resin / amber** | status buildup meters, the fill of the magic bar | translucent, viscous, lit from within |
| **Reed weave** | backgrounds, inventory list separators | woven, directional, matte |
| **Shell inlay** | selection highlights, the lock-on reticle, accents | nacreous, catching light along one axis |
| **Mud-slip / fired clay** | container panels, the Clay Moor's own UI variants | matte, crazed glaze, thumbprints |

**Rules.**

- **A1** — ≥ **6** of the nine materials are present across the full UI set (HUD, inventory,
  journal, book, dialogue, level-up).
- **A2** — **No element is a plain rectangle.** Every panel edge is a material edge: a root
  lashing, a chitin plate seam, a torn paper edge. Uniform corner radii are the signature of a
  UI kit and are forbidden.
- **A3** — The typeface is **drawn for this world** (RI-VIS05 §H's Argonian glyph
  transposition), not a system or web font. Two faces maximum: one for body prose, one for
  numerals and labels.
- **A4** — The palette is drawn from `corpus/50-world/regions.json` `palette_hex` and RI-VIS05's
  palette table. No colour appears in the UI that does not appear in the world.
- **A5** — **Nothing glows for UI reasons.** Emissive is a material property (resin, shell) and
  is used where those materials are, not as a focus ring.
- **A6** — Iconography is **objects**, not pictograms. A potion is a drawn stoppered gourd, not a
  flask glyph.

### §B — The forbidden UI-kit set (ART, hard fails)

| # | Forbidden | Why it fails |
|---|---|---|
| G1 | Uniform rounded-rectangle panels with a drop shadow | the card. The single most identifiable UI-kit form |
| G2 | System/web font stacks (Arial, Helvetica, Roboto, Inter, `sans-serif`, `system-ui`) | A3 |
| G3 | A blue accent colour (`#007bff` family), or any hue not in the world palette | A4 |
| G4 | 1 px hairline borders | a screen-space unit, not a material |
| G5 | Flat material-design / Font Awesome / Feather iconography | A6 |
| G6 | Hover states that lighten a fill, focus rings, CSS transitions on colour | A5 |
| G7 | Tab bars, hamburger menus, breadcrumbs, toggle switches, sliders with a track and a thumb | web furniture |
| G8 | Progress bars with a percentage numeral | RI-UIX04 Q4 as well |
| G9 | Modal dialogs with an OK/Cancel button pair, right-aligned | |
| G10 | Any element whose appearance is unchanged if the game's setting changed | the actual test, of which G1–G9 are instances |

### §C — **Corpus extension: proposed append to RI-VIS01 §A and §C**

The following are submitted for append by the visual-area owner. They are written in RI-VIS01's
own table format so they can be pasted in.

**Append to RI-VIS01 §A (the partition):**

| # | Property | Side | Judged against | Item |
|---|---|---|---|---|
| **F17** | **UI text raster fidelity** — glyph edge sharpness, subpixel/greyscale AA quality, vector-or-SDF vs upscaled bitmap, effective text height in device pixels | FIDELITY | modern refs | **RI-UIX06 §D** |
| **F18** | **UI scaling and layout integrity across resolutions and DPI** — 1280×720 → 3840×2160, deviceScaleFactor 1 and 2; clipping, overlap, overflow, 9-slice corner distortion, icon mip quality | FIDELITY | modern refs | **RI-UIX06 §E** |
| **F19** | **UI compositing correctness** — alpha fringing, premultiplication, sRGB/linear correctness on blends, gradient banding on panels | FIDELITY | modern refs | **RI-UIX06 §F** |

**Append to RI-VIS01 §C (the cross-contamination checks):**

| ID | Contamination | Detection | Verdict |
|---|---|---|---|
| **CC-7** | **The diegetic-blur excuse.** Low UI rendering quality excused as UI art direction | Verdict contains any of: "meant to look like old parchment", "the softness is the wet-paper look", "hand-drawn so it shouldn't be crisp", "the blur is atmospheric", "weathered look", "it's supposed to look aged", "the texture reads as damp", "diegetic so fidelity doesn't apply" — *applied to any of F17, F18, F19* | **FAIL, verdict void, and the piece under review fails** |

**Append to RI-VIS01 §D (straddle rulings):**

| Claim | Ruling |
|---|---|
| "Our ink bleeds at the stroke ends, so soft glyph edges are the style" | **SPLIT, and both are judged.** Ink bleed is a *glyph outline* property — it belongs in the font's own contours (P09/ART) and survives at any resolution. Edge *softness measured across a stem's luminance transition* is F17 and fails independently. A bled serif rendered crisply is correct; a crisp serif rendered blurrily is a defect. The test that separates them: render at 4× and downsample — real bleed persists, raster blur disappears. |
| "The panel is meant to look worn, so the 9-slice stretching is fine" | **FIDELITY (F18), and CC-7 fires.** |
| "It's a low-res world so the UI should be low-res" | **FIDELITY (F17/F18), and CC-3 fires** — this is the original cardinal sin, unchanged. |

### §D — F17 metrics (FIDELITY)

| # | Metric | Target | Fail |
|---|---|---|---|
| M-F17.1 | **Glyph stem transition width** — 10%→90% luminance across a vertical stem of body text, in **device** pixels | ≤ **1.5 px** | > 2.5 px |
| M-F17.2 | Same, captured at `deviceScaleFactor: 2` | ≤ **1.5 device px** | > 2.5 (⇒ UI is a DPR-1 surface upscaled) |
| M-F17.3 | Text rendering path | vector (DOM/SVG) or SDF atlas | a canvas bitmap sampled with `LINEAR` at non-1:1 scale |
| M-F17.4 | Effective body text height | ≥ 18 CSS px @1080p (RI-UIX05 B4) and ≥ 36 device px at DPR 2 | < 14 |
| M-F17.5 | Glyph AA quality | greyscale or subpixel AA present; no 1-bit aliasing on curves | hard-aliased glyph edges |

**M-F17.2 is the whole point of F17.** A UI drawn into a fixed-size canvas texture and blitted to
the screen passes M-F17.1 at DPR 1 and fails catastrophically at DPR 2 — which is what every
retina/4K player sees. It is invisible on a 1080p dev monitor.

### §E — F18 metrics (FIDELITY)

Captured at 1280×720, 1920×1080, 2560×1440, 3840×2160, each at DPR 1 and DPR 2.

| # | Metric | Target | Fail |
|---|---|---|---|
| M-F18.1 | Text clipping | **0** elements whose rendered text bounding box exceeds its container | ≥1 |
| M-F18.2 | Element overlap | 0 unintended overlaps of interactive elements | ≥1 |
| M-F18.3 | Page overflow | no horizontal overflow at any resolution | any |
| M-F18.4 | Screen-fraction stability | each element's area as a fraction of screen is constant to **±10%** across resolutions | > ±25% (fixed-px layout) |
| M-F18.5 | 9-slice corner distortion | corner regions' aspect ratio preserved to ±5% | corners stretched (a stretched corner is the visual signature of a naive 9-slice) |
| M-F18.6 | Icon sampling | icons drawn at ≥1:1 texel:pixel, mipped, no visible bilinear mush | icons upscaled >1.5× from source |

### §F — F19 metrics (FIDELITY)

| # | Metric | Target | Fail |
|---|---|---|---|
| M-F19.1 | Alpha fringing | no dark or light halo at UI edges over a mid-grey background; edge pixel chroma deviation ≤ 3 ΔE | visible halo (non-premultiplied alpha) |
| M-F19.2 | Composite correctness | a 50%-opacity panel over a known background composites to the predicted sRGB value within **ΔE ≤ 3** | ΔE > 8 (blending in the wrong colour space) |
| M-F19.3 | Panel gradient banding | ≥ **7 effective bits** per channel across the largest UI gradient (method as RI-VIS03 M7's sky banding metric) | ≤ 5 bits |
| M-F19.4 | Overdraw | UI overdraw ≤ 3× screen area | > 8× |

### §G — The "could this be Bootstrap?" test (ART)

The UI analogue of RI-VIS07, and it works the same way: it is the cheapest instrument and the
only one that measures the *whole* interface rather than element-by-element conformance.

**Judge:** fresh agent context, one per screen, no project material, has not read this file or
RI-VIS05.
**Stimulus:** one 1920×1080 PNG of a single UI screen, **with the game world cropped out or
blacked**, metadata stripped, neutral temp path, filename `ui.png`. Cropping the world is
essential — a beautiful marsh behind a bootstrap panel rescues the panel.

**Prompt (verbatim; do not paraphrase, do not soften):**

```
Look at this user interface.

Answer these questions. Guess even when unsure.

1. What is this interface from?
2. If you don't know, what kind of thing is it — a game, a website, an
   app, a tool? Name something specific.
3. Name three other things this interface could plausibly belong to.
4. What is it made of? Name the physical materials it appears to be
   made from, if any.
5. Is there anything in this interface you have never seen in an
   interface before? One sentence, or "no".

Answer in exactly this format:

FROM: <name, or "don't know">
KIND: <specific>
COULD ALSO BE: <a>, <b>, <c>
MADE OF: <materials, or "nothing physical">
NEVER SEEN BEFORE: <one sentence, or "no">
```

**Answer key.**

| Result | Condition |
|---|---|
| **HARD FAIL** | `KIND` is a website, web app, dashboard, mobile app, or admin panel; or `MADE OF: nothing physical`; or `COULD ALSO BE` names a UI framework or design system |
| **FAIL** | `KIND` is "a generic fantasy RPG menu" / "an RPG inventory screen"; or `FROM` names an existing game; or `NEVER SEEN BEFORE: no` |
| **PASS** | `FROM: don't know`, `KIND` describes rather than categorises, `MADE OF` names ≥2 of §A's materials, `NEVER SEEN BEFORE` names a designed element |
| **STRONG PASS** | PASS, and `MADE OF` names ≥3 §A materials including at least one the judge had to describe because it has no common name |

**Runs:** six screens — HUD-in-combat, inventory, journal, book, dialogue, level-up. Six fresh
judges. **Wave roll-up is the worst result**, as RI-VIS07 §C.

`MADE OF: nothing physical` being a hard fail is the sharpest line in this item: it is the exact
machine-readable form of "this is a UI kit, not an object".

### §H — Scoring is a pair, forever

Per RI-VIS01 §E, applied to the interface:

```
UI VERDICT (wave N)
  UI ART DIRECTION  : 6/10   biggest gap: <one thing>
  UI FIDELITY       : 3/10   biggest gap: <one thing>
  SHIP GATE         : min(ART, FIDELITY) >= 6  ->  BLOCKED (fidelity 3)
```

**`min()`, never `mean()`.** A gorgeous chitin interface rendered as a blurry upscaled bitmap
fails. A pin-sharp bootstrap panel fails. Reporting a single fused "UI score" anywhere is
**CC-5** and voids the verdict.

## Comparison method

Two passes, two declarations, run in this order. **Do not read the other side's items during a
pass** (RI-VIS01 §Comparison method step 4). Ideally the FIDELITY pass is run by a *fresh agent
that has never read §A/§B* — the same mitigation RI-VIS06 applies to the world.

**Pass 1 — ART_DIRECTION.**

1. Emit the RI-VIS01 §B declaration:
   ```
   === VIS DECLARATION ===
   JUDGEMENT SIDE: ART_DIRECTION
   PROPERTIES UNDER JUDGEMENT: P09
   PERMITTED REFERENCE SET: RI-VIS05 (Morrowind) §H
   FORBIDDEN REFERENCE SET: RI-VIS02 (modern), RI-VIS03 metrics
   CAPTURE: shots/w<N>/ui_*.png  sha256:<hex each>
   === END DECLARATION ===
   ```
2. Capture the six UI screens with `setUIVisible(true)` and the world blacked
   (`--blank-world` renders the scene to flat black so only the UI layer remains):
   ```bash
   node tools/harness/shoot.mjs --viewpoints ui-screens --ui-visible --blank-world \
        --out reports/runs/<runId>/shots-ui
   ```
3. **A4 palette conformance:** `node corpus/80-methods/palette-conformance.mjs --in shots-ui
   --palette corpus/50-world/regions.json` — every UI hue must have a match in the world palette
   within ΔE ≤ 10, and the `ForbiddenHits` list from RI-VIS05 applies.
4. **A2/G1 panel-form check:** detect axis-aligned rectangles with uniform corner radii in the
   UI layer; count them. Target **0**.
5. **A3/G2 typeface:** read the computed font families from `getUIState().fonts`; assert none is
   in the G2 forbidden list and that the faces are project assets.
6. **A1/A6 material and icon census:** manual, recorded as a table of which of the nine
   materials appear on which screen, with a crop per claim.
7. **§G Bootstrap test:** six fresh judges. Record answers verbatim.

**Pass 2 — FIDELITY.**

8. Emit a second declaration, `JUDGEMENT SIDE: FIDELITY`, `PROPERTIES UNDER JUDGEMENT: F17, F18,
   F19`, `PERMITTED REFERENCE SET: RI-VIS02 (modern)`, `FORBIDDEN: RI-VIS05`.
9. Capture the same six screens at 4 resolutions × 2 DPRs = 48 shots.
   ```bash
   node tools/harness/shoot.mjs --viewpoints ui-screens --ui-visible \
        --scales 1280x720,1920x1080,2560x1440,3840x2160 --dpr 1,2 \
        --out reports/runs/<runId>/shots-ui-fidelity
   node tools/metrics/ui-metrics.mjs --in reports/runs/<runId>/shots-ui-fidelity
   ```
   `ui-metrics.mjs` computes §D, §E and §F. It is owed by the methods owner and does not exist.
10. **M-F17.3 path check:** from `getUIState().textRenderPath ∈ {'dom','svg','sdf','canvas-bitmap'}`
    plus the DPR-2 measurement, which is the check that cannot be self-reported wrongly.
11. **M-F19.2 composite check:** render a 50% panel over a known flat colour via
    `setWeather('test_flat')` or a debug backdrop; predict and compare.

**Both passes complete → run the contamination scan.**

12. ```bash
    node corpus/80-methods/cc-scan.mjs verdicts/w<N>-ui.md
    ```
    with **CC-7's phrase list added** to `cc-scan.mjs`. Until CC-7 is appended to RI-VIS01 §C and
    the lint updated, run §C by hand and state `cc-scan: manual (CC-7 pending)` in the verdict.

13. **Report the pair** per §H. Never a single number.

## Scoring

**Two independent native scales. They are never combined.**

**UI ART (P09):**

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| AD1 | Material presence (A1) | ≥6 of 9 materials across the UI set | ≤2 |
| AD2 | No plain rectangles (A2) | 0 uniform-radius axis-aligned panels | ≥1 per screen (G1) |
| AD3 | Typeface (A3, G2) | project faces, ≤2 | a system/web font stack |
| AD4 | Palette (A4, G3) | every hue ΔE ≤10 to the world palette; 0 ForbiddenHits | a UI-blue accent |
| AD5 | Iconography and emissive (A5, A6, G5, G6) | objects, no focus rings | pictogram icon set |
| AD6 | Forbidden UI furniture (G7–G9) | 0 hits | tab bars / OK-Cancel modals |
| AD7 | **Bootstrap test (§G)** | worst-of-six ≥ PASS | any HARD FAIL |

Native **/7**. §G caps the ART score exactly as RI-VIS07 caps the world's: STRONG PASS → no cap;
PASS → cap 8; FAIL → cap 5; HARD FAIL → **cap 2**.

**UI FIDELITY (F17/F18/F19):**

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| FD1 | Glyph sharpness at DPR 1 (M-F17.1) | ≤1.5 device px | >2.5 |
| FD2 | **Glyph sharpness at DPR 2 (M-F17.2)** | ≤1.5 device px | >2.5 — the upscaled-canvas signature |
| FD3 | Text path and size (M-F17.3–5) | vector/SDF, ≥18 px, AA present | canvas bitmap at non-1:1 |
| FD4 | Layout integrity (M-F18.1–3) | 0 clipping, 0 overlap, 0 overflow at all 8 capture configs | any at 1920×1080 |
| FD5 | Scaling (M-F18.4–6) | ±10% screen fraction; corners undistorted; icons ≥1:1 | fixed-px layout (>±25%) |
| FD6 | Compositing (M-F19.1–2) | no fringing; ΔE ≤3 | ΔE >8 |
| FD7 | Banding and overdraw (M-F19.3–4) | ≥7 bits; ≤3× | ≤5 bits |

Native **/7**.

**Band translation for each side independently** (SCORING §1.2): 7/7 → meets the bar, ceiling 8.
5–6 → below bar, remedy required, ceiling 6. ≤4 → loses outright, ceiling 4. Any hard fail on a
side caps **that side** at 2.

**Ship gate:** `min(UI_ART, UI_FIDELITY) ≥ 6`.

**Unimplemented scores 0 on both sides.** A UI that does not exist is not "art direction pending".

**What we lose looks like:**
```
=== VIS DECLARATION === JUDGEMENT SIDE: ART_DIRECTION  PROPERTIES: P09 ...
AD1 materials: parchment only (1 of 9)
AD7 Bootstrap test, inventory screen:
    FROM: don't know
    KIND: a web app, maybe an admin dashboard or an inventory management tool
    COULD ALSO BE: Notion, a Bootstrap admin template, any Unity game with the
                   default UI package
    MADE OF: nothing physical - flat panels and rounded rectangles
    NEVER SEEN BEFORE: no
    => HARD FAIL. ART capped at 2.

=== VIS DECLARATION === JUDGEMENT SIDE: FIDELITY  PROPERTIES: F17, F18, F19 ...
FD1 stem transition @DPR1: 1.4 px   PASS
FD2 stem transition @DPR2: 4.1 px   HARD FAIL  (textRenderPath: canvas-bitmap)
FD5 screen fraction drift 1280->3840: -61%  (fixed-px layout)
=> FIDELITY capped at 2.

SHIP GATE: min(2, 2) = 2 -> BLOCKED.
And in the draft verdict, deleted before submission:
  "the soft text suits the wet-parchment look" -> CC-7. Verdict would be void.
```

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 5 / 7 checks on the worse side | 6 / 7 checks on the worse side | 7 / 7 checks on the worse side |

**Aggregation (a property of this item, not of the critic):** min over the two independent native scales, which are never combined; any hard fail on a side caps that side at 2.

## How we lose

- **CC-7, exactly as written.** Someone measures 4.1 px stem transitions at DPR 2, looks at the
  screen, thinks "well, it *is* meant to be damp old paper", and writes the sentence. The
  measurement is then never taken again, and every 4K player reads the game through a blur. This
  is the single failure this item was written to prevent, and the reason CC-7 needs to exist as a
  *named, scannable* contamination rather than as good intentions.
- **The UI is a canvas texture.** Overwhelmingly the most likely fidelity failure in a Three.js
  game: the interface is drawn into a `CanvasTexture` at a fixed size and mapped to a quad or an
  orthographic overlay. It is fast, it composites with the scene for free, and it is a bitmap. It
  looks perfect on the 1080p dev machine and mushy on everything else. **FD2 is the only check
  that catches it**, and it is one number.
- **The two scores get averaged.** ART 8, FIDELITY 3, "UI: 5.5/10, needs polish". CC-5, and
  RI-VIS01 §How-we-lose already names `min()` quietly becoming `mean()` as the most likely way
  the whole visual area dies. It is *more* likely here, because a UI feels like one artifact in a
  way a world does not — it is one screen, one person made it, and reporting two numbers about it
  feels pedantic.
- **One agent, both passes, one impression.** The agent that has just admired the chitin frames
  measures glyph sharpness charitably. RI-VIS01 §Comparison step 4 forbids reading the other
  side's items during a pass; the stronger mitigation — a fresh agent for the FIDELITY pass — will
  be skipped because it costs a context. Recommended: run FIDELITY *first*, before anyone has
  seen the art direction spec.
- **The world is left in the shot.** The Bootstrap test is run against a screenshot with the
  marsh visible behind a translucent panel, the judge answers "a fantasy game", and a bootstrap
  panel passes on the strength of the background. `--blank-world` exists for this and will be
  the first flag someone drops as unnecessary.
- **Diegesis is claimed and not built.** The materials are named in a design doc, one parchment
  texture is applied to every panel, and AD1 passes on a technicality because parchment is on the
  list. The census in step 6 requires a **crop per material claim** so that "we have chitin" has
  to be a picture of chitin.
- **F17/F18/F19 are proposed here and never appended to RI-VIS01.** Then §A of RI-VIS01 remains
  closed and UI rendering quality remains `UNASSIGNED`, so a critic judging it is out of process
  and its verdict is void — meaning UI fidelity is never legitimately scored at all, while
  everyone believes it is. This item's extension is not paperwork; it is what makes the FIDELITY
  half of the pair admissible.
- **Legibility gets scored here.** Line length, words per page and leading are **RI-UIX05 §A**,
  and the contrast on the stamina bar is **RI-UIX01 §D3**. Both are layout-correctness properties
  and belong to neither side of the bifurcation. Pulling them in here fuses three categories
  instead of two, and the symptom is a "UI score" that moves when the book's column width
  changes.

## Provenance note

`provenance: constructed`, `confidence: high`.

Nothing here is recalled from an upstream source. The item's authority derives from
**ARBITRATION §4** (visual judgement is bifurcated; citing the wrong reference set is a hard
error) and from **RI-VIS01**, which operationalises §4 and whose §A explicitly requires a corpus
extension for any unassigned property. F17/F18/F19 and CC-7 are that extension, written in
RI-VIS01's own formats for direct append.

The **material vocabulary in §A** is constructed from `corpus/50-world/regions.json` — chitin,
root, ink, bone, reed and clay are the materials that file already attributes to Black Marsh's
regions and architecture — and from RI-VIS05 §H's Argonian glyph transposition. It is a
transposition, not a recall: Morrowind's UI was carved wood, paper and Dunmer glyphwork, and the
*principle* being inherited is that the interface is made of the world's materials, not that it
is made of Morrowind's.

**Constructed thresholds:** the ≤1.5 device px stem transition (the number that decides FD1/FD2),
the ±10% screen-fraction stability, ΔE ≤3 composite and ΔE ≤10 palette tolerances, ≥7 effective
bits, ≤3× overdraw, ≥6 of 9 materials. Of these, **1.5 px is the one that matters and the one to
challenge**: it is chosen because well-rendered vector text at DPR 1 typically resolves a stem
edge in about one pixel plus antialiasing, and an upscaled bitmap resolves it in three to five —
so the threshold sits in a wide empty gap between two clearly separated populations rather than
on a continuum. That is why confidence is `high` despite the number being invented: FD2 does not
need the threshold to be right to give the right answer, and the same is true of AD7, FD3 and
FD5, none of which have a tunable at all.

**Owed and non-existent:** `tools/metrics/ui-metrics.mjs`, the `ui-screens` viewpoint set, the
`--blank-world` flag on `shoot.mjs`, and the CC-7 phrase list in `corpus/80-methods/cc-scan.mjs`.
Until they exist this item is `unmeasurable` ⇒ **0** on the FIDELITY side, which is the correct
and intended behaviour.

**Harness additions requested:** `getUIState()` (RI-UIX01) extended with
```js
fonts: [{family, size_px, weight, path}],     // A3 / G2
textRenderPath: 'dom'|'svg'|'sdf'|'canvas-bitmap',   // M-F17.3
overdraw: number                              // M-F19.4
```
plus `setUIVisible` promoted to mandatory-for-UI-items, and the screenshot contract
(HARNESS.md §6) amended to permit **`deviceScaleFactor: 2`** captures for the UI viewpoint set.
That amendment is required by F17 and is a genuine change to a contract that ~~currently pins~~
pinned `deviceScaleFactor: 1` for commensurability — the resolution is that UI shots form their own
viewpoint set with their own pinned configuration and are never compared against world shots.
**APPLIED wave 0 (corpus-audit): `HARNESS.md` §6 now carries exactly that split** — a `world`
set at 1920×1080 DPR 1 (12 poses, unchanged) and a `ui` set at 4 resolutions × DPR 1 and 2, with
neither admissible as evidence for the other's metrics. FD2 is measurable as of that edit.
