import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectionProfile } from './types';

/**
 * 接続プロファイルの保存データ構造
 */
interface ConnectionProfilesData {
    connections: ConnectionProfile[];
    activeConnectionId: string | null;
}

/**
 * 接続プロファイル管理クラス
 * 接続情報の保存・読み込み・管理を担当
 */
export class ConnectionProfileManager {
    private profilesData: ConnectionProfilesData;
    private readonly configFilePath: string;
    private readonly secretStorage: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this.secretStorage = context.secrets;
        
        // .vscode/db-connections.json のパスを設定
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('ワークスペースが開かれていません');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const vscodeDir = path.join(workspaceRoot, '.vscode');
        
        // .vscode ディレクトリがない場合は作成
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        this.configFilePath = path.join(vscodeDir, 'db-connections.json');
        this.profilesData = this.loadProfiles();
    }

    /**
     * 接続プロファイルをファイルから読み込み
     */
    private loadProfiles(): ConnectionProfilesData {
        if (!fs.existsSync(this.configFilePath)) {
            return {
                connections: [],
                activeConnectionId: null
            };
        }

        try {
            const data = fs.readFileSync(this.configFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            vscode.window.showErrorMessage(`接続プロファイルの読み込みに失敗しました: ${error}`);
            return {
                connections: [],
                activeConnectionId: null
            };
        }
    }

    /**
     * 接続プロファイルをファイルに保存
     */
    private saveProfiles(): void {
        try {
            const data = JSON.stringify(this.profilesData, null, 2);
            fs.writeFileSync(this.configFilePath, data, 'utf-8');
        } catch (error) {
            vscode.window.showErrorMessage(`接続プロファイルの保存に失敗しました: ${error}`);
            throw error;
        }
    }

    /**
     * すべての接続プロファイルを取得
     */
    getAllProfiles(): ConnectionProfile[] {
        return [...this.profilesData.connections];
    }

    /**
     * 接続プロファイルをIDで取得
     */
    getProfile(id: string): ConnectionProfile | undefined {
        return this.profilesData.connections.find(p => p.id === id);
    }

    /**
     * アクティブな接続プロファイルを取得
     */
    getActiveProfile(): ConnectionProfile | undefined {
        if (!this.profilesData.activeConnectionId) {
            return undefined;
        }
        return this.getProfile(this.profilesData.activeConnectionId);
    }

    /**
     * アクティブな接続IDを取得
     */
    getActiveConnectionId(): string | null {
        return this.profilesData.activeConnectionId;
    }

    /**
     * 新しい接続プロファイルを追加
     */
    async addProfile(profile: ConnectionProfile, password: string): Promise<void> {
        // IDの重複チェック
        if (this.getProfile(profile.id)) {
            throw new Error(`ID "${profile.id}" は既に使用されています`);
        }

        // プロファイルを追加
        this.profilesData.connections.push(profile);

        // パスワードを Secret Storage に保存
        await this.savePassword(profile.id, password);

        // ファイルに保存
        this.saveProfiles();

        // 最初の接続の場合はアクティブに設定
        if (this.profilesData.connections.length === 1) {
            this.setActiveConnection(profile.id);
        }
    }

    /**
     * 接続プロファイルを更新
     */
    async updateProfile(profile: ConnectionProfile, password?: string): Promise<void> {
        const index = this.profilesData.connections.findIndex(p => p.id === profile.id);
        if (index === -1) {
            throw new Error(`ID "${profile.id}" の接続プロファイルが見つかりません`);
        }

        // プロファイルを更新
        this.profilesData.connections[index] = profile;

        // パスワードが指定されている場合は更新
        if (password !== undefined) {
            await this.savePassword(profile.id, password);
        }

        // ファイルに保存
        this.saveProfiles();
    }

    /**
     * 接続プロファイルを削除
     */
    async deleteProfile(id: string): Promise<void> {
        const index = this.profilesData.connections.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error(`ID "${id}" の接続プロファイルが見つかりません`);
        }

        // プロファイルを削除
        this.profilesData.connections.splice(index, 1);

        // パスワードを削除
        await this.deletePassword(id);

        // アクティブな接続だった場合はクリア
        if (this.profilesData.activeConnectionId === id) {
            this.profilesData.activeConnectionId = 
                this.profilesData.connections.length > 0 
                    ? this.profilesData.connections[0].id 
                    : null;
        }

        // ファイルに保存
        this.saveProfiles();
    }

    /**
     * アクティブな接続を設定
     */
    setActiveConnection(id: string): void {
        if (!this.getProfile(id)) {
            throw new Error(`ID "${id}" の接続プロファイルが見つかりません`);
        }

        this.profilesData.activeConnectionId = id;
        this.saveProfiles();
    }

    /**
     * パスワードを Secret Storage に保存
     */
    private async savePassword(profileId: string, password: string): Promise<void> {
        const key = this.getPasswordKey(profileId);
        await this.secretStorage.store(key, password);
    }

    /**
     * パスワードを Secret Storage から取得
     */
    async getPassword(profileId: string): Promise<string | undefined> {
        const key = this.getPasswordKey(profileId);
        return await this.secretStorage.get(key);
    }

    /**
     * パスワードを Secret Storage から削除
     */
    private async deletePassword(profileId: string): Promise<void> {
        const key = this.getPasswordKey(profileId);
        await this.secretStorage.delete(key);
    }

    /**
     * Secret Storage のキーを生成
     */
    private getPasswordKey(profileId: string): string {
        return `vsex001.db.password.${profileId}`;
    }

    /**
     * 一意なIDを生成
     */
    static generateId(): string {
        return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

