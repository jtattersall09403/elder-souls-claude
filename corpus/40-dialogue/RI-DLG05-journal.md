---
id: RI-DLG05
title: The journal — schema, voice, exemplar entries, and the no-marker rule
kind: text
side: morrowind
judges: [journal.entry.voice, journal.entry.numbering, journal.entry.directions, journal.navigation.nomarkers, quests.structure.stages, world.wayfinding.directions]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

A Morrowind journal entry is a **numbered, dated note that the player character wrote**. It
is not a quest tracker. It records *what you were told*, in your own words, including the
parts that were wrong. It gives directions the way a person gives directions — "east of
Balmora, past the foyada, look for the ruined bridge" — and it never once tells you that
something has been added to your map, because there is no map marker to add. Under
ARBITRATION seam **S8** this is settled law: no compass markers, no objective arrows,
directions in prose only. The bar is that a critic can read twenty of our entries with all
attribution stripped and not be able to tell them from the reference set — same voice, same
length, same tolerance for ambiguity — and that a `grep` for coordinates, markers and UI
verbs across our entire journal corpus returns **zero hits**.

## The reference artifact

### A. Entry schema

```yaml
journal_id: HH_Murder            # stable key, one per quest, never renumbered
index: 30                        # integer, ascending, gaps allowed and encouraged (10,20,30,50,100)
flags:
  quest_name: false              # exactly ONE index per journal_id carries the display name
  quest_finished: false          # marks the quest closed; conventionally index 100
  quest_restart: false           # re-opens a closed quest (rare, deliberate)
display_name: null               # set only on the quest_name entry
date_written: "16 Last Seed, 3E 427"   # stamped at write time from the in-game calendar
text: >
  ...
```

Rules that are part of the schema, not style guidance:

1. **Index ordering is monotonic within a quest and gapped.** Start at 10, step by 10.
   Reserve `100` for completion. Gaps exist so a later branch can be inserted between two
   shipped entries without renumbering — renumbering breaks saves.
