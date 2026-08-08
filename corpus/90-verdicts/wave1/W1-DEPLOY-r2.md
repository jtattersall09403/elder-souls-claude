# W1-DEPLOY r2 — critic's verdict on the deploy-safety instruments, re-taken

**Verdict: FAIL. Score 3.5 (min over axes), gate 7.0.**

Round 1 scored 3.5 and the number has not moved. **That is not because nothing happened.** A great
deal landed — a blast-radius policy on the blocking gate, a rebuilt `verify-playable`, a boot notice
that no longer sits over a drawn dungeon, two new tools — and the axis that *set* r1's 3.5
(`check-shipped-files.mjs`) has genuinely improved from 3.5 to 4.5. The 3.5 is now set by different
axes, for different reasons, and both of them are new findings. Read the axis table before reading
the headline.

Subjects, found from `git log` and `tools/` rather than from the dispatch: `tools/check-shipped-files.mjs`,
`tools/world/verify-playable.mjs`, `tools/world/verify-live-site.mjs`,
`tools/playability/check-image-refs.mjs`, `tools/playability/loader-retry.mjs`, and the boot notice
in `game/index.html`.

**Commits.** The tree moved under me continuously (nine bank commits during the run). Rule 12: every
number below names what it was taken against.

| subject | measured against |
|---|---|
| `check-shipped-files.mjs` | worktree sha256 `54bb8dab2962`, 13,687 bytes — GATE-BLAST-RADIUS's new version, uncommitted at measurement time. The **previous** version, sha `f611eb7def40`, was also measured (see §1). |
| `verify-playable.mjs` | `6dece5e` |
| `verify-live-site.mjs`, `check-image-refs.mjs`, the drift sample | `3979d78` … `db449a5` |
| the boot notice | `04569c7` and `fe3f8ec`, two independent runs |
| observer-effect timing | `954b93b` and `fbc4ff9` |

**Load.** Every browser figure states the load it was taken under (rule 26). `tools/contention.mjs`
reported between **1.87 and 7.08 per core** across the run. I proceeded past one `--gate` exit 3, for
the `--notice` arm only, because that arm serves a 25 KB page with no game in it and is insensitive
to load; it is recorded in my status file. The `--boot` arm is a timing measurement and its two arms
were taken **back to back on the same box within the same minute**, which is the comparison the
finding rests on; the absolute seconds are not portable and are not used as one.

**Coordination.** `node tools/ownership.mjs --conflicts` was run. `PLAYABILITY` owns
`verify-playable.mjs` and `game/index.html`; `GATE-BLAST-RADIUS` owns `check-shipped-files.mjs`,
`tools/bank.mjs` and `.githooks/pre-commit`; `P10-loader-retry` owns `loader-retry.mjs`. I wrote none
of those files. All three are declared `redundant_with` in my status file. GATE-BLAST-RADIUS moved to
`done` **during** this round and its new gate landed in the worktree mid-measurement, so §1 reports
both versions.

Instruments built for this round, each with a control that is shown able to fail:

| tool | what it does |
|---|---|
| `tools/world/critic-deploy-r2-gate.mjs` | the gate in **both** its modes — detection under `--strict`, blast-radius policy bare — against 11 throwaway git repositories |
| `tools/world/critic-deploy-r2-imgref-fixture.mjs` | `check-image-refs` against 9 real repositories with a real published page and a local stand-in host, via its own `--url` flag |
| `tools/world/critic-deploy-r2-drift.mjs` | what fraction of the deployed site `verify-live-site`'s staleness check looks at, and against **what** it compares |
| `tools/world/critic-deploy-r2-notice.mjs` | `--notice`: the shipped notice bytes, a harness that resolves, a canvas that never draws, with a delete-the-fix arm. `--boot`: does the instrument's own sampling change the boot it is timing |

---

## 1. `tools/check-shipped-files.mjs` — **4.5**. The rule-13 fix is real. The scanner has not changed at all.

### What genuinely improved, and it is the thing r1 hit hardest

