# Roadmap coverage audit — the inventory, a proposed structure, and the sequencing argument

**Owner of this file:** the roadmap-coverage audit agent (task `ROADMAP-COVERAGE-AUDIT`).
**What it is for:** to give the orchestrator an enumeration of everything on disk that a roadmap has to
cover, a proposed structure that covers it by construction, and the dependency argument for the order.
**What it is not:** a plan. Nothing here is dispatched, and `orchestration/ROADMAP.md` was not touched.

**Baseline commit:** `dd222b7951a6d0564c992bb6d39b783f0f293188`, branch `codex/wave1-build-experiment`.
Machine-readable output: `orchestration/status/ROADMAP-COVERAGE-AUDIT.coverage.json` — it lives under
`orchestration/status/` rather than in `reports/` because `reports/.gitignore` keeps only `*.md` by
design, and this file is a deliverable the orchestrator consumes rather than a reproducible run
artifact. Generated tables: `reports/roadmap-audit/coverage.md`. Regenerate both with
`node tools/roadmap-coverage.mjs`, which **exits non-zero** if any reference item, plan or open gap
has no roadmap home, if any proposed item has nothing mapped to it, or if the proposed order violates
one of its own recorded dependencies. Both failure arms were confirmed to go red on a sabotaged copy
while the unmodified control stayed green; the ordering arm did *not* go red on the first attempt,
because it ranked items by array position instead of by the ring a reader sees, and that defect is
fixed.

---

## 0. What I could not do, first

- **I did not verify the dispatch brief's counts, because they do not reproduce.** The brief said *211
  reference items across 20 corpus areas* and *78 open gaps*. What is on disk at the baseline commit is
  **149 reference items across 18 areas** and **79 open gaps**. Both of my figures are the generators'
  own: `node tools/corpus-index.mjs` prints `reference items : 149` and
  `Reference items found: 149 across 18 area(s)`, and `corpus/90-verdicts/GAP-LEDGER.json` carries
  `counts: {"total":80,"open":79,...}`. I could not reproduce 211 from any count I tried — `RI-*.md`
  gives 149, `RI-*` of any extension gives 159, all `corpus/**/*.md` gives 336, excluding
  `90-verdicts/` gives 223, excluding doctrine as well gives 193. **The 211 is a memory number and
  should not be requoted.** I have proceeded against 149.
- **I could not read the game running.** Offline, no browser, no GPU. Every state claim below is
  derived from verdict JSON and the gap ledger — that is, from what critics measured, not from what I
  measured. Where a verdict is old, my state claim is old with it.
- **`derived_state` in `ROADMAP-COVERAGE-AUDIT.coverage.json` is a mechanical rollup and is unreliable for items with few or
  no reference items.** It is the max `score_0_10` across every verdict naming that item's reference
  items. F1 (materials) shows `planned_unjudged` because no reference item maps to it primarily, even
  though the roadmap records it as done and evidenced on hardware. That is not a bug in the rollup —
  **it is the finding of §4**: the visual programme is not covered by the reference corpus, so no
  instrument can score it. Do not read `derived_state` as a verdict; read the per-item columns.
- **The mapping is authored, not derived.** The inventory (149 items, 49 plans, 79 gaps) comes from a
  filesystem walk and the generated ledgers, and is reproducible. The assignment of each of those to a
  proposed roadmap item is my judgement after reading every reference-item front-matter and title,
  every plan heading and its cited item ids, and every open gap record. A second reader would place a
  handful differently. None of the placements below is asserted without having opened the thing.
- **I did not classify reference items as "delivered, therefore needing no future step".** I checked
  and could not do it honestly: of 149 items, **52 have been scored at or above the bar of 6 at least
  once**, but a best-ever score is not a current state, several of those items have blocking gaps open
  against them, and the project's own rule is that a gap closes only when a *later* wave's critic
  re-measures it — of 80 gaps in the ledger, **0 are closed**. So there is no item I am willing to call
  finished. Every proposed roadmap item carries live work.

