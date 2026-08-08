# PLAN — W1-HUD-TOAST: the toast that ran off the paper, and the check that could not see it

**Plan agent, first use of the role. No browser launched, no `game/` source edited.**
All numbers below measured offline at **`6bb9003`** by importing `game/src/ui/glyphs.js`
(`measure`, `faceOf('ink')`, size 16, wrap budget `400 − 24 = 376`) in `node` and running it over
`game/data/dialogue/faction-refusals.json` and every `name` field in `game/data/**`. The throwaway
script is **not committed** — this role owns two paths — but the recipe is one paragraph and the
build agent should re-derive rather than trust it (rule 18). Rule 12: these are claims about
`6bb9003`, not about the project.

This plan splits into **two pieces**, deliberately, because they want different models and only
one of them needs a browser. Their acceptances are independent and either can land alone.

---

## 0. What is actually broken

**A.** `game/src/ui/hud.js` drew one unwrapped centred run on a 400-unit panel. W1-20 landed a
wrap (hud.js:263–299) and it works. Two things are still open:

- **The channel was never censused.** Over 75 strings this channel can carry — the sentence-shaped
  lines in `game/data/dialogue/faction-refusals.json` plus the 11 cast/water/equip refusals in
  `sim/magic/system.js` and `engine.js:_sayEquip` — **58 (77%) render wider than the 400 px panel
  as a single run.** Widest: **1013.5 px**. So this was never a faction-quest edge case; it was
  most of what the game says in this channel. Nobody has run the same measurement over
  `hud.prompt` (200-unit panel, ~169 px of usable width after the device glyph), `hud.boss`
  (900), or the quickslot labels (54).
- **The wrap is a second implementation.** `game/src/ui/type.js` already exports `wrap()`,
  `ellipsise()` and `normalise()`; hud.js imports `measure`/`drawText`/`faceOf` from that file
  and then re-implements greedy wrapping inline. Rule 10. The inline copy also skips
  `normalise()` and never `ellipsise()`s a **single word wider than the budget** — it emits it as
  its own over-wide row. Not reachable today (widest single word in any `game/data` `name` is
  **129.0 px** against a **376 px** budget) but it is unreachable-by-data, not correct.

**B — the larger half.** The W1-20 probe passed the broken build, and when the builder broke the
wrap on purpose to watch it go red, **it stayed green: the expected value was computed from the
same variable the wrapper uses (`maxW`), so breaking the wrapper moved the yardstick with it**
(`reports/w1-20/instrument-test.json`). Call the shape **COUPLED YARDSTICK**: *a check whose
expected side and observed side read one source, so it cannot disagree.* It is **not** any of
RULES rule 6's three shapes — the fix works, the teardown works, the number does not improve
deceptively; the *comparator* is blind. This project has shipped it at least four times and
nobody has ever swept for it.

---

## 1. Acceptance — the number, the predicate, the units

### Piece A — the HUD fit (`W1-HUD-TOAST-A`)

Population: every element `ui/hud.js` declares with non-null `text`, over corpus **C** = the
enumerated toast channel (75 strings measured today; the builder must publish the real
enumeration, because the equip toast interpolates **2,113** `name` fields from `game/data` and
the widest of those makes an **870.0 px** single run) plus the prompt, boss and slot-label sets.

| id | predicate | acceptance | units |
|---|---|---|---|
| **A1** | `overflow_px = max(0, x1 − (rect.x + rect.w)) + max(0, rect.x − x0)`, where `[x0,x1]` is the horizontal extent of the drawn run **as recorded by `render/text-register.js`** — `x0` the draw call's own x with alignment applied, `x1 = x0 +` the pen advance accumulated by `glyphs.drawText` *while painting the glyphs* (`glyphs.js:255-256`) — and `rect` is the element's declared rect from `getUIState()`. Same clause vertically against `rect.y`/`rect.h`. | `overflow_px == 0` for **100%** of (element, string) pairs in C | CSS px, 1920×1080, `devicePixelRatio 1`, `s = 1.0` |
| **A2** | `escaped_px = ` count of pixels differing by `>8` on any channel between `frame(uiToast(T))` and `frame(uiToast(null))` — same state, same seed, same frame index, nothing else changed — that lie **outside** `rect(T)` as declared on the T frame. | `escaped_px == 0` for a **sample of 8**: the 3 widest, the 3 narrowest, the widest single word, one 3-row string | pixels, 1920×1080 |
| **A3** | no silent loss: `rows.join(' ') === normalise(T)` **or** `meta.truncated === true` | 100% of C | strings |

