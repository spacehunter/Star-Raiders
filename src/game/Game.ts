import { GameLoop } from './GameLoop';
import { GameState, ViewMode, DifficultyLevel } from './GameState';
import { Input, type Action } from '../input/Input';
import { SoundManager } from '../audio/SoundManager';
import { ControlPanel, type TrackedPosition } from '../ui/ControlPanel';
import { GalacticChart } from '../views/GalacticChart';
import { createRng, getSeed, random } from '../core/rng';
import { getSettings, onSettingsChange, updateSettings, type Settings } from '../core/settings';
import { SimClock, type LoopEvents } from '../core/clock';
import { EnergySim } from '../sim/energy';
import { MissionScore, rateMission, type MissionRating } from '../sim/rating';
import { approachVelocity, STICK_CENTERED, type Stick } from '../sim/motion';
import { Docking, inOrbitPosition, type DockEvent } from '../sim/docking';
import type { MissionOutcome } from '../rules/rating';
import { VELOCITY_TAB } from '../rules/speed';
import { WARP_NEW_VELOCITY } from '../sim/hyperwarp';
import { Hyperwarp, type WarpEvent } from '../sim/hyperwarp';
import { type Subsystem, type SubsystemStatus } from '../rules/damage';
import { DamageControl, STATUS_BITS, computerFunctions, computerReadoutsLive, engineKeyFor, jitterVelocity, scanState } from '../sim/damage';
import { MSG, PHRASE, endOfMissionPhrase } from '../rules/messages';
import { Galaxy, RadioFeed, GALAXY_COLUMNS, GALAXY_ROWS, type GalaxyEvent, type SectorPos } from '../sim/galaxy';
import { Renderer, type SpaceFrame, type SpaceObject } from '../render/Renderer';
import { buildScan, type ScanObject, type ScanPicture } from '../render/scan';
import { resolveShipHit, VICINITY_MASK_TABLE, ZylonSim, type SimView, type ZylonEvent, type ZylonType } from '../sim/zylons';
import { AttackComputer, trackingView, type AttackDisplay, type TrackedObject } from '../sim/attackComputer';
import { CLASSIC_STARS, ENHANCED_STARS, Starfield, type StarView } from '../render/starfield';
import type { SpaceView } from '../render/projection';

export type DebugSpawnType = ZylonType | 'starbase';

export interface GameDebugApi {
  state(): Record<string, unknown>;
  galaxy(): Array<Record<string, unknown>>;
  teleport(x: number, y: number): void;
  spawn(type: DebugSpawnType, distance?: number, x?: number, y?: number): void;
  setView(view: ViewMode): void;
  step(n?: number): void;
  resume(): void;
  hyperwarp(x: number, y: number): void;
  warp(): Record<string, unknown>;
  dock(): void;
  starbase(): Record<string, unknown>;
  setEnergy(units: number): void;
  setSpeed(key: number): void;
  setShields(on: boolean): void;
  setDamage(system: Subsystem, status: SubsystemStatus): void;
  damageReport(system: Subsystem, status: 'damaged' | 'destroyed'): void;
  damage(): Record<string, unknown>;
  repairAll(): void;
  scan(): Record<string, unknown>;
  setKills(n: number): void;
  moveCursor(x: number, y: number): void;
  surround(): SectorPos | null;
  toFleetTick(n?: number): number;
  killSector(): number;
  stick(x: number, y: number): void;
  press(action: Action): void;
  settings(patch?: Partial<Settings>): Settings;
  redAlert(loops?: number): void;
  stars(): Array<{ x: number; y: number; z: number; col: number | null; row: number | null; color: number }>;
  zylons(): Record<string, unknown>;
  attack(): Record<string, unknown>;
  meteor(x: number, y: number, z: number): void;
}

type GameOverCallback = (rating: MissionRating) => void;

/** Loops the background flashes random colours after a hit with shields up (§17.13). */
const HIT_FLASH_LOOPS = 16;
/** R: REDALERTLIFE on entering a Zylon sector. */
const RED_ALERT_LOOPS = 255;

/** Speed key whose velocity the ship has reached (for rules that read a key, e.g. docking). */
function keyForVelocity(v: number): number {
  let key = 0;
  for (let k = 0; k < VELOCITY_TAB.length; k++) if (VELOCITY_TAB[k] <= v) key = k;
  return key;
}

/**
 * Game - the main controller: simulation loop, views, input and the 2D renderer.
 *
 * Space is the ROM's ship frame (MANUAL_SPEC §17.13): our starship sits at the origin facing
 * +z; each game loop the stick rotates every object 0.89° around it and flying moves every
 * object toward −z (sim/motion.ts).
 */
export class Game {
  private renderer: Renderer;
  private starfield: Starfield;

  // Game systems
  private gameLoop: GameLoop;
  private input: Input;
  private clock: SimClock;
  private energy: EnergySim;
  private missionScore: MissionScore;
  /** The galaxy map: the one source of Zylon counts (sim/galaxy.ts, §17.4). */
  private galaxy: Galaxy;
  private radioFeed: RadioFeed;
  /** Zylon ships, their torpedo, meteors, our photons and explosions (sim/zylons.ts, §16, §17.7, §17.8). */
  private zylons: ZylonSim;
  /** The Attack Computer Display, lock-on markers and lock flag (sim/attackComputer.ts, §11, §17.6). */
  private attackComputer = new AttackComputer();
  /** Subsystem states, DAMAGE CONTROL reports and repair (sim/damage.ts, §7, §17.3). */
  private damageControl: DamageControl;
  private soundManager: SoundManager;
  private gameState: GameState;
  private unsubscribeSettings: () => void;

  // UI
  private controlPanel: ControlPanel;
  private galacticChart: GalacticChart;
  /**
   * The Long-Range Scan picture of the last game loop (render/scan.ts, §10, §17.3), or null
   * outside the scan. Its own POKEY stream drives the damaged mirror and the blip colours, so
   * the scan never shifts the game's random sequence.
   */
  private scanPicture: ScanPicture | null = null;
  private readonly scanRng = createRng(getSeed() ^ 0x15c4);

  // Flight
  /** Ship velocity in KM per game loop (§17.1 VELOCITYTAB), stepping toward the key's value. */
  private shipVelocity = 0;
  /** The stick read for the last game loop. */
  private stick: Stick = STICK_CENTERED;
  /** Debug override of the stick (window.__sr.stick), or null. */
  private debugStick: Stick | null = null;
  /** R: REDALERTLIFE — loops left of the red-alert flash. */
  private redAlertLife = 0;
  private hitFlash = 0;

  // State
  private gameTime: number = 0;
  private gameOverCallback: GameOverCallback | null;
  private hasTriggeredGameOver: boolean = false;

  /** Hyperwarp: chart positions, phases, the target marker and the landing (sim/hyperwarp.ts, §9, §17.5). */
  private hyperwarp = new Hyperwarp();

