/**
 * ナンバーズ3予測ツール - フロントエンド
 * GitHub Actionsで生成されたJSONを読み込んで表示
 */

let predictionData = null;
let phaseChart = null;

// ページ読み込み時にデータを取得
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadPredictionData();
    } catch (error) {
        showError('予測データの読み込みに失敗しました: ' + error.message);
    }
});

/**
 * 予測データを読み込む
 */
async function loadPredictionData() {
    const response = await fetch('data/latest_prediction.json');
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    predictionData = await response.json();
    renderContent();
}

/**
 * コンテンツをレンダリング
 */
function renderContent() {
    if (!predictionData) return;

    // ローディングを非表示
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');

    // 基本情報を表示
    renderBasicInfo();
    
    // セット予測を表示
    renderSetPredictions();
    
    // ミニ予測を表示
    renderMiniPredictions();
    
    // 位相グラフを描画
    renderPhaseChart();
    
    // 予測手法の詳細を表示
    renderMethodDetails();
}

/**
 * 基本情報を表示
 */
function renderBasicInfo() {
    const timestamp = new Date(predictionData.timestamp);
    const lastUpdate = document.getElementById('lastUpdate');
    lastUpdate.textContent = timestamp.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const totalRecords = document.getElementById('totalRecords');
    totalRecords.textContent = predictionData.statistics.total_records.toLocaleString() + '件';
}

/**
 * セット予測を表示
 */
function renderSetPredictions() {
    const container = document.getElementById('setPredictions');
    container.innerHTML = '';

    predictionData.set_predictions.forEach((pred, index) => {
        const card = createPredictionCard(pred, index + 1, 'blue');
        container.appendChild(card);
    });
}

/**
 * ミニ予測を表示
 */
function renderMiniPredictions() {
    const container = document.getElementById('miniPredictions');
    container.innerHTML = '';

    predictionData.mini_predictions.forEach((pred, index) => {
        const card = createPredictionCard(pred, index + 1, 'green');
        container.appendChild(card);
    });
}

/**
 * 予測カードを作成
 */
function createPredictionCard(prediction, rank, color) {
    const card = document.createElement('div');
    
    // カラーマッピング
    const colorMap = {
        'blue': {
            bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
            border: 'border-blue-300',
            borderT: 'border-blue-200',
            bar: 'bg-blue-600'
        },
        'green': {
            bg: 'bg-gradient-to-br from-green-50 to-green-100',
            border: 'border-green-300',
            borderT: 'border-green-200',
            bar: 'bg-green-600'
        }
    };
    
    const colors = colorMap[color] || colorMap.blue;
    card.className = `${colors.bg} rounded-lg p-4 border-2 ${colors.border}`;
    
    const confidencePercent = (prediction.confidence * 100).toFixed(1);
    const confidenceColor = prediction.confidence >= 0.7 ? 'text-green-600' : 
                           prediction.confidence >= 0.6 ? 'text-yellow-600' : 'text-orange-600';
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold text-gray-600">第${rank}候補</span>
            <span class="text-xs px-2 py-1 bg-white rounded-full text-gray-600">信頼度</span>
        </div>
        <div class="text-4xl font-bold text-gray-800 mb-2 text-center">${prediction.number}</div>
        <div class="text-center">
            <span class="text-2xl font-bold ${confidenceColor}">${confidencePercent}%</span>
        </div>
        <div class="mt-3 pt-3 ${colors.borderT} border-t">
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="${colors.bar} h-2 rounded-full" style="width: ${confidencePercent}%"></div>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * 位相グラフを描画
 */
function renderPhaseChart() {
    const ctx = document.getElementById('phaseChart').getContext('2d');
    const phases = predictionData.recent_phases;
    
    if (!phases || Object.keys(phases).length === 0) {
        return;
    }

    const labels = Array.from({ length: phases.hundred.length }, (_, i) => `回${i + 1}`);
    
    // 既存のチャートを破棄
    if (phaseChart) {
        phaseChart.destroy();
    }

    phaseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '百の位',
                    data: phases.hundred,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                },
                {
                    label: '十の位',
                    data: phases.ten,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4
                },
                {
                    label: '一の位',
                    data: phases.one,
                    borderColor: 'rgb(251, 146, 60)',
                    backgroundColor: 'rgba(251, 146, 60, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: '直近20回の位相推移',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '位相値'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '回数'
                    }
                }
            }
        }
    });
}

/**
 * 予測手法の詳細を表示
 */
function renderMethodDetails() {
    const container = document.getElementById('methodDetails');
    container.innerHTML = '';

    const methods = predictionData.methods;
    const methodNames = {
        'chaos': 'カオス理論',
        'markov': 'マルコフ連鎖',
        'bayesian': 'ベイズ統計'
    };

    const methodColors = {
        'chaos': 'purple',
        'markov': 'blue',
        'bayesian': 'green'
    };

    const methodColorClasses = {
        'chaos': {
            bg: 'bg-gradient-to-r from-purple-50 to-purple-100',
            border: 'border-purple-500',
            text: 'text-purple-600'
        },
        'markov': {
            bg: 'bg-gradient-to-r from-blue-50 to-blue-100',
            border: 'border-blue-500',
            text: 'text-blue-600'
        },
        'bayesian': {
            bg: 'bg-gradient-to-r from-green-50 to-green-100',
            border: 'border-green-500',
            text: 'text-green-600'
        }
    };

    Object.keys(methods).forEach(methodKey => {
        const method = methods[methodKey];
        const card = document.createElement('div');
        const colorClasses = methodColorClasses[methodKey] || methodColorClasses.chaos;
        
        card.className = `${colorClasses.bg} rounded-lg p-4 border-l-4 ${colorClasses.border}`;
        
        const confidencePercent = (method.confidence * 100).toFixed(1);
        
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-lg font-bold text-gray-800">${methodNames[methodKey]}</h3>
                <span class="text-sm font-semibold ${colorClasses.text}">信頼度: ${confidencePercent}%</span>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-2">
                <div>
                    <p class="text-sm text-gray-600">セット予測</p>
                    <p class="text-xl font-bold text-gray-800">${method.set_prediction}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">ミニ予測</p>
                    <p class="text-xl font-bold text-gray-800">${method.mini_prediction}</p>
                </div>
            </div>
            <p class="text-sm text-gray-600 mt-2">${method.reason}</p>
        `;
        
        container.appendChild(card);
    });
}

/**
 * エラーを表示
 */
function showError(message) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('errorMessage').textContent = message;
}

