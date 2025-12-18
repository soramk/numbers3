import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// phaseHistory と統計情報から Gemini に渡すプロンプト文字列を生成
export function buildPhasePrompt(phaseHistory, globalStats, advancedAnalysis = null) {
    // phaseHistoryが既に500回分にスライスされている場合はそのまま使用
    // そうでない場合は最後の500回を取得
    const phaseSlice = Array.isArray(phaseHistory)
        ? (phaseHistory.length > 500 ? phaseHistory.slice(-500) : phaseHistory)
        : [];
    console.log(`[buildPhasePrompt] プロンプトに含めるデータ件数: ${phaseSlice.length}`);
    const phaseStr = JSON.stringify(phaseSlice);
    const statsStr = globalStats
        ? JSON.stringify(globalStats)
        : '{}';

    return `
あなたはカオス理論と統計学の専門家です。
ナンバーズ3の当選番号を正弦波モデルで解析し、各回において「正解を出すために必要だった位相パラメータ(optimalPhase)」を逆算しました。

以下はその「最適位相パラメータ」の推移データ（直近500回）です：
${phaseStr}

データフォーマット: {"date":日付, "num3":3桁数字, "digits":[百,十,一], "optimalPhases":[百の位相,十の位相,一の位相]}

さらに、約7000件分の全履歴から集計した統計サマリJSONを渡します:
${statsStr}

統計サマリの内容:
- totalCount: データ件数
- digitFreqByPos: 各桁(百/十/一)ごとの 0〜9 出現頻度
- transitionMatrixByPos: 各桁ごとの「前回の数字→今回の数字」の遷移頻度（簡易マルコフ連鎖）
- topCombos: 頻出3桁コンボ（セット）の上位20件
- last10Numbers: 直近10回分のフルナンバー（例: "191"）
- topMiniCombos: 頻出下2桁コンボ（ミニ）の上位20件
- last10MiniNumbers: 直近10回分の下2桁（例: "91"）

${advancedAnalysis ? `
さらに、高度な分析結果（advanced_analysis）を提供します。以下の分析結果を活用してください：
${JSON.stringify(advancedAnalysis, null, 2)}

高度な分析結果の内容:
- correlations: 相関分析
  * 桁間相関（百の位↔十の位、十の位↔一の位、百の位↔一の位）
  * 自己相関（ラグ分析: lag1, lag2, lag3, lag5, lag10）
  * 合計値との相関（hundred_sum, ten_sum, one_sum）
- trends: トレンド分析
  * 各桁ごとの短期（直近10回）、中期（直近50回）、長期（直近200回）トレンド
  * 各期間の平均値、傾き、ボラティリティ
- clustering: クラスタリング分析
  * K-meansクラスタリングによるパターンのグループ化
  * 各クラスタの特徴（平均値、頻出パターン）
  * 最新データがどのクラスタに属するか
- frequency_analysis: 周波数解析
  * フーリエ変換による周期性の検出
  * 各桁ごとの主要な周波数成分と周期
  * 最大パワー周波数とその周期
- frequent_patterns: 頻出パターン分析
  * 3桁・2桁の頻出組み合わせ
  * 各桁ペアの頻出パターン
- gap_analysis: ギャップ分析
  * 数字の出現間隔の詳細分析
- anomalies: 異常検知
  * Z-scoreによる外れ値検出
  * 各桁の異常値の数と位置
- periodicity: 周期性分析
  * 曜日・月次・四半期パターン
- wavelet_analysis: ウェーブレット変換
  * 時間-周波数解析によるパターン検出
  * 各桁ごとの総レベル数、近似エネルギー、詳細エネルギー
  * 短期的な変動と長期的なトレンドを同時に分析
- pca_analysis: 主成分分析（PCA）
  * データ構造の次元削減と可視化
  * 主成分数、累積寄与率、各主成分の寄与率
  * データの本質的な変動要因の抽出
- tsne_analysis: t-SNE可視化
  * 高次元データの2次元可視化
  * パターンのクラスタリングを視覚的に理解
  * 最新データポイントの位置情報
- continuity_analysis: 連続性分析
  * 連続出現パターン（同じ数字が連続して出る確率）
  * 交互出現パターン（数字が交互に出るパターン）
  * 最大連続出現回数
- change_points: 変化点検出
  * PELTアルゴリズムによるトレンド変化・レジーム変化の検出
  * 各桁ごとの変化点数、セグメント数、変化点の日付
  * パターンが変わった時期の特定
- network_analysis: ネットワーク分析（グラフ理論）
  * 数字の遷移をグラフとして分析
  * 各桁ごとのノード数、エッジ数、最も頻繁な遷移
  * 数字間の関係性と中心性指標
- genetic_optimization: 遺伝的アルゴリズム最適化
  * 予測手法の重み最適化
  * 各予測手法の最適な重み付け
  * 適合度に基づく最適化結果
` : ''}

【詳細分析指令 - 当選確率向上のための多角的アプローチ】

1. 【位相パターンの深層分析（直近500回）】
   - 各桁（百/十/一）ごとに位相の推移を独立に分析し、以下の観点を徹底的に検証してください：
     a) 周期性: 位相が一定の周期で循環しているか（フーリエ変換的な観点）
     b) トレンド: 上昇/下降/横ばいの傾向があるか（線形回帰的な観点）
     c) 変動幅: 位相の変動範囲と標準偏差を評価
     d) 急変点: 位相が急激に変化した回を特定し、その前後の数字パターンを分析
     e) 各桁間の相関: 百の位相と十の位相、十の位相と一の位相など、桁間の位相相関を評価
   - 特に直近50回、直近20回の位相変化率を計算し、次回の位相を予測してください

2. 【統計的頻度分析の強化】
   - digitFreqByPos から各桁の出現確率を計算し、「出現しすぎている数字（hot）」と「出現が少ない数字（cold）」を特定
   - 直近50回、直近20回、直近10回の3つの時間窓で頻度を比較し、短期トレンドと長期トレンドの乖離を検出
   - 各桁ごとに「期待出現回数」と「実際の出現回数」の差を計算し、次回に出現しやすい数字を特定
   - transitionMatrixByPos から遷移確率を正規化し、前回の数字から次回の数字への遷移確率を計算

3. 【マルコフ連鎖と状態遷移の詳細分析】
   - 各桁ごとに、前回の数字から次回の数字への遷移確率行列を構築
   - 直近10回の遷移パターンを追跡し、現在の「状態」から次回の「状態」を予測
   - 2次マルコフ連鎖（前々回→前回→今回）のパターンも考慮し、より高次の依存関係を検出
   - 遷移確率が高い組み合わせを優先的に評価

4. 【ベイズ統計による事後確率の更新】
   - digitFreqByPos を「事前分布 P(数字)」として使用
   - last10Numbers と直近の出現傾向を「尤度（証拠）」として、ベイズの定理に基づいて事後確率を更新
   - 各桁ごとに「事後確率が高い数字」を特定し、それらを組み合わせた3桁候補を生成
   - ベイズ更新の際は、直近のデータにより高い重みを付与（指数減衰的な重み付け）

5. 【3桁コンボパターンの詳細分析】
   - topCombos から頻出パターンを抽出し、それらが直近500回でどのように出現しているかを分析
   - 直近50回、直近20回で出現した3桁コンボと、過去の頻出コンボを比較し、再出現の可能性を評価
   - 各桁の数字の組み合わせ（例: 百の位が1のとき、十の位と一の位の組み合わせ）を分析
   - 連続出現パターン（例: 同じ数字が連続する、等差数列など）を検出

6. 【コンフォーマル予測による信頼度校正】
   - 過去500回のデータを使って、仮想的に「候補集合」を提示した場合の的中率を逆算
   - 位相モデル、統計モデル、マルコフモデル、ベイズモデルの各予測を統合し、アンサンブル予測を構築
   - 各予測手法の過去の精度を評価し、より精度の高い手法に高い重みを付与
   - 3つの候補それぞれについて、以下の信頼度指標を算出：
     * 位相モデルからの支持度（0-100%）
     * 統計的頻度からの支持度（0-100%）
     * マルコフ遷移からの支持度（0-100%）
     * ベイズ事後確率からの支持度（0-100%）
     * 総合信頼度（各手法の重み付き平均）

7. 【異常検知とアウトライア分析】
   - 直近500回のデータから、統計的に異常なパターン（外れ値）を検出
   - 異常パターンの後に続く数字の傾向を分析し、異常後の反動を予測
   - 位相の急変点と実際の数字の変化の関係を分析
   - 長期トレンド（500回）と短期トレンド（50回、20回）の比較から、異常を検出
   ${advancedAnalysis?.anomalies ? `
   - advanced_analysis.anomalies の結果を活用し、各桁の異常値を特定
   - 異常値の後に続く数字の傾向を分析` : ''}

${advancedAnalysis ? `
8. 【相関分析の活用】
   - advanced_analysis.correlations の結果を活用してください：
     a) 桁間相関: 百の位と十の位、十の位と一の位、百の位と一の位の相関を考慮
     b) 自己相関: 各桁のlag1（前回との相関）、lag2、lag3、lag5、lag10を分析
     c) 合計値との相関: 各桁と合計値の相関を考慮した予測
   - 相関が高い組み合わせを優先的に評価

