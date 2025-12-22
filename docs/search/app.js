/**
 * Numbers3 Search & Analysis Script Ver.2
 */

let allData = [];
let charts = {};
let currentMode = 'number'; // 'number' or 'date'
let currentFilteredIndices = []; // 現在表示中のデータのインデックスリスト

const PRIZE_STRAIGHT = 90000; // 概算
const PRIZE_BOX = 15000;      // 概算
const COST_PER_LINE = 200;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
        populateDateSelects();
        setupEventListeners();
    } catch (error) {
        console.error("Initialization failed:", error);
        alert("データの読み込みに失敗しました。");
    }
});

async function loadData() {
    const response = await fetch('../public/data.json?' + new Date().getTime());
    if (!response.ok) throw new Error('Data loading failed');
    allData = await response.json();
    console.log(`Loaded ${allData.length} records.`);
}

function populateDateSelects() {
    // 日付セレクトボックスの生成 (HTML側で静的に入れてない場合)
    // 今回はHTML側でmonthは入れたがdayは空だったのでここで埋める
    const daySelect = document.getElementById('searchDay');
    if (daySelect.options.length <= 1) { // 初期値のみなら
        for (let i = 1; i <= 31; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}日`;
            daySelect.appendChild(option);
        }
    }
}

function setupEventListeners() {
    // タブ切り替え
    document.getElementById('tabNumber').addEventListener('click', () => switchTab('number'));
    document.getElementById('tabDate').addEventListener('click', () => switchTab('date'));

    // 検索ボタン
    document.getElementById('searchBtn').addEventListener('click', performNumberSearch);
    document.getElementById('searchDateBtn').addEventListener('click', performDateSearch);

    // シミュレーション再計算
    document.getElementById('calcSimBtn').addEventListener('click', calculateSimulation);

    // CSVダウンロード
    document.getElementById('csvDownloadBtn').addEventListener('click', exportCSV);
}

function switchTab(mode) {
    currentMode = mode;
    const tabNum = document.getElementById('tabNumber');
    const tabDate = document.getElementById('tabDate');
    const formNum = document.getElementById('formNumber');
    const formDate = document.getElementById('formDate');
    const simSection = document.getElementById('simulationSection');

    if (mode === 'number') {
        tabNum.className = "flex-1 py-3 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 transition-colors";
        tabDate.className = "flex-1 py-3 text-center font-bold text-gray-400 hover:text-indigo-400 border-b-2 border-transparent hover:border-indigo-300 transition-colors";
        formNum.classList.remove('hidden');
        formDate.classList.add('hidden');
        simSection.classList.remove('hidden'); // 数字検索時はシミュレーション出す
    } else {
        tabNum.className = "flex-1 py-3 text-center font-bold text-gray-400 hover:text-indigo-400 border-b-2 border-transparent hover:border-indigo-300 transition-colors";
        tabDate.className = "flex-1 py-3 text-center font-bold text-orange-500 border-b-2 border-orange-500 transition-colors";
        formNum.classList.add('hidden');
        formDate.classList.remove('hidden');
        simSection.classList.add('hidden'); // 日付検索時は隠す (意味合いが薄いため)
    }
}

// ------ 数字で検索 ------
function performNumberSearch() {
    const h = document.getElementById('hundredSelect').value;
    const t = document.getElementById('tenSelect').value;
    const o = document.getElementById('oneSelect').value;
    const isBox = document.getElementById('boxSearch').checked;

    if (h === '' || t === '' || o === '') {
        alert("全ての位を選択してください。");
        return;
    }

    const targetNum = `${h}${t}${o}`;
    let hitIndices = [];

    if (isBox) {
        const targetDigits = [h, t, o].sort().join('');
        allData.forEach((item, index) => {
            const numStr = String(item.num).padStart(3, '0');
            const itemDigits = numStr.split('').sort().join('');
            if (targetDigits === itemDigits) {
                hitIndices.push(index);
            }
        });
    } else {
        allData.forEach((item, index) => {
            const numStr = String(item.num).padStart(3, '0');
            if (numStr === targetNum) {
                hitIndices.push(index);
            }
        });
    }

    currentFilteredIndices = hitIndices;
    renderResults(hitIndices);

    // シミュレーション実行 (数字選択時のみ)
    calculateSimulation();
}

// ------ 日付で検索 ------
function performDateSearch() {
    const m = document.getElementById('searchMonth').value;
    const d = document.getElementById('searchDay').value;

    if (m === '' || d === '') {
        alert("月と日を選択してください。");
        return;
    }

    let hitIndices = [];
    allData.forEach((item, index) => {
        const dateObj = new Date(item.date);
        // getMonthは0始まり
        if ((dateObj.getMonth() + 1) == m && dateObj.getDate() == d) {
            hitIndices.push(index);
        }
    });

    currentFilteredIndices = hitIndices;
    renderResults(hitIndices);
}

// ------ 共通描画 ------
function renderResults(indices) {
    const resultArea = document.getElementById('resultArea');
    resultArea.classList.remove('hidden');

    const count = indices.length;
    const total = allData.length;
    const rate = total > 0 ? (count / total * 100).toFixed(2) : "0.00";

    document.getElementById('hitCount').textContent = count;
    document.getElementById('hitRate').textContent = `${rate}%`;

    if (count === 0) {
        resetDisplays();
        return;
    }

    analyzeGaps(indices);
    analyzeNextDraw(indices);
    analyzeTimeDistribution(indices);
    renderHistoryTable(indices);
}

function resetDisplays() {
    // データなし時の表示リセット
    ['meanGap', 'minGap', 'maxGap', 'daysSinceLast', 'lastDate', 'evenRate', 'oddRate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    document.getElementById('nextNumRanking').innerHTML = '<div class="text-gray-500 text-sm">データがありません</div>';
    document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">該当データなし</td></tr>';

    // Sim
    document.getElementById('simTotalCost').textContent = '¥0';
    document.getElementById('simTotalWin').textContent = '¥0';
    document.getElementById('simRoi').textContent = '---%';
    document.getElementById('simBalance').textContent = '±0';

    clearCharts();
}

function clearCharts() {
    ['nextSumChart', 'weekdayChart', 'monthChart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (charts[id]) charts[id].destroy();
        charts[id] = null;
    });
}

// ------ 分析ロジック (既存改修) ------
function analyzeGaps(indices) {
    const lastIndex = indices[indices.length - 1];
    const totalRecords = allData.length;
    const daysSinceLast = (totalRecords - 1) - lastIndex;
    const lastDate = allData[lastIndex].date;

    let gaps = [];
    if (indices.length > 1) {
        for (let i = 0; i < indices.length - 1; i++) {
            gaps.push(indices[i + 1] - indices[i]);
        }
    }

    const meanGap = gaps.length > 0 ? (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1) : '-';
    const minGap = gaps.length > 0 ? Math.min(...gaps) : '-';
    const maxGap = gaps.length > 0 ? Math.max(...gaps) : '-';

    document.getElementById('meanGap').textContent = meanGap;
    document.getElementById('minGap').textContent = minGap;
    document.getElementById('maxGap').textContent = maxGap;
    document.getElementById('daysSinceLast').textContent = daysSinceLast;
    document.getElementById('lastDate').textContent = lastDate.split('T')[0];
}

function analyzeNextDraw(indices) {
    let nextDraws = [];
    indices.forEach(idx => {
        if (idx + 1 < allData.length) {
            nextDraws.push(allData[idx + 1]);
        }
    });

    if (nextDraws.length === 0) return;

    // TOP5
    let digitCounts = {};
    nextDraws.forEach(draw => {
        const numStr = String(draw.num).padStart(3, '0');
        numStr.split('').forEach(d => {
            digitCounts[d] = (digitCounts[d] || 0) + 1;
        });
    });

    const sortedDigits = Object.entries(digitCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const rankingContainer = document.getElementById('nextNumRanking');
    rankingContainer.innerHTML = '';

    sortedDigits.forEach(([digit, count], i) => {
        const percent = (count / (nextDraws.length * 3) * 100).toFixed(1);
        const barColor = i === 0 ? 'bg-indigo-500' : 'bg-gray-400';

        const row = document.createElement('div');
        row.className = 'flex items-center gap-3';
        row.innerHTML = `
            <div class="w-8 h-8 rounded-full ${i === 0 ? 'bg-yellow-400 text-white shadow-md' : 'bg-gray-200 text-gray-700'} flex items-center justify-center font-bold flex-shrink-0">
                ${digit}
            </div>
            <div class="flex-1">
                <div class="flex justify-between text-xs mb-1">
                    <span class="font-medium text-gray-700">${count}回出現</span>
                    <span class="text-gray-500">${percent}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="${barColor} h-2 rounded-full" style="width: ${percent * 3}%"></div>
                </div>
            </div>
        `;
        rankingContainer.appendChild(row);
    });

    // Sum Chart
    const sums = nextDraws.map(d => {
        const n = String(d.num).padStart(3, '0');
        return parseInt(n[0]) + parseInt(n[1]) + parseInt(n[2]);
    });
    const sumCounts = new Array(28).fill(0);
    sums.forEach(s => sumCounts[s]++);

    renderChart('nextSumChart', 'bar', {
        labels: sumCounts.map((_, i) => i),
        datasets: [{
            label: '次回合計値',
            data: sumCounts,
            backgroundColor: 'rgba(99, 102, 241, 0.5)',
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 1
        }]
    });

    // Even/Odd
    let evenCount = 0;
    nextDraws.forEach(d => {
        if (d.num % 2 === 0) evenCount++;
    });
    const oddCount = nextDraws.length - evenCount;

    document.getElementById('evenRate').textContent = `${(evenCount / nextDraws.length * 100).toFixed(0)}%`;
    document.getElementById('oddRate').textContent = `${(oddCount / nextDraws.length * 100).toFixed(0)}%`;
}

function analyzeTimeDistribution(indices) {
    const records = indices.map(i => allData[i]);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekdayCounts = new Array(7).fill(0);
    records.forEach(r => {
        const d = new Date(r.date);
        weekdayCounts[d.getDay()]++;
    });

    renderChart('weekdayChart', 'radar', {
        labels: weekdays,
        datasets: [{
            label: '曜日別頻度',
            data: weekdayCounts,
            backgroundColor: 'rgba(236, 72, 153, 0.2)',
            borderColor: 'rgb(236, 72, 153)',
            pointBackgroundColor: 'rgb(236, 72, 153)',
            borderWidth: 2,
            fill: true
        }]
    });

    const monthCounts = new Array(12).fill(0);
    records.forEach(r => {
        const d = new Date(r.date);
        monthCounts[d.getMonth()]++;
    });

    renderChart('monthChart', 'line', {
        labels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
        datasets: [{
            label: '月別頻度',
            data: monthCounts,
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
        }]
    }, {
        scales: {
            y: { beginAtZero: true }
        }
    });
}

function renderHistoryTable(indices) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    // Reverse for display
    const reversedIndices = [...indices].reverse();

    reversedIndices.forEach(idx => {
        const item = allData[idx];
        const date = new Date(item.date);
        const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

        const tr = document.createElement('tr');
        tr.className = "bg-white border-b hover:bg-gray-50 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${item.date}</td>
            <td class="px-6 py-4 text-gray-500">${weekday}</td>
            <td class="px-6 py-4 text-gray-500">第${item.issue || '-'}回</td>
            <td class="px-6 py-4 font-bold text-lg text-indigo-600 tracking-wider">${String(item.num).padStart(3, '0')}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderChart(canvasId, type, data, extraOptions = {}) {
    // 既存破棄
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        charts[canvasId] = null;
    }
    const cvs = document.getElementById(canvasId);
    if (!cvs) return;
    const ctx = cvs.getContext('2d');

    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            ...extraOptions
        }
    });
}

// ------ シミュレーション ------
function calculateSimulation() {
    if (currentMode !== 'number') return;
    if (currentFilteredIndices.length === 0) {
        // ヒットなしの場合はゼロ
        updateSimResults(0, allData.length);
        return;
    }

    const lines = parseInt(document.getElementById('simLines').value || 1);
    const isBox = document.getElementById('boxSearch').checked;

    const hitCount = currentFilteredIndices.length;
    const totalDraws = allData.length;
    const prize = isBox ? PRIZE_BOX : PRIZE_STRAIGHT;

    const totalCost = totalDraws * lines * COST_PER_LINE;
    const totalWin = hitCount * prize;
    const balance = totalWin - totalCost;
    const roi = totalCost > 0 ? (totalWin / totalCost * 100).toFixed(1) : 0;

    // 表示更新
    document.getElementById('simTotalCost').textContent = `¥${totalCost.toLocaleString()}`;
    document.getElementById('simTotalWin').textContent = `¥${totalWin.toLocaleString()}`;

    const roiEl = document.getElementById('simRoi');
    roiEl.textContent = `${roi}%`;
    roiEl.className = `text-3xl font-extrabold ${roi >= 100 ? 'text-red-500' : 'text-blue-500'}`;

    const balEl = document.getElementById('simBalance');
    balEl.textContent = `${balance > 0 ? '+' : ''}¥${balance.toLocaleString()}`;
    balEl.className = `text-sm font-bold mt-1 ${balance >= 0 ? 'text-red-500' : 'text-blue-500'}`;
}

function updateSimResults(win, total) {
    document.getElementById('simTotalCost').textContent = `¥${(total * 200).toLocaleString()}`; // 仮に1口
    document.getElementById('simTotalWin').textContent = '¥0';
    document.getElementById('simRoi').textContent = '0.0%';
    document.getElementById('simBalance').textContent = `-¥${(total * 200).toLocaleString()}`;
}

// ------ CSVエクスポート ------
function exportCSV() {
    if (currentFilteredIndices.length === 0) {
        alert("出力するデータがありません。");
        return;
    }

    // Header
    let csvContent = "日付,曜日,回号,当選番号\n";

    // Data (古い順か新しい順か... リスト表示に合わせて新しい順にする)
    const reversed = [...currentFilteredIndices].reverse();

    reversed.forEach(idx => {
        const item = allData[idx];
        const date = new Date(item.date);
        const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        const num = String(item.num).padStart(3, '0');
        const issue = item.issue || '';

        csvContent += `${item.date},${weekday},${issue},${num}\n`;
    });

    // Blob download
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" }); // BOM付き
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `numbers3_search_result_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
