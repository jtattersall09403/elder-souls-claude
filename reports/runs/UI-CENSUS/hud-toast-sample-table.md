| Tool | Check | Status | Samples | One sample is | Detail |
|---|---|---|---|---|---|
| `ui-census.mjs --hud-toast` | A1 | **PASS** | 2 of 2 | (hud.toast, corpus string) pairs | 0 of 2 measured pairs over 1.0px; worst 0px |
| `ui-census.mjs --hud-toast` | A2a | **FAIL** | 8 of 8 | the 3 widest, 3 narrowest, widest word, one 3-row string | 8 of 8 show cut ink; reference-draw vacuity guard held (every reference draw registered ink) |
| `ui-census.mjs --hud-toast` | A2b | **PASS** | 1 | same-row-count toast pairs | row_count 2, same_rect true, escaped_px 0, changed_px_inside_rect 4484 |
| `ui-census.mjs --hud-toast` | A3 | **PASS** | 2 of 2 | corpus strings | 0 of 2 lost text silently |
