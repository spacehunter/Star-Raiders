/**
 * Offline render of every §17.12 sound in order, through the same PokeySynth the game uses
 * (an OfflineAudioContext instead of a live one). For evidence and the ?debug=1 hook
 * (`__sr.audioDemo()`): returns a stereo 16-bit WAV (base64), the timeline and the loudness of
 * each segment.
 */
import { VELOCITY_TAB } from '../rules/speed';
import { PokeySynth, type SoundEvent } from './pokey';

export interface DemoCue {
  t: number;
  /** A §17.12 event, an engine velocity, or 'mute'. */
  what: SoundEvent | `engines v=${number}` | 'mute';
  pan?: number;
}

/** The demo's cues: engines up through every speed key and hyperwarp, then each event, then mute. */
export function demoCues(): DemoCue[] {
  const cues: DemoCue[] = [];
  let t = 0.2;
  for (const v of VELOCITY_TAB.slice(1)) {
    cues.push({ t, what: `engines v=${v}` });
    t += 0.45;
  }
  cues.push({ t, what: 'engines v=254' }); // hyperwarp
  t += 0.8;
  cues.push({ t, what: 'engines v=0' }); // silent at 0
  t += 0.6;
  const events: Array<[SoundEvent, number, number]> = [
    ['photon', -0.45, 0.6], // left barrel
    ['photon', 0.45, 0.8], // right barrel
    ['zylonExplosion', 0.35, 1.2],
    ['shieldExplosion', 0, 1.4],
    ['starshipExplosion', 0, 1.5],
    ['hyperwarpTransit', 0, 1.7],
    ['redAlert', 0, 2.5],
    ['acknowledge', 0, 0.7],
    ['damageReport', 0, 1.1],
    ['starbaseMessage', 0, 1.2],
  ];
  for (const [what, pan, gap] of events) {
    cues.push({ t, what, pan });
    t += gap;
  }
  // Mute in the middle of a red alert: everything stops at once.
  cues.push({ t, what: 'redAlert' });
  cues.push({ t: t + 0.6, what: 'mute' });
  return cues;
}

function wavBase64(buf: AudioBuffer): string {
  const ch = Math.min(2, buf.numberOfChannels);
  const n = buf.length;
  const bytes = new Uint8Array(44 + n * ch * 2);
  const dv = new DataView(bytes.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface DemoResult {
  wav: string;
  sampleRate: number;
  seconds: number;
  cues: DemoCue[];
  /** RMS of each cue's segment (to the next cue), left and right. */
  rms: Array<{ t: number; what: string; left: number; right: number }>;
  log: PokeySynth['log'];
}

export async function renderAudioDemo(sampleRate = 44100): Promise<DemoResult> {
  const cues = demoCues();
  const seconds = cues[cues.length - 1].t + 1.2;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const synth = new PokeySynth({ context: ctx, volume: 7 });
  // Mute must land at its exact time, so the render runs in pieces with suspend().
  const muteAt = cues.find((c) => c.what === 'mute')!.t;
  for (const c of cues) {
    if (c.what === 'mute') continue;
    const v = /^engines v=(\d+)$/.exec(c.what);
    if (v) {
      synth.engine(Number(v[1]), c.t);
      continue;
    }
    synth.play(c.what as SoundEvent, { pan: c.pan, when: c.t });
  }
  const quantum = 128 / sampleRate;
  void ctx.suspend(Math.round(muteAt / quantum) * quantum).then(() => {
    synth.setMuted(true);
    void ctx.resume();
  });
  const out = await ctx.startRendering();
  const rms = cues.map((c, i) => {
    const end = i + 1 < cues.length ? cues[i + 1].t : seconds;
    // Mute lands on the 128-sample render quantum at or after its cue: measure from 6 ms on.
    const a = Math.floor((c.what === 'mute' ? c.t + 0.006 : c.t) * sampleRate);
    const b = Math.min(out.length, Math.floor(end * sampleRate));
    const r = (ch: Float32Array) => {
      let s = 0;
      for (let k = a; k < b; k++) s += ch[k] * ch[k];
      return Math.round(Math.sqrt(s / Math.max(1, b - a)) * 10000) / 10000;
    };
    return { t: c.t, what: c.what, left: r(out.getChannelData(0)), right: r(out.getChannelData(1)) };
  });
  return { wav: wavBase64(out), sampleRate, seconds, cues, rms, log: synth.log };
}
