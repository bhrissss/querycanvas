# 条件付きスタイリング機能 - テストガイド

## テスト環境のセットアップ

### 1. 拡張機能のビルド
```bash
npm run compile
```

### 2. 拡張機能の起動
1. VS Code/Cursorで本プロジェクトを開く
2. `F5` キーを押してデバッグ実行
3. 新しいウィンドウ（Extension Development Host）が開く

### 3. QueryCanvasを起動
1. 新しいウィンドウでコマンドパレットを開く（`Cmd+Shift+P` または `Ctrl+Shift+P`）
2. 「QueryCanvas: Open Database Client」を実行

## テストケース

### テスト1: 基本的な条件スタイル（マイナス値を赤字）

**SQL:**
```sql
/**
 * @column 利益 type=int align=right format=number comma=true if<0:color=red
 */
SELECT '営業部' AS 部門, 500000 AS 利益
UNION ALL SELECT '開発部', -200000
UNION ALL SELECT '管理部', 150000;
```

**期待される結果:**
- 「開発部」の利益（-200,000）が**赤字**で表示される
- 他の行は通常の色で表示される
- すべての金額がカンマ区切りで表示される

---

### テスト2: 複数条件（在庫アラート）

**SQL:**
```sql
/**
 * @column 在庫数 type=int align=right if<=0:color=red,bold=true if<=10:color=orange if>100:color=green
 */
SELECT 'ノートPC' AS 商品名, 0 AS 在庫数
UNION ALL SELECT 'マウス', 5
UNION ALL SELECT 'キーボード', 15
UNION ALL SELECT 'モニター', 150;
```

**期待される結果:**
- 在庫0（ノートPC）: **赤字+太字**
- 在庫5（マウス）: **橙色**
- 在庫15（キーボード）: 通常色
- 在庫150（モニター）: **緑色**

---

### テスト3: 背景色の変更（KPI達成率）

**SQL:**
```sql
/**
 * @column 達成率 type=float align=right format=number decimal=1 if<80:color=red,bg=#ffe6e6 if>=100:color=green,bold=true if>=120:color=blue,bg=#e6f3ff,bold=true
 */
SELECT '田中' AS 営業担当, 125.0 AS 達成率
UNION ALL SELECT '佐藤', 105.0
UNION ALL SELECT '鈴木', 85.0
UNION ALL SELECT '高橋', 65.0;
```

**期待される結果:**
- 125.0%（田中）: **青字+青背景+太字**
- 105.0%（佐藤）: **緑字+太字**
- 85.0%（鈴木）: 通常色
- 65.0%（高橋）: **赤字+ピンク背景**

---

### テスト4: 等値条件（ステータスコード）

**SQL:**
```sql
/**
 * @column コード type=int align=right if==200:color=green if!=200:color=red,bold=true
 */
SELECT 200 AS コード, '成功' AS メッセージ
UNION ALL SELECT 404, 'Not Found'
UNION ALL SELECT 500, 'Server Error'
UNION ALL SELECT 200, 'OK';
```

**期待される結果:**
- コード200: **緑色**
- コード404, 500: **赤字+太字**

---

### テスト5: 実践的な例（株価変動）

**SQL:**
```sql
/**
 * @column 銘柄コード width=100px
 * @column 現在値 type=int align=right format=number comma=true
 * @column 前日比 type=int align=right format=number comma=true if<0:color=red,bold=true if>0:color=green,bold=true if==0:color=#999999
 * @column 変動率 type=float align=right format=number decimal=2 if<0:color=red if>0:color=green if==0:color=#999999
 */
SELECT '1001' AS 銘柄コード, 'ABC株式会社' AS 銘柄名, 2500 AS 現在値, 150 AS 前日比, 6.38 AS 変動率
UNION ALL SELECT '1002', 'XYZ商事', 1800, -50, -2.70
UNION ALL SELECT '1003', 'DEF製作所', 3200, 0, 0.00;
```

**期待される結果:**
- 前日比+150: **緑色+太字**
- 前日比-50: **赤色+太字**
- 前日比0: **グレー**
- 変動率も同様に色分け

---

## 自動テスト用のサンプルデータ

`docs/examples/conditional-styling-examples.sql` には8つの実践的なテストケースが含まれています：

1. 損益レポート
2. 在庫アラート
3. KPI達成率
4. 温度監視
5. 株価変動
6. 試験結果
7. 経費精算
8. 商品レビュー評価

これらをそのまま実行してテストできます。

## トラブルシューティング

### スタイルが適用されない

**チェックポイント:**
1. `type=int` や `type=float` などの型指定があるか確認
2. カラム名がSQLのSELECT句と完全一致しているか確認
3. 演算子の記号が正しいか確認（`<`, `>`, `<=`, `>=`, `==`, `!=`）
4. コンパイルが正常に完了しているか確認（`npm run compile`）

### 条件が正しく評価されない

**確認事項:**
1. 値が数値として解釈できるか確認
2. 複数条件の場合、後の条件が優先されることを理解
3. `==` と `=` を間違えていないか（`==` が正しい）

### 色が表示されない

**確認事項:**
1. 色コードが正しいか（16進数: `#ff0000`, 色名: `red`）
2. VS Code Webviewのセキュリティ制限に抵触していないか

## パフォーマンステスト

### 大量データでのテスト

```sql
/**
 * @column id type=int align=right
 * @column value type=int align=right if<0:color=red if>1000:color=green,bold=true
 */
SELECT 1 AS id, -500 AS value
UNION ALL SELECT 2, 1500
UNION ALL SELECT 3, 500
-- ... 繰り返し
```

大量のデータ（1000行以上）でパフォーマンスを確認します。

## 次のステップ

テストが成功したら、以下を実施：

1. ✅ mainブランチにマージ
2. ✅ バージョン番号を更新（`package.json`）
3. ✅ CHANGELOGの作成
4. ✅ VSIXファイルの再ビルド
5. ✅ マーケットプレイスへの更新

## レポート

テスト結果を以下の形式で記録：

```markdown
## テスト実行日時
2025-12-28

## テスト環境
- OS: macOS/Windows/Linux
- VS Code Version: x.x.x
- Extension Version: 0.1.1

## テスト結果
- [ ] テスト1: 基本的な条件スタイル - 成功/失敗
- [ ] テスト2: 複数条件 - 成功/失敗
- [ ] テスト3: 背景色の変更 - 成功/失敗
- [ ] テスト4: 等値条件 - 成功/失敗
- [ ] テスト5: 実践的な例 - 成功/失敗

## 備考
（気づいた点や改善提案など）
```

