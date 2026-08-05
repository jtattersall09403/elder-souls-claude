# The Arbitration Rule

> **Inside the fight, Souls wins. Everywhere else, Morrowind wins.**

This is the supreme law of the corpus. Every reference item, every critic, every builder
is subordinate to it. When a reference item from the Morrowind side and a reference item
from the Souls side make incompatible demands, this document decides which one is
authoritative — not the builder's taste, not the critic's mood.

---

## 1. The boundary: what counts as "inside the fight"

"The fight" begins at the first frame of hostile intent (an enemy aggro state entering
`COMBAT`, or the player's first attack input against a valid target) and ends when all
hostiles within the encounter volume are dead, dormant, or de-aggroed for >5s.

**Inside the fight, SOULS IS AUTHORITATIVE over:**

| Domain | Souls rule that wins |
|---|---|
| Frames & timing | Startup / active / recovery frames, i-frame windows on roll, animation-driven motion |
| Stamina | Stamina as the universal action currency; regen delay after spend; block-through-stamina |
| Hitboxes | Capsule/sphere hit volumes swept along weapon arcs; hurtboxes that move with animation |
| Animation | Root-motion-authoritative movement, committed attacks, no instant turn during attack |
| Enemy behaviour | Aggro radius, telegraphed windups, spacing/reposition AI, punish windows, poise/stagger |
| Damage resolution | Deterministic hit-or-miss by geometry — **never** a to-hit dice roll |
| Lock-on | Hard target lock with directional roll semantics |
| Recovery | Estus-equivalent healing with animation commitment and finite charges |
| Death | Corpse-run soul recovery, world reset to bonfire state |
| Poise / hyperarmour | Souls poise model, not Morrowind knockdown |
| I-frame accounting | Every dodge measured in frames at 60fps, not seconds |

**Outside the fight, MORROWIND IS AUTHORITATIVE over:**

| Domain | Morrowind rule that wins |
|---|---|
| Progression | Levelling shape, skill/attribute breadth, build identity beyond weapon class |
| Faction gating | Rank requirements, skill+attribute thresholds, faction rivalry locks, expulsion |
| Dialogue | Topic-list dialogue, keyword discovery, disposition, rumours that differ per town |
| Journal | Numbered, dated, first-person-authored journal entries; no objective markers |
| Quest structure | Multi-stage, deceit-capable, quest-giver-lies, mutually exclusive resolutions |
| World structure | Hand-placed density, named interiors, walk-and-navigate wayfinding, no fast travel except in-fiction transport |
| Lore | Unreliable in-world books, contradictory accounts, deep-time history |
| Economy | Gold as currency; merchant gold pools, barter, disposition-affected prices |
| Strangeness | Alien flora/fauna/architecture, dream-logic, non-Tolkien fantasy |
| Non-combat resolution | Many quests resolvable by talk, bribe, sneak, theft, or lore knowledge |

## 2. Contested seams and their rulings

These are the places where the two systems genuinely collide. Each is pre-decided.
Builders MUST NOT re-litigate; critics MUST enforce.

| # | Seam | Ruling |
|---|---|---|
| S1 | Does a swing hit? | **SOULS.** Geometry only. Weapon skill never rolls to-hit. Morrowind's miss-chance is deleted. |
| S2 | What does levelling cost? | **SPLIT.** Souls: souls buy levels, single soft-cap curve, bonfire level-up. Morrowind: what a level *gives you* is broad (attributes+skills shape build identity beyond weapon class). Souls owns the currency and the curve; Morrowind owns the breadth of the stat sheet. |
| S3 | Do skills improve by use? | **MORROWIND**, but skills gate *access and utility* (which weapons/spells/lockpicks/persuasion you can use well), never to-hit. Skill affects scaling coefficients and out-of-fight options, not whether the sword connects. |
| S4 | Fatigue vs Stamina | **SOULS inside the fight** (stamina bar, spend-and-regen). Morrowind's Fatigue survives as a separate out-of-fight condition affecting disposition and persuasion. Two bars, clean separation. |
| S5 | Enemy respawn | **SOULS.** Bonfire rest respawns ordinary enemies. Named NPCs, quest actors, and merchants NEVER respawn and NEVER die to respawn logic. |
| S6 | Death consequence | **SOULS.** Drop souls, respawn at last bonfire. But: quest state, journal, faction standing, and world flags persist untouched — Morrowind owns the save-state semantics. |
| S7 | Fast travel | **MORROWIND.** No warp-to-map-pin. In-fiction transport only (see Hist-network / silt-strider analogue). Bonfires are checkpoints and level-up stations, **not** a teleport network. |
| S8 | Quest markers | **MORROWIND.** No compass markers, no objective arrows. Directions are given in prose in dialogue and journal. |
| S9 | Difficulty curve | **SOULS.** Regions are gated by lethality, not level-scaling. No enemy level-scaling to the player, ever. |
| S10 | Can you kill anyone? | **MORROWIND.** Yes. Killing a quest-critical NPC produces the "thread of prophecy severed" warning and a still-completable-but-harder world state, not a game over. |
| S11 | Poison/disease/curse | **MORROWIND** for the affliction economy (diseases with names, cures, in-world causes), **SOULS** for the in-fight status buildup meter and proc effect. |
| S12 | Loot | **MORROWIND.** Hand-placed, named, weird. No procedural drop tables. Souls only owns the *soul* drop quantity. |
| S13 | Dialogue during combat | **SOULS.** Enemies shout, they do not converse. Topic lists are locked while `COMBAT` is active. |
| S14 | Menus/pause | **SOULS.** Inventory does not pause the world during combat. Outside combat, Morrowind-style leisure is fine. |
| S15 | Souls as currency | **NEITHER, by decree.** Souls level you and ONLY level you. **Gold is the only currency.** Merchants, bribes, training, travel, and repairs all cost gold. Souls cannot buy an item, ever. |
| S16 | Dungeon architecture | **SPLIT, by census.** Two kinds coexist and neither may crowd out the other. **8 Souls-loop dungeons**: interconnected, multi-strata, shortcut-unlocking, HEARTH-anchored, with a closed/open path ratio ≥1.5 — these are the set-piece descents and they obey Souls level design. **82 Morrowind caves**: flat-ish, hand-furnished, discovered by walking, often holding one secret, one story, or one corpse — these are the texture of the world and they obey Morrowind. A Souls-loop dungeon that is merely a long cave fails; a cave inflated into a shortcut puzzle fails equally. Ruling introduced by RI-WLD07, wave 0. |
| S17 | Where the hour comes from | **MORROWIND.** The world takes an hour to cross because it contains an hour of *distance and incident*, never because locomotion is slow. Walk speed is a Souls-side property (2.0 m/s, tuned for combat spacing) and may not be lowered to inflate traversal time. If the crossing is too short, the world grows; the player never slows down. Ruling introduced by RI-WLD01 M3, wave 0. |

## 3. How critics enforce this

Every critic prompt MUST include the Arbitration Rule verbatim (or by reference to this
file) and MUST run the following two checks in addition to its dimension-specific work:

- **AR-1 (Souls leakage):** Did any Morrowind-flavoured mechanic contaminate the fight?
  Roll-to-hit, dice damage, pausing mid-fight, untelegraphed instant attacks, animation
  cancels, level-scaled enemies → **automatic fail of the piece**, regardless of score.
- **AR-2 (Morrowind leakage):** Did any Souls-flavoured convention contaminate the world?
  Objective markers, bonfire warp, minimal/absent dialogue, procedural loot, soul-currency
  purchases, item descriptions replacing NPC dialogue as the primary lore vector →
  **automatic fail of the piece**, regardless of score.

A critic that reports "no gap found" has failed its own job and its verdict is void.
Every verdict must name exactly one **single biggest remaining gap** with a concrete,
buildable remedy.

## 4. Visual judgement is bifurcated

- **Art direction** is judged against Morrowind (and the strangeness references). 2002
  screenshots are legitimate references here.
- **Visual fidelity / graphics quality** is judged against current-generation references
  (Elden Ring, Skyrim SE/AE and equivalents). It is a **hard error** for any critic to
  cite a 2002 screenshot when judging fidelity, and equally an error to cite a modern
  AAA screenshot when judging art direction.

## 5. Precedence order (when even this document is ambiguous)

1. The Arbitration Rule (§1) — inside/outside the fight
2. The seam rulings (§2)
3. The specific reference item's stated comparison method
4. The dimension owner's judgement, recorded as a new seam ruling in §2 by amendment

Amendments are append-only. Nothing in §2 is ever deleted; superseded rulings are struck
through with the wave number that superseded them.
