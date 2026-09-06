# Stage 1 — Camera pipeline + synthetic fallback

Parent: `d33c30e623cd49ea27aa926af6b0e4e07ff28d35`. Current main, README, plan, state, and complete brief were read through the GitHub connection before selecting this stage. Stage 0 was checked against its committed source and its full 28-assertion suite was rerun successfully before adding tests. No later stage is included.

## Tests

The following new suites were written and executed before implementation. They use deterministic raster frames, timestamps, and injected camera outcomes; no camera, network, or model is required. Six missing-implementation suite exceptions produced the initial red run. All 58 new assertions execute in the green run.

```js
function registerStage1Tests(T) {
  T.suite("Frames: deterministic synthetic input", () => {
    const a = Core.syntheticFrame(42, 12, 16, 9);
    const b = Core.syntheticFrame(42, 12, 16, 9);
    const c = Core.syntheticFrame(43, 12, 16, 9);
    T.eq(a.data.join(), b.data.join(), "same seed and frame produce identical pixels");
    T.true(a.data.join() !== c.data.join(), "different seed changes pixels");
    T.true(a.data.join() !== Core.syntheticFrame(42, 13, 16, 9).data.join(), "frame index advances scene");
    T.eq(a.data.length, 16 * 9 * 4, "frame is complete RGBA");
    T.eq(a.source, "synthetic", "synthetic provenance survives transport");
    T.eq(a.tier, null, "synthetic pixels never become measured Tier 1");
    T.true(a.data !== b.data, "frames do not share writable buffers");
    T.eq(Core.syntheticFrame(0, 0, 1, 1).data[3], 255, "zero seed is valid and alpha is opaque");
    T.throws(() => Core.syntheticFrame(1, -1), "negative frame index is rejected");
    T.throws(() => Core.syntheticFrame(1, 0, 0, 4), "zero dimension is rejected");
  });
  T.suite("Frames: cadence and skipped slots", () => {
    let clock = Core.createFrameClock(30, 0);
    let count = 0;
    for (let i = 0; i < 120; i++) {
      const step = Core.stepFrameClock(clock, i * 1000 / 120);
      clock = step.clock;
      count += Number(step.emit);
    }
    T.eq(count, 30, "120 Hz callbacks emit 30 frames in one second");
    const slow = Core.stepFrameClock(clock, 2000);
    T.eq(slow.missed, 30, "missed slots are counted");
    T.eq(slow.emit, true, "late callback emits one current frame");
    T.eq(Core.stepFrameClock(slow.clock, 2000).emit, false, "same timestamp cannot create a catch-up burst");
    T.eq(Core.stepFrameClock(slow.clock, 1500).emit, false, "backward timestamps do not emit");
    T.throws(() => Core.createFrameClock(0, 0), "invalid target rate is rejected");
    T.throws(() => Core.stepFrameClock(clock, NaN), "invalid clock sample is rejected");
  });
  T.suite("Frames: camera denial and unavailable API", () => {
    for (const reason of ["NotAllowedError", "NotFoundError", "Unavailable", "Timeout"]) {
      const events = [];
      const controller = createSourceController({
        requestCamera: (_ready, reject) => reject({ name: reason }),
        releaseStream: () => {}, onChange: state => events.push(state)
      });
      controller.camera();
      T.eq(controller.snapshot().kind, "synthetic", `${reason} falls back to synthetic`);
      T.eq(controller.snapshot().cameraActive, false, `${reason} leaves no active camera`);
      T.eq(controller.snapshot().reason, reason, `${reason} remains visible`);
      T.eq(events[0].status, "requesting", `${reason} keeps synthetic running while requesting`);
    }
  });
  T.suite("Frames: resource lifetime and cancellation", () => {
    const requests = [], released = [];
    const controller = createSourceController({
      requestCamera: (accept, reject) => requests.push({ accept, reject }),
      releaseStream: stream => released.push(stream), onChange: () => {}
    });
    controller.camera();
    const canceled = controller.snapshot().requestId;
    controller.synthetic();
    const stale = { id: "stale" };
    requests[0].accept(stale);
    T.eq(released[0], stale, "late camera grant is released after cancellation");
    T.eq(controller.snapshot().kind, "synthetic", "late grant cannot resurrect camera");
    controller.camera();
    const live = { id: "live" };
    requests[1].accept(live);
    T.eq(controller.snapshot().cameraActive, true, "indicator reflects acquired stream before playback");
    T.eq(controller.snapshot().kind, "synthetic", "synthetic continues until camera has pixels");
    controller.ready(canceled);
    T.eq(controller.snapshot().kind, "synthetic", "stale readiness is ignored");
    controller.ready(controller.snapshot().requestId);
    T.eq(controller.snapshot().kind, "camera", "camera becomes source only after readiness");
    controller.fail(controller.snapshot().requestId, "TrackEnded");
    T.eq(released[1], live, "ended stream is released");
    T.eq(controller.snapshot().kind, "synthetic", "lost camera falls back");
    controller.camera();
    const pending = controller.snapshot().requestId;
    controller.stop();
    requests[2].reject({ name: "NotAllowedError" });
    controller.ready(pending);
    T.eq(controller.snapshot().kind, "stopped", "late outcomes cannot restart a stopped source");
    T.eq(controller.snapshot().cameraActive, false, "stop turns off camera state");
  });
  T.suite("Frames: diagnostics and tier labels", () => {
    const black = { width: 2, height: 1, source: "synthetic", data: new Uint8ClampedArray([0,0,0,255,0,0,0,255]) };
    const white = { ...black, source: "camera", data: new Uint8ClampedArray([255,255,255,255,255,255,255,255]) };
    T.eq(Core.analyzeFrame(black).brightness01, 0, "black code values have zero brightness proxy");
    T.eq(Core.analyzeFrame(white).brightness01, 1, "white code values have unit brightness proxy");
    T.eq(Core.analyzeFrame(black).tier, null, "synthetic diagnostics carry no live tier");
    T.eq(Core.analyzeFrame(white).tier, 1, "camera pixel diagnostics carry Tier 1 provenance");
    T.eq(Core.analyzeFrame(white).edgeContrast01, 0, "uniform frame has no neighboring contrast");
    T.eq(Core.analyzeFrame({ ...black, data: new Uint8ClampedArray([0,0,0,255,255,255,255,255]) }).edgeContrast01, 1, "black-white transition reaches unit contrast");
    T.throws(() => Core.analyzeFrame({ ...black, source: "guessed" }), "unknown provenance is rejected");
    T.throws(() => Core.analyzeFrame({ ...black, data: [] }), "incomplete pixel buffer is rejected");
  });
  T.suite("Frames: rolling performance measurements", () => {
    const samples = Array.from({ length: 31 }, (_, i) => ({ timeMs: i * 1000 / 30, captureMs: 2, analysisMs: 3, paintMs: 1 }));
    const result = Core.frameMetrics(samples, 1000);
    T.approx(result.fps, 30, 1e-8, "FPS is computed from observed intervals");
    T.eq(result.captureMs, 2, "capture CPU time is measured separately");
    T.eq(result.analysisMs, 3, "analysis CPU time is measured separately");
    T.eq(result.paintMs, 1, "paint submission CPU time is measured separately");
    T.eq(result.workMs, 6, "processing time sums actual stage durations");
    T.eq(Core.frameMetrics(samples, 4000).fps, 0, "stale samples do not display a live FPS");
    T.eq(Core.frameMetrics([], 0).workMs, null, "absent measurements are not fabricated as zero latency");
  });
}
```

