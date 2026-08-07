# TOOL-COVERAGE-R2 — the tool critic's verdict on round 2

> `TOOL-LOOP.md` rule 3. A separate critic with fresh context. **I did not write any of these
> tools and I am not defending them.** My predecessor's standard is my standard: a self-test
> written by the same hand as the tool proves the arithmetic its author was thinking about.
> Every falsification below was constructed by me and is reproducible from the description given.
>
> **Verdict: NOT SATISFIED.** Eight instruments must be rebuilt — including one the round-1
> critic accepted as *"the best of the twelve"*, which I broke in four minutes.

| | |
|---|---|
| Rebuild | **8** — `build-viability`, `lib/absence` (+ its 12 reporters), `perf-run`, `decoupling`, `cadence`, `competence`, `gamepad-shim`, **`session-run`** |
| Accept | 7 — `journey-run` (repaired, re-verified), `journey/beat-extract`, `mw-open-beats.json`, `experience/{beat-extract, beat-diff, isolation-check, log-lint}` |
| Worst instrument still standing | **`tools/analysis/build-viability.mjs`**, for the second round running |
| C8 now | **26**, all 26 genuinely absent (verified below) |
| Harness state | `node tools/harness/boot-check.mjs` **PASS** before every measurement. The engine constructs and the harness answers. |

**What round 2 got right, and it is a lot.** Four of the five R1 rejections are materially
repaired: `gamepad-shim` runs (8/8, was 3/3 crash), `journey-run`'s `--sample-quests`/`--stratified`
do real work and the leg reports `unmeasurable` instead of `ok`, `cadence`'s exclusion list is
derived from the shipped action set and throws on drift, `competence`'s gear clause has three
distinct states and two of them block. The C8 regex fix R1 ordered was applied. The twelve
absence-reporters exist and boot the game. None of that is in dispute and none of it is undone by
what follows.

**The pattern across the eight failures is one failure, and it is R1's failure inverted.** R1 found
five tools that *substituted permissively and passed*. Round 2 fixed the permissiveness by
substituting **restrictively and refusing**. A refusal is only honest if the reason is true; three
of the eight refuse a measurement the running build answers determinately, and one of those
converts a build failure into `corpus_debt`. **Refusing everything is not the opposite of passing
everything. It is the same instrument, pointed the other way.**

---

## 1. `tools/analysis/build-viability.mjs` — REBUILD. Still the worst.

It returns **0/540 viable, 540 `unmeasurable`, exit 20**. I was asked whether that is the right
answer. **The stated reason is true. The conclusion drawn from it is false, and the tool's flagship
falsification demonstrates a capability that would produce false reds against the shipping build.**

### The reason is true — verified in the running world, not from source

The builder's central claim is that the quest-offer path is race-invariant. I did not take it on a
source read. I booted the game and drove six character signatures through `__HARNESS.questOffers()`,
resetting between each:

```
dunmer/lukiul  dunmer/foreign-born  saxhleel/interior  saxhleel/lukiul
imperial/blackrose  nord/foreign-born
```

All six produced a **byte-identical** disposition-clause set — the same nine quests, the same nine
numbers, `disposition 0/25 … 0/50` — and the same offerable count. The census is also right:
`0 of 40` givers with a `disposition_min` resolve to a reaction group.

**So yes: the quest-offer path is genuinely race-invariant in the running build.** That much is
established, and it is the most valuable thing this round produced.

### But the tool does not model the build's offer gate. It models one the build does not have.

`questClearableInner()` computes a derived ceiling and then hands it to the shipping predicate:

```js
const ceiling = dispositionCeiling(g.base, sheet.race, sheet.upbringing, sheet.birthsign, g.group);
if (ceiling < q.giver.disposition_min) return { status: FAIL, … };
ctx.dispositions = { [q.giver.npc_id]: ceiling };     // ← the fabricated input
const offer = canOffer(q, ctx, gates);
```

The tool's headline claim is that it imports the shipping predicates so *"it is wrong exactly when
the game is wrong."* It does import `canOffer`. It **fabricates the one input the whole item turns
on.** The shipping build builds that map in `Engine.seedDispositions()` (`game/src/engine.js:4563`):

```js
q.dispositions[rec.id] = rec.disposition;      // raw. no group, no race, no upbringing.
```

