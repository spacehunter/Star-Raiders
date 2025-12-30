import * as THREE from 'three';

/**
 * Meteor - Environmental hazard
 */
export class Meteor {
  private mesh: THREE.Mesh;
  private velocity: THREE.Vector3;
  private rotationSpeed: THREE.Vector3;
  private size: number;

  public isActive: boolean = true;

  constructor(position: THREE.Vector3, direction: THREE.Vector3, size: number = 1) {
    this.size = size;
    this.velocity = direction.normalize().multiplyScalar(30 + Math.random() * 20);

    // Create irregular rock-like geometry
    const geometry = new THREE.IcosahedronGeometry(size, 0);

    // Distort vertices for irregular shape
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const noise = 0.7 + Math.random() * 0.6;
      positions.setXYZ(i, x * noise, y * noise, z * noise);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: 0x888888,
      wireframe: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);

    // Random rotation
    this.rotationSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );
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
   * Get collision radius
   */
  public getCollisionRadius(): number {
    return this.size * 1.2;
  }

  /**
   * Update meteor position and rotation
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Move
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));

    // Rotate
    this.mesh.rotation.x += this.rotationSpeed.x * deltaTime;
    this.mesh.rotation.y += this.rotationSpeed.y * deltaTime;
    this.mesh.rotation.z += this.rotationSpeed.z * deltaTime;

    // Deactivate if too far
    if (this.mesh.position.length() > 500) {
      this.isActive = false;
    }
  }

  /**
   * Check collision with player
   */
  public checkCollision(playerPosition: THREE.Vector3, playerRadius: number): boolean {
    const distance = this.mesh.position.distanceTo(playerPosition);
    return distance < this.getCollisionRadius() + playerRadius;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
