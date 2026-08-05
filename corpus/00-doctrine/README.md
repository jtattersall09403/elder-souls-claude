# `corpus/00-doctrine/` — how judging works

Read in this order. The first two are **frozen**: they are amended only by the dimension
owner, and everything else is subordinate to them.

| File | What it is | Who must read it |
|---|---|---|
| `ARBITRATION.md` | **FROZEN.** The supreme law: inside the fight Souls wins, everywhere else Morrowind wins. Seam rulings S1–S15. AR-1/AR-2. The visual bifurcation. | Everyone |
| `CORPUS-CONTRACT.md` | **FROZEN.** How every reference item is written: front-matter, the six mandatory sections, provenance honesty, traceability, the extension rule, blind comparison. | Everyone |
| `CRITIC-DOCTRINE.md` | The critic charter. Mandate, the ban on judging from source, evidence requirements, the anti-softness protocol, AR-1/AR-2 detection procedures, the bifurcation check, escalation, conflict of interest. | Critics, orchestrator |
| `SCORING.md` | The 0–10 calibration ladder with anchored bands and worked examples for four dimensions, the anti-inflation audit, and the **gap ledger** rules. | Critics, builders, orchestrator |
| `VERDICT-SCHEMA.md` + `verdict.schema.json` | The machine-readable verdict format, the PASS/FAIL/VOID decision procedure, and the aggregation contract a progress page may rely on. | Critics, aggregators |
| `CRITIC-PROMPT-TEMPLATE.md` | Copy-paste prompt skeleton for spawning a critic. Self-contained. | Orchestrator |
| `BUILDER-PROMPT-TEMPLATE.md` | Copy-paste prompt skeleton for spawning a builder — hands over the judging reference items **up front**. | Orchestrator |
| `COHERENCE-AGENT.md` | The end-of-wave whole-game agent: traversal, checklist, evidence, what it may change, and its remit boundary (coherence, never quality). | Coherence agent, orchestrator |
| `INDEX.md` | **GENERATED.** subsystem path → judging reference items → critic → method, plus corpus holes. Regenerate every wave. | Everyone |
| `subsystems.json` | The canonical subsystem path taxonomy + the legacy-path alias map. Source of truth for `judges:` values and builder task paths. Append-only. | Reference-item authors, orchestrator |
| `examples/verdict.example.json` | A complete, validator-clean verdict to copy the shape from. | Critics |

## Tools

```bash
node tools/corpus-index.mjs              # regenerate INDEX.md from subsystems.json + RI front-matter
node tools/corpus-index.mjs --check      # CI: fail if INDEX.md is stale
node tools/corpus-index.mjs --strict     # CI: fail if there are holes or invalid front-matter
node tools/gap-ledger.mjs                # regenerate corpus/90-verdicts/GAP-LEDGER.{json,md} from verdicts
node tools/verdict-validate.mjs <file>   # validate one verdict (also --all)
```

`cd tools && npm run doctrine` runs all three.

## The loop, in one picture

```
INDEX.md  ──(reference items for the path)──►  BUILDER  ──(output)──►  CRITIC
   ▲                                              ▲                       │
   │                                              │                       ▼
subsystems.json                            GAP-LEDGER.json  ◄──── verdict JSON
   ▲                                              │                       │
   └──── corpus extension (a critic that          └── open gaps become    │
         could not judge writes a new RI)             next wave's work    │
                                                                          ▼
                                    end of wave: COHERENCE AGENT plays the whole game
                                    and fixes coherence only (COHERENCE-AGENT.md)
```

## The five rules that are easiest to break

1. **Judge output, not source.** A config value is not a measurement.
2. **No artifacts, no verdict.** Every claim cites a file that exists.
3. **A critic that finds no gap has failed.** Exactly one gap, with a buildable remedy.
4. **Declare the visual axis before citing anything.** Fidelity is judged against modern
   references; art direction against Morrowind. Crossing the line voids the verdict.
5. **A gap is closed by a later critic, never by whoever built the fix.**
