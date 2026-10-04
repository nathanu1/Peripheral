# Peripheral

An on-device visual-assistance prototype for smart glasses, with a live camera companion for exploring perception. Mirror view shows you and your surroundings with tracked object labels. World view uses the rear camera where available. The separate glasses preview keeps its optical assistance layers empty at rest.

Information in the glasses system belongs to the object it describes and appears only when a deliberate action or real-world event warrants it. Camera-companion labels are screen-based inspection tools, not implemented optical glasses reveals or metric world anchors.

## Run

No installation or build is required. For camera use, serve the folder on localhost:

```sh
npm run dev
```

Open `http://localhost:5173`, choose **Mirror**, and select **Start camera**. This requests video only and loads the existing pinned object detector on request. Choose **World view** to switch camera direction. Tap a camera label or an object in **In view** to inspect its class, screen position, evidence type, and uncalibrated model score. Selected details clear after six seconds or when current evidence is lost. **Labels** turns recognition off/on; **Stop camera** releases the stream. The layout adapts to narrower screens; visual browser verification of the new layout is still pending.

`index.html` can also be opened directly for the camera-free tests and synthetic feed. Camera permissions depend on browser support and secure context; use HTTPS or localhost for consistent camera access.

Open **Debug console → Run Tests**, or append `#test` to the page address to run the same suite automatically. Developer controls are separate from the wearer’s view.

The camera companion starts stopped, without camera access or model downloads. The debug console's **Use synthetic** starts a deterministic synthetic test pattern. Use **Scene seed → Reset scene** to reproduce a scene, **Freeze synthetic motion** to pause its motion, or **Stop feed** to clear it. The synthetic feed respects reduced-motion preferences and never supplies live companion labels.

Select **Use camera** to request video only. Camera access requires a supported browser and secure context (HTTPS or localhost); denial, unavailable input, and timeout return to synthetic input. Switching to synthetic, stopping the feed, or hiding the page releases camera tracks. Select a source to resume after returning to the page.

To run the tests without a browser, camera, or model download:

```sh
node tests/run.mjs
```

`npm test` also runs 20 camera-control integration checks with injected DOM, media tracks and detector results, followed by the pure-core geometry gate. These checks verify software behavior; they do not establish real-browser rendering, webcam accuracy, or model quality.

An optional local preview is available with `npm run dev`. It uses Node’s built-in HTTP server and has no dependencies.

`npm run test:browser` runs the page in headless Chromium (via Playwright) with a fake camera composed from hash-pinned, licensed Open Images fixtures and executes the real pinned detector. All network requests are intercepted; only integrity-checked model assets are served from an ignored local cache. It records screenshots and frame timing per view. Software-rendered headless Chromium is much slower than a GPU-backed browser, so its timings are comparative, not product performance.

## Status

Implemented: a single-file shell, separate world/additive/subtractive canvas layers, optional camera capture with synthetic fallback, deterministic frame scheduling, pixel brightness and neighboring-contrast proxies, angular geometry, swappable gaze sources, on-device face/hand and object-model adapters, a developer direction gauge, a pure dwell state machine, and keyboard-accessible debug controls. The inline suite currently has **486 passing assertions**, including 68 camera-companion and display-transform checks; 20 additional injected camera-shell checks pass.

The camera companion adds a dark, restrained interface with Mirror / World view / Glasses preview modes, native `<video>` presentation of live pixels (the compositor keeps the camera moving even while inference blocks the page) independent of the 320×180 analysis raster, an explicit camera → raster → angle → display coordinate chain in which mirroring and cover-cropping exist only at the display step, correctly reflected tracked labels, observed-class counts, and explicit object inspection. Its front-facing scene camera can include the user and surrounding objects without claiming to measure wearer gaze. Diagnostic user-camera face/hand mode remains separate and retains its explicitly synthetic world. Labels expire after 600 ms without detection; unconfirmed positions stop after 300 ms. Model scores are preserved separately from decaying tracking strength. No OCR, VLM answer, person identity, smart-object state, or metric depth is inferred from a class label.

