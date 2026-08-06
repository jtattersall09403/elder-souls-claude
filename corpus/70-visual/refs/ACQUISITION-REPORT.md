# Reference acquisition report

## 1. Per-folder count table

Only records with complete provenance and `pixel_metrics_valid: true` count. The inherited files have no provenance records, corroboration decisions, complete visual identifications, or modern-profile certification, so none can honestly count toward a calibration floor.

| Folder | Required | Delivered | Status |
|---|---:|---:|---|
| `modern/exterior_daylight` | 12 | 0 | **SHORT** |
| `modern/exterior_lowlight` | 12 | 0 | **SHORT** |
| `modern/interior_darkemissive` | 10 | 0 | **SHORT** |
| `modern/character_closeup` | 10 | 0 | **SHORT** |
| `modern/combat` | 8 | 0 | **SHORT** |
| `modern/material_closeup` | 8 | 0 | **SHORT** |

All six statistical folders are short, so the §10 abort condition applies. Acquisition stopped rather than padding the calibration population. The 24 inherited Witcher images remain in `modern/hud/` and are explicitly non-comparable; the single inherited character candidate is not counted without source and visual certification.

## 2. Per-slot status

| Slots | Status | What was tried / realistic next requirement |
|---|---|---|
| REF-M1–M5, M7, M9–M21 | Unfilled | Audited the inherited tree and found no source-complete, corroborated modern candidates in the required profiles. A future pass needs original native screenshot-series pages first, with six interval samples per exterior/interior profile, then selected files from additional games and locations. |
| REF-M6 | Unfilled | One inherited RDR2 candidate exists, but has no recorded source page, corroboration, or three-feature identification. It cannot count until those facts are independently established. |
| REF-A1–A11, A14–A17 | Unfilled (candidates retained) | The inherited AVIF candidates were measured byte-for-byte, but no source URLs, seven explicit vanilla tests, or three-feature visual identifications accompanied them. Their filenames are not evidence. A future pass should begin at the original Morrowind screenshot pages and move any file failing one vanilla test out of slot folders. |
| REF-A12, REF-A13, REF-A18, REF-A19 | Unfilled | No inherited slot folders or candidates were present. Search original, visibly dated vanilla-era or official pages; accept low resolution rather than modded imagery. |
| V1–V4 | Unfilled | No original downloadable, untrimmed clips with the required continuous actions and setup metadata were present. |
| Anti-generic | Unfilled for citation | Five inherited candidates exist, but lack recorded source/corroboration and visual identification. |
| Context | Unfilled | No ESO Shadowfen/Murkmire candidates were present. |

There is deliberately no REF-M8 assessment and no `refs/anti/` directory was created or touched.

## 3. Rejection log

These files were already present in `rejected/`; their original acquisition notes were not available, so this report does not invent failing values. Computed values remain in `MANIFEST.json`.

| File | Reason |
|---|---|
| `rdr2-main-storyline-start.jpg` | Rejected before this audit; exact original reason and acquisition URL unknown. |
| `sksebp-wallpaper-1080p-01.jpg` | Wallpaper/promotional candidate; provenance and gameplay status unverified. |
| `sksebp-wallpaper-1080p-04.jpg` | Wallpaper/promotional candidate; provenance and gameplay status unverified. |
| `sksebp-wallpaper-1080p-07.jpg` | Wallpaper/promotional candidate; provenance and gameplay status unverified. |
| `sksebp-wallpaper-1080p-11.jpg` | Wallpaper/promotional candidate; provenance and gameplay status unverified. |
| `REF-A15__mwscr-2017-05-02-paper-trail.avif` | Rejected before this audit; exact original reason and acquisition URL unknown. |

No new image was downloaded and rejected in this pass. Unknown historical reasons are reported as unknown rather than reconstructed from filenames.

## 4. Uncertainties

- Every inherited image is uncertain because the human provenance sidecar is absent. `MANIFEST.json` marks these records `PROVENANCE_MISSING` rather than fabricating fields.
- The Morrowind candidates have not passed the seven explicit vanilla checks. Folder placement alone is not treated as proof.
- The 24 Witcher run-named files carry a HUD and cannot establish an interval-run population in a comparison folder.
- The AVIF filenames dated 2023 or later cannot use the pre-2023 corroboration route without an older source page; no assumption was made about page age.
- The two `morrowind/unconfirmed/` JPEGs remain excluded, as intended.

## 5. Anything not completed

- No modern profile reached its statistical floor; the mandatory abort rule stopped further filling.
- No source corroboration or source URL was recoverable from repository metadata.
- No file was promoted into a measurement population, and no image bytes were changed.
- Videos and ESO context images were not acquired.
- `make-manifest.py` successfully computed byte hashes, dimensions, metadata signals, FFT ratio, resampling MAD, and 8-pixel boundary ratio for every decodable media file. Human/provenance fields remain explicitly missing.