  /** Docking: orbit, transfer vessel, TRANSFER COMPLETE or DOCKING ABORTED (sim/docking.ts, §13, §17.9). */
  private docking = new Docking();

  constructor(
    container: HTMLElement,
    difficulty: DifficultyLevel = DifficultyLevel.NOVICE,
    onGameOver?: GameOverCallback
  ) {
    this.gameOverCallback = onGameOver || null;

    this.gameState = new GameState();
    this.gameState.reset(difficulty);

    // Renderer and starfield. The stars use their own seeded stream so that the bend
    // settings (12 or 48 stars) never change the game's random sequence.
    this.renderer = new Renderer(container);
    const settings = getSettings();
    this.renderer.setCrt(settings.crt);
    // The renderer's flicker and sparkle draw from their own stream, so drawing never shifts the game's.
    this.renderer.setRandom(createRng(getSeed() ^ 0x0b5e));
    this.starfield = new Starfield(createRng(getSeed() ^ 0x5a17), this.starCount(settings), 'FRONT');
    this.unsubscribeSettings = onSettingsChange((s) => {
      this.renderer.setCrt(s.crt);
      this.starfield.setCount(this.starCount(s), this.starView());
    });

    this.gameLoop = new GameLoop();
    this.input = new Input(this.renderer.canvas);
    this.clock = new SimClock();
    this.missionScore = new MissionScore();
    this.energy = new EnergySim(this.gameState, {
      onScoreLoss: (points) => this.missionScore.energyUsed(points),
      onZeroEnergy: () => this.endMission('zeroEnergy'),
    });
    // Galaxy: Zylon groups, starbases and fleet movement (§17.4)
    this.galaxy = new Galaxy(this.gameState.difficulty, random, {
      x: this.gameState.sectorX,
      y: this.gameState.sectorY,
    });
    this.radioFeed = new RadioFeed(this.galaxy);
    this.hyperwarp.setDepartureSector(this.gameState.sectorX, this.gameState.sectorY);
    this.hyperwarp.setArrivalSector(this.gameState.sectorX, this.gameState.sectorY);

    this.zylons = new ZylonSim(random);
    this.soundManager = new SoundManager();

    this.controlPanel = new ControlPanel(this.gameState, random);
    this.damageControl = new DamageControl(this.gameState, this.controlPanel.title, {
      beep: () => this.soundManager.playDamageReport(),
      computerDestroyed: () => {
        // R: DAMAGE — "Switch Attack Computer off" and clear the playfield.
        this.gameState.attackComputerOn = false;
        this.attackComputer.reset();
      },
    });
    this.galacticChart = new GalacticChart(container);

    // §17.1: a game starts at speed key 6.
    this.shipVelocity = VELOCITY_TAB[this.gameState.targetEngineSpeed];

    this.spawnSectorContents();

    this.gameLoop.setUpdateCallback(this.update);
    this.gameLoop.setRenderCallback(this.render);
  }

  /** WARPSTATE ≠ 0: hyperwarp engaged (acceleration, star trails or hyperspace). */
  private get isHyperwarping(): boolean {
    return this.hyperwarp.engaged;
  }

  /** The chart's hyperwarp destination dot as a sector (§8). */
  private get chartCursor(): SectorPos {
    return this.hyperwarp.arrivalSector;
  }

  private starCount(s: Settings): number {
    return s.stars === 'enhanced' ? ENHANCED_STARS : CLASSIC_STARS;
  }

  /** The view whose space the stars belong to (the chart and scan keep the front field). */
  private spaceView(): SpaceView {
    return this.gameState.currentView === ViewMode.AFT ? 'AFT' : 'FRONT';
  }

  /** The starfield's view: the scan has its own z-x field (R: SETVIEW, INITPOSVEC). */
  private starView(): StarView {
    return this.gameState.currentView === ViewMode.LONG_RANGE_SCAN ? 'LRS' : this.spaceView();
  }

  /**
   * A sector's contents on arrival. Zylon ships enter one at a time from the sector's count
   * (sim/zylons.ts, §17.8); a starbase sector gets its starbase, placed like a Zylon ship
   * (≥ 28928 KM ahead, x and y within the vicinity mask) and no Zylons or meteors (§17.8, §17.9).
   */
  private spawnSectorContents(): void {
    const { sectorX: x, sectorY: y } = this.gameState;
    this.clearSectorContents();
    // R: CLEANUPWARP clears TRACKDIGIT; a starbase sector sets T=2 again every loop.
    if (this.zylons.trackDigit >= 2) this.zylons.trackDigit = 0;
    if (this.galaxy.hasStarbase(x, y)) this.zylons.placeStarbase();
  }

  /** Empty the sector: ships, shots, the starbase and the transfer vessel; no docking. */
  private clearSectorContents(): void {
    this.zylons.clear();
    this.docking.reset();
  }

  public start(): void {
    this.gameLoop.start();
  }

  public stop(): void {
    this.gameLoop.stop();
  }

  /**
   * Update game state (called each frame)
   */
  private update = (deltaTime: number): void => {
    if (this.gameState.isGameOver) {
      if (!this.hasTriggeredGameOver) {
        this.triggerGameOver();
      }
      return;
    }

    this.gameTime += deltaTime;

    // Edge-triggered keys: every press since the last frame, in order (no lost taps).
    const actions = this.input.drain();

    // Fixed-timestep rules: energy, star date, fleets, turning and flying (60 loops/s)
    this.clock.advance(deltaTime, this.simLoop);
    if (this.gameState.isGameOver) return;

    for (const action of actions) this.handleAction(action);
    if (this.gameState.isGameOver) return;

    this.gameState.isUnderAttack = this.zylons.torpedoFlying;

    this.renderChart();

    this.checkGameState();
  };

  /**
   * One fixed 1/60 s simulation loop (MANUAL_SPEC §12, §17.1, §17.4, §17.10, §17.13).
   */
  private simLoop = (events: LoopEvents): void => {
    if (this.gameState.isGameOver) return;
    this.energy.loop({
      engineKey: this.gameState.targetEngineSpeed,
      shields: this.gameState.shieldsActive,
      computer: this.gameState.attackComputerOn,
      hyperwarp: this.hyperwarp.phase === 'accel', // CLEANUPWARP clears the engine drain in hyperspace
    });
    this.radioFeed.sync(this.gameState.damage.radio);
    if (events.fleetMoveTick) {
      this.missionScore.fleetMoveTick();
      const player = { x: this.gameState.sectorX, y: this.gameState.sectorY };
      this.handleGalaxyEvents(this.galaxy.moveTick(player, this.clock.starDateTicks));
    }
    this.flyLoop();
    if (this.gameState.isGameOver) return;
    // R: UPDPANEL, UPDTITLE, FLUSHGAMELOOP — readouts, title line, band and shields colours.
    this.controlPanel.loop(this.trackedPosition());
    this.gameState.starDate = this.clock.starDate;
    this.gameState.score = this.missionScore.score;
  };

