---
id: RI-LOR01
title: Black Marsh and Argonian canon dossier — what we may not contradict, and where we must invent
kind: text
side: morrowind
judges: [lore.canon, lore.hist, lore.factions, lore.history, world.settlements, quests.main, quests.factions, dialogue.claims, books.content]
provenance: canonical-recall
confidence: medium
blind_pair: no
---

## The bar

A builder writing a line of dialogue, a book, a place name, or a quest premise must be able to
open this file, find the claim they are about to make, and learn in under thirty seconds whether
that claim is (a) **hard canon** they may not contradict, (b) **soft or apocryphal canon** they
may take a side on, or (c) **open ground** where invention is not merely permitted but *required*,
because this game needs an original main quest and original factions and cannot get them by
retelling Bethesda's plots. The bar is Morrowind's own relationship to its lore: the game never
contradicted the established shape of Dunmer history, but almost every *specific* character,
faction rank, quest, ruin, and book in Vvardenfell was invented for that game. We must be able to
say the same. The failure state is not "we invented too much" — it is "we invented something that
makes the Hist not the Hist," or "we invented nothing and shipped a Black Marsh tourist brochure."

## The reference artifact

### 0. How to read the tiers

| Tier | Meaning | Builder permission |
|---|---|---|
| `hard-canon` | Stated repeatedly and consistently across shipped Bethesda/ZOS material. | **Never contradict.** May be dramatised, doubted *by an in-world speaker*, or shown from a hostile angle — but the authorial world model obeys it. |
| `soft-canon` | Stated once, or stated only by a named in-world source of dubious reliability, or era-scoped. | May be taken as true, denied, or complicated. Must be *deliberate*: log the choice in `canon-facts.json`. |
| `apocryphal` | Comes from a source the series itself marks unreliable (Pocket Guide 1st ed., Imperial propaganda, hearsay). | Treat as an in-world *opinion*, never as narration. Excellent material for NPCs who are wrong. |
| `open` | Canon is silent or explicitly vague. | **Invent here.** This is where our main quest, our factions, and our named characters must live. |
| `constructed` | Our invention, recorded so it becomes binding on us. | Binding once written. Contradicting our own construction is as much a failure as contradicting Bethesda's. |

Confidence is about *our recall/verification*, not about the fiction: `high` = verified this session
against a live source snippet or recalled from direct play of the shipped games; `medium` = confident
recall, unverified; `low` = hazy, treat as soft even if it is probably hard.

### A. The Hist

