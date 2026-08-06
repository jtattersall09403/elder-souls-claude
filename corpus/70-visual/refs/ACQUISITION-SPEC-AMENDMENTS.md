# Acquisition spec — amendments (user direction, wave 0)

These **override** `docs/REFERENCE-IMAGE-REQUEST.md` where they conflict. They exist because the
original spec was written under a proxy that blocked nearly every image host, and it was
consequently stricter than it needed to be about what counts as usable.

## A1 — HUD is acceptable on modern fidelity references

**Superseded:** §5a's rule confining HUD-bearing images to `modern/hud/`, "kept, never compared".

**Now:** a HUD-bearing frame is a **first-class fidelity reference**. Game HUDs occupy screen
edges and corners; the lighting, materials, foliage, water and atmospherics we measure are in the
middle of the frame and are unaffected by an overlay.

Consequences, all binding:

1. HUD-bearing images live in their **profile folder**, not in `modern/hud/`. Set `"has_hud": true`.
2. **Critics must ignore the HUD** when judging fidelity, and must say so in the verdict.
3. **The metrics battery must mask it.** `tools/metrics/lib/vis03.mjs` gains a `HUD_MASK`:
   exclude a configurable border band (default: outer 12% on each edge) plus any detected
   high-saturation, high-contrast, temporally-static overlay region, from `FG_MASK` and from every
   band that consumes it. A HUD left unmasked inflates M4 edge density and M2 local contrast — so
   this amendment is **not free**, and until the mask exists, `has_hud: true` images are measured
   with a recorded caveat rather than silently.
4. **Still excluded:** frames where the HUD or a menu covers the *centre* of the image, and any
   frame whose subject is illegible behind an overlay.

## A2 — Menus and UI are wanted, on both sides

**Superseded:** the blanket exclusion of menu screenshots.

**Now they are a requirement, for two different reasons:**

- **Morrowind (art direction).** We are matching *all* of Morrowind's in-game UI and menu art
  direction — inventory, the dialogue topic list, the journal, the map, the character sheet,
  spellmaking, barter, the book reader, tooltips, the loading screens. `RI-A12` is currently
  filled by OpenMW's MyGUI layout XML, which gives structure and measurements but **no pixel of
  the original art** — no bevel, no sheen, no type, no populated density. Real screenshots of
  Morrowind's menus close that gap and are the highest-value art-direction acquisition left.
- **Modern (UI fidelity).** `RI-UIX06` proposes fidelity properties **F17–F19** (glyph raster
  fidelity, scaling/layout integrity, compositing correctness) which currently have **no reference
  population at all**. Modern menu and HUD captures — Elden Ring's inventory, Skyrim's menus, any
  current-gen equipment screen — are what those bands must be measured against.

New slots:

| Slot | Side | What |
|---|---|---|
| `REF-A12b` | morrowind-art | Morrowind menus and UI **as rendered**: inventory, topic list, journal, map, character sheet, spellmaking, barter, book reader. 2–3 each where obtainable |
| `REF-A20` | morrowind-art | Morrowind loading/splash screens and any full-screen framed art |
| `REF-M22` | modern-fidelity | Modern menu/inventory screens, ≥2 games — the reference population for F17–F19 |

`refs/modern/ui/` and `refs/morrowind/REF-A12b/` are the destination folders.

## A3 — The convergence rule (this is the important one)

**We do not own any of these games and cannot capture anything ourselves.** Every image is
whatever the internet happens to hold. A critic that keeps demanding an artifact nobody has
published will block this project forever, which is a worse outcome than a documented substitution.

So every coverage gap must be classified, and the classification decides what happens next:

