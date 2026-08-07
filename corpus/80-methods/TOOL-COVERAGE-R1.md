# TOOL-COVERAGE-R1 — the tool critic's verdict on the twelve instruments of round 1

> `TOOL-LOOP.md` rule 3. A separate critic with fresh context checks the instruments. I did not
> write any of these twelve and I am not defending them.
>
> **Verdict: NOT SATISFIED.** Five of the twelve must be rebuilt. Seven are sound.
> The builder goes round again.

| | |
|---|---|
| Tools reviewed | 12 (11 executables + 1 committed reference artifact) |
| Rebuild | **5** — `build-viability.mjs`, `gamepad-shim.mjs`, `journey-run.mjs`, `cadence.mjs`, `competence.mjs` |
| Accept | 7 — `journey/beat-extract`, `mw-open-beats.json`, `experience/{session-run, beat-extract, beat-diff, isolation-check, log-lint}` |
| Worst instrument | **`tools/analysis/build-viability.mjs`** |
| C8 at start of this pass | 55 |
| C8 now | **49** (3 cleared by the path corrections ruled below; 3 by other agents shipping `marker-scan.mjs`, `ui-census.mjs`, `ui-layer.mjs` mid-pass) |
| Harness state | `node tools/harness/smoke.mjs` PASS (6/6) before every measurement below. The game boots. |

Every number below was produced by me, on this tree, at this commit. Where I broke something on
purpose, the construction is given so it can be re-run.

---

## Why this verdict is not SATISFIED

Ten of the twelve ship a `--self-test` that passes. That is worth something and I record it: these
are not stubs, and several of them are better instruments than anything else in `tools/`. But a
self-test written by the same hand as the tool proves the arithmetic the author was thinking about.
The five failures below are all things the author was *not* thinking about, and four of the five
are invisible to the tool's own self-test — which is the entire argument for this role existing.

The pattern across all five is one failure, repeated: **a substitution made where the world did not
supply what the item asked for, chosen in the permissive direction, and then not declared.** That is
the same shape as `cmb-reach.mjs --verify`, and `RI-MTH07` §D.3 rules on it in one line: *a comment
asserting a check is not a check.*

---

## The five questions, per tool

Legend: **1** measures the specified thing · **2** can fail · **3** reads the running world ·
**4** self-blinding · **5** flags work.

| Tool | 1 | 2 | 3 | 4 | 5 | |
|---|:-:|:-:|:-:|:-:|:-:|---|
| `analysis/build-viability.mjs` | ✗ | ✓ | ✓ | **✗** | ✓ | **REBUILD** |
| `journey/journey-run.mjs` | ✓ | ✓ | ✓ | ✓ | **✗** | **REBUILD** |
| `journey/gamepad-shim.mjs` | — | **✗** | — | — | — | **REBUILD** — does not run |
| `journey/cadence.mjs` | ✗ | ~ | ✓ | ✓ | ✓ | **REBUILD** |
| `journey/competence.mjs` | ~ | **✗** | ✓ | ✓ | ✓ | **REBUILD** |
| `journey/beat-extract.mjs` | ✓ | ✓ | ✓ | ✓ | ✓ | accept |
| `corpus/88-journeys/data/mw-open-beats.json` | ✓ | n/a | n/a | ✓ | n/a | accept |
| `experience/session-run.mjs` | ✓ | ✓ | ✓ | **✓✓** | ✓ | accept — best of the twelve |
| `experience/beat-extract.mjs` | ✓ | ✓ | ✓ | ✓ | ✓ | accept |
| `experience/beat-diff.mjs` | ✓ | ✓ | ✓ | ✓ | ✓ | accept |
| `experience/isolation-check.mjs` | ✓ | ✓ | ✓ | ✓ | ✓ | accept |
| `experience/log-lint.mjs` | ✓ | ✓ | ✓ | ✓ | ✓ | accept |
| `experience/lib/md.mjs` | ✓ | ✓ | ✓ | ✓ | ~ | accept (library) |

---

## 1. `tools/analysis/build-viability.mjs` — REBUILD. The worst of the twelve.

This is the axis that pinned `RI-CHR01` and `RI-CHR03` at native 0 for every build since wave 0.
Its output is about to un-pin them. It returns **540/540 viable, exit 0**, and its own self-test
passes **8/8**. Both of its substitutions push toward `viable: true`, and one of them is undeclared.