| ID | Claim | Tier | Conf. | Where it comes from |
|---|---|---|---|---|
| CF-001 | The Hist are giant sentient spore-trees native to Black Marsh, growing chiefly in the interior swamps. | hard-canon | high | UESP *Lore:Hist*; PGE 3rd ed. describes "a species of giant spore tree… speculation as to whether the natives worship them or whether the trees are themselves a sentient race" (search snippet, 2026-08-05) |
| CF-002 | Argonian hatchlings drink Hist sap at hatching; the sap is what gives the hatchling its soul. | hard-canon | high | UESP *Lore:Hist*, *Lore:Hatching Pools* (snippet) |
| CF-003 | When an Argonian dies its soul returns to its Hist and is held there; it may be issued again to a later hatchling. | hard-canon | high | UESP *Lore:Hist* (snippet) — **the single most load-bearing fact in this corpus.** See RI-LOR05. |
| CF-004 | The Hist shapes Argonian bodies. It decides what hatches: the marsh-forms, the Naga-forms, and (in emergency) purpose-built forms. | hard-canon | medium | Recurrent across ESO Murkmire and *Lore:Argonian*; the Hist is described as reshaping Argonians to meet need |
| CF-005 | Hist sap can carry the Hist's communication — visions, instruction, summons — to an Argonian who licks or drinks it. | hard-canon | high | UESP *Lore:Hist Sap* (snippet) |
| CF-006 | Hist sap taken by a **non-Argonian** is a hallucinogen and drives the drinker to bloodlust; the drinker may not perceive what they are killing. | hard-canon | high | Oblivion, *Infiltration* / Blackwood Company (snippet). **Our Sap-Taint system rests entirely on this.** |
| CF-007 | Hist sap increases the combat prowess of those who drink it; Argonian shamans use it ritually. | hard-canon | high | UESP *Lore:Hist Sap*, *Oblivion:Blackwood Company* (snippet) |
| CF-008 | Individual Hist trees exist and are attached to individual settlements/tribes; "the Hist" is also spoken of as a singular mind. | soft-canon | high | Both usages appear. Canon does not adjudicate. **Disputed entry CF-D004; we resolve it.** |
| CF-009 | Hist trees can go rogue, dissent, or be severed from the others (the Lilmoth Hist, 4E). | soft-canon | medium | *Lore:An-Xileel* — a "rogue Hist tree of Lilmoth" contacted Umbriel in 4E 48 (snippet). Era is later than ours; the *capacity* is what we borrow. |
| CF-010 | The Hist claim the Void is "where all roots lead" and that they rejoin it; they speak of "Songs of Sithis" they may invoke as vengeance. | soft-canon | high | UESP *Lore:Sithis* / *Lore:Hist* (snippet). Attributed to the Hist themselves — i.e. in-world testimony, not narration. |
| CF-011 | The Hist withdrew Argonians from the Oblivion Crisis and organised a devastating counter-invasion of the Deadlands. | hard-canon | high | *Lore:An-Xileel* (snippet). 3E 433+, **after our era.** Establishes that the Hist can act at continental scale when it chooses. |
| CF-012 | Hist trees were burned/killed by invaders in the past (Akaviri, others) and the Argonians remember it. | soft-canon | medium | Recalled from ESO/PGE material; treat as soft |
| CF-013 | **Open:** what the Hist *wants*, moment to moment, in an ordinary decade with no crisis. Canon never says. | open | — | **Primary invention space for our main quest.** |
| CF-014 | **Open:** whether the Hist can be injured, starved, poisoned, or made to forget — and what that does to the souls it holds. | open | — | **This is where our main quest lives.** See RI-LOR05 §The Rootward Tide. |

### B. Argonians: body, tribe, name

