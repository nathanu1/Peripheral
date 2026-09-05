# Peripheral

An on-device visual-assistance prototype for smart glasses. Information belongs to the object it describes and appears only when a deliberate action or real-world event warrants it. At rest, the wearer-facing interface emits nothing.

## Run

Open `index.html` directly in a browser. No installation or build is required.

Open **Debug console → Run Tests**, or append `#test` to the page address to run the same suite automatically. Developer controls are separate from the wearer’s view.

To run the tests without a browser, camera, or model download:

```sh
node tests/run.mjs
```

An optional local preview is available with `npm run dev`. It uses Node’s built-in HTTP server and has no dependencies.

## Status

The foundation is implemented: a single-file shell, separate world/additive/subtractive canvas layers, a DOM-free test harness, and keyboard-accessible debug controls. The suite currently has **28 passing assertions**.

Camera input, synthetic scenes, perception, and assistance behaviors are upcoming. The empty view is intentional at this stage. It is a browser prototype, not a validated wearable device.

## Design

- Process perception on device; keep frames off servers.
- Reveal information only for dwell, explicit summons, safety events, or scheduled requests.
- Anchor information to the world and let every reveal expire.
- Label measured, inferred, and scripted information honestly.
- Keep social memory limited to enrolled contacts, with revocation and bystander veto.
- Distinguish emitted light from physical dimming capabilities.

## License

[MIT](LICENSE).
