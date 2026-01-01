import * as THREE from 'three';

/**
 * Enemy types
 */
export const EnemyType = {
  FIGHTER: 'FIGHTER',
  CRUISER: 'CRUISER',
  BASESTAR: 'BASESTAR',
} as const;

export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType];

/**
 * Enemy states
 */
export const EnemyState = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  ATTACK: 'ATTACK',
  EVADE: 'EVADE',
} as const;

export type EnemyState = (typeof EnemyState)[keyof typeof EnemyState];

/**
 * Difficulty settings for enemy behavior scaling
 */
export interface DifficultySettings {
  aggressionMultiplier: number; // Fire rate multiplier (lower = faster)
  evasionChance: number; // Chance per frame to evade
  leadAccuracy: number; // 0-1, how accurately enemies lead targets
  shieldRegenChance: number; // Basestar shield regen per frame
  cruiserProvocationSensitivity: number; // 0=direct hit only, 1=always hostile
}

export const DIFFICULTY_SETTINGS: Record<string, DifficultySettings> = {
  NOVICE: {
    aggressionMultiplier: 1.4,
    evasionChance: 0.02,
    leadAccuracy: 0.5,
    shieldRegenChance: 0.003,
    cruiserProvocationSensitivity: 0,
  },
  PILOT: {
    aggressionMultiplier: 1.0,
    evasionChance: 0.03,
    leadAccuracy: 0.65,
    shieldRegenChance: 0.004,
    cruiserProvocationSensitivity: 0.3,
  },
  WARRIOR: {
    aggressionMultiplier: 0.8,
    evasionChance: 0.05,
    leadAccuracy: 0.8,
    shieldRegenChance: 0.005,
    cruiserProvocationSensitivity: 0.6,
  },
  COMMANDER: {
    aggressionMultiplier: 0.65,
    evasionChance: 0.08,
    leadAccuracy: 0.95,
    shieldRegenChance: 0.007,
    cruiserProvocationSensitivity: 1.0,
  },
};

/**
 * Enemy - Base class for all Zylon enemy ships
 */
export class Enemy {
  protected mesh: THREE.Group;
  protected type: EnemyType;
  protected state: EnemyState;
  protected health: number;
  protected maxHealth: number;
  protected speed: number;
  protected position: THREE.Vector3;
  protected velocity: THREE.Vector3;
  protected targetPosition: THREE.Vector3 | null = null;

  // Combat
  protected hasShields: boolean = false;
  protected shieldsActive: boolean = false;
  protected fireRate: number = 2; // Seconds between shots
  protected lastFireTime: number = 0;
  protected attackRange: number = 100;

  // Fighter-specific movement
  protected orbitDirection: number = 1; // 1 or -1 for orbit direction
  protected weavePhase: number = 0; // For sinusoidal weaving
  protected orbitAngle: number = 0; // Current angle in orbit

  // Cruiser-specific
  protected provoked: boolean = false;
  protected patrolWaypoints: THREE.Vector3[] = [];
  protected currentWaypointIndex: number = 0;
  protected waypointPauseTimer: number = 0;

  // Basestar-specific
  protected shieldRegenTimer: number = 0;

  // Difficulty settings
  protected difficultySettings: DifficultySettings = DIFFICULTY_SETTINGS.PILOT;

  // State
  public isActive: boolean = true;
  public isDestroyed: boolean = false;

  // Track last known player velocity for lead targeting
  protected lastPlayerPosition: THREE.Vector3 | null = null;
  protected estimatedPlayerVelocity: THREE.Vector3 = new THREE.Vector3();

  constructor(type: EnemyType, position: THREE.Vector3) {
    this.type = type;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.state = EnemyState.IDLE;

    // Set type-specific properties
    // Speed uses same scale as player: impulse * 50 units/sec
    switch (type) {
      case EnemyType.FIGHTER:
        this.health = this.maxHealth = 2;
        this.speed = 7 * 50; // Impulse 7 equivalent (350 units/sec)
        this.fireRate = 1.5;
        this.attackRange = 80;
        break;
      case EnemyType.CRUISER:
        this.health = this.maxHealth = 4;
        this.speed = 5 * 50; // Impulse 5 equivalent (250 units/sec)
        this.fireRate = 2.5;
        this.attackRange = 120;
        break;
      case EnemyType.BASESTAR:
        this.health = this.maxHealth = 8;
        this.speed = 0; // Stationary
        this.fireRate = 3;
        this.hasShields = true;
        this.shieldsActive = true;
        this.attackRange = 150;
        break;
    }

    // Initialize type-specific behaviors
    if (type === EnemyType.FIGHTER) {
      // Randomize orbit direction
      this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
      this.orbitAngle = Math.random() * Math.PI * 2;
    } else if (type === EnemyType.CRUISER) {
      // Generate patrol waypoints
      this.generatePatrolWaypoints();
    }

    this.mesh = this.createModel();
    this.mesh.position.copy(position);
  }

