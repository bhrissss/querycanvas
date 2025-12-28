import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * クエリ結果のメタデータ
 */
export interface QueryResultMetadata {
    name: string;
    comment: string;
    query: string;
    timestamp: string;
    rowCount: number;
}

/**
 * 保存オプション
 */
export interface SaveOptions {
    format: 'tsv' | 'json';
    name: string;
    comment: string;
    query: string;
}

/**
 * クエリ結果を保存するクラス
 */
export class QueryResultSaver {
    private workspaceRoot: string;
    private resultsDir: string;
    private metadataFile: string;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('ワークスペースが開かれていません');
        }

        this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        this.resultsDir = path.join(this.workspaceRoot, 'querycanvas-results');
        this.metadataFile = path.join(this.resultsDir, 'metadata.json');

        // ディレクトリを作成
        this.ensureDirectories();
    }

    /**
     * 必要なディレクトリを作成
     */
    private ensureDirectories(): void {
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    /**
     * クエリ結果を保存
     */
    async saveQueryResult(
        columns: string[],
        rows: any[][],
        options: SaveOptions
    ): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sanitizedName = this.sanitizeFileName(options.name);
        const fileName = `${timestamp}_${sanitizedName}.${options.format}`;
        const filePath = path.join(this.resultsDir, fileName);

        // データを保存
        if (options.format === 'tsv') {
            this.saveTSV(filePath, columns, rows);
        } else {
            this.saveJSON(filePath, columns, rows);
        }

        // メタデータを保存
        await this.saveMetadata({
            name: options.name,
            comment: options.comment,
            query: options.query,
            timestamp: new Date().toISOString(),
            rowCount: rows.length
        }, fileName);

        return filePath;
    }

    /**
     * TSV形式で保存
     */
    private saveTSV(filePath: string, columns: string[], rows: any[][]): void {
        const lines: string[] = [];
        
        // ヘッダー行
        lines.push(columns.join('\t'));
        
        // データ行
        for (const row of rows) {
            const values = row.map(value => {
                if (value === null || value === undefined) {
                    return 'NULL';
                }
                // タブ、改行、キャリッジリターンをエスケープ
                return String(value)
                    .replace(/\t/g, '\\t')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r');
            });
            lines.push(values.join('\t'));
        }
        
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    }

    /**
     * JSON形式で保存
     */
    private saveJSON(filePath: string, columns: string[], rows: any[][]): void {
        const data = rows.map(row => {
            const obj: any = {};
            columns.forEach((col, index) => {
                obj[col] = row[index];
            });
            return obj;
        });
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    /**
     * メタデータを保存
     */
    private async saveMetadata(metadata: QueryResultMetadata, fileName: string): Promise<void> {
        let allMetadata: Record<string, QueryResultMetadata> = {};
        
        // 既存のメタデータを読み込み
        if (fs.existsSync(this.metadataFile)) {
            try {
                const content = fs.readFileSync(this.metadataFile, 'utf-8');
                allMetadata = JSON.parse(content);
            } catch (error) {
                console.error('メタデータの読み込みエラー:', error);
            }
        }
        
        // 新しいメタデータを追加
        allMetadata[fileName] = metadata;
        
        // 保存
        fs.writeFileSync(
            this.metadataFile,
            JSON.stringify(allMetadata, null, 2),
            'utf-8'
        );
    }

    /**
     * すべてのメタデータを取得
     */
    getAllMetadata(): Record<string, QueryResultMetadata> {
        if (!fs.existsSync(this.metadataFile)) {
            return {};
        }
        
        try {
            const content = fs.readFileSync(this.metadataFile, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('メタデータの読み込みエラー:', error);
            return {};
        }
    }

    /**
     * ファイル名をサニタイズ
     */
    private sanitizeFileName(name: string): string {
        return name
            .replace(/[^a-zA-Z0-9_\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')
            .substring(0, 50);
    }

    /**
     * 保存先ディレクトリのパスを取得
     */
    getResultsDirectory(): string {
        return this.resultsDir;
    }
}

