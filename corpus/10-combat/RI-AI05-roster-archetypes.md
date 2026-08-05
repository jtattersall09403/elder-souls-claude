---
id: RI-AI05
title: Enemy roster archetypes — ten roles, and the stat bands that define them
kind: number
side: souls
judges: [combat.difficulty.lethality, combat.poise.enemy, combat.enemy.statemachine, combat.encounter.grouping, progression.souls.economy, world.region.gating]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

A Souls roster is a set of **questions**, not a set of skins. Each archetype asks the
player one specific question — "can you punish a shield?", "can you space a fast
double-hit?", "can you fight one thing while another shoots you?" — and the answer is a
different verb each time. Reskinning is legitimate and expected (a Naga levy and a
Kothringi husk can be the same role in different armour), but adding a skin is not adding
content; adding a *question* is. A roster of ten roles, each appearing in three or four
regional dressings, beats a roster of forty statblocks that all walk up and swing.

The second half of the bar is that difficulty comes from **which questions are being asked
at once**, not from stat inflation. A region gets harder because it starts combining
ranged harassment with a poise-monster, not because the same infantry now has 3× the HP.
Per ARBITRATION S9, enemies never scale to the player; a region is gated by lethality, and
lethality is a property of the roles placed in it.

## The reference artifact

### A. Reference player HP pool by region (the denominator for RI-AI02 severity)

Regions are ordered by intended progression, not by map adjacency. Black Marsh dressing is
given for flavour; the **role is normative, the dressing is not**.

| Region | Tier | Ref player HP | Ref player poise | Typical region dressing |
|---|---|---|---|---|
| R1 Shipwreck coast / outer fen | 1 | 450 | 20 | drowned Kothringi, mire-crabs |
| R2 Hist-grove uplands | 2 | 700 | 30 | Naga levy, saplings-touched |
| R3 Sunken city (Xanmeer) | 3 | 950 | 40 | Barsaebic revenants, root-golems |
| R4 Blackrose / the deep marsh | 4 | 1200 | 50 | Dunmer slaver garrison, swamp-wyrms |
| R5 The Hist-heart | 5 | 1450 | 60 | Hist-bonded champions |

### B. The ten archetypes

Abbreviations: **HP** = hit points as a multiple of region reference (`×refHP`);
**Poise** = poise points (player light attack deals 12 poise damage per hit — cross-check
with the frame-data/poise item, which is authoritative on player poise output);
**R** = sight radius (RI-AI01 §B); **Ω** = reach (RI-AI01 §C); **Atk** = distinct attacks
in moveset (excluding delayed variants, which are counted separately);
**Str** = distinct strings (RI-AI04 R4); **PWR** = required median punish window ratio
(RI-AI03 §B); **Souls** = souls yield band as a multiple of `soulsBase(region)`.

`soulsBase` by region: R1 = 40, R2 = 120, R3 = 350, R4 = 900, R5 = 2000.
(Souls buy levels and *only* levels — ARBITRATION S15. Gold is separate and is not a drop
from ordinary enemies; see the economy items.)