  /**
   * Set difficulty settings for this enemy
   */
  public setDifficulty(difficulty: string): void {
    this.difficultySettings =
      DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.PILOT;

    // Commander difficulty: Cruisers are always hostile
    if (
      difficulty === 'COMMANDER' &&
      this.type === EnemyType.CRUISER &&
      this.difficultySettings.cruiserProvocationSensitivity >= 1.0
    ) {
      this.provoked = true;
    }
  }

  /**
   * Generate patrol waypoints for Cruiser
   */
  private generatePatrolWaypoints(): void {
    // Create a figure-8 or rectangular patrol pattern
    const centerX = this.position.x;
    const centerY = this.position.y;
    const centerZ = this.position.z;
    const patternSize = 80;

    // Figure-8 pattern with 6 waypoints
    this.patrolWaypoints = [
      new THREE.Vector3(centerX + patternSize, centerY, centerZ),
      new THREE.Vector3(centerX + patternSize * 0.5, centerY + 20, centerZ + patternSize * 0.5),
      new THREE.Vector3(centerX, centerY, centerZ + patternSize),
      new THREE.Vector3(centerX - patternSize, centerY, centerZ),
      new THREE.Vector3(centerX - patternSize * 0.5, centerY - 20, centerZ - patternSize * 0.5),
      new THREE.Vector3(centerX, centerY, centerZ - patternSize),
    ];

    this.currentWaypointIndex = 0;
  }

  /**
   * Create the enemy ship model
   */
  protected createModel(): THREE.Group {
    const group = new THREE.Group();

    switch (this.type) {
      case EnemyType.FIGHTER:
        this.createFighterModel(group);
        break;
      case EnemyType.CRUISER:
        this.createCruiserModel(group);
        break;
      case EnemyType.BASESTAR:
        this.createBasestarModel(group);
        break;
    }

    return group;
  }

  /**
   * Create Zylon Fighter model - pixel art style diamond shape
   * Based on original Atari 800 sprite
   */
  private createFighterModel(group: THREE.Group): void {
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const pixelSize = 0.4;

    // Create pixel art diamond shape (like original)
    // Row pattern from top to bottom:
    //     X       (row 0)
    //    XXX      (row 1)
    //   XXXXX     (row 2) - widest
    //    XXX      (row 3)
    //     X       (row 4)
    const pattern = [
      [0],                    // row 0
      [-1, 0, 1],            // row 1
      [-2, -1, 0, 1, 2],     // row 2
      [-1, 0, 1],            // row 3
      [0],                    // row 4
    ];

    const pixelGeometry = new THREE.BoxGeometry(pixelSize, pixelSize * 0.5, pixelSize);

    pattern.forEach((row, rowIndex) => {
      const y = (2 - rowIndex) * pixelSize * 0.6;
      row.forEach((x) => {
        const pixel = new THREE.Mesh(pixelGeometry, material);
        pixel.position.set(x * pixelSize, y, 0);
        group.add(pixel);
      });
    });

    // Add small engine pixels at back
    const enginePixel1 = new THREE.Mesh(pixelGeometry, material);
    enginePixel1.position.set(0, 0, pixelSize);
    group.add(enginePixel1);

    group.scale.set(1.5, 1.5, 1.5);
  }

