/**
 * The Attack Computer Display, its lock-on markers and the target selection rules
 * (MANUAL_SPEC §5.3, §5.8, §5.10, §11, §17.6).
 *
 * ROM routines (Lorenz Wiest's disassembly, line numbers in StarRaiders.source.asm.txt):
 * UPDATTCOMP (L4428), DRAWLINES (L4208) with DRAWLINESTAB (L10610), BLIPSHAPTAB (L11388),
 * TRIGGER (L6495, the lock-on lifetime) and CLRMEM (L6422, a cleared playfield drops the lock).
 *
 * The display is drawn into the 160 × 100 playfield in the lower right of the Front view:
 *
 *       119                           148
 *   70  ##############################        outer box  cols 119–148, rows 70–86
 *       #             #              #        inner box  cols 126–140, rows 75–81
 *       #AAAA  ###############   AAAA#        A marks    4 × 1 at (120, 76) and (144, 76)
 *       ########             #########        B marks    4 × 1 at (120, 80) and (144, 80)
 *       #BBBB  ###############   BBBB#        C marks    2 × 2 at (128, 84) and (136, 84)
 *       #        CC   #  CC          #
 *   86  ##############################
 *
 * The blip is drawn one row per game loop over five loops, then waits five loops, and on the
 * eleventh ("blip cycle 10") the display is wiped, the blip's new place is worked out from the
 * tracked object's x and y, and the markers are redrawn: one display cycle is 11 game loops.
 */

/** A playfield line: start column and row, direction, length in pixels (R: DRAWLINESTAB). */
export interface DrawLine {
  col: number;
  row: number;
  down: boolean;
  length: number;
}

/** R: DRAWLINESTAB lines 3–14 — the Attack Computer Display frame. */
export const ATTACK_COMPUTER_LINES: readonly DrawLine[] = [
  { col: 119, row: 70, down: false, length: 30 }, // 3 top
  { col: 119, row: 86, down: false, length: 30 }, // 4 bottom
  { col: 119, row: 70, down: true, length: 17 }, // 5 left
  { col: 148, row: 70, down: true, length: 17 }, // 6 right
  { col: 120, row: 78, down: false, length: 6 }, // 7 left tick
  { col: 126, row: 75, down: false, length: 15 }, // 8 inner top
  { col: 126, row: 81, down: false, length: 15 }, // 9 inner bottom
  { col: 141, row: 78, down: false, length: 7 }, // 10 right tick
  { col: 133, row: 71, down: true, length: 4 }, // 11 top tick
  { col: 126, row: 76, down: true, length: 5 }, // 12 inner left
  { col: 140, row: 76, down: true, length: 5 }, // 13 inner right
  { col: 133, row: 82, down: true, length: 4 }, // 14 bottom tick
];

/** The display's outer box, inclusive (MANUAL_SPEC §17.6). */
export const ATTACK_COMPUTER_BOX = { col0: 119, row0: 70, col1: 148, row1: 86 } as const;

/** R: BLIPSHAPTAB — 6 × 5 pixels, bit 7 leftmost. */
export const BLIP_SHAPE: readonly number[] = [0x84, 0xb4, 0xfc, 0xb4, 0x84];

/** The blip's top-left reference position (a target dead ahead) and its reach. */
export const BLIP_REF_COL = 131;
export const BLIP_REF_ROW = 77;

/**
 * R: UPDATTCOMP lock windows on the blip's top-left pixel:
 *  A (x lock)   column 129..132 (−2..+1 of 131, i.e. x within about ±512 KM)
 *  B (y lock)   A and row 75..78 (−2..+1 of 77, y within about ±512 KM)
 *  C (z lock)   A and B and z high byte < $0C (in front, closer than 3072 KM)
 */
export const LOCK_WINDOW = {
  colMin: 129,
  colMax: 132,
  rowMin: 75,
  rowMax: 78,
  /** z must be below $0C00 KM; the ROM compares the z high byte, so z ≥ 0 is required too. */
  zHiMax: 0x0c,
} as const;

/** Lock-on marker rectangles [col, row, w, h] per lock level (A, B, C). */
export const LOCK_MARKS: readonly (readonly [number, number, number, number])[][] = [
  [
    [120, 76, 4, 1],
    [144, 76, 4, 1],
  ],
  [
    [120, 80, 4, 1],
    [144, 80, 4, 1],
  ],
  [
    [128, 84, 2, 2],
    [136, 84, 2, 2],
  ],
];

/** R: one display cycle is 11 game loops (blip cycles 0..10). */
export const BLIP_CYCLE = 10;
/** R: DRAWLINES puts the blip cycle at the start of the delay phase. */
export const BLIP_DELAY_START = 5;
/** R: TRIGGER — firing without full lock hides the markers for 12 display cycles. */
export const LOCK_ON_LIFE = 12;

export interface TrackedObject {
  x: number;
  y: number;
  z: number;
}

/** The ROM's sign + 16-bit coordinate: its high byte as the code reads it (−1 KM → $FF). */
function hi(km: number): number {
  const v = Math.max(-65536, Math.min(65535, Math.floor(km)));
  return ((v >= 0 ? v : 65536 + v) >> 8) & 0xff;
}

/**
 * R: UPDATTCOMP blip column: the x high byte mapped to −11..+11 around column 131.
 * x ≥ 0 (right): hi 0..11 as is, larger → 11. x < 0: the raw high byte ($F5..$FF = −11..−1),
 * further left → −11.
 */
