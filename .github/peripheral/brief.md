## THE PRODUCT

PERIPHERAL is a visual-assistance system for smart glasses that is **invisible by default**. It runs continuous on-device computer vision over the wearer's field of view, understands what they are looking at and what they are doing, and surfaces digital information anchored to real surfaces — but only when a real-world trigger or a deliberate gaze gesture warrants it. At rest it emits zero light. It is not an app you open. It is a layer that stays out of the way until the world gives it a reason.

Five behaviors define it:

1. **Object state at a glance.** Dwell on the coffee maker and a small translucent checkmark confirms the brew finished. Dwell on the front door and a lock glyph confirms it's secured. No app, no phone, no menu — the object answers for itself.
2. **Spatial wayfinding.** A faint line drawn onto the actual sidewalk traces the route to the subway. When the train is delayed, a soft pulse enters upper-peripheral vision *before* arrival and the line reroutes toward a rideshare pickup.
3. **Social memory.** You meet a neighbor. A small text anchor floats briefly above their shoulder — *"Sarah (Apt 4B) — asked about your dog last Tuesday"* — and fades after three seconds. It resolves social friction without the indignity of looking at a phone.
4. **Subtractive attention management.** In a loud, over-lit grocery store, the system *dims the visual chaos* through electrochromic tinting and softly lights the items on your list where they sit on the shelf. It does not only add information. It removes noise.
5. **Spatial recall.** It remembers where things are and what you already did, so you don't have to.

The organizing idea: this is a **cognitive prosthetic**, and the measure of a prosthetic is not how much it does but how little you notice it doing it.

---

## THE THESIS, STATED AS AN INVARIANT

> **At rest, the system emits nothing.**

This is not an aspiration. It is a testable invariant, and you will write the test for it in Stage 12:

```
assert(totalEmittedLuminance(state.atRest) === 0)
```

Not "minimal." Not "subtle." **Zero.** No status bar, no battery glyph, no idle clock, no ambient dot, no breathing indicator. Every screen-based product fails this test by construction; that failure is the thing PERIPHERAL exists to correct.

From it follows the system's primary metric, which you will build in Stage 12 and display permanently thereafter:

**Visibility duty cycle** — the fraction of wall-clock time any pixel is lit. Target: **under 2%**. A well-behaved hour is roughly seventy seconds of visible interface. Show the running figure. Show the projection to a full day. If a feature pushes it over budget, that feature is wrong, and the system should say so rather than quietly accommodating it.

---

## SEVEN LAWS

**L1 — Nothing appears without a warrant.** Every reveal carries exactly one of: `dwell` (the wearer deliberately looked), `summon` (explicit gesture or voice), `safety` (a hazard the wearer has not seen), or `scheduled` (something they asked for in advance). There is no fifth warrant. An engagement warrant does not exist. Content with no warrant is a bug, and the trigger engine must refuse to render it.

**L2 — Reveals decay on their own.** Everything that appears schedules its own death at birth. Nothing waits to be dismissed. If the wearer must take an action to make something go away, it should not have appeared.

**L3 — Anchor to the world, not the frame.** Information belongs to the object it describes. The lock glyph lives on the door. The checkmark lives on the coffee maker. Screen-locked chrome is forbidden outside the peripheral alert channel, which is reserved for `safety` and `scheduled` warrants only.

**L4 — Black does not exist; dimming does.** See-through optics are additive — light is added to the world, never subtracted per pixel. There is no opaque panel, no scrim, no drop shadow. But **global and zoned electrochromic tinting is real, shipping-plausible hardware**, and it is the one legitimate way to subtract. Model the two as distinct capabilities and never let the renderer conflate them. Contrast is earned either by out-emitting the background or by dimming it — never by faking occlusion.

**L5 — Degrees, not pixels.** Every position and size in the model is stored in degrees of visual angle. Pixels appear only at the final paint. Pixels are a hardware accident; degrees are the human constant.

**L6 — Perception is tiered and the tiers are labeled.** Everything the system claims to know is tagged with how it knows: measured on-device, inferred with a confidence, or stubbed. This tagging is visible in the debug view and never erased. A system that presents a guess with the same confidence as a measurement is lying to its wearer.

**L7 — The bystander is a party to the interaction.** The person in front of the wearer has interests — privacy, eye contact, and knowing when a camera is live. They are modeled, and they can veto.

