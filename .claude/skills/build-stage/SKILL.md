---
name: build-stage
description: Build the next incomplete Peripheral stage end to end, test-first, following the project's plan and brief. Use when asked to continue the build, do the next stage, or run a build stage.
---

# Build one stage

This is the project's build loop. It runs exactly one numbered stage and then stops. Do not start the following stage in the same run.

## 1. Orient

1. Read `.claude/lessons.md` and apply every lesson that matches this stage.
2. Read `.github/peripheral/state.json`, `.github/peripheral/plan.md` and the stage's row in `.github/peripheral/brief.md`.
3. Pick the earliest incomplete stage. Confirm the previous checkpoint against the real code: run `npm test` and compare with the recorded counts. Repair a stale `state.json` before going on.
4. If the stage's gate needs a real model, camera or browser, check now that this environment can run it. If it cannot, tell Nathan before writing code, and plan to leave the stage incomplete unless he approves an amended gate.

## 2. Red

Delegate to the `test-author` agent. It writes `registerStageNTests`, registers it, and saves `.github/peripheral/reports/stage-NN-red.json`. Check that the new assertions fail because the behaviour is missing.

## 3. Green

Delegate to the `stage-builder` agent with the red evidence. Repeat until `npm test` passes in full. If a later defect appears, write its failing test first and save that red evidence too. Save the green run with `node tests/run.mjs .github/peripheral/reports/stage-NN-green.json`.

## 4. Gate

Delegate to the `gate-verifier` agent. It did not build the stage, so it checks it. If its verdict is `not met`, go back to step 2 or 3. If it is `met in software only`, the stage is not complete.

## 5. Record

Write `.github/peripheral/reports/stage-NN.md` with the brief's eight fields: Stage, Tests, Implementation, Test results, Perception tiers touched, Gate, Commit, Next. Save the exact diff as `stage-NN.patch`. State what was not verified.

Update `state.json` in the same commit. Mark the stage `completed` and advance `nextStage` only if every test passes and the gate is met. Otherwise keep it incomplete and add a blocker with the exact reason.

Commit with the message the brief gives for the stage, authored as described in `.claude/CLAUDE.md`.

## 6. Stop

Report the stage in the brief's output format and stop. If you are ending with tests failing because the stage is blocked, start your final message with `BLOCKED:`.

Afterwards, suggest `/audit-stage` for an independent check of the report and `/retro` to record what this run taught.
