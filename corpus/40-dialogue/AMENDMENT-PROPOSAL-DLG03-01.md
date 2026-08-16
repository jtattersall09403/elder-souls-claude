---
id: AMENDMENT-PROPOSAL-DLG03-01
title: RI-DLG03 step 7's diegetic lint is unanchored — run as written it fails the build for the word "question"
kind: text
side: neutral
status: PROPOSED — unruled. Filed by a BUILDER; see "Why a builder is not fixing this" below.
proposed_by: W1-DIALOGUE-AUTHORING-LEAK round-2 builder
diagnosed_by: W1-DIALOGUE-AUTHORING-LEAK round-1 critic (verdict FAIL at 5, 2026-08-16)
target: corpus/40-dialogue/RI-DLG03-greetings-and-rumours.md §"Comparison method", Step 7
wave: 1
---

# The defect

`RI-DLG03`'s **Step 7 — the diegetic lint** is an **automatic-fail** dimension. Its instrument,
verbatim from the item:

```
(?i)\b(quest|objective|marker|waypoint|your (map|journal|compass)|coordinates?|[0-9]+ ?(m|metres|meters|yards)\b|head (north|south|east|west) [0-9])
```

**The `\b` sits before the alternation, not around it.** So the group matches any *prefix*, and
`\bquest` matches **question**, **questions**, **questioned**, **questioning**. `marker` matches
`markers`; `objective` matches `objectively`. The item's own instrument fails a build for
containing ordinary English.

# The measurement

Re-derived 2026-08-16 by the round-2 builder, running the regex **exactly as printed** (the
leading `(?i)` translated to the `/i` flag, nothing else altered), over JSON string values:

| Scope | strings | verbatim hits | of which the match is the word *question* | word-anchored hits |
|---|---:|---:|---:|---:|
| `game/data/dialogue/rumours.json` — the item says *"the whole rumour corpus"* | 926 | **4** | 1 | **3** |
| `game/data/dialogue/**` — every dialogue file | 14,023 | **215** | **131** | **70** |

**Word-anchored** means the same alternation wrapped as `\b( … )\b`, which is what the item
plainly intends.

**What survives anchoring, and it matters more than the counts.** Under the item's own declared
scope — the rumour corpus — all 3 anchored hits are in `_note` keys (`w1_19_note`,
`w1_19_gen3_note`, `w1_17_successor_note`): design notes about the data, never rendered.
**Zero rumour lines the player can hear match at all.** Widened to the whole dialogue corpus, the
only *spoken* anchored hit is one `RG-VAKH` greeting stance, shipping across 5 race cells:

> *"Take the marker. It floats when nothing else does."*

That is a physical float on a river marking a route, which is precisely the Morrowind way, not a
HUD waypoint. Read and cleared, by the round-1 critic and independently here.

**A disagreement recorded rather than smoothed over.** The round-1 critic reported **46 hits, 45
of them "question"**. I could not reproduce 46 under either scope above and I do not know their
collector's exact surface — they built a consumer-traced set of 4,284 rendered strings, which is
neither of mine. **The counts differ; the finding does not.** Both derivations agree the regex is
unanchored, that the overwhelming majority of its hits are the word *question*, and that the one
substantive spoken hit is the `RG-VAKH` marker line and is clean. Anyone ruling on this should
re-derive rather than take 46 or 215 from either of us.

# What is proposed

Anchor the alternation, and nothing else:

```
(?i)\b(quest|objective|marker|waypoint|your (map|journal|compass)|coordinates?|[0-9]+ ?(m|metres|meters|yards)|head (north|south|east|west) [0-9])\b
```

Optionally — and this is a second, separable question a ruler may reject independently — restrict
the lint to **rendered** strings, excluding design-note keys. Under the rumour scope that change
alone takes the anchored hits from 3 to 0, because all 3 are `_note` fields. A lint that fails the
build for what a *comment* says is the same defect one layer up.

# Why a builder is not fixing this

**Anchoring a regex narrows what fails.** Doing that to the item that grades dialogue work, in the
same round as a dialogue fix, is the shape every guard in this piece exists to prevent — and
`CRITIC-DOCTRINE` §1.3 forbids a critic relaxing a bar for the same reason. The round-1 critic
filed it as a `method_gap` and declined to fix it; so does this builder. **It is proposed here and
left unruled.**

Neither the round-1 critic nor this builder used step 7 to lower any score, in either direction.
