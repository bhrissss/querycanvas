import * as vscode from 'vscode';

/**
 * 拡張機能がアクティベートされた時に呼ばれます
 * コマンドが最初に実行される時にアクティベートされます
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('拡張機能 "vsex001" がアクティベートされました');

    // コマンドを登録
    const disposable = vscode.commands.registerCommand('vsex001.helloWorld', () => {
        // ユーザーに情報メッセージを表示
        vscode.window.showInformationMessage('Hello World from VS Extension 001! 👋');
    });

    context.subscriptions.push(disposable);
}

/**
 * 拡張機能が非アクティベート（無効化）された時に呼ばれます
 */
export function deactivate() {
    console.log('拡張機能 "vsex001" が非アクティベートされました');
}

