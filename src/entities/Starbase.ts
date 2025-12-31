import * as THREE from 'three';

/**
 * Starbase - Friendly station for docking, repairs, and refueling
 */
export class Starbase {
  private mesh: THREE.Group;
  private rotationSpeed: number = 0.2;

  public isActive: boolean = true;
  public isDestroyed: boolean = false;

  constructor(position: THREE.Vector3) {
    this.mesh = this.createModel();
    this.mesh.position.copy(position);
  }

  /**
   * Create the starbase model - space station design
   */
  private createModel(): THREE.Group {
    const group = new THREE.Group();

    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Central hub
    const hubGeometry = new THREE.CylinderGeometry(2, 2, 1, 8);
    const hub = new THREE.Mesh(hubGeometry, material);
    hub.rotation.x = Math.PI / 2;
    group.add(hub);

    // Rotating ring
    const ringGeometry = new THREE.TorusGeometry(4, 0.4, 8, 16);
    const ring = new THREE.Mesh(ringGeometry, whiteMaterial);
    ring.name = 'ring';
    group.add(ring);

    // Docking pylons
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pylonGeometry = new THREE.BoxGeometry(0.5, 0.5, 3);
      const pylon = new THREE.Mesh(pylonGeometry, material);
      pylon.position.set(
        Math.cos(angle) * 2,
        Math.sin(angle) * 2,
        0
      );
      pylon.rotation.z = angle;
      group.add(pylon);
    }

    // Antenna spire
    const spireGeometry = new THREE.ConeGeometry(0.3, 2, 4);
    const spire = new THREE.Mesh(spireGeometry, whiteMaterial);
    spire.position.z = -2;
    spire.rotation.x = -Math.PI / 2;
    group.add(spire);

    // Docking lights
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    const lightGeometry = new THREE.SphereGeometry(0.2, 8, 8);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(
        Math.cos(angle) * 4,
        Math.sin(angle) * 4,
        0
      );
      light.name = 'dockingLight';
      group.add(light);
    }

    group.scale.set(2, 2, 2);

    return group;
  }

  /**
   * Get the Three.js object
   */
  public getObject(): THREE.Object3D {
    return this.mesh;
  }

  /**
   * Get position
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * Get docking radius
   */
  public getDockingRadius(): number {
    return 50; // Increased from 15 for easier docking
  }

  /**
   * Check if player is in docking range
   */
  public isInDockingRange(playerPosition: THREE.Vector3): boolean {
    return this.mesh.position.distanceTo(playerPosition) < this.getDockingRadius();
  }

  /**
   * Check if player meets docking requirements
   * - Within range
   * - Low speed (0-2)
   * - Roughly aligned
   */
  public canDock(playerPosition: THREE.Vector3, playerSpeed: number): boolean {
    if (!this.isActive || this.isDestroyed) return false;
    if (playerSpeed > 2) return false;
    if (!this.isInDockingRange(playerPosition)) return false;
    return true;
  }

  /**
   * Update starbase (rotation animation)
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Rotate the ring
    const ring = this.mesh.getObjectByName('ring');
    if (ring) {
      ring.rotation.z += this.rotationSpeed * deltaTime;
    }

    // Pulse docking lights
    this.mesh.children.forEach((child) => {
      if (child.name === 'dockingLight') {
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
      }
    });
  }

  /**
   * Destroy the starbase
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.isActive = false;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