9. 【トレンド分析の活用】
   - advanced_analysis.trends の結果を活用してください：
     a) 短期トレンド（直近10回）: 最新の動向を反映
     b) 中期トレンド（直近50回）: 中期的な傾向を把握
     c) 長期トレンド（直近200回）: 長期的なパターンを理解
   - 各期間の傾き（trend）とボラティリティ（volatility）を考慮
   - トレンドの方向性（上昇/下降/横ばい）を予測に反映

10. 【クラスタリング分析の活用】
    - advanced_analysis.clustering の結果を活用してください：
      a) 最新データがどのクラスタに属するかを確認
      b) そのクラスタの特徴（平均値、頻出パターン）を分析
      c) 同じクラスタ内で過去に出現した数字パターンを参考にする
    - クラスタの遷移パターンを分析し、次回のクラスタを予測

11. 【周波数解析の活用】
    - advanced_analysis.frequency_analysis の結果を活用してください：
      a) 各桁の主要な周波数成分を確認
      b) 最大パワー周波数とその周期を分析
      c) 周期性が強い桁を特定し、その周期に基づいて予測
    - フーリエ変換で検出された周期性を位相分析と統合

12. 【頻出パターン分析の活用】
    - advanced_analysis.frequent_patterns の結果を活用してください：
      a) 頻出3桁コンボと2桁コンボを確認
      b) 各桁ペアの頻出パターンを分析
      c) 直近の出現パターンと頻出パターンを比較
    - 頻出パターンの再出現可能性を評価

