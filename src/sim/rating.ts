/**
 * Mission score and rating: MANUAL_SPEC §14 (formula, M table, ranks and classes) and
 * §17.10 (ROM GAMEOVER: running score, rank index from bits 8..4, class index, end sequences).
 */
import type { MissionLevel } from '../rules/levels';
import { CLASS_PLACEHOLDER, END_SEQUENCE, RANK_PLACEHOLDER } from '../rules/messages';
import type { MissionOutcome, Rank } from '../rules/rating';
import { CLASS_TAB, MAX_RANK_INDEX, RANK_TAB, SCORE, missionBonus } from '../rules/rating';

/** Running score kept during the mission (§17.10). The total adds M at the end. */
export class MissionScore {
  public score = 0;
  public zylonsDestroyed = 0;
  public starbasesShotByYou = 0;
  public starbasesDestroyedByZylons = 0;
  public fleetMoveTicks = 0;
  public energyPoints = 0;

  /** +6 per Zylon. */
  public zylonDestroyed(): void {
    this.zylonsDestroyed++;
    this.score += SCORE.zylonDestroyed;
  }

  /** −3 per starbase you shoot. */
  public starbaseShotByYou(): void {
    this.starbasesShotByYou++;
    this.score += SCORE.starbaseShotByYou;
  }

  /** −18 per starbase the Zylons destroy. */
  public starbaseDestroyedByZylons(): void {
    this.starbasesDestroyedByZylons++;
    this.score += SCORE.starbaseDestroyedByZylons;
  }

  /** −1 per fleet move tick (the manual's "time / 100"). */
  public fleetMoveTick(): void {
    this.fleetMoveTicks++;
    this.score += SCORE.fleetMoveTick;
  }

  /** −1 per 100 units of energy used. */
  public energyUsed(points = 1): void {
    this.energyPoints += points;
    this.score += SCORE.energy100Used * points;
  }
}

export interface RankAndClass {
  rankIndex: number;
  rank: Rank;
  classIndex: number;
  /** Class 1 (best) .. 5. */
  classNumber: number;
}

/**
 * ROM GAMEOVER rank and class from a total score. A negative total rates as rank 0, class
 * index 0 (GALACTIC COOK class 5); totals of 304 and up rate STAR COMMANDER class 1.
 */
export function rankAndClass(total: number): RankAndClass {
  let rankIndex = 0;
  let classIndex = 0;
  if (total >= 0) {
    let low = total & 0xff;
    rankIndex = total >> 4;
    if (rankIndex > MAX_RANK_INDEX) {
      rankIndex = MAX_RANK_INDEX;
      low = 15;
    }
    // Rank 0 and the single-bin ranks 11..14 take bits 3..0; the others bits 4..1 with bit 3 flipped.
    const fine = rankIndex === 0 || (rankIndex >= 11 && rankIndex <= 14);
    classIndex = (fine ? low : (low >> 1) ^ 0x08) & 0x0f;
  }
  return { rankIndex, rank: RANK_TAB[rankIndex], classIndex, classNumber: CLASS_TAB[classIndex] };
}

export interface MissionRating extends RankAndClass {
  level: MissionLevel;
  outcome: MissionOutcome;
  /** Running score at the end of the mission. */
  score: number;
  /** M from §14.2. */
  bonus: number;
  /** score + M. */
  total: number;
  /** e.g. "NOVICE CLASS 4". */
  title: string;
  /** End-of-mission title-line segments in order. */
  messages: string[];
}

/** Rate a finished mission. */
export function rateMission(level: MissionLevel, outcome: MissionOutcome, score: number): MissionRating {
  const bonus = missionBonus(level, outcome);
  const total = score + bonus;
  const rc = rankAndClass(total);
  return {
    level,
    outcome,
    score,
    bonus,
    total,
    ...rc,
    title: `${rc.rank} CLASS ${rc.classNumber}`,
    messages: endOfMissionMessages(outcome, rc.rank, rc.classNumber),
  };
}

/** §17.10 end sequence with the rank and class filled in. */
export function endOfMissionMessages(outcome: MissionOutcome, rank: Rank, classNumber: number): string[] {
  return END_SEQUENCE[outcome].map((s) =>
    s === RANK_PLACEHOLDER ? rank : s === CLASS_PLACEHOLDER ? `CLASS ${classNumber}` : s
  );
}

/**
 * §14.1 as the manual prints it:
 * M + 6·kills − energy/100 − time/100 − 18·starbases lost − 3·starbases you destroyed.
 * Divisions round down. Used to check the running score against the manual.
 */
export function manualFormulaScore(args: {
  level: MissionLevel;
  outcome: MissionOutcome;
  kills: number;
  energyUsed: number;
  timeCentons: number;
  starbasesLost: number;
  starbasesShot: number;
}): number {
  return (
    missionBonus(args.level, args.outcome) +
    6 * args.kills -
    Math.floor(args.energyUsed / 100) -
    Math.floor(args.timeCentons / 100) -
    18 * args.starbasesLost -
    3 * args.starbasesShot
  );
}
