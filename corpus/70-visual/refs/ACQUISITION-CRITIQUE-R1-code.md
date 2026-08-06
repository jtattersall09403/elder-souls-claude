# Acquisition critique — round 1

**Role:** CRITIC. **Round:** 1 of 3 (convergence rule, `ACQUISITION-SPEC-AMENDMENTS.md` §A3).
**Scope:** does the committed code, if run, acquire enough *breadth* that `RI-VIS03`'s twelve
metrics have a real population in every profile and `RI-VIS05`'s art direction is covered?

**Verdict: no, and not for the reason the brief assumed.** The headline problem is not that the 46
catalogued images are all Elden Ring — although they are. It is that **`acquire.py` has never run**,
that **31 of those 46 do not count toward any floor**, and that **the anti-curation rule in §3 is
violated in every folder it applies to, at 100%**. Three of the six modern folders are at or below
three countable images; one is at zero. Every number in the brief's "known coverage state" table is
optimistic by roughly a factor of three.

This critique hands over **472 verified live candidates** in
`ACQUISITION-CRITIQUE-R1-candidates.json`, spanning six games and every open gap. The builder should
not repeat the searches recorded in §5.

---

## 1. Per-profile coverage against the floors

Floors from `docs/REFERENCE-IMAGE-REQUEST.md` §3, as amended by A1/A2/A4.
**§3 counts only files with `"pixel_metrics_valid": true`.** That sentence is the one the current
catalogue fails hardest, so both columns are shown.

| Profile | Floor (imgs / games / locations) | Catalogued | **Countable** (`pmv:true`) | Distinct games (countable) | Interval-run share (§3 needs ≥½) | Verdict |
|---|---|---|---|---|---|---|
| `exterior_daylight` | 12 / 3 / 6 | 10 | **3** | **1** — Elden Ring | 0 of 10 (need ≥6) | **FAIL ×3** |
| `exterior_lowlight` | 12 / 3 / 6 | 11 | **3** | **1** — Elden Ring | 0 of 11 (need ≥6) | **FAIL ×3** |
| `interior_darkemissive` | 10 / 2 / 5 | 8 | **0** | **0** | 0 of 8 (need ≥5) | **FAIL — empty** |
| `character_closeup` | 10 / 2 / 6 | 12 | **8** | 2 — Elden Ring, RDR2 | exempt | **FAIL on count + composition** |
| `combat` | 8 / 2 / 4 | 2 | **2** | **1** — Elden Ring | exempt | **FAIL** |
| `material_closeup` | 8 / 2 / 6 | 0 | **0** | **0** | exempt | **FAIL — empty** |
| `modern/ui` (REF-M22, A2) | ≥2 games | 0 | 0 | 0 | n/a | **FAIL — empty** |
| `modern/hud` | — (A1 dissolves it) | 28 | 24 | 2 — W3, Elden Ring | 24 of 24 interval-run | **misfiled, see G06/G07** |
| `anti-generic/` | 4–6 | 5 | 5 | 1 — Witcher 3 | n/a | **PASS** |
| `context/` | 4 | 0 | — | — | n/a | **FAIL — empty** |
| `video/` | V1 + V2 required | 0 | n/a | — | n/a | **FAIL — empty** |
| `morrowind/REF-A1…A19` | 2–3, core 4–5 | 89 files over 19 slots | n/a | n/a | n/a | **PASS** except A12 |
| `morrowind/REF-A12` (core, 4–5) | 4–5 | 38 records, **all `asset_kind: ui-definition`** | **0 pixels** | n/a | n/a | **FAIL — no image at all** |
| `morrowind/REF-A12b` (A2) | 2–3 each of 8 sub-kinds | 0 | 0 | n/a | n/a | **FAIL — empty** |
| `morrowind/REF-A20` (A2) | — | 0 | 0 | n/a | n/a | **FAIL — empty** |

**Distinct games, whole modern set:** 3 appear anywhere (Elden Ring 46, Witcher 3 29, RDR2 1), but
per profile it is **1** everywhere except `character_closeup`, where it is 2. No profile except
`character_closeup` meets even the reduced A4 minimum of 2. No band can be calibrated today.

### Why the countable column collapses

