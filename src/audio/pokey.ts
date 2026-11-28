/**
 * POKEY-style sound (MANUAL_SPEC §17.12 [R: SOUND L7907]; OVERHAUL_PLAN Phase 12, Part 4 bend 8).
 *
 * Two layers:
 *
 *  1. A small POKEY model. Every effect is a "program": the AUDF/AUDC register values the ROM's
 *     vertical-blank SOUND routine would write each TICK (1/60 s), for one or two channels.
 *     `renderProgram` turns a program into samples the way POKEY does: each channel divides the
 *     64 kHz clock by AUDF+1 and on every pulse either flips a square wave (AUDC distortion $A,
 *     pure tone) or samples the 17-bit polynomial counter (distortion $8, white noise), at the
 *     AUDC volume 0–15. Pure functions, no Web Audio, so Vitest checks them.
 *
 *     The tone frequencies of §17.12 are exact AUDF bytes at the 64 kHz clock,
 *     f = 63921 / (2·(AUDF+1)): $18 → 1278 Hz (transit), $40 → 492 Hz and $60 → 330 Hz (red
 *     alert), $10 → 1880 Hz (acknowledge), $40 → $20 = 492 → 969 Hz (damage report),
 *     $48 $40 $51 = 438, 492, 390 Hz (message from starbase).
 *
 *  2. `PokeySynth`, the Web Audio player. It renders each program into an AudioBuffer and plays
 *     it on one of four voices, like the ROM's four POKEY channels:
 *       beeper     (POKEY channel 4) the five beeper patterns; one at a time, by the ROM's
 *                  pattern priority (see BEEP_PRIORITY)
 *       photon     the photon-launch whoosh; a new launch restarts it
 *       explosion  Zylon < shield < starship explosion; a lower one never cuts a higher one
 *       engines    the continuous noise rumble, its pitch and volume following the velocity
 *     Bend 8 mixes it for headphones: photons pan to their barrel, explosions to where the
 *     object was on the screen, never harder than ±0.7; a gentle low-pass takes the edge off.
 *
 * The synth owns its AudioContext. It is created on the first key press, click or tap (or at
 * once if the page already had one: a restart happens inside the START key press) and closed by
 * dispose(), so a restart never leaves a second context behind.
 */
import { createRng, getSeed } from '../core/rng';

// ---------------------------------------------------------------------------------------------
// POKEY model
// ---------------------------------------------------------------------------------------------

/** NTSC POKEY 64 kHz base clock: 1.7897725 MHz / 28. */
export const POKEY_CLOCK_64K = 1789772.5 / 28;
/** One ROM TICK (vertical blank) in seconds. */
export const TICK_SECONDS = 1 / 60;

/** AUDC distortion (high nibble): pure tone. */
export const DIST_PURE = 0xa0;
/** AUDC distortion (high nibble): 17-bit polynomial noise. */
export const DIST_NOISE = 0x80;

/** One channel's registers for one TICK. `audc` = distortion | volume (0–15). */
export interface Reg {
  audf: number;
  audc: number;
}
/** A channel that is silent this TICK. */
export const OFF: Reg = { audf: 0, audc: 0 };
/** One TICK: the registers of each channel the effect uses. */
export type Tick = readonly Reg[];
/** An effect: its registers TICK by TICK. */
export type Program = readonly Tick[];

/** Pure-tone frequency of an AUDF value at the 64 kHz clock. */
export function toneHz(audf: number): number {
  return POKEY_CLOCK_64K / (2 * (audf + 1));
}

const reg = (audf: number, dist: number, vol: number): Reg => ({
  audf: Math.max(0, Math.min(255, Math.round(audf))),
  audc: dist | Math.max(0, Math.min(15, Math.round(vol))),
});

/** Every one-shot sound of §17.12 (the engines are continuous, see engineRegs). */
export type SoundEvent =
  | 'photon'
  | 'zylonExplosion'
  | 'shieldExplosion'
  | 'starshipExplosion'
  | 'hyperwarpTransit'
  | 'redAlert'
  | 'acknowledge'
  | 'damageReport'
  | 'starbaseMessage';

/** §17.12's order, for logs, tests and the evidence render. */
export const SOUND_EVENTS: readonly SoundEvent[] = [
  'photon',
  'zylonExplosion',
  'shieldExplosion',
  'starshipExplosion',
  'hyperwarpTransit',
  'redAlert',
  'acknowledge',
  'damageReport',
  'starbaseMessage',
];

