# W1-30V — visual truth and the shot deck: builder status

Branch `codex/wave1-build-experiment`. Started 2026-08-14 ~08:50 UTC, following a predecessor
(`VISUAL-TRUTH-AUDIT`, report at `reports/visual-truth/2026-08-14-visual-truth.md`) whose sibling
run was **still live** when this one started — confirmed by process, not assumed.

## Done

- [x] Read the predecessor's report and **did not repeat it**. Its combat/menu/dialogue run
      (`vt-play2.mjs`) was executing while this child worked; that ground was left alone.
- [x] `tools/visual/build-deck.mjs` + `deck.json` — the fixed shot list, **generated from
      `game/data/world/**` rather than hand-listed**, so a region removed from the world turns its
      setups red instead of quietly shrinking the Deck. 48 setups (13 region vistas, 13 region
      eye-level, 8 settlement approaches, 8 settlement streets, 4 interiors, 2 mandatory character
      close-ups) × 3 times × 2 weathers = 288 stills; 12 motion sequences declared.
- [x] `tools/visual/deck.mjs` — the runner, with profiles (`full` / `wide` / `weather` / `night` /
      `smoke`) so a child's cheap gate is a subset and nine children do not queue behind one tool.
- [x] `tools/visual/frame-stats.mjs` — the frame-usability screen.
- [x] `tools/visual/contact-sheet.mjs` — tiles any frame directory into one labelled sheet, pngjs
      only, no native deps.
- [x] `tools/visual/deck-compare.mjs` — determinism, the red control, and before/after for every
      other visual child, from one comparison.
- [x] `reports/visual-truth/INVENTORY.md` — the standing inventory: 15 open rows each naming the
      shot that shows it, one resolved row with numbers, a "what already looks good" section, and an
      explicit NOT-YET-MEASURED list.
- [x] **Determinism proven**: two independent browser launches at the same commit produced **6 of 6
      byte-identical frames**. Every before/after in this programme rests on that.
- [x] **GPU independently re-verified as broken** — two Pods, two GPU types, two clouds.
- [x] **Overturned two findings that had reached the parent plan**, and **corrected one row of this
      child's own bar**.

## The reordering, exercised

`W1-30.md` gives this child standing authority to reorder Part 1 and Part 5b once it has wider
evidence. Three changes, all **reversible** — post a contrary frame and a number and they flip back.

1. **The parent's day-one item 4, "the player's geometric holes", is withdrawn.** Measured at four
   radii over 36 angles the body is 98.6–99.96% solid. The world-hidden capture that produced the
   "disjoint primitives" reading was **void**: it hid the world with `visible = false`, and
   `actor.js:988` reasserts visibility on the body every frame, so the "player absent" reference
   still contained the player. What is real and unfixed there is **V11** — `charOpacity` is computed,
   quantised, traced, saved and restored, and read by **nothing** in `game/src/render/`. Confirmed by
   measurement: at a 0.6 m orbit, inside the 1.3 m → 0.9 m fade band, the character is 99.96% opaque
   when it should be nearly gone.
2. **"Floating tree canopies with no trunks" does not reproduce at eye level.** `eye-deep-marshes`
   shows a full trunk, branches and a layered canopy. The floating-geometry problem (V08) is real but
   it is buildings and a colonnade, not vegetation — narrower than the plan assumed.
3. **New row V15, which only a wide sweep could find:** `sim.env.region` does not track a teleport.
   Thirteen regions, every frame reporting `western-rootlands` while the player was demonstrably
   elsewhere. Found because the Deck records both the cached value and the authoritative
   `getTerrainAt(x,z)` per frame.

## Found in my own instrument, and fixed

Recorded because the critic brief for this child names exactly these failure modes, and the
instrument had three of them on day one.

1. **The renderer probe failed open.** It read `__ENGINE.renderer.renderer.getContext()`, which
   throws; the catch returned a string not matching `/swiftshader/`, so the first manifest recorded
   `software_renderer: false` **on a SwiftShader run**. A probe that fails open launders software
   pixels into an appearance claim. It now fails closed: an unreadable renderer counts as software.
2. **A buried-camera frame scored `ok`.** `street-lilmoth` is the camera inside a wooden plank; the
   Deck wrote a valid PNG, hashed it, and called it green. That is *"a check that asserts a canvas
   exists rather than that pixels are visible"* — in the instrument built to catch it.
   `frame-stats.mjs` now screens every frame on dominant-colour fraction, edge density and tonal
   span, and downgrades the row to `amber` with a reason. It flagged that exact frame and no others.
3. **An exterior setup was captured from inside a room.** The setup following the interior teleported
   without leaving the cell. Fixed by exiting first — and note `enterInterior(null)` is *not* the way:
   it throws page-side and the harness treats that as fatal, which killed a whole sweep at setup 1.

## A correction to this child's own bar

The plan's first acceptance row asks: *"change the seed; ≥ 95% of hashes must change."* Measured,
seeds 20260814 and 987654 produce **6 of 6 identical frames**. That is not a broken harness — the
province is generated from `game/data/**` and a posed still of a settled scene contains no RNG. So
the seed is the wrong knob, and a control that cannot go red on a healthy build is not a control.

Replaced with an in-run **time-of-day axis** control (`deck-compare.mjs --run <dir> --axis time`):
the same camera at 13:00 and 19:30 must produce different pixels, or the capture is not seeing the
light and every determinism PASS is meaningless. That is a falsification the harness can actually
fail. **Reversible:** name a shot whose pixels should depend on the seed and the old control returns.

## Could not do

- **No hardware GPU frame.** Two Pods (RTX A5000/SECURE $0.27/hr, RTX 3090/SECURE $0.50/hr), both
  API-confirmed `RUNNING` with a public IP and SSH port; every SSH attempt died at
  `Connection closed by UNKNOWN port 65535`, then `Connection timed out`. Raw outbound TCP is blocked
  in this container, and the agent proxy re-terminates TLS, which SSH is not. `gpu:doctor` is
  all-green — the failure is the container's network, not the tooling or the account. Both Pods
  terminated with deletion API-confirmed; spend is minutes at those rates. **Every frame captured
  here is SwiftShader and every manifest says so in the frame, in its own `evidence_class` field.**
  Two environment fixes remain necessary and belong in the GPU docs: `apt-get install openssh-client`,
  and `NODE_USE_ENV_PROXY=1` because Node's global `fetch` ignores `HTTPS_PROXY` here. One more a
  future agent will trip on: the CLI subcommand is `run`, not `test` (`npm run gpu:test` →
  `cli.mjs run`); `cli.mjs test` prints usage and exits 1.
- **The 12 motion sequences are declared, not captured.** Until they are, no gate in this tree should
  be treated as motion-satisfied. This is the largest single gap in this child's delivery and it is
  named rather than glossed.
- **Night and rain across all regions** — the `night` and `weather` profiles exist and are one
  command each; they had not run.
- **No naive human judgement.** The Deck makes the frames; nobody outside the project has scored
  them, so there is no Craft or Place number yet.
- **`library-census.mjs`, `judge-pack.mjs` and `tripwire.mjs`** (plan items 4, 5, 6) are not built.
  The widening sweep and the reusable before/after instrument were ranked above them on this child's
  standing authority: nine siblings need a before/after today, and nobody needs a judge pack until
  there are frames worth judging.
- **Heavy git contention cost real work.** Another agent's checkout deleted three uncommitted files
  of mine mid-session (`deck-compare.mjs`, `INVENTORY.md`, this file). They were rewritten and are
  now mirrored outside the repo before every long-running step. Worth knowing for anyone else
  producing artefacts in this tree.