Of Codex's 46: `pixel_metrics_valid` is **false on 31**, and `heavily_recompressed` is **true on 30**.
Steam re-encodes every upload, and Codex correctly recorded the damage rather than hiding it — that
is good work, but §3 is explicit that such files "may be retained for composition and design language
but does not count toward the number in this table". The catalogue therefore reads 46 and measures 15.

Three further arithmetic facts a builder needs before touching anything:

- **3 of the 46 carry `"corroboration": "unknown"`.** §8b: "An image satisfying none of the three
  goes in `rejected/`." They are not optional.
- **All 46 are `"sampling": "selected"`.** There is not one interval-run frame anywhere in
  `refs/modern/`. §3's anti-curation rule is the single most emphatic paragraph in the spec ("read
  this twice") and it is at zero compliance.
- **29 of the 46 are 3840×2160.** §4 warns that a 4K image downscaled to 1080p reads as
  supersampling; the inverse also matters — a 4K reference population sets M4/M5 edge-density bands
  that a 1080p renderer cannot reach. The builder should record resolution and let the metrics
  battery normalise, not silently mix.

---

## 2. The code does not run

This is prior to any image question and it is the reason nothing has been acquired.

```
$ python3 acquire.py --check
ValueError: _note: missing source_url
```

`load_records()` expects `_provenance.json` to be a flat dict keyed by destination path. The file is
`{"_note": "...", "files": [ ... 211 records ... ]}` — a **list**, and no record carries a
destination `path` field at all, despite `_note` claiming "Keyed by destination path." The integrity
mechanism itself (stream → verify length → verify SHA-256 → atomic rename, no decode) **is correct
and must be preserved exactly**; only `load_records()` and the record schema are wrong.

Second: **165 of 211 records have no `expected_bytes` / `expected_sha256`**, so even after the
loader is fixed, three quarters of the catalogue cannot be verified. Of those 165:

- **126 already exist on disk** (89 `morrowind/`, 5 `anti-generic/`, 24 `modern/hud/`, 8 `rejected/`).
  Their hashes are computable locally — `make-manifest.py` already walks every file and emits
  `bytes` and `sha256`. No network needed.
- **29 have a shell glob where a URL should be**:
  `https://raw.githubusercontent.com/elfhuo-github/sksebp-og.github.io/main/witcher3nextgen/witcher3%202022-12-17%20*.jpg`.
  `acquire.py` would refuse or 404 on every one. The glob must be expanded to 29 literal URLs.
- **6 have no `source_url` at all** (the `rejected/` stubs — acceptable, but they must be excluded
  from `load_records()` rather than crashing it).

Third: `--check` is currently honest only by accident — it cannot run. Once it runs it must **fail
loudly on a record with no hash** rather than skipping it, or the catalogue silently reports OK for
records it never verified.

---

## 3. Every gap, classified (A3)

