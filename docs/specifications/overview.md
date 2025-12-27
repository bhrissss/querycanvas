# プロジェクト概要

## プロジェクト名

**vsex001** - VS Extension Example 001

## 概要

Cursor/VS Code用の拡張機能のサンプルプロジェクトです。

## プロジェクトの目的

- VS Code Extension APIの学習
- TypeScriptを使った拡張機能開発の実践
- 実用的な拡張機能の作成

## 技術スタック

- **言語**: TypeScript 5.3+
- **ランタイム**: Node.js 20.x
- **フレームワーク**: VS Code Extension API
- **最小サポートバージョン**: VS Code 1.85.0

## プロジェクト構造

```
vsex001/
├── src/                    # ソースコード
│   └── extension.ts       # メインエントリーポイント
├── out/                   # コンパイル済みJavaScript
├── docs/                  # ドキュメント
│   ├── conversations/     # 会話履歴
│   └── specifications/    # 仕様書
├── .vscode/              # VS Code設定
│   ├── launch.json       # デバッグ設定
│   └── tasks.json        # タスク設定
├── package.json          # プロジェクトマニフェスト
├── tsconfig.json         # TypeScript設定
└── README.md            # プロジェクトREADME
```

## 現在実装されている機能

### コマンド

- **vsex001.helloWorld**: 挨拶メッセージを表示するサンプルコマンド

## 今後の拡張案

（ここに今後実装したい機能を追加していきます）

- [ ] 機能1
- [ ] 機能2
- [ ] 機能3

## 開発ワークフロー

1. 仕様の作成（`docs/specifications/`）
2. 実装
3. テスト（F5キーでデバッグ実行）
4. ドキュメント更新

## 参考リンク

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