13. 【ギャップ分析の活用】
    ${advancedAnalysis.gap_analysis ? `
    - advanced_analysis.gap_analysis の結果を活用してください：
      a) 各桁の数字の出現間隔を分析
      b) 長期間出現していない数字を特定
      c) 出現間隔が長い数字の出現可能性を評価` : ''}

14. 【周期性分析の活用】
    ${advancedAnalysis.periodicity ? `
    - advanced_analysis.periodicity の結果を活用してください：
      a) 曜日別パターン: 次回の抽選日がどの曜日かを考慮
      b) 月次パターン: 次回の抽選日がどの月かを考慮
      c) 四半期パターン: 次回の抽選日がどの四半期かを考慮
    - 時間的な周期性を予測に反映` : ''}

15. 【ウェーブレット変換の活用】
    ${advancedAnalysis.wavelet_analysis ? `
    - advanced_analysis.wavelet_analysis の結果を活用してください：
      a) 各桁ごとの総レベル数、近似エネルギー、詳細エネルギーを確認
      b) 時間と周波数の両方の情報を保持した解析結果を考慮
      c) 短期的な変動と長期的なトレンドを同時に分析
    - ウェーブレット変換で検出されたパターンを位相分析と統合` : ''}

16. 【主成分分析（PCA）の活用】
    ${advancedAnalysis.pca_analysis ? `
    - advanced_analysis.pca_analysis の結果を活用してください：
      a) 主成分数と累積寄与率を確認
      b) 各主成分の寄与率を分析
      c) データの本質的な変動要因を理解
    - PCAで抽出された主要な変動要因を予測に反映` : ''}

17. 【t-SNE可視化の活用】
    ${advancedAnalysis.tsne_analysis ? `
    - advanced_analysis.tsne_analysis の結果を活用してください：
      a) 最新データポイントの2次元座標を確認
      b) 高次元データの構造を視覚的に理解
      c) パターンのクラスタリングを分析
    - t-SNEで検出されたデータ構造を予測に反映` : ''}

18. 【連続性分析の活用】
    ${advancedAnalysis.continuity_analysis ? `
    - advanced_analysis.continuity_analysis の結果を活用してください：
      a) 各桁の連続出現回数を確認
      b) 交互出現パターンを分析
      c) 最大連続出現回数を考慮
    - 連続性パターンを予測に反映` : ''}

