# Vendored Morrowind dialogue corpus

`morrowind-dialogue.csv.gz` — 69,876 dialogue rows extracted from `Morrowind.esm`
by the [Kezyma/Morrowind-Voices](https://github.com/Kezyma/Morrowind-Voices) project.
Columns: `Source, InfoId, Race, Gender, SpeakerId, FactionId, FactionRank, DialogueText`.

Vendored into the repo deliberately: it was previously read from a scratch clone that did
not survive a session reset, and several reference items depend on it for their measured
bars. Extraction is theirs; all arithmetic in this corpus is ours (`provenance:
community-data`).

- `dialogue-stats.json` — per-race line counts, words per line, words per sentence.
  Computed by `tools/` from the gz above; regenerate rather than hand-edit.
- `../../60-lore/data/argonian-dialogue-corpus.json` — all **3,888 Argonian-voiced lines**,
  the single most directly relevant reference we have: a game set in Argonia needs the
  Argonian register, and this is every word Bethesda wrote in it.

## Note on a discrepancy — RESOLVED wave 0 (corpus-audit)

`RI-DLG02` cites 17,298 distinct texts / 504,896 words. ~~Recomputing over this vendored
file gives **28,050 distinct texts / 1,869,218 words** across all rows.~~ The difference is
almost certainly scoping (unique-per-INFO vs per-row, and whether Tribunal/Bloodmoon and
generic service text are included). ~~The corpus audit must reconcile these and restate
RI-DLG02's targets against whichever scope it rules canonical — **the per-settlement word
targets depend on it.**~~

**Ruling.** The recomputation above **paired two different populations**: 28,050 is a count of
*distinct* response texts, while 1,869,218 is a *per-row* word sum over all 69,876 rows (a row
per speaker permutation). Mixing them implies 66.6 words per entry, which contradicts
RI-DLG02's independently measured ~24 median / 29.2 mean and would have inflated every
downstream target by ~2.7×. The correct figures, both taken over the same population:

| Scope | Distinct texts | Words | Words/entry |
|---|---:|---:|---:|
| **Canonical** — `Source ∈ {Morrowind, Tribunal, Bloodmoon}`, dedup on exact text | **27,875** | **682,372** | 24.5 |
| Full file, incl. the 4 bundled official plugins | 28,050 | 687,976 | 24.5 |
| Base `Morrowind.esm` only | 22,502 | 520,654 | 23.1 |
| ~~All rows, undeduplicated~~ (not a valid population) | 69,876 rows | 1,866,989 | — |

**Canonical scope is row 1**, because it is exactly the scope RI-DLG02's §A declares
(`Morrowind.esm + Tribunal.esm + Bloodmoon.esm`) and because it is reproducible in this repo
today. RI-DLG02 §A has been restated against it, its locality-ratio floor corrected from 0.35
to 0.28 (Morrowind's own Balmora scored 0.30 at the canonical scope and would have failed our
bar), and its per-settlement tier targets **deliberately left unchanged** — they derive from
Balmora's own measured 38,760 local words, which no scope change affects. Full reasoning:
`corpus/00-doctrine/CORPUS-COHERENCE-01.md` §3.

## Usable but unreachable

Wider UESP wiki dumps (`dumps.uesp.net`) and Google Drive are blocked by this
environment's egress policy (403 at the proxy CONNECT). Only GitHub-hosted sources are
reachable, which is how this dataset was obtained.
