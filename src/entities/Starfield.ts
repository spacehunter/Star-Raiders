import * as THREE from 'three';

/**
 * Starfield - Creates a particle-based starfield background
 */
export class Starfield {
  private points: THREE.Points;

  constructor(starCount: number = 5000, radius: number = 2000) {

    // Create geometry with random star positions
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;

      // Distribute stars in a sphere around the origin
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.5 + Math.random() * 0.5);

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      // Most stars are white, some have slight color variation
      const colorVariation = Math.random();
      if (colorVariation > 0.9) {
        // Slight blue tint
        colors[i3] = 0.8;
        colors[i3 + 1] = 0.9;
        colors[i3 + 2] = 1.0;
      } else if (colorVariation > 0.8) {
        // Slight yellow tint
        colors[i3] = 1.0;
        colors[i3 + 1] = 1.0;
        colors[i3 + 2] = 0.8;
      } else {
        // White
        colors[i3] = 1.0;
        colors[i3 + 1] = 1.0;
        colors[i3 + 2] = 1.0;
      }

      // Vary star sizes
      sizes[i] = Math.random() * 2 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create material - sizeAttenuation: false keeps stars visible at all distances
    const material = new THREE.PointsMaterial({
      size: 3,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });

    this.points = new THREE.Points(geometry, material);
  }

  /**
   * Get the Three.js Points object
   */
  public getObject(): THREE.Points {
    return this.points;
  }

  /**
   * Update starfield (for potential twinkling effect)
   */
  public update(_deltaTime: number): void {
    // Optional: Add subtle twinkling animation here
    // For now, starfield is static
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