| Class | Meaning | Resolution |
|---|---|---|
| **BLOCKING** | Obtainable with more effort, and nothing else substitutes | Keep trying. Name the specific search not yet run. |
| **SUBSTITUTABLE** | The exact artifact is unavailable, but a different one serves the same measurement | Substitute, record `substituted_for` and `deviation`, move on. |
| **INFERABLE** | No artifact serves it, but the bar can be met by reasoning from adjacent evidence | Record the inference, its basis, and its confidence. Downgrade the band's provenance to `derived`. |
| **IMPOSSIBLE** | Nothing published serves it and no inference is sound | Accept in writing, state the risk, and **lower or delete the bar that depended on it.** |

**A gap may not stay BLOCKING for more than three acquisition rounds.** On the fourth, it must be
reclassified into one of the other three. A bar with no obtainable reference is not a bar — it is a
permanent fail we inflicted on ourselves, and `RI-VIS03` already caps FIDELITY at 7 for exactly
this situation.

Worked example of the intended reasoning, from the user: *"we couldn't get an image at sunset"* →
**SUBSTITUTABLE**: use sunrise, which is the same low-sun geometry, and record the deviation. If
sunrise is also unavailable → **INFERABLE**: measure the daylight population and apply known
low-sun colour-temperature and extinction shifts, recording it as `derived`. Only if that reasoning
is itself unsound is the slot **IMPOSSIBLE**.

## A4 — Breadth beats depth

Where effort must be traded, **coverage breadth wins**. Twelve profiles at their floor with two
games each is worth more than two profiles at triple depth, because the bands are per-profile and a
profile with no population cannot be calibrated at all. The `min distinct games` requirement stands
— a single game's art director is not a population — but it may be met at **2** rather than 3 where
3 proves unobtainable, recorded as a deviation.

## A5 — The third axis: Souls **behavioural** reference

**This is a new category, and the corpus does not currently have it.**

The bifurcation protocol (`RI-VIS01`) splits visual judgement two ways: **fidelity** (modern
references) and **art direction** (Morrowind references). That partition is correct for judging how
our renderer looks. It is **the wrong tool for judging whether our combat looks like Souls**, and
until now nothing has owned that.

We need Dark Souls and Elden Ring imagery and footage as reference for **behaviour**, not for
rendering quality and not for design language:

| What it judges | Why an image or clip is the only way to check it |
|---|---|
| **Camera position and framing** (`RI-CAM01`, `RI-CAM03`) | Pivot height, shoulder offset, arm length and the lock-on containment law are geometry you can *measure off a frame*. Our numbers are currently `constructed` with no visual reference at all. |
| **Attack animation shape** (`RI-WPN01`–`RI-WPN04`) | Windup silhouette, arc type, follow-through and recovery posture per weapon class. The frame *data* is now verified; the *poses* are not. |
| **Telegraph readability** (`RI-AI02`) | Whether a windup is legible at combat distance is a question about silhouette and contrast, not about frame counts. |
| **Stance, guard and locomotion poses** (`RI-CAM07`, `RI-WPN06`) | Two-handing, shield-up, the walk/run/strafe set — the character's back is the most-looked-at surface in our game and we have no reference for it. |
| **Impact and hitstop** (`RI-WPN05`, `RI-AUD01`) | What a connecting hit *looks* like — the freeze, the recoil, the particle. |
| **UI in combat** (`RI-UIX01`) | HP/stamina/flask placement, lock-on reticle, status buildup — measured as screen coverage and contrast. |

### Rules for this axis

1. It lives in **`refs/souls-behaviour/`**, keyed by the reference item it serves, not by lighting
   profile. Subfolders: `camera/`, `attacks/`, `telegraph/`, `stance/`, `impact/`, `ui-combat/`.
2. `"side": "souls-behaviour"` in the manifest. It is **cited by combat, camera and weapon critics —
   never by the fidelity or art-direction critics.** A Dark Souls screenshot is not a fidelity
   reference (DS1 is 2011) and not an art-direction reference (our art direction is Morrowind).
   Mixing it into either voids the verdict, exactly as CC-1..CC-6 already require.
3. **Video is first-class here, not a fallback.** Attack arcs, hitstop and camera behaviour are
   temporal by nature; a still cannot show a windup. `pixel_metrics_valid: false` on all of it —
   these are never used for texture, anti-aliasing or colour statistics.
