# PLAN — W1-HUD-TOAST: the toast that ran off the paper, and the check that could not see it

Plan-State: awaiting-remediation

**Plan agent, first use of the role. No browser launched, no `game/` source edited.**
All numbers below measured offline at **`6bb9003`** by importing `game/src/ui/glyphs.js`
(`measure`, `faceOf('ink')`, size 16, wrap budget `400 − 24 = 376`) in `node` and running it over
`game/data/dialogue/faction-refusals.json` and every `name` field in `game/data/**`. The throwaway
script is **not committed** — this role owns two paths — but the recipe is one paragraph and the
build agent should re-derive rather than trust it (rule 18). Rule 12: these are claims about
`6bb9003`, not about the project.

This plan splits into **two pieces**, deliberately, because they want different models and only
one of them needs a browser. Their acceptances are independent and either can land alone.

**BLOCKING-1, -3 and -6 folded in by the Piece A build agent at `9790db8`, before any `game/`
source was touched, per the dispatch condition below §6.** §1 Piece A's table, §3's instrument
list and §6 are edited in place to carry the ruled resolutions rather than the original text;
nothing was re-argued, and BLOCKING-6 was independently re-verified against
`game/src/harness/api.js:939-949` before relying on it. Piece B (BLOCKING-4, -5) is **untouched** —
its first measurement (the quoted-`E` fraction over the 133) is a separate agent's job and this
build does not open `tools/experience/lib/sabotage.mjs`.

