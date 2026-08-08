# W1-DEPLOY r1 — critic's verdict on the four deploy-safety instruments

**Verdict: FAIL. Score 3.5 (min over axes), gate 7.0.**

Subjects: `tools/check-shipped-files.mjs`, `tools/world/verify-playable.mjs`,
`tools/world/verify-live-site.mjs`, and the boot notice in `game/index.html` — built, run, declared
good and shipped by the orchestrator, and never graded by anyone else (rule 22).

Measurements were taken at **09e11d0** (the commit at which the four were shipped) and at
**fa96455** for the boot notice, which was rewritten mid-round. HEAD was `a698ed7` when this was
written. Rule 12: every number below names its commit. Every browser figure was taken with
`tools/contention.mjs` reporting between **1.03 and 3.96 per core** with 1–5 other browsers on the
box; the per-run load is stated where it matters (rule 26).

Instruments built for this round, all with two-armed self-tests:

| tool | what it does |
|---|---|
| `tools/world/critic-deploy-gate-fixture.mjs` | runs a byte-identical copy of `check-shipped-files.mjs` against 13 real git repositories — 8 with a real defect, 6 sound |
| `tools/world/critic-deploy-scan-coverage.mjs` | compares the shipped import regex against an independent extractor over the real tree |
| `tools/world/critic-deploy-probe.mjs` | settle curve, framebuffer sampling, sabotage matrix, abort-vs-404, fetch-wrapper delete-the-fix |
| `tools/world/critic-deploy-night-notice.mjs` | does the notice's own "is it drawn?" test keep a full-screen overlay over a drawn world |
| `tools/world/critic-deploy-requested-files.mjs` | **the proposed replacement gate** — every path the *running* game requests must be tracked by git |

---

## 1. `tools/check-shipped-files.mjs` — **3.5**. Blocking, blind in four places, false-positive in four more.

Unchanged between 09e11d0 and HEAD, so everything here is live.

### The self-test is worth nothing, and here is the arm it is missing

`--self-test` asserts that a fabricated path is absent from `git ls-files` and that
`game/src/main.js` is present. Both are statements about the `Set` that `tracked()` builds. The
scanner — `walk`, `SPEC`, `resolve`, the data-manifest arm, the exit code — is not executed by
either arm. **The tool has never been shown to detect the defect it was written for.**

`tools/world/critic-deploy-gate-fixture.mjs` builds the missing arm: a throwaway git repository
with a byte-identical copy of the tool (sha256-checked against the original on every run), a real
`main.js` that really imports `./input/hold-gate.js`, and a real `hold-gate.js` written *after* the
commit so it is genuinely untracked. The tool exits 1 and names the file — **scenario A passes.**
That is the one real thing the shipped self-test could have proved and did not.

### 4 of 8 defect shapes reach the deployed site with the gate green

```
 ok  CAUGHT   A. untracked module, really imported  (the defect that shipped)
 ok  quiet    B. everything tracked                 (must not cry wolf)
GAP  MISSED   C. untracked module behind a >200-char binding list
GAP  MISSED   D. untracked file named only by new URL(..., import.meta.url)
GAP  MISSED   E. untracked file referenced only by index.html <script src>
 ok  CAUGHT   F. untracked data file listed in data/index.json
 ok  CAUGHT   G. a file the game needs, excluded by .gitignore
GAP  MISSED   G2. untracked module imported side-effect-only (import './x.js')
 ok  CAUGHT   M. an import whose case does not match the file on disk
```

C is not hypothetical. `critic-deploy-scan-coverage.mjs` compares `SPEC` against an independent
extractor over all 138 modules under `game/` and finds **three real imports the gate cannot see on
the shipped tree**:

```
game/vendor/three/three.core.js   imported by game/vendor/three/three.module.js
game/src/sim/camera.js            imported by game/src/engine.js
game/src/sim/stealth/system.js    imported by game/src/engine.js
```

`SPEC`'s window is `[\s\S]{0,200}?` between `import` and `from`; these three sit behind longer
binding lists. **`three.core.js` is the renderer.** If it went untracked the site would black-screen
exactly as before and the gate would print "every import and data file the game needs is tracked".

G2 is a latent hole rather than a live one — the tree has no bare `import './x.js'` today — but a
gate whose coverage depends on nobody ever writing the commonest side-effect form is not a gate.

### It is BLOCKING and it fires on four shapes of sound tree — rule 13

