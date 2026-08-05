---
id: RI-DLG02
title: Unique dialogue words per settlement — the headline density metric
kind: number
side: morrowind
judges: [dialogue.density.wordcount, dialogue.topics.filtering, world.settlement.anatomy]
provenance: community-data
confidence: high
blind_pair: no
---

## The bar

This is the number that decides whether our towns are places or set-dressing. A Morrowind
settlement is *made of words*: not a signpost and three shopkeepers with one line each, but
tens of thousands of words of dialogue that only exist there — a publican who has opinions
about her rivals, a guild steward with a hiring speech, four different racial answers to
the same murder question, a Camonna Tong thug who tells you which cornerclub not to enter.
Balmora carries **38,760 words** of settlement-local dialogue across **1,258 distinct
entries** — and Balmora is one of nine or ten towns of that class. That is the shape of the
bar. Ours does not need to match it, but it must be measured the same way, reported as a
hard number per settlement, and it must clear a floor that no amount of shared filler can
fake. The counting method below is deliberately hostile to the two cheats that kill this
metric: reusing one global pool everywhere, and inflating a settlement's total by counting
the same shared line once per NPC who can say it.

## The reference artifact

### A. Morrowind's dialogue corpus, decomposed (measured)

Measured over a community extraction of every `INFO` record in `Morrowind.esm` +
`Tribunal.esm` + `Bloodmoon.esm`, deduplicated on exact response text:

| Layer | Distinct entries | Words | Share |
|---|---:|---:|---:|
| **Speaker-unique** (filter pins a named actor) | 12,854 | **375,025** | 74.3% |
| **Generic, cell-filtered** (belongs to one settlement) | 2,373 | **64,044** | 12.7% |
| **Generic, global** (no cell filter — shared island-wide) | 2,071 | **65,827** | 13.0% |
| **Total dialogue text** | 17,298 | **504,896** | 100% |

Read that table twice. **87% of Morrowind's dialogue text is location- or person-specific.**
Only 13% is the shared pool that every town draws on. The instinct to build "a big generic
dialogue system with some local flavour on top" is exactly backwards.

### B. Per-settlement local generic layer (measured, exact)

Entries whose `Cell` filter names the settlement, deduplicated on text:

| Settlement | Local generic entries | Words | Greetings | Topics |
|---|---:|---:|---:|---:|
| Balmora | 153 | **5,345** | 30 | 123 |
| Vivec | 127 | 3,990 | 21 | 106 |
| Mournhold | 171 | 3,826 | 40 | 131 |
| Ald'ruhn | 109 | 3,401 | 30 | 79 |
| Sadrith Mora | 95 | 3,234 | 22 | 73 |
| Fort Frostmoth | 135 | 3,026 | 24 | 111 |
| Gnisis | 84 | 2,201 | 22 | 62 |
| Caldera | 86 | 2,056 | 27 | 59 |
| Seyda Neen | 58 | 1,931 | 22 | 36 |
| Suran | 69 | 1,803 | 20 | 49 |
| Ebonheart | 60 | 1,759 | 22 | 38 |
| Urshilaku Camp | 55 | 1,591 | 8 | 47 |
| Ghostgate | 55 | 1,520 | 15 | 40 |
| Maar Gan | 60 | 1,458 | 22 | 38 |
| Tel Mora | 47 | 1,360 | 20 | 27 |
| Hla Oad | 48 | 1,331 | 22 | 26 |
| Dagon Fel | 48 | 1,301 | 26 | 22 |
| Gnaar Mok | 48 | 1,299 | 14 | 34 |
| Pelagiad | 47 | 1,253 | 20 | 29 |
| Molag Mar | 43 | 1,201 | 22 | 21 |
| **265 distinct cell filters in total** | | | | |

**Every named settlement in the game has its own dialogue layer.** The smallest fishing
village on the map carries more than a thousand words that exist nowhere else.

### C. Balmora, fully audited (the worked example)

Speaker-unique dialogue of the 44 NPCs resident in Balmora that have any, deduplicated:

