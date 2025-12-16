"""
ナンバーズ3予測分析スクリプト
GitHub Actionsで実行され、予測結果をJSONとして出力する
"""

import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import pandas as pd
import numpy as np
from scipy import stats
from scipy.optimize import minimize_scalar
from typing import Dict, List, Tuple, Optional
import requests
from bs4 import BeautifulSoup


def fetch_latest_result(timeout: int = 10, sleep_sec: float = 1.0) -> Optional[Dict[str, str]]:
    """
    ナンバーズ3の最新当選結果をWebから取得する
    
    Args:
        timeout: リクエストタイムアウト（秒）
        sleep_sec: リクエスト前の待機時間（秒）
    
    Returns:
        dict | None: {"date": "YYYY-MM-DD", "num": "191"} 形式の辞書、取得に失敗した場合は None
    """
    # 複数の情報源を試す（優先順位順）
    urls = [
        ("https://www.mizuhobank.co.jp/takarakuji/check/numbers/numbers3/index.html", "mizuhobank"),
        ("https://takarakuji.rakuten.co.jp/backnumber/numbers3/", "rakuten"),
    ]
    
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    }
    
    for url, site_type in urls:
        try:
            # マナーとして少し待機
            time.sleep(sleep_sec)
            
            print(f"[fetch_latest_result] アクセス中: {url}")
            resp = requests.get(url, headers=headers, timeout=timeout)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            result = None
            
            # みずほ銀行サイトの場合
            if site_type == "mizuhobank":
                print(f"[fetch_latest_result] みずほ銀行サイトを解析中...")
                # N3抽出ツール.jsのアプローチを参考: ページ全体のテキストから直接抽出
                page_text = soup.get_text()
                
                # パターン1: 「第XX回」...「YYYY/MM/DD」...「当せん番号/当選番号」...「3桁の数字」
                # または「第XX回」...「YYYY年MM月DD日」...「当せん番号/当選番号」...「3桁の数字」
                patterns = [
                    # パターン1: 「第XX回」...「YYYY/MM/DD」...「当せん番号/当選番号」...「3桁」
                    r"第(\d+)回[\s\S]*?(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                    # パターン2: 「第XX回」...「YYYY年MM月DD日」...「当せん番号/当選番号」...「3桁」
                    r"第(\d+)回[\s\S]*?(\d{4})年(\d{1,2})月(\d{1,2})日[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                    # パターン3: 「YYYY/MM/DD」...「当せん番号/当選番号」...「3桁」（回号なし）
                    r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                    # パターン4: 「YYYY年MM月DD日」...「当せん番号/当選番号」...「3桁」（回号なし）
                    r"(\d{4})年(\d{1,2})月(\d{1,2})日[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                ]
                
                for pattern_idx, pattern in enumerate(patterns, 1):
                    matches = list(re.finditer(pattern, page_text))
                    if matches:
                        # 最新のマッチ（最後に見つかったもの）を取得
                        latest_match = matches[-1]
                        groups = latest_match.groups()
                        
                        if len(groups) == 5:  # パターン1, 2（回号あり）
                            # groups[0] = 回号, groups[1-3] = 年月日, groups[4] = 当選番号
                            year, month, day = int(groups[1]), int(groups[2]), int(groups[3])
                            num_str = groups[4].zfill(3)
                        elif len(groups) == 4:  # パターン3, 4（回号なし）
                            # groups[0-2] = 年月日, groups[3] = 当選番号
                            year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                            num_str = groups[3].zfill(3)
                        else:
                            continue
                        
                        draw_date = datetime(year, month, day).strftime("%Y-%m-%d")
                        result = {"date": draw_date, "num": num_str}
                        print(f"[fetch_latest_result] パターン{pattern_idx}で取得成功: {draw_date} - {num_str}")
                        break
                
                # パターンマッチが失敗した場合、より柔軟な検索を試す
                if not result:
                    print(f"[fetch_latest_result] 標準パターンで見つかりませんでした。柔軟な検索を試します...")
                    
                    # 日付パターンを探す（最新のもの）
                    date_patterns = []
                    
                    # 「YYYY/MM/DD」形式
                    for match in re.finditer(r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})", page_text):
                        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                        date_patterns.append((match.start(), year, month, day))
                    
                    # 「YYYY年MM月DD日」形式
                    for match in re.finditer(r"(\d{4})年(\d{1,2})月(\d{1,2})日", page_text):
                        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                        date_patterns.append((match.start(), year, month, day))
                    
                    if date_patterns:
                        # 最新の日付を取得（最後に見つかったもの）
                        latest_date = date_patterns[-1]
                        year, month, day = latest_date[1], latest_date[2], latest_date[3]
                        draw_date = datetime(year, month, day).strftime("%Y-%m-%d")
                        
                        # その日付の近く（前後500文字）にある3桁の数字を探す
                        date_pos = latest_date[0]
                        nearby_text = page_text[max(0, date_pos-200):date_pos+500]
                        
                        # 3桁の数字を探す（連続した3桁、またはスペース区切りの3桁）
                        num_matches = list(re.finditer(r"(\d)\s*(\d)\s*(\d)", nearby_text))
                        if num_matches:
                            # 日付に最も近い3桁の数字を取得
                            num_match = num_matches[0]
                            num_str = "".join(num_match.groups()).zfill(3)
                            result = {"date": draw_date, "num": num_str}
                            print(f"[fetch_latest_result] 柔軟な検索で取得成功: {draw_date} - {num_str}")
            
            # 楽天宝くじの場合
            elif site_type == "rakuten":
                print(f"[fetch_latest_result] 楽天宝くじサイトを解析中...")
                # N3抽出ツール.jsのアプローチを参考: ページ全体のテキストから直接抽出
                page_text = soup.get_text()
                
                # パターン1: 「第XX回」...「YYYY/MM/DD」...「当せん番号/当選番号」...「3桁の数字」
                # または「第XX回」...「YYYY年MM月DD日」...「当せん番号/当選番号」...「3桁の数字」
                patterns = [
                    # パターン1: 「第XX回」...「YYYY/MM/DD」...「当せん番号/当選番号」...「3桁」
                    r"第(\d+)回[\s\S]*?(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                    # パターン2: 「第XX回」...「YYYY年MM月DD日」...「当せん番号/当選番号」...「3桁」
                    r"第(\d+)回[\s\S]*?(\d{4})年(\d{1,2})月(\d{1,2})日[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                    # パターン3: 「YYYY/MM/DD」...「当せん番号/当選番号」...「3桁」（回号なし）
                    r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                    # パターン4: 「YYYY年MM月DD日」...「当せん番号/当選番号」...「3桁」（回号なし）
                    r"(\d{4})年(\d{1,2})月(\d{1,2})日[\s\S]*?(?:当せん番号|当選番号)?[\s\S]*?(\d{3})",
                ]
                
                for pattern_idx, pattern in enumerate(patterns, 1):
                    matches = list(re.finditer(pattern, page_text))
                    if matches:
                        # 最新のマッチ（最後に見つかったもの）を取得
                        latest_match = matches[-1]
                        groups = latest_match.groups()
                        
                        if len(groups) == 5:  # パターン1, 2（回号あり）
                            # groups[0] = 回号, groups[1-3] = 年月日, groups[4] = 当選番号
                            year, month, day = int(groups[1]), int(groups[2]), int(groups[3])
                            num_str = groups[4].zfill(3)
                        elif len(groups) == 4:  # パターン3, 4（回号なし）
                            # groups[0-2] = 年月日, groups[3] = 当選番号
                            year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                            num_str = groups[3].zfill(3)
                        else:
                            continue
                        
                        draw_date = datetime(year, month, day).strftime("%Y-%m-%d")
                        result = {"date": draw_date, "num": num_str}
                        print(f"[fetch_latest_result] パターン{pattern_idx}で取得成功: {draw_date} - {num_str}")
                        break
                
                # パターンマッチが失敗した場合、より柔軟な検索を試す
                if not result:
                    print(f"[fetch_latest_result] 標準パターンで見つかりませんでした。柔軟な検索を試します...")
                    
                    # 日付パターンを探す（最新のもの）
                    date_patterns = []
                    
                    # 「YYYY/MM/DD」形式
                    for match in re.finditer(r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})", page_text):
                        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                        date_patterns.append((match.start(), year, month, day))
                    
                    # 「YYYY年MM月DD日」形式
                    for match in re.finditer(r"(\d{4})年(\d{1,2})月(\d{1,2})日", page_text):
                        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                        date_patterns.append((match.start(), year, month, day))
                    
                    if date_patterns:
                        # 最新の日付を取得（最後に見つかったもの）
                        latest_date = date_patterns[-1]
                        year, month, day = latest_date[1], latest_date[2], latest_date[3]
                        draw_date = datetime(year, month, day).strftime("%Y-%m-%d")
                        
                        # その日付の近く（前後500文字）にある3桁の数字を探す
                        date_pos = latest_date[0]
                        nearby_text = page_text[max(0, date_pos-200):date_pos+500]
                        
                        # 3桁の数字を探す（連続した3桁、またはスペース区切りの3桁）
                        num_matches = list(re.finditer(r"(\d)\s*(\d)\s*(\d)", nearby_text))
                        if num_matches:
                            # 日付に最も近い3桁の数字を取得
                            num_match = num_matches[0]
                            num_str = "".join(num_match.groups()).zfill(3)
                            result = {"date": draw_date, "num": num_str}
                            print(f"[fetch_latest_result] 柔軟な検索で取得成功: {draw_date} - {num_str}")
            
            # 結果が見つかった場合
            if result:
                # 日付の妥当性チェック（今日から過去60日以内に緩和）
                try:
                    date_obj = datetime.strptime(result["date"], "%Y-%m-%d")
                    now = datetime.now()
                    days_diff = (now - date_obj).days
                    print(f"[fetch_latest_result] {site_type} 日付チェック: {result['date']}, 今日: {now.strftime('%Y-%m-%d')}, 差分: {days_diff}日")
                    
                    if -1 <= days_diff <= 60:  # 未来1日まで許容（時差の可能性）
                        print(f"[fetch_latest_result] {site_type} から取得成功: {result['date']} - {result['num']}")
                        return result
                    else:
                        print(f"[fetch_latest_result] {site_type} の日付が範囲外です: {result['date']} (差分: {days_diff}日)")
                except Exception as e:
                    print(f"[fetch_latest_result] {site_type} の日付パースエラー: {e}")
                    import traceback
                    print(f"[fetch_latest_result] トレースバック: {traceback.format_exc()}")
            
        except Exception as e:
            print(f"[fetch_latest_result] {site_type} ({url}) からの取得に失敗: {e}")
            continue
    
    print("[fetch_latest_result] すべての情報源からの取得に失敗しました")
    return None


