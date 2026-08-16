---
id: NEW-ITEM-PROPOSAL-DLG10-01
title: Nothing in the corpus governs out-of-world text reaching the player — the defect that started this piece was found by a blind judge, not by any bar we own
kind: text
side: neutral
status: PROPOSED — unruled, and deliberately BOUNDED, NOT BUILT. Filed by a BUILDER.
proposed_by: W1-DIALOGUE-AUTHORING-LEAK round-2 builder
diagnosed_by: W1-DIALOGUE-AUTHORING-LEAK round-1 critic (verdict FAIL at 5, 2026-08-16)
target: a new reference item, provisionally RI-DLG10
wave: 1
---

# The hole

A Blackwood Company mercenary shipped, in the game, saying:

> **"Say it in one line. Local. Useful."**

The first sentence is a brief to a writer. It reached a player-facing screen and **no check, no
reference item and no verdict caught it.** It was found by a **blind judge shown a screenshot of
the conversation window**, who flagged it unprompted — the one instrument in this project with no
stake in the build.

**The census, re-derived 2026-08-16 by this builder:**

```
grep -rliE 'authoring instruction|writer.s instruction|placeholder text|meta-instruction' corpus/ --include=*.md
```

returns **1 file**, and it is `corpus/90-verdicts/wave1/W1-DIALOGUE-AUTHORING-LEAK-CRITIC.md` —
the verdict that reported the hole. Across **153 reference items** (`ls corpus/*/RI-*.md | wc -l`),
**nothing governs this class at all.**

The nearest thing is `RI-DLG03` step 7, and it is not close: its banned list is
`quest|objective|marker|waypoint|your map|coordinates|N metres|head north N` — **Souls/HUD
vocabulary**. Run against the leaked line it returns nothing. *"Say it in one line"* contains no
banned token, breaks no disposition rule, violates no register anchor, and passes every dialogue
check this repo owns.

# What is proposed, and what is deliberately not

**Proposed: a reference item covering text that addresses the WRITER, THE MODEL, or THE TOOLING
rather than a character** — a class distinct from `RI-DLG03`'s (in-world text using out-of-world
*game vocabulary*) and from `RI-DLG06`/`RI-DLG08` (in-world text that is *flat*). Three classes,
three failures, and only two have an owner.

A sketch, to be argued with rather than adopted:

| | |
|---|---|
| **A. The class** | Authoring briefs (*"keep it under 40 words"*, *"say it in one line"*), placeholders (`TODO`, `TBD`, `[insert name]`, lorem ipsum), model self-reference (*"as an AI"*, *"stay in character"*), and tooling artefacts (schema keys, debug strings, ids) rendered as speech or prose |
| **B. The surface** | Every string a player can be shown, enumerated **from its consumer**, not from a key-name whitelist — a whitelist of keys is a denylist of everything else, which is how `faction-refusals.json`'s **59 strings across 7 factions** stayed invisible to round 1's check |
| **C. The instrument** | A static lint is the floor, not the bar. **A blind judge found this and a regex could not have**, because the leak was grammatical, in-register, correctly punctuated, and the right length. Any item here should require a **blind read of rendered screens** (`blind_pair`), with the lint as the cheap pre-filter |
| **D. The scored quantity** | 0 tolerated. Not a rate — one leaked brief on one screen is the whole defect |
| **E. Where it stops** | It does not cover whether a line is *good*, or whether it belongs to its faction. Those are `RI-DLG06`/`RI-DLG08`'s and remain uncovered for greetings specifically — see the note below |

**Not proposed, and this is the point of filing it as a proposal:** the item itself. **A builder
must not author the bar its own work is judged against.** This piece shipped a fix, a rewritten
line and four checks for exactly this class; writing the reference item that grades them would
make every one of those judgements self-certified. Bounded, not built — the same disposition the
round-1 critic took, for the same reason.

# A second hole, adjacent, noted for whoever rules on this

Round 1's fix was **correct and anonymous**: it replaced the leak with *"The writ says nothing
about talk."* Of the 30 shipped greeting lines containing `writ`, **25 belonged to a different
faction** — the writ-house clerks, whose own address fragment is *"Name, and what the writ says
under it."* It transplanted natively into three other reaction groups. (Re-derived by this builder
against the round-1 tree: `writ` → RG-LEDGER 25, RG-BWC 5.)

**No item scored that either.** `RI-DLG06` (voice differentiation) and `RI-DLG08` (tonal range) are
the closest, and both are about *speaker archetypes and tone*, not about whether a **faction's**
greeting could only be said by that faction. `CLAUDE.md`: *Morrowind wins everywhere outside the
fight* — and greetings are how a town tells you what it is. Round 2 built
`tools/dialogue/check-greeting-voice.mjs` as a stopgap (it derives which tokens are exclusive to one
reaction group and gates the one cell this piece owns, with round 1's rejected line kept as a
permanent negative control). **A tool is not a bar.** It gates **1 of 300 cells** and says so in its
own output.
