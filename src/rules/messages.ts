/**
 * Title-line message strings, as the ROM's phrase table spells them.
 * MANUAL_SPEC §5, §8.2, §9, §13, §17.3, §17.5, §17.6, §17.9, §17.10, §17.11.
 */

export const MSG = {
  ATTACK_COMPUTER_ON: 'ATTACK COMPUTER ON',
  ATTACK_COMPUTER_OFF: 'ATTACK COMPUTER OFF',
  SHIELDS_ON: 'SHIELDS ON',
  SHIELDS_OFF: 'SHIELDS OFF',
  COMPUTER_TRACKING_ON: 'COMPUTER TRACKING ON',
  TRACKING_OFF: 'TRACKING OFF',
  WHATS_WRONG: 'WHATS WRONG?',
  HYPERWARP_ENGAGED: 'HYPERWARP ENGAGED',
  STARBASE_SURROUNDED: 'STARBASE SURROUNDED',
  STARBASE_DESTROYED: 'STARBASE DESTROYED',
  HYPERWARP_ABORTED: 'HYPERWARP ABORTED',
  HYPERWARP_COMPLETE: 'HYPERWARP COMPLETE',
  HYPERSPACE: 'HYPERSPACE',
  ORBIT_ESTABLISHED: 'ORBIT ESTABLISHED',
  STANDBY: 'STANDBY',
  DOCKING_ABORTED: 'DOCKING ABORTED',
  TRANSFER_COMPLETE: 'TRANSFER COMPLETE',
  RED_ALERT: 'RED ALERT',
  DAMAGE_CONTROL: 'DAMAGE CONTROL',
  STAR_RAIDERS: 'STAR RAIDERS',
  COPYRIGHT: 'COPYRIGHT ATARI 1979',
  GALACTIC_CHART: 'GALACTIC CHART',
  LONG_RANGE_SCAN: 'LONG RANGE SCAN',
  SHIP_DESTROYED_BY_ZYLON_FIRE: 'SHIP DESTROYED BY ZYLON FIRE',
  MISSION: {
    NOVICE: 'NOVICE MISSION',
    PILOT: 'PILOT MISSION',
    WARRIOR: 'WARRIOR MISSION',
    COMMANDER: 'COMMANDER MISSION',
  },
  /** §17.3: the LRS is called SECTOR SCAN on screen. */
  SUBSYSTEM: {
    photons: { damaged: 'PHOTONS DAMAGED', destroyed: 'PHOTONS DESTROYED' },
    engines: { damaged: 'ENGINES DAMAGED', destroyed: 'ENGINES DESTROYED' },
    shields: { damaged: 'SHIELDS DAMAGED', destroyed: 'SHIELDS DESTROYED' },
    computer: { damaged: 'COMPUTER DAMAGED', destroyed: 'COMPUTER DESTROYED' },
    sectorScan: { damaged: 'SECTOR SCAN DAMAGED', destroyed: 'SECTOR SCAN DESTROYED' },
    radio: { damaged: 'SUB-SPACE RADIO DAMAGED', destroyed: 'SUB-SPACE RADIO DESTROYED' },
  },
} as const;

/** Placeholders filled in by sim/rating.ts. */
export const RANK_PLACEHOLDER = '<RANK>';
export const CLASS_PLACEHOLDER = 'CLASS <N>';

/**
 * §17.10 end-of-mission sequences, one segment at a time on the title line
 * (ROM phrases $3F, $31, $23 and $76).
 */
export const END_SEQUENCE = {
  complete: [
    'STAR FLEET TO',
    'STAR CRUISER 7',
    'MISSION COMPLETE',
    'NEW RANK IS:',
    RANK_PLACEHOLDER,
    CLASS_PLACEHOLDER,
    'CONGRATULATIONS',
  ],
  zeroEnergy: [
    'STAR FLEET TO',
    'STAR CRUISER 7',
    'MISSION ABORTED',
    'ZERO ENERGY',
    'NEW RANK IS:',
    RANK_PLACEHOLDER,
    CLASS_PLACEHOLDER,
    'REPORT TO BASE',
    'FOR TRAINING',
  ],
  destroyed: [
    'STAR FLEET TO',
    'ALL UNITS',
    'STAR CRUISER 7',
    'DESTROYED',
    'BY ZYLON FIRE',
    'POSTHUMOUS RANK IS:',
    RANK_PLACEHOLDER,
    CLASS_PLACEHOLDER,
  ],
  /** Mission aborted by the player (the Atari/INV key, §3). Not listed in §17.10; ROM phrase $76. */
  aborted: [
    'STAR FLEET TO',
    'STAR CRUISER 7',
    'MISSION ABORTED',
    'NEW RANK IS:',
    RANK_PLACEHOLDER,
    CLASS_PLACEHOLDER,
    'CONGRATULATIONS',
  ],
} as const;

