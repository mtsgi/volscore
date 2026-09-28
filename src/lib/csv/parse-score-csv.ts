import Papa from 'papaparse';
import type { CsvIssue, ParseScoreCsvResult, ScoreRow } from '../score/types.js';

const REQUIRED_HEADERS = [
  '楽曲名',
  '難易度',
  '楽曲レベル',
  'クリアランク',
  'スコアグレード',
  'ハイスコア',
  'EXスコア',
  'プレー回数',
  'クリア回数',
  'ULTIMATE CHAIN',
  'PERFECT'
] as const;

interface RawScoreRow {
  [key: string]: string | undefined;
}

function failure(issues: CsvIssue[]): ParseScoreCsvResult {
  return { success: false, issues };
}

function parseInteger(value: string | undefined, field: string, row: number, issues: CsvIssue[]) {
  if (!value || !/^\d+$/.test(value)) {
    issues.push({ row, message: `${field}は0以上の整数で入力してください。` });
    return null;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    issues.push({ row, message: `${field}が安全な整数の範囲外です。` });
    return null;
  }

  return parsed;
}

function parseLevel(value: string | undefined, row: number, issues: CsvIssue[]) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) {
    issues.push({ row, message: '楽曲レベルは0以上の数値で入力してください。' });
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    issues.push({ row, message: '楽曲レベルが数値の範囲外です。' });
    return null;
  }

  return parsed;
}

function requiredText(value: string | undefined, field: string, row: number, issues: CsvIssue[]) {
  if (!value) {
    issues.push({ row, message: `${field}は必須です。` });
    return null;
  }

  return value;
}

export function parseScoreCsv(text: string): ParseScoreCsvResult {
  const parsed = Papa.parse<RawScoreRow>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });
  const headers = parsed.meta.fields ?? [];
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    return failure([
      {
        row: 1,
        message: `必須ヘッダーがありません: ${missingHeaders.join('、')}`
      }
    ]);
  }

  const issues: CsvIssue[] = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 2,
    message: `CSV形式エラー: ${error.message}`
  }));
  const rows: ScoreRow[] = [];
  const seenCharts = new Set<string>();

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const rowIssueStart = issues.length;
    const songName = requiredText(raw['楽曲名'], '楽曲名', rowNumber, issues);
    const difficulty = requiredText(raw['難易度'], '難易度', rowNumber, issues);
    const level = parseLevel(raw['楽曲レベル'], rowNumber, issues);
    const clearRank = requiredText(raw['クリアランク'], 'クリアランク', rowNumber, issues);
    const scoreGrade = requiredText(raw['スコアグレード'], 'スコアグレード', rowNumber, issues);
    const highScore = parseInteger(raw['ハイスコア'], 'ハイスコア', rowNumber, issues);
    const rawExScore = raw['EXスコア'];
    const exScoreValue = parseInteger(rawExScore, 'EXスコア', rowNumber, issues);
    const exScore = exScoreValue === 0 ? null : exScoreValue;
    const playCount = parseInteger(raw['プレー回数'], 'プレー回数', rowNumber, issues);
    const clearCount = parseInteger(raw['クリア回数'], 'クリア回数', rowNumber, issues);
    const ultimateChainCount = parseInteger(
      raw['ULTIMATE CHAIN'],
      'ULTIMATE CHAIN',
      rowNumber,
      issues
    );
    const perfectCount = parseInteger(raw['PERFECT'], 'PERFECT', rowNumber, issues);

    if (clearCount !== null && playCount !== null && clearCount > playCount) {
      issues.push({ row: rowNumber, message: 'クリア回数はプレー回数を超えられません。' });
    }
    if (
      clearCount !== null &&
      clearRank !== null &&
      (clearCount === 0) !== (clearRank === 'PLAYED')
    ) {
      issues.push({ row: rowNumber, message: 'PLAYEDとクリア回数の値が一致しません。' });
    }

    if (
      issues.length !== rowIssueStart ||
      songName === null ||
      difficulty === null ||
      level === null ||
      clearRank === null ||
      scoreGrade === null ||
      highScore === null ||
      exScoreValue === null ||
      playCount === null ||
      clearCount === null ||
      ultimateChainCount === null ||
      perfectCount === null
    ) {
      return;
    }

    const chartKey = `${songName}\u0000${difficulty}`;
    if (seenCharts.has(chartKey)) {
      issues.push({ row: rowNumber, message: '楽曲名と難易度の組み合わせが重複しています。' });
      return;
    }
    seenCharts.add(chartKey);

    rows.push({
      songName,
      difficulty,
      level,
      clearRank,
      scoreGrade,
      highScore,
      exScore,
      playCount,
      clearCount,
      ultimateChainCount,
      perfectCount
    });
  });

  if (rows.length === 0 && issues.length === 0) {
    issues.push({ row: 2, message: 'CSVにデータ行がありません。' });
  }

  return issues.length > 0 ? failure(issues) : { success: true, rows };
}
