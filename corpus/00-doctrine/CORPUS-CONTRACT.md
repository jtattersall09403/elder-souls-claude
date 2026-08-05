# Corpus Contract — how every reference item must be written

The corpus **is the spec**. If it isn't in the corpus, it isn't a bar, and no critic may
invent one on the fly (they may only *extend* the corpus, per §5).

## 1. Directory layout

```
corpus/
  00-doctrine/     ARBITRATION.md, CORPUS-CONTRACT.md, INDEX.md
  10-combat/       Souls frame data, stamina, hitboxes, enemy behaviour, input traces
  20-progression/  Levelling curves, stats, bonfires, souls economy, gold economy
  30-quests/       Quest structure, faction escalation, betrayal patterns, non-combat resolution
  40-dialogue/     Topic graphs, journal entries, disposition, rumour distribution
  50-world/        Map, density, traversal time, settlement anatomy, strangeness
  60-lore/         Black Marsh/Argonian canon, book structure, unreliable narration
  70-visual/       Art direction (Morrowind) + fidelity (modern) — strictly separated
  80-methods/      Measurement harnesses: how a critic actually takes a number
  90-verdicts/     Critic verdicts, one file per (piece, wave)
```

## 2. Every reference item is one Markdown file

Filename: `RI-<AREA><NN>-<slug>.md` e.g. `RI-CMB03-roll-iframes.md`.
It MUST open with this YAML front-matter block:

```yaml
---
id: RI-CMB03
title: Roll i-frame and recovery windows
kind: number | structure | trace | image | text | graph   # pick exactly one
side: souls | morrowind | modern-fidelity | neutral
judges: [combat.dodge, combat.stamina]        # game subsystem paths this item judges
provenance: measured | derived | canonical-recall | constructed | community-data
confidence: high | medium | low
blind_pair: yes | no        # can a critic be shown ours vs theirs unlabeled?
---
```

Then these sections, in this order, all mandatory:

1. **`## The bar`** — one paragraph. What "good" is. Written so a builder can aim at it.
2. **`## The reference artifact`** — the actual thing. A table of numbers, an excerpt of
   structure, a trace log, an image path, a graph in Mermaid/DOT. Not a description of an
   artifact — the artifact.
3. **`## Comparison method`** — the exact procedure a critic runs. Must be executable by a
   fresh agent with no context: which tool, which command, what to capture, what to
   compute. If a script exists, name it in `corpus/80-methods/`.
4. **`## Scoring`** — how a number becomes a verdict. Define the scale AND the failure
   threshold. Must specify what "we lose" looks like.
5. **`## How we lose`** — the specific, concrete ways our implementation is likely to be
   worse. Written *pessimistically and in advance*, so a critic can check the list.
6. **`## Provenance note`** — where these values came from and how much to trust them.

## 3. Provenance honesty (non-negotiable)

Frame data and design numbers reconstructed from memory are labelled
`provenance: canonical-recall` and `confidence: medium` at best. Numbers we *define* for
this project because none exist upstream are `provenance: constructed` — and those are
just as binding, because a constructed bar we can measure beats a "real" number we can't.

**Never** present a recalled number as a measured one. A critic finding a mislabelled
provenance MUST fail the item and file a correction.

## 4. Traceability: every piece of the game maps to its judges

`corpus/00-doctrine/INDEX.md` holds the mapping table:

| Game subsystem path | Reference items that judge it | Critic agent | Method |
|---|---|---|---|

Every builder task names its subsystem path. Every critic is handed exactly the reference
items whose `judges:` list contains that path. A subsystem with zero judging items is a
**corpus hole** — the builder must not start until the hole is filled.

## 5. Extension rule

When a critic cannot judge something with the items it was given, it does not guess and
it does not skip. It writes a new reference item under the right area, following this
contract, adds it to INDEX.md, and records in its verdict that the corpus was extended.
Corpus growth is a success signal, not a failure.

## 6. Blind comparison

Wherever `blind_pair: yes`, the critic must produce the comparison unlabeled: two
screenshots side by side with no captions, two journal entries with no attribution, two
input traces with no headers. It picks a winner *before* learning which is which, and
records both the blind pick and the reveal. If the critic picks ours, that is a signal to
distrust the critic, and it must re-examine with a harsher lens.
