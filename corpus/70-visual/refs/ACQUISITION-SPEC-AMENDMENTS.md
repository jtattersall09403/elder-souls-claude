# Acquisition spec — amendments (user direction, wave 0)

These **override** `docs/REFERENCE-IMAGE-REQUEST.md` where they conflict. They exist because the
original spec was written under a proxy that blocked nearly every image host, and it was
consequently stricter than it needed to be about what counts as usable.

## A1 — HUD is acceptable on modern fidelity references

**Superseded:** §5a's rule confining HUD-bearing images to `modern/hud/`, "kept, never compared".

**Now:** a HUD-bearing frame is a **first-class fidelity reference**. Game HUDs occupy screen
edges and corners; the lighting, materials, foliage, water and atmospherics we measure are in the
middle of the frame and are unaffected by an overlay.

Consequences, all binding:

1. HUD-bearing images live in their **profile folder**, not in `modern/hud/`. Set `"has_hud": true`.
2. **Critics must ignore the HUD** when judging fidelity, and must say so in the verdict.
3. **The metrics battery must mask it.** `tools/metrics/lib/vis03.mjs` gains a `HUD_MASK`:
   exclude a configurable border band (default: outer 12% on each edge) plus any detected
   high-saturation, high-contrast, temporally-static overlay region, from `FG_MASK` and from every
   band that consumes it. A HUD left unmasked inflates M4 edge density and M2 local contrast — so
   this amendment is **not free**, and until the mask exists, `has_hud: true` images are measured
   with a recorded caveat rather than silently.
4. **Still excluded:** frames where the HUD or a menu covers the *centre* of the image, and any
   frame whose subject is illegible behind an overlay.

## A2 — Menus and UI are wanted, on both sides

**Superseded:** the blanket exclusion of menu screenshots.

**Now they are a requirement, for two different reasons:**

- **Morrowind (art direction).** We are matching *all* of Morrowind's in-game UI and menu art
  direction — inventory, the dialogue topic list, the journal, the map, the character sheet,
  spellmaking, barter, the book reader, tooltips, the loading screens. `RI-A12` is currently
  filled by OpenMW's MyGUI layout XML, which gives structure and measurements but **no pixel of
  the original art** — no bevel, no sheen, no type, no populated density. Real screenshots of
  Morrowind's menus close that gap and are the highest-value art-direction acquisition left.
- **Modern (UI fidelity).** `RI-UIX06` proposes fidelity properties **F17–F19** (glyph raster
  fidelity, scaling/layout integrity, compositing correctness) which currently have **no reference
  population at all**. Modern menu and HUD captures — Elden Ring's inventory, Skyrim's menus, any
  current-gen equipment screen — are what those bands must be measured against.

New slots:

| Slot | Side | What |
|---|---|---|
| `REF-A12b` | morrowind-art | Morrowind menus and UI **as rendered**: inventory, topic list, journal, map, character sheet, spellmaking, barter, book reader. 2–3 each where obtainable |
| `REF-A20` | morrowind-art | Morrowind loading/splash screens and any full-screen framed art |
| `REF-M22` | modern-fidelity | Modern menu/inventory screens, ≥2 games — the reference population for F17–F19 |

`refs/modern/ui/` and `refs/morrowind/REF-A12b/` are the destination folders.

## A3 — The convergence rule (this is the important one)

**We do not own any of these games and cannot capture anything ourselves.** Every image is
whatever the internet happens to hold. A critic that keeps demanding an artifact nobody has
published will block this project forever, which is a worse outcome than a documented substitution.

So every coverage gap must be classified, and the classification decides what happens next:

| Class | Meaning | Resolution |
|---|---|---|
| **BLOCKING** | Obtainable with more effort, and nothing else substitutes | Keep trying. Name the specific search not yet run. |
| **SUBSTITUTABLE** | The exact artifact is unavailable, but a different one serves the same measurement | Substitute, record `substituted_for` and `deviation`, move on. |
| **INFERABLE** | No artifact serves it, but the bar can be met by reasoning from adjacent evidence | Record the inference, its basis, and its confidence. Downgrade the band's provenance to `derived`. |
| **IMPOSSIBLE** | Nothing published serves it and no inference is sound | Accept in writing, state the risk, and **lower or delete the bar that depended on it.** |

**A gap may not stay BLOCKING for more than three acquisition rounds.** On the fourth, it must be
reclassified into one of the other three. A bar with no obtainable reference is not a bar — it is a
permanent fail we inflicted on ourselves, and `RI-VIS03` already caps FIDELITY at 7 for exactly
this situation.

Worked example of the intended reasoning, from the user: *"we couldn't get an image at sunset"* →
**SUBSTITUTABLE**: use sunrise, which is the same low-sun geometry, and record the deviation. If
sunrise is also unavailable → **INFERABLE**: measure the daylight population and apply known
low-sun colour-temperature and extinction shifts, recording it as `derived`. Only if that reasoning
is itself unsound is the slot **IMPOSSIBLE**.

## A4 — Breadth beats depth

Where effort must be traded, **coverage breadth wins**. Twelve profiles at their floor with two
games each is worth more than two profiles at triple depth, because the bands are per-profile and a
profile with no population cannot be calibrated at all. The `min distinct games` requirement stands
— a single game's art director is not a population — but it may be met at **2** rather than 3 where
3 proves unobtainable, recorded as a deviation.
