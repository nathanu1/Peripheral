# Stage 5 — Object detection

Status: **completed** under the Stage 5 acceptance amendment approved on
2026-09-13. The live Tier 1 path is implemented. Completion evidence is actual
pretrained-model inference on licensed prerecorded photographs, which remains
explicitly untiered; it is not a live-camera or wearable-performance claim.

## Tests — new assertions as code

Stage 5 added 82 assertions over the Stage 4 baseline, including 23 assertions
written before the approved offline-evaluation implementation. Representative
new assertions are:

~~~js
const observation=Core.objectDetections([detection],{
  width:320,height:180,source:"evaluation",cameraRole:"world",
  timeMs:100,session:7,fov:Core.makeFov(60,33.75)
})[0];
T.eq(observation.source,"evaluation",
  "prerecorded photographs retain evaluation provenance");
T.eq(observation.tier,null,
  "prerecorded photographs never become live Tier 1");

const evidence=Core.objectEvaluationEvidence(base);
T.eq(evidence.schema,"peripheral.stage5.offline.v1",
  "offline evidence has a versioned schema");
T.eq(evidence.gate.status,"passed",
  "actual model inference on licensed fixtures can pass Stage 5");
T.eq(evidence.fixtureCount,30,
  "all fixture records survive validation");
T.eq(evidence.classCount,10,
  "the evaluation spans ten detector classes");

T.eq(Core.objectEvaluationEvidence({
  ...base,results:{...base.results,liveTier1Count:1}
}).gate.status,"failed",
  "offline evidence cannot claim live Tier 1");
T.eq(Core.objectEvaluationEvidence({
  ...base,results:{...base.results,p95InferenceMs:501}
}).gate.status,"failed",
  "excessive reference latency cannot pass");
~~~

The same suite also covers score filtering, angular box conversion, immutable
provenance, stale crop refusal, camera-role separation, 6 Hz single-flight
scheduling, cancellation, artifact integrity, runtime evidence validation,
fixture licenses and hashes, coverage floors, accuracy floors, invalid boxes,
partial runs, and nonfinite metrics. Complete assertion evidence is in
[stage-05-green.json](stage-05-green.json).

## Implementation — precise diff or marked insertion

The exact application-and-test diff from parent
5da2f40360079b8e4370df0beab8e35779aae211 is
[stage-05.patch](stage-05.patch).

The single inline application now includes:

- pure detection normalization with score filtering, angular boxes, explicit
  source/tier semantics and observation-bound OCR crop preparation;
- a pinned EfficientDet-Lite0 int8 revision 1 adapter using MediaPipe Tasks
  Vision 0.10.21, model-byte SHA-256 verification, CPU/VIDEO mode, cancellation,
  stale-result rejection and a single in-flight frame;
- an independent 5–8 Hz detector schedule, with 6 Hz default, that drops work
  instead of building a queue;
- developer-only current boxes, labels, detector rate, CPU time and versioned
  10-second baseline / 15-second loaded evidence capture;
- a pure immutable offline-gate validator whose thresholds and accepted
  licenses are explicit model constants; and
- evaluation provenance that can never become live Tier 1.

Supporting reproducibility files:

- [stage-05-open-images.json](../fixtures/stage-05-open-images.json): 30
  attributed, SHA-256-pinned Open Images V7 validation fixtures, three from each
  of ten supported classes, selected before inference.
- [stage-05-offline-eval.py](stage-05-offline-eval.py): exact native
  MediaPipe 0.10.21 evaluator, model/hash checks, IoU calculation and disclosed
  three-run warm-up.
- [stage-05-offline-gate.mjs](stage-05-offline-gate.mjs): independent replay
  that recomputes counts and latency statistics and sends the committed result
  through the exact application core.
- [stage-05-offline-run.json](stage-05-offline-run.json): per-image model
  outputs, timings, hashes and environment.
- [stage-05-offline-gate.json](stage-05-offline-gate.json): independent gate
  evidence.

The application remains one self-contained HTML file with one inline style and
one inline script. No framework, bundler, backend, API key, telemetry, frame
upload or persistent browser storage was added. Model and image bytes are not
committed.

## Test results — actual counts and complete failures

