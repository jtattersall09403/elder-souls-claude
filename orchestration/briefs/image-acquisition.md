# Brief: acquire real reference images via the one reachable channel

**User-escalated and critical.** The corpus specifies REF-M1..M20 (modern fidelity) and REF-A1..A17 (Morrowind art direction) but has **no actual pixels**, so blind side-by-side visual comparison cannot run at all.

Read: `docs/REFERENCE-IMAGE-REQUEST.md` (the full specification — folder layout, sample floors, file-integrity rules, vanilla tests, manifest schema, and **§11's substitution ladder**), plus `corpus/70-visual/RI-VIS01` (the bifurcation), `RI-VIS02`, `RI-VIS03` (the twelve metrics), `RI-VIS05`, `RI-VIS06` (blind protocol).

An external agent (Codex) with full internet access will run that same specification. **You are the in-container attempt via the one channel that works here** — whatever you obtain merges with theirs, and the manifest schema is designed to take both.

## The network reality — this is the whole difficulty
All HTTPS goes through a policy proxy. **Blocked (403 at CONNECT):** images.uesp.net, en.uesp.net, dumps.uesp.net, upload.wikimedia.org, Wikipedia, Fandom/wikia, imgur, Steam CDN, archive.org, Google Drive.
**Works:** `git clone --depth 1 https://github.com/OWNER/REPO.git` of arbitrary **public GitHub repos** (verified). `raw.githubusercontent.com` and `media.githubusercontent.com` respond — test whether you can pull file bytes with `curl -L`. **WebSearch** works (ToolSearch `select:WebSearch,WebFetch`) — use it to *find repo names*; the GitHub API is repo-scoped to this session so `api.github.com/search` does **not** work.

## Method
Use WebSearch to find GitHub repos likely to contain game screenshots, then clone them blind. Think laterally about what kind of repo holds them: engine-reimplementation projects and their docs (OpenMW is a Morrowind engine reimplementation — `https://github.com/OpenMW/openmw.git` is verified clonable); modding tools and **mod-comparison repos** (before/after shots often contain both a vanilla and a modernised render — ideal); ML datasets of game frames (super-resolution, upscaling, style transfer); graphics-research test images; GitHub Pages sites and `gh-pages` branches, which store their images in-repo; awesome-lists; static wiki exports.

Hunt with `find . -iregex '.*\.\(png\|jpg\|jpeg\|webp\)$' -size +80k`. **Be disciplined about disk** — fixed allowance, a 7.7GB clone already exists elsewhere. Use `--filter=blob:none` when exploring and delete clones as soon as you've extracted. Check `df` if writes fail.

**Verify every image by opening it with the Read tool** (it renders images). Confirm it is an in-game render of the game and place claimed — not concept art, box art, fan art, a map, a mod banner, or AI-generated.

## Deliverables
Follow `docs/REFERENCE-IMAGE-REQUEST.md` exactly for layout (`refs/modern/<profile>/`, `refs/morrowind/<slot>/`, `refs/video/`, `refs/anti-generic/`, `refs/context/`, `refs/rejected/`), naming, the seven **vanilla tests**, and the **file-integrity rules** (never resize, re-encode or convert — the metrics measure exactly what those operations destroy).
- `corpus/70-visual/refs/MANIFEST.json` — the full schema from §9.
- `corpus/70-visual/refs/ACQUISITION-REPORT.md` — per-folder counts vs floors, per-slot filled/unfilled with what you tried, the rejection log, and everything you were unsure about.
- **Run `node tools/metrics/image-metrics.mjs` over everything acquired** → `corpus/70-visual/refs/reference-metrics.json`. This turns reference shots into **measured** target bands for M1–M12, replacing the `constructed` bands RI-VIS03 admits to. **Report how the real values compare to RI-VIS03's guessed bands** — if the guesses were wrong that is a significant finding; propose the amendment, don't edit RI-VIS03.
- `corpus/70-visual/RI-VIS09-reference-image-set.md` — a CORPUS-CONTRACT reference item registering the set as a first-class bar: what exists, which items consume which images, the blind procedure via `tools/blind/make-pair.mjs`, and an honest statement of coverage gaps.

## If you get nothing
Do not fake it, do not generate substitutes, do not describe an image you did not obtain. Report host by host and repo by repo what you tried, and deliver a precise shot-list instead. A truthful empty-handed report is a success; invented reference pixels are a catastrophe.
