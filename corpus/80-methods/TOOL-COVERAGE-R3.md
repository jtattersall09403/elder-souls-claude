# TOOL-COVERAGE-R3 — the tool critic's verdict on round 3

> `TOOL-LOOP.md` rule 3. A separate critic with fresh context. **I wrote none of these tools and I
> am not defending them.** My predecessors' standard is my standard, and R2 added the one that
> matters most: *every rejection is demonstrated by patching a shadow tree and booting the engine,
> not by reading source.* Every falsification below was constructed by me and every number was
> produced on this tree in this pass.
>
> **Verdict: NOT SATISFIED.** Six instruments must be rebuilt. **I broke the model detector.**

| | |
|---|---|
| Rebuild | **6** — `build-viability`, **`experience/beat-extract`**, **`journey-run`**, `session-run`, `cadence`, `decoupling` (verdict field) |
| Accept | 9 — `perf-run`, `competence`, `gamepad-shim`, `lib/absence` (+ reporters), `journey/beat-extract`, `experience/{beat-diff, isolation-check, log-lint}`, `mw-open-beats.json` |
| Worst instrument still standing | **`tools/analysis/build-viability.mjs`**, for the **third round running** |
| C8 now | **26**, 0 errors (`node tools/corpus-index.mjs`) — unchanged |
| Harness state | `node tools/harness/boot-check.mjs` **PASS** before and after every measurement. `smoke.mjs` never boots the engine and was not used. |

**What round 3 got right, and it is more than round 2 got right.** `session-run`'s capability
classifier is a genuine advance and its fail-closed fuse **fired for me, unprompted**: the surface
has grown again to **327** methods and `provinceResidency` is unclassified and therefore refused —
I verified that live, not from the builder's record. `perf-run` refuses all four R2 §3 strings,
reads the launch flags Node-side, and still discriminates. `gamepad-shim`'s entity-side check and
null control are real and its router red is exactly the failure R2 described. `competence` handles
`f ?? frame` correctly and reads the loadout from fields the trace actually emits. `decoupling`'s
red is genuine — I ran it directly and it goes HF2 on step count *and* trace hash. None of that is
in dispute and none of it is undone by what follows.

**The pattern across the six failures is one failure, and it is the round's own headline finding
turned back on it.** Round 3's best work was noticing that `cadence` and `competence` read `r.frame`
while every shipped trace numbers frames `f`. It fixed those two and did not ask how many others
there were. **There are two more, both in tools that R1 and R2 both accepted**, and one of them
does not merely mis-stamp a beat — it upgrades a hedged verdict to a confident one and cites
evidence the trace does not support. And the detector built to stop a model being hard-coded is
itself a heuristic with a seam nobody checked, which I drove a truck through.

---

## 1. `tools/analysis/build-viability.mjs` — REBUILD. Third round running. **The detector mis-detects.**

The brief called the three-anchor model detection "the cleverest thing here and therefore the most
suspect", and asked whether it detects, mis-detects, or refuses. **It mis-detects, silently, and
its own `--cross-check` confirms the mis-detection instead of catching it.**

### What the three anchors actually prove

```
installed   engine.js         /this\.questEngine\.dispositionModel\s*=/
consulted   quest/machine.js  /_dispositionToward\([\s\S]{0,800}?this\.dispositionModel/  (or a canOffer variant)
fed_to_gate quest/machine.js  /dispositions\s*:\s*this\.dispositionView\(\)/
```

Every one of them is a statement about **plumbing**. Not one of them asks the only question that
matters: *does the model function apply `derivedDisposition`?* `Engine._questDispositionModel()`
(`engine.js:4611`) is where the race arithmetic lives, and it already returns `null` for any NPC
without a `reaction_group` — so the build's real model is per-giver mixed, and a single global
`model` string is the wrong shape for it to begin with.

### The break, and it leaves all three anchors intact

On a shadow copy of the whole tree I injected one line at the top of the returned closure — a
feature flag that is off, the most ordinary regression there is:

```js
_questDispositionModel() {
  return (npcId, base) => {
    if (!this.__raceGatesEnabled) return null;   // <- injected. no anchor line touched.
```

The install line, `_dispositionToward`, and `dispositionView()` are all untouched, so **3/3 anchors
still match**. The race term is now completely dead.

