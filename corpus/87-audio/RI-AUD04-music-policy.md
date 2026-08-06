---
id: RI-AUD04
title: Music policy — the coverage budget, and where silence is correct
kind: number
side: neutral
judges: [audio.music.policy, combat.boss.arena]
provenance: constructed
confidence: medium
blind_pair: no
---

> **ARBITRATION: this item is `neutral` and resolves a seam explicitly.**
> `subsystems.json` records `audio.music.policy` as `arb: souls`. That is correct for *one*
> half of the question and misleading for the other, so this item states the split and is the
> authority for it:
>
> | Question | Where it sits | Who wins |
> |---|---|---|
> | Does a boss fight have music, and when does it start and stop? | **inside the fight** | **SOULS** |
> | Does the overworld have music, and how much of the time? | **outside the fight** | **MORROWIND** |
> | Does an *ordinary* enemy encounter have music? | inside the fight | **SOULS** — and Souls' answer is **no** |
>
> The third row is where the two sides agree and it is the row most likely to be broken,
> because "combat starts → play combat music" is the single most common convention in the
> genre and it belongs to neither reference.

## The bar

**Music is an event, not a floor.** In Dark Souls the overworld is scoreless: you walk Anor
Londo in silence and the absence is what makes the fog gate mean something. When music starts,
something is happening — and because it is rare, it is *information*. In Morrowind music is
place-based and intermittent: a track plays, ends, and leaves you in the world for a while
before another begins. Neither reference runs a wall-to-wall score, and neither triggers an
orchestral sting because a mudcrab noticed you.

The measurable form of this is a **coverage budget**: the fraction of playtime with any music
bus audible must be **low, and bounded on both sides**. Too high and the game is a film score
with a game attached, the boss theme is just more music, and RI-AUD03's thirteen regional
ambiences — the actual identity work — are inaudible under a string pad. Too low and we have
imported Souls' *world* policy along with its fight policy, which is AR-2 leakage: Morrowind is
not a mausoleum, and a Black Marsh with zero music is a Black Marsh with no Argonian drums, no
tavern player, no arrival theme for a xanmeer you have walked three hours to reach.

The band is **8–20% of session wall-clock, target ~12%**. Both edges are failures.

## The reference artifact

### §A — The four music classes, and the one that does not exist

| Class | Trigger | Arb | Duration | Budget share of a 60-min session |
|---|---|---|---|---|
| **M-A boss** | crossing a fog gate into a boss arena | **SOULS** | whole fight | ~4–6 min if one boss is fought → **7–10%** |
| **M-B place** | entering a settlement/interior that *contains a source*; a named landmark's arrival theme | **MORROWIND** | 60–180 s, then stops | **3–6%** |
| **M-C discovery** | first arrival at a major POI, first sight of a Hist, a revelation in the main quest | MORROWIND | 15–40 s sting, non-looping | **1–2%** |
| **M-D system** | death, level-up at a HEARTH shrine, title, credits | neutral | 3–12 s | **<1%** |
| ~~**M-X combat**~~ | ~~any non-boss enemy entering COMBAT~~ | — | — | **DOES NOT EXIST. 0%. Hard fail if present.** |

**M-X is the whole point of this document.** There is no ordinary-combat music layer, no
"combat intensity" stinger, no dynamic string swell when a chitin hound aggros, and no
"exploration → combat" crossfade. The reasons are not stylistic:

- It is what Souls does not do, and Souls owns inside-the-fight.
- It destroys RI-AUD01. A music bed under a fight consumes the headroom (RI-AUD01 §D) that the
  parry chime and the impact classes need, and blind class-distinguishability (RI-AUD01 M2)
  falls off a cliff when measured against a scored mix rather than a dry one.
- It leaks quest information. Music that starts when a hostile is nearby tells the player
  something the world has not told them — a HUD element wearing an orchestra, and functionally
  a marker under S8.
- It makes the boss theme ordinary. If music means "a fight", then music at the fog gate means
  nothing new.

**M-B is deliberately diegetic-first.** The default is that music in the world has a *source
in the world*: a player in the tavern at Lilmoth, drums at a Rootlands village, a work-song at
the Clay Moor kilns. A diegetic source is spatialised (RI-AUD02 §E), attenuates with distance,
and stops when the musician stops. Non-diegetic M-B is permitted for **arrival themes at named
landmarks only** and is capped at 6 per playthrough.

### §B — The boss music contract (Souls, frame-exact)

