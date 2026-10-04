# Requested extension — live camera companion

Nathan requested a camera-first mirror experience: see yourself and the real
scene with a smart-glasses-inspired interface, object labeling, and context.
He also explicitly requested delivery in his own GitHub account. The verified
account and repository are `nathanu1` and `nathanu1/Peripheral`.

This is a camera-companion UI extension. It does not complete numbered Stage 8,
depth estimation, surface anchoring, the WorldModel, or optical warranted
reveals. `nextStage` remains 8. The current user request takes priority over the
older stage order for this bounded UI change.

## Tests written first

`registerCameraSceneTests` was inserted into the existing inline suite before
the new core implementation. The initial run recorded 418 passes and five
suite failures because `sceneView`, `sceneBoxes`, `sceneSummary`, and
`sceneSelection` did not exist. See `camera-companion-red.json`.

The 39 new assertions cover front/rear presentation, diagnostic camera-role
separation, mirrored bounding-box edges, offscreen clipping, raw detector
scores versus decaying tracking strength, source/session freshness, future
observations, cached/unconfirmed position expiry, counts, plain-text labels,
explicit selection, six-second expiry, object loss, and invalid inputs.

`tests/camera-companion.mjs` exercises the actual inline frame and UI shell
with injected DOM objects, video tracks, clocks, pixel rasters, and a
detector-shaped adapter. Its 19 checks cover startup without access/downloads,
video-only capture, requested recognition, full-size scene painting, mirror
and world alignment, selection/expiry, camera switching and track release,
labels off/on, object loss, glasses-mode separation, denied camera access,
recognition errors with a surviving camera, and visibility cleanup.
These are software integration tests, not real browser or model inference.

## Implementation

- Reworked the existing single inline style and shell into a dark camera
  workspace with Mirror / World view / Glasses preview controls, camera
  start/stop, a labels toggle, observed-class counts, and an object inspector.
- Added four pure core methods for camera presentation, safe projected boxes,
  class-count summaries, and explicit expiring selection.
- The scene-facing role can request the front camera for a mirror, showing
  the user and nearby objects. That does not establish wearer gaze. The old
  diagnostic user-facing face/hand mode retains its synthetic world.
- Camera startup from the companion explicitly requests both video and local
  object recognition. The legacy debug-camera button preserves manual model
  loading for baseline measurements. Labels off unloads recognition.
- Reused the existing hash-pinned EfficientDet-Lite0 / MediaPipe 0.10.21
  adapter, 6 Hz single-flight scheduling, angular tracker, optical-flow path,
  and optional embedding memory. No new model/runtime/CDN dependency.
- Retained a 320×180 perception raster while painting actual live video at
  960×540 using the same full-frame letterbox mapping. Camera pixels alone
  reflect in Mirror; projected labels reflect separately with matching edges.
- Kept detector scores on tracks independently of decaying association
  strength. Scene labels require compatible live source/session evidence,
  expire after 600 ms without detection, and stop displaying unconfirmed
  positions after 300 ms. Cached positions are explicitly marked last seen.
- Labels and inspector values use `textContent`. No identity, state, OCR,
  VLM interpretation, metric depth, or physical surface anchor is claimed.
- Companion elements use a separate DOM surface. Optical additive and
  subtractive canvases remain empty; companion annotations are absent from
  Glasses preview. Startup is stopped, with no automatic camera access.
- Kept native buttons, focus styles, reduced-motion rules, keyboard-operable
  debug controls, and narrow-screen CSS. Changed `npm test` to include the
  injected shell checks and the existing pure-core gate.

## Test results

Runtime: Node v24.19.0.

- Existing baseline: 418 passed / 0 failed.
- Tests-first run: 418 passed / 5 failed (missing new core functions).
- Final inline suite: 457 passed / 0 failed.
- Camera-shell integration: 19 passed / 0 failed.
- Existing geometry/core boundary gate: 5 passed / 0 failed.
- `npm test` and `git diff --check`: passed.

Full deterministic and injected-shell evidence is recorded in
`camera-companion-green.json` and `camera-companion-shell.json`, including the
source SHA-256. No failure remains in these software checks.

## Perception tiers

No new perception computation or tier is introduced. Companion class labels
come from the existing camera detector (Tier 1 by the project's convention),
while tracked positions retain Tier 2 inference labeling. Synthetic and
evaluation observations cannot supply live companion labels. Class scores
are uncalibrated model outputs. An anonymous person class is not identity.

## Gate and limitations

Software behavior passes the deterministic and injected-shell gates. Visual
browser QA and a real-camera/model run remain unverified: the cloud browser
returned `net::ERR_BLOCKED_BY_CLIENT` for the local preview; the execution
environment had no installed Chromium and its official browser download did
not yield a usable archive. No screenshot, real-browser rendering, sustained
FPS, or recognition accuracy is claimed for this extension.

Camera inference still depends on browser graphics support and first-use
model downloads. If recognition fails, the companion keeps the camera view
working and reports the model error. The app remains one HTML file without
frameworks, backend, analytics, API keys, frame uploads, or persistent storage.

## Commit

`feat(ui): live camera mirror and scene inspection`

Nathan remains project lead and the verified repository author. AI engineering
assistance was used for this implementation and test work. The commit containing
this report is the extension checkpoint; its own SHA is not invented here.

## Next

Run the camera companion on Nathan's browser and verify front/rear camera,
label placement, keyboard controls and inference speed. The original Stage 8
depth/surface work and later requested visual interpretation remain incomplete.