r1's headline was *"the self-test is worth nothing… the scanner — `walk`, `SPEC`, `resolve`, the
data-manifest arm, the exit code — is not executed by either arm."* **That is fixed.** The self-test
now has four arms, they run `scan()` and `classify()` for real, and they are required to *disagree*:

```
check-shipped-files --self-test: tracked/untracked = true, self-introduced blocks = true,
                                 neighbour warns-and-passes = true, arms disagree = true
check-shipped-files --self-test: PASS (4/4)
```

And r1's rule-13 finding — scenario J, a neighbour's untracked scratch file under `game/` blocking
every agent on the box — is fixed twice over: first by a tracked-or-staged filter on `walk`, then
properly, by a blast-radius policy. `critic-deploy-r2-gate.mjs` measures the policy directly:

```
POLICY — run bare, the mode the pre-commit hook uses:
   ok   P1. the defect is in THIS commit's own staged files  -> must BLOCK   (exit 1)
   ok   P2. the defect is a NEIGHBOUR'S, nothing of mine staged -> must PASS  (exit 0)
```

Both correct. That is a real fix to a real rule-13 violation and it should be said first.

### The scanner is byte-for-byte the same regex, and its blind spots are r1's, unchanged

Run under `--strict` — the mode `tools/bank.mjs` uses at push time, so the blast-radius policy cannot
mask the answer:

```
 ok  CAUGHT          A.  untracked module, plainly imported   (the defect that shipped)
 ok  quiet           B.  everything tracked                   (must not cry wolf)
GAP  MISSED          C.  untracked module behind a >200-char binding list
GAP  MISSED          D.  file named only by new URL(..., import.meta.url)
GAP  MISSED          E.  file referenced only by index.html <script src>
GAP  MISSED          G2. side-effect import  (import "./x.js", no `from`)
GAP  FALSE POSITIVE  I.  an import inside a template literal  (a doc example, sound tree)
GAP  FALSE POSITIVE  K.  an extensionless import of a directory (sound tree)
GAP  FALSE POSITIVE  L.  an import specifier carrying a query string (sound tree)

detected 1/5 defect shapes (--strict); 3 false positive(s) on 4 sound tree(s).
```

`SPEC` is still `/(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s*['"]…/`. The 200-character window,
the mandatory `from`, the absence of any `index.html` scan, `existsSync` on a directory and the
un-stripped `?query` are all exactly as r1 described them. r1 named the one-line fixes for five of
these — *"drop the 200-char bound and strip comments and template literals before matching; add the
`from`-less form; scan `index.html`'s src/href"* — and none was taken. For completeness the previous
version (sha `f611eb7def40`) was also run through r1's own fixture and returned **4/8 caught, 3 false
positives**, so the change is confined to the policy.

### And the false positives now cost more than they did

r1's complaint about the false positives was that they *blocked*. They no longer block a neighbour —
but `tools/bank.mjs` now imports `scan()` and, on any problem, does this:

```js
const toUnstage = [...new Set(uniq.filter((p) => stillStaged.has(p.importer)).map((p) => p.importer))];
execFileSync('git', ['restore', '--staged', ...toUnstage], …);
```

So an agent who writes `import a from './atlas.js?v=2'` — ordinary cache-busting JavaScript, scenario
L, measured as a false positive above — gets that file **silently removed from the bank**. The bank
is the mechanism that survives container restarts; this project has lost nine agents to one twice in
a day. Dropping work out of the bank is the failure rule 1 exists to prevent, moved one level up.
Unstaging is the right instinct and the wrong lever until the scanner stops crying wolf.

*What I could not do (rule 26): I did not reproduce this on the live tree. Planting a `?v=` import
under `game/` would have dropped a neighbour's file out of the next bank. The `scan()` half is
reproduced in a throwaway repository; the unstage is four lines further on and is quoted above.*

---

## 2. `tools/world/verify-playable.mjs` — **3.5**. Rebuilt well. Its own control is red, so the matrix currently proves nothing.

