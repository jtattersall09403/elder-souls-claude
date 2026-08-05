---
id: RI-DLG03
title: Greetings and rumours — disposition banding and the diegetic quest-discovery mechanism
kind: text
side: morrowind
judges: [dialogue.rumour.distribution, dialogue.greeting.variation, dialogue.disposition.model, dialogue.topics.truth, quests.discovery.hooks, world.persistence.state]
provenance: community-data
confidence: high
blind_pair: yes
---

## The bar

Two systems, one job. **Greetings** are the world telling you what it currently thinks of
you: the same NPC in the same town says "Anything you wish, %PCName. You know I like you"
at disposition 85 and "Go away. FAR away. As far from Balmora as you can. Would you?
Please?" at disposition 15, and neither line is a UI element — both are in character, both
name the town, both offer or withhold the conversation. **Rumours** are the world telling
you what is happening in it: the "latest rumors" topic is Morrowind's *entire* quest
discovery system. There is no marker, no quest board, no exclamation mark. You walk into a
town, you ask for gossip, and gossip names a person, and the person names a place, and the
place has a body in it. The bar is that in our game, asking around in a town is the
mechanically correct and *only* way to find most of its content; that a town's rumours are
that town's, not the world's; and that rumours rot and are replaced as the main quest
advances, so a returning player hears a town that has moved on.

## The reference artifact

### A. Greeting banding — Balmora's 30 town-filtered greetings, by disposition band

All text below is verbatim Morrowind, from entries whose `Cell` filter is `Balmora`.
Band assignment is by the entries' `Disposition ≥` minima and their evident register.

**Band 1 — hostile (disp < 20). 6 entries. Conversation is refused or grudged.**
> "Go away. FAR away. As far from Balmora as you can. Would you? Please?"
> "I don't have time to chat. And, frankly, I don't like you very much."
> "Let's get this straight, stranger. While you're in Balmora, do me a favor, and stay far away from me."
> "Look, outlander. Foreigners are not very popular in Morrowind. So try to make yourself more agreeable, if you expect people to be helpful."
> "Maybe you're a slow learner. But outlanders are not popular in Morrowind. Here in Balmora we make a special effort to be pleasant to outsiders. But if you go around annoying people, you're going to regret it."
> "Take my advice, outlander. We've got no complaint about outlanders in Balmora. Not like some other parts of Morrowind. But you have to try to be more agreeable, or you're not going to be very popular."

**Band 2 — cold (20–39). 8 entries. Answers, does not welcome. Calls you "stranger".**
> "What do you want, stranger? You're in Balmora, all right. You looking for someone in particular?"
> "What do you want? You trying to find a specific place here in Balmora?"
> "Yes, this is Balmora. Tell me what you want."
> "You're in Balmora. Go ahead and ask your question."
> "If you're looking for Balmora, you found it. Go ahead. You got a question for me?"
> "Yes, I know my way around Balmora. What about it?"
> "You have a question about Balmora?"
> "Something you want to ask me about Balmora?"

**Band 3 — neutral (40–59). 6 entries. Transactional, offers the root topics by name.**
> "All right, stranger. Tell me what you want. Services? Or are you here in Balmora for someone in particular?"
> "Sure. This is Balmora. Are you looking for someone in particular?"
> "If you're looking for services in Balmora, I guess I can help you."
> "I haven't seen you in Balmora before, have I? You have a question?"
> "You're not from around here. Something you want to ask me about Balmora?"
> "You're a new face. So what can I tell you about Balmora? I like to swap the latest rumors, when there's something juicy enough to gossip about. Or, maybe, if you have a little secret, maybe I have one to trade."

