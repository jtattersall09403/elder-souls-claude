# W1-UIX08 addendum — finishing the run, the delete-the-fix arm, and what they found

**This is a builder's completion note, not a verdict.** Rules 22/25: a builder does not grade
itself. `reports/uix08/EVIDENCE.md` (2026-08-14) is the original evidence; this file is what
changed on 2026-08-15 finishing the piece's own `next_step` — the probe run, the delete-the-fix
control, and the human gate handoff. **A critic should read both files, not just this one.**

Everything below states the commit or command it came from, per rule 12 and CLAUDE.md's
before-every-dispatch check.

## 0. What could not be done, first

- **`RI-UIX08` §G, the human gate, was not run.** Same reason as 2026-08-14: a builder may not
  judge its own work (rules 22/25), and `create_session` is approval-gated on this box (rule 0).
  The ablated arm (`__ENGINE.ui.dialogueArm.links = false`) is built, live, and captured in the
  screenshot pack below. **Score §G `not_run`; under the item's own aggregation that caps this
  piece at 2 until a fresh judge runs it.**
- **D2 (following a link APPENDS) is FAIL on the one live example this round followed, and the
  cause is explained in §3 below rather than hidden.** It is very likely a probe-strictness issue,
  not a window defect — but it was not re-verified against a second, answerable example before
  this note was filed, and a critic should.
- **C2 (colour ΔE) is FAIL at `stormhold-street`** (link ΔE 15.52, column ΔE 21.06) while it PASSes
  at `helstrom-market` (column ΔE 2.85, link not sampled — no link was on screen there). See §4.
  Not resolved here; flagged for a critic with the two candidate explanations named.
- **H3 (prose measure) is FAIL**: narrowest landscape measure is **37 chars/line**, against
  `RI-UIX05`'s 45–75 band. This is a *directive §2* check this probe added on its own initiative,
  not one of `RI-UIX08`'s own scored rows (§Scoring lists §A, §B, §C1, §C-colour, §D2, §E1, §G) —
  but it is a real, honestly-measured number and a critic judging legibility should see it.
- **A `stormhold-street` screenshot pack (the scene that actually shows a lit inline link) was
  attempted and killed unfinished** after the shared box hit a load average of ~25/4 cores and the
  capture sat at 0.7% CPU for 6.5 minutes doing nothing (§6). The numeric `stormhold-street`
  results are unaffected (they came from an earlier, completed headless run); only that scene's
  picture is missing. What's on disk and cited in §6 is the complete `helstrom-market` pack from
  earlier in this session.

## 1. Baseline commit, pinned per HAZARDS §12

