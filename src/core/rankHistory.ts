/**
 * Part 4 bend 6: a small local history of mission ranks, kept in localStorage.
 * Display only; nothing in the rules reads it.
 */
import type { MissionLevel } from '../rules/levels';
import type { MissionOutcome } from '../rules/rating';

export interface RankRecord {
  /** ISO date-time the mission ended (wall clock; not game logic). */
  at: string;
  level: MissionLevel;
  outcome: MissionOutcome;
  rank: string;
  classNumber: number;
  total: number;
}

export const RANK_HISTORY_KEY = 'star-raiders.ranks';
/** Records kept, newest first. */
export const RANK_HISTORY_MAX = 10;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function valid(r: unknown): r is RankRecord {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return typeof o.at === 'string' && typeof o.rank === 'string' && typeof o.classNumber === 'number' && typeof o.total === 'number';
}

export function loadRankHistory(store: Store | null = storage()): RankRecord[] {
  try {
    const list = JSON.parse(store?.getItem(RANK_HISTORY_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(valid).slice(0, RANK_HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

/** Add a record at the front and keep the newest RANK_HISTORY_MAX. Returns the new list. */
export function addRankRecord(record: RankRecord, store: Store | null = storage()): RankRecord[] {
  const list = [record, ...loadRankHistory(store)].slice(0, RANK_HISTORY_MAX);
  try {
    store?.setItem(RANK_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // storage full or blocked: the history is a nicety
  }
  return list;
}
