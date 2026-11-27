/**
 * ?debug=1 hook: exposes window.__sr for tests, capture scripts and manual poking.
 * Nothing here runs unless the URL has debug=1.
 *
 *   __sr.seed                      seed of the shared RNG (set with ?seed=<n>)
 *   __sr.start('NOVICE', seed?)    skip the title screen; reseeds the RNG first
 *   __sr.state                     snapshot of the game state (null before a game starts)
 *   __sr.galaxy()                  all 16x8 sectors
 *   __sr.teleport({x, y}) / (x, y) jump to a sector at once (no hyperwarp, no energy cost)
 *   __sr.spawn('fighter'|'cruiser'|'basestar'|'starbase', distance?)  place one ahead of the ship
 *   __sr.setView('FRONT'|'AFT'|'GALACTIC_CHART'|'LONG_RANGE_SCAN')   switch view instantly
 *   __sr.step(n)                   stop the real-time loop and run n fixed 1/60 s frames
 *   __sr.resume()                  go back to the real-time loop
 *   __sr.hyperwarp(x, y)           start a hyperwarp to a sector, as if chosen on the chart
 *   __sr.dock()                    put a starbase in docking range at speed 0 and begin docking
 */
import type { Game, DebugSpawnType } from '../game/Game';
import type { DifficultyLevel, ViewMode } from '../game/GameState';
import { getSeed, setSeed } from './rng';

export interface DebugHost {
  getGame(): Game | null;
  startGame(difficulty: DifficultyLevel): void;
}

type Sector = { x: number; y: number } | [number, number];

export function installDebugHook(host: DebugHost): void {
  const api = () => {
    const game = host.getGame();
    if (!game) throw new Error('__sr: no game running; call __sr.start() first');
    return game.createDebugApi();
  };

  const sr = {
    get seed() {
      return getSeed();
    },
    get state() {
      const game = host.getGame();
      return game ? game.createDebugApi().state() : null;
    },
    start(difficulty: DifficultyLevel = 'NOVICE', seed: number = getSeed()) {
      setSeed(seed);
      host.startGame(difficulty);
    },
    galaxy: () => api().galaxy(),
    teleport(sector: Sector | number, y?: number) {
      const [sx, sy] =
        typeof sector === 'number' ? [sector, y ?? 0] : Array.isArray(sector) ? sector : [sector.x, sector.y];
      api().teleport(sx, sy);
    },
    spawn: (type: DebugSpawnType, distance?: number) => api().spawn(type, distance),
    setView: (view: ViewMode) => api().setView(view),
    step: (n = 1) => api().step(n),
    resume: () => api().resume(),
    hyperwarp: (x: number, y: number) => api().hyperwarp(x, y),
    dock: () => api().dock(),
  };

  (window as unknown as { __sr: typeof sr }).__sr = sr;
  console.log(`[debug] window.__sr ready, seed ${getSeed()}`);
}
