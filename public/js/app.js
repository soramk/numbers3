import { MathEngine } from './math_engine.js';
import { askGemini, buildPhasePrompt, estimateTokensForPrompt } from './gemini_api.js';

// DOM要素
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const analyzeBtn = document.getElementById('analyzeBtn');
const predictBtn = document.getElementById('predictBtn');
const output = document.getElementById('output');
const resultArea = document.getElementById('resultArea');
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const modelSelect = document.getElementById('modelSelect');
const modelInfo = document.getElementById('modelInfo');
const tokenEstimate = document.getElementById('tokenEstimate');
const recentSummaryBox = document.getElementById('recentSummary');
const recentSummaryBody = document.getElementById('recentSummaryBody');

let engine = null;
let analysisResult = null;
let analysisStats = null;

// APIキー管理
saveKeyBtn.addEventListener('click', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
    alert('API Keyを保存しました');
});
apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';

// Geminiモデル一覧を取得してセレクトに反映
async function fetchModels() {
    const key = apiKeyInput.value || localStorage.getItem('gemini_api_key');
    if (!key) {
        alert('先に Gemini API Key を入力して保存してください。');
        return;
    }
    try {
        if (modelInfo) {
            modelInfo.innerText = 'モデル一覧を取得中...';
        }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (data.error) {
            throw new Error(data.error.message || 'APIエラー');
        }
        const models = (data.models || []).filter(m =>
            m.supportedGenerationMethods?.includes('generateContent')
        );
        if (!models.length) {
            throw new Error('generateContent に対応したモデルが見つかりませんでした。');
        }
        if (modelSelect) {
            modelSelect.innerHTML = '';
            models.forEach(m => {
                const opt = document.createElement('option');
                // name は "models/gemini-1.5-flash" 形式なので末尾だけを使う
                const shortName = m.name.replace('models/', '');
                opt.value = shortName;
                opt.textContent = m.displayName || shortName;
                modelSelect.appendChild(opt);
            });
            // 保存済みモデルがあれば選択
            const saved = localStorage.getItem('gemini_model');
            if (saved && Array.from(modelSelect.options).some(o => o.value === saved)) {
                modelSelect.value = saved;
            }
        }
        if (modelInfo) {
            modelInfo.innerText = 'モデル一覧の取得に成功しました。';
        }
    } catch (e) {
        console.error(e);
        if (modelInfo) {
            modelInfo.innerText = 'モデル取得エラー: ' + (e.message || e);
        } else {
            alert('モデル取得エラー: ' + (e.message || e));
        }
    }
}

if (fetchModelsBtn) {
    fetchModelsBtn.addEventListener('click', fetchModels);
}

if (modelSelect) {
    // 初期値の復元
    const savedModel = localStorage.getItem('gemini_model');
    if (savedModel) {
        modelSelect.value = savedModel;
    }
    modelSelect.addEventListener('change', () => {
        localStorage.setItem('gemini_model', modelSelect.value);
    });
}

// データロードと解析実行
analyzeBtn.addEventListener('click', async () => {
    try {
        // ルート index.html から見ると data.json は public/ 配下
        const response = await fetch('public/data.json');
        const data = await response.json();
        
        engine = new MathEngine(data);
        
        // 3桁すべての位について、直近30回分の最適位相を逆算
        analysisResult = engine.calculatePhaseTrendAll(30);
        // 全履歴を使った統計サマリ
        analysisStats = engine.getGlobalStats();
        
        // チャート描画
        drawChart(analysisResult);

        // 直近30回について、3桁のモデル出力と実際の3桁数字を並べて表示
        if (recentSummaryBox && recentSummaryBody) {
            const summary = engine.getRecentEquationSummaryAll(30);
            let text = '';
            text += '日付        実際(3桁)  方程式(3桁)   位相(百,十,一)\n';
            text += '---------------------------------------------------\n';
            summary.forEach(row => {
                const dateStr = row.date;
                const actualStr = String(row.actual3);
                const modelStr = String(row.model3);
                const phaseStr = `(${row.phases[0].toFixed(2)},${row.phases[1].toFixed(2)},${row.phases[2].toFixed(2)})`;
                text += `${dateStr}   ${actualStr}      ${modelStr}        ${phaseStr}\n`;
            });
            text += '\n※ 各桁の方程式: y = floor( 5 * sin( 0.5 * t + Phase_pos ) + 5 ) mod 10';
            recentSummaryBody.textContent = text;
            recentSummaryBox.classList.remove('hidden');
        }

        // プロンプト長から推定トークン数を計算し表示
        if (tokenEstimate && analysisResult && analysisResult.length) {
            const prompt = buildPhasePrompt(analysisResult, analysisStats);
            const estTokens = estimateTokensForPrompt(prompt);
            tokenEstimate.innerText = `推定プロンプト長: 約 ${estTokens.toLocaleString()} トークン`;
        }
        
        predictBtn.disabled = false;
        alert('解析完了。係数の推移グラフを表示しました。');
    } catch (e) {
        console.error(e);
        alert('データ読み込みエラー');
    }
});

// Gemini予測実行
predictBtn.addEventListener('click', async () => {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) return alert('API Keyを設定してください');

    resultArea.classList.remove('hidden');
    output.innerText = "Geminiが思考中... 数式のゆらぎを解析しています...";

    // 選択中のモデル名
    const modelName = modelSelect && modelSelect.value
        ? modelSelect.value
        : (localStorage.getItem('gemini_model') || 'gemini-1.5-flash');

    try {
        const response = await askGemini(key, analysisResult, modelName, analysisStats);
        output.innerText = response;
    } catch (e) {
        output.innerText = "Error: " + e.message;
    }
});

// Chart.jsによるグラフ描画
function drawChart(data) {
    const ctx = document.getElementById('coeffChart').getContext('2d');
    const labels = data.map(d => d.date.slice(5)); // 月日のみ
    // グラフは代表として「百の位」の位相と数字を表示
    const phases = data.map(d => d.optimalPhases[0]);
    const actuals = data.map(d => d.digits[0]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '最適位相 (Equation Parameter)',
                    data: phases,
                    borderColor: '#58a6ff',
                    yAxisID: 'y'
                },
                {
                    label: '実際の数字 (Actual)',
                    data: actuals,
                    borderColor: '#238636',
                    borderDash: [5, 5],
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', display: true, position: 'left', title: {display:true, text:'Phase(0-6.28)'} },
                y1: { type: 'linear', display: true, position: 'right', min:0, max:9, grid: {drawOnChartArea: false} }
            }
        }
    });
}