import * as vscode from 'vscode';
import { ConnectionProfileManager, IDBConnection, ConnectionFactory } from './database';

/**
 * データベースクライアントのWebviewパネルを管理するクラス
 */
export class DatabaseClientPanel {
    public static currentPanel: DatabaseClientPanel | undefined;
    private static readonly viewType = 'databaseClient';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _profileManager: ConnectionProfileManager;
    private _disposables: vscode.Disposable[] = [];
    private _currentConnection: IDBConnection | null = null;

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

        // 接続を切断
        if (this._currentConnection) {
            this._currentConnection.disconnect().catch(err => {
                console.error('接続の切断に失敗しました:', err);
            });
        }

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
            case 'connect':
                this._handleConnect(message.data);
                break;
            case 'disconnect':
                this._handleDisconnect();
                break;
            case 'changePassword':
                this._handleChangePassword(message.data);
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
     * データベースに接続
     */
    private async _handleConnect(data: { profileId: string }) {
        try {
            // 既存の接続があれば切断
            if (this._currentConnection) {
                await this._currentConnection.disconnect();
                this._currentConnection = null;
            }

            // プロファイルを取得
            const profile = this._profileManager.getProfile(data.profileId);
            if (!profile) {
                throw new Error(`接続プロファイル "${data.profileId}" が見つかりません`);
            }

            // パスワードを取得
            let password = await this._profileManager.getPassword(data.profileId);
            
            // パスワードが保存されていない場合は入力を求める
            if (password === undefined) {
                password = await vscode.window.showInputBox({
                    prompt: `${profile.name} のパスワードを入力してください（パスワードなしの場合は空欄のままEnter）`,
                    password: true,
                    placeHolder: 'パスワード（空欄可）',
                    ignoreFocusOut: true
                });

                // undefined はキャンセル、空文字列はパスワードなし
                if (password === undefined) {
                    // キャンセルされた場合
                    this.sendMessage({
                        type: 'connectionResult',
                        success: false,
                        error: 'パスワードの入力がキャンセルされました'
                    });
                    return;
                }

                // パスワードが入力された場合（空文字列でも）保存するか確認
                const savePassword = await vscode.window.showQuickPick(
                    ['はい', 'いいえ'],
                    {
                        placeHolder: 'パスワードを保存しますか？（Secret Storageに暗号化して保存されます）',
                        ignoreFocusOut: true
                    }
                );

                if (savePassword === 'はい') {
                    await this._profileManager.updateProfile(profile, password);
                    vscode.window.showInformationMessage('パスワードを保存しました');
                }
            }

            // 接続を作成（空文字列のパスワードも許可）
            this._currentConnection = ConnectionFactory.createConnection(profile, password);

            // 接続
            await this._currentConnection.connect();

            // アクティブな接続として設定
            this._profileManager.setActiveConnection(data.profileId);

            // 成功を通知
            this.sendMessage({
                type: 'connectionResult',
                success: true,
                profileId: data.profileId,
                profileName: profile.name
            });

            vscode.window.showInformationMessage(`${profile.name} に接続しました`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.sendMessage({
                type: 'connectionResult',
                success: false,
                error: errorMessage
            });

            vscode.window.showErrorMessage(`接続エラー: ${errorMessage}`);
        }
    }

    /**
     * データベースから切断
     */
    private async _handleDisconnect() {
        try {
            if (!this._currentConnection) {
                throw new Error('接続されていません');
            }

            await this._currentConnection.disconnect();
            this._currentConnection = null;

            this.sendMessage({
                type: 'disconnectionResult',
                success: true
            });

            vscode.window.showInformationMessage('データベースから切断しました');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.sendMessage({
                type: 'disconnectionResult',
                success: false,
                error: errorMessage
            });

            vscode.window.showErrorMessage(`切断エラー: ${errorMessage}`);
        }
    }

    /**
     * パスワードを変更
     */
    private async _handleChangePassword(data: { profileId: string }) {
        try {
            const profile = this._profileManager.getProfile(data.profileId);
            if (!profile) {
                throw new Error(`接続プロファイル "${data.profileId}" が見つかりません`);
            }

            // 新しいパスワードを入力
            const newPassword = await vscode.window.showInputBox({
                prompt: `${profile.name} の新しいパスワードを入力してください`,
                password: true,
                placeHolder: '新しいパスワード',
                ignoreFocusOut: true
            });

            if (!newPassword) {
                vscode.window.showInformationMessage('パスワードの変更がキャンセルされました');
                return;
            }

            // パスワードを更新
            await this._profileManager.updateProfile(profile, newPassword);

            vscode.window.showInformationMessage(`${profile.name} のパスワードを更新しました`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`パスワード変更エラー: ${errorMessage}`);
        }
    }

    /**
     * 接続テストを処理
     */
    private async _handleTestConnection(data: any) {
        try {
            const profile = this._profileManager.getProfile(data.profileId);
            if (!profile) {
                throw new Error(`接続プロファイル "${data.profileId}" が見つかりません`);
            }

            const password = await this._profileManager.getPassword(data.profileId);
            if (!password) {
                throw new Error('パスワードが設定されていません');
            }

            const connection = ConnectionFactory.createConnection(profile, password);
            const success = await connection.testConnection();

            this.sendMessage({
                type: 'connectionTestResult',
                success,
                message: success ? '接続テストに成功しました' : '接続テストに失敗しました'
            });

            if (success) {
                vscode.window.showInformationMessage(`${profile.name} への接続テストに成功しました`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.sendMessage({
                type: 'connectionTestResult',
                success: false,
                error: errorMessage
            });

            vscode.window.showErrorMessage(`接続テストエラー: ${errorMessage}`);
        }
    }

    /**
     * クエリ実行を処理
     */
    private async _handleExecuteQuery(data: any) {
        try {
            // 接続を確認
            if (!this._currentConnection || !this._currentConnection.isConnected()) {
                throw new Error('データベースに接続されていません。先に接続してください。');
            }

            const query = data.query.trim();
            if (!query) {
                throw new Error('SQLクエリが入力されていません');
            }

            // クエリを実行
            const result = await this._currentConnection.executeQuery(query);

            // 結果を送信
            this.sendMessage({
                type: 'queryResult',
                success: true,
                columns: result.columns,
                rows: result.rows,
                rowCount: result.rowCount,
                executionTime: result.executionTime
            });

            vscode.window.showInformationMessage(`クエリを実行しました (${result.rowCount}行, ${result.executionTime.toFixed(3)}秒)`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.sendMessage({
                type: 'queryResult',
                success: false,
                error: errorMessage
            });

            vscode.window.showErrorMessage(`クエリエラー: ${errorMessage}`);
        }
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
        <select id="profileSelect" style="margin-left: 10px; padding: 4px;">
            <option value="">接続を選択...</option>
        </select>
        <button onclick="connectToDatabase()">接続</button>
        <button onclick="disconnectFromDatabase()">切断</button>
        <button onclick="changePassword()">🔑 パスワード変更</button>
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
        
        let currentProfileId = null;
        let isConnected = false;

        // 初期化時にプロファイル一覧を取得
        window.addEventListener('load', () => {
            vscode.postMessage({ type: 'getProfiles' });
        });

        // メッセージを受信
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'profilesList':
                    handleProfilesList(message);
                    break;
                case 'connectionResult':
                    handleConnectionResult(message);
                    break;
                case 'disconnectionResult':
                    handleDisconnectionResult(message);
                    break;
                case 'connectionTestResult':
                    handleConnectionTestResult(message);
                    break;
                case 'queryResult':
                    handleQueryResult(message);
                    break;
            }
        });

        function handleProfilesList(message) {
            const select = document.getElementById('profileSelect');
            select.innerHTML = '<option value="">接続を選択...</option>';
            
            message.profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile.id;
                option.textContent = \`\${profile.name} (\${profile.type})\`;
                if (profile.id === message.activeId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }

        function connectToDatabase() {
            const select = document.getElementById('profileSelect');
            const profileId = select.value;
            
            if (!profileId) {
                showMessage('接続プロファイルを選択してください', 'error');
                return;
            }

            vscode.postMessage({
                type: 'connect',
                data: { profileId }
            });
        }

        function disconnectFromDatabase() {
            vscode.postMessage({ type: 'disconnect' });
        }

        function changePassword() {
            const select = document.getElementById('profileSelect');
            const profileId = select.value;
            
            if (!profileId) {
                showMessage('接続プロファイルを選択してください', 'error');
                return;
            }

            vscode.postMessage({
                type: 'changePassword',
                data: { profileId }
            });
        }

        function handleConnectionResult(message) {
            if (message.success) {
                isConnected = true;
                currentProfileId = message.profileId;
                
                const statusElem = document.getElementById('connectionStatus');
                const textElem = document.getElementById('connectionText');
                
                statusElem.className = 'connection-status connected';
                textElem.textContent = \`\${message.profileName} に接続中\`;
                
                showMessage('データベースに接続しました', 'success');
            } else {
                isConnected = false;
                showMessage(\`接続エラー: \${message.error}\`, 'error');
            }
        }

        function handleDisconnectionResult(message) {
            if (message.success) {
                isConnected = false;
                currentProfileId = null;
                
                const statusElem = document.getElementById('connectionStatus');
                const textElem = document.getElementById('connectionText');
                
                statusElem.className = 'connection-status';
                textElem.textContent = '未接続';
                
                showMessage('データベースから切断しました', 'success');
            } else {
                showMessage(\`切断エラー: \${message.error}\`, 'error');
            }
        }

        function executeQuery() {
            if (!isConnected) {
                showMessage('データベースに接続してください', 'error');
                return;
            }

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

