import { MathEngine } from './math_engine.js';
import { askGemini } from './gemini_api.js';

// DOM要素
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const analyzeBtn = document.getElementById('analyzeBtn');
const predictBtn = document.getElementById('predictBtn');
const output = document.getElementById('output');
const resultArea = document.getElementById('resultArea');

let engine = null;
let analysisResult = null;

// APIキー管理
saveKeyBtn.addEventListener('click', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
    alert('API Keyを保存しました');
});
apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';

// データロードと解析実行
analyzeBtn.addEventListener('click', async () => {
    try {
        // data.jsonをfetch
        const response = await fetch('data.json');
        const data = await response.json();
        
        engine = new MathEngine(data);
        
        // 例として「百の位(index 0)」を解析
        analysisResult = engine.calculatePhaseTrend(0);
        
        // チャート描画
        drawChart(analysisResult);
        
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

    try {
        const response = await askGemini(key, analysisResult);
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