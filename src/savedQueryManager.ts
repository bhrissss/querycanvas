import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 保存されたクエリ
 */
export interface SavedQuery {
    id: string;
    name: string;
    description: string;
    sql: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    lastResultFile?: string;  // 最後に実行したときのTSVファイルパス
    lastExecutedAt?: string;  // 最後に実行した日時
}

/**
 * クエリライブラリを管理するクラス
 */
export class SavedQueryManager {
    private workspaceRoot: string;
    private queriesFile: string;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('ワークスペースが開かれていません');
        }

        this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        this.queriesFile = path.join(this.workspaceRoot, '.vscode', 'querycanvas-queries.json');

        // ディレクトリを作成
        this.ensureDirectories();
    }

    /**
     * 必要なディレクトリを作成
     */
    private ensureDirectories(): void {
        const vscodeDir = path.dirname(this.queriesFile);
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }
    }

    /**
     * クエリを保存
     */
    saveQuery(query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>): SavedQuery {
        const queries = this.getAllQueries();
        
        const newQuery: SavedQuery = {
            ...query,
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        queries.push(newQuery);
        this.writeQueries(queries);
        
        return newQuery;
    }

    /**
     * クエリを更新
     */
    updateQuery(id: string, updates: Partial<Omit<SavedQuery, 'id' | 'createdAt'>>): SavedQuery | null {
        const queries = this.getAllQueries();
        const index = queries.findIndex(q => q.id === id);
        
        if (index === -1) {
            return null;
        }
        
        queries[index] = {
            ...queries[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.writeQueries(queries);
        return queries[index];
    }

    /**
     * クエリの実行結果ファイルを記録
     */
    updateLastResult(id: string, resultFilePath: string): SavedQuery | null {
        return this.updateQuery(id, {
            lastResultFile: resultFilePath,
            lastExecutedAt: new Date().toISOString()
        });
    }

    /**
     * クエリを削除
     */
    deleteQuery(id: string): boolean {
        const queries = this.getAllQueries();
        const filtered = queries.filter(q => q.id !== id);
        
        if (filtered.length === queries.length) {
            return false; // 削除対象が見つからなかった
        }
        
        this.writeQueries(filtered);
        return true;
    }

    /**
     * すべてのクエリを取得
     */
    getAllQueries(): SavedQuery[] {
        if (!fs.existsSync(this.queriesFile)) {
            return [];
        }
        
        try {
            const content = fs.readFileSync(this.queriesFile, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('クエリファイルの読み込みエラー:', error);
            return [];
        }
    }

    /**
     * IDでクエリを取得
     */
    getQuery(id: string): SavedQuery | null {
        const queries = this.getAllQueries();
        return queries.find(q => q.id === id) || null;
    }

    /**
     * タグでクエリを検索
     */
    getQueriesByTag(tag: string): SavedQuery[] {
        const queries = this.getAllQueries();
        return queries.filter(q => q.tags.includes(tag));
    }

    /**
     * 名前でクエリを検索
     */
    searchQueries(searchTerm: string): SavedQuery[] {
        const queries = this.getAllQueries();
        const term = searchTerm.toLowerCase();
        
        return queries.filter(q => 
            q.name.toLowerCase().includes(term) ||
            q.description.toLowerCase().includes(term) ||
            q.sql.toLowerCase().includes(term)
        );
    }

    /**
     * クエリをファイルに書き込み
     */
    private writeQueries(queries: SavedQuery[]): void {
        try {
            fs.writeFileSync(
                this.queriesFile,
                JSON.stringify(queries, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('クエリファイルの書き込みエラー:', error);
            throw error;
        }
    }

    /**
     * ユニークなIDを生成
     */
    private generateId(): string {
        return `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * クエリファイルのパスを取得
     */
    getQueriesFilePath(): string {
        return this.queriesFile;
    }
}