### What is right, and it is a lot

**The shipping-predicate claim is true — verified, not accepted.** `game/src/engine.js` imports
`FactionGates` (line 19), `composeCharacter` (line 56) and `derivedDisposition` (line 68) from the
same modules the tool imports; `mitigate` is consumed by `combat/actor.js`, `harness/api.js`,
`sim/magic/system.js` and `sim/combat-bridge.js`. The tool does not reimplement a single predicate.
The claim *"it is wrong exactly when the game is wrong"* holds.

**Criterion 4 is not a stub, and it is signature-sensitive.** I swept the damage multiplier
independently of the self-test:

| tier-5 damage ×N | 1 | 2 | 3 | 4 | 6 | 8 |
|---|---:|---:|---:|---:|---:|---:|
| criterion-4 failures / 540 | 0 | 0 | **117** | **279** | **405** | **504** |

A partial failure count at ×3, ×4 and ×6 is the thing that distinguishes a live model from a
constant: the tool is discriminating between signatures, not flipping all 540 together. Criterion 3
does the same under a disposition-floor overlay (floor 60 → 450 viable; 90 → 90; 93 → 54). Neither
fact is available from the self-test, which only ever exhibits 0→540 and 540→0. **Criterion 4 is
live and I am not asking for it to be rewritten.**

### Defect A — the tier-5 substitution rests on a claim about the data that is false

The tool declares, in `model.tier5_substitution_note`, printed into **every report it writes**:

> *"regions.json declares no `tier` on any region and encounters.json declares none either, so 'the
> tier-5 region' has no referent in shipped data."*

That is not true. `game/data/world/regions.json` carries **`danger_tier`, 1–5, on all thirteen
regions**. Two are tier 5:

```
deep-marshes  danger_tier=5      stone-wastes  danger_tier=5
blackwood 2 · clay-moor 4 · crimson-coast 4 · eastern-rootlands 2 · hive 2 · marauders-coast 2
salt-hills 3 · stone-forest 3 · thornmarsh 4 · valus-ridge 4 · western-rootlands 1
```

It is not paperwork either: `game/src/engine.js:3306` reads `r.danger_tier` into `getTerrainAt()`,
so it is a live world-side field. And the corpus already knew — `corpus/90-verdicts/wave1/W1-01.md`
line 441 names it: *"`regions.json` carries `danger_tier` 1–5 on all thirteen regions."* The tool
searched for a field literally called `tier`, did not find one, and concluded the referent did not
exist.

The cohort it substituted is wrong in **both** directions:

- It **includes** `cst_sap_speaker`, whose fog gate `gate-ceyatatar-vault` is in **`blackwood`** —
  `danger_tier` **2**. A tier-2 boss is being fought as the tier-5 test.
- It **excludes** the only encounter authored in a tier-5 region: `deep-kin-war-brood`,
  `regions: ["deep-marshes","stone-forest"]`, **3 × `inf_trash`**. The tool's `fightEncounter`
  resolves one enemy at a time and has no concept of a group, so the one authored tier-5 fight —
  and the only multi-enemy fight in the data, which is where lethality actually bites — is never
  measured.

**Ruling: the substitution is not legitimate.** The premise it is justified by is false, the
referent exists, and the printed disclaimer that was supposed to keep it honest is itself a false
statement in the artifact. A declared substitution is only honest if the declaration is true.

The rebuild is not hard: resolve the tier-5 cohort as *every enemy reachable in a region with
`danger_tier == 5`* — via `encounters[].regions` and `hearths.json` `fog_gates[].region` — and fight
the group, not the individual. Where that cohort is thin, **say so and report `unmeasurable`**; do
not widen it until it is populated.

### Defect B — the disposition ceiling grants itself the thing under test, and does not say so

This is the finding that costs the tool its result.

`questClearableInner()` resolves the quest giver's reaction group through `npcGroupById`, built by
walking `game/data/npcs/**`. If the lookup misses, it falls back to `bestDispositionCeiling()` — the
**maximum over all twelve reaction groups**.

I counted the misses:

```
quest givers with a `disposition_min`                      : 41
        …resolving to a reaction group                     :  0
        …falling back to best-over-all-groups              : 41   (100%)
```

