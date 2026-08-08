| Tool | Check | Status | Samples | One sample is | Detail |
|---|---|---|---|---|---|
| `ui-metrics.mjs` | FD1 | **PASS** | 7 of 7 | captures with a stem sample | median 0.809 px over [book,inventory,journal,levelup,map,sheet,spells] of [book,inventory,journal,levelup,map,sheet,spells], 29307 stem crossings |
| `ui-metrics.mjs` | FD2 | **PASS** | 7 of 7 | captures with a stem sample | median 1.466 px over [book,inventory,journal,levelup,map,sheet,spells] of [book,inventory,journal,levelup,map,sheet,spells], 73342 stem crossings |
| `ui-metrics.mjs` | FD3 | **PASS** | 14 of 14 | captures reporting a body size | path canvas-vector, raster scale 1, body 19/26/38/52 px, screen fraction 0.0176/0.0241/0.0352/0.0481, source game/src/ui/glyphs.js |
| `ui-metrics.mjs` | FD4 | **PASS** | 374 | visible elements across all captures | 374 visible elements over 14 captures; clipped [] |
| `ui-metrics.mjs` | FD5 | **PASS** | 14 of 14 | panel area fractions | panel area fraction range 0.5718..0.5718, drift 0.00% |
| `ui-metrics.mjs` | FD6 | **FAIL** | 98659 | graded edge pixels | worst ΔE2000 58.291 (round-2 luma unit: 151); 14/14 captures over 3, 14 over 8; 31322 of 98659 edge pixels over 3, 9711 over 8; HARD FAIL YES — RI-UIX06 §Scorin |
| `ui-metrics.mjs` | FD7 | **PASS** | 14 of 14 | captures with a measured panel gradient | bits 7.12, max overdraw 1.064, 0 captures with no panel |
| `ui-metrics.mjs` | FD8 | **PASS** | 7 of 7 | screens opened | opened [book,inventory,journal,levelup,map,sheet,spells]; unmeasured [-]; undeclared [-]; stale declarations [-] |
