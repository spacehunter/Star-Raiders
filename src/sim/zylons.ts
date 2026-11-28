/**
 * Zylon ships, Zylon torpedoes, meteors, our photon torpedoes and explosions: the ROM's five
 * PLAYER space objects and the 32 explosion fragments, simulated one game loop at a time.
 *
 * MANUAL_SPEC §16 (meteors), §17.7 (combat), §17.8 (Zylon behaviour), §17.13 and §18.3 (sprites).
 * ROM routines (Lorenz Wiest's disassembly, line numbers in StarRaiders.source.asm.txt):
 * GAMELOOP steps 8–11, 21, 26–27 (L3371–3970), MANEUVER (L5524), INITEXPL (L5909),
 * TRIGGER (L6495), COLLISION (L6954), INITPOSVEC (L9595), FLUSHGAMELOOP (L8828–8846) and the
 * tables ZYLONSHAPTAB, ZYLONFLPATTAB, ZYLONVELTAB, ZYLONHOMVELTAB, HITMINZTAB, HITMAXZTAB.
 *
 * Space is the ship frame in KM: our starship sits at the origin facing +z. PLAYER slots:
 *   ships[0], ships[1]  Zylon ships 0 and 1 (PLAYER0..1)
 *   pl2                 the single Zylon photon torpedo, or a meteor (PLAYER2)
 *   photons[0], [1]     our left and right barrel's photon torpedoes (PLAYER3..4)
 *
 * The ROM stores a coordinate as a sign bit plus 16 bits; the high byte of that 16-bit value is
 * what most rules compare, so `hiByte()` reproduces it (−1 KM has high byte $FF).
 */
import { levelIndex, ZYLON_TORPEDO_HOMING, zylonsFireFromBehind, type MissionLevel } from '../rules/levels';
import { rollDamage, type DamageResult, type DamageStatus, type SubsystemStatus } from '../rules/damage';
import { placeSprite, SHAPE, spritesOverlap, viewDistanceHi, type ShapeType, type SpritePlacement } from '../render/sprites';
import type { SpaceView } from '../render/projection';
import { rotatePitch, rotateYaw, type Stick } from './motion';

// ---------------------------------------------------------------------------------------------
// ROM tables and constants
// ---------------------------------------------------------------------------------------------

/** §17.8: at most two Zylon ships at a time (PLAYER0..1). */
export const MAX_ZYLON_SHIPS = 2;

export type ZylonType = 'fighter' | 'cruiser' | 'basestar';

/** R: ZYLONSHAPTAB, picked with RANDOM & 7: fighter 4/8, cruiser 3/8, basestar 1/8 (§17.8). */
export const ZYLON_SHAPE_TABLE: readonly ZylonType[] = [
  'basestar',
  'fighter',
  'fighter',
  'fighter',
  'cruiser',
  'cruiser',
  'cruiser',
  'fighter',
];

/** R: ZYLONFLPATTAB, same index as the shape: the starting flight pattern (0 at NOVICE). */
export const ZYLON_FLIGHT_PATTERN_TABLE: readonly number[] = [4, 4, 0, 0, 0, 1, 0, 0];

/** R: ZYLONVELTAB — velocity (KM/loop) per Zylon velocity index 0..15. */
export const ZYLON_VELOCITY_TABLE: readonly number[] = [62, 30, 16, 8, 4, 2, 1, 0, 0, -1, -2, -4, -8, -16, -30, -62];

export const ZYLON_SHAPE: Readonly<Record<ZylonType, ShapeType>> = {
  fighter: SHAPE.FIGHTER,
  cruiser: SHAPE.CRUISER,
  basestar: SHAPE.BASESTAR,
};

