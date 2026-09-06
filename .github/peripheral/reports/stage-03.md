# Stage 3 — GazeSource + head gaze

Status: **blocked; Stage 3 remains incomplete**. This checkpoint preserves a tested implementation candidate as a patch, with reproducible evidence. It does not install the candidate as the main application and does not advance Stage 4.

## Tests — new assertions as code

The first five suites below were written before their functions existed and executed red. The resource-lifetime suite was then written before its controller existed and executed red. A subsequent regression test exposed a real pinch-gap defect; it failed before the fix. These tests remain inside the candidate's single inline script and use only deterministic synthetic observations.

```js
function registerStage3Tests(T) {
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const yaw30 = [0.8660254037844386,0,-0.5,0, 0,1,0,0, 0.5,0,0.8660254037844386,0, 4,5,-40,1];
  const input = { poseMatrix: identity, cameraRole: "user", frameSource: "synthetic", timeMs: 100, faceCount: 1 };
  T.suite("Gaze: pose matrix convention", () => {
    T.approx(Core.poseDirectionDeg(identity).xDeg, 0, 1e-10, "neutral pose points at view centre");
    T.approx(Core.poseDirectionDeg(yaw30).xDeg, 30, 1e-10, "column-major positive yaw maps to camera-right degrees");
    T.approx(Core.poseDirectionDeg(yaw30, yaw30).xDeg, 0, 1e-10, "neutral calibration cancels initial rotation");
    const pitch = [1,0,0,0, 0,0.8660254037844386,-0.5,0, 0,0.5,0.8660254037844386,0, 0,0,0,1];
    T.approx(Core.poseDirectionDeg(pitch).yDeg, 30, 1e-10, "upward face normal gives positive elevation");
    T.throws(() => Core.poseDirectionDeg([1,2]), "incomplete matrix is rejected");
    T.throws(() => Core.poseDirectionDeg(Array(16).fill(0)), "degenerate rotation is rejected");
    T.throws(() => Core.poseDirectionDeg(identity.map((v,i) => i === 8 ? NaN : v)), "nonfinite matrix is rejected");
    T.approx(Core.poseDirectionDeg(Core.deviceMatrix({ alpha: 0, beta: 0, gamma: 30 })).xDeg, 30, 1e-10, "device angles use declared Z-X-Y convention");
    T.throws(() => Core.deviceMatrix({ alpha: null, beta: 0, gamma: 0 }), "missing device orientation is not fabricated");
  });
  T.suite("Gaze: swappable sources and honest provenance", () => {
    const proxy = Core.gazeSource("view-center").sample({}, 100);
    T.eq(proxy.directionDeg.xDeg, 0, "view-centre proxy has zero horizontal offset");
    T.eq(proxy.tier, null, "default proxy is not measured perception");
    T.eq(proxy.confidenceKind, "model", "proxy confidence is labeled a model choice");
    const source = Core.gazeSource("face-head");
    const fresh = source.sample({ ...input, poseMatrix: yaw30 }, 100);
    T.approx(fresh.directionDeg.xDeg, -30, 1e-10, "user-facing camera coordinates map to wearer direction");
    T.eq(fresh.tier, null, "synthetic pose never becomes Tier 1");
    T.eq(source.sample({ ...input, frameSource: "camera" }, 100).tier, 1, "real-camera pose path retains measurement provenance");
    T.eq(source.sample({ ...input, cameraRole: "world" }, 100).available, false, "world camera cannot observe wearer face");
    T.eq(source.sample({ ...input, faceCount: 2 }, 100).available, false, "multiple faces cannot silently select a wearer");
    T.eq(source.sample({ ...input, faceCount: 0 }, 100).confidence, 0, "face loss immediately drops confidence");
    T.eq(source.sample(input, 351).directionDeg, null, "stale face direction cannot drive interaction");
    T.eq(source.sample(input, 99).available, false, "future samples are invalid");
    T.eq(Core.gazeSource("iris").sample(input, 100).available, false, "iris direction requires calibration and landmarks");
    T.eq(Core.gazeSource("device").sample({ ...input, frameSource: "device" }, 100).tier, 1, "device measurement stays separately labeled");
    T.throws(() => Core.gazeSource("pretend-eye-tracker"), "unknown gaze source fails loudly");
  });
  T.suite("Gaze: iris calibration and loss", () => {
    const eyes = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    for (const [left,right,top,bottom,iris] of [[33,133,159,145,468],[362,263,386,374,473]]) {
      eyes[left] = { x: 0.3, y: 0.5 }; eyes[right] = { x: 0.7, y: 0.5 };
      eyes[top] = { x: 0.5, y: 0.45 }; eyes[bottom] = { x: 0.5, y: 0.55 };
      eyes[iris] = { x: 0.5, y: 0.5 };
    }
    const f = Core.irisFeatures(eyes, 16/9);
    T.approx(f.x, 0, 1e-10, "centred irises have no horizontal displacement");
    T.approx(f.y, 0, 1e-10, "centred irises have no vertical displacement");
    T.eq(Core.irisFeatures([], 1), null, "missing iris landmarks cannot become gaze");
    const closed = eyes.map(p => ({ ...p })); closed[159].y = closed[145].y;
    T.eq(Core.irisFeatures(closed, 1), null, "closed eye refuses iris direction");
    const samples = [[0,0],[-0.2,0],[0.2,0],[0,-0.2],[0,0.2]].map(([x,y]) => ({ features: {x,y}, targetDeg: {xDeg: 20*x+2*y, yDeg: -3*x+15*y} }));
    const calibration = Core.calibrateIris(samples);
    const projected = Core.applyIrisCalibration({x:0.1,y:-0.1}, calibration);
    T.approx(projected.xDeg, 1.8, 1e-10, "calibration recovers horizontal affine mapping");
    T.approx(projected.yDeg, -1.8, 1e-10, "calibration recovers vertical affine mapping");
    T.throws(() => Core.calibrateIris(samples.map(s => ({...s, features:{x:0,y:0}}))), "collapsed calibration cannot claim eye tracking");
    T.throws(() => Core.calibrateIris(samples.slice(0,2)), "insufficient calibration is rejected");
    const eyeSource = Core.gazeSource("iris");
    const result = eyeSource.sample({...input, landmarks:eyes, aspect:16/9, calibration, frameSource:"camera"}, 100);
    T.eq(result.tier, 2, "iris-to-gaze mapping is explicitly inferred");
    T.eq(result.measurementTier, 1, "real iris measurements retain their input tier");
    T.eq(eyeSource.sample({...input, landmarks:closed, aspect:1, calibration},100).confidence, 0, "blink disables iris-driven interaction");
  });
  T.suite("Hands: pinch intent and rearming", () => {
    const hand = Array.from({length:21}, () => ({x:0.5,y:0.5}));
    hand[0]={x:0.5,y:0.8}; hand[9]={x:0.5,y:0.5}; hand[4]={x:0.4,y:0.4}; hand[8]={x:0.43,y:0.4};
    T.approx(Core.pinchRatio(hand, 2), 0.2, 1e-10, "pinch distance accounts for image aspect ratio");
    T.eq(Core.pinchRatio([],1), null, "missing hand yields no pinch measurement");
    let state = Core.pinchState();
    const obs = ratio => ({ratio,enabled:true,frameSource:"camera",handCount:1,timeMs:0});
    let step = Core.stepPinch(state, obs(0.1), 0);
    T.eq(step.event, null, "starting with closed fingers does not summon");
    state = Core.stepPinch(step.state, {...obs(0.6),timeMs:10},10).state;
    step = Core.stepPinch(state, {...obs(0.1),timeMs:20},20);
    T.eq(step.event, null, "pinch must persist through debounce");
    step = Core.stepPinch(step.state, {...obs(0.1),timeMs:140},140);
    T.eq(step.event.warrant, "summon", "deliberate pinch produces summon intent");
    T.eq(Core.stepPinch(step.state, {...obs(0.1),timeMs:150},150).event, null, "held pinch cannot repeat");
    const lost = Core.stepPinch(step.state, {...obs(null),handCount:0,timeMs:160},160);
    T.eq(lost.state.armed, false, "hand loss requires an observed release before rearming");
    T.eq(Core.stepPinch(lost.state, {...obs(0.1),timeMs:170},170).event, null, "reacquired closed fingers do not retrigger");
    T.eq(Core.stepPinch(state, {...obs(0.1),enabled:false,timeMs:20},20).state.armed, false, "disabled pinch clears readiness");
    T.eq(Core.stepPinch(state, {...obs(0.1),timeMs:0},500).event, null, "stale hand cannot summon");
    T.eq(Core.stepPinch(state, {...obs(0.1),handCount:2,timeMs:20},20).state.armed, false, "ambiguous hands clear readiness");
    const beforeGap=Core.stepPinch(state,{...obs(0.1),timeMs:20},20).state;
    T.eq(Core.stepPinch(beforeGap,{...obs(0.1),timeMs:400},400).event,null,"a gap in observations cannot complete a pinch");
    T.eq(Core.stepPinch(beforeGap,{...obs(0.1),timeMs:400},400).state.armed,false,"observation gaps require a new release");
  });
  T.suite("Gaze: synthetic world view", () => {
    const a = Core.syntheticViewFrame(42, 0, {xDeg:0,yDeg:0}, 32,18);
    const b = Core.syntheticViewFrame(42, 0, {xDeg:5,yDeg:0}, 32,18);
    T.true(a.data.join() !== b.data.join(), "head-directed view changes world sampling without a reticle");
    T.eq(b.source, "synthetic", "panned world remains explicitly synthetic");
    T.eq(b.tier, null, "panned world never becomes measured input");
    T.eq(Core.syntheticViewFrame(42,0,{xDeg:5,yDeg:0},32,18).data.join(), b.data.join(), "synthetic view is deterministic");
  });
  T.suite("Perception: scheduling and resource lifetime", () => {
    const workers=[],results=[],released=[];
    const pipeline=createPerceptionController({createWorker:()=>{
      const worker={messages:[],postMessage(m){this.messages.push(m);},terminate(){this.terminated=true;}};
      workers.push(worker); return worker;
    },onStatus:()=>{},onResult:r=>results.push(r),releaseFrame:f=>released.push(f)});
    pipeline.start({faceHz:15,handHz:10}); const first=workers[0];
    pipeline.submit("loading frame",{timeMs:0,cameraRole:"user",frameSource:"camera",handsEnabled:true});
    T.eq(released.length,1,"frames arriving before model readiness are released");
    first.onmessage({data:{type:"ready"}});
    pipeline.submit("a",{timeMs:100,cameraRole:"user",frameSource:"camera",handsEnabled:true});
    T.eq(first.messages.at(-1).face,true,"user camera schedules face inference");
    T.eq(first.messages.at(-1).hands,true,"enabled hands schedule independently");
    pipeline.submit("b",{timeMs:200,cameraRole:"user",frameSource:"camera",handsEnabled:true});
    T.eq(released.at(-1),"b","busy inference drops frames instead of building a queue");
    first.onmessage({data:{type:"result",timeMs:100}});
    pipeline.submit("too soon",{timeMs:120,cameraRole:"user",frameSource:"camera",handsEnabled:true});
    T.eq(released.at(-1),"too soon","perception respects rate ceilings");
    pipeline.submit("world",{timeMs:300,cameraRole:"world",frameSource:"camera",handsEnabled:true});
    T.eq(first.messages.at(-1).face,false,"world camera never schedules wearer-face inference");
    pipeline.stop();
    T.eq(first.terminated,true,"stop terminates the worker and its models");
    first.onmessage({data:{type:"result",timeMs:300}});
    T.eq(results.length,1,"late results after stop cannot restore measurements");
    pipeline.start({faceHz:15,handHz:10}); workers[1].onmessage({data:{type:"ready"}});
    first.onmessage({data:{type:"error",message:"old error"}});
    T.eq(pipeline.snapshot().phase,"ready","old worker failure cannot poison a new session");
    workers[1].onmessage({data:{type:"error",message:"inference failed"}});
    T.eq(pipeline.snapshot().phase,"error","current worker failure is reported");
    T.eq(workers[1].terminated,true,"failed worker releases resources");
  });
}

```

