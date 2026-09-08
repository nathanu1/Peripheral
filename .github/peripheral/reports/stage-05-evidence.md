# Stage 5 — Object detection runtime evidence

Stage 5 remains incomplete. This checkpoint improves the unapplied candidate and its validation path; the root application remains the completed Stage 4 build.

## Tests — written first

```js
const evidence=Core.objectRuntimeEvidence({baseline,loaded,browser:"Safari 26.5",
  device:"Mac",capturedAt:"2026-09-08T19:00:00.000Z"});
T.eq(evidence.schema,"peripheral.stage5.runtime.v1","evidence has a versioned schema");
T.eq(evidence.gate.status,"passed","sustained real detections can pass the gate");
T.eq(evidence.gate.checks.length,7,"every runtime condition is explicit");
T.eq(evidence.loaded.labels.join(","),"chair,cup","labels are normalized and deterministic");
T.eq(evidence.loaded.tier1Count,4,"measured Tier 1 count survives export");
T.true(Object.isFrozen(evidence)&&Object.isFrozen(evidence.gate),"runtime evidence is immutable");
T.eq(Core.objectRuntimeEvidence({baseline,loaded:{...loaded,source:"synthetic"},
  browser:"x",device:"y",capturedAt:"z"}).gate.status,"failed","synthetic input cannot pass");
T.eq(Core.objectRuntimeEvidence({baseline,loaded:{...loaded,detectorHz:4.9},
  browser:"x",device:"y",capturedAt:"z"}).gate.status,"failed","below-schedule detector cannot pass");
T.eq(Core.objectRuntimeEvidence({baseline,loaded:{...loaded,frameFps:25},
  browser:"x",device:"y",capturedAt:"z"}).gate.status,"failed","render regression cannot pass");
T.eq(Core.objectRuntimeEvidence({baseline,loaded:{...loaded,detectionCount:0,
  tier1Count:0,labels:[]},browser:"x",device:"y",capturedAt:"z"}).gate.status,
  "failed","no real boxes cannot pass");
T.throws(()=>Core.objectRuntimeEvidence({baseline:{...baseline,durationMs:9999},
  loaded,browser:"x",device:"y",capturedAt:"z"}),"short baseline is rejected");
T.throws(()=>Core.objectRuntimeEvidence({baseline,loaded:{...loaded,durationMs:14999},
  browser:"x",device:"y",capturedAt:"z"}),"short loaded capture is rejected");
T.throws(()=>Core.objectRuntimeEvidence({baseline,loaded:{...loaded,inferenceCpuMs:NaN},
  browser:"x",device:"y",capturedAt:"z"}),"nonfinite metrics are rejected");
```

## Implementation — precise diff

The cumulative implementation remains in [stage-05-candidate.patch](stage-05-candidate.patch). This update adds:

- a pure, immutable `objectRuntimeEvidence` evaluator with schema `peripheral.stage5.runtime.v1`;
- seven explicit checks: world-camera provenance, minimum capture durations, 5–8 Hz detection, at least 27 loaded FPS, at least 90% baseline retention, and current Tier 1 boxes;
- **Record 10 s baseline** and **Record 15 s detector run** controls in the developer console;
- in-memory counting of completed inference, mean inference CPU time, detections, Tier 1 detections and normalized labels;
- JSON export through a read-only textarea. No browser storage, frame upload or telemetry was added.

The 27 FPS and 90% retention thresholds are prototype gate choices, not established human-factors constants. Raw results and every individual check remain visible so final acceptance can revisit them.

## Test results

Tests-first red: **309 passed / 1 failed**:

```text
Objects: runtime gate evidence — Suite threw unexpectedly
expected: no unexpected exception
actual: TypeError: Core.objectRuntimeEvidence is not a function
```

Final candidate results:

| Check | Passed | Failed |
| --- | ---: | ---: |
| Entire inline application suite | 322 | 0 |
| Pure-core/geometry gate | 5 | 0 |
| Existing dwell gate | 5 | 0 |
| Face/hand lifecycle | 2 | 0 |
| Face/hand graphics checks | 4 | 0 |
| Object adapter lifecycle | 6 | 0 |
| Evidence-shell static checks | 7 | 0 |

Final failures: none. These are deterministic or injected Node checks. They do not establish real model output. Candidate source SHA-256: `6dad4651080c270a71a9a88b98717b299a47c566fab1e34fedef03ee5c1423fd`.

## Perception tiers touched

No new live Tier 1 measurement. The candidate now prevents synthetic evidence, missing boxes or mixed-tier counts from passing the runtime gate. No Tier 2 or Tier 3 changes.

## Gate

**Blocked.** Real EfficientDet boxes and sustained browser performance still require a camera-capable browser run. The candidate now produces the exact evidence needed to assess that gate without sharing camera frames.

## Commit

Checkpoint message: `docs: add object detection runtime evidence capture`. The required completion message `feat(perception): tier-1 object detection` remains reserved until the live gate passes.

AI assistance: implementation, tests and evidence were prepared with OpenAI Codex assistance at Nathan's direction. Preserve the repository MIT license, upstream model attribution and all prior authorship.

## Next

Apply the candidate, open it through HTTPS or localhost, choose **World facing → Use camera**, record the baseline, load the detector, record the detector run, and send the exported JSON. Stage 6 remains ineligible until this gate passes.
