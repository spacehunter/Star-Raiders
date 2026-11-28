/**
 * Bend 8: the sound keys. They work in every mode (attract, mission, pause, debrief) and are
 * not game keys, so they never give `WHATS WRONG?` or end a pause.
 *
 *   N        sound on / off
 *   - and =  volume down / up (0–10); the numeric keypad's - and + too
 */
import { clampVolume, type Settings } from '../core/settings';

export type AudioKey = 'mute' | 'volumeDown' | 'volumeUp';

export function audioKeyFor(code: string): AudioKey | null {
  switch (code) {
    case 'KeyN':
      return 'mute';
    case 'Minus':
    case 'NumpadSubtract':
      return 'volumeDown';
    case 'Equal':
    case 'NumpadAdd':
      return 'volumeUp';
  }
  return null;
}

/** The settings change a sound key makes. Changing the volume also turns the sound back on. */
export function audioKeyPatch(key: AudioKey, s: Pick<Settings, 'volume' | 'muted'>): Pick<Settings, 'volume' | 'muted'> {
  switch (key) {
    case 'mute':
      return { volume: s.volume, muted: !s.muted };
    case 'volumeDown':
      return { volume: clampVolume(s.volume - 1), muted: false };
    case 'volumeUp':
      return { volume: clampVolume(s.volume + 1), muted: false };
  }
}