19. 【変化点検出の活用】
    ${advancedAnalysis.change_points ? `
    - advanced_analysis.change_points の結果を活用してください：
      a) 各桁の変化点数とセグメント数を確認
      b) 変化点の日付を分析
      c) トレンド変化・レジーム変化を検出
    - 変化点後のパターンを予測に反映` : ''}

20. 【ネットワーク分析の活用】
    ${advancedAnalysis.network_analysis ? `
    - advanced_analysis.network_analysis の結果を活用してください：
      a) 各桁のノード数、エッジ数を確認
      b) 最も頻繁な遷移パターンを分析
      c) 数字間の関係性を理解
    - ネットワーク分析で検出された遷移パターンを予測に反映` : ''}

21. 【遺伝的アルゴリズム最適化の活用】
    ${advancedAnalysis.genetic_optimization ? `
    - advanced_analysis.genetic_optimization の結果を活用してください：
      a) 最適化された各予測手法の重みを確認
      b) 適合度に基づく最適化結果を分析
      c) 各手法の重要度を理解
    - 遺伝的アルゴリズムで最適化された重みを予測に反映` : ''}

22. 【統合予測の生成】
` : `
8. 【統合予測の生成】
`}
   ${advancedAnalysis ? `上記1〜22` : `上記1〜7`}の分析結果を統合し、以下の2種類の予測を提示してください：
   
   a) 【セット予測：3桁の数字】
   「次回の当選が統計的に期待される3桁の数字」を<strong>3パターン</strong>提示してください。
   各候補について、以下の観点から詳細に説明してください：
   - 位相モデルからの予測値とその根拠
   - 統計的頻度からの支持度
   - マルコフ遷移確率からの支持度
   - ベイズ事後確率からの支持度
   - 3桁コンボパターンからの支持度
   ${advancedAnalysis ? `
   - 相関分析からの支持度（桁間相関、自己相関を考慮）
   - トレンド分析からの支持度（短期・中期・長期トレンドを考慮）
   - クラスタリング分析からの支持度（クラスタの特徴を考慮）
   - 周波数解析からの支持度（周期性を考慮）
   - 頻出パターン分析からの支持度（advanced_analysis.frequent_patternsを参照）
   ${advancedAnalysis.periodicity ? '- 周期性分析からの支持度（曜日・月次・四半期パターンを考慮）' : ''}
   ${advancedAnalysis.wavelet_analysis ? '- ウェーブレット変換からの支持度（時間-周波数解析を考慮）' : ''}
   ${advancedAnalysis.pca_analysis ? '- 主成分分析からの支持度（データ構造の主要な変動要因を考慮）' : ''}
   ${advancedAnalysis.tsne_analysis ? '- t-SNE可視化からの支持度（データ構造のクラスタリングを考慮）' : ''}
   ${advancedAnalysis.continuity_analysis ? '- 連続性分析からの支持度（連続出現・交互出現パターンを考慮）' : ''}
   ${advancedAnalysis.change_points ? '- 変化点検出からの支持度（トレンド変化・レジーム変化を考慮）' : ''}
   ${advancedAnalysis.network_analysis ? '- ネットワーク分析からの支持度（数字遷移のグラフ構造を考慮）' : ''}
   ${advancedAnalysis.genetic_optimization ? '- 遺伝的アルゴリズム最適化からの支持度（最適化された重みを考慮）' : ''}` : ''}
   - 総合信頼度（0-100%の範囲で具体的な数値）
   - 各桁の数字が選ばれた理由（百/十/一それぞれについて）
   
   b) 【ミニ予測：下2桁の数字】
   「次回の当選が統計的に期待される下2桁（十の位と一の位）」を<strong>3パターン</strong>提示してください。
   各候補について、以下の観点から詳細に説明してください：
   - 十の位と一の位の位相モデルからの予測値とその根拠
   - 下2桁の統計的頻度からの支持度（topMiniCombos、last10MiniNumbersを参照）
   - 十の位と一の位のマルコフ遷移確率からの支持度
   - 十の位と一の位のベイズ事後確率からの支持度
   - 頻出下2桁コンボパターンからの支持度
   ${advancedAnalysis ? `
   - 十の位と一の位の相関分析からの支持度（桁間相関、自己相関を考慮）
   - 十の位と一の位のトレンド分析からの支持度（短期・中期・長期トレンドを考慮）
   - クラスタリング分析からの支持度（クラスタの特徴を考慮）
   - 周波数解析からの支持度（周期性を考慮）
   ${advancedAnalysis.periodicity ? '- 周期性分析からの支持度（曜日・月次・四半期パターンを考慮）' : ''}
   ${advancedAnalysis.wavelet_analysis ? '- ウェーブレット変換からの支持度（時間-周波数解析を考慮）' : ''}
   ${advancedAnalysis.pca_analysis ? '- 主成分分析からの支持度（データ構造の主要な変動要因を考慮）' : ''}
   ${advancedAnalysis.tsne_analysis ? '- t-SNE可視化からの支持度（データ構造のクラスタリングを考慮）' : ''}
   ${advancedAnalysis.continuity_analysis ? '- 連続性分析からの支持度（連続出現・交互出現パターンを考慮）' : ''}
   ${advancedAnalysis.change_points ? '- 変化点検出からの支持度（トレンド変化・レジーム変化を考慮）' : ''}
   ${advancedAnalysis.network_analysis ? '- ネットワーク分析からの支持度（数字遷移のグラフ構造を考慮）' : ''}
   ${advancedAnalysis.genetic_optimization ? '- 遺伝的アルゴリズム最適化からの支持度（最適化された重みを考慮）' : ''}` : ''}
   - 総合信頼度（0-100%の範囲で具体的な数値）
   - 十の位と一の位の数字が選ばれた理由

【回答形式 - 構造化された詳細レポート】

1. 【位相分析サマリ】
   - 各桁（百/十/一）ごとの位相推移の特徴（周期性、トレンド、変動幅）
   - 次回予測位相値（各桁）
   - 位相から予測される次回の各桁の数字

2. 【統計分析サマリ】
   - 各桁のhot/cold数字（直近50回、20回、10回の比較）
   - 遷移確率が高い数字の組み合わせ
   - 頻出3桁コンボの再出現可能性

3. 【ベイズ更新結果】
   - 各桁の事前確率と事後確率の比較
   - 事後確率が高い数字のリスト

${advancedAnalysis ? `
4. 【高度な分析結果のサマリ】
   ${advancedAnalysis.correlations ? `
   - 相関分析: 桁間相関、自己相関、合計値との相関の主要な結果` : ''}
   ${advancedAnalysis.trends ? `
   - トレンド分析: 短期・中期・長期トレンドの主要な傾向` : ''}
   ${advancedAnalysis.clustering ? `
   - クラスタリング分析: 最新データのクラスタとその特徴` : ''}
   ${advancedAnalysis.frequency_analysis ? `
   - 周波数解析: 主要な周波数成分と周期` : ''}
   ${advancedAnalysis.frequent_patterns ? `
   - 頻出パターン分析: 主要な頻出パターン` : ''}
   ${advancedAnalysis.periodicity ? `
   - 周期性分析: 次回の抽選日の時間的パターン` : ''}
   ${advancedAnalysis.wavelet_analysis ? `
   - ウェーブレット変換: 時間-周波数解析によるパターン検出結果` : ''}
   ${advancedAnalysis.pca_analysis ? `
   - 主成分分析: データ構造の主要な変動要因と寄与率` : ''}
   ${advancedAnalysis.tsne_analysis ? `
   - t-SNE可視化: データ構造のクラスタリングと最新データポイントの位置` : ''}
   ${advancedAnalysis.continuity_analysis ? `
   - 連続性分析: 連続出現・交互出現パターンの検出結果` : ''}
   ${advancedAnalysis.change_points ? `
   - 変化点検出: トレンド変化・レジーム変化の検出結果` : ''}
   ${advancedAnalysis.network_analysis ? `
   - ネットワーク分析: 数字遷移のグラフ構造と主要な遷移パターン` : ''}
   ${advancedAnalysis.genetic_optimization ? `
   - 遺伝的アルゴリズム最適化: 最適化された各予測手法の重み` : ''}