| ID | Claim | Tier | Conf. | Source |
|---|---|---|---|---|
| CF-020 | Argonians are reptilian beast-folk native to Black Marsh; they breathe water and resist disease. | hard-canon | high | All games |
| CF-021 | Argonians hatch from eggs, in hatching pools attached to a Hist. | hard-canon | high | *Lore:Hatching Pools* (snippet) |
| CF-022 | **Jel** is the Argonian root-tongue. It runs on idiom and metaphor and is close to untranslatable without knowing Black Marsh culture and geography. Compounds (adj+noun, noun+noun) are its main word-formation. | hard-canon | high | UESP *Lore:Jel*, *The Sharper Tongue: A Jel Primer* (snippet) |
| CF-023 | Argonians carry two name systems: Jel names, and Tamrielic ("Cyrodilic") names that are often direct translations of the Jel. | hard-canon | high | UESP *Lore:Argonian Names* (snippet) |
| CF-024 | Hyphenated Tamrielic names can encode gender via the possessive: *Lifts-Her-Tail* (f), *Hides-His-Eyes* (m). | hard-canon | high | UESP *Lore:Argonian Names* (snippet) |
| CF-025 | Sample real Jel roots: *beeko* = friend; *deelith* = teacher/one who passes wisdom; *ku-vastei* = needed change; *xanmeer* = "stone-nest"; *lukiul* = assimilated Argonian; *kaoc* = curse/expletive; *thtithil* ≈ egg. | soft-canon | medium | *The Sharper Tongue: A Jel Primer*, *Lore:Shadowscales*, *Lore:Ixtaxh Xanmeer* (snippets). Glosses reproduced from summaries, not from the primary text — treat as medium. |
| CF-026 | **Naga** are a scaled, serpentine Argonian form; Imperial sources call Naga "thugs" and blame them for banditry. | hard-canon (existence) / apocryphal (the slur) | high | *Lore:Naga*; PGE 3rd ed. "Argonian 'Naga' thugs" (snippet) — **that phrasing is Imperial contempt and we should show it as such.** |
| CF-027 | Named Argonian tribes/peoples exist beyond the Naga (Agacephs, Paatru, Sarpa, Kothringi, Lilmothiit, Dead-Water, Blackrose-folk etc.). Canon lists names far more often than it details them. | hard-canon (names) / open (contents) | medium | PGE 1st ed. tribe list; ESO Murkmire tribes | 
| CF-028 | Argonians born under the sign of the Shadow are taken at birth and given to the Dark Brotherhood, trained as **Shadowscales**; survivors to adulthood become full Brotherhood members. | hard-canon | high | UESP *Lore:Shadowscales* (snippet) |
| CF-029 | Shadowscales may leave the Brotherhood to serve Black Marsh as **ku-vastei** — "agents of needed change," arbiters who act with impunity — and some serve the Argonian royal court. | hard-canon | high | UESP *Lore:Shadowscales* (snippet). **This is a ready-made quest-giving institution and we should use it.** |
| CF-030 | Shadowscales carry brass medallions bearing the likeness of Sithis; breaking a tenet is treason, punished by execution ordered through the Argonian royal court. | soft-canon | medium | *Lore:Shadowscales* (snippet) |
| CF-031 | *Lukiul* — Argonians raised outside the marsh or inside Imperial towns, "assimilated" — are a real and resented category. | hard-canon | medium | ESO Murkmire usage |
| CF-032 | Argonian speech in Tamrielic is not "hissing lizard": it is metaphor-forward, oblique, indirect about time, and often addresses in the third person. | soft-canon | medium | Consistent in-game portrayal | 
| CF-033 | **Open:** Argonian domestic life — how a marsh village eats, counts, mourns, marries, argues, divides labour. Canon is nearly silent. | open | — | **Furnish this. See RI-LOR07.** |
| CF-034 | **Open:** the internal politics of the tribes in the late Third Era. Canon gives no named tribal leaders for 3E 427. | open | — | **Our faction space.** |

### C. Deep time and history

| ID | Claim | Tier | Conf. | Source |
|---|---|---|---|---|
| CF-040 | **Duskfall** is the catastrophe that ended the ancient high Argonian civilisation. Knowledge lost at Duskfall includes how the xanmeers were built. | hard-canon | high | *Lore:Xanmeer* (snippet) |
| CF-041 | **Xanmeers** ("stone-nests") are pre-Duskfall Argonian ziggurats: stepped stone pyramids, often in symmetrical complexes joined by elevated stone walkways, carved with geometric patterns and images of the ancient Argonians. Many are sunken or buried. | hard-canon | high | *Lore:Xanmeer*, *Lore:Ixtaxh Xanmeer* (snippets) |
| CF-042 | Many xanmeers are identified as shrines "in both reverence to and fear of Sithis"; the purpose of many is lost. | soft-canon | high | *Lore:Xanmeer* (snippet) |
| CF-043 | Xanmeer names are Jel compounds, e.g. *Ixtaxh-Thitithil-Meht* ≈ "Exact Egg-Cracker." | hard-canon | high | *Lore:Ixtaxh Xanmeer* (snippet). **Naming template for our ruins.** |
| CF-044 | The **Ruddy Man** is a figure of ancient Black Marsh legend associated with the deep past and with a stone/ruddy body. | soft-canon | **low** | Recalled, unverified this session. **Treat as soft at most. Do not build load-bearing plot on it without re-verification.** |
| CF-045 | The **Knahaten Flu** began in Stormhold in 2E 560 and ran 41 years to 2E 601. | hard-canon | high | *Lore:Knahaten Flu* (snippet) |
| CF-046 | The Flu drove the **Kothringi** and the **Lilmothiit** to extinction; Argonians were unaffected. | hard-canon | high | (snippet) |
| CF-047 | The Kothringi were silver-skinned humans native to Black Marsh, of Nedic descent, notable sailors, possibly the vector that spread the Flu abroad. | hard-canon | high | *Lore:Kothringi* (snippet) |
| CF-048 | **Disputed in canon:** the Flu's origin. One account blames an Argonian shaman who "manipulated their cherished spore-trees" in revenge; another says natural causes. Canon does not adjudicate. | soft-canon (disputed) | high | (snippet) — **canonical proof that TES leaves contradictions standing. Registry entry CF-D005.** |
| CF-049 | A small number of Kothringi survived the Flu "through unnatural means." | soft-canon | medium | (snippet). **Open hook: a surviving Kothringi in 3E 427 is legitimate and strange.** |
| CF-050 | **Blackrose** — the worst of the Imperial prisons — was built by Potentate Versidae-Shae on the ruins of a Lilmothiit settlement called Blackrose. | soft-canon | medium | Recalled + snippet corroboration |
| CF-051 | Tiber Septim conquered Black Marsh into the Empire in the late Second Era; conquest of the *interior* was never really achieved. | hard-canon | high | PGE 3rd ed. framing |
| CF-052 | **Open:** everything that happened in Black Marsh between roughly 3E 400 and 3E 427. Canon is blank. | open | — | **Our story's runway.** |

