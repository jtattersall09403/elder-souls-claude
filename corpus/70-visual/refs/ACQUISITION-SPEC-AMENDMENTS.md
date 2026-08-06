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

## A8 — Temporal reference: routes, not excuses

**User direction:** *"We cannot just lower the bar. We need something."* Correct. The round-1
builder concluded video was unobtainable because **YouTube** refuses this container and
**archive.org**'s current-gen holdings are too large to vendor. Both are true and neither is the
whole search space. A3's IMPOSSIBLE class requires *nothing published serves it and no inference is
sound* — that test has not been met, because these routes were never tried.

### What actually needs temporal evidence

| Bar | What a still cannot show |
|---|---|
| `RI-VIS03` **M11** LOD pop | geometry appearing as the camera moves |
| `RI-VIS03` **M12** water temporal variance | a surface changing frame to frame |
| `RI-VIS04` wind | foliage moving at more than one frequency |
| `RI-VIS08` §C animation | pose rate, jerk, foot slide, blend frames, T-pose leak |
| **A5** attacks, telegraph, impact | windup → active → recovery as a *sequence*; hitstop |
| `RI-CAM01`/`03`/`06` | spring-arm pull-in, lock-on reframing, shake |

### Routes, in order of expected yield — all verified reachable

1. **Wiki animation GIFs — the best route and already found.** Round 1 noted the Dark Souls wiki
   hosts per-move animation clips *named by boss and move* (`Artorias - Heavy Slam`, `- Somersault
   Attack`). HTML is Cloudflare-403 but **`darksouls.fandom.com/api.php` returns 200** (verified).
   Use `action=query&list=allimages&aiprefix=`, filter to `.gif`/`.webm`, and pull originals from
   `static.wikia.nocookie.net`. **A GIF is a frame sequence** — it is exactly what M11, VIS08 §C
   and A5's attack arcs need, it is small, and it is per-move labelled, which no longplay is.
   Also try `eldenring.fandom.com`, `darksouls3.fandom.com`, `elderscrolls.fandom.com`.
2. **Imgur** (302, reachable). `.gifv`/`.mp4` — the Souls community posts clipped combat there
   constantly, typically 5–20 s, which is the length the spec wants.
3. **An Invidious/Piped instance.** `yewtu.be` returns 200. `yt-dlp` supports Invidious URLs, and
   these proxies frequently serve where youtube.com refuses. Try several instances.
4. **Vimeo** (200) and **Bilibili** (200) — both host game capture, both outside YouTube's bot wall.
5. **archive.org, but pick the derivative.** The 82 GB figure is the *source* upload. Archive
   generates lower-bitrate `.ia.mp4` derivatives; and its player supports byte-range and
   `?start=&end=` fragment extraction. Fetch a 30-second span, not the item.
6. **Reddit** is 403 direct, but `old.reddit.com`, `.json` endpoints and third-party mirrors often
   are not. `v.redd.it` clips are short by construction.
7. **GitHub** — graphics-research and video-codec repos vendor short test sequences; some are game
   capture.

### Substitutes that are genuinely sufficient, not consolation prizes

Where a clip cannot be had, these measure the same property and should be recorded as
SUBSTITUTABLE under A3 rather than treated as failure:

- **Burst screenshot series.** Steam's `publishedfileid` is monotonic in time (proven: 97 dates, 0
  violations). **Consecutive sids from the same author are frames seconds apart** — a free
  pseudo-temporal sequence. Not frame-adjacent, so useless for jerk; genuinely useful for
  before/after state, weather transition, and LOD at two distances.
- **Frame strips and sprite sheets.** Community frame-data resources publish attack animations as
  labelled strips. A strip *is* the sequence, already extracted.
- **Two shots of the same place at different times/weather** substitutes for a transition clip.
- **For LOD specifically**: two screenshots of the same landmark at different distances measure
  pop-in geometry directly, and are much easier to find than a dolly.

### The rule this replaces

