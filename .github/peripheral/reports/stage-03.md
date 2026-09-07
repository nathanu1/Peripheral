# Stage 3 — GazeSource + head gaze

Status: completed. The stage-specific head-motion gate is accepted from Nathan's live validation in the build conversation. Agent synthetic checks and user live observations remain separate.

## Tests — assertions written first

The [complete development record](stage-03-development.md) preserves all original tests-first stages and full failures. The additional developer-gauge suite was written and run before its implementation:
```js
function registerGaugeTests(T) {
  T.suite("Gaze: developer gauge",()=>{
    T.eq(Core.gazeGauge({available:false}),null,"lost tracking hides the gauge");
    T.eq(Core.gazeGauge({available:true,directionDeg:{xDeg:NaN,yDeg:0}}),null,"invalid direction cannot display a gauge");
    const value=Core.gazeGauge({available:true,directionDeg:{xDeg:-22.2,yDeg:-4}});
    T.eq(value.yaw,-22.2,"gauge preserves measured yaw");
    T.eq(value.pitch,-4,"gauge preserves measured pitch");
    T.eq(value.clipped,false,"in-range direction is not clipped");
    T.eq(Core.gazeGauge({available:true,directionDeg:{xDeg:90,yDeg:-60}}).yaw,45,"gauge clips only its display extent");
    T.eq(Core.gazeGauge({available:true,directionDeg:{xDeg:90,yDeg:-60}}).clipped,true,"off-scale direction is labeled");
  });
}

```

## Implementation — precise diff

[Complete Stage 3 diff](stage-03-candidate.patch) against main at `03d96b0d422478ac8f629a97be0be393bccec5ce`. This checkpoint applies the previously preserved implementation to `index.html`: swappable gaze sources, face-pose direction, neutral calibration, inferred iris mapping, hand/pinch intent, pinned real model adapters, lifecycle cleanup and graphics preflight. Adds a developer-only yaw/pitch gauge that hides unavailable observations and labels display clipping without modifying gaze values. The original single-style/single-script structure and MIT license are retained.

The exact MediaPipe package, model URLs, byte hashes and primary source audit remain in the development record. No VLM is implemented in Stage 3. The updated plan assigns the authorized pretrained-model work to later stages.

## Test results

- Predecessor regression: 145/0 inline; 5/0 core checks.
- Gauge red: 210/1. Complete failure: suite `Gaze: developer gauge`, message `Suite threw unexpectedly`, expected `no unexpected exception`, actual `TypeError: Core.gazeGauge is not a function`.
- Final full inline suite: 217 passed / 0 failed in Node and Chrome.
- Core gate: 5/0; adapter lifecycle: 2/0; canvas/preflight: 4/0.
- Final deterministic failures: none. Evidence: [green](stage-03-green.json), [gauge red](stage-03-gauge-red.json), [browser](stage-03-final-browser.json).
- User live evidence: [transcribed report](stage-03-user-validation.json). One face, -22.2°/-4.0°, modeled confidence 0.62, 15 ms face inference and 30 FPS shown; user confirms working behavior. Screenshot is not a motion recording, exact local file hash is not available, and no claim of independent agent live validation is made.

Run from repository root:
```sh
node tests/run.mjs
node tests/geometry-gate.mjs
node .github/peripheral/reports/stage-03-lifecycle.mjs
node .github/peripheral/reports/stage-03-canvas-test.mjs
```

## Perception tiers touched

Tier 1 face pose, face/iris landmarks and hand adapter; actual face inference evidenced by the user. Tier 2 iris mapping remains a calibrated proxy with synthetic tests, not measured eye-tracker accuracy. No Tier 3 implementation. Synthetic input never becomes Tier 1.

## Gate

Passed by user-observed head-motion behavior, supported by measured face direction; live pinch, iris accuracy, sensor mounting and physical hardware remain unverified and must be covered by final acceptance.

## Commit

`feat(core): gaze source abstraction`. Nathan (@nathanu1) is project lead and primary contributor; commit author must resolve to the verified account. AI assistance produced implementation, tests and documentation at Nathan's direction. Preserve existing and upstream attribution.

## Next

Stage 4: deterministic dwell state machine. Pretrained VLM work is assigned in the plan, starting with the Stage 5 development adapter and Stage 10 evidence-bound interpretations.

Final HTML: 1522 lines; SHA-256 `5daffb0cb2e9ec9d50082524ed70f22a38c66deb3ed47538d5f685efd4bfdb41`.
