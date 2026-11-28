import { describe, expect, it } from 'vitest';
import {
  buildScan,
  scanHi,
  scanOffset,
  scanPixel,
  SCAN_BLIP_CELL,
  SCAN_HEADER,
  SCAN_X_LIMIT_KM,
  SCAN_Z_LIMIT_KM,
  SHIP_ICON_PIXELS,
  type ScanInput,
  type ScanObject,
} from './scan';
import { Starfield } from './starfield';
import { SHAPE, shapeRows } from './sprites';
import { scanState, scanZ } from '../sim/damage';
import { moveInShipFrame } from '../sim/motion';
import { createRng } from '../core/rng';

const OK = scanState('ok', 'ok');
const input = (objects: ScanObject[], scan = OK, extra: Partial<ScanInput> = {}): ScanInput => ({
  scan,
  stars: [],
  fragments: [],
  objects,
  count8: 0,
  ...extra,
});
const zero = () => 0;

describe('scan projection and scale (§10; R: GAMELOOP step 14, SCREENROW/SCREENCOLUMN)', () => {
  it('uses MAPTO80 of the coordinate high byte, negative values inverted like the ROM', () => {
    expect(scanHi(255)).toBe(0);
    expect(scanHi(256)).toBe(1);
    expect(scanHi(-256)).toBe(0); // two's complement $FF00 → EOR $FF → 0
    expect(scanHi(-257)).toBe(1);
    expect(scanHi(1e6)).toBe(255);
    expect(scanOffset(10000)).toBe(Math.floor((81 * 39) / 256)); // hi 39 → 12
  });

  it('puts our position in the centre, ahead up and right to the right', () => {
    expect(scanPixel(0, 0)).toEqual({ col: 80, row: 49 });
    const ahead = scanPixel(0, 20000)!;
    const behind = scanPixel(0, -20000)!;
    const right = scanPixel(20000, 0)!;
    const left = scanPixel(-20000, 0)!;
    expect(ahead.row).toBeLessThan(49);
    expect(behind.row).toBeGreaterThan(49);
    expect(right.col).toBeGreaterThan(80);
    expect(left.col).toBeLessThan(80);
    // Symmetric about the centre, like the ROM's SCREENROW (50 − (off + 1) / 50 + off).
    expect(ahead.row + behind.row).toBe(99);
    expect(right.col + left.col).toBe(159);
  });

  it('spans about ±40,000 KM ahead and behind (the manual\'s top view) and ±65,000 KM across', () => {
    expect(SCAN_Z_LIMIT_KM).toBe(40704);
    expect(scanPixel(0, 40000)).toEqual({ col: 80, row: 0 }); // top row
    expect(scanPixel(0, -40000)).toEqual({ col: 80, row: 99 }); // bottom row
    expect(scanPixel(0, SCAN_Z_LIMIT_KM)).toBeNull();
    expect(scanPixel(0, -SCAN_Z_LIMIT_KM - 1)).toBeNull();
    expect(SCAN_X_LIMIT_KM).toBe(64768);
    expect(scanPixel(64000, 0)!.col).toBe(159);
    expect(scanPixel(-64600, 0)!.col).toBe(0);
    expect(scanPixel(SCAN_X_LIMIT_KM, 0)).toBeNull();
  });

  it('is linear: one pixel per ≈ 800 KM', () => {
    expect(scanPixel(0, 8000)!.row).toBe(40); // hi 31 → MAPTO80 9 → row 50 − (9 + 1)
    expect(49 - scanPixel(0, 32000)!.row).toBe(39);
  });
});

