# GitHub Pages でポートフォリオを公開する手順

## GitHub Pages とは？

GitHub Pages とは、GitHub のリポジトリに置いた HTML/CSS/JavaScript ファイルを、インターネット上に無料で公開できる機能です。

この `docs` フォルダの `index.html` をそのまま公開すれば、ブラウザで見られるポートフォリオサイトになります。

> **注意**: 無料で使う場合、リポジトリは **public（公開）** にする必要があります。private（非公開）のままだと、GitHub Pro 契約が必要です。

---

## 公開までの大まかな流れ

1. この `kintone` リポジトリを GitHub に push する
2. GitHub 上で Pages の設定をする
3. 数分待つと URL が発行される

---

## 準備はすでに整っています

ポートフォリオ用のファイルは `docs` フォルダにまとめてあり、トップページも `docs/index.html` として配置済みです。

`docs` フォルダの中身：

```
docs/
├── index.html          ← ポートフォリオのトップページ
├── mock/
│   └── index.html      ← 同上（バックアップ兼用）
├── profile.md
├── cases_summary.md
├── case01_production_inventory_quality_platform.md
├── case02_quality_analysis_dashboard.md
├── case03_inventory_shipping_app.md
├── case04_claim_management_workflow.md
├── case05_task_kanban_dashboard.md
├── case06_resident_life_checklist.md
├── case07_moltbook_ai_agent.md
├── dummy_data/
├── demo/
│   └── warehouse-3d/
│       ├── index.html
│       ├── inventory_3d_warehouse.js
│       ├── inventory_3d_warehouse.css
│       └── three.min.js
└── github-pages-guide.md
```

---

## 手順

### 1. GitHub に push する

まだ GitHub にアップロードしていない場合は、以下のコマンドを実行します。

```bash
cd /f/repositories/kintone
git add docs
git commit -m "portfolio: GitHub Pages 用に docs フォルダを追加"
git push origin main
```

もし `kintone` リポジトリが GitHub にまだない場合は、先に GitHub 上で `kintone` という名前の空リポジトリを作成してから push してください。

### 2. GitHub 上で Pages 設定をする

1. GitHub で `kintone` リポジトリを開く
2. 上部メニューの **Settings** をクリック
3. 左メニューから **Pages** を選択
4. **Build and deployment** セクションで:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `docs` を選択
   - **Save** をクリック

### 3. 公開 URL を確認する

しばらく待つと、以下のような URL が表示されます。

```
https://あなたのGitHubユーザー名.github.io/kintone/
```

---

## 別リポジトリにしたい場合

`kintone` リポジトリは業務コードが入っているため、ポートフォリオだけ別リポジトリにしたい場合は、以下のようにします。

1. GitHub 上で新しいリポジトリを作る（例: `kintone-portfolio`）
2. `docs` フォルダの中身をそのリポジトリのルートにコピー
3. GitHub Pages の Source を `/ (root)` に設定
4. URLは `https://あなたのGitHubユーザー名.github.io/kintone-portfolio/` になります

---

## 注意点

- **反映までに時間がかかる**: 設定後、数分〜10分程度で公開されます。焦らず待ってください。
- **private リポジトリの場合**: GitHub Pro 契約が必要です。無料で公開するなら public にしてください。
- **個人情報の確認**: 公開前に `.env` ファイルや API キー、会社名、個人名が含まれていないか確認してください。
- **public 化する前の確認**: リポジトリを public にする場合、ルートディレクトリの `.env` ファイルなどが Git 管理下に残っていないか確認してください。`docs` フォルダ方式でも、public リポジトリは誰でもクローンできるため、履歴ごと秘密情報が見える状態にならないよう注意が必要です。
- **画像やデータ**: `dummy_data` は架空データなのでそのまま公開しても問題ありません。

---

## 公開後にやるといいこと

- クラウドワークス・ランサーズのプロフィール欄に URL を貼る
- SNS や名刺に QR コード付きで掲載する
- 提案資料にスクリーンショットと URL を併記する
