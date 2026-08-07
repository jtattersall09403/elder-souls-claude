# Session brief — the first hour

> **This file is an artifact, not a document.** `RI-EXP01` step 1 names it by path and
> `PLAYTHROUGH-CRITIC` §4.2 binds its contents: *"the session prompt does not name the behaviour
> being measured… prompt text is an artifact and is committed with the run."* It is handed
> verbatim to the driving agent by `tools/experience/session-run.mjs --brief`, and it is copied
> into every session directory so a critic can check that the hour it is scoring was not
> instructed into existence.
>
> **Do not add helpful detail to this file.** Every sentence below was checked against the
> thirteen quantities `RI-EXP01` computes, and none of them names one. Adding *"look around"*,
> *"try to find things"*, *"talk to people"*, *"be careful, some places will kill you"* or
> *"see how far you get"* would make `T_found`, `N_found`, `N_persons`, `T_death` and the
> detour instruments measure the brief instead of the game. An agent told to explore that then
> explores has told you nothing.

---

You are playing a third-person action role-playing game in a browser. It is starting from the
beginning.

You have an hour.

Play it.

---

## What the driver will and will not do for you

- The game is already loaded and the harness is attached. You act through the stdio protocol
  `session-run.mjs` prints on startup: real key presses, real pointer input, frame steps,
  captures, and a small set of harness calls.
- **Some harness calls are refused.** Under `--profile first-hour` the driver replaces
  `teleport`, `spawn`, `aggro`, `setTimeOfDay`, `setWeather` and `loadState` with throwing
  stubs. This is not a rule you are being asked to keep: the calls do not work, every attempt
  is recorded, and an invocation voids the run. If you find yourself stuck, being stuck is a
  measurement.
- **You may not read `game/data/**`, any reference item other than the one your inbox already
  contains, any prior verdict, or any builder's notes** — before or during the hour.
  `PLAYTHROUGH-CRITIC` §3 calls this prohibition absolute, and the reason is arithmetic rather
  than moral: half of what this session measures is *what a player finds*, and an agent that
  has read the content files cannot find anything. `tools/experience/isolation-check.mjs`
  diffs your tool-call log against your inbox manifest afterwards.

## What to write down while you play

One line per action to `intent.jsonl`, **before** you take it: what you are about to do and
why, with no evaluative adjectives. *"Going up the ladder because there is a ladder"* is a
line. *"Exploring the wonderfully atmospheric hold"* is not.

Use `{"op":"note","text":"…"}` for anything that happened that you did not cause.

## When to stop

You choose. Say when you are stopping, and why, **before** you stop.