**Band 4 — friendly (60–79). 6 entries. Self-introduces, names the town's allegiance, opens the menu of root topics.**
> "Greetings, Citizen. I'm %name. This town is Balmora, Council Seat of House Hlaalu. We're loyal citizens of the Empire, and proud of it. Well, most of us, anyway. So, are you looking for someone in particular? Are you looking for services? Is there some specific place you'd like to visit? Would you like a little advice?"
> "Greetings, Citizen. I'm %name. Welcome to Balmora. We're a House Hlaalu town, and loyal citizens of the Empire. What can I do for you?"
> "Hello, friend. I'm %name. Welcome to Balmora. If you have a question, I'll be happy to answer it. Or try, anyway. And if it's just a little advice you'd like, that's fine, too."
> "Hello, %PCName. I'm %Name, and this is Balmora. I don't believe we've met. Is there something I can do for you?"
> "Welcome to Balmora, Council Seat of House Hlaalu. How can I serve you?"
> "So, your name is %PCName? And you're new here in Balmora? Well, my name is %name. And I don't mind answering questions. I have nothing else on my mind right now. And if I start to bore you about Morrowind lore, just let me know."

**Band 5 — warm (80+). 4 entries. Uses your name, remembers you, and *unlocks content*: "little secret" only opens up here.**
> "Anything you wish, %PCName. You know I like you, and want to help. In fact, with a good friend like you, I might even be persuaded to gossip about a little secret."
> "Good to see you again, %PCName. Please, whenever you're in Balmora, feel free to stop by. Now, what can I do for you?"
> "It's good of you to stop by, %PCName? Always happy to see you. We're you looking for a little advice? Or is there something else in Balmora you want to ask about?"
> "Well, now, %PCName. You're back again. And what can I do for you this time? Can I interest an outlander like you in a little Morrowind lore?"
> "Hmm. Was it the latest rumors you were looking for, %PCName? If not, I'll be happy to tell you anything I know about Balmora, or any other Morrowind lore."

Four structural facts to copy:

1. **Every band names the town.** Even the hostile ones. A greeting that could belong to
   any settlement is a wasted greeting.
2. **The bands differ in what they *offer*, not just in tone.** Band 1 offers nothing.
   Band 3 offers "services"/"someone in particular". Band 5 offers "little secret" —
   a topic that is *mechanically gated* behind being liked.
3. **The form of address moves with the band**: `outlander` → `stranger` → no address →
   `%PCName` → `%PCName` + "friend". Address form is the cheapest, sharpest disposition
   signal there is. (RI-DLG06 makes it a measurable fingerprint.)
4. **Main-quest state overrides all of it.** Post-endgame Balmora greets you as
   *Moon-and-Star* — "Only time will tell, Moon-and-Star." The town learns your title.

### B. Rumours as quest discovery — Balmora's "latest rumors" pool

Roughly **30** of Balmora's 123 town-filtered topic entries are rumour-class. A
representative spread, verbatim, tagged by what they do:

| Function | Verbatim rumour |
|---|---|
| **Seeds a quest chain** | "I heard that Nine-Toes the Argonian killed him." |
| **Contradicts another rumour** (same town, different race filter) | Argonian speaker: "I have heard only false rumors. Nine-Toes cannot be the murderer." |
| **Adds a witness lead** | "I heard that a red-haired Dunmer was seen leaving Hlaalo Manor the day that Ralen Hlaalo was murdered." |
| **Reports the player's own past actions back at them** | "They say someone hit the Camonna Tong at the Council Club. Hard. And the guards SAY they're very concerned, and they're following all leads... But somehow they don't seem very sincere." |
| **Same event, earlier act, less information** | "They say someone hit the Camonna Tong at the Council Club. Hard. Nobody seems to know what happened. Probably the Thieves Guild." |
| **Points at a quest-giver without naming a quest** | "Somebody said Larrius Varro over at Fort Moonmoth is looking for you. Said he wanted to talk to you. Don't know what about." |
| **Political background that becomes a faction quest later** | "Everyone knows who really runs House Hlaalu. It's not the councilors. No one sits on that council unless it suits Orvas Dren." |
| **Foreshadows the main quest, act-keyed** | "Why is everybody so grouchy and tired lately? You don't suppose folks are all having bad dreams all at once? I'm not saying I'm having bad dreams. No, sera, not at all. I'm fine. But you do hear folks talking among themselves sometimes." |
| **Main-quest act advanced** | "I heard the Ordinators burned out a camp of Nerevarine cult worshippers out by the Ghostfence, in Foyada Ashur-Dan. The Temple seems to be going to a lot of trouble to exterminate a bunch of simple Ashlanders." |
| **Post-endgame replacement** | "Now that Dagoth Ur is dead, and the Blight ended, I wonder if they'll maintain a garrison at Ghostgate. Or will it become a deserted ruin, like the old Dunmer strongholds. Only time will tell, Moon-and-Star." |
| **Local economy / minor job hook** | "Dulnea Ralaal, publican of the Eight Plates Cornerclub here in Balmora, is hiring entertainers to amuse her patrons. She's looking for jesters, dancers, drummers, jugglers, and singers who play the lute." |
| **Pure texture, no quest** | "You won't believe what old Avus said yesterday. 'I could live in a nutshell and be consumed with infinite space were it not that I have bad dreams.' What the hell is he talking about?" |
| **Grievance / worldbuilding** | "It's not bad enough with the blight storms this year, but the Ashlanders are also going crazy, jumping caravans and pilgrims, raiding villages, scrapping with the Legions." |

