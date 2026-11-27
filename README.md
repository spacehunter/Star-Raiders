# Star Raiders (web remake)

A browser remake of **STAR RAIDERS**, the 1979 Atari 400/800 first-person space combat game, built with
Vite, TypeScript and Three.js.

The aim is to stay true to the original game and bend its rules only where a modern player needs it.
The remake is being overhauled in phases, and two documents drive that work:

| Document | What it is |
|---|---|
| [`docs/MANUAL_SPEC.md`](docs/MANUAL_SPEC.md) | **Source of truth.** The original manual and ROM, transcribed: rules, numbers, screens, messages. |
| [`docs/OVERHAUL_PLAN.md`](docs/OVERHAUL_PLAN.md) | Fidelity audit of the current code and the phased plan that brings it in line with the spec. |
| [`docs/reference/manual/`](docs/reference/manual/) | Photos of the printed manual and the reference screenshots. |

Where the code and the spec disagree, the spec wins. The current build does not match it yet; see the
audit in OVERHAUL_PLAN.md.

## Running

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and production build into dist/
npm test           # Vitest unit tests
npm run capture    # the 8 standard screenshots (see below)
```

## Controls (current build)

| Key | Action |
|---|---|
| Mouse | Steer |
| 0–9 | Engine speed |
| Space | Fire photon torpedo |
| F / A | Front / aft view |
| G | Galactic chart (arrow keys move the cursor) |
| L | Long-range scan |
| H | Hyperwarp to the chart cursor |
| S | Shields |
| T / M | Nearest / next target |

## Testing and debugging

- **Seeded RNG.** All randomness goes through `src/core/rng.ts`. Add `?seed=<n>` to the URL to replay a
  game exactly; without it each game gets a fresh seed.
- **Debug hook.** `?debug=1` exposes `window.__sr` in the browser console: `seed`, `state`,
  `start(difficulty, seed?)`, `galaxy()`, `teleport({x, y})`, `spawn(type)`, `setView(view)`,
  `step(n)`, `resume()`, `hyperwarp(x, y)`, `dock()`. See `src/core/debug.ts`.
- **Screenshots.** `npm run capture -- --seed 1979` starts Vite, opens the game in headless Chromium with
  a frozen clock and writes title, front, aft, galactic chart, long-range scan, attack computer,
  hyperwarp and docking shots to `captures/seed-<n>/` with a `manifest.json` of SHA-256 hashes. The same
  seed gives the same images every run. Needs Playwright's Chromium (`npx playwright install chromium`).

## Layout

```
src/
  core/      seeded RNG, debug hook
  game/      Game controller, loop, state
  entities/  player, Zylons, starbase, torpedoes, starfield
  systems/   energy, combat, sectors, scoring, starbase attacks, VFX
  views/     galactic chart, long-range scan, attack computer
  ui/        control panel, title menu
  audio/     sound
scripts/     capture.mjs
docs/        spec, plan, manual reference
```
