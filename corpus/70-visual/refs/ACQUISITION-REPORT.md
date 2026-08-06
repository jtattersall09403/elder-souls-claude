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

> **Revision 3** (2026-08-06, agent `image-acquisition-modern`) — **§14.** Three things changed.
> **(a) §0 and §7 are stale: the policy proxy has been removed and the internet is open.** Steam
> Community, Wikimedia, imgur, YouTube, Flickr and Reddit are all reachable, and Steam serves
> original un-recompressed screenshot bytes; §7's "GitHub is all there is" conclusion was true of
> the old network and is false now. Acquisition of `modern/`, `video/` and `context/` was handed
> to an external Codex agent, and revision 3 wrote **nothing** into those three folders — §1's
> modern rows are unchanged and still accurate. **(b) REF-A12 is filled** — by OpenMW's MyGUI
> layout and skin XML rather than by a screenshot, which is what §13.2 recommended. **(c)** a
> merge and audit tool, `tools/refs/merge-manifest.mjs`, now exists for reconciling Codex's set
> with this one; it found two defects in the existing set, recorded in §14.3.

---

## §0 What the network actually permitted

**Superseded by §14.0 — the proxy described here no longer exists.** The table below is revision
1's measurement and is retained because it explains the shape of everything in §2–§7.

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
| **REF-A12** | **The UI** — inventory, dialogue topics, journal, map | **yes (rev 3), by structure not by pixels** | 38 files | Filled from **OpenMW's MyGUI layout and skin XML**, not from a screenshot: exact widget geometry, border weights, texture vocabulary and the `[FontColor]` table. Fills the layout half of the slot exactly; fills the appearance half not at all. **See §14 and `morrowind/REF-A12/README.md`.** |
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

### `dehero/mwscr` — "Morrowind Screenshots" — 89 images (the whole Morrowind side)

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
by eye on contact sheets of all 89.** **V2 (no distant land) assessed per image** — 7 images
show terrain beyond the fog wall and are recorded `engine: "openmw-distant-land"`, which §7 says
is usable for silhouette and palette but not composition or draw distance. **V3, V4 and V6 cannot
be assessed at 320×320 after AVIF compression and are recorded as `null`, not as `true`.**
Therefore `vanilla_confidence: "medium"` on all 89, never `"high"`.

> **Judgement call the reviewer should check.** A literal reading of §7 ("If you cannot confirm
> all seven … place the file in `refs/morrowind/unconfirmed/`") would put all 89 in
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

~~**REF-A13 (armour and clothing on NPCs at close range).**~~ **Revision 2: this slot is now
filled and the paragraph below was wrong.** Revision 1 searched `mwscr` filenames for armour
nouns (`armor`, `cuirass`, `bonemold`, `chitin`, `glass`, `ebony`, `daedric`) and found nothing,
and concluded the slot was unfillable. The correct search term was the *wearer*, not the armour:
`guard`, `ordinator`, `guardess`, `armory`. That returned 29 candidates, of which five show an
NPC in armour or distinctive clothing at readable size — including one **from behind**, which is
the view our camera actually uses. **Lesson for a successor: search a screenshot archive by what
the caption-writer would have called the subject, not by the corpus's own vocabulary.**

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

1. **Keeping 89 `vanilla_confidence: "medium"` files in slot folders rather than `unconfirmed/`.**
   The single biggest judgement call. Reversal instructions are in §3.
2. **Keeping the ACDSee-tagged Witcher 3 files.** §5 explains the counter-evidence. If a reviewer
   applies §8a literally, `modern/hud/` empties and `anti-generic/` empties with it.
3. **`identified_by` on the Morrowind files is slot-level, not per-image.** §8c wants three named
   features per image proving it is the game and place claimed. What was actually done: every one
   of the 89 was viewed on a contact sheet and confirmed to be an in-game Morrowind render of the
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
`exterior_daylight` row) and `morrowind` (**n=89**, revision 2) as a contrast population:

| Metric | RI-VIS03 band (`constructed`) | **Modern p10 – p90** | modern p50 | Morrowind p10 – p90 | mw p50 |
|---|---|---|---|---|---|
| `M1 DR` | ≥ 0.72 | **0.799 – 0.954** | 0.896 | 0.347 – 0.885 | 0.656 |
| `M1 mean Yp` | 0.28 – 0.58 | **0.236 – 0.414** | 0.309 | 0.127 – 0.513 | 0.311 |
| `M1 blown` | ≤ 0.05 | **0.000 – 0.0013** | 0.0001 | 0.000 – 0.00004 | 0.000 |
| `M1 crushed` | ≤ 0.10 | **0.0002 – 0.0067** | 0.0023 | 0.000 – 0.0006 | 0.00004 |
| `M2 C_global` | 0.13 – 0.28 | **0.203 – 0.294** | 0.247 | 0.068 – 0.274 | 0.181 |
| `M2 C_local_med` | ≥ 0.045 | **0.0587 – 0.0844** | 0.0677 | 0.0301 – 0.0728 | 0.0454 |
| `M4 ED_1` | 0.10 – 0.34 | **0.172 – 0.320** | 0.227 | 0.049 – 0.209 | 0.107 |
| `M5 HFR` | 0.06 – 0.24 | **0.068 – 0.178** | 0.109 | 0.028 – 0.221 | 0.082 |
| `M5 NYQ_ratio` | ≤ 0.18 | **0.363 – 0.465** | 0.404 | 0.303 – 0.433 | 0.368 |
| `M5 alpha` | 1.6 – 2.6 | **2.244 – 2.658** | 2.521 | 2.105 – 2.799 | 2.500 |
| `M8 TotalFlat` | ≤ 0.18 | **0.006 – 0.040** | 0.020 | 0.000 – 0.089 | 0.008 |
| `M8 near-flat` | ≤ 0.18 | **0.077 – 0.180** | 0.125 | 0.012 – 0.324 | 0.125 |
| `M7 dY_sky` | ≥ 0.06 | **0.248 – 0.417** | 0.282 | 0.054 – 0.290 | 0.130 |

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
**9.20–11.75**, Morrowind **5.61–8.31**, with no overlap between the modern p10 and the Morrowind
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
   the values mean anything on their own. `pixel_metrics_valid: false` is set on all 89 records.

---

## §12 Stop condition

Not met. Five of six `modern/` folders and both of `context/` and `video/` are short, and §7
explains why continuing to search from this container will not change that. Stopping here and
reporting accurately is the correct outcome per §11 rung 5 and per the brief's closing
instruction.

---

## §13 Revision 2 addendum (2026-08-06, successor agent)

Revision 1 was written and the agent was killed by a usage limit. A successor resumed from
`orchestration/status/image-acquisition.json`. This section records what changed. **Everything
above is revision 1's text with only the counts and the REF-A13/A15/A18/A19 rows corrected; no
judgement of revision 1 was overturned.**

### §13.1 Three REF-A slots filled — 73 → 89 Morrowind images

`dehero/mwscr` was re-cloned (70 MB, deleted immediately after extraction) and searched again
with different vocabulary. Sixteen further files were placed and verified by eye on PIL contact
sheets:

| Slot | n | What was searched that revision 1 did not |
|---|---|---|
| **REF-A13** — armour and clothing | 5 | `guard`, `ordinator`, `guardess`, `armory` — the *wearer*, not the armour. See the struck-through paragraph in §4. |
| **REF-A18** — dusk / night exterior | 5 | `night`, `dusk`, `moon`, `masser`, `star`, `sunset`, `evening`. Revision 1 did not attempt A18 or A19 at all; both are late additions to the request's §5e table and were not in the slot list it worked from. |
| **REF-A19** — stilted / waterside settlement | 5 | `hla-oad`, `gnaar-mok`, `vos`, `seyda`, `dock`, `pier`, `shack`, `stilt`. |
| REF-A15 — Daedric signage | +1 | The Gnaar Mok signboard: large red Daedric characters filling a third of the frame. The best legible Daedric script in the source, and it replaces the one A15 candidate that was rejected for subject size. |

All sixteen carry the same provenance profile as the other 73: `provenance_chain:
"downscaled-preview"`, `pixel_metrics_valid: false`, `corroboration: "one-host"`,
`vanilla_confidence: "medium"`, V3/V4/V6 `null`. **Every caveat in §3, §8 and §11 applies to them
unchanged.**

Two of the sixteen (`REF-A13__…high-ordinator-surveying-godsreach-at-night`,
`REF-A13__…going-out-of-mournhold-armory`, and `REF-A18__…masser-over-the-mournhold-temple` had
it been taken) are set in **Mournhold**, which is *Tribunal* expansion content rather than base
2002 Vvardenfell. It is official Bethesda content, so §7 passes — but if the art-direction spec
means Vvardenfell specifically, those two should be swapped. **Flagged rather than decided.**

**REF-A12 (the UI) remains the single unfilled Morrowind slot, and it is permanently unfillable
from this source.** `mwscr`'s stated editorial policy is "No interface": every one of ~1,600 files
in it was captured with the HUD and menus off, by design. There is no inventory, journal, dialogue
list or map anywhere in the repository. **A realistic version, better than revision 1's
suggestion:** Morrowind's UI is recoverable *exactly* from OpenMW's `resources/mygui/` layout XML,
which is clonable from this container. That gives real widget geometry rather than a photograph of
it, which is what a UI transposition actually needs. `RI-UIX*` should cite those layout files.

