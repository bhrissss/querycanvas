# Cursor AI Integration Guide

## Overview

This Database Client extension is designed to work seamlessly with Cursor AI. You can use Cursor's AI capabilities to write, modify, and optimize SQL queries.

## How It Works

### Session File Synchronization

The extension automatically saves your SQL query to `.vscode/querycanvas-session.json`. This file is:

1. **Monitored** - File watcher detects any changes
2. **Synced** - Changes automatically reflect in UI
3. **AI-editable** - Cursor AI can modify this file directly

### Workflow

```
┌──────────────┐
│ User opens   │
│ DB Client    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Session file created │
│ .vscode/db-client-   │
│ session.json         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ User asks Cursor AI  │
│ "Edit the SQL..."    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Cursor AI modifies   │
│ session.json         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ File watcher detects │
│ change               │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ UI updates SQL       │
│ automatically        │
└──────────────────────┘
```

## Session File Format

**Location:** `.vscode/querycanvas-session.json`

**Structure:**
```json
{
  "connectionId": "my-database",
  "isConnected": false,
  "sqlInput": "SELECT * FROM users WHERE id = 1",
  "lastUpdated": "2025-12-28T12:00:00.000Z"
}
```

**Fields:**
- `connectionId`: Database connection profile ID
- `isConnected`: Connection status (managed by extension)
- `sqlInput`: Current SQL query in editor
- `lastUpdated`: ISO 8601 timestamp of last change

## Using Cursor AI

### Example 1: Basic Query Modification

**User asks Cursor:**
> @Codebase Edit the SQL in querycanvas-session.json to add a LIMIT 10 clause

**Cursor AI does:**
1. Opens `.vscode/querycanvas-session.json`
2. Modifies `sqlInput` field:
```json
{
  "sqlInput": "SELECT * FROM users WHERE id = 1 LIMIT 10"
}
```
3. Saves the file

**Result:**
- SQL in Database Client UI updates automatically
- User clicks Execute to run the query

### Example 2: Add Display Options

**User asks Cursor:**
> @Codebase Add display options to the current SQL to format the 'amount' column with commas and 2 decimal places

**Cursor AI does:**
```json
{
  "sqlInput": "/**\n * @column amount align=right format=number comma=true decimal=2\n */\nSELECT amount FROM orders"
}
```

**Result:**
- SQL updates with comment-based display options
- When executed, amounts show as: 1,234.56

### Example 3: Complex Query Generation

**User asks Cursor:**
> @Codebase Write a SQL query to get the top 10 customers by total order amount in 2025, with display formatting for currency and dates

**Cursor AI does:**
```json
{
  "sqlInput": "/**\n * @column customer_name width=200px\n * @column total_amount align=right format=number comma=true decimal=2\n * @column order_count align=right\n * @column last_order format=datetime pattern=yyyy/MM/dd\n */\nSELECT \n    c.customer_name,\n    SUM(o.amount) AS total_amount,\n    COUNT(*) AS order_count,\n    MAX(o.order_date) AS last_order\nFROM customers c\nJOIN orders o ON c.id = o.customer_id\nWHERE YEAR(o.order_date) = 2025\nGROUP BY c.id, c.customer_name\nORDER BY total_amount DESC\nLIMIT 10"
}
```

**Result:**
- Formatted, optimized SQL appears in UI
- Display options ensure readable output
- User can execute immediately

## Best Practices

### 1. Use @Codebase Context

Always include `@Codebase` in your Cursor prompts so it can find the session file:

```
@Codebase Edit the SQL query to...
```

### 2. Be Specific About Display Options

If you want formatting, mention it explicitly:

```
@Codebase Write a SQL query with display options to format numbers with commas
```

### 3. Verify Before Execution

After Cursor AI modifies the SQL:
1. Check the UI to see the changes
2. Verify the SQL is correct
3. Click Execute when ready

### 4. Combine with Schema Knowledge

If schema extraction is done, Cursor knows your table structure:

```
@Codebase Write a query to get user orders with display formatting.
Use the table definitions in querycanvas-schema/
```

## Common Prompts

### Query Modification
```
@Codebase Add a WHERE clause to filter by status = 'active'
@Codebase Change the ORDER BY to sort by created_at DESC
@Codebase Add a JOIN with the products table
@Codebase Limit results to 50 rows
```

### Display Options
```
@Codebase Format the price column with 2 decimal places and commas
@Codebase Add datetime formatting to show dates as yyyy/MM/dd
@Codebase Make the status column green and bold
@Codebase Align all number columns to the right
```

### Query Generation
```
@Codebase Write a query to get monthly sales summary
@Codebase Generate a report query for top products by revenue
@Codebase Create a query to find users who haven't logged in for 30 days
```

### Optimization
```
@Codebase Optimize this query for better performance
@Codebase Rewrite this query using a CTE instead of subquery
@Codebase Add appropriate indexes suggestion as a comment
```

## Troubleshooting

### Changes Not Appearing in UI

**Problem:** Cursor AI modified the file but UI didn't update

**Solution:**
1. Check if Database Client is open
2. Verify file watcher is active (check debug console)
3. Try closing and reopening Database Client
4. Check for syntax errors in JSON

### Invalid JSON Format

**Problem:** Cursor AI created malformed JSON

**Solution:**
```
@Codebase Fix the syntax error in querycanvas-session.json
```

Cursor AI will validate and fix the JSON structure.

### SQL Not Valid

**Problem:** Generated SQL has errors

**Solution:**
1. Ask Cursor to fix it:
```
@Codebase Fix the SQL syntax error in the session file
```

2. Or manually edit in Database Client UI

## Advanced Usage

### Batch Operations

You can ask Cursor to prepare multiple queries:

```
@Codebase Create 3 queries in separate saved query files:
1. Daily sales report
2. User activity summary  
3. Inventory status
All with appropriate display formatting
```

### Documentation Integration

Cursor can reference your schema docs:

```
@Codebase Based on the table definition in querycanvas-schema/tables/orders.md,
write a query to analyze order patterns
```

### Template Creation

Ask Cursor to create reusable query templates:

```
@Codebase Create a template query for financial reports with standard
display options for currency and dates
```

## Integration with Other Features

### With Saved Queries

After Cursor generates SQL in session:
1. Execute the query
2. Click "⭐ Save Query"
3. SQL and display options are saved together

### With Schema Documentation

Cursor can read your schema docs:
```
@Codebase Using the BR_USER table definition, write a query to get
active users with formatted timestamps
```

### With Query Results

After execution:
```
@Codebase Save the current result to TSV with a descriptive name
```

## Tips for Better Results

### 1. Provide Context

Good:
```
@Codebase The current query is too slow. Optimize it and add display
options for the amount column.
```

Bad:
```
Make it faster
```

### 2. Specify Format Requirements

Good:
```
@Codebase Format currency with commas and 2 decimals, dates as MM/DD/YYYY
```

Bad:
```
Format it nicely
```

### 3. Reference Examples

Good:
```
@Codebase Write a query similar to the one in saved-queries for
monthly reports but for weekly data
```

### 4. Iterate

Good:
```
@Codebase That's close, but also add a column for percentage change
```

## Security Notes

- Session file contains SQL queries only (no passwords)
- Read-only mode prevents accidental data modification
- Only SELECT, SHOW, DESC, EXPLAIN are allowed
- Cursor AI respects these restrictions

## Further Reading

- `.cursorrules` - Project rules for Cursor AI
- `docs/specifications/display-options.md` - Complete display options reference
- `README.md` - General usage guide

## Feedback

This integration is designed to enhance productivity. If you have suggestions for better Cursor AI integration, please contribute to the project!