---

## THE PERCEPTION CONTRACT

The honest core of this build. Everything the system knows enters through one of three tiers, and every fact carries its tier as a first-class field.

### Tier 1 — Measured on-device, now

Real computer vision running on real frames. No excuses, no stubs.

- Head pose and view center
- Eye landmarks and iris position, where a user-facing camera is available
- Hand landmarks and gestures
- Object detection with bounding boxes and class labels
- Text detection and recognition
- Optical flow, motion, scene luminance, scene clutter

### Tier 2 — Inferred, with a confidence

Real computation, approximate output. Every value carries a confidence in [0,1] and the UI must never render a Tier 2 fact as though it were Tier 1.

- Monocular depth
- Surface planes and normals for anchoring
- Object re-identification across frames and across occlusion
- Activity and task-step inference from hands plus objects plus motion

### Tier 3 — Stubbed behind an interface

Things a camera cannot know. These are **not faked inline** — each is a named interface with a scriptable implementation and a comment stating exactly what real integration would replace it.

- Smart-object state (`CoffeeMaker.brewComplete`, `FrontDoor.locked`) — real version: Matter/Thread or a vendor API
- Transit and routing (`Transit.delay`, `Route.path`) — real version: a transit API
- Person identity and relationship memory — real version: **opt-in enrolled contacts only**, see the privacy section
- Calendar, reminders, list contents

Build a `WorldModel` that holds Tier 3 state on a scriptable timeline, so scenarios play deterministically and every stub is visibly a stub.

---

## THE MODEL STACK

All of the following are free, permissively licensed, run entirely on-device, and require no API key and no per-call cost. **There is no cloud inference in this system.** That is not only a cost decision: a device that continuously watches everything its wearer sees and ships those frames to a server is not defensible, especially one that recognizes the people in front of it. On-device is the only architecture this product can honestly have. Say so in the README you write at Stage 19.

| NeedLibraryModelNotes        |                                                          |                                      |                                                                                                                              |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Head pose, iris, blendshapes | `@mediapipe/tasks-vision`(Apache-2.0)                    | Face Landmarker                      | 478 landmarks, iris included; `outputFacialTransformationMatrixes: true` gives the head-pose matrix you need for view center |
| Hands and gestures           | `@mediapipe/tasks-vision`                                | Hand Landmarker, Gesture Recognizer  | 21 landmarks per hand; the pinch-summon gesture comes from here                                                              |
| Object detection             | `@mediapipe/tasks-vision`                                | Object Detector (EfficientDet-Lite0) | Lite0 for speed, Lite2 if the frame budget allows                                                                            |
| Segmentation                 | `@mediapipe/tasks-vision`                                | Image Segmenter                      | Needed for clean dim-mask boundaries in Stage 15                                                                             |
| Re-identification            | `@huggingface/transformers`(transformers.js, Apache-2.0) | CLIP or SigLIP image embeddings      | Cosine similarity on crops is what lets an anchor survive leaving the frame                                                  |
| Monocular depth              | `@huggingface/transformers`                              | Depth Anything V2 Small              | WebGPU where available; this is your Tier 2 depth                                                                            |
| OCR                          | `tesseract.js` (Apache-2.0)                              | —                                    | Text in the world; slow, so run it only on dwell                                                                             |

Load from a CDN (jsDelivr or cdnjs), pinned to exact versions. First load needs network; after that it is cached and the system runs offline.

**Frame budget — this is where naive builds die.** Do not run everything every frame. Target 30 fps for the render loop and schedule perception underneath it:

| TaskRate                                   |                    |
| ------------------------------------------ | ------------------ |
| Render, gaze, dwell, optical-flow tracking | every frame        |
| Object detection                           | 5–8 Hz             |
| Depth                                      | 1–2 Hz             |
| Embeddings (re-ID)                         | on new anchor only |
| OCR                                        | on dwell only      |

Run inference in a worker where the library allows it. Build a visible FPS and per-stage latency readout in Stage 1 and never let it leave the debug view — you will need it every stage after.

---

## THE GAZE PROBLEM, AND THE HONEST ANSWER

You are building for glasses but developing on a laptop or phone, and the cameras point opposite ways. Resolve it with one interface and two implementations rather than pretending the problem away.

```
GazeSource → { originDeg, directionDeg, confidence, tier }
```

