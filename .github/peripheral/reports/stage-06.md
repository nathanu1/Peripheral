# Stage 6 — Tracking and anchor identity

## Tests

Thirty new inline assertions were written before their corresponding implementation or repair.

```js
T.eq(next.tracks.find(t=>t.label==="cup").id,id,"brief occlusion retains identity");
T.true(k.value>0&&k.value<2,"Kalman update smooths jitter");
T.eq(f.dx,2,"pixel matching recovers translation");
T.eq(s.tracks[0].lastDetectionMs,0,"flow never refreshes detector evidence");
T.eq(ambiguous.tracks.filter(t=>t.status==="detected").length,0,"ambiguous overlap refuses identity");
```

## Implementation

See [stage-06.patch](stage-06.patch) for the exact inline application/test change.
Added pure angular IoU association, scalar Kalman updates per box component,
immutable stable IDs, class gating, overlap ambiguity refusal, a 20-track cap,
800 ms detector-based expiry, and source/session isolation. Reordered detections
retain IDs; expired identities are never automatically revived.

Added bounded block-matching optical flow over actual RGBA pixels. It searches
four pixels in each direction around a textured 5x5 center patch, rejects flat
or ambiguous matches, and converts displacement to degrees at the raster
boundary. This is a JavaScript block matcher, not Lucas–Kanade or OpenCV.
The developer console lists ID, class, detected/flow/occluded status, provenance,
association score and measured tracking CPU. The shell retains one prior frame
and freezes tracking while a detector frame is in flight to avoid applying a
delayed observation to a newer coordinate state. Older results are refused.

OpenCV packaging check: the official 4.13.0 usage guide prescribes a separate
opencv.js script, incompatible with the existing one-inline-script product
constraint as supplied. Used the plan's explicit pure-JavaScript fallback.
No OpenCV artifact was loaded: download size, initialization time, WASM heap
lifetime and cv.Mat frame cost are therefore not measured, not claimed zero.
Source checked 2026-09-14:
https://docs.opencv.org/4.13.0/d0/d84/tutorial_js_usage.html

## Test results

Initial tests-first red: **345 passed / 3 failed**, complete failures:

```text
Tracking: overlap and Kalman uncertainty — TypeError: Core.boxIou is not a function
Tracking: identity and bounded occlusion — TypeError: Core.createTracker is not a function
Tracking: pixel flow between detections — TypeError: Core.patchFlow is not a function
```

Integration red: **374 passed / 1 failed**:

```text
Tracking: identity and bounded occlusion
detector may finish at its reserved frame timestamp
expected: 1
actual: 0
```

Final full suite: **375 passed / 0 failed**. Earlier regression checks:
geometry/core 5/0, dwell 5/0, face/hand lifecycle 2/0, graphics injection 4/0,
detector adapter injection 6/0. Final failures: none.
Evidence: stage-06-red.json, stage-06-integration-red.json,
stage-06-green.json and stage-06-regression.json. Run with
`node tests/run.mjs`; all deterministic tests require no model or camera.

## Perception tiers touched

Association and smoothed live-camera tracks are Tier 2 model estimates.
Synthetic and prerecorded evaluation tracks remain untiered. Fresh Stage 5
detector observations retain their original provenance separately.
No new live-camera or hardware validation was performed.

## Gate

Passed in deterministic tests: IDs persist through a 200 ms missing-detection
interval and associate on return; actual synthetic pixel displacement bridges
an intervening detector gap. Flat patches abstain, flow cannot refresh detector
age, and expiry prevents indefinite hallucinated tracks.

Positions are explicitly view-angular with worldPosition null. This stage does
not establish physical world lock, metric depth, identity across departure,
or correct identity through indistinguishable crossings. Those require later
pose/depth/re-identification work. Center-patch motion can fail on nonrigid
objects, large displacement, or occlusion; it abstains when photometric checks
fail. Browser throughput and live tracking quality remain unverified.

## Commit

`feat(perception): anchor tracking and association`

Nathan is project lead. Implementation, tests and documentation were prepared
with OpenAI Codex assistance. Preserve original MIT license and attribution;
verify GitHub author resolves to @nathanu1 before reporting delivery.

## Next

Stage 7 — embedding-based re-identification with evaluated, pinned model assets
and confidence-bearing matches.
