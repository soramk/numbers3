# 追加可能な高度な分析手法

## 現在実装済みの分析手法
1. カオス理論（位相トレンド）
2. マルコフ連鎖（遷移確率）
3. ベイズ統計（事前分布と尤度）
4. 周期性分析（曜日・月次・四半期）
5. 頻出パターン分析
6. 相関分析
7. トレンド分析
8. クラスタリング分析（K-means）
9. ギャップ分析
10. 異常検知（Z-score）

## 追加可能な高度な分析手法

### 1. フーリエ変換による周波数解析 ⭐⭐⭐⭐⭐
**優先度: 最高**

- **概要**: 時系列データを周波数領域に変換し、周期性やサイクルを検出
- **メリット**: 隠れた周期性を発見できる、位相分析の補完
- **実装難易度**: 中
- **必要なライブラリ**: numpy, scipy（既にインストール済み）
- **実装例**:
```python
def analyze_frequency_domain(self):
    """フーリエ変換による周波数解析"""
    from scipy.fft import fft, fftfreq
    
    for pos in ['hundred', 'ten', 'one']:
        data = self.df[pos].values
        # FFTを実行
        fft_values = fft(data)
        frequencies = fftfreq(len(data))
        
        # 主要な周波数成分を抽出
        power_spectrum = np.abs(fft_values) ** 2
        dominant_freqs = np.argsort(power_spectrum)[-5:][::-1]
        
    return dominant_frequencies
```

### 2. 隠れマルコフモデル（HMM） ⭐⭐⭐⭐
**優先度: 高**

- **概要**: 観測できない状態遷移をモデル化
- **メリット**: より複雑なパターンを捉えられる
- **実装難易度**: 中
- **必要なライブラリ**: hmmlearn（追加必要）
- **実装例**:
```python
from hmmlearn import hmm

def predict_with_hmm(self):
    """隠れマルコフモデルによる予測"""
    model = hmm.GaussianHMM(n_components=10, covariance_type="full")
    # データを学習
    # 次の状態を予測
```

### 3. ARIMAモデル（自己回帰和分移動平均） ⭐⭐⭐⭐
**優先度: 高**

- **概要**: 時系列データのトレンドと季節性をモデル化
- **メリット**: 統計的に確立された手法、予測精度が高い
- **実装難易度**: 中
- **必要なライブラリ**: statsmodels（追加必要）
- **実装例**:
```python
from statsmodels.tsa.arima.model import ARIMA

def predict_with_arima(self):
    """ARIMAモデルによる予測"""
    model = ARIMA(data, order=(p, d, q))
    fitted_model = model.fit()
    forecast = fitted_model.forecast(steps=1)
```

### 4. ウェーブレット変換 ⭐⭐⭐
**優先度: 中**

- **概要**: 時間と周波数の両方の情報を保持した変換
- **メリット**: 短期的な変動と長期的なトレンドを同時に分析
- **実装難易度: 中**
- **必要なライブラリ**: PyWavelets（追加必要）

### 5. 主成分分析（PCA） ⭐⭐⭐
**優先度: 中**

- **概要**: 多次元データを低次元に圧縮し、主要な変動要因を抽出
- **メリット**: データの本質的な構造を理解できる
- **実装難易度: 低**
- **必要なライブラリ**: scikit-learn（既にインストール済み）

### 6. t-SNEによる可視化 ⭐⭐⭐
**優先度: 中**

- **概要**: 高次元データを2次元に可視化
- **メリット**: パターンのクラスタリングを視覚的に理解
- **実装難易度: 低**
- **必要なライブラリ**: scikit-learn（既にインストール済み）

### 7. ランダムフォレスト ⭐⭐⭐⭐
**優先度: 高**

- **概要**: 複数の決定木を組み合わせたアンサンブル学習
- **メリット**: 特徴量の重要度を評価できる、予測精度が高い
- **実装難易度: 低**
- **必要なライブラリ**: scikit-learn（既にインストール済み）

### 8. XGBoost / LightGBM ⭐⭐⭐⭐⭐
**優先度: 最高**

- **概要**: 勾配ブースティングによる強力な機械学習モデル
- **メリット**: 非常に高い予測精度、特徴量の重要度分析
- **実装難易度: 低**
- **必要なライブラリ**: xgboost, lightgbm（追加必要）

