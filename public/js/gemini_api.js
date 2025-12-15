import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

export async function askGemini(apiKey, phaseHistory) {
    if (!apiKey) throw new Error("API Keyが必要です");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 統計データを文字列化してプロンプトに埋め込む
    const dataStr = JSON.stringify(phaseHistory.slice(-15)); // 直近15回分を送る

    const prompt = `
    あなたはカオス理論と統計学の専門家です。
    ナンバーズ3の当選番号を正弦波モデルで解析し、各回において「正解を出すために必要だった位相パラメータ(optimalPhase)」を逆算しました。
    
    以下はその「最適位相パラメータ」の推移データです：
    ${dataStr}

    データフォーマット: {"date":日付, "actual":実際の当選数字, "optimalPhase":その時の最適位相}

    指令:
    1. 位相(optimalPhase)の変動パターン（上昇トレンド、周期性、急激な変化など）を分析してください。
    2. 次回（未来）の「最適位相」を予測してください。
    3. その予測された位相を数式に代入し、次回の予測数字（0〜9）を1つ決定してください。
    
    回答形式:
    簡単な分析コメントと、最終的な「予測数字：X」を提示してください。
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
}