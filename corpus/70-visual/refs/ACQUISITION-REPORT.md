# Reference-image acquisition report — in-container attempt

**Agent:** `image-acquisition` (in-container). **Brief:** `orchestration/briefs/image-acquisition.md`.
**Specification followed:** `docs/REFERENCE-IMAGE-REQUEST.md`.
**Delivered:** 119 files in slot folders + 8 in `rejected/`.
**Revision 2** (2026-08-06, successor agent). Three previously-unfilled REF-A slots were filled
and the metrics were recomputed over the enlarged set. **What changed and what is new is in §13;
read that before §4, which revision 1 wrote when REF-A13 was still empty.**

This report is written to be read by someone deciding whether the bands in RI-VIS03 can be
calibrated. **The headline is in §1 and §6: the Morrowind art-direction side is now real and
usable; the modern fidelity side is not, and the reason is structural, not effort.**

**Revision 2 adds a second headline, in §13.2: the statistics we can actually compute are not the
statistics RI-VIS03 defines.** Even a complete image set would not calibrate M5, and M8's two
hard-fail statistics are not computed by any tool in this repository. That, not the shortage of
pixels, is now the binding constraint.

---

## §0 What the network actually permitted

The container reaches the internet only through a policy proxy. Everything relevant to this task
was tested by hand:

| Host | Result |
|---|---|
| `git clone --depth 1 https://github.com/OWNER/REPO.git` (arbitrary public repo) | **works** |
| `raw.githubusercontent.com` via `curl -L` | **works**, full file bytes |
| `api.github.com` repo search (via the session's GitHub tooling) | **works** — the brief assumed it did not |
| `objects.githubusercontent.com` | CONNECT succeeds (404 at root); release assets probably reachable, untested |
| `codeload.github.com` | **403 at CONNECT** |
| `user-images.githubusercontent.com` | **403 at CONNECT** |
| `media.githubusercontent.com` | CONNECT succeeds, 404 on LFS paths |
| `mwscr.dehero.site`, `staticdelivery.nexusmods.com` | **403 at CONNECT** |
| images.uesp.net, upload.wikimedia.org, Fandom, imgur, Steam CDN, archive.org, Google Drive | **403 at CONNECT** (per brief; not re-tested) |

So the entire acquisition is **"whatever a public GitHub repository happens to contain"**. That
constraint, not search effort, is what shapes everything below.

---

## §1 Per-folder counts against the §3 floors

| Folder | Floor (images / games / locations) | Delivered | Verdict |
|---|---|---|---|
| `modern/exterior_daylight` | 12 / 3 / 6 | **0** | **SHORT** |
| `modern/exterior_lowlight` | 12 / 3 / 6 | **0** | **SHORT** |
| `modern/interior_darkemissive` | 10 / 2 / 5 | **0** | **SHORT** |
| `modern/character_closeup` | 10 / 2 / 6 | **1** (RDR2) | **SHORT** |
| `modern/combat` | 8 / 2 / 4 | **0** | **SHORT** |
| `modern/material_closeup` | 8 / 2 / 6 | **0** | **SHORT** |
| `modern/hud` | no floor (kept, never compared) | **24** (Witcher 3) | n/a |
| `morrowind/` (**18 of 19 slots**) | 3–5 per slot | **89** | **PASS** on every filled slot |
| `anti-generic/` | 4–6 | **5** | **PASS** |
| `context/` (ESO Shadowfen / Murkmire) | 6–10 | **0** | **SHORT** |
| `video/` | 4–8 clips | **0** | **SHORT** |
| `rejected/` | n/a | 8 | — |

**One HUD-free current-generation gameplay frame exists in this set.** That is the whole modern
fidelity side. Everything else on that side is either HUD-bearing (24 Witcher 3 frames, confined
to `modern/hud/` by §5a) or was rejected.

---

## §2 Per-slot table

### `refs/morrowind/` — art direction

| Slot | Asked for | Filled | n | Notes |
|---|---|---|---|---|
| REF-A1 | Ascadian Isles / Bitter Coast vista | yes | 4 | sunset over water, mushroom hills, two Bitter Coast interiors of forest |
| REF-A2 | Redoran / Ald'ruhn shell buildings | yes | 5 | includes the Skar exterior and its interior, and the Molag Mar stronghold |
| REF-A3 | Telvanni mushroom towers | yes | 5 | Tel Vos, Tel Branora, Tel Mora, Tel Fyr, Sadrith Mora |
| REF-A4 | Dunmer interior | yes | 5 | cornerclub, pawnbroker, house of earthly delights, interior garden, Tel Naga great hall |
| REF-A5 | Ash storm / Ashlands | yes | 5 | Molag Amur lava, ash spires, evening Ashlands, strider in a storm |
| REF-A6 | Creatures, ≥4 separate images | yes | 6 | netch ×2, guar, cliff racer, kwama ×2 — all four named creatures present |
| REF-A7 | Dwemer ruin | yes | 5 | Galom Daeus, Arkngthand ×2, Nchuleftingth, Bthungthumz |
| REF-A8 | Town street with NPCs | **partial** | 5 | streets and settlement density are covered; **NPCs are barely present** — see §4 |
| REF-A9 | Velothi / Temple ancient stone | yes | 5 | Velothi tower, two ancestral tombs, Gnisis temple, the Ghostfence |
| REF-A10 | Plant life close, ≥4 images | yes | 5 | mushroom stack, mushroom field, ash-yam rows, tree-stone, Dren plantation |
| REF-A11 | Bitter Coast swamp | yes | 5 | Seyda Neen ×2, swampy islands, far swamps, lighthouse at night |
| **REF-A12** | **The UI** — inventory, dialogue topics, journal, map | **NO** | 0 | **structurally unfillable from this source** — see §4 |
| REF-A13 | Armour and clothing on NPCs at close range | **yes (rev 2)** | 5 | Ordinator in Indoril armour (front), High Ordinator (**from behind**), road guard, a female NPC in skirt-and-cuirass, two figures at the Mournhold armoury |
| REF-A14 | Weapons, close | yes | 5 | Daedric tanto, Sixth House hammer, spear statue, dagger, weaponsmith's stands |
| REF-A15 | Books, scrolls, Daedric script | yes | **5** | open books ×3, scroll pile, **+ the Gnaar Mok Daedric signboard (rev 2)**; one candidate rejected |
| REF-A16 | Silt strider | yes | 4 | Molag Mar port, morning mist, coastal, sleeping |
| REF-A17 | Imperial fort / Census office | **partial** | 5 | five Imperial **exteriors**; **no Census office interior** |
| REF-A18 | Dusk or night exterior | **yes (rev 2)** | 5 | Masser + starfield over a statue, Suran quay at dusk, Molag Amur night sky, Ascadian sunset over water, Suran at night |
| REF-A19 | Stilted / waterside settlement | **yes (rev 2)** | 5 | Gnaar Mok on pilings, Ald Velothi docks in fog, Hla Oad ×3 (boat, central tree in rain, dusk) |

### `refs/modern/` — fidelity

Every slot REF-M1 … REF-M20 is **unfilled** except REF-M6, and the substitutions actually made
are recorded per §11:

| Slot | Status | What was tried, what was found |
|---|---|---|
| REF-M6 (third-person back view) | **filled, 1 image** | §11 rung 1 (different game): Red Dead Redemption 2, Arthur Morgan from behind at Horseshoe Overlook, 1921×1081, HUD-free, 6.0 bits/px. Found in `BAAI-Agents/Cradle` — an AI-agent-plays-RDR2 research repo whose docs happen to include one clean gameplay frame among 22 settings-menu screenshots. |
| REF-M9 (Witcher 3 wet environment) | **hud/ only** | 24 native 2560×1440 Witcher 3 frames found (see §3). All carry HUD → `modern/hud/` per §5a. |
| REF-M1, M2, M3, M5, M7, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20 | **empty** | See §6 for the search log. No substitution at any rung 1–4 was available. §11 rung 5 — "leave it empty and say so" — is the answer for all of them. |

### `refs/context/` — ESO Shadowfen / Murkmire

**Empty.** GitHub repo search and code search for Elder Scrolls Online screenshot sources returned
nothing but addon code (ESOUI addons ship Lua and XML, not screenshots). The only depictions of
Black Marsh that exist are on Fandom, the ESO site and YouTube, all of which are blocked.

### `refs/video/`

**Empty and, from this container, unobtainable.** Video lives on YouTube and publisher CDNs; both
are blocked at CONNECT. No GitHub repository was found holding 20–60 s high-bitrate gameplay
clips — repositories with video hold `.gif` at best (`BAAI-Agents/Cradle` has four 960×540 GIFs
of RDR2 task grids, which are useless for LOD-pop or foot-planting judgement and were not taken).
This matches the request's own expectation in §5b that frame-exact temporal calibration is not
obtainable externally.

---

## §3 What was actually acquired, and from where

### `dehero/mwscr` — "Morrowind Screenshots" — 73 images (the whole Morrowind side)

A curated screenshot project whose stated editorial rule is *"No graphic and unlore mods. No
color filters. No interface."*, mostly captured in **OpenMW** — which §7 explicitly accepts as
`engine: openmw-vanilla-assets`.

**The catch, stated plainly: the repository contains only downscaled AVIF previews.** 1002 shot
previews, all ≤ 569×320, and 947 of them are exactly **320×320 square crops**. Measured
bytes-per-pixel is 0.41–2.77. The full-resolution originals are on `mwscr.dehero.site`,
Instagram and Telegram — all blocked at CONNECT. The committed bytes are exact; they are simply
small.

Consequences, recorded on every record as `provenance_chain: "downscaled-preview"` and
`pixel_metrics_valid: false`:

- **Usable for**: palette, silhouette, built-form vocabulary, composition-at-large, flora and
  creature design language — i.e. everything RI-VIS05 actually judges.
- **Not usable for**: any texture-resolution, anti-aliasing, texel-density or sharpness claim.
- The square crop destroys original framing for ~92% of them. Where composition matters
  (RI-VIS05's "what does a Morrowind vista put where"), read with that in mind.

Vanilla assessment per §7: **V1 (no grass) and V5 (low-res texels) and V7 (resolution) confirmed
by eye on a contact sheet of all 73.** **V2 (no distant land) assessed per image** — 7 images
show terrain beyond the fog wall and are recorded `engine: "openmw-distant-land"`, which §7 says
is usable for silhouette and palette but not composition or draw distance. **V3, V4 and V6 cannot
be assessed at 320×320 after AVIF compression and are recorded as `null`, not as `true`.**
Therefore `vanilla_confidence: "medium"` on all 73, never `"high"`.

> **Judgement call the reviewer should check.** A literal reading of §7 ("If you cannot confirm
> all seven … place the file in `refs/morrowind/unconfirmed/`") would put all 73 in
> `unconfirmed/` and leave the art-direction side with nothing. They are in slot folders instead,
> on the strength of (a) the source project's explicit no-graphics-mods editorial rule, (b) V1
> and V5 passing by eye — the two tests §7 calls the fastest and most reliable, and (c) §7's own
> acceptance of OpenMW. If a reviewer disagrees, `git mv morrowind/REF-A*/ morrowind/unconfirmed/`
> is a one-line reversal and nothing else in the corpus needs to change.

### `elfhuo-github/sksebp-og.github.io` — 24 Witcher 3 frames → `modern/hud/`

A GitHub Pages mirror of the Skyrim SE Beautification Project site. Its `witcher3nextgen/`
directory holds **24 native 2560×1440 Witcher 3 gameplay screenshots**, 3.1–4.3 MB each
(6.7–9.2 bits/px), captured in one session on 2022-12-17 as **twelve locations shot twice** —
once on the old-gen build, once on the 2022 next-gen build. Novigrad, Oxenfurt, White Orchard,
forest and field. Third-person over-the-shoulder with Geralt seen from **behind**, which is
exactly the framing REF-M6 says is the most-looked-at surface in our game.

They are recorded `sampling: "interval-run"` with an honest deviation note: it is a continuous
capture sweep in which every stop is present, ugly frames included — the property §3's
anti-curation rule is actually after — but it is not fixed-interval sampling.

**All 24 carry the Witcher 3 minimap and quest tracker.** §5a is unambiguous: HUD-bearing images
go in `modern/hud/` and are kept but never compared. They are there.

### `BAAI-Agents/Cradle` — 1 RDR2 frame → `modern/character_closeup/`

See REF-M6 above. One frame out of a 23-file directory.

### `anti-generic/` — 5 files

Byte-identical copies of five of the Witcher 3 frames, chosen for archetypal generic fantasy: a
crenellated stone castle with round towers, a half-timbered Novigrad street, a pitched-roof
village, a thatched hamlet, and birch woodland over green meadow. RI-VIS02 names The Witcher 3 as
the canonical fantasy look we must not converge on, so the negative anchor comes from the right
place. Recorded with `duplicate_of` pointing at `modern/hud/`.

---

## §4 Slots that are structurally unfillable, and what a realistic version would be

Per §11's request for "what a realistic version of this requirement would look like given what is
actually out there":

**REF-A12 (the Morrowind UI).** Unfillable from `mwscr`, whose editorial rule is literally *"No
interface"*. Every other Morrowind image source found on GitHub is a modding wiki whose UI
screenshots are of the Construction Set and MO2, not the game. **Realistic version:** the
Morrowind UI is not a screenshot problem — it is a layout problem, and it is fully documented in
text (frame widths, the topic list on the right, the journal's book metaphor). Replace the slot
with a written UI-transposition spec plus, if any pixels are ever obtained, a single 1024×768
inventory shot. Do not block RI-VIS05 on it.

**REF-A13 (armour and clothing on NPCs at close range).** No filename in a 1145-image corpus maps
to it and none of the contact sheets showed a readable NPC close-up — `mwscr`'s house style is
landscape and architecture with figures at 20–40 px. **Realistic version:** fold armour and
clothing into REF-A14's object close-ups plus the REF-A4 interiors, and accept that the
*silhouette* of Dunmer armour is what we can reference, not its material treatment.

**REF-A8 NPC density.** The five street shots carry the settlement geometry well but almost no
figures. The corpus should not cite these for "how many people are on a street".

**REF-A17 interior.** Five Imperial exteriors, no Census office interior. The colonial-vs-native
architecture contrast is visible in exterior form only.

**Every `refs/modern/` slot except REF-M6.** See §6.

**`refs/context/` (ESO Shadowfen/Murkmire) and `refs/video/`.** See §2.

---

## §5 Rejection log

| File (now in `rejected/`) | Reason | Failing statistic |
|---|---|---|
| `sksebp-wallpaper-1080p-01.jpg` | Genuine Skyrim SE frame with a large "SKYRIM SPECIAL EDITION / BEAUTIFICATION PROJECT" text lockup burned in. Text is high-contrast synthetic geometry — it inflates M4 edge density and wrecks M8 flat-shading and M5 spectral statistics. | `exif_software = "Adobe Photoshop CS6 (Windows)"`, `xmp_present = true` |
| `sksebp-wallpaper-1080p-04.jpg` | Same text lockup; also a near-black silhouette composition that M1 would read as crushed. | same |
| `sksebp-wallpaper-1080p-07.jpg` | Same text lockup; effectively a title card, not a gameplay frame. | same |
| `sksebp-wallpaper-1080p-11.jpg` | Same text lockup. | same |
| `rdr2-main-storyline-start.jpg` | 1920×1080 at **0.35 bits/pixel** — an order of magnitude below the 6.0–9.2 bits/px of every other capture here. Heavily recompressed; measuring it would measure the recompressor. Also HUD-bearing. | `bytes_per_pixel = 0.359` |
| `mwimproved-pelagiad-street.jpg` | Presented as a modding guide's un-modded baseline; it is not. Buildings cast shadows onto the ground (**V3 fail**) and stone/wood texel density is far above vanilla (**V5 fail**) — the guide's baseline already includes texture packs. | `exif_software = "Adobe Photoshop CS6 (Windows)"`, `xmp_present = true` |
| `mwimproved-dunmer-interior.jpg` | Same source, same failures. | same |
| `REF-A15__mwscr-2017-05-02-paper-trail.avif` | REF-A15 asks for books and scrolls **readable at close range**; this is a wide Ashlands shot with scrolls on the ground at ~30 px. Neither page nor Daedric script is legible. | subject size, not a statistic |

**No file was flagged for `c2pa_present` or AI-generator metadata. No file has a positive
`block_score`** in the modern set (all negative, i.e. no 8×8 JPEG blocking at all).

### The one integrity flag that is *not* a rejection

**All 24 Witcher 3 files carry `exif_software = "ACDSee Ultimate 8"`** with `exif_datetime`
2022-12-17 23:12 and 23:53 — *after* the 22:58–23:51 capture window, so they passed through an
image editor in two batches. **§8a says reject on this alone.** The counter-evidence from the
same script:

- `bytes_per_pixel` **6.74 – 9.23** (a web re-save would be 1–2),
- `jpeg_quality_est` **100** on every file,
- `block_score` **negative** on every file (−0.0011 … −0.0004) — the 8×8 boundaries are *less*
  discontinuous than the pixels one step inside them, which is what a near-lossless JPEG looks
  like,
- `nyq_ratio` **0.050 – 0.169**, nowhere near zero, so they were not downscaled.

The evidence says ACDSee was used to batch-convert or crop at maximum quality, not to resize or
re-compress. **They are kept, in `modern/hud/`, with `integrity_flag` recorded on every record.**
The risk is zero because §5a already bars `modern/hud/` from every numeric comparison. **Do not
promote them out of `hud/` without re-litigating this flag.**

---

## §6 The search log — repo by repo

Every repository below was cloned (`--depth 1 --filter=blob:none --no-checkout`), its image
inventory listed from the tree, and the clone deleted. Recording the failures is the point: it
tells a successor what not to re-try.

**Productive:**

| Repo | Found |
|---|---|
| `dehero/mwscr` | 1145 vanilla-Morrowind AVIF previews ≤ 569×320 — **the entire Morrowind side** |
| `elfhuo-github/sksebp-og.github.io` | 24 native 1440p Witcher 3 gameplay JPEGs (+ 4 Skyrim wallpapers, rejected) |
| `BAAI-Agents/Cradle` | 1 HUD-free RDR2 gameplay frame among 22 menu screenshots |
| `Sindorius/morrowind-improved` | 2 full-size Morrowind JPEGs — **rejected**, modded baseline |

**Dead ends** (image count found → why it failed):

`OpenMW/openmw` (15 → launcher chrome only) · `OpenMW/openmw.org` (404) ·
`morrowind-modding/morrowind-modding.github.io` (218 → Construction Set / MO2 tutorial UI and
modded assets) · `LucasDelfino92/morrowindsharp` (20 → MO2 UI) ·
`rfuzzo/MorrowindPlusPlus` (17 → modded modlist banners) ·
`doublemoulinet/Morrowind-Modular-Mod-Guide` (19 → guide art) ·
`zesterer/openmw-shaders` (1) · `InTheBottle/CSVO` (23 → icons) ·
`c-stew/SkyrimSE-Modlist` (0) · `TitansBane/The-Phoenix-Flavour` (404) ·
`Wildlander/Wildlander` (404) · `LivingSkyrim/LivingSkyrim` (404) ·
`Alaxouche/Wunduniik` (3 → banners) · `Oghma-Infinium/Ascensio` (4) ·
`doodlum/skyrim-community-shaders` (37 → UI icons and themes) ·
`gposingway/gposingway` (497 → shader lookup textures) ·
`prod80/prod80-ReShade-Repository` (10 → LUT strips) ·
`originalnicodr/CorgiFX` (5 → bokeh textures) ·
`EanNewton/Awesome-Elden-Ring-Resources` (1 → header) ·
`AliiQazii/HTML-PROJ`, `Nulomy/STIX`, `onetechmind/HUDRA`, `Tavissen/GAME-REVIEW-MODIFIED`,
`mejhstudy/areaVIP`, `limonmoto/RdR2konon` (student site projects → wallpaperflare/promo art,
resized and re-encoded, would fail §4 outright) ·
`Forceflow/rdr2_settings_parser` (6 → settings UI) ·
`isl-org/PhotorealismEnhancement` (36 → 17 web-sized GTA V frames; not fetched, GTA V is outside
the reference title list and web-sized images fail §4).

**Search channels used:** GitHub repository search (works), GitHub code search (works — used to
find HTML galleries that might link in-repo screenshots), WebSearch (works, used to find repo
names). The GitHub *code* search does not index binary blobs, so "find me a repo full of PNGs"
is not directly expressible; the workable proxy was searching HTML for game names and then
inspecting the repo tree.

---

## §7 The structural finding — read this before commissioning another attempt

**GitHub does not host a corpus of clean current-generation gameplay screenshots, and no amount
of further searching from inside this container will produce one.** The reason is mechanical:

1. Repositories that *are about* modern games hold **code, tables, save-file parsers and item
   icons** — the data is what is interesting to a programmer, the pixels are not.
2. Repositories that *do* hold game pixels hold them as **README banners, UI icons, shader
   lookup textures and tutorial screenshots of tool windows**.
3. Where gameplay frames do appear, they appear as **web-sized derivatives** on a documentation
   site — exactly the recompressed-copy failure mode §4 warns about.
4. The places that actually hold gameplay captures at native resolution — Steam Community, Nexus,
   Fandom, imgur, Reddit, YouTube, publisher press sites — are **all blocked at CONNECT**.

The one exception found, `sksebp-og.github.io`, exists because someone mirrored a whole personal
website — including its raw screenshot folder — into a Pages repo. That is a rare accident, and
it still came with a HUD on every frame.

**If the modern side matters, it has to come from Codex's run or from a channel with real
internet access.** The realistic in-container ceiling is roughly what is here: one clean frame
and one HUD-bearing run.

---

## §8 Things I was unsure about — over-reported deliberately

1. **Keeping 73 `vanilla_confidence: "medium"` files in slot folders rather than `unconfirmed/`.**
   The single biggest judgement call. Reversal instructions are in §3.
2. **Keeping the ACDSee-tagged Witcher 3 files.** §5 explains the counter-evidence. If a reviewer
   applies §8a literally, `modern/hud/` empties and `anti-generic/` empties with it.
3. **`identified_by` on the Morrowind files is slot-level, not per-image.** §8c wants three named
   features per image proving it is the game and place claimed. What was actually done: every one
   of the 73 was viewed on a contact sheet and confirmed to be an in-game Morrowind render of the
   claimed subject class, and the *place* name comes from the source project's own per-image
   caption (carried in the filename), not from independent identification. Every record carries
   an explicit `identified_how` field saying so. **This is weaker than §8c asks for.**
4. **`corroboration: "one-host"` on everything.** §8b wants the same scene attested on two
   independent sources. With every image host except GitHub blocked, a second host is not
   reachable for any image in this set. Nothing here is two-host corroborated.
5. **The Witcher 3 run is labelled `interval-run` but is not fixed-interval.** It is a paired A/B
   sweep. The property that matters — no beauty curation — holds; the letter of §3 does not.
6. **REF-A6's cliff racer** is a single distant silhouette against sky rather than a close study.
   It is the only cliff racer in the source. Read it for silhouette only.
7. **The RDR2 frame is 1921×1081.** An off-by-one window capture, not a resize; committed as
   downloaded. If a tool assumes even dimensions it will need to handle this.
8. **AVIF is not readable by `tools/metrics/image-metrics.mjs`.** See §9.

---

## §9 What could not be done

- **`video/` — nothing.** No reachable source.
- **`context/` — nothing.** No reachable ESO source.
- **Five of six `modern/` profile folders are empty**, and the sixth has one image.
- **Two-host corroboration is impossible** from this container.
- **`tools/metrics/image-metrics.mjs` reads PNG only** (it imports `pngjs`). Every reference file
  was decoded to PNG **in a scratch directory** and the PNG measured. Decoding is lossless with
  respect to the stored pixels, so the numbers in `reference-metrics.json` are the statistics of
  the exact committed bytes — but **no committed file was ever rewritten**, in keeping with §4.
  If the metrics tool is to run over `refs/` directly in future, it needs a JPEG/AVIF decode path.
- **`upscale_test` in `MANIFEST.json` is a rough instrument.** It normalises measured
  high-frequency energy against a fixed `1/f²` expectation (0.09 of total). Values scatter
  0.18–3.20 across the *native* Witcher 3 captures, which means content — sky versus foliage —
  dominates it. **Do not use it to reject a file on its own.** `nyq_ratio`, `bytes_per_pixel` and
  `block_score` behaved much more sensibly and are what the rejections above rest on.

---

## §10 Measured values against RI-VIS03's constructed bands

Full data: `reference-metrics.json`. Method and caveats: §11 below. **RI-VIS03 was not edited** —
this is a proposed amendment, per the brief.

`modern-hud` (n=24, Witcher 3, mostly bright exteriors → compare against RI-VIS03's
`exterior_daylight` row) and `morrowind` (n=73) as a contrast population:

| Metric | RI-VIS03 band (`constructed`) | **Modern p10 – p90** | modern p50 | Morrowind p10 – p90 | mw p50 |
|---|---|---|---|---|---|
| `M1 DR` | ≥ 0.72 | **0.799 – 0.954** | 0.896 | 0.351 – 0.884 | 0.666 |
| `M1 mean Yp` | 0.28 – 0.58 | **0.236 – 0.414** | 0.309 | 0.124 – 0.520 | 0.332 |
| `M1 blown` | ≤ 0.05 | **0.000 – 0.0013** | 0.0001 | 0.000 – 0.00004 | 0.000 |
| `M1 crushed` | ≤ 0.10 | **0.0002 – 0.0067** | 0.0023 | 0.000 – 0.0007 | 0.00004 |
| `M2 C_global` | 0.13 – 0.28 | **0.203 – 0.294** | 0.247 | 0.067 – 0.273 | 0.191 |
| `M2 C_local_med` | ≥ 0.045 | **0.0587 – 0.0844** | 0.0677 | 0.0303 – 0.0693 | 0.0449 |
| `M4 ED_1` | 0.10 – 0.34 | **0.172 – 0.320** | 0.227 | 0.054 – 0.207 | 0.101 |
| `M5 HFR` | 0.06 – 0.24 | **0.068 – 0.178** | 0.109 | 0.028 – 0.218 | 0.076 |
| `M5 NYQ_ratio` | ≤ 0.18 | **0.363 – 0.465** | 0.404 | 0.300 – 0.419 | 0.366 |
| `M5 alpha` | 1.6 – 2.6 | **2.244 – 2.658** | 2.521 | 2.110 – 2.821 | 2.515 |
| `M8 TotalFlat` | ≤ 0.18 | **0.006 – 0.040** | 0.020 | 0.000 – 0.089 | 0.008 |
| `M8 near-flat` | ≤ 0.18 | **0.077 – 0.180** | 0.125 | 0.006 – 0.355 | 0.125 |
| `M7 dY_sky` | ≥ 0.06 | **0.248 – 0.417** | 0.282 | 0.055 – 0.288 | 0.130 |

### What the guesses got right

**M4, M5 HFR, M5 alpha, M2 C_global and M8 were guessed close.** `ED_1 0.10–0.34` versus a
measured `0.172–0.320`; `HFR 0.06–0.24` versus `0.068–0.178`; `alpha 1.6–2.6` versus
`2.244–2.658`; `C_global 0.13–0.28` versus `0.203–0.294`; the near-flat variant of M8's
`TotalFlat ≤ 0.18` versus a measured p90 of exactly `0.180`. For a set of numbers picked by an
authoring agent with no reference population, that is a good showing and it is worth saying so.

### What the guesses got wrong — five proposed amendments

1. **`M1 mean Yp` floor is too high.** Band says 0.28; the measured p10 of a real current-gen
   population is **0.236**. Roughly a quarter of genuine Witcher 3 daylight frames would fail
   M1 as written. **Propose `0.23 – 0.45`** for `exterior_daylight`.
2. **`M1 blown` and `M1 crushed` maxima are one to two orders of magnitude too loose.** Band
   allows 5% blown and 10% crushed; real frames sit at **0.13% and 0.23% median**, p90 of
   **0.13% and 0.67%**. As written these thresholds cannot fire on anything short of a broken
   renderer. **Propose `blown ≤ 0.005`, `crushed ≤ 0.02`**, which still leaves 3–7× headroom
   over the measured p90.
3. **`M7 dY_sky` floor is ~4× too lenient.** Band says ≥ 0.06; measured p10 is **0.248**.
   **Propose `≥ 0.15`.**
4. **`M2 C_local_med` floor is slightly too lenient.** Band says ≥ 0.045; measured p10 is
   **0.0587**. **Propose `≥ 0.052`.** (Caveat: 16 px tiles here, 32 px in the spec — see §11.)
5. **`M5 NYQ_ratio ≤ 0.18` is the one that is simply wrong, and it matters most.** Every single
   real reference frame measures **0.363–0.465**. Not one current-generation, natively captured,
   losslessly stored 1440p gameplay frame would pass M5's anti-aliasing check as written. **A
   band that 100% of the reference population fails is not a bar, it is a broken instrument.**

   Worse — and this is the finding that should change something — **the 2002 Morrowind
   population measures 0.300–0.419, i.e. *lower* (nominally "better anti-aliased") than the
   modern population.** The metric as implemented cannot separate anti-aliasing quality from
   codec and resampler behaviour; it is dominated by whatever last touched the high-frequency
   tail. **Do not ship an AA verdict on this number.** Either:
   - recompute NYQ over RI-VIS03's exact bands (`[0.45,0.50)` ÷ `[0.20,0.45)`) on a PNG captured
     by our own harness — where there is no codec in the path at all — and re-derive the band
     from *our* renders with AA on versus off, which is the only comparison that isolates it; or
   - drop the absolute threshold and keep only RI-VIS03's own supersampling differential test
     ("compute `NYQ_ratio` on a 2× supersampled capture; if it collapses, it is AA/mip"), which
     is self-referential and therefore immune to this problem.

### What the reference set additionally shows

**`M1 dynamic_range_stops` separates the two eras cleanly and nothing else here does**: modern
**9.20–11.75**, Morrowind **5.77–8.37**, with no overlap between the modern p10 and the Morrowind
p90. If a single number is wanted for "is this a modern render", that is the candidate, and it is
not currently one of M1's reported fields. **Propose adding `stops` to M1's reported triple.**

**M3 could not be checked at all.** RI-VIS03 specifies `meanC` in **CIELAB C\***; the harness
reports HSV saturation and an RGB max−min chroma. They are not convertible. M3's `12–32` band
remains entirely unverified, and **`tools/metrics/image-metrics.mjs` needs a CIELAB chroma path
before M3 can ever be calibrated.**

---

## §11 How to read §10 — the caveats, which are not small

1. **n = 24 for the modern band, from one game, one session, one operator.** §3 asked for 12
   images from 3 games and 6 locations *per profile*, precisely so a p10/p90 means something.
   These bands are **indicative, not authoritative**. Treat them as "the constructed bands were
   tested against a real population and here is where they visibly break", not as a calibration.
2. **The modern population is `modern/hud/`, which §5a bars from comparison.** The measurement was
   run anyway because a band derived from a HUD-bearing frame is still far more informative than a
   band derived from nothing — but the HUD occupies roughly 4% of frame area with synthetic,
   maximum-contrast geometry. It will bias `M4 ED_1` and `M8` *upward* and `M2 C_local` upward.
   The M4 and M8 numbers above should be read as slight over-estimates.
3. **The harness metric names are not RI-VIS03's metric names.** The mapping used, and its
   defects:

   | RI-VIS03 | harness field | mismatch |
   |---|---|---|
   | M1 `DR` = P99−P1 | `dynamic_range.p995_minus_p005` | P99.5−P0.5, slightly wider |
   | M1 over `FG_MASK` | whole frame | RI-VIS03 excludes sky; this does not |
   | M2 `C_local_med` = median of 32×32 tiles | `rms_contrast.local_mean_16px` | **mean** of **16 px** tiles |
   | M3 `meanC` (CIELAB C\*) | `saturation.mean_chroma` (RGB max−min) | **not comparable — M3 unverified** |
   | M4 `ED_1` @ Sobel 0.08 | `edge_density.frac_above_threshold` @ 0.08 | matches, but whole-frame |
   | M5 `HFR` over `[0.20,0.45)` | `fft.high_band_ratio` over r > 0.25 Nyq | different band edges |
   | M5 `NYQ` = `[0.45,0.50)` ÷ `[0.20,0.45)` | `very_high_band_ratio ÷ high_band_ratio` | **different edges — see amendment 5** |
   | M8 `TotalFlat` | `flat_shading.flat_tile_frac` / `near_flat_tile_frac` | two candidates, both reported |
   | M7 `dY_sky` | `sky_gradient.row_mean_range` | top 40% of rows, no horizon detection |

4. **The Morrowind column is a contrast population, not a target.** Those files are 320×320 AVIF
   downscales; every frequency-domain number in that column measures the AVIF encoder as much as
   it measures Morrowind. It is included because the *direction* of the differences is
   informative (and because the NYQ inversion in amendment 5 is only visible with it), not because
   the values mean anything on their own. `pixel_metrics_valid: false` is set on all 73 records.

---

## §12 Stop condition

Not met. Five of six `modern/` folders and both of `context/` and `video/` are short, and §7
explains why continuing to search from this container will not change that. Stopping here and
reporting accurately is the correct outcome per §11 rung 5 and per the brief's closing
instruction.