---

## 1. The inventory, measured

| inventory | count | source |
|---|---:|---|
| Reference items (`corpus/**/RI-*.md`) | **149** | fs walk; matches `tools/corpus-index.mjs` |
| Corpus areas holding reference items | **18** | same (20 directories exist; `00-doctrine` and `90-verdicts` hold none) |
| Canonical subsystem paths | **331** across 22 roots | `corpus/00-doctrine/subsystems.json` |
| Plans (`orchestration/plans/*`) | **49** (46 build plans + 3 process documents) | fs walk |
| Open gaps | **79** — 1 critical, 53 blocking, 23 major, 2 high | `GAP-LEDGER.json` `counts` |
| Closed gaps | **0** | same |
| Verdicts on disk | **85** JSON, all parseable | `corpus/90-verdicts/wave1/` |

**Judged state of the 149 reference items, derived from all 85 verdicts:**

| state | n | meaning |
|---|---:|---|
| never named by any verdict | **38** | no critic has ever measured against it |
| judged, best score below the bar of 6 | **59** | measured and failing |
| judged, best score at or above 6 at least once | **52** | measured and once satisfied; not the same as currently satisfied |

The 38 never-judged items, verbatim: `RI-AI04 RI-AI06 RI-CMB08 RI-CMB10 RI-CMB12 RI-CAM03 RI-CAM04
RI-PRG05 RI-PRG08 RI-PRG09 RI-QST09 RI-DLG04 RI-DLG05 RI-DLG07 RI-DLG08 RI-TRV02 RI-WLD02 RI-WLD15
RI-WLD16 RI-LOR07 RI-LOR08 RI-VIS01 RI-VIS05 RI-VIS09 RI-MTH05 RI-MTH06 RI-PLT02 RI-UIX01 RI-UIX07
RI-UIX08 RI-AUD04 RI-AUD05 RI-JRN02 RI-JRN07 RI-JRN08 RI-CMP02 RI-CMP03 RI-EXP04`.

Three of those matter more than the rest and belong in the roadmap as named work, not as backlog:
**`RI-VIS01`** (the bifurcation protocol — art direction and fidelity judged separately) and
**`RI-VIS09`** (the reference image set) have never been judged, so the *instrument* the whole visual
programme is scored by is itself unmeasured; and **`RI-JRN07`** (a quest end to end without markers) is
the single journey that most defines the Morrowind half and no critic has run it.

---

## 2. The finding that changes the shape: the phases cut across the material

**The A/V/B/C/D/E/F grouping should not be carried forward, and the reason is measurable.**

The old Phase B ("the Morrowind half") and Phase C ("the Souls half") use the project's arbitration
rule as a work breakdown. The arbitration rule decides *who wins a conflict*. It is not a partition of
the work, and the corpus says so in its own front-matter. Of 149 reference items:

| `side:` | n | % |
|---|---:|---:|
| `morrowind` | 67 | 45.0% |
| `souls` | 41 | 27.5% |
| `neutral` | 31 | 20.8% |
| `modern-fidelity` | 6 | 4.0% |
| `split` | 4 | 2.7% |

**41 items — 27.5% of the corpus — belong to neither half.** A roadmap partitioned into a Morrowind
half and a Souls half has to put them somewhere arbitrary or nowhere, and in the condemned file it
put most of them nowhere (§3). The four explicitly `split` items are the sharpest illustration:
`RI-CMB10` (status buildup, which hands off to the Morrowind affliction economy), `RI-STL01`
(detection and sneak, "the seam at the first blow"), `RI-DLG09` (the parley — the non-lethal exit from
a fight), `RI-WLD10` (the water model, including what standing water does to a fight). Each is one
piece of work that a Morrowind/Souls split has to cut in half.

