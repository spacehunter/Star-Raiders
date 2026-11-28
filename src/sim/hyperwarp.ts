/**
 * Hyperwarp (MANUAL_SPEC §9, §12.3, §17.5; R: KEYBOARD 'H' L7274, HYPERWARP L4736, ABORTWARP
 * L4906, ENDWARP, CLEANUPWARP L4957, INITTRAIL L5019, CALCWARP L7626, SCREENCOLUMN/SCREENROW).
 *
 * The jump has four phases:
 *
 *  1. ACCELERATION — H (front view) sets the new velocity to 255; the ship gains 1 KM/loop per
 *     loop. The hyperwarp target marker (PLAYER3) is a space object 7936..8191 KM ahead. The
 *     stick turns the ship and so moves the marker; on every level but NOVICE it also veers
 *     off: in 16 of 256 loops it gets a new random x and y velocity, ±16..31 up to ±16..127
 *     KM/loop by the jump's WARPENERGY (VEERMASK).
 *  2. STAR TRAIL — from velocity 128 a trail of 6 stars appears every 4 loops and the ship
 *     moves 256 KM/loop faster (VELOCITYHI = 1).
 *  3. HYPERSPACE — at velocity 254: stars and marker hidden, V ∞, HYPERSPACE, the transit
 *     beep; CALCWARP recomputes WARPENERGY from the (steered) arrival point, and every
 *     following loop costs 10 energy until WARPENERGY counts down to zero (WARPENERGY − 1
 *     charges).
 *  4. DECELERATION — HYPERWARP COMPLETE, the new velocity is 0 and the ship slows by 1 per
 *     loop; the arrival sector becomes the current one (red alert if it holds Zylons).
 *
 * Chart positions are the ROM's marker numbers in Player/Missile pixels (0..127): one sector is
 * 8 columns wide and 16 rows high. During phases 1–2 the arrival point is the chosen point plus
 * how far the marker sits off its centre (PM column 125, PM row 119), so 8 PM columns off-centre
 * is one sector sideways and 16 PM rows one sector up or down. Outside the front view (not
 * NOVICE) the marker's column and row are a random byte each loop: a random landing.
 * Any key 0–9 aborts in phases 1–3: −100 energy, HYPERWARP ABORTED, the ship stays put (the
 * chart's dot keeps the steered arrival point, as in the ROM).
 */
import { calcWarp, CHART_COLUMN_UNITS, CHART_ROW_UNITS, veerMask, veerVelocity } from '../rules/warp';
import { hyperwarpSteeringRequired, type MissionLevel } from '../rules/levels';
import { projectOffset } from '../render/projection';
import { rotatePitch, rotateYaw, type Point3, type Stick } from './motion';

/** R: KEYBOARD 'H' — NEWVELOCITY := 255. */
export const WARP_NEW_VELOCITY = 255;
/** R: HYPERWARP — the star trail phase starts at velocity 128 KM/loop. */
export const TRAIL_VELOCITY = 128;
/** R: HYPERWARP — hyperspace starts at velocity 254 KM/loop. */
export const HYPERSPACE_VELOCITY = 254;
/** R: INITTRAIL — VELOCITYHI = 1 adds 256 KM/loop while the trails run. */
export const TRAIL_VELOCITY_BOOST = 256;
/** R: INITTRAIL — a new trail every 3(+1) loops. */
export const TRAIL_DELAY = 3;
/** R: HYPERWARP — the marker's z high byte is held at $1F (7936..8191 KM ahead). */
export const MARKER_Z_HI = 0x1f;
/** R: KEYBOARD 'H' — the marker starts at x 0, y +256 KM. */
export const MARKER_START_Y = 256;
/** R: SCREENCOLUMN/SCREENROW — PLAYER centre column and row in PM pixels. */
export const PM_CENTER_COL = 125;
export const PM_CENTER_ROW = 122;
/** R: HYPERWARP — the centred marker's PM column and (top edge) row used for the landing offset. */
export const MARKER_CENTER_COL = 125;
export const MARKER_CENTER_ROW = 119;
/** R: SCREENROW — an offscreen PLAYER is pushed to PM row 251. */
export const PM_OFFSCREEN_ROW = 251;
/** R: HYPERWARP — "Return in 94% (240:256) of game loops": a veer kick when RANDOM < 16. */
export const VEER_CHANCE_256 = 16;
/** R: WARPDEPRCOLUMN/ROW initial values: $43, $47 (the chart's centre). */
export const CHART_START = { col: 0x43, row: 0x47 } as const;

export interface ChartPoint {
  /** PM column 0..127 (sector column = col >> 3). */
  col: number;
  /** PM row 0..127 (sector row = row >> 4). */
  row: number;
}

export type WarpPhase = 'off' | 'accel' | 'hyperspace';

