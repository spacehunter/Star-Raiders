import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { GameState, ViewMode, DifficultyLevel } from './GameState';
import { InputManager } from '../utils/InputManager';
import { EnergySystem } from '../systems/EnergySystem';
import { SectorSystem } from '../systems/SectorSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { Starfield } from '../entities/Starfield';
import { Player } from '../entities/Player';
import { PhotonTorpedo } from '../entities/PhotonTorpedo';
import { ControlPanel } from '../ui/ControlPanel';
import { GalacticChart } from '../views/GalacticChart';
import { LongRangeScan } from '../views/LongRangeScan';
import { AttackComputer } from '../views/AttackComputer';

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

  // State
  private isInitialized: boolean = false;
  private gameTime: number = 0;

  // Key state tracking for single-press actions
  private keyStates: Map<string, boolean> = new Map();

  // View transition
  private isViewTransitioning: boolean = false;
  private viewTransitionProgress: number = 0;

  // Hyperwarp state
  private isHyperwarping: boolean = false;
  private hyperwarpProgress: number = 0;
  private hyperwarpTarget: { x: number; y: number } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // Initialize game state
    this.gameState = new GameState();
    this.gameState.reset(DifficultyLevel.NOVICE);

    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Set up camera with 75 degree FOV
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      5000
    );

    // Set up renderer with antialiasing
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Initialize game systems
    this.gameLoop = new GameLoop();
    this.inputManager = new InputManager(container);
    this.energySystem = new EnergySystem(this.gameState);
    this.sectorSystem = new SectorSystem();

    // Generate galaxy
    this.sectorSystem.generateGalaxy(this.gameState.difficulty);

    // Initialize entities
    this.starfield = new Starfield(5000, 2000);
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
    this.longRangeScan = new LongRangeScan(container, this.sectorSystem, this.gameState);
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

    // Spawn enemies for starting sector
    this.combatSystem.spawnEnemiesForSector();
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
    if (this.gameState.isGameOver) return;

    this.gameTime += deltaTime;

    // Update star date
    this.gameState.starDate += deltaTime * 0.1;

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

    // Handle view transition
    if (this.isViewTransitioning) {
      this.updateViewTransition(deltaTime);
    }

    // Update UI
    this.controlPanel.update();
    this.galacticChart.update();
    this.longRangeScan.update();

    // Check victory/defeat conditions
    this.checkGameState();
  };

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
  }

  /**
   * Update player movement based on engine speed
   */
  private updatePlayerMovement(deltaTime: number): void {
    if (this.gameState.engineSpeed > 0) {
      const moveSpeed = this.gameState.engineSpeed * 10;
      const direction = this.player.getForwardDirection();

      // Move the starfield in opposite direction to simulate forward movement
      const starfieldObj = this.starfield.getObject();
      starfieldObj.position.add(direction.multiplyScalar(-moveSpeed * deltaTime));

      // Wrap starfield position
      const maxDist = 1000;
      if (starfieldObj.position.length() > maxDist) {
        starfieldObj.position.set(0, 0, 0);
      }
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
    // Check if viewing chart or scan - handle their inputs specially
    if (this.galacticChart.visible) {
      this.handleChartInput();
      this.updateKeyStates();
      return;
    }

    if (this.longRangeScan.visible) {
      if (this.isKeyJustPressed('KeyL')) {
        this.longRangeScan.hide();
        this.gameState.currentView = ViewMode.FRONT;
      }
      this.updateKeyStates();
      return;
    }

    // Get mouse movement for ship rotation
    const mouseMovement = this.inputManager.getMouseMovement();

    // In Aft view, controls are reversed
    const reverseControls = this.gameState.currentView === ViewMode.AFT;
    const xMultiplier = reverseControls ? -1 : 1;

    // Rotate player based on mouse input
    this.player.rotate(mouseMovement.x * xMultiplier, mouseMovement.y);

    // View switching
    if (this.isKeyJustPressed('KeyF')) {
      this.switchView(ViewMode.FRONT);
    }
    if (this.isKeyJustPressed('KeyA')) {
      this.switchView(ViewMode.AFT);
    }
    if (this.isKeyJustPressed('KeyG')) {
      this.galacticChart.show();
      this.gameState.currentView = ViewMode.GALACTIC_CHART;
    }
    if (this.isKeyJustPressed('KeyL')) {
      if (this.gameState.damage.longRangeScan) {
        this.controlPanel.showMessage('LONG RANGE SCAN DAMAGED');
      } else {
        this.longRangeScan.show();
        this.gameState.currentView = ViewMode.LONG_RANGE_SCAN;
      }
    }

    // Fire torpedo (Spacebar)
    if (this.isKeyJustPressed('Space')) {
      this.fireTorpedo();
    }

    // Toggle shields (S key)
    if (this.isKeyJustPressed('KeyS')) {
      const active = this.energySystem.toggleShields();
      if (this.gameState.shieldsActive !== active) {
        this.controlPanel.showMessage(active ? 'SHIELDS ACTIVATED' : 'SHIELDS DEACTIVATED');
      }
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

    // Speed control (0-9 keys)
    for (let i = 0; i <= 9; i++) {
      const key = i === 0 ? 'Digit0' : `Digit${i}`;
      if (this.isKeyJustPressed(key)) {
        this.setEngineSpeed(i);
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

    // G key to close chart
    if (this.isKeyJustPressed('KeyG')) {
      this.galacticChart.hide();
      this.gameState.currentView = ViewMode.FRONT;
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

    // Clear current sector enemies
    this.combatSystem.clearEnemies();

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

    // Move starfield rapidly
    const direction = this.player.getForwardDirection();
    starfieldObj.position.add(direction.multiplyScalar(-500 * deltaTime));

    if (this.hyperwarpProgress >= 1 && this.hyperwarpTarget) {
      // Complete hyperwarp
      this.gameState.sectorX = this.hyperwarpTarget.x;
      this.gameState.sectorY = this.hyperwarpTarget.y;
      this.sectorSystem.visitSector(this.hyperwarpTarget.x, this.hyperwarpTarget.y);

      // Reset starfield
      starfieldObj.scale.z = 1;
      starfieldObj.position.set(0, 0, 0);

      this.isHyperwarping = false;
      this.hyperwarpTarget = null;

      // Spawn enemies in new sector
      this.combatSystem.spawnEnemiesForSector();

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

    // Close any open overlays
    this.galacticChart.hide();
    this.longRangeScan.hide();

    const previousView = this.gameState.currentView;
    this.gameState.currentView = view;

    // Handle view transition for Front/Aft
    if (
      (previousView === ViewMode.FRONT && view === ViewMode.AFT) ||
      (previousView === ViewMode.AFT && view === ViewMode.FRONT)
    ) {
      this.isViewTransitioning = true;
      this.viewTransitionProgress = 0;
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
    this.gameState.engineSpeed = Math.min(speed, maxSpeed);

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
   */
  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
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