| | shadow A (unbroken) | shadow B (race term dead) |
|---|---|---|
| tool: `offer_model.model` | `derived` | **`derived`** |
| tool: anchors matched | 3/3 | **3/3** |
| tool: viability | **504/540**, 36 not viable | **504/540, 36 not viable** |
| tool: failing signatures | 36 dunmer at `speaker-teel-ashaan` | **identical** |
| **engine**: distinct clause sets over 6 signatures | **6 — RACE-SENSITIVE** | **1 — RACE-INVARIANT** |
| **engine**: disposition clauses per signature | 3 / 5 / 4 / 1 / 1 / 1 | **0 / 0 / 0 / 0 / 0 / 0** |
| exit | 0 | 0 |

The engine's behaviour changed completely. **The tool's output did not change by one byte.** On the
broken tree the correct answer is 540/540 viable — the raw 50 clears the 50-bar for everyone, which
the engine confirms by emitting no disposition clause at all — and the tool charges the build **36
false FAILs**. That is R1's false pass and R2's false red in the same instrument, now reachable by
an ordinary one-line regression.

### `--cross-check` is the flagship claim and it cannot fail in this direction

The commit message and the status file both lead with *"240 (signature, giver) pairs, 0
disagreements"*. Here is that headline on the tree with the race term dead:

```
cross-check against the running gate: AGREES on 240 (signature, giver) pairs; 0 disagreement(s).
The offer path is RACE-INVARIANT: 1 distinct disposition-clause set(s) over 6 signatures.
```

Identical to the unbroken tree's headline. The reason is three lines of `crossCheck()`:

```js
const toolAtEngineTerms = (ex && ex.modelled && g.status === 'resolved') ? …  : null;
…
agrees: toolAtEngineTerms === null ? null : toolAtEngineTerms === engineValue,
…
if (row.agrees === false) disagreements.push(row);
```

When the engine stops modelling, `explainDisposition()` returns `modelled: false`, every row
becomes `agrees: null`, and **`null` is not `false`**. Zero rows are actually compared. But
`rows.push(row)` still runs, so `rows_compared` still reports **240**. The number that is supposed
to prove the static walk still describes the world is produced by comparing nothing, and reports
the same figure either way.

### The artifact contradicts itself in one screen and exits 0

`model="derived"` and `RACE-INVARIANT: 1 distinct disposition-clause set` are printed by the same
run, from the same tool, about the same tree. The tool **already holds the disconfirming
evidence** — `cc.race_sensitive` is computed and printed — and never reconciles it with the model it
detected. `RI-MTH04` is binding: an instrument that observes its own refutation and reports both as
findings has not measured anything.

### Rebuild

- **Assert `cross_check.race_sensitive === (OFFER_MODEL.model === 'derived')` and refuse when they
  disagree.** This is three lines, the tool already computes both sides, and it closes the whole
  defect. A detected model that the running gate contradicts is the *definition* of the ambiguous
  state the tool already knows how to refuse on.
- **`agrees: null` is `unresolved`, not agreement.** Report `rows_compared`, `rows_resolved` and
  `rows_unresolved` separately, and make `agrees` false — or the whole cross-check `unmeasurable` —
  when `rows_resolved === 0`. Never print "AGREES on 240 pairs" for 0 resolved rows.
- **Add a fourth anchor on the arithmetic, not the plumbing**: that `_questDispositionModel` reaches
  `derivedDisposition(`. It would have caught this break. Better still, stop treating the model as
  a global string — the build's model is per-giver, and `explainDisposition().modelled` says so
  per-giver, live.
- Minor, carried from R2 and now fixed: `--signatures` is read. Verified: `--signatures` accepts
  `all`, a race id, or a count, and an unrecognised value is a usage error.

**Consequence for scoring:** `RI-CHR01` Distinctness and `RI-CHR03` Decidability still must not be
scored from this run — not because the build lacks the mechanism (it now has it, and I confirmed
the offer path is genuinely race-sensitive on the real tree: 6 distinct clause sets over 6
signatures) but because **the instrument cannot tell a wired race term from a dead one.**

---

## 2. `tools/experience/beat-extract.mjs` — REBUILD. **Accepted 8/8 by R1 and again by R2. It has never worked on a real trace.**

The brief asked me to go looking for the `r.frame`/`f` bug's siblings, and to audit every tool for
fields it reads that no shipped artifact writes. This is the worst one, and it is worse than the
two round 3 found.

