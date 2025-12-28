import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * セッション状態
 */
export interface SessionState {
    /** 接続プロファイルID */
    connectionId: string | null;
    /** 接続状態 */
    isConnected: boolean;
    /** SQL入力内容 */
    sqlInput: string;
    /** 最終更新日時 */
    lastUpdated: string;
}

/**
 * セッション状態を管理するクラス
 */
export class SessionStateManager {
    private workspaceRoot: string;
    private stateFile: string;
    private currentState: SessionState;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('ワークスペースが開かれていません');
        }

        this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        this.stateFile = path.join(this.workspaceRoot, '.vscode', 'querycanvas-session.json');

        // 初期状態
        this.currentState = {
            connectionId: null,
            isConnected: false,
            sqlInput: '',
            lastUpdated: new Date().toISOString()
        };

        // 既存の状態を読み込み
        this.loadState();
    }

    /**
     * 状態を読み込み
     */
    private loadState(): void {
        if (!fs.existsSync(this.stateFile)) {
            return;
        }

        try {
            const content = fs.readFileSync(this.stateFile, 'utf-8');
            const loaded = JSON.parse(content);
            
            // 接続状態は復元しない（セキュリティ上、毎回接続し直す）
            this.currentState = {
                ...loaded,
                isConnected: false
            };
        } catch (error) {
            console.error('セッション状態の読み込みエラー:', error);
        }
    }

    /**
     * 状態を保存
     */
    private saveState(): void {
        try {
            // .vscodeディレクトリが存在しない場合は作成
            const vscodeDir = path.dirname(this.stateFile);
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }

            // 状態を更新
            this.currentState.lastUpdated = new Date().toISOString();

            // JSONファイルに保存
            fs.writeFileSync(
                this.stateFile,
                JSON.stringify(this.currentState, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('セッション状態の保存エラー:', error);
        }
    }

    /**
     * 現在の状態を取得
     */
    getState(): SessionState {
        return { ...this.currentState };
    }

    /**
     * 状態をファイルから再読み込み（外部変更を反映）
     */
    reloadState(): void {
        this.loadState();
    }

    /**
     * 接続状態を更新
     */
    updateConnection(connectionId: string | null, isConnected: boolean): void {
        this.currentState.connectionId = connectionId;
        this.currentState.isConnected = isConnected;
        this.saveState();
    }

    /**
     * SQL入力内容を更新
     */
    updateSqlInput(sql: string): void {
        this.currentState.sqlInput = sql;
        this.saveState();
    }

    /**
     * 状態をクリア
     */
    clearState(): void {
        this.currentState = {
            connectionId: null,
            isConnected: false,
            sqlInput: '',
            lastUpdated: new Date().toISOString()
        };
        this.saveState();
    }
}

