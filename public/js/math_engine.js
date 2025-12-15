/**
 * 簡易的な波動関数モデル:
 * y = round( Amplitude * sin( Frequency * t + Phase ) + Bias ) mod 10
 * * 逆算ロジック:
 * 実際の当選数字(target)が出たとき、それを満たす最適な Phase(位相) や Bias(偏り) を探索する。
 */

export class MathEngine {
    constructor(data) {
        this.data = data; // 過去データ配列
    }

    // 1つの位（例: 百の位）に対して、最適な「位相(Phase)」の推移を逆算する
    calculatePhaseTrend(digitType, windowSize = 30) {
        const history = [];
        
        // 直近 windowSize 回分を解析（デフォルト30）
        const recentData = this.data.slice(-windowSize);

        recentData.forEach((record, index) => {
            const time = index; // 簡易的な時間軸
            const target = parseInt(record.num[digitType]); // 0=百, 1=十, 2=一 の位

            // 逆算: その回の数字(target)を出すために最適だった Phase を総当たり探索
            // モデル仮定: y = floor( 5 * sin( 0.5 * t + Phase ) + 5 ) mod 10
            let bestPhase = 0;
            let minError = Infinity;

            for (let p = 0; p < 6.28; p += 0.1) { // 0 から 2π まで探索
                const prediction = Math.floor(5 * Math.sin(0.5 * time + p) + 5) % 10;
                const error = Math.abs(target - prediction);
                
                if (error < minError) {
                    minError = error;
                    bestPhase = p;
                }
            }
            history.push({
                date: record.date,
                actual: target,
                optimalPhase: parseFloat(bestPhase.toFixed(2)),
                timeIndex: time
            });
        });

        return history;
    }

    /**
     * 直近N回分について、「実際の数字」と「その回に最適化された方程式が出す数字」を並べて確認できるサマリを返す。
     * ユーザー自身の予想と見比べて、どのようなゆらぎ方程式になっているかを反芻しやすくする用途。
     */
    getRecentEquationSummary(digitType = 0, count = 10) {
        const trend = this.calculatePhaseTrend(digitType, count);
        return trend.map(entry => {
            const t = entry.timeIndex;
            // 解析に用いている簡易モデルと同じ式
            // y = floor( 5 * sin( 0.5 * t + Phase ) + 5 ) mod 10
            const modelValue = Math.floor(5 * Math.sin(0.5 * t + entry.optimalPhase) + 5) % 10;
            return {
                date: entry.date,
                actual: entry.actual,
                optimalPhase: entry.optimalPhase,
                modelValue
            };
        });
    }

    /**
     * 全データ（例: 約7000件）を統計的に要約した情報を返す。
     * - 各桁ごとの数字頻度
     * - 各桁ごとの「前回→今回」の遷移頻度（簡易マルコフ連鎖）
     * - 全体でよく出ている3桁コンボの上位
     * - 直近10回のフルナンバー
     */
    getGlobalStats() {
        const totalCount = this.data.length;

        // 各桁ごとの出現頻度: pos(0,1,2) -> 0-9 のカウント
        const digitFreqByPos = {
            0: Array(10).fill(0),
            1: Array(10).fill(0),
            2: Array(10).fill(0)
        };

        // 各桁ごとの遷移行列: pos -> from(0-9) -> to(0-9) のカウント
        const transitionMatrixByPos = {
            0: Array.from({ length: 10 }, () => Array(10).fill(0)),
            1: Array.from({ length: 10 }, () => Array(10).fill(0)),
            2: Array.from({ length: 10 }, () => Array(10).fill(0))
        };

        // 3桁コンビネーションの頻度
        const comboCounts = {};

        let prevDigits = null;

        this.data.forEach(record => {
            const numStr = String(record.num).padStart(3, '0');
            const digits = [
                parseInt(numStr[0], 10),
                parseInt(numStr[1], 10),
                parseInt(numStr[2], 10)
            ];

            // 頻度カウント
            digits.forEach((d, pos) => {
                if (!Number.isNaN(d) && d >= 0 && d <= 9) {
                    digitFreqByPos[pos][d] += 1;
                }
            });

            // 遷移カウント（前回 → 今回）
            if (prevDigits) {
                digits.forEach((d, pos) => {
                    const from = prevDigits[pos];
                    const to = d;
                    if (
                        !Number.isNaN(from) && from >= 0 && from <= 9 &&
                        !Number.isNaN(to) && to >= 0 && to <= 9
                    ) {
                        transitionMatrixByPos[pos][from][to] += 1;
                    }
                });
            }

            // 3桁コンボ
            comboCounts[numStr] = (comboCounts[numStr] || 0) + 1;

            prevDigits = digits;
        });

        // よく出ている3桁コンボ上位20件
        const topCombos = Object.entries(comboCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([num, count]) => ({ num, count }));

        // 直近10回のフルナンバー
        const last10Numbers = this.data.slice(-10).map(r => ({
            date: r.date,
            num: String(r.num).padStart(3, '0')
        }));

        return {
            totalCount,
            digitFreqByPos,
            transitionMatrixByPos,
            topCombos,
            last10Numbers
        };
    }
}