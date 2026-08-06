# Reference acquisition progress

Last updated: 2026-08-06 UTC

- Identified and visually inspected 46 useful Elden Ring images from Steam uploaders `Dyules` and `neulyiaa`.
- Recorded direct CDN URLs, source pages, uploader names, destinations, visual identifications, exact byte lengths, and SHA-256 hashes in `_provenance.json`.
- Replaced the 46 newly added binary repository changes with `acquire.py` because the Codex browser UI rejects binary patches; pre-existing media remains untouched.
- Verified a clean-room download of all 46 records: every downloaded byte stream matched the recorded size and SHA-256.
- Kept HUD, cutscene, loading-screen, menu, and arbitrary-framing material in response to the owner's clarified critic-agent requirements.
- Left unknown facts explicitly unknown and left pre-existing media untouched where its source bytes could not be reconstructed honestly.
