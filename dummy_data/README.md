# ポートフォリオ用ダミーデータ

このフォルダは、ポートフォリオ掲載用の架空データです。

実在の会社名、顧客名、品番、ロット番号、担当者名、検査値、規格番号は使用していません。業務アプリ画面の再現、説明資料、Notion/GitHub Pages掲載、クラウドワークス・ランサーズの実績説明に使う前提です。

## ファイル一覧

| ファイル | 用途 |
| --- | --- |
| `case01_production_inventory_quality_records.csv` | 生産計画・在庫管理・品質判定の連携例 |
| `case02_quality_analysis_records.csv` | 多品種品質判定ダッシュボードの例 |
| `case03_inventory_shipping_records.csv` | 在庫管理・出荷可否・不適合移動の例 |
| `case04_claim_management_records.csv` | クレーム管理・是正処置ウィザードの例 |
| `case05_task_kanban_records.json` | 業務タスク管理ガントチャートの親子タスク例 |
| `case06_resident_life_records.json` | 在留生活支援チェックリストの例 |
| `case07_moltbook_agent_log.json` | 自律型SNS AIエージェントの実行ログ例 |

## 使い方

- CSVはExcelで開いて、業務アプリ風の一覧画面やグラフ素材として使えます。
- JSONはタスクガント、チェックリスト、実行ログのモック作成に使えます。
- 画面キャプチャ用にアプリへ投入する場合は、フィールドコードに合わせて列名を調整してください。
