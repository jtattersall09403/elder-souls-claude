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
