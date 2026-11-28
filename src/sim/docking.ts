/**
 * Starbase docking: the orbit conditions and the docking state machine.
 *
 * MANUAL_SPEC §13 (docking, from the manual), §17.9 (R: DOCKING L6160), §6 (T=2, E 9999).
 *
 * The ROM's DOCKSTATE has four values, and so does `DockState` here:
 *   'none'      $00  NOT DOCKED
 *   'orbit'     $FF  ORBIT ESTABLISHED (the title line runs ORBIT ESTABLISHED, STANDBY)
 *   'transfer'  $81  RETURN TRANSFER VESSEL (the vessel is on its way in)
 *   'complete'  $01  TRANSFER COMPLETE (energy 9999, all repaired; stays until a condition breaks)
 *
 * Breaking an orbit condition in 'orbit' or 'transfer' gives DOCKING ABORTED; in 'complete' it
 * just returns to 'none' quietly. Staying put after TRANSFER COMPLETE never docks again: the
 * conditions have to break first (there is no repeat-docking loop).
 */
import { projectOffset } from '../render/projection';
import type { Vec3Like } from './zylons';

/** R: DOCKING — the starbase never comes closer than +32 KM (it is pushed back 1 KM per loop). */
export const STARBASE_MIN_Z = 32;
/** §17.9: the starbase must be in front and closer than 512 KM (z high byte < 2). */
export const ORBIT_MAX_Z = 512;
/** R: the starbase's y high byte must be 0: level with us, 0..255 KM above the axis. */
export const ORBIT_MAX_Y = 256;
/**
 * R: PL2COLUMN (left edge of the centre sprite, PM pixels) must be in 120..135. PM column 125 is
 * the screen centre for a PLAYER's left edge, so this is −5..+10 PM pixels around the centre:
 * the ROM's asymmetric window, kept as it is (MANUAL_SPEC §17.9 "centred").
 */
export const ORBIT_COLUMN_MIN = 120;
export const ORBIT_COLUMN_SPAN = 16;
/**
 * R: PL2ROWNEW (top of the centre sprite, PM pixels) must be in 104..119; PM row 122 is the
 * vertical centre. Together with y ≥ 0 this puts the starbase "slightly above the horizontal
 * crosshair" (§17.9): it sits on the cross hair rather than hanging from it.
 */
export const ORBIT_ROW_MIN = 104;
export const ORBIT_ROW_SPAN = 16;

/** R: SCREENCOLUMN / SCREENROW centres for PLAYER objects. */
export const PM_CENTER_COLUMN = 125;
export const PM_CENTER_ROW = 122;

/** R: DOCKING "Launch transfer vessel": x +$00**, y +$01**, z +$10** KM (low bytes: mid-range). */
export const VESSEL_START: Readonly<Vec3Like> = { x: 0x0080, y: 0x0180, z: 0x1080 };
/** R: velocity toward us (+1, −1, −7 KM/loop); on its way back x, y and z are reversed. */
export const VESSEL_VELOCITY_IN: Readonly<Vec3Like> = { x: 1, y: -1, z: -7 };
export const VESSEL_VELOCITY_OUT: Readonly<Vec3Like> = { x: -1, y: 1, z: 7 };

/**
 * The PM column of a PLAYER's left edge (R: SCREENCOLUMN), or null when it is off screen
 * in the Front view.
 */
export function pmColumn(x: number, z: number): number | null {
  if (z < 0) return null;
  const off = projectOffset(x, z);
  if (off === null || off >= 80) return null;
  return x >= 0 ? PM_CENTER_COLUMN + off : PM_CENTER_COLUMN - (off + 1);
}

/** The PM row of a PLAYER's top (R: SCREENROW), or null when it is off screen in the Front view. */
export function pmRow(y: number, z: number): number | null {
  if (z < 0) return null;
  const off = projectOffset(y, z);
  if (off === null || off >= 50) return null;
  return y >= 0 ? PM_CENTER_ROW - (2 * off + 1) : PM_CENTER_ROW + 2 * off;
}

