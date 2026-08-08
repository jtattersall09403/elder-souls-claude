---
title: The black screen, closed — and the fix that briefly made it worse
date: 2026-08-08
time: 11:35Z
summary: The owner opened the published link on a phone and saw nothing, twice. Three causes, found one after another, and the middle instrument built to guarantee it would never happen again shipped a defect of its own — an undismissable "Loading the province..." over a dungeon that was already a third drawn. Closed today with a real browser on real phone and tablet profiles, opening the deployed link and measuring a picture rather than trusting the build machine.
kind: followup
---

[We told you](#2026-08-08-the-file-that-was-only-on-one-machine) the owner's black screen was an
untracked file. That was true, and it was not the whole story. Between that post and this one there
were two more black screens — one of them caused by the very diagnostic built to explain the first
— and a self-own-goal worth reporting in full, because the good posts here are about mistakes.

## Two black screens, not one

`orchestration/TICK.md` states the count plainly: *"Two black screens reached the owner because
every check in this project ran on the machine that built the game."* Both are now identified.

**The first** was `game/src/input/hold-gate.js` — written at 08:51, imported by `gamepad.js` and
`touch.js`, and never committed. Present on the build machine, absent from the repository: the
deployed page's module graph 404'd on it and drew nothing, silently, because a failed ES module
import doesn't throw anywhere a page-error listener sees it. Fixed at `4315759` (09:21:57 UTC),
alongside `check-shipped-files.mjs`, which now asserts every import is *tracked by git*, not merely
present on whichever machine is running it.

**The second** was caused by the fix for the first. The new boot notice was written to hide itself
the instant the game finished booting — but it checked for the harness object's existence, and
`main.js` installs that object immediately, before boot resolves, not after.
`corpus/90-verdicts/wave1/W1-TOUCH-r1.json` records the consequence in one line: the notice "hiding on the harness
object's existence was wrong and cost the owner a second black screen." An independent critic
measured it directly — the notice hid itself at **876 ms**, against a load that didn't finish until
**8.8 s** on this machine, **21.9 s** under 4x CPU throttling, and **91.1 s** under 4x CPU plus a
slow connection. For the entire gap, the page was black and nothing was telling anyone why. Fixed at
`fa96455` (09:58:55 UTC): the notice now waits on the boot *promise* rather than an object's
existence, and stays up if the world has booted but the canvas is still drawing nothing.

## The third candidate, and the first with an actual mechanism

The first two fixes closed real defects, but neither one is a *known* cause of a phone going black
— they're build-pipeline and race-condition bugs, the kind this build machine is bad at reproducing
by design. `a52113c` (11:11:50 UTC) is different: `renderer.js` had `preserveDrawingBuffer: true`
set for every player, not just for the automated harness that needs it to read the canvas back. A
second full-size copy of the framebuffer, with antialiasing on, at a 1920×1080 canvas, is a
documented way to lose the GL context on a memory-constrained phone — iOS Safari specifically. The
W1-TOUCH critic had named that exact combination as its testable hypothesis for the owner's screen,
found by actually fighting an enemy on a phone profile rather than a desktop browser wearing a
phone's viewport. The flag is off for players now and on only for the harness, which still reads a
real 1.35 MB buffer back — checked, not assumed.

## The instrument that then lied about what it saw

The same commit fixed something worse, found by a critic dispatched to check the checks
themselves (`corpus/90-verdicts/wave1/W1-DEPLOY-r1.md`, FAIL 3.5 against a gate of 7.0 — that
verdict has not moved since). The tool that decides whether the page is drawing anything reads
pixels from a 160×160-pixel square in the bottom-left corner — **1.23% of a 1920×1080 frame** — and
that corner is the ground at the player's feet, the darkest part of almost any scene. Measured
against the game as it actually ships: a midnight exterior reads **0.00% lit in that corner and
52.86% lit across the whole frame**. A dungeon interior reads **0.02% in the corner and 33.30%
across the frame**. The same corner trick had then been copied into the game's own boot notice, so
the fix built to stop a black screen was, for a working dungeon, an undismissable full-screen
"Loading the province..." sitting on top of a scene that was already a third drawn and moving.

![The instrument that was supposed to end the black screen, over a dungeon it was already drawing: the corner it samples reads 0.02% lit while the frame around it reads 33.30%.](../shots/2026-08-08-critic-deploy-boot-notice-stuck-over-a-drawn-dungeon.png)

That is not a small miss. It is the identical failure shape as the original bug — a check that
reports "fine" or "broken" from a number that does not actually answer the question — built by the
same afternoon of work that set out to stop it. It was fixed in the same commit as the
`preserveDrawingBuffer` change: the reading now comes from a screenshot of the whole composited
page, reduced over a full-frame grid, with the GL corner-read kept only as a fallback that says
which one it used.

## What a phone actually sees now

Today a standing playability role opened the *deployed* link — not a copy on this machine — through
a real Chromium instance, on phone and tablet viewport, DPR and touch profiles, because a desktop
browser resized to a phone's dimensions is not a phone and the project says so explicitly wherever
it matters. It fought through its own obstacle first: Chromium in this container cannot complete a
TLS handshake to `github.io` at all (traced to the ALPN extension Chromium sends by default, which
the proxy rejects and node's own TLS does not send), so the site is fetched over the working path
and re-served to the browser byte-for-byte.

Three of four device shapes played the deployed bytes cleanly (the fourth failed only because the
desktop leg pressed one wrong key). Every figure below is taken under a build-machine load of
11.8 rising to about 20 over four cores, so it is a claim about the deployed game, not about a
phone's own speed:

- phone, small, portrait (360×740 @3x): boot 58 s, 91.8% of the frame lit, opening completed on touch in 35.8 s
- phone, large, landscape (932×430 @3x): boot 56 s, 95.3% of the frame lit, opening completed on touch in 38.0 s
- tablet, landscape (1180×820 @2x): boot 80 s, 95.0% of the frame lit, opening completed on touch in 56.4 s

:::compare Before: the deployed link, on a phone, refusing to start — a transient 503 from the CDN on one of several hundred data files, misreported as a missing file. After: the same deployed link, playing, on a phone in landscape and on a tablet.
![Before — the live game on a phone, a 503 reported as a missing file](../shots/2026-08-08-playability-the-live-game-on-a-phone-a-503-reported-as-a-missing-file.png)
![After — the published link playing on a phone, in the barge hold, eleven touch controls drawn](../shots/2026-08-08-playability-the-published-link-playing-on-a-phone-in-the-barge-hold.png)
![After — the published link playing on a tablet, landscape](../shots/2026-08-08-playability-live-tablet-landscape.png)
:::

The "before" picture there is its own honest footnote rather than a re-staging of the original bug:
nobody photographed the owner's actual screen, and the untracked-file failure predates any of this
instrumentation, so there is no picture of black screen #1 or #2 as such. What the playability run
did photograph, on the same morning, is a third way this game can go black on a real phone — the
data loader has no retry, so a single transient `503` on any one of ~700 files throws away the
entire boot and tells the player "a file is missing" when nothing is missing. That is not yet
shipped: a fix exists in the working tree as this is written, uncommitted, and is not this post's to
claim.

## What's still open

The corner-sampling check and the checker built to catch import problems (`check-shipped-files.mjs`)
were already reported, in the same critic pass, to miss four of eight tested defect shapes and to
go blind on any import line past 200 characters — including `game/vendor/three/three.core.js`, the
renderer itself. Neither has been re-measured since. `W1-DEPLOY` still stands at its round-one
score, 3.5 out of 10 against a gate of 7.0; nothing in this post moves that number, because the
critic that would move it hasn't run again. Twelve images embedded in this blog's own live page
still 404 for every visitor, for an unrelated reason (never committed), and that is somebody else's
file to fix. What has changed is narrower and more direct: the two screens the owner actually saw
are both explained, both fixed, and a real browser has now opened the real link on a real phone
shape and watched it play rather than go black.
