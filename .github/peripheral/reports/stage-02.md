# Stage 2 — Geometry core

Parent: `40f89ff5541a18c36c425b10cd21dd07539537bb`. Main, README, plan, state, complete brief, repository tree, recent commits, and preceding evidence were read through the connected GitHub tools. A fresh snapshot of every tracked file was used; the predecessor HTML hash matched its evidence and its full **86 passed / 0 failed** suite was rerun. No previous scratch checkout was trusted. Stage 1's synthetic-feed gate and its unverified live-camera/30 FPS limitations remain recorded. This run implements Stage 2 only.

## Tests

These five suites were written and run before their implementation. The initial run failed on missing geometry methods while all 86 predecessor assertions passed. All 59 new assertions execute in the final green suite.

```js
function registerStage2Tests(T) {
  T.suite("Geometry: angular units", () => {
    T.eq(Core.degToPx(1, 42), 42, "one degree maps to 42 nominal display pixels");
    T.eq(Core.pxToDeg(21, 42), 0.5, "fractional degrees retain precision");
    for (const deg of [-180, -7.125, 0, 0.4, 14.285714285714286, 180]) {
      T.approx(Core.pxToDeg(Core.degToPx(deg, 42), 42), deg, 1e-12, `signed degree round-trip: ${deg}`);
    }
    T.eq(Core.degToPx(0.4, 42), 16.8, "cap-height conversion does not round early");
    T.eq(Core.degToPx(2, 60), 120, "conversion accepts another explicit density");
    T.throws(() => Core.degToPx(1, 0), "zero pixel density is rejected");
    T.throws(() => Core.pxToDeg(1, -42), "negative pixel density is rejected");
    T.throws(() => Core.degToPx(NaN, 42), "nonfinite angle is rejected");
    T.throws(() => Core.pxToDeg(Infinity, 42), "nonfinite pixel offset is rejected");
    T.throws(() => Core.degToPx(1, "42"), "unit conversion never coerces strings");
    T.throws(() => Core.degToPx(Number.MAX_VALUE, 42), "overflow is rejected");
  });
  T.suite("Geometry: visual angle", () => {
    T.approx(Core.angularSizeDeg(1, 3), 18.924644416051233, 1e-12, "one metre at three metres subtends about 18.9 degrees");
    T.approx(Core.angularSizeDeg(2, 1), 90, 1e-12, "near objects use exact trigonometry");
    T.eq(Core.angularSizeDeg(0, 3), 0, "zero extent subtends zero angle");
    T.approx(Core.angularSizeDeg(10, 30), Core.angularSizeDeg(1, 3), 1e-12, "equal physical ratios subtend equal angles");
    T.throws(() => Core.angularSizeDeg(-1, 3), "negative physical extent is rejected");
    T.throws(() => Core.angularSizeDeg(1, 0), "zero distance is rejected");
    T.throws(() => Core.angularSizeDeg(1, -3), "behind-eye distance is rejected");
    T.throws(() => Core.angularSizeDeg(Infinity, 3), "nonfinite physical extent is rejected");
  });
  T.suite("Geometry: explicit FOV", () => {
    const fov = Core.makeFov(600 / 42, 600 / 42);
    T.approx(fov.horizontalDeg, 14.285714285714286, 1e-12, "horizontal extent derives from pixel density");
    T.approx(fov.verticalDeg, 14.285714285714286, 1e-12, "vertical extent derives from pixel density");
    T.approx(fov.diagonalDeg, 20.203050891044217, 1e-12, "diagonal derives from both angular extents");
    T.eq(Object.keys(fov).sort().join(), "diagonalDeg,horizontalDeg,verticalDeg", "FOV is an explicit triple");
    T.true(Object.isFrozen(fov), "derived diagonal cannot become stale through mutation");
    T.throws(() => { fov.horizontalDeg = 20; }, "FOV mutation is rejected");
    T.approx(Core.makeFov(12, 5).diagonalDeg, 13, 1e-12, "nonsquare FOV uses both axes");
    T.throws(() => Core.makeFov(0, 10), "empty FOV is rejected");
    T.throws(() => Core.makeFov(180, 10), "unsupported wide display FOV is rejected");
    T.throws(() => Core.makeFov(10, NaN), "nonfinite FOV is rejected");
  });
  T.suite("Geometry: display profile and paint boundary", () => {
    const display = Core.displayGeometry();
    T.eq(display.widthPx, 600, "nominal display uses reported width");
    T.eq(display.heightPx, 600, "nominal display uses reported height");
    T.eq(display.pixelsPerDegree, 42, "nominal display uses reported density");
    T.eq(display.kind, "model", "derived geometry is not a hardware measurement");
    T.eq(display.projection, "uniform-angular", "projection assumption is explicit");
    T.true(Object.isFrozen(display) && Object.isFrozen(display.fov), "display profile is immutable");
    const point = Object.freeze({ xDeg: 1, yDeg: 2 });
    const painted = Core.pointDegToPx(point, display);
    T.eq(painted.xPx, 342, "positive horizontal angle paints right of centre");
    T.eq(painted.yPx, 216, "positive vertical angle paints above centre");
    const restored = Core.pointPxToDeg(painted, display);
    T.eq(restored.xDeg, 1, "paint boundary restores horizontal degrees");
    T.eq(restored.yDeg, 2, "paint boundary restores vertical degrees");
    T.eq(Object.keys(restored).sort().join(), "xDeg,yDeg", "model point retains degrees only");
    const wide = Core.displayGeometry({ widthPx: 840, heightPx: 420, pixelsPerDegree: 42 });
    T.eq(wide.fov.horizontalDeg, 20, "custom raster derives horizontal FOV");
    T.eq(wide.fov.verticalDeg, 10, "custom raster derives vertical FOV");
    T.eq(Core.pointDegToPx({ xDeg: 0, yDeg: 0 }, wide).xPx, 420, "custom paint centre follows display width");
    T.throws(() => Core.displayGeometry({ widthPx: 0, heightPx: 600, pixelsPerDegree: 42 }), "invalid display raster is rejected");
    T.throws(() => Core.pointDegToPx({ xDeg: NaN, yDeg: 0 }, display), "invalid point cannot reach paint");
    T.eq(CONSTANTS.displayPixelsPerDegree.kind, "established", "reported density has source classification");
    T.true(CONSTANTS.displayPixelsPerDegree.source.startsWith("https://www.meta.com/"), "reported density names its primary source");
  });
  T.suite("Geometry: display bounds", () => {
    const display = Core.displayGeometry();
    const half = 300 / 42;
    T.eq(Core.containsDeg({ xDeg: 0, yDeg: 0 }, display.fov), true, "view centre is inside the display");
    T.eq(Core.containsDeg({ xDeg: half, yDeg: -half }, display.fov), true, "display edge is inclusive");
    T.eq(Core.containsDeg({ xDeg: half + 0.01, yDeg: 0 }, display.fov), false, "horizontal overflow is outside");
    T.eq(Core.containsDeg({ xDeg: 0, yDeg: -half - 0.01 }, display.fov), false, "vertical overflow is outside");
    T.true(Core.pointDegToPx({ xDeg: half + 1, yDeg: 0 }, display).xPx > 600, "off-screen anchor is never silently clamped");
    T.throws(() => Core.containsDeg({ xDeg: 0, yDeg: 0 }, 20), "bare scalar FOV is rejected");
    T.throws(() => Core.containsDeg({ xDeg: 0, yDeg: 0 }, { horizontalDeg: 10, verticalDeg: 10, diagonalDeg: 20 }), "inconsistent imported FOV is rejected");
  });
}
```