**No temporal bar may be lowered or deleted until routes 1–7 and the substitutes above have each
been tried and recorded as failed.** A3's three-round limit still applies, but the round counter
restarts here because the search space just widened materially. If after that a bar still has no
evidence, then and only then does it become IMPOSSIBLE — and the acceptance must name the bar and
the risk.

---

# Part 2 — Proposed amendments, round-2 reference builder

**Authority note, and it matters.** Everything above (A1–A8) is **user direction**. Everything
below is **proposed by the round-2 reference builder** in response to
`ACQUISITION-CRITIQUE-R2.md` and is **not yet adopted**. Each states the item it would change,
the exact replacement text, and the evidence. **No reference item owned by another agent has
been edited** — A3 says an unobtainable reference must result in an amended bar rather than a
permanent silent fail, and the way to get an amended bar without overwriting somebody else's
item is to write the replacement text down here and let its owner apply it.

Numbering continues the A-series. `A9`–`A11` are instrument amendments (they change how a
number is computed). `A12`–`A14` are the three A3-IMPOSSIBLE acceptances **with the dependent
bar actually lowered**, which is the step rounds 1 and 2 both skipped. `A15`–`A17` are the
critic's rulings applied.

---

## A9 — `block_score` is made exposure-relative *(amends `RI-VIS03`; closes R2C-03)*

### What is wrong

`docs/REFERENCE-IMAGE-REQUEST.md` §8a rejects a file whose `block_score` exceeds an absolute
**1.15**. `block_score` is a ratio — mean |ΔI| across 8-aligned columns divided by mean |ΔI|
across all other columns — so **the denominator is the scene's own detail**. JPEG blocking is a
roughly constant *absolute* discontinuity in code values, while scene detail scales with
luminance because contrast is multiplicative. For identical encoder damage the ratio therefore
rises as the picture darkens, and `interior_darkemissive` — the profile **defined by** darkness
— is held to a strictly harder standard than `exterior_daylight` at identical source quality.

Round 1 diagnosed this as a *source* problem ("Steam re-encodes user uploads"). That diagnosis
is refuted by the corpus's own computed fields: `jpeg_quality_est` has a median of **100.0 in
every Steam-sourced folder** and `bytes_per_pixel` runs 1.29–2.31, against 0.31 for a real q=95
re-encode. These files are not heavily re-encoded. They are dark.

### The measurement

One image (`modern/exterior_daylight/run-w3nextgen-t0007.jpg`, 2560×1440), one encoder, JPEG
q=95 held constant, **only brightness varied**:

| treatment | `mean_luminance` | `block_score` | `(block_score − 1) × L` | `block_score_rel` |
|---|---:|---:|---:|---:|
| original | 105.1 | 1.031 | 3.22 | **1.025** |
| ×0.50 | 52.3 | 1.101 | 5.28 | **1.041** |
| ×0.30 | 31.1 | 1.192 | 5.95 | **1.047** |
| ×0.18 | 18.4 | **1.308** | 5.66 | **1.044** |

The excess above 1 is very nearly inversely proportional to mean luminance, so the confound
divides out exactly. Raw spread **0.277** (PASS → FAIL on brightness alone); relative spread
**0.019** — a **15× reduction** in exposure sensitivity.

### The replacement

`make-manifest.py` gains, per file:

```python
L_REF   = 128.0   # mid-grey of the 8-bit range: a principled anchor, not a fit
L_FLOOR = 16.0    # below this, normalising would divide a real fault away

mean_luminance  = whole-frame mean of the 8-bit luminance plane
block_score_rel = 1 + (block_score − 1) × (max(mean_luminance, L_FLOOR) / L_REF)
```

`block_score_rel` reads as *the `block_score` this frame would have shown had it been exposed
at mid-grey*. **`block_score` itself is unchanged and is still recorded**, so the change is
auditable and no earlier verdict is silently rewritten.

**§8a's threshold text is replaced by:**

