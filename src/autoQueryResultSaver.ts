import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * クエリ結果を自動保存するクラス
 */
export class AutoQueryResultSaver {
    private workspaceRoot: string;
    private autoSaveDir: string;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('ワークスペースが開かれていません');
        }

        this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        this.autoSaveDir = path.join(this.workspaceRoot, 'query-results', 'auto-saved');

        // ディレクトリを作成
        this.ensureDirectories();
    }

    /**
     * 必要なディレクトリを作成
     */
    private ensureDirectories(): void {
        if (!fs.existsSync(this.autoSaveDir)) {
            fs.mkdirSync(this.autoSaveDir, { recursive: true });
        }
    }

    /**
     * クエリ結果を自動保存
     */
    autoSaveQueryResult(
        columns: string[],
        rows: any[][],
        query: string
    ): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const fileName = `${timestamp}_auto.tsv`;
        const filePath = path.join(this.autoSaveDir, fileName);

        // TSV形式で保存
        this.saveTSV(filePath, columns, rows);

        // メタデータも保存
        this.saveMetadata(fileName, query, rows.length);

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
     * メタデータを保存
     */
    private saveMetadata(fileName: string, query: string, rowCount: number): void {
        const metadataFile = path.join(this.autoSaveDir, 'metadata.json');
        let allMetadata: Record<string, any> = {};
        
        // 既存のメタデータを読み込み
        if (fs.existsSync(metadataFile)) {
            try {
                const content = fs.readFileSync(metadataFile, 'utf-8');
                allMetadata = JSON.parse(content);
            } catch (error) {
                console.error('メタデータの読み込みエラー:', error);
            }
        }
        
        // 新しいメタデータを追加
        allMetadata[fileName] = {
            query: query.trim(),
            timestamp: new Date().toISOString(),
            rowCount: rowCount,
            autoSaved: true
        };
        
        // 保存（最新50件のみ保持）
        const entries = Object.entries(allMetadata);
        if (entries.length > 50) {
            // 古い順にソートして最新50件のみ残す
            entries.sort((a, b) => 
                new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime()
            );
            allMetadata = Object.fromEntries(entries.slice(0, 50));
        }
        
        fs.writeFileSync(
            metadataFile,
            JSON.stringify(allMetadata, null, 2),
            'utf-8'
        );
    }

    /**
     * 古いファイルをクリーンアップ（30日以上前のファイルを削除）
     */
    cleanupOldFiles(): void {
        try {
            const files = fs.readdirSync(this.autoSaveDir);
            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

            files.forEach(file => {
                if (file === 'metadata.json') return;
                
                const filePath = path.join(this.autoSaveDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime.getTime() < thirtyDaysAgo) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('ファイルクリーンアップエラー:', error);
        }
    }
}

