import * as THREE from 'three';

/**
 * PhotonTorpedo - Projectile fired by the player
 * Uses particle system for scrambled energy ball visual effect
 *
 * Visual design:
 * - Multi-colored particles (red, white, blue, purple, cyan) for photon energy
 * - Chaotic scrambling animation - particles randomly reposition each frame
 * - Starts large and diminishes as it travels (perspective effect)
 * - Spherical 360-degree energy ball appearance
 */
export class PhotonTorpedo {
  private particles: THREE.Points;
  private centerPosition: THREE.Vector3;
  private velocity: THREE.Vector3;
  private age: number = 0;
  private maxAge: number = 3; // Seconds before despawning
  private speed: number = 200; // Units per second
  private particleCount: number = 25; // More particles for fuller sphere
  public isActive: boolean = true;

  // Performance: Reusable temp vector (avoid per-frame allocation)
  private tempVector: THREE.Vector3 = new THREE.Vector3();

  // Size scaling: starts large, shrinks with distance
  private initialSize: number = 0.5; // Large starting size
  private minSize: number = 0.08; // Minimum size at max range

  // Color palette for scrambled energy effect (rgb values)
  private colorPalette: number[][] = [
    [1.0, 0.2, 0.2],   // Red
    [1.0, 1.0, 1.0],   // White
    [0.3, 0.3, 1.0],   // Blue
    [0.8, 0.2, 1.0],   // Purple
    [0.0, 1.0, 1.0],   // Cyan
    [1.0, 0.5, 0.8],   // Pink
    [0.5, 0.0, 1.0],   // Violet
  ];

  constructor(position: THREE.Vector3, direction: THREE.Vector3) {
    // Store center position for collision detection and particle positioning
    this.centerPosition = position.clone();

    // Create particle geometry using BufferGeometry
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    // Larger initial sphere radius for starting visual
    const sphereRadius = 0.6;

    // Initialize particles in random spherical positions with random colors
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Random spherical coordinates for true 360-degree ball
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.random() * sphereRadius;

      // Cartesian offsets from center
      positions[i3] = this.centerPosition.x + radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = this.centerPosition.y + radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = this.centerPosition.z + radius * Math.cos(phi);

      // Random color from palette for each particle
      const colorIndex = Math.floor(Math.random() * this.colorPalette.length);
      const color = this.colorPalette[colorIndex];
      colors[i3] = color[0];     // R
      colors[i3 + 1] = color[1]; // G
      colors[i3 + 2] = color[2]; // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create PointsMaterial for particle rendering - starts large
    const material = new THREE.PointsMaterial({
      size: this.initialSize,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
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
   * Update torpedo position with chaotic scramble animation
   * Particles randomly reposition each frame for true energy ball effect
   * Size diminishes as torpedo travels (perspective effect)
   */
  public update(deltaTime: number): void {
    if (!this.isActive) return;

    // Move center position (reuse temp vector to avoid allocation)
    this.tempVector.copy(this.velocity).multiplyScalar(deltaTime);
    this.centerPosition.add(this.tempVector);

    // Calculate progress through lifetime (0 to 1)
    const lifeProgress = this.age / this.maxAge;

    // Sphere radius shrinks as torpedo travels (perspective diminishing effect)
    const currentRadius = 0.6 * (1 - lifeProgress * 0.7); // 0.6 -> 0.18

    // Update particle positions with TRUE chaotic scramble - random each frame!
    const positions = this.particles.geometry.attributes.position.array as Float32Array;
    const colors = this.particles.geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // CHAOTIC SCRAMBLE: New random spherical position each frame
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.random() * currentRadius;

      // Position particles around current center
      positions[i3] = this.centerPosition.x + radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = this.centerPosition.y + radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = this.centerPosition.z + radius * Math.cos(phi);

      // SCRAMBLE COLORS: Random color from palette each frame for energy shimmer
      const colorIndex = Math.floor(Math.random() * this.colorPalette.length);
      const color = this.colorPalette[colorIndex];
      colors[i3] = color[0];
      colors[i3 + 1] = color[1];
      colors[i3 + 2] = color[2];
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.geometry.attributes.color.needsUpdate = true;

    // Size diminishes as torpedo travels (perspective effect: large when close, small when far)
    const material = this.particles.material as THREE.PointsMaterial;
    material.size = this.initialSize * (1 - lifeProgress * 0.85) + this.minSize;

    // Age the torpedo
    this.age += deltaTime;
    if (this.age >= this.maxAge) {
      this.isActive = false;
    }

    // Slight fade at very end of life
    material.opacity = lifeProgress > 0.8 ? 1.0 - ((lifeProgress - 0.8) / 0.2) : 1.0;
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
   * Apply displacement to torpedo position (for player movement compensation)
   * This keeps torpedoes in the correct world-space position relative to player
   */
  public applyDisplacement(displacement: THREE.Vector3): void {
    this.centerPosition.add(displacement);
  }

  /**
   * Dispose of resources
   * Ensures clean memory release: geometry and material
   */
  public dispose(): void {
    // Dispose Three.js resources (required to free GPU memory)
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
