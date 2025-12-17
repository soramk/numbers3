/**
 * ナンバーズ3予測ツール - フロントエンド
 * GitHub Actionsで生成されたJSONを読み込んで表示
 */

let predictionData = null;
let phaseChart = null;
let predictionHistory = [];

// ページ読み込み時にデータを取得
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 履歴選択のイベントリスナーを先に設定
        const historySelect = document.getElementById('historySelect');
        if (historySelect) {
            historySelect.addEventListener('change', async (e) => {
                const selectedValue = e.target.value;
                try {
                    if (selectedValue === 'latest') {
                        await loadPredictionData('latest');
                    } else {
                        await loadPredictionData(selectedValue);
                    }
                } catch (error) {
                    showError('予測データの読み込みに失敗しました: ' + error.message);
                }
            });
        }
        
        // 履歴リストを読み込んでから最新の予測を読み込む
        await loadPredictionHistory();
        await loadPredictionData('latest');
    } catch (error) {
        showError('予測データの読み込みに失敗しました: ' + error.message);
    }
});

/**
 * 予測履歴リストを読み込む
 */
async function loadPredictionHistory() {
    try {
        // キャッシュを無効化して最新の履歴を取得
        const response = await fetch('data/prediction_history.json?' + new Date().getTime());
        if (response.ok) {
            predictionHistory = await response.json();
            console.log(`[loadPredictionHistory] 履歴を読み込みました: ${predictionHistory.length} 件`);
            populateHistorySelect();
        } else {
            console.warn('履歴リストが見つかりません。最新の予測のみ表示します。');
            predictionHistory = [];
        }
    } catch (error) {
        console.warn('履歴リストの読み込みに失敗:', error);
        predictionHistory = [];
    }
}

/**
 * 履歴選択ドロップダウンを設定
 */
