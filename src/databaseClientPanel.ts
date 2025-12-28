import * as vscode from 'vscode';
import { ConnectionProfileManager } from './database';

/**
 * データベースクライアントのWebviewパネルを管理するクラス
 */
export class DatabaseClientPanel {
    public static currentPanel: DatabaseClientPanel | undefined;
    private static readonly viewType = 'databaseClient';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _profileManager: ConnectionProfileManager;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, profileManager: ConnectionProfileManager) {
        this._panel = panel;
        this._profileManager = profileManager;

        // パネルのコンテンツを設定
        this._panel.webview.html = this._getHtmlContent();

        // パネルが閉じられたときのクリーンアップ
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Webviewからのメッセージを処理
        this._panel.webview.onDidReceiveMessage(
            message => {
                this._handleMessage(message);
            },
            null,
            this._disposables
        );
    }

    /**
     * データベースクライアントパネルを表示または作成
     */
    public static createOrShow(extensionUri: vscode.Uri, profileManager: ConnectionProfileManager) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // パネルが既に存在する場合は表示
        if (DatabaseClientPanel.currentPanel) {
            DatabaseClientPanel.currentPanel._panel.reveal(column);
            return;
        }

        // 新しいパネルを作成
        const panel = vscode.window.createWebviewPanel(
            DatabaseClientPanel.viewType,
            'Database Client',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        DatabaseClientPanel.currentPanel = new DatabaseClientPanel(panel, extensionUri, profileManager);
    }

    /**
     * Webviewにメッセージを送信
     */
    public sendMessage(message: any) {
        this._panel.webview.postMessage(message);
    }

    /**
     * パネルを破棄
     */
    public dispose() {
        DatabaseClientPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Webviewからのメッセージを処理
     */
    private _handleMessage(message: any) {
        switch (message.type) {
            case 'getProfiles':
                this._handleGetProfiles();
                break;
            case 'testConnection':
                this._handleTestConnection(message.data);
                break;
            case 'executeQuery':
                this._handleExecuteQuery(message.data);
                break;
            case 'info':
                vscode.window.showInformationMessage(message.text);
                break;
            case 'error':
                vscode.window.showErrorMessage(message.text);
                break;
        }
    }

    /**
     * 接続プロファイル一覧を取得
     */
    private _handleGetProfiles() {
        const profiles = this._profileManager.getAllProfiles();
        const activeId = this._profileManager.getActiveConnectionId();
        
        this.sendMessage({
            type: 'profilesList',
            profiles,
            activeId
        });
    }

    /**
     * 接続テストを処理
     */
    private async _handleTestConnection(data: any) {
        // TODO: 実際の接続テストを実装
        vscode.window.showInformationMessage(`接続テスト: ${data.host}:${data.port}`);
        this.sendMessage({
            type: 'connectionTestResult',
            success: true,
            message: '接続テストは成功しました'
        });
    }

    /**
     * クエリ実行を処理
     */
    private async _handleExecuteQuery(data: any) {
        // TODO: 実際のクエリ実行を実装
        vscode.window.showInformationMessage(`クエリ実行: ${data.query}`);
        this.sendMessage({
            type: 'queryResult',
            success: true,
            columns: ['id', 'name', 'email'],
            rows: [
                { id: 1, name: 'Alice', email: 'alice@example.com' },
                { id: 2, name: 'Bob', email: 'bob@example.com' }
            ],
            rowCount: 2,
            executionTime: 0.123
        });
    }

    /**
     * WebviewのHTMLコンテンツを生成
     */
    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Client</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }

        .header {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .connection-status {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: var(--vscode-testing-iconFailed);
        }

        .connection-status.connected {
            background-color: var(--vscode-testing-iconPassed);
        }

        .section {
            margin-bottom: 20px;
        }

        .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }

        textarea {
            width: 100%;
            min-height: 120px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            resize: vertical;
        }

        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        button {
            padding: 6px 14px;
            font-size: 13px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .result-container {
            margin-top: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        th, td {
            padding: 8px;
            text-align: left;
            border: 1px solid var(--vscode-panel-border);
        }

        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
        }

        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .result-info {
            margin-top: 10px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 3px;
        }

        .message.success {
            background-color: var(--vscode-testing-iconPassed);
            color: white;
        }

        .message.error {
            background-color: var(--vscode-testing-iconFailed);
            color: white;
        }

        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="connection-status" id="connectionStatus"></span>
        <span id="connectionText">未接続</span>
        <button onclick="openConnectionManager()">⚙️ 接続管理</button>
        <button onclick="getTableSchema()">📋 テーブル定義</button>
        <button onclick="openDataManager()">📁 データ管理</button>
    </div>

    <div class="section">
        <div class="section-title">SQL入力</div>
        <textarea id="sqlInput" placeholder="SELECT * FROM users;"></textarea>
        <div class="button-group">
            <button onclick="executeQuery()">▶ 実行</button>
            <button class="secondary" onclick="clearSQL()">クリア</button>
            <button class="secondary" onclick="saveResult()">💾 結果を保存</button>
        </div>
    </div>

    <div id="messageContainer"></div>

    <div class="result-container">
        <div class="section-title">実行結果</div>
        <div id="resultTable"></div>
        <div class="result-info" id="resultInfo"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // メッセージを受信
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'connectionTestResult':
                    handleConnectionTestResult(message);
                    break;
                case 'queryResult':
                    handleQueryResult(message);
                    break;
            }
        });

        function executeQuery() {
            const query = document.getElementById('sqlInput').value.trim();
            if (!query) {
                showMessage('SQLクエリを入力してください', 'error');
                return;
            }

            vscode.postMessage({
                type: 'executeQuery',
                data: { query }
            });
        }

        function clearSQL() {
            document.getElementById('sqlInput').value = '';
        }

        function saveResult() {
            showMessage('結果保存機能は実装中です', 'info');
        }

        function openConnectionManager() {
            showMessage('接続管理機能は実装中です', 'info');
        }

        function getTableSchema() {
            showMessage('テーブル定義取得機能は実装中です', 'info');
        }

        function openDataManager() {
            showMessage('データ管理機能は実装中です', 'info');
        }

        function handleQueryResult(message) {
            if (!message.success) {
                showMessage(message.error || 'クエリの実行に失敗しました', 'error');
                return;
            }

            // テーブルを生成
            const { columns, rows, rowCount, executionTime } = message;
            let html = '<table><thead><tr>';
            
            columns.forEach(col => {
                html += \`<th>\${col}</th>\`;
            });
            html += '</tr></thead><tbody>';

            rows.forEach(row => {
                html += '<tr>';
                columns.forEach(col => {
                    const value = row[col];
                    html += \`<td>\${value !== null && value !== undefined ? value : '<NULL>'}</td>\`;
                });
                html += '</tr>';
            });

            html += '</tbody></table>';
            
            document.getElementById('resultTable').innerHTML = html;
            document.getElementById('resultInfo').textContent = 
                \`実行時間: \${executionTime.toFixed(3)}秒 | 行数: \${rowCount}\`;
            
            showMessage('クエリが正常に実行されました', 'success');
        }

        function handleConnectionTestResult(message) {
            if (message.success) {
                showMessage(message.message, 'success');
            } else {
                showMessage(message.error || '接続テストに失敗しました', 'error');
            }
        }

        function showMessage(text, type) {
            const container = document.getElementById('messageContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}\`;
            messageDiv.textContent = text;
            container.appendChild(messageDiv);

            setTimeout(() => {
                messageDiv.remove();
            }, 3000);
        }
    </script>
</body>
</html>`;
    }
}