describe('the scan picture (§10, §17.13, §18.1)', () => {
  it('draws our ship, five ROM lines in COLOR1 in the centre (R: DRAWLINESTAB lines 17–21)', () => {
    const p = buildScan(input([]), zero, zero);
    expect(p.ship).toBe(true);
    expect(p.pixels.length).toBe(13);
    expect(p.pixels.every(([, , reg]) => reg === 1)).toBe(true);
    const set = new Set(p.pixels.map(([c, r]) => `${c},${r}`));
    for (const [c, r] of SHIP_ICON_PIXELS) expect(set.has(`${c},${r}`)).toBe(true);
    // ..#.. / ..#.. / .###. / ##### / #.#.#
    expect([...set].filter((k) => k.endsWith(',54')).sort()).toEqual(['78,54', '80,54', '82,54']);
    expect(SCAN_HEADER).toBe('  LONG RANGE SCAN');
  });

  it('draws targets and meteors as 2 × 2 squares (shape cell 6, rows doubled) in random colours', () => {
    expect(SCAN_BLIP_CELL).toBe(6);
    expect(shapeRows(SHAPE.FIGHTER, 6)).toEqual([0x18, 0x18]); // ROM: 2 PM pixels × 2 scanlines
    const colors = [0x12, 0x9e, 0x44];
    let i = 0;
    const p = buildScan(
      input([
        { kind: 'fighter', x: -12000, z: 20000 },
        { kind: 'meteor', x: 5000, z: -9000 },
        { kind: 'basestar', x: 30000, z: 1000 },
      ]),
      zero,
      () => colors[i++]
    );
    expect(p.blips.map((b) => b.rows)).toEqual(Array(3).fill([0x18, 0x18, 0x18, 0x18]));
    expect(p.blips.map((b) => b.color)).toEqual(colors);
    const f = scanPixel(-12000, 20000)!;
    expect(p.blips[0].col).toBe(f.col - 3); // 0x18 lights columns 3–4: the projected column
    expect(p.blips[0].line).toBe(2 * (f.row - 1));
  });

  it('draws the starbase as its small cross icon, not a square', () => {
    const p = buildScan(input([{ kind: 'starbase', x: 2000, z: 3000 }]), zero, zero);
    expect(shapeRows(SHAPE.STARBASE_CENTER, 6)).toEqual([0x10, 0x38, 0x10]);
    expect(p.blips[0].rows).toEqual([0x10, 0x10, 0x38, 0x38, 0x10, 0x10]);
  });

  it('flashes: the colours change from loop to loop', () => {
    const rng = createRng(1);
    const byte = () => Math.floor(rng() * 256);
    const o: ScanObject[] = [{ kind: 'cruiser', x: 0, z: 10000 }];
    const seen = new Set<number>();
    for (let k = 0; k < 10; k++) seen.add(buildScan(input(o), zero, byte).blips[0].color);
    expect(seen.size).toBeGreaterThan(5);
  });

  it('leaves out objects beyond the scan', () => {
    const p = buildScan(input([{ kind: 'fighter', x: 0, z: 50000 }]), zero, zero);
    expect(p.blips).toEqual([]);
  });

  it('places the stars of an LRS starfield on the z-x plane, all on screen', () => {
    const sf = new Starfield(createRng(7), 12, 'FRONT');
    sf.resetFor('LRS');
    sf.loop({ x: 0, y: 0 }, 0, 'LRS', 0);
    for (const s of sf.stars) {
      expect(s.pixel).toEqual(scanPixel(s.x, s.z));
      expect(Math.abs(s.z)).toBeLessThan(SCAN_Z_LIMIT_KM + 256);
    }
    const p = buildScan(input([], OK, { stars: sf.stars }), zero, zero);
    expect(p.stars).toBe(sf.stars.filter((s) => s.color).length);
  });
});

describe('the scan rotates as you steer (§10 procedure, §17.13)', () => {
  it('stick left swings a target on the left round to straight ahead (top of the screen)', () => {
    const t = { x: -20000, y: 0, z: 0 };
    const before = scanPixel(t.x, t.z)!;
    expect(before.col).toBeLessThan(80);
    expect(before.row).toBe(49);
    // 0.89° per loop: about 100 loops make a quarter turn.
    let loops = 0;
    while (Math.abs(t.x) > 400 && loops < 200) {
      moveInShipFrame(t, { x: -1, y: 0 }, 0);
      loops++;
    }
    const after = scanPixel(t.x, t.z)!;
    expect(loops).toBeGreaterThan(90);
    expect(loops).toBeLessThan(110);
    expect(Math.abs(after.col - 79.5)).toBeLessThanOrEqual(0.5); // in line with our nose
    expect(after.row).toBeLessThan(30); // ahead, distance kept
    expect(Math.hypot(t.x, t.z)).toBeCloseTo(20000, -3);
  });

  it('stick right turns the other way: the picture rotates around our ship', () => {
    const t = { x: 0, y: 0, z: 20000 };
    for (let i = 0; i < 50; i++) moveInShipFrame(t, { x: 1, y: 0 }, 0);
    const p = scanPixel(t.x, t.z)!;
    expect(p.col).toBeLessThan(80); // ahead swings left
    expect(p.row).toBeLessThan(49);
  });

  it('the stars rotate too', () => {
    const sf = new Starfield(createRng(3), 12, 'LRS');
    sf.loop({ x: 0, y: 0 }, 0, 'LRS', 0);
    const before = sf.stars.map((s) => ({ ...s }));
    sf.loop({ x: -1, y: 0 }, 0, 'LRS', 0);
    const moved = sf.stars.filter((s, i) => s.x !== before[i].x && s.z !== before[i].z);
    expect(moved.length).toBe(12);
  });
});

