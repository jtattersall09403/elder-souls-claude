#!/usr/bin/env node
// A forwarding shim, because agents keep writing `tools/boot-check.mjs` and the real file is
// `tools/harness/boot-check.mjs`. That mistake is worse than it looks: node prints
// MODULE_NOT_FOUND to stderr, and in the common one-liner `node tools/boot-check.mjs 2>&1 | tail
// -1 ; echo exit=$?` the exit code reported is the PIPE's, which is 0. So a boot check that never
// ran reads as a boot check that passed, and every measurement behind it is void.
//
// One agent lost time to exactly that today. The cheapest fix is for the wrong path to be right.
import('./harness/boot-check.mjs');