```
GAP  FALSE POSITIVE  I. an import written inside a template literal (a doc example)
GAP  FALSE POSITIVE  J. a neighbour's untracked scratch file under game/
GAP  FALSE POSITIVE  K. an extensionless import of a directory
GAP  FALSE POSITIVE  L. an import specifier carrying a query string
```

**J is the one that matters.** `walk(GAME)` takes every `.js`/`.mjs` under `game/` with no
tracked-filter, so a scratch probe or a half-written module that any of a dozen agents leaves under
`game/` — importing a sibling not yet authored — makes `check-shipped-files` exit 1. The hook fires
it on any commit touching `^game/`, unscoped. That blocks **every agent on the box**, and it blocks
`tools/bank.mjs`, which is the mechanism that saves the fleet's work across container restarts.
Rule 13 names this exact failure and the gate walks into it.

I did **not** reproduce J on the live tree, deliberately: planting an untracked file under `game/`
would have blocked a neighbour's commit for as long as it existed. The fixture uses a byte-identical
copy of the tool and is sufficient (rule 26).

K is worth its own line because the diagnosis is wrong as well as the verdict: `existsSync` says yes
to a directory and `git ls-files` never lists directories, so the tool reports `NOT IN GIT
game/src/widgets` for a directory whose contents are all committed.

### An inert control I nearly published

The first version of the fixture wrote scenarios G/J/K/L as bare `import './x.js'`. All four came
back "quiet" and I almost recorded four clean rule-13 rows. They were quiet because **`SPEC`
requires `from` and does not match the side-effect form at all** — the arms tested nothing. Rewritten
with `from`, four of them go red. Rule 6's inert control, in my own instrument, caught by checking
that the control could fail.

### What would fix it, cheaply

Skip files not tracked by git (closes J); strip `?`/`#` from specifiers (L); require the resolved
target to be a *file* (K); drop the 200-char bound and strip comments and template literals before
matching (C and I together); add the `from`-less form (G2); scan `index.html`'s `src`/`href` (E).
That is a short diff and it takes detection from 4/8 to 7/8 with no false positives. D — `new URL`
— is not worth chasing in a regex; see §5.

---

## 2. `tools/world/verify-playable.mjs` — **5.0**. It catches the real defect. It also calls four working states blank.

### Credit first: it goes red on the failure that actually happened

The brief asked whether blocking `hold-gate.js` instead of `three.module.js` still turns it red.
It does, and so does every other module and data shape I could construct:

```
blocked                                    corner%  notice up  verify-playable
three.module.js  (their self-test arm)       0.00   true       FAIL
hold-gate.js     (the real defect)           0.00   true       FAIL
engine.js        (a mid-graph module)        0.00   true       FAIL
data/index.json  (a data 404)                0.00   true       FAIL
ALL of data/     (renderer up, no world)     0.00   true       FAIL
```

And it survives the objection I expected to land. Its self-test sabotages with `route.abort()`,
which is a *connection failure*; a static host answers a missing path with **HTTP 404 and an HTML
body**, which is a different browser event. `--pages404` runs both shapes against three targets:
all six go red. The 404 arm even produces a better message than the abort arm
(`data file missing: index.json (404)` versus `Failed to fetch`). The self-test simulates the wrong
shape, but the tool is not fooled by the right one.

### The threshold is defensible. The sampling window is not.

`readPixels(0, 0, 160, 160)` is the **bottom-left corner** of the framebuffer — WebGL's origin is
bottom-left — and that is 1.23% of a 1920×1080 frame. Measured on states this game ships:

```
state                       corner%   whole frame%   the 2% line says
default, midday               88.09        97.33     passes
default, midnight              0.00        52.86     CALLED BLANK
default, 03:00                 0.00        52.88     CALLED BLANK
interior_firelit             100.00        98.30     passes
interior_firelit, night      100.00        93.49     passes
dungeon_primary                0.02        33.30     CALLED BLANK
dungeon_primary, night         0.00         5.04     CALLED BLANK
```

Four legitimate states fail. Note what this does **not** say: 2% is a reasonable number — even the
darkest row, a dungeon at night, is at 5.04% over the whole frame and would pass. The defect is
entirely in *where* it looks. The bottom-left corner is the ground immediately in front of the
player, which is the darkest region of the frame at night and in an unlit interior. The stealth
verdict's 1,584 floor tiles drawn lit and simulated black is the same geometry from the other side.

