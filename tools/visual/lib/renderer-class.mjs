/**
 * renderer-class.mjs — the one place that decides whether a frame is HARDWARE or SOFTWARE.
 *
 * It decides from THE RENDERER STRING THE BROWSER ACTUALLY REPORTED, and from nothing else.
 * Not from which code path was requested, not from which Chromium flags were passed, not from
 * whether a Pod was rented. Those are requests; this is the observation.
 *
 * The defect this file exists to prevent, in its own words from `tools/visual/deck.mjs`:
 *
 *   > The first version of this read window.__ENGINE.renderer.renderer.getContext(), which threw,
 *   > and the catch returned a string that did NOT match /swiftshader/ — so the manifest recorded
 *   > `software_renderer: false` on a SwiftShader run.
 *
 * A probe that fails open launders software pixels into an appearance claim. So:
 *
 *  1. **Fail closed.** Anything that is not a positive, recognisable hardware renderer is SOFTWARE.
 *     A probe that threw, an empty string, a null, a string naming no GPU vendor at all — all
 *     SOFTWARE, each with the reason recorded.
 *  2. **The request cannot vote.** `classifyRenderer` takes the string. `hardwareRequested` may be
 *     passed for the record, and it is *only* recorded; a swiftshader string with
 *     `hardwareRequested: true` classifies SOFTWARE and additionally reports `fellBack: true`,
 *     which is the condition `--require-hardware` fails on.
 *  3. **`mesa` counts as software here, deliberately.** Mesa is also the userspace stack for real
 *     AMD and Intel GPUs, so this is conservative rather than correct in general. On this project
 *     hardware always arrives as ANGLE/NVIDIA on a RunPod Pod, so a `mesa` string means the Pod
 *     fell back to llvmpipe — and calling real hardware "software" costs a caveat, while the
 *     reverse costs the whole evidence class. Revisit only when an AMD or Intel Pod is in scope.
 */

/** Positive evidence of a software rasteriser. Checked first, and it wins over everything. */
export const SOFTWARE_RENDERER_PATTERN = /swiftshader|llvmpipe|softpipe|software rasteriz|software render|mesa|microsoft basic render|generic renderer/i;

/** A probe that could not answer. Fails closed to software with `unknown: true`. */
export const UNAVAILABLE_PATTERN = /^\s*(unavailable|unknown|error|n\/a|none|null|undefined)\b/i;

/**
 * Positive evidence of a real GPU. Hardware requires a match here — naming no vendor at all is
 * not enough, because the historical failure produced exactly that: a string that matched no
 * software pattern and therefore passed.
 */
export const HARDWARE_VENDOR_PATTERN = /nvidia|geforce|quadro|\brtx\b|\bgtx\b|radeon|\bamd\b|\bintel\b|apple\s*m\d|adreno|\bmali\b|powervr/i;

export const EVIDENCE_CLASS_SOFTWARE = 'SOFTWARE — valid for geometry, layout, composition, determinism and census. NOT valid for antialiasing, bloom, AO, IBL or any appearance claim (W1-30-EVIDENCE §4).';
export const EVIDENCE_CLASS_HARDWARE = 'HARDWARE — valid for appearance claims.';

/**
 * Classify a renderer string.
 *
 * @param {unknown} rendererString the string the *browser* reported, verbatim
 * @param {{hardwareRequested?: boolean, source?: string}} [context] recorded, never consulted
 * @returns {{
 *   renderer_string: string, hardware: boolean, software_renderer: boolean, unknown: boolean,
 *   evidence_class: string, class: 'HARDWARE'|'SOFTWARE', reason: string,
 *   decided_from: 'renderer-string', hardware_requested: boolean, fell_back: boolean,
 *   renderer_source: string|null
 * }}
 */
