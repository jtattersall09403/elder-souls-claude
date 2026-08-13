#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serveDir } from '../../lib/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const ARTIFACT_DIR = path.resolve(process.env.RUNPOD_ARTIFACT_DIR || path.join(REPO_ROOT, 'reports/runpod-gpu/smoke'));
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const commonArgs = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--enable-zero-copy',
  '--disable-software-rasterizer',
  '--force-color-profile=srgb',
];
const launchCandidates = [
  { name: 'angle-vulkan', args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface'] },
  { name: 'angle-gl-egl', args: ['--use-gl=angle', '--use-angle=gl-egl'] },
  { name: 'angle-gl', args: ['--use-gl=angle', '--use-angle=gl'] },
  { name: 'native-default', args: [] },
];
const softwareRenderer = /swiftshader|llvmpipe|software raster|softpipe/i;
const attempts = [];
let browser = null;
let selected = null;
let selectedGl = null;

async function inspectRenderer(instance) {
  const page = await instance.newPage({ viewport: { width: 640, height: 360 } });
  try {
    await page.setContent('<canvas id="gpu" width="640" height="360"></canvas>');
    return await page.evaluate(() => {
      const canvas = document.querySelector('#gpu');
      const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
      if (!gl) return null;
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      gl.clearColor(0.08, 0.3, 0.22, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        version: gl.getParameter(gl.VERSION),
        vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      };
    });
  } finally {
    await page.close();
  }
}

for (const candidate of launchCandidates) {
  let instance;
  try {
    instance = await chromium.launch({ headless: false, args: [...commonArgs, ...candidate.args] });
    const gl = await inspectRenderer(instance);
    const hardware = Boolean(gl && !softwareRenderer.test(`${gl.vendor} ${gl.renderer}`) && /nvidia/i.test(`${gl.vendor} ${gl.renderer}`));
    attempts.push({ name: candidate.name, args: candidate.args, gl, hardware });
    if (hardware) {
      browser = instance;
      selected = candidate;
      selectedGl = gl;
      break;
    }
    await instance.close();
  } catch (error) {
    attempts.push({ name: candidate.name, args: candidate.args, error: error.message, hardware: false });
    if (instance) await instance.close().catch(() => {});
  }
}

const baseReport = {
  schema: 'elder-souls/runpod-gpu-smoke@1',
  at: new Date().toISOString(),
  runId: process.env.RUNPOD_GPU_RUN_ID || null,
  sourceRevision: process.env.RUNPOD_SOURCE_REVISION || null,
  node: process.version,
  display: process.env.DISPLAY || null,
  nvidiaSmi: null,
  attempts,
  selected: selected?.name || null,
  webgl: selectedGl,
  game: null,
  artifacts: [],
  passed: false,
};
try {
  baseReport.nvidiaSmi = execFileSync('nvidia-smi', [
    '--query-gpu=name,uuid,driver_version,memory.total,utilization.gpu',
    '--format=csv,noheader,nounits',
  ], { encoding: 'utf8' }).trim();
} catch (error) {
  baseReport.nvidiaSmi = `ERROR: ${error.message}`;
}

const reportPath = path.join(ARTIFACT_DIR, 'gpu-smoke.json');
if (!browser) {
  fs.writeFileSync(reportPath, `${JSON.stringify(baseReport, null, 2)}\n`);
  throw new Error(`Chromium did not expose an NVIDIA WebGL renderer; attempts written to ${reportPath}`);
}

const server = await serveDir(REPO_ROOT);
let context;
try {
  const videoDir = path.join(ARTIFACT_DIR, 'video');
  fs.mkdirSync(videoDir, { recursive: true });
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'UTC',
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack }));
  await page.addInitScript(() => {
    window.__HARNESS_EXPECTED = true;
    window.__HARNESS_ENV = { headless: false, fixedStepHz: 60, hardwareGpu: true };
  });
  const url = `${server.origin}/game/index.html`;
  const started = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction(() => Boolean(window.__HARNESS?.version), null, { timeout: 120_000 });
  if (await page.evaluate(() => typeof window.__HARNESS.ready === 'function')) {
    await page.evaluate(() => Promise.race([
      window.__HARNESS.ready(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('game ready() timed out')), 120_000)),
    ]));
  }
  const gameGl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return null;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      version: gl.getParameter(gl.VERSION),
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  });
  if (!gameGl || softwareRenderer.test(`${gameGl.vendor} ${gameGl.renderer}`) || !/nvidia/i.test(`${gameGl.vendor} ${gameGl.renderer}`)) {
    throw new Error(`game page renderer is not NVIDIA hardware: ${JSON.stringify(gameGl)}`);
  }
  const screenshot = path.join(ARTIFACT_DIR, 'game-smoke.png');
  await page.screenshot({ path: screenshot, type: 'png', timeout: 120_000 });
  await page.waitForTimeout(1_000);
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'browser-console.json'), `${JSON.stringify({ consoleMessages, pageErrors }, null, 2)}\n`);
  baseReport.game = {
    url,
    readyMs: Date.now() - started,
    harnessVersion: await page.evaluate(() => window.__HARNESS.version),
    renderer: gameGl,
    pageErrors,
  };
  baseReport.artifacts.push('game-smoke.png', 'browser-console.json');
  baseReport.passed = pageErrors.length === 0;
  await context.close();
  context = null;
  const videos = fs.readdirSync(videoDir).filter((name) => name.endsWith('.webm')).map((name) => `video/${name}`);
  baseReport.artifacts.push(...videos);
  fs.writeFileSync(reportPath, `${JSON.stringify(baseReport, null, 2)}\n`);
  console.log(JSON.stringify({ passed: baseReport.passed, renderer: gameGl.renderer, artifacts: baseReport.artifacts }));
  if (!baseReport.passed) process.exitCode = 1;
} catch (error) {
  baseReport.error = { name: error.name, message: error.message, stack: error.stack };
  fs.writeFileSync(reportPath, `${JSON.stringify(baseReport, null, 2)}\n`);
  throw error;
} finally {
  if (context) await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