- **`HeadGazeSource`**** (default).** World-facing camera; gaze is the center of view derived from head pose. Dwell means holding an object near view center. This is not a compromise — **most shipping smart glasses have no eye tracking at all**, so head-gaze dwell is the realistic interaction, and the 1.5 s dwell works identically.
- **`EyeGazeSource`**** (upgrade).** User-facing camera; real iris tracking via Face Landmarker onto a simulated world view. Higher precision, and the path forward as eye tracking reaches shipping hardware.

Make the active source visible in the UI at all times. A dwell driven by head pose and a dwell driven by the fovea are different interactions, and the wearer should never be confused about which one they are performing.

---

## DWELL, SPECIFIED PRECISELY

The core gesture. Get it wrong and the whole system feels either deaf or twitchy.

- **Threshold: 1,500 ms** `[model]` — configurable, and note in the comment that this is a design choice, not a measured constant
- **Angular tolerance:** the target must stay within a small cone; natural microsaccades and head tremor must not break it
- **Hysteresis:** a brief excursion outside the cone does not reset the timer — decay it instead of zeroing it, or the interaction feels broken on real, jittery human heads
- **Progress must be invisible.** No filling ring, no countdown. Progress indication would violate the zero-at-rest invariant, and it teaches the wearer to stare at a widget instead of at the world. The first thing they see is the answer.
- **Cancel on saccade:** a large fast gaze departure cancels immediately rather than decaying
- **Refractory period:** the same anchor cannot re-trigger for a few seconds after its reveal decays, or you get flicker loops

Write the dwell state machine as a pure function of (gaze samples, time) and test it against synthetic gaze traces — steady, jittery, interrupted, saccading away. Do not test it by staring at your webcam.

---

## PRIVACY: THE SOCIAL ANCHOR

The "Sarah (Apt 4B)" behavior is the most valuable feature in this system and the most dangerous. Build it correctly the first time.

**Do not build open-set face recognition.** No identifying strangers, no matching against a scraped or broad gallery, no biometric enrollment of anyone who has not agreed. Beyond the ethics, face templates are regulated biometric data under Illinois BIPA, Texas CUBI, and the GDPR, and this is precisely why major smart-glasses vendors have declined to ship the feature.

**Build opt-in mutual enrollment instead.** A person becomes recognizable only by explicitly enrolling themselves, the enrollment is revocable, and it is scoped to the wearer who holds it. In the demo, identity resolution lives in **Tier 3**, backed by the scriptable `WorldModel` and a small set of consented contacts — not by live face search.

This is a better product, not a watered-down one. Open-set recognition of strangers is a feature no one can ship, no one can defend, and no one wants used on them. Mutual enrollment is the version that could actually exist, and the social contract it encodes — *I can see you because you let me* — is worth more than the capability it gives up.

Also model, and test:

- **Bystander veto:** an enrolled person can set themselves invisible, and the system honors it
- **Camera-active indicator:** an outward-facing signal whenever the camera is recording, verified present
- **Eye-contact protection:** the social anchor must never occupy the region where a conversation partner's eyes are — anchor to the shoulder, never the face
- **Retention:** relationship notes expire by default; show the expiry

---

## THE RENDERER: TWO CHANNELS

Keep these architecturally separate. Conflating them is the most common and most consequential mistake in AR rendering.

### Additive channel — emitting light

Composites additively over the world. Contrast is measured against the *sampled live background under each element*, never against an assumed backdrop. If contrast falls below threshold, the element must either brighten, move, or refuse to render — never render illegibly and hope.

### Subtractive channel — electrochromic dimming

Physical tinting that reduces incoming world light. On canvas: a dark layer, `destination-out` punch-throughs at protected regions, then additive glow on targets. Visually striking, and it demonstrates the actual idea.

**But model its resolution honestly.** Real electrochromic panels are global or coarsely zoned, not per-pixel. Expose `dimmingResolution` as a first-class capability with a marked "today" tick:

| LevelDescriptionAvailability |                                   |                |
| ---------------------------- | --------------------------------- | -------------- |
| `global`                     | One tint value for the whole lens | Shipping today |
| `zoned-4x4` / `zoned-8x8`    | Coarse regional control           | Near-term      |
| `per-pixel`                  | True hard-edged occlusion         | Speculative    |