  /**
   * Game loop steps 8–9 and 16–17 (R: GAMELOOP): read the stick, rotate and move every space
   * object and star, count down the red alert and the hit flash.
   */
  private flyLoop(): void {
    const stick = this.debugStick ?? this.input.readStick();
    this.stick = stick;
    const view = this.gameState.currentView;

    // Velocity steps 1 KM/loop toward the chosen key, or 255 while hyperwarp is engaged (R: UPDPANEL).
    const target = this.isHyperwarping ? WARP_NEW_VELOCITY : VELOCITY_TAB[this.gameState.targetEngineSpeed];
    this.shipVelocity = approachVelocity(this.shipVelocity, target);
    // §17.3: damaged or destroyed engines make the speed jitter (R: UPDPANEL L9784).
    const jitter = jitterVelocity(this.gameState.damage.engines, target, this.isHyperwarping, () => Math.floor(random() * 256));
    if (jitter !== null) this.shipVelocity = jitter;
    this.gameState.engineSpeed = keyForVelocity(this.shipVelocity);

    // The ROM does not rotate in the Galactic Chart view. In hyperwarp the turn moves the
    // target marker like every other space object: that is how the pilot steers it (§9).
    const turn: Stick = view === ViewMode.GALACTIC_CHART ? STICK_CENTERED : stick;
    // R: INITTRAIL's VELOCITYHI adds 256 KM/loop while the star trails run.
    const flyVelocity = this.shipVelocity + this.hyperwarp.velocityBoost;

    this.starfield.loop(turn, flyVelocity, this.starView(), this.clock.loops & 7);

    // Zylons, torpedoes, meteors and explosions (R: GAMELOOP steps 8–12, 21, 23, 25–27).
    const { sectorX: sx, sectorY: sy } = this.gameState;
    const events = this.zylons.loop({
      turn,
      velocity: flyVelocity,
      view: this.simView(),
      level: this.gameState.difficulty,
      sectorZylons: this.galaxy.zylonsAt(sx, sy),
      starbaseSector: this.galaxy.hasStarbase(sx, sy),
      hyperwarp: this.isHyperwarping,
      count256: this.controlPanel.colors.count256,
      computer: this.computerWorking(),
      photonStatus: this.gameState.damage.photons,
    });
    for (const e of events) this.zylonEvent(e);
    this.computerLoop();
    this.dockingLoop(stick);

    // GAMELOOP step 30: HYPERWARP.
    const warpEvents = this.hyperwarp.loop({
      velocity: this.shipVelocity,
      front: view === ViewMode.FRONT,
      level: this.gameState.difficulty,
      turn,
      randomByte: () => Math.floor(random() * 256),
    });
    for (const e of warpEvents) this.warpEvent(e);

    if (this.redAlertLife > 0) this.redAlertLife--;
    if (this.hitFlash > 0) this.hitFlash--;

    // GAMELOOP steps 14–15: the scan's pixels and blips for this loop.
    this.scanPicture = view === ViewMode.LONG_RANGE_SCAN ? this.buildScanPicture() : null;
  }

  /** The attack computer is switched on (C) and not destroyed (§5.3, §17.3). */
  private computerWorking(): boolean {
    return this.gameState.attackComputerOn && computerFunctions(this.gameState.damage.computer);
  }

  /**
   * GAMELOOP steps 23–24 (§5.8, §5.10, §11, §17.6): T=3 while hyperwarping and T=2 in a starbase
   * sector (T=2 overrides T=3), the Attack Computer Display in the Front view, and the tracking
   * computer flipping between the Front and Aft views to keep the target in sight.
   */
  private computerLoop(): void {
    if (this.hyperwarp.markerShown) this.zylons.trackDigit = 3;
    if (this.zylons.starbase.alive) this.zylons.trackDigit = 2;
    if (!this.computerWorking()) return;
    const view = this.gameState.currentView;
    const target = this.trackedObject();
    if (view === ViewMode.FRONT) this.attackComputer.loop(target);
    if (!this.gameState.trackingComputerOn || !target) return;
    if (view !== ViewMode.FRONT && view !== ViewMode.AFT) return;
    const flip = trackingView(view === ViewMode.FRONT ? 'FRONT' : 'AFT', target.z);
    if (flip) this.switchView(flip === 'AFT' ? ViewMode.AFT : ViewMode.FRONT);
  }

  /**
   * The object behind the target digit, ship frame in KM (§5.8): 0/1 a Zylon ship, 2 the
   * starbase, 3 the hyperwarp marker. Null when it is not there.
   */
  private trackedObject(): TrackedObject | null {
    const digit = this.zylons.trackDigit;
    if (digit === 2) {
      const sb = this.zylons.starbase;
      return sb.alive ? { x: sb.x, y: sb.y, z: sb.z } : null;
    }
    if (digit === 3) return this.warpMarkerPosition();
    const ship = this.zylons.trackedShip();
    return ship ? { x: ship.x, y: ship.y, z: ship.z } : null;
  }

  /**
   * T=3: the hyperwarp target marker (PLAYER3) in the ship frame (KM), 7936..8191 KM ahead,
   * or null when it is not shown (§5.8, §17.5).
   */
  private warpMarkerPosition(): TrackedObject | null {
    if (!this.hyperwarp.markerShown) return null;
    const m = this.hyperwarp.marker;
    return { x: m.x, y: m.y, z: m.z };
  }

  /** The ROM's SHIPVIEW for the Zylon simulation. */
  private simView(): SimView {
    switch (this.gameState.currentView) {
      case ViewMode.AFT:
        return 'AFT';
      case ViewMode.GALACTIC_CHART:
        return 'CHART';
      case ViewMode.LONG_RANGE_SCAN:
        return 'LRS';
      default:
        return 'FRONT';
    }
  }

  /** React to one event of the Zylon simulation (§16, §17.7, §17.12). */
  private zylonEvent(e: ZylonEvent): void {
    switch (e.type) {
      case 'zylonDestroyed':
        this.soundManager.playExplosion();
        this.zylonKilled(e.debug);
        break;
      case 'starbaseDestroyed':
        this.starbaseShot();
        break;
      case 'basestarHit':
      case 'shotDown':
        this.soundManager.playExplosion();
        break;
      case 'shipHit':
        this.shipHit(e.by, e.torpedoLife);
        break;
      case 'autoFired':
        // R: TRIGGER — the locked salvo's second torpedo, at the usual cost (§12.1, §17.6).
        this.energy.firePhoton();
        this.soundManager.playTorpedoFire();
        break;
      default:
        break;
    }
  }