| # | Gap | Class | Resolution |
|---|---|---|---|
| G01 | `acquire.py` cannot parse `_provenance.json` | **BLOCKING** | Code fix, §2 above. Not a search. |
| G02 | 165 records unverifiable (no hash); 29 glob URLs; 6 no URL | **BLOCKING** | Hash the 126 on-disk files locally; expand the 29 globs from the GitHub tree; exclude the 6 stubs. |
| G03 | `exterior_daylight` 3 countable of 12, 1 game | **BLOCKING** | Searches named in §4; **99 candidates handed over**, 4 games. |
| G04 | `exterior_lowlight` 3 of 12, 1 game | **BLOCKING** | **78 candidates**, 3 games. |
| G05 | `interior_darkemissive` 0 of 10 | **BLOCKING** | **36 candidates**, 3 games. |
| G06 | Anti-curation rule at 0% in the three folders that require ≥½ | **SUBSTITUTABLE** | The 24 Witcher 3 `interval-run` frames **already on disk** in `modern/hud/` are released into their profile folders by amendment A1. That alone satisfies the run half and supplies game 2. See G07. |
| G07 | Those 24 frames carry `exif_software = "ACDSee Ultimate 8"`, which §8a rejects outright | **SUBSTITUTABLE, with a written deviation** | Counter-evidence already measured and recorded: 6.7–9.2 bytes/pixel, `jpeg_quality_est` 100, negative `block_score` (no 8×8 blocking), `nyq_ratio` 0.05–0.17 (not downscaled). The editor touched the container, not the pixels. Their own provenance note says "do not promote out of `hud/` without re-litigating this flag" — **this is the re-litigation.** Promote with `has_hud: true`, `sampling: interval-run`, `integrity_flag` retained verbatim, and a `deviation` field naming §8a. The alternative is zero interval-run coverage anywhere, which is worse. |
| G08 | `character_closeup` meets 2 games but only **1 of 12** is a rear/three-quarter-rear view; REF-M6 requires ≥half, and most of Codex's entries are **cutscene** portraits (Godrick grafting, Melina) | **BLOCKING** | This is a composition failure, not a count failure, and it matters more: our camera is behind the player 100% of the time. Searches named in §4; **54 candidates**, of which the `backview` query on apps 489830 and 292030 is the direct hit. |
| G09 | `combat` 2 of 8, 1 game | **BLOCKING** | **41 candidates**, 4 games. |
| G10 | `material_closeup` 0 of 8 | **BLOCKING** | **42 candidates**, 4 games. Note it is *not* one of `RI-VIS03`'s four declared profiles (§0c lists only `exterior_daylight`, `exterior_lowlight`, `interior_darkemissive`, `character_closeup`) — it feeds the M3/M4/M5 surface bands rather than gating a profile. See §6 for why I rank it below `interior_darkemissive`. |
| G11 | `modern/ui` (REF-M22) 0 — F17–F19 have no reference population | **Split: BLOCKING for comparison use, INFERABLE for the glyph metric** | Acquire it — **56 candidates**, 4 games — but be honest about what it can serve. F17's `M-F17.1` measures a 10%→90% luminance transition across a glyph stem to a **≤1.5 device px** tolerance. Steam re-encodes every upload to chroma-subsampled JPEG, which smears a one-pixel stem transition by about a pixel. A Steam screenshot **cannot** measure a reference UI's glyph sharpness at that tolerance. It does not need to: F17–F19 are **absolute thresholds measured on our own UI**, not percentile bands drawn from a population. What the reference set is actually for is `RI-UIX06`'s judgement protocol declaration (`PERMITTED REFERENCE SET: RI-VIS02 (modern)`) and the blind comparison — for which JPEG is fine. Record UI captures with `pixel_metrics_valid: false` for F17 purposes and mark F17's reference side `derived`. Lossless-PNG UI captures would upgrade it; the search for those is named in §4. |
| G12 | `morrowind/REF-A12b` 0 — "the highest-value art-direction gap in the project" | **BLOCKING, and cheap — the search is run and the candidates are handed over** | **Not hard at all.** Steam app **22320** returns 231 menu-and-UI candidates across ten queries: `inventory` 24, `journal` 12, `map` 47, `dialogue topic` 8, `character sheet` 50, `spellmaking` 1, `barter` 8, `book reader` 50, `menu ui` 23, `interface` 11. **30 curated and handed over.** I opened two by eye: `?id=32875898` is the full four-pane vanilla UI at 1024×768 (character sheet with attributes and skills, local map, inventory grid with paperdoll, spells/powers pane) and `?id=487644932` is the vanilla journal spread. Both are pre-2015 pages, so §8b `pre-2023-page` is satisfied outright, and 4:3 is *correct* here — §6's 16:9 rule binds `refs/modern/` only. |
| G13 | `morrowind/REF-A20` (loading/splash) 0 | **BLOCKING, cheap** | Steam 22320 `loading screen` → 45 candidates (6 curated). Plus **11 first-party Bethesda store screenshots** via the appdetails API (§5). |
| G14 | `context/` 0 of 4 ESO | **BLOCKING, trivial** | Steam app **306130**: `murkmire` 47, `hist tree` 50, `argonian village` 50, `shadowfen` 26. **30 candidates handed over.** |
| G15 | `video/` V1-dolly and V2-static, both required, both 0 | **BLOCKING** | Steam store trailers are montages and fail V1/V2's "no cuts" outright, so the appdetails `movies` array is a dead end. **`yt-dlp 2026.07.04` is installed** at `/usr/local/bin/yt-dlp` — a single progressive format id downloads the CDN stream byte-for-byte with no remux, which satisfies §5b's "download clips as-is". Search terms in §4. |
| G16 | REF-M21 (flat overcast midday), REF-M19 (low shoreline water), REF-M14 (rain) — the deliberately-undramatic slots | **REF-M21 SUBSTITUTABLE; M19/M14 BLOCKING** | Measured fact: `searchText=overcast` returns **7 hits on Skyrim, 5 on Witcher 3, 3 on Elden Ring, 8 on RDR2** — against 50 for every dramatic query. Nobody uploads a boring overcast frame. Substitute: the `fog morning` (50) and `rain` (100) populations are diffuse, no-direct-sun exteriors and serve the same measurement — REF-M21 exists precisely because "diffuse light is the hardest lighting to fake" and fog/rain overcast is diffuse light. Record `substituted_for: REF-M21` and the deviation. M19 and M14 are well supplied (`shoreline water` 50 per game, `rain` 100). |
| G17 | 3 of 46 have `corroboration: "unknown"` | **BLOCKING, trivial** | §8b is absolute: establish corroboration from the source page's visible date, or move to `rejected/`. |
| G18 | Skyrim SE Steam gallery is mod/ENB-contaminated | **Risk, not a gap — but it will silently poison the bands** | See §5. Named here so the builder does not walk into it. |