### D. The Empire, the Dunmer, the mercenaries

| ID | Claim | Tier | Conf. | Source |
|---|---|---|---|---|
| CF-060 | The Empire holds the **coasts** of Black Marsh and uses the interior for dungeons; the heart of the province "remains the sole province of the reptilian Argonians." | hard-canon | high | PGE 3rd ed. (snippet) |
| CF-061 | Imperial control is administrative and nominal: garrisons, tax factors, prisons, a governor's office, and no ability to project force into the interior. | hard-canon | high | PGE 3rd ed. |
| CF-062 | **House Dres** of Morrowind has raided Black Marsh for slaves for centuries; "entire tribes of Argonians were dragged in chains to the Dunmer land." Slavery remained legal in Morrowind until late in the Third Era. | hard-canon | high | (snippet) — **at 3E 427 it is still legal. This is the live wound.** |
| CF-063 | Argonians hate the Dunmer for it, generationally and specifically. | hard-canon | high | All games |
| CF-064 | The **Blackwood Company** is a mercenary outfit based in Leyawiin, mostly Khajiit and Argonians, which takes contracts the Fighters Guild will not, screens no one, and secretly dopes its members on Hist sap from a stolen Hist kept in its hall cellar. | hard-canon | high | *Lore:Blackwood Company*, *Oblivion:Infiltration* (snippets) |
| CF-065 | The Blackwood Company is documented active in **3E 433** (Oblivion). Canon does not state a founding date. | soft-canon | high | Shipped-game era |
| CF-066 | **Open / constructed:** a Blackwood Company presence in Black Marsh in 3E 427, as a younger, hungrier outfit that has not yet secured the Leyawiin hall — i.e. one that is *in the marsh looking for a Hist to steal*. | constructed | — | **Marked constructed. Do not let an NPC call this canon.** Registry CF-C002. |
| CF-067 | The **An-Xileel** form during the Oblivion Crisis (3E 433+) and are a *later* phenomenon than our era. | hard-canon | high | *Lore:An-Xileel* (snippet) |
| CF-068 | **Open / constructed:** a pre-An-Xileel isolationist current in 3E 427 — the sentiment without the party — from which the An-Xileel later crystallises. | constructed | — | Registry CF-C003. Lets us have the politics without breaking the timeline. |
| CF-069 | **Gideon** is the most Imperialised city of Black Marsh, in Blackwood near the Cyrodiil border. | hard-canon | medium | Arena/Daggerfall-era geography + map source |
| CF-070 | Legion presence in the province in 3E 427 is thin because the Empire's attention and reserves are in Vvardenfell/Morrowind. | constructed | — | Registry CF-C001. Plausible, unverified, ours. |
| CF-071 | ⚠ **Contamination warning.** Claims found in this session's search results describing Gideon as "ruled by a Root-Assembly" and Blackrose as "an Argonian stronghold governed by a Warden-Brood" came from an AI-generated worldbuilding site (fables.gg), **not from canon.** They are rejected. | — | high | Logged so no later agent re-imports them. |
| CF-072 | **Open:** who specifically governs each settlement in 3E 427. Canon names no officials. | open | — | **See RI-LOR02 for our answer.** |

