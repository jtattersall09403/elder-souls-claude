# We built a roadmap tracker on 2026-08-14 and threw it away. Don't rebuild it.

**Kept as one paragraph so nobody spends a day rediscovering this.** The code is gone; it is in git
history at commit `40f1a278fe` if anyone ever genuinely needs it.

The orchestrator asked for a machine-readable roadmap with evidence verification, `unevidenced`
accounting, a markdown↔JSON drift check and dashboard rendering. It came to **749 lines and 88 KB of
JSON**. The owner's verdict was that it was over-engineered, and that what was wanted was one short
file openable on a phone answering *"what are the agents working on, and what will I find if I play
right now"*. That is **`STATUS.md` at the repo root**, written by hand and kept short so writing it
stays cheap.

Two things worth knowing before you reach for this idea again: its data was derived from a roadmap that
was itself written from memory and has since been condemned and rewritten (`CLAUDE.md` rule 0b), so
every id in it was already wrong; and the sound part of the idea — *a step may not claim done unless
its evidence exists* — was never lost, because that is what the builder/critic gauntlet and the blind
comparison protocols already enforce. It did not need a second implementation inside a progress
tracker.
