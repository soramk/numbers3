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

/**
 * 翌営業日（次の抽選日）を計算する
 * ナンバーズ3は月～金に抽選があるため、土日は翌週月曜になる
 * @param {string} dateStr - YYYY-MM-DD形式の日付
 * @returns {string} 翌営業日のYYYY-MM-DD形式
 */
function getNextDrawDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00+09:00');
    // 翌日に進める
    date.setDate(date.getDate() + 1);

    // 土曜(6)の場合は月曜(翌々日)へ
    // 日曜(0)の場合は月曜(翌日)へ
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 6) { // 土曜
        date.setDate(date.getDate() + 2);
    } else if (dayOfWeek === 0) { // 日曜
        date.setDate(date.getDate() + 1);
    }

    // YYYY-MM-DD形式に戻す
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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
                // 予測時刻の判定: 当選発表は18:45頃なので、それ以前の予測はその日の結果を対象とする
                // それ以降の予測は翌営業日（次の抽選日）の結果を対象とする
                const predictionTime = item.time; // "HHMMSS" 形式
                const predictionHour = parseInt(predictionTime.substring(0, 2), 10);
                const predictionMinute = parseInt(predictionTime.substring(2, 4), 10);
                const isBeforeResult = (predictionHour < 18) || (predictionHour === 18 && predictionMinute < 45);

                // 対象となる結果日を決定
                let targetResultDate;
                if (isBeforeResult) {
                    // 当選発表前の予測 → その日の結果を対象とする
                    targetResultDate = item.date;
                } else {
                    // 当選発表後の予測 → 翌営業日の結果を対象とする
                    targetResultDate = getNextDrawDate(item.date);
                }

                // 当選番号の特定: targetResultDate の結果は、historyList のどこかの statistics.last_date に記録されている
                const resultEntry = historyList.find(h => h.statistics.last_date === targetResultDate);

                const res = await fetch(`data/${item.file}`);
                if (!res.ok) return null;
                return {
                    ...item,
                    data: await res.json(),
                    actualResult: resultEntry ? resultEntry.statistics.last_number : null,
                    targetDate: targetResultDate // 表示用に追加
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
        row.className = 'hover:bg-white/5 transition-colors border-b border-white/10 last:border-0';

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
                judgementHtml = '<span class="px-2 py-1 bg-red-500/20 text-red-100 border border-red-500/50 rounded-full text-xs font-bold whitespace-nowrap shadow-[0_0_10px_rgba(239,68,68,0.2)]">セット的中！</span>';
                setBoxHits++;
            } else if (hitType === 'box') {
                judgementHtml = '<span class="px-2 py-1 bg-amber-500/20 text-amber-100 border border-amber-500/50 rounded-full text-xs font-bold whitespace-nowrap shadow-[0_0_10px_rgba(245,158,11,0.2)]">ボックス的中！</span>';
                setBoxHits++;
            } else if (hitType === 'mini') {
                judgementHtml = '<span class="px-2 py-1 bg-green-500/20 text-green-100 border border-green-500/50 rounded-full text-xs font-bold whitespace-nowrap shadow-[0_0_10px_rgba(16,185,129,0.2)]">ミニ的中！</span>';
                miniHits++;
            } else {
                judgementHtml = '<span class="text-gray-500">残念</span>';
            }

            // 当選番号の装飾
            setHtml = highlightMatches(setPredictions, actualResult, 'set');
            miniHtml = highlightMatches(miniPredictions, actualResult.substring(1), 'mini');
        }

        if (tableBody) {
            row.innerHTML = `
                <td class="px-6 py-4 text-sm">
                    <div class="font-bold text-gray-100">${entry.date}</div>
                    <div class="text-xs text-gray-400 opacity-80">予測時刻: ${entry.time}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-1">
                        ${renderNumbers(actualResult || '???')}
                    </div>
                    ${actualResult ? `<div class="text-[10px] text-gray-400 mt-1">${entry.targetDate} の結果</div>` : ''}
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
        return preds.map(p => `<span class="px-2 py-1 bg-white/10 border border-white/20 rounded text-gray-200 font-mono">${p.number}</span>`).join('');
    }

    return preds.map(p => {
        let bgColor = 'bg-white/10';
        let textColor = 'text-gray-200';
        let borderColor = 'border-white/20';

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
        `<span class="w-8 h-8 flex items-center justify-center bg-gray-900 text-white border border-white/10 rounded-full font-bold text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">${n}</span>`
    ).join('');
}
