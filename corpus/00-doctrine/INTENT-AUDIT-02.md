# INTENT-AUDIT-02 — is the bar aimed at what was actually asked for?

**Auditor:** `critic.intent`, wave 0, second pass. **Date:** 2026-08-06.
**Read:** `INTENT-AUDIT-01.md` / `.json`; all of `corpus/00-doctrine/` (ARBITRATION S1–S25,
CRITIC-DOCTRINE, COHERENCE-AGENT, SCORING, CORPUS-CONTRACT, CORPUS-COHERENCE-01,
BAR-CRITIQUE-01, BAR-CRITIQUE-IMAGES-01…04, README, INDEX, subsystems.json, constants.json);
`docs/PLAN.md`; `orchestration/AGENT-PROTOCOL.md`, `ORCHESTRATOR-RULINGS.md`, `STATUS.json`,
all 15 briefs; and the corpus at **137 items / 323 paths / 0 holes / 0 unresolved / 0 problems**
(`node tools/corpus-index.mjs --strict`, exit 0), with targeted reads across `12-weapons`,
`15-camera`, `22-character`, `23-stealth-crime`, `25-magic`, `50-world`, `85-platform`,
`86-ui`, `87-audio`, `88-journeys`, `95-experience`.

**Source of truth:** the user's brief and the nine subsequent user directions. Not the
doctrine. The doctrine is the defendant. **See ND-03: the brief is not quoted verbatim
anywhere in this repository, and the file that audit 01 named as holding it does not exist.**

---

# 1. VERDICT: **DRIFTED**

**But narrowly, and for a short list of specific reasons.** This is not the verdict audit 01
returned. Eleven of seventeen drifts are fully closed, three are partly closed, three are
untouched. Every clause of the brief that originates in a **direct user instruction** now maps
to at least one reference item with a named critic and a measurable, falsifiable bar — which
was gate condition A10, and it is met. The corpus is, on the evidence, aimed at the thing the
user asked for.

What is not aimed at it is **the plan**. `docs/PLAN.md` is byte-identical to its first commit
(`bbae0f2`, 2026-08-05 22:26). It predates nine seam rulings, twelve corpus areas, 73 reference
items and 123 subsystem paths. Its fourteen Wave-1 pieces contain **no piece** for the camera,
transport, magic, weapon movesets, UI, input, audio, persistence, character creation,
stealth/crime, user journeys or the played experience — that is **six of the nine later user
directions with no builder assigned to them**. This gate controls whether development starts.
If it returns ALIGNED, builders are dispatched from that file, and the things the user asked
for most explicitly are precisely the things nobody is dispatched to build. That alone is
disqualifying, and it was gate condition **A8**, stated plainly, and not attempted.

Second: **the ID-01 repair stopped at the ruling**, which is the exact meta-finding of audit 01
recurring inside its own worst drift. Audit 01 required four corrections. Two landed (the §1
conduct/exit split, the restated S13) and propagated well into new items. Two did not: **AR-2
check B12 does not exist** in `CRITIC-DOCTRINE.md` (B10, B11 and B13 are there; B12 is not) and
**`PACIFIST-IN-FIGHT` appears in no reference item**. So the fight now *may* end without a
corpse, and nothing detects a build in which it never does, and nothing counts how often it
does. A build that shipped zero working non-lethal exits would pass every check in the corpus —
which is the same sentence audit 01 wrote about travel, one seam over.

Third, five new drifts. The sharpest is **ND-01**: seam S21 names three random checks that
survive — persuasion, pickpocket, spell failure — and the corpus deletes two of them, in items
that cite S21 while contradicting it. After S21, **`RI-DLG04`'s persuasion roll is the only
surviving die in the entire world model.** That is S7's shape again: a Souls principle (S1, no
dice) allowed to define the boundary of its own authority, and inside the boundary it deleted a
Morrowind system that lives outside the fight.

**Four gate conditions below. Three are single-file edits. The fourth is one agent, one pass,
regenerating PLAN.md from `subsystems.json`.** None requires new research and none reopens a
design argument. This verdict should cost hours, not a wave.

---

# 2. The seventeen prior drifts

**Fixed 11 · partly fixed 3 · still drifted 3.**