function populateHistorySelect() {
    const historySelect = document.getElementById('historySelect');
    if (!historySelect) return;
    
    // 既存のオプションをクリア（「最新の予測」は残す）
    const latestOption = historySelect.querySelector('option[value="latest"]');
    historySelect.innerHTML = '';
    if (latestOption) {
        historySelect.appendChild(latestOption);
    }
    
    // 履歴を追加（時刻も表示）
    predictionHistory.forEach(entry => {
        const option = document.createElement('option');
        option.value = entry.file;
        
        // タイムスタンプから日時を取得
        let date;
        if (entry.timestamp) {
            date = new Date(entry.timestamp);
        } else if (entry.datetime) {
            // datetime形式（YYYY-MM-DD_HHMMSS）をパース
            const [datePart, timePart] = entry.datetime.split('_');
            const [year, month, day] = datePart.split('-');
            const hour = timePart.substring(0, 2);
            const minute = timePart.substring(2, 4);
            const second = timePart.substring(4, 6);
            date = new Date(year, parseInt(month) - 1, day, hour, minute, second);
        } else {
            date = new Date(entry.date);
        }
        
        const dateStr = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        // 時刻情報を取得（entry.timeがある場合はそれを使用、なければタイムスタンプから）
        let timeStr = '';
        if (entry.time) {
            // HHMMSS形式をHH:MM:SSに変換
            const time = entry.time.match(/.{1,2}/g);
            if (time && time.length >= 3) {
                timeStr = `${time[0]}:${time[1]}:${time[2]}`;
            }
        } else {
            timeStr = date.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        
        // 同じ日付の複数の予測を区別できるように時刻も表示
        option.textContent = `${dateStr} ${timeStr}`;
        option.setAttribute('data-date', entry.date || dateStr);
        option.setAttribute('data-time', entry.time || timeStr);
        
        historySelect.appendChild(option);
    });
}

/**
 * 予測データを読み込む
 * @param {string} file - ファイル名（'latest' または 'prediction_YYYY-MM-DD_HHMMSS.json'）
 */
async function loadPredictionData(file = 'latest') {
    const filePath = file === 'latest' 
        ? 'data/latest_prediction.json'
        : `data/${file}`;
    
    // キャッシュを無効化して最新のデータを取得
    const url = filePath + (file === 'latest' ? '?' + new Date().getTime() : '');
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ファイル: ${filePath}`);
    }
    
    predictionData = await response.json();
    console.log(`[loadPredictionData] データを読み込みました: ${file}`);
    renderContent();
}

/**
 * コンテンツをレンダリング
 */
function renderContent() {
    if (!predictionData) return;

    // ローディングを非表示
    document.getElementById('loading').classList.add('hidden');
    const contentDiv = document.getElementById('content');
    contentDiv.classList.remove('hidden');
    contentDiv.classList.add('fade-in');

    // 基本情報を表示
    renderBasicInfo();
    
    // セット予測を表示（少し遅延させてアニメーション効果）
    setTimeout(() => renderSetPredictions(), 100);
    
    // ミニ予測を表示
    setTimeout(() => renderMiniPredictions(), 200);
    
    // 位相グラフを描画
    setTimeout(() => renderPhaseChart(), 300);
    
    // 予測手法の詳細を表示
    setTimeout(() => renderMethodDetails(), 400);
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
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        container.appendChild(card);
        
        // アニメーションで表示
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
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
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        container.appendChild(card);
        
        // アニメーションで表示
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

/**
 * 予測カードを作成
 */
function createPredictionCard(prediction, rank, color) {
    const card = document.createElement('div');
    
    // カラーマッピング（より洗練されたグラデーション）
    const colorMap = {
        'blue': {
            bg: 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500',
            bgLight: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',
            border: 'border-blue-400',
            bar: 'bg-gradient-to-r from-blue-500 to-indigo-600',
            shadow: 'shadow-blue-200',
            rankBg: 'bg-blue-100'
        },
        'green': {
            bg: 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500',
            bgLight: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50',
            border: 'border-green-400',
            bar: 'bg-gradient-to-r from-green-500 to-emerald-600',
            shadow: 'shadow-green-200',
            rankBg: 'bg-green-100'
        }
    };
    
    const colors = colorMap[color] || colorMap.blue;
    card.className = `prediction-card ${colors.bgLight} rounded-2xl p-6 border-2 ${colors.border} shadow-lg ${colors.shadow} hover:shadow-2xl`;
    
    const confidencePercent = (prediction.confidence * 100).toFixed(1);
    const confidenceColor = prediction.confidence >= 0.7 ? 'text-emerald-600' : 
                           prediction.confidence >= 0.6 ? 'text-yellow-500' : 'text-orange-500';
    
    // ランクバッジのスタイル
    const rankBadgeStyle = rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white' :
                          rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-white' :
                          'bg-gradient-to-r from-orange-300 to-orange-400 text-white';
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <span class="px-3 py-1 ${rankBadgeStyle} rounded-full text-xs font-bold shadow-md">第${rank}候補</span>
            <div class="flex items-center gap-1.5 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full">
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-xs font-semibold text-gray-700">信頼度</span>
            </div>
        </div>
        <div class="text-center mb-4">
            <div class="inline-block relative">
                <div class="absolute inset-0 ${colors.bg} opacity-20 blur-xl rounded-full"></div>
                <div class="relative text-5xl md:text-6xl font-black text-gray-800 tracking-wider">${prediction.number}</div>
            </div>
        </div>
        <div class="text-center mb-4">
            <span class="text-3xl font-bold ${confidenceColor}">${confidencePercent}%</span>
        </div>
        <div class="mt-4 pt-4 border-t-2 border-gray-200">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-medium text-gray-600">信頼度</span>
                <span class="text-xs font-bold ${confidenceColor}">${confidencePercent}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div class="${colors.bar} h-3 rounded-full transition-all duration-1000 ease-out shadow-sm" style="width: ${confidencePercent}%"></div>
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
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgb(99, 102, 241)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '十の位',
                    data: phases.ten,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgb(16, 185, 129)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '一の位',
                    data: phases.one,
                    borderColor: 'rgb(251, 146, 60)',
                    backgroundColor: 'rgba(251, 146, 60, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'rgb(251, 146, 60)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    }
                },
                title: {
                    display: true,
                    text: '直近20回の位相推移',
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    color: '#374151',
                    padding: {
                        bottom: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#6B7280'
                    },
                    title: {
                        display: true,
                        text: '位相値',
                        font: {
                            size: 13,
                            weight: '600'
                        },
                        color: '#374151',
                        padding: {
                            bottom: 10
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#6B7280'
                    },
                    title: {
                        display: true,
                        text: '回数',
                        font: {
                            size: 13,
                            weight: '600'
                        },
                        color: '#374151',
                        padding: {
                            top: 10
                        }
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
        'bayesian': 'ベイズ統計',
        'periodicity': '周期性分析',
        'pattern': '頻出パターン分析'
    };

    const methodIcons = {
        'chaos': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>`,
        'markov': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>`,
        'bayesian': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>`,
        'periodicity': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>`,
        'pattern': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>`
    };

    const methodColorClasses = {
        'chaos': {
            bg: 'bg-gradient-to-br from-purple-50 via-purple-100 to-pink-50',
            border: 'border-purple-400',
            text: 'text-purple-700',
            iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
            numberBg: 'bg-purple-100'
        },
        'markov': {
            bg: 'bg-gradient-to-br from-blue-50 via-blue-100 to-cyan-50',
            border: 'border-blue-400',
            text: 'text-blue-700',
            iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
            numberBg: 'bg-blue-100'
        },
        'bayesian': {
            bg: 'bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50',
            border: 'border-green-400',
            text: 'text-green-700',
            iconBg: 'bg-gradient-to-br from-green-500 to-emerald-500',
            numberBg: 'bg-green-100'
        }
    };

    Object.keys(methods).forEach((methodKey, index) => {
        const method = methods[methodKey];
        if (!method) {
            console.warn(`[renderMethodDetails] メソッド ${methodKey} が undefined です`);
            return;
        }
        
        const card = document.createElement('div');
        const colorClasses = methodColorClasses[methodKey] || methodColorClasses.chaos;
        const methodName = methodNames[methodKey] || methodKey;
        
        card.className = `${colorClasses.bg} rounded-2xl p-6 border-2 ${colorClasses.border} shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`;
        
        const confidencePercent = (method.confidence * 100).toFixed(1);
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="${colorClasses.iconBg} p-3 rounded-xl text-white shadow-lg">
                        ${methodIcons[methodKey] || methodIcons.chaos}
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${methodName}</h3>
                        <p class="text-xs text-gray-600 mt-0.5">予測手法 ${index + 1}</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="px-3 py-1.5 ${colorClasses.numberBg} rounded-lg">
                        <span class="text-sm font-bold ${colorClasses.text}">${confidencePercent}%</span>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-gray-200">
                    <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">セット予測</p>
                    <p class="text-2xl font-black text-gray-800 tracking-wider">${method.set_prediction}</p>
                </div>
                <div class="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-gray-200">
                    <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">ミニ予測</p>
                    <p class="text-2xl font-black text-gray-800 tracking-wider">${method.mini_prediction}</p>
                </div>
            </div>
            <div class="bg-white/40 backdrop-blur-sm rounded-lg p-3 border border-gray-200 mb-4">
                <p class="text-sm text-gray-700 leading-relaxed">${method.reason}</p>
            </div>
            <button class="detail-btn w-full px-4 py-2 ${colorClasses.iconBg} text-white rounded-lg font-semibold hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg" data-method="${methodKey}">
                📊 分析過程を見る
            </button>
            <div id="detail-${methodKey}" class="method-detail hidden mt-4 bg-white/60 backdrop-blur-sm rounded-lg p-4 border-2 ${colorClasses.border}">
                <div class="method-detail-content"></div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // 詳細ボタンのイベントリスナーを設定
    document.querySelectorAll('.detail-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const methodKey = e.target.getAttribute('data-method');
            toggleMethodDetail(methodKey);
        });
    });
}