| # | Archetype | Role — the question it asks | HP (×refHP) | Poise | R (m) | Ω (m) | Atk | Delayed | Str | Median PWR | Souls (×base) | Curve placement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | **INFANTRY** — basic levy | "Do you know the fundamentals: space, dodge, punish, one at a time?" | 0.55–0.75 | 20–28 | 16 ±2 | 2.4 | 5–7 | 1 | 3–4 | 0.28–0.38 | 0.8–1.4 | R1 onward, the spine of every region |
| A2 | **TURTLE** — shielded blocker | "Can you break a guard instead of trading?" | 0.70–0.95 | 34–46 | 14 ±2 | 2.2 | 4–6 | 1 | 2–3 | 0.26–0.36 | 1.2–1.8 | R1 late, common R2–R3 |
| A3 | **DUELIST** — fast dual-wielder | "Can you dodge a rhythm faster than yours without panicking?" | 0.45–0.60 | 14–20 | 18 ±2 | 2.0 | 6–8 | 2 | 4 | 0.28–0.36 | 1.4–2.2 | R2 onward |
| A4 | **POISE_MONSTER** — big slow heavy | "Can you stand close to something that will kill you in two hits?" | 1.6–2.4 | 60–90 | 12 ±2 | 4.1 | 5–7 | 2 | 3 | 0.26–0.36 | 3.0–5.0 | R2 late, R3–R5 |
| A5 | **RANGED** — harasser | "Can you fight the thing in front of you while being interrupted?" | 0.35–0.50 | 10–16 | 26 ±3 | 1.6 (melee panic) + 22 (projectile) | 3–4 | 0 | 2 | 0.30–0.42 | 0.9–1.5 | R1 onward, never alone |
| A6 | **AMBUSHER** — hidden opener | "Are you reading the room or running through it?" | 0.50–0.70 | 18–26 | 7 ±1 (30 once triggered) | 2.0 | 4–5 | 1 | 2–3 | 0.30–0.40 | 1.1–1.7 | R1 onward; density capped, see §D |
| A7 | **SWARM** — dog / fast pack | "Can you use geometry and a wide arc, or do you tunnel on one target?" | 0.18–0.28 | 6–10 | 20 ±3 | 1.6 | 3–4 | 0 | 2 | 0.30–0.42 | 0.3–0.5 each | R1 onward, always ≥3 |
| A8 | **CASTER** — ranged control / zoner | "Can you close distance under pressure and commit to the kill?" | 0.40–0.55 | 12–18 | 24 ±3 | 1.8 melee + 18 spell | 4–5 | 1 | 3 | 0.32–0.45 | 2.0–3.5 | R2 onward |
| A9 | **ELITE** — mini-boss, roaming | "Have you actually learned the region, or have you been getting away with it?" | 3.0–4.5 | 70–110 | 20 ±2 | 3.0 | 8–11 | 2–3 | 5–6 | 0.22–0.30 | 8–15 | 1 per region minimum, optional-encounter by preference |
| A10 | **GANK_DUO** — paired complement | "Can you fight two different questions at once and control the angle?" | (see §C) | (see §C) | per member | per member | per member | per member | per member | ≥0.30 each | 1.6× sum of members | R2 onward, ≤2 per bonfire loop |

Full-detail rows for the two most-used archetypes:

**A1 INFANTRY (reference build — the "Naga levy", R2 dressing)**

| Field | Value | Tolerance |
|---|---|---|
| HP | 0.65 × 700 = 455 | ±10% |
| Poise | 24 (2 light attacks to stagger at 12 poise dmg) | ±2 |
| Sight radius / cone | 16 m / ±55° | ±2 m |
| Reach Ω | 2.4 m | ±0.2 |
| Walk / sprint | 2.2 / 4.6 m·s⁻¹ | ±0.2 |
| Moveset | 6 (RI-AI02 §F) | — |
| Strings | 4 (RI-AI04 §E) | — |
| Damage band | S0 6%, S1 12–15%, S2 24% of refHP | — |
| Median PWR (realistic) | 0.32 | ≥ 0.28 |
| Souls | 120 (1.0 × base) | ±20% |
| Group size when placed | 1 (55%), 2 (30%), 3 (15%) | — |

**A9 ELITE (reference build — the "Xanmeer Root-Warden", R3 dressing)**

| Field | Value | Tolerance |
|---|---|---|
| HP | 3.6 × 950 = 3420 | ±10% |
| Poise | 88 (8 light attacks to stagger; hyperarmour on 3 of 10 moves) | ±5 |
| Sight radius | 20 m | ±2 |
| Reach Ω | 3.0 m | ±0.3 |
| Moveset | 10 (incl. 1 grab S5, 1 gap-closer, 2 delayed variants) | — |
| Strings | 5, max chain 4 | — |
| Damage band | S1 14%, S2 26%, S3 42%, S5 grab 55% | — |
| Median PWR | 0.25; ≥1 move at `P_safe` ≥ 60 f (heal window) | ≥0.22 |
| Souls | 3500 (10 × base) | ±20% |
| Leash | 45 m, roams a defined patrol loop | — |

### C. GANK_DUO composition rules

A gank duo is not "two enemies near each other". It is an authored pair whose roles differ
and whose combination is the question.

| Rule | Value |
|---|---|
| Legal pairings | (INFANTRY + RANGED), (TURTLE + DUELIST), (POISE_MONSTER + SWARM×3), (CASTER + TURTLE), (DUELIST + DUELIST) — **only with 0.6× HP each** |
| Illegal pairings | any pair of POISE_MONSTERs; ELITE + anything; two CASTERs; any pair whose combined attack tokens exceed 2 |
| Combined HP ceiling | ≤ 1.5 × the HP of a single ELITE of that region |
| Attack tokens | 1 shared for melee members (RI-AI01 §E); ranged/caster members hold a separate ranged token |
| Separability | the arena must permit the player to fight them one at a time by using geometry — verified in RI-AI07 |
| Aggro coupling | both aggro together (ally-death shout and damage propagate), but they may be *pulled* separately if the player uses stealth or ranged bait |
| Frequency | ≤ 2 gank duos per bonfire-to-bonfire loop |

