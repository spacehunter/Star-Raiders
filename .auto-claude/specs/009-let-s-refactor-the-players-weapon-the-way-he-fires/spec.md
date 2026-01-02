# Specification: Dual Photon Cannon Weapon System

## Overview

Refactor the player's weapon system from a single center-fired torpedo to an authentic dual "photon cannon" system. The new system will fire two projectiles simultaneously from the port and starboard sides of the spacecraft, both angling toward the center crosshair position. The projectiles must feature a distinctive "scrambled energy ball" visual effect - animated chaotic pixel patterns that create a unique photon energy aesthetic during flight.

## Workflow Type

**Type**: feature

**Rationale**: This is a significant visual and mechanical enhancement to an existing system. It requires new animation logic, trajectory calculations, and modifications to the rendering approach while maintaining integration with existing collision and VFX systems.

## Task Scope

### Services Involved
- **main** (primary) - TypeScript/Three.js game implementing Star Raiders

### This Task Will:
- [ ] Modify `PhotonTorpedo.ts` to create scrambled energy ball visual effect with animation
- [ ] Update `Game.ts` to fire dual torpedoes from port/starboard positions
- [ ] Calculate angled trajectories toward crosshair center
- [ ] Maintain existing collision detection with enemies
- [ ] Keep explosion effects on enemy impact

### Out of Scope:
- Changes to enemy AI or behavior
- New sound effects (reuse existing torpedo sound)
- Changes to the targeting/lock-on system
- Energy consumption changes (dual fire costs same as single fire)
- Changes to the crosshair/Attack Computer UI

## Service Context

### Main Service

**Tech Stack:**
- Language: TypeScript
- Framework: Three.js (WebGL)
- Build Tool: Vite
- Key directories: `src/entities`, `src/game`, `src/systems`

**Entry Point:** `src/main.ts`

**How to Run:**
```bash
npm run dev
```

**Port:** 5173

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/entities/PhotonTorpedo.ts` | main | Replace elongated sphere with scrambled pixel particle system; add animation update logic |
| `src/game/Game.ts` | main | Modify `fireTorpedo()` to create dual torpedoes from port/starboard positions with angled trajectories |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/systems/VFXSystem.ts` | Particle-based effects using `THREE.Points` and `BufferGeometry` |
| `src/entities/Player.ts` | Ship geometry dimensions and pixel size constants (`pixelSize = 0.25`) |
| `src/views/AttackComputer.ts` | Crosshair position is fixed at center of screen |

## Patterns to Follow

### Particle System Pattern (from VFXSystem.ts)

From `src/systems/VFXSystem.ts`:

```typescript
const particleCount = 50;
const geometry = new THREE.BufferGeometry();

const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

// Initialize particles
for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3;
  positions[i3] = position.x;
  positions[i3 + 1] = position.y;
  positions[i3 + 2] = position.z;
  // ...colors...
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 2,
  vertexColors: true,
  transparent: true,
  opacity: 1,
});

this.particles = new THREE.Points(geometry, material);
```

**Key Points:**
- Use `BufferGeometry` with position and color attributes
- Use `THREE.Points` for particle rendering
- Update positions each frame via `geometry.attributes.position.needsUpdate = true`

### Ship Dimensions (from Player.ts)

From `src/entities/Player.ts`:

```typescript
const pixelSize = 0.25;

// Wings at x positions: [-4, -3] and [3, 4] (in pixel units)
// Scaled by 0.6

// Wing tips (port cannon): x = -4 * 0.25 * 0.6 = -0.6 units
// Wing tips (starboard cannon): x = +4 * 0.25 * 0.6 = +0.6 units
```

**Key Points:**
- Port cannon position: approximately x = -0.6, relative to ship center
- Starboard cannon position: approximately x = +0.6, relative to ship center
- Use slightly forward offset (z = -0.5) to fire from front of wings

### Current Torpedo Firing (from Game.ts)

From `src/game/Game.ts`:

```typescript
private fireTorpedo(): void {
  const position = this.player.getObject().position.clone();
  let direction = this.player.getForwardDirection();

  if (this.gameState.currentView === ViewMode.AFT) {
    direction.negate();
  }

  position.add(direction.clone().multiplyScalar(2));

  const torpedo = new PhotonTorpedo(position, direction);
  this.torpedoes.push(torpedo);
  this.scene.add(torpedo.getObject());
}
```

**Key Points:**
- Creates single torpedo from center position
- Direction is straight forward (or aft)
- Needs modification for dual offset positions and angled trajectories

## Requirements

### Functional Requirements

1. **Dual Firing Points**
   - Description: Fire two photon projectiles simultaneously from port and starboard wing positions
   - Acceptance: Both projectiles appear when spacebar is pressed, originating from opposite sides of the ship

2. **Converging Trajectories**
   - Description: Both projectiles angle inward toward the center crosshair position (camera forward direction)
   - Acceptance: Projectiles visibly converge toward the center of the screen as they travel forward

3. **Scrambled Energy Ball Visual**
   - Description: Each projectile displays as a cluster of chaotically animated pixels that "scramble" during flight
   - Acceptance: Visual effect shows multiple pixels randomly shifting positions around the projectile center, creating a turbulent energy appearance

