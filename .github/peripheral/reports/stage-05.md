> Updated candidate: see [boundary repair and license resolution](stage-05-repair.md). Latest full suite: 309 passed / 0 failed. The original run below is historical evidence; its license blocker is now resolved. Browser runtime gate remains blocked.

# Stage 5 — Object detection (Tier 1)

Status: **incomplete; runtime gate blocked**. The candidate implementation is preserved as a patch, not applied to the main application. Main's product status remains Stage 4 / 263 assertions. No stage-completion commit has been made.

## Tests — written first

The following 37 new assertions were registered and executed against the unchanged Stage 4 implementation before adding the detection functions. Three suites failed because the functions did not exist.

```js
function registerStage5Tests(T) {
  const meta={width:320,height:180,source:"camera",cameraRole:"world",timeMs:100,session:1,fov:{horizontalDeg:60,verticalDeg:33.75,diagonalDeg:Math.hypot(60,33.75)}};
  const detection=(score=0.8,box={originX:80,originY:45,width:80,height:45})=>({boundingBox:box,categories:[{categoryName:"cup",score,index:47}]});
  T.suite("Objects: provenance and filtering",()=>{
    const r=Core.objectDetections([detection(),detection(0.49),detection(0.5)],meta,0.5);
    T.eq(r.length,2,"below threshold is dropped; boundary is retained");
    T.eq(r[0].tier,1,"real world input retains Tier 1");
    T.eq(r[0].confidence,0.8,"detector score survives without invented calibration");
    T.eq(r[0].label,"cup","semantic label survives");
    T.eq(r[0].timeMs,100,"observation time survives");
    T.eq(r[0].session,1,"camera session survives");
    T.eq(Core.objectDetections([detection()],{...meta,source:"synthetic"})[0].tier,null,"synthetic inference has no live tier");
    T.eq(Core.objectDetections([detection()],{...meta,cameraRole:"user"}).length,0,"user-facing camera cannot label the world");
    T.throws(()=>Core.objectDetections([],{...meta,source:"unknown"}),"unknown provenance is rejected");
    T.throws(()=>Core.objectDetections([],meta,NaN),"invalid threshold is rejected");
    T.eq(Core.objectDetections([detection(NaN),detection(1.1),detection(-1)],meta).length,0,"malformed scores are refused");
    T.eq(Core.objectDetections([{boundingBox:detection().boundingBox,categories:[]}],meta).length,0,"missing label is not guessed");
  });
  T.suite("Objects: angular boxes and crop boundary",()=>{
    const original=detection(), before=JSON.stringify(original),r=Core.objectDetections([original],meta)[0];
    T.eq(r.boxDeg.leftDeg,-15,"left pixel boundary becomes angular position");
    T.eq(r.boxDeg.topDeg,8.4375,"vertical angle increases upward");
    T.eq(r.boxDeg.widthDeg,15,"box extent is stored in degrees");
    T.eq(r.boxDeg.heightDeg,8.4375,"angular height preserves aspect ratio");
    T.eq(JSON.stringify(original),before,"normalization leaves input untouched");
    T.true(Object.isFrozen(r)&&Object.isFrozen(r.boxDeg),"observations are immutable");
    T.eq(r.boundingBox,undefined,"raw raster box is not retained in the model");
    const crop=Core.objectCrop(r,meta,100,1);
    T.eq(JSON.stringify(crop),JSON.stringify({x:80,y:45,width:80,height:45}),"OCR preparation maps angular region back to exact pixels");
    T.eq(Core.objectCrop(r,meta,701,1),null,"stale OCR crops are refused");
    T.eq(Core.objectCrop(r,meta,100,2),null,"new session cannot reuse an old crop");
    T.eq(Core.objectCrop(r,meta,99,1),null,"future observation is refused");
    T.eq(Core.objectDetections([detection(0.8,{originX:NaN,originY:0,width:2,height:2}),detection(0.8,{originX:400,originY:0,width:2,height:2})],meta).length,0,"invalid and fully outside boxes are dropped");
    const clipped=Core.objectDetections([detection(0.8,{originX:-10,originY:0,width:20,height:20})],meta)[0];
    T.eq(Core.objectCrop(clipped,meta,100,1).width,10,"partly outside box is clipped before crop");
  });
  T.suite("Objects: independent schedule and cancellation",()=>{
    let workers=[],results=[],released=0;
    const p=createObjectController({createWorker:()=>{const w={postMessage(m){this.messages.push(m);},terminate(){this.closed=true;},messages:[]};workers.push(w);return w;},onStatus:()=>{},onResult:r=>results.push(r),releaseFrame:()=>released++});
    p.start({hz:6}); const w=workers[0];w.onmessage({data:{type:"ready"}});
    let render=Core.createFrameClock(30,0),submissions=0;
    for(let i=0;i<120;i++) {const now=i*1000/120,step=Core.stepFrameClock(render,now);render=step.clock;if(step.emit&&p.submit({}, {...meta,timeMs:now})){submissions++; w.onmessage({data:{type:"result",timeMs:now,detections:[]}});}}
    T.eq(submissions,6,"6 Hz detector schedule holds beneath 30 Hz rendering");
    T.eq(results.length,6,"each accepted inference returns once");
    T.true(p.submit({}, {...meta,timeMs:2000}),"next eligible frame is accepted");
    T.eq(p.submit({}, {...meta,timeMs:2200}),false,"busy detector drops frames instead of queueing");
    w.onmessage({data:{type:"result",timeMs:1900,detections:[]}});
    T.true(p.snapshot().busy,"unmatched result cannot release current inference");
    p.stop();w.onmessage({data:{type:"result",timeMs:2000,detections:[]}});
    T.eq(results.length,6,"late completion after stop is ignored");
    T.true(w.closed,"stop releases model adapter");
    p.start({hz:6});const next=workers[1];next.onmessage({data:{type:"ready"}});
    w.onerror({message:"obsolete failure"});T.eq(p.snapshot().phase,"ready","old worker error cannot poison new session");
    T.eq(p.submit({}, {...meta,cameraRole:"user",timeMs:3000}),false,"user camera is never submitted to world detector");
    T.eq(p.submit({}, {...meta,timeMs:NaN}),false,"invalid timestamp is rejected");
    T.true(released>0,"discarded frame ownership is released");
    next.onerror({message:"runtime failure"});T.eq(p.snapshot().phase,"error","current runtime failure remains visible");
  });
}
```

