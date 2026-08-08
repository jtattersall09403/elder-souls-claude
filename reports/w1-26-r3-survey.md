# W1-26 round 3 — the three things between the owner and their own game

Builder's report. Base commit `e00e6fe`; the tree moved under me repeatedly (`tools/bank.mjs`
banked my in-flight work twice, which is rule 17 §1 behaving as documented) — every number below
names the tool that produced it and is reproducible by re-running that tool.

Spec: `corpus/90-verdicts/wave1/W1-26-r2.md` (FAIL, 1.3/10). Three blocking gaps, all closed.

---

## 0. The instruments, red first

Rule 6 wants the teardown watched. All three of the verdict's acceptance tools were run on the
unmodified tree **before** anything was changed, and all three were red:

| Tool | RED at `e00e6fe` |
|---|---|
| `tools/journey/census-newgame.mjs` | exit 1 — the player's path stops at `writ.race-observed` |
| `tools/journey/name-entry.mjs` | exit 1 — `"Silt-Under-Salt"` recorded as `"il-Un"`, scene committed mid-word at the `E` |
| `tools/journey/opening-play.mjs` | exit 1 — P10 FAIL, `reached_desk false`, and P8 recorded `hatchName "il-Un-l"` in a real rAF play run |

Artifacts: `reports/w1-26-r3/red-name-entry.json`, `reports/w1-26-r3/red-opening-play.json`.

---

## 1. Creation cannot be completed — closed

**The repair, in two halves, because the verdict asked for two.**

*The census is driven from the play path.* `Engine.censusBegin()` now calls
`this.census.observe(opts.race || this.bodyRace())`. `bodyRace()` reads `sim.identity.race` — the
race of the body the player is already standing in, and the same field `_playerGates()` hands the
dialogue offer gates and `reactionTo()` hands the disposition matrix. `opts.race` still wins, so
every existing harness walk is unchanged.

The verdict was explicit that *"a hardcoded default would satisfy the test below and betray the
item"*. So the value is not a literal in `engine.js`: it lives in
`game/data/progression/creation.json` under `starting_body`, `Engine._applyStartingBody()` writes
it to the live sim at boot (before `applyNamedState`, so `--state "race=dunmer"` still overrides
it), and `bodyRace()` reads whatever is on the body at the moment the scribe looks up. When W1-07
puts a chooser in front of the title it writes the same field and nothing in the engine changes.

Two real bugs fell out on the way:

* `sim/state.js` had `identity.race = 'argonian'`, which **is not a race id in `races.json` at
  all** — `argonian` is a boolean *tag* on a race row (`saxhleel` and `naga` carry it). Every
  reader either string-compared it against a literal or resolved it to nothing.
* `Census.state()` read `n.misreads[race].line` unguarded, from the draw path, every frame the
  surface is up. A race with no authored misread was a throw inside a getter. Guarded; and all ten
  race ids are confirmed to have authored misreads.

*An engine string can no longer be drawn as dialogue.* `_censusApplyPending()` caught the throw and
put `err.message` on `censusSurface.refusal`, which `buildCensusModel()` draws as her aside. The two
are now separated: `fault` carries the exception (on the trace, on `getCensusState()`, **never** in
the model) and `refusal` carries one authored line from `writ-house.json` `refusal_line`. Absent
data means no aside at all, which is the safe direction.

**CONSUMPTION (`RI-MTH07`), on the round's load-bearing model** — `tools/w1-26-r3/w1-26-r3-verify.mjs`:

> **Model:** the race of the body the player is in (`sim.identity.race`, read at the desk by
> `Engine.bodyRace()`).
> **World-side consumer:** `Census.state()` at `writ.race-observed` composes the Warden-Scribe's
> misread line from it and the surface **draws** it; downstream `composeCharacter()` → the sheet →
> `renderWrit()` → the `Observed as:` line on the document the player carries out.

| body | what she says, drawn | the writ |
|---|---|---|
| `saxhleel` | *"Naga, then. — No. No, you are not, are you. Marsh-form…"* | `Observed as: Saxhleel` |
| `dunmer` | *"Altmer. — No, of course not, you are not tall enough…"* | `Observed as: Dunmer` |
| `khajiit` | *"Bosmer. — No. Khajiit. There is a box for that…"* | `Observed as: Khajiit` |
| `nord` | *"Orsimer. — No. Nord. In this light and at that height…"* | `Observed as: Nord` |

**coupling 1** — four bodies, four distinct drawn sentences, four distinct writs.