export type BeepEvent = 'hyperwarpTransit' | 'redAlert' | 'acknowledge' | 'damageReport' | 'starbaseMessage';

export interface BeepPattern {
  /** AUDF of each tone of the pattern, played in turn (pure tone, 64 kHz clock). */
  audf: readonly number[];
  /** TICKs each tone sounds. */
  on: number;
  /** TICKs of silence after each tone. */
  off: number;
  /** Times the whole pattern plays. */
  repeat: number;
  /** AUDC volume. */
  volume: number;
}

/**
 * The beeper patterns (§17.12). Frequencies and counts are the spec's; the TICK lengths of each
 * tone and gap are not in the spec, they are chosen to sound like the cartridge.
 */
export const BEEP_PATTERNS: Readonly<Record<BeepEvent, BeepPattern>> = {
  /** "1280 Hz beeps, 13×". */
  hyperwarpTransit: { audf: [0x18], on: 3, off: 3, repeat: 13, volume: 8 },
  /** "alternating ≈490/330 Hz, 8×". */
  redAlert: { audf: [0x40, 0x60], on: 8, off: 0, repeat: 8, volume: 10 },
  /** "three short ≈1880 Hz beeps". */
  acknowledge: { audf: [0x10], on: 3, off: 3, repeat: 3, volume: 8 },
  /** "≈490→970 Hz, 3×". */
  damageReport: { audf: [0x40, 0x20], on: 6, off: 2, repeat: 3, volume: 10 },
  /** "≈440, 490, 390 Hz tune". */
  starbaseMessage: { audf: [0x48, 0x40, 0x51], on: 12, off: 2, repeat: 1, volume: 10 },
};

/**
 * R: BEEP pattern offsets in BEEPPATTAB ($00 transit … $12 damage report, as cited in
 * sim/damage.ts, $18 message from starbase). A new pattern starts only if its offset is at least
 * that of the pattern still playing, so routine beeps never cut a starbase message or a damage
 * report. (The spec lists the patterns, not their priority; this follows the table order.)
 */
export const BEEP_PRIORITY: Readonly<Record<BeepEvent, number>> = {
  hyperwarpTransit: 0x00,
  redAlert: 0x06,
  acknowledge: 0x0c,
  damageReport: 0x12,
  starbaseMessage: 0x18,
};

/** Registers of a beeper pattern, one channel. */
export function beeperProgram(p: BeepPattern): Program {
  const out: Tick[] = [];
  for (let r = 0; r < p.repeat; r++) {
    for (const f of p.audf) {
      for (let t = 0; t < p.on; t++) out.push([reg(f, DIST_PURE, p.volume)]);
      for (let t = 0; t < p.off; t++) out.push([OFF]);
    }
  }
  return out;
}

/** Photon launched: white-noise whoosh with a rising envelope plus a falling tone, 0.4 s. */
export function photonProgram(): Program {
  const n = 24;
  const out: Tick[] = [];
  for (let t = 0; t < n; t++) {
    const k = t / (n - 1);
    // Noise swells to full, then cuts in the last 3 TICKs.
    const noiseVol = t < n - 3 ? 3 + 12 * k : 15 * (n - t) / 4;
    // The tone falls: AUDF climbs $14 → $70 (≈1520 → 570 Hz) while it fades.
    out.push([reg(0x06 + 4 * k, DIST_NOISE, noiseVol), reg(0x14 + 0x5c * k, DIST_PURE, 10 * (1 - k))]);
  }
  return out;
}

/** Zylon explosion: a tone sweep turning into loud noise, 0.8 s. */
export function zylonExplosionProgram(): Program {
  const n = 48;
  const out: Tick[] = [];
  for (let t = 0; t < n; t++) {
    if (t < 10) {
      // Sweep down from $10 to $60 while the noise starts underneath.
      const k = t / 9;
      out.push([reg(0x10 + 0x50 * k, DIST_PURE, 12), reg(0x20, DIST_NOISE, 4 + 11 * k)]);
    } else {
      const k = (t - 10) / (n - 11);
      out.push([reg(0x30 + 0x60 * k, DIST_NOISE, 15 * (1 - k) ** 1.3), reg(0x18 + 0x40 * k, DIST_NOISE, 12 * (1 - k) ** 2)]);
    }
  }
  return out;
}

