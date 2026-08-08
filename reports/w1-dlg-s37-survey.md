# W1-DLG-S37 — landing ARBITRATION S37

**Ruling:** `RI-DLG01` §A governs; the engine yields. Not revisited here — this is the implementation.
**Authority:** `corpus/00-doctrine/ARBITRATION.md` S37, `orchestration/NEXT-DISPATCH.md` §T0.
**Status file (authoritative, read it):** `orchestration/status/W1-DLG-S37.json`.

Every number below is reproducible by the command next to it. The JSON artifacts are deliberately
untracked (`reports/.gitignore` — reproducible run artifacts are not source); regenerate them with
the commands given.

## 1. Acceptance

| | command | result |
|---|---|---|
| gate, before | `node tools/dialogue/arbiter-order-divergence.mjs --gate` | **FAIL** 58 / 42,456 — 37 pairs, 8 topics, exit 1 |
| gate, after | same | **PASS** 42,456 / 42,456, exit 0 |
| self-test, before | `--self-test` | 4/4 arms, exit 0; baseline divergence 1,906,688 / 1,460,324,864 |
| self-test, after | `--self-test` | 4/4 arms, exit 0 (ARM 4a now reports agreement, its documented post-landing behaviour) |
| sabotage | reference rule replaced by the shipped rule, **scratch copy** | ARM 2 red, **exit 2** |

`tools/dialogue/arbiter-*` was never edited. The sabotage ran on a copy outside the tree.

## 2. The change

1. **`game/src/character/converse.js` `infoFor()`** — scoring **deleted**, not re-weighted:
   `best = info; break;`. `infoAllowed()`, the npc-own-line short-circuit, the canon register, the
   `cell` prefix match, the actor filter and the whole return literal including `to` are untouched.
2. **`game/data/dialogue/topics/_manifest.json`** — the declared merge order, keyed on the per-file
   `group`. `buildTopicIndex()` orders by it; a topic file outside it is an **error**; a corpus doc
   list with no manifest is an **error**; a hand-built fixture with no `group` passes through
   (deliberately narrow, RULES 13).
3. **`tools/dialogue/order-infos.mjs`** — header rewritten, `--verify-inert` implemented.

## 3. The finding: there were two merge orders, and they disagreed

S37 says the order came from `readdirSync().sort()`. It came from **two** sorts:

* tools → `readdirSync().sort()`, by **filename**;
* engine → `Object.keys(out.topics).sort()` (`engine.js` `loadData`), keyed on `doc.id || basename`.

Three of 21 topic files carry a top-level `id` (`06-opening-roots`, `45-speaker-coverage`,
`main-quest-argument`), so each sat in a different position in the game than in every instrument
measuring it. **36 of the 92 multi-file topic ids involve one of them.**

```
node tools/dialogue/s37-merge-order-consume.mjs --pre <pre-manifest converse.js>
```

| arm | engine vs tool order | reversed vs tool order |
|---|---|---|
| pre-manifest reader (**the control**) | **5,760** / 2,414,880 differ, 9 topics | **15,460** differ, 32 topics |
| shipped reader | **0**, 0 topics | **0**, 0 topics |

`soulrest-customs-clerk` on `background` said one thing in play and another in every measurement.

## 4. Delete-the-fix (2×2: selection rule × declared order)

| | readdir order | manifest |
|---|---|---|
| **scoring** | gate FAIL 48; 8 unhearable | gate FAIL 48; 8 unhearable |
| **first-match** | gate PASS; 13 unhearable | gate PASS; 13 unhearable |

The **rule** moves both numbers; the **manifest** moves neither *through this instrument*, by
design — it ratifies the order the tools already used, and its effect is on the engine's arrival
order, measured separately in §3. Control watched going red; the teardown was byte-compared against
the shipped file and anchor-asserted before it was trusted, so it is not an inert control.

## 5. The cost, landed and named

`node tools/dialogue/s37-unhearable.mjs` (new — it **calls** `infoFor()` rather than modelling it).

**8 → 13 (+5).** The ruling predicted +6 (8 → 14) at `63f41ef`; the tree has moved since (W1-17-r2
landed 105 bodies, 20 re-homes, cut `res`/`q`; speakers 347 → 369). Both ends measured with one
instrument on one tree. The arbiter's own §E independently reports 8 → 13 today.

