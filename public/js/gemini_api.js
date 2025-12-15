import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// phaseHistory から Gemini に渡すプロンプト文字列を生成
export function buildPhasePrompt(phaseHistory) {
    const dataStr = JSON.stringify(phaseHistory.slice(-15)); // 直近15回分を送る

    return `
あなたはカオス理論と統計学の専門家です。
ナンバーズ3の当選番号を正弦波モデルで解析し、各回において「正解を出すために必要だった位相パラメータ(optimalPhase)」を逆算しました。

以下はその「最適位相パラメータ」の推移データです：
${dataStr}

データフォーマット: {"date":日付, "actual":実際の当選数字, "optimalPhase":その時の最適位相}

指令:
1. 位相(optimalPhase)の変動パターン（上昇トレンド、周期性、急激な変化など）を分析してください。
2. 次回（未来）の「最適位相」を予測してください。
3. その予測された位相を数式に代入し、「次回の当選が期待される3桁の数字」を<strong>3パターン</strong>提示してください（例: 123, 456, 789）。

回答形式:
簡単な分析コメントと、最終的な「予測3桁数字：A, B, C」のように3パターンを提示してください。
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
export async function askGemini(apiKey, phaseHistory, modelName) {
    if (!apiKey) throw new Error("API Keyが必要です");

    const genAI = new GoogleGenerativeAI(apiKey);
    const selectedModel =
        modelName ||
        localStorage.getItem('gemini_model') ||
        'gemini-1.5-flash';

    const model = genAI.getGenerativeModel({ model: selectedModel });

    const prompt = buildPhasePrompt(phaseHistory);

    const result = await model.generateContent(prompt);
    return result.response.text();
}