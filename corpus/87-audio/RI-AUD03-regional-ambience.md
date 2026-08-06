---
id: RI-AUD03
title: Regional ambience — every region identifiable by sound alone
kind: structure
side: morrowind
judges: [audio.ambience.region, world.region.identity]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **ARBITRATION: this item is `morrowind`.** Ambience is *outside the fight* and is
> **regional identity** — the same job the palette and the silhouette vocabulary do in
> RI-VIS05, done with the eyes shut. Souls has no authority here. A Souls-style approach to
> ambience (near-total silence outside boss arenas, so that the world reads as a mausoleum)
> would be **AR-2 leakage** — a Souls convention contaminating the world — and is a fail.
> Black Marsh is *loud*. It is a swamp full of animals.

## The bar

Morrowind's regions were identifiable before you looked up. The Ashlands' wind, the Bitter
Coast's frogs and dripping, the Ascadian Isles' birds, the West Gash's dry rustle — each was a
different *place* rather than a different volume of the same place. That is the property being
transposed, and it is stricter than it sounds: it means the ambience is not "a swamp loop",
because Black Marsh is thirteen regions and twelve of them are swamps.

The bar is a blind test that mirrors RI-VIS07 exactly. **Twenty seconds of ambience, no label,
no music, no footsteps: name the region.** If a listener cannot separate Blackwood from the
Deep Marshes, then the two regions sound the same, and if they sound the same they are the same
place with different fog, no matter what the palette table says.

The construction that makes this achievable is the **four-layer bed**. Regions are not
distinguished by having different loops; they are distinguished by having different *answers to
four questions*: what is the continuous floor, what moves on top of it, what punctuates it, and
what lives here. Two regions can share a base drone and still be unmistakable if their event
and creature layers differ — and, crucially, **absence is a layer**. Thornmarsh's identity is
partly that there is no birdsong inside the thicket; the Deep Marshes' identity is that there
are no birds at all. A bed that only ever adds is a bed that cannot express those.

## The reference artifact

### §A — The four-layer bed

| Layer | Role | Continuity | Voices | Level (rel. bed) | Update |
|---|---|---|---|---|---|
| **L1 base** | The floor. One continuous element that never stops while the region is loaded. Defines the region's spectral centre | looped, gapless, ≥30 s of material | 1–2 | 0 dB (bed reference, −28 LUFS-S) | crossfade on region change, 4.0 s |
| **L2 mid** | The moving texture: wind, water, insect mass, canopy. Modulated by weather and time of day | looped, 2–3 sublayers cross-faded by weather/ToD | 2–3 | −3 to −6 dB | continuous, weather-driven |
| **L3 event** | Sparse one-shots that punctuate: a branch, a splash, a distant axe, a bell, a rockfall | one-shot, **1 per 8–40 s**, seeded interval | ≤2 concurrent | −6 to +2 dB (may exceed the bed) | scheduled, seeded PRNG |
| **L4 creature** | The animals of this region, spatialised, rare and directional | one-shot, **1 per 45–180 s** | ≤2 concurrent | −4 to +4 dB | scheduled, seeded, panned |

Total ambience voices ≤ **8** (RI-AUD02 V5). Bed sits at **−28 to −24 LUFS-S** so that
RI-AUD01 §D's exploration budget (−26 to −22 including footsteps and cloth) is met.

**Rules on the bed.**

- **R1 — Every region declares all four layers, and a layer may be declared `null`.** `null` is
  a design statement, not an omission: Deep Marshes L4 is not "birds we haven't made yet", it is
  "there are no birds", and the check in §D reads it as content.
- **R2 — No region shares an L1 with another region.** Thirteen regions, thirteen base drones.
  This is the single rule that most directly produces the blind-test result.
- **R3 — L3 intervals come from the seeded PRNG** (HARNESS.md D1), so two runs of the same
  scenario produce the same ambience. Ambience is non-simulation code and *may* use unseeded
  randomness under HARNESS.md §8 — but then `audioLog` diverges between runs and the blind pack
  is not reproducible, so we give up the permission deliberately.