### §13.2 The finding that matters more than the images — the tool does not compute RI-VIS03

Revision 1's §11.3 table noted that the harness metric names differ from RI-VIS03's. On
re-reading `tools/metrics/image-metrics.mjs` line by line, **the divergence is larger than that
table implies, and in three places the numbers are not comparable at all.**

**(a) There is no `FG_MASK`.** Every RI-VIS03 band is computed over `FG_MASK` = NOT sky.
`image-metrics.mjs` masks nothing. `mean_Y`, `C_global`, `ED_1` and both flat fractions are
whole-frame, so all four are contaminated by however much sky the frame contains — and by a
different amount per frame, which is worse than a constant bias.

**(b) The FFT runs on a 256×256 downscale of the whole frame, not a native 1024² centre crop.**
`radialSpectrum(Y, w, h, 256)` calls `resampleSquare(Y, w, h, 256)` first. A 2560×1440 frame is
box-averaged down by a factor of ten before the transform. **Everything above 256 cycles — which
is the entire range M5 was designed to interrogate — is destroyed before the measurement
begins.** M5 exists to measure texture resolution and aliasing; as implemented it measures the
box filter. It is also therefore **resolution-dependent**, so a 320px Morrowind preview and a
1440p Witcher 3 frame are not on the same scale even in principle.

This is the mechanical explanation for revision 1's amendment 5 — the observation that the 2002
population measured "better anti-aliased" than the modern one. **That inversion is not a fact
about the games. It is an artefact of downscaling both to 256² first.** Revision 1's conclusion
("do not ship an AA verdict on this number") was right; the reason is now known, and it is worse
than "different band edges". Both of its proposed fixes remain correct, and the first is now
clearly the necessary one.

**(c) Neither of M8's two HARD FAIL statistics is computed by anything in this repository.**
RI-VIS03's M8 is the headline metric — the one that caps the FIDELITY score at 2 and the one
RI-VIS01 CC-3 exists to protect. It is defined as `FS_score` (216-bin RGB colour-cube, within-bin
luminance variance, area-weighted) and `LargestFlat` (9×9 local-standard-deviation threshold at
0.008, largest 4-connected component). `image-metrics.mjs` computes neither. `flat_tile_frac` is
a count of 16×16 tiles whose standard deviation is below 0.004 — a different statistic with a
different threshold on a different support. **M8 currently has no implementation.**

**(d) Band edges and supports, precisely.**

| RI-VIS03 | `image-metrics.mjs` | Comparable? |
|---|---|---|
| M5 `HFR` = `E(f∈[0.20,0.45)) / (E_LOW+E_MID+E_HIGH)` | `high_band_ratio` = `E(r/nyq∈[0.25,1.0)) / E(all)` | No — wider band, includes Nyquist, different denominator |
| M5 `NYQ_ratio` = `E([0.45,0.50)) / E([0.20,0.45))` | `very_high/high` = `E([0.5,1.0)) / E([0.25,1.0))` | **No — a different quantity.** This is why measured values are 0.36–0.46 against a `max 0.18` band. **That is not a failure; do not read it as one.** |
| M2 `C_local_med` = **median** of **32×32** tile stdevs | `local_mean_16px` = **mean** of **16×16** tile stdevs | Loosely |
| M4 `ED_1` + `ED_2` + `ED_4` + `scale_ratio` | `frac_above_threshold` only | Partly — **`scale_ratio` is not computed**, so the alias-storm / noise-injection guard does not exist |
| M3 `meanC` in CIELAB C\*, `chroma_frac`, `p95C`, `H_hue` | HSV saturation and RGB max−min | **No — different colour space. M3 is entirely unverified.** |
| M7 `SKY_MASK` = largest 4-connected component touching row 0 | "the top 40% of rows", no horizon detection | No |
| M6, M9, M10, M11, M12 | not implemented | **Not computed at all** |

**Consequence, stated as plainly as it can be: of RI-VIS03's twelve metrics, exactly two (M1 and,
loosely, M4) can be calibrated by any reference image today. M2 and M7 need the statistic
corrected. M3, M5, M6, M8, M9, M10, M11 and M12 need implementing before any photograph can
calibrate them.**

**This changes the project's priority order.** Revision 1 concluded that the modern side needs
Codex's images. That is still true and still necessary — but it is no longer sufficient, and it
is no longer first. **Extending `image-metrics.mjs` to implement RI-VIS03 as written is now the
blocking task**, it is cheaper than another acquisition session, and it is a prerequisite for the
images Codex returns being worth anything numerically. Until it lands, the images serve
RI-VIS05's art-direction judgement and RI-VIS06's blind pairing — which need no numbers at all —
and nothing else.

### §13.3 What was regenerated

- `_provenance.json` — 111 → 127 records (16 hand-authored blocks added).
- `MANIFEST.json` — regenerated by `make-manifest.py`; 127 records. **No numeric field was hand-
  edited; the script is the only writer of `_computed.json`.**
- `reference-metrics.json` — recomputed over all 127 files in five populations, adding `rejected`
  (measured only so the rejection log can quote a failing statistic — **it is not a band**). Two
  new top-level fields, `population_note` and `metric_name_warning`, carry §13.2's warning inside
  the data file so a consumer who never reads this report still meets it.
- Every image file is byte-identical to the upstream commit. **Nothing under `refs/` was ever
  rewritten, re-encoded or resized.** Measurement decoding to PNG happened in a scratch directory
  outside the repository, as in revision 1.

### §13.4 Codex status at the time of writing

**Codex had written nothing into `corpus/`.** No progress file, no images, no manifest fragment.
The merge procedure for when it does is in §13.5.

### §13.5 How to merge Codex's results into this set

The manifest schema takes both sides; nothing here needs restructuring.

1. Drop files into the folders in the request's §2. **Do not touch anything already present.**
2. Add one block per file to `_provenance.json`, keyed by path relative to `refs/`.
3. Run `python3 corpus/70-visual/refs/make-manifest.py`. It recomputes `_computed.json` and
   re-joins `MANIFEST.json`. Numeric fields come only from the script and cannot be hand-edited
   into agreement.
4. Decode each population to PNG in a scratch directory, run
   `node tools/metrics/image-metrics.mjs --in <scratch>/<population>`, and rebuild
   `reference-metrics.json`. **Never rewrite a committed image file.**
5. Update §1, §2 and §10 here, and the coverage table in `RI-VIS09` §3. Both documents are
   written so that a new population changes a row, not the document.

---

## §14 Revision 3 addendum (2026-08-06, agent `image-acquisition-modern`)

This revision did **two** things and deliberately did not do the third it was dispatched for.

### §14.0 What this agent did not do, and why — read first

It was dispatched to fill the **modern fidelity side**, on the correct observation that §0's
network table is stale: **the policy proxy has been removed and outbound internet is now
unrestricted.** That was verified before standing down, and the verification is worth keeping
because it overturns §7's structural conclusion:

| Host | Revision 1 result | **Revision 3 result** |
|---|---|---|
| `steamcommunity.com` | 403 at CONNECT | **200** |
| `images.steamusercontent.com` (Steam UGC originals) | untested | **200, full original bytes** |
| `upload.wikimedia.org`, `i.imgur.com`, `www.youtube.com`, `flickr.com`, `reddit.com` | 403 at CONNECT | **reachable** |
| `images.nexusmods.com` | 403 | 403 (still) |

A working Steam harvest was built and proven end to end: the app screenshot hub yields
`sharedfiles/filedetails/?id=…` links; each detail page (fetched **with `--compressed`**, or the
response is gzip and unparseable) yields the poster, the date, the resolution and the
`ActualMedia` URL, whose **query string stripped** is the original upload. A sample Elden Ring
original measured **3840×1608 at 6.97 bits/pixel** — a native, high-quality, un-recompressed
capture, exactly the class of file §4 wants and §7 concluded did not exist reachably.

**§7's "the realistic in-container ceiling is one clean frame" is therefore false as of this
revision.** It was true of the network it was written against.

Acquisition was then **handed to an external Codex agent** running the same specification against
the same branch with unrestricted internet, to avoid two uncoordinated processes writing
`refs/modern/`, `refs/video/`, `refs/context/`, `MANIFEST.json` and `ACQUISITION-REPORT.md` at
once. **This agent wrote nothing into those three folders — zero files created, modified or
deleted there.** §1's modern rows are unchanged and remain accurate. Two things a successor
should carry:

- **Steam search endpoint, the non-obvious part.**
  `/workshop/browse/?appid=X&section=screenshots&searchtext=Q` works **only for apps that have no
  Steam Workshop** (Elden Ring, 1245620 — 21 hits/page). For apps that *do* have one (Skyrim SE
  489830, The Witcher 3 292030) that URL renders the mod workshop and returns **zero**
  screenshots, which reads exactly like "the search found nothing". The endpoint that works
  everywhere is `https://steamcommunity.com/app/<appid>/screenshots/?p=<n>&browsefilter=toprated&searchText=<q>`.
- **Steam is a natural fit for §8b.** Every screenshot page carries a visible post date, so
  anything posted before 2023-01-01 satisfies `pre-2023-page` outright — and Skyrim SE (2016),
  The Witcher 3 (2015) and RDR2 (2019) all have deep pre-2023 galleries. A single poster's
  gallery for one app, sorted oldest-first, is also the cleanest available **interval-run** source
  under §3: it is a real upload series, and taking every Nth entry is genuinely unbiased.