```
line 111  const f = r.frame ?? 0;                                        // the reader
line 244  const rec = (f, events, extra = {}) => ({ frame: f, … });      // the self-test's fixture
```

`--in` is documented as *"a session-run.mjs (or journey-run.mjs) directory containing
**trace.jsonl**"* — the same artifact `cadence` and `competence` read, and **every record in it is
keyed `f`**. The fixture is written by the same hand that reads it, in a dialect the engine does
not speak. That is the defect class stated exactly.

### Demonstrated: same events, two dialects

A topic named at frame 0, the item picked up at frame 100 000 — 27.8 minutes later, far outside
`RI-EXP01`'s 30-second "given" window:

| | `frame` dialect (what the self-test writes) | `f` dialect (what the engine writes) |
|---|---|---|
| beat | `given` | `given` |
| **stamp** | `f: 100000, t_min: 27.78` | **`f: 0, t_min: 0`** |
| **confidence** | **0.7** | **1.0** |
| **via** | `"previously mentioned"` | *(none — claimed as a direct hit)* |
| **evidence** | `[2]` | **`[2, 1]`** |

It is not only that every beat in every real session is stamped at minute zero — though it is, and
`beat-diff` compares beat logs by time. It is that `f - t.frame <= 30 * fps` becomes `0 - 0 <= 1800`,
**always true**, so the hedged 0.7 "previously mentioned" verdict is promoted to a **confidence-1.0
`given`** that **cites the topic line as corroboration**. The tool manufactures evidence for a
window it never checked.

The same constant-0 defeats `Math.abs(qf - a.frame) <= 60 * fps` at line 195, so `nearStage` is
always true and the `odd` detector at line 197 **can never fire**. A detector silently disabled in
a tool whose `--self-test` advertises *"prove each detector fires on a synthetic positive AND stays
silent on a synthetic negative."* It stays silent on everything.

Two further dead reads in the same function, confirmed against the census below: `r.player.region`
and `r.world.region` (line 115) are **written by no artifact**, so the `release / area change`
signature cannot fire either.

**Rebuild:** read `r.f ?? r.frame`, as `competence.frameOf()` already does; make the self-test
fixture emit the engine's dialect (or run both and assert they agree); and report `unmeasurable`
rather than 0 when no record carries a frame key at all.

---

## 3. `tools/journey/journey-run.mjs` — REBUILD (narrow). R2's *"best work"*, same defect.

R2 called this *"this round's best work"* and *"the model for the rest"*. Its `--sample-quests`
repair is genuinely good and I am not disturbing it. But it reads `r.frame` at three places, and
**events are keyed `f` too**, so the `??` fallback saves nothing:

```js
612:  for (const e of (r && r.events) || []) if (e && e.type === kind) return { ...e, frame: r.frame ?? e.frame };
648:  if (e.type === 'creation_field')                   return { frame: r.frame ?? e.frame, … };
649:  if (e.type === 'dialogue_open' && e.scene==='census') return { frame: r.frame ?? e.frame, … };
```

A real event object from a shipped trace: `{"f":61,"type":"first_input","device":"keyboard"}`.
Both operands are `undefined`.

This is latent on today's tree — no shipped journey emits `creation_field`, including
`jrn01-opening`, which I ran to check — so `m4_clause1` currently reports `unmeasurable`. **It goes
green the moment the bar becomes measurable.** On a shadow tree whose engine emits one
`creation_field`, run through the real `jrn01-opening` journey:

```json
{"id":"m4_clause1","what":"control precedes definition (seconds of available play)",
 "status":"measured","value":{"seconds":null,"threshold_s":60,"event":"creation_field"}}
```

**`status: "measured"`.** The guard is `if (fcFrame !== null && firstDefining)` and `undefined !== null`
is true, so `led.ok()` fires; `(undefined - undefined)/60` is `NaN`; `first_control_frame` and
`first_defining_frame` vanish from the artifact entirely because `JSON.stringify` drops
`undefined`. In the same run, `first_control` and `first_input` record `{"source":"trace"}` with
**no frame field at all** — on the real tree those numbers came from the driver path, which is why
nobody noticed.

M4 clause 1 is described in the file as *"the >= 60 s bar nobody has ever measured."* It still has
not been, and the tool is now positioned to report that it has.

