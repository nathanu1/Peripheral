# Peripheral: working agreement for Claude Code

Peripheral is an on-device visual-assistance prototype for smart glasses, built as one self-contained `index.html`. It is built in numbered stages, each one test-first, and it is strict about not claiming more than the evidence shows.

## Read these before changing anything

1. `.claude/lessons.md`: rules this project learned the hard way. Apply them.
2. `.github/peripheral/state.json`: which stage is next and what is blocked.
3. `.github/peripheral/plan.md`: the build workflow, amendments and required engineering decisions.
4. `.github/peripheral/brief.md`: product requirements, the stage table, gates and commit messages.

`plan.md` and `brief.md` are the source of truth. If this file disagrees with them, they win, and this file should be fixed.

## Rules that are easy to break

- **One HTML file.** One `<style>`, one `<script>`, no build step, no external application script. `tests/run.mjs` fails the suite otherwise.
- **Tests first.** Write the failing assertions, save the red evidence, then implement. A stage ends with the whole suite green, not only its own tests.
- **Never weaken a test to make it pass.** If a test is wrong, stop and say why.
- **One stage per run, in order.** Start at the earliest incomplete stage. Do not skip a failed or unverified gate.
- **Measured, inferred and scripted stay distinct.** Synthetic and prerecorded input never carries a live perception tier. A real-model gate passes only when the real model actually ran.
- **Pure core, thin shell.** Anything between `CORE BEGIN` and the shell must not touch the DOM, clock, network or random source.
- **No browser storage, no backend, no frame uploads.** Models load from exact pinned versions with verified hashes.
- **Report limits honestly.** If something could not be run or seen (browser rendering, a camera, a model download), write "unverified" and say what would verify it.

## Commands

```sh
npm test                       # full suite: inline app tests, camera-companion checks, geometry gate (about 3 seconds)
node tests/run.mjs out.json    # inline suite only, writing evidence JSON
npm run dev                    # local preview on http://localhost:5173
```

## Commits

Use the commit message the brief gives for the stage. Author commits as `nathanu1 <129923698+nathanu1@users.noreply.github.com>`, set for this repository only. Disclose AI assistance in the stage report and commit trailers, not in commit titles. Never rewrite history or force-push.

## The agent system in this repository

Four layers, each one a folder here. `.claude/README.md` has the day-to-day guide.

| Layer | What it is | Where |
| --- | --- | --- |
| Agents | Three specialists with separate contexts: `test-author`, `stage-builder`, `gate-verifier` | `.claude/agents/` |
| Loops | `/build-stage` runs one stage red to green; a Stop hook reruns the suite before a turn can end; `/repair-until-green` fixes a broken suite | `.claude/skills/`, `.claude/hooks/`, `.claude/workflows/` |
| Graphs | `/audit-stage` and `/review-changes` fan work out to parallel agents and check each finding with a second agent | `.claude/workflows/` |
| Self-improvement | `/retro` turns evidence from recent work into new entries in `.claude/lessons.md`, which every agent reads first | `.claude/workflows/retro.js`, `.claude/lessons.md` |

If you must end a turn while tests are failing on purpose (a blocked stage), start your final message with `BLOCKED:` and explain. The Stop hook lets that through.
