---
id: RI-QST05
title: Non-combat resolution — the measurable pacifist fraction and first-class solution verbs
kind: number
side: morrowind
judges: [quests.resolution.noncombat, quests.resolution.methods, progression.skills.social, dialogue.persuasion, quests.schema]
provenance: derived
confidence: low
blind_pair: no
---

## The bar

ARBITRATION §1 puts "many quests resolvable by talk, bribe, sneak, theft, or lore knowledge" on the
Morrowind side of the line, and this is the item that turns "many" into a number a critic can compute.
The bar has two halves. **Coverage:** a measurable fraction of quests must be completable with zero
kills, and a larger fraction must offer at least one non-violent path even if a violent one also exists.
**Weight:** the non-violent path must be a real alternative — gated on a skill, an attribute, gold, or
something the player *learned* — not a free "you win" button that trivialises the quest. A persuasion
check that anyone passes is not a solution, it is a skip. The five verbs (persuade/intimidate, bribe,
sneak, steal, lore-knowledge) must each be load-bearing somewhere, so that a character sheet built for
talking, for stealing, or for reading is a viable route through the game's content and not just through
its combat. Souls owns the fight; this item guarantees the fight is not the only door.

## The reference artifact

### A. Morrowind's actual ratio (derived, low confidence)

No published census exists. What is established:

- A pacifist run of Morrowind's **main quest** is possible without killing humanoids, *but* the player
  must skip the Redoran Hortator, Telvanni Hortator, and Erabenimsun Nerevarine quests by substituting
  high level and reputation — those three require killing ordinary NPCs [10].
- **Imperial Cult** can be run almost entirely without killing; the almoner and healer paths require no
  kills, with one shrine-sergeant task as the exception [10].
- Dagoth Ur himself can be resolved without a straight fight (lured into the lava after the Heart is
  destroyed) [10].
- A fully pacifist completion of *all* major questlines is **not** feasible in vanilla; a community mod
  exists specifically to add "pacifist options to complete several quests in vanilla Morrowind — provided
  that it would make sense that such an option would exist" [11], which tells us both that the gaps are
  real and that they are perceived as gaps rather than as design.

Derived estimate over Morrowind's ≈427 base-game quests, by faction character:

| Segment | ~Quests | Est. zero-kill completable | Est. rate | Basis |
|---|---:|---:|---:|---|
| Main quest | ~27 | ~16 | ~60% | pacifist route documented with 3 named exceptions [10] |
| Thieves Guild | ~23 | ~18 | ~78% | line is built on sneak/steal/persuade |
| Imperial Cult | ~24 | ~21 | ~88% | almoner/healer paths; one exception [10] |
| Tribunal Temple | ~22 | ~12 | ~55% | pilgrimages non-lethal, heresy-suppression is not |
| Mages Guild | ~30 | ~14 | ~47% | mixed errand/dungeon |
| House Hlaalu | ~26 | ~13 | ~50% | bribery and politics |
| House Redoran | ~29 | ~8 | ~28% | honour-duel culture |
| House Telvanni | ~25 | ~9 | ~36% | |
| Fighters Guild | ~31 | ~7 | ~23% | contracts are largely extermination |
| Imperial Legion | ~21 | ~7 | ~33% | |
| Morag Tong | ~30 | ~1 | ~3% | assassin writs |
| Misc / settlement side quests | ~139 | ~62 | ~45% | fetch/deliver/dilemma heavy |
| **Total** | **~427** | **~188** | **≈ 44%** | |

**Stated as an honest range: Morrowind is approximately 35–45% zero-kill completable, most likely
around 40%.** This is `derived`, `confidence: low` — it is an estimate built from segment-level
reasoning and two verified data points, not a census. A future wave with a Construction Set data dump
should replace it. The number that matters for us is not Morrowind's exact figure but the *shape*: the
guilds differ enormously from each other (3% to 88%), which is itself the design statement.

### B. Our targets (constructed, binding)

| Metric | Definition | Target | Hard fail |
|---|---|---:|---:|
| **PACIFIST-ALL** | quests where `kill_required_npcs == []` **and** ≥1 resolution has `violence_required: false` | **≥ 45%** | < 30% |
| **NONVIOLENT-OPTION** | quests with ≥1 resolution where `violence_required == false` | **≥ 70%** | < 50% |
| **VIOLENCE-MANDATORY** | quests where every resolution has `violence_required: true` | **≤ 20%** | > 35% |
| **VERB-SPREAD** | share of non-violent resolutions held by the single most common `method` | **≤ 40%** | > 60% |
| **GATED-SOLUTIONS** | non-violent resolutions with a non-empty `requires` object | **≥ 80%** | < 60% |
| **KNOWLEDGE-KEYS** | quests with ≥1 resolution requiring `requires.knowledge` or `requires_knowing` | **≥ 25%** | < 10% |
| **MAIN-QUEST-PACIFIST** | PACIFIST-ALL restricted to `category: "main"` | **≥ 40%** | < 25% |
| **SIDE-PACIFIST** | PACIFIST-ALL restricted to `category: "side"` | **≥ 55%** | < 40% |

