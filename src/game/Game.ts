import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { GameState, ViewMode, DifficultyLevel } from './GameState';
import { InputManager } from '../utils/InputManager';
import { EnergySystem } from '../systems/EnergySystem';
import { SectorSystem } from '../systems/SectorSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ScoringSystem } from '../systems/ScoringSystem';
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
    const playerPos = this.player.getObject().position.clone();
    this.combatSystem.update(deltaTime, playerPos);

    // Check torpedo collisions
    const destroyed = this.combatSystem.checkTorpedoCollisions(this.torpedoes);
    if (destroyed.length > 0) {
      this.controlPanel.showMessage(`ZYLON DESTROYED! (${this.sectorSystem.getRemainingEnemies()} remaining)`);
    }

    // Update attack computer
    const target = this.combatSystem.getCurrentTarget();
    this.attackComputer.setTarget(target);
    this.attackComputer.update(playerPos, this.player.getForwardDirection());

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
    const ACCELERATION_RATE = 4.0;

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
      }

      // 3. Move Enemies
      this.combatSystem.applyPlayerMovement(displacement);

      // 4. Move Torpedoes (They fly relative to space, so if we move "space", we move them?)
      // Actually, torpedoes have their own velocity in world space.
      // If the coordinate system is shifting around the player, they need to be shifted too.
      this.torpedoes.forEach(t => t.getObject().position.add(displacement));
    }
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
   * Handle player input
   */
  private handleInput(_deltaTime: number): void {
    // ---- GLOBAL INPUTS (Available in all views) ----

    // Speed control (0-9 keys) - works everywhere
    for (let i = 0; i <= 9; i++) {
      const key = i === 0 ? 'Digit0' : `Digit${i}`;
      if (this.isKeyJustPressed(key)) {
        this.setEngineSpeed(i);
      }
    }

    // View Switching - (F, A, G, L) - Works everywhere (Hot Switching)
    if (this.isKeyJustPressed('KeyF')) {
      this.switchView(ViewMode.FRONT);
    }
    if (this.isKeyJustPressed('KeyA')) {
      this.switchView(ViewMode.AFT);
    }
    if (this.isKeyJustPressed('KeyG')) {
      if (this.gameState.currentView === ViewMode.GALACTIC_CHART) {
        // Toggle off if already here
        this.switchView(ViewMode.FRONT);
      } else {
        this.switchView(ViewMode.GALACTIC_CHART);
      }
    }
    if (this.isKeyJustPressed('KeyL')) {
      if (this.gameState.currentView === ViewMode.LONG_RANGE_SCAN) {
        // Toggle off if already here
        this.switchView(ViewMode.FRONT);
      } else {
        if (this.gameState.damage.longRangeScan) {
          this.controlPanel.showMessage('LONG RANGE SCAN DAMAGED');
        } else {
          this.switchView(ViewMode.LONG_RANGE_SCAN);
        }
      }
    }

    // Toggle shields (S key) - Available everywhere? Or just cockpit?
    // Let's assume global allowed for convenience as requested("jump all the way around")
    if (this.isKeyJustPressed('KeyS')) {
      const active = this.energySystem.toggleShields();
      if (this.gameState.shieldsActive !== active) {
        this.controlPanel.showMessage(active ? 'SHIELDS ACTIVATED' : 'SHIELDS DEACTIVATED');
      }
    }

    // ---- MODE SPECIFIC INPUTS ----

    // Galactic Chart Specifics
    if (this.gameState.currentView === ViewMode.GALACTIC_CHART) {
      this.handleChartInput();
      // Don't process cockpit inputs (fire, rotate)
      this.updateKeyStates();
      return;
    }

    // Long Range Scan Specifics
    // Long Range Scan - Allow rotation
    if (this.gameState.currentView === ViewMode.LONG_RANGE_SCAN) {
      const mouseMovement = this.inputManager.getMouseMovement();
      // Only X rotation (Steering), Y (Pitch) is less relevant/visible on 2D map but let's allow both for feel
      this.player.rotate(mouseMovement.x, mouseMovement.y);
      this.updateKeyStates();
      return;
    }

    // ---- COCKPIT INPUTS (Front/Aft) ----

    // Get mouse movement for ship rotation
    const mouseMovement = this.inputManager.getMouseMovement();

    // In Aft view, controls are reversed
    const reverseControls = this.gameState.currentView === ViewMode.AFT;
    const xMultiplier = reverseControls ? -1 : 1;

    // Rotate player based on mouse input
    this.player.rotate(mouseMovement.x * xMultiplier, mouseMovement.y);

    // Fire torpedo (Spacebar)
    if (this.isKeyJustPressed('Space')) {
      this.fireTorpedo();
    }

    // Targeting - T key for nearest, M key for next
    if (this.isKeyJustPressed('KeyT')) {
      const playerPos = this.player.getObject().position.clone();
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

    // Update key states for next frame
    this.updateKeyStates();
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

    // H key to hyperwarp
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

    // Consume energy
    this.gameState.consumeEnergy(cost);

    this.controlPanel.showMessage('HYPERWARP ENGAGED');
    this.gameState.currentView = ViewMode.FRONT;
  }

  /**
   * Update hyperwarp animation
   */
  private updateHyperwarp(deltaTime: number): void {
    this.hyperwarpProgress += deltaTime * 0.5;

    // Stretch starfield during warp
    const starfieldObj = this.starfield.getObject();
    const stretchFactor = 1 + this.hyperwarpProgress * 10;
    starfieldObj.scale.z = stretchFactor;

    // Move starfield rapidly using individual star recycling
    const direction = this.player.getForwardDirection();
    this.starfield.updateMovement(direction.multiplyScalar(-500 * deltaTime));

    if (this.hyperwarpProgress >= 1 && this.hyperwarpTarget) {
      // Complete hyperwarp
      this.gameState.sectorX = this.hyperwarpTarget.x;
      this.gameState.sectorY = this.hyperwarpTarget.y;
      this.sectorSystem.visitSector(this.hyperwarpTarget.x, this.hyperwarpTarget.y);

      // Reset starfield scale (position handled by individual star recycling)
      starfieldObj.scale.z = 1;

      this.isHyperwarping = false;
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
   * Fire a photon torpedo
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

    const position = this.player.getObject().position.clone();
    let direction = this.player.getForwardDirection();

    if (this.gameState.currentView === ViewMode.AFT) {
      direction.negate();
    }

    position.add(direction.clone().multiplyScalar(2));

    const torpedo = new PhotonTorpedo(position, direction);
    this.torpedoes.push(torpedo);
    this.scene.add(torpedo.getObject());
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
