# I2 — capture sanity gate: the evidence

`reports/` is gitignored in this repo (`reports/.gitignore` is `*`), so evidence written there never
reaches the remote — `HAZARDS.md` §9. These are the copies that survive.

| file | what it is |
| --- | --- |
| `self-test.txt` | `node tools/visual/frame-liveness.mjs --self-test`, exit 0, 16 arms. Every red arm must trip the test it was built for; an arm that goes red for the wrong reason is recorded as a failure. |
| `calibration-932-frames.txt` | `--calibrate reports --sample 4`. 932 frames, 366 directories. The distribution every hard threshold was derived from, and the run that demoted D2 and D3. |
| `calibration-p90-368-frames.txt` | `--calibrate reports --sample 1` after adding `local_contrast_p90`. The run that demoted D3 in its second formulation too. |
| `retro-f10-characters-hw3.json` | the gate run against the 93-frame F10 hardware sweep that originally reported `0 red`. 15 of 17 known-empty frames caught, 6 of 76 known-good false-redded. |
| `f10-subject-boxes.json` | the projected subject rows used above, derived from that run's own recorded head/foot NDC — so the box is independent of the pixels being judged (`HAZARDS.md` §0). |

The two large per-frame row dumps (`calibration-reports.json`, 586 KB, and `calibration-p90.json`,
249 KB) are deliberately not copied here. Both are reproducible in one command, printed at the top
of `tools/visual/frame-liveness.mjs`.

**What the numbers say, in one line each.** The hard battery rejects **7 of 932 real captures
(0.75%)**, which is what makes it safe to fail loudly on. The two tests `HAZARDS.md` §15 actually
prescribed would have rejected **324 of 932 (34.76%)** and are shipped reported-but-not-fatal, with
the measurement that demoted them recorded in the module.
