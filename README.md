# Peripheral

A calm perception overlay for phone cameras. You point the camera at the world and the
screen stays clear until you ask. Then it shows the least it can: one label, anchored to
the object you meant. Give it a list and it dims everything that isn't on it.

**Status: milestone 0 (skeleton).** The monorepo, tooling and design tokens are in place.
The camera, perception, Ask and Focus mode arrive in milestones 1 to 7.

## Run it

Needs Node 22+ and pnpm 10.

```bash
pnpm install
```

```bash
pnpm dev
```

This starts the web app on `https://localhost:5173` and the API server on
`http://localhost:8787`. The terminal also prints a **Network** URL such as
`https://192.168.1.20:5173/`. Open that on a phone on the same Wi-Fi. The certificate is
self-signed, so the browser warns once; choose to continue. HTTPS is required because
phones only expose the camera to secure pages.

For Ask (milestone 4), copy `apps/server/.env.example` to `apps/server/.env` and add an
Anthropic API key. The key stays on the server.

| Command          | What it does                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `pnpm dev`       | Web app (HTTPS, LAN) and API server, both with reload             |
| `pnpm test`      | Vitest unit tests in every package, then the legacy suite         |
| `pnpm e2e`       | Playwright in Chromium with a fake camera, plus axe on each route |
| `pnpm lint`      | ESLint                                                            |
| `pnpm typecheck` | `tsc` in every package (`strict: true`)                           |
| `pnpm build`     | Production build of the PWA                                       |

## Layout

```
apps/web/          Vite + React 19 PWA
  src/app/         routes: / (camera), /bench, /about, /settings
  src/design/      tokens.css (Tailwind v4 @theme), motion.ts (spring presets)
  src/{camera,perception,tracking,policy,overlay,voice,store,bench}/   filled in by M1 to M7
apps/server/       Hono: POST /api/ask (validated stub until M4)
packages/shared/   zod schemas and types shared by web and server
e2e/               Playwright tests and fixtures
legacy/            the earlier single-file prototype, kept with its own tests
```

Perception, policy and rendering stay separate so the overlay can move to smart glasses
later. ESLint enforces one part of this: nothing in `overlay/` may import from `perception/`.

## Design rules

**Reveal policy**

1. Looking or hovering never reveals anything. Only press-and-hold or a tap does.
2. At most 3 labels and 1 open card. Extra matches get an outline only.
3. A label is placed once and moves only if a better spot holds for 500 ms.
4. A label never covers another object. With no room, it sits outside with a leader line.
5. Labels sit beside the object, at least 24 px clear of it on a phone.
6. Tap outside, swipe down, or 8 s of no interaction dismisses, in 0.2 s.
7. Low confidence always reads "Possibly …", never a bare claim.
8. People and faces are never labelled, matched, sent or dimmed.

**Design system** (`apps/web/src/design/`)

- Legibility comes from the dark label plate, not from text color. Color appears only on
  small dots, glyphs and whole plates, and never carries meaning alone.
- Glass is for floating controls only. Never on labels, never glass on glass.
- Labels are 17 px semibold; nothing is smaller than 11 px; all sizes are in `rem`.
- Motion uses springs. A label materializes in place and its text never moves while it is
  being read. Reduced Motion swaps everything for 150 ms cross-fades.
- Touch targets are at least 44 px.

## Numbers

Measured on real runs only. Detector and device numbers will be filled in from `/bench`
in milestone 2.

| Metric              | Target         | Measured (M0)                             |
| ------------------- | -------------- | ----------------------------------------- |
| Initial JS, gzipped | under 250 KB   | 115 KB (entry 70 KB + camera route 45 KB) |
| Label text on plate | at least 4.5:1 | 12.1:1 over a white frame                 |

## Licenses

The code in this repository is MIT licensed. Milestone 2 benchmarks two detectors: YOLO26n,
which is AGPL-3.0, and an Apache-2.0 alternative. If YOLO26 ships as the default, this
repository must stay open source under terms compatible with AGPL-3.0; that choice will be
made and recorded here once the numbers are in.