  /**
   * Create Zylon Cruiser model - pixel art H-shape style
   * Based on original Atari 800 sprite
   */
  private createCruiserModel(group: THREE.Group): void {
    const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const pixelSize = 0.5;

    // Create pixel art H-shape cruiser (like original manual shows)
    // Pattern:
    //  XX   XX    (row 0) - engine pods
    //  XX   XX    (row 1)
    //  XXXXXXX    (row 2) - center hull
    //  XXXXXXX    (row 3)
    //  XX   XX    (row 4)
    //  XX   XX    (row 5) - engine pods
    const pattern = [
      [-3, -2, 2, 3],           // row 0 - outer pods
      [-3, -2, 2, 3],           // row 1
      [-3, -2, -1, 0, 1, 2, 3], // row 2 - full center
      [-3, -2, -1, 0, 1, 2, 3], // row 3
      [-3, -2, 2, 3],           // row 4
      [-3, -2, 2, 3],           // row 5 - outer pods
    ];

    const pixelGeometry = new THREE.BoxGeometry(pixelSize, pixelSize * 0.4, pixelSize);

    pattern.forEach((row, rowIndex) => {
      const z = (2.5 - rowIndex) * pixelSize;
      row.forEach((x) => {
        const pixel = new THREE.Mesh(pixelGeometry, material);
        pixel.position.set(x * pixelSize * 0.5, 0, z);
        group.add(pixel);
      });
    });

    // Add command bridge on top
    const bridgeGeometry = new THREE.BoxGeometry(pixelSize, pixelSize * 0.6, pixelSize);
    const bridge = new THREE.Mesh(bridgeGeometry, material);
    bridge.position.set(0, pixelSize * 0.4, 0);
    group.add(bridge);

    group.scale.set(1.2, 1.2, 1.2);
  }

