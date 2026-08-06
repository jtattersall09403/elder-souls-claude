# BAR CRITIQUE — reference-image acquisition prompt, review 04 (confirmation pass)

**Critic:** bar-critic
**Date:** 2026-08-06
**Artifact:** `docs/REFERENCE-IMAGE-REQUEST.md` (v4, 521 lines, commit `e602f56`)
**Scope:** narrow confirmation of RC15–RC21 only. Not a fresh review. All 14 gate conditions were
confirmed met in review 03 and are not re-examined here.

---

# VERDICT: SUFFICIENT

**The prompt is ready to run.**

All seven remaining changes landed, and they landed as written. The fence pairing is balanced,
every table in the document is well formed, no sentence was truncated or duplicated, no heading
moved, and the two contradictions that mattered — §3 vs §5e on the Morrowind count, and §11 rung 4
vs §3's video-frame prohibition — are both closed.

One splice artefact exists and I want it fixed before the run, but it does not gate: the RC20(a)
replacement consumed **rung 5** of the §11 ladder ("Leave it empty and say so"), and the new text
refers to rung 5 twice. It is a one-line restore, given literally below. I am not withholding
approval over it, for the reason set out in §3: it removes a restatement, not a rule, and it cannot
admit a bad file.

---

# 1. RC15–RC21 verification

| Rank | Landed cleanly? | Evidence |
|---|---|---|
| **RC15** | **Yes** | Fences now sit at lines **80, 101, 341, 359, 390 (` ```json `), 426** — three matched pairs, balanced across the whole document. Line 359 is the bare ` ``` ` that closes §8a's statistics block: `                   visible in the pixels we measure.**` / ` ``` ` / *(blank)* / `Move to `rejected/`: any file with `upscale_test < 0.004`…`. §8b (L365), §8c (L375), §8d (L380) and §9's opening line (L388) are all outside any code block and render as instructions. §9's exemplar sits inside its own intended ` ```json ` fence at L390–426 and parses as valid JSON. |
| **RC16** | **Yes** | §3 L142–145: "`refs/morrowind/` is different: it is judged on design language, not statistics. **Two to three images per slot** — four to five for the five rows marked **core** in §5e — deliberately chosen, is right. §5e is authoritative on those counts; this paragraph only explains why they are smaller than the modern floors." Matches §5e L264 ("**Two to three images per slot.** … Five slots are **core** and get **four to five**"). No occurrence of "Three to five" survives anywhere in the file. |
| **RC17** | **Yes** | §5a L207 is a 3-cell row in a 3-column table, verified by cell count across every row: `\| \`REF-M21\` \| **A flat, overcast, no-direct-sun exterior at midday**, any of the four games. … no reference for it at all \| \`exterior_daylight\` \|`. The stray `\|` before "Overcast noon" is gone and the profile is back in column 3. |
| **RC18** | **Yes** | §5e L271 / L285 / L286 are each 2-cell rows in a 2-column table, rationale retained inline: A4 "…lighting and clutter. Interiors differ by faction and class, and that difference is the property we are copying; one interior cannot show it"; A18 "…nothing else in the set can anchor them"; A19 "…the town street in REF-A8 does not show it". Cell-count sweep confirms all 19 REF-A rows are 2-cell. |
| **RC19** | **Yes** | §9 L432–433: "Filenames: `REF-M4__rdr2-bluewater-marsh-dawn.png` (double underscore separator), or `run-<source-slug>-<index>.<ext>` for interval-sampled frames, exactly as named in §3." Matches §3 L132 ("Name these `run-<source-slug>-<index>.<ext>`"). `t<seconds>` no longer appears in the file. |
| **RC20** | **Yes** (all three parts; see SD-A) | **(a)** §11 L484–485: "4. **A frame extracted from video — for `refs/morrowind/`, `anti-generic/` and `context/` only.** **Never for `refs/modern/`.**" — with "For a REF-M slot, skip this rung and go straight to rung 5" at L487. **(b)** L491–497 present immediately after the ladder and before "**What we need from you is not a full set**": "**The ladder changes the subject, never the standard.** A substituted file is still subject to §4 … §7 … §8a … and §8b". **(c)** §3 L125–130, directly beneath the floors table and above the anti-curation paragraph: "**Only files with `\"pixel_metrics_valid\": true` count toward these floors.**" |
| **RC21** | **Yes** | §4 L165–168: "Rehosted copies are acceptable and count toward the §3 floors provided they pass §8a — §8a is what protects calibration, and a re-host that passes it is measurement-identical to the original. Mark them honestly anyway, so we can re-check that subset first if a band later looks strange." The old "not used for band calibration" clause is gone. |

**Seven of seven landed.** No RC was misapplied in substance, and none of the seven damaged an
adjacent paragraph — with the single exception recorded next, which is a deletion inside RC20's own
target block.

---

# 2. Splice damage

## SD-A — §11 rung 5 was deleted, and two live cross-references now point at it

**Severity: low. Apply before running; not gating.**

The v3→v4 diff shows the RC20(a) replacement spanned lines 4–5 of the ladder rather than line 4
alone. Rung 4 was replaced correctly, and rung 5 —

> 5. **Leave it empty and say so.** This is a legitimate and final answer.

— was removed with it. The ladder now ends at rung 4. Two sentences added by RC20 still refer to
the rung that is gone:

- L487: *"For a REF-M slot, skip this rung and go straight to **rung 5**."*
- L496: *"a REF-A slot that cannot be filled with vanilla Morrowind goes to **rung 5**, not to another title."*

Both of those are the *correct* instruction pointing at a *missing* target, which is the shape of
defect most likely to make a careful agent stop and ask, and a careless one improvise.

**Fix — insert as a new line immediately after L489 (the end of rung 4) and before the blank line
preceding "**The ladder changes the subject**":**

```
5. **Leave it empty and say so.** This is a legitimate and final answer.
```

**Nothing else in the document is damaged.** Verified mechanically:

- **Fences:** 6 total, 3 matched pairs, no info string on any closing fence.
- **Tables:** every row of all four tables carries exactly the header's cell count (4/4 floors, 3/3
  §5a, 3/3 §5b, 2/2 §5e).