| # | Property | Value |
|---|---|---|
| G1 | Onset | within **±30 frames (0.5 s)** of the `fog_gate_crossed` event |
| G2 | Onset trigger | the **fog gate**, not enemy aggro, not arena entry, not first damage |
| G3 | Stop on victory | fade begins within **120 frames (2 s)** of the boss `death` event; fade ≤ 3 s |
| G4 | Stop on player death | fade begins within **30 frames** of the player `death` event; fade ≤ 1.5 s |
| G5 | Stop on retreat | if the player exits the arena volume, music stops within 120 frames and **restarts from the top** on re-entry — never resumes mid-track |
| G6 | Phase transition | a phase-2 layer may enter on the boss's phase-change event; it is a **layer**, not a track change, and no gap is permitted |
| G7 | Coverage during the fight | ~**100%** — the boss fight is the one place wall-to-wall is correct |
| G8 | Bus level | music bus ≤ **−14 LUFS-S** during the fight, and RI-AUD01 §D's boss budget (−18 to −14 overall) is met *with* music included |

G2 is the load-bearing row. In Souls the fog gate is a *commitment* — you push through, the
music starts, and the ritual is what makes the arena feel different from a corridor. Tying music
to aggro instead means the theme starts while you are still deciding, and the commitment is
gone.

G5's "restart from the top" is deliberate and is the ungenerous choice: it means a player who
retreats to heal loses the build-up. That is Souls' behaviour and it is part of why retreating
feels like losing ground.

### §C — The coverage budget

Measured over a **representative 60-minute session** (defined in §Comparison method, step 1):

| Metric | Value |
|---|---|
| **Target coverage** | **12%** of wall-clock |
| **Pass band** | **8% ≤ coverage ≤ 20%** |
| **Hard fail (high)** | **> 30%** — wall-to-wall score |
| **Hard fail (low)** | **< 4%** — Souls' world policy has leaked (AR-2) |
| Longest continuous music span outside a boss fight | ≤ **180 s** |
| Longest continuous **silence** span (no music, ambience only) | ≥ **300 s** must occur at least **4×** per session |
| Ordinary-combat coverage | **exactly 0%** |
| Boss-fight coverage | ≥ 95% |

The **silence requirement is a real check and not rhetoric**: a game can sit at 15% coverage by
playing 9 seconds of music every minute, which is the worst of both policies. Requiring four
uninterrupted five-minute stretches of scoreless world per hour is what actually delivers
"music is an event".

**Worked decomposition to 12%** (this is how the band was derived, not a target to hit
component-by-component):

```
one boss fight, 4.5 min                     M-A   4.5 min
Lilmoth tavern + a village drum circle      M-B   2.5 min
three discovery stings, ~25 s each          M-C   1.25 min
two deaths, one level-up                    M-D   0.2 min
                                            ----  --------
                                            total 8.45 min / 60 min = 14.1%
a session with no boss fight                      3.95 min / 60 = 6.6%   <- below the band
```

That last line is the honest awkwardness in this budget and it is recorded rather than hidden:
**a boss-free hour lands under 8%**. The band is therefore assessed over a session that
contains at least one boss fight, and a boss-free session is scored against a
**secondary band of 4–12%** with the M-A term removed. Both bands are stated in §Scoring.

### §D — What music must never do

| # | Rule | Why |
|---|---|---|
| N1 | Never start because an ordinary enemy aggroed | M-X does not exist |
| N2 | Never duck ambience below RI-AUD03's bed floor to make room for itself | the regions are the identity |
| N3 | Never play during dialogue | Morrowind's dialogue is read; a score over prose is a film convention |
| N4 | Never signal a quest state (a "you found it" swell on approach) | that is a marker (S8, AR-2) |
| N5 | Never loop seamlessly for more than 180 s outside a boss arena | endless loops are the mechanism by which coverage silently reaches 60% |
| N6 | Never crossfade between two music tracks | if one is ending and another is starting, there should have been silence between them |
| N7 | Never resume a track after an interruption | restart or stay silent (G5) |

## Comparison method

1. **Define the session.** The measured session is `RI-EXP01`'s first-hour scenario if it
   exists; otherwise the fixed scenario `aud-session-60`: 216 000 frames (60 min at 60 Hz),
   seed 1337, a scripted route that crosses ≥4 regions, enters ≥2 settlements, fights ≥12
   ordinary encounters and ≥1 fog-gated boss. Record which was used — the coverage number is
   meaningless without it.

   ```bash
   node tools/harness/run-headless.mjs --scenario aud-session-60 --seed 1337 \
        --audio-log --music-log --frames 216000
   node tools/analysis/music-coverage.mjs --run reports/runs/<runId>
   ```