**Nothing is IMPOSSIBLE at round 1.** No bar needs lowering yet. The one bar I expect to need
relaxing by round 3 is REF-M21's "flat, overcast, no direct sun, deliberately undramatic" — and G16
already gives it a substitution rather than a deletion.

---

## 4. The searches the builder should run (all verified working)

### The Steam route that works for every app

The brief's warning is right and I confirmed it: `/workshop/browse/?section=screenshots` renders the
**mod** workshop for apps that have one and returns zero screenshots, indistinguishable from "no
results". A previous agent's `ids.json` in the scratchpad is the fossil — it yielded Elden Ring only.

Use the **apphub `homecontent`** endpoint instead. It works for every app id including Skyrim and
Witcher 3, `searchText` genuinely filters (I checked that two queries return **disjoint** id sets),
and `numperpage=50` is honoured:

```
https://steamcommunity.com/app/<APPID>/homecontent/
  ?userreviewsoffset=0&p=<N>&screenshotspage=<N>&numperpage=50
  &browsefilter=toprated&appid=<APPID>&appHubSubSection=2
  &l=english&filterLanguage=default&searchText=<QUERY>&maxInappropriateScore=100
```

Fetch with `curl --compressed` (gzip garbage otherwise) and the mature-content cookie
`wants_mature_content=1; birthtime=283996801; lastagecheckage=1-January-1979`.

**One listing request yields ~50 complete candidates.** Each `apphub_Card` in the response carries
`data-publishedfileid`, the `apphub_CardContentPreviewImage` whose `src` contains the UGC path, the
preview `width`/`height` (→ aspect ratio, so ultrawide is rejectable without a second request), the
title, the author and the rating. Strip the query string from the UGC URL and you have the original:

```
https://images.steamusercontent.com/ugc/<A>/<B>/     ← original bytes
https://images.steamusercontent.com/ugc/<A>/<B>/?imw=5000&…  ← Akamai re-encode, DO NOT USE
```

Confirmed byte-exact on two files: the bare URL returned 10,002,569 bytes against a detail page
stating "9.539 MB"; on another the bare URL returned 701,272 bytes where the `imw=5000` variant
returned 672,633 — a different, smaller, re-encoded image. **Codex's choice of the bare URL was
correct; preserve it.**

### App ids and the query that hits each gap

