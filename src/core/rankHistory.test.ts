import { describe, expect, it } from 'vitest';
import { RANK_HISTORY_KEY, RANK_HISTORY_MAX, addRankRecord, loadRankHistory, type RankRecord } from './rankHistory';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

const rec = (total: number): RankRecord => ({ at: '2026-11-27T00:00:00Z', level: 'NOVICE', outcome: 'complete', rank: 'NOVICE', classNumber: 4, total });

describe('bend 6 local rank history', () => {
  it('keeps the newest records first, at most RANK_HISTORY_MAX', () => {
    const store = memory();
    for (let i = 0; i < RANK_HISTORY_MAX + 3; i++) addRankRecord(rec(i), store);
    const list = loadRankHistory(store);
    expect(list).toHaveLength(RANK_HISTORY_MAX);
    expect(list[0].total).toBe(RANK_HISTORY_MAX + 2);
  });

  it('survives junk in storage and a missing store', () => {
    const store = memory();
    store.setItem(RANK_HISTORY_KEY, '{nope');
    expect(loadRankHistory(store)).toEqual([]);
    store.setItem(RANK_HISTORY_KEY, JSON.stringify([{ bad: 1 }, rec(5)]));
    expect(loadRankHistory(store).map((r) => r.total)).toEqual([5]);
    expect(loadRankHistory(null)).toEqual([]);
    expect(addRankRecord(rec(1), null)).toHaveLength(1);
  });
});
