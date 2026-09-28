import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import ScorePage from './+page.svelte';

const validCsv = [
  '楽曲名,難易度,楽曲レベル,クリアランク,スコアグレード,ハイスコア,EXスコア,プレー回数,クリア回数,ULTIMATE CHAIN,PERFECT',
  'テスト曲,EXPERT,12.5,AA,A,950000,0,2,1,0,0'
].join('\n');

function selectCsv(name: string, contents: string) {
  const input = document.querySelector<HTMLInputElement>('#score-file');
  expect(input).not.toBeNull();

  const transfer = new DataTransfer();
  transfer.items.add(new File([contents], name, { type: 'text/csv' }));
  input!.files = transfer.files;
  input!.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('+page.svelte', () => {
  afterEach(() => cleanup());

  it('waits for a CSV and replaces prior results when a new file is invalid', async () => {
    render(ScorePage);

    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('VOLSCORE');
    expect(document.title).toBe('VOLSCORE');
    await expect.element(page.getByRole('contentinfo')).toHaveTextContent('VOLSCORE');
    const repositoryLink = page.getByRole('link', {
      name: 'GitHubリポジトリ（新しいタブで開く）'
    });
    await expect
      .element(repositoryLink)
      .toHaveAttribute('href', 'https://github.com/mtsgi/volscore');
    await expect.element(repositoryLink).toHaveAttribute('target', '_blank');
    await expect.element(repositoryLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect.element(page.getByText('VOL SCORE / RECORD ANALYSIS')).not.toBeInTheDocument();
    await expect
      .element(page.getByText('プレー記録を読み込み、全譜面の進捗を一覧します。'))
      .not.toBeInTheDocument();
    await expect.element(page.getByText('データはこの画面内だけで処理')).not.toBeInTheDocument();
    await expect.element(page.getByText('CSVファイルを選択してください')).toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'プレー状況' })).not.toBeInTheDocument();

    selectCsv('scores.csv', validCsv);
    await expect.element(page.getByText('1 譜面を読み込みました')).toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'プレー状況' })).toBeInTheDocument();
    await expect.element(page.getByText('未記録')).toBeInTheDocument();

    selectCsv('broken.csv', 'invalid,csv\nrow');
    await expect.element(page.getByRole('alert')).toHaveTextContent('行 1:');
    await expect.element(page.getByRole('heading', { name: 'プレー状況' })).not.toBeInTheDocument();
    await expect.element(page.getByText('テスト曲')).not.toBeInTheDocument();
  });

  it('filters and sorts the imported score rows with labeled controls', async () => {
    render(ScorePage);
    selectCsv(
      'scores.csv',
      [
        validCsv.split('\n')[0],
        '乙曲,EXPERT,12.5,AA,A,950000,0,2,1,0,0',
        '甲曲,MASTER,13,PLAYED,B,820000,123,1,0,0,0'
      ].join('\n')
    );

    await expect.element(page.getByText('2 譜面を読み込みました')).toBeInTheDocument();
    const search = page.getByRole('searchbox', { name: '楽曲名で検索' });
    await search.fill('乙');
    await expect.element(page.getByText('乙曲')).toBeInTheDocument();
    await expect.element(page.getByText('甲曲')).not.toBeInTheDocument();

    await search.fill('');
    await page.getByRole('button', { name: /レベル/ }).click();
    await expect
      .element(page.getByRole('columnheader', { name: /レベル/ }))
      .toHaveAttribute('aria-sort', 'ascending');
  });

  it('clears all filters when replacing the imported CSV', async () => {
    render(ScorePage);
    const header = validCsv.split('\n')[0];
    selectCsv(
      'first.csv',
      [
        header,
        '旧対象曲,EXPERT,17.5,AA,A,950000,0,2,1,0,0',
        '旧別曲,MASTER,16,PLAYED,B,820000,123,1,0,0,0'
      ].join('\n')
    );

    await expect.element(page.getByText('2 譜面を読み込みました')).toBeInTheDocument();
    await page.getByRole('searchbox', { name: '楽曲名で検索' }).fill('旧対象曲');
    const filters = document.querySelectorAll<HTMLSelectElement>('.filters select');
    expect(filters).toHaveLength(3);
    filters[0].value = 'EXPERT';
    filters[0].dispatchEvent(new Event('change', { bubbles: true }));
    filters[1].value = 'exact:17.5';
    filters[1].dispatchEvent(new Event('change', { bubbles: true }));
    filters[2].value = 'AA';
    filters[2].dispatchEvent(new Event('change', { bubbles: true }));
    await expect.element(page.getByText('1 / 2 譜面')).toBeInTheDocument();

    selectCsv(
      'second.csv',
      [header, '新しい曲,MASTER,12,COMPLETE,A,950000,4000,1,1,0,0'].join('\n')
    );

    await expect.element(page.getByText('1 譜面を読み込みました')).toBeInTheDocument();
    await expect.element(page.getByText('1 / 1 譜面')).toBeInTheDocument();
    await expect.element(page.getByText('新しい曲')).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    expect([...filters].map((filter) => filter.value)).toEqual(['all', 'all', 'all']);
  });

  it('shows independent breakdowns and filters fractional levels or Lv17 ALL', async () => {
    render(ScorePage);
    selectCsv(
      'levels.csv',
      [
        validCsv.split('\n')[0],
        '小数曲,EXPERT,17.5,AA,A,950000,0,2,1,0,0',
        '整数曲,EXPERT,17,PLAYED,B,820000,123,1,0,0,0',
        '別難易度曲,MASTER,17.5,COMPLETE,A,950000,0,2,1,0,0',
        '低レベル曲,EXPERT,16.5,PLAYED,B,820000,123,1,0,0,0'
      ].join('\n')
    );

    const difficultyTab = page.getByRole('tab', { name: '難易度ごと' });
    const exactLevelTab = page.getByRole('tab', { name: '小数レベルごと' });
    const integerLevelTab = page.getByRole('tab', { name: '整数レベルごと' });
    await expect.element(difficultyTab).toHaveAttribute('aria-selected', 'true');
    await expect.element(page.getByRole('tabpanel', { name: '難易度ごと' })).toBeInTheDocument();
    await expect
      .element(page.getByRole('tabpanel', { name: '小数レベルごと' }))
      .not.toBeInTheDocument();
    await exactLevelTab.click();
    await expect.element(exactLevelTab).toHaveAttribute('aria-selected', 'true');
    await expect
      .element(page.getByRole('tabpanel', { name: '小数レベルごと' }))
      .toBeInTheDocument();
    await expect.element(page.getByRole('rowheader', { name: '17.0' })).toBeInTheDocument();

    const exactLevelButton = document.querySelector<HTMLButtonElement>('#exact-level-tab');
    expect(exactLevelButton).not.toBeNull();
    exactLevelButton!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    );
    await expect.element(integerLevelTab).toHaveAttribute('aria-selected', 'true');
    await expect
      .element(page.getByRole('tabpanel', { name: '整数レベルごと' }))
      .toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Lv16.5' })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Lv17.5' })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Lv17.0' })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: 'Lv17 ALL' })).toBeInTheDocument();

    const levelSelect = document.querySelector<HTMLSelectElement>(
      'select[aria-label="レベルで絞り込み"]'
    );
    expect(levelSelect).not.toBeNull();
    levelSelect!.value = 'integer:17';
    levelSelect!.dispatchEvent(new Event('change', { bubbles: true }));

    await expect.element(page.getByText('3 / 4 譜面')).toBeInTheDocument();
    await expect.element(page.getByText('低レベル曲')).not.toBeInTheDocument();
    await expect.element(page.getByText('小数曲')).toBeInTheDocument();
    await expect.element(page.getByText('整数曲')).toBeInTheDocument();
  });
});