/** Spawn: z high byte ORed with $71, i.e. at least 28928 KM ahead; x = y + 19 high bytes. */
export const ZYLON_SPAWN_Z_HI = 0x71;
export const ZYLON_SPAWN_X_HI = 19;
/** Within 8192 KM ($20**) a visible Zylon switches to the attack flight pattern, and may fire. */
export const ZYLON_ATTACK_HI = 0x20;
/** Attack from the front: dive in to 2560 KM ($0A**), then pull out. */
export const ZYLON_DIVE_HI = 0x0a;
/** Attack from behind: turn at −2816 KM ($F5**). */
export const ZYLON_BACK_DIVE_HI = 0xf5;
/** Milestone timer: new milestone velocities every 120 controls (each ship is controlled every 8 loops). */
export const MILESTONE_CONTROLS = 120;
/** §17.8: WARRIOR and COMMANDER: 48/256 (19%) chance of a back attack per milestone. */
export const BACK_ATTACK_CHANCE_256 = 48;

/** §17.7 Zylon torpedo: life 62 loops, speed 80 KM/loop. */
export const ZYLON_TORPEDO_LIFE = 62;
export const ZYLON_TORPEDO_SPEED = 80;
/** Loops before the next Zylon torpedo after one hit us (R: TORPEDODELAY := 2). */
export const ZYLON_TORPEDO_DELAY_AFTER_HIT = 2;

/** §17.7 our photons: life 255 loops, 102 KM/loop, launched ±256 KM sideways and 256 KM below. */
export const PHOTON_LIFE = 255;
export const PHOTON_SPEED = 102;
export const PHOTON_BARREL_X = 256;
export const PHOTON_BARREL_Y = -256;
/** R: TRIGGER refuses a launch while the barrel's last torpedo has ≥ 232 loops left: 23 loops. */
export const PHOTON_REFIRE_LIFE = 232;
export const PHOTON_REFIRE_LOOPS = PHOTON_LIFE - PHOTON_REFIRE_LIFE;
/** §17.7: only a photon younger than 15 loops destroys a basestar. */
export const BASESTAR_MAX_TORPEDO_AGE = 15;

/** R: HITMINZTAB / HITMAXZTAB — the torpedo's |z| high byte must be in [min, max) for the target's range index / 2. */
export const HIT_MIN_Z_HI: readonly number[] = [0x00, 0x00, 0x00, 0x02, 0x04, 0x06, 0x08, 0x0c];
export const HIT_MAX_Z_HI: readonly number[] = [0x0c, 0x0c, 0x0c, 0x0c, 0x0e, 0x0e, 0x0e, 0x20];

/** §17.7 meteors: 4/256 on 3 of 4 loops, life 60, flying at −8 KM/loop. */
export const METEOR_CHANCE_256 = 4;
export const METEOR_LIFE = 60;
export const METEOR_SPEED = 8;

/** §17.7: an explosion is 32 fragments with velocities −7..+7 KM/loop for 128 loops. */
export const EXPLOSION_FRAGMENTS = 32;
export const EXPLOSION_LIFE = 128;

/** R step 26: we are hit when the torpedo or meteor is within −256..+255 KM on every axis. */
export const SHIP_HIT_KM = 256;

/** R: VICINITYMASKTAB, indexed by bits 3..1 of the hyperwarp arrival marker's PM row. */
export const VICINITY_MASK_TABLE: readonly number[] = [0xff, 0xff, 0x3f, 0x0f, 0x3f, 0x7f, 0xff, 0xff];

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** The view the ROM's SHIPVIEW holds; projection and collisions only exist in FRONT and AFT. */
export type SimView = 'FRONT' | 'AFT' | 'CHART' | 'LRS';

export interface ZylonShip extends Vec3Like {
  alive: boolean;
  type: ZylonType;
  /** Placed by the debug hook: not part of the sector's count. */
  debug: boolean;
  vel: Vec3Like;
  /** Zylon velocity indices 0..15 into ZYLON_VELOCITY_TABLE (kept by the slot, as in the ROM). */
  velIndex: Vec3Like;
  /** Milestone velocity indices the velocity indices step toward. */
  milestone: Vec3Like;
  milestoneTimer: number;
  /** 0 = attack, 1 = ±30 KM/loop, 4 = ±4 KM/loop. */
  flightPattern: number;
  backAttack: boolean;
  /** R: ZYLONTIMX0/ZYLONTIMY0 — loops until the velocity index follows the stick again. */
  followTimer: { x: number; y: number };
}