- **R4 — Interiors get their own bed**, not the exterior bed at −12 dB. A muffled version of
  outside is the sound of a hole in the design.
- **R5 — Night is a different L2/L4 selection, not a filter.** Marauder's Coast at night has
  drowned-things; the same gulls quieter is wrong.

### §B — The thirteen regional briefs

`ambient_audio` values are **quoted verbatim from `corpus/50-world/regions.json`** — that file
is the owner of regional identity and this table is its audio expansion, not a second opinion.
Where this table adds L1/L2/L3/L4 assignments, those are constructed here.

| Region | Tier | L1 base | L2 mid | L3 event | L4 creature |
|---|---|---|---|---|---|
| **Western Rootlands** | 1 | warm low reed-hum | reed rustle, shallow water | **hide-drum on a 90-second beat** (the region's signature — a metronome no other region has) | frog chorus (massed, non-directional), hackwing, mudcrab clatter |
| **Blackwood** | 2 | deep canopy pressure, no wind | **a solid wall of insect noise** — the densest L2 in the game | canopy drip; distant axe-strokes | chitin-hound call (eyeless, so it *calls to navigate* — a sonar-like double click) |
| **Eastern Rootlands** | 2 | low jelly-hum (a pitched, almost-musical drone) | water slapping stilts | oars; rope; stilt-creak | swamp-jelly bladder-pop, wamasu low call |
| **Marauder's Coast** | 2 | open sea floor, wide stereo | surf (tide-driven, ToD-linked) | rope creak; **one bell buoy audible from 600 m** — a fixed *positional* landmark, see R7 | gull-cry (day) / drowned-things (night) |
| **The Hive** | 2 | **a single sustained insect chord that shifts pitch with distance to the queen** — the only L1 in the game that is a *gradient*, not a loop | wing-wash | chitin scrape; cell-tick | drone pass-by (dog-sized, doppler) |
| **The Salt Hills** | 3 | dry open wind, **no insect layer under it** (the absence is the identity) | grass hiss | **legion horn on the hour** — diegetic clock | guar-bells; hill-wamasu at distance |
| **The Stone Forest** | 3 | **a low choral hum from the Hist** — pitched, chord-like, unsettling | wind through petrified trunks | **stone tick as boles cool** (rate rises after dusk) | wamasu herd; stone-beetle |
| **Thornmarsh** | 4 | dead-air room tone (a thicket has no distance) | **NO birdsong inside the thicket** → L2 is thorn-clatter only | **thorn-clatter like dice in a cup** | hackwing, muffled and always *above* |
| **Valus Ridge** | 4 | **wind through rock flutes — a real audible chord** (fixed pitch set, the only tonal L1 with defined notes) | high thin altitude wind | rockfall | hackwing screams (long reverb tail — the only region with real distance) |
| **The Clay Moor** | 4 | open-ground wind, flat | **kiln roar** (proximity-driven) | clay-crack; tool-strike | **untranslated naga speech** — see RI-AUD05 §D |
| **Crimson Coast** | 4 | vat-bubble (slow, organic, wet) | surf, damped | **the lichen's thin scream when trodden** — L3 triggered by the *player*, not the clock | dye-worm; red cormorant |
| **The Deep Marshes** | 5 | **a low intestinal gurgle** | still water, almost nothing | **NO birds.** L3 is near-empty by design: 1 per 30–40 s | **a sound like breathing that is not yours** — sourceless, never resolves to an entity |
| **Stone Wastes** | 5 | **near-silence** — the quietest L1, −34 LUFS-S | almost none | **tick of cooling stone**, then **the salt-storm roar** (weather-gated, the loudest ambience event in the game) | bone-picker; the last dying Hist (a failing version of Stone Forest's choral hum — *the two must be recognisably the same instrument, one of them broken*) |

**R6 — Two deliberate cross-references.** Stone Wastes' dying Hist is Stone Forest's choral hum
degraded, and Deep Marshes' breathing is not in any bestiary. These are the two places where
ambience carries *lore* rather than *identity*, and they are the AR-3 seam-crossers for this
item (§Seam below).

**R7 — Positional ambience emitters.** Marauder's Coast's bell buoy, the Salt Hills' legion
horn and the Clay Moor's kiln are **world-anchored `PannerNode` sources at fixed coordinates**,
not region-wide layers. They are navigational: a player who has learned the bell can locate
themselves in fog. This is the ambience contribution to S8 (no markers) — **the world tells you
where you are by sound**, because it is not allowed to tell you with an arrow.

### §C — The blind region test (mirrors RI-VIS07)

**Judge:** a fresh agent context per clip, no project material, has not read this file or
`regions.json`.

**Stimulus:** one 20-second capture, ambience buses only (`bus:"ambience"`), **no music, no
footsteps, no combat, no voice**, mono-safe stereo, normalised to −23 LUFS-I so loudness carries
no information. Filename `clip.wav`, neutral temp path.

**The prompt (verbatim; do not paraphrase, do not soften):**

```
Listen to this 20-second ambient sound recording from a video game world.

Answer these questions. Guess even when unsure.

1. Describe the place this recording is from, in one sentence.
2. Is it wet or dry? Open or enclosed? Living or dead?
3. Name the three most distinct individual sounds you can hear.
4. Is there anything here you have not heard in a game before?
   One sentence, or "no".
5. Could this recording be from the same place as any generic swamp,
   forest, or cave ambience you have heard? Yes or no.

Answer in exactly this format:

THE PLACE: <one sentence>
WET/DRY: <wet|dry>  OPEN/ENCLOSED: <open|enclosed>  LIVING/DEAD: <living|dead>
THREE SOUNDS: <a>, <b>, <c>
NEVER HEARD BEFORE: <one sentence, or "no">
GENERIC: <yes|no>
```

**Grading.** Q2 is the discriminator and it is machine-checkable against a key:

| Region | WET/DRY | OPEN/ENCLOSED | LIVING/DEAD |
|---|---|---|---|
| Western Rootlands | wet | open | living |
| Blackwood | wet | enclosed | living |
| Eastern Rootlands | wet | open | living |
| Marauder's Coast | wet | open | living |
| The Hive | dry | enclosed | living |
| The Salt Hills | dry | open | living |
| The Stone Forest | dry | enclosed | living |
| Thornmarsh | dry | enclosed | dead |
| Valus Ridge | dry | open | dead |
| The Clay Moor | dry | open | living |
| Crimson Coast | wet | open | living |
| The Deep Marshes | wet | enclosed | dead |
| Stone Wastes | dry | open | dead |

Note the key has **no duplicate triples** except (wet, open, living), shared by four coastal/
rootland regions — those four are separated by Q3 instead (bell buoy / hide-drum / oars /
lichen-scream), which is why R7's positional emitters and each region's signature L3 are
load-bearing rather than decorative.

**Pairwise separation.** The stronger form: give one judge **two** 20 s clips and ask "same
place or different places?" Run all 78 unordered pairs. This is the real measurement — a region
set can score well on individual description and still be pairwise indistinguishable.

## Comparison method

1. **Capture one clip per region.**
   ```bash
   for r in $(node -e "console.log(Object.keys(require('./corpus/50-world/regions.json').regions).join(' '))"); do
     node tools/harness/run-headless.mjs --scenario amb-region --region "$r" \
          --seed 1337 --frames 1200 --audio-capture --buses ambience \
          --out reports/runs/amb/$r
   done
   ```
   `amb-region` teleports the player to the region centroid, sets `setTimeOfDay(13)` and
   `setWeather('clear')`, steps 240 frames to settle, then captures frames 240–1440 (20 s at
   60 Hz) via `audioCapture()` with only the `ambience` bus enabled.

2. **Normalise and anonymise.**
   ```bash
   node tools/blind/audio-pack.mjs --in reports/runs/amb --lufs -23 --strip-meta \
        --out packs/amb-w<N>
   ```

3. **B1 — description test.** 13 fresh judges, one clip each, §C prompt verbatim. Record
   answers verbatim; grade Q2 against the key.

4. **B2 — pairwise separation.** 78 fresh judges, two clips each, prompt:
   `"Are these two 20-second recordings from the same place in a game world, or different places? Answer SAME or DIFFERENT and give one sentence of reason."`
   Compute `separation = (# correctly answered DIFFERENT) / 78`.

5. **B3 — the generic trap.** From Q5, `generic_rate = (# answering "yes") / 13`.

6. **B4 — layer census** (static, no browser):
   ```bash
   node tools/analysis/content-stats.mjs --audio game/data/audio/ambience/
   ```
   Reads `game/data/audio/ambience/<region>.json` and asserts per region: four layers declared
   (`null` permitted and counted as declared), L1 asset id unique across regions, L3 interval
   inside 8–40 s, L4 interval inside 45–180 s.

7. **B5 — bed level.** Integrated LUFS over each clip, must be −28 to −24 (Stone Wastes
   exempt at −34 ± 2).

8. **B6 — positional emitters.** For each of the three R7 emitters, walk a 200 m transect past
   it and assert `audioLog.pan` and gain vary monotonically with bearing and distance.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| B1 | Q2 triple correct | ≥ **10 of 13** regions | ≤ 4 of 13 |
| B2 | Pairwise separation | ≥ **0.80** of 78 pairs answered DIFFERENT | < 0.50 (regions are one sound) |
| B3 | Generic rate (Q5 = yes) | ≤ **0.25** | ≥ 0.75 |
| B4 | Layer census | 13/13 regions, all four layers declared, 13 unique L1s | any two regions sharing an L1 asset |
| B5 | Bed level | 13/13 in band | any region > −18 LUFS-I (ambience has eaten RI-AUD01's headroom) |
| B6 | Positional emitters | 3/3 | none implemented |

Native scale **checks passed / 6**. 6/6 → meets the bar (ceiling 8). 4–5 → below bar, remedy
required (ceiling 6). ≤3 → loses outright (ceiling 4). Any hard fail caps at 2.

**Unimplemented ambience scores 0**, not "not assessed" — a region with no `<region>.json`
audio file scores 0 for that region and cannot be excluded from the 13.

**What we lose looks like:**
```
B1 4/13.  B2 separation 0.34.  B3 generic_rate 0.85.
B4 13 regions, 1 unique L1 asset ("swamp_amb_loop.ogg") -> HARD FAIL
Judge, Deep Marshes: THE PLACE: a swamp at night.  THREE SOUNDS: crickets,
water, frogs.  NEVER HEARD BEFORE: no.  GENERIC: yes.
Judge, Stone Wastes: THE PLACE: a swamp at night.  [identical]
=> The world has one region. Capped at 2.
```

## How we lose

- **One swamp loop.** Black Marsh is a swamp, a swamp loop exists in every asset library, and
  it will be dropped in as a placeholder in wave 1 and never removed. Every region becomes
  "wet, enclosed, living" and B2 collapses. R2 (unique L1 per region) is the one rule that, if
  enforced from the first commit, makes this failure impossible rather than merely detected.
- **Absence is never implemented.** Thornmarsh has no birdsong and the Deep Marshes have no
  birds — but implementing a bed is additive work, so both quietly get the standard bird layer
  because it is already wired up. The two most distinctive regions become the most generic
  ones. R1 (`null` is a declared value) exists so that "no birds" is a data row a check can
  read, rather than an absence indistinguishable from unfinished work.
- **Ambience is mixed by ear at exploration volume and buries the fight.** It sounds rich, it
  is 6 dB too loud, and RI-AUD01 §D's headroom is gone — so the boss roar has nowhere to go and
  the parry chime competes with insects. B5 catches it; the temptation not to fix it is strong
  because the exploration mix is what everyone hears first and it sounds *better* too loud.
- **The signature sounds become wallpaper.** The hide-drum's 90-second beat, the legion horn on
  the hour, the bell buoy — each is distinctive *because it is rare*. Someone finds them
  atmospheric and raises the rate to every 15 seconds. Identity becomes irritation, and the
  positional emitters stop being navigational because a landmark you hear constantly carries no
  position. §A L3/L4 interval bands are checked in B4 for this reason.
- **Interiors are the exterior bed low-passed.** R4. Cheap, universal, and it makes every
  building in the game feel like a tent. Nobody reports it because it is not *wrong*, it is
  just nothing.
- **Weather and time-of-day are wired to gain instead of to selection.** Night is day at −8 dB;
  rain is the bed plus a rain loop. The world has one state with four volume knobs. R5.
- **The blind test is run by someone who has read this file.** They hear the jelly-hum and
  write "Eastern Rootlands" because they know the table. The result is meaningless and it is
  recorded as a strong pass. Same failure as RI-VIS07's non-fresh judge, and the same guard:
  the runner must assert an empty judge context before sending.
- **Pairwise separation is never run** because 78 judges is expensive, and B1 alone is passed by
  a region set that is individually describable but mutually identical — "a wet enclosed living
  place" is a correct description of eight of our thirteen regions. B2 is the check that costs
  the most and catches the most, and it is the one most likely to be quietly dropped.

## Seam (AR-3)

**Not sterile.** Three boundary-crossing interactions:

1. **Ambience is the S8 wayfinding instrument.** R7's positional emitters mean the player
   navigates by ear where markers are forbidden. A Morrowind ruling (no markers) is made
   playable by an audio system, and the emitters are checked by B6.
2. **The Deep Marshes' breathing and the Stone Wastes' dying Hist carry lore** (R6) that no
   book states — the Stone Wastes' L4 is audibly the Stone Forest's L1 failing, which is the
   Hist's decline stated in sound before it is stated in text (see `corpus/60-lore/`).
3. **The absence of a creature layer is danger signalling.** Deep Marshes and Stone Wastes are
   the two tier-5 regions and they are the two quietest. Under S9 (Souls: regions gated by
   lethality, never level-scaling) the player is owed a legible warning that a region is beyond
   them, and silence is that warning — a lethality cue delivered by an outside-the-fight system.

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **thirteen `ambient_audio` briefs are quoted verbatim from
`corpus/50-world/regions.json`** and carry that file's provenance (mixed `canonical-recall` for
canonical regions such as Thornmarsh, `corpus-added` for The Salt Hills and others). They are
not invented here; this item expands them into a layer structure and does not overrule them. If
`regions.json` changes, this table follows it, not the reverse.

The **four-layer bed model** is `canonical-recall` of standard game-ambience practice
(bed/texture/one-shot/creature is the conventional decomposition) and is high-confidence as a
structure. The **numbers are constructed**: the 8–40 s and 45–180 s interval bands, the −28 to
−24 LUFS-I bed level, the ≤8 voice cap (inherited from RI-AUD02 V5), the 4.0 s crossfade, and
every threshold in §Scoring — the 10/13, the 0.80 pairwise separation, the 0.25 generic rate.

Confidence is `medium`, and the specific reasons are worth recording because they are what a
successor should re-tune first: (1) no judge has been run against the §C prompt, so the 10/13
threshold is a guess at achievable accuracy — RI-VIS07 carries the same untested-prompt caveat;
(2) the WET/DRY/OPEN/LIVING key in §C is authored here from the `regions.json` briefs and one
row is genuinely arguable — The Clay Moor is graded `living` on the strength of the naga
settlements, though its brief is dominated by kiln and open ground, and a judge could
defensibly answer `dead`. If early runs show Clay Moor failing B1 on that axis alone, the key
is wrong, not the build.

**Harness additions requested:** `audioCapture()` with a `buses` filter (ambience-only capture
is required to run this item at all), and `audioLog()` entries for ambience with `bus`,
`pan` and `region` fields. Both are listed in RI-AUD01/RI-AUD02 §Provenance note.
