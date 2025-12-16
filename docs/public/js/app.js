import { MathEngine } from './math_engine.js';
import { askGemini, buildPhasePrompt, estimateTokensForPrompt } from './gemini_api.js';

// DOM要素
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const analyzeBtn = document.getElementById('analyzeBtn');
const predictBtn = document.getElementById('predictBtn');
const output = document.getElementById('output');
const resultArea = document.getElementById('resultArea');
const savePredictionBtn = document.getElementById('savePredictionBtn');
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const modelSelect = document.getElementById('modelSelect');
const modelInfo = document.getElementById('modelInfo');
const tokenEstimate = document.getElementById('tokenEstimate');
const recentSummaryBox = document.getElementById('recentSummary');
const recentSummaryBody = document.getElementById('recentSummaryBody');
const historyArea = document.getElementById('historyArea');
const historyBody = document.getElementById('historyBody');
const exportHistoryBtn = document.getElementById('exportHistoryBtn');
const frequencyChartType = document.getElementById('frequencyChartType');
const frequencyPeriodType = document.getElementById('frequencyPeriodType');
const frequencyPeriodValue = document.getElementById('frequencyPeriodValue');
const updateFrequencyChart = document.getElementById('updateFrequencyChart');
const promptArea = document.getElementById('promptArea');
const promptContent = document.getElementById('promptContent');
const togglePromptBtn = document.getElementById('togglePromptBtn');
const downloadPromptBtn = document.getElementById('downloadPromptBtn');

let engine = null;
let analysisResult = null;
let analysisStats = null;
let predictionHistory = [];
let frequencyChartInstance = null;
let currentPrompt = null;

// 予測履歴の読み込み
try {
    const raw = localStorage.getItem('numbers3_prediction_history');
    if (raw) {
        predictionHistory = JSON.parse(raw);
    }
} catch (e) {
    predictionHistory = [];
}

function renderHistory() {
    if (!historyArea || !historyBody) return;
    if (!predictionHistory.length) {
        historyArea.classList.add('hidden');
        historyBody.textContent = '';
        return;
    }
    historyArea.classList.remove('hidden');
    let text = '';
    predictionHistory.forEach((item, idx) => {
        text += `#${idx + 1}  [${item.timestamp}]  model=${item.model}\n`;
        text += item.text.trim() + '\n';
        text += '----------------------------------------\n';
    });
    historyBody.textContent = text;
}

renderHistory();

// モーダルの開閉
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        if (settingsModal) {
            settingsModal.classList.remove('hidden');
            // 保存済みのAPIキーを表示
            if (apiKeyInput) {
                apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
            }
        }
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if (settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });
}

// モーダル外をクリックで閉じる
if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });
}

// APIキー管理
if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', () => {
        if (apiKeyInput) {
            localStorage.setItem('gemini_api_key', apiKeyInput.value);
            alert('API Keyを保存しました');
        }
    });
}

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
    // 初期値の復元（保存済みがあればそれ、なければデフォルトでgemini-2.5-flash）
    const savedModel = localStorage.getItem('gemini_model');
    if (savedModel) {
        modelSelect.value = savedModel;
    } else {
        // デフォルトをgemini-2.5-flashに設定
        modelSelect.value = 'gemini-2.5-flash';
        localStorage.setItem('gemini_model', 'gemini-2.5-flash');
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
        
        // 3桁すべての位について、直近500回分の最適位相を逆算
        analysisResult = engine.calculatePhaseTrendAll(500);
        // 全履歴を使った統計サマリ
        analysisStats = engine.getGlobalStats();
        
        // チャート描画
        drawChart(analysisResult);

        // 直近500回について、3桁のモデル出力と実際の3桁数字を並べて表示
        if (recentSummaryBox && recentSummaryBody) {
            const summary = engine.getRecentEquationSummaryAll(500);
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

        // プロンプト長から推定トークン数を計算し表示（直近500回分をプロンプトに含める）
        if (tokenEstimate && analysisResult && analysisResult.length) {
            const promptData = analysisResult.slice(-500); // プロンプトには直近500回分を使用
            const prompt = buildPhasePrompt(promptData, analysisStats);
            currentPrompt = prompt; // プロンプトを保存
            const estTokens = estimateTokensForPrompt(prompt);
            tokenEstimate.innerText = `推定プロンプト長: 約 ${estTokens.toLocaleString()} トークン（直近500回分の位相データを使用）`;
            
            // プロンプトエリアを表示
            if (promptArea && promptContent && togglePromptBtn) {
                promptContent.textContent = prompt;
                promptArea.classList.remove('hidden');
                promptContent.style.display = 'none'; // 初期状態は非表示
                togglePromptBtn.textContent = '表示'; // 初期状態のボタンテキスト
            }
        }
        
        predictBtn.disabled = false;
        
        // 頻出率グラフを自動表示（全期間）
        if (frequencyChartInstance) {
            frequencyChartInstance.destroy();
            frequencyChartInstance = null;
        }
        drawFrequencyChart('all', null);
        
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
        : (localStorage.getItem('gemini_model') || 'gemini-2.5-flash');

    try {
        // 500回分のデータを明示的に渡す
        const promptData = analysisResult ? analysisResult.slice(-500) : [];
        console.log(`[predictBtn] プロンプトに渡すデータ件数: ${promptData.length}`);
        const response = await askGemini(key, promptData, modelName, analysisStats);
        output.innerText = response;
        if (savePredictionBtn) {
            savePredictionBtn.disabled = false;
            savePredictionBtn.dataset.model = modelName;
        }
    } catch (e) {
        output.innerText = "Error: " + e.message;
    }
});

