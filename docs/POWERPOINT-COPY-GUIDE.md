# PowerPointへのテーブルコピー機能

## 📋 概要

QueryCanvasでは、クエリ結果をPowerPoint、Excel、Wordなどに簡単にコピー＆ペーストできます。

## 🎯 使い方

### 1. クエリを実行

```sql
/**
 * @column 売上 type=int align=right format=number comma=true if<0:color=red
 * @column 達成率 type=float align=right format=number decimal=1 if>=100:color=green,bold=true
 * @column 更新日 format=datetime pattern=yyyy/MM/dd
 */
SELECT 店舗名, 売上, 達成率, 更新日 FROM sales_report;
```

### 2. コピーボタンをクリック

実行結果の上部に2つのボタンが表示されます：

#### 📋 TSVコピー
- **形式**: タブ区切りテキスト
- **用途**: PowerPoint、Excel、Wordなど（基本的な貼り付け）
- **特徴**: 
  - シンプルで軽量
  - どのアプリケーションでも確実に動作
  - スタイルは保持されない（数値フォーマットなし）

#### 📋 HTMLコピー
- **形式**: HTML（スタイル付き）
- **用途**: PowerPoint、Excel、Word（リッチな貼り付け）
- **特徴**:
  - **色やフォントスタイルを保持**
  - **条件付きスタイリング（赤字・太字など）も保持**
  - 数値フォーマット（カンマ区切りなど）も保持
  - 背景色や文字色が保持される

### 3. PowerPointに貼り付け

1. PowerPointを開く
2. スライドを選択
3. `Cmd+V` (Mac) / `Ctrl+V` (Windows) で貼り付け
4. テーブルとして自動的に挿入される

## 📊 比較：TSV vs HTML

| 項目 | TSVコピー | HTMLコピー |
|------|-----------|------------|
| 互換性 | ⭐⭐⭐⭐⭐ 最高 | ⭐⭐⭐⭐ 高い |
| スタイル保持 | ❌ なし | ✅ あり |
| 色の保持 | ❌ なし | ✅ あり（条件付きスタイルも） |
| フォーマット保持 | ❌ なし | ✅ あり（カンマ、小数点など） |
| 軽量性 | ⭐⭐⭐⭐⭐ 最軽量 | ⭐⭐⭐ 普通 |
| おすすめ用途 | 基本的なデータ貼り付け | プレゼン資料作成 |

## 🎨 PowerPointでの仕上げ

HTMLコピーで貼り付けた後、PowerPointで以下の調整ができます：

1. **テーブルスタイルの適用**
   - テーブルを選択
   - 「テーブルデザイン」タブ
   - お好みのスタイルを選択

2. **列幅の調整**
   - 列の境界をドラッグして幅を調整
   - 自動調整: テーブル右クリック → 「自動調整」

3. **フォントサイズ変更**
   - テーブル全体を選択
   - フォントサイズを変更（プレゼン用に大きめに）

## 💡 実践例

### 例1: 売上レポート（シンプル）

```sql
SELECT 
    店舗名,
    売上,
    前年比
FROM sales_report
ORDER BY 売上 DESC
LIMIT 10;
```

→ **TSVコピー** → PowerPointに貼り付け → PowerPointでスタイル適用

### 例2: ダッシュボード（カラフル）

```sql
/**
 * @column 売上 type=int align=right format=number comma=true if<1000000:color=red if>=2000000:color=green,bold=true
 * @column 達成率 type=float align=right format=number decimal=1 if<80:color=red,bg=#ffe6e6 if>=100:color=green,bold=true
 * @column 順位 align=center
 */
SELECT 
    店舗名,
    売上,
    達成率,
    順位
FROM performance_dashboard
ORDER BY 順位;
```

→ **HTMLコピー** → PowerPointに貼り付け → **色・スタイルが自動で反映される**

### 例3: 在庫アラート（条件付きハイライト）

```sql
/**
 * @column 在庫数 type=int align=right if<=0:color=red,bold=true if<=10:color=orange if>100:color=green
 * @column ステータス color=#0066cc bold=true
 */
SELECT 
    商品名,
    在庫数,
    ステータス
FROM inventory
WHERE 在庫数 <= 50
ORDER BY 在庫数;
```

→ **HTMLコピー** → PowerPointに貼り付け → **在庫数に応じて自動で色分け**

## 🔧 トラブルシューティング

### Q1: HTMLコピーが上手くいかない

**症状**: HTMLコピーで貼り付けても、プレーンテキストになる

**解決策**:
1. TSVコピーを試す（より確実）
2. 別のブラウザやアプリケーションで試す
3. PowerPointのバージョンを確認（古いバージョンはHTML対応が弱い）

### Q2: 日本語が文字化けする

**症状**: コピペ後、日本語が文字化けする

**解決策**:
1. PowerPointの言語設定を確認
2. TSVコピーを使用（UTF-8で正しく処理される）
3. 貼り付け後、フォントを日本語対応フォントに変更（例: MS ゴシック、メイリオ）

### Q3: スタイルが反映されない

**症状**: HTMLコピーしてもスタイルが反映されない

**原因**: 
- ブラウザのClipboard API制限
- アプリケーションのHTML貼り付けサポート不足

**解決策**:
1. TSVコピーを使用して、PowerPoint側でスタイルを適用
2. 結果を画像としてスクリーンショット（見た目そのまま保存）

### Q4: 大量データのコピーが遅い

**症状**: 数千行のデータをコピーすると遅い

**解決策**:
1. クエリに`LIMIT`を追加（プレゼン用は通常10-50行で十分）
2. TSVコピーを使用（軽量）
3. データを保存してExcelで開く → PowerPointに貼り付け

## 📚 関連機能

### 結果の保存

コピーせず、ファイルとして保存することもできます：

```
💾 結果を保存 ボタン
→ TSV または JSON形式で保存
→ Excel で開く
→ PowerPoint に貼り付け
```

### セッションファイルからの編集

Cursor AIを使って、SQLを直接編集できます：

```
@Codebase .vscode/querycanvas-session.json のSQLに、
PowerPointで使えるように表示オプションを追加してください
```

## 🎓 ベストプラクティス

### 1. プレゼン用は行数を制限

```sql
SELECT ... FROM ... LIMIT 10;  -- プレゼンには10行程度がベスト
```

### 2. HTMLコピーで視覚的なインパクト

```sql
/**
 * @column 重要データ type=int if>threshold:color=red,bold=true
 */
```

### 3. 列名をわかりやすく

```sql
SELECT 
    store_name AS 店舗名,
    revenue AS 売上高,
    growth_rate AS 成長率
FROM ...
```

### 4. 右寄せで数値を見やすく

```sql
/**
 * @column 売上 align=right format=number comma=true
 * @column 達成率 align=right format=number decimal=1
 */
```

## 🚀 今後の予定

以下の機能を検討中です：

- ✅ TSVコピー（実装済み）
- ✅ HTMLコピー（実装済み）
- 🔜 Markdownコピー（ドキュメント用）
- 🔜 画像としてコピー（完全な見た目を保持）
- 🔜 Excelファイル直接保存

## 📖 参考

- [DISPLAY-OPTIONS-QUICK-GUIDE.md](../DISPLAY-OPTIONS-QUICK-GUIDE.md) - 表示オプションの使い方
- [README.md](../README.md) - QueryCanvas全体のガイド
- [.cursorrules](../.cursorrules) - Cursor AI連携の詳細

---

**🎉 Happy Copying!**

QueryCanvasで作ったデータを、美しいPowerPoint資料に変えましょう！