**Rebuild:** `frameOf()` as `competence` has it; guard on `Number.isFinite`, not `!== null`; and
`led.unmeasurable` when the frame cannot be read.

---

## 4. `tools/experience/session-run.mjs` — REBUILD (narrow). The name list is fixed. The **door** is not.

The capability work is real and I verified it rather than taking it: the surface is **327** methods,
`first-hour` refuses **108**, all ten of R2 §8's bypasses are refused and recorded, and the
fail-closed fuse fired live for me on `provinceResidency`. `--audit-surface` prints the whole
classification, which is exactly the reviewable shape rule 3 asks for. Keep all of it.

**But prohibitions are installed on one object, and the game publishes two.** `game/src/main.js:24`:

```js
window.__ENGINE = engine;
```

`__HARNESS.spawnNPC` is a wrapper over `Engine.spawnNPC` (`engine.js:1179`). I installed the
first-hour refusal set **verbatim as `session-run.mjs:511` installs it**, then knocked on both doors:

```
surface 327 methods, first-hour refuses 108
n_before                       : listNPCs() -> 0
__HARNESS.spawnNPC(…)          : refused: "__HARNESS.spawnNPC() is refused under this session profile."
n_after_front                  : 0                                    <- front door holds
window.__ENGINE.spawnNPC(…)    : SPAWNED {"eid":"critic-ghost-2","kind":"npc","name":"Side Door",…}
n_after_side                   : 1                                    <- an NPC is standing in the world
violations recorded            : 1                                    <- only the refused one
window.__ENGINE.setTimeOfDay(3): SET                                  <- a second refused capability
```

This is R2 §8's result reproduced exactly — *"the run completes, records no violation, and is
certified as a clean first-hour session with an agent-authored NPC standing in it"* — through a
door the rebuild did not close. Round 3 fixed the **name** list where the item meant a capability
list. It did not fix that the enforcement is a property of **one global** where the item means the
build's mutating surface: `RI-EXP01`'s own words are *"ANY INVOCATION VOIDS THE RUN."*

The tool's own self-test check — *"cannot be bypassed by calling `window.__HARNESS` directly"* — is
scoped correctly and passes. It is the scope that is wrong.

**Rebuild:** enumerate the page's own capability-bearing globals (`__ENGINE`, `__ES_THREE`, and
whatever `main.js` publishes next) and install over all of them, or — better, and the change worth
asking the harness for — have the build gate the capability at the Engine method, so there is one
choke point and `__HARNESS` is merely one caller. Fail closed on a global that appears and is not
classified, exactly as the method classifier already does. *(Lesser note carried from R2 and still
true: a reference captured before install still works.)*

---

## 5. `tools/journey/cadence.mjs` — REBUILD (narrow). The fix for the field bug contains the field bug.

The `f` repair is real and I confirmed it on the real trace: `duration 600s, gap_max 300s from
records keyed f`. C7 now measures traversal from `player.speed_mps` / `player.pos`, C1's free pass
for toggles is gone, and the twelve-action sweep behaves. On
`reports/journeys/w1-13-jrn06` it fails honestly and reports C4/C9/C10 as `N/A` with reasons. Good.

**But `FLAG_FIELDS` ships this comment:**

> *"These are fields the shipped trace record actually carries (verified against
> `reports/journeys/**/trace.jsonl`)"*

I ran that verification. **78 artifacts, 164 168 records:**

| | field | in the corpus |
|---|---|---|
| ✓ | `player.locked_on` | 131 066 records / 51 artifacts |
| ✓ | `player.stance` | 78 906 / 20 |
| ✓ | `player.guard_raised` | 78 906 / 20 |
| ✓ | `player.weapon_id` | 78 906 / 20 |
| ✓ | `player.attuned` | 79 326 / 22 |
| ✓ | `player.levitating` | 79 326 / 22 |
| ✓ | `player.state` | 131 066 / 51 |
| **✗** | **`player.two_handed`** | **no artifact writes it** |
| **✗** | **`player.crouched`** | **no artifact writes it** |
| **✗** | **`ui.menu_open`** | **no artifact writes it** |
| **✗** | **`ui.dialogue_open`** | **no artifact writes it** |
| **✗** | **`ui.surface`** | **no artifact writes it** |