export function blipColumn(x: number): number {
  const h = hi(x);
  let rel: number;
  if (x >= 0) rel = h < 12 ? h : 11;
  else rel = h >= 0xf5 ? h - 256 : -11;
  return BLIP_REF_COL + rel;
}

/**
 * R: UPDATTCOMP blip row: the y high byte inverted (EOR #$FF) mapped to −6..+4 around row 77.
 * Above the axis (y ≥ 0) the inverted byte is $FF..$FA = −1..−6 (higher → −6); below it is
 * 0..4 (lower → 4).
 */
export function blipRow(y: number): number {
  const m = hi(y) ^ 0xff;
  let rel: number;
  if (y >= 0) rel = m >= 0xfa ? m - 256 : -6;
  else rel = m < 5 ? m : 4;
  return BLIP_REF_ROW + rel;
}

/**
 * The lock level of a blip position and the object's z (R: UPDATTCOMP SKIP061..SKIP062):
 * 0 none, 1 A (horizontal), 2 B (and vertical), 3 C (and in range): full lock-on.
 */
export function lockLevel(col: number, row: number, z: number): 0 | 1 | 2 | 3 {
  if (col < LOCK_WINDOW.colMin || col > LOCK_WINDOW.colMax) return 0;
  if (row < LOCK_WINDOW.rowMin || row > LOCK_WINDOW.rowMax) return 1;
  // ZPOSHI < 12: the sign is not tested, but behind the ship (z < 0) the high byte is ≥ $F0.
  if (hi(z) >= LOCK_WINDOW.zHiMax) return 2;
  return 3;
}

/** What the renderer draws inside the box this frame. */
export interface AttackDisplay {
  /** Top-left pixel of the blip. */
  blipCol: number;
  blipRow: number;
  /** Rows of the blip drawn so far (0..5; drawn one per loop after each recalculation). */
  blipRows: number;
  /** Marker pairs lit: 0 none, 1 A, 2 A+B, 3 A+B+C. */
  marks: 0 | 1 | 2 | 3;
}

/**
 * R: UPDATTCOMP state — the blip cycle, the blip's place and rows drawn, the markers and the
 * lock-on flag (ISINLOCKON) TRIGGER reads.
 */
export class AttackComputer {
  /** R: BLIPCYCLECNT. */
  public cycle = BLIP_DELAY_START;
  /** R: BLIPCOLUMN, BLIPROW — top-left of the blip as last calculated. */
  public blipCol = BLIP_REF_COL;
  public blipRow = BLIP_REF_ROW;
  /** Rows of the blip on the playfield (wiped on blip cycle 10). */
  public blipRows = 0;
  /** Marker pairs on the playfield. */
  public marks: 0 | 1 | 2 | 3 = 0;
  /** R: LOCKONLIFE — display cycles the markers stay hidden after firing without lock. */
  public lockOnLife = 0;
  /** R: ISINLOCKON — full lock-on (all three marker pairs): fired torpedoes home in. */
  public inLockOn = false;

  /**
   * R: DRAWLINES after CLRPLAYFIELD (view keys, C, S and T): the playfield is cleared, so the
   * blip and markers vanish and the lock-on flag drops; the blip cycle restarts at the delay.
   */
  public reset(): void {
    this.cycle = BLIP_DELAY_START;
    this.blipRows = 0;
    this.marks = 0;
    this.inLockOn = false;
  }

  /**
   * One game loop of UPDATTCOMP (only called in the Front view with the computer on and not
   * destroyed). `target` is the tracked object (ship frame, KM), or null when it is not alive.
   */
  public loop(target: TrackedObject | null): void {
    if (this.cycle < 5) {
      // Blip cycles 0..4: draw one row of the blip.
      this.blipRows = this.cycle + 1;
      this.cycle++;
      return;
    }
    if (this.cycle < BLIP_CYCLE) {
      this.cycle++;
      return;
    }

    // Blip cycle 10: wipe the display (the filter keeps only the frame lines).
    this.blipRows = 0;
    this.marks = 0;
    if (!target) {
      // The tracked object is gone: the blip disappears (§11) and stays off. The ROM would go
      // on drawing markers from the dead object's last place; with nothing to aim at they stay
      // dark here and the lock drops.
      this.inLockOn = false;
      return;
    }
    this.blipCol = blipColumn(target.x);
    this.blipRow = blipRow(target.y);
    this.cycle = 0;

    if (this.lockOnLife > 0) {
      this.lockOnLife--;
      if (this.lockOnLife > 0) {
        this.inLockOn = false;
        return;
      }
    }
    this.marks = lockLevel(this.blipCol, this.blipRow, target.z);
    this.inLockOn = this.marks === 3;
  }

  /**
   * R: TRIGGER on a new trigger press with a barrel ready: in full lock the markers stay,
   * otherwise they are hidden for 12 display cycles.
   */
  public triggered(): void {
    this.lockOnLife = this.inLockOn ? 0 : LOCK_ON_LIFE;
  }

  /** The blip and markers as they stand on the playfield. */
  public display(): AttackDisplay {
    return { blipCol: this.blipCol, blipRow: this.blipRow, blipRows: this.blipRows, marks: this.marks };
  }
}

/** Should the tracking computer flip the view (R: GAMELOOP step 23)? Returns the new view or null. */
export function trackingView(view: 'FRONT' | 'AFT', targetZ: number): 'FRONT' | 'AFT' | null {
  if (view === 'FRONT' && targetZ < 0) return 'AFT';
  if (view === 'AFT' && targetZ >= 0) return 'FRONT';
  return null;
}
