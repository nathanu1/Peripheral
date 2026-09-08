# Stage 5 — Object detection: boundary repair

Stage remains incomplete. This checkpoint updates the saved candidate only; root index.html remains the passed Stage 4 application. All existing license and attribution are preserved; engineering and evidence prepared with Codex assistance at Nathan's direction.

## Tests — written and executed first

```js
function registerObjectBoundaryTests(T) {
  T.suite("Objects: observation-bound crops",()=>{
    const meta={width:320,height:180,source:"camera",cameraRole:"world",timeMs:100,session:1,fov:Core.makeFov(60,33.75)};
    const raw={boundingBox:{originX:80,originY:45,width:80,height:45},categories:[{categoryName:"cup",score:0.8}]};
    const o=Core.objectDetections([raw],meta)[0];
    T.eq(Core.objectCrop(o,{...meta,timeMs:101},110,1),null,"crop rejects a different observation frame");
    T.eq(Core.objectCrop(o,{...meta,source:"synthetic"},110,1),null,"camera observation cannot crop synthetic input");
    T.eq(Core.objectCrop(o,{...meta,session:2},110,1),null,"crop metadata must share the observation session");
    T.eq(Core.objectCrop(o,{...meta,cameraRole:"user"},110,1),null,"world crop cannot use user-camera metadata");
    T.eq(Core.objectCrop(o,{...meta,fov:Core.makeFov(80,45)},110,1),null,"changed angular projection invalidates crop");
    T.eq(Core.objectCrop(o,{...meta,width:0},110,1),null,"invalid crop raster is refused");
    T.eq(Core.objectCrop(o,meta,110,1)?.width,80,"matching observation still crops normally");
  });
  T.suite("Objects: malformed categories",()=>{
    const meta={width:320,height:180,source:"synthetic",cameraRole:"world",timeMs:100,session:1,fov:Core.makeFov(60,33.75)};
    const boundingBox={originX:80,originY:45,width:80,height:45};
    T.eq(Core.objectDetections([{boundingBox,categories:[null]}],meta).length,0,"null category cannot crash perception");
    T.eq(Core.objectDetections([{boundingBox,categories:{}}],meta).length,0,"non-array categories cannot crash perception");
  });
}
```

## Implementation — precise diff

The cumulative `stage-05-candidate.patch` now records the original detector and this repair. Apply to the unchanged root index.html at this checkpoint; it includes all 46 new Stage 5 assertions. Crops require matching observation timestamp, source, session, world-camera role and frozen projection FOV. Invalid raster/FOV returns null. Null and non-array categories are discarded.

This checks metadata correspondence; it does not fingerprint image content. The adapter retains the submitted frame in memory. Stage 10 still must retain that frame and connect OCR to valid dwell/anchor/consent checks.

## Test results

Fresh GitHub checkout candidate baseline: **300 passed / 0 failed**. New red: **302 passed / 6 failed**. Final full application suite: **309 passed / 0 failed**. Additional independent checks: core 5/0, dwell 5/0, face lifecycle 2/0, face graphics 4/0, object adapter 6/0. Final failures: none. All are synthetic/injected Node checks. Source SHA-256: `8a0356ea81a9522735570a26ca4da4b7bf140ef60f19aea443ab94e68d3e548b`.

Complete red failures:

```json
[
  {
    "suite": "Objects: observation-bound crops",
    "passed": false,
    "message": "crop rejects a different observation frame",
    "expected": null,
    "actual": {
      "x": 80,
      "y": 45,
      "width": 80,
      "height": 45
    }
  },
  {
    "suite": "Objects: observation-bound crops",
    "passed": false,
    "message": "camera observation cannot crop synthetic input",
    "expected": null,
    "actual": {
      "x": 80,
      "y": 45,
      "width": 80,
      "height": 45
    }
  },
  {
    "suite": "Objects: observation-bound crops",
    "passed": false,
    "message": "crop metadata must share the observation session",
    "expected": null,
    "actual": {
      "x": 80,
      "y": 45,
      "width": 80,
      "height": 45
    }
  },
  {
    "suite": "Objects: observation-bound crops",
    "passed": false,
    "message": "world crop cannot use user-camera metadata",
    "expected": null,
    "actual": {
      "x": 80,
      "y": 45,
      "width": 80,
      "height": 45
    }
  },
  {
    "suite": "Objects: observation-bound crops",
    "passed": false,
    "message": "changed angular projection invalidates crop",
    "expected": null,
    "actual": {
      "x": 100,
      "y": 56,
      "width": 60,
      "height": 34
    }
  },
  {
    "suite": "Objects: malformed categories",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Cannot read properties of null (reading 'categoryName')"
  }
]
```

Evidence and commands follow the original report, with this run's files prefixed `stage-05-repair-`.

## Perception tiers touched

Existing candidate Tier 1 boundary strengthened. No new real-model measurements. Synthetic observations remain untiered; no Tier 2/3 changes.

## Gate

**Blocked on real-frame browser/performance validation.** No new browser attempt or policy workaround was made. The prior local-URL restriction remains the outstanding execution limitation.

License blocker resolved on 2026-09-08: the [upstream collaborator's response to the pretrained object-detection commercial-use question](https://github.com/google-ai-edge/mediapipe/issues/4906#issuecomment-1778649604) explicitly assigns Apache 2.0 to MediaPipe models and points to the [upstream license](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE). Combined with Google's official distribution URL recorded in the original report, this supplies the missing upstream licensing basis. The collaborator response was read through the GitHub API; author association is COLLABORATOR. No claim is made that a model-card webpage rendered successfully.

## Commit

`docs: preserve object detection boundary fixes` — candidate/evidence checkpoint only. Completion message `feat(perception): tier-1 object detection` remains reserved until the live gate passes.

## Next

Run the candidate on a camera-capable computer. In a fresh checkout, apply the saved patch, open index.html, and run tests. Choose **World facing → Use camera → Load object detector**. Compare FPS before/after loading over sustained input; verify labeled boxes and detector rate, unload/source cancellation and keyboard controls. Send the displayed FPS, detector Hz, CPU time and visible labels; include browser/device and test count. These observations can support the live gate without sending camera frames. Recurring builds remain paused; Stage 6 cannot begin yet.