## Implementation

[Exact source, README, and gate-tool diff](stage-02.patch) against the parent above. Additional checkpoint files are the state update, this report, and the red/green/gate evidence. The application remains one self-contained HTML file with one inline style and one inline script; no dependency was introduced.

- `degToPx` and `pxToDeg` preserve signed floating-point offsets without coercion or early rounding. Density is explicit; nonfinite input, invalid density, and overflow are rejected.
- `angularSizeDeg` computes `2 * atan2(sizeM / 2, distanceM)` in degrees for a centred, frontoparallel object. One metre at three metres gives 18.924644416051233°. This geometry does not infer physical object size or distance from camera pixels.
- `makeFov` derives and freezes the horizontal/vertical/diagonal triple. `displayGeometry` derives both axes from raster dimensions and nominal PPD, labels the uniform-angular projection as a model, and supports explicit alternative display dimensions/density.
- Paint-boundary functions map rightward/upward degree coordinates about the display centre to rightward/downward raster coordinates and back. `containsDeg` checks rectangular bounds; out-of-view positions are never silently clamped onto a display edge. Inconsistent FOV triples are rejected.
- A separate Node gate executes the core without its DOM shell, checks browser/network/storage and ambient-time/random references, and exercises repeatability with frozen inputs and independent outputs. Its scanner distinguishes ordinary strings/comments from executable identifiers and keeps template interpolations visible to inspection. This conservative source scan is backed by direct code review and isolated execution, not presented as a general JavaScript security parser.
- Markup, style, and the entire DOM shell are byte-identical to the preceding checkpoint. The README reports actual implementation status; the license and earlier attribution are preserved.

### Calibration assumptions and sources