**No trace record in this tree carries a `ui` subtree at all.** Five of twelve, under a claim of
verification, in the file that made "a field nothing writes" the finding of the round.

The direction of harm is the conservative one — these are OR terms for corroboration, so their
absence makes C1 harder to satisfy, not easier — and the menu path survives independently through
`surface_enter` events (C8 read 0.0003 on the real trace, not a structural 0). So this is a **false
provenance claim** rather than a broken measurement, and that is why this is narrow rather than a
rejection of the instrument. But `RI-MTH07` §D.3 is the governing line and R1 quoted it: *a comment
asserting a check is not a check.* Correct the claim or wire the fields; `player.stance` already
covers two-handing and `player.stealth` covers crouching, both under names the trace uses.

---

## 6. `tools/platform/decoupling.mjs` — REBUILD (the verdict field only). The instrument is sound.

The measurement is real and I re-ran both halves. The red genuinely goes red — run directly at
`--break-decoupling --sim-frames 60`:

```
FAIL m6_step_count   HF2 — the simulation step count changes with the render rate.
FAIL m6_trace_hash   HF2 — the trace body hash changes with the render rate.
FAIL m7_frame_rate_independence
rate 60 -> 60 steps … rate 0 -> 61 steps, body_sha256 892988b1… (vs 5b7520b9… at every other rate)
```

And green on the clean build: 600 steps at every rate, one hash, renders 600/300/150/0.

**The defect is that the shipped artifact of record says `pass: true` for a bar that was not met.**
`reports/platform/decoupling.json`:

```json
"sim_frames_per_rate": 300,  "m6_asks_for": 3600,
"verdict": {"m6_step_count": {"pass": true, "expected": 300, …}},
"pass": true, "hard_fails": []
```

M6's threshold is *"**Exactly 3 600 steps** at every rate"*. This ran **300 — 8.3 % of the
specified duration** — on a **substituted scenario**, and set `expected` to whatever it happened to
run. The shortfall is declared twice elsewhere (`m6_asks_for`, and a console `NOTE:`), which is
why this is narrow and why I am not calling the instrument dishonest. But `TOOL-LOOP.md` rule 4 is
the whole point of this loop: *"a number on that page means something."* A consumer reading `pass`
on a **10-point** item — the largest single entry in the 26-point sim-integrity axis — gets a green.

**Rebuild:** carry the deviation into the verdict. `meets_item_duration: false` and a `pass` that
is not `true` when `sim_frames_per_rate < m6_asks_for` or the scenario is substituted. Then run it
once at `--sim-frames 3600` on a quiet box and publish that as the M6 figure of record.

**Also recorded, not charged:** `--self-test` did not complete in two attempts — once crashing with
`page.evaluate: Target page, context or browser has been closed` at load 19, once still unfinished
after ~28 minutes at load 5. It runs eight full browser sweeps. A falsification a critic cannot
re-run is a falsification on trust; cap the self-test's step count.

---

## 7. The tools I accept

| Tool | evidence |
|---|---|
| `platform/perf-run.mjs` | **11/11.** All four R2 §3 strings REFUSED. Launch flags read Node-side: a page claiming an RTX 4070 is refused when the runner passed `--use-angle=swiftshader`. `attestation_contradicts_environment` fires. Null control: a clean environment does not refuse. `verdicts: [false,false,false,false,true,false]` — it discriminates. Manifest mode exits non-zero either way, so the escape hatch cannot mint a Tier-H pass. **Accept.** |
| `journey/competence.mjs` | **13/13.** `frameOf(r) { (r.f ?? r.frame) ?? 0 }` — handles both dialects; all other `.frame` reads are on its own constructed objects. `loadoutFrom()` reads the fields the trace emits. Blocks at `NO_AI`/`NO_ENCOUNTER_PAIR` on the real trace with named owners. **Accept**, with the stance ruling below. |
| `journey/gamepad-shim.mjs` | **12/12.** Entity-side check (5.44 m), null control (0.00 m drift with the rAF loop live), and the router red in which all eight input-layer checks stay green while the player moves 0.00 m. **Accept.** *Note, not charged:* the check is `dist(p0,p1)` — a scalar. A router with inverted axes, or one that walks a fixed heading regardless of stick direction, passes green and control both. Assert the **direction**, not just the distance. |
| `lib/absence.mjs` + 12 reporters | `needs` is validated against the live surface and the amendment register; `parseDeclaredSystems()` is exported so a critic can run it; `ARRIVED` requires a positive-evidence probe. The invented names R2 catalogued are gone. **Accept.** *Declared limit:* I re-ran the reporters and read the library; I did **not** independently reconstruct all six of the builder's falsification cases. |
| `journey/beat-extract.mjs` | **6/6.** No `.frame` read at all — audited. Still refuses to write the committed reference file. **Accept.** |
| `experience/beat-diff.mjs` | **9/9**, no dialect defect. **Accept** — but see §2: it consumes beat logs whose every timestamp is currently 0. |
| `experience/isolation-check.mjs` | **6/6.** **Accept.** |
| `experience/log-lint.mjs` | **8/8.** **Accept.** |
| `corpus/88-journeys/data/mw-open-beats.json` | unchanged, still committed once. **Accept.** |

