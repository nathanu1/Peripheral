// Stop hook: before Claude Code ends a turn, rerun the deterministic suite if the app or tests changed.
// Exit 0 lets the turn end. Exit 2 keeps the turn going and shows stderr to Claude.
// Runs with plain Node, no dependencies, on Windows, macOS and Linux.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_RETRIES = 2;
const WATCHED = ['index.html', 'tests', 'package.json'];

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { input = {}; }

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const session = String(input.session_id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '');
const counterPath = join(tmpdir(), `peripheral-verify-green-${session}.count`);
const readCount = () => { try { return Number(readFileSync(counterPath, 'utf8')) || 0; } catch { return 0; } };
const reset = () => { try { rmSync(counterPath, { force: true }); } catch { /* nothing to reset */ } };

// A blocked stage may end with failing tests on purpose. The final message must say so.
if (/^\s*BLOCKED:/m.test(String(input.last_assistant_message || ''))) { reset(); process.exit(0); }

// Skip the run when nothing the suite covers has changed. If git cannot answer, run the suite anyway.
const status = spawnSync('git', ['status', '--porcelain', '--', ...WATCHED], { cwd: root, encoding: 'utf8' });
if (status.status === 0 && status.stdout.trim() === '') { reset(); process.exit(0); }

// Run the same files as `npm test`, read from package.json so the two cannot drift apart.
let files = ['tests/run.mjs', 'tests/camera-companion.mjs', 'tests/geometry-gate.mjs'];
try {
  const script = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts.test;
  const parsed = script.split('&&').map(part => part.trim().match(/^node\s+(\S+)$/));
  if (parsed.length > 0 && parsed.every(Boolean)) files = parsed.map(match => match[1]);
} catch { /* keep the default list */ }

const failures = [];
for (const file of files) {
  if (!existsSync(join(root, file))) { failures.push(`${file}: file is missing`); continue; }
  const run = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 120000 });
  if (run.status === 0) continue;
  let detail = [];
  try {
    const evidence = JSON.parse(run.stdout);
    const list = evidence.results || evidence.checks || [];
    detail = list.filter(item => item && item.passed === false).slice(0, 8).map(item =>
      `  - ${[item.suite, item.name, item.message].filter(Boolean).join(': ')}` +
      (item.expected !== undefined ? ` (expected ${JSON.stringify(item.expected)}, actual ${JSON.stringify(item.actual)})` : ''));
  } catch { /* output was not JSON; fall back to its tail */ }
  if (detail.length === 0) detail = [`  ${String(run.stderr || run.stdout || run.error || 'no output').trim().split('\n').slice(-6).join('\n  ')}`];
  failures.push(`${file} failed:\n${detail.join('\n')}`);
}

if (failures.length === 0) { reset(); process.exit(0); }

const attempt = readCount() + 1;
if (attempt > MAX_RETRIES) {
  // Stop insisting, so a broken suite cannot hold the session in a loop.
  reset();
  process.stderr.write('verify-green: suite still failing after automatic retries; letting the turn end.\n');
  process.exit(0);
}
try { writeFileSync(counterPath, String(attempt)); } catch { /* without a counter the next run retries again */ }

process.stderr.write(
  `The Peripheral suite is failing, so this turn should not end yet (automatic retry ${attempt} of ${MAX_RETRIES}).\n` +
  `${failures.join('\n')}\n` +
  'Fix the implementation, not the assertions, then run `npm test`. ' +
  'If the failure is deliberate because a stage is blocked, start your final message with "BLOCKED:" and explain. ' +
  'If you cannot fix it, say so plainly instead of weakening a test.\n');
process.exit(2);
