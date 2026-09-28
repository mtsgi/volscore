import type {
  DifficultyGroup,
  LevelFilterOption,
  LevelGrouping,
  LevelGroup,
  ScoreRow,
  ScoreSummary
} from './types.js';

export function aggregateScores(rows: readonly ScoreRow[]): ScoreSummary {
  const clearRankCounts: Record<string, number> = {};
  let playedCharts = 0;
  let clearedCharts = 0;

  for (const row of rows) {
    clearRankCounts[row.clearRank] = (clearRankCounts[row.clearRank] ?? 0) + 1;
    if (row.playCount > 0) playedCharts += 1;
    if (row.clearCount > 0) clearedCharts += 1;
  }

  return {
    totalCharts: rows.length,
    playedCharts,
    clearedCharts,
    clearRate: rows.length === 0 ? 0 : clearedCharts / rows.length,
    clearRankCounts
  };
}

export function groupScoresByLevel(
  rows: readonly ScoreRow[],
  grouping: LevelGrouping
): LevelGroup[] {
  const groups = new Map<number, LevelGroup>();

  for (const row of rows) {
    const level = grouping === 'integer' ? Math.floor(row.level) : row.level;
    const group = groups.get(level);

    if (group) {
      group.chartCount += 1;
      if (row.clearCount > 0) group.clearedCount += 1;
    } else {
      groups.set(level, {
        level,
        chartCount: 1,
        clearedCount: row.clearCount > 0 ? 1 : 0
      });
    }
  }

  return [...groups.values()].sort((a, b) => a.level - b.level);
}

export function groupScoresByDifficulty(rows: readonly ScoreRow[]): DifficultyGroup[] {
  const groups = new Map<string, DifficultyGroup>();

  for (const row of rows) {
    const group = groups.get(row.difficulty);
    if (group) {
      group.chartCount += 1;
      if (row.clearCount > 0) group.clearedCount += 1;
    } else {
      groups.set(row.difficulty, {
        difficulty: row.difficulty,
        chartCount: 1,
        clearedCount: row.clearCount > 0 ? 1 : 0
      });
    }
  }

  return [...groups.values()].sort((a, b) => a.difficulty.localeCompare(b.difficulty));
}

export function getLevelFilterOptions(rows: readonly ScoreRow[]): LevelFilterOption[] {
  const exactLevels = [...new Set(rows.map((row) => row.level))];
  const options: LevelFilterOption[] = exactLevels.map((level) => ({
    value: `exact:${level}`,
    grouping: 'exact',
    level
  }));
  const integerLevels = [...new Set(exactLevels.map(Math.floor))].filter((level) => level >= 17);

  options.push(
    ...integerLevels.map((level) => ({
      value: `integer:${level}`,
      grouping: 'integer' as const,
      level
    }))
  );

  return options.sort(
    (a, b) => a.level - b.level || (a.grouping === b.grouping ? 0 : a.grouping === 'exact' ? -1 : 1)
  );
}
