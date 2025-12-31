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

      // Spherical distribution - stars visible in all directions
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

    // Create custom shader material for distance-based sizing with a max cap
    const material = new THREE.ShaderMaterial({
      uniforms: {
        maxSize: { value: 2.0 }, // Current fixed size as max
        attenuationFactor: { value: 600.0 } // Tuning for distance scaling
      },
      vertexShader: `
        varying vec3 vColor;
        uniform float maxSize;
        uniform float attenuationFactor;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Calculate size based on distance
          float dist = length(mvPosition.xyz);
          float size = attenuationFactor / dist;
          
          // Clamp to max size (user requested stars not get bigger than current)
          gl_PointSize = min(maxSize, size);
          
          // Ensure extremely far stars don't disappear completely if undesired, 
          // or let them fade to < 1.0 which makes them sub-pixel/transparent
          gl_PointSize = max(0.5, gl_PointSize);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          // Authentic retro look: Square pixels
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
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
   * Update individual star positions based on player movement
   * Recycles stars that drift too far from origin to maintain consistent density
   *
   * Uses spherical distribution - when a star exceeds max distance,
   * respawn it at a random position on the sphere
   */
  public updateMovement(displacement: THREE.Vector3): void {
    const positions = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const array = positions.array as Float32Array;

    const maxDistance = 2000;      // Max distance from origin before recycling
    const minDistance = 1000;      // Min respawn distance
    const maxDistanceSq = maxDistance * maxDistance;

    for (let i = 0; i < positions.count; i++) {
      const i3 = i * 3;

      // Apply displacement (stars move with space as player moves)
      array[i3] += displacement.x;
      array[i3 + 1] += displacement.y;
      array[i3 + 2] += displacement.z;

      // Check distance from origin (squared to avoid sqrt)
      const x = array[i3];
      const y = array[i3 + 1];
      const z = array[i3 + 2];
      const distSq = x * x + y * y + z * z;

      // If star is too far, respawn at random position on sphere
      if (distSq > maxDistanceSq) {
        // Random spherical position (not opposite - that causes clustering)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = minDistance + Math.random() * (maxDistance - minDistance);

        array[i3] = r * Math.sin(phi) * Math.cos(theta);
        array[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        array[i3 + 2] = r * Math.cos(phi);
      }
    }

    positions.needsUpdate = true;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
