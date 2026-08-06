# SEALED ANSWERS — the authorial half of the opacity register

> **This file must never be copied, quoted, paraphrased or summarised into `game/`.**
> `corpus/80-methods/opacity-audit.py --leak-scan` exists to prove it never was, and a leak
> is a hard fail of RI-WLD09. Nothing here is ever shown to a player, in any form, at any
> point in the game, including in a book, a note, an NPC line, an item description, an
> achievement, a loading tip, or an ending.

Governed by `corpus/50-world/RI-WLD09-the-opacity-budget.md` §B. Read that first.

## Why this file exists

The obvious way to fake mystery is to leave things unexplained because nobody wrote the
explanation. A critic cannot tell that apart from designed opacity by looking at the game —
in both cases the game says nothing. This file is the difference. Every registered mystery
has an answer here that is **coherent, specific, and consistent with the evidence the player
can actually find**, and a `seal` — `sha256(mystery_id + "\n" + normalised_answer)` — that is
also recorded in `game/data/world/opacity.json`. A critic can therefore verify:

1. the mystery was authored **with** an answer (the seal in the game data matches the answer here);
2. the answer is coherent and the in-game evidence supports it (the reading in §"Verification");
3. the game never states it (`--leak-scan`);
4. the evidence **under-determines** it (the blind divergence test, RI-WLD09 M-OP3).

Absent content fails 1 and 2. Over-explained content fails 4. That is the whole mechanism.

## Seal normalisation (must match `opacity-audit.py` exactly)

```python
def norm(t):
    t = t.lower()
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

seal = sha256((mystery_id + "\n" + norm(answer_text)).encode()).hexdigest()
```

An answer may be **edited only by re-sealing**: change the text here, recompute, and update
`game/data/world/opacity.json` in the same commit. A seal mismatch is a hard fail — it means
either the answer was written after the fact, or the game data was edited to match a story
that no longer exists.

## Record format

```
### <id> — <public name of the mystery>
kind:        place | object | creature | phenomenon | person | event
anchors:     ids in game/data/** the player can actually reach
evidence:    >=3 ids, each individually insufficient
leak_ngrams: >=5 distinctive n-grams from the answer, asserted absent from game/data/**
answer_words: <int>   (>= 60; a one-line "answer" is not an answer)
seal:        <sha256>
answer:      the sealed text
verification: why it is coherent, and what the evidence does and does not fix
```

---

## The four worked entries

These four are the template and the calibration set. **RI-WLD09 requires 24; these are 1–4.**
Each anchors to content that already exists in the corpus (RI-WLD04 `regions.json` ambient
audio, RI-WLD05's thirty strangeness elements, RI-WLD06's landmark hierarchy) — which is the
point: opacity is the *unexplained residue* of a world that was built, not a separate content
type someone adds later.

---

### M-01 — The Counting Obelisk

- **kind:** object
- **anchors:** `poi:counting-obelisk` (region-scale landmark, Blackwood — RI-WLD06 §2)
- **evidence:**
  - `npc:keeper-of-the-count` — an NPC who has cut notches into the obelisk for thirty years and says she is recording rainfall. She is not lying.
  - `book:on-the-tally-stones` — an Imperial surveyor's monograph that measures the notch interval, gets 9.1 days, and concludes the stone is a boundary marker with a decorative motif.
  - `poi:counting-obelisk` geometry — four faces, notches placed by hand, the density visibly increasing toward the top of the most recent face.
  - `dialogue:hist-speaker.dead-boles` — a Hist-speaker who will say, once, that a bole "stopped answering" and will not elaborate at any disposition.
- **leak_ngrams:** `"tally of dead hist"`, `"stopped answering the root"`, `"eleven thousand four hundred"`, `"one every nine days"`, `"believes she is recording rainfall"`, `"the hist do not explain themselves"`
- **answer_words:** 106
- **seal:** `7f7b6cee541869451a064b29c1cce75ab50edd5613f1304e5961851bae49225c`

