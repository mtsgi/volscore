import { describe, expect, it } from 'vitest';
import {
  aggregateScores,
  getLevelFilterOptions,
  groupScoresByDifficulty,
  groupScoresByLevel
} from './aggregate.js';
import type { ScoreRow } from './types.js';

const rows: ScoreRow[] = [
  {
    songName: 'Chart A',
    difficulty: 'MAXIMUM',
    level: 17,
    clearRank: 'PLAYED',
    scoreGrade: 'A+',
    highScore: 9000000,
    exScore: null,
    playCount: 1,
    clearCount: 0,
    ultimateChainCount: 0,
    perfectCount: 0
  },
  {
    songName: 'Chart B',
    difficulty: 'MAXIMUM',
    level: 17.5,
    clearRank: 'COMPLETE',
    scoreGrade: 'AAA',
    highScore: 9700000,
    exScore: 4000,
    playCount: 2,
    clearCount: 1,
    ultimateChainCount: 0,
    perfectCount: 0
  },
  {
    songName: 'Chart C',
    difficulty: 'EXHAUST',
    level: 17.5,
    clearRank: 'ULTIMATE CHAIN',
    scoreGrade: 'S',
    highScore: 9900000,
    exScore: 5000,
    playCount: 3,
    clearCount: 3,
    ultimateChainCount: 2,
    perfectCount: 0
  }
];

describe('aggregateScores', () => {
  it('summarizes total, played and cleared charts with all charts as the rate denominator', () => {
    expect(aggregateScores(rows)).toEqual({
      totalCharts: 3,
      playedCharts: 3,
      clearedCharts: 2,
      clearRate: 2 / 3,
      clearRankCounts: {
        PLAYED: 1,
        COMPLETE: 1,
        'ULTIMATE CHAIN': 1
      }
    });
  });
});

describe('groupScoresByLevel', () => {
  it('keeps fractional levels distinct when exact grouping is selected', () => {
    expect(groupScoresByLevel(rows, 'exact')).toEqual([
      { level: 17, chartCount: 1, clearedCount: 0 },
      { level: 17.5, chartCount: 2, clearedCount: 2 }
    ]);
  });

  it('groups fractional levels by integer part when integer grouping is selected', () => {
    expect(groupScoresByLevel(rows, 'integer')).toEqual([
      { level: 17, chartCount: 3, clearedCount: 2 }
    ]);
  });
});

describe('groupScoresByDifficulty', () => {
  it('groups chart counts and clears by difficulty without a level dimension', () => {
    expect(groupScoresByDifficulty(rows)).toEqual([
      { difficulty: 'EXHAUST', chartCount: 1, clearedCount: 1 },
      { difficulty: 'MAXIMUM', chartCount: 2, clearedCount: 1 }
    ]);
  });
});

describe('getLevelFilterOptions', () => {
  it('offers each exact level and an ALL option for each integer level from 17 upward', () => {
    expect(
      getLevelFilterOptions([...rows, { ...rows[0], songName: 'Chart D', level: 16.5 }])
    ).toEqual([
      { value: 'exact:16.5', grouping: 'exact', level: 16.5 },
      { value: 'exact:17', grouping: 'exact', level: 17 },
      { value: 'integer:17', grouping: 'integer', level: 17 },
      { value: 'exact:17.5', grouping: 'exact', level: 17.5 }
    ]);
  });
});
