# Stage 0 — Skeleton, harness, module boundaries

## Tests

These assertions were written before the harness, core, and shell. Initial execution failed with `ReferenceError: createHarness is not defined` (0 passed / 1 failed). The required intentional assertion was then observed after implementation in Node and Chrome (28 passed / 1 failed):

```js
T.eq(1, 2, "deliberate failure proves the runner reports failures");
```

Full failure: suite `Stage 0 deliberate failure`; message `deliberate failure proves the runner reports failures`; expected `2`; actual `1`. It was removed only after its failure details rendered in the browser. Permanent self-tests still verify that negative cases are detected using isolated probe harnesses.

The remaining assertions, unchanged from their tests-first definitions:

```js
function registerStage0Tests(T, createHarness, Core) {
  T.suite("Harness: result contract", () => {
    const probe = createHarness();
    probe.suite("sample", () => {
      probe.eq(1, 2, "known mismatch");
      probe.eq("after", "after", "continues after failed assertion");
    });
    const result = probe.run();
    T.eq(result.passed, 1, "counts passing assertions");
    T.eq(result.failed, 1, "counts failing assertions");
    T.eq(result.results.length, 2, "retains every assertion");
    T.eq(result.results[0].suite, "sample", "retains suite name");
    T.eq(result.results[0].message, "known mismatch", "retains failure message");
    T.eq(result.results[0].expected, 2, "retains expected value");
    T.eq(result.results[0].actual, 1, "retains actual value");
    T.eq(result.results[0].passed, false, "marks the failure explicitly");
    T.eq(probe.run().results.length, 2, "reruns replace rather than accumulate results");
    const empty = createHarness().run();
    T.eq(empty.passed, 0, "empty harness has zero passes");
    T.eq(empty.failed, 0, "empty harness has zero failures");
  });

  T.suite("Harness: approximate equality", () => {
    const probe = createHarness();
    probe.suite("tolerance", () => {
      probe.approx(1.125, 1, 0.125, "inclusive boundary");
      probe.approx(1.25, 1, 0.125, "outside tolerance");
      probe.approx(4, 4, 0, "zero tolerance");
      probe.approx(NaN, 1, 1, "NaN must fail");
      probe.approx(Infinity, Infinity, 1, "infinity must fail");
      probe.approx(1, 1, -1, "negative tolerance must fail");
      probe.approx(1, 1, Infinity, "infinite tolerance must fail");
    });
    const result = probe.run();
    T.eq(result.passed, 2, "only finite values within tolerance pass");
    T.eq(result.failed, 5, "invalid and out-of-range comparisons fail");
    T.eq(result.results[0].passed, true, "exact tolerance boundary is accepted");
    T.eq(result.results[1].passed, false, "outside tolerance is rejected");
  });

  T.suite("Harness: exceptions and strict assertions", () => {
    const probe = createHarness();
    probe.suite("assertions", () => {
      probe.throws(() => { throw new Error("expected"); }, "catches exception");
      probe.throws(() => {}, "requires exception");
      probe.throws(null, "requires callable");
      probe.true(true, "boolean true");
      probe.true(1, "truthy is not true");
      probe.eq(1, "1", "equality does not coerce");
    });
    probe.suite("crash", () => { throw new Error("unexpected suite error"); });
    probe.suite("after crash", () => probe.true(true, "later suite still runs"));
    const result = probe.run();
    T.eq(result.passed, 3, "correct throws and strict true pass");
    T.eq(result.failed, 5, "bad assertions and suite errors fail");
    T.eq(result.results[6].actual, "Error: unexpected suite error", "suite error is not swallowed");
    T.eq(result.results[7].passed, true, "a suite error does not abort later suites");
    T.throws(() => probe.eq(1, 1, "outside suite"), "out-of-run assertions are rejected");
    T.throws(() => probe.suite("invalid", null), "invalid suite callback is rejected");
  });

  T.suite("Core: initial state boundaries", () => {
    const first = Core.createInitialState();
    const second = Core.createInitialState();
    T.eq(first.reveals.length, 0, "initial state has no reveals");
    T.eq(first.perception.length, 0, "initial state invents no perception");
    T.eq(first.frameSource, null, "no frame source is fabricated");
    T.eq(first.cameraActive, false, "camera starts inactive");
    T.true(first !== second, "states are independently created");
    T.true(first.reveals !== second.reveals, "reveal collections are not shared");
    T.true(first.perception !== second.perception, "perception collections are not shared");
  });

  // The Stage 0 deliberate failure was observed in Node and Chrome, then removed.
}

```

## Implementation

See [the exact application and test additions](stage-00.patch). New `index.html` contains one inline style and script, separate pure core/harness/test/shell sections, three transparent canvas channels, a native details drawer, a Run Tests button, and `#test` handling. Its application source is 290 lines; the final requested size target applies at Stage 19.

`tests/run.mjs` executes that same inline script in a Node VM without a DOM, camera, or network, records its source SHA-256, and exits nonzero on failure. `tests/serve.mjs` and `package.json` provide optional dependency-free development commands; no installation or build is required to open the HTML.

As requested during this stage, workflow files moved into `.github/peripheral/`, and README now focuses on product behavior, usage, and implementation status. Future run instructions must use the new paths and ordinary feature-oriented commit messages. Existing history is preserved. Implementation and verification used AI engineering assistance; commit authorship remains the user's verified GitHub identity.

## Test results

- Before implementation: **0 passed / 1 failed** — [complete output](stage-00-red-before.json).
- Required deliberate failure: **28 passed / 1 failed** — [complete output](stage-00-red-deliberate.json).
- Final entire suite: **28 passed / 0 failed** in Node v24.19.0 — [complete output and source hash](stage-00-green.json).
- Chrome: `#test` automatically opened the drawer and displayed `28 passed / 1 failed` before removal; after removal/reload it displayed `28 passed / 0 failed`.
- Normal page load: drawer closed, no test results shown, no model/camera started.
- Keyboard: Enter opened the native drawer; Tab reached Run Tests with a visible solid focus outline; Enter ran the suite and displayed `28 passed / 0 failed` with 28 result rows.
- A subsequent mouse-triggered rerun also displayed 28 result rows, proving results were replaced, not duplicated.
- No application-origin warnings/errors were observed. The cloud browser's extension logged `Error sending browser metadata to extension: Object`; these extension-origin errors were recorded separately and are not application errors.
- Static checks: exactly one inline script/style, no DOM references in the core section, no application browser-storage references.

No live-model, camera, optical, or physical-hardware claim is made in Stage 0. The zero-luminance accounting gate remains scheduled for Stage 12.

## Perception tiers touched

None. No measurements, inferences, or Tier 3 world facts are fabricated.

## Gate

**Met:** page loads, drawer opens, the button and `#test` run the suite, and the deliberate failure was observed with expected/actual details before removal.

## Commit

`chore: skeleton and inline test harness`

The commit containing this report is the checkpoint. Do not insert a self-referential SHA.

## Next

Stage 1 — Camera pipeline + deterministic synthetic fallback.