/**
 * 予測手法の詳細を表示/非表示
 */
function toggleMethodDetail(methodKey) {
    const detailDiv = document.getElementById(`detail-${methodKey}`);
    const btn = document.querySelector(`[data-method="${methodKey}"]`);
    
    if (!detailDiv || !btn) return;
    
    const isHidden = detailDiv.classList.contains('hidden');
    
    if (isHidden) {
        // 詳細を表示
        detailDiv.classList.remove('hidden');
        btn.textContent = '📊 分析過程を閉じる';
        
        // 詳細内容を生成（まだ生成されていない場合）
        const contentDiv = detailDiv.querySelector('.method-detail-content');
        if (contentDiv && contentDiv.innerHTML === '') {
            renderMethodDetailContent(methodKey, contentDiv);
        }
    } else {
        // 詳細を非表示
        detailDiv.classList.add('hidden');
        btn.textContent = '📊 分析過程を見る';
    }
}

/**
 * 予測手法の詳細内容をレンダリング
 */
function renderMethodDetailContent(methodKey, container) {
    if (!predictionData || !predictionData.advanced_analysis) {
        container.innerHTML = '<p class="text-gray-600">詳細データがありません。</p>';
        return;
    }
    
    const method = predictionData.methods[methodKey];
    const analysis = predictionData.advanced_analysis;
    
    let html = '';
    
    // 手法ごとの詳細情報を表示
    switch(methodKey) {
        case 'chaos':
            html = renderChaosDetail(method, analysis);
            break;
        case 'markov':
            html = renderMarkovDetail(method, analysis);
            break;
        case 'bayesian':
            html = renderBayesianDetail(method, analysis);
            break;
        case 'periodicity':
            html = renderPeriodicityDetail(method, analysis);
            break;
        case 'pattern':
            html = renderPatternDetail(method, analysis);
            break;
        default:
            html = '<p class="text-gray-600">詳細情報がありません。</p>';
    }
    
    container.innerHTML = html;
}