## Implementation

[Exact implementation and README diff](stage-01.patch) against the parent above. The checkpoint also contains this report, red/green JSON evidence, and the state update. `index.html` now has 707 lines, one inline style, and one inline script; it introduces no dependency or build step.

- Pure seeded RGBA generation, elapsed-slot scheduling at a 30 Hz model target, brightness/edge proxies, and rolling measured FPS/CPU timings. The scheduler skips missed slots without bursts or accumulated interval drift. Synthetic pixels are raster fixtures, not object detections or angular world anchors.
- A browser-free resource adapter accepts injected camera callbacks. Request generations reject late success/failure; acquired tracks are released on cancel, stop, and failure. Camera-active state begins when the stream is acquired, before playback becomes ready.
- The DOM shell starts synthetic input and requests video only after Use camera. A 10-second request/playback timeout retains the fallback, and lost/stalled input returns to it. Capture fits the full frame into the processing raster without cropping; duplicate video timestamps are not counted as new frames. The 320×180 raster is a model choice, not an optical specification.
- Source, active-camera state, measured FPS, missed slots, processing durations, and uncalibrated pixel diagnostics stay in the developer surface. No assistance or dimming pixels are drawn. Stop, page hiding, and page exit release resources. Native controls support keyboard use and synthetic motion respects reduced-motion preference.
- The README describes current usage and limitations. Existing license, history, and attribution remain intact. No model, storage API, frame upload, backend, key, or telemetry was added; future model cache handling remains required in the plan.

