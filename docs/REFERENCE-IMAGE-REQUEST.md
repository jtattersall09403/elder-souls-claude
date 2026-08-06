# Prompt for acquiring reference images (give this to Codex)

**Recommendation: Codex, not ChatGPT deep research.** Codex can clone the repo, fetch files,
run the verification script, write the manifest, commit and push — the images land exactly where
the tooling expects them, in one pass. Deep research returns prose and links; someone would still
have to download, verify, rename and commit every file by hand, and the failure modes that matter
most here (a re-encoded copy, a modded render passed off as vanilla, a marketing bullshot) are
precisely what a link list makes hard to catch.

**Before running:** enable internet access in the Codex environment settings. If it still can't
reach image hosts, use deep research to produce a URL list and paste it into §5 in place of the
"find them" step.

---

## THE PROMPT — copy everything below this line

---

You are acquiring **reference images for automated measurement**. Scripts will compute Fourier
transforms, Sobel edge maps, local-standard-deviation maps and CIELAB colour distances over these
pixels, and the resulting numbers become the numeric bands our own renderer is scored against.
You are not illustrating a document. You are building measurement instruments.

**Repository:** `jtattersall09403/elder-souls-claude`
**Branch:** `claude/morrowind-souls-threejs-game-mou39v`

---

## READ THIS EVEN IF YOU READ NOTHING ELSE

Ten rules in priority order. Everything after elaborates them.

1. **NEVER MODIFY AN IMAGE FILE.** No resize, no crop, no format conversion, no re-encode, no
   sharpening, no metadata stripping. Commit the exact bytes you downloaded. These files are
   measured by scripts; editing one destroys the measurement. An image that seems to need editing
   needs *rejecting* instead.
2. **Take the original, not a copy.** Follow "full size" / "view original" links. Never a
   thumbnail, never a social-media re-host, never a video thumbnail.
3. **Folders are the enforcement.** `refs/modern/` is current-generation games only.
   `refs/morrowind/` is vanilla Morrowind 2002 only. Never mix them.
4. **Count matters as much as correctness.** We estimate 10th/90th percentiles per scene class.
   A band cannot be estimated from one image. Hit the floors in §3 or report the folder short.
5. **Half of each modern *exterior and interior* folder must be interval-sampled from a native
   screenshot series, not hand-picked, and never cut from a video** (§3). A set of beautiful frames
   produces a bar nobody can reach, which is a bar everybody ignores.
6. **Vanilla-only for Morrowind, tested by seven binary checks** (§7). Modded shots would replace
   our art direction with somebody else's.
7. **Gameplay captures, not promotional shots.** Marketing renders use settings no player sees.
8. **Verify with the committed script, then with your eyes** (§8). Both.
9. **Never fabricate.** No generated images, no manifest entry without a file, no invented source
   URL, licence or author. `"unknown"` is respectable.
10. **An honestly reported empty slot is a success.** A mislabelled or modified image silently
    corrupts every future verdict that cites it.

If you run out of time or budget, satisfy rules 1-5 on fewer folders rather than rules 6-10 on more. A complete, honest `exterior_daylight` is worth more than six folders at 60%. Folder priority, highest first: `exterior_daylight`, `exterior_lowlight`, `anti-generic/`, the Morrowind rows marked **core** in §5e, `material_closeup`, `interior_darkemissive`, `character_closeup`, `combat`, `video/`, the remaining Morrowind rows, `context/`.

---

## §1 The project and the two axes

A browser game: Morrowind's world, quests and dialogue with Dark Souls' combat, set in **Black
Marsh** — a swamp region of The Elder Scrolls. We judge visuals along two strictly separated axes:

- **VISUAL FIDELITY** — judged against **current-generation games only** (Elden Ring, Skyrim
  Special Edition, RDR2, The Witcher 3). Texture resolution, lighting, shadows, atmospherics,
  foliage, water, anti-aliasing, material response.
- **ART DIRECTION** — judged against **Morrowind (2002)**. Old graphics are *correct* here. We
  match its design language: muted palette, alien architecture, fungal forms, the total absence of
  generic-fantasy stonework.

Putting a 2002 shot in the fidelity set would let us score well on graphics by comparing ourselves
to 2002. Putting a modern AAA shot in the art-direction set would replace our design language.
Both are fatal. **The folders are how we prevent it.**