// ---------------------------------------------------------------------------------------------
// Title-line phrases (R: PHRASETAB L10802, WORDTAB L10897, SETTITLE/UPDTITLE L7722–7903).
//
// A phrase is one or more segments, each one line of at most 20 characters, shown one after
// the other. A segment stays up for 60 game loops; the last segment of the "long" phrases
// (STARBASE SURROUNDED, STARBASE DESTROYED, HYPERSPACE, RED ALERT) stays 254 loops. After the
// last segment the title line is hidden. The text is placed from column 0 as the ROM copies it;
// the leading spaces of RED ALERT and STAR RAIDERS are part of their words in WORDTAB.
// ---------------------------------------------------------------------------------------------

/** R: SETTITLE — title segment lifetime in game loops. */
export const TITLE_SEGMENT_LOOPS = 60;
export const TITLE_LONG_LOOPS = 254;
/** The title line holds 20 characters (TITLETXT, "19(+1) characters"). */
export const TITLE_COLUMNS = 20;

export interface TitleSegment {
  readonly text: string;
  readonly loops: number;
}
export type Phrase = readonly TitleSegment[];

const seg = (text: string, loops: number = TITLE_SEGMENT_LOOPS): TitleSegment => ({ text, loops });
const long = (text: string): TitleSegment => seg(text, TITLE_LONG_LOOPS);
/** Word $38 is a single space: the ROM uses it as a blank segment. */
const BLANK = seg(' ');

/** Every phrase of PHRASETAB the game shows, by its ROM offset's meaning. */
export const PHRASE = {
  ATTACK_COMPUTER_ON: [seg(MSG.ATTACK_COMPUTER_ON)], // $01
  ATTACK_COMPUTER_OFF: [seg(MSG.ATTACK_COMPUTER_OFF)], // $04
  SHIELDS_ON: [seg(MSG.SHIELDS_ON)], // $07
  SHIELDS_OFF: [seg(MSG.SHIELDS_OFF)], // $09
  COMPUTER_TRACKING_ON: [seg(MSG.COMPUTER_TRACKING_ON)], // $0B
  TRACKING_OFF: [seg(MSG.TRACKING_OFF)], // $0E
  WHATS_WRONG: [seg(MSG.WHATS_WRONG)], // $10
  HYPERWARP_ENGAGED: [seg(MSG.HYPERWARP_ENGAGED)], // $11
  STARBASE_SURROUNDED: [long(MSG.STARBASE_SURROUNDED)], // $13
  STARBASE_DESTROYED: [long(MSG.STARBASE_DESTROYED)], // $15
  HYPERWARP_ABORTED: [seg(MSG.HYPERWARP_ABORTED)], // $17
  HYPERWARP_COMPLETE: [seg(MSG.HYPERWARP_COMPLETE)], // $19
  HYPERSPACE: [long(MSG.HYPERSPACE)], // $1B
  /** $1C: ORBIT ESTABLISHED is one segment of a phrase that goes on to STANDBY. */
  ORBIT_ESTABLISHED: [seg(MSG.ORBIT_ESTABLISHED), seg(MSG.STANDBY)],
  DOCKING_ABORTED: [seg(MSG.DOCKING_ABORTED)], // $1F
  TRANSFER_COMPLETE: [seg(MSG.TRANSFER_COMPLETE)], // $21
  STAR_RAIDERS: [seg(`   ${MSG.STAR_RAIDERS}`), seg(MSG.COPYRIGHT)], // $2F
  MISSION: {
    NOVICE: [seg(MSG.MISSION.NOVICE)], // $4A
    PILOT: [seg(MSG.MISSION.PILOT)], // $4C
    WARRIOR: [seg(MSG.MISSION.WARRIOR)], // $4E
    COMMANDER: [seg(MSG.MISSION.COMMANDER)], // $50
  },
  /** $52: a blank segment, then DAMAGE CONTROL. The damaged subsystem follows from the queue. */
  DAMAGE_CONTROL: [BLANK, seg(MSG.DAMAGE_CONTROL)],
  /** $75: "    RED ALERT" (word $01 starts with four spaces). */
  RED_ALERT: [long(`    ${MSG.RED_ALERT}`)],
} as const satisfies Record<string, Phrase | Record<string, Phrase>>;

/**
 * DAMAGEPHRTAB / DESTROYPHRTAB ($55–$74): the subsystem phrase, then a blank segment.
 * SECTOR SCAN and SUB-SPACE RADIO put their state on a second segment.
 */
export function subsystemPhrase(system: keyof typeof MSG.SUBSYSTEM, status: 'damaged' | 'destroyed'): Phrase {
  const word = status === 'damaged' ? 'DAMAGED' : 'DESTROYED';
  if (system === 'sectorScan') return [seg('SECTOR SCAN'), seg(word)];
  if (system === 'radio') return [seg('SUB-SPACE RADIO'), seg(word)];
  return [seg(MSG.SUBSYSTEM[system][status]), BLANK];
}

/**
 * §17.10 end sequences ($23, $31, $3F, $76): a blank segment first, then one segment per line.
 * The destroyed sequence ends on a blank segment ($2E).
 */
export function endOfMissionPhrase(outcome: keyof typeof END_SEQUENCE, lines: readonly string[]): Phrase {
  const segments = [BLANK, ...lines.map((l) => seg(l))];
  if (outcome === 'destroyed') segments.push(BLANK);
  return segments;
}