**The grouping the material actually has is the subsystem taxonomy** — 331 paths under 22 roots in
`corpus/00-doctrine/subsystems.json` — because every reference item declares which paths it judges and
every gap declares the path it opened against. That makes coverage **checkable by a tool** rather than
asserted by a document, which is the property this project keeps discovering it needs.

So the proposed structure below is organised on two axes that do different jobs:

- **Track** (the letter: `I` instruments, `F` frame, `G` fight, `W` world, `C` character, `P` people,
  `T` platform, `E` experience) — *what files and subsystems it touches*. This is the parallel-safety
  axis. Two items in different tracks can almost always run concurrently.
- **Ring** (the number) — *when it can run*. This is the dependency axis.

A track prefix therefore does **not** imply a ring: the camera (`G1`) is scheduled in ring 1 because
every visual verdict on the player's body is taken through it, and save/load (`T1`) is scheduled in
ring 2 because three separate blocking gaps say the character changes when you reload.

### A second finding about the material, and it is the most actionable one

**Of 79 open gaps, at least 13 — and by hand-reading, closer to 25 — are not "unbuilt". They are
"built, correct, and connected to nothing."** A conservative regex over the ledger's own `what` and
`why_it_matters` text (`no consumer|not coupled|never read|renders nothing|no world-side|never drawn|
no writer|data island|cannot be entered|no reader|has no outside|draws nothing|never fire|frozen|
produce no sound|has no gate|not in the world|not wired to|never ran`) returns 13:

```
GAP-W1-weapon-movesets-not-wired-to-the-runtime          blocking  87 movesets unreachable; setLoadout() rejects all 87
GAP-W1-weapon-animation-model-has-no-rendered-consumer   blocking  1150 clips over 2689 slots, nothing draws them
GAP-W1-weapon-impact-and-material-model-has-no-consumer  blocking  the RI-WPN05 model is a data island
GAP-W1-creation-is-an-api-not-a-scene                    blocking  the Writ House renders nothing
GAP-W1-interior-door-draws-nothing                       blocking  a door sets state and draws no door
GAP-W1-audio-emitter-consumption                         blocking  four emitters compute every frame, no sound on any device
GAP-W1-mainquest-topic-bootstrap                         blocking  the main quest cannot be entered by playing
GAP-W1-platform-prng-never-drawn                         blocking  rng.draws is 0 on all 3600 frames
GAP-W1-questionnaire-route-is-unreadable-and-unnamed     blocking  the mandatory creation route reaches the player unnamed
GAP-W1-17-an-archetype-with-no-mouth                     blocking  40 infos written for `a` values no NPC carries
GAP-W1-16-a-save-and-a-reload-change-your-roll-class     blocking  equip load does not survive a reload
GAP-W1-13-clock-consequences-never-fire                  major     the clock's own comparison method has never run
GAP-W1-m6-pan-correlation-passes-the-panner...           major     the instrument passes the thing it was built to catch
```

Read by hand, the same shape covers at least twelve more —
`GAP-W1-magic-effects-no-behaviour`, `GAP-W1-magic-spellmaking-has-no-world-side-surface`,
`GAP-W1-magic-skill-frozen`, `GAP-W1-LIBRARY-the-library-has-no-reader-on-the-world-side` (**the only
`critical` gap in the ledger**: 37,819 words in 65 texts open in the engine across 324 pages and the
player can do nothing with any of them), `GAP-W1-stealth-crime-model-not-coupled-to-the-world`,
`GAP-W1-quest-givers-not-in-the-world`, `GAP-W1-settlement-has-no-outside`,
`GAP-W1-save-purse-has-no-writer`, `GAP-W1-road-join-has-no-gate`,
`GAP-W1-mark-teaches-nothing-to-the-journal`,
`GAP-W1-hearth-levelup-gate-reads-a-method-that-does-not-exist`,
`GAP-W1-faction-ladders-are-doors-onto-empty-corridors`. I report 13 as the mechanical floor and ~25
as the hand-read figure, and say which is which.

