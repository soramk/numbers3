/**
 * ナンバーズ3予測ツール - フロントエンド
 * GitHub Actionsで生成されたJSONを読み込んで表示
 */

let predictionData = null;
let phaseChart = null;
let predictionHistory = [];
let periodicityCharts = {}; // 周期性グラフのインスタンスを保存

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
    setTimeout(() => {
        renderPhaseChart('all');
        setupPhaseChartTabs();
    }, 300);
    
    // 予測手法の詳細を表示（予測結果も含む）
    setTimeout(() => renderMethodDetails(), 400);
    
    // 詳細分析結果のボタンイベントを設定
    setTimeout(() => setupAnalysisDetailButtons(), 500);
}

/**
 * 詳細分析結果のボタンイベントを設定
 */
function setupAnalysisDetailButtons() {
    const buttons = document.querySelectorAll('.analysis-detail-btn');
    console.log(`[setupAnalysisDetailButtons] ${buttons.length} 個のボタンが見つかりました`);
    
    buttons.forEach(btn => {
        // 既存のイベントリスナーを削除（重複を防ぐ）
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const analysisType = newBtn.getAttribute('data-analysis');
            console.log(`[setupAnalysisDetailButtons] ボタンがクリックされました: ${analysisType}`);
            toggleAnalysisDetail(analysisType, newBtn);
        });
    });
}

/**
 * 詳細分析結果の表示/非表示
 */
function toggleAnalysisDetail(analysisType, btn) {
    const detailDiv = document.getElementById(`detail-${analysisType}`);
    const icon = btn.querySelector('svg');
    
    if (!detailDiv) {
        console.error(`[toggleAnalysisDetail] detail-${analysisType} が見つかりません`);
        return;
    }
    
    const isHidden = detailDiv.classList.contains('hidden');
    
    if (isHidden) {
        // 詳細を表示
        detailDiv.classList.remove('hidden');
        if (icon) {
            icon.style.transform = 'rotate(180deg)';
        }
        
        // 詳細内容を生成（まだ生成されていない場合、または空の場合）
        const contentDiv = detailDiv.querySelector('.analysis-detail-content') || detailDiv;
        if (!contentDiv.innerHTML.trim() || contentDiv.innerHTML === '') {
            console.log(`[toggleAnalysisDetail] ${analysisType} の詳細をレンダリングします`);
            renderAnalysisDetail(analysisType, contentDiv);
        }
    } else {
        // 詳細を非表示
        detailDiv.classList.add('hidden');
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    }
}

/**
 * 詳細分析結果をレンダリング
 */
function renderAnalysisDetail(analysisType, container) {
    console.log(`[renderAnalysisDetail] ${analysisType} をレンダリング開始`);
    
    if (!predictionData) {
        console.error('[renderAnalysisDetail] predictionData がありません');
        container.innerHTML = '<p class="text-gray-600">予測データが読み込まれていません。</p>';
        return;
    }
    
    if (!predictionData.advanced_analysis) {
        console.warn('[renderAnalysisDetail] advanced_analysis がありません');
        container.innerHTML = '<p class="text-gray-600">詳細分析データがありません。</p>';
        return;
    }
    
    const analysis = predictionData.advanced_analysis;
    console.log(`[renderAnalysisDetail] advanced_analysis:`, Object.keys(analysis));
    
    switch(analysisType) {
        case 'correlations':
            if (!analysis.correlations) {
                console.warn('[renderAnalysisDetail] correlations データがありません');
                container.innerHTML = '<p class="text-gray-600">相関分析データがありません。</p>';
            } else {
                renderCorrelationsDetail(analysis.correlations, container);
            }
            break;
        case 'trends':
            if (!analysis.trends) {
                console.warn('[renderAnalysisDetail] trends データがありません');
                container.innerHTML = '<p class="text-gray-600">トレンド分析データがありません。</p>';
            } else {
                renderTrendsDetail(analysis.trends, container);
            }
            break;
        case 'clustering':
            if (!analysis.clustering) {
                console.warn('[renderAnalysisDetail] clustering データがありません');
                container.innerHTML = '<p class="text-gray-600">クラスタリング分析データがありません。</p>';
            } else {
                renderClusteringDetail(analysis.clustering, container);
            }
            break;
        case 'frequency':
            if (!analysis.frequency_analysis) {
                console.warn('[renderAnalysisDetail] frequency_analysis データがありません');
                container.innerHTML = '<p class="text-gray-600">周波数解析データがありません。</p>';
            } else {
                renderFrequencyDetail(analysis.frequency_analysis, container);
            }
            break;
        case 'wavelet':
            if (!analysis.wavelet_analysis) {
                console.warn('[renderAnalysisDetail] wavelet_analysis データがありません');
                container.innerHTML = '<p class="text-gray-600">ウェーブレット解析データがありません。</p>';
            } else {
                renderWaveletDetail(analysis.wavelet_analysis, container);
            }
            break;
        case 'pca':
            if (!analysis.pca_analysis) {
                console.warn('[renderAnalysisDetail] pca_analysis データがありません');
                container.innerHTML = '<p class="text-gray-600">PCA解析データがありません。</p>';
            } else {
                renderPCADetail(analysis.pca_analysis, container);
            }
            break;
        case 'tsne':
            if (!analysis.tsne_analysis) {
                console.warn('[renderAnalysisDetail] tsne_analysis データがありません');
                container.innerHTML = '<p class="text-gray-600">t-SNE解析データがありません。</p>';
            } else {
                renderTSNEDetail(analysis.tsne_analysis, container);
            }
            break;
        case 'continuity':
            if (!analysis.continuity_analysis) {
                console.warn('[renderAnalysisDetail] continuity_analysis データがありません');
                container.innerHTML = '<p class="text-gray-600">連続性分析データがありません。</p>';
            } else {
                renderContinuityDetail(analysis.continuity_analysis, container);
            }
            break;
        case 'change_points':
            if (!analysis.change_points) {
                console.warn('[renderAnalysisDetail] change_points データがありません');
                container.innerHTML = '<p class="text-gray-600">変化点検出データがありません。</p>';
            } else {
                renderChangePointsDetail(analysis.change_points, container);
            }
            break;
        case 'network':
            if (!analysis.network_analysis) {
                console.warn('[renderAnalysisDetail] network_analysis データがありません');
                container.innerHTML = '<p class="text-gray-600">ネットワーク分析データがありません。</p>';
            } else {
                renderNetworkDetail(analysis.network_analysis, container);
            }
            break;
        case 'genetic':
            if (!analysis.genetic_optimization) {
                console.warn('[renderAnalysisDetail] genetic_optimization データがありません');
                container.innerHTML = '<p class="text-gray-600">遺伝的アルゴリズム最適化データがありません。</p>';
            } else {
                renderGeneticDetail(analysis.genetic_optimization, container);
            }
            break;
        default:
            console.warn(`[renderAnalysisDetail] 未知の分析タイプ: ${analysisType}`);
            container.innerHTML = '<p class="text-gray-600">詳細情報がありません。</p>';
    }
    
    console.log(`[renderAnalysisDetail] ${analysisType} のレンダリング完了`);
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
        const card = createPredictionCard(pred, index + 1, 'blue', 'set');
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
        const card = createPredictionCard(pred, index + 1, 'green', 'mini');
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
function createPredictionCard(prediction, rank, color, type = 'set') {
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
                          rank === 3 ? 'bg-gradient-to-r from-orange-300 to-orange-400 text-white' :
                          rank === 4 ? 'bg-gradient-to-r from-blue-300 to-blue-400 text-white' :
                          'bg-gradient-to-r from-purple-300 to-purple-400 text-white';
    
    // 関連する予測手法を見つける
    const relatedMethods = findRelatedMethods(prediction.number, type);
    
    // 関連手法のアイコンを生成
    let relatedMethodsIcons = '';
    if (relatedMethods.length > 0) {
        const methodIcons = {
            'chaos': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`,
            'markov': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`,
            'bayesian': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`,
            'periodicity': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`,
            'pattern': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`,
            'random_forest': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`,
            'xgboost': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`,
            'lightgbm': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>`,
            'arima': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>`,
            'stacking': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`,
            'hmm': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>`,
            'lstm': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>`,
            'conformal': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
            'kalman': `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>`
        };
        
        const methodColorClasses = {
            'chaos': 'bg-purple-100 text-purple-700',
            'markov': 'bg-blue-100 text-blue-700',
            'bayesian': 'bg-green-100 text-green-700',
            'periodicity': 'bg-orange-100 text-orange-700',
            'pattern': 'bg-indigo-100 text-indigo-700',
            'random_forest': 'bg-emerald-100 text-emerald-700',
            'xgboost': 'bg-red-100 text-red-700',
            'lightgbm': 'bg-yellow-100 text-yellow-700',
            'arima': 'bg-cyan-100 text-cyan-700',
            'stacking': 'bg-violet-100 text-violet-700',
            'hmm': 'bg-teal-100 text-teal-700',
            'lstm': 'bg-pink-100 text-pink-700',
            'conformal': 'bg-lime-100 text-lime-700',
            'kalman': 'bg-sky-100 text-sky-700'
        };
        
        relatedMethodsIcons = `
            <div class="mt-3 pt-3 border-t border-gray-200">
                <p class="text-xs font-semibold text-gray-600 mb-2">関連する予測手法</p>
                <div class="flex flex-wrap gap-2">
                    ${relatedMethods.slice(0, 6).map(methodKey => `
                        <div class="flex items-center gap-1 px-2 py-1 ${methodColorClasses[methodKey] || 'bg-gray-100 text-gray-700'} rounded-lg text-xs font-semibold" title="${getMethodName(methodKey)}">
                            ${methodIcons[methodKey] || ''}
                            <span class="hidden sm:inline">${getMethodNameShort(methodKey)}</span>
                        </div>
                    `).join('')}
                    ${relatedMethods.length > 6 ? `<div class="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold">+${relatedMethods.length - 6}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="flex items-center justify-center mb-4">
            <span class="px-3 py-1 ${rankBadgeStyle} rounded-full text-xs font-bold shadow-md">第${rank}候補</span>
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
        ${relatedMethodsIcons}
    `;
    
    return card;
}

/**
 * 予測番号に関連する予測手法を見つける
 */
function findRelatedMethods(predictionNumber, type) {
    if (!predictionData || !predictionData.methods) {
        return [];
    }
    
    const relatedMethods = [];
    const methods = predictionData.methods;
    
    Object.keys(methods).forEach(methodKey => {
        const method = methods[methodKey];
        if (!method) return;
        
        const methodPrediction = type === 'set' ? method.set_prediction : method.mini_prediction;
        if (methodPrediction === predictionNumber) {
            relatedMethods.push(methodKey);
        }
    });
    
    return relatedMethods;
}

/**
 * 予測手法の短縮名を取得
 */
function getMethodNameShort(methodKey) {
    const shortNames = {
        'chaos': 'カオス',
        'markov': 'マルコフ',
        'bayesian': 'ベイズ',
        'periodicity': '周期性',
        'pattern': 'パターン',
        'random_forest': 'RF',
        'xgboost': 'XGB',
        'lightgbm': 'LGBM',
        'arima': 'ARIMA',
        'stacking': 'スタッキング',
        'hmm': 'HMM',
        'lstm': 'LSTM',
        'conformal': 'コンフォーマル',
        'kalman': 'カルマン'
    };
    return shortNames[methodKey] || methodKey;
}

/**
 * 予測手法の正式名を取得
 */
function getMethodName(methodKey) {
    const methodNames = {
        'chaos': 'カオス理論',
        'markov': 'マルコフ連鎖',
        'bayesian': 'ベイズ統計',
        'periodicity': '周期性分析',
        'pattern': '頻出パターン分析',
        'random_forest': 'ランダムフォレスト',
        'xgboost': 'XGBoost',
        'lightgbm': 'LightGBM',
        'arima': 'ARIMA',
        'stacking': 'スタッキング',
        'hmm': '隠れマルコフモデル（HMM）',
        'lstm': 'LSTM（長短期記憶）',
        'conformal': 'コンフォーマル予測',
        'kalman': 'カルマンフィルタ'
    };
    return methodNames[methodKey] || methodKey;
}

/**
 * 位相グラフを描画
 */
// 位相グラフの表示位置（デフォルトは全て）
let currentPhaseView = 'all';

function renderPhaseChart(viewPos = 'all') {
    const ctx = document.getElementById('phaseChart');
    if (!ctx) return;
    
    const ctx2d = ctx.getContext('2d');
    const phases = predictionData.recent_phases;
    
    if (!phases || Object.keys(phases).length === 0) {
        return;
    }

    // データ数を制限（最大100件、それ以上は間引き）
    const maxDataPoints = 100;
    let dataLength = phases.hundred.length;
    let step = 1;
    let labels = [];
    
    if (dataLength > maxDataPoints) {
        step = Math.ceil(dataLength / maxDataPoints);
        labels = Array.from({ length: Math.ceil(dataLength / step) }, (_, i) => {
            const idx = i * step;
            return idx < dataLength ? `回${idx + 1}` : '';
        }).filter(l => l);
    } else {
        labels = Array.from({ length: dataLength }, (_, i) => `回${i + 1}`);
    }
    
    // データを間引き
    const getSampledData = (data) => {
        if (dataLength <= maxDataPoints) return data;
        const sampled = [];
        for (let i = 0; i < data.length; i += step) {
            sampled.push(data[i]);
        }
        return sampled;
    };
    
    // 既存のチャートを破棄
    if (phaseChart) {
        phaseChart.destroy();
    }

    // 表示するデータセットを決定
    const datasets = [];
    
    if (viewPos === 'all') {
        // 全て表示（透明度を上げて見やすく）
        datasets.push(
            {
                label: '百の位',
                data: getSampledData(phases.hundred),
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.05)',
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'rgb(99, 102, 241)',
                pointBorderColor: '#fff',
                pointBorderWidth: 1.5,
                tension: 0.3,
                fill: false
            },
            {
                label: '十の位',
                data: getSampledData(phases.ten),
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'rgb(16, 185, 129)',
                pointBorderColor: '#fff',
                pointBorderWidth: 1.5,
                tension: 0.3,
                fill: false
            },
            {
                label: '一の位',
                data: getSampledData(phases.one),
                borderColor: 'rgb(251, 146, 60)',
                backgroundColor: 'rgba(251, 146, 60, 0.05)',
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'rgb(251, 146, 60)',
                pointBorderColor: '#fff',
                pointBorderWidth: 1.5,
                tension: 0.3,
                fill: false
            }
        );
    } else {
        // 個別表示
        const configs = {
            'hundred': {
                label: '百の位',
                color: 'rgb(99, 102, 241)',
                bgColor: 'rgba(99, 102, 241, 0.1)',
                data: phases.hundred
            },
            'ten': {
                label: '十の位',
                color: 'rgb(16, 185, 129)',
                bgColor: 'rgba(16, 185, 129, 0.1)',
                data: phases.ten
            },
            'one': {
                label: '一の位',
                color: 'rgb(251, 146, 60)',
                bgColor: 'rgba(251, 146, 60, 0.1)',
                data: phases.one
            }
        };
        
        const config = configs[viewPos];
        if (config) {
            datasets.push({
                label: config.label,
                data: getSampledData(config.data),
                borderColor: config.color,
                backgroundColor: config.bgColor,
                borderWidth: 3,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: config.color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0.4,
                fill: true
            });
        }
    }

    // Chart.jsのズームプラグインが利用可能かチェック
    const zoomPlugin = window.Chart && window.Chart.register ? 
        (window.chartjsZoom || {}) : null;
    
    phaseChart = new Chart(ctx2d, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
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
                            size: 14,
                            weight: '600'
                        },
                        boxWidth: 12,
                        boxHeight: 12
                    }
                },
                title: {
                    display: true,
                    text: viewPos === 'all' ? '全桁の位相推移' : `${datasets[0]?.label || ''}の位相推移`,
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
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.08)',
                        drawBorder: false,
                        lineWidth: 1
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#6B7280',
                        padding: 8
                    },
                    title: {
                        display: true,
                        text: '位相値',
                        font: {
                            size: 14,
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
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#6B7280',
                        maxRotation: 45,
                        minRotation: 0,
                        maxTicksLimit: viewPos === 'all' ? 20 : 30
                    },
                    title: {
                        display: true,
                        text: '回数',
                        font: {
                            size: 14,
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
    
    currentPhaseView = viewPos;
}

/**
 * 位相グラフのタブ切り替え
 */
function setupPhaseChartTabs() {
    const tabs = document.querySelectorAll('.phase-tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const pos = tab.getAttribute('data-pos');
            
            // アクティブ状態を更新
            tabs.forEach(t => {
                t.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
                t.classList.add('text-gray-600');
            });
            tab.classList.add('active', 'border-indigo-600', 'text-indigo-600');
            tab.classList.remove('text-gray-600');
            
            // グラフを再描画
            renderPhaseChart(pos);
        });
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
        'pattern': '頻出パターン分析',
        'random_forest': 'ランダムフォレスト',
        'xgboost': 'XGBoost',
        'lightgbm': 'LightGBM',
        'arima': 'ARIMA',
        'stacking': 'スタッキング',
        'hmm': '隠れマルコフモデル（HMM）',
        'lstm': 'LSTM（長短期記憶）',
        'conformal': 'コンフォーマル予測',
        'kalman': 'カルマンフィルタ'
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
        </svg>`,
        'random_forest': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
        </svg>`,
        'xgboost': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>`,
        'lightgbm': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
        </svg>`,
        'arima': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
        </svg>`,
        'stacking': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>`,
        'hmm': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>`,
        'lstm': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
        </svg>`,
        'conformal': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>`,
        'kalman': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
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
        },
        'periodicity': {
            bg: 'bg-gradient-to-br from-orange-50 via-amber-100 to-yellow-50',
            border: 'border-orange-400',
            text: 'text-orange-700',
            iconBg: 'bg-gradient-to-br from-orange-500 to-amber-500',
            numberBg: 'bg-orange-100'
        },
        'pattern': {
            bg: 'bg-gradient-to-br from-indigo-50 via-purple-100 to-pink-50',
            border: 'border-indigo-400',
            text: 'text-indigo-700',
            iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-500',
            numberBg: 'bg-indigo-100'
        },
        'random_forest': {
            bg: 'bg-gradient-to-br from-emerald-50 via-teal-100 to-cyan-50',
            border: 'border-emerald-400',
            text: 'text-emerald-700',
            iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
            numberBg: 'bg-emerald-100'
        },
        'xgboost': {
            bg: 'bg-gradient-to-br from-red-50 via-rose-100 to-pink-50',
            border: 'border-red-400',
            text: 'text-red-700',
            iconBg: 'bg-gradient-to-br from-red-500 to-rose-500',
            numberBg: 'bg-red-100'
        },
        'lightgbm': {
            bg: 'bg-gradient-to-br from-yellow-50 via-amber-100 to-orange-50',
            border: 'border-yellow-400',
            text: 'text-yellow-700',
            iconBg: 'bg-gradient-to-br from-yellow-500 to-amber-500',
            numberBg: 'bg-yellow-100'
        },
        'arima': {
            bg: 'bg-gradient-to-br from-cyan-50 via-blue-100 to-indigo-50',
            border: 'border-cyan-400',
            text: 'text-cyan-700',
            iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-500',
            numberBg: 'bg-cyan-100'
        },
        'stacking': {
            bg: 'bg-gradient-to-br from-violet-50 via-purple-100 to-fuchsia-50',
            border: 'border-violet-400',
            text: 'text-violet-700',
            iconBg: 'bg-gradient-to-br from-violet-500 to-purple-500',
            numberBg: 'bg-violet-100'
        },
        'hmm': {
            bg: 'bg-gradient-to-br from-teal-50 via-cyan-100 to-blue-50',
            border: 'border-teal-400',
            text: 'text-teal-700',
            iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-500',
            numberBg: 'bg-teal-100'
        },
        'lstm': {
            bg: 'bg-gradient-to-br from-pink-50 via-rose-100 to-red-50',
            border: 'border-pink-400',
            text: 'text-pink-700',
            iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
            numberBg: 'bg-pink-100'
        },
        'conformal': {
            bg: 'bg-gradient-to-br from-lime-50 via-green-100 to-emerald-50',
            border: 'border-lime-400',
            text: 'text-lime-700',
            iconBg: 'bg-gradient-to-br from-lime-500 to-green-500',
            numberBg: 'bg-lime-100'
        },
        'kalman': {
            bg: 'bg-gradient-to-br from-sky-50 via-blue-100 to-indigo-50',
            border: 'border-sky-400',
            text: 'text-sky-700',
            iconBg: 'bg-gradient-to-br from-sky-500 to-blue-500',
            numberBg: 'bg-sky-100'
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
        
        // データ利用件数のバッジを取得
        const dataUsageBadge = getMethodDataUsageBadgeHtml(methodKey);
        
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
            ${dataUsageBadge}
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
            <div class="flex gap-2">
                <button class="detail-btn flex-1 px-4 py-2 ${colorClasses.iconBg} text-white rounded-lg font-semibold hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg" data-method="${methodKey}">
                    📊 分析過程を見る
                </button>
                <button class="theory-btn flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:opacity-90 transition-all duration-200 shadow-md hover:shadow-lg" data-method="${methodKey}">
                    📚 学術的説明
                </button>
            </div>
            <div id="detail-${methodKey}" class="method-detail hidden mt-4 bg-white/60 backdrop-blur-sm rounded-lg p-4 border-2 ${colorClasses.border}">
                <div class="method-detail-content"></div>
            </div>
            <div id="theory-${methodKey}" class="method-theory hidden mt-4 bg-white/60 backdrop-blur-sm rounded-lg p-4 border-2 border-gray-400">
                <div class="method-theory-content"></div>
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
    
    // 学術的説明ボタンのイベントリスナーを設定
    document.querySelectorAll('.theory-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const methodKey = e.target.getAttribute('data-method');
            toggleMethodTheory(methodKey);
        });
    });
}