export function classifyRenderer(rendererString, context = {}) {
  const hardwareRequested = context.hardwareRequested === true;
  const text = typeof rendererString === 'string' ? rendererString : (rendererString == null ? '' : String(rendererString));
  const trimmed = text.trim();

  let hardware = false;
  let unknown = false;
  let reason;

  if (!trimmed) {
    unknown = true;
    reason = 'no renderer string was reported at all — fails closed to software';
  } else if (UNAVAILABLE_PATTERN.test(trimmed)) {
    unknown = true;
    reason = `the renderer probe could not answer (${trimmed.slice(0, 120)}) — fails closed to software`;
  } else if (SOFTWARE_RENDERER_PATTERN.test(trimmed)) {
    reason = `the reported renderer names a software rasteriser: ${trimmed.slice(0, 160)}`;
  } else if (HARDWARE_VENDOR_PATTERN.test(trimmed)) {
    hardware = true;
    reason = `the reported renderer names a GPU vendor and no software rasteriser: ${trimmed.slice(0, 160)}`;
  } else {
    unknown = true;
    reason = `the reported renderer names no GPU vendor (${trimmed.slice(0, 120)}) — fails closed to software, because a string matching nothing is exactly what the 2026-08-14 fail-open defect produced`;
  }

  return {
    renderer_string: trimmed || String(rendererString ?? ''),
    hardware,
    software_renderer: !hardware,
    unknown,
    class: hardware ? 'HARDWARE' : 'SOFTWARE',
    evidence_class: hardware ? EVIDENCE_CLASS_HARDWARE : EVIDENCE_CLASS_SOFTWARE,
    reason,
    decided_from: 'renderer-string',
    hardware_requested: hardwareRequested,
    // The condition worth failing a paid GPU run on: we asked for hardware and did not get it.
    fell_back: hardwareRequested && !hardware,
    renderer_source: context.source || null,
  };
}

/**
 * The page-side probe, in one place so deck.mjs, the motion runner and the vt-* tools cannot
 * drift apart. Runs in the browser; every failure path returns a string that classifies SOFTWARE.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
export function probeRendererString(page) {
  return page.evaluate(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return 'unavailable: no webgl2 context';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch (e) { return `unavailable: ${e && e.message ? e.message : e}`; }
  }).catch((e) => `unavailable: probe threw outside the page: ${e && e.message ? e.message : e}`);
}

/**
 * Probe a live page and classify what came back.
 * @param {import('playwright').Page} page
 * @param {{hardwareRequested?: boolean}} [context]
 */
export async function attestPageRenderer(page, context = {}) {
  const rendererString = await probeRendererString(page);
  return classifyRenderer(rendererString, { ...context, source: 'live page WEBGL_debug_renderer_info' });
}

/**
 * The fields every manifest in the visual programme carries. Callers spread this into their
 * manifest so the shape is identical across tools and a reader can compare two runs.
 */
export function manifestRendererFields(attestation) {
  return {
    renderer_string: attestation.renderer_string,
    software_renderer: attestation.software_renderer,
    evidence_class: attestation.evidence_class,
    renderer_attestation: {
      class: attestation.class,
      decided_from: attestation.decided_from,
      reason: attestation.reason,
      unknown: attestation.unknown,
      hardware_requested: attestation.hardware_requested,
      fell_back: attestation.fell_back,
      source: attestation.renderer_source,
    },
  };
}

/** One line for a terminal, loud when the pixels are not what was asked for. */
export function rendererBanner(attestation) {
  if (attestation.fell_back) {
    return `renderer: ${attestation.renderer_string}\n  *** HARDWARE WAS REQUESTED AND NOT OBTAINED — these frames are SOFTWARE (${attestation.reason}) ***`;
  }
  if (attestation.hardware) return `renderer: ${attestation.renderer_string}   [HARDWARE — valid for appearance claims]`;
  return `renderer: ${attestation.renderer_string}\n  *** SOFTWARE — not valid for an appearance claim (W1-30-EVIDENCE §4) ***`;
}
