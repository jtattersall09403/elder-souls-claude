# Prompt for acquiring reference images (give this to Codex)

**Recommendation: use Codex, not ChatGPT deep research.**

Codex can clone the repo, fetch files, verify them, write the manifest, commit and push — the
images end up exactly where the tooling expects them, in one pass. Deep research returns prose
and links; someone would still have to download, verify, rename and commit every file by hand,
and the most likely failure mode (a plausible-looking image that is actually concept art, a
bullshot, or a modded render mislabelled as vanilla) is exactly what a link list makes hard to
catch.

**One caveat:** Codex's sandbox may have network restrictions of its own. Enable internet access
in the Codex environment settings before running. If it still can't reach image hosts, fall back
to: deep research produces a URL list → paste that list into the Codex prompt below in place of
the "find them" step.

---

## THE PROMPT — copy everything below this line

---

You are acquiring **reference screenshots** for a game project. These images are the *judging
standard*: automated critics will place our renderer's output side by side against them, blind
and unlabelled, and score us. Precision and honest labelling matter more than volume. Ten
correctly-identified images beat two hundred unverified ones.

**Repository:** `jtattersall09403/elder-souls-claude`
**Branch:** `claude/morrowind-souls-threejs-game-mou39v`
**Write everything under:** `corpus/70-visual/refs/`

### The project, briefly

A browser game: Morrowind's world, quests and dialogue with Dark Souls' combat, set in Black
Marsh (a swamp/marsh region of The Elder Scrolls). We judge our visuals along **two strictly
separated axes**, and mixing them up invalidates a judgement:

- **ART DIRECTION** — judged against **Morrowind (2002)**. Old graphics are *correct* here. We
  are matching its design language: muted palette, alien architecture, fungal/organic forms,
  the total absence of generic-fantasy stonework.
- **VISUAL FIDELITY** — judged against **current-generation games only** (Elden Ring, Skyrim
  Special Edition, Red Dead Redemption 2). This is texture resolution, lighting, shadows,
  atmospherics, foliage, water, anti-aliasing, material response.

**Never** put a Morrowind screenshot in the fidelity folder, and **never** put a modern AAA
screenshot in the art-direction folder. The folders are the enforcement.

### What to collect

Create two directories. Fill **every slot** below with **at least one** verified image; 2–3
alternates per slot is better (name them `-alt1`, `-alt2`).

#### `corpus/70-visual/refs/fidelity/` — modern only

| Slot ID | What it must show | Why we need it |
|---|---|---|
| `REF-M1` | **Elden Ring — Liurnia of the Lakes at dusk**, looking toward Raya Lucaria | Volumetric fog over reflective water, distant silhouettes, atmospheric depth |
| `REF-M2` | **Elden Ring — forest interior** (Mistwood or Weeping Peninsula treeline), mid-morning | Dense foliage, dappled light through canopy, geometric density |
| `REF-M3` | **Skyrim Special Edition — The Rift in autumn**, god rays through birches | Foliage colour, light shafts, mid-distance LOD |
| `REF-M4` | **Red Dead Redemption 2 — Bluewater Marsh or Lagras at dawn** | The closest AAA analogue to our setting: standing water, cypress, mist, wet ground |
| `REF-M5` | **Elden Ring — Siofra River**, bioluminescent underground | Emissive lighting in darkness, shadow detail retention |
| `REF-M6` | **Elden Ring — third-person character close-up**, armoured, 2–3 m from camera | Material response, cloth/metal shading, character model quality |
| `REF-M7` | **Skyrim SE — long vista with visible LOD** (Whiterun plains from a ridge) | Draw distance, terrain LOD, aerial perspective |

Requirements for this folder:
- **Actual gameplay captures, not press/promotional shots.** Marketing "bullshots" are often
  rendered at settings no player sees and would set a dishonest bar. If you can only find a
  promotional image, keep it but set `"promotional": true` in the manifest.
- Prefer **no HUD**, or minimal HUD (photo mode is ideal). If HUD is present, say so.
- **1920×1080 minimum.** Higher is better. Never upscale anything — record native resolution.
- PNG preferred; JPEG acceptable at quality ≥90. No heavy compression artefacts, no watermarks,
  no logos, no YouTube thumbnails, no borders, no collages.

#### `corpus/70-visual/refs/art-direction/` — Morrowind only

