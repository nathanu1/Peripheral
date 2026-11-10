// Executes the exact inline application suite without a DOM, camera, or network.
import { readFileSync, writeFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createHash } from 'node:crypto';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
let result;
try {
  if (scripts.length !== 1 || (html.match(/<style\b/gi) || []).length !== 1) {
    throw new Error('Expected exactly one inline script and one inline style');
  }
  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) throw new Error('External application script');
  const context = createContext({});
  new Script(scripts[0][1], { filename: 'index.html:inline' }).runInContext(context, { timeout: 3000 });
  result = new Script('Peripheral.T.run()').runInContext(context, { timeout: 3000 });
} catch (error) {
  result = { passed: 0, failed: 1, results: [{ suite: 'Bootstrap', passed: false,
    message: 'Inline suite must execute without DOM or network', expected: 'runnable suite',
    actual: `${error.name}: ${error.message}` }] };
}
const evidence = { runtime: process.version, sourceSha256: createHash('sha256').update(html).digest('hex'), ...result };
console.log(JSON.stringify(evidence, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(evidence, null, 2) + '\n');
process.exitCode = result.failed ? 1 : 0;