| id | Prior finding | Status | Evidence |
|---|---|---|---|
| **ID-01** | Hostility deletes the world; killing is the only sanctioned exit | **PARTIALLY FIXED** | **Landed:** `ARBITRATION.md:18–36` now separates Souls' authority over *how fighting works* from the world's continued existence, and explicitly preserves fleeing, yielding, parley, bribery, non-lethal outcomes and mid-fight crime/faction accrual — with the ≥45% bar named as what would otherwise be gutted. `:88` S13 is restated as SPLIT: Souls owns the absence of a browsable topic list mid-swing, Morrowind owns the requirement of a non-lethal exit for anything capable of speech, beasts exempt, "a humanoid faction NPC with no parley path is a **defect**". It **propagated**, which audit 01's corrections usually did not: `RI-CMP01:155,157,193` makes parley three of its declared crossing cells (`FAC→BOS`, `DIS→BOS`, `BOS→LOR`); `RI-CRM01:201,362,410` routes the guard-attack band to a surrender parley and asserts its presence in scoring; `RI-EXP06:263–265` probe `PB-10` invokes parley on a boss and reds if bosses become parley-exempt; `RI-EXP03:93` registers a `parley` trace event; `RI-JRN02:192,259` accounts for it. **Not landed:** `CRITIC-DOCTRINE.md` §4.2 has **B10, B11, B13 — no B12**. `grep -rn PACIFIST-IN-FIGHT corpus/` returns hits only inside audit 01's own files; `RI-QST05:71–78` still measures PACIFIST-ALL, MAIN-QUEST-PACIFIST and SIDE-PACIFIST, none of which is re-attempted post-aggro. The ruling is right and unenforced. See also **ND-04** — its *form* is still undecided |
| **ID-02** | Transport mandated by S7, owned by no item | **FIXED** | `corpus/50-world/RI-TRV01-transport-network.md` (`kind: graph`, judges `world.traversal.transport` + 8 more) and `RI-TRV02-travel-magic.md`. `subsystems.json:1083` retitled to *"The in-fiction transport network REQUIRED by seam S7 — modes, lines, stations, fares, ride time; warp-to-map-pin is what is banned, not travel"*. `RI-PRG04:255` cites its thresholds (≥5 modes, ≥17 lines, ≥60 services, all fares > 0, all ride times > 0) |
| **ID-03** | S19 forbade the teleport spells S7 requires | **FIXED** | `ARBITRATION.md:98` S19 now places Mark/Recall and Intervention *inside* the S7 network with its rules (known destinations, above ground, out of combat, never into a dungeon/boss arena), forbids teleport as a level-design solvent, and carries the struck-through prior wording per §5's append-only rule |
| **ID-04** | Weapon movesets: no bar, no critic, no backstep-attack | **FIXED** | `corpus/12-weapons/` — RI-WPN01 (slot contract), 02 (class differentiation), 03 (within-class subtlety), 04 (contextual attacks), 05 (feel/impact), 06 (two-handing/shields/parry), `moveset.schema.json`, and `WEAPON-CRITIC.md`, whose §0 quotes the user's direction **verbatim** including "the bar critic thinks about and pushes on that bar". `critic.weapons` is in `subsystems.json.critics` with a mandate to run the moveset validator and never read source. 20 `weapon.*` paths. "backstep" is now in RI-WPN01/02/03/04/06, RI-CMB06, RI-CMB09 and RI-JRN03 |
| **ID-05** | Mobile + GameSir X2s: zero occurrences anywhere | **FIXED** | `RI-JRN04-mobile-and-gamepad.md` — the X2s named in its title, `provenance: community-data` with vendor page / manuals.plus / MDN / web.dev cited per row, both enumeration modes profiled (`x2s-standard` and the XInput descriptor), radial deadzone 0.14, edge latching into the 60 Hz step, the "invisible until first button press" hazard (L1) ruled on, touch fallback T4/T6/T9, `__HARNESS.gamepad.connect/set` for automation, and **M-P1 hard-fails any unbound action or any action reachable on only one descriptor**. `input.*` root, 10 paths, including `input.modality.parity`. `RI-JRN03` covers desktop |
| **ID-06** | `experience.*`, `critic.experience`, RI-EXP01–06 all absent | **FIXED** | 15 `experience.*` + 6 `composition.*` paths; `critic.experience` registered and bound to `PLAYTHROUGH-CRITIC.md` §4; RI-EXP01–06 all on disk. The user's *"a fan of"* is honoured as a real plural: `journey.process.fleet` — *"one critic per journey, fresh context, evidence, aggregation"* — plus `journey.process.naive`, the enforced first-time-user protocol |
| **ID-07** | save/load judged only by two methods documents | **FIXED** | `RI-JRN05-save-and-load.md`: state manifest, empty-round-trip-diff requirement, IndexedDB ruled in and `localStorage` banned outright, cloud saves banned as unmeasurable, corruption and quota/eviction cases, M19 second-death bloodstain cross-checked against RI-JRN06 with an explicit precedence rule. Judges `journey.save.roundtrip`, `platform.save.persistence`, `platform.save.storage` |
| **ID-08** | Nothing encoded Morrowind's opening | **FIXED** | `RI-EXP01-first-hour-beat-sheet.md` §A Seyda Neen 0–60 min and §B Asylum/Firelink 0–60 min as beat tables, reduced to eleven shared beats SB1–SB11 (confinement→weather, identity by interrogation, an authored defeat, a hub with exits you are not strong enough for, the loop closing) with the one thing neither game does stated at `:101`. `RI-CHR01/02/03` cover origin, race and birthsign |
| **ID-09** | `RI-PRG04`'s S7 axis scored 10 for the system's absence | **FIXED** | `RI-PRG04:255` now scores 10 only for *"the transport network of `RI-TRV01` exists and is used … **and** every warp code path lies inside the transport module"*, and 0 for *"HEARTH menu offers destinations, **OR** warp-to-map-pin exists, **OR** no transport network exists at all → automatic fail **in both directions**"*. Amendment note at `:263` |
| **ID-10** | §1 domain table still said "no fast travel except…" | **FIXED** | `ARBITRATION.md:63`: *"hand-placed density, named interiors, walk-and-navigate wayfinding, **and a real in-fiction fast-travel network** (S7). Only warp-to-map-pin is banned"*. Gate A2's grep is clean: the only surviving "no fast travel" strings are the struck-through text inside S7, `RI-WLD01:185` where it has been reworded to a *measurement condition*, and audit-01's own record of the finding |
| **ID-11** | C4.3 forbids the attribute/skill gates §1 and S3 require | **STILL DRIFTED** | `COHERENCE-AGENT.md:133` is unchanged: *"C4.3 Gating is by lethality and knowledge, never by level checks (seam S9)."* No scope word. A coherence agent applying it literally still files a finding against a correct Morrowind faction gate. Note the taxonomy got this right where the checklist did not — `INDEX.md:206` correctly scopes it as **`world.region.gating`** — which makes the one-word fix unambiguous |
| **ID-12** | `RI-CMP01` cited by AR-3 but nonexistent | **FIXED** | `corpus/95-experience/RI-CMP01-cross-system-payoff-matrix.md` exists with 41 declared crossings, a demonstrated-not-declared rule, and a self-declared debt (F→W crossings at 27% against a 1/3 gate) recorded rather than the bar lowered. ID-01's non-violent exit is among its required cells (`:155`, `:157`) |
| **ID-13** | PLAN.md predates the corpus; no gate | **STILL DRIFTED** | `git log -- docs/PLAN.md` → one commit, `bbae0f2`. Unchanged. `:5` still says "Ten agents". No piece for camera, transport, magic, movesets, UI, input, audio, persistence, character, stealth/crime, journeys or experience. No gate clause. See §4 and gate **B4** |
| **ID-14** | `combat.core` is one piece judged by eight items | **STILL DRIFTED** | Same file, same line `:46`. Unchanged |
| **ID-15** | `RI-VIS02` is `blind_pair: yes` with no images | **PARTIALLY FIXED** | **Landed:** 173 files under `corpus/70-visual/refs/`, registered by a new `RI-VIS09` whose §5 is readable by a blind judge without contamination, and whose bifurcation is enforced per-directory. `refs/morrowind/` is populated across REF-A1…A19. The acquisition prompt `docs/REFERENCE-IMAGE-REQUEST.md` v4 has been through four bar-critic reviews and reads SUFFICIENT. **Not landed:** `refs/modern/` has images in **2 of 7 slots** — 24 Witcher-3-next-gen HUD frames and one RDR2 frame. `combat/`, `exterior_daylight/`, `exterior_lowlight/`, `interior_darkemissive/` and `material_closeup/` are **empty**. There is **no Elden Ring and no Skyrim frame anywhere in the tree**, and those are the two titles the user named. `RI-VIS02` is still `blind_pair: yes` with every REF-M entry marked `FETCH: spec only` or "image bytes not retrieved". The fidelity blind pack still cannot be built. This is now a *scheduled* gap with an owner rather than an unnoticed one, which is why it is "partial" and not "drifted", but the clause the user stated is not yet covered by pixels |
| **ID-16** | 31 holes, 19 front-matter errors, 206 dead aliases | **PARTIALLY FIXED** | `node tools/corpus-index.mjs --strict` exits **0**: 323 paths, 137 items, 323 judged, **0 holes, 0 unresolved, 0 error, 0 warn**, and `--check` is now a blocking gate (`CORPUS-COHERENCE-01` §4d). RI-CMB08's and RI-WLD08's dead `judges:` paths are fixed to canonical spellings. **Outstanding:** 202 legacy alias spellings still in use (was 206) — they resolve, so this is hygiene, not misrouting; and `CORPUS-COHERENCE-01` §12.2 records that **126 items lack the W7 ladder-anchor row** and would score `unmeasurable ⇒ 0` under the rule as written. That is the bar critic's to gate, not mine, but it means the index being clean does not yet mean the corpus is scorable |
| **ID-17** | Every travel check was one-directional | **FIXED** | `CRITIC-DOCTRINE.md:251` **B13** — board each modality from three settlements, pay gold, arrive at a *station*, verify in-world time advanced and the destination was previously visited; *"no modality boards → AR-2 fail"*, with B2 and B13 explicitly declared a pair that must be run together. `COHERENCE-AGENT.md:85–89` extends T6 with the transport link and states why: *"nothing tested that the network S7 mandates exists at all, so a build with no transport passed"* |

