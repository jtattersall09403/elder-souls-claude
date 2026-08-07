---
id: RI-CMP03
title: Build-identity payoff — six archetypes, each taken through the whole game
kind: structure
side: neutral
judges: [composition.build.identity, composition.build.viability]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

"Build variety" is the easiest claim in the genre to make and the easiest to fake. Three weapons with
different damage numbers, two spell schools, and a sneak multiplier will satisfy every per-subsystem
check in this corpus: `RI-PRG02`'s stat sheet has breadth, `RI-PRG03`'s skills grow by use,
`RI-CMB02`'s movesets differ, `RI-QST05` reports non-combat resolutions exist. Every verdict passes.
And the game has one build, played six ways, differing only in how fast the health bar goes down.

The test that catches it is not a stat audit. It is **taking each build through the whole game** and
asking whether it *went a different way*.

`S2` is the seam ruling this item enforces the spirit of: *"Souls owns the currency and the curve;
**Morrowind owns the breadth of the stat sheet**"* — breadth meaning **build identity beyond weapon
class**. A build system where the identity is which weapon you swing has delivered the Souls half and
dropped the Morrowind half, and `AR-2` will not catch it because nothing leaked; something failed to
exist.

> One sentence a builder can aim at: **six characters must be able to finish the main quest, top a
> faction, and end the hardest boss — and a stranger reading twenty minutes of their play with every
> proper noun stripped out must be able to say which one they were watching.**

The acid test is the **talker**. A character built on disposition, faction standing, gold, lore and
persuasion, who finishes the game with a combat fraction under a quarter, is only possible if
`S13`'s parley requirement, `RI-QST05`'s ≥45% non-combat resolution bar and `RI-CMP01`'s `DIS→QST` /
`FAC→QST` / `LOR→BOS` cells are all real. A talker who has to pick up a sword for the last boss is
the single clearest evidence that the world and the fight do not touch — which makes this item a
`G2` instrument as much as a progression one.

---

## The reference artifact

### A. The six archetypes (binding)

Each is defined by **what it invests in and what it refuses**, not by a class name. The refusals are
the load-bearing half: a "pure mage" that carries a backup sword has tested nothing.

| id | Archetype | Invests in | **Refuses** | Primary `RI-CMP01` rows it lives on |
|---|---|---|---|---|
| **A1** | **Heavy bruiser** | strength stats, heavy armour, poise, two-handed weapons, `UPG` tier | no magic beyond a bought utility scroll; no stealth; equip-load always heavy | `EQP`, `UPG`, `LVL`, `SKL` |
| **A2** | **Dex duellist** | dexterity, light armour, fast weapons, parry/riposte, i-frame discipline | no heavy armour; no magic; no stealth openers | `SKL`, `EQP`, `DUN` |
| **A3** | **Spellsword** | split investment: a weapon class **and** combat magic; enchanting | no dedicated stealth; no persuasion investment | `SPL`, `SKL`, `EQP`, `UPG` |
| **A4** | **Pure mage** | magicka, spellmaking, utility effects, enchanting; robes | **never** melees; never wears armour above light; no stealth skills | `SPL`, `LOR`, `WLD` |
| **A5** | **Stealth-alchemist** | sneak, security, alchemy, poisons, backstab openers, `RI-EXP06` B-01's ladder | no heavy armour; no open combat if avoidable; no faction uniform | `STL`, `SKL`, `SCH`, `TOD` |
| **A6** | **Talker** | Speechcraft/Personality, disposition, faction rank, gold, lore knowledge | **combat is a last resort**; no combat-skill investment beyond survival | `DIS`, `FAC`, `GLD`, `LOR`, `QST` |

Each build's refusals are **enforced by the driver**, not by the agent's discretion: `session-run.mjs`
runs with `--build A6` and refuses inputs and purchases outside the archetype's declared envelope,
logging every refusal. An agent that wants to break its build is recording a finding, not cheating.

### B. The three viability checks

Every archetype must pass all three. `PLAYTHROUGH-CRITIC.md` §3's `FULL` tier already requires P1 and
P2 for **one** playthrough; this item requires them for six, which is the item's real cost and the
reason for §C.

