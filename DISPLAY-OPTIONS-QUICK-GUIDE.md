# QueryCanvas 表示オプション クイックガイド

## 🎨 SQLコメントで結果表示をカスタマイズ

QueryCanvasでは、SQLクエリに`/** @column ... */`コメントを追加するだけで、結果テーブルの見た目を自由にカスタマイズできます。

## 基本的な使い方

```sql
/**
 * @column <カラム名> <オプション>=<値> <オプション>=<値> ...
 */
SELECT カラム名, ... FROM テーブル名;
```

## よく使うオプション一覧

### 1. テキストの配置
```sql
@column 商品名 align=left       -- 左寄せ
@column 金額 align=right      -- 右寄せ（数値に推奨）
@column タイトル align=center   -- 中央揃え
```

### 2. 数値のフォーマット
```sql
-- カンマ区切り: 1234567 → 1,234,567
@column 売上 format=number comma=true

-- 小数点以下の桁数指定: 123.456 → 123.46
@column 価格 format=number decimal=2

-- 組み合わせ: 1234567.89 → 1,234,567.89
@column 金額 align=right format=number comma=true decimal=2
```

### 3. 日時のフォーマット
```sql
-- 日付のみ: 2025-12-28T14:30:00 → 2025/12/28
@column 登録日 format=datetime pattern=yyyy/MM/dd

-- 日時: 2025-12-28T14:30:00 → 2025/12/28 14:30
@column 更新日時 format=datetime pattern=yyyy/MM/dd_HH:mm

-- スペース含む場合はダブルクォートで囲む: 2025-12-28T14:30:00 → 2025-12-28 14:30:00
@column 作成日時 format=datetime pattern="yyyy-MM-dd HH:mm:ss"
```

### 4. 色とスタイル
```sql
-- 文字色
@column ステータス color=#ff0000

-- 背景色
@column 警告 bg=#ffff00

-- 太字
@column 重要 bold=true

-- 列幅
@column 説明 width=300px
```

### 5. 🆕 条件付きスタイル（値に応じて自動で色を変える）
```sql
-- マイナスを赤字で表示
@column 損益 type=int if<0:color=red

-- 1000超えを太字で表示
@column 売上 type=int if>1000:bold=true

-- 複数条件（在庫が0なら赤、10以下なら橙、100超なら緑）
@column 在庫数 type=int if<=0:color=red,bold=true if<=10:color=orange if>100:color=green

-- 背景色も変更可能
@column 達成率 type=float if<80:color=red,bg=#ffe6e6 if>=100:color=green,bold=true
```

**条件演算子:** `<`, `>`, `<=`, `>=`, `==`, `!=`

### 6. 🆕 行スタイル（行全体に色を付ける）

**重要**: 行スタイルは列スタイルとは構文が異なります！

```sql
-- ✅ 正しい構文（ifキーワードは不要、==を使う、クォート必須）
@row 国名=="フランス":color=#ff0000,bg=#ffeeee
@row 売上>1000000:bg=#ccffcc,bold=true
@row ステータス=="完了":bg=#d4edda,color=#155724
@row 在庫数<=0:bg=#ff6b6b,color=#ffffff,bold=true

-- ❌ よくある間違い
@row if 曜日=土:background=#eeeeff  -- ifは不要、=ではなく==、backgroundではなくbg
@row 国名=フランス:bg=#ffeeee      -- 文字列はクォートで囲む必要がある
```

**ポイント:**
- `@row` は**行全体**のスタイルを変更
- `@column` は**個別のセル**のスタイルを変更
- 行スタイルでは `if` キーワードは**使わない**
- 等号は `==`（二重）を使用、`=`（単一）ではない
- 文字列値は必ず `"値"` または `'値'` でクォート
- スタイル名: `bg` または `backgroundColor`（`background`ではない）
- 両方を組み合わせることで、より柔軟な表現が可能

## 実践例

### 例1: 売上レポート
```sql
/**
 * @column 店舗名 width=150px
 * @column 売上 align=right format=number comma=true
 * @column 前年比 align=right format=number decimal=1
 * @column 更新日時 format=datetime pattern=yyyy/MM/dd_HH:mm
 */
SELECT 店舗名, 売上, 前年比, 更新日時 FROM sales_report;
```

