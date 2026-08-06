# Agent durability protocol

**Every agent dispatched in this project MUST follow this. It is not optional.**

Agents in this environment are killed without warning when the session hits its usage limit.
Several have already died after doing 20+ minutes of good research and writing **nothing**, losing
all of it. The rule that prevents this is simple:

> **Write early, write often, write incrementally. Never hold work in your head.**

## The three rules

### 1. Checkpoint before you research

Your **first action** — before any reading, searching or thinking — is to create your status file:

```
orchestration/status/<your-task-id>.json
```

```json
{
  "task_id": "weapons",
  "brief": "orchestration/briefs/weapons.md",
  "started": "wave-0",
  "state": "researching",
  "outputs_expected": ["corpus/12-weapons/RI-WPN01-...md", "..."],
  "outputs_written": [],
  "findings": [],
  "next_step": "read RI-CMB02 for frame conventions",
  "notes_for_successor": ""
}
```

### 2. Write each deliverable as soon as it is ready

Do **not** research everything and then write everything. Finish one reference item, write it to
disk, append its path to `outputs_written`, update `next_step`, move on. A half-finished corpus
area is worth enormously more than a perfect one that was never saved.

If a deliverable is large, write it in sections and keep appending. A partial file with a
`<!-- WIP: sections 4-6 outstanding -->` marker at the bottom is a good outcome.

### 3. Bank findings the moment you have them

Anything you discover that a successor would otherwise have to rediscover — a measured number, a
usable data source, a contradiction between two corpus items, a dead end you ruled out — goes
into `findings` in your status file **immediately**. Research is the expensive part; never lose it.

Use `notes_for_successor` for anything that would let a fresh agent pick up mid-task: what you
had decided, what you were about to do, what you'd try differently.

## On resume

If your status file already exists when you start, **you are a successor**. Read it, read your
brief, read whatever outputs already exist on disk, and **continue from `next_step`**. Do not
restart. Do not rewrite finished deliverables — extend and finish the unfinished ones.

## Finishing

When every expected output exists, set `"state": "complete"` and summarise in your reply. If you
finish early or find the brief impossible, set `"state": "blocked"` with the reason — a blocked
task honestly reported is a result; a silent failure is not.

## Why this matters more than it looks

The corpus is the project's memory. An agent that dies with unwritten work costs the project the
whole session's budget for that area, and the next agent starts from zero. An agent that dies
having written four of six items and a good status file costs almost nothing — its successor
finishes in a fraction of the time.
