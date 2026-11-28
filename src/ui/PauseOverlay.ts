/**
 * Part 4 bend 7: the pause menu (MANUAL_SPEC §5, §5.11). P (or Esc) stops the mission as the
 * original did; this small card adds the key help. Any key or a stick move goes on; X aborts the
 * mission and rates it (§3, the 800's Atari key). The buttons work by mouse or touch.
 */
import { getSettings } from '../core/settings';
import { ROM_RGB } from '../render/palette';
import { pixelButton, textCanvas, type PixelLine } from './pixelText';

export interface PauseActions {
  resume(): void;
  abort(): void;
}

/** The key-help lines (keys in mint, what they do in light blue-green). */
export function pauseHelpLines(wasd: boolean, sound: { volume: number; muted: boolean } = { volume: 7, muted: false }): PixelLine[] {
  const key = ROM_RGB.$B8;
  const txt = ROM_RGB.$AF;
  const row = (k: string, what: string): PixelLine => [[k.padEnd(7), key], [what, txt]];
  return [
    [['       PAUSED', ROM_RGB.$FC]],
    [[' ', txt]],
    [['ANY KEY OR STICK:', ROM_RGB.$5A]],
    [['  GO ON', txt]],
    [[' ', txt]],
    row('0-9', 'ENGINE SPEED'),
    row(wasd ? 'F R' : 'F A', 'FRONT / AFT VIEW'),
    row('G', 'GALACTIC CHART'),
    row('L', 'LONG RANGE SCAN'),
    row('H', 'HYPERWARP'),
    row(wasd ? 'Q' : 'S', 'SHIELDS'),
    row('C', 'ATTACK COMPUTER'),
    row('T', 'TRACKING COMPUTER'),
    row('M', 'MANUAL TARGET'),
    row('SPACE', 'FIRE PHOTONS'),
    row(wasd ? 'WASD' : 'ARROWS', 'STEER'),
    row('P ESC', 'PAUSE'),
    row('X', 'ABORT MISSION'),
    // Bend 8: the sound keys, with the current setting.
    row('N', sound.muted ? 'SOUND OFF (MUTED)' : 'SOUND ON / MUTE'),
    row('- =', `VOLUME ${sound.volume}`),
  ];
}

export class PauseOverlay {
  private readonly root: HTMLDivElement;
  private readonly actions: PauseActions;

  constructor(container: HTMLElement, actions: PauseActions) {
    this.actions = actions;
    this.root = document.createElement('div');
    this.root.className = 'overlay pause-overlay';
    this.root.hidden = true;
    container.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.root.replaceChildren();
    const card = document.createElement('div');
    card.className = 'overlay-card';
    const s = getSettings();
    card.appendChild(textCanvas(pauseHelpLines(s.wasd, s), { pad: 2 }));
    const buttons = document.createElement('div');
    buttons.className = 'overlay-buttons';
    buttons.append(
      pixelButton('RESUME', ROM_RGB.$B8, () => this.actions.resume(), 'resume-btn'),
      pixelButton('ABORT', ROM_RGB.$FC, () => this.actions.abort(), 'abort-btn')
    );
    card.appendChild(buttons);
    this.root.appendChild(card);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }
}
