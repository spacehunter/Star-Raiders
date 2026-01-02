import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { GameState, ViewMode, DifficultyLevel } from './GameState';
import { InputManager } from '../utils/InputManager';
import { EnergySystem } from '../systems/EnergySystem';
import { SectorSystem } from '../systems/SectorSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ScoringSystem } from '../systems/ScoringSystem';
import { StarbaseAttackSystem } from '../systems/StarbaseAttackSystem';
import { Starfield } from '../entities/Starfield';
import { Player } from '../entities/Player';
import { PhotonTorpedo } from '../entities/PhotonTorpedo';
import { Starbase } from '../entities/Starbase';
import { ControlPanel } from '../ui/ControlPanel';
import { GalacticChart } from '../views/GalacticChart';
import { LongRangeScan } from '../views/LongRangeScan';
import { AttackComputer } from '../views/AttackComputer';

type GameOverCallback = (
  victory: boolean,
  score: number,
  rank: string,
  breakdown: {
    enemyScore: number;
    timeBonus: number;
    energyBonus: number;
    starbasePenalty: number;
  }
) => void;

/**
 * Game - Main game controller that manages scene, rendering, and game state
 */
export class Game {
  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  // Game systems
  private gameLoop: GameLoop;
  private inputManager: InputManager;
  private energySystem: EnergySystem;
  private sectorSystem: SectorSystem;
  private combatSystem: CombatSystem;
  private scoringSystem: ScoringSystem;
  private starbaseAttackSystem: StarbaseAttackSystem;
  private gameState: GameState;

  // UI
  private controlPanel: ControlPanel;
  private galacticChart: GalacticChart;
  private longRangeScan: LongRangeScan;
  private attackComputer: AttackComputer;

  // Game entities
  private starfield: Starfield;
  private player: Player;
  private torpedoes: PhotonTorpedo[] = [];
  private currentStarbase: Starbase | null = null;

  // State
  private isInitialized: boolean = false;
  private gameTime: number = 0;
  private gameOverCallback: GameOverCallback | null;
  private hasTriggeredGameOver: boolean = false;

  // Key state tracking for single-press actions
  private keyStates: Map<string, boolean> = new Map();

  // View transition
  private isViewTransitioning: boolean = false;
  private viewTransitionProgress: number = 0;

  // Hyperwarp state
  private isHyperwarping: boolean = false;
  private hyperwarpProgress: number = 0;
  private hyperwarpTarget: { x: number; y: number } | null = null;
  private hyperwarpAlignment: { x: number; y: number } = { x: 0, y: 0 };
  private hyperwarpDifficulty: number = 1;
  private preHyperwarpSpeed: number = 0; // Store player's selected speed before hyperwarp

  // Docking state
  private isDocking: boolean = false;
  private dockingProgress: number = 0;
  private dockingCooldown: number = 0; // Prevent re-docking spam