Checked 2026-09-06: [Meta's product specifications](https://www.meta.com/ai-glasses/meta-ray-ban-display-glasses-and-neural-band/) list a 600×600 display and 42 PPD in the indexed technical-specification extract. The direct page extraction exposed the purchase panel rather than the specification table. [Ray-Ban's product page](https://www.ray-ban.com/usa/l/discover-meta-ray-ban-display) independently lists 600×600 pixels in the right lens. These are manufacturer-reported nominal values, tagged `established` with the primary URL, not measurements made by Peripheral.

Applying one uniform density to both axes is a **model choice**: horizontal = vertical = 600/42 = 14.2857142857°, with the brief's angular-chart diagonal `hypot(horizontal, vertical)` = 20.2030508910°. That diagonal is a small-angle chart approximation, not an exact spherical or pinhole-frustum calculation. Its numerical proximity to the advertised 20° is an inference; the primary-source material retrieved did not establish which axis that advertised number denotes. No advertised scalar enters model calculations. The original brief is preserved; this record clarifies the verification boundary rather than silently promoting its reconciliation to an established hardware fact.

No camera intrinsics, lens-distortion calibration, human-vision limits, brightness limits, model licensing, or live wearable capability was added or claimed. Geometry for a camera image must use its own calibration; the nominal display profile must not be reused as camera FOV. No additive overlays are introduced by this stage.

## Test results

Runtime: Node v24.19.0. Commands:

```sh
node tests/run.mjs .github/peripheral/reports/stage-02-red.json
node tests/run.mjs .github/peripheral/reports/stage-02-green.json
node tests/geometry-gate.mjs .github/peripheral/reports/stage-02-gate.json
```

- Baseline: **86 passed / 0 failed**, exit 0, source SHA-256 `f94f4883b4dab934930deda2890f78050c4f72c50f60c3da78249c10c87c4984`.
- Tests-first red: **86 passed / 5 failed**, exit 1. [Complete evidence](stage-02-red.json), source SHA-256 `c564300831bfb6d44c953079d93eb36fafc1d668c90ed97e91a0d286411e35e2`.
- Final full synthetic suite: **145 passed / 0 failed**, exit 0. [Complete evidence](stage-02-green.json), source SHA-256 `0af85b4821b55b7baec41d29986a562642bc95accdb6e59dd139103da3098358`.
- Final independent gate: **5 passed / 0 failed**, exit 0. [Complete evidence](stage-02-gate.json), matching the same source hash.

All initial application failures in full:

```json
[
  {
    "suite": "Geometry: angular units",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.degToPx is not a function"
  },
  {
    "suite": "Geometry: visual angle",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.angularSizeDeg is not a function"
  },
  {
    "suite": "Geometry: explicit FOV",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.makeFov is not a function"
  },
  {
    "suite": "Geometry: display profile and paint boundary",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.displayGeometry is not a function"
  },
  {
    "suite": "Geometry: display bounds",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.displayGeometry is not a function"
  }
]
```

The first gate-tool run was **3 passed / 1 failed**. Its complete failure was:

```json
{"name":"Core contains zero browser, DOM, network, or storage references","passed":false,"actual":"Error: Forbidden references: window"}
```

[First gate evidence](stage-02-gate-first.json). The checker matched the word `window` inside the existing description string `Rolling diagnostic window`. The checker was corrected to ignore ordinary strings/comments, with fixtures proving that executable browser references and a template interpolation are still detected. The application source was unchanged by this correction. The zero-DOM requirement was retained. Final application and gate failures: none.

To reproduce the application red condition, add the Tests block and its registration to the parent HTML before introducing the new Core functions. Run the same inline-suite command. No camera, downloaded model, network, or human input is needed by either the regression or the gate.

This stage's gate concerns pure computation. Browser interaction, live camera, actual model execution, sustained 30 FPS, physical display calibration, and hardware operation were **not rerun or newly passed**. The prior approximately 1 FPS browser observation remains unresolved. No claim of a passed live gate is made.

## Perception tiers touched

None. Geometry is deterministic model computation, not a Tier 1 measurement, Tier 2 perception inference, or Tier 3 world fact. Existing source provenance and all perception-tier behavior are unchanged.

## Gate

**Passed:** the geometry core is pure, has zero executable DOM/browser references under source inspection, runs independently of the shell, and the full 145-assertion suite plus all five gate checks pass. Hardware, browser performance, and camera calibration are outside this gate and remain unverified.

## Commit

`feat(core): angular geometry and FOV model`

The commit containing this report is the Stage 2 checkpoint. Publication uses a freshly checked parent and atomic non-forced update; author verification must resolve to @nathanu1. Nathan is project lead and primary contributor. AI engineering assistance was used for implementation, tests, and documentation, with existing attribution preserved.

## Next

Stage 3 — Gaze sources, including the plan's camera-role, hand/pinch, and real-model requirements. Stage 2 uses one run; no later stage is implemented here. Existing live-camera and sustained-performance limitations remain open for later validation and final acceptance.