| Gap | App | Queries that returned ≥40 hits |
|---|---|---|
| `exterior_daylight` | 489830 | `the rift autumn` 95, `whiterun` 83, `solitude` 92, `riften` 94, `waterfall` 46, `moss stone` 50 |
| | 1174180 | `bayou nwa` 50, `heartlands` 50, `grizzlies` 50, `shoreline water` 50 |
| | 292030 | `white orchard` 50, `novigrad` 47, `toussaint` 48, `skellige` 50, `velen swamp` 50, `crookback bog` 49 |
| `exterior_lowlight` | 489830 | `aurora night` 50, `night` 64, `rain` 100, `fog morning` 50, `morthal` 97 |
| | 1174180 | `night camp` 48, `dawn mist` 50, `rain` 49, `saint denis` 49, `bluewater marsh` 28 |
| | 292030 | `night` 48, `rain storm` 49, `fog` 50 |
| `interior_darkemissive` | 489830 | `blackreach` 100, `forge` 97, `cave` 100, `dwemer ruin interior` 48 |
| | 1174180 | `cave` 49 · 292030 `cave crypt` 49 |
| `character_closeup` (rear views) | 489830 | **`back view` 50**, `close up character` 49, `armor detail` 50 |
| | 292030 | **`back view` 50**, `geralt close up` 49, `armor close` 50, `witcher senses` 44 |
| | 1174180 | `arthur close up` 50, `horse close` 48 |
| `combat` | 489830 `combat dragon` 46, `battle fight` 46 · 292030 `combat fight` 50 · 1174180 `combat gunfight` 31 · 1245620 `combat boss fight` 50, `spell magic combat` 49 |
| `material_closeup` | 489830 `texture close` 42, `moss stone` 50 · 1174180 `mud ground` 48, `tree bark` 49 · 292030 `bark tree` 50 · 1245620 `material close up` 50, `stone texture` 50 |
| `modern/ui` REF-M22 | 489830 `menu inventory` 25, `skill tree` 48, `map menu` 49 · 292030 `inventory menu` 16, `character menu` 50 · 1245620 `equipment screen` 50, `map menu` 40 · 1174180 `menu satchel` 50 |
| `morrowind/REF-A12b` | **22320** `character sheet` 50, `map` 47, `book reader` 50, `inventory` 24, `menu ui` 23, `journal` 12, `interface` 11, `barter` 8, `dialogue topic` 8 |
| `morrowind/REF-A20` | **22320** `loading screen` 45 |
| `context/` | **306130** `hist tree` 50, `argonian village` 50, `murkmire` 47, `shadowfen` 26 |

All of the above are curated (top-rated, 16:9-filtered for modern) into
**`ACQUISITION-CRITIQUE-R1-candidates.json`** — 472 entries with `sid`, `game`, `title`, `author`,
`aspect`, `rating`, `page` and `cdn_url`. **The builder should start there and not re-run listings.**

### First-party screenshots — the Steam appdetails API

```
https://store.steampowered.com/api/appdetails?appids=<APPID>&l=english
```
Returns `screenshots[].path_full` (strip the `?t=` cache-buster) with no age gate. Counts: Elden Ring
10, Witcher 3 18, **Morrowind 11**, Skyrim SE 8, ESO 6, RDR2 5 — **58 first-party images**. These
satisfy §8b `first-party` outright, and for Skyrim they are the only guaranteed-**vanilla** source
(mark `promotional: true`). I opened Morrowind's `0000009072.1920x1080.jpg`: a silt strider beside a
stilted waterside settlement in rain, 1024×768, vanilla by construction — REF-A16 and REF-A19
material with the strongest provenance in the whole set.

### `modern/ui` in lossless PNG (upgrades G11 from INFERABLE to measured)

Not yet run — hand to the builder: Fextralife wiki uploads
(`eldenring.wiki.fextralife.com`, `elderscrolls.fandom.com` — both serve PNG originals via
`/images/...` paths), Wikimedia Commons `Category:Video game user interfaces`, and Nexus Mods
UI-mod pages, which routinely post lossless before/after comparison shots of the **vanilla** UI.

### `video/` — V1-dolly and V2-static

`yt-dlp 2026.07.04` is installed. Download a **single progressive format id** (`-f <id>`, no
`bv*+ba` merge) so nothing is remuxed — §5b's "download clips as-is". Queries that match V1's
"forward through open landscape, ≥20 s, no cuts, no HUD": *"Elden Ring HUD off walking Limgrave no
commentary"*, *"RDR2 first person horseback ride no HUD"*, *"Skyrim no HUD walk 4K"*; for V2's
stationary-camera shot: *"ambience 10 hours"* / *"relaxing rain sounds"* game-ambience uploads,
which are by construction one static shot. `archive.org/advancedsearch.php` also carries mirrored
`youtube-<id>` movie items with direct `.mp4` downloads (894 hits on a naive gameplay query).

