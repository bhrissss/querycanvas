import * as vscode from 'vscode';
import { ConnectionProfileManager, IDBConnection, ConnectionFactory } from './database';
import { SchemaDocumentGenerator } from './schemaDocumentGenerator';
import { QueryResultSaver } from './queryResultSaver';
import { SessionStateManager } from './sessionStateManager';
import { AutoQueryResultSaver } from './autoQueryResultSaver';
import { SavedQueryManager } from './savedQueryManager';
import { TSVReader } from './tsvReader';
import { SqlValidator } from './sqlValidator';
import { SqlFormatter } from './sqlFormatter';
import { SqlCommentParser } from './sqlCommentParser';

/**
 * データベースクライアントのWebviewパネルを管理するクラス
 */
export class DatabaseClientPanel {
    public static currentPanel: DatabaseClientPanel | undefined;
    private static readonly viewType = 'databaseClient';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _profileManager: ConnectionProfileManager;
    private readonly _sessionManager: SessionStateManager;
    private readonly _autoSaver: AutoQueryResultSaver;
    private readonly _queryManager: SavedQueryManager;
    private _disposables: vscode.Disposable[] = [];
    private _currentConnection: IDBConnection | null = null;
    private _sessionFileWatcher: vscode.FileSystemWatcher | null = null;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, profileManager: ConnectionProfileManager) {
        this._panel = panel;
        this._profileManager = profileManager;
        this._sessionManager = new SessionStateManager();
        this._autoSaver = new AutoQueryResultSaver();
        this._queryManager = new SavedQueryManager();

        // パネルのコンテンツを設定
        this._panel.webview.html = this._getHtmlContent();

        // セッション状態を復元
        this._restoreSession();

        // セッションファイルの監視を開始
        this._watchSessionFile();

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

        // Cursor Rules ボタンの表示状態をチェック
        this._checkCursorRulesButtonVisibility();
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

        // ファイル監視を停止
        if (this._sessionFileWatcher) {
            this._sessionFileWatcher.dispose();
            this._sessionFileWatcher = null;
        }

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
     * セッション状態を復元
     */
    private _restoreSession() {
        const state = this._sessionManager.getState();
        
        // SQL入力内容を復元
        if (state.sqlInput) {
            this.sendMessage({
                type: 'restoreSession',
                sqlInput: state.sqlInput,
                connectionId: state.connectionId
            });
        }
    }

    /**
     * セッションファイルの変更を監視
     */
    private _watchSessionFile() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const sessionFilePath = vscode.Uri.joinPath(
            workspaceFolders[0].uri,
            '.vscode',
            'querycanvas-session.json'
        );

        console.log('[DatabaseClientPanel] Watching session file:', sessionFilePath.fsPath);

        // ファイル監視を開始（グロブパターンを使用）
        const pattern = new vscode.RelativePattern(
            workspaceFolders[0],
            '.vscode/querycanvas-session.json'
        );
        
        this._sessionFileWatcher = vscode.workspace.createFileSystemWatcher(
            pattern,
            false, // create イベントを監視
            false, // change イベントを監視
            true   // delete イベントは無視
        );

        // ファイルが変更された時
        this._sessionFileWatcher.onDidChange((uri) => {
            console.log('[DatabaseClientPanel] File changed:', uri.fsPath);
            this._onSessionFileChanged();
        });

        // ファイルが作成された時（初回保存時）
        this._sessionFileWatcher.onDidCreate((uri) => {
            console.log('[DatabaseClientPanel] File created:', uri.fsPath);
            this._onSessionFileChanged();
        });

        this._disposables.push(this._sessionFileWatcher);
    }

    /**
     * セッションファイルが変更された時の処理
     */
    private _onSessionFileChanged() {
        try {
            console.log('[DatabaseClientPanel] Session file changed, reloading...');
            
            // セッション状態をファイルから再読み込み
            this._sessionManager.reloadState();
            const state = this._sessionManager.getState();
            
            console.log('[DatabaseClientPanel] Reloaded SQL:', state.sqlInput?.substring(0, 50));
            
            // WebviewにSQL内容を更新（外部変更のみ反映）
            this.sendMessage({
                type: 'updateSqlFromFile',
                sqlInput: state.sqlInput
            });
        } catch (error) {
            console.error('セッションファイル変更の処理エラー:', error);
        }
    }

    /**
     * SQL入力の変更を処理
     */
    private _handleSqlInputChanged(data: any) {
        this._sessionManager.updateSqlInput(data.sql);
    }

    /**
     * SQLをフォーマット
     */
    private _handleFormatSql(data: any) {
        try {
            const sql = data.sql;
            if (!sql || sql.trim().length === 0) {
                vscode.window.showWarningMessage('フォーマットするSQLがありません');
                return;
            }

            const formatted = SqlFormatter.format(sql);
            
            // フォーマット済みSQLをエディタに反映
            this.sendMessage({
                type: 'sqlFormatted',
                sql: formatted
            });

            // セッションも更新
            this._sessionManager.updateSqlInput(formatted);

            vscode.window.showInformationMessage('SQLをフォーマットしました');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`フォーマットエラー: ${errorMessage}`);
        }
    }

    /**
     * Cursor AI Rules をセットアップ
     */
    private async _handleSetupCursorRules() {
        try {
            // CursorRulesManager のインポート
            const { CursorRulesManager } = await import('./cursorRulesManager');
            await CursorRulesManager.addQueryCanvasRules();
            
            // 書き込み後にボタンの表示状態を更新
            await this._checkCursorRulesButtonVisibility();
        } catch (error) {
            vscode.window.showErrorMessage(`Cursor AI Rules セットアップエラー: ${error}`);
        }
    }

    /**
     * Cursor Rules ボタンの表示状態をチェックして更新
     */
    private async _checkCursorRulesButtonVisibility() {
        try {
            const { CursorRulesManager } = await import('./cursorRulesManager');
            const isAlreadyWritten = await CursorRulesManager.isLatestTemplateAlreadyWritten();
            
            // Webviewにボタンの表示状態を通知
            this.sendMessage({
                type: 'updateCursorRulesButtonVisibility',
                visible: !isAlreadyWritten
            });
        } catch (error) {
            console.error('Error checking cursor rules button visibility:', error);
            // エラー時はボタンを表示する（安全側）
            this.sendMessage({
                type: 'updateCursorRulesButtonVisibility',
                visible: true
            });
        }
    }

    /**
     * 保存されたクエリ一覧を取得
     */
    private _handleGetSavedQueries() {
        const queries = this._queryManager.getAllQueries();
        this.sendMessage({
            type: 'savedQueriesList',
            queries
        });
    }

    /**
     * 名前付きクエリを保存
     */
    private _handleSaveNamedQuery(data: any) {
        try {
            const savedQuery = this._queryManager.saveQuery({
                name: data.name,
                description: data.description || '',
                sql: data.sql,
                tags: data.tags || []
            });

            vscode.window.showInformationMessage(`クエリ "${savedQuery.name}" を保存しました`);

            // 更新されたクエリ一覧を送信
            this._handleGetSavedQueries();

            this.sendMessage({
                type: 'querySaved',
                success: true,
                query: savedQuery
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`クエリ保存エラー: ${errorMessage}`);
            
            this.sendMessage({
                type: 'querySaved',
                success: false,
                error: errorMessage
            });
        }
    }

    /**
     * 名前付きクエリを読み込み
     */
    private _handleLoadNamedQuery(data: any) {
        try {
            const query = this._queryManager.getQuery(data.queryId);
            
            if (!query) {
                throw new Error('クエリが見つかりません');
            }

            // セッションにSQLを保存
            this._sessionManager.updateSqlInput(query.sql);

            // SQL入力欄に読み込み
            this.sendMessage({
                type: 'queryLoaded',
                success: true,
                query
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`クエリ読み込みエラー: ${errorMessage}`);
            
            this.sendMessage({
                type: 'queryLoaded',
                success: false,
                error: errorMessage
            });
        }
    }

    /**
     * 名前付きクエリを実行（キャッシュ優先）
     */
    private async _handleExecuteNamedQuery(data: any) {
        try {
            const query = this._queryManager.getQuery(data.queryId);
            
            if (!query) {
                throw new Error('クエリが見つかりません');
            }

            // セッションにSQLを保存（UIに反映）
            this._sessionManager.updateSqlInput(query.sql);

            // UIにもSQLを読み込む
            this.sendMessage({
                type: 'loadSqlToEditor',
                sql: query.sql
            });

            // キャッシュファイルが存在するか確認
            if (query.lastResultFile) {
                const cachedResult = TSVReader.readTSVFile(query.lastResultFile);
                
                if (cachedResult) {
                    // キャッシュから読み込み成功
                    vscode.window.showInformationMessage(
                        `クエリ "${query.name}" のキャッシュ結果を表示 (実行日時: ${new Date(query.lastExecutedAt || '').toLocaleString()})`
                    );

                    this.sendMessage({
                        type: 'queryResult',
                        success: true,
                        columns: cachedResult.columns,
                        rows: cachedResult.rows,
                        rowCount: cachedResult.rowCount,
                        executionTime: 0, // キャッシュなので0秒
                        fromCache: true,
                        cachedAt: query.lastExecutedAt
                    });
                    return;
                }
            }

            // キャッシュがない、または読み込み失敗の場合は実際に実行
            // 接続を確認
            if (!this._currentConnection || !this._currentConnection.isConnected()) {
                throw new Error('データベースに接続されていません。先に接続してください。');
            }

            // SQLクエリをバリデーション（参照系のみ許可）
            const validation = SqlValidator.validate(query.sql);
            if (!validation.isValid) {
                throw new Error(validation.error || 'Invalid SQL query');
            }

            // クエリを実行
            const result = await this._currentConnection.executeQuery(query.sql);

            // 結果を自動保存（TSV形式）
            if (result.rows.length > 0) {
                try {
                    const rows = result.rows.map((row: any) => {
                        return result.columns.map((col: string) => row[col]);
                    });
                    const filePath = this._autoSaver.autoSaveQueryResult(
                        result.columns,
                        rows,
                        query.sql
                    );
                    
                    // クエリに結果ファイルパスを記録
                    this._queryManager.updateLastResult(data.queryId, filePath);
                    
                    console.log(`クエリ結果を自動保存: ${filePath}`);
                } catch (saveError) {
                    console.error('自動保存エラー:', saveError);
                }
            }

            // 結果を送信
            this.sendMessage({
                type: 'queryResult',
                success: true,
                columns: result.columns,
                rows: result.rows,
                rowCount: result.rowCount,
                executionTime: result.executionTime,
                fromCache: false
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
     * 名前付きクエリを削除
     */
    private _handleDeleteNamedQuery(data: any) {
        try {
            const success = this._queryManager.deleteQuery(data.queryId);
            
            if (!success) {
                throw new Error('クエリが見つかりません');
            }

            vscode.window.showInformationMessage('クエリを削除しました');

            // 更新されたクエリ一覧を送信
            this._handleGetSavedQueries();

            this.sendMessage({
                type: 'queryDeleted',
                success: true,
                queryId: data.queryId
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`クエリ削除エラー: ${errorMessage}`);
            
            this.sendMessage({
                type: 'queryDeleted',
                success: false,
                error: errorMessage
            });
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
            case 'formatSql':
                this._handleFormatSql(message.data);
                break;
            case 'setupCursorRules':
                this._handleSetupCursorRules();
                break;
            case 'saveQueryResult':
                this._handleSaveQueryResult(message.data);
                break;
            case 'sqlInputChanged':
                this._handleSqlInputChanged(message.data);
                break;
            case 'getSavedQueries':
                this._handleGetSavedQueries();
                break;
            case 'saveNamedQuery':
                this._handleSaveNamedQuery(message.data);
                break;
            case 'loadNamedQuery':
                this._handleLoadNamedQuery(message.data);
                break;
            case 'executeNamedQuery':
                this._handleExecuteNamedQuery(message.data);
                break;
            case 'deleteNamedQuery':
                this._handleDeleteNamedQuery(message.data);
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

            // セッション状態を更新
            this._sessionManager.updateConnection(data.profileId, true);

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

            // セッション状態を更新
            this._sessionManager.updateConnection(null, false);

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

            // SQLクエリをバリデーション（参照系のみ許可）
            const validation = SqlValidator.validate(query);
            if (!validation.isValid) {
                throw new Error(validation.error || 'Invalid SQL query');
            }

            // コメントから表示オプションをパース
            const displayOptions = SqlCommentParser.parseOptions(query);

            // クエリを実行
            const result = await this._currentConnection.executeQuery(query);

            // 結果を自動保存（TSV形式）
            if (result.rows.length > 0) {
                try {
                    const rows = result.rows.map((row: any) => {
                        return result.columns.map((col: string) => row[col]);
                    });
                    const filePath = this._autoSaver.autoSaveQueryResult(
                        result.columns,
                        rows,
                        query
                    );
                    console.log(`クエリ結果を自動保存: ${filePath}`);
                } catch (saveError) {
                    console.error('自動保存エラー:', saveError);
                    // 自動保存エラーは無視して続行
                }
            }

            // 結果を送信
            this.sendMessage({
                type: 'queryResult',
                success: true,
                columns: result.columns,
                rows: result.rows,
                rowCount: result.rowCount,
                executionTime: result.executionTime,
                displayOptions: Array.from(displayOptions.columns.entries()).map(([_, opts]) => opts),
                rowStyleRules: displayOptions.rowStyles || [],
                chartOptions: displayOptions.chart || null
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src data:;">
    <title>Database Client</title>
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <!-- Chart.js DataLabels Plugin -->
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
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
            padding-bottom: 80px; /* フッター分の余白 */
        }

        .toolbar {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .toolbar-spacer {
            flex: 1;
        }

        .font-controls {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
        }

        .font-controls label {
            color: var(--vscode-foreground);
            opacity: 0.8;
        }

        .font-controls select {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 12px;
        }

        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: var(--vscode-editor-background);
            border-top: 2px solid var(--vscode-panel-border);
            padding: 10px 20px;
            z-index: 100;
        }

        .connection-area {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .connection-area.disconnected {
            display: flex;
        }

        .connection-area.connected {
            display: none;
        }

        .connection-status {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }

        .connection-status.disconnected {
            background-color: var(--vscode-testing-iconFailed);
        }

        .connection-status.connected {
            background-color: var(--vscode-testing-iconPassed);
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

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .help-button {
            font-size: 11px;
            padding: 4px 8px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            opacity: 0.8;
        }

        .help-button:hover {
            opacity: 1;
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .sql-editor-section {
            margin-bottom: 0;
        }

        .resizer {
            height: 8px;
            background-color: var(--vscode-panel-border);
            cursor: ns-resize;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            user-select: none;
            transition: background-color 0.2s;
        }

        .resizer:hover {
            background-color: var(--vscode-focusBorder);
        }

        .resizer:active {
            background-color: var(--vscode-focusBorder);
        }

        .resizer-line {
            width: 40px;
            height: 2px;
            background-color: var(--vscode-foreground);
            opacity: 0.5;
            border-radius: 1px;
        }

        .result-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 150px;
            overflow: hidden;
        }

        #resultTable {
            flex: 1;
            overflow: auto;
        }

        /* グラフ表示エリア */
        #resultChart {
            flex: 1;
            overflow: auto;
            padding: 20px;
            display: none;
            min-height: 400px;
            position: relative;
        }

        #chartCanvas {
            width: 100% !important;
            height: 500px !important;
        }

        .view-toggle {
            display: flex;
            gap: 5px;
            margin-right: 10px;
        }

        .toggle-button {
            padding: 4px 12px;
            font-size: 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            cursor: pointer;
            border-radius: 3px;
        }

        .toggle-button.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .toggle-button:hover {
            opacity: 0.8;
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

        #messageContainer {
            position: fixed;
            bottom: 70px; /* フッターの高さ + 余白 */
            left: 20px;
            right: 20px;
            z-index: 100;
            pointer-events: none; /* メッセージ自体はクリックをスルー */
        }

        #messageContainer > * {
            pointer-events: auto; /* メッセージ内のボタンなどはクリック可能 */
        }

        .result-info {
            position: fixed;
            bottom: 70px; /* フッターの高さ + 余白 */
            left: 20px;
            right: 20px;
            padding: 8px 12px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            background-color: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            z-index: 99;
        }

        .message {
            padding: 10px;
            margin: 10px 0;
            border-radius: 3px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
        .help-content {
            line-height: 1.6;
        }

        .help-content h3 {
            margin-top: 20px;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }

        .help-content h4 {
            margin-top: 15px;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
            font-size: 13px;
        }

        .help-content pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
            margin: 10px 0;
        }

        .help-content code {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12px;
        }

        .help-section {
            margin-bottom: 20px;
        }

        .help-section p {
            margin: 5px 0;
            color: var(--vscode-descriptionForeground);
        }

        .options-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }

        .options-table th,
        .options-table td {
            padding: 8px;
            text-align: left;
            border: 1px solid var(--vscode-panel-border);
        }

        .options-table th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
        }

        .options-table code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 2px;
        }

        .help-footer {
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

    </style>
</head>
<body>
    <!-- 上部：機能ボタン -->
    <div class="toolbar">
        <button onclick="openSavedQueries()">💾 保存済みクエリ</button>
        
        <div class="toolbar-spacer"></div>
        
        <div class="font-controls">
            <label for="fontFamily">Font:</label>
            <select id="fontFamily" onchange="changeFontFamily(this.value)">
                <option value="'Consolas', 'Courier New', monospace">Consolas</option>
                <option value="'Monaco', monospace">Monaco</option>
                <option value="'Menlo', monospace">Menlo</option>
                <option value="'Source Code Pro', monospace">Source Code Pro</option>
                <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                <option value="'Fira Code', monospace">Fira Code</option>
            </select>
            
            <label for="fontSize" style="margin-left: 10px;">Size:</label>
            <select id="fontSize" onchange="changeFontSize(this.value)">
                <option value="10">10px</option>
                <option value="11">11px</option>
                <option value="12">12px</option>
                <option value="13">13px</option>
                <option value="14" selected>14px</option>
                <option value="15">15px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
                <option value="22">22px</option>
                <option value="24">24px</option>
            </select>
        </div>
    </div>

    <div class="section sql-editor-section" id="sqlEditorSection">
        <div class="section-header">
            <div class="section-title">SQL入力</div>
            <button class="help-button" onclick="showDisplayOptionsHelp()" title="Display options help">
                ❓ Display Options
            </button>
        </div>
        <textarea id="sqlInput" placeholder="SELECT * FROM users;" oninput="onSqlInputChange()"></textarea>
        <div class="button-group">
            <button id="executeButton" onclick="executeQuery()">▶ 実行</button>
            <button class="secondary" onclick="formatSql()">✨ フォーマット</button>
            <button class="secondary" onclick="clearSQL()">クリア</button>
            <button class="secondary" onclick="saveResult()">💾 結果を保存</button>
            <button class="secondary" onclick="saveCurrentQuery()">⭐ クエリを保存</button>
        </div>
    </div>

    <!-- リサイザー（ドラッグで境界を調整） -->
    <div class="resizer" id="resizer">
        <div class="resizer-line"></div>
    </div>

    <div class="result-container" id="resultContainer">
        <div class="section-header">
            <div class="section-title">実行結果</div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <!-- 表示切り替えボタン -->
                <div class="view-toggle" id="viewToggle" style="display: none;">
                    <button class="toggle-button active" id="tableViewBtn" onclick="switchToTableView()">
                        📊 テーブル
                    </button>
                    <button class="toggle-button" id="chartViewBtn" onclick="switchToChartView()">
                        📈 グラフ
                    </button>
                </div>
                <!-- グラフ画像コピーボタン -->
                <button class="secondary" id="chartImageCopyBtn" onclick="copyChartAsImage()" style="display: none;" title="グラフを画像としてコピー（PowerPointに貼り付け可能）">
                    📊 グラフコピー
                </button>
                <div class="button-group" id="resultButtons" style="display: none; gap: 10px;">
                    <button class="secondary" onclick="copyTableAsTSV()" title="PowerPointに貼り付け可能なタブ区切り形式でコピー">
                        📋 TSVコピー
                    </button>
                    <button class="secondary" onclick="copyTableAsHTML()" title="スタイル付きHTMLとしてコピー（Excel/Word/PowerPointで利用可能）">
                        📋 HTMLコピー
                    </button>
                </div>
            </div>
        </div>
        <div id="resultTable"></div>
        <div id="resultChart">
            <canvas id="chartCanvas"></canvas>
        </div>
    </div>

    <!-- Display Options ヘルプモーダル -->
    <div id="displayOptionsHelpModal" class="modal">
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h2>🎨 Display Options - 結果表示のカスタマイズ</h2>
                <button class="close-button" onclick="closeDisplayOptionsHelp()">&times;</button>
            </div>
            
            <div class="help-content">
                <p>SQLコメントを使って、クエリ結果の表示方法をカスタマイズできます。</p>
                
                <h3>📝 基本構文</h3>
                <pre><code>/**
 * @column &lt;列名&gt; &lt;オプション&gt;=&lt;値&gt; ...
 */
SELECT ...</code></pre>

                <h3>💡 よく使うオプション</h3>
                
                <div class="help-section">
                    <h4>数値フォーマット</h4>
                    <pre><code>/**
 * @column 売上 align=right format=number comma=true
 * @column 価格 align=right format=number decimal=2
 */
SELECT 売上, 価格 FROM sales;</code></pre>
                    <p>結果: <code>1234567</code> → <code>1,234,567</code></p>
                </div>

                <div class="help-section">
                    <h4>日時フォーマット</h4>
                    <pre><code>/**
 * @column 作成日時 format=datetime pattern=yyyy/MM/dd_HH:mm:ss
 */
SELECT 作成日時 FROM orders;</code></pre>
                    <p>結果: <code>2025-12-28T14:30:00</code> → <code>2025/12/28 14:30:00</code></p>
                </div>

                <div class="help-section">
                    <h4>色とスタイル</h4>
                    <pre><code>/**
 * @column ステータス color=#00ff00 bold=true
 * @column 警告 bg=#ff6b6b color=#fff
 */
SELECT ステータス, 警告 FROM monitoring;</code></pre>
                </div>

                <h3>📚 利用可能なオプション</h3>
                <table class="options-table">
                    <tr>
                        <th>オプション</th>
                        <th>説明</th>
                        <th>例</th>
                    </tr>
                    <tr>
                        <td><code>align</code></td>
                        <td>テキスト配置</td>
                        <td><code>align=right</code></td>
                    </tr>
                    <tr>
                        <td><code>format</code></td>
                        <td>値のフォーマット</td>
                        <td><code>format=number</code></td>
                    </tr>
                    <tr>
                        <td><code>comma</code></td>
                        <td>カンマ区切り</td>
                        <td><code>comma=true</code></td>
                    </tr>
                    <tr>
                        <td><code>decimal</code></td>
                        <td>小数点以下桁数</td>
                        <td><code>decimal=2</code></td>
                    </tr>
                    <tr>
                        <td><code>pattern</code></td>
                        <td>日時パターン</td>
                        <td><code>pattern=yyyy/MM/dd</code></td>
                    </tr>
                    <tr>
                        <td><code>width</code></td>
                        <td>列幅</td>
                        <td><code>width=200px</code></td>
                    </tr>
                    <tr>
                        <td><code>color</code></td>
                        <td>文字色</td>
                        <td><code>color=#ff0000</code></td>
                    </tr>
                    <tr>
                        <td><code>bg</code></td>
                        <td>背景色</td>
                        <td><code>bg=#ffff00</code></td>
                    </tr>
                    <tr>
                        <td><code>bold</code></td>
                        <td>太字</td>
                        <td><code>bold=true</code></td>
                    </tr>
                </table>

                <h3>📖 詳細ドキュメント</h3>
                <p>詳しくは <code>docs/specifications/display-options.md</code> を参照してください。</p>
                
                <div class="help-footer">
                    <button onclick="insertExampleQuery()">📋 サンプルSQLを挿入</button>
                    <button onclick="closeDisplayOptionsHelp()" class="secondary">閉じる</button>
                </div>
            </div>
        </div>
    </div>

    <!-- メッセージとステータス表示エリア（フッターの直前） -->
    <div id="messageContainer"></div>
    <div class="result-info" id="resultInfo"></div>

    <!-- 下部：接続情報（未接続時） -->
    <div class="footer" id="connectionFooter">
        <div class="connection-area disconnected" id="disconnectedArea">
            <span class="connection-status disconnected" id="connectionStatus"></span>
            <span id="connectionText">未接続</span>
            <select id="profileSelect">
                <option value="">接続を選択...</option>
            </select>
            <button onclick="connectToDatabase()">接続</button>
            <button onclick="openConnectionManager()">⚙️ 接続管理</button>
            <button id="setupCursorRulesBtn" onclick="setupCursorRules()">📝 Cursor AI設定</button>
        </div>
        
        <!-- 接続時 -->
        <div class="connection-area connected" id="connectedArea" style="display: none;">
            <span class="connection-status connected"></span>
            <span id="connectedText">接続中: </span>
            <button onclick="disconnectFromDatabase()" class="secondary">切断</button>
            <button onclick="getTableSchema()" class="secondary">📋 テーブル定義</button>
        </div>
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

    <!-- クエリ保存モーダル -->
    <div id="saveQueryModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>クエリを保存</h2>
                <button class="close-button" onclick="closeSaveQueryDialog()">&times;</button>
            </div>
            
            <form id="saveQueryForm" onsubmit="submitSaveQuery(event)">
                <div class="form-group">
                    <label for="queryName">名前 *</label>
                    <input type="text" id="queryName" required placeholder="例: ユーザー一覧取得">
                </div>
                
                <div class="form-group">
                    <label for="queryDescription">説明</label>
                    <textarea id="queryDescription" rows="3" placeholder="このクエリの目的や用途を記入してください"></textarea>
                </div>
                
                <div class="form-group">
                    <label for="queryTags">タグ（カンマ区切り）</label>
                    <input type="text" id="queryTags" placeholder="例: ユーザー, 集計, レポート">
                    <small style="color: var(--vscode-descriptionForeground);">カンマで区切って複数のタグを入力できます</small>
                </div>
                
                <div class="form-group">
                    <label>SQL</label>
                    <div style="background-color: var(--vscode-editor-background); padding: 10px; border: 1px solid var(--vscode-panel-border); font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; max-height: 200px; overflow-y: auto;" id="saveQuerySql"></div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="secondary" onclick="closeSaveQueryDialog()">キャンセル</button>
                    <button type="submit">⭐ 保存</button>
                </div>
            </form>
        </div>
    </div>

    <!-- 保存済みクエリ一覧モーダル -->
    <div id="savedQueriesModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>保存済みクエリ</h2>
                <button class="close-button" onclick="closeSavedQueries()">&times;</button>
            </div>
            
            <div id="savedQueriesContainer" style="max-height: 60vh; overflow-y: auto;"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let currentProfileId = null;
        let isConnected = false;
        let sqlInputDebounceTimer = null;

        // リサイザーの初期化
        // フォント設定の初期化と復元
        (function initFontSettings() {
            const sqlInput = document.getElementById('sqlInput');
            const resultTable = document.getElementById('resultTable');
            const fontFamilySelect = document.getElementById('fontFamily');
            const fontSizeSelect = document.getElementById('fontSize');

            // 保存された設定を復元
            const savedFontFamily = localStorage.getItem('dbClientFontFamily');
            const savedFontSize = localStorage.getItem('dbClientFontSize');

            if (savedFontFamily) {
                fontFamilySelect.value = savedFontFamily;
                applyFontFamily(savedFontFamily);
            } else {
                // デフォルト: VS Codeのフォント設定を使用
                const defaultFont = "'Consolas', 'Courier New', monospace";
                fontFamilySelect.value = defaultFont;
                applyFontFamily(defaultFont);
            }

            if (savedFontSize) {
                fontSizeSelect.value = savedFontSize;
                applyFontSize(savedFontSize);
            }

            function applyFontFamily(fontFamily) {
                sqlInput.style.fontFamily = fontFamily;
                resultTable.style.fontFamily = fontFamily;
            }

            function applyFontSize(fontSize) {
                sqlInput.style.fontSize = fontSize + 'px';
                resultTable.style.fontSize = fontSize + 'px';
            }

            // グローバル関数として公開
            window.changeFontFamily = function(fontFamily) {
                localStorage.setItem('dbClientFontFamily', fontFamily);
                applyFontFamily(fontFamily);
            };

            window.changeFontSize = function(fontSize) {
                localStorage.setItem('dbClientFontSize', fontSize);
                applyFontSize(fontSize);
            };
        })();

        // リサイザーの初期化
        (function initResizer() {
            const resizer = document.getElementById('resizer');
            const sqlEditorSection = document.getElementById('sqlEditorSection');
            const resultContainer = document.getElementById('resultContainer');
            const sqlInput = document.getElementById('sqlInput');
            
            let isResizing = false;
            let startY = 0;
            let startHeight = 0;

            // 保存された高さを復元
            const savedHeight = localStorage.getItem('sqlEditorHeight');
            if (savedHeight) {
                sqlInput.style.height = savedHeight + 'px';
            }

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                startHeight = sqlInput.offsetHeight;
                
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
                
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const deltaY = e.clientY - startY;
                const newHeight = Math.max(80, Math.min(600, startHeight + deltaY));
                
                sqlInput.style.height = newHeight + 'px';
                sqlInput.style.minHeight = newHeight + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    
                    // 高さを保存
                    localStorage.setItem('sqlEditorHeight', sqlInput.offsetHeight);
                }
            });
        })();

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
                case 'restoreSession':
                    handleRestoreSession(message);
                    break;
                case 'updateSqlFromFile':
                    handleUpdateSqlFromFile(message);
                    break;
                case 'savedQueriesList':
                    handleSavedQueriesList(message);
                    break;
                case 'querySaved':
                case 'queryLoaded':
                case 'queryDeleted':
                    handleQueryOperation(message);
                    break;
                case 'loadSqlToEditor':
                    handleLoadSqlToEditor(message);
                    break;
                case 'sqlFormatted':
                    handleSqlFormatted(message);
                    break;
                case 'updateCursorRulesButtonVisibility':
                    handleUpdateCursorRulesButtonVisibility(message);
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
                
                // 接続時の表示に切り替え
                document.getElementById('disconnectedArea').style.display = 'none';
                document.getElementById('connectedArea').style.display = 'flex';
                document.getElementById('connectedText').textContent = \`接続中: \${message.profileName}\`;
                
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
                
                // 未接続時の表示に切り替え
                document.getElementById('disconnectedArea').style.display = 'flex';
                document.getElementById('connectedArea').style.display = 'none';
                
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

            // 実行ボタンを無効化
            const executeButton = document.getElementById('executeButton');
            executeButton.disabled = true;
            executeButton.textContent = '⏳ 実行中...';

            vscode.postMessage({
                type: 'executeQuery',
                data: { query }
            });
        }

        function clearSQL() {
            document.getElementById('sqlInput').value = '';
        }

        function formatSql() {
            const sqlInput = document.getElementById('sqlInput');
            const sql = sqlInput.value;
            
            if (!sql || sql.trim().length === 0) {
                showMessage('フォーマットするSQLがありません', 'warning');
                return;
            }
            
            vscode.postMessage({
                type: 'formatSql',
                data: { sql }
            });
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

        /**
         * テーブルをTSV形式（タブ区切り）でクリップボードにコピー
         * PowerPointに直接貼り付けできる
         */
        function copyTableAsTSV() {
            if (!window.lastQueryResult) {
                showMessage('コピーする結果がありません', 'error');
                return;
            }

            const { columns, rows } = window.lastQueryResult;
            
            // ヘッダー行
            let tsv = columns.join('\\t') + '\\n';
            
            // データ行
            rows.forEach(row => {
                const values = columns.map(col => {
                    const value = row[col];
                    // null/undefinedは空文字列に
                    if (value === null || value === undefined) {
                        return '';
                    }
                    // 数値や文字列をそのまま出力（フォーマットなし）
                    return String(value);
                });
                tsv += values.join('\\t') + '\\n';
            });
            
            // クリップボードにコピー
            navigator.clipboard.writeText(tsv).then(() => {
                showMessage(\`📋 TSV形式でコピーしました（\${rows.length}行）\\nPowerPointに貼り付けできます\`, 'success');
            }).catch(err => {
                showMessage('クリップボードへのコピーに失敗しました', 'error');
                console.error('Copy failed:', err);
            });
        }

        /**
         * テーブルをHTML形式（スタイル付き）でクリップボードにコピー
         * PowerPoint, Excel, Word などにスタイルを保持したまま貼り付けできる
         */
        function copyTableAsHTML() {
            if (!window.lastQueryResult) {
                showMessage('コピーする結果がありません', 'error');
                return;
            }

            const { columns, rows, displayOptions, rowStyleRules } = window.lastQueryResult;
            
            // 表示オプションをMapに変換
            const displayOptionsMap = new Map();
            if (displayOptions) {
                displayOptions.forEach(opt => {
                    displayOptionsMap.set(opt.columnName, opt);
                });
            }
            
            // HTML形式でテーブルを生成
            let html = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt;">';
            
            // ヘッダー行
            html += '<thead><tr>';
            columns.forEach(col => {
                const opts = displayOptionsMap.get(col);
                const style = generateColumnStyleForClipboard(opts);
                html += \`<th style="background-color: #4472C4; color: white; font-weight: bold; padding: 8px; \${style}">\${col}</th>\`;
            });
            html += '</tr></thead>';
            
            // データ行
            html += '<tbody>';
            rows.forEach((row, rowIndex) => {
                const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F2F2F2';
                // 行スタイルを生成
                const rowStyle = generateRowStyle(row, rowStyleRules || []);
                const rowStyleAttr = rowStyle ? \` \${rowStyle}\` : '';
                html += \`<tr style="\${rowStyleAttr}">\`;
                columns.forEach(col => {
                    const opts = displayOptionsMap.get(col);
                    const value = row[col];
                    const formattedValue = opts ? formatValue(value, opts) : value;
                    const conditionalStyle = opts ? generateConditionalStyle(value, opts) : '';
                    const baseStyle = \`padding: 6px; background-color: \${bgColor};\`;
                    html += \`<td style="\${baseStyle} \${conditionalStyle}">\${formattedValue !== null && formattedValue !== undefined ? formattedValue : ''}</td>\`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
            
            // ClipboardItem APIを使用してHTMLをコピー
            const htmlBlob = new Blob([html], { type: 'text/html' });
            const textBlob = new Blob([html], { type: 'text/plain' });
            
            const clipboardItem = new ClipboardItem({
                'text/html': htmlBlob,
                'text/plain': textBlob
            });
            
            navigator.clipboard.write([clipboardItem]).then(() => {
                showMessage(\`📋 HTML形式でコピーしました（\${rows.length}行）\\nPowerPoint/Excel/Wordにスタイル付きで貼り付けできます\`, 'success');
            }).catch(err => {
                // Fallback: プレーンテキストとしてコピー
                navigator.clipboard.writeText(html).then(() => {
                    showMessage('HTML形式でコピーしました（一部環境では手動で貼り付けが必要です）', 'success');
                }).catch(err2 => {
                    showMessage('クリップボードへのコピーに失敗しました', 'error');
                    console.error('Copy failed:', err, err2);
                });
            });
        }

        /**
         * クリップボード用のカラムスタイル生成（HTMLコピー用）
         */
        function generateColumnStyleForClipboard(opts) {
            if (!opts) return '';
            
            let styles = [];
            
            if (opts.align) {
                styles.push(\`text-align: \${opts.align}\`);
            }
            if (opts.width) {
                styles.push(\`width: \${opts.width}\`);
            }
            
            return styles.join('; ');
        }


        function handleRestoreSession(message) {
            // SQL入力を復元
            if (message.sqlInput) {
                document.getElementById('sqlInput').value = message.sqlInput;
            }
            
            // 接続プロファイルを選択（接続はしない）
            if (message.connectionId) {
                const select = document.getElementById('profileSelect');
                select.value = message.connectionId;
            }
        }

        function handleUpdateSqlFromFile(message) {
            const sqlInput = document.getElementById('sqlInput');
            const currentSql = sqlInput.value;
            const newSql = message.sqlInput || '';
            
            // カーソル位置を保存
            const cursorPosition = sqlInput.selectionStart;
            const scrollPosition = sqlInput.scrollTop;
            
            // 内容が異なる場合のみ更新（無限ループ防止）
            if (currentSql !== newSql) {
                sqlInput.value = newSql;
                
                // カーソル位置とスクロール位置を復元
                sqlInput.setSelectionRange(cursorPosition, cursorPosition);
                sqlInput.scrollTop = scrollPosition;
                
                // デバウンスタイマーをクリア（ファイルからの更新は保存不要）
                if (sqlInputDebounceTimer) {
                    clearTimeout(sqlInputDebounceTimer);
                    sqlInputDebounceTimer = null;
                }
            }
        }

        function onSqlInputChange() {
            // デバウンス処理（500ms待機）
            if (sqlInputDebounceTimer) {
                clearTimeout(sqlInputDebounceTimer);
            }
            
            sqlInputDebounceTimer = setTimeout(() => {
                const sql = document.getElementById('sqlInput').value;
                vscode.postMessage({
                    type: 'sqlInputChanged',
                    data: { sql }
                });
            }, 500);
        }

        // 値のフォーマット関数
        function formatValue(value, options) {
            if (value === null || value === undefined) {
                return null;
            }

            const strValue = String(value);

            // 数値フォーマット
            if (options.format === 'number') {
                const num = parseFloat(strValue);
                if (isNaN(num)) {
                    return strValue;
                }

                // 小数点以下の桁数
                let formatted = options.decimal !== undefined
                    ? num.toFixed(options.decimal)
                    : num.toString();

                // カンマ区切り
                if (options.comma) {
                    const parts = formatted.split('.');
                    parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
                    formatted = parts.join('.');
                }

                return formatted;
            }

            // 日時フォーマット
            if (options.format === 'datetime' && options.pattern) {
                try {
                    const date = new Date(strValue);
                    if (!isNaN(date.getTime())) {
                        return formatDateTime(date, options.pattern);
                    }
                } catch (error) {
                    // パースエラーの場合は元の値を返す
                }
            }

            return strValue;
        }

        // 日時フォーマット関数
        function formatDateTime(date, pattern) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return pattern
                .replace('yyyy', String(year))
                .replace('MM', month)
                .replace('dd', day)
                .replace('HH', hours)
                .replace('mm', minutes)
                .replace('ss', seconds);
        }

        // 列スタイル生成関数（ヘッダー用）
        function generateColumnStyle(options) {
            const styles = [];

            if (options.align) {
                styles.push(\`text-align: \${options.align}\`);
            }

            if (options.width) {
                styles.push(\`width: \${options.width}\`);
                styles.push(\`min-width: \${options.width}\`);
            }

            if (options.backgroundColor) {
                styles.push(\`background-color: \${options.backgroundColor}\`);
            }

            if (options.color) {
                styles.push(\`color: \${options.color}\`);
            }

            if (options.fontWeight) {
                styles.push(\`font-weight: \${options.fontWeight}\`);
            }

            return styles.join('; ');
        }

        // 値に基づく条件付きスタイル生成関数（セル用）
        function generateConditionalStyle(value, options) {
            const styles = [];

            // 基本スタイル
            if (options.align) {
                styles.push(\`text-align: \${options.align}\`);
            }

            // 条件付きスタイルの評価
            if (options.conditionalStyles && options.conditionalStyles.length > 0) {
                const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                
                if (!isNaN(numValue)) {
                    // 各条件ルールを評価
                    for (const rule of options.conditionalStyles) {
                        let conditionMet = false;

                        switch (rule.operator) {
                            case '<':
                                conditionMet = numValue < rule.value;
                                break;
                            case '>':
                                conditionMet = numValue > rule.value;
                                break;
                            case '<=':
                                conditionMet = numValue <= rule.value;
                                break;
                            case '>=':
                                conditionMet = numValue >= rule.value;
                                break;
                            case '==':
                                conditionMet = numValue === rule.value;
                                break;
                            case '!=':
                                conditionMet = numValue !== rule.value;
                                break;
                        }

                        // 条件が満たされた場合、スタイルを適用
                        if (conditionMet) {
                            if (rule.styles.color) {
                                styles.push(\`color: \${rule.styles.color}\`);
                            }
                            if (rule.styles.backgroundColor) {
                                styles.push(\`background-color: \${rule.styles.backgroundColor}\`);
                            }
                            if (rule.styles.fontWeight) {
                                styles.push(\`font-weight: \${rule.styles.fontWeight}\`);
                            }
                        }
                    }
                }
            } else {
                // 条件付きスタイルがない場合は基本スタイルのみ
                if (options.backgroundColor) {
                    styles.push(\`background-color: \${options.backgroundColor}\`);
                }
                if (options.color) {
                    styles.push(\`color: \${options.color}\`);
                }
                if (options.fontWeight) {
                    styles.push(\`font-weight: \${options.fontWeight}\`);
                }
            }

            return styles.join('; ');
        }

        /**
         * 行データに基づいて行スタイルを生成
         * @param rowData 行データ
         * @param rowStyleRules 行スタイルルール配列
         * @returns CSSスタイル文字列
         */
        function generateRowStyle(rowData, rowStyleRules) {
            if (!rowStyleRules || rowStyleRules.length === 0) {
                return '';
            }

            const styles = [];

            // 各ルールを評価
            for (const rule of rowStyleRules) {
                const cellValue = rowData[rule.columnName];
                if (cellValue === null || cellValue === undefined) {
                    continue;
                }

                let conditionMet = false;

                // 値の型に応じて条件を評価
                if (typeof rule.value === 'number') {
                    // 数値比較
                    const numValue = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue));
                    if (!isNaN(numValue)) {
                        switch (rule.operator) {
                            case '<':
                                conditionMet = numValue < rule.value;
                                break;
                            case '>':
                                conditionMet = numValue > rule.value;
                                break;
                            case '<=':
                                conditionMet = numValue <= rule.value;
                                break;
                            case '>=':
                                conditionMet = numValue >= rule.value;
                                break;
                            case '==':
                                conditionMet = numValue === rule.value;
                                break;
                            case '!=':
                                conditionMet = numValue !== rule.value;
                                break;
                        }
                    }
                } else {
                    // 文字列比較
                    const strValue = String(cellValue);
                    const compareStr = String(rule.value);
                    switch (rule.operator) {
                        case '==':
                            conditionMet = strValue === compareStr;
                            break;
                        case '!=':
                            conditionMet = strValue !== compareStr;
                            break;
                        case '<':
                            conditionMet = strValue < compareStr;
                            break;
                        case '>':
                            conditionMet = strValue > compareStr;
                            break;
                        case '<=':
                            conditionMet = strValue <= compareStr;
                            break;
                        case '>=':
                            conditionMet = strValue >= compareStr;
                            break;
                    }
                }

                // 条件が満たされた場合、スタイルを適用
                if (conditionMet) {
                    if (rule.styles.color) {
                        styles.push(\`color: \${rule.styles.color}\`);
                    }
                    if (rule.styles.backgroundColor) {
                        styles.push(\`background-color: \${rule.styles.backgroundColor}\`);
                    }
                    if (rule.styles.fontWeight) {
                        styles.push(\`font-weight: \${rule.styles.fontWeight}\`);
                    }
                }
            }

            return styles.join('; ');
        }

        function handleQueryResult(message) {
            // 実行ボタンを再度有効化
            const executeButton = document.getElementById('executeButton');
            executeButton.disabled = false;
            executeButton.textContent = '▶ 実行';

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
                query: document.getElementById('sqlInput').value,
                displayOptions: message.displayOptions,
                rowStyleRules: message.rowStyleRules,
                chartOptions: message.chartOptions
            };

            // 表示オプションをMapに変換
            const displayOptionsMap = new Map();
            if (message.displayOptions) {
                message.displayOptions.forEach(opt => {
                    displayOptionsMap.set(opt.columnName, opt);
                });
            }

            // 行スタイルルール
            const rowStyleRules = message.rowStyleRules || [];

            // グラフオプションがある場合は、トグルボタンとグラフコピーボタンを表示
            if (message.chartOptions) {
                document.getElementById('viewToggle').style.display = 'flex';
                document.getElementById('chartImageCopyBtn').style.display = 'inline-block';
                // グラフを描画
                renderChart(message.columns, message.rows, message.chartOptions, displayOptionsMap, rowStyleRules);
            } else {
                document.getElementById('viewToggle').style.display = 'none';
                document.getElementById('chartImageCopyBtn').style.display = 'none';
            }

            // テーブルを生成
            const { columns, rows, rowCount, executionTime } = message;
            let html = '<table><thead><tr>';
            
            columns.forEach(col => {
                const opts = displayOptionsMap.get(col);
                const style = opts ? generateColumnStyle(opts) : '';
                html += \`<th style="\${style}">\${col}</th>\`;
            });
            html += '</tr></thead><tbody>';

            rows.forEach(row => {
                // 行スタイルを生成
                const rowStyle = generateRowStyle(row, rowStyleRules);
                html += \`<tr style="\${rowStyle}">\`;
                columns.forEach(col => {
                    const opts = displayOptionsMap.get(col);
                    const value = row[col];
                    const formattedValue = opts ? formatValue(value, opts) : value;
                    // 条件付きスタイルを適用（値に基づいて動的にスタイルを変更）
                    const style = opts ? generateConditionalStyle(value, opts) : '';
                    html += \`<td style="\${style}">\${formattedValue !== null && formattedValue !== undefined ? formattedValue : '<NULL>'}</td>\`;
                });
                html += '</tr>';
            });

            html += '</tbody></table>';
            
            document.getElementById('resultTable').innerHTML = html;
            
            // デフォルトはテーブルビューを表示
            switchToTableView();
            
            // グラフオプションがない場合は、グラフコピーボタンを非表示（念のため）
            if (!message.chartOptions) {
                document.getElementById('chartImageCopyBtn').style.display = 'none';
            }
            
            // 結果情報を表示
            if (message.fromCache) {
                const cachedDate = message.cachedAt ? new Date(message.cachedAt).toLocaleString() : '不明';
                document.getElementById('resultInfo').textContent = 
                    \`⚡ キャッシュから表示 (実行日時: \${cachedDate}) | 行数: \${rowCount}\`;
            } else {
                document.getElementById('resultInfo').textContent = 
                    \`実行時間: \${executionTime.toFixed(3)}秒 | 行数: \${rowCount}\`;
            }
            
            showMessage('クエリが正常に実行されました', 'success');
        }

        // グラフ描画用の変数
        let currentChart = null;
        let pieChartLabelPluginRegistered = false; // プラグイン登録状態を管理

        /**
         * グラフを描画
         */
        function renderChart(columns, rows, chartOptions, displayOptionsMap, rowStyleRules) {
            // Chart.jsが読み込まれているか確認
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded');
                showMessage('グラフライブラリが読み込まれていません', 'error');
                return;
            }

            const canvas = document.getElementById('chartCanvas');
            if (!canvas) {
                console.error('Canvas element not found');
                return;
            }
            const ctx = canvas.getContext('2d');

            // 既存のチャートを破棄
            if (currentChart) {
                currentChart.destroy();
                currentChart = null;
            }

            // X軸データを取得
            const labels = rows.map(row => row[chartOptions.xAxis]);

            // Y軸データセットを作成（複数系列対応）
            const datasets = chartOptions.yAxis.map((yColumn, index) => {
                // @columnで指定された色を取得
                const columnOpts = displayOptionsMap.get(yColumn);
                const defaultColors = [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                    '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                ];
                
                const data = rows.map(row => {
                    const value = row[yColumn];
                    return value !== null && value !== undefined ? Number(value) : 0;
                });

                // 円グラフの場合は、カスタムcolorsまたはデフォルトカラーパレットを使用
                let backgroundColor;
                let borderColor;
                
                if (chartOptions.type === 'pie') {
                    // 円グラフ：各データポイント（セグメント）に異なる色を適用
                    // 1. @rowディレクティブで指定された色を優先
                    // 2. colorsパラメータで指定された色
                    // 3. デフォルトカラーパレット
                    
                    backgroundColor = data.map((_, i) => {
                        const rowData = rows[i];
                        const xValue = rowData[chartOptions.xAxis];
                        
                        // @rowディレクティブで指定された色を探す
                        if (rowStyleRules && rowStyleRules.length > 0) {
                            for (const rule of rowStyleRules) {
                                if (rule.columnName === chartOptions.xAxis) {
                                    // 文字列比較
                                    if (typeof rule.value === 'string' && String(xValue) === rule.value) {
                                        if (rule.styles.color) {
                                            return rule.styles.color;
                                        }
                                        if (rule.styles.backgroundColor) {
                                            return rule.styles.backgroundColor;
                                        }
                                    }
                                }
                            }
                        }
                        
                        // colorsパラメータで指定された色
                        if (chartOptions.colors && chartOptions.colors.length > 0) {
                            return chartOptions.colors[i % chartOptions.colors.length];
                        }
                        
                        // デフォルトカラーパレット
                        return defaultColors[i % defaultColors.length];
                    });
                    borderColor = '#ffffff'; // 円グラフのボーダーは白
                } else {
                    // 線グラフ・棒グラフ等：単一色
                    const color = columnOpts?.color || defaultColors[index % defaultColors.length];
                    backgroundColor = color + '33'; // 20% opacity
                    borderColor = color;
                }

                // 混合チャートの場合、各データセットのタイプを設定
                const datasetType = chartOptions.yAxisTypes && chartOptions.yAxisTypes[index]
                    ? chartOptions.yAxisTypes[index]
                    : (chartOptions.type === 'area' ? 'line' : chartOptions.type);

                return {
                    label: yColumn,
                    data: data,
                    type: chartOptions.type === 'mixed' ? datasetType : undefined,
                    borderColor: borderColor,
                    backgroundColor: backgroundColor,
                    borderWidth: chartOptions.type === 'pie' ? 1 : 2,
                    tension: chartOptions.curve === 'smooth' ? 0.4 : 0,
                    fill: chartOptions.type === 'area' || datasetType === 'area'
                };
            });

            // カスタムプラグイン：ラベル線を描画（円グラフ用）
            // プラグインは一度だけ登録する
            if (chartOptions.type === 'pie' && typeof Chart !== 'undefined' && Chart.register && !pieChartLabelPluginRegistered) {
                const labelLinePlugin = {
                    id: 'pieChartLabelLine',
                    afterDraw: (chart) => {
                        if (chart.config.type !== 'pie') return;
                        
                        const ctx = chart.ctx;
                        const chartArea = chart.chartArea;
                        const meta = chart.getDatasetMeta(0);
                        
                        if (!meta || !meta.data || meta.data.length === 0) {
                            return;
                        }
                        
                        // キャンバスのサイズを取得
                        const canvas = chart.canvas;
                        const canvasWidth = canvas.width;
                        const canvasHeight = canvas.height;
                        
                        // ラベルを表示する位置（右側、キャンバス内に収まるように）
                        // 色インジケーター（12px）+ 間隔（5px）+ ラベルテキスト
                        const labelXRight = Math.min(chartArea.right + 30, canvasWidth - 150);
                        const labelSpacing = 22;
                        
                        // フォントと色の設定（VS Codeのテーマに合わせる）
                        const foregroundColor = getComputedStyle(document.body).getPropertyValue('--vscode-foreground') || '#cccccc';
                        const fontFamily = 'sans-serif'; // シンプルなフォントを使用
                        
                        // フォントサイズとスタイルを明示的に設定
                        const fontSize = 12;
                        const fontWeight = 'bold';
                        
                        // フォントを設定して文字列の幅を測定できるようにする
                        ctx.font = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
                        
                        // セグメントを値の大きい順にソート（SQLのORDER BY順に合わせる）
                        const segments = meta.data.map((element, index) => {
                            const value = chart.data.datasets[0].data[index];
                            return {
                                element: element,
                                index: index,
                                value: value
                            };
                        }).sort((a, b) => b.value - a.value); // 大きい順
                        
                        // ソートされた順序でラベルを描画
                        segments.forEach((segmentInfo) => {
                            const element = segmentInfo.element;
                            const index = segmentInfo.index;
                            const model = element;
                            const label = chart.data.labels && chart.data.labels[index] ? chart.data.labels[index] : 'Label ' + index;
                            const value = chart.data.datasets[0].data[index];
                            const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                            
                            // セグメントの中心点を計算
                            const angle = (model.startAngle + model.endAngle) / 2;
                            const radius = model.outerRadius;
                            const centerX = model.x;
                            const centerY = model.y;
                            
                            // セグメントの外側の点（円の外側、少し余裕を持たせる）
                            const labelLineExtension = 20; // 円の外側に伸ばす距離
                            const outerRadius = radius + labelLineExtension;
                            const outerX = centerX + Math.cos(angle) * outerRadius;
                            const outerY = centerY + Math.sin(angle) * outerRadius;
                            
                            // 水平引き出し線の開始点（円の外側の点から水平方向に伸ばす）
                            // 角度に応じて右側または左側にラベルを配置
                            const isRightSide = Math.cos(angle) >= 0; // 右側（-90度〜90度）
                            const horizontalLineStartX = outerX;
                            const horizontalLineStartY = outerY;
                            
                            // ラベルテキストの長さを事前に計算
                            const labelText = label + ' (' + percentage + '%)';
                            const textWidth = ctx.measureText(labelText).width;
                            
                            // 色インジケーターの位置を計算（水平線のY座標に基づく）
                            const indicatorSize = 12;
                            const indicatorSpacing = 5; // インジケーターとテキストの間隔
                            const minDistanceFromChart = 30; // 円グラフからの最小距離
                            
                            // 左側の場合は、文字列の長さを考慮してラベルの右端を計算
                            let labelX;
                            let indicatorX;
                            let horizontalLineEndX;
                            
                            if (isRightSide) {
                                // 右側：固定位置
                                labelX = labelXRight;
                                indicatorX = labelX - indicatorSize - indicatorSpacing;
                                horizontalLineEndX = indicatorX + indicatorSize / 2;
                            } else {
                                // 左側：文字列の長さを考慮して、ラベルの右端が円グラフの左端から適切な距離に配置
                                // ラベルの右端 = 円グラフの左端 - 最小距離
                                const labelRightEdge = chartArea.left - minDistanceFromChart;
                                // ラベルの左端 = 右端 - 文字列の幅
                                const labelLeftEdge = labelRightEdge - textWidth;
                                // インジケーターはラベルの左側に配置
                                indicatorX = labelLeftEdge - indicatorSize - indicatorSpacing;
                                // ラベルの位置（右端、textAlign='right'なので）
                                labelX = labelRightEdge;
                                // 水平線の終点はインジケーターの右端（左側の「ひげ」を防ぐ）
                                horizontalLineEndX = indicatorX + indicatorSize / 2;
                                
                                // キャンバスの左端を超えないように調整
                                const minX = 20; // キャンバスの左端からの最小距離
                                if (indicatorX < minX) {
                                    // インジケーターが左端を超える場合は、全体を右にシフト
                                    const shift = minX - indicatorX;
                                    indicatorX = minX;
                                    labelX += shift;
                                    horizontalLineEndX += shift;
                                }
                            }
                            
                            // 水平線のY座標を計算（キャンバス内に収まるように調整）
                            // ラベルがキャンバスの上下の範囲内に収まるように調整
                            const labelHeight = 20; // ラベルの高さ
                            const minY = 10; // キャンバスの上端からの最小距離
                            const maxY = canvasHeight - 10; // キャンバスの下端からの最小距離
                            
                            let adjustedY = horizontalLineStartY;
                            if (adjustedY < minY + labelHeight / 2) {
                                adjustedY = minY + labelHeight / 2;
                            } else if (adjustedY > maxY - labelHeight / 2) {
                                adjustedY = maxY - labelHeight / 2;
                            }
                            
                            // 水平線の開始点と終点のY座標を同じにする（水平線を保つ）
                            const horizontalLineEndY = adjustedY;
                            const adjustedHorizontalLineStartY = adjustedY;
                            
                            // 線を描画（2段階：放射線 + 水平線）
                            const segmentColor = Array.isArray(model.options.backgroundColor) 
                                ? model.options.backgroundColor[index] 
                                : model.options.backgroundColor;
                            
                            ctx.save();
                            ctx.strokeStyle = segmentColor || '#999999';
                            ctx.lineWidth = 2;
                            
                            // 1. 円の中心から外側への放射線
                            ctx.beginPath();
                            ctx.moveTo(centerX, centerY);
                            ctx.lineTo(outerX, outerY);
                            ctx.stroke();
                            
                            // 2. 外側の点からラベルへの水平引き出し線
                            // まず、外側の点から調整後のY座標まで垂直に線を引く（必要に応じて）
                            ctx.beginPath();
                            if (Math.abs(horizontalLineStartY - adjustedHorizontalLineStartY) > 0.1) {
                                // Y座標が調整されている場合は、まず垂直線を引く
                                ctx.moveTo(horizontalLineStartX, horizontalLineStartY);
                                ctx.lineTo(horizontalLineStartX, adjustedHorizontalLineStartY);
                                ctx.stroke();
                            }
                            // 次に、水平線を引く
                            ctx.beginPath();
                            ctx.moveTo(horizontalLineStartX, adjustedHorizontalLineStartY);
                            ctx.lineTo(horizontalLineEndX, horizontalLineEndY);
                            ctx.stroke();
                            ctx.restore();
                            
                            // ラベルを描画
                            ctx.textAlign = isRightSide ? 'left' : 'right'; // 右側は左揃え、左側は右揃え
                            ctx.textBaseline = 'middle';
                            
                            // 色のインジケーター（小さな四角）を描画（ボーダーなし）
                            // 水平線の終点に合わせて位置を調整
                            const finalIndicatorY = horizontalLineEndY - indicatorSize / 2;
                            ctx.save();
                            ctx.fillStyle = segmentColor || '#999999';
                            ctx.fillRect(indicatorX, finalIndicatorY, indicatorSize, indicatorSize);
                            
                            // テキストを描画（色を明示的に設定、背景色を追加して見やすく）
                            const finalLabelY = horizontalLineEndY;
                            const textBackgroundX = isRightSide 
                                ? labelX - 2  // 右側：ラベルの左端から
                                : labelX - textWidth - 2; // 左側：ラベルの右端から（textAlign='right'なので）
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(textBackgroundX, finalLabelY - 10, textWidth + 4, 20);
                            ctx.fillStyle = foregroundColor || '#000000';
                            ctx.fillText(labelText, labelX, finalLabelY);
                            ctx.restore();
                        });
                    }
                };

                try {
                    Chart.register(labelLinePlugin);
                    pieChartLabelPluginRegistered = true;
                } catch (e) {
                    // 既に登録されている場合は無視
                    console.log('Plugin registration:', e);
                    pieChartLabelPluginRegistered = true; // エラーでも登録済みとして扱う
                }
                
                // 円グラフのサイズを80%に縮小するプラグイン
                const pieSizePlugin = {
                    id: 'pieSizeReducer',
                    afterLayout: (chart) => {
                        if (chart.config.type !== 'pie') return;
                        
                        const meta = chart.getDatasetMeta(0);
                        if (!meta || !meta.data || meta.data.length === 0) {
                            return;
                        }
                        
                        // チャートエリアのサイズを取得
                        const chartArea = chart.chartArea;
                        const availableWidth = chartArea.right - chartArea.left;
                        const availableHeight = chartArea.bottom - chartArea.top;
                        const availableSize = Math.min(availableWidth, availableHeight);
                        
                        // 80%のサイズに縮小
                        const targetRadius = (availableSize * 0.8) / 2;
                        const centerX = (chartArea.left + chartArea.right) / 2;
                        const centerY = (chartArea.top + chartArea.bottom) / 2;
                        
                        // 各セグメントの半径を調整
                        meta.data.forEach((element) => {
                            const model = element;
                            // 半径を80%に縮小
                            model.outerRadius = targetRadius;
                            model.innerRadius = 0; // 円グラフなので内側の半径は0
                            
                            // 中心位置を調整（チャートエリアの中央に配置）
                            model.x = centerX;
                            model.y = centerY;
                        });
                    }
                };
                
                if (chartOptions.type === 'pie' && typeof Chart !== 'undefined' && Chart.register) {
                    try {
                        Chart.register(pieSizePlugin);
                    } catch (e) {
                        // 既に登録されている場合は無視
                        console.log('Pie size plugin registration:', e);
                    }
                }
            }

            // Chart.jsの設定
            const config = {
                type: chartOptions.type === 'mixed' ? 'bar' : (chartOptions.type === 'area' ? 'line' : chartOptions.type),
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: chartOptions.type === 'pie' ? {
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0
                        } : undefined
                    },
                    plugins: {
                        legend: {
                            display: chartOptions.showLegend !== false && chartOptions.type !== 'pie',
                            position: 'top',
                            labels: {
                                color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                            }
                        },
                        title: {
                            display: !!chartOptions.title,
                            text: chartOptions.title || '',
                            color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                display: chartOptions.showGrid !== false,
                                color: getComputedStyle(document.body).getPropertyValue('--vscode-panel-border')
                            },
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                            }
                        },
                        y: {
                            display: true,
                            stacked: chartOptions.stacked || false,
                            grid: {
                                display: chartOptions.showGrid !== false,
                                color: getComputedStyle(document.body).getPropertyValue('--vscode-panel-border')
                            },
                            ticks: {
                                color: getComputedStyle(document.body).getPropertyValue('--vscode-foreground')
                            }
                        }
                    }
                }
            };

            // 円グラフの場合は軸を非表示
            if (chartOptions.type === 'pie') {
                delete config.options.scales;
            }

            // グラフを作成
            try {
                currentChart = new Chart(ctx, config);
            } catch (error) {
                console.error('Error creating chart:', error);
                showMessage('グラフの作成に失敗しました: ' + error.message, 'error');
            }
        }

        /**
         * テーブルビューに切り替え
         */
        function switchToTableView() {
            document.getElementById('resultTable').style.display = 'block';
            document.getElementById('resultChart').style.display = 'none';
            document.getElementById('tableViewBtn').classList.add('active');
            document.getElementById('chartViewBtn').classList.remove('active');
            
            // テーブルビューではTSV/HTMLコピーボタンを表示、グラフコピーボタンを非表示
            document.getElementById('resultButtons').style.display = 'flex';
            document.getElementById('chartImageCopyBtn').style.display = 'none';
        }

        /**
         * グラフビューに切り替え
         */
        function switchToChartView() {
            document.getElementById('resultTable').style.display = 'none';
            document.getElementById('resultChart').style.display = 'block';
            document.getElementById('tableViewBtn').classList.remove('active');
            document.getElementById('chartViewBtn').classList.add('active');
            
            // グラフビューではグラフコピーボタンを表示、TSV/HTMLコピーボタンを非表示
            document.getElementById('resultButtons').style.display = 'none';
            document.getElementById('chartImageCopyBtn').style.display = 'inline-block';
        }

        /**
         * グラフを画像としてクリップボードにコピー
         */
        async function copyChartAsImage() {
            try {
                const canvas = document.getElementById('chartCanvas');
                if (!canvas) {
                    showMessage('グラフが見つかりません', 'error');
                    return;
                }

                // Canvasを白背景のBlobに変換
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        showMessage('画像の生成に失敗しました', 'error');
                        return;
                    }

                    try {
                        // ClipboardItem を使用して画像をクリップボードにコピー
                        const item = new ClipboardItem({ 'image/png': blob });
                        await navigator.clipboard.write([item]);
                        showMessage('グラフを画像としてコピーしました！PowerPointに貼り付けできます', 'success');
                    } catch (err) {
                        console.error('クリップボードへのコピーに失敗:', err);
                        showMessage('クリップボードへのコピーに失敗しました: ' + err.message, 'error');
                    }
                }, 'image/png');

            } catch (error) {
                console.error('グラフコピーエラー:', error);
                showMessage('グラフのコピーに失敗しました: ' + error.message, 'error');
            }
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

        // クエリ保存関連の関数
        function saveCurrentQuery() {
            const sql = document.getElementById('sqlInput').value.trim();
            if (!sql) {
                showMessage('SQLクエリを入力してください', 'error');
                return;
            }

            document.getElementById('queryName').value = '';
            document.getElementById('queryDescription').value = '';
            document.getElementById('queryTags').value = '';
            document.getElementById('saveQuerySql').textContent = sql;
            document.getElementById('saveQueryModal').className = 'modal show';
        }

        function closeSaveQueryDialog() {
            document.getElementById('saveQueryModal').className = 'modal';
        }

        function submitSaveQuery(event) {
            event.preventDefault();

            const name = document.getElementById('queryName').value;
            const description = document.getElementById('queryDescription').value;
            const tagsInput = document.getElementById('queryTags').value;
            const sql = document.getElementById('saveQuerySql').textContent;
            const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

            vscode.postMessage({
                type: 'saveNamedQuery',
                data: {
                    name,
                    description,
                    sql,
                    tags
                }
            });

            closeSaveQueryDialog();
        }

        function openSavedQueries() {
            document.getElementById('savedQueriesModal').className = 'modal show';
            vscode.postMessage({ type: 'getSavedQueries' });
        }

        function setupCursorRules() {
            // Cursor AI Rules セットアップコマンドを実行
            vscode.postMessage({ type: 'setupCursorRules' });
        }

        function handleUpdateCursorRulesButtonVisibility(message) {
            const button = document.getElementById('setupCursorRulesBtn');
            if (button) {
                button.style.display = message.visible ? 'inline-block' : 'none';
            }
        }

        function closeSavedQueries() {
            document.getElementById('savedQueriesModal').className = 'modal';
        }

        function handleSavedQueriesList(message) {
            const container = document.getElementById('savedQueriesContainer');
            
            if (!message.queries || message.queries.length === 0) {
                container.innerHTML = '<p style="color: var(--vscode-descriptionForeground); padding: 20px;">保存されたクエリがありません</p>';
                return;
            }

            let html = '';
            message.queries.forEach(query => {
                const hasCachedResult = query.lastResultFile && query.lastExecutedAt;
                const cachedInfo = hasCachedResult 
                    ? \`<div style="margin-top: 4px; font-size: 11px; color: var(--vscode-charts-green);">📊 キャッシュ有 (実行日時: \${new Date(query.lastExecutedAt).toLocaleString()})</div>\`
                    : '';
                
                html += \`
                    <div class="profile-item" style="margin-bottom: 10px;">
                        <div class="profile-info" style="flex: 1;">
                            <div class="profile-name">\${query.name}</div>
                            <div class="profile-details" style="margin-top: 4px;">
                                \${query.description || '説明なし'}
                            </div>
                            \${query.tags && query.tags.length > 0 ? 
                                '<div style="margin-top: 4px; font-size: 11px; color: var(--vscode-descriptionForeground);">タグ: ' + query.tags.join(', ') + '</div>' 
                                : ''}
                            \${cachedInfo}
                            <div style="margin-top: 8px; font-family: monospace; font-size: 11px; background-color: var(--vscode-editor-background); padding: 8px; border: 1px solid var(--vscode-panel-border); max-height: 100px; overflow-y: auto; white-space: pre-wrap;">
                                \${query.sql}
                            </div>
                        </div>
                        <div class="profile-actions" style="display: flex; flex-direction: column; gap: 4px;">
                            <button onclick="executeSavedQuery('\${query.id}')">\${hasCachedResult ? '⚡ キャッシュ表示' : '▶ 実行'}</button>
                            <button class="secondary" onclick="loadSavedQuery('\${query.id}')">📝 編集</button>
                            <button class="secondary" onclick="deleteSavedQuery('\${query.id}')">🗑️ 削除</button>
                        </div>
                    </div>
                \`;
            });
            
            container.innerHTML = html;
        }

        function executeSavedQuery(queryId) {
            vscode.postMessage({
                type: 'executeNamedQuery',
                data: { queryId }
            });
            closeSavedQueries();
        }

        function loadSavedQuery(queryId) {
            vscode.postMessage({
                type: 'loadNamedQuery',
                data: { queryId }
            });
        }

        function deleteSavedQuery(queryId) {
            if (confirm('このクエリを削除してもよろしいですか？')) {
                vscode.postMessage({
                    type: 'deleteNamedQuery',
                    data: { queryId }
                });
            }
        }

        function handleQueryOperation(message) {
            if (message.type === 'queryLoaded' && message.success) {
                document.getElementById('sqlInput').value = message.query.sql;
                closeSavedQueries();
                
                // デバウンスタイマーをクリア（既にセッション保存済み）
                if (sqlInputDebounceTimer) {
                    clearTimeout(sqlInputDebounceTimer);
                    sqlInputDebounceTimer = null;
                }
                
                showMessage(\`クエリ "\${message.query.name}" を読み込みました（編集可能）\`, 'success');
            } else if (message.type === 'querySaved' && message.success) {
                showMessage('クエリを保存しました', 'success');
            } else if (message.type === 'queryDeleted' && message.success) {
                showMessage('クエリを削除しました', 'success');
            }
        }

        function handleLoadSqlToEditor(message) {
            document.getElementById('sqlInput').value = message.sql;
            
            // デバウンスタイマーをクリア（既にセッション保存済み）
            if (sqlInputDebounceTimer) {
                clearTimeout(sqlInputDebounceTimer);
                sqlInputDebounceTimer = null;
            }
        }

        function handleSqlFormatted(message) {
            const sqlInput = document.getElementById('sqlInput');
            sqlInput.value = message.sql;
            
            // デバウンスタイマーをクリア（既にセッション保存済み）
            if (sqlInputDebounceTimer) {
                clearTimeout(sqlInputDebounceTimer);
                sqlInputDebounceTimer = null;
            }
            
            showMessage('SQLをフォーマットしました', 'success');
        }

        // Display Options ヘルプを表示
        function showDisplayOptionsHelp() {
            document.getElementById('displayOptionsHelpModal').className = 'modal show';
        }

        // Display Options ヘルプを閉じる
        function closeDisplayOptionsHelp() {
            document.getElementById('displayOptionsHelpModal').className = 'modal';
        }

        // サンプルSQLを挿入
        function insertExampleQuery() {
            const sqlInput = document.getElementById('sqlInput');
            const exampleSql = \`/**
 * @column ID align=right
 * @column 売上 align=right format=number comma=true
 * @column 更新日時 format=datetime pattern=yyyy/MM/dd_HH:mm:ss
 */
SELECT ID, 売上, 更新日時 FROM sales_report LIMIT 10;\`;
            
            sqlInput.value = exampleSql;
            closeDisplayOptionsHelp();
            
            // セッションに保存
            vscode.postMessage({
                type: 'sqlInputChanged',
                data: { sql: exampleSql }
            });
            
            showMessage('サンプルSQLを挿入しました', 'success');
        }
    </script>
</body>
</html>`;
    }
}