class NumbersAnalyzer:
    """ナンバーズ3のデータ分析と予測を行うクラス"""
    
    def __init__(self, data_path: str = None):
        """
        初期化
        
        Args:
            data_path: データファイルのパス（Noneの場合は自動検出）
        """
        if data_path is None:
            # パスを自動検出
            if os.path.exists("public/data.json"):
                self.data_path = "public/data.json"
            elif os.path.exists("../public/data.json"):
                self.data_path = "../public/data.json"
            else:
                raise FileNotFoundError("data.jsonが見つかりません")
        else:
            self.data_path = data_path
        
        self.data = None
        self.df = None
        self.load_data()
    
    def load_data(self):
        """データを読み込む"""
        with open(self.data_path, 'r', encoding='utf-8') as f:
            self.data = json.load(f)
        
        # DataFrameに変換
        records = []
        for item in self.data:
            num_str = str(item['num']).zfill(3)
            records.append({
                'date': item['date'],
                'num': int(item['num']),
                'hundred': int(num_str[0]),
                'ten': int(num_str[1]),
                'one': int(num_str[2])
            })
        
        self.df = pd.DataFrame(records)
        self.df['date'] = pd.to_datetime(self.df['date'])
        self.df = self.df.sort_values('date').reset_index(drop=True)
    
    def update_data(self) -> bool:
        """
        Webから最新データを取得してデータファイルを更新する
        
        Returns:
            bool: データが更新された場合 True、更新されなかった場合 False
        """
        print("[update_data] 最新の当選結果を取得中...")
        latest_result = fetch_latest_result()
        
        if latest_result is None:
            print("[update_data] 最新データの取得に失敗しました。既存データで分析を続行します。")
            return False
        
        # 重複チェック: 最新のデータが既に存在するか確認
        latest_date = latest_result['date']
        latest_num = latest_result['num']
        
        # 既存データに同じ日付と番号の組み合わせがあるかチェック
        existing_dates = {item['date'] for item in self.data}
        existing_records = {(item['date'], str(item['num']).zfill(3)) for item in self.data}
        
        if (latest_date, latest_num) in existing_records:
            print(f"[update_data] 最新データは既に存在します: {latest_date} - {latest_num}")
            return False
        
        # 新しいデータを追加（numは文字列として保存）
        new_record = {
            'date': latest_date,
            'num': latest_num  # 文字列として保存（既存データ形式に合わせる）
        }
        self.data.append(new_record)
        
        # 日付でソート
        self.data.sort(key=lambda x: x['date'])
        
        # ファイルに保存
        with open(self.data_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        
        print(f"[update_data] データを更新しました: {latest_date} - {latest_num}")
        
        # DataFrameを再読み込み
        self.load_data()
        
        return True
    
    def calculate_gap(self, window: int = 10) -> pd.Series:
        """
        Gap（前回との差）を計算
        
        Args:
            window: 計算に使用するウィンドウサイズ
        """
        gaps = []
        for pos in ['hundred', 'ten', 'one']:
            gap = self.df[pos].diff().abs()
            gaps.append(gap)
        return pd.concat(gaps, axis=0).mean()
    
    def calculate_sum(self) -> pd.Series:
        """Sum（3桁の合計）を計算"""
        return self.df['hundred'] + self.df['ten'] + self.df['one']
    
    def calculate_span(self) -> pd.Series:
        """Span（最大値と最小値の差）を計算"""
        digits = self.df[['hundred', 'ten', 'one']]
        return digits.max(axis=1) - digits.min(axis=1)
    
    def calculate_phase(self, digit_pos: int, time_index: int) -> float:
        """
        位相を逆算する
        
        Args:
            digit_pos: 桁の位置 (0=百, 1=十, 2=一)
            time_index: 時間インデックス
        """
        target = self.df.iloc[time_index][['hundred', 'ten', 'one']].values[digit_pos]
        
        def error_func(phase):
            prediction = int(np.floor(5 * np.sin(0.5 * time_index + phase) + 5) % 10)
            return abs(target - prediction)
        
        result = minimize_scalar(error_func, bounds=(0, 6.28), method='bounded')
        return result.x
    
    def get_recent_phases(self, window: int = 100) -> Dict[str, List[float]]:
        """
        直近の位相を取得
        
        Args:
            window: 取得するデータ数
        """
        recent_df = self.df.tail(window)
        phases = {'hundred': [], 'ten': [], 'one': []}
        
        for idx, row in recent_df.iterrows():
            time_idx = len(self.df) - len(recent_df) + (idx - recent_df.index[0])
            for i, pos in enumerate(['hundred', 'ten', 'one']):
                phase = self.calculate_phase(i, time_idx)
                phases[pos].append(phase)
        
        return phases
    
    def predict_chaos(self) -> Dict[str, any]:
        """
        カオス理論に基づく予測
        
        Returns:
            予測結果の辞書
        """
        recent_phases = self.get_recent_phases(20)
        
        # 位相のトレンドを分析
        predictions = {}
        for pos in ['hundred', 'ten', 'one']:
            phases = recent_phases[pos]
            if len(phases) < 2:
                predictions[pos] = np.random.randint(0, 10)
                continue
            
            # 線形回帰で次回の位相を予測
            x = np.arange(len(phases))
            slope, intercept = np.polyfit(x, phases, 1)
            next_phase = slope * len(phases) + intercept
            
            # 位相から数字を予測
            next_time = len(self.df)
            predicted = int(np.floor(5 * np.sin(0.5 * next_time + next_phase) + 5) % 10)
            predictions[pos] = predicted
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        return {
            'method': 'chaos',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': 0.65,
            'reason': '位相の線形トレンドから予測'
        }
    
    def predict_markov(self) -> Dict[str, any]:
        """
        マルコフ連鎖に基づく予測
        
        Returns:
            予測結果の辞書
        """
        # 遷移確率行列を構築
        transitions = {}
        for pos in ['hundred', 'ten', 'one']:
            transitions[pos] = np.zeros((10, 10))
            for i in range(1, len(self.df)):
                from_digit = self.df.iloc[i-1][pos]
                to_digit = self.df.iloc[i][pos]
                transitions[pos][int(from_digit), int(to_digit)] += 1
        
        # 正規化
        for pos in ['hundred', 'ten', 'one']:
            row_sums = transitions[pos].sum(axis=1)
            row_sums[row_sums == 0] = 1  # ゼロ除算を防ぐ
            transitions[pos] = transitions[pos] / row_sums[:, np.newaxis]
        
        # 最後の数字から予測
        predictions = {}
        for pos in ['hundred', 'ten', 'one']:
            last_digit = int(self.df.iloc[-1][pos])
            probs = transitions[pos][last_digit]
            predicted = np.argmax(probs)
            predictions[pos] = predicted
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        return {
            'method': 'markov',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': 0.70,
            'reason': 'マルコフ遷移確率から予測'
        }
    
    def predict_bayesian(self) -> Dict[str, any]:
        """
        ベイズ統計に基づく予測
        
        Returns:
            予測結果の辞書
        """
        # 各桁の出現頻度（事前分布）
        priors = {}
        for pos in ['hundred', 'ten', 'one']:
            priors[pos] = self.df[pos].value_counts(normalize=True).sort_index()
        
        # 直近20回の出現頻度（尤度）
        recent_df = self.df.tail(20)
        likelihoods = {}
        for pos in ['hundred', 'ten', 'one']:
            likelihoods[pos] = recent_df[pos].value_counts(normalize=True).sort_index()
        
        # ベイズ更新（簡易版）
        predictions = {}
        for pos in ['hundred', 'ten', 'one']:
            # 事前分布と尤度の重み付き平均
            prior = priors[pos].reindex(range(10), fill_value=0.1)
            likelihood = likelihoods[pos].reindex(range(10), fill_value=0.05)
            
            # 重み付き平均（最近のデータにより高い重み）
            posterior = 0.3 * prior + 0.7 * likelihood
            predicted = posterior.idxmax()
            predictions[pos] = predicted
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        return {
            'method': 'bayesian',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': 0.68,
            'reason': 'ベイズ統計による事後確率から予測'
        }
    
    def ensemble_predict(self) -> Dict[str, any]:
        """
        アンサンブル予測（複数手法の統合）
        
        Returns:
            統合予測結果
        """
        chaos_pred = self.predict_chaos()
        markov_pred = self.predict_markov()
        bayesian_pred = self.predict_bayesian()
        
        # 各手法の予測を集計
        set_votes = {}
        mini_votes = {}
        
        for pred in [chaos_pred, markov_pred, bayesian_pred]:
            set_num = pred['set_prediction']
            mini_num = pred['mini_prediction']
            confidence = pred['confidence']
            
            set_votes[set_num] = set_votes.get(set_num, 0) + confidence
            mini_votes[mini_num] = mini_votes.get(mini_num, 0) + confidence
        
        # 最も支持された予測を選択
        best_set = max(set_votes.items(), key=lambda x: x[1])
        best_mini = max(mini_votes.items(), key=lambda x: x[1])
        
        # トップ3のセット予測
        set_top3 = sorted(set_votes.items(), key=lambda x: x[1], reverse=True)[:3]
        mini_top3 = sorted(mini_votes.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # タイムスタンプはJST（Asia/Tokyo）で記録
        jst_now = datetime.now(ZoneInfo("Asia/Tokyo"))
        return {
            'timestamp': jst_now.isoformat(),
            'set_predictions': [
                {
                    'number': item[0],
                    'confidence': round(item[1] / 3, 3),
                    'rank': idx + 1
                }
                for idx, item in enumerate(set_top3)
            ],
            'mini_predictions': [
                {
                    'number': item[0],
                    'confidence': round(item[1] / 3, 3),
                    'rank': idx + 1
                }
                for idx, item in enumerate(mini_top3)
            ],
            'methods': {
                'chaos': chaos_pred,
                'markov': markov_pred,
                'bayesian': bayesian_pred
            },
            'recent_phases': self.get_recent_phases(20),
            'statistics': {
                'total_records': len(self.df),
                'last_date': self.df.iloc[-1]['date'].strftime('%Y-%m-%d'),
                'last_number': str(self.df.iloc[-1]['num']).zfill(3)
            }
        }
    
    def save_prediction(self, output_path: str = "docs/data/latest_prediction.json"):
        """
        予測結果をJSONファイルに保存
        
        Args:
            output_path: 出力ファイルのパス
        """
        prediction = self.ensemble_predict()
        
        # ディレクトリが存在しない場合は作成
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(prediction, f, ensure_ascii=False, indent=2)
        
        print(f"予測結果を {output_path} に保存しました")
        return prediction


def main():
    """メイン実行関数"""
    analyzer = NumbersAnalyzer()
    
    # 最新データを取得して更新
    data_updated = analyzer.update_data()
    
    if data_updated:
        print("[main] データが更新されました。予測分析を実行します。")
    else:
        print("[main] データは更新されませんでした。既存データで予測分析を実行します。")
    
    # 予測分析を実行
    prediction = analyzer.save_prediction()
    
    print("\n=== 予測結果 ===")
    print(f"セット予測（上位3件）:")
    for pred in prediction['set_predictions']:
        print(f"  {pred['rank']}. {pred['number']} (信頼度: {pred['confidence']:.3f})")
    
    print(f"\nミニ予測（上位3件）:")
    for pred in prediction['mini_predictions']:
        print(f"  {pred['rank']}. {pred['number']} (信頼度: {pred['confidence']:.3f})")
    
    # データ更新があった場合は、その情報も返す（GitHub Actionsで使用）
    return data_updated


if __name__ == "__main__":
    main()

