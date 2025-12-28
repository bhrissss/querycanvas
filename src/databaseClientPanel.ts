import * as vscode from 'vscode';
import { ConnectionProfileManager, IDBConnection, ConnectionFactory } from './database';
import { SchemaDocumentGenerator } from './schemaDocumentGenerator';
import { QueryResultSaver } from './queryResultSaver';

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
            case 'addProfile':
                this._handleAddProfile(message.data);
                break;
            case 'updateProfile':
                this._handleUpdateProfile(message.data);
                break;
            case 'deleteProfile':
                this._handleDeleteProfile(message.data);
                break;
            case 'connect':
                this._handleConnect(message.data);
                break;
            case 'disconnect':
                this._handleDisconnect();
                break;
            case 'extractSchema':
                this._handleExtractSchema();
                break;
            case 'testConnection':
                this._handleTestConnection(message.data);
                break;
            case 'executeQuery':
                this._handleExecuteQuery(message.data);
                break;
            case 'saveQueryResult':
                this._handleSaveQueryResult(message.data);
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
     * 新しい接続プロファイルを追加
     */
    private async _handleAddProfile(data: any) {
        try {
            const { profile, password } = data;
            
            // IDを生成
            profile.id = ConnectionProfileManager.generateId();
            
            // プロファイルを追加
            await this._profileManager.addProfile(profile, password);
            
            // 更新されたプロファイル一覧を送信
            this._handleGetProfiles();
            
            vscode.window.showInformationMessage(`接続プロファイル "${profile.name}" を追加しました`);
            
            this.sendMessage({
                type: 'profileAdded',
                success: true
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`追加エラー: ${errorMessage}`);
            
            this.sendMessage({
                type: 'profileAdded',
                success: false,
                error: errorMessage
            });
        }
    }

    /**
     * 接続プロファイルを更新
     */
    private async _handleUpdateProfile(data: any) {
        try {
            const { profile, password } = data;
            
            // プロファイルを更新
            await this._profileManager.updateProfile(profile, password);
            
            // 更新されたプロファイル一覧を送信
            this._handleGetProfiles();
            
            vscode.window.showInformationMessage(`接続プロファイル "${profile.name}" を更新しました`);
            
            this.sendMessage({
                type: 'profileUpdated',
                success: true
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`更新エラー: ${errorMessage}`);
            
            this.sendMessage({
                type: 'profileUpdated',
                success: false,
                error: errorMessage
            });
        }
    }

    /**
     * 接続プロファイルを削除
     */
    private async _handleDeleteProfile(data: any) {
        try {
            const profile = this._profileManager.getProfile(data.profileId);
            if (!profile) {
                throw new Error('接続プロファイルが見つかりません');
            }
            
            // 確認
            const answer = await vscode.window.showWarningMessage(
                `接続プロファイル "${profile.name}" を削除してもよろしいですか？`,
                { modal: true },
                '削除',
                'キャンセル'
            );
            
            if (answer !== '削除') {
                this.sendMessage({
                    type: 'profileDeleted',
                    success: false,
                    error: 'キャンセルされました'
                });
                return;
            }
            
            // プロファイルを削除
            await this._profileManager.deleteProfile(data.profileId);
            
            // 更新されたプロファイル一覧を送信
            this._handleGetProfiles();
            
            vscode.window.showInformationMessage(`接続プロファイル "${profile.name}" を削除しました`);
            
            this.sendMessage({
                type: 'profileDeleted',
                success: true,
                profileId: data.profileId
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`削除エラー: ${errorMessage}`);
            
            this.sendMessage({
                type: 'profileDeleted',
                success: false,
                error: errorMessage
            });
        }
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
     * テーブルスキーマを抽出
     */
    private async _handleExtractSchema() {
        try {
            // 接続を確認
            if (!this._currentConnection || !this._currentConnection.isConnected()) {
                throw new Error('データベースに接続されていません。先に接続してください。');
            }

            // アクティブな接続プロファイルを取得
            const activeProfile = this._profileManager.getActiveProfile();
            if (!activeProfile) {
                throw new Error('アクティブな接続プロファイルが見つかりません');
            }

            // スキーマドキュメント生成器を作成
            const generator = new SchemaDocumentGenerator();

            // スキーマを抽出
            vscode.window.showInformationMessage('テーブル定義を取得しています...');
            const tableCount = await generator.extractAllTables(
                this._currentConnection,
                activeProfile.database
            );

            // 成功を通知
            this.sendMessage({
                type: 'schemaExtracted',
                success: true,
                tableCount
            });

            vscode.window.showInformationMessage(
                `${tableCount}個のテーブル定義を db-schema/tables/ に保存しました。Cursorと会話しながら補足情報を追記してください。`
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.sendMessage({
                type: 'schemaExtracted',
                success: false,
                error: errorMessage
            });

            vscode.window.showErrorMessage(`スキーマ抽出エラー: ${errorMessage}`);
        }
    }

    /**
     * クエリ結果を保存
     */
    private async _handleSaveQueryResult(data: any) {
        try {
            const saver = new QueryResultSaver();
            
            // 行データを配列形式に変換
            const rows = data.rows.map((row: any) => {
                return data.columns.map((col: string) => row[col]);
            });

            // 保存
            const filePath = await saver.saveQueryResult(
                data.columns,
                rows,
                data.options
            );

            // 成功を通知
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
            
            this.sendMessage({
                type: 'saveResult',
                success: true,
                filePath,
                fileName
            });

            vscode.window.showInformationMessage(`クエリ結果を保存しました: ${fileName}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.sendMessage({
                type: 'saveResult',
                success: false,
                error: errorMessage
            });

            vscode.window.showErrorMessage(`保存エラー: ${errorMessage}`);
        }
    }

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

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 20px;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .modal-header h2 {
            margin: 0;
            font-size: 18px;
        }

        .close-button {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--vscode-foreground);
            padding: 0;
            width: 30px;
            height: 30px;
        }

        .close-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .profile-list {
            margin-bottom: 20px;
        }

        .profile-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            margin-bottom: 5px;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-input-background);
        }

        .profile-info {
            flex: 1;
        }

        .profile-name {
            font-weight: bold;
            margin-bottom: 4px;
        }

        .profile-details {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .profile-actions {
            display: flex;
            gap: 5px;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
        }

        .form-group input,
        .form-group select {
            width: 100%;
            padding: 6px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }

        .form-group input:focus,
        .form-group select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .form-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .checkbox-group input[type="checkbox"] {
            width: auto;
        }

        .radio-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .radio-group input[type="radio"] {
            width: auto;
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

    <!-- 接続管理モーダル -->
    <div id="connectionManagerModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>接続管理</h2>
                <button class="close-button" onclick="closeConnectionManager()">&times;</button>
            </div>
            
            <div class="profile-list" id="profileListContainer"></div>
            
            <button onclick="showAddProfileForm()">+ 新しい接続を追加</button>
        </div>
    </div>

    <!-- 接続プロファイル追加/編集モーダル -->
    <div id="profileFormModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="profileFormTitle">接続プロファイルを追加</h2>
                <button class="close-button" onclick="closeProfileForm()">&times;</button>
            </div>
            
            <form id="profileForm" onsubmit="saveProfile(event)">
                <input type="hidden" id="profileId" value="">
                
                <div class="form-group">
                    <label for="profileName">接続名 *</label>
                    <input type="text" id="profileName" required placeholder="例: 開発DB">
                </div>
                
                <div class="form-group">
                    <label for="profileType">データベースタイプ *</label>
                    <select id="profileType" required onchange="updateDefaultPort()">
                        <option value="mysql">MySQL</option>
                        <option value="postgresql">PostgreSQL</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="profileHost">ホスト *</label>
                    <input type="text" id="profileHost" required value="localhost" placeholder="例: localhost">
                </div>
                
                <div class="form-group">
                    <label for="profilePort">ポート *</label>
                    <input type="number" id="profilePort" required value="3306" placeholder="3306">
                </div>
                
                <div class="form-group">
                    <label for="profileDatabase">データベース名 *</label>
                    <input type="text" id="profileDatabase" required placeholder="例: myapp_development">
                </div>
                
                <div class="form-group">
                    <label for="profileUsername">ユーザー名 *</label>
                    <input type="text" id="profileUsername" required placeholder="例: root">
                </div>
                
                <div class="form-group">
                    <label for="profilePassword">パスワード</label>
                    <input type="password" id="profilePassword" placeholder="パスワード（空欄可）">
                    <small style="color: var(--vscode-descriptionForeground);">空欄の場合は接続時に入力を求められます</small>
                </div>
                
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="profileSsl">
                    <label for="profileSsl">SSL接続を有効にする</label>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="secondary" onclick="closeProfileForm()">キャンセル</button>
                    <button type="submit">保存</button>
                </div>
            </form>
        </div>
    </div>

    <!-- クエリ結果保存モーダル -->
    <div id="saveResultModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>クエリ結果を保存</h2>
                <button class="close-button" onclick="closeSaveDialog()">&times;</button>
            </div>
            
            <form id="saveResultForm" onsubmit="submitSaveResult(event)">
                <div class="form-group">
                    <label for="resultName">名前 *</label>
                    <input type="text" id="resultName" required placeholder="例: ユーザー一覧_2025年12月">
                    <small style="color: var(--vscode-descriptionForeground);">
                        ファイル名に使用されます（自動的にタイムスタンプが追加されます）
                    </small>
                </div>
                
                <div class="form-group">
                    <label for="resultComment">コメント・説明</label>
                    <textarea id="resultComment" rows="4" placeholder="このクエリ結果の目的や背景を記入してください&#10;例: 2025年12月の新規登録ユーザー分析用データ。del_kbn=0（有効ユーザー）のみを抽出。"></textarea>
                </div>
                
                <div class="form-group">
                    <label>保存形式 *</label>
                    <div class="radio-group">
                        <label style="display: flex; align-items: center; margin-bottom: 8px;">
                            <input type="radio" name="resultFormat" value="tsv" checked style="margin-right: 8px;">
                            <div>
                                <div>TSV (Tab-Separated Values)</div>
                                <small style="color: var(--vscode-descriptionForeground);">
                                    Excel、スプレッドシートで開きやすい形式
                                </small>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center;">
                            <input type="radio" name="resultFormat" value="json" style="margin-right: 8px;">
                            <div>
                                <div>JSON</div>
                                <small style="color: var(--vscode-descriptionForeground);">
                                    プログラムで処理しやすい形式、Cursorでの分析に最適
                                </small>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>実行したSQL</label>
                    <div style="background-color: var(--vscode-editor-background); padding: 10px; border: 1px solid var(--vscode-panel-border); font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; max-height: 150px; overflow-y: auto;" id="saveResultQuery"></div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="secondary" onclick="closeSaveDialog()">キャンセル</button>
                    <button type="submit">💾 保存</button>
                </div>
            </form>
        </div>
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
                case 'profileAdded':
                case 'profileUpdated':
                case 'profileDeleted':
                    if (message.success) {
                        closeProfileForm();
                    }
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
                case 'saveResult':
                    handleSaveResult(message);
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

            // 接続管理モーダルのリストも更新
            updateProfileListInModal(message.profiles);
        }

        function updateProfileListInModal(profiles) {
            const container = document.getElementById('profileListContainer');
            if (!container) return;

            if (profiles.length === 0) {
                container.innerHTML = '<p style="color: var(--vscode-descriptionForeground);">接続プロファイルがありません</p>';
                return;
            }

            container.innerHTML = '';
            profiles.forEach(profile => {
                const item = document.createElement('div');
                item.className = 'profile-item';
                item.innerHTML = \`
                    <div class="profile-info">
                        <div class="profile-name">\${profile.name}</div>
                        <div class="profile-details">
                            \${profile.type.toUpperCase()} - \${profile.username}@\${profile.host}:\${profile.port}/\${profile.database}
                        </div>
                    </div>
                    <div class="profile-actions">
                        <button onclick="editProfile('\${profile.id}')">編集</button>
                        <button class="secondary" onclick="deleteProfile('\${profile.id}')">削除</button>
                    </div>
                \`;
                container.appendChild(item);
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

        function openConnectionManager() {
            document.getElementById('connectionManagerModal').className = 'modal show';
            vscode.postMessage({ type: 'getProfiles' });
        }

        function closeConnectionManager() {
            document.getElementById('connectionManagerModal').className = 'modal';
        }

        function showAddProfileForm() {
            document.getElementById('profileFormTitle').textContent = '接続プロファイルを追加';
            document.getElementById('profileForm').reset();
            document.getElementById('profileId').value = '';
            document.getElementById('profileType').value = 'mysql';
            document.getElementById('profilePort').value = '3306';
            document.getElementById('profileFormModal').className = 'modal show';
        }

        function editProfile(profileId) {
            const select = document.getElementById('profileSelect');
            let profile = null;
            
            // 現在のプロファイル情報を取得（select optionsから推測）
            for (let option of select.options) {
                if (option.value === profileId) {
                    // 実際のデータはバックエンドから取得する必要がある
                    // 簡易的にフォームを開く
                    showMessage('編集機能は次のバージョンで実装予定です', 'info');
                    return;
                }
            }
        }

        function deleteProfile(profileId) {
            vscode.postMessage({
                type: 'deleteProfile',
                data: { profileId }
            });
        }

        function closeProfileForm() {
            document.getElementById('profileFormModal').className = 'modal';
        }

        function updateDefaultPort() {
            const type = document.getElementById('profileType').value;
            const portInput = document.getElementById('profilePort');
            if (type === 'mysql') {
                portInput.value = '3306';
            } else if (type === 'postgresql') {
                portInput.value = '5432';
            }
        }

        function saveProfile(event) {
            event.preventDefault();

            const profileId = document.getElementById('profileId').value;
            const profile = {
                name: document.getElementById('profileName').value,
                type: document.getElementById('profileType').value,
                host: document.getElementById('profileHost').value,
                port: parseInt(document.getElementById('profilePort').value),
                database: document.getElementById('profileDatabase').value,
                username: document.getElementById('profileUsername').value,
                ssl: document.getElementById('profileSsl').checked
            };
            const password = document.getElementById('profilePassword').value;

            if (profileId) {
                // 更新
                profile.id = profileId;
                vscode.postMessage({
                    type: 'updateProfile',
                    data: { profile, password: password || undefined }
                });
            } else {
                // 新規追加
                vscode.postMessage({
                    type: 'addProfile',
                    data: { profile, password }
                });
            }
        }

        function getTableSchema() {
            if (!isConnected) {
                showMessage('データベースに接続してください', 'error');
                return;
            }

            vscode.postMessage({ type: 'extractSchema' });
        }

        function openDataManager() {
            showMessage('データ管理機能は実装中です', 'info');
        }

        function saveResult() {
            if (!window.lastQueryResult) {
                showMessage('保存する結果がありません。先にクエリを実行してください。', 'error');
                return;
            }

            // ダイアログを開く
            document.getElementById('resultName').value = '';
            document.getElementById('resultComment').value = '';
            document.getElementById('saveResultQuery').textContent = window.lastQueryResult.query;
            document.getElementById('saveResultModal').className = 'modal show';
        }

        function closeSaveDialog() {
            document.getElementById('saveResultModal').className = 'modal';
        }

        function submitSaveResult(event) {
            event.preventDefault();

            const name = document.getElementById('resultName').value;
            const comment = document.getElementById('resultComment').value;
            const format = document.querySelector('input[name="resultFormat"]:checked').value;

            vscode.postMessage({
                type: 'saveQueryResult',
                data: {
                    columns: window.lastQueryResult.columns,
                    rows: window.lastQueryResult.rows,
                    options: {
                        name,
                        comment,
                        format,
                        query: window.lastQueryResult.query
                    }
                }
            });

            closeSaveDialog();
        }

        function handleSaveResult(message) {
            if (!message.success) {
                showMessage(message.error || '保存に失敗しました', 'error');
                return;
            }

            showMessage(\`クエリ結果を保存しました: \${message.fileName}\`, 'success');
        }

        function handleQueryResult(message) {
            if (!message.success) {
                showMessage(message.error || 'クエリの実行に失敗しました', 'error');
                return;
            }

            // 結果を保存（後で使用）
            window.lastQueryResult = {
                columns: message.columns,
                rows: message.rows,
                rowCount: message.rowCount,
                executionTime: message.executionTime,
                query: document.getElementById('sqlInput').value
            };

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