Credit where it is due: this is a serious rebuild and it takes r1's findings seriously. The
bottom-left corner is gone, replaced by the whole framebuffer on a 12×12 grid. The latch is fixed
(`if (!engineUp) return … glNotYet`, with r1's finding cited in the comment). The four fake viewports
are eight real ones with an assertion that the framebuffer is *this device's shape*. There are four
instants instead of one, a movement check, a `--play` leg, and six sabotages instead of one.

### The self-test does not pass

```
verify-playable --self-test: six sabotages. EVERY row must go red.
  RED    (control, no sabotage)  << the control must be green: the boot promise had not resolved
                                    after 146s at load 7.83 …
  …
verify-playable --self-test: FAIL — 1 arm(s) wrong.
```

The tool's own comment states the standard it is failing: *"First a control: the untouched page must
go GREEN, or 'everything is red' proves nothing."* All six sabotages went red, and by its own rule
that is not evidence.

### It is the instrument, not the build

The engine constructs (`tools/harness/boot-check.mjs`: PASS). So I timed the boot two ways on the
same build, back to back, one browser:

```
rep   arm           boot     screenshots    load at start   paired ratio
 1    UNOBSERVED   10.7 s     0             13.63
 1    OBSERVED     69.7 s     2 (1 failed)  12.96             6.5x
 2    UNOBSERVED   14.5 s     0             22.39
 2    OBSERVED     48.4 s     2 (1 failed)  22.62             3.3x
 3    UNOBSERVED   52.4 s     0             29.96
 3    OBSERVED     72.3 s     2 (1 failed)  26.17             1.4x
```

`readFrame` takes a **full-page screenshot on every sample**, and its wait loop samples every 2 s
while it is timing the boot it is judging. The observed arm is slower in **3 of 3 paired runs**, by
1.4× to 6.5×; the ratio shrinks as the box's own load rises, because at load 26+ the box dominates.
And **3 of the 6 screenshots timed out**, one in every observed arm — which is the mechanism, not a
side effect: when `page.screenshot()` fails, `readFrame` falls back to the GL read, and with
`preserveDrawingBuffer` off since a52113c that read is guaranteed zero. That is exactly the
`CANNOT MEASURE PIXELS` line the control produced.

So the control's boot promise had not resolved after 146 s at load 7.83 while the same build boots in
10.7 s at load 13.6 unobserved. The tool's `--self-test` cap is 45 s and the loop overran it
threefold on screenshot latency alone. **The measurement is changing the thing it measures**, and the
one number the tool most needs — "did this boot?" — is the number it perturbs most.

### The two thresholds that are the point of the redesign have never been the reason anything went red

From the self-test's own JSON:

```
arm                litFraction  litBlocks  what actually turned it red
missing-renderer      1.000       1.000    noticeBad  ("the page gave up and said so")
missing-submodule     1.000       1.000    noticeBad
missing-data          1.000       1.000    noticeBad
no-webgl              1.000       1.000    noticeBad
draws-nothing         0.000       0.000    booted !== true  ("STILL LOADING")
frozen                0.000       0.000    booted !== true  ("STILL LOADING")
```

Four dead pages measure as a **fully lit screen**, because what the whole-frame reader is looking at
is the boot notice's own `position:fixed; inset:0` overlay. Every arm went red on DOM state, not on
pixels. `MIN_LIT_FRACTION` and `MIN_LIT_BLOCKS` — the fix for r1's corner-sampling finding — are
untested constants.

And the two arms written specifically to exercise the pixel and movement mechanisms, `draws-nothing`
and `frozen`, both went red as **STILL LOADING**: neither ever reached the state it exists to test.
`frozen` in particular is supposed to prove the movement check works, and the movement check never
ran on a booted page.

### Two smaller things

- **The exit code cannot tell a busy box from a black screen.** The prose distinguishes them
  beautifully (`SLOW` vs `BLANK` vs `UNMEASURED`, with a paragraph each). `failed++` and `exit 1` are
  identical for all three. For an instrument meant to gate a deploy, that is the whole decision.
- **A capability r1 had has been lost.** r1 measured boot at CPU×4 (21.9 s) and CPU×4 + 8 Mbit/s
  (91.1 s) and used those numbers to justify its wait. The current tool has no throttling profile at
  all — eight device *shapes*, one network. A phone's viewport is not a phone's connection, and the
  black screen that started this was on a phone.

---

## 3. `tools/world/verify-live-site.mjs` — **4.0**. The sweep is right. The staleness check compares against the wrong thing.

The sweep now covers all 715 published files and passes, the three-way git state
(committed / staged-not-committed / untracked) is a real improvement with a real sentence for each,
and the self-test grew a drift arm and a git-state arm that both genuinely disagree. It is honest
about the arm it cannot exercise:

```
verify-live-site --self-test: 0 file(s) under game/ are staged-not-committed on this tree right
                              now — that branch is untested on this tree
verify-live-site --self-test: PASS
```

### It compares the deployed bytes against the working tree, not against HEAD

```js
const local = sha(readFileSync(join(LOCAL, rel)));   // LOCAL = game/ on this disk
```

The only thing a static host can be *stale* against is what was published, which is HEAD. On a tree
where a dozen agents edit `game/` at once, the working tree is neither. Measured over a 60-file
stride sample:

```
critic-deploy-r2-drift: HEAD db449a5 · game/ has 715 tracked file(s) · verify-live-site hashes 2

  differs vs WORKTREE only   src/engine.js            live 604939B vs disk 605926B
  differs vs WORKTREE only   src/input/gamepad.js     live  28985B vs disk  31105B
  differs vs WORKTREE only   src/input/touch.js       live  22219B vs disk  22980B

  vs the WORKING TREE (what verify-live-site hashes): 3 differ — 0 inside its 2-file pair, 3 outside
  vs HEAD            (what was actually published):   0 differ
```

Three of sixty. Six files under `game/` had uncommitted edits at that moment, three of them staged.
Had any been `index.html` or `src/main.js`, the tool would have printed *"the deployed site is not
the published one… Either Pages has not finished building, or the build failed"* about a neighbour's
half-saved edit.

*I got this wrong first and it is worth recording.* My first run compared live against the working
tree, found `engine.js` differing, matched the live hash to a commit 18 back and nearly published
"the deployment is 18 commits behind". It was not: `git show HEAD:game/src/engine.js` hashes to
exactly what the site serves. The tool being measured and the measurement had the same bug, which is
how it took a second look to see it.

### Two of 715 files, and it says PASS

```
verify-live-site: PASS — all 715 files retrievable, and the deployed bytes match what we published.
```

That sentence was printed on the same tree as the table above. Both claims are true at once only
because the staleness check looks at `index.html` and `src/main.js` and nothing else — 0.28% of what
a stale deployment could hold. r1 named the set it should compare (the manifest, every module, a
stable sample of data leaves). Unchanged.

### It has no 5xx retry, over a 715-path sweep, and its sibling does

`head()` treats any non-200 as missing. There is no retry. Its sibling `tools/playability/verify-links.mjs`
carries this in its own header:

> *RETRIES ON 5xx, AND ONLY ON 5xx. A sweep of a hundred paths makes Pages' CDN answer the odd 503,
> and the first run of this tool reported a picture that is demonstrably there as broken.*

That is defect P8 in `orchestration/status/PLAYABILITY.json`, found and fixed. It was not propagated
to the tool that sweeps **seven times as many paths**, nor to `check-image-refs.mjs`, which sweeps
216. `grep -c "retry\|503\|5xx"` returns 0 for both. When it fires, `verify-live-site` prints *"This
is exactly how `game/src/input/hold-gate.js` reached the owner as a black screen."* about a file that
is there. This project has now been bitten by Pages' transient 503s three times; the fix is twenty
lines away in a file in the same family.

---

## 4. The boot notice in `game/index.html` — **3.5**. r1's defect is fixed and the fix installed a timer that erases the diagnosis.

Fixed since r1, and properly: the corner read is gone, replaced by 16 full-width bands across the
whole frame; the read happens inside `requestAnimationFrame` and at most once every 2 s (the old body
fired 2,280 `readPixels` calls and cost 8.8 s a call); a completed read is believed in both
directions with `drawing()` consulted only when no read has happened; the device line is on every
failure path; there is a copy button. The header records the reasoning for each. `dungeon_primary`
drew 33% of the frame and 33% clears a 1% threshold, so the undismissable overlay r1 photographed is
gone.

### It now diagnoses a black screen and then deletes the diagnosis

The fix for "undismissable" was a hard ceiling:

```js
if (sinceBoot > 20) { clearInterval(poll); clearInterval(tick); hide(); return; }
```

It does not exempt the `bn-bad` state. Measured against the **real shipped notice bytes** extracted
from `game/index.html`, with a harness that resolves and a canvas that never draws — which is exactly
the state the notice exists to report — with a delete-the-fix arm:

```
AS SHIPPED        accused at 5.7s · hidden at 19.7s · at 45 s the notice is "gone"
CEILING DELETED   accused at 6.3s · hidden at never  · at 45 s the notice is "bn-bad"
                  both said: "The world loaded, but nothing is being drawn."
```

Two runs, 5.6/19.6 s and 5.7/19.7 s. **The control genuinely differs**, so this is not an inert
teardown: removing the ceiling and nothing else keeps the diagnosis on the glass.

A player whose world builds and whose screen stays black reads the diagnosis for fourteen seconds and
is then returned to the silent black rectangle — the exact failure the notice was written to abolish,
now on a timer. `hide()` also sets `done = true`, and `done` gates the `window.fetch` wrapper's
`say()`, so every 404 and 503 after the twentieth second is silent too.

Pictures: `docs/shots/2026-08-08-critic-deploy-r2-the-notice-erases-its-own-diagnosis-as-shipped.png`
and `…-ceiling-deleted.png`.

### And it takes `verify-playable` down with it

`verify-playable`'s `READ_FRAME` reads `bn-bad` and calls it *"the page's own verdict on itself…
Reading it is how this tool tells 'the box is busy' from 'the page is broken' without guessing."*
That signal deletes itself 20 s after boot. `verify-playable` waits up to **180 s**. Two instruments
now depend on one signal that is built to self-destruct, and neither author tested the other's use of
it. In the self-test JSON, the three arms whose notice text came back empty are precisely the three
that were reported as `STILL LOADING`.

The right shape is the one the code already knows: hide on the ceiling when the notice is *waiting*,
and when it is `bn-bad` shrink it to a corner banner with a dismiss control instead of deleting it.

### Unfixed from r1, and it is the failure that actually happened

r1: *"'The game stopped while loading. an unknown error' is what the player sees for a 404 on a
module — the exact defect this whole round is about."* Measured again in this round's own self-test
log, both module-blocking arms:

```
missing-renderer   "The game stopped while loading. an unknown error"
missing-submodule  "The game stopped while loading. an unknown error"
```

A module `ErrorEvent` carries no `message` and no `filename`. r1 named the fix (listen for `error` on
the `<script type="module">` element, which does carry the URL). Not taken.

### The transient copy promises a retry that does not exist for modules

The notice tells a player, on any 5xx: *"The server refused N requests… Nothing is missing — the
game is asking again."* That is true for data JSON, which `LOAD_RETRY` in `engine.js` retries four
times. It is false for the module graph: ES module loading does not go through `window.fetch`, so the
wrapper never sees it, and nothing retries it. A 503 on `src/engine.js` produces *"an unknown
error"*, no retry, and a black screen — which is the same CDN wobble that produced P10, one directory
over, with no instrument on it.

---

## 5. `tools/playability/check-image-refs.mjs` — **4.0**. It fixed a real reader-facing defect. Its self-test does not run its own extractor.

This tool exists because `docs/progress.html` embedded twelve images from a gitignored directory and
404'd them for every reader. That was real, it was fixed, and the check now passes over 216 live
references. Good.

Its `--self-test` calls `sweep()` on two hand-built rows. `PAGES()`, `refsInHtml()`,
`refsInMarkdown()` and `resolve()` — the half that decides *which* references get checked — are not
executed by either arm. **That is the same defect r1 named in `check-shipped-files`, one directory
over**, written after that finding was published.

`critic-deploy-r2-imgref-fixture.mjs` builds the missing arm: nine throwaway git repositories, a
byte-identical copy of the tool, a local host standing in for Pages via the tool's own `--url` flag,
one real published page each.

```
 ok  CAUGHT          A. <img src> at an untracked file (the wld12 defect)
 ok  quiet           B. every reference tracked and served (must not cry wolf)
 ok  CAUGHT          C. reference into a gitignored directory
GAP  MISSED          D. CSS url() in a <style> block, untracked target
GAP  MISSED          E. <img srcset> naming an untracked file
GAP  MISSED          F. root-relative src at an untracked file
GAP  MISSED          G. raw <img> HTML inside a markdown post
GAP  FALSE POSITIVE  H. a link to a directory (a sound landing page)
GAP  FALSE POSITIVE  I. an image committed one minute ago, host not yet rebuilt

detected 2/6 broken-reference shapes; 2 false positive(s) on 3 sound tree(s).
```

`refsInHtml` matches `href=` and `src=` only. `srcset` is not `src=`. CSS `url()` is not an
attribute. `refsInMarkdown` matches `[](…)` only, and this project's blog posts are markdown that
contains raw HTML. Root-relative refs are deliberately handed to `verify-links.mjs`, which does
handle them — that delegation is sound, but `verify-links` walks three entry pages and not
`docs/blog/*.md`, so the class is split between two tools and falls down the gap for posts.

**H matters more than it looks.** `<a href="game/">` is a link to a directory; `resolve` returns
`game/`, `git ls-files` never lists directories, and the tool reports `UNTRACKED — on this disk,
never committed`. The landing page's own Play link is `./game/index.html` today, which is why this is
latent rather than live — but it is one editorial tidy-up away.

**I is structural, not a bug.** Every reference is required to be 200 *live*. `NEXT-DISPATCH.md`
recommends this tool "in the same 'run before every bank' habit". Run before a bank, every image
committed *in* that bank fails, because Pages has not built yet. The message names the ambiguity
honestly — *"mid-build, behind, or wrong path"* — and then exits 1 anyway, so the exit code cannot
express the distinction the message makes. A `--wait` mode, or splitting the tracked assertion (fast,
deterministic, bankable) from the live one (slow, network, advisory), would fix it.

---

## 6. `tools/playability/loader-retry.mjs` — **6.5**. The best instrument in this set, and it stops at the data loader.

This is the one tool here that satisfies rule 6 as written. Eight arms: a clean baseline, the flaky
503, a persistent 5xx, a permanent 404, **a null control** (arm 2's faults with the retry deleted from
the served bytes — must fail), **a control-sane arm** (no faults with the retry deleted — must boot,
so arm 5 going red is not just "the deletion broke the file"), and two **instrument arms** that
sabotage the *check* and require it to go red for the named reason. The deletions happen on the bytes
the server sends, are asserted to have applied, and the tool exits 2 rather than 0 if the fixture
could not be set up. Nothing else in this verdict is built to that standard.

Its limit is its scope, and the boot notice's copy oversells it (§4): `LOAD_RETRY` wraps `fetchJson`,
so it covers `game/data/**`. The module graph is fetched by the browser's own ES module loader, is
not retried by anything, and reports "an unknown error". The 503 that produced this tool hit
`world/hazards.json`; the same CDN wobble on `src/engine.js` is uninstrumented and unmitigated.

I did not re-derive its arms (`P10-loader-retry` is `done` and verified; rule 16, declared
`redundant_with`). I re-ran `--self-test` on the current tree and watched every arm land:

```
null control ready: 3276 bytes of retry removed from the served engine.js (disk untouched)
ok  clean · flaky · persistent · notfound · null-control · control-sane · instrument-404 · instrument-lie
8/8 arms landed where they must
```

The `instrument-lie` arm is the one worth copying: it puts the *original defect* back — a 503
announced to the player as a missing file — and requires the truthfulness check to catch it. That is
the only place in this family where a check has been shown failing for the exact wrong behaviour the
fix could have introduced.

---

## 7. Method and wiring — **3.5**. Rule 9's aggregation exists and nothing calls it.

r1: *"It is not wired into anything, and that cost something during this round."* The response was
`tools/playability/standing-check.mjs` — "THE one command" — which runs `verify-live-site`,
`verify-links` and `verify-playable` together, and which cites r1's sentence in its own header.

```
$ grep -rn "standing-check" --include=*.md --include=*.mjs --include=*.json .
  orchestration/INDEX.md:640   (generated)
  tools/playability/standing-check.mjs   (itself)
```

Nothing else. Not `TICK.md`, not `.githooks/pre-commit`, not `tools/bank.mjs`, not a workflow. **The
fix for "nobody runs it" was another tool nobody runs.** It also omits `check-image-refs` and
`loader-retry`, so even if it were wired, two of the six subjects are outside the aggregation.

The one subject that *is* wired is `check-shipped-files`: blocking in the hook for self-introduced
problems, and `--strict` inside `tools/bank.mjs` at push time. That is the right shape and it is why
this axis is 3.5 and not lower.

### Rule 6, fourth shape: how many instruments per defect, and how many defects with none

| defect class | instruments that would catch it |
|---|---|
| untracked module, plainly imported (**the one that actually happened**) | **4** — the gate, `verify-live-site`, `verify-playable`, the boot notice |
| untracked module by any other syntax (C/D/E/G2) | 2 — `verify-live-site` (it walks the disk, so syntax is irrelevant to it) and `verify-playable` in live mode. Both post-push, both unwired. |
| a broken image on a published page | 2 — `check-image-refs`, `verify-links` (entry pages only) |
| a transient 5xx on a **data** file | 2 — `loader-retry`, the notice's transient path |
| a stale deployment | 1, looking at 2 of 715 files |
| **a transient 5xx on a module** | **0** — not retried, reported as "an unknown error" |
| **cache headers, and the owner's second visit** | **0** — `serve.mjs` sends `no-store`, Pages sends an ETag; every reading in this project is a cold first load |
| **HTTP/2** | **0** — the live mirror is HTTP/1.1 by construction |
| **the CDN's own TLS as a browser sees it** | **0** — Chromium cannot handshake through this container's proxy; measured and documented in `live-mirror.mjs`, and it is a real hole, not an excuse |
| **a slow connection** | **0** — r1 had this (CPU×4 + 8 Mbit/s); the rebuilt `verify-playable` has no throttling at all |
| **whether the Pages build ran at all** | **0** — nothing asks GitHub; it is inferred from two file hashes |

Four instruments on the defect that has already been fixed; six classes with none. Two of those six —
the second visit and the slow connection — are *the two conditions the owner's phone was actually
in*. The redundancy is not wasted (the four disagree usefully, and one is static where three are
runtime), but the ratio is the finding: **effort has gone to the failure that is already understood.**

### Self-tests that cannot fail on the thing they are for

Down from two to one and a half, which is progress:

- `check-shipped-files --self-test` — **fixed**, four arms that execute the scanner and disagree.
- `check-image-refs --self-test` — **still cannot**: its extractor is not executed by either arm.
- `verify-playable --self-test` — the opposite failure. It *can* fail; it cannot currently pass,
  because its control is red, so nothing it reports is evidence.
- `verify-live-site --self-test` — sound, with an honest declaration of the arm it cannot exercise.
- `loader-retry --self-test` — the standard the others should be held to.

---

## Scores

| axis | r1 | r2 | why |
|---|---|---|---|
| `check-shipped-files.mjs` | 3.5 | **4.5** | self-test fixed (4 arms, scanner executed, arms disagree); rule-13 blast radius fixed and measured correct. Scanner unchanged: 1/5 under `--strict`, 3 false positives, and those now silently drop a file from the bank. |
| `verify-playable.mjs` | 5.0 | **3.5** | serious rebuild that answers r1 on every point — and its control is red, so the six-sabotage matrix proves nothing. Its own screenshot sampling costs 550% of the boot it times. The two new thresholds have never turned an arm red; 4 dead pages measure 100% lit. |
| `verify-live-site.mjs` | 5.5 | **4.0** | full 715-file sweep and a real three-way git diagnosis. Drift still 2 of 715, still unwired, and it hashes against the **working tree** rather than HEAD — measured, 3 of 60. No 5xx retry over 715 paths while its sibling has one. |
| boot notice | 4.0 | **3.5** | the corner-sampling defect is properly fixed. The fix's 20 s ceiling erases the black-screen diagnosis at 19.7 s (control differs) and takes `verify-playable`'s page-side signal with it. "an unknown error" for a module 404 is unfixed. |
| `check-image-refs.mjs` | — | **4.0** | new, and it closed a real reader-facing defect. Self-test does not run its own extractor; 2/6 shapes; 2 false-positive shapes; the live arm makes its own recommended usage self-defeating. |
| `loader-retry.mjs` | — | **6.5** | the only tool here with a null control, a control-sane arm and two instrument arms. Scope stops at `fetchJson`; the module graph has no retry and the notice's copy says otherwise. |
| method and wiring | 4.5 | **3.5** | rule 9's aggregation exists and nothing calls it; six defect classes have zero instruments, including the two the owner's phone was in; one self-test still cannot fail and one cannot pass. |

**Min over axes: 3.5. Gate 7.0. FAIL.**

**The single biggest gap** is not any of the seven. It is that **the instruments now fail in the
direction of the tester rather than the player**: a control that is red because of its own
screenshots, a staleness check pointed at a neighbour's uncommitted disk, an aggregation nobody calls,
and four guards on a defect that is already fixed — while the second visit, the slow connection, the
cache header and the module-graph 503 have none. Every one of those four is what the owner's phone
actually does.

**The cheapest thing that would move this number most:** wire `standing-check.mjs` into
`tools/bank.mjs` as a non-blocking post-push follow-up, add `check-image-refs` and `loader-retry` to
it, and give `verify-playable` a `--no-shots` sampling mode so its own control can go green. That is
a day's work at most and it takes three axes above 5 on its own.

## What I could not do (rule 26)

- I did not reproduce the `bank.mjs` unstage-on-false-positive on the live tree; the reason is in §1.
- The observer-effect figures are n=2 unobserved and n=1 observed. A third arm was still running when
  I wrote this. The comparison is back-to-back on one box and the effect is 6×, which is far outside
  the between-arm variance I saw (10.7 s vs 14.5 s at loads 13.6 and 22.4), but it is not a
  distribution.
- I ran `verify-playable --self-test` in `--local` mode, not `--live`. The live mode adds the mirror
  (~700 files down one CONNECT tunnel each) and would have made the observer-effect finding harder to
  attribute, not easier. Every sabotage in the matrix is about the page, not the transport.
- I did not test the `--play` leg at all. It is the newest and least-graded part of `verify-playable`
  and it is the only thing in the family that asserts the game can be *started*. It needs its own
  round.
- No figure here is from a real phone or a real network. That limit belongs to the whole family and
  `live-mirror.mjs` states it plainly, which is the right way to carry it.
- `game/` was dirty throughout (six files under `game/`, three staged by neighbours). Every subject
  measurement names the sha or commit it was taken against; the boot-notice arms use bytes extracted
  from `game/index.html` at a named commit rather than a moving tree.
