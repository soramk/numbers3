javascript:(function () {
  // ページ全文（URLエンコードされた文字列を含むテキスト）から
  // 「第XXXX回」「YYYY/MM/DD」「当せん番号 or 当選番号 3桁」を抽出して TSV 形式にする

  let text = document.body.innerText;
  let results = [];

  // URLエンコードされた日本語を対象にマッチ
  // 第(\d+)回 ... YYYY/MM/DD ... 当せん番号 or 当選番号 ... (\d{3})
  let matches = text.matchAll(
    /%E7%AC%AC(\d+)%E5%9B%9E[\s\S]*?(\d{4}\/\d{2}\/\d{2})[\s\S]*?(?:%E5%BD%93%E3%81%9B%E3%82%93%E7%95%AA%E5%8F%B7|%E5%BD%93%E9%81%B8%E7%95%AA%E5%8F%B7)?\s*(\d{3})/g
  );

  for (const m of matches) {
    const no = m[1];      // 回号
    const date = m[2];    // 日付 YYYY/MM/DD
    const num = m[3];     // 当選番号 3桁
    results.push(no + '\t' + date + '\t' + num);
  }

  if (results.length === 0) {
    alert('データが見つかりませんでした。');
  } else {
    const resText = results.join('\n');

    // クリップボードへコピー（モダンなブラウザ）
    navigator.clipboard.writeText(resText)
      .then(() => {
        alert(
          results.length +
            '件コピー完了！\nアプリに戻って貼り付けてください。'
        );
      })
      .catch(e => {
        // クリップボード API が使えない場合は prompt に表示
        prompt(
          'コピー失敗。以下をコピーしてください:',
          resText
        );
      });
  }
})();