### 9. LSTM（長短期記憶）ニューラルネットワーク ⭐⭐⭐⭐
**優先度: 高**

- **概要**: 時系列データに特化した深層学習モデル
- **メリット**: 長期依存関係を学習できる、予測精度が高い
- **実装難易度: 高**
- **必要なライブラリ**: tensorflow/keras（追加必要）

### 10. 遺伝的アルゴリズムによる最適化 ⭐⭐⭐
**優先度: 中**

- **概要**: 生物の進化を模倣した最適化手法
- **メリット**: 複雑な最適化問題を解ける
- **実装難易度: 中**
- **必要なライブラリ**: DEAP（追加必要）

### 11. ネットワーク分析（グラフ理論） ⭐⭐⭐
**優先度: 中**

- **概要**: 数字の遷移をグラフとして分析
- **メリット**: 数字間の関係性を視覚化
- **実装難易度: 中**
- **必要なライブラリ**: networkx（追加必要）

### 12. コンフォーマル予測 ⭐⭐⭐⭐
**優先度: 高**

- **概要**: 予測区間を統計的に保証する手法
- **メリット**: 予測の不確実性を定量化できる
- **実装難易度: 中**
- **必要なライブラリ**: 自前実装可能

### 13. カルマンフィルタ ⭐⭐⭐
**優先度: 中**

- **概要**: 状態空間モデルによる時系列予測
- **メリット**: ノイズを含むデータでも精度が高い
- **実装難易度: 中**
- **必要なライブラリ**: filterpy（追加必要）

### 14. アンサンブル学習の改善（スタッキング） ⭐⭐⭐⭐
**優先度: 高**

- **概要**: 複数の予測モデルを組み合わせるメタ学習
- **メリット**: 各モデルの長所を活かせる
- **実装難易度: 低**
- **必要なライブラリ**: scikit-learn（既にインストール済み）

### 15. 特徴量エンジニアリングの強化 ⭐⭐⭐⭐
**優先度: 高**

- **概要**: より多くの特徴量を作成
  - 移動平均（MA）
  - 指数移動平均（EMA）
  - RSI（相対力指数）
  - MACD（移動平均収束拡散）
  - ボリンジャーバンド
- **メリット**: 予測精度の向上
- **実装難易度: 低**
- **必要なライブラリ**: なし（自前実装可能）

## 推奨実装順序

### フェーズ1（すぐに実装可能・効果大）
1. **フーリエ変換による周波数解析** - 隠れた周期性を発見
2. **特徴量エンジニアリングの強化** - 移動平均、RSI、MACDなど
3. **ランダムフォレスト** - 特徴量の重要度分析と予測

### フェーズ2（中期的に実装）
4. **XGBoost / LightGBM** - 高精度な予測モデル
5. **ARIMAモデル** - 統計的に確立された時系列予測
6. **スタッキング** - アンサンブル学習の改善

### フェーズ3（長期的に検討）
7. **LSTM** - 深層学習による予測
8. **隠れマルコフモデル** - より複雑なパターン認識
9. **コンフォーマル予測** - 予測区間の保証

## 実装例（フーリエ変換）

```python
def analyze_frequency_domain(self) -> Dict[str, any]:
    """
    フーリエ変換による周波数解析
    
    Returns:
        周波数解析結果の辞書
    """
    from scipy.fft import fft, fftfreq
    
    frequency_analysis = {}
    
    for pos in ['hundred', 'ten', 'one']:
        data = self.df[pos].values.astype(float)
        
        # FFTを実行
        fft_values = fft(data)
        frequencies = fftfreq(len(data))
        
        # パワースペクトルを計算
        power_spectrum = np.abs(fft_values) ** 2
        
        # 正の周波数のみを取得
        positive_freq_idx = frequencies > 0
        positive_freqs = frequencies[positive_freq_idx]
        positive_power = power_spectrum[positive_freq_idx]
        
        # 主要な周波数成分を抽出（上位5つ）
        top5_idx = np.argsort(positive_power)[-5:][::-1]
        dominant_freqs = []
        
        for idx in top5_idx:
            freq = positive_freqs[idx]
            power = positive_power[idx]
            period = 1 / freq if freq > 0 else 0
            
            dominant_freqs.append({
                'frequency': float(freq),
                'power': float(power),
                'period': float(period) if period > 0 else 0
            })
        
        frequency_analysis[pos] = {
            'dominant_frequencies': dominant_freqs,
            'max_power_frequency': float(positive_freqs[np.argmax(positive_power)]),
            'max_power_period': float(1 / positive_freqs[np.argmax(positive_power)]) if positive_freqs[np.argmax(positive_power)] > 0 else 0
        }
    
    return frequency_analysis
```

