/**
 * GameLoop - Handles requestAnimationFrame-based game loop with delta time calculation
 */
export class GameLoop {
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private updateCallback: ((deltaTime: number) => void) | null = null;
  private renderCallback: (() => void) | null = null;

  /**
   * Set the update callback function
   * @param callback Function called each frame with delta time in seconds
   */
  public setUpdateCallback(callback: (deltaTime: number) => void): void {
    this.updateCallback = callback;
  }

  /**
   * Set the render callback function
   * @param callback Function called each frame to render the scene
   */
  public setRenderCallback(callback: () => void): void {
    this.renderCallback = callback;
  }

  /**
   * Start the game loop
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Check if the game loop is running
   */
  public get running(): boolean {
    return this.isRunning;
  }

  /**
   * Main loop function
   */
  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // Calculate delta time in seconds
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Cap delta time to prevent large jumps (e.g., after tab switch)
    const cappedDelta = Math.min(deltaTime, 0.1);

    // Update game logic
    if (this.updateCallback) {
      this.updateCallback(cappedDelta);
    }

    // Render scene
    if (this.renderCallback) {
      this.renderCallback();
    }

    // Request next frame
    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
