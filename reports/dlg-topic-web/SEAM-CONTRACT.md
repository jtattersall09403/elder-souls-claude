# Seam contract — W1-DLG-TOPIC-WEB to W1-UIX08-dialogue-window

**§2a rule 1 status: SENT AND FAILED, RECORDED, CONTINUED.** `SendMessage` to
`W1-UIX08-dialogue-window` returned *"No agent named 'W1-UIX08-dialogue-window' is reachable"* on
2026-08-14. The sibling is not addressable from this session. Rule 0 and §2a rule 1 both say the
message is the obligation and an acknowledgement is not, so the contract is written here where the
sibling (or its critic, or its successor) will find it, and this build continued without pausing.

**§2a rule 3 checked at build start and it does NOT fire.** The sibling's status file
(`orchestration/status/W1-UIX08-dialogue-window.json`, `state: built-probe-running`) lists
`files_touched` = its status file, `reports/uix08/**`, `game/src/ui/screens/dialogue.js`,
`game/src/ui/screens/dialogue-links.js`, `game/src/ui/surface.js`, `game/src/ui/system.js`,
`game/src/engine.js`, `game/src/render/ui.js`, `tools/analysis/ui-census.mjs`,
`tools/ui/dialogue-link-census.mjs`, `tools/ui/dialogue-window-probe.mjs`. **Nothing under
`game/data/dialogue/`, and its link census is under `tools/ui/`, not `tools/dialogue/`.** So no
overlap is conceded and the seam is live.

## The contract file

```
node tools/dialogue/build-graph.mjs --out <dir> --visibility
```

writes `<dir>/visibility.tsv`:

| column | meaning |
|---|---|
| `src_topic` | the topic whose answer is being read |
| `info_index` | which INFO of that topic, in authored order (`src_topic#N`, the same key `infos.tsv` uses) |
| `dst_topic` | the `to` destination this row is about |
| `label` | the destination's player-visible label — the authored `name` if it has one, else the de-slugged id. **This is what `topicLabel` returns**, so it is what the topic column will read |
| `matcher` | `strict`, `loose`, or `none` |
| `char_start`, `char_end` | character offsets into that INFO's `x` text. **These are the spans to mark.** `-1/-1` when `matcher` is `none` |
| `implied` | `1` when the author deliberately declared this unlock an implication (`implied` on the INFO), `0` otherwise |

- **This piece guarantees:** every `to` destination of a rendered answer has a resolvable
  player-visible label, and — subject to A1's exception budget — that label occurs literally in that
  answer's text at the stated span.
- **The window guarantees:** every such span is drawn in the `topic_link` role and nothing else is.
  That is `RI-UIX08` §C1's precision and recall, measured against this file.
- **Neither may satisfy its row by editing the other's files.**

## Two things that affect the window directly

1. **`topicLabel`'s signature is now `topicLabel(idOrRecord, topicIndex = null)`.** Every existing
   call site keeps working unchanged — `topicLabel('the-tally-of-the-dead')` still returns
   `the tally of the dead`. `engine.js:3573/3574/3580/3600` are **untouched by this piece** and
   still compile. To get the authored `name` in those rows, pass the topic index as the second
   argument; that is the window's call, not this piece's.
2. **`RI-UIX08` §G closes both pieces.** Plan §5a: if §G has not run at verdict time, `RI-UIX08`
   scores **2** and this piece's rows are reported `not_yet_judged`, never as a pass. The ablated
   arm §6 specifies: same build, same prose, link marking removed, every `to` destination granted
   the instant the answer is displayed. **Report recall, not precision** — with zero marked spans
   precision is `0/0` and reads as a pass under either guard.

## One correction from REF-A12c that bears on §C1's recall row

In the owner's frame, `Mages Guild` is blue and **`Fighters Guild` is bronze one line apart**, and
eleven personal names in the same paragraph are unlinked. A link means *"there is a topic behind
this word"*, not *"this word is important"*. Colouring proper nouns would reach recall 0.95 and
break the contract from the window's side. Full note:
`reports/dlg-topic-web/READING-NOTE-REF-A12c.md`.