Fix: stride the whole frame at the same pixel budget. It is three lines and it costs nothing.

### "Four viewports" is one image, measured four times

```
viewport          canvas       css        corner%   full%   upper-half%
desktop           1920x1080   1440x900     99.13   98.89     100.00
phone-portrait    1920x1080   412x839      99.13   98.89     100.00
phone-landscape   1920x1080   839x412      99.13   98.89     100.00
tablet            1920x1080   820x1180     99.13   98.89     100.00
distinct framebuffer sizes across the four "viewports": 1 (1920x1080)
```

Under Playwright `navigator.webdriver` is true, so `main.js` takes the automated branch and **skips
the resize path**; the canvas keeps its HTML attributes at 1920×1080 whatever the viewport. The four
contexts differ in CSS layout and in the `fills` check only. The rendered image is byte-identical to
four decimal places. The header says each viewport "has broken something in some project at some
point" — for the pixel test, three of them are not being tested. The portrait phone framebuffer,
which is the device the owner actually held, is never rendered.

### 15 seconds is a guess, and the read latches

Rule 8. One fresh page per row, phone-portrait, contention 2.91/core:

```
 t(ms)   corner%   renderer up
  2000     0.00    false
  4000     0.00    true
  6000     0.00    true
  8000    99.13    true
 15000    99.13    true
 30000    99.13    true
```

The picture arrives between 6 and 8 s; `boot()` resolves at 8.76 s. The 15 s wait has about a 2×
margin **on this box, unloaded**. Under CPU×4 boot takes 21.9 s and under CPU×4 + 8 Mbit/s it takes
91.1 s — and in both, the corner still reads 99.13% at the 15 s mark, because the renderer draws
before boot finishes. So the number survives a phone-shaped machine. Fine.

What does not survive is this, which I found by getting it wrong:

> **Reading the framebuffer once latches the answer for that page forever.** A read taken before the
> engine's renderer exists returns 0, and every later read on the same page returns 0 too, no matter
> how long you wait.

Isolated to the cause: at 2 s `window.__ENGINE.renderer` does not exist, so
`canvas.getContext('webgl2')` from the probe **creates** the context with default attributes; THREE
then receives that context and its own attributes never apply. Merely calling `getContext` early —
with no `readPixels` at all — is enough:

```
A getContext at 2s (no read), read at 15s   -> 0.0000   (renderer absent at 2s)
B nothing at 2s, read at 15s   (control)    -> 0.9913
```

The control genuinely differs, so this is not an inert teardown. The consequence for the subject: if
boot ever exceeds the flat 15 s, `verify-playable` does not merely read early — it reads 0 and
**waiting longer cannot recover it**, and it reports "BLANK — no picture on 4 of 4 viewports" for a
working game. There is no retry and no assertion that boot finished, so the two diagnoses "the game
draws nothing" and "the machine was busy" are reported with the same words.

`window.__HARNESS.ready()` exists and is exactly the signal. Await it, then read.

My own first settle probe read eleven times on one page and reported 0.00% at every timestamp for a
game drawing 99.1%. I ran the shipped tool three times to check (99.1%, stable, three for three),
found the artifact was mine, and rebuilt the probe with one fresh page per sample. Recorded here
rather than deleted, because the subject has the same defect: a single read whose value depends on
what touched the canvas first.

---

## 3. `tools/world/verify-live-site.mjs` — **5.5**. Right idea, thin drift check, not wired to anything.

**The curl claim is true.** Verified directly against the deployed URL:

```
node fetch: 403
curl:       200
```

The proxy does 403 node's `fetch` for a URL curl retrieves. Shelling out is correct and the header
is honest about why.

**Does the self-test still fail if the transport breaks differently?** Partly. Its two arms are "a
bogus path is reported" and "a real path is clean", both routed through `sweep`→`head`, and `head`
returns `0` on any throw. So a transport that dies in a new way — curl absent, proxy refusing
CONNECT, DNS gone — makes `head` return 0 for everything, the real-path arm goes red, and the
self-test fails. That is the arm that caught the original 403 and it does generalise. The gap is the
other direction: a transport that returns 200 for *everything* (a captive portal, a proxy error page
served with 200) passes both arms while the sweep is worthless. A body assertion on the known-good
arm — not just a status — would close it, and it is one line.

**The two-file drift check is too thin.** It compares served bytes for `index.html` and
`src/main.js` only. A stale `data/` file passes, and a stale `data/index.json` is the single worst
case: the manifest names files the deployment does not have, every one of them 404s, and the
`missing` sweep would catch it only if the *manifest itself* were current. What it should compare:

1. `index.html` — the page, and the only place the boot notice lives;
2. `data/index.json` — the manifest every other data file is reached through;
3. every `.js` under `src/` and `vendor/` — the module graph, where a single stale byte is a
   different program;
4. a stable sample of `data/` leaves, sized to the run budget.

The reason for that set and not "everything": modules and the manifest are the files where staleness
is *silent and total*, and there are few enough of them (138) to hash on every run. Data leaves fail
loudly and individually, so a sample is enough to detect a half-finished deploy.

**Where it should run.** Not the pre-commit hook — it needs the network and takes minutes, and rule
13's argument against blocking the fleet applies twice over to a check that depends on GitHub's
build queue. It belongs in `tools/TICK.md`'s loop, once per tick, non-blocking, with its result
written where the orchestrator reads it; and unconditionally after any commit that touches the
published tree, as a follow-up a few minutes later rather than inline. A `--wait` mode that retries
for two minutes before failing would make it usable straight after a push, since "Pages has not
finished building" and "the deployment is broken" are its own words for two states it cannot
currently distinguish.

**It is not wired into anything, and that cost something during this round.** While I was measuring,
`docs/play` was deleted (c8414d7, "Pages serves the root now") and the published game moved. As of
this verdict `https://…/play/` returns **404** and `https://…/game/` returns 200. The old URL — the
one in the blog and the one the owner opened — is dead, and nothing noticed, because the only
instrument that looks at the internet runs when a human types it.

---

## 4. The boot notice in `game/index.html` — **4.0**. The defect was real, the author found it, and the fix ships a new one.

### It hid too early. Confirmed, and already fixed.

At 09e11d0 the notice hid when `window.__HARNESS` appeared. `main.js` installs the harness
synchronously, before `boot()` resolves — its own comment says so — and `H.ready` is a function, so
the poll's `h && (h.ready || …)` is satisfied immediately. Measured: `window.__HARNESS` at **876 ms**,
notice already `gone` at the 2 s sample, first pixels at 6–8 s, `boot()` resolved at **8.76 s** —
and **21.9 s** at CPU×4, **91.1 s** at CPU×4 + 8 Mbit/s. On a phone the notice flashed for a second
and left the player looking at a black rectangle for the remaining ~90 seconds. That is precisely the
silent black screen it was written to prevent.

The orchestrator found this independently at **fa96455**, hours after shipping, and said so plainly
in the commit message: *"That is the failure I had already flagged to its critic and shipped
anyway."* Credit for that. It does not change the grade, because rule 22 exists so that this is
found before it ships, not after.

### The fix ships the corner-sampling defect *into the game*

`painted()` — the new hide condition — is `readPixels(0, 0, 64, 64)` with a 1% threshold. That is
the same bottom-left corner as §2, now deciding whether a **player** sees the game. Run against
`game/` pinned at fa96455, waiting past the notice's own 6-second grace:

```
state                       corner%   whole frame%   notice
default, midday (control)     67.85        97.32     hidden
dungeon_primary                0.00        33.35     STILL UP     <- 2 runs of 2
dungeon_primary, night         0.00         5.03     STILL UP     <- 2 runs of 2
interior_firelit, night      100.00        93.76     hidden
```

`dungeon_primary` draws a third of the frame and the notice never goes away. It is
`position: fixed; inset: 0; z-index: 9999`, so the player is holding a phone showing a full-screen
overlay reading *"Loading the province… About 17 MB. 22s so far"* — or, past the grace period,
*"The world loaded, but nothing is being drawn"* — over a dungeon that is being drawn. There is no
dismiss control. **A player who loads into a dungeon cannot play the game.**

Picture: `docs/shots/2026-08-08-critic-deploy-boot-notice-stuck-over-a-drawn-dungeon.png`.

The `default, midnight` row is a race and I am not counting it: `setTimeOfDay` is applied after boot,
so whether the notice has already hidden depends on which poll won. It came back STILL UP in one run
of two. The `dungeon_primary` rows are stable because the state is applied at boot, which is exactly
the case a player is in.

The fix for the notice is the fix for `verify-playable`: sample the whole frame, not the corner.

### The `window.fetch` monkey-patch: measured, harmless, and useless

Delete-the-diagnostic, with the wrapper block stripped from `index.html` in the route handler so
nothing on disk is edited (rule 6):

