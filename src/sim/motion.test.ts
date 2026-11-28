import { describe, expect, it } from 'vitest';
import { projectPoint, type SpaceView } from '../render/projection';
import {
  approachVelocity,
  moveInShipFrame,
  ROTATION_DEGREES,
  ROTATION_STEP,
  rotatePitch,
  rotateYaw,
  type Point3,
  type Stick,
} from './motion';

const e = ROTATION_STEP;

// MANUAL_SPEC §4, §17.13; R: ROTATE (Minsky rotation), GAMELOOP steps 8–9.
describe('star rotation: 0.89° per loop, Minsky style', () => {
  it('turns by arcsin(1/64) = 0.89° per loop', () => {
    expect(ROTATION_STEP).toBe(1 / 64);
    expect(ROTATION_DEGREES).toBeCloseTo(0.895, 3);
  });

  it('overwrites the first coordinate and uses it for the second (R: ROTATE)', () => {
    const p = { x: 300, y: 0, z: 4000 };
    rotateYaw(p, +1); // stick right
    const x1 = 300 - 4000 * e;
    expect(p.x).toBeCloseTo(x1, 10);
    expect(p.z).toBeCloseTo(4000 + x1 * e, 10); // new x, not the old one
    // As a matrix this is [[1, −e], [e, 1 − e²]] with determinant 1: a rotation.
    expect(p.z).toBeCloseTo(300 * e + (1 - e * e) * 4000, 10);
  });

  it('keeps stars on their circle for many turns and comes round after ~402 loops', () => {
    const p = { x: 0, y: 0, z: 4000 };
    for (let i = 0; i < 10_000; i++) rotateYaw(p, -1);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThan(4000 * 0.98);
    expect(Math.hypot(p.x, p.z)).toBeLessThan(4000 * 1.02);

    const q = { x: 0, y: 0, z: 4000 };
    const loopsPerTurn = Math.round((2 * Math.PI) / Math.asin(e)); // 402
    for (let i = 0; i < loopsPerTurn; i++) rotateYaw(q, 1);
    expect(Math.abs(q.x)).toBeLessThan(4000 * 0.02);
    expect(q.z).toBeGreaterThan(0);
  });

  it('follows the stick directions of §4 in the front view', () => {
    const ahead = () => ({ x: 0, y: 0, z: 4000 });
    const right = ahead();
    rotateYaw(right, 1);
    expect(right.x).toBeLessThan(0); // turn to starboard: what is ahead swings left
    const climb = ahead();
    rotatePitch(climb, 1); // stick back
    expect(climb.y).toBeLessThan(0); // climb: what is ahead sinks
    const dive = ahead();
    rotatePitch(dive, -1); // stick forward
    expect(dive.y).toBeGreaterThan(0);
  });

  it('flying moves objects toward −z; velocity steps by 1 per loop', () => {
    const p = { x: 10, y: 20, z: 4000 };
    moveInShipFrame(p, { x: 0, y: 0 }, 32);
    expect(p).toEqual({ x: 10, y: 20, z: 3968 });
    expect(approachVelocity(0, 32)).toBe(1);
    expect(approachVelocity(40, 32)).toBe(39);
    expect(approachVelocity(32, 32)).toBe(32);
  });
});

// MANUAL_SPEC §4 (M §II): in the aft view stick left turns the ship right, right turns it left,
// forward climbs and back dives. On screen this means the aft view responds to each stick
// direction exactly as the front view responds to the opposite one.
describe('aft-view steering inversion (M §II)', () => {
  const screenAfter = (p: Point3, stick: Stick, view: SpaceView, loops = 20) => {
    const q = { ...p };
    for (let i = 0; i < loops; i++) moveInShipFrame(q, stick, 0);
    return projectPoint(q.x, q.y, q.z, view)!;
  };
  const before = (p: Point3, view: SpaceView) => projectPoint(p.x, p.y, p.z, view)!;

  const front = { x: 600, y: -300, z: 3000 };
  const aft = { x: 600, y: -300, z: -3000 }; // the same spot on the aft screen

  it('both points start on the same pixel of their screen', () => {
    expect(before(aft, 'AFT')).toEqual(before(front, 'FRONT'));
  });

  it('left/right: aft stick left moves the picture like front stick right, and vice versa', () => {
    const f0 = before(front, 'FRONT');
    const frontRight = screenAfter(front, { x: 1, y: 0 }, 'FRONT');
    const frontLeft = screenAfter(front, { x: -1, y: 0 }, 'FRONT');
    expect(frontRight.col).toBeLessThan(f0.col); // front: turn right, stars slide left
    expect(frontLeft.col).toBeGreaterThan(f0.col);
    expect(screenAfter(aft, { x: -1, y: 0 }, 'AFT')).toEqual(frontRight);
    expect(screenAfter(aft, { x: 1, y: 0 }, 'AFT')).toEqual(frontLeft);
  });

  it('up/down: aft stick forward climbs (like front back), aft back dives', () => {
    const frontBack = screenAfter(front, { x: 0, y: 1 }, 'FRONT');
    const frontForward = screenAfter(front, { x: 0, y: -1 }, 'FRONT');
    expect(screenAfter(aft, { x: 0, y: -1 }, 'AFT')).toEqual(frontBack);
    expect(screenAfter(aft, { x: 0, y: 1 }, 'AFT')).toEqual(frontForward);
  });

  it('the same stick moves aft stars the opposite way on screen to front stars', () => {
    const f0 = before(front, 'FRONT');
    const a0 = before(aft, 'AFT');
    const f1 = screenAfter(front, { x: 1, y: 1 }, 'FRONT');
    const a1 = screenAfter(aft, { x: 1, y: 1 }, 'AFT');
    expect(Math.sign(f1.col - f0.col)).toBe(-Math.sign(a1.col - a0.col));
    expect(Math.sign(f1.row - f0.row)).toBe(-Math.sign(a1.row - a0.row));
  });
});