---

# 3. Clause coverage

A clause is **covered** when at least one reference item's `judges:` list, or a seam ruling with
a named enforcement instrument, makes it checkable by a named critic.

## 3.1 The original brief

| Clause | Items / instruments | Covered |
|---|---|---|
| Morrowind's world, Souls' combat, arbitrated | `ARBITRATION.md` §1–§5, S1–S25, AR-1/AR-2/AR-3 | **Yes** |
| Souls wins inside the fight only where necessary | `ARBITRATION.md:18–36` (the necessity test is now written out) | **Yes** — but see **ND-05** for the one seam that grants territory without applying it |
| Morrowind wins everywhere else | §1 domain table (10 rows), all corrected | **Yes** |
| An hour to cross on foot | `RI-WLD01` (14.5 km² walkable, 79 min at 2.0 m/s, THE CROSSING = 57.6 min) + S17 (the hour may not be bought with slow walking) | **Yes** |
| Bonfires; souls level you and only you; gold is the currency | `RI-PRG04`, `RI-PRG01/05/06`, S15 | **Yes** |
| Density per minute of travel | `RI-WLD02`, with `RI-WLD09`'s deliberate-emptiness manifest resolving W2 | **Yes** |
| Words of unique dialogue per settlement | `RI-DLG02` | **Yes** |
| **How many quests resolve without combat** | `RI-QST05` (PACIFIST-ALL ≥45%, VERB-SPREAD ≤40% hard fail, per-faction spread ≥40 points) | **Partial** — the pre-aggro fraction is measured; the post-aggro fraction is not. `PACIFIST-IN-FIGHT` was required by audit 01 and does not exist |
| Faction escalation, deceit, gating | `RI-QST01/02/03` | **Yes** |
| The topic list as a graph | `RI-DLG01`, `RI-DLG03`, `RI-DLG04` | **Yes** |
| Journal entries as written | `RI-DLG05`, `RI-UIX04`, `RI-JRN08` | **Yes** |
| A minute of Souls combat as inputs and states | `RI-CMB07` (exemplar invalidated by S22 and flagged for regeneration — honest, and tracked) | **Yes** |
| Strangeness | `RI-WLD05`, `RI-WLD14`, `RI-WLD09` | **Yes** |
| Side-quest volume and texture | `RI-QST07` | **Yes** |
| Build the bar first | Wave 0 has produced 137 items and **zero** files in `game/` | **Yes** |
| Builder + separate critic, fresh context, per piece | `BUILDER-PROMPT-TEMPLATE.md`, `CRITIC-PROMPT-TEMPLATE.md`, `CRITIC-DOCTRINE.md` §9 (conflict of interest) | **Yes** as doctrine — **No** as decomposition; see ID-14 |
| Blind comparison | `RI-MTH03`, `RI-VIS06`, `RI-DLG07`, `RI-WLD04` M17/M20, `RI-WPN02` three-trace test | **Yes**, except the fidelity pack (ID-15) |
| Exactly one biggest gap | `SCORING.md` §2.2, `ARBITRATION.md:119`, `verdict.schema.json` | **Yes** |
| End-of-wave coherence agent | `COHERENCE-AGENT.md` T1–T7 + C1–C5, `critic.coherence`, 8 paths | **Yes** |
| **Wide before deep — traversable world and completable main quest from an early wave** | `PLAN.md:21–26` states the invariant; `RI-QST06` owns the main quest | **Partial — the invariant survives, the decomposition that would deliver it does not.** See §4 |
| Never leave a region or questline missing | `PLAN.md:23–26`; `RI-WLD04`'s 13 regions; `RI-QST01/03`'s faction lines | **Partial**, same reason |
| Every piece maps to the items that judge it, with the method written down | `INDEX.md` (323/323 judged, 0 holes), each item's `## Comparison method` | **Yes** |
| Current-generation reference shots (Elden Ring, Skyrim); an artifact to lose to | `RI-VIS02/03/06/07/09`, `refs/` | **Partial** — see ID-15. Twelve numeric metrics are implemented (`METRICS-IMPLEMENTATION-01.md`); the named-title pixels are not held |
| Black Marsh / the Argonian premise | `RI-LOR01` (canon dossier), `RI-LOR07`, `RI-CHR02`, `RI-WLD10` §3 (amphibious privileges), S20, S24 | **Yes** |

