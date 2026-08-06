# CORPUS-COHERENCE-01 — the audit of the corpus itself

> **Author:** `corpus-audit`, wave 0, the only agent authorised to edit other agents'
> reference items. **Scope:** shared-constant integrity, front-matter validity, orphaned
> `judges:` paths, cross-item contradictions, the wrong-bar amendments (BAR-CRITIQUE-01
> W1–W8) and the item-level intent drifts (INTENT-AUDIT-01).
>
> Closes BAR-CRITIQUE-01 **G7** — *"nobody audits the corpus; it has the exact incoherence
> it exists to prevent in the game."*

This document is the **ledger**. Every edit made to another agent's file is recorded here
with the file, the line, the before, the after, and the reasoning. Edits **not** made are
recorded too, with why. Nothing in this file is deleted; corrections are appended.

Companion machine-readable artifact: `corpus/00-doctrine/constants.json` — the shared-constant
registry (one owner per constant, every consumer listed).

---

## 0. Standing rules this audit applied

1. **Smallest edit that resolves the contradiction.** Where a number had to move, the
   *physical* quantity was preserved and only its *label* or *unit* changed.
2. **Never delete an item's reasoning.** Superseded text is struck through or annotated
   in place, never removed. Amendment blocks are appended.
3. **A deliberate divergence is kept, and recorded as one.** Where an item's number differs
   from a reference on purpose, the divergence stays and gains an explicit note saying so,
   so a later reader does not "fix" it.
4. **Rule, don't record-both.** Where two items genuinely disagree, one is made
   authoritative and the other cites it.
5. Every amendment carries the marker `AMENDED wave 0 (corpus-audit)` so it is greppable.

---

<!-- WIP: sections filled in as the sweep proceeds -->
