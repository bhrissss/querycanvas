import * as vscode from 'vscode';
import { DatabaseClientPanel } from './databaseClientPanel';
import { ConnectionProfileManager } from './database';

/**
 * 拡張機能がアクティベートされた時に呼ばれます
 * コマンドが最初に実行される時にアクティベートされます
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('拡張機能 "vsex001" がアクティベートされました');

    // ConnectionProfileManager を初期化
    let profileManager: ConnectionProfileManager | undefined;
    try {
        profileManager = new ConnectionProfileManager(context);
        console.log('ConnectionProfileManager を初期化しました');
    } catch (error) {
        console.warn('ConnectionProfileManager の初期化に失敗しました:', error);
        // ワークスペースが開かれていない場合はスキップ
    }

    // Hello World コマンドを登録
    const helloWorldCommand = vscode.commands.registerCommand('vsex001.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from VS Extension 001! 👋');
    });

    // Database Client コマンドを登録
    const openDatabaseClientCommand = vscode.commands.registerCommand('vsex001.openDatabaseClient', () => {
        if (!profileManager) {
            vscode.window.showWarningMessage('ワークスペースを開いてから使用してください');
            return;
        }
        DatabaseClientPanel.createOrShow(context.extensionUri, profileManager);
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

