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

## 8. What the plan agent is least sure of

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

---

# PLAN CRITIC — exchange 1 of 2

**Critic, fresh context. No browser launched, no `game/` source edited.** Everything below is read
off the tree at **`77439c0`** (the plan measured at `6bb9003`; nothing I cite moved between them —
`git log` shows no commit touching `game/src/ui/surface.js` or `game/src/render/text-register.js`
in that span). One number was computed offline, by importing `game/src/ui/theme.js` in node and
replaying `parchmentPath()` for the toast rect; the throwaway is not committed and the recipe is
in item **BLOCKING-1** so it can be re-derived rather than trusted (rule 18, rule 12).

## Verdict on the three things a plan must state

**1. The acceptance number, its predicate and its units — STATED, and two of the four predicates
do not describe what the named instrument computes.** The table is the right shape and the units
column is real. But A2's predicate measures the *opposite side* of the defect (BLOCKING-1) and
A1's extent clause contradicts the register that supplies it (BLOCKING-3). This is precisely the
class PLAN-LOOP §2 says cost two rounds this week — "overhang" in the prose, "clearance" in the
code — and it is present here in a plan that quotes that lesson.

**2. The null control — STATED for both pieces, and Piece A's cannot go red.** §2 is the best
written section in the document; it names the arm, the number, and what inert would look like, and
it says nothing else may be reported if inert appears. Then A2's null *is* the inert case, for a
mechanical reason nobody looked up (BLOCKING-1). Piece B's null — four re-seeded historical
positives on dated commits — is genuinely independent of anything B writes, and is the strongest
control in either piece. Its defect is that its four members are not shown to belong to the
population B sweeps (BLOCKING-4).

**3. Which existing instrument, by path — STATED, and the best §3 this project has produced.**
Seven paths, each with the reason it is that path and not a new file. Three gaps: the surface name
in §6 does not exist (BLOCKING-2); no path is named for the **pixel diff** A2 needs, though
`tools/harness/ui-pause.mjs` already does UI-on/UI-off pixel differencing over a screen box with
`pngjs` in a state where the sim frame is held still (its M-P1/P5); and no path is named for a
**clip-free reference draw**, though `__HARNESS.drawOnMenus(text)` (`game/src/harness/api.js:940`)
draws one exact string through the real vector path *outside* `el()` and reports what the register
saw. Both belong in §3 (rule 10).

---

## BLOCKING — resolve in the plan text before a build agent is dispatched

Every one of these is a text edit. None needs a browser. Where I could rule, I have ruled and
written the resolution out, so exchange 2 is an edit and not an argument.

### BLOCKING-1. A2 measures the wrong side of the defect, and its null control is inert.

`UISurface.el()` clips every element to its own declared rect before calling the element's draw
callback — `game/src/ui/surface.js:210-213`:

```js
c.beginPath();
c.rect(r[0] - 0.5, r[1] - 0.5, r[2] + 1, r[3] + 1);
c.clip();
draw(c, r);
```

with the comment *"The declared rect IS the clip. An element cannot paint outside what it
declared."* It is right. **No toast, wrapped or unwrapped, can paint more than 0.5 px outside
`rect`.** So `escaped_px == 0` is true by construction on the fixed arm *and on the reverted
arm* — the plan's own §2 test ("`escaped_px > 0` on the widest sample") returns zero, §2's own
stop-clause fires, and A2 has spent eight frame-pairs and an hour of the only browser to learn
nothing. A2 as written is a control that cannot fail: the third bullet of rule 6, one layer up,
in the piece whose subject is controls that cannot fail.

The framing was not viable from the other direction either, and this is worth recording because it
is why the error was invisible. Had there been no clip, the parchment's own deckled outline would
have made `escaped_px > 0` unconditional: `parchmentPath()` displaces each outline point along the
edge normal by `(jitter(k,n)*2.6 + jitter(k+31,n)*1.3)*s`, and replaying it in node for the toast
rect at 1920×1080, `s=1`, `seed 4242` gives a maximum outward excursion of **3.77 px** on all three
row counts (rect `760,40,400,{48,60,80}`). Perimeter ≈ 900 px, so of order 1–2k pixels outside the
rect would have differed between `toast(T)` and `toast(null)` *from the panel edge alone*, with no
text involved. Either way `escaped_px` is not a function of the wrap. Between the clip and the
deckle there is no version of "pixels outside the rect" that answers this piece's question.

