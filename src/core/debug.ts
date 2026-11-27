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
 *   __sr.setEnergy(n)              set the ENERGY readout (e.g. to test the zero-energy abort)
 *   __sr.setSpeed(key)             press engine key 0..9
 *   __sr.setShields(on)            raise or lower the shields
 *   __sr.setDamage(sys, status)    sys photons|engines|shields|computer|sectorScan|radio,
 *                                  status ok|damaged|destroyed (DC letters, radio freeze)
 *   __sr.moveCursor(x, y)          put the chart's hyperwarp destination dot on a sector
 *   __sr.surround()                move existing Zylon groups next to the hunted starbase so
 *                                  the next fleet move tick announces STARBASE SURROUNDED
 *   __sr.toFleetTick(n?)           run the game (no rendering) to the n-th next fleet move tick
 *   __sr.killSector()              destroy every Zylon in your sector (same path as a torpedo kill)
 */
import type { Game, DebugSpawnType } from '../game/Game';
import type { DifficultyLevel, ViewMode } from '../game/GameState';
import type { Subsystem, SubsystemStatus } from '../rules/damage';
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
    setEnergy: (units: number) => api().setEnergy(units),
    setSpeed: (key: number) => api().setSpeed(key),
    setShields: (on: boolean) => api().setShields(on),
    setDamage: (system: Subsystem, status: SubsystemStatus) => api().setDamage(system, status),
    moveCursor: (x: number, y: number) => api().moveCursor(x, y),
    surround: () => api().surround(),
    toFleetTick: (n = 1) => api().toFleetTick(n),
    killSector: () => api().killSector(),
  };

  (window as unknown as { __sr: typeof sr }).__sr = sr;
  console.log(`[debug] window.__sr ready, seed ${getSeed()}`);
}
