# CONTENT-BUDGET — what the corpus actually asks for, and whether it can be made

**Status: binding on wave-1 content briefs.** Written wave-1-prep to close `BAR-CRITIQUE-02`
**C2 / N2** — the third clause of gate **G7**, and the only gap on the critic's original list
that had got *worse* rather than better.

Every count threshold in the corpus, summed, with the item that owns it. Then the comparison
the critic asked for, then a feasibility argument with a ranked cut order, then a detector for
the failure mode nothing in the corpus currently sees.

**Nothing here changes a threshold.** This document only adds them up.

---

## 1. Why this document exists

Seventy-three items were written in one wave. Each of them set counts that were individually
reasonable. Nobody added them up. A dozen items warn against meeting their count by
duplication and `RI-DLG02` even runs a cross-settlement Jaccard check — but duplication is not
what an unreachable aggregate produces. **Uniform thinning is**: every count met, every count
met at its floor, every settlement at exactly its minimum, every faction at exactly eighteen
quests, and no instrument anywhere that fires when everything is simultaneously at the bottom
of its band. §6 proposes the instrument.

---

## 2. The prose budget

### 2a. Settlement-local dialogue — owner `RI-DLG02` §D

Tiers from `corpus/50-world/settlements.json`: **1 capital, 2 cities, 3 towns, 2 villages,
16 minor** (24 settlements). `RI-DLG02`'s tiers A/B/C/D map onto them as capital+city → A,
town → B, village → C, minor → D.

| Tier | n | Target `W_local` | Floor | At target | At floor |
|---|---:|---:|---:|---:|---:|
| A — capital + cities | 3 | 20,000 | 14,000 | 60,000 | 42,000 |
| B — towns | 3 | 9,000 | 6,000 | 27,000 | 18,000 |
| C — villages | 2 | 3,000 | 1,800 | 6,000 | 3,600 |
| D — minor | 16 | 1,500 | 900 | 24,000 | 14,400 |
| **Total** | **24** | | | **117,000** | **78,000** |

### 2b. The global reachable pool — owner `RI-DLG02` hard rule 1

**Correction to `BAR-CRITIQUE-02` §4 N2, with the arithmetic attached.** The critic's table
reads *"RI-DLG02 locality ratio ≥ 0.28 ⇒ a global reachable pool on the order of 80–90,000
words"*. **80–90,000 is Morrowind's own global layer** (88,708 words, `RI-DLG02` §A), not a
demand on us. The locality rule runs the other way: it **caps** the global pool, because a
larger shared pool *lowers* every settlement's locality ratio.

`W_local / (W_local + W_global) ≥ 0.28` ⇒ `W_global ≤ 2.571 × W_local`, and the binding
settlement is the smallest Tier A/B one, a town at `W_local = 9,000`:

> **`W_global ≤ 23,100 words`**, and at the Tier-B *floor* of 6,000, `W_global ≤ 15,400`.

The corpus therefore asks for a global pool of **roughly 15–23,000 words, as a ceiling**, and
carries no explicit floor under it beyond `RI-DLG03`'s greeting and rumour tier minima.
**This removes ~70,000 words from the critic's total.**

### 2c. Books — owner `RI-LOR03` §2

The taxon minimums, multiplied by their own stated medians:

| Taxon | n | Median words | Words |
|---|---:|---:|---:|
| T1 scholarly treatise | 16 | 800 | 12,800 |
| T2 Imperial administrative | 10 | 450 | 4,500 |
| T3 religious & liturgical | 14 | 600 | 8,400 |
| T4 diary, letters, ledgers | 16 | 700 | 11,200 |
| T5 poetry & song | 10 | 260 | 2,600 |
| T6 technical manuals | 12 | 800 | 9,600 |
| T7 histories & chronicles | 12 | 1,100 | 13,200 |
| T8 folk tale & fable | 10 | 350 | 3,500 |
| T9 trash fiction | 6 | 900 | 5,400 |
| T10 fragments & inscriptions | 16 | 110 | 1,760 |
| **Total** | **122** | median 520 | **≈ 73,000** |

(The item's headline is "112 texts"; its own taxon minimums sum to 122. The 122 is the
binding number because each taxon minimum is failable on its own.)