## Implementation — precise diff

[Complete candidate patch](stage-03-candidate.patch), against `index.html` at parent `76e7bb7994ab298d1f1eddb2aed69184e749a90b`. Applying the patch reproduces the tested file byte for byte (verified using `patch --batch -p1` in an isolated temporary directory).

- Parent HTML: 878 lines; SHA-256 `0af85b4821b55b7baec41d29986a562642bc95accdb6e59dd139103da3098358`.
- Candidate HTML: 1,438 lines; SHA-256 `a812d1fe7cc73f6803d581ef97f6797bb7343fffd3946f3c83ad6fab1dbaf2be`.
- Main application, README, license and existing history remain at the last passed product checkpoint. This checkpoint only adds internal reports, the candidate patch and blocked progress metadata.

The candidate adds a pure, swappable `gazeSource(mode).sample(input, nowMs)` contract, column-major pose extraction and neutral-relative rotation, W3C device orientation, iris features with blink rejection and affine calibration, and pinch hysteresis/debounce/rearming. Synthetic world sampling changes with pose without adding a reticle. Confidence values and all thresholds are model choices, never detector probabilities or calibrated gaze accuracy.

The DOM adapter separates camera roles: world pixels can use a view-center proxy; user-facing face/iris processing controls a synthetic world. Missing, stale, future, ambiguous and malformed samples cannot drive interaction. Iris motion changes the estimated gaze inside the head-directed view, rather than panning the scene. Device pose remains labeled as a device measurement with unverified mounting; no head-mounted sensor is invented.