Implementation references checked: [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/) for camera/track lifetime and [WHATWG media elements](https://html.spec.whatwg.org/multipage/media.html) for playback readiness. No hardware constants or model-license claims are introduced. Brightness is mean RGB code value, not physical luminance or lux; neighboring contrast is a clutter proxy, not semantic understanding.

## Test results

Commands (Node v24.19.0):

```sh
node tests/run.mjs .github/peripheral/reports/stage-01-red.json
node tests/run.mjs .github/peripheral/reports/stage-01-green.json
```

- Baseline: **28 passed / 0 failed**.
- Tests-first red: **28 passed / 6 failed**, exit 1. [Complete captured red evidence](stage-01-red.json).
- Final full suite: **86 passed / 0 failed**, exit 0; all 28 earlier assertions retained. [Complete green evidence](stage-01-green.json).
- Chrome `#test` and Run Tests via Enter: **86 passed / 0 failed**. This is the same deterministic suite, not live-camera validation.

All red failures in full:

```json
[
  {
    "suite": "Frames: deterministic synthetic input",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.syntheticFrame is not a function"
  },
  {
    "suite": "Frames: cadence and skipped slots",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.createFrameClock is not a function"
  },
  {
    "suite": "Frames: camera denial and unavailable API",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "ReferenceError: createSourceController is not defined"
  },
  {
    "suite": "Frames: resource lifetime and cancellation",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "ReferenceError: createSourceController is not defined"
  },
  {
    "suite": "Frames: diagnostics and tier labels",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.analyzeFrame is not a function"
  },
  {
    "suite": "Frames: rolling performance measurements",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.frameMetrics is not a function"
  }
]
```

Final failures: none.

Green source SHA-256: `f94f4883b4dab934930deda2890f78050c4f72c50f60c3da78249c10c87c4984`.
Red source SHA-256: `6cd904557ebab4f590282a0683cba66424656cd68fc45283c86f08c418a0da0b`.
To reproduce the red condition, add the Tests block and its registration to the parent Stage 0 file before adding the new Core functions or resource adapter, then run the same Node runner. The exceptions above identify the missing functions; no requirement was removed to reach green.

Browser observations (Chrome, synthetic feed, internal preview):

| Check | Actual observation |
| --- | --- |
| Rendered feed | Pattern visibly present on the world canvas; frames advance; synthetic provenance is visible. |
| FPS/processing timings | One sample: 1.0 / 30 FPS, 19 frames / 266 missed slots; capture 0.70 ms, analysis 0.25 ms, paint submission 0.00 ms, total 0.95 ms. Values are rounded CPU measurements, not sensor/display latency. |
| Unavailable camera | Use camera returned `Unavailable`; synthetic feed continued and camera indicator stayed Inactive. Preview origin did not provide usable secure camera access. |
| Stop/restart | Stop feed via Enter cleared the view/readouts (0 / 0 frames); Use synthetic via Enter restarted the feed. |
| Scene controls | Seed changed to 17 and Reset scene activated via Enter; Freeze synthetic motion checked; frozen pattern visibly rendered. |
| Repeated tests | Run Tests via Enter retained exactly 86 passes and zero failures. |
| Console | No application error observed. Browser extension emitted `Error sending browser metadata to extension: Object` from its own content script; this is recorded separately. |

The browser inspection API also rejected a read-only `document.hasFocus()` probe as unsupported; this was an inspection-tool error, not an application failure. No hidden browser state or emulated camera was substituted for a live check.

Observed browser throughput was approximately 1 FPS. Its cause was not established. The deterministic cadence test verifies 30 emissions per second of supplied timestamps, but it does not prove sustained wall-clock 30 FPS in this browser or on hardware. That runtime performance target remains unverified and must be revisited before final acceptance. Real camera capture, device permission denial, sensor/display latency, and a physical outward indicator were not validated; denial, cancellation, timeout, and track lifetime were tested with injected outcomes. No model was downloaded or executed.

## Perception tiers touched

Camera-frame provenance and pixel diagnostics have a Tier 1 transport path when actual camera input is present. The exercised synthetic feed has `source: "synthetic"` and `tier: null`; it is never a measured Tier 1 pass. Tier 2 and Tier 3 are unchanged. Pixel diagnostic interpretation is explicitly marked as uncalibrated model proxies.

## Gate

**Passed through the brief's synthetic-feed alternative:** a synthetic feed visibly renders with actual FPS and processing-latency readouts in the separate debug console, and the entire deterministic suite is green. This gate does not certify live camera, models, sustained 30 FPS, or wearable hardware; those limitations remain recorded for later validation and final acceptance.

## Commit

`feat: frame pipeline with synthetic fallback`

The commit containing this report is the Stage 1 checkpoint. Publication uses a fresh verified parent, an atomic non-forced branch update, and GitHub author verification. Nathan (@nathanu1) is project lead and primary contributor; AI engineering assistance was used for implementation, tests, and documentation. Existing contributors' attribution is preserved.

## Next

Stage 2 — Geometry core. Stage 1 consumed one run; no later stage was advanced. Sustained 30 FPS and live camera/hardware checks remain explicit validation limitations, not completed live gates.
