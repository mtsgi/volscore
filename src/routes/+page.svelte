<script lang="ts">
  import {
    aggregateScores,
    getLevelFilterOptions,
    groupScoresByDifficulty,
    groupScoresByLevel
  } from '$lib/score/aggregate.js';
  import type { CsvIssue, LevelFilterOption, ScoreRow } from '$lib/score/types.js';
  import { parseScoreCsv } from '$lib/csv/parse-score-csv.js';

  type SortKey = keyof ScoreRow;
  type SortDirection = 'asc' | 'desc';
  const breakdownTabs = [
    {
      key: 'difficulty',
      label: '難易度ごと',
      tabId: 'difficulty-breakdown-tab',
      panelId: 'difficulty-breakdown-panel'
    },
    {
      key: 'exact',
      label: '小数レベルごと',
      tabId: 'exact-level-tab',
      panelId: 'exact-level-panel'
    },
    {
      key: 'integer',
      label: '整数レベルごと',
      tabId: 'integer-level-tab',
      panelId: 'integer-level-panel'
    }
  ] as const;
  type BreakdownTabKey = (typeof breakdownTabs)[number]['key'];

  const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: 'songName', label: '楽曲名' },
    { key: 'difficulty', label: '難易度' },
    { key: 'level', label: 'レベル', numeric: true },
    { key: 'clearRank', label: 'クリアランク' },
    { key: 'scoreGrade', label: 'スコアグレード' },
    { key: 'highScore', label: 'ハイスコア', numeric: true },
    { key: 'exScore', label: 'EXスコア', numeric: true },
    { key: 'playCount', label: 'プレー回数', numeric: true },
    { key: 'clearCount', label: 'クリア回数', numeric: true },
    { key: 'ultimateChainCount', label: 'ULTIMATE CHAIN', numeric: true },
    { key: 'perfectCount', label: 'PERFECT', numeric: true }
  ];
  const numberFormat = new Intl.NumberFormat('ja-JP');
  const percentFormat = new Intl.NumberFormat('ja-JP', {
    style: 'percent',
    maximumFractionDigits: 1
  });
  const collator = new Intl.Collator('ja-JP', { numeric: true, sensitivity: 'base' });

  let rows = $state.raw<ScoreRow[]>([]);
  let selectedFileName = $state('');
  let issues = $state<CsvIssue[]>([]);
  let readError = $state('');
  let isLoading = $state(false);
  let searchQuery = $state('');
  let difficultyFilter = $state('all');
  let clearRankFilter = $state('all');
  let levelFilter = $state('all');
  let activeBreakdownTab = $state<BreakdownTabKey>('difficulty');
  let sortKey = $state<SortKey>('songName');
  let sortDirection = $state<SortDirection>('asc');
  let importRequest = 0;

  let summary = $derived(rows.length > 0 ? aggregateScores(rows) : null);
  let difficultyGroups = $derived(groupScoresByDifficulty(rows));
  let exactLevelGroups = $derived(groupScoresByLevel(rows, 'exact'));
  let integerLevelGroups = $derived(groupScoresByLevel(rows, 'integer'));
  let levelFilterOptions = $derived(getLevelFilterOptions(rows));
  let selectedLevelFilter = $derived(
    levelFilterOptions.find((option) => option.value === levelFilter) ?? null
  );
  let difficulties = $derived(
    [...new Set(rows.map((row) => row.difficulty))].sort((a, b) => collator.compare(a, b))
  );
  let clearRanks = $derived(
    [...new Set(rows.map((row) => row.clearRank))].sort((a, b) => collator.compare(a, b))
  );
  let clearRankEntries = $derived(
    summary
      ? Object.keys(summary.clearRankCounts)
          .sort((a, b) => collator.compare(a, b))
          .map((rank) => ({ rank, count: summary.clearRankCounts[rank] ?? 0 }))
      : []
  );
  let filteredRows = $derived.by(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ja-JP');
    const filtered = rows.filter(
      (row) =>
        (!query || row.songName.toLocaleLowerCase('ja-JP').includes(query)) &&
        (difficultyFilter === 'all' || row.difficulty === difficultyFilter) &&
        (clearRankFilter === 'all' || row.clearRank === clearRankFilter) &&
        (!selectedLevelFilter || matchesLevelFilter(row, selectedLevelFilter))
    );

    return filtered.sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      if (leftValue === null && rightValue !== null) return 1;
      if (rightValue === null && leftValue !== null) return -1;
      const primaryComparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : collator.compare(String(leftValue), String(rightValue));
      const comparison =
        primaryComparison === 0
          ? collator.compare(left.songName, right.songName)
          : primaryComparison;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  });

  function formatNumber(value: number): string {
    return numberFormat.format(value);
  }

  function formatLevel(value: number): string {
    return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(value);
  }

  function formatExactLevel(value: number): string {
    return value >= 17 && Number.isInteger(value) ? value.toFixed(1) : formatLevel(value);
  }

  function matchesLevelFilter(row: ScoreRow, option: LevelFilterOption): boolean {
    return option.grouping === 'exact'
      ? row.level === option.level
      : Math.floor(row.level) === option.level;
  }

  function handleBreakdownTabKeydown(event: KeyboardEvent, currentTab: BreakdownTabKey) {
    const currentIndex = breakdownTabs.findIndex((tab) => tab.key === currentTab);
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % breakdownTabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + breakdownTabs.length) % breakdownTabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = breakdownTabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = breakdownTabs[nextIndex];
    activeBreakdownTab = nextTab.key;
    document.getElementById(nextTab.tabId)?.focus();
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  async function handleFileSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    const request = ++importRequest;

    rows = [];
    issues = [];
    readError = '';
    searchQuery = '';
    difficultyFilter = 'all';
    clearRankFilter = 'all';
    levelFilter = 'all';
    selectedFileName = file?.name ?? '';
    isLoading = false;

    if (!file) return;
    if (!file.name.toLocaleLowerCase('en-US').endsWith('.csv')) {
      readError = 'CSVファイルを選択してください。';
      return;
    }

    isLoading = true;
    try {
      const result = parseScoreCsv(await file.text());
      if (request !== importRequest) return;
      if (result.success) {
        rows = result.rows;
      } else {
        issues = result.issues;
      }
    } catch {
      if (request === importRequest) {
        readError = 'ファイルを読み込めませんでした。UTF-8形式のCSVを選択してください。';
      }
    } finally {
      if (request === importRequest) isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>VOLSCORE</title>
  <meta name="description" content="CSVから譜面スコアを読み込み、進捗とクリア状況を確認します。" />
</svelte:head>

<main class="page-shell">
  <header class="page-header">
    <h1>VOLSCORE</h1>
  </header>

  <section class="import-section" aria-labelledby="import-heading">
    <div class="section-heading">
      <div>
        <p class="section-index">01 / IMPORT</p>
        <h2 id="import-heading">CSVを読み込む</h2>
      </div>
      <p class="section-note">UTF-8 ・ .csv</p>
    </div>
    <div class="import-controls">
      <label class="file-control" for="score-file">
        <span class="file-icon" aria-hidden="true">↑</span>
        <span>CSVファイルを選択</span>
        <input
          id="score-file"
          class="file-input"
          type="file"
          accept=".csv,text/csv"
          onchange={handleFileSelection}
        />
      </label>
      <div class="file-status" aria-live="polite" aria-atomic="true">
        {#if selectedFileName}
          <p class="source-name">選択中 <strong>{selectedFileName}</strong></p>
        {:else}
          <p>CSVファイルを選択してください</p>
        {/if}
        {#if isLoading}
          <p class="status-message">読み込み中...</p>
        {:else if rows.length > 0}
          <p class="status-message success-message">
            {formatNumber(rows.length)} 譜面を読み込みました
          </p>
        {/if}
      </div>
    </div>
    {#if readError}
      <p class="error-message" role="alert">{readError}</p>
    {/if}
    {#if issues.length > 0}
      <div class="error-panel" role="alert" aria-labelledby="import-errors-heading">
        <h3 id="import-errors-heading">読み込みできませんでした</h3>
        <ul>
          {#each issues as issue (`${issue.row}-${issue.message}`)}
            <li>行 {formatNumber(issue.row)}: {issue.message}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>

  {#if summary}
    <section class="report-section" aria-labelledby="summary-heading">
      <div class="section-heading">
        <div>
          <p class="section-index">02 / OVERVIEW</p>
          <h2 id="summary-heading">プレー状況</h2>
        </div>
        <p class="section-note">{formatNumber(summary.totalCharts)} 譜面</p>
      </div>
      <div class="summary-grid">
        <div class="metric metric-total">
          <p>総譜面数</p>
          <strong>{formatNumber(summary.totalCharts)}</strong>
          <span>CHARTS</span>
        </div>
        <div class="metric">
          <p>プレー済み</p>
          <strong>{formatNumber(summary.playedCharts)}</strong>
          <span>PLAYED</span>
        </div>
        <div class="metric metric-rate">
          <p>全譜面クリア率</p>
          <strong>{percentFormat.format(summary.clearRate)}</strong>
          <span>{formatNumber(summary.clearedCharts)} CLEARED</span>
        </div>
        <div class="rank-summary">
          <h3>クリアランク別</h3>
          <dl>
            {#each clearRankEntries as entry (entry.rank)}
              <div>
                <dt>{entry.rank}</dt>
                <dd>{formatNumber(entry.count)}</dd>
              </div>
            {/each}
          </dl>
        </div>
      </div>
    </section>

    <section class="report-section level-section" aria-labelledby="level-heading">
      <div class="section-heading">
        <div>
          <p class="section-index">03 / LEVEL BREAKDOWN</p>
          <h2 id="level-heading">難易度・レベルの内訳</h2>
        </div>
      </div>
      <div class="breakdown-tabs" role="tablist" aria-label="レベル集計">
        {#each breakdownTabs as tab (tab.key)}
          <button
            id={tab.tabId}
            type="button"
            role="tab"
            aria-selected={activeBreakdownTab === tab.key}
            aria-controls={tab.panelId}
            tabindex={activeBreakdownTab === tab.key ? 0 : -1}
            onclick={() => (activeBreakdownTab = tab.key)}
            onkeydown={(event) => handleBreakdownTabKeydown(event, tab.key)}
          >
            {tab.label}
          </button>
        {/each}
      </div>
      <div
        id="difficulty-breakdown-panel"
        class="breakdown-panel"
        role="tabpanel"
        aria-labelledby="difficulty-breakdown-tab"
        tabindex="0"
        hidden={activeBreakdownTab !== 'difficulty'}
      >
        <h3>難易度ごと</h3>
        <div class="level-table-wrap">
          <table class="level-table">
            <caption>難易度ごとの譜面数・クリア数</caption>
            <thead>
              <tr>
                <th scope="col">難易度</th>
                <th scope="col">譜面数</th>
                <th scope="col">クリア数</th>
              </tr>
            </thead>
            <tbody>
              {#each difficultyGroups as group (group.difficulty)}
                <tr>
                  <th scope="row">{group.difficulty}</th>
                  <td>{formatNumber(group.chartCount)}</td>
                  <td>{formatNumber(group.clearedCount)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      <div
        id="exact-level-panel"
        class="breakdown-panel"
        role="tabpanel"
        aria-labelledby="exact-level-tab"
        tabindex="0"
        hidden={activeBreakdownTab !== 'exact'}
      >
        <h3>小数レベルごと</h3>
        <div class="level-table-wrap">
          <table class="level-table">
            <caption>小数レベルごとの譜面数・クリア数</caption>
            <thead>
              <tr>
                <th scope="col">レベル</th>
                <th scope="col">譜面数</th>
                <th scope="col">クリア数</th>
              </tr>
            </thead>
            <tbody>
              {#each exactLevelGroups as group (group.level)}
                <tr>
                  <th scope="row">{formatExactLevel(group.level)}</th>
                  <td>{formatNumber(group.chartCount)}</td>
                  <td>{formatNumber(group.clearedCount)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      <div
        id="integer-level-panel"
        class="breakdown-panel"
        role="tabpanel"
        aria-labelledby="integer-level-tab"
        tabindex="0"
        hidden={activeBreakdownTab !== 'integer'}
      >
        <h3>整数レベルごと</h3>
        <div class="level-table-wrap">
          <table class="level-table">
            <caption>整数レベルごとの譜面数・クリア数</caption>
            <thead>
              <tr>
                <th scope="col">レベル</th>
                <th scope="col">譜面数</th>
                <th scope="col">クリア数</th>
              </tr>
            </thead>
            <tbody>
              {#each integerLevelGroups as group (group.level)}
                <tr>
                  <th scope="row">{formatLevel(group.level)}</th>
                  <td>{formatNumber(group.chartCount)}</td>
                  <td>{formatNumber(group.clearedCount)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="report-section score-section" aria-labelledby="scores-heading">
      <div class="section-heading">
        <div>
          <p class="section-index">04 / ALL CHARTS</p>
          <h2 id="scores-heading">スコア一覧</h2>
        </div>
        <p class="section-note">
          {formatNumber(filteredRows.length)} / {formatNumber(rows.length)} 譜面
        </p>
      </div>
      <div class="filters" aria-label="スコア一覧の絞り込み">
        <label class="filter-control search-control">
          <span>楽曲名で検索</span>
          <input type="search" placeholder="曲名を入力" bind:value={searchQuery} />
        </label>
        <label class="filter-control">
          <span>難易度</span>
          <select bind:value={difficultyFilter}>
            <option value="all">すべて</option>
            {#each difficulties as difficulty (difficulty)}
              <option value={difficulty}>{difficulty}</option>
            {/each}
          </select>
        </label>
        <label class="filter-control">
          <span>レベル</span>
          <select bind:value={levelFilter} aria-label="レベルで絞り込み">
            <option value="all">すべて</option>
            {#each levelFilterOptions as option (option.value)}
              <option value={option.value}>
                Lv{option.grouping === 'exact'
                  ? formatExactLevel(option.level)
                  : formatLevel(option.level)}{option.grouping === 'integer' ? ' ALL' : ''}
              </option>
            {/each}
          </select>
        </label>
        <label class="filter-control">
          <span>クリアランク</span>
          <select bind:value={clearRankFilter}>
            <option value="all">すべて</option>
            {#each clearRanks as rank (rank)}
              <option value={rank}>{rank}</option>
            {/each}
          </select>
        </label>
      </div>
      <div class="table-scroll" role="region" aria-label="スコア一覧。左右にスクロールできます">
        <table class="score-table">
          <caption>読み込んだ譜面の全11項目。列見出しのボタンで並べ替えます。</caption>
          <thead>
            <tr>
              {#each columns as column (column.key)}
                <th
                  scope="col"
                  class:numeric={column.numeric}
                  aria-sort={sortKey === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'}
                >
                  <button type="button" onclick={() => changeSort(column.key)}>
                    {column.label}
                    <span aria-hidden="true"
                      >{sortKey === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span
                    >
                  </button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each filteredRows as row (`${row.songName}-${row.difficulty}`)}
              <tr>
                <th scope="row">{row.songName}</th>
                <td>{row.difficulty}</td>
                <td class="numeric">{formatExactLevel(row.level)}</td>
                <td><span class="rank-value">{row.clearRank}</span></td>
                <td>{row.scoreGrade}</td>
                <td class="numeric">{formatNumber(row.highScore)}</td>
                <td class="numeric"
                  >{row.exScore === null ? '未記録' : formatNumber(row.exScore)}</td
                >
                <td class="numeric">{formatNumber(row.playCount)}</td>
                <td class="numeric">{formatNumber(row.clearCount)}</td>
                <td class="numeric">{formatNumber(row.ultimateChainCount)}</td>
                <td class="numeric">{formatNumber(row.perfectCount)}</td>
              </tr>
            {:else}
              <tr><td class="empty-results" colspan="11">条件に一致する譜面はありません</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if !isLoading && selectedFileName && issues.length === 0 && !readError}
    <p class="empty-state">有効な譜面データがありません。</p>
  {:else if !selectedFileName}
    <section class="empty-state" aria-live="polite">
      <p class="empty-number">01</p>
      <h2>記録を読み込むと、ここにレポートが表示されます。</h2>
      <p>CSVは端末内で処理され、保存や送信は行いません。</p>
    </section>
  {/if}

  <footer class="page-footer">
    VOLSCORE
    <a
      href="https://github.com/mtsgi/volscore"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHubリポジトリ（新しいタブで開く）">GitHub</a
    >
    <span>LOCAL SESSION</span>
  </footer>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    background: #f2f5f1;
    color: #18251f;
    font-family: 'Avenir Next', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
    font-size: 14px;
  }

  :global(button),
  :global(input),
  :global(select) {
    font: inherit;
  }

  .page-shell {
    width: min(1480px, calc(100% - 48px));
    min-width: 0;
    margin: 0 auto;
  }

  .page-header {
    padding: 28px 0 22px;
    border-bottom: 1px solid #c9d2ca;
  }

  .section-index {
    margin: 0 0 9px;
    color: #34705b;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.2px;
  }

  h1,
  h2,
  h3,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 0;
    font-size: 30px;
    font-weight: 750;
    line-height: 1.2;
  }

  .section-note {
    margin-bottom: 0;
    color: #64736a;
  }

  .import-section,
  .report-section {
    padding: 22px 0;
    border-bottom: 1px solid #c9d2ca;
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 16px;
  }

  .section-index {
    margin-bottom: 4px;
  }

  h2 {
    margin-bottom: 0;
    font-size: 18px;
    font-weight: 720;
  }

  .section-note {
    font-size: 12px;
    white-space: nowrap;
  }

  .import-controls {
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
  }

  .file-control {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid #075d49;
    border-radius: 4px;
    background: #075d49;
    color: #fff;
    font-weight: 700;
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease;
  }

  .file-control:hover {
    border-color: #064a3b;
    background: #064a3b;
  }

  .file-icon {
    font-size: 18px;
    line-height: 1;
  }

  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    clip-path: inset(50%);
  }

  .file-control:focus-within,
  input:focus-visible,
  select:focus-visible,
  button:focus-visible,
  .table-scroll:focus-visible {
    outline: 3px solid #e18453;
    outline-offset: 3px;
  }

  .file-status {
    min-width: 0;
    color: #64736a;
  }

  .file-status p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .source-name strong {
    color: #18251f;
  }

  .status-message {
    margin-top: 4px !important;
    font-size: 12px;
  }

  .success-message {
    color: #087253;
    font-weight: 700;
  }

  .error-message,
  .error-panel {
    margin: 14px 0 0;
    color: #9d382d;
  }

  .error-panel {
    padding: 12px 14px;
    border-left: 3px solid #c74f3e;
    background: #fff0ec;
  }

  .error-panel h3 {
    margin-bottom: 5px;
    font-size: 14px;
  }

  .error-panel ul {
    margin: 0;
    padding-left: 20px;
  }

  .error-panel li + li {
    margin-top: 3px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(130px, 1fr)) minmax(220px, 1.35fr);
    border: 1px solid #c9d2ca;
    background: #fff;
  }

  .metric,
  .rank-summary {
    min-width: 0;
    padding: 16px 18px;
  }

  .metric + .metric,
  .rank-summary {
    border-left: 1px solid #dce2dc;
  }

  .metric p,
  .rank-summary h3 {
    margin-bottom: 11px;
    color: #64736a;
    font-size: 12px;
    font-weight: 600;
  }

  .metric strong {
    display: block;
    font-size: 28px;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }

  .metric span {
    display: block;
    margin-top: 7px;
    color: #849087;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .metric-total {
    background: #e5f0e5;
  }

  .metric-rate strong {
    color: #087253;
  }

  .rank-summary h3 {
    margin-bottom: 9px;
  }

  .rank-summary dl {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 14px;
    margin: 0;
  }

  .rank-summary dl div {
    display: flex;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }

  .rank-summary dt {
    color: #516158;
  }

  .rank-summary dd {
    margin: 0;
    font-weight: 750;
  }

  .filter-control {
    display: grid;
    gap: 6px;
    color: #536258;
    font-size: 11px;
    font-weight: 650;
  }

  .filter-control input,
  .filter-control select {
    min-width: 0;
    min-height: 38px;
    padding: 0 10px;
    border: 1px solid #bdc9bf;
    border-radius: 3px;
    background: #fff;
    color: #18251f;
  }

  .level-table-wrap {
    max-height: 320px;
    overflow: auto;
    border: 1px solid #c9d2ca;
    background: #fff;
  }

  .breakdown-tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    border-bottom: 1px solid #c9d2ca;
  }

  .breakdown-tabs button {
    min-height: 40px;
    padding: 8px 14px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: #64736a;
    font-size: 12px;
    font-weight: 650;
    white-space: nowrap;
    cursor: pointer;
  }

  .breakdown-tabs button[aria-selected='true'] {
    border-bottom-color: #087253;
    color: #075d49;
  }

  .breakdown-panel {
    max-width: 820px;
    margin-top: 14px;
  }

  .breakdown-panel h3 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 700;
  }

  .level-table,
  .score-table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    text-align: left;
  }

  caption {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .level-table th,
  .level-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #e4e9e4;
  }

  .level-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #e9efea;
    color: #4e5d53;
    font-size: 11px;
  }

  .level-table tbody th {
    font-weight: 700;
  }

  .level-table td {
    color: #415047;
  }

  .filters {
    display: grid;
    grid-template-columns: minmax(220px, 1.6fr) repeat(3, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .table-scroll {
    max-width: 100%;
    min-width: 0;
    overflow: auto;
    border: 1px solid #c9d2ca;
    background: #fff;
    overscroll-behavior-x: contain;
  }

  .score-table {
    min-width: 1160px;
  }

  .score-table th,
  .score-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #e4e9e4;
    white-space: nowrap;
  }

  .score-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #e9efea;
    color: #4e5d53;
    font-size: 11px;
  }

  .score-table thead th {
    padding: 0;
  }

  .score-table thead button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: inherit;
    font-weight: 750;
    text-align: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  .score-table thead button:hover {
    background: #dce7df;
  }

  .score-table thead button span {
    color: #087253;
  }

  .score-table tbody th {
    max-width: 280px;
    font-weight: 650;
  }

  .score-table tbody tr:hover {
    background: #f5f8f4;
  }

  .numeric {
    text-align: right !important;
  }

  .rank-value {
    font-weight: 750;
  }

  .empty-results {
    padding: 28px !important;
    color: #64736a;
    text-align: center;
  }

  .empty-state {
    padding: 54px 0 68px;
    border-bottom: 1px solid #c9d2ca;
  }

  .empty-number {
    margin-bottom: 10px;
    color: #74a58c;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .empty-state h2 {
    max-width: 540px;
    font-size: 18px;
  }

  .empty-state > p:last-child {
    margin: 8px 0 0;
    color: #64736a;
  }

  .page-footer {
    display: flex;
    justify-content: space-between;
    padding: 17px 0 24px;
    color: #34705b;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .page-footer span {
    color: #849087;
  }

  .page-footer a {
    color: inherit;
    text-underline-offset: 2px;
  }

  @media (max-width: 760px) {
    .page-shell {
      width: calc(100% - 32px);
    }

    .page-header {
      padding: 24px 0 20px;
    }

    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metric + .metric,
    .rank-summary {
      border-left: 0;
    }

    .metric:nth-child(even),
    .rank-summary {
      border-left: 1px solid #dce2dc;
    }

    .metric:nth-child(n + 3),
    .rank-summary {
      border-top: 1px solid #dce2dc;
    }

    .filters {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }

    .search-control {
      grid-column: auto;
    }
  }

  @media (max-width: 480px) {
    .page-shell {
      width: calc(100% - 24px);
    }

    h1 {
      font-size: 27px;
    }

    .section-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;
    }

    .import-controls {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;
    }

    .file-control {
      width: 100%;
    }

    .metric,
    .rank-summary {
      padding: 13px 12px;
    }

    .metric strong {
      font-size: 25px;
    }

    .level-table th,
    .level-table td {
      padding: 8px;
    }
  }
</style>
