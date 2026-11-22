export const meta = {
  name: 'review-changes',
  description: 'Graph: review every file changed on this branch for correctness, one reviewer per file, then merge the findings into one ranked summary',
}

// Usage inside Claude Code, from the repository root:
//   /review-changes                    reviews uncommitted work plus commits not on main
//   Run /review-changes against dev    compares with another branch
// Every agent is told to read only. Nothing in the project is edited.

const base =
  typeof args === 'string' && args.trim()
    ? args.trim()
    : args && typeof args.base === 'string' && args.base.trim()
      ? args.base.trim()
      : 'main'

const MAX_FILES = 8

const READ_ONLY = 'Read only. Do not edit, create, move or delete any file, and do not commit or push.'

phase('Find changes')
const changed = await agent(
  `Find the source files changed in this git repository. Include uncommitted changes (staged and unstaged) ` +
    `and commits on the current branch that are not on "${base}". If "${base}" does not exist, try "master", ` +
    `and if neither exists use uncommitted changes only. Leave out deleted files, lock files, generated files, ` +
    `data files and binaries. Return at most ${MAX_FILES} paths relative to the repository root, largest change ` +
    `first, and say which comparison you used. If this is not a git repository, return an empty list and say so ` +
    `in the note. ${READ_ONLY}`,
  {
    label: 'find changes',
    schema: {
      type: 'object',
      required: ['files', 'note'],
      properties: {
        files: { type: 'array', items: { type: 'string' } },
        note: { type: 'string' },
      },
    },
  },
)

const files = changed && Array.isArray(changed.files) ? changed.files.slice(0, MAX_FILES) : []
if (files.length === 0) {
  return `review-changes: nothing to review. ${changed && changed.note ? changed.note : ''}`.trim()
}
log(`Reviewing ${files.length} changed file(s). ${changed.note}`)

phase('Review')
const reviews = await pipeline(files, file =>
  agent(
    `Review the changes to "${file}" (${changed.note}). Read .claude/lessons.md and .claude/CLAUDE.md first ` +
      `if they exist, and treat a broken project rule as an issue. Read the diff and enough of the ` +
      `surrounding code to judge it. Look for bugs, wrong edge-case handling, broken callers elsewhere in the ` +
      `project, missing error handling, and changes with no test covering them. Ignore style and formatting. ` +
      `Report at most 3 issues, most serious first, each tied to a line. If the change looks correct, ` +
      `return an empty list. ${READ_ONLY}`,
    {
      label: file,
      schema: {
        type: 'object',
        required: ['issues'],
        properties: {
          issues: {
            type: 'array',
            items: {
              type: 'object',
              required: ['file', 'line', 'severity', 'problem', 'fix'],
              properties: {
                file: { type: 'string' },
                line: { type: 'integer' },
                severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                problem: { type: 'string' },
                fix: { type: 'string' },
              },
            },
          },
        },
      },
    },
  ),
)

const notReviewed = files.filter((_, i) => !reviews[i])
const issues = reviews.filter(Boolean).flatMap(r => (Array.isArray(r.issues) ? r.issues : []))

if (issues.length === 0) {
  return (
    `review-changes: reviewed ${files.length - notReviewed.length} file(s) and found no correctness issues.` +
    (notReviewed.length ? `\nNot reviewed (agent stopped or failed): ${notReviewed.join(', ')}` : '')
  )
}

phase('Summarize')
const summary = await agent(
  `Merge these per-file review results into one Markdown summary. Do not open any files.\n` +
    `Issues: ${JSON.stringify(issues)}\n` +
    `Files reviewed: ${JSON.stringify(files)}\n` +
    `Files whose review did not finish: ${JSON.stringify(notReviewed)}\n` +
    `Remove duplicates, rank high to low, and for each issue give file and line, the problem and the fix. ` +
    `End with the files that had no issues, and list any unfinished reviews as not reviewed. ` +
    `State only what is in the results above.`,
  { label: 'summary' },
)

return summary || { issues, notReviewed, files }