**The real defect is missing ink inside the rect, not escaped ink outside it.** `hud.js:250-258`
describes the symptom two ways in one paragraph — *"it simply ran off the paper at both ends"* and
*"a sentence with its first four words and its last five missing"* — and the clip settles which is
true: the words were **cut off at the panel edge**. `render/text-register.js` reported
`clipped:false` on that run for a reason the plan half-states: `overlaps()` (`text-register.js:82`)
is an *intersection* test, so a run that is 60% outside its clip intersects it and is recorded as
unclipped. The register's `clipped` flag is containment-blind, not merely canvas-clip-only.

*Resolution, ruled.* Replace A2 with two predicates that can both go red:

- **A2a — `cut_px`, the decisive one.** Draw the same rows at the same positions through
  `__HARNESS.drawOnMenus()` (`harness/api.js:940`), which goes through `glyphs.drawText` on the
  menus context *outside* `el()` and therefore outside the clip. `cut_px` = ink pixels present in
  the clip-free render and absent in the element render, inside a band of `rect` inflated by the
  stroke halo. Acceptance `cut_px == 0`. On the reverted arm the 676 px run on a 400 px panel loses
  ~138 px of glyph at each end, so the null goes red by hundreds of pixels and the size of the
  number is the size of the defect.
- **A2b — the escaped-ink residue, honestly bounded.** Keep a diff, but pair **two toasts of the
  same row count** rather than toast-vs-null. `h = max(toastH·s, rows·lineH + 20·s)`
  (`hud.js:277`), so equal row counts give an identical rect, an identical `panel(...4242...)`, an
  identical deckle, and the diff isolates glyph ink. Acceptance `escaped_px == 0` then means
  something, and the vacuity guard still applies because the two strings differ.

Both keep the property the plan correctly insists on: neither reads a number the wrapper chose.

### BLOCKING-2. §6's "BLOCKING unknown" is closed in text — and the query it proposes is itself an empty-set query.

