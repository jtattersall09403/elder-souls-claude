/**
 * gpu-launch.mjs — launch the game for a capture, on whichever renderer the caller asked for,
 * and hand back an honest attestation of what actually drew the pixels.
 *
 * WHY THIS EXISTS. Every screenshot this project has taken has been SwiftShader. The GPU
 * transport (`tools/runpod/`) is proven — RTX A4500 and A5000, `ANGLE (NVIDIA, Vulkan 1.4.312)`,
 * artefacts back over ordinary HTTPS — but no capture tool pointed at it. This module is the
 * join: one function that the Deck, the motion runner and the vt-* tools all call, so "run this
 * capture on hardware" is a flag rather than a rewrite.
 *
 * THE DEFAULT IS LOCAL SOFTWARE, ON PURPOSE. A Pod costs money per minute and the RunPod proxy
 * needs 40–90 s before it routes; cheap local iteration is how builders actually work. Hardware
 * is opt-in: `--gpu hardware`, or `VT_HARDWARE_GPU=1` for the existing vt-* callers.
 *
 * THE CANDIDATE LADDER. `tools/runpod/worker/browser-config.mjs` already holds the ordered list
 * of Chromium GL backends that was measured on live hardware; the first entry
 * (`angle-vulkan-x11`) is the one that produced the first hardware frame. It is imported rather
 * than re-listed, so there is one ladder in the repo, not two. Each candidate is tried with a
 * throwaway browser and a blank canvas — if it does not report a real GPU it is discarded before
 * the game is ever loaded, which is what stops a silent llvmpipe fallback from becoming 288
 * mislabelled frames.
 */
