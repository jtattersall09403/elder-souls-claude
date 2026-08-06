# BAR-CRITIQUE-IMAGES-01 — is the reference-image request sufficient?

**Critic:** bar-critic. **Date:** 2026-08-06.
**Artifact under critique:** `docs/REFERENCE-IMAGE-REQUEST.md` (8,846 bytes, 2026-08-06T07:49Z).
**Judged against:** RI-VIS01 (the 25-property partition), RI-VIS02 (REF-M1..M8 + the canonical
viewpoint pairing table), RI-VIS03 (M1–M12 and the band-calibration procedure in its provenance
note), RI-VIS04 (§1–§14 feature checklist), RI-VIS05 (§C palette, §D flora/fauna, §E silhouette,
§F forbidden forms, §G materials, §H UI), RI-VIS06 (§A/§B blind protocols and §D anti-leak
table), RI-VIS07, RI-VIS08 (§B static, §C temporal), RI-CAM07 (§B back surfaces, §F silhouette).
**Standard of consistency:** BAR-CRITIQUE-01.

---

# 1. VERDICT: **INSUFFICIENT**

The prompt is well written, honest, and correct about the two things it chose to defend:
folder-as-axis and vanilla-only. Its anti-fabrication closing paragraph is the right paragraph.
If a human read it and did the work by hand, we would get a decent scrapbook.

It is insufficient because a scrapbook is not what any consumer of these files actually does
with them. Every downstream use in the corpus is a **pixel computation or a byte-comparable
pairing**:

- RI-VIS03 M4/M5 run a Sobel operator and a 1024² FFT and read the energy in the top 5% of the
  frequency band. That number *is* the anti-aliasing and texture-resolution measurement.
- RI-VIS03 M8's `LargestFlat` is a 9×9 local-standard-deviation threshold at `0.008`.
- RI-VIS03 M9's `ClipFrac` counts pixels at `>= 0.99` in all three channels.
- RI-VIS05 §C computes ΔE2000 in CIELAB D65 against 49 declared hex values and against a
  forbidden-anchor set at a radius of ΔE ≤ 10.
- RI-VIS06 §D forbids mixing a JPEG reference with a PNG capture *by name*, as a leak vector,
  and requires both sides re-encoded through the same writer at the same bit depth.

The prompt asks for none of the properties that make an image usable for any of that. It asks
for the right *subject*, honestly labelled — and a folder of subject-correct, honestly-labelled,
YouTube-derived, re-encoded, resized JPEGs would satisfy every sentence in it and be worth
**zero** for M4, M5, M8 and M9, which are the four metrics carrying the hard fails. Worse: the
numbers would still compute. They would just be measurements of the compressor.

Below that sits a second failure of a different kind — nine of the twenty-five properties in the
RI-VIS01 partition have no requested image capable of judging them, and four of those are
*inherently temporal* and cannot be judged by a still at all. And a third: the prompt's own
sample size makes RI-VIS03's stated calibration procedure arithmetically impossible.

This is a first draft of a hard document and INSUFFICIENT is the expected result. Fourteen gate
conditions are at §5.

---

# 2. The single biggest thing this prompt would fail to get us

## It asks for illustrations. Every consumer of these files needs instruments — and the prompt actively permits the two operations that destroy an instrument.

### 2.1 The claim

RI-VIS02 and RI-VIS03 both state, in their provenance notes, the exact and only reason this
acquisition is being run:

> "The numeric target bands in the summary table are **constructed**, not measured off these
> shots. They are the honest weak point of this item. The remedy … obtain three legally-usable
> current-gen captures … run RI-VIS03's harness on them, and **replace the constructed bands
> with measured ones**." — RI-VIS02

> "Procedure: place ≥ 3 legally-usable modern frames per profile in `refs/modern/`, run the
> battery, and set each band to `[p10, p90]` of the reference population, with hard-fail
> thresholds at the anti-reference value plus 20% of the gap to the reference p10."
> — RI-VIS03

That is the deliverable. Not "pictures a critic can look at" — a **reference population per
profile**, from which order statistics are computed, so that twelve constructed bands become
twelve measured bands and every fidelity verdict in the project stops carrying the
`band: constructed` caveat.

The prompt never says this. It says "these images are the judging standard: automated critics
will place our renderer's output side by side against them, blind and unlabelled, and score us."
That describes RI-VIS06 Protocol A and nothing else. An agent reading it will optimise for
*one excellent, unambiguous, beautiful, correctly-identified image per slot* — which is exactly
what the prompt then tells it to do: "Fill **every slot** below with **at least one** verified
image", "Ten correctly-identified images beat two hundred unverified ones."

### 2.2 Limb one — the prompt permits, and in one place recommends, destroying the pixels

Three sentences do the damage.

**"PNG preferred; JPEG acceptable at quality ≥90."** Read as an instruction to an agent that has
just downloaded a 3.1 MB PNG from a Steam gallery, this reads as licence to *convert* it — and
a JPEG at q90 is a lossy 8×8 DCT quantisation. It removes precisely the high-frequency energy
that M5 measures. `NYQ_ratio = E(0.45..0.50) / E(0.20..0.45)` is the anti-aliasing detector.
JPEG q90's chroma subsampling and quantisation collapse that ratio toward zero. An
image that has been through a q90 encode will read as *better anti-aliased than it is*, which
means we would set our AA target from an artefact of the compressor and then chase it forever
with a renderer that already meets the real bar. The same applies to M4's `scale_ratio` (which
"punishes flat-spectrum noise" — JPEG adds structured, not flat, noise), to M8's `LargestFlat`
(quantisation manufactures flat 8×8 regions), and to M9's `ClipFrac` (ringing pushes pixels over
0.99). Four metrics, all of them hard-fail-carrying, calibrated against a codec.

**"1920×1080 minimum. Higher is better."** This tells the agent to prefer a 4K image and gives
it no instruction not to resize. Both directions are fatal and in opposite ways. Downsampling a
3840×2160 capture to 1920×1080 is *supersampling* — it is a 4× MSAA-equivalent operation. An
image so treated has near-zero Nyquist energy and near-perfect edges. If that becomes our AA
band, no browser renderer will ever meet it, RI-VIS03's own named failure mode fires ("thresholds
get tuned to whatever we ship"), and the metric is discredited. Upsampling is the mirror: it
manufactures the appearance of a soft, well-filtered image with no detail, which is the "plastic
world" signature (`alpha > 3.2`) — we would set the over-smoothing failure threshold from an
upscale.

**Nothing forbids re-hosted copies.** A reddit/imgur/YouTube-thumbnail copy of a screenshot is
the same subject and a different set of pixels. The prompt's verification step ("open it and look
at it") cannot see this — a heavily recompressed image looks fine at page zoom and is destroyed
at the frequencies we measure.

There is no field in the manifest that repairs any of this after the fact, because the original
bytes are gone.

### 2.3 Limb two — the sample size makes the stated purpose arithmetically impossible

