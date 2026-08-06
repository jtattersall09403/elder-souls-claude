# Brief: implement the fidelity metrics the visual corpus actually specifies

## The finding that created this task

The image-acquisition agent measured its haul and discovered that
**`tools/metrics/image-metrics.mjs` does not implement `RI-VIS03`.** Concretely:

- **No foreground mask (`FG_MASK`)** — sky contaminates every band.
- **M5's FFT runs on a 256×256 box-downscale of the whole frame**, not a native 1024² crop. So M5
  measures the *resampler*, and is resolution-dependent. This is why a set of 320px 2002
  screenshots measured as *better anti-aliased* than 1440p Witcher 3 frames — a result that should
  be impossible and is pure instrument error.
- **M8's two HARD FAIL statistics (`FS_score`, `LargestFlat`) are computed by nothing at all.**
- M3 is HSV, not CIELAB. M4's `scale_ratio` guard is absent. **M6, M9, M10, M11 and M12 do not
  exist.**

Net: **only M1, and loosely M4, can be calibrated by any reference image today.** Every visual
verdict this project would produce is currently resting on an instrument that does not measure
what the bar says it measures — and an external agent (Codex) is acquiring ~60 modern reference
images right now whose numeric value depends entirely on this being fixed.

**Fixing the instrument is now more urgent than acquiring more pixels.**

## Read first

- `corpus/70-visual/RI-VIS03-fidelity-image-metrics.md` — **the specification you are implementing.**
  M1–M12, each with its formula, its profile bands, and its named diagnosis on failure.
- `corpus/70-visual/RI-VIS01-bifurcation-protocol.md` — which properties are fidelity vs art
  direction; you implement the fidelity side only.
- `corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md` — the reference slots and profiles.
- `corpus/70-visual/refs/ACQUISITION-REPORT.md` — especially its measured-vs-guessed section and
  its proposed band amendments; and `corpus/70-visual/refs/reference-metrics.json`.
- `corpus/70-visual/RI-VIS09-reference-image-set.md` and `refs/MANIFEST.json`.
- `tools/metrics/image-metrics.mjs` — what exists now.
- `corpus/80-methods/HARNESS.md` §6 — the screenshot contract these metrics consume.

## Deliverables

1. **`tools/metrics/image-metrics.mjs` implementing M1–M12 as specified.** Priorities in order:
   - **`FG_MASK`** — a foreground/sky separation used by every band that RI-VIS03 says excludes sky.
     Specify the method in a comment and make it deterministic.
   - **M5 on a native-resolution 1024² crop**, never a downscale. If an image is smaller than
     1024², say so and mark the metric `unmeasurable` rather than resampling — a metric that
     silently measures the resampler is worse than a missing one.
   - **M8's `FS_score` and `LargestFlat`** — these carry hard fails and currently do not exist.
   - **M3 in CIELAB**, not HSV. M4's `scale_ratio`. Then **M6, M9, M10, M11, M12**.
   - M11 (LOD pop) and M12 (temporal variance) need a frame *sequence*, not a still. Implement them
     to take a directory of ordered frames or a video, and where no sequence exists report
     `unmeasurable` — do not fake a single-frame proxy.
   - **Add dynamic range in stops** to M1: the acquisition agent found it separates the eras with
     no overlap at all (2002: 5.61–8.31; modern: 9.20–11.75), which makes it the single most
     discriminating statistic found so far.
2. **A self-test** — `tools/metrics/self-test.mjs` — that runs the battery over the images already
   in `corpus/70-visual/refs/` and asserts the instrument behaves: a downscaled image must not
   score as better-anti-aliased than a native one; a synthetic flat-shaded render must trip M8;
   a synthetic uniform-sky image must trip M7. **The instrument must be able to fail.**
3. **`corpus/00-doctrine/METRICS-IMPLEMENTATION-01.md`** — what you implemented, what you could
   not, which of RI-VIS03's bands are now measurable, and **proposed amendments to RI-VIS03's
   bands** based on what the real reference images measure (the acquisition report already
   proposes four: M1 mean floor 0.28 → ~0.23, M1 blown/crushed maxima far too loose, M7 dY_sky
   0.06 → ~0.15, M2 C_local_med 0.045 → ~0.052). **Do not edit RI-VIS03** — propose.

## Rules

- Zero-native-dependency JS where possible (`pngjs`, `pixelmatch` are already in `tools/`); add
  AVIF/WebP decode only if it installs cleanly — much of the acquired Morrowind set is AVIF.
- Every metric must emit `{value, unit, profile, measurable: true|false, reason}` — **never a
  number it did not actually compute.** `unmeasurable` is a legitimate, required output.
- Follow `orchestration/AGENT-PROTOCOL.md`: status file first, write incrementally, bank findings.
- Internet is unrestricted; use it for algorithm references (CIELAB conversion, Sobel, FFT).

## The point

A bar you cannot measure is not a bar. This task is what turns the visual corpus from a document
into an instrument, and everything Codex is fetching right now depends on it.