`derivedDisposition()` is never applied to the quest path — not in `canOffer`, not in
`canResolve`, not in `QuestEngine._dispositionToward()`. In the whole of `game/src` the character
reaction matrix reaches the world through exactly two consumers: `Engine.npcDisposition()` (a
read-only surface) and `character/encounter.js openingFor()` (encounter hostility). Neither is a
quest gate.

### The flagship falsification, re-run against the engine

The builder's independent falsification #1 mints an NPC record for `speaker-teel-ashaan` with
`reaction_group: RG-DEEP, disposition: 50` and reports the tool going red on 36 dunmer signatures at
`Q-DEEP-01` — *"race term -40 + upbringing -16 puts the ceiling at 34"*, exactly `RI-MTH06` §A's
worked example. I reproduced it on a shadow tree, and then **booted the engine on the same patched
tree**:

| | dunmer/lukiul | dunmer/blackrose | dunmer/foreign-born | dunmer/interior | saxhleel/interior |
|---|---|---|---|---|---|
| **tool** on patched data | FAIL (ceiling 34) | FAIL (ceiling 44) | FAIL | pass | pass |
| **engine** on the same tree | no disposition clause | no disposition clause | no disposition clause | no disposition clause | no disposition clause |

The engine's `why` list for `Q-DEEP-01` is identical for all five — two unlearned topics and a rank
gate — because `seedDispositions()` writes `50`, `canOffer` reads `50`, and `50 >= 50`. **The tool's
flagship falsification is a demonstration that it can go red on a mechanism the build does not
implement.** That is R1's defect inverted and it is not better: R1 bought a false pass, this buys a
false red the moment anyone acts on the builder's own recommended fix.

### And the refusal hides a real build failure

Nine quest givers carry a `disposition_min` and have no NPC record at all. In the running build
that means `num(undefined) === 0`: a hard, race-invariant, **unpassable** gate on nine quests, for
every one of the 540 signatures. I observed exactly that — nine `disposition 0/N` clauses, identical
across six signatures.

The tool calls those quests `unmeasurable`. The correct verdict on the shipping build is **FAIL**.
The difference is not cosmetic: `unmeasurable` routes to `corpus_debt` and charges nobody, `fail`
charges the build. **The refusal converts a live build defect into corpus debt.** That is precisely
"a way to refuse that is easier than measuring".

### Rebuild

- Build `ctx.dispositions` the way `Engine.seedDispositions()` does — raw from the record — so the
  criterion answers the question the shipping build answers. Report the result: on today's data it
  is **FAIL for all 540** at nine givers, which is informative and damning.
- Report the race-distinctness finding **separately and by name**: "the reaction matrix does not
  reach the quest-offer path; `RI-CHR01` Distinctness is not measurable *because the build does not
  implement it*", not "the data is missing a field".
- Keep the derived-ceiling walk if you like, but label it a **counterfactual** — what the gate
  *would* do if the matrix were wired in — and never let it produce the primary verdict.
- Minor: `--signatures` is advertised in the usage block and in `RI-MTH06` §A's own contract line,
  and `args['signatures']` is never read. Harmless (the default is the same walk) but it is the
  `--verify` shape. `--signature`, `--explain`, `--fixture`, `--data-root`, `--out`, `--target`,
  `--levels`, `--quiet` all work; `--data-root` in particular is a good handle and I used it.

**Consequence for scoring, unchanged from R1:** `RI-CHR01` Distinctness and `RI-CHR03` Decidability
must not be scored from this run. They are `corpus_debt` — but the debt is owed by
**`game/src`**, not by `game/data`.

---

## 2. `tools/lib/absence.mjs` + its twelve reporters — REBUILD (the library)

The builder found two real bugs in this library by pointing it at an implemented system, and said
so. That was the right instinct and it is why I looked for more. **There are two more, and both are
demonstrated.**

### Bug 3 — `needs` is a list of guesses the library never validates

`surfaceSaysAbsent` is an OR over "is any name in `spec.needs` missing from the harness". Nothing
anywhere checks that a name in `needs` is a method the build would ever have. I enumerated the
322-method harness surface against all twelve specs:

| reporters | what `surfaceSaysAbsent` actually rests on |
|---|---|
| `perf-run`, `hitch-census`, `load-run`, `decoupling` | `getPerfStats()._unmeasurable` / `getLoadState()._unmeasurable` — **live, a real signal** |
| `heap-walk`, `leak-run`, `stream-audit`, `asset-budget`, `audio-sync`, `audio-budget`, `music-coverage`, `audio-pack` | **every single name in `needs` is absent** — `getHeapSnapshot`, `gc`, `getHeapStats`, `getStreamingState`, `getResidentAssets`, `getResourceRegistry`, `getAssetManifest`, `getAudioStats`, `getAudioLog`, `audioState`, `musicState`, `getMusicLog`, `recordAudio`. None exists. None was ever checked against anything. |

For those **eight of twelve**, the term is a **constant `true`** and cannot fail. The library's own
header promises they "stop being true the moment the system ships". They do not. They stop being
true only if a future author happens to name their methods exactly as this builder guessed. The
`EXIT 21 ARRIVED` fuse — the entire reason these files are defensible rather than notes — is
**unreachable by construction** for two thirds of them.

Falsified directly. I pointed `reportAbsence()` at a system that is demonstrably running (I drove
69 quests through `questOffers()`/`questBook()` in this same pass) and added **one** invented method
name of the kind eight reporters are built on:

```
system 'a quest runtime', needs ['questOffers', 'questBook', 'getQuestLedger']
  -> ABSENT, exit 20
  -> "…the harness methods the real instrument needs are absent: getQuestLedger"
```

### Bug 4 — the substring→prefix fix over-corrected, and now lies the other way

Bug 1 was a substring match reporting ABSENT while quoting a sentence saying the capability landed.
The fix was a **prefix** match. But the build packs three separate absent systems into one entry:

```
what: "heap/GC access (A-JRN9), dialogue state (A-JRN13), resource registry (A-JRN14).
       A-JRN2 (gamepad) and A-JRN4 … landed with W1-08/W1-29 …"
```

A reporter for `dialogue state` or `resource registry` — both genuinely absent, both named right
there — gets `buildSaysAbsent = false`, because they are not at the start of the string.
Demonstrated:

```
system 'dialogue state', needs ['getUIState','getRenderedText']  (both present)
  -> ARRIVED, exit 21
  -> "dialogue state APPEARS TO EXIST NOW: the build no longer declares it under
      not_implemented … REPLACE IT with a real one"
```

**Exit 21 is the "go delete this file" code.** Bug 1 said ABSENT while quoting "it landed"; bug 4
says ARRIVED while quoting "it is not implemented". Neither matcher reads that entry as the list it
is. Control confirmed: `system 'gamepad'` with real method names still returns ARRIVED / 21
correctly, so the builder's own falsification still holds — it just did not generalise.

### Rebuild

- Validate `needs` at startup against the live harness surface *and* against a declared source
  (the amendment id, `HARNESS.md`), and refuse to run — non-zero, loudly — when a required name
  matches nothing and is not traceable to a named amendment. An unvalidated `needs` entry is
  `cmb-reach --verify` with a longer fuse.
- Match the `not_implemented` entry as a **list of systems**, not as a string. Split on the
  build's own separators, or have `getCapabilityReport()` emit one entry per system — the second
  is better and is a harness change worth asking for.
- Fail closed on ambiguity: `ARRIVED` should require positive evidence that the system works, not
  merely the absence of a declaration.

---

## 3. `tools/platform/perf-run.mjs` — REBUILD (narrow). The T1 gate can be spoofed.

This is the gate that decides whether any frame-time number in the project is admissible at all, so
I tested it hardest. **The four-marker rule is implemented correctly and the flags work.**

```
ANGLE (…SwiftShader Device (Subzero)…) + desktop-discrete  -> REFUSED (swiftshader)
llvmpipe (LLVM 15.0.7, 256 bits)       + desktop-discrete  -> REFUSED (llvmpipe)
Mesa Intel(R) UHD Graphics             + laptop-integrated -> REFUSED (mesa)
NVIDIA GeForce RTX 4070                + gaming-pc         -> REFUSED (bad device class)
NVIDIA GeForce RTX 4070                + (no class)        -> REFUSED
NVIDIA GeForce RTX 4070                + desktop-discrete  -> ADMISSIBLE
```

Every path exits **20**, never 0. The gate is a check and not a constant. Good.

### It is defeated by twenty lines running in the page

`readRenderer()` asks the page. The page is the side under test. I launched the game with one init
script patching `WebGLRenderingContext.prototype.getParameter`:

```
honest page      renderer="ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)…), SwiftShader driver)"
                 T1 tier_h_admissible = false   markers=["swiftshader"]
page that lies   renderer="NVIDIA GeForce RTX 4070/PCIe/SSE2"
                 T1 tier_h_admissible = true    markers=[]
```

Nothing notices. `tools/lib/browser.mjs` launches Chromium with `--use-angle=swiftshader` in
`DETERMINISTIC_CHROMIUM_ARGS` — **on the Node side, where the page cannot reach it** — and the gate
never consults it. R1 praised `session-run.mjs` for putting its checks where the party under test
cannot walk past them; this tool needs the same lesson in the opposite direction.

### And "not on the ban list" is treated as "attested GPU"

`tier_h_admissible = hit.length === 0 && classOk && s.length > 0`. Any non-empty string that misses
four substrings is admitted:

| renderer string | verdict | what it actually is |
|---|---|---|
| `Microsoft Basic Render Driver` | **ADMISSIBLE** | WARP — Windows' pure software rasteriser |
| `WebKit WebGL` | **ADMISSIBLE** | the masked string a browser returns when it *refuses* to identify the GPU |
| `Google Inc. (Google)` | **ADMISSIBLE** | the masked vendor string; identifies nothing |
| `ANGLE (Google, Vulkan 1.3.0 (Subzero Device (0x0000C0DE)))` | **ADMISSIBLE** | SwiftShader's own Subzero backend, named without the word |

The four markers are `RI-PLT01`'s and the narrow blame is the corpus's — but T1's direction is *"may
not produce a Tier-H score at all"*, so the safe default on an **unidentifiable** renderer is
refusal. This is a denylist where the rule calls for a fail-closed allowlist.

### Rebuild

- Cross-check `--attest-renderer` against the page's own renderer. The tool already holds both in
  one artifact (`live_evidence.renderer` and `enforcement`) and does not compare them. When the
  environment is software and an attestation says otherwise, that is
  `attestation_contradicts_environment` and a refusal, not a `source:` field.
- Read the Chromium launch arguments from the Node side and refuse whenever the harness itself
  requested a software backend, whatever the page says.
- Refuse unidentifiable and known-software-but-unlisted renderer strings. Report the four-marker
  hit *and* an `identified: false` state.
- Raise the four-marker list as an `RI-PLT01` amendment; it is the item's, and it is short.

---

## 4. `tools/platform/decoupling.mjs` — REBUILD as a real instrument (referral 3, ruled)

The builder asks me to rule. **The item already ruled, and the builder is right.** `RI-PLT01`
line 110 classifies sim/render decoupling as **Tier-S** — *"a structural property… Measuring it
under SwiftShader gives the same answer as measuring it on real hardware. Scoreable **here**, in
this container, today."* M6 is worth **10 points**, the largest single entry in the 26-point
sim-integrity axis.

`decoupling.mjs` declares `system: 'Tier-H performance numbers'` and `needs: ['getPerfStats']` —
a method M6 does not use — and refuses on a marker that belongs to the other tier. I ran M6 by hand:

```
render rate 60 -> read back 60, 600 sim steps
render rate 30 -> read back 30, 600 sim steps
render rate 15 -> read back 15, 600 sim steps
render rate  0 -> read back  0, 600 sim steps
sim step count identical at all four render rates: true
```

`setRenderRate()` and `stepFrames()` are both live; `--trace-events` supplies the `body_sha256`
half. **Nothing is missing. Make it a real instrument.**

**A wider ruling, because this is not one file.** All four Tier-H reporters (`perf-run`,
`hitch-census`, `load-run`, `decoupling`) declare the same `system` string, and each thereby
refuses the **Tier-S half of its own item** — P7 says GC pause *counts and attribution* are Tier-S,
P9 says the `body_sha256` load test is Tier-S. Whoever rebuilds `decoupling` should split the other
three the same way: refuse the Tier-H number, measure the Tier-S quantity.

---

## 5. `tools/journey/cadence.mjs` — REBUILD (narrow)

R1's defect is genuinely fixed: `LOCOMOTION_ACTIONS` is derived from `game/src/input/actions.js`,
membership is asserted at module load, an action outside the closed set makes C1 `unmeasurable`
rather than `pass`, and the dead `analyse` export is importable — I imported it. Self-test 10/10.