## 3.2 The nine later directions

| Direction | Items / instruments | Covered |
|---|---|---|
| **1. Third person, matching Souls in all respects** | S18 (18 named behaviours); `RI-CAM01…07`; `RI-VIS08`; S25 makes it load-bearing for water depth reading | **Yes at the bar. No in the taxonomy** — see **ND-02**: no `camera.*` root, no `critic.camera`, and the *out-of-fight* camera is administered by `critic.combat` |
| **2. A bar critic judging the bar itself, gating progress** | `BAR-CRITIQUE-01` (INSUFFICIENT, 15 gates), `BAR-CRITIQUE-IMAGES-01…04` | **Yes as a role.** Its live substantive verdict judged 64 items and is superseded by 137; `bar-critique-02` is in flight concurrently with this audit. Gate **B4** binds the two together |
| **3. Fast travel must exist, Morrowind-style, world not combat** | S7; `RI-TRV01`/`RI-TRV02`; `RI-PRG04`'s two-directional axis; AR-2 **B13**; COHERENCE T6 | **Yes** — this is the best-repaired area in the corpus |
| **4. Weapon movesets, dedicated bar, dedicated harsh critic, bar critic pushes on it** | `RI-WPN01…06`, `moveset.schema.json`, `WEAPON-CRITIC.md`, `critic.weapons`, 20 `weapon.*` paths | **Yes** for the bar and the critic. The *bar critic pushing on it* is `bar-critique-02`'s obligation and is unfinished — gate **B4** |
| **5. Journey testing by a fan of harsh critics: new-game flow vs Morrowind's opening; desktop and mobile+X2s; save/load** | `RI-JRN01…08`, `RI-EXP01`, `journey.process.fleet`, `journey.process.naive`, `critic.journey`, `input.*` (10 paths) | **Yes**, all four sub-clauses |
| **6. Agents must checkpoint** | `orchestration/AGENT-PROTOCOL.md`; 20 live status files; `STATUS.json` aggregating 14/16 complete | **Yes** |
| **7. Diverse biomes within Black Marsh lore; critics check it against appropriate bars** | S24; `regions.json` (13 regions, 0.31–2.07 km², summing to the 14.5 km² budget); `RI-WLD04` M17 blind region test ≥33/39 day, M18 ≥6 of 9 axes per region *pair*, M20 audio blind ≥26/39; `RI-WLD12` borders; `RI-WLD10` §8 regional water profile | **Yes, and enforced hard.** S24 binds *"every critic touching world, art direction, audio or encounter design"* |
| **8. One live auto-refreshing progress page** | `docs/progress.html` (77 KB, `meta http-equiv="refresh"`), regenerated by `tools/progress.mjs` | **Yes** |
| **9. Loop until all critics conclude the game meets its bars** | `PLAN.md:18–19`; `SCORING.md` gap-ledger rules; `tools/gap-ledger.mjs`; a gap may not be closed by whoever built the fix | **Yes** |

**Every clause originating in a direct user instruction now maps to ≥1 reference item.** Gate
condition **A10** is met. The three "partial" rows above are partial for reasons already named
as drifts (ID-01, ID-13/14, ID-15), not for want of an owner.

---

# 4. The nine new seams, audited for the S7 failure mode

S7's error had a specific shape: *a Souls convention was allowed to define the boundary of its
own authority, and inside that boundary it deleted a Morrowind system the brief had put on
Morrowind's side.* Each new seam was tested against it.

