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

    // 最新の20件程度を対象にする（多すぎると負荷がかかるため）
    const targetHistory = historyList.slice(0, 30);

    // 各予測の詳細データを取得
    const predictionDetails = await Promise.all(
        targetHistory.map(async (item) => {
            try {
                const res = await fetch(`data/${item.file}`);
                if (!res.ok) return null;
                return { ...item, data: await res.json() };
            } catch (e) {
                return null;
            }
        })
    );

    renderHistory(predictionDetails, targetHistory);
}

function renderHistory(predictionDetails, rawHistory) {
    const tableBody = document.getElementById('historyTableBody');
    const loading = document.getElementById('loading');
    const container = document.getElementById('historyContainer');

    loading.classList.add('hidden');
    container.classList.remove('hidden');

    let totalChecked = 0;
    let setBoxHits = 0;
    let miniHits = 0;

    predictionDetails.forEach((entry, index) => {
        if (!entry || !entry.data) return;

        // 当選番号の特定: 
        // predictionDetails[index] が予測した回の結果は、その1つ前の履歴（index-1）の statistics.last_number にある
        // ただし、リストは降順（最新が0）なので、i番目の予測の結果は i-1 番目に記録されている。
        let actualResult = null;
        if (index > 0) {
            actualResult = predictionDetails[index - 1].statistics.last_number;
        }

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
            const { hitType, hitValue } = checkHitLevel(actualResult, setPredictions, miniPredictions);

            if (hitType === 'set') {
                judgementHtml = '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">セット的中！</span>';
                setBoxHits++;
            } else if (hitType === 'box') {
                judgementHtml = '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">ボックス的中！</span>';
                setBoxHits++;
            } else if (hitType === 'mini') {
                judgementHtml = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">ミニ的中！</span>';
                miniHits++;
            } else {
                judgementHtml = '<span class="text-gray-400">残念</span>';
            }

            // 当選番号の装飾
            setHtml = highlightMatches(setPredictions, actualResult, 'set');
            miniHtml = highlightMatches(miniPredictions, actualResult.substring(1), 'mini');
        }

        row.innerHTML = `
            <td class="px-6 py-4 text-sm text-gray-600">
                <div class="font-bold">${entry.date}</div>
                <div class="text-xs opacity-60">${entry.time}</div>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-1">
                    ${renderNumbers(actualResult || '???')}
                </div>
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
    });

    // 統計更新
    document.getElementById('statTotal').textContent = totalChecked + '回';
    document.getElementById('statHits').textContent = setBoxHits + '回';
    document.getElementById('statMiniHits').textContent = miniHits + '回';
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
        let isHit = false;
        let bgColor = 'bg-white';
        let textColor = 'text-gray-600';
        let borderColor = 'border-gray-200';

        if (type === 'set') {
            if (p.number === actual) {
                isHit = true;
                bgColor = 'bg-red-500';
                textColor = 'text-white';
                borderColor = 'border-red-600';
            } else if (p.number.split('').sort().join('') === actual.split('').sort().join('')) {
                isHit = true;
                bgColor = 'bg-amber-400';
                textColor = 'text-white';
                borderColor = 'border-amber-500';
            }
        } else if (type === 'mini') {
            if (p.number === actual) {
                isHit = true;
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