---

## The field audit, in full

The brief asked for a census of fields tools read that no shipped artifact writes. I built one over
**every `.jsonl` under `reports/` — 78 artifacts, 164 168 records** — and audited every
artifact-consuming tool against it.

| finding | tool | status |
|---|---|---|
| `r.frame ?? 0` (records are keyed `f`) | `experience/beat-extract` | **§2, REBUILD** |
| `r.player.region`, `r.world.region` — no artifact writes either | `experience/beat-extract` | **§2, REBUILD** |
| `r.frame ?? e.frame` — records **and** events are keyed `f` | `journey-run` | **§3, REBUILD** |
| 5 of 12 `FLAG_FIELDS` written by nothing | `cadence` | **§5, REBUILD** |
| `player.loadout` — still written by nothing, correctly demoted to a fallback | `competence` | fixed, accept |
| `f ?? frame` handled | `competence`, `cadence` | correct |
| no `.frame` reads | `journey/beat-extract`, `beat-diff`, `log-lint`, `isolation-check` | clean |
| reads the live harness, not artifacts | `perf-run`, `decoupling`, `session-run`, `gamepad-shim`, `absence` | class does not apply |

Two notes for whoever holds the corpus. `frame` **does** appear in the tree — in `ui-text.jsonl`,
never in `trace.jsonl` — which is how three tools came to read it. And the trace vocabulary is
narrower than the tools assume: across three real traces the only event types emitted are
`first_input`, `first_control`, `surface_enter`, `input_dropped`/`INPUT_DROPPED`. `dialogue_open`,
`creation_field` and `input_action` are all in `sim/events.js` and all emitted by `game/src`, but no
shipped journey has produced one. **A single documented trace-record schema, versioned, would have
prevented four of the six rebuilds in this document.** That is the highest-value thing this loop
could produce next, and it is worth more than any individual tool fix.

---

## The judgement call: `stance` is reported but does not void a competence comparison

**Ruled: the line is right. The reporting behind it is not, and one thing the item asks for is missing.**

**Upheld, on the item's own words.** `RI-JRN02` §C line 141 bans *"no **equipment upgrade** between
them"* and M-I9 asks for *"**identical equipment**"*. Two-handing a sword is the same sword. It is a
grip, chosen and unchosen many times inside a single fight, not a shopping trip. A clause that
voided on it would return `void` on every real fight — R2's *"cannot pass"* failure in a different
coat, and the exact defect this round was convened to remove. The builder flagged it rather than
burying it, which is the behaviour rule 3 wants. **Not a bar quietly relaxed.**

**Two corrections it does not get to skip.**

1. **As reported, the flag is close to meaningless.** `stance` is sampled at *one record* in each
   encounter window, and it is a per-frame value that flips throughout a fight. Diffing two
   instants of a fast-varying quantity is noise: `"one_handed" -> "two_handed"` says nothing about
   whether the player actually fought two-handed *more* at `E_late`. Two-handing **is** a real
   competence confound — more damage, different moveset, different poise — so the honest form is a
   **fraction over each window** (`player.stance` is on 78 906 records across 20 artifacts, so the
   trace supports it today). As a fraction it becomes evidence. As a single-frame diff it is
   neither a blocker nor evidence, and it should not be presented as a finding.