## Implementation — precise diff

Apply [stage-05-candidate.patch](stage-05-candidate.patch) to parent `ae432289d97e6773a9c92ec5a77635755c18687b`. The patch changes only `index.html` and includes all new inline tests.

- Pure score filtering, immutable labels/confidence/provenance and angular boxes; malformed/outside detections refused.
- Explicit uncalibrated 60-degree uniform-angular raster mapping; this is not a measured camera FOV or metric world location.
- OCR crop preparation with freshness/session checks. It does not execute OCR; Stage 10 still owes dwell, stable anchor identity, consent, retained source-frame matching and the real OCR runtime.
- Independent single-flight 6 Hz scheduler; stale results, old sessions, invalid timestamps and user-camera world detections are rejected.
- Pinned EfficientDet-Lite0 int8 revision 1 model, byte-integrity checked before construction, with MediaPipe Tasks Vision 0.10.21 VIDEO / CPU execution and explicit load/unload.
- Developer-only last-inference snapshot with labels and scores. Source switching cancels and unloads. Snapshot expires after 600 ms; it is not a tracked live box.
- Separate object CPU and completed-rate readouts. CPU inference is on the main thread because the existing pinned library uses page graphics state. Its live frame-budget gate remains open.
- Additive and subtractive wearer canvases remain untouched. No persistence, uploads, inference server, web queries, face identification or VLM integration added.

## Test results

Baseline: **263 passed / 0 failed**. Tests-first red: **263 passed / 3 failed**, full failures:

