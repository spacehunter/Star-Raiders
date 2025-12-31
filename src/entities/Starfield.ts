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

      // Classic Atari 800 style - pure white stars like single pixels
      // Occasional very slight brightness variation for depth
      const brightness = 0.7 + Math.random() * 0.3;
      colors[i3] = brightness;
      colors[i3 + 1] = brightness;
      colors[i3 + 2] = brightness;

      // All stars same small size for authentic pixel look
      sizes[i] = 1.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create material - single pixel stars like original Atari 800
    const material = new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: false,
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