**Delete-the-fix, watched red.** `e.bodyRace = () => null` — the exact shape of the pre-r3 world —
and the desk throws `census: race must be observed before the scene reaches the desk` again (A4).
Restoring the exception onto `refusal` puts the engine string back on a drawn row (B3), which is
what makes B1 evidence rather than a second copy of the experiment.

---

## 2. You cannot type your own name — closed

`input/real.js` consulted the move map, then the control map, then text. A focused text field now
takes the keyboard **first**, gated on `RealInput.textFocus` — a predicate the engine sets to
`Engine._censusTakesText()`, which is exactly the test `_censusTypeChar` already made one layer
too late.

Three things it deliberately does not do, and each is load-bearing:

* it does not run when no text field is open (`textFocus` is null everywhere else), so movement in
  the world reaches the same maps on the same frames it always did;
* it does not swallow the non-printing keys. `Enter`, `Escape`, `Tab` and the arrows fall through,
  so `interact` (bound `["KeyE","Enter"]`) still commits, `Escape` is still `menu`, and the arrows
  still move the caret. `KeyE` types an `e`;
* a keydown consumed as a character records its code so the matching `keyup` cannot hand the
  pipeline an `edgeUp` for an action nothing pressed — `roll` released by typing a space.

`tools/journey/name-entry.mjs`, with a third arm added as the round's acceptance:

| typed | recorded |
|---|---|
| `Hio-Junnilo` (control, no bound characters) | `Hio-Junnilo` |
| `Silt-Under-Salt` | **`Silt-Under-Salt`** (was `il-Un`) |
| `Jekq-Vozbnu Twylfax Grimchopeds` — every letter a–z, two spaces, a hyphen | **verbatim, all 31 characters** |

The arm-C name is asserted to be a pangram by the tool itself, so it cannot silently stop being one.
**Delete-the-fix:** with `textFocus` removed the name comes back `""` and the scene commits early —
the two arms differ (C2). And in the full real-input rAF play run, `opening-play.mjs` P8 now records
`hatchName "Silt-Under-Salt"` where it recorded `"il-Un-l"` before.

---

## 3. `RI-JRN09` HF1 — `DTR 0.000` at `hold.out` — closed

`buildCensusModel()` returned null on any paused node. That is right for `hold.come-to`, which has
nothing to say, and wrong for `hold.out`, which has two authored strings on it at the moment it
pauses. The test is now **what is being said**, not what the graph is waiting for; and
`Census.enter()` clears `spoken`, so what was said in the hold is not carried a room forward.

`tools/harness/jrn09-exchange.mjs`:

| | round 2 (`d30a3de`) | now |
|---|---|---|
| `DTR_q` | 1.0000 | 1.0000 |
| `DTR_scene` | 0.9820 | **1.0000** |
| `DTR(hold.out)` | **0.000** | **1.000** (2 computed, 2 drawn) |
| worst node DTR in the scene | 0.000 | **1.000** |
| `HF1` | **fires** | **gone** — `ALL PASS`, exit 0 |

And the attribution, which is the half a DTR number cannot see (`w1-26-r3-verify.mjs` D1/D2):
her reply is drawn **at `hold.out`, in `barge-hold`, attributed to Jeeh-Ei**, and it is **not**
redrawn a room later above Tuleeh-Ma. **Delete-the-fix:** re-imposing `if (state.paused) return
null` inside `_censusSync` drops `hold.out` from 4 drawn rows to 0 (D3).

Untouched and still passing: AC 6/7, NAMED 14/14 distinct with the naming line drawn 232/232,
histogram deviation 3.00%, opaque UI area 0.1393–0.3822 against M5's 0.55.

---

## 4. A whole character, made on a keyboard

`tools/w1-26-r3/created-by-keyboard.mjs`. Every input is a real DOM key event into
`input/real.js`'s own listeners; the harness supplies only the passage of frames. No `censusBegin`,
no `censusAnswer`, no `titleActivate`, no flag, no query string.

> **Jekq-Vozbnu Twylfax** — Saxhleel, Salt-Blade, drawn on `raj-xul`, raised interior.
> Hatch-name recorded exactly as typed. Carrying the stamped writ. 11 nodes, title to stamp.

Picture: `docs/shots/2026-08-08-w1-26-r3-a-character-made-on-a-keyboard-standing-in-the-world.png`
— the finished character standing in the Writ House at Tidewrack, the wall of eleven years of other
people's reed-cases behind them, the Warden-Scribe beside them. Nothing in the frame was placed.

This also gives `RI-JRN01` M13 its keyboard leg **over the journey**, which the round-2 verdict
found had never been run — the build's existing 4/4 was taken over the title's first two button
presses.

