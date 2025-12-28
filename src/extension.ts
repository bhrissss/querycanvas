import * as vscode from 'vscode';
import { DatabaseClientPanel } from './databaseClientPanel';
import { ConnectionProfileManager } from './database';

/**
 * 拡張機能がアクティベートされた時に呼ばれます
 * コマンドが最初に実行される時にアクティベートされます
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('QueryCanvas extension activated');

    // ConnectionProfileManager を初期化
    let profileManager: ConnectionProfileManager | undefined;
    try {
        profileManager = new ConnectionProfileManager(context);
        console.log('ConnectionProfileManager initialized');
    } catch (error) {
        console.warn('Failed to initialize ConnectionProfileManager:', error);
        // ワークスペースが開かれていない場合はスキップ
    }

    // QueryCanvas Database Client コマンドを登録
    const openDatabaseClientCommand = vscode.commands.registerCommand('querycanvas.open', () => {
        if (!profileManager) {
            vscode.window.showWarningMessage('Please open a workspace first');
            return;
        }
        DatabaseClientPanel.createOrShow(context.extensionUri, profileManager);
    });

    context.subscriptions.push(openDatabaseClientCommand);
}

/**
 * 拡張機能が非アクティベート（無効化）された時に呼ばれます
 */
export function deactivate() {
    console.log('QueryCanvas extension deactivated');
}