2. **The item's own remedy is not offered.** M-I9 does not say "void" and does not say "proceed"
   when equipment differs — it says *"re-run `E_late` with `E_first`'s loadout via `loadState`"*.
   `competence` offers neither the re-run nor a note that it is skipping it. **File this as a
   corpus conflict, because it is one:** `loadState` is classified `load-state` and **refused by
   `session-run`'s `first-hour`, `ending` and `build-identity` profiles**. One item prescribes a
   remedy another item prohibits. Somebody must rule on which wins; it is not the tool builder's
   call and it should not be settled by silence.

---

## The three referrals

### Referral 1 — `RI-PLT01` M6 names scenario **F3**, which has no file. **The scenario must be authored.**

`decoupling` substitutes `cmb-duel-infantry` and declares it on every run, in the artifact and in
the header. Declaring is the minimum honesty and it is why this is a narrow rebuild and not a
rejection. **But declared is not the same as discharged, and this substitution is not neutral.**

F3 is *"boss arena, 1 boss, active fight"*. The substitute is *"player vs one INFANTRY trash enemy
on flat ground"*. The artifact defends the swap with a bare assertion — *"the property M6 tests is
not sensitive to which fight is running"* — which is a hypothesis, not a measurement, and it is the
hypothesis most likely to be wrong: sim/render coupling surfaces under **load and complexity**,
which is precisely what a boss arena has and a flat-ground trash duel does not. Substituting the
quiet scene is a substitution in the **permissive** direction, and R1 ruled on exactly that shape.

It is also authorable. There are ten scenario files, the schema is small, and the content exists —
`build-viability`'s own tier-5 census names a shipped champion cohort,
`gate-drowned-xanmeer:1xchampion_hist_marked`. **Ruling: author F3 from shipped content and re-run
M6 against it at `--sim-frames 3600`.** A declared substitution renewed every round on a 10-point
item is how a bar relaxes without anyone deciding to relax it. Until then M6 is `corpus_debt`
against **content**, not a pass. Charged to content, not to the tool and not to the builder — the
declaration was the right thing to do.

### Referral 2 — `renderRateHz` is two-state, so the tool drives the render cadence itself. **A valid measurement, not a tautology — with a limit that must be stated.**

**Not a tautology, for a reason the tool can prove.** The render counts are not the tool's own
arithmetic played back: `renders_observed` is `after.rendersTotal - before.rendersTotal`, read from
the **engine's** `loop.stats.rendersTotal` (`core/loop.js:165`). If the engine failed to render, the
counter would say so. And the perturbation is genuinely four different things — one render every 1,
2, 4 and ∞ fixed steps — which is a real variation in the sim/render interleaving, applied through
the engine's own `engine.js:3212` path. The **measured** quantity is `body_sha256` invariance across
those four interleavings, and that is exactly HF2. I confirmed the control is not vacuous: the
broken build changes both the step count (61 vs 60) and the hash.

**The limit, which is real and should be stated more loudly than it is.** Because `renderRateHz` is
two-state on `stepFrames`, the sweep never exercises the thing that consumes the rate *as a rate* —
`core/loop.js`'s rAF loop, which in harness mode neither steps nor draws. So M6 as measured covers
the **interleaving** axis in **harness mode**, and the **shipping render path is not tested at
all**. The tool says the rAF loop "neither steps nor draws"; it does not say the consequence, which
is that a decoupling defect living in the production scheduler would pass this sweep. Add that
sentence to `declared_substitutions` and the measurement stands.

### Referral 3 — the undischarged Tier-S halves. **A split ruling: declaring is enough for one and not the other.**

Both `hitch-census` and `load-run` now name the quantity, say why their ABSENT verdict does not
cover it, and name an owner. That is a genuine improvement — it converts an invisible gap into a
named debt and stops the ABSENT verdict from reading as coverage. But R2's ruling was *"refuse the
Tier-H number, **measure** the Tier-S quantity"*, and whether a declaration discharges that depends
entirely on whether the measurement is blocked.

- **`hitch-census`, P5/P6 (GC counts and attribution): declaring IS enough.** It needs
  `__HARNESS.forceGC()` and heap access. Those are genuinely absent, and — this is the part that
  makes the declaration trustworthy — `lib/absence`'s rebuilt `needs` validation now traces that
  absence to a **named amendment (A-JRN9)** in the register rather than to a builder's guess. That
  is precisely what `corpus_debt` is for. **Accept as declared. Owner: A-JRN9, not "tool round 4."**

