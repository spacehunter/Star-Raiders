import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { InputManager } from '../utils/InputManager';
import { Starfield } from '../entities/Starfield';
import { Player } from '../entities/Player';

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

  // Game entities
  private starfield: Starfield;
  private player: Player;

  // State
  private isInitialized: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;

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

    // Initialize entities
    this.starfield = new Starfield(5000, 2000);
    this.player = new Player();

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
    // The camera will follow the player's pitch/yaw
    const playerCameraTarget = this.player.getCameraTarget();
    playerCameraTarget.add(this.camera);

    // Position camera slightly forward and up to simulate cockpit view
    this.camera.position.set(0, 0.2, -0.5);
    this.camera.rotation.set(0, 0, 0);

    // Add some ambient light (optional - using BasicMaterial doesn't need it)
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
    console.log('Click to enable mouse control (pointer lock)');

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
    // Handle input
    this.handleInput(deltaTime);

    // Update entities
    this.player.update(deltaTime);
    this.starfield.update(deltaTime);
  };

  /**
   * Handle player input
   */
  private handleInput(_deltaTime: number): void {
    // Get mouse movement for ship rotation
    const mouseMovement = this.inputManager.getMouseMovement();

    // Rotate player based on mouse input
    this.player.rotate(mouseMovement.x, mouseMovement.y);

    // Keyboard controls can be added here
    // Example: Speed control with number keys
    // if (this.inputManager.isKeyPressed('Digit1')) { ... }
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

    this.renderer.dispose();
    window.removeEventListener('resize', this.handleResize);

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