**Why this changes the roadmap and not just the queue.** The condemned file made this argument once,
correctly, about one thing — Step 4, the 21 authored quests walled off behind rank 5, "the cheapest
content in the project". The argument generalises across a quarter of the open gaps. **The single
highest-yield increment available is not new content: it is wiring what already exists to the running
world.** That is the same statement as `RI-MTH07` / rule 5, which is why `I4` (consumption as a gate)
sits in ring 0 rather than being a checkbox on each piece.

---

## 3. What the condemned roadmap left homeless

Kept because it is the evidence for rule 0b, and because the replacement should not repeat it. Back-check
is in `ROADMAP-COVERAGE-AUDIT.coverage.json` under `old_roadmap_backcheck`, computed by mapping each proposed item to the old
item that would have carried it.

**14 of 69 proposed items had no home at all in `orchestration/ROADMAP.md` at the baseline commit.**
Between them they carry **35 of 149 reference items (23.5%)** and **20 of 79 open gaps (25.3%)**.

| proposed item | reference items with no old home | how I checked |
|---|---|---|
| `G1` **The camera** | `RI-CAM01`–`RI-CAM07`, `RI-CMB06` | `grep -ic camera orchestration/ROADMAP.md` = 1, and that one hit is line 213, inside a quote about *evidence method* ("rotate the camera around the player"). `lock-on` = 0 hits. Seven reference items, a whole plan (`W1-06`) and part of `W1-29` had no roadmap item. |
| `C1` **Character creation as a played scene** | `RI-CHR01`, `RI-CHR02`, `RI-CHR03` | `character creation` = 1 hit, line 76, where it is the place you *exit* from. `birthsign` = 0. Five blocking gaps sit here, including `GAP-W1-creation-is-an-api-not-a-scene`. |
| `P9` **The main quest** | `RI-QST06` | `main quest` = 0 hits. Two whole plans (`W1-19`, `W1-20`) and two blocking gaps had no home. |
| `W7` **Getting around** | `RI-TRV01`, `RI-TRV02` | `travel` = 0, `transport` = 0, `Recall` = 0, `silt` = 0. Morrowind's transport network and Mark/Recall/Intervention were absent. |
| `C3` **Load, inventory and upgrades** | `RI-PRG07`, `RI-PRG08`, `RI-UIX03` | `inventory` = 0, `encumbrance` = 0, `equip load` = 0. Two blocking gaps. |
| `E7` **Endings and the last hour** | `RI-EXP05` | `ending` = 3 hits, none about a game ending (line 13 "each ending in something visible", lines 134/201 unrelated). `endgame` = 0. **The roadmap had an opening hour and no ending.** |
| `E6` **Session shape and pacing** | `RI-EXP02`, `RI-EXP03`, `RI-EXP04` | `pacing` matched only "spacing" on line 241. `mid-game` = 0. The twenty-hour curve and the novelty decay were absent. |
| `E5` **Build identity** | `RI-CMP03` | `archetype` = 0. Six archetypes each taken through the game had no home. |
| `E4` **Cross-system payoff and emergence** | `RI-CMP01`, `RI-CMP02`, `RI-EXP06` | the seam-sterility floor and the permissiveness budget appear nowhere. |
| `G8` **Healing, status and exhaustion** | `RI-CMB08`, `RI-CMB09`, `RI-CMB10` | `status` = 0. Phase C's seven items name none of the flask, the status meters or the exhausted state. |
| `G6` **Combat HUD and impact feedback** | `RI-UIX01`, `RI-AUD01` | V14 covers HUD *visual design*; E5 covers sound as atmosphere. Neither covers stamina as a correctness property or impact audio as frame-critical feedback. |
| `C5` **Affliction and disease** | `RI-PRG09` (+`RI-CMB10`) | seventeen named diseases; absent. |
| `I1` **The harness and determinism** | `RI-MTH01`, `RI-MTH02` | Phase F is about judging, not the harness. Five gaps including `GAP-W1-platform-prng-never-drawn` (blocking). |
| `I4` **Consumption as a gate** | `RI-MTH07` | `CONSUMPTION` appears once, as a measurement in Step 1's state line — not as work. `RI-MTH07` is named by **24 verdicts**, more than any other item; it had no roadmap item. |