The fifteen NPC records that do carry a `reaction_group` are all non-givers
(`helstrom-net-mender`, `stormhold-gate-guard`, …). Not one quest giver —
`speaker-teel-ashaan`, `undersexton-aveline-rell`, `rootkeeper-ashul-tei` and the rest — has an NPC
record anywhere in `game/data/`; they exist only inside the quest files.

The consequence is arithmetic. The best-over-all-groups ceiling is **92–94 for every race and
upbringing**. The highest `disposition_min` shipped is **50**. So the permanent disposition bar
**cannot fire for any signature, ever** — not because no build is blocked, but because the tool
never asks the question:

| character | group | true ceiling | what the tool uses | `Q-DEEP-01` asks |
|---|---|---:|---:|---:|
| `dunmer` / `lukiul` | RG-DEEP | **34** | 92 | 50 |
| `dunmer` / `blackrose` | RG-DEEP | 44 | 92 | 50 |
| `dunmer` / `foreign-born` | RG-DEEP | 46 | 92 | 50 |

A `dunmer`/`lukiul` character cannot reach `speaker-teel-ashaan`. The tool passes it. This is the
permanent race+upbringing bar — the item's central thesis (*"Race … the whole 12×10 reaction
matrix"*) and the **literal worked example in `RI-MTH06` §A's own output shape**:

> `"why": "race term -40 + upbringing -4 puts the ceiling at 41"`

That `stopped_at` is the one the specification prints as the model of a useful failure, and it is
the one this tool is structurally incapable of producing on shipped data.

**Two things make this worse than defect A.** First, it is **undeclared** — the `model` block
declares the tier-5 substitution but says nothing about giver-group resolution, and the report does
not carry the unresolved-giver count. A reader of `reports/viability.json` cannot discover it.
Second, the self-test's *"criterion 1 falsifiable"* and *"criterion 3 falsifiable"* both drive the
fixture floor to **200** — above even the permissive 92 ceiling — so both pass identically whether
the group lookup works or is 100% broken. **The falsification is vacuous with respect to the
mechanism it appears to test.** This is `TOOL-LOOP` question 4 exactly: the probe opened the door it
was sent to check was locked.

The rebuild: when a giver's reaction group cannot be resolved, that is a **data absence**, and
`TOOL-LOOP` rule 1 governs it — *"write it so it reports the absence and exits non-zero with a
reason. Never stub it to pass."* Report the count, name the givers, and mark those quests
`unmeasurable` rather than silently granting the best group in the game.

### Consequence for scoring

> **`RI-CHR01`'s Distinctness axis and `RI-CHR03`'s Decidability axis MUST NOT be scored from this
> run.** They stay `corpus_debt` against `RI-MTH06` for one more round. The 540/540 is a real
> computation — of a permissively substituted question, on the wrong cohort, with the item's own
> headline failure mode disabled. Un-pinning two items on it would hand them a score they have not
> earned, which is the specific harm this review was commissioned to prevent.

### Questions 2, 3, 5

- **2 — can it fail: YES**, genuinely and independently confirmed (the sweeps above).
- **3 — world or document: legitimate exception.** `RI-MTH06` §A explicitly requires this one to be
  a static walk (*"No browser needed … it must stay static so it can run in CI"*). It compensates
  correctly by importing shipping predicates rather than reimplementing them.
- **5 — flags:** all 10 advertised flags are read. No `--verify`-style lie.

---

## 2. `tools/journey/gamepad-shim.mjs` — REBUILD. It does not run.

The builder recorded *"gamepad-shim self-test 5/5 incl. null control"* and *"gamepad-shim DID pass
5/5 against a booting game"*. **It does not pass now, and it does not fail cleanly.** Three
consecutive attempts, on a tree where `smoke.mjs` passes:

```
page.reload: Timeout 30000ms exceeded.
  at launchGameWithShim (tools/journey/gamepad-shim.mjs:253:21)
  at async verifyOne (…:212:18)   at async selfTest (…:278:15)
{ name: 'TimeoutError' }                                        exit 1
```

Three separate defects, in ascending order of seriousness:

1. **It hangs on `page.reload({ waitUntil: 'load' })`.** The design comment concedes the shape of
   the problem — *"browser.mjs performs the goto internally … So: launch, install, and RELOAD, which
   replays init scripts"*. The reload never fires `load`. The null control (a bare launch) succeeds
   in the same run, so the game boots; it is the reload path that is broken.