`[p10, p90]` of a population of one is undefined. Of three, it is the minimum and maximum — i.e.
the band is exactly as wide as whatever two images the agent happened to find, and its width is
a property of the agent's luck rather than of current-generation rendering. RI-VIS03's hard-fail
rule compounds it: `hard_fail = anti + 0.20 × (p10 − anti)`. With N=3, `p10` is the worst of
three curated frames — and "curated" is the word that matters, because the prompt's incentives
guarantee curation. An agent told "ten correct images beat two hundred unverified" and "fill
every slot with at least one" will find the single most striking Liurnia dusk shot on the
internet. That frame is the 99th percentile of Elden Ring's own output. Setting `p10` from a
population of three 99th-percentile frames sets an unreachable floor, and the entire twelve-metric
battery becomes a document that always reads "fail" and is therefore ignored — which is the
failure RI-VIS03 §How we lose names first ("the harness is never built … the critic falls back
to adjectives") and second ("thresholds get tuned").

The fix is not "ask for more". It is to ask for a **different kind of sample**: an unbiased run.
Twelve frames taken at fixed thirty-second intervals from one continuous gameplay video, skipping
only menus and cutscenes, is a population. Twelve hand-picked gallery highlights is a highlight
reel. They will produce different bands and only one of them is a bar.

### 2.4 Why this is the biggest thing rather than one of several

Because it is the only failure that is **invisible after delivery and irreversible**. Every other
gap in this critique announces itself: a missing slot is an empty folder; a missing temporal
reference is a metric we know we cannot calibrate; a modded Morrowind shot can be caught later by
a human who knows the game. But a folder of thirty subject-correct, honestly-manifested,
recompressed-and-resized images looks like complete success. It passes the prompt's own
verification step. It passes a human review. The manifest is truthful in every field it contains.
The harness runs, the numbers come out, the bands get set, and nobody ever learns that
`M5.NYQ_ratio ≤ 0.18` was derived from a JPEG quantisation table. Every fidelity verdict for the
rest of the project then cites a measured band that is a measurement of nothing.

The prompt's own closing paragraph states the standard correctly — *"an invented reference is a
catastrophe, because every future visual verdict in this project will cite these files as ground
truth."* An unwittingly-degraded reference is the same catastrophe with none of the guilt, and it
is far more likely to happen.

**Consequence for the prompt:** the acquisition must be reframed, at the very top, from "find good
pictures of these places" to "obtain unmodified original pixels, in quantity, per scene class,
and prove you did not touch them." Everything else in §3 is downstream of that.

---

# 3. Ranked required changes

Each is written so the orchestrator can paste it. Where I give replacement text, it is literal
prompt text, not a description of prompt text.

---

## Rank 1 — ADD a byte-integrity mandate; CUT the two clauses that permit destruction

**Target:** the "Requirements for this folder" block (prompt lines 65–72).
**Cut entirely:** `"PNG preferred; JPEG acceptable at quality ≥90."` and
`"1920×1080 minimum. Higher is better. Never upscale anything — record native resolution."`
(the second is well-intentioned and half-right; it must be replaced, not kept alongside).

**Replacement text:**

```
#### File integrity — the single most important section in this document

Every one of these files is going to be fed to a script that computes a 2-D Fourier transform,
a Sobel edge map, a local-standard-deviation map, and CIELAB colour distances over its pixels.
Those numbers are how we measure anti-aliasing, texture resolution, flat shading and colour.
A JPEG re-encode or a resize changes all of them by more than the difference we are trying to
measure. This is not a quality preference. A resized or re-encoded image is not a weaker
reference; it is a measurement of the resizer.

Therefore:

- **Commit the exact bytes you downloaded.** Do not convert format. Do not re-encode. Do not
  resize, crop, rotate, sharpen, denoise, colour-correct, or strip metadata. If a file is a
  JPEG, commit the JPEG. If it is a 3.1 MB PNG, commit the 3.1 MB PNG. We do the converting.
- **Take the original, not a copy of it.** Follow "view original" / "download full size" /
  "original resolution" links. Never take a thumbnail, a preview, a lightbox render, a
  social-media re-host, a Reddit or Imgur mirror, or a video thumbnail when the original is
  reachable. If you can only reach a re-hosted copy, take it and set
  `"provenance_chain": "rehosted"` in the manifest.
- **Prefer the largest file for the same frame.** Between two copies of the same screenshot,
  take the one with more bytes per pixel. Record `bytes_per_pixel` for every file (the script
  in §8 computes it). Below 0.5 bpp on a JPEG means the image has been heavily recompressed;
  keep it only if nothing better exists and set `"heavily_recompressed": true`.
- **No resolution minimum and no resolution maximum.** Take whatever the original is and record
  it. A native 1600×900 capture is worth more to us than a 4K image that was upscaled to get
  there, and far more than a 4K image downsampled to 1080p by an uploader — downsampling is a
  form of anti-aliasing and would set us an anti-aliasing target that no renderer produced.
- **SDR only.** No HDR screenshots (`.jxr`, HDR PNG, or anything a source page describes as
  HDR). A tone-mapped HDR grab has a brightness distribution no player ever saw, and brightness
  distribution is one of the things we measure.
- **No screenshots of screens.** No phone photos of monitors, no capture-card overlays, no
  streaming-service frames with an encoder logo.
```

**Why:** §2.2. This is the change without which every other change is decoration.

---

## Rank 2 — REPLACE the sample-size instruction with per-profile floors and an anti-curation sampling rule

**Target:** prompt lines 50–52 (`Fill **every slot** below with **at least one** verified image;
2–3 alternates per slot is better (name them -alt1, -alt2)`) and line 26
(`Ten correctly-identified images beat two hundred unverified ones.`).

**Cut** line 26's second sentence. It is the sentence that will cause the failure in §2.3. Replace
it with: `Correct identification is a gate, not a substitute for count — an unverified image is
worth nothing, and so is a single verified one.`

**Replacement text for lines 50–52:**

```
### How many, and how to choose them

We are not illustrating a document. We are estimating the 10th and 90th percentile of several
image statistics per scene class, so that a numeric band can be set. A band cannot be estimated
from one image. From three, the 10th and 90th percentile are just the smallest and largest value
you happened to find — which is the same as having no band at all.

**Hard floors. A folder below its floor is an unfilled slot and must be reported as one.**

| Folder under `refs/modern/` | Minimum images | Min. distinct games | Min. distinct locations |
|---|---|---|---|
| `exterior_daylight`      | 12 | 3 | 6 |
| `exterior_lowlight`      | 12 | 3 | 6 |
| `interior_darkemissive`  | 10 | 2 | 5 |
| `character_closeup`      | 10 | 2 | 6 |
| `combat`                 |  8 | 2 | 4 |
| `material_closeup`       |  8 | 2 | 6 |

**The anti-curation rule — read this one twice.** In each folder, **at least half** the images
must come from an *unbiased run*: choose one continuous gameplay video or one continuous
screenshot series, and take frames at fixed intervals — every 30 seconds, or every Nth image in
the series — **regardless of whether the frame is attractive**. Skip a sampled frame only if it
is a menu, a cutscene, a loading screen, HUD-covered, or almost entirely black. Name these files
`run-<source-slug>-t<seconds>.<ext>` and set `"sampling": "interval-run"`. The remaining images
may be deliberately chosen and are marked `"sampling": "selected"`.

This rule exists because the natural thing to do — find the most beautiful shot of each place —
produces a set of 99th-percentile frames, and a bar built from 99th-percentile frames is a bar
nobody can reach, which is a bar everybody eventually ignores. **We would rather have twelve
ordinary frames than one magnificent one.** An ordinary frame of a current-generation game is
still a current-generation frame, and it is the honest bar.

Morrowind (`refs/morrowind/`) is different: it is judged on design language, not statistics.
Three to five images per slot is right there, and they may be deliberately chosen.
```

**Why:** §2.3.

---

## Rank 3 — ADD a temporal request. Rule: video clips, yes; frame-exact sequences, no; and label them so nobody runs still-metrics on them

**Ruling on the medium question.** Four properties in RI-VIS01 are inherently temporal and no
still image can calibrate them: F07 (LOD pop — RI-VIS03 M11 is defined over a 120-frame dolly),
F10 (animation — the whole of RI-VIS08 §C), F12's `TemporalVar` (RI-VIS03 M12, defined over 30
stationary frames), and F13's wind term (RI-VIS04 §11's `ANIMATED_MASK_EMPTY` detection). RI-CAM07
C8 (recovery legibility over ≥3600 frames) is temporal too. The prompt as written asks for the
wrong medium for all of them and does not say so, which means a critic will later reach for
`refs/` to calibrate M11 and find nothing, with no record that nothing was ever possible.