  constructor(
    container: HTMLElement,
    difficulty: DifficultyLevel = DifficultyLevel.NOVICE,
    onGameOver?: GameOverCallback
  ) {
    this.container = container;
    this.gameOverCallback = onGameOver || null;

    // Initialize game state
    this.gameState = new GameState();
    this.gameState.reset(difficulty);

    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera with fixed aspect ratio for retro resolution
    this.camera = new THREE.PerspectiveCamera(
      90,
      320 / 192, // Fixed aspect ratio (5:3)
      0.1,
      5000
    );

    // Set up renderer - RETRO RESOLUTION (320x192)
    // No antialiasing for sharp pixel edges
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });

    // Fixed internal resolution (2x original Atari 800: 160x96)
    const INTERNAL_WIDTH = 320;
    const INTERNAL_HEIGHT = 192;

    this.renderer.setSize(INTERNAL_WIDTH, INTERNAL_HEIGHT);
    this.renderer.domElement.classList.add('game-canvas');
    container.appendChild(this.renderer.domElement);

    // Initialize game systems
    this.gameLoop = new GameLoop();
    this.inputManager = new InputManager(container);
    this.energySystem = new EnergySystem(this.gameState);
    this.sectorSystem = new SectorSystem();
    this.scoringSystem = new ScoringSystem(this.gameState);

    // Generate galaxy
    this.sectorSystem.generateGalaxy(this.gameState.difficulty);

    // Initialize starbase attack system (enemy strategic AI)
    this.starbaseAttackSystem = new StarbaseAttackSystem(
      this.sectorSystem,
      this.gameState.difficulty
    );

    // Initialize entities
    this.starfield = new Starfield(500, 2000);
    this.player = new Player();

    // Initialize combat system (needs scene)
    this.combatSystem = new CombatSystem(this.scene, this.gameState, this.sectorSystem);

    // Initialize UI
    this.controlPanel = new ControlPanel(container, this.gameState);
    this.galacticChart = new GalacticChart(
      container,
      this.sectorSystem,
      this.gameState,
      this.energySystem
    );
    this.longRangeScan = new LongRangeScan(
      container,
      this.sectorSystem,
      this.gameState,
      this.combatSystem,
      () => this.currentStarbase,
      () => this.player.getObject().rotation.y
    );
    this.attackComputer = new AttackComputer(container, this.gameState);

    // Set up scene
    this.setupScene();

    // Set up starbase attack system message callback
    this.starbaseAttackSystem.setMessageCallback((message, duration) => {
      this.controlPanel.showMessage(message, duration);
    });

    // Connect galactic chart to starbase attack system for visual indicators
    this.galacticChart.setStarbaseAttackSystem(this.starbaseAttackSystem);

    // Handle window resize
    window.addEventListener('resize', this.handleResize);

    // Set up game loop callbacks
    this.gameLoop.setUpdateCallback(this.update);
    this.gameLoop.setRenderCallback(this.render);

    this.isInitialized = true;
  }

  /**
   * Set up the 3D scene
   */
  private setupScene(): void {
    // Add starfield
    this.scene.add(this.starfield.getObject());

    // Add player ship
    this.scene.add(this.player.getObject());

    // Position camera inside the cockpit (first-person view)
    const playerCameraTarget = this.player.getCameraTarget();
    playerCameraTarget.add(this.camera);

    // Position camera slightly forward and up to simulate cockpit view
    this.camera.position.set(0, 0.2, -0.5);
    this.camera.rotation.set(0, 0, 0);

    // Add some ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Spawn enemies and starbase for starting sector
    this.spawnSectorContents();
  }

  /**
   * Spawn enemies and starbase for current sector
   */
  private spawnSectorContents(): void {
    // Spawn enemies
    this.combatSystem.spawnEnemiesForSector();

    // Spawn starbase if present
    const sector = this.sectorSystem.getSector(
      this.gameState.sectorX,
      this.gameState.sectorY
    );

    if (sector?.hasStarbase && !sector.starbaseDestroyed) {
      const starbasePos = new THREE.Vector3(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 30,
        -100 + Math.random() * 50
      );
      this.currentStarbase = new Starbase(starbasePos);
      this.scene.add(this.currentStarbase.getObject());
    }
  }

  /**
   * Clear sector contents
   */
  private clearSectorContents(): void {
    this.combatSystem.clearEnemies();

    if (this.currentStarbase) {
      this.scene.remove(this.currentStarbase.getObject());
      this.currentStarbase.dispose();
      this.currentStarbase = null;
    }
  }

  /**
   * Start the game
   */
  public start(): void {
    if (!this.isInitialized) {
      console.error('Game not initialized');
      return;
    }

    console.log('Star Raiders - Starting game...');
    console.log('Click to enable mouse control');

    this.gameLoop.start();
  }

  /**
   * Stop the game
   */
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

    // Update star date
    this.gameState.starDate += deltaTime * 0.1;

    // Handle docking sequence
    if (this.isDocking) {
      this.updateDocking(deltaTime);
      return;
    }

    // Handle hyperwarp animation
    if (this.isHyperwarping) {
      this.updateHyperwarp(deltaTime);
      return;
    }

    // Handle input
    this.handleInput(deltaTime);

    // Update game systems
    this.energySystem.update(deltaTime);

    // Update player movement based on speed
    this.updatePlayerMovement(deltaTime);

    // Update entities
    this.player.update(deltaTime);
    this.starfield.update(deltaTime);

    // Update starbase
    if (this.currentStarbase) {
      this.currentStarbase.update(deltaTime);
      this.checkDocking();
    }

    // Update torpedoes and check collisions
    this.updateTorpedoes(deltaTime);

    // Update combat system
    // Enemies move independently toward player at (0,0,0)
    // Player movement (updatePlayerMovement) displaces enemies naturally
    // This creates correct relative motion without needing compensation
    const playerPos = this.player.getObject().position.clone();
    this.combatSystem.update(deltaTime, playerPos);

    // Update starbase attack system (enemy strategic AI)
    this.starbaseAttackSystem.update(
      deltaTime,
      this.gameState.sectorX,
      this.gameState.sectorY
    );

    // Check torpedo collisions
    const destroyed = this.combatSystem.checkTorpedoCollisions(this.torpedoes);
    if (destroyed.length > 0) {
      this.controlPanel.showMessage(`ZYLON DESTROYED! (${this.sectorSystem.getRemainingEnemies()} remaining)`);
    }

    // Update attack computer (with all enemies for proximity radar)
    const target = this.combatSystem.getCurrentTarget();
    const allEnemies = this.combatSystem.getEnemies();
    this.attackComputer.setTarget(target);
    this.attackComputer.update(playerPos, this.player.getForwardDirection(), allEnemies);

    // Calculate and update targeting data for control panel (θ, Φ, R)
    this.updateTargetingData(playerPos, target);

    // Handle view transition
    if (this.isViewTransitioning) {
      this.updateViewTransition(deltaTime);
    }

    // Update UI
    this.controlPanel.update();
    this.controlPanel.updateTargetsRemaining(this.sectorSystem.getRemainingEnemies());
    this.galacticChart.update();
    this.longRangeScan.update();

    // Check victory/defeat conditions
    this.checkGameState();
  };

  /**
   * Update targeting data for control panel (θ, Φ, R)
   */
  private updateTargetingData(playerPos: THREE.Vector3, target: import('../entities/Enemy').Enemy | null): void {
    if (!target || !target.isActive) {
      this.controlPanel.updateTargetData(0, 0, 0);
      return;
    }

    const targetPos = target.getPosition();
    const playerDir = this.player.getForwardDirection();

    // Vector from player to target
    const toTarget = targetPos.clone().sub(playerPos);
    const range = toTarget.length();

    // Calculate horizontal angle (theta) - angle in XZ plane
    const toTargetFlat = new THREE.Vector3(toTarget.x, 0, toTarget.z).normalize();
    const playerDirFlat = new THREE.Vector3(playerDir.x, 0, playerDir.z).normalize();

    // Cross product for sign
    const cross = playerDirFlat.clone().cross(toTargetFlat);
    const dotH = playerDirFlat.dot(toTargetFlat);
    let theta = Math.acos(Math.max(-1, Math.min(1, dotH))) * (180 / Math.PI);
    if (cross.y < 0) theta = -theta;

    // Calculate vertical angle (phi) - elevation angle
    toTarget.normalize();
    const phi = (Math.asin(toTarget.y) - Math.asin(playerDir.y)) * (180 / Math.PI);

    // Update control panel with rounded values
    this.controlPanel.updateTargetData(
      Math.round(theta),
      Math.round(phi),
      Math.round(range)
    );
  }

  /**
   * Check for docking opportunity
   */
  private checkDocking(): void {
    if (!this.currentStarbase) return;

    // Decrement cooldown
    if (this.dockingCooldown > 0) {
      this.dockingCooldown -= 1 / 60; // Approximate frame rate
      return;
    }

    const playerPos = this.player.getObject().position.clone();
    const starbasePos = this.currentStarbase.getObject().position;
    const distance = playerPos.distanceTo(starbasePos);
    const speed = this.gameState.engineSpeed;

    // Debug: log every 60 frames (~1 second)
    if (Math.random() < 0.016) {
      console.log(`Docking check: dist=${distance.toFixed(1)}, speed=${speed}, radius=${this.currentStarbase.getDockingRadius()}`);
    }

    if (this.currentStarbase.canDock(playerPos, this.gameState.engineSpeed)) {
      if (!this.isDocking) {
        this.isDocking = true;
        this.dockingProgress = 0;
        this.controlPanel.showMessage('ORBIT ESTABLISHED - DOCKING...');
      }
    }
  }

  /**
   * Update docking sequence
   */
  private updateDocking(deltaTime: number): void {
    this.dockingProgress += deltaTime * 0.5; // 2 seconds to dock

    // Show repair droid message at midpoint
    if (this.dockingProgress >= 0.4 && this.dockingProgress < 0.45) {
      this.controlPanel.showMessage('REPAIR DROID DEPLOYED...');
    }

    if (this.dockingProgress >= 1) {
      // Docking complete - repair and refuel
      this.gameState.energy = this.gameState.maxEnergy;
      this.gameState.damage = {
        engines: false,
        shields: false,
        photonTorpedoes: false,
        subSpaceRadio: false,
        longRangeScan: false,
        attackComputer: false,
      };

      this.isDocking = false;
      this.dockingCooldown = 5; // 5 second cooldown before can dock again
      this.controlPanel.showMessage('DOCKING COMPLETE - FULLY REPAIRED');
    }
  }

  /**
   * Trigger game over
   */
  private triggerGameOver(): void {
    this.hasTriggeredGameOver = true;
    this.gameLoop.stop();

    if (this.gameOverCallback) {
      const breakdown = this.scoringSystem.getScoreBreakdown();
      this.gameOverCallback(
        this.gameState.isVictory,
        breakdown.totalScore,
        breakdown.rank,
        {
          enemyScore: breakdown.enemyScore,
          timeBonus: breakdown.timeBonus,
          energyBonus: breakdown.energyBonus,
          starbasePenalty: breakdown.starbasePenalty,
        }
      );
    }
  }

  /**
   * Check victory/defeat conditions
   */
  private checkGameState(): void {
    // Victory: all enemies destroyed
    if (this.sectorSystem.getRemainingEnemies() <= 0) {
      this.gameState.isVictory = true;
      this.gameState.isGameOver = true;
      this.controlPanel.showMessage('MISSION COMPLETE - ALL ZYLONS DESTROYED!');
    }

    // Defeat: all starbases destroyed
    if (this.sectorSystem.getRemainingStarbases() <= 0) {
      this.gameState.isGameOver = true;
      this.controlPanel.showMessage('MISSION FAILED - ALL STARBASES DESTROYED!');
    }

    // Defeat: out of energy
    if (this.gameState.energy <= 0) {
      this.gameState.isGameOver = true;
      this.controlPanel.showMessage('MISSION FAILED - OUT OF ENERGY!');
    }
  }

  /**
   * Update player movement based on engine speed
  */
  private updatePlayerMovement(deltaTime: number): void {
    // Gradual acceleration/deceleration
    // Rate of 3.0 means ~7 seconds to decelerate from warp speed (20) to stop
    const ACCELERATION_RATE = 3.0;

    if (this.gameState.engineSpeed !== this.gameState.targetEngineSpeed) {
      const diff = this.gameState.targetEngineSpeed - this.gameState.engineSpeed;
      const change = Math.sign(diff) * ACCELERATION_RATE * deltaTime;
      if (Math.abs(change) > Math.abs(diff)) {
        this.gameState.engineSpeed = this.gameState.targetEngineSpeed;
      } else {
        this.gameState.engineSpeed += change;
      }
    }

    if (this.gameState.engineSpeed > 0) {
      const moveSpeed = this.gameState.engineSpeed * 50;  // Faster star rush
      const direction = this.player.getForwardDirection();
      const displacement = direction.multiplyScalar(-moveSpeed * deltaTime);

      // 1. Update Starfield - individual star recycling for consistent density
      this.starfield.updateMovement(displacement);

      // 2. Move Starbase (Relative to Player)
      if (this.currentStarbase) {
        this.currentStarbase.getObject().position.add(displacement);
        this.wrapPositionInSector(this.currentStarbase.getObject().position);
      }

      // 3. Move Enemies - wrap within sector boundaries
      this.combatSystem.applyPlayerMovement(displacement);
      for (const enemy of this.combatSystem.getEnemies()) {
        if (enemy.isActive) {
          this.wrapPositionInSector(enemy.getObject().position);
        }
      }

      // 4. Move Torpedoes - apply displacement to their internal centerPosition
      // Torpedoes track position via centerPosition (not THREE.Points position)
      // This keeps torpedoes in correct world-space as player moves
      // Note: Torpedoes don't wrap - they should expire if they leave the sector
      this.torpedoes.forEach(t => t.applyDisplacement(displacement));
    }
  }

  /**
   * Wrap a position within sector boundaries (toroidal space)
   * Sector matches LRS display range so everything is always visible
   */
  private wrapPositionInSector(position: THREE.Vector3): void {
    // Match LRS RANGE of 500 - sector is ±500 units
    const SECTOR_HALF_SIZE = 500;
    let wrapped = false;

    // Wrap X
    if (position.x > SECTOR_HALF_SIZE) {
      position.x -= SECTOR_HALF_SIZE * 2;
      wrapped = true;
    } else if (position.x < -SECTOR_HALF_SIZE) {
      position.x += SECTOR_HALF_SIZE * 2;
      wrapped = true;
    }

    // Wrap Z (forward/back axis)
    if (position.z > SECTOR_HALF_SIZE) {
      position.z -= SECTOR_HALF_SIZE * 2;
      wrapped = true;
    } else if (position.z < -SECTOR_HALF_SIZE) {
      position.z += SECTOR_HALF_SIZE * 2;
      wrapped = true;
    }

    // Debug: Log when wrapping occurs
    if (wrapped) {
      console.log(`⚠️ Entity wrapped - new position: (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
    }
    // Y (vertical) stays unchanged - space is flat in this game
  }

  /**
   * Update torpedoes
   */
  private updateTorpedoes(deltaTime: number): void {
    for (let i = this.torpedoes.length - 1; i >= 0; i--) {
      const torpedo = this.torpedoes[i];
      torpedo.update(deltaTime);

      if (!torpedo.isActive) {
        this.scene.remove(torpedo.getObject());
        torpedo.dispose();
        this.torpedoes.splice(i, 1);
      }
    }
  }





  /**
   * Handle input when galactic chart is open
   */
  private handleChartInput(): void {
    // Arrow keys to move cursor
    if (this.isKeyJustPressed('ArrowUp')) {
      this.galacticChart.moveCursor(0, -1);
    }
    if (this.isKeyJustPressed('ArrowDown')) {
      this.galacticChart.moveCursor(0, 1);
    }
    if (this.isKeyJustPressed('ArrowLeft')) {
      this.galacticChart.moveCursor(-1, 0);
    }
    if (this.isKeyJustPressed('ArrowRight')) {
      this.galacticChart.moveCursor(1, 0);
    }

    // H key to hyperwarp (Directly from chart)
    if (this.isKeyJustPressed('KeyH')) {
      this.initiateHyperwarp();
    }
  }

  /**
   * Initiate hyperwarp to cursor position
   */
  private initiateHyperwarp(): void {
    const cursor = this.galacticChart.getCursorPosition();

    // Already at this sector?
    if (cursor.x === this.gameState.sectorX && cursor.y === this.gameState.sectorY) {
      this.controlPanel.showMessage('ALREADY IN THIS SECTOR');
      return;
    }

    // Calculate cost
    const cost = this.energySystem.calculateHyperwarpCost(
      this.gameState.sectorX,
      this.gameState.sectorY,
      cursor.x,
      cursor.y
    );

    // Check energy
    if (this.gameState.energy < cost) {
      this.controlPanel.showMessage('INSUFFICIENT ENERGY FOR HYPERWARP');
      return;
    }

    // Clear current sector contents
    this.clearSectorContents();

    // Start hyperwarp
    this.galacticChart.hide();
    this.isHyperwarping = true;
    this.hyperwarpProgress = 0;
    this.hyperwarpTarget = { x: cursor.x, y: cursor.y };
    this.preHyperwarpSpeed = this.gameState.targetEngineSpeed; // Remember player's selected speed

    // Initialize Steering State
    // Start with some random misalignment
    this.hyperwarpAlignment = {
      x: (Math.random() - 0.5) * 20, // Start +/- 10vh off center
      y: (Math.random() - 0.5) * 20
    };

    // Calculate difficulty based on distance
    const dist = Math.sqrt(
      Math.pow(cursor.x - this.gameState.sectorX, 2) +
      Math.pow(cursor.y - this.gameState.sectorY, 2)
    );
    // Harder if jumping far
    this.hyperwarpDifficulty = 1 + (dist * 0.5);

    if (this.gameState.difficulty >= 'WARRIOR') {
      this.hyperwarpDifficulty *= 1.5;
    }

    // Show Marker
    this.controlPanel.setHyperwarpMarkerVisible(true);
    this.controlPanel.updateHyperwarpMarker(this.hyperwarpAlignment.x, this.hyperwarpAlignment.y);

    // Consume energy
    this.gameState.consumeEnergy(cost);

    this.controlPanel.showMessage('HYPERWARPENGAGED - STEER TO TARGET');
    this.gameState.currentView = ViewMode.FRONT;

    // Reset player rotation so we warp "forward"
    this.player.resetRotation();
  }

  /**
   * Update hyperwarp animation and steering
   */
  private updateHyperwarp(deltaTime: number): void {
    const WARP_DURATION = 5.0; // Seconds to complete warp
    this.hyperwarpProgress += deltaTime / WARP_DURATION;

    // --- STEERING MECHANIC ---
    if (this.gameState.difficulty !== 'NOVICE') { // Novice doesn't need to steer
      // 1. Apply Drift (pushes away from center or randomly)
      // Simple Brownian motion for now
      const driftStrength = 15 * this.hyperwarpDifficulty * deltaTime;
      this.hyperwarpAlignment.x += (Math.random() - 0.5) * driftStrength;
      this.hyperwarpAlignment.y += (Math.random() - 0.5) * driftStrength;

      // Constant pull away from center scaling with difficulty
      // this.hyperwarpAlignment.x += Math.sign(this.hyperwarpAlignment.x) * driftStrength * 0.1;

      // 2. Apply Player Input (Mouse steers marker back to center)
      const mouseMove = this.inputManager.getMouseMovement();
      const steerPower = 40 * deltaTime; // Tuning value
      // Note: To "steer into" the marker to fix it, we conceptually move the ship.
      // If marker is Left, we turn Left. If we turn Left, the visual reference (marker) moves Right?
      // Usually in flight sims: Steer TO the needle.
      // Mouse X positive = Turn Right. 
      // If I turn Right, the object in front looks like it moves Left.
      this.hyperwarpAlignment.x -= mouseMove.x * steerPower;
      this.hyperwarpAlignment.y -= mouseMove.y * steerPower;
    } else {
      // Auto-center for Novice
      this.hyperwarpAlignment.x *= 0.95;
      this.hyperwarpAlignment.y *= 0.95;
    }

    // Update UI
    this.controlPanel.updateHyperwarpMarker(this.hyperwarpAlignment.x, this.hyperwarpAlignment.y);


    // Stretch starfield during warp
    const starfieldObj = this.starfield.getObject();
    const stretchFactor = 1 + (Math.sin(this.hyperwarpProgress * Math.PI) * 10); // Pulse effect
    starfieldObj.scale.z = stretchFactor;

    // Move starfield rapidly using individual star recycling
    const direction = this.player.getForwardDirection();
    this.starfield.updateMovement(direction.multiplyScalar(-1000 * deltaTime));

    if (this.hyperwarpProgress >= 1) {
      // Complete hyperwarp
      this.isHyperwarping = false;
      this.controlPanel.setHyperwarpMarkerVisible(false); // Hide marker

      if (!this.hyperwarpTarget) {
        // Safety abort if target lost
        this.starfield.getObject().scale.z = 1;
        this.gameState.engineSpeed = 0;
        return;
      }

      // Check Alignment Success

      // Check Alignment Success
      const alignmentError = Math.sqrt(
        this.hyperwarpAlignment.x * this.hyperwarpAlignment.x +
        this.hyperwarpAlignment.y * this.hyperwarpAlignment.y
      );

      const TOLERANCE = 10; // Acceptance radius (vh)
      let arrivalX = this.hyperwarpTarget.x;
      let arrivalY = this.hyperwarpTarget.y;

      if (alignmentError > TOLERANCE && this.gameState.difficulty !== 'NOVICE') {
        // MISJUMP!
        this.controlPanel.showMessage('HYPERWARP ERROR: NAVIGATION FAILURE');
        // Random adjacent sector
        arrivalX += Math.floor(Math.random() * 3) - 1;
        arrivalY += Math.floor(Math.random() * 3) - 1;
        // Clamp to grid
        arrivalX = Math.max(0, Math.min(7, arrivalX));
        arrivalY = Math.max(0, Math.min(7, arrivalY));
      }

      this.gameState.sectorX = arrivalX;
      this.gameState.sectorY = arrivalY;
      this.sectorSystem.visitSector(arrivalX, arrivalY);

      // Reset starfield scale (position handled by individual star recycling)
      starfieldObj.scale.z = 1;

      // Decelerate from warp speed to player's last selected impulse speed
      // Hyperspace moves at 1000 units/sec, normal impulse = engineSpeed * 50
      // So warp speed equivalent = 1000 / 50 = 20
      this.gameState.engineSpeed = 20; // Exit at actual warp velocity
      this.gameState.targetEngineSpeed = this.preHyperwarpSpeed; // Decelerate to player's selection

      this.hyperwarpTarget = null;

      // Spawn contents for new sector
      this.spawnSectorContents();

      const sector = this.sectorSystem.getSector(this.gameState.sectorX, this.gameState.sectorY);
      if (sector) {
        if (sector.enemies > 0) {
          this.controlPanel.showMessage(`ARRIVED - ${sector.enemies} ZYLONS DETECTED`);
        } else if (sector.hasStarbase && !sector.starbaseDestroyed) {
          this.controlPanel.showMessage('ARRIVED - STARBASE IN SECTOR');
        } else {
          this.controlPanel.showMessage('ARRIVED - SECTOR CLEAR');
        }
      }
    }
  }

  /**
   * Handle user input
   */
  private handleInput(_deltaTime: number): void {
    if (this.isViewTransitioning) return;

    // --- Global View Controls ---
    if (this.isKeyJustPressed('KeyF')) this.switchView(ViewMode.FRONT);
    if (this.isKeyJustPressed('KeyA')) this.switchView(ViewMode.AFT);
    if (this.isKeyJustPressed('KeyG')) this.switchView(ViewMode.GALACTIC_CHART);
    if (this.isKeyJustPressed('KeyL')) this.switchView(ViewMode.LONG_RANGE_SCAN);

    // --- Impulse Engines (0-9) ---
    for (let i = 0; i <= 9; i++) {
      const key = i === 0 ? 'Digit0' : `Digit${i}`;
      if (this.inputManager.isKeyPressed(key)) {
        this.setEngineSpeed(i);
      }
    }

    // --- View Specific Inputs ---
    if (this.gameState.currentView === ViewMode.GALACTIC_CHART) {
      this.handleChartInput();
    }
    else if (this.gameState.currentView === ViewMode.LONG_RANGE_SCAN) {
      // Long Range Scan - Allow rotation
      const mouseMovement = this.inputManager.getMouseMovement();
      // Only X rotation (Steering), Y (Pitch) is less relevant/visible on 2D map but let's allow both for feel
      this.player.rotate(mouseMovement.x, mouseMovement.y);
    }
    else if (this.gameState.currentView === ViewMode.FRONT || this.gameState.currentView === ViewMode.AFT) {
      // --- Cockpit Controls (Front/Aft) ---

      // Get mouse movement for ship rotation
      const mouseMovement = this.inputManager.getMouseMovement();

      // In Aft view, controls are reversed
      const reverseControls = this.gameState.currentView === ViewMode.AFT;
      const xMultiplier = reverseControls ? -1 : 1;

      // Rotate player based on mouse input
      this.player.rotate(mouseMovement.x * xMultiplier, mouseMovement.y);

      // Shields
      if (this.isKeyJustPressed('KeyS')) {
        this.gameState.shieldsActive = !this.gameState.shieldsActive;
        if (this.gameState.damage.shields) {
          this.controlPanel.showMessage('SHIELDS DAMAGED');
          this.gameState.shieldsActive = false;
        } else {
          this.controlPanel.showMessage(this.gameState.shieldsActive ? 'SHIELDS ACTIVATED' : 'SHIELDS DEACTIVATED');
        }
      }

      // Fire Torpedo (Spacebar)
      if (this.isKeyJustPressed('Space')) {
        this.fireTorpedo();
      }

      // Targeting - T key for nearest, M key for next
      if (this.isKeyJustPressed('KeyT')) {
        const playerPos = this.player.getObject().position.clone();
        // Note: selectNearestTarget logic from orphan
        const target = this.combatSystem.selectNearestTarget(playerPos);
        if (target) {
          this.controlPanel.showMessage(`TRACKING: ZYLON ${target.getType()}`);
        } else {
          this.controlPanel.showMessage('NO TARGETS IN RANGE');
        }
      }

      if (this.isKeyJustPressed('KeyM')) {
        const target = this.combatSystem.selectNextTarget();
        if (target) {
          this.controlPanel.showMessage(`TARGET: ZYLON ${target.getType()}`);
        }
      }

      // Hyperwarp Trigger (H Key) - Only works in Front View
      if (this.isKeyJustPressed('KeyH')) {
        if (this.gameState.currentView === ViewMode.FRONT) {
          this.initiateHyperwarp();
        } else {
          this.controlPanel.showMessage('HYPERWARP: SWITCH TO FRONT VIEW');
        }
      }
    }

    // Update key states for next frame
    this.updateKeyStates();
  }

  /**
   * Check if a key was just pressed (not held)
   */
  private isKeyJustPressed(code: string): boolean {
    const isPressed = this.inputManager.isKeyPressed(code);
    const wasPressed = this.keyStates.get(code) || false;
    return isPressed && !wasPressed;
  }

  /**
   * Update key states for tracking single presses
   */
  private updateKeyStates(): void {
    const keysToTrack = [
      'KeyF', 'KeyA', 'KeyS', 'Space', 'KeyG', 'KeyL', 'KeyH', 'KeyT', 'KeyM',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
    ];
    for (let i = 0; i <= 9; i++) {
      keysToTrack.push(i === 0 ? 'Digit0' : `Digit${i}`);
    }

    for (const key of keysToTrack) {
      this.keyStates.set(key, this.inputManager.isKeyPressed(key));
    }
  }

  /**
   * Switch to a different view
   */
  private switchView(view: ViewMode): void {
    if (this.gameState.currentView === view) return;
    if (this.isViewTransitioning) return;

    // Close any previous overlays
    this.galacticChart.hide();
    this.longRangeScan.hide();
    // this.attackComputer.hide(); // If Attack Computer had a mode

    const previousView = this.gameState.currentView;
    this.gameState.currentView = view;

    // Open new overlays if applicable
    if (view === ViewMode.GALACTIC_CHART) {
      this.galacticChart.show();
    }
    if (view === ViewMode.LONG_RANGE_SCAN) {
      this.longRangeScan.show();
    }

    // Handle view transition for Front/Aft
    if (
      (previousView === ViewMode.FRONT && view === ViewMode.AFT) ||
      (previousView === ViewMode.AFT && view === ViewMode.FRONT)
    ) {
      this.isViewTransitioning = true;
      this.viewTransitionProgress = 0;
    } else {
      // Immediate switch (e.g. from Map/LRS)
      if (view === ViewMode.FRONT) {
        this.camera.rotation.y = 0;
      } else if (view === ViewMode.AFT) {
        this.camera.rotation.y = Math.PI;
      }
    }
  }

  /**
   * Update view transition animation
   */
  private updateViewTransition(deltaTime: number): void {
    this.viewTransitionProgress += deltaTime * 3;

    if (this.viewTransitionProgress >= 1) {
      this.viewTransitionProgress = 1;
      this.isViewTransitioning = false;

      if (this.gameState.currentView === ViewMode.AFT) {
        this.camera.rotation.y = Math.PI;
      } else {
        this.camera.rotation.y = 0;
      }
    } else {
      const targetRotation = this.gameState.currentView === ViewMode.AFT ? Math.PI : 0;
      const startRotation = this.gameState.currentView === ViewMode.AFT ? 0 : Math.PI;
      this.camera.rotation.y = startRotation + (targetRotation - startRotation) * this.viewTransitionProgress;
    }
  }

  /**
   * Fire dual photon torpedoes from port and starboard cannons
   */
  private fireTorpedo(): void {
    if (
      this.gameState.currentView !== ViewMode.FRONT &&
      this.gameState.currentView !== ViewMode.AFT
    ) {
      return;
    }

    if (this.gameState.shieldsActive && this.gameState.difficulty !== DifficultyLevel.NOVICE) {
      this.controlPanel.showMessage('LOWER SHIELDS TO FIRE');
      return;
    }

    if (!this.energySystem.fireTorpedo()) {
      if (this.gameState.damage.photonTorpedoes) {
        this.controlPanel.showMessage('WEAPONS DAMAGED');
      } else {
        this.controlPanel.showMessage('INSUFFICIENT ENERGY');
      }
      return;
    }

    const playerPos = this.player.getObject().position.clone();
    let direction = this.player.getForwardDirection();

    if (this.gameState.currentView === ViewMode.AFT) {
      direction.negate();
    }

    // Get player's rotation quaternions for transforming offset positions
    const pitchQuaternion = this.player.getCameraTarget().quaternion;
    const yawQuaternion = this.player.getObject().quaternion;

    // Define cannon offsets relative to ship center
    // Port (left) and starboard (right) positions at the WINGS
    // X offset: ±2.0 creates visible spread angle (~2.3 degrees) toward crosshair
    // Y offset: large negative to make torpedoes appear from VERY BOTTOM of screen
    // (near the player status bar showing velocity/energy)
    // Z offset: 0 to start at camera's Z plane for closest bottom-edge appearance
    const portOffset = new THREE.Vector3(-2.0, -1.4, 0.0);
    const starboardOffset = new THREE.Vector3(2.0, -1.4, 0.0);

    // For aft view, we need a slight negative Z to fire from behind
    if (this.gameState.currentView === ViewMode.AFT) {
      portOffset.z = -0.1;
      starboardOffset.z = -0.1;
    }

    // Apply player rotation to offsets (pitch first, then yaw - same as getForwardDirection)
    portOffset.applyQuaternion(pitchQuaternion);
    portOffset.applyQuaternion(yawQuaternion);
    starboardOffset.applyQuaternion(pitchQuaternion);
    starboardOffset.applyQuaternion(yawQuaternion);

    // Calculate final firing positions - start close to player (bottom of screen)
    const portPosition = playerPos.clone().add(portOffset);
    const starboardPosition = playerPos.clone().add(starboardOffset);

    // Minimal forward offset - torpedoes should start very close to camera at bottom of screen
    portPosition.add(direction.clone().multiplyScalar(0.2));
    starboardPosition.add(direction.clone().multiplyScalar(0.2));

    // Calculate convergence point - where both trajectories meet at crosshair
    // Convergence distance of 50 units places the intersection at crosshair depth
    const CONVERGENCE_DISTANCE = 50;
    const convergencePoint = playerPos.clone().add(direction.clone().multiplyScalar(CONVERGENCE_DISTANCE));

    // Calculate converging trajectories - each torpedo angles toward the convergence point
    const portDirection = convergencePoint.clone().sub(portPosition).normalize();
    const starboardDirection = convergencePoint.clone().sub(starboardPosition).normalize();

    // Create dual torpedoes with converging trajectories
    const portTorpedo = new PhotonTorpedo(portPosition, portDirection);
    const starboardTorpedo = new PhotonTorpedo(starboardPosition, starboardDirection);

    this.torpedoes.push(portTorpedo);
    this.torpedoes.push(starboardTorpedo);
    this.scene.add(portTorpedo.getObject());
    this.scene.add(starboardTorpedo.getObject());
  }

  /**
   * Set engine speed
   */
  private setEngineSpeed(speed: number): void {
    const maxSpeed = this.gameState.damage.engines ? 5 : 9;

    // Set target, don't jump immediately
    this.gameState.targetEngineSpeed = Math.min(speed, maxSpeed);

    if (speed > maxSpeed && this.gameState.damage.engines) {
      this.controlPanel.showMessage('ENGINES DAMAGED - MAX SPEED 5');
    }
  }

  /**
   * Render the scene
   */
  private render = (): void => {
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Handle window resize
   * Note: With retro resolution, we don't resize the renderer.
   * CSS handles the scaling. We just need to ensure the container stays valid.
   */
  private handleResize = (): void => {
    // Fixed internal resolution - no resize needed
    // CSS scaling handles display size
  };

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.gameLoop.stop();
    this.inputManager.dispose();
    this.starfield.dispose();
    this.player.dispose();
    this.controlPanel.dispose();
    this.galacticChart.dispose();
    this.longRangeScan.dispose();
    this.attackComputer.dispose();
    this.combatSystem.dispose();

    if (this.currentStarbase) {
      this.scene.remove(this.currentStarbase.getObject());
      this.currentStarbase.dispose();
    }

    for (const torpedo of this.torpedoes) {
      this.scene.remove(torpedo.getObject());
      torpedo.dispose();
    }
    this.torpedoes = [];

    this.renderer.dispose();
    window.removeEventListener('resize', this.handleResize);

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
