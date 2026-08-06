---
id: RI-AUD05
title: Voice policy — text-first dialogue is the correct answer, and what audio dialogue exists instead
kind: structure
side: morrowind
judges: [audio.voice.policy, dialogue.voice.register]
provenance: measured
confidence: high
blind_pair: yes
---

> **ARBITRATION: this item is `morrowind`.** Dialogue is *outside the fight*
> (ARBITRATION §1, "Dialogue"). One category inside this item — effort, pain and death
> vocalisations — is **Souls-side and frame-relevant**, and is specified in §C under the same
> ≤1-frame contract as RI-AUD01. Everything else here is Morrowind's.

## The bar

**Full voice acting is out of scope, and that is a design decision, not a budget excuse.**

The measurement that settles it is on disk in this repository. `corpus/40-dialogue/data/morrowind-dialogue.csv.gz` contains **69,876 dialogue rows totalling 1,866,989 words**
(mean 26.7 words per row). At a conversational 150 words per minute that is **207 hours of
recorded audio** — for the reference game alone, before this project's original main quest,
faction lines and ~200 side quests. Skyrim, fully voiced, shipped roughly 60,000 lines and a
dialogue system an order of magnitude shallower than Morrowind's: fewer topics, no keyword
discovery, no per-settlement rumour divergence, and dialogue that is a menu of four options
rather than a browsable index of everything the world knows.

That is the trade, and it runs one way. **Voicing dialogue costs dialogue.** Every project that
has taken full VO into an Elder Scrolls-shaped game has paid for it by cutting the topic graph,
because 26.7 words is a cheap thing to write and an expensive thing to record. ARBITRATION §1
gives Morrowind authority over dialogue precisely so that this trade cannot be made silently,
and AR-2 names "minimal/absent dialogue" as automatic-fail Souls leakage. **A voiced version of
this game would fail AR-2 by construction.** Text-first is therefore not a compromise we
apologise for; it is the arbitration rule being obeyed.

What follows is the positive half, which matters more: **text-first is not silent.** Morrowind's
NPCs greeted you aloud, in character, in their own species' voice, and the greeting was the
thing that made the topic list feel like a person. Our bar is a **non-lexical vocal layer** —
greetings, effort, pain, barks, crowd murmur, and untranslated Jel — rich enough that a player
can tell a Saxhleel dockhand from a Dunmer factor from a naga with their eyes shut, and
disciplined enough that no NPC ever waits for a sound to finish before their words can be read.

## The reference artifact

### §A — What is voiced and what is not

| Category | Voiced? | Lexical? | Length | Arb |
|---|---|---|---|---|
| **Greeting vocalisation** — plays as the dialogue window opens | **yes** | **no** — non-lexical | 0.4–1.6 s | morrowind |
| **Topic responses** (the 26.7-word bodies) | **no** | text only | — | morrowind |
| **Journal, books, item descriptions** | **no** | text only | — | morrowind |
| **Merchant / guard / idle barks** — overheard in the world, not in a conversation | **yes** | **yes**, from a closed set | 1–3 s | morrowind |
| **Effort / pain / death vocalisations** | **yes** | no | 0.2–1.2 s | **souls** (§C) |
| **Crowd murmur** | yes | no (unintelligible bed) | looped | morrowind |
| **Untranslated Jel / naga speech** | **yes** | in-fiction lexical, **untranslated for the player** | 1–4 s | morrowind |
| **Boss / named-creature roars** | yes | no | 1–4 s | souls |

**The lexical budget.** Total distinct *intelligible-English* recorded lines across the whole
game: **≤ 60**, all of them barks (§D). Every one is listed in
`game/data/audio/voice/barks.json`. Line 61 is a policy breach and is reported as such — not
because 60 is sacred, but because an unbounded bark set is how full VO arrives by increments.

**No NPC dialogue is ever gated on audio.** The topic text is on screen at the frame the topic
is selected. There is no line to wait for, no skip button, no "press A to continue". This is
scored (VO-2) because it is the mechanism by which reading-speed dialogue silently becomes
listening-speed dialogue.

### §B — The greeting vocalisation, and the Jel finding

A greeting vocalisation is a short non-lexical utterance keyed to
`(species, archetype, disposition_band, gender, age)`. It plays once when the dialogue window
opens, spatialised at the NPC, and it is the **only** audio in a conversation.

