# INTENT-AUDIT-01 — is the bar aimed at what was actually asked for?

**Auditor:** `critic.intent`, wave 0. **Date:** 2026-08-06.
**Read:** all of `corpus/00-doctrine/` (ARBITRATION S1–S19, CORPUS-CONTRACT, CRITIC-DOCTRINE,
SCORING, VERDICT-SCHEMA, COHERENCE-AGENT, BAR-CRITIQUE-01, INDEX, subsystems.json),
`corpus/95-experience/PLAYTHROUGH-CRITIC.md`, `docs/PLAN.md`, `docs/status.json`, and all 71
reference items across `10-combat`, `15-camera`, `20-progression`, `30-quests`, `40-dialogue`,
`50-world`, `60-lore`, `70-visual`, `80-methods`. Index state at read time:
`200 paths / 71 items / 169 judged / 31 holes / 19 front-matter errors`.

**Source of truth:** the user's brief and the four subsequent user directions, verbatim, as
reproduced in `INTENT-AUDIT-CHARTER.md` §2. Not the doctrine. The doctrine is the defendant.

---

# 1. VERDICT: **DRIFTED**

Seventeen drifts. Five are **inversions** — places where the corpus says the opposite of what
the brief says, in the same way S7 did. Five are **dropped**: an explicit user instruction with
no reference item, no subsystem path, and no critic. Two are **narrowings**, one is an
**over-correction**, four are **method drift**.

The pattern is not random. Every inversion has the same shape as S7:

> A Souls convention was allowed to define the *boundary* of its own authority, and inside
> the boundary it deleted a Morrowind system that the brief put on Morrowind's side.

S7 did it to travel. **S13 and the §1 boundary paragraph do it to talking.** RI-PRG04's
scoring axis does it to transport a second time, from the other end. And S19 now forbids the
exact spells S7 was corrected to require.

The second pattern is quieter and worse in aggregate: **the corrections stop at the ruling.**
S7's text was fixed; the taxonomy entry that implements it (`subsystems.json:1077`), the index
row generated from it (`INDEX.md:206`), the scoring axis that grades it
(`RI-PRG04:255`), the AR-2 detection procedure that polices it (`CRITIC-DOCTRINE:241`), the
coherence probe that verifies it (`COHERENCE-AGENT:88`) and the §1 domain table that summarises
it (`ARBITRATION.md:43`) all still carry the pre-correction meaning. A ruling that is right in
one file and wrong in six is not a corrected ruling; it is a corrected sentence.

---

# 2. The single worst drift

## ID-01 — The fight's boundary is drawn so that hostility deletes the world, and the only sanctioned exit from a fight is killing.

### 2.1 What the brief says

> *Where Morrowind and Souls conflict, Souls wins inside the fight — frames, stamina, hitboxes,
> animation, enemy behaviour, **and anything else that is necessary for the combat to feel like
> Souls**. Morrowind wins everywhere else: progression, faction gating, dialogue, journal, world
> structure, **and anything else**.*

Two "anything else" clauses, pointing in opposite directions. The Souls one is **qualified by
necessity**. The Morrowind one is **unqualified**. The brief therefore does not grant Souls a
territory; it grants Souls a *justification test*, and gives everything that fails that test to
Morrowind. And the brief separately names, in its list of things the bar must measure:
*"how many quests resolve without combat."*

### 2.2 What the corpus says

`ARBITRATION.md:14–16` defines the territory instead:

> "The fight begins at the first frame of hostile intent (an enemy aggro state entering
> `COMBAT`, or the player's first attack input against a valid target) and ends when all
> hostiles within the encounter volume are dead, dormant, or de-aggroed for >5s."

Then `ARBITRATION.md:68`, seam S13:

> "**SOULS.** Enemies shout, they do not converse. Topic lists are locked while `COMBAT` is
> active."

Then `CRITIC-DOCTRINE.md:234`, detection procedure A10:

