import { MathEngine } from './math_engine.js';
import { askGemini, buildPhasePrompt, estimateTokensForPrompt } from './gemini_api.js';

// DOM要素
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const analyzeBtn = document.getElementById('analyzeBtn');
const predictBtn = document.getElementById('predictBtn');
const output = document.getElementById('output');
const resultArea = document.getElementById('resultArea');
const manualDataInput = document.getElementById('manualDataInput');
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const modelSelect = document.getElementById('modelSelect');
const modelInfo = document.getElementById('modelInfo');
const tokenEstimate = document.getElementById('tokenEstimate');

let engine = null;
let analysisResult = null;

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

// テキストエリアから TSV 形式をパース
function parseManualData(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const records = [];

    for (const line of lines) {
        // タブ or 空白区切りを許可
        const parts = line.split(/[\t ]+/);
        if (parts.length < 3) continue;
        const date = parts[1];
        const num = parts[2];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (!/^\d{3}$/.test(num)) continue;
        records.push({ date, num });
    }

    return records;
}

// データロードと解析実行
analyzeBtn.addEventListener('click', async () => {
    try {
        let data;

        // 手入力データがある場合はそちらを優先
        const manualText = (manualDataInput && manualDataInput.value.trim()) ? manualDataInput.value.trim() : '';
        if (manualText) {
            const parsed = parseManualData(manualText);
            if (!parsed.length) {
                alert('手入力データの形式が正しくありません。例の形式に従ってください。');
                return;
            }
            data = parsed;
        } else {
            // ルート index.html から見ると data.json は public/ 配下
            const response = await fetch('public/data.json');
            data = await response.json();
        }
        
        engine = new MathEngine(data);
        
        // 例として「百の位(index 0)」を解析
        analysisResult = engine.calculatePhaseTrend(0);
        
        // チャート描画
        drawChart(analysisResult);

        // プロンプト長から推定トークン数を計算し表示
        if (tokenEstimate && analysisResult && analysisResult.length) {
            const prompt = buildPhasePrompt(analysisResult);
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
        const response = await askGemini(key, analysisResult, modelName);
        output.innerText = response;
    } catch (e) {
        output.innerText = "Error: " + e.message;
    }
});

// Chart.jsによるグラフ描画
function drawChart(data) {
    const ctx = document.getElementById('coeffChart').getContext('2d');
    const labels = data.map(d => d.date.slice(5)); // 月日のみ
    const phases = data.map(d => d.optimalPhase);
    const actuals = data.map(d => d.actual);

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