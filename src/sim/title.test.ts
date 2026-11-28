import { describe, expect, it } from 'vitest';
import { TitleLine } from './title';
import {
  PHRASE,
  TITLE_COLUMNS,
  TITLE_LONG_LOOPS,
  TITLE_SEGMENT_LOOPS,
  endOfMissionPhrase,
  subsystemPhrase,
  type Phrase,
} from '../rules/messages';
import { SUBSYSTEMS } from '../rules/damage';
import { rateMission } from './rating';

/** Text on the line after each of `n` loops ('' = blank segment, null = hidden). */
function timeline(t: TitleLine, n: number): Array<string | null> {
  const out: Array<string | null> = [];
  for (let i = 0; i < n; i++) {
    t.loop();
    out.push(t.text === null ? null : t.text.trim());
  }
  return out;
}

const runs = (xs: Array<string | null>) => {
  const r: Array<[string | null, number]> = [];
  for (const x of xs) {
    const last = r[r.length - 1];
    if (last && last[0] === x) last[1]++;
    else r.push([x, 1]);
  }
  return r;
};

// MANUAL_SPEC §18.1, §17.3, §17.5, §17.10; R: UPDTITLE / SETTITLE.
describe('title line timing', () => {
  it('constants are the ROM lifetimes: 60 loops a segment, 254 for the long phrases', () => {
    expect(TITLE_SEGMENT_LOOPS).toBe(60);
    expect(TITLE_LONG_LOOPS).toBe(254);
  });

  it('shows a one-segment phrase for 60 loops, then hides the line', () => {
    const t = new TitleLine();
    t.set(PHRASE.SHIELDS_ON);
    expect(t.text).toBe('SHIELDS ON');
    expect(runs(timeline(t, 100))).toEqual([
      ['SHIELDS ON', 59],
      [null, 41],
    ]);
  });

  it('long phrases stay 254 loops', () => {
    for (const p of [PHRASE.STARBASE_SURROUNDED, PHRASE.STARBASE_DESTROYED, PHRASE.HYPERSPACE, PHRASE.RED_ALERT]) {
      const t = new TitleLine();
      t.set(p);
      const r = runs(timeline(t, 300));
      expect(r[0][1] + 1).toBe(254);
      expect(r[1][0]).toBeNull();
    }
  });

  it('shows a phrase one segment at a time: ORBIT ESTABLISHED, then STANDBY', () => {
    const t = new TitleLine();
    t.set(PHRASE.ORBIT_ESTABLISHED);
    expect(runs([t.text, ...timeline(t, 150)])).toEqual([
      ['ORBIT ESTABLISHED', 60],
      ['STANDBY', 60],
      [null, 31],
    ]);
  });

  it('a new phrase replaces the current one at once', () => {
    const t = new TitleLine();
    t.set(PHRASE.HYPERWARP_COMPLETE);
    timeline(t, 10);
    t.set(PHRASE.RED_ALERT);
    expect(t.text).toBe('    RED ALERT');
    expect(t.lifeLeft).toBe(254);
  });

  it('a queued phrase waits for the line to go blank, starts the next loop, and keeps repeating', () => {
    const t = new TitleLine();
    t.set(PHRASE.DAMAGE_CONTROL);
    t.enqueue(subsystemPhrase('photons', 'damaged'));
    const r = runs([t.text === null ? null : t.text.trim(), ...timeline(t, 60 * 2 + 1 + 60 * 2 + 1 + 59)]);
    expect(r).toEqual([
      ['', 60], // blank segment
      ['DAMAGE CONTROL', 60],
      [null, 1],
      ['PHOTONS DAMAGED', 60],
      ['', 60],
      [null, 1],
      ['PHOTONS DAMAGED', 60], // NEWTITLEPHR is never cleared: it comes back
    ]);
  });

  it('docking empties the queue', () => {
    const t = new TitleLine();
    t.enqueue(subsystemPhrase('engines', 'destroyed'));
    t.loop();
    expect(t.text).toBe('ENGINES DESTROYED');
    t.set(PHRASE.ORBIT_ESTABLISHED);
    t.clearQueue();
    expect(timeline(t, 400).filter((x) => x === 'ENGINES DESTROYED')).toHaveLength(0);
  });
});

describe('ROM phrases', () => {
  const all: Phrase[] = [
    ...Object.values(PHRASE).flatMap((p) => (Array.isArray(p) ? [p as Phrase] : Object.values(p as Record<string, Phrase>))),
    ...SUBSYSTEMS.flatMap((s) => [subsystemPhrase(s, 'damaged'), subsystemPhrase(s, 'destroyed')]),
  ];

  it('every segment fits the 20-character title line', () => {
    for (const p of all) for (const s of p) expect(s.text.length, s.text).toBeLessThanOrEqual(TITLE_COLUMNS);
  });

  it('keeps the ROM words and their leading spaces', () => {
    expect(PHRASE.RED_ALERT[0].text).toBe('    RED ALERT');
    expect(PHRASE.STAR_RAIDERS.map((s) => s.text)).toEqual(['   STAR RAIDERS', 'COPYRIGHT ATARI 1979']);
    expect(subsystemPhrase('sectorScan', 'damaged').map((s) => s.text)).toEqual(['SECTOR SCAN', 'DAMAGED']);
    expect(subsystemPhrase('radio', 'destroyed').map((s) => s.text)).toEqual(['SUB-SPACE RADIO', 'DESTROYED']);
  });

  it('the end sequence starts on a blank segment and shows each line for 60 loops, then repeats', () => {
    const rating = rateMission('NOVICE', 'complete', 90);
    const t = new TitleLine();
    t.enqueue(endOfMissionPhrase('complete', rating.messages));
    const seen = runs(timeline(t, 9 * 61)).map(([x]) => x);
    expect(seen.slice(0, 9)).toEqual(['', 'STAR FLEET TO', 'STAR CRUISER 7', 'MISSION COMPLETE', 'NEW RANK IS:', rating.rank, `CLASS ${rating.classNumber}`, 'CONGRATULATIONS', null]);
    expect(seen[9]).toBe('');
    const destroyed = endOfMissionPhrase('destroyed', rateMission('NOVICE', 'destroyed', 0).messages);
    expect(destroyed[destroyed.length - 1].text).toBe(' ');
  });
});