## 実装例（ランダムフォレスト）

```python
def predict_with_random_forest(self) -> Dict[str, any]:
    """
    ランダムフォレストによる予測
    
    Returns:
        予測結果の辞書
    """
    from sklearn.ensemble import RandomForestRegressor
    
    predictions = {}
    
    # 特徴量を作成（過去N回のデータ）
    window_size = 20
    features = []
    targets = []
    
    for i in range(window_size, len(self.df)):
        feature = []
        for j in range(window_size):
            feature.extend([
                self.df.iloc[i - window_size + j]['hundred'],
                self.df.iloc[i - window_size + j]['ten'],
                self.df.iloc[i - window_size + j]['one'],
                self.df.iloc[i - window_size + j]['sum'],
                self.df.iloc[i - window_size + j]['span']
            ])
        features.append(feature)
        targets.append([
            self.df.iloc[i]['hundred'],
            self.df.iloc[i]['ten'],
            self.df.iloc[i]['one']
        ])
    
    features_array = np.array(features)
    targets_array = np.array(targets)
    
    # ランダムフォレストで学習
    rf = RandomForestRegressor(n_estimators=100, random_state=42)
    rf.fit(features_array, targets_array)
    
    # 最新データから予測
    latest_features = features[-1].reshape(1, -1)
    predicted = rf.predict(latest_features)[0]
    
    predictions['hundred'] = int(np.round(predicted[0])) % 10
    predictions['ten'] = int(np.round(predicted[1])) % 10
    predictions['one'] = int(np.round(predicted[2])) % 10
    
    set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
    mini_pred = f"{predictions['ten']}{predictions['one']}"
    
    # 特徴量の重要度を取得
    feature_importance = rf.feature_importances_
    
    return {
        'method': 'random_forest',
        'set_prediction': set_pred,
        'mini_prediction': mini_pred,
        'confidence': 0.75,
        'reason': 'ランダムフォレストによる予測',
        'feature_importance': feature_importance.tolist()
    }
```

## 実装例（特徴量エンジニアリング）

```python
def create_advanced_features(self) -> pd.DataFrame:
    """
    高度な特徴量を作成
    
    Returns:
        特徴量が追加されたDataFrame
    """
    df = self.df.copy()
    
    # 移動平均（MA）
    for window in [5, 10, 20, 50]:
        for pos in ['hundred', 'ten', 'one']:
            df[f'{pos}_ma{window}'] = df[pos].rolling(window=window).mean()
    
    # 指数移動平均（EMA）
    for alpha in [0.1, 0.3, 0.5]:
        for pos in ['hundred', 'ten', 'one']:
            df[f'{pos}_ema{alpha}'] = df[pos].ewm(alpha=alpha).mean()
    
    # RSI（相対力指数）
    for pos in ['hundred', 'ten', 'one']:
        delta = df[pos].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df[f'{pos}_rsi'] = 100 - (100 / (1 + rs))
    
    # MACD（移動平均収束拡散）
    for pos in ['hundred', 'ten', 'one']:
        ema12 = df[pos].ewm(span=12).mean()
        ema26 = df[pos].ewm(span=26).mean()
        df[f'{pos}_macd'] = ema12 - ema26
        df[f'{pos}_macd_signal'] = df[f'{pos}_macd'].ewm(span=9).mean()
    
    # ボリンジャーバンド
    for pos in ['hundred', 'ten', 'one']:
        ma20 = df[pos].rolling(window=20).mean()
        std20 = df[pos].rolling(window=20).std()
        df[f'{pos}_bb_upper'] = ma20 + (std20 * 2)
        df[f'{pos}_bb_lower'] = ma20 - (std20 * 2)
        df[f'{pos}_bb_width'] = df[f'{pos}_bb_upper'] - df[f'{pos}_bb_lower']
    
    return df
```

