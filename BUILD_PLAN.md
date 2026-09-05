# Peripheral: seven-day build plan

Project lead and primary contributor: **Nathan (@nathanu1)**.

Repository: https://github.com/nathanu1/Peripheral
Implementation target: one self-contained `index.html`, all CSS in one style element, all JS in one script element. Supporting Markdown, JSON checkpoints, and test evidence may live beside it.

## Schedule

September 7–13, 2026, America/New_York. Three build runs per day: morning, afternoon, evening, targeting approximately 08:00, 15:00, and 19:00. Flexible runs may start within an hour of those targets. One implementation stage per run, in dependency order.

| Date | Morning | Afternoon | Evening |
| --- | --- | --- | --- |
| Mon Sep 7 | 0 — Skeleton and test harness | 1 — Camera and synthetic fallback | 2 — Geometry and FOV |
| Tue Sep 8 | 3 — Gaze sources | 4 — Dwell state machine | 5 — Object detection |
| Wed Sep 9 | 6 — Tracking and anchors | 7 — Re-identification | 8 — Depth and surfaces |
| Thu Sep 10 | 9 — WorldModel | 10 — Entity binding | 11 — Warrant policy |
| Fri Sep 11 | 12 — Reveal lifecycle and duty cycle | 13 — Additive renderer | 14 — Dimming renderer |
| Sat Sep 12 | 15 — Selective salience | 16 — Wayfinding | 17 — Social anchor and consent |
| Sun Sep 13 | 18 — Scenario runner | 19 — Ethics, accessibility, README | Final acceptance, regression, and handoff |

The brief defines 20 numbered stages (0–19). The 21st run is a final acceptance pass, not an invented replacement for a requested feature. Implementation has not started at schedule setup.

This is a target schedule, not permission to skip a failed gate. If a stage is incomplete, the next run repairs that stage first and reports schedule impact. Do not claim completion from elapsed time or a calendar slot.

## Source of truth and resumption

- Read `docs/PERIPHERAL_BRIEF.md` in full for the original product requirements, tests, gates, commit messages, and output protocol.
- Read `BUILD_STATE.json`, the current repository tree, and the latest commits on every run.
- Start at the earliest incomplete numbered stage. Verify the preceding checkpoint against the actual code and test evidence.
- Keep the existing repository and license. Never initialize a replacement repository or rewrite history.
- At each successful stage, commit implementation, new tests, `docs/stages/stage-NN.md`, and updated `BUILD_STATE.json` together. Record stage completion only when all tests and its gate actually pass.
- Each stage report contains the brief's eight fields: Stage, Tests (new assertions as code written first), Implementation (precise diff/insertion), Test results (actual counts and full failures), Perception tiers touched, Gate, Commit, Next.
- Record test commands/runtime, red-phase evidence, green-phase evidence, gate observations, and limitations. The commit containing the report is its checkpoint; do not invent a self-referential commit SHA.
- On blocked or failed runs, keep the stage incomplete, retain a reproducible failure report, and tell Nathan the exact blocker. Do not substitute a reminder for the authorized build work.
- Prefer an atomic, non-forced branch update from a verified parent. Re-read if another change lands; reconcile before retrying. If protections require a PR, preserve them and open the PR, recording its URL and pending status.

## Authorship

Nathan (@nathanu1) is the project lead and primary contributor. Attribute new commits to the verified GitHub identity already used by this repository:
`nathanu1 <129923698+nathanu1@users.noreply.github.com>`.
When using Git locally, set this only for this repository. When using a connector, verify the returned commit's author resolves to @nathanu1. Do not silently accept a bot as author. Preserve other contributors' existing work and attribution. Document AI assistance honestly.

## Required engineering decisions

1. **Separate the glasses view from the developer console.** The wearer-facing additive layer is empty at rest. FPS, latency, active gaze source, confidence, and duty-cycle readouts belong in a clearly separate debug surface, not permanently lit glasses chrome. The outward camera indicator is distinct from the inward display; a browser can demonstrate its state but cannot certify a physical outward LED.
2. **Camera roles must be physically possible.** A world-facing camera cannot observe the wearer's face. Stage 3 must distinguish a view-center/head-directed proxy, available head/device pose, and user-facing Face Landmarker input over a synthetic world. Label the source, unavailable measurements, and confidence; never invent measured head pose.
3. **Verify constants and model licensing before implementation.** The attached brief is the requested baseline, not an independently verified hardware datasheet. Consult current primary sources and exact model cards when a stage uses them. Record source URLs, exact package/model revisions, licenses, and whether each constant is established or a model choice. Derive explicit horizontal, vertical, and diagonal FOV consistently.
4. **Measured, inferred, and scripted must remain distinct.** Synthetic fallback is deterministic test/demo input, never Tier 1 live perception. Real detection, embeddings, depth, flow, and segmentation must execute the corresponding computation before their gates pass. Missing downloads, unsupported hardware, or unexecuted live gates remain explicitly unverified.
5. **Close the requirements not individually named in the stage table.** Plan hand landmarks and pinch summon with Stage 3, scene luminance/clutter with Stages 1/5, optical flow with Stage 6, dwell-triggered OCR with Stages 5/10, activity/task-step inference with Stages 10/11, and spatial recall with Stages 9/10/18. Preserve real processing and tier labels.
6. **On-device processing, memory-only application state.** No backend, API key, frame uploads, analytics, localStorage, sessionStorage, or IndexedDB. Disable model-library persistent caches that would violate this. JSON import/export uses a textarea. Browser HTTP caching is best effort; do not promise guaranteed offline model availability.
7. **Keep interface restraint measurable.** Only dwell/summon/safety/scheduled warrants, automatic expiry, world anchors, no dwell ring, tier-aware presentation, minimum cap height and sampled-background contrast. Under 2% visibility is a model target; 2% of an hour is 72 seconds. Count the union of lit intervals, not overlapping reveal durations twice.
8. **Consent and hardware honesty are gates.** Enrolled contacts only, revocation, bystander veto, shoulder anchoring outside eye regions, expiring notes. Separate additive light from global/coarse/per-pixel dimming and label speculative capabilities. Do not represent a webcam simulation as wearable hardware validation.
9. **Performance and accessibility are part of the system.** Synthetic tests run without a camera or model download. Keep all earlier tests green. Honor 30 fps render targets, separate model schedules, full keyboard access, visible focus, and reduced motion. Do not pad code to meet the 5,000–7,000-line target; implement the full architecture and report actual size against the requested target.

## Final acceptance run

Re-run the entire deterministic suite on the final commit; replay all five scenarios; check JSON round-trips, zero idle emission, zero unwarranted reveals, visibility budget, consent revocation/veto/expiry, contrast refusals, dimming capability modes, and keyboard operation. Inspect exact model dependencies and data handling. Report real-model, camera, and physical-hardware checks separately from synthetic evidence.

Fix reproducible defects and rerun relevant checks plus the full suite. Publish a final acceptance report and README status that distinguish implemented, verified, and blocked requirements. Verify commit attribution. Deliver the complete final HTML as required by Stage 19 and link the exact final repository commit. Do not declare the system done if a required gate remains unmet.