---

## 5. Dead ends and traps — do not repeat these

1. **`/workshop/browse/?section=screenshots` is a silent zero** for any app with a mod workshop.
   Confirmed by the fossil `ids.json` from a previous agent: Elden Ring only, all other apps empty.
2. **Steam rate-limits the *detail* endpoint hard.** Eight concurrent fetches of
   `/sharedfiles/filedetails/?id=…` returned HTTP 429 and a ~27.3 KB "Steam Community :: Error" page
   for **960 of 1000** requests, and the error page is a valid-looking 200-sized HTML body that a
   naive cache will happily store. Three workers with a 0.7 s sleep is safe. **The listing endpoint
   is not rate-limited** — which is why extracting everything from the card markup (§4) is the right
   architecture. The detail page is only needed for the `Posted` date, `File Size` and exact `W × H`.
3. **`HEAD` is useless on `images.steamusercontent.com`.** Akamai returns `Content-Length: 92` for a
   sizeable minority of URLs — 11 of 48 in my first sample — while a plain `GET` on the identical URL
   returns the real 701,272-byte JPEG. A HEAD-based liveness check would reject a quarter of a
   perfectly good catalogue. **Use a ranged `GET` and read `Content-Range: bytes 0-1023/<total>`.**
   Re-verified that way: **60 of 60 sampled candidate URLs returned real image bytes** across all six
   app ids (see §7).
4. **`searchText` matches the uploader's title and description, not the image.** Elden Ring
   `equipment screen`'s top hit (`?id=3405289538`) is a throne-room cutscene, not a menu. Every UI
   candidate needs eyes on it (§8d) before it is catalogued.
5. **Skyrim SE's top-rated Steam gallery is mod/ENB territory, and the titles do not say so.**
   Only 30 of 1,616 Skyrim candidates mention a mod in the title (1.9%), so keyword filtering catches
   almost nothing. I opened the top `the rift autumn` hit (`?id=3413510110`, 2560×1440): custom body
   and armour mod, replaced character, ENB colour grading, groundcover and tree mods. Catalogued as
   "Skyrim SE" it would set our fidelity bar to *somebody's modlist*, which is the exact failure mode
   §7 exists to prevent on the Morrowind side and which nothing currently prevents on the modern
   side. **Three defences, in order:** prefer RDR2 (6 of 798 title-mod mentions) and Witcher 3 (9 of
   858) as games 2 and 3; take Skyrim from the appdetails API instead of the gallery; and if the
   gallery must be used, `browsefilter=mostrecent` rather than `toprated`, because top-rated selects
   for beauty and beauty selects for ENB.
   **I recommend the modern manifest gain a `modded` field that is actually populated** — it exists
   in the §9 schema and every catalogued modern record currently asserts `"modded": false` with no
   test behind it, which is the same unbacked assertion §7 forbids for Morrowind.
6. **RDR2 and Witcher 3 Steam screenshots are photo-mode-heavy**, and §5a bars photo-mode filters,
   DoF and vignette. Not fatal — the clean RDR2 night frame I opened (`?id=3544436425`, 1920×1080,
   Saint Denis outskirts, moonlit, no HUD, foreground present) is a textbook `exterior_lowlight`
   reference — but `photo_mode` must be judged per image, not assumed false.
7. **`api.github.com` unauthenticated returns 403** (rate limit) and there is **no `gh` CLI** in this
   container. Expanding the 29 globbed `sksebp-og.github.io` URLs (G02) must go through
   `raw.githubusercontent.com` directory listing or the MCP GitHub tools, not the public API.
8. **`en.uesp.net` still 403s** (protocol note, unchanged) — not attempted.
9. **Steam store *trailers* cannot serve `video/`.** All are cut montages; V1 and V2 both require
   "no cuts" explicitly. The `movies[]` array in appdetails is a dead end for this purpose.
10. **`overcast` is genuinely scarce** — 3 to 8 hits per game against 50 for dramatic queries. This
    is not a search failure to be retried; it is a property of what people upload. Treat it as G16.

---

## 6. Ranked work list for the builder

I agree with the coordinator's ordering with **two changes**, both argued.

