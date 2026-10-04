# Peripheral — working notes for Claude sessions

Smart-glasses perception prototype running through a camera. One self-contained
`index.html` (one `<style>`, one inline `<script>`, no build, no framework).
Product brief: `.github/peripheral/brief.md`; build plan and amendments:
`.github/peripheral/plan.md`; stage checkpoints: `.github/peripheral/state.json`
and `reports/`; session progress: `.github/peripheral/progress.md` (read first).

## Commands

- `npm test` — inline suite in Node (`tests/run.mjs`), injected-DOM camera shell
  (`tests/camera-companion.mjs`), pure-core gate (`tests/geometry-gate.mjs`).
  Must stay green; no camera, network or model needed.
- `npm run dev` — serve on http://localhost:5173 (camera needs localhost/HTTPS).
- `npm run test:browser -- --scenario desk|desk43|centre|portrait --seconds 6 [--viewport 1024x640]`
  — headless Chromium + fake camera from licensed fixtures + the real pinned
  detector. Screenshots/JSON land in `.cache/browser-qa/out/` (ignored; never
  commit). Software GPU: timings are comparative only and cost grows with
  stage area (keep the 1024×640 default for behaviour). It prints a reveal
  timeline (warrant, object, page time). jsDelivr is blocked by
  this sandbox's egress policy; the harness serves the identical npm tarball.
- In a browser: `#test` runs the inline suite; Debug console → Run Tests.

## Layout of `index.html`

`// CORE BEGIN … CORE END` pure values and functions (no DOM, clock, random,
network — enforced by the core gate) → resource adapter / workers → harness
→ `register*Tests` suites → `// SHELL BEGIN … SHELL END` (all DOM).
Shell mounts: `mountFramePipeline` (camera, render loop) → `mountGazePipeline`,
`mountObjectPipeline` (detector, tracker, CLIP re-ID), `mountHandPipeline`
(point and pinch), `mountCameraCompanion` (HUD). Vision tasks run in
`visionWorkerMain` (object or hand task) with OffscreenCanvas.

Companion pipeline per frame: tracker (`Core.trackObjects`) → entities
(`Core.updateEntities`, stable `entity-N` IDs) → reveal policy
(`Core.stepRevealPolicy`: summon from tap/list/pinch, dwell via `Core.stepDwell`)
→ projection (`Core.projectEntities`) → DOM. Hand landmarks are camera-normal
until `Core.cameraToView`.

## Coordinate conventions (never mix implicitly)

camera pixels (unmirrored) → 320×180 analysis raster (camera *contain*-fitted,
letterboxed, never cropped) → view angles in degrees (xDeg right, yDeg up,
uniform-angular 60° model, `Core.analysisFov`) → raster-normal [0,1]² →
display-normal [0,1]² via `Core.displayTransform` + `Core.projectBox`.
Mirroring and cover-cropping exist ONLY in the display transform. Perception,
tracking, dwell and focus all work in unmirrored angles. Positions are stored
in degrees; pixels appear only at paint (brief L5).

## Camera / mirror conventions

- Mirror = front camera, pixels reflected by CSS `scaleX(-1)` on `#camera-video`;
  labels reflected by the transform, text never mirrored. World view = rear
  camera, unmirrored. Glasses preview = optical layers empty at rest, no
  companion annotations.
- Live pixels are shown by the native `<video>` (compositor), not repainted
  per frame. Stage fit: cover unless >30% of the frame would be hidden
  (`Core.displayFit`). Diagnostic user-camera role keeps a synthetic world.

## Product principles (enforced in tests)

- Perception ≠ assistance. Detection earns at most a quiet marker. Details need
  a warrant: `summon` (tap/list/keyboard) or `dwell` (view centre rests on a
  confirmed entity 1.5 s). Every reveal is born with its expiry; one at a
  time; dismissal suppresses dwell 30 s; re-arm only after the view leaves.
  People are never dwell targets; identity is never inferred.
- Tiers stay labeled (Tier 1 measured, Tier 2 inferred, Tier 3 stubbed);
  synthetic/evaluation input never yields live labels.
- Constants live in `CONSTANTS` tagged `established` (sourced) or `model`.

## Engineering rules

- Tests first: add suites, record the red run, then implement. Keep all
  existing tests green; port (don't drop) intents when replacing an API.
  Independent review agents with fuzzers/repro scripts have found real bugs
  twice; worth repeating after multi-commit features. Slow-cadence behaviour
  is testable in the injected shell via a delayed detector double.
- Privacy: on-device only; no storage APIs, analytics, backends or keys; models
  are pinned and integrity-checked; never commit camera captures or datasets.
- Performance: render target 30 fps; detector 6 Hz single-flight, CPU/WASM in a
  classic worker with OffscreenCanvas (`objectWorkerMain`), falling back once
  to the page thread (`createObjectAdapter`); face/hand models still run on the
  page thread; embeddings only on new anchors. Identity window adapts to the
  detector cadence (`Core.trackTiming`). Benchmark before/after with the
  browser harness.
- Git: work on the assigned `claude/…` branch; commits authored as
  `nathanu1 <129923698+nathanu1@users.noreply.github.com>` (repo convention)
  with a `Co-Authored-By: Claude` trailer; conventional messages
  (`feat(camera): …`); never force-push or rewrite history.