**Is video obtainable? Yes, with a caveat that must be stated in the prompt.** Publisher-uploaded
gameplay, Digital Foundry analysis videos (high-bitrate capture, frequently with frame-step
segments), press "gameplay walkthrough" uploads and GDC talks are all reachable. But every one is
delivered through a lossy inter-frame codec, and an inter-frame codec both *erases* small pop
events (the encoder smooths them) and *manufactures* them (I-frame boundaries produce
frame-to-frame deltas across the whole image). So:

- **Video is admissible for temporal *qualitative* judgement and for coarse temporal statistics**
  (does foliage move at more than one frequency; do feet slide; is there a visible LOD ring; does
  water surface luminance vary).
- **Video frames are never admissible as still-metric inputs.** They must be marked so that no
  future harness run can accidentally use them.

**Replacement text (new section, place immediately after the fidelity slot table):**

```
#### `corpus/70-visual/refs/video/` — short clips, for motion only

Some of the things we measure do not exist in a still image: how badly distant geometry pops in
as the camera moves, whether foliage moves in the wind at more than one frequency, whether water
surfaces change frame to frame, and whether characters' feet stay planted when they walk. We
cannot judge any of these from a screenshot, so we need a small number of short clips.

Get **four to eight clips**, 20–60 seconds each, at the highest bitrate and resolution available,
downloaded as-is (again: do not re-encode, do not trim, do not convert — commit the file the
downloader produced). Prefer, in this order: a publisher's or developer's own channel; Digital
Foundry or a comparable technical-analysis channel (they capture at high bitrate and often state
the capture settings); a large gameplay channel that states its capture setup; anything else.

| Clip | What it must contain | What we measure from it |
|---|---|---|
| `V1-dolly` | camera moving forward continuously through an open landscape for ≥20 s, no cuts, no HUD | LOD pop-in and streaming: does distant geometry appear as a visible ring or a hard swap |
| `V2-static` | camera **stationary** for ≥15 s looking at water and vegetation, no cuts | water surface motion, wind on foliage at multiple frequencies, ambient particles |
| `V3-locomotion` | a third-person character walking, running, stopping and turning 180°, including on stairs and a slope, seen from behind | foot planting, foot sliding, blend between animation clips, secondary motion of cloth |
| `V4-combat` | ≥15 s of continuous third-person melee combat, no cuts | impact, hit reaction, attack commitment, effects |
| `V5-timelapse` (optional) | an in-game day/night transition | sky model behaviour across time of day |

For every clip, record in the manifest: `duration_s`, `container`, `video_codec`, `bitrate_kbps`,
`fps`, `width`, `height`, `source_url`, `uploader`, `game`, and **`"pixel_metrics_valid": false`**.
That last field is mandatory and is always `false` for video and for any frame extracted from
video: the compression makes per-pixel measurements meaningless, and a still extracted from a clip
must never be placed in `refs/modern/`.

If you cannot obtain a clip for a row, say so. A missing clip is a known gap; a still image
substituted for one is a silent wrong answer.
```

**Additional instruction for the orchestrator (not prompt text):** RI-VIS03 M11 and M12's
`TemporalVar`, RI-VIS08 §C1–C10 and RI-CAM07 §C8 must have their provenance notes amended to
record that reference calibration for these is **not obtainable from external sources at
frame-exact fidelity**, and that their thresholds remain `constructed` against the harness
anti-reference only. Otherwise a future critic will treat "uncalibrated" as "somebody forgot".

---

## Rank 4 — ADD the missing fidelity slots. Seven of the eight canonical viewpoints are served; four scene classes the game will actually be screenshotted in are not

**Target:** the `REF-M1..REF-M7` table (prompt lines 55–63).

Checked against RI-VIS02's pairing table, the current seven cover `exterior_marsh_dusk`,
`foliage_dense`, `water_edge`, `interior_rootway`, `character_closeup`, `xanmeer_vista`, and
partially `exterior_marsh_noon`. **`combat_midfight` has no reference at all** — RI-VIS02 pairs
it with `REF-M6 + REF-M2`, which is a character portrait plus a forest, neither of which contains
combat, effects, two figures, or motion. And `exterior_marsh_noon` is paired with REF-M3, which
the prompt specifies as *mid-morning god rays through birches* — a strongly directional,
high-contrast, high-chroma autumn scene, whereas RI-VIS05's declared default weather for our
world is **"Noon (overcast — the default)"**. We would be calibrating our flattest, most diffuse,
lowest-contrast scene class against the most dramatic reference available.

**Add these rows** (IDs continue RI-VIS02's series; the orchestrator must register REF-M9..M19 in
RI-VIS02 §The reference artifact, see Rank 17):

```
| `REF-M9`  | **The Witcher 3 — Velen / Crookback Bog**, overcast day | A second engine's wet environment; the canonical "fantasy swamp", so also the thing we must not converge on | `exterior_daylight` |
| `REF-M10` | **Skyrim SE — Hjaalmarch / the marsh around Morthal**, overcast, vanilla | The single closest thing to our subject in the franchise we are most at risk of resembling | `exterior_daylight` |
| `REF-M11` | **Elden Ring — Swamp of Aeonia or Lake of Rot** | Hostile shallow-water environment with emissive and particulate; our Blackrot Mire analogue | `exterior_lowlight` |
| `REF-M12` | **Red Dead Redemption 2 — Bayou Nwa at midday**, clear or hazy | The same wetland as REF-M4 at the opposite end of the lighting range | `exterior_daylight` |
| `REF-M13` | **Horizon Forbidden West — any wetland, mangrove or flooded ruin** | A third engine; best-in-class water and dense wet vegetation | `exterior_daylight` |
| `REF-M14` | **Any of the above games — a flat, overcast, no-direct-sun exterior at midday** | Our declared default weather. Nothing else in this list is diffuse-lit, and diffuse light is the hardest lighting to fake | `exterior_daylight` |
| `REF-M15` | **A night exterior with moonlight**, no artificial light source dominating | We have a night sky and no reference for it; low-light exteriors are where flat shading hides | `exterior_lowlight` |
| `REF-M16` | **Falling weather** — rain or a storm, with visible precipitation and wet surfaces | Weather particles, wet-material response, and rain interacting with water | `exterior_lowlight` |
| `REF-M17` | **Active melee combat**, third person, two or more figures on screen, effects visible, no HUD | This is our `combat_midfight` shot and it currently has no reference at all | `combat` |
| `REF-M18` | **Material close-ups filling the frame** — at minimum: wet bark, mud or wet soil, wet stone, a standing-water surface, cloth or leather. One file each. | The blind protocol crops both images to a subject-neutral patch of surface; without these there is nothing to crop | `material_closeup` |
| `REF-M19` | **Water at a shoreline, camera low**, so that the same frame contains both near water seen steeply from above and far water seen at a grazing angle | Our water measurement compares those two regions inside one frame. A wide vista of water cannot supply it | `exterior_daylight` or `exterior_lowlight` |
```

**Also amend REF-M3's row** so it does not silently become our noon reference alone: add
`(this is a directional-light, high-chroma reference; REF-M14 is the diffuse counterpart and both
are required)`.

**Ruling on the Black Marsh gap (question 6).** One wet-environment reference for a game set
entirely in a swamp is not enough, and REF-M4 being RDR2 means our entire wetland bar comes from
one engine's water shader and one studio's art direction. REF-M9/M11/M12/M13/M19 above bring it to
**six wetland references across four engines**, which is enough for a per-profile population.
ESO's Shadowfen/Murkmire is handled separately at Rank 13 — it is not a fidelity reference.

---

## Rank 5 — RESTRUCTURE the prompt so a skimming agent still gets the non-negotiables right