export interface Player2 extends Vec3Like {
  /** What PLAYER2 is: the Zylon torpedo, a meteor, or nothing yet. */
  kind: 'torpedo' | 'meteor' | null;
  life: number;
  vel: Vec3Like;
}

export interface Photon extends Vec3Like {
  life: number;
  vel: Vec3Like;
}

export interface Fragment extends Vec3Like {
  vel: Vec3Like;
}

export interface Explosion {
  life: number;
  fragments: Fragment[];
}

export interface ZylonLoopInput {
  /** Stick as the ship turns this loop (centred in the chart, hyperwarp or docking). */
  turn: Stick;
  /** Our velocity in KM per loop. */
  velocity: number;
  view: SimView;
  level: MissionLevel;
  /** Zylon ships the galaxy map holds for this sector (live ones included). */
  sectorZylons: number;
  starbaseSector: boolean;
  hyperwarp: boolean;
  /** R: COUNT256, the loop counter (meteors are tried when bits 1..0 are not 0). */
  count256: number;
  /** Attack computer on and not destroyed (the tracked target follows the attacker only then). */
  computer: boolean;
}

export type ZylonEvent =
  | { type: 'zylonDestroyed'; slot: number; zylon: ZylonType; debug: boolean; torpedoAge: number }
  | { type: 'basestarHit'; slot: number; torpedoAge: number }
  | { type: 'shotDown'; kind: 'torpedo' | 'meteor' }
  | { type: 'zylonSpawned'; slot: number; zylon: ZylonType }
  | { type: 'zylonFired'; slot: number }
  | { type: 'meteorSpawned' }
  | { type: 'shipHit'; by: 'torpedo' | 'meteor'; torpedoLife: number };

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** High byte of a ROM coordinate (sign + 16 bits): −1 → $FF, −65536 → $00. */
export function hiByte(km: number): number {
  return Math.floor(km / 256) & 0xff;
}

/** R step 11: a PLAYER coordinate beyond ±65535 KM is pinned near the edge (low byte kept). */
export function correctOverflow(km: number): number {
  if (km > 0xffff) return 0xff00 + (Math.floor(km) & 0xff);
  if (km < -0x10000) return -0x10000 + (Math.floor(km) & 0xff);
  return km;
}

const clampIndex = (i: number) => Math.max(0, Math.min(15, i));

function newShip(): ZylonShip {
  return {
    alive: false,
    type: 'fighter',
    debug: false,
    x: 0,
    y: 0,
    z: 0,
    vel: { x: 0, y: 0, z: 0 },
    velIndex: { x: 0, y: 0, z: 0 },
    milestone: { x: 0, y: 0, z: 0 },
    milestoneTimer: 0,
    flightPattern: 0,
    backAttack: false,
    followTimer: { x: 0, y: 0 },
  };
}

function newPhoton(): Photon {
  return { life: 0, x: 0, y: 0, z: 0, vel: { x: 0, y: 0, z: 0 } };
}

/** The sprite type of PLAYER2 (the Zylon torpedo is drawn as a photon torpedo, shape 0). */
function pl2Shape(p: Player2): ShapeType {
  return p.kind === 'meteor' ? SHAPE.METEOR : SHAPE.PHOTON;
}

export interface ShipHitInput {
  /** SHIELDSCOLOR is not black (shields on and, if damaged, flickered on). */
  shieldsUp: boolean;
  level: MissionLevel;
  damage: DamageStatus;
  by: 'torpedo' | 'meteor';
  /** The Zylon torpedo's life left when it hit (meteors always destroy: 255). */
  torpedoLife: number;
  randomByte: () => number;
}

export interface ShipHitResult {
  /** Shields down: SHIP DESTROYED BY ZYLON FIRE, mission over. */
  destroyed: boolean;
  /** Energy taken (§17.1: 100 per hit). */
  energy: number;
  /** The subsystem harmed, if any (§17.3). */
  damage: DamageResult | null;
}