/** Shield explosion (we are hit, a starbase dies): a heavier, lower noise burst, 1 s. */
export function shieldExplosionProgram(): Program {
  const n = 60;
  const out: Tick[] = [];
  for (let t = 0; t < n; t++) {
    const k = t / (n - 1);
    out.push([reg(0xa0 + 0x50 * k, DIST_NOISE, 15 * (1 - k) ** 0.8), reg(0x40 + 0x40 * k, DIST_NOISE, 13 * (1 - k) ** 1.5)]);
  }
  return out;
}

/** Starship explosion (our ship destroyed): 1 s of random-pitch noise and tone, TICK by TICK. */
export function starshipExplosionProgram(randomByte: () => number): Program {
  const n = 60;
  const out: Tick[] = [];
  for (let t = 0; t < n; t++) {
    const k = t / (n - 1);
    const vol = 15 - 11 * k;
    out.push([reg(randomByte(), t & 1 ? DIST_PURE : DIST_NOISE, vol), reg(0x80 | randomByte(), DIST_NOISE, vol)]);
  }
  return out;
}

/** The one-shot programs (the starship explosion is rendered fresh each time). */
export function programFor(event: SoundEvent, randomByte: () => number): Program {
  switch (event) {
    case 'photon':
      return photonProgram();
    case 'zylonExplosion':
      return zylonExplosionProgram();
    case 'shieldExplosion':
      return shieldExplosionProgram();
    case 'starshipExplosion':
      return starshipExplosionProgram(randomByte);
    default:
      return beeperProgram(BEEP_PATTERNS[event]);
  }
}

/** Highest velocity the engines can reach: hyperwarp's 254 KM/loop (§17.5). */
const MAX_VELOCITY = 254;

/**
 * Engines (§17.12): "continuous noise rumble, pitch and volume rise with speed, silent at 0".
 * Velocity in KM per game loop (§17.1 VELOCITYTAB 0…112; 254 in hyperwarp). The rumble is
 * noise; AUDF falls (pitch rises) and the volume rises on a log scale of the velocity, so
 * every speed key sounds different.
 */
export function engineRegs(velocity: number): Reg {
  const v = Math.max(0, Math.min(MAX_VELOCITY, velocity));
  if (v <= 0) return { audf: 0xff, audc: DIST_NOISE };
  const k = Math.log2(1 + v) / Math.log2(1 + MAX_VELOCITY);
  return reg(0xf0 - 0xc8 * k, DIST_NOISE, 2 + 9 * k);
}

/** POKEY's 17-bit polynomial counter (x^17 + x^12 + 1), one step per call. */
export class Poly17 {
  private state: number;
  constructor(seed = 0x1ffff) {
    this.state = seed & 0x1ffff || 1;
  }
  next(): number {
    const bit = ((this.state >> 16) ^ (this.state >> 11)) & 1;
    this.state = ((this.state << 1) | bit) & 0x1ffff;
    return bit;
  }
}

/** Output gain per volume step: four channels at 15 stay inside ±1. */
const CHANNEL_GAIN = 0.22;

/**
 * Render a program to mono samples (bipolar, ±CHANNEL_GAIN·vol/15 per channel). Each channel
 * keeps its divider phase and output bit across TICKs, as the hardware does.
 */
