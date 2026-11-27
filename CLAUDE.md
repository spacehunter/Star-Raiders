# CLAUDE.md

Guidance for coding agents working in this repository.

## Source of truth

- **`docs/MANUAL_SPEC.md`** holds every rule, number, screen and message of the original 1979 Atari
  STAR RAIDERS (manual + ROM). All gameplay and visual work follows it. Cite the section you implement
  in your PR (for example "MANUAL_SPEC §5").
- **`docs/OVERHAUL_PLAN.md`** is the audit of the current code and the ordered phase plan (Part 3).
  Each task does one phase; keep to its scope.
- **`docs/reference/manual/`** has the manual photos and reference screenshots.

Do not take rules, energy costs or colours from the current code or from memory: the current build is
known to be unfaithful (see the audit). If the spec is silent, say so in the PR rather than inventing.

## Stack and commands

Vite + TypeScript + Three.js, plain DOM/CSS for the HUD, Web Audio for sound.

```bash
npm run dev        # dev server
npm run build      # tsc + vite build; must pass
npm test           # Vitest; must pass
npm run capture -- --seed 1979   # 8 standard screenshots into captures/seed-1979/
```

## Conventions

- **Randomness:** never call `Math.random()`. Use `random()` from `src/core/rng.ts` (or `createRng(seed)`
  for an independent stream) so games replay from `?seed=<n>`.
- **Debug hook:** `?debug=1` exposes `window.__sr` (`src/core/debug.ts`): `seed`, `state`, `start`,
  `galaxy`, `teleport`, `spawn`, `setView`, `step`, `resume`, `hyperwarp`, `dock`. Extend it when a
  phase needs a new way to reach a game state.
- **Screenshots:** reuse `scripts/capture.mjs` for evidence; add shots to its `SHOTS` list instead of
  writing a new harness. It freezes the page clock and advances the game only with `__sr.step()`, so
  keep new game logic driven by the update `deltaTime`, not wall-clock time.
- **Tests:** put unit tests next to the code as `*.test.ts`. Rules from the spec get tests.
- Keep the repo root to app files and docs; scratch notes do not belong in git.