Disposition bands: `hostile (<20) / cold (20–39) / neutral (40–59) / warm (60–79) / devoted (80+)`.
The same Saxhleel dockhand greets you differently at 25 and at 75, and that is the audio channel
telling the player something the disposition number would otherwise have to.

**A finding from the local corpus that constrains this, and it is the opposite of the obvious
design.** Across all **3,888 Argonian-voiced lines** in
`corpus/60-lore/data/argonian-dialogue-corpus.json` (151 distinct named speakers), there are
**zero** instances of `hiss`, `sss`, `Jel`, `rasp`, or `click` used as phonetic markup. Morrowind
never wrote Argonian accent into the letters. Its Argonians are distinguished by *syntax and
register* — the clipped self-naming of slaves (`"I am Ahaht. Slave."`, `"I am Jeed-Ei. Slave."`),
dropped articles, formality — not by spelling.

**The rule this yields: the hiss lives in the audio layer and never in the text.** Writing
`"Yesss, ssstranger..."` into `game/data/dialogue/` is a **hard fail of this item and of
RI-DLG's register bar** — it is a cliché, it is unreadable at 26.7 words a line, and it
contradicts 3,888 lines of the actual reference. The sibilance belongs in the greeting
vocalisation and the effort sounds, where it costs the reader nothing.

### §C — Effort, pain and death (Souls-side, frame-locked)

These are combat feedback, not characterisation, and they inherit RI-AUD01's frame contract.

| Class | Trigger frame | Offset budget | Note |
|---|---|---|---|
| `effort_light` | `attack_start`, light | ≤1 frame | quiet; not every swing — 40–60% of swings, seeded |
| `effort_heavy` | `attack_start`, heavy | ≤1 frame | 100% of swings; the heavy grunt is a telegraph the player can hear |
| `effort_roll` | `roll_start` | ≤1 frame | breath; ties to stamina |
| `pain_light` / `pain_heavy` | `hit` where owner is this entity | ≤1 frame | severity from damage fraction |
| `stagger_vox` | `stagger` | ≤1 frame | |
| `death_vox` | `death` | ≤1 frame | terminal, never interrupted, never looped |
| `exhausted` | stamina reaches 0 | ≤1 frame | the audible tell that the player is out of stamina — this is a **combat-correctness** cue, see RI-UIX01 |

**`effort_heavy` at 100% is deliberate.** An enemy's heavy attack windup is something the player
must be able to read; in a third-person game (S18) with a lock-on camera the player frequently
cannot see an off-screen enemy's windup. The grunt is the off-screen telegraph, and removing it
for variety's sake breaks enemy legibility.

**`exhausted` is the one that gets cut and should not be.** RI-UIX01 makes stamina readability a
combat-correctness property; the vocal cue is the version of that which survives the player
looking at the enemy instead of at the bar.

### §D — The vocal palette (the check that stops every NPC sharing one grunt)

A **palette** is a complete set of the §A/§C non-lexical assets in one voice. Every NPC in
`game/data/npcs/**` carries `voice_palette` and `voice_pitch` (a per-NPC semitone offset in
`[-2.0, +2.0]`, derived deterministically from the NPC id so it survives a reload).

**Minimum 16 palettes**, distributed as:

| # | Palette | Species | Register |
|---|---|---|---|
| 1–2 | `saxhleel_labour_{m,f}` | Argonian | low, breathy, clipped; dockhands, egg-tenders, marsh-folk |
| 3–4 | `saxhleel_learned_{m,f}` | Argonian | measured, longer utterances; Hist-tenders, scribes, tree-minders |
| 5 | `saxhleel_elder` | Argonian | dry, slow, heavy sibilance |
| 6 | `saxhleel_youth` | Argonian | higher, quicker |
| 7–8 | `dunmer_factor_{m,f}` | Dunmer | clipped, contemptuous; slavers, House agents |
| 9 | `imperial_legion` | Imperial | bored, official; Salt Hills garrison |
| 10 | `imperial_merchant` | Imperial | warm, transactional |
| 11 | `khajiit_trader` | Khajiit | purring, elongated |
| 12 | `naga_hostile` | Naga | **untranslated Jel** — see §E |
| 13 | `naga_speaker` | Naga | untranslated, longer, ritual cadence |
| 14 | `beggar_lichen_blind` | any | wrecked, wet; Crimson Coast only |
| 15 | `child` | any | |
| 16 | `guar_handler` | any | half of this palette's utterances are addressed to the animal, not to you |