/**
 * カオス理論の詳細を表示
 */
function renderChaosDetail(method, analysis) {
    const trends = analysis.trends || {};
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">位相トレンド分析</h4>';
    
    for (const [pos, posTrends] of Object.entries(trends)) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
        html += `<div class="bg-white rounded-lg p-3 mb-2">`;
        html += `<p class="font-semibold text-gray-700 mb-2">${posName}</p>`;
        
        if (posTrends.short) {
            html += `<div class="text-sm text-gray-600">`;
            html += `<p>短期トレンド（直近10回）: 平均 ${posTrends.short.mean.toFixed(2)}, 傾き ${posTrends.short.trend > 0 ? '+' : ''}${posTrends.short.trend.toFixed(3)}, ボラティリティ ${posTrends.short.volatility.toFixed(2)}</p>`;
            html += `</div>`;
        }
        if (posTrends.mid) {
            html += `<div class="text-sm text-gray-600">`;
            html += `<p>中期トレンド（直近50回）: 平均 ${posTrends.mid.mean.toFixed(2)}, 傾き ${posTrends.mid.trend > 0 ? '+' : ''}${posTrends.mid.trend.toFixed(3)}</p>`;
            html += `</div>`;
        }
        html += `</div>`;
    }
    
    html += '</div>';
    return html;
}

/**
 * マルコフ連鎖の詳細を表示
 */
function renderMarkovDetail(method, analysis) {
    const correlations = analysis.correlations || {};
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">遷移確率分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-3">';
    html += '<p class="text-sm text-gray-700 mb-2">自己相関（前回との相関）:</p>';
    html += `<ul class="text-sm text-gray-600 space-y-1">`;
    html += `<li>百の位: ${(correlations.hundred_lag1 * 100).toFixed(2)}%</li>`;
    html += `<li>十の位: ${(correlations.ten_lag1 * 100).toFixed(2)}%</li>`;
    html += `<li>一の位: ${(correlations.one_lag1 * 100).toFixed(2)}%</li>`;
    html += `</ul>`;
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * ベイズ統計の詳細を表示
 */
function renderBayesianDetail(method, analysis) {
    const correlations = analysis.correlations || {};
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">ベイズ更新分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-3">';
    html += '<p class="text-sm text-gray-700 mb-2">合計値との相関:</p>';
    html += `<ul class="text-sm text-gray-600 space-y-1">`;
    html += `<li>百の位: ${(correlations.hundred_sum * 100).toFixed(2)}%</li>`;
    html += `<li>十の位: ${(correlations.ten_sum * 100).toFixed(2)}%</li>`;
    html += `<li>一の位: ${(correlations.one_sum * 100).toFixed(2)}%</li>`;
    html += `</ul>`;
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * 周期性分析の詳細を表示
 */
function renderPeriodicityDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">周期性パターン分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-3">';
    html += '<p class="text-sm text-gray-700 mb-2">現在の日付情報に基づいて、曜日・月次・四半期パターンから予測しています。</p>';
    html += '<p class="text-xs text-gray-600 mt-2">※ 詳細なパターンデータは分析結果JSONに含まれています。</p>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * 頻出パターン分析の詳細を表示
 */
function renderPatternDetail(method, analysis) {
    const patterns = analysis.frequent_patterns || {};
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">頻出パターン分析</h4>';
    
    if (patterns.set_top) {
        html += '<div class="bg-white rounded-lg p-3 mb-2">';
        html += '<p class="text-sm font-semibold text-gray-700 mb-2">頻出3桁コンボ（上位5件）:</p>';
        html += '<ul class="text-sm text-gray-600 space-y-1">';
        const top5 = Object.entries(patterns.set_top).slice(0, 5);
        top5.forEach(([pattern, count]) => {
            html += `<li>${pattern}: ${count}回</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    if (patterns.mini_top) {
        html += '<div class="bg-white rounded-lg p-3">';
        html += '<p class="text-sm font-semibold text-gray-700 mb-2">頻出2桁コンボ（上位5件）:</p>';
        html += '<ul class="text-sm text-gray-600 space-y-1">';
        const top5 = Object.entries(patterns.mini_top).slice(0, 5);
        top5.forEach(([pattern, count]) => {
            html += `<li>${pattern}: ${count}回</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * エラーを表示
 */
function showError(message) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('errorMessage').textContent = message;
}