Note what is **absent**: no rumour says "there is a quest available", "go to the marker", or
"a new objective has been added". Every one is a person saying a thing they believe.
Several are **wrong** (the Nine-Toes rumour accuses an innocent man; the murderer is
Thanelen Velas). **Rumours are testimony, not data.**

### C. Required counts — our targets

| Quantity | Tier A | Tier B | Tier C | Tier D | Fail below (B) |
|---|---:|---:|---:|---:|---:|
| Distinct greeting entries, cell-filtered to the settlement | 30 | 24 | 12 | 8 | 14 |
| Disposition bands represented | 5 | 5 | 4 | 3 | 3 |
| Greetings per band, minimum | 4 | 3 | 2 | 1 | 1 |
| Distinct rumour entries in the settlement's pool | 28 | 20 | 10 | 6 | 12 |
| …of which **unique to that settlement** | 20 | 14 | 8 | 5 | 8 |
| …that **change across main-quest acts** | 12 | **8** | 4 | 2 | 5 |
| Rumours that are **false or misleading** | ≥ 3 | ≥ 2 | ≥ 1 | ≥ 1 | 0 |
| Rumours that report **the player's own past actions** | ≥ 3 | ≥ 2 | ≥ 1 | 0 | — |
| Settlement quests discoverable **only** via rumour/topic chain | ≥ 60% | ≥ 60% | ≥ 50% | — | <40% |

**Act model.** Our main quest has three acts (see `corpus/30-quests/`). Every Tier A/B
settlement's rumour pool must be partitioned so that the pool a player hears in Act I is
not identical to Act II or Act III:

- **≥ 8 entries (Tier B) are act-gated**: filtered on the main-quest journal index, and
  either replaced or retired at the act boundary.
- **≥ 2 entries per settlement are post-resolution**: they only appear after the main quest
  ends and they refer to it in the past tense.
- **Player-title propagation:** once the player has earned an in-world title, **≥ 25% of a
  settlement's greetings must use it** in place of the generic address form. Morrowind's
  Balmora does exactly this with *Moon-and-Star*.
