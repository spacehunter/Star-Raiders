import { GameState } from '../game/GameState';
import type { PanelData } from '../render/Renderer';
import { ROM_RGB } from '../render/palette';
import type { Phrase } from '../rules/messages';
import {
  PanelColors,
  angleReadout,
  energyReadout,
  killsReadout,
  rangeReadout,
  trackLetter,
  velocityReadout,
  type PanelBand,
} from '../sim/panel';
import { TitleLine } from '../sim/title';
import { computerReadoutsLive } from '../sim/damage';

const BAND_RGB: Record<PanelBand, string> = { 0x90: ROM_RGB.$90, 0x44: ROM_RGB.$44, 0x26: ROM_RGB.$26 };

/** Ship-frame position of the tracked object, in KM. */
export interface TrackedPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Control panel and title line (MANUAL_SPEC §6, §17.2, §17.13, §18.1). It holds what both show;
 * the 2D renderer draws them. `loop()` runs once per game loop like the ROM's UPDPANEL,
 * UPDTITLE and FLUSHGAMELOOP.
 */
export class ControlPanel {
  public readonly title = new TitleLine();
  public readonly colors: PanelColors;

  private theta = '+00';
  private phi = '+00';
  private range = '+000';
  private trackDigit = 0;
  private warpMarker: { dx: number; dy: number } | null = null;

  private readonly gameState: GameState;

  constructor(gameState: GameState, rng: () => number) {
    this.gameState = gameState;
    this.colors = new PanelColors(rng);
  }

  /**
   * One game loop: band and shields colours, the title line, and θ Φ R from the tracked object.
   * With the attack computer damaged or destroyed the readouts keep their last values (§17.2,
   * §17.3; R: UPDPANEL "BIT GCSTATCOM / BMI").
   */
  public loop(tracked: TrackedPosition | null): void {
    const s = this.gameState;
    this.colors.loop({ energy: s.energy, shieldsOn: s.shieldsActive, shieldsStatus: s.damage.shields });
    this.title.loop();
    if (computerReadoutsLive(s.damage.computer) && tracked) {
      this.theta = angleReadout(tracked.x);
      this.phi = angleReadout(tracked.y);
      this.range = rangeReadout(tracked.z);
    }
  }

  /** Show a phrase now (R: SETTITLE). */
  public setTitle(phrase: Phrase): void {
    this.title.set(phrase);
  }

  /** Queue a phrase for when the line next goes blank (R: NEWTITLEPHR). */
  public enqueueTitle(phrase: Phrase): void {
    this.title.enqueue(phrase);
  }

  /** The target digit after T:/C: (0/1 Zylon, 2 starbase, 3 hyperwarp marker; Phase 6 and 8). */
  public setTrackDigit(digit: number): void {
    this.trackDigit = Math.max(0, Math.min(3, Math.floor(digit)));
  }

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

  /** The title-line text now, or '' while it is hidden. */
  public titleText(): string {
    return this.title.text ?? '';
  }

  /** Panel fields as drawn: `V:00 K:00 E:9999 T:0` / ` θ:+00 Φ:+00 R:+000` (§17.2). */
  public panelData(velocityKm: number, hyperspace: boolean): PanelData {
    const s = this.gameState;
    return {
      v: velocityReadout(velocityKm, hyperspace),
      k: killsReadout(s.enemiesDestroyed),
      e: energyReadout(s.energy),
      letter: trackLetter(s.trackingComputerOn),
      t: String(this.trackDigit),
      theta: this.theta,
      phi: this.phi,
      range: this.range,
      band: BAND_RGB[this.colors.band],
    };
  }

  public dispose(): void {}
}
