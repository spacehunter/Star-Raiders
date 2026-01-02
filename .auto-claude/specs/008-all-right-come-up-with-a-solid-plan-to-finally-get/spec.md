# Specification: Enemy Weapon Firing System

## Overview

Implement a complete enemy weapon firing system that enables the three enemy types (Fighter, Cruiser, Basestar) to actively shoot at the player. The system must create enemy projectiles, differentiate firing behaviors based on enemy type and difficulty level, detect collisions with the player, and apply appropriate damage. The game already has the targeting and fire-decision logic in place (`shouldFire`, `getLeadTargetPosition`, `getFiringDirection`), but lacks the actual projectile creation and damage application to the player.

## Workflow Type

**Type**: feature

**Rationale**: This is a new gameplay feature that extends the existing combat system. The infrastructure (enemy AI, targeting, fire rate logic) exists, but the actual projectile spawning and player damage mechanics need to be built.

## Task Scope

### Services Involved
- **main** (primary) - Single service TypeScript/Three.js game

### This Task Will:
- [ ] Create an `EnemyProjectile` class for enemy-fired weapons
- [ ] Integrate enemy projectile spawning into the game loop when enemies fire
- [ ] Implement enemy projectile collision detection with the player
- [ ] Apply damage to player (energy reduction, potential system damage)
- [ ] Differentiate projectile behaviors per enemy type (speed, appearance, damage)
- [ ] Adjust behaviors based on difficulty level (existing `DifficultySettings`)

### Out of Scope:
- Modifying enemy AI movement patterns (already implemented)
- Changing the firing rate logic (already implemented in `shouldFire`)
- Player projectile mechanics (already implemented via `PhotonTorpedo`)
- Sound effects (can be added later via `SoundManager`)
- Visual effects beyond basic projectile appearance (can enhance via `VFXSystem` later)

## Service Context

### Main Service

**Tech Stack:**
- Language: TypeScript
- Framework: Three.js (3D graphics), Vite (build tool)
- Key directories: `src/` (source code)

**Entry Point:** `src/main.ts`

**How to Run:**
```bash
npm run dev
```

**Port:** 5173

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/entities/EnemyProjectile.ts` | main | **CREATE** - New entity class for enemy weapons |
| `src/game/Game.ts` | main | Add enemy projectile spawning, update loop, collision detection |
| `src/systems/CombatSystem.ts` | main | May need to return firing data (direction, type) |
| `src/game/GameState.ts` | main | Add method for applying damage to player |
| `src/ui/ControlPanel.ts` | main | Display damage alerts/warnings |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/entities/PhotonTorpedo.ts` | Projectile entity structure (velocity, update, collision, dispose) |
| `src/entities/Enemy.ts` | Enemy type definitions, firing logic, difficulty scaling |
| `src/config/EnemyConfig.ts` | Configuration constants pattern |
| `src/systems/CombatSystem.ts` | Entity management pattern (array of entities, update loop) |
| `src/game/Game.ts` | Integration pattern for entities (spawn, update, cleanup) |

## Patterns to Follow

### Projectile Entity Pattern

From `src/entities/PhotonTorpedo.ts`:

```typescript
export class PhotonTorpedo {
  private mesh: THREE.Mesh;
  private velocity: THREE.Vector3;
  private age: number = 0;
  private maxAge: number = 3;
  private speed: number = 200;
  public isActive: boolean = true;

  constructor(position: THREE.Vector3, direction: THREE.Vector3) {
    // Create mesh, set velocity
  }

  public update(deltaTime: number): void {
    // Move based on velocity, age out
  }

  public checkCollision(targetPosition: THREE.Vector3, targetRadius: number): boolean {
    // Simple sphere collision
  }

  public dispose(): void {
    // Clean up Three.js resources
  }
}
```

**Key Points:**
- `isActive` flag for lifecycle management
- `update()` method called each frame
- `checkCollision()` for hit detection
- `dispose()` for cleanup

### Enemy Type Differentiation Pattern

From `src/entities/Enemy.ts`:

```typescript
switch (this.type) {
  case EnemyType.FIGHTER:
    this.health = this.maxHealth = 2;
    this.speed = ENEMY_CONFIG.speeds.FIGHTER * ENEMY_CONFIG.UNITS_PER_IMPULSE;
    this.fireRate = 1.5;
    this.attackRange = 80;
    break;
  case EnemyType.CRUISER:
    // Different properties...
    break;
  case EnemyType.BASESTAR:
    // Different properties...
    break;
}
```

**Key Points:**
- Use switch/case for type differentiation
- Configure from constants in EnemyConfig
- Each type has distinct characteristics

### Entity Array Management Pattern

From `src/game/Game.ts` (torpedoes):