2. **Coverage.** `music-coverage.mjs` reads `music-log.json` (`musicState()` sampled every
   frame, or the `music_start`/`music_stop` trace events) and computes:
   `coverage = Σ(playing frames) / total frames`, plus per-class breakdown, the longest music
   span, the longest silence span, and the count of silence spans ≥ 300 s.

3. **Ordinary-combat coverage (the critical check).** From the trace, build the set of frames
   where any enemy has `alert_state == "AGGRO"` and no entity with `tier == "boss"` is present.
   Compute `ordinary_combat_music = |{f in that set : music playing}| / |that set|`.
   **This must be 0.000.** Report the raw numerator, not the ratio alone — one frame is a
   finding, and a ratio rounds it away.

4. **Boss contract.** For each boss fight in the trace, extract `fog_gate_crossed`,
   `music_start`, boss `death`, player `death`, arena exit/entry, and phase-change events, and
   evaluate G1–G7 as frame arithmetic. G8 from `audioCapture()` over the fight window.

5. **N-rules.** N1 from step 3. N3: intersect music-playing frames with frames where a dialogue
   UI is open (`getUIState().mode == 'dialogue'`, RI-UIX-requested). N5/N6/N7 from the music log:
   any span > 180 s outside an arena, any two spans with < 1 frame gap between different
   `track` ids, any `music_start` with `resumeFrom > 0`.

6. **Diegetic check for M-B.** For each M-B span, assert `musicState().source` is either a world
   entity id (diegetic — then verify pan varies with player bearing as in RI-AUD03 B6) or one of
   the ≤6 declared landmark arrival themes listed in `game/data/audio/music.json`.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| P1 | Session coverage | **8–20%** (boss session) / **4–12%** (boss-free session) | **>30%** or **<4%** |
| P2 | Ordinary-combat music | **0 frames** | any frame ≥ 1 |
| P3 | Boss onset G1/G2 | onset within ±30 f of fog gate, **and** triggered by the gate | triggered by aggro or arena entry |
| P4 | Boss stop G3/G4/G5 | all three within their windows | music continues after boss death |
| P5 | Silence spans | ≥4 spans of ≥300 s | 0 spans ≥ 300 s |
| P6 | Longest non-boss span | ≤180 s | any endless loop (span == session length) |
| P7 | N-rules | N1–N7 all clean | N3 (music over dialogue) or N4 (quest-state swell) |
| P8 | M-B diegesis | ≥50% of M-B time is diegetic; ≤6 landmark themes | 0% diegetic |

Native scale **checks passed / 8**. 8/8 → meets the bar (ceiling 8). 5–7 → below bar, remedy
required (ceiling 6). ≤4 → loses outright (ceiling 4). Any hard fail caps the piece at 2.

**Unimplemented music scores 0**, not "not assessed". But note the asymmetry, because it is a
real hole a builder will find: a game with **no music at all** measures `coverage = 0%`, which
is **hard fail (low)** on P1 — not a pass on "sparseness". Zero music is not the same as
disciplined music, and the low bound exists so that "we never implemented it" cannot be
reported as "we exercised restraint".

**What we lose looks like:**
```
P1 coverage 0.61   (M-A 4%, M-X 22%, "exploration theme" 35%)
P2 ordinary_combat_music: 41 203 frames    -> HARD FAIL
P3 boss onset: +14 f after `enemy_state AGGRO`, fog_gate_crossed not consumed -> HARD FAIL
P5 silence spans >=300 s: 0
P6 longest non-boss span: 216 000 f (the whole session)
=> Capped at 2. The game has an exploration loop and a combat loop, like every
   other game, and the boss theme is the third loop.
```

## How we lose

- **M-X gets built on day one and is never questioned.** "Enemy aggros → combat music" is the
  most reflexive system in game audio; it is in every tutorial and every asset pack ships with
  a combat loop. It will be added early, it will feel good in isolation, and it takes the boss
  theme, RI-AUD01's headroom and S8's information discipline down with it. P2 is measured in
  raw frames rather than a ratio precisely because this failure is normally invisible in
  aggregate.