### D. Difficulty curve — which archetypes appear where, and in what mix

Percentages are of total enemy population placed in the region.

| Archetype | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|
| A1 INFANTRY | 45% | 32% | 24% | 18% | 10% |
| A2 TURTLE | 8% | 14% | 14% | 12% | 8% |
| A3 DUELIST | 0% | 12% | 14% | 14% | 14% |
| A4 POISE_MONSTER | 0% | 6% | 10% | 14% | 18% |
| A5 RANGED | 12% | 12% | 12% | 12% | 10% |
| A6 AMBUSHER | 6% | 7% | 8% | 8% | 8% |
| A7 SWARM | 24% | 12% | 8% | 8% | 8% |
| A8 CASTER | 0% | 4% | 8% | 10% | 14% |
| A9 ELITE (count, not %) | 1 | 1–2 | 2 | 2–3 | 3 |
| A10 GANK_DUO (count) | 0–1 | 2–3 | 3–4 | 4–5 | 4–6 |

**Introduction rule.** The first instance of any archetype in the game must be presented
**solo, in a lit, open, non-ambush position, with retreat available**. The second and third
instances may be combined. The fourth onward may be ambushed. A critic checks this against
the placement data in RI-AI07 and it is a hard fail if violated — an archetype whose first
appearance is in a gank has not been taught, only survived.

**Escalation levers, in the order they are permitted to be used:**

| Order | Lever | Legal | Notes |
|---|---|---|---|
| 1 | New archetype | yes | the primary lever |
| 2 | New combination of existing archetypes | yes | the second-most-used lever |
| 3 | Worse geometry (narrow, elevated, no retreat) | yes | RI-AI07 owns this |
| 4 | Larger moveset / more strings on an existing archetype (a genuine variant) | yes | must be a declared new archetype instance, not a buff |
| 5 | Higher damage (severity tier up) | yes, sparingly | must come with the longer windup RI-AI02 §B requires |
| 6 | Higher HP | **only within the ±10% band**, or by moving to the next region's refHP | HP inflation beyond the band is the health-sponge failure |
| 7 | Faster attacks / shorter windups | **never** | violates RI-AI02 |
| 8 | Level-scaling to the player | **never** | violates ARBITRATION S9 |

### E. Souls yield sanity — the levels-per-region contract

| Region | soulsBase | Expected clear yield (full region, no repeats) | Levels this affords | Souls-per-minute band |
|---|---|---|---|---|
| R1 | 40 | 5 500 | ~7 | 90–160 |
| R2 | 120 | 22 000 | ~8 | 280–500 |
| R3 | 350 | 78 000 | ~8 | 900–1 600 |
| R4 | 900 | 240 000 | ~7 | 2 600–4 500 |
| R5 | 2 000 | 620 000 | ~6 | 6 000–10 000 |

The souls-per-minute band is the thing that actually matters and the thing most likely to
break: it must stay within its band whether the player is clearing carefully or running
past, and it must not be improvable by more than 1.8× by farming a single respawning
encounter (anti-farm check in `## Comparison method` M6).

## Comparison method

Harness: headless spawn-by-archetype-id, JSONL trace per RI-AI01 §A, plus a **placement
dump** listing every authored enemy instance with `{eid, archetype, region, encounter_id,
pos, group_id, ambush_flag, first_appearance_index}`.

**M1 — Role distinctness (the headline check).**
For each pair of archetypes in the roster, build a **behaviour fingerprint** from a
standard 90-second probe (scripted player holds mid-range, dodges everything, never
attacks) — vector of: median `dist_m`, `spacing_variance`, sprint fraction, ranged-attack
fraction, median W, median PWR, moveset size, poise, HP×refHP, attack-token share.
Z-normalise each dimension across the roster; compute pairwise Euclidean distance.
- **PASS** if every pair's distance ≥ 1.8 and the roster contains ≥ 8 archetypes whose
  pairwise distances all clear it.
- **FAIL** if any pair < 1.0 — two archetypes that are the same question in two costumes.
- **Headline number: minimum pairwise behaviour-fingerprint distance across the roster;
  fail if < 1.8.**

