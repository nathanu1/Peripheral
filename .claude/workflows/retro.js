export const meta = {
  name: 'retro',
  description: 'Self-improvement: mine recent stage reports, failures and history for lessons, verify each against its evidence, and append the survivors to .claude/lessons.md',
}

// Usage inside Claude Code, from the repository root:
//   /retro                              looks at the most recent work
//   Run /retro on stages 6 to 8         focuses on a range
//   Run /retro, dry run                 proposes lessons without writing them
// The only file this workflow may change is .claude/lessons.md, and only by appending.
// Review the change in `git diff` like any other edit; delete a lesson you disagree with.

const focus =
  typeof args === 'string' && args.trim()
    ? args.trim()
    : args && typeof args === 'object' && typeof args.focus === 'string'
      ? args.focus
      : 'the most recent stage and anything changed since it'
const dryRun =
  (typeof args === 'string' && /dry/i.test(args)) || Boolean(args && typeof args === 'object' && args.dryRun)

const MAX_PER_SOURCE = 2
const MAX_ACCEPTED = 3

const READ_ONLY = 'Read only. Do not edit, create, move or delete any file, and do not commit.'

const sources = [
  {
    id: 'reports',
    look:
      'the stage reports and red evidence files under .github/peripheral/reports/: every red phase that happened ' +
      'after the first one for a stage is a defect that got past the first set of tests',
  },
  {
    id: 'history',
    look:
      'the git history (`git log -15 --stat` and the diffs that matter): repairs, reverts, and fixes that follow ' +
      'a feature commit',
  },
  {
    id: 'blockers',
    look:
      'the blockers in .github/peripheral/state.json and the amendments in .github/peripheral/plan.md: what was ' +
      'blocked, why, and what resolved it',
  },
]

const candidateSchema = {
  type: 'object',
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['rule', 'whenItApplies', 'evidence'],
        properties: {
          rule: { type: 'string' },
          whenItApplies: { type: 'string' },
          evidence: { type: 'string' },
        },
      },
    },
  },
}

phase('Gather')
const gathered = await pipeline(sources, source =>
  agent(
    `You are looking for lessons in the Peripheral repository. Scope: ${focus}.\n` +
      `Read .claude/lessons.md so you do not repeat what is already there. Then study ${source.look}.\n` +
      `Propose at most ${MAX_PER_SOURCE} lessons. A lesson is a rule a future agent could follow that would ` +
      `have prevented a real problem you can point to. Each needs: the rule in one or two sentences, when it ` +
      `applies, and the evidence as a file path or commit hash plus what it shows. ` +
      `No general advice, nothing without evidence, nothing already in lessons.md. ` +
      `If you find nothing that qualifies, return an empty list. ${READ_ONLY}`,
    { label: `gather: ${source.id}`, schema: candidateSchema },
  ),
)

const candidates = gathered
  .filter(Boolean)
  .flatMap(g => (Array.isArray(g.candidates) ? g.candidates.slice(0, MAX_PER_SOURCE) : []))

if (gathered.filter(Boolean).length === 0) {
  return 'retro: none of the gathering agents finished, so nothing was reviewed. Nothing was changed.'
}
if (candidates.length === 0) {
  return 'retro: no new lessons found. Nothing was changed.'
}
log(`Checking ${candidates.length} candidate lesson(s)`)

phase('Filter')
const verdicts = await pipeline(candidates, candidate =>
  agent(
    `Someone proposes adding this lesson to .claude/lessons.md in the Peripheral repository:\n` +
      `${JSON.stringify(candidate, null, 2)}\n` +
      `Be hard to convince. Open the evidence it cites and check that it exists and shows what is claimed. ` +
      `Read .claude/lessons.md, .claude/CLAUDE.md and .github/peripheral/plan.md. Reject the lesson if the ` +
      `evidence is missing or does not support it, if an existing lesson or rule already covers it, if it ` +
      `conflicts with plan.md or brief.md, or if it is too vague to act on. Accept it only if a future agent ` +
      `following it would have avoided the problem in the evidence. ${READ_ONLY}`,
    {
      label: `check: ${String(candidate.rule).slice(0, 40)}`,
      schema: {
        type: 'object',
        required: ['accept', 'reason'],
        properties: {
          accept: { type: 'boolean' },
          reason: { type: 'string' },
          tightenedRule: { type: 'string' },
        },
      },
    },
  ),
)

const accepted = []
const rejected = []
candidates.forEach((candidate, i) => {
  const verdict = verdicts[i]
  if (verdict && verdict.accept && accepted.length < MAX_ACCEPTED) {
    accepted.push({ ...candidate, rule: verdict.tightenedRule || candidate.rule, checkedBecause: verdict.reason })
  } else {
    rejected.push({
      rule: candidate.rule,
      reason: verdict ? (verdict.accept ? 'Over the limit for one run.' : verdict.reason) : 'Its checker stopped or failed.',
    })
  }
})

if (accepted.length === 0) {
  return { status: 'nothing-accepted', changedFiles: [], rejected }
}
if (dryRun) {
  return { status: 'dry-run', changedFiles: [], proposed: accepted, rejected }
}

phase('Record')
const recorded = await agent(
  `Append lessons to .claude/lessons.md in the Peripheral repository. That is the only file you may change.\n` +
    `Lessons to add: ${JSON.stringify(accepted, null, 2)}\n` +
    `Steps:\n` +
    `1. Read the file. Number the new lessons after the highest existing "## L<number>." heading.\n` +
    `2. Insert each new lesson directly above the "# Scoreboard" heading, in the same format as the existing ` +
    `ones: a "## L<n>. <short title>" heading, then **Rule**, **When it applies** and **Evidence** paragraphs.\n` +
    `3. Add one row at the bottom of the Scoreboard table. Get the date by running \`git log -1 --format=%cs\`. ` +
    `Scope reviewed is "${focus}". Lessons added is ${accepted.length}. For the last two columns write "n/a" ` +
    `unless the output of a recent /audit-stage or /review-changes run is available in the repository.\n` +
    `4. Do not change or remove any existing lesson, and do not edit any other file. Do not commit.\n` +
    `Return the lesson numbers you added.`,
  {
    label: 'record lessons',
    schema: {
      type: 'object',
      required: ['added'],
      properties: { added: { type: 'array', items: { type: 'string' } } },
    },
  },
)

return {
  status: recorded ? 'recorded' : 'not-recorded',
  changedFiles: recorded ? ['.claude/lessons.md'] : [],
  added: recorded ? recorded.added : [],
  lessons: accepted,
  rejected,
  next: 'Review with `git diff .claude/lessons.md`, edit or delete anything you disagree with, then commit.',
}
