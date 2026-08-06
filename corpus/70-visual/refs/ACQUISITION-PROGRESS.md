# Reference acquisition progress

Last updated: 2026-08-06 UTC

- Auditing the pre-existing reference payload without changing image bytes.
- Corrected the manifest implementation to use the specified resampling MAD and JPEG block-boundary ratio.
- The six modern calibration profiles are below their hard floors; the abort condition applies. No files will be used to pad them.
- Provenance, corroboration, and seven-test vanilla decisions are not present for the pre-existing payload. Those files cannot be certified as measurement references in this pass.

## 2026-08-06 acquisition continuation

- Confirmed that the 111 media binaries are tracked Git objects, not placeholders.
- Queried the UESP MediaWiki API for first-party Morrowind core-slot originals (creatures, ancestral tombs, flora, and Bitter Coast). The API returned original-file metadata, but the image host rejected every byte download with a Cloudflare HTTP 403 challenge. No challenge page was retained as an image.
- Queried Steam's public Elden Ring screenshot gallery for a continuous native series. Current pages were reachable, but the samples inspected did not satisfy the required pre-2023/first-party/two-host corroboration gate, so none were downloaded into a target folder.
- Acquisition remains active. Nothing has been used to pad a floor.