export interface OrbitInput {
  /** The starbase centre in the ship frame (KM). */
  starbase: Vec3Like;
  /** VELOCITYLO: our velocity now (KM/loop). */
  velocity: number;
  /** NEWVELOCITY: the velocity of the chosen speed key. */
  newVelocity: number;
  /** The Aft view draws nothing in front of us, so the starbase is not between the cross hairs. */
  aft?: boolean;
}

/**
 * §17.9 / R: DOCKING docking range — all at once: the centre sprite's column in 120..135 and row
 * in 104..119, the starbase in front and closer than 512 KM, 0..255 KM above the axis, and our
 * velocity and new velocity both 0.
 */
export function inOrbitPosition(i: OrbitInput): boolean {
  if (i.aft) return false;
  const p = i.starbase;
  if (p.z < 0 || p.z >= ORBIT_MAX_Z) return false;
  if (p.y < 0 || p.y >= ORBIT_MAX_Y) return false;
  if (i.velocity !== 0 || i.newVelocity !== 0) return false;
  const col = pmColumn(p.x, p.z);
  if (col === null || col - ORBIT_COLUMN_MIN < 0 || col - ORBIT_COLUMN_MIN >= ORBIT_COLUMN_SPAN) return false;
  const row = pmRow(p.y, p.z);
  if (row === null || row - ORBIT_ROW_MIN < 0 || row - ORBIT_ROW_MIN >= ORBIT_ROW_SPAN) return false;
  return true;
}

export type DockState = 'none' | 'orbit' | 'transfer' | 'complete';

export type DockEvent =
  /** Show ORBIT ESTABLISHED (then STANDBY). */
  | 'orbitEstablished'
  /** While in orbit: enqueue the empty phrase (R: NEWTITLEPHR := 0), silencing repeats. */
  | 'holdTitle'
  /** The title line has gone blank: the transfer vessel leaves the starbase. */
  | 'launchVessel'
  /** The vessel passed behind us: TRANSFER COMPLETE, energy 9999, repair all, vessel turns back. */
  | 'transferComplete'
  /** DOCKING ABORTED. */
  | 'aborted';

export interface DockLoopInput {
  /** `inOrbitPosition()` this loop, and the stick centred. */
  inPosition: boolean;
  /** The title line is blank (R: TITLEPHR = 0). */
  titleHidden: boolean;
  /** The transfer vessel is behind us (z < 0). */
  vesselBehind: boolean;
}

export class Docking {
  public state: DockState = 'none';
  /**
   * Set when a key or the stick interrupted docking. The manual says "retrace the steps": no
   * new orbit until a condition breaks or speed 0 is chosen again (otherwise any key would give
   * DOCKING ABORTED and ORBIT ESTABLISHED one loop apart).
   */
  public interrupted = false;

  /** ORBIT ESTABLISHED or RETURN TRANSFER VESSEL: a key or the stick aborts now. */
  public get active(): boolean {
    return this.state === 'orbit' || this.state === 'transfer';
  }

  /** One game loop (R: GAMELOOP step 24, DOCKING). */
  public loop(i: DockLoopInput): DockEvent[] {
    if (!i.inPosition) {
      this.interrupted = false;
      const wasActive = this.active;
      this.state = 'none';
      return wasActive ? ['aborted'] : [];
    }
    if (this.interrupted) return [];
    switch (this.state) {
      case 'none':
        this.state = 'orbit';
        return ['orbitEstablished'];
      case 'orbit':
        if (!i.titleHidden) return ['holdTitle'];
        this.state = 'transfer';
        return ['holdTitle', 'launchVessel'];
      case 'transfer':
        if (!i.vesselBehind) return [];
        this.state = 'complete';
        return ['transferComplete'];
      default:
        return [];
    }
  }

  /**
   * §13 step 6: a key other than G, or the stick, during docking. Returns ['aborted'] when it
   * interrupted an orbit or a transfer.
   */
  public interrupt(): DockEvent[] {
    if (!this.active) return [];
    this.state = 'none';
    this.interrupted = true;
    return ['aborted'];
  }

  /** Speed key 0 pressed: the pilot retraces the last step, so docking may begin again. */
  public retry(): void {
    this.interrupted = false;
  }

  /** Hyperwarp or a new sector (R: ENDWARP: DOCKSTATE := NOT DOCKED). */
  public reset(): void {
    this.state = 'none';
    this.interrupted = false;
  }
}