| Slot ID | What it must show |
|---|---|
| `REF-A1` | **Ascadian Isles or Bitter Coast exterior vista** — the classic Vvardenfell landscape |
| `REF-A2` | **Redoran architecture** — the giant crab/shell buildings (Ald'ruhn) |
| `REF-A3` | **Telvanni architecture** — the grown mushroom towers (Sadrith Mora / Tel Vos) |
| `REF-A4` | **An interior** — a Dunmer house, shop or temple, showing interior lighting and clutter |
| `REF-A5` | **An ash storm or weather event** in the Ashlands / Molag Amur |
| `REF-A6` | **A creature close-up** — cliff racer, netch, kwama, guar, silt strider |
| `REF-A7` | **A Dwemer ruin**, interior or exterior |
| `REF-A8` | **A town street scene** with NPCs — density and layout of a settlement |

**Critical for this folder: VANILLA ONLY.** The internet is full of heavily-modded Morrowind
screenshots with modern shaders, 4K texture packs and replaced meshes. Those are *useless* to us
here — worse than useless, because they would corrupt the art-direction reference with someone
else's art direction. Judge by eye: vanilla 2002 Morrowind has low-polygon models, 256px-era
textures, hard-edged shadows or none, and a distinctive washed palette. **If you cannot confirm
an image is vanilla, set `"vanilla_confidence": "low"` and say why.** OpenMW (the open-source
engine reimplementation) running vanilla assets is acceptable and should be marked
`"engine": "openmw-vanilla-assets"`.

### Verification — do not skip this

For every single image, **open it and look at it** before committing. Confirm:
1. It is an **in-game render**, not concept art, not box art, not fan art, not a painting, not
   an AI generation, not a map, not a mod-page banner.
2. It actually depicts **the game and the location claimed**. A file called
   `morrowind-vista.jpg` is frequently Oblivion, Skyrim, or an unrelated fantasy game.
3. It is the right **side** (art direction vs fidelity) for the folder it is in.

Anything you cannot verify: leave it out and record it in the "unfilled slots" section instead.
An honest gap is fine. A mislabelled image silently corrupts every future verdict that cites it.

### Deliverables

**1. The image files**, named `REF-M1__short-description.png` (double underscore separator), e.g.
`REF-M4__rdr2-bluewater-marsh-dawn.png`, `REF-A2__ald-ruhn-redoran-shells.png`.

**2. `corpus/70-visual/refs/MANIFEST.json`** — one record per image:

```json
{
  "id": "REF-M4",
  "path": "fidelity/REF-M4__rdr2-bluewater-marsh-dawn.png",
  "side": "modern-fidelity",
  "game": "Red Dead Redemption 2",
  "depicts": "Bluewater Marsh at dawn, mist over standing water, cypress silhouettes",
  "resolution": [2560, 1440],
  "format": "png",
  "source_url": "https://...",
  "source_page": "https://...",
  "author_or_uploader": "name or unknown",
  "capture_date": "2019-05 or unknown",
  "promotional": false,
  "has_hud": false,
  "modded": false,
  "vanilla_confidence": "high",
  "engine": "native",
  "licence_note": "Screenshot of a commercial game; publisher's copyright. Retained for internal comparison and critique only.",
  "sha256": "..."
}
```

Be honest in every field. `"unknown"` is a valid and respectable value. Do **not** invent a
source URL, an author, or a licence.

**3. `corpus/70-visual/refs/ACQUISITION-REPORT.md`** containing:
- A table of every slot: filled / unfilled, and for unfilled ones, exactly what you tried.
- The copyright position, stated plainly: these are screenshots of commercial games, held under
  their publishers' copyright, retained here solely for internal comparison and critique. Do not
  claim a licence that does not exist and do not apply an open-source licence to them.
- Any image you were **unsure** about and why — this list is genuinely valuable, so err toward
  over-reporting doubt.

### Commit

Commit to branch `claude/morrowind-souls-threejs-game-mou39v` with a message describing what was
acquired and what remains unfilled. Do not modify any file outside `corpus/70-visual/refs/`.

### Above all

Do not fabricate. Do not generate images. Do not describe an image you did not actually obtain.
Do not pad the manifest with entries whose files are absent. An empty slot honestly reported is a
success; an invented reference is a catastrophe, because every future visual verdict in this
project will cite these files as ground truth.