**Why two tiers.** A1 is cheap and can run over all of C; its extent comes from the painting loop,
so **breaking the wrapper cannot move it** — that is the whole point. A2 is the decisive one and
runs on a sample because it costs a frame pair each. A2 exists because A1 still shares one source
with the wrapper: `advanceUnits()` inside `glyphs.js`. If *that* is wrong, wrap and register agree
and the text still spills. Only the framebuffer can see it. **Declared, not closed** (carried risk).

Vacuity guard on A2, mandatory: `changed_px_inside_rect > 0` for every sample and monotone
non-decreasing with row count. A diff that saw nothing reports `escaped_px == 0` and looks
exactly like a pass — the same mistake one layer down.

Soft target, CARRIED not blocking: `rect.w − (x1−x0) ≥ 24·s` (12 units of parchment each side).
It is soft precisely because 12 is a number the drawing code chose, and an acceptance that reads a
number the code under test chose is the defect this piece is about.

### Piece B — the coupled-yardstick sweep (`W1-INSTRUMENT-COUPLING`)

Population **P**, enumerated and committed as a list, never a wildcard: every `.mjs` under
`tools/` that both emits a pass/fail (or a non-zero exit on a threshold) **and** declares a
perturbation. Today's upper bounds at `6bb9003`: **118** files mention `--self-test`, **137**
mention a break/teardown/delete-the-fix, and the harness carries **30 `__break*` verbs**. The
union is under ~200; the builder publishes the exact number.

Per member, the **yardstick-drift test (YD)** — fire the tool's own declared perturbation, and
read, from the tool's own artifact, the observed value `O` and the expected/threshold value `E`
of each graded row:

| outcome | meaning |
|---|---|
| `ΔE ≠ 0` | **COUPLED** — the yardstick moved with the thing under test. The defect. |
| `ΔE == 0`, `ΔO == 0` | **INERT** — rule 6's known shape; hand to `sabotage.mjs` |
| `ΔE == 0`, `ΔO ≠ 0`, verdict flips green→red | **INDEPENDENT** — pass |
| tool publishes no `E` | **OPAQUE** — reported, **never scored as a pass** |

| id | predicate | acceptance | units |
|---|---|---|---|
| **B1** | every member of P classified into {INDEPENDENT, COUPLED, INERT, OPAQUE, ERROR} | **100%** of a committed enumeration | tools |
| **B2** | **recall** against the four known historical positives, re-seeded on scratch worktrees | **4 of 4 flagged COUPLED** | instances |
| **B3** | **false-positive discipline** against two known-good controls: W1-20's post-fix rect-derived `fits` (`ui/system.js:1157-1170`) and `tools/dialogue/w1-17-r2-deletefix.mjs` (a 2×2 whose control was watched going red) | **0 of 2 flagged** | instances |
| **B4** | `coupled_open == 0` at close — every COUPLED is either fixed or written into the gap ledger against the piece that owns it | 0 | tools |

**B2 is the acceptance, not B1's headline.** A sweep that flags 60 tools and misses the four known
ones has failed, and a large flag count will otherwise read as diligence. The four:

1. **W1-20's own** — `fits` judged against `maxW` inside hud.js. Re-seedable by moving the
   derivation back out of `ui/system.js`.