### E. Places (all confirmed against `corpus/50-world/black-marsh-map-source.jpg`)

| ID | Place | Tier | Note |
|---|---|---|---|
| CF-080 | **Lilmoth** — far south, coastal, rotting, described in later canon as "festering jewel of the south." | hard-canon | Our southern port. |
| CF-081 | **Soulrest** — south-west coast, beside the **Stone Wastes**. | hard-canon | Name is a gift: build the soul-metaphysics here. |
| CF-082 | **Blackrose** — south-central, the prison. | hard-canon | |
| CF-083 | **Gideon** — west, on the Cyrodiil border in Blackwood. | hard-canon | |
| CF-084 | **Stormhold** — north, at the foot of the Morrowind mountains; origin of the Knahaten Flu. | hard-canon | |
| CF-085 | **Thorn** — north-east. | hard-canon | |
| CF-086 | **Archon** — east coast. | hard-canon | |
| CF-087 | **Helstrom** — deep centre, the interior seat. *(Map renders it in an uncial face where H reads as b; it is Helstrom.)* | hard-canon | The interior capital. Hardest to reach. |
| CF-088 | Regions named on the map: **Valus Ridge, Blackwood, The Hive, Marauder's Coast, Stone Wastes, Western Rootlands, Eastern Rootlands, The Deep Marshes, The Stone Forest, The Clay Moor, Crimson Coast**; waters: **Topal Bay**, **Padomaic Ocean**. | hard-canon (this project) | **These names are binding. No builder may rename or "improve" them.** |
| CF-089 | The interior is functionally impassable to outsiders: no roads, shifting water, disease, and navigation by knowledge no foreigner has. | hard-canon | high — the map's dotted tracks stop at the coasts |
| CF-090 | **Open:** every settlement below city scale. The map shows eight settlements and two unlabelled ruin icons for a province the size of Cyrodiil. | open | **Every village, camp, xanmeer, and stilt-town between them is ours to invent.** |

### F. The invention space, stated positively

Canon leaves these doors open, and our game is *required* to walk through them:

1. **What the Hist wants in a quiet decade** (CF-013) and **whether the Hist can be wounded** (CF-014) → the main quest.
2. **The whole of 3E 400–427 in Black Marsh** (CF-052) → our recent history, our grievances, our war.
3. **Tribal politics with no canonical leaders** (CF-034) → our factions.
4. **Every sub-city settlement** (CF-090) → our world.
5. **Argonian domestic life** (CF-033) → our strangeness (RI-LOR07).
6. **A pre-An-Xileel isolationist current** (CF-068) and **a young Blackwood Company** (CF-066) → two antagonist factions that are canon-compatible and wholly ours.
7. **A surviving Kothringi** (CF-049) → one impossible person, which Morrowind would absolutely have done.

And these doors are **shut**:

- The Hist is not a metaphor, not a hive-mind of dryads, not evil, and not defeatable by killing one tree.
- Argonians did not build the xanmeers *after* Duskfall, and no living Argonian knows how they were built.
- No An-Xileel party exists in 3E 427.
- No Oblivion Crisis, no Umbriel, no Nerevarine arriving in Black Marsh.
- Slavery is not abolished; the Dres raids are current events, not history.
- The Empire does not control the interior and cannot be made to.

