# Unjudged-backlog triage — what the 96 "finished but unjudged" pieces actually are

**Task:** `unjudged-triage-20260814`. **Date:** 2026-08-14. **Branch:** `codex/wave1-build-experiment`.
**Population:** the 96 rows `node tools/dispatchable.mjs` prints under *FINISHED BUT UNJUDGED — dispatch a
CRITIC, not a builder*, read in full, every one of them, against its status file, the verdict corpus,
`orchestration/NEXT-DISPATCH.md` and `git log`.
**Authority:** `OWNER-DIRECTIVES-2026-08-14.md` §8 (*"Builders have run without critics… none has been
judged. Sorting that into a sound sequence is an explicit part of the handover"*) and §9 (*"far, far below
the 7/10 wave 1 bar in virtually every respect"* while the dashboards read green).
**Model:** `orchestration/audits/PLAN-AUDIT-2026-08-14.md`, deliberately — same shape, same discipline of
reporting what was cleared as loudly as what was found.

**This audit judges nothing and re-runs no piece's work.** Triage is cheap precisely because it is not
grading. Where a piece needs grading, that is a *dispatch*, and it is in `NEXT-DISPATCH.md` §UNJUDGED-Q.

---

## The finding that outranks every per-piece finding

**Sixteen of the ninety-six are pieces a critic should judge. The other eighty are already answered,
answered elsewhere, or need something that is not a critic.**

The list is not a backlog of ungraded builds. It is four different things wearing one label, because
`tools/dispatchable.mjs` asks one question — *does a scored verdict JSON exist whose `piece_id` matches
this task id?* — and that question has no correct answer for most of the population:

| what it actually is | count | who already judged it, or why nobody should |
|---|---|---|
| **Meta-work: plans, plan critiques, arbitrations, audits, blog posts** | 44 | Judged by the plan loop, by an arbiter's ruling, or not judged at all because a blog post has no bar. Nineteen of these **are critics themselves.** |
| **Corpus/bar authoring from the 2026-08-06 "build the bar first" wave** | 18 | Judged by `BAR-CRITIQUE-01/02`, `BAR-CRITIQUE-IMAGES-01..04`, `ACQUISITION-CRITIQUE-R1/R2`, `INTENT-AUDIT-01/02`. A different loop, on disk, with verdicts. |
| **Tool-loop pieces** | 6 | Judged by `corpus/80-methods/TOOL-COVERAGE-R1..R4` and `CAPTURE-SERVICE-R1`. |
| **Already judged under a longer verdict name** | 8 | The tool's matching key is truncated. See the defect below. |
| **Needs a builder, a plan round, an arbiter or a one-line fix — not a critic** | 4 | Named individually in §4. |
| **Genuinely unjudged, and a critic is the right dispatch** | 16 | §2 and §3. |

**Eighty of ninety-six clear.** That turns an impossible backlog into a queue of sixteen, of which the top
eight are worth dispatching this tick.

### The one-line tool defect that manufactured eight of the false rows

`tools/dispatchable.mjs:~120` builds the verdict lookup key with

```js
const key = (id.toLowerCase().match(/^(w\d+-[a-z0-9]+)/) || [, id.toLowerCase()])[1];
```

`[a-z0-9]+` stops at the first hyphen, so a piece whose name has two words is looked up under its first
word only. `W1-LIBRARY-MARTIAL` is looked up as `w1-library`; `W1-ATTR-SCALE` as `w1-attr`;
`W1-PROSE-TICS` as `w1-prose`. None of those keys exists, so all three report unjudged **while their
verdicts sit on disk** — `W1-LIBRARY-MARTIAL-r4.json` (5.4), `W1-ATTR-SCALE-r1.json` (0),
`W1-PROSE-TICS-r4.json` (4). The same truncation hides `W1-23`'s three verdicts behind
`w1-23-lore-registry-and-the-provinces-canon`, and `province-stream-pump`'s behind
`w1-01-province-stream-pump`.

**The fix is one character class**, and it is a *wiring* dispatch, not a critic:
`/^(w\d+-[a-z0-9-]+?)(?:-r\d+)?$/` matched against the verdict's own `piece_id` prefix rather than the
first segment. I have **not** made this edit: `tools/dispatchable.mjs` is read by every dispatch decision
in the project and Ruling O1 binds an ownership check before writing into a shared file. Named, with the
exact line, so whoever owns it can do it in a minute.

Note the symmetry with `PLAN-AUDIT`'s finding. That audit found one unpropagated directive masquerading as
thirty plan defects. This one finds one truncated regex and one loop-boundary assumption masquerading as
eighty ungraded builds. **Neither list was ever as long as it read.**

### The sub-piece trap, checked and not fallen into

The brief warned that `W1-01-province-stream-r1` is a *sub-piece* of the province streamer, not round 1 of
`W1-01`. Confirmed by reading the verdict: its `piece_id` is `w1-01-province-stream-pump`, and the task it
judges is `province-stream-pump`, which is in this population and is therefore **cleared, not owed a
critic**. Nothing in this triage treats it as a `W1-01` round, and nothing in this triage treats a `-r<N>`
tail as a sub-piece.

---

## 1. What I cleared, and why it counts

Reporting the clearances is more than half the value here, because each one is a critic that does **not**
need dispatching.

### 1a. Meta-work — 44 rows, and nineteen of them are critics

`dispatchable.mjs` excludes a row from the unjudged bucket when its id matches
`/(^|-)(critic|judge)(-|$)/`. The word *critique*, the word *audit*, the word *arbiter*, the word
*reviewer-editor* and the compound `plancritic` all miss that regex, so nineteen documents whose entire
job was to grade something else are sitting in the queue to be graded.

- **Plan-loop rounds (20):** `codex-remediate-w1-29-17-06-20260809`,
  `codex-review-edit-w1-04-w1-23-w1-15-w1-25-20260809`, `codex-wave1-reviewer-editor-07-28-13-21-20260809`,
  `critique-w1-17-06-03-26-codex-20260809`, `plan-review-editor-w1-13-w1-21-w1-10-independent2-20260809`,
  `plan-wave1-18-19-25-20260809`, `remediate-wave1-21-10-08-20260809`,
  `review-edit-w1-10-08-00-14-codex-20260809`, `w1-plan-review-editor-23-12-01-24-codex`,
  `W1-24-arbiter-editor-20260809`, `W1-24-reviewer-editor-final-20260809`,
  `W1-24-reviewer-editor-s45-s47-20260809`, `W1-30-animation-amendment-codex-20260811`,
  `W1-30-reviewer-editor-20260812`, `plan-w1-hud-toast`, `measure-quoted-e-w1-hud-toast-b`,
  `PLAN-COST-EXPERIMENTS`, `COST-INSTRUMENT-plan`, `COST-INSTRUMENT-plancritic`,
  `decomposition-architect`.
  **A plan is judged by a reviewer-editor round, and every one of these already had one or is one.**
  `PLAN-AUDIT-2026-08-14.md` is the live statement of which of those plans needs another round; it names
  eight, and none of them is closed by sending a *build* critic at the planning task that wrote it.
- **Audits, arbitrations and registries (14):** `arbiter-s39-duration-clock` (its product is ruling S39,
  landed in `ARBITRATION.md`), `plan-audit-w1-verdict-shape` (the very document this audit is modelled on),
  `corpus-audit`, `intent-audit-02`, `bar-critique-02`, `verdict-evidence-20260814`, `verdict-staleness`,
  `BAR-AUDIT-WORLD-20260814`, `OWNER-REPORTING-20260814`, `COST-REORIENTATION`, `ownership-registry`,
  `wave1-prep`, `rebase-s22`, `souls-verification`.
- **Blog posts (10):** `blog-2026-08-07-b/c/e/g`, `blog-2026-08-08-a/b/c/d/e/f`. A published post is not a
  build. Directive §5 changed how these are *written* (twice-daily roundup, warm register, the old
  sarcastic tone banned) — that is a standing instruction to future writers, not a critic dispatch against
  ten posts that are already up.

### 1b. Corpus and bar authoring, 2026-08-06 — 18 rows, judged by the bar-critic loop

`experience`, `journeys`, `magic`, `parley`, `travel`, `weapons`, `character-stealth-crime`,
`opacity-tone`, `temporal-refs`, `uesp-mining`, `image-acquisition`, `image-acquisition-modern`,
`audio-ui`, `holes`, `vis-metrics`, `acq-code-loop`, `ref-builder-r1`, `ref-builder-r2`.

Every one of these wrote **corpus reference items**, not game code — their `outputs_written` are
`corpus/87-audio/RI-AUD01…`, `corpus/50-world/RI-WLD10…`, `corpus/70-visual/refs/…`. They belong to the
project's first method line, *build the bar first*, and they were graded by a critic loop that predates
the wave-1 verdict schema: `BAR-CRITIQUE-01` and `-02` (the second reads *"Scope: all 137 reference items
across 20 corpus areas, 323 subsystem paths"* and returns **SUFFICIENT**, 12 of 15 gates met),
`BAR-CRITIQUE-IMAGES-01..04` on the acquisition prompt, `ACQUISITION-CRITIQUE-R1/R2` on the reference
builders, `INTENT-AUDIT-01/02` on intent drift. **These are judged. A wave-1 build critic sent at one of
them would be grading a markdown item against a game bar.**

The live question about this corpus is a different one and it already has an owner: Directive §6 and
Ruling W1 say the *bar itself* can be wrong by omission, and `BAR-AUDIT-WORLD-20260814` (in this same
population, §1a above) is the piece that acted on it.

### 1c. Tool-loop pieces — 6 rows, judged by TOOL-COVERAGE and CAPTURE-SERVICE

| piece | its verdict | state |
|---|---|---|
| `W1-TOOLS` | `corpus/80-methods/TOOL-COVERAGE-R1.md` (*"the twelve instruments of round 1"*) | judged |
| `W1-TOOLS-r2` | `TOOL-COVERAGE-R2.md` (*"round 2"*) | judged |
| `W1-TOOLS-r3` | `TOOL-COVERAGE-R3.md` (*"round 3"*, NOT SATISFIED, six rebuilds) | judged |
| `tool-builder-r4` | `TOOL-COVERAGE-R4.md` | judged |
| `tool-build-viability-r5` | `TOOL-COVERAGE-R4.md`, whose title is literally *"the tool critic's verdict on **round 5** of `build-viability`"* — NOT SATISFIED for the fifth round running | judged, **and round 6 is already in flight** (`tool-build-viability-r6`, researching) |
| `W1-CAPTURE` | `corpus/80-methods/CAPTURE-SERVICE-R1.md` (*"the critic's verdict on the shared capture service"*, NOT SATISFIED, 7 rebuilds) | judged |

`capture-service-r2` — the rebuild that answered `CAPTURE-SERVICE-R1` — has **no R2 verdict** and is the
one genuine gap in this loop. It is in the queue at §3.

### 1d. Already judged under a longer verdict name — 8 rows

Pure artefacts of the truncated key, each verified by opening the verdict:

| piece | verdict on disk | score |
|---|---|---|
| `W1-08-W1-29-r2` | `W1-08-W1-29-r2.json` | 6 |
| `W1-23` | `W1-23-r1/-r3/-r4.json` (piece_id `w1-23-lore-registry-and-the-provinces-canon`) | 5 → 4 → 4, **and `critic-w1-23-r5` is measuring right now** |
| `W1-ATTR-SCALE` | `W1-ATTR-SCALE-r1.json` | 0, **and `critic-w1-attr-scale` is running** |
| `W1-LIBRARY-MARTIAL` | `W1-LIBRARY-MARTIAL-r4.json` | 5.4 (round 4 — the same round the status file hands over) |
| `W1-LIBRARY` | `W1-LIBRARY-r1.json` | 3 |
| `province-stream-pump` | `W1-01-province-stream-r1.json` | 5 |
| `W1-PROSE-TICS` | `W1-PROSE-TICS-r4.json` (4) **and** closed by the BLIND-PACK-GATE ruling | see below |
| `W1-PROSE-R2` | as above | see below |

**The two prose rows deserve the extra sentence, because both status files ask for a judge and both asks
are already refused in writing.** `W1-PROSE-TICS` says *"TWO packs await a round-2 judge"* and `W1-PROSE-R2`
says *"reports/packs/prose-tics-r4/ awaits a FRESH judge"*. `NEXT-DISPATCH.md` §BLIND-PACK-GATE **Ruling 4**
answers both: *"r2, r3 and r4 are CLOSED as superseded, not awaiting a judge. Each carries a
`SUPERSEDED.md`… **Do not spend a judge on any of them.**"* I confirmed `reports/packs/prose-tics-r2/SUPERSEDED.md`
exists. The only live prose dispatch is a fresh judge for `reports/packs/prose-tics-r5/`, which that ruling
already specifies and which is **not** in this population.

This is the clearest instance in the whole backlog of the pattern the brief predicted: a status file's
`next_step` is a snapshot of what its author believed on the day, and a later ruling can retire it without
ever touching the file.

---

## 2. The sixteen that are genuinely unjudged

Established for each: **(1)** no verdict exists under any name; **(2)** whether anything in the running
game consumes its output; **(3)** whether the bar a critic would judge it against survived 2026-08-14.

**On question 2, the headline is reassuring and worth saying plainly: `RI-MTH07`-style orphaning is not
this backlog's failure mode.** I grepped the shipped tree for each piece's declared consumer and found
them live — `opacity` appears 30 times in `engine.js`; `render/actor.js` is imported by `scene.js` and
`renderer.js`; `dialogue/topics/07-root-coverage.json` is registered in `game/data/index.json`;
`_streamProvince` is called 10 times from `engine.js`; `save/fight.js` is imported by `combat/ai.js`;
`quest-givers` and 26 `books/` paths are in the data index. **Not one of the sixteen is an orphan.** The
gap between a green status file and the owner's §9 experience is therefore *not* "nothing reads it" — it
is quality, and that is exactly what a critic measures and a census does not.

| # | piece | consumed by the running game? | bar still live? | why a critic changes a decision |
|---|---|---|---|---|
| 1 | `W1-30-GPU-CAPTURE` | yes — `tools/visual/gpu-deck.mjs`, `deck-motion.mjs`, four `vt-*` tools | yes, and it *is* the §2 remedy | **Six other pieces' evidence flows through it.** |
| 2 | `W1-RENDER` | yes — `actor.js` imported by `scene.js`, `renderer.js` | yes; acceptance written in `NEXT-DISPATCH` §1old | If it did not land, every visual verdict since is suspect |
| 3 | `W1-GIVER-PRESENCE` | yes — `quest-givers.json` in the data index; `build-giver-posts.mjs` | yes (`W1-19` bar, unmoved) | Closes `W1-19-r2`'s top open defect; hands on a **boot-time throw** |
| 4 | `W1-24-builder-codex-20260810` | yes — `reports/w1-24/` + `viewpoints.json` | **partly — plan carries a stale premise** | W1-24 has **never** been judged and owns the player's body |
| 5 | `W1-LIBRARY-r2` | yes — `_readBook()` in `engine.js`, `booksRead` in `sim/state.js` | yes (`W1-LIBRARY-r1` FAIL 3/10) | Answers a 3/10; books are read by the player |
| 6 | `save-load-repair` | yes — `save/fight.js`, `save/state.js` | yes (`RI-JRN05`) | A save that loses the fight is felt in one session |
| 7 | `W1-OPACITY` | yes — `world/opacity.js`, sealed answers register | yes (`RI-WLD09` §B1) | The refusals a player meets; sealed answers cannot be re-judged later |
| 8 | `W1-MASS` | yes — `combat/swing.js`, `data/combat/movesets/` | **NO — under arbitration** | See §4; it needs an arbiter first |
| 9 | `W1-SPEAKERS` | yes — `topics/07-root-coverage.json` indexed | yes | 82 infos; cheap offline critic; dialogue is player-facing |
| 10 | `W1-TRIBES` | partly — corpus item `RI-LOR08` + shipped books | yes | Builder itself flags *"the axis table is TRANSCRIBED, not derived"* |
| 11 | `W1-DLG-SHADOWS` | yes — four shipped topic files | yes | Cheap; dialogue text quality is a named §4 parallel lane |
| 12 | `COST-EXPERIMENTS-BUILD` | n/a — `tools/cost.mjs`, `docs/data/cost-ledger.json` | yes (`COST.md` gauntlet) | Builder names its own gap: **"no quality arm anywhere"** |
| 13 | `COST-DASHBOARD` | yes — `docs/` pages, `.githooks/pre-commit` | yes | Owner asked for the cost line chart by name (§7) |
| 14 | `capture-service-r2` | yes — `tools/capture/` is the shared daemon | yes (`CAPTURE-SERVICE-R1`) | Seven rebuilds unverified under a service everything uses |
| 15 | `codex-w1-09-builder-20260810` | yes — `champion_hist_marked.json`, `cmb-probe.mjs` | **NO — `W1-09`'s plan needs a round** | `W1-09-r4` lineage is live; would collide |
| 16 | `W1-08-builder-20260811` | yes — `tools/journey/input-checks.mjs` | **NO — superseded by S53** | A critic today judges a bar overturned this morning |

**Rows 15 and 16 are in the list for completeness and are not in the dispatch queue.** Both would be
judged against a predicate that moved on 2026-08-14, which is the exact waste the brief names. `W1-08`'s
plan-local closure clause is *"Superseded by S53's narrower gate"* in `NEXT-DISPATCH.md`'s own table, and
`W1-09` is `PLAN-AUDIT` rank 3 (*the one quality read is unavailable and the denominator is renormalised
around it*). Send the plan round, then the critic.

---

## 3. The ranked queue, and what the ranking is for

**The ranking is not worst-first. It is "most likely to change a decision" first**, weighted as the brief
sets out: what the owner sees when they play (§9), what other live work stands on, whose blind packs S51
may have voided, and where a green status file and a plausible defect coexist.

Full dispatch text, with entry points and the exact things to attack, is in `NEXT-DISPATCH.md`
§UNJUDGED-Q. The order and the reason, briefly:

**1 — `W1-30-GPU-CAPTURE`. The highest-leverage critic available anywhere in this backlog.**
It finished four hours ago and it is the transport under the *entire* visual programme: `W1-30A`, `W1-30B`
(*"re-run … on the GPU"*), `W1-30F`, `W1-30S`, `W1-30V` and `W1-30-P2` are all queued for critics whose
hardware evidence comes back through `gpu-deck.mjs`. **If this harness is wrong, six verdicts are wrong
before they are written**, and Directive §2's whole point is that the project has already certified a
broken thing as fixed on bad evidence. The builder wrote its own four attacks into `next_step` — including
*"street-lilmoth already flags occluded, no-detail, flat-tone and nobody has looked at the other 287"* —
and `HAZARDS` §0's fifth failure shape (*every arm supplies the disputed input by hand*) is the specific
thing to test against a self-test that reads its own evidence class from a renderer string.

**2 — `W1-RENDER`.** `NEXT-DISPATCH` §1old says of this work: *"It blocks the whole visual half of the
corpus… Every art-direction and fidelity item, the third-person presentation item, and every blind visual
comparison are unmeasurable while the player character is a box."* It is marked DONE and **has never been
judged**. Its acceptance is already written and falsifiable in one sitting: three weapon classes at the
same frame not byte-identical, a 60-frame attack moving more than 0.2% of the character box, the rendered
tip tracking the socket hit resolution uses. And §1a of the same document warns that a posed camera used
to hide the player entirely — so the critic must take its own frames through the ordinary follow camera.

**3 — `W1-GIVER-PRESENCE`.** Dispatched to close `W1-19-r2`'s top defect (*quest givers not in the
world*), re-verified by a successor, every gate green — **and its own `next_step` hands on
*"W1-23's canon register throws at boot on the shipped canon.json"* and *"14 quests reachable only via two
site states."*** A green status file sitting beside a boot-time throw is precisely the §9 shape, and quest
givers are the first thing a player looks for.

**4 — `W1-24`, entered through the live builder, not through the 08-10 delivery.** W1-24 owns the visual
protocol and the player's body — *"rotate the camera around the player"*, verbatim §2 — and **no `W1-24`
verdict exists anywhere in `corpus/90-verdicts/`.** But `W1-24` is `building` right now, so a critic
against `W1-24-builder-codex-20260810` would grade a superseded delivery and collide with a live agent.
The dispatch is the independent handoff that delivery already specifies (*regenerate native binaries,
administer RI-VIS08 and the disjoint S47 calibration, then separately judge VIS06 A, VIS06 B, CAM07 art
and UI ART/FIDELITY*), issued **when the live builder reports**. Ranked here so it is not lost; gated so
it is not wasted. Note also `PLAN-AUDIT` §8: `W1-24.md:124`'s *"zero runnable pairs caps fidelity at 7"*
rests on a premise that has been false for eight days — 131 files exist in `refs/modern/` — so the plan
edit should land before the judges are commissioned.

**5 — `W1-LIBRARY-r2`.** Answers a 3/10 FAIL with the `readBook()` consumer the r1 critic asked for. Books
are read by the player and the piece touches the same `canon.json` that is throwing at boot in row 3;
these two want reading together, in that order.

**6 — `save-load-repair`.** `RI-JRN05`, and the piece belongs to no single wave-1 piece, which is exactly
how a repair goes unjudged. It declares its own residuals rather than hiding them, and a save that drops
your fight is felt inside one session.

**7 — `W1-OPACITY`.** The mysteries register, `opacity@1`, 24 mysteries, wired through
`world/opacity.js` and throwing on a dangle. Worth judging early for an unusual reason: it wrote **24
sealed answers** into `corpus/50-world/sealed/SEALED-ANSWERS.md`. A sealed record judged late is judged by
someone who has read it.

**8 — `W1-SPEAKERS`, `W1-TRIBES`, `W1-DLG-SHADOWS`** — one dispatch each, all cheap, all offline, all in
the dialogue/lore lane Directive §4 names as safe to run in parallel with the visual work. `W1-TRIBES`
carries the sharpest self-declared hazard in the population: *"the axis table in tribe-census.mjs is
TRANSCRIBED from RI-LOR08 §2, not derived — a builder who changed §2 and not the table would pass."* That
is a coupled yardstick and S51's disconnected-script test is the instrument for it.

**Then**, in the second half of a twenty-dispatch window: `COST-EXPERIMENTS-BUILD` and `COST-DASHBOARD`
(`COST.md` is binding and explicitly requires a build critic that did not do the saving; the builder
already names *"no quality arm anywhere — Q1's $244.41 saving has no G2/G3 measurement beside it"*), and
`capture-service-r2`.

### On S51 and voided blind packs

The brief asked me to weight toward pieces whose blind packs S51 may have voided, *since their scores may
be worth less than they read*. Checked, and the honest answer is that **S51's blast radius does not fall
on this population** — with one exception and one near-miss.

- S51 names thirteen items (`RI-AI01`, `RI-AI03`–`RI-AI07`, `RI-CMB01`, `RI-WPN05`, `RI-CAM01`–`RI-CAM04`,
  `RI-CAM06`) and five more owing a provenance sentence. The pieces judged by those items are `W1-12`,
  `W1-09`, `W1-06` and `W1-10` — **all four are in the *in-progress* bucket, not in this one.**
- S51's own retroactivity clause is explicit: *"Verdicts invalidated: none."* So no score in this
  population is worth less than it reads *because of S51*.
- **The exception is `W1-TRIBES`**, above: not an S51 blind pack, but the same coupled-yardstick shape —
  an instrument transcribed from the item it is supposed to test — and the disconnected-script test is
  precisely how to attack it.
- **The near-miss is the prose packs.** They were voided, but by the earlier BLIND-PACK-GATE ruling and by
  their own leak audit (15/15 decidable by counting redaction tokens), not by S51. Already closed; §1d.

The one S51-shaped job this triage *does* surface is the census the ruling itself says is owed and was not
done: *"A full census across all 109 `blind_pair: yes` items is owed and was NOT performed here."* That is
one cheap dispatch and it is not a critic.

---

## 4. Pieces that need something other than a critic

| piece | what it needs | why |
|---|---|---|
| `W1-05` | **a builder round on a quiet box** | State reads `partial-complete`, not complete: *"the mandatory reachability proof (RULES.md rule 8) is NOT closed: 3 independent Phase-B body-walk attempts all fail and converge on the same water defect."* A positive control is **prepared and unrun** because the box stayed over the rule-21 contention cap. Sending a critic gets you a critic that reports what the builder already reported. The dispatch is: isolate the water defect (F31) from `rawleg-check.mjs` and `deepest_water_on_the_walk`, then run the prepared clean-route control. `PLAN-AUDIT` rates `W1-05`'s plan **CLEAR** with the best human gate in the project, so the bar is sound and only the measurement is owed. |
| `W1-27` | **a builder round, then a plan round** | The builder's own status records a hard fail: *"`pois.json` … contains only 42 eligible exterior POIs; with 115 interiors A+B=157, below the absolute 276 floor. The native M7 sample of 60 is void because the denominator is 42."* A critic would confirm a self-declared fail — zero decision changed. And `PLAN-AUDIT` rank 5 says the predicate itself is wrong under Ruling W1 (*a province-wide count where a player walks one route*), so the plan round should land before the next build round is scored. |
| `W1-29` | **a one-line bookkeeping fix** | `orchestration/status/W1-29.json` still reads `"plan_state": "satisfied"`. S53 moved it, and `NEXT-DISPATCH.md`'s own table says so in bold: **`satisfied` → `awaiting-recriticism`… The one plan whose state this pass changes.** The status file and the ruling now disagree, and `dispatchable.mjs --wave1-plans` reads the status file. This is the propagation failure of `PLAN-AUDIT`'s closing section reappearing one document later. |
| `W1-08` | **a plan reviewer-editor round** | `plan_state: awaiting-recriticism` already, correctly. S53 supersedes its plan-local *"independent naive pass … is not closure"* clause with a narrower gate on `RI-JRN03` M-N1/M-N2/M-N3. The plan should cite S53 rather than keep the local copy. Then, and only then, a build critic. |
| `W1-MASS` | **an arbiter, and one is already referred** | Its own `next_step`: *"Open and deliberately NOT landed, for an arbiter rather than a builder: the RI-WPN02 §B / RI-WPN05 §E.2 contradiction. 645 of 2,689 slots imply a peak tip speed over §E.2's ceiling."* `NEXT-DISPATCH` §S1 is the standing referral (*the substep count rests on a tip speed that is 6× wrong*). A critic sent now would score a piece against two items that contradict each other. **Arbitrate, then judge.** |
| `tools/dispatchable.mjs` | **a wiring fix** | The truncated verdict key, above. One character class. Ownership check first, per Ruling O1. |
| `RI-*` blind-pair census | **a research dispatch, not a critic** | S51 says it is owed and was not performed: all 109 `blind_pair: yes` items against the disconnected-script test. |

---

## 5. What I could not do

- **I did not open every one of the 96 status files in full.** I read all 96 through their extracted
  fields (`state`, `brief`, `next_step`, `files_touched`, `outputs_written`, `plan_state`) and opened
  roughly twenty-five in full — every one of the sixteen in §2, the four in §4, and the ones whose
  classification was not obvious from the fields. The blog and plan-loop rows were classified from their
  ids, dates and briefs, which for those categories is sufficient and for a game piece would not be.
- **I did not verify the corpus-loop clearances item by item.** I confirmed that `BAR-CRITIQUE-02` declares
  scope over *"all 137 reference items across 20 corpus areas"* and returns SUFFICIENT, and that
  `ACQUISITION-CRITIQUE-R1/R2` and `INTENT-AUDIT-02` exist and name the right builders. I did **not** check
  that each of the eighteen corpus authoring tasks' specific items appear inside those critiques' scoped
  populations. If one of the eighteen wrote an item after `BAR-CRITIQUE-02` was taken, it would be
  genuinely unjudged and I would have cleared it wrongly. All eighteen status files are dated 2026-08-06
  and `BAR-CRITIQUE-02` is dated 2026-08-06, so the risk is real but narrow; naming it rather than
  implying certainty.
- **I ran no browser, no GPU pod and no game.** A text and `git log` sweep, per the cheap-first discipline
  and because the box has been over the contention cap all day.
- **I did not fix `tools/dispatchable.mjs`.** Deliberate, per Ruling O1 — it is a shared file read by every
  dispatch decision, and the ownership check belongs to the orchestrator. The exact edit is above.
- **I did not re-check the "done and judged" bucket (134 rows) for the inverse error** — pieces reported
  as judged whose verdict actually belongs to a different piece under a colliding truncated key. The same
  regex that produces false *unjudged* rows can in principle produce false *judged* ones, and
  `w1-08` matching `w1-08-w1-29` is the shape to look for. That is a natural successor to this piece and
  it is cheap.
- **I judged nothing**, which was the instruction. Every score, verdict and quality claim quoted above is
  someone else's, and cited.
