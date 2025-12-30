import * as THREE from 'three';

/**
 * PhotonTorpedo - Projectile fired by the player
 */
export class PhotonTorpedo {
  private mesh: THREE.Mesh;
  private velocity: THREE.Vector3;
  private age: number = 0;
  private maxAge: number = 3; // Seconds before despawning
  private speed: number = 200; // Units per second
  public isActive: boolean = true;

  constructor(position: THREE.Vector3, direction: THREE.Vector3) {
    // Create torpedo geometry - elongated sphere with glow effect
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    geometry.scale(1, 1, 2); // Elongate

    // Bright emissive material (red/orange glow)
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.9,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);

    // Align torpedo to face direction of travel
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
    this.mesh.quaternion.copy(quaternion);

    // Set velocity
    this.velocity = direction.normalize().multiplyScalar(this.speed);

    // Add glow effect using a larger transparent sphere
    const glowGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.4,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.mesh.add(glow);
  }

  /**
   * Get the Three.js object
   */
  public getObject(): THREE.Object3D {
    return this.mesh;
  }

  /**
   * Get current position
   */
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /**
   * Update torpedo position
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Move torpedo
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Age the torpedo
    this.age += deltaTime;
    if (this.age >= this.maxAge) {
      this.isActive = false;
    }

    // Fade out as it ages
    const material = this.mesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0.9 * (1 - this.age / this.maxAge);
  }

  /**
   * Check collision with a target (simple sphere collision)
   */
  public checkCollision(targetPosition: THREE.Vector3, targetRadius: number): boolean {
    const distance = this.mesh.position.distanceTo(targetPosition);
    return distance < targetRadius + 0.15;
  }

  /**
   * Deactivate the torpedo (e.g., on hit)
   */
  public deactivate(): void {
    this.isActive = false;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