The plan proposes to spend a browser-minute on `getRenderedText({ surface: 'hud' })`. **There is no
surface named `hud`.** The renderer declares exactly three — `dialogue`, `title`, `menus`
(`render/renderer.js:124-129`) — and the HUD is on `menus`, declared verbatim as *"ui/hud.js +
ui/screens/* — the HUD and the menus, via ui/glyphs.js drawText"*. `coverage()` with an unknown
surface name yields `scope = []`, so `complete = blind.length === 0 && scope.length > 0` is
**false** and `entries` is `[]`. The plan's stated reading of that result — *"if the HUD context is
not instrumented, A1 does not exist"* — would have been drawn from a query over an empty set. The
irony the brief anticipated is real and it is sharper than expected: this is a piece about checks
whose two sides read one source, and its own gating measurement was a grep over a set that cannot
contain its subject. The register's header names this defect at line 41 (*"AN EMPTY RESULT AND A
CLEAN RESULT MUST NEVER BE THE SAME VALUE"*) and the accessor's `complete:false` is the guard that
would have caught it — but only if whoever read it branched on `complete` rather than on `entries`.

*Ruled: the unknown is CLOSED, not carried, and A1 exists.* The chain is static and complete:

1. `renderer.js:106` constructs `this.menus = new UISurface(...)`; `:129` calls
   `textRegister.instrument(this.menus.ctx, 'menus')` **unconditionally in the constructor** —
   there is no state in which a Renderer exists and the menus context lacks the hook.
2. `instrument()` installs `ctx.__esNoteText` (`text-register.js:216`).
3. `glyphs.drawText()` ends `if (ctx.__esNoteText) ctx.__esNoteText(s, x, y, adv, size)`
   (`glyphs.js:255-256`), with `adv` the accumulated pen advance — exactly the quantity A1 wants.
4. `ui/system.js:624` calls `drawHUD(S, ...)` inside `build()`, and `build()` is called from
   `getUIState()` as well as from `render()` — the file says so at `:556-558`, *"because every
   probe in this project runs `setRenderRate(0)` before it steps"*.
5. `surface.js:190-215` `el()` invokes the draw callback immediately, so the toast's `drawText`
   calls happen during `getUIState()`.

So the plan's fallback ("everything falls back to A2, 8× the cost") is not needed, and the build
must not be briefed as if it might be. Replace §6 with the corrected recipe —
`getRenderedText({ surface: 'menus' })`, branch on `complete`, never on `entries.length` — and with
the **one real trap** that replaces the false one: `build()` is cached per frame on
`(builtFrame, mode, touch/focus/pending signature)` (`system.js:600`), so a probe that clears the
register and then calls `getUIState()` twice on the same frame repaints nothing and gets an empty
register — an empty result that reads exactly like a clean one. Clear, then force a rebuild or
advance a frame, then read; and assert `entries > 0` before computing anything from them.

### BLOCKING-3. A1's predicate contradicts the instrument that supplies it. Two corrections, both one line.

- **Alignment.** A1 says `x0` is *"the draw call's own x with alignment applied"*. The vector path
  records alignment as the literal string `'left'` (`text-register.js:217`) and never consults
  `ctx.textAlign`; `_record` then sets `x0 = x`. That is correct for this population — `hud.js:263`
  pre-centres each row itself, `drawText(c, rows[i], r[0] + r[2]/2 - measure(...)/2, ...)` — but the
  plan's wording invites a build agent to implement alignment handling that the register does not
  have, i.e. a second implementation of the extent (rule 10). Correct wording: *`x0` is the `x`
  passed to `glyphs.drawText`, which is already the run's left edge because the HUD pre-centres;
  the register records vector entries as left-aligned by construction.* If the generalisation to
  other elements ever meets a caller that relies on `ctx.textAlign`, that is a register defect to
  report, not a thing to compensate for in the check.
- **Precision.** `_record` stores `x: Math.round(x), w: Math.round(w)` (`text-register.js:246-247`)
  and `el()` stores the rect at 2 dp (`surface.js:196`). An acceptance of `overflow_px == 0`
  **exactly**, in units of "CSS px", is therefore being computed from a ±1 px quantised extent
  against a 0.01 px rect: a run 0.4 px over the edge reads 0, and a run that exactly fits can read
  1. State the acceptance as `overflow_px ≤ 1.0 px` **or** publish the unrounded advance from the
  register — and if the latter, declare `game/src/render/text-register.js` as a touched file
  against W1-26 (§7 item 6 declares the W1-21 overlap but not this one).

### BLOCKING-4. B2's four positives are not shown to be members of P, so the recall cannot disagree with the sweep.

This is the plan's most important number — it says so itself, *"B2 is the acceptance, not B1's
headline"* — and it is measured against a population that is not the one being swept. P is defined
as *"every `.mjs` under `tools/` that both emits a pass/fail and declares a perturbation"*. Of the
four positives: #2 is a **compliance report**; #3 is a **control arm inside a probe**, reached
through a harness verb; #4 is an **optional integer in a facility library**. Only #1 is plainly a
`tools/*.mjs` that emits a verdict. A recall whose positives sit outside the swept population
measures nothing about the sweep: it can score 4/4 by recognising four shapes it will never meet in
P, or 0/4 while being perfectly correct on every member of P. That is the same structure as a
coupled yardstick — the two sides are not reading one source, they are reading *different* sources
and being reported as one number.

*Resolution:* for each of the four, either name the member of P through which the sweep would
encounter it (and re-seed it there), or move it out of B2 into a separately-labelled
**shape-recognition** check with its own denominator. `4 of 4` and `2 of 2 in-population + 2 of 2
by shape` are different claims and only the second is honest.

### BLOCKING-5. Piece B's population. The plan's suggested re-scope is right, for a reason it did not give — and it is wrong as a total replacement.

The plan hands the critic its own move: re-scope B1 to *tools a wave-1 verdict cites as evidence
for a green result*, because that set is "smaller, enumerable from the verdicts, and covers the case
that actually costs us rounds." I accept the direction and reject the completeness, on two grounds
the plan did not state.

**The reason the plan did not give, and the better one: this is rule 5 applied to instruments.**
CONSUMPTION says a model nothing in the running world reads scores zero — sixteen subsystems have
shipped correct, instrumented and unread. A coupled yardstick inside a tool no verdict ever cited
has, by exactly the same argument, done zero damage: nobody believed anything because of it. The
harm function of this defect is not *"the tool is wrong"*, it is *"a green result was believed"*,
and belief is recorded in exactly one place in this project — the verdicts. Scoping B1 by
*capability* ("has a perturbation") is scoping by the property that makes a tool *testable*;
scoping by *citation* is scoping by the property that makes it *dangerous*. This project already
has a rule saying which of those to prefer.

**Second reason the plan did not give: for a cited tool, the verdict supplies a second, independent
expected value.** The YD test needs `E` and `O`; OPAQUE — the outcome the plan fears will swallow
the population — is precisely the case where the artifact publishes no `E` and the sweep has only
the tool's own output to read, which is the single-source condition that makes coupling
undetectable. A verdict that cites a tool as evidence for a green result **quotes the number it
believed**, in prose, in a file the tool did not write. That gives the sweep an `E` from outside
the tool for exactly the members where the damage is, and it means the re-scoped population is not
merely cheaper — it is the population on which the test is methodologically *able* to disagree.
An OPAQUE-heavy sweep of uncited tools is a sweep that cannot fail, which is the shape under
repair; a sweep over cited tools has a second source by construction.

**Where the handed move is wrong: it discards the prospective half.** A tool uncited today is cited
tomorrow, and the static half of B costs no perturbation runs at all. *Ruled, reversible:*

- **B1 (graded, dynamic YD)** runs over `P_cited` = tools cited by a wave-1 verdict as evidence for
  a green result, enumerated from `corpus/90-verdicts/` and committed as a list. Acceptance stays
  100% classified, and the denominator is now a number a reader can check.
- **B1b (reported, not graded)** is the static screen over the wide set, published as
  `n_screened / n_enumerated` with the OPAQUE fraction stated. Never a percentage without its
  denominator (the plan's own §7 item 5, upheld).
- **Overturned by:** `P_cited` coming out under ~8 members, in which case the graded population is
  too small to carry B1 and the wide set returns with OPAQUE reported as its own class.

Two arithmetic corrections that bear on this, both re-measured at `77439c0` and both cheaper to fix
now than in a browser: the harness carries **21** `__break*` verbs in `game/src`, not 30, and they
are **perturbations, not population members** — B1's units are "tools" while §5's shortlist counts
verbs, and one tool may drive several. My own grep counts differ from the plan's too (**121**
`tools/**.mjs` mentioning `self-test`, **147** mentioning a break/teardown/deletefix), which is the
plan's own point about mentions vs members and is exactly why the builder must publish the
enumeration rather than a count.

---

## CARRIED — declared risks, to be written into the build brief and graded later

1. **`type.wrap()` does not fix the over-wide single word either.** `type.js:41-54` emits
   `cur = words[i]` unshortened, identically to hud.js's inline copy; `ellipsise()` is a separate
   function that nothing in `wrap()` calls. The plan's §5 step 2 ("swap the inline wrap for
   `type.wrap()` + `ellipsise()`") therefore does **not** discharge §7 item 3 — the builder must
   apply `ellipsise()` per row explicitly, and say so.
2. **The swap is not behaviour-neutral.** `wrap()` calls `normalise()` (good — A3 is right to
   compare against `normalise(T)`) and splits on `\n`, emitting `''` for a blank paragraph. An
   empty row changes `row_count`, which changes the rect height, which changes the 3-row ellipsis
   ceiling. Assert `rows.every(r => r.length)` or handle it.
3. **The stroke halo.** `drawText` strokes with `lineWidth = face.stem * u * weight`, `lineCap`
   and `lineJoin` round (`glyphs.js:226-231`), so painted ink extends roughly half a stem beyond
   the advance box in every direction. A1 (advance-based) and any pixel-based check therefore
   measure different extents; the pixel checks need a stated halo tolerance, derived once and
   published, not tuned until the number passes.
4. **`advanceUnits()` remains the one source A1 shares with the wrapper** — the plan's §7 item 1,
   upheld. The A2a redesign narrows it but does not close it: the clip-free reference draw uses the
   same advance. The residual is now "the advance is wrong in the same direction in both", which is
   smaller and should be stated that way.
5. **Holding the clock for the frame pairs is precedented, not assumed.** `tools/harness/ui-pause.mjs`
   already measures a state where the sim frame delta is 0 over 120 steps (M-P1) and already does a
   UI-on/UI-off pixel diff with `pngjs` (P5); the toast only draws when `!m.inCombat`
   (`hud.js:249`), which is that state. Confirm it rather than assume it, and reuse that file's
   decode/diff rather than writing a third one.
6. **`sabotage.mjs` carries nine verdicts, not five** (`VERDICT` at `tools/experience/lib/sabotage.mjs:120-130`:
   OK, INERT, MASKED, VACUOUS, UNDERPOWERED, WRONG_DIRECTION, NO_MEASUREMENT, SHORT_CIRCUIT, ERROR,
   each with its own exit code). `COUPLED_YARDSTICK` is the tenth, and the plan must show it does
   not overlap INERT or VACUOUS before adding it. **I did not verify** that an arm in that module's
   SPEC can carry an expected-side value, which is the stated reversibility condition of ruling
   S-PLAN-HUD-B; it stays open and the builder must check it first.
7. **The plan's §7 items 2, 4, 5 and 6 are upheld unchanged** — the unexercised 3-row ceiling, the
   tools-not-verdicts scope boundary, the fraction-with-its-denominator discipline, and the W1-21
   ownership overlap. Item 6 additionally needs W1-26 declared if BLOCKING-3's second half is taken.
8. **The soft 24 px margin target** is correctly marked soft and correctly reasoned. Leave it soft.

---

## Model split — upheld, with one condition

| piece | plan | critic |
|---|---|---|
| A | Sonnet | **Sonnet, conditional.** PLAN-LOOP's middle row requires *a landed plan*. With BLOCKING-1 and -3 folded in, A1/A2a/A2b are machine-checkable against named instruments and nothing is a judgement call — Sonnet holds. If BLOCKING-1 is carried instead of resolved, A becomes *designing a measurement* and must go to Opus. |
| B | Opus | **Opus, upheld and strengthened.** The plan's stated risk (a Sonnet grep tuned until the list looks reasonable, never running the recall) is the right risk. BLOCKING-4 and -5 add a second: the population is now itself a ruling with a reversibility condition, which is top-row work. |

Haiku appears nowhere in this plan, which is correct — PLAN-LOOP is explicit that it is unproven
here and that no build should be its first job. The split's practical half (A needs a browser for an
hour, B needs none until its shortlist, so they must not queue behind each other) is sound and is
the strongest argument for splitting at all.

---

## What I could not do

- **No browser, by design.** Every claim above is static: source at `77439c0`, plus one offline
  node replay of `parchmentPath()`. I have not seen a frame, a register entry, or a toast.
- **I did not verify the plan's offline census** (75 strings, 58 over budget, 1013.5 px widest,
  2113 `name` fields, 870.0 px widest equip refusal). Those are the plan's numbers at `6bb9003` and
  the plan already tells the builder to re-derive them; re-deriving them here would have duplicated
  that work without checking anything the build will not check.
- **I did not verify `sabotage.mjs`'s arm model** can carry an expected-side value — see CARRIED-6.
  That is the open condition on ruling S-PLAN-HUD-B and I am leaving it open rather than guessing.
- **I did not confirm the four historical positives are re-seedable.** I checked that
  `tools/quests/faction-joining-probe.mjs`, `reports/w1-20/instrument-test.json` and
  `tools/dialogue/w1-17-r2-deletefix.mjs` exist; I did not open the W1-04, W1-25 or compliance-report
  records. BLOCKING-4 is about their *population membership*, which is decidable from the plan's own
  definition and does not need them opened.
- **`git log` for the `6bb9003`→`77439c0` span was read for the two files I lean on hardest**
  (`surface.js`, `text-register.js`) and not for the whole tree.

---

# VERDICT: **BLOCKED pending items 1, 2, 3, 4, 5.**

All five are text edits and every one has a ruled resolution written above, so exchange 2 is an
edit rather than an argument, and no third exchange is needed. **BLOCKING-1 is the one that
matters**: without it a build agent spends an hour of the box's only scarce resource on a control
that returns zero on both arms, and reports it as a pass — in the piece written to sweep for
exactly that.
