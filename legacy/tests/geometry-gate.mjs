// Stage 2 gate: inspect and execute the core independently of the HTML shell.
import { readFileSync, writeFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createHash } from 'node:crypto';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, actual: String(error) }); }
}
const start = html.indexOf('// CORE BEGIN:');
const end = html.indexOf('// CORE END');
const core = html.slice(start, end);
// Ignore ordinary strings and comments; retain template interpolations for inspection.
// This is a conservative source check, backed by standalone execution and source review.
function executableText(source) {
  return source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g, ' ');
}
function browserReferences(source) {
  return [...executableText(source).matchAll(/\b(document|window|globalThis|navigator|HTMLElement|HTMLCanvasElement|OffscreenCanvas|ImageData|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b/g)].map(match => match[0]);
}
check('Reference scan distinguishes text from executable browser identifiers', () => {
  if (browserReferences('const label = "Rolling diagnostic window"; // document').length) throw Error('Text false positive');
  if (browserReferences('window.location; document.body; fetch("/")').join() !== 'window,document,fetch') throw Error('Browser reference missed');
  if (browserReferences('`value ${window.location}`').join() !== 'window') throw Error('Template expression missed');
});
check('Core boundaries are explicit and present', () => {
  if (start < 0 || end <= start) throw new Error('Missing core boundary');
});
check('Core contains zero browser, DOM, network, or storage references', () => {
  const found = browserReferences(core);
  if (found.length) throw new Error(`Forbidden references: ${found.join(', ')}`);
});
check('Core contains no ambient time or random source', () => {
  if (/\b(Date|performance|setTimeout|setInterval|requestAnimationFrame)\b|Math\.random\s*\(/.test(executableText(core))) {
    throw new Error('Core depends on ambient time or randomness');
  }
});
check('Standalone core executes with frozen inputs and repeatable output', () => {
  const context = createContext({});
  new Script(`${core}\nconst geometry = Core.displayGeometry();
    const point = Object.freeze({ xDeg: -2.5, yDeg: 1.75 });
    const before = JSON.stringify({geometry, point});
    const first = Core.pointDegToPx(point, geometry);
    const second = Core.pointDegToPx(point, geometry);
    if (JSON.stringify(first) !== JSON.stringify(second)) throw Error('Nonrepeatable result');
    if (first === second) throw Error('Shared mutable output');
    first.xPx = 0;
    if (second.xPx === 0) throw Error('Outputs share state');
    if (JSON.stringify({geometry, point}) !== before) throw Error('Input mutation');
  `).runInContext(context, { timeout: 3000 });
});
const result = { runtime: process.version,
  sourceSha256: createHash('sha256').update(html).digest('hex'),
  passed: checks.filter(check => check.passed).length,
  failed: checks.filter(check => !check.passed).length, checks };
console.log(JSON.stringify(result, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
process.exitCode = result.failed ? 1 : 0;
