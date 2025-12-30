/**
 * InputManager - Handles keyboard and mouse input with pointer lock support
 */
export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private mouseMovement: { x: number; y: number } = { x: 0, y: 0 };
  private mouseSensitivity: number = 0.002;
  private isPointerLocked: boolean = false;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupEventListeners();
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Mouse events
    document.addEventListener('mousemove', this.handleMouseMove);

    // Pointer lock events
    this.container.addEventListener('click', this.requestPointerLock);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
  }

  /**
   * Clean up event listeners
   */
  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    this.container.removeEventListener('click', this.requestPointerLock);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.set(event.code, true);
  };

  /**
   * Handle keyup events
   */
  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.set(event.code, false);
  };

  /**
   * Handle mouse movement
   */
  private handleMouseMove = (event: MouseEvent): void => {
    if (this.isPointerLocked) {
      this.mouseMovement.x += event.movementX * this.mouseSensitivity;
      this.mouseMovement.y += event.movementY * this.mouseSensitivity;
    }
  };

  /**
   * Request pointer lock
   */
  private requestPointerLock = (): void => {
    this.container.requestPointerLock();
  };

  /**
   * Handle pointer lock change
   */
  private handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.container;
  };

  /**
   * Handle pointer lock error
   */
  private handlePointerLockError = (): void => {
    console.error('Pointer lock failed');
  };

  /**
   * Check if a key is currently pressed
   */
  public isKeyPressed(code: string): boolean {
    return this.keys.get(code) || false;
  }

  /**
   * Get accumulated mouse movement since last call (and reset it)
   */
  public getMouseMovement(): { x: number; y: number } {
    const movement = { ...this.mouseMovement };
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
    return movement;
  }

  /**
   * Set mouse sensitivity
   */
  public setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity;
  }

  /**
   * Check if pointer is locked
   */
  public get pointerLocked(): boolean {
    return this.isPointerLocked;
  }
}
