import { GameLoop } from './GameLoop';
import { GameState, ViewMode, DifficultyLevel } from './GameState';
import { Input, type Action } from '../input/Input';
import { SoundManager } from '../audio/SoundManager';
import { Starbase } from '../entities/Starbase';
import { ControlPanel, type TrackedPosition } from '../ui/ControlPanel';
import { GalacticChart } from '../views/GalacticChart';
import { LongRangeScan } from '../views/LongRangeScan';
import { createRng, getSeed, random } from '../core/rng';
import { Vec3 } from '../core/vec3';
import { getSettings, onSettingsChange, updateSettings, type Settings } from '../core/settings';
import { SimClock, type LoopEvents } from '../core/clock';
import { EnergySim } from '../sim/energy';
import { MissionScore, rateMission, type MissionRating } from '../sim/rating';
import { approachVelocity, KM_PER_UNIT, moveInShipFrame, STICK_CENTERED, type Stick } from '../sim/motion';
import type { MissionOutcome } from '../rules/rating';
import { VELOCITY_TAB } from '../rules/speed';
import { calcWarpSectors } from '../rules/warp';
import { SUBSYSTEMS, type Subsystem, type SubsystemStatus } from '../rules/damage';
import { MSG, PHRASE, endOfMissionPhrase, subsystemPhrase } from '../rules/messages';
import { Galaxy, RadioFeed, GALAXY_COLUMNS, GALAXY_ROWS, type GalaxyEvent, type SectorPos } from '../sim/galaxy';
import { Renderer, type SpaceFrame, type SpaceObject } from '../render/Renderer';
import { resolveShipHit, VICINITY_MASK_TABLE, ZylonSim, type SimView, type ZylonEvent, type ZylonType } from '../sim/zylons';
import { CLASSIC_STARS, ENHANCED_STARS, Starfield } from '../render/starfield';
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
  dock(): void;
  setEnergy(units: number): void;
  setSpeed(key: number): void;
  setShields(on: boolean): void;
  setDamage(system: Subsystem, status: SubsystemStatus): void;
  damageReport(system: Subsystem, status: 'damaged' | 'destroyed'): void;
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
  meteor(x: number, y: number, z: number): void;
}

type GameOverCallback = (rating: MissionRating) => void;

