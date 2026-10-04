# Progress — camera-first perception HUD

Lightweight continuity log for Claude sessions. Stage-by-stage history lives in
`state.json` and `reports/`; numbered `nextStage` is still 8 (depth/surfaces).
The work below extends the camera companion (Mirror / World view) and does not
complete optical Stages 8–12.

## Session 2026-10-04 milestones

1. **Real-browser QA** (`tests/browser-qa.mjs`, `npm run test:browser`).
   First execution of this app in a browser by the build: headless Chromium,
   fake camera composed from hash-pinned licensed Open Images photos, real
   EfficientDet-Lite0 / MediaPipe 0.10.21, all network intercepted. Records
   screenshots, detector rate, processed FPS, main-thread cadence, compositor
   video FPS and a reveal timeline.
2. **Explicit coordinate transforms + native video** (`Core.fitRect`,
   `displayFit`, `analysisFov`, `displayTransform`, `projectBox`). Mirror and
   cover-crop live only at the display boundary. Live camera shown by `<video>`.
3. **Entity model + warrant/reveal policy** (`Core.updateEntities`,
   `projectEntities`, `focusTarget`, `createRevealPolicy`, `stepRevealPolicy`).
   Replaced `sceneBoxes`/`sceneSelection` (intents ported). Focus mode shows
   quiet markers; details only on summon or view-centre dwell; Off/Focus/All.
   An independent review (with a 3000×400-step fuzzer) found four policy/UI
   bugs — re-reveal while the view never moved, dismissal undone by a
   same-step dwell, dwell replacing an explicit tap, cards placed off-stage —
   all fixed test-first.
4. **Camera-first layout.** Stage fills the first viewport; slim top bar;
   floating dock (presentation, label mode, stop); welcome overlay carries
   the start action; In view + inspector below the stage.
5. **Orientation-aware capture.** `Core.captureConstraints` asks for frames
   in the stage orientation; `Core.analysisRaster` uses 180×320 for portrait
   cameras (same pixel budget); `analysisFov` puts the 60° span on the long
   side; rotation mid-stream re-baselines tracking.
6. **Adaptive identity window.** `Core.trackTiming`: 2.5 measured detector
   periods (800 ms floor, 2.5 s cap) for track expiry, entity presence,
   last-seen marking and the stale-result guard (was a fixed 600 ms, which
   discarded every result from inference slower than 600 ms).
7. **Detection in a worker.** Classic Worker + OffscreenCanvas
   (now `visionWorkerMain`), fallback to the page thread on capability
   failures only.
8. **Point and pinch.** Opt-in hand landmarker in a worker on scene-camera
   frames; fingertip aims (marker highlight), pinch summons via the policy
   (`Core.cameraToView`, `Core.handReferent`, reveal `source`).
9. **Stable entity IDs.** `entity-N` with `trackId`; a re-formed track of the
   same class overlapping a departed entity (≤3 s, IoU ≥0.2, unambiguous)
   continues it.
10. **Second review fixes.** Prune raced in-flight detection; stale flicker at
   slow cadence; sticky/over-eager worker fallback; CLIP binding window.
   Window = latency + 2.5 periods; last seen after latency + 1.5 periods.

## Decisions

- Display transform is required, never implicit; perception never sees
  mirrored or cropped coordinates.
- Cover-fit threshold 30% hidden so 4:3 webcams fill a 16:9 stage.
- Entity hysteresis (stale after 500 ms, presence 800 ms, confirm after 2
  results over 250 ms) instead of the old 300 ms "last seen" cutoff, which
  flickered at real detector rates.
- People are never dwell targets (mirror shows the user; identity never inferred).
- Dwell-revealed entities re-arm only after the view leaves them; otherwise
  steady looking produced a reveal every ~8.5 s.
- "All" keeps the previous label-everything inspection as an explicit opt-in.

## Measurements (software-GPU headless Chromium, 4 cores — comparative only)

- Worker detection A/B (desk, 1024×640, 2 runs): processed FPS with the
  detector 8.6–11.5 → 14.5–17.5; main-thread frame p95 183–200 → 83–100 ms.
- Stage area dominates cost here: 1440×900 stage → detector ~2.5 Hz.

- Before: camera visible at the processed rate, ~12 fps with the detector.
- After: compositor presents ~30–34 camera fps regardless of main-thread load.
- Main-thread processed rate with detector fell 12–13 → 5.5–9 fps here because
  software compositing of 30 fps video competes for CPU (20 fps with video
  hidden). Expected near-free on GPU hardware; unverified.
- Detector inference 90–150 ms here (native reference 21 ms median).

## Known issues / debt

- Only the cat is recognized in the desk fixture at score ≥ 0.5; chair and
  bottle crops fall below threshold (EfficientDet-Lite0 at 320×180).
- The diagnostic face/iris path (`createVisionAdapter`) still runs on the
  page thread; companion hand pointing runs in a worker.
- Pinch accuracy, aiming comfort and false pinches are unverified on a live
  camera (only injected landmarks and a still photo were tested).
- Worker detection verified only in headless Chromium; Safari/Firefox
  OffscreenCanvas WebGL in workers untested (fallback exists).
- Real webcam, real phone, GPU-backed throughput still unverified.

## Next high-value tasks

1. Real-device pass: laptop webcam, iPhone Safari, Android Chrome — worker
   path, portrait capture, pinch accuracy, GPU-backed frame rate.
2. Contextual content beyond the class label: a Tier 3 world model (Stage 9)
   and entity binding (Stage 10) so a reveal can say something useful, still
   warrant-gated and source-labelled. This needs product decisions about which
   information is worth showing.
3. Move the diagnostic face/iris landmarker to the shared vision worker.
4. Depth/surfaces (numbered Stage 8) for anchoring cards to surfaces.
