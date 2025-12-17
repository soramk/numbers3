javascript:(function () {
  // ページ全文（URLエンコードされた文字列を含むテキスト）から
  // 「第XXXX回」「YYYY/MM/DD」「当せん番号 or 当選番号 3桁」を抽出して TSV 形式にする

  let text = document.body.innerText;
  let results = [];
  
  // パターン1: 第XX回 YYYY/MM/DD 当せん番号/当選番号 3桁
  let matches = text.matchAll(
    /第(\d+)回[\s\S]*?(\d{4}\/\d{2}\/\d{2})[\s\S]*?(?:当せん番号|当選番号)?\s*(\d{3})/g
  );
  
  for (const m of matches) {
    const no = m[1];
    const date = m[2];
    const num = m[3];
    results.push(no + '\t' + date + '\t' + num);
  }
  
  // パターン2: YYYY/MM/DD 当せん番号/当選番号 3桁（回号なし）
  let matches2 = text.matchAll(
    /(\d{4}\/\d{2}\/\d{2})[\s\S]*?(?:当せん番号|当選番号)?\s*(\d{3})/g
  );
  
  for (const m of matches2) {
    const date = m[1];
    const num = m[2];
    // パターン1で既に取得済みの場合はスキップ
    if (!results.some(r => r.includes(date) && r.includes(num))) {
      results.push('-\t' + date + '\t' + num);
    }
  }
  
  if (results.length > 0) {
    const output = '回号\t日付\t当選番号\n' + results.join('\n');
    console.log(output);
    
    // クリップボードにコピー（可能な場合）
    if (navigator.clipboard) {
      navigator.clipboard.writeText(output).then(() => {
        alert('抽出結果をクリップボードにコピーしました！\n\n' + results.length + '件のデータを取得しました。');
      }).catch(() => {
        alert('抽出結果:\n\n' + output);
      });
    } else {
      alert('抽出結果:\n\n' + output);
    }
  } else {
    alert('データが見つかりませんでした。');
  }
})();