2. **It crashes rather than reporting.** Every other tool in this set routes failure through
   `die(EXIT.…)` with a reason. This one throws an uncaught `TimeoutError` and prints a raw Node
   stack. It has a `HARNESS_ABSENT` exit path immediately below the failing line and never reaches
   it.
3. **A partial self-test reports nothing at all.** The `PASS`/`FAIL` lines are buffered into
   `lines[]` and only written after every case completes. The null control had already *passed* when
   the crash happened, and that result was lost. An instrument that discards the evidence it has
   already gathered when a later step fails is the wrong shape for an instrument.

`journey-run.mjs`'s `jrn04-pad` leg depends on this shim, so `RI-JRN04` M13 is unmeasurable until it
runs.

---

## 3. `tools/journey/journey-run.mjs` — REBUILD (narrow). Two flags are asserted and inert.

**First, the re-verification that was asked for. It now passes, against a booting game:**

```
PASS accessor empty before any surface — 0 entries via __HARNESS.getRenderedText(), open=false
PASS real keyboard input reaches the world (entity-side) — player moved 2.2400 m under a real
     page.keyboard 'w' with no surface open
PASS null control: no input, no movement — player drifted 0 over 60 uncommanded frames
PASS accessor non-empty on a frame known to carry text — censusBegin -> 12 strings, first "JEEH-EI"
PASS blinded accessor is detected as empty (both accessors) — reported unmeasurable, never
     "0 instruction hits"
journey-run self-test: PASS (5/5)
```

This is a good self-test and I want to say why, because it is the standard the other four should be
held to. It has a **null control** (no input → no movement), it observes an **entity-side** quantity
(the player moved 2.24 m) rather than the model's own return value, and it **blinds both** rendered-
text accessors and confirms the result degrades to `unmeasurable` rather than to a zero that reads
as a pass. That is `RI-MTH07` §B applied to the instrument itself.

**The defect: `--sample-quests N` and `--stratified` are advertised and do nothing.** The usage block
promises *"quests to sample"* and *"stratify the quest sample by giver/region"*. The `jrn07-quest`
leg is, in full:

```js
const qs = await handle.hOpt('getQuestState');
led.ok('m_quest_state', 'quest state',
  { sample: Number(args['sample-quests'] || 0), stratified: !!args.stratified, state: … });
```

Nothing is sampled. Nothing is stratified. The flags are echoed into the ledger record and the leg
reports **`ok`**. This is `cmb-reach.mjs --verify` reproduced exactly — a flag asserted in a usage
block, silently ignored, and the run exits 0 — in the round whose whole purpose was to stop that
happening. `RI-MTH07` §D.3 is binding: *"A comment asserting a check is not a check."*

Fix: implement the sampling, or delete both flags and mark the `jrn07` sampling leg
`led.unmeasurable(...)` with the reason. Either is honest. Reporting `ok` is not.

*(All 24 other advertised flags are read. `--wall-clock-advance`, `--layouts`, `--scenario`,
`--corruption`, `--deaths`, `--dpr`, `--pointer` and `--state` all reach real behaviour — I checked
each against the code outside the usage literal.)*

---

## 4. `tools/journey/cadence.mjs` — REBUILD (narrow). The exclusion list is not the shipped action set.

The instinct is right and the file argues for it well: *"an hour walking in a circle must not read
as maximally engaged."* The implementation does not deliver it.

`LOCOMOTION_ACTIONS` is documented as **"the closed action set's locomotion members."** The closed
action set is `game/src/input/actions.js`:

```
light heavy roll block parry sprint jump use_item interact lock_on two_hand
swap_right swap_left menu crouch spell_cycle
```

