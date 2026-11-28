/**
 * Part 4 bend 6: the debrief card's score breakdown (MANUAL_SPEC §14.1, §14.2, §17.10).
 *
 * Every line is one term of the ROM's running score plus M, so the lines always add up to the
 * total the rank came from:
 *
 *   total = M + 6·kills − energy points − fleet move ticks − 18·starbases lost − 3·starbases shot
 *
 * "Energy points" are the −1 per 100 units used (§17.10: only the tens-digit borrows count, so the
 * figure can differ from units/100 by a little). "Time" is the −1 per fleet move tick, the
 * manual's time/100 (one tick per 0.50 star date after the first 1.00).
 */
import type { MissionRating } from './rating';
import type { MissionScore } from './rating';

export interface DebriefLine {
  label: string;
  /** What was counted, as shown (e.g. "12 X 6", "3456 UNITS", "04.10"). */
  detail: string;
  points: number;
}

export interface Debrief {
  rating: MissionRating;
  lines: DebriefLine[];
  total: number;
  kills: number;
  energyUnits: number;
  starDate: string;
  starbasesLost: number;
  starbasesShot: number;
}

export interface DebriefInput {
  rating: MissionRating;
  score: Pick<MissionScore, 'zylonsDestroyed' | 'energyPoints' | 'fleetMoveTicks' | 'starbasesDestroyedByZylons' | 'starbasesShotByYou'>;
  /** Units of energy taken over the mission (EnergySim.unitsUsed). */
  energyUnits: number;
  /** STAR DATE at the end, NN.NN. */
  starDate: string;
}

/** How the mission ended, as the card's heading shows it. */
export const OUTCOME_LABEL: Record<MissionRating['outcome'], string> = {
  complete: 'MISSION COMPLETE',
  zeroEnergy: 'MISSION ABORTED',
  aborted: 'MISSION ABORTED',
  destroyed: 'STARSHIP DESTROYED',
};

export function buildDebrief({ rating, score, energyUnits, starDate }: DebriefInput): Debrief {
  const lines: DebriefLine[] = [
    { label: 'MISSION BONUS M', detail: rating.level, points: rating.bonus },
    { label: 'ZYLONS DESTROYED', detail: `${score.zylonsDestroyed} X 6`, points: 6 * score.zylonsDestroyed },
    { label: 'ENERGY USED', detail: `${Math.floor(energyUnits)} ${Math.floor(energyUnits) === 1 ? 'UNIT' : 'UNITS'}`, points: -score.energyPoints },
    { label: 'TIME (STAR DATE)', detail: starDate, points: -score.fleetMoveTicks },
    { label: 'STARBASES LOST', detail: `${score.starbasesDestroyedByZylons} X 18`, points: -18 * score.starbasesDestroyedByZylons },
    { label: 'BASES YOU SHOT', detail: `${score.starbasesShotByYou} X 3`, points: -3 * score.starbasesShotByYou },
  ];
  return {
    rating,
    lines,
    total: lines.reduce((t, l) => t + l.points, 0),
    kills: score.zylonsDestroyed,
    energyUnits: Math.floor(energyUnits),
    starDate,
    starbasesLost: score.starbasesDestroyedByZylons,
    starbasesShot: score.starbasesShotByYou,
  };
}