Per-faction floors and ceilings (each faction must be *characterised* by its ratio, not averaged into
mush):

| Faction archetype | PACIFIST-ALL floor | ceiling | Rationale |
|---|---:|---:|---|
| Thief/smuggler tier | 75% | — | if stealing is not a solution, the faction has no identity |
| Merchant house | 55% | — | money and law are its weapons |
| Religious order | 50% | — | pilgrimage and confession |
| Wizard house | 35% | — | |
| Martial guild | 20% | 45% | a mercenary company that never fights is not one |
| Assassin order | 10% | 30% | but see D6 below — the *target* must still be talkable |

**Spread requirement:** `max(faction PACIFIST-ALL) − min(faction PACIFIST-ALL) ≥ 40 points`. Four
factions all sitting at 45% means we averaged instead of designed.

### C. The five verbs as first-class solutions

Each verb must be load-bearing on ≥ 8 quests game-wide, each with a real requirement.

| Verb | `method` value | Gate | What it must feel like | Minimum quests |
|---|---|---|---|---:|
| **Persuade / intimidate** | `persuade`, `intimidate` | `requires.skills.speechcraft` + `requires.disposition`; intimidate additionally on Strength or faction rank | Fatigue and disposition affect the check (ARBITRATION S4: Fatigue survives out of fight); failing it can *lower* disposition and close the option permanently | 12 |
| **Bribe** | `bribe` | `requires.gold`, scaled to the NPC's standing (gold is the only currency, S15) | Expensive enough to be a decision; can be witnessed; can implicate the player (D9) | 8 |
| **Sneak** | `sneak` | `requires.skills.sneak` + world state (light, guard patrol) | Reaching the objective without entering `COMBAT` at all; detection converts the quest to a different branch, not to failure | 10 |
| **Steal** | `steal` | `requires.skills.security` or `sneak`; witnessed theft triggers faction expulsion (RI-QST03 E1) | The theft *is* the solution, not a shortcut around it | 10 |
| **Lore knowledge** | `lore_knowledge` | `requires.knowledge: [topic/book ids]` — the player must have actually read or heard it | The best solution in the game is knowing a thing. Books are keys, not decoration | 10 |
| *(supporting)* | `trade`, `alchemy`, `magic_utility`, `refuse`, `confess`, `wait` | varies | | 4 each |

Two rules that keep these honest:

1. **No universal skeleton key.** No single `method` may resolve more than 40% of all non-violent
   resolutions (VERB-SPREAD). In practice the failure mode is speechcraft-solves-everything.
2. **A failed non-violent attempt must have a consequence.** A persuasion attempt that can be retried
   until it succeeds is not a check. Each `persuade`/`intimidate`/`bribe` resolution must declare what
   happens on failure — either a `failure_states` entry or a disposition penalty in
   `consequences.npc_disposition`.

### D. The interaction with the arbitration boundary

Non-combat resolution and Souls combat meet at exactly one place and it must be got right:

- Approaching an NPC who *will* become hostile happens **outside** the fight. Topic lists are available;
  disposition, persuasion, bribery and lore all apply. This is Morrowind's jurisdiction.
- The instant `COMBAT` is entered, topic lists lock (ARBITRATION S13) and Souls owns everything.
- Therefore every kill-target NPC must have a **non-hostile approach state** — an aggro configuration in
  which the player can talk first. An NPC that is pre-aggroed makes RI-QST02 D6 architecturally
  impossible and silently destroys this item's KNOWLEDGE-KEYS metric.
- De-escalation *out of* combat is permitted only where a quest declares it (`method: "persuade"` with
  `requires_knowing`), and it must cost something — it is not a free reset.

## Comparison method