/**
 * GAMELOOP steps 26–27: our starship was hit by the Zylon torpedo or a meteor (§5.9, §16, §17.7).
 * Every hit rolls DAMAGE and costs 100 energy; with the shields down the ship is destroyed.
 */
export function resolveShipHit(h: ShipHitInput): ShipHitResult {
  const life = h.by === 'meteor' ? 255 : h.torpedoLife;
  const damage = rollDamage(h.level, h.damage, life, h.randomByte);
  return { destroyed: !h.shieldsUp, energy: 100, damage };
}

// ---------------------------------------------------------------------------------------------
// The simulation
// ---------------------------------------------------------------------------------------------

export class ZylonSim {
  public readonly ships: ZylonShip[] = [newShip(), newShip()];
  public readonly pl2: Player2 = { kind: null, life: 0, x: 0, y: 0, z: 0, vel: { x: 0, y: 0, z: 0 } };
  public readonly photons: Photon[] = [newPhoton(), newPhoton()];
  public explosion: Explosion | null = null;
  /** R: BARRELNR — barrel of the next launch: 0 left, 1 right. */
  public barrel = 0;
  /** R: TORPEDODELAY. */
  public torpedoDelay = 0;
  /** R: CTRLDZYLON — the ship the game steers this time (alternates every 4 loops). */
  public controlled = 0;
  /** R: TRACKDIGIT — the Zylon the panel's θ Φ R follow (T:0 or T:1). */
  public trackDigit = 0;
  /** R: ZYLONATTACKER — the ship that fired the current torpedo, until the computer picks it up. */
  private attacker: number | null = null;
  /** R: VICINITYMASK — confines a new Zylon's y coordinate. */
  public vicinityMask = 0;

  /** Sprites drawn this loop (R step 15), for the hit tests and the attack-pattern switch. */
  private shown: {
    ships: (SpritePlacement | null)[];
    pl2: SpritePlacement | null;
  } = { ships: [null, null], pl2: null };

  private readonly randomByte: () => number;

  /** `random` returns [0, 1) like core/rng's random(). */
  constructor(random: () => number) {
    this.randomByte = () => Math.floor(random() * 256) & 0xff;
  }

  // ----- queries -----

  public get liveShips(): number {
    return this.ships.filter((s) => s.alive).length;
  }

  /** The Zylon torpedo is flying (for the panel's "under attack" state). */
  public get torpedoFlying(): boolean {
    return this.pl2.kind === 'torpedo' && this.pl2.life > 0;
  }

  /** The tracked Zylon ship (θ Φ R), or null. */
  public trackedShip(): ZylonShip | null {
    const s = this.ships[this.trackDigit];
    return s.alive ? s : null;
  }

  /** Sprite placement of an object in a view (R step 15), or null when it is not drawn. */
  public static place(type: ShapeType, p: Vec3Like, view: SimView): SpritePlacement | null {
    if (view !== 'FRONT' && view !== 'AFT') return null;
    return placeSprite(type, p.x, p.y, p.z, view as SpaceView);
  }

  // ----- commands -----

  /** Empty the sector (hyperwarp, teleport). */
  public clear(): void {
    for (const s of this.ships) s.alive = false;
    this.pl2.life = 0;
    this.pl2.kind = null;
    for (const p of this.photons) p.life = 0;
    this.explosion = null;
    this.attacker = null;
    this.shown = { ships: [null, null], pl2: null };
  }

  /** M: toggle the tracked Zylon between T:0 and T:1 (R: KEYBOARD 'M'). */
  public toggleTarget(): void {
    this.trackDigit ^= 1;
  }

  /** Put a ship in play (debug hook): the first free slot, else slot 0. */
  public spawn(type: ZylonType, pos: Vec3Like, debug = true): number {
    let slot = this.ships.findIndex((s) => !s.alive);
    if (slot < 0) slot = 0;
    const s = this.ships[slot];
    Object.assign(s, { alive: true, type, debug, x: pos.x, y: pos.y, z: pos.z });
    s.vel = { x: 0, y: 0, z: 0 };
    s.milestoneTimer = 1;
    s.flightPattern = 0;
    return slot;
  }

