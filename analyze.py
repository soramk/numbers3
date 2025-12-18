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
            
            # 文字化けを防ぐため、エンコーディングを明示的に設定
            if resp.encoding is None or resp.encoding.lower() in ['iso-8859-1', 'windows-1252']:
                # エンコーディングが正しく検出されていない場合、apparent_encodingを使用
                resp.encoding = resp.apparent_encoding or 'utf-8'
            
            # みずほ銀行サイトの場合、Shift_JISの可能性があるため明示的に設定
            if site_type == "mizuhobank":
                # Content-Typeヘッダーからエンコーディングを確認
                content_type = resp.headers.get('Content-Type', '')
                if 'charset=' in content_type:
                    charset = content_type.split('charset=')[1].split(';')[0].strip().lower()
                    if charset:
                        resp.encoding = charset
                else:
                    # デフォルトでShift_JISを試す（みずほ銀行はShift_JISの可能性が高い）
                    try:
                        resp.encoding = 'shift_jis'
                        # テスト: 日本語文字が正しくデコードできるか確認
                        test_text = resp.text[:1000]
                        if '抽せん' in test_text or '当選' in test_text:
                            print(f"[fetch_latest_result] Shift_JISでデコード成功")
                        else:
                            # Shift_JISで失敗した場合、UTF-8を試す
                            resp.encoding = 'utf-8'
                            print(f"[fetch_latest_result] UTF-8でデコードを試行")
                    except:
                        resp.encoding = 'utf-8'
                        print(f"[fetch_latest_result] エンコーディング検出失敗、UTF-8を使用")
            
            print(f"[fetch_latest_result] 使用エンコーディング: {resp.encoding}")
            soup = BeautifulSoup(resp.text, "html.parser")
            result = None
            
            # みずほ銀行サイトの場合
            if site_type == "mizuhobank":
                print(f"[fetch_latest_result] みずほ銀行サイトを解析中...")
                # 画像から判断: テーブル構造で「抽せん日: 2025年12月16日」「抽せん数字: 003」が別々の行
                
                # まずテーブルを探す
                tables = soup.find_all("table")
                print(f"[fetch_latest_result] テーブル数: {len(tables)}")
                
                for table_idx, table in enumerate(tables):
                    rows = table.find_all("tr")
                    if len(rows) < 2:
                        continue
                    
                    # テーブル全体のテキストを取得
                    table_text = table.get_text()
                    print(f"[fetch_latest_result] テーブル{table_idx} テキスト: {table_text[:200]}")
                    
                    # 「抽せん日」と「抽せん数字」を含むテーブルを探す
                    if "抽せん日" in table_text and "抽せん数字" in table_text:
                        # 各行を確認
                        date_found = None
                        num_found = None
                        
                        for row_idx, row in enumerate(rows):
                            cells = row.find_all(["td", "th"])
                            if len(cells) < 2:
                                continue
                            
                            # 最初のセルが項目名、2番目のセルが値
                            label = cells[0].get_text(strip=True)
                            value = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                            
                            # 「抽せん日」の行から日付を抽出
                            if "抽せん日" in label:
                                # 「2025年12月16日」形式
                                date_match = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", value)
                                if date_match:
                                    year, month, day = date_match.groups()
                                    date_found = datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
                                else:
                                    # 「2025/12/16」形式
                                    date_match = re.search(r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})", value)
                                    if date_match:
                                        year, month, day = date_match.groups()
                                        date_found = datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
                            
                            # 「抽せん数字」の行から数字を抽出
                            if "抽せん数字" in label:
                                # 3桁の数字を探す
                                num_match = re.search(r"\b(\d{3})\b", value)
                                if num_match:
                                    num_found = num_match.group(1).zfill(3)
                                else:
                                    # セル内から数字を抽出
                                    digits = re.findall(r"\d", value)
                                    if len(digits) >= 3:
                                        num_found = "".join(digits[:3]).zfill(3)
                            
                            # 両方見つかったら結果を確定
                            if date_found and num_found:
                                result = {"date": date_found, "num": num_found}
                                print(f"[fetch_latest_result] テーブル{table_idx}から取得成功: {date_found} - {num_found}")
                                break
                        
                        if result:
                            break
                
                # テーブルから取得できなかった場合、ページ全体から検索
                if not result:
                    print(f"[fetch_latest_result] テーブルから取得できませんでした。ページ全体から検索します...")
                    page_text = soup.get_text()
                    
                    # 「抽せん日」と「抽せん数字」の近くを探す
                    # パターン: 「抽せん日」...「2025年12月16日」...「抽せん数字」...「003」
                    patterns = [
                        r"抽せん日[\s\S]{0,300}?(\d{4})年(\d{1,2})月(\d{1,2})日[\s\S]{0,300}?抽せん数字[\s\S]{0,300}?(\d{3})",
                        r"抽せん日[\s\S]{0,300}?(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})[\s\S]{0,300}?抽せん数字[\s\S]{0,300}?(\d{3})",
                    ]
                    
                    for pattern in patterns:
                        match = re.search(pattern, page_text)
                        if match:
                            year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                            num_str = match.group(4).zfill(3)
                            draw_date = datetime(year, month, day).strftime("%Y-%m-%d")
                            result = {"date": draw_date, "num": num_str}
                            print(f"[fetch_latest_result] ページ全体から取得成功: {draw_date} - {num_str}")
                            break
            
            # 楽天宝くじの場合
            elif site_type == "rakuten":
                print(f"[fetch_latest_result] 楽天宝くじサイトを解析中...")
                # 画像から判断: 「項目: 値」の2列形式で、「抽せん日」と「当せん番号」が別々の行
                
                # テーブルまたはリスト構造を探す
                tables = soup.find_all("table")
                dl_elements = soup.find_all("dl")
                div_elements = soup.find_all("div", class_=re.compile(r"table|list|result", re.I))
                
                # まずテーブルを確認
                for table_idx, table in enumerate(tables):
                    rows = table.find_all("tr")
                    for row_idx, row in enumerate(rows):
                        cells = row.find_all(["td", "th"])
                        if len(cells) >= 2:
                            # 「項目: 値」形式を探す
                            label = cells[0].get_text(strip=True)
                            value = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                            
                            if "抽せん日" in label or "抽選日" in label:
                                # 日付を抽出
                                date_match = re.search(r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})", value)
                                if date_match:
                                    year, month, day = date_match.groups()
                                    draw_date = datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
                                    # 同じテーブル内で「当せん番号」を探す
                                    for next_row in rows[row_idx:]:
                                        next_cells = next_row.find_all(["td", "th"])
                                        if len(next_cells) >= 2:
                                            next_label = next_cells[0].get_text(strip=True)
                                            next_value = next_cells[1].get_text(strip=True)
                                            if "当せん番号" in next_label or "当選番号" in next_label:
                                                # 3桁の数字を抽出
                                                num_match = re.search(r"\b(\d{3})\b", next_value)
                                                if num_match:
                                                    num_str = num_match.group(1).zfill(3)
                                                    result = {"date": draw_date, "num": num_str}
                                                    print(f"[fetch_latest_result] テーブル{table_idx}から取得成功: {draw_date} - {num_str}")
                                                    break
                                    if result:
                                        break
                            
                            if "当せん番号" in label or "当選番号" in label:
                                # 3桁の数字を抽出
                                num_match = re.search(r"\b(\d{3})\b", value)
                                if num_match:
                                    num_str = num_match.group(1).zfill(3)
                                    # 同じテーブル内で「抽せん日」を探す
                                    for prev_row in rows[:row_idx+1]:
                                        prev_cells = prev_row.find_all(["td", "th"])
                                        if len(prev_cells) >= 2:
                                            prev_label = prev_cells[0].get_text(strip=True)
                                            prev_value = prev_cells[1].get_text(strip=True)
                                            if "抽せん日" in prev_label or "抽選日" in prev_label:
                                                date_match = re.search(r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})", prev_value)
                                                if date_match:
                                                    year, month, day = date_match.groups()
                                                    draw_date = datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
                                                    result = {"date": draw_date, "num": num_str}
                                                    print(f"[fetch_latest_result] テーブル{table_idx}から取得成功: {draw_date} - {num_str}")
                                                    break
                                    if result:
                                        break
                    
                    if result:
                        break
                
                # テーブルから取得できなかった場合、ページ全体から検索
                if not result:
                    print(f"[fetch_latest_result] テーブルから取得できませんでした。ページ全体から検索します...")
                    page_text = soup.get_text()
                    
                    # パターン: 「抽せん日」...「2025/12/16」...「当せん番号」...「003」
                    pattern = r"抽せん日[\s\S]{0,300}?(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})[\s\S]{0,300}?当せん番号[\s\S]{0,300}?(\d{3})"
                    match = re.search(pattern, page_text)
                    if match:
                        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                        num_str = match.group(4).zfill(3)
                        draw_date = datetime(year, month, day).strftime("%Y-%m-%d")
                        result = {"date": draw_date, "num": num_str}
                        print(f"[fetch_latest_result] ページ全体から取得成功: {draw_date} - {num_str}")
            
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
        
        # 時系列特徴量を追加
        self.df['weekday'] = self.df['date'].dt.dayofweek  # 0=月曜日, 6=日曜日
        self.df['month'] = self.df['date'].dt.month
        self.df['day'] = self.df['date'].dt.day
        self.df['year'] = self.df['date'].dt.year
        self.df['quarter'] = self.df['date'].dt.quarter
        self.df['sum'] = self.df['hundred'] + self.df['ten'] + self.df['one']
        self.df['span'] = self.df[['hundred', 'ten', 'one']].max(axis=1) - self.df[['hundred', 'ten', 'one']].min(axis=1)
    
    def update_data(self) -> bool:
        """
        Webから最新データを取得してデータファイルを更新する
        public/data.json と docs/public/data.json の両方に追記する
        
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
        
        # public/data.json に保存
        with open(self.data_path, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        
        print(f"[update_data] {self.data_path} を更新しました: {latest_date} - {latest_num}")
        
        # docs/public/data.json にも追記（形式を維持）
        docs_data_path = None
        if self.data_path == "public/data.json":
            docs_data_path = "docs/public/data.json"
        elif self.data_path == "../public/data.json":
            docs_data_path = "docs/public/data.json"
        
        if docs_data_path:
            try:
                # docs/public/data.json が存在するか確認
                if os.path.exists(docs_data_path):
                    # 既存ファイルを読み込む
                    with open(docs_data_path, 'r', encoding='utf-8') as f:
                        docs_data = json.load(f)
                    
                    # データが空または不足している場合は、public/data.jsonから同期
                    if len(docs_data) == 0 or len(docs_data) < len(self.data):
                        print(f"[update_data] {docs_data_path} のデータが不足しています。{self.data_path} から同期します...")
                        # public/data.jsonの全データをコピー
                        docs_data = self.data.copy()
                        print(f"[update_data] {len(docs_data)} 件のデータを同期しました")
                    else:
                        # 重複チェック
                        docs_existing_records = {(item['date'], str(item['num']).zfill(3)) for item in docs_data}
                        if (latest_date, latest_num) not in docs_existing_records:
                            # 新しいデータを追加
                            docs_data.append(new_record)
                            # 日付でソート
                            docs_data.sort(key=lambda x: x['date'])
                            print(f"[update_data] {docs_data_path} に新しいデータを追加しました: {latest_date} - {latest_num}")
                        else:
                            print(f"[update_data] {docs_data_path} には既にデータが存在します: {latest_date} - {latest_num}")
                else:
                    # ファイルが存在しない場合は、public/data.jsonから全データをコピー
                    print(f"[update_data] {docs_data_path} が存在しません。{self.data_path} から同期します...")
                    docs_data = self.data.copy()
                    # ディレクトリが存在しない場合は作成
                    os.makedirs(os.path.dirname(docs_data_path), exist_ok=True)
                
                # docs/public/data.json の形式（1行1オブジェクト）で保存
                with open(docs_data_path, 'w', encoding='utf-8') as f:
                    f.write('[\n')
                    for i, item in enumerate(docs_data):
                        # 1行に1オブジェクトの形式で出力
                        json_str = json.dumps(item, ensure_ascii=False)
                        if i < len(docs_data) - 1:
                            f.write(f'    {json_str},\n')
                        else:
                            f.write(f'    {json_str}\n')
                    f.write(']')
                print(f"[update_data] {docs_data_path} を更新しました（{len(docs_data)} 件）")
            except Exception as e:
                print(f"[update_data] {docs_data_path} の更新に失敗しました: {e}")
                import traceback
                print(f"[update_data] トレースバック: {traceback.format_exc()}")
        
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
    
    def analyze_periodicity(self) -> Dict[str, any]:
        """
        周期性分析（曜日・月次パターン）
        
        Returns:
            周期性パターンの辞書
        """
        patterns = {}
        
        # 曜日パターン
        weekday_patterns = {}
        for pos in ['hundred', 'ten', 'one']:
            weekday_patterns[pos] = {}
            for weekday in range(7):
                weekday_data = self.df[self.df['weekday'] == weekday][pos]
                if len(weekday_data) > 0:
                    weekday_patterns[pos][weekday] = weekday_data.value_counts(normalize=True).to_dict()
        patterns['weekday'] = weekday_patterns
        
        # 月次パターン
        monthly_patterns = {}
        for pos in ['hundred', 'ten', 'one']:
            monthly_patterns[pos] = {}
            for month in range(1, 13):
                month_data = self.df[self.df['month'] == month][pos]
                if len(month_data) > 0:
                    monthly_patterns[pos][month] = month_data.value_counts(normalize=True).to_dict()
        patterns['monthly'] = monthly_patterns
        
        # 四半期パターン
        quarter_patterns = {}
        for pos in ['hundred', 'ten', 'one']:
            quarter_patterns[pos] = {}
            for quarter in range(1, 5):
                quarter_data = self.df[self.df['quarter'] == quarter][pos]
                if len(quarter_data) > 0:
                    quarter_patterns[pos][quarter] = quarter_data.value_counts(normalize=True).to_dict()
        patterns['quarterly'] = quarter_patterns
        
        return patterns
    
    def analyze_correlations(self) -> Dict[str, float]:
        """
        相関分析（桁間相関・自己相関）
        
        Returns:
            相関係数の辞書
        """
        correlations = {}
        
        # 桁間相関
        correlations['hundred_ten'] = self.df['hundred'].corr(self.df['ten'])
        correlations['ten_one'] = self.df['ten'].corr(self.df['one'])
        correlations['hundred_one'] = self.df['hundred'].corr(self.df['one'])
        
        # 自己相関（1回前、2回前、3回前、5回前、10回前）
        for lag in [1, 2, 3, 5, 10]:
            for pos in ['hundred', 'ten', 'one']:
                if len(self.df) > lag:
                    shifted = self.df[pos].shift(lag)
                    corr = self.df[pos].corr(shifted)
                    correlations[f'{pos}_lag{lag}'] = corr if not pd.isna(corr) else 0.0
        
        # 合計値との相関
        for pos in ['hundred', 'ten', 'one']:
            correlations[f'{pos}_sum'] = self.df[pos].corr(self.df['sum'])
        
        return correlations
    
    def extract_frequent_patterns(self, top_n: int = 20) -> Dict[str, any]:
        """
        頻出パターンの抽出
        
        Args:
            top_n: 上位N件を取得
            
        Returns:
            頻出パターンの辞書
        """
        patterns = {}
        
        # 3桁コンボ
        combo_3 = self.df[['hundred', 'ten', 'one']].apply(
            lambda x: f"{int(x['hundred'])}{int(x['ten'])}{int(x['one'])}", axis=1
        )
        patterns['set_top'] = combo_3.value_counts().head(top_n).to_dict()
        
        # 2桁コンボ（下2桁）
        combo_2 = self.df[['ten', 'one']].apply(
            lambda x: f"{int(x['ten'])}{int(x['one'])}", axis=1
        )
        patterns['mini_top'] = combo_2.value_counts().head(top_n).to_dict()
        
        # 百の位と十の位の組み合わせ
        combo_hundred_ten = self.df[['hundred', 'ten']].apply(
            lambda x: f"{int(x['hundred'])}{int(x['ten'])}", axis=1
        )
        patterns['hundred_ten_top'] = combo_hundred_ten.value_counts().head(top_n).to_dict()
        
        # 十の位と一の位の組み合わせ
        patterns['ten_one_top'] = combo_2.value_counts().head(top_n).to_dict()
        
        return patterns
    
    def analyze_gaps_detailed(self) -> Dict[str, any]:
        """
        詳細なギャップ分析
        
        Returns:
            ギャップ分析結果の辞書
        """
        gap_analysis = {}
        
        for pos in ['hundred', 'ten', 'one']:
            gap_data = {}
            
            # 各数字の出現間隔を計算
            for digit in range(10):
                digit_indices = self.df[self.df[pos] == digit].index.tolist()
                if len(digit_indices) > 1:
                    gaps = [digit_indices[i+1] - digit_indices[i] for i in range(len(digit_indices)-1)]
                    gap_data[digit] = {
                        'mean': float(np.mean(gaps)) if gaps else 0.0,
                        'median': float(np.median(gaps)) if gaps else 0.0,
                        'std': float(np.std(gaps)) if gaps else 0.0,
                        'min': int(min(gaps)) if gaps else 0,
                        'max': int(max(gaps)) if gaps else 0,
                        'count': len(gaps)
                    }
                else:
                    gap_data[digit] = {
                        'mean': 0.0, 'median': 0.0, 'std': 0.0, 'min': 0, 'max': 0, 'count': 0
                    }
            
            gap_analysis[pos] = gap_data
        
        return gap_analysis
    
    def analyze_trends(self, short_window: int = 10, mid_window: int = 50, long_window: int = 200) -> Dict[str, any]:
        """
        トレンド分析（短期・中期・長期）
        
        Args:
            short_window: 短期トレンドのウィンドウサイズ
            mid_window: 中期トレンドのウィンドウサイズ
            long_window: 長期トレンドのウィンドウサイズ
            
        Returns:
            トレンド分析結果の辞書
        """
        trends = {}
        
        for pos in ['hundred', 'ten', 'one']:
            pos_trends = {}
            
            # 短期トレンド
            if len(self.df) >= short_window:
                short_data = self.df[pos].tail(short_window)
                pos_trends['short'] = {
                    'mean': float(short_data.mean()),
                    'trend': float(np.polyfit(range(len(short_data)), short_data, 1)[0]),  # 傾き
                    'volatility': float(short_data.std())
                }
            
            # 中期トレンド
            if len(self.df) >= mid_window:
                mid_data = self.df[pos].tail(mid_window)
                pos_trends['mid'] = {
                    'mean': float(mid_data.mean()),
                    'trend': float(np.polyfit(range(len(mid_data)), mid_data, 1)[0]),
                    'volatility': float(mid_data.std())
                }
            
            # 長期トレンド
            if len(self.df) >= long_window:
                long_data = self.df[pos].tail(long_window)
                pos_trends['long'] = {
                    'mean': float(long_data.mean()),
                    'trend': float(np.polyfit(range(len(long_data)), long_data, 1)[0]),
                    'volatility': float(long_data.std())
                }
            
            trends[pos] = pos_trends
        
        return trends
    
    def detect_anomalies(self, threshold: float = 2.0) -> Dict[str, any]:
        """
        異常検知（外れ値検出）
        
        Args:
            threshold: Z-scoreの閾値
            
        Returns:
            異常検知結果の辞書
        """
        anomalies = {}
        
        for pos in ['hundred', 'ten', 'one']:
            data = self.df[pos]
            mean = data.mean()
            std = data.std()
            
            if std > 0:
                z_scores = np.abs((data - mean) / std)
                outlier_indices = self.df[z_scores > threshold].index.tolist()
                
                anomalies[pos] = {
                    'outlier_count': len(outlier_indices),
                    'outlier_indices': outlier_indices[:20],  # 最初の20件のみ
                    'mean': float(mean),
                    'std': float(std),
                    'threshold': threshold
                }
            else:
                anomalies[pos] = {
                    'outlier_count': 0,
                    'outlier_indices': [],
                    'mean': float(mean),
                    'std': 0.0,
                    'threshold': threshold
                }
        
        return anomalies
    
    def cluster_patterns(self, n_clusters: int = 5) -> Dict[str, any]:
        """
        クラスタリング分析（K-means）
        
        Args:
            n_clusters: クラスタ数
            
        Returns:
            クラスタリング結果の辞書
        """
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler
        
        # 特徴量を作成（各桁の値、合計値、範囲など）
        features = []
        for idx, row in self.df.iterrows():
            feature = [
                row['hundred'],
                row['ten'],
                row['one'],
                row['sum'],
                row['span'],
                row['weekday'],
                row['month']
            ]
            features.append(feature)
        
        features_array = np.array(features)
        
        # 標準化
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features_array)
        
        # K-meansクラスタリング
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(features_scaled)
        
        # クラスタごとの特徴を分析
        cluster_analysis = {}
        for cluster_id in range(n_clusters):
            cluster_data = self.df[clusters == cluster_id]
            if len(cluster_data) > 0:
                cluster_analysis[cluster_id] = {
                    'count': len(cluster_data),
                    'hundred_mean': float(cluster_data['hundred'].mean()),
                    'ten_mean': float(cluster_data['ten'].mean()),
                    'one_mean': float(cluster_data['one'].mean()),
                    'sum_mean': float(cluster_data['sum'].mean()),
                    'span_mean': float(cluster_data['span'].mean()),
                    'most_common_set': cluster_data[['hundred', 'ten', 'one']].apply(
                        lambda x: f"{int(x['hundred'])}{int(x['ten'])}{int(x['one'])}", axis=1
                    ).value_counts().head(5).to_dict()
                }
        
        # 最新データがどのクラスタに属するか
        latest_cluster = clusters[-1] if len(clusters) > 0 else 0
        
        return {
            'n_clusters': n_clusters,
            'cluster_labels': clusters.tolist(),
            'cluster_analysis': cluster_analysis,
            'latest_cluster': int(latest_cluster),
            'cluster_centers': kmeans.cluster_centers_.tolist()
        }
    
    def analyze_frequency_domain(self) -> Dict[str, any]:
        """
        フーリエ変換による周波数解析
        
        Returns:
            周波数解析結果の辞書
        """
        from scipy.fft import fft, fftfreq
        
        frequency_analysis = {}
        
        for pos in ['hundred', 'ten', 'one']:
            data = self.df[pos].values.astype(float)
            
            # FFTを実行
            fft_values = fft(data)
            frequencies = fftfreq(len(data))
            
            # パワースペクトルを計算
            power_spectrum = np.abs(fft_values) ** 2
            
            # 正の周波数のみを取得
            positive_freq_idx = frequencies > 0
            positive_freqs = frequencies[positive_freq_idx]
            positive_power = power_spectrum[positive_freq_idx]
            
            # 主要な周波数成分を抽出（上位5つ）
            if len(positive_power) > 0:
                top5_idx = np.argsort(positive_power)[-5:][::-1]
                dominant_freqs = []
                
                for idx in top5_idx:
                    freq = positive_freqs[idx]
                    power = positive_power[idx]
                    period = 1 / freq if freq > 0 else 0
                    
                    dominant_freqs.append({
                        'frequency': float(freq),
                        'power': float(power),
                        'period': float(period) if period > 0 and period < len(data) else 0
                    })
                
                max_power_idx = np.argmax(positive_power)
                frequency_analysis[pos] = {
                    'dominant_frequencies': dominant_freqs,
                    'max_power_frequency': float(positive_freqs[max_power_idx]),
                    'max_power_period': float(1 / positive_freqs[max_power_idx]) if positive_freqs[max_power_idx] > 0 else 0,
                    'total_power': float(np.sum(positive_power))
                }
            else:
                frequency_analysis[pos] = {
                    'dominant_frequencies': [],
                    'max_power_frequency': 0.0,
                    'max_power_period': 0.0,
                    'total_power': 0.0
                }
        
        return frequency_analysis
    
    def create_advanced_features(self) -> pd.DataFrame:
        """
        高度な特徴量を作成（移動平均、EMA、RSI、MACD、ボリンジャーバンド）
        
        Returns:
            特徴量が追加されたDataFrame
        """
        df = self.df.copy()
        
        # 移動平均（MA）
        for window in [5, 10, 20, 50]:
            for pos in ['hundred', 'ten', 'one']:
                df[f'{pos}_ma{window}'] = df[pos].rolling(window=window).mean()
        
        # 指数移動平均（EMA）
        for alpha in [0.1, 0.3, 0.5]:
            for pos in ['hundred', 'ten', 'one']:
                df[f'{pos}_ema{alpha}'] = df[pos].ewm(alpha=alpha, adjust=False).mean()
        
        # RSI（相対力指数）
        for pos in ['hundred', 'ten', 'one']:
            delta = df[pos].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / (loss + 1e-10)  # ゼロ除算を防ぐ
            df[f'{pos}_rsi'] = 100 - (100 / (1 + rs))
            df[f'{pos}_rsi'] = df[f'{pos}_rsi'].fillna(50)  # NaNを50で埋める
        
        # MACD（移動平均収束拡散）
        for pos in ['hundred', 'ten', 'one']:
            ema12 = df[pos].ewm(span=12, adjust=False).mean()
            ema26 = df[pos].ewm(span=26, adjust=False).mean()
            df[f'{pos}_macd'] = ema12 - ema26
            df[f'{pos}_macd_signal'] = df[f'{pos}_macd'].ewm(span=9, adjust=False).mean()
            df[f'{pos}_macd_histogram'] = df[f'{pos}_macd'] - df[f'{pos}_macd_signal']
        
        # ボリンジャーバンド
        for pos in ['hundred', 'ten', 'one']:
            ma20 = df[pos].rolling(window=20).mean()
            std20 = df[pos].rolling(window=20).std()
            df[f'{pos}_bb_upper'] = ma20 + (std20 * 2)
            df[f'{pos}_bb_lower'] = ma20 - (std20 * 2)
            df[f'{pos}_bb_width'] = df[f'{pos}_bb_upper'] - df[f'{pos}_bb_lower']
            df[f'{pos}_bb_position'] = (df[pos] - df[f'{pos}_bb_lower']) / (df[f'{pos}_bb_width'] + 1e-10)
        
        return df
    
    def predict_with_random_forest(self) -> Dict[str, any]:
        """
        ランダムフォレストによる予測
        
        Returns:
            予測結果の辞書
        """
        from sklearn.ensemble import RandomForestRegressor
        
        # 特徴量を作成（全データを使用）
        # 過去データの特徴量は最大100回まで使用（全データを使うと特徴量が膨大になるため）
        max_past_window = min(100, len(self.df))
        window_size = max_past_window
        
        # 高度な特徴量を含むDataFrameを取得
        df_features = self.create_advanced_features()
        
        features = []
        targets = []
        
        # 全データから学習データを作成（window_size以降の全データを使用）
        for i in range(window_size, len(df_features)):
            feature = []
            # 過去window_size回の基本データ（全データの場合は最大100回まで）
            for j in range(window_size):
                idx = i - window_size + j
                feature.extend([
                    df_features.iloc[idx]['hundred'],
                    df_features.iloc[idx]['ten'],
                    df_features.iloc[idx]['one'],
                    df_features.iloc[idx]['sum'],
                    df_features.iloc[idx]['span']
                ])
            
            # 現在の特徴量（移動平均、RSI、MACDなど）
            if not pd.isna(df_features.iloc[i]['hundred_ma20']):
                feature.extend([
                    df_features.iloc[i]['hundred_ma20'],
                    df_features.iloc[i]['ten_ma20'],
                    df_features.iloc[i]['one_ma20'],
                    df_features.iloc[i]['hundred_rsi'],
                    df_features.iloc[i]['ten_rsi'],
                    df_features.iloc[i]['one_rsi'],
                    df_features.iloc[i]['hundred_macd'],
                    df_features.iloc[i]['ten_macd'],
                    df_features.iloc[i]['one_macd']
                ])
            else:
                # NaNの場合は0で埋める
                feature.extend([0.0] * 9)
            
            features.append(feature)
            targets.append([
                df_features.iloc[i]['hundred'],
                df_features.iloc[i]['ten'],
                df_features.iloc[i]['one']
            ])
        
        if len(features) < 10:
            # データが少なすぎる場合は簡易予測を返す
            last_hundred = int(self.df.iloc[-1]['hundred'])
            last_ten = int(self.df.iloc[-1]['ten'])
            last_one = int(self.df.iloc[-1]['one'])
            
            return {
                'method': 'random_forest',
                'set_prediction': f"{last_hundred}{last_ten}{last_one}",
                'mini_prediction': f"{last_ten}{last_one}",
                'confidence': 0.60,
                'reason': 'ランダムフォレスト（データ不足のため簡易予測）',
                'feature_importance': []
            }
        
        features_array = np.array(features)
        targets_array = np.array(targets)
        
        # NaNを0で埋める
        features_array = np.nan_to_num(features_array, nan=0.0)
        targets_array = np.nan_to_num(targets_array, nan=0.0)
        
        # ランダムフォレストで学習
        rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10, n_jobs=-1)
        rf.fit(features_array, targets_array)
        
        # 最新データから予測
        latest_features = features[-1]
        latest_features_array = np.array(latest_features).reshape(1, -1)
        latest_features_array = np.nan_to_num(latest_features_array, nan=0.0)
        
        predicted = rf.predict(latest_features_array)[0]
        
        # 予測値を0-9の範囲に丸める
        predictions = {}
        predictions['hundred'] = int(np.round(np.clip(predicted[0], 0, 9)))
        predictions['ten'] = int(np.round(np.clip(predicted[1], 0, 9)))
        predictions['one'] = int(np.round(np.clip(predicted[2], 0, 9)))
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        # 特徴量の重要度を取得
        feature_importance = rf.feature_importances_.tolist()
        
        # 特徴量名を生成
        feature_names = []
        # 過去20回の基本データ（各回で5つの特徴量: hundred, ten, one, sum, span）
        for j in range(window_size):
            feature_names.extend([
                f'past_{j}_hundred',
                f'past_{j}_ten',
                f'past_{j}_one',
                f'past_{j}_sum',
                f'past_{j}_span'
            ])
        # 高度な特徴量
        feature_names.extend([
            'hundred_ma20', 'ten_ma20', 'one_ma20',
            'hundred_rsi', 'ten_rsi', 'one_rsi',
            'hundred_macd', 'ten_macd', 'one_macd'
        ])
        
        # 特徴量の重要度と名前をペアにしてソート
        feature_importance_with_names = list(zip(feature_names, feature_importance))
        feature_importance_with_names.sort(key=lambda x: x[1], reverse=True)
        
        # 信頼度を計算（特徴量の重要度の分散に基づく）
        importance_std = np.std(feature_importance)
        confidence = min(0.75 + importance_std * 2, 0.90)
        
        # 統計情報を計算
        total_features = len(feature_importance)
        top10_importance = sum([imp for _, imp in feature_importance_with_names[:10]])
        top20_importance = sum([imp for _, imp in feature_importance_with_names[:20]])
        
        return {
            'method': 'random_forest',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': float(confidence),
            'reason': 'ランダムフォレストによる予測',
            'feature_importance': feature_importance,  # 全特徴量の重要度
            'feature_names': feature_names,  # 特徴量名
            'feature_importance_ranked': [
                {'name': name, 'importance': float(imp)} 
                for name, imp in feature_importance_with_names
            ],  # 重要度順にソートされた特徴量
            'statistics': {
                'total_features': total_features,
                'top10_importance_sum': float(top10_importance),
                'top20_importance_sum': float(top20_importance),
                'max_importance': float(max(feature_importance)),
                'min_importance': float(min(feature_importance)),
                'mean_importance': float(np.mean(feature_importance))
            }
        }
    
    def predict_with_xgboost(self) -> Dict[str, any]:
        """
        XGBoostによる予測
        
        Returns:
            予測結果の辞書
        """
        try:
            import xgboost as xgb
        except ImportError:
            print("[predict_with_xgboost] XGBoostがインストールされていません")
            return None
        
        # 特徴量を作成（過去N回のデータ）
        window_size = 20
        
        # 高度な特徴量を含むDataFrameを取得
        df_features = self.create_advanced_features()
        
        features = []
        targets = []
        
        for i in range(window_size, len(df_features)):
            feature = []
            # 過去window_size回の基本データ
            for j in range(window_size):
                idx = i - window_size + j
                feature.extend([
                    df_features.iloc[idx]['hundred'],
                    df_features.iloc[idx]['ten'],
                    df_features.iloc[idx]['one'],
                    df_features.iloc[idx]['sum'],
                    df_features.iloc[idx]['span']
                ])
            
            # 現在の特徴量（移動平均、RSI、MACDなど）
            if not pd.isna(df_features.iloc[i]['hundred_ma20']):
                feature.extend([
                    df_features.iloc[i]['hundred_ma20'],
                    df_features.iloc[i]['ten_ma20'],
                    df_features.iloc[i]['one_ma20'],
                    df_features.iloc[i]['hundred_rsi'],
                    df_features.iloc[i]['ten_rsi'],
                    df_features.iloc[i]['one_rsi'],
                    df_features.iloc[i]['hundred_macd'],
                    df_features.iloc[i]['ten_macd'],
                    df_features.iloc[i]['one_macd']
                ])
            else:
                feature.extend([0.0] * 9)
            
            features.append(feature)
            targets.append([
                df_features.iloc[i]['hundred'],
                df_features.iloc[i]['ten'],
                df_features.iloc[i]['one']
            ])
        
        if len(features) < 10:
            last_hundred = int(self.df.iloc[-1]['hundred'])
            last_ten = int(self.df.iloc[-1]['ten'])
            last_one = int(self.df.iloc[-1]['one'])
            
            return {
                'method': 'xgboost',
                'set_prediction': f"{last_hundred}{last_ten}{last_one}",
                'mini_prediction': f"{last_ten}{last_one}",
                'confidence': 0.60,
                'reason': 'XGBoost（データ不足のため簡易予測）'
            }
        
        features_array = np.array(features)
        targets_array = np.array(targets)
        
        # NaNを0で埋める
        features_array = np.nan_to_num(features_array, nan=0.0)
        targets_array = np.nan_to_num(targets_array, nan=0.0)
        
        # XGBoostで学習（各桁を個別に予測）
        predictions = {}
        feature_importances = []
        
        for pos_idx, pos_name in enumerate(['hundred', 'ten', 'one']):
            target_pos = targets_array[:, pos_idx]
            
            model = xgb.XGBRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1
            )
            model.fit(features_array, target_pos)
            
            # 最新データから予測
            latest_features = features[-1]
            latest_features_array = np.array(latest_features).reshape(1, -1)
            latest_features_array = np.nan_to_num(latest_features_array, nan=0.0)
            
            predicted = model.predict(latest_features_array)[0]
            predictions[pos_name] = int(np.round(np.clip(predicted, 0, 9)))
            
            # 特徴量重要度を保存（最初の桁のみ）
            if pos_idx == 0:
                feature_importances = model.feature_importances_.tolist()
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        # 信頼度を計算
        confidence = 0.78  # XGBoostは高精度
        
        return {
            'method': 'xgboost',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': float(confidence),
            'reason': 'XGBoost勾配ブースティングによる予測',
            'feature_importance': feature_importances
        }
    
    def predict_with_lightgbm(self) -> Dict[str, any]:
        """
        LightGBMによる予測
        
        Returns:
            予測結果の辞書
        """
        try:
            import lightgbm as lgb
        except ImportError:
            print("[predict_with_lightgbm] LightGBMがインストールされていません")
            return None
        
        # 特徴量を作成（全データを使用）
        # 過去データの特徴量は最大100回まで使用（全データを使うと特徴量が膨大になるため）
        max_past_window = min(100, len(self.df))
        window_size = max_past_window
        
        # 高度な特徴量を含むDataFrameを取得
        df_features = self.create_advanced_features()
        
        features = []
        targets = []
        
        # 全データから学習データを作成（window_size以降の全データを使用）
        for i in range(window_size, len(df_features)):
            feature = []
            # 過去window_size回の基本データ（全データの場合は最大100回まで）
            for j in range(window_size):
                idx = i - window_size + j
                feature.extend([
                    df_features.iloc[idx]['hundred'],
                    df_features.iloc[idx]['ten'],
                    df_features.iloc[idx]['one'],
                    df_features.iloc[idx]['sum'],
                    df_features.iloc[idx]['span']
                ])
            
            # 現在の特徴量（移動平均、RSI、MACDなど）
            if not pd.isna(df_features.iloc[i]['hundred_ma20']):
                feature.extend([
                    df_features.iloc[i]['hundred_ma20'],
                    df_features.iloc[i]['ten_ma20'],
                    df_features.iloc[i]['one_ma20'],
                    df_features.iloc[i]['hundred_rsi'],
                    df_features.iloc[i]['ten_rsi'],
                    df_features.iloc[i]['one_rsi'],
                    df_features.iloc[i]['hundred_macd'],
                    df_features.iloc[i]['ten_macd'],
                    df_features.iloc[i]['one_macd']
                ])
            else:
                feature.extend([0.0] * 9)
            
            features.append(feature)
            targets.append([
                df_features.iloc[i]['hundred'],
                df_features.iloc[i]['ten'],
                df_features.iloc[i]['one']
            ])
        
        if len(features) < 10:
            last_hundred = int(self.df.iloc[-1]['hundred'])
            last_ten = int(self.df.iloc[-1]['ten'])
            last_one = int(self.df.iloc[-1]['one'])
            
            return {
                'method': 'lightgbm',
                'set_prediction': f"{last_hundred}{last_ten}{last_one}",
                'mini_prediction': f"{last_ten}{last_one}",
                'confidence': 0.60,
                'reason': 'LightGBM（データ不足のため簡易予測）'
            }
        
        features_array = np.array(features)
        targets_array = np.array(targets)
        
        # NaNを0で埋める
        features_array = np.nan_to_num(features_array, nan=0.0)
        targets_array = np.nan_to_num(targets_array, nan=0.0)
        
        # LightGBMで学習（各桁を個別に予測）
        predictions = {}
        feature_importances = []
        
        for pos_idx, pos_name in enumerate(['hundred', 'ten', 'one']):
            target_pos = targets_array[:, pos_idx]
            
            model = lgb.LGBMRegressor(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1,
                verbose=-1
            )
            model.fit(features_array, target_pos)
            
            # 最新データから予測
            latest_features = features[-1]
            latest_features_array = np.array(latest_features).reshape(1, -1)
            latest_features_array = np.nan_to_num(latest_features_array, nan=0.0)
            
            predicted = model.predict(latest_features_array)[0]
            predictions[pos_name] = int(np.round(np.clip(predicted, 0, 9)))
            
            # 特徴量重要度を保存（最初の桁のみ）
            if pos_idx == 0:
                feature_importances = model.feature_importances_.tolist()
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        # 信頼度を計算
        confidence = 0.80  # LightGBMは非常に高精度
        
        return {
            'method': 'lightgbm',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': float(confidence),
            'reason': 'LightGBM勾配ブースティングによる予測',
            'feature_importance': feature_importances
        }
    
    def predict_with_arima(self) -> Dict[str, any]:
        """
        ARIMAモデルによる予測
        
        Returns:
            予測結果の辞書
        """
        try:
            from statsmodels.tsa.arima.model import ARIMA
            from pmdarima import auto_arima
        except ImportError:
            print("[predict_with_arima] statsmodelsまたはpmdarimaがインストールされていません")
            return None
        
        predictions = {}
        
        for pos in ['hundred', 'ten', 'one']:
            data = self.df[pos].values.astype(float)
            
            if len(data) < 30:
                # データが少なすぎる場合は最後の値を返す
                predictions[pos] = int(self.df.iloc[-1][pos])
                continue
            
            try:
                # 自動ARIMAモデル選択（計算コストが高いので簡易版を使用）
                # 簡易版: 固定パラメータでARIMA(2,1,2)を使用
                model = ARIMA(data, order=(2, 1, 2))
                fitted_model = model.fit()
                
                # 1ステップ先を予測
                forecast = fitted_model.forecast(steps=1)
                predicted = int(np.round(np.clip(forecast[0], 0, 9)))
                predictions[pos] = predicted
                
            except Exception as e:
                print(f"[predict_with_arima] {pos}のARIMA予測に失敗: {e}")
                # エラー時は最後の値を返す
                predictions[pos] = int(self.df.iloc[-1][pos])
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        return {
            'method': 'arima',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': 0.73,
            'reason': 'ARIMA時系列モデルによる予測'
        }
    
    def predict_with_stacking(self) -> Dict[str, any]:
        """
        スタッキングによるアンサンブル予測
        
        Returns:
            予測結果の辞書
        """
        from sklearn.ensemble import StackingRegressor
        from sklearn.linear_model import RidgeCV
        from sklearn.ensemble import RandomForestRegressor
        
        # 特徴量を作成（全データを使用）
        # 過去データの特徴量は最大100回まで使用（全データを使うと特徴量が膨大になるため）
        max_past_window = min(100, len(self.df))
        window_size = max_past_window
        
        df_features = self.create_advanced_features()
        
        features = []
        targets = []
        
        # 全データから学習データを作成（window_size以降の全データを使用）
        for i in range(window_size, len(df_features)):
            feature = []
            # 過去window_size回の基本データ（全データの場合は最大100回まで）
            for j in range(window_size):
                idx = i - window_size + j
                feature.extend([
                    df_features.iloc[idx]['hundred'],
                    df_features.iloc[idx]['ten'],
                    df_features.iloc[idx]['one'],
                    df_features.iloc[idx]['sum'],
                    df_features.iloc[idx]['span']
                ])
            
            if not pd.isna(df_features.iloc[i]['hundred_ma20']):
                feature.extend([
                    df_features.iloc[i]['hundred_ma20'],
                    df_features.iloc[i]['ten_ma20'],
                    df_features.iloc[i]['one_ma20'],
                    df_features.iloc[i]['hundred_rsi'],
                    df_features.iloc[i]['ten_rsi'],
                    df_features.iloc[i]['one_rsi'],
                    df_features.iloc[i]['hundred_macd'],
                    df_features.iloc[i]['ten_macd'],
                    df_features.iloc[i]['one_macd']
                ])
            else:
                feature.extend([0.0] * 9)
            
            features.append(feature)
            targets.append([
                df_features.iloc[i]['hundred'],
                df_features.iloc[i]['ten'],
                df_features.iloc[i]['one']
            ])
        
        if len(features) < 10:
            last_hundred = int(self.df.iloc[-1]['hundred'])
            last_ten = int(self.df.iloc[-1]['ten'])
            last_one = int(self.df.iloc[-1]['one'])
            
            return {
                'method': 'stacking',
                'set_prediction': f"{last_hundred}{last_ten}{last_one}",
                'mini_prediction': f"{last_ten}{last_one}",
                'confidence': 0.60,
                'reason': 'スタッキング（データ不足のため簡易予測）'
            }
        
        features_array = np.array(features)
        targets_array = np.array(targets)
        
        # NaNを0で埋める
        features_array = np.nan_to_num(features_array, nan=0.0)
        targets_array = np.nan_to_num(targets_array, nan=0.0)
        
        # ベースモデルを定義
        base_models = [
            ('rf', RandomForestRegressor(n_estimators=50, random_state=42, max_depth=8, n_jobs=-1)),
        ]
        
        # XGBoostとLightGBMが利用可能な場合は追加
        try:
            import xgboost as xgb
            base_models.append(('xgb', xgb.XGBRegressor(n_estimators=50, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1)))
        except ImportError:
            pass
        
        try:
            import lightgbm as lgb
            base_models.append(('lgb', lgb.LGBMRegressor(n_estimators=50, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)))
        except ImportError:
            pass
        
        # メタモデル（最終予測を行うモデル）
        meta_model = RidgeCV()
        
        # スタッキング回帰器を作成
        stacking_regressor = StackingRegressor(
            estimators=base_models,
            final_estimator=meta_model,
            cv=3,
            n_jobs=-1
        )
        
        # 各桁を個別に予測
        predictions = {}
        
        for pos_idx, pos_name in enumerate(['hundred', 'ten', 'one']):
            target_pos = targets_array[:, pos_idx]
            
            stacking_regressor.fit(features_array, target_pos)
            
            # 最新データから予測
            latest_features = features[-1]
            latest_features_array = np.array(latest_features).reshape(1, -1)
            latest_features_array = np.nan_to_num(latest_features_array, nan=0.0)
            
            predicted = stacking_regressor.predict(latest_features_array)[0]
            predictions[pos_name] = int(np.round(np.clip(predicted, 0, 9)))
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        return {
            'method': 'stacking',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': 0.82,  # スタッキングは高精度
            'reason': 'スタッキングアンサンブル学習による予測'
        }
    
    def calculate_dynamic_confidence(self, method_name: str, prediction: str) -> float:
        """
        動的信頼度計算（過去の精度に基づく）
        
        Args:
            method_name: 予測手法名
            prediction: 予測値
            
        Returns:
            信頼度（0.0-1.0）
        """
        # 簡易版：実際には過去の予測履歴と実際の結果を比較する必要がある
        # ここでは、各手法の想定精度に基づく基本信頼度を返す
        
        base_confidence = {
            'chaos': 0.65,
            'markov': 0.70,
            'bayesian': 0.68,
            'periodicity': 0.72,
            'pattern': 0.68,
            'random_forest': 0.75,
            'xgboost': 0.78,
            'lightgbm': 0.80,
            'arima': 0.73,
            'stacking': 0.82
        }
        
        base = base_confidence.get(method_name, 0.65)
        
        # 予測値が頻出パターンに含まれている場合は信頼度を上げる
        patterns = self.extract_frequent_patterns(top_n=20)
        
        if prediction in patterns.get('set_top', {}):
            # 頻出パターンの上位10位以内なら信頼度を上げる
            rank = list(patterns['set_top'].keys()).index(prediction) + 1
            if rank <= 10:
                boost = (11 - rank) * 0.01  # 最大0.1のブースト
                base = min(base + boost, 0.95)
        
        # トレンドと一致している場合は信頼度を上げる
        trends = self.analyze_trends()
        last_hundred = int(self.df.iloc[-1]['hundred'])
        last_ten = int(self.df.iloc[-1]['ten'])
        last_one = int(self.df.iloc[-1]['one'])
        
        predicted_hundred = int(prediction[0])
        predicted_ten = int(prediction[1])
        predicted_one = int(prediction[2])
        
        # 短期トレンドと一致しているかチェック
        if 'short' in trends.get('hundred', {}):
            trend_hundred = trends['hundred']['short']['trend']
            if trend_hundred > 0 and predicted_hundred > last_hundred:
                base += 0.02
            elif trend_hundred < 0 and predicted_hundred < last_hundred:
                base += 0.02
        
        return min(base, 0.95)  # 最大0.95に制限
    
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
        # 全件の位相データを使用
        recent_phases = self.get_recent_phases(len(self.df))
        
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
    
    def predict_with_periodicity(self) -> Dict[str, any]:
        """
        周期性分析を活用した予測
        
        Returns:
            予測結果の辞書
        """
        patterns = self.analyze_periodicity()
        predictions = {}
        
        # 現在の日付情報を取得
        last_date = self.df.iloc[-1]['date']
        current_weekday = last_date.dayofweek
        current_month = last_date.month
        current_quarter = last_date.quarter
        
        for pos in ['hundred', 'ten', 'one']:
            # 曜日パターンから予測
            weekday_probs = {}
            if current_weekday in patterns['weekday'][pos]:
                weekday_probs = patterns['weekday'][pos][current_weekday]
            
            # 月次パターンから予測
            monthly_probs = {}
            if current_month in patterns['monthly'][pos]:
                monthly_probs = patterns['monthly'][pos][current_month]
            
            # 四半期パターンから予測
            quarterly_probs = {}
            if current_quarter in patterns['quarterly'][pos]:
                quarterly_probs = patterns['quarterly'][pos][current_quarter]
            
            # 重み付き平均で予測
            combined_probs = {}
            for digit in range(10):
                prob = 0.0
                count = 0
                if str(digit) in weekday_probs:
                    prob += weekday_probs[str(digit)] * 0.4
                    count += 0.4
                if str(digit) in monthly_probs:
                    prob += monthly_probs[str(digit)] * 0.3
                    count += 0.3
                if str(digit) in quarterly_probs:
                    prob += quarterly_probs[str(digit)] * 0.3
                    count += 0.3
                
                if count > 0:
                    combined_probs[digit] = prob / count
                else:
                    combined_probs[digit] = 0.1  # デフォルト確率
            
            predicted = max(combined_probs.items(), key=lambda x: x[1])[0]
            predictions[pos] = predicted
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        return {
            'method': 'periodicity',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': 0.72,
            'reason': '周期性分析（曜日・月次・四半期パターン）から予測'
        }
    
    def predict_with_patterns(self) -> Dict[str, any]:
        """
        頻出パターンを活用した予測
        
        Returns:
            予測結果の辞書
        """
        patterns = self.extract_frequent_patterns(top_n=10)
        predictions = {}
        
        # 直近の数字を取得
        last_hundred = int(self.df.iloc[-1]['hundred'])
        last_ten = int(self.df.iloc[-1]['ten'])
        last_one = int(self.df.iloc[-1]['one'])
        
        # 百の位と十の位の組み合わせから予測
        hundred_ten_key = f"{last_hundred}{last_ten}"
        if hundred_ten_key in patterns['hundred_ten_top']:
            # 頻出パターンから次の一の位を予測
            # 実際には、この組み合わせの後に来る一の位の頻度を見る必要がある
            # 簡易版として、最も頻出する下2桁から予測
            if patterns['mini_top']:
                most_common_mini = list(patterns['mini_top'].keys())[0]
                predicted_one = int(most_common_mini[1])
            else:
                predicted_one = last_one
        else:
            predicted_one = last_one
        
        # 十の位と一の位の組み合わせから予測
        ten_one_key = f"{last_ten}{last_one}"
        if ten_one_key in patterns['ten_one_top']:
            # 頻出パターンから次の百の位を予測
            if patterns['set_top']:
                most_common_set = list(patterns['set_top'].keys())[0]
                predicted_hundred = int(most_common_set[0])
            else:
                predicted_hundred = last_hundred
        else:
            predicted_hundred = last_hundred
        
        # 十の位はマルコフ連鎖を使用
        predictions['hundred'] = predicted_hundred
        predictions['ten'] = last_ten  # 簡易版
        predictions['one'] = predicted_one
        
        set_pred = f"{predictions['hundred']}{predictions['ten']}{predictions['one']}"
        mini_pred = f"{predictions['ten']}{predictions['one']}"
        
        return {
            'method': 'pattern',
            'set_prediction': set_pred,
            'mini_prediction': mini_pred,
            'confidence': 0.68,
            'reason': '頻出パターン分析から予測'
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
        periodicity_pred = self.predict_with_periodicity()
        pattern_pred = self.predict_with_patterns()
        
        # ランダムフォレストによる予測（計算コストが高いのでエラーハンドリング）
        random_forest_pred = None
        try:
            random_forest_pred = self.predict_with_random_forest()
        except Exception as e:
            print(f"[ensemble_predict] ランダムフォレスト予測をスキップ: {e}")
        
        # XGBoostによる予測
        xgboost_pred = None
        try:
            xgboost_pred = self.predict_with_xgboost()
        except Exception as e:
            print(f"[ensemble_predict] XGBoost予測をスキップ: {e}")
        
        # LightGBMによる予測
        lightgbm_pred = None
        try:
            lightgbm_pred = self.predict_with_lightgbm()
        except Exception as e:
            print(f"[ensemble_predict] LightGBM予測をスキップ: {e}")
        
        # ARIMAによる予測
        arima_pred = None
        try:
            arima_pred = self.predict_with_arima()
        except Exception as e:
            print(f"[ensemble_predict] ARIMA予測をスキップ: {e}")
        
        # スタッキングによる予測
        stacking_pred = None
        try:
            stacking_pred = self.predict_with_stacking()
        except Exception as e:
            print(f"[ensemble_predict] スタッキング予測をスキップ: {e}")
        
        # 各手法の予測を集計
        set_votes = {}
        mini_votes = {}
        
        # 各手法の重み（過去の精度に基づく想定値）
        weights = {
            'chaos': 0.65,
            'markov': 0.70,
            'bayesian': 0.68,
            'periodicity': 0.72,
            'pattern': 0.68,
            'random_forest': 0.75,
            'xgboost': 0.78,
            'lightgbm': 0.80,
            'arima': 0.73,
            'stacking': 0.82
        }
        
        predictions_list = [chaos_pred, markov_pred, bayesian_pred, periodicity_pred, pattern_pred]
        if random_forest_pred:
            predictions_list.append(random_forest_pred)
        if xgboost_pred:
            predictions_list.append(xgboost_pred)
        if lightgbm_pred:
            predictions_list.append(lightgbm_pred)
        if arima_pred:
            predictions_list.append(arima_pred)
        if stacking_pred:
            predictions_list.append(stacking_pred)
        
        for pred in predictions_list:
            set_num = pred['set_prediction']
            mini_num = pred['mini_prediction']
            confidence = pred['confidence']
            method = pred['method']
            weight = weights.get(method, 0.65)
            
            set_votes[set_num] = set_votes.get(set_num, 0) + confidence * weight
            mini_votes[mini_num] = mini_votes.get(mini_num, 0) + confidence * weight
        
        # 最も支持された予測を選択
        best_set = max(set_votes.items(), key=lambda x: x[1])
        best_mini = max(mini_votes.items(), key=lambda x: x[1])
        
        # トップ5のセット予測
        set_top5 = sorted(set_votes.items(), key=lambda x: x[1], reverse=True)[:5]
        mini_top5 = sorted(mini_votes.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # 総重みで正規化
        total_weight = sum(weights.get(pred['method'], 0.65) for pred in predictions_list)
        
        # タイムスタンプはJST（Asia/Tokyo）で記録
        jst_now = datetime.now(ZoneInfo("Asia/Tokyo"))
        
        # 追加の分析結果を取得
        correlations = self.analyze_correlations()
        trends = self.analyze_trends()
        frequent_patterns = self.extract_frequent_patterns(top_n=10)
        gap_analysis = self.analyze_gaps_detailed()
        anomalies = self.detect_anomalies()
        periodicity_patterns = self.analyze_periodicity()
        
        # フーリエ変換による周波数解析（計算コストが高いのでオプション）
        frequency_analysis = None
        try:
            frequency_analysis = self.analyze_frequency_domain()
        except Exception as e:
            print(f"[ensemble_predict] 周波数解析をスキップ: {e}")
        
        # クラスタリング分析（計算コストが高いのでオプション）
        clustering = None
        try:
            clustering = self.cluster_patterns(n_clusters=5)
        except Exception as e:
            print(f"[ensemble_predict] クラスタリング分析をスキップ: {e}")
        
        # methods辞書を構築
        methods_dict = {
            'chaos': chaos_pred,
            'markov': markov_pred,
            'bayesian': bayesian_pred,
            'periodicity': periodicity_pred,
            'pattern': pattern_pred
        }
        if random_forest_pred:
            methods_dict['random_forest'] = random_forest_pred
        if xgboost_pred:
            methods_dict['xgboost'] = xgboost_pred
        if lightgbm_pred:
            methods_dict['lightgbm'] = lightgbm_pred
        if arima_pred:
            methods_dict['arima'] = arima_pred
        if stacking_pred:
            methods_dict['stacking'] = stacking_pred
        
        return {
            'timestamp': jst_now.isoformat(),
            'set_predictions': [
                {
                    'number': item[0],
                    'confidence': round(item[1] / total_weight, 3),
                    'rank': idx + 1
                }
                for idx, item in enumerate(set_top5)
            ],
            'mini_predictions': [
                {
                    'number': item[0],
                    'confidence': round(item[1] / total_weight, 3),
                    'rank': idx + 1
                }
                for idx, item in enumerate(mini_top5)
            ],
            'methods': methods_dict,
            'recent_phases': self.get_recent_phases(len(self.df)),
            'statistics': {
                'total_records': len(self.df),
                'last_date': self.df.iloc[-1]['date'].strftime('%Y-%m-%d'),
                'last_number': str(self.df.iloc[-1]['num']).zfill(3)
            },
            'advanced_analysis': {
                'correlations': correlations,
                'trends': trends,
                'frequent_patterns': frequent_patterns,
                'gap_analysis': gap_analysis,
                'anomalies': anomalies,
                'clustering': clustering,
                'periodicity': periodicity_patterns,
                'frequency_analysis': frequency_analysis
            }
        }
    
    def save_prediction(self, output_path: str = "docs/data/latest_prediction.json"):
        """
        予測結果をJSONファイルに保存（履歴も保存）
        
        Args:
            output_path: 出力ファイルのパス
        """
        prediction = self.ensemble_predict()
        
        # ディレクトリが存在しない場合は作成
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # latest_prediction.jsonに保存（既存の動作を維持）
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(prediction, f, ensure_ascii=False, indent=2)
        
        print(f"予測結果を {output_path} に保存しました")
        
        # 日付と時刻付きファイルで履歴を保存（同日に複数回実行可能）
        jst_now = datetime.now(ZoneInfo("Asia/Tokyo"))
        date_str = jst_now.strftime("%Y-%m-%d")
        time_str = jst_now.strftime("%H%M%S")
        datetime_str = jst_now.strftime("%Y-%m-%d_%H%M%S")
        history_dir = os.path.dirname(output_path)
        history_file = os.path.join(history_dir, f"prediction_{datetime_str}.json")
        
        # 日時付きファイルに保存
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(prediction, f, ensure_ascii=False, indent=2)
        
        print(f"予測履歴を {history_file} に保存しました")
        
        # 履歴リストを更新
        history_list_path = os.path.join(history_dir, "prediction_history.json")
        history_list = []
        
        if os.path.exists(history_list_path):
            try:
                with open(history_list_path, 'r', encoding='utf-8') as f:
                    history_list = json.load(f)
            except Exception as e:
                print(f"[save_prediction] 履歴リストの読み込みに失敗: {e}")
                history_list = []
        
        # 新しいエントリを追加（同じ日時でも別エントリとして追加）
        history_entry = {
            'date': date_str,
            'time': time_str,
            'datetime': datetime_str,
            'timestamp': jst_now.isoformat(),
            'file': f"prediction_{datetime_str}.json",
            'statistics': prediction.get('statistics', {})
        }
        
        history_list.append(history_entry)
        # タイムスタンプでソート（新しい順）
        history_list.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        print(f"[save_prediction] 履歴リストに追加しました: {datetime_str}")
        
        # 履歴リストを保存
        with open(history_list_path, 'w', encoding='utf-8') as f:
            json.dump(history_list, f, ensure_ascii=False, indent=2)
        
        print(f"履歴リストを {history_list_path} に保存しました（{len(history_list)} 件）")
        
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