// 予測結果の保存
if (savePredictionBtn) {
    savePredictionBtn.addEventListener('click', () => {
        const text = output ? output.innerText : '';
        if (!text || text.trim().length === 0) {
            alert('保存できる予測結果がありません。先に「Geminiに予測させる」を実行してください。');
            return;
        }
        const modelName = savePredictionBtn.dataset.model || (modelSelect && modelSelect.value) || 'unknown';
        const now = new Date();
        const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        predictionHistory.unshift({
            timestamp: ts,
            model: modelName,
            text
        });
        // 履歴が増えすぎないように直近50件までに制限
        if (predictionHistory.length > 50) {
            predictionHistory = predictionHistory.slice(0, 50);
        }
        localStorage.setItem('numbers3_prediction_history', JSON.stringify(predictionHistory));
        renderHistory();
        alert('予測結果を保存しました。');
    });
}

// 履歴エクスポート（テキストファイル）
if (exportHistoryBtn) {
    exportHistoryBtn.addEventListener('click', () => {
        if (!predictionHistory.length) {
            alert('エクスポートできる履歴がありません。');
            return;
        }
        let text = 'Numbers3 Prediction History\n';
        text += '========================================\n\n';
        predictionHistory.forEach((item, idx) => {
            text += `#${idx + 1}  [${item.timestamp}]  model=${item.model}\n`;
            text += item.text.trim() + '\n';
            text += '----------------------------------------\n';
        });
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        a.href = url;
        a.download = `numbers3_predictions_${y}${m}${d}_${hh}${mm}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// プロンプト表示/非表示の切り替え
if (togglePromptBtn) {
    togglePromptBtn.addEventListener('click', () => {
        if (promptContent) {
            const isHidden = promptContent.style.display === 'none' || promptContent.style.display === '';
            promptContent.style.display = isHidden ? 'block' : 'none';
            togglePromptBtn.textContent = isHidden ? '非表示' : '表示';
        }
    });
}

// プロンプトのダウンロード
if (downloadPromptBtn) {
    downloadPromptBtn.addEventListener('click', () => {
        if (!currentPrompt) {
            alert('プロンプトが生成されていません。先に「データ解析・逆算開始」を実行してください。');
            return;
        }
        
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        
        const blob = new Blob([currentPrompt], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `numbers3_prompt_${y}${m}${d}_${hh}${mm}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

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

// 頻出率グラフの描画
function drawFrequencyChart(periodType = 'all', filterValue = null) {
    if (!engine) {
        alert('先に「データ解析・逆算開始」を実行してください。');
        return;
    }

    const chartType = frequencyChartType ? frequencyChartType.value : 'set';
    const ctx = document.getElementById('frequencyChart');
    
    if (!ctx) return;

    // 既存のグラフインスタンスを破棄
    if (frequencyChartInstance) {
        frequencyChartInstance.destroy();
    }

    let periodLabel = '全期間';
    if (periodType === 'year' && filterValue) {
        periodLabel = `${filterValue}年`;
    } else if (periodType === 'year_month' && filterValue) {
        periodLabel = `${filterValue}`;
    } else if (periodType === 'month_all' && filterValue) {
        periodLabel = `${parseInt(filterValue, 10)}月（全年）`;
    }

    if (chartType === 'mini') {
        // ミニ（下2桁）グラフ
        const miniData = engine.getMiniFrequencyByPeriod(periodType, filterValue);
        
        // 00-99のラベルを生成（10個ずつ表示）
        const labels = [];
        const data = [];
        const counts = [];
        for (let i = 0; i < 100; i++) {
            labels.push(String(i).padStart(2, '0'));
            data.push(parseFloat(miniData.miniRate[i]));
            counts.push(miniData.miniFreq[i]);
        }

        frequencyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '下2桁出現率',
                    data: data,
                    backgroundColor: 'rgba(138, 43, 226, 0.6)',
                    borderColor: 'rgba(138, 43, 226, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `下2桁（ミニ）出現率 (${periodLabel}) - データ件数: ${miniData.totalCount}件`,
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                const value = context.parsed.y;
                                const count = counts[index];
                                return `${labels[index]}: ${value}% (${count}回)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '出現率 (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '下2桁'
                        },
                        ticks: {
                            maxRotation: 90,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    } else {
        // セット（各桁別）グラフ
        const freqData = engine.getDigitFrequencyByPeriod(periodType, filterValue);
        const labels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

        frequencyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '百の位',
                        data: freqData.digitRateByPos[0].map(v => parseFloat(v)),
                        backgroundColor: 'rgba(88, 166, 255, 0.6)',
                        borderColor: 'rgba(88, 166, 255, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '十の位',
                        data: freqData.digitRateByPos[1].map(v => parseFloat(v)),
                        backgroundColor: 'rgba(35, 134, 54, 0.6)',
                        borderColor: 'rgba(35, 134, 54, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '一の位',
                        data: freqData.digitRateByPos[2].map(v => parseFloat(v)),
                        backgroundColor: 'rgba(255, 140, 0, 0.6)',
                        borderColor: 'rgba(255, 140, 0, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `各桁の数字出現率 (${periodLabel}) - データ件数: ${freqData.totalCount}件`,
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const datasetLabel = context.dataset.label || '';
                                const value = context.parsed.y;
                                const index = context.dataIndex;
                                // freqDataはクロージャでアクセス可能
                                const posIndex = context.datasetIndex; // 0=百, 1=十, 2=一
                                const count = freqData.digitFreqByPos[posIndex][index];
                                return `${datasetLabel}: ${value}% (${count}回)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '出現率 (%)'
                        },
                        max: 15
                    },
                    x: {
                        title: {
                            display: true,
                            text: '数字'
                        }
                    }
                }
            }
        });
    }
}

