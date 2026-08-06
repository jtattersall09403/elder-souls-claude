# The pack in this directory replaced the one verdict W1-01 judged

Verdict `W1-01` (`crit-w1-01-world-7c1a`) cited two frames of the previous pack by path:

- `reports/region-shots/frame-01.png`
- `reports/region-shots/frame-39.png`

Those files no longer exist. The pack was rebuilt by the W1-01 remediation because the verdict
found it **void**: *"The 39 frames are not shuffled. My assignments fell out as a perfectly
monotone block structure — frames 1–3 → region 1, 4–6 → region 2, … 37–39 → region 13 — in exactly
the alphabetical order `REGIONS.txt` hands the judge. … M17 as shipped is not a measurement of
region legibility, and no verdict may report 39/39 as one."* (§4a)

Two consequences, both recorded rather than papered over:

1. **`node tools/verdict-validate.mjs` now reports `W1-01.json` as VOID** on those two missing
   artifacts. That is a true statement about the file and it is not fixed here — the verdict is the
   critic's document and the remediation does not edit it. The frames were not fabricated,
   substituted or renamed.
2. **A process defect is exposed.** The verdict cited artifacts at transient `reports/` paths,
   which the repository does not track, instead of copying them into
   `corpus/90-verdicts/wave1/artifacts/W1-01/` as it did for its other fifteen artifacts. Any
   remediation that rebuilds a report necessarily voids such a citation. Verdicts should copy every
   cited artifact into their own artifact directory.

The current pack is `elder-souls/region-shots@2`: 117 frames (39 day, 39 night, 39 worst weather),
9 per region, sampling seed 1337, **shuffle seed 20260806**, with the anti-ordering assertion
recorded in `ANSWERS.json` and re-asserted at capture time.