**M2 — Band conformance.** For each archetype, read its statblock and its measured trace
values; check every field in §B against its band and tolerance.
- Report a per-archetype pass/fail matrix. **FAIL** the archetype on any out-of-band value;
  **FAIL** the roster if > 20% of archetypes fail.

**M3 — Region mix.** From the placement dump, compute per-region archetype percentages.
- **PASS** if each is within ±6 pp of §D, ELITE counts exact, GANK_DUO counts within ±1.
- **FAIL** if any region is > 60% a single archetype (a region of one question).

**M4 — Introduction rule.** For each archetype, find its `first_appearance_index` instance
in the placement dump; check `ambush_flag == false`, `group_id` size == 1, and that the
encounter volume has ≥ 2 exits and ≥ 8 m of open floor.
- **Any violation is a hard fail.**

**M5 — No level-scaling (AR-1 enforcement).** Spawn the same `archetype` at player level 1
and player level 80 in a fresh world. Diff `hp_max`, damage per move, poise, and speeds.
- **PASS** only if identical. **Any difference is an automatic fail of the piece** per
  ARBITRATION S9.

**M6 — Souls economy and anti-farm.**
Script a full-clear of each region; sum souls awarded, divide by elapsed time.
- **PASS** if within the §E band.
Then script a farm loop: rest, clear the single densest respawning encounter, rest, repeat,
for 15 minutes. Compute souls-per-minute.
- **PASS** if farm rate ≤ 1.8× the region's clear rate.
- **FAIL** if ≥ 3× — the progression curve is decided by a single loop and every other
  encounter in the region is decorative.

**M7 — Health-sponge detector.** For each archetype, compute
`hits_to_kill` = `hp_max` / (median player light-attack damage at the region's expected
build). Then compute `player_hits_to_die` = refHP / median enemy attack damage.
- **PASS** if `hits_to_kill` ≤ 14 for trash, ≤ 40 for elite, and the ratio
  `hits_to_kill / player_hits_to_die` ≤ 5.0 for trash, ≤ 9.0 for elite.
- **FAIL** if any trash enemy needs > 20 light attacks. A trash enemy that outlasts the
  player's attention is not difficult, it is long.

**M8 — Gank legality.** For each authored GANK_DUO in the placement dump, check §C's
pairing table, combined-HP ceiling, and token allocation. Then run the separability probe:
scripted player retreats to the nearest chokepoint and fights.
- **PASS** if in ≥ 80% of trials the player can engage exactly one melee member at a time
  for ≥ 5 continuous seconds.
- **FAIL** on any illegal pairing or if separability < 50%.

## Scoring

| Check | Weight |
|---|---|
| M1 role distinctness | 5 |
| M2 band conformance | 3 |
| M3 region mix | 2 |
| M4 introduction rule | 3 |
| M6 souls economy / anti-farm | 2 |
| M7 health-sponge | 4 |
| M8 gank legality | 3 |

Each 0/1/2 × weight. Max 44.

| Total | Verdict |
|---|---|
| 39–44 | Meets the bar |
| 29–38 | Below bar — named remedy required |
| ≤ 28 | Loses outright |

**Hard fails regardless of total:**
- M5: any stat differing by player level (ARBITRATION S9, AR-1).
- M4: any archetype introduced in an ambush or a group.
- M1: any archetype pair with fingerprint distance < 1.0.
- M7: any trash enemy requiring > 20 light attacks to kill.
- Fewer than 8 archetypes clearing M1's distinctness bar (the roster is not a roster).

Blind pair: give the critic ten unlabelled 90-second behaviour fingerprints (ours) mixed
with ten generated from §B. It clusters them into roles without labels; if our ten collapse
into fewer than six clusters, we lose.

## How we lose

1. **Reskin roster.** Ten enemy models, one behaviour tree, HP and damage varied by a
   multiplier. M1's fingerprint distances all land under 0.5. The team will insist there
   are "ten enemy types" and there is one.
2. **Difficulty by HP multiplier.** The most probable failure in the whole corpus. R4
   enemies are R1 enemies × 4 HP × 3 damage. Fights get longer, not harder; the player's
   skill ceiling is untouched; M7 fires. The tell is that no *new question* appears after
   R2.
3. **Level-scaling sneaking in.** Someone adds "so the early areas stay relevant" scaling,
   or ties enemy damage to player level "for balance". M5 is binary and this is an
   automatic fail of the piece under ARBITRATION S9 / AR-1.
