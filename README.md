# VS Extension 001 - Cursor-Integrated Database Client

A database client extension for Cursor/VS Code. Supports MySQL/PostgreSQL with AI-powered schema documentation and query management features designed for seamless integration with Cursor AI.

**日本語** | [English](#english-documentation)

## 主な機能 / Main Features

### 🗄️ データベース接続 / Database Connection
- **複数接続管理 / Multiple Connections**: 開発・ステージング・本番など、複数のデータベース接続を管理 / Manage connections for development, staging, production
- **MySQL対応 / MySQL Support**: MySQL 5.7+, 8.0+ をサポート / Supports MySQL 5.7+, 8.0+
- **PostgreSQL対応 / PostgreSQL Support**: PostgreSQL 12+ をサポート / Supports PostgreSQL 12+
- **セキュアな認証 / Secure Authentication**: パスワードはVS Code Secret Storageに安全に保存 / Passwords securely stored in VS Code Secret Storage

### 📊 SQLクエリ実行 / SQL Query Execution
- **直感的なUI / Intuitive UI**: SQL入力エリアと結果表示テーブル / SQL input area and result display table
- **実行時間計測 / Performance Measurement**: クエリのパフォーマンスを確認 / Monitor query performance
- **エラーハンドリング / Error Handling**: わかりやすいエラーメッセージ / Clear error messages

### 📋 テーブル定義の自動ドキュメント化 / Automated Schema Documentation ⭐
- テーブル構造を自動取得 / Automatically extract table structures
- Markdown形式でドキュメント生成（`db-schema/tables/`）/ Generate documentation in Markdown format
- 論理名・説明をCursor AIと会話しながら追記可能 / Add logical names and descriptions with Cursor AI
- 再取得時に追記した情報を保持 / Preserves your additions during re-extraction
- 外部キー、インデックス情報も自動抽出 / Auto-extracts foreign keys and indexes

### 💾 クエリ結果の保存 / Query Result Saving ⭐
- **TSV/JSON形式**でエクスポート / Export in TSV/JSON format
- 名前とコメント付きで管理（`query-results/`）/ Manage with names and comments
- メタデータ（実行SQL、日時、行数）を自動記録 / Automatically records metadata
- 保存したデータをCursor AIで分析可能 / Analyze saved data with Cursor AI

### 💾 保存済みクエリライブラリ / Saved Query Library ⭐
- よく使うクエリを名前付きで保存 / Save frequently-used queries with names
- タグで分類・検索 / Categorize and search with tags
- クエリ結果をキャッシュ / Cache query results
- 次回は瞬時に表示（データベース接続不要）/ Instant display next time (no database connection needed)

### 🔄 セッション永続化 / Session Persistence ⭐
- SQL入力内容を自動保存 / Auto-save SQL input
- パネルを閉じても作業を継続可能 / Continue work even after closing panel
- Cursorがセッションファイルを編集可能 / Cursor can edit session file
- リアルタイムSQL同期（Cursor ↔ UI）/ Real-time SQL sync (Cursor ↔ UI)

### 🌍 多言語対応 / Multilingual Support
- **英語 / English** (Default)
- **日本語 / Japanese**
- VS Codeの言語設定に自動対応 / Automatically adapts to VS Code language settings

## スクリーンショット

### データベースクライアントパネル
```
┌─────────────────────────────────────────┐
│ 接続: [開発DB ▼] 状態: ●接続中           │
│ [⚙️ 接続管理] [📋 テーブル定義] [📁 データ] │
├─────────────────────────────────────────┤
│ SQL入力エリア                            │
│ SELECT * FROM users;                    │
│                                         │
│ [実行 ▶]  [クリア]  [💾 結果を保存]     │
├─────────────────────────────────────────┤
│ 結果テーブル                             │
│ ┌────┬────────┬─────────┐              │
│ │ id │ name   │ email   │              │
│ ├────┼────────┼─────────┤              │
│ │ 1  │ Alice  │ a@ex.com│              │
│ │ 2  │ Bob    │ b@ex.com│              │
│ └────┴────────┴─────────┘              │
│                                         │
│ 実行時間: 0.123秒 | 行数: 2             │
└─────────────────────────────────────────┘
```

## 使い方

### 1. データベースクライアントを開く

1. コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）を開く
2. 「**Database Client: Open**」と入力して実行
3. データベースクライアントパネルが開きます

### 2. データベースに接続

1. 「⚙️ 接続管理」ボタンをクリック
2. 「+ 新しい接続を追加」
3. 接続情報を入力して保存
4. ドロップダウンから接続を選択
5. 「接続」ボタンをクリック

### 3. SQLクエリを実行

1. SQL入力エリアにクエリを入力
2. 「▶ 実行」ボタンをクリック
3. 結果がテーブルに表示されます

### 4. クエリ結果を保存

1. クエリを実行後、「💾 結果を保存」ボタンをクリック
2. 名前、コメント、保存形式（TSV/JSON）を入力
3. 「💾 保存」ボタンで `query-results/` に保存されます
4. メタデータファイルで過去の保存結果を管理可能

### 5. テーブル定義を取得

1. データベースに接続
2. 「📋 テーブル定義」ボタンをクリック
3. すべてのテーブル定義が `db-schema/tables/` にMarkdownで保存されます
4. Cursor AIと会話しながら、論理名や説明を追記
5. 再取得時にも追記した情報は保持されます

## 実装状況

### ✅ 完了
- 基本的なWebviewパネル
- データベース接続レイヤー（MySQL/PostgreSQL）
- インターフェースベースの設計
- SSL接続サポート
- **接続プロファイル管理**（追加・編集・削除）
- **パスワード管理**（Secret Storage）
- **実際のクエリ実行機能**
- **テーブル定義取得＆Markdownドキュメント生成**
- **クエリ結果の保存機能**（TSV/JSON + メタデータ）

### 📋 今後の予定
- クエリ履歴機能
- お気に入りクエリの保存
- オートコンプリート（テーブル名・カラム名）
- ER図の自動生成
- データセットの差分表示

## 開発方法

### セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. TypeScriptのコンパイル:
```bash
npm run compile
```

または、ウォッチモードで自動コンパイル:
```bash
npm run watch
```

### デバッグと実行

1. VS Code/Cursorでこのプロジェクトを開く
2. `F5` キーを押す（または「実行」→「デバッグの開始」）
3. 新しいウィンドウ（Extension Development Host）が開きます
4. コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）を開く
5. "Hello World" と入力してコマンドを実行

### プロジェクト構造

```
vsex001/
├── src/
│   ├── extension.ts                    # 拡張機能のエントリーポイント
│   ├── databaseClientPanel.ts          # Webview UIの管理
│   ├── schemaDocumentGenerator.ts      # スキーマドキュメント生成
│   ├── queryResultSaver.ts             # クエリ結果保存機能
│   └── database/                       # データベース接続レイヤー
│       ├── types.ts                    # 型定義とインターフェース
│       ├── mysqlConnection.ts          # MySQL実装
│       ├── postgresqlConnection.ts     # PostgreSQL実装
│       ├── connectionFactory.ts        # 接続ファクトリー
│       ├── connectionProfileManager.ts # プロファイル管理
│       └── index.ts
├── docs/                               # ドキュメント
│   ├── conversations/                  # 会話履歴
│   └── specifications/                 # 仕様書
├── db-schema/                          # テーブル定義（自動生成）
│   └── tables/                         # テーブルごとのMarkdown
├── query-results/                      # 保存されたクエリ結果
│   └── metadata.json                   # クエリ結果のメタデータ
├── out/                                # コンパイル済みJavaScript
├── .vscode/
│   ├── launch.json                     # デバッグ設定
│   ├── tasks.json                      # ビルドタスク設定
│   └── db-connections.json             # 接続プロファイル（gitignore）
├── package.json                        # 拡張機能のマニフェスト
├── tsconfig.json                       # TypeScript設定
├── TESTING.md                          # テスト手順
└── README.md                           # このファイル
```

## 技術スタック

- **TypeScript 5.3+**: 型安全な開発
- **VS Code Extension API**: 拡張機能の基盤
- **mysql2**: MySQL Node.jsクライアント（Promise対応）
- **pg**: PostgreSQL Node.jsクライアント
- **Webview**: カスタムUIの実装

## アーキテクチャ

### デザインパターン
- **Strategy Pattern**: データベースタイプに応じた実装の切り替え
- **Factory Pattern**: 接続インスタンスの生成
- **Interface Segregation**: 共通インターフェースで統一

### セキュリティ
- パスワードはVS Code Secret Storageに保存
- パラメータ化クエリでSQLインジェクション対策
- SSL接続のサポート

## ドキュメント

- [TESTING.md](./TESTING.md) - テスト・デバッグ手順
- [仕様書](./docs/specifications/) - 機能仕様とアーキテクチャ
- [会話履歴](./docs/conversations/) - 開発の経緯

## カスタマイズ

### 新しいデータベースタイプの追加

1. `src/database/types.ts` に新しいタイプを追加
2. `IDBConnection` インターフェースを実装した新しいクラスを作成
3. `ConnectionFactory` に新しいケースを追加

詳細は[データベース接続レイヤー仕様](./docs/specifications/database-connection-layer.md)を参照してください。

## 参考リンク

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [mysql2 Documentation](https://github.com/sidorares/node-mysql2)
- [node-postgres Documentation](https://node-postgres.com/)

## ライセンス

このプロジェクトはサンプルプロジェクトです。

## 作者

okuyama

## リポジトリ

https://github.com/okuyamashin/vsex001