describe('scan damage (§7, §17.3; R: SCREENROW L9493, GAMELOOP L3569, DRAWLINES)', () => {
  const objects: ScanObject[] = [
    { kind: 'fighter', x: -12000, z: 20000 },
    { kind: 'cruiser', x: 15000, z: -9000 },
  ];

  it('damaged: each object lands at its place or its mirror image through our ship, at random', () => {
    const scan = scanState('damaged', 'ok');
    const rng = createRng(1979);
    const byte = () => Math.floor(rng() * 256);
    const rows = objects.map(() => new Set<number>());
    for (let k = 0; k < 40; k++) {
      const p = buildScan(input(objects, scan), byte, zero);
      expect(p.blips.length).toBe(2);
      p.blips.forEach((b, i) => {
        expect(b.x).toBe(objects[i].x); // columns never mirror
        expect(Math.abs(b.z)).toBe(Math.abs(objects[i].z));
        rows[i].add(b.line);
      });
    }
    for (const [i, o] of objects.entries()) {
      const real = 2 * (scanPixel(o.x, o.z)!.row - 1);
      const mirror = 2 * (scanPixel(o.x, -o.z)!.row - 1);
      expect([...rows[i]].sort()).toEqual([real, mirror].sort());
    }
  });

  it('damaged keeps Phase 7\'s flip: BIT RANDOM bit 6 picks the half', () => {
    const scan = scanState('damaged', 'ok');
    expect(scanZ(scan, -500, () => 0x40)).toBe(500);
    expect(scanZ(scan, 500, () => 0x00)).toBe(-500);
    const up = buildScan(input([{ kind: 'fighter', x: 0, z: -20000 }], scan), () => 0x40, zero);
    expect(up.blips[0].z).toBe(20000);
  });

  it('OK: no mirror and no draws from the mirror stream', () => {
    let calls = 0;
    const p = buildScan(input(objects), () => (calls++, 0x40), zero);
    expect(calls).toBe(0);
    expect(p.blips.map((b) => b.z)).toEqual([20000, -9000]);
  });

  it('destroyed: only our ship, no stars, fragments or blips', () => {
    const sf = new Starfield(createRng(5), 12, 'LRS');
    sf.loop({ x: 0, y: 0 }, 0, 'LRS', 0);
    const p = buildScan(
      input(objects, scanState('destroyed', 'ok'), { stars: sf.stars, fragments: [{ x: 0, z: 9000 }] }),
      zero,
      zero
    );
    expect(p.blips).toEqual([]);
    expect(p.stars).toBe(0);
    expect(p.pixels.length).toBe(SHIP_ICON_PIXELS.length);
  });

  it('computer destroyed: DRAWLINES returns at once, so not even our ship (objects still drawn)', () => {
    const p = buildScan(input(objects, scanState('ok', 'destroyed')), zero, zero);
    expect(p.ship).toBe(false);
    expect(p.pixels).toEqual([]);
    expect(p.blips.length).toBe(2);
  });

  it('scan and computer both destroyed: nothing at all', () => {
    const p = buildScan(input(objects, { objects: false, mirrored: false, ship: false }), zero, zero);
    expect(p.pixels).toEqual([]);
    expect(p.blips).toEqual([]);
  });
});