| Check | Requirement | Evidence |
|---|---|---|
| **V-MAIN** | Completes the main quest end to end (`RI-QST06` Acts I–V, either route) | the session chain, a final `quest_stage`, the ending state |
| **V-FAC** | Takes one faction line to its **top rank** — and across the six builds, **≥ 3 distinct factions** are topped | rank flags; `RI-QST03`'s thresholds actually met, not bypassed by a bug |
| **V-BOSS** | Ends the hardest boss in the game (`RI-AI06`'s highest-tier encounter) | the encounter resolving in the build's favour, by any route |

**"Ends" is deliberate and not "kills".** `S13` gives anything that can speak a non-lethal exit, and
`RI-EXP06` B-10 asserts a boss can be talked, ranked or bought out of the fight. A build that ends the
hardest boss by parley has passed V-BOSS. If the hardest boss is a beast or a mindless thing (`S13`
exempt), the item records that as a **justified exception** and V-BOSS requires a kill for all six —
and the exception is itself a finding worth reporting, because a game whose hardest encounter has no
social exit has put its ceiling on the Souls side of the seam.

### C. Dosage, and the honest compromise

Six × 20 hours is 120 simulated hours and it is not affordable every wave. The tiering:

| Tier | Builds taken to `FULL` | Builds taken to `PARTIAL` (8 h) | What is scored |
|---|---|---|---|
| **Wave with a new main quest act** | 1 (rotating) | 5 | V-MAIN scored on the `FULL` build only; V-FAC and V-BOSS on all six; divergence metrics on the 8 h prefix |
| **Ship wave** | **6** | — | everything |

The rotation is recorded so that over six waves every archetype has been taken to `FULL` once. A wave
that scores V-MAIN on a `PARTIAL` build has extrapolated, and the extrapolation is a finding against
the wave (`PLAYTHROUGH-CRITIC.md` §10, "the dosage gets cut").

### D. The identity metrics — the part that catches "three damage numbers"

Viability is necessary and nowhere near sufficient. Six builds that all walk the same road, kill the
same things in the same order and resolve every quest identically are one build.

| id | Metric | Definition | Bar | Fail |
|---|---|---|---|---|
| **ID1** | **Route divergence** | Mean pairwise **Jaccard distance** between builds over the set of `(quest_id, resolution_id)` pairs actually taken | **≥ 0.40** | < 0.20 → **hard fail** |
| **ID2** | **Verb-profile divergence** | Mean pairwise **Jensen–Shannon divergence** between per-build distributions over the closed verb set (`HARNESS.md` §4 buttons + the world verbs), computed over whole-run frame counts | **≥ 0.35 bits** | < 0.15 bits |
| **ID3** | **Obstacle divergence** | Over **12 named obstacles** (§E), the number solved by ≥ 4 *materially different* means across the six builds | **≥ 8 of 12** | ≤ 3 of 12 |
| **ID4** | **Boss-method divergence** | Distinct kill/end methods on the hardest boss across the six | **≥ 4** | ≤ 2 → **hard fail** |
| **ID5** | **Faction spread** | Distinct factions topped across the six | **≥ 3** | 1 |
| **ID6** | **Region-order divergence** | Mean pairwise Kendall-τ distance over the order in which regions were first entered | **≥ 0.25** | < 0.10 |
| **ID7** | **Talker combat fraction** | A6's `FIGHT` frame fraction (`RI-EXP03` §B classes) over the whole run | **≤ 0.25** | > 0.40 → **hard fail** |
| **ID8** | **Talker completion** | A6 passes V-MAIN, V-FAC and V-BOSS | **true** | false → **hard fail** |
| **ID9** | **Non-violent boss route exists** | ≥ 1 of the six ends the hardest boss without a `death` event on the boss | true, or a recorded `S13`-exempt justification | neither |
| **ID10** | **Blind archetype identification** | §F | ≥ 0.67 | ≤ 0.33 |

**ID1 is the headline number.** Jaccard distance over `(quest, resolution)` pairs is exactly the
question "did they go different ways", and it is computed from trace and quest data with no judgement
in the loop. A mean pairwise distance of 0.40 means that for any two builds, at least 40% of the
resolutions one took, the other did not.

**ID3's "materially different means"** is defined by which `RI-CMP01` system produced the solution —
`STL` and `SPL` are different means; a longsword and a mace are not. That definition is what stops the
metric from rewarding weapon variety, and it is the joint between this item and the matrix.

### E. The twelve obstacles (binding)

Named so that solutions are comparable across builds rather than each build meeting different content.
Proper nouns are `RI-QST06`/`RI-WLD03`'s and may be renamed; the **kinds** bind.

| # | Obstacle kind | The point |
|---|---|---|
| O1 | A locked door with a keyholder who can be reasoned with | security · persuasion · theft · magic · violence |
| O2 | A hostile faction patrol standing on the only road | disguise (`EQP→ROS`) · rank (`FAC→ROS`) · stealth · parley · fight |
| O3 | A guarded object in an occupied building | schedule (`SCH→STL`) · invisibility · disposition · distraction · slaughter |
| O4 | A water/tide barrier | water-walk · levitate · tide timing (`WEA→WLD`) · a boat paid for in gold · a long swim |
| O5 | A quest-giver who lies | lore (`LOR→QST`) · a third party's disposition · following them · confronting them |
| O6 | A rank threshold you do not meet | train with gold · use-growth · fortify-skill (`RI-EXP06` B-02) · a different faction |
| O7 | An enemy far above your tier on a route you need | avoid (`LOR→ROS`) · alchemy · lure (`RI-EXP06` B-11) · night (`TOD→ROS`) · fight it |
| O8 | A named NPC whose death would be convenient | assassinate · frame · persuade · bribe · leave alive and lose the shortcut |
| O9 | A region-wide hazard (fog, salt-storm, blight) | cure item · spell · equipment · route around · endure |
| O10 | A dungeon whose front is a fortified arena | back route (`SKL→BOS`) · levitate the exterior (`SPL→DUN`) · shortcut unlocked from within (`S16`) · frontal |
| O11 | A merchant who will not sell you the thing you need | disposition · faction rank · gold · theft · a different merchant two regions away |
| O12 | **The hardest boss** | parley (`DIS→BOS`, `FAC→BOS`, `GLD→BOS`) · a lore-revealed weakness (`LOR→BOS`) · an upgrade threshold (`UPG→BOS`) · an item counter (`EQP→BOS`) · pure execution |

Every one of the twelve is a `RI-CMP01` cell cluster. **That is the design: the build system's payoff
and the cross-system matrix are the same thing measured from two directions**, and a build system that
is three damage numbers and a matrix that is sterile are the same defect.

### F. The blind check (`blind_pair: yes`)

The strongest single instrument here, because it does not trust any of the numbers above.

A *different* agent (`CRITIC-DOCTRINE` §5, `RI-MTH03`) prepares six **stripped 20-minute
transcripts**, one per build, drawn from the same simulated hour of each run:

- verbs and their frequencies, in sequence;
- events by type, with **all proper nouns, item names, spell names, enemy names, faction names and
  place names replaced by opaque tokens** (`[ITEM-3]`, `[NPC-7]`);
- outcome of each encounter, unlabelled;
- **removed**: stat sheets, equipment lists, skill values, the build's own name, all damage numbers.

A judge who has never seen the builds is given the six transcripts and the six archetype descriptions
from §A, unpaired, and asked to match them. `archetype_identifiable_fraction` = correct matches / 6.
Chance is ~0.17.

**Bar ≥ 0.67 (4 of 6).** Below 0.33 the builds are not distinguishable from how they are played, which
is the definition of "three damage numbers" — and note that this check fires even if ID1 and ID2 pass,
because a build can take different routes while playing identically once it arrives.

Per `CORPUS-CONTRACT` §6, this is not an ours-vs-theirs blind pack and the distrust rule does not
apply; there is no reference set. The judge's **confusions** are the useful output: A1/A2 confusion is
expected and mild (both are melee), A3/A4 confusion is a finding (the spellsword is a mage with a
sword), and **A6 being confused with anything is the strongest negative result the item can produce**.

---

## Comparison method

**Step 1 — six chains.**

```bash
node tools/experience/session-run.mjs --session exp-w<N>-A6-s01 --build A6 \
  --builds corpus/95-experience/RI-CMP03.builds.json \
  --brief corpus/95-experience/briefs/whole-game.md --seed 1337 --minutes 90
node tools/experience/log-lint.mjs --in reports/sessions/exp-w<N>-A6-s01   # must exit 0
```

**Same seed and the same instruction-neutral brief for all six.** The brief states the premise and
"finish the game"; it names no route, no faction, no obstacle and no metric. Six chains from one seed
is what makes divergence attributable to the build rather than to the world's randomness — and
`HARNESS.md` §8's `D5` means a divergence at the same seed is a real divergence, not noise.
`RI-CMP03.builds.json` is generated from §A by `tools/experience/builds-from-md.mjs` and carries each
archetype's investment envelope and its refusal list, which the driver enforces.

**Step 2 — viability.** `tools/quests/viability-walk.mjs --out <dir>`

> **RETARGETED — wave 1, `NEXT-DISPATCH.md` §R (the viability split).** This step named
> the pre-split static build-viability tool, which was rejected five times and has been split. The
> static half survives as `tools/analysis/impossibility-screen.mjs` and is **forbidden in code to
> report that a build works**, so it cannot answer this step at all. The step now names the walk,
> which plays real signatures through the shipping gates from a cold start with nothing granted —
> over a **stratified sample it declares**, and **not** covering `tier5_survivable`. The
> contract below is still open: neither instrument implements `--chains`.

> **PATH CORRECTED, CONTRACT STILL OPEN — wave 1 (`TOOL-COVERAGE-R1`, tool critic).** This step
> named the tool under `tools/experience/`; it was written under `tools/analysis/`, which is where
> `RI-MTH06` §A and `RI-CHR01` M6 both put it, so the path here was the error. **This does not make
> the step runnable.** The shipped tool implements `--signatures`/`--signature` over `RI-CHR01`
> §5's 540-cell grid; it has **no `--chains` mode** and emits no `V-MAIN` / `V-FAC` / `V-BOSS`
> record and no driver-refusal list. Step 2 therefore remains `corpus_debt` against `RI-MTH06`
> until `--chains` exists — the C8 warning cleared, the capability did not. Do not read the
> absence of a C8 line here as coverage.
records V-MAIN, V-FAC and V-BOSS per build with evidence, plus every driver refusal (an archetype that
had to violate its envelope to progress is a **hard finding**: a build that cannot finish as itself is
not a build).

**Step 3 — divergence.** `tools/experience/build-divergence.mjs` computes ID1–ID7 from the six chains
and `game/data/quests/**`. ID1's `(quest_id, resolution_id)` pairs come from `quest_stage` events
resolved against quest `outcomes[]`; ID2's verb distributions from `input` frames; ID6 from `load`
events. All six pairwise matrices are emitted in full, not just their means — **a mean of 0.40 hiding
one pair at 0.05 is the exact failure this item is for**, and `min_pairwise_ID1` is reported alongside
and carries its own soft bar of ≥ 0.20.

**Step 4 — the twelve obstacles.** Each build's solution to each of O1–O12 is extracted from its chain
and classified by the `RI-CMP01` system that produced it, by a judging agent that did not play. An
obstacle the build never reached is `unreached`, not `unsolved`, and is reported separately —
`unreached` on more than 3 obstacles for any build is itself a finding about world reachability.

**Step 5 — the blind check.** §F, run by a third agent. Isolation `enforced`
(`PLAYTHROUGH-CRITIC.md` §5.5): a materialised inbox with only the six stripped transcripts and the
six archetype descriptions. The stripper is a *different* agent from the judge and from the players.
`attested` isolation caps this item at 6.

**Step 6 — cross-checks.**
- Against `RI-CMP01`: every obstacle solution in step 4 should resolve to a **demonstrated** matrix
  cell. A solution using a cell that `matrix-probe.mjs` classed as *paper* is a contradiction between
  the two items and is reported as a referral, not averaged.
- Against `RI-QST05`: the union of the six builds' resolutions is the strongest available evidence for
  the ≥45% non-combat resolution bar, and is exported for that item's critic.
- Against `RI-EXP06`: A5's chain should exercise B-01 (the alchemy ladder) and A6's should exercise
  B-10 (talking a boss down) and B-14 (reading the answer). A build that *cannot* reach its own
  archetype's sanctioned breakage is a finding for both items.

**Step 7 — the negative artifact.** Every failed viability check carries the chain, the frame where
progress stopped, and the driver's refusal log showing what the build was not allowed to do. "A6 could
not pass Act IV" is useless; "A6 reached Act IV stage 3, whose only listed resolution is `combat`, at
frame 412990, with 0 parley topics available on the target" is a remedy.

**No sabotage control is defined.** The six-arm design *is* a control: the six builds are matched on
seed, brief and world, and differ only in the build, so every divergence metric is already a
difference-from-control. The verdict records `sabotage_control: "not_applicable"` with this reason.

---

## Scoring

Native scale 0–100.

| Component | Weight | Full marks |
|---|---|---|
| Viability (V-MAIN, V-FAC, V-BOSS × 6) | 25 | 18/18 |
| Route and verb divergence (ID1, ID2, ID6) | 20 | ≥ 0.40, ≥ 0.35 bits, ≥ 0.25 |
| Obstacle divergence (ID3) | 15 | ≥ 8 of 12 solved ≥ 4 ways |
| **The talker (ID7, ID8)** | **20** | A6 completes with `FIGHT` ≤ 0.25 |
| Boss methods and faction spread (ID4, ID5, ID9) | 10 | ≥ 4 methods, ≥ 3 factions, a non-violent route exists |
| **Blind identification (ID10)** | **10** | ≥ 0.67 |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 85 | Meets the bar | 8 |
| 70–84 | Below bar — named remedy required | 6 |
| 50–69 | Loses outright | 4 |
| < 50 | We lose | 2 |

**Native → ladder anchors:** 6/6 viable, ID1 = 0.25, blind 0.33 → ladder 4 (they all finish and they
are all the same person). 6/6 viable, ID1 ≥ 0.40, ID4 ≥ 4, blind ≥ 0.5, talker under 0.30 → ladder 6.
6/6 viable at `FULL`, ID1 ≥ 0.55, ID3 ≥ 10, ID4 ≥ 5, talker ≤ 0.25 with a parley finish on the hardest
boss, blind ≥ 0.83 → ladder 8. Ladder 9 requires blind identification at 6/6 **and** a build ordering
that a judge cannot rank by power — i.e. no archetype is strictly dominant, which is a claim neither
reference game could make and should be asserted almost never.

**Hard fails — any one caps the item at 2:**

1. **Any archetype cannot complete the main quest** as itself (V-MAIN false, or false only because the
   driver's envelope had to be violated). Six declared builds, one of which is not a build.
2. **`ID8` false — the talker cannot finish.** The single clearest evidence that `S13`'s parley
   requirement, `RI-QST05`'s non-combat bar and `RI-CMP01`'s social-to-fight cells are decorative.
3. **`ID7 > 0.40`** — the talker spent more than two fifths of its run fighting, i.e. it is not a
   talker and the archetype was satisfied on paper.
4. **`ID1 < 0.20`** — the builds took the same road. Route divergence below a fifth means the game has
   one path with cosmetic variation.
5. **`ID4 ≤ 2`** — the hardest boss has at most two answers across six radically different characters.
6. **The blind check was not run**, or was run by an agent that played or built, or at `assumed`
   isolation — `unmeasurable ⇒ 0` for its component, and if ID1 and ID2 are also unavailable, for the
   item.
7. **Fewer than six chains exist.** Extrapolating from four builds is not this measurement.

---

## How we lose

- **We test the builds against the content the builds were designed for.** Each archetype gets its own
  obstacle set, everything passes, and nothing is comparable. §E's twelve *named, shared* obstacles are
  the defence and they are the expensive part, because they require the content to genuinely admit
  four or five approaches rather than one plus a fallback.
- **The talker is the first thing cut.** A6 is the most expensive archetype in the project: it needs
  `RI-QST05`'s non-combat resolutions to be real everywhere, `S13`'s parley on every speaking enemy,
  and a boss with a social exit. Under pressure it becomes "a character with high Speechcraft who also
  fights", `ID7` drifts to 0.45, and the hard fail is the only thing that makes the cut visible rather
  than gradual.
- **`ID1` is satisfied by different *order*, not different *resolution*.** Six builds do the same
  twelve quests the same way in six sequences, and a naive divergence metric over quest ids passes.
  ID1 is defined over `(quest, resolution)` pairs and ID6 measures order separately for exactly this
  reason, and somebody will still implement the simpler version.
- **The refusals get relaxed.** The pure mage picks up a sword in Act IV "because it was stuck",
  the driver's envelope is widened, and the item's whole design — that identity is what you *refuse* —
  quietly inverts. The driver's refusal log is committed per chain so that a widened envelope is
  visible in the artifact rather than in someone's memory.
- **The blind judge matches on cheap tells.** "This one used `cast` a lot, must be the mage" is a
  correct match that proves nothing except that spells exist. The stripper must remove verb *labels*
  that map one-to-one onto an archetype's name — and it cannot, because `cast` is a verb. This is a
  real limitation: `ID10` at 0.67 with all confusions among A1/A2/A3 is a much weaker result than
  0.67 with confusions among A3/A6, and the confusion *matrix* must be read, not the fraction.
- **Six chains cost 120 hours and the wave runs four.** Then two archetypes are `unmeasurable ⇒ 0`, the
  score is capped, and the pressure is to score the four that ran. §C's rotation exists to make the
  compromise legible rather than silent, and it is still a compromise.
- **All six finish and the game has one build anyway**, because the archetypes differ in *inputs* and
  the world responds to none of them. This is the state where every number here passes except `ID3`
  and `ID10`, and it is why those two are the item's real content and viability is only the gate.

---

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **six archetypes** are `canonical-recall`-flavoured but constructed: they are the standard
Morrowind/Souls build space (heavy, dex, hybrid, caster, stealth, social), and the specific one that
matters — the **talker** — is Morrowind's and not Souls'. Morrowind genuinely supports a character who
resolves most of the game through Speechcraft, disposition, bribery, faction standing and lore, and
Dark Souls genuinely does not. That asymmetry is why A6 is the acid test for `AR-3` rather than for the
progression system: it is only viable if the world's systems reach into the fight.

**The refusal-based definition of an archetype is original** to this item and is its main methodological
claim. The alternative — defining a build by its stat allocation — is what produces "three damage
numbers", because two characters with different stats can play identically. A critic who thinks
refusals are too strict (real players hybridise) is right about players and wrong about instruments:
this is a *test harness*, and a test that permits the subject to opt out of its own condition measures
nothing.

**The thresholds are asserted and are the weak part.** `ID1 ≥ 0.40`, `ID2 ≥ 0.35 bits`,
`ID3 ≥ 8 of 12`, `ID7 ≤ 0.25`, `ID10 ≥ 0.67` have no derivation and no reference measurement — nobody
has computed Morrowind's route-divergence across six builds and nobody can. They are set so that the
obviously-failing state (six identical runs) fails and the obviously-passing state (a talker who never
draws a weapon and a bruiser who never speaks) passes, and the middle is where they may be wrong. They
should be re-derived from the first ship-wave's own six-arm distribution, and this note is the record
of what they were beforehand.

`ID10`'s chance baseline of ~0.17 is the expected fraction of correct matches under a uniform random
permutation of six items (1/6), which is the right null for the "match each transcript to an
archetype" framing. If the judge is instead allowed to assign the same archetype twice the null is the
same, but the variance is higher; the protocol in §F requires a permutation and the judge is told so.

**The strongest known weakness** is named in `How we lose`: `ID10` can be satisfied by verb labels that
trivially identify an archetype (`cast` → mage), and the stripper cannot remove them without destroying
the transcript. The confusion matrix is the mitigation and it is a mitigation, not a fix. A future
amendment should test the judge against a *seventh*, deliberately hybrid transcript to measure whether
it is matching on structure or on keywords.