2. **One `quest_name` entry per `journal_id`.** The display name is the *quest's* name and
   must read as something the character would call it ("A Little Trouble", "The Ash
   Statues"), never as an instruction ("Kill the Bandit Leader").
3. **A journal write may add topics.** `AddTopic` is legal in a journal result script and
   is how a written-down name becomes askable — this is a graph edge (RI-DLG01 §C,
   `JOURNAL:...→ topic`). Every quest chain must have **≥ 1** such edge.
4. **Entries are append-only in the player's view.** Later entries supersede earlier ones by
   position, never by deletion. The wrong things you were told stay written down.
5. **A dated stamp is mandatory.** In-game date at write time, in the world's calendar,
   rendered in prose, not ISO.
6. **No entry may be rewritten by a later game state.** If the world changes, write a new
   entry.

### B. Exemplar entries

Ten entries at reference quality, in Morrowind's register. Word counts given so the
distribution in §C is auditable against them.

> **`A1_1_FindSpymaster` · index 10 · 16 Last Seed, 3E 427** *(38 words)*
> I have been released from prison and told to see Caius Cosades in Balmora, though no one
> would tell me why. Sellus Gravius said I should ask for him by name at the cornerclub in
> the poor quarter. I have my orders and a package I have not opened.

> **`A1_1_FindSpymaster` · index 20 · 17 Last Seed, 3E 427** *(41 words)*
> A woman at the South Wall says the old man drinks there most nights, and that he lives
> somewhere in the labour town east of the river. She would not say which house. She looked
> at me for a long moment before she answered, and I do not think she believed I was a
> tax-collector.

> **`HH_Murder` · index 10 · 22 Last Seed, 3E 427 · [quest_name: "The Hlaalo Killing"]** *(33 words)*
> They are saying in Balmora that Ralen Hlaalo was murdered in his own manor, and that an
> Argonian called Nine-Toes did it. An Argonian I spoke to says that is a lie told by
> Dunmer.

> **`HH_Murder` · index 20 · 22 Last Seed, 3E 427** *(46 words)*
> Hlaalo Manor stands on the high ground on the northwest side of town. From the temple
> steps I should go southwest, take the first stair up, and look to my left. The servant,
> Uryne Nirith, is said to still be living there, having nowhere else to go.

> **`HH_Murder` · index 40 · 23 Last Seed, 3E 427** *(52 words)*
> Uryne Nirith says she saw a red-haired Dunmer leave the manor the morning her master was
> found. She would not name him. A drinker at the Council Club fits the description —
> Thanelen Velas — but the Council Club is Camonna Tong ground and I am an outlander in it.

> **`FG_Egg_Mine` · index 30 · 30 Last Seed, 3E 427** *(58 words)*
> Eydis Fire-Eye wants the Rat In The Pot dealt with, and was careful not to say how. The
> Guild's contract is with the miners, not with the woman who signed it, and I have now been
> told two different accounts of who owns the shaft. I am beginning to think the Guild does
> not want this looked at closely.

> **`TT_Pilgrimage` · index 50 · 4 Hearthfire, 3E 427** *(29 words)*
> I have made the offering at the Shrine of Pride. The words came easily enough. I am told
> there are seven such shrines and that the order of them matters.

> **`MQ_Nerevarine` · index 60 · 19 Frostfall, 3E 427** *(64 words)*
> The Ashkhan says I have failed one of the tests, and that the Wise Woman disagrees with
> him. Neither of them will say which test, or which of them speaks for the tribe. I have
> been given three days and no direction. The prophecy they read from does not match the
> one Caius showed me — a line about the seven curses is missing entirely.

> **`TG_Percius` · index 100 · 2 Sun's Dusk, 3E 427 · [quest_finished]** *(35 words)*
> It is done, and I do not much like how. The ledger is burned, the debt with it, and the
> clerk who kept it has left Balmora on the morning strider. Nobody has asked me anything.

> **`DA_Boethiah` · index 10 · 11 Evening Star, 3E 427** *(47 words)*
> A voice spoke to me at the shrine, and it did not give a name. It said the statue lies
> beneath the sea, west of the Bitter Coast, and that a Dunmer sculptor in Caldera once
> made a copy. It called me its "sweet, willing servant." I am uneasy.

**What every one of them does, and ours must:**

| Property | Where you can see it above |
|---|---|
| First person, past tense, the character's own diction | all ten |
| Records **testimony**, not fact — attributed and hedged | `HH_Murder` 10, `A1_1_FindSpymaster` 20 |
| Directions as landmark prose with turns, never bearings or distances | `HH_Murder` 20, `DA_Boethiah` 10 |
| **Admits ignorance** — "she would not say which house" | `A1_1_FindSpymaster` 20, `HH_Murder` 40 |
| Contains a **contradiction the game has not resolved** | `HH_Murder` 10, `MQ_Nerevarine` 60, `FG_Egg_Mine` 30 |
| Carries the character's **opinion / unease** | `FG_Egg_Mine` 30, `TG_Percius` 100, `DA_Boethiah` 10 |
| Names people and places as the way you find them | all ten |
| Never states an objective, never issues an imperative to the player | all ten |

### C. Length distribution

| Statistic | Morrowind (derived) | **Our requirement** |
|---|---:|---|
| Median words per entry | ~35 | **30–45** |
| Mean | ~40 | 32–50 |
| Interquartile range | ~22–55 | 20–60 |
| Minimum | ~8 | ≥ 8 (no one-word stubs) |
| 95th percentile | ~95 | ≤ 110 |
| Absolute maximum | ~150 | **≤ 160** |
| Fraction of entries > 100 words | ~4% | ≤ 8% |
| Fraction of entries < 20 words | ~15% | 8–25% |
| Mean sentence length within an entry | ~14 words | 11–18 |
| Sentences per entry | ~2.8 | 2–4 |
| Entries per quest (median) | 4 | **≥ 3**, median 4–6 |

The exemplars in §B have a mean of 44.3 and a median of 44 — deliberately at the upper edge
of the band, because exemplars carry more freight than an average entry. Our *corpus* median
must sit at 30–45, not our showcase entries.

### D. The prohibitions (hard, testable, non-negotiable)

No journal entry may contain, in any form:

1. **A coordinate or numeric position.** No `(1024, -3200)`, no cell IDs, no grid refs.
2. **A map-marker or UI reference.** No "marked on your map", "check your journal", "a new
   objective", "waypoint", "quest log", "fast travel to", "press", "select", "the compass".
3. **A bearing or measured distance.** No "north-north-east", no "300 metres", no "1.2 km".
   Landmark-relative prose only: *"past the foyada"*, *"the second stair"*, *"where the
   road forks below the fort"*.
4. **Second-person imperative to the player.** No "Go to the cave north of town." The
   character writes about themselves in the first person; they do not issue orders to the
   person holding the controller.
5. **Game-system vocabulary.** No "XP", "level", "loot", "spawn", "boss", "stage", "flag",
   "DPS", "buff", "quest marker", "objective complete". Souls-side vocabulary
   ("bonfire", "estus", "souls" as a currency) is doubly banned here — it is the exact
   AR-2 leakage ARBITRATION §3 asks critics to hunt.
6. **A stated certainty the character cannot have.** If the character has only been told
   something, the entry says who told them.

Violation of 1–5 is binary and automatic: **one hit fails the item.**

## Comparison method

**Step 1 — dump.**
```
node tools/corpus/dump-journal.mjs --out /tmp/journal.tsv
# journal_id \t index \t flags \t display_name \t date_written \t text
```

**Step 2 — schema lint.**
```python
import csv, collections, re
J=list(csv.DictReader(open('/tmp/journal.tsv'),delimiter='\t'))
byq=collections.defaultdict(list)
for r in J: byq[r['journal_id']].append(r)
for q,rs in byq.items():
    idx=[int(r['index']) for r in rs]
    assert idx==sorted(idx) and len(set(idx))==len(idx), f"{q}: index not strictly ascending"
    names=[r for r in rs if 'quest_name' in r['flags']]
    assert len(names)==1, f"{q}: {len(names)} quest_name entries (must be exactly 1)"
    assert any('quest_finished' in r['flags'] for r in rs), f"{q}: no completion entry"
    assert len(rs)>=3, f"{q}: only {len(rs)} entries (min 3)"
    assert all(r['date_written'] for r in rs), f"{q}: missing date stamp"
print("quests:", len(byq), "entries:", len(J),
      "median entries/quest:", sorted(len(v) for v in byq.values())[len(byq)//2])
```

**Step 3 — the prohibition grep (must return nothing).**
```bash
grep -nEi \
 -e '\(-?[0-9]+(\.[0-9]+)?, ?-?[0-9]+' \
 -e '\b(marked on|your map|quest ?log|objective|waypoint|marker|compass|fast[- ]travel|press [A-Z]|select the|menu)\b' \
 -e '\b(north|south|east|west|northeast|northwest|southeast|southwest)[- ](north|south|east|west)\b' \
 -e '\b[0-9]+ ?(m|km|metres|meters|yards|feet|units)\b' \
 -e '\b(XP|experience points|level up|loot|spawn|boss|hitpoints|HP|DPS|buff|debuff|stage [0-9])\b' \
 -e '\b(bonfire|estus|souls?[- ]currency|checkpoint)\b' \
 -e '^\s*(Go|Head|Travel|Return|Kill|Find|Talk|Speak) (to|and|the)\b' \
 /tmp/journal.tsv
```
Required output: **empty.** Any line printed is quoted in the verdict and the item fails.

**Step 4 — voice test (automated).**
```python
import re, statistics
def toks(t): return re.findall(r"[A-Za-z']+", t.lower())
def sents(t): return [s for s in re.split(r'(?<=[.!?])\s+', t.strip()) if s]
W=[len(toks(r['text'])) for r in J]
print("median",statistics.median(W),"mean",round(statistics.mean(W),1),
      "p95",sorted(W)[int(.95*len(W))],"max",max(W),
      ">100w",sum(1 for w in W if w>100)/len(W),"<20w",sum(1 for w in W if w<20)/len(W))
SL=[len(toks(s)) for r in J for s in sents(r['text']) if toks(s)]
print("mean sentence",round(statistics.mean(SL),1),"sentences/entry",round(len(SL)/len(J),2))
first=sum(1 for r in J if re.search(r"\b(I|me|my|myself)\b", r['text'])) / len(J)
second=sum(1 for r in J if re.search(r"\b(you|your)\b", r['text'])) / len(J)
hedge=sum(1 for r in J if re.search(r"\b(says?|said|told|claims?|is said|seems|I think|apparently|would not|will not say|I am told)\b", r['text'], re.I))/len(J)
print("first-person",f"{first:.0%}","second-person",f"{second:.0%}","hedged/attributed",f"{hedge:.0%}")
```
Required: first-person **≥ 97%**; second-person **≤ 3%** (and each of those hits manually
justified as reported speech); hedged-or-attributed **≥ 45%**; all §C distribution bands met.

**Step 5 — the direction test.** Extract every entry that gives a route (regex for
`\b(from|past|beyond|across|behind|below|above|between|follow|road|track|bridge|stair|gate)\b`
plus a place name). For a random 10 of them, hand the entry text **alone** to a fresh
player-agent with no map UI and ask it to reach the location. Record success rate and wrong
turns. Required: **≥ 7/10 reachable**, mean time-to-find ≤ 4 minutes of in-game walking.
An entry that is atmospheric but unnavigable fails just as hard as a coordinate.

**Step 6 — topic-seeding.** Confirm ≥ 1 `AddTopic` edge originating from a journal write per
quest chain (cross-check against RI-DLG01's `topic_graph.tsv` for `JOURNAL:` sources).

**Step 7 — blind pairing** (`blind_pair: yes`). Take 6 of our entries and 6 from §B. Strip
`journal_id`, index, and all proper nouns → `[PERSON]`, `[PLACE]`, `[FACTION]`. Present in
randomised order. Use the exact judge instruction in RI-DLG07 §Protocol. Record the blind
pick and then the reveal. Per CORPUS-CONTRACT §6, a win for ours triggers a harsher re-run.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| Schema lint (step 2) | disqualifying | zero assertion failures |
| Prohibition grep (step 3) | disqualifying | zero hits |
| Length distribution (step 4, §C) | 3 pts | ≥ 8 of 11 rows in band |
| Voice metrics (step 4) | 3 pts | first-person ≥97%, second ≤3%, hedged ≥45% |
| Direction test (step 5) | 2 pts | ≥ 7/10 reachable |
| Topic seeding (step 6) | 1 pt | every quest chain has ≥1 |
| Blind pairing (step 7) | 1 pt | run and both picks recorded |

**PASS** = both disqualifying checks clean **and** ≥ 8/10 points.
**MARGINAL** = disqualifying clean, 6–7 points, with a named remediation.
**FAIL** = any disqualifying hit, or ≤ 5 points.

We lose the moment a single entry reads "Go to the cave north of town — its location has
been added to your map." That is one grep away and it is fatal.

## How we lose

- **Objective-marker prose.** "Travel to the Ashen Barrow and retrieve the ring." Second
  person, imperative, no attribution, no doubt. This is the default output of anything that
  writes journals from quest metadata instead of from character experience, and it is the
  single most likely failure in this file.
- **The journal as a checklist.** Entries that enumerate sub-objectives with counts:
  "Collected 2 of 4 ash statues." Morrowind's journal does not know how many you have. If
  the player wants to know, they count them.
- **Omniscience.** The entry states what is true rather than what you were told, so the
  journal becomes an oracle and quest-giver deceit (a `corpus/30-quests/` requirement)
  becomes impossible — you can't lie to a player whose diary already knows.
- **Coordinates smuggled in as "flavour".** "…roughly two hundred paces east-north-east of
  the bridge." Paces and compass points are a marker with a costume on. The grep in step 3
  is written to catch exactly this.
- **Uniform length.** Every entry 30–35 words, three sentences, same rhythm. A distribution
  with no tails is a template. §C's `<20w` and `>100w` bands exist to force both tails.
- **Wrong register.** Modern, chatty, or jokey: "Well, THAT went badly." The reference
  voice is plain, slightly formal, past tense, and unhurried. Contractions are rare.
- **Dates dropped or ISO-formatted.** `2024-03-11` in a journal is an immersion break and a
  schema violation.
- **Entries that never contradict each other.** If index 40 never has to be read against
  index 10, nothing was ever uncertain and the whole point of writing down testimony is
  lost.
- **Quests with two entries.** Start and finish, nothing between. Median entries/quest
  below 3 means the journal is a receipt, not a record.
- **Unnavigable poetry.** Overcorrecting: "I go where the marsh remembers." Beautiful,
  useless. Step 5 fails it and it is exactly as bad as a coordinate — a player who cannot
  find the place will demand a marker, and then we will add one.

## Provenance note

- **The ten exemplar entries in §B are `constructed`.** I wrote them, in Morrowind's
  register, for this corpus. Three of them (`A1_1_FindSpymaster` 10, `HH_Murder` 10/20) are
  close paraphrases of Morrowind quests I recall, and their *content* is
  `canonical-recall` — the Hlaalo Manor directions in particular are rephrased from the
  game's own dialogue line ("Hlaalo Manor is on the northwest side of town. Just head
  southwest from the Temple, go up the first steps you see, then look to your left.",
  verbatim, from the Morrowind Voices extraction). **No entry is presented as verbatim
  Morrowind journal text**, and none should be quoted as such. Per CORPUS-CONTRACT §3 a
  constructed exemplar is fully binding as a comparison target.
- **The schema in §A is `canonical-recall`, confidence high** on structure — `journal_id`,
  integer `index`, the `Quest Name` / `Quest Finished` / `Quest Restart` flags, and the
  convention that index 100 closes a quest are Construction Set facts, corroborated by
  community modding documentation (UESP `Morrowind Mod:Journal`; Tamriel Rebuilt's
  quest-journal guide, which states the low-to-high indexing convention and that "often
  that is index 100" for closure).
- **The length distribution in §C is `derived`, confidence medium.** Journal `DIAL` records
  are not carried by the dialogue extraction used elsewhere in this area (journals are
  unvoiced), so these figures are estimated from recall of entry length, sanity-checked
  against the exemplars. Treat the medians as ±20%. **The requirement column is
  `constructed` and is binding regardless** — it is the number a critic measures.
- **The prohibitions in §D are `constructed`**, derived directly from ARBITRATION seam S8
  ("No compass markers, no objective arrows. Directions are given in prose in dialogue and
  journal") and AR-2. They are project law, not a recollection of Bethesda policy.
- The in-world calendar used in the date stamps (Last Seed, Hearthfire, Frostfall, Sun's
  Dusk, Evening Star; era form `3E 427`) is `canonical-recall`, high confidence. Our own
  setting's calendar is owned by `corpus/60-lore/`; the *format* is what this file binds.