**My falsification, not the builder's re-run of R1's.** The rebuilt exclusion set is
`{sprint, jump}`. In a souls game the traversal verb is **roll**. An hour in an empty room pressing
one button six times a second, player advancing 2 160 m in a straight line the whole time:

| action | in closed set | C1 | gap_max | traversal_fraction |
|---|:-:|---|---:|---:|
| `roll` | yes | **pass** | **0.17 s** | **0** |
| `menu` | yes | **pass** | 0.17 s | 0 |
| `lock_on` | yes | **pass** | 0.17 s | 0 |
| `spell_cycle` | yes | **pass** | 0.17 s | 0 |
| `light` / `block` | yes | pass | 0.17 s | 0 | *(correct — these are engagement)* |
| `sprint` / `jump` | yes | fail | 3600 s | 1.0 | *(correct — the fix works)* |
| `interact` | yes | fail | 3600 s | 1.0 | *(correct — the no-op rule works)* |

An hour of dodge-rolling across the map, and an hour of opening and closing the inventory, both read
as *maximally engaged*. That is the exact reading the file's own header says it exists to prevent.

**Second, smaller, and the same shape as R1's question 3.** `traversal_fraction` (C7) is computed
from the **input log** — excluded inputs over all inputs — not from the world. My fixture's player
moves 2 160 m at 4.5 m/s for a solid hour and C7 reads `0`. The trace carries `player.pos` and
`player.speed_mps` on every frame; C7 reads neither. C9 explicitly refuses to compute proximity from
`world/**` because that would measure the design document, and that instinct is right and should be
applied here: **measure traversal from where the player went.**

---

## 6. `tools/journey/competence.mjs` — REBUILD (narrow). The clause now cannot pass.

R1's defect is fixed and fixed well: `changed === true` → `GEAR_CHANGED`, `changed === null` →
`GEAR_UNCHECKABLE`, `changed === false` → proceed, both blocking states demonstrated in the
self-test (9/9), plus a fourth *stale-observation* state the R1 critic did not name. K7 now reports
the hp spread the tier label hides, as R1 recommended, without moving the threshold.

**But the field it requires has never existed.** `compareLoadouts()` looks for `player.loadout`. I
walked the real trace at `reports/journeys/w1-13-jrn06/trace.jsonl` — 3 780 records:

```
records with player.loadout : 0
player.* keys actually emitted: … weapon_id weapon_class stance offhand_kind roll_class
                                  equip_load_pct estus attuned hp_max stamina_max …
```

Everything a gear comparison needs is in the trace under different names. No trace in this tree has
ever carried `player.loadout`, so on **every real run** the clause returns `GEAR_UNCHECKABLE` and
voids the comparison — and the tool names *"the trace"* as owner for data the trace is already
emitting. R1 found a clause that could not fail; round 2 shipped one that cannot pass. Map
`{weapon_id, offhand_kind, stance, equip_load_pct}` to the loadout and the clause becomes live
against real runs; keep `GEAR_UNCHECKABLE` for when even those are missing.

*(Confirmed against the real trace: the run blocks earlier, at `NO_AI` and `NO_ENCOUNTER_PAIR`,
both correctly reported with owners. Those are build gaps, not tool gaps.)*

---

## 7. `tools/journey/gamepad-shim.mjs` — REBUILD (narrow). No entity-side observation.

It runs. 8/8, lines flushed as produced, every failure through `die(EXIT.…)`. R1's three defects are
all fixed, and the root cause the builder found — `launchGame()` doing its own `goto`, so the
install-then-`reload` path could never fire `load` — is correct; `initScripts` before the goto is the
right fix and it is additive. I confirmed the engine-side check is genuinely engine-side:
`__HARNESS.gamepadPoll()` is `RealInput.pollGamepad()` (`game/src/input/real.js:128`), called from
`Engine`'s `beforeTick` every frame.

**What all eight checks have in common: none of them looks at the world.** They observe
`navigator.getGamepads()`, `mapping`, button and axis counts, descriptor strings, and
`gamepadPoll()`'s **return value**. A build whose `pollGamepad()` returns a perfect observation and
whose router then discards the axes passes 8/8, and `RI-JRN04` M13 is reported green for a pad that
moves nothing.

