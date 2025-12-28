/**
 * 勝敗履歴表示ロジック
 */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initHistory();
    } catch (error) {
        console.error('Initialization failed:', error);
        document.getElementById('loading').innerHTML = `
            <div class="text-red-500 font-bold p-4 glass-card rounded-xl">
                データの読み込みに失敗しました: ${error.message}
            </div>
        `;
    }
});

async function initHistory() {
    const historyResponse = await fetch('data/prediction_history.json');
    if (!historyResponse.ok) throw new Error('History list not found');
    const historyList = await historyResponse.json();

    // 1. 同日の重複を排除 (最新のみ残す)
    const uniqueHistory = [];
    const seenDates = new Set();
    for (const item of historyList) {
        if (!seenDates.has(item.date)) {
            uniqueHistory.push(item);
            seenDates.add(item.date);
        }
    }

    // 最新の30日分を対象にする
    const targetHistory = uniqueHistory.slice(0, 30);

    // 各予測の詳細データを取得
    const predictionDetails = await Promise.all(
        targetHistory.map(async (item) => {
            try {
                // 当選番号の特定: 
                // この予測日 (item.date) の結果は、historyList のどこかの statistics.last_date に記録されている
                const resultEntry = historyList.find(h => h.statistics.last_date === item.date);

                const res = await fetch(`data/${item.file}`);
                if (!res.ok) return null;
                return {
                    ...item,
                    data: await res.json(),
                    actualResult: resultEntry ? resultEntry.statistics.last_number : null
                };
            } catch (e) {
                return null;
            }
        })
    );

    renderHistory(predictionDetails);
}

function renderHistory(predictionDetails) {
    const tableBody = document.getElementById('historyTableBody');
    const loading = document.getElementById('loading');
    const container = document.getElementById('historyContainer');

    if (loading) loading.classList.add('hidden');
    if (container) container.classList.remove('hidden');
    if (tableBody) tableBody.innerHTML = ''; // クリア

    let totalChecked = 0;
    let setBoxHits = 0;
    let miniHits = 0;

    predictionDetails.forEach((entry) => {
        if (!entry || !entry.data) return;

        const actualResult = entry.actualResult;

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50/50 transition-colors border-b last:border-0';

        // 判定ロジック
        const setPredictions = entry.data.set_predictions || [];
        const miniPredictions = entry.data.mini_predictions || [];

        let judgementHtml = '<span class="text-gray-400">結果待ち</span>';
        let setHtml = setPredictions.map(p => `<span>${p.number}</span>`).join(', ');
        let miniHtml = miniPredictions.map(p => `<span>${p.number}</span>`).join(', ');

        if (actualResult) {
            totalChecked++;
            const { hitType } = checkHitLevel(actualResult, setPredictions, miniPredictions);

            if (hitType === 'set') {
                judgementHtml = '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold whitespace-nowrap">セット的中！</span>';
                setBoxHits++;
            } else if (hitType === 'box') {
                judgementHtml = '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold whitespace-nowrap">ボックス的中！</span>';
                setBoxHits++;
            } else if (hitType === 'mini') {
                judgementHtml = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold whitespace-nowrap">ミニ的中！</span>';
                miniHits++;
            } else {
                judgementHtml = '<span class="text-gray-400">残念</span>';
            }

            // 当選番号の装飾
            setHtml = highlightMatches(setPredictions, actualResult, 'set');
            miniHtml = highlightMatches(miniPredictions, actualResult.substring(1), 'mini');
        }

        if (tableBody) {
            row.innerHTML = `
                <td class="px-6 py-4 text-sm text-gray-600">
                    <div class="font-bold">${entry.date}</div>
                    <div class="text-xs opacity-60">予測時刻: ${entry.time}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-1">
                        ${renderNumbers(actualResult || '???')}
                    </div>
                    ${actualResult ? `<div class="text-[10px] text-gray-400 mt-1">${entry.date} の結果</div>` : ''}
                </td>
                <td class="px-6 py-4 text-sm">
                    <div class="flex flex-wrap gap-2">${setHtml}</div>
                </td>
                <td class="px-6 py-4 text-sm">
                    <div class="flex flex-wrap gap-2">${miniHtml}</div>
                </td>
                <td class="px-6 py-4">
                    ${judgementHtml}
                </td>
            `;
            tableBody.appendChild(row);
        }
    });

    // 統計更新
    const statTotal = document.getElementById('statTotal');
    const statHits = document.getElementById('statHits');
    const statMiniHits = document.getElementById('statMiniHits');

    if (statTotal) statTotal.textContent = totalChecked + '回';
    if (statHits) statHits.textContent = setBoxHits + '回';
    if (statMiniHits) statMiniHits.textContent = miniHits + '回';
}

function checkHitLevel(actual, setPreds, miniPreds) {
    // セット的中
    if (setPreds.some(p => p.number === actual)) return { hitType: 'set', hitValue: actual };

    // ボックス的中
    const sortedActual = actual.split('').sort().join('');
    const boxHit = setPreds.find(p => p.number.split('').sort().join('') === sortedActual);
    if (boxHit) return { hitType: 'box', hitValue: boxHit.number };

    // ミニ的中
    const actualMini = actual.substring(1); // 下2桁
    if (miniPreds.some(p => p.number === actualMini)) return { hitType: 'mini', hitValue: actualMini };

    return { hitType: 'none' };
}

function highlightMatches(preds, actual, type) {
    if (!actual || actual.includes('?')) {
        return preds.map(p => `<span class="px-2 py-1 bg-white border rounded text-gray-600">${p.number}</span>`).join('');
    }

    return preds.map(p => {
        let bgColor = 'bg-white';
        let textColor = 'text-gray-600';
        let borderColor = 'border-gray-200';

        if (type === 'set') {
            if (p.number === actual) {
                bgColor = 'bg-red-500';
                textColor = 'text-white';
                borderColor = 'border-red-600';
            } else if (p.number.split('').sort().join('') === actual.split('').sort().join('')) {
                bgColor = 'bg-amber-400';
                textColor = 'text-white';
                borderColor = 'border-amber-500';
            }
        } else if (type === 'mini') {
            if (p.number === actual) {
                bgColor = 'bg-green-500';
                textColor = 'text-white';
                borderColor = 'border-green-600';
            }
        }

        return `<span class="px-2 py-1 ${bgColor} ${textColor} border ${borderColor} rounded font-mono font-bold shadow-sm">${p.number}</span>`;
    }).join('');
}

function renderNumbers(numStr) {
    return numStr.split('').map(n =>
        `<span class="w-8 h-8 flex items-center justify-center bg-gray-800 text-white rounded-full font-bold text-sm shadow-inner">${n}</span>`
    ).join('');
}
