# Stage 8 — Depth + surface estimation (Tier 2)

**Status: incomplete. The gate is not met.** The pure surface-estimation core is implemented and verified on synthetic analytic depth maps. No depth model was downloaded, pinned, hashed or run, so nothing in this build estimates depth, and `nextStage` stays 8.

## Stage

Stage 8 of the brief: "Depth map arrives at the scheduled rate; plane normals are computed; anchors project onto surfaces rather than floating." Gate: "Overlays sit on things."

This run was requested by Nathan on 2026-11-22 ("continue go through all the stages") and executed through the `/build-stage` loop: a `test-author` agent wrote the tests, a `stage-builder` agent implemented, and a read-only `gate-verifier` agent checked the result. The session was a cloud environment that could reach npm but not `huggingface.co` or `cdn.jsdelivr.net` (both refused at the proxy), which is why the real model could not run (lesson L1).

## Tests

198 new deterministic assertions in `registerStage8Tests` (`index.html`), in ten suites:

| Suite | What it pins |
| --- | --- |
| Depth: validated relative map | Frozen, validated relative inverse-depth map; never metric; tier 2 only for camera input |
| Depth: view-ray convention | `xDeg = atan2(x, z)`, `yDeg = atan2(y, hypot(x, z))`, inverse of Stage 3's `poseDirectionDeg` |
| Depth: 1–2 Hz single-flight schedule | Rate limits, rejection outside 1–2 Hz, no request while one is in flight |
| Depth: single-flight worker boundary | `createDepthController` against an injected worker |
| Depth: results are checked when applied | Session, source, staleness, future and out-of-order results are dropped (lesson L5) |
| Depth: plane normals from analytic maps | Fronto-parallel and tilted planes recovered within 0.02°; unit, viewer-facing normals |
| Depth: no surface instead of a bad normal | Too few samples and depth edges return `no-surface` with a reason |
| Depth: anchors attach to fitted surfaces | Tracks gain an `attached` surface from a current fit |
| Depth: anchors float without current evidence | Tracks are `floating` with a reason; occluded anchors never attach to what hides them |
| Depth: pure core boundary | No DOM, clock, network or random source; no input mutation; wearer layers unchanged |

All fixtures are synthetic maps built in the test. No test needs a model, network, camera or DOM.

**Red phases**

1. `stage-08-red.json`: 457 passed, 197 failed. Every failure is a missing function or constant. The verifier rebuilt this source from `main` plus the test hunk and matched its `sourceSha256` exactly.
2. `stage-08-carry-red.json`: 654 passed, 1 failed ("a tracker step never carries an earlier surface forward"). **Honest note on order:** the builder had already fixed this defect before a test pinned it, which is not test-first. The assertion was added afterwards and the red run was produced by temporarily replacing the fix line `const {surface:withdrawn,...kept}=t;` in `Core.trackObjects` with `const kept=t;`, then restoring it. That temporary source is the one hashed in the evidence file.

The Stage 8 test function in the green source differs from the first red source by exactly that one added assertion; nothing was removed or loosened.

## Implementation

All in `index.html`, inside the single script.

- **Constants:** `depthHz` = 1 and `depthFreshMs` = 1500, both `kind: "model"`. 1 Hz is the lower bound of the brief's range, chosen because no depth model has been timed.
- **`Core.createDepthMap`:** validated, frozen map of relative inverse depth with `metric: false`, `depthKind: "relative-inverse"`, the Stage 2 uniform-angular projection, and `confidenceKind: "monocular-depth-model"`.
- **`Core.viewRay`:** unit view ray for an angular position.
- **`Core.createDepthSchedule`, `Core.stepDepthSchedule`:** pure 1–2 Hz single-flight scheduling.
- **`Core.applyDepthMap`:** accepts a result only if it matches the current session and source, is inside the freshness window, and is newer than the current map.
- **`Core.fitSurface`:** least-squares plane fit. A plane n·X = d is affine in inverse depth over the tangent coordinates (x/z, y/z), so the fit is exact for analytic planes. Returns a unit viewer-facing normal, a relative residual, an inlier fraction, and `orientationKind: "relative-uncalibrated"`, or `no-surface` with a reason.
- **`Core.anchorSurfaces`:** gives every track a `surface` that is either `attached` to a current fit or `floating` with a reason.
- **`Core.trackObjects`:** no longer carries a `surface` forward from an earlier step.
- **`createDepthController`:** injected-worker controller in the same shape as `createObjectController`.
- **Shell (debug console only):** the tracked-anchor readout shows each anchor's surface status and reason, and one note says the depth model is not pinned or loaded. Every anchor currently reports `floating (no-depth-map)`.