R1's own praise for `journey-run` is the standard: *"it observes an entity-side quantity (the player
moved 2.24 m) rather than the model's own return value."* The pattern is in the next file in the
same directory. Add a ninth check: hold the shim's stick, step frames, assert the player's position
changed — with the null control (stick at rest → no drift) that `journey-run` already carries.

---

## 8. `tools/experience/session-run.mjs` — REBUILD. An R1 pass, and it is broken.

R1 called this *"the best instrument of the twelve"* and *"what the other eleven should be measured
against."* Its self-test still passes 6/6, including the bypass case it was praised for: a driving
agent calling `window.__HARNESS.teleport` through `page.evaluate` is refused, because the
prohibitions are installed **in the page**. That architecture is right and I am not asking for it to
change.

**The profile is a list of six names. The harness surface is 328 methods.** I installed the
`first-hour` prohibition set exactly as `session-run` does, then:

```
before                      : listNPCs() -> 0
__HARNESS.spawn(…)          : refused: "RI-EXP01: spawn() is prohibited"   ✓ recorded
__HARNESS.spawnNPC({…})     : RETURNED {"eid":"critic-ghost","kind":"npc","name":"Ghost",…}
after                       : listNPCs() -> 1
violations recorded         : 1        ← only the one that was refused
```

`spawn` is prohibited. **`spawnNPC`, `spawnEncounter`, `spawnCivilian`, `spawnGuard`, `spawnProp`
are not.** The run completes, exits 0, records no violation, and is certified as a clean first-hour
session with an agent-authored NPC standing in it. The same gap exists on the other prohibitions:
`loadState` is refused while `restoreState` is not; `teleport` is refused while `travelRide`,
`boardTravel`, `setTravelMark` and a method literally named **`__breakTravelFence`** are not.

RI-EXP01's six names were written against a smaller harness. The enforcement is a **name list where
the item means a capability list**, and the surface grew underneath it. This is the same failure as
everything else in this review — a prohibition asserted in one place, absent in effect — wearing the
best clothes in the tree.

**Rebuild:** classify the whole surface by capability (mutate-world, teleport-player, grant-resource,
set-time/weather, load-state, …), derive the refusal set from the classification, and **fail closed
on any method the classification does not cover**, so the next twenty methods someone adds are
prohibited until somebody rules on them. Add `__breakTravelFence` to every profile. Keep the in-page
installation exactly as it is.

