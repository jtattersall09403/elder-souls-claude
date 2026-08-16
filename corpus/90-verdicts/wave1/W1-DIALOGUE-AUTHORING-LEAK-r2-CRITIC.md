# W1-DIALOGUE-AUTHORING-LEAK round 2 — critic's verdict

**FAIL at 4 / 10** (gate ≥ 7.0, min-over-items). RI-MTH07 **7** · RI-DLG03 **4** · RI-UIX05 **4**.
Commit `e1f5c74a`, branch `codex/wave1-build-experiment`.
Evidence: `corpus/90-verdicts/wave1/artifacts/W1-DIALOGUE-AUTHORING-LEAK-r2-critic/`.

---

## What I did

I re-ran all seven controls against the shipped artefacts, offline, while the box was over its
contention ceiling (`contention.mjs`: WAIT, 4.04 per core). When load fell to 1.95 per core I took
three browser slots at **GO**, sequentially, and used them for the two things that genuinely
required a browser: the entity-side perturbation this piece rests on, and RI-MTH07 §C3.

**I inherited no number.** Every figure below came from a command run in this session.

## The guards hold, and I could not break them on the path they were built for

| Control | Expected | What I observed | |
|---|---|---|---|
| A guard deleted in `foldBooks()` | bookfold red | `0/0/0/1`, the 24 come back | ✅ |
| B leak at source + regen | leaks+consumer red | `1/1/0/0`, grep 5 → 5 | ✅ |
| B2 leak at source, no regen | leaks red off source text | `1/0/0/0`, shipped file greps 0 throughout | ✅ |
| **C call site reverted** | red (round 1: all green) | `2/0/0/4` **and** 1897→1715 pages | ✅ |
| **D leak into shipped `greetings.json`** | red, evidence survives | `1/1/0/0`, grep 1 → **1**, **sha256 identical** | ✅ |
| E leak into a faction-refusal line | leaks red | `1/0/0/0` at `.factions.the_rootkeepers.reputation` | ✅ |
| F round 1's rejected line restored | voice red, leaks green | `0/1/1/0` — both, plus consumer (unreported) | ✅ |
| G1 generator guard stripped | leaks red, evidence survives | `1/1/0/0`, grep 1 → 1 | ✅ |
| **G2 round-1 shape reconstructed** | exit 4 | **depends on where the import sits** | ❌ |

Control D is the one that mattered and it is properly closed. Round 1's check deleted the leak and
reported its absence; round 2's leaves the file **byte-identical** (`fad763ee76be3e01` both sides),
still greppable, and exits 1 naming `.pools[180].lines[3]`.

## The strongest claim had no artefact — so I ran it

`git show --stat` on both of the round's commits returns seven tool/data files and one status file.
No log, no report. `critic-w1-library-pages.mjs` only writes with `--out`, and
`reports/critic-w1-library-pages.json` is still the Aug-7 file from a different round. **1897, 1715,
15, 57 and the 21/24/3 identity existed only as prose.**

Before opening a browser I tested them offline and found them *over-determined*: the harness asks
**325 rows over 163 distinct ids**, because `manifest.json` contributes 162 duplicates — so
15 → 57 single-page rows uniquely selects **k = 3** of the 24 out of six candidates, and the
182-page drop implies **128.3 words/page** against a reported median of 120.

Then I ran both arms myself:

```
fixed     1897 pages   min 10 words/page   15 single-page rows
reverted  1715 pages   min  1 word/page    57 single-page rows
21 ids collapse only under the revert;  21 + 3 = 24;  symmetric difference EMPTY
coupling 1.00   ·   null control: 0 of 139 non-collided ids moved
```

**Every number reproduced exactly.** The three that are one page either way are `crate-tally`,
`inscription-third-terrace`, `shore-compass` — 102, 91 and 113 real words. I say this as plainly as
the failure below: I went looking for this claim to be unverifiable and it was true.

## I closed RI-MTH07 §C3, which neither round attempted

Every check in this piece reaches `greetingFor()` by *supplying* it `{npcId, reactionGroup,
disposition, playerRace, nth}`. §C3 says that is not enough. `Engine.talkTo(eid)` supplies none of
it — it finds the NPC in the live sim and derives the rest. Driven in a browser over all **60 NPCs
standing in `town-lilmoth`**, nine reaction groups: 102 distinct greetings, **0 leaks**, the
corrected line reachable, and no non-RG-BWC NPC speaking a Company or Leyawiin line.

## Two things fail

### 1 — the biggest gap: the defect was diagnosed as one third of itself, twice

The blind judge flagged **`"Say it in one line. Local. Useful."`**. Both rounds located the defect
entirely in the STANCE fragment and neither ever asked what `Local. Useful.` was. It is
`ADDRESS['RG-BWC'].saxhleel`, `gen-greetings.mjs:106`, untouched by either round.

Here is what Corvus Aldeyn actually says, read out of the running engine:

```
Company time, and Leyawiin bought it. Local. Useful.
Local. Useful. We are working.
Local. Useful. Contract business only.
The Company is not recruiting today. Local. Useful.
Local. Useful. Take it to the factor.
```

