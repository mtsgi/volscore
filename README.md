# volscore

プレー記録CSVをブラウザー内で集計・閲覧するレスポンシブなスコアツールです。読み込んだデータは端末内のメモリだけで処理し、保存・送信しません。

## 開発

Node.js 22以降を使います。

```sh
npm install
npx playwright install chromium
npm run dev
```

## 検証とビルド

```sh
npm test
npm run check
npm run lint
npm run build
npm run preview
```

## CSV

UTF-8の`.csv`を選択してください。`example.csv`と同じ11個のヘッダーが必要ですが、列の順序は問いません。余分な列は無視されます。必須値の不正、重複する「楽曲名+難易度」、プレー回数とクリア回数の矛盾があればファイル全体を読み込みません。EXスコアの`0`は未記録として表示されます。

## GitHub Pages

既定ブランチへのpushで`.github/workflows/deploy.yml`がテスト・ビルド・デプロイを行います。GitHubリポジトリの **Settings > Pages > Build and deployment** でSourceを **GitHub Actions** に設定してください。デプロイ先はProject siteの`/volscore/`です。

## PWA

HTTPS環境（localhostを含む）で一度オンライン表示すると、アプリ本体とアイコンがキャッシュされ、以降はオフラインでも起動できます。ブラウザーのメニューからホーム画面への追加・インストールができます。読み込んだCSVのデータはキャッシュ・永続化されません。
