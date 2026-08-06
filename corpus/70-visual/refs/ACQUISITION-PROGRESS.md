# Reference acquisition progress

Last updated: 2026-08-06 UTC

- Auditing the pre-existing reference payload without changing image bytes.
- Corrected the manifest implementation to use the specified resampling MAD and JPEG block-boundary ratio.
- The six modern calibration profiles are below their hard floors; the abort condition applies. No files will be used to pad them.
- Provenance, corroboration, and seven-test vanilla decisions are not present for the pre-existing payload. Those files cannot be certified as measurement references in this pass.
