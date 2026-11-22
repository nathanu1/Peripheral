export const meta = {
  name: 'repair-until-green',
  description: 'Loop: run the full suite, fix the implementation for what failed, and repeat until it passes or a round makes no progress. Never edits tests',
}

// Usage inside Claude Code, from the repository root:
//   /repair-until-green
// This workflow edits index.html. It stops after 3 rounds, or as soon as a round fails to reduce the failures.
// It is for repairing a suite that should be green. It is not for a stage's deliberate red phase.

const MAX_ROUNDS = 3

const checkSchema = {
  type: 'object',
  required: ['passed', 'failedCount', 'failures'],
  properties: {
    passed: { type: 'boolean' },
    failedCount: { type: 'integer' },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['suite', 'message'],
        properties: {
          suite: { type: 'string' },
          message: { type: 'string' },
          expected: { type: 'string' },
          actual: { type: 'string' },
        },
      },
    },
  },
}

const runSuite = round =>
  agent(
    `In the Peripheral repository root, run \`npm test\` and report the outcome. The suite prints JSON evidence; ` +
      `a non-zero exit means failure. Report whether everything passed, the number of failed assertions across ` +
      `all three test files, and up to 10 failures with suite, message, expected and actual. ` +
      `Do not edit any file and do not try to fix anything.`,
    { label: `run suite (round ${round})`, schema: checkSchema },
  )

const history = []
let previousFailed = null

for (let round = 1; round <= MAX_ROUNDS; round += 1) {
  phase(`Round ${round}`)
  const check = await runSuite(round)
  if (!check) {
    return { status: 'stopped', reason: 'The agent running the suite stopped or failed.', history }
  }
  history.push({ round, failedCount: check.failedCount })
  if (check.passed) {
    return { status: 'green', rounds: round - 1, history }
  }
  if (previousFailed !== null && check.failedCount >= previousFailed) {
    return {
      status: 'no-progress',
      reason: `Round ${round - 1} did not reduce the failures (${previousFailed} before, ${check.failedCount} after). Stopping so a person can look.`,
      remaining: check.failures,
      history,
    }
  }
  previousFailed = check.failedCount
  log(`Round ${round}: ${check.failedCount} failing assertion(s)`)

  const fix = await agent(
    `The Peripheral suite is failing. Read .claude/lessons.md and .claude/CLAUDE.md first.\n` +
      `Failures:\n${JSON.stringify(check.failures, null, 2)}\n` +
      `Find the cause in index.html and fix the implementation. Rules:\n` +
      `- Do not edit, delete, skip or loosen any assertion, and do not edit anything under tests/ or ` +
      `.github/peripheral/. If a test itself is wrong, change nothing and explain why in your result.\n` +
      `- Keep the single-file structure and keep the core free of DOM, clock, network and random access.\n` +
      `- Fix the cause, not the symptom: no special cases that only satisfy the test input.\n` +
      `Run \`npm test\` once when you are done and say what you changed.`,
    {
      label: `fix (round ${round})`,
      schema: {
        type: 'object',
        required: ['changed', 'summary'],
        properties: {
          changed: { type: 'boolean' },
          summary: { type: 'string' },
          testLooksWrong: { type: 'string' },
        },
      },
    },
  )
  if (!fix) {
    return { status: 'stopped', reason: 'The fixing agent stopped or failed.', history }
  }
  history[history.length - 1].fix = fix.summary
  if (!fix.changed) {
    return {
      status: 'needs-a-person',
      reason: fix.testLooksWrong || fix.summary,
      remaining: check.failures,
      history,
    }
  }
}

phase('Final check')
const last = await runSuite('final')
if (last && last.passed) {
  return { status: 'green', rounds: MAX_ROUNDS, history }
}
return {
  status: 'still-failing',
  reason: `Still failing after ${MAX_ROUNDS} rounds.`,
  remaining: last ? last.failures : [],
  history,
}
