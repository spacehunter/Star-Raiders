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
   * Create the geometric player ship model
   */
  private createShipModel(): THREE.Group {
    const group = new THREE.Group();

    // Color definitions
    const blueColor = 0x4488ff;
    const whiteColor = 0xffffff;

    // Materials
    const blueMaterial = new THREE.MeshBasicMaterial({ color: blueColor });
    const whiteMaterial = new THREE.MeshBasicMaterial({ color: whiteColor });

    // Main body - elongated box
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.3, 2.0);
    const body = new THREE.Mesh(bodyGeometry, blueMaterial);
    body.position.z = 0;
    group.add(body);

    // Nose cone - pyramid pointing forward (-Z)
    const noseGeometry = new THREE.ConeGeometry(0.3, 1.2, 4);
    const nose = new THREE.Mesh(noseGeometry, whiteMaterial);
    nose.rotation.x = -Math.PI / 2; // Point forward
    nose.rotation.y = Math.PI / 4; // Rotate to align edges
    nose.position.z = -1.5;
    group.add(nose);

    // Left wing - angled box
    const wingGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.8);
    const leftWing = new THREE.Mesh(wingGeometry, blueMaterial);
    leftWing.position.set(-0.8, 0, 0.3);
    leftWing.rotation.z = 0.15;
    group.add(leftWing);

    // Right wing - angled box
    const rightWing = new THREE.Mesh(wingGeometry, blueMaterial);
    rightWing.position.set(0.8, 0, 0.3);
    rightWing.rotation.z = -0.15;
    group.add(rightWing);

    // Left wing tip
    const wingTipGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.4);
    const leftWingTip = new THREE.Mesh(wingTipGeometry, whiteMaterial);
    leftWingTip.position.set(-1.5, 0.05, 0.3);
    group.add(leftWingTip);

    // Right wing tip
    const rightWingTip = new THREE.Mesh(wingTipGeometry, whiteMaterial);
    rightWingTip.position.set(1.5, 0.05, 0.3);
    group.add(rightWingTip);

    // Cockpit - small raised section
    const cockpitGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.6);
    const cockpit = new THREE.Mesh(cockpitGeometry, whiteMaterial);
    cockpit.position.set(0, 0.25, -0.4);
    group.add(cockpit);

    // Engine section - back of ship
    const engineGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.5);
    const engine = new THREE.Mesh(engineGeometry, whiteMaterial);
    engine.position.z = 1.1;
    group.add(engine);

    // Engine glow (emissive)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    const glowGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.1);
    const engineGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    engineGlow.position.z = 1.4;
    group.add(engineGlow);

    // Scale the entire ship
    group.scale.set(0.5, 0.5, 0.5);

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
   * Reset rotation to center
   */
  public resetRotation(): void {
    this.targetYaw = 0;
    this.targetPitch = 0;
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