```bash
# Headline ratios.
jq -s '{
  n: length,
  pacifist_all: ((map(select(((.kill_required_npcs // [])|length)==0
                        and ([.resolutions[]|select(.violence_required==false)]|length)>0))|length)
                 / length * 100),
  nonviolent_option: ((map(select([.resolutions[]|select(.violence_required==false)]|length > 0))|length)
                 / length * 100),
  violence_mandatory: ((map(select([.resolutions[]|select(.violence_required==false)]|length == 0))|length)
                 / length * 100)
}' game/src/data/quests/*.json

# Verb spread across all non-violent resolutions.
jq -s '[.[].resolutions[] | select(.violence_required==false) | .method]
       | group_by(.) | map({method: .[0], n: length})
       | (map(.n)|add) as $t
       | {total: $t, dist: map(. + {pct: (.n/$t*100)}), max_pct: (map(.n/$t*100)|max)}' \
   game/src/data/quests/*.json

# Gated-solutions: non-violent resolutions that require nothing are skips, not solutions.
jq -s '[.[].resolutions[] | select(.violence_required==false)]
       | {total: length,
          gated: (map(select(((.requires // {})|length) > 0
                          or ((.requires_knowing // [])|length) > 0))|length)}' \
   game/src/data/quests/*.json

# Knowledge as a key.
jq -s 'map(select([.resolutions[] | select(((.requires.knowledge // [])|length)>0
                                        or ((.requires_knowing // [])|length)>0)]|length > 0))
       | length' game/src/data/quests/*.json

# Per-faction ratio and spread.
jq -s 'map(select(.faction != null)) | group_by(.faction)
       | map({faction: .[0].faction, n: length,
              pacifist: ((map(select(((.kill_required_npcs // [])|length)==0
                          and ([.resolutions[]|select(.violence_required==false)]|length)>0))|length)
                         / length * 100)})
       | {per_faction: ., spread: ((map(.pacifist)|max) - (map(.pacifist)|min))}' \
   game/src/data/quests/*.json

# Per-verb minimum counts.
jq -s '[.[].resolutions[].method] | group_by(.) | map({method: .[0], n: length})' \
   game/src/data/quests/*.json

# Failed-attempt consequence: every persuade/intimidate/bribe resolution's quest must declare a cost.
jq -s -r '.[] | . as $q | $q.resolutions[]
   | select(.method=="persuade" or .method=="intimidate" or .method=="bribe")
   | select((($q.failure_states|length)==0)
        and ((($q.consequences.npc_disposition // {})|length)==0))
   | "\($q.id):\(.id) — social attempt with no failure cost"' game/src/data/quests/*.json
```

**Live verification (not static), run once per wave:** pick 10 quests at random with
`pacifist_all == true` and actually complete them in-engine with a character whose weapon skills are at
starting values, recording kill count. Any quest that cannot in fact be completed without killing while
claiming `kill_required_npcs: []` is a **data lie** and fails the item outright regardless of the static
numbers. Record the run in `corpus/90-verdicts/`.

## Scoring

| Band | Condition |
|---|---|
| 9–10 | PACIFIST-ALL ≥ 45%, NONVIOLENT-OPTION ≥ 70%, verb spread ≤ 40%, gated ≥ 80%, per-faction spread ≥ 40 points, all five verbs ≥ their minimum, live verification clean |
| 7–8 | PACIFIST-ALL ≥ 38%, NONVIOLENT-OPTION ≥ 60%, four of five verbs at minimum |
| 5–6 | PACIFIST-ALL ≥ 30%, but one verb carries most of it, or the ratios are uniform across factions |
| 3–4 | PACIFIST-ALL 15–30%; non-violent options exist but are ungated skips |
| 0–2 | < 15%, or every non-violent option is a speechcraft check with no requirement |

**Hard fails:** PACIFIST-ALL < 30%; **VERB-SPREAD > 40%** (promoted from a band condition to a hard
fail, wave 0, W6); any verb of the five with 0 quests; any live-verification quest that
contradicts its own `kill_required_npcs`; any kill-target NPC that is pre-aggroed such that it cannot be
spoken to (this simultaneously fails RI-QST02 D6); **PACIFIST-ALL reported without a working stealth
and crime system** (see the dependency below).