- **Aspect ratio is the first filter, not an afterthought.** The very first Elden Ring original
  sampled was 3840×1608 (21:9). §6 rejects ultrawide, and a large share of Steam's most-rated
  screenshots are ultrawide precisely because they look impressive.

### §14.1 REF-A12 filled — the Morrowind UI, by structure rather than by pixels

**38 files, byte-exact, from `https://github.com/OpenMW/openmw` at commit
`f673ab858b8d1ccedeaeb39383896d8be3017ce1` (2026-08-03)**, cloned `--depth 1`:
`files/data/mygui/` (36 layout and skin files), `files/openmw.cfg`, and
`files/data/scripts/omw/mwui/constants.lua`. They live in `morrowind/REF-A12/{mygui,config}/`.

§13.2's own recommendation, acted on. The full account — what this does and does not license a
critic to judge, and the caveat that OpenMW is a *reproduction* of an interface Bethesda compiled
into `Morrowind.exe` rather than a Bethesda artifact — is in **`morrowind/REF-A12/README.md`**,
which anyone citing this slot must read. The short version:

- **Filled exactly:** window and panel geometry, border weights (the whole UI has exactly two,
  4 px and 2 px), client insets, column widths, control placement, anchor and stretch rules,
  spacing constants (`border 2`, `thickBorder 4`, `padding 2`), the texture-name vocabulary
  (~30 small *tiling* sprites plus one painted book asset), and the complete 45-entry
  Morrowind.ini `[FontColor]` table with RGB values.
- **Not filled at all:** appearance. No pixel of Morrowind's UI art is here — the `menu_*.dds` and
  `tx_menubook*.dds` files live in `Morrowind.bsa` and are named by the skins, not contained in
  them. Bevel, sheen, wear, type and populated density remain unjudgeable, and four 1024×768
  vanilla captures (inventory, dialogue, journal, map) would still be worth acquiring.
- OpenMW's own `omw_*.dds` additions (scrollbar arrows, controller glyphs — things Morrowind never
  had) were **deliberately excluded** so nothing here can be mistaken for 2002 art direction.

`vanilla_confidence: "high"` on all 38, with `vanilla_tests: null` and an explicit note: §7's seven
tests are tests of a rendered screenshot and **none of them applies to an XML file**. Recording
them as `null` rather than as passes is the honest reading. `pixel_metrics_valid: false` and every
pixel statistic `null` on all 38 — they must never enter a metrics population.

**`make-manifest.py` was extended, additively**, with a `TEXT_EXT` set and an `analyse_text()`
path that records `bytes`, `sha256`, `format` and a line count for non-image assets and computes
nothing else. Verified: **all 127 pre-existing `_computed.json` entries are byte-identical after
the change**, and `--check` reports `ok: 165 files, no drift`.

### §14.2 `tools/refs/merge-manifest.mjs` — the tool this set needed before Codex arrives

Written and verified against the live manifest. Four jobs, one refusal.

1. **Audit** — every record against §9's schema, against the file on disk, and against the file's
   real sha256. `file-missing`, `file-unrecorded` and `hash-mismatch` are the failures that
   silently corrupt every band computed downstream, so they are reported first.
2. **Duplicate detection by content hash**, across folders — the thing two uncoordinated
   acquisition runs are guaranteed to produce. Duplicates that a record *declares* (§5c's
   `anti-generic/` anchor is five deliberate byte-copies of `modern/hud/` frames) are separated
   from undeclared ones.
3. **Merge a foreign manifest by `sha256`, never by path.** Same bytes under two names is a
   conflict to report, not a second file to add. Same path with different bytes is refused
   outright — overwriting there would silently swap an image. Where both sides describe the same
   bytes, the richer provenance is adopted onto *our* path and the swap is recorded in a
   `merge_note`.
4. **Per-folder counts against §3's floors**, counting only `pixel_metrics_valid: true` records,
   which is what §3 actually says — and counting non-image assets in a separate column so
   REF-A12's 38 files can never be mistaken for 38 pictures.

**The refusal:** it never writes an image, never writes a numeric field, and **never writes a
provenance record for a file it cannot see on disk** (§9 rule 9 — verified in test: a foreign
record for a file that does not exist is counted, reported, and skipped). `--write` touches
`_provenance.json` only and then prints the instruction to re-run `make-manifest.py`, which
remains the sole writer of `MANIFEST.json` and of every computed number. Running without
`--write` changes nothing, and re-running with it is idempotent (verified: second pass reports
`+0 new, 0 upgraded`).

```
node tools/refs/merge-manifest.mjs                          # audit + duplicates + floors
node tools/refs/merge-manifest.mjs --merge codex.json       # dry run, report only
node tools/refs/merge-manifest.mjs --merge codex.json --write
python3 corpus/70-visual/refs/make-manifest.py              # always, afterwards
```

Also wired as `npm run refs` / `npm run refs:check` in `tools/package.json`.

### §14.3 Two defects the new audit found in the *existing* set

Both pre-date this revision and neither was previously noticed. Reported, not fixed — fixing them
touches `anti-generic/` and Morrowind slot folders and should be one deliberate decision, not a
side effect of a tooling change.

1. **All five `anti-generic/` records carry `side: "modern-fidelity"`.** §9 is explicit that
   `side` must agree with the folder, and the correct value is `"anti-generic"`. This is not
   cosmetic: `anti-generic/` is the negative anchor that §5c says is *never* cited as a target,
   and a consumer selecting the fidelity population by `side === "modern-fidelity"` would pull
   five deliberately generic-fantasy frames into it. **Fix: set `side` to `"anti-generic"` on
   those five provenance blocks.** (They are byte-copies of `modern/hud/` frames, which is
   declared and legitimate — only the `side` value is wrong.)
2. **Two Morrowind images are filed under two slots each**, inflating both slot counts by one:
   `mwscr-2017-01-12-sunset-on-ascadian-isles.avif` in both REF-A1 and REF-A18, and
   `mwscr-2016-12-19-hla-oad.avif` in both REF-A8 and REF-A19. Both re-uses are defensible on
   subject (an Ascadian sunset really is both a vista and a dusk exterior), but §5e's "two to
   three images per slot" reads as distinct images, so REF-A18 and REF-A19 are effectively 4 not
   5. Either add a `duplicate_of` declaration — which is what `anti-generic/` does and what makes
   the audit quiet — or replace one copy.

The audit's remaining output is **121 `WARN corroboration` records**, which is not a new finding:
§8.4 already recorded that every file in the set is `"one-host"` because no second host was
reachable when it was acquired. Now that the network is open, **re-corroborating the existing 127
is cheap and would clear the single largest compliance gap in the set.**

---

# Appended from the external (Codex) acquisition run

# Reference acquisition package report

## 1. Per-folder acquisition table

The newly acquired binary media is intentionally omitted from this change because the Codex browser UI rejects binary patches. Pre-existing reference assets remain untouched. Running `acquire.py` reconstructs the following additional critic corpus from the source catalogue:

| Destination folder | Download records | Intended use |
|---|---:|---|
| `modern/exterior_daylight` | 10 | daylight landscapes and architecture |
| `modern/exterior_lowlight` | 11 | night, mist, Caelid, snowfield, and Farum Azula views |
| `modern/interior_darkemissive` | 8 | Roundtable Hold, cave, sending-gate, and Nokron views |
| `modern/character_closeup` | 11 | gameplay and cutscene character studies |
| `modern/combat` | 2 | Flying Dragon Agheel and Maliketh combat |
| `modern/hud` | 4 | title and loading-screen material |
| **Total** | **46** | critic-agent comparison corpus |

Each record includes the direct source URL, destination path, expected byte count, expected SHA-256, uploader, source page, visual description, and three identifying features. The downloader rejects any response whose bytes differ from the first verified acquisition.

## 2. Per-slot table

| Set | Packaged | Notes |
|---|---:|---|
| Exterior daylight | 10 | Leyndell, Mountaintops, Haligtree, and Shadow Realm scenes |
| Exterior lowlight | 11 | Caelid, night, snowfield, mist, and Farum Azula scenes |
| Interior dark/emissive | 8 | Roundtable Hold, caves, sending gate, and Nokron |
| Character close-up | 11 | Melina, Godrick, Malenia, and Shadow Realm characters |
| Combat | 2 | Agheel and Maliketh |
| HUD/menu/loading | 4 | Elden Ring title and loading artwork |
| Material close-up | 0 | No unrelated crop was invented to fill this category |
| Morrowind/context/video | 0 packaged | Previous candidates lacked reconstructable direct sources; they are not represented by fabricated records |

## 3. Rejection log

| Attempt | Reason |
|---|---|
| UESP Morrowind originals | The metadata API responded, but original-image requests returned Cloudflare HTTP 403 challenge pages. Challenge bytes were never retained as media. |
| Inherited Morrowind, Witcher, RDR2, anti-generic, and historical rejection binaries | No complete, reconstructable direct-source catalogue accompanied them. They remain untouched as pre-existing assets and are not duplicated in the new source catalogue. |

## 4. Uncertainties

- Steam may remove public files in the future; pinned byte lengths and SHA-256 values turn that into a loud acquisition failure rather than silent corpus drift.
- Twenty-nine source pages visibly date from 2022. Later records retain honest `corroboration: unknown` values.
- Steam JPEG compression causes some files to be critic-useful but unsuitable for numeric calibration. Their provenance records retain the original integrity decisions.

## 5. Anything not completed