**Target:** the whole document's order. At present, "never modify the bytes" will not exist,
"folders are the enforcement" is one sentence in the middle of a paragraph on line 45, "vanilla
only" is on line 87 after two tables, and the sample-size rule is buried in a lead-in sentence.
An agent that skims will read the tables and the manifest schema, because those are the parts
that look like specifications.

**Replacement: insert this block immediately after the `Write everything under:` line, before
"The project, briefly".**

```
## READ THIS EVEN IF YOU READ NOTHING ELSE

Ten rules, in priority order. Everything after this section elaborates them.

1. **NEVER MODIFY AN IMAGE FILE.** No resize, no crop, no format conversion, no re-encode, no
   sharpening, no metadata stripping. Commit the exact bytes you downloaded. These files are
   measured by scripts; editing one destroys the measurement. If an image seems to need
   editing, it needs rejecting instead.
2. **Take the original, not a copy.** Follow "full size" / "view original" links. Never a
   thumbnail, never a social-media re-host, never a video thumbnail.
3. **Folders are the enforcement.** `refs/modern/` is current-generation games only.
   `refs/morrowind/` is vanilla Morrowind (2002) only. A file in the wrong folder silently
   corrupts every future judgement that cites it, and no manifest field undoes it.
4. **Counts are hard floors, not targets.** We compute statistical bands from these images. A
   slot with one perfect image is a FAILED slot. See §3.
5. **Do not curate for beauty.** At least half of each folder must come from evenly-spaced
   sampling of one continuous session or video, chosen without regard to how good the frame
   looks. See §3.
6. **Gameplay, not marketing.** No press kits, no bullshots, no trailers, no key art, no
   pre-rendered cinematics, no concept art, no box art, no fan art, no AI generations.
7. **No HUD** in the primary folders. HUD-bearing images go in `hud/` and are never compared.
8. **Vanilla only, both sides.** No ENB, no ReShade, no texture packs, no mesh replacers, no
   AI upscales. For Morrowind, §6 gives you seven mechanical tests. Run all seven.
9. **Every numeric field in the manifest is produced by a script you also commit.** Do not
   type a resolution, a byte count or a hash by hand. If you cannot measure it, write
   `"unknown"`.
10. **An empty slot honestly reported is a success. An invented, mislabelled or silently
    degraded reference is a catastrophe** — every future visual verdict in this project cites
    these files as ground truth.

If you run out of time or budget, satisfy rules 1–5 on fewer slots rather than rules 6–10 on
more. Depth beats breadth; correctness beats both.
```

Then number the remaining sections `§1 The project`, `§2 Where things go`, `§3 How many`,
`§4 Fidelity slots`, `§5 Art-direction slots`, `§6 Morrowind vanilla tests`, `§7 Video`,
`§8 Verification`, `§9 Deliverables`, `§10 Commit`, so the cross-references above resolve.

---

## Rank 6 — ADD the missing art-direction slots. Eight is not enough, and three of the nine ART properties currently have no image at all

**Target:** the `REF-A1..REF-A8` table (prompt lines 76–85).

Checked against RI-VIS05, the eight slots serve P02 (partly), P03 (partly), P04 (one creature),
P05 (one vista), P06. They do **not** serve **P07 (flora design)** at all — despite RI-VIS05 §D
being an entire specification of flora, §D3's wrongness test being one of six scored components,
and "the green trap" being named as the most likely single art-direction failure. They do not
serve **P09 (UI/iconography)** at all — despite RI-VIS05 §H specifying incised glyph forms, no
minimap, carved icons and a slab/incised typeface as a transposition *of Morrowind's UI*, which
nobody on this project can check without seeing it. And P03 is missing its single most important
row: RI-VIS05 §B's transposition table derives the **xanmeer** — the one built thing in our world
— from **Velothi/Temple ancient stepped stone**, which is not in the slot list. We have Redoran
and Telvanni and Dwemer, and not the one the whole setting's architecture descends from.

**Add these rows:**

```
| `REF-A9`  | **Velothi / Temple ancient stone** — a Velothi tower, an ancestral tomb entrance, or a High Fane / Temple exterior. Stepped, angular, older than everything around it. | This is the direct ancestor of our world's only built architecture. It is the most important single row in this table. |
| `REF-A10` | **Plant life, close** — at least four separate images: a fungal tower/emperor parasol, mushroom growths on a trunk, a small ground plant (ash yam, marshmerrow, trama root), and a kelp/organic growth. | Our flora specification is a transposition of these. Nothing else in the list shows a plant at readable size. |
| `REF-A11` | **Bitter Coast swamp specifically** — the boardwalks, the standing water, the mushroom trees, the low fog. Not the Ascadian Isles. | Morrowind's own wetland is the direct art-direction ancestor of our fen. It must be its own slot, not an alternative to REF-A1. |
| `REF-A12` | **The interface** — at least three images: the journal open, the inventory/paperdoll, and a book or scroll page showing the typeface and the Daedric script. | We have a written specification for our UI that is defined as a transposition of this one, and no one on this project has seen it. |
| `REF-A13` | **Armour, weapons and clothing** — a character or paperdoll wearing bonemold or chitin armour; a glass or ebony weapon; ordinary common clothing on a townsperson. | The player's equipment vocabulary is specified as a transposition of these. Generic plate-and-longsword is on our forbidden list and this is the only thing that shows what replaces it. |
| `REF-A14` | **A silt strider**, whole, with a person nearby for scale. | The in-fiction transport form. It is the clearest single example of "a creature doing a civic job", which our travel system copies. |
| `REF-A15` | **Two more interiors, of different kinds** — a Telvanni tower interior (grown, organic, no right angles) and a poor shack or fisherman's hut. With REF-A4 that makes three interiors of three different vocabularies. | One interior cannot show that interiors differ by faction and class, which is the property we are copying. |
| `REF-A16` | **A dusk or night exterior.** | Our palette specification declares dusk and night colour targets. Every requested Morrowind shot so far is daylight. |
| `REF-A17` | **A stilted or waterside settlement** — Hla Oad, Vos, Seyda Neen's shacks, or any village built over water. | Our fen villages are specified as "stilted lashed" and this is the source vocabulary. A generic town street (REF-A8) does not show it. |
```

**Also amend REF-A6** (creature close-up) from `cliff racer, netch, kwama, guar, silt strider`
(pick one) to: `**at least four separate creatures**, one file each — a netch, a kwama or other
insect, a guar or other beast of burden, and a cliff racer or other flying thing.` One creature
does not demonstrate a creature *design language*; four do.

---

## Rank 7 — REPLACE "open it and look at it" with mechanical checks the agent can actually run, and require the output as a committed artifact

**Target:** the "Verification — do not skip this" section (prompt lines 96–106).

"Look at it" cannot detect: recompression, resampling, upscaling, HDR tone-mapping, AI
generation with clean subject matter, or a re-hosted copy. It can detect wrong-game and
concept-art, which is why it should be kept — as step 2, not as the whole method.

**Replacement text:**