A further **10 items were only partially homed** — the old item named part of the work and silently
omitted the rest: `G2` (old C3 named poise/stagger/parry/backstab and not roll, i-frames, stamina,
hitboxes or input latency), `G4` (enemy behaviour named only in Phase C's *header prose*, with no C
item), `C7` (old B5 named crime and not sneak, ownership, locks, pickpocketing or the fence), `T4`
(old V14 named the HUD's *look* and not the inventory, map or level-up screens), `W9`, `W1`, `F9`,
`P5`, `P10`, `E2`.

**On the graphics directive specifically:** the condemned file *did* honour it in the ordering of live
work — steps 1a/1b/1c are all Phase V items and sit at the top. The defect is different and worth
naming so the replacement avoids it: **Phase V was written as a status table, not as ordered
increments.** V6 through V16 have a state column and no position, so a reader could not say which
increment delivers V8 or V13, or when. That is what the owner's "compressed the entire visual
programme into a single step" complaint was actually about, and it is fixed by giving the frame work
fourteen ordered items in ring 1 rather than one step plus a table.

---

## 4. Is the bar itself sufficient? For graphics, measurably not

The owner's standing question. One part of it has a number.

Counting which reference items declare `judges:` paths under each root (legacy alias `visual` = root
`render`):

| root | subsystem paths | reference items judging them | items per path |
|---|---:|---:|---:|
| `combat` | 52 | 49 | 0.94 |
| `world` | 36 | 44 | 1.22 |
| `quests` | 22 | 25 | 1.14 |
| `magic` | 20 | 6 | 0.30 |
| **`render`** | **25** | **11** | **0.44** |

**The visual programme is judged by 11 reference items against 25 subsystem paths**, and of those 11,
three (`RI-VIS01`, `RI-VIS05`, `RI-VIS09`) have never been named by a verdict and one (`RI-VIS02`, the
fidelity reference set) scored **0/10** on its single appearance. Meanwhile fourteen ring-1 increments
need judging.

**And `F2` (shadow, contact and ambient occlusion) and `F3` (ambient fill) — the two things five of
five blind judges named, the most universal observation in the run — have no reference item dedicated
to them.** I checked this rather than assuming it: no reference item anywhere in the corpus has
shadow, occlusion, lighting or ambient in its `title:`. They are judged only as rows inside
`RI-VIS04` (the renderer feature checklist, which mentions ambient occlusion or contact shadows 8
times) and `RI-VIS03` (the image-metric battery). That is a checklist row carrying an entire
increment — the same shape as the "surfaces are not shaded, they are filled" defect being invisible to
a fidelity score made of instrument-validity checks.

That is a concrete, checkable answer to "the bar itself may be insufficient": **yes, for graphics, and
specifically for shadow, ambient occlusion and ambient fill, which need an item of their own.** It belongs in the roadmap as work
(`I5`), ahead of the ring-1 items it gates, not as a background concern.

I did **not** check the other half of the owner's question — whether we hold Morrowind's region and
topological maps and their Black Marsh equivalents. That needs an inventory of `corpus/**/REF-*` (298
files exist) against the world data, which I did not have budget for. It is the first thing `I5`
should do.

---

## 5. The proposed structure

69 items in 8 rings. Full tables with every reference item, gap and plan against its item are in
`reports/roadmap-audit/coverage.md`; the machine-readable form is `ROADMAP-COVERAGE-AUDIT.coverage.json`.

**Coverage is complete by construction and checked by the generator:** 149/149 reference items,
49/49 plans and 79/79 open gaps map to at least one item; no item has nothing mapped to it; the
generator prints `uncovered: 0` on all three and exits with `mapping problems: 0`.

| ring | what it is | items |
|---|---|---|
| **0** | Instruments — how we know anything. Continuous, never finished. | `I1` harness and determinism · `I2` capture and the Deck · `I4` consumption as a gate · `I5` the corpus audited and extended · `I3` the blind protocols |
| **1** | The frame. Wave 1 by directive. | `G1` the camera · `F1` materials · `F2` shadow/contact/AO · `F3` ambient fill · `F4` light, sky, atmosphere · `F5` the frame pipeline · `F6` terrain and vegetation · `F7` the water surface · `F8` the building kit · `F9` interiors and practical light · `F10` characters and creatures · `F11` animation quality · `F12` VFX · `F13` art direction and region identity · `F14` performance and LOD |
| **2** | The body and the fight. | `T1` save and load · `T2` controls and discoverability · `G4` enemies that can fight you · `G2` the exchange · `G3` weapons and movesets, wired · `G5` bosses and encounter authorship · `G6` combat HUD and impact feedback · `G7` how the fight feels · `G8` healing, status, exhaustion |
| **3** | The world you can navigate by prose. | `W1` terrain form and roads · `W2` regions that read differently · `W3` variety within a region · `W4` settlements with an outside · `W5` doors, interiors, continuity · `W6` legibility — landmarks and prose directions · `W7` getting around · `W8` dungeons and xanmeers · `W9` water and hazards as play · `W10` the living world · `W11` strangeness and the built alienness |
| **4** | The character and the economies. | `C1` creation as a played scene · `C2` levelling and the hearth · `C3` load, inventory, upgrades · `C4` gold · `C5` affliction and disease · `C6` magic that does what it says · `C7` stealth and theft · `C8` crime and justice |
| **5** | People, words and quests. | `P1` the topic web and the dialogue window · `P2` voice, disposition, persuasion · `P3` the journal · `P4` books with a reader · `P5` lore, canon, names · `P6` a quest end to end without markers · `P7` quest givers who exist, ladders that open · `P8` factions with real ladders · `P9` the main quest · `P10` quest texture and consequence |
| **6** | The rest of the platform. | `T3` load, streaming, budgets · `T4` the screens |
| **7** | The whole thing. | `E1` the opening · `E2` the first hour as interaction · `E3` death and recovery · `E4` cross-system payoff and emergence · `E5` build identity · `E6` session shape and pacing · `E7` endings and the last hour · `E8` returning after a week · `E9` sound |

**On granularity.** 69 items against 149 reference items is 2.2:1 — a real compression, and comparable
to the condemned file's 52. `G2` absorbs nine reference items; `P10` absorbs seven; `F5` absorbs the
whole post pipeline. If 69 is too many, the merge that costs least is ring 1: `F2`+`F3` are one
remedy (darkness), and `F6` could absorb `F7`. I would **not** merge to get below ~55; every merge
past that point puts two different subsystem roots in one item and destroys the parallel-safety
property the track axis exists for.

---

## 6. The sequencing argument

21 dependency edges are recorded in `ROADMAP-COVERAGE-AUDIT.coverage.json` under `dependencies`, each with the gap or item
that evidences it. The generator checks the proposed order against them and reports
`dependency_order_violations`. **It reports 0.** It reported 7 against my first draft; the seven fixes
are the substance of this section, and each one is a claim the replacement roadmap should carry.

**The known one, and its resolution.** `P6` (a quest end to end without markers) depends on `W6`
(landmarks and prose directions). Confirmed from the items themselves: `RI-JRN07` is titled "rumour,
giver, prose, landmark, resolution, journal" and `RI-WLD06` is "Navigation without markers —
landmarks, signposts and prose directions". **Order, do not merge.** They are different subsystem
roots (`world.*` vs `quests.*`), so merging them makes one item two agents cannot share, and the
world item is worth judging on its own — a player should be able to navigate by prose before any
quest asks them to. Ring 3 before ring 5 satisfies this with no special case.

**Six more that were violated and are now fixed by the ordering:**

1. **`T1` save/load moves from the last phase to ring 2.** Three blocking gaps say the character
   changes when you reload: `GAP-W1-16-a-save-and-a-reload-change-your-roll-class` (equip load),
   `GAP-W1-save-purse-has-no-writer` (spendable gold has no writer),
   `GAP-W1-platform-save-drops-entity-prev-state`. Progression (`C2`), load (`C3`) and the economy
   (`C4`) cannot be judged across a session until this holds. Save is not a platform chore; it is a
   precondition of every ring-4 verdict.
2. **`T2` controls moves to ring 2, ahead of `G7`.** "How the fight feels" is judged by humans
   playing. `GAP-W1-input-discoverability-unmeasured` (major) records that `RI-JRN03`'s entire
   discoverability block — 14 of its 100 points, and the home of its hard fails — has never been
   measured. You cannot ask a stranger to judge feel through controls they cannot find.
3. **`G1` the camera moves to ring 1**, ahead of `F10` (characters). `RI-CAM07` is filed
   `side: modern-fidelity` and titled "what the always-behind camera specifically demands of the
   player's body". The owner's own complaint — *"rotate the camera around the player and it's
   immediately obvious"* — is a statement that the camera is the instrument the body is judged
   through. It also gates `G7`: `RI-CAM03` and `RI-CAM04` (lock-on framing, directional roll clips)
   have never been judged and `RI-CAM01` scored 2/10.
4. **`G4` enemies moves ahead of `G2` the exchange.**
   `GAP-W1-enemy-attacks-cannot-reach-contact-range` (blocking): an enemy attack's swept volume does
   not cover the attacker's own root translation, so it cannot hit a target it walks into. Roll
   i-frames, poise and stagger cannot be measured from the receiving end of an attack that never
   lands.
5. **`I5` corpus moves ahead of `I3` blind protocols.** `GAP-PACK-01` (high): the blind pack cannot
   separate quality from provenance and each round's fix creates the next round's tell. A pack built
   on plates that cannot satisfy their own rows is not a judgement, so the plates come first.
6. **`P3` the journal depends on `W6`, not on `P6`.** I had this edge wrong in the first draft.
   `GAP-W1-mark-teaches-nothing-to-the-journal` (blocking) says looking at a landmark writes a `know:`
   flag and no journal entry — journal `[10] -> [10]` on all four browser legs. The journal's missing
   input is *world discovery*, which is `W6`, not a completed quest.

**Two dependencies that are not order violations but are worth stating**, because they are the
non-obvious ones:

- **`C7` stealth depends on `F9` interior lighting** — a gameplay system gated on a graphics item.
  `GAP-W1-seven-tenths-of-the-indoor-floor-is-at-the-top-of-the-light-scale` (blocking): on a
  16,996-cell chest-height grid over all 115 interiors, 12,210 cells (71.8%) read L = 1.0000. The
  sneak model is reading a saturated light field. This is the best single argument in the repo for the
  owner's graphics-first directive being *correct on gameplay grounds*, not only on presentation
  grounds — and it is why `F9` sits in ring 1 and `C7` in ring 4.
- **`P7` quest reachability depends on `W4` settlements having an outside.** The condemned roadmap's
  Step 4 called this "the cheapest content in the project… twelve `world_flags` entries". That is
  understated: `GAP-W1-quest-givers-not-in-the-world` (blocking) records that **nine of ninety-four
  quest givers exist anywhere a player can stand**, and `GAP-W1-settlement-has-no-outside` (blocking)
  records that round 2 built the inside of 115 buildings and none of the outside of 202. Unlocking
  rank 5 does not make a quest reachable if nobody is standing there to give it. Twelve flags is
  necessary and nowhere near sufficient.

### Cheap and visible — argue these upward within their ring

- **`P4` books with a reader.** The only `critical` gap in the ledger. 37,819 words in 65 texts,
  324 pages, all opening correctly in the engine, and the player can do nothing with any of them.
  Written, shipped, walled off — exactly the Step-4 argument, and nothing is being done with it.
- **`G3` weapons wired.** 87 authored movesets, 1150 animation clips over 2689 slots, a complete
  impact and material model — and `setLoadout()` rejects all 87 roster ids. Three blocking gaps, one
  seam.
- **`C6` magic.** 55 catalogued effects with one behaviour behind them, spellmaking with no world-side
  surface, and `MagicSystem.skills` a private object frozen at 30. Nothing to show for the whole
  catalogue.
- **`P7` ladders past rank 5** — still cheap, still visible, but sequenced behind `W4` as above.

### Expensive and invisible — do not pull these forward

`E6` (session shape, the twenty-hour curve, the mid-game sag) and `E7` (endings) cannot be measured on
a game that has no mid-game and no last hour; measuring them now produces a number that means nothing.
`E4`'s emergence fuzzing (`RI-CMP02`, never judged) is expensive per finding and gets cheaper as the
systems it combines become real. `E5` (six archetypes through the whole game) is a full playthrough
times six.

### Cannot start until something is *judged*, not merely built

- **`F13` art direction / Protocol B.** Protocol B has never run. It needs `I5` to fix plates that can
  satisfy their own rows before its first judgement means anything.
- **`G7` how the fight feels.** Needs `G1`, `T2` and a runback loop to exist *and be judged working*
  before a human's verdict on feel is about the fight rather than about the controls.
- **Everything in ring 1 needs `I2`.** `GAP-W1-w1-30e-street-gate-never-ran` (blocking) — the eight
  settlement street shots the plan names as its deciding gate placed the camera inside geometry — and
  the capture daemon returning zero frames under load. Visual work that cannot be captured cannot be
  judged, and the project has already declared one visual defect fixed while it was still broken.

---

## 7. Proposals, in one line each

Proposals only. The orchestrator writes the replacement.

1. **Drop the Morrowind-half / Souls-half split as a work breakdown** — 27.5% of the corpus is neither,
   and the four `split` items are single pieces of work it cuts in half.
2. **Adopt track × ring** — track = what it touches (parallel safety), ring = when it can run; a track
   letter must not imply a ring.
3. **Give every roadmap item an explicit `subsystem_paths` list** so `corpus-index.mjs` or a successor
   can *prove* coverage instead of a document asserting it. This is the durable fix for the defect
   that produced this audit.
4. **Add the 14 missing items** — `G1` camera, `C1` creation as a scene, `P9` main quest, `W7` getting
   around, `C3` load/inventory, `E7` endings, `E6` pacing, `E5` build identity, `E4` cross-system,
   `G8` healing/status, `G6` combat HUD and impact feedback, `C5` affliction, `I1` harness, `I4`
   consumption.
5. **Split the ten partially-homed items** so the omitted halves are named — most urgently old-C3
   (add roll/i-frames/stamina/hitboxes/latency), old-B5 (add sneak, ownership, locks, fencing) and
   old-V14 (add the inventory, map and level-up screens as function, not only as style).
6. **Move save/load and controls out of the last phase into ring 2** — three blocking gaps make them
   preconditions of every progression and economy verdict.
7. **Move the camera into ring 1** — it is the instrument every visual verdict on the body is taken
   through, and it currently appears on no roadmap at all.
8. **Replace Phase V's status table with fourteen ordered increments** — the table is why a reader
   could not say which step delivers V8 or V13.
9. **Make "wire what exists" a first-class kind of increment**, not a hidden sub-task — a quarter of
   the open gaps are a correct model with no consumer, and it is the cheapest visible progress
   available.
10. **Put the corpus-sufficiency work (`I5`) ahead of the ring-1 items it gates** — shadow and ambient
    occlusion, the most universal blind-judge observation, have no reference item of their own.
11. **Do not requote 211 reference items or 78 gaps.** The numbers are 149 and 79, and both come from
    generators that can be re-run.
