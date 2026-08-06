# Brief: the acquisition-code loop (critic ↔ builder ↔ scout)

## What exists

Codex pushed working acquisition code — it cannot push binaries, so it pushed the means instead:

- `corpus/70-visual/refs/acquire.py` — reads `_provenance.json`, streams each source, verifies
  byte length and SHA-256, atomically renames, never decodes or re-encodes. **The mechanism is
  correct and must be preserved.**
- `corpus/70-visual/refs/_provenance.json` — 211 catalogued entries (165 in-container + 46 Codex).
- `ACQUIRE-README.md`, `requirements.txt`, `make-manifest.py`.

Codex's 46 are **all Elden Ring**, from Steam upload pages.

## The governing documents

1. `docs/REFERENCE-IMAGE-REQUEST.md` — the full spec (folders, floors, integrity, manifest).
2. **`corpus/70-visual/refs/ACQUISITION-SPEC-AMENDMENTS.md` — READ THIS SECOND AND OBEY IT WHERE
   IT CONFLICTS.** It relaxes the HUD rule, makes menus and UI a *requirement* on both sides, and
   defines the **convergence rule** that stops this loop running forever.
3. `corpus/70-visual/RI-VIS02` (slots), `RI-VIS03` (the twelve metrics and their profiles),
   `RI-VIS05` (art direction), `RI-UIX06` (F17–F19, which have no reference population at all).

## Known coverage state

| Profile | Floor | Have | Gap |
|---|---|---|---|
| `exterior_daylight` | 12, ≥3 games | 10, 1 game | count + **games** |
| `exterior_lowlight` | 12, ≥3 games | 11, 1 game | count + **games** |
| `interior_darkemissive` | 10, ≥2 games | 8, 1 game | count + **games** |
| `character_closeup` | 10, ≥2 games | 11, 1 game | **games** |
| `combat` | 8, ≥2 games | 2, 1 game | large |
| `material_closeup` | 8, ≥2 games | 0 | **empty** |
| `modern/ui` (new, A2) | — | 0 | **empty** |
| `video/` | 2 required | 0 | **empty** |
| `context/` | 4 | 0 | empty |
| `morrowind/REF-A12b` (new, A2) | — | 0 | **empty — highest-value art gap** |
| `morrowind/` others | 2–3 per slot | 89 across 19 slots | largely met |

## The loop

Three roles, run to convergence:

**CRITIC** — judges whether the *code* would acquire enough breadth. Not whether it is elegant:
whether running it produces a reference set that satisfies `RI-VIS03`'s per-profile bands and
`RI-VIS05`'s art-direction needs. Must classify every gap **BLOCKING / SUBSTITUTABLE / INFERABLE /
IMPOSSIBLE** per amendment A3, and must name, for each BLOCKING gap, **the specific search not yet
run**. A critic that says "get more images" without naming a source has failed.

**BUILDER** — extends `acquire.py` and `_provenance.json` against the critic's feedback. Preserves
the integrity mechanism exactly. Adds sources, profiles, the new UI slots, and whatever
discovery the critic asks for. Must keep `--check` honest.

**SCOUT** — when the critic and builder deadlock on a gap, thinks laterally about *what else could
serve the same measurement*. This role exists so the loop can terminate: its job is to convert
BLOCKING into SUBSTITUTABLE. Examples of the move: a sunset shot is unavailable → sunrise has the
same low-sun geometry; a material close-up is unavailable → a photo-mode shot cropped by the
*photographer* (not by us) at the same subject distance; Morrowind menus are unavailable from
screenshot repos → mod showcase pages, YouTube thumbnails, review articles, the Construction Set,
OpenMW's test suite, Internet Archive captures of 2002-era fan sites.

## Convergence — non-negotiable

- **Maximum three rounds.** On round four every remaining gap must be classified
  SUBSTITUTABLE, INFERABLE or IMPOSSIBLE — never BLOCKING.
- A gap classified IMPOSSIBLE requires a written acceptance naming **which bar must be lowered or
  deleted**, because a bar with no obtainable reference is a permanent self-inflicted fail.
- Breadth beats depth (A4). Twelve profiles at floor beats two at triple depth.
- The `≥3 distinct games` requirement may fall to **2** where 3 is unobtainable, recorded as a
  deviation. It may never fall to 1 — one game's art director is not a population.

## Deliverables

- Updated `acquire.py` + `_provenance.json` covering every profile that can be covered.
- `corpus/70-visual/refs/ACQUISITION-CODE-CRITIQUE.md` — the round-by-round record: what the critic
  demanded, what the builder did, what the scout substituted, and the final classification table.
- Every source recorded with its licence position; no fabricated URLs; the integrity mechanism
  intact.