## Comparison method

A critic judging any piece of lore-bearing content (`books.content`, `dialogue.claims`, `quests.main`,
`world.settlements`) runs this procedure. No context beyond this file and `data/canon-facts.json` is needed.

1. **Extract claims.** From the piece under test, extract every declarative statement about the world
   that is not about the immediate scene — every sentence in a book, every dialogue line containing a
   proper noun or a claim about the Hist, history, a faction, or a place.
   ```
   python3 corpus/80-methods/canon-check.py --claims game/data/books/*.json game/data/dialogue/*.json
   ```
2. **Match against the registry.** For each claim, find the nearest `canon-facts.json` entry by keyword.
3. **Adjudicate**, in this order:
   - Contradicts a `hard-canon` fact with `contradicts_ok: false` → **FAIL the piece.** No appeal.
   - Contradicts a `soft-canon` or `apocryphal` fact → PASS **only if** the claim is voiced by a named
     in-world speaker or book, not by narration/journal/UI text. Narration contradicting soft canon → FAIL.
   - Contradicts a `disputed` fact → PASS **only if** the speaker's stance matches one of the
     `positions[]` listed for that fact. A stance not in the registry → **FAIL as an unintentional
     contradiction** (this is exactly the discrimination RI-LOR06 exists to enable).
   - Contradicts a `constructed` fact of ours → **FAIL.** Our own inventions bind us.
   - Matches nothing in the registry → the claim is **new lore**; the critic must file it as a new
     registry entry (Extension Rule, CORPUS-CONTRACT §5) with tier `constructed`, or fail the piece
     for inventing silently.
4. **Invention-space audit** (run once per wave, on the whole game, not per piece):
   - Count named factions in `game/data/factions/`. Any faction whose name or premise is lifted from a
     shipped Bethesda game (An-Xileel, the Blackwood Company *as it exists in 3E 433*, the Nerevarine,
     the Blades) is counted as **borrowed**.
   - `borrowed / total > 0.25` → **FAIL for under-invention.**
   - Count main-quest beats that restate a canonical event rather than a new one. Any main-quest beat
     that *is* a canonical event → **FAIL**.
5. **Place-name lock.** `grep` all region and settlement names in `game/data/` against CF-080..CF-088.
   Any renaming, respelling, or "correction" of a map name → **FAIL.**
6. **Provenance spot-check.** Sample 10 lore claims from shipped content; for each, the critic must be
   able to state within 30 seconds whether it is canon or ours, using only this file. Any claim where
   the critic cannot tell → **FAIL for provenance opacity**, which is the failure this file exists to prevent.

## Scoring

Scored 0–5 on three axes; the item's score is the **minimum** of the three, not the mean.

| Axis | 5 | 3 | 1 | 0 (fail) |
|---|---|---|---|---|
| **Canon fidelity** | Zero hard-canon contradictions; soft-canon deviations all deliberate and registered | ≤1 soft-canon deviation unregistered | 1 hard-canon contradiction in flavour text | Any hard-canon contradiction about the Hist, or ≥2 anywhere |
| **Invention density** | Original main quest, ≥4 original factions, ≥20 original named settlements | Original main quest, ≥2 original factions | Main quest original but factions borrowed | Main quest retells a canonical event, or borrowed ≥25% |
| **Provenance legibility** | Every lore claim traceable to a registry entry in <30s | ≥90% traceable | ≥70% | <70%, or any invention shipped in a voice that presents it as canon |

**Failure threshold:** any axis at 0 fails the wave's lore gate outright and blocks the affected content
from shipping. Score ≤2 on canon fidelity requires a re-write, not a patch.

**What we lose looks like:** a critic reads our book about the Hist, cannot tell whether the claim
"the Hist forgets a name after nine generations" is Bethesda's or ours, and therefore cannot judge
whether our world is coherent or merely confused.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 2 / 5 on the worst axis | 3 / 5 on the worst axis | 5 / 5 on the worst axis |

