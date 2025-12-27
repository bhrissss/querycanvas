# VS Extension 001

このプロジェクトは、Cursor/VS Code用の拡張機能のサンプルです。

## 機能

- **Hello World コマンド**: `vsex001.helloWorld` コマンドを実行すると、挨拶メッセージが表示されます

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
│   └── extension.ts       # 拡張機能のメインコード
├── out/                   # コンパイルされたJavaScriptファイル
├── .vscode/
│   ├── launch.json        # デバッグ設定
│   └── tasks.json         # ビルドタスク設定
├── package.json           # 拡張機能のマニフェスト
├── tsconfig.json          # TypeScript設定
└── README.md             # このファイル
```

## カスタマイズ

### 新しいコマンドを追加する

1. `package.json` の `contributes.commands` にコマンドを追加
2. `src/extension.ts` の `activate` 関数内でコマンドを登録

### その他の機能

VS Code拡張機能では以下のような機能も実装できます：

- **コマンド**: ユーザーが実行できるアクション
- **設定**: ユーザーがカスタマイズできる設定項目
- **キーバインド**: カスタムショートカットキー
- **メニュー項目**: コンテキストメニューやエディタメニュー
- **言語サポート**: シンタックスハイライト、補完、定義へのジャンプなど
- **テーマ**: カラーテーマやアイコンテーマ
- **ビュー**: サイドバーやパネルのカスタムビュー
- **Webview**: HTMLベースのカスタムUI

## 参考リンク

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