```
### §8 Verification

Verification is a script plus a human look, in that order, and both are committed.

**8a — The integrity script.** Write `refs/make-manifest.py` (or `.mjs`) and commit it. It walks
every file in `refs/` and produces, per file, without you typing any of it:

    bytes, sha256, format, width, height, bit_depth, has_alpha
    bytes_per_pixel     = bytes * 8 / (width * height)
    jpeg_quality_est    = estimated from the quantisation tables, if JPEG
    exif_software, exif_datetime, xmp_present, c2pa_present
    nyq_ratio           = 2-D FFT of the luminance channel;
                          energy in radial frequency [0.45,0.50) divided by energy in
                          [0.20,0.45). A value near zero means the image was upscaled,
                          downscaled or blurred and cannot be used to judge edge quality.
    upscale_test        = box-downsample to 2/3 size, bilinear-upsample back, take
                          mean |difference| in 0..1 luminance. Below 0.004 means the image
                          carries no real detail at its stated resolution: it was upscaled.
                          REJECT the file.
    block_score         = mean |horizontal gradient| across 8-pixel-aligned column boundaries
                          divided by the same across non-aligned boundaries. Above 1.15 means
                          JPEG block artefacts are visible in the pixels we measure.

Any file with `upscale_test < 0.004`, or `exif_software` naming an image editor or a generative
tool, or `c2pa_present` true, is **rejected** and recorded in the rejection log — not committed
to a primary folder.

**8b — Source corroboration.** For every file, one of these three must be true, and you record
which one in `"corroboration"`:
  - `"first-party"` — the source is the publisher, the developer, the official wiki, or the
    game's own store page;
  - `"two-hosts"` — you found the same image on two independent sites that are not mirrors of
    each other;
  - `"pre-2023-page"` — the hosting page carries a visible date before 2023-01-01.
An image satisfying none of the three is not committed. This is the anti-AI-generation check and
it is far more reliable than looking at the image, because a modern generated image of a
landscape looks correct and has no history.

**8c — Identification.** For every file, name three concrete things you can see that identify the
game and the place: a named landmark, a distinctive creature, an architectural style, a UI
element, a specific weapon or armour set. Put them in `"identified_by": ["...","...","..."]`.
If you cannot name three, you have not identified the image and must not commit it. A file named
`morrowind-vista.jpg` is very frequently Oblivion, Skyrim, or an unrelated fantasy game.

**8d — Then look at it.** Open every file and confirm it is an in-game render — not concept art,
box art, fan art, a painting, a map, a mod-page banner, a pre-rendered cinematic, or a
generated image. Confirm the subject matches the slot. Confirm it is in the right folder.

**8e — Promotional and photo-mode screening.**
  - Marketing shots are rendered at settings no player sees and would set a dishonest bar.
    Signals: hosted on a press or media CDN; filenames like `screenshot_01`, `press`, `keyart`;
    a camera position no player camera can reach; no HUD in an era when the game always had one;
    unnatural depth of field on a landscape. If you can only find a promotional image for a
    slot, keep it and set `"promotional": true` — and it will not be used for band calibration.
  - Photo mode is **acceptable only with every photo-mode effect disabled**: no depth of field,
    no filter, no film grain, no vignette, no border or frame, no tilt, no zoom. Photo mode is
    not automatically preferable — it changes exposure and field of view on several games.
    Record `"photo_mode": true|false|"unknown"` and `"photo_effects_disabled": true|"unknown"`.
  - If a source page or video description says an upscaler was in use (DLSS, FSR, XeSS) prefer a
    different image; either way record `"upscaler": "dlss"|"fsr"|"xess"|"off"|"unknown"`.
```

---

## Rank 8 — REPLACE "judge by eye" for Morrowind with seven mechanical vanilla tests, and remove the resolution floor from that folder

**Target:** prompt lines 87–94.