```typescript
private torpedoes: PhotonTorpedo[] = [];

// Spawning
const torpedo = new PhotonTorpedo(position, direction);
this.torpedoes.push(torpedo);
this.scene.add(torpedo.getObject());

// Update loop
for (let i = this.torpedoes.length - 1; i >= 0; i--) {
  const torpedo = this.torpedoes[i];
  torpedo.update(deltaTime);

  if (!torpedo.isActive) {
    this.scene.remove(torpedo.getObject());
    torpedo.dispose();
    this.torpedoes.splice(i, 1);
  }
}
```

**Key Points:**
- Iterate backwards when removing items
- Add to scene when spawning
- Remove from scene before disposing
- Clean up with `splice()`

## Requirements

### Functional Requirements

1. **Enemy Projectile Creation**
   - Description: Create a new `EnemyProjectile` class that enemies fire at the player
   - Acceptance: Enemy projectiles visible in-game when enemies fire

2. **Type-Based Projectile Differentiation**
   - Description: Different enemy types fire projectiles with different characteristics
   - Acceptance:
     - Fighter: Fast, small green/cyan projectiles, lower damage
     - Cruiser: Medium speed, purple projectiles, medium damage
     - Basestar: Slower, large gold projectiles, high damage

3. **Projectile-Player Collision**
   - Description: Detect when enemy projectiles hit the player
   - Acceptance: Collisions detected reliably, projectile deactivated on hit

4. **Player Damage Application**
   - Description: Apply damage to player when hit (energy loss, possible system damage)
   - Acceptance:
     - Energy reduced on hit (amount varies by projectile type and shields)
     - Shields absorb some/all damage when active
     - Random system damage possible on higher difficulties

5. **Difficulty Scaling**
   - Description: Projectile behavior scales with difficulty settings
   - Acceptance:
     - Higher difficulty = more accurate targeting (via existing `leadAccuracy`)
     - Higher difficulty = faster fire rate (via existing `aggressionMultiplier`)
     - Damage may scale with difficulty

### Edge Cases

1. **No Active Enemies** - Skip firing logic when enemy count is 0
2. **Enemy Destroyed Mid-Flight** - Projectiles continue after enemy death
3. **Shields Toggle Mid-Flight** - Check shield state at impact time, not fire time
4. **Multiple Simultaneous Hits** - Process all hits in single frame
5. **Player in Hyperwarp** - Skip collision detection during hyperwarp
6. **Zero Energy State** - Player death when energy reaches 0 (existing logic)

## Implementation Notes

### DO
- Follow the `PhotonTorpedo` pattern for `EnemyProjectile`
- Use existing `enemy.getFiringDirection()` for projectile direction
- Use existing `DIFFICULTY_SETTINGS` for behavior scaling
- Create projectile appearance variations per enemy type (color, size)
- Show damage messages via `controlPanel.showMessage()`
- Use relative coordinate system (projectiles move with space like player torpedoes)

### DON'T
- Create complex particle systems (use simple Three.js geometries)
- Modify the existing enemy firing decision logic (`shouldFire`)
- Add new difficulty levels or change existing multipliers
- Implement projectile prediction for player (keep it fair)
- Add network/multiplayer considerations

## Development Environment

### Start Services

```bash
npm install
npm run dev
```

### Service URLs
- Game: http://localhost:5173

### Required Environment Variables
- None required (pure client-side game)

## Technical Design

### EnemyProjectile Class

```typescript
// src/entities/EnemyProjectile.ts
import * as THREE from 'three';
import { EnemyType } from './Enemy';

export interface EnemyProjectileConfig {
  speed: number;
  damage: number;
  color: number;
  size: number;
}

export const PROJECTILE_CONFIGS: Record<EnemyType, EnemyProjectileConfig> = {
  FIGHTER: { speed: 180, damage: 100, color: 0x00ff88, size: 0.12 },
  CRUISER: { speed: 150, damage: 200, color: 0xff00ff, size: 0.18 },
  BASESTAR: { speed: 120, damage: 350, color: 0xffd700, size: 0.25 },
};

export class EnemyProjectile {
  private mesh: THREE.Mesh;
  private velocity: THREE.Vector3;
  private age: number = 0;
  private maxAge: number = 4;
  private damage: number;
  public isActive: boolean = true;
  public sourceType: EnemyType;

  constructor(position: THREE.Vector3, direction: THREE.Vector3, enemyType: EnemyType);
  public getObject(): THREE.Object3D;
  public getPosition(): THREE.Vector3;
  public getDamage(): number;
  public update(deltaTime: number): void;
  public checkCollision(targetPosition: THREE.Vector3, targetRadius: number): boolean;
  public deactivate(): void;
  public dispose(): void;
}
```