  /**
   * GAMELOOP steps 26–27: the Zylon torpedo or a meteor hit us (§5.9, §16, §17.3, §17.7).
   * The hit test reads SHIELDSCOLOR, so damaged shields protect only while they flicker on.
   */
  private shipHit(by: 'torpedo' | 'meteor', torpedoLife: number): void {
    const r = resolveShipHit({
      shieldsUp: this.controlPanel.colors.shieldsUp,
      level: this.gameState.difficulty,
      damage: this.gameState.damage,
      by,
      torpedoLife,
      randomByte: () => Math.floor(random() * 256),
    });
    if (r.destroyed) {
      // SHIP DESTROYED BY ZYLON FIRE: the front view, then the end sequence (R: GAMEOVER).
      this.soundManager.playPlayerHit();
      this.switchView(ViewMode.FRONT);
      this.endMission('destroyed');
      return;
    }
    if (r.damage) this.reportDamage(r.damage.system, r.damage.status);
    this.soundManager.playShieldHit();
    this.hitFlash = HIT_FLASH_LOOPS; // §17.13: the screen flashes random colours
    this.energy.hit(); // −100 (§12.1, §17.1)
  }

  /**
   * Every live PLAYER on the Long-Range Scan, ship frame in KM (R step 15 draws all of them as
   * blips): Zylon ships, the meteor or Zylon torpedo, photons, the starbase, the warp marker.
   */
  private scanObjects(): ScanObject[] {
    const out: ScanObject[] = [];
    const z = this.zylons;
    for (const s of z.ships) if (s.alive) out.push({ kind: s.type, x: s.x, z: s.z });
    if (z.pl2.life > 0) out.push({ kind: z.pl2.kind === 'meteor' ? 'meteor' : 'zylonTorpedo', x: z.pl2.x, z: z.pl2.z });
    for (const p of z.photons) if (p.life > 0) out.push({ kind: 'photon', x: p.x, z: p.z });
    if (z.starbase.alive) out.push({ kind: 'starbase', x: z.starbase.x, z: z.starbase.z });
    if (z.vessel.alive) out.push({ kind: 'transferVessel', x: z.vessel.x, z: z.vessel.z });
    const warp = this.hyperwarp;
    if (warp.markerShown) out.push({ kind: 'warpMarker', x: warp.marker.x, z: warp.marker.z });
    return out;
  }

  /** One loop of the Long-Range Scan (render/scan.ts; §10, §17.3, §17.13). */
  private buildScanPicture(): ScanPicture {
    const d = this.gameState.damage;
    const byte = () => Math.floor(this.scanRng() * 256);
    return buildScan(
      {
        scan: scanState(d.sectorScan, d.computer),
        stars: this.hyperwarp.phase === 'hyperspace' ? [] : this.starfield.all,
        fragments: this.zylons.explosion?.fragments ?? [],
        objects: this.scanObjects(),
        count8: this.clock.loops & 7,
      },
      byte,
      byte
    );
  }

  /**
   * A Zylon ship in the player's sector was destroyed: count it and take it off the map.
   */
  private zylonKilled(debug: boolean): void {
    this.gameState.enemiesDestroyed++;
    this.missionScore.zylonDestroyed();
    if (debug) return; // placed by the debug hook: not on the map
    this.handleGalaxyEvents(this.galaxy.destroyZylon(this.gameState.sectorX, this.gameState.sectorY));
  }