**BUILD-TIME DEVIATION, reported per PLAN-LOOP's own rule ("a plan defect found at build time is
written back into the plan file").** §3's instrument table and §5 step 3 both say to "generalise
the `getUIState()` fit block" — i.e. edit `ui/system.js`'s `toast.fits`/`overflow_px` block
(:1154-1170) into a per-element loop. **The build agent did not do this, and chose not to, for a
reason the plan did not consider:** that block runs synchronously inside `state()`, which
`getUIState()` calls after `build()` has already painted the frame — there is no `since`-mark
taken before `build()` runs, so a register read *inside* `state()` cannot tell "this build's
entries for element X" apart from a stale entry left by an earlier build of the same element,
without either (a) requiring every caller of `getUIState()` to have already cleared the register
immediately beforehand (a silent precondition nothing enforces), or (b) `state()` clearing the
register itself, which would make `getUIState()` **destructive** to read — a second caller in the
same frame would find it empty. Both are worse than the alternative: **the register-backed,
per-element fit check (A1) lives in `tools/analysis/ui-census.mjs`, the instrument BLOCKING-2
already commits it to**, which is free to run the correct protocol per string (`renderedTextClear`
→ force a rebuild via `uiToast()` → read `getRenderedText({surface:'menus', owner:<id>})`) because
it, unlike `getUIState()`, is not a general-purpose accessor other code calls incidentally.
`ui/system.js`'s existing `toast.fits` block is **untouched** — it was already rect-derived, not
`maxW`-derived (W1-20's own fix), so it was not the coupled-yardstick shape and there was nothing
in it to repair. `game/src/render/text-register.js` and `game/src/ui/surface.js` gained an
additive **owning-element id** on each register entry (`surface.js el()` sets `ctx.__esOwnerId`
for the duration of one element's draw callback; the register reads it back), which is what makes
the per-element register read in `ui-census.mjs` possible at all — this is the "generalisation"
the plan asked for, moved one layer down from where it was specified. Declared here rather than
silently substituted.

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

**FOLDED IN, post plan-critic exchange 1 — BLOCKING-1, -3, -6 applied to the table below as text
edits, per the ruled resolutions in the critic section. This replaces the original A1/A2 row pair;
nothing here was re-argued, only applied.**

| id | predicate | acceptance | units |
|---|---|---|---|
| **A1** | `overflow_px = max(0, x1 − (rect.x + rect.w)) + max(0, rect.x − x0)`, where `[x0,x1]` is the horizontal extent of the drawn run **as recorded by `render/text-register.js`** on the `menus` surface. **`x0` is the `x` passed to `glyphs.drawText`** — the register records vector entries as left-aligned by construction (`text-register.js:217`), and this population's callers pre-centre each row themselves before calling `drawText`, so this is already the run's left edge; a caller that ever relied on `ctx.textAlign` is a register defect to report, not a thing this check compensates for. `x1 = x0 +` the pen advance accumulated by `glyphs.drawText` *while painting the glyphs* (`glyphs.js:255-256`). `rect` is the element's declared rect from `getUIState()`. Same clause vertically against `rect.y`/`rect.h`. **The register's `entries[].x`/`.w` are rounded to the integer px** (`text-register.js:246-247`) against a rect stored at 2 dp — so the acceptance below is stated as a ≤1 px band, not an exact zero, rather than trusting a 0.4 px overshoot to read as 0. | `overflow_px ≤ 1.0 px` for **100%** of (element, string) pairs in C | CSS px, 1920×1080, `devicePixelRatio 1`, `s = 1.0` |
| **A2a** (BLOCKING-1, decisive) | `cut_px` = ink pixels present in a **clip-free reference render** of the same string at the same position, face and size, and absent in the element's own (clipped) render — inside a band of `rect` inflated by the stroke halo (CARRIED-3: `lineWidth = face.stem * u * weight`, round cap/join, so painted ink extends roughly half a stem beyond the advance box; the halo tolerance is derived once, from the face's own `stem` at the toast's size, and published, not tuned until the number passes). The reference draw goes through `__HARNESS.drawOnMenus(text, {x, y, face, size, color})` (BLOCKING-6: signature extended additively; see §3) at the row's own `x`/`y`/face `ink`/size, matching the element render exactly — a reference drawn at a different position or in a different face cannot be differenced against the element render, which is the defect the first resolution shipped with. | `cut_px == 0` | pixels, 1920×1080 |
| **A2b** (BLOCKING-1, escaped-ink residue) | `escaped_px` = count of pixels differing by `>8` on any channel between `frame(uiToast(T1))` and `frame(uiToast(T2))`, **T1 and T2 chosen to have the same row count** (`rows.length`) so `h = max(toastH·s, rows·lineH + 20·s)` gives an identical rect, an identical `panel(...4242...)` seed and an identical deckle — outside `rect(T)`. **Not** toast-vs-null: `UISurface.el()` clips every element to its own declared rect (`surface.js:210-213`, *"The declared rect IS the clip. An element cannot paint outside what it declared"*), so `escaped_px == 0` is true **by construction** on both the fixed and the reverted arm when the comparison is toast-vs-null — that arm cannot fail and is retired as the acceptance's diff, kept only as informal colour. | `escaped_px == 0` | pixels, 1920×1080 |
| **A3** | no silent loss: `rows.join(' ') === normalise(T)` **or** `meta.truncated === true` | 100% of C | strings |

**Why the shape changed.** The original A2 measured escaped ink *outside* the rect and its null
control could not go red: the clip makes escaped ink impossible by construction, and the
parchment's own deckled outline (`parchmentPath()`, jitter amplitude ≤3.77 px at 1920×1080/s=1)
would have made it unconditional the other way had there been no clip. **The real defect is missing
ink inside the rect** (words cut at the panel edge), which is what A2a now measures, against a
clip-free reference draw of the *same* string in the *same* face at the *same* position — not the
generic harness sentinel at `(20,120)`/face `bone`, which BLOCKING-6 found A2a's first resolution
had silently substituted.

**Why still two tiers, restated.** A1 is cheap and can run over all of C; its extent comes from the
painting loop, so **breaking the wrapper cannot move it** — that is the whole point. A2a/A2b are the
decisive checks and run on a sample because each costs a frame (A2a) or a frame pair (A2b). Both
still share one source with the wrapper: `advanceUnits()` inside `glyphs.js` (CARRIED-4, narrowed
but not closed by A2a — the clip-free reference draw uses the same advance function, so the residual
is "the advance is wrong in the same direction in both draws", smaller than before).

Vacuity guard, mandatory on A2b (and its analogue on A2a — `cut_px`'s reference render must show
`ink_px > 0`, i.e. the clip-free draw must paint *something*, or the check is reading an empty
canvas): `changed_px_inside_rect > 0` for every sample and monotone non-decreasing with row count. A
diff that saw nothing reports `escaped_px == 0`/`cut_px == 0` and looks exactly like a pass — the
same mistake one layer down.

Soft target, CARRIED not blocking: `rect.w − (x1−x0) ≥ 24·s` (12 units of parchment each side).
It is soft precisely because 12 is a number the drawing code chose, and an acceptance that reads a
number the code under test chose is the defect this piece is about.

### Piece B — the coupled-yardstick sweep (`W1-INSTRUMENT-COUPLING`)

The graded population is **`P_E`**, frozen to the following 14 tools enumerated by
S-PLAN-HUD-B3: `tools/analysis/ui-forbidden.mjs`, `tools/experience/critic-w1-25.mjs`,
`tools/harness/critic-w1-16-live.mjs`, `tools/harness/critic-w1-16-r3-live.mjs`,
`tools/harness/prg-encumbrance.mjs`, `tools/journey/input-checks.mjs`,
`tools/journey/opening-play.mjs`, `tools/lore/canon-census.mjs`,
`tools/lore/critic-w1-23-r1.mjs`, `tools/lore/critic-w1-23-r3-reach.mjs`,
`tools/metrics/ui-metrics.mjs`, `tools/world/critic-road-join-ingame.mjs`,
`tools/world/road-through-building.mjs`, and `tools/world/w1-04-r3-exterior.mjs`.
The wider pinned census **`P_report`** is the 109 existing project tools cited by Wave-1 verdict
documents and declaring a perturbation at `9063779`; it is report-only. Publish the committed
109-path enumeration, the **95/109 (87.2%)** without a verdict-quoted external `E`, and any current
staleness, but never grade this population and never call `OPAQUE` a pass.

Per `P_E` member, the **yardstick-drift test (YD)** fires the declared perturbation and prints, per
graded row: observed `O`; the tool artifact's own expected side `E_tool`; the frozen value quoted by
the verdict `E_verdict`; and clean/perturbed verdicts. If **7 or more of 14** lack a readable
`E_tool`, the explicit S-PLAN-HUD-B3 overturn condition fires: B1′ is ungradeable, is reported as
such, and the piece reduces to B2 plus the report-only census. The builder does not invent a value.

| outcome | meaning |
|---|---|
| `ΔE ≠ 0` | **COUPLED** — the yardstick moved with the thing under test. The defect. |
| `ΔE == 0`, `ΔO == 0` | **INERT** — rule 6's known shape; hand to `sabotage.mjs` |
| `ΔE == 0`, `ΔO ≠ 0`, verdict flips green→red | **INDEPENDENT** — pass |
| missing `E_tool` in `P_E` | **ERROR / overturn-count member** — never OPAQUE, never pass |

| id | predicate | acceptance | units |
|---|---|---|---|
| **B1′** | every member of `P_E` classified into {INDEPENDENT, COUPLED, INERT, ERROR}, with `E_tool` and `E_verdict` printed per graded row | **14/14 classified; OPAQUE unavailable; fewer than 7 missing `E_tool`** | tools |
| **B1b** | wide `P_report` census | report **109 denominator, 95 without external E, and exact path list**; never graded | tools |
| **B2** | separately denominated shape recall against the four executable fixtures below, each run clean and re-seeded on a scratch worktree | **4 of 4 flagged as the named coupled/inert-control shape** | fixtures |
| **B3** | **false-positive discipline** against two known-good controls: W1-20's post-fix rect-derived `fits` (`ui/system.js:1157-1170`) and `tools/dialogue/w1-17-r2-deletefix.mjs` (a 2×2 whose control was watched going red) | **0 of 2 flagged** | instances |
| **B4** | `coupled_open == 0` at close — every COUPLED is either fixed or written into the gap ledger against the piece that owns it | 0 | tools |

**B2 is the acceptance, not B1′'s headline.** These are deliberate shape-recognition fixtures,
separately denominated because three are not members of `P_E`; scope is explicit rather than
silently widening the graded population:

| fixture | executable member and frozen expected side | exact re-seed mutation | observed side and required classification |
|---|---|---|---|
| W1-20 coupled `fits` | `tools/quests/faction-joining-probe.mjs` with `reports/w1-20/instrument-test.json`; expected fit derives from the toast rect, independently of the wrapper budget | on a scratch tree, restore the pre-fix `hud.js` single centred run and derive the probe's expected width from the same `maxW` supplied to wrapping | break the wrapper while moving `maxW`; both observed fit and expected fit move together and remain green → **COUPLED** |
| forged-map compliance | `tools/harness/critic-w1-map-r1.mjs` (the W1-MAP-r1 A1–A4 fixture); frozen expectation is zero squares for places never personally stood in | forge the one restore-consumed discovery footprint to cover all cells/42 sites, as the verdict's A fixture does | `places_drawn == places_discovered == 42` makes the self-report green although the independent expected count is 0 → **COUPLED** |
| W1-04 inert town-solids control | `tools/world/w1-04-r3-collision.mjs` §0 recreation at `e37d327`; expected off support is 0 town solids and the observed walk must differ | recreate the pre-fix verb by nulling `_townCell` before `_settleSettlementSolids(false)`, exactly as the tool's §0 arm documents | on/off walks are byte-identical because both execute walls-on; support does not change → **INERT CONTROL** |
| W1-25 optional-support facility | `tools/experience/critic-w1-25.mjs --a --b`; frozen expected classifications are A1/A3 ERROR or NO_MEASUREMENT, A4 NO_MEASUREMENT, B-COLLIDE-1 MASKED, B-COLLIDE-4 throw | on a scratch tree restore optional/unvalidated `support`, the pre-fix margin-before-masked ordering, and absent `support_note` validation in `tools/experience/lib/sabotage.mjs` | verdict changes with caller-chosen/omitted support rather than the arms; required classification **COUPLED** |

Fixture setup must assert the named clean-tree baseline first and print mutation-applied evidence
(source hash plus the exact changed lines) before scoring the seeded arm. A fixture that cannot be
reseeded is `ERROR` and fails B2; it is not silently replaced after results are seen. **3/4 is an
honestly reported failed result**, with the missed fixture named; only 4/4 passes.

---

## 2. The null control — the arm that must come out worse

**Piece A.** In a scratch worktree at HEAD, revert hud.js's E11 block to the **pre-W1-20 single
centred run** and run A1/A2a/A2b over the committed 395-string corpus. Do not restore the obsolete
75-string census and do not use toast-vs-null: the element clip makes escaped ink outside the rect
impossible in both arms.

*Must come out:* A1 reports `overflow_px > 1.0 px` for at least one committed over-budget string,
and A2a reports `cut_px > 0` for the widest reference-rendered sample while its clip-free reference
has `ink_px > 0`. The fixed arm must meet A1/A2a's §1 acceptances on the same population.

A2b remains a residue check, not the decisive null: compare two strings with the **same row count**
so their rect and seeded deckle are identical, require `changed_px_inside_rect > 0`, and then require
`escaped_px == 0`. Its purpose is to prove that the same-sized pair was actually differenced while
no ink escaped; clipping means `escaped_px` is not expected to worsen in the reverted arm.

*Inert would look like:* the revert's source hash does not change; A1 remains within 1 px for every
known over-budget string; A2a remains `cut_px == 0`; or either A2 reference paints/differences no
ink. Any of those invalidates the Piece A result. `escaped_px == 0` alone does not.

**Piece B.** The four re-seeded historical positives on scratch worktrees. They are real, dated
commits; their coupling is already on the record and is independent of anything this piece writes.
*Must come out:* the seeded arm and the clean arm differ **in exactly the seeded rows**, printed
per row, not as a count.
*Inert would look like:* identical classification on seeded and clean trees, a mutation whose
source hash did not change, or an unreadable expected side — a sweep that cannot read both `E`s
cannot disagree and must exit non-zero rather than manufacture `OPAQUE`.

**Neither null reads anything the fix touches.** A's extents come from the pen advance in
`glyphs.drawText` and from the framebuffer; B's come from commits that predate this piece. This is
stated explicitly because the defect under repair *is* a null computed from the thing under test.

---

## 3. Instruments reused, by path (rule 10 — build no second one)

| path | role |
|---|---|
| `game/src/render/text-register.js` | the drawn-string extents (`x`, `w`, per surface). Extend its record with the owning element id; do **not** write a second register. Its `clipped` flag is canvas-clip only — that is why it said `clipped:false` on a run that left its panel. |
| `game/src/ui/system.js` `getUIState()` | supplies declared rects only. Preserve its existing toast block; do not make this general accessor clear or interpret the per-frame text register. |
| `game/src/ui/type.js` `wrap()` / `ellipsise()` / `normalise()` | already exist. Replace hud.js's inline greedy wrap with them. |
| `tools/analysis/ui-census.mjs` | the existing browser-driving UI instrument, already carrying a `--self-test` that goes red on purpose. A1/A2a/A2b go **here**. Do not write `toast-fit.mjs`. |
| `game/src/harness/api.js` `__HARNESS.drawOnMenus()` (`:939-949`) | **added by BLOCKING-6.** The clip-free reference draw A2a needs. Extend the signature additively — `drawOnMenus(text, { x, y, face, size, color } = {})`, defaulting to today's five values (`20,120`, face `bone`, size 16, `#fff`) so the three existing callers (`w1-08-r2-probe.mjs`, `w1-26-opening.mjs`, `w1-26-r2-scene.mjs`) are untouched. A third owner declared against W1-21/W1-26. |
| `tools/harness/ui-pause.mjs` (`M-P5`, `:129-192`) | the precedent for a UI-on/UI-off pixel diff with `pngjs`, decode + centre-box arithmetic, over a state where the sim frame is held still. A2b reuses this file's decode/diff rather than writing a third one. |
| `tools/experience/lib/sabotage.mjs` | the control-integrity facility, now with **ten** verdicts (`:120-130`), not five/six as earlier drafts said. `COUPLED_YARDSTICK` is the **tenth**, not a new tool. Its contract — *"a control FAILS when its arms agree"* — needs one more clause: *and when the two sides read one source.* Piece B only; not touched by Piece A. |
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
3. Use the landed owning-element protocol: `surface.js` scopes `ctx.__esOwnerId` around each
element draw, `text-register.js` records that owner, and `ui-census.mjs` performs
`renderedTextClear` → forced rebuild via `uiToast()` → owner-filtered `getRenderedText()`; do not
generalise or make `getUIState()` destructive. 4. A1 + A2 into `ui-census.mjs`; `--self-test` breaks
the wrap and asserts red. 5. Run the §2 null worktree against the committed 395-string corpus. 6.
Rule 27: one blog line, and the shot is the
same sentence unwrapped and wrapped side by side.

**B.** 1. Commit the frozen 14-member `P_E` and 109-member `P_report` enumerations; report current
staleness without changing denominators after seeing outcomes. 2. Measure readable `E_tool` for all
14 and apply the ≥7 overturn rule before grading. 3. Add `COUPLED_YARDSTICK` to `sabotage.mjs` and
run YD over `P_E`, printing `O`, `E_tool` and `E_verdict` per row. 4. Run the wide static screen over
`P_report`, fenced so it can never publish "clean" and never graded. 5. Re-seed the four B2 fixtures
exactly as specified and run B3. 6. Fix or ledger every COUPLED; report 3/4 as a B2 failure.

---

## 6. BLOCKING unknown — CLOSED IN TEXT by BLOCKING-2, no browser needed

**Superseded finding, kept for the record: this section originally proposed querying
`getRenderedText({ surface: 'hud' })`. There is no surface named `hud`.** The renderer declares
exactly three — `dialogue`, `title`, `menus` (`render/renderer.js:124-129`) — and the HUD is on
`menus`, declared verbatim as *"ui/hud.js + ui/screens/* — the HUD and the menus, via
ui/glyphs.js drawText"*. `coverage()` with an unknown surface name yields `scope = []`, so
`complete = blind.length === 0 && scope.length > 0` is **false** and `entries` is `[]` — the
original proposal was itself an empty-set query, in a piece about checks that cannot disagree with
themselves. `complete: false` is the guard that catches it, but only if the caller branches on
`complete`, never on `entries.length`.

**Resolution, ruled, closed rather than carried: A1 exists.** The chain is static and complete:

1. `renderer.js:106` constructs `this.menus = new UISurface(...)`; `:129` calls
   `textRegister.instrument(this.menus.ctx, 'menus')` **unconditionally in the constructor** —
   there is no state in which a Renderer exists and the menus context lacks the hook.
2. `instrument()` installs `ctx.__esNoteText` (`text-register.js:216`).
3. `glyphs.drawText()` ends `if (ctx.__esNoteText) ctx.__esNoteText(s, x, y, adv, size)`
   (`glyphs.js:255-256`), with `adv` the accumulated pen advance — exactly the quantity A1 wants.
4. `ui/system.js:624` calls `drawHUD(S, ...)` inside `build()`, and `build()` is called from
   `getUIState()` as well as from `render()` (`:556-558`).
5. `surface.js:190-215` `el()` invokes the draw callback immediately, so the toast's `drawText`
   calls happen during `getUIState()`.

The corrected recipe is `getRenderedText({ surface: 'menus' })`, branching on `complete`, never on
`entries.length`. **The one real trap, which replaces the false one:** `build()` is cached per frame
on `(builtFrame, mode, touch/focus/pending signature)` (`system.js:600`/`601`), so a probe that
clears the register and then calls `getUIState()` twice on the same frame repaints nothing and gets
an empty register — an empty result that reads exactly like a clean one. Clear, then force a
rebuild (`ui.build(ctx, true)`, e.g. via `uiToast()` itself, which already forces one) or advance a
frame, then read; and assert `entries.length > 0` (or `distinct_count > 0`) before computing
anything from the entries.

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

## Exchange 1, completed after an interruption

**The first critic pass was killed by the weekly usage limit with its verdict written and three
things open.** This is the *same* exchange finished, not a second one — the loop is still bounded at
two, and exchange 2 remains an edit. Everything below is static, at `9063779`. Three of the four
additions are measurements the first pass named and did not take; the fourth is a defect in the
first pass's own ruled resolution.

### BLOCKING-6. A2a's resolution names a harness call that cannot draw the toast.

BLOCKING-1 replaces A2 with `cut_px` against "the same rows at the same positions" drawn through
`__HARNESS.drawOnMenus()`. **That function takes one argument and hardcodes everything the
comparison depends on** (`game/src/harness/api.js:939-949`):

```js
drawOnMenus(text) {
  ...
  drawGlyphText(ctx, s, 20, 120, faceOf('bone'), 16, '#fff');
```

Position `(20,120)`, face **`bone`**, colour `#fff` — while the toast draws in face **`ink`** at the
panel's centre. A reference draw at a different position, in a different typeface, cannot be
differenced against the element render to yield "ink present in the clip-free render and absent in
the element render". All three existing callers (`tools/harness/w1-26-r2-scene.mjs:594`,
`tools/harness/w1-26-opening.mjs:220`) pass text only, because their question is *did the register
see the string*, not *where did the glyphs land*. A1's resolution was checked against its
instrument; A2a's was not, which is the same class of error as BLOCKING-3 committed by the critic
rather than the plan.

*Resolution, ruled.* Extend the signature additively —
`drawOnMenus(text, { x, y, face, size, color } = {})`, defaulting to today's five values so the
three existing callers are untouched — and **declare `game/src/harness/api.js` as a touched file**.
The plan's §7 item 6 declares W1-21 and BLOCKING-3 adds W1-26; this adds a third owner. If the
extension is refused, A2a dies with it and A2b plus A1 carry Piece A alone — say so in the brief
rather than discovering it at build time.

### BLOCKING-5, revised on measurement. The re-scope is right and the plan's reason for it is false.

The plan offered `P_cited` because it is *"smaller, enumerable from the verdicts"*. The first critic
pass accepted the direction on better grounds and set a reversibility condition on the **floor**
(*"`P_cited` coming out under ~8 members"*). Nobody counted. Counted now, at `9063779`, over
`corpus/90-verdicts/wave1/` (145 files, 71 verdict JSONs):

| set | members | how |
|---|---|---|
| `tools/**/*.mjs` on disk | **786** | `find` |
| **P** — declares a perturbation | **244** | mentions `self-test`/`__break`/`teardown`/`deletefix` |
| **P_cited** — path appears in a wave-1 verdict, file exists | **459** | 471 distinct paths cited, 12 no longer on disk |
| **P_cited ∩ P** — cited *and* perturbable | **133** | the intersection |
| cited, no declared perturbation | **326** | **71% of the cited set** |

**The premise is false in the direction nobody guarded.** `P_cited` is **459**, nearly **twice** P's
244 — the re-scope makes the population *larger*, not smaller, and the reversibility condition was
written on the tail that was never at risk. The plan's own upper bound ("the union is under ~200")
is also low: it is 244.

**What survives, and it is the part that matters.** The harm argument (rule 5: scope by what makes a
tool *dangerous*, not by what makes it *testable*) is untouched by this. But the operative population
is neither parent set — it is the **intersection, 133 tools that are both cited and perturbable**.
That is a real denominator, smaller than either, enumerable today, and it is the only set on which a
dynamic YD test can both matter and run.

**And the plan's feared degeneration is now measured rather than feared.** §8 worried *"if most of P
turns out OPAQUE"*. On the cited set it is not a worry: **326 of 459 (71%) declare no perturbation at
all**, so they are OPAQUE by construction before a single tool is executed. A build agent would have
spent hours arriving at that number. It is the plan loop's whole thesis, and it is why B1b must be
reported with its denominator and never graded.

**Reason 2 of the first pass is materially weakened and must not be leaned on.** It claimed a cited
verdict *"quotes the number it believed, in prose, in a file the tool did not write"*, supplying an
independent `E`. Measured: of **520** verdict-prose lines citing a tool path, **49 (~9%)** also carry
a unit-bearing number on that line; the structured route is worse still — `gates_run` holds **7 rows
across all 71 verdict JSONs**, of which **2** carry both a tool and a number. Line-adjacency is a
crude proxy and a number may sit a paragraph away, so this is a bound, not a verdict. But the claim
"the verdict supplies a second independent E" is an assumption with ~9% line-level support, not an
established property. *Ruled:* keep reason 1 (harm), demote reason 2 to a **hypothesis the builder
measures first** — on the 133, count how many verdicts quote a checkable number for the tool they
cite — and publish that fraction **before** running any perturbation. If it lands under ~25%, the YD
test has no second source on most of its population and B collapses toward B2's four instances,
which is precisely the outcome §8 feared, reached by a different road.

*Revised reversibility:* overturned if the quoted-`E` fraction on the 133 exceeds ~50% (reason 2
revives and `P_cited ∩ P` can widen toward 459), **or** if it falls under ~25% (B1 is not gradeable
and the piece reduces to B2 + B1b reported).

### CARRIED-6, closed: `sabotage.mjs` has no expected-side slot, and the ruling survives anyway.

The first pass left this open as the stated reversibility condition of ruling **S-PLAN-HUD-B** and it
is decidable from the file. `runControl`'s `measure()` returns `{ value, support, detail? }` and each
arm is stored as `{ arm, broken, value, support, support_declared, detail, error, canon,
measured_nothing }` (`tools/experience/lib/sabotage.mjs:333-360`). **There is no expected-side value
anywhere in the arm model.** The three near-misses are not it:

- `spec.expect` (`:320`) is *"a VERDICT this case is expected to produce"* — an expected
  classification, not an expected number.
- `spec.margin` / `spec.direction` declare a *relation between arms*, not a yardstick.
- `spec.detail` is free-form and passes through untouched — a caller could stash `E` there, and that
  is exactly the loose convention whose round-1 equivalent (an optional `support`) is the defect this
  module was rebuilt to prevent. The file's own doctrine settles it: *"SUPPORT IS MANDATORY, AND ITS
  ABSENCE IS A VERDICT — not a throw"* (`:71`).

*Ruled: S-PLAN-HUD-B stands* — `COUPLED_YARDSTICK` is a verdict on this facility, not a new tool —
**and the plan must price the contract change it silently assumed.** It requires a new sibling to
`support` on the `measure()` return (absent-is-a-verdict, per the module's own doctrine), a change to
`validateSpec`, an entry in `VERDICT`, and an exit code: `EXIT_FOR` uses 0,2–7,10,11 with 8 and 9
reserved to the CLI, so `COUPLED_YARDSTICK` is **12**. The blast radius is bounded and small —
**9 files reference `runControl`**, 8 excluding the library — which is why the ruling holds rather
than splitting into a sibling module. It is the **tenth** verdict, not the sixth as the plan's §3
says; correct that line too.

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

### The routing rule this ruling generalises to, because `COST.md` will reuse it

`orchestration/COST.md` §4 makes model mix *"the largest single lever and it has barely been
pulled"* — **3,230 Opus requests against 29 Sonnet**, against a policy written in `PLAN-LOOP.md` and
almost never applied. So this ruling is not about one piece, and it should be stated as the rule it
implies rather than as a preference about A and B.

**The rule: route on whether the acceptance is *decidable without judgement at the time the agent
writes it*, not on how hard the subject sounds.** Piece A is a harder *engineering* job than Piece B
— it needs a browser, frame pairs, a clip-free reference draw, a halo tolerance — and it is the
Sonnet job, because after BLOCKING-1/-3/-6 land, every number it must produce has a predicate, an
instrument by path, and a threshold it cannot argue with. Piece B is mostly `grep` and bookkeeping
and it is the Opus job, because its central act is *choosing the population*, and this document just
demonstrated why: two successive readers accepted "smaller, enumerable from the verdicts" without
counting, and the count reversed it. **Difficulty is not the axis. Discretion is.**

Two corollaries this piece supports, both stated as reusable and both cheap to test:

1. **A plan that has been through this loop is itself a routing lever, and that is the largest
   uncosted saving in `COST.md`.** The middle row of PLAN-LOOP's table requires *a landed plan, an
   existing instrument, a machine-checkable acceptance* — three conditions that a plan-critic
   exchange is precisely the thing that manufactures. Before this exchange, Piece A had a predicate
   that measured the wrong side of the defect (BLOCKING-1) and a gating query over an empty set
   (BLOCKING-2); it was not a Sonnet job, because a Sonnet agent following it would have had to
   redesign the measurement. **The plan loop does not merely save a build round — it converts Opus
   builds into Sonnet builds**, and at 3,230-vs-29 that is the larger of the two effects and nobody
   has costed it. Recommend `COST.md` §4 lever 1 and lever 4 be measured as one coupled lever, not
   two independent ones.
2. **Critics stay Opus, unconditionally, and this exchange is the evidence.** Every finding that
   changed the plan — the clip, the empty-set surface name, the false "smaller" premise, the missing
   `E` slot, the hardcoded reference draw — came from *disbelieving a plausible sentence and going to
   the file*. `COST.md` §5 already forbids cutting a critic; this says the cheaper form of that cut
   (keeping the critic, downgrading it) is the same cut.

**What would change this ruling.** Stated so a successor overturns it with evidence, not argument:

- **Sonnet on A produces a build critic's round-2 finding that is a *measurement-design* error**
  (not a coding error) → the "decidable without judgement" line is drawn in the wrong place, and
  the browser-bearing half of a piece goes Opus regardless of how machine-checkable it reads.
- **Sonnet on A lands clean** → the rule is confirmed on its first real trial and the same test
  should immediately be run on a second piece with a landed plan, because n=1.
- **Opus on B produces a population it did not enumerate and commit**, or reports B1 without the
  quoted-`E` fraction → the failure the split was designed to prevent happened anyway, the model was
  not the operative variable, and the lever is smaller than `COST.md` §4 ranks it.
- **The measured cost of A (Sonnet) is not materially below a comparable Opus build** → routing is
  not the lever; look at cache economics (`COST.md` §4 lever 2) instead. This needs the per-model,
  per-token-class figures `COST.md` §2 names as ground truth, and **it must be measured on this
  piece rather than assumed** — the plan loop's own estimate was already wrong and low once.

One thing this ruling does **not** license: Haiku. Nothing here has trialled it, and `COST.md` §4
lever 1 and PLAN-LOOP both say the same thing — one mechanical task, measured, before it is trusted.
Piece B's static half looks like that task and **is not**, because its output is a population
definition that a later ruling rests on.

---

## What I could not do

- **No browser, by design.** Every claim above is static: source at `77439c0`, plus one offline
  node replay of `parchmentPath()`. I have not seen a frame, a register entry, or a toast.
- **I did not verify the plan's offline census** (75 strings, 58 over budget, 1013.5 px widest,
  2113 `name` fields, 870.0 px widest equip refusal). Those are the plan's numbers at `6bb9003` and
  the plan already tells the builder to re-derive them; re-deriving them here would have duplicated
  that work without checking anything the build will not check.
- ~~**I did not verify `sabotage.mjs`'s arm model** can carry an expected-side value — see CARRIED-6.~~
  **Closed in the completion pass above:** it cannot; the ruling survives with a priced contract
  change. CARRIED-6 is discharged and is no longer a carried risk.
- **I did not measure the quoted-`E` fraction properly.** The ~9% in revised BLOCKING-5 is
  line-adjacency in verdict prose — a number a paragraph away from its tool path is missed. It is an
  upper-bound-shaped proxy and it is written into the brief as the builder's *first* measurement,
  not as a finding. I state it because a 9% proxy and a 90% proxy would justify different pieces,
  and this one is closer to the first.
- **The 786/244/459/133 counts are `grep`-and-`find` set arithmetic**, so `P`'s membership inherits
  exactly the mentions-vs-members weakness the plan named in §8. The intersection is the *ceiling* of
  the gradeable population, never its floor; the builder still publishes the enumeration.
- **I did not open the W1-04, W1-25 or compliance-report records** (unchanged from the first pass),
  so BLOCKING-4 remains argued from the plan's own population definition rather than from the four
  instances.
- **I did not confirm the four historical positives are re-seedable.** I checked that
  `tools/quests/faction-joining-probe.mjs`, `reports/w1-20/instrument-test.json` and
  `tools/dialogue/w1-17-r2-deletefix.mjs` exist; I did not open the W1-04, W1-25 or compliance-report
  records. BLOCKING-4 is about their *population membership*, which is decidable from the plan's own
  definition and does not need them opened.
- **`git log` for the `6bb9003`→`77439c0` span was read for the two files I lean on hardest**
  (`surface.js`, `text-register.js`) and not for the whole tree.

---

# VERDICT: **BLOCKED pending items 1, 2, 3, 4, 5, 6.**

All six are text edits and every one has a ruled resolution written above, so exchange 2 is an edit
rather than an argument, and no third exchange is needed. Of the eight CARRIED risks, **CARRIED-6 is
discharged** (closed in the completion pass); seven carry into the build briefs as declared risks.

**BLOCKING-1 is still the one that matters**: without it a build agent spends an hour of the box's
only scarce resource on a control that returns zero on both arms, and reports it as a pass — in the
piece written to sweep for exactly that. **BLOCKING-5 is the one that changed most**: the re-scope
the plan proposed is right, its stated reason is false — `P_cited` is **459** against P's **244**,
so the "smaller" premise is backwards — and the operative population is the intersection, **133**.
**BLOCKING-6 is the one this critic owes**, because it is a defect in the first pass's own ruled
resolution: A2a was written against a harness call that draws a different typeface in a different
place, which is BLOCKING-3's error committed by the critic instead of the plan.

**Dispatch condition, ruled and reversible.** Piece A may be briefed to Sonnet the moment
BLOCKING-1, -3 and -6 are folded in; **Piece B must not be dispatched until its first measurement —
the quoted-`E` fraction over the 133 — is taken**, because that number decides whether B1 is
gradeable at all, and it needs no browser and no build agent.

> **CLOSED — see "MEASUREMENT — the quoted-`E` fraction" below, the last section of this file.**
> Taken by `measure-quoted-e-w1-hud-toast-b` at `9063779`, no browser, no build agent. The fraction
> is **14 of 109 = 12.8%** (**3 of 109 = 2.8%** for the bar a verdict actually graded against), on
> a population of **109**, not 133 — three of this section's five counts do not re-derive. The
> `<25%` branch of the revised reversibility condition fires: **B1 as written is not gradeable**,
> and a re-denominated **B1′ over the 14 named tools** is ruled in its place (S-PLAN-HUD-B3,
> reversible). **Piece B is dispatchable to Opus** once exchange 2's edit lands.

---

# MEASUREMENT — the quoted-`E` fraction. The exchange-1 dispatch condition, closed.

**Task `measure-quoted-e-w1-hud-toast-b`. Text only: no browser, no build agent, no tool executed,
no `game/` or `tools/` file written.** Every number below is a claim about **`9063779`** — the
critic's own commit — read off a pinned `git archive 9063779 tools corpus/90-verdicts/wave1`
snapshot outside the repo, because the working tree gained six `tools/**/*.mjs` from other agents
in the ten minutes this measurement took (rule 12; and a moving denominator is how the 786 went
wrong, see §3).

**The condition being closed**, exchange 1's last line: *"Piece B must not be dispatched until its
first measurement — the quoted-`E` fraction over the 133 — is taken, because that number decides
whether B1 is gradeable at all."*

**The headline, four lines.** The quoted-`E` fraction is **14 of 109 = 12.8%**, on an operative
population that is **109, not 133**. Under the strict reading of the claim it was measured to test —
a bar the verdict graded against *at the time it believed the result* — it is **3 of 109 = 2.8%**,
and one of those three is a verdict saying the bar is disputed. **The exchange-1 reversibility
condition fires as written: 12.8% is under ~25%, so B1 as written is not gradeable.** It is not
gradeable for a sharper reason than the fraction, and there is a re-denominated acceptance over
**14** that is — §4.

---

## 1. The counting rule

Stated so another reader gets the same number, and so a disagreement is locatable rather than
merely felt.

**A tool `t` in the operative population counts as E-QUOTED iff at least one wave-1 verdict
*document* states a specific expected value for a named graded row of `t` — a value `t`'s observed
output is to be compared against, written in a file `t` did not produce.**

- **Corpus:** `corpus/90-verdicts/wave1/*.md` and `*.json` only. The `artifacts/` subtree is **not**
  a verdict: it holds 443 tool-written reports and **112 copied tool sources**, so a path found
  there can be a tool citing itself. §3 measures what that exclusion costs.
- **Attribution unit:** the enclosing prose block — a blank-line paragraph in `.md`, or one JSON
  string value in `.json`. Nothing outside the block counts. This is deliberately more generous
  than exchange 1's line-adjacency proxy (verdict prose wraps at ~95 columns, so a line is usually
  half a sentence) and deliberately less generous than the file, which would score ~100% and
  measure nothing.