---

## §2 Folder layout — use exactly this, invent nothing

```
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
    <one folder per REF-A slot, e.g. REF-A2/>
    unconfirmed/              could not confirm vanilla; kept, never cited
  anti-generic/               the negative art-direction anchor (§5c)
  context/                    subject-matter orientation only, neither axis (§5d)
  video/                      short clips, motion measurements only (§5b)
  rejected/                   files you obtained then rejected; reasons in the report
  MANIFEST.json
  ACQUISITION-REPORT.md
  make-manifest.py            the script that produced MANIFEST.json
  LICENCE-NOTE.md             copyright position for every file (§9)
```

**`corpus/70-visual/refs/anti/` is reserved for a file our own harness generates. Do not create
it and do not write into it.**

---

## §3 How many, and how to choose them

We are estimating the 10th and 90th percentile of several image statistics per scene class so a
numeric band can be set. From three images, p10 and p90 are just the smallest and largest values
you happened to find — the same as having no band at all.

**Hard floors. A folder below its floor is an unfilled slot and must be reported as one.**

| Folder under `refs/modern/` | Min images | Min distinct games | Min distinct locations |
|---|---|---|---|
| `exterior_daylight` | 12 | 3 | 6 |
| `exterior_lowlight` | 12 | 3 | 6 |
| `interior_darkemissive` | 10 | 2 | 5 |
| `character_closeup` | 10 | 2 | 6 |
| `combat` | 8 | 2 | 4 |
| `material_closeup` | 8 | 2 | 6 |

**Only files with `"pixel_metrics_valid": true` count toward these floors.** A video frame, or a
file the script kept but marked `"heavily_recompressed": true`, may be retained for composition and
design language but does not count toward the number in this table. A folder padded to its floor
with files we cannot measure is worse than a folder honestly reported short: the count table in
§10 reads PASS, the abort rule never fires, and the band computed from it looks exactly like a
real one.

**The anti-curation rule — read this twice.** It applies to three folders only: `exterior_daylight`, `exterior_lowlight` and `interior_darkemissive`. In each of those, **at least half** the images must come from an *unbiased run*: pick one continuous **native screenshot series** — a Steam screenshot showcase, an imgur or Flickr album, a gallery upload set from a single play session — and take every Nth image **regardless of whether the frame is attractive**. Skip a sampled image only if it is a menu, cutscene, loading screen, HUD-covered, or almost entirely black. Name these `run-<source-slug>-<index>.<ext>` and set `"sampling": "interval-run"`. The rest may be deliberately chosen and are marked `"sampling": "selected"`.

**Never extract a frame from a video into `refs/modern/`.** Extracting a frame means encoding a new file, which breaks §4, and every frame of a compressed video carries codec artefacts that §8a rejects. Video lives in `refs/video/` and is measured for motion only, never for texture, anti-aliasing or colour.

`character_closeup`, `combat` and `material_closeup` are **exempt** from the interval-run rule: an unbiased run cannot produce a surface filling the frame or a character at 40% of frame height. Fill those three deliberately — but spread them across as many games, locations, characters and armour sets as you can. Variety is what the band needs; one game's art director is not a population.

One series per folder is enough for the run half. The selected half is where the distinct-games and distinct-locations minimums get satisfied: six run frames from one game's route plus six chosen frames from two other games meets 3 games and 6 locations comfortably.

This exists because the natural instinct — find the most beautiful shot of each place — produces a set of 99th-percentile frames. **We would rather have twelve ordinary frames than one magnificent one.**

`refs/morrowind/` is different: it is judged on design language, not statistics. **Two to three
images per slot** — four to five for the five rows marked **core** in §5e — deliberately chosen,
is right. §5e is authoritative on those counts; this paragraph only explains why they are smaller
than the modern floors.

---

## §4 File integrity — the single most important section

Every file is fed to a script computing a 2-D Fourier transform, a Sobel edge map, a
local-standard-deviation map and CIELAB colour distances. Those numbers measure anti-aliasing,
texture resolution, flat shading and colour. **A JPEG re-encode or a resize changes all of them by
more than the difference we are trying to measure.** A resized or re-encoded image is not a weaker
reference — it is a measurement of the resizer.

