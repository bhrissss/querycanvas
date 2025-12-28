# QueryCanvas - AI-Powered Database Client

A Cursor-integrated database client extension for VS Code. Supports MySQL/PostgreSQL with AI-powered schema documentation and query management features designed for seamless integration with Cursor AI.

## Features

### 🤖 Cursor AI Integration ⭐
- **Edit SQL via AI**: Cursor can modify `.vscode/querycanvas-session.json` to update SQL in real-time
- **Automatic sync**: File watcher detects changes and updates UI immediately
- **AI-powered query generation**: Ask Cursor to write SQL with display options
- **Smart formatting**: Cursor knows the display options syntax and can apply it

### 🗄️ Database Connection
- **Multiple Connections**: Manage connections for development, staging, production environments
- **MySQL Support**: Supports MySQL 5.7+, 8.0+
- **PostgreSQL Support**: Supports PostgreSQL 12+
- **Secure Authentication**: Passwords securely stored in VS Code Secret Storage

### 📊 SQL Query Execution
- **Intuitive UI**: SQL input area and result display table
- **Performance Measurement**: Monitor query performance
- **Error Handling**: Clear error messages
- **🔒 Read-Only Mode**: Only SELECT, SHOW, DESC, EXPLAIN queries allowed (prevents accidental data modification)
- **✨ SQL Formatter**: One-click SQL formatting for better readability
- **🎨 Display Options**: Customize result display via SQL comments (alignment, number format, datetime format, colors)

### 📋 Automated Schema Documentation ⭐
- Automatically extract table structures
- Generate documentation in Markdown format (`querycanvas-schema/tables/`)
- Add logical names and descriptions with Cursor AI
- Preserves your additions during re-extraction
- Auto-extracts foreign keys and indexes

### 💾 Query Result Saving ⭐
- Export in **TSV/JSON** format
- Manage with names and comments (`querycanvas-results/`)
- Automatically records metadata (SQL, timestamp, row count)
- Analyze saved data with Cursor AI

### 💾 Saved Query Library ⭐
- Save frequently-used queries with names
- Categorize and search with tags
- Cache query results
- Instant display next time (no database connection needed)

### 🔄 Session Persistence ⭐
- Auto-save SQL input
- Continue work even after closing panel
- Cursor can edit session file
- Real-time SQL sync (Cursor ↔ UI)

### 🌍 Multilingual Support
- **English** (Default)
- **Japanese**
- Automatically adapts to VS Code language settings

## Screenshot

### Database Client Panel
```
┌─────────────────────────────────────────┐
│ Connection: [Dev DB ▼] Status: ●Connected│
│ [⚙️ Manage] [📋 Schema] [💾 Saved]       │
├─────────────────────────────────────────┤
│ SQL Input Area                          │
│ SELECT * FROM users;                    │
│                                         │
│ [Execute ▶]  [Clear]  [💾 Save Result]  │
├─────────────────────────────────────────┤
│ Result Table                            │
│ ┌────┬────────┬─────────┐              │
│ │ id │ name   │ email   │              │
│ ├────┼────────┼─────────┤              │
│ │ 1  │ Alice  │ a@ex.com│              │
│ │ 2  │ Bob    │ b@ex.com│              │
│ └────┴────────┴─────────┘              │
│                                         │
│ Execution time: 0.123s | Rows: 2        │
└─────────────────────────────────────────┘
```

## Usage

### 1. Open Database Client

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "**Database Client: Open**" and execute
3. Database client panel will open

### 2. Connect to Database

1. Click "⚙️ Manage Connections" button
2. Click "+ Add New Connection"
3. Enter connection information and save
4. Select connection from dropdown
5. Click "Connect" button

### 3. Execute SQL Query

1. Enter query in SQL input area
2. Click "▶ Execute" button
3. Results will be displayed in the table

**Tip: Use display options for better presentation:**
```sql
/**
 * @column amount align=right format=number comma=true
 * @column created_at format=datetime pattern=yyyy/MM/dd_HH:mm
 */
SELECT amount, created_at FROM orders LIMIT 10;
```

### 4. Save Query Results

1. After executing a query, click "💾 Save Result" button
2. Enter name, comment, and format (TSV/JSON)
3. Click "💾 Save" to save to `querycanvas-results/`
4. Manage past results via metadata file

### 5. Extract Schema

1. Connect to database
2. Click "📋 Extract Schema" button
3. All table definitions are saved to `querycanvas-schema/tables/` in Markdown format
4. Add logical names and descriptions with Cursor AI
5. Your additions are preserved during re-extraction

### 6. Use with Cursor AI (Advanced) 🤖

You can use Cursor AI to edit SQL queries directly:

1. Open Database Client and connect to database
2. Session file is created at `.vscode/querycanvas-session.json`
3. In Cursor Chat, ask:
   ```
   @Codebase Edit the SQL in querycanvas-session.json to select top 10 orders with amount > 1000,
   and add display options to format the amount with commas
   ```
4. Cursor AI modifies the session file
5. Changes appear in Database Client UI immediately
6. Click Execute to run the query

**Example prompts:**
- "Add a WHERE clause to the current SQL query"
- "Format the price column with 2 decimal places"
- "Add datetime formatting to the created_at column"
- "Rewrite this query to join with users table"

## Implementation Status

### ✅ Completed
- Basic Webview panel
- Database connection layer (MySQL/PostgreSQL)
- Interface-based design
- SSL connection support
- **Connection profile management** (add, edit, delete)
- **Password management** (Secret Storage)
- **Actual query execution**
- **Schema extraction & Markdown documentation generation**
- **Query result saving** (TSV/JSON + metadata)
- **Session persistence** (auto-save, file watching)
- **Saved query library** (with caching)
- **Internationalization** (English/Japanese)

### 📋 Future Plans
- Query history
- Auto-complete (table/column names)
- ER diagram generation
- Dataset diff view

## Development

### Setup

1. Install dependencies:
```bash
npm install
```

2. Compile TypeScript:
```bash
npm run compile
```

Or use watch mode for automatic compilation:
```bash
npm run watch
```

### Debug and Run

1. Open this project in VS Code/Cursor
2. Press `F5` (or "Run" → "Start Debugging")
3. A new window (Extension Development Host) will open
4. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
5. Type "Database Client: Open" and execute

### Project Structure

```
vsex001/
├── src/
│   ├── extension.ts                    # Extension entry point
│   ├── databaseClientPanel.ts          # Webview UI management
│   ├── schemaDocumentGenerator.ts      # Schema document generation
│   ├── queryResultSaver.ts             # Query result saving
│   ├── sessionStateManager.ts          # Session persistence
│   ├── savedQueryManager.ts            # Saved query library
│   ├── i18nManager.ts                  # Internationalization
│   ├── i18n/                           # Translation files
│   │   ├── en.json                     # English
│   │   └── ja.json                     # Japanese
│   └── database/                       # Database connection layer
│       ├── types.ts                    # Type definitions
│       ├── mysqlConnection.ts          # MySQL implementation
│       ├── postgresqlConnection.ts     # PostgreSQL implementation
│       ├── connectionFactory.ts        # Connection factory
│       ├── connectionProfileManager.ts # Profile management
│       └── index.ts
├── docs/                               # Documentation
│   ├── conversations/                  # Development history
│   └── specifications/                 # Specifications
├── querycanvas-schema/                 # Table definitions (auto-generated)
│   └── tables/                         # Markdown per table
├── querycanvas-results/                # Saved query results
│   └── metadata.json                   # Query result metadata
├── out/                                # Compiled JavaScript
├── .vscode/
│   ├── launch.json                     # Debug configuration
│   ├── tasks.json                      # Build task configuration
│   ├── querycanvas-connections.json    # Connection profiles (gitignored)
│   ├── querycanvas-session.json        # Session state (gitignored)
│   └── querycanvas-queries.json        # Saved queries (gitignored)
├── package.json                        # Extension manifest
├── tsconfig.json                       # TypeScript configuration
├── TESTING.md                          # Testing instructions
└── README.md                           # This file
```

## Technology Stack

- **TypeScript 5.3+**: Type-safe development
- **VS Code Extension API**: Extension foundation
- **mysql2**: MySQL Node.js client (Promise-based)
- **pg**: PostgreSQL Node.js client
- **Webview**: Custom UI implementation

## Architecture

### Design Patterns
- **Strategy Pattern**: Switch implementations based on database type
- **Factory Pattern**: Generate connection instances
- **Interface Segregation**: Unified common interface

### Security
- Passwords stored in VS Code Secret Storage
- Parameterized queries to prevent SQL injection
- SSL connection support
- **Read-Only Mode**: Prevents accidental data modification (INSERT, UPDATE, DELETE, ALTER, TRUNCATE are blocked)

## Documentation

- [TESTING.md](./TESTING.md) - Testing and debugging procedures
- [Specifications](./docs/specifications/) - Feature specifications and architecture
- [Conversation History](./docs/conversations/) - Development process

## Customization

### Adding a New Database Type

1. Add new type to `src/database/types.ts`
2. Create a new class implementing the `IDBConnection` interface
3. Add new case to `ConnectionFactory`

See [Database Connection Layer Specification](./docs/specifications/database-connection-layer.md) for details.

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [mysql2 Documentation](https://github.com/sidorares/node-mysql2)
- [node-postgres Documentation](https://node-postgres.com/)

## License

This is a sample project.

## Author

okuyama

## Repository

https://github.com/okuyamashin/vsex001
