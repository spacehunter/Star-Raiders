import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { GameState, ViewMode } from './GameState';
import { InputManager } from '../utils/InputManager';
import { EnergySystem } from '../systems/EnergySystem';
import { Starfield } from '../entities/Starfield';
import { Player } from '../entities/Player';
import { PhotonTorpedo } from '../entities/PhotonTorpedo';
import { ControlPanel } from '../ui/ControlPanel';

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
  private gameState: GameState;

  // UI
  private controlPanel: ControlPanel;

  // Game entities
  private starfield: Starfield;
  private player: Player;
  private torpedoes: PhotonTorpedo[] = [];

  // State
  private isInitialized: boolean = false;

  // Key state tracking for single-press actions
  private keyStates: Map<string, boolean> = new Map();

  // View transition
  private isViewTransitioning: boolean = false;
  private viewTransitionProgress: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    // Initialize game state
    this.gameState = new GameState();
    this.gameState.reset();

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

    // Initialize entities
    this.starfield = new Starfield(5000, 2000);
    this.player = new Player();

    // Initialize UI
    this.controlPanel = new ControlPanel(container, this.gameState);

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

    // Update star date
    this.gameState.starDate += deltaTime * 0.1;

    // Handle input
    this.handleInput(deltaTime);

    // Update game systems
    this.energySystem.update(deltaTime);

    // Update player movement based on speed
    this.updatePlayerMovement(deltaTime);

    // Update entities
    this.player.update(deltaTime);
    this.starfield.update(deltaTime);

    // Update torpedoes
    this.updateTorpedoes(deltaTime);

    // Handle view transition
    if (this.isViewTransitioning) {
      this.updateViewTransition(deltaTime);
    }

    // Update UI
    this.controlPanel.update();
  };

  /**
   * Update player movement based on engine speed
   */
  private updatePlayerMovement(deltaTime: number): void {
    if (this.gameState.engineSpeed > 0) {
      // Move starfield to create illusion of movement
      // In a real implementation, we'd move through sectors
      const moveSpeed = this.gameState.engineSpeed * 10;
      const direction = this.player.getForwardDirection();

      // Move the starfield in opposite direction to simulate forward movement
      const starfieldObj = this.starfield.getObject();
      starfieldObj.position.add(direction.multiplyScalar(-moveSpeed * deltaTime));

      // Wrap starfield position to prevent it from going too far
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
        // Remove from scene and array
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
    const keysToTrack = ['KeyF', 'KeyA', 'KeyS', 'Space', 'KeyG', 'KeyL', 'KeyH', 'KeyT', 'KeyM'];
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
    this.viewTransitionProgress += deltaTime * 3; // Complete in ~0.33 seconds

    if (this.viewTransitionProgress >= 1) {
      this.viewTransitionProgress = 1;
      this.isViewTransitioning = false;

      // Finalize camera rotation
      if (this.gameState.currentView === ViewMode.AFT) {
        this.camera.rotation.y = Math.PI;
      } else {
        this.camera.rotation.y = 0;
      }
    } else {
      // Animate camera rotation
      const targetRotation = this.gameState.currentView === ViewMode.AFT ? Math.PI : 0;
      const startRotation = this.gameState.currentView === ViewMode.AFT ? 0 : Math.PI;
      this.camera.rotation.y = startRotation + (targetRotation - startRotation) * this.viewTransitionProgress;
    }
  }

  /**
   * Fire a photon torpedo
   */
  private fireTorpedo(): void {
    // Check if we can fire (not in non-combat views, have energy, weapons not damaged)
    if (
      this.gameState.currentView !== ViewMode.FRONT &&
      this.gameState.currentView !== ViewMode.AFT
    ) {
      return;
    }

    // Check shields - in higher difficulties, can't fire with shields up
    if (this.gameState.shieldsActive && this.gameState.difficulty !== 'NOVICE') {
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

    // Create torpedo
    const position = this.player.getObject().position.clone();
    let direction = this.player.getForwardDirection();

    // In Aft view, fire backwards
    if (this.gameState.currentView === ViewMode.AFT) {
      direction.negate();
    }

    // Offset torpedo spawn position slightly forward
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

    // Dispose torpedoes
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