```
reading-the-count#3   {a:archivist, d:20}            [registered-disputes]
reading-the-count#4   {a:archivist, cell:blackrose}  [registered-disputes]
the-cutters-terms#3   {a:sapcutter, d:20}            [registered-disputes]
the-witness#3         {a:clerk, cell:gideon, d:20}   [utility-and-standalone]
the-xanmeers#3        {a:archivist, cell:blackrose}  [registered-disputes]
```

**All five are shadowed across the merge boundary, not inside a file.** In every case a broader
same-actor entry in an *earlier* file (`50-mainline`, `50-factions`, `10-global`) precedes a more
specific entry in a *later* file (`70-disputes`, `55-utility`). Within each file the order is
correct. `order-infos.mjs` sorts within a topic record and structurally cannot see this, which is
where **100% of the remaining §D violations now live**.

Corroborated by `shadow-audit.mjs` ("5 audited against the shipped reader; 5 genuinely
unreachable") and `build-graph.mjs` ("5 unreachable INFOs"). No before/after is claimed for
`build-graph` — there is no clean baseline for it.

Not repaired: the ruling prices this as the accepted cost and S37 "WHAT THIS DOES NOT DECIDE" (7)
leaves which answer is better to whoever reorders.

## 6. `order-infos --write` — is the order it produced better?

* **Re-run:** `0 topic(s) across 0 file(s) out of 353` — the corpus is already at the tool's fixed
  point from an earlier `--write`. `--write` is a no-op today and was not run.
* **The control is no longer vacuous.** `--verify-inert`: 0 of 2,414,880 answers change.
  `--verify-inert --break`: **33,030 of 2,414,880 across 36 topics**. Under the old rule authored
  order decided 0.018% of resolutions in *one* topic, so this measurement could not have come out
  any other way. It can now.
* **`--verify-inert` did not exist.** The file's own header cited it as the proof that reordering
  changes no answers. There was no such flag. It exists now and it calls the live reader.
* **On "better":** within a file, the order is at the fixed point and verifiably inert. Across
  files the tool has no opinion at all, and that is where every remaining defect is. The
  86.5%/13.5% split is from `63f41ef`, *before* `--write` ran; re-judging it against the pre-tool
  corpus would conflate ordering with W1-17-r2's 125 content changes, so it is not claimed.

## 7. Hand-offs

1. **Two stale instruments.** `critic-reach.mjs` (line 111) and `critic-semantics.mjs` (line 81)
   hard-code the deleted `8/2/4/d/0.5` weights and never call `infoFor()`. `critic-reach`'s output
   is byte-identical before and after this change, with causes still reading "always outscored" —
   nothing is outscored by anything now. `critic-semantics` now FAILs with 206 divergences while
   comparing two *models*. Both are W1-17-r2's, which is finished and whose published 136 → 6 rests
   on `critic-reach`; repairing them would retroactively move another piece's number (RULES 22/25).
   **Reported, not touched.** This is exactly what the W1-17 round-1 critic predicted.
2. **The manifest reorder question.** Recorded as `open_question` inside `_manifest.json`.
   Quantified, not speculated: promoting `70-disputes` and `55-utility` above
   `50-factions`/`50-mainline` takes unhearable **13 → 10** — rescues 4 of the 5, creates
   `the-witness#5`, does not fix `the-xanmeers#3`. A real lever, not a free one, and an authoring
   judgement rather than a builder's.

## 8. What was not done

Listed in full in the status file. In short: the five are not repaired; `--write` was not run
(nothing to write); the stale instruments were not fixed; `engine.js`'s now-harmless sort was left
alone; `canon-consumption.mjs`'s failing arm was not investigated (W1-23 territory, no baseline
established). **No browser** — `tools/contention.mjs --gate` returned exit 3 (WAIT) at the start and
none was launched; the figure was rendered pixel-by-pixel with `pngjs`.

**One hazard, recorded for whoever archaeologises this range:** `tools/bank.mjs` committed
`converse.js` mid-edit at `bf4ec20`, leaving HEAD with a file that threw
`ReferenceError: bestScore is not defined` on import. Confirmed by running it — the arbiter gate
crashed against it. **The window was `bf4ec20` → `f291b01`**, and it was closed by a *later bank
commit* that picked up my finished working tree, not by my own commit; I had originally written
that my commit repaired it and that was wrong, so it is corrected here. My working tree was correct
throughout. This is documented bank behaviour (RULES 17), not a neighbour's error and not mine.