| # | Work | Why here |
|---|---|---|
| **0** | **Fix `load_records()` and the record schema; give every record a `path`; hash the 126 on-disk files; expand the 29 globs; drop the 6 stubs.** Preserve the stream/verify/atomic-rename mechanism byte for byte. | Everything below is unusable until `acquire.py --check` runs. This is half a day of work that unblocks the other 100%. It is not in the coordinator's list and it should be first. |
| **1** | **Release the 24 Witcher 3 `interval-run` frames from `modern/hud/` into `exterior_daylight` / `exterior_lowlight`** per A1, with the G07 deviation written down. | The single highest-value action in the project and it costs **zero downloads** — the bytes are already on disk. It supplies a second game to both exterior profiles *and* the entire interval-run half of §3, which is currently at zero. The coordinator's list does not mention it because the brief's coverage table counts them as `hud`. |
| **2** | **Second and third game in `exterior_daylight` and `exterior_lowlight`** — RDR2 and Witcher 3 first, Skyrim only from first-party. 177 candidates handed over. | Coordinator's priority 1, and right. |
| **3** | **`interior_darkemissive` — 0 countable, and it is one of `RI-VIS03`'s four declared profiles.** 36 candidates, 3 games. | **This is my change to the ordering.** The coordinator puts `material_closeup` and `combat` next; `interior_darkemissive` is at literal zero countable images *and* gates a named profile with its own metric relaxations (M1 relaxed hard, M7 skipped, M6+M9 tightened). `material_closeup` is not a declared profile at all. Empty profile beats empty folder. |
| **4** | **`combat` (2 of 8, 1 game) and `character_closeup`'s rear-view failure (1 of 12).** 41 + 54 candidates. | `combat` maps onto `RI-VIS03`'s `character_closeup` profile via `combat_midfight`, so these two are one job. The rear-view rule matters more than the count: our camera is behind the player 100% of the time. |
| **5** | **`material_closeup` — 0 of 8.** 42 candidates, 4 games. | Coordinator's priority 2. Demoted one place for the reason in row 3, not because it is unimportant — it carries the M3/M4/M5 surface bands. |
| **6** | **`morrowind/REF-A12b` — Morrowind's menus as rendered.** 30 curated, 231 available, two verified by eye. | **This is my second change: promote it above `modern/ui`.** The coordinator ranks `modern/ui` third and A12b fourth. But A12b turns out to be *cheap and abundant* (§3 G12) while its absence is the most consequential hole in the corpus — REF-A12 is a **core** slot per §5e, it currently holds 38 records of OpenMW Lua and MyGUI XML, and `RI-VIS05`'s entire UI transposition rests on it with no pixel of the original art. Highest value per unit of effort in the whole list. |
| **7** | **`modern/ui` (REF-M22)** — 56 candidates, 4 games, with the G11 honesty caveat recorded. | Coordinator's priority 3. Demoted one place because, as G11 shows, F17–F19 are absolute thresholds measured on our own UI; the reference population serves comparison and sanity-checking, not band-setting. Real, but less load-bearing than the brief implies. |
| **8** | `morrowind/REF-A20` (45 + 11 first-party candidates), `context/` (30 candidates, trivial). | Both cheap. |
| **9** | `video/` V1 + V2 via `yt-dlp` progressive format. | Required by §5b but measured for motion only, `pixel_metrics_valid: false` regardless. |
| **10** | Resolve the 3 `corroboration: "unknown"` records; populate `modded` with an actual test on every modern record. | Hygiene that protects everything above it. |

---

## 7. Verification actually performed

- **60 candidate CDN URLs** ranged-GET verified across all six app ids (10 per app, seeded random
  sample of the 4,091-candidate pool): **60 of 60** returned `Content-Range` totals of real image
  size — 95 KB to 9.0 MB, median ≈ 370 KB. Zero 404s, zero stubs. Raw results in the scratchpad
  (`verify2.json`).
- An earlier **48-URL HEAD-based** check reported 48 of 48 "resolving" but with 11 phantom
  `Content-Length: 92` responses — the trap in §5.3. Both runs are reported because the discrepancy
  is the finding.
- **Two byte-exactness checks** against the detail page's stated file size, confirming the bare UGC
  URL is the original and the `imw=5000` variant is not.