The current text ("vanilla 2002 Morrowind has low-polygon models, 256px-era textures, hard-edged
shadows or none, and a distinctive washed palette") is true and not operable — an agent that has
never seen the game cannot apply it, and the most common mods change exactly those things. There
are much sharper tells.

**Replacement text:**

```
**VANILLA ONLY — and here is how to tell.** The internet is full of heavily-modded Morrowind
screenshots with modern shaders, 4K texture packs and replaced meshes. Those are worse than
useless: they would replace our art-direction reference with somebody else's art direction.

An image is vanilla only if **all seven** of these are true. Check each one explicitly and record
the results as `"vanilla_tests": {"V1": true, ...}`. Any single failure means modded.

  V1  **No grass.** Vanilla Morrowind has no grass anywhere in the game — the terrain is bare.
      Visible grass tufts mean a groundcover mod. This is the fastest and most reliable test.
  V2  **No distant land.** Vanilla draws a fog wall a few hundred metres out; you cannot see a
      crisp distant mountain range or coastline. A legible far landscape means MGE XE or an
      OpenMW distant-land configuration.
  V3  **No cast shadows** from buildings, trees or terrain. Nothing casts a shadow onto anything
      else.
  V4  **Water does not mirror the world.** Vanilla water is an animated tinted surface. If you
      can see trees or buildings reflected in it, it is a water shader mod.
  V5  **Textures are visibly low resolution.** Zoom in on a door, a wall panel, or a rug: the
      texels should be obviously blocky.
  V6  **No bloom, no depth of field, no ambient occlusion, no colour grading, no lens effects.**
  V7  **Plausible resolution.** Above 1920×1080 is a strong signal of MGE XE or OpenMW; above
      2560×1440 is effectively proof.

**OpenMW running unmodified vanilla assets is acceptable** — it is an engine reimplementation,
not an art change. Record `"engine": "openmw-vanilla-assets"`. OpenMW with distant land enabled
still fails V2; record `"engine": "openmw-distant-land"` and note that it is usable for
silhouette and palette but not for composition or draw distance.

**There is no resolution minimum in this folder, and larger is not better.** A 1024×768 vanilla
screenshot is worth more to us than a 4K modded one. Do not reject an image for being small.
Reject it for being modified.

If you cannot confirm all seven, set `"vanilla_confidence": "low"`, say which tests you could not
run and why, and place the file in `refs/morrowind/unconfirmed/` rather than in a slot folder.
```

---

## Rank 9 — ADD framing and comparability requirements

**Ruling on question 4: yes, comparability is required, and the prompt currently demands none of
it.** RI-VIS06 §D lists "resolution / aspect mismatch" as a leak vector that must be asserted
mechanically before a blind run, and several RI-VIS03 metrics are direct functions of framing:
`M10.R_aerial` is the ratio of far-band to near-band local contrast and is meaningless if the
reference has no near band; `M7` is skipped entirely if `sky_frac < 0.02`; `M1`'s mean-luminance
band is *per profile*, so a shot taken at the wrong time of day fails the band for reasons that
have nothing to do with rendering; and `M4`/`M5` measure detail per pixel, so a telephoto shot
reports higher texture quality than a wide shot of the identical surface. A telephoto sunset
paired against our wide noon vista is not a comparison, it is a category error with a number
attached.

**Replacement text (new subsection under §4):**

```
#### Framing — this decides whether a comparison is fair at all

Our own screenshots are 16:9, taken from roughly eye height, at a normal third-person field of
view, with something in the foreground within a few metres, and — for exteriors — sky in the top
of the frame. A reference that does not roughly match those conditions cannot be compared with
ours, because several of the things we measure are functions of framing rather than of rendering:
a shot with no foreground has nothing to compare distant contrast against; a zoomed shot puts
more pixels on the same surface and therefore reports better texture quality than the identical
surface shot wide; a shot with no sky cannot be used to judge the sky.

So, for `refs/modern/`:
  - **16:9.** If it is 21:9, 4:3 or square, keep it only if nothing better exists and set
    `"aspect_mismatch": true`.
  - **Normal field of view.** Reject obvious telephoto, obvious fisheye, scoped or spyglass
    views, and photo-mode zoom.
  - **A foreground element within a few metres**, except in `material_closeup`.
  - **Visible sky in the top 10% of the frame** for every `exterior_*` image.
  - **A roughly level camera.** Reject heavy tilts, top-down shots and ground-level art shots.
  - **The stated time of day decides the folder, not the slot.** A Liurnia shot taken at noon
    goes in `exterior_daylight`, not in `exterior_lowlight` because REF-M1 says dusk. Put it in
    the folder that matches the light and record the slot it was collected for.
```

---

## Rank 10 — FIX the output paths. Two of the three the prompt names are wrong, and one collides with a directory the harness owns

**Target:** prompt line 30 and the folder names on lines 53 and 74.

- RI-VIS02 and RI-VIS03 both name **`refs/modern/`** as the destination for reference frames
  ("place ≥ 3 legally-usable modern frames per profile in `refs/modern/`"). The prompt writes to
  `refs/fidelity/`, which no corpus item references. The calibration script will look in
  `refs/modern/` and find an empty directory.
- **`refs/anti/`** is claimed by the harness for the generated Three.js anti-reference
  (`refs/anti/threejs-default.png`, RI-VIS02 REF-M8). The prompt does not mention it, so nothing
  currently prevents Codex writing there.
- Because RI-VIS03's bands are **per profile**, the fidelity folder must be organised by profile,
  not by slot. That makes the calibration a directory walk and makes the count floors visible to
  the agent as "how many files are in this folder".

**Replacement text for the destination block:**

```
**Write everything under:** `corpus/70-visual/refs/`, in exactly this layout. Do not invent
other directories.

corpus/70-visual/refs/
  modern/                     current-generation fidelity references
    exterior_daylight/        bright exteriors, sun up, sky visible
    exterior_lowlight/        dawn / dusk / night / heavy overcast exteriors
    interior_darkemissive/    caves and interiors lit mainly by emissive sources
    character_closeup/        one character filling >= 40% of frame height
    combat/                   active melee combat, 2+ figures, effects on screen
    material_closeup/         one surface filling the frame
    hud/                      otherwise-good images that have a HUD; kept, never compared
  morrowind/                  vanilla Morrowind 2002 only
    <one folder per REF-A slot>
    unconfirmed/              could not confirm vanilla; kept, never cited
  anti-generic/               the negative art-direction anchor (see §5c)
  context/                    subject-matter orientation only, neither side (see §5d)
  video/                      short clips, motion measurements only
  rejected/                   files you obtained and then rejected, with reasons in the report
  MANIFEST.json
  ACQUISITION-REPORT.md
  make-manifest.py            the script that produced MANIFEST.json

**`corpus/70-visual/refs/anti/` is reserved for a file our own harness generates. Do not create
it and do not write into it.**
```

---

## Rank 11 — FIX REF-M6: it must be the character from behind, in the world

**Target:** prompt line 62.

RI-CAM07 exists because seam S18 puts the player's body on screen in every frame, from behind, at
2–4 m — and its §B1–B5 measure **the back**: back texel density relative to the front, back
material separation, at least four silhouette-breaking elements on the back, back normal/AO
detail, and a sheathed weapon visible from behind. The current wording ("third-person character
close-up, armoured, 2–3 m from camera") plus the suggested source ("any Fextralife armour-set
page") will produce a front-facing model shot on a neutral background from an equipment menu —
which is a menu render, not a gameplay frame, and shows the one surface we do not need.

**Replacement text:**

```
| `REF-M6` | **A third-person character seen from behind, in the world** — the normal
over-the-shoulder gameplay view, character filling 40–70% of frame height, armoured or clothed,
standing on real ground with real lighting. **Not** an equipment-menu render, not a character
sheet, not a neutral-background turntable, not a front-facing portrait. At least half of this
folder must be back or three-quarter-rear views. | Our camera is behind the player 100% of the
time; the back of the character is the most-looked-at surface in our game and the one we have no
reference for. | `character_closeup` |
```

---

## Rank 12 — ADD `anti-generic/`: the negative art-direction anchor

RI-VIS02 has REF-M8, a deliberate *anti*-reference, and requires every fidelity metric to be
reported as the triple `(anti-reference value, our value, target band)` so the critic can see
whether we have moved off the floor. RI-VIS05 has an equivalent floor concept — §F's forbidden
forms and §C's forbidden palette anchors — and **no anti-reference image whatsoever**.
`ForbiddenHits` is a computed quantity (`fraction of pixels within ΔE2000 ≤ 10 of a forbidden
anchor`) with a hard-fail threshold of `> 0.06`, and nobody has ever measured it on a frame that
is *known* to be generic fantasy. We do not know whether 0.06 is a strict bar or an unreachable
one.

**Replacement text (new subsection):**

```
#### §5c `corpus/70-visual/refs/anti-generic/` — what we must NOT look like

Four to six images, each a clear, unembarrassed example of generic fantasy: a stone castle with
crenellations and a portcullis; a half-timbered fantasy village with pitched roofs and a cobbled
street; a "fantasy swamp" with bright green ferns and saddle-brown mud; a knight in polished
plate armour with a longsword and a kite shield; a snow-capped mountain range over a pine forest.
Any game, any era, any quality — the more archetypal the better.

These are the **negative** anchor: the thing we measure ourselves *away* from. They are not a
target and are never cited as one. They live in their own folder precisely so they cannot be
mistaken for either reference set. Set `"side": "anti-generic"` on every one.
```

---

## Rank 13 — ADD ESO Shadowfen/Murkmire — in `context/`, on neither side, with an explicit warning

**Ruling on question 6b.** Yes, request it. No, not as a fidelity reference and not as an
art-direction reference.

- **Not fidelity.** ESO is a 2014 MMO engine with a hard console-generation budget. Putting it in
  `refs/modern/` would drag the `[p10, p90]` bands down and hand a future builder the argument
  "we are within the reference population", which is RI-VIS03's named failure ("thresholds get
  tuned to whatever we ship") arriving through the front door.
- **Not art direction.** RI-VIS01's partition and RI-VIS05's side declaration are absolute: art
  direction is judged against Morrowind 2002 plus our own transposition spec. ESO's Murkmire is
  somebody else's transposition of the same source. Admitting it as an art reference would mean
  we are copying a copy, and RI-VIS05 §B's whole method — derive from the lore chain
  environment→material→architecture→silhouette — would be replaced by "look at what ESO did".
- **But it is the single most relevant piece of subject-matter information available**, because
  it is the only existing realisation of xanmeers, Hist, Argonian material culture and Black
  Marsh vegetation in a 3-D engine. Our team needs to see it for one specific reason: **it is the
  obvious answer, and the obvious answer is the one we must not converge on.** If our xanmeer
  looks like ESO's xanmeer, we did not do the transposition; we did a search.

**Replacement text (new subsection):**

```
#### §5d `corpus/70-visual/refs/context/` — orientation only, cited by nobody

Six to ten screenshots of **The Elder Scrolls Online: Shadowfen and Murkmire** (2014 and 2018).
These are the only existing depictions of the actual region our game is set in: the stepped stone
ziggurats, the Hist trees, the Argonian villages, the marsh vegetation.

They are **neither** a fidelity reference **nor** an art-direction reference, and this is not a
technicality:
  - not fidelity, because it is a 2014 MMO engine and using it would lower our bar;
  - not art direction, because our art direction descends from Morrowind (2002) plus our own
    written specification, and ESO is somebody else's transposition of the same source.

Their value is the opposite of a target: they show us **the obvious answer**, which is the one we
must not arrive at. Mark every file `"side": "context-neither"` and
`"forbidden_for": ["fidelity-bands", "art-direction-judgement", "blind-pairing"]`. Say in the
report that they are in the repository for orientation and as an originality check, and for
nothing else.
```

---

## Rank 14 — REWRITE the manifest record; every numeric field must be script-produced

**Target:** the JSON block at prompt lines 115–136.

The current record is good and is missing everything the changes above introduce. Also,
`licence_note` repeated verbatim per record is pure length; replace with an enum and state the
position once in the report.

**Replacement text:**

```json
{
  "id": "REF-M4",
  "path": "modern/exterior_lowlight/REF-M4__rdr2-bluewater-marsh-dawn.png",
  "slot": "REF-M4",
  "side": "modern-fidelity",
  "profile": "exterior_lowlight",
  "sampling": "selected",
  "game": "Red Dead Redemption 2",
  "depicts": "Bluewater Marsh at dawn, mist over standing water, cypress silhouettes",
  "identified_by": ["bald cypress with buttress roots", "Lemoyne architecture on the far bank",
                    "the Bluewater Marsh shack"],

  "source_url": "https://...",
  "source_page": "https://...",
  "author_or_uploader": "name or unknown",
  "corroboration": "two-hosts",
  "provenance_chain": "original",
  "capture_date": "2019-05 or unknown",

  "format": "png",
  "bytes": 4192883,
  "width": 2560, "height": 1440, "bit_depth": 8, "has_alpha": false,
  "bytes_per_pixel": 9.1,
  "jpeg_quality_est": null,
  "sha256": "...",
  "nyq_ratio": 0.121,
  "upscale_test": 0.0193,
  "block_score": 1.02,
  "exif_software": null, "c2pa_present": false,
  "heavily_recompressed": false,
  "modified_by_me": false,

  "promotional": false,
  "has_hud": false,
  "photo_mode": false,
  "photo_effects_disabled": null,
  "upscaler": "unknown",
  "aspect_mismatch": false,
  "foreground_present": true,
  "sky_visible": true,
  "pixel_metrics_valid": true,

  "modded": false,
  "vanilla_tests": null,
  "vanilla_confidence": "n/a",
  "engine": "native",
  "licence": "publisher-copyright-internal-critique"
}
```

Followed by:

```
**`modified_by_me` must be `false` on every record.** If it is ever `true`, say in the report
exactly what you did and why; a `true` here means the file is not usable for measurement.

Every field from `format` through `c2pa_present` is produced by `make-manifest.py`. Do not type
them. `"unknown"` is a valid and respectable value for anything you could not determine. Do not
invent a source URL, an author, a date or a licence.
```

---

## Rank 15 — ADD a rejection log and a stop condition to the acquisition report

**Target:** the "Deliverables" §3 list (prompt lines 141–147).

The rejection log is the highest-value artifact in the whole delivery and is not currently
requested. It tells us what the internet *does not have*, which is the information that decides
whether our bands can ever be measured at all.

**Add:**

```
The report must additionally contain:

- **A per-folder count table** showing, for every folder, the required floor from §3, the number
  actually delivered, and PASS/SHORT. This is the first thing we will read.
- **A rejection log.** Every file you obtained and then did not commit: the URL, the slot you
  wanted it for, and the specific reason (failed `upscale_test`; C2PA metadata present; modded
  Morrowind failing V1; wrong game; promotional; HUD; could not corroborate; telephoto). Err
  heavily toward over-reporting. A long rejection log is a sign of a good run, not a bad one.
- **A "could not be obtained" section** naming the things that appear not to exist in usable
  form anywhere, with what you searched.
- **The copyright position**, stated plainly and once: these are screenshots of commercial games,
  held under their publishers' copyright, retained here solely for internal comparison and
  critique. Do not claim a licence that does not exist and do not apply an open-source licence
  to them.

**Stop condition.** If, after a genuine effort, more than half the folders in §3 are below their
floor, **stop and report** rather than padding the shortfall with re-hosted, promotional or
low-confidence images. A half-filled honest set is repairable. A full set with a quarter of it
quietly degraded is not, because we will not know which quarter.
```

---

## Rank 16 — CUTS

Prompt length is a real cost and every one of these dilutes the rules above.

| Cut | Line(s) | Why |
|---|---|---|
| `"Ten correctly-identified images beat two hundred unverified ones."` | 26 | The single most damaging sentence in the document; it licenses N=1. Replaced at Rank 2. |
| `"PNG preferred; JPEG acceptable at quality ≥90."` | 71 | Invites re-encoding. Replaced at Rank 1. |
| `"Prefer no HUD, or minimal HUD (photo mode is ideal)."` | 69 | "Photo mode is ideal" is wrong — photo mode routinely applies DOF, grain, vignette and a different FOV. Replaced at Rank 7 §8e. |
| `licence_note` as a per-record free-text field | 133 | ~40 words × every record. Replaced by a `licence` enum plus one statement in the report. |
| `"2–3 alternates per slot is better (name them -alt1, -alt2)"` | 51–52 | Superseded by the count floors and the `run-<slug>-t<seconds>` naming scheme. |
| The `capture_date` field | 128 | Keep, but demote to optional — it is almost always unknown and invites invention. |

**Do not cut:** the anti-fabrication closing paragraph (lines 154–159), the branch/scope
restriction (lines 149–152), or the two-axis explanation (lines 32–46). Those are load-bearing.

---

## Rank 17 — Corpus-side amendments the orchestrator owes in the same wave (not prompt text)

1. **RI-VIS02 forbids what we are about to do.** Line 39–40: *"Provenance discipline: image files
   are not vendored into this repo (copyright)."* If Codex commits images, that sentence is false
   and a future critic will cite it. Amend it to state the new position and the `refs/` layout.
2. **Register the new slot IDs.** REF-M9..REF-M19 and REF-A9..REF-A17 must be added to RI-VIS02
   and RI-VIS05 respectively, with their pairing to our canonical viewpoints, or the manifest will
   reference IDs no item defines.
3. **Extend RI-VIS02's pairing table.** `combat_midfight` currently pairs to `REF-M6 + REF-M2`;
   it should pair to `REF-M17`. `exterior_marsh_noon` should pair to `REF-M3 + REF-M14`.
4. **Add the missing capture slots on our side.** RI-CAM07 requires `player_back_closeup` and
   `player_front_closeup`; RI-VIS08 requires `creature_closeup` per archetype. Neither is in
   RI-VIS01's fixed eight, so the reference set will have counterparts our capture set does not.
5. **Record that M11, M12 `TemporalVar`, VIS08 §C and CAM07 §C8 cannot be externally calibrated**
   at frame-exact fidelity, per Rank 3. Their thresholds stay `constructed` against the harness
   anti-reference and that must be written down, not discovered later.
6. **`refs/anti/` vs `refs/anti-generic/`** — confirm the harness owner's path, and confirm no
   collision with the new layout.

---

# 4. Coverage table

Every visual property in RI-VIS01 §A, against the images the prompt **currently** requests.
"After changes" shows the verdict if Ranks 1–13 are applied.

| # | Property | Judged by (current request) | Verdict | After changes |
|---|---|---|---|---|
| P01 | Palette / hue relationships / colour identity | REF-A1, A4, A5, A7 | **partial** — daylight only; no dusk/night; palette identity spans time of day | covered (A16 night/dusk, A11 Bitter Coast) |
| P02 | Silhouette language (buildings, props, creatures) | REF-A2, A3, A6, A7 | **partial** — no equipment or weapon silhouettes | covered (A13) |
| P03 | Architectural vocabulary | REF-A2, A3, A7, A8 | **partial** — the Velothi/Temple stepped stone that the xanmeer descends from is absent | covered (A9, A15, A17) |
| P04 | Creature design | REF-A6 (one creature, chosen from five) | **partial** — one creature is not a design language | covered (A6 → four creatures, A14 silt strider) |
| P05 | Composition / framing / landmark placement | REF-A1 | **partial** — one vista; no landmark-at-distance shot | covered (A11, A16, A17) |
| P06 | Mood, alienness, "what world is this" | the A-set as a whole | **covered** | covered |
| P07 | Flora *design* | — | **UNCOVERED** — no plant image requested at all, against an entire §D specification | covered (A10) |
| P08 | Colour *grading intent* (warm/cool, tint direction) | REF-A1, A5 | **partial** — needs several regions × several times of day | covered (A11, A16, A15) |
| P09 | UI/HUD visual language, fonts, iconography | — | **UNCOVERED** — RI-VIS05 §H is a transposition of a UI nobody here has seen | covered (A12) |
| F01 | Texture resolution, texel density, mip quality | REF-M2, M3, M6 | **partial** — and worthless if re-encoded; no near-field surface | covered (M18, Rank 1) |
| F02 | Material response (PBR) | REF-M6 | **partial** — one sample, front-facing, likely a menu render | covered (M6 rewrite, M18) |
| F03 | Lighting model (direct + indirect, IBL) | REF-M1, M2, M3, M5 | **covered** — but only directional-sun scenes; no diffuse/overcast | covered (M14) |
| F04 | Shadow quality (resolution, cascades, contact, softness) | REF-M2, M3 | **partial** — contact shadows need a close-up; cascades need a long shadowed vista | covered (M6 rewrite, M18) |
| F05 | Ambient occlusion | REF-M2 (contact darkening clause) | **partial** — no image where AO is the subject | covered (M18) |
| F06 | Atmospheric scattering, fog, aerial perspective | REF-M1, M4, M7 | **covered** | covered |
| F07 | LOD, draw distance, pop-in | REF-M7 (draw distance only) | **WRONG MEDIUM** — M11 is defined over a 120-frame dolly; a still cannot show pop | video V1; and recorded as not frame-exact calibratable |
| F08 | Anti-aliasing / edge quality | REF-M2, M6, M7 nominally | **UNCOVERED IN PRACTICE** — M5's NYQ ratio is destroyed by any re-encode or resize, both of which the prompt permits | covered (Rank 1 + `nyq_ratio`/`upscale_test` screening) |
| F09 | Post-processing (tonemap, bloom, exposure) | REF-M1, M5 | **covered** — conditional on SDR-only, which is not currently required | covered (Rank 1) |
| F10 | Animation smoothness, blending, IK, root motion | — | **WRONG MEDIUM** — the whole of RI-VIS08 §C is temporal | video V3, V4; thresholds stay constructed |
| F11 | Geometric density (tri counts, silhouette smoothness) | REF-M6 | **partial** — one sample | covered (M6 rewrite, M17) |
| F12 | Water rendering (reflection, refraction, normals, depth) | REF-M4 | **partial** — a wide dawn vista cannot supply M12's grazing-vs-downward regions; `TemporalVar` is temporal | mostly covered (M19, M13); `TemporalVar` → video V2 |
| F13 | Foliage rendering (density, translucency, wind, shading) | REF-M2, M3 | **partial** — density and translucency yes; wind is temporal | covered + video V2 |
| F14 | Character/creature model quality | REF-M6 | **partial** — no back view (RI-CAM07 §B), no creature | covered (M6 rewrite) |
| F15 | Sky rendering (model, gradient, sun/moon, banding) | REF-M1, M3, M4, M7 | **partial** — dawn/dusk/morning only; no overcast noon, no night | covered (M14, M15) |
| F16 | Particle/VFX quality (sorting, softness, resolution) | — | **UNCOVERED** — RI-VIS04 §13 requires ≥2 ambient systems per exterior; nothing requested shows VFX, weather or combat effects | covered (M16, M17) |

**Current totals: 4 covered, 14 partial, 3 uncovered, 3 wrong-medium, 1 uncovered-in-practice.**
Of the eight canonical viewpoints in RI-VIS02's pairing table, seven have a reference and
**`combat_midfight` has none**.

---

# 5. Gate conditions — what must be true for me to return SUFFICIENT

Checkable against the revised prompt text, not against intentions.

**G1.** The prompt contains a byte-integrity mandate stating explicitly: commit the exact
downloaded bytes; no resize in either direction; no format conversion; no re-encode; no metadata
stripping; SDR only; prefer the original over any re-host. The clauses "PNG preferred; JPEG
acceptable at quality ≥90" and "1920×1080 minimum" are gone.

**G2.** Per-folder minimum counts exist as a table with hard floors (≥12/12/10/10/8/8 as at Rank
2), together with minimum distinct games and distinct locations per folder, and the sentence "Ten
correctly-identified images beat two hundred unverified ones" is gone.

**G3.** The anti-curation rule is present: at least half of each folder must come from
evenly-spaced sampling of one continuous session or video, with the `run-<slug>-t<seconds>` naming
and a `"sampling"` manifest field.

**G4.** A `refs/video/` request exists with at least the V1 dolly, V2 stationary, V3 locomotion and
V4 combat clips specified, and every video record carries `"pixel_metrics_valid": false`.

**G5.** The fidelity slot list contains references for: overcast/diffuse noon; night; falling
weather; active combat; material close-ups (≥5 distinct surfaces); a low shoreline water shot
containing both steep-angle and grazing-angle water; and at least five wetland environments drawn
from at least four different engines.

**G6.** REF-M6 explicitly requires **back and three-quarter-rear in-world views**, and explicitly
excludes equipment-menu renders, character sheets and neutral-background turntables.

**G7.** The art-direction slot list contains: Velothi/Temple ancient stone; at least four flora
close-ups; Bitter Coast as its own slot; the interface (journal, inventory/paperdoll, book page);
armour/weapons/clothing; the silt strider; at least three interiors of three vocabularies; a
dusk-or-night exterior; a stilted/waterside settlement; and REF-A6 raised to four separate
creatures.

**G8.** Verification is mechanical: a committed `make-manifest` script producing `bytes_per_pixel`,
`nyq_ratio`, `upscale_test`, `block_score`, EXIF `software`, and C2PA presence, with stated
automatic-rejection thresholds; plus the three-way `corroboration` requirement; plus
`identified_by` with three named visible features per file; plus the human look as the final step
rather than the only one.

**G9.** The Morrowind vanilla test is the seven-point mechanical list (no grass / no distant land /
no cast shadows / no world reflection in water / blocky texels / no post effects / plausible
resolution), recorded per file as `vanilla_tests`, with OpenMW handled explicitly and **no
resolution minimum** in that folder.

**G10.** Framing requirements are stated: 16:9, normal FOV, foreground element present, sky
visible for exteriors, level camera, no photo-mode effects, upscaler recorded — and the rule that
the light in the image decides the folder, not the slot label.

**G11.** The output layout uses `refs/modern/<profile>/` and `refs/morrowind/`, reserves
`refs/anti/` for the harness in writing, and adds `anti-generic/`, `context/`, `video/`, `hud/`,
`unconfirmed/` and `rejected/`.

**G12.** `anti-generic/` (4–6 archetypal generic-fantasy images, marked `"side": "anti-generic"`)
and `context/` (ESO Shadowfen/Murkmire, marked `"side": "context-neither"` with an explicit
`forbidden_for` list and the "obvious answer we must not converge on" framing) both exist.

**G13.** The prompt opens with a numbered "READ THIS EVEN IF YOU READ NOTHING ELSE" block of ≤10
rules covering: never modify bytes; take the original; folders are the axis; counts are floors;
do not curate for beauty; gameplay not marketing; no HUD; vanilla only; script-produced numeric
fields; honest gaps over invention — and the rest of the document is numbered so it can be
cross-referenced from that block.

**G14.** The acquisition report requires a per-folder count-vs-floor table, a rejection log with
per-file reasons, a "could not be obtained" section, one statement of the copyright position, and
the stop condition (report a shortfall rather than pad it).

---

## Closing note

The two things this prompt got right are the two things that are hardest to get right by
accident: it understood that the bifurcation is structural and made the folders enforce it, and it
understood that a fabricated reference is worse than a missing one and said so plainly. Those are
the instincts of someone who has watched a reference set rot.

What it did not do was ask what happens to these files after they arrive. They do not get looked
at. They get decoded, Fourier-transformed, converted to CIELAB, thresholded, and compared. That
turns almost every ordinary instinct about acquiring images — take the biggest one, convert
everything to a consistent format, pick the best shot of each place, one good example is enough —
into a way of quietly destroying the thing we are trying to build. The revised prompt has to fight
those instincts explicitly, at the top, in ten numbered lines, because the agent reading it will
have them and will have no way of knowing they are wrong.

**INSUFFICIENT.** Fourteen gate conditions above. Send it back.
