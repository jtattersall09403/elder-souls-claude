# Brief: mine the UESP extract; upgrade provenance from recall to measurement

The user supplied a genuine primary source the corpus has been missing: `corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` (3.4MB, **6,299 pages** of raw UESP wikitext). Read `corpus/README.txt` first — it documents the extraction precisely.

Format: one JSON object per line, `{"title","ns","region","text"}`, region ∈ {Morrowind, BlackMarsh}.
- **Morrowind (4,961)**: Morrowind/Tribunal/Bloodmoon namespaces in full, plus 822 filtered Lore pages.
- **BlackMarsh (1,338)**: ESO Shadowfen + Murkmire (1,151 — places, quests, NPCs, creatures, items), 160 Lore pages (the Hist, Shadowscales, Kothringi, Knahaten Flu, Green Pact), 25 Stormhold, 2 Arena.
- Raw wikitext, templates intact — **infoboxes carry the structured numbers**. Dialogue sections were stripped (we have those separately).

`xz -dc` into **/tmp only** — never decompress into the repo; disk is a fixed allowance.

## Why this matters
Nearly every Morrowind/Black-Marsh figure in the corpus is `provenance: canonical-recall, confidence: medium` because UESP was unreachable. Several items state what a future pass should re-derive. **You are that pass.** Read the `## Provenance note` sections of: RI-LOR01/02/04, RI-QST01/03/05/07/08, RI-WLD03/05/08, RI-PRG03/05.

## Deliverables
1. **`tools/uesp/`** — reusable toolkit: `uesp-query.mjs` (search by title/ns/region/regex), `uesp-infobox.mjs` (parse `{{Template|k=v}}` into JSON — this unlocks everything else), `uesp-stats.mjs` (aggregations), `README.md`. Verify each runs.
2. **`corpus/60-lore/data/blackmarsh-canon.json`** — the big win. Mine the 1,338 BlackMarsh pages into structured canon: places (name, zone, type, description), creatures, NPCs, factions, flora, items/materials, lore facts with source page. Cross-check against the existing recall-based `canon-facts.json` and **report every contradiction** — contradictions are the most valuable output.
3. **`corpus/60-lore/data/argonian-names.json`** — every Argonian personal/place name and Jel-derived word from both regions plus `argonian-dialogue-corpus.json`. Use it to validate or correct the constructed phonology in `jel-lexicon.json`. Report whether the constructed phonotactics actually match real Argonian naming.
4. **`corpus/30-quests/data/morrowind-quest-census.json`** — quest name, questline, stages, combat-required?, rewards, prerequisites. Then compute what **RI-QST05 explicitly owes**: the real approximate fraction of Morrowind quests completable without killing, and RI-QST03's real per-rank faction advancement requirements. These are the corpus's most-flagged debts.
5. **`corpus/50-world/data/morrowind-world-census.json`** — settlement pages mined for building counts, services, named NPCs, interiors, to validate RI-WLD03's targets against Morrowind's actual towns.
6. **`corpus/00-doctrine/PROVENANCE-UPGRADE-01.md`** — per item: the figure claimed, its stated provenance, **what the real source says**, and confirmed / needs-amendment / contradicted, with exact amendment text where wrong. Do NOT edit others' items. List debts you could not settle and why.

## Care
ESO's Shadowfen/Murkmire is a **later** game's take (Second Era) and our game is late Third Era — some ESO content is anachronistic for us. Where ESO and Morrowind-era sources conflict, say so and flag for a ruling rather than silently picking one. All output is `community-data` (UESP editors' transcription); your arithmetic is yours. Never upgrade an inference to "measured".