```
as shipped (wrapper present)   frame 300  seed 12345  snapshot digest 3616911187  patched=true
wrapper removed (control)      frame 300  seed 12345  snapshot digest 3616911187  patched=false
determinism: digests MATCH — the wrapper does not perturb the simulation
the control arm genuinely differs: patched true vs false   (the teardown bit)
```

So the trade is not "a global mutation for a diagnostic" — the mutation is measurably inert on
determinism, on the harness's own fetches (567 of them) and on the frame count. On that axis: fine.

The problem is the other side of the trade. **The wrapper never fires.** `say()` is gated on
`if (done) return`, and `done` becomes true when the notice hides — at 876 ms in the shipped version.
Every data file is fetched after that. In nine sabotage arms across two shapes, not one produced the
wrapper's message (`"A file the game needs is missing"`); every message came from the `error` or
`unhandledrejection` listener instead. The wrapper is a permanent change to a global in the shipped
game, in service of a code path I could not make execute. Under fa96455 `done` is set later, so it
has a window now — but it still never uninstalls itself in `hide()`, which is one line and would make
the trade unarguable.

### The copy, read as prose

Mostly good. "Loading the province…" is in voice, and "About 17 MB. The first load is the slow one"
is the right register — plain, specific, faintly apologetic without grovelling.

Three problems.

- **"The game stopped while loading. an unknown error"** is what the player sees for a 404 on a
  module — the exact defect this whole round is about. Measured, in six of six module-blocking arms.
  A module load failure fires an `ErrorEvent` with no `message` and no `filename`, so both the
  sentence and the `<code>` line come out empty. The one failure that has actually happened to a
  real user produces the least informative message the notice can emit. Listening for `error` on the
  `<script type="module">` element, which does carry the URL, would fix it.
- **"Still loading, and this is longer than it should take."** — "longer than it should" is the
  developer's frame, not the player's. The player does not know how long it should take.
- **Lower-case after a full stop.** "The game stopped while loading." then "an unknown error" as the
  next line reads as a broken sentence rather than a detail line. The `bn-sub` styling is doing work
  the punctuation contradicts.

---

## 5. `verify-published-game.mjs` — delete it. Already done.

It asserted a canvas exists with non-zero dimensions and no page errors. All three were true of the
black screen; that is the definition of a probe that cannot fail on the failure it is for (rule 4).
Its one genuine merit — it loaded from a **subdirectory** URL, which is how Pages serves — was worth
keeping, and `verify-playable` serves from the root and so does not test it.

It was deleted between 09e11d0 and HEAD. Correct call. The subdirectory case should be picked up by
`verify-live-site`, which fetches the real deployed URL and therefore tests the real path prefix;
that is strictly better than simulating it locally.

---

## 6. The real question: what other "works here, broken there" is this project blind to?

I checked the named siblings on this machine and most are already closed, which is worth saying
plainly rather than listing them as risks:

- **Case sensitivity** — the filesystem here is **case-sensitive**, same as the deploy host, and no
  two tracked paths collide on case. The gate catches a case mismatch anyway (scenario M). Closed.
- **Jekyll `_` prefixes** — `docs/.nojekyll` exists **and is tracked**. There is one `_`-prefixed
  path the game needs (`data/dialogue/topics/_manifest.json`) and it is tracked. Closed, but it is
  closed by a single zero-byte file whose absence would be silent, so it belongs in a check.
- **Symlinks** — none under `game/`. Closed.
- **`.gitignore`** — nothing in `.gitignore` matches anything under `game/`, and the gate catches
  the case anyway (scenario G). Closed.
- **The local server sets what a static host does not** — `tools/lib/serve.mjs` sends
  `cross-origin-opener-policy: same-origin` and `cross-origin-embedder-policy: require-corp`, so
  `crossOriginIsolated` is **true** locally and **false** on Pages. Nothing in `game/` reads
  `crossOriginIsolated` or `SharedArrayBuffer`, so it is inert today — but it is a live trap for
  anyone who adds a worker. It also sends `cache-control: no-store`, where Pages sends an ETag: the
  owner's phone can hold a cached `index.html` pointing at modules that have moved, which no
  instrument here can see.
