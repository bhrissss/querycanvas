# Cursor AI への指示方法

## 📚 .cursorrules ファイル

**場所:** `.cursorrules` (プロジェクトルート)

このファイルがCursor AIへの「取扱説明書」になります。

## ✅ 更新完了

PowerPointコピー機能の情報を `.cursorrules` に追加しました。

### 追加した内容

1. **TSVコピーの説明**
   - 用途、互換性、使い方

2. **HTMLコピーの説明**
   - 保持されるスタイル、用途

3. **いつ推奨するか**
   - ユーザーがどんな質問をしたときに提案すべきか

4. **実例ワークフロー**
   - プレゼン資料作成の具体例

5. **よくあるユーザープロンプト**
   - "PowerPointに貼り付けたい" → HTML Copy推奨
   - "資料を作りたい" → Display Options + HTML Copy推奨

## 🤖 Cursor AI の使い方（ユーザー向け）

### パターン1: 既存のSQLをPowerPoint用に最適化

```
@Codebase .vscode/querycanvas-session.json のSQLに、
PowerPoint用の表示オプションを追加してください。
売上は右寄せ・カンマ区切り・マイナスは赤字にしてください。
```

Cursor AIが自動的に：
```sql
/**
 * @column 売上 type=int align=right format=number comma=true if<0:color=red
 */
```
を追加してくれます。

### パターン2: ゼロから作成

```
@Codebase 売上レポートのSQLクエリを作って、
PowerPointで使えるように表示オプションも追加してください。
```

Cursor AIが：
1. SQLクエリを生成
2. 表示オプションを追加
3. `.vscode/querycanvas-session.json` に保存

### パターン3: 資料作成ワークフロー

```
@Codebase 今月の売上トップ10店舗を取得して、
PowerPointのプレゼン資料用に整形してください。
- 売上200万円超えは緑色・太字
- 100万円未満は赤字
- 日付はyyyy/MM/dd形式
```

Cursor AIが全て自動で設定してくれます。

## 📖 ドキュメント参照の仕方

Cursor AIに特定のドキュメントを読ませるには：

### 方法1: @記法で指定

```
@docs/POWERPOINT-COPY-GUIDE.md を参考に、
PowerPointコピーの使い方を教えてください
```

### 方法2: コードベース全体から検索

```
@Codebase PowerPointにコピーする方法を教えてください
```

→ Cursor AIが `.cursorrules` と関連ドキュメントを読んで回答

### 方法3: 具体的な実装を見る

```
@src/databaseClientPanel.ts のcopyTableAsHTML関数の実装を説明してください
```

## 💡 .cursorrules の効果

### Before（.cursorrules なし）
```
User: "PowerPointに貼り付けたい"
Cursor: "エクスポート機能はありますか？"
```

### After（.cursorrules あり）✨
```
User: "PowerPointに貼り付けたい"
Cursor: "HTMLコピー機能があります！
クエリ実行後に「📋 HTMLコピー」ボタンをクリックすれば、
色や太字などのスタイルを保持したままPowerPointに貼り付けできます。

表示オプションを追加すれば、さらに見栄えが良くなります：
/**
 * @column 売上 type=int align=right format=number comma=true if<0:color=red
 */
```

## 🔄 .cursorrules を更新したら

1. **Cursorを再起動**（推奨）
   - 確実に新しいルールを読み込む

2. **または、新しいチャットを開始**
   - 既存のチャットは古いルールを使っている可能性

3. **動作確認**
```
@Codebase PowerPointコピー機能について教えてください
```
→ 新しい情報を含む回答が返ってくればOK！

## 📝 .cursorrules のベストプラクティス

### ✅ Good

- **具体的な例を含める**
  ```sql
  /**
   * @column 売上 type=int if<0:color=red
   */
  ```

- **ユーザーのよくある質問を予測**
  - "PowerPointに貼り付けたい"
  - "資料を作りたい"

- **推奨事項を明示**
  - "Recommend HTML Copy when..."

- **実装の場所を記載**
  - `copyTableAsHTML()` in `databaseClientPanel.ts`

### ❌ Avoid

- 抽象的すぎる説明
- 実装の詳細すぎる記述（コードそのものは不要）
- 古い情報（常に最新に保つ）

## 🎓 学習リソース

Cursor AIが参照できるドキュメント一覧：

1. **`.cursorrules`** - プロジェクト全体のルール（最優先）
2. **`README.md`** - 機能概要
3. **`docs/POWERPOINT-COPY-GUIDE.md`** - PowerPointコピーの詳細
4. **`docs/cursor-ai-integration.md`** - Cursor AI連携の詳細
5. **`DISPLAY-OPTIONS-QUICK-GUIDE.md`** - 表示オプションのクイックリファレンス
6. **`CHANGELOG.md`** - 変更履歴

## 🚀 高度な使い方

### プロジェクト固有の言葉を教える

`.cursorrules` に専門用語の定義を追加：

```markdown
## Terminology

- **Display Options**: SQL comments that control result formatting
- **Session File**: `.vscode/querycanvas-session.json` - stores current query
- **Conditional Styling**: Dynamic cell styling based on value (e.g., `if<0:color=red`)
- **HTML Copy**: Clipboard copy that preserves styles for PowerPoint/Excel
```

### ワークフローを教える

```markdown
## Typical Workflow

1. User connects to database
2. User writes/generates SQL query
3. User adds display options for formatting
4. User executes query
5. User clicks "📋 HTMLコピー"
6. User pastes in PowerPoint
7. Beautiful report completed!
```

これで、Cursor AIがプロジェクトの全体像を理解して、的確な提案ができるようになります。

## ✨ まとめ

**Cursor AIに教える = `.cursorrules` を書く**

- 新機能を追加したら `.cursorrules` を更新
- 具体例とユースケースを含める
- ユーザーの質問パターンを予測
- ドキュメントへのリンクを記載

これで、Cursor AIがあなたのプロジェクトの「エキスパート」になります！🎉

