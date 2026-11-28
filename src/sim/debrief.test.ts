import { describe, expect, it } from 'vitest';
import { buildDebrief } from './debrief';
import { MissionScore, rateMission } from './rating';

describe('bend 6 debrief breakdown (§14.1, §17.10)', () => {
  it('lines add up to the total the rank came from', () => {
    const s = new MissionScore();
    for (let i = 0; i < 9; i++) s.zylonDestroyed();
    s.energyUsed(23);
    for (let i = 0; i < 4; i++) s.fleetMoveTick();
    s.starbaseDestroyedByZylons();
    s.starbaseShotByYou();
    const rating = rateMission('PILOT', 'complete', s.score);
    const d = buildDebrief({ rating, score: s, energyUnits: 2345, starDate: '02.50' });
    expect(d.total).toBe(rating.total);
    expect(d.total).toBe(76 + 54 - 23 - 4 - 18 - 3);
    expect(d.lines.map((l) => l.points)).toEqual([76, 54, -23, -4, -18, -3]);
    expect(d.lines[2].detail).toBe('2345 UNITS');
    expect(d.lines[3].detail).toBe('02.50');
    expect(d).toMatchObject({ kills: 9, starbasesLost: 1, starbasesShot: 1 });
  });

  it('M follows the outcome column (§14.2)', () => {
    const s = new MissionScore();
    for (const [outcome, m] of [['complete', 80], ['zeroEnergy', 60], ['aborted', 60], ['destroyed', 40]] as const) {
      const d = buildDebrief({ rating: rateMission('NOVICE', outcome, 0), score: s, energyUnits: 0, starDate: '00.00' });
      expect(d.lines[0].points).toBe(m);
      expect(d.total).toBe(m);
    }
  });
});