### 2d. Quest and journal prose — owners `RI-QST04`, `RI-DLG05`

| Source | Count | Owner |
|---|---:|---|
| Faction-line quests | 4 lines × 24–28 = **96–112** | `RI-QST01` §D (floor `< 18` per line fails), `RI-QST03` |
| Main quest | **≥ 24** across 5 acts | `RI-QST06` |
| Side quests | **≥ 5.5 × N ≈ 80** (`7–8` band accepts 4 × N ≈ 56) | `RI-QST07` |
| **Total quests** | **200–216** | |

At `RI-DLG05`'s journal length bands (mean entry in the 20–60 word body, ~8–14 entries per
quest) plus stage text, a quest carries **≈ 350 words** of journal and stage prose:
**≈ 73,000 words**.

### 2e. Prose total

| Layer | At target | At floor |
|---|---:|---:|
| Settlement-local dialogue | 117,000 | 78,000 |
| Global reachable pool (ceiling) | 23,000 | 15,000 |
| Books | 73,000 | 73,000 |
| Quest / journal prose | 73,000 | 52,000 |
| **Authored prose** | **≈ 286,000 words** | **≈ 218,000 words** |

---

## 3. The non-prose budget

Every row names the item that owns the number. Where an item states both a target and a floor,
both are given, because §6's detector needs the pair.

| # | Thing | Floor | Target | Owner |
|---|---|---:|---:|---|
| 1 | Land area | 10 km² | **14.5 km²** | `RI-WLD01` |
| 2 | Province crossing time | 45 min | **55–60 min** | `RI-WLD01` |
| 3 | Regions | — | **13** | `corpus/50-world/regions.json`, `RI-WLD04` |
| 4 | Settlements | — | **8 named + 16 minor** | `settlements.json`, `RI-WLD03` |
| 5 | Settlement buildings | — | **250** | `settlements.json` |
| 6 | Named interiors in settlements | — | **160** | `settlements.json` |
| 7 | Total interiors game-wide | **120** (below = we lose) | **250** | `RI-WLD07` |
| 8 | Caves | — | **82** | `RI-WLD07` |
| 9 | Souls-loop dungeons | 5 | **8** | `RI-WLD07` |
| 10 | Named NPCs | — | **269** | `settlements.json`, `RI-WLD03` |
| 11 | Quest givers | — | **60** | `settlements.json` |
| 12 | Rumour variants | — | **120** | `settlements.json`, `RI-DLG03` |
| 13 | Shops / taverns / temples / guild halls / trainers | — | **46 / 12 / 25 / 16 / 19** | `settlements.json` |
| 14 | Named-location count | **276** | — | `RI-WLD02` |
| 15 | Hand-placed enemies | — | **1,230** | `RI-WLD07`, `RI-PRG06` §7 |
| 16 | Enemy archetypes answered | every one | — | `RI-AI05`, `RI-WPN01` §E |
| 17 | Strangeness elements | 26 of 29 scoreable | **30**, ≥6 placed instances each = **180** | `RI-WLD05` |
| 18 | Architecture grammars | — | **9**, ≤12 instances each | `RI-WLD14` |
| 19 | Environmental hazards | — | **13**, exactly one `KILL` | `RI-WLD11` |
| 20 | Spell effects | — | **55**, ≥12 with an out-of-fight use | `RI-MAG02` |
| 21 | Weapon classes | — | **15**, each a full moveset | `RI-WPN02` |
| 22 | Moveset slots | 25 mandatory × 15 = **375** | ≥18 distinct clips × 15 = **≥270 clips** | `RI-WPN01` |
| 23 | Origins / birthsigns / custom class | 6 / 9 / 1 | — | `RI-CHR01`, `RI-CHR03` |
| 24 | Sanctioned breakages, each **probed and working** | **12** (8 systemic, 2 permanent) | **15** | `RI-EXP06` |
| 25 | Seam crossings, each demonstrated firing in a trace | per-wave floors | **41** | `RI-CMP01` |
| 26 | Opacity register entries / void tracts / sealed mysteries | 15 / 5 / 16 | — / 6 / **24** | `RI-WLD09` |
| 27 | Afflictions | — | **17** (12/4/1) | `RI-PRG09` |
| 28 | Books written by Argonians / contradicting pairs / actively wrong | 14 / 8 / 6 | — | `RI-LOR03` |
| 29 | NPC voice archetypes, pairwise separated | — | **6**, all 15 pairs | `RI-DLG06` |
| 30 | Anecdotes verified in the trace | — | **≥ 1.5 per hour** | `RI-EXP02` |