  /** Remove a live ship without a torpedo (debug: destroy the sector). Returns its explosion. */
  public destroyShip(slot: number): void {
    const s = this.ships[slot];
    if (!s.alive) return;
    s.alive = false;
    this.initExplosion(s);
  }

  /**
   * TRIGGER: launch one photon torpedo (§17.7). Returns true when a torpedo left the barrel
   * (the caller charges 10 energy and plays the launch sound).
   *  - The barrel about to fire must have its last torpedo at least 23 loops old.
   *  - Photons destroyed: no launch. Damaged: always the same barrel. OK: barrels alternate.
   */
  public fire(view: SimView, photons: SubsystemStatus, hyperwarp: boolean): boolean {
    if (hyperwarp) return false;
    const b = this.barrel;
    if (this.photons[b].life >= PHOTON_REFIRE_LIFE) return false;
    if (photons === 'destroyed') return false;
    if (photons === 'ok') this.barrel = b ^ 1;
    const p = this.photons[b];
    p.life = PHOTON_LIFE;
    p.x = b === 1 ? PHOTON_BARREL_X : -PHOTON_BARREL_X;
    p.y = PHOTON_BARREL_Y;
    p.z = 1;
    p.vel = { x: 0, y: 0, z: view === 'AFT' ? -PHOTON_SPEED : PHOTON_SPEED };
    return true;
  }

  // ----- the game loop -----

  /** One game loop of every PLAYER object and the explosion. Returns what happened. */
  public loop(inp: ZylonLoopInput): ZylonEvent[] {
    const events: ZylonEvent[] = [];
    this.move(inp);
    this.updateShown(inp.view);
    this.collision(inp.view, events);
    this.trackTarget(inp.computer);
    if (!inp.starbaseSector && !inp.hyperwarp) this.maneuver(inp, events);
    if (!inp.starbaseSector) this.shipHitCheck(events);
    this.flush();
    return events;
  }

  /** Steps 8–11: rotate with the stick, fly toward −z, add each object's own velocity. */
  private move(inp: ZylonLoopInput): void {
    const step = (p: Vec3Like, vel: Vec3Like, flies: boolean, player: boolean) => {
      rotateYaw(p, inp.turn.x);
      rotatePitch(p, inp.turn.y);
      if (flies) p.z -= inp.velocity;
      p.x += vel.x;
      p.y += vel.y;
      p.z += vel.z;
      if (player) {
        p.x = correctOverflow(p.x);
        p.y = correctOverflow(p.y);
        p.z = correctOverflow(p.z);
      }
    };
    for (const s of this.ships) if (s.alive) step(s, s.vel, true, true);
    // Photon torpedoes (ours and the Zylons') are not carried along by our velocity (R step 9).
    if (this.pl2.life > 0) step(this.pl2, this.pl2.vel, this.pl2.kind === 'meteor', true);
    for (const p of this.photons) if (p.life > 0) step(p, p.vel, false, true);
    if (this.explosion) for (const f of this.explosion.fragments) step(f, f.vel, true, false);
  }

  private updateShown(view: SimView): void {
    this.shown.ships = this.ships.map((s) => (s.alive ? ZylonSim.place(ZYLON_SHAPE[s.type], s, view) : null));
    this.shown.pl2 = this.pl2.life > 0 ? ZylonSim.place(pl2Shape(this.pl2), this.pl2, view) : null;
  }