  /**
   * Create Zylon Basestar model - pixel art pyramid style
   * Based on original Atari 800 sprite (gold pyramid)
   */
  private createBasestarModel(group: THREE.Group): void {
    const material = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const pixelSize = 0.6;

    // Create pixel art stepped pyramid (like original)
    // Layers from bottom to top, each smaller than the last
    const layers = [
      { size: 5, y: 0 },      // Bottom layer - 5x5
      { size: 4, y: 1 },      // Layer 2 - 4x4
      { size: 3, y: 2 },      // Layer 3 - 3x3
      { size: 2, y: 3 },      // Layer 4 - 2x2
      { size: 1, y: 4 },      // Top - 1x1
    ];

    const pixelGeometry = new THREE.BoxGeometry(pixelSize, pixelSize * 0.6, pixelSize);

    layers.forEach((layer) => {
      const halfSize = Math.floor(layer.size / 2);
      for (let x = -halfSize; x <= halfSize; x++) {
        for (let z = -halfSize; z <= halfSize; z++) {
          // For odd sizes, include center; for even, offset
          if (layer.size % 2 === 0 && (x === 0 || z === 0)) continue;
          const pixel = new THREE.Mesh(pixelGeometry, material);
          pixel.position.set(
            x * pixelSize,
            layer.y * pixelSize * 0.5 - 1,
            z * pixelSize
          );
          group.add(pixel);
        }
      }
    });

    // Shield effect - pixelated cube outline
    const shieldMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
    });
    const shieldGeometry = new THREE.BoxGeometry(
      pixelSize * 6,
      pixelSize * 4,
      pixelSize * 6
    );
    const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shield.position.y = 0.5;
    shield.name = 'shield';
    group.add(shield);

    group.scale.set(1.3, 1.3, 1.3);
  }

  /**
   * Get the Three.js object
   */
  public getObject(): THREE.Object3D {
    return this.mesh;
  }

  /**
   * Get enemy type
   */
  public getType(): EnemyType {
    return this.type;
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
    switch (this.type) {
      case EnemyType.FIGHTER:
        return 1.5;
      case EnemyType.CRUISER:
        return 2.5;
      case EnemyType.BASESTAR:
        return 4;
      default:
        return 2;
    }
  }

  /**
   * Take damage
   */
  public takeDamage(amount: number): boolean {
    // Trigger provocation for Cruisers
    this.onHit();

    // Basestar shields must be down to take damage
    if (this.hasShields && this.shieldsActive) {
      // Damage reduces shields
      this.shieldsActive = false;
      this.updateShieldVisual();
      return false;
    }

    this.health -= amount;

    if (this.health <= 0) {
      this.health = 0;
      this.isDestroyed = true;
      this.isActive = false;
      return true;
    }

    return false;
  }

  /**
   * Update shield visual
   */
  private updateShieldVisual(): void {
    const shield = this.mesh.getObjectByName('shield');
    if (shield) {
      shield.visible = this.shieldsActive;
    }
  }

  /**
   * Update enemy state
   */
  public update(deltaTime: number, playerPosition: THREE.Vector3): void {
    if (!this.isActive) return;

    // Track player velocity for lead targeting
    if (this.lastPlayerPosition) {
      this.estimatedPlayerVelocity
        .copy(playerPosition)
        .sub(this.lastPlayerPosition)
        .divideScalar(deltaTime);
    }
    this.lastPlayerPosition = playerPosition.clone();

    // Calculate distance to player
    const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

    // Pursuit range - enemies only actively move when within this range
    const PURSUIT_RANGE = 200;

    // Update state based on type and distance
    this.updateState(distanceToPlayer, PURSUIT_RANGE);

    // Update based on type-specific behavior
    switch (this.type) {
      case EnemyType.FIGHTER:
        this.updateFighter(deltaTime, playerPosition, distanceToPlayer);
        break;
      case EnemyType.CRUISER:
        this.updateCruiser(deltaTime, playerPosition, distanceToPlayer);
        break;
      case EnemyType.BASESTAR:
        this.updateBasestar(deltaTime, playerPosition, distanceToPlayer);
        break;
    }

    // Basestar shields regenerate with difficulty-scaled chance
    if (this.hasShields && !this.shieldsActive) {
      if (Math.random() < this.difficultySettings.shieldRegenChance) {
        this.shieldsActive = true;
        this.updateShieldVisual();
      }
    }
  }

  /**
   * Update state based on distance and type
   */
  private updateState(distanceToPlayer: number, pursuitRange: number): void {
    if (this.type === EnemyType.BASESTAR) {
      // Basestar is always stationary but enters attack mode when player is close
      this.state =
        distanceToPlayer < this.attackRange ? EnemyState.ATTACK : EnemyState.IDLE;
      return;
    }

    if (this.type === EnemyType.CRUISER && !this.provoked) {
      // Unprovoked Cruisers only patrol, never attack
      this.state =
        distanceToPlayer < pursuitRange ? EnemyState.PATROL : EnemyState.IDLE;
      return;
    }

    // Fighters and provoked Cruisers
    if (distanceToPlayer < this.attackRange) {
      this.state = EnemyState.ATTACK;
    } else if (distanceToPlayer < pursuitRange) {
      this.state = EnemyState.PATROL;
    } else {
      this.state = EnemyState.IDLE;
    }
  }

  /**
   * Fighter-specific update - aggressive pursuit and strafe-orbit
   */
  private updateFighter(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    distanceToPlayer: number
  ): void {
    switch (this.state) {
      case EnemyState.IDLE:
        // Gentle bobbing when far away
        this.mesh.rotation.y += deltaTime * 0.5;
        break;

      case EnemyState.PATROL:
        // Aggressive pursuit with weaving
        this.updateFighterPursuit(deltaTime, playerPosition, distanceToPlayer);
        break;

      case EnemyState.ATTACK:
        // Strafe-orbit around player
        this.updateFighterOrbit(deltaTime, playerPosition, distanceToPlayer);
        break;
    }

    // Evasive maneuvers (difficulty-scaled)
    if (
      this.state === EnemyState.ATTACK &&
      Math.random() < this.difficultySettings.evasionChance
    ) {
      this.performEvasiveManeuver();
    }
  }

  /**
   * Fighter pursuit behavior - approach with weaving
   */
  private updateFighterPursuit(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    _distanceToPlayer: number
  ): void {
    // Update weave phase
    this.weavePhase += deltaTime * 4; // 4 rad/s = ~0.6Hz weave frequency

    // Calculate direction to player
    const toPlayer = playerPosition.clone().sub(this.mesh.position);
    const direction = toPlayer.normalize();

    // Add sinusoidal weaving perpendicular to approach direction
    const weaveAmplitude = 15;
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const weaveOffset = perpendicular.multiplyScalar(
      Math.sin(this.weavePhase) * weaveAmplitude * deltaTime
    );

    // Move toward player with weaving
    const movement = direction.multiplyScalar(this.speed * deltaTime);
    this.mesh.position.add(movement).add(weaveOffset);

    // Face player
    this.mesh.lookAt(playerPosition);
  }

  /**
   * Fighter orbit behavior - circle-strafe around player
   */
  private updateFighterOrbit(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    _distanceToPlayer: number
  ): void {
    const ORBIT_RADIUS = 30; // Desired orbit distance
    const ORBIT_SPEED = 2.5; // Radians per second

    // Update orbit angle
    this.orbitAngle += this.orbitDirection * ORBIT_SPEED * deltaTime;

    // Calculate target orbit position
    const orbitX = playerPosition.x + Math.cos(this.orbitAngle) * ORBIT_RADIUS;
    const orbitZ = playerPosition.z + Math.sin(this.orbitAngle) * ORBIT_RADIUS;
    const orbitY =
      playerPosition.y + Math.sin(this.orbitAngle * 0.5) * 10; // Slight vertical variation

    const targetOrbitPos = new THREE.Vector3(orbitX, orbitY, orbitZ);

    // Move toward orbit position
    const toOrbit = targetOrbitPos.clone().sub(this.mesh.position);
    const orbitDistance = toOrbit.length();

    if (orbitDistance > 1) {
      const moveSpeed = Math.min(this.speed * deltaTime, orbitDistance);
      this.mesh.position.add(toOrbit.normalize().multiplyScalar(moveSpeed));
    }

    // Always face the player
    this.mesh.lookAt(playerPosition);

    // Occasionally change orbit direction
    if (Math.random() < 0.005) {
      this.orbitDirection *= -1;
    }
  }

  /**
   * Perform evasive maneuver
   */
  private performEvasiveManeuver(): void {
    // Quick lateral dodge
    const dodgeDistance = 8 + Math.random() * 7; // 8-15 units
    this.mesh.position.add(
      new THREE.Vector3(
        (Math.random() - 0.5) * dodgeDistance,
        (Math.random() - 0.5) * dodgeDistance * 0.5,
        (Math.random() - 0.5) * dodgeDistance
      )
    );
  }

  /**
   * Cruiser-specific update - patrol patterns and defensive behavior
   */
  private updateCruiser(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    distanceToPlayer: number
  ): void {
    switch (this.state) {
      case EnemyState.IDLE:
        // Slow rotation when idle
        this.mesh.rotation.y += deltaTime * 0.3;
        break;

      case EnemyState.PATROL:
        // Follow patrol waypoints
        this.updateCruiserPatrol(deltaTime);
        break;

      case EnemyState.ATTACK:
        // Tactical approach - maintain distance
        this.updateCruiserAttack(deltaTime, playerPosition, distanceToPlayer);
        break;
    }
  }

  /**
   * Cruiser patrol - follow waypoint pattern
   */
  private updateCruiserPatrol(deltaTime: number): void {
    if (this.patrolWaypoints.length === 0) return;

    // Check if pausing at waypoint
    if (this.waypointPauseTimer > 0) {
      this.waypointPauseTimer -= deltaTime;
      this.mesh.rotation.y += deltaTime * 0.2; // Slight rotation while paused
      return;
    }

    const targetWaypoint = this.patrolWaypoints[this.currentWaypointIndex];
    const toWaypoint = targetWaypoint.clone().sub(this.mesh.position);
    const distance = toWaypoint.length();

    if (distance < 5) {
      // Reached waypoint - pause briefly then move to next
      this.waypointPauseTimer = 0.5; // 0.5 second pause
      this.currentWaypointIndex =
        (this.currentWaypointIndex + 1) % this.patrolWaypoints.length;
    } else {
      // Move toward waypoint at patrol speed (slower than attack speed)
      const patrolSpeed = this.speed * 0.6;
      const direction = toWaypoint.normalize();
      this.mesh.position.add(direction.multiplyScalar(patrolSpeed * deltaTime));

      // Smoothly rotate to face waypoint
      this.mesh.lookAt(targetWaypoint);
    }
  }

  /**
   * Cruiser attack - maintain tactical distance
   */
  private updateCruiserAttack(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    distanceToPlayer: number
  ): void {
    const PREFERRED_MIN = 40;
    const PREFERRED_MAX = 60;

    const toPlayer = playerPosition.clone().sub(this.mesh.position);

    if (distanceToPlayer < PREFERRED_MIN) {
      // Too close - back off
      const direction = toPlayer.normalize().negate();
      this.mesh.position.add(direction.multiplyScalar(this.speed * 0.5 * deltaTime));
    } else if (distanceToPlayer > PREFERRED_MAX) {
      // Too far - approach
      const direction = toPlayer.normalize();
      this.mesh.position.add(direction.multiplyScalar(this.speed * deltaTime));
    } else {
      // In preferred range - strafe slowly
      const perpendicular = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
      this.mesh.position.add(
        perpendicular.multiplyScalar(this.speed * 0.3 * deltaTime)
      );
    }

    // Always face the player
    this.mesh.lookAt(playerPosition);
  }

  /**
   * Basestar-specific update - stationary with rotation
   */
  private updateBasestar(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    _distanceToPlayer: number
  ): void {
    if (this.state === EnemyState.ATTACK) {
      // Track player when in attack range
      this.mesh.lookAt(playerPosition);

      // Faster rotation when shields are down (urgency)
      if (!this.shieldsActive) {
        this.mesh.rotation.y += deltaTime * 0.3;
      }
    } else {
      // Slow idle rotation
      this.mesh.rotation.y += deltaTime * 0.2;
    }
  }

  /**
   * Set provoked state (for Cruisers)
   */
  public setProvoked(value: boolean): void {
    this.provoked = value;
  }

  /**
   * Check if enemy is provoked
   */
  public isProvoked(): boolean {
    return this.provoked;
  }

  /**
   * Handle being hit - may provoke Cruisers
   */
  public onHit(): void {
    if (this.type === EnemyType.CRUISER) {
      this.provoked = true;
    }
  }

  /**
   * Check near miss - may provoke Cruisers based on difficulty
   */
  public checkNearMiss(torpedoPosition: THREE.Vector3, missDistance: number): void {
    if (this.type !== EnemyType.CRUISER || this.provoked) return;

    const distance = this.mesh.position.distanceTo(torpedoPosition);
    if (distance < missDistance) {
      // Near miss - check provocation based on difficulty sensitivity
      if (Math.random() < this.difficultySettings.cruiserProvocationSensitivity) {
        this.provoked = true;
      }
    }
  }

  /**
   * Check if enemy should fire at player
   */
  public shouldFire(currentTime: number, playerPosition: THREE.Vector3): boolean {
    if (!this.isActive || this.state !== EnemyState.ATTACK) return false;

    // Cruisers only fire when provoked
    if (this.type === EnemyType.CRUISER && !this.provoked) return false;

    const distance = this.mesh.position.distanceTo(playerPosition);
    if (distance > this.attackRange) return false;

    // Apply difficulty-scaled fire rate
    const adjustedFireRate = this.fireRate * this.difficultySettings.aggressionMultiplier;

    // Low health Fighters fire faster (desperation mode)
    const healthMultiplier =
      this.type === EnemyType.FIGHTER && this.health === 1 ? 0.5 : 1.0;

    if (currentTime - this.lastFireTime >= adjustedFireRate * healthMultiplier) {
      this.lastFireTime = currentTime;
      return true;
    }

    return false;
  }

  /**
   * Get the predicted position to aim at (lead targeting)
   * Returns a position ahead of the player based on projectile travel time
   */
  public getLeadTargetPosition(
    playerPosition: THREE.Vector3,
    projectileSpeed: number = 200
  ): THREE.Vector3 {
    const distance = this.mesh.position.distanceTo(playerPosition);
    const travelTime = distance / projectileSpeed;

    // Calculate predicted position based on player velocity
    const leadPosition = playerPosition.clone();

    // Apply lead accuracy based on difficulty (interpolate between direct and full lead)
    const leadAmount = this.difficultySettings.leadAccuracy;
    const predictedOffset = this.estimatedPlayerVelocity
      .clone()
      .multiplyScalar(travelTime * leadAmount);

    leadPosition.add(predictedOffset);

    return leadPosition;
  }

  /**
   * Get firing direction (for creating projectiles)
   */
  public getFiringDirection(playerPosition: THREE.Vector3): THREE.Vector3 {
    const targetPos = this.getLeadTargetPosition(playerPosition);
    return targetPos.sub(this.mesh.position).normalize();
  }

  /**
   * Get health percentage
   */
  public getHealthPercent(): number {
    return (this.health / this.maxHealth) * 100;
  }

  /**
   * Check if shields are active
   */
  public hasActiveShields(): boolean {
    return this.hasShields && this.shieldsActive;
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
