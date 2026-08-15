# Sealing evidence for the dialogue window's played gate

Written by the agent that **built** the arms and **judged nothing**. Everything here is
about whether the pair is fit to hand to a judge. Nothing here is an opinion about
which arm reads better; I built both, so my opinion is worthless by construction.

The handoff — who to spawn, what each receives — is
`orchestration/status/W1-UIX08-GATE-G.json`. This file is the measurements behind it.

---

## 1. The ablation is one token

`game/src/ui/system.js` line 150, `this.dialogueArm = { links: true → false }`.

`diff -rq` between the two served trees returns **one file**; `diff` on that file
returns **one changed line pair**. Both facts are asserted every build by
`leakcheck-arms.mjs` rows **L5** (differ in exactly one file, one line) and **L7**
(are not identical) — two rows that fail in opposite directions on purpose.

Measured consequence, live, at `helstrom-market` over a paired 10-step session: the
topic column is **identical at every step** (same rows, same order), the speaker is
the same, the disposition number is the same, the Goodbye button is the same. The
only thing that changes is whether a word inside the prose is lit.

### A defect in the control, found and fixed before the arms were cut

`Engine._dialogueCtx()` builds `linkable` from all of `rows`, which **includes the
service rows** (`barter`, `training`, `travel`) that §D2 puts *above* the rule. The
ablated arm filtered its extras against `topics` only, so every service row was
appended a second time into the alphabetical ask-about run — which is the failure §D2
names by name. That is a control made worse for a reason unrelated to the thing under
test: `HAZARDS` §0's broken null wearing a plausible arm's clothes. Fixed in commit
`a2b81ea4`; the extras now exclude the action ids.

## 2. The arms visibly differ in the running game

Found by search, not by assertion: **Neekhu / `latest rumors`**, `helstrom-market`.
The answer reads *"The carriers have raised their rate on the Thorn run…"*, and
`the carriers` is a topic in her column.

| arm | `links_total` | picture |
|---|---|---|
| ours | **1** — `the-carriers` lit blue and underlined inside the prose | `docs/shots/uix08-gate-g/dialogue-arm-with-inline-links.png` |
| ablated | **0** on the identical person and topic | `docs/shots/uix08-gate-g/dialogue-arm-without-inline-links.png` |

*(They live under `docs/shots/` and not beside this file because `reports/.gitignore`
drops every `.png` under `reports/` — the same rule that nearly lost the key. The
untracked originals are at `reports/blind/uix08-gate-g/sealing/`.)*

**It was the ninth (person, topic) pair tried.** The first eight lit nothing. That
number is the honest one and it matters more than the pair of pictures.

### How often a lit word is there to be found — offline, over the shipped corpus

Running the shipped `markLinks()` over `game/data/dialogue/topics/*.json`:

| | answers lighting ≥1 word | of 1,273 | spans |
|---|---|---|---|
| **floor** — each answer's own `AddTopic` targets only, independent of who is speaking | **441** | **34.6%** | 825 |
| **ceiling** — if the column held every topic in the game | 817 | 64.2% | 1,629 |

The floor is the number that binds: those 441 light *whoever* you are talking to,
because `_dialogueCtx()` adds an answer's own `to` edges to the linkable set in the
same call that displays it. What is **not** measured is how many lit words a judge
meets in ten minutes of ordinary play; that is an inference from these two numbers
and the ninth-try search, not a measurement, and the handoff says so.

## 3. The leak-check, and the fact that it has actually fired

`node tools/blind/played-pair/leakcheck-arms.mjs --pack <dir> --reveal <dir>`

Ten rows, **0 red** on the sealed pack: key not in pack · key dir outside pack · arm
names neutral · titles identical · no unexplained asymmetric tell (2 asymmetric hits,
both the ablation token) · this item never named · 182 residual subject tells reported
as informational because they are byte-identical on both ports · one file, one line ·
both arms parse · arms not identical.

`--self-test` builds a **deliberately leaky pair** — no redaction, directories named
`ours-arm` and `ablated-arm`, page titles naming the arm — and asserts the gate reds
on it and greens on the real one:

```
LEAKY pair: 5 check(s) red — L2, L3, L4a, L4b, L5      2,783 tell hits
CLEAN pair: 0 check(s) red                               178 tell hits
SELF-TEST PASSES
```

`RULES` rule 6: a control you have never seen fail is not evidence, it is a second
copy of the experiment.

### Four leaks the check caught while the pack was being built

1. `pack.json` published `baseline_commit` — and the commit that seals the pack has a
   headline naming the ablated arm, so a judge with the sha could have been told the
   answer by `git show`. The sha moved to the key.
2. `pack.json`'s `schema` string named the item. Renamed.
3. The tool directory was `tools/blind/uix08-gate-g/`, and the protocol handed to the
   judge quotes that path. Renamed to `tools/blind/played-pair/`.
4. Tell-matched redaction **alone** left `dialogue.js`'s opening line — *"a floating
   index of keywords you find by reading, not a menu of replies"* — which names the
   mechanism under test and carries no tell because it is a *description* rather than
   a label. Redaction now strips **every** pure-comment line (29,588 lines in 162
   files per arm, identically in both), each rewritten file re-parsed and restored to
   its original bytes if it stops parsing. Zero files needed restoring.

## 4. What quarantine does not cover, stated plainly

A judge that fetches `/src/ui/system.js` from both ports and diffs them identifies the
arms in one command. No static site served over HTTP can prevent that. It is prevented
by **protocol** and detected **afterwards**: `play.mjs` records every HTTP path the
server answered, the engine fetches each module exactly once (`cache-control:
no-store`, one boot), so a second hit on a source path is a fetch the engine did not
make. On the verification runs that count was **0**.

## 5. Both arms are playable

* One browser per run, served from the arm's own frozen root on an OS-assigned port.
* Production render, shipped HUD, **no debug overlay** — the `helstrom-market` label
  at the bottom left is `hud.place`, kind `place_name`, the shipped S54 out-of-combat
  element shown ≤3 s after a cell change (`game/src/ui/hud-world.js:213`).
* A 27-step session reached **three different people** — Neekhu, Anxthari, Ixthek —
  asked topics of each and left each. It took **7m08s of wall clock** at load
  2.92/core, ~16 s a step, because every run replays from boot. Judges must batch
  15–25 actions per run or they will spend the day on reboots.
* Verified at **one** viewport (1920×1080) and **one** world state. Neither arm was
  played at a phone viewport or in a second town.