**Five of five.** The composition alternates, so the fragment is an opener as often as a closer —
and opening on it reads more like a brief than it did inside the original string. No check can see
it: the leak patterns do not match it, and the voice check passes the cell on `leyawiin`/`bought`,
which come from the other half of the line. Every sibling RG-BWC address is a full sentence of
speech; this one is two words.

*The sentence the round wrote is good.* `writ` is back to 25 of 25 RG-LEDGER, `Leyawiin` 5 of 5 and
`Company` 35 of 35 RG-BWC (all re-derived), `leyawiin`/`bought`/`contract`/`coin` are exclusive to
RG-BWC across all 1,500 lines, and the referent is **hard canon** — `canon.json` CF-064, *"the
Blackwood Company is a Leyawiin mercenary outfit"*. It could not be said by the writ-house, the
court, the Empire or a House. The problem is that the line judged was never the line heard.

### 2 — the tripwire cannot see the shape of defect it was built for

`check-authoring-leaks.mjs` says its tripwire means *"a check that mutates its own evidence can
never again report a pass"*. That is false. The `before` fingerprint is taken inside `main()`:

| where the generator import sits | exit | evidence |
|---|---|---|
| inside `scanAuthoredSource()` — round 1's actual placement | **4**, tripwire fires | grep 1 → 0 |
| a static top-level `import` — the ordinary ESM form | **0, "PASS"** | grep 1 → **0** |
| top of `main()` | **0, "PASS"** | grep 1 → **0** |

HAZARDS §31 describes the defect as *"an unguarded **top-level** `fs.writeFileSync`"* — module
scope — and the guard written from §31 is blind to exactly that. Bounded: you must also strip
`RUN_DIRECTLY`, so the two primary repairs survive. What is falsified is the third, generic layer,
which is the one another subsystem would copy. **Fix: take the fingerprint at module scope.** One
line. §31's own closing sentence is the diagnosis — *tested in the direction they expect*.

## Job 3, settled: round 2 has the scope right

Step 7 says *"the whole **rumour** corpus"*, and step 3 defines a rumour entry as one under the
rumour topic — that is `rumours.json`. I reproduce **round 2 exactly and round 1 not at all**:
rumours.json 4 hits (1 "question"); whole dialogue corpus 215 (131). Round 1's 46/45 is reproducible
on none of seven surfaces I tried. Of the 4, **three are design-note keys** and the fourth is the
word *questions* in clean speech. **Zero player-facing violations.** I did **not** apply the filed
amendment — anchoring the regex narrows the instrument grading this work, and §1.3 permits only
additions.

## What is capping the score

Not the guards. **RI-UIX05 is 2 of 10 measured** (K1 reproduced, K4 newly passed from my capture)
and the item's own clause reads *"≤ 6 → loses outright (ceiling 4)"*. **RI-DLG03's greetings name a
settlement 0.3% of the time against a ≥ 70% requirement** — architectural, since `greetings.json`
has no settlement key at all, and recorded against the seam. And **both blind gates have never run.**

Round 1's RI-UIX05 = 5 was above that item's own ceiling. §2.4.1 forbids grading against prior
rounds, so this verdict scores the items: the 5 → 4 movement is a corrected anchor, not a
regression. On the one item where the rounds are comparable — RI-MTH07, the item round 1 failed
this piece on — it goes **6 → 7**.

## The reading screen, photographed

The round said a critic should open `the-sap-and-the-ledger`. I did. It is a real two-page spread
with a gutter, title, author line, `1–2 of 7` counter, no scrollbar, and a footer reading
**"Left and right turn the page. Back closes it. Nobody will summarise this for you."** — §C's R1
answered in the interface itself. `crate-tally` draws `1 of 1`. I also established that pagination
is **viewport-independent** (identical page vectors at 320×240 and 1280×720), which is what makes
the round's 320×240 K1 measurement legitimate against a bar written for 1920×1080.

One unresolved oddity: `getUIState().book.pages` says 6 for `the-sap-and-the-ledger` while the
screen draws `of 7`. `crate-tally` is correct, so it is not a uniform off-by-one. Flagged, not
scored.

## What I could not do

Both **blind gates** — `not_possible`, failed closed, **the orchestrator owes them**, and RI-DLG03's
is now a live blocker rather than bookkeeping: a fresh judge shown the five composed lines above
would settle the biggest gap in one question. **Seven of RI-UIX05's ten legs** unmeasured. **One of
the two RG-BWC NPCs** driven, not both. **No motion capture** — this piece ships no model, and a
page of text is a still by nature; I state that as a judgement, not an exemption. The census, since
it keeps drifting: `grep -rlE "^blind_pair: *yes" corpus/ --include=RI-*.md | wc -l` = **81**, of
`ls corpus/*/RI-*.md | wc -l` = **153**; `grep -rln "blind_status: *run" corpus/90-verdicts/` = **3**.
The loose command in rule 0e returns **111** today, because it counts ten doctrine files that merely
discuss the field.