2. **The compliance report whose two numbers both came from one forged save.**
3. **The control arm that ran the positive arm on both sides** — W1-04 `__w1_04_townSolids`,
   `e37d327`, fifteen byte-identical walks (rule 6's own worked example).
4. **The sabotage facility whose verdict turned on an optional integer** — W1-25 r1,
   `GAP-W1-25-the-control-facility-has-an-optional-control`.

If the sweep gets 3 of 4, that is published as 3 of 4 with the missed shape named. It is a
result, not a failure (rule 26).

---

## 2. The null control — the arm that must come out worse

**Piece A.** A scratch worktree at HEAD with hud.js's E11 block reverted to the **pre-W1-20 single
centred run**. Same A1/A2, same corpus.
*Must come out:* `overflow_px > 0` on **≥58 of the 75** censused strings, and `escaped_px > 0` on
the widest sample — a 676 px run centred on a 400 px panel loses ~138 px off each end.
*Inert would look like:* `overflow_px == 0` in the unwrapped arm on any string measuring >400 px,
or `escaped_px == 0` with `changed_px_inside_rect == 0` (the diff never saw the text). **If either
appears, nothing else in Piece A may be reported.**

**Piece B.** The four re-seeded historical positives on scratch worktrees. They are real, dated
commits; their coupling is already on the record and is independent of anything this piece writes.
*Must come out:* the seeded arm and the clean arm differ **in exactly the seeded rows**, printed
per row, not as a count.
*Inert would look like:* identical classification on seeded and clean trees, or `OPAQUE` on all
four — a sweep that cannot read `E` cannot disagree, and it will exit 0 while doing it.

**Neither null reads anything the fix touches.** A's extents come from the pen advance in
`glyphs.drawText` and from the framebuffer; B's come from commits that predate this piece. This is
stated explicitly because the defect under repair *is* a null computed from the thing under test.

---

## 3. Instruments reused, by path (rule 10 — build no second one)

| path | role |
|---|---|
| `game/src/render/text-register.js` | the drawn-string extents (`x`, `w`, per surface). Extend its record with the owning element id; do **not** write a second register. Its `clipped` flag is canvas-clip only — that is why it said `clipped:false` on a run that left its panel. |
| `game/src/ui/system.js` `getUIState()` | the declared rects, and the existing `toast.fits`/`overflow_px` block (lines 1154–1170). **Generalise that one block** to every text-bearing element. No per-element special case. |
| `game/src/ui/type.js` `wrap()` / `ellipsise()` / `normalise()` | already exist. Replace hud.js's inline greedy wrap with them. |
| `tools/analysis/ui-census.mjs` | the existing browser-driving UI instrument, already carrying a `--self-test` that goes red on purpose. A1/A2 go **here**. Do not write `toast-fit.mjs`. |
| `tools/experience/lib/sabotage.mjs` | the control-integrity facility and its five verdicts. `COUPLED_YARDSTICK` is a **sixth verdict on this facility**, not a new tool. Its contract — *"a control FAILS when its arms agree"* — needs one more clause: *and when the two sides read one source.* |
| `tools/analysis/impossibility-screen.mjs` | the precedent for a screen that may report a negative and may **never** report a positive, fenced in code with `--self-test-fence`. Piece B's static half copies that fence verbatim in shape. |
| `tools/quests/faction-joining-probe.mjs`, `reports/w1-20/instrument-test.json` | the falsification record that found this. Cite it; do not re-derive it. |

---

## 4. Recommended model — split, and the reason

| piece | model | why |
|---|---|---|
| **A — the HUD fit** | **Sonnet** | PLAN-LOOP's middle row exactly: a landed plan, an existing instrument (`ui-census.mjs`), a machine-checkable acceptance (`overflow_px == 0`, `escaped_px == 0`). Nothing here is a judgement call. |
| **B — the sweep** | **Opus** | PLAN-LOOP's top row: *designing a measurement*. The hard part is not the grep, it is deciding what counts as "the expected value" across ~200 heterogeneous artifacts and refusing to let OPAQUE read as a pass. |

The reason for the split stated as a risk: **give B to Sonnet and the likely failure is a grep
that flags 60 tools, is tuned until the list looks reasonable, and never runs the 4-positive
recall — which is the coupled-yardstick shape one level up.** That is the specific thing this
piece exists to stop. Also practical: A needs a browser for an hour, B needs none until its
shortlist, so they should not queue behind each other.

---

## 5. Steps (these matter least)

**A.** 1. Enumerate the channel — every `engine.uiToast()` call site (`sim/magic/system.js`
`sayCastRefusal`/`sayWaterDenial`/empty-charge, `engine.js` `_sayEquip` over item names,
`factionRefusal`, the M-K20 positive control) and every text-bearing HUD element; commit the
corpus with its size. 2. Swap the inline wrap for `type.wrap()` + `ellipsise()`; wrap `hud.prompt`
and `hud.boss` **only if the census shows a string over budget** — and say so if it does not.
3. Generalise the `getUIState()` fit block. 4. A1 + A2 into `ui-census.mjs`; `--self-test` breaks
the wrap and asserts red. 5. The null worktree. 6. Rule 27: one blog line, and the shot is the
same sentence unwrapped and wrapped side by side.

**B.** 1. Enumerate and commit P. 2. `COUPLED_YARDSTICK` into `sabotage.mjs`. 3. Static screen,
fenced so it can never publish "clean". 4. Dynamic YD over the shortlist plus all 30 `__break*`
verbs (those have a perturbation by construction). 5. B2 and B3. 6. Fix or ledger every COUPLED.

---

## 6. BLOCKING unknown — one, and one measurement closes it

**Is the HUD surface's context instrumented by `render/text-register.js` in the state
`ui-census.mjs` drives, with a non-zero `w` on the toast's run?** `glyphs.drawText` calls
`ctx.__esNoteText` only `if (ctx.__esNoteText)`, and the register installs that hook only on
contexts it owns and only while `reg.enabled`. If the HUD context is not instrumented in that
state, **A1 does not exist** and everything falls back to A2, which is roughly 8× the cost per
string and cannot run over all 75.

*The one measurement:* in `ui-census.mjs`'s existing state, raise a toast and call
`getRenderedText({ surface: 'hud' })`; report the entry count and whether the toast's string is
present with `w > 0`. One browser-minute. I could not take it without launching a browser, which
this role does not do — so it is stated here rather than guessed (PLAN-LOOP: a wrong build is much
more expensive than a named unknown).

## 7. CARRIED risks — write these into the build brief, do not argue them now

1. **`advanceUnits()` is the one source A1 shares with the wrapper.** A1 is blind to a defect in
   it; A2 is not. That is why A2 exists on a sample, and it is the residual.
2. **The 3-row ceiling is unexercised by data** — 0 of 75 strings reach it, so the ellipsis branch
   has never run. Rule 4: force it with a synthetic string and watch it, or report it unexercised.
3. **A word wider than the budget is emitted unshortened.** 129.0 px vs a 376 px budget today; it
   becomes reachable the moment an item name grows.
4. **B's population is tools, not verdicts.** A coupled yardstick inside a *verdict* — a critic
   computing its expected number from the builder's own artifact — is RI-MTH04 M4/M7 territory and
   is **out of scope**. Named so nobody reads B's clean exit as covering it.
5. **~200 tools × a perturbation run is real money.** If it overruns, the shortlist order is: the
   30 `__break*` verbs, then tools a wave-1 verdict cites as evidence for a green result. Publish
   the fraction actually run as a fraction with its denominator, never as a bare percentage.
6. **`ui/hud.js` and `ui/system.js` are W1-21's files.** W1-20 already declared an undeclared
   overlap on both. Piece A must declare `redundant_with: ["W1-21"]` rather than collide.

## 8. What I am least sure of

**Piece B's population definition.** "Every tool that emits a pass/fail and declares a
perturbation" is a clean sentence and I cannot yet prove it is enumerable — my 118/137/30 are
`grep` counts of *mentions*, not of tools that actually publish a comparable `E`. If most of P
turns out OPAQUE, B1 degenerates into a large honest list of things that could not be tested, and
B2's recall is then carrying the entire piece on four instances. I think that is still worth
buying — four re-seeded positives with a measured recall is more than this project has ever had
here — but a critic should push on whether B1 should instead be scoped to *tools cited by a
wave-1 verdict*, which is smaller, enumerable from the verdicts, and covers the case that actually
costs us rounds.

Second: **A2's diff assumes the toast is the only thing that changes between the two frames.**
`uiToast()` calls `ui.build()` and the panel is drawn with a seeded jitter (`panel(..., 4242, ...)`);
if anything else on the HUD is frame-dependent, the diff picks it up as escaped ink. The vacuity
guard catches a diff that saw nothing; it does not catch a diff that saw too much. The mitigation
is to run A2 on a paused clock and diff a control pair (toast-null vs toast-null) first, requiring
**0** changed pixels — and I have not verified that the clock can be held still in that state.
