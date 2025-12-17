# ナンバーズ3予測ツール

GitHub Pagesで運用するナンバーズ3の予測ツールです。GitHub Actionsを利用してPythonで高度な分析を行い、結果をJSONとして出力します。

## 特徴

- 🤖 **6つの予測手法**: カオス理論、マルコフ連鎖、ベイズ統計、周期性分析、頻出パターン分析、ランダムフォレスト
- 📊 **高度な分析**: 相関分析、トレンド分析、クラスタリング、周波数解析など
- 🔄 **自動データ取得**: Webスクレイピングで最新の当選番号を自動取得
- 📈 **特徴量エンジニアリング**: 移動平均、EMA、RSI、MACD、ボリンジャーバンドなどの技術指標
- 📚 **学術的説明**: 各予測手法の理論的背景と参考文献を表示
- 🎨 **モダンなUI**: Tailwind CSSとChart.jsによる美しいインターフェース

## アーキテクチャ

- **バックエンド**: Python分析スクリプト (`analyze.py`)
  - 6つの予測手法で予測
  - アンサンブル予測で統合
  - Webスクレイピングで最新データを自動取得
  - 結果を `docs/data/latest_prediction.json` に出力
  - 履歴管理機能（複数の予測結果を保存）

- **CI/CD**: GitHub Actions (`.github/workflows/daily_update.yml`)
  - 毎日22:00 JSTに自動実行
  - 最新の当選番号をWebから自動取得してデータを更新
  - 手動実行も可能

- **フロントエンド**: 静的HTML/JS (`docs/index.html`, `docs/app.js`)
  - Tailwind CSSでモダンなUI
  - Chart.jsで位相グラフと分析結果を可視化
  - JSONを読み込んで予測結果を表示
  - 予測履歴の選択機能
  - 各予測手法の詳細分析過程を表示

## セットアップ

### 1. リポジトリの準備

```bash
# リポジトリをクローン
git clone https://github.com/your-username/numbers3.git
cd numbers3
```

### 2. ローカルでのテスト

```bash
# Python環境のセットアップ（推奨: venv）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存ライブラリのインストール
pip install -r requirements.txt

# 分析スクリプトの実行
python analyze.py
```

### 3. GitHub Pagesの設定

1. GitHubリポジトリの Settings > Pages に移動
2. Source を "Deploy from a branch" に設定
3. Branch を "main" (または "master") に設定
4. Folder を "/docs" に設定
5. Save をクリック

### 4. GitHub Actionsの設定

ワークフローは自動的に実行されますが、初回実行時は手動で実行することもできます：

1. GitHubリポジトリの Actions タブに移動
2. "Daily Prediction Update" ワークフローを選択
3. "Run workflow" ボタンをクリック

## ファイル構造

```
numbers3/
├── analyze.py                    # Python分析スクリプト（Webスクレイピング + 予測分析）
├── requirements.txt              # Python依存関係
├── public/
│   └── data.json                # バックエンド用データ（全履歴）
├── docs/                        # GitHub Pages用フロントエンド
│   ├── index.html               # メインページ（予測結果表示）
│   ├── analyzer.html            # 詳細分析ツール（Gemini版）
│   ├── app.js                   # メインページ用JS
│   ├── data/
│   │   ├── latest_prediction.json      # 最新の予測結果（自動生成）
│   │   ├── prediction_history.json     # 予測履歴リスト（自動生成）
│   │   └── prediction_YYYY-MM-DD_HHMMSS.json  # 個別の予測履歴（自動生成）
│   └── public/
│       └── data.json            # フロントエンド用データ
├── tools/                       # ユーティリティ
│   └── N3抽出ツール.js          # ブックマークレット（データ抽出用）
└── .github/
    └── workflows/
        └── daily_update.yml     # GitHub Actionsワークフロー
```

## 予測手法

### 1. カオス理論（Chaos Theory）
- **手法**: 位相空間における軌跡の分析
- **使用分析**: トレンド分析（短期・中期・長期）
- **特徴**: 非線形動的システムのパターンを検出

### 2. マルコフ連鎖（Markov Chain）
- **手法**: 状態遷移確率行列による予測
- **使用分析**: 相関分析（自己相関、桁間相関）
- **特徴**: 直前の状態のみに依存する確率過程

### 3. ベイズ統計（Bayesian Statistics）
- **手法**: 事前確率と尤度から事後確率を計算
- **使用分析**: 頻出パターン分析、トレンド分析
- **特徴**: データが増えるにつれて精度が向上

### 4. 周期性分析（Periodicity Analysis）
- **手法**: 曜日・月次・四半期パターンの分析
- **使用分析**: 周期性分析、周波数解析
- **特徴**: 時間的な規則性を発見

### 5. 頻出パターン分析（Frequent Pattern Analysis）
- **手法**: データマイニングによる頻出組み合わせの抽出
- **使用分析**: 頻出パターン分析、相関分析
- **特徴**: 過去の出現頻度から予測

### 6. ランダムフォレスト（Random Forest）
- **手法**: 複数の決定木を組み合わせたアンサンブル学習
- **使用分析**: トレンド分析、相関分析、クラスタリング、周波数解析
- **特徴**: 特徴量の重要度を評価、高精度な予測

## 高度な分析手法

### 相関分析（Correlation Analysis）
- 桁間相関（百の位↔十の位、十の位↔一の位、百の位↔一の位）
- 自己相関（ラグ分析: 1回前、2回前、3回前、5回前、10回前）
- 合計値との相関

### トレンド分析（Trend Analysis）
- 短期トレンド（直近10回）
- 中期トレンド（直近50回）
- 長期トレンド（直近200回）
- 各期間の平均値、傾き、ボラティリティを分析

### クラスタリング分析（Clustering Analysis）
- K-meansクラスタリングによるパターンのグループ化
- 各クラスタの特徴（平均値、頻出パターン）を分析
- 最新データがどのクラスタに属するかを判定

### 周波数解析（Frequency Analysis）
- フーリエ変換による周期性の検出
- 主要な周波数成分と周期を抽出
- 隠れた周期性を発見

### その他の分析
- **頻出パターン抽出**: 3桁・2桁の頻出組み合わせ
- **ギャップ分析**: 数字の出現間隔の詳細分析
- **異常検知**: Z-scoreによる外れ値検出

## 特徴量エンジニアリング

ランダムフォレストで使用する高度な特徴量：

- **移動平均（MA）**: 5回、10回、20回、50回の移動平均
- **指数移動平均（EMA）**: α=0.1, 0.3, 0.5の指数移動平均
- **RSI（相対力指数）**: 14期間のRSI
- **MACD**: 12期間EMA、26期間EMA、9期間シグナル
- **ボリンジャーバンド**: 20期間、±2σのバンド

## データソース

以下のサイトから最新の当選番号を自動取得：

- みずほ銀行 宝くじコーナー: https://www.mizuhobank.co.jp/takarakuji/check/numbers/numbers3/index.html
- 楽天宝くじ: https://takarakuji.rakuten.co.jp/backnumber/numbers3/

## ライセンス

MIT License