- **`game/` versus the deployed copy** — this was the biggest one when the round started, and it has
  since been removed at the root by c8414d7 ("Pages serves the root now, so the mirror is deleted
  and there is one copy of the game"). That is the right fix and it deletes the class. Note what it
  cost in passing: `verify-playable` and `verify-live-site` both defaulted to `docs/play`, so for a
  window both instruments pointed at a directory that no longer existed. They have been retargeted.

**The sibling that is still open, and the one worth building for, is not any of those.** It is the
class the gate's *method* creates:

> A file the game needs at runtime that is named by something other than an `import … from`.

Every miss in §1 — `three.core.js` behind a long binding list, `new URL('../data/',
import.meta.url)`, `<script src>` in `index.html`, the side-effect import — is an instance of it, and
widening the regex trades each blind spot for the next. A parser would trade it for a different next:
`new URL` is not an import at all, and no import parser will ever see it.

So the check I built does not parse anything. **`tools/world/critic-deploy-requested-files.mjs` runs
the game, records every path it asks the server for, and requires each one to be tracked by git.**
Syntax is irrelevant to it: a module, a `new URL`, a worker, an image, a font, a runtime-built fetch
and an `<img src>` all arrive as a GET.

Against `game/` pinned at fa96455:

```
surfaces exercised: ready, step 600, night, interior (skipped)
the running game asked this server for 706 distinct path(s); the frame is 51.8% lit.
of those, 568 are not JavaScript at all, so no import scanner reaches them.
PASS — all 706 requested path(s) returned 200 and are tracked.
```

**568 of 706.** Four fifths of what the game loads is outside any import scanner's reach by
construction, covered today only by the `data/index.json` manifest arm — which is itself a hand-kept
list, and which the runtime check does not have to trust.

Its self-test is the arm `check-shipped-files` lacks: write a real file into the served tree, make
the page really fetch it, never add it to git, and require the tool to name it — then require the
same run without it to come back clean, and require the game to have drawn in both arms so neither
is a boot failure in disguise. All three pass. It exits **2**, not 0, if the build drew nothing,
because a request list from a game that did not come up is a boot prefix and not a measurement.

It is not a superset of the static gate and should not replace it: it cannot see a lazy import behind
a menu, or an asset for a region the player never enters. The static gate covers paths never taken;
this one covers syntax never parsed. Run both.

---

## Scores

| axis | score | why |
|---|---|---|
| `check-shipped-files.mjs` | **3.5** | blocking, 4/8 detection, 4 false-positive shapes incl. a neighbour's scratch file, blind to `three.core.js`, self-test exercises nothing |
| `verify-playable.mjs` | 5.0 | goes red on the real defect and on real 404s; calls 4 legitimate states blank; "four viewports" is one image; a latching single read at a guessed 15 s |
| `verify-live-site.mjs` | 5.5 | correct instrument, curl claim verified, 2-file drift check too thin, unwired — and the published URL 404'd during this round with nothing watching |
| boot notice | 4.0 | hid at 876 ms against a 8.8–91 s load; author found and fixed it; the fix keeps a permanent overlay over a drawn dungeon; fetch patch inert but never fires |
| method (rules 4, 13, 22) | 4.5 | two self-tests that cannot fail, a fail-closed gate landed with 4 false-positive shapes, shipped ungraded — against which: the author caught their own worst defect and deleted the dead probe |

**Min over axes: 3.5. Gate 7.0. FAIL.**

The instruments are pointed at the right target and one of them catches the defect that started all
of this. What they lack is the round that would have found these before they were armed — which is
rule 22, and which is the finding, not the four tools.

## What I could not do (rule 26)

- I did not reproduce the rule-13 false positive on the live tree; a planted untracked file under
  `game/` would have blocked a neighbour's commit while it existed. The evidence is a byte-identical
  copy of the tool in a fixture repository.
- `barge-hold` and `cam_cistern` never came up under the dark probe and are excluded.
- The `--notice2` timing run returned nothing usable at 4.70/core with 4 other browsers on the box;
  the hide-time figures quoted are from the `--settle` run at 2.91/core and the `--notice` run.
  Contention is stated on every browser figure.
- `game/` at HEAD did not boot when I first ran the night-notice check (`QuestBook: 16 integrity
  failure(s)`, a neighbour's in-flight work). Every notice figure is pinned to a `git archive` of
  fa96455 rather than to a moving tree.
- My first night-notice run printed **PASS** over six states that had drawn nothing, because a
  black frame failed the "is it drawn" precondition and so counted as a clean row. That is a
  fail-open in a critic's own instrument. It exits 2 with "NOT RUN" now.