> A file is rejected for block artefacts when **`block_score_rel > 1.15`**, and separately when
> `jpeg_quality_est < 80`. The absolute `block_score` is recorded but is no longer a gate,
> because it is confounded with scene exposure (amendment A9). `jpeg_quality_est` and
> `bytes_per_pixel` are exposure-independent by construction and are the corroborating
> evidence; where all three disagree, the two exposure-independent ones win.

### Why this is not a licence

Two controls, both measured, both required before adopting:

- **The null stays exposure-independent.** A lossless PNG of the same frame at the same four
  brightnesses scores `block_score_rel` 0.989 / 0.997 / 0.999 / 1.000. An undamaged dark frame
  passes, as it should. (The critic independently measured a genuinely lossless dark PNG from
  `deadendthrills.com`, mean luminance 47.5, at `block_score` **0.998**.)
- **It still detects real damage.** A quality sweep on the same frame: bright
  q95/85/70/50/30 → `block_score_rel` 1.025 / 1.144 / 1.291 / 1.456 / 1.706; the same sweep at
  ×0.18 brightness → 1.044 / 1.118 / 1.222 / 1.340 / 1.578. Before the fix those two curves
  diverged by up to 0.6 at the same quality; after it they agree. The threshold now means the
  same thing in a cave as on a hillside.
- **`L_FLOOR` is a deliberate under-correction.** Below mean luminance 16 the normalisation
  would shrink a genuine fault toward nothing, so luminance is clamped. The metric is
  conservative at the dark end rather than blind there.

---

## A10 — `metrics_valid_for`: metrics validity is separated from art validity *(closes R2C-06)*

`pixel_metrics_valid` answers two different questions with one boolean: *may this file set a
`[p10,p90]` fidelity band?* and *may this file be measured for art direction?* A7's dispersion
computation is an art-direction measurement over files that are **all**
`pixel_metrics_valid: false`, so with one flag its input set is either empty or the entire
corpus, and 199 files carrying `heavily_recompressed: true` would enter it unfiltered. Two of
A7's six metric components — **edge density and colour entropy** — are precisely the quantities
JPEG blocking corrupts.

**Each record gains a computed `metrics_valid_for` list.** It is derived at join time in
`make-manifest.py` from the provenance judgement plus the measured numbers, so it can never be
hand-edited, and every measurement in the project acquires a *defined* population:

| value | what it admits | gate |
|---|---|---|
| `fidelity-bands` | M1–M12, `[p10,p90]` calibration | `pixel_metrics_valid` **and** `block_score_rel ≤ 1.15` **and** `jpeg_quality_est ≥ 80` **and** not superseded, not animated, not `forbidden_for` |
| `art-direction` | palette in CIELAB, luminance distribution, sky fraction, silhouette statistics — robust to mild blocking | `side` is Morrowind art, full frame (superseded crops excluded), not animated |
| `dispersion` | **A7's inter/intra-region centroids only** | `art-direction` **and** `a21_member` **and** `block_score_rel ≤ 1.30` — laxer than fidelity because it is a between-group comparison rather than an absolute band, but *not absent*, because edge density and colour entropy are in the vector |
| `ui-fidelity` | `RI-UIX06` F17–F19 glyph raster / scaling / compositing | slot `REF-A12b` or `REF-M22`, or under `modern/ui/` |
| `behaviour` | A5. Pose, timing, framing geometry | `side` is `souls-behaviour` or `video`. **Never** a fidelity or art-direction input |
| `subject-reference` | A6. What the land and its species look like | `side: subject-reference`. Cited by no critic |

**Note for whoever computes A7.** The A7 sets are defined by the **`a21_member` field, not by
the folder.** Qualifying files live in `REF-A1`, `REF-A5`, `REF-A8`, `REF-A9`, `REF-A11`,
`REF-A19`, `REF-A22-intraregion` and `REF-A23-ground` as well as in `REF-A21-regions`. A tool
that selects on the directory will miss them and skew every centroid.

---

## A11 — `has_hud`, `side` and `game` are observations, not folder constants *(closes R2C-07, R2C-15)*