- **`load-run`, P9 (`body_sha256` cold vs warm): declaring is NOT enough.** The measurement is
  **unblocked today**, and its sibling proves it. `decoupling` computes `body_sha256` itself
  (`hash.digest('hex')` over drained trace records) using only `traceStart`/`traceDrain`/`reset` —
  all live, no absent harness method, no attested hardware. `load-run`'s own `why_not_here` concedes
  the point: *"The hash comparison needs no attested hardware."* An owner of *"tool round 4"* on
  work that is already unblocked is a deferral, not a debt. **Must be measured. It is a small delta
  on a path that already ships in this repo.**

---

## C8

```
node tools/corpus-index.mjs   →  26 phantom tools, 0 errors
```

**26, unchanged from R2**, which is correct — all six tools in this round's rebuild list already
exist on disk, so no warning could clear or open. R2's carried warning still stands and I renew it:
**a cleared C8 warning is not a capability.** `RI-CMP03` step 2 still carries `PATH CORRECTED,
CONTRACT STILL OPEN` — `build-viability` has no `--chains` mode — and the twelve absence reporters
that cleared twelve warnings still measure nothing, correctly and honestly. The Build status page
must not read any of those thirteen as coverage.

---

## What must happen to reach SATISFIED

1. **`build-viability.mjs`** — reconcile `cross_check.race_sensitive` against the detected model and
   refuse on disagreement; make `agrees: null` `unresolved` rather than agreement, and never print
   "AGREES on N pairs" when 0 rows resolved; add an anchor on `derivedDisposition` being *called*.
2. **`experience/beat-extract.mjs`** — read `r.f ?? r.frame`; make the self-test fixture speak the
   engine's dialect; drop or rename the dead `player.region` / `world.region` reads.
3. **`journey-run.mjs`** — `frameOf()`; guard on `Number.isFinite`, not `!== null`.
4. **`session-run.mjs`** — install over every capability-bearing global (`__ENGINE` at minimum), or
   move the gate into `Engine`; fail closed on an unclassified global.
5. **`cadence.mjs`** — correct the `FLAG_FIELDS` provenance claim; use `player.stance` and
   `player.stealth`, which the trace writes.
6. **`decoupling.mjs`** — carry the scenario substitution and the 300-of-3600 shortfall into the
   `pass` field; publish an M6 figure at `--sim-frames 3600`; cap the self-test so a critic can
   re-run it.

**Nothing in the accepted nine should be touched.** `session-run`'s capability classifier is this
round's best work and is the model for the rest — a derivation from the live surface, a fuse that
fails closed, and an `--audit-surface` mode that publishes the whole classification for a critic to
attack. It is exactly right, and it is let down by being bolted to one of the page's two doors.

---

## Provenance

Everything above is `measured`, on this tree, by me, in this pass.
`node tools/harness/boot-check.mjs` **PASS** before and after — noted because `smoke.mjs` never
boots the engine, which is how a broken build once passed every check here.

Falsifications constructed by me and reproducible from the descriptions given: the injected
`_questDispositionModel` half-wire on a full shadow tree, with the tool run and the engine booted on
**both** trees and the six-signature clause-set sweep as the discriminator; the `--cross-check` null-row
demonstration; the 78-artifact / 164 168-record field census and the twelve-field `FLAG_FIELDS`
audit; the two-dialect `beat-extract` fixture showing the confidence upgrade from 0.7 to 1.0 with
fabricated evidence; the shadow-tree `creation_field` emission driven through the real
`jrn01-opening` journey, producing `status: "measured", seconds: null`; the `window.__ENGINE`
bypass of `session-run`'s first-hour profile with the prohibition block installed verbatim; the
live `--audit-surface` confirmation that the fail-closed fuse refuses `provinceResidency` at 327
methods; and the direct `--break-decoupling` run at 60 steps.

Self-test results are quoted from runs I executed, not from the builder's record. Where I could not
complete a run — `decoupling --self-test`, twice — I say so rather than quoting the builder's
figure. Where I did not independently reconstruct a falsification — `lib/absence`'s six cases — I
say that too.

Shadow trees were built under `scratchpad/r3/shadow{A,B,C}/`; **`game/data` and `game/src` on this
tree were not modified.** I did not `git commit`, did not run `tools/publish.mjs`, and deleted no
indexed data file.