/**
 * 予測手法の詳細を表示/非表示
 */
function toggleMethodDetail(methodKey) {
    const detailDiv = document.getElementById(`detail-${methodKey}`);
    const btn = document.querySelector(`.detail-btn[data-method="${methodKey}"]`);
    
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
 * 予測手法の学術的説明を表示/非表示
 */
function toggleMethodTheory(methodKey) {
    const theoryDiv = document.getElementById(`theory-${methodKey}`);
    const btn = document.querySelector(`.theory-btn[data-method="${methodKey}"]`);
    
    if (!theoryDiv || !btn) return;
    
    const isHidden = theoryDiv.classList.contains('hidden');
    
    if (isHidden) {
        // 説明を表示
        theoryDiv.classList.remove('hidden');
        btn.textContent = '📚 説明を閉じる';
        
        // 説明内容を生成（まだ生成されていない場合）
        const contentDiv = theoryDiv.querySelector('.method-theory-content');
        if (contentDiv && contentDiv.innerHTML === '') {
            renderMethodTheoryContent(methodKey, contentDiv);
        }
    } else {
        // 説明を非表示
        theoryDiv.classList.add('hidden');
        btn.textContent = '📚 学術的説明';
    }
}

/**
 * 予測手法の学術的説明をレンダリング
 */
function renderMethodTheoryContent(methodKey, container) {
    let html = '';
    
    switch(methodKey) {
        case 'chaos':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">カオス理論（Chaos Theory）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            カオス理論は、決定論的システムでありながら長期的な予測が困難な非線形動的システムを研究する数学的分野です。
                            わずかな初期条件の違いが時間の経過とともに指数関数的に増大する「バタフライ効果」が特徴です。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            ナンバーズ3のような数値データは、複雑な非線形システムとして捉えることができ、
                            位相空間における軌跡を分析することで、隠れたパターンやトレンドを発見できます。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">位相空間解析</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            位相空間は、システムの状態を多次元空間内の点として表現する数学的表現です。
                            各桁の値を座標として使用し、時系列データを位相空間内の軌跡として可視化します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            この手法では、位相空間内の軌跡の方向性や密度を分析し、
                            次の状態がどの方向に進む可能性が高いかを予測します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Lorenz, E. N. (1963). "Deterministic Nonperiodic Flow"</li>
                            <li>Gleick, J. (1987). "Chaos: Making a New Science"</li>
                            <li>Ott, E. (2002). "Chaos in Dynamical Systems"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'markov':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">マルコフ連鎖（Markov Chain）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            マルコフ連鎖は、現在の状態が過去の状態に依存せず、直前の状態のみに依存する確率過程です。
                            この性質は「マルコフ性」と呼ばれ、状態遷移確率行列によって完全に記述されます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            ナンバーズ3では、各桁の値が0から9までの10状態を持ち、
                            前回の値から次の値への遷移確率を学習することで、次回の値を予測します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">遷移確率行列</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            遷移確率行列 P は、状態 i から状態 j への遷移確率 P<sub>ij</sub> を要素とする行列です。
                            この行列は、過去のデータから統計的に推定され、次の状態の確率分布を計算するために使用されます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、各桁について独立したマルコフ連鎖を構築し、
                            最も確率の高い組み合わせを予測として出力します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Markov, A. A. (1906). "Extension of the limit theorems of probability theory"</li>
                            <li>Norris, J. R. (1998). "Markov Chains"</li>
                            <li>Kemeny, J. G., & Snell, J. L. (1976). "Finite Markov Chains"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'bayesian':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">ベイズ統計（Bayesian Statistics）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            ベイズ統計は、ベイズの定理に基づく統計的推論の方法論です。
                            事前確率（prior）と観測データから得られる尤度（likelihood）を組み合わせて、
                            事後確率（posterior）を計算します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            ベイズの定理は以下の式で表されます：
                            <br><strong>P(仮説|データ) = P(データ|仮説) × P(仮説) / P(データ)</strong>
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">ベイズ更新</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            新しいデータが観測されるたびに、事前確率を事後確率で更新するプロセスを「ベイズ更新」と呼びます。
                            このプロセスにより、データが増えるにつれて予測の精度が向上します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            ナンバーズ3の予測では、各桁の値について過去の出現頻度を事前確率として設定し、
                            最新のトレンドを尤度として組み合わせることで、より正確な予測を実現します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Bayes, T. (1763). "An Essay towards solving a Problem in the Doctrine of Chances"</li>
                            <li>Gelman, A., et al. (2013). "Bayesian Data Analysis"</li>
                            <li>Kruschke, J. K. (2014). "Doing Bayesian Data Analysis"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'periodicity':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">周期性分析（Periodicity Analysis）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            周期性分析は、時系列データに含まれる周期的なパターンを検出・分析する統計的手法です。
                            時間的な規則性を発見することで、将来の値を予測するための重要な情報を得られます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、曜日、月、四半期などの時間的周期に基づいて、
                            各桁の値の出現パターンを分析します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">周期パターンの検出</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            周期性分析では、特定の時間周期（例：毎週月曜日、毎月1日など）における
                            各桁の値の出現確率を計算します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            これらの確率分布を比較することで、どの時間帯にどの値が出現しやすいかを特定し、
                            次回の抽選日がどの周期に該当するかに基づいて予測を行います。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Box, G. E. P., & Jenkins, G. M. (1976). "Time Series Analysis"</li>
                            <li>Hamilton, J. D. (1994). "Time Series Analysis"</li>
                            <li>Shumway, R. H., & Stoffer, D. S. (2017). "Time Series Analysis and Its Applications"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'pattern':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">頻出パターン分析（Frequent Pattern Analysis）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            頻出パターン分析は、データマイニングの分野で発展した手法で、
                            データセット内で頻繁に出現するパターンや組み合わせを発見することを目的とします。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            ナンバーズ3では、3桁の組み合わせや2桁の組み合わせがどの程度の頻度で出現するかを分析し、
                            頻出するパターンを特定します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">アソシエーションルール</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            頻出パターン分析では、「支持度（support）」と「信頼度（confidence）」という指標を使用します。
                            支持度はパターンの出現頻度、信頼度はパターン間の関連性の強さを表します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、過去のデータから頻出する3桁・2桁の組み合わせを抽出し、
                            これらのパターンが次回も出現する可能性が高いと仮定して予測を行います。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Agrawal, R., et al. (1993). "Mining Association Rules between Sets of Items"</li>
                            <li>Han, J., et al. (2011). "Data Mining: Concepts and Techniques"</li>
                            <li>Tan, P. N., et al. (2018). "Introduction to Data Mining"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'random_forest':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">ランダムフォレスト（Random Forest）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            ランダムフォレストは、Leo Breimanによって2001年に提案された機械学習アルゴリズムです。
                            複数の決定木（decision tree）を組み合わせたアンサンブル学習手法で、
                            各決定木の予測を平均化することで、より正確で安定した予測を実現します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            ランダムフォレストは、バギング（bootstrap aggregating）とランダム特徴選択を組み合わせることで、
                            過学習を抑制し、汎化性能を向上させます。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">決定木とアンサンブル学習</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            各決定木は、データのサブセットと特徴量のサブセットを使用して学習されます。
                            この「ランダム性」により、各木が異なるパターンを学習し、
                            それらの予測を組み合わせることで、単一の決定木よりも優れた性能を発揮します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            さらに、ランダムフォレストは特徴量の重要度を計算できるため、
                            どの特徴量が予測に最も寄与しているかを理解できます。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">特徴量エンジニアリング</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            本システムでは、移動平均（MA）、指数移動平均（EMA）、RSI（相対力指数）、
                            MACD（移動平均収束拡散）、ボリンジャーバンドなどの技術指標を特徴量として使用しています。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            これらの特徴量は、金融時系列分析で広く使用されており、
                            トレンド、ボラティリティ、モメンタムなどの情報を数値化します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Breiman, L. (2001). "Random Forests"</li>
                            <li>Hastie, T., et al. (2009). "The Elements of Statistical Learning"</li>
                            <li>James, G., et al. (2021). "An Introduction to Statistical Learning"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'xgboost':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">XGBoost（Extreme Gradient Boosting）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            XGBoostは、Chen & Guestrinによって2016年に提案された勾配ブースティングアルゴリズムです。
                            弱学習器（通常は決定木）を順次追加し、前のモデルの誤差を修正することで、
                            段階的に予測精度を向上させるアンサンブル学習手法です。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            XGBoostは、正則化項を追加することで過学習を抑制し、
                            並列処理と近似アルゴリズムにより高速な学習を実現します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">勾配ブースティング</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            勾配ブースティングは、損失関数の勾配（gradient）に基づいて新しいモデルを追加します。
                            各ステップで、前のモデルの予測誤差を最小化する方向に新しいモデルを学習することで、
                            全体の予測精度を向上させます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            XGBoostは、この勾配ブースティングの原理を拡張し、
                            正則化（L1、L2）と木の複雑さの制御により、汎化性能を向上させています。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">特徴量の重要度</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            XGBoostは、各特徴量が予測にどれだけ寄与しているかを定量化できます。
                            特徴量の重要度は、その特徴量が分割に使用された回数と、
                            その分割による損失の減少量に基づいて計算されます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、この特徴量重要度を分析することで、
                            どの技術指標や過去のデータが予測に最も影響を与えているかを理解できます。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Chen, T., & Guestrin, C. (2016). "XGBoost: A Scalable Tree Boosting System"</li>
                            <li>Friedman, J. H. (2001). "Greedy Function Approximation: A Gradient Boosting Machine"</li>
                            <li>Hastie, T., et al. (2009). "The Elements of Statistical Learning"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'lightgbm':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">LightGBM（Light Gradient Boosting Machine）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            LightGBMは、Microsoftによって2017年に開発された勾配ブースティングフレームワークです。
                            XGBoostと同様に勾配ブースティングの原理に基づいていますが、
                            「Gradient-based One-Side Sampling（GOSS）」と「Exclusive Feature Bundling（EFB）」という
                            革新的な技術により、より高速で効率的な学習を実現します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            LightGBMは、大規模データセットでも高速に学習でき、
                            メモリ使用量も少ないため、実用的な機械学習システムで広く使用されています。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">GOSSとEFB</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            GOSS（Gradient-based One-Side Sampling）は、勾配の大きいデータポイントを優先的に使用し、
                            勾配の小さいデータポイントをランダムサンプリングすることで、学習速度を向上させます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            EFB（Exclusive Feature Bundling）は、互いに排他的な特徴量を束ねることで、
                            特徴量の数を削減し、メモリ使用量と計算時間を削減します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">Leaf-wise成長</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            LightGBMは、従来のレベルワイズ（level-wise）成長ではなく、
                            リーフワイズ（leaf-wise）成長を使用します。
                            これは、損失を最も減少させる葉を優先的に分割することで、
                            より効率的な木の構築を可能にします。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            この成長戦略により、同じ深さの木でも、より高い予測精度を達成できます。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Ke, G., et al. (2017). "LightGBM: A Highly Efficient Gradient Boosting Decision Tree"</li>
                            <li>Friedman, J. H. (2001). "Greedy Function Approximation: A Gradient Boosting Machine"</li>
                            <li>Chen, T., & Guestrin, C. (2016). "XGBoost: A Scalable Tree Boosting System"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'arima':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">ARIMA（AutoRegressive Integrated Moving Average）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            ARIMAモデルは、George BoxとGwilym Jenkinsによって1970年代に開発された
                            時系列予測のための統計的手法です。
                            ARIMAは、自己回帰（AR）、和分（I）、移動平均（MA）の3つの要素を組み合わせたモデルです。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            ARIMAモデルは、時系列データのトレンド、季節性、自己相関を考慮し、
                            統計的に確立された手法として、経済学、金融、気象学など多くの分野で使用されています。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">ARIMA(p,d,q)パラメータ</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            ARIMA(p,d,q)モデルは、3つのパラメータで定義されます：
                        </p>
                        <ul class="text-sm text-gray-700 space-y-2 list-disc list-inside mb-3">
                            <li><strong>p（AR項）</strong>: 過去の値の数。自己回帰の次数を表します。</li>
                            <li><strong>d（I項）</strong>: 差分の次数。時系列を定常化するために必要な差分の回数です。</li>
                            <li><strong>q（MA項）</strong>: 過去の誤差項の数。移動平均の次数を表します。</li>
                        </ul>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、ARIMA(2,1,2)モデルを使用しています。
                            これは、過去2回の値と過去2回の誤差項を使用し、1回の差分を適用することを意味します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">定常性と差分</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            ARIMAモデルは、定常時系列（平均と分散が時間に依存しない）を前提としています。
                            時系列が定常でない場合、差分（differencing）を適用して定常化します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            差分は、連続する値の差を計算することで、トレンドを除去し、
                            時系列を定常化するための重要な手法です。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Box, G. E. P., & Jenkins, G. M. (1976). "Time Series Analysis: Forecasting and Control"</li>
                            <li>Hamilton, J. D. (1994). "Time Series Analysis"</li>
                            <li>Hyndman, R. J., & Athanasopoulos, G. (2021). "Forecasting: principles and practice"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'stacking':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">スタッキング（Stacking Ensemble Learning）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            スタッキングは、David Wolpertによって1992年に提案されたアンサンブル学習手法です。
                            複数の異なる予測モデル（ベースモデル）の予測結果を、
                            別のモデル（メタモデル）に入力することで、最終的な予測を行います。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            スタッキングは、各ベースモデルの長所を活かし、
                            メタモデルが最適な組み合わせ方を学習することで、
                            単一のモデルよりも高い予測精度を達成できます。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">2層構造</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            スタッキングは、2層構造を持ちます：
                        </p>
                        <ul class="text-sm text-gray-700 space-y-2 list-disc list-inside mb-3">
                            <li><strong>第1層（ベースモデル）</strong>: 複数の異なる学習アルゴリズム（ランダムフォレスト、XGBoost、LightGBMなど）が、元のデータから学習します。</li>
                            <li><strong>第2層（メタモデル）</strong>: ベースモデルの予測結果を入力として受け取り、最終的な予測を行います。</li>
                        </ul>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、ランダムフォレスト、XGBoost、LightGBMをベースモデルとして使用し、
                            Ridge回帰をメタモデルとして使用しています。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">クロスバリデーション</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            スタッキングでは、過学習を防ぐために、クロスバリデーションを使用して
                            ベースモデルの予測を生成します。
                            これにより、メタモデルは、学習データに直接依存しない予測を使用できます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、3-foldクロスバリデーションを使用しており、
                            データを3つの部分に分割し、各フォールドで異なるモデルを学習します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Wolpert, D. H. (1992). "Stacked Generalization"</li>
                            <li>Breiman, L. (1996). "Stacked Regressions"</li>
                            <li>Zhou, Z. H. (2012). "Ensemble Methods: Foundations and Algorithms"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'hmm':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">隠れマルコフモデル（Hidden Markov Model, HMM）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            隠れマルコフモデル（HMM）は、観測できない隠れた状態の遷移をモデル化する確率モデルです。
                            Leonard E. Baumらによって1960年代に開発され、音声認識、自然言語処理、バイオインフォマティクスなど
                            多くの分野で広く使用されています。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            HMMは、観測データの背後にある「状態」を推定し、
                            その状態遷移から将来の観測値を予測します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">3つの基本要素</h5>
                        <ul class="text-sm text-gray-700 space-y-2 list-disc list-inside mb-3">
                            <li><strong>状態遷移確率</strong>: ある状態から別の状態への遷移確率</li>
                            <li><strong>観測確率</strong>: 各状態から観測される値の確率分布</li>
                            <li><strong>初期状態確率</strong>: 最初の状態の確率分布</li>
                        </ul>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、GaussianHMMを使用し、各桁に対して10個の隠れ状態を設定しています。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Baum, L. E., et al. (1970). "A maximization technique occurring in the statistical analysis of probabilistic functions of Markov chains"</li>
                            <li>Rabiner, L. R. (1989). "A tutorial on hidden Markov models and selected applications in speech recognition"</li>
                            <li>Cappe, O., et al. (2005). "Inference in Hidden Markov Models"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'lstm':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">LSTM（Long Short-Term Memory）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            LSTM（長短期記憶）は、Sepp HochreiterとJürgen Schmidhuberによって1997年に提案された
                            リカレントニューラルネットワーク（RNN）の一種です。
                            従来のRNNが抱える「勾配消失問題」を解決し、長期の依存関係を学習できることが特徴です。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            LSTMは、ゲート機構（入力ゲート、忘却ゲート、出力ゲート）を使用して、
                            情報の保持と忘却を制御し、時系列データの複雑なパターンを学習します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">ゲート機構</h5>
                        <ul class="text-sm text-gray-700 space-y-2 list-disc list-inside mb-3">
                            <li><strong>忘却ゲート</strong>: セル状態から不要な情報を削除</li>
                            <li><strong>入力ゲート</strong>: 新しい情報をセル状態に追加</li>
                            <li><strong>出力ゲート</strong>: セル状態から出力を生成</li>
                        </ul>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、2層のLSTM層とDropout層を含むニューラルネットワークを使用し、
                            Adamオプティマイザーで学習を行います。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Hochreiter, S., & Schmidhuber, J. (1997). "Long Short-Term Memory"</li>
                            <li>Graves, A. (2012). "Supervised Sequence Labelling with Recurrent Neural Networks"</li>
                            <li>Goodfellow, I., et al. (2016). "Deep Learning"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'conformal':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">コンフォーマル予測（Conformal Prediction）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            コンフォーマル予測は、Vladimir Vovkらによって2000年代に開発された
                            統計的予測手法です。予測区間を統計的に保証することを特徴とし、
                            機械学習モデルの予測の不確実性を定量化します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            コンフォーマル予測は、過去の予測誤差を分析し、
                            指定した信頼水準（例：90%）で予測値が含まれる区間を計算します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">統計的保証</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            コンフォーマル予測の最大の特徴は、予測区間が統計的に保証されることです。
                            指定した信頼水準（例：90%）で、実際の値が予測区間内に含まれることが保証されます。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、スタッキングなどのベース予測手法から予測値を取得し、
                            過去の予測誤差を分析して予測区間を計算します。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Vovk, V., et al. (2005). "Algorithmic Learning in a Random World"</li>
                            <li>Shafer, G., & Vovk, V. (2008). "A Tutorial on Conformal Prediction"</li>
                            <li>Angelopoulos, A. N., & Bates, S. (2021). "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'kalman':
            html = `
                <div class="space-y-4">
                    <h4 class="font-bold text-xl text-gray-800 mb-4">カルマンフィルタ（Kalman Filter）</h4>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">理論的背景</h5>
                        <p class="text-sm text-gray-700 leading-relaxed mb-3">
                            カルマンフィルタは、Rudolf E. Kalmanによって1960年に開発された
                            状態空間モデルに基づく時系列予測手法です。
                            ノイズを含む観測データから、真の状態を推定し、次の値を予測します。
                        </p>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            カルマンフィルタは、ロボット工学、航空宇宙工学、信号処理など
                            多くの分野で広く使用されています。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-gray-700 mb-2">2つのステップ</h5>
                        <ul class="text-sm text-gray-700 space-y-2 list-disc list-inside mb-3">
                            <li><strong>予測ステップ</strong>: 前の状態から現在の状態を予測</li>
                            <li><strong>更新ステップ</strong>: 観測データを使用して予測を修正</li>
                        </ul>
                        <p class="text-sm text-gray-700 leading-relaxed">
                            本システムでは、2次元状態空間モデル（位置と速度）を使用し、
                            全履歴データに対してカルマンフィルタを適用して予測を行います。
                        </p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4">
                        <h5 class="font-semibold text-gray-700 mb-2">参考文献</h5>
                        <ul class="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Kalman, R. E. (1960). "A New Approach to Linear Filtering and Prediction Problems"</li>
                            <li>Welch, G., & Bishop, G. (2006). "An Introduction to the Kalman Filter"</li>
                            <li>Harvey, A. C. (1990). "Forecasting, Structural Time Series Models and the Kalman Filter"</li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        default:
            html = '<p class="text-gray-600">学術的説明がありません。</p>';
    }
    
    container.innerHTML = html;
}

/**
 * 各手法で利用しているデータ件数のバッジHTMLを生成
 * セット予測・ミニ予測と似たスタイルで表示
 */
function getMethodDataUsageBadgeHtml(methodKey) {
    if (!predictionData || !predictionData.statistics) return '';

    const totalRecords = predictionData.statistics.total_records || 0;
    const recentPhasesCount = (predictionData.recent_phases || []).length || 0;

    let usedText = '';
    switch (methodKey) {
        case 'chaos':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件（位相解析は全件使用）`;
            break;
        case 'markov':
        case 'bayesian':
        case 'periodicity':
        case 'pattern':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件`;
            break;
        case 'random_forest':
        case 'xgboost':
        case 'lightgbm':
        case 'stacking':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件（学習データは全件、特徴量は最大100回まで）`;
            break;
        case 'arima':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件（全件の時系列データを使用）`;
            break;
        case 'hmm':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件（GaussianHMMで10状態を学習）`;
            break;
        case 'lstm':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件（2層LSTMで全データから学習）`;
            break;
        case 'conformal':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件（ベース予測はスタッキング、過去10回の誤差を分析）`;
            break;
        case 'kalman':
            usedText = `全履歴 ${totalRecords.toLocaleString()}件（状態空間モデルで全データをフィルタリング）`;
            break;
        default:
            usedText = `${totalRecords.toLocaleString()}件`;
    }

    return `
        <div class="flex items-center justify-end mb-3">
            <div class="flex items-center gap-1.5 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-200">
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 7c0-1.657 3.134-3 7-3s7 1.343 7 3-3.134 3-7 3-7-1.343-7-3z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 7v10c0 1.657 3.134 3 7 3s7-1.343 7-3V7" />
                </svg>
                <span class="text-xs font-semibold text-gray-700">利用データ数</span>
                <span class="text-xs font-bold text-indigo-600">${usedText}</span>
            </div>
        </div>
    `;
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
        case 'random_forest':
            html = renderRandomForestDetail(method, analysis);
            break;
        case 'xgboost':
            html = renderXGBoostDetail(method, analysis);
            break;
        case 'lightgbm':
            html = renderLightGBMDetail(method, analysis);
            break;
        case 'arima':
            html = renderARIMADetail(method, analysis);
            break;
        case 'stacking':
            html = renderStackingDetail(method, analysis);
            break;
        case 'hmm':
            html = renderHMMDetail(method, analysis);
            break;
        case 'lstm':
            html = renderLSTMDetail(method, analysis);
            break;
        case 'conformal':
            html = renderConformalDetail(method, analysis);
            break;
        case 'kalman':
            html = renderKalmanDetail(method, analysis);
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
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('chaos');

    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>トレンド分析</strong>: 位相空間における短期・中期・長期トレンドを分析</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">位相トレンド分析</h4>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>位相データの取得</strong>: 全件の位相データを使用（各桁ごとに位相空間での位置を計算）</li>';
    html += '<li><strong>線形回帰による予測</strong>: 位相の時系列データに対して線形回帰を適用し、次回の位相を予測</li>';
    html += '<li><strong>位相から数字への変換</strong>: 予測された位相をsin関数を使用して0-9の数字に変換</li>';
    html += '<li><strong>予測値の生成</strong>: 各桁の予測値を組み合わせて3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    // 位相データの統計
    if (predictionData.recent_phases) {
        const phases = predictionData.recent_phases;
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">位相データ統計</h5>';
        html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">';
        for (const [pos, posPhases] of Object.entries(phases)) {
            const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
            if (posPhases && posPhases.length > 0) {
                const mean = posPhases.reduce((a, b) => a + b, 0) / posPhases.length;
                const min = Math.min(...posPhases);
                const max = Math.max(...posPhases);
                html += `<div class="bg-gray-50 p-3 rounded-lg">`;
                html += `<div class="font-semibold text-gray-700 mb-1">${posName}</div>`;
                html += `<div class="text-gray-600">データ数: ${posPhases.length}件</div>`;
                html += `<div class="text-gray-600">平均: ${mean.toFixed(3)}</div>`;
                html += `<div class="text-gray-600">範囲: ${min.toFixed(3)} ～ ${max.toFixed(3)}</div>`;
                html += `</div>`;
            }
        }
        html += '</div>';
        html += '</div>';
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
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('markov');

    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>相関分析</strong>: 桁間相関と自己相関を分析し、遷移確率の補正に使用</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">遷移確率分析</h4>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>遷移確率行列の構築</strong>: 全履歴データから、各桁の0-9の数字間の遷移回数をカウント</li>';
    html += '<li><strong>確率の正規化</strong>: 各行の合計が1になるように正規化し、遷移確率行列を完成</li>';
    html += '<li><strong>予測の実行</strong>: 最新の数字から、遷移確率行列を使用して最も確率の高い次の数字を予測</li>';
    html += '<li><strong>各桁の独立予測</strong>: 百の位、十の位、一の位をそれぞれ独立したマルコフ連鎖として予測</li>';
    html += '</ol>';
    html += '</div>';
    
    // 自己相関の表示
    html += '<div class="bg-white rounded-lg p-3 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-2 font-semibold">自己相関（前回との相関）:</p>';
    html += `<ul class="text-sm text-gray-600 space-y-1">`;
    if (correlations.hundred_lag1 !== undefined) {
        html += `<li>百の位: ${(correlations.hundred_lag1 * 100).toFixed(2)}%</li>`;
    }
    if (correlations.ten_lag1 !== undefined) {
        html += `<li>十の位: ${(correlations.ten_lag1 * 100).toFixed(2)}%</li>`;
    }
    if (correlations.one_lag1 !== undefined) {
        html += `<li>一の位: ${(correlations.one_lag1 * 100).toFixed(2)}%</li>`;
    }
    html += `</ul>`;
    html += '<p class="text-xs text-gray-500 mt-2">※自己相関が高いほど、前回の値が次回の値に影響を与えやすい</p>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * ベイズ統計の詳細を表示
 */
function renderBayesianDetail(method, analysis) {
    const patterns = analysis.frequent_patterns || {};
    const trends = analysis.trends || {};
    const correlations = analysis.correlations || {};
    let html = '<div class="space-y-4">';

    // 利用データ数
    html += getMethodDataUsageBadgeHtml('bayesian');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>頻出パターン分析</strong>: 過去の出現頻度を事前確率として使用</li>';
    html += '<li><strong>トレンド分析</strong>: 最新のトレンドを尤度として組み合わせ</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">ベイズ更新分析</h4>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>事前分布の計算</strong>: 全履歴データから各桁の各数字（0-9）の出現頻度を計算（重み: 0.3）</li>';
    html += '<li><strong>尤度の計算</strong>: 直近20回のデータから各桁の各数字の出現頻度を計算（重み: 0.7）</li>';
    html += '<li><strong>事後確率の計算</strong>: 事前分布と尤度の重み付き平均で事後確率を計算（P(事後) = 0.3 × P(事前) + 0.7 × P(尤度)）</li>';
    html += '<li><strong>予測の実行</strong>: 各桁で事後確率が最も高い数字を選択し、3桁の数字を生成</li>';
    html += '</ol>';
    html += '<div class="mt-3 p-3 bg-blue-50 rounded-lg">';
    html += '<p class="text-xs text-blue-800 font-semibold mb-1">ベイズの定理（簡易版）:</p>';
    html += '<p class="text-xs text-blue-700">P(仮説|データ) = P(データ|仮説) × P(仮説) / P(データ)</p>';
    html += '<p class="text-xs text-blue-600 mt-2">※本実装では、重み付き平均により簡易的に事後確率を計算</p>';
    html += '</div>';
    html += '</div>';
    
    // 頻出パターン（事前確率の参考）
    if (patterns.set_top && Object.keys(patterns.set_top).length > 0) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">事前確率の参考（頻出3桁パターン上位5件）</h5>';
        html += '<ul class="text-sm text-gray-600 space-y-1">';
        const top5 = Object.entries(patterns.set_top).slice(0, 5);
        top5.forEach(([pattern, count]) => {
            html += `<li><strong>${pattern}</strong>: ${count}回出現（出現確率の参考）</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    // トレンド分析（尤度の参考）
    if (trends && Object.keys(trends).length > 0) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">尤度の参考（最新トレンド）</h5>';
        
        for (const [pos, posTrends] of Object.entries(trends)) {
            const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
            html += `<div class="mb-3">`;
            html += `<p class="text-sm font-medium text-gray-700 mb-1">${posName}</p>`;
            
            if (posTrends.short) {
                const trendIcon = posTrends.short.trend > 0 ? '📈' : posTrends.short.trend < 0 ? '📉' : '➡️';
                html += `<p class="text-xs text-gray-600">短期トレンド（直近10回）: ${trendIcon} 平均 ${posTrends.short.mean.toFixed(2)}, 傾き ${posTrends.short.trend > 0 ? '+' : ''}${posTrends.short.trend.toFixed(3)}</p>`;
            }
            if (posTrends.mid) {
                const trendIcon = posTrends.mid.trend > 0 ? '📈' : posTrends.mid.trend < 0 ? '📉' : '➡️';
                html += `<p class="text-xs text-gray-600">中期トレンド（直近50回）: ${trendIcon} 平均 ${posTrends.mid.mean.toFixed(2)}, 傾き ${posTrends.mid.trend > 0 ? '+' : ''}${posTrends.mid.trend.toFixed(3)}</p>`;
            }
            html += `</div>`;
        }
        html += '</div>';
    }
    
    // 相関分析（補助情報）
    if (correlations && Object.keys(correlations).length > 0) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">補助情報（相関分析）</h5>';
        
        if (correlations.hundred_sum !== undefined) {
            html += '<div class="mb-2">';
            html += '<p class="text-sm text-gray-700 mb-1">合計値との相関:</p>';
            html += `<ul class="text-sm text-gray-600 space-y-1 ml-4">`;
            html += `<li>百の位: ${(correlations.hundred_sum * 100).toFixed(2)}%</li>`;
            html += `<li>十の位: ${(correlations.ten_sum * 100).toFixed(2)}%</li>`;
            html += `<li>一の位: ${(correlations.one_sum * 100).toFixed(2)}%</li>`;
            html += `</ul>`;
            html += '</div>';
        }
        
        if (correlations.hundred_lag1 !== undefined) {
            html += '<div class="mb-2">';
            html += '<p class="text-sm text-gray-700 mb-1">自己相関（前回との相関）:</p>';
            html += `<ul class="text-sm text-gray-600 space-y-1 ml-4">`;
            html += `<li>百の位: ${(correlations.hundred_lag1 * 100).toFixed(2)}%</li>`;
            html += `<li>十の位: ${(correlations.ten_lag1 * 100).toFixed(2)}%</li>`;
            html += `<li>一の位: ${(correlations.one_lag1 * 100).toFixed(2)}%</li>`;
            html += `</ul>`;
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * 周期性分析の詳細を表示
 */
function renderPeriodicityDetail(method, analysis) {
    const periodicity = analysis.periodicity || {};
    const frequency = analysis.frequency_analysis || {};
    let html = '<div class="space-y-4">';

    // 利用データ数
    html += getMethodDataUsageBadgeHtml('periodicity');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>周期性分析</strong>: 曜日・月次・四半期パターンを直接使用</li>';
    if (frequency && Object.keys(frequency).length > 0) {
        html += '<li><strong>周波数解析</strong>: フーリエ変換による周期性の検証に使用</li>';
    }
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">周期性パターン分析</h4>';
    
    // 現在の日付情報を取得
    const lastDate = predictionData.statistics?.last_date ? new Date(predictionData.statistics.last_date) : new Date();
    const currentWeekday = lastDate.getDay(); // 0=日曜日, 6=土曜日
    const currentMonth = lastDate.getMonth() + 1; // 1-12
    const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1; // 1-4
    
    const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
    
    // 曜日パターンのグラフ
    if (periodicity.weekday) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">曜日別出現傾向</h5>';
        
        for (const [pos, posPatterns] of Object.entries(periodicity.weekday)) {
            const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
            html += `<div class="mb-4">`;
            html += `<p class="text-sm font-medium text-gray-600 mb-2">${posName}</p>`;
            html += `<div class="h-48">`;
            html += `<canvas id="periodicity-weekday-${pos}"></canvas>`;
            html += `</div>`;
            html += `</div>`;
            
            // グラフを描画（少し遅延させてDOMに追加された後に実行）
            setTimeout(() => {
                renderPeriodicityChart(`periodicity-weekday-${pos}`, posPatterns, weekdayNames, '曜日', pos);
            }, 200);
        }
        
        html += '</div>';
    }
    
    // 月次パターンのグラフ
    if (periodicity.monthly) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">月別出現傾向</h5>';
        
        for (const [pos, posPatterns] of Object.entries(periodicity.monthly)) {
            const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
            html += `<div class="mb-4">`;
            html += `<p class="text-sm font-medium text-gray-600 mb-2">${posName}</p>`;
            html += `<div class="h-48">`;
            html += `<canvas id="periodicity-monthly-${pos}"></canvas>`;
            html += `</div>`;
            html += `</div>`;
            
            setTimeout(() => {
                renderPeriodicityChart(`periodicity-monthly-${pos}`, posPatterns, Array.from({length: 12}, (_, i) => `${i+1}月`), '月', pos);
            }, 200);
        }
        
        html += '</div>';
    }
    
    // 四半期パターンのグラフ
    if (periodicity.quarterly) {
        html += '<div class="bg-white rounded-lg p-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">四半期別出現傾向</h5>';
        
        for (const [pos, posPatterns] of Object.entries(periodicity.quarterly)) {
            const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
            html += `<div class="mb-4">`;
            html += `<p class="text-sm font-medium text-gray-600 mb-2">${posName}</p>`;
            html += `<div class="h-48">`;
            html += `<canvas id="periodicity-quarterly-${pos}"></canvas>`;
            html += `</div>`;
            html += `</div>`;
            
            setTimeout(() => {
                renderPeriodicityChart(`periodicity-quarterly-${pos}`, posPatterns, ['Q1', 'Q2', 'Q3', 'Q4'], '四半期', pos);
            }, 200);
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * 周期性パターンのグラフを描画
 */
function renderPeriodicityChart(canvasId, patterns, labels, labelType, pos) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`[renderPeriodicityChart] キャンバスが見つかりません: ${canvasId}`);
        return;
    }
    
    // 既存のグラフを破棄
    if (periodicityCharts[canvasId]) {
        periodicityCharts[canvasId].destroy();
        delete periodicityCharts[canvasId];
    }
    
    const ctx = canvas.getContext('2d');
    
    // 各数字（0-9）ごとの出現確率を計算
    const datasets = [];
    const colors = [
        'rgb(99, 102, 241)', 'rgb(16, 185, 129)', 'rgb(251, 146, 60)',
        'rgb(239, 68, 68)', 'rgb(168, 85, 247)', 'rgb(236, 72, 153)',
        'rgb(59, 130, 246)', 'rgb(34, 197, 94)', 'rgb(245, 158, 11)',
        'rgb(139, 92, 246)'
    ];
    
    for (let digit = 0; digit < 10; digit++) {
        const data = labels.map((label, index) => {
            // キーの取得方法を修正
            let periodKey;
            if (labelType === '曜日') {
                periodKey = index; // 0-6
            } else if (labelType === '月') {
                periodKey = index + 1; // 1-12
            } else {
                periodKey = index + 1; // 1-4
            }
            
            const periodData = patterns[periodKey];
            if (!periodData) return 0;
            
            // 数字のキーを確認（文字列または数値の可能性）
            const prob = periodData[String(digit)] !== undefined ? periodData[String(digit)] : 
                        periodData[digit] !== undefined ? periodData[digit] : 0;
            
            return prob !== undefined && prob !== null ? parseFloat((prob * 100).toFixed(2)) : 0;
        });
        
        datasets.push({
            label: `数字${digit}`,
            data: data,
            borderColor: colors[digit],
            backgroundColor: colors[digit].replace('rgb', 'rgba').replace(')', ', 0.1)'),
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 5
        });
    }
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: {
                            size: 10
                        },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 30,
                    title: {
                        display: true,
                        text: '出現確率 (%)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: labelType
                    }
                }
            }
        }
    });
    
    // グラフインスタンスを保存
    periodicityCharts[canvasId] = chart;
}

/**
 * 相関分析の詳細を表示
 */
function renderCorrelationsDetail(correlations, container) {
    if (!correlations) {
        container.innerHTML = '<p class="text-gray-600">相関分析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    
    // 桁間相関
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h4 class="font-bold text-gray-800 mb-3">桁間相関</h4>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';
    html += `<div class="text-center p-3 bg-blue-50 rounded-lg">`;
    html += `<p class="text-xs text-gray-600 mb-1">百の位 ↔ 十の位</p>`;
    html += `<p class="text-xl font-bold text-blue-700">${(correlations.hundred_ten * 100).toFixed(2)}%</p>`;
    html += `</div>`;
    html += `<div class="text-center p-3 bg-green-50 rounded-lg">`;
    html += `<p class="text-xs text-gray-600 mb-1">十の位 ↔ 一の位</p>`;
    html += `<p class="text-xl font-bold text-green-700">${(correlations.ten_one * 100).toFixed(2)}%</p>`;
    html += `</div>`;
    html += `<div class="text-center p-3 bg-purple-50 rounded-lg">`;
    html += `<p class="text-xs text-gray-600 mb-1">百の位 ↔ 一の位</p>`;
    html += `<p class="text-xl font-bold text-purple-700">${(correlations.hundred_one * 100).toFixed(2)}%</p>`;
    html += `</div>`;
    html += '</div>';
    html += '</div>';
    
    // 自己相関（ラグ分析）
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h4 class="font-bold text-gray-800 mb-3">自己相関（ラグ分析）</h4>';
    html += '<div class="space-y-3">';
    
    for (const pos of ['hundred', 'ten', 'one']) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos];
        html += `<div class="border-l-4 border-blue-500 pl-3">`;
        html += `<p class="font-semibold text-gray-700 mb-2">${posName}</p>`;
        html += '<div class="grid grid-cols-5 gap-2 text-sm">';
        for (const lag of [1, 2, 3, 5, 10]) {
            const key = `${pos}_lag${lag}`;
            const value = correlations[key] || 0;
            const colorClass = Math.abs(value) > 0.02 ? 'text-blue-700 font-bold' : 'text-gray-600';
            html += `<div class="text-center">`;
            html += `<p class="text-xs text-gray-500">${lag}回前</p>`;
            html += `<p class="${colorClass}">${(value * 100).toFixed(2)}%</p>`;
            html += `</div>`;
        }
        html += '</div>';
        html += `</div>`;
    }
    
    html += '</div>';
    html += '</div>';
    
    // 合計値との相関
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h4 class="font-bold text-gray-800 mb-3">合計値との相関</h4>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';
    html += `<div class="text-center p-3 bg-orange-50 rounded-lg">`;
    html += `<p class="text-xs text-gray-600 mb-1">百の位</p>`;
    html += `<p class="text-xl font-bold text-orange-700">${(correlations.hundred_sum * 100).toFixed(2)}%</p>`;
    html += `</div>`;
    html += `<div class="text-center p-3 bg-orange-50 rounded-lg">`;
    html += `<p class="text-xs text-gray-600 mb-1">十の位</p>`;
    html += `<p class="text-xl font-bold text-orange-700">${(correlations.ten_sum * 100).toFixed(2)}%</p>`;
    html += `</div>`;
    html += `<div class="text-center p-3 bg-orange-50 rounded-lg">`;
    html += `<p class="text-xs text-gray-600 mb-1">一の位</p>`;
    html += `<p class="text-xl font-bold text-orange-700">${(correlations.one_sum * 100).toFixed(2)}%</p>`;
    html += `</div>`;
    html += '</div>';
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * トレンド分析の詳細を表示
 */
function renderTrendsDetail(trends, container) {
    if (!trends) {
        container.innerHTML = '<p class="text-gray-600">トレンド分析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    
    for (const [pos, posTrends] of Object.entries(trends)) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
        html += '<div class="bg-white rounded-lg p-4">';
        html += `<h4 class="font-bold text-gray-800 mb-3">${posName}</h4>`;
        
        // グラフ用のキャンバス
        html += `<div class="h-64 mb-4">`;
        html += `<canvas id="trend-chart-${pos}"></canvas>`;
        html += `</div>`;
        
        // トレンド情報のテーブル
        html += '<div class="overflow-x-auto">';
        html += '<table class="w-full text-sm">';
        html += '<thead><tr class="bg-gray-100">';
        html += '<th class="px-4 py-2 text-left">期間</th>';
        html += '<th class="px-4 py-2 text-center">平均</th>';
        html += '<th class="px-4 py-2 text-center">傾き</th>';
        html += '<th class="px-4 py-2 text-center">ボラティリティ</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        for (const [period, data] of Object.entries(posTrends)) {
            const periodName = {'short': '短期（直近10回）', 'mid': '中期（直近50回）', 'long': '長期（直近200回）'}[period] || period;
            const trendIcon = data.trend > 0 ? '📈' : data.trend < 0 ? '📉' : '➡️';
            html += '<tr class="border-b">';
            html += `<td class="px-4 py-2">${periodName}</td>`;
            html += `<td class="px-4 py-2 text-center">${data.mean.toFixed(2)}</td>`;
            html += `<td class="px-4 py-2 text-center">${trendIcon} ${data.trend > 0 ? '+' : ''}${data.trend.toFixed(3)}</td>`;
            html += `<td class="px-4 py-2 text-center">${data.volatility.toFixed(2)}</td>`;
            html += '</tr>';
        }
        
        html += '</tbody>';
        html += '</table>';
        html += '</div>';
        html += '</div>';
        
        // グラフを描画
        setTimeout(() => {
            renderTrendChart(`trend-chart-${pos}`, posTrends);
        }, 200);
    }
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * トレンドグラフを描画
 */
function renderTrendChart(canvasId, trends) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const labels = [];
    const meanData = [];
    const trendData = [];
    
    for (const [period, data] of Object.entries(trends)) {
        const periodName = {'short': '短期', 'mid': '中期', 'long': '長期'}[period] || period;
        labels.push(periodName);
        meanData.push(data.mean);
        trendData.push(data.trend * 10 + 5); // スケール調整
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '平均値',
                    data: meanData,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 2
                },
                {
                    label: 'トレンド（調整済み）',
                    data: trendData,
                    type: 'line',
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '値'
                    }
                }
            }
        }
    });
}

/**
 * クラスタリング分析の詳細を表示
 */
function renderClusteringDetail(clustering, container) {
    if (!clustering || !clustering.cluster_analysis) {
        container.innerHTML = '<p class="text-gray-600">クラスタリング分析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    
    html += '<div class="bg-white rounded-lg p-4">';
    html += `<p class="text-sm text-gray-700 mb-3">データは <span class="font-bold text-purple-600">${clustering.n_clusters}</span> 個のクラスタに分類されました。</p>`;
    html += `<p class="text-sm text-gray-700 mb-4">最新データは <span class="font-bold text-blue-600">クラスタ ${clustering.latest_cluster}</span> に属しています。</p>`;
    html += '</div>';
    
    // 各クラスタの特徴
    html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    for (const [clusterId, clusterData] of Object.entries(clustering.cluster_analysis)) {
        html += '<div class="bg-white rounded-lg p-4 border-2 border-purple-200">';
        html += `<h4 class="font-bold text-gray-800 mb-3">クラスタ ${clusterId}</h4>`;
        html += `<p class="text-sm text-gray-600 mb-2">データ数: <span class="font-bold">${clusterData.count}</span> 件</p>`;
        html += '<div class="space-y-2 text-sm">';
        html += `<p>百の位平均: <span class="font-semibold">${clusterData.hundred_mean.toFixed(2)}</span></p>`;
        html += `<p>十の位平均: <span class="font-semibold">${clusterData.ten_mean.toFixed(2)}</span></p>`;
        html += `<p>一の位平均: <span class="font-semibold">${clusterData.one_mean.toFixed(2)}</span></p>`;
        html += `<p>合計平均: <span class="font-semibold">${clusterData.sum_mean.toFixed(2)}</span></p>`;
        html += '</div>';
        
        // 頻出パターン
        if (clusterData.most_common_set && Object.keys(clusterData.most_common_set).length > 0) {
            html += '<div class="mt-3 pt-3 border-t border-gray-200">';
            html += '<p class="text-xs font-semibold text-gray-600 mb-2">頻出3桁:</p>';
            html += '<div class="flex flex-wrap gap-2">';
            const top5 = Object.entries(clusterData.most_common_set).slice(0, 5);
            top5.forEach(([pattern, count]) => {
                html += `<span class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">${pattern} (${count})</span>`;
            });
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
    }
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * 頻出パターン分析の詳細を表示
 */
function renderPatternDetail(method, analysis) {
    const patterns = analysis.frequent_patterns || {};
    const correlations = analysis.correlations || {};
    let html = '<div class="space-y-4">';

    // 利用データ数
    html += getMethodDataUsageBadgeHtml('pattern');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>頻出パターン分析</strong>: 3桁・2桁の頻出組み合わせを直接使用</li>';
    html += '<li><strong>相関分析</strong>: 桁間相関を考慮したパターン選択</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">頻出パターン分析</h4>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>頻出パターンの抽出</strong>: 全履歴データから、3桁コンボ（set_top）と2桁コンボ（mini_top、hundred_ten_top、ten_one_top）の出現頻度を計算</li>';
    html += '<li><strong>最新データとの照合</strong>: 最新の数字（百の位と十の位、十の位と一の位）が頻出パターンに含まれているか確認</li>';
    html += '<li><strong>予測の実行</strong>: 頻出パターンに基づいて次の数字を予測（百の位と十の位の組み合わせから一の位を、十の位と一の位の組み合わせから百の位を予測）</li>';
    html += '<li><strong>予測値の生成</strong>: 各桁の予測値を組み合わせて3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
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
 * ランダムフォレストの詳細を表示
 */
function renderRandomForestDetail(method, analysis) {
    let html = '<div class="space-y-4">';

    // 利用データ数
    html += getMethodDataUsageBadgeHtml('random_forest');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>トレンド分析</strong>: 移動平均（MA）、指数移動平均（EMA）として特徴量に使用</li>';
    html += '<li><strong>相関分析</strong>: RSI、MACDなどの技術指標として特徴量に使用</li>';
    html += '<li><strong>クラスタリング分析</strong>: パターンのグループ化情報を特徴量に使用</li>';
    html += '<li><strong>周波数解析</strong>: 周期性情報を特徴量に使用</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">ランダムフォレスト分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">ランダムフォレストは、複数の決定木を組み合わせた機械学習モデルです。過去のデータから学習し、特徴量の重要度を評価しながら予測を行います。</p>';
    html += '</div>';
    
    // 統計情報を表示
    if (method.statistics) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">特徴量統計</h5>';
        html += '<div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">';
        html += `<div><span class="text-gray-600">総特徴量数:</span> <span class="font-bold">${method.statistics.total_features}</span></div>`;
        html += `<div><span class="text-gray-600">最大重要度:</span> <span class="font-bold">${method.statistics.max_importance.toFixed(4)}</span></div>`;
        html += `<div><span class="text-gray-600">平均重要度:</span> <span class="font-bold">${method.statistics.mean_importance.toFixed(4)}</span></div>`;
        html += `<div><span class="text-gray-600">上位10位合計:</span> <span class="font-bold">${(method.statistics.top10_importance_sum * 100).toFixed(1)}%</span></div>`;
        html += `<div><span class="text-gray-600">上位20位合計:</span> <span class="font-bold">${(method.statistics.top20_importance_sum * 100).toFixed(1)}%</span></div>`;
        html += '</div>';
        html += '</div>';
    }
    
    // 特徴量の重要度を表示
    if (method.feature_importance_ranked && method.feature_importance_ranked.length > 0) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">特徴量の重要度（上位20件）</h5>';
        html += '<div class="space-y-2 max-h-96 overflow-y-auto">';
        
        method.feature_importance_ranked.slice(0, 20).forEach((item, rank) => {
            const percentage = (item.importance * 100).toFixed(2);
            const maxImportance = method.feature_importance_ranked[0].importance;
            const widthPercent = (item.importance / maxImportance * 100).toFixed(1);
            
            html += '<div class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">';
            html += `<span class="text-xs font-semibold text-gray-600 w-8">${rank + 1}位</span>`;
            html += `<span class="text-xs text-gray-700 flex-1 truncate" title="${item.name}">${item.name}</span>`;
            html += '<div class="flex-1 bg-gray-200 rounded-full h-4 relative max-w-xs">';
            html += `<div class="bg-emerald-500 h-4 rounded-full" style="width: ${widthPercent}%"></div>`;
            html += '</div>';
            html += `<span class="text-xs font-semibold text-gray-700 w-16 text-right">${percentage}%</span>`;
            html += '</div>';
        });
        
        html += '</div>';
        html += '</div>';
    } else if (method.feature_importance && method.feature_importance.length > 0) {
        // 後方互換性のため、feature_importance_rankedがない場合は従来の方法を使用
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">特徴量の重要度（上位10件）</h5>';
        html += '<div class="space-y-2">';
        
        const importanceWithIndex = method.feature_importance.map((val, idx) => ({ idx, val }));
        importanceWithIndex.sort((a, b) => b.val - a.val);
        
        importanceWithIndex.slice(0, 10).forEach((item, rank) => {
            const percentage = (item.val * 100).toFixed(2);
            html += '<div class="flex items-center gap-3">';
            html += `<span class="text-xs font-semibold text-gray-600 w-8">${rank + 1}位</span>`;
            html += '<div class="flex-1 bg-gray-200 rounded-full h-4 relative">';
            html += `<div class="bg-emerald-500 h-4 rounded-full" style="width: ${percentage}%"></div>`;
            html += '</div>';
            html += `<span class="text-xs font-semibold text-gray-700 w-16 text-right">${percentage}%</span>`;
            html += '</div>';
        });
        
        html += '</div>';
        html += '</div>';
    }
    
    // 高度な特徴量の説明
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">使用している特徴量</h5>';
    html += '<ul class="text-sm text-gray-600 space-y-2">';
    html += '<li>• <strong>過去最大100回の基本データ</strong>: 各桁の値、合計値、範囲（全データを使用する場合は最大100回まで）</li>';
    html += '<li>• <strong>移動平均（MA）</strong>: 5回、10回、20回、50回の移動平均（全データから計算）</li>';
    html += '<li>• <strong>指数移動平均（EMA）</strong>: より最近のデータに重みを付けた平均（全データから計算）</li>';
    html += '<li>• <strong>RSI（相対力指数）</strong>: 上昇と下降の強さを測定（全データから計算）</li>';
    html += '<li>• <strong>MACD</strong>: トレンドの変化を検出（全データから計算）</li>';
    html += '<li>• <strong>ボリンジャーバンド</strong>: 統計的な価格帯を表示（全データから計算）</li>';
    html += '</ul>';
    html += '<p class="text-xs text-gray-500 mt-2">※学習データは全件使用、特徴量の「過去N回の基本データ」は最大100回までに制限</p>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * XGBoostの詳細を表示
 */
function renderXGBoostDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('xgboost');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>トレンド分析</strong>: 移動平均（MA）、指数移動平均（EMA）として特徴量に使用</li>';
    html += '<li><strong>相関分析</strong>: RSI、MACDなどの技術指標として特徴量に使用</li>';
    html += '<li><strong>クラスタリング分析</strong>: パターンのグループ化情報を特徴量に使用</li>';
    html += '<li><strong>周波数解析</strong>: 周期性情報を特徴量に使用</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">XGBoost分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">XGBoostは、勾配ブースティングによる高精度な機械学習モデルです。各桁を個別に予測し、特徴量の重要度を評価しながら予測を行います。</p>';
    html += '</div>';
    
    // 特徴量の重要度を表示
    if (method.feature_importance && method.feature_importance.length > 0) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">特徴量の重要度（上位10件）</h5>';
        html += '<div class="space-y-2">';
        
        const importanceWithIndex = method.feature_importance.map((val, idx) => ({ idx, val }));
        importanceWithIndex.sort((a, b) => b.val - a.val);
        
        importanceWithIndex.slice(0, 10).forEach((item, rank) => {
            const percentage = (item.val * 100).toFixed(2);
            const maxImportance = importanceWithIndex[0].val;
            const widthPercent = (item.val / maxImportance * 100).toFixed(1);
            
            html += '<div class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">';
            html += `<span class="text-xs font-semibold text-gray-600 w-8">${rank + 1}位</span>`;
            html += '<div class="flex-1 bg-gray-200 rounded-full h-4 relative max-w-xs">';
            html += `<div class="bg-red-500 h-4 rounded-full" style="width: ${widthPercent}%"></div>`;
            html += '</div>';
            html += `<span class="text-xs font-semibold text-gray-700 w-16 text-right">${percentage}%</span>`;
            html += '</div>';
        });
        
        html += '</div>';
        html += '</div>';
    }
    
    // 予測の説明
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">予測プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>特徴量の準備</strong>: 全データから学習データを作成（過去最大100回の基本データ + 高度な特徴量: MA、EMA、RSI、MACDなど）</li>';
    html += '<li><strong>モデルの学習</strong>: 各桁（百の位、十の位、一の位）に対して個別にXGBoostモデルを学習（全データを使用）</li>';
    html += '<li><strong>勾配ブースティング</strong>: 弱学習器を順次追加し、前のモデルの誤差を修正することで段階的に予測精度を向上</li>';
    html += '<li><strong>特徴量の重要度</strong>: 各特徴量が予測にどれだけ寄与しているかを計算し、予測に寄与する要因を分析</li>';
    html += '<li><strong>予測の実行</strong>: 最新データから各桁の値を予測し、0-9の範囲に丸めて3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * LightGBMの詳細を表示
 */
function renderLightGBMDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('lightgbm');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>トレンド分析</strong>: 移動平均（MA）、指数移動平均（EMA）として特徴量に使用</li>';
    html += '<li><strong>相関分析</strong>: RSI、MACDなどの技術指標として特徴量に使用</li>';
    html += '<li><strong>クラスタリング分析</strong>: パターンのグループ化情報を特徴量に使用</li>';
    html += '<li><strong>周波数解析</strong>: 周期性情報を特徴量に使用</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">LightGBM分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">LightGBMは、高速で効率的な勾配ブースティングモデルです。GOSSとEFB技術により、大規模データでも高速に学習し、高い予測精度を実現します。</p>';
    html += '</div>';
    
    // 特徴量の重要度を表示
    if (method.feature_importance && method.feature_importance.length > 0) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">特徴量の重要度（上位10件）</h5>';
        html += '<div class="space-y-2">';
        
        const importanceWithIndex = method.feature_importance.map((val, idx) => ({ idx, val }));
        importanceWithIndex.sort((a, b) => b.val - a.val);
        
        importanceWithIndex.slice(0, 10).forEach((item, rank) => {
            const percentage = (item.val * 100).toFixed(2);
            const maxImportance = importanceWithIndex[0].val;
            const widthPercent = (item.val / maxImportance * 100).toFixed(1);
            
            html += '<div class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">';
            html += `<span class="text-xs font-semibold text-gray-600 w-8">${rank + 1}位</span>`;
            html += '<div class="flex-1 bg-gray-200 rounded-full h-4 relative max-w-xs">';
            html += `<div class="bg-yellow-500 h-4 rounded-full" style="width: ${widthPercent}%"></div>`;
            html += '</div>';
            html += `<span class="text-xs font-semibold text-gray-700 w-16 text-right">${percentage}%</span>`;
            html += '</div>';
        });
        
        html += '</div>';
        html += '</div>';
    }
    
    // 予測の説明
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">予測プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>特徴量の準備</strong>: 全データから学習データを作成（過去最大100回の基本データ + 高度な特徴量: MA、EMA、RSI、MACDなど）</li>';
    html += '<li><strong>GOSS（勾配ベースサンプリング）</strong>: 勾配の大きいデータポイントを優先的に使用し、効率的にデータをサンプリング</li>';
    html += '<li><strong>モデルの学習</strong>: 各桁に対して個別にLightGBMモデルを学習（全データを使用、リーフワイズ成長）</li>';
    html += '<li><strong>EFB（排他的特徴量バンドリング）</strong>: 互いに排他的な特徴量を束ねることで、特徴量を最適化</li>';
    html += '<li><strong>予測の実行</strong>: 最新データから各桁の値を予測し、0-9の範囲に丸めて3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * ARIMAの詳細を表示
 */
function renderARIMADetail(method, analysis) {
    const trends = analysis.trends || {};
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('arima');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>トレンド分析</strong>: 時系列のトレンド情報をARIMAモデルに反映</li>';
    html += '<li><strong>自己相関</strong>: 過去の値との相関をAR項として使用</li>';
    html += '<li><strong>移動平均</strong>: 過去の誤差項をMA項として使用</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">ARIMA分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">ARIMA(2,1,2)モデルは、統計的に確立された時系列予測手法です。自己回帰（AR）、和分（I）、移動平均（MA）の3つの要素を組み合わせて予測を行います。</p>';
    html += '</div>';
    
    // ARIMAパラメータの説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">ARIMA(2,1,2)パラメータ</h5>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">';
    html += '<div class="bg-cyan-50 p-3 rounded-lg">';
    html += '<div class="font-semibold text-cyan-800 mb-1">AR項 (p=2)</div>';
    html += '<div class="text-gray-700">過去2回の値を使用</div>';
    html += '</div>';
    html += '<div class="bg-cyan-50 p-3 rounded-lg">';
    html += '<div class="font-semibold text-cyan-800 mb-1">I項 (d=1)</div>';
    html += '<div class="text-gray-700">1回の差分を適用</div>';
    html += '</div>';
    html += '<div class="bg-cyan-50 p-3 rounded-lg">';
    html += '<div class="font-semibold text-cyan-800 mb-1">MA項 (q=2)</div>';
    html += '<div class="text-gray-700">過去2回の誤差項を使用</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    // 予測の説明
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">予測プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>時系列データの取得</strong>: 全件の時系列データを各桁ごとに取得</li>';
    html += '<li><strong>ARIMA(2,1,2)モデルの適用</strong>: 各桁に対してARIMA(2,1,2)モデルを適用（AR項: 過去2回の値、I項: 1回の差分、MA項: 過去2回の誤差項）</li>';
    html += '<li><strong>モデルの学習</strong>: 全データを使用してARIMAモデルを学習</li>';
    html += '<li><strong>予測の実行</strong>: 学習したモデルから1ステップ先を予測（過去の値と誤差項を使用）</li>';
    html += '<li><strong>予測値の調整</strong>: 予測値を0-9の範囲に丸めて、3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * スタッキングの詳細を表示
 */
function renderStackingDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('stacking');
    
    // 使用している分析結果を表示
    html += '<div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">';
    html += '<h5 class="font-semibold text-blue-800 mb-2">📊 使用している分析結果</h5>';
    html += '<ul class="text-sm text-blue-700 space-y-1 list-disc list-inside">';
    html += '<li><strong>トレンド分析</strong>: 移動平均（MA）、指数移動平均（EMA）として特徴量に使用</li>';
    html += '<li><strong>相関分析</strong>: RSI、MACDなどの技術指標として特徴量に使用</li>';
    html += '<li><strong>クラスタリング分析</strong>: パターンのグループ化情報を特徴量に使用</li>';
    html += '<li><strong>周波数解析</strong>: 周期性情報を特徴量に使用</li>';
    html += '<li><strong>複数の機械学習モデル</strong>: ランダムフォレスト、XGBoost、LightGBMの予測を統合</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">スタッキング分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">スタッキングは、複数の異なる機械学習モデルの予測を、メタモデル（Ridge回帰）で統合するアンサンブル学習手法です。各ベースモデルの長所を活かし、より高い予測精度を実現します。</p>';
    html += '</div>';
    
    // ベースモデルの説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">ベースモデル</h5>';
    html += '<div class="space-y-2 text-sm">';
    html += '<div class="flex items-center gap-2 p-2 bg-gray-50 rounded">';
    html += '<span class="font-semibold text-gray-700">🌲 ランダムフォレスト</span>';
    html += '<span class="text-gray-600">- 複数の決定木を組み合わせたアンサンブル</span>';
    html += '</div>';
    html += '<div class="flex items-center gap-2 p-2 bg-gray-50 rounded">';
    html += '<span class="font-semibold text-gray-700">🚀 XGBoost</span>';
    html += '<span class="text-gray-600">- 勾配ブースティング（利用可能な場合）</span>';
    html += '</div>';
    html += '<div class="flex items-center gap-2 p-2 bg-gray-50 rounded">';
    html += '<span class="font-semibold text-gray-700">💡 LightGBM</span>';
    html += '<span class="text-gray-600">- 高速勾配ブースティング（利用可能な場合）</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    // メタモデルの説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">メタモデル</h5>';
    html += '<div class="bg-violet-50 p-3 rounded-lg">';
    html += '<div class="font-semibold text-violet-800 mb-1">🎯 Ridge回帰（RidgeCV）</div>';
    html += '<div class="text-sm text-gray-700">ベースモデルの予測結果を入力として受け取り、最終的な予測を行います。正則化により過学習を抑制します。</div>';
    html += '</div>';
    html += '</div>';
    
    // 予測の説明
    html += '<div class="bg-white rounded-lg p-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">予測プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>特徴量の準備</strong>: 全データから学習データを作成（過去最大100回の基本データ + 高度な特徴量: MA、EMA、RSI、MACDなど）</li>';
    html += '<li><strong>ベースモデルの学習</strong>: 3-foldクロスバリデーションを使用して、ランダムフォレスト、XGBoost、LightGBMを各桁ごとに学習（全データを使用）</li>';
    html += '<li><strong>ベースモデルの予測</strong>: 各ベースモデルが各桁の値を予測</li>';
    html += '<li><strong>メタモデルの学習</strong>: ベースモデルの予測結果を特徴量として、メタモデル（Ridge回帰）を学習</li>';
    html += '<li><strong>最終予測の生成</strong>: メタモデルが最適な組み合わせ方を学習し、最終的な予測を生成</li>';
    html += '<li><strong>予測値の調整</strong>: 予測値を0-9の範囲に丸めて、3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * HMM（隠れマルコフモデル）の詳細を表示
 */
function renderHMMDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('hmm');
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">隠れマルコフモデル（HMM）分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">隠れマルコフモデル（HMM）は、観測できない隠れた状態の遷移をモデル化する手法です。各桁の数字の背後にある「状態」を推定し、その状態遷移から次の数字を予測します。</p>';
    html += '</div>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>状態数の設定</strong>: 各桁に対して10個の隠れ状態を設定（GaussianHMM）</li>';
    html += '<li><strong>モデルの学習</strong>: 全履歴データから、各状態の遷移確率と観測確率を学習</li>';
    html += '<li><strong>状態の推定</strong>: 最新データから最も可能性の高い隠れ状態を推定</li>';
    html += '<li><strong>予測の実行</strong>: 推定された状態から、次の状態を予測し、その状態に対応する数字を予測</li>';
    html += '<li><strong>予測値の調整</strong>: 予測値を0-9の範囲に丸めて、3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * LSTM（長短期記憶）の詳細を表示
 */
function renderLSTMDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('lstm');
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">LSTM（長短期記憶）分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">LSTM（Long Short-Term Memory）は、長期の依存関係を学習できるリカレントニューラルネットワーク（RNN）の一種です。時系列データの複雑なパターンを学習し、高精度な予測を実現します。</p>';
    html += '</div>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>データの準備</strong>: 全履歴データを時系列として準備し、各桁ごとに正規化</li>';
    html += '<li><strong>LSTMモデルの構築</strong>: 2層のLSTM層とDropout層を含むニューラルネットワークを構築</li>';
    html += '<li><strong>モデルの学習</strong>: 全データを使用してLSTMモデルを学習（Adamオプティマイザーを使用）</li>';
    html += '<li><strong>予測の実行</strong>: 学習したモデルから、最新の時系列データから次の値を予測</li>';
    html += '<li><strong>予測値の調整</strong>: 予測値を0-9の範囲に丸めて、3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * コンフォーマル予測の詳細を表示
 */
function renderConformalDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('conformal');
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">コンフォーマル予測分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">コンフォーマル予測は、予測区間を統計的に保証する手法です。過去の予測誤差を分析し、指定した信頼水準（デフォルト90%）で予測値が含まれる区間を計算します。</p>';
    html += '</div>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>ベース予測の取得</strong>: スタッキングなどのベース予測手法から予測値を取得</li>';
    html += '<li><strong>過去の誤差の計算</strong>: 過去のデータから予測誤差を計算（簡易版：過去10回のデータを使用）</li>';
    html += '<li><strong>予測区間の計算</strong>: 誤差の分位数を使用して、指定した信頼水準での予測区間を計算</li>';
    html += '<li><strong>予測値の生成</strong>: ベース予測値と予測区間から、最終的な予測値を生成</li>';
    html += '<li><strong>統計的保証</strong>: 指定した信頼水準（デフォルト90%）で予測値が区間内に含まれることを保証</li>';
    html += '</ol>';
    html += '</div>';
    
    // 予測区間の表示
    if (method.prediction_interval) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">予測区間</h5>';
        html += '<div class="bg-lime-50 p-3 rounded-lg">';
        html += `<p class="text-sm text-gray-700 mb-2"><strong>信頼水準</strong>: ${(method.prediction_interval.confidence_level * 100).toFixed(0)}%</p>`;
        html += `<p class="text-sm text-gray-700 mb-1"><strong>下限</strong>: ${method.prediction_interval.lower}</p>`;
        html += `<p class="text-sm text-gray-700"><strong>上限</strong>: ${method.prediction_interval.upper}</p>`;
        html += '</div>';
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * カルマンフィルタの詳細を表示
 */
function renderKalmanDetail(method, analysis) {
    let html = '<div class="space-y-4">';
    
    // 利用データ数
    html += getMethodDataUsageBadgeHtml('kalman');
    
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">カルマンフィルタ分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">カルマンフィルタは、状態空間モデルに基づく時系列予測手法です。ノイズを含むデータから、真の状態を推定し、次の値を予測します。位置と速度の両方を考慮した2次元状態空間モデルを使用します。</p>';
    html += '</div>';
    
    // 分析過程の説明
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">分析プロセス</h5>';
    html += '<ol class="text-sm text-gray-600 space-y-2 list-decimal list-inside">';
    html += '<li><strong>状態空間モデルの設定</strong>: 各桁に対して2次元状態空間モデルを設定（位置と速度）</li>';
    html += '<li><strong>フィルタリング</strong>: 全履歴データに対してカルマンフィルタを適用し、各時点での状態を推定</li>';
    html += '<li><strong>予測の実行</strong>: 最新の状態から、次のステップの状態を予測</li>';
    html += '<li><strong>予測値の調整</strong>: 予測された位置（状態の1次元目）を0-9の範囲に丸めて、3桁の数字を生成</li>';
    html += '</ol>';
    html += '</div>';
    
    html += '</div>';
    return html;
}

/**
 * ウェーブレット解析の詳細を表示
 */
function renderWaveletDetail(waveletAnalysis, container) {
    if (!waveletAnalysis || Object.keys(waveletAnalysis).length === 0) {
        container.innerHTML = '<p class="text-gray-600">ウェーブレット解析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">ウェーブレット変換による時間-周波数解析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">ウェーブレット変換は、時間と周波数の両方の情報を保持した変換です。短期的な変動と長期的なトレンドを同時に分析できます。</p>';
    html += '</div>';
    
    for (const [pos, posData] of Object.entries(waveletAnalysis)) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
        html += `<div class="bg-white rounded-lg p-4 mb-4">`;
        html += `<h5 class="font-semibold text-gray-700 mb-3">${posName}</h5>`;
        html += `<div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">`;
        html += `<div><span class="text-gray-600">総レベル数:</span> <span class="font-bold">${posData.total_levels}</span></div>`;
        html += `<div><span class="text-gray-600">近似エネルギー:</span> <span class="font-bold">${posData.approximation_energy.toFixed(2)}</span></div>`;
        html += `<div><span class="text-gray-600">詳細エネルギー:</span> <span class="font-bold">${posData.detail_energy.toFixed(2)}</span></div>`;
        html += `</div>`;
        html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * PCA解析の詳細を表示
 */
function renderPCADetail(pcaAnalysis, container) {
    if (!pcaAnalysis) {
        container.innerHTML = '<p class="text-gray-600">PCA解析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">主成分分析（PCA）</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">主成分分析（PCA）は、多次元データを低次元に圧縮し、主要な変動要因を抽出する手法です。データの本質的な構造を理解できます。</p>';
    html += '</div>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<h5 class="font-semibold text-gray-700 mb-3">主成分統計</h5>';
    html += `<div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">`;
    html += `<div><span class="text-gray-600">主成分数:</span> <span class="font-bold">${pcaAnalysis.n_components}</span></div>`;
    html += `<div><span class="text-gray-600">累積寄与率:</span> <span class="font-bold">${(pcaAnalysis.cumulative_variance * 100).toFixed(1)}%</span></div>`;
    html += `</div>`;
    
    if (pcaAnalysis.explained_variance_ratio && pcaAnalysis.explained_variance_ratio.length > 0) {
        html += '<div class="space-y-2">';
        html += '<p class="text-sm font-semibold text-gray-700 mb-2">各主成分の寄与率:</p>';
        pcaAnalysis.explained_variance_ratio.forEach((ratio, idx) => {
            html += `<div class="flex items-center gap-3">`;
            html += `<span class="text-xs font-semibold text-gray-600 w-16">PC${idx + 1}</span>`;
            html += '<div class="flex-1 bg-gray-200 rounded-full h-4 relative">';
            html += `<div class="bg-blue-500 h-4 rounded-full" style="width: ${ratio * 100}%"></div>`;
            html += '</div>';
            html += `<span class="text-xs font-semibold text-gray-700 w-16 text-right">${(ratio * 100).toFixed(1)}%</span>`;
            html += '</div>';
        });
        html += '</div>';
    }
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * t-SNE解析の詳細を表示
 */
function renderTSNEDetail(tsneAnalysis, container) {
    if (!tsneAnalysis || !tsneAnalysis.transformed_data) {
        container.innerHTML = '<p class="text-gray-600">t-SNE解析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">t-SNEによる可視化</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">t-SNE（t-distributed Stochastic Neighbor Embedding）は、高次元データを2次元に可視化する手法です。パターンのクラスタリングを視覚的に理解できます。</p>';
    html += '</div>';
    
    if (tsneAnalysis.latest_point) {
        html += '<div class="bg-white rounded-lg p-4 mb-4">';
        html += '<h5 class="font-semibold text-gray-700 mb-3">最新データポイントの位置</h5>';
        html += `<div class="text-sm text-gray-700">`;
        html += `<p>X座標: <span class="font-bold">${tsneAnalysis.latest_point[0].toFixed(3)}</span></p>`;
        html += `<p>Y座標: <span class="font-bold">${tsneAnalysis.latest_point[1].toFixed(3)}</span></p>`;
        html += `</div>`;
        html += '</div>';
    }
    
    html += '<div class="bg-white rounded-lg p-4">';
    html += `<p class="text-sm text-gray-700">データポイント数: <span class="font-bold">${tsneAnalysis.transformed_data.length}</span></p>`;
    html += '<p class="text-xs text-gray-500 mt-2">※2次元空間での位置関係により、データの構造を視覚的に理解できます</p>';
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * 連続性分析の詳細を表示
 */
function renderContinuityDetail(continuityAnalysis, container) {
    if (!continuityAnalysis || Object.keys(continuityAnalysis).length === 0) {
        container.innerHTML = '<p class="text-gray-600">連続性分析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">連続性分析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">連続性分析は、同じ数字が連続して出る確率や、数字が交互に出るパターンを検出する手法です。連続出現パターンを発見できます。</p>';
    html += '</div>';
    
    for (const [pos, posData] of Object.entries(continuityAnalysis)) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
        html += `<div class="bg-white rounded-lg p-4 mb-4">`;
        html += `<h5 class="font-semibold text-gray-700 mb-3">${posName}</h5>`;
        
        html += `<div class="mb-3">`;
        html += `<p class="text-sm font-semibold text-gray-700 mb-2">連続出現回数:</p>`;
        if (posData.consecutive_counts && Object.keys(posData.consecutive_counts).length > 0) {
            html += `<ul class="text-sm text-gray-600 space-y-1">`;
            Object.entries(posData.consecutive_counts).slice(0, 5).forEach(([digit, count]) => {
                html += `<li>数字${digit}: ${count}回</li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p class="text-sm text-gray-500">連続出現なし</p>`;
        }
        html += `</div>`;
        
        html += `<div class="mb-3">`;
        html += `<p class="text-sm font-semibold text-gray-700 mb-2">交互出現パターン:</p>`;
        if (posData.alternating_patterns && Object.keys(posData.alternating_patterns).length > 0) {
            html += `<ul class="text-sm text-gray-600 space-y-1">`;
            Object.entries(posData.alternating_patterns).slice(0, 5).forEach(([pattern, count]) => {
                html += `<li>${pattern}: ${count}回</li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p class="text-sm text-gray-500">交互出現パターンなし</p>`;
        }
        html += `</div>`;
        
        html += `<div>`;
        html += `<p class="text-sm font-semibold text-gray-700 mb-2">最大連続出現回数:</p>`;
        html += `<ul class="text-sm text-gray-600 space-y-1">`;
        Object.entries(posData.max_consecutive).slice(0, 5).forEach(([digit, maxLength]) => {
            if (maxLength > 0) {
                html += `<li>数字${digit}: ${maxLength}回</li>`;
            }
        });
        html += `</ul>`;
        html += `</div>`;
        
        html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * 変化点検出の詳細を表示
 */
function renderChangePointsDetail(changePoints, container) {
    if (!changePoints || Object.keys(changePoints).length === 0) {
        container.innerHTML = '<p class="text-gray-600">変化点検出データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">変化点検出</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">変化点検出は、トレンドの変化点やレジーム変化を検出する手法です。PELTアルゴリズムを使用して、パターンが変わった時期を特定します。</p>';
    html += '</div>';
    
    for (const [pos, posData] of Object.entries(changePoints)) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
        html += `<div class="bg-white rounded-lg p-4 mb-4">`;
        html += `<h5 class="font-semibold text-gray-700 mb-3">${posName}</h5>`;
        html += `<div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-3">`;
        html += `<div><span class="text-gray-600">変化点数:</span> <span class="font-bold">${posData.n_change_points}</span></div>`;
        html += `<div><span class="text-gray-600">セグメント数:</span> <span class="font-bold">${posData.segments}</span></div>`;
        html += `</div>`;
        
        if (posData.change_dates && posData.change_dates.length > 0) {
            html += `<div class="mt-3">`;
            html += `<p class="text-sm font-semibold text-gray-700 mb-2">変化点の日付:</p>`;
            html += `<ul class="text-sm text-gray-600 space-y-1">`;
            posData.change_dates.slice(0, 10).forEach(date => {
                html += `<li>${date}</li>`;
            });
            html += `</ul>`;
            html += `</div>`;
        }
        html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * ネットワーク分析の詳細を表示
 */
function renderNetworkDetail(networkAnalysis, container) {
    if (!networkAnalysis || !networkAnalysis.network_stats) {
        container.innerHTML = '<p class="text-gray-600">ネットワーク分析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">ネットワーク分析（グラフ理論）</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">ネットワーク分析は、数字の遷移をグラフとして分析する手法です。数字間の関係性を視覚化し、中心性指標を計算します。</p>';
    html += '</div>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += `<div class="grid grid-cols-2 gap-4 text-sm mb-4">`;
    html += `<div><span class="text-gray-600">総ノード数:</span> <span class="font-bold">${networkAnalysis.overall_nodes}</span></div>`;
    html += `<div><span class="text-gray-600">総エッジ数:</span> <span class="font-bold">${networkAnalysis.overall_edges}</span></div>`;
    html += `</div>`;
    html += '</div>';
    
    for (const [pos, posStats] of Object.entries(networkAnalysis.network_stats)) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
        html += `<div class="bg-white rounded-lg p-4 mb-4">`;
        html += `<h5 class="font-semibold text-gray-700 mb-3">${posName}</h5>`;
        
        html += `<div class="grid grid-cols-2 gap-4 text-sm mb-3">`;
        html += `<div><span class="text-gray-600">ノード数:</span> <span class="font-bold">${posStats.total_nodes}</span></div>`;
        html += `<div><span class="text-gray-600">エッジ数:</span> <span class="font-bold">${posStats.total_edges}</span></div>`;
        html += `</div>`;
        
        if (posStats.top_transitions && posStats.top_transitions.length > 0) {
            html += `<div class="mt-3">`;
            html += `<p class="text-sm font-semibold text-gray-700 mb-2">最も頻繁な遷移（上位5件）:</p>`;
            html += `<ul class="text-sm text-gray-600 space-y-1">`;
            posStats.top_transitions.forEach(transition => {
                html += `<li>${transition.from} → ${transition.to}: ${transition.count}回</li>`;
            });
            html += `</ul>`;
            html += `</div>`;
        }
        html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * 遺伝的アルゴリズム最適化の詳細を表示
 */
function renderGeneticDetail(geneticOptimization, container) {
    if (!geneticOptimization) {
        container.innerHTML = '<p class="text-gray-600">遺伝的アルゴリズム最適化データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">遺伝的アルゴリズムによる最適化</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">遺伝的アルゴリズムは、生物の進化を模倣した最適化手法です。複雑な最適化問題を解くことができ、予測手法の重みを最適化します。</p>';
    html += '</div>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += `<div class="grid grid-cols-2 gap-4 text-sm mb-4">`;
    html += `<div><span class="text-gray-600">適合度:</span> <span class="font-bold">${geneticOptimization.fitness.toFixed(4)}</span></div>`;
    html += `</div>`;
    
    if (geneticOptimization.optimized_weights) {
        html += '<div class="mt-3">';
        html += '<p class="text-sm font-semibold text-gray-700 mb-2">最適化された重み:</p>';
        html += '<div class="space-y-2">';
        Object.entries(geneticOptimization.optimized_weights).forEach(([method, weight]) => {
            const methodNames = {
                'chaos': 'カオス理論',
                'markov': 'マルコフ連鎖',
                'bayesian': 'ベイズ統計',
                'periodicity': '周期性分析',
                'pattern': '頻出パターン分析',
                'random_forest': 'ランダムフォレスト',
                'xgboost': 'XGBoost',
                'lightgbm': 'LightGBM',
                'arima': 'ARIMA',
                'stacking': 'スタッキング'
            };
            const methodName = methodNames[method] || method;
            html += '<div class="flex items-center gap-3">';
            html += `<span class="text-xs text-gray-700 w-32">${methodName}</span>`;
            html += '<div class="flex-1 bg-gray-200 rounded-full h-4 relative">';
            html += `<div class="bg-green-500 h-4 rounded-full" style="width: ${weight * 100}%"></div>`;
            html += '</div>';
            html += `<span class="text-xs font-semibold text-gray-700 w-16 text-right">${(weight * 100).toFixed(1)}%</span>`;
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    }
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * 周波数解析の詳細を表示
 */
function renderFrequencyDetail(frequencyAnalysis, container) {
    if (!frequencyAnalysis) {
        container.innerHTML = '<p class="text-gray-600">周波数解析データがありません。</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    html += '<h4 class="font-bold text-lg text-gray-800 mb-3">フーリエ変換による周波数解析</h4>';
    
    html += '<div class="bg-white rounded-lg p-4 mb-4">';
    html += '<p class="text-sm text-gray-700 mb-3">フーリエ変換により、時系列データを周波数領域に変換し、隠れた周期性やサイクルを検出します。主要な周波数成分は、データに含まれる周期的なパターンを示します。</p>';
    html += '</div>';
    
    for (const [pos, posData] of Object.entries(frequencyAnalysis)) {
        const posName = {'hundred': '百の位', 'ten': '十の位', 'one': '一の位'}[pos] || pos;
        
        html += '<div class="bg-white rounded-lg p-4 mb-4 border-2 border-yellow-200">';
        html += `<h5 class="font-semibold text-gray-700 mb-3">${posName}</h5>`;
        
        if (posData.dominant_frequencies && posData.dominant_frequencies.length > 0) {
            html += '<div class="mb-3">';
            html += '<p class="text-xs font-semibold text-gray-600 mb-2">主要な周波数成分（上位5件）:</p>';
            html += '<div class="space-y-2">';
            
            posData.dominant_frequencies.forEach((freq, idx) => {
                html += '<div class="bg-yellow-50 rounded-lg p-2 border border-yellow-200">';
                html += `<p class="text-xs text-gray-700"><strong>${idx + 1}位:</strong> 周波数 ${freq.frequency.toFixed(6)}, パワー ${freq.power.toFixed(2)}`;
                if (freq.period > 0 && freq.period < 1000) {
                    html += `, 周期 ${freq.period.toFixed(1)}回`;
                }
                html += '</p>';
                html += '</div>';
            });
            
            html += '</div>';
            html += '</div>';
        }
        
        if (posData.max_power_period > 0 && posData.max_power_period < 1000) {
            html += '<div class="bg-yellow-100 rounded-lg p-3">';
            html += `<p class="text-sm text-gray-700"><strong>最大パワー周期:</strong> ${posData.max_power_period.toFixed(1)}回</p>`;
            html += `<p class="text-xs text-gray-600 mt-1">この周期が最も強い周期性を示しています。</p>`;
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * エラーを表示
 */
function showError(message) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('errorMessage').textContent = message;
}

