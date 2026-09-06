# Peripheral

An on-device visual-assistance prototype for smart glasses. Information belongs to the object it describes and appears only when a deliberate action or real-world event warrants it. At rest, the wearer-facing interface emits nothing.

## Run

Open `index.html` directly in a browser. No installation or build is required.

Open **Debug console → Run Tests**, or append `#test` to the page address to run the same suite automatically. Developer controls are separate from the wearer’s view.

The feed starts with a deterministic synthetic test pattern. Use **Scene seed → Reset scene** to reproduce a scene, **Freeze synthetic motion** to pause its motion, or **Stop feed** to clear it. The synthetic feed respects reduced-motion preferences.

Select **Use camera** to request video only. Camera access requires a supported browser and secure context (HTTPS or localhost); denial, unavailable input, and timeout return to synthetic input. Switching to synthetic, stopping the feed, or hiding the page releases camera tracks. Select a source to resume after returning to the page.

To run the tests without a browser, camera, or model download:

```sh
node tests/run.mjs
```

An optional local preview is available with `npm run dev`. It uses Node’s built-in HTTP server and has no dependencies.

## Status

Implemented: a single-file shell, separate world/additive/subtractive canvas layers, optional camera capture with synthetic fallback, deterministic frame scheduling, pixel brightness and neighboring-contrast proxies, angular geometry, and keyboard-accessible debug controls. The suite currently has **145 passing assertions**.

Geometry uses degrees for model positions and converts to pixels at an explicit paint boundary. It includes visual-angle calculations, display bounds, and an immutable horizontal/vertical/diagonal FOV triple. The nominal 600×600 / 42 PPD display fixture uses a uniform-angular approximation; it does not calibrate the camera or validate wearable optics. Its independent core check runs with `node tests/geometry-gate.mjs`.

The debug console reports actual processed FPS, missed frame slots, and capture, analysis, and paint-submission CPU time. These timings exclude sensor and display latency. Brightness and clutter are uncalibrated pixel proxies; synthetic input never carries a live-perception tier.

The synthetic feed and fallback were checked in Chrome. This test session observed approximately 1 FPS despite the 30 FPS scheduling target; sustained 30 FPS and live-camera performance remain unverified. Assistance overlays remain empty. Object models, gaze, world anchoring, and assistance behaviors are upcoming. This is a browser prototype, not a validated wearable device.

## Design

- Process perception on device; keep frames off servers.
- Reveal information only for dwell, explicit summons, safety events, or scheduled requests.
- Anchor information to the world and let every reveal expire.
- Label measured, inferred, and scripted information honestly.
- Keep social memory limited to enrolled contacts, with revocation and bystander veto.
- Distinguish emitted light from physical dimming capabilities.

## License

[MIT](LICENSE).