- This reproducible package covers the 46-source Elden Ring critic set, not every aspirational slot from the original measurement-instrument request.
- Material close-ups, reconstructable Morrowind sources, ESO context, and videos require additional source catalogues.
- `MANIFEST.json` and `_computed.json` are generated locally after download and are intentionally absent from the text-only change.

---

# §15 — Revision 5: reference builder, round 1 (agent `ref-builder-r1`, 2026-08-06)

**Inputs:** `ACQUISITION-CRITIQUE-R1.md` (coverage critique, verdict INSUFFICIENT) and its 734
verified souls/Morrowind candidates; `ACQUISITION-CRITIQUE-R1-code.md` and its 472 verified
candidates; `ACQUISITION-SPEC-AMENDMENTS.md` A1–A6.

**What this revision did:** built. It did not re-run the critics' research. 1,206 candidate URLs
were already verified live; effort went into fetching, eyeball triage, filing and documenting.

## 15.1 Headline

| | before | after |
|---|---:|---:|
| media files under `refs/` | 173 | **450** (`MANIFEST.json`: 488 records including 38 REF-A12 text assets) |
| `souls-behaviour/` (amendment A5, the user's explicit ask) | **0 files, directory absent** | **93 files, 8 subfolders** |
| Morrowind UI as pixels (`REF-A12b` + `REF-A20`, A2) | **0** | **37** |
| Morrowind images that are full-frame, native aspect | **0 of 89** | **57 new; the 89 crops kept and marked `superseded_by`** |
| `refs/modern/` profiles with ≥2 distinct games | 1 of 6 | **6 of 6** |
| interval-run frames in a profile folder (§3 anti-curation) | **0** | **24** |
| `context/` (ESO, amendment A6) | 0 | **23** |
| `video/` | 0 | 1 (V4/V3; **V1 and V2 not obtained — see 15.6**) |

`python3 corpus/70-visual/refs/acquire.py --check` **passes: 323 of 323 fetchable records verify
byte-for-byte**, including the 3.3 GB video. `MANIFEST.json` holds **488 records, 0 with
`PROVENANCE_MISSING`** — catalogue and disk agree for the first time (critique defect **H1**).

## 15.2 Per-folder counts against the floors

Floors from §3 as amended by A1/A2/A4. §3 counts only `pixel_metrics_valid: true`; that flag is
now set by a **computed** post-pass over `make-manifest.py`'s `nyq_ratio` / `upscale_test` /
`block_score` against §8a's thresholds, never typed by hand.

### `refs/modern/`

| Folder | Floor imgs/games/locs | Files | **Countable** (`pixel_metrics_valid`) | Distinct games | Interval-run | Verdict |
|---|---|---:|---:|---:|---:|---|
| `exterior_daylight` | 12 / 3 / 6 | 43 | **33** | **4** (W3, ER, Skyrim SE, RDR2) | **24 of 43 (56%)** | **PASS on all three** |
| `exterior_lowlight` | 12 / 3 / 6 | 24 | **8** | **4** | 0 | **count FAIL (8/12), games PASS, anti-curation FAIL** |
| `interior_darkemissive` | 10 / 2 / 5 | 22 | **3** | **4** | 0 | **count FAIL (3/10), games PASS, anti-curation FAIL** |
| `character_closeup` | 10 / 2 / 6 | 13 | **7** | **3** | exempt | **count FAIL (7/10); ≥½ rear-view rule FAIL** |
| `combat` | 8 / 2 / 4 | 12 | **8** | **4** | exempt | **PASS** |
| `material_closeup` | 8 / 2 / 6 | 9 | **5** | **3** | exempt | **count FAIL (5/8), games PASS** |
| `modern/ui` (`REF-M22`, A2) | ≥2 games | 8 | n/a | **3** (W3, ER, Skyrim SE) | n/a | **PASS** |
| `modern/hud` | dissolved by A1 | **0** | — | — | — | **emptied; folder dissolved** |

**Before: 1 of 6 profiles had ≥2 games and 3 of 6 had a countable file at all. After: 6 of 6 have
≥3 games, 6 of 6 have countable files, and `exterior_daylight` and `combat` meet every clause of
§3. That is the shape of the change; the counts below are the honest residue.**

**The binding constraint is no longer coverage. It is `block_score`.** `pixel_metrics_valid` is
now set by a computed post-pass against §8a's thresholds, not typed. 199 files across the set
carry `heavily_recompressed: true` because their **computed** `block_score` exceeds 1.15 — 19 of
22 in `interior_darkemissive`, 16 of 24 in `exterior_lowlight`. §8a's own escape clause ("unless
nothing better exists for that slot, in which case keep it and set `heavily_recompressed: true`")
was taken, so they are retained for composition and design-language use and **excluded from every
floor**. The cause is structural: **Steam re-encodes user screenshot uploads**, and Steam is the
only source with the breadth these profiles need. Downloading more Steam frames will not fix
`interior_darkemissive`; a different *kind* of source will — a lossless or high-bitrate capture
series, a press kit, or a Digital Foundry frame dump.

### `refs/souls-behaviour/` (amendment A5 + critic findings F3/F4)

| Subfolder | Files | Games | Serves |
|---|---:|---|---|
| `camera/` | 12 | DS3 | `RI-CAM01`, `RI-CAM03`, `RI-CAM07` |
| `attacks/` | 12 | DS3 | `RI-WPN01`–`RI-WPN04` |
| `telegraph/` | 10 | DS3, DSR | `RI-AI02`, `RI-AI06` |
| `stance/` | 18 | DS3 | `RI-CAM07`, `RI-WPN06` |
| `impact/` | 5 | DS3 | `RI-WPN05`, `RI-AUD01` |
| `ui-combat/` | 12 | DS3 | `RI-UIX01`, `RI-UIX03`, `RI-UIX06` |
| `arena/` **(new, F3)** | 14 | DS3 | `RI-AI06`, `RI-JRN06`, `RI-WLD07` |
| `death/` **(new, F4)** | 10 | DS3 | `RI-JRN06`, `RI-PRG04` |

Every record carries `side: "souls-behaviour"`, `pixel_metrics_valid: false`, and
`forbidden_for: ["fidelity-bands", "art-direction-judgement"]` per A5 rule 2.

### `refs/morrowind/`

| Slot | Full-frame added | Crops retained (superseded) | Total |
|---|---:|---:|---:|
| A1 A2 A4 A5 A6 A7 A8 A9 A10 A11 A13 A14 A15 A16 A17 A18 A19 | 57 | 84 | 141 |
| `REF-A12` (OpenMW MyGUI XML, no image) | — | — | 38 files |
| **`REF-A12b`** (A2, Morrowind UI as rendered) | **33** | — | 33 |
| **`REF-A20`** (A2, title/main-menu art) | **4** | — | 4 |
| `REF-A3` | 0 | 5 | 5 |

`REF-A12b` sub-kind coverage: inventory 3, menu-mode multi-window 8, dialogue/topic list 5,
journal 3, map 4, character sheet 4, book reader 4, barter 3, level up 2, tooltip 2,
character creation 1. **Eight of the eight sub-kinds A2 names are filled; spellmaking is not
(see 15.6).**

### Other

| Folder | Floor | Files | Verdict |
|---|---|---:|---|
| `anti-generic/` | 4–6 | 5 | PASS (unchanged) |
| `context/` | **12–16 (A6)** | **23** | **PASS** |
| `video/` | V1+V2 required | 1 | **FAIL on V1 and V2 — see 15.6** |
| `rejected/` | n/a | **14** | 6 added this round: 3 painted loading artworks (§8d) and 3 `corroboration: unknown` (§8b — this closes critique defect **H5**) |

## 15.3 The free win, and what it was actually worth

24 Witcher 3 interval-run frames were released from `modern/hud/` into their profile folder under
A1. **They are all `exterior_daylight`.** Every one of the 24 was eyeballed on a contact sheet:
all are sun-up exteriors with blue sky and cumulus; none is dawn, dusk, night or overcast. The
critic's expectation that G07 would supply both exterior profiles was wrong, and
`exterior_lowlight` still has **zero** interval-run frames.

Their `integrity_flag` — `exif_software = "ACDSee Ultimate 8"`, a batch image editor — is
**preserved verbatim** on the promoted records and is a live risk: §8a says an editor in
`exif_software` is a rejection. The counter-evidence recorded by the original acquirer (6.7–9.2
bytes/pixel, `jpeg_quality_est` 100, `block_score` negative, `nyq_ratio` 0.05–0.17) says the
pixels were not degraded. **A critic may legitimately reverse this promotion.** It is flagged
rather than buried.

The other four `modern/hud/` files were not fidelity references at all: one Elden Ring **title
screen** (moved to `modern/ui/`, serves `RI-UIX06` F17/F19) and three **painted loading-screen
artworks** (moved to `rejected/` — §8d, "not an in-game render").

## 15.4 Finding F1 — the Morrowind crops — is closed, not deleted

57 full-frame native captures were acquired from Steam app 22320 across 17 `REF-A` slots,
prioritising the six slots the crop destroyed: **A1 (vista) 4, A8 (settlement layout) 2, A13
(armour) 5, A14 (weapons) 4, A15 (signage) 2, A19 (stilted settlement) 6.** All 84 pre-existing
320×320 AVIF crops in those slots are retained and now carry `superseded_by` naming the
full-frame files, plus `superseded_reason`. No evidence was deleted.

**The vanilla triage is the hard part of this job and is reported honestly.** Steam's top-rated
Morrowind gallery is dominated by MGE XE and OpenMW distant land. The filter applied was:
(a) native width ≤ 1366 (V7), then (b) eyes on every surviving frame for V1 grass, V2 a crisp
horizon behind the fog wall, V3 cast shadows, V4 world reflections in water, V6 bloom/DoF.
**Roughly four in five top-rated Morrowind screenshots at ≥1920 wide fail V2.** 576 candidates
were harvested; 234 survived the resolution filter; 57 survived the eye. The single most reliable
discriminator is the vanilla fog wall closing the middle distance.

**A stated deviation on §7.** For `REF-A12b` menu captures taken in interiors, V1 (no grass),
V2 (no distant land) and V4 (water not mirroring) are **not evaluable** — an interior contains no
terrain, no horizon and no water. Those are recorded as `null` with `vanilla_tests_note` saying
so, rather than as "unknown", and the files are filed in the slot rather than in `unconfirmed/`.
Reading §7 literally would have emptied the slot A2 calls the highest-value art-direction
acquisition left. **This is a judgement a critic may overturn; it is not silent.**

## 15.5 Two mechanics worth more than the images

**1. `_provenance.json` was structurally unjoinable, and that is the root cause of H2/H3.**
68 records were keyed by a **bare id** — slot ids (`REF-A1`…`REF-A19`), series ids
(`run-w3nextgen-*`), and per-image ids (`REF-ER-*`) — while `make-manifest.py` joins provenance
to computed statistics **by path**. 140 files on disk were therefore producing
`PROVENANCE_MISSING` in `MANIFEST.json` no matter how carefully their provenance had been
written. Each id-keyed record has been copied down to its file's path key with
`provenance_inherited_from`; the id-keyed records are retained unchanged. `MANIFEST.json` now
reports **0** records with `PROVENANCE_MISSING`.

**2. Steam `publishedfileid` is monotonic in time, which makes §8b's `pre-2023-page` cheap.**
45 detail pages were fetched directly and their **visible** posted dates read; the (sid, date)
pairs are strictly monotonic with **zero violations** across Feb 2014 → Mar 2024. So
`sid < ~2,900,000,000` is pre-2023 (anchors: `2888289483` = Nov 13 2022, `2904212472` = 2023+).
This was used as the **primary triage filter on every bucket**, which is why most of what landed
this round satisfies §8b by a date actually printed on a page rather than by assertion.

Two further Steam mechanics, learned the hard way and recorded so nobody repeats them:

- `/sharedfiles/filedetails/` 429s after ~19 requests in a burst, is **still throttled at one
  request per 4 s**, and sustains at one per 14 s. `ISteamRemoteStorage/GetPublishedFileDetails`
  returns `result: 9` for screenshots — it is the wrong content type and does **not** work.
- In an apphub listing card the id is in `data-publishedfileid="N"` and the page URL is in
  `data-modal-content-url`, **not** in a plain `href` preceding the `<img>`. A regex that expects
  href-then-image returns zero rows against a page that is otherwise fine.

## 15.6 What could not be obtained, and why

| Gap | Class (A3) | Reason, and the specific next step |
|---|---|---|
| **`video/V1-dolly` and `V2-static`** (both *required*) | **BLOCKING** | **YouTube is closed to this container.** `yt-dlp` search works, but every download returns *"Sign in to confirm you're not a bot"* on `web`, `web_safari`, `android_vr` and `ios`, and *"DRM protected"* on `tv`; `mweb` returns a player response listing **only storyboard formats**. archive.org **is** open and was used instead, but its current-gen holdings are unusable at size: the RDR2 100% longplay is **82 GB with no derivative**. Next step: archive.org items with an `.ia.mp4` derivative for a current-gen open-world title; a Digital Foundry mirror on a non-YouTube host; or a cookie jar for YouTube. |
| `video/V3-locomotion`, `V4-combat` | **partly filled** | `PC_Longplay_Dark_Souls_Remastered.ia.mp4` (3.3 GB, 9.2 h, h.264) — uncut by construction, so it contains continuous third-person locomotion and continuous melee. Filed once under `V4-combat`, `serves: [V4, V3]`. It is a 2011/2018 renderer and therefore **cannot** serve V1's LOD-pop measurement. |
| `material_closeup` 9 files / **5 countable** of 8, 3 games | **SUBSTITUTABLE → still short on count** | The 42-candidate bucket is mostly landscape: people do not photograph surfaces. A follow-up harvest on app 1174180 (`texture`, `close up`, `bark`, `mud`) added 3 genuine RDR2 surface studies and a third game; `searchText=texture` on 292030 returned **zero cards**. Nine frames are genuinely one-surface-filling-the-frame, five of them survive §8a. Padding to 8 with vistas would make the count table lie. Next step: press kits and Nexus "vanilla texture comparison" shots — a source that is not Steam-recompressed. |
| `character_closeup` count 7/10 and the ≥½ rear-view rule (`REF-M6`) | **BLOCKING** | 13 files, 7 countable, 1 confirmed three-quarter-rear. The pre-2023 half of the 54-candidate bucket contains almost no back views — the anti-curation problem `RI-CAM07` §B names: **nobody photographs the surface the player looks at all day.** Next step: the 24 relocated Witcher 3 frames are all rear-view Geralt and could be **cross-filed** rather than re-downloaded. |
| `exterior_lowlight` (8/12) and `interior_darkemissive` (3/10) **countable** floors | **BLOCKING, and the reason changed** | Both folders are well over their floors on *files* (24 and 22) and over on *games* (4 each). They fail on `pixel_metrics_valid`, which is now computed: 16 of 24 and 19 of 22 exceed §8a's `block_score` 1.15. **This is a source-quality problem, not a coverage problem, and more Steam downloads cannot fix it.** Next step: a non-Steam source — a press kit, a lossless capture series, or a Digital Foundry frame dump. |
| `exterior_lowlight` / `interior_darkemissive` interval-run half | **BLOCKING** | No unbiased native screenshot **series** at dusk or in a cave has been found. §3 needs one continuous series per folder, not more selected frames. Next step: a single Steam user's screenshot showcase filtered by app, or an imgur album from one session. |
| Morrowind **spellmaking** UI | **SUBSTITUTABLE** | `searchText=spellmaking` on app 22320 returns **0** (critic-confirmed, re-confirmed). Substituted by the magic/powers window, which is present in 4 of the 8 multi-window `REF-A12b` frames, recorded as `ui_subkind: inventory` with the magic list named in `identified_by`. |
| Morrowind `REF-A3` (Telvanni) full-frame | **BLOCKING** | The only slot with no full-frame re-acquisition; the `telvanni`/`sadrith mora` queries returned MGE-modded frames almost exclusively. Next step: `searchText=tel vos`, `tel branora`, `mushroom tower` at ≤1366 width. |
| ESO **xanmeer ziggurat** specifically | **SUBSTITUTABLE** | Steam app 306130's listing returned **zero cards for every query today**, including the ones the prior critic used successfully; only the 30 pre-harvested candidates were available. Two Murkmire ruin frames (`2231233681`, `1554702013`) and one settlement frame with a stepped mass on the skyline (`2424349086`) are filed as `subject_kind: xanmeer_ruin`. Next step: ESO's own media pages, or the ESO wiki. |
| Frame-exact hitstop calibration (`RI-WPN05`) | **IMPOSSIBLE — accepted in writing** | No published artifact gives absolute frame counts. `souls-behaviour/impact/` bounds the *appearance* of a connecting hit only; its records say so in `deviation`. The dependent bar must be stated as ordering (dagger < ultra greatsword), not as absolute frames. |
| `REF-M19` within-frame near/far water; §5a foreground/sky | **INFERABLE** | Unexpressible as a search (critic F9). Every file committed this round carries explicit `foreground_present` and `sky_visible` booleans set by eye, so the population can now be **filtered** for the constraint instead of searched for it. |

## 15.7 Corroboration honesty

**Final state across all 488 manifest records:** `pre-2023-page` **271**, `first-party` 38,
`one-host` **168**, `unknown` 3 (all three now in `rejected/`), unset 8 (pre-existing
`rejected/` files). Of the Steam-sourced records this round resolved: **95 direct** (the file's
own page was fetched and its printed date read), **145 bracketed**, **36 unresolved**. Every
record carries `corroboration_basis` naming which route was used and, for bracketed ones, the two
anchor sids and their printed dates, so any of it can be re-checked without trusting this report.


Records written this round carry `corroboration: "pre-2023-page"` **only** where a Steam detail
page was fetched and its printed date read, or where the sid falls strictly between two such
directly-read pages (recorded reasoning, monotonicity verified on 45 anchors, 0 violations).
Everything else is `"one-host"`, which **satisfies none of §8b's three tests**. Those files are
kept rather than moved to `rejected/`, and this is a **stated deviation**: they are Steam apphub
uploads carrying a numeric community rating and an uploader profile, and every one of them is on
an axis whose records are `pixel_metrics_valid: false`. A critic may reverse it. The buckets where
pre-2023 candidates simply do not exist in the delivered pools are, for the record:
`souls_death` 2/60, `souls_creature_design` 6/79, `material_closeup` 6/42, `combat` 7/41,
`morrowind_REF-A20` 1/6.

## 15.8 One search the critics did not run, and it mattered

`searchText=you died` returns images **titled** "you died" and almost never the YOU DIED card —
title matching, not image matching, exactly as the critic warned. The query that actually answers
`RI-JRN06` is **`searchText=bloodstain` on app 374320**, which was in neither candidate pool. It
returns real bloodstain pools at real distances, including one seen from a long way off against
open sky (`1084578862`) and one with the *"Touch Bloodstain"* prompt drawn (`2296027105`). Eight
of the ten files in `souls-behaviour/death/` come from it.

## 15.9 Corpus amendments this round requires

1. **A5 gains `arena/` and `death/`** — built, per critic findings F3 and F4. Filed here rather
   than proceeded on informally.
2. **§5e gains a framing floor** — *full frame, native aspect, uncropped* for `refs/morrowind/`.
   Its absence caused F1. The 57 new files were acquired to that rule; nothing in §5e states it.
3. **§7 needs a three-valued vanilla test** — `true` / `false` / `null = not evaluable in this
   frame`. See 15.4.
4. **§8b needs a fourth corroboration category or an explicit ruling** on dated Steam apphub
   uploads from 2023 onward. See 15.7.
5. **`RI-VIS07`'s naming test gains "ESO" as a forbidden answer** (A6). Recorded on all 23
   `context/` records via `admissibility_note`.

---

# §16 — Revision 6: size correction and amendment A7 (agent `ref-builder-r1`, same session)

Two coordinator directives, addressed in order.

## 16.1 The 3.17 GB video is gone, and there is now a size guard

`video/V4-combat__archive-pc-longplay-dark-souls-remastered.ia.mp4` (3,327,402,442 bytes) was
**deleted**. It was never committed. `refs/` went from 3.4 GB to **279 MB**.

It has been **replaced, not abandoned**, three ways:

1. **The source is catalogued, not downloaded.** `_provenance.json` holds
   `video/CATALOGUED-NOT-DOWNLOADED--V4-combat--archive-dark-souls-remastered-longplay` with the
   URL, the exact byte length, and the **sha256 of the whole 3.17 GB file, which was verified on
   2026-08-06 before deletion** — the file was downloaded in full, `acquire.py --check` passed on
   it, and then it was removed. A recorded, reproducible, hash-pinned source costs nothing and is
   worth nearly as much as the bytes.
2. **Two short clips were cut from it and kept**, both far inside budget:

   | File | Slot | Duration | Size | Contains |
   |---|---|---:|---:|---|
   | `V4-combat__dsr-longplay-t13990.mp4` | V4-combat | 40 s | **3.95 MB** | continuous third-person melee, two-handed greatsword, no cuts |
   | `V3-locomotion__dsr-longplay-t11990.mp4` | V3-locomotion | 30 s | **2.36 MB** | third-person run along a cliff path from behind, stop, turn to an NPC, no cuts |

   `refs/video/` total: **6.1 MB** against the 250 MB cap.
3. **A size guard is now in the workflow and in the tooling.** `commit.py`'s video path asserts
   `<= 40 MB` per file before writing a provenance record, and every image committed this session
   is a Steam screenshot of 0.1–4 MB — the largest single image in `refs/` is 4.3 MB. Nothing else
   in the set is anywhere near the guard.

**How the clips were cut, stated plainly because it makes `modified_by_me` true.** The clips are
`ffmpeg -c copy` cuts: the H.264 bitstream inside the cut window is byte-identical to the
publisher's and **no frame was re-encoded, resized or filtered** — only the MP4 container was
rewritten. §5b says "do not re-encode, trim or convert"; the coordinator's size budget supersedes
the *trim* clause, and §5b's real purpose (never measure texture off a codec) is preserved by
`pixel_metrics_valid: false`, which every video record carries anyway. Every clip record spells
this out in `modified_by_me_explanation` and `cut_method`.

**The mechanic worth keeping.** The static ffmpeg in this container **segfaults on https input**
(exit 139, proxy/TLS), and YouTube is bot-gated, so neither `yt-dlp --download-sections` nor
`ffmpeg -i <url>` works here. What does work: build a **sparse local file** the same length as the
remote one, fill byte range `[0, moov_end)` — the index, at the front in a faststart MP4 — plus a
window around the wanted timestamp via `curl -r`, and run ffmpeg against the sparse file. The
3.17 GB source was read for two clips having stored **under 150 MB**, and the holes cost no disk
at all. `scratchpad/clip.py` implements it. archive.org 500s on bursts of range requests and needs
a patient retry.

**One honest limitation on the clips.** The uploader plays an unarmoured low-equip-load build:
the character wears only the game's default undergarment for the whole longplay. That is the
playthrough, not a mod. **V3's foot planting, stride and turn blending are fully readable; cloth
and armour secondary motion are not in this clip and must not be judged from it.** Recorded on
both records as `player_character_note`.

**V1-dolly and V2-static are still unfilled**, and the reason is unchanged from §15.6: YouTube is
closed to this container and archive.org's current-generation holdings are either 82 GB with no
derivative (the RDR2 longplay) or edited "game movies" with cuts, which is precisely what V1
cannot use — *"a cut is indistinguishable from a pop, so a montage is worthless here."*

**Tested and ruled out this round, so nobody repeats it:**
`archive.org/details/elden-ring-game-movie-720p-60-fps-bazitube` — 1.8 GB, 98 min, 1280x720,
with an `.ia.mp4` derivative, so it is *reachable* and *cuttable* by the sparse-file method above.
Eight frames were sampled across it at 10-minute intervals: **every one is a boss fight or a
cutscene.** It is a montage, it is 720p, and the HUD is large in frame. It cannot serve V1 or V2.
The specific next step for V1/V2 remains: an archive.org item with an `.ia.mp4` derivative that is
an **unedited** current-generation open-world capture, a Digital Foundry mirror on a non-YouTube
host, or a cookie jar for YouTube.

## 16.2 Amendment A7 — geographical variation, all three scales

Slotted above `context/` and above the remaining `modern/` filling, as directed. It shares the
Morrowind searches already running, so it was cheap.

### A21 — inter-region dispersion. **All nine regions met, none below the floor of 4.**

| Region | Files | Region attribution |
|---|---:|---|
| Ascadian Isles | **12** | gallery-tag + Pelagiad/Suran landmarks |
| Ashlands | **10** | gallery-tag + Ghostfence landmark |
| Bitter Coast | **9** | gallery-tag + Seyda Neen/Hla Oad landmarks |
| West Gash | **7** | gallery-tag + Balmora landmark |
| Sheogorad | **6** | gallery-tag + Dagon Fel landmark |
| Azura's Coast | **5** | gallery-tag + Sadrith Mora landmark |
| Red Mountain approach | **5** | gallery-tag + caldera landmark |
| Grazelands | **4** | gallery-tag |
| Molag Amur | **4** | gallery-tag + Dunmer stronghold landmark |

**Region attribution is evidence, not vibe**, and every record says which kind it has in
`region_basis`: `map-inset` (the frame contains Morrowind's own local-map window naming the
region — the strongest evidence there is, and it needs no interpretation), `landmark` (a named
unmistakable structure fixes it), or `gallery-tag` (the uploader's own region name in the search
that returned it, confirmed by eye against the region's palette and landforms). Nothing was
attributed on appearance alone.

**The A7 sets are defined by a FIELD, not by a folder.** 41 new files are in
`morrowind/REF-A21-regions/`; a further 17 files already committed to `REF-A1`, `REF-A5`,
`REF-A8`, `REF-A9`, `REF-A11` and `REF-A19` are regional exteriors of exactly the kind A21 needs,
and copying their bytes into a second directory would duplicate them for nothing. They carry
`a21_member: true` plus `region` and `region_basis`. **The region set is every record with
`a21_member: true`.** Any tool computing the dispersion must select on the field.

### A22 — intra-region variance. **Both regions met.**

Ascadian Isles **9**, Bitter Coast **6** (A7 asks 6–8 each). Marked `a22_intraregion: true`.
Ascadian's nine span Pelagiad's Imperial half-timbering, Suran's Hlaalu arcades, open mushroom-tree
country and a misty road — genuinely different places inside one region, which is what bounds the
band from above as well as below.

### A23 — micro scale. **All nine regions have at least one.** 11 files.

**A stated deviation, and it is the interesting one.** A7 asks for *downward-facing* shots.
Strictly top-down player screenshots of Morrowind are close to nonexistent — **nobody photographs
the floor**, which is the same anti-curation bias §3 exists to defeat, showing up at a different
scale. What was acquired instead are **near-ground frames in which the terrain surface occupies
the majority of the frame and no skyline or architecture carries the distinction** — which is the
property A7 actually needs, since the whole point is that the region must be distinguishable
*without* the skyline. Recorded as `deviation` on every A23 record. One of them (`435016417`,
Azura's Coast) carries Morrowind's own local-map inset naming the region, which is as good as
region attribution gets.

### The bias caveat, carried on every A7 record

A7's own honest caveat is recorded as `sampling_bias_note` on all 59 A7 records, not just in this
report: the population is skewed toward the picturesque, so any dispersion computed from it is an
**estimate from a biased sample, not a census** — and the bias runs *against* us, since a
picturesque-skewed sample shows more dispersion than the real game, making the floor harder rather
than easier. Statistics derived from it must be recorded as `derived` with that stated.

### What A7 also fixed for free

`REF-A3` (Telvanni) was the one slot §15.6 reported with no full-frame re-acquisition. The
Sadrith Mora frames acquired for Azura's Coast are grown Telvanni mushroom towers at full frame,
so the gap is closed as a side effect of the region search.

---

# §17 — Revision 7: reference builder, round 2 (agent `ref-builder-r2`, 2026-08-06)

Round 2 was spent almost entirely on **instruments, not acquisition**, because that is where
`ACQUISITION-CRITIQUE-R2.md` put the value: four of its top six work items cost zero bytes of
bandwidth. Two catalogue numbers that the whole project was quoting were wrong, and one
"IMPOSSIBLE" was an instrument claim that turned out to be false.

**Two of the critic's findings were already stale when it wrote them** and were verified against
disk before any work was done, rather than redone:

- **A7 is delivered.** `REF-A21-regions` 39, `REF-A22-intraregion` 6, `REF-A23-ground` 11, all
  nine Vvardenfell regions above the floor of four. **The A7 sets are defined by the
  `a21_member` field, not by the folder** — 24 qualifying files sit in `REF-A1`, `REF-A5`,
  `REF-A8`, `REF-A9`, `REF-A11`, `REF-A19`, `REF-A22` and `REF-A23`. Any dispersion tool that
  selects on the directory will miss them and skew every centroid. This is now written into
  amendment A10 so it cannot be lost again.
- **`video/` is not empty.** Two clips were cut from the archive.org longplay, and the concurrent
  temporal agent has since added more; the 3.17 GB source is catalogued with a verified sha256
  rather than vendored.

## 17.1 `block_score` — the diagnosis was wrong and the fix is four lines

Round 1 said the two dark profiles were blocked by Steam re-encoding, and round 2 was about to be
spent chasing lossless sources. **The critic refuted that and it was right to.** `jpeg_quality_est`
has a median of **100.0 in every Steam folder**; the files are not re-encoded. `block_score` is a
ratio whose *denominator is the scene's own detail*, so it rises as a picture darkens for
identical encoder damage — and `interior_darkemissive` is the profile *defined by* darkness.

Reproduced independently before changing anything, one image, one encoder, q=95 fixed, only
brightness varied:

| | | | | |
|---|---:|---:|---:|---:|
| `mean_luminance` | 105.1 | 52.3 | 31.1 | 18.4 |
| `block_score` | 1.031 | 1.101 | 1.192 | **1.308** |
| `(block_score − 1) × L` | 3.22 | 5.28 | 5.95 | 5.66 |

The excess above 1 is inversely proportional to luminance, so **`block_score_rel = 1 +
(block_score − 1) × (mean_luminance / 128)`** divides the confound out. Same four treatments:
**1.025 / 1.041 / 1.047 / 1.044** — spread 0.019 against 0.277, a **15× reduction**. Controls:
a lossless PNG of the same frame at the same four exposures scores 0.989–1.000, so the null stays
exposure-independent; and a quality sweep still discriminates at both exposures, with the bright
and dark curves now agreeing instead of diverging by 0.6. Full statement and the proposed §8a
replacement text: **amendment A9**. `block_score` itself is unchanged and still recorded, so
nothing earlier is silently rewritten.

**And fixing the metric was not enough**, which is the part worth reading. `pixel_metrics_valid`
had been *typed into provenance from the old gate*, so correcting `make-manifest.py` changed no
count at all until the verdicts were re-derived. Re-deriving them surfaced a second bug of exactly
the same shape: **§8a's `upscale_test < 0.004` clause is confounded with exposure too** — same
image, same encoder, darkened, and `upscale_test` runs 0.010409 → 0.005330 → 0.003262 → 0.002013,
failing the gate twice for no reason but brightness (**amendment A19**). Four of nine
`material_closeup` and six of thirteen `character_closeup` records cited *both* clauses, so fixing
either alone would have released neither.

**61 records re-scored; 51 flipped `false` → `true`; none flipped the other way.** The old
`pixel_metrics_reason` is preserved verbatim on every record as
`pixel_metrics_reason_superseded`, and the raw statistics are untouched.

| profile | floor | countable **before** | countable **after** | verdict |
|---|---:|---:|---:|---|
| `exterior_lowlight` | 12 | **8** | **20** | count FAIL → **PASS** |
| `interior_darkemissive` | 10 | **3** | **21** | count FAIL → **PASS** |
| `character_closeup` | 10 | 7 | **13** | count FAIL → **PASS** |
| `material_closeup` | 8 | 5 | **9** | count FAIL → **PASS** |
| `combat` | 8 | 8 | 11 | PASS → PASS |
| `exterior_daylight` | 12 | 33 | 39 | PASS → PASS |
| **`fidelity-bands` population** | — | **69** | **120** | |

**Every §3 count floor on the modern side is now met, and not one byte was downloaded to do it.**
The critic's estimate was 8 → ~18 and 3 → ~14; the measured result is 8 → 20 and 3 → 21, because
A19 released the second clause it had not seen.

## 17.2 `metrics_valid_for` — one flag was answering two questions

`pixel_metrics_valid` conflated *"may this set a `[p10,p90]` fidelity band?"* with *"may this be
measured for art direction?"* A7's dispersion is an art-direction measurement over files that are
**all** `pixel_metrics_valid: false`, so its input set was either empty or the entire corpus,
with 199 `heavily_recompressed` files unfiltered and no flag to filter on. Two of A7's six metric
components — edge density and colour entropy — are exactly what blocking corrupts.

Each record now carries a **computed** `metrics_valid_for` list with six values —
`fidelity-bands`, `art-direction`, `dispersion`, `ui-fidelity`, `behaviour`,
`subject-reference` — each with its own gate, derived at join time so it cannot be hand-edited.
Every measurement in the project now has a defined population, and the two validities can carry
different encode thresholds (fidelity 1.15, dispersion 1.30) instead of sharing one. **Amendment
A10.**

## 17.3 The folder constants

**`has_hud` was typed once per folder in three folders and is now an observation.** Contact
sheets of the top-left 42%×17% of all 93 souls stills, reviewed by eye:

| | count |
|---|---:|
| combat HUD bar stack present | **56** |
| menu screen (title, options, equipment, storage ×2, inventory ×2, status) | **9** |
| no UI of any kind | **28** |

So **`has_hud` goes `true` → `false` on 70 files** — 37 souls stills plus all 33 `REF-A12b`
menu-mode captures, where Morrowind replaces the HUD with the menu windows. This corroborates
critic **F14** (it measured 29 with zero HUD pixels; the eye finds 28 with no UI at all) and
**F19** (`ui-combat/` is 11 of 12 non-combat, not 8 of 12). `RI-UIX01`'s real population is
**56 across the axis, 1 of the 12 files in the folder named for it** — not 93.

**A caution worth recording.** The critic's chroma detector — `max−min > 55`, `max > 70`,
fraction ≥ 0.012 in the top-left box — is calibrated on the DS3 bar stack and **does not
generalise**: a bonfire fills the box at 1.000 and a blue sky at 0.444, so its high end is scene
content, not HUD. It is computed and recorded as `hud_probe` for audit, but on this corpus the
eye is the instrument and the probe is the corroboration. Saying so is cheaper than being wrong
by 0.5 on 40 files.

**`side` and `game`.** `side` carried both `morrowind-art` and `morrowind-art-direction`, so every
per-side query silently returned one or the other; 146 records normalised. `game` carried three
strings for Morrowind, making a naive distinct-games count report 3 for a one-game side; 493
records normalised, and a `game_canonical` slug is now on 865 records so a machine query cannot
be fooled by casing. The one qualifier that carried real information — "interface as reproduced
by OpenMW" — moved to its own `interface_source` field rather than being deleted.

**`REF-M*` slots.** 20 records assigned a real slot by reading each record's `depicts` against
§5a's slot description, 3 recorded as `substituted_for` where the slot's exact game-and-place was
unobtainable but the measurement is served, and **the six genuinely unfilled slots are now listed
by name** in the `_UNFILLED-REF-M-SLOTS` register with the reason each is empty: **`REF-M1`**
(ER Liurnia at dusk), **`REF-M2`** (ER forest interior), **`REF-M7`** (Skyrim LOD vista),
**`REF-M9`** (W3 Crookback Bog), **`REF-M10`** (Skyrim Hjaalmarch — the slot closest to our own
subject and the one whose absence costs most), **`REF-M11`** (ER Swamp of Aeonia).

## 17.4 The ghost record, and what `--check` now means

`_local: true` was doing three jobs at once: *on disk but not re-fetchable verbatim*,
*catalogued but deliberately not vendored*, and *documentation-only id record*. That is why the
pass count could not distinguish a file that is present and verifying from one that was never
downloaded. Every record now carries an explicit **`acquisition_state`**:
`vendored-verifying` | `vendored-local-derived` | `catalogued-not-vendored` |
`unfilled-slot-register`. `MANIFEST.json` lists `catalogued_not_vendored` records in a **separate
top-level array from `records`**, so they cannot be counted as coverage, and the manifest's
`counts` block reports `countable_media` (files on disk minus superseded crops) beside
`files_on_disk` with a note saying which one may be quoted.

## 17.5 `souls-behaviour/anim/` — the temporal axis exists, and it is finer than the bar asked for

Built by **moving**, never copying and never re-encoding, every animated sequence out of the
stills folders into `souls-behaviour/anim/{ds1-boss-moves, attacks, telegraph, impact, stance,
death, arena}/`. Bytes are untouched, every `expected_sha256` is unchanged, and
`acquire.py --check` passes on all of them.

| | |
|---|---:|
| animated sequences | **208** |
| carrying both `frame_count` and `duration_s` | **207** |
| **named-move sequences with frame metadata** | **177** |
| distinct named moves | **129** |
| decoded frames | **19,735** |
| games | Dark Souls 183, Elden Ring 18, Dark Souls III 7 |

**The temporal resolution is better than the critic's estimate, and the reason matters.** The
critic derived ±70 ms from the API's total duration, because Fandom's WebP transcode strips
per-frame delays. The temporal agent found `?format=original`, which serves the **original GIF
bytes with delays intact** — so the measured `temporal_resolution_ms` is a **median of 40.0 ms**
(170 of 200 at exactly 40 ms = 25 fps), min 30, max 100. `RI-WPN01`–`04`'s windup / active /
recovery fractions are measurable at ±40 ms, not ±70 ms.

## 17.6 The three IMPOSSIBLE items, written down with the bar lowered

This is the step rounds 1 and 2 both skipped. Full replacement text is in **`ACQUISITION-SPEC-AMENDMENTS.md`
Part 2, A12–A14**; no reference item owned by another agent was edited.

| # | Accepted IMPOSSIBLE | The bar it replaces |
|---|---|---|
| **A12** | Cell-by-cell validation of `RI-WPN05` §A's 5×7 hitstop grid against real footage. Nothing published states a hitstop figure for any FromSoftware title, and filling 35 cells needs a controlled capture in a game we do not own | **Ordering at ±40 ms** from the per-move GIFs, **a ±16.7 ms spot check** from `video/`, and existence-and-asymmetry as `canonical-recall`. §A stays `constructed`; **no critic may score it as failing for want of a reference**, and it becomes `derived` only if a wave measures ≥3 cells of one tier row at ≤16.7 ms |
| **A13** | `REF-A12` as images. OpenMW's MyGUI layout data is a *different artifact*, not a degraded one | The image expectation is **deleted, not failed**. `REF-A12` is a complete text asset; every pixel-level UI question moves to `REF-A12b` (33 files, 11 sub-kinds, 8 resolutions). MyGUI's constants are corroboration, never ground truth |
| **A14** | **Absolute** LOD-pop amplitude for `RI-VIS03` **M11**. A dolly capture now exists (288 s of Elden Ring Liurnia at 60 fps, plus 436 s on deliberately low-end hardware) but both are 854×480 at ~700 kbps, which puts a small geometric event inside the codec noise floor | M11 **splits**. Detection and ordering are **scored normally** against the constrained-hardware reference. Amplitude becomes **`derived`, confidence low, and a regression bar** — our build against our previous build, never reported as reference-calibrated. The static half (far plane, M4 fog cross-check) is unaffected. Named unrun search: a free `gamersyde.com` account for the JS-injected native-resolution MP4 URLs |

**A14 was rewritten before it was filed, and the reason is worth recording.** Its first draft
accepted M11 as fully IMPOSSIBLE because `video/` held no dolly capture. That was true when the
draft was written and **false four minutes later** — the concurrent temporal agent landed
`V1-dolly__elden-ring-liurnia.mp4` mid-write. It was caught by re-running `ffprobe` over `video/`
before committing rather than by trusting the sentence. A stale IMPOSSIBLE is exactly the failure
A3 exists to prevent, and a builder can write one as easily as a critic can.

**A12's IMPOSSIBLE is narrower than the critic's.** It said frame-exact calibration is impossible
because the instrument tops out at 70 ms. That is false: `video/V4-combat__dsr-longplay-t13990.mp4`
is `r_frame_rate 2997/50` = **59.94 fps**, 2,404 frames over 40.07 s, and motion-bracketed freeze
detection over it (a high-motion frame → a run of near-zero inter-frame difference → motion
resuming) does run and does return events. **The instrument resolves one 60 Hz frame.** What fails
is *sample size* — a 40-second window contains 3 candidate events, and 35 tier×material cells need
a controlled capture. That is a real IMPOSSIBLE and it is a different one, so the bar it justifies
is different too.

## 17.7 The critic's rulings, applied

- **Ruling 1 — the ACDSee promotion: upheld, and the weight qualified.** Amendment **A15** adds
  the series-weighting rule (one interval-run series counts as one location, capped at
  `1/locations` of band mass for the content-sensitive bands only), recorded on all 24 records.
  **But eyes on all 24 correct the finding that motivated it.** F16 says the 24 are one location
  because all 24 share one `depicts` string. The *pixels* are one continuous session traversing
  **Novigrad → Oxenfurt → a lakeside village → White Orchard — six distinct locations in four
  named places.** The identical `depicts` was a catalogue artefact. The Novigrad overlap with
  `anti-generic/`'s negative anchor is real and covers roughly a third of the series, not all of
  it. Each record now carries its own `depicts_location`, so the weighting rule can be applied
  per location rather than to the series as a block.
- **Ruling 2 — three-valued vanilla tests: upheld, V8 added.** Amendment **A16** defines
  **V8 — UI chrome matches vanilla Morrowind** (bevel, panel fill, typeface), required on every
  `ui_overlay_kind: menu` capture, with `REF-A12`'s MyGUI anchors as corroboration and not ground
  truth. Flagged on all 33 `REF-A12b` records.
- **Ruling 3 — the `one-host` split: applied exactly as the critic scoped it.** The 24 Witcher 3
  frames are **re-labelled, not removed** — `github-mirror-stated-provenance`, because they are a
  GitHub mirror with a stated capture provenance and were never Steam. That leaves **12 genuinely
  weakly-corroborated band-setting records** (5 `combat`, 4 `material_closeup`, 2
  `interior_darkemissive`, 1 `REF-M6`) for a round-3 pass: read the printed Steam date, or drop
  `fidelity-bands` from their `metrics_valid_for` while keeping them for composition.
- **F17 / R2C-10, done by eye rather than in bulk, as instructed.** All 24 W3 frames reviewed:
  **20 are back or three-quarter-rear and are cross-filed to `REF-M6` by field**, 4 are not
  (`t0007` — the side profile the critic verified — plus three more). `REF-M6`'s effective
  population goes from 2 to 22. All 24 also gain a `subject_frame_fraction_band` of `0.40–0.70`,
  which is **the first time `REF-M6`'s 40–70% clause has been checked against any file** (R2C-18).
- **F19 / R2C-19**: the 9 menu screens in `ui-combat/` now carry `serves: [REF-M22, RI-UIX06]`
  and a note excluding them from `RI-UIX01`.
- **F24 / R2C-24, checked against the item rather than assumed:** `RI-VIS07` §B **already lists
  "Elden Ring" and "Dark Souls"** among its FAIL answers. The remaining work is to name **ESO**
  explicitly in that row (amendment A18), and that has been done on the corpus side — the
  `admissibility_note` `context/` carries is now on all 301 `souls-behaviour` records.

## 17.8 What round 3 should do, and what it should not

**Should:** the 12 weakly-corroborated band-setting records (A17); the lock-on reticle and
status-buildup search (R2C-08 — apps 374320/1245620, `searchText=lock on`, `bleed`, `frostbite`,
`scarlet rot`); `REF-A3` Telvanni full-frame (R2C-11); `context/` root tunnels and a real stepped
xanmeer via `elderscrolls.fandom.com/api.php` (R2C-20); read the in-frame clock and weather off
the 24 W3 frames into `capture_time_of_day` / `capture_weather` (R2C-21 — **not done this round**,
and it is a one-pass annotation, not an acquisition).

**Should not:** chase a lossless source for a whole profile (A9 makes it unnecessary — and
`deadendthrills.com` is art-directed photo mode, which is a real cost in an anti-curation
profile); search for a screenshot of a Morrowind window mid-drag (R2C-22, closed); re-test any
route in `TEMPORAL-ACQUISITION.md` or `ACQUISITION-CRITIQUE-R1-code.md`; and **do not quote
`files_on_disk` as a coverage number** — quote `countable_media` or a `metrics_valid_for` count,
both of which the manifest now computes for you.

## 17.9 Two instrument bugs found while fixing the first one

Recorded because both were invisible in the catalogue and obvious in the code, which is the
methodological point the critic closed with.

1. **The machine HUD label was silently overwriting the human one.** `make-manifest.py` joins
   computed fields *over* provenance, so the probe-derived `ui_overlay_kind` clobbered the
   eye-verified value on every record — the exact failure the `_computed` / `_provenance` split
   exists to prevent, arriving through a name collision. The computed field is renamed
   **`ui_overlay_kind_probe`** and the two now sit side by side, which is also the more useful
   arrangement: `ui_overlay_kind` (eye) reads combat-hud 61 / menu 42 / none 28, and
   `ui_overlay_kind_probe` (chroma detector) reads both 271 / edge-hud 124 / centre-ui 48 /
   none 158. **The disagreement between those two columns is the measure of how far the chroma
   detector can be trusted**, and it is now a queryable number rather than a warning in prose.
2. **Video was being recorded as a decode failure.** All 12 `.mp4` reference files carried
   `error: UnidentifiedImageError` in `_computed.json`, because Pillow was asked to open them.
   A reader could not distinguish a codec we skip on purpose from a file that is broken. Video
   is now a first-class non-image asset (`asset_kind: video`) with nulls for every pixel
   statistic — which is what A5 rule 3 and §5b already required. **`MANIFEST.json` now contains
   zero error records**, down from 12.