**Rules.**

- **VP1** — every NPC record has a `voice_palette` from this closed set. An NPC with none is a
  data defect, not a silent default.
- **VP2** — no palette covers more than **20%** of the game's NPCs.
- **VP3** — palette assignment entropy over the NPC census ≥ **3.2 bits** (16 palettes used
  evenly would be 4.0; 3.2 permits realistic skew toward Argonian labour palettes without
  permitting a monoculture).
- **VP4** — each palette has ≥ **6** greeting variants per disposition band (5 bands × 6 = 30
  greetings per palette minimum).
- **VP5** — no single sample exceeds **8%** of all `bus:"voice"` playbacks in a 60-minute
  session.
- **VP6** — species palettes are never shared. A Dunmer must never use a Saxhleel greeting.
- **VP7** — `voice_pitch` is derived from the NPC id via the seeded PRNG, so two NPCs on the
  same palette are still not the same voice, and the same NPC is the same voice every session.

### §E — Untranslated Jel and naga speech

`regions.json` gives The Clay Moor `"untranslated naga speech"` as an ambient identity element
(RI-AUD03 §B L4). This is the one place voice crosses into worldbuilding.

- Naga speech is **never subtitled and never translated**, at any point, by any means. There is
  no Jel-learning skill that unlocks it.
- Argonian NPCs speaking to *each other* (not to the player) use Jel and are likewise
  untranslated; the player's dialogue with them is in Tamrielic and is text.
- The utterances are real constructed phonology with consistent recurring morphemes, so a
  player who hears the same phrase at two naga camps can recognise it as the same phrase. That
  recognisability is the point — an untranslated language that is random noise is just noise.
- **≥ 24 distinct Jel utterances**, of which **≥ 6 recur** across multiple locations.

This is the strangeness requirement (ARBITRATION §1, "Strangeness") applied to audio: the world
contains meaning the player does not have access to, and it does not apologise for it.

## Comparison method

1. **Static census — no browser.**
   ```bash
   node tools/analysis/content-stats.mjs --voice game/data/npcs/ game/data/audio/voice/
   ```
   Emits: NPC count, palette histogram, entropy, NPCs missing `voice_palette`, greeting variants
   per palette per disposition band, bark line count, Jel utterance count and recurrence.
   Covers VP1–VP4, VP6, the ≤60 bark budget, and §E.

2. **VO-1 — the lexical check.** Assert `barks.json` has ≤60 entries and that no asset outside
   it is tagged `lexical: true`. Then the reverse direction, which is the one that actually
   catches drift: grep `game/data/dialogue/**` for phonetic-accent markup —
   ```bash
   grep -rnE '\b[Ss]{2,}|[Yy]ess+|hisss|\bsss' game/data/dialogue/ && echo "HARD FAIL §B"
   ```

3. **VO-2 — no audio gating.** Run a dialogue scenario; assert from the trace that the frame a
   `topic` event fires equals the frame the topic text is present in `getUIState()`, for all
   topics, and that no input is blocked while a voice sample is playing.

4. **VO-3 — sample dominance (VP5).** From a 60-minute `aud-session-60` run (RI-AUD04 §1),
   histogram `audioLog` entries with `bus == "voice"` by `sample_id`.

5. **VO-4 — effort frame lock (§C).** As RI-AUD01 M1: join `audioLog` to trace events for the
   seven §C classes, compute offset p99 and max.

6. **VO-5 — the blind voice test.** From the session capture, extract greeting clips. Two
   protocols:

   **(a) same/different.** 40 pairs, half same-NPC, half different-NPC-same-palette, half
   different-palette. Fresh judge per pair:
   ```
   Listen to these two short non-verbal vocal sounds from game characters.
   Are they the same character, two different characters of the same kind,
   or two completely different kinds of creature or person?
   Answer with exactly one of: SAME / SAME KIND / DIFFERENT KIND.
   Then one sentence of reason.
   ```

   **(b) species identification.** 20 clips, fresh judge each:
   ```
   Listen to this short non-verbal vocal sound a character makes when
   greeting someone.

   1. Is the speaker human, reptilian, feline, or something else?
   2. Are they old or young? Male or female? Guess.
   3. Do they seem friendly, indifferent, or hostile toward the listener?
   4. What is their job or station, if you can guess?

   SPECIES: <...>  AGE/SEX: <...>  ATTITUDE: <friendly|indifferent|hostile>
   STATION: <...>
   ```
   Q3 is graded against the NPC's actual disposition band (friendly = warm/devoted,
   indifferent = neutral/cold, hostile = hostile). Q1 is graded against species.

