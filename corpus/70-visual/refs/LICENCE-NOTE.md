# Licence and copyright note for everything under `corpus/70-visual/refs/`

Every image file in this directory tree is a **screenshot of a commercial video game**. They are
held under their publishers' copyright:

- **The Elder Scrolls III: Morrowind** — Bethesda Softworks / ZeniMax Media.
- **The Witcher 3: Wild Hunt** — CD PROJEKT RED.
- **Red Dead Redemption 2** — Rockstar Games / Take-Two Interactive.

They were obtained from public GitHub repositories that redistribute them (see `source_page` on
each record in `MANIFEST.json`), and the uploaders' own rights in those captures are unknown.

**They are retained solely as internal reference for comparison and critique of our own
renderer's output.** They are not redistributed as part of any product, they are not used as
source material for any asset, and no derivative work is made from them.

**No open-source licence applies to these files.** The repository's own licence covers the
corpus text and the tooling; it does **not** cover the images. Do not relicence them, do not
publish them, do not train on them, and do not treat their presence in a git repository as any
kind of grant.

If a rights holder objects, the correct response is to delete the files and re-derive the bands
in `reference-metrics.json` from a replacement set — the measurements, not the pixels, are what
the corpus depends on.

`make-manifest.py`, `_provenance.json`, `_computed.json`, `MANIFEST.json`,
`reference-metrics.json` and this note are our own work and carry the repository's licence.
