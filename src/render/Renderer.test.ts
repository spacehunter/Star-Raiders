import { describe, expect, it } from 'vitest';
import { ROM_RGB } from './palette';
import { backgroundColors, crosshairRects, FRAME_LINES, FRAME_W, frameRect } from './Renderer';

// OVERHAUL_PLAN Phase 3 + Part 4 bend 2: 160 × 100 playfield at a crisp whole-number scale.
describe('frame scaling and letterboxing', () => {
  it('is a 160-wide frame of 120 rows (playfield 100 + panel 20): exactly 4:3', () => {
    expect(FRAME_W).toBe(160);
    expect(FRAME_LINES).toBe(120);
  });

  it('fills a 4:3 screen and pillarboxes 16:9, always a whole-number scale', () => {
    expect(frameRect(1024, 768)).toEqual({ x: 32, y: 24, w: 960, h: 720, k: 6 });
    expect(frameRect(1920, 1080)).toEqual({ x: 240, y: 0, w: 1440, h: 1080, k: 9 });
    expect(frameRect(1280, 720)).toEqual({ x: 160, y: 0, w: 960, h: 720, k: 6 });
    for (const [w, h] of [[1920, 1080], [1024, 768], [2560, 1440], [800, 600], [1366, 768]]) {
      const r = frameRect(w, h);
      expect(Number.isInteger(r.k)).toBe(true);
      expect(r.w / r.h).toBeCloseTo(4 / 3, 6);
      expect(r.w).toBeLessThanOrEqual(w);
      expect(r.h).toBeLessThanOrEqual(h);
    }
  });
});

// MANUAL_SPEC §5.3, §17.6: front = plus with a gap, aft = two horizontal dashes.
describe('cross hairs', () => {
  it('front: col 80 rows 40–46 and 54–60, row 50 cols 62–76 and 84–98', () => {
    expect(crosshairRects('FRONT')).toEqual([
      [62, 50, 15, 1],
      [84, 50, 15, 1],
      [80, 40, 1, 7],
      [80, 54, 1, 7],
    ]);
  });
  it('aft: only the two horizontal bars', () => {
    expect(crosshairRects('AFT')).toEqual([
      [62, 50, 15, 1],
      [84, 50, 15, 1],
    ]);
  });
});

// MANUAL_SPEC §17.13; R: GAMELOOP step 16.
describe('background: shields tint and red-alert flash', () => {
  it('is black, or $A0 with the shields up', () => {
    expect(backgroundColors({ shields: false, redAlertLife: 0 })).toEqual({ bg: ROM_RGB.$00, pf2: ROM_RGB.$AF });
    expect(backgroundColors({ shields: true, redAlertLife: 0 }).bg).toBe(ROM_RGB.$A0);
  });
  it('red alert flashes $42 on bit 5 of the remaining life (every 32 loops)', () => {
    const lit = Array.from({ length: 255 }, (_, i) => backgroundColors({ shields: true, redAlertLife: 255 - i }).bg);
    expect(lit[0]).toBe(ROM_RGB.$42); // 255 has bit 5 set
    expect(lit.filter((c) => c === ROM_RGB.$42)).toHaveLength(128);
    expect(backgroundColors({ shields: false, redAlertLife: 0x40 }).bg).toBe(ROM_RGB.$00);
    expect(backgroundColors({ shields: false, redAlertLife: 0x40 }).pf2).toBe(ROM_RGB.$4F);
    expect(backgroundColors({ shields: false, redAlertLife: 0x20 }).pf2).toBe(ROM_RGB.$60);
  });
});

// MANUAL_SPEC §6, §17.2; R: CHARSET L2683 — the panel is drawn in the ROM's own characters.
describe('panel font', () => {
  it('has every character the panel prints, 8 × 8, byte-exact from the ROM', async () => {
    const { ROM_PANEL_FONT } = await import('./font');
    for (const ch of 'V:0123456789 KET+-θΦR∞C') expect(ROM_PANEL_FONT[ch], ch).toHaveLength(8);
    expect(ROM_PANEL_FONT['0']).toEqual([0x00, 0x7f, 0x47, 0x47, 0x47, 0x47, 0x47, 0x7f]);
    expect(ROM_PANEL_FONT['θ']).toEqual([0x00, 0x1c, 0x3e, 0x63, 0x5d, 0x63, 0x3e, 0x1c]);
  });
});
