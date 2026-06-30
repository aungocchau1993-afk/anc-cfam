#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BEST EXPRESS - SMART STOCK IMPORT MODULE
=========================================
Module chuyen biet xu ly file CSV tu BEST Express de nhap kho thong minh.

Logic:
  1. Doc file CSV nha cung cap (BEST Express)
  2. Fuzzy match ten san pham voi danh sach hang hoa chuan cua shop
  3. Tu dong tinh so luong: Gia_NCC / Gia_Goc = So_Luong
  4. Canh bao neu ket qua chia khong ra so nguyen (chenh lech > 10%)

Usage:
    from BEST_Parser import BESTStockImporter

    importer = BESTStockImporter()
    importer.load_standard_products("my_products.json")
    results = importer.process_supplier_file("best_export.csv")
    importer.export_results(results, "nhap_kho.json")

CLI:
    python BEST_Parser.py supplier.csv --products my_products.json --output nhap_kho.json
    python BEST_Parser.py --test
"""

import csv
import json
import re
import os
import sys
import difflib
import unicodedata
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime

# ── Try import thefuzz for better matching, fallback to difflib ────────────
try:
    from thefuzz import fuzz as _fuzz
    from thefuzz import process as _fuzz_process
    HAS_THEFUZZ = True
except ImportError:
    try:
        from fuzzywuzzy import fuzz as _fuzz
        from fuzzywuzzy import process as _fuzz_process
        HAS_THEFUZZ = True
    except ImportError:
        HAS_THEFUZZ = False


# ===========================================================================
#  CONSTANTS
# ===========================================================================

# Ky tu rac thuong gap trong file BEST
GARBAGE_PATTERNS = [
    r'\[\d+\]\|?',        # Tag [1]|, [2]|, etc.
    r'\*{3,}',            # Chuoi *** tro len
    r'[\x00-\x08\x0b\x0c\x0e-\x1f]',  # Control characters
    r'^\s*\|\s*',         # Pipe dau dong
    r'\s*\|\s*$',         # Pipe cuoi dong
]

# Tu khoa khuyen mai can loai bo khoi ten san pham
PROMO_PATTERNS = [
    r'\(?\s*(?:KM|Khuyen mai|Khuyến mãi|KHUYEN MAI|KHUYẾN MÃI|'
    r'Tang kem|Tặng kèm|TANG KEM|TẶNG KÈM|'
    r'Qua tang|Quà tặng|QUA TANG|QUÀ TẶNG|'
    r'Free|free|FREE|Mien phi|Miễn phí|MIEN PHI|MIỄN PHÍ|'
    r'Giam gia|Giảm giá|GIAM GIA|GIẢM GIÁ|'
    r'Sale|sale|SALE|Combo|combo|COMBO)\s*[::\-]?\s*.*?\)?',
]

# Mapping ten cot CSV cua BEST -> ten chuan noi bo
# CHI GIU LAI cac cot can thiet cho nhap kho
COLUMN_ALIASES = {
    'product_info': [
        'Thong tin hang hoa', 'Thông tin hàng hóa',
        'Ten hang', 'Tên hàng', 'San pham', 'Sản phẩm',
        'Product', 'Goods Info', 'Hang hoa', 'Hàng hóa',
        'Ten san pham', 'Tên sản phẩm',
    ],
    'supplier_price': [
        'Gia', 'Giá', 'Thanh tien', 'Thành tiền',
        'Tong tien', 'Tổng tiền', 'Total', 'Amount',
        'Gia ban', 'Giá bán', 'Don gia', 'Đơn giá',
        'Gia nhap', 'Giá nhập', 'Price', 'Unit Price',
        'Gia von', 'Giá vốn', 'COD', 'cod',
        'Tien thu ho', 'Tiền thu hộ',
    ],
    'quantity': [
        'So luong', 'Số lượng', 'SL', 'Qty', 'Quantity',
        'So luong nhap', 'Số lượng nhập',
    ],
}

# Cac cot BO QUA (khong xu ly)
IGNORED_COLUMNS = [
    'Ma van don', 'Mã vận đơn', 'Tracking', 'Waybill', 'Bill Number',
    'So dat hang', 'Số đặt hàng', 'Order ID', 'Order Number', 'Ma don hang', 'Mã đơn hàng',
    'Dia chi nguoi nhan', 'Địa chỉ người nhận', 'Address', 'Receiver Address',
    'Dia chi', 'Địa chỉ',
]

# Nguong fuzzy match
FUZZY_THRESHOLD = 65       # Diem toi thieu de coi la "match"
FUZZY_HIGH_CONF = 85       # Diem de coi la "match tot"
QTY_TOLERANCE = 0.10       # Sai lech toi da 10% khi chia gia


# ===========================================================================
#  TEXT UTILITIES
# ===========================================================================

def normalize_text(text: str) -> str:
    """Bo dau tieng Viet, lowercase, strip."""
    if not text:
        return ''
    nfkd = unicodedata.normalize('NFD', text)
    result = ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    result = result.replace('đ', 'd').replace('Đ', 'D')
    return result.lower().strip()


def clean_garbage(text: str) -> str:
    """Loai bo tat ca ky tu rac khoi chuoi."""
    if not text or not isinstance(text, str):
        return ''
    result = text
    for pattern in GARBAGE_PATTERNS:
        result = re.sub(pattern, ' ', result)
    result = re.sub(r'\s{2,}', ' ', result).strip()
    return result


def clean_product_name(raw: str) -> str:
    """
    Tach ten san pham sach tu cot 'Thong tin hang hoa'.
    Loai bo: tag [1]|, thong tin KM, so luong x gia, ky tu thua.
    """
    if not raw or not isinstance(raw, str):
        return ''

    text = clean_garbage(raw)

    # Loai bo pattern "SL x Gia": "1 x 450,000d"
    text = re.sub(r'\d+\s*[xX\u00d7]\s*[\d,.\s]+(?:d|đ|VND|VNĐ|vnđ)?', '', text)

    # Loai bo gia tien dung rieng: "450,000d", "150.000 VND"
    text = re.sub(r'[\d,.]+\s*(?:d|đ|VND|VNĐ|vnđ)\b', '', text)

    # Loai bo ky tu 'd' con sot tu gia tien
    text = re.sub(r'\b[dD]\b(?!\w)', '', text)

    # Loai bo thong tin khuyen mai
    for pattern in PROMO_PATTERNS:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)

    # Loai bo so luong dau dong: "1. ", "2) "
    text = re.sub(r'^\s*\d+[.\)]\s*', '', text)
    text = re.sub(r'^\s*[-\u2013\u2014]\s*', '', text)

    # Loai bo ngoac rong
    text = re.sub(r'\(\s*\)', '', text)
    text = re.sub(r'\[\s*\]', '', text)

    # Chuan hoa khoang trang
    text = re.sub(r'\s{2,}', ' ', text).strip()
    text = text.strip(',;|/ ')

    return text


def parse_money(raw: Any) -> float:
    """Parse gia tien tu string co dau phay/cham -> float."""
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if not text:
        return 0.0
    text = re.sub(r'[^\d.,\-]', '', text)
    if not text:
        return 0.0

    if '.' in text and ',' in text:
        if text.rindex('.') > text.rindex(','):
            text = text.replace(',', '')
        else:
            text = text.replace('.', '').replace(',', '.')
    elif ',' in text:
        parts = text.split(',')
        if len(parts[-1]) == 3 or len(parts) > 2:
            text = text.replace(',', '')
        else:
            text = text.replace(',', '.')
    elif '.' in text:
        parts = text.split('.')
        if len(parts[-1]) == 3 or len(parts) > 2:
            text = text.replace('.', '')

    try:
        return float(text)
    except ValueError:
        return 0.0


# ===========================================================================
#  FUZZY MATCHING ENGINE
# ===========================================================================

class FuzzyMatcher:
    """
    So khop ten san pham giua file NCC va danh sach chuan cua shop.
    Uu tien thefuzz neu co, fallback difflib.
    """

    def __init__(self, standard_products: List[Dict[str, Any]]):
        """
        Args:
            standard_products: List[{"name": str, "price": float, ...}]
        """
        self.products = standard_products
        self._name_map: Dict[str, Dict] = {}
        self._norm_names: List[str] = []

        # Build lookup
        for p in standard_products:
            name = p.get('name', '').strip()
            if name:
                norm = normalize_text(name)
                self._name_map[norm] = p
                self._norm_names.append(norm)

    def find_best_match(self, query: str) -> Optional[Tuple[Dict, int]]:
        """
        Tim san pham chuan khop nhat voi ten tu NCC.

        Returns:
            (product_dict, score) hoac None neu khong khop
        """
        if not query or not self._norm_names:
            return None

        query_clean = clean_product_name(query)
        query_norm = normalize_text(query_clean)

        if not query_norm:
            return None

        # === Strategy 1: Exact match (normalized) ===
        if query_norm in self._name_map:
            return (self._name_map[query_norm], 100)

        # === Strategy 2: thefuzz (neu co) ===
        if HAS_THEFUZZ:
            return self._match_thefuzz(query_norm, query_clean)

        # === Strategy 3: difflib ===
        return self._match_difflib(query_norm, query_clean)

    def _match_thefuzz(self, query_norm: str, query_clean: str) -> Optional[Tuple[Dict, int]]:
        """Fuzzy match su dung thefuzz."""
        # Thu nhieu chien luoc scoring
        best_score = 0
        best_match = None

        for norm_name, product in self._name_map.items():
            # Token sort ratio (tot cho ten bi dao vi tri)
            score_sort = _fuzz.token_sort_ratio(query_norm, norm_name)
            # Token set ratio (tot cho ten co them/bot tu)
            score_set = _fuzz.token_set_ratio(query_norm, norm_name)
            # Partial ratio (tot cho ten la substring)
            score_partial = _fuzz.partial_ratio(query_norm, norm_name)
            # Ratio (standard)
            score_ratio = _fuzz.ratio(query_norm, norm_name)

            # Lay diem cao nhat tu cac chien luoc
            score = max(score_sort, score_set, score_partial, score_ratio)

            if score > best_score:
                best_score = score
                best_match = product

        if best_score >= FUZZY_THRESHOLD and best_match:
            return (best_match, best_score)

        return None

    def _match_difflib(self, query_norm: str, query_clean: str) -> Optional[Tuple[Dict, int]]:
        """Fuzzy match su dung difflib (stdlib, khong can cai them)."""
        # 1. SequenceMatcher ratio
        best_score = 0
        best_match = None

        for norm_name, product in self._name_map.items():
            # Standard ratio
            ratio = difflib.SequenceMatcher(None, query_norm, norm_name).ratio()
            score_std = int(ratio * 100)

            # Token-based: sap xep tu va so sanh
            q_tokens = sorted(query_norm.split())
            n_tokens = sorted(norm_name.split())
            token_ratio = difflib.SequenceMatcher(None, ' '.join(q_tokens), ' '.join(n_tokens)).ratio()
            score_token = int(token_ratio * 100)

            # Substring check: neu 1 ten chua trong ten kia
            score_partial = 0
            if query_norm in norm_name or norm_name in query_norm:
                shorter = min(len(query_norm), len(norm_name))
                longer = max(len(query_norm), len(norm_name))
                score_partial = int(shorter / longer * 100) if longer > 0 else 0

            # Ket hop
            score = max(score_std, score_token, score_partial)

            if score > best_score:
                best_score = score
                best_match = product

        # 2. get_close_matches (backup)
        close = difflib.get_close_matches(query_norm, self._norm_names, n=1, cutoff=0.6)
        if close:
            close_product = self._name_map.get(close[0])
            close_score = int(difflib.SequenceMatcher(None, query_norm, close[0]).ratio() * 100)
            if close_score > best_score and close_product:
                best_score = close_score
                best_match = close_product

        if best_score >= FUZZY_THRESHOLD and best_match:
            return (best_match, best_score)

        return None


# ===========================================================================
#  MAIN IMPORTER CLASS
# ===========================================================================

class BESTStockImporter:
    """
    BEST Express Smart Stock Importer.

    Xu ly file CSV tu BEST Express, fuzzy match voi danh sach san pham
    cua shop, tu dong tinh so luong nhap kho.

    inventory_db (optional):
        Dictionary tra cuu Don vi tinh (DVT). Key = ProductName_Standard,
        value = {'Price': ..., 'Unit': '...'}.
        Neu ko truyen, tu dong lay unit tu standard_products.
    """

    def __init__(self, encoding: str = 'utf-8-sig', delimiter: str = None,
                 inventory_db: Dict[str, Dict] = None):
        self.encoding = encoding
        self.delimiter = delimiter
        self._matcher: Optional[FuzzyMatcher] = None
        self._standard_products: List[Dict] = []
        self._inventory_db: Dict[str, Dict] = inventory_db or {}
        self._warnings: List[Dict] = []
        self._stats = {
            'total_rows': 0,
            'matched': 0,
            'unmatched': 0,
            'warnings': 0,
        }

    # ── Load Standard Products ─────────────────────────────────────────────

    def load_standard_products(self, source: Any) -> int:
        """
        Load danh sach san pham chuan cua shop.

        Args:
            source: Co the la:
                - str: duong dan file JSON hoac CSV
                - List[Dict]: danh sach truc tiep
                  Format: [{"name": "...", "price": 500000}, ...]

        Returns:
            int - so san pham da load
        """
        if isinstance(source, list):
            self._standard_products = source
        elif isinstance(source, str):
            if not os.path.exists(source):
                raise FileNotFoundError(f"Khong tim thay file: {source}")

            ext = os.path.splitext(source)[1].lower()
            if ext == '.json':
                self._standard_products = self._load_json_products(source)
            elif ext in ('.csv', '.xls', '.xlsx'):
                self._standard_products = self._load_csv_products(source)
            else:
                raise ValueError(f"Dinh dang file khong ho tro: {ext}. Dung .json hoac .csv")
        else:
            raise TypeError("source phai la str (filepath) hoac List[Dict]")

        # Validate
        valid = []
        for p in self._standard_products:
            name = p.get('name', '').strip()
            price = parse_money(p.get('price', 0))
            if name and price > 0:
                item = {**p, 'name': name, 'price': price}
                valid.append(item)
                # Auto-build inventory_db from loaded products if not provided
                if name not in self._inventory_db:
                    self._inventory_db[name] = {
                        'Price': price,
                        'Unit': p.get('unit', ''),
                    }

        self._standard_products = valid
        self._matcher = FuzzyMatcher(valid)
        return len(valid)

    def load_products_from_app(self, products: List[Dict]) -> int:
        """
        Load san pham tu app (format cua React app: importPrice, name, sku).
        Tuong thich voi data tu Supabase/Products.jsx.
        """
        standardized = []
        for p in products:
            name = p.get('name', '').strip()
            price = p.get('importPrice', 0) or p.get('import_price', 0) or p.get('price', 0)
            if name and price:
                standardized.append({
                    'name': name,
                    'price': float(price),
                    'sku': p.get('sku', ''),
                    'id': p.get('id', ''),
                    'unit': p.get('unit', ''),
                    'currentStock': p.get('stockQuantity', 0) or p.get('stock_quantity', 0),
                })
        return self.load_standard_products(standardized)

    # ── Process Supplier File ──────────────────────────────────────────────

    def process_supplier_file(self, filepath: str) -> List[Dict[str, Any]]:
        """
        Xu ly file CSV tu BEST Express.

        Args:
            filepath: Duong dan file CSV

        Returns:
            List[Dict] - ket qua nhap kho:
                [{
                    "matched_name": str,       # Ten SP trong he thong
                    "supplier_name": str,       # Ten SP tu NCC (da clean)
                    "supplier_name_raw": str,   # Ten SP goc
                    "quantity": int,            # So luong suy ra
                    "unit_price": float,        # Gia goc cua shop
                    "supplier_price": float,    # Gia tu NCC
                    "match_score": int,         # Diem match (0-100)
                    "confidence": str,          # "high" / "medium" / "low"
                    "sku": str,
                    "id": str,
                    "unit": str,
                    "currentStock": int,
                    "warning": str | None,
                }]
        """
        if not self._matcher:
            raise RuntimeError(
                "Chua load danh sach san pham chuan! "
                "Goi load_standard_products() truoc."
            )

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Khong tim thay file: {filepath}")

        self._warnings = []
        self._stats = {'total_rows': 0, 'matched': 0, 'unmatched': 0, 'warnings': 0}

        encoding = self._detect_encoding(filepath)
        delimiter = self.delimiter or self._detect_delimiter(filepath, encoding)

        results = []

        with open(filepath, 'r', encoding=encoding, errors='replace') as f:
            reader = csv.reader(f, delimiter=delimiter)

            # Tim header row
            headers = None
            for row in reader:
                if self._is_header_row(row):
                    headers = [cell.strip() for cell in row]
                    break

            if not headers:
                raise ValueError("Khong tim thay header hop le trong file.")

            # Map columns (chi lay product_info va supplier_price)
            col_map = self._map_columns(headers)

            if col_map.get('product_info') is None:
                raise ValueError(
                    "Khong tim thay cot ten san pham trong file. "
                    "Can co cot: 'Thong tin hang hoa', 'Ten hang', 'San pham', etc."
                )

            # Parse data rows
            for row_num, row in enumerate(reader, 2):
                self._stats['total_rows'] += 1

                if not row or all(not cell.strip() for cell in row):
                    continue

                result = self._process_row(row, col_map, row_num)
                if result:
                    results.append(result)

        return results

    def process_csv_string(self, csv_text: str) -> List[Dict[str, Any]]:
        """Parse tu string CSV (tien cho testing)."""
        import tempfile
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.csv', encoding='utf-8-sig', delete=False
        ) as tmp:
            tmp.write(csv_text)
            tmp_path = tmp.name
        try:
            return self.process_supplier_file(tmp_path)
        finally:
            os.unlink(tmp_path)

    # ── Export Results ──────────────────────────────────────────────────────

    def export_results(self, results: List[Dict], output_path: str) -> str:
        """Xuat ket qua nhap kho ra JSON."""
        output = []
        for r in results:
            output.append({
                'Ten_San_Pham_Match': r.get('matched_name', ''),
                'So_Luong_Suy_Ra': r.get('quantity', 0),
                'Don_Vi_Tinh': r.get('unit', ''),
                'Gia_Goc': r.get('unit_price', 0),
                'Gia_NCC': r.get('supplier_price', 0),
                'Diem_Match': r.get('match_score', 0),
                'Do_Tin_Cay': r.get('confidence', ''),
                'SKU': r.get('sku', ''),
                'Ton_Kho_Hien_Tai': r.get('currentStock', 0),
                'Ten_NCC_Goc': r.get('supplier_name_raw', ''),
                'Canh_Bao': r.get('warning', None),
            })

        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        return output_path

    def export_warnings(self, output_path: str = 'canh_bao_chenh_lech.txt') -> str:
        """Xuat danh sach canh bao ra file text (bao gom Missing Unit)."""
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("=" * 70 + "\n")
            f.write("  CANH BAO CHENH LECH - CAN KIEM TRA THU CONG\n")
            f.write(f"  Ngay: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 70 + "\n\n")

            if not self._warnings:
                f.write("Khong co canh bao nao.\n")
            else:
                for i, w in enumerate(self._warnings, 1):
                    f.write(f"--- Canh bao #{i} (Dong {w.get('row', '?')}) ---\n")
                    f.write(f"  Loai:           {w.get('type', 'PRICE_MISMATCH')}\n")
                    f.write(f"  Ten NCC:        {w.get('supplier_name', '')}\n")
                    f.write(f"  Ten Match:      {w.get('matched_name', '')}\n")
                    if w.get('type') == 'MISSING_UNIT':
                        f.write(f"  DVT mac dinh:   {w.get('default_unit', '')}\n")
                    else:
                        f.write(f"  Gia NCC:        {w.get('supplier_price', 0):,.0f}\n")
                        f.write(f"  Gia Goc:        {w.get('unit_price', 0):,.0f}\n")
                        f.write(f"  Ket qua chia:   {w.get('raw_division', 0):.2f}\n")
                        f.write(f"  So luong lam tron: {w.get('quantity', 0)}\n")
                        f.write(f"  Sai lech:       {w.get('deviation_pct', 0):.1f}%\n")
                    f.write(f"  Ly do:          {w.get('reason', '')}\n")
                    f.write(f"  Diem match:     {w.get('match_score', 0)}\n\n")

            f.write(f"\nTong: {len(self._warnings)} canh bao\n")

        return output_path

    def get_stats(self) -> Dict:
        """Tra ve thong ke."""
        return {**self._stats, 'warning_count': len(self._warnings)}

    def get_warnings(self) -> List[Dict]:
        """Tra ve danh sach canh bao."""
        return self._warnings

    # ── Core Processing Logic ──────────────────────────────────────────────

    def _process_row(self, row: List[str], col_map: Dict, row_num: int) -> Optional[Dict]:
        """Xu ly 1 dong CSV -> ket qua nhap kho."""

        # Lay ten san pham tu NCC
        prod_idx = col_map.get('product_info')
        raw_name = row[prod_idx].strip() if prod_idx is not None and prod_idx < len(row) else ''

        if not raw_name:
            return None

        clean_name = clean_product_name(raw_name)
        if not clean_name:
            return None

        # Lay gia tu NCC
        price_idx = col_map.get('supplier_price')
        supplier_price = 0.0
        if price_idx is not None and price_idx < len(row):
            supplier_price = parse_money(row[price_idx])

        # Lay so luong tu NCC (neu co cot rieng)
        qty_idx = col_map.get('quantity')
        supplier_qty = None
        if qty_idx is not None and qty_idx < len(row):
            raw_qty = row[qty_idx].strip()
            if raw_qty:
                try:
                    supplier_qty = int(float(raw_qty))
                except (ValueError, TypeError):
                    supplier_qty = None

        # === Fuzzy Match ===
        match_result = self._matcher.find_best_match(raw_name)

        if not match_result:
            self._stats['unmatched'] += 1
            self._warnings.append({
                'row': row_num,
                'supplier_name': clean_name,
                'matched_name': '(KHONG TIM THAY)',
                'supplier_price': supplier_price,
                'unit_price': 0,
                'raw_division': 0,
                'quantity': 0,
                'deviation_pct': 100,
                'match_score': 0,
                'reason': 'Khong tim thay san pham khop trong he thong',
            })
            self._stats['warnings'] += 1
            return {
                'matched_name': '',
                'supplier_name': clean_name,
                'supplier_name_raw': raw_name,
                'quantity': supplier_qty or 0,
                'unit_price': 0,
                'supplier_price': supplier_price,
                'match_score': 0,
                'confidence': 'none',
                'sku': '',
                'id': '',
                'unit': '',
                'currentStock': 0,
                'warning': 'Khong tim thay san pham khop',
            }

        matched_product, score = match_result
        self._stats['matched'] += 1

        matched_name = matched_product.get('name', '')
        unit_price = matched_product.get('price', 0)
        confidence = 'high' if score >= FUZZY_HIGH_CONF else 'medium' if score >= FUZZY_THRESHOLD else 'low'

        # === Tra cuu Don vi tinh (DVT) tu inventory_db ===
        unit = self._lookup_unit(matched_name, matched_product)

        # === Smart Quantity Calculation ===
        quantity, warning = self._calculate_quantity(
            supplier_price=supplier_price,
            unit_price=unit_price,
            supplier_qty=supplier_qty,
            row_num=row_num,
            supplier_name=clean_name,
            matched_name=matched_name,
            match_score=score,
        )

        return {
            'matched_name': matched_name,
            'supplier_name': clean_name,
            'supplier_name_raw': raw_name,
            'quantity': quantity,
            'unit_price': unit_price,
            'supplier_price': supplier_price,
            'match_score': score,
            'confidence': confidence,
            'sku': matched_product.get('sku', ''),
            'id': matched_product.get('id', ''),
            'unit': unit,
            'currentStock': matched_product.get('currentStock', 0),
            'warning': warning,
        }

    def _calculate_quantity(
        self, supplier_price: float, unit_price: float,
        supplier_qty: Optional[int], row_num: int,
        supplier_name: str, matched_name: str, match_score: int,
    ) -> Tuple[int, Optional[str]]:
        """
        Tinh so luong thong minh.

        Logic:
          1. Neu NCC co cot so luong rieng -> dung truc tiep
          2. Neu co gia NCC va gia goc -> tinh: round(Gia_NCC / Gia_Goc)
          3. Validation: neu sai lech > 10% -> canh bao

        Returns:
            (quantity, warning_message_or_None)
        """
        warning = None

        # Case 1: NCC da co cot so luong
        if supplier_qty is not None and supplier_qty > 0:
            # Neu co ca gia, cross-check
            if supplier_price > 0 and unit_price > 0:
                expected_total = supplier_qty * unit_price
                deviation = abs(supplier_price - expected_total) / expected_total if expected_total > 0 else 0
                if deviation > QTY_TOLERANCE:
                    warning = (
                        f'SL tu NCC={supplier_qty} nhung gia NCC={supplier_price:,.0f} '
                        f'!= {supplier_qty}x{unit_price:,.0f}={expected_total:,.0f} '
                        f'(chenh {deviation:.1%})'
                    )
                    self._warnings.append({
                        'row': row_num,
                        'supplier_name': supplier_name,
                        'matched_name': matched_name,
                        'supplier_price': supplier_price,
                        'unit_price': unit_price,
                        'raw_division': supplier_price / unit_price if unit_price > 0 else 0,
                        'quantity': supplier_qty,
                        'deviation_pct': deviation * 100,
                        'match_score': match_score,
                        'reason': f'SL NCC ({supplier_qty}) khong khop voi gia ({deviation:.1%} chenh lech)',
                    })
                    self._stats['warnings'] += 1
            return (supplier_qty, warning)

        # Case 2: Tinh tu gia
        if supplier_price <= 0 or unit_price <= 0:
            warning = 'Khong co gia de tinh so luong' if unit_price <= 0 else 'Gia NCC = 0'
            return (1, warning)  # Mac dinh 1 neu khong tinh duoc

        raw_qty = supplier_price / unit_price
        rounded_qty = max(1, round(raw_qty))

        # Validation: kiem tra sai lech
        deviation = abs(raw_qty - rounded_qty) / rounded_qty if rounded_qty > 0 else 0

        if deviation > QTY_TOLERANCE:
            warning = (
                f'Gia_NCC / Gia_Goc = {supplier_price:,.0f} / {unit_price:,.0f} '
                f'= {raw_qty:.2f} (lam tron: {rounded_qty}, chenh {deviation:.1%})'
            )
            self._warnings.append({
                'row': row_num,
                'supplier_name': supplier_name,
                'matched_name': matched_name,
                'supplier_price': supplier_price,
                'unit_price': unit_price,
                'raw_division': raw_qty,
                'quantity': rounded_qty,
                'deviation_pct': deviation * 100,
                'match_score': match_score,
                'reason': f'Ket qua chia khong ra so nguyen: {raw_qty:.2f} (chenh {deviation:.1%})',
            })
            self._stats['warnings'] += 1

        return (rounded_qty, warning)

    # ── Unit Lookup ─────────────────────────────────────────────────────────

    def _lookup_unit(self, matched_name: str, matched_product: Dict) -> str:
        """
        Tra cuu Don vi tinh (DVT) tu inventory_db.
        Fallback: product.unit -> default ('Hop'/'Cai') -> log Missing Unit.
        """
        # 1. Tra cuu tu inventory_db (uu tien)
        if matched_name and matched_name in self._inventory_db:
            db_entry = self._inventory_db[matched_name]
            db_unit = db_entry.get('Unit', '') if isinstance(db_entry, dict) else ''
            if db_unit:
                return db_unit

        # 2. Fallback: lay tu matched_product (data da load)
        product_unit = matched_product.get('unit', '')
        if product_unit:
            return product_unit

        # 3. Default: dua tren ten san pham
        name_lower = normalize_text(matched_name)
        # Xac dinh default unit dua tren loai san pham
        if any(kw in name_lower for kw in ['sua', 'kem', 'bot', 'nuoc', 'chai', 'lon', 'hop']):
            default_unit = 'Hộp'
        elif any(kw in name_lower for kw in ['bim', 'ta', 'mieng', 'goi', 'tui']):
            default_unit = 'Gói'
        elif any(kw in name_lower for kw in ['bo ', 'set ', 'combo']):
            default_unit = 'Bộ'
        else:
            default_unit = 'Cái'

        # Log Missing Unit warning
        self._warnings.append({
            'type': 'MISSING_UNIT',
            'row': '-',
            'supplier_name': '',
            'matched_name': matched_name,
            'default_unit': default_unit,
            'match_score': 0,
            'reason': f'Missing Unit: "{matched_name}" -> mac dinh "{default_unit}"',
        })

        return default_unit

    def set_inventory_db(self, inventory_db: Dict[str, Dict]):
        """
        Set inventory_db sau khi init.
        Format: {"ProductName": {"Price": 500000, "Unit": "Hộp"}, ...}
        """
        self._inventory_db = inventory_db

    # ── CSV Helpers ────────────────────────────────────────────────────────

    def _detect_encoding(self, filepath: str) -> str:
        with open(filepath, 'rb') as f:
            raw = f.read(4)
            if raw.startswith(b'\xef\xbb\xbf'):
                return 'utf-8-sig'
            if raw.startswith(b'\xff\xfe'):
                return 'utf-16-le'
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                f.read(1024)
            return 'utf-8'
        except UnicodeDecodeError:
            return self.encoding or 'cp1252'

    def _detect_delimiter(self, filepath: str, encoding: str) -> str:
        with open(filepath, 'r', encoding=encoding, errors='replace') as f:
            sample = f.read(4096)
        candidates = {',': 0, '\t': 0, ';': 0}
        for line in sample.split('\n')[:10]:
            for delim in candidates:
                candidates[delim] += line.count(delim)
        best = max(candidates, key=candidates.get)
        return best if candidates[best] > 0 else ','

    def _is_header_row(self, row: List[str]) -> bool:
        if not row or len(row) < 2:
            return False
        row_text = ' '.join(cell.strip().lower() for cell in row)
        row_norm = normalize_text(row_text)
        keywords = [
            'hang hoa', 'san pham', 'product', 'ten hang',
            'thong tin hang', 'gia', 'price', 'cod', 'thu ho',
            'thanh tien', 'don gia', 'so luong', 'qty',
        ]
        matches = sum(1 for kw in keywords if kw in row_norm)
        return matches >= 2

    def _map_columns(self, headers: List[str]) -> Dict[str, Optional[int]]:
        col_map = {}
        for field_name, aliases in COLUMN_ALIASES.items():
            col_map[field_name] = None
            for alias in aliases:
                alias_norm = normalize_text(alias)
                for idx, h in enumerate(headers):
                    h_norm = normalize_text(h)
                    if h_norm == alias_norm or alias_norm in h_norm:
                        col_map[field_name] = idx
                        break
                if col_map[field_name] is not None:
                    break
        return col_map

    def _load_json_products(self, filepath: str) -> List[Dict]:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and 'products' in data:
            return data['products']
        return []

    def _load_csv_products(self, filepath: str) -> List[Dict]:
        encoding = self._detect_encoding(filepath)
        delimiter = self._detect_delimiter(filepath, encoding)
        products = []
        with open(filepath, 'r', encoding=encoding, errors='replace') as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            for row in reader:
                name_keys = ['ProductName_Standard', 'name', 'Name', 'Ten hang',
                             'Ten san pham', 'Product', 'product_name']
                price_keys = ['Price_Standard', 'price', 'Price', 'Gia',
                              'Gia von', 'import_price', 'unit_price']
                name = ''
                price = 0
                for k in name_keys:
                    if k in row and row[k]:
                        name = row[k].strip()
                        break
                for k in price_keys:
                    if k in row and row[k]:
                        price = parse_money(row[k])
                        break
                if name and price > 0:
                    products.append({'name': name, 'price': price})
        return products


# ===========================================================================
#  TEST SUITE
# ===========================================================================

def test_best_stock_importer():
    """
    Test BESTStockImporter voi du lieu mau.
    Kiem chung:
      1. Fuzzy match ten san pham
      2. Tinh so luong tu gia (Gia_NCC / Gia_Goc)
      3. Canh bao khi chia khong ra so nguyen
    """
    import tempfile

    print("=" * 70)
    print("  [TEST] BEST STOCK IMPORTER - TEST SUITE")
    print("=" * 70)

    # ── 1. Danh sach san pham chuan cua shop ───────────────────────────
    standard_products = [
        {'name': 'Kem chong nang Anessa 60ml',  'price': 450000, 'sku': 'KCN001', 'unit': 'Chai'},
        {'name': 'Sua rua mat CeraVe 236ml',    'price': 280000, 'sku': 'SRM001', 'unit': 'Chai'},
        {'name': 'Bo my pham Laneige 3 mon',     'price': 500000, 'sku': 'BMP001', 'unit': 'Bo'},
        {'name': 'Son MAC Ruby Woo',             'price': 650000, 'sku': 'SON001', 'unit': 'Cay'},
        {'name': 'Nuoc hoa Chanel No.5 50ml',    'price': 3200000, 'sku': 'NH001', 'unit': 'Chai'},
    ]

    # ── 2. File CSV tu NCC (mo phong BEST Express) ─────────────────────
    supplier_csv = (
        'Thong tin hang hoa,Thanh tien,Trang thai\n'
        # Dong 1: Kem chong nang Anessa - 3 san pham (1,350,000 / 450,000 = 3)
        '"[1]|Kem chong nang Anessa 60ml",1350000,Da giao\n'
        # Dong 4: Sua rua mat CeraVe (ten hoi khac) - 2 SP (560,000 / 280,000 = 2)
        '"[1]|Sua rua mat CeraVe Foaming 236ml (KM: Tang kem sample)",560000,Da giao\n'
        # Dong 9: Bo my pham Laneige - chia khong chan (1,200,000 / 500,000 = 2.4 -> CANH BAO)
        '"[1]|Bo MP Laneige set 3 mon *****",1200000,Dang giao\n'
    )

    # ── 3. Init & Load ─────────────────────────────────────────────────
    importer = BESTStockImporter()
    count = importer.load_standard_products(standard_products)
    print(f"\n[OK] Loaded {count} standard products\n")
    assert count == 5, f"FAIL: expect 5 products, got {count}"

    # ── 4. Process ─────────────────────────────────────────────────────
    results = importer.process_csv_string(supplier_csv)
    stats = importer.get_stats()

    print(f"[OK] Processed {stats['total_rows']} rows")
    print(f"     Matched: {stats['matched']}, Unmatched: {stats['unmatched']}")
    print(f"     Warnings: {stats['warnings']}\n")

    assert len(results) == 3, f"FAIL: expect 3 results, got {len(results)}"

    # ── Test Dong 1: Match chinh xac, SL = 3 ──────────────────────────
    r1 = results[0]
    print("-" * 50)
    print("[Test] Row 1 - Exact match, qty = 3")
    print(f"   Matched:   {r1['matched_name']}")
    print(f"   Score:     {r1['match_score']}")
    print(f"   Quantity:  {r1['quantity']}")
    print(f"   Price:     {r1['supplier_price']:,.0f} / {r1['unit_price']:,.0f}")
    print(f"   Warning:   {r1.get('warning', 'None')}")

    assert r1['matched_name'] == 'Kem chong nang Anessa 60ml', f"FAIL match: {r1['matched_name']}"
    assert r1['quantity'] == 3, f"FAIL qty: {r1['quantity']}"
    assert r1['match_score'] >= FUZZY_THRESHOLD, f"FAIL score: {r1['match_score']}"
    assert r1.get('warning') is None, f"FAIL should have no warning: {r1.get('warning')}"
    print("   PASSED\n")

    # ── Test Dong 4: Fuzzy match (ten khac), SL = 2 ───────────────────
    r2 = results[1]
    print("-" * 50)
    print("[Test] Row 4 - Fuzzy match, qty = 2")
    print(f"   Supplier:  {r2['supplier_name']}")
    print(f"   Matched:   {r2['matched_name']}")
    print(f"   Score:     {r2['match_score']}")
    print(f"   Quantity:  {r2['quantity']}")
    print(f"   Price:     {r2['supplier_price']:,.0f} / {r2['unit_price']:,.0f}")

    assert r2['matched_name'] == 'Sua rua mat CeraVe 236ml', f"FAIL match: {r2['matched_name']}"
    assert r2['quantity'] == 2, f"FAIL qty: {r2['quantity']}"
    assert r2['match_score'] >= FUZZY_THRESHOLD, f"FAIL score: {r2['match_score']}"
    assert '[1]|' not in r2['supplier_name'], f"FAIL [1]| not cleaned: {r2['supplier_name']}"
    print("   PASSED\n")

    # ── Test Dong 9: Chia khong chan -> CANH BAO ──────────────────────
    r3 = results[2]
    print("-" * 50)
    print("[Test] Row 9 - Non-integer division -> WARNING")
    print(f"   Supplier:  {r3['supplier_name']}")
    print(f"   Matched:   {r3['matched_name']}")
    print(f"   Score:     {r3['match_score']}")
    print(f"   Quantity:  {r3['quantity']}")
    print(f"   Price:     {r3['supplier_price']:,.0f} / {r3['unit_price']:,.0f}")
    print(f"   Calc:      {r3['supplier_price']}/{r3['unit_price']} = {r3['supplier_price']/r3['unit_price']:.2f}")
    print(f"   Warning:   {r3.get('warning', 'None')}")

    assert r3['matched_name'] == 'Bo my pham Laneige 3 mon', f"FAIL match: {r3['matched_name']}"
    # 1,200,000 / 500,000 = 2.4 -> round = 2, deviation = |2.4-2|/2 = 20% > 10%
    assert r3['quantity'] == 2, f"FAIL qty: {r3['quantity']}"
    assert r3.get('warning') is not None, "FAIL: should have warning for non-integer division"
    assert '*****' not in r3['supplier_name'], f"FAIL ***** not cleaned: {r3['supplier_name']}"
    print("   PASSED\n")

    # ── Test Export ────────────────────────────────────────────────────
    print("-" * 50)
    print("[Test] Export JSON + Warnings")

    json_path = os.path.join(tempfile.gettempdir(), 'test_nhap_kho.json')
    warn_path = os.path.join(tempfile.gettempdir(), 'test_canh_bao.txt')

    importer.export_results(results, json_path)
    importer.export_warnings(warn_path)

    # Verify JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        exported = json.load(f)
    assert len(exported) == 3, f"FAIL: JSON has {len(exported)} items"
    assert exported[0]['So_Luong_Suy_Ra'] == 3
    assert exported[1]['So_Luong_Suy_Ra'] == 2

    # Verify Warnings
    warnings = importer.get_warnings()
    assert len(warnings) >= 1, f"FAIL: expect >= 1 warning, got {len(warnings)}"
    print(f"   JSON exported: {json_path}")
    print(f"   Warnings exported: {warn_path} ({len(warnings)} warnings)")
    print("   PASSED\n")

    # ── Test Clean Functions ──────────────────────────────────────────
    print("-" * 50)
    print("[Test] Clean Functions")

    assert clean_product_name('[1]|Hello World[1]|') == 'Hello World'
    assert clean_product_name('[1]|Product X 1 x 250,000d (KM: Free gift)') != ''
    assert '*****' not in clean_garbage('***Test*****Data')
    assert parse_money('1,500,000') == 1500000
    assert parse_money('450.000') == 450000
    print("   PASSED\n")

    # ── Summary ───────────────────────────────────────────────────────
    print("=" * 70)
    print("  ALL TESTS PASSED!")
    print(f"  Stats: {stats['matched']} matched / {stats['total_rows']} total / {stats['warnings']} warnings")
    print(f"  Fuzzy engine: {'thefuzz' if HAS_THEFUZZ else 'difflib (stdlib)'}")
    print("=" * 70)

    # Cleanup
    for p in [json_path, warn_path]:
        try:
            os.unlink(p)
        except OSError:
            pass

    return True


# ===========================================================================
#  CLI ENTRY POINT
# ===========================================================================

def main():
    """CLI: python BEST_Parser.py supplier.csv --products my_products.json"""
    import argparse

    ap = argparse.ArgumentParser(
        description='BEST Express Smart Stock Importer',
        formatter_class=argparse.RawTextHelpFormatter,
    )
    ap.add_argument('input', nargs='?', help='File CSV tu BEST Express')
    ap.add_argument('-p', '--products', help='File danh sach san pham chuan (JSON/CSV)')
    ap.add_argument('-o', '--output', default=None, help='File JSON output (default: <input>_nhap_kho.json)')
    ap.add_argument('-w', '--warnings', default='canh_bao_chenh_lech.txt', help='File canh bao')
    ap.add_argument('-e', '--encoding', default='utf-8-sig', help='Encoding (default: utf-8-sig)')
    ap.add_argument('--test', action='store_true', help='Chay test suite')
    ap.add_argument('--threshold', type=int, default=FUZZY_THRESHOLD, help=f'Fuzzy match threshold (default: {FUZZY_THRESHOLD})')

    args = ap.parse_args()

    if args.test:
        success = test_best_stock_importer()
        sys.exit(0 if success else 1)

    if not args.input:
        ap.print_help()
        print("\nTip: Chay `python BEST_Parser.py --test` de kiem tra module.")
        sys.exit(1)

    if not args.products:
        print("ERROR: Can chi dinh file san pham chuan voi --products")
        print("  Vi du: python BEST_Parser.py supplier.csv --products my_products.json")
        sys.exit(1)

    # Setup
    import BEST_Parser as _self_module
    _self_module.FUZZY_THRESHOLD = args.threshold

    importer = BESTStockImporter(encoding=args.encoding)

    # Load products
    print(f"Loading products: {args.products}")
    count = importer.load_standard_products(args.products)
    print(f"  -> {count} san pham hop le")

    # Process
    print(f"\nProcessing: {args.input}")
    results = importer.process_supplier_file(args.input)

    if not results:
        print("WARNING: Khong co du lieu hop le!")
        sys.exit(1)

    # Export
    output_path = args.output or os.path.splitext(args.input)[0] + '_nhap_kho.json'
    importer.export_results(results, output_path)
    print(f"\n[OK] Xuat {len(results)} san pham -> {output_path}")

    # Warnings
    warnings = importer.get_warnings()
    if warnings:
        warn_path = importer.export_warnings(args.warnings)
        print(f"[!!] {len(warnings)} canh bao -> {warn_path}")

    # Stats
    stats = importer.get_stats()
    print(f"\nStats:")
    print(f"  Total rows:  {stats['total_rows']}")
    print(f"  Matched:     {stats['matched']}")
    print(f"  Unmatched:   {stats['unmatched']}")
    print(f"  Warnings:    {stats['warnings']}")
    print(f"  Engine:      {'thefuzz' if HAS_THEFUZZ else 'difflib'}")


if __name__ == '__main__':
    main()
