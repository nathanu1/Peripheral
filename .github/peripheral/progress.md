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

- Before: camera visible at the processed rate, ~12 fps with the detector.
- After: compositor presents ~30–34 camera fps regardless of main-thread load.
- Main-thread processed rate with detector fell 12–13 → 5.5–9 fps here because
  software compositing of 30 fps video competes for CPU (20 fps with video
  hidden). Expected near-free on GPU hardware; unverified.
- Detector inference 90–150 ms here (native reference 21 ms median).

## Known issues / debt

- Slow devices: when detector results arrive less often than ~1.5 Hz,
  tracks expire (800 ms, Stage 6 constant) between results and entity IDs
  churn, which can drop a tap on a marker. Seen at 2.5 fps in this sandbox
  with a 1440×900 stage. Fix: derive track/entity expiry from the measured
  detector interval (keep 800 ms as the floor).
- `getUserMedia` always asks for 1280×720, so portrait phones may get a
  landscape or square frame that is letterboxed.
- Only the cat is recognized in the desk fixture at score ≥ 0.5; chair and
  bottle crops fall below threshold (EfficientDet-Lite0 at 320×180).
- Detector runs on the main thread (MediaPipe 0.10.21 needs page graphics);
  a worker + OffscreenCanvas path is untested.
- Portrait cameras: the 320×180 raster pillarboxes a portrait frame, wasting
  ~70% of analysis pixels.
- Real webcam, real phone, GPU-backed throughput still unverified.

## Next high-value tasks

1. Orientation-aware capture: request portrait frames on portrait stages and
   use a portrait analysis raster (long side = 60° model span).
2. Adaptive track/entity expiry from the measured detector rate.
3. Try MediaPipe detection in a worker with OffscreenCanvas; benchmark.
4. Hand/pinch summon on the front camera in Mirror mode (pointing at objects).
5. Depth/surfaces (numbered Stage 8) and a Tier 3 world model for real context.
