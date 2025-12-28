# Cursor AIへの教え方 - クイックリファレンス

## 📌 答え：`.cursorrules` ファイルを編集する

**場所:** プロジェクトルートの `.cursorrules` ファイル

このファイルがCursor AIへの「取扱説明書」になります。

---

## ✅ 今回やったこと

PowerPointコピー機能をCursor AIに教えました：

### 1. `.cursorrules` に追加した情報

```markdown
## 📋 Clipboard Copy to PowerPoint/Excel/Word Feature 🆕

- TSV Copy の説明
- HTML Copy の説明
- いつ推奨するか
- 実例ワークフロー
- ユーザープロンプト例
```

### 2. 追加した内容の例

```markdown
### User Prompts You Might See

- "PowerPointに貼り付けられる形式でコピーしたい"
  → Suggest HTML Copy for styled output
  
- "プレゼン資料を作りたい"
  → Suggest adding display options + conditional styling + HTML Copy
```

---

## 🎯 Cursor AIの使い方（実践編）

### これができるようになります：

```
You: @Codebase PowerPointに貼り付けたいです

Cursor AI: HTMLコピー機能があります！
クエリ実行後に「📋 HTMLコピー」ボタンをクリックすれば、
色や太字を保持したままPowerPointに貼り付けできます。

表示オプションを追加すれば見栄えが良くなります：
/**
 * @column 売上 type=int align=right format=number comma=true if<0:color=red
 */
```

### 具体的なプロンプト例

#### パターン1: SQL生成 + 表示オプション
```
@Codebase 売上トップ10のSQLを作って、
PowerPoint用に表示オプションも追加してください
```

#### パターン2: 既存SQLの最適化
```
@Codebase .vscode/querycanvas-session.json のSQLに、
PowerPoint用の表示オプションを追加してください
```

#### パターン3: 資料作成ワークフロー
```
@Codebase 月次レポート用のクエリを作って、
PowerPointで見栄えよく表示できるようにしてください
```

---

## 📚 ドキュメント構成

Cursor AIが参照できるファイル：

| ファイル | 役割 | 優先度 |
|---------|------|--------|
| `.cursorrules` | プロジェクト全体のルール | ⭐⭐⭐⭐⭐ |
| `README.md` | 機能概要 | ⭐⭐⭐⭐ |
| `docs/POWERPOINT-COPY-GUIDE.md` | PowerPointコピーの詳細 | ⭐⭐⭐ |
| `docs/HOW-TO-TEACH-CURSOR.md` | この使い方ガイド | ⭐⭐⭐ |
| `DISPLAY-OPTIONS-QUICK-GUIDE.md` | 表示オプション | ⭐⭐⭐ |

---

## 🔄 更新したら

1. **Cursorを再起動**（推奨）
2. または、新しいチャットを開始
3. 動作確認：
   ```
   @Codebase PowerPointコピー機能について教えて
   ```

---

## 💡 重要ポイント

### ✅ .cursorrules に書くべきこと

- ✅ 新機能の説明（TSV/HTML Copy）
- ✅ いつ推奨するか（PowerPoint、資料作成時）
- ✅ 具体的な例（SQLコード付き）
- ✅ ユーザープロンプト例
- ✅ 実装の場所（`copyTableAsHTML()` など）

### ❌ 書かなくていいこと

- ❌ 実装コードそのもの
- ❌ 詳細すぎる内部仕様
- ❌ バグ情報

---

## 🎉 完了！

これで、Cursor AIが以下を理解しています：

1. ✅ PowerPointコピー機能の存在
2. ✅ TSVとHTMLの違い
3. ✅ いつどちらを推奨するか
4. ✅ 表示オプションとの組み合わせ方
5. ✅ 実際のユースケース

次回から、Cursor AIに「PowerPointに貼り付けたい」と言えば、
適切な提案をしてくれます！🚀

---

**詳細は:** `docs/HOW-TO-TEACH-CURSOR.md` を参照