4. **HUD is wanted**, not tolerated: `RI-UIX01` needs it.
5. **Both games count.** Dark Souls 1/3 and Elden Ring are equally valid here — behaviour is what
   is being referenced, and it is consistent across the series in the ways we care about.
6. Frame-accurate capture is not required. A clear photo-mode shot of a mid-swing pose, a
   community-made move-list GIF, a wiki's attack-animation still, or a Digital Foundry clip all
   serve. **Community frame-data videos and moveset showcases are the single richest source** —
   they exist precisely because players wanted to study these poses.

### Why this was missed

Every visual item in the corpus was written to the fidelity/art-direction bifurcation, so a whole
class of reference had nowhere to be filed and therefore was never requested. `RI-VIS01` §A
declares its property partition "exhaustive and closed" — which made it structurally impossible to
ask for this. That partition needs a third branch, or an explicit statement that behavioural
reference sits outside it. **Filed as a required corpus amendment, not a licence to proceed
informally.**

## A6 — ESO Black Marsh: raised in scope, unchanged in standing

**Amends §5d**, which asks for four ESO screenshots as "orientation only, cited by nobody" and puts
`context/` last in the priority order. It is currently at **zero files**.

**What stays exactly as it was.** ESO Shadowfen/Murkmire is **not a fidelity reference** — a 2014
MMO engine in `refs/modern/` would drag our `[p10,p90]` bands down and hand a builder the argument
"we are within the reference population", which is `RI-VIS03`'s named failure arriving through the
front door. It is **not an art-direction reference** either — ours descends from Morrowind plus our
own written transposition, and ESO is somebody else's transposition of the same source. The
`forbidden_for: ["fidelity-bands", "art-direction-judgement", "blind-pairing"]` rule stands. **No
critic scores against these images.**

**What changes.** Four images was set for a folder nobody reads. But these are the **only existing
visual depiction of the actual region our game is set in**, and seam **S20** already rules ESO
material admissible precisely for the things a picture shows: *geography, rivers, ruins and
xanmeers, species and creatures, flora, the Hist's nature*. That is builder reference, not critic
reference, and the distinction was collapsed.

So:

1. **Raise the target from 4 to 12–16**, covering the subjects builders must actually depict:
   **xanmeer ziggurats** (stepped, half-sunk, vine-taken), **Hist trees** at scale, **Argonian
   settlement architecture** (stilted, lashed, organic), **marsh vegetation and water**, **naga and
   Argonian character design**, and **root-tunnel interiors**.
2. **Re-file it as `side: "subject-reference"`**, not `"context-neither"`. The old name described
   what it *isn't*; the new one describes what it *is for*. `forbidden_for` is unchanged.
3. **Raise its priority** from last to **mid**. Wave-1 pieces `W1-02` (regions and the strange),
   `W1-03` (water and the amphibious body) and `W1-14` (magic VFX) are being built *now* and have
   no visual reference for their subject at all. A builder guessing what a xanmeer looks like is a
   worse outcome than a builder looking at one.
4. **Every file carries a visible warning in its record**: `"builder_reference_only": true`, with a
   note that this is 2E 582 material under S20 — admissible for what the land and its species look
   like, inadmissible for politics, power, named individuals and prices.

**The risk this creates, stated plainly.** Handing builders ESO imagery invites convergence on
ESO's Black Marsh, which is exactly what the earlier ruling guarded against. The guard is
`RI-VIS07`'s naming test — a fresh judge shown our screenshot must not answer "ESO" any more than
they may answer "Skyrim". **Add ESO to that test's forbidden answers.** Subject reference tells a
builder what a xanmeer *is*; our own art-direction spec, transposed from Morrowind, tells them what
ours *looks like*.

## A7 — Geographical variation, and the reference set that must prove it

**User direction:** *"Variation of biomes, landscapes and scenes across the spectrum of small
picture to big picture. I want visual tests as part of it."*