- **Commit the exact bytes you downloaded.** No conversion, no re-encoding, no resizing, no
  cropping, no rotation, no metadata stripping, no "optimisation", no `git lfs` transform.
- **Follow the original link.** Galleries serve a downscaled preview by default; find "view
  original" / "full size". A 4K image downscaled to 1080p *is* supersampling and will read as
  better anti-aliasing than the game actually produces.
- **Downloading is `curl -O` or equivalent, never a screenshot of a browser window.**
- **Record how you got it.** `"provenance_chain": "original"` if you downloaded the file from the
  page that first published it; `"rehosted"` if the only reachable copy was a mirror, a Reddit or
  imgur re-post, or a wiki upload of somebody else's screenshot. Rehosted copies are acceptable and
  count toward the §3 floors provided they pass §8a — §8a is what protects calibration, and a
  re-host that passes it is measurement-identical to the original. Mark them honestly anyway, so we
  can re-check that subset first if a band later looks strange.
- **No minimum resolution in `refs/morrowind/`**, and larger is not better there — a 1024×768
  vanilla shot beats a 4K modded one.
- In `refs/modern/`, prefer native captures at whatever resolution they were taken. Record the
  resolution; do not chase it.
- If the only available copy is visibly recompressed, put it in `rejected/` and note it. If a
  whole folder can only be filled with degraded copies, **say so in the report** — that finding
  is more valuable than the images.

---

## §5 What to collect

### §5a `refs/modern/` — current-generation only

Fill the folder floors in §3. The slots below say what to look for; the `profile` column is the
folder each belongs in. Several slots feed one folder — that is intended.

| Slot | What it shows | Profile |
|---|---|---|
| `REF-M1` | **Elden Ring — Liurnia of the Lakes at dusk**, toward Raya Lucaria: volumetric fog over reflective water, distant silhouettes | `exterior_lowlight` |
| `REF-M2` | **Elden Ring — forest interior** (Mistwood / Weeping Peninsula), dappled canopy light | `exterior_daylight` |
| `REF-M3` | **Skyrim SE — The Rift in autumn**, god rays through birches (this is a directional-light, high-chroma reference; REF-M21 is its diffuse counterpart and both are required) | `exterior_daylight` |
| `REF-M4` | **RDR2 — Bluewater Marsh or Lagras at dawn**: standing water, cypress, mist, wet ground | `exterior_lowlight` |
| `REF-M5` | **Elden Ring — Siofra River**, bioluminescent underground | `interior_darkemissive` |
| `REF-M6` | **A third-person character seen FROM BEHIND, in the world** — normal over-the-shoulder gameplay view, character 40–70% of frame height, armoured or clothed, on real ground in real lighting. **Not** an equipment-menu render, not a turntable, not a front portrait. **At least half this folder must be back or three-quarter-rear views.** Our camera sits behind the player 100% of the time; the character's back is the most-looked-at surface in our game | `character_closeup` |
| `REF-M7` | **Skyrim SE — long vista with visible LOD** (Whiterun plains from a ridge) | `exterior_daylight` |
| `REF-M9` | **The Witcher 3 — Velen / Crookback Bog**, overcast: a second engine's wet environment, and the canonical "fantasy swamp" we must not converge on | `exterior_daylight` |
| `REF-M10` | **Skyrim SE — Hjaalmarch / the marsh around Morthal**, overcast, vanilla: closest thing to our subject in the franchise we most risk resembling | `exterior_daylight` |
| `REF-M11` | **Elden Ring — Swamp of Aeonia or Lake of Rot**: hostile shallow water with emissive and particulate | `exterior_lowlight` |
| `REF-M12` | **RDR2 — Bayou Nwa at midday**, clear or hazy: same wetland as REF-M4 at the opposite end of the lighting range | `exterior_daylight` |
| `REF-M13` | **A moonlit night exterior**, any of the four games: what dark looks like when it is still legible | `exterior_lowlight` |
| `REF-M14` | **Rain or storm exterior**: wet surface response, precipitation, reduced visibility | `exterior_lowlight` |
| `REF-M15` | **Active melee combat**, 2+ figures, weapon effects on screen, third person | `combat` |
| `REF-M16` | **Material close-ups** — wet stone, mud, tree bark, cloth, metal, foliage at arm's length, one surface filling the frame | `material_closeup` |
| `REF-M17` | **A second dark interior lit by emissive sources** — a different game from REF-M5: a torchlit crypt, a forge, a lantern-lit cave, glowing fungus or lava. If a daylight shaft is the dominant light source, the shot is not a dark interior and belongs in `exterior_daylight` | `interior_darkemissive` |
| `REF-M18` | **Spell or magic VFX during combat**: particles, emissive, distortion | `combat` |
| `REF-M19` | **Water at a shoreline, camera low and close to the surface**, so that one frame contains both **near water seen steeply from above** and **far water seen at a grazing angle**. Our water metric compares those two regions inside a single frame; a wide vista of a lake cannot supply it | `exterior_daylight` or `exterior_lowlight` |
| `REF-M20` | **Heavy fog or mist**, atmospheric depth doing the work | `exterior_lowlight` |
| `REF-M21` | **A flat, overcast, no-direct-sun exterior at midday**, any of the four games. Deliberately undramatic: no god rays, no low sun, no golden hour. Overcast noon is our declared default weather and every other exterior slot here is dramatic directional sun; diffuse light is the hardest lighting to fake and we currently have no reference for it at all | `exterior_daylight` |

