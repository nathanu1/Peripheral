# Build workflow

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

- Read `.github/peripheral/brief.md` in full for the original product requirements, tests, gates, commit messages, and output protocol.
- Read `.github/peripheral/state.json`, the current repository tree, and the latest commits on every run.
- Start at the earliest incomplete numbered stage. Verify the preceding checkpoint against the actual code and test evidence.
- Keep the existing repository and license. Never initialize a replacement repository or rewrite history.
- At each successful stage, commit implementation, new tests, `.github/peripheral/reports/stage-NN.md`, and updated `.github/peripheral/state.json` together. Record stage completion only when all tests and its gate actually pass.
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

## Repository presentation

Stage reports are delivered in the build conversation. Durable checkpoints, the original brief, and detailed test evidence live here under `.github/peripheral/`. Keep the root README focused on the product and usage. Use the specified conventional feature-oriented commit messages; do not include phrases such as "under Nathan", contributor announcements, or assistant narration in commit titles. Git metadata provides authorship. Preserve existing history. AI engineering assistance is disclosed in internal stage reports.

## Pretrained visual interpretation — approved extension, 2026-09-07

Use pretrained models to generalize beyond scripted object examples. Preserve the one-file browser target, on-device processing, original model stack, stage sequence, consent, warrant policy and automatic expiry. No VLM response may directly paint a reveal or establish unobservable smart-object state.

### Model choices and revision candidates

Primary model cards and upstream revisions checked on 2026-09-07:

| Model | Exact upstream revision | Role |
| --- | --- | --- |
| [SmolVLM-256M-Instruct](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct) | `7e3e67edbbed1bf9888184d9df282b700a323964` | First browser image-question adapter; official model card lists Apache-2.0 and ONNX support |
| [SmolVLM2-500M-Video-Instruct](https://huggingface.co/HuggingFaceTB/SmolVLM2-500M-Video-Instruct) | `7b375e1b73b11138ff12fe22c8f2822d8fe03467` | Evaluate short temporal sequences; Apache-2.0 |
| [Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) | `15852e8c16360a2fea060d615a32b45270f8a8fc` | Larger comparison model; Apache-2.0; browser deployment not established |

These are model choices, not implemented features or proven runtime compatibility. Before loading any model, pin its actual browser conversion repository, immutable revision, quantization, processor/tokenizer and runtime versions. Verify artifact licenses/hashes, disable library persistent caches, and measure memory and latency. Upstream model revision alone does not pin a third-party conversion. No cloud inference or local server is introduced into the product; native/desktop comparison remains a separate future evaluation path.

### Stage assignments

- **Stage 4:** finish pure dwell and cancellation. No VLM dependency in deterministic tests.
- **Stage 5:** retain real EfficientDet object detection and OCR preparation. Add the SmolVLM on-device adapter with explicit load/unload, runtime capability checks and developer-only crop/question smoke testing. Unsupported VLM runtime is a reported block, not a fake response. Do not replace detection or OCR with language-model guesses.
- **Stages 6–8:** retain optical flow, tracking, embeddings and depth. Crops for interpretation reference stable anchor IDs and observation timestamps. Reject responses for departed or rebound objects.
- **Stage 9:** keep Tier 3 scripted facts separate from image-derived interpretations; preserve spatial recall provenance and expiry.
- **Stage 10:** implement `interpret(region, question, recentObservations)` and validated evidence-bound results: request ID, anchor ID, observation time, model revision, tier 2, answer, supporting observations and abstention reason. Confidence is an evaluated estimate, never an invented percentage. Add dwell-triggered OCR, semantic entity binding, ambiguity refusal and activity proposals. Evaluate SmolVLM2 on actual temporal inputs before claiming video understanding.
- **Stages 11–12:** only valid dwell/summon/safety/scheduled policy can admit a result. Treat observed text and model output as untrusted data. Enforce freshness, consent, output bounds and expiry. A VLM alone cannot create a safety warrant or override policy. Unknown/ambiguous outputs remain silent or show a requested uncertainty response under a valid warrant.
- **Stages 18–19 and final acceptance:** retain all five deterministic scenarios and add a consented/licensed held-out evaluation set for image questions, unreadable labels, ambiguous objects and false completion claims. Report answer correctness, unsupported claims, abstention, tail latency, dropped render frames, memory and sustained device performance. Mocked outputs validate policy only; real model quality requires actual inference.

### Scheduling and scale

Use an independently scheduled, single-flight inference adapter. Run visual interpretation on a warranted request or selected task event, never every render frame. Drop obsolete work, cap crop size/context/output tokens, and invalidate results on camera/session/anchor changes. Keep output memory-only with explicit JSON textarea export/import. No arbitrary URL fetching, tool execution or telemetry from model answers. Select model tiers by measured device capability and task quality; no automatic network escalation.

## LocateAnything-3B grounding direction — 2026-09-07

Nathan requests NVIDIA LocateAnything-3B and Parallel Box Decoding as the grounding foundation. This supersedes the generic VLM preference for localization; broader interpretation still needs separate evaluation. This is a research candidate, not an implemented or commercially cleared dependency.

Primary sources checked: [NVIDIA project](https://research.nvidia.com/labs/lpr/locate-anything/), [model card](https://huggingface.co/nvidia/LocateAnything-3B), and [license](https://huggingface.co/nvidia/LocateAnything-3B/blob/c32291ca5e996f5a7a485845b4f57a233936bba0/LICENSE). Upstream model revision: `c32291ca5e996f5a7a485845b4f57a233936bba0`.

Two unresolved adoption gates:
- The NVIDIA license section 3.3 limits use and intended use to non-commercial research/evaluation. The card additionally describes academic/nonprofit research and lists Qwen Research and MIT component licenses. Do not label this release permissively open source, bundle it under Peripheral's MIT license, or adopt it as a commercial scaling dependency without appropriate rights.
- Official instructions use custom Python/Transformers/PyTorch generation and GPU-oriented execution. No compatible browser implementation preserving PBD has been verified. A normal autoregressive ONNX export is not proof of PBD support. Preserve the single-HTML/no-backend/no-frame-upload requirements; do not silently introduce a Python server.

Stage 5 must investigate a browser-compatible research adapter before runtime adoption. Verify preprocessing, tokenizer, coordinate scaling, multi-token box generation and Hybrid fallback parity with a pinned upstream reference. Until licensing and runtime gates are resolved, record LocateAnything unavailable; retain the required browser detector and never substitute synthetic outputs as live evidence. Do not automatically download restricted weights.

Proposed adapter contract: ground(frame, query, frameId, capturedAt) returns labeled boxes or an explicit unavailable/abstain result, with model revision, source provenance, coordinate space, decoding mode and completion time. PBD predicts coordinates within each geometric unit together; it does not imply every object in a scene is decoded in one pass. Prefer Hybrid after validating its fast-path fallback.

Stages 6–7 associate these observations with stable tracks. Stage 10 binds a request such as “the red mug beside the laptop” to current evidence and an anchor; detection does not establish ownership, contact identity, metric depth or user intent. Stages 11–12 retain sole control over warrants and expiry. Schedule grounding on explicit requests and meaningful scene changes with one in-flight job; drop obsolete results. It must not drive the display loop or bypass bystander veto.

Acceptance requires actual positive/negative images, ambiguous and crowded scenes, box-coordinate and crop transforms, no-match behavior, stale cancellation, decoding-mode parity, peak memory and measured latency on target hardware. Synthetic tests verify adapter policy only. No live LocateAnything inference or browser performance claim has passed.

AI assistance: source review and this integration decision were prepared at Nathan's direction. No application code or numbered-stage progress changes in this follow-up.