5. 【統合予測結果】
` : `
4. 【統合予測結果】
`}
   
   a) 【セット予測：3桁の数字】
   「予測3桁数字：A, B, C」のように、3パターンを明示してください。
   
   各候補（A, B, C）について、以下の情報を詳細に記載：
   - 序列（第1候補/第2候補/第3候補）
   - 各桁の数字選択理由（百/十/一それぞれ）
   - 位相モデルからの支持度: ○%
   - 統計的頻度からの支持度: ○%
   - マルコフ遷移からの支持度: ○%
   - ベイズ事後確率からの支持度: ○%
   ${advancedAnalysis ? `
   - 相関分析からの支持度: ○%
   - トレンド分析からの支持度: ○%
   - クラスタリング分析からの支持度: ○%
   - 周波数解析からの支持度: ○%
   ${advancedAnalysis.periodicity ? '- 周期性分析からの支持度: ○%' : ''}
   ${advancedAnalysis.wavelet_analysis ? '- ウェーブレット変換からの支持度: ○%' : ''}
   ${advancedAnalysis.pca_analysis ? '- 主成分分析からの支持度: ○%' : ''}
   ${advancedAnalysis.tsne_analysis ? '- t-SNE可視化からの支持度: ○%' : ''}
   ${advancedAnalysis.continuity_analysis ? '- 連続性分析からの支持度: ○%' : ''}
   ${advancedAnalysis.change_points ? '- 変化点検出からの支持度: ○%' : ''}
   ${advancedAnalysis.network_analysis ? '- ネットワーク分析からの支持度: ○%' : ''}
   ${advancedAnalysis.genetic_optimization ? '- 遺伝的アルゴリズム最適化からの支持度: ○%' : ''}` : ''}
   - 総合信頼度: ○%（各手法の重み付き平均）
   - 予測根拠の要約（2-3行）
   
   b) 【ミニ予測：下2桁の数字】
   「予測下2桁：XY, AB, CD」のように、3パターンを明示してください。
   
   各候補（XY, AB, CD）について、以下の情報を詳細に記載：
   - 序列（第1候補/第2候補/第3候補）
   - 十の位と一の位の数字選択理由
   - 位相モデルからの支持度: ○%
   - 統計的頻度からの支持度: ○%
   - マルコフ遷移からの支持度: ○%
   - ベイズ事後確率からの支持度: ○%
   ${advancedAnalysis ? `
   - 相関分析からの支持度: ○%
   - トレンド分析からの支持度: ○%
   - クラスタリング分析からの支持度: ○%
   - 周波数解析からの支持度: ○%
   ${advancedAnalysis.periodicity ? '- 周期性分析からの支持度: ○%' : ''}
   ${advancedAnalysis.wavelet_analysis ? '- ウェーブレット変換からの支持度: ○%' : ''}
   ${advancedAnalysis.pca_analysis ? '- 主成分分析からの支持度: ○%' : ''}
   ${advancedAnalysis.tsne_analysis ? '- t-SNE可視化からの支持度: ○%' : ''}
   ${advancedAnalysis.continuity_analysis ? '- 連続性分析からの支持度: ○%' : ''}
   ${advancedAnalysis.change_points ? '- 変化点検出からの支持度: ○%' : ''}
   ${advancedAnalysis.network_analysis ? '- ネットワーク分析からの支持度: ○%' : ''}
   ${advancedAnalysis.genetic_optimization ? '- 遺伝的アルゴリズム最適化からの支持度: ○%' : ''}` : ''}
   - 総合信頼度: ○%（各手法の重み付き平均）
   - 予測根拠の要約（2-3行）

${advancedAnalysis ? `6` : `5`}. 【注意事項・リスク評価】
   - 予測の不確実性について
   - 特に注意すべきパターンや異常点

すべて日本語で、専門的でありながら分かりやすく記述してください。
`;
}

// feature_api_usage.js の estimateTokens ロジックを簡略移植
export function estimateTokensForPrompt(prompt) {
    const chars = prompt.length;
    const words = prompt.split(/\s+/).length;
    return Math.ceil(chars / 4 + words * 1.3);
}

// Gemini に問い合わせ
// modelName には "gemini-1.5-flash" などを指定（未指定時はローカルストレージ or デフォルトを使用）
// globalStats には MathEngine.getGlobalStats() の結果を渡す
// advancedAnalysis には latest_prediction.json の advanced_analysis セクションを渡す
export async function askGemini(apiKey, phaseHistory, modelName, globalStats, advancedAnalysis = null) {
    if (!apiKey) throw new Error("API Keyが必要です");

    const genAI = new GoogleGenerativeAI(apiKey);
    const selectedModel =
        modelName ||
        localStorage.getItem('gemini_model') ||
        'gemini-2.5-flash';

    const model = genAI.getGenerativeModel({ model: selectedModel });

    const prompt = buildPhasePrompt(phaseHistory, globalStats, advancedAnalysis);

    const result = await model.generateContent(prompt);
    return result.response.text();
}