- **The value** may be numeric (`0`, `≥15 of 19`, `at most 3× 9.3 per 10k`, `ΔE ≤ 3`) **or** a
  literal (`[]`, `false`, `true`, `ERROR`, `NO_MEASUREMENT`).

**What does not count. Every one of these was met in the corpus and ruled out:**

| # | excluded | why | example met |
|---|---|---|---|
| a | outcome words with no value — "passes", "exits 0", "green", "goes red" | names the verdict, not the yardstick; a sweep has nothing to hold fixed | *"Acceptance: `node tools/quests/critic-glyph-audit.mjs` exits 0"* |
| b | observed readings | that is `O`; YD already has `O` from the tool | *"exit 1 — 42 hits"* (`marker-scan.mjs`); *"5 of 32"* (`critic-chain-headless.mjs`) |
| c | `N/N` self-test tallies | the bar is "all of them" and the denominator is printed by the tool itself — no independent side | *"`--self-test` passes 10/10"* (`canon-census.mjs`); *"6/6"* (`smoke.mjs`, `arbiter-map-s38.mjs`) |
| d | command lines and artifact listings | `--steps 60000` is a parameter, not an expectation. Keys `build.harness_commands`, `artifacts[].produced_by`, `evidence[]`, `files_touched` excluded structurally | *"`node tools/platform/alloc-probe.mjs --steps 60000`"* |
| e | descriptive sizes | populations, not bars | *"25 checks"*, *"139 modules"*, *"121 `entry_topics` rows"* |
| f | directional expectations | a comparator with no value cannot be frozen | *"require the count to rise"* (`critic-road-join-ingame.mjs` remedy); *"must raise the `Which` count"* |
| g | a bar the verdict restates **from the tool's own source** | quoted, but not independent — which is the entire point | *"the shipped `--self-test` clears a fixture at band ≥ 4"* (`critic-w1-23-r4-band.mjs`) |

