import { describe, expect, it } from 'vitest';
import { parseScoreCsv } from './parse-score-csv.js';

const header =
  '楽曲名,難易度,楽曲レベル,クリアランク,スコアグレード,ハイスコア,EXスコア,プレー回数,クリア回数,ULTIMATE CHAIN,PERFECT';

function row(values: string[]) {
  return values.join(',');
}

describe('parseScoreCsv', () => {
  it('parses quoted song names and treats an EX score of zero as unrecorded', () => {
    const result = parseScoreCsv(
      `\uFEFF${header}\n"Song, One",MAXIMUM,18.5,COMPLETE,AAA,9702949,0,2,1,1,0`
    );

    expect(result).toEqual({
      success: true,
      rows: [
        {
          songName: 'Song, One',
          difficulty: 'MAXIMUM',
          level: 18.5,
          clearRank: 'COMPLETE',
          scoreGrade: 'AAA',
          highScore: 9702949,
          exScore: null,
          playCount: 2,
          clearCount: 1,
          ultimateChainCount: 1,
          perfectCount: 0
        }
      ]
    });
  });

  it('maps columns by header and ignores additional columns', () => {
    const columns = header.split(',').reverse();
    const data = [
      '0',
      '0',
      '1',
      '2',
      '4000',
      '9900000',
      'S',
      'ULTIMATE CHAIN',
      '17.5',
      'MAXIMUM',
      'Chart A'
    ];
    const result = parseScoreCsv(`${columns.join(',')},注釈\n${row(data)},extra`);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rows[0]).toMatchObject({
        songName: 'Chart A',
        difficulty: 'MAXIMUM',
        level: 17.5,
        clearRank: 'ULTIMATE CHAIN',
        exScore: 4000
      });
    }
  });

  it('rejects a CSV that is missing required headers', () => {
    const result = parseScoreCsv('楽曲名,難易度\nSong A,MAXIMUM');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toContain('必須');
    }
  });

  it('rejects the whole file and reports the source row for invalid values', () => {
    const result = parseScoreCsv(
      `${header}\n${row(['Song A', 'MAXIMUM', '18.5', 'COMPLETE', 'AAA', '9702949', '100', '2', '1', '0', '0'])}\n${row(['Song B', 'MAXIMUM', 'not-a-level', 'PLAYED', 'A+', '9000000', '100', '1', '0', '0', '0'])}`
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ row: 3 })]));
    }
  });

  it('rejects duplicate song and difficulty pairs', () => {
    const record = row([
      'Song A',
      'MAXIMUM',
      '18.5',
      'COMPLETE',
      'AAA',
      '9702949',
      '100',
      '2',
      '1',
      '0',
      '0'
    ]);
    const result = parseScoreCsv(`${header}\n${record}\n${record}`);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 3, message: expect.stringContaining('重複') })
        ])
      );
    }
  });

  it('rejects impossible play and clear counts', () => {
    const result = parseScoreCsv(
      `${header}\n${row(['Song A', 'MAXIMUM', '18.5', 'COMPLETE', 'AAA', '9702949', '100', '1', '2', '0', '0'])}`
    );

    expect(result.success).toBe(false);
  });
});