`has_hud` was `true` for **93 of 93** `souls-behaviour/` files, 33 of 33 `REF-A12b` and 5 of 5
`anti-generic/` — a value typed once per folder. That is not tidiness: **A1 clause 3** makes the
metrics battery mask a border band wherever `has_hud` is true, so on a frame with no HUD it
discards real image data from the measurement; and **`RI-UIX01`'s population** was being read as
93 when it is a fraction of that.

**Replacement rule.** `has_hud` means *a gameplay HUD overlay is present in this frame*, and it
is set per file, by eye or by measurement, never per folder. Three fields carry it:

- `has_hud` — boolean, the combat/gameplay HUD only.
- `ui_overlay_kind` — `combat-hud` | `menu` | `both` | `none`. A menu is UI but it is not a HUD,
  it does not sit in the border band, and it belongs to `REF-M22`/`RI-UIX06`, not `RI-UIX01`.
- `has_hud_basis` — how the value was arrived at. `eye-verified-r2` where a human looked;
  `typed-by-acquirer` where it was not re-checked, so the difference is visible rather than
  implied.

Measured fields `hud_probe` (saturated-overlay fraction in each of four corner boxes and the
centre box), `hud_probe_edge_max` and `has_hud_measured` are computed alongside for audit.
**They are recorded, not trusted:** the critic's chroma detector is calibrated on the DS3 bar
stack and is confounded by scene content — a bonfire fills the probe box at 1.000 and a blue sky
at 0.444 — so on this corpus the eye is the instrument and the probe is the corroboration.

**`side` and `game` are normalised to one string per side and one per game.** `side` carried
both `morrowind-art` (150) and `morrowind-art-direction` (127), so every per-side query returned
one or the other silently; `game` carried `The Elder Scrolls III: Morrowind`,
`… Morrowind (2002)` and `… Morrowind (2002), interface as reproduced by OpenMW`, which makes a
naive distinct-games count report **3** for a one-game side. Where a qualifier carried real
information (the OpenMW re-implementation) it moves to its own field rather than being deleted.

---

## A12 — IMPOSSIBLE accepted: frame-exact validation of `RI-WPN05` §A. **The bar is lowered to ordering plus a ±16.7 ms spot check.** *(closes R2C-25)*

### The acceptance

`RI-WPN05` §A is a 5 tier × 7 material grid of integer hitstop frame counts at 60 Hz — 35 cells,
plus a victim grid, plus knockback. Its own provenance note says *"a future wave that measures
real hitstop from video frame analysis should overwrite §A and this note should be updated to
`derived`."* **Cell-by-cell validation against real FromSoftware footage is accepted as
IMPOSSIBLE**, and the reason is a sampling reason, not an instrument reason:

- Nothing published states a hitstop figure for any FromSoftware title. The provenance note is
  right that there is no measurement tradition to lean on.
- Filling 35 cells requires a clean, isolated, known-weapon hit on each of seven materials —
  i.e. a controlled capture in a game we do not own and cannot run.

### What the bar becomes — and this is a rise, not just a fall

The round-2 critic set this at *"±70 ms and ordering"* on the basis that Fandom's WebP transcode
strips per-frame delays and only a total duration survives. **Measured on the bytes actually
vendored, both halves of that are now better:**

| instrument | resolution | measured |
|---|---|---|
| 200 wiki animation GIFs, **original bytes** (`?format=original`, per-frame delays intact) | **40 ms median** (30 ms best, 100 ms worst); 170 of 200 at exactly 40 ms = 25 fps | 18,447 decoded frames, 126 distinct named moves, 26 subjects |
| `video/V4-combat__dsr-longplay-t13990.mp4` | **16.7 ms** — `r_frame_rate 2997/50` = **59.94 fps**, 2,404 frames over 40.07 s | motion-bracketed freeze detection runs; the clip yields 3 candidate events |

So the instrument resolves a single 60 Hz frame. What it does not supply is *sample size*: a
40-second window contains too few isolated hits, and 480p at 806 kbps blurs the ones it has.