- **Six images opened and looked at** (§8d), across the four judgements that mattered: Morrowind's
  four-pane vanilla UI and journal (REF-A12b is real and obtainable), a first-party Morrowind store
  screenshot, a clean RDR2 night exterior (the modern route produces usable frames), a modded Skyrim
  "top-rated" frame (the contamination is real and invisible in metadata), and a mislabelled Elden
  Ring "equipment screen" (title search is a weak proxy).

**Files written by this critique.** `ACQUISITION-CRITIQUE-R1.md`, `ACQUISITION-CRITIQUE-R1.json`,
`ACQUISITION-CRITIQUE-R1-candidates.json`. **`acquire.py` and `_provenance.json` were read and not
modified.**

---

## 8. Addendum — the tree moved while this critique was being written

Between the coverage audit above and this file being saved, a concurrent agent committed
`2ea906a "Refs: download 46 Elden Ring images"`. Three of my findings are now stale and one new
one is worse than anything above. **The §1 coverage table is unaffected** — the same 46 records,
the same 15 countable images — but §2 must be read as follows.

### 8.1 G01 is FIXED — verified

`_provenance.json` has been rewritten into the flat path-keyed dict `load_records()` always
expected, every record now carries `expected_bytes` and `expected_sha256`, and all 46 files are on
disk under `refs/modern/`. Re-run just now:

```
$ python3 acquire.py --check
[46/46] OK modern/interior_darkemissive/REF-ER__steam-neulyiaa-2776456418.jpg: 1222964 bytes, sha256 f47f742…
ok: 46 reference files
```

The integrity mechanism works end to end and is intact. **G01 → CLOSED.** Work-list rank 0 loses its
loader half; its hashing half is superseded by G19.

### 8.2 G19 — 159 provenance records were deleted, not migrated. **BLOCKING, and it is a regression**

The rewrite kept the 46 Codex records and moved **six** rejected stubs into `_provenance-local.json`.
The other **159 records are simply gone from the working tree**: every `morrowind-art-direction`
record (127 of them, covering the 89 files on disk and REF-A12's 38 `ui-definition` entries), all 5
`anti-generic` records, all 24 Witcher 3 `modern/hud` records, and the remaining `rejected` entries.

What went with them is not decoration. It is the **seven `vanilla_tests` booleans** that are the only
thing standing between our art-direction axis and somebody's modlist; the `identified_by` triples
that §8c requires; the `corroboration` values that §8b requires; and the **ACDSee `integrity_flag`
and its measured counter-evidence**, which is the entire evidentiary basis for G07. The files are
still on disk and still measurable; they are now undocumented, which under §9 and §10 means they
cannot be cited.

**They are fully recoverable and the builder must recover them before anything else:**

```
git show c3d8b38:corpus/70-visual/refs/_provenance.json    # 211 records, all fields intact
```

Merge those 159 back in, keyed by the destination path each file already occupies, and compute
`expected_bytes` / `expected_sha256` locally from the bytes on disk (`make-manifest.py` already emits
both). `_provenance-local.json`'s premise — "not consumed by `acquire.py`, which only handles
remote-fetchable entries" — is the wrong split: a locally-present file with a known hash is exactly
what `--check` exists to verify, and splitting the catalogue in two means `--check` reports `ok: 46`
while silently ignoring 126 files it should be guarding. **`--check` is now passing dishonestly.**

### 8.3 The rest of §2 stands

The 29 globbed `raw.githubusercontent.com` URLs and the missing hashes are still unresolved — they
were removed from the catalogue rather than fixed, which is not the same thing. G02 stays BLOCKING,
re-scoped: expand the globs, hash the on-disk files, and fold all 159 records back in.

### 8.4 Collision warning

A second agent, `ref-critic-r1` (`orchestration/status/ref-critic-r1.json`), is assigned the *same*
two output paths as this file. At the time of writing its `outputs_written` is empty. If
`ACQUISITION-CRITIQUE-R1.md` is later found not to contain this addendum, the version described here
was overwritten; the candidate handover in `ACQUISITION-CRITIQUE-R1-candidates.json` (472 entries) and
the machine-readable copy at `ACQUISITION-CRITIQUE-R1-code.json` are the surviving artefacts.