> "**Talking mid-fight** | Attempt to open a topic list while `COMBAT` is active. | A topic
> list opens. Seam S13."

— filed under AR-1, whose consequence is stated at `ARBITRATION.md:83`: **automatic fail of the
piece, regardless of score.**

Read the three together and this is the operative rule: *an enemy deciding to aggro you
transfers authority over the encounter to Souls, and the transfer is only reversed by that
enemy's death, its dormancy, or its own unilateral loss of interest.* The player has exactly
one verb that ends a fight. The corpus contains no other. `grep -rniE
'de-?escalat|talk.down|calm|yield|surrender|pacify'` across all 71 reference items returns
**zero** hits as a combat exit. There is no bribe-to-stop, no Calm effect, no yield, no
surrender, no "drop the sword and he lowers his", no faction insignia that makes the patrol
stand down after it has already drawn.

### 2.3 Why this is the worst one

**It fails the brief's own necessity test, out loud.** Is locking the topic list during a
greatsword's 22-frame startup necessary for the combat to feel like Souls? Obviously yes — that
is S14's job and it is correct. Is it necessary that a hostile Argonian who has aggroed you
*can never be talked out of it by any means at any point*? No. Nothing about the frames, the
stamina, the hitboxes, the animation or the enemy behaviour changes if the encounter can also
end because you paid him. Souls' authority has expanded from "how the fight works" to "whether
the fight can end any way but one", and that second thing is a **world-structure and quest
resolution** question, which the brief hands to Morrowind twice — once in the domain list
("Non-combat resolution: many quests resolvable by talk, bribe, sneak, theft, or lore
knowledge", `ARBITRATION.md:47`) and once in the measurement list.

**It is the S7 error, exactly.** S7 said: travel is Souls-adjacent, therefore delete Morrowind's
travel. This says: hostility is Souls-adjacent, therefore delete Morrowind's talking. Both were
written by an author reasoning from "which game does this smell like" rather than from "what did
the user put on which side". Both are one clause long. Both sat unread because the sentence
around them is obviously correct.

**It quietly guts the item that the brief named as an example measurement.** `RI-QST05:71`
sets `PACIFIST-ALL ≥ 45%`, hard-fails below 30%, and `RI-QST05:74` sets `VERB-SPREAD ≤ 40%` so
that no single verb carries the pacifist fraction. But with ID-01 in force, every one of those
non-violent resolutions must be reached **before any enemy notices you**. The moment a fight
starts, the quest's non-violent branch is unreachable for the duration and the corpus offers no
way back. The item's own top-listed failure mode (`RI-QST05:111`: *"in practice the failure mode
is speechcraft-solves-everything"*) is not merely likely, it is now the only architecture the
doctrine permits: talk before, or kill. `RI-QST05` is `provenance: derived, confidence: low`
and is the sole judge of the brief's named metric.

**It is the failure mode the doctrine already told us it would die of.** `ARBITRATION.md:89–91`,
AR-3, added *this wave* in response to the bar critic, says: *"Sterility is the failure mode that
no amount of per-subsystem excellence detects, and it is the one this project is most likely to
die of."* Its own worked example of a seam-crossing interaction, at line 90, is: *"A disposition
that opens a door you would otherwise have to fight through."* `BAR-CRITIQUE-01:246` names the
same thing: *"talking a hostile Ordinator down."* AR-3 asks for boundary crossings and S13
criminalises the most Morrowind-shaped one there is. The corpus wrote the antidote and the
poison in the same file, four days apart, and did not notice.

**It is enforced by the strongest instrument available.** A10 is not a scoring axis; it is an
automatic fail applied to *every* piece (`CRITIC-DOCTRINE.md:213`: *"Both checks run on **every**
piece"*). A builder who ships a Calm spell, a yield gesture, or a "throw him a purse" interaction
does not lose points — the whole piece fails, and the next builder learns not to try. This is
active suppression, not an omission, and it will compound with every wave.

### 2.4 The correction required

Amend `ARBITRATION.md` §1 and S13 by append, and amend `CRITIC-DOCTRINE.md` A10. Specifically:

1. **Split the boundary in two.** "Inside the fight" governs *frame-level resolution* — what
   happens between an input and a hitbox. It does **not** govern *whether the encounter
   continues*. Add to §1: "Souls' authority inside the fight is over the **conduct** of the
   fight. Morrowind retains authority over its **terms of entry and exit**: who becomes
   hostile, why, and what other than death can end it."
2. **Restate S13 to what it is actually protecting.** Correct version: *"**SOULS** for the
   conversation model — there is no topic list, no dialogue camera, no pause, and no menu while
   `COMBAT` is active; enemies shout. **MORROWIND** for the existence of a non-violent exit: at
   least one committed, animated, interruptible, Souls-frame-legal in-fight action must be able
   to end an encounter without a death — a yield, a bribe offered in the open, a faction token
   shown, a Calm effect cast under S19's frame rules. It is an action with startup and recovery
   that the enemy can punish, not a menu."* That satisfies both games: the *fight* remains
   Souls (committed action, no pause, no dice), and the *world* remains Morrowind (disposition,
   gold and faction rank change what a fight is).
3. **Rewrite A10's tell.** Current tell — "a topic list opens" — is right. Add the counterpart
   check to AR-2 §4.2: **B12 — no exit but death.** *Procedure: for each of five encounter
   classes (ordinary humanoid, faction patrol, animal, quest-critical NPC, boss), attempt to end
   the encounter without a kill using every non-violent verb the build offers. Tell: zero
   encounter classes exit non-violently → AR-2 fail.* Symmetry is the point: A10 stops the world
   leaking into the fight; nothing currently stops the fight from eating the world.
4. **Make `RI-QST05` depend on it.** Add to its Comparison method: PACIFIST-ALL resolutions must
   be re-attempted **after** the encounter has entered `COMBAT`; the fraction reachable
   post-aggro is reported as `PACIFIST-IN-FIGHT` with a floor of 15%. Below that, the pacifist
   fraction is a pre-combat dialogue tree wearing a hat.

---

# 3. Ranked table of every drift found

Severity: **critical** = the shipped game is not the thing that was asked for; **high** = a named
user instruction is unbuildable or unjudgeable as the corpus stands; **medium** = a bar will
push work in the wrong direction. `†` = also found by `BAR-CRITIQUE-01`; listed here because the
brief clause remains uncovered, not as a new discovery.

| # | id | What the brief says | What the corpus says | Type | Sev | Correction required |
|---|---|---|---|---|---|---|
| 1 | **ID-01** | Souls wins inside the fight only where "necessary for the combat to feel like Souls"; Morrowind owns non-combat resolution and "how many quests resolve without combat" is a named measurement | `ARBITRATION.md:14–16` gives Souls everything from first aggro until death/dormancy/de-aggro; `:68` S13 locks all dialogue; `CRITIC-DOCTRINE.md:234` A10 makes any in-fight talk an automatic fail. Zero non-violent combat exits exist anywhere in 71 items | inverted | critical | §2.4: split conduct from terms-of-exit; restate S13; add AR-2 **B12 (no exit but death)**; add `PACIFIST-IN-FIGHT ≥ 15%` to RI-QST05 |
| 2 | **ID-02** | Fast travel must exist, Morrowind-style — silt striders, boats, guild guides, Mark/Recall, Intervention | S7 (`ARBITRATION.md:62`) now mandates the network, but **no reference item owns it**. `world.traversal.transport` is judged by RI-PRG05 (gold prices), RI-LOR02 (politics) and RI-LOR05 (religion) — none specifies routes, nodes, fares-vs-time, guild-guide rank gating, Mark/Recall, or Intervention. `subsystems.json:1077` still titles the path *"In-fiction transport network only; no warp-to-pin"* | dropped | critical | Write **RI-WLD10 — the transport network**: node/route graph over the 8 named settlements + 16 minor, ≥3 modalities, per-route gold fare and in-world time, faction-gated guild-guide tier, the two spell modes under S19, walked-there-once precondition, station-not-objective arrival rule. Thresholds: ≥ 4 modalities, ≥ 18 routes, every named settlement on ≥ 1 route, longest station-to-station walk ≤ 9 min, **hard fail** if any route lands the player anywhere but a station. Retitle `subsystems.json:1077` |
| 3 | **ID-03** | Mark/Recall and Intervention are required (user direction; S7) | `ARBITRATION.md:72` S19: *"utility magic may not become a teleport network (S7)"* — while `:62` S7 requires *"the spell-side pair (Mark/Recall, plus an Intervention-style … effect) **governed by S19**"*. S19 forbids what S7 delegates to it | inverted | high | Amend S19's constraint to: *"utility magic may not produce arbitrary-destination teleport; the S7-sanctioned fixed-anchor spells (one player-set mark, one shrine-return) are the permitted and required exception, priced in magicka and gold and unavailable during `COMBAT`."* |
| 4 | **ID-04** | "Each weapon must have subtly unique attack patterns and animations — light, heavy, combos, roll-attack, backstep-attack — with a dedicated bar and a dedicated harsh critic" | `combat.weapon.identity` is a **HOLE** (`INDEX.md:88`, `subsystems.json:426`). There is no dedicated bar and no dedicated critic role. `RI-CMB02:78–80` gives rolling/running/jump attacks **one shared multiplier row applied to all seven classes** — the direct negation of "subtly unique per weapon". **"Backstep-attack" appears nowhere in the corpus**, and the player backstep exists only as a CMB01 state | dropped | critical | Write **RI-CMB10 — the per-weapon moveset contract**: per class × per verb (R1 1/2/3, R2, charged R2, two-hand variants, rolling, running, backstep, jump) full frame rows — no shared multiplier rows — plus per-verb root Δ, arc shape and clip id. Add `critic.moveset` to `subsystems.json.critics`. Blind test: three unlabelled 20 s traces from three classes → judge describes three different fighting styles. **Hard fail** if any verb's frame data is derived by multiplier rather than authored per class, or if backstep-attack is absent |
| 5 | **ID-06** | "End-to-end user-journey testing by a fan of harsh critics" | `PLAYTHROUGH-CRITIC.md` is on disk and marked **binding**, and depends on `RI-EXP01…RI-EXP06` (`:93`) — **none of which exist**. `experience.*` is absent from `subsystems.json`; `critic.experience` is absent from its `critics` block. The charter currently judges zero subsystem paths and is invisible to `corpus-index.mjs` and to `status.json` | dropped | critical | Add the `experience.*` root and `critic.experience` to `subsystems.json`; write RI-EXP01/02/04 at minimum to CORPUS-CONTRACT §2 (BAR-CRITIQUE-01 §2.3 sketches them to spec). Note the brief says *a fan of* critics, plural — the role must be spawnable as N parallel journey critics with different starting intents, not one |
| 6 | **ID-05** | Controls "intuitive and working on desktop **and on mobile with an attached controller** (specifically a GameSir X2s Type-C telescopic gamepad)" | **Zero occurrences** of `mobile`, `gamepad` (outside HARNESS.md's "listeners are disabled"), `touch`, `GameSir` or `telescopic` in the entire corpus. `platform.input.pipeline` is judged by RI-CAM02 (camera deadzones) and RI-MTH01 (harness API). `platform.perf.*` are holes† | dropped | high | Write **RI-PLT02 — the control contract on two platforms**: full action↔binding matrix for keyboard+mouse and for a standard Gamepad-API layout; the X2s named as the reference device with its axis/button map recorded; portrait/landscape viewport handling; input-to-photon latency budget per platform; a mobile-viewport headless probe. **Hard fail:** any action reachable on desktop and unreachable on gamepad, or a control surface that assumes a mouse cursor |
| 7 | **ID-08** | The new-game flow "judged against Morrowind's famously good opening" | No reference item encodes Morrowind's opening. RI-EXP01 is sketched in `BAR-CRITIQUE-01:123–157` and was never written. `character.*` does not exist† , so the census-office/questionnaire half of that opening has no home either | dropped | high | Write **RI-EXP01** as sketched (beat sheets for Seyda Neen 0–60 and Asylum/Firelink 0–60, with `T-choice`, `T-found`, `T-death`, `V-taught`, `N-odd`, `N-persons`), and **RI-CHR01** for origin/race/birthsign |
| 8 | **ID-17** | Travel is a world system that must exist | Every travel-related check in the corpus is **one-directional**: `CRITIC-DOCTRINE.md:241` B2 tests that a rest point offers no destinations; `COHERENCE-AGENT.md:88` T6 verifies *"rest → … and **no** teleport network"*; `:48` T1 says "on foot, using only in-fiction transport". **Nothing anywhere asserts the transport network exists, is reachable, is priced, or works.** A build that shipped no transport at all would pass every travel check in the corpus | inverted | high | Add AR-2 **B13**: *from three settlements, board each transport modality, pay in gold, arrive at a station, and verify elapsed in-world time and that the destination was previously visited. Tell: no modality boards → AR-2 fail.* Add to COHERENCE T6: "transport → gold spent → time advanced → arrival at a station, verified once per modality" |
| 9 | **ID-13** | "Break the goal into the smallest pieces that can be built and judged independently"; waves go wide before deep; never leave a region or questline missing | `docs/PLAN.md` predates seams S16–S19, the entire `15-camera` area, `95-experience`, and BAR-CRITIQUE-01. Its 14-piece Wave 1 list (`:43–56`) contains **no piece** for the camera (the user's most explicit single instruction), transport, magic, weapon movesets, UI/HUD, save/load, input, or audio. `:5` still describes wave 0 as "ten agents". Nothing in it encodes the bar critic as a gate, and `BAR-CRITIQUE-01` currently reads **INSUFFICIENT** | method-drift | critical | Regenerate PLAN.md from `subsystems.json` after the holes close: one piece per *coherent cluster of subsystem paths*, every path assigned, and an explicit gate — "Wave 1 does not start until BAR-CRITIQUE returns SUFFICIENT and INTENT-AUDIT returns ALIGNED" |
| 10 | **ID-12** | "Systems depth"; the world must be one place, not a pile of separately won arguments | `ARBITRATION.md:91` makes AR-3's tolerance *"governed by the project-level floor in `RI-CMP01` (cross-system payoff matrix)"* — **`RI-CMP01` does not exist anywhere in the tree.** Seam sterility is therefore reportable and ungoverned: a critic sets `seam_sterile: true` and no threshold consumes it† | method-drift | high | Write **RI-CMP01** to the numbers BAR-CRITIQUE-01 §3 rank 2 already specifies (≥35% of system pairs non-`none`; ≥8 boundary-crossing cells; hard fail below 4), and make ID-01's non-violent exit one of the required crossing cells |
| 11 | **ID-15** | "The critics should **pick current-generation reference shots** (Elden Ring, Skyrim) and judge fidelity against those"; "find or construct a reference artifact a later agent can hold its own work against and lose to" | `RI-VIS02` is `kind: image`, `blind_pair: yes`, and contains **no images**. All eight REF-M entries are `FETCH: spec only` or "image bytes not retrieved". `corpus/` contains exactly one image file — the Black Marsh map. The fidelity blind pack required by `CRITIC-DOCTRINE.md §5` cannot be built at all | narrowed | high | Either fetch/store the eight reference frames (or licence-safe equivalents) under `corpus/70-visual/refs/`, or re-declare RI-VIS02 `blind_pair: no` and promote `RI-VIS03`'s twelve numeric metrics to the sole fidelity instrument — and say so in the item, so nobody plans a blind comparison that cannot happen |
| 12 | **ID-07** | "save/load correctness" is a named acceptance test | `platform.save.persistence` is judged by `RI-MTH01` (harness API surface) and `RI-MTH02` (determinism). Both are *methods* documents. There is no bar for what must survive a save/load: quest stage, journal, faction rank and expulsion, disposition, world flags, dropped items, corpse-run bloodstain, transport routes unlocked, respawn state | narrowed | high | Write **RI-PLT03 — the persistence contract**: an enumerated state manifest with an owner per field, a save→quit→load→diff probe over a 30-minute session, and a corruption/version-skew case. **Hard fail:** any field in the manifest that does not round-trip, or a save taken mid-`COMBAT` that restores in a different combat state |
| 13 | **ID-16** | "Organised so that **every** piece of the game maps to the specific reference items that judge it, with the comparison method written down for each" | `node tools/corpus-index.mjs`: **31 holes, 19 front-matter errors, 206 legacy aliases in use.** All four of `RI-CMB08`'s `judges:` paths are unresolvable, so the 3,155-word healing item is invisible to the index and will not be handed to the critic who judges healing. `RI-WLD08` — the liveness item that carries "as dense, alive and strange as Vvardenfell" — has 5 of 7 paths dead. The map the brief asked for is 169/200 complete and misroutes at least three items† | method-drift | high | Fix the 19 front-matter errors before any wave starts; make `corpus-index.mjs --check` a blocking gate; migrate the 206 legacy aliases; re-run and re-publish the hole count honestly |
| 14 | **ID-09** | S7 requires an in-fiction transport network | `RI-PRG04:255` scores the S7 axis: **10 = "no warp code path exists"**, 6 = "warp only in in-fiction transport". The top score is awarded for the *absence* of the system S7 mandates. `:215` greps `game/src/` for `warp\|teleport\|fast_?travel\|travelTo` and asserts every hit is inside the transport module — correct — but the scale above it rewards zero hits | inverted | medium | Rewrite the axis: 10 = "warp exists **only** inside the transport module and the HEARTH menu exposes no destination list"; 0 = "a HEARTH offers destinations **or** no transport module exists". Absence must not out-score correctness |
| 15 | **ID-10** | Morrowind owns world structure, and Morrowind has fast travel | `ARBITRATION.md:43`, the §1 domain table that most agents read *instead of* the seam list, still reads: "World structure … walk-and-navigate wayfinding, **no fast travel except in-fiction transport**". That is the pre-correction framing — a prohibition with an exception, where S7 now states a requirement | inverted | medium | Replace with: "hand-placed density, named interiors, walk-and-navigate wayfinding, **and a diegetic paid transport network (S7)**" |
| 16 | **ID-11** | Morrowind owns faction gating: "rank requirements, **skill+attribute thresholds**, faction rivalry locks, expulsion" (`ARBITRATION.md:39`); Souls owns the difficulty curve | `ARBITRATION.md:64` S9 says regions are gated "by lethality, not level-scaling", and `COHERENCE-AGENT.md:127` C4.3 generalises it to *"Gating is by lethality and knowledge, **never by level checks** (seam S9)"* — which, read literally, forbids the attribute/skill thresholds that §1 and S3 require. A coherence agent applying C4.3 would file a finding against a correct Morrowind faction gate | over-corrected | medium | Restate C4.3: *"**Region** gating is by lethality and knowledge, never by player level. **Faction and content** gating by rank, skill and attribute thresholds is required (S3, §1) and is not a level check."* S9 stays as written but gains the scope word "region" |
| 17 | **ID-14** | "Break the goal into the **smallest** pieces that can be built and judged independently. For each piece, fan out a builder subagent and a separate critic subagent" | `PLAN.md:47` makes `combat.core` one piece — "stamina, roll i-frames, committed attacks, hitboxes, lock-on" — judged by eight separate reference items (CMB01–CMB07, CAM04) with eight separate method scripts. One critic, one score, **one gap** for eight independently-judgeable dimensions. SCORING §2.2's "exactly one gap" discipline then discards seven-eighths of what that critic found | method-drift | medium | Decompose to one piece per *item cluster that shares a method script*. `combat.core` becomes at least: `combat.dodge`, `combat.attack.frames`, `combat.stamina`, `combat.hitbox`, `combat.lockon`. Same for `quests.engine` and `render.fidelity` |

**Counts by type:** inverted **5** (ID-01, ID-03, ID-17, ID-09, ID-10) · dropped **5** (ID-02,
ID-04, ID-06, ID-05, ID-08) · narrowed **2** (ID-15, ID-07) · over-corrected **1** (ID-11) ·
method-drift **4** (ID-13, ID-12, ID-16, ID-14). **Total 17.**

---

# 4. Clauses of the brief with zero coverage

A clause is "zero coverage" when no reference item's `judges:` list and no seam ruling makes it
checkable. `†` = the bar critic already opened this; it remains open, so the brief clause remains
uncovered.

| Brief clause (verbatim or close) | State |
|---|---|
| "on mobile with an attached controller … GameSir X2s Type-C telescopic gamepad" | **Zero.** No item, no path, no critic, no mention anywhere in `corpus/`. The only occurrence of "gamepad" is `HARNESS.md:80` disabling it |
| "each weapon must have subtly unique attack patterns and animations … backstep-attack … a dedicated bar and a dedicated harsh critic" | **Zero for the dedicated bar and critic.** `combat.weapon.identity` is a hole; "backstep-attack" appears in no file |
| "save/load correctness" | **Zero as a bar.** Two methods items are listed as its judges |
| Morrowind's transport network as a *built system* (silt striders, boats, guild guides, Mark/Recall, Intervention) | **Zero.** S7 mandates it; no item specifies or measures it |
| "the new-game flow judged against Morrowind's famously good opening" | **Zero.** RI-EXP01 sketched, never written |
| "a fan of harsh critics" doing end-to-end user-journey testing | **Charter only.** `PLAYTHROUGH-CRITIC.md` exists; `experience.*`, `critic.experience` and RI-EXP01–06 do not |
| "systems depth" as a measurable property | **Zero.** `RI-CMP01`, the item AR-3 names as its own governing floor, does not exist† |
| Magic as a Morrowind system — spellmaking, enchanting, utility effects | **Ruling only.** S19 exists; RI-MAG01–03 do not; `combat.magic.casting` is still a hole† |
| Stealth, theft, crime, justice — two of RI-QST05's five load-bearing verbs | **Zero.** No `stealth.*` or `crime.*` path; RI-QST05's pacifist floor is unreachable without them† |
| Character creation, race, birthsign — the Argonian premise of the setting | **Zero.** No `character.*` root† |
| Hit impact, hitstop, and **all** combat audio | **Zero.** `combat.feedback.hitstop` is mapped to RI-MTH03, a blind-comparison *protocol*; three of four audio paths are holes† |
| Browser frame and memory budget | **Zero**, while `CRITIC-DOCTRINE.md:145` bans "good for a browser game" as a defence unless a `platform.*` item sets the budget† |

**Clauses with real, executable coverage** — stated so the ledger is honest, not to pad: the
hour-to-cross (`RI-WLD01` + S17, and S17 correctly forbids buying the hour with slow walking);
bonfires (`RI-PRG04`, thorough); souls-are-levelling-only and gold-is-the-currency (S15 +
`RI-PRG01/05/06`, with an explicit assert that zero price fields are denominated in souls);
density per minute of travel (`RI-WLD02`, modulo the unresolved 2.0 vs 3.4 m/s unit collision);
words of unique dialogue per settlement (`RI-DLG02`); quests that resolve without combat
(`RI-QST05` — but see ID-01); faction escalation, deceit and gating (`RI-QST01/02/03`); the
topic list as a graph (`RI-DLG01`); journal entries as written (`RI-DLG05`); a minute of Souls
combat as inputs and states (`RI-CMB07`, with a hand-authored 59-second exemplar); strangeness
(`RI-WLD05`); side-quest volume and texture (`RI-QST07`, ≥5.5×N); third-person camera (seven
`RI-CAM` items against S18's eighteen clauses); and the fidelity/art-direction bifurcation,
which is enforced harder than the brief asked for — `CRITIC-DOCTRINE.md §6` voids a verdict for
citing the wrong side. Every measurement the brief named as an example is present. The failures
are in what the brief named *without* giving an example measurement.

---

# 5. Gate condition — what must be true for me to return ALIGNED

Checkable, in the order a wave should close them.

**A1.** `ARBITRATION.md` carries the ID-01 amendment: the conduct/terms-of-exit split in §1, the
restated S13, and AR-2 **B12 (no exit but death)** in §3. `RI-QST05` carries
`PACIFIST-IN-FIGHT ≥ 15%`. At least one non-violent in-fight exit is buildable without
triggering an automatic fail.

**A2.** The S7 correction has been propagated to every file that implements it: a written
**RI-WLD10** owning `world.traversal.transport`; `subsystems.json:1077` retitled;
`ARBITRATION.md:43` reworded; `RI-PRG04:255`'s S7 axis inverted; AR-2 **B13** added;
`COHERENCE-AGENT` T6 extended. `grep -rn "no fast travel"` over `corpus/` returns nothing but
the struck-through text inside S7 itself.

**A3.** S19's teleport clause no longer contradicts S7 (ID-03).

**A4.** **RI-CMB10** exists with per-class authored frame rows for every player verb including
the backstep-attack, no shared multiplier rows, and a blind three-trace weapon-identity test;
`critic.moveset` is in `subsystems.json.critics`; `combat.weapon.identity` is no longer a hole.

**A5.** **RI-PLT02** (desktop + mobile + GameSir X2s control contract) and **RI-PLT03**
(persistence contract) exist and are assigned to `critic.platform`.

**A6.** `experience.*` and `critic.experience` exist in `subsystems.json`; **RI-EXP01** (the
first hour, against Morrowind's opening) is written; the user-journey role is specified as
spawnable in parallel with differing starting intents.

**A7.** **RI-CMP01** exists, so AR-3 has the floor it already claims to have, and one of its
required boundary-crossing cells is the A1 non-violent exit.

**A8.** `docs/PLAN.md` has been regenerated against the current taxonomy: every subsystem path
assigned to exactly one piece, no piece spanning more than one method script, pieces for camera,
transport, magic, movesets, UI, input, audio and persistence, and an explicit gate that Wave 1
does not start until BAR-CRITIQUE-01 returns SUFFICIENT **and** INTENT-AUDIT returns ALIGNED.

**A9.** `node tools/corpus-index.mjs` reports **0 errors**. ID-11's C4.3 rewording is in.
`RI-VIS02` either has images on disk or has stopped claiming `blind_pair: yes`.

**A10.** The zero-coverage table in §4 has no uncovered clause left that originates in a
**direct user instruction** (transport, movesets, mobile/controller, save/load, opening flow,
user-journey critics). Clauses inherited from BAR-CRITIQUE's gate (magic, stealth, character
creation, audio, platform budget) may remain open under *that* critic's authority without
blocking mine — but I will report them every wave until they close.

---

## Closing note

The S7 error was not a typo. It was a *reasoning* error with a specific shape: an agent asked
"does this feel like Souls or like Morrowind?" and then acted on the answer, when the brief had
already assigned the domain and only asked whether Souls' claim was *necessary*. Wherever that
question was asked in that order, the same error appears. I found five instances. The one in §2
is worse than S7 was, because S7 removed a convenience and this one removes the player's ability
to change the world's mind about them — which, in a Morrowind, is most of the game.

**DRIFTED.** Ten gate conditions above. I will be back at the end of every wave.