7. **VO-6 — Jel non-translation.** Assert no subtitle/caption/tooltip is emitted while a
   `naga_*` palette sample plays: intersect `audioLog` voice frames with `getUIState()` text
   elements.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| VO-1 | Lexical budget + no accent markup | ≤60 barks; **0** grep hits in dialogue data | any phonetic-accent spelling in dialogue text; or full VO present |
| VO-2 | No audio gating of text | 100% of topics readable on the selection frame | any topic gated on a voice line |
| VO-3 | Sample dominance (VP5) | max sample share ≤ **8%** | any sample ≥ **25%** ("every NPC shares one grunt") |
| VO-4 | Effort frame lock | p99 ≤1 frame, max ≤2 | p50 > 1 |
| VO-5a | Blind same/different | ≥ **0.75** correct across 40 pairs | ≤0.40 (chance) |
| VO-5b | Blind species ID | species ≥ **0.85**; disposition ≥ **0.65** | species ≤ 0.40 |
| VO-6 | Palette census | 16 palettes, VP1–VP4 + VP6 + VP7 all clean | <4 palettes, or any NPC without one |
| VO-7 | Jel | ≥24 utterances, ≥6 recurring, 0 translations | any subtitle on naga speech |

Native scale **checks passed / 8**. 8/8 → meets the bar (ceiling 8). 5–7 → below bar, remedy
required (ceiling 6). ≤4 → loses outright (ceiling 4). Any hard fail caps at 2.

**Unimplemented voice scores 0**, not "not assessed". Note carefully: **"we chose not to do
full VO" is not a defence against a zero here.** This item does not score full VO — it scores
the vocal layer that text-first dialogue *requires in its place*. A game with silent NPCs has
not implemented the policy; it has implemented nothing and called it a policy. VO-3, VO-5a and
VO-5b all measure the same underlying question and all return 0 on a silent build.

**What we lose looks like:**
```
VO-6 palettes: 2 ("male_grunt", "female_grunt").  entropy 0.98 bits.
VO-3 max sample share: 0.41 ("grunt_01.wav")     -> HARD FAIL
VO-5a same/different: 0.38 (below chance)
VO-5b species: 0.30. Judge: "sounds like a man clearing his throat" x20
VO-1 grep: game/data/dialogue/topics/lilmoth.json:88  "Yesss, land-strider..."
                                                  -> HARD FAIL §B
=> Capped at 2. Every Argonian in Black Marsh is one man clearing his throat,
   and the writing has compensated by spelling the hiss.
```

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 5 / 8 checks | 7 / 8 checks | 8 / 8 checks |

**Aggregation (a property of this item, not of the critic):** count of passing checks; any hard fail caps the piece at 2.

## How we lose

- **Silence, defended as policy.** The most likely outcome by a distance. "No VO" is read as
  "no voice work", NPCs make no sound at all, and the greeting layer — the thing that made
  Morrowind's topic list feel like a conversation — is never built. The verdict then records a
  design decision where there is an absence. This item exists to make that distinction
  scoreable, and VO-3/VO-5 return 0 on silence exactly so the absence cannot hide behind the
  policy.
- **One grunt.** The second most likely. Two samples, `male_grunt` and `female_grunt`, assigned
  by an `if`, and 400 NPCs share them. It will sound acceptable for the first ten NPCs and
  ridiculous by the fiftieth, which is after every playtest has ended. VP5's 8% ceiling is the
  detector and it is deliberately aggressive.
- **The hiss goes in the text.** Someone wants Argonians to feel Argonian, and the cheapest
  available lever is spelling. It is a cliché, it makes 26.7-word lines slower to read, and
  3,888 lines of actual Morrowind Argonian dialogue contain none of it. This will be proposed,
  it will sound like flavour, and §B is the citation that settles it.