---

## 5. A correction to the round-2 record: the walker was not pinned on geometry

Round 2 reported P10 UNMEASURED because its walker "was pinned on geometry short of the
companionway", and my own RED re-run froze at exactly `(-1.342, 0, 3.862)` and moved **0.000 m
across twenty iterations of an eight-direction sweep**.

`tools/w1-26-r3/hold-walkout.mjs` puts a body on that exact spot and pushes it in all eight
directions, **resetting the whole scene between arms**:

```
corner forward    4.816 m -> [1.9,0,0.3] (left the hold)      corner right      1.600 m
corner back       0.640 m                                     corner fwd+right  4.816 m (left)
corner left       1.600 m                                     corner fwd+left   1.599 m
corner back+right 1.599 m                                     corner back+left  1.599 m
7 distinct destinations across 8 directions
```

**The corner is not a trap.** Every direction moves. What the round-2 walker actually met was a
world that was not advancing — and its instrument could not tell "pressed into a crate" from
"nothing is running", because both are zero. `opening-play.mjs` now carries `frames_advanced` per
step and `world_was_running` on the walk, so the two can never be confused again.

**I made the same mistake inside the control written to catch it.** The first version of that
corner sweep set the scene up once and only moved the body between arms — so arm 1 crossed the
companionway trigger, the census resumed into the Writ House, and arms 2–8 all reported the
identical 4.816 m to the identical position. Eight identical numbers, not one of them an
experiment: rule 6's inert control, in the control written to detect one. Caught and repaired
before it was reported; the tool now asserts the arms are distinct.

---

## 6. `A-JRN1` — and a second cause the brief did not know about

The brief asked me to fix the bare `catch { break; }` in `tools/journey/journey-run.mjs`. Three
faults were in those five lines, and the swallow was the third:

1. `if (!st.question) break;` — `st.question` exists **only** at the ten questionnaire nodes, and
   the census opens on a paused hand-back that has none. **This loop broke on its first iteration
   of every run it has ever made.** Nothing was walked, no field was written.
2. it never released the two paused nodes.
3. `catch { break; }` on the one call that throws when the scene is broken.

Repaired: it walks every node kind, releases a paused node on the act the node names, and reports a
throw through this file's own failure idiom (`status: 'measured'`, `value.pass === false`) so a
broken scene reads **FAIL**, never **N/A**. Now: `census_walk pass`, **12 nodes reached, 7 fields
written**.

**And `m4_clause1` was still N/A after that.** The second cause:

> `sim/step.js:64` calls `bus.clear()` at the **top** of the step and `_afterStep()` builds the
> frame record afterwards. An event emitted **outside** a step — which is exactly what the harness
> verb `censusAnswer` does — is wiped by the next `stepOnce()` before any record can carry it. So
> `creation_field` reaches the trace on the **player's** path, where the commit is queued as
> `_censusPending` and applied from inside `_afterStep` strictly before the record is built, and
> **never** on the harness's. A driver in `--input-mode real` answering with the verb was taking a
> measurement its own path could not pass.

The driver presses `Enter` now, and falls back to the verb only if the press does not move the
node — recording which, so a harness answer is never mistaken for a button press. **`m4_clause1`
measures for the first time in this project**: `first_control` 141 → `first_defining` 203,
**1.03 s**.

**Read that number with its caveat, which is in the ledger row as `driver_paced: true`.** It is the
*driver's* patience, not the build's restraint: `hold.come-to` asks nothing until the player reaches
for Jeeh-Ei, so the interval is bounded by how long the driver waits. The piece's own probe measures
the same interval at 61.5 s at a human pace. The two do not disagree; they ask different questions.

---

## 7. `./play.sh`

