export const meta = {
  name: 'audit-stage',
  description: 'Graph: pull the checkable claims out of a stage report, verify each one against the code and evidence with a separate skeptical agent, and return one ranked audit',
}

// Usage inside Claude Code, from the repository root:
//   /audit-stage                 audits the latest completed stage in state.json
//   Run /audit-stage on stage 6  audits one stage
// Every agent is read-only. Nothing in the repository is edited.

const requested =
  typeof args === 'number'
    ? args
    : typeof args === 'string' && /\d+/.test(args)
      ? Number(args.match(/\d+/)[0])
      : args && typeof args === 'object' && Number.isFinite(Number(args.stage))
        ? Number(args.stage)
        : null

const MAX_CLAIMS = 8

const READ_ONLY =
  'Read only. Do not edit, create, move or delete any file, and do not commit. ' +
  'You may run `npm test` and `node tests/run.mjs` to check counts.'
const CONTEXT =
  'This is the Peripheral repository. Read .claude/lessons.md first, then use .github/peripheral/brief.md ' +
  'and .github/peripheral/plan.md for what each stage and gate requires.'

phase('Extract claims')
const extracted = await agent(
  `${CONTEXT}\n` +
    (requested === null
      ? `Find the latest stage marked completed in .github/peripheral/state.json. `
      : `The stage to audit is Stage ${requested}. `) +
    `Read its report under .github/peripheral/reports/ (stage-NN.md) and the README status text about that stage. ` +
    `List the ${MAX_CLAIMS} claims that matter most and can be checked against the repository: test counts, ` +
    `evidence file contents, behaviours the code is said to have, pinned model revisions and hashes, tier labels, ` +
    `and the gate itself. Quote each claim closely and say where it is written. Include the stage's gate from ` +
    `the brief as one claim. If the report does not exist, return an empty list and say so in the note. ${READ_ONLY}`,
  {
    label: 'extract claims',
    schema: {
      type: 'object',
      required: ['stage', 'claims', 'note'],
      properties: {
        stage: { type: 'integer' },
        note: { type: 'string' },
        claims: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'claim', 'writtenIn', 'kind'],
            properties: {
              id: { type: 'string' },
              claim: { type: 'string' },
              writtenIn: { type: 'string' },
              kind: { type: 'string', enum: ['test-count', 'evidence', 'behaviour', 'model-pin', 'tier-label', 'gate', 'limitation'] },
            },
          },
        },
      },
    },
  },
)

const claims = extracted && Array.isArray(extracted.claims) ? extracted.claims.slice(0, MAX_CLAIMS) : []
if (claims.length === 0) {
  return `audit-stage: nothing to audit. ${extracted && extracted.note ? extracted.note : 'The claim extractor did not finish.'}`
}
const stage = extracted.stage
log(`Stage ${stage}: verifying ${claims.length} claim(s)`)

phase('Verify')
const verdicts = await pipeline(claims, claim =>
  agent(
    `${CONTEXT}\nYou are a skeptical reviewer who did not write Stage ${stage}. Its report makes this claim:\n` +
      `${JSON.stringify(claim, null, 2)}\n` +
      `Check it against index.html, the tests, and the evidence files under .github/peripheral/reports/. ` +
      `Try to show it is wrong or overstated. Use "supported" only when you found the code or evidence that ` +
      `backs it, "contradicted" when the repository shows otherwise, and "unverifiable" when it depends on ` +
      `something that cannot be checked from the repository, such as a live camera, a browser or a model ` +
      `download. A claim that something was verified, when the evidence shows it was only implemented or ` +
      `mocked, is contradicted. Name the file and line behind your verdict. ${READ_ONLY}`,
    {
      label: `verify ${claim.id}`,
      schema: {
        type: 'object',
        required: ['verdict', 'evidence', 'explanation'],
        properties: {
          verdict: { type: 'string', enum: ['supported', 'contradicted', 'unverifiable'] },
          evidence: { type: 'string' },
          explanation: { type: 'string' },
          whatWouldVerifyIt: { type: 'string' },
        },
      },
    },
  ),
)

const results = claims.map((claim, i) => ({
  ...claim,
  ...(verdicts[i] || { verdict: 'not-checked', evidence: '', explanation: 'The verifier for this claim stopped or failed.' }),
}))
const count = verdict => results.filter(r => r.verdict === verdict).length
const tally = {
  supported: count('supported'),
  contradicted: count('contradicted'),
  unverifiable: count('unverifiable'),
  notChecked: count('not-checked'),
}

phase('Report')
const report = await agent(
  `Write a short audit of Peripheral Stage ${stage} in Markdown from these results. Do not open any files.\n` +
    `Tally: ${JSON.stringify(tally)}\nResults: ${JSON.stringify(results)}\n` +
    `Start with the tally in one line. Then list contradicted claims first, each with where it is written, what ` +
    `the repository shows instead, and the evidence. Then unverifiable claims with what would verify each. ` +
    `Then supported claims in one line each. List not-checked claims separately as not checked. ` +
    `State only what is in the results above.`,
  { label: 'report' },
)

return report || { stage, tally, results }