| NPC | Role | Entries | Words |
|---|---|---:|---:|
| Caius Cosades | Blades spymaster (main quest) | 168 | 8,281 |
| Dulnea Ralaal | publican, Eight Plates | 77 | 3,144 |
| Nileno Dorvayn | Hlaalu council steward | 141 | 2,901 |
| Estirdalin | Mages Guild spell vendor | 50 | 2,364 |
| Hasphat Antabolis | Fighters Guild archivist | 53 | 2,260 |
| Eydis Fire-Eye | Fighters Guild steward | 90 | 1,969 |
| Ajira | Mages Guild apprentice | 83 | 1,660 |
| Ranis Athrys | Mages Guild steward | 75 | 1,623 |
| Elone | Fighters Guild scout | 32 | 1,262 |
| Sharn gra-Muzgob | necromancer, Mages Guild | 34 | 1,196 |
| Sugar-Lips Habasi | Thieves Guild boss | 62 | 1,148 |
| Dondos Driler | Thieves Guild fence | 38 | 924 |
| Lorbumol gro-Aglakh | Fighters Guild enforcer | 53 | 857 |
| Nine-Toes | Thieves Guild | 13 | 390 |
| Bacola Closcius | publican, South Wall | 9 | 301 |
| Sjorvar Horse-Mouth | Fighters Guild | 8 | 279 |
| Rithleen · Drarayne Thelas · Tyermaillin · Galbedir · Ondres Nerano · Uryne Nirith · Sottilde · Selvil Sareloth · Milie Hastien · Vorar Helas · Nalcarya of White Haven · Ra'Virr · Dorisa Darvel · Phane Rielle · Masalinie Merian · Flacassia Fauseius · Hecerinde · Culumaire · Imare · Thanelen Velas · Wayn · Feldrelo Sadri · Balyn Omavel · Dralosa Athren · Ashumanu Eraishah · Marayn Dren · Vadusa Sathryon · Sirollus Saccus | shopkeepers, servants, commoners | 148 | 2,856 |
| **Speaker-unique subtotal** | **44 NPCs** | **1,105** | **33,415** |
| **+ Balmora-filtered generic** | | **153** | **5,345** |
| **BALMORA TOTAL LOCAL** | | **1,258** | **38,760** |

Second and third data points (roster reconstructed from memory and therefore *incomplete* —
these are **lower bounds**, they can only undercount):

| Settlement | Speaker-unique words | + local generic | **Total local (≥)** |
|---|---:|---:|---:|
| Ald'ruhn | 27,247 (31 NPCs) | 3,401 | **≥ 30,648** |
| Sadrith Mora | 15,447 (29 NPCs) | 3,234 | **≥ 18,681** |

Sanity figures a critic should keep in mind:
- Balmora **without** its main-quest hub (Caius, 8,281 words) is still **30,479**.
- Median words per speaker-unique entry, corpus-wide: **~24**; mean **29.2**.
- The median Balmora NPC with unique dialogue has **9 entries / ~230 words**; the top 5
  NPCs carry 55% of the town's unique words. **Distribution is heavily skewed and that is
  correct** — a town is a few deep characters and many shallow ones. A flat distribution
  (every NPC exactly 300 words) is a generator tell.

### D. Our targets — hard numbers

Settlement tiers as defined in `corpus/50-world/`. `W_local` is the metric defined in
§Comparison method.

| Tier | Example | **Target `W_local`** | **Hard floor (fail below)** | Min named NPCs with unique dialogue | Min NPCs ≥ 400 words |
|---|---|---:|---:|---:|---:|
| **A** — faction seat / hub city | our Balmora-equivalent | **20,000** | **14,000** | 25 | 8 |
| **B** — mid town, guild present | market town | **9,000** | **6,000** | 14 | 4 |
| **C** — village | fishing hamlet | **3,000** | **1,800** | 6 | 1 |
| **D** — camp / outpost | Ashlander-analogue camp | **1,500** | **900** | 4 | 1 |

Additional hard rules, all failable on their own:

1. **Locality ratio.** `W_local / (W_local + W_globalreachable) ≥ 0.35` for every Tier A/B
   settlement. Morrowind's Balmora: 38,760 / (38,760 + 65,827) = **0.37**.
2. **Cross-settlement duplication.** For any two settlements, the Jaccard similarity of
   their *local* entry-text sets must be **< 0.05**. Identical rumour text in two towns is
   the failure this catches.
