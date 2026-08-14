# Status — verdict-evidence recovery (task `verdict-evidence-20260814`)

Closing the rigour hole `reports/ci-triage/TRIAGE-20260814.md` found: most Wave-1 verdicts cite
evidence that is not in the repository, so nobody but the machine that produced them can check them.

Branch: `codex/wave1-build-experiment`.

## The number that matters

Fresh-checkout FAIL count, measured by extracting `git archive HEAD` into a clean tree and running
`node tools/verdict-validate.mjs --all` there (a real checkout, not this populated working tree).

| | FAIL | OK |
|---|---|---|
| before (HEAD `ebc8745`+) | **54** | 22 |
| after | *(filled in at the end)* | |

## Progress

- [x] Fresh-checkout baseline measured: 54 FAIL / 22 OK of 76.
- [x] Missing-citation census: 234 distinct cited paths absent from `git ls-files`; 208 on disk, 26 gone.
- [x] Size distribution measured; threshold set at 1 MiB (see report).
- [ ] Piece-by-piece review and commit.
- [ ] Pin artefacts for the >1 MiB files.
- [ ] The genuinely-missing citations ruled on.
- [ ] Superseded-round skip built + tests.
- [ ] The 8 real corpus defects.
- [ ] Policy change landed in schema / builder contract / critic brief template.

Full write-up: `reports/ci-triage/EVIDENCE-RECOVERY-20260814.md`.
