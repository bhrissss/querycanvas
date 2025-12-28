/**
 * SQLフォーマッター
 * SQLクエリを読みやすく整形する
 */
export class SqlFormatter {
    /**
     * SQLキーワード（大文字化対象）
     */
    private static readonly KEYWORDS = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL',
        'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
        'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER',
        'DROP', 'TABLE', 'INDEX', 'VIEW', 'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN',
        'ELSE', 'END', 'WITH', 'RECURSIVE', 'DESC', 'DESCRIBE', 'SHOW', 'EXPLAIN',
        'USE', 'DATABASE', 'SCHEMA', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
        'CONSTRAINT', 'DEFAULT', 'AUTO_INCREMENT', 'CASCADE', 'TRUNCATE'
    ];

    /**
     * 改行を追加するキーワード
     */
    private static readonly NEWLINE_BEFORE = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
        'OUTER JOIN', 'FULL JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT',
        'UNION', 'UNION ALL', 'INSERT', 'UPDATE', 'DELETE', 'SET', 'VALUES'
    ];

    /**
     * SQLをフォーマット
     * @param sql 元のSQL
     * @returns フォーマット済みSQL
     */
    static format(sql: string): string {
        if (!sql || sql.trim().length === 0) {
            return sql;
        }

        let formatted = sql;

        // 1. 余分な空白を削除
        formatted = formatted.replace(/\s+/g, ' ').trim();

        // 2. コメントを一時的に保護
        const comments: string[] = [];
        formatted = formatted.replace(/(--[^\n]*|\/\*[\s\S]*?\*\/)/g, (match) => {
            comments.push(match);
            return `__COMMENT_${comments.length - 1}__`;
        });

        // 3. キーワードを大文字化
        this.KEYWORDS.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            formatted = formatted.replace(regex, keyword.toUpperCase());
        });

        // 4. 主要なキーワードの前に改行を追加
        this.NEWLINE_BEFORE.forEach(keyword => {
            const regex = new RegExp(`\\s+(${keyword.replace(' ', '\\s+')})\\b`, 'gi');
            formatted = formatted.replace(regex, '\n$1');
        });

        // 5. SELECT句のカンマ後に改行
        formatted = formatted.replace(/,(\s*)(?=\w)/g, ',\n    ');

        // 6. FROM句以降のインデント調整
        const lines = formatted.split('\n');
        const result: string[] = [];
        let indentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                continue;
            }

            // インデントレベルの調整
            if (line.match(/^(FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|UNION)/i)) {
                indentLevel = 0;
            } else if (line.match(/^(AND|OR)/i)) {
                indentLevel = 1;
            } else if (i > 0 && lines[i - 1].trim().match(/^SELECT/i)) {
                indentLevel = 1;
            } else if (line.match(/^SELECT/i)) {
                indentLevel = 0;
            }

            // インデントを適用
            const indent = '    '.repeat(indentLevel);
            result.push(indent + line);

            // 次の行のインデント準備
            if (line.match(/^SELECT/i)) {
                indentLevel = 1;
            } else if (line.match(/^(FROM|WHERE|GROUP BY|HAVING|ORDER BY)/i)) {
                indentLevel = 1;
            }
        }

        formatted = result.join('\n');

        // 7. 括弧の整形
        formatted = formatted.replace(/\(\s+/g, '(');
        formatted = formatted.replace(/\s+\)/g, ')');

        // 8. カンマ後のスペース調整（括弧内は除く）
        formatted = formatted.replace(/,(?!\s)/g, ', ');

        // 9. 演算子の前後にスペース
        formatted = formatted.replace(/([=<>!]+)/g, ' $1 ');
        formatted = formatted.replace(/\s+/g, ' ');

        // 10. コメントを復元
        comments.forEach((comment, index) => {
            formatted = formatted.replace(`__COMMENT_${index}__`, comment);
        });

        // 11. 最終的な整形
        formatted = formatted.trim();

        return formatted;
    }

    /**
     * SQLを1行に圧縮（デバッグ用）
     * @param sql 元のSQL
     * @returns 圧縮されたSQL
     */
    static compress(sql: string): string {
        if (!sql || sql.trim().length === 0) {
            return sql;
        }

        // コメントを削除
        let compressed = sql.replace(/--[^\n]*/g, '');
        compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');

        // 複数の空白を1つに
        compressed = compressed.replace(/\s+/g, ' ');

        return compressed.trim();
    }
}

