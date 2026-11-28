/**
 * ?debug=1 hook: exposes window.__sr for tests, capture scripts and manual poking.
 * Nothing here runs unless the URL has debug=1.
 *
 *   __sr.seed                      seed of the shared RNG (set with ?seed=<n>)
 *   __sr.start('NOVICE', seed?)    skip the title screen; reseeds the RNG first
 *   __sr.state                     snapshot of the game state (null before a game starts)
 *   __sr.galaxy()                  all 16x8 sectors
 *   __sr.teleport({x, y}) / (x, y) jump to a sector at once (no hyperwarp, no energy cost)
 *   __sr.spawn('fighter'|'cruiser'|'basestar'|'starbase', distance?, x?, y?)  place one ahead of the ship
 *                                  (KM; x, y: sideways and vertical offset). A Zylon takes a free
 *                                  ship slot (else slot 0), heads straight in, and is not on the map
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
 *   __sr.damageReport(sys, status) damage a subsystem as a hit does: DAMAGE CONTROL on the title
 *                                  line, then the queued subsystem phrase (repeats until docking)
 *   __sr.damage()                  each subsystem's state, its ROM bits (%00 OK, %10 damaged,
 *                                  %11 destroyed), report and beep counts, and the live effects
 *   __sr.repairAll()               repair all six subsystems (what docking does)
 *   __sr.scan()                    what the Long-Range Scan drew last: state, blips (KM), stars
 *   __sr.setKills(n)               set the K readout (Zylons destroyed)
 *   __sr.moveCursor(x, y)          put the chart's hyperwarp destination dot on a sector
 *   __sr.surround()                move existing Zylon groups next to the hunted starbase so
 *                                  the next fleet move tick announces STARBASE SURROUNDED
 *   __sr.toFleetTick(n?)           run the game (no rendering) to the n-th next fleet move tick
 *   __sr.killSector()              destroy every Zylon in your sector (same path as a torpedo kill)
 *   __sr.stick(x, y)               hold the stick: x −1 left / +1 right, y −1 forward / +1 back;
 *                                  stick(0, 0) gives it back to the player's controls
 *   __sr.press(action)             queue a key action, e.g. 'COMPUTER', 'FIRE', 'AFT', 'SPEED_6'
 *   __sr.settings(patch?)          read or change the bend settings {stars, crt, wasd, mouse}
 *   __sr.redAlert(loops?)          start a red-alert flash (255 loops) or stop it with 0
 *   __sr.stars()                   the starfield: ship-frame KM position, pixel and colour register
 *   __sr.zylons()                  Zylon ships, PLAYER2 (torpedo/meteor), photons, barrel, explosion
 *   __sr.attack()                  attack computer: blip place and rows, marks (0 none, 1 A, 2 B,
 *                                  3 C), lock flag, lock-on lifetime, target digit and position
 *   __sr.meteor(x, y, z)           put a meteor at a ship-frame KM position (flying in at −8 KM/loop)
 */
import type { Game, DebugSpawnType } from '../game/Game';
import type { Action } from '../input/Input';
import type { Settings } from './settings';
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
    spawn: (type: DebugSpawnType, distance?: number, x?: number, y?: number) => api().spawn(type, distance, x, y),
    setView: (view: ViewMode) => api().setView(view),
    step: (n = 1) => api().step(n),
    resume: () => api().resume(),
    hyperwarp: (x: number, y: number) => api().hyperwarp(x, y),
    dock: () => api().dock(),
    setEnergy: (units: number) => api().setEnergy(units),
    setSpeed: (key: number) => api().setSpeed(key),
    setShields: (on: boolean) => api().setShields(on),
    setDamage: (system: Subsystem, status: SubsystemStatus) => api().setDamage(system, status),
    damageReport: (system: Subsystem, status: 'damaged' | 'destroyed') => api().damageReport(system, status),
    damage: () => api().damage(),
    repairAll: () => api().repairAll(),
    scan: () => api().scan(),
    setKills: (n: number) => api().setKills(n),
    moveCursor: (x: number, y: number) => api().moveCursor(x, y),
    surround: () => api().surround(),
    toFleetTick: (n = 1) => api().toFleetTick(n),
    killSector: () => api().killSector(),
    stick: (x: number, y: number) => api().stick(x, y),
    press: (action: Action) => api().press(action),
    settings: (patch?: Partial<Settings>) => api().settings(patch),
    redAlert: (loops?: number) => api().redAlert(loops),
    stars: () => api().stars(),
    zylons: () => api().zylons(),
    meteor: (x: number, y: number, z: number) => api().meteor(x, y, z),
    attack: () => api().attack(),
  };

  (window as unknown as { __sr: typeof sr }).__sr = sr;
  console.log(`[debug] window.__sr ready, seed ${getSeed()}`);
}
