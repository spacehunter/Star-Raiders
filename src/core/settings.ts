/**
 * Player settings for the deliberate modern bends (docs/OVERHAUL_PLAN.md Part 4, bends 1–3).
 * Rules and numbers never depend on these; they only change the look and the controls.
 *
 * Stored in localStorage; URL parameters override for one session (handy for captures):
 *   ?stars=classic|enhanced   ?crt=0|1   ?wasd=0|1   ?mouse=0|1   ?volume=0..10   ?mute=0|1
 */
export interface Settings {
  /** Bend 3: 12 ROM stars ("classic") or about 48 ("enhanced"), same motion rules. */
  stars: 'classic' | 'enhanced';
  /** Bend 2: optional CRT scanline filter. Off by default. */
  crt: boolean;
  /**
   * Bend 1: W/A/S/D act as the stick as well as the arrow keys. A and S are the manual's Aft
   * view and Shields keys, so with WASD on those move to R (rear view) and Q (shields).
   */
  wasd: boolean;
  /** Bend 1: mouse steering with pointer lock (click the screen to capture the mouse). */
  mouse: boolean;
  /** Bend 8: sound volume 0–10 (- and = keys). */
  volume: number;
  /** Bend 8: all sound off (N key). */
  muted: boolean;
}

export const DEFAULT_SETTINGS: Settings = { stars: 'classic', crt: false, wasd: false, mouse: false, volume: 7, muted: false };

const STORAGE_KEY = 'star-raiders.settings';

function parseBool(v: string | null): boolean | undefined {
  if (v === null) return undefined;
  return v === '1' || v === 'true' || v === 'on';
}

function load(): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') Object.assign(s, pick(saved));
  } catch {
    // ignore unreadable settings
  }
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search);
    const stars = q.get('stars');
    if (stars === 'classic' || stars === 'enhanced') s.stars = stars;
    s.crt = parseBool(q.get('crt')) ?? s.crt;
    s.wasd = parseBool(q.get('wasd')) ?? s.wasd;
    s.mouse = parseBool(q.get('mouse')) ?? s.mouse;
    s.muted = parseBool(q.get('mute')) ?? s.muted;
    const vol = q.get('volume');
    if (vol !== null && Number.isFinite(Number(vol))) s.volume = clampVolume(Number(vol));
  }
  return s;
}

export function clampVolume(v: number): number {
  return Math.max(0, Math.min(10, Math.round(v)));
}

function pick(o: Record<string, unknown>): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (o.stars === 'classic' || o.stars === 'enhanced') out.stars = o.stars;
  for (const k of ['crt', 'wasd', 'mouse', 'muted'] as const) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  if (typeof o.volume === 'number' && Number.isFinite(o.volume)) out.volume = clampVolume(o.volume);
  return out;
}

const current: Settings = load();
const listeners = new Set<(s: Settings) => void>();

export function getSettings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  Object.assign(current, pick(patch as Record<string, unknown>));
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage may be unavailable (private mode); settings still apply for this session
  }
  for (const fn of listeners) fn(current);
  return current;
}

export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