### 例2: 損益計算（条件付きスタイル）
```sql
/**
 * @column 部門 width=120px
 * @column 利益 type=int align=right format=number comma=true if<0:color=red,bold=true if>1000000:color=blue,bold=true
 */
SELECT 部門, 利益 FROM department_profit;
```

### 例3: 在庫アラート（段階的な警告表示）
```sql
/**
 * @column 商品名 width=200px
 * @column 在庫数 type=int align=right if<=0:color=red,bold=true if<=10:color=orange if>100:color=green
 */
SELECT 商品名, 在庫数 FROM inventory;
```

### 例4: 行スタイルで国別に色分け
```sql
/**
 * @row 国名=="フランス":color=#ff0000,bg=#ffeeee
 * @row 国名=="日本":color=#0000ff,bg=#eeeeff
 * @column 売上 align=right format=number comma=true
 */
SELECT 国名, 都市, 売上, 担当者 FROM sales_data;
```

### 例5: 行と列のスタイルを組み合わせ
```sql
/**
 * @row 達成率>=100:bg=#e8f5e9
 * @row 達成率<80:bg=#ffebee
 * @column 売上 type=int align=right format=number comma=true if<0:color=red
 * @column 達成率 type=float align=right format=number decimal=1 if<80:color=red if>=100:color=green,bold=true
 */
SELECT 店舗名, 売上, 達成率, 前年比 FROM performance_dashboard;
```

## 💡 Cursor AIとの連携

### セッションファイル経由でSQLを編集
QueryCanvasは`.vscode/querycanvas-session.json`にSQLを保存しています。

Cursorに以下のように頼めます：
```
.vscode/querycanvas-session.jsonのSQLに、
amountカラムを右寄せ・カンマ区切り・マイナスを赤字にする
表示オプションを追加してください
```

Cursorが自動的に以下のようなコメントを追加してくれます：
```sql
/**
 * @column amount type=int align=right format=number comma=true if<0:color=red
 */
```

## 詳細ドキュメント

もっと詳しく知りたい場合は：
- **完全な仕様書**: `docs/specifications/display-options.md`
- **サンプルSQL集**: 
  - 列スタイル: `docs/examples/conditional-styling-examples.sql`
  - 行スタイル: `docs/examples/row-styling-examples.sql`
- **行スタイリングガイド**: `docs/ROW-STYLING-GUIDE.md` 🆕
- **Cursor AI連携ガイド**: `.cursorrules` の "SQL Display Options Feature" セクション
- **実装記録**: `docs/conversations/2025-12-28_条件付きスタイリング実装.md`

## チートシート

| 目的 | 書き方 | 例 |
|------|--------|-----|
| 右寄せ | `align=right` | `@column 金額 align=right` |
| カンマ区切り | `format=number comma=true` | `@column 売上 format=number comma=true` |
| 小数2桁 | `decimal=2` | `@column 価格 decimal=2` |
| 日付表示 | `format=datetime pattern=yyyy/MM/dd` | `@column 日付 format=datetime pattern=yyyy/MM/dd` |
| 赤字 | `color=red` | `@column エラー color=red` |
| 太字 | `bold=true` | `@column 重要 bold=true` |
| マイナスを赤字（列） | `type=int if<0:color=red` | `@column 損益 type=int if<0:color=red` |
| 条件で背景色（列） | `if>=100:bg=#e6f3ff` | `@column 達成率 type=float if>=100:bg=#e6f3ff` |
| 🆕 行全体を色分け | `@row 列名=="値":bg=色` | `@row 曜日=="土":bg=#eeeeff` |
| 🆕 行を条件で強調 | `@row 列名>値:bg=色,bold=true` | `@row 売上>1000000:bg=#ccffcc,bold=true` |

### ⚠️ 重要な違い

| 機能 | ifの使用 | 等号 | 例 |
|------|---------|------|-----|
| **列の条件スタイル** | ✅ `if`を使う | 単一でOK | `@column 売上 type=int if<0:color=red` |
| **行スタイル** | ❌ `if`不要 | `==`（二重） | `@row 曜日=="土":bg=#eee` |

---

**このファイルをCursorに読んでもらうには:**
```
@DISPLAY-OPTIONS-QUICK-GUIDE.md を見て、表示オプションの使い方を教えてください
```

