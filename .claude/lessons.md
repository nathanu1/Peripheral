# Lessons

Rules this project learned from its own history. Every agent reads this file before working. `/retro` adds entries; people can edit or remove them in review. Each lesson names the evidence it came from, so a lesson with no evidence should be deleted, not trusted.

Format: one lesson per heading, with **Rule**, **When it applies** and **Evidence**.

## L1. Check that a model can actually run before promising its gate

**Rule:** Before starting a stage whose gate needs a real model, confirm the runtime can create its context and reach the model host. If it cannot, say so at the start and keep the stage incomplete; do not mark the gate passed from mocked output.

**When it applies:** Any stage with a real-model or real-camera gate (5, 7, 8, 10, 15).

**Evidence:** Stage 3 blocker in `.github/peripheral/state.json` (the agent runtime could not verify live behaviour; Nathan verified it locally). README status: the cloud test browser could not create the WebGL context the models need. On 2026-11-21 a cloud session could reach npm and PyPI but not huggingface.co or cdn.jsdelivr.net, so Depth Anything could not be downloaded there.

## L2. A changed acceptance method needs Nathan's written approval

**Rule:** If a gate cannot be met as written, propose an amendment and wait. Record the approval, the date and the new thresholds in `plan.md` before relying on it. Fix selections and thresholds before running inference.

**When it applies:** Any time a gate looks unreachable in the current environment.

**Evidence:** "Stage 5 acceptance amendment — approved 2026-09-13" in `.github/peripheral/plan.md`; Stage 5 blocker in `state.json`.

## L3. Prerecorded and synthetic results never carry a live tier

**Rule:** Evaluation images and synthetic scenes use evaluation or synthetic provenance and an empty perception tier. Tier 1 is only for current computation on current live world-camera frames.

**When it applies:** Writing tests, fixtures, reports or README status for any perception stage.

**Evidence:** Stage 5 amendment in `plan.md`; `registerStage7Tests` asserts that synthetic appearance never gains a live tier.

## L4. Reconcile `state.json` against `main` at the start of a run

**Rule:** Verify the previous checkpoint against the real code, tests and commits before trusting `state.json`. Fix stale blockers in the same commit as the next stage.

**When it applies:** The start of every build run.

**Evidence:** Stage 7 report: "Reconciled the obsolete Stage 5 blocker in state.json against its already-completed main checkpoint."

## L5. A delayed result must not overwrite newer state

**Rule:** Every asynchronous result (detection, embedding, depth, interpretation) is checked against the current session, source, anchor and freshness window when it is applied, not when it was requested. Stale results are dropped.

**When it applies:** Any worker or model adapter.

**Evidence:** Stage 7 freshness repair (`stage-07-freshness-red.json`), and the stale-result assertions in `registerStage7Tests`.

# Scoreboard

`/retro` appends one row per run. Falling numbers in the last two columns mean the system is improving.

| Date | Scope reviewed | Lessons added | Claims contradicted in last audit | Issues found in last review |
| --- | --- | --- | --- | --- |
