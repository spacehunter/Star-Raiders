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

  // State
  public isActive: boolean = true;
  public isDestroyed: boolean = false;

  constructor(type: EnemyType, position: THREE.Vector3) {
    this.type = type;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.state = EnemyState.IDLE;

    // Set type-specific properties
    switch (type) {
      case EnemyType.FIGHTER:
        this.health = this.maxHealth = 2;
        this.speed = 50;
        this.fireRate = 1.5;
        this.attackRange = 80;
        break;
      case EnemyType.CRUISER:
        this.health = this.maxHealth = 4;
        this.speed = 30;
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

    this.mesh = this.createModel();
    this.mesh.position.copy(position);
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
   * Create Zylon Fighter model - small, agile, cyan
   */
  private createFighterModel(group: THREE.Group): void {
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    // Main body - diamond shape
    const bodyGeometry = new THREE.OctahedronGeometry(1, 0);
    bodyGeometry.scale(1, 0.3, 1.5);
    const body = new THREE.Mesh(bodyGeometry, material);
    group.add(body);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(2.5, 0.1, 0.5);
    const wings = new THREE.Mesh(wingGeometry, material);
    group.add(wings);

    group.scale.set(0.8, 0.8, 0.8);
  }

  /**
   * Create Zylon Cruiser model - medium, magenta
   */
  private createCruiserModel(group: THREE.Group): void {
    const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });

    // Main hull
    const hullGeometry = new THREE.BoxGeometry(1.5, 0.6, 3);
    const hull = new THREE.Mesh(hullGeometry, material);
    group.add(hull);

    // Command section
    const commandGeometry = new THREE.ConeGeometry(0.5, 1, 4);
    const command = new THREE.Mesh(commandGeometry, material);
    command.rotation.x = -Math.PI / 2;
    command.position.z = -2;
    group.add(command);

    // Engine pods
    const podGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 6);
    const leftPod = new THREE.Mesh(podGeometry, material);
    leftPod.rotation.x = Math.PI / 2;
    leftPod.position.set(-1, 0, 0.5);
    group.add(leftPod);

    const rightPod = new THREE.Mesh(podGeometry, material);
    rightPod.rotation.x = Math.PI / 2;
    rightPod.position.set(1, 0, 0.5);
    group.add(rightPod);

    group.scale.set(1.2, 1.2, 1.2);
  }

  /**
   * Create Zylon Basestar model - large pyramid, gold
   */
  private createBasestarModel(group: THREE.Group): void {
    const material = new THREE.MeshBasicMaterial({ color: 0xffd700 });

    // Main pyramid structure
    const pyramidGeometry = new THREE.ConeGeometry(2, 3, 4);
    const pyramid = new THREE.Mesh(pyramidGeometry, material);
    pyramid.rotation.y = Math.PI / 4;
    group.add(pyramid);

    // Base platform
    const baseGeometry = new THREE.BoxGeometry(3.5, 0.3, 3.5);
    const base = new THREE.Mesh(baseGeometry, material);
    base.position.y = -1.5;
    group.add(base);

    // Shield glow (when shields are active)
    const shieldGeometry = new THREE.SphereGeometry(3, 16, 16);
    const shieldMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shield.name = 'shield';
    group.add(shield);

    group.scale.set(1.5, 1.5, 1.5);
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

    // Calculate distance to player
    const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

    // Update state based on distance
    if (distanceToPlayer < this.attackRange) {
      this.state = EnemyState.ATTACK;
    } else if (this.type !== EnemyType.BASESTAR) {
      this.state = EnemyState.PATROL;
    }

    // Update based on state
    switch (this.state) {
      case EnemyState.IDLE:
        this.updateIdle(deltaTime);
        break;
      case EnemyState.PATROL:
        this.updatePatrol(deltaTime);
        break;
      case EnemyState.ATTACK:
        this.updateAttack(deltaTime, playerPosition);
        break;
      case EnemyState.EVADE:
        this.updateEvade(deltaTime, playerPosition);
        break;
    }

    // Face the player when attacking
    if (this.state === EnemyState.ATTACK) {
      this.mesh.lookAt(playerPosition);
    }

    // Basestar shields regenerate
    if (this.hasShields && !this.shieldsActive && Math.random() < 0.001) {
      this.shieldsActive = true;
      this.updateShieldVisual();
    }
  }

  /**
   * Idle behavior
   */
  private updateIdle(deltaTime: number): void {
    // Gentle bobbing
    this.mesh.rotation.y += deltaTime * 0.5;
  }

  /**
   * Patrol behavior
   */
  private updatePatrol(deltaTime: number): void {
    // Random movement
    if (!this.targetPosition || this.mesh.position.distanceTo(this.targetPosition) < 5) {
      this.targetPosition = new THREE.Vector3(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 200
      );
    }

    const direction = this.targetPosition.clone().sub(this.mesh.position).normalize();
    this.mesh.position.add(direction.multiplyScalar(this.speed * deltaTime));
    this.mesh.lookAt(this.targetPosition);
  }

  /**
   * Attack behavior
   */
  private updateAttack(deltaTime: number, playerPosition: THREE.Vector3): void {
    if (this.type === EnemyType.BASESTAR) {
      // Basestar is stationary, just rotates
      this.mesh.rotation.y += deltaTime * 0.2;
      return;
    }

    // Move toward player but maintain some distance
    const toPlayer = playerPosition.clone().sub(this.mesh.position);
    const distance = toPlayer.length();

    if (distance > 30) {
      // Move closer
      const direction = toPlayer.normalize();
      this.mesh.position.add(direction.multiplyScalar(this.speed * deltaTime));
    } else if (distance < 20) {
      // Too close, back off
      const direction = toPlayer.normalize().negate();
      this.mesh.position.add(direction.multiplyScalar(this.speed * deltaTime * 0.5));
    }

    // Evasive maneuvers
    if (this.type === EnemyType.FIGHTER && Math.random() < 0.02) {
      this.mesh.position.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 10
        )
      );
    }
  }

  /**
   * Evade behavior
   */
  private updateEvade(deltaTime: number, playerPosition: THREE.Vector3): void {
    // Move away from player
    const awayFromPlayer = this.mesh.position.clone().sub(playerPosition).normalize();
    this.mesh.position.add(awayFromPlayer.multiplyScalar(this.speed * deltaTime));
  }

  /**
   * Check if enemy should fire at player
   */
  public shouldFire(currentTime: number, playerPosition: THREE.Vector3): boolean {
    if (!this.isActive || this.state !== EnemyState.ATTACK) return false;

    const distance = this.mesh.position.distanceTo(playerPosition);
    if (distance > this.attackRange) return false;

    if (currentTime - this.lastFireTime >= this.fireRate) {
      this.lastFireTime = currentTime;
      return true;
    }

    return false;
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