- **Reactivity:** if the player commits a notable act in a settlement (a killing, a theft
  from a named NPC, resolving that town's quest), **at least one rumour in that settlement
  must reference it** within one in-game day.

**The diegetic rule (binding).** A rumour entry MUST NOT:
- name a quest, an objective, or a stage ("I have a quest for you", "your objective is…");
- give a coordinate, a bearing in degrees, a distance in metres, or a map-marker reference;
- describe a UI affordance ("check your journal", "it's marked on your map");
- be phrased as instructions to the player rather than speech to a person.

A rumour MAY be wrong, vague, self-serving, prejudiced, or contradicted by the next NPC.
It SHOULD be at least one of those more often than not.

## Comparison method

**Step 1 — dump.**
```
node tools/corpus/dump-dialogue.mjs --out /tmp/dialogue.tsv --include-filters
# type ∈ {greeting, topic}; topic name; cell_filter; disp_min; journal_conditions
```

**Step 2 — greeting audit, per settlement.**
```python
import csv, collections
D=[r for r in csv.DictReader(open('/tmp/dialogue.tsv'),delimiter='\t')]
def band(d):
    d=int(d or 0)
    return 1 if d<20 else 2 if d<40 else 3 if d<60 else 4 if d<80 else 5
for s in settlements:
    g=[r for r in D if r['type']=='greeting' and r['cell_filter'].split(',')[0]==s]
    g={r['text']:r for r in g}.values()   # dedupe
    b=collections.Counter(band(r['disp_min']) for r in g)
    named=sum(1 for r in g if s.lower() in r['text'].lower())
    print(s, 'greetings',len(g), 'bands',dict(b), 'names-the-town',f"{named/len(g):.0%}")
```
Required: `len(g)` ≥ tier target; all required bands non-empty at the per-band minimum;
**names-the-town ≥ 70%**.

**Step 3 — rumour audit, per settlement.**
Extract entries under the rumour topic (`latest rumors` equivalent) filtered to `s`.
Compute: total, unique-to-settlement (not present in any other settlement's pool),
act-gated count (has a main-quest journal condition), post-resolution count.

**Step 4 — the act-shift test (run the game, not the data).**
For one Tier A and one Tier B settlement, with a save at each act boundary:
```
1. Load Act I save. Enter settlement. Ask the rumour topic 12 times across ≥ 4 NPCs.
   Record every distinct response verbatim.  → set R1
2. Repeat at Act II save → R2 ; Act III → R3 ; post-resolution → R4.
3. Compute |R1 ∩ R2| / |R1 ∪ R2|, and the same for R2/R3, R3/R4.
```
Required: each consecutive-act Jaccard **≤ 0.70** (i.e. ≥ 30% turnover per act), and
`R4 \ R1` non-empty with at least 2 entries that reference the resolution in past tense.

**Step 5 — cross-town identity test.** For every pair of settlements compute the Jaccard
similarity of their rumour pools. Required **< 0.15**. Print any pair above it — that pair
is one town wearing two names.

**Step 6 — the discovery test (the important one).** Take the list of quests available in
one Tier B settlement. For each, a fresh player-agent with **no journal, no wiki, no marker
UI** must find the quest-giver starting only from `Greeting → latest rumors`. Record:
quests found, hops required, and the verbatim rumour that seeded each. Required: **≥ 60%
found**, and **0 quests found by walking into an NPC who offered it in their greeting**.

**Step 7 — the diegetic lint.** Regex the whole rumour corpus for banned constructions:
```
(?i)\b(quest|objective|marker|waypoint|your (map|journal|compass)|coordinates?|[0-9]+ ?(m|metres|meters|yards)\b|head (north|south|east|west) [0-9])
```
Any hit is a failure and must be quoted in the verdict.

**Step 8 — blind pairing** (`blind_pair: yes`). Take 5 of our rumours and 5 from §B,
strip all proper nouns to `[PERSON]`, `[PLACE]`, `[FACTION]`, shuffle, and run the RI-DLG07
protocol. Proper-noun stripping is required here specifically so the judge cannot identify
the source by setting.

## Scoring

| Dimension | Pass | Fail |
|---|---|---|
| Greeting count & bands | all tier minima met, ≥ 70% name the town | any band empty, or count < floor |
| Rumour count | tier target met | below the floor column |
| Act turnover | every consecutive Jaccard ≤ 0.70 | any ≥ 0.85 |
| Cross-town identity | all pairs < 0.15 | any pair ≥ 0.30 → **automatic fail** |
| False/misleading rumours | ≥ tier minimum | zero → automatic fail |
| Discovery test | ≥ 60% of quests found from rumours | < 40%, **or** any quest offered directly in a greeting |
| Diegetic lint | 0 hits | ≥ 1 hit → **automatic fail**, filed as ARBITRATION AR-2 leakage |
| Blind pairing | recorded, both picks logged | not run |

Composite: **any automatic fail sinks the item.** Otherwise ≥ 6 of 8 dimensions passing =
PASS; 4–5 = MARGINAL with a named remediation; ≤ 3 = FAIL.

"We lose" is: 8 greetings that ignore disposition entirely, one rumour list shared by every
town in the game, and quests that are handed to you the moment you talk to the right person
because the right person is the only person with a greeting.

## How we lose

- **Rumours identical in every town.** The most likely failure and the most damaging. Step
  5 exists solely for it. Symptom: cross-town Jaccard > 0.3, and a player who stops asking
  for rumours after the second town because they already know what they'll hear.
- **Disposition as decoration.** Greetings exist in "polite" and "rude" versions but the
  disposition number never actually crosses a band boundary in play, so 26 of the 30
  greetings are never seen. Cross-check against RI-DLG04: if the disposition distribution
  across NPCs is a spike at 50, the bands are dead weight.
- **The quest board with extra steps.** "latest rumors" returns a list of available quests
  with their status. This is a marker system in prose. Step 7's lint plus step 6's
  "0 quests offered in a greeting" rule are the defence.
- **Rumours never change.** Ship one static pool per town, never gate on act. Turnover
  Jaccard = 1.0. The world stops existing the moment you've heard it once — and the player
  who returns to the starting town after the endgame finds it still worrying about
  something that already happened.
- **Every rumour is true.** No contradiction, no prejudice, no self-interest. Then the
  rumour system is an oracle and the player learns to trust it absolutely, which kills
  investigation as a verb. Morrowind's Balmora accuses an innocent Argonian in one race's
  voice and defends him in another's.
- **Greetings that don't know where they are.** Generic "Hello, traveller." in every
  settlement. `names-the-town < 30%`.
- **No memory.** The town never mentions what the player did there. Nothing the player does
  enters the rumour pool, so a settlement is read-only.
- **Title never propagates.** The player becomes the something-or-other of prophecy and
  every guard still says "outlander". (Conversely: the title propagating *instantly and
  everywhere* is the opposite failure — Morrowind gates it behind main-quest stage.)
- **The band-1 greeting still helps you.** A hostile NPC who nonetheless answers every
  topic makes disposition meaningless. Band 1 must *cost* the player something.

## Provenance note

- All greeting and rumour text in §A and §B is **verbatim Morrowind text**, `community-data`
  from the Morrowind Voices extraction of `Morrowind.esm`
  (<https://github.com/Kezyma/Morrowind-Voices>, `Progress/Archive/Morrowind Generic.csv`,
  the 153 deduplicated rows whose `GenCell` is `Balmora`; 30 of those are type `Greeting`).
  Confidence **high** on the wording — it is copied, not recalled.
- The **band assignment** of individual greetings is `derived`: the extraction preserves
  cell/class/faction/rank filters but not the `Disposition ≥` minimum, so I banded by
  register. The *existence* of disposition-minimum banding is `canonical-recall` from the
  Construction Set and is not in doubt; the exact threshold on any single line is.
  Confidence **medium** on per-line placement, **high** on the five-band shape.
- The **rumour classification** in §B (which of Balmora's 123 topic entries are
  rumour-class, ≈30) is `derived` by manual reading, because the extraction does not carry
  parent topic names. Treat the count as ±20%.
- The **act-keyed behaviour** is evidenced directly by the extracted text — the
  "Now that Dagoth Ur is dead…" and "Moon-and-Star" lines cannot exist before the endgame —
  so the *mechanism* is `community-data`/high, while the *number* of act-gated entries in
  Balmora is `derived`/medium.
- Everything in §C — all counts, tiers, floors, the four-part diegetic rule, the act model,
  and the title-propagation rule — is `constructed` for this project, and binding
  (CORPUS-CONTRACT §3).