| Seam | Direction of travel | Verdict |
|---|---|---|
| **S16** dungeon architecture | Grants Souls **8 dungeons** inside `world.*`, Morrowind's named domain, against 82 Morrowind caves | **Watch — ND-05.** It is a *split by census*, not a deletion, and it explicitly fails both a Souls-loop that is merely a long cave and a cave inflated into a shortcut puzzle. But it is the one seam that moves territory to Souls **outside the fight** without writing down the brief's necessity test, and S7's whole lesson is that unrecorded domain grants are how this fails |
| **S17** where the hour comes from | Protects Morrowind against a Souls-side temptation (slow walking) | **Clean, and exemplary** — it names the Souls property (2.0 m/s tuned for combat spacing) and forbids using it to buy Morrowind's number |
| **S18** camera / third person | Deletes Morrowind's first-person option | **Clean — user-directed.** Direction 1 is explicit. The reasoning is also correct on its own terms (you read your recovery frames off your own silhouette) and it binds *outside* the fight to keep the seam from moving at the combat boundary. Taxonomy problem only: **ND-02** |
| **S19** magic | Split; corrected in this repair cycle | **Clean.** Outside the fight it says "MORROWIND, **emphatically**" and makes spell effects a load-bearing part of the ≥45% bar. `RI-MAG02` refuses to delete levitation or teleport by neglect (`:34`, `:251`) — the anti-pattern S7 exemplified, named and guarded |
| **S20** era authority | Restricts ESO 2E material against Morrowind-era sources | **Clean.** Admissible/inadmissible are enumerated by *category*, not blanket-banned; every mined fact carries an `era` field; using 2E for a 3E claim requires a recorded justification. It constrains a source, not a system |
| **S21** where the die survives | Deletes Morrowind's dice outside the fight in two of the three places its own text preserves them | **DRIFTED — ND-01.** The ruling is defensible; its application is not |
| **S22** the 60 Hz rebase | Pure correctness | **Clean, and the strongest evidence the corpus's self-checking works.** Every internal ratio was consistent, so it passed every M-script, every trace statistic and every blind pair — and would have shipped combat at double wall-clock speed |
| **S23** equip load | Splits a genuine contradiction by domain | **Clean.** In-fight tiers to RI-CMB01 (Souls' domain), out-of-fight encumbrance to RI-PRG07 with finer granularity permitted *provided it has no in-fight effect* — the boundary drawn at exactly the place §1 draws it |
| **S24** the marsh is not all marsh | Corrects an orchestrator misstatement | **Clean and well-enforced.** 13 regions in `regions.json`; RI-WLD04's blind tests are real instruments with numbers; the ruling names the failure mode ("everything is swamp with a recoloured fog") and binds four critic roles to check it. **One defect:** S24's own prose names twelve regions and `regions.json` holds thirteen — **Thornmarsh** is in the data and not in the ruling |
| **S25** water at the waterline | Denies actions in deep water rather than degrading frames | **Clean.** It keeps AR-1 pristine (no frame number varies with depth) while making water real terrain, caps boss arenas at knee depth, and gives water-native archetypes a domain. Crucially it does **not** delete Morrowind's water: `RI-WLD10` §3 implements the Argonian amphibious package (`breath_max = ∞`), `RI-CHR02` and `RI-LOR07` A3 assert it, and `RI-MAG02` keeps Water Breathing and Water Walking as effects |

**On the orchestrator's own framing.** S24 exists because the world was misdescribed to agents.
Looking for the same class of error elsewhere: the briefs are, on the whole, faithful — the two
that carry a user direction (`weapons.md`, `journeys.md`) quote it **verbatim**, and the rest
derive honestly from `BAR-CRITIQUE-01`'s numbered gaps rather than from invention. The world
figures that agents built on (14.5 km² walkable, parity with Vvardenfell; 8 settlements;
the hour) are traceable to `RI-WLD01`'s measurement of the map source, not to assertion.

The one place the framing has genuinely drifted is **ND-03**, and it is upstream of all of
this: the brief itself was never written down. Every agent since wave 0 has worked from a
paraphrase of a paraphrase. That is precisely the mechanism that produced the "entirely
standing water" misstatement, and it is still in place.

---

# 5. Method audit — `docs/PLAN.md`

The brief's method survives **as doctrine** and fails **as a plan.**

Doctrine is in good order: build the bar first (137 items, `game/` empty); builder and separate
fresh-context critic per piece with the judging items handed over up front; blind comparison
where the artifact allows it; exactly one biggest gap with a void-on-failure rule; an
end-of-wave coherence agent with a remit boundary; and a checkpoint protocol that has visibly
worked — 20 status files, 14 of 16 tasks complete, several resumed by successors.

`docs/PLAN.md` has not moved since before any of that existed.

| Method clause | State |
|---|---|
| Smallest independently judgeable pieces | **Failed.** `:46` `combat.core` is still one piece — stamina, roll i-frames, committed attacks, hitboxes, lock-on — now judged by RI-CMB01–11, RI-CAM04 and RI-CMB07's trace format. One critic, one score, **one gap**, for eleven independently judgeable dimensions; SCORING §2.2 then discards ten of eleven findings |
| Every subsystem path assigned to a piece | **Failed.** Fourteen pieces against 323 paths and 22 roots. `weapon.*` (20), `magic.*` (20), `input.*` (10), `journey.*` (11), `experience.*` (15), `composition.*` (6), `character.*` (10), `stealth.*` (9), `crime.*` (9), `ui.*` (8), `audio.*` (4), `platform.*` (13) — **135 paths, six of the nine later user directions — appear in no piece** |
| Wide before deep; traversable world + completable main quest from an early wave | **Stated at `:21–26`, undeliverable from `:39–56`.** Wave 1 has `quests.main` but no transport, no camera, no input, no save/load and no HUD. A world you cannot save, cross by silt strider, see in third person, or control on the device the user named is not "playable start to finish" |
| Never leave a region or questline missing | Stated; `world.terrain` is one piece covering all 13 S24 regions and their ≥6-of-9-axis differentiation. Unbuildable as scoped |
| The bar critic gates progress (direction 2) | **Absent.** No clause makes Wave 1 conditional on any verdict |
| Loop until all critics pass (direction 9) | Present, `:18–19` |
| Wave 0 headcount | `:5` "Ten agents" — the registry lists sixteen tasks |

`PLAN.md` is not wrong about anything it says. It is silent about most of what the project now
knows, and a plan that is silent about the camera, the movesets, the controls and the saves is
the mechanism by which a corpus that *does* aim at the user's brief produces a build that does
not. This is the one finding that justifies the verdict on its own.

---

# 6. New drifts, ranked

## ND-01 — S21 deletes the die in two of the three places its own text preserves it. **Severity: high. Type: inverted.**

**What the brief says.** Morrowind wins outside the fight, and Souls' claim is admitted only
where *necessary for the combat to feel like Souls*. `ARBITRATION.md:92` S21 accepts this
explicitly: *"S1 bans dice inside the fight, but it says nothing about the world."* It then
names three checks whose failure is permanent and which therefore **keep their roll**:

> *"a persuasion attempt that lowers disposition, **a pickpocket that gets you caught**, **a
> spell that fails and consumes the magicka** — keeps its roll: the uncertainty is real and the
> outcome is a story."*

**What the corpus says.**

- **Pickpocket.** `RI-STL02` §5 opens *"Same ruling, same reasons: **no roll.**"* and closes
  *"no die at any point"*. M7 asserts determinism across 100 seeds. `:362` scores *"a percentage
  chance"* as the **0 band**. Yet its failure is exactly S21's permanent kind: CRIME,
  `fDispPickPocketMod −25`, a 100-gold bounty (`RI-CRM01:51`).
- **Spell failure.** `RI-MAG01` §E.3: *"Morrowind's cast-failure roll is deleted."* Inside the
  fight that is correct and S1 compels it. But `RI-MAG03:79` extends it past the boundary:
  *"There is no spell-failure chance and no cast-failure roll **anywhere in this system**.
  Morrowind had both; both are deleted by S1 and their deletion is a ruling, not an oversight."*
  `RI-MAG03` is spellmaking and enchanting — outside the fight, S19's "MORROWIND,
  emphatically" half. S1's authority has been carried across the seam to delete a system on the
  far side of it.

**Why it matters.** After S21, `RI-DLG04`'s persuasion roll is the **only surviving die in the
entire world model**. `RI-PRG09` A3: *"Never a roll."* `RI-STL01`: deterministic per frame.
`RI-STL02`: deterministic. `RI-MAG01/03`: deterministic. `RI-PRG03`: deterministic gates. The
corpus has one instrument for uncertainty outside the fight, and `RI-STL02:101–103` names the
consequence in its own words while doing it anyway:

> *"Dice are a real texture. Morrowind's world feels uncertain partly because its verbs are …
> a project that subtracts Morrowind's randomness is quietly building Dark Souls with a wider
> stat sheet."*

That is the diagnosis. It is filed as a counter-argument and overruled by an argument about
lockpicking, which S21 then generalised to everything.

**Correction.** Do not reopen the lockpicking ruling — it is well-argued and the ward-collar is
a genuine improvement on 12%-per-attempt. Instead:

1. Amend **S21** to state its scope precisely: *"the deterministic-threshold replacement applies
   only to checks that are **freely and immediately repeatable at no cost**. A check whose
   failure is charged — in gold, in magicka, in disposition, in a bounty, in an item, or in
   time you cannot get back — keeps its roll, and the number of such surviving rolls is a
   property the corpus measures."*
2. Amend **`RI-STL02` §5** to restore a roll on the *caught* branch, or to record explicitly
   why pickpocketing is exempt from S21's own named example. Its suspicion fill during `T` may
   be the right place to put it.
3. Amend **`RI-MAG03:79`** to scope its deletion: *"inside the fight, by S1"*, and to rule
   separately on whether an out-of-fight cast can fail. S19 gives that decision to Morrowind.
4. Add a corpus-level count — the number of surviving permanent-failure rolls, with a floor —
   so "we deterministicised everything one item at a time" is visible to a critic.

**Target files:** `corpus/00-doctrine/ARBITRATION.md` (S21) · `corpus/23-stealth-crime/RI-STL02-theft-locks-fencing.md` · `corpus/25-magic/RI-MAG03-spellmaking-enchanting.md`

---

## ND-02 — The camera, the user's most explicit single subsystem direction, has one subsystem path and no critic. **Severity: high. Type: narrowed.**

**What the brief says.** Direction 1: third person, matching Souls' third-person behaviour **in
all respects**. S18 expands that into eighteen named behaviours and binds them *outside* the
fight too — *"exploration, dialogue, menus and cutscenes are all third-person, because a
perspective that changes at the combat boundary would break the seam"*.

**What the corpus says.** `grep -n camera corpus/00-doctrine/subsystems.json` returns **one
path**: `combat.camera.behaviour` — *"Combat camera framing, collision, and lock-on pivot"* —
plus two legacy aliases pointing at it. Seven reference items, ~200 KB of camera specification,
collapse onto it and onto borrowed paths belonging to combat, ui, render and platform. There is
no `critic.camera` in the `critics` block.

The consequence is not cosmetic. **`RI-CAM05` is titled "camera outside the fight" and its
primary judged path is `combat.camera.behaviour`.** The exploration camera, the dialogue camera
and the menu camera are therefore administered by `critic.combat`, a role whose charter binds it
to run the combat harness, read traces, and apply AR-1 — the check for *Morrowind contaminating
the fight*. The arbitration boundary is inverted inside the taxonomy for the one system the user
singled out. `RI-CAM06` (camera feel) and `RI-CAM07` (third-person character presentation)
similarly have no path of their own; CAM07 is filed entirely under `render.*`, so the user's
"third person in all respects" is judged, in part, by the fidelity critic.

This is also `BAR-CRITIQUE-01`'s **G6**, which asked for a `camera.*` root with ≥6 paths, and
`bar-critique-02` has independently re-found it. Two critics agreeing from different directions
is why it is ranked here rather than deferred.

**Correction.** Append a `camera.*` root to `subsystems.json` (append-only, `arb: souls`) with
one path per S18 behaviour cluster — at minimum `camera.rig.springarm`, `camera.lockon.framing`,
`camera.movement.relative`, `camera.outoffight.behaviour`, `camera.feel.response`,
`camera.character.presentation` — repoint the seven `RI-CAM` items' `judges:` lists, and add
`critic.camera` (or explicitly assign `camera.*` to an existing critic and say which, and why
the out-of-fight paths are not AR-1's business). Regenerate `INDEX.md`.

**Target file:** `corpus/00-doctrine/subsystems.json`

---

## ND-03 — The brief is not written down anywhere, and the file that audit 01 said held it does not exist. **Severity: high. Type: method drift.**

`INTENT-AUDIT-01.md:12` states: *"Source of truth: the user's brief and the four subsequent user
directions, verbatim, as reproduced in `INTENT-AUDIT-CHARTER.md` §2."*

`INTENT-AUDIT-CHARTER.md` **does not exist**, in the working tree or anywhere in git history
(`git log --all --diff-filter=D --name-only | grep -i charter` → empty). The audit that this one
re-runs cited, as its source of truth, a document that was never written. I have re-run it
against the brief as quoted in fragments across `INTENT-AUDIT-01.md`, `ARBITRATION.md`, and the
two briefs that quote a user direction verbatim.

Across fifteen briefs, exactly **two** — `weapons.md:3` and `journeys.md:5` — carry a user
direction in the user's own words. Every other agent has worked from the orchestrator's
restatement. That is not a hypothetical risk: it is the documented cause of S24, where an
orchestrator's "entirely standing water" propagated into agent work until the user corrected it
in person. The mechanism is still fully in place, and it is the highest-leverage thing on this
list to fix because it is thirty minutes of typing.

**Correction.** Write `corpus/00-doctrine/INTENT-AUDIT-CHARTER.md` containing (a) the original
brief **verbatim**, (b) all nine later directions **verbatim, each dated and attributed**, and
(c) the standing rule that a direction may be paraphrased in a brief only alongside its verbatim
text. Make it required reading in `BUILDER-PROMPT-TEMPLATE.md` and `CRITIC-PROMPT-TEMPLATE.md`.
Nothing else in this audit is checkable without it, including this audit.

**Target file:** `corpus/00-doctrine/INTENT-AUDIT-CHARTER.md` (new)

---

## ND-04 — The parley exists as a ruling, has no form, no frames and no owner — and the two available readings sit on opposite sides of an automatic fail. **Severity: medium. Type: dropped.**

S13 as amended requires *"a distinct, fast, diegetic parley interaction (yield / offer gold /
invoke a faction / speak a name you learned) available during combat"*. Audit 01's correction
specified it further: *"an action with startup and recovery that the enemy can punish, **not a
menu**"*. That second sentence did not make it into S13.

The corpus now contains both readings:

- `CRITIC-DOCTRINE.md:234` **A10** automatically fails a piece if *"a topic list opens"* while
  `COMBAT` is active — an AR-1 fail, applied to **every** piece.
- `RI-JRN02:192` **M-I11** requires *"**0** frames with a surface open during `COMBAT` **other
  than the dialogue-locked parley** (seam S13/S14)"*, and `:259` **HF7** hard-fails a surface
  during combat *"outside the S13 parley"*. That is an explicit carve-out permitting parley to
  be a modal surface.

Meanwhile **no reference item gives parley frame data**. `grep -rn parley corpus/10-combat/
corpus/12-weapons/` returns nothing. It has no startup, no recovery, no punish window, no
interrupt rule, no input binding in `RI-JRN03`/`RI-JRN04`'s 14-action set, and **no subsystem
path** — `grep parley corpus/00-doctrine/subsystems.json` is empty, so nothing in `INDEX.md`
routes it to a critic. It is judged only obliquely, as a crossing cell in `RI-CMP01` and a
scored assertion in `RI-CRM01`.

A builder implementing the world's most seam-crossing interaction therefore has to guess, and
one of the two guesses trips an automatic fail on every piece it appears in.

**Correction.** (a) Add audit 01's missing sentence to S13: parley is a committed, animated,
interruptible action with startup and recovery, not a menu, and A10 stands unamended. (b) Give
it a frame row in `RI-WPN04` (contextual attacks) or a new `RI-CMB` section, at `f@60`, with the
enemy's punish window on it. (c) Register `combat.encounter.parley` in `subsystems.json` under
`critic.combat`, and bind it in `RI-JRN03`/`RI-JRN04`'s action set. (d) Add **AR-2 B12** per
gate B1 below, which is what will detect its absence.

**Target files:** `corpus/00-doctrine/ARBITRATION.md` (S13) · `corpus/00-doctrine/subsystems.json` · `corpus/12-weapons/RI-WPN04-contextual-attacks.md`

---

## ND-05 — S16 moves territory to Souls outside the fight without recording the brief's necessity test. **Severity: medium. Type: method drift.**

S16 assigns **8 Souls-loop dungeons** — *"interconnected, multi-strata, shortcut-unlocking,
HEARTH-anchored, closed/open path ratio ≥1.5"* — alongside 82 Morrowind caves. `world.dungeon.design`
is Morrowind's domain under §1's world-structure row. The ruling is a *split by census* and it
guards both directions (a Souls-loop that is merely a long cave fails; a cave inflated into a
shortcut puzzle fails equally), which is why this is ranked fifth and not first.

But S16 is the only seam of the nine that transfers territory to Souls **outside the fight**,
and it does so without writing the sentence that §1 now requires — *is this necessary for the
combat to feel like Souls?* S7's failure was not a bad answer; it was an unasked question. Every
other new seam either defends Morrowind (S17, S19, S20, S24), is user-directed (S18), splits a
real contradiction by domain (S23, S25), or is pure correctness (S22). S16 alone reasons from
"which game does this smell like".

**Correction.** Append to S16 the necessity finding: what specifically about the Souls fight
requires a shortcut-unlocking multi-strata descent, why 8 is the number, and what would be lost
if all 90 were Morrowind caves with good encounters in them. If the honest answer is "nothing
about the *fight* requires it, but the brief asked for a Souls game and this is Souls' single
most recognisable level-design form", **write that** — a recorded design grant is defensible; an
unrecorded one is how S7 happened.

**Target file:** `corpus/00-doctrine/ARBITRATION.md` (S16)

---

## ND-06 — Three legibility defects in the documents every builder reads. **Severity: low.**

1. **S24's prose names twelve regions; `regions.json` holds thirteen.** *Thornmarsh* (1.08 km²)
   is in the data and absent from the ruling. S24 declares the map authoritative and then
   under-lists it.
2. **`corpus/00-doctrine/README.md` still describes `ARBITRATION.md` as holding "Seam rulings
   S1–S15".** There are 25. The README is the first file every agent is told to read.
3. **`ARBITRATION.md` §2's seam table is out of numeric order** — S1–S16, then S21, S22, S23,
   S25, S24, S20, S19, S18, S17. Append-only ordering is correct as a policy but the supreme
   law is now hard to read, and S24 sits after S25.

**Target files:** `corpus/00-doctrine/ARBITRATION.md` · `corpus/00-doctrine/README.md`

---

# 7. Gate condition — what must be true for me to return ALIGNED

Four conditions. Three are single-file edits; the fourth is one agent, one pass. **No new
research, no reopened design argument.** Ranked by what blocks building.

**B1 — Finish ID-01.** `CRITIC-DOCTRINE.md` §4.2 carries **B12 — no exit but death**: *for each
of five encounter classes (ordinary humanoid, faction patrol, animal, quest-critical NPC,
humanoid boss), attempt to end the encounter without a kill using every non-violent verb the
build offers; zero encounter classes exit non-violently → AR-2 fail.* `RI-QST05` carries
`PACIFIST-IN-FIGHT ≥ 15%` — the pacifist fraction re-attempted **after** the encounter has
entered `COMBAT`. S13 gains audit 01's missing sentence (parley is an action, not a menu),
`combat.encounter.parley` is registered in `subsystems.json`, and one item gives it frame data
(**ND-04**). *Symmetry is the point: A10 stops the world leaking into the fight; nothing yet
stops the fight from eating the world.*

**B2 — Close ID-11 and ND-01, three sentences total.** `COHERENCE-AGENT.md:133` C4.3 gains the
scope word: *"**Region** gating is by lethality and knowledge, never by player level (S9).
**Faction and content** gating by rank, skill and attribute thresholds is required (S3, §1) and
is not a level check."* `ARBITRATION.md` S21 gains its scope clause (repeatable-at-no-cost
only). `RI-STL02` §5 and `RI-MAG03:79` are reconciled with S21's own named examples, or record
why they are exempt.