  /** COLLISION: our photons against the Zylon ships, the Zylon torpedo and the meteor. */
  private collision(view: SimView, events: ZylonEvent[]): void {
    if (view !== 'FRONT' && view !== 'AFT') return;
    for (let i = 1; i >= 0; i--) {
      const p = this.photons[i];
      if (p.life <= 0) continue;
      const ps = ZylonSim.place(SHAPE.PHOTON, p, view);
      if (!ps) continue;
      // The collision register's priority: ship 1, then the torpedo/meteor, then ship 0.
      const hit0 = !!this.shown.ships[0] && spritesOverlap(ps, this.shown.ships[0]!);
      const hit1 = !!this.shown.ships[1] && spritesOverlap(ps, this.shown.ships[1]!);
      const hit2 = !!this.shown.pl2 && spritesOverlap(ps, this.shown.pl2!);
      const target = hit1 ? 1 : hit2 ? 2 : hit0 ? 0 : -1;
      if (target < 0) continue;
      const obj: Vec3Like = target === 2 ? this.pl2 : this.ships[target];
      if (target === 2 ? this.pl2.life <= 0 : !this.ships[target].alive) continue;

      // Depth window: the torpedo's |z| must suit the target's range (HITMINZTAB/HITMAXZTAB).
      const idx = Math.min(15, viewDistanceHi(obj.z, view)) >> 1;
      const tz = viewDistanceHi(p.z, view);
      if (tz >= HIT_MAX_Z_HI[idx] || tz < HIT_MIN_Z_HI[idx]) continue;

      const age = PHOTON_LIFE - p.life;
      p.life = 0;
      if (target === 2) {
        const kind = this.pl2.kind === 'meteor' ? 'meteor' : 'torpedo';
        this.pl2.life = 0;
        events.push({ type: 'shotDown', kind });
      } else {
        const ship = this.ships[target];
        if (ship.type === 'basestar' && age >= BASESTAR_MAX_TORPEDO_AGE) {
          // Too far: the torpedo bursts on the basestar but it survives (R: SKIP142 carry set).
          events.push({ type: 'basestarHit', slot: target, torpedoAge: age });
        } else {
          ship.alive = false;
          events.push({ type: 'zylonDestroyed', slot: target, zylon: ship.type, debug: ship.debug, torpedoAge: age });
        }
      }
      this.initExplosion(obj);
    }
  }

  /** GAMELOOP step 23: the tracked Zylon follows the attacker, or the other ship when it dies. */
  private trackTarget(computer: boolean): void {
    if (!computer) return;
    let x = this.trackDigit;
    if (this.attacker !== null) {
      x = this.attacker;
      this.attacker = null;
    }
    if (!this.ships[x].alive && this.ships[x ^ 1].alive) x ^= 1;
    else if (!this.ships[x].alive) x = this.trackDigit;
    this.trackDigit = x;
  }