**Borderlines ruled the other way — counted, and each one changes the number:**

- **Non-numeric literals count.** `critic-w1-16-r3-live.mjs`: *"reports
  `states_whose_ROLL_TIER_changes_across_a_save_and_reload: []` and
  `equip_load_moved_across_the_save: false` on every pinned row."* `[]` and `false` are values a
  sweep can freeze and serve YD exactly as a number does. Exchange 1's proxy counted "unit-bearing
  numbers" and would have missed all four instances of this shape; it is the main reason 12.8% is
  above its ~9%.
- **Categorical row-values count.** `critic-w1-25.mjs`: *"A1 and A3 must become ERROR or
  NO_MEASUREMENT rather than OK; A4 must become NO_MEASUREMENT; B-COLLIDE-1 must become MASKED."*
- **A reference item's bar counts** when the tool's row is graded against it. `canon-census.mjs`:
  *"27 fully-voiced disputes against a bar of 8 and a band-5 bar of 10."* The 8 is RI-LOR06's, not
  the tool's — that is precisely the independence YD needs, and it is the best instance in 109.
- **A contested bar counts, and is flagged.** `ui-metrics.mjs`, in `arbitration_questions[]`:
  *"RI-UIX06 FD6 specifies deltaE <= 3 with a hard fail above 8; `tools/metrics/ui-metrics.mjs`
  measures a 0-255 luminance overshoot against 40. Which is the bar?"* This is the one case in 109
  where a verdict states an external `E` **and says it disagrees with the tool's own**. It is
  counted, and it is worth more to Piece B than the other thirteen put together.