**Replacement text for `RI-WPN05` §F, to be applied by that item's owner:**

> **Reference validation of §A (added, amendment A12).** §A's grids are `constructed` and stay
> `constructed`. They may **not** be scored cell-by-cell against reference footage — no
> published source states a hitstop figure for any FromSoftware title and no capture we can
> obtain isolates 35 tier×material cells. Three weaker claims are checkable and **are** the bar:
>
> 1. **Ordering.** In reference footage, attacker hitstop must be visibly longer for a heavier
>    weapon than a lighter one. Measurable at **±40 ms** from `souls-behaviour/anim/`'s per-move
>    original-byte GIFs (median frame delay 40 ms), which are named per move and per weapon.
> 2. **Spot check.** A single hit in `video/` may be measured at **±16.7 ms** (59.94 fps) by
>    motion-bracketed frame differencing: a high-motion frame, a run of near-zero inter-frame
>    difference, then motion resuming. One such measurement is a spot check, not a calibration.
> 3. **Existence and asymmetry.** A visible freeze on contact, and a harder, sparking, visibly
>    bouncing impact on stone or shield, are both observable in the reference set and are
>    already listed in this item's `canonical-recall` grounding. They stay `canonical-recall`.
>
> The provenance note's promise stands with a stated limit: **§A becomes `derived` only if a
> future wave measures ≥3 cells of one tier row from footage at ≤16.7 ms.** Until then it is
> `constructed`, and **no critic may score §A as failing for want of a reference**, because the
> reference does not exist. `RI-VIS03` already caps FIDELITY at 7 for exactly this situation.

**The risk, stated as A3 requires.** If our hitstop is wrong in *magnitude* — right ordering,
wrong absolute values — nothing in the corpus will catch it. The mitigation is that §A's numbers
were rebased under seam S22 to 4 f@60 = 67 ms (light) through 16 f@60 = 267 ms (ultra), and the
one range we can check against footage, "the freeze is perceptible and scales with weight", is
consistent with that. That is corroboration, not calibration, and it should be read as such.

---

## A13 — IMPOSSIBLE accepted: `REF-A12` as images. **The expectation is deleted, not failed.** *(closes R2C-27)*

`REF-A12` asks for Morrowind's UI as reference. It is filled by **38 OpenMW MyGUI `.xml`,
`.layout` and `.skin` files** — structure and measurements, and not one pixel of the original
art: no bevel, no sheen, no type, no populated density.

**This is accepted as IMPOSSIBLE in its original form and the expectation is deleted**, on the
ground that it was never an image slot: MyGUI layout data is a *different artifact*, not a
degraded one. A2 already created the slot that holds the pixels — **`REF-A12b`, now at 33 files
across 11 sub-kinds and 8 distinct resolutions in both 4:3 and 16:9.**

**Replacement text for `REF-A12`'s slot definition:**

> **`REF-A12` — Morrowind UI structure.** Holds OpenMW's MyGUI `.layout`, `.skin` and `.xml`
> definitions: window geometry, panel nesting, skin state names, colour constants. **It is a
> text asset and it is complete. It is not an image slot and must not be counted as one, scored
> as short, or reported as a gap.** Every pixel-level UI question — bevel, sheen, type, populated
> density, scaling behaviour — belongs to **`REF-A12b`**.
>
> **Standing caveat on the numbers:** OpenMW is a re-implementation, so `REF-A12`'s constants
> (e.g. the dialogue window at 588×433, `normal` text at RGB 202,165,96) are **corroboration for
> what is measured off `REF-A12b`, never ground truth over it.** Where the two disagree, the
> screenshot wins.

---

## A14 — IMPOSSIBLE accepted: a true dolly capture for `RI-VIS03` **M11**. **The M11 band becomes `derived`.** *(closes R2C-02)*

**M11 (LOD pop and draw-distance stability) is the one bar that survived every temporal route
and is still unserved**, and it is worth being precise about why, because everything around it
was solved:

