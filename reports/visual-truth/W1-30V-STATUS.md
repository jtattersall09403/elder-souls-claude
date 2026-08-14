# W1-30V — visual truth and the shot deck: builder status

Branch `codex/wave1-build-experiment`. Started 2026-08-14 ~08:50 UTC, following a predecessor
(`VISUAL-TRUTH-AUDIT`) whose findings are in `reports/visual-truth/2026-08-14-visual-truth.md`
and whose sibling run was still live when this one started.

## Done

- [x] Read the predecessor's report and **did not repeat it**. Confirmed its combat/menu/dialogue
      run (`vt-play2.mjs`) was still executing and left that ground alone.
- [x] `tools/visual/build-deck.mjs` + `tools/visual/deck.json` — the fixed shot list, **generated
      from `game/data/world/**` rather than hand-listed**, so a region removed from the world turns
      its setups red instead of quietly shrinking the Deck. 48 setups (13 region vistas, 13 region
      eye-level, 8 settlement approaches, 8 settlement streets, 4 interiors, 2 mandatory character
      close-ups) × 3 times × 2 weathers = 288 stills; 12 motion sequences declared.
- [x] `tools/visual/deck.mjs` — the runner. Profiles `full` / `wide` / `weather` / `night` / `smoke`
      so a child's cheap gate is a subset and nine children do not queue behind one tool.
- [x] `tools/visual/frame-stats.mjs` — the usability screen, written **because this tool's own first
      run graded a buried-camera frame `ok`**. See "found in my own instrument" below.
- [x] `tools/visual/contact-sheet.mjs` — tiles any frame directory into one labelled sheet, pngjs
      only, no native deps. Motion is reviewed as a sheet or it is not reviewed.
- [x] `tools/visual/deck-compare.mjs` — determinism, the seed red control, and before/after for
      every other visual child, from one comparison.
- [x] `reports/visual-truth/INVENTORY.md` — the standing inventory, 15 open rows, each naming the
      shot that shows it, plus a "what already looks good" section and an explicit
      NOT-YET-MEASURED list.
- [x] **GPU independently re-verified as broken** — two Pods, two GPU types, two clouds. Detail
      below.
- [x] **Overturned a finding that had reached the parent plan.** See below.

## The reordering, exercised

`W1-30.md` gives this child standing authority to reorder Part 1 and Part 5b. Two changes:

1. **The parent's item 4, "the player's geometric holes", is withdrawn.** Measured at four radii
   over 36 angles the body is 98.6–99.96% solid, and the world-hidden capture that produced the
   "disjoint primitives" reading was **void** — it hid the world with `visible = false` and
   `actor.js:988` reasserts visibility on the body every frame, so the reference frame still
   contained the player. What is real and unfixed in that area is **V11**: the third-person fade
   `charOpacity` is computed, quantised, traced, saved and restored, and **read by nothing in
   `game/src/render/`**. Confirmed by measurement — at a 0.6 m orbit, inside the 1.3 m → 0.9 m fade
   band, the character is 99.96% opaque when it should be nearly gone.
2. **"Floating tree canopies with no trunks" does not reproduce at eye level.** `eye-deep-marshes`
   shows a full trunk, branches and a layered canopy. The floating-geometry problem is real (V08)
   but it is buildings and a colonnade, not vegetation, and it is narrower than the plan assumed.

Both are **reversible**: post a contrary frame and a number and they flip back.

## Found in my own instrument, and fixed

Recorded because the critic brief for this child names exactly these failure modes.

1. **The renderer probe failed open.** It read `__ENGINE.renderer.renderer.getContext()`, which
   throws; the catch returned a string that did not match `/swiftshader/`, so the first manifest
   recorded `software_renderer: false` **on a SwiftShader run**. A probe that fails open launders
   software pixels into an appearance claim. It now fails closed: an unreadable renderer counts as
   software.
2. **A buried-camera frame scored `ok`.** `street-lilmoth` is the camera inside a wooden plank; the
   Deck wrote a valid PNG, hashed it, and called it green. That is "a check that asserts a canvas
   exists rather than that pixels are visible", in this tool, on day one. `frame-stats.mjs` now
   screens every frame on dominant-colour fraction, edge density and tonal span, and downgrades the
   row to `amber` with a reason. It caught that exact frame and no others in the smoke set.
3. **An exterior setup was captured from inside a room.** The setup after the interior teleported
   without leaving the cell. Fixed by exiting first — and note `enterInterior(null)` is not the way
   to do it: it throws page-side and the harness treats that as fatal, which killed a whole sweep.

## Could not do

- **No hardware GPU frame.** Two Pods (RTX A5000/SECURE $0.27/hr, RTX 3090/SECURE $0.50/hr), both
  API-confirmed `RUNNING` with a public IP and SSH port; every SSH attempt died at
  `Connection closed by UNKNOWN port 65535`, later `Connection timed out`. Raw outbound TCP is
  blocked in this container and the agent proxy re-terminates TLS, which SSH is not. `gpu:doctor` is
  all-green — the failure is the container's network, not the tooling or the account. Pods were
  terminated with deletion API-confirmed; spend is minutes at those rates. **Everything captured
  here is SwiftShader and every manifest says so in the frame.** Two environment fixes are still
  needed and are worth writing into the GPU docs: `apt-get install openssh-client`, and
  `NODE_USE_ENV_PROXY=1` because Node's global `fetch` ignores `HTTPS_PROXY` here.
  Correction to the CLI docs a future agent will trip on: the subcommand is `run`, not `test`
  (`npm run gpu:test` maps to `cli.mjs run`).
- **The 12 motion sequences are declared, not captured.** Until they are, no gate in this tree
  should be treated as motion-satisfied.
- **Night and rain across all regions** — the `night` and `weather` profiles exist and are one
  command each; they had not run.
- **No naive human judgement.** The Deck makes the frames; nobody outside the project has scored
  them, so there is no Craft or Place number yet.
- **`library-census.mjs`, `judge-pack.mjs` and `tripwire.mjs`** (plan items 4, 5, 6) are not built.
  The widening sweep and the reusable before/after instrument were ranked above them, on this
  child's own standing authority, because nine siblings need a before/after today and nobody needs a
  judge pack until there are frames worth judging.
