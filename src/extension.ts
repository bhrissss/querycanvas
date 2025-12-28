import * as vscode from 'vscode';
import { DatabaseClientPanel } from './databaseClientPanel';

/**
 * 拡張機能がアクティベートされた時に呼ばれます
 * コマンドが最初に実行される時にアクティベートされます
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('拡張機能 "vsex001" がアクティベートされました');

    // Hello World コマンドを登録
    const helloWorldCommand = vscode.commands.registerCommand('vsex001.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from VS Extension 001! 👋');
    });

    // Database Client コマンドを登録
    const openDatabaseClientCommand = vscode.commands.registerCommand('vsex001.openDatabaseClient', () => {
        DatabaseClientPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(helloWorldCommand);
    context.subscriptions.push(openDatabaseClientCommand);
}

/**
 * 拡張機能が非アクティベート（無効化）された時に呼ばれます
 */
export function deactivate() {
    console.log('拡張機能 "vsex001" が非アクティベートされました');
}