- Wiki animation GIFs (route 1) are 210×118 combat clips of a fixed camera on a boss. LOD pop is
  a function of **camera translation through a large scene**; these contain none.
- The two vendored `video/` clips are 854×480 at 806 kbps. LOD pop is a small-amplitude
  geometric event; at that bitrate and resolution it is inside the codec's noise floor.
- `gamersyde.com` (HTTP 200, own-capture high-bitrate MP4) is the one route that would serve it,
  and its download links need a free account and are JS-injected. **This is recorded as the
  named unrun search**, not as a dead end.

The remaining substitute — two screenshots of the same landmark at two distances (A8's own
suggestion) — measures *draw distance*, which M11 shares a section with, but it cannot measure
*pop*, because pop is defined by the transition.

**Replacement text for `RI-VIS03` M11's band:**

> **M11 — LOD pop and draw-distance stability.** *(temporal; needs a dolly capture)*
>
> **Reference status: `derived`, confidence low (amendment A14).** No dolly capture of a
> current-generation title was obtainable — see `TEMPORAL-ACQUISITION.md` for the seven routes
> tried. The band is therefore **not** calibrated against a reference population and **must not
> be reported as if it were.** It is set from the project's own renderer as a *regression* bar:
> M11 measures our build against **our previous build**, and its pass condition is "no worse than
> last wave", not "within the reference `[p10,p90]`". The static half of the section —
> **far-plane distance and the M4 cross-check for a short draw distance concealed by fog** — is
> unaffected and stays as written.
>
> **The risk:** a renderer that pops badly in absolute terms can pass a regression bar forever by
> popping equally badly every wave. The tripwire is the cross-check already in this section: a
> short draw distance always shows up in M4 edge density and in the far-plane value, whatever
> M11 reports. **Unblocking search, if a later wave wants it:** register a free `gamersyde.com`
> account, re-fetch an article page, and read the JS-injected direct MP4 download URLs.

---

## A15 — The interval-run weighting rule *(applies critic ruling 1; closes R2C-17)*

The `exif_software: "ACDSee Ultimate 8"` promotion of the 24 Witcher 3 interval-run frames is
**upheld** — §8a's editor rule is a *proxy* for degradation, and here the degradation is
measurable and absent (every one of the 24 sits at `block_score` 0.99–1.01, the lowest in the
corpus, against a Steam median of 1.16 for the same profile). The `integrity_flag` stays
verbatim; that transparency is what makes the promotion defensible.

**The cost that was not priced:** those 24 are one location — mid-morning `CLEAR` Novigrad — they
are **56% of `exterior_daylight`**, and `anti-generic/` holds
`ANTI__w3-novigrad-half-timbered.jpg` as a **negative anchor** for `RI-VIS07`. So 56% of the mass
of the profile that sets our daylight fidelity bands is the exact town another folder designates
as the thing we must measure distance away from. §3's ≥6-distinct-locations rule and its
≥half-interval-run rule fight each other, because an interval run is by construction one
location, and nobody wrote a rule about weight.

**Proposed §3 clause:**

> **Series weighting.** When computing a profile's `[p10,p90]` band, an **interval-run series
> counts as one location** and is downweighted to at most `1 / distinct_locations` of the
> population mass, whatever its file count. This applies to the content-sensitive bands — colour
> entropy, sky fraction, palette centroid, foliage statistics — and **not** to the
> content-agnostic ones (M4 edge density, M2 local contrast), for which A1's argument that
> fidelity is content-independent holds. A profile's band must be reported **with and without**
> any series exceeding `1/locations` of its mass, and the delta stated.

---

## A16 — **V8**, the UI-chrome vanilla test *(applies critic ruling 2; closes R2C-22's verifiability half)*

The three-valued vanilla test (`true` / `false` / `null`) is **upheld**: V1 (grass), V2 (distant
land) and V4 (water reflections) are literally unevaluable in an interior, and reading §7
literally would have emptied the slot A2 calls the highest-value art-direction acquisition left.

