# Text excerpts — W1-DIALOGUE-AUTHORING-LEAK, critic pass

Every quotation below was read from the file at the path and line given, at commit `43d26e6e`
plus the four sibling-owned working-tree files listed in the verdict's `build` block.
CRITIC-DOCTRINE §1.1 permits quoting written content that *is* the artifact; that is the only
purpose these serve.

---

## 1. The defect, and its exact extent

Pre-fix authored source (`git show 43d26e6e^:tools/dialogue/gen-greetings.mjs`, `STANCE['RG-BWC'].cold`):

```
cold: ['Contract business only.', "The Company is not recruiting today.", 'Take it to the factor.', 'Say it in one line.', "We are working."]
```

Post-fix, `tools/dialogue/gen-greetings.mjs:203`:

```
cold: ['Contract business only.', "The Company is not recruiting today.", 'Take it to the factor.', 'The writ says nothing about talk.', "We are working."]
```

Shipped expansion, pre-fix, `game/data/dialogue/greetings.json` `.pools[180..184].lines[3]` — five
lines, one per `player_race_class`, reproduced by my own sweep against the pre-fix file
(`logs/rendered-surface-sweep-PREFIX.txt`). Post-fix the same five slots carry the replacement
(`logs/greeting-coupling-and-null-controls.txt`).

**Extent: 1 authored fragment → 5 shipped lines.** Independently re-derived; matches the builder.

## 2. `Local. Useful.` — the withdrawal is correct

`tools/dialogue/gen-greetings.mjs:106`, inside the `ADDRESS` table, `'RG-BWC'` block beginning at
line 105 — the five race fragments a Blackwood Company speaker uses:

```
saxhleel: 'Local. Useful.',
naga: 'That is not a local. Keep clear of it.',
dunmer: "Contract or coin. Either's fine.",
imperial: 'You can read a contract. Sit down.',
'other-foreign': 'You look like you can carry things.',
```

All five size the player up as labour or as a contracting party. `Local. Useful.` is the same
sentence in the same register as its four siblings — a mercenary pricing an Argonian native's
local knowledge — and it matches no writer-instruction shape under any of my 17 patterns.
The 25 shipped occurrences are `5 disposition bands × 5 lines`, the designed combinatorics.
**The withdrawal of the "25" as a defect is correct. No true finding was withdrawn.**

## 3. The replacement line does not earn its faction

The builder's stated rationale is that `writ` is the Blackwood Company's established motif, citing
`game/data/npcs/mainline.json:1077`:

```
"greeting": "Our writ is out of Leyawiin and it says nothing about the Stone Wastes. You're welcome to read it from where you're standing."
```

That line exists and the citation is accurate. But note what makes it Company-specific: **`Our`
writ**, and **out of Leyawiin** — a possessive and a provenance. The replacement keeps the
sentence frame and drops both.

Measured (`scripts/ar2-lint-and-coverage.mjs` sibling run, reported in the verdict): of the **30**
lines in `greetings.json` containing `writ`, **25 belong to `RG-LEDGER`** and **5 are the new
`RG-BWC` line**. `RG-LEDGER`'s own `ADDRESS` fragment, `tools/dialogue/gen-greetings.mjs:89`:

```
'other-foreign': 'Name, and what the writ says under it.',
```

The word is the clerk group's, 5:1, and the new line is its only intruder in the corpus.

Transplant test — the replacement dropped into three other groups' `cold` bands, unaltered:

| Group | That group's own `cold` band (gen-greetings.mjs) | Does `The writ says nothing about talk.` read natively? |
|---|---|---|
| `RG-LEDGER` (:176) | `Documents, or nothing.` · `I do not answer questions. I answer forms.` | Yes — it would be the *best* line in the band |
| `RG-COURT` (:217) | `State your petition.` · `Documents to the steward.` | Yes |
| `RG-EMPIRE` (:183) | `That is provincial business. Take it to the provincial office.` | Yes |

By contrast, three of `RG-BWC`'s other four cold lines name a Company-proper referent —
**Contract**, **the Company**, **the factor** (`blackwood-company-factor` is a real NPC id).
The replaced slot names a province-wide noun instead.

**Judgement:** the line is in-world, in register, and not filler — the brief's guard (*a speaker
with nothing to say is not an improvement*) holds. But it could belong to at least three of the
twelve reaction groups, and belongs to one of them better than to this one. It is a correct fix
and mediocre writing.

## 4. AR-2, and a bar defect found in passing

`RI-DLG03` step 7 mandates a diegetic lint whose regex is quoted in the item as:

```
(?i)\b(quest|objective|marker|waypoint|your (map|journal|compass)|coordinates?|[0-9]+ ?(m|metres|meters|yards)\b|head (north|south|east|west) [0-9])
```

Run verbatim over 1,857 greeting and rumour lines it returns **46 hits**, an automatic fail. All
46 are artefacts: `\b(quest|` anchors only the start of the word, so it matches every occurrence of
**question**. Word-anchored, the same corpus returns **5**, all one line:

`game/data/dialogue/greetings.json` `.pools[220..224].lines[3]`:

```
"Take the marker. It floats when nothing else does."
```

An `RG-VAKH` river-guide handing the player a physical float. That is a diegetic object, not a
HUD waypoint — it is precisely the Morrowind way of marking a route. **Read and cleared; AR-2 passes.**
None of the 46 or the 5 is in the five lines this piece changed.

The unanchored regex is a pre-existing defect in `RI-DLG03`, not in this piece, and it is recorded
in the verdict's `corpus_extended` as a `method_gap`.

## 5. The books restored — sample of the drawn text

Entity-side observable is `wrap(m.book.text, ...)` at `game/src/ui/screens/text.js:240`, the exact
call `drawBook` makes. Full run in `logs/book-coupling-perturbation.txt`.

| Book id | Pre-fix drawn lines | Post-fix drawn lines | Post-fix first drawn line |
|---|---:|---:|---|
| `the-sap-and-the-ledger` | 1 × `"undefined"` | 98 | `Being an Attempt at an Honest Accounting of the Argonian` |
| `crate-tally` | 1 × `"undefined"` | 14 | `First count, in a clerk's hand: eleven crates landed, eleven` |
| `inscription-third-terrace` | 1 × `"undefined"` | 14 | `HERE THE WATER WAS TOLD TO STOP AND IT STOPPED` |
| `shore-compass` | 1 × `"undefined"` | 13 | `Open the lid flat. Let the needle stop before you read it; it will` |
| `the-egg-speaks-twice` | 1 × `"undefined"` | 88 | `A word first. I was asked for these in Tamrielic and I have` |

`the-sap-and-the-ledger` measures **4,783** characters, matching the builder's figure exactly.