  /**
   * React to galaxy events (§8.2, §7 Sub-Space Radio, §17.4, §17.10).
   */
  private handleGalaxyEvents(events: GalaxyEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'starbaseSurrounded':
          // (The "message from starbase" tune is Phase 12; the red alert only sounds on arrival.)
          if (this.radioFeed.relaysMessages) this.controlPanel.setTitle(PHRASE.STARBASE_SURROUNDED);
          break;
        case 'starbaseDestroyed': {
          this.missionScore.starbaseDestroyedByZylons(); // -18 (§14.1)
          if (this.radioFeed.relaysMessages) this.controlPanel.setTitle(PHRASE.STARBASE_DESTROYED);
          if (e.x === this.gameState.sectorX && e.y === this.gameState.sectorY) {
            // The debris becomes two Zylons right here; they enter from the new count (§8.2).
            // R: DOCKING finds the chart no longer marks a starbase: explosion and noise.
            this.zylons.destroyStarbase();
            this.docking.reset();
            this.soundManager.playShieldHit();
          }
          break;
        }
        case 'allZylonsDestroyed':
          this.endMission('complete'); // §1 mission end (1)
          break;
        default:
          break;
      }
    }
  }

  /** Draw the Galactic Chart if it is open and something on it changed (§8). */
  private renderChart(): void {
    if (!this.galacticChart.visible) return;
    const { sectorX, sectorY } = this.gameState;
    const c = this.chartCursor;
    this.galacticChart.render({
      title: this.controlPanel.titleText().trim() || MSG.GALACTIC_CHART,
      sectorsVersion: this.radioFeed.version,
      sectors: () => this.radioFeed.sectors(),
      player: { x: sectorX, y: sectorY },
      cursor: c,
      warpEnergy: this.hyperwarp.chartWarpEnergy,
      targets: this.radioFeed.targets(c.x, c.y),
      starDate: this.gameState.starDate,
      damage: this.gameState.damage,
    });
  }

  /**
   * Move the hyperwarp destination dot by whole sectors, clamped to the chart. It stays put
   * while hyperwarp is engaged (R: SELECTWARP).
   */
  private moveChartCursor(dx: number, dy: number): void {
    if (this.isHyperwarping) return;
    const c = this.chartCursor;
    this.hyperwarp.setArrivalSector(
      Math.max(0, Math.min(GALAXY_COLUMNS - 1, c.x + dx)),
      Math.max(0, Math.min(GALAXY_ROWS - 1, c.y + dy))
    );
    this.renderChart();
  }

  /**
   * End the mission and rate it (§14, §17.10). The first outcome wins.
   */
  private endMission(outcome: MissionOutcome): void {
    if (this.gameState.missionOutcome) return;
    this.gameState.score = this.missionScore.score;
    this.gameState.missionOutcome = outcome;
    this.gameState.rating = rateMission(this.gameState.difficulty, outcome, this.missionScore.score);
    this.gameState.isVictory = outcome === 'complete';
    this.gameState.isGameOver = true;
    // R: GAMEOVER clears the title line and enqueues the end sequence, which then repeats.
    this.controlPanel.title.clear();
    this.controlPanel.enqueueTitle(endOfMissionPhrase(outcome, this.gameState.rating.messages));
  }

  /**
   * Ship-frame position (KM) of the object the panel's θ Φ R read, and the target digit after
   * T:/C: (§5.8, §6, §17.2): 0/1 a Zylon ship, 2 the starbase, 3 the hyperwarp marker.
   */
  private trackedPosition(): TrackedPosition | null {
    this.controlPanel.setTrackDigit(this.zylons.trackDigit);
    return this.trackedObject();
  }

  /**
   * GAMELOOP step 24, R: DOCKING (§13, §17.9). Orbit needs the starbase between the cross hairs
   * (sitting just above the horizontal one), in front and closer than 512 KM, and speed 0 now and
   * chosen. Moving the stick (outside the Galactic Chart, where it only moves the cursor) breaks
   * it: during docking that is DOCKING ABORTED (§13 step 6).
   */
  private dockingLoop(stick: Stick): void {
    const sb = this.zylons.starbase;
    if (!sb.alive) {
      this.docking.reset();
      return;
    }
    const view = this.gameState.currentView;
    const stickMoved = view !== ViewMode.GALACTIC_CHART && (stick.x !== 0 || stick.y !== 0);
    const events: DockEvent[] = stickMoved ? this.docking.interrupt() : [];
    const inPosition =
      !stickMoved &&
      inOrbitPosition({
        starbase: sb,
        velocity: this.shipVelocity,
        newVelocity: VELOCITY_TAB[this.gameState.targetEngineSpeed],
        aft: view === ViewMode.AFT,
      });
    const vessel = this.zylons.vessel;
    events.push(
      ...this.docking.loop({
        inPosition,
        titleHidden: this.controlPanel.title.current === null,
        vesselBehind: vessel.alive && vessel.z < 0,
      })
    );
    for (const e of events) this.dockEvent(e);
  }

  /** React to one docking event (§13, §17.9; R: DOCKING). */
  private dockEvent(e: DockEvent): void {
    switch (e) {
      case 'orbitEstablished':
        this.controlPanel.setTitle(PHRASE.ORBIT_ESTABLISHED); // then STANDBY
        break;
      case 'holdTitle':
        // R: NEWTITLEPHR := 0 — no queued phrase (repeating damage reports stop) while in orbit.
        this.controlPanel.title.clearQueue();
        break;
      case 'launchVessel':
        this.zylons.launchVessel();
        break;
      case 'transferComplete':
        // ACKNOWLEDGE beep, TRANSFER COMPLETE, all six subsystems repaired, ENERGY 9999.
        this.soundManager.playDocking();
        this.controlPanel.setTitle(PHRASE.TRANSFER_COMPLETE);
        this.repairAll();
        this.energy.refill();
        this.zylons.returnVessel();
        this.attackComputer.reset(); // R: JMP UPDSCREEN
        break;
      case 'aborted':
        this.controlPanel.setTitle(PHRASE.DOCKING_ABORTED);
        this.zylons.recallVessel();
        break;
    }
  }

  /**
   * Our photon destroyed the starbase (§14.1, §17.7, §17.10; R: COLLISION): −3, the starbase is
   * gone from the galaxy and the chart, and it explodes with the shield-explosion noise.
   */
  private starbaseShot(): void {
    this.soundManager.playShieldHit();
    this.missionScore.starbaseShotByYou();
    this.galaxy.removeStarbase(this.gameState.sectorX, this.gameState.sectorY);
    this.docking.reset();
    this.radioFeed.sync(this.gameState.damage.radio);
    this.renderChart();
  }

  private triggerGameOver(): void {
    this.hasTriggeredGameOver = true;
    this.galacticChart.hide();
    this.gameLoop.stop();
    this.render();

    if (this.gameOverCallback && this.gameState.rating) {
      this.gameOverCallback(this.gameState.rating);
    }
  }

  private checkGameState(): void {
    // Mission complete: all Zylons destroyed (§1, §17.10)
    if (this.galaxy.zylonsLeft <= 0) this.endMission('complete');
    // Losing every starbase does not end the game (§17.4). Zero energy ends it from sim/energy.ts.
  }

  /**
   * R: DAMAGE — DAMAGE CONTROL now; the subsystem phrase waits in the queue and repeats until
   * docking; the damage-report beep (§7, §17.3).
   */
  private reportDamage(system: Subsystem, status: 'damaged' | 'destroyed'): void {
    this.damageControl.report(system, status);
    this.radioFeed.sync(this.gameState.damage.radio);
  }

  /**
   * Repair all six subsystems. Docking (TRANSFER COMPLETE) is the only repair (§13, §17.9);
   * Phase 10's docking sequence calls this.
   */
  public repairAll(): void {
    this.damageControl.repairAll();
    this.radioFeed.sync(this.gameState.damage.radio);
    this.renderChart();
  }

  /**
   * R: KEYBOARD 'H' — engage hyperwarp toward the chart's destination dot (§9, §17.5). The
   * ROM never refuses a jump for lack of energy: hyperspace drains 10 per loop and can run the
   * tank dry. A jump within the sector (the dot on our own sector) costs 100, as in §12.3.
   */
  private engageHyperwarp(): void {
    if (!this.hyperwarp.engage(this.gameState.difficulty)) return;
    this.starfield.clearTrails();
    this.controlPanel.setTitle(PHRASE.HYPERWARP_ENGAGED);
  }

  /** R: ABORTWARP — a 0–9 key while hyperwarp is engaged: −100, HYPERWARP ABORTED, stop (§9). */
  private abortHyperwarp(): void {
    const phase = this.hyperwarp.phase;
    if (!this.hyperwarp.abort()) return;
    this.energy.abortHyperwarp();
    this.endWarp();
    this.controlPanel.setTitle(PHRASE.HYPERWARP_ABORTED);
    // Aborted in hyperspace: we are still in the departure sector, whose ships were cleared.
    if (phase === 'hyperspace') this.spawnSectorContents();
  }

  /** R: ENDWARP + CLEANUPWARP — engines stopped, trails gone. */
  private endWarp(): void {
    this.gameState.targetEngineSpeed = 0;
    this.starfield.clearTrails();
    if (this.zylons.trackDigit === 3) this.zylons.trackDigit = 0;
  }

  /** React to one hyperwarp event (§9, §17.5). */
  private warpEvent(e: WarpEvent): void {
    switch (e.type) {
      case 'trail':
        this.starfield.addTrail();
        break;
      case 'hyperspace':
        // CLEANUPWARP: the sector's ships, shots and explosion are gone; T back to 0.
        this.gameState.targetEngineSpeed = 0;
        this.starfield.clearTrails();
        this.clearSectorContents();
        this.zylons.trackDigit = 0;
        this.soundManager.playHyperwarpTransit();
        this.controlPanel.setTitle(PHRASE.HYPERSPACE);
        break;
      case 'charge':
        this.energy.hyperspaceLoop(); // −10 per hyperspace loop
        break;
      case 'complete':
        this.arrive(e.sector.x, e.sector.y, e.vicinityIndex);
        break;
    }
  }

  /**
   * DECELERATION (R: HYPERWARP SKIP069): HYPERWARP COMPLETE, the engines stop, the arrival sector
   * becomes ours with its vicinity mask, and a Zylon sector flashes RED ALERT for 255 loops.
   */
  private arrive(x: number, y: number, vicinityIndex: number): void {
    this.controlPanel.setTitle(PHRASE.HYPERWARP_COMPLETE);
    this.endWarp();
    this.gameState.sectorX = x;
    this.gameState.sectorY = y;
    // §17.5: landing nearer the sector's vertical middle keeps the targets closer.
    this.zylons.vicinityMask = VICINITY_MASK_TABLE[vicinityIndex];
    this.spawnSectorContents();
    if (this.galaxy.zylonsAt(x, y) > 0 && !this.galaxy.hasStarbase(x, y)) {
      this.redAlertLife = RED_ALERT_LOOPS;
      this.controlPanel.setTitle(PHRASE.RED_ALERT);
      this.soundManager.playAlert();
    }
  }

  /** One key press or button (edge-triggered, from the input queue). */
  private handleAction(action: Action): void {
    const view = this.gameState.currentView;
    // §13 step 6: any key but G during docking gives DOCKING ABORTED (the chart's cursor keys
    // are the stick there, which does not turn the ship). The key does its usual job first, so
    // DOCKING ABORTED is the message left on the title line.
    const chartStick = view === ViewMode.GALACTIC_CHART && action.startsWith('STICK_');
    const aborts = this.docking.active && action !== 'CHART' && !chartStick;
    if (!aborts && action === 'SPEED_0') this.docking.retry(); // "retrace the steps": 0 again may dock again
    this.doAction(action, view);
    if (aborts) for (const e of this.docking.interrupt()) this.dockEvent(e);
  }

  private doAction(action: Action, view: ViewMode): void {
    if (action.startsWith('SPEED_')) {
      // R: KEYBOARD — 0–9 aborts an engaged hyperwarp instead of setting the speed (§9).
      if (this.isHyperwarping) this.abortHyperwarp();
      else this.setEngineSpeed(Number(action.slice(6)));
      return;
    }
    switch (action) {
      case 'FRONT':
        return this.switchView(ViewMode.FRONT);
      case 'AFT':
        return this.switchView(ViewMode.AFT);
      case 'CHART':
        return this.switchView(ViewMode.GALACTIC_CHART);
      case 'LRS':
        return this.switchView(ViewMode.LONG_RANGE_SCAN);
      case 'STICK_LEFT':
        if (view === ViewMode.GALACTIC_CHART) this.moveChartCursor(-1, 0);
        return;
      case 'STICK_RIGHT':
        if (view === ViewMode.GALACTIC_CHART) this.moveChartCursor(1, 0);
        return;
      case 'STICK_FORWARD':
        if (view === ViewMode.GALACTIC_CHART) this.moveChartCursor(0, -1);
        return;
      case 'STICK_BACK':
        if (view === ViewMode.GALACTIC_CHART) this.moveChartCursor(0, 1);
        return;
      case 'HYPERWARP':
        // §9: "Make sure you are in the front view (F), then press H."
        if (view === ViewMode.FRONT) this.engageHyperwarp();
        return;
      // R: the T, S and C keys toggle their switch whatever the damage and say ON or OFF.
      case 'SHIELDS':
        // Damaged or destroyed shields can be switched on; then the panel turns orange (§17.3).
        this.gameState.shieldsActive = !this.gameState.shieldsActive;
        this.attackComputer.reset(); // R: UPDSCREEN clears the playfield
        this.controlPanel.setTitle(this.gameState.shieldsActive ? PHRASE.SHIELDS_ON : PHRASE.SHIELDS_OFF);
        return;
      case 'COMPUTER':
        // §5.3, §11: C toggles the attack computer: cross hairs, and the display in the Front view.
        this.gameState.attackComputerOn = !this.gameState.attackComputerOn;
        this.attackComputer.reset();
        this.controlPanel.setTitle(this.gameState.attackComputerOn ? PHRASE.ATTACK_COMPUTER_ON : PHRASE.ATTACK_COMPUTER_OFF);
        return;
      case 'FIRE':
        this.fireTorpedo();
        return;
      case 'TRACKING':
        // §5.10: the panel's T: becomes C: while on, and the view follows the target (computerLoop).
        this.gameState.trackingComputerOn = !this.gameState.trackingComputerOn;
        this.attackComputer.reset();
        this.controlPanel.setTitle(this.gameState.trackingComputerOn ? PHRASE.COMPUTER_TRACKING_ON : PHRASE.TRACKING_OFF);
        return;
      case 'MANUAL_TARGET':
        // §5.8: M switches the target between 0 and 1 (from 2 or 3 too; a starbase sector sets 2 again).
        this.zylons.toggleTarget();
        return;
      case 'PAUSE':
        return; // Phase 11
    }
  }

  /**
   * Switch to a different view
   */
  private switchView(view: ViewMode): void {
    if (this.gameState.currentView === view) return;
    const before = this.starView();

    this.galacticChart.hide();
    this.gameState.currentView = view;
    this.attackComputer.reset(); // R: SETVIEW → UPDSCREEN clears the playfield and the lock

    if (view === ViewMode.GALACTIC_CHART) {
      this.galacticChart.show();
      this.renderChart();
    }

    // Front ↔ aft ↔ scan: a fresh field for the new view (R: SETVIEW → INITPOSVEC).
    if (this.starView() !== before) this.starfield.resetFor(this.starView());
    this.scanPicture = null;
  }

  /**
   * TRIGGER (§17.6, §17.7): one photon per press, from alternating barrels; a barrel refires
   * after 23 loops; −10 energy each. In full lock-on (all three marker pairs) the torpedoes home
   * in and the second one fires by itself; without it the markers hide for 12 display cycles.
   * Shields never block firing (the manual has no such rule).
   */
  private fireTorpedo(): void {
    const locked = this.computerWorking() && this.attackComputer.inLockOn;
    const result = this.zylons.fire(this.simView(), this.gameState.damage.photons, this.isHyperwarping, locked);
    if (result === 'blocked') return;
    this.attackComputer.triggered();
    if (result !== 'launched') return;
    this.energy.firePhoton(); // §12.1: −10 per photon
    this.soundManager.playTorpedoFire();
  }

  /** A speed key 0–9 (§5.1); destroyed engines cap it at key 5 (§17.3, R: KEYBOARD L7202). */
  private setEngineSpeed(speed: number): void {
    this.gameState.targetEngineSpeed = engineKeyFor(speed, this.gameState.damage.engines);
  }

  /** The panel as drawn now; V shows ∞ in hyperspace (§17.2). */
  private panelData() {
    return this.controlPanel.panelData(this.shipVelocity, this.hyperwarp.phase === 'hyperspace');
  }

  /** What the renderer draws for the Front/Aft views this frame. */
  private spaceFrame(): SpaceFrame {
    const objects: SpaceObject[] = [];
    const z = this.zylons;
    for (const sh of z.ships) if (sh.alive) objects.push({ kind: sh.type, x: sh.x, y: sh.y, z: sh.z });
    if (z.pl2.life > 0) objects.push({ kind: z.pl2.kind === 'meteor' ? 'meteor' : 'zylonTorpedo', x: z.pl2.x, y: z.pl2.y, z: z.pl2.z });
    for (const p of z.photons) if (p.life > 0) objects.push({ kind: 'photon', x: p.x, y: p.y, z: p.z });
    if (z.starbase.alive) objects.push({ kind: 'starbase', x: z.starbase.x, y: z.starbase.y, z: z.starbase.z });
    if (z.vessel.alive) objects.push({ kind: 'transferVessel', x: z.vessel.x, y: z.vessel.y, z: z.vessel.z });
    const warp = this.hyperwarp;
    if (warp.markerShown) objects.push({ kind: 'warpMarker', x: warp.marker.x, y: warp.marker.y, z: warp.marker.z });

    return {
      view: this.spaceView(),
      // R: GAMELOOP "Skip during hyperspace": no stars drawn in hyperspace (§17.5).
      stars: warp.phase === 'hyperspace' ? [] : this.starfield.all,
      objects,
      fragments: z.explosion?.fragments ?? [],
      count256: this.controlPanel.colors.count256,
      crosshair: this.crosshairShown(),
      attackComputer: this.attackDisplay(),
      shields: this.controlPanel.colors.shieldsUp,
      redAlertLife: this.redAlertLife,
      hitFlash: this.hitFlash,
      title: this.controlPanel.titleText(),
      panel: this.panelData(),
    };
  }

  /**
   * Cross hairs: the attack computer's (§5.3). Bend (§9 diagram): while the hyperwarp marker
   * is up they show even with C off, so the marker always sits "between the cross hairs" as
   * the manual draws it; a destroyed computer still takes them away (§7).
   */
  private crosshairShown(): boolean {
    if (this.computerWorking()) return true;
    return this.hyperwarp.markerShown && computerFunctions(this.gameState.damage.computer);
  }

  /** The Attack Computer Display: Front view only, computer on and not destroyed (§5.3, §11). */
  private attackDisplay(): AttackDisplay | null {
    if (!this.computerWorking() || this.gameState.currentView !== ViewMode.FRONT) return null;
    return this.attackComputer.display();
  }

  /**
   * Debug controls for the ?debug=1 hook (window.__sr). Not used in normal play.
   * step() switches the game to manual stepping: the requestAnimationFrame loop
   * stops and each step runs one fixed 1/60 s update plus a render.
   */
  public createDebugApi(): GameDebugApi {
    const DT = 1 / 60;
    const frame = () => {
      this.update(DT);
      this.render();
    };

    return {
      state: () => ({
        ...JSON.parse(JSON.stringify(this.gameState)),
        loops: this.clock.loops,
        starDateTicks: this.clock.starDateTicks,
        fleetMoveTicks: this.clock.fleetMoveTicks,
        isHyperwarping: this.isHyperwarping,
        warpPhase: this.hyperwarp.phase,
        isDocking: this.docking.active,
        dockState: this.docking.state,
        enemiesInSector: this.zylons.liveShips,
        starbaseInSector: this.zylons.starbase.alive,
        remainingEnemies: this.galaxy.zylonsLeft,
        starbasesLeft: this.galaxy.starbasesLeft,
        hunted: this.galaxy.hunted,
        surround: this.galaxy.surround,
        galaxyMoveTicks: this.galaxy.moveTicks,
        chartCursor: this.chartCursor,
        chartTitle: this.galacticChart.visible ? this.controlPanel.titleText().trim() || MSG.GALACTIC_CHART : null,
        chartRenders: this.galacticChart.renders,
        manualStepping: !this.gameLoop.running,
        shipVelocity: this.shipVelocity,
        stick: this.stick,
        redAlertLife: this.redAlertLife,
        starCount: this.starfield.stars.length,
        title: this.controlPanel.titleText(),
        titleLife: this.controlPanel.title.lifeLeft,
        titleQueued: this.controlPanel.title.pending?.map((seg) => seg.text) ?? null,
        panel: this.panelData(),
        count256: this.controlPanel.colors.count256,
        settings: { ...getSettings() },
      }),
      galaxy: () => this.galaxy.sectors().map((s) => ({ ...s })),
      teleport: (x: number, y: number) => {
        this.clearSectorContents();
        this.gameState.sectorX = x;
        this.gameState.sectorY = y;
        this.hyperwarp.setDepartureSector(x, y);
        this.spawnSectorContents();
      },
      spawn: (type: DebugSpawnType, distance = 4096, x = 0, y = 0) => {
        if (type === 'starbase') {
          this.zylons.setStarbase({ x, y, z: distance });
          return;
        }
        this.zylons.spawn(type, { x, y, z: distance });
      },
      setView: (view: ViewMode) => this.switchView(view),
      step: (n = 1) => {
        this.gameLoop.stop();
        for (let i = 0; i < n; i++) frame();
      },
      resume: () => this.gameLoop.start(),
      hyperwarp: (x: number, y: number) => {
        // As the manual does it: dot on the chart, then F, then H (§9).
        this.moveChartCursor(x - this.chartCursor.x, y - this.chartCursor.y);
        this.switchView(ViewMode.FRONT);
        this.engageHyperwarp();
      },
      warp: () => {
        const w = this.hyperwarp;
        return JSON.parse(
          JSON.stringify({
            phase: w.phase,
            departure: w.departure,
            arrival: w.arrival,
            chosen: w.chosen,
            arrivalSector: w.arrivalSector,
            warpEnergy: w.warpEnergy,
            veerMask: w.veerMask,
            charges: w.charges,
            marker: w.marker,
            markerShown: w.markerShown,
            trailStars: this.starfield.trails.length,
            velocityBoost: w.velocityBoost,
            transitBeeps: this.soundManager.beeperPatterns.hyperwarpTransit,
            redAlertBeeps: this.soundManager.beeperPatterns.redAlert,
          })
        );
      },
      dock: () => {
        // A starbase 300 KM ahead, 40 KM above the axis (centred, sitting on the cross hair),
        // engines stopped: the next loop establishes the orbit.
        this.zylons.setStarbase({ x: 0, y: 40, z: 300 });
        this.gameState.engineSpeed = 0;
        this.gameState.targetEngineSpeed = 0;
        this.shipVelocity = 0;
        this.docking.retry();
      },
      starbase: () => {
        const z = this.zylons;
        return JSON.parse(
          JSON.stringify({
            starbase: z.starbase,
            vessel: z.vessel,
            dockState: z.starbase.alive ? this.docking.state : 'none',
            interrupted: this.docking.interrupted,
            inPosition:
              z.starbase.alive &&
              inOrbitPosition({
                starbase: z.starbase,
                velocity: this.shipVelocity,
                newVelocity: VELOCITY_TAB[this.gameState.targetEngineSpeed],
                aft: this.gameState.currentView === ViewMode.AFT,
              }),
            starbaseHere: this.galaxy.hasStarbase(this.gameState.sectorX, this.gameState.sectorY),
            starbasesShot: this.missionScore.starbasesShotByYou,
            score: this.missionScore.score,
          })
        );
      },
      setEnergy: (units: number) => {
        this.gameState.energy = Math.max(0, Math.floor(units));
      },
      setSpeed: (key: number) => this.setEngineSpeed(key),
      setShields: (on: boolean) => {
        this.gameState.shieldsActive = on;
      },
      setDamage: (system: Subsystem, status: SubsystemStatus) => {
        this.damageControl.force(system, status);
        this.radioFeed.sync(this.gameState.damage.radio);
        this.renderChart();
      },
      damageReport: (system: Subsystem, status: 'damaged' | 'destroyed') => {
        this.reportDamage(system, status);
        this.renderChart();
      },
      damage: () => {
        const d = this.gameState.damage;
        const bits: Record<string, number> = {};
        for (const [sys, st] of Object.entries(d)) bits[sys] = STATUS_BITS[st];
        return {
          status: this.damageControl.snapshot(),
          bits,
          reports: this.damageControl.reports,
          beeps: this.soundManager.damageReportBeeps,
          effects: {
            photonBarrels: d.photons === 'ok' ? 2 : d.photons === 'damaged' ? 1 : 0,
            speedJitter: d.engines !== 'ok',
            maxSpeedKey: engineKeyFor(9, d.engines),
            shieldsFlicker: d.shields === 'damaged',
            shieldsAlwaysOff: d.shields === 'destroyed',
            readoutsLive: computerReadoutsLive(d.computer),
            crosshairs: computerFunctions(d.computer),
            scan: scanState(d.sectorScan, d.computer),
            chartLive: this.radioFeed.radio === 'ok',
            radioMessages: this.radioFeed.relaysMessages,
          },
        };
      },
      repairAll: () => this.repairAll(),
      scan: () => {
        const d = this.gameState.damage;
        const p = this.scanPicture;
        return {
          scan: scanState(d.sectorScan, d.computer),
          shown: p !== null,
          ship: p?.ship ?? false,
          blips: p?.blips.map((b) => ({ kind: b.kind, x: b.x, z: b.z, col: b.col + 3, row: b.line / 2 + 1, color: b.color })) ?? [],
          stars: p?.stars ?? 0,
          pixels: p?.pixels.length ?? 0,
        };
      },
      setKills: (n: number) => {
        this.gameState.enemiesDestroyed = Math.max(0, Math.floor(n));
      },
      moveCursor: (x: number, y: number) => this.moveChartCursor(x - this.chartCursor.x, y - this.chartCursor.y),
      surround: () => {
        const base = this.galaxy.debugSurround({ x: this.gameState.sectorX, y: this.gameState.sectorY });
        this.renderChart();
        return base;
      },
      toFleetTick: (n = 1) => {
        // Run whole updates (no rendering) up to the n-th next fleet move tick, then render.
        this.gameLoop.stop();
        const target = this.clock.fleetMoveTicks + n;
        let frames = 0;
        while (this.clock.fleetMoveTicks < target && !this.gameState.isGameOver && frames < 200000) {
          this.update(DT);
          frames++;
        }
        this.render();
        return frames;
      },
      killSector: () => {
        // Destroy every Zylon of this sector (live or still to come) through the kill path.
        let n = 0;
        this.zylons.ships.forEach((s, slot) => {
          if (!s.alive) return;
          this.zylons.destroyShip(slot);
          this.zylonKilled(s.debug);
          if (!s.debug) n++;
        });
        while (!this.gameState.isGameOver && this.galaxy.zylonsAt(this.gameState.sectorX, this.gameState.sectorY) > 0) {
          this.zylonKilled(false);
          n++;
        }
        return n;
      },
      stick: (x: number, y: number) => {
        const d = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0) as -1 | 0 | 1;
        this.debugStick = x || y ? { x: d(x), y: d(y) } : null;
      },
      press: (action: Action) => this.input.push(action),
      settings: (patch?: Partial<Settings>) => ({ ...(patch ? updateSettings(patch) : getSettings()) }),
      redAlert: (loops = RED_ALERT_LOOPS) => {
        this.redAlertLife = loops;
        if (loops > 0) this.controlPanel.setTitle(PHRASE.RED_ALERT);
      },
      stars: () =>
        this.starfield.stars.map((s) => ({
          x: s.x,
          y: s.y,
          z: s.z,
          col: s.pixel?.col ?? null,
          row: s.pixel?.row ?? null,
          color: s.color,
        })),
      zylons: () => {
        const z = this.zylons;
        return JSON.parse(
          JSON.stringify({
            ships: z.ships,
            pl2: z.pl2,
            photons: z.photons,
            barrel: z.barrel,
            trackDigit: z.trackDigit,
            homing: z.homing,
            homingTarget: z.homingTarget,
            vicinityMask: z.vicinityMask,
            explosionLife: z.explosion?.life ?? 0,
          })
        );
      },
      attack: () => {
        const a = this.attackComputer;
        return {
          shown: this.attackDisplay() !== null,
          cycle: a.cycle,
          blipCol: a.blipCol,
          blipRow: a.blipRow,
          blipRows: a.blipRows,
          marks: a.marks,
          inLockOn: a.inLockOn,
          lockOnLife: a.lockOnLife,
          trackDigit: this.zylons.trackDigit,
          target: this.trackedObject(),
        };
      },
      meteor: (x: number, y: number, z: number) => {
        const p = this.zylons.pl2;
        Object.assign(p, { kind: 'meteor', life: 60, x, y, z, vel: { x: 0, y: 0, z: -8 } });
      },
    };
  }

  /**
   * Render the Front/Aft views or the Long-Range Scan (the chart draws itself over the screen).
   */
  private render = (): void => {
    if (this.gameState.currentView === ViewMode.LONG_RANGE_SCAN) {
      this.scanPicture ??= this.buildScanPicture();
      this.renderer.renderScan({
        picture: this.scanPicture,
        shields: this.controlPanel.colors.shieldsUp,
        redAlertLife: this.redAlertLife,
        hitFlash: this.hitFlash,
        panel: this.panelData(),
      });
      return;
    }
    this.renderer.render(this.spaceFrame());
  };

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.gameLoop.stop();
    this.unsubscribeSettings();
    this.input.dispose();
    this.controlPanel.dispose();
    this.galacticChart.dispose();
    this.renderer.dispose();
    this.zylons.clear();
  }
}