**What is not implemented.** There is no depth model worker, no transformers.js depth adapter, no model URL, revision or hash, and no path in the shell from a worker result to `Core.createDepthMap`. The shell passes a null depth map. Plan decision 3 (model card, conversion repository, revision, licence, hashes) is outstanding for the depth model.

## Test results

- Inline suite: **655 passed, 0 failed** (Node v22.23.5), evidence `stage-08-green.json`, `sourceSha256` `524cab4aef202872…`.
- `tests/camera-companion.mjs`: 19 passed, 0 failed.
- `tests/geometry-gate.mjs`: 5 passed, 0 failed.
- The verifier ran 30 single-point mutations on a copy; 25 were caught. The five survivors are listed under Next.

## Perception tiers touched

Tier 2 only. Camera depth maps, fits and attachments carry tier 2 with a confidence and its kind. Synthetic and evaluation input always carries no tier, whatever the caller passes. Nothing claims metric depth. Tier 1 code is unchanged. In this build no camera depth exists, so no Tier 2 depth value is ever produced at runtime.

## Gate

**Not met** (independent verifier's verdict, which this report adopts). Plan decision 4 says real depth must execute before its gate passes, and no Stage 8 amendment exists.

To pass it, one of these is needed:

1. Run on a machine that can download the model: pin `@huggingface/transformers` and the Depth Anything V2 Small browser conversion to exact revisions, verify hashes, wire the worker to `createDepthController` and its results to `createDepthMap` and `applyDepthMap`, and record real evidence.
2. Or Nathan approves a written amendment (lesson L2) with an acceptance method and thresholds fixed before inference, for example a prerecorded real-model evaluation like Stage 5's. An acceptance method is needed in any case, because no overlay renderer exists before Stage 13 to show "overlays sit on things".

**Unverified:** real depth inference, its rate, latency, output convention and licence; browser rendering of the debug text; `createDepthController` against a real Worker.

## Commit

`feat(perception): surface estimation core for stage 8 (gate open)` on branch `stage-8-depth-surfaces`. The brief's title for this stage, "monocular depth and surface anchoring", is not used because nothing here estimates depth yet; it is reserved for the commit that passes the gate.

AI assistance: the tests, implementation and verification were written by Claude agents in a cloud session, directed by Nathan's request.

## Next

Stage 8 remains the next stage. Before or while wiring the real model, the verifier's findings need handling:

1. **Orientation under unknown shift (medium).** A 30° wall fits 10° to 27° off depending on the model's unknown shift, with confidence unchanged. Confidence measures planarity, not normal accuracy. Decide how shift is handled or how confidence reflects it.
2. **Freshness against latency (medium).** At 1 Hz with a 1500 ms window, attachments hold up to about 500 ms model latency, then blink, and vanish at 1600 ms. Set both constants from measured latency.
3. **Refit cost (medium).** `anchorSurfaces` refits every track every frame though the map changes at 1–2 Hz; a 518×518 map costs up to 84 ms per fit. Cache per map or downsample in the adapter.
4. **Map confidence has no source (medium-low).** The model emits no confidence; define an evaluated estimate instead of inventing one.
5. **Untested behaviour (low).** Five surviving mutants: the per-track source check, the inlier-fraction denominator, the fit-quality factor in confidence, the minimum-sample rules, and the centre-in-view rule. The `rejects` helper also accepts any exception.
6. **Low:** fit thresholds are literals, not tagged constants; the debug line should show tier and confidence before `attached` is reachable; a hung worker blocks depth with no timeout; a rectilinear camera read through the uniform-angular chart adds up to 2.6° normal error.
