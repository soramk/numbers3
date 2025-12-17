# ナンバーズ3予測ツール

GitHub Pagesで運用するナンバーズ3の予測ツールです。GitHub Actionsを利用してPythonで分析を行い、結果をJSONとして出力します。

## アーキテクチャ

- **バックエンド**: Python分析スクリプト (`analyze.py`)
  - カオス理論、マルコフ連鎖、ベイズ統計の3つの手法で予測
  - アンサンブル予測で統合
  - 結果を `docs/data/latest_prediction.json` に出力

- **CI/CD**: GitHub Actions (`.github/workflows/daily_update.yml`)
  - 毎日22:00 JSTに自動実行
  - 最新の当選番号をWebから自動取得してデータを更新
  - 手動実行も可能

- **フロントエンド**: 静的HTML/JS (`docs/index.html`, `docs/app.js`)
  - Tailwind CSSでモダンなUI
  - Chart.jsで位相グラフを表示
  - JSONを読み込んで予測結果を表示

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
│   │   └── latest_prediction.json  # 予測結果（自動生成）
│   └── public/                  # フロントエンド用静的ファイル
│       ├── data.json            # フロントエンド用データ
│       ├── styles.css           # スタイルシート
│       └── js/                  # JavaScriptファイル
│           ├── app.js           # 詳細分析ツール用JS
│           ├── gemini_api.js    # Gemini API連携
│           └── math_engine.js   # 数学エンジン
├── tools/                       # ユーティリティ
│   └── N3抽出ツール.js          # ブックマークレット（データ抽出用）
└── .github/
    └── workflows/
        └── daily_update.yml     # GitHub Actionsワークフロー
```

## 予測手法

1. **カオス理論**: 位相の線形トレンドから予測
2. **マルコフ連鎖**: 遷移確率行列から予測
3. **ベイズ統計**: 事前分布と尤度から事後確率を計算

各手法の予測を統合して、最終的な予測を生成します。

## ライセンス

MIT License