export function renderProgram(program: Program, sampleRate: number, poly = new Poly17()): Float32Array {
  const perTick = sampleRate * TICK_SECONDS;
  const total = Math.ceil(program.length * perTick);
  const out = new Float32Array(total);
  const channels = program.reduce((n, t) => Math.max(n, t.length), 0);
  const step = POKEY_CLOCK_64K / sampleRate;
  const phase = new Float64Array(channels);
  const bit = new Int8Array(channels).fill(1);
  for (let i = 0; i < total; i++) {
    const tick = program[Math.min(program.length - 1, Math.floor(i / perTick))];
    let s = 0;
    for (let c = 0; c < tick.length; c++) {
      const r = tick[c];
      const vol = r.audc & 0x0f;
      if (!vol) continue;
      const period = r.audf + 1;
      phase[c] += step;
      while (phase[c] >= period) {
        phase[c] -= period;
        bit[c] = (r.audc & 0xf0) === DIST_PURE ? (bit[c] ^ 1) as 0 | 1 : (poly.next() as 0 | 1);
      }
      s += (bit[c] ? 1 : -1) * vol;
    }
    out[i] = (s / 15) * CHANNEL_GAIN;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Web Audio player
// ---------------------------------------------------------------------------------------------

export type Voice = 'beeper' | 'photon' | 'explosion';

/** Which voice plays an event, and its priority there (higher cuts lower, equal restarts). */
export const EVENT_VOICE: Readonly<Record<SoundEvent, { voice: Voice; priority: number }>> = {
  photon: { voice: 'photon', priority: 0 },
  zylonExplosion: { voice: 'explosion', priority: 1 },
  shieldExplosion: { voice: 'explosion', priority: 2 },
  starshipExplosion: { voice: 'explosion', priority: 3 },
  hyperwarpTransit: { voice: 'beeper', priority: BEEP_PRIORITY.hyperwarpTransit },
  redAlert: { voice: 'beeper', priority: BEEP_PRIORITY.redAlert },
  acknowledge: { voice: 'beeper', priority: BEEP_PRIORITY.acknowledge },
  damageReport: { voice: 'beeper', priority: BEEP_PRIORITY.damageReport },
  starbaseMessage: { voice: 'beeper', priority: BEEP_PRIORITY.starbaseMessage },
};

/** Bend 8: the widest a sound is panned (headphones; never one ear only). */
export const MAX_PAN = 0.7;

/** Pan for an object at ship-frame x, z (KM), as it appears on screen in the Front or Aft view. */
export function panFor(x: number, z: number, aft: boolean): number {
  const angle = Math.atan2(x, Math.abs(z) + 256) / (Math.PI / 2); // −1 … +1
  const p = Math.max(-1, Math.min(1, angle * 1.6)) * MAX_PAN;
  return aft ? -p : p;
}

/** Pan of a photon leaving barrel 0 (left) or 1 (right). The Aft view mirrors the screen. */
export function barrelPan(barrel: number, aft: boolean): number {
  const p = (barrel ? 1 : -1) * 0.45;
  return aft ? -p : p;
}

/** Volume setting 0–10 to a master gain (roughly even loudness steps). */
export function volumeGain(volume: number): number {
  const v = Math.max(0, Math.min(10, volume)) / 10;
  return 0.9 * v * v;
}

export type PlayResult = 'played' | 'dropped' | 'silent';

export interface SoundLogEntry {
  /** Running number of the request. */
  n: number;
  event: SoundEvent;
  voice: Voice;
  priority: number;
  /** played: on its voice; dropped: a higher-priority sound was playing; silent: no audio yet. */
  result: PlayResult;
  pan: number;
  /** AudioContext time it starts (s), or null when silent. */
  at: number | null;
  muted: boolean;
}

export interface SynthOptions {
  /** Use this context (e.g. an OfflineAudioContext) instead of creating one; no unlock listeners. */
  context?: BaseAudioContext;
  /** How to make the live context (default `new AudioContext()`). */
  createContext?: () => BaseAudioContext;
  /** Where to listen for the unlocking key press, click or tap (default window). */
  unlockTarget?: EventTarget | null;
  /** Whether the page has had a user gesture already (default navigator.userActivation). */
  hasBeenActive?: () => boolean;
  volume?: number;
  muted?: boolean;
  /** Random bytes for the starship explosion (default: an own stream from the game seed). */
  randomByte?: () => number;
}

interface Playing {
  source: AudioBufferSourceNode;
  priority: number;
  event: SoundEvent;
  end: number;
}

const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click'] as const;
const ENGINE_BASE_AUDF = 0x60;

export class PokeySynth {
  private ctx: BaseAudioContext | null = null;
  private readonly ownsContext: boolean;
  private readonly createContext: () => BaseAudioContext;
  private master: GainNode | null = null;
  private bus: AudioNode | null = null;
  private readonly playing: Partial<Record<Voice, Playing>> = {};
  private readonly buffers = new Map<SoundEvent, AudioBuffer>();
  private engineSource: AudioBufferSourceNode | null = null;
  private engineGain: GainNode | null = null;
  private engineReg: Reg = engineRegs(0);
  private volume: number;
  private muted: boolean;
  private paused = false;
  private disposed = false;
  private readonly unlockTarget: EventTarget | null;
  private readonly randomByte: () => number;
  private requestCount = 0;

  /** Every request, newest last (the last 256), for the debug hook and tests. */
  public readonly log: SoundLogEntry[] = [];
  /** Requests per event since the synth was made. */
  public readonly counts: Record<SoundEvent, number> = Object.fromEntries(SOUND_EVENTS.map((e) => [e, 0])) as Record<SoundEvent, number>;
  /** Contexts this synth has made (0 or 1). */
  public contextsCreated = 0;

  constructor(opts: SynthOptions = {}) {
    this.volume = opts.volume ?? 7;
    this.muted = opts.muted ?? false;
    const rng = createRng(getSeed() ^ 0x9e6b);
    this.randomByte = opts.randomByte ?? (() => Math.floor(rng() * 256));
    this.createContext = opts.createContext ?? (() => new AudioContext({ latencyHint: 'interactive' }));
    this.ownsContext = !opts.context;
    this.unlockTarget = opts.context ? null : opts.unlockTarget === undefined ? (typeof window !== 'undefined' ? window : null) : opts.unlockTarget;
    if (opts.context) {
      this.attach(opts.context);
      return;
    }
    for (const type of UNLOCK_EVENTS) this.unlockTarget?.addEventListener(type, this.unlock, { capture: true, passive: true });
    const active =
      opts.hasBeenActive ??
      (() => typeof navigator !== 'undefined' && !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive);
    // A restart happens inside the START key press: the page is already unlocked.
    if (active()) this.unlock();
  }

  /** The context, once unlocked (null before the first key press or tap). */
  get context(): BaseAudioContext | null {
    return this.ctx;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get currentVolume(): number {
    return this.volume;
  }

  /** The first key press, click or tap makes (or resumes) the context. */
  public readonly unlock = (): void => {
    if (this.disposed) return;
    if (!this.ctx) {
      let ctx: BaseAudioContext;
      try {
        ctx = this.createContext();
      } catch {
        return; // no Web Audio: the game plays silently
      }
      this.contextsCreated++;
      this.attach(ctx);
      // iOS starts a context only once something plays inside the gesture.
      const blip = ctx.createBufferSource();
      blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      blip.connect(ctx.destination);
      blip.start();
    }
    const live = this.ctx as AudioContext | null;
    if (live && live.state === 'suspended' && !this.paused && typeof live.resume === 'function') void live.resume().catch(() => {});
  };

  private attach(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : volumeGain(this.volume);
    // Headphones: soften POKEY's raw square edges a little.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    lp.Q.value = 0.5;
    lp.connect(this.master);
    this.master.connect(ctx.destination);
    this.bus = lp;
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private bufferFor(event: SoundEvent): AudioBuffer {
    const ctx = this.ctx!;
    const cached = this.buffers.get(event);
    if (cached) return cached;
    const samples = renderProgram(programFor(event, this.randomByte), ctx.sampleRate);
    const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buf.getChannelData(0).set(samples);
    // The starship explosion's pitches are random each time.
    if (event !== 'starshipExplosion') this.buffers.set(event, buf);
    return buf;
  }

  /**
   * Play an event on its voice. `pan` −1 (left) … +1 (right); `when` an AudioContext time
   * (default now). A lower-priority event is dropped while a higher one still plays.
   */
  public play(event: SoundEvent, opts: { pan?: number; when?: number } = {}): PlayResult {
    const { voice, priority } = EVENT_VOICE[event];
    const pan = Math.max(-MAX_PAN, Math.min(MAX_PAN, opts.pan ?? 0));
    this.counts[event]++;
    const entry: SoundLogEntry = { n: ++this.requestCount, event, voice, priority, result: 'silent', pan, at: null, muted: this.muted };
    this.pushLog(entry);
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.disposed) return 'silent';
    const when = Math.max(opts.when ?? this.now(), this.now());
    const cur = this.playing[voice];
    if (cur && cur.end > when && priority < cur.priority) {
      entry.result = 'dropped';
      return 'dropped';
    }
    if (cur) this.stopSource(cur.source, when);
    const source = ctx.createBufferSource();
    source.buffer = this.bufferFor(event);
    let out: AudioNode = source;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      source.connect(panner);
      out = panner;
    }
    out.connect(this.bus);
    source.start(when);
    const end = when + source.buffer!.duration;
    const playing: Playing = { source, priority, event, end };
    this.playing[voice] = playing;
    source.onended = () => {
      if (this.playing[voice] === playing) delete this.playing[voice];
      out.disconnect();
      if (out !== source) source.disconnect();
    };
    entry.result = 'played';
    entry.at = when;
    return 'played';
  }

  private stopSource(source: AudioBufferSourceNode, when: number): void {
    try {
      source.stop(when);
    } catch {
      // already stopped
    }
  }

  private pushLog(e: SoundLogEntry): void {
    this.log.push(e);
    if (this.log.length > 256) this.log.shift();
  }

  /** Engines: call every game loop with the ship's velocity (KM/loop); 0 is silent. */
  public engine(velocity: number, when?: number): void {
    const r = engineRegs(velocity);
    if (r.audf === this.engineReg.audf && r.audc === this.engineReg.audc) return;
    this.engineReg = r;
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.disposed) return;
    const vol = r.audc & 0x0f;
    const t = Math.max(when ?? this.now(), this.now());
    if (!this.engineSource) {
      if (!vol) return;
      // Two seconds of POKEY noise at a middle AUDF, looped; other AUDFs scale its rate.
      const samples = renderProgram(Array.from({ length: 120 }, () => [reg(ENGINE_BASE_AUDF, DIST_NOISE, 15)]), ctx.sampleRate, new Poly17(0x0abcd));
      const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buf.getChannelData(0).set(samples);
      this.engineSource = ctx.createBufferSource();
      this.engineSource.buffer = buf;
      this.engineSource.loop = true;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineSource.connect(this.engineGain);
      this.engineGain.connect(this.bus);
      this.engineSource.start(t);
    }
    // The ROM's engine rumble sits under everything else.
    this.engineSource.playbackRate.setTargetAtTime((ENGINE_BASE_AUDF + 1) / (r.audf + 1), t, 0.03);
    this.engineGain!.gain.setTargetAtTime((vol / 15) * 0.55, t, 0.03);
  }

  /** The engines' registers now: AUDF and volume (0 = silent). */
  get engineLevel(): { audf: number; volume: number } {
    return { audf: this.engineReg.audf, volume: this.engineReg.audc & 0x0f };
  }

  /** Stop a voice now (the end sequence keeps the explosion, drops beeps and the whoosh). */
  public stop(voice: Voice): void {
    const cur = this.playing[voice];
    if (!cur) return;
    this.stopSource(cur.source, this.now());
    delete this.playing[voice];
  }

  /** What each voice is playing now (for the debug hook). */
  public voices(): Partial<Record<Voice, SoundEvent>> {
    const out: Partial<Record<Voice, SoundEvent>> = {};
    const now = this.now();
    for (const v of ['beeper', 'photon', 'explosion'] as const) {
      const p = this.playing[v];
      if (p && p.end > now) out[v] = p.event;
    }
    return out;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(10, Math.round(volume)));
    this.applyMaster();
  }

  /** Mute silences everything at once (master gain to 0 now, not ramped). */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMaster();
  }

  private applyMaster(): void {
    if (!this.master || !this.ctx) return;
    const g = this.master.gain;
    const t = this.now();
    g.cancelScheduledValues(t);
    g.setValueAtTime(this.muted ? 0 : volumeGain(this.volume), t);
    g.value = this.muted ? 0 : volumeGain(this.volume);
  }

  /** P: freeze every sound where it is; it goes on when the game does. */
  public setPaused(paused: boolean): void {
    this.paused = paused;
    const ctx = this.ctx as AudioContext | null;
    if (!ctx || !this.ownsContext) return;
    if (paused && ctx.state === 'running') void ctx.suspend?.().catch(() => {});
    if (!paused && ctx.state === 'suspended') void ctx.resume?.().catch(() => {});
  }

  /** Close the context and drop the listeners: nothing of this synth keeps playing. */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const type of UNLOCK_EVENTS) this.unlockTarget?.removeEventListener(type, this.unlock, { capture: true });
    for (const v of ['beeper', 'photon', 'explosion'] as const) this.stop(v);
    if (this.engineSource) this.stopSource(this.engineSource, this.now());
    this.engineSource = null;
    this.master?.disconnect();
    const ctx = this.ctx as AudioContext | null;
    if (ctx && this.ownsContext && typeof ctx.close === 'function' && ctx.state !== 'closed') void ctx.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.buffers.clear();
  }
}