> **AMENDED wave 0 (corpus-audit) — BAR-CRITIQUE-01 W6.** When this item was written, sneak and
> theft had **no subsystem path, no reference item and therefore no builder assignment**. That
> made speechcraft the *only buildable route* to a 30% pacifist fraction — and
> "speechcraft-solves-everything" is this item's own top-listed failure mode. **A threshold
> whose only reachable satisfaction is its own named failure is gameable by construction.**
>
> Two changes close it:
>
> 1. **VERB-SPREAD ≤ 40% is now a hard fail**, not a band condition. One verb carrying more
>    than 40% of the non-violent resolutions fails the item outright, whatever PACIFIST-ALL says.
> 2. **This item now formally depends on `RI-STL01` (detection and sneak), `RI-STL02` (theft,
>    locks, fencing) and `RI-CRM01` (crime, witnesses, justice)**, which exist as of wave 0 and
>    are registered under the `stealth.*` and `crime.*` roots. **If those systems are absent from
>    the build, PACIFIST-ALL is `unmeasurable` and scores 0** — per CRITIC-DOCTRINE §7.3 — rather
>    than being satisfied by dialogue alone. `RI-MAG02`'s utility effects (S19) are the fourth
>    route and count toward VERB-SPREAD as their own verb.
>
> Full reasoning: `CORPUS-COHERENCE-01.md` §7.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band. PACIFIST-ALL is unmeasurable (and therefore 0) if RI-STL01/02 and RI-CRM01 are unbuilt — W6.

## How we lose

- **Speechcraft solves everything.** One `persuade` resolution bolted onto every quest, no requirement
  beyond a skill number, no failure cost. PACIFIST-ALL reads 80% and the game has one solution wearing
  a hat. VERB-SPREAD is the check that catches it and it will be the metric we fail.
- **Flag-setting without implementation.** `violence_required: false` on resolutions that, in the
  built level, cannot be reached without fighting through the room. The data says pacifist, the map says
  otherwise. This is why live verification is mandatory and why it fails the item outright.
- **Combat as the default because combat is what we built.** The fight system is the fun part and gets
  the engineering. Sneak has no detection model, security has no lock model, so every "alternative"
  degrades into a dialogue box. Then the alternatives are text and the game is a hack-and-slash with a
  topic list.
- **Uniform factions.** Every line lands at 45% because we applied the target per-faction instead of
  designing per-faction. Morrowind's real signature is a 3%-to-88% range across guilds; ours will be a
  flat line and the spread check will read 6 points.
- **Free skips.** A "you may simply leave" resolution on every quest, ungated, that technically counts.
  GATED-SOLUTIONS catches this; the tell is `requires: {}` on a non-violent resolution.
- **Retryable checks.** Persuasion that can be attempted until it lands. Then no build fails at it, no
  build is characterised by it, and the whole gating structure of RI-QST03 becomes irrelevant outside
  combat.
- **Books as decoration.** We write in-world books (corpus/60-lore) and never wire a single one into
  `requires.knowledge`. The best-feeling solution in Morrowind — knowing a thing you read forty hours
  ago — never ships. KNOWLEDGE-KEYS < 10% is the specific number that will indict us.
- **Pre-aggroed targets.** Quest targets are placed as hostile spawns because that is how the combat
  encounters are authored, which deletes talk-first and takes D6 with it. This is the failure most
  likely to happen for purely technical reasons and to be discovered last.
- **The assassin exemption creeps.** "This faction is about killing" is true for one faction and becomes
  the excuse for four.

## Provenance note

- **Section A is `derived`, `confidence: low`.** Two facts are `community-data` verified this session:
  the main quest is pacifist-completable with the Redoran/Telvanni Hortator and Erabenimsun Nerevarine
  quests skipped via level and reputation, the Imperial Cult almoner/healer paths require no kills with
  one shrine-sergeant exception, and Dagoth Ur can be resolved by lava rather than by blade [10]; and a
  community mod exists to add pacifist options where they "would make sense", implying vanilla gaps
  [11]. The base-game quest total ≈427 is `community-data` [3]. **Everything else in that table —
  every per-segment estimate and the ≈44% total — is my own segment-level reasoning and must not be
  cited as a measured figure.** The honest claim is the range 35–45%.
- **Section B and C targets are `constructed`** and binding per CORPUS-CONTRACT §3. A constructed bar we
  can compute beats a real number we cannot.
- Section D restates ARBITRATION S4, S13 and S15 and adds one derived architectural requirement (kill
  targets must have a non-hostile approach state), which follows from S13 plus RI-QST02 D6.
- Direct page fetches were refused by this session's egress policy (403 at proxy); citations are to
  pages read via search summaries. A future wave with Construction Set access should replace section A
  with a real census: enumerate every quest's completion conditions and count those with no required
  kill. That is a one-day job with the data and would move this item to `measured`/`high`.

**Sources**
[3] [Morrowind talk:Quests — UESP](https://en.uesp.net/wiki/Morrowind_talk:Quests) ·
[10] [Pacifist Morrowind. Possible? — gamesas](https://www.gamesas.com/pacifist-morrowind-possible-t11687.html) ·
[11] [Pacifist Options - When it Makes Sense — Morrowind Nexus](https://www.nexusmods.com/morrowind/mods/47961)
