# The agent system

This folder sets up Claude Code to build Peripheral the way `plan.md` asks: one stage at a time, tests first, with an independent check before anything is called done, and a record of what each run taught. Open the repository in Claude Code and everything here loads on its own.

It needs a recent Claude Code with dynamic workflows turned on (`/config`, Dynamic workflows). Nothing here changes how `index.html` runs.

## The four layers

**1. Agents** (`agents/`). Three specialists, each with its own context so one cannot grade its own work.

- `test-author` writes the failing assertions and saves red evidence.
- `stage-builder` implements until the suite is green, without touching what the tests assert.
- `gate-verifier` is read-only and checks the gate and the report against the evidence.

**2. Loops** (`skills/`, `hooks/`, `workflows/`). Work repeats until a check passes.

- `/build-stage` runs the next incomplete stage: orient, red, green, gate, record, stop.
- A Stop hook (`hooks/verify-green.mjs`) reruns the suite whenever a turn ends with changes to `index.html`, `tests/` or `package.json`. If it fails, Claude is sent back to fix it, at most twice.
- `/repair-until-green` fixes a broken suite in rounds and stops when a round makes no progress.

**3. Graphs** (`workflows/`). A script fans work out to parallel agents and has a second agent check each result.

- `/audit-stage` pulls the claims out of a stage report and verifies each one against the code.
- `/review-changes` reviews every changed file on a branch and merges the findings.

**4. Self-improvement** (`workflows/retro.js`, `lessons.md`). `/retro` looks for lessons in recent reports, history and blockers, has a skeptic check each against its evidence, and appends the survivors to `lessons.md`. Every agent reads that file first, so the next run starts with what the last one learned. It only ever appends to that one file, and the change goes through `git diff` and review like any other.

## A normal session

```text
/build-stage          build the next stage, then stop
/audit-stage          independent check of that stage's report
/review-changes       review the branch before merging
/retro                record what the run taught
```

Watch any workflow with `/workflows`. Start with `/audit-stage` on a finished stage to see a graph run without changing anything.

## Limits

- Workflows use more tokens than a normal session. These are sized small: `/audit-stage` and `/retro` run about ten agents each.
- The workflow scripts were checked against mock agents, not yet run inside Claude Code. Treat the first run of each as its real test, and fix the script if it misbehaves.
- A real-model gate still needs a machine that can download and run the model. The system will report such a stage as incomplete; it will not pass it from mocked output.
- CI (`.github/workflows/test.yml`) runs the same suite on every push and pull request.
