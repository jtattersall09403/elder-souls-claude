# Brief: verify the Souls combat corpus against real community data

## Why this task exists

The entire Souls half of this corpus was written under a network restriction that blocked almost
every source. Its numbers are therefore `provenance: canonical-recall, confidence: medium` —
recalled from knowledge of the games, honestly labelled, but **unverified**. The Morrowind half
has since been upgraded against a real UESP dump and a real dialogue extraction, and the gap in
rigour between the two halves is now the corpus's biggest asymmetry.

**Outbound internet is now unrestricted.** Verified reachable: the Fextralife wikis
(`darksouls.wiki.fextralife.com`, `darksouls3.wiki.fextralife.com`, `eldenring.wiki.fextralife.com`),
Wikimedia, Steam, YouTube, GitHub, Reddit, and general `curl`. `WebSearch`/`WebFetch` load via
`ToolSearch` with `select:WebSearch,WebFetch`.

Your job is to check what can be checked, and to say plainly what cannot.

## What to verify

Read these first — they are what you are auditing. Note each one's `## Provenance note`, which
states what its author knew was unverified:

- `corpus/10-combat/RI-CMB01` roll i-frames and equip load · `RI-CMB02` attack frame data ·
  `RI-CMB03` stamina economy · `RI-CMB04` hitboxes · `RI-CMB05` poise, stagger, criticals ·
  `RI-CMB06` lock-on and directional roll · `RI-CMB08` healing/flask
- `corpus/10-combat/RI-AI01..07` enemy behaviour, telegraphs, punish windows, boss design
- `corpus/12-weapons/RI-WPN01..06` moveset slots, class differentiation, contextual attacks
- `corpus/15-camera/RI-CAM01..07` the third-person rig and lock-on framing
- `corpus/20-progression/RI-PRG01` the soul cost curve, `RI-PRG07` equip load

Priority order — verify the load-bearing numbers first:

1. **Roll i-frames by equip load.** DS1's 30%/70% breakpoints and its i-frame counts; DS3's
   fat/medium/light rolls; Elden Ring's. Our corpus picked one canonical model — check the model
   it picked actually matches the game it claims.
2. **Equip-load breakpoints** and what each tier does to roll distance and recovery.
3. **Attack frame data** for the weapon classes we ship: startup, active, recovery, and whether
   the "committed, uncancellable" property holds as we state it.
4. **Stamina**: regen rate, regen delay after spend, cost per action class, block cost as a
   function of stability, sprint drain, guard-break on empty.
5. **Poise and hyperarmour**: how poise actually works in each game (it differs sharply between
   DS1, DS3 and Elden Ring — our corpus may have blended them), stagger thresholds, hyperarmour
   windows on heavy attacks.
6. **Backstab/riposte/parry windows** in frames.
7. **Estus**: charges, drink animation frames, heal curve, bonfire refill.
8. **Soul cost curve**: the real DS1 and DS3 level-cost formulas, against `RI-PRG01`'s cubic.
9. **Lock-on**: range, switch behaviour, and — the one the camera corpus already flagged — whether
   the camera auto-rotates behind a moving player (it does in DS3/ER; an earlier brief of mine
   said otherwise and was corrected).

## Method

- Prefer sources with actual frame data over prose: Fextralife weapon and mechanic pages,
  community frame-data spreadsheets, the DS3 and Elden Ring datamining threads, `soulsplanner`,
  `mugenmonkey`, GitHub repos holding extracted game params (search for them — extracted
  `EquipParamWeapon` / `AtkParam` tables exist publicly and are the best possible source).
- **Games differ.** Do not merge DS1, DS2, DS3, Bloodborne, Sekiro and Elden Ring into one
  number. Record per-game values, then state which our corpus should adopt and why. Where our
  corpus has blended games without saying so, that is a finding.
- Frame rates differ too — DS1 was 30fps on release with a 30fps physics tie; DS3 and ER are 60.
  An i-frame count is meaningless without its framerate. Check ours states one.

## Deliverables

1. **`corpus/10-combat/data/souls-frame-data.json`** — the verified dataset, structured
   per-game, per-mechanic, each value carrying `{value, unit, game, source_url, confidence,
   notes}`. This becomes the corpus's citable Souls reference and later builders read it directly.
2. **`corpus/00-doctrine/PROVENANCE-UPGRADE-02-SOULS.md`** — the report. For every checked figure:
   the item id, the figure it claims, its stated provenance, **what the real source says**, and
   `confirmed` / `needs-amendment` / `contradicted` / `unverifiable`. Where an item is wrong,
   propose the exact amendment text. **Do NOT edit other agents' reference items** — the
   orchestrator applies amendments. List everything you could not verify and why.

## Rules

- Cite a URL for every figure you upgrade. `community-data` requires a source; without one it
  stays `canonical-recall`.
- **Never silently "fix" a number to match a source.** Report the discrepancy and let the
  orchestrator or the item's owner decide — some of our values are deliberate constructions that
  diverge from Souls for good reasons, and those should stay divergent with the divergence
  recorded, not be quietly reverted.
- A contradiction you find between two of our own items is as valuable as an external correction.
- Follow `orchestration/AGENT-PROTOCOL.md`: status file first, write incrementally, bank findings
  immediately.

## The finding that would matter most

If our combat corpus has quietly blended mechanics from different Souls games into a single model
that no actual game implements, say so loudly. That is the failure mode most likely to make our
combat feel "Souls-ish but wrong" while passing every internal check we have.
