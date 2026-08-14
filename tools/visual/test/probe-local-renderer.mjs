#!/usr/bin/env node
/**
 * probe-local-renderer.mjs — launch a browser on THIS box and print the renderer string it
 * reports, as JSON, on one line.
 *
 * It exists as a separate process on purpose. `tools/lib/browser.mjs` fails by calling `die()`,
 * which calls `process.exit` — so a missing Playwright, a full disk or an absent browser binary
 * would take the whole self-test suite down with it instead of reddening the one arm that needs a
 * browser. A child process cannot do that to its parent: it exits, the parent reads the exit code,
 * and the arm goes red with the reason.
 *
 *   node tools/visual/test/probe-local-renderer.mjs
 *   → {"ok":true,"renderer_string":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device …"}
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

try {
  const { launchGame } = await import(path.join(REPO, 'tools/lib/browser.mjs'));
  const { probeRendererString } = await import(path.join(REPO, 'tools/visual/lib/renderer-class.mjs'));
  const handle = await launchGame({
    entry: path.join(REPO, 'tools/harness/stub/index.html'),
    width: 320,
    height: 200,
    timeout: 60_000,
  });
  try {
    const rendererString = await probeRendererString(handle.page);
    process.stdout.write(`${JSON.stringify({ ok: true, renderer_string: rendererString })}\n`);
  } finally {
    await handle.close().catch(() => {});
  }
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: String(error && error.message || error).split('\n')[0] })}\n`);
  process.exitCode = 1;
}