4. **Animation During Flight**
   - Description: The scrambled pixel effect continuously animates as the projectile travels
   - Acceptance: Pixels visibly move/jitter each frame, maintaining the chaotic energy aesthetic

5. **Collision Detection**
   - Description: Maintain existing collision detection with enemies
   - Acceptance: Enemies take damage and explode when hit by either projectile

### Edge Cases

1. **Aft View Firing** - Both projectiles should still fire from sides, trajectories reversed toward aft crosshair
2. **Rapid Fire** - Multiple dual salvos should all track independently
3. **Energy Depletion** - Single energy cost for dual fire (no change from current cost)

## Implementation Notes

### DO
- Follow the particle system pattern in `VFXSystem.ts` for the scrambled visual
- Use `THREE.Points` with `BufferGeometry` for efficient particle rendering
- Keep particle count modest (15-25 particles per projectile) for performance
- Use cyan/blue colors for photon energy (matching Attack Computer theme: #00FFFF)
- Calculate convergence angle based on firing offset and target convergence distance (~50 units ahead)
- Maintain `isActive` flag pattern for cleanup
- Keep `checkCollision()` method for hit detection

### DON'T
- Create complex shader-based effects (keep it simple with point particles)
- Change the energy cost for firing
- Modify the Attack Computer or crosshair positioning
- Add new sound effects or modify audio system
- Create new files - modify existing PhotonTorpedo.ts and Game.ts only

### Scrambled Effect Algorithm

```typescript
// Each frame, for each particle in the projectile:
// 1. Random offset from projectile center (sphere radius ~0.3)
// 2. Random color variation (cyan to blue range)
// 3. Optional: size pulsing

for (let i = 0; i < particleCount; i++) {
  const i3 = i * 3;
  // Random spherical offset
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const radius = Math.random() * 0.3;

  positions[i3] = center.x + radius * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = center.y + radius * Math.sin(phi) * Math.sin(theta);
  positions[i3 + 2] = center.z + radius * Math.cos(phi);
}
```

### Trajectory Calculation

```typescript
// Port cannon
const portOffset = new THREE.Vector3(-0.6, 0, 0);
portOffset.applyQuaternion(player.quaternion);
const portPosition = playerPos.clone().add(portOffset);

// Calculate angle to converge at ~50 units ahead (center crosshair)
const convergenceDistance = 50;
const convergencePoint = playerPos.clone().add(forward.multiplyScalar(convergenceDistance));
const portDirection = convergencePoint.clone().sub(portPosition).normalize();

// Similar for starboard (+0.6 x offset)
```

## Development Environment

### Start Services

```bash
npm run dev
```

### Service URLs
- Game: http://localhost:5173

### Required Environment Variables
- None (static frontend application)

## Success Criteria

The task is complete when:

1. [ ] Pressing spacebar fires TWO photon projectiles from left and right sides of ship
2. [ ] Projectiles visibly converge toward screen center as they travel
3. [ ] Each projectile displays animated "scrambled pixel" visual effect
4. [ ] Pixels in each projectile continuously jitter/scramble during flight
5. [ ] Collision detection works - enemies explode when hit
6. [ ] No console errors during gameplay
7. [ ] Existing tests still pass
8. [ ] Works in both Front and Aft view modes

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| PhotonTorpedo construction | `src/entities/PhotonTorpedo.ts` | Creates valid Three.js object with particle geometry |
| PhotonTorpedo update | `src/entities/PhotonTorpedo.ts` | Particles animate each frame, position updates correctly |
| Collision detection | `src/entities/PhotonTorpedo.ts` | `checkCollision()` returns true when within target radius |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Dual torpedo firing | Game ↔ PhotonTorpedo | Two torpedoes created per fire action |
| Torpedo-enemy collision | PhotonTorpedo ↔ CombatSystem | Enemy takes damage when torpedo hits |
| VFX on hit | PhotonTorpedo ↔ VFXSystem | Explosion created at impact location |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Fire photon cannons | 1. Start game 2. Press F for front view 3. Press spacebar | Two animated energy balls appear from sides of ship, converge toward center |
| Destroy enemy | 1. Locate enemy 2. Align crosshair 3. Fire | Enemy explodes when photon hits |
| Aft firing | 1. Press A for aft view 2. Press spacebar | Dual torpedoes fire backward with correct convergence |

### Browser Verification
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Main game | `http://localhost:5173` | Game loads without errors |
| Combat gameplay | `http://localhost:5173` | Dual cannons visible, animated effect renders correctly |
| Performance | `http://localhost:5173` | Maintains 60fps with multiple projectiles active |

### Visual Verification
| Check | Expected |
|-------|----------|
| Projectile appearance | Cluster of ~20 animated pixels, not a solid sphere |
| Animation quality | Pixels visibly scramble/jitter each frame |
| Color scheme | Cyan/blue photon energy colors (#00FFFF to #0088FF range) |
| Firing origin | Projectiles clearly start from wing positions, not center |
| Convergence | Projectiles angle inward toward crosshair center |

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete
- [ ] Visual verification confirms scrambled energy effect
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns (BufferGeometry particles)
- [ ] No performance degradation with multiple projectiles
- [ ] No security vulnerabilities introduced
