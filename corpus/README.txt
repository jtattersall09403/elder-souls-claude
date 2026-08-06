UESP Data Extract — Morrowind + Black Marsh
=============================================
Source: uespwiki-2019-11-07-current_xml.bz2 (full UESP wiki dump, 255,636 pages)
Output: uesp_morrowind_blackmarsh_extract.jsonl
        One JSON object per line: {"title", "ns", "region", "text"}
        "region" is "Morrowind" or "BlackMarsh" so you can filter/split easily.

6,299 pages total (4,961 Morrowind + 1,338 Black Marsh), ~3.4MB compressed.

MORROWIND SCOPE (unchanged from last time):
- Morrowind, Tribunal, Bloodmoon namespaces in full (minus redirects): 4,139 pages
- Lore namespace, filtered to Morrowind-relevant topics (races, houses,
  religion, history, artifacts, key figures): 822 pages

BLACK MARSH SCOPE (new):
- Stormhold namespace in full: 25 pages — this is "The Elder Scrolls Travels:
  Stormhold," a mobile spin-off game actually set in Black Marsh (prison-break/
  dungeon-crawl in the ruined city of Stormhold). Small but genuinely on-topic.
- Online (ESO) namespace, filtered to the Black Marsh zones — Shadowfen and
  Murkmire: 1,151 pages. This is the closest thing to "game systems" data for
  the region, since no mainline single-player TES game is set there — places,
  quests, NPCs, creatures, items, sets, achievements tagged to those zones.
  Filter logic: pages tagged `zone=Shadowfen`/`zone=Murkmire`, pages carrying
  the Murkmire DLC header template, or categorized under Shadowfen/Murkmire/
  Argonia in the wiki.
- Lore namespace, filtered to Black Marsh/Argonian topics (history, the Hist,
  Shadowscales, Argonian culture and religion, Kothringi, Knahaten Flu, the
  Green Pact, etc.): 160 pages
- Arena namespace: 2 pages (the original 1994 game's minimal Black Marsh
  entries — Arena predates most established lore, so there isn't much here)

NOTE: no ESO Blackwood chapter content (that DLC released in 2021; this dump
is from Nov 2019, so it only has base-game Shadowfen + the Murkmire DLC zone).

EXCLUDED (same rules as before, applied to both regions):
- Other games' namespaces not tied to either region
- Talk/discussion namespaces, redirect pages, files, templates, categories,
  user pages
- ==Dialogue== / ==Unique Dialogue== / ==Quest-Related Dialogue== sections
  (stripped — you already have dialogue extracted separately). Everything
  else on those pages (stats, quests, notes, location) is kept.
- <noinclude>...</noinclude> maintenance/cleanup template blocks

Text is left as raw wikitext (templates and links intact) since infobox
templates carry structured stats (weight, value, enchantments, zone, level,
etc.) useful for systems/items work.
