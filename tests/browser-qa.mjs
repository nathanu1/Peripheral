// Real-browser QA: headless Chromium, a fake camera built from licensed,
// hash-pinned Open Images fixtures, and the real pinned EfficientDet detector.
// Every network request is intercepted; only the pinned model assets are served
// (from a local, integrity-checked cache), and anything else fails the run.
//
// Usage: node tests/browser-qa.mjs [--scenario desk|desk43|centre|portrait] [--seconds 8] [--viewport 1024x640]
// Needs Playwright with Chromium (PLAYWRIGHT_BROWSERS_PATH) and network on the
// first run to fill .cache/browser-qa. Not part of `npm test`: it depends on a
// browser, graphics emulation and downloads. Screenshots stay in the ignored
// cache directory; they are QA artifacts, never committed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const cache = join(root, '.cache', 'browser-qa');
const out = join(cache, 'out');
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const html = readFileSync(join(root, 'index.html'), 'utf8');
const pin = (pattern, label) => { const m = html.match(pattern); if (!m) throw new Error('Pinned asset not found: ' + label); return m[1]; };
const MP_VERSION = pin(/@mediapipe\/tasks-vision@([0-9.]+)\/vision_bundle\.mjs/, 'tasks-vision');
const MODEL_URL = pin(/model:"(https:\/\/storage\.googleapis\.com\/mediapipe-models\/object_detector\/[^"]+)"/, 'detector');
const MODEL_SHA = pin(/efficientdet_lite0\.tflite",\s*sha256:"([0-9a-f]{64})"/, 'detector hash');

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  return require(join(globalRoot, 'playwright'));
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function download(url, path) { execFileSync('curl', ['-sSfL', '--max-time', '120', '-o', path, url]); }
function cached(name, url, expectedSha) {
  const path = join(cache, name);
  if (!existsSync(path)) download(url, path);
  if (expectedSha && sha256(readFileSync(path)) !== expectedSha) { rmSync(path); throw new Error('Integrity mismatch: ' + name); }
  return path;
}

// Pinned runtime from the npm registry (the same package jsDelivr mirrors),
// verified against the registry's published sha512 integrity.
function mediapipePackage() {
  const dir = join(cache, 'tasks-vision-' + MP_VERSION);
  if (existsSync(join(dir, 'package', 'vision_bundle.mjs'))) return join(dir, 'package');
  mkdirSync(dir, { recursive: true });
  const meta = JSON.parse(execFileSync('curl', ['-sSf', `https://registry.npmjs.org/@mediapipe/tasks-vision/${MP_VERSION}`], { encoding: 'utf8' }));
  const tarball = join(dir, 'package.tgz');
  download(meta.dist.tarball, tarball);
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(tarball)).digest('base64');
  if (integrity !== meta.dist.integrity) throw new Error('tasks-vision tarball integrity mismatch');
  execFileSync('tar', ['xzf', tarball, '-C', dir]);
  return join(dir, 'package');
}

const manifest = JSON.parse(readFileSync(join(root, '.github/peripheral/fixtures/stage-05-open-images.json'), 'utf8'));
const fixture = id => {
  const f = manifest.fixtures.find(item => item.id === id);
  return { ...f, path: cached(id + '.jpg', f.sourceUrl, f.sha256) };
};

// A desk-like composite: three real photographs cropped to their annotated
// objects, panning slowly so tracking and label stability are exercised.
const SCENES = {
  desk: { width: 1280, height: 720, frames: 90, items: [
    { id: '45d25f290b3eff63', x: 0.04, y: 0.18, h: 0.74 },   // chair
    { id: '50c0057044d205ff', x: 0.42, y: 0.10, h: 0.84 },   // bottle
    { id: '44221f31a243f493', x: 0.62, y: 0.22, h: 0.62 }    // cat
  ], panPx: 24 },
  desk43: { width: 640, height: 480, frames: 60, items: [
    { id: '45d25f290b3eff63', x: 0.02, y: 0.20, h: 0.70 },
    { id: '44221f31a243f493', x: 0.55, y: 0.24, h: 0.62 }
  ], panPx: 10 },
  portrait: { width: 720, height: 1280, frames: 60, items: [
    { id: '50c0057044d205ff', x: 0.08, y: 0.08, h: 0.40 },
    { id: '44221f31a243f493', x: 0.10, y: 0.55, h: 0.36 }
  ], panPx: 12 },
  centre: { width: 1280, height: 720, frames: 60, items: [
    { id: '44221f31a243f493', x: 0.38, y: 0.16, h: 0.72 },   // cat at the view centre
    { id: '45d25f290b3eff63', x: 0.70, y: 0.20, h: 0.70 }
  ], panPx: 8 },
  empty: { width: 1280, height: 720, frames: 30, items: [], panPx: 0 }
};