> **SEALED ANSWER.** The Counting Obelisk is a tally of dead Hist. Every notch on its four
> faces is one bole that stopped answering the root-network, cut by the surviving Hist
> through the hands of a keeper who does not know what she is writing. There are eleven
> thousand four hundred and six notches. The count is still rising, roughly one every nine
> days, and the interval is shortening. Nothing in Argonia is aware of this as a fact; the
> keeper believes she is recording rainfall, the Temple believes the obelisk is a boundary
> stone, and the Hist do not explain themselves to anyone, including the Argonians they made.

**Verification.** *Coherent:* the keeper's compulsion, the surveyor's 9.1-day interval, and
the Hist-speaker's one refusal are all consequences of the answer, and nothing in the world
contradicts it. *Under-determined:* a player with all four pieces of evidence can reach "the
stone is counting something that is happening on a nine-day cycle" and can reach "the keeper
is being used", but cannot reach "the things being counted are Hist" — that link exists only
in this file. Expected divergent reader hypotheses: a census of the dead; a countdown; an
Imperial tax record; something to do with the tide.

---

### M-02 — The Kothringi mirror-town

- **kind:** place
- **anchors:** `poi:mirror-town` (RI-WLD05 element 9, Stone Wastes)
- **evidence:**
  - the town itself — every wall mirror-plated, no bodies, no bones, no signs of struggle, doors closed from the inside.
  - `book:the-oliis-bargain` — a fragmentary Kothringi elder's account, breaking off mid-clause, which uses the word "bargain" four times and never names the counterparty.
  - `npc:the-reflection` — a scripted reflection event: in exactly one house, the player's reflection is one frame behind and does not repeat. It happens once per save.
  - `item:unbroken-plate` — a mirror plate that cannot be broken by any weapon, spell or fall damage in the game, with no explanation and no quest attached.
- **leak_ngrams:** `"absorbed into the mirror plating"`, `"survival without bodies"`, `"one family awake and aware"`, `"came up the oliis after the knahaten"`, `"breaking every plate in the town simultaneously"`, `"the kothringi themselves would now refuse"`
- **answer_words:** 103
- **seal:** `30e55f2105a9e611b2d2ad5257530e40110839a7325de0be863866b862520530`

> **SEALED ANSWER.** The Kothringi did not vanish and were not taken. They were absorbed into
> the mirror-plating itself, one household at a time, by a bargain their elders made with
> something that came up the Oliis after the Knahaten Flu. The bargain was survival without
> bodies. It was honoured exactly as written. Every reflective wall in the town holds one
> family, awake, aware, and unable to be seen except as a reflection of whoever is standing
> there. They can be freed, but only by breaking every plate in the town simultaneously,
> which no living person can do, and which the Kothringi themselves would now refuse.

**Verification.** *Coherent:* explains the absence of remains, the doors closed from inside,
the indestructible plate, and the one-frame lag. *Under-determined:* the evidence supports
"they went into the mirrors" as one hypothesis among several (mass flight, plague pit,
Daedric abduction, a hoax), and fixes nothing about consent, the counterparty, or
reversibility. **The player may never free them, and there is no quest to do so.** An
implemented rescue would resolve the mystery and would be a defect under RI-WLD09 §B4.

---

### M-03 — The rock flutes of Valus Ridge

- **kind:** place
- **anchors:** `poi:rock-flutes` (province-scale landmark and *audible* navigation instrument — RI-WLD06 §2, §4 worked example 2)
- **evidence:**
  - the flutes — regular bore, regular spacing, a fixed seven-note chord that does not vary with wind direction.
  - `npc:ridge-quarryman` — will say the holes go down further than any rope he owns and that he stopped lowering things into them.
  - `poi:capped-shaft` — one flute, off the road, blocked at 30 m by worked metal that is not Argonian and cannot be cut.
  - `book:valus-survey-fragment` — a Legion survey listing thirteen flutes; the player can count fourteen.
- **leak_ngrams:** `"ventilation shafts of a dwemer works"`, `"never finished and never recorded"`, `"struck something living in the stone"`, `"capped the shafts from below"`, `"the same seven notes for four thousand years"`, `"the thing they struck is still capped"`
- **answer_words:** 90
- **seal:** `7464e8b3f0e22d0d6eb10e2415ce37776e3f91c85001c6b21174aac7d25bb95a`