export type WarpEvent =
  /** INITTRAIL: draw a new star trail. */
  | { type: 'trail' }
  /** First hyperspace loop (CLEANUPWARP): hide stars and marker, clear the sector. */
  | { type: 'hyperspace'; warpEnergy: number }
  /** A hyperspace loop: −10 energy. */
  | { type: 'charge' }
  /** Deceleration starts: the ship is in the arrival sector. */
  | { type: 'complete'; sector: { x: number; y: number }; arrival: ChartPoint; vicinityIndex: number };

/** The sector of a chart point. */
export function chartSector(p: ChartPoint): { x: number; y: number } {
  return { x: (p.col & 0x7f) >> 3, y: (p.row & 0x7f) >> 4 };
}

/** R: HYPERWARP DECELERATION — bits 3..1 of the arrival row pick the vicinity mask (3 = middle). */
export function vicinityIndex(row: number): number {
  return (row >> 1) & 7;
}

/**
 * The marker's PM column and row from its ship-frame position (R: PROJECTION, SCREENCOLUMN,
 * SCREENROW for a PLAYER). Offscreen pushes the row to 251 and leaves the column as it was.
 */
export function markerPm(p: Point3, prev: { col: number; row: number }): { col: number; row: number } {
  const colOff = projectOffset(p.x, p.z);
  if (colOff === null || colOff >= 80) return { col: prev.col, row: PM_OFFSCREEN_ROW };
  const col = p.x >= 0 ? PM_CENTER_COL + colOff : PM_CENTER_COL - (colOff + 1);
  const rowOff = projectOffset(p.y, p.z);
  if (rowOff === null || rowOff >= 50) return { col, row: PM_OFFSCREEN_ROW };
  const row = p.y >= 0 ? PM_CENTER_ROW - 2 * (rowOff + 1) : PM_CENTER_ROW + 2 * rowOff;
  return { col, row };
}

/** The arrival point: the chosen point plus the marker's offset from its centre, each & $7F. */
export function steeredArrival(chosen: ChartPoint, markerCol: number, markerRow: number): ChartPoint {
  return {
    col: (chosen.col + markerCol - MARKER_CENTER_COL) & 0x7f,
    row: (chosen.row + markerRow - MARKER_CENTER_ROW) & 0x7f,
  };
}

export interface WarpLoopInput {
  /** The ship's velocity (low byte, KM/loop) after this loop's step. */
  velocity: number;
  /** The view is the front view (the marker is projected only there). */
  front: boolean;
  level: MissionLevel;
  /** The stick as it turns the ship this loop (centred in the chart). */
  turn: Stick;
  /** One RANDOM byte 0..255. */
  randomByte: () => number;
}

export interface WarpMarker extends Point3 {
  vx: number;
  vy: number;
  /** PM column / top-edge PM row as the ROM last computed them. */
  col: number;
  row: number;
}

export class Hyperwarp {
  public phase: WarpPhase = 'off';
  /** WARPDEPRCOLUMN/ROW: where we are on the chart. */
  public departure: ChartPoint = { ...CHART_START };
  /** WARPARRVCOLUMN/ROW: the chart's destination dot, then the steered arrival point. */
  public arrival: ChartPoint = { ...CHART_START };
  /** WARPTEMPCOLUMN/ROW: the destination when H was pressed. */
  public chosen: ChartPoint = { ...CHART_START };
  /** WARPENERGY: energy / 10 of the jump; in hyperspace, the loops left. */
  public warpEnergy = 0;
  /** VEERMASK for this jump (0 on NOVICE). */
  public veerMask = 0;
  /** VELOCITYHI: the trails' +256 KM/loop has started. */
  public trailsStarted = false;
  /** Hyperspace loops charged so far in this jump. */
  public charges = 0;
  public readonly marker: WarpMarker = { x: 0, y: MARKER_START_Y, z: MARKER_Z_HI << 8, vx: 0, vy: 0, col: MARKER_CENTER_COL, row: MARKER_CENTER_ROW };
  private trailDelay = 0;

  /** WARPSTATE ≠ 0: phases 1–3 (deceleration is the normal flight's slow-down). */
  get engaged(): boolean {
    return this.phase !== 'off';
  }

  /** Extra KM/loop the ship moves by while the trails run (R: VELOCITYHI). */
  get velocityBoost(): number {
    return this.phase === 'accel' && this.trailsStarted ? TRAIL_VELOCITY_BOOST : 0;
  }

  /** The marker is on screen: phases 1–2 (R: PL3LIFE; hidden in hyperspace). */
  get markerShown(): boolean {
    return this.phase === 'accel';
  }

  /** WARP ENERGY on the chart: CALCWARP from departure to the destination dot (×10 units). */
  get chartWarpEnergy(): number {
    return calcWarp(this.departure.col, this.departure.row, this.arrival.col, this.arrival.row).units;
  }