4. **No ranged enemies, because ranged AI is hard.** The entire roster is melee, so the
   player never has to manage two threat vectors, and every fight is the same spacing
   problem. A5 and A8 are the two archetypes most likely to be silently dropped.
5. **Ranged enemies that are unfair instead of annoying.** Homing projectiles with no
   travel telegraph, perfect leading, infinite ammo, and no `DISENGAGE` state, so the
   correct play is to sprint at them with a shield up and there is no interesting decision.
   Cross-check RI-AI02 S6 (projectiles need 24 f windup and aim-lock at Tc).
6. **SWARM implemented as three copies of INFANTRY.** Same reach, same poise, same
   moveset, three attack tokens. The "swarm question" (arc control, geometry) is never
   asked; instead the player is simply hit from three sides at once. §C's token rules and
   A7's poise band (6–10, i.e. staggered by a single light attack) are what make a swarm
   a swarm.
7. **TURTLE with no answer.** A shield enemy whose guard cannot be broken by any verb the
   player has at that point in the game, so the only tactic is to walk behind it. The
   archetype must ship *with* its answer (guard break / kick / charged heavy) already in
   the player's kit — this is a cross-check against the frame-data item's move list.
8. **AMBUSHER overuse.** Ambushes are cheap to author and satisfying to place, so density
   creeps from 8% to 25% and the region becomes a corridor of jump-scares. RI-AI07 caps
   placement; §D caps population.
9. **ELITE that is just a trash enemy with 4× HP.** No extra moves, no extra strings, no
   grab, no hyperarmour — A9's `Atk 8–11` and `Str 5–6` rows exist to stop this. An elite
   must be a *bigger grammar*, not a bigger number.
10. **GANK_DUO as difficulty filler.** Every hard spot becomes "two of the thing you
    already fought", which fails §C's role-difference requirement and produces token
    contention rather than an interesting composition. M8's pairing table.
11. **First appearance in a gank.** The Duelist's debut is two Duelists in a dark room, so
    the player never learns the single-Duelist rhythm and instead concludes the archetype
    is unfair. M4, hard fail.
12. **Souls yield tuned per-enemy by feel.** No `soulsBase`, no per-region contract, so one
    respawning courtyard in R2 outputs more per minute than all of R3 and the levelling
    curve inverts. M6's anti-farm ratio.
13. **The roster grows by addition, never by subtraction.** Twenty archetypes, of which
    eight are distinct and twelve are noise. M1 requires ≥ 8 distinct; it does not reward
    the twelve, and a critic should say so plainly: the correct remedy is deleting nine
    archetypes and dressing the remaining eight three ways each.

## Provenance note

`provenance: constructed`. Every band, percentage, souls figure, tolerance, and the ten-role
taxonomy itself are **defined for this project**. No FromSoftware source publishes an
archetype taxonomy or a region mix table; these are ours, and their value is that they are
checkable against a placement dump and a behaviour trace.

Grounding is `canonical-recall` (confidence: medium) of Dark Souls / Elden Ring roster
composition: the recurrence of a small set of behavioural roles across visually distinct
enemies; the reliable presence of archers/casters positioned to interrupt melee fights;
dog-type packs with very low individual poise; large slow enemies with hyperarmour and long
punishable recoveries; shielded enemies that require a guard-break verb; and roaming
mini-boss elites placed as optional encounters. Community observation of Dark Souls enemy
poise records that hollow/undead trash sits at or near zero poise while black-knight-class
enemies are described as very high, which is the qualitative shape A7 vs A4/A9 encodes
([darksouls.wikidot.com/poise](http://darksouls.wikidot.com/poise),
[Fextralife: Black Knight](https://darksouls3.wiki.fextralife.com/Black_Knight)); no
reliable numeric enemy-poise table was locatable, so all poise numbers here are constructed.

The Black Marsh dressings in §A are flavour only and carry **no** authority; the lore items
in `corpus/60-lore/` are authoritative on what a Naga levy or a Barsaebic revenant actually
is, and this file must be amended to match them rather than the reverse.

Cross-dependencies: player light-attack poise damage (12) and player light-attack damage
used in M7 are owned by the frame-data item and are placeholders here. The souls-to-level
curve in §E is owned by the progression items; if the two disagree, progression wins and
§E's "levels this affords" column is recomputed.
