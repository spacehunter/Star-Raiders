import * as THREE from 'three';

/**
 * PhotonTorpedo - Projectile fired by the player
 * Uses particle system for scrambled energy ball visual effect
 *
 * Performance optimizations:
 * - Pre-computed particle offsets avoid per-frame trig calculations
 * - Reusable temp vector prevents per-frame allocations
 * - Time-based animation uses cached values with phase offsets
 */
export class PhotonTorpedo {
  private particles: THREE.Points;
  private centerPosition: THREE.Vector3;
  private velocity: THREE.Vector3;
  private age: number = 0;
  private maxAge: number = 3; // Seconds before despawning
  private speed: number = 200; // Units per second
  private particleCount: number = 20;
  public isActive: boolean = true;

  // Performance: Pre-computed particle offsets (avoid per-frame random/trig)
  private particleOffsets: Float32Array;
  // Performance: Reusable temp vector (avoid per-frame allocation)
  private tempVector: THREE.Vector3 = new THREE.Vector3();
  // Performance: Phase offsets for time-based scramble animation
  private phaseOffsets: Float32Array;

  constructor(position: THREE.Vector3, direction: THREE.Vector3) {
    // Store center position for collision detection and particle positioning
    this.centerPosition = position.clone();

    // Create particle geometry using BufferGeometry
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    // Pre-compute particle offsets for performance (computed once, reused each frame)
    this.particleOffsets = new Float32Array(this.particleCount * 3);
    this.phaseOffsets = new Float32Array(this.particleCount);

    // Initialize particles around the center position
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Pre-compute random spherical coordinates
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 0.15 + Math.random() * 0.15; // 0.15-0.3 range

      // Store pre-computed cartesian offsets
      this.particleOffsets[i3] = radius * Math.sin(phi) * Math.cos(theta);
      this.particleOffsets[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      this.particleOffsets[i3 + 2] = radius * Math.cos(phi);

      // Store random phase offset for time-based animation
      this.phaseOffsets[i] = Math.random() * Math.PI * 2;

      // Initial positions
      positions[i3] = this.centerPosition.x + this.particleOffsets[i3];
      positions[i3 + 1] = this.centerPosition.y + this.particleOffsets[i3 + 1];
      positions[i3 + 2] = this.centerPosition.z + this.particleOffsets[i3 + 2];

      // Cyan/blue colors for photon energy (#00FFFF to #0088FF range)
      // Colors are static per particle for performance
      colors[i3] = 0; // R
      colors[i3 + 1] = 0.5 + Math.random() * 0.5; // G (0.5-1.0)
      colors[i3 + 2] = 1; // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create PointsMaterial for particle rendering
    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    this.particles = new THREE.Points(geometry, material);

    // Set velocity
    this.velocity = direction.normalize().multiplyScalar(this.speed);
  }

  /**
   * Get the Three.js object
   */
  public getObject(): THREE.Object3D {
    return this.particles;
  }

  /**
   * Get current position
   */
  public getPosition(): THREE.Vector3 {
    return this.centerPosition.clone();
  }

  /**
   * Update torpedo position
   * Performance optimized: uses pre-computed offsets with time-based animation
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Move center position (reuse temp vector to avoid allocation)
    this.tempVector.copy(this.velocity).multiplyScalar(deltaTime);
    this.centerPosition.add(this.tempVector);

    // Update particle positions with scrambled effect using pre-computed offsets
    const positions = this.particles.geometry.attributes.position.array as Float32Array;

    // Time-based scramble factor (varies smoothly, avoids per-frame random)
    const time = this.age * 15; // Animation speed multiplier

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Use pre-computed offset with time-based rotation for scramble effect
      // This creates smooth animated chaos without expensive per-frame randoms
      const phase = this.phaseOffsets[i] + time;
      const scrambleFactor = Math.sin(phase) * 0.5 + 0.5; // 0-1 range

      positions[i3] = this.centerPosition.x + this.particleOffsets[i3] * scrambleFactor;
      positions[i3 + 1] = this.centerPosition.y + this.particleOffsets[i3 + 1] * scrambleFactor;
      positions[i3 + 2] = this.centerPosition.z + this.particleOffsets[i3 + 2] * scrambleFactor;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    // Note: Colors are static per particle, no need to update

    // Age the torpedo
    this.age += deltaTime;
    if (this.age >= this.maxAge) {
      this.isActive = false;
    }

    // Fade out as it ages
    const material = this.particles.material as THREE.PointsMaterial;
    material.opacity = 0.9 * (1 - this.age / this.maxAge);
  }

  /**
   * Check collision with a target (simple sphere collision)
   */
  public checkCollision(targetPosition: THREE.Vector3, targetRadius: number): boolean {
    const distance = this.centerPosition.distanceTo(targetPosition);
    return distance < targetRadius + 0.3; // 0.3 is the particle scatter radius
  }

  /**
   * Deactivate the torpedo (e.g., on hit)
   */
  public deactivate(): void {
    this.isActive = false;
  }

  /**
   * Dispose of resources
   * Ensures clean memory release: geometry, material, and typed arrays
   */
  public dispose(): void {
    // Dispose Three.js resources (required to free GPU memory)
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();

    // Clear references to typed arrays (allows garbage collection)
    // Note: TypedArrays are cleared by setting to null-equivalent empty arrays
    this.particleOffsets = new Float32Array(0);
    this.phaseOffsets = new Float32Array(0);
  }
}