import { launchGame, loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../../lib/browser.mjs';
import { commonArgs, launchCandidates } from '../../runpod/worker/browser-config.mjs';
import { attestPageRenderer, classifyRenderer, probeRendererString } from './renderer-class.mjs';

/**
 * Presentation flags that must hold on BOTH renderers or a hardware frame is not comparable
 * with a software one. The software-backend requests are dropped; everything about colour,
 * text rendering and compositor timing stays.
 */
export const SHARED_PRESENTATION_ARGS = DETERMINISTIC_CHROMIUM_ARGS.filter((arg) => (
  arg !== '--enable-unsafe-swiftshader' && arg !== '--use-angle=swiftshader' && arg !== '--use-gl=angle'
));

/** Flags a Pod needs that a laptop does not: the worker runs as root in a container. */
export const POD_CONTAINER_ARGS = ['--no-sandbox', '--disable-dev-shm-usage'];

export function hardwareArgsFor(candidate) {
  const seen = new Set();
  return [...SHARED_PRESENTATION_ARGS, ...POD_CONTAINER_ARGS, ...commonArgs, ...candidate.args, '--enable-gpu']
    .filter((arg) => (seen.has(arg) ? false : (seen.add(arg), true)));
}

/**
 * Resolve the capture mode from CLI args and environment. Default: software (local).
 * @param {Record<string, unknown>} args
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'hardware'|'software'}
 */
export function resolveGpuMode(args = {}, env = process.env) {
  const raw = args.gpu ?? (args.hardwareGpu || args['hardware-gpu'] ? 'hardware' : undefined);
  if (raw !== undefined) {
    const value = raw === true ? 'hardware' : String(raw).toLowerCase();
    if (['hardware', 'hw', 'gpu', 'native', '1', 'true'].includes(value)) return 'hardware';
    if (['software', 'sw', 'swiftshader', 'local', '0', 'false'].includes(value)) return 'software';
    throw new Error(`--gpu must be hardware or software, got '${raw}'`);
  }
  if (env.VT_HARDWARE_GPU === '1') return 'hardware';
  return 'software';
}

/**
 * Try each GL backend until one reports a real GPU. Nothing here loads the game: this is a
 * selection step over a blank canvas, so a bad backend costs two seconds and not a whole run.
 *
 * @returns {Promise<{ok: boolean, candidate: object|null, args: string[]|null, attempts: object[]}>}
 */
export async function selectHardwareBackend({ log = () => {} } = {}) {
  const { chromium } = await loadPlaywright();
  const attempts = [];
  for (const candidate of launchCandidates) {
    const args = hardwareArgsFor(candidate);
    let browser = null;
    try {
      browser = await chromium.launch({ headless: false, args });
      const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
      await page.setContent('<canvas id="probe" width="320" height="180"></canvas>');
      const rendererString = await probeRendererString(page);
      const verdict = classifyRenderer(rendererString, { hardwareRequested: true, source: `backend probe: ${candidate.name}` });
      attempts.push({ name: candidate.name, renderer_string: verdict.renderer_string, hardware: verdict.hardware, reason: verdict.reason });
      log(`gpu backend ${candidate.name}: ${verdict.class} — ${verdict.renderer_string}`);
      await browser.close();
      browser = null;
      if (verdict.hardware) return { ok: true, candidate, args, attempts };
    } catch (error) {
      attempts.push({ name: candidate.name, error: String(error && error.message || error).split('\n')[0].slice(0, 240), hardware: false });
      log(`gpu backend ${candidate.name}: launch failed — ${String(error && error.message || error).split('\n')[0]}`);
      if (browser) await browser.close().catch(() => {});
    }
  }
  return { ok: false, candidate: null, args: null, attempts };
}

/**
 * Launch the game for a capture run.
 *
 * @param {object} options
 * @param {'hardware'|'software'} options.mode
 * @param {boolean} [options.requireHardware] exit-worthy: refuse to capture on a fallback
 * @returns {Promise<{g: object, attestation: object, backend: object|null, attempts: object[]}>}
 */
export async function launchForCapture({
  mode = 'software',
  requireHardware = false,
  entry = 'game/index.html',
  width = 1280,
  height = 720,
  timeout,
  initScripts,
  log = console.log,
} = {}) {
  let backend = null;
  let attempts = [];
  let chromiumArgs;
  let effectiveMode = mode;

  if (mode === 'hardware') {
    const selection = await selectHardwareBackend({ log });
    attempts = selection.attempts;
    if (selection.ok) {
      backend = { name: selection.candidate.name, args: selection.args };
      chromiumArgs = selection.args;
    } else {
      // No backend reported a GPU. Say so, then either stop (requireHardware) or continue on
      // the software path with the label that fact deserves — never silently.
      const summary = attempts.map((a) => `${a.name}: ${a.error ? `launch failed (${a.error})` : a.renderer_string}`).join('; ');
      if (requireHardware) {
        const error = new Error(`no Chromium GL backend reported a hardware GPU, and --require-hardware was set. Tried ${attempts.length}: ${summary}`);
        error.code = 'NO_HARDWARE_GPU';
        throw error;
      }
      // Continue on the software path *properly*: the message says SwiftShader, so the launch has
      // to be a SwiftShader launch. Keeping hardwareGpu here would ask for a headed browser with
      // no X display and no --no-sandbox, and the run would die at Chromium instead of producing
      // honestly-labelled software frames — which is what a laptop with no GPU deserves to get.
      log(`gpu: hardware was requested and none was found; continuing on the software rasteriser, and the manifest will say SOFTWARE. Tried: ${summary}`);
      effectiveMode = 'software';
    }
  }

  const g = await launchGame({
    entry,
    width,
    height,
    timeout,
    initScripts,
    hardwareGpu: effectiveMode === 'hardware',
    ...(chromiumArgs ? { chromiumArgs } : {}),
  });

  // The authoritative reading: the page the frames actually come from, not the probe browser.
  const attestation = await attestPageRenderer(g.page, { hardwareRequested: mode === 'hardware' });
  attestation.backend = backend ? backend.name : null;
  attestation.backend_attempts = attempts;
  attestation.chromium_args = g.chromiumArgs;

  if (requireHardware && !attestation.hardware) {
    await g.close().catch(() => {});
    const error = new Error(`--require-hardware: the game page reports ${attestation.class} (${attestation.renderer_string}). ${attestation.reason}`);
    error.code = 'NOT_HARDWARE';
    throw error;
  }
  return { g, attestation, backend, attempts };
}
