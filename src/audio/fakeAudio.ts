/**
 * A minimal stand-in for the Web Audio API, for unit tests of the synth (Node has no AudioContext).
 * It records what the synth builds: sources started and stopped, gains and pans. Time only moves
 * when a test sets `currentTime`.
 */

class FakeParam {
  value: number;
  readonly events: Array<[string, number, number]> = [];
  constructor(v: number) {
    this.value = v;
  }
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push(['target', v, t]);
    this.value = v;
    return this;
  }
  cancelScheduledValues(t: number) {
    this.events.push(['cancel', 0, t]);
    return this;
  }
}

class FakeNode {
  readonly outputs = new Set<FakeNode>();
  readonly ctx: FakeAudioContext;
  readonly kind: string;
  constructor(ctx: FakeAudioContext, kind: string) {
    this.ctx = ctx;
    this.kind = kind;
  }
  connect(n: FakeNode) {
    this.outputs.add(n);
    return n;
  }
  disconnect() {
    this.outputs.clear();
  }
}

export class FakeSource extends FakeNode {
  buffer: { duration: number; length: number } | null = null;
  loop = false;
  playbackRate = new FakeParam(1);
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  start(t = 0) {
    this.startedAt = t;
    this.ctx.sources.push(this);
  }
  stop(t = 0) {
    this.stoppedAt = t;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' | 'closed' = 'running';
  readonly destination = new FakeNode(this, 'destination');
  readonly sources: FakeSource[] = [];
  readonly gains: Array<FakeNode & { gain: FakeParam }> = [];
  readonly panners: Array<FakeNode & { pan: FakeParam }> = [];
  createGain(): any {
    const g = Object.assign(new FakeNode(this, 'gain'), { gain: new FakeParam(1) });
    this.gains.push(g);
    return g;
  }
  createStereoPanner(): any {
    const p = Object.assign(new FakeNode(this, 'panner'), { pan: new FakeParam(0) });
    this.panners.push(p);
    return p;
  }
  createBiquadFilter(): any {
    return Object.assign(new FakeNode(this, 'filter'), { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1) });
  }
  createBufferSource(): any {
    return new FakeSource(this, 'source');
  }
  createBuffer(_ch: number, length: number, rate: number): any {
    const data = new Float32Array(length);
    return { length, duration: length / rate, sampleRate: rate, getChannelData: () => data };
  }
  async resume() {
    if (this.state !== 'closed') this.state = 'running';
  }
  async suspend() {
    if (this.state !== 'closed') this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
  }
  /** The master gain is the first gain node made. */
  get master(): FakeNode & { gain: FakeParam } {
    return this.gains[0];
  }
}