**Aggregation (a property of this item, not of the critic):** min-over-axes across the three axes, never the mean; any axis at 0 fails the wave's lore gate.

## How we lose

Written pessimistically and in advance:

1. **Generic swamp fantasy with lizard people.** Green, wet, crocodiles, a shaman with a bone staff.
   Nothing in this file used. If a screenshot of our marsh could be captioned "generic fantasy swamp"
   and no one would object, we have lost, and no amount of correct trivia rescues it.
2. **The Hist as set dressing.** A big glowing tree the player is told is important, which never does
   anything, never speaks, never demands, and could be cut from the game without changing a quest.
   Canon gives the Hist *write access to Argonian bodies and souls* — if that never has mechanical or
   narrative consequence, we have wasted the best idea in the province.
3. **Contradicting the Hist.** Making the Hist a villain to be slain; making Argonian souls work like
   everyone else's; letting an Argonian be born without sap; having a character "discover" that the
   Hist is really a Daedra/a machine/an alien. Each of these is an instant fail.
4. **Inventing on top of canon instead of into the gaps.** Retelling the Knahaten Flu, restaging the
   Oblivion Crisis early, dragging the Nerevarine into our story. Canon left us 27 blank years and an
   unmapped interior; using them is not optional.
5. **Inventing nothing.** Eight cities, a courier quest between each, and the An-Xileel copy-pasted in
   six years early. This is the likelier failure than #3, and this file's invention-space section exists
   because of it.
6. **Presenting invention as canon.** A book stating our constructed facts in the dry tone of the
   Pocket Guide, with nothing in the corpus marking it as ours, so that a later builder treats it as
   immovable and builds three quests on a foundation we could have changed.
7. **Imperial contempt swallowed whole.** Reproducing "Naga thugs" (CF-026) as authorial narration rather
   than as an Imperial slur we are *depicting*. Morrowind's Pocket Guide is written by a propagandist;
   ours must be too, and the game must know the difference even when the book does not.
8. **The map ignored.** A builder invents "Mistmarsh" and "Fort Greenwater" while Helstrom, the Clay Moor
   and the Stone Forest sit unused. The map is a canon source for this project (CF-088).

## Provenance note

- **Verified this session (2026-08-05):** claims marked with "(snippet)" were corroborated against
  search-result summaries of UESP *Lore:* pages and related community wikis. Direct page fetches to
  `en.uesp.net`, `elderscrolls.fandom.com`, `imperial-library.info` and `lagbt.wiwiland.net` were all
  refused (HTTP 403 at the agent proxy gateway; confirmed via `$HTTPS_PROXY/__agentproxy/status`,
  `connect_rejected` for `en.uesp.net:443`). Search snippets are therefore **second-hand summaries of
  wiki summaries of primary in-game text** — two removes from the source. They are logged as
  `community-data`, confidence `high` where several independent snippets agreed, `medium` otherwise.
  **Any future agent with unblocked access should re-verify CF-025, CF-044 and CF-050 first.**
- **Unverified recall:** CF-004, CF-012, CF-027, CF-031, CF-032, CF-044, CF-050, CF-051, CF-069 are
  recalled from direct play and reading of the shipped games and are labelled `canonical-recall`.
  CF-044 (the Ruddy Man) is explicitly **low confidence** and must not carry plot weight until verified.
- **Ours:** CF-066, CF-068, CF-070 and everything in §F's positive list are `constructed`. They are
  binding on this project and on no one else. They are recorded in `data/canon-facts.json` with
  `tier: "constructed"` so that no reader can mistake them for Bethesda's.
- **Rejected:** CF-071 records source contamination caught during research — an AI-generated
  worldbuilding site returned confident, fluent, entirely non-canonical claims about Gideon and
  Blackrose in the same result set as legitimate wiki summaries. This is the exact failure mode this
  corpus is built to catch, and it happened on the first day.