**B3 — Write the charter (ND-03).** `corpus/00-doctrine/INTENT-AUDIT-CHARTER.md` exists,
containing the original brief and all nine later directions **verbatim**, dated and attributed,
and is required reading in both prompt templates. Until it does, no auditor — including me — can
prove what the source of truth says, and the mechanism that produced S24 remains live.

**B4 — Regenerate `docs/PLAN.md` (ID-13, ID-14).** From `subsystems.json` as it now stands:

- **every one of the 323 paths assigned to exactly one piece**, verifiable by script;
- **no piece spanning more than one method script** — `combat.core` decomposes to at least
  `combat.dodge`, `combat.attack.frames`, `combat.stamina`, `combat.hitbox`, `combat.lockon`;
  `quests.engine` and `render.fidelity` likewise;
- **pieces for the six later directions currently unrepresented**: camera, transport, magic,
  weapon movesets, input (desktop + mobile/X2s), persistence — plus UI, audio, character,
  stealth/crime, journeys and experience;
- **the wide-before-deep invariant made deliverable**, not merely stated: whatever Wave 1
  contains must be enough for the world to be crossable, the main quest completable, the game
  savable, controllable on both named platforms, and visible in third person;
- **an explicit gate clause**: *Wave 1 does not start until `BAR-CRITIQUE` returns SUFFICIENT
  **and** `INTENT-AUDIT` returns ALIGNED* — which is user direction 2, and is currently written
  nowhere;