- **Full VO arrives by increments.** The bark set grows: 60 becomes 120 becomes "just the main
  quest givers" becomes a voiced main quest. Each step is small and defensible; the endpoint is
  AR-2 failure and a cut topic graph. The ≤60 hard number exists to make each increment a
  visible policy change rather than a commit.
- **Text becomes gated on audio anyway.** Even without full VO, someone adds a 1.6 s greeting
  and blocks input until it finishes, "so you hear it". Dialogue at Morrowind depth is read at
  the player's pace; a 1.6 s tax per conversation across a 200-quest game is hours of waiting.
  VO-2.
- **Disposition is not in the voice.** Palettes are built per species and the five disposition
  bands are dropped as scope, so a devoted ally and a man who hates you greet you identically.
  The information channel is silently halved and nothing detects it except VO-5b Q3, which is
  the check most likely to be waived as "subjective".
- **Naga get subtitled.** Someone finds untranslated speech unhelpful and adds captions, or a
  "Jel" skill that translates it. The strangeness requirement dies quietly, and the world stops
  containing anything the player cannot have. VO-7.
- **`voice_pitch` is `Math.random()`.** Same NPC, different voice each session. It violates
  HARNESS.md D1/D2, it makes VO-5a's SAME condition unmeasurable, and — worse than either — a
  character the player knows stops being recognisable. VP7.

## Seam (AR-3)

**Not sterile.** Two crossings, both real:

1. **`exhausted` (§C) is a Souls-side combat cue delivered by the characterisation system.**
   The palette that gives an NPC their greeting is the same palette that gives them their
   out-of-stamina gasp, so an enemy the player has *talked to* sounds like themselves when they
   are losing a fight. Under S13's parley requirement — a humanoid must have a non-lethal exit —
   the vocal continuity between the conversation and the fight is what makes yielding legible
   as an option rather than a menu item.
2. **Disposition-banded greetings are audible faction standing.** Disposition is a Morrowind
   out-of-fight quantity; hearing it change is what tells a player that a quest resolution
   moved it, without a UI notification (which S8/AR-2 would forbid).

## Provenance note

`provenance: measured`, `confidence: high` — unusually, the load-bearing claim in this item is
a real measurement rather than a construction.

**Measured on this machine, from files in this repository:**
- `corpus/40-dialogue/data/morrowind-dialogue.csv.gz` — **69,876 rows, 1,866,989 words, mean
  26.7 words/row**, counted by whitespace tokenisation of the `DialogueText` column. The 207-hour
  figure is `1,866,989 / 150 wpm / 60`, and 150 wpm is a conventional conversational rate, not a
  measurement — the word count is exact, the hours are an estimate with that one assumption.
- `corpus/60-lore/data/argonian-dialogue-corpus.json` — **3,888 lines, 151 distinct named
  speakers**, and **zero** regex matches for `\bhiss\w*`, `\bJel\b`, `\bsss+`, `\brasp\w*`,
  `\bclick\w*` (case-insensitive). The clipped-register examples in §B are quoted verbatim.

The Skyrim line-count comparison (~60,000 lines) is `canonical-recall`, `confidence: medium`,
and is offered as illustration rather than as a load-bearing number — the argument stands on the
1.87M-word measurement alone.

**Constructed:** the 16-palette table, the five disposition bands, the ≤60 bark budget, the
20%/3.2-bit/8%/6-variant thresholds in §D, the ≥24 Jel utterances with ≥6 recurring, and every
threshold in §Scoring. The 0.75 same/different and 0.85 species-ID targets in VO-5 are guesses at
what a fresh judge can achieve on 0.4–1.6 s non-lexical clips and are the numbers most likely to
need re-tuning after a first run — non-lexical audio is a harder judging task than RI-VIS07's
images or RI-AUD03's 20-second beds, and if VO-5b's species accuracy comes in low on a build
that is clearly not failing §D, the clip length is the first thing to raise.

**Harness additions requested:** `audioLog()` with `bus` and `sample_id` (already requested in
RI-AUD01), and `getUIState()` (requested in RI-UIX01) — VO-2 and VO-6 both need to know what
text is on screen on a given frame, and neither is measurable without it.
