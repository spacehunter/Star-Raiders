/**
 * Turning and flying in the ship frame (MANUAL_SPEC §4, §17.13; R: GAMELOOP steps 8–9, ROTATE).
 *
 * Our starship never moves. Each game loop the stick rotates every space object around it by
 * a fixed 0.89° (sin = 1/64), using the ROM's Minsky rotation: the first coordinate is
 * overwritten and the new value is used for the second, which keeps the rotation stable.
 *
 *   stick right (+1):  x := x − z/64,  z := z + x/64      (objects ahead swing left)
 *   stick left  (−1):  x := x + z/64,  z := z − x/64
 *   stick back  (+1):  y := y − z/64,  z := z + y/64      (climb: objects ahead sink)
 *   stick fwd   (−1):  y := y + z/64,  z := z − y/64      (dive: objects ahead rise)
 *
 * The rotation is the same in every view. The Aft view projects the objects behind the ship
 * without mirroring, so on screen the stick acts reversed there, exactly as M §II says:
 * aft, stick left turns the view as stick right does in front, and forward climbs.
 */

/**
 * The ROM measures space in KM; the remake's ships still fly in older "units" until Phase 5
 * rebuilds them. One unit is 6.4 KM, which keeps speed key 6 (32 KM per loop) at the old
 * 300 units per second.
 */
export const KM_PER_UNIT = 6.4;

/** sin of the per-loop turn angle: arcsin(1/64) = 0.895°. */
export const ROTATION_STEP = 1 / 64;
/** The per-loop turn angle in degrees. */
export const ROTATION_DEGREES = (Math.asin(ROTATION_STEP) * 180) / Math.PI;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Stick directions as the ROM reads them (R: STICKINCTAB): x −1 left / +1 right, y −1 forward / +1 back. */
export interface Stick {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

export const STICK_CENTERED: Stick = { x: 0, y: 0 };

/** One loop of horizontal rotation (around the y axis). */
export function rotateYaw(p: Point3, stickX: number): void {
  if (!stickX) return;
  p.x -= stickX * p.z * ROTATION_STEP;
  p.z += stickX * p.x * ROTATION_STEP;
}

/** One loop of vertical rotation (around the x axis). */
export function rotatePitch(p: Point3, stickY: number): void {
  if (!stickY) return;
  p.y -= stickY * p.z * ROTATION_STEP;
  p.z += stickY * p.y * ROTATION_STEP;
}

/** Steps 8 and 9 of the game loop for one object: rotate by the stick, then fly forward by `dz`. */
export function moveInShipFrame(p: Point3, stick: Stick, dz: number): void {
  rotateYaw(p, stick.x);
  rotatePitch(p, stick.y);
  p.z -= dz;
}

/**
 * R: UPDPANEL — the ship's velocity steps by 1 per loop toward the velocity of the chosen speed
 * key (both in KM per loop, §17.1 VELOCITYTAB).
 */
export function approachVelocity(current: number, target: number): number {
  if (current < target) return current + 1;
  if (current > target) return current - 1;
  return current;
}
