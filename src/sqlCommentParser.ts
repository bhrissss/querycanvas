/**
 * SQLコメントから表示オプションを抽出するパーサー
 */

export interface ColumnDisplayOptions {
    /** 列名 */
    columnName: string;
    /** テキスト配置 (left, center, right) */
    align?: 'left' | 'center' | 'right';
    /** フォーマット種別 */
    format?: 'number' | 'datetime' | 'text';
    /** カンマ区切り（数値用） */
    comma?: boolean;
    /** 小数点以下の桁数（数値用） */
    decimal?: number;
    /** 日時フォーマットパターン */
    pattern?: string;
    /** 列幅 */
    width?: string;
    /** 背景色 */
    backgroundColor?: string;
    /** 文字色 */
    color?: string;
    /** フォントウェイト */
    fontWeight?: string;
}

export interface QueryDisplayOptions {
    /** 列ごとの表示オプション */
    columns: Map<string, ColumnDisplayOptions>;
}

/**
 * SQLコメントパーサー
 */
export class SqlCommentParser {
    /**
     * SQLからコメントオプションを抽出
     * @param sql SQLクエリ
     * @returns 表示オプション
     */
    static parseOptions(sql: string): QueryDisplayOptions {
        const options: QueryDisplayOptions = {
            columns: new Map()
        };

        // /** ... */ 形式のコメントを抽出
        const commentMatch = sql.match(/\/\*\*([\s\S]*?)\*\//);
        if (!commentMatch) {
            return options;
        }

        const commentContent = commentMatch[1];

        // @column ディレクティブを抽出
        const columnDirectives = commentContent.match(/@column\s+([^\n]+)/g);
        if (!columnDirectives) {
            return options;
        }

        for (const directive of columnDirectives) {
            const columnOption = this.parseColumnDirective(directive);
            if (columnOption) {
                options.columns.set(columnOption.columnName, columnOption);
            }
        }

        return options;
    }

    /**
     * @columnディレクティブをパース
     * @param directive ディレクティブ文字列
     * @returns 列オプション
     */
    private static parseColumnDirective(directive: string): ColumnDisplayOptions | null {
        // @column 列名 key=value key=value ... の形式
        const match = directive.match(/@column\s+(\S+)\s+(.*)/);
        if (!match) {
            return null;
        }

        const columnName = match[1];
        const optionsStr = match[2];

        const columnOption: ColumnDisplayOptions = {
            columnName
        };

        // key=value 形式のオプションを抽出
        const optionMatches = optionsStr.matchAll(/(\w+)=([^\s]+)/g);
        for (const optionMatch of optionMatches) {
            const key = optionMatch[1];
            const value = optionMatch[2];

            switch (key) {
                case 'align':
                    if (value === 'left' || value === 'center' || value === 'right') {
                        columnOption.align = value;
                    }
                    break;
                case 'format':
                    if (value === 'number' || value === 'datetime' || value === 'text') {
                        columnOption.format = value;
                    }
                    break;
                case 'comma':
                    columnOption.comma = value === 'true';
                    break;
                case 'decimal':
                    columnOption.decimal = parseInt(value, 10);
                    break;
                case 'pattern':
                    // pattern="yyyy/MM/dd HH:mm:ss" のようにクォートで囲まれている可能性
                    columnOption.pattern = value.replace(/["']/g, '');
                    break;
                case 'width':
                    columnOption.width = value;
                    break;
                case 'bg':
                case 'backgroundColor':
                    columnOption.backgroundColor = value;
                    break;
                case 'color':
                    columnOption.color = value;
                    break;
                case 'bold':
                    if (value === 'true') {
                        columnOption.fontWeight = 'bold';
                    }
                    break;
            }
        }

        return columnOption;
    }

    /**
     * 値をフォーマット
     * @param value 元の値
     * @param options 列オプション
     * @returns フォーマット済み値
     */
    static formatValue(value: any, options: ColumnDisplayOptions): string {
        if (value === null || value === undefined) {
            return '';
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
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                formatted = parts.join('.');
            }

            return formatted;
        }

        // 日時フォーマット
        if (options.format === 'datetime' && options.pattern) {
            try {
                const date = new Date(strValue);
                if (!isNaN(date.getTime())) {
                    return this.formatDateTime(date, options.pattern);
                }
            } catch (error) {
                // パースエラーの場合は元の値を返す
            }
        }

        return strValue;
    }

    /**
     * 日時をフォーマット
     * @param date 日時
     * @param pattern パターン (yyyy/MM/dd HH:mm:ss など)
     * @returns フォーマット済み文字列
     */
    private static formatDateTime(date: Date, pattern: string): string {
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

    /**
     * 列のスタイルを生成
     * @param options 列オプション
     * @returns CSSスタイル文字列
     */
    static generateColumnStyle(options: ColumnDisplayOptions): string {
        const styles: string[] = [];

        if (options.align) {
            styles.push(`text-align: ${options.align}`);
        }

        if (options.width) {
            styles.push(`width: ${options.width}`);
            styles.push(`min-width: ${options.width}`);
        }

        if (options.backgroundColor) {
            styles.push(`background-color: ${options.backgroundColor}`);
        }

        if (options.color) {
            styles.push(`color: ${options.color}`);
        }

        if (options.fontWeight) {
            styles.push(`font-weight: ${options.fontWeight}`);
        }

        return styles.join('; ');
    }
}

