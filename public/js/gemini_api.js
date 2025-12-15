import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// phaseHistory と統計情報から Gemini に渡すプロンプト文字列を生成
export function buildPhasePrompt(phaseHistory, globalStats) {
    const phaseSlice = Array.isArray(phaseHistory)
        ? phaseHistory.slice(-30)
        : [];
    const phaseStr = JSON.stringify(phaseSlice);
    const statsStr = globalStats
        ? JSON.stringify(globalStats)
        : '{}';

    return `
あなたはカオス理論と統計学の専門家です。
ナンバーズ3の当選番号を正弦波モデルで解析し、各回において「正解を出すために必要だった位相パラメータ(optimalPhase)」を逆算しました。

以下はその「最適位相パラメータ」の推移データ（直近30回）です：
${phaseStr}

データフォーマット: {"date":日付, "actual":実際の当選数字, "optimalPhase":その時の最適位相}

さらに、約7000件分の全履歴から集計した統計サマリJSONを渡します:
${statsStr}

統計サマリの内容（例）:
- totalCount: データ件数
- digitFreqByPos: 各桁(百/十/一)ごとの 0〜9 出現頻度
- transitionMatrixByPos: 各桁ごとの「前回の数字→今回の数字」の遷移頻度（簡易マルコフ連鎖）
- topCombos: 頻出3桁コンボの上位20件
- last10Numbers: 直近10回分のフルナンバー（例: "191"）

指令:
1. 位相(optimalPhase)の変動パターン（上昇トレンド、周期性、急激な変化など）を分析してください。
2. digitFreqByPos と transitionMatrixByPos、topCombos、last10Numbers を組み合わせて、
   - 単純頻度
   - 遷移確率（マルコフ連鎖的な観点）
   - 直近トレンド（hot/cold 数字）
   を総合的に評価してください。
3. 上記の統計情報を「ベイズ統計」の観点で解釈してください。
   - digitFreqByPos を「事前分布」とみなし、
   - last10Numbers や直近の出現傾向を「尤度（新しい証拠）」とみなして、
   - 概念的なレベルで事後的に有力となる数字パターンを説明してください（厳密な数式計算までは不要）。
4. 過去データのパターン（topCombos や last10Numbers など）を使い、「コンフォーマル予測」の考え方を簡易的に適用してください。
   - 過去に「有力候補集合」として選ぶとすればどの程度の被覆率（的中率）が期待できたか、
   - 今回の3つの候補集合について、おおよその信頼度（例: 40〜60% 程度などのレンジ）を言語的にキャリブレーションしてください。
5. 1〜4の結果を統合し、「次回の当選が統計的に期待される3桁の数字」を<strong>3パターン</strong>提示してください（例: 123, 456, 789）。
   それぞれについて、なぜ有力だと判断したのかを、
   - 頻度・遷移・直近トレンド
   - 位相モデル
   - ベイズ的な事前/事後の直感
   - コンフォーマル予測的な信頼度校正
   の両面（複数観点）から簡潔に説明してください。

回答形式:
1. 分析コメント（位相モデル + 統計モデル + ベイズ + 簡易コンフォーマル予測の観点）
2. 「予測3桁数字：A, B, C」のように、3パターンを明示してください。
3. 各候補 A, B, C について、
   - 「第1候補」「第2候補」「第3候補」などの序列
   - ベイズ的な観点からみた相対的な有力度
   - コンフォーマル予測に基づくおおよその信頼度レンジ（例: 約○〜○% 程度）
   を日本語で簡潔に添えてください。
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
export async function askGemini(apiKey, phaseHistory, modelName, globalStats) {
    if (!apiKey) throw new Error("API Keyが必要です");

    const genAI = new GoogleGenerativeAI(apiKey);
    const selectedModel =
        modelName ||
        localStorage.getItem('gemini_model') ||
        'gemini-1.5-flash';

    const model = genAI.getGenerativeModel({ model: selectedModel });

    const prompt = buildPhasePrompt(phaseHistory, globalStats);

    const result = await model.generateContent(prompt);
    return result.response.text();
}