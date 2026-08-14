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

---

# Appended from the external (Codex) acquisition run

# Copyright and use note

The files in this directory are screenshots of commercial games. They remain under their respective publishers' and other rightsholders' copyright and are retained solely for internal comparison and critique. No open-source licence is asserted for any screenshot or clip, and inclusion here does not grant redistribution or reuse rights.

---

# Appended 2026-08-14 — `morrowind/REF-A12c/`, the owner-supplied interface capture

`REF-A12c-dialogue__mw-owner-20260814.png` did not come from a host. **The project's owner took
it themselves, on their own phone, running OpenMW for Android**, and supplied it directly on
2026-08-14. It is the only file in this tree with that provenance, so it is the only one whose
licence position is not the one stated at the top of this note, and it is stated in full on the
record itself in `_provenance.json` rather than inherited.

**The position:** the frame shows Bethesda Softworks / ZeniMax Media's interface art, fonts,
layout and texture work. OpenMW is GPL-3.0 and that licence covers **the engine**, not the
Bethesda assets the engine draws — so nothing about the capture route makes these pixels free.
The owner holds whatever rights subsist in the act of capture; Bethesda holds the underlying
work. It is retained on exactly the same footing as everything else here: internal reference for
comparison and critique of our own interface, never redistributed, never a source for an asset,
no derivative made.

**A note on how this tree records licences, because it should not be discovered by surprise.**
**No record in `MANIFEST.json` carries a `licence` field at all** — not `null`, absent. The
position is carried once, for the whole tree, by this file, and for a tree of uniformly-sourced
game screenshots that is defensible. It stops being defensible the moment a file arrives whose
provenance differs from the rest, because a reader checking that one file would silently inherit
a statement that was never written about it. `REF-A12c` therefore carries explicit `licence` and
`licence_position` fields of its own. **Any future record whose provenance differs from the
blanket statement above must do the same** — the blanket is for the common case, not a default
to fall through.