Final source SHA-256:
4665d855eb649213332cfd5daf26846901bb813736735ed3a9ca964a6b33908e.

Tests-first offline amendment red: **322 passed / 2 failed**. Complete failures:

~~~text
Objects: prerecorded evaluation provenance
TypeError: Invalid detector provenance

Objects: offline real-model gate
TypeError: Core.objectEvaluationEvidence is not a function
~~~

The original Stage 5 tests-first red evidence remains 263 passed / 3 failed.
Subsequent boundary/evidence repair reds remain 302 passed / 6 failed and
309 passed / 1 failed. None were removed to obtain green.

Final verification:

| Check | Passed | Failed | Scope |
| --- | ---: | ---: | --- |
| Entire inline application suite | 345 | 0 | deterministic; no camera/model/network |
| Pure-core/geometry gate | 5 | 0 | exact inline core |
| Dwell gate | 5 | 0 | deterministic |
| Face/hand lifecycle | 2 | 0 | injected adapter |
| Face/hand graphics checks | 4 | 0 | injected graphics |
| Object adapter lifecycle | 6 | 0 | injected adapter; no real model |
| Offline evidence replay | 9 | 0 | committed files and exact app core |
| Offline core gate conditions | 14 | 0 | approved Stage 5 gate |

Actual pretrained-model run:

| Metric | Actual | Required |
| --- | ---: | ---: |
| Licensed fixtures / classes | 30 / 10 | at least 30 / 10 |
| Expected-label image hits | 28/30 (93.3%) | at least 60% |
| Correct-class IoU ≥ 0.5 | 25/30 (83.3%) | at least 50% |
| Invalid boxes | 0 | 0 |
| Live Tier 1 count | 0 | 0 |
| Median CPU inference | 20.7086 ms | reported |
| p95 CPU inference | 25.1608 ms | at most 500 ms |

Runtime was Python 3.12.14 on Linux x86_64 with mediapipe 0.10.21 and the
TensorFlow Lite XNNPACK CPU delegate. The runtime reported unavailable EGL/GPU;
GPU was not required or claimed. Downloads, decode and three warm-up calls are
excluded from per-image inference latency. Final failures: **none**.

## Perception tiers touched

The application adds a Tier 1-capable path only for current detections computed
from a current world-camera frame. Synthetic results remain untiered.
Prerecorded Open Images results use evaluation provenance and tier null. The
actual Stage 5 gate therefore validates the pretrained detector and surrounding
software but does not claim a measured live Tier 1 result. No Tier 2 or Tier 3
perception was added.

## Gate

**Passed** under the approved
[Stage 5 acceptance amendment](../plan.md#stage-5-acceptance-amendment--approved-2026-09-13).

All 14 declared conditions passed without changing the fixed fixture selection
or thresholds after observing inference. The exact model artifact SHA-256 is
0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb.

Limitations carried forward: live world-camera output, sustained 5–8 Hz browser
detection, loaded-versus-unloaded render FPS, mobile/wearable performance,
camera calibration, mounting and optics remain unverified. The live evidence
recorder stays in the debug console for future validation. Native x86_64 timing
does not establish browser or hardware timing.

Sources checked for this stage include the
[MediaPipe object detector web guide](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector/web_js),
[Open Images V7 download and license metadata](https://storage.googleapis.com/openimages/web/download_v7.html),
and the
[upstream pretrained-model Apache-2.0 clarification](https://github.com/google-ai-edge/mediapipe/issues/4906#issuecomment-1778649604).
Individual photograph authors and license URLs are retained in the fixture
manifest.

## Commit

Checkpoint message: **feat(perception): tier-1 object detection**.

The commit is authored as
nathanu1 <129923698+nathanu1@users.noreply.github.com>. The report cannot embed
its own not-yet-created SHA; authorship and the final GitHub link are verified
after the atomic non-forced update.

AI assistance disclosure: implementation, tests, evaluation tooling and this
evidence report were prepared with OpenAI Codex assistance at Nathan's
direction. Existing history, authorship and MIT license are preserved.

## Next

Stage 6 — tracking and anchor identity. Add deterministic association,
short-gap optical flow/stabilization, deletion/reacquisition behavior and
world-coordinate anchors without letting a frame-local detection masquerade as
a persistent object.
