import { describe, expect, it } from 'vitest';
import { MissionScore, endOfMissionMessages, manualFormulaScore, rankAndClass, rateMission } from './rating';
import { EnergySim } from './energy';

/** ROM GAMEOVER quick-lookup table: [rank index, rank, first scores per class index]. */
const ROM_TABLE: Array<[string, number[]]> = [
  ['GALACTIC COOK', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
  ['GARBAGE SCOW CAPTAIN', [16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46]],
  ['ROOKIE', [48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78]],
  ['NOVICE', [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110]],
  ['ENSIGN', [112, 114, 116, 118, 120, 122, 124, 126, 128, 130, 132, 134, 136, 138, 140, 142]],
  ['PILOT', [144, 146, 148, 150, 152, 154, 156, 158, 160, 162, 164, 166, 168, 170, 172, 174]],
  ['ACE', [176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191]],
  ['LIEUTENANT', [192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207]],
  ['WARRIOR', [208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223]],
  ['CAPTAIN', [224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239]],
  ['COMMANDER', [240, 242, 244, 246, 248, 250, 252, 254, 256, 258, 260, 262, 264, 266, 268, 270]],
  ['STAR COMMANDER', [272, 274, 276, 278, 280, 282, 284, 286, 288, 290, 292, 294, 296, 298, 300, 302]],
];
const CLASS_BY_INDEX = [5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1];

describe('§14.3 / §17.10 rank and class', () => {
  it('score 90 is NOVICE class 4', () => {
    expect(rankAndClass(90)).toMatchObject({ rank: 'NOVICE', classNumber: 4 });
  });

  it('score 161 is PILOT class 3', () => {
    expect(rankAndClass(161)).toMatchObject({ rank: 'PILOT', classNumber: 3 });
  });

  it('reproduces the ROM quick-lookup table for every score 0..303', () => {
    for (const [rank, starts] of ROM_TABLE) {
      starts.forEach((start, classIndex) => {
        const width = (starts[1] - starts[0]);
        for (let s = start; s < start + width; s++) {
          expect(rankAndClass(s), `score ${s}`).toMatchObject({ rank, classIndex, classNumber: CLASS_BY_INDEX[classIndex] });
        }
      });
    }
  });

  it('classes split each manual rank into five near-equal parts, 5 lowest to 1 highest', () => {
    const r = (s: number) => rankAndClass(s).classNumber;
    expect([80, 86, 92, 99, 105, 111].map(r)).toEqual([5, 4, 4, 3, 2, 1]);
    expect([176, 179, 182, 185, 189, 191].map(r)).toEqual([5, 4, 4, 3, 1, 1]);
  });

  it('304 and above is STAR COMMANDER class 1; below zero is GALACTIC COOK class 5', () => {
    expect(rankAndClass(304)).toMatchObject({ rank: 'STAR COMMANDER', classNumber: 1 });
    expect(rankAndClass(999)).toMatchObject({ rank: 'STAR COMMANDER', classNumber: 1 });
    expect(rankAndClass(-40)).toMatchObject({ rank: 'GALACTIC COOK', classNumber: 5 });
  });

  it('gag ranks under 48', () => {
    expect(rankAndClass(10).rank).toBe('GALACTIC COOK');
    expect(rankAndClass(47).rank).toBe('GARBAGE SCOW CAPTAIN');
    expect(rankAndClass(48).rank).toBe('ROOKIE');
  });
});

describe('§14.1 / §17.10 running score', () => {
  it('+6 per Zylon, −3 per starbase shot, −18 per starbase lost, −1 per fleet tick and per 100 energy', () => {
    const s = new MissionScore();
    for (let i = 0; i < 10; i++) s.zylonDestroyed();
    s.starbaseShotByYou();
    s.starbaseDestroyedByZylons();
    s.fleetMoveTick();
    s.energyUsed(4);
    expect(s.score).toBe(60 - 3 - 18 - 1 - 4);
  });

  it('matches the manual formula with the M table', () => {
    const host = { energy: 9999 };
    const s = new MissionScore();
    const energy = new EnergySim(host, { onScoreLoss: (p) => s.energyUsed(p) });
    for (let i = 0; i < 237; i++) energy.firePhoton(); // 2370 units
    for (let i = 0; i < 27; i++) s.zylonDestroyed();
    s.starbaseDestroyedByZylons();
    const r = rateMission('NOVICE', 'complete', s.score);
    expect(r.total).toBe(
      manualFormulaScore({ level: 'NOVICE', outcome: 'complete', kills: 27, energyUsed: 2370, timeCentons: 0, starbasesLost: 1, starbasesShot: 0 })
    );
    expect(r.total).toBe(80 + 162 - 23 - 18);
  });

  it('M depends on level and outcome', () => {
    expect(rateMission('COMMANDER', 'complete', 0).bonus).toBe(111);
    expect(rateMission('COMMANDER', 'zeroEnergy', 0).bonus).toBe(100);
    expect(rateMission('COMMANDER', 'aborted', 0).bonus).toBe(100);
    expect(rateMission('PILOT', 'destroyed', 0).bonus).toBe(50);
  });
});

describe('§17.10 end-of-mission messages', () => {
  it('mission complete', () => {
    const r = rateMission('NOVICE', 'complete', 10);
    expect(r.title).toBe('NOVICE CLASS 4');
    expect(r.messages).toEqual([
      'STAR FLEET TO', 'STAR CRUISER 7', 'MISSION COMPLETE', 'NEW RANK IS:', 'NOVICE', 'CLASS 4', 'CONGRATULATIONS',
    ]);
  });

  it('zero energy', () => {
    expect(endOfMissionMessages('zeroEnergy', 'ROOKIE', 2)).toEqual([
      'STAR FLEET TO', 'STAR CRUISER 7', 'MISSION ABORTED', 'ZERO ENERGY', 'NEW RANK IS:', 'ROOKIE', 'CLASS 2',
      'REPORT TO BASE', 'FOR TRAINING',
    ]);
  });

  it('destroyed', () => {
    expect(rateMission('PILOT', 'destroyed', 111).messages).toEqual([
      'STAR FLEET TO', 'ALL UNITS', 'STAR CRUISER 7', 'DESTROYED', 'BY ZYLON FIRE', 'POSTHUMOUS RANK IS:', 'PILOT', 'CLASS 3',
    ]);
  });
});