- **A generator's output bar does not count.** `build-property.mjs`: *"so the 235 placed locks
  include >= 40 at tier 1"* — ruled OUT, because ≥40 is checked by a probe over the emitted data,
  not by a row of `build-property`'s own artifact. If a successor disagrees with one ruling, expect
  it to be this one.

**Method.** A screen over all 109 collected every prose citation and kept those with a surviving
numeric token after stripping commit hashes, dates, `path:line` refs, item ids and rule/round
numbers; 17 tools had no numeric prose context at all and 10 were cited only in command/artifact
listings, and all 27 were then read anyway to catch literal (`false`, `[]`) expectations that carry
no digit. The remaining **82 were read by hand, in full context, and ruled individually.** This is a
census of 109, not a sample of it — a 40-tool sample taken first gave 5/40 with a Wilson interval
whose upper edge (26.1%) straddled the decision boundary, which is exactly the situation in which an
estimate is worthless. The census also **corrected the sample**: `critic-road-join-ingame.mjs` was
ruled NO on the sample's contexts and YES on the full set, because the acceptance clause quoting its
`E` was not among the first contexts shown.

---

## 2. The number

| tier | count | fraction of 109 |
|---|---|---|
| **E-QUOTED** — an external expected value for a named row of the tool | **14** | **12.8%** |
| of which the bar is **contemporaneous** — the yardstick the verdict graded against when it believed the result | **3** | **2.8%** |
| of which the bar is **forward** — an acceptance written for the *next* round's fix | 11 | 10.1% |
| no external `E` anywhere in any wave-1 verdict document | **95** | **87.2%** |

