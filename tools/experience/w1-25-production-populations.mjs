#!/usr/bin/env node
/**
 * W1-25 evidence entry point.
 *
 * The previous implementation constructed expected targets, counters and hashes in JavaScript and
 * labelled them observed. That is not an experiment. This command is deliberately fail-closed until
 * a browser producer supplies trace-backed arms; it never manufactures production evidence.
 */
import fs from 'node:fs';
const args=process.argv.slice(2);
const input=args[args.indexOf('--from-live-trace')+1];
if (!args.includes('--from-live-trace') || !input || !fs.existsSync(input)) {
  console.error('RED: --from-live-trace TRACE.json is required; expected values are not observations');
  process.exit(2);
}
let trace;
try { trace=JSON.parse(fs.readFileSync(input,'utf8')); }
catch { console.error('RED: live trace is not valid JSON'); process.exit(1); }
const bad=!trace.browser_session_id || trace.ran!==true || !Array.isArray(trace.arms) ||
 trace.arms.some(a=>!a.observed || !a.trace_sha256 || !a.source_sha256 || !a.target_sha256 ||
   !Number.isInteger(a.frame_start) || !Number.isInteger(a.frame_end) || a.frame_end<=a.frame_start);
if (bad) {
  console.error('RED: trace lacks browser identity, frame bounds, observed arms, or SHA provenance');
  process.exit(1);
}
console.error('RED: live trace is well-formed, but no production evidence compiler is implemented; refusing to infer outcomes');
process.exit(1);
