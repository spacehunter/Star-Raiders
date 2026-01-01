import * as THREE from 'three';

/**
 * Player - Creates and manages the player ship model and controls
 * Design: Angular, geometric 1970s sci-fi aesthetic
 * Colors: Blue (#4488FF) and white (#FFFFFF)
 */
export class Player {
  private ship: THREE.Group;
  private pitchObject: THREE.Object3D;
  private yawObject: THREE.Object3D;

  // Rotation damping for smooth control
  private targetPitch: number = 0;
  private targetYaw: number = 0;
  private currentPitch: number = 0;
  private currentYaw: number = 0;
  private rotationDamping: number = 0.15;

  // Rotation limits (in radians)
  private maxPitch: number = Math.PI / 2 - 0.1;
  private minPitch: number = -Math.PI / 2 + 0.1;

  constructor() {
    // Create container objects for pitch/yaw rotation
    this.yawObject = new THREE.Object3D();
    this.pitchObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);

    // Create the ship model
    this.ship = this.createShipModel();
    this.pitchObject.add(this.ship);
  }

  /**
   * Create the geometric player ship model - pixel art style
   * Based on original Atari 800 aesthetic
   */
  private createShipModel(): THREE.Group {
    const group = new THREE.Group();

    // Color definitions
    const blueColor = 0x4488ff;
    const whiteColor = 0xffffff;
    const cyanColor = 0x00ffff;

    // Materials
    const blueMaterial = new THREE.MeshBasicMaterial({ color: blueColor });
    const whiteMaterial = new THREE.MeshBasicMaterial({ color: whiteColor });

    const pixelSize = 0.25;
    const pixelGeometry = new THREE.BoxGeometry(pixelSize, pixelSize * 0.5, pixelSize);

    // Create pixel art ship from top view:
    //       XX        (nose - white)
    //      XXXX       (front body - blue)
    //  XX XXXXXX XX   (main body + wings - blue/white tips)
    //  XX XXXXXX XX
    //     XXXX        (body - blue)
    //      XX         (engine - white)
    //      OO         (engine glow - cyan)

    // Nose (white) - rows 0-1
    [[-0.5, 0.5], [-1, 0, 1]].forEach((row, rowIdx) => {
      row.forEach((x) => {
        const pixel = new THREE.Mesh(pixelGeometry, whiteMaterial);
        pixel.position.set(x * pixelSize, 0, (-3 + rowIdx) * pixelSize);
        group.add(pixel);
      });
    });

    // Front body (blue) - row 2
    [-1.5, -0.5, 0.5, 1.5].forEach((x) => {
      const pixel = new THREE.Mesh(pixelGeometry, blueMaterial);
      pixel.position.set(x * pixelSize, 0, -1 * pixelSize);
      group.add(pixel);
    });

    // Main body + wings - rows 3-4
    for (let row = 0; row < 2; row++) {
      // Wings (blue with white tips)
      [-4, -3].forEach((x) => {
        const pixel = new THREE.Mesh(pixelGeometry, x === -4 ? whiteMaterial : blueMaterial);
        pixel.position.set(x * pixelSize, 0, row * pixelSize);
        group.add(pixel);
      });
      [3, 4].forEach((x) => {
        const pixel = new THREE.Mesh(pixelGeometry, x === 4 ? whiteMaterial : blueMaterial);
        pixel.position.set(x * pixelSize, 0, row * pixelSize);
        group.add(pixel);
      });
      // Center body (blue)
      [-1.5, -0.5, 0.5, 1.5].forEach((x) => {
        const pixel = new THREE.Mesh(pixelGeometry, blueMaterial);
        pixel.position.set(x * pixelSize, 0, row * pixelSize);
        group.add(pixel);
      });
    }

    // Rear body (blue) - row 5
    [-1, 0, 1].forEach((x) => {
      const pixel = new THREE.Mesh(pixelGeometry, blueMaterial);
      pixel.position.set(x * pixelSize, 0, 2 * pixelSize);
      group.add(pixel);
    });

    // Engine (white) - row 6
    [-0.5, 0.5].forEach((x) => {
      const pixel = new THREE.Mesh(pixelGeometry, whiteMaterial);
      pixel.position.set(x * pixelSize, 0, 3 * pixelSize);
      group.add(pixel);
    });

    // Engine glow (cyan)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: cyanColor,
      transparent: true,
      opacity: 0.9,
    });
    [-0.5, 0.5].forEach((x) => {
      const pixel = new THREE.Mesh(pixelGeometry, glowMaterial);
      pixel.position.set(x * pixelSize, 0, 3.5 * pixelSize);
      group.add(pixel);
    });

    // Scale the entire ship
    group.scale.set(0.6, 0.6, 0.6);

    return group;
  }

  /**
   * Get the root object (yaw container) for adding to scene
   */
  public getObject(): THREE.Object3D {
    return this.yawObject;
  }

  /**
   * Get the camera attachment point (inside cockpit)
   */
  public getCameraTarget(): THREE.Object3D {
    return this.pitchObject;
  }

  /**
   * Get the forward direction vector
   */
  public getForwardDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.pitchObject.quaternion);
    direction.applyQuaternion(this.yawObject.quaternion);
    return direction.normalize();
  }

  /**
   * Rotate ship based on mouse input
   */
  public rotate(deltaYaw: number, deltaPitch: number): void {
    this.targetYaw -= deltaYaw;
    this.targetPitch -= deltaPitch;

    // Clamp pitch
    this.targetPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.targetPitch));
  }

  /**
   * Update player state
   */
  public update(_deltaTime: number): void {
    // Apply rotation damping for smooth control
    this.currentYaw += (this.targetYaw - this.currentYaw) * this.rotationDamping;
    this.currentPitch += (this.targetPitch - this.currentPitch) * this.rotationDamping;

    // Apply rotations
    this.yawObject.rotation.y = this.currentYaw;
    this.pitchObject.rotation.x = this.currentPitch;
  }

  /**
   * Set rotation damping factor (0-1, higher = faster response)
   */
  public setRotationDamping(damping: number): void {
    this.rotationDamping = Math.max(0, Math.min(1, damping));
  }

  /**
   * Reset rotation to center (immediate snap, no damping)
   */
  public resetRotation(): void {
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.currentYaw = 0;
    this.currentPitch = 0;
    // Also apply to objects immediately
    this.yawObject.rotation.y = 0;
    this.pitchObject.rotation.x = 0;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.ship.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