// 期間タイプ変更時の処理
if (frequencyPeriodType) {
    frequencyPeriodType.addEventListener('change', () => {
        const periodType = frequencyPeriodType.value;
        const periodValueSelect = frequencyPeriodValue;
        
        if (periodType === 'all') {
            periodValueSelect.style.display = 'none';
            periodValueSelect.value = '';
        } else {
            periodValueSelect.style.display = 'block';
            periodValueSelect.innerHTML = '<option value="">選択してください</option>';
            
            if (!engine) {
                alert('先に「データ解析・逆算開始」を実行してください。');
                return;
            }
            
            const periods = engine.getAvailablePeriods();

            let options = [];
            if (periodType === 'year') {
                options = periods.years || [];
                options.forEach(period => {
                    const option = document.createElement('option');
                    option.value = period;
                    option.textContent = `${period}年`;
                    periodValueSelect.appendChild(option);
                });
            } else if (periodType === 'year_month') {
                options = periods.yearMonths || [];
                options.forEach(period => {
                    const option = document.createElement('option');
                    option.value = period;
                    option.textContent = period;
                    periodValueSelect.appendChild(option);
                });
            } else if (periodType === 'month_all') {
                options = periods.monthNumbers || [];
                options.forEach(mm => {
                    const option = document.createElement('option');
                    option.value = mm;
                    option.textContent = `${parseInt(mm, 10)}月（全年）`;
                    periodValueSelect.appendChild(option);
                });
            }
        }
    });
}

// グラフタイプ変更時の処理
if (frequencyChartType) {
    frequencyChartType.addEventListener('change', () => {
        // グラフタイプが変更されたら、現在の期間設定で再描画
        const periodType = frequencyPeriodType ? frequencyPeriodType.value : 'all';
        const filterValue = frequencyPeriodValue && frequencyPeriodValue.value 
            ? frequencyPeriodValue.value 
            : null;
        
        if (periodType === 'all' || filterValue) {
            drawFrequencyChart(periodType, filterValue);
        }
    });
}

// グラフ更新ボタンの処理
if (updateFrequencyChart) {
    updateFrequencyChart.addEventListener('click', () => {
        const periodType = frequencyPeriodType ? frequencyPeriodType.value : 'all';
        const filterValue = frequencyPeriodValue && frequencyPeriodValue.value 
            ? frequencyPeriodValue.value 
            : null;
        
        if (periodType !== 'all' && !filterValue) {
            alert('期間を選択してください。');
            return;
        }
        
        drawFrequencyChart(periodType, filterValue);
    });
}
