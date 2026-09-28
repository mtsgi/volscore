export interface ScoreRow {
  songName: string;
  difficulty: string;
  level: number;
  clearRank: string;
  scoreGrade: string;
  highScore: number;
  exScore: number | null;
  playCount: number;
  clearCount: number;
  ultimateChainCount: number;
  perfectCount: number;
}

export interface CsvIssue {
  row: number;
  message: string;
}

export type ParseScoreCsvResult =
  { success: true; rows: ScoreRow[] } | { success: false; issues: CsvIssue[] };

export interface ScoreSummary {
  totalCharts: number;
  playedCharts: number;
  clearedCharts: number;
  clearRate: number;
  clearRankCounts: Record<string, number>;
}

export interface DifficultyGroup {
  difficulty: string;
  chartCount: number;
  clearedCount: number;
}

export interface LevelGroup {
  level: number;
  chartCount: number;
  clearedCount: number;
}

export type LevelGrouping = 'exact' | 'integer';

export interface LevelFilterOption {
  value: string;
  grouping: LevelGrouping;
  level: number;
}