**But 33 files cannot be admitted with three of seven tests voided and nothing put in their
place.** A menu capture has a decisive vanilla test the outdoor ones do not — **the UI chrome
itself.** MGE XE, OpenMW and every popular UI replacer change the bevel, the panel colour and
the font in visible ways.

> **V8 — UI chrome matches vanilla Morrowind.** The window bevel, the panel fill colour and the
> typeface are vanilla. **Required on every capture whose `ui_overlay_kind` is `menu`**, and it
> is the test that replaces V1/V2/V4 wherever those are `null` for being indoors.
>
> **Checkable anchors**, from `REF-A12`'s MyGUI data: the dialogue window at 588×433; `normal`
> text at RGB 202,165,96. **Corroboration, not ground truth** — OpenMW is a re-implementation
> (amendment A13). A capture that disagrees with these numbers is flagged for eyes, not failed.
>
> Without V8, `REF-A12b` is the least-verified folder in the corpus, and it is the one the whole
> art-direction UI transposition will be built from.

Recorded alongside it, from the same pass: **`multi_window: true`** on captures showing two or
more of Morrowind's UI windows tiled simultaneously — the property R1's F5 identified as the
interface's defining behaviour, which §15.2 asserted and the catalogue could not confirm (H9).

---

## A17 — `corroboration: "one-host"` split, and the 24 mis-bucketed records *(applies critic ruling 3)*

**Upheld for the non-band axes.** §8b exists to stop an unverified image from setting a
`[p10,p90]` band. That risk is **zero** for records that can never enter a band, and
`souls-behaviour/` and `context/` — `pixel_metrics_valid: false`, with a `forbidden_for` list —
cannot. They keep `one-host`.

**Reversed for band-setting records**, i.e. those both `one-host` **and**
`metrics_valid_for: [fidelity-bands, …]`. The critic counted 36. **Twenty-four of the 36 are
simply mis-bucketed**: the Witcher 3 interval-run frames are not Steam at all — they come from a
GitHub-hosted mirror with a stated capture provenance, and `one-host` is the wrong label rather
than a true weakness. They are re-labelled **`github-mirror-stated-provenance`**, not removed.

That leaves **12 genuinely weakly-corroborated band-setting records** — 5 in `combat`, 4 in
`material_closeup`, 2 in `interior_darkemissive`, 1 `REF-M6`. For each, one of two actions:
fetch the Steam detail page and read the printed date (the method already applied to 95
records), or **drop the record from band computation while keeping it for composition** by
removing `fidelity-bands` from its `metrics_valid_for`. Twelve pages at one request per 4 s is
under a minute; the second option costs nothing and is the fallback.

**And the fourth corroboration category is ADOPTED, NARROWED**, per the same ruling: name it
`dated-apphub`, and permit it **only** for records that never enter a band — `pixel_metrics_valid:
false` **and** a `forbidden_for` list. Any record that sets a band must still satisfy one of
§8b's original three. Otherwise the amendment repeals the rule it amends.

---

## A18 — `RI-VIS07`'s forbidden answers *(closes R2C-24)*

**Checked against the item rather than assumed: `RI-VIS07` §B already lists "Elden Ring" and
"Dark Souls" among the FAIL answers.** F24's substantive request is therefore already satisfied
at the level of the test, and the remaining work is two smaller things:

1. **Add "The Elder Scrolls Online" / "ESO" explicitly** to §B's `Names an existing game` row.
   A6 asked for it and the row's examples do not name it; `an Elder Scrolls game` covers it only
   by inference, and this test is scored by a fresh judge reading examples.
2. **Put the `admissibility_note` `context/` already carries onto all 93 `souls-behaviour/`
   records.** A5 rule 2's guard protects the *critics*; it does nothing about a **builder** who
   has been looking at 91 Dark Souls III screenshots and reaches for a gothic-cathedral
   silhouette, a grey-brown palette and a fog gate. This is the cheapest insurance in the
   document and it costs no bytes.
