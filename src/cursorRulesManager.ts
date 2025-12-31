import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Cursor AI Rules Manager
 * .cursorrules ファイルへのQueryCanvasルール追加を管理
 */
export class CursorRulesManager {
    private static readonly SECTION_START = '# ========================================';
    private static readonly SECTION_TITLE = '# QueryCanvas - Database Client Rules';
    private static readonly SECTION_END = '# ========================================';
    private static readonly HASH_MARKER = '# QueryCanvas-Hash:';

    /**
     * .cursorrules にQueryCanvasのルールを追加
     */
    public static async addQueryCanvasRules(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const cursorRulesPath = path.join(rootPath, '.cursorrules');

        try {
            // 既存の .cursorrules を読み込む
            let content = '';
            let fileExists = false;

            if (fs.existsSync(cursorRulesPath)) {
                content = fs.readFileSync(cursorRulesPath, 'utf8');
                fileExists = true;

                // 既にQueryCanvasのルールがある場合
                if (this.hasQueryCanvasSection(content)) {
                    const choice = await vscode.window.showWarningMessage(
                        'QueryCanvasのルールは既に存在します。更新しますか？',
                        'はい', 'いいえ'
                    );
                    if (choice !== 'はい') {
                        return;
                    }

                    // 既存のQueryCanvasセクションを削除
                    content = this.removeQueryCanvasSection(content);
                }
            }

            // テンプレートを生成
            const template = this.getTemplate();

            // ルールを追加
            if (fileExists && content.trim().length > 0) {
                // 既存のルールの最後に追加
                content = content.trimEnd() + '\n\n' + template;
            } else {
                // 新規作成
                content = template;
            }

            // ファイルに書き込み
            fs.writeFileSync(cursorRulesPath, content, 'utf8');

            // 成功メッセージ
            const choice = await vscode.window.showInformationMessage(
                '✅ .cursorrules にQueryCanvasのルールを追加しました！\n\nCursor AI に試してください：\n"@Codebase PowerPointに貼り付けられるクエリを作って"',
                'ファイルを開く', '閉じる'
            );

            if (choice === 'ファイルを開く') {
                const doc = await vscode.workspace.openTextDocument(cursorRulesPath);
                await vscode.window.showTextDocument(doc);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`エラーが発生しました: ${error}`);
        }
    }

    /**
     * QueryCanvasセクションが存在するか確認
     */
    private static hasQueryCanvasSection(content: string): boolean {
        return content.includes(this.SECTION_TITLE);
    }