**There is deliberately no REF-M8.** That ID belongs to an anti-reference our own harness generates into `refs/anti/`. Do not create it, do not write into `refs/anti/`, and do not renumber this table to close the gap — every ID here is cited by name elsewhere in our corpus.

Requirements: **actual gameplay captures, not press/promotional shots** — bullshots use settings
no player sees and would set a bar we could never honestly reach; if only a promotional image
exists, keep it and set `"promotional": true`. Prefer no HUD; HUD-bearing images go in
`modern/hud/` and are kept but never compared. **SDR only** — an HDR screenshot tone-mapped by a
browser is not what a player saw. No photo-mode filters, no depth-of-field or vignette effects,
no ultrawide.

If a source page or video description says an upscaler was in use (DLSS, FSR, XeSS), prefer a different image — reconstruction invents high-frequency detail, which is exactly what we measure. Either way, record `"upscaler": "dlss" | "fsr" | "xess" | "off" | "unknown"`.

### §5b `refs/video/` — short clips, motion only

Some things we measure do not exist in a still: how badly distant geometry pops as the camera
moves, whether foliage moves at more than one frequency, whether water changes frame to frame,
whether feet stay planted when a character walks. Download clips as-is — do not re-encode, trim or convert.

| Clip | Must contain | What we measure |
|---|---|---|
| `V1-dolly` | camera moving forward continuously through open landscape for >= 20 s, **no cuts**, no HUD | LOD pop-in and streaming — a cut is indistinguishable from a pop, so a montage is worthless here |
| `V2-static` | camera **stationary** for >= 15 s looking at water and vegetation, **no cuts** | temporal variance, wind at more than one frequency, ambient particles |
| `V3-locomotion` | third-person character walking, running, stopping and turning 180 degrees, seen from behind | foot planting, foot sliding, blend between clips |
| `V4-combat` | >= 15 s of continuous third-person melee, no cuts | impact, hit reaction, attack commitment, effects |

**V1 and V2 are required. V3 and V4 are wanted; skip them before you skip anything in §5a.** Name files `V1-dolly__<source-slug>.<ext>`. Prefer, in order: a publisher's or developer's own channel; Digital Foundry or a comparable technical channel; a high-bitrate gameplay capture that states its setup. Record `duration_s`, `container`, `video_codec`, `bitrate_kbps`, `fps`, `width`, `height`, `source_url`, `uploader`, `game`, and `"pixel_metrics_valid": false`.

**Set `"pixel_metrics_valid": false` on every video record.** Inter-frame codecs both erase and
manufacture high-frequency detail, so clips are usable for *motion* judgement only, never for
texture or anti-aliasing statistics. Frame-exact temporal calibration is not obtainable
externally, and our corpus records that as a known limit rather than a missing deliverable.

### §5c `refs/anti-generic/` — what we must NOT look like

