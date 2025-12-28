# 行スタイリング機能ガイド

## 概要

行スタイリング機能を使用すると、特定の列の値に基づいて**行全体**にスタイル（色、背景色、太字など）を適用できます。

これにより、重要なデータを視覚的に強調したり、条件に基づいてデータを分類表示することができます。

## 基本構文

```sql
/**
 * @row <列名><演算子><値>:<スタイル>
 */
SELECT ...
```

### 重要な注意点

**❌ よくある間違い:**

```sql
-- 間違い1: ifキーワードを使っている
@row if 曜日=土:background=#eeeeff

-- 間違い2: =（単一）を使っている、クォートがない
@row 国名=フランス:bg=#ffeeee

-- 間違い3: backgroundを使っている
@row 売上>1000:background=#ccffcc
```

**✅ 正しい書き方:**

```sql
-- 正しい: ifなし、==（二重）、クォート付き、bg使用
@row 曜日=="土":bg=#eeeeff
@row 国名=="フランス":bg=#ffeeee
@row 売上>1000:bg=#ccffcc
```

### パラメータ

- **`<列名>`**: 条件を評価する対象の列名
- **`<演算子>`**: 比較演算子（`==`, `!=`, `>`, `<`, `>=`, `<=`）
- **`<値>`**: 比較する値（数値または文字列）
  - 文字列の場合: `"文字列"` または `'文字列'` でクォート
  - 数値の場合: そのまま記述（例: `1000`, `-50`, `3.14`）
- **`<スタイル>`**: 適用するスタイル（カンマ区切りで複数指定可能）
  - `color=<色>` - 文字色
  - `bg=<色>` または `backgroundColor=<色>` - 背景色
  - `bold=true` - 太字
  - `fontWeight=<値>` - フォントウェイト

## スタイルオプション

### 色の指定

- **HEX形式**: `#ff0000`, `#00ff00`, `#0000ff`
- **RGB形式**: `rgb(255, 0, 0)`, `rgba(0, 255, 0, 0.5)`
- **色名**: `red`, `green`, `blue`, `white`, `black` など

### サポートされるスタイル

| オプション | 説明 | 例 |
|-----------|------|-----|
| `color` | 文字色 | `color=#ff0000` |
| `bg` / `backgroundColor` | 背景色 | `bg=#ffeeee` |
| `bold` | 太字 | `bold=true` |
| `fontWeight` | フォントの太さ | `fontWeight=bold` |

## 使用例

### 例1: 文字列値に基づく行スタイリング

国名が「フランス」の行を赤色、「日本」の行を青色で表示：

```sql
/**
 * @row 国名=="フランス":color=#ff0000,bg=#ffeeee
 * @row 国名=="日本":color=#0000ff,bg=#eeeeff
 * @column 売上 align=right format=number comma=true
 */
SELECT 国名, 都市, 売上, 担当者
FROM sales_data;
```

### 例2: 数値に基づく行スタイリング

売上が1,000,000を超える行を緑色、マイナスの行を赤色で表示：

```sql
/**
 * @row 売上>1000000:bg=#ccffcc,bold=true
 * @row 売上<0:bg=#ffcccc,color=#ff0000
 * @column 売上 align=right format=number comma=true
 */
SELECT 店舗名, 売上, 前年比, 地域
FROM store_performance;
```

### 例3: ステータスに基づく行スタイリング

注文ステータスに応じて行全体の背景色を変更：

```sql
/**
 * @row ステータス=="完了":bg=#d4edda,color=#155724
 * @row ステータス=="保留":bg=#fff3cd,color=#856404
 * @row ステータス=="キャンセル":bg=#f8d7da,color=#721c24
 * @column 金額 align=right format=number comma=true
 */
SELECT 注文ID, ステータス, 金額, 顧客名
FROM orders;
```

### 例4: 在庫数に基づく警告表示

在庫が少ない商品を警告色で表示：

```sql
/**
 * @row 在庫数<=0:bg=#ff6b6b,color=#ffffff,bold=true
 * @row 在庫数<=10:bg=#ffd93d,color=#000000
 * @row 在庫数>100:bg=#6bcf7f,color=#ffffff
 * @column 在庫数 align=right
 * @column 単価 align=right format=number comma=true
 */
SELECT 商品名, カテゴリ, 在庫数, 単価
FROM inventory;
```

### 例5: 行スタイルと列スタイルの組み合わせ

達成率に基づいて行全体を色分けし、さらに個別の列にも条件付きスタイルを適用：

```sql
/**
 * @row 達成率>=100:bg=#e8f5e9
 * @row 達成率<80:bg=#ffebee
 * @column 売上 type=int align=right format=number comma=true if<0:color=red
 * @column 達成率 type=float align=right format=number decimal=1 if<80:color=red if>=100:color=green,bold=true
 */
SELECT 店舗名, 売上, 達成率, 前年比
FROM performance_dashboard;
```

## 比較演算子

### 数値比較

| 演算子 | 説明 | 例 |
|-------|------|-----|
| `==` | 等しい | `売上==1000000` |
| `!=` | 等しくない | `売上!=0` |
| `>` | より大きい | `売上>1000000` |
| `<` | より小さい | `売上<0` |
| `>=` | 以上 | `達成率>=100` |
| `<=` | 以下 | `在庫数<=10` |

### 文字列比較

| 演算子 | 説明 | 例 |
|-------|------|-----|
| `==` | 等しい | `国名=="日本"` |
| `!=` | 等しくない | `ステータス!="完了"` |
| `>`, `<`, `>=`, `<=` | 辞書順比較 | `顧客ランク>="Gold"` |

