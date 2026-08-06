# Reference acquisition progress

Last updated: 2026-08-06 UTC

- Identified and visually inspected 46 useful Elden Ring images from Steam uploaders `Dyules` and `neulyiaa`.
- Recorded direct CDN URLs, source pages, uploader names, destinations, visual identifications, exact byte lengths, and SHA-256 hashes in `_provenance.json`.
- Replaced the 46 newly added binary repository changes with `acquire.py` because the Codex browser UI rejects binary patches; pre-existing media remains untouched.
- Verified a clean-room download of all 46 records: every downloaded byte stream matched the recorded size and SHA-256.
- Kept HUD, cutscene, loading-screen, menu, and arbitrary-framing material in response to the owner's clarified critic-agent requirements.
- Left unknown facts explicitly unknown and left pre-existing media untouched where its source bytes could not be reconstructed honestly.

## Temporal reference round (A8) — 2026-08-06

**`TEMPORAL-ACQUISITION.md` in this directory is the route map for all moving-image reference.**
Read it before touching video, GIF or any temporal bar. It records every host and method tried,
what each yielded, and why each failure failed — including two round-1 conclusions it overturns
(`static.wikia.nocookie.net` *does* serve original GIF bytes; YouTube's block is not where the
report said it was). Added this round:

- **207 animation GIFs, 398.5 MB, 19,600 frames** — Dark Souls 1 per-boss/per-move attack library
  (23 bosses), Elden Ring movesets, skills, quickstep and enemy weapon-art telegraphs, DS3 parries.
- **9 video clips, 134.6 MB**, all byte-exact from archive.org h.264 derivatives — including the
  **first moving-image reference of Morrowind the corpus has ever had** (three clips, one of them
  2002 broadcast footage that predates every graphics mod).
- **4 Steam burst screenshot series, 46 frames** in `temporal-substitutes/` — one of which
  (`burst-er-lgz` frames 1–3, one doorway at three camera distances) measures LOD pop-in more
  directly than any clip obtainable.