**Four to six images**, each an unembarrassed example of generic fantasy: a stone castle with
crenellations and a portcullis; a half-timbered village with pitched roofs and cobbles; a
"fantasy swamp" with bright green ferns and saddle-brown mud; a knight in polished plate with a
longsword and kite shield; snow-capped mountains over pine forest. Any game, any era, any quality
— the more archetypal the better. These are the **negative** anchor: the thing we measure
ourselves *away* from. Never cited as a target.

### §5d `refs/context/` — orientation only, cited by nobody

**Four screenshots of The Elder Scrolls Online: Shadowfen and Murkmire.** These are the only
existing depictions of the actual region our game is set in — the stepped stone ziggurats, the
Hist trees, Argonian villages, marsh vegetation.

They are **neither** a fidelity reference **nor** an art-direction reference, and that is not a
technicality: not fidelity, because a 2014 MMO engine would drag our bands *down* and hand a
builder the argument "we are within the reference population"; not art direction, because ours
descends from Morrowind plus our own written specification, and ESO is somebody else's
transposition of the same source. They are here so our builders know what the region has been
depicted as — **and so we can deliberately not converge on it.**

### §5e `refs/morrowind/` — vanilla Morrowind only

**Two to three images per slot.** No resolution minimum. Five slots are **core** and get **four to five** because they carry design language that one or two images cannot demonstrate: **REF-A6** (creatures), **REF-A9** (Velothi stone), **REF-A10** (flora), **REF-A11** (Bitter Coast), **REF-A12** (the UI). If you are running short, fill the core five completely and report the rest thin — do not spread the shortfall evenly.

