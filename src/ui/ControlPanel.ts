import { GameState } from '../game/GameState';
import { panelV } from '../rules/speed';
import type { PanelData } from '../render/Renderer';

/** Title-line message lengths in loops (§17.11: 60 short, 254 long). */
export const SHORT_MESSAGE_LOOPS = 60;
export const LONG_MESSAGE_LOOPS = 254;

const sign = (n: number, digits: number) =>
  `${n < 0 ? '-' : '+'}${String(Math.min(10 ** digits - 1, Math.abs(Math.round(n)))).padStart(digits, '0')}`;

/**
 * Control panel and title line data (MANUAL_SPEC §6, §17.2). The 2D renderer draws both; this
 * class only holds what they show. Phase 4 adds the panel's readout rules (gradons, T/C,
 * flashes, frozen θΦR) and the ROM's one-segment-at-a-time title line.
 */
export class ControlPanel {
  private theta = 0;
  private phi = 0;
  private range = 0;
  private message = '';
  private messageUntil = 0;
  private warpMarker: { dx: number; dy: number } | null = null;

  private readonly gameState: GameState;
  private readonly loops: () => number;

  constructor(gameState: GameState, loops: () => number) {
    this.gameState = gameState;
    this.loops = loops;
  }

  /** Kept for callers; the renderer reads the state every frame. */
  public update(): void {}

  public updateTargetData(theta: number, phi: number, range: number): void {
    this.theta = theta;
    this.phi = phi;
    this.range = range;
  }

  public updateTargetsRemaining(_count: number): void {}

  /** Show a phrase on the title line for `loops` game loops. */
  public showMessage(message: string, loops: number = SHORT_MESSAGE_LOOPS): void {
    this.message = message;
    this.messageUntil = this.loops() + loops;
  }

  public showDamageMessage(message: string, _type?: string): void {
    this.showMessage(message);
  }

  /** Red alert is a background flash drawn by the renderer (§17.13). */
  public setRedAlert(_active: boolean): void {}

  public setHyperwarpMarkerVisible(visible: boolean): void {
    this.warpMarker = visible ? (this.warpMarker ?? { dx: 0, dy: 0 }) : null;
  }

  /** Marker offset from the playfield centre, in playfield pixels. */
  public updateHyperwarpMarker(dx: number, dy: number): void {
    if (this.warpMarker) this.warpMarker = { dx, dy };
  }

  public getWarpMarker(): { dx: number; dy: number } | null {
    return this.warpMarker;
  }

  /** The title-line text now, or '' once it has run out. */
  public titleText(): string {
    return this.loops() < this.messageUntil ? this.message : '';
  }

  /** Panel fields as drawn: `V:00 K:00 E:9999 T:0` / ` θ:+00 Φ:+00 R:+000` (§17.2). */
  public panelData(velocityKm: number, hyperspace: boolean): PanelData {
    const s = this.gameState;
    return {
      v: hyperspace ? '∞ ' : String(Math.min(99, panelV(velocityKm))).padStart(2, '0'),
      k: String(Math.min(99, s.enemiesDestroyed)).padStart(2, '0'),
      e: String(Math.max(0, Math.min(9999, Math.floor(s.energy)))).padStart(4, '0'),
      t: 'T:0',
      theta: sign(this.theta, 2),
      phi: sign(this.phi, 2),
      range: sign(this.range, 3),
    };
  }

  public dispose(): void {}
}