- **Headings:** §1 → §11 → "Above all" in order, §5a–§5e in order, no duplicates.
- **Duplicated or truncated prose:** none. No line over 40 characters occurs twice in the file, and
  every paragraph reached by the four splices (§3 ×2, §4, §5a, §5e ×3, §8a, §9, §11) terminates in
  a full sentence.
- **Stale strings:** `Three to five`, `t<seconds>` — both absent.
- **§9 exemplar:** parses as valid JSON.

---

# 3. Why SD-A does not gate

Because it removes a restatement rather than a rule, and it cannot let a bad file into the set.

The terminal behaviour rung 5 expressed survives, unweakened, in three other places — one of them
two lines below the hole:

- **§11 L499–504**, the paragraph immediately following: *"What we need from you is not a full set
  — it is an accurate map of what exists. For every slot you could not fill as written, tell us in
  the report: what you searched, what you found instead…"*
- **Rule 10 of the priority block, L53–54**: *"An honestly reported empty slot is a success."*
- **§10's abort rule, L460**: *"stop and report rather than padding the shortfall."*

An agent that falls off the end of the ladder is therefore told, three times over, to leave the
slot empty and report it. Critically, the missing rung **authorises nothing**: rung 4 still says
"**Never for `refs/modern/`**" in bold, so falling back to it for a REF-M slot is still barred by
the sentence directly above the gap. The worst realistic outcome is an agent pausing over a
dangling reference — not a degraded file entering `refs/modern/`. That is not damage to the
acquired reference set, which is the standard for INSUFFICIENT.

---

# 4. Optional polish — not required, do not delay the run for these

1. **§10 item 1** asks for "number delivered" against the §3 floor without repeating RC20(c)'s
   restriction. Appending "counting only files with `\"pixel_metrics_valid\": true`, per §3" to
   that bullet would remove a small chance of the count table over-reporting. §3 already governs;
   this is belt-and-braces.
2. **§3's RC20(c) paragraph now sits between the floors table and the anti-curation rule**, which
   pushes the "read this twice" paragraph one screen further down. Correct placement, marginally
   less punchy. Leave it.

Neither touches correctness. Neither is worth a fourth round.

---

# 5. Bottom line

**RC15–RC21 all landed. Nothing broke. One line to restore in §11, then run it.**

Three rounds of findings are closed. The two substantive risks review 03 identified — a Morrowind
over-ask that reversed the largest feasibility cut, and a substitution ladder that readmitted video
frames to `refs/modern/` — are both gone, and gone in the exact words asked for. The remaining
seven-word restore is housekeeping.

Green light.
