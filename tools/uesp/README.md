# `tools/uesp/` — UESP extract toolkit

Reusable tooling over `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` (6,299 pages of raw
UESP wikitext: 4,961 Morrowind-region, 1,338 Black-Marsh-region; see `corpus/README.txt` for
the extraction rules). This is the corpus's only **primary-ish** source for Morrowind and
Black Marsh figures — everything else in `corpus/` is `canonical-recall` or search snippets.

## Disk rule

The extract decompresses to ~20 MB. **Decompress to `/tmp` only, never into the repo.**
Every tool here does that for you:

```
xz -dc corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz > /tmp/uesp/extract.jsonl
```

Path resolution: `--extract <path>` → `$UESP_EXTRACT` → `/tmp/uesp/extract.jsonl` →
auto-decompress the repo `.xz` into `/tmp/uesp/`. No tool ever writes inside `corpus/`.

## Provenance rule

Anything these tools report is **`community-data`** — UESP editors' transcription of Bethesda's
shipped content, as of the 2019-11-07 dump. Arithmetic *over* that data (fractions, means,
medians) is **`derived`**, and must be labelled as ours. Nothing here is `measured`: we did not
read the game's ESM files. Do not upgrade a UESP figure to `measured` because a tool printed it.

---

## `uesp-infobox.mjs` — the parser everything else stands on

UESP keeps its structured data in `{{Template|key=value}}` infoboxes. This parses them properly:
balanced-brace matching, so a `|` inside `[[Link|display]]`, inside a nested `{{Tpl|a|b}}`, or
inside a `{| wikitable |}` never splits a parameter, and only the *first depth-0* `=` names a key.
A regex cannot do this; several UESP infoboxes nest three deep.

```bash
node tools/uesp/uesp-infobox.mjs --title "Morrowind:The Code Book" --template "Quest Header"
node tools/uesp/uesp-infobox.mjs --template "Quest Header" --field Reward --limit 20
node tools/uesp/uesp-infobox.mjs --template "Morrowind Town Table" --count
```

Library exports:

| export | purpose |
|---|---|
| `loadExtract(path?)` | `[{title, ns, region, text}]`, cached per process |
| `parseTemplates(text, {deep})` | all templates → `{name, params, positional, raw, start, end}` |
| `findTemplate(text, name)` / `findTemplates` | one / all by name |
| `sections(text)` | `{ "Heading": "body" }` from `== headings ==` |
| `wikitables(text)` | `{| … |}` → arrays of row-cell arrays (rank tables, member tables) |
| `links(text)` | `[[A\|B]]` → `[{target, display}]` |
| `stripWiki(text)` | lossy wikitext → prose |

## `uesp-query.mjs` — find pages

```bash
node tools/uesp/uesp-query.mjs --ns Online --region BlackMarsh --list --limit 20
node tools/uesp/uesp-query.mjs --title-re "^Morrowind:.*Guild$" --list
node tools/uesp/uesp-query.mjs --re "xanmeer" --region BlackMarsh --context 120
node tools/uesp/uesp-query.mjs --has-template "Morrowind Town Table" --list
node tools/uesp/uesp-query.mjs --title "Morrowind:Balmora" --sections
node tools/uesp/uesp-query.mjs --title "Morrowind:Balmora" --prose | head -40
```

`--count` prints just the number; `--text` / `--prose` / `--sections` dump a page.

## `uesp-stats.mjs` — aggregate

```bash
node tools/uesp/uesp-stats.mjs overview
node tools/uesp/uesp-stats.mjs templates --region BlackMarsh --limit 40
node tools/uesp/uesp-stats.mjs fields "Quest Header"     # which params exist, how often
node tools/uesp/uesp-stats.mjs values "Quest Header" Reward --limit 30
node tools/uesp/uesp-stats.mjs pages-with "Morrowind Town Table"
node tools/uesp/uesp-stats.mjs grep "without killing" --region Morrowind
node tools/uesp/uesp-stats.mjs sizes --region BlackMarsh
```

## Landmark templates (found by `uesp-stats.mjs templates`)

| template | n | carries |
|---|---|---|
| `Quest Header` | 489 | `Giver, Reward, Disp, Rep, ID, Prev, Next, Loc, ReqRank, Difficulty, SuggLevel, description` |
| `Journal Entries` | 510 | quest journal stage tables (index + text) |
| `NPC Summary` | 1,496 | per-NPC race/class/level/faction/location |
| `Morrowind Town Table` | 40 | settlement services, travel links, alignment, region |
| `Faction Summary` | 27 | faction HQ, leaders, favoured skills/attributes, reactions |
| `Online NPC Summary` | 548 | ESO NPCs (Shadowfen/Murkmire) |
| `Online Place Summary` | 193 | ESO places (zone, type) |
| `Lore Entry` | 834 | Lore-namespace structured entries |

## Derived datasets produced with this toolkit

| file | what |
|---|---|
| `corpus/30-quests/data/morrowind-quest-census.json` | all 489 quest pages: questline, stages, kill-requirement classification, rewards, rank gates |
| `corpus/50-world/data/morrowind-world-census.json` | 40 settlements: services, interiors, named NPCs, travel |
| `corpus/60-lore/data/blackmarsh-canon.json` | Black Marsh places/creatures/NPCs/factions/flora/lore facts with source page |
| `corpus/60-lore/data/argonian-names.json` | attested Argonian names + Jel words from both regions |
| `corpus/00-doctrine/PROVENANCE-UPGRADE-01.md` | per-item audit: claimed figure vs. what the source actually says |

The generator scripts live beside the tools as `mine-*.mjs` so every dataset is reproducible:

```bash
node tools/uesp/mine-quests.mjs        # → corpus/30-quests/data/morrowind-quest-census.json
node tools/uesp/mine-world.mjs         # → corpus/50-world/data/morrowind-world-census.json
node tools/uesp/mine-blackmarsh.mjs    # → corpus/60-lore/data/blackmarsh-canon.json
node tools/uesp/mine-argonian-names.mjs# → corpus/60-lore/data/argonian-names.json
```