The grocery-store scenario is the test case. At `global`, you can only dim everything and out-emit your targets. At `zoned-8x8`, you get soft regional focus. At `per-pixel`, you can cut a clean silhouette around the cereal box. **Building all three and letting the user switch between them is the most instructive interaction in the system** — it shows exactly what the idea costs in hardware, and it keeps the speculation tethered to something real.

---

## HARDWARE PROFILE

Every design carries the hardware it assumes. Seed one `CONSTANTS` object; tag every entry `[established]` (a real fact, source named) or `[model]` (a choice this system is making). Never let a modeling assumption pass as a measurement, in code or in UI.

**Calibration fixture — shipping hardware, 2026.** Use Meta Ray-Ban Display: 600 × 600 monocular right-eye display, 42 pixels per degree, 30–5,000 nits, 90 Hz panel with 30 Hz content, under 2% outward light leakage, sEMG wristband and voice input, no eye tracking. `[established]`

**A contradiction you will hit in Stage 2, and it is real:** 600 px at 42 PPD spans **14.3°**, not the advertised 20°. The reconciliation is that 20° is the *diagonal* (14.3 × √2 ≈ 20.2). Store FOV as an explicit `{horizontalDeg, verticalDeg, diagonalDeg}`triple and never let a bare scalar "FOV" circulate — half the published specs in this industry quote diagonal and half quote horizontal, and mixing them silently corrupts every downstream calculation.

**Human vision.** Binocular FOV ≈ 200–220° horizontal, 130–135° vertical. High-acuity fovea ≈ central 2°. 20/20 resolves ≈ 1 arcminute, a ceiling near 60 PPD. Ambient illuminance: interior \~100–500 lux, overcast \~1,000–10,000 lux, direct sun \~100,000 lux. Motion-to-photon above \~20 ms breaks world-lock. `[established]`

**Minimum legible cap height ≈ 0.4–0.5° of visual angle** `[model]` — enforce it; the "tiny checkmark" must still be legible at its anchor's eccentricity or it is decoration.

---

## CONSTRAINTS

1. **One HTML file.** All CSS in one `<style>`, all JS in one `<script>`. No build step, no framework, no bundler.
2. **CDN allowed for models only** — pinned exact versions. No analytics, no telemetry, no backend, no API keys. Frames never leave the device.
3. **No browser storage.** No `localStorage`, `sessionStorage`, or IndexedDB — the file must behave identically in sandboxed previews that block them. State is in memory; persistence is JSON import/export through a textarea.
4. **Pure core, thin shell.** All perception fusion, dwell logic, trigger policy, anchoring math, and scoring live in pure functions with no DOM access. If a function needs `document` to compute a number, it is in the wrong layer. This is what makes the system testable without a camera.
5. **Graceful without a camera.** If `getUserMedia` is denied or unavailable, fall back to a synthetic scene generator so every stage stays demoable and every test stays runnable. Build this in Stage 1, not as an afterthought.
6. **Accessible.** Full keyboard operation, visible focus, ARIA on custom controls, `prefers-reduced-motion` honored. An assistive system that is itself inaccessible is self-refuting.
7. **Target \~5,000–7,000 lines.** Under 3,000 by Stage 19 means you built a demo instead of a system.

---

## THE TEST HARNESS

Build it first, in Stage 0. It is the spine of every stage after.

```
T.suite(name, fn)
T.eq(actual, expected, msg)
T.approx(a, b, tol, msg)
T.true(cond, msg)
T.throws(fn, msg)
T.run()   // → {passed, failed, results[]}
```

- Runs on `#test` in the URL and from an always-reachable **Run Tests** button in the debug drawer.
- Renders pass/fail counts and every failure with message, expected, and actual.
- **Stage 0 includes one deliberately failing assertion**, proving the runner reports failures rather than swallowing them. Remove it at the end of Stage 0 and note the removal.
- **Perception is mocked in tests.** Every test feeds synthetic detections, synthetic gaze traces, and synthetic frames into pure functions. No test requires a camera, a model download, or a human. A suite that needs someone to look at a coffee maker is not a suite.
- **Every stage writes tests before implementation, and ends with the *****full***** suite green** — not just its own. A stage that breaks an earlier test is not finished.

---

## THE 20 STAGES

Each stage: **write the failing tests → implement until green → verify the gate → commit.** If you have git, make a real commit with the given message. If not, print it as a header and treat the stage as a checkpoint.