> **SEALED ANSWER.** The rock flutes of Valus Ridge are not natural and were not cut for
> music. They are the ventilation shafts of a Dwemer works that was never finished and never
> recorded, abandoned in the middle of its first excavation season when the crew struck
> something living in the stone. The Dwemer capped the shafts from below and left. The chord
> the wind makes is a side effect of the capping geometry, and it has been the same seven
> notes for four thousand years. The thing they struck is still capped.

**Verification.** *Coherent:* the fixed chord follows from a fixed cap geometry; the
uncuttable metal is Dwemer; the survey's thirteen-versus-fourteen discrepancy is the capped
shaft, which the surveyor could not hear. *Under-determined:* "somebody made these and
stopped" is reachable; "Dwemer" is *suggested* by the metal and never confirmed (no Dwemer
architecture, no gears, no brass, no text names them); the thing in the stone is unreachable
in every sense — there is no route down, and none is ever added.

---

### M-04 — The breathing under the Deep Marshes

- **kind:** phenomenon
- **anchors:** region `The Deep Marshes` ambient audio (`regions.json`: *"NO birds. A low intestinal gurgle. A sound like breathing that is not yours."*)
- **evidence:**
  - the ambient bed itself — a breath cycle on a fixed 11-second period, audible everywhere in the region, quieter at the edges.
  - the absence of birds — total, region-wide, and remarked on by three NPCs who each give a different wrong reason.
  - `creature:voriplasm` (RI-WLD05 element 14) — appears within 90 s wherever the player disturbs deep mud, and nowhere else.
  - `npc:marsh-guide` — refuses to sleep in the region, will not say why, and cannot be persuaded at any disposition or bribe.
- **leak_ngrams:** `"the breathing under the deep marshes is one animal"`, `"roughly the size of the marsh"`, `"voriplasm are its immune response"`, `"below the birds tolerance"`, `"no way to kill it wake it"`, `"it has no role in any quest"`
- **answer_words:** 99
- **seal:** `d5dd038efa8bcc1b582bb0466e1aef5ae8bbb0a51c0d857d60ed35c195ab0cb2`

> **SEALED ANSWER.** The breathing under the Deep Marshes is one animal. It is roughly the
> size of the marsh, it has never moved, and it is not aware of anything that happens on its
> surface. The voriplasm are its immune response. The reason the birds are gone is that the
> frequency of the breath is below the birds' tolerance, not that anything hunts them. It is
> neither hostile nor benign nor a god, and there is no way to kill it, wake it, speak to it,
> or profit from it. It has no role in any quest and it never will.

**Verification.** *Coherent:* explains the fixed period, the edge falloff, the voriplasm
trigger condition, and the bird absence, and does so without requiring any new entity to be
modelled — the animal is never rendered, never fought, and never has a health bar.
*Under-determined:* the evidence supports "something is down there" and nothing further; the
three NPC explanations are all wrong and mutually inconsistent, which is deliberate — see
RI-WLD09 §B3 on wrong explanations as evidence.
**This entry is the deliberate demonstration of the hardest case:** a mystery with no payoff,
no boss, no loot, and no quest hook. It is here to prove the register can hold content whose
entire function is to be unresolved, and any critic who reports M-04 as "unfinished content"
has been answered in advance by this paragraph.

---

## Entries 5–24

<!-- WIP: entries M-05 .. M-24 outstanding. RI-WLD09 §B1 requires 24 registered mysteries
     with the composition >=8 place / >=6 object / >=4 creature / >=3 phenomenon / >=3 person.
     Written so far: 2 place (M-02, M-03), 1 object (M-01), 1 phenomenon (M-04).
     A builder filling these MUST follow the record format above and re-run
     `python3 corpus/80-methods/opacity-audit.py --seals --leak-scan` before committing;
     an entry whose seal is absent from game/data/world/opacity.json does not count toward
     the 24 and is reported by the audit as `unsealed`. -->