**The 14, committed as a list** (this is the enumeration B1′ in §4 is denominated on):

```
tools/analysis/ui-forbidden.mjs           tools/lore/canon-census.mjs              [contemporaneous]
tools/experience/critic-w1-25.mjs         tools/lore/critic-w1-23-r1.mjs           [contemporaneous]
tools/harness/critic-w1-16-live.mjs       tools/lore/critic-w1-23-r3-reach.mjs
tools/harness/critic-w1-16-r3-live.mjs    tools/metrics/ui-metrics.mjs             [contemporaneous, contested]
tools/harness/prg-encumbrance.mjs         tools/world/critic-road-join-ingame.mjs
tools/journey/input-checks.mjs            tools/world/road-through-building.mjs
tools/journey/opening-play.mjs            tools/world/w1-04-r3-exterior.mjs
```

**Where the `E`s live, and it is one field.** Eleven of the fourteen sit in
`biggest_gap.remedy.acceptance` or `other_gaps[].remedy.acceptance`. That is a bar written for the
round that comes *next*, not the bar the verdict used. It is still usable by YD — it is external,
specific and frozen — but it is not the thing exchange 1's reason 2 claimed.

**So reason 2, measured against its own words.** It claimed *"a verdict that cites a tool as
evidence for a green result **quotes the number it believed**, in prose, in a file the tool did not
write."* Tools for which a wave-1 verdict quotes the bar it graded against at the time:
**3 of 109 — 2.8%** — and one of the three (`ui-metrics.mjs`) is a verdict recording that it does
**not** know which bar applies. Exchange 1 demoted this argument to a hypothesis on a ~9%
line-adjacency proxy and was right to; measured properly, with a *more* generous attribution window
and a *broader* notion of value, the claim as written is **2.8%**, not 9%. The proxy was not
pessimistic. It was optimistic.

