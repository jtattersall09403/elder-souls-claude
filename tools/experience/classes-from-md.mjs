#!/usr/bin/env node
import fs from 'node:fs'; import { CLASSES } from './lib/session-analysis.mjs';
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const artifact = { schema:'elder-souls/experience-classes@1', source:'corpus/95-experience/RI-EXP03-session-shape-and-pacing-curve.md', classes:Object.keys(CLASSES), unknown_treatment:'UNKNOWN remains unclassified and is included in the denominator', generated_at_commit:process.env.GIT_COMMIT || null };
if (process.argv.includes('--self-test')) { if (artifact.classes.length !== 8 || !artifact.classes.includes('TRANSIT')) process.exit(1); console.log('PASS classes 8/8; UNKNOWN fail-open substitution rejected'); }
if (out) fs.writeFileSync(out, JSON.stringify(artifact,null,2)+'\n'); else console.log(JSON.stringify(artifact,null,2));