| #StageTests firstGateCommit |                                      |                                                                                                                                                                   |                                                                                    |                                                              |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **0**                       | Skeleton, harness, module boundaries | Harness reports a deliberate failure; `T.approx` respects tolerance; `T.throws` catches                                                                           | Page loads, debug drawer opens, `#test` runs, deliberate failure seen then removed | `chore: skeleton and inline test harness`                    |
| **1**                       | Camera pipeline + synthetic fallback | Frame source emits at target rate; denied permission falls back cleanly; synthetic scene is deterministic by seed                                                 | Live webcam *or* synthetic feed renders, with visible FPS and latency readout      | `feat: frame pipeline with synthetic fallback`               |
| **2**                       | Geometry core                        | deg↔px round-trips at 42 PPD; 1 m object at 3 m ≈ 18.9°; FOV triple derives diagonal rather than storing it twice                                                 | Pure functions, zero DOM references                                                | `feat(core): angular geometry and FOV model`                 |
| **3**                       | GazeSource + head gaze               | Head-pose matrix → view center; confidence drops when the face is lost; source is swappable behind the interface                                                  | Reticle-free view center tracks head motion                                        | `feat(core): gaze source abstraction`                        |
| **4**                       | Dwell state machine                  | Steady 1.5 s trace fires once; jitter within tolerance does not reset; excursion decays rather than zeroes; saccade cancels; refractory blocks re-fire            | Pure, tested entirely on synthetic traces                                          | `feat(core): dwell detection state machine`                  |
| **5**                       | Object detection (Tier 1)            | Detections carry tier and confidence; below-threshold results are dropped; the 5–8 Hz schedule holds under a full render loop                                     | Real boxes on real frames without tanking frame rate                               | `feat(perception): tier-1 object detection`                  |
| **6**                       | Tracking + anchor identity           | IoU association is stable across frames; a Kalman step smooths jitter; optical flow bridges the gap between detections                                            | Anchors hold identity through brief occlusion                                      | `feat(perception): anchor tracking and association`          |
| **7**                       | Re-identification (Tier 2)           | Cosine similarity re-binds a departed anchor; a different object does not match; every re-ID carries a confidence                                                 | An anchor survives leaving and re-entering frame                                   | `feat(perception): embedding-based re-identification`        |
| **8**                       | Depth + surface estimation (Tier 2)  | Depth map arrives at the scheduled rate; plane normals are computed; anchors project onto surfaces rather than floating                                           | Overlays sit on things                                                             | `feat(perception): monocular depth and surface anchoring`    |
| **9**                       | WorldModel (Tier 3)                  | Scriptable timeline advances deterministically; every fact is tagged tier 3; unknown keys fail loudly rather than silently                                        | Smart-object state, transit, contacts — all visibly stubbed                        | `feat(core): scriptable world model`                         |
| **10**                      | Entity binding                       | A detected object resolves to a world-model entity; ambiguity returns candidates rather than guessing; unresolved anchors stay silent                             | The coffee maker in frame binds to `CoffeeMaker`                                   | `feat(core): anchor-to-entity binding`                       |
| **11**                      | Trigger policy engine                | Each of the four warrants admits; a warrantless reveal is refused; the safety warrant preempts; the peripheral channel accepts only safety and scheduled          | Nothing renders without a warrant, provably                                        | `feat(core): warrant-based trigger policy`                   |
| **12**                      | Reveal lifecycle + duty cycle        | **At rest, emitted luminance is exactly 0**; every reveal schedules its own death; duty cycle computes correctly over a scripted hour; over-budget returns a fail | The invariant holds and the duty-cycle meter is live                               | `feat(core): reveal lifecycle and visibility duty cycle`     |
| **13**                      | Additive renderer                    | Contrast measured against sampled background; cap height below 0.4° is refused; an element that cannot reach contrast declines to render                          | The checkmark and lock glyph, anchored and legible                                 | `feat(render): additive world-anchored overlays`             |
| **14**                      | Subtractive renderer                 | `global` dims uniformly; `zoned-8x8` dims regionally; `per-pixel`cuts clean edges; the today-tick is marked `global`                                              | Switching dimming resolution visibly changes what is possible                      | `feat(render): electrochromic dimming with resolution tiers` |
| **15**                      | Selective salience                   | Target set is lit while background is dimmed; contrast gain is computed and reported; segmentation gives clean boundaries at per-pixel                            | The grocery-store behavior, working                                                | `feat: selective salience and noise suppression`             |
| **16**                      | Wayfinding                           | Path projects onto the ground plane and tracks head motion; peripheral alert fires before arrival; reroute recomputes and redraws                                 | Line on the sidewalk, pulse in the periphery, reroute on delay                     | `feat: ground-anchored wayfinding with peripheral alerts`    |
| **17**                      | Social anchor + consent              | Only enrolled contacts resolve; a revoked enrollment stops resolving; bystander veto is honored; the anchor never overlaps the eye region; notes expire           | The Sarah behavior, consent-gated end to end                                       | `feat: consent-gated social memory anchor`                   |
| **18**                      | Scenario runner                      | All five scenarios play deterministically start to finish; each round-trips through JSON export and import unchanged                                              | Coffee maker, front door, subway, Sarah, grocery store                             | `feat: scripted scenario runner`                             |
| **19**                      | Ethics panel, accessibility, README  | Camera indicator verified present; unwarranted reveals counted at zero; every control keyboard-reachable; no console errors on a full pass                        | Full suite green, whole system operable without a mouse, README written            | `feat: ethics panel, accessibility, and documentation`       |