async function buildCamera(browser, name) {
  const scene = SCENES[name];
  const path = join(cache, `camera-${name}-v1.y4m`);
  if (existsSync(path)) return path;
  const page = await browser.newPage();
  const images = scene.items.map(item => {
    const f = fixture(item.id);
    return { ...item, box: f.expectedBox, data: 'data:image/jpeg;base64,' + readFileSync(f.path).toString('base64') };
  });
  const frames = await page.evaluate(async ({ scene, images }) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: scene.width, height: scene.height });
    const ctx = canvas.getContext('2d');
    const loaded = await Promise.all(images.map(item => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve({ ...item, img }); img.onerror = reject; img.src = item.data;
    })));
    const result = [];
    for (let i = 0; i < scene.frames; i++) {
      const g = ctx.createLinearGradient(0, 0, 0, scene.height);
      g.addColorStop(0, '#d9d4cb'); g.addColorStop(0.7, '#bfb6a8'); g.addColorStop(1, '#8a7b68');
      ctx.fillStyle = g; ctx.fillRect(0, 0, scene.width, scene.height);
      const dx = Math.sin(i / scene.frames * Math.PI * 2) * scene.panPx;
      for (const item of loaded) {
        const w = item.img.naturalWidth, h = item.img.naturalHeight;
        const pad = 0.06, b = item.box;
        const sx = Math.max(0, (b.xMin - pad) * w), sy = Math.max(0, (b.yMin - pad) * h);
        const sw = Math.min(w, (b.xMax + pad) * w) - sx, sh = Math.min(h, (b.yMax + pad) * h) - sy;
        const dh = item.h * scene.height, dw = dh * sw / sh;
        ctx.drawImage(item.img, sx, sy, sw, sh, item.x * scene.width + dx, item.y * scene.height, dw, dh);
      }
      // RGBA → I420 (BT.601 studio swing), the format Chromium's fake device reads.
      const rgba = ctx.getImageData(0, 0, scene.width, scene.height).data, w = scene.width, h = scene.height;
      const yuv = new Uint8Array(w * h * 3 / 2), uOffset = w * h, vOffset = uOffset + w * h / 4;
      for (let j = 0; j < h; j++) for (let x = 0; x < w; x++) {
        const p = (j * w + x) * 4, r = rgba[p], gr = rgba[p + 1], b = rgba[p + 2];
        yuv[j * w + x] = 16 + 0.257 * r + 0.504 * gr + 0.098 * b;
        if (!(x & 1) && !(j & 1)) {
          const c = (j / 2) * (w / 2) + x / 2;
          yuv[uOffset + c] = 128 - 0.148 * r - 0.291 * gr + 0.439 * b;
          yuv[vOffset + c] = 128 + 0.439 * r - 0.368 * gr - 0.071 * b;
        }
      }
      let binary = '';
      for (let k = 0; k < yuv.length; k += 0x8000) binary += String.fromCharCode(...yuv.subarray(k, k + 0x8000));
      result.push(btoa(binary));
    }
    return result;
  }, { scene, images });
  await page.close();
  const header = Buffer.from(`YUV4MPEG2 W${scene.width} H${scene.height} F30:1 Ip A1:1 C420jpeg\n`);
  writeFileSync(path, Buffer.concat([header, ...frames.flatMap(f => [Buffer.from('FRAME\n'), Buffer.from(f, 'base64')])]));
  return path;
}