    /**
     * QueryCanvasセクションを削除
     */
    private static removeQueryCanvasSection(content: string): string {
        const lines = content.split('\n');
        const result: string[] = [];
        let inQueryCanvasSection = false;
        let sectionStartIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // セクションの開始を検出
            if (line.includes(this.SECTION_TITLE)) {
                inQueryCanvasSection = true;
                sectionStartIndex = i;
                // セクションの前の空行を削除（最大2行）
                while (result.length > 0 && result[result.length - 1].trim() === '') {
                    result.pop();
                }
                continue;
            }

            // セクション内の場合はスキップ
            if (inQueryCanvasSection) {
                // セクションの終わりを検出（次のセクションまたはファイル終端）
                if (line.startsWith('# ===') && i > sectionStartIndex + 2) {
                    // 次のセクションの開始なので、この行は残す
                    inQueryCanvasSection = false;
                    result.push(line);
                }
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    }

    /**
     * テンプレートのコンテンツ部分を取得（ハッシュ計算用）
     */
    private static getTemplateContent(): string {
        const version = this.getExtensionVersion();

        return `## ⚠️ MOST IMPORTANT: SQL Display Options Syntax

When generating SQL with display options, follow these rules EXACTLY:

### @column directive (cell styling)
\`\`\`sql
@column <name> type=int if<0:color=red
\`\`\`
- Use \`if<operator><value>:style\` for conditions
- Example: \`@column 売上 type=int if<0:color=red if>1000000:color=green\`

### @row directive (entire row styling)
\`\`\`sql
@row <column_name><operator><value>:<styles>
\`\`\`
- **NO \`if\` keyword!**
- Use \`==\` (double equals) for equality
- Quote strings: \`"value"\` or \`'value'\`
- Use \`bg\` NOT \`background\`
- Example: \`@row 曜日=="土":bg=#eeeeff\`
- Example: \`@row 売上>1000000:bg=#ccffcc,bold=true\`

### @chart directive (graph visualization) 🆕
\`\`\`sql
@chart type=line x=日付 y=売上,利益
@chart type=mixed x=月 y=売上:bar,目標:line
\`\`\`
- **Required:** \`type\`, \`x\` (or \`xAxis\`), \`y\` (or \`yAxis\`)
- **Chart types:** \`line\`, \`bar\`, \`pie\`, \`area\`, \`scatter\`, \`mixed\`
- **Y-axis:** Comma-separated for multiple series (e.g., \`y=店舗A,店舗B,店舗C\`)
- **Mixed charts:** Specify type for each series: \`y=売上:bar,目標:line,達成率:line\`
- **Optional:** \`title="タイトル"\`, \`legend=true\`, \`grid=true\`, \`stacked=true\`, \`curve=smooth\`
- Example: \`@chart type=line x=日付 y=小村井店,京成小岩店 title="店舗別売上推移"\`
- Example: \`@chart type=mixed x=月 y=売上:bar,目標:line title="売上と目標"\`

### ❌ WRONG Examples
\`\`\`sql
@row if 曜日=土:background=#eee     ❌ NO! Has 'if', uses '=', uses 'background'
@row 国名=フランス:bg=#fee           ❌ NO! No quotes, uses single '='
@chart x=日付                       ❌ NO! Missing required 'type' and 'y'
\`\`\`

### ✅ CORRECT Examples
\`\`\`sql
@row 曜日=="土":bg=#eee              ✅ YES!
@row 国名=="フランス":bg=#fee        ✅ YES!
@row 売上>1000000:bg=#ccffcc         ✅ YES!
@chart type=line x=日付 y=売上       ✅ YES!
@chart type=mixed x=月 y=売上:bar,目標:line ✅ YES!
\`\`\`

---

## QueryCanvas Integration

This project uses QueryCanvas for database access and SQL query management.

### Session File

**Location:** \`.vscode/querycanvas-session.json\`

Contains:
- Current SQL query in the editor
- Active database connection ID
- You can edit this file directly to modify SQL

**Example prompts for Cursor AI:**
\`\`\`
Edit .vscode/querycanvas-session.json to add a WHERE clause filtering by date
\`\`\`

\`\`\`
Modify the SQL in the session file to add display options for PowerPoint
\`\`\`

### SQL Display Options

Format query results using \`/** @column ... */\` and \`/** @row ... */\` comments:

#### Column Styling (individual cells)
\`\`\`sql
/**
 * @column amount type=int align=right format=number comma=true if<0:color=red
 * @column date format=datetime pattern=yyyy/MM/dd
 */
SELECT amount, date FROM sales;
\`\`\`

#### Row Styling (entire rows)
\`\`\`sql
/**
 * @row 曜日=="土":bg=#eeeeff
 * @row 曜日=="日":bg=#ffeeee
 * @row 売上>1000000:bg=#ccffcc,bold=true
 * @column 売上 type=int align=right format=number comma=true
 */
SELECT 曜日, 売上 FROM daily_sales;
\`\`\`

#### Graph Visualization 🆕
\`\`\`sql
/**
 * @chart type=line x=日付 y=小村井店,京成小岩店 title="店舗別売上推移"
 * @row 曜日=="土":bg=#eeeeff
 * @row 曜日=="日":bg=#ffeeee
 * @column 小村井店 type=int align=right format=number comma=true color="#FF0000"
 * @column 京成小岩店 type=int align=right format=number comma=true color="#008800"
 */
SELECT 日付, 曜日, 小村井店, 京成小岩店 FROM daily_sales;
\`\`\`

**Chart types:**
- \`line\` - Line chart (trends, time-series)
- \`bar\` - Bar chart (category comparison)
- \`pie\` - Pie chart (proportions, market share)
- \`area\` - Area chart (cumulative data)
- \`scatter\` - Scatter plot (correlations)
- \`mixed\` - Mixed chart (bar + line): \`y=売上:bar,目標:line\`

**Pie chart color specification:**
For pie charts, use \`@row\` directives to specify colors for each segment:
\`\`\`sql
/**
 * @chart type=pie x=店舗名 y=件数 title="店舗別シェア"
 * @row 店舗名=="小村井店":color=#FF6384
 * @row 店舗名=="京成小岩店":color=#36A2EB
 * @row 店舗名=="その他":color=#FFCE56
 */
SELECT 店舗名, 件数 FROM sales;
\`\`\`

**Alternative:** You can also use \`colors\` parameter:
\`\`\`sql
@chart type=pie x=店舗名 y=件数 colors="#FF6384,#36A2EB,#FFCE56"
\`\`\`

**Priority:** \`@row\` directives > \`colors\` parameter > default palette

**View toggle:**
- **📊 テーブル** button: Table view
- **📈 グラフ** button: Chart view
- **📊 グラフコピー** button: Copy chart as image for PowerPoint

**Mixed chart example:**
\`\`\`sql
/**
 * @chart type=mixed x=月 y=売上:bar,目標:line title="売上実績と目標"
 * @column 売上 type=int align=right format=number comma=true color="#36A2EB"
 * @column 目標 type=int align=right format=number comma=true color="#FF6384"
 */
SELECT 月, 売上, 目標 FROM monthly_sales;
\`\`\`

**Common options:**
- \`align=right\` - Right align (recommended for numbers)
- \`format=number comma=true\` - Add thousand separators (1,234,567)
- \`decimal=2\` - 2 decimal places (e.g., 123.45)
- \`format=datetime pattern=yyyy/MM/dd\` - Date formatting
- \`if<0:color=red\` - Conditional styling (negatives in red) - FOR @column ONLY
- \`if>=100:color=green,bold=true\` - Multiple styles - FOR @column ONLY

**Row styling (entire row):**
- \`@row 列名=="値":bg=#色\` - String comparison (quotes required!)
- \`@row 列名>1000:bg=#色,bold=true\` - Numeric comparison
- **IMPORTANT:** No \`if\` keyword, use \`==\` not \`=\`, quote strings

**Example prompts:**
\`\`\`
Add display options to format the 'price' column with commas and 2 decimal places
\`\`\`

\`\`\`
Create a sales report query with conditional styling: negative values red, values over 1M green
\`\`\`

\`\`\`
Add row styling to highlight weekends (Saturdays in light blue, Sundays in light red)
\`\`\`

### Syntax Comparison (IMPORTANT!)

| Feature | Column Style | Row Style |
|---------|-------------|-----------|
| Directive | \`@column\` | \`@row\` |
| Conditional | \`if<0:color=red\` | \`売上<0:bg=#fcc\` |
| \`if\` keyword | ✅ YES (use \`if\`) | ❌ NO (\`if\` not used) |
| Equality | \`==\` or single \`=\` | \`==\` (double only) |
| String values | No quotes needed | MUST quote: \`"value"\` |
| Example | \`@column 損益 type=int if<0:color=red\` | \`@row 曜日=="土":bg=#eef\` |

### PowerPoint/Excel/Word Copy

After executing queries, copy buttons appear:

1. **📋 TSVコピー** (Tab-Separated Values)
   - Simple format, works everywhere
   - No styling preserved
   - Good for basic data transfer

2. **📋 HTMLコピー** (Rich HTML with styles)
   - Preserves colors, bold, formatting
   - Conditional styling maintained
   - Row styling maintained
   - Perfect for presentations

3. **📊 グラフコピー** (Chart as image) 🆕
   - Available when \`@chart\` directive is used
   - Copy chart as PNG image
   - Paste directly into PowerPoint/Word/Keynote
   - Includes title, legend, colors, and all styling

**Example workflow for charts:**
\`\`\`
Create query with @chart → Execute → Click 📈 グラフ → Click 📊 グラフコピー → Paste in PowerPoint
\`\`\`

**Example workflow:**
\`\`\`
Create a sales dashboard query with:
- Amount: right-aligned, comma-separated, negatives in red
- Achievement rate: 1 decimal, >=100% in green bold
- Date: yyyy/MM/dd format
- Rows with achievement >=100%: green background
Then copy as HTML for PowerPoint
\`\`\`

**Example prompts:**
\`\`\`
Generate a presentation-ready query for monthly sales. Use display options to make it look good in PowerPoint.
\`\`\`

\`\`\`
Create a report with row styling to highlight high-performing stores (sales > 1M) in green
\`\`\`

\`\`\`
Create a sales trend chart query showing store A and store B with line chart
\`\`\`

\`\`\`
Generate a mixed chart query with actual sales (bar) and target (line)
\`\`\`

\`\`\`
Create a pie chart showing top 10 stores by sales with custom colors using @row directives
\`\`\`

\`\`\`
Generate a pie chart query for store distribution with each store having a different color
\`\`\`

### Database Schema

**Location:** \`querycanvas-schema/tables/\`

Auto-generated Markdown files for each table. You can add logical names and descriptions.

**Example prompts:**
\`\`\`
Based on the table definition in querycanvas-schema/tables/orders.md, write a query to analyze sales trends
\`\`\`

\`\`\`
Using the schema in querycanvas-schema/, create a join query between users and orders tables
\`\`\`

### Query Results

**Location:** \`querycanvas-results/\`

Saved query results in TSV/JSON format with metadata.

### Best Practices for QueryCanvas

1. **Always use display options for presentation-ready results**
   - Right-align numbers
   - Add commas for large numbers
   - Use conditional styling for highlights
   - Use row styling to highlight important data

2. **Leverage conditional styling (column-level)**
   - Red for negatives: \`@column 損益 type=int if<0:color=red\`
   - Green for success: \`@column 達成率 type=float if>=100:color=green,bold=true\`
   - Orange for warnings: \`@column 在庫数 type=int if<=10:color=orange\`

3. **Leverage row styling (entire rows)**
   - Highlight weekends: \`@row 曜日=="土":bg=#eeeeff\`
   - Highlight high performers: \`@row 売上>1000000:bg=#ccffcc,bold=true\`
   - Highlight status: \`@row ステータス=="完了":bg=#d4edda,color=#155724\`
   - **Remember:** No \`if\`, use \`==\`, quote strings!

4. **Prefer HTML Copy for PowerPoint**
   - Preserves all styling and formatting
   - Conditional colors maintained
   - Row styling maintained
   - Professional-looking tables

5. **Keep queries read-only**
   - QueryCanvas only allows SELECT, SHOW, DESC, EXPLAIN
   - INSERT, UPDATE, DELETE are blocked for safety

6. **Use Cursor AI to generate SQL**
   - Edit session file directly
   - Add display options automatically
   - Optimize for presentation

### Common Tasks

**Generate formatted query:**
\`\`\`
Write a top 10 customers query with display options optimized for PowerPoint
\`\`\`

**Add styling to existing query:**
\`\`\`
Add conditional styling to the session file: amounts <0 in red, >1M in green
\`\`\`

**Add row styling:**
\`\`\`
Add row styling to highlight weekends (Saturday and Sunday) with different background colors
\`\`\`

**Create presentation:**
\`\`\`
Generate a sales report query with:
- Store name: 150px width
- Revenue: right-aligned, comma-separated, conditional colors
- Growth rate: 1 decimal, percentage-style
- Rows with revenue > 1M: green background
\`\`\`

**Create chart visualization:**
\`\`\`
Create a sales trend query with line chart showing last 30 days for store A and B
\`\`\`

\`\`\`
Generate a mixed chart query showing monthly sales (bar) and target (line)
\`\`\`

\`\`\`
Create a bar chart comparing top 10 products by revenue
\`\`\`

\`\`\`
Create a pie chart for top 10 stores with @row directives to specify colors for each store
\`\`\`

### Common Mistakes to Avoid ⚠️

**WRONG:**
\`\`\`sql
@row if 曜日=土:background=#eeeeff
\`\`\`
- ❌ Has \`if\` keyword (not needed for @row)
- ❌ Uses \`=\` (single equals)
- ❌ Uses \`background\` instead of \`bg\`

**CORRECT:**
\`\`\`sql
@row 曜日=="土":bg=#eeeeff
\`\`\`
- ✅ No \`if\` keyword
- ✅ Uses \`==\` (double equals)
- ✅ Uses \`bg\`
- ✅ String is quoted

### Documentation References

- Full guide: See project README.md
- Display options: See DISPLAY-OPTIONS-QUICK-GUIDE.md
- Row styling guide: See docs/ROW-STYLING-GUIDE.md
- PowerPoint copy: See docs/POWERPOINT-COPY-GUIDE.md
- Chart visualization: See docs/CHART-VISUALIZATION-GUIDE.md 🆕
- Mixed chart examples: See docs/examples/mixed-chart-examples.sql 🆕

---

## ⚠️ FINAL REMINDER: Row Styling Syntax

\`\`\`sql
-- Column styling (uses 'if'):
@column 売上 type=int if<0:color=red

-- Row styling (NO 'if', use '==', quote strings):
@row 曜日=="土":bg=#eeeeff
@row 売上>1000000:bg=#ccffcc
\`\`\`

**Never mix these syntaxes!**

---`;
    }

    /**
     * テンプレートを生成
     */
    private static getTemplate(): string {
        const version = this.getExtensionVersion();
        const content = this.getTemplateContent();
        const hash = this.calculateHash(content);

        return `${this.SECTION_START}
${this.SECTION_TITLE}
# Auto-generated by QueryCanvas v${version}
${this.HASH_MARKER} ${hash}
${this.SECTION_END}

${content}

## ⚠️ MOST IMPORTANT: SQL Display Options Syntax

When generating SQL with display options, follow these rules EXACTLY:

### @column directive (cell styling)
\`\`\`sql
@column <name> type=int if<0:color=red
\`\`\`
- Use \`if<operator><value>:style\` for conditions
- Example: \`@column 売上 type=int if<0:color=red if>1000000:color=green\`

### @row directive (entire row styling)
\`\`\`sql
@row <column_name><operator><value>:<styles>
\`\`\`
- **NO \`if\` keyword!**
- Use \`==\` (double equals) for equality
- Quote strings: \`"value"\` or \`'value'\`
- Use \`bg\` NOT \`background\`
- Example: \`@row 曜日=="土":bg=#eeeeff\`
- Example: \`@row 売上>1000000:bg=#ccffcc,bold=true\`

### @chart directive (graph visualization) 🆕
\`\`\`sql
@chart type=line x=日付 y=売上,利益
@chart type=mixed x=月 y=売上:bar,目標:line
\`\`\`
- **Required:** \`type\`, \`x\` (or \`xAxis\`), \`y\` (or \`yAxis\`)
- **Chart types:** \`line\`, \`bar\`, \`pie\`, \`area\`, \`scatter\`, \`mixed\`
- **Y-axis:** Comma-separated for multiple series (e.g., \`y=店舗A,店舗B,店舗C\`)
- **Mixed charts:** Specify type for each series: \`y=売上:bar,目標:line,達成率:line\`
- **Optional:** \`title="タイトル"\`, \`legend=true\`, \`grid=true\`, \`stacked=true\`, \`curve=smooth\`
- Example: \`@chart type=line x=日付 y=小村井店,京成小岩店 title="店舗別売上推移"\`
- Example: \`@chart type=mixed x=月 y=売上:bar,目標:line title="売上と目標"\`

### ❌ WRONG Examples
\`\`\`sql
@row if 曜日=土:background=#eee     ❌ NO! Has 'if', uses '=', uses 'background'
@row 国名=フランス:bg=#fee           ❌ NO! No quotes, uses single '='
@chart x=日付                       ❌ NO! Missing required 'type' and 'y'
\`\`\`

### ✅ CORRECT Examples
\`\`\`sql
@row 曜日=="土":bg=#eee              ✅ YES!
@row 国名=="フランス":bg=#fee        ✅ YES!
@row 売上>1000000:bg=#ccffcc         ✅ YES!
@chart type=line x=日付 y=売上       ✅ YES!
@chart type=mixed x=月 y=売上:bar,目標:line ✅ YES!
\`\`\`

---

## QueryCanvas Integration

This project uses QueryCanvas for database access and SQL query management.

### Session File

**Location:** \`.vscode/querycanvas-session.json\`

Contains:
- Current SQL query in the editor
- Active database connection ID
- You can edit this file directly to modify SQL

**Example prompts for Cursor AI:**
\`\`\`
Edit .vscode/querycanvas-session.json to add a WHERE clause filtering by date
\`\`\`

\`\`\`
Modify the SQL in the session file to add display options for PowerPoint
\`\`\`

### SQL Display Options

Format query results using \`/** @column ... */\` and \`/** @row ... */\` comments:

#### Column Styling (individual cells)
\`\`\`sql
/**
 * @column amount type=int align=right format=number comma=true if<0:color=red
 * @column date format=datetime pattern=yyyy/MM/dd
 */
SELECT amount, date FROM sales;
\`\`\`

#### Row Styling (entire rows)
\`\`\`sql
/**
 * @row 曜日=="土":bg=#eeeeff
 * @row 曜日=="日":bg=#ffeeee
 * @row 売上>1000000:bg=#ccffcc,bold=true
 * @column 売上 type=int align=right format=number comma=true
 */
SELECT 曜日, 売上 FROM daily_sales;
\`\`\`

#### Graph Visualization 🆕
\`\`\`sql
/**
 * @chart type=line x=日付 y=小村井店,京成小岩店 title="店舗別売上推移"
 * @row 曜日=="土":bg=#eeeeff
 * @row 曜日=="日":bg=#ffeeee
 * @column 小村井店 type=int align=right format=number comma=true color="#FF0000"
 * @column 京成小岩店 type=int align=right format=number comma=true color="#008800"
 */
SELECT 日付, 曜日, 小村井店, 京成小岩店 FROM daily_sales;
\`\`\`

**Chart types:**
- \`line\` - Line chart (trends, time-series)
- \`bar\` - Bar chart (category comparison)
- \`pie\` - Pie chart (proportions, market share)
- \`area\` - Area chart (cumulative data)
- \`scatter\` - Scatter plot (correlations)
- \`mixed\` - Mixed chart (bar + line): \`y=売上:bar,目標:line\`

**Pie chart color specification:**
For pie charts, use \`@row\` directives to specify colors for each segment:
\`\`\`sql
/**
 * @chart type=pie x=店舗名 y=件数 title="店舗別シェア"
 * @row 店舗名=="小村井店":color=#FF6384
 * @row 店舗名=="京成小岩店":color=#36A2EB
 * @row 店舗名=="その他":color=#FFCE56
 */
SELECT 店舗名, 件数 FROM sales;
\`\`\`

**Alternative:** You can also use \`colors\` parameter:
\`\`\`sql
@chart type=pie x=店舗名 y=件数 colors="#FF6384,#36A2EB,#FFCE56"
\`\`\`

**Priority:** \`@row\` directives > \`colors\` parameter > default palette

**View toggle:**
- **📊 テーブル** button: Table view
- **📈 グラフ** button: Chart view
- **📊 グラフコピー** button: Copy chart as image for PowerPoint

**Mixed chart example:**
\`\`\`sql
/**
 * @chart type=mixed x=月 y=売上:bar,目標:line title="売上実績と目標"
 * @column 売上 type=int align=right format=number comma=true color="#36A2EB"
 * @column 目標 type=int align=right format=number comma=true color="#FF6384"
 */
SELECT 月, 売上, 目標 FROM monthly_sales;
\`\`\`

**Common options:**
- \`align=right\` - Right align (recommended for numbers)
- \`format=number comma=true\` - Add thousand separators (1,234,567)
- \`decimal=2\` - 2 decimal places (e.g., 123.45)
- \`format=datetime pattern=yyyy/MM/dd\` - Date formatting
- \`if<0:color=red\` - Conditional styling (negatives in red) - FOR @column ONLY
- \`if>=100:color=green,bold=true\` - Multiple styles - FOR @column ONLY

**Row styling (entire row):**
- \`@row 列名=="値":bg=#色\` - String comparison (quotes required!)
- \`@row 列名>1000:bg=#色,bold=true\` - Numeric comparison
- **IMPORTANT:** No \`if\` keyword, use \`==\` not \`=\`, quote strings

**Example prompts:**
\`\`\`
Add display options to format the 'price' column with commas and 2 decimal places
\`\`\`

\`\`\`
Create a sales report query with conditional styling: negative values red, values over 1M green
\`\`\`

\`\`\`
Add row styling to highlight weekends (Saturdays in light blue, Sundays in light red)
\`\`\`

### Syntax Comparison (IMPORTANT!)

| Feature | Column Style | Row Style |
|---------|-------------|-----------|
| Directive | \`@column\` | \`@row\` |
| Conditional | \`if<0:color=red\` | \`売上<0:bg=#fcc\` |
| \`if\` keyword | ✅ YES (use \`if\`) | ❌ NO (\`if\` not used) |
| Equality | \`==\` or single \`=\` | \`==\` (double only) |
| String values | No quotes needed | MUST quote: \`"value"\` |
| Example | \`@column 損益 type=int if<0:color=red\` | \`@row 曜日=="土":bg=#eef\` |

### PowerPoint/Excel/Word Copy

After executing queries, copy buttons appear:

1. **📋 TSVコピー** (Tab-Separated Values)
   - Simple format, works everywhere
   - No styling preserved
   - Good for basic data transfer

2. **📋 HTMLコピー** (Rich HTML with styles)
   - Preserves colors, bold, formatting
   - Conditional styling maintained
   - Row styling maintained
   - Perfect for presentations

3. **📊 グラフコピー** (Chart as image) 🆕
   - Available when \`@chart\` directive is used
   - Copy chart as PNG image
   - Paste directly into PowerPoint/Word/Keynote
   - Includes title, legend, colors, and all styling

**Example workflow for charts:**
\`\`\`
Create query with @chart → Execute → Click 📈 グラフ → Click 📊 グラフコピー → Paste in PowerPoint
\`\`\`

**Example workflow:**
\`\`\`
Create a sales dashboard query with:
- Amount: right-aligned, comma-separated, negatives in red
- Achievement rate: 1 decimal, >=100% in green bold
- Date: yyyy/MM/dd format
- Rows with achievement >=100%: green background
Then copy as HTML for PowerPoint
\`\`\`

**Example prompts:**
\`\`\`
Generate a presentation-ready query for monthly sales. Use display options to make it look good in PowerPoint.
\`\`\`

\`\`\`
Create a report with row styling to highlight high-performing stores (sales > 1M) in green
\`\`\`

\`\`\`
Create a sales trend chart query showing store A and store B with line chart
\`\`\`

\`\`\`
Generate a mixed chart query with actual sales (bar) and target (line)
\`\`\`

\`\`\`
Create a pie chart showing top 10 stores by sales with custom colors using @row directives
\`\`\`

\`\`\`
Generate a pie chart query for store distribution with each store having a different color
\`\`\`

### Database Schema

**Location:** \`querycanvas-schema/tables/\`

Auto-generated Markdown files for each table. You can add logical names and descriptions.

**Example prompts:**
\`\`\`
Based on the table definition in querycanvas-schema/tables/orders.md, write a query to analyze sales trends
\`\`\`

\`\`\`
Using the schema in querycanvas-schema/, create a join query between users and orders tables
\`\`\`

### Query Results

**Location:** \`querycanvas-results/\`

Saved query results in TSV/JSON format with metadata.

### Best Practices for QueryCanvas

1. **Always use display options for presentation-ready results**
   - Right-align numbers
   - Add commas for large numbers
   - Use conditional styling for highlights
   - Use row styling to highlight important data

2. **Leverage conditional styling (column-level)**
   - Red for negatives: \`@column 損益 type=int if<0:color=red\`
   - Green for success: \`@column 達成率 type=float if>=100:color=green,bold=true\`
   - Orange for warnings: \`@column 在庫数 type=int if<=10:color=orange\`

3. **Leverage row styling (entire rows)**
   - Highlight weekends: \`@row 曜日=="土":bg=#eeeeff\`
   - Highlight high performers: \`@row 売上>1000000:bg=#ccffcc,bold=true\`
   - Highlight status: \`@row ステータス=="完了":bg=#d4edda,color=#155724\`
   - **Remember:** No \`if\`, use \`==\`, quote strings!

4. **Prefer HTML Copy for PowerPoint**
   - Preserves all styling and formatting
   - Conditional colors maintained
   - Row styling maintained
   - Professional-looking tables

5. **Keep queries read-only**
   - QueryCanvas only allows SELECT, SHOW, DESC, EXPLAIN
   - INSERT, UPDATE, DELETE are blocked for safety

6. **Use Cursor AI to generate SQL**
   - Edit session file directly
   - Add display options automatically
   - Optimize for presentation

### Common Tasks

**Generate formatted query:**
\`\`\`
Write a top 10 customers query with display options optimized for PowerPoint
\`\`\`

**Add styling to existing query:**
\`\`\`
Add conditional styling to the session file: amounts <0 in red, >1M in green
\`\`\`

**Add row styling:**
\`\`\`
Add row styling to highlight weekends (Saturday and Sunday) with different background colors
\`\`\`

**Create presentation:**
\`\`\`
Generate a sales report query with:
- Store name: 150px width
- Revenue: right-aligned, comma-separated, conditional colors
- Growth rate: 1 decimal, percentage-style
- Rows with revenue > 1M: green background
\`\`\`

**Create chart visualization:**
\`\`\`
Create a sales trend query with line chart showing last 30 days for store A and B
\`\`\`

\`\`\`
Generate a mixed chart query showing monthly sales (bar) and target (line)
\`\`\`

\`\`\`
Create a bar chart comparing top 10 products by revenue
\`\`\`

\`\`\`
Create a pie chart for top 10 stores with @row directives to specify colors for each store
\`\`\`

### Common Mistakes to Avoid ⚠️

**WRONG:**
\`\`\`sql
@row if 曜日=土:background=#eeeeff
\`\`\`
- ❌ Has \`if\` keyword (not needed for @row)
- ❌ Uses \`=\` (single equals)
- ❌ Uses \`background\` instead of \`bg\`

**CORRECT:**
\`\`\`sql
@row 曜日=="土":bg=#eeeeff
\`\`\`
- ✅ No \`if\` keyword
- ✅ Uses \`==\` (double equals)
- ✅ Uses \`bg\`
- ✅ String is quoted

### Documentation References

- Full guide: See project README.md
- Display options: See DISPLAY-OPTIONS-QUICK-GUIDE.md
- Row styling guide: See docs/ROW-STYLING-GUIDE.md
- PowerPoint copy: See docs/POWERPOINT-COPY-GUIDE.md
- Chart visualization: See docs/CHART-VISUALIZATION-GUIDE.md 🆕
- Mixed chart examples: See docs/examples/mixed-chart-examples.sql 🆕

---

## ⚠️ FINAL REMINDER: Row Styling Syntax

\`\`\`sql
-- Column styling (uses 'if'):
@column 売上 type=int if<0:color=red

-- Row styling (NO 'if', use '==', quote strings):
@row 曜日=="土":bg=#eeeeff
@row 売上>1000000:bg=#ccffcc
\`\`\`

**Never mix these syntaxes!**

---
`;
    }

    /**
     * 拡張機能のバージョンを取得
     */
    private static getExtensionVersion(): string {
        try {
            const extension = vscode.extensions.getExtension('okuyamashin.querycanvas');
            return extension?.packageJSON.version || '0.1.2';
        } catch {
            return '0.1.2';
        }
    }

    /**
     * テキストのハッシュ値を計算（SHA256）
     */
    private static calculateHash(text: string): string {
        return crypto.createHash('sha256').update(text, 'utf8').digest('hex').substring(0, 16);
    }

    /**
     * .cursorrules ファイルからQueryCanvasセクションのハッシュ値を抽出
     */
    private static extractHashFromContent(content: string): string | null {
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.includes(this.HASH_MARKER)) {
                const hashMatch = line.match(new RegExp(`${this.HASH_MARKER}\\s+([a-f0-9]+)`, 'i'));
                if (hashMatch && hashMatch[1]) {
                    return hashMatch[1];
                }
            }
        }
        return null;
    }

    /**
     * 現在のテンプレートのハッシュ値を取得
     */
    public static getCurrentTemplateHash(): string {
        const content = this.getTemplateContent();
        return this.calculateHash(content);
    }

    /**
     * .cursorrules に最新のテンプレートが既に書き込まれているかチェック
     * @returns true: 既に最新版が書き込まれている、false: 書き込まれていない、または古い
     */
    public static async isLatestTemplateAlreadyWritten(): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return false;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const cursorRulesPath = path.join(rootPath, '.cursorrules');

        try {
            if (!fs.existsSync(cursorRulesPath)) {
                return false;
            }

            const content = fs.readFileSync(cursorRulesPath, 'utf8');
            
            // QueryCanvasセクションが存在しない場合は false
            if (!this.hasQueryCanvasSection(content)) {
                return false;
            }

            // ハッシュ値を抽出
            const existingHash = this.extractHashFromContent(content);
            if (!existingHash) {
                // ハッシュ値がない場合は古いバージョンとみなす
                return false;
            }

            // 現在のテンプレートのハッシュ値と比較
            const currentHash = this.getCurrentTemplateHash();
            return existingHash === currentHash;
        } catch (error) {
            console.error('Error checking cursor rules hash:', error);
            return false;
        }
    }
}