A Blob worker loads the actual pinned Face Landmarker and Hand Landmarker tasks, hashes model bytes before creation, and calls `detectForVideo`. There is one job in flight and no backlog, independent face/hand ceilings, transferred-frame release, source-generation invalidation, worker termination, explicit loading/inference timeouts, and cleanup on stop/hide/page exit. Thresholds 0.5 configure detection/presence/tracking; they are not exposed as measured confidence. Exactly one face/hand is required for interaction, with capacity two used to detect ambiguity.

Hand landmarks feed the geometric pinch detector. The debug console also exposes an accessible summon button. Both produce pending summon intents only: Stage 11 owns warrant admission and subsequent stages own reveals. The candidate writes no assistance or dimming pixels. Five calibration targets and synthetic yaw controls exist only in the developer console.

Models load only on an explicit request. Frames remain in memory and are not uploaded; application state is memory-only. No persistence APIs, backend, keys or telemetry are added. HTTP caching is best effort, not a guarantee of offline availability. Model execution is **implemented but not runtime-validated** in this session.

### Primary sources checked on 2026-09-06

| Component | Pin / evidence | License or convention |
| --- | --- | --- |
| MediaPipe Tasks Vision | [`@mediapipe/tasks-vision@0.10.21`](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/package.json), repository tag [`v0.10.21`](https://github.com/google-ai-edge/mediapipe/tree/v0.10.21) resolved to `cad7f3ab99ebf175947e40c5252c642612aae927` | Apache-2.0 package metadata; preserve upstream notices |
| Face task | [`face_landmarker/float16/1`](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task), 3,758,596 bytes, HTTP 200 | [BlazeFace card](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf), [Face Mesh V2 card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf), [Blendshape V2 card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf): Apache-2.0 |
| Hand task | [`hand_landmarker/float16/1`](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task), 7,819,105 bytes, HTTP 200 | [Hand Tracking full/lite model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20(Lite_Full)%20with%20Fairness%20Oct%202021.pdf): Apache-2.0 |
| Matrix layout | [Pinned MatrixData proto](https://github.com/google-ai-edge/mediapipe/blob/v0.10.21/mediapipe/framework/formats/matrix_data.proto), [pinned Face Landmarker implementation](https://github.com/google-ai-edge/mediapipe/blob/v0.10.21/mediapipe/tasks/web/vision/face_landmarker/face_landmarker.ts) | Packed data defaults to column-major; JS forwards the packed values |
| Device pose | [W3C Device Orientation](https://www.w3.org/TR/orientation-event/) | Intrinsic Z-X′-Y″ in the standard device frame; secure-context API |
| Landmark APIs | [Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker), [Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) | 478 face landmarks and 21 hand landmarks; neither supplies proof of wearer identity |

Downloaded face SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
Downloaded hand SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.
The package's MJS and WASM URLs use the exact 0.10.21 directory. Model version 1 paths plus byte hashes are retained in the candidate manifest. Model files are not vendored. Download success is not inference success. Model cards identify limits under occlusion, pose and appearance variation; neither source establishes iris-to-screen accuracy for this prototype. No new wearable hardware capability is asserted.

## Test results — actual counts and complete failures

Fresh parent verification: **145 passed / 0 failed**, plus **5 passed / 0 failed** core checks, matching the Stage 2 committed source hash and evidence.

| Phase | Command / runtime | Passed | Failed | Evidence |
| --- | --- | ---: | ---: | --- |
| First red | `node tests/run.mjs`, Node v24.19.0, exit 1 | 145 | 5 | [Full red results](stage-03-red.json) |
| Resource red | Same command/runtime, exit 1 | 194 | 1 | [Full resource red results](stage-03-resource-red.json) |
| Pinch regression red | Same command/runtime, exit 1 | 206 | 1 | [Full gap red results](stage-03-gap-red.json) |
| Final candidate | Same command/runtime, exit 0 | 207 | 0 | [Full green results](stage-03-green.json) |
| Core isolation | `node tests/geometry-gate.mjs`, Node v24.19.0, exit 0 | 5 | 0 | [Core checks](stage-03-core-gate.json) |
| Browser synthetic harness | Chrome, `#test` | 207 | 0 | [Browser observations](stage-03-browser.json) |

Complete first-red failures (all had message `Suite threw unexpectedly`, expected `no unexpected exception`):

1. `Gaze: pose matrix convention`: `TypeError: Core.poseDirectionDeg is not a function`.
2. `Gaze: swappable sources and honest provenance`: `TypeError: Core.gazeSource is not a function`.
3. `Gaze: iris calibration and loss`: `TypeError: Core.irisFeatures is not a function`.
4. `Hands: pinch intent and rearming`: `TypeError: Core.pinchRatio is not a function`.
5. `Gaze: synthetic world view`: `TypeError: Core.syntheticViewFrame is not a function`.

Complete resource-red failure: `Perception: scheduling and resource lifetime`, message `Suite threw unexpectedly`, expected `no unexpected exception`, actual `ReferenceError: createPerceptionController is not defined`.

Complete gap-red failure: `Hands: pinch intent and rearming`, message `a gap in observations cannot complete a pinch`, expected `null`, actual `{"warrant":"summon","source":"pinch","timeMs":400,"tier":1}`. Fixed by rejecting discontinuous observation timestamps and requiring a fresh release.

Final deterministic failures: **none**. Browser runtime failures/blockers:

- User-facing camera: application reported `Unavailable`, kept the camera indicator inactive, and returned to synthetic input. Face-head direction was `Unavailable / 0.00`.
- Initial model attempt: `Models unavailable: TypeError: Cannot read properties of undefined (reading 'digest')`.
- The final candidate adds an explicit secure-origin preflight. Retest: `Models unavailable: Error: Secure origin required for model integrity checks; use HTTPS or localhost`.

The permitted preview is HTTP. No security requirement was removed to enable a claimed pass. Real model construction/inference was not reached; the synthetic smoke button stayed disabled. Downloaded artifacts, synthetic suites and browser error handling do not satisfy live validation. The read-only browser inspector did not expose canvas context reads, so no runtime pixel-alpha assertion is claimed. Visual inspection showed no reticle or assistance overlay. Observed throughput remained about **1 FPS**, not the 30 FPS target; representative processing CPU was 4.60 ms, excluding sensor/display latency. Device sensor operation, iris accuracy, live pinch and hardware optics remain unverified.

## Perception tiers touched

- **Tier 1 paths implemented, not live-validated:** face pose/landmarks, hand landmarks, and device orientation. Camera pixels from the preceding stage remain separately labeled.
- **Tier 2:** the calibrated iris-to-gaze affine estimate has modeled confidence and retains Tier 1 input provenance only for actual camera measurements. Its precision is not established.
- **Synthetic/default proxy:** no live tier. Tests that supply camera-shaped fixture metadata verify provenance propagation, not successful real measurement.
- **Tier 3:** untouched. No scripted world facts are invented.

## Gate

Required: **Reticle-free view center tracks head motion.**

**BLOCKED.** Synthetic panning and source readouts were observed, but no actual head motion was observed through a working user-facing model pipeline. Camera access and model integrity validation are unavailable in this HTTP preview. The complete Stage 3 gate has not passed. No completed feature commit is made; `nextStage` remains 3.

To reproduce and resume from a fresh repository checkout:

```sh
# First read the current brief, plan, state, and this report.
# Check the working tree is clean and index.html still matches the recorded base.
git apply --check .github/peripheral/reports/stage-03-candidate.patch
git apply .github/peripheral/reports/stage-03-candidate.patch
node tests/run.mjs
node tests/geometry-gate.mjs
npm run dev
```

Use a supported secure browser at localhost or HTTPS with a real user-facing camera. Choose Face pose, Use camera, then Load face and hand models. Verify readiness, exactly one face, actual inference timings and changing head-directed view center, with no reticle. Turn left/right and up/down, set neutral pose, lose/reacquire the face, and switch sources. Exercise the real hand release–pinch–hold–release sequence, ambiguous/lost hands, fresh timestamps and explicit disable. Check iris calibration/blink loss without claiming optical accuracy, and check device input where available. Validate cleanup and actual render/model rates. Capture exact runtime evidence and repair any real defects before applying the candidate to main. A synthetic smoke check can establish model execution on synthetic pixels only.

If current main changes, reconcile the patch against a fresh parent rather than forcing it. Re-run all tests and the full gate. Only then use the specified feature commit and mark the stage complete.

## Commit

This incomplete-stage evidence checkpoint uses **`docs: record gaze validation blocker`**. The commit containing this report is the checkpoint; its actual GitHub link and verified author are returned in the build conversation. The completed-stage message **`feat(core): gaze source abstraction`** remains reserved until the full gate passes.

Nathan (@nathanu1) remains project lead and primary contributor through verified repository authorship. AI engineering assistance produced this candidate, tests and report at Nathan's direction. Preserve MIT and all existing attribution; MediaPipe code/model attribution remains with its authors. GitHub account resolution is distinct from a cryptographic signed-commit badge.

## Next

Resume **Stage 3** at the next run using fresh GitHub state and the preserved patch. Secure-origin positive-frame validation is required before completion. Stage 4 and all successors remain pending. The next build slot repairs/verifies Stage 3; the target schedule must not advance past this blocker.