**Eleven of cadence's sixteen names are not in it** — `forward back left right move walk run jog
look turn camera`. They appear to have been taken from `rebind.js`'s internal mapping, not from the
emitted event. Meanwhile the list *excludes* three names that **are** in the closed set — `sprint`,
`jump` and `crouch` — and `crouch` is a toggle that changes a flag, which is a state change by
`RI-JRN02` C1's own words.

**The falsification.** An hour of pure locomotion, 21,601 input events, under seven action names:

| action name | C1 | `gap_max` | excluded | `traversal_fraction` |
|---|---|---:|---:|---:|
| `forward` | fail | 3600 s | 21601/21601 | 1.0 |
| `moveForward` | **pass** | **0.17 s** | **0/21601** | **0** |
| `w` | **pass** | 0.17 s | 0/21601 | 0 |
| `axis_move` | **pass** | 0.17 s | 0/21601 | 0 |
| `strafe_left` | **pass** | 0.17 s | 0/21601 | 0 |
| `MoveForward` | **pass** | 0.17 s | 0/21601 | 0 |
| `lookX` | **pass** | 0.17 s | 0/21601 | 0 |

Six of seven produce the exact reading the file exists to prevent.

**In fairness — this does not fool the tool against *this* build today.** Movement here is an axis,
not an action: the engine emits `input_action` only for attack/roll moves (`sim/player.js:109`) and
census commits (`engine.js:1514`), so an hour of walking emits no input events and C1 correctly goes
red for the right reason by accident. The defect is that the exclusion encodes an *assumption* about
the world instead of reading it — a mild `RI-MTH07` question-3 failure — and that the audit the
header offers as its defence (*"the excluded count is printed so the exclusion can be audited rather
than trusted"*) will always print empty, so it audits nothing.

Fix, one line: `import { ACTIONS } from '../../game/src/input/actions.js'` and assert at startup
that every `LOCOMOTION_ACTIONS` member is in it, failing loudly when it is not.

**Two smaller notes.** (a) A player mashing a no-op `interact` in an empty room for an hour reads
`C1 pass, gap 0.5 s` — an action that opened nothing and changed nothing is not one of C1's five
clauses. C3 (`apm_nc 120, fail`) and C10 (`variety 1, fail`) do catch it, so the item is not fooled;
C1 alone is. (b) `export function analyse` is dead — importing the module runs the CLI and exits, so
no other tool can reuse it.

**What is right:** an empty trace is `unmeasurable` on all ten checks and never a pass; C4, C9 and
C10 degrade to `unmeasurable` with a stated reason rather than to zeros; C9 explicitly refuses to
compute proximity from `world/**` because that would measure the design document. Those are correct
and they are the hard parts.

---

## 5. `tools/journey/competence.mjs` — REBUILD (narrow). The gear clause cannot fail.

**K7 holds.** I confirmed the named gaming route is closed: an identical improvement measured
against a weaker-tier late enemy produces `status: unmeasurable`, blocker `K7_WEAKER_LATE`, and the
comparison is voided rather than caveated. Good.

**The gear clause does not.** `RI-JRN02` §C requires *"no equipment upgrade between them: if the
improvement requires better gear, the game taught the player to shop, not to fight."* The file's
header states it enforces this: *"the loadout is captured at both encounters and any difference
invalidates the comparison."*

`compareLoadouts()` returns `{ changed: null, why: 'no trace record carries player.loadout…' }` when
the field is absent. The caller is:

```js
if (gear && gear.changed) { blockers.push({ code: 'GEAR_CHANGED', … }); }
```

`null` is falsy. **No blocker is raised when the clause cannot be checked at all.** Three runs, same
improvement:

| trace | `gear.changed` | blockers | status |
|---|---|---|---|
| loadout present, unchanged | `false` | — | proceeds (correct) |
| loadout present, upgraded | `true` | `GEAR_CHANGED` | `unmeasurable` (correct) |
| **loadout field absent** | **`null`** | **none** | **proceeds** |

So a competence curve bought entirely with gear is certified whenever the trace omits
`player.loadout` — and the self-test's own fixture (`mkEnc`) never emits that field, which is why
the builder's *"a real improvement … is recognised"* case passed with the gear clause silently
unchecked. The absence must degrade to `unmeasurable`, exactly as K7 does when it cannot resolve a
statblock. As written this is the third instance in this review of a check that is asserted in a
comment and absent in effect.

**Secondary, and I am not asking for a rebuild on it.** K7 compares only the three-value tier
ladder. `champion_hist_marked` (2,876 hp) and `cst_sap_speaker` (380 hp) are **both `elite`**, so a
7.6× weakening between E_first and E_late rates `K7: pass`. The tool obeys `RI-JRN02` K7 to the
letter and the letter is thin. Recommend it also report the hp/dps spread between the two cohorts so
a critic can see what the tier label is hiding.

---

## 6–12. The seven accepted

**`experience/session-run.mjs` — 6/6, and the best instrument of the twelve.** It is the only one
that directly answers question 4, and it answers it structurally rather than by promising. It
installs its prohibitions **in the page**, by replacing the `__HARNESS` methods, so a driving agent
reaching `window.__HARNESS` through `page.evaluate` cannot walk past a Node-side check — and the
self-test proves that specific bypass is closed. It carries a **null control** (`teleport` works
*before* the profile is installed, so the refusal afterwards is the profile and not a broken build),
proves every prohibited method throws *and is recorded*, proves **non-prohibited methods still
work** (a profile that breaks everything measures nothing), and proves a violation **voids** the run
rather than footnoting it. Its `first-hour` refusal set is verbatim `RI-EXP01` lines 186–187:
`teleport, spawn, aggro, setTimeOfDay, setWeather, loadState`. The added `build-identity` profile
also refuses `setSkills / setAttributes / setMagicSkills / setGold / learnSpell` — which is the
direct answer to the frozen-skill-register failure that survived two rounds because every magic
probe in this tree, including two written by a critic, opened by setting all magic skills to 100.
**This is what the other eleven should be measured against.**

**`experience/beat-extract.mjs` — 8/8.** The falsifications are the right ones and they are subtle:
`found_not_given` does not fire when a topic named the item first; a topic *after* the pickup does
not retro-convert it, so *"at the time it fires"* is load-bearing for `T_found`, which is
`RI-EXP01`'s headline metric; combat requires an `AGGRO` hostile and not merely an attack.

**`experience/beat-diff.mjs` — 9/9.** A beat outside tolerance is `LATE`, not `HIT`; one observation
cannot satisfy two sheet beats, which is what stops a single lucky event inflating `beats_hit`. It
implements `RI-EXP01` STEP 5 — the negative artifact, the search performed and its empty output — on
every missing row, which is the step that normally gets dropped. Schema-tolerant across both
beat-sheet shapes with a self-test proving both give identical verdicts.

**`experience/isolation-check.mjs` — 6/6.** Catches a beat-sheet read hidden inside a `Bash` command
line, which is where leaks actually hide — `cat corpus/…` never appears in a `file_path` field. An
inbox that materialises a whole reference item is `VOID` by construction. `enforced` with no
tool-call log degrades to `attested` and caps the item at 6 rather than passing — a graceful
degradation that costs the claim, which is the right direction.

**`experience/log-lint.mjs` — 8/8**, including a false-positive control: a genuinely neutral 5-line
log passes. A lint that fires on everything gets ignored rather than obeyed, and testing for that is
unusually mature. Exits 20 as `PLAYTHROUGH-CRITIC` §5.4 names.

**`journey/beat-extract.mjs` — 6/6**, and it **refuses to write** the committed reference file —
asserted as a check, not a comment. That is the right guard: an extractor that can regenerate the
reference side is an extractor that can quietly move the goalposts between rounds.

**`corpus/88-journeys/data/mw-open-beats.json`.** 10 beats (MW/OPEN rows 3–12), the same four-field
form as our side (`actor`, `place`, `utterance`, `fields_set`), with `side`, `source`, `provenance`,
`confidence` and `owner` declared. This satisfies `RI-MTH06` §C — the reason it exists is that wave
1's `RI-JRN01` pack was discriminable on *register* because one side was transcript and the other
was stage direction. Committed once, so every future critic compares against the same text.

**`experience/lib/md.mjs`.** A library, correctly built: the generator reads the prose item and never
a hand-maintained copy, so `RI-EXP01.beats.json` cannot drift from `RI-EXP01`. One correction to the
builder's record: it claims *"all 12 tools exit 0 on `--help` with a usage block."* `md.mjs --help`
exits 0 and prints **nothing**. `RI-MTH06` method 2 asks for exit 0 **and a usage block**. The
honest fix is to stop counting a library among the twelve commands, not to bolt a usage block onto
it.

---

## The two judgements referred to me

### Ruling 1 — the dialogue tools: **the builder is right. Path correction, not duplication. Applied.**

`tools/corpus/` has never existed. Two of the seven names under it have real, working counterparts:

| corpus named | actually | verified |
|---|---|---|
| `tools/corpus/disposition-oracle.mjs` | `tools/dialogue/disposition-oracle.py` | ran a 2,000-case sweep |
| `tools/corpus/dump-engine-disposition.mjs` | `tools/dialogue/dump-engine-disposition.mjs` | ran against the oracle's cases |

I did not take the builder's word for it — building a second oracle would be the "adjacent thing
wearing the name" the rule forbids, but *blessing a path to a tool that does not work* would be
worse, because it clears the C8 warning and leaves nothing behind it. So I ran the pair end to end.
Both exit 0, and they **agree on all 2,000 cases**.

**Rider, and it matters: the corpus's `.mjs` extension for the oracle is itself the error and must
not be honoured.** `RI-DLG04` step 1's own first sentence demands a reference implemented
*"independently of our code"*. The Python file is in a different language **on purpose** — its
header says so — and "correcting" it into a `.mjs` sibling of the engine would destroy exactly the
independence the item is buying. The corrected path is `tools/dialogue/disposition-oracle.py`,
invoked with `python3`.

**Two further defects found by running the step, both corrected in `RI-DLG04`:**

- The verification command was `diff <(cut -f9-12 …)`. Columns 9–12 are `pLevel pReputation
  pFatigue pFatigueMax` — **inputs**, which both files echo verbatim. The check passed identically
  whether or not the engine agreed with the oracle. **`RI-DLG04` step 1 has been a check that cannot
  fail since it was written.** The outputs are columns 31–35 (`D d target1 target2 target3`).
- The two sides format signed zero differently (`-0.000000000` vs `0.000000000`). On the real output
  columns a textual `diff` reports ~15% of rows as mismatched when the arithmetic agrees exactly.
  The step must compare **numerically at ±0.001**, which is what the item's own stated requirement
  says and what its command did not do.

`RI-DLG04`'s method now carries a numeric comparison over columns 31–35 and a `CORRECTED wave 1`
note. **No threshold in the item was changed.**

**A third path error the builder did not catch, also corrected.** `RI-CMP03` step 2 names
`tools/experience/build-viability.mjs` — the builder wrote it under `tools/analysis/`, which is where
`RI-MTH06` §A and `RI-CHR01` M6 both put it, so the path in `RI-CMP03` was the error. **But
correcting the path does not make the step runnable and I will not let it read as coverage.**
`RI-CMP03` asks for `--chains` and for `V-MAIN` / `V-FAC` / `V-BOSS` per build archetype plus a
driver-refusal list. The shipped tool implements `--signatures` over `RI-CHR01` §5's 540-cell grid
and has **no `--chains` mode at all**. The item now carries a `PATH CORRECTED, CONTRACT STILL OPEN`
note saying so, and step 2 remains `corpus_debt` against `RI-MTH06`. *The C8 warning cleared; the
capability did not.* Clearing a warning without the capability behind it is the same defect as a
phantom tool, wearing better clothes.

### Ruling 2 — audio and platform: **right on the substance, wrong on the conclusion.**

The builder is **right** that emitting numbers here would be the stub-to-pass failure, and I confirm
both premises:

- **Audio is genuinely absent, with a named owner.** `game/src/harness/api.js:1387` declares
  `{ what: 'audio', owner: 'RI-AUD01..03 / wave-1 piece W1-25', surfaced_as: 'audioMB: 0…' }`, and
  `engine.js:4097` reports `audioMB: 0`. There is nothing to measure.
- **`RI-PLT01` rule T1 does forbid the number.** *"A manifest whose renderer string contains
  `SwiftShader`, `llvmpipe`, `software` or `Mesa` may not produce a Tier-H score at all — not a low
  one, not a provisional one."* Our renderer is SwiftShader (confirmed in this pass's `smoke.mjs`
  output). An `fps` figure from this harness would be inadmissible by construction.

**But "write nothing" is not what the corpus asks, and on platform it is actively unsafe.**
`TOOL-LOOP` rule 1: *"If the tool cannot be written honestly — because the system it measures does
not exist — then write it so it reports the absence and exits non-zero with a reason. Never stub it
to pass."* Writing nothing and stubbing to pass are opposite errors; the rule names a third thing,
and that third thing is the deliverable.

On platform it is sharper than a procedural point. **`RI-PLT01` T1 names `perf-run.mjs` as the
enforcer of its own rule:**

> *"The tooling enforces this (`tools/platform/perf-run.mjs` refuses to emit Tier-H fields when the
> renderer is software) **so that a well-meaning critic cannot report a SwiftShader frame time as
> evidence**."*

The item's defence against its own worst failure mode *is a tool that does not exist*. Today nothing
stops that critic. That is a live risk created by the omission, not a neutral deferral — and it is
the same shape as everything else in this review: a check asserted in prose, absent in fact.

**Ruling.** These twelve tools (4 audio + 8 platform) must be written as **absence-reporters**: name
the absent system and its owner, emit **no** number, exit non-zero. `perf-run.mjs` in particular
must additionally implement the T1 renderer refusal, because an item delegates its enforcement to
it. Until they exist, the dimensions they block are **`corpus_debt` against `RI-MTH06`, charged to
the absent system — never a zero against any builder.** Recorded in `TOOL-COVERAGE-R1.json` under
`corpus_debt` with owners: audio → `W1-25` (`RI-AUD01..03`); platform → unowned, needs an owner
assigned.

---

## C8: the count, and what the remainder actually is

```
at the start of this pass   : 55
now                         : 49      (0 errors from tools/corpus-index.mjs)
```

Of the 6 cleared: **3 by the path corrections ruled above**, 3 by other agents shipping
`tools/analysis/marker-scan.mjs`, `ui-census.mjs` and `ui-layer.mjs` while this pass was running.
The count is moving under the review — fourteen agents share this tree — so **49 is what I observed
at the end of this pass, not a stable figure**. Re-run `node tools/corpus-index.mjs` before quoting
it. The three cleared by me are stable; the rest are other agents' work landing.

**The remaining 49 are not 49 missing tools. One is a bug in the counter.**

`tools/harness/viewpoints.js` is a **false positive**. Every item that names it — `RI-CAM07` M1 and
its harness-dependency note, `RI-UIX01` step 3 — names `tools/harness/viewpoints.json`, which
**exists** and is a data file of canonical viewpoints, not a command. The C8 extractor at
`tools/corpus-index.mjs:403` is:

```js
const TOOL_RX = /tools\/[A-Za-z0-9_\-/.]*\.(?:mjs|cjs|js|py)/g;
```

There is no trailing boundary, so on the string `tools/harness/viewpoints.json` the engine
backtracks and matches `tools/harness/viewpoints.js`, leaving `on` unconsumed. It then reports a
phantom for a file that is present. Fix: append `(?![A-Za-z0-9])`. This inflates every C8 figure
quoted since the sweep began, including the headline 67.

**So: true C8 = 48 genuinely missing tools at the end of this pass.** I checked every remaining name
for a same-basename file elsewhere in the tree; after the three corrections, **no further path
errors remain**. The rest are real absences, and the builder's priority order for them is sound.

---

## What the builder must do to reach SATISFIED

1. **`build-viability.mjs`** — resolve the tier-5 cohort from `danger_tier == 5` and fight the
   authored group, not one enemy at a time; delete the false `regions.json declares no tier` note.
   Report the unresolved-giver count and mark those quests `unmeasurable` instead of granting the
   best reaction group in the game. Add a falsification that fails when giver-group resolution is
   broken — the current fixture floor of 200 cannot see it.
2. **`gamepad-shim.mjs`** — make it run; make it fail through `die(EXIT.…)` with a reason instead of
   an uncaught stack; flush accumulated `PASS`/`FAIL` lines before exiting on a crash.
3. **`journey-run.mjs`** — implement `--sample-quests` / `--stratified`, or delete them and mark the
   `jrn07` leg `unmeasurable`. It may not report `ok`.
4. **`cadence.mjs`** — derive `LOCOMOTION_ACTIONS` from `game/src/input/actions.js` and assert
   membership at startup. Fix the dead `analyse` export.
5. **`competence.mjs`** — an unavailable gear check must block as `unmeasurable`, not pass silently.
   Report the hp/dps spread alongside K7's tier comparison.

Each is narrow except the first. **Nothing in the accepted seven should be touched.**

---

## Provenance

Everything above is `measured`, on this tree, by me, in this pass. `node tools/harness/smoke.mjs`
PASS (6/6) before every measurement. Falsifications constructed by me and reproducible from the
descriptions given: the seven-name locomotion sweep, the three-way gear-clause comparison, the
damage-multiplier and disposition-floor sweeps, the giver-group census, the 2,000-case oracle
agreement run. Self-test results are quoted from runs I executed, not from the builder's record;
where they disagree with `orchestration/status/W1-TOOLS.json` — `gamepad-shim` 5/5 versus a hard
crash, and `md.mjs`'s usage block — the disagreement is stated rather than reconciled.

I did not `git commit`, did not run `tools/publish.mjs`, and deleted no indexed data file. The only
files I modified are the two reference items named under Ruling 1, plus this verdict and its JSON.
