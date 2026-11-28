# Star Raiders (web remake)

A browser remake of **STAR RAIDERS**, the 1979 Atari 400/800 first-person space combat game, built with
Vite and TypeScript. The game screen is a 2D pixel renderer on a canvas: a 160 × 100 playfield
projected the way the ROM does it, scaled by whole numbers and letterboxed.

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
| Arrow keys / keypad 8 4 6 2 | The stick: up = dive, down = climb, left/right = turn (reversed in the aft view, as in the manual) |
| Gamepad | Left stick or D-pad steers, A or right trigger fires |
| 0–9 | Engine speed |
| Space | Fire photon torpedo |
| F / A | Front / aft view |
| G | Galactic chart (arrow keys move the cursor) |
| L | Long-range scan |
| H | Hyperwarp to the chart cursor |
| S | Shields |
| C | Attack computer (cross hairs) |
| T / M | Nearest / next target |
| P or Esc | Pause until the stick moves or a key is pressed; the pause menu shows this key help |
| X (in the pause menu) | Abort the mission and get a rating |
| Tab or 1–4 (attract mode) | SELECT the mission level (also the on-screen SELECT button) |
| Enter (attract mode) | START (also the on-screen START button) |
| Enter / Space / Esc | Skip the end sequence; leave the debrief card |
| N | Sound on / off (any time; saved) |
| - / = | Volume down / up, 0–10 (saved; also turns the sound back on) |

There is no title screen: power-on is the attract mode, a demo flight with `NOVICE MISSION` /
`STAR RAIDERS` / `COPYRIGHT ATARI 1979` on the title line. Nine idle minutes return to it. After a
mission the end sequence plays on the title line, then a debrief card shows the score breakdown and
the last ranks (kept in localStorage).

Attract-mode options (also `?stars=enhanced&crt=1&wasd=1&mouse=1` in the URL), all off by default:
**Stars** Classic (12, as the ROM) or Enhanced (48); **CRT** scanline filter; **WASD** steering (then
the aft view is R and shields Q); **Mouse** steering with pointer lock (click the screen; click fires).

## Testing and debugging

- **Seeded RNG.** All randomness goes through `src/core/rng.ts`. Add `?seed=<n>` to the URL to replay a
  game exactly; without it each game gets a fresh seed.
- **Debug hook.** `?debug=1` exposes `window.__sr` in the browser console: `seed`, `state`,
  `start(difficulty, seed?)`, `galaxy()`, `teleport({x, y})`, `spawn(type)`, `setView(view)`,
  `step(n)`, `resume()`, `hyperwarp(x, y)`, `dock()`, `stick(x, y)`, `press(action)`, `settings()`,
  `redAlert()`, `stars()`. See `src/core/debug.ts`.
- **Screenshots.** `npm run capture -- --seed 1979` starts Vite, opens the game in headless Chromium with
  a frozen clock and writes title, front, aft, galactic chart, long-range scan, attack computer,
  hyperwarp and docking shots to `captures/seed-<n>/` with a `manifest.json` of SHA-256 hashes. The same
  seed gives the same images every run. Needs Playwright's Chromium (`npx playwright install chromium`).

## Layout

```
src/
  core/      seeded RNG, sim clock, settings, Vec3, debug hook
  rules/     the manual/ROM tables as data
  sim/       energy, rating, galaxy, ship-frame motion (Minsky rotation)
  render/    2D renderer, ROM projection, starfield, palette, font
  input/     keyboard / gamepad / mouse, edge-triggered action queue
  game/      Game controller, loop, state
  entities/  Zylons, starbase, torpedoes (placeholder blobs until Phase 5)
  systems/   combat
  views/     galactic chart, long-range scan
  ui/        control panel data, attract console, pause menu, debrief card, insignia
  audio/     POKEY-style sound synth (pokey.ts), sound keys, offline demo render
scripts/     capture.mjs (screenshots; --audio 1 runs the sound check)
docs/        spec, plan, manual reference
```