  /** MANEUVER (R L5524). */
  private maneuver(inp: ZylonLoopInput, events: ZylonEvent[]): void {
    // (2) Zylons swing with our turns: each x/y velocity index follows the stick when its timer
    // runs out (reversed outside the Front view), then the timer restarts from the new index.
    const inv = inp.view === 'FRONT' ? 1 : -1;
    for (const s of this.ships) {
      for (const axis of ['x', 'y'] as const) {
        s.followTimer[axis]--;
        if (s.followTimer[axis] >= 0) continue;
        const idx = clampIndex(s.velIndex[axis] + inv * inp.turn[axis]);
        s.velIndex[axis] = idx;
        s.followTimer[axis] = (idx < 8 ? idx : idx ^ 0x0f) * 2;
      }
    }

    // (3) The Zylon torpedo homes toward our axis at the level's rate (§17.7).
    if (this.pl2.kind === 'torpedo') {
      const h = ZYLON_TORPEDO_HOMING[inp.level];
      this.pl2.vel.y = this.pl2.y >= 0 ? -h : h;
      this.pl2.vel.x = this.pl2.x >= 0 ? -h : h;
    }

    // (4) Three loops of four: try for a meteor. The fourth: steer a Zylon ship.
    if ((inp.count256 & 3) !== 0) {
      this.tryMeteor(inp.view, events);
      return;
    }

    // (5) Alternate the ship the game steers.
    this.controlled ^= 1;
    const slot = this.controlled;
    const s = this.ships[slot];

    // (6) A new ship replaces a dead one while the sector's count allows it.
    if (!s.alive) {
      if (this.liveShips >= inp.sectorZylons) {
        this.tryMeteor(inp.view, events);
        return;
      }
      this.createShip(slot, inp.level);
      events.push({ type: 'zylonSpawned', slot, zylon: s.type });
    }

    // (7) Close (z < 8192 KM) and visible, or far behind: switch to the attack pattern.
    if (hiByte(s.z) < ZYLON_ATTACK_HI && (s.z < 0 || this.shown.ships[slot] !== null)) s.flightPattern = 0;

    // (8) Every 120 controls: re-roll the back attack and pick new milestone velocities.
    s.milestoneTimer--;
    if (s.milestoneTimer < 0) {
      s.milestoneTimer = MILESTONE_CONTROLS;
      const level = levelIndex(inp.level);
      s.backAttack = ((this.randomByte() < BACK_ATTACK_CHANCE_256 ? level >> 1 : level >> 2) & 1) === 1;
      let a = s.flightPattern;
      for (const axis of ['z', 'x', 'y'] as const) {
        if (this.randomByte() & 0x80) a ^= 0x0f;
        s.milestone[axis] = a;
      }
    }

    // (9) Attack pattern: weave around our cross hairs and dive in and out.
    if (s.flightPattern === 0) {
      const zh = hiByte(s.z);
      if (s.backAttack) s.milestone.z = zh >= ZYLON_BACK_DIVE_HI ? 15 : 0;
      else s.milestone.z = zh < ZYLON_DIVE_HI ? 0 : 15;
      s.milestone.x = s.x >= 0 ? 15 : 0;
      s.milestone.y = s.y >= 0 ? 15 : 0;
    }

    // (10) Velocity indices step one toward the milestones; the velocity is taken from the
    // index before the step (R: the table is read with the index loaded before INC/DEC).
    for (const axis of ['z', 'x', 'y'] as const) {
      const before = s.velIndex[axis];
      if (before < s.milestone[axis]) s.velIndex[axis] = before + 1;
      else if (before > s.milestone[axis]) s.velIndex[axis] = before - 1;
      s.vel[axis] = ZYLON_VELOCITY_TABLE[before];
    }

    // (11) Launch the Zylon torpedo?
    this.tryLaunch(slot, inp.level, events);
  }

  /** (6) Create a Zylon ship: type 4/8 fighter, 3/8 cruiser, 1/8 basestar, ≥ 28928 KM ahead. */
  private createShip(slot: number, level: MissionLevel): void {
    const s = this.ships[slot];
    const i = this.randomByte() & 7;
    s.alive = true;
    s.debug = false;
    s.type = ZYLON_SHAPE_TABLE[i];
    s.flightPattern = level === 'NOVICE' ? 0 : ZYLON_FLIGHT_PATTERN_TABLE[i];
    s.milestoneTimer = 1;
    const yHi = this.randomByte() & this.vicinityMask;
    const xHi = (yHi + ZYLON_SPAWN_X_HI) & 0xff;
    s.y = yHi * 256;
    s.x = xHi * 256;
    s.z = (xHi | ZYLON_SPAWN_Z_HI) * 256;
    this.randomInvertXY(s);
  }

  /** (11) Fire when PLAYER2 is free, the ship is near our horizontal plane and within 8192 KM. */
  private tryLaunch(slot: number, level: MissionLevel, events: ZylonEvent[]): void {
    const s = this.ships[slot];
    const p = this.pl2;
    if (p.kind === 'torpedo' || p.kind === null) {
      if (p.life > 0) return;
      if (this.torpedoDelay > 0) {
        this.torpedoDelay--;
        return;
      }
    }
    // y high byte in $FE..$02 (R: ADC #2, CMP #5).
    if (((hiByte(s.y) + 2) & 0xff) >= 5) return;
    let zh = hiByte(s.z);
    let vz = -ZYLON_TORPEDO_SPEED;
    if (s.z < 0) {
      zh ^= 0xff;
      if (!zylonsFireFromBehind(level)) return; // never shot in the back at NOVICE
      vz = ZYLON_TORPEDO_SPEED;
    }
    if (zh >= ZYLON_ATTACK_HI) return;
    p.kind = 'torpedo';
    p.life = ZYLON_TORPEDO_LIFE;
    p.x = s.x;
    p.y = s.y;
    p.z = s.z;
    p.vel = { x: 0, y: 0, z: vz };
    this.attacker = slot;
    events.push({ type: 'zylonFired', slot });
  }

