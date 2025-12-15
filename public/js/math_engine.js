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
}