- **The exploration loop.** Someone finds an hour of walking too quiet, adds a two-minute
  ambient track on a loop, and coverage goes to 100% in one commit. It will be defended as
  Morrowind-like, and that defence is *half* right, which is what makes it dangerous —
  Morrowind did have explore music. What it did not have was a seamless loop. N5 and P6 are the
  checks; the argument is settled by the "≥4 silences of ≥300 s" requirement, which is the
  operational difference between "sometimes there is music" and "there is always music".
- **Coverage is measured on a five-minute clip.** A five-minute run past a tavern reads 40%; a
  five-minute walk reads 0%. Neither is the number. The 60-minute fixed session is expensive
  and will be shortened; a shortened session invalidates P1 and must invalidate the score, not
  be scaled up.
- **Boss music is tied to aggro because fog gates were not built yet.** A plausible ordering of
  work that permanently misplaces G2 — once the aggro trigger works, nobody rewires it. Then
  the boss theme starts while the player is still peering into the arena, and the fog gate,
  when it arrives, is a door.
- **Music over dialogue.** N3 will be violated by accident: dialogue happens in settlements,
  settlements are where M-B plays, and nobody ducks it. Morrowind's dialogue is *read*, at the
  player's pace, and a score under 400 words of prose turns reading into waiting.
- **Ducking solves everything.** Ambience is ducked 9 dB under music; music is ducked under
  dialogue; impacts are ducked under music. Every conflict is resolved with a compressor and
  the mix becomes a hierarchy of things suppressing each other. N2 forbids the specific case
  that matters — the regions are the identity and must not be duckable — but the general habit
  is what to watch for.
- **The band gets widened after the first measurement.** Coverage comes in at 34%, and the
  conversation is about whether 30% was too strict. The band is derived in §C from an explicit
  decomposition; move the band only by rewriting that decomposition, and record the rewrite.

## Seam (AR-3)

**Not sterile.** The boss-music contract is a seam-crosser by construction: the fog gate is a
Souls object (G2) placed in a Morrowind world, and G5's restart-from-the-top makes retreat —
which ARBITRATION §1 protects as a legitimate Morrowind-side resolution — carry a real Souls-side
cost without being punished mechanically. The player may always leave; the music makes leaving
*mean* something. That is the seam working rather than two systems coexisting.

Secondarily, M-B's diegetic-first rule ties music to NPC schedules: the tavern player at Lilmoth
is an NPC with a schedule (`game/data/npcs/`), so the settlement's music depends on the time of
day and on whether that NPC is alive — which, under S10 (you can kill anyone), means a player
can silence a town.

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **policy shape** is `canonical-recall` and is high-confidence: Dark Souls' overworld is
unscored and its music is arena-bound and fog-gate-triggered; Morrowind's music is intermittent
and place-associated rather than continuous. Both are well-established properties of the
references.

The **coverage numbers are constructed**, and one point of honesty is owed here because it is
the weakest claim in this file. **Morrowind's actual overworld music coverage was higher than
12%** — its explore tracks played fairly readily, with gaps rather than long silences, and a
strict reading of "Morrowind wins outside the fight" would license a considerably larger budget
than this item sets. This item deliberately takes Morrowind's *principle* (music is
place-associated and intermittent, not a continuous score) and Souls' *discipline* (silence is
the resource that makes an event land), and lands nearer the Souls end than a pure Morrowind
reading would. That is a judgement, it is recorded as one, and it is the row a future critic is
most entitled to re-litigate. What is **not** negotiable and is not a judgement call is the
M-X = 0% rule, which both references agree on.

The 12% target and 8–20% band come from the §C decomposition. The ±30-frame onset window, the
120-frame stop window, the 180 s cap, the four-silences requirement and the ≤6 landmark themes
are all authored here and have no upstream source. Confidence `medium` because no session has
been measured; the first real `aud-session-60` run should be used to check whether the
decomposition's assumptions (one boss per hour, 2.5 min of settlement music) match how the game
actually plays, and the band re-derived if they do not.

**Harness additions requested:**

```js
musicState(): {
  playing: boolean,
  class: 'boss'|'place'|'discovery'|'system'|null,
  track: string|null,
  layers: string[],            // G6 phase layers
  source: string|null,         // entity eid if diegetic, else landmark id, else null
  startedFrame: number|null,
  resumeFrom: number,          // must always be 0 (N7)
  bus_lufs_s: number
}
```
plus the trace `events[]` vocabulary additions `music_start`, `music_stop`, and
**`fog_gate_crossed`** — G2 cannot be checked without the last one, and it is owed by the
combat/boss owner rather than by audio.