function serve() {
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const path = new URL(req.url, 'http://qa.invalid').pathname;
      if (path !== '/' && path !== '/index.html') { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(readFileSync(join(root, 'index.html')));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Samples main-thread frame cadence for `ms` milliseconds, plus the camera
// frames the compositor actually presented when a visible <video> shows them.
const cadenceProbe = ms => new Promise(resolve => {
  const gaps = []; let last = performance.now(); const end = last + ms;
  const video = document.getElementById('camera-video');
  const presenting = video && video.srcObject && getComputedStyle(video).visibility === 'visible';
  const quality = () => presenting ? video.getVideoPlaybackQuality() : null, before = quality();
  const step = now => { gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(step); else {
    gaps.sort((a, b) => a - b); const after = quality();
    resolve({ frames: gaps.length, meanMs: gaps.reduce((s, g) => s + g, 0) / gaps.length,
      p95Ms: gaps[Math.floor(gaps.length * 0.95)], maxMs: gaps.at(-1), over50: gaps.filter(g => g > 50).length,
      presentedVideoFps: after ? (after.totalVideoFrames - before.totalVideoFrames - (after.droppedVideoFrames - before.droppedVideoFrames)) * 1000 / ms : null });
  } };
  requestAnimationFrame(step);
});

const log = message => console.error(`[qa ${new Date().toISOString().slice(11, 19)}] ${message}`);
async function run() {
  const { chromium } = loadPlaywright();
  const scenarioName = option('scenario', 'desk');
  const seconds = Number(option('seconds', '8'));
  // Software compositing cost here scales with stage area: at 1440x900 the detector
  // falls to ~2.5 Hz and identities churn. 1024x640 keeps behaviour checks meaningful;
  // pass --viewport for layout screenshots at other sizes.
  const viewport = option('viewport', '1024x640').split('x').map(Number);
  const pkg = mediapipePackage();
  const model = cached('efficientdet_lite0.tflite', MODEL_URL, MODEL_SHA);
  log('preparing fake camera');
  const builder = await chromium.launch();
  const camera = await buildCamera(builder, scenarioName);
  await builder.close();

  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${camera}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist'] });
  const result = { scenario: scenarioName, viewport: viewport.join('x'), seconds, mediapipe: MP_VERSION, steps: {} };
  const unexpected = [], served = [], consoleErrors = [];
  try {
    const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] },
      deviceScaleFactor: 1, permissions: ['camera'] });
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith(origin)) return route.continue();
      const mp = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/`;
      let file = null, type = 'application/octet-stream';
      if (url.startsWith(mp)) {
        file = join(pkg, url.slice(mp.length).split('?')[0]);
        type = file.endsWith('.mjs') || file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : type;
      } else if (url === MODEL_URL) file = model;
      if (file && existsSync(file)) { served.push(url); return route.fulfill({ status: 200, contentType: type, body: readFileSync(file),
        headers: { 'Access-Control-Allow-Origin': '*' } }); }
      unexpected.push(url); return route.abort();
    });
    const page = await context.newPage();
    // MediaPipe reports routine TFLite delegate setup on console.error as "INFO:".
    page.on('console', m => { if (m.type() === 'error' && !/^INFO: /.test(m.text())) consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push(String(e)));
    log('opening page');
    await page.goto(origin + '/');
    // Reveal timeline: every change of the revealed object or its warrant, with page time.
    await page.evaluate(() => {
      window.__qaReveals = []; let last = '';
      setInterval(() => {
        const card = document.getElementById('reveal-card');
        const key = card.hidden ? '' : card.dataset.warrant + ':' + document.getElementById('reveal-title').textContent;
        if (key !== last) { window.__qaReveals.push({ ms: Math.round(performance.now()), reveal: key || null }); last = key; }
      }, 100);
    });
    const shot = name => page.screenshot({ path: join(out, `${scenarioName}-${name}.png`) });
    await shot('00-start');
    const read = () => page.evaluate(() => {
      const t = id => document.getElementById(id)?.textContent ?? null;
      const labels = [...document.querySelectorAll('#scene-labels [data-entity]')].map(e => e.className + ':' + (e.textContent || e.dataset.entity));
      const card = document.getElementById('reveal-card');
      return { objectStatus: t('object-status'), objectRate: t('object-rate'), objectCpu: t('object-cpu'), fps: t('frame-fps'),
        paint: t('paint-ms'), work: t('work-ms'), summary: t('scene-summary'), message: t('scene-message'), labels,
        reveal: card && !card.hidden ? { title: t('reveal-title'), detail: t('reveal-detail'), warrant: card.dataset.warrant, reason: t('inspection-reason') } : null,
        mirrored: document.getElementById('wearer-view')?.dataset.mirrored, fit: document.getElementById('wearer-view')?.dataset.fit,
        cameraSize: (v => v ? `${v.videoWidth}x${v.videoHeight}` : null)(document.getElementById('camera-video')),
        boxes: [...document.querySelectorAll('#scene-labels > *')].map(e => [e.style.left, e.style.top, e.style.width, e.style.height].join(' ')) };
    });
    async function capture(step, waitMs) {
      log(`${step}: observing for ${waitMs} ms`);
      await page.waitForTimeout(waitMs);
      const cadence = await page.evaluate(cadenceProbe, 3000);
      result.steps[step] = { ...(await read()), cadence };
      await shot(step);
    }
    const detectorSettled = () => page.waitForFunction(() => /ready|unavailable|error/i.test(document.getElementById('object-status').textContent),
      null, { timeout: 60000 }).catch(() => log('detector did not settle within 60 s'));
    log('starting camera');
    await page.click('#welcome-start', { timeout: 10000 });
    await detectorSettled();
    await capture('01-mirror', seconds * 1000);
    // A dwell may already have revealed the centred object; summon a different, visible marker.
    // Query and click in one page task so a reveal cannot hide the marker in between.
    const summoned = await page.evaluate(() => {
      const button = document.querySelector('#scene-labels [data-entity][data-revealed="false"] button');
      button?.click(); return !!button;
    });
    if (summoned) await capture('01b-mirror-summon', 600);
    await page.click('[data-scene-mode="world"]', { timeout: 10000 });
    await detectorSettled();
    await capture('02-world', seconds * 1000);
    await page.click('[data-scene-mode="glasses"]', { timeout: 10000 });
    await capture('03-glasses', 1500);
    result.revealTimeline = await page.evaluate(() => window.__qaReveals);
  } finally { await browser.close(); server.close(); }
  result.network = { served: [...new Set(served)].length, unexpected };
  result.consoleErrors = consoleErrors;
  writeFileSync(join(out, `${scenarioName}-result.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = unexpected.length || consoleErrors.length ? 1 : 0;
}
// A hung browser must fail the run rather than stall it.
const deadline = setTimeout(() => { log('timed out after 240 s'); process.exit(2); }, 240000);
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(deadline));