3. **No named NPC under 120 words.** A named, non-respawning NPC with 40 words is a prop
   with a nameplate. (Morrowind violates this itself at the very bottom — Balyn Omavel has
   14 words — so allow **≤ 10%** of a settlement's named NPCs to fall below 120.)
4. **Skew requirement.** Top-5 NPCs must carry **40–70%** of the settlement's unique words.
   Below 40% = suspiciously flat (generated). Above 70% = one character and a ghost town.
5. **Length distribution.** Mean words per entry **22–40**; ≥ 15% of entries above 60
   words (the lore/exposition tail); ≥ 20% below 12 words (the curt tail). A corpus where
   every entry is 25–35 words is a template.

## Comparison method

**Definitions.** For settlement `S`:
- `E_unique(S)` = set of distinct response texts whose filter pins an actor whose home cell
  is `S` or a cell whose name is prefixed by `S`.
- `E_local(S)` = set of distinct response texts whose filter names cell `S` (prefix match)
  but no actor.
- `W_local(S) = words(E_unique(S) ∪ E_local(S))` after **exact-text deduplication**.
- `W_globalreachable(S)` = words of distinct response texts with no cell and no actor filter
  that at least one resident of `S` can produce.
- Word = whitespace-delimited token, after stripping variable tokens (`%PCName`, `%Name`,
  `%PCRank`, `%Faction`) — these count as one word each, not as their expansions.

**Step 1 — dump.**
```
node tools/corpus/dump-dialogue.mjs --out /tmp/dialogue.tsv
# columns: entry_id \t text \t actor_id \t cell_filter \t class \t faction \t rank \t disp_min \t type
node tools/corpus/dump-npcs.mjs --out /tmp/npcs.tsv
# columns: actor_id \t name \t home_cell \t settlement
```

**Step 2 — count.**
```python
import csv, collections, itertools
D=list(csv.DictReader(open('/tmp/dialogue.tsv'),delimiter='\t'))
N={r['actor_id']:r for r in csv.DictReader(open('/tmp/npcs.tsv'),delimiter='\t')}
def wc(t): return len(t.split())
per=collections.defaultdict(lambda: {'u':set(),'l':set()})
for r in D:
    if r['actor_id'] and r['actor_id'] in N:
        per[N[r['actor_id']]['settlement']]['u'].add(r['text'])
    elif r['cell_filter']:
        per[r['cell_filter'].split(',')[0]]['l'].add(r['text'])
glob={r['text'] for r in D if not r['actor_id'] and not r['cell_filter']}
GW=sum(map(wc,glob))
for s,v in sorted(per.items(), key=lambda kv:-sum(map(wc,kv[1]['u']|kv[1]['l']))):
    e=v['u']|v['l']; W=sum(map(wc,e))
    print(f"{s}\tentries={len(e)}\tW_local={W}\tlocality={W/(W+GW):.3f}")
# cross-settlement duplication
ss=list(per)
for a,b in itertools.combinations(ss,2):
    A=per[a]['u']|per[a]['l']; B=per[b]['u']|per[b]['l']
    j=len(A&B)/len(A|B) if A|B else 0
    if j>=0.05: print("DUP FAIL",a,b,round(j,3))
```

**Step 3 — per-NPC distribution.** For each settlement print the sorted per-NPC word table
exactly like §C, plus top-5 share, count of NPCs < 120 words, and the entry-length
histogram in 10-word buckets.

**Step 4 — the anti-fake check (mandatory).** Sample **20 random entries** from the
settlement's `W_local` set and read them. Count how many are:
 (a) substantive — say something about the world, a person, or a place;
 (b) filler — "Yes?", "What is it?", "I have nothing to say", "Goodbye";
 (c) a near-duplicate of another sampled entry (edit distance < 0.2 normalised).
**Filler + near-duplicate must be ≤ 15% of the sample.** A settlement can hit 9,000 words
entirely on padding; only reading catches that. Record the 20 sampled entries verbatim in
the verdict so the number is auditable.

**Step 5 — report.** One row per settlement: `tier, W_local, floor, pass/fail, locality,
named_NPCs, top5_share, filler_rate`.

The reference numbers to compare against are §B and §C of this file. Do **not** compare our
absolute total to Morrowind's 504,896-word corpus — compare per settlement, per tier.

## Scoring

Per settlement:

| Band | Condition |
|---|---|
| **Exceeds** | `W_local ≥ 1.25 ×` target, all five hard rules pass, filler ≤ 10% |
| **Pass** | `W_local ≥` target, all five hard rules pass |
| **Marginal** | `floor ≤ W_local <` target, no hard rule broken — must be named in the verdict as a remediation item with a word deficit stated |
| **Fail** | `W_local <` floor, **or** any hard rule broken, **or** filler+dup > 15% |

Project-level: **any Tier A settlement below floor fails the whole dialogue dimension.**
More than one-third of Tier B/C settlements marginal-or-worse also fails it.

"We lose" concretely looks like: three towns, each with 900 words, 80% of which is the same
shared greeting pool with the town name substituted in, and a verdict that reports "3,000
words of settlement dialogue" by counting the shared pool three times.

## How we lose

- **Counting shared text once per settlement.** The single most likely way this number gets
  faked. A 500-word global rumour pool reachable from 12 towns is 500 words, not 6,000.
  Step 2 deduplicates against `glob` precisely to make this impossible.
- **Counting per NPC instead of per distinct entry.** Twelve guards who all say the same
  22-word line is 22 words of content, not 264.
- **The template town.** Every settlement gets an auto-generated greeting, a "services"
  answer, and a "directions" answer with the town name and three shop names slotted in.
  Word count looks fine; Jaccard similarity between towns is 0.6; rule 2 fails.
- **40 words pretending to be 4,000.** Long entries padded with restatement — "The Fighters
  Guild is a guild for fighters. Fighters join the Fighters Guild. If you are a fighter, the
  Fighters Guild may interest you." Step 4's read-20 check is the only defence and it must
  actually be performed, with the 20 entries quoted in the verdict.
- **Flat distribution.** Every NPC 250 words, nobody 3,000. There is no Caius, no Dulnea,
  no Hasphat. Rule 4 catches it. A town needs someone worth talking to for twenty minutes.
- **All depth in one NPC.** The inverse: the quest-giver has 6,000 words and the other
  eighteen residents have 30 each. Top-5 share > 70%.
- **Dialogue replaced by item descriptions.** Souls' lore vector leaking in. Under
  ARBITRATION AR-2 this is an automatic fail of the piece: "item descriptions replacing NPC
  dialogue as the primary lore vector".
- **Quantity without locality.** 20,000 words in a town, all of it generic lore any NPC
  anywhere could say. `locality < 0.35`.
- **The metric drifts.** Someone changes "word" to include expanded `%PCName` substitutions,
  or stops deduplicating, and the number jumps 40% with no content added. The definition in
  §Comparison method is binding; a verdict that does not state the tool version and the
  dedup rule is void.

## Provenance note

- All Morrowind figures in §A, §B and §C are **counts I computed myself** over a community
  extraction of the game's dialogue records — hence `provenance: community-data` rather than
  `measured`: the *extraction* is community work, the *arithmetic* is mine and is
  reproducible from the cited files.
  Source: Morrowind Voices, <https://github.com/Kezyma/Morrowind-Voices> —
  `Progress/Archive/Morrowind.csv` (speaker-attributed entries, 15,716 rows → 12,854
  distinct texts) and `Progress/Archive/Morrowind Generic.csv` (6,086 rows → 4,444 distinct
  texts, with `GenCell` / `GenClass` / `GenFaction` / `GenRank` filter columns).
  Deduplication was exact-text; word counts are whitespace tokens.
- **Confidence high** on §A and §B: they are direct counts over complete columns of the
  extraction, with no roster judgement involved.
- **Confidence medium** on §C's Balmora roster: the extraction carries speaker names but not
  home cells, so the 44-name roster is `canonical-recall` (my knowledge of Balmora,
  cross-checked against Balmora-filtered in-game text that names its own residents —
  e.g. the game's own line "None of the Hlaalu counselors live in Balmora. Nileno Dorvayn at
  the Council Hall is the ranking Hlaalu local… Ethasi Rilvayn is the Morag Tong steward.
  Feldrelo Sadri is the steward for the Balmora Tribunal Temple. Sugar Lips Habasi is the
  local…"). An incomplete roster **undercounts**; 38,760 is therefore a floor, not a
  ceiling. Ald'ruhn and Sadrith Mora rosters are markedly less complete and are labelled
  as lower bounds.
- The **corpus covers Morrowind + Tribunal + Bloodmoon**; §B's Mournhold, Raven Rock,
  Skaal Village and Fort Frostmoth rows are expansion content and should be compared to our
  DLC-equivalent content, not to base-game towns.
- All **targets, tiers, floors and the five hard rules in §D are `constructed`** — defined
  for this project because no upstream equivalent exists. Binding regardless
  (CORPUS-CONTRACT §3).