---

## 4. Compared with Morrowind's base game

Measured, not recalled. Sources are vendored in this repository.

| Axis | Ours | Morrowind base | Ratio | Source for the Morrowind figure |
|---|---:|---:|---:|---|
| Unique dialogue words | 117,000 local + ≤23,000 global | **520,654** | **27%** | `corpus/40-dialogue/data/morrowind-dialogue.csv.gz`, `Source == "Morrowind"`, deduplicated on exact text: 22,502 distinct texts |
| Unique dialogue words (all three ESMs) | as above | **682,372** (27,875 texts) | 21% | `RI-DLG02` §A, same extraction |
| Books | **122** / ≈73,000 words | ~330 texts / ≈231,000 words (all three ESMs) | **37% / 32%** | `RI-LOR03` §1 |
| Quests | **200–216** | **~427** (396 UESP quest pages, base) | **47–51%** | `corpus/30-quests/data/morrowind-quest-census.json` |
| Named NPCs | **269** | 1,429 NPC pages, 1,048 resolved to a settlement | **19–26%** | `corpus/50-world/data/morrowind-world-census.json` |
| Interiors | **250** | 624 place pages (a floor; the real cell count is far higher) | **≤ 40%** | same census |
| Land area | **14.5 km²** | Vvardenfell ≈ 24 km² | **60%** | `RI-WLD01` |
| **Total authored prose** | **≈ 286,000 words** | **≈ 680,000+ words** | **≈ 42%** | dialogue + books, measured above |

