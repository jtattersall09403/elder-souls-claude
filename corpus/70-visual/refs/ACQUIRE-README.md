# Reproducing the visual reference corpus

This change intentionally adds **no new binary media** because the Codex browser UI cannot submit binary patches. Pre-existing reference assets remain untouched; the newly acquired corpus is represented by acquisition code and a path-keyed source catalogue.

## Claude Code / local instructions

From the repository root:

```bash
python3 -m pip install -r corpus/70-visual/refs/requirements.txt
python3 corpus/70-visual/refs/acquire.py
python3 corpus/70-visual/refs/acquire.py --check
```

The first command installs Pillow for metric generation. `acquire.py` itself uses only the Python standard library.

The acquisition command:

1. reads `_provenance.json`;
2. creates the specified profile directories;
3. streams every direct Steam CDN source into a temporary file;
4. verifies its exact byte length and SHA-256 against the first successful acquisition;
5. atomically renames it to its declared destination without decoding, resizing, or re-encoding it; and
6. runs `make-manifest.py` to produce `_computed.json` and `MANIFEST.json`.

A failed or truncated download never replaces a valid file. Re-running the command resumes from verified cached files. Use `--force` to redownload everything or `--download-only` to defer metric generation.

## Expected result

The catalogue currently contains 46 Elden Ring images from the Steam upload pages recorded in `_provenance.json`:

| Profile | Files |
|---|---:|
| `modern/exterior_daylight` | 10 |
| `modern/exterior_lowlight` | 11 |
| `modern/interior_darkemissive` | 8 |
| `modern/character_closeup` | 11 |
| `modern/combat` | 2 |
| `modern/hud` | 4 |
| **Total** | **46** |

The set deliberately includes HUD, loading-screen, cutscene, menu, and arbitrary-framing material for critic-agent comparison. Integrity flags in the generated manifest still prevent heavily compressed files from silently entering numeric calibration populations.

## Text-only change invariant

The 46 catalogue destinations are created only when `acquire.py` runs. The submitted patch contains their URLs, hashes, metadata, and acquisition logic—not the JPEG blobs themselves. Pre-existing binary references in the repository are neither removed nor modified by this package.
