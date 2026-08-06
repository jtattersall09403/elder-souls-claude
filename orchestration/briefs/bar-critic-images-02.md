# Brief: bar critic — re-review the reference-image prompt (v2)

You previously reviewed `docs/REFERENCE-IMAGE-REQUEST.md` (v1), returned **INSUFFICIENT**, and wrote 17 ranked changes into `corpus/00-doctrine/BAR-CRITIQUE-IMAGES-01.md` / `.json`. **Re-read your own critique first** so you judge against your own gate conditions.

The orchestrator rewrote the prompt applying your changes, and then added a **new §11 (substitution ladder)** after the user pointed out we have no access to any of these games and must be flexible about what is findable online. v2 is on disk.

## Judge
1. **Each of your 17 changes**: applied faithfully / partially / missing the point / not applied. Cite the section of v2. Substance over wording — but flag any softening that weakens enforcement.
2. **Your 14 gate conditions**: met / not met, one by one.
3. **New defects introduced by the rewrite**: internal contradictions, instructions that now conflict (§3 floors vs §5 slot counts vs §10 stop condition vs §11 substitution), things cut that shouldn't have been, slot IDs referenced in one section and absent in another, folder names disagreeing between §2 and §5, requirements now impossible to satisfy together.
4. **§11 specifically** — does the substitution ladder undermine the rigour of §3/§4/§7, or is it correctly scoped? It must not become a loophole through which re-encoded or modded images enter. If it does, tighten it.
5. **Feasibility.** Count the total ask: ~60 modern images across six folders, ~17 Morrowind slots at 3–5 each, 4–8 videos, anti-generic and context sets, a verification script, a manifest, a report. Is that achievable in one shot by one agent? If not, **rank the folders by what we keep if it can only do half**. An over-scoped prompt fails by producing a thin version of everything.
6. **Internal arithmetic**: do §3 floors, the §5a slot list (REF-M1..M20, deliberately no M8 — the harness generates the anti-reference) and §5e (REF-A1..A17) cohere? Does every slot map to a folder in §2? Any orphaned slot or unreachable folder?

## Output
`corpus/00-doctrine/BAR-CRITIQUE-IMAGES-02.md` and `.json`:
1. **VERDICT: SUFFICIENT / INSUFFICIENT** up front.
2. Change-by-change table: your 17 × applied? × evidence × verdict.
3. Gate conditions: all 14, met / not met.
4. New defects, ranked.
5. Feasibility ruling with explicit priority order for cutting.
6. Remaining required changes **with literal replacement text**. If none, say so plainly.

JSON: `{verdict, changes_applied:[{rank,status,evidence,note}], gates:[{condition,met}], new_defects:[...], feasibility:{achievable,priority_order:[],recommended_cuts:[]}, remaining_changes:[{rank,action,target,replacement_text,why}]}`

## Standard
You may return SUFFICIENT **if and only if it is genuinely true** — this is a real gate, the user is waiting, and the prompt runs once. Do not withhold approval to appear rigorous; do not grant it to be agreeable. Cosmetic defects → SUFFICIENT with optional polish listed. Anything that would materially damage the reference set → INSUFFICIENT with exact fixing text.

Do NOT edit `docs/REFERENCE-IMAGE-REQUEST.md`.
