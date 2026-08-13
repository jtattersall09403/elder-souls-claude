#!/usr/bin/env node
// W1-19's authoritative plan names this command. The maintained implementation predates the
// plan under `topic-supply-audit.mjs`; import it so the named command and the existing consumer
// remain one instrument rather than drifting into parallel topic-supply models.
if (!process.argv.includes('--mainline')) process.argv.push('--mainline');
await import('./topic-supply-audit.mjs');