---

## OUTPUT PROTOCOL

Per stage, respond with exactly:

1. **Stage N — [name]**
2. **Tests** — the new assertions as code, written before the implementation exists
3. **Implementation** — a precise diff or clearly-marked insertion against the current file. Do not re-emit the whole file each stage; by Stage 10 that spends the entire response on unchanged lines.
4. **Test results** — passed / failed, with any failure in full
5. **Perception tiers touched** — which of Tier 1 / 2 / 3 this stage added or changed
6. **Gate** — one sentence on whether it is met
7. **Commit** — the message
8. **Next** — one line

Then **stop and wait.** Do not begin the next stage until told to continue.

At Stage 19, emit the complete final file. If it exceeds your output limit, split across consecutive messages at a clear boundary, ending each part with `<!-- CONTINUES -->` — never abbreviate with an elision or a `// ... rest unchanged` marker.

*(If you are an agentic tool that can execute code and run the suite yourself, you may run stages consecutively — but still emit the full report per stage, and still stop if a gate fails rather than proceeding on a broken suite.)*

---

## ANTI-PATTERNS

- **A HUD wearing a costume.** If information ends up in fixed screen corners, you built a heads-up display and deleted the entire idea. Outside the peripheral alert channel, everything anchors to the world.
- **Idle chrome.** A battery glyph, a clock, a connection dot, a "ready" indicator — any of these breaks the zero-at-rest invariant. There is no acceptable idle pixel.
- **Dwell progress rings.** They teach the wearer to look at a widget instead of the world, and they violate the invariant. The first thing the wearer sees is the answer.
- **Faking Tier 3 inline.** Never hard-code `if (object === 'coffeemaker') showCheckmark()`. It must route through the `WorldModel`interface, or the demo is a puppet show and you have learned nothing about the architecture.
- **Confidence laundering.** A Tier 2 inference rendered with the same visual weight as a Tier 1 measurement is the system lying to its wearer. Tier must be visible in debug and must modulate presentation.
- **Open-set face recognition.** Do not build it. Enrolled contacts only.
- **Testing by staring at your webcam.** Every test runs on synthetic input. If the suite needs a human and a coffee maker, it is not a suite.
- **Running everything every frame.** The frame budget above is not a suggestion. A system at 6 fps is not an assistive device, it is a nausea generator.
- **Per-pixel dimming at the ****`global`**** tick.** Cutting a clean silhouette on hardware that can only tint the whole lens is the exact species of dishonesty this build is structured to prevent.

---

## DEFINITION OF DONE

One HTML file, opened with a camera, that sits **completely dark** until the world gives it a reason. Dwell on an object and its state answers, anchored to it, then fades on its own. Walk a route and see it drawn on the ground, rerouting when the world changes. Meet an enrolled contact and get the one line you needed, above their shoulder, gone in three seconds. Step into visual chaos and watch it dim while what matters lights up — with a switch that shows you honestly how much of that is possible on today's hardware and how much is still waiting on the glass.

And a duty-cycle meter, running the whole time, proving the thing stayed out of the way.

Begin with **Stage 0**.