```text
Objects: provenance and filtering — Suite threw unexpectedly
expected: no unexpected exception
actual: TypeError: Core.objectDetections is not a function

Objects: angular boxes and crop boundary — Suite threw unexpectedly
expected: no unexpected exception
actual: TypeError: Core.objectDetections is not a function

Objects: independent schedule and cancellation — Suite threw unexpectedly
expected: no unexpected exception
actual: ReferenceError: createObjectController is not defined
```

Candidate final synthetic results:

| Check | Passed | Failed |
| --- | ---: | ---: |
| Entire inline application suite | 300 | 0 |
| Pure-core/geometry gate | 5 | 0 |
| Existing dwell gate | 5 | 0 |
| Existing face/hand lifecycle | 2 | 0 |
| Existing face/hand graphics checks (injected) | 4 | 0 |
| Additional object-adapter lifecycle checks (injected) | 6 | 0 |

No final synthetic failures. The six adapter checks were added as supplemental regression checks after implementation, not claimed as the original red phase. They inject the library and do not establish real model output. All JSON evidence identifies the candidate source hash.

Reproduce from a fresh checkout of this checkpoint in an isolated worktree:

```sh
git apply --check .github/peripheral/reports/stage-05-candidate.patch
git apply .github/peripheral/reports/stage-05-candidate.patch
node tests/run.mjs
node tests/geometry-gate.mjs
node .github/peripheral/reports/stage-04-gate.mjs
node .github/peripheral/reports/stage-03-lifecycle.mjs
node .github/peripheral/reports/stage-03-canvas-test.mjs
node .github/peripheral/reports/stage-05-adapter.mjs
```

## Perception tiers touched

Candidate adds the Tier 1 object-detector path for camera-world frames. Synthetic input is explicitly untiered. No real Tier 1 object result has been measured in this run. No Tier 2 or Tier 3 additions.

## Gate

**Blocked**: both local preview URLs were rejected by the cloud browser before the application could load. HTTP reported `net::ERR_BLOCKED_BY_CLIENT`; the single-file URL reported a browser URL security-policy block. No bypass was attempted. Real model execution, camera results, browser UI checks and loaded-vs-unloaded FPS remain unverified. A model download is not a passed inference gate.

Resume validation in an environment that permits the app: run the full browser suite, choose world-facing camera and start it, measure a baseline, load the detector, and verify real labeled boxes while recording completed detector Hz, processed FPS, missed slots and inference CPU over sustained input. Compare loaded/unloaded performance, test threshold, stop/unload/source changes and keyboard operation, and keep wearer overlays empty. If 5–8 Hz detection materially degrades the 30 FPS target, repair scheduling/runtime placement before completion. Do not lower the gate to match a slow benchmark.

### Primary sources checked 2026-09-07

- [Google object detector overview](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector): EfficientDet-Lite0 recommended, 320×320 input, COCO class vocabulary and model download variants.
- [Google Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector/web_js): ObjectDetector VIDEO API, category scores and boxes; synchronous inference blocks the UI thread and workers are recommended where supported.
- [TensorFlow model family listing](https://www.kaggle.com/models/tensorflow/efficientdet): reports Apache 2.0. The exact int8-v1 distribution's card/license mapping was not established from the accessible card response. Resolve before calling the distributed model permissively licensed or passing dependency acceptance.

Downloaded model: 4,602,795 bytes; SHA-256 `0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb`. Runtime URLs remain pinned to `@mediapipe/tasks-vision@0.10.21`. Model bytes are not committed. Initial downloads need network; browser HTTP caching provides no guaranteed offline availability.

## Commit

This blocker checkpoint: `docs: record object detection validation blocker`.
Required completion message, reserved until the gate passes: `feat(perception): tier-1 object detection`.

AI assistance disclosure: implementation, tests and evidence were prepared with OpenAI Codex assistance at Nathan's direction. Existing authorship and license are preserved. Checkpoint author must resolve to @nathanu1.

## Next

Resume Stage 5 from the saved patch, resolve artifact license mapping, and pass the real-frame/performance gate before proceeding to Stage 6. The build advances by successful gates, not scheduled slots. Recurring builds were paused on 2026-09-08 because the required browser validation cannot proceed in this environment; resume once the blocker is resolved.