## 複数条件の適用

複数の`@row`ディレクティブを指定した場合、**後に記述されたルールが優先**されます：

```sql
/**
 * @row 緊急フラグ=="はい":bg=#d32f2f,color=#ffffff,bold=true
 * @row 進捗率>=100:bg=#388e3c,color=#ffffff
 * @row 進捗率<30:bg=#f57c00,color=#ffffff
 */
SELECT プロジェクト名, 進捗率, 緊急フラグ
FROM projects;
```

上記の例では、緊急フラグが「はい」の行は、進捗率に関わらず赤色で表示されます。

## 行スタイルと列スタイルの違い

### 行スタイル (`@row`)
- **対象**: 行全体（`<tr>`タグ）
- **条件**: 特定の列の値
- **用途**: データ全体を視覚的に分類

### 列スタイル (`@column`)
- **対象**: 個別のセル（`<td>`タグ）
- **条件**: そのセルの値
- **用途**: 特定の列内での条件付きスタイリング

両者を組み合わせることで、より柔軟な視覚表現が可能です。

## 実用例

### ダッシュボード風の売上レポート

```sql
/**
 * @row 売上<0:bg=#ffcdd2,color=#c62828,bold=true
 * @row 売上>=0:bg=#c8e6c9,color=#2e7d32
 * @column 収益 align=right format=number comma=true
 * @column 費用 align=right format=number comma=true
 * @column 損益 align=right format=number comma=true
 */
SELECT 部署, 収益, 費用, 損益, 四半期
FROM financial_summary
ORDER BY 損益 ASC;
```

### タスク管理（優先度別色分け）

```sql
/**
 * @row 優先度=="高":bg=#ff5252,color=#ffffff,bold=true
 * @row 優先度=="中":bg=#ffa726,color=#ffffff
 * @row 優先度=="低":bg=#42a5f5,color=#ffffff
 * @column 期限 format=datetime pattern=yyyy/MM/dd
 */
SELECT タスク名, 優先度, 担当者, 期限, ステータス
FROM task_list
ORDER BY 期限 ASC;
```

### 学生成績表（評価ランク別）

```sql
/**
 * @row 評価=="A":bg=#4caf50,color=#ffffff,bold=true
 * @row 評価=="B":bg=#8bc34a,color=#ffffff
 * @row 評価=="C":bg=#ffeb3b,color=#000000
 * @row 評価=="D":bg=#ff9800,color=#ffffff
 * @row 評価=="F":bg=#f44336,color=#ffffff,bold=true
 * @column スコア align=right
 */
SELECT 学生名, 科目, スコア, 評価
FROM student_grades
ORDER BY スコア DESC;
```

## PowerPoint/Excel へのコピー

行スタイルは **HTMLコピー** 機能を使用することで、PowerPoint、Excel、Wordに**そのまま貼り付け**できます：

1. クエリを実行
2. **📋 HTMLコピー** ボタンをクリック
3. PowerPoint/Excel/Wordに貼り付け

行全体の色やスタイルがそのまま保持されます！

## 注意事項

- クォートで囲まれた文字列値（`"フランス"`, `'日本'`）は完全一致で比較されます
- 数値は自動的に数値として解釈されます
- 複数の条件がマッチする場合、**後に記述されたルールが優先**されます
- 行スタイルと列スタイルが競合する場合、**列スタイルが優先**されます（セルレベルのスタイルが行レベルを上書き）

## トラブルシューティング

### Q: 行スタイルが適用されない

**A**: 以下を確認してください：

1. **構文チェック:**
   - ❌ `@row if 曜日=土:background=#eee` 
   - ✅ `@row 曜日=="土":bg=#eee`

2. **よくある間違い:**
   - `if` キーワードを使っている → 削除してください
   - `=`（単一）を使っている → `==`（二重）に変更
   - 文字列値にクォートがない → `"値"` または `'値'` で囲む
   - `background` を使っている → `bg` または `backgroundColor` に変更

3. **列名が正確に一致しているか**
   - SQL結果の列名と完全に一致する必要があります
   - AS句で付けた別名を使用してください

4. **値の型が正しいか**
   - 文字列: `"フランス"`, `'completed'`（クォート必須）
   - 数値: `1000`, `-50`, `3.14`（クォート不要）

### Q: 列スタイルと行スタイルの構文の違いは？

**A**: 構文が異なります！

| 機能 | 構文 | 例 |
|------|------|-----|
| **列スタイル** | `@column 列名 ... if<値:スタイル` | `@column 売上 type=int if<0:color=red` |
| **行スタイル** | `@row 列名==値:スタイル` | `@row 売上<0:bg=#ffcccc` |

**重要:** 行スタイルでは `if` キーワードは使いません！

### Q: 複数の条件が適用されてしまう

**A**: 複数の条件がマッチする場合、後に記述されたルールが優先されます。条件の順序を調整してください。

### Q: 色がPowerPointに反映されない

**A**: **📋 TSVコピー** ではなく **📋 HTMLコピー** を使用してください。TSVコピーはスタイルを含みません。

## さらに詳しく

- [条件付きスタイリング機能](./TESTING-CONDITIONAL-STYLING.md) - 列単位のスタイリング
- [PowerPointコピーガイド](./POWERPOINT-COPY-GUIDE.md) - スタイル付きコピー機能
- [サンプルSQL集](./examples/row-styling-examples.sql) - より多くの実例