  /** The chart's destination dot as a sector. */
  get arrivalSector(): { x: number; y: number } {
    return chartSector(this.arrival);
  }

  /** Put the destination dot in a sector, keeping its place inside the sector (the chart's stick). */
  setArrivalSector(x: number, y: number): void {
    this.arrival = {
      col: x * CHART_COLUMN_UNITS + (this.arrival.col % CHART_COLUMN_UNITS),
      row: y * CHART_ROW_UNITS + (this.arrival.row % CHART_ROW_UNITS),
    };
  }

  /** Put our own position in a sector (debug teleport), keeping its place inside the sector. */
  setDepartureSector(x: number, y: number): void {
    this.departure = {
      col: x * CHART_COLUMN_UNITS + (this.departure.col % CHART_COLUMN_UNITS),
      row: y * CHART_ROW_UNITS + (this.departure.row % CHART_ROW_UNITS),
    };
  }

  /**
   * R: KEYBOARD 'H' — engage (ignored while engaged). WARPENERGY is CALCWARP to the destination
   * dot; it picks VEERMASK. The marker restarts at x 0, y +256 KM, straight ahead.
   */
  engage(level: MissionLevel): boolean {
    if (this.engaged) return false;
    this.phase = 'accel';
    this.trailsStarted = false;
    this.trailDelay = 0;
    this.charges = 0;
    this.warpEnergy = calcWarp(this.departure.col, this.departure.row, this.arrival.col, this.arrival.row).warpEnergy;
    this.veerMask = veerMask(hyperwarpSteeringRequired(level), this.warpEnergy);
    this.chosen = { ...this.arrival };
    Object.assign(this.marker, { x: 0, y: MARKER_START_Y, z: MARKER_Z_HI << 8, vx: 0, vy: 0 });
    const pm = markerPm(this.marker, this.marker);
    this.marker.col = pm.col;
    this.marker.row = pm.row;
    return true;
  }

  /** R: ABORTWARP / ENDWARP — any 0–9 key in phases 1–3. Returns whether a jump was aborted. */
  abort(): boolean {
    if (!this.engaged) return false;
    this.phase = 'off';
    this.trailsStarted = false;
    return true;
  }

  /** One game loop (R: GAMELOOP steps 8, 9 and 12 for PLAYER3, then step 30 HYPERWARP). */
  loop(inp: WarpLoopInput): WarpEvent[] {
    if (!this.engaged) return [];

    if (inp.velocity >= HYPERSPACE_VELOCITY) {
      if (this.phase === 'accel') {
        // First pass: CALCWARP on the steered arrival point, then CLEANUPWARP.
        this.phase = 'hyperspace';
        this.trailsStarted = false;
        this.warpEnergy = calcWarp(this.departure.col, this.departure.row, this.arrival.col, this.arrival.row).warpEnergy;
        return [{ type: 'hyperspace', warpEnergy: this.warpEnergy }];
      }
      this.warpEnergy--;
      if (this.warpEnergy > 0) {
        this.charges++;
        return [{ type: 'charge' }];
      }
      // DECELERATION: ENDWARP; the arrival point becomes our position.
      this.phase = 'off';
      this.departure = { ...this.arrival };
      return [{ type: 'complete', sector: chartSector(this.arrival), arrival: { ...this.arrival }, vicinityIndex: vicinityIndex(this.arrival.row) }];
    }

    const events: WarpEvent[] = [];
    this.moveMarker(inp);

    if (inp.velocity >= TRAIL_VELOCITY && --this.trailDelay < 0) {
      this.trailsStarted = true;
      this.trailDelay = TRAIL_DELAY;
      events.push({ type: 'trail' });
    }

    this.arrival = steeredArrival(this.chosen, this.marker.col, this.marker.row);

    const m = this.marker;
    if (hyperwarpSteeringRequired(inp.level)) {
      const r = inp.randomByte();
      if (!inp.front) {
        m.col = r;
        m.row = r;
      }
      if (r >= VEER_CHANCE_256) return events;
    }
    m.vx = veerVelocity(inp.randomByte(), this.veerMask);
    m.vy = veerVelocity(inp.randomByte(), this.veerMask);
    return events;
  }

  /** Steps 8, 9 and 12 for PLAYER3: turn with the stick, move by its velocity, hold z, project. */
  private moveMarker(inp: WarpLoopInput): void {
    const m = this.marker;
    rotateYaw(m, inp.turn.x);
    rotatePitch(m, inp.turn.y);
    m.x += m.vx;
    m.y += m.vy;
    m.z = (MARKER_Z_HI << 8) | (Math.floor(m.z) & 0xff);
    if (!inp.front) return;
    const pm = markerPm(m, m);
    m.col = pm.col;
    m.row = pm.row;
  }
}