*(Lesser note, recorded not charged: a reference to a prohibited method captured **before** install
still works. `session-run` keeps no such handle, so nothing in the tree exploits it today, but the
prohibition is a property of the object's current shape rather than of the capability.)*

---

## 9. `tools/journey/journey-run.mjs` — ACCEPT. The R1 defect is genuinely repaired.

R1's finding was that `--sample-quests` and `--stratified` were advertised, inert, and the leg
reported `ok`. Verified fixed, three ways, against a booting game:

- **The predicates are faithful.** I reimplemented all five `RI-JRN07` §B strata from the raw quest
  JSON — a third independent implementation, after the tool's and the builder's Python one — and got
  `{Q1: 32, Q2: 0, Q3: 2, Q4: 9, Q5: 0}`, agreeing exactly with both.
- **The draw is live and seeded.** `--seed 4711` → `[Q-MAIN-10, Q-ARCH-01, Q-MAIN-01]`;
  `--seed 99` → `[Q-MAIN-01, Q-BLAK-01, Q-ARCH-01]`. Recorded in the artifact *before* the run, as
  Rule S1 requires, and checked against the running build's 69-id quest book.
- **With the flags absent the rows do not appear at all** (0 occurrences) — so the sample is not
  silently manufactured.
- **`m_quest_sample_complete` reports `unmeasurable`**, names both empty strata and their reasons,
  and states that the sample is *not* topped up from a populated stratum. Exit 1, never `ok`.

I also watched it fail honestly on something else in the same run: `control_observed` went `N/A`
with *"the player did not move between [2766.5,2.68,5011] and [2766.5,2.68,5011] after 60 frames of
forward input"* — an entity-side observation refusing to claim `first_control`. That is the standard
the other tools are being held to, and it is in this file.

---

## 10. The rest of the R1-accepted set — re-checked

| Tool | R1 | now |
|---|---|---|
| `journey/beat-extract.mjs` | 6/6 | **6/6** — still refuses to write the committed reference file |
| `experience/beat-extract.mjs` | 8/8 | **8/8** |
| `experience/beat-diff.mjs` | 9/9 | **9/9** |
| `experience/isolation-check.mjs` | 6/6 | **6/6** |
| `experience/log-lint.mjs` | 8/8 | **8/8** |
| `corpus/88-journeys/data/mw-open-beats.json` | accept | unchanged, still committed once |
| `experience/lib/md.mjs` | accept, with a note | **note stands, uncorrected**: `--help` exits 0 and prints nothing. R1's honest fix — stop counting a library among the commands — was not applied either way. |

---

## The three referrals

### Referral 1 — `RI-JRN07` §B strata Q2 and Q5: **a genuine content gap. Not a builder giving up.**

I checked the data myself rather than accepting the report, over all 69 shipped quests:

```
quests carrying a rank_gate at all        : 4      min_rank values present: [1, 2]
max shipped rank_gate.min_rank            : 2      → Q2 (rank >= 3) has 0 candidates
quests with q.region set                  : 0
quests with any destination field         : 0      → Q5 has 0 candidates
```

The builder undersold this. It is not that `q.region` "is set on almost no quest" — **there is no
destination field of any kind on any quest.** The only spatial information a quest carries is
`giver.location` and a free-text `directions` string. Q5's predicate cannot fire, ever, under this
schema. Widening it to "any quest with a long `directions` string" would be exactly the illegitimate
substitution R1 ruled on, and the builder was right to refuse it.

**Ruling: content gap, `corpus_debt` charged to content, not to the tool and not to any builder.**
Rule S1 makes the five binding, so `RI-JRN07`'s instrumented pass is unmeasurable until Q2 and Q5
are populated. **Rider for the corpus:** §B Q5 asks for geometry (*"≥ 15 walk-minutes away, crossing
a region border"*) while §C U1 requires 100 % `directions_coverage` from the same information *as
prose*. One item wants that fact in two incompatible forms and ships neither the field nor a
region-to-region walk table. That is a corpus defect alongside the content gap and should be filed
as one. The tool's phrasing should be corrected to *"no quest carries any destination-region
field"*, because the current wording implies some do.

### Referral 2 — `RI-MTH06` §A's worked example: **confirmed, it is a game defect, and it is worse than reported.**

Confirmed in the running build across six signatures, and again on a patched tree. But the
builder's diagnosis stops one step short, and the step it stops short of is the one that matters.

The builder says: 31 givers have a record with no `reaction_group`, 9 have no record at all;
*"the moment either lands the tool measures the race bar for real."* **That is false, and I proved
it by doing exactly what the builder recommends.** I minted the record — `reaction_group: RG-DEEP`,
`disposition: 50` — and booted the engine on the patched tree. The offer gate did not move for any
race. The disposition clause vanished for *everyone*, because `seedDispositions()` writes the raw
`50` and never consults the matrix.

**The defect is not a missing field. It is that the reaction matrix is not wired to the quest path
at all.** `derivedDisposition()` reaches the world in exactly two places in `game/src` —
`Engine.npcDisposition()` (a read-only surface) and `character/encounter.js openingFor()` (encounter
hostility). No quest gate calls it. Adding `reaction_group` to 31 records would make
`build-viability` go red for race-gated blocks **the game does not have** — strictly worse than
today.

**Ruling: a game defect, owned by `game/src`, and `orchestration/NEXT-DISPATCH.md` §1b must be
amended.** The fix is in one of two places: `seedDispositions()` applies `derivedDisposition()`
against the character, or `canOffer`/`_dispositionToward` derive at read time. Either is a few
lines. The data work (records + `reaction_group` fields) is necessary but **not sufficient**, and
dispatching it alone would produce a build that still ignores race while every instrument reported
that it did not. It also contradicts the setting's premise exactly as the dispatch note says — an
Argonian at home and a Dunmer abroad are offered the same quests on the same terms today.

*(One nuance in the build's favour: race is not wholly inert. `openingFor()` gates encounter
hostility on the matrix, so a Dunmer and a Saxhleel can be met differently in the world. It is the
**quest** path that is blind. And `_dispositionToward()` carries a sap-taint term that
non-Argonians accumulate — a race-correlated penalty, but earned through play, not a creation-time
bar, and it touches resolutions rather than offers.)*

### Referral 3 — `RI-PLT01` M6: **agreed. Make it a real instrument.** See §4 above.

The builder is right, the item said so first (Tier-S, line 110, *"scoreable here, today"*), and I
ran the measurement in this container. `decoupling.mjs` is rebuilt as a real instrument, and the
exit-21 fuse the builder wrote to make someone come back has done its job: someone came back.

---

## C8

```
node tools/corpus-index.mjs   →  26 phantom tools, 0 errors
```

**26, and all 26 are genuinely missing.** I resolved every one against the tree and searched for a
same-basename file anywhere under `tools/` — **no matches, so no further path errors remain**, and
R1's regex fix (`(?![A-Za-z0-9_])`) is applied at `tools/corpus-index.mjs:407` with the reasoning in
a comment.

```
experience  14   anecdote-verify breakage-probe build-divergence builds-from-md classes-from-md
                 elements-build event-histogram novelty-curve pbrule-audit probes-from-md
                 recall-run sag-fit session-beats shape-check
composition  5   emergence-probe fuzz matrix-probe matrix-scan probes-from-md
corpus       5   dump-dialogue dump-dialogue-graph dump-npcs probe-combat-dialogue style-fingerprint.py
analysis     2   economy-model pacifist-in-fight
```

The builder's priority order is sound and I do not disturb it. One warning carried forward from R1
and still true: **a cleared C8 warning is not a capability.** `RI-CMP03` step 2 still carries
`PATH CORRECTED, CONTRACT STILL OPEN` — `build-viability` has no `--chains` mode — and that item's
step remains `corpus_debt` regardless of what the counter says. Twelve absence-reporters cleared
twelve warnings this round; **none of them measures anything**, which is correct and honest, and
the Build status page must not read those twelve as coverage.

---

## What the builder must do to reach SATISFIED

1. **`build-viability.mjs`** — model the shipping offer gate (raw seeded disposition), report the
   nine unreachable-for-everyone quests as **FAIL**, and demote the derived-ceiling walk to a
   labelled counterfactual. Delete or implement `--signatures`.
2. **`lib/absence.mjs`** — validate `needs` against the live surface and refuse when a name matches
   nothing; parse `not_implemented[].what` as a list, not a string; require positive evidence for
   `ARRIVED`.
3. **`perf-run.mjs`** — cross-check `--attest-renderer` against the page; read the Chromium launch
   args Node-side; refuse unidentifiable renderer strings.
4. **`decoupling.mjs`** — real Tier-S instrument (M6). Split the Tier-S half out of `hitch-census`
   and `load-run` while you are there.
5. **`cadence.mjs`** — classify `roll` and the surface toggles against C1's five clauses; compute
   `traversal_fraction` from `player.pos`, not from the input log.
6. **`competence.mjs`** — read the loadout from the fields the trace actually emits.
7. **`gamepad-shim.mjs`** — one entity-side check with a null control.
8. **`session-run.mjs`** — capability-derived refusal set over the whole surface, fail-closed on
   anything unclassified.

Nothing in the accepted seven should be touched. **`journey-run.mjs` is this round's best work** and
is the model for the rest: three independent verifications, a seeded draw recorded before the run, a
stratum that cannot be filled reported as empty rather than back-filled, and an entity-side
observation that refused to claim a result.

---

## Provenance

Everything above is `measured`, on this tree, by me, in this pass.
`node tools/harness/boot-check.mjs` **PASS** before every measurement — noted because
`smoke.mjs` never boots the engine, which is how a broken build once passed every check here.

Falsifications constructed by me and reproducible from the descriptions given: the six-signature
`questOffers()` invariance sweep; the shadow-tree NPC mint driven through **the engine** rather than
only the tool; the twelve-reporter `needs`-versus-surface census; the three `reportAbsence()` probes
(control / third bug / prefix over-correction); the four-renderer-string T1 sweep plus the init-script
spoof; the nine-action cadence sweep via the now-importable `analyse`; the `player.loadout` census
over a 3 780-record trace; the third independent reimplementation of the five `RI-JRN07` strata; the
four-render-rate M6 run; and the `spawnNPC` bypass of `session-run`'s first-hour profile.

Self-test results are quoted from runs I executed, not from the builder's record. Where I agree with
the builder I say so and say why I checked anyway. Shadow data patches were made under
`/tmp/.../scratchpad/shadow/`; **`game/data` on this tree was not modified.**

I did not `git commit`, did not run `tools/publish.mjs`, and deleted no indexed data file.