**One smaller correction to the population's meaning.** B1's population is *tools cited as evidence
for a **green** result*. **7 of the 109** are cited only in a context that says the tool is absent,
broken, unrun or uncited — `gamepad-shim.mjs`, `perf-run.mjs` (*"does not exist"*),
`critic-w1-23-r5-consume.mjs` (*"cannot run on HEAD"*), `critic-differential.mjs` (*"is a BROKEN
PROBE and its verdict line is wrong and must be ignored"*), and three more. Small, and it moves the
denominator the same way everything else here does: down.

---

## 3. The counts re-derived — three of the five disagree

Method for every row: `git archive 9063779`, then `find`/`git ls-tree` and the regex printed beside
it. Nothing below depends on the working tree.

| set | exchange 1 | re-derived at `9063779` | verdict |
|---|---|---|---|
| `tools/**/*.mjs` on disk | **786** | **776** | **DISAGREE.** 786 = 776 project tools **+ 10 vendored third-party files under `tools/node_modules/`** (`playwright/index.mjs`, `fast-uri/benchmark/*.mjs`, `@jsquash/avif/…worker.mjs`). The arithmetic is exact: `git ls-tree -r 9063779 -- tools \| grep -c '\.mjs$'` = 776, `find` = 786, the difference is `node_modules` to the file. None of the ten is a tool of this project. |
| **P** — declares a perturbation | **244** | **198** (case-sensitive) / **202** (case-insensitive) | **DISAGREE, and not reproducible from the published rule.** The rule as printed is *"mentions `self-test`/`__break`/`teardown`/`deletefix`"*; that yields 198. Nine regex variants were tried and none lands on 244 (they span 202–262; adding the prose form `delete-the-fix` gives 254, adding `selfTest` too gives 261). I report mine with its rule rather than guess at one that reproduces theirs. |
| distinct `tools/**.mjs` paths cited anywhere under `wave1/` | **471**, 12 not on disk → **459** | **471**, 12 not on disk → **459** | **AGREE, exactly** — including the 12. |
| the same over verdict ***documents*** only | — | **462** distinct, 12 missing → **450** | **NEW.** Exchange 1's 459 counts the `artifacts/` subtree, which contains 112 copied tool sources and 443 tool-written reports. The correction is small (9 paths) but the definition matters: a tool named inside its own copied source is not a tool a verdict cited. |
| **P_cited ∩ P** — the operative population | **133** | **112** over the whole subtree / **109** over verdict documents | **DISAGREE.** The intersection is the product of the two errors above; 133 inherits P's inflation. **109** is the number this measurement is denominated on. |
| cited with **no** declared perturbation | **326** = 71% | **347 of 459 = 75.6%** (subtree) / **341 of 450 = 75.8%** (documents) | **DISAGREE — and the disagreement strengthens exchange 1's own conclusion.** The share of the cited set that is OPAQUE-by-construction before a tool is executed is *worse* than reported, not better. |

**The shape of the error is the same one exchange 1 caught in its predecessor, one level down.** Two
readers accepted "smaller, enumerable from the verdicts" without counting; exchange 1 counted, and
then took `find | wc -l` for a population of *this project's tools* without asking what `find` was
walking. `tools/node_modules/` has been in the tree the whole time. The correction is 10 files out
of 786 and it changes nothing important — but the same habit, applied to P, produced a 23% inflation
that carried straight into the operative denominator, and **that** changes the piece.

---

## 4. Verdict on gradeability — B1 as written is not gradeable, and B1′ over 14 is

**The condition fires.** 12.8% < ~25%, so exchange 1's revised reversibility condition applies as
written: *"if it falls under ~25%, B1 is not gradeable and the piece reduces to B2 + B1b reported."*

**But the reason is sharper than the fraction, and it should replace it in the brief.** B1's
acceptance is *"every member of P classified into {INDEPENDENT, COUPLED, INERT, OPAQUE, ERROR} —
**100%** of a committed enumeration."* Every member can always be assigned one of five classes, and
**OPAQUE is one of them**. On this population OPAQUE is the modal outcome by construction: 95 of 109
have no external `E`, and for any of those whose own artifact also publishes no expected side, the
sweep has no second source and must return OPAQUE. **B1 would score 100% while establishing
nothing** — an acceptance that cannot go red, inside the piece written to sweep for acceptances that
cannot go red. That is the finding. The fraction is only how we got to it.

### S-PLAN-HUD-B3 — ruled, reversible: re-denominate rather than delete

Exchange 1's condition says "reduce to B2 + B1b reported". I execute it, and rule that the reduction
should not throw away the graded half, because a graded population now exists and it is enumerated
above:

> **B1′ (graded).** Over `P_E` = the **14** tools listed in §2, fire each tool's declared
> perturbation and classify **each graded row** INDEPENDENT / COUPLED / INERT / ERROR by comparing
> the tool's own expected side, before and after, **against the verdict's frozen quoted value**,
> printed per row beside it. **Acceptance: 100% of 14 classified, with both `E`s printed per row;
> `OPAQUE` is not an available outcome**, because an external `E` exists by construction for every
> member. Publish the COUPLED count over the denominator **14**, never as a percentage.
>
> **14 clears exchange 1's own floor** of *"~8 members, below which the graded population is too
> small to carry B1."*
>
> **Overturned by:** the builder finding that **the tool's own artifact publishes no readable
> expected side for 7 or more of the 14** — in which case B1′'s rows collapse to a one-sided
> comparison, `OPAQUE` returns as a legitimate outcome, and the piece reduces to B2 + B1b exactly as
> exchange 1 said. That is the next measurement and it needs no browser either (§5).
>
> **B1b (reported, never graded)** keeps the wide denominator: **109** cited-and-perturbable, of
> which **95 (87.2%) have no external `E`** — published as that fraction with that denominator
> (§7 item 5, upheld).
>
> **B2 is unchanged and is still the acceptance**, with BLOCKING-4's correction: the four historical
> positives must each be named through the member of `P_E` (or `P`) the sweep would meet them in, or
> moved into a separately-denominated shape-recognition check.

**Why this is worth buying rather than dropping.** `ui-metrics.mjs` alone justifies the graded half:
a verdict states an external bar (ΔE ≤ 3, hard fail above 8), records that the tool measures against
**40**, and files it as an open arbitration question. That is a coupled-yardstick candidate already
sitting in the corpus with both sides written down by different authors — the single cheapest true
positive Piece B could possibly have, and it is inside the 14.

---

## 5. What I could not do

- **I did not measure the other half of gradeability**, and it is the larger half: whether each
  tool's **own artifact** publishes a readable expected side. YD reads `E` from the tool; the
  verdict-quoted `E` measured here is the *second* source. If a tool publishes its own `E`, YD works
  on it whether or not any verdict quotes a bar — so the true gradeable population is a **superset**
  of the 14, and 14 is a floor, not a ceiling. That measurement needs no browser and no build agent
  either, it is the stated overturn condition of S-PLAN-HUD-B3, and it should be the next text-only
  dispatch. **I state this plainly rather than letting 12.8% read as the whole answer, because it
  is not.**
- **I ran no tool and opened no tool's source.** Every ruling is from verdict prose. A tool whose
  artifact obviously publishes an `E` scores NO here if no verdict quotes one.
- **The 82 hand-rulings are judgement**, made against the rule in §1 and reproducible only to the
  extent that rule is followed. The six borderlines most likely to move are named in §1;
  `build-property.mjs` is the one I would expect a successor to overturn. A second reader applying
  §1 should land within ±2 of 14, and if they land outside that the rule is wrong, not the count.
- **Attribution is the enclosing block.** A bar stated three paragraphs from its tool path is missed.
  This is exchange 1's own stated weakness, reduced from a line to a paragraph, not removed.
- **I could not reconstruct exchange 1's 244** from any of nine regex variants (202–262). I state
  198 with its rule rather than fitting a rule to a number.
- **I did not verify the 14 tools run today**, or that their declared perturbations still fire.
- **I did not open the W1-04, W1-25 or compliance-report records** — BLOCKING-4 is untouched by this
  measurement and remains as exchange 1 left it.

---

## VERDICT ON THE DISPATCH CONDITION: **CLOSED.**

The quoted-`E` fraction over the operative population is **14 of 109 = 12.8%** (**3 of 109 = 2.8%**
for the bar the verdict actually graded against). The population is **109**, not 133; the wide
tool count is **776**, not 786; **P** is **198**, not 244; and the OPAQUE-by-construction share of
the cited set is **75.8%**, not 71%. **B1 as written is not gradeable** — not because 12.8% is
small, but because its acceptance admits OPAQUE and therefore cannot go red. **B1′ over the 14 named
tools is gradeable**, and is ruled in above as S-PLAN-HUD-B3, reversible on one further text-only
measurement.

**Piece B is dispatchable — to Opus** — once exchange 2's edit folds BLOCKING-1..6 and this section's
B1′/B1b denominators into the plan text. Opus and not Sonnet on the project's stated axis: B1′'s
acceptance is now decidable without judgement (this section made that judgement and wrote it down),
but **BLOCKING-4 is not** — deciding how the four historical positives enter the swept population,
and whether a missed one is a recall failure or a scope error, is discretion with no written rule,
and the piece's own text says *"B2 is the acceptance, not B1's headline."* The discretion moved; it
did not leave.

## Fresh plan critique — 2026-08-09

**Verdict: BLOCKING.** Piece A has already been built and the later measurement supplies a sounder
Piece B ruling, but the operative acceptance section was never remediated to match that ruling.
This is not a cosmetic history problem: a builder following §1 today would run a different,
partly-vacuous population from the one the plan's own final section authorises.

1. **BLOCKING — the plan has two incompatible Piece B specifications.** §1 still defines broad `P`,
   permits `OPAQUE`, and grades B1 as 100% classification. The later S-PLAN-HUD-B3 correctly rules
   that this cannot go red, replaces it with `P_E` (the enumerated 14), forbids `OPAQUE` in the
   graded result, and makes the 109-tool census report-only. Fold B1′/B1b into §1 and point at the
   committed 14-member enumeration; historical critique text cannot serve as the build contract.
2. **BLOCKING — B2 contradicts itself.** Its table requires **4/4** historical positives, while the
   paragraph immediately below says **3/4 is a result, not a failure**. Keep 4/4 as the acceptance
   and state that 3/4 is an honestly reported *failed* result, or lower the bar through the existing
   ruling mechanism. A predicate cannot both pass and fail at 3/4.
3. **BLOCKING — the four positives still lack executable membership/fixture rules.** The final text
   explicitly leaves BLOCKING-4 unresolved. For each positive, name the member tool, frozen expected
   side, exact reseed mutation, observed side, and why it belongs to the graded population. If one
   is a scope error, replace it before dispatch rather than letting the builder decide after seeing
   recall.
4. **BLOCKING — the canonical document only now receives its required state marker.** Keep the
   marker at the top, mirror it in the piece status, and separate already-built Piece A state from
   not-yet-build-ready Piece B so `satisfied` cannot accidentally redispatch A.

**Remediation acceptance:** rewrite the operative Piece B table and steps from S-PLAN-HUD-B3,
resolve the four fixtures and 4/4 semantics, preserve the historical exchange as evidence, and mark
the plan `awaiting-recriticism`. Do not change or rebuild Piece A while remediating this text.


---

## Fresh plan re-critique — 2026-08-09

**Verdict: BLOCKING.** The Piece B remediation now matches S-PLAN-HUD-B3: it freezes `P_E` and
`P_report`, removes OPAQUE from grading, makes 4/4 the only B2 pass, and gives every historical
positive an executable fixture. Piece A is not ready to be treated as a coherent preserved plan,
however, because its operative null-control section still describes the retired measurement.

**One actionable biggest gap:** rewrite Piece A's §2 null control (and the stale §5 instruction) to
match A2a/A2b and the recorded build-time deviation. It currently requires `escaped_px > 0` from the
pre-W1-20 arm even though §1 explains that the element clip makes escaped ink impossible by
construction and retires toast-vs-null; it also retains the obsolete 58/75 denominator after the
landed corpus re-derived 395 strings. The same plan then says that an `escaped_px == 0` arm invalidates
everything, so following §2 literally rejects both the fixed and broken builds. Specify the A2a
`cut_px` worsening on the committed population, retain A2b only with a same-row-count pair and its
non-empty diff guard, and replace §5's instruction to generalise `getUIState()` with the owning-element
register protocol already ruled in the build-time deviation. Preserve Piece A's landed code and do
not redispatch it while repairing this plan text.

**Recommendation:** remediate those two stale operative instructions only, then request fresh
re-criticism. Piece B needs no further substantive rewrite from this pass.

---

## Fresh plan re-critique 2 — 2026-08-09

**Verdict: BLOCKING.** The Piece A remediation closes the prior finding: its null now worsens A1
and A2a over the committed corpus, treats A2b as a guarded residue check, and uses the landed
owning-element register protocol. The Piece B fixture contract also remains executable. The
operative B1′ acceptance, however, gives `ERROR` two contradictory meanings and therefore does
not determine whether the piece passed.

**One actionable biggest gap:** make missing `E_tool` semantics consistent across Piece B §1. The
classification table says a missing `E_tool` is `ERROR` and **“never pass”**, but B1′ accepts
14/14 classifications with **fewer than 7** missing values. As written, a run with six `ERROR`
rows simultaneously satisfies the aggregate acceptance and contains six rows forbidden from
passing. Choose one deterministic contract: either require zero `ERROR` rows for B1′ to pass, or
state explicitly that 1–6 errors make B1′ a reported, non-passing partial result while the
S-PLAN-HUD-B3 reduction fires at 7. Preserve Piece A's landed code and the four B2 fixtures; only
the B1′ error/overturn wording needs remediation before another fresh re-critique.

**Recommendation:** remediate the B1′ aggregate predicate and its adjacent missing-`E_tool` text,
then request fresh re-criticism. Do not redispatch or rewrite Piece A.