- `:5`'s "Ten agents" corrected against the registry.

**Standing, non-blocking, reported every wave until closed:** `refs/modern/` has 2 of 7 slots
filled and holds no Elden Ring or Skyrim frame, so `RI-VIS02` still claims a blind pair it
cannot form (**ID-15**); 202 legacy aliases await migration and 126 items await their W7
ladder-anchor row (**ID-16**); and `BAR-CRITIQUE-01`'s live verdict is INSUFFICIENT against a
64-item corpus that no longer exists — `bar-critique-02` must land, and must push on the weapon
moveset bar as user direction 4 requires, before B4's gate clause means anything.

---

## Closing note

Audit 01 found that *the corrections stop at the ruling* — S7's sentence was fixed in one file
and wrong in six. This pass shows the project learned that lesson unevenly but genuinely. The
travel repair is a model of it: S7, the §1 domain row, the `subsystems.json` title, the
`RI-PRG04` scoring axis, AR-2 **B13**, COHERENCE **T6**, and two new reference items all moved
together, and the checks were made two-directional so that absence can fail as loudly as excess.
That is what a propagated correction looks like, and it closed four drifts at once.

The ID-01 repair did not do that. The ruling moved, four new items picked it up, and the two
instruments that would *detect its absence* — the AR-2 check and the metric — were not written.
The result is a corpus that permits the right thing and cannot notice the wrong one. And S21,
written after audit 01 and in its spirit, reproduced the original error in a new place: a Souls
principle drawing its own boundary and deleting Morrowind on the far side of it.

Neither is far from fixed. What is far from fixed is `PLAN.md`, and it is the file that turns
all of this into a game. The corpus knows about the camera, the silt striders, the movesets, the
X2s, the thirteen biomes and the save file. The plan does not. **Fix the plan, add the two
missing instruments, write down the brief, and I will return ALIGNED.**

**DRIFTED.** Four gate conditions. I will be back at the end of every wave.