  /** (4) A meteor in 4 of 256 tries, when PLAYER2 is dead or not on screen. */
  private tryMeteor(view: SimView, events: ZylonEvent[]): void {
    const p = this.pl2;
    if (p.life > 0 && this.shown.pl2 !== null) return;
    if (this.randomByte() >= METEOR_CHANCE_256) return;
    p.kind = 'meteor';
    this.initPosVec(p, view);
    p.life = METEOR_LIFE;
    p.vel = { x: 0, y: 0, z: -METEOR_SPEED };
    events.push({ type: 'meteorSpawned' });
  }

  /** INITPOSVEC: a random position at the far end of the view (R L9595). */
  private initPosVec(p: Vec3Like, view: SimView): void {
    const rndY = this.randomByte() & 0x0f;
    const rndX = this.randomByte() & 0x0f;
    p.y = rndY * 256;
    p.x = rndX * 256;
    p.z = 0x0f00;
    if (view === 'AFT') {
      // z high byte := −MAX(RNDY, RNDX), low byte $80, sign negative.
      const hi = (0 - Math.max(rndX, rndY)) & 0xff;
      p.z = hi * 256 + 0x80 - 0x10000;
    }
    if (view === 'LRS') {
      p.x = this.randomByte() * 256;
      const zHi = this.randomByte();
      p.z = zHi & 1 ? zHi * 256 : zHi * 256 - 0x10000;
    }
    this.randomInvertXY(p);
  }

  /** RNDINVXY: random signs for y and x. */
  private randomInvertXY(p: Vec3Like): void {
    if (!(this.randomByte() & 1)) p.y = -p.y;
    if (!(this.randomByte() & 1)) p.x = -p.x;
  }

  /** Steps 26–27: the Zylon torpedo or a meteor reached us. */
  private shipHitCheck(events: ZylonEvent[]): void {
    const p = this.pl2;
    if (p.life <= 0) return;
    const near = (v: number) => v >= -SHIP_HIT_KM && v < SHIP_HIT_KM;
    if (!near(p.x) || !near(p.y) || !near(p.z)) return;
    events.push({ type: 'shipHit', by: p.kind === 'meteor' ? 'meteor' : 'torpedo', torpedoLife: p.life });
    this.initExplosion(p);
    p.life = 0;
    this.torpedoDelay = ZYLON_TORPEDO_DELAY_AFTER_HIT;
  }

  /** INITEXPL: 32 fragments from the object's position, random velocities −7..+7 (R L5909). */
  private initExplosion(at: Vec3Like): void {
    const v = () => {
      const r = this.randomByte() & 0x87; // NEG!7: sign bit and 0..7
      return r & 0x80 ? -(r & 7) : r & 7;
    };
    const fragments: Fragment[] = [];
    for (let i = 0; i < EXPLOSION_FRAGMENTS; i++) {
      fragments.push({ x: at.x, y: at.y, z: at.z, vel: { z: v(), x: v(), y: v() } });
    }
    this.explosion = { life: EXPLOSION_LIFE, fragments };
  }

  /** FLUSHGAMELOOP: torpedo lifetimes and the explosion count down every loop. */
  private flush(): void {
    for (const p of this.photons) if (p.life > 0) p.life--;
    if (this.pl2.kind === 'torpedo' && this.pl2.life > 0) this.pl2.life--;
    if (this.explosion && --this.explosion.life <= 0) this.explosion = null;
  }
}