It did not exist when I started, despite the brief. `play.sh` + `tools/play.mjs`: serves `game/`,
prints a URL, and **refuses to print one** if `game/index.html`, `game/data/index.json` or
`game/src/main.js` are missing or if any file `data/index.json` lists is off disk — a link that
serves a broken page is worse than no link. Verified: HTTP 200 on `/index.html` and
`/data/index.json`. (A `README.md` landed at the root from another agent in the same window;
between them §P.1's "one command" now exists.)

---

## 7a. `opening-play.mjs` — P10 passes, and closing HF1 turned P9 red on me

The full real-input rAF run finished after the first draft of this report:

```
PASS P1..P8      (P8 now records hatchName "Silt-Under-Salt"; the RED run recorded "il-Un-l")
PASS P10  the scene moved past the desk to 'writ.sex'
FAIL P9   1 drawn string(s) tell the player what to do:
          "Go up. The light is bad but it is light. When you are done at the desk, ..."
```

**P10 is the round's headline and it passes**: driven only through real DOM input, in play mode,
with no query string and no harness verb, the scene goes past the Warden-Scribe's desk. That is
`NEXT-DISPATCH` §P item 2's binding condition, and it had never been true.

**P9 went red on my own fix, and both instruments were right.** `hold.out`'s line opened *"Go
up."* — a bare imperative, which is precisely what P9's start-anchored `IMPERATIVE` test exists to
catch. The round-2 verdict recorded that same line, in §6, as *"Wayfinding, in fiction, and never
drawn (§4), so it costs nothing and delivers nothing"* — while §4 fired HF1 on its **absence** from
the frame. The two readings could not collide until the line was actually drawn, and drawing it is
exactly what closing HF1 required. It is not a regression in the sense of something that used to
work; it is a cost that was hidden behind a defect.

Repaired in the data. The line now says the same three things — the light up there is bad, it is
still light, come back to me — as an observation by a person rather than as a direction to a
player, and the node carries a `line_note` with the old string and this reasoning:

> *"The light up there is bad, but it is light. When they have finished writing you down, this is
> where I will be, if I am anywhere."*

Checked against P9's own two patterns at **every wrap point** (the surface wraps, and P9 tests each
drawn row): 0 rows trip either. `check-dialogue-topics` and `check-prose` are unchanged.

**Re-run status is in §8 — I did not get a clean second `opening-play` inside my window.**

## 8. What I did not do


* **I did not re-run `opening-play.mjs` to green after the `hold.out` rewrite.** The box sat at or
  over `contention.mjs`'s ceiling for the rest of my window (5–6 browser instances, 4.0–5.5 per
  core) and the probe is ~35 minutes of wall clock at 2 sim fps. So: **P10 is measured green on
  the build with the old line**, and the only change since is one authored string, verified
  node-side against P9's exact two regexes at every wrap point. **P9 green is predicted, not
  measured, and the next runner should treat it as unverified.** The command is
  `node tools/journey/opening-play.mjs`.
* **`jrn09-exchange.mjs` was queued behind the same gate** to confirm `DTR(hold.out)` still reads
  1.000 with the new string. The node still has exactly two authored strings and both still reach
  the frame by the same route, so the number should not move — but I did not watch it.
* **`RI-JRN01` M13's other three modality legs** (mouse+keyboard, gamepad, touch). Only the keyboard
  leg is now run over the journey. Pointer lock does not survive headless, which is the round-2
  reason and is still true.
* **`RI-EXP01`** — untouched. It needs a driven, isolated hour from an agent that has not read the
  item, and nothing in `orchestration/` can create that role.
* **§6's teaching clause** (*"So ask them what they do"*) — the verdict names it as a blemish with a
  one-clause remedy. Not mine this round; not touched.
* **M10** — zero `inscription` entities in the opening. Named by the verdict, not addressed.
* **The HUD on the title screen.** `journey-run --self-test` fails 13/14 on *"accessor empty before
  any surface"* (3 strings: the purse, `LIGHT`, `Spark-Da…`). **Verified not mine** — identical
  failure at `e00e6fe` in a clean worktree. It is the `journey.firstlaunch.flow` defect the round-2
  verdict named in its own §6.
* **`NEXT-DISPATCH` §Q0** (the save/load `ai` defect) — read, not touched; no stepping probe of mine
  crossed a save boundary.

## 9. Conditions and contention

`tools/contention.mjs --gate` said **WAIT** at the start (4 instances, 5.10/core against a 4.0
ceiling); I did the node-side work first and every browser run below was taken on a **GO**. One
browser at a time except for two windows where a short probe overlapped the long `opening-play`
run, which is within the 6-instance ceiling and is stated here rather than buried. Play mode
delivered **0.67–2.49 sim fps at 960×540** under `loadavg` 10–23 on four cores with other agents'
browsers resident — SwiftShader on a contended box, an upper bound on badness and not a claim about
the build's frame rate.

**One commit note.** `reports/blog-feed.jsonl` is append-only and shared, and `git commit --only`
takes the file's whole working-tree content — so my commit `60b86ad` also carries
`critic-W1-16-r3`'s blog line, which was already in the file when I appended mine. Nothing was lost
and their line is in history; it is recorded here because attribution matters more than tidiness.
The other five files in that commit are the generated ones the pre-commit hook stages itself
(rule 17 §2).
