import * as fs from 'fs';

/**
 * TSVファイルを読み込むユーティリティ
 */
export class TSVReader {
    /**
     * TSVファイルを読み込んでクエリ結果形式に変換
     */
    static readTSVFile(filePath: string): { columns: string[], rows: any[][], rowCount: number } | null {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                return null;
            }

            // ヘッダー行（カラム名）
            const columns = lines[0].split('\t');

            // データ行
            const rows: any[][] = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split('\t').map(value => {
                    // エスケープされた文字を復元
                    if (value === 'NULL') {
                        return null;
                    }
                    return value
                        .replace(/\\t/g, '\t')
                        .replace(/\\n/g, '\n')
                        .replace(/\\r/g, '\r');
                });
                rows.push(values);
            }

            return {
                columns,
                rows,
                rowCount: rows.length
            };
        } catch (error) {
            console.error('TSVファイル読み込みエラー:', error);
            return null;
        }
    }
}

