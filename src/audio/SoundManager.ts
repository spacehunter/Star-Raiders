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
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
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

  /**
   * Play hyperwarp sound - rising sweep
   */
  public playHyperwarp(): void {
    if (!this.audioContext || !this.masterGain) return;

    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(100, this.audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(2000, this.audioContext.currentTime + 2);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(102, this.audioContext.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(2010, this.audioContext.currentTime + 2);

    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 1);
    gain.gain.linearRampToValueAtTime(0.01, this.audioContext.currentTime + 2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    osc1.stop(this.audioContext.currentTime + 2);
    osc2.stop(this.audioContext.currentTime + 2);
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

  /**
   * Play alert sound - warning beep
   */
  public playAlert(): void {
    if (!this.audioContext || !this.masterGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'square';
    osc.frequency.value = 880;

    gain.gain.setValueAtTime(0, this.audioContext.currentTime);

    // Beep pattern
    for (let i = 0; i < 3; i++) {
      const t = this.audioContext.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.setValueAtTime(0, t + 0.08);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.5);
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
