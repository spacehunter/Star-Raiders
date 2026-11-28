import { random } from '../core/rng';

/**
 * SoundManager - Handles game audio using Web Audio API
 * Generates retro-style synthesized sound effects
 */
export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private volume: number = 0.3;

  constructor() {
    // Initialize audio context on first user interaction
    this.initOnInteraction();
  }

  /**
   * Initialize audio context on user interaction
   */
  private removeInitListeners: (() => void) | null = null;

  private initOnInteraction(): void {
    const init = () => {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.audioContext.destination);
      }
      document.removeEventListener('click', init);
      document.removeEventListener('keydown', init);
    };

    document.addEventListener('click', init);
    document.addEventListener('keydown', init);
    this.removeInitListeners = () => {
      document.removeEventListener('click', init);
      document.removeEventListener('keydown', init);
    };
  }

  /**
   * Set master volume (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Toggle mute
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    return this.muted;
  }

  /**
   * Play torpedo fire sound - short laser burst
   */
  public playTorpedoFire(): void {
    if (!this.audioContext || !this.masterGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  /**
   * Play explosion sound - noise burst
   */
  public playExplosion(): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start();
  }

  /** How many beeper patterns were asked for (for the debug hook). */
  public readonly beeperPatterns = { hyperwarpTransit: 0, redAlert: 0 };

  /**
   * A beeper pattern (R: BEEP): square-wave tones, `on` seconds each with `off` seconds of
   * silence, cycling through `freqs` for `count` tones.
   */
  private beeper(freqs: readonly number[], count: number, on: number, off: number): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0, t0);
    for (let i = 0; i < count; i++) {
      const t = t0 + i * (on + off);
      osc.frequency.setValueAtTime(freqs[i % freqs.length], t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.setValueAtTime(0, t + on);
    }
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + count * (on + off));
  }

  /** HYPERWARP TRANSIT on entering hyperspace: 1280 Hz beeps, 13× (MANUAL_SPEC §17.5, §17.12). */
  public playHyperwarpTransit(): void {
    this.beeperPatterns.hyperwarpTransit++;
    this.beeper([1280], 13, 0.05, 0.05);
  }

  /**
   * Play shields sound - short pulse
   */
  public playShields(): void {
    if (!this.audioContext || !this.masterGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.audioContext.currentTime);
    osc.frequency.setValueAtTime(880, this.audioContext.currentTime + 0.05);
    osc.frequency.setValueAtTime(440, this.audioContext.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.15);
  }

  /**
   * Play docking sound - success chime
   */
  public playDocking(): void {
    if (!this.audioContext || !this.masterGain) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const duration = 0.2;

    notes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = this.audioContext!.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /** RED ALERT on entering a Zylon sector: alternating ≈490/330 Hz, 8× (MANUAL_SPEC §9, §17.12). */
  public playAlert(): void {
    this.beeperPatterns.redAlert++;
    this.beeper([490, 330], 8, 0.15, 0.02);
  }

  /**
   * Play enemy fire sound - distinct from player torpedo
   */
  public playEnemyFire(): void {
    if (!this.audioContext || !this.masterGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    // Higher pitched, rising frequency - distinct from player's falling torpedo
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.08);
  }

  /** How many DAMAGE REPORT beeps were asked for (for the debug hook). */
  public damageReportBeeps = 0;

  /**
   * Hook for the DAMAGE REPORT beeper pattern (MANUAL_SPEC §17.12: ≈490→970 Hz, 3×; R: DAMAGE
   * L6826, BEEP $12). Silent until the POKEY synth arrives in Phase 12.
   */
  public playDamageReport(): void {
    this.damageReportBeeps++;
  }

  /**
   * Play player hit sound - impact with damage indication
   */
  public playPlayerHit(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Create noise burst for impact
    const bufferSize = this.audioContext.sampleRate * 0.15;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Low-pass filter for a heavy impact feel
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.15);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start();

    // Add a low thump oscillator for impact
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);

    oscGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  /**
   * Play shield hit sound - energy absorption crackle
   */
  public playShieldHit(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Create a short noise burst for the impact crackle
    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // High-pass filter for a crackly energy feel
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.1);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.25, this.audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    source.start();

    // Add a resonant sweep to suggest shield energy
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.15);

    oscGain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.15);
  }

  /**
   * Play engine hum - continuous tone based on speed
   */
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  public updateEngineSound(speed: number): void {
    if (!this.audioContext || !this.masterGain) return;

    if (speed === 0) {
      if (this.engineOsc) {
        this.engineGain?.gain.setValueAtTime(0, this.audioContext.currentTime);
      }
      return;
    }

    if (!this.engineOsc) {
      this.engineOsc = this.audioContext.createOscillator();
      this.engineGain = this.audioContext.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();
    }

    const baseFreq = 50 + speed * 10;
    this.engineOsc.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
    this.engineGain!.gain.setValueAtTime(0.05 + speed * 0.01, this.audioContext.currentTime);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // A game disposed before any key or click must not open an AudioContext later.
    this.removeInitListeners?.();
    this.removeInitListeners = null;
    if (this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc.disconnect();
      this.engineOsc = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
