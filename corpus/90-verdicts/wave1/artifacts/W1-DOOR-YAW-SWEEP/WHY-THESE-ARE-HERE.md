# Door-exit yaw evidence, rescued from a gitignored path — 2026-08-14

These files were produced by `W1-DOOR-YAW-SWEEP` and existed **only on one container's local disk**.
`git log --all` returned nothing for any of them: they were written under `reports/door-yaw/`, which
`reports/.gitignore` blanket-ignores, and were never force-added the way `HAZARDS.md` §9 requires for
cited evidence. A container restart would have destroyed them — and this container has restarted twice
in one day, taking nine agents with it each time.

Found by `STRANDED-TRIAGE`, which was looking for something else entirely.

They are the in-game sweep arms and the CONSUMPTION demonstration behind the door-exit facing fix — the
change that took the writ house, the first door in the game, from 0.50 m of clearance to 12 m with the
inward null control collapsing to 0.25 m.

**The general lesson, which is HAZARDS §9 in its most expensive form:** evidence written under an
ignored path is not evidence. It is a local file that a verdict cites and nobody can ever check. Put
cited artefacts under `corpus/90-verdicts/<wave>/artifacts/<piece>/` and verify them against the
**remote blob** — `bank.mjs` prints `verified N path(s) against the remote blob`, and if your artefact
count is not in that number, it did not land.