**`dc3f9a8051fc27786fed4603b06c553985783639`** — read with `git rev-parse HEAD` before touching
anything, at the start of this session. `HEAD` moved several times afterward (siblings' banks);
the delete-the-fix arm below was built from a `git worktree add <scratch> dc3f9a80 --detach`, i.e.
an actual checkout of that commit's tree, **not** a hard-link of the live, moving working
directory (`tools/control-clone.mjs make` hard-links current disk state, which on this box's
13-owner-contended `game/src/engine.js` is not the same thing as the pinned commit — see
`node tools/ownership.mjs --for game/src/engine.js`, run this session, 13 live pieces). `tools/
node_modules` and root `node_modules` were symlinked into the worktree per `HAZARDS.md` §7.

## 2. The probe run, finished

`node tools/ui/dialogue-window-probe.mjs`, default state `helstrom-market`, this session:
**22/25 checks passed.** Full output `reports/uix08/window-probe.json` (this run overwrote
2026-08-14's file of the same name; the new one is timestamped `2026-08-15T08:03...Z` in its own
`at` field). Three failures, all at the same NPC (`agaceph-sheem`, 11 known topics):

- **D1 (an inline link exists to follow): FAIL — "0 links in 64 lines of prose over 11 linkable
  topic(s)".** This is the greeting-is-not-a-page-of-prose case EVIDENCE.md §5 already documented:
  Sheem's short answers over these 11 topics genuinely do not contain any of the AddTopic targets
  this conversation has been handed. **This is corroborated as a content-shallowness issue, not a
  window defect, by running the same probe against a second NPC** — see §3.
- **C1 (every colour family sampled): FAIL — "not sampled: link"**, entailed by D1: no link ever
  drew, so there was nothing to sample. Same root cause, not a second defect.
- **H3: FAIL**, as above.

## 3. A second speaker, to separate "the mechanism is broken" from "this greeting is short"

`node tools/ui/dialogue-window-probe.mjs --state stormhold-street` (state chosen because it is one
of the few shipped states with more than one NPC present — checked directly:
`python3 -c "import json;print(len(json.load(open('game/data/states/stormhold-street.json'))['npcs']))"`
→ **3**, against `helstrom-market`'s single Sheem). Speaker **Cassius Melo**, disposition 24/100,
8 linkable topics. **24/26 checks passed:**

- **D1: PASS — "1 link(s) in the transcript, 1 on screen, over 8 linkable topic(s)".** The
  mechanism does light a real inline link, live, in the running game, when the conversation has
  something to say. This is the check the whole item is written for, and it is corroborated here
  rather than only asserted from the offline census.
- **D1b, D3, D4: all PASS.** The link is on screen after the caret walks to it, the followed
  topic (`the-drains`) is in the column afterward, and `quest.topicsKnown` did not regress (6→6 —
  see §5 for why it did not go up).
- **D2: FAIL — "17 -> 17 lines".** The one link this run followed (`link_topics[0]`, whichever the
  engine offered first) turned out to be a topic Cassius Melo personally has no bespoke line
  about. `game/src/engine.js`'s own comment at the `_convPending` site (search
  `THE BLUE WORD'S PROMISE, KEPT WHEN THIS PERSON HAS NOTHING TO SAY`) documents this exact case:
  `conversationSay()` returns `{refused:'no_info'}`, no line is appended (correctly — there is
  genuinely nothing to append), but the topic is still learned via `_dlgAdds` (which is exactly
  what D3 and D4 both just confirmed). **D2's assertion ("following a link APPENDS") is true for
  an *answerable* link and not, by the window's own documented design, for a link whose target
  this speaker cannot answer.** The probe does not currently distinguish the two cases before
  asserting D2; that is a probe gap, not a demonstrated window defect, but it was not re-run
  against a guaranteed-answerable link before this note was filed — flagged for a critic rather
  than resolved.
- **N1–N3 (the ablated arm): all PASS**, same as `helstrom-market`.
- **E1, E1b, E2 (translucency): all PASS.**
- **C1: PASS** (5 of 5 sampled — a real link was on screen this time). **C2: FAIL**, see §4.
- **C3: PASS** (column is bronze, not the owner capture's green).

Full output: `reports/uix08/probe-stormhold/window-probe.json` (headless colour/geometry pass) and
`reports/uix08/probe-stormhold-shots/window-probe.json` (the same state, re-run with the
screenshot pack, 10 new images in `docs/shots/` — see §6).

## 4. The stormhold-street colour anomaly, named rather than resolved

At `helstrom-market` the column ΔE is 2.85 (bar: ≤8). At `stormhold-street` the **same check**
reads column ΔE 21.06 and link ΔE 15.52 — both over bar. Two candidate explanations, neither
confirmed:

1. **Focus/hover bleed.** The probe walks the input caret onto the link and the column row it
   points at before sampling (`eng.ui.dialogueFocus.linkIdx = 0` etc., in `readWindow`'s caller).
   `RI-UIX08` §C names a **two-step hover/press ramp** (`link_over` `#8F9BDA`, `link_pressed`
   `#AFB8E4`) distinct from the plain link colour `#707ECF`. If the glyph-core sampler is catching
   a focused/highlighted element rather than a plain one, ΔE against the *plain* target would
   legitimately read high without the render being wrong.
2. **A genuine per-scene rendering difference** — e.g. ambient lighting at this interior bleeding
   through the translucent panel (§E1 confirms the panel IS a blend, so the world behind it does
   affect the sampled pixels) and shifting the glyph-core estimate on a lower-disposition, dimmer
   scene.

**Not adjudicated here.** A critic should sample both a focused and an unfocused link/row in the
same scene and compare, which distinguishes (1) from (2) directly and was out of this note's
remaining budget.

## 5. The delete-the-fix arm — the piece's biggest gap, closed, with an instrument bug found and
   fixed along the way

**First attempt, from the pinned worktree, FAILED on X2** (`reports/uix08/deletefix-run/window-
probe-deletethefix.json`, this worktree): `X1 window absent: PASS` (dialogue_window=null,
elements=0 — the new window genuinely disappears), **`X2 old reply menu is back: FAIL`** —
"legacy open=false options=null".

**That FAIL was the instrument, not the teardown.** `readWindow()` computed `legacy_open` from
`s.open` and `legacy_options` from `s.option_count` — fields that exist on `getUIState()`'s
**top level** only inside the `if (!this.ui) {...}` branch of `engine.js#getUIState()`. `this.ui`
(the W1-21 `UISystem`) is built unconditionally at boot and always exists in the shipped game, so
that branch never runs, and `s.open`/`s.option_count` were `undefined` at the top level
**regardless of `DIALOGUE_WINDOW`** — this is a bug in the probe, present since it was written,
not something this session's edits introduced. **Confirmed directly** with a one-off diagnostic
run against the same pinned worktree
(`tools/ui/uix08-check-field-scratch.mjs`, scratch, not committed): with `DIALOGUE_WINDOW = false`
and a live conversation open, `getUIState()` returns top-level `open: undefined,
option_count: undefined` and **`dialogue_surface: {"open":true, "option_count":11,
"rendered_text":["Sheem","helstrom","Root-kin. Ask. This one will answer if it can.", ... 11
topics ..., ] , ...}`** — the old bottom-anchored reply menu is genuinely open, with 11 real
options, exactly as `RI-UIX08` EVIDENCE.md's R5 ruling said it would be.

**Fixed** in `tools/ui/dialogue-window-probe.mjs` (`readWindow()`): `legacy_open`/`legacy_options`
now read `s.dialogue_surface.open` / `s.dialogue_surface.option_count`. **Re-run, same pinned
worktree, same commit `dc3f9a80`:**

```
X1 window absent:      PASS  dialogue_window=null elements=0
X2 old reply menu back: PASS  legacy open=true options=11
```

`reports/uix08/deletefix-run2/window-probe-deletethefix.json` (worktree-local; the artefact path
is under the scratch worktree, not the main tree — the *code* fix is what's committed).

**This is RULES rule 6's "inert control" shape, caught the honest way**: the control clone was not
inert (X1 already proved the new window disappears), but the *check confirming the old system's
return* was reading a field path that could never have been true, so a genuinely-working teardown
was one edit away from being reported as a failed one. Confirmed rather than assumed, per rule 4:
break the thing under test (the field-path bug, reproduced with a raw diagnostic) and watch the
check go from FAIL to PASS on the same pinned commit with only the instrument changed.

## 6. Screenshots

**What is actually on disk**: `docs/shots/2026-08-14-uix08-dialogue-{desktop-1920x1080,
desktop-2560x1080, laptop-1280x720, phone-landscape-844x390, phone-portrait-390x844}-{links,
plain}.png` (10 files, `helstrom-market`/Sheem, from this session's first probe run,
08:07–08:13Z) against `REF-A12c-dialogue__mw-owner-20260814.png`. Visually: near-black translucent
panel with the world's own colours bleeding through, tan-ochre tiled/beaded border, name centred
in an interruption of the border strip, `N/100` disposition bar directly above a fixed
right-anchored column, `Persuasion` above a rule with lower-case topics below it, `Goodbye` the
full width of the column — all six §A elements, matching the reference's construction (§E1, §E2 of
the item). Viewed directly (not just diffed): the match is close — border tiling, panel
proportions, bronze-on-near-black prose, right-anchored fixed column all read the same as the
reference at a glance. The Sheem greeting shown has no inline link lit (§2's D1 case), so these
particular frames do not show a lit link; §3's `stormhold-street` run demonstrates that live
separately, numerically, without a matching screenshot (see below).

**A `stormhold-street` screenshot pack was attempted and NOT completed** — said here plainly
rather than left implicit. `reports/uix08/probe-stormhold-shots` was started to capture the same
ten-viewport pack at `stormhold-street`/Cassius Melo (which does light a real link, unlike Sheem's
greeting). After ~6.5 minutes at 0.7% CPU (`ps -o pid,pcpu,etimes`, this session) against a
box-wide load average of ~25 on 4 cores (`node tools/contention.mjs`, this session: "WAIT — the box
is at or over its ceiling"), it had written zero of its ten files and was killed by its own PID
(rule 10) rather than left to keep starving alongside everyone else's work. This matches
`HAZARDS.md` §13's documented pattern — a browser IPC call going silent under a starved renderer —
not a defect in the window. **The numeric `stormhold-street` results in §3 above are unaffected**:
they came from the earlier, completed `--no-shots` run
(`reports/uix08/probe-stormhold/window-probe.json`), which finished cleanly before the box got
this loaded. Only the *picture* of that scene is missing, not the measurement. A critic re-running
the screenshot pack should check `node tools/contention.mjs` first and expect it to be slow, not
broken, under similar load.

**A filename bug found and fixed along the way, independent of the above**: the screenshot
filename was hard-coded to the literal string `2026-08-14` regardless of when the probe actually
ran, so a same-named re-run on any later date would silently overwrite the previous day's evidence
under a now-false date — rule 27 asks for "a dated descriptive name," and a wrong date is worse
than none. Fixed in `tools/ui/dialogue-window-probe.mjs` to derive the date from the run's own
timestamp and to include the state name, so different states no longer collide on the same ten
filenames either. This session's completed `helstrom-market` shots (§6, above) were captured
**before** this fix and so still carry the old `2026-08-14-uix08-dialogue-<viewport>-<arm>.png`
names; the fix takes effect on the next run.

## 7. What this adds up to, without scoring it

The two gaps this piece's own `next_step` named on 2026-08-14 are both addressed:

- **The probe ran to completion**, twice (two states), live, in the running game.
- **The delete-the-fix arm ran, on a properly pinned baseline clone, and both its checks pass** —
  the new window disappears and the old reply menu genuinely, verifiably comes back. The one
  failure it first produced was traced to a probe bug, fixed, and re-confirmed rather than waved
  away.

Still open, honestly: **§G (the human gate) is not run** and remains this item's actual gate per
its own aggregation table; the stormhold colour anomaly (§4) is named, not resolved; D2's
single-example FAIL (§3) is very likely a probe-strictness gap rather than a window defect but
was not re-confirmed against a second, answerable link. **A critic should run §G, resolve §4 with
a focused-vs-unfocused sample, and re-run D2 against a link this session did not happen to draw.**
