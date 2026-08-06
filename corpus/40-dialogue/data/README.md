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

## Note on a discrepancy

`RI-DLG02` cites 17,298 distinct texts / 504,896 words. Recomputing over this vendored
file gives **28,050 distinct texts / 1,869,218 words** across all rows. The difference is
almost certainly scoping (unique-per-INFO vs per-row, and whether Tribunal/Bloodmoon and
generic service text are included). The corpus audit must reconcile these and restate
RI-DLG02's targets against whichever scope it rules canonical — **the per-settlement word
targets depend on it.**

## Usable but unreachable

Wider UESP wiki dumps (`dumps.uesp.net`) and Google Drive are blocked by this
environment's egress policy (403 at the proxy CONNECT). Only GitHub-hosted sources are
reachable, which is how this dataset was obtained.