Geometry uses degrees for model positions and converts to pixels at an explicit paint boundary. It includes visual-angle calculations, display bounds, and an immutable horizontal/vertical/diagonal FOV triple. The nominal 600×600 / 42 PPD display fixture uses a uniform-angular approximation; it does not calibrate the camera or validate wearable optics. Its independent core check runs with `node tests/geometry-gate.mjs`.

The debug console reports actual processed FPS, missed frame slots, and capture, analysis, and paint-submission CPU time. These timings exclude sensor and display latency. Brightness and clutter are uncalibrated pixel proxies; synthetic input never carries a live-perception tier.

Face-pose tracking has been reported working in a local user-camera test, with one face and a displayed 30 FPS. This is not a controlled performance benchmark or wearable-hardware validation. The prior cloud test browser could not create the required WebGL context; the application reports that before model downloads. Live hand/pinch, iris accuracy and device mounting remain unverified. Optical assistance overlays remain empty; physical world anchors, VLM interpretation and warranted reveals are upcoming.

The pinned EfficientDet-Lite0 detector has been executed with MediaPipe 0.10.21 on 30 attributed, hash-pinned Open Images photographs across 10 supported classes. It found the expected class in 28/30 images and matched 25/30 selected boxes at IoU 0.5 or higher; native CPU reference latency was 20.71 ms median and 25.16 ms p95 after warm-up. These are prerecorded evaluation results, not Tier 1 live perception, browser throughput or wearable validation.

Dwell uses a configurable threshold (1.5 seconds by default), a small angular tolerance, gradual decay during brief excursions, immediate saccade cancellation, and a per-anchor refractory period that begins after reveal removal. Pending requests remain suppressed until the lifecycle reports removal or refusal. Its progress is intentionally absent from the wearer view. Object anchors will connect live gaze to this state machine in the next perception stages.

For companion object detection, select **Start camera** with **Labels** enabled. For diagnostic detection, choose the world-facing role in the debug console, start a camera or the synthetic source, and select **Load object detector**. Camera-companion labels appear over the live scene; model timing, raw observations and evidence capture remain in the debug console. Camera-world results may carry Tier 1; synthetic and prerecorded evaluation results never do. Sustained browser and hardware performance has not been verified.

For head tracking, select **Face pose · user camera**, click **Use camera**, then **Load face and hand models**. Face forward and select **Set neutral pose**. Changing the source stops the feed and unloads models: repeat these steps after a source change. The camera observes the user while the scene stays explicitly synthetic. The developer gauge shows the selected direction; unavailable tracking hides its meters. Synthetic yaw is a test input, not a sensor.

Models load on request from exact-version URLs and execute locally. Initial downloads require network; browser HTTP caching does not guarantee offline availability. No camera frames are uploaded. This is a browser prototype, not a validated wearable device.

Tracking now assigns stable IDs to angular object boxes, smooths jitter, and uses pixel block matching between detections. The debug console distinguishes detections, flow estimates and occluded tracks. IDs expire after 800 ms without detection; ambiguous overlap is left unresolved. Positions are relative to the view, and live tracking quality remains unverified.

Object appearance memory is optional: load the detector first, then **Load object appearance model**. Pinned CLIP image embeddings run in a separate worker on new object anchors; no people matching is performed. Memory lasts up to 30 seconds, is limited to 64 objects, and clears when the feed stops or changes. **Clear appearance memory** unloads the model. A matched ID and cosine-model score appear only in the debug console. The model needs an approximately 89 MB initial weights download plus its runtime; browser HTTP caching is best effort.

The re-identification reference check passed six licensed object crops with brightness-adjusted revisits and same-class distractors. These results demonstrate appearance persistence on those inputs; novel viewpoints, similar instances, browser model loading and sustained device performance remain unverified.

## Design

- Process perception on device; keep frames off servers.
- Reveal information only for dwell, explicit summons, safety events, or scheduled requests.
- Anchor information to the world and let every reveal expire.
- Label measured, inferred, and scripted information honestly.
- Keep social memory limited to enrolled contacts, with revocation and bystander veto.
- Distinguish emitted light from physical dimming capabilities.

## License

[MIT](LICENSE).