Seam **S24** already forbids a uniformly swampy world, and `RI-WLD04` already tests whether a
region can be *identified* from an unlabelled screenshot. **Neither is sufficient**, for two
reasons:

1. **Identifiable is not varied.** Thirteen regions could each be reliably identifiable while the
   whole set occupies a narrow visual range — thirteen shades of one place. Identity is a
   *classification* test; variation is a *dispersion* test, and we only have the first.
2. **Variation happens at three scales and we test one.** Morrowind varies at the macro scale
   (Ashlands versus Bitter Coast versus Grazelands), the meso scale (a foyada cutting a hillside,
   a coastline turning to marsh within one region), and the micro scale (ground texture, flora
   clustering, rock type, the specific plants at your feet). Our corpus tests only the macro.

### The measurement this makes possible

**Morrowind is the calibration set, not just the aspiration.** With enough real Morrowind
screenshots we can compute how far apart *its own* regions actually are, and require ours to be at
least as spread out:

- **Inter-region dispersion.** Compute pairwise distance between region centroids across the
  metric vector (palette in CIELAB, luminance distribution, edge density, colour entropy, sky
  fraction, silhouette statistics). Morrowind's own inter-region distribution becomes the floor:
  **our 13 regions must have a median pairwise distance ≥ Morrowind's**, and — importantly — a
  **minimum** pairwise distance no smaller than Morrowind's minimum, so no two of our regions may
  be closer together than Morrowind's two most similar regions.
- **Intra-region variance, bounded on both sides.** A region must be internally *coherent* (its
  screenshots cluster) but not *uniform* (the cluster has real spread). Both a floor and a ceiling,
  because a region where every shot is interchangeable is as much a failure as one with no
  identity. The ratio `inter_median / intra_median` is the headline number, calibrated against
  Morrowind's own.
- **Micro-scale variation** is measured at ground level: a downward-facing shot in each region must
  differ from every other region's on texture, flora and material, without relying on skyline or
  architecture to carry the distinction. **This is the scale most likely to be faked** by
  recolouring one terrain material, and the one nothing currently checks.

### What acquisition must therefore get

This is a **new acquisition requirement**, not a nice-to-have — the bar above cannot be computed
without it:

| Set | What | Why |
|---|---|---|
| `morrowind/REF-A21-regions/` | **Full-frame exteriors from every distinct Vvardenfell region** — Ascadian Isles, Bitter Coast, West Gash, Grazelands, Ashlands, Molag Amur, Sheogorad, Azura's Coast, and the Red Mountain approach. **4–6 each**, native aspect, uncropped | The inter-region dispersion floor is computed from these. Fewer than 4 per region and the centroid is noise. |
| `morrowind/REF-A22-intraregion/` | **Several shots from *within* one region**, showing how much it varies internally — 6–8 from Ascadian Isles and 6–8 from Bitter Coast | Calibrates the intra-region variance band. Without it we have a floor with no ceiling. |
| `morrowind/REF-A23-ground/` | **Downward or near-ground shots** showing terrain texture, flora clustering and material at walking scale, ≥1 per region | The micro scale. Nothing in the current set shows the ground at all. |

Note this depends on finding **F1** already being fixed: 320×320 square crops cannot support any of
these measurements, because a crop has discarded both the composition and the skyline.

Steam app **22320** is the route; queries by region name (`Ascadian`, `Bitter Coast`, `Grazelands`,
`Ashlands`, `Molag Amur`, `Sheogorad`, `Azura's Coast`, `Red Mountain`, `West Gash`) return
region-tagged galleries.

### The honest caveat

Morrowind's screenshot population is skewed toward the picturesque and toward the places players
photograph, so the computed dispersion is an estimate from a biased sample, not a census. It is
still enormously better than a constructed number — and the bias runs **against** us, since a
picturesque-skewed sample will show *more* dispersion than the real game, making the floor harder
rather than easier. Record it as `derived` with the bias stated.
