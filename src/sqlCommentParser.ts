/**
 * SQLコメントから表示オプションを抽出するパーサー
 */

/** 条件付きスタイルルール */
export interface ConditionalStyleRule {
    /** 条件演算子 (<, >, <=, >=, ==, !=) */
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
    /** 比較値 */
    value: number | string;
    /** 適用するスタイル */
    styles: {
        color?: string;
        backgroundColor?: string;
        bold?: boolean;
        fontWeight?: string;
    };
}

/** 行スタイルルール */
export interface RowStyleRule {
    /** 対象列名 */
    columnName: string;
    /** 条件演算子 (<, >, <=, >=, ==, !=) */
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
    /** 比較値（数値または文字列） */
    value: number | string;
    /** 適用するスタイル */
    styles: {
        color?: string;
        backgroundColor?: string;
        bold?: boolean;
        fontWeight?: string;
    };
}

export interface ColumnDisplayOptions {
    /** 列名 */
    columnName: string;
    /** データ型 (int, float, decimal, text) */
    type?: 'int' | 'float' | 'decimal' | 'text';
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
    /** 条件付きスタイルルール */
    conditionalStyles?: ConditionalStyleRule[];
}

export interface QueryDisplayOptions {
    /** 列ごとの表示オプション */
    columns: Map<string, ColumnDisplayOptions>;
    /** 行スタイルルール */
    rowStyles?: RowStyleRule[];
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
            columns: new Map(),
            rowStyles: []
        };

        // /** ... */ 形式のコメントを抽出
        const commentMatch = sql.match(/\/\*\*([\s\S]*?)\*\//);
        if (!commentMatch) {
            return options;
        }

        const commentContent = commentMatch[1];

        // @column ディレクティブを抽出
        const columnDirectives = commentContent.match(/@column\s+([^\n]+)/g);
        if (columnDirectives) {
            for (const directive of columnDirectives) {
                const columnOption = this.parseColumnDirective(directive);
                if (columnOption) {
                    options.columns.set(columnOption.columnName, columnOption);
                }
            }
        }

        // @row ディレクティブを抽出
        const rowDirectives = commentContent.match(/@row\s+([^\n]+)/g);
        if (rowDirectives) {
            for (const directive of rowDirectives) {
                const rowRule = this.parseRowDirective(directive);
                if (rowRule) {
                    options.rowStyles!.push(rowRule);
                }
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

        // key=value 形式のオプションと条件付きスタイルを抽出
        // ダブルクォートで囲まれた値もサポート: key="value with spaces" または key=value
        const optionMatches = optionsStr.matchAll(/(\w+)=("([^"]*)"|'([^']*)'|([^\s]+))/g);
        for (const optionMatch of optionMatches) {
            const key = optionMatch[1];
            // ダブルクォート、シングルクォート、または通常の値
            const value = optionMatch[3] || optionMatch[4] || optionMatch[5];

            switch (key) {
                case 'type':
                    if (value === 'int' || value === 'float' || value === 'decimal' || value === 'text') {
                        columnOption.type = value;
                    }
                    break;
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
                    // クォートで囲まれている場合はすでに除去されている
                    columnOption.pattern = value;
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

        // 条件付きスタイルの抽出 (if<0:color=red, if>1000:bold=true など)
        const conditionalMatches = optionsStr.matchAll(/if([<>!=]+)(-?\d+(?:\.\d+)?):([^\s]+)/g);
        for (const condMatch of conditionalMatches) {
            const operator = condMatch[1];
            const compareValue = parseFloat(condMatch[2]);
            const styleStr = condMatch[3];

            // 演算子の正規化
            let normalizedOp: ConditionalStyleRule['operator'];
            switch (operator) {
                case '<':
                case '>':
                case '<=':
                case '>=':
                case '==':
                case '!=':
                    normalizedOp = operator;
                    break;
                default:
                    continue; // 不正な演算子はスキップ
            }

            // スタイルのパース (color=red,bold=true のような形式)
            const rule: ConditionalStyleRule = {
                operator: normalizedOp,
                value: compareValue,
                styles: {}
            };

            const styleParts = styleStr.split(',');
            for (const stylePart of styleParts) {
                const [styleKey, styleValue] = stylePart.split('=');
                if (!styleKey || !styleValue) {
                    continue;
                }

                switch (styleKey) {
                    case 'color':
                        rule.styles.color = styleValue;
                        break;
                    case 'bg':
                    case 'backgroundColor':
                        rule.styles.backgroundColor = styleValue;
                        break;
                    case 'bold':
                        if (styleValue === 'true') {
                            rule.styles.bold = true;
                            rule.styles.fontWeight = 'bold';
                        }
                        break;
                    case 'fontWeight':
                        rule.styles.fontWeight = styleValue;
                        break;
                }
            }

            if (!columnOption.conditionalStyles) {
                columnOption.conditionalStyles = [];
            }
            columnOption.conditionalStyles.push(rule);
        }

        return columnOption;
    }

    /**
     * @rowディレクティブをパース
     * @param directive ディレクティブ文字列
     * @returns 行スタイルルール
     */
    private static parseRowDirective(directive: string): RowStyleRule | null {
        // @row 列名演算子値:スタイル の形式
        // 例: @row 国名=="フランス":color=#ff0000,bg=#ffeeee
        // 例: @row 売上>1000000:bg=#ccffcc,bold=true
        
        // 文字列値（クォート付き）と数値両方に対応
        const match = directive.match(/@row\s+(\S+?)([<>!=]+)("([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?)):(.+)/);
        if (!match) {
            return null;
        }

        const columnName = match[1];
        const operator = match[2];
        // クォート付き文字列または数値
        const rawValue = match[4] || match[5] || match[6];
        const styleStr = match[7];

        // 演算子の正規化
        let normalizedOp: RowStyleRule['operator'];
        switch (operator) {
            case '<':
            case '>':
            case '<=':
            case '>=':
            case '==':
            case '!=':
                normalizedOp = operator;
                break;
            default:
                return null; // 不正な演算子
        }

        // 値の型判定（数値 or 文字列）
        let compareValue: number | string;
        if (match[4] || match[5]) {
            // クォート付き = 文字列
            compareValue = rawValue;
        } else {
            // 数値として試みる
            const numValue = parseFloat(rawValue);
            compareValue = isNaN(numValue) ? rawValue : numValue;
        }

        // スタイルのパース (color=red,bold=true,bg=#ffeeee のような形式)
        const rule: RowStyleRule = {
            columnName,
            operator: normalizedOp,
            value: compareValue,
            styles: {}
        };

        const styleParts = styleStr.split(',');
        for (const stylePart of styleParts) {
            const [styleKey, styleValue] = stylePart.trim().split('=');
            if (!styleKey || !styleValue) {
                continue;
            }

            switch (styleKey) {
                case 'color':
                    rule.styles.color = styleValue;
                    break;
                case 'bg':
                case 'backgroundColor':
                    rule.styles.backgroundColor = styleValue;
                    break;
                case 'bold':
                    if (styleValue === 'true') {
                        rule.styles.bold = true;
                        rule.styles.fontWeight = 'bold';
                    }
                    break;
                case 'fontWeight':
                    rule.styles.fontWeight = styleValue;
                    break;
            }
        }

        return rule;
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

    /**
     * 値に基づいて条件付きスタイルを生成
     * @param value セルの値
     * @param options 列オプション
     * @returns CSSスタイル文字列
     */
    static generateConditionalStyle(value: any, options: ColumnDisplayOptions): string {
        const styles: string[] = [];

        // 基本スタイルを追加
        if (options.align) {
            styles.push(`text-align: ${options.align}`);
        }

        // 条件付きスタイルの評価
        if (options.conditionalStyles && options.conditionalStyles.length > 0) {
            // 数値に変換
            const numValue = typeof value === 'number' ? value : parseFloat(String(value));
            
            if (!isNaN(numValue)) {
                // 各条件ルールを評価
                for (const rule of options.conditionalStyles) {
                    // 数値比較のみサポート（ConditionalStyleRuleは数値比較用）
                    if (typeof rule.value !== 'number') {
                        continue;
                    }

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
                            styles.push(`color: ${rule.styles.color}`);
                        }
                        if (rule.styles.backgroundColor) {
                            styles.push(`background-color: ${rule.styles.backgroundColor}`);
                        }
                        if (rule.styles.fontWeight) {
                            styles.push(`font-weight: ${rule.styles.fontWeight}`);
                        }
                    }
                }
            }
        } else {
            // 条件付きスタイルがない場合は基本スタイルのみ
            if (options.backgroundColor) {
                styles.push(`background-color: ${options.backgroundColor}`);
            }
            if (options.color) {
                styles.push(`color: ${options.color}`);
            }
            if (options.fontWeight) {
                styles.push(`font-weight: ${options.fontWeight}`);
            }
        }

        return styles.join('; ');
    }

    /**
     * 行データに基づいて行スタイルを生成
     * @param rowData 行データ（列名 -> 値のマップ）
     * @param rules 行スタイルルール配列
     * @returns CSSスタイル文字列
     */
    static generateRowStyle(rowData: { [key: string]: any }, rules: RowStyleRule[]): string {
        const styles: string[] = [];

        // 各ルールを評価
        for (const rule of rules) {
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
                    styles.push(`color: ${rule.styles.color}`);
                }
                if (rule.styles.backgroundColor) {
                    styles.push(`background-color: ${rule.styles.backgroundColor}`);
                }
                if (rule.styles.fontWeight) {
                    styles.push(`font-weight: ${rule.styles.fontWeight}`);
                }
            }
        }

        return styles.join('; ');
    }
}