/** Loops the background flashes random colours after a hit with shields up (§17.13). */
const HIT_FLASH_LOOPS = 16;
/** R: the Zylon torpedo's ship is earmarked; θ Φ R and T follow it while the computer is on. */
/** R: REDALERTLIFE on entering a Zylon sector. */
const RED_ALERT_LOOPS = 255;
/** Ship velocity (KM/loop) when it drops out of hyperspace; it slows by 1 per loop (R: UPDPANEL). */
const WARP_EXIT_VELOCITY = 120;
/** Velocity used for the streaming stars while hyperwarping (Phase 8 brings the ROM's 254 and trails). */
const HYPERWARP_VELOCITY = 112;
/** Fraction of the placeholder hyperwarp after which the ship counts as in hyperspace (Phase 8 replaces it). */
const HYPERSPACE_FROM = 0.5;

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
  private soundManager: SoundManager;
  private gameState: GameState;
  private unsubscribeSettings: () => void;

  // UI
  private controlPanel: ControlPanel;
  private galacticChart: GalacticChart;
  private longRangeScan: LongRangeScan;
  /** Hyperwarp destination dot on the chart (§8); kept between visits. */
  private chartCursor: SectorPos = { x: 8, y: 4 };

  // Space objects
  private currentStarbase: Starbase | null = null;

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

  // Hyperwarp state
  private isHyperwarping: boolean = false;
  private hyperwarpProgress: number = 0;
  private hyperwarpTarget: { x: number; y: number } | null = null;
  /** Marker offset from the playfield centre, in playfield pixels. */
  private hyperwarpAlignment: { x: number; y: number } = { x: 0, y: 0 };
  private hyperwarpDifficulty: number = 1;

  // Docking state
  private isDocking: boolean = false;
  private dockingProgress: number = 0;
  private dockingCooldown: number = 0; // Prevent re-docking spam

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
      this.starfield.setCount(this.starCount(s), this.spaceView());
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
    this.chartCursor = { x: this.gameState.sectorX, y: this.gameState.sectorY };

    this.zylons = new ZylonSim(random);
    this.soundManager = new SoundManager();

    this.controlPanel = new ControlPanel(this.gameState, random);
    this.galacticChart = new GalacticChart(container);
    this.longRangeScan = new LongRangeScan(container, this.gameState, () => this.scanBlips());

    // §17.1: a game starts at speed key 6.
    this.shipVelocity = VELOCITY_TAB[this.gameState.targetEngineSpeed];

    this.spawnSectorContents();

    this.gameLoop.setUpdateCallback(this.update);
    this.gameLoop.setRenderCallback(this.render);
  }

  private starCount(s: Settings): number {
    return s.stars === 'enhanced' ? ENHANCED_STARS : CLASSIC_STARS;
  }

  /** The view whose space the stars belong to (the chart and scan keep the front field). */
  private spaceView(): SpaceView {
    return this.gameState.currentView === ViewMode.AFT ? 'AFT' : 'FRONT';
  }

  /**
   * Spawn enemies and starbase for current sector
   */
  private spawnSectorContents(): void {
    const { sectorX: x, sectorY: y } = this.gameState;
    // Zylon ships enter one at a time from the sector's count (sim/zylons.ts, §17.8).
    this.zylons.clear();

    if (this.galaxy.hasStarbase(x, y)) {
      const starbasePos = new Vec3((random() - 0.5) * 100, (random() - 0.5) * 30, 100 - random() * 50);
      this.currentStarbase = new Starbase(starbasePos);
    }
  }

  /**
   * Clear sector contents
   */
  private clearSectorContents(): void {
    this.zylons.clear();
    this.currentStarbase = null;
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

    if (this.isDocking) {
      this.updateDocking(deltaTime);
      return;
    }

    if (this.isHyperwarping) {
      this.updateHyperwarp(deltaTime);
      return;
    }

    for (const action of actions) this.handleAction(action);
    if (this.gameState.isGameOver) return;

    if (this.currentStarbase) {
      this.currentStarbase.update(deltaTime);
      this.checkDocking();
    }
    this.gameState.isUnderAttack = this.zylons.torpedoFlying;

    this.renderChart();
    this.longRangeScan.update();

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
      hyperwarp: this.isHyperwarping,
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

    // Velocity steps 1 KM/loop toward the chosen key (R: UPDPANEL).
    const target = this.isHyperwarping ? HYPERWARP_VELOCITY : VELOCITY_TAB[this.gameState.targetEngineSpeed];
    this.shipVelocity = approachVelocity(this.shipVelocity, target);
    this.gameState.engineSpeed = keyForVelocity(this.shipVelocity);

    // The ROM does not rotate in the Galactic Chart view; in hyperwarp the stick steers the marker.
    const turn: Stick = view === ViewMode.GALACTIC_CHART || this.isHyperwarping || this.isDocking ? STICK_CENTERED : stick;
    const dzUnits = this.shipVelocity / KM_PER_UNIT;
    if (this.currentStarbase) moveInShipFrame(this.currentStarbase.getObject().position, turn, dzUnits);
    this.wrapSectorObjects();

    this.starfield.loop(turn, this.shipVelocity, this.spaceView(), this.clock.loops & 7);

    // Zylons, torpedoes, meteors and explosions (R: GAMELOOP steps 8–12, 21, 23, 25–27).
    const { sectorX: sx, sectorY: sy } = this.gameState;
    const events = this.zylons.loop({
      turn,
      velocity: this.shipVelocity,
      view: this.simView(),
      level: this.gameState.difficulty,
      sectorZylons: this.galaxy.zylonsAt(sx, sy),
      starbaseSector: this.galaxy.hasStarbase(sx, sy),
      hyperwarp: this.isHyperwarping,
      count256: this.controlPanel.colors.count256,
      computer: this.gameState.attackComputerOn && this.gameState.damage.computer !== 'destroyed',
    });
    for (const e of events) this.zylonEvent(e);

    if (this.redAlertLife > 0) this.redAlertLife--;
    if (this.hitFlash > 0) this.hitFlash--;
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
      case 'basestarHit':
      case 'shotDown':
        this.soundManager.playExplosion();
        break;
      case 'shipHit':
        this.shipHit(e.by, e.torpedoLife);
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

  /** Long-range scan blips in KM: Zylon ships, the meteor and the starbase (Phase 9 redraws the scan). */
  private scanBlips(): Array<{ x: number; z: number; kind: 'enemy' | 'starbase' }> {
    const out: Array<{ x: number; z: number; kind: 'enemy' | 'starbase' }> = [];
    for (const s of this.zylons.ships) if (s.alive) out.push({ x: s.x, z: s.z, kind: 'enemy' });
    const m = this.zylons.pl2;
    if (m.kind === 'meteor' && m.life > 0) out.push({ x: m.x, z: m.z, kind: 'enemy' });
    if (this.currentStarbase) {
      const p = this.currentStarbase.getObject().position;
      out.push({ x: p.x * KM_PER_UNIT, z: p.z * KM_PER_UNIT, kind: 'starbase' });
    }
    return out;
  }

  /** Keep the starbase inside the sector (±500 units, toroidal in x and z; Phase 10 rebuilds it). */
  private wrapSectorObjects(): void {
    const wrap = (p: Vec3) => {
      const H = 500;
      if (p.x > H) p.x -= 2 * H;
      else if (p.x < -H) p.x += 2 * H;
      if (p.z > H) p.z -= 2 * H;
      else if (p.z < -H) p.z += 2 * H;
    };
    if (this.currentStarbase) wrap(this.currentStarbase.getObject().position);
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
            this.currentStarbase = null;
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
      warpEnergy: calcWarpSectors(sectorX, sectorY, c.x, c.y).units,
      targets: this.radioFeed.targets(c.x, c.y),
      starDate: this.gameState.starDate,
      damage: this.gameState.damage,
    });
  }

  /** Move the hyperwarp destination dot by whole sectors, clamped to the chart. */
  private moveChartCursor(dx: number, dy: number): void {
    this.chartCursor = {
      x: Math.max(0, Math.min(GALAXY_COLUMNS - 1, this.chartCursor.x + dx)),
      y: Math.max(0, Math.min(GALAXY_ROWS - 1, this.chartCursor.y + dy)),
    };
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
   * Ship-frame position (KM) of the object the panel's θ Φ R read (§6, §17.2). Our starship
   * sits at the origin facing +z. (Phase 6 brings the ROM's target slots 0–3.)
   */
  private trackedPosition(): TrackedPosition | null {
    this.controlPanel.setTrackDigit(this.zylons.trackDigit);
    const target = this.zylons.trackedShip();
    return target ? { x: target.x, y: target.y, z: target.z } : null;
  }

  /**
   * Check for docking opportunity
   */
  private checkDocking(): void {
    if (!this.currentStarbase) return;
    if (this.dockingCooldown > 0) {
      this.dockingCooldown -= 1 / 60;
      return;
    }
    if (this.currentStarbase.canDock(new Vec3(), this.gameState.engineSpeed) && !this.isDocking) {
      this.isDocking = true;
      this.dockingProgress = 0;
      // ORBIT ESTABLISHED, then STANDBY; docking also empties the title queue (R: DOCKING).
      this.controlPanel.setTitle(PHRASE.ORBIT_ESTABLISHED);
      this.controlPanel.title.clearQueue();
    }
  }

  /**
   * Update docking sequence
   */
  private updateDocking(deltaTime: number): void {
    this.dockingProgress += deltaTime * 0.5; // 2 seconds to dock (Phase 10 brings the transfer vessel)

    if (this.dockingProgress >= 1) {
      this.energy.refill();
      for (const sys of SUBSYSTEMS) this.gameState.damage[sys] = 'ok';
      this.isDocking = false;
      this.dockingCooldown = 5;
      this.controlPanel.setTitle(PHRASE.TRANSFER_COMPLETE);
    }
  }

  private triggerGameOver(): void {
    this.hasTriggeredGameOver = true;
    this.galacticChart.hide();
    this.longRangeScan.hide();
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

  /** R: DAMAGE — DAMAGE CONTROL now; the subsystem phrase waits in the queue and repeats until docking. */
  private reportDamage(system: Subsystem, status: 'damaged' | 'destroyed'): void {
    this.gameState.damage[system] = status;
    this.controlPanel.setTitle(PHRASE.DAMAGE_CONTROL);
    this.controlPanel.enqueueTitle(subsystemPhrase(system, status));
  }

  /**
   * Initiate hyperwarp to cursor position
   */
  private initiateHyperwarp(): void {
    const cursor = this.chartCursor;

    if (cursor.x === this.gameState.sectorX && cursor.y === this.gameState.sectorY) return;

    // CALCWARP (§12.3, §17.5). The ROM never refuses a jump for lack of energy:
    // hyperspace drains 10 per loop and can run the tank dry.
    const cost = calcWarpSectors(this.gameState.sectorX, this.gameState.sectorY, cursor.x, cursor.y);

    this.clearSectorContents();
    this.galacticChart.hide();
    this.longRangeScan.hide();
    this.isHyperwarping = true;
    this.hyperwarpProgress = 0;
    this.hyperwarpTarget = { x: cursor.x, y: cursor.y };

    // Start with some misalignment of the marker (playfield pixels from the centre).
    this.hyperwarpAlignment = { x: (random() - 0.5) * 20, y: (random() - 0.5) * 20 };

    const dist = Math.hypot(cursor.x - this.gameState.sectorX, cursor.y - this.gameState.sectorY);
    this.hyperwarpDifficulty = 1 + dist * 0.5;
    if (this.gameState.difficulty === 'WARRIOR' || this.gameState.difficulty === 'COMMANDER') {
      this.hyperwarpDifficulty *= 1.5;
    }

    this.controlPanel.setHyperwarpMarkerVisible(true);
    this.controlPanel.updateHyperwarpMarker(this.hyperwarpAlignment.x, this.hyperwarpAlignment.y);

    // Hyperspace drain: 10 units per loop for WARPENERGY - 1 loops
    this.energy.beginHyperspace(cost.warpEnergy);

    this.controlPanel.setTitle(PHRASE.HYPERWARP_ENGAGED);
    if (this.gameState.currentView !== ViewMode.FRONT) {
      this.gameState.currentView = ViewMode.FRONT;
      this.starfield.resetFor('FRONT');
    }
  }

  /**
   * Update hyperwarp: the stick steers the marker (PILOT and up), then arrival.
   * (Phase 8 replaces this with the ROM's phases, costs and landing rules.)
   */
  private updateHyperwarp(deltaTime: number): void {
    const WARP_DURATION = 5.0;
    const before = this.hyperwarpProgress;
    this.hyperwarpProgress += deltaTime / WARP_DURATION;
    // In hyperspace (the second half here) the panel shows V ∞ and the title HYPERSPACE (§17.5).
    if (before <= HYPERSPACE_FROM && this.hyperwarpProgress > HYPERSPACE_FROM) this.controlPanel.setTitle(PHRASE.HYPERSPACE);

    if (this.gameState.difficulty !== 'NOVICE') {
      const driftStrength = 15 * this.hyperwarpDifficulty * deltaTime;
      this.hyperwarpAlignment.x += (random() - 0.5) * driftStrength;
      this.hyperwarpAlignment.y += (random() - 0.5) * driftStrength;
      // Steering toward the marker moves it back toward the centre.
      const steer = 30 * deltaTime;
      this.hyperwarpAlignment.x -= this.stick.x * steer;
      this.hyperwarpAlignment.y += this.stick.y * steer;
    } else {
      this.hyperwarpAlignment.x *= 0.95;
      this.hyperwarpAlignment.y *= 0.95;
    }
    this.controlPanel.updateHyperwarpMarker(this.hyperwarpAlignment.x, this.hyperwarpAlignment.y);

    if (this.hyperwarpProgress < 1) return;

    this.isHyperwarping = false;
    this.controlPanel.setHyperwarpMarkerVisible(false);
    if (!this.hyperwarpTarget) return;

    const alignmentError = Math.hypot(this.hyperwarpAlignment.x, this.hyperwarpAlignment.y);
    const TOLERANCE = 10;
    let arrivalX = this.hyperwarpTarget.x;
    let arrivalY = this.hyperwarpTarget.y;
    if (alignmentError > TOLERANCE && this.gameState.difficulty !== 'NOVICE') {
      arrivalX = Math.max(0, Math.min(GALAXY_COLUMNS - 1, arrivalX + Math.floor(random() * 3) - 1));
      arrivalY = Math.max(0, Math.min(GALAXY_ROWS - 1, arrivalY + Math.floor(random() * 3) - 1));
    }
    this.gameState.sectorX = arrivalX;
    this.gameState.sectorY = arrivalY;
    this.hyperwarpTarget = null;

    // Drop out of hyperspace fast and slow down to the chosen speed.
    this.shipVelocity = WARP_EXIT_VELOCITY;
    // R: VICINITYMASK from bits 3..1 of the arrival marker's PM row (Phase 8 brings the real marker).
    this.zylons.vicinityMask = VICINITY_MASK_TABLE[((122 + 2 * Math.round(this.hyperwarpAlignment.y)) >> 1) & 7];
    this.spawnSectorContents();
    this.controlPanel.setTitle(PHRASE.HYPERWARP_COMPLETE);

    // R: "Flash red alert if Zylon sector entered" (255 loops).
    if (this.galaxy.zylonsAt(arrivalX, arrivalY) > 0) {
      this.redAlertLife = RED_ALERT_LOOPS;
      this.controlPanel.setTitle(PHRASE.RED_ALERT);
      this.soundManager.playAlert();
    }
  }

  /** One key press or button (edge-triggered, from the input queue). */
  private handleAction(action: Action): void {
    const view = this.gameState.currentView;
    if (action.startsWith('SPEED_')) {
      this.setEngineSpeed(Number(action.slice(6)));
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
        // §9: from the chart's destination dot, or from the front view.
        if (view === ViewMode.GALACTIC_CHART || view === ViewMode.FRONT) this.initiateHyperwarp();
        return;
      // R: the T, S and C keys toggle their switch whatever the damage and say ON or OFF.
      case 'SHIELDS':
        // Damaged or destroyed shields can be switched on; then the panel turns orange (§17.3).
        this.gameState.shieldsActive = !this.gameState.shieldsActive;
        this.controlPanel.setTitle(this.gameState.shieldsActive ? PHRASE.SHIELDS_ON : PHRASE.SHIELDS_OFF);
        return;
      case 'COMPUTER':
        // §5.3: C toggles the attack computer and its cross hairs (the display box is Phase 6).
        this.gameState.attackComputerOn = !this.gameState.attackComputerOn;
        this.controlPanel.setTitle(this.gameState.attackComputerOn ? PHRASE.ATTACK_COMPUTER_ON : PHRASE.ATTACK_COMPUTER_OFF);
        return;
      case 'FIRE':
        this.fireTorpedo();
        return;
      case 'TRACKING':
        // §5.10: the panel's T: becomes C: while on. (Front/aft auto-switching is Phase 6.)
        this.gameState.trackingComputerOn = !this.gameState.trackingComputerOn;
        this.controlPanel.setTitle(this.gameState.trackingComputerOn ? PHRASE.COMPUTER_TRACKING_ON : PHRASE.TRACKING_OFF);
        return;
      case 'MANUAL_TARGET':
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
    const before = this.spaceView();

    this.galacticChart.hide();
    this.longRangeScan.hide();
    this.gameState.currentView = view;

    if (view === ViewMode.GALACTIC_CHART) {
      this.galacticChart.show();
      this.renderChart();
    }
    if (view === ViewMode.LONG_RANGE_SCAN) this.longRangeScan.show();

    // Front ↔ aft: a fresh field for the new direction (R: offscreen stars get new positions).
    if (this.spaceView() !== before) this.starfield.resetFor(this.spaceView());
  }

  /**
   * TRIGGER (§17.7): one photon per press, from alternating barrels; a barrel refires after 23
   * loops; −10 energy each. Shields never block firing (the manual has no such rule).
   */
  private fireTorpedo(): void {
    const launched = this.zylons.fire(this.simView(), this.gameState.damage.photons, this.isHyperwarping);
    if (!launched) return;
    this.energy.firePhoton(); // §12.1: −10 per photon
    this.soundManager.playTorpedoFire();
  }

  private setEngineSpeed(speed: number): void {
    const maxSpeed = this.gameState.damage.engines !== 'ok' ? 5 : 9;
    this.gameState.targetEngineSpeed = Math.min(speed, maxSpeed);
  }

  /** The panel as drawn now; V shows ∞ in hyperspace (§17.2). */
  private panelData() {
    return this.controlPanel.panelData(this.shipVelocity, this.isHyperwarping && this.hyperwarpProgress > HYPERSPACE_FROM);
  }

  /** What the renderer draws for the Front/Aft views this frame. */
  private spaceFrame(): SpaceFrame {
    const objects: SpaceObject[] = [];
    const z = this.zylons;
    for (const sh of z.ships) if (sh.alive) objects.push({ kind: sh.type, x: sh.x, y: sh.y, z: sh.z });
    if (z.pl2.life > 0) objects.push({ kind: z.pl2.kind === 'meteor' ? 'meteor' : 'zylonTorpedo', x: z.pl2.x, y: z.pl2.y, z: z.pl2.z });
    for (const p of z.photons) if (p.life > 0) objects.push({ kind: 'photon', x: p.x, y: p.y, z: p.z });
    if (this.currentStarbase) {
      const p = this.currentStarbase.getObject().position;
      objects.push({ kind: 'starbase', x: p.x * KM_PER_UNIT, y: p.y * KM_PER_UNIT, z: p.z * KM_PER_UNIT });
    }

    return {
      view: this.spaceView(),
      stars: this.starfield.stars,
      objects,
      fragments: z.explosion?.fragments ?? [],
      count256: this.controlPanel.colors.count256,
      crosshair: this.gameState.attackComputerOn && this.gameState.damage.computer !== 'destroyed',
      shields: this.controlPanel.colors.shieldsUp,
      redAlertLife: this.redAlertLife,
      hitFlash: this.hitFlash,
      title: this.controlPanel.titleText(),
      panel: this.panelData(),
      warpMarker: this.controlPanel.getWarpMarker(),
    };
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
        hyperspaceLoopsLeft: this.energy.hyperspaceLoopsLeft,
        isHyperwarping: this.isHyperwarping,
        hyperwarpProgress: this.hyperwarpProgress,
        isDocking: this.isDocking,
        dockingProgress: this.dockingProgress,
        enemiesInSector: this.zylons.liveShips,
        starbaseInSector: this.currentStarbase !== null,
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
        this.spawnSectorContents();
      },
      spawn: (type: DebugSpawnType, distance = 4096, x = 0, y = 0) => {
        if (type === 'starbase') {
          const pos = new Vec3(x / KM_PER_UNIT, y / KM_PER_UNIT, distance / KM_PER_UNIT);
          if (this.currentStarbase) this.currentStarbase.getObject().position.copy(pos);
          else this.currentStarbase = new Starbase(pos);
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
        this.moveChartCursor(x - this.chartCursor.x, y - this.chartCursor.y);
        this.initiateHyperwarp();
      },
      dock: () => {
        if (!this.currentStarbase) this.currentStarbase = new Starbase(new Vec3());
        this.currentStarbase.getObject().position.copy(new Vec3(0, 0, 30));
        this.gameState.engineSpeed = 0;
        this.gameState.targetEngineSpeed = 0;
        this.shipVelocity = 0;
        this.dockingCooldown = 0;
        this.checkDocking();
      },
      setEnergy: (units: number) => {
        this.gameState.energy = Math.max(0, Math.floor(units));
      },
      setSpeed: (key: number) => this.setEngineSpeed(key),
      setShields: (on: boolean) => {
        this.gameState.shieldsActive = on;
      },
      setDamage: (system: Subsystem, status: SubsystemStatus) => {
        this.gameState.damage[system] = status;
        this.radioFeed.sync(this.gameState.damage.radio);
        this.renderChart();
      },
      damageReport: (system: Subsystem, status: 'damaged' | 'destroyed') => {
        this.reportDamage(system, status);
        this.radioFeed.sync(this.gameState.damage.radio);
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
            vicinityMask: z.vicinityMask,
            explosionLife: z.explosion?.life ?? 0,
          })
        );
      },
      meteor: (x: number, y: number, z: number) => {
        const p = this.zylons.pl2;
        Object.assign(p, { kind: 'meteor', life: 60, x, y, z, vel: { x: 0, y: 0, z: -8 } });
      },
    };
  }

  /**
   * Render the Front/Aft views (the chart and scan draw themselves over the screen).
   */
  private render = (): void => {
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
    this.longRangeScan.dispose();
    this.renderer.dispose();
    this.zylons.clear();
    this.currentStarbase = null;
  }
}
