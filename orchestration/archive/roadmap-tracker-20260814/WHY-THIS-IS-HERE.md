# The roadmap tracker, archived unfinished — 2026-08-14

**This was not abandoned because it failed. It was abandoned because the orchestrator asked for the
wrong thing, and the owner corrected it.**

The brief asked for a machine-readable roadmap, evidence verification (a step could not report `done`
unless its named evidence existed on disk), `unevidenced` accounting, a markdown↔JSON drift check, a
self-test with both arms, and rendering into the progress dashboard. It came to **749 lines of tooling
and 88 KB of JSON**.

The owner's verdict: *"I'm actually not sure the thing the tracker agent is building is a good idea,
feel like it's over-engineered."* Correct. What was actually wanted was one short file you can open on
a phone:

> *"oh cool our agents are currently working on [bit x] of the roadmap; I should expect that everything
> before that bit is delivered to the 7/10 standard; if I play the game right now I know what to
> expect."*

That is `STATUS.md` at the repo root, written by hand and kept short so writing it stays cheap.

**Two further reasons this could not have shipped as built**, worth recording so nobody reads the
archive as a lost opportunity:

1. **Its data was derived from a condemned document.** `ROADMAP.md` was written from an orchestrator's
   working memory rather than from the repo (see `CLAUDE.md` rule 0b) and is being rewritten from a
   coverage audit. Every id and phase in the JSON here is about to be wrong.
2. **The verification idea was sound and is not lost.** "A step may not claim `done` unless its
   evidence exists" is a good principle — it lives on in the project's actual gate, which is the
   builder/critic gauntlet plus the blind comparison protocols. It did not need a second implementation
   in a progress tracker.

**What replaced it:** `STATUS.md`, plus `tools/status-fresh.mjs` — a warning, not a gate, that says
when `STATUS.md` has gone stale relative to branch activity. The owner's one hard requirement was
*"you've just gotta make sure the updates actually happen"*, and a warning is the smallest thing that
serves it. A blocking gate would fire on every unrelated landing, and a gate that fires constantly gets
switched off.

**If you are about to rebuild this: don't, unless the owner asks.** Read `STATUS.md` and this note
first.