**This is the correction the critic's §4 invites.** The claim that the corpus demands *"an
authored surface at or above Morrowind's base game"* does not survive the arithmetic. On every
axis the corpus asks for **between a fifth and a half of Morrowind**, on a province 60% the
area of Vvardenfell. The scaling is coherent: a smaller land mass, at a similar walking density
(`RI-WLD02`'s D3 ≥ 9 POIs per settled road km), with fewer but individually longer-spoken NPCs
(`RI-DLG02` hard rule 3 forbids the 40-word nameplate NPC that Morrowind has hundreds of).

**Where we do exceed Morrowind is not volume — it is evidence per unit.** Morrowind shipped 427
quests with no requirement that any of them be demonstrated in a trace. We ask for 41 crossings
each shown firing, 15 exploits each probed and *succeeding*, a blind pack per visual wave, and a
sabotage control pair every wave. That is the real budget, and §5 is about it.

---

## 5. Feasibility — the argument, signed

**Verdict: the word budget is feasible. The evidence budget is not, at the stated per-unit
standard, in five waves. The correct response is to cut content units, in the ranked order
below, and to protect every per-unit evidence requirement rather than sampling it.**

The reasoning, in four steps.

**(1) Prose is the cheapest axis and it is not the constraint.** 286,000 words is large for a
human team and unremarkable for this one. It is 42% of a 2002 shipped RPG. It is not what will
sink this project.

**(2) The constraint is verification cost, and it scales with N × (a run), not N × (words).**
The items whose cost is a *run* rather than a paragraph:

| Obligation | Units | Cost shape | Owner |
|---|---:|---|---|
| Seam crossings demonstrated firing in a trace | 41 | one authored scenario + one trace + one diff, **every wave** | `RI-CMP01` |
| Sanctioned breakages probed and **succeeding** | 15 | one probe each, **re-run every wave**, with a regression hard fail | `RI-EXP06` |
| Strangeness blind screenshots | 24 of 24 | a fresh judge per wave | `RI-WLD05` M22 |
| Blind comparison packs | ≥ 12 pairs per protocol | two independent agents, no shared context | `RI-VIS06`, `RI-DLG07`, `RI-MTH03` |
| **The sabotage control pair** | 1 per wave | **doubles the playthrough cost of the entire wave** | `PLAYTHROUGH-CRITIC` §4.5 |
| Hand-placed enemies, no procedural table | 1,230 | placement is authoring, and `RI-WLD07` M39 hard-fails a loot or spawn table | `RI-WLD07` |

Multiply: 41 + 15 + 24 + ~36 + 1 ≈ **117 distinct evidence artifacts that must be regenerated
every wave**, against a corpus of 138 items each of which also wants its own method run. At five
waves that is ~600 artifact-generations, and the two most expensive ones — the sabotage control
and the 41 crossings — are exactly the two the corpus itself identifies as most likely to lapse
(`PLAYTHROUGH-CRITIC` §10; `RI-CMP01`'s own declared 27% shortfall).

**(3) Therefore the cut is on content units, never on evidence per unit.** A halved evidence
standard makes every remaining number unfalsifiable, which is the failure the whole corpus is
built to prevent. A halved *count* costs exactly what it says on the tin and nothing more.

**(4) Cut order.** Ranked, and deliberately **asymmetric** — cut whole units, never every unit
a little, because cutting everything a little is precisely the uniform thinning §6 exists to
detect.

| # | Cut | Saves | Why it is first, and what must survive |
|---:|---|---|---|
| **1** | **Minor settlements 16 → 10.** The six removed become named road waypoints with a bonfire and no interiors. | ~9,000 words, ~30 named NPCs, ~30 interiors | Tier D carries no locality rule and no Tier-A/B failure clause. `RI-WLD02` D3 (POIs per settled road km) is preserved because a waypoint is still a POI. **Must survive:** the 276 named-location floor, and `RI-TRV01`'s road legs. |
| **2** | **Books 122 → 72**, taxon minimums scaled by 0.6 but **T10 fragments held at 16** (they are the cheapest and the most atmospheric). | ~26,000 words | `RI-LOR03`'s blind test measures *shape*, not count. **Must survive, untouched:** median 520, p90 1,600, ≥3 multi-volume, ≥14 Argonian-authored, ≥8 contradicting pairs, ≥6 actively wrong, ≤10% quest hints. A corpus whose median falls under 250 words "has failed on shape alone" — the item's own sentence. |
| **3** | **Side quests 5.5 × N → 4 × N** (80 → 56). | 24 quests, ~8,000 words | `RI-QST07`'s own `7–8` band already accepts 4 × N. **Must survive:** the type mix including weird ≥ 8%, non-`given` discovery ≥ 30%, and ≥ 4 quests per settlement from ≥ 3 givers. |
| **4** | **Interiors 250 → 180, caves 82 → 55.** | 70 interiors, 27 caves | **Must survive:** the 8 Souls-loop dungeons at closed/open ratio ≥ 1.8, the 120-interior we-lose floor, and `RI-WLD03`'s per-settlement enterable percentage. |
| **5** | **Strangeness instances 6 → 4 per element** (180 → 120). | 60 placements | **Must survive: all 30 elements.** M22's blind screenshot test measures *distinctness*, not repetition; cutting elements instead of instances would fail the exact thing the item exists to protect. |
| **6** | **Afflictions 17 → 12**, holding the 12/4/1 shape at 8/3/1. | 5 afflictions | `RI-PRG09` M1's census floor is the binding number and must be restated if this cut is taken. |

**Never cut, at any pressure:** the 41 seam crossings, the 15 sanctioned breakages, the 4
faction lines at ≥ 18 quests each, the main quest's 5 acts and ≥ 24 quests, the sabotage
control, the 15 weapon movesets (`RI-WPN01` M5 hard-fails an unanswered archetype), and the 55
spell effects with ≥ 12 out-of-fight uses. Each of these has an explicit floor below which its
item hard-fails, and each is a thing this project exists to be rather than a thing it contains.

Taking cuts 1–6 in full lands the budget at **≈ 243,000 words**, **~176 quests**, **180
interiors**, **269 → 239 named NPCs** — about **36% of Morrowind's base game**, with every
per-unit evidence requirement intact.

*Signed: `wave1-prep`, 2026-08-06. Recorded per `BAR-CRITIQUE-02` C2, whose checkable condition
is that this paragraph exists, names a cut order, and that every total above names an owner.*

---

## 6. FLOOR-HUG — a detector for uniform thinning

The failure this document is really about. Nothing in the corpus currently sees it, and
`RI-EXP04`'s novelty curve and `RI-EXP02`'s anecdote census — the closest things to a defence —
are per-dimension, not aggregate.

### 6a. What is being detected

Not "a count is below its floor" — every item already checks that. **The distribution of how
far above their floors the counts land.** A build made by people is *lumpy*: the region someone
cared about is well over target, the one done last Friday is scraping its floor. A build
optimised against the checker is *flat*: everything lands in the same narrow band just above
the minimum, because that is what the optimiser was told to produce.

### 6b. The statistic

For every count threshold in §2 and §3 with both a floor `F` and a target `T`, and a delivered
value `D` measured from `game/data/**`:

```
slack   s_i = (D_i - F_i) / (T_i - F_i)          # 0 = exactly at the floor, 1 = at target
```

Over the N metrics that have both a floor and a target (currently **N = 19** in §3, plus 4
tiers in §2a — the detector reports N so a shrinking N is itself visible):

| Statistic | Definition | Fail condition |
|---|---|---|
| **FH1 `floor_hug_rate`** | fraction of metrics with `0 ≤ s < 0.15` | **> 0.35** |
| **FH2 `median_slack`** | median of `s` | **< 0.30** |
| **FH3 `slack_IQR`** | interquartile range of `s` | **< 0.20 — fail for being too UNIFORM** |
| **FH4 `simultaneity_p`** | binomial p for observing ≥ k of N metrics in `[0, 0.15)` under a uniform-`s` null | **< 0.001** |
| **FH5 `wave_delta_flatness`** | IQR of `Δs` since the previous wave | **< 0.10** with `median(Δs) > 0` — every count rose by exactly enough and no more |

**FH3 is the load-bearing one and it is deliberately inverted.** It is the only check in this
corpus that fails a build for being *too consistent*, and it is the direct descendant of two
existing ideas: `RI-WLD02`'s V5/V6, which made it possible to fail for having too little
emptiness, and `RI-VIS03`'s band 5–6, *"the render is coherent but consistently thin"*. A
corpus that can only fail things for being bad cannot see a build that is uniformly, deliberately
mediocre.

**FH4 is what makes it arguable rather than a matter of taste.** Nineteen independent metrics
landing within 15% of their floors is not a judgement call about ambition; it is a p-value.

### 6c. Anti-gaming, and the way this check itself fails

- **Inflating one metric to fix FH3 is visible in FH1**, which does not move. Both must pass.
- **Metrics with no target are excluded and counted.** An area that responds by deleting its
  target so its metric leaves the denominator shows up as `N` falling, which is reported on the
  progress page and is itself a finding.
- **FH3 fails a genuinely uniform-good build too.** Stated in advance, accepted: if every metric
  lands near target with `s ≈ 0.9` and low IQR, FH3 fires. The remedy is that FH3 is evaluated
  **only when `median_slack < 0.5`** — flatness is a defect near the floor and a virtue near the
  target. This asymmetry is the check, not an escape hatch.
- **The most likely failure of this detector is that nobody keeps `D` current.** It needs a
  machine-readable budget, not this prose.

### 6d. Implementation, and who should own it

```
corpus/00-doctrine/content-budget.json     # {metric_id, owner_item, unit, floor, target}
tools/content-budget.mjs --wave N          # reads the json + game/data/** -> budget-slack.json
tools/content-budget.mjs --check           # exits 1 on FH1-FH5
```

The natural owner is a new methods item — **`RI-MTH06`, "the aggregate content budget and the
thinning detector"** — judging `coherence.economy.balance` and `coherence.progression.pacing`,
both of which are currently judged by items about something else. It should carry the FH1–FH5
bands as its `## Scoring`, a native→ladder anchor row per `SCORING.md` §1.2a, and a hard fail on
`FH4 simultaneity_p < 0.001`. Writing it is design work and is **not** done here; this section
is the specification a builder can write it from.

Until it exists, the aggregate is **unmeasured, not passed**, and any wave verdict that claims
the content budget is being met without citing `budget-slack.json` is asserting an unmeasured
quantity, which `RI-MTH04` treats as a struck claim.