| Slot | What it shows |
|---|---|
| `REF-A1` | Ascadian Isles or Bitter Coast **exterior vista** |
| `REF-A2` | **Redoran architecture** — the giant crab/shell buildings (Ald'ruhn) |
| `REF-A3` | **Telvanni architecture** — grown mushroom towers (Sadrith Mora / Tel Vos) |
| `REF-A4` | **Interiors, at least two of different kinds** — a Dunmer house, shop or temple, *and* a Telvanni tower interior (grown, organic, no right angles): lighting and clutter. Interiors differ by faction and class, and that difference is the property we are copying; one interior cannot show it |
| `REF-A5` | **Ash storm** in the Ashlands / Molag Amur |
| `REF-A6` | **Creatures, at least four separate images**: cliff racer, netch, kwama, guar |
| `REF-A7` | **A Dwemer ruin**, interior or exterior |
| `REF-A8` | **A town street with NPCs** — settlement density and layout |
| `REF-A9` | **Velothi / Temple ancient stone** — a Velothi tower, ancestral tomb entrance, or High Fane exterior. Stepped, angular, older than everything around it. **This is the direct ancestor of our world's only built architecture and the most important row in this table** |
| `REF-A10` | **Plant life, close — at least four images**: an emperor parasol / fungal tower, mushroom growths on a trunk, a ground plant (ash yam, marshmerrow, trama root), kelp or organic growth. Our flora spec is a transposition of these and nothing else here shows a plant at readable size |
| `REF-A11` | **Bitter Coast swamp specifically** — boardwalks, standing water, mist |
| `REF-A12` | **The UI**: inventory, the dialogue topic list, the journal, the map. Our UI is a transposition of these |
| `REF-A13` | **Armour and clothing** on NPCs, readable at close range |
| `REF-A14` | **Weapons**, close enough to read the design language |
| `REF-A15` | **Books, scrolls and written pages**, plus Daedric script signage |
| `REF-A16` | **A silt strider** — the single most recognisable "not generic fantasy" object in the game |
| `REF-A17` | **An Imperial fort or Census office interior** — the coloniser's architecture beside the natives' |
| `REF-A18` | **A dusk or night exterior** — any region; moons and stars in frame if possible. Our palette specification declares dusk and night colour targets and every other row in this table is daylight; nothing else in the set can anchor them |
| `REF-A19` | **A stilted or waterside settlement** — Hla Oad, Vos, Seyda Neen's shacks, or any village built over water. Our fen villages are specified as "stilted lashed" and this is the source vocabulary; the town street in REF-A8 does not show it |

---

## §6 Framing — this decides whether a comparison is fair at all

Our own screenshots are 16:9, roughly eye height, normal third-person FOV, something in the
foreground within a few metres, and for exteriors sky in the top of the frame. Several things we
measure are functions of *framing* rather than rendering: a shot with no foreground has nothing to
compare distant contrast against; a zoomed shot puts more pixels on the same surface and reports
better texture quality than the identical surface shot wide; a shot with no sky cannot be used to
judge sky gradient.

So, for `refs/modern/`: **16:9 (or very close), normal FOV, foreground present, sky visible for
exteriors, no photo-mode effects, SDR.** Reject ultrawide, extreme telephoto, and top-down or
map views.

**The light decides the folder, not the slot label.** If a shot nominally for `REF-M2` is actually
overcast dusk, it belongs in `exterior_lowlight`. Sort by what the image *is*.

---

## §7 Vanilla-only, and how to tell

An image is vanilla only if **all seven** are true. Check each explicitly and record
`"vanilla_tests": {"V1": true, ...}`. Any single failure means modded.

- **V1 — No grass.** Vanilla Morrowind has no grass anywhere; terrain is bare. Visible grass tufts
  mean a groundcover mod. Fastest and most reliable test.
- **V2 — No distant land.** Vanilla draws a fog wall a few hundred metres out. A crisp distant
  mountain range or coastline means MGE XE or OpenMW distant land.
- **V3 — No cast shadows** from buildings, trees or terrain onto anything else.
- **V4 — Water does not mirror the world.** Vanilla water is an animated tinted surface;
  reflected trees or buildings mean a water shader.
- **V5 — Textures visibly low resolution.** Zoom a door, wall panel or rug: texels should be
  obviously blocky.
- **V6 — No bloom, depth of field, ambient occlusion, colour grading or lens effects.**
- **V7 — Plausible resolution.** Above 1920×1080 strongly suggests MGE XE or OpenMW; above
  2560×1440 is effectively proof.

**OpenMW running unmodified vanilla assets is acceptable** — an engine reimplementation, not an
art change. Record `"engine": "openmw-vanilla-assets"`. OpenMW with distant land still fails V2:
record `"engine": "openmw-distant-land"` and note it is usable for silhouette and palette but not
composition or draw distance.

If you cannot confirm all seven: set `"vanilla_confidence": "low"`, say which tests you could not
run and why, and place the file in `refs/morrowind/unconfirmed/` rather than a slot folder.

---

## §8 Verification — script first, then eyes

**8a — The integrity script.** Write and commit `refs/make-manifest.py` (or `.mjs`). It walks
every file and produces, per file, without you typing any of it:

```
bytes, sha256, format, width, height, bit_depth, has_alpha
bytes_per_pixel  = bytes * 8 / (width * height)
jpeg_quality_est = estimated from quantisation tables, if JPEG
exif_software, exif_datetime, xmp_present, c2pa_present
nyq_ratio        = 2-D FFT of the luminance channel; energy in radial frequency
                   [0.45,0.50) divided by energy in [0.20,0.45). A native capture
                   typically lands in 0.05-0.30. **Below 0.02 in refs/modern/ means the
                   image was downscaled or blurred and its real edge detail is gone.**
upscale_test     = box-downsample the luminance to 2/3 size, bilinear-upsample it back
                   to the original size, take the mean absolute difference in 0..1
                   luminance. A native capture typically lands in 0.01-0.05.
                   **Below 0.004 means the image carries no detail at its stated
                   resolution: it was enlarged from a smaller original.**
block_score      = mean |horizontal gradient| across 8-pixel-aligned column boundaries
                   divided by the same across non-aligned boundaries. Native or lightly
                   compressed: 0.95-1.10. **Above 1.15 means JPEG block artefacts are
                   visible in the pixels we measure.**
```

Move to `rejected/`: any file with `upscale_test < 0.004`; any `refs/modern/` file with `nyq_ratio < 0.02`; any file with `block_score > 1.15` (unless nothing better exists for that slot, in which case keep it and set `"heavily_recompressed": true`); any file whose `exif_software` names an editor (Photoshop, GIMP, ImageMagick, "Save for Web") or a generative tool; any file with `c2pa_present` or AI-generator metadata. Record every rejection and its failing statistic in the rejection log.

If your environment cannot compute one of these statistics, write `"unknown"` in the manifest, say so in the report, and do the human check instead. **Do not estimate a number you did not compute** — an invented `nyq_ratio` is worse than a missing one, because we would trust it.

**8b — Source corroboration.** For every file, one of these three must be true, and you record which one in `"corroboration"`:

  - `"first-party"` — the source is the publisher, the developer, the official wiki, or the game's own store page;
  - `"two-hosts"` — you found the same image, or the same scene from the same capture, on two independent sites that are not mirrors of each other;
  - `"pre-2023-page"` — the hosting page carries a visible date before 2023-01-01.

**An image satisfying none of the three goes in `rejected/`.** This is the anti-AI-generation check and it is far more reliable than looking at the image, because a competently generated landscape looks completely correct and has no history — which is exactly what "I could only find it in one place, recently" means.

For `"sampling": "interval-run"` files, corroborate the **series once** and record the same value on every frame taken from it. Do not repeat the search per frame.

**8c — Identification.** For each image record `"identified_by"`: **three named features** that
prove it is the game and place claimed — e.g. `["bald cypress with buttress roots", "Lemoyne
architecture on the far bank", "the Bluewater Marsh shack"]`. If you cannot name three, you have
not identified it; put it in `rejected/`.

**8d — Look at it.** Open every image. Confirm it is an in-game render — not concept art, box
art, fan art, a painting, an AI generation, a map, or a mod-page banner — and that it is in the
right folder for its axis.

---

## §9 `MANIFEST.json`

One record per file. Script-produced numeric fields must come from the script, not from you.

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
  "identified_by": ["bald cypress with buttress roots", "Lemoyne architecture far bank", "the Bluewater Marsh shack"],
  "source_url": "https://...",
  "source_page": "https://...",
  "author_or_uploader": "name or unknown",
  "corroboration": "two-hosts",
  "provenance_chain": "original",
  "capture_date": "2019-05 or unknown",
  "format": "png",
  "bytes": 4192837,
  "width": 2560, "height": 1440, "bit_depth": 8,
  "bytes_per_pixel": 9.1,
  "nyq_ratio": 0.118, "upscale_test": 0.019, "block_score": 1.02,
  "exif_software": "none", "c2pa_present": false,
  "promotional": false, "has_hud": false, "hdr": false,
  "modded": false, "vanilla_confidence": "n/a",
  "vanilla_tests": null,
  "engine": "native",
  "modified_by_me": false,
  "upscaler": "unknown",
  "photo_mode": false,
  "aspect_mismatch": false,
  "foreground_present": true,
  "sky_visible": true,
  "pixel_metrics_valid": true,
  "sha256": "..."
}
```

**`modified_by_me` must be `false` on every record.** If it is ever `true`, say in the report exactly what you did and why — a `true` here means the file cannot be used for measurement.

`"side"` is one of `"modern-fidelity"`, `"morrowind-art"`, `"anti-generic"`, `"context-neither"`, `"video"`, and **must agree with the folder the file is in**. Files in `anti-generic/` and `context/` are never cited as targets by anything: `"context-neither"` files additionally carry `"forbidden_for": ["fidelity-bands", "art-direction-judgement", "blind-pairing"]`.

Filenames: `REF-M4__rdr2-bluewater-marsh-dawn.png` (double underscore separator), or
`run-<source-slug>-<index>.<ext>` for interval-sampled frames, exactly as named in §3.

A single `LICENCE-NOTE.md` at `refs/` root covers copyright for all files — do not repeat a
licence paragraph per record. It must state plainly: these are screenshots of commercial games,
held under their publishers' copyright, retained solely for internal comparison and critique. Do
not claim a licence that does not exist and do not apply an open-source licence to them.

---

## §10 `ACQUISITION-REPORT.md` and commit

The report must contain, in this order:

1. **A per-folder count table**: folder, required floor from §3, number delivered, PASS/SHORT.
   This is the first thing we will read.
2. **A per-slot table**: filled / unfilled, and for unfilled, exactly what you tried.
3. **A rejection log**: every file you obtained and rejected, with the reason and the failing
   statistic. This tells us what the internet does not have, which decides whether our bands can
   be measured at all — and it is the only artifact that would reveal a *systematic* degradation
   problem before we build twelve bands on top of it.
4. **Every image you were unsure about, and why.** Err toward over-reporting doubt.
5. **Anything you could not do**, stated plainly.

**Stop conditions — there are two.**

*Completion.* When every folder meets its floor and every slot is filled or reported, stop. Do not keep collecting.

*Abort.* If, after genuine effort, more than half the folders in §3 are below their floor, **stop and report rather than padding the shortfall.** Do not fill the gap with re-hosted, promotional, uncorroborated or visibly recompressed images to make the count table read PASS. A half-filled honest set is repairable — we go and get the rest. A full set with a quarter of it quietly degraded is not, because we will never know which quarter, and every band we compute on top of it will look exactly as legitimate as a real one.

Commit to `claude/morrowind-souls-threejs-game-mou39v` describing what was acquired and what
remains unfilled. **Do not modify any file outside `corpus/70-visual/refs/`.**

---

## §11 When you cannot find something — substitute deliberately, and tell us exactly what you did

**We have no access to any of these games.** We cannot capture a frame ourselves, cannot revisit
a location, cannot re-shoot at a different time of day. Everything here is whatever the internet
happens to hold. So the slot list above is a statement of *what we would ideally measure*, not a
list of things we know exist. **Expect some slots to be unfillable, and do not distort the set to
force them.**

When a slot cannot be filled as specified, apply this ladder, in order, and stop at the first rung
that works:

1. **Same requirement, different game.** The profile matters more than the title. If Elden Ring's
   Siofra River is unobtainable, any current-generation cave lit mainly by emissive sources serves
   `interior_darkemissive` equally well. Record `"substituted_for": "REF-M5"`.
2. **Same requirement, different location in the same game.** Record it the same way.
3. **Adjacent conditions.** A dusk marsh instead of a dawn marsh; overcast instead of rain. Record
   what actually differs in `"deviation"`.
4. **A frame extracted from video — for `refs/morrowind/`, `anti-generic/` and `context/` only.**
   **Never for `refs/modern/`.** §3 forbids it absolutely there: extracting a frame encodes a new
   file, which breaks rule 1 and §4, and every frame of a compressed video carries the codec
   artefacts §8a rejects. For a REF-M slot, skip this rung and go straight to rung 5. Where it is
   allowed, mark `"provenance_chain": "video-frame"` and `"pixel_metrics_valid": false` — such a
   file is usable for composition, palette and design language only.
5. **Leave it empty and say so.** This is a legitimate and final answer.

**The ladder changes the subject, never the standard.** A substituted file is still subject to §4
(exact bytes, original rather than re-host), §7 (all seven vanilla tests for anything in
`refs/morrowind/`), §8a (the same automatic rejections at the same thresholds) and §8b (the same
three-way corroboration gate). Rungs 1 and 2 mean a different *current-generation* game for a
REF-M slot — never an older one — and for a REF-A slot they never mean a game other than
Morrowind: a REF-A slot that cannot be filled with vanilla Morrowind goes to rung 5, not to
another title.

**What we need from you is not a full set — it is an accurate map of what exists.** For every slot
you could not fill as written, tell us in the report: what you searched, what you found instead,
and — most usefully — **what a realistic version of this requirement would look like given what is
actually out there.** We will retune the measurement to the evidence available rather than keep a
bar we can never calibrate. A test we can actually run against a real reference beats an ideal
test with nothing behind it.

Two specific cases worth flagging if you hit them:

- **If a whole profile folder can only be filled with recompressed or downscaled images**, say so
  loudly. That changes which metrics we can compute at all, and we would rather know now than
  discover it when the numbers look strange.
- **If Morrowind vanilla shots are overwhelmingly modded** (likely — the modding scene is large
  and old screenshots are scarce), report the ratio you saw. If genuinely vanilla imagery is rare,
  we will lean on the 1024×768-era screenshots that do exist and lower the resolution expectation
  rather than accept modded shots. **Never trade vanilla-ness for image quality in that folder.**

## Above all

Do not fabricate, do not generate images, do not describe an image you did not obtain, and do not
put an entry in the manifest whose file is absent. Every future visual verdict in this project
cites these files as ground truth. An empty slot honestly reported costs us one comparison; an
invented or silently modified reference costs us the whole instrument.