### Game.ts Integration Points

1. Add `private enemyProjectiles: EnemyProjectile[] = [];`
2. In `update()`, after `combatSystem.update()`:
   - Call `combatSystem.getEnemyFiring()` to get firing enemy
   - If enemy fires, create `EnemyProjectile` with enemy position, direction, type
   - Add to `enemyProjectiles` array and scene
3. Add `updateEnemyProjectiles(deltaTime)` method
4. Add `checkEnemyProjectileCollisions()` method
5. In `applyPlayerMovement()`, move enemy projectiles too

### Damage Application

```typescript
// In GameState or Game class
public applyEnemyDamage(amount: number): void {
  // Shields reduce damage
  if (this.gameState.shieldsActive && !this.gameState.damage.shields) {
    amount *= 0.3; // Shields absorb 70%
    this.controlPanel.showMessage('SHIELDS ABSORBING FIRE!');
  }

  this.gameState.consumeEnergy(amount);

  // Random system damage on higher difficulties
  if (this.gameState.difficulty !== 'NOVICE' && Math.random() < 0.1) {
    this.applyRandomSystemDamage();
  }

  this.controlPanel.showMessage('TAKING FIRE!');
}
```

## Success Criteria

The task is complete when:

1. [ ] Enemies actively fire visible projectiles at the player
2. [ ] Fighter, Cruiser, and Basestar have visually distinct projectiles
3. [ ] Projectiles damage the player on collision (energy reduction)
4. [ ] Shields reduce damage when active
5. [ ] Damage messages display via control panel
6. [ ] System damage can occur on hits (higher difficulties)
7. [ ] No console errors during combat
8. [ ] Existing tests still pass
9. [ ] Game is playable and balanced

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| EnemyProjectile creation | `tests/EnemyProjectile.test.ts` | Projectile initializes with correct type-based properties |
| EnemyProjectile movement | `tests/EnemyProjectile.test.ts` | Projectile moves in correct direction at configured speed |
| EnemyProjectile collision | `tests/EnemyProjectile.test.ts` | Collision detection returns true when overlapping player |
| Damage calculation | `tests/damage.test.ts` | Shield reduction and difficulty scaling work correctly |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Enemy firing integration | Game + CombatSystem | `getEnemyFiring()` returns correct enemy and projectile spawns |
| Collision system | Game + EnemyProjectile | Player takes damage when projectile hits |
| Entity cleanup | Game + EnemyProjectile | Projectiles removed from scene after deactivation |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Combat encounter | 1. Enter sector with enemies 2. Let enemies approach 3. Observe firing | Visible projectiles fired at player |
| Damage reception | 1. Disable shields 2. Let projectile hit | Energy decreases, damage message shows |
| Shield protection | 1. Enable shields 2. Let projectile hit | Reduced energy loss, shield message shows |

### Browser Verification (if frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Main game view | `http://localhost:5173` | Enemy projectiles visible in Front view |
| Combat feedback | `http://localhost:5173` | Damage messages appear in control panel |
| Energy display | `http://localhost:5173` | Energy decreases on hit |

### Database Verification (if applicable)
Not applicable - no database in this project.

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns (PhotonTorpedo, Enemy)
- [ ] No security vulnerabilities introduced
- [ ] Game remains playable and fun

## Appendix: Existing Code Analysis

### Already Implemented (DO NOT MODIFY):

**Enemy.ts firing logic:**
- `shouldFire(currentTime, playerPosition)` - Returns true when enemy should fire
- `getFiringDirection(playerPosition)` - Returns normalized aim vector with lead targeting
- `getLeadTargetPosition(playerPosition, projectileSpeed)` - Predicts player position
- `fireRate` - Seconds between shots (varies by type)
- `lastFireTime` - Tracks last fire timestamp
- `difficultySettings.aggressionMultiplier` - Modifies fire rate
- `difficultySettings.leadAccuracy` - Accuracy of prediction (0-1)

**CombatSystem.ts:**
- `getEnemyFiring(currentTime, playerPosition)` - Returns enemy ready to fire or null

**Difficulty Settings (Enemy.ts):**
```typescript
NOVICE: { aggressionMultiplier: 1.4, leadAccuracy: 0.5, ... }
PILOT: { aggressionMultiplier: 1.0, leadAccuracy: 0.65, ... }
WARRIOR: { aggressionMultiplier: 0.8, leadAccuracy: 0.8, ... }
COMMANDER: { aggressionMultiplier: 0.65, leadAccuracy: 0.95, ... }
```

### Gap to Fill:

In `Game.ts update()`, the call to `combatSystem.getEnemyFiring()` exists but its return value is not used to spawn projectiles. This is the main integration